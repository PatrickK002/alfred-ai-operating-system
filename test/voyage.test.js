import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAiReasoningService } from "../ai.js";
import { AnthropicClient } from "../anthropic.js";
import { createSemanticMemoryService } from "../semantic-memory.js";
import { VoyageClient, VOYAGE_EMBEDDINGS_URL, cosineSimilarity } from "../voyage.js";
import {
  createDatabase,
  listAiAnalysisAudit,
  listSemanticMemoryRecords,
  setSemanticIndexingEnabled,
} from "../db.js";

async function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-memory-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  try {
    return await run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function embeddingFor(text) {
  const lower = String(text).toLowerCase();
  return [
    lower.includes("westminster") ? 1 : 0,
    lower.includes("council") || lower.includes("assurance") ? 1 : 0,
    lower.includes("cobie") || lower.includes("risk") ? 1 : 0,
  ];
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("missing Voyage key is handled gracefully with local fallback", async () => {
  await withDatabase(async (db) => {
    const client = new VoyageClient({ apiKey: "", model: "voyage-test" });
    const service = createSemanticMemoryService({ db, client });

    const result = await service.search("Westminster", { limit: 5 });

    assert.equal(result.semantic, false);
    assert.equal(result.voyageConfigured, false);
    assert.match(result.message, /not configured/i);
    assert.ok(result.results.some((record) => record.sourceReference.startsWith("memory:")));
  });
});

test("embedding requests are not made when semantic indexing is disabled", async () => {
  await withDatabase(async (db) => {
    let calls = 0;
    setSemanticIndexingEnabled(db, false);
    const client = new VoyageClient({
      apiKey: "test-key",
      model: "voyage-test",
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse({ data: [] });
      },
    });
    const service = createSemanticMemoryService({ db, client });

    const indexed = await service.indexSourceRecords();
    const result = await service.search("Council Assurance Platform", { limit: 5 });

    assert.equal(indexed.indexingEnabled, false);
    assert.equal(result.semantic, false);
    assert.equal(calls, 0);
    assert.ok(result.results.length > 0);
  });
});

test("semantic records link back to source IDs", async () => {
  await withDatabase(async (db) => {
    const requests = [];
    const client = new VoyageClient({
      apiKey: "test-key",
      model: "voyage-test",
      fetchImpl: async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body), headers: options.headers });
        const input = JSON.parse(options.body).input;
        const texts = Array.isArray(input) ? input : [input];
        return jsonResponse({
          model: "voyage-test",
          data: texts.map((text, index) => ({ index, embedding: embeddingFor(text) })),
        });
      },
    });
    const service = createSemanticMemoryService({ db, client });

    const indexed = await service.indexSourceRecords();
    const records = listSemanticMemoryRecords(db);

    assert.ok(indexed.indexed > 0);
    assert.equal(requests[0].url, VOYAGE_EMBEDDINGS_URL);
    assert.equal(requests[0].headers.Authorization, "Bearer test-key");
    assert.ok(records.some((record) => record.sourceType === "memory" && record.sourceId === "2"));
    assert.ok(records.every((record) => record.sensitivityCategory === "local_sensitive_business_data"));
  });
});

test("semantic search returns relevant source references", async () => {
  await withDatabase(async (db) => {
    const client = new VoyageClient({
      apiKey: "test-key",
      model: "voyage-test",
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body);
        const texts = Array.isArray(body.input) ? body.input : [body.input];
        return jsonResponse({
          model: "voyage-test",
          data: texts.map((text, index) => ({ index, embedding: embeddingFor(text) })),
        });
      },
    });
    const service = createSemanticMemoryService({ db, client });

    const result = await service.search("Westminster council risk", { limit: 3 });

    assert.equal(result.semantic, true);
    assert.ok(result.results.length > 0);
    assert.ok(result.results[0].sourceReference.includes(":"));
    assert.ok(result.results[0].relevanceScore > 0);
  });
});

test("Claude analysis can receive retrieved memory context", async () => {
  await withDatabase(async (db) => {
    const voyage = new VoyageClient({
      apiKey: "test-key",
      model: "voyage-test",
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body);
        const texts = Array.isArray(body.input) ? body.input : [body.input];
        return jsonResponse({
          model: "voyage-test",
          data: texts.map((text, index) => ({ index, embedding: embeddingFor(text) })),
        });
      },
    });
    const memory = createSemanticMemoryService({ db, client: voyage });
    const retrieved = await memory.retrieveContext("Westminster council risk", { maxRecords: 2, maxTokens: 500 });
    const anthropicCalls = [];
    const anthropic = new AnthropicClient({
      apiKey: "test-key",
      model: "claude-test",
      fetchImpl: async (url, options) => {
        anthropicCalls.push(JSON.parse(options.body));
        return jsonResponse({
          model: "claude-test",
          content: [{
            type: "text",
            text: JSON.stringify({
              executiveSummary: "Memory context included.",
              topPriorities: [],
              risks: [],
              decisionsRequired: [],
              recommendedNextActions: [],
              confidenceLevel: "medium",
              assumptions: [],
              sourceRecordReferences: retrieved.sourceRecordReferences,
            }),
          }],
        });
      },
    });
    const ai = createAiReasoningService({ db, client: anthropic });

    const result = await ai.analyzeBriefing({
      currentExecutiveBriefing: { summary: { totalOpen: 1 } },
      retrievedMemoryContext: retrieved,
    }, {
      userAction: "test:memory-context",
      dataCategories: ["executive_briefing", "semantic_memory"],
    });

    assert.ok(retrieved.records.length > 0);
    assert.match(anthropicCalls[0].messages[0].content, /retrievedMemoryContext/);
    assert.equal(result.executionAttempted, false);
    assert.deepEqual(listAiAnalysisAudit(db)[0].dataCategories, ["executive_briefing", "semantic_memory"]);
  });
});

test("cosine similarity handles simple vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});
