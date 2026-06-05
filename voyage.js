export const VOYAGE_DEFAULT_MODEL = "voyage-4-lite";
export const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

function createConfigurationError() {
  const error = new Error("Voyage AI is not configured. Set VOYAGE_API_KEY and restart Alfred.");
  error.statusCode = 503;
  error.code = "VOYAGE_NOT_CONFIGURED";
  return error;
}

function normalizeTexts(input) {
  return (Array.isArray(input) ? input : [input])
    .map((text) => String(text || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export class VoyageClient {
  constructor({
    apiKey = process.env.VOYAGE_API_KEY || "",
    model = process.env.VOYAGE_MODEL || VOYAGE_DEFAULT_MODEL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000,
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  status() {
    return {
      configured: Boolean(this.apiKey),
      model: this.model,
      readOnly: true,
      embeddingsOnly: true,
    };
  }

  async embedDocuments(texts) {
    return this.requestEmbeddings(texts, "document");
  }

  async embedQuery(text) {
    const result = await this.requestEmbeddings([text], "query");
    return {
      embedding: result.embeddings[0] || [],
      model: result.model,
      usage: result.usage,
    };
  }

  async requestEmbeddings(input, inputType) {
    if (!this.apiKey) throw createConfigurationError();
    const texts = normalizeTexts(input);
    if (!texts.length) return { embeddings: [], model: this.model, usage: {} };

    const response = await this.fetch(VOYAGE_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        input: texts.length === 1 ? texts[0] : texts,
        model: this.model,
        input_type: inputType,
        truncation: true,
      }),
    }).catch((error) => {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        const timeout = new Error("Voyage embedding request timed out");
        timeout.statusCode = 504;
        timeout.code = "VOYAGE_TIMEOUT";
        throw timeout;
      }
      throw error;
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error?.message || `Voyage request failed with status ${response.status}`);
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      error.code = body.error?.type || "VOYAGE_REQUEST_FAILED";
      throw error;
    }

    const embeddings = (body.data || [])
      .slice()
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((item) => (item.embedding || []).map(Number));
    if (embeddings.length !== texts.length) {
      const error = new Error("Voyage returned an unexpected embedding count");
      error.statusCode = 502;
      error.code = "VOYAGE_INVALID_RESPONSE";
      throw error;
    }

    return {
      embeddings,
      model: body.model || this.model,
      usage: body.usage || {},
    };
  }
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] * a[index];
    bMagnitude += b[index] * b[index];
  }
  if (!aMagnitude || !bMagnitude) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}
