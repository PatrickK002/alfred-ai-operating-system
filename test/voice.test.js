import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createApprovalRequest,
  createDatabase,
  getMorningBrief,
  listVoiceAudit,
  listVoiceConversationTurns,
  setVoiceSettings,
} from "../db.js";
import {
  DeepgramSpeechClient,
  VOICE_READ_ONLY_BOUNDARY,
  createVoiceCommandService,
  detectVoiceIntent,
} from "../voice.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-voice-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  const cleanup = () => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const result = run(db);
    if (result && typeof result.then === "function") return result.finally(cleanup);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function serviceFor(db, overrides = {}) {
  return createVoiceCommandService({
    db,
    getExecutiveBrief: async () => ({
      ...getMorningBrief(db),
      executivePriorities: [
        { title: "Westminster delivery review", detail: "Chairman attention required.", category: "project", score: 82 },
      ],
      riskSignals: [
        { id: 1, title: "Westminster delivery review", detail: "Confirm current deliverables.", priority: "high" },
      ],
      decisionPrompts: [
        { id: 1, title: "Define assurance platform MVP", detail: "Approve the first user journey.", priority: "high" },
      ],
      emails: [],
      meetings: { available: false, items: [], message: "Calendar is not connected. No meeting data was reviewed." },
    }),
    textToSpeech: {
      status: () => ({ provider: "elevenlabs", configured: false, model: "test-tts" }),
      synthesize: async () => {
        const error = new Error("ElevenLabs is not configured.");
        error.code = "ELEVENLABS_NOT_CONFIGURED";
        throw error;
      },
    },
    ...overrides,
  });
}

test("voice command intent detection routes supported commands", () => {
  assert.deepEqual(detectVoiceIntent("Alfred, brief me").intent, "executive_briefing");
  assert.equal(detectVoiceIntent("Ask Sarah to review Westminster").routedAgent, "sarah");
  assert.equal(detectVoiceIntent("Ask Olivia for revenue forecast").routedAgent, "olivia");
  assert.equal(detectVoiceIntent("Ask Westbridge for property pipeline").routedAgent, "westbridge-property-director");
  assert.equal(detectVoiceIntent("Show Westminster status").linkedProject, "Westminster");
});

test("voice session creation stores local session metadata", () => {
  withDatabase((db) => {
    const service = serviceFor(db);
    const session = service.createSession({ source: "test" });

    assert.equal(session.status, "created");
    assert.equal(session.metadata.source, "test");
    assert.equal(service.status().boundary.voiceExecutionEnabled, false);
  });
});

test("missing Deepgram key is handled gracefully for microphone input", async () => {
  await withDatabase(async (db) => {
    const service = serviceFor(db, {
      speechToText: new DeepgramSpeechClient({ apiKey: "", fetchImpl: async () => { throw new Error("should not call network"); } }),
    });

    const result = await service.handleCommand({
      audioBase64: Buffer.from("audio").toString("base64"),
      mimeType: "audio/webm",
      userAction: "test:voice:microphone",
    });
    const audit = listVoiceAudit(db);

    assert.equal(result.status, "error");
    assert.equal(result.errorCode, "DEEPGRAM_NOT_CONFIGURED");
    assert.equal(result.boundary.externalWritesEnabled, false);
    assert.equal(audit[0].status, "error");
    assert.equal(audit[0].executionAttempted, false);
  });
});

test("missing ElevenLabs key falls back to text while storing transcript", async () => {
  await withDatabase(async (db) => {
    const service = serviceFor(db);
    const result = await service.handleCommand({ transcript: "Alfred, brief me", userAction: "test:voice:brief" });
    const turns = listVoiceConversationTurns(db);

    assert.equal(result.status, "completed");
    assert.equal(result.audio.status, "text_only");
    assert.equal(result.transcript, "Alfred, brief me");
    assert.match(result.response, /Olivia/i);
    assert.match(result.response, /Sarah/i);
    assert.match(result.response, /Westbridge/i);
    assert.equal(turns[0].transcript, "Alfred, brief me");
    assert.equal(turns[0].transcriptLogged, true);
    assert.equal(turns[0].linkedAgent, "alfred");
  });
});

