import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAiReasoningService } from "../ai.js";
import {
  ALFRED_CEO_SYSTEM_PROMPT,
  ANTHROPIC_API_VERSION,
  AnthropicClient,
  parseStructuredJson,
} from "../anthropic.js";
import {
  createDatabase,
  listAiAnalysisAudit,
} from "../db.js";

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-ai-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  try {
    return await run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const briefingAnalysis = {
  executiveSummary: "Patrick should focus on the delivery risk and one decision today.",
  topPriorities: [{
    title: "Resolve delivery risk",
    rationale: "It is high priority and time-sensitive.",
    urgency: "today",
    sourceReference: "risk:1",
  }],
  risks: [{
    title: "Delivery risk",
    assessment: "Client deadline pressure is visible.",
    mitigation: "Confirm owner and next action.",
    confidence: "high",
    sourceReference: "risk:1",
  }],
  decisionsRequired: [{
    title: "MVP scope",
    whyNow: "The product decision gates next work.",
    approvalRequired: true,
    sourceReference: "decision:1",
  }],
  recommendedNextActions: [{
    action: "Review the risk register",
    owner: "Patrick King",
    timing: "Today",
    requiresApproval: false,
    sourceReference: "risk:1",
  }],
  confidenceLevel: "high",
  assumptions: ["Calendar data may be incomplete."],
  sourceRecordReferences: [{ reference: "risk:1", label: "Delivery risk", category: "risk" }],
};

const decisionAnalysis = {
  recommendation: "Choose the narrower option and request one more commercial check.",
  pros: ["Lower delivery risk"],
  cons: ["Less scope"],
  risks: ["Scope may be too narrow"],
  nextAction: "Patrick to confirm preferred option.",
  patrickApprovalRequired: true,
  confidenceLevel: "medium",
  assumptions: ["No financial model was supplied."],
  sourceRecordReferences: [{ reference: "decision:1", label: "MVP scope", category: "decision" }],
};

test("CEO system prompt denies write and execution permissions", () => {
  assert.match(ALFRED_CEO_SYSTEM_PROMPT, /protect Patrick's time/i);
  assert.match(ALFRED_CEO_SYSTEM_PROMPT, /no write permission/i);
  assert.match(ALFRED_CEO_SYSTEM_PROMPT, /Never send email/i);
  assert.match(ALFRED_CEO_SYSTEM_PROMPT, /Never.*execute approvals/i);
});

test("parses JSON even when the model wraps the structured response", () => {
  assert.deepEqual(parseStructuredJson("```json\n{\"ready\":true}\n```"), { ready: true });
  assert.deepEqual(parseStructuredJson("Here is the analysis:\n{\"ready\":false}"), { ready: false });
  assert.equal(parseStructuredJson("not json"), null);
});

test("missing Anthropic key is handled gracefully and audited", async () => {
  await withDatabase(async (db) => {
    const client = new AnthropicClient({ apiKey: "", model: "test-model" });
    const service = createAiReasoningService({ db, client });

    await assert.rejects(
      () => service.analyzeBriefing({ currentExecutiveBriefing: {} }, {
        userAction: "test:missing-key",
        dataCategories: ["executive_briefing"],
      }),
      (error) => error.statusCode === 503 && error.code === "ANTHROPIC_NOT_CONFIGURED",
    );

    const audit = listAiAnalysisAudit(db);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].status, "error");
    assert.equal(audit[0].errorCode, "ANTHROPIC_NOT_CONFIGURED");
    assert.equal(audit[0].executionAttempted, false);
  });
});

test("AI briefing returns structured output without execution tools", async () => {
  const calls = [];
  await withDatabase(async (db) => {
    const client = new AnthropicClient({
      apiKey: "test-key",
      model: "claude-test",
      fetchImpl: async (url, options) => {
        calls.push({ url, options, body: JSON.parse(options.body) });
        return jsonResponse({
          model: "claude-test",
          usage: { input_tokens: 100, output_tokens: 80 },
          content: [{ type: "text", text: JSON.stringify(briefingAnalysis) }],
        });
      },
    });
    const service = createAiReasoningService({ db, client });
    const result = await service.analyzeBriefing({
      currentExecutiveBriefing: { summary: { totalOpen: 3 } },
      risks: [{ id: 1, title: "Delivery risk" }],
    }, {
      userAction: "test:briefing",
      dataCategories: ["executive_briefing", "risks"],
    });

    assert.equal(result.analysis.executiveSummary, briefingAnalysis.executiveSummary);
    assert.deepEqual(result.executedActions, []);
    assert.equal(result.executionAttempted, false);
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    assert.equal(calls[0].options.headers["anthropic-version"], ANTHROPIC_API_VERSION);
    assert.equal(calls[0].body.tools, undefined);
    assert.equal(calls[0].body.output_config.format.type, "json_schema");
    assert.match(calls[0].body.system, /Never send email/);

    const audit = listAiAnalysisAudit(db);
    assert.equal(audit[0].status, "success");
    assert.equal(audit[0].outputSaved, false);
    assert.deepEqual(audit[0].dataCategories, ["executive_briefing", "risks"]);
  });
});

test("decision support returns structured recommendation and requires approval flag", async () => {
  await withDatabase(async (db) => {
    const client = new AnthropicClient({
      apiKey: "test-key",
      model: "claude-test",
      fetchImpl: async () => jsonResponse({
        model: "claude-test",
        content: [{ type: "text", text: JSON.stringify(decisionAnalysis) }],
      }),
    });
    const service = createAiReasoningService({ db, client });
    const result = await service.analyzeDecision({
      decisionTitle: "MVP scope",
      context: "Decide whether to narrow scope.",
      options: ["Narrow", "Broad"],
    }, {
      userAction: "test:decision",
      dataCategories: ["decision_support"],
    });

    assert.equal(result.analysis.patrickApprovalRequired, true);
    assert.match(result.analysis.nextAction, /Patrick/);
    assert.equal(listAiAnalysisAudit(db)[0].executionAttempted, false);
  });
});
