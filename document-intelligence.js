import { createHash } from "node:crypto";
import { inflateRawSync, inflateSync } from "node:zlib";
import { getProjectDetail } from "./project-intelligence.js";
import { estimateTokens } from "./voyage.js";

export const DOCUMENT_INTELLIGENCE_BOUNDARY = {
  advisoryOnly: true,
  readOnly: true,
  documentUploadEnabled: true,
  documentContentStoredLocally: true,
  embeddingsStoredServerSideOnly: true,
  supportedPhaseOneTypes: ["pdf", "docx", "txt", "md"],
  phaseTwoPlaceholders: ["pptx", "xlsx", "images", "ocr"],
  fileEditingEnabled: false,
  fileDeletionEnabled: false,
  sharePointWriteEnabled: false,
  oneDriveWriteEnabled: false,
  microsoftWritePermissions: false,
  emailSendEnabled: false,
  autonomousExecutionEnabled: false,
};

const MAX_TEXT_LENGTH = 500_000;
const CHUNK_SIZE = 1_800;
const CHUNK_OVERLAP = 240;
const SEARCH_LIMIT = 12;
const DOCUMENT_TYPES = new Set([
  "EIR",
  "AIR",
  "BEP",
  "MIDP",
  "TIDP",
  "COBie",
  "IFC",
  "Drawings",
  "Meeting minutes",
  "Reports",
  "Proposals",
  "Contracts",
  "Commercial",
  "Unknown",
]);

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "alfred",
  "also",
  "and",
  "are",
  "ask",
  "based",
  "between",
  "client",
  "could",
  "does",
  "document",
  "from",
  "have",
  "how",
  "into",
  "need",
  "patrick",
  "project",
  "required",
  "requirements",
  "review",
  "say",
  "says",
  "show",
  "that",
  "the",
  "their",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