test("transcript logging disabled does not persist transcript content", async () => {
  await withDatabase(async (db) => {
    setVoiceSettings(db, { transcriptLoggingEnabled: false });
    const service = serviceFor(db);
    const result = await service.handleCommand({ transcript: "What are my biggest risks?", userAction: "test:voice:no-transcript-log" });
    const turns = listVoiceConversationTurns(db);

    assert.equal(result.transcriptLogged, false);
    assert.equal(result.transcript, "");
    assert.equal(turns[0].transcript, "");
    assert.equal(turns[0].transcriptLogged, false);
  });
});

test("voice routing reaches Sarah, Olivia and Westbridge advisory specialists", async () => {
  await withDatabase(async (db) => {
    const service = serviceFor(db);

    const sarah = await service.handleCommand({ transcript: "Ask Sarah to review Westminster" });
    const olivia = await service.handleCommand({ transcript: "Ask Olivia for revenue forecast" });
    const westbridge = await service.handleCommand({ transcript: "Ask Westbridge for property pipeline" });

    assert.equal(sarah.detectedIntent.routedAgent, "sarah");
    assert.equal(olivia.detectedIntent.routedAgent, "olivia");
    assert.equal(westbridge.detectedIntent.routedAgent, "westbridge-property-director");
    assert.ok(sarah.specialistContributions.some((item) => item.agent === "Sarah"));
    assert.ok(olivia.specialistContributions.some((item) => item.agent === "Olivia"));
    assert.ok(westbridge.specialistContributions.some((item) => /Westbridge/.test(item.agent)));
    assert.equal(sarah.executionAttempted, false);
    assert.equal(olivia.executionAttempted, false);
    assert.equal(westbridge.executionAttempted, false);
  });
});

test("Claude voice analysis receives structured read-only context when available", async () => {
  await withDatabase(async (db) => {
    let receivedInput;
    const service = serviceFor(db, {
      aiReasoning: {
        analyzeVoiceCommand: async (input) => {
          receivedInput = input;
          return {
            analysis: {
              spokenResponse: "Patrick, the priority is Westminster. No action has been taken.",
              routedAgent: "alfred",
              specialistContributions: [],
              recommendedNextActions: [],
              confidenceLevel: "high",
              assumptions: [],
              sourceRecordReferences: [{ reference: "briefing:priority:1", label: "Westminster", category: "briefing" }],
            },
            model: "fake-claude",
            readOnly: true,
            executedActions: [],
          };
        },
      },
    });

    const result = await service.handleCommand({ transcript: "What requires my attention today?" });

    assert.equal(receivedInput.boundaries.voiceExecutionEnabled, false);
    assert.equal(receivedInput.boundaries.externalWritesEnabled, false);
    assert.equal(result.response, "Patrick, the priority is Westminster. No action has been taken.");
    assert.equal(result.audit.model, "fake-claude");
    assert.equal(result.executedActions.length, 0);
  });
});

test("voice cannot bypass approvals or execute external actions", async () => {
  await withDatabase(async (db) => {
    createApprovalRequest(db, {
      actionType: "send_email",
      targetSystem: "Microsoft Outlook",
      title: "Send client update",
      description: "Proposed external email only.",
      idempotencyKey: "voice-approval-test",
    });
    const service = serviceFor(db);
    const result = await service.handleCommand({ transcript: "What decisions are waiting for approval?" });
    const audit = listVoiceAudit(db);

    assert.equal(VOICE_READ_ONLY_BOUNDARY.approvalBypassAllowed, false);
    assert.match(result.response, /Voice cannot approve, reject or execute/i);
    assert.equal(result.boundary.emailSendEnabled, false);
    assert.equal(result.executionAttempted, false);
    assert.equal(result.executedActions.length, 0);
    assert.equal(audit[0].executionAttempted, false);
  });
});
