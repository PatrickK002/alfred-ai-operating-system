import { createHash } from "node:crypto";
import {
  getSemanticIndexingEnabled,
  getSemanticMemoryStats,
  listSemanticMemoryRecords,
  listSemanticSourceRecords,
  shouldIndexSemanticRecord,
  upsertSemanticMemoryRecord,
} from "./db.js";
import { cosineSimilarity, estimateTokens } from "./voyage.js";

const DEFAULT_CONTEXT_RECORDS = 6;
const DEFAULT_CONTEXT_TOKENS = 1200;

function contentHash(record) {
  return createHash("sha256")
    .update(`${record.sourceType}:${record.sourceId}:${record.summary}`)
    .digest("hex");
}

function scoreLexical(record, query) {
  const terms = String(query || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  if (!terms.length) return 0;
  const haystack = `${record.sourceType} ${record.sourceId} ${record.title || ""} ${record.summary}`.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  const sourceBoost = record.sourceType === "memory" && matches ? 0.1 : 0;
  return matches / terms.length + sourceBoost;
}

function searchLexically(records, query, limit) {
  return records
    .map((record) => ({ ...record, relevanceScore: scoreLexical(record, query) }))
    .filter((record) => record.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || b.sourceCreatedAt.localeCompare(a.sourceCreatedAt))
    .slice(0, limit)
    .map(formatSearchResult);
}

function formatSearchResult(record) {
  return {
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceReference: `${record.sourceType}:${record.sourceId}`,
    relevanceScore: Number(record.relevanceScore.toFixed(4)),
    timestamp: record.sourceCreatedAt,
    sensitivityLabel: record.sensitivityCategory,
    shortSummary: record.summary,
  };
}

function buildBoundedContext(searchResult, { maxRecords, maxTokens }) {
  const records = [];
  let tokenCount = 0;
  for (const record of searchResult.results.slice(0, maxRecords)) {
    const tokens = estimateTokens(record.shortSummary);
    if (records.length && tokenCount + tokens > maxTokens) break;
    records.push(record);
    tokenCount += tokens;
  }
  return {
    query: searchResult.query,
    semantic: searchResult.semantic,
    indexingEnabled: searchResult.indexingEnabled,
    voyageConfigured: searchResult.voyageConfigured,
    model: searchResult.model,
    maxRecords,
    maxTokens,
    tokenEstimate: tokenCount,
    records,
    sourceRecordReferences: records.map((record) => ({
      reference: record.sourceReference,
      label: record.shortSummary.slice(0, 120),
      category: record.sourceType,
    })),
  };
}

export function createSemanticMemoryService({ db, client, onConnected = () => {} }) {
  async function indexSourceRecords({ records = listSemanticSourceRecords(db), force = false } = {}) {
    const indexingEnabled = getSemanticIndexingEnabled(db);
    const status = client.status();
    if (!indexingEnabled) {
      return {
        indexed: 0,
        skipped: records.length,
        indexingEnabled: false,
        voyageConfigured: status.configured,
        model: status.model,
      };
    }
    if (!status.configured) {
      return {
        indexed: 0,
        skipped: records.length,
        indexingEnabled: true,
        voyageConfigured: false,
        model: status.model,
        errorCode: "VOYAGE_NOT_CONFIGURED",
      };
    }

    const candidates = records
      .map((record) => ({ ...record, contentHash: contentHash(record) }))
      .filter((record) => force || shouldIndexSemanticRecord(db, {
        sourceType: record.sourceType,
        sourceId: record.sourceId,
        contentHash: record.contentHash,
        embeddingModel: status.model,
      }));
    if (!candidates.length) {
      return {
        indexed: 0,
        skipped: records.length,
        indexingEnabled: true,
        voyageConfigured: true,
        model: status.model,
      };
    }

    let indexed = 0;
    const batchSize = 32;
    for (let offset = 0; offset < candidates.length; offset += batchSize) {
      const batch = candidates.slice(offset, offset + batchSize);
      const result = await client.embedDocuments(batch.map((record) => record.summary));
      result.embeddings.forEach((embedding, index) => {
        const record = batch[index];
        upsertSemanticMemoryRecord(db, {
          ...record,
          embedding,
          embeddingModel: result.model,
        });
        indexed += 1;
      });
    }
    onConnected();
    return {
      indexed,
      skipped: records.length - indexed,
      indexingEnabled: true,
      voyageConfigured: true,
      model: status.model,
    };
  }

  async function search(query, { limit = 8, indexBeforeSearch = true } = {}) {
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
      const error = new Error("q is required");
      error.statusCode = 400;
      throw error;
    }

    const indexingEnabled = getSemanticIndexingEnabled(db);
    const status = client.status();
    if (indexingEnabled && status.configured && indexBeforeSearch) {
      await indexSourceRecords();
    }

    const vectorRecords = listSemanticMemoryRecords(db);
    const boundedLimit = Math.min(Math.max(Number(limit) || 8, 1), 25);
    if (!indexingEnabled) {
      return {
        query: cleanQuery,
        semantic: false,
        indexingEnabled: false,
        voyageConfigured: status.configured,
        model: status.model,
        message: "Semantic indexing is disabled. Returning local keyword matches only.",
        results: searchLexically(vectorRecords.length ? vectorRecords : listSemanticSourceRecords(db), cleanQuery, boundedLimit),
      };
    }
    if (!status.configured) {
      return {
        query: cleanQuery,
        semantic: false,
        indexingEnabled: true,
        voyageConfigured: false,
        model: status.model,
        message: "Voyage AI is not configured. Returning local keyword matches only.",
        results: searchLexically(vectorRecords.length ? vectorRecords : listSemanticSourceRecords(db), cleanQuery, boundedLimit),
      };
    }

    const queryEmbedding = await client.embedQuery(cleanQuery);
    onConnected();
    const results = vectorRecords
      .map((record) => ({
        ...record,
        relevanceScore: cosineSimilarity(queryEmbedding.embedding, record.embedding),
      }))
      .filter((record) => record.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.sourceCreatedAt.localeCompare(a.sourceCreatedAt))
      .slice(0, boundedLimit)
      .map(formatSearchResult);
    return {
      query: cleanQuery,
      semantic: true,
      indexingEnabled: true,
      voyageConfigured: true,
      model: queryEmbedding.model,
      results,
    };
  }

  async function retrieveContext(query, {
    maxRecords = DEFAULT_CONTEXT_RECORDS,
    maxTokens = DEFAULT_CONTEXT_TOKENS,
  } = {}) {
    try {
      const result = await search(query, { limit: maxRecords });
      return buildBoundedContext(result, { maxRecords, maxTokens });
    } catch (error) {
      return {
        query: String(query || ""),
        semantic: false,
        indexingEnabled: getSemanticIndexingEnabled(db),
        voyageConfigured: client.status().configured,
        model: client.model,
        maxRecords,
        maxTokens,
        tokenEstimate: 0,
        records: [],
        sourceRecordReferences: [],
        errorCode: error.code || "SEMANTIC_MEMORY_UNAVAILABLE",
      };
    }
  }

  function status() {
    return {
      ...client.status(),
      indexingEnabled: getSemanticIndexingEnabled(db),
      stats: getSemanticMemoryStats(db),
    };
  }

  return {
    status,
    indexSourceRecords,
    search,
    retrieveContext,
  };
}
