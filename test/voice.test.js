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
  assert.equal(detectVoiceIntent("Ask Liam for Power Platform risks").routedAgent, "liam");
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
    assert.equal(service.status().setup.readyForTypedCommands, true);
    assert.equal(service.status().retention.transcriptRetentionDays, 30);
  });
});

test("voice provider diagnostics report setup without secrets or external calls", () => {
  withDatabase((db) => {
    const service = serviceFor(db, {
      speechToText: new DeepgramSpeechClient({
        apiKey: "dg-test-secret",
        fetchImpl: async () => { throw new Error("diagnostics must not call Deepgram"); },
      }),
      textToSpeech: {
        status: () => ({
          provider: "elevenlabs",
          configured: false,
          apiKeyConfigured: true,
          voiceIdConfigured: false,
          model: "test-tts",
        }),
        synthesize: async () => { throw new Error("diagnostics must not call ElevenLabs"); },
      },
    });

    const result = service.diagnostics({ userAction: "test:voice:diagnostics" });
    const elevenlabs = result.setup.checklist.find((item) => item.id === "elevenlabs");
    const audit = listVoiceAudit(db);

    assert.equal(result.externalCallsMade, false);
    assert.equal(result.executionAttempted, false);
    assert.equal(result.setup.secretsExposed, false);
    assert.equal(result.setup.readyForMicrophone, true);
    assert.equal(result.setup.readyForSpokenOutput, false);
    assert.deepEqual(elevenlabs.missingEnv, ["ELEVENLABS_VOICE_ID"]);
    assert.doesNotMatch(JSON.stringify(result), /dg-test-secret/);
    assert.equal(audit[0].eventType, "voice_setup_diagnostics");
    assert.equal(audit[0].executionAttempted, false);
    assert.equal(audit[0].metadata.secretsExposed, false);
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
    assert.match(result.response, /Liam/i);
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

test("voice retention purge deletes only old local conversation turns", async () => {
  await withDatabase(async (db) => {
    setVoiceSettings(db, { transcriptRetentionDays: 7 });
    const service = serviceFor(db);
    const oldTurn = await service.handleCommand({ transcript: "Alfred, brief me", userAction: "test:voice:old-turn" });
    const currentTurn = await service.handleCommand({ transcript: "Ask Olivia for revenue forecast", userAction: "test:voice:current-turn" });

    db.prepare("UPDATE voice_conversation_turns SET created_at = datetime('now', '-10 days') WHERE id = ?").run(oldTurn.turn.id);
    const result = service.purgeConversations({ userAction: "test:voice:purge" });
    const turns = listVoiceConversationTurns(db);
    const audit = listVoiceAudit(db);

    assert.equal(result.deletedCount, 1);
    assert.equal(result.olderThanDays, 7);
    assert.equal(result.executionAttempted, false);
    assert.deepEqual(turns.map((turn) => turn.id), [currentTurn.turn.id]);
    assert.equal(audit[0].eventType, "voice_retention_purge");
    assert.equal(audit[0].executionAttempted, false);
    assert.equal(audit[0].metadata.deletedCount, 1);
  });
});

test("voice routing reaches Sarah, Olivia, Liam and Westbridge advisory specialists", async () => {
  await withDatabase(async (db) => {
    const service = serviceFor(db);

    const sarah = await service.handleCommand({ transcript: "Ask Sarah to review Westminster" });
    const olivia = await service.handleCommand({ transcript: "Ask Olivia for revenue forecast" });
    const liam = await service.handleCommand({ transcript: "Ask Liam for Dataverse blueprint" });
    const westbridge = await service.handleCommand({ transcript: "Ask Westbridge for property pipeline" });

    assert.equal(sarah.detectedIntent.routedAgent, "sarah");
    assert.equal(olivia.detectedIntent.routedAgent, "olivia");
    assert.equal(liam.detectedIntent.routedAgent, "liam");
    assert.equal(westbridge.detectedIntent.routedAgent, "westbridge-property-director");
    assert.ok(sarah.specialistContributions.some((item) => item.agent === "Sarah"));
    assert.ok(olivia.specialistContributions.some((item) => item.agent === "Olivia"));
    assert.ok(liam.specialistContributions.some((item) => item.agent === "Liam"));
    assert.ok(westbridge.specialistContributions.some((item) => /Westbridge/.test(item.agent)));
    assert.equal(sarah.executionAttempted, false);
    assert.equal(olivia.executionAttempted, false);
    assert.equal(liam.executionAttempted, false);
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