function normalizeText(value = "") {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function compactText(value = "", limit = 900) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}...` : text;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row, jsonFields = []) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    toCamelCase(key),
    jsonFields.includes(key) ? safeJsonParse(value, key.endsWith("tags") ? [] : {}) : value,
  ]));
}

function sha256(value = "") {
  return value ? createHash("sha256").update(value).digest("hex") : "";
}

function sourceReference(reference, label, category) {
  return { reference: String(reference), label: normalizeText(label), category: String(category) };
}

function normalizeTags(value = []) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 24);
  }
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 24);
}

function normalizeDocumentType(value = "") {
  const clean = String(value || "").trim();
  return DOCUMENT_TYPES.has(clean) ? clean : "Unknown";
}

function inferFileType({ fileName = "", fileType = "", mimeType = "" } = {}) {
  const direct = String(fileType || "").toLowerCase().replace(/^\./, "").trim();
  if (direct) return direct;
  const nameMatch = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (nameMatch) return nameMatch[1];
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (mime.includes("markdown")) return "md";
  if (mime.includes("text")) return "txt";
  return "";
}

function ensureProject(db, projectProfileId) {
  if (!projectProfileId) return null;
  const detail = getProjectDetail(db, Number(projectProfileId), { calculateHealth: false });
  if (!detail) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  return detail;
}

function decodeXmlEntities(value = "") {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function readZipEntries(buffer) {
  const entries = new Map();
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset >= 0) {
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let offset = buffer.readUInt32LE(eocdOffset + 16);
    for (let index = 0; index < entryCount && offset + 46 <= buffer.length; index += 1) {
      if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
      const method = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const nameLength = buffer.readUInt16LE(offset + 28);
      const extraLength = buffer.readUInt16LE(offset + 30);
      const commentLength = buffer.readUInt16LE(offset + 32);
      const localOffset = buffer.readUInt32LE(offset + 42);
      const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      entries.set(name, method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0));
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const dataStart = offset + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : Buffer.alloc(0));
    offset = dataStart + compressedSize;
  }
  return entries;
}

export function extractDocxText(buffer) {
  const entries = readZipEntries(buffer);
  const xmlParts = ["word/document.xml"];
  for (const name of entries.keys()) {
    if (/^word\/(header|footer)\d+\.xml$/i.test(name)) xmlParts.push(name);
  }
  const text = xmlParts
    .map((name) => entries.get(name)?.toString("utf8") || "")
    .filter(Boolean)
    .map((xml) => decodeXmlEntities(xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, "")))
    .join("\n");
  return normalizeText(text);
}

function decodePdfLiteral(raw = "") {
  let output = "";
  for (let index = 1; index < raw.length - 1; index += 1) {
    const char = raw[index];
    if (char !== "\\") {
      output += char;
      continue;
    }
    const next = raw[index + 1];
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/[0-7]/.test(next || "")) {
      const octal = raw.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] || "";
      output += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length - 1;
    } else if (next === "\r" && raw[index + 2] === "\n") {
      index += 2;
      continue;
    } else if (next === "\n" || next === "\r") {
      index += 1;
      continue;
    } else {
      output += next || "";
    }
    index += 1;
  }
  return output;
}

function decodePdfHex(raw = "") {
  const hex = raw.slice(1, -1).replace(/\s+/g, "");
  const padded = hex.length % 2 ? `${hex}0` : hex;
  return Buffer.from(padded, "hex").toString("utf8").replace(/\u0000/g, "");
}

function parsePdfTextOperators(text = "") {
  const sections = text.match(/BT[\s\S]*?ET/g) || [text];
  const extracted = [];
  for (const section of sections) {
    const operatorMatches = section.matchAll(/(\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>)\s*Tj|\[((?:\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>|[-\d.\s])*)\]\s*TJ/g);
    for (const match of operatorMatches) {
      const direct = match[1];
      const arrayContent = match[2];
      if (direct) {
        extracted.push(direct.startsWith("(") ? decodePdfLiteral(direct) : decodePdfHex(direct));
        continue;
      }
      const pieces = [...String(arrayContent || "").matchAll(/\((?:\\.|[^\\()])*\)|<[\da-fA-F\s]+>/g)]
        .map(([piece]) => piece.startsWith("(") ? decodePdfLiteral(piece) : decodePdfHex(piece));
      if (pieces.length) extracted.push(pieces.join(""));
    }
  }
  return normalizeText(extracted.join("\n"));
}

export function extractPdfText(buffer) {
  const source = buffer.toString("latin1");
  const candidates = [parsePdfTextOperators(source)];
  const streamMatches = source.matchAll(/stream\r?\n?([\s\S]*?)\r?\n?endstream/g);
  for (const match of streamMatches) {
    const before = source.slice(Math.max(0, match.index - 250), match.index);
    if (!/FlateDecode/i.test(before)) continue;
    const streamBuffer = Buffer.from(match[1], "latin1");
    for (const inflate of [inflateSync, inflateRawSync]) {
      try {
        candidates.push(parsePdfTextOperators(inflate(streamBuffer).toString("latin1")));
        break;
      } catch {
        // Try the other inflation strategy.
      }
    }
  }
  return normalizeText(candidates.filter(Boolean).join("\n\n"));
}

export function extractDocumentText(input = {}) {
  const providedText = normalizeText(input.textContent || input.extractedText || "").slice(0, MAX_TEXT_LENGTH);
  const fileType = inferFileType(input);
  if (providedText) {
    return {
      textContent: providedText,
      extractionStatus: "extracted",
      extractionMessage: "Text supplied directly and stored in SQLite.",
      fileType,
      extractionMetadata: { suppliedText: true, truncated: providedText.length >= MAX_TEXT_LENGTH },
    };
  }

  const contentBase64 = String(input.contentBase64 || "").replace(/^data:[^,]+,/, "");
  if (!contentBase64) {
    return {
      textContent: "",
      extractionStatus: input.sourceUrl ? "metadata_only" : "failed",
      extractionMessage: input.sourceUrl
        ? "Exact file link captured. Full content was not supplied for extraction."
        : "No file content or text was supplied.",
      fileType,
      extractionMetadata: { suppliedText: false, contentBase64: false },
    };
  }

  const buffer = Buffer.from(contentBase64, "base64");
  let text = "";
  if (["txt", "text", "csv", "json"].includes(fileType) || String(input.mimeType || "").startsWith("text/")) {
    text = buffer.toString("utf8");
  } else if (fileType === "md" || fileType === "markdown") {
    text = buffer.toString("utf8");
  } else if (fileType === "docx") {
    text = extractDocxText(buffer);
  } else if (fileType === "pdf") {
    text = extractPdfText(buffer);
  } else {
    return {
      textContent: "",
      extractionStatus: "metadata_only",
      extractionMessage: `File type '${fileType || "unknown"}' is not supported for content extraction in phase 1.`,
      fileType,
      extractionMetadata: { fileSize: buffer.length, unsupportedFileType: fileType || "unknown" },
    };
  }

  const normalized = normalizeText(text).slice(0, MAX_TEXT_LENGTH);
  const status = normalized ? "extracted" : "failed";
  return {
    textContent: normalized,
    extractionStatus: status,
    extractionMessage: normalized
      ? `Extracted ${normalized.length} characters from ${fileType.toUpperCase()} content.`
      : "No readable text was found. Scanned PDFs/images need a future OCR phase.",
    fileType,
    extractionMetadata: {
      fileSize: buffer.length,
      truncated: normalizeText(text).length > MAX_TEXT_LENGTH,
      phaseOneExtractor: true,
      scannedPdfOcrSupported: false,
    },
  };
}

function splitLongSegment(segment, maxLength) {
  if (segment.length <= maxLength) return [segment];
  const sentences = segment.match(/[^.!?\n]+[.!?]?/g) || [segment];
  const parts = [];
  let current = "";
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (current && `${current} ${clean}`.length > maxLength) {
      parts.push(current);
      current = "";
    }
    if (clean.length > maxLength) {
      for (let offset = 0; offset < clean.length; offset += maxLength) {
        parts.push(clean.slice(offset, offset + maxLength));
      }
    } else {
      current = current ? `${current} ${clean}` : clean;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function chunkDocumentText(text = "", { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const rawSegments = clean.split(/\n{2,}/).flatMap((segment) => splitLongSegment(segment.trim(), chunkSize));
  const chunks = [];
  let current = "";
  for (const segment of rawSegments) {
    if (!segment) continue;
    if (current && `${current}\n\n${segment}`.length > chunkSize) {
      chunks.push(current);
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = tail ? `${tail}\n\n${segment}` : segment;
    } else {
      current = current ? `${current}\n\n${segment}` : segment;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunkText, index) => ({
    chunkIndex: index,
    chunkText: normalizeText(chunkText),
    heading: normalizeText(chunkText).split("\n").find((line) => line.length > 3 && line.length < 120) || "",
    tokenEstimate: estimateTokens(chunkText),
    contentHash: sha256(chunkText),
  }));
}

export function createDocumentIntelligenceDocument(db, input = {}) {
  const project = input.projectProfileId ? ensureProject(db, input.projectProfileId) : null;
  const extracted = extractDocumentText(input);
  const textHash = sha256(extracted.textContent);
  const tags = normalizeTags(input.tags);
  const metadata = {
    ...(typeof input.metadata === "object" && input.metadata ? input.metadata : {}),
    extractionMetadata: extracted.extractionMetadata,
    phaseTwoPlaceholders: DOCUMENT_INTELLIGENCE_BOUNDARY.phaseTwoPlaceholders,
  };
  const duplicate = textHash
    ? db.prepare(`
        SELECT id, title, file_name
        FROM document_intelligence_documents
        WHERE text_sha256 = ? AND text_sha256 != ''
        ORDER BY created_at DESC
        LIMIT 1
      `).get(textHash)
    : null;
  if (duplicate) metadata.duplicateOf = duplicate.id;

  const result = db.prepare(`
    INSERT INTO document_intelligence_documents (
      project_profile_id, company_id, business_entity_id, client_name, title, file_name,
      file_type, mime_type, source_type, source_url, source_system, author, tags,
      document_type, text_content, text_sha256, extraction_status, extraction_message,
      chunk_count, sensitivity_label, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    input.projectProfileId ? Number(input.projectProfileId) : null,
    input.companyId || project?.profile?.companyId || "digitize",
    input.businessEntityId || project?.profile?.financialBusinessEntityId || "",
    normalizeText(input.clientName || project?.profile?.clientName || "").slice(0, 240),
    normalizeText(input.title || input.fileName || input.sourceUrl || "Document").slice(0, 300),
    normalizeText(input.fileName || "").slice(0, 300),
    extracted.fileType,
    normalizeText(input.mimeType || "").slice(0, 160),
    ["upload", "link", "microsoft", "pasted_text"].includes(input.sourceType) ? input.sourceType : (input.contentBase64 ? "upload" : "pasted_text"),
    normalizeText(input.sourceUrl || input.url || input.webUrl || "").slice(0, 2000),
    normalizeText(input.sourceSystem || "alfred").slice(0, 120),
    normalizeText(input.author || "").slice(0, 240),
    JSON.stringify(tags),
    normalizeDocumentType(input.documentType),
    extracted.textContent,
    textHash,
    extracted.extractionStatus,
    extracted.extractionMessage,
    normalizeText(input.sensitivityLabel || "local_sensitive_business_data").slice(0, 160),
    JSON.stringify(metadata),
  );

  const documentId = Number(result.lastInsertRowid);
  const chunks = chunkDocumentText(extracted.textContent);
  const insertChunk = db.prepare(`
    INSERT INTO document_intelligence_chunks (
      document_id, chunk_index, chunk_text, heading, token_estimate,
      content_hash, embedding_status, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const chunk of chunks) {
    insertChunk.run(
      documentId,
      chunk.chunkIndex,
      chunk.chunkText,
      chunk.heading,
      chunk.tokenEstimate,
      chunk.contentHash,
      extracted.extractionStatus === "extracted" ? "pending" : "unavailable",
      JSON.stringify({ source: "local_extraction" }),
    );
  }
  db.prepare("UPDATE document_intelligence_documents SET chunk_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(chunks.length, documentId);

  recordDocumentIntelligenceAudit(db, {
    eventType: "document_ingested",
    userAction: input.userAction || "document-intelligence:document-ingested",
    documentId,
    projectProfileId: input.projectProfileId ? Number(input.projectProfileId) : null,
    dataCategories: ["document_metadata", extracted.textContent ? "document_text" : "document_metadata_only"],
    model: "local-document-extraction",
    metadata: {
      fileType: extracted.fileType,
      extractionStatus: extracted.extractionStatus,
      chunkCount: chunks.length,
      duplicateOf: duplicate?.id || null,
      externalWriteAttempted: false,
    },
  });
  return getDocumentIntelligenceDocument(db, documentId);
}

export function getDocumentIntelligenceDocument(db, id, { includeChunks = true, includeText = false } = {}) {
  const row = db.prepare(`
    SELECT d.*, p.project_name, p.client_name AS project_client_name
    FROM document_intelligence_documents d
    LEFT JOIN project_profiles p ON p.id = d.project_profile_id
    WHERE d.id = ?
  `).get(Number(id));
  const document = mapDocumentRow(row, { includeText });
  if (!document) return null;
  const chunks = includeChunks
    ? db.prepare(`
        SELECT *
        FROM document_intelligence_chunks
        WHERE document_id = ?
        ORDER BY chunk_index ASC
      `).all(Number(id)).map(mapChunkRow)
    : [];
  return { ...document, chunks };
}

export function listDocumentIntelligenceDocuments(db, { projectProfileId = null, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = projectProfileId
    ? db.prepare(`
        SELECT d.*, p.project_name, p.client_name AS project_client_name
        FROM document_intelligence_documents d
        LEFT JOIN project_profiles p ON p.id = d.project_profile_id
        WHERE d.project_profile_id = ?
        ORDER BY d.updated_at DESC, d.id DESC
        LIMIT ?
      `).all(Number(projectProfileId), safeLimit)
    : db.prepare(`
        SELECT d.*, p.project_name, p.client_name AS project_client_name
        FROM document_intelligence_documents d
        LEFT JOIN project_profiles p ON p.id = d.project_profile_id
        ORDER BY d.updated_at DESC, d.id DESC
        LIMIT ?
      `).all(safeLimit);
  return rows.map((row) => mapDocumentRow(row));
}

function mapDocumentRow(row, { includeText = false } = {}) {
  const mapped = mapRow(row, ["tags", "metadata"]);
  if (!mapped) return null;
  return {
    ...mapped,
    textContent: includeText ? mapped.textContent : "",
    textPreview: compactText(row.text_content || "", 700),
    tags: safeJsonParse(row.tags, []),
    metadata: safeJsonParse(row.metadata, {}),
    sourceReference: `document:${row.id}`,
    projectName: row.project_name || "",
    clientName: row.client_name || row.project_client_name || "",
    contentExtracted: row.extraction_status === "extracted",
    readOnly: true,
  };
}

function mapChunkRow(row, document = {}) {
  const mapped = mapRow(row, ["metadata"]);
  return {
    ...mapped,
    metadata: safeJsonParse(row.metadata, {}),
    documentTitle: document.title || row.document_title || "",
    fileName: document.fileName || row.file_name || "",
    projectName: document.projectName || row.project_name || "",
    clientName: document.clientName || row.client_name || "",
    documentType: document.documentType || row.document_type || "",
    sourceReference: `document_chunk:${row.id}`,
    documentSourceReference: `document:${row.document_id}`,
    shortSummary: compactText(row.chunk_text || "", 450),
  };
}

function termsForSearch(query = "") {
  return [...new Set(String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term)))]
    .slice(0, 18);
}

function scoreChunk(chunk, query) {
  const terms = termsForSearch(query);
  if (!terms.length) return 0;
  const phrase = String(query || "").toLowerCase().trim();
  const haystack = [
    chunk.chunkText,
    chunk.heading,
    chunk.documentTitle,
    chunk.fileName,
    chunk.projectName,
    chunk.clientName,
    chunk.documentType,
  ].join(" ").toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  const phraseBoost = phrase.length > 8 && haystack.includes(phrase) ? 0.35 : 0;
  const titleBoost = terms.some((term) => String(chunk.documentTitle || "").toLowerCase().includes(term)) ? 0.12 : 0;
  return hits / terms.length + phraseBoost + titleBoost;
}

function buildChunkWhere({ documentId = null, projectProfileId = null } = {}) {
  const clauses = [];
  const params = [];
  if (documentId) {
    clauses.push("d.id = ?");
    params.push(Number(documentId));
  }
  if (projectProfileId) {
    clauses.push("d.project_profile_id = ?");
    params.push(Number(projectProfileId));
  }
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function searchDocumentChunks(db, query, { documentId = null, projectProfileId = null, limit = SEARCH_LIMIT } = {}) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) {
    const error = new Error("q is required");
    error.statusCode = 400;
    throw error;
  }
  const safeLimit = Math.min(Math.max(Number(limit) || SEARCH_LIMIT, 1), 30);
  const { where, params } = buildChunkWhere({ documentId, projectProfileId });
  const rows = db.prepare(`
    SELECT
      c.*,
      d.title AS document_title,
      d.file_name,
      d.document_type,
      d.project_profile_id,
      d.sensitivity_label,
      p.project_name,
      p.client_name
    FROM document_intelligence_chunks c
    JOIN document_intelligence_documents d ON d.id = c.document_id
    LEFT JOIN project_profiles p ON p.id = d.project_profile_id
    ${where}
    ORDER BY d.updated_at DESC, c.document_id DESC, c.chunk_index ASC
    LIMIT 800
  `).all(...params);
  const results = rows
    .map((row) => {
      const chunk = mapChunkRow(row, {
        title: row.document_title,
        fileName: row.file_name,
        projectName: row.project_name,
        clientName: row.client_name,
        documentType: row.document_type,
      });
      return {
        ...chunk,
        sensitivityLabel: row.sensitivity_label || "local_sensitive_business_data",
        relevanceScore: scoreChunk(chunk, cleanQuery),
      };
    })
    .filter((chunk) => chunk.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.chunkIndex - b.chunkIndex)
    .slice(0, safeLimit)
    .map((chunk) => ({ ...chunk, relevanceScore: Number(chunk.relevanceScore.toFixed(4)) }));
  return {
    query: cleanQuery,
    semantic: false,
    fallback: "keyword",
    results,
  };
}

export function getDocumentChunksByIds(db, ids = [], relevanceById = {}) {
  const cleanIds = [...new Set(ids.map(Number).filter(Boolean))].slice(0, 30);
  if (!cleanIds.length) return [];
  const placeholders = cleanIds.map(() => "?").join(", ");
  const rows = db.prepare(`
    SELECT
      c.*,
      d.title AS document_title,
      d.file_name,
      d.document_type,
      d.project_profile_id,
      d.sensitivity_label,
      p.project_name,
      p.client_name
    FROM document_intelligence_chunks c
    JOIN document_intelligence_documents d ON d.id = c.document_id
    LEFT JOIN project_profiles p ON p.id = d.project_profile_id
    WHERE c.id IN (${placeholders})
  `).all(...cleanIds);
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  return cleanIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((row) => ({
      ...mapChunkRow(row, {
        title: row.document_title,
        fileName: row.file_name,
        projectName: row.project_name,
        clientName: row.client_name,
        documentType: row.document_type,
      }),
      sensitivityLabel: row.sensitivity_label || "local_sensitive_business_data",
      relevanceScore: Number(Number(relevanceById[String(row.id)] || 0).toFixed(4)),
    }));
}

function evidenceSentences(chunk, question) {
  const terms = termsForSearch(question);
  const sentences = String(chunk.chunkText || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const matches = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return terms.some((term) => lower.includes(term));
  });
  return (matches.length ? matches : sentences).slice(0, 3);
}

export function deterministicDocumentAnswer({ question = "", chunks = [], semantic = false } = {}) {
  const sourceRefs = chunks.map((chunk) => sourceReference(
    chunk.sourceReference,
    `${chunk.documentTitle || chunk.fileName || "Document"} chunk ${Number(chunk.chunkIndex || 0) + 1}`,
    "document_chunk",
  ));
  if (!chunks.length) {
    return {
      answer: "I could not find evidence for that question in the indexed document chunks. Upload or index the relevant document content, then ask again.",
      directAnswer: "No grounded answer found in the indexed document content.",
      evidence: [],
      retrievedSections: [],
      confidenceLevel: "low",
      assumptions: ["No relevant extracted document chunk was retrieved."],
      sourceRecordReferences: [],
      notAnsweredReason: "No matching document chunks were found.",
    };
  }
  const evidence = chunks.slice(0, 5).flatMap((chunk) => evidenceSentences(chunk, question).slice(0, 2).map((quote) => ({
    quote: compactText(quote, 450),
    explanation: `Relevant extract from ${chunk.documentTitle || chunk.fileName || "document"} chunk ${Number(chunk.chunkIndex || 0) + 1}.`,
    sourceReference: chunk.sourceReference,
  })));
  const directAnswer = evidence.length
    ? evidence.slice(0, 3).map((item) => item.quote).join(" ")
    : compactText(chunks[0].chunkText, 600);
  return {
    answer: [
      directAnswer,
      "",
      "Source basis:",
      ...sourceRefs.slice(0, 5).map((ref) => `- ${ref.label} (${ref.reference})`),
    ].join("\n"),
    directAnswer,
    evidence,
    retrievedSections: chunks.slice(0, 6).map((chunk) => ({
      documentId: chunk.documentId,
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      documentTitle: chunk.documentTitle,
      sourceReference: chunk.sourceReference,
      relevanceScore: chunk.relevanceScore,
      excerpt: compactText(chunk.chunkText, 700),
    })),
    confidenceLevel: chunks[0]?.relevanceScore >= 0.75 ? "high" : chunks[0]?.relevanceScore >= 0.35 ? "medium" : "low",
    assumptions: [
      semantic ? "Voyage semantic retrieval was available for ranking context." : "Keyword fallback retrieval was used.",
      "The answer is limited to extracted document chunks currently stored in SQLite.",
    ],
    sourceRecordReferences: sourceRefs,
    notAnsweredReason: "",
  };
}

export function buildDocumentQaInput(db, {
  question = "",
  documentId = null,
  projectProfileId = null,
  retrievedChunks = [],
  semanticMemory = [],
} = {}) {
  const document = documentId ? getDocumentIntelligenceDocument(db, Number(documentId), { includeChunks: false }) : null;
  const project = projectProfileId ? ensureProject(db, Number(projectProfileId)) : null;
  return {
    question: normalizeText(question).slice(0, 4000),
    document: document ? {
      id: document.id,
      title: document.title,
      fileName: document.fileName,
      documentType: document.documentType,
      extractionStatus: document.extractionStatus,
      sourceReference: document.sourceReference,
    } : null,
    projectProfile: project?.profile || null,
    retrievedChunks: retrievedChunks.slice(0, 8).map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      chunkIndex: chunk.chunkIndex,
      chunkText: chunk.chunkText,
      sourceReference: chunk.sourceReference,
      relevanceScore: chunk.relevanceScore,
    })),
    semanticMemory: semanticMemory.slice(0, 5),
    boundaries: DOCUMENT_INTELLIGENCE_BOUNDARY,
    instructions: [
      "Answer only from retrieved document chunks.",
      "If the retrieved chunks do not answer the question, say what is missing.",
      "Cite document_chunk references and do not invent section numbers.",
      "Do not send, edit, delete, upload, publish, approve or modify any external system.",
    ],
  };
}

export function listDocumentIntelligenceDashboard(db) {
  const documents = listDocumentIntelligenceDocuments(db, { limit: 40 });
  const metrics = db.prepare(`
    SELECT
      COUNT(*) AS total_documents,
      SUM(CASE WHEN extraction_status = 'extracted' THEN 1 ELSE 0 END) AS extracted_documents,
      SUM(chunk_count) AS total_chunks,
      SUM(CASE WHEN extraction_status != 'extracted' THEN 1 ELSE 0 END) AS needs_attention
    FROM document_intelligence_documents
  `).get();
  const recentAudit = listDocumentIntelligenceAudit(db, 10);
  return {
    metrics: {
      totalDocuments: Number(metrics?.total_documents || 0),
      extractedDocuments: Number(metrics?.extracted_documents || 0),
      totalChunks: Number(metrics?.total_chunks || 0),
      needsAttention: Number(metrics?.needs_attention || 0),
    },
    documents,
    recentAudit,
    boundary: DOCUMENT_INTELLIGENCE_BOUNDARY,
  };
}

export function documentIntelligenceBriefingForDaily(db) {
  const dashboard = listDocumentIntelligenceDashboard(db);
  const documents = dashboard.documents || [];
  const needsAttention = documents.filter((document) => document.extractionStatus !== "extracted").slice(0, 5);
  const recentExtracted = documents.filter((document) => document.extractionStatus === "extracted").slice(0, 5);
  return {
    title: "Document Intelligence Brief",
    summary: documents.length
      ? `${dashboard.metrics.extractedDocuments}/${dashboard.metrics.totalDocuments} documents have extracted content across ${dashboard.metrics.totalChunks} chunks.`
      : "No document content has been indexed yet.",
    metrics: dashboard.metrics,
    items: [
      ...needsAttention.map((document) => ({
        title: `${document.title || document.fileName || "Document"} needs extraction attention`,
        detail: document.extractionMessage || "Document content is not yet available for grounded answers.",
        priority: "High",
        sourceReference: document.sourceReference,
      })),
      ...recentExtracted.map((document) => ({
        title: `${document.title || document.fileName || "Document"} indexed`,
        detail: `${document.chunkCount || 0} chunk(s) available for document QA${document.projectName ? ` on ${document.projectName}` : ""}.`,
        priority: "Medium",
        sourceReference: document.sourceReference,
      })),
    ].slice(0, 8),
    boundary: DOCUMENT_INTELLIGENCE_BOUNDARY,
  };
}

export function recordDocumentIntelligenceAudit(db, {
  eventType,
  userAction = "",
  documentId = null,
  projectProfileId = null,
  dataCategories = [],
  outputSaved = true,
  model = "",
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO document_intelligence_audit_events (
      event_type, user_action, document_id, project_profile_id, data_categories,
      output_saved, model, status, error_code, execution_attempted,
      external_write_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    normalizeText(eventType || "document_intelligence_event"),
    normalizeText(userAction),
    documentId ? Number(documentId) : null,
    projectProfileId ? Number(projectProfileId) : null,
    JSON.stringify([...new Set(dataCategories.map(String).filter(Boolean))]),
    outputSaved ? 1 : 0,
    normalizeText(model),
    status === "error" ? "error" : "success",
    normalizeText(errorCode),
    JSON.stringify(metadata || {}),
  );
  return getDocumentIntelligenceAuditEvent(db, Number(result.lastInsertRowid));
}

export function getDocumentIntelligenceAuditEvent(db, id) {
  const row = db.prepare("SELECT * FROM document_intelligence_audit_events WHERE id = ?").get(Number(id));
  const event = mapRow(row, ["data_categories", "metadata"]);
  if (!event) return null;
  return {
    ...event,
    dataCategories: safeJsonParse(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    externalWriteAttempted: Boolean(row.external_write_attempted),
    metadata: safeJsonParse(row.metadata, {}),
  };
}

export function listDocumentIntelligenceAudit(db, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return db.prepare(`
    SELECT *
    FROM document_intelligence_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(safeLimit).map((row) => getDocumentIntelligenceAuditEvent(db, row.id));
}
