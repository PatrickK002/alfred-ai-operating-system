import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  DOCUMENT_INTELLIGENCE_BOUNDARY,
  buildDocumentQaInput,
  chunkDocumentText,
  createDocumentIntelligenceDocument,
  deterministicDocumentAnswer,
  documentIntelligenceBriefingForDaily,
  extractDocxText,
  extractPdfText,
  listDocumentIntelligenceAudit,
  listDocumentIntelligenceDashboard,
  searchDocumentChunks,
} from "../document-intelligence.js";
import { listProjectProfiles } from "../project-intelligence.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-document-intelligence-"));
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

function firstProject(db) {
  const project = listProjectProfiles(db)[0];
  assert.ok(project, "seed project should exist");
  return project;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

test("PDF extraction reads text objects for document intelligence", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj <<>> stream\nBT /F1 12 Tf 72 720 Td (BIM deliverables include EIR, BEP and COBie.) Tj ET\nendstream\n%%EOF", "latin1");
  const text = extractPdfText(pdf);
  assert.match(text, /BIM deliverables/);
  assert.match(text, /COBie/);
});

test("DOCX extraction reads Word document XML", () => {
  const docx = createStoredZip({
    "[Content_Types].xml": "<Types></Types>",
    "word/document.xml": "<w:document><w:body><w:p><w:r><w:t>Westminster BEP naming convention requires project-originator-zone-level-type-role-number.</w:t></w:r></w:p></w:body></w:document>",
  });
  const text = extractDocxText(docx);
  assert.match(text, /Westminster BEP naming convention/);
  assert.match(text, /originator-zone-level/);
});

test("document upload stores extracted text, chunks, project link and audit event", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    const document = createDocumentIntelligenceDocument(db, {
      projectProfileId: project.id,
      title: "KSPF EIR",
      fileName: "KSPF EIR.txt",
      fileType: "txt",
      textContent: [
        "The BIM deliverables are EIR response, BEP, MIDP, TIDP and COBie validation report.",
        "Naming conventions must follow ISO 19650 project-originator-volume-level-type-role-number.",
        "Project risks include missing AIR confirmation and delayed COBie validation.",
      ].join("\n\n"),
      documentType: "EIR",
      tags: ["BIM", "COBie", "KSPF"],
      userAction: "test:document-intelligence-upload",
    });
    const dashboard = listDocumentIntelligenceDashboard(db);
    const audit = listDocumentIntelligenceAudit(db);

    assert.equal(document.extractionStatus, "extracted");
    assert.equal(document.projectProfileId, project.id);
    assert.ok(document.chunkCount >= 1);
    assert.equal(dashboard.metrics.totalDocuments, 1);
    assert.equal(dashboard.metrics.totalChunks, document.chunkCount);
    assert.equal(audit[0].eventType, "document_ingested");
    assert.equal(audit[0].externalWriteAttempted, false);
  });
});

test("chunk generation and keyword fallback retrieve grounded sections", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    createDocumentIntelligenceDocument(db, {
      projectProfileId: project.id,
      title: "Westminster BEP",
      fileName: "Westminster-BEP.txt",
      fileType: "txt",
      textContent: [
        "Naming convention: project-originator-volume-level-type-role-number must be used for BIM files.",
        "COBie worksheets must be validated before issue.",
      ].join("\n\n"),
      documentType: "BEP",
    });
    const result = searchDocumentChunks(db, "What naming convention is required?", { limit: 5 });
    assert.equal(result.fallback, "keyword");
    assert.ok(result.results.length >= 1);
    assert.match(result.results[0].chunkText, /Naming convention/);
    assert.match(result.results[0].sourceReference, /^document_chunk:/);
  });
});

test("document QA returns citations and refuses to invent missing content", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    const document = createDocumentIntelligenceDocument(db, {
      projectProfileId: project.id,
      title: "KSPF Meeting Minutes",
      fileName: "minutes.md",
      fileType: "md",
      textContent: "Key actions: Patrick to confirm COBie validation close-out. Sarah to review GIS layer assumptions.",
      documentType: "Meeting minutes",
    });
    const search = searchDocumentChunks(db, "What are the key actions?", { documentId: document.id });
    const answer = deterministicDocumentAnswer({ question: "What are the key actions?", chunks: search.results });
    const missing = deterministicDocumentAnswer({ question: "What is the fire strategy?", chunks: [] });

    assert.match(answer.answer, /document_chunk:/);
    assert.ok(answer.evidence[0].sourceReference.startsWith("document_chunk:"));
    assert.equal(missing.confidenceLevel, "low");
    assert.match(missing.notAnsweredReason, /No matching document chunks/);
  });
});

test("document QA input is bounded and carries source references", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    const document = createDocumentIntelligenceDocument(db, {
      projectProfileId: project.id,
      title: "Council Assurance Platform Requirements",
      fileName: "requirements.txt",
      fileType: "txt",
      textContent: "Requirements include audit trail, approval workflow, project risk view and document evidence citations.",
      documentType: "Reports",
    });
    const search = searchDocumentChunks(db, "approval workflow document evidence", { documentId: document.id });
    const input = buildDocumentQaInput(db, {
      question: "What does the document say about approvals?",
      documentId: document.id,
      projectProfileId: project.id,
      retrievedChunks: search.results,
    });

    assert.equal(input.document.id, document.id);
    assert.equal(input.projectProfile.id, project.id);
    assert.ok(input.retrievedChunks.length <= 8);
    assert.ok(input.instructions.some((instruction) => instruction.includes("Answer only")));
  });
});

test("document intelligence participates in memory, briefing and UI without write permissions", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    createDocumentIntelligenceDocument(db, {
      projectProfileId: project.id,
      title: "COBie File Review",
      fileName: "cobie-review.txt",
      fileType: "txt",
      textContent: "COBie risk: asset attributes are inconsistent and require validation before dashboard reporting.",
      documentType: "COBie",
    });
    const semanticRecords = listSemanticSourceRecords(db);
    const brief = documentIntelligenceBriefingForDaily(db);
    const app = readFileSync(join(process.cwd(), "app.js"), "utf8");
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const server = readFileSync(join(process.cwd(), "server.js"), "utf8");

    assert.ok(semanticRecords.some((record) => record.sourceType === "document"));
    assert.ok(semanticRecords.some((record) => record.sourceType === "document_chunk"));
    assert.match(brief.summary, /documents have extracted content/);
    assert.equal(DOCUMENT_INTELLIGENCE_BOUNDARY.fileEditingEnabled, false);
    assert.equal(DOCUMENT_INTELLIGENCE_BOUNDARY.microsoftWritePermissions, false);
    assert.match(html, /documents-view/);
    assert.match(app, /submitDocumentIntelligenceUpload/);
    assert.match(server, /\/api\/ai\/document-question/);
  });
});

test("chunking creates bounded chunks for long document content", () => {
  const text = Array.from({ length: 40 }, (_, index) => `Section ${index + 1}. BIM deliverable ${index + 1} requires evidence and source citation.`).join("\n\n");
  const chunks = chunkDocumentText(text, { chunkSize: 500, overlap: 80 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.chunkText.length <= 620));
  assert.ok(chunks.every((chunk) => chunk.contentHash));
});
