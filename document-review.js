import { createHash } from "node:crypto";
import { getProjectDetail } from "./project-intelligence.js";
import { SARAH_DOMAINS, SARAH_READ_ONLY_BOUNDARY } from "./sarah.js";

export const DOCUMENT_REVIEW_BOUNDARY = {
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  ownerAgent: "sarah",
  consultants: ["BIM Consultant", "GIS Consultant", "Digital Twin Consultant", "COBie / Asset Information Consultant"],
  documentReadEnabled: true,
  documentContentStoredLocally: true,
  exactFileLinksSupported: true,
  binaryExtractionSupported: false,
  emailDraftingEnabled: true,
  emailSendEnabled: false,
  fileEditingEnabled: false,
  sharePointWriteEnabled: false,
  oneDriveWriteEnabled: false,
  microsoftWritePermissions: false,
  autonomousExecutionEnabled: false,
  approvalRequiredBeforeExternalUse: true,
};

export const DOCUMENT_REVIEW_DISCIPLINES = [
  "BIM",
  "GIS",
  "Digital Twin",
  "COBie",
  "Asset Information",
  "ISO 19650",
  "Information Management",
];

const TEXT_LIMIT = 60_000;
const MODEL_DETERMINISTIC_REVIEW = "deterministic-document-review-v1";
const MODEL_DETERMINISTIC_DRAFT = "deterministic-client-response-v1";

function normalizeText(value = "") {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function compactText(value = "", limit = 900) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
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
    jsonFields.includes(key) ? safeJsonParse(value, key.endsWith("ids") ? [] : {}) : value,
  ]));
}

function jsonArray(value) {
  return [...new Set((value || []).map(String).map((item) => item.trim()).filter(Boolean))];
}

function sourceReference(reference, label, category) {
  return { reference: String(reference), label: normalizeText(label), category: String(category) };
}

function sha256(value = "") {
  return value ? createHash("sha256").update(value).digest("hex") : "";
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

function domainContext(disciplines = []) {
  const selected = new Set(disciplines);
  return SARAH_DOMAINS
    .filter((domain) => selected.has(domain.label) || selected.has(domain.id))
    .map((domain) => ({ id: domain.id, label: domain.label, expertise: domain.expertise }));
}

function requirementLines(text = "") {
  return normalizeText(text)
    .split(/\n+|(?:^|\s)(?=\d+[.)]\s)/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 8)
    .slice(0, 18);
}

function significantTerms(text = "") {
  const stop = new Set(["the", "and", "for", "with", "from", "this", "that", "shall", "must", "should", "client", "project", "provide", "confirm", "review", "information"]);
  return compactText(text, 240)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 3 && !stop.has(term))
    .slice(0, 8);
}

function evaluateRequirement(requirement, sourceText) {
  const terms = significantTerms(requirement);
  if (!sourceText) {
    return {
      status: "not_evidenced",
      evidence: "No extracted document text was supplied for this requirement.",
      responsePosition: "Ask the client/team to confirm or provide the relevant document extract before making a compliance claim.",
    };
  }
  const haystack = sourceText.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term));
  const ratio = terms.length ? hits.length / terms.length : 0;
  if (ratio >= 0.65) {
    return {
      status: "partially_met",
      evidence: `The supplied text references ${hits.slice(0, 5).join(", ")}.`,
      responsePosition: "Position as reviewed/partially evidenced, subject to final client acceptance and source confirmation.",
    };
  }
  if (ratio >= 0.35) {
    return {
      status: "partially_met",
      evidence: `Some related language was found: ${hits.slice(0, 5).join(", ")}.`,
      responsePosition: "Confirm the gap and request the missing client requirement detail.",
    };
  }
  return {
    status: "not_evidenced",
    evidence: "The supplied text does not clearly evidence this requirement.",
    responsePosition: "Do not claim compliance yet; log as an information gap.",
  };
}

function extractEmailSubject(email = "") {
  const subjectLine = normalizeText(email).split("\n").find((line) => /^subject:/i.test(line));
  return subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : "Client information review";
}

function firstProjectName(input = {}) {
  return input.projectProfile?.projectName || input.project?.profile?.projectName || "the project";
}

function inputSourceText(input = {}) {
  return (input.sources || [])
    .filter((source) => source.contentExtracted)
    .map((source) => source.textContent || "")
    .join("\n\n")
    .slice(0, TEXT_LIMIT);
}

function allSourceReferences(input = {}) {
  return [
    ...(input.projectProfile?.id ? [sourceReference(`project_profile:${input.projectProfile.id}`, input.projectProfile.projectName, "project_profile")] : []),
    ...(input.sources || []).map((source) => sourceReference(`document_review_source:${source.id}`, source.title || source.fileName || source.sourceUrl || "Review source", "document_review_source")),
  ].slice(0, 20);
}

export function normalizeReviewSource(input = {}) {
  const textContent = normalizeText(input.textContent || input.extractedText || "").slice(0, TEXT_LIMIT);
  const sourceType = ["link", "upload", "pasted_text", "email"].includes(input.sourceType) ? input.sourceType : (textContent ? "pasted_text" : "link");
  const fileName = normalizeText(input.fileName || input.name || "");
  const title = normalizeText(input.title || fileName || input.sourceUrl || "Document review source");
  return {
    projectProfileId: input.projectProfileId ? Number(input.projectProfileId) : null,
    sourceType,
    title: title.slice(0, 240),
    fileName: fileName.slice(0, 240),
    fileType: normalizeText(input.fileType || input.mimeType || "").slice(0, 120),
    sourceUrl: normalizeText(input.sourceUrl || input.url || input.webUrl || "").slice(0, 2000),
    sourceSystem: normalizeText(input.sourceSystem || "alfred").slice(0, 120),
    textContent,
    contentExtracted: Boolean(textContent),
    contentSha256: sha256(textContent),
    sensitivityLabel: normalizeText(input.sensitivityLabel || "local_sensitive_business_data"),
    metadata: {
      exactFileLinkProvided: Boolean(input.sourceUrl || input.url || input.webUrl),
      uploadedFileProvided: sourceType === "upload",
      binaryExtractionSupported: false,
      fileSize: Number(input.fileSize || 0),
      notes: normalizeText(input.notes || ""),
      contentTruncated: normalizeText(input.textContent || input.extractedText || "").length > TEXT_LIMIT,
    },
  };
}

export function createDocumentReviewSource(db, input = {}) {
  const source = normalizeReviewSource(input);
  if (source.projectProfileId) ensureProject(db, source.projectProfileId);
  const result = db.prepare(`
    INSERT INTO document_review_sources (
      project_profile_id, source_type, title, file_name, file_type, source_url,
      source_system, text_content, content_extracted, content_sha256, sensitivity_label, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    source.projectProfileId,
    source.sourceType,
    source.title,
    source.fileName,
    source.fileType,
    source.sourceUrl,
    source.sourceSystem,
    source.textContent,
    source.contentExtracted ? 1 : 0,
    source.contentSha256,
    source.sensitivityLabel,
    JSON.stringify(source.metadata),
  );
  const saved = getDocumentReviewSource(db, Number(result.lastInsertRowid));
  recordDocumentReviewAudit(db, {
    eventType: "source_created",
    userAction: input.userAction || "document-review:source-created",
    projectProfileId: source.projectProfileId,
    dataCategories: ["document_review_source", source.contentExtracted ? "document_text" : "document_metadata"],
    model: "local-document-source-intake",
    metadata: {
      sourceId: saved.id,
      sourceType: saved.sourceType,
      contentExtracted: saved.contentExtracted,
      exactFileLinkProvided: Boolean(saved.sourceUrl),
    },
  });
  return saved;
}

export function getDocumentReviewSource(db, id) {
  const row = db.prepare("SELECT * FROM document_review_sources WHERE id = ?").get(Number(id));
  const source = mapRow(row, ["metadata"]);
  if (!source) return null;
  return {
    ...source,
    contentExtracted: Boolean(source.contentExtracted),
    metadata: safeJsonParse(row.metadata, {}),
    sourceReference: `document_review_source:${source.id}`,
  };
}

export function listDocumentReviewSources(db, { projectProfileId = null, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const rows = projectProfileId
    ? db.prepare("SELECT * FROM document_review_sources WHERE project_profile_id = ? ORDER BY created_at DESC, id DESC LIMIT ?").all(Number(projectProfileId), safeLimit)
    : db.prepare("SELECT * FROM document_review_sources ORDER BY created_at DESC, id DESC LIMIT ?").all(safeLimit);
  return rows.map((row) => ({
    ...mapRow(row, ["metadata"]),
    contentExtracted: Boolean(row.content_extracted),
    metadata: safeJsonParse(row.metadata, {}),
    textContent: row.text_content ? compactText(row.text_content, 500) : "",
    sourceReference: `document_review_source:${row.id}`,
  }));
}

export function buildDocumentReviewInput(db, {
  projectProfileId,
  sourceIds = [],
  clientRequirements = "",
  incomingEmail = "",
  disciplines = DOCUMENT_REVIEW_DISCIPLINES,
} = {}) {
  const project = ensureProject(db, projectProfileId);
  const ids = jsonArray(sourceIds).map(Number).filter(Boolean);
  const sources = ids.map((id) => getDocumentReviewSource(db, id)).filter(Boolean);
  const input = {
    projectProfile: project?.profile || null,
    clientName: project?.profile?.clientName || "",
    clientRequirements: normalizeText(clientRequirements).slice(0, 20_000),
    incomingEmail: normalizeText(incomingEmail).slice(0, 20_000),
    disciplines: jsonArray(disciplines).length ? jsonArray(disciplines) : DOCUMENT_REVIEW_DISCIPLINES,
    domainContext: domainContext(disciplines),
    sources: sources.map((source) => ({
      id: source.id,
      sourceReference: `document_review_source:${source.id}`,
      sourceType: source.sourceType,
      title: source.title,
      fileName: source.fileName,
      fileType: source.fileType,
      sourceUrl: source.sourceUrl,
      sourceSystem: source.sourceSystem,
      contentExtracted: source.contentExtracted,
      textContent: source.textContent || "",
      sensitivityLabel: source.sensitivityLabel,
      metadata: source.metadata,
    })),
    projectContext: {
      risks: (project?.risks || []).slice(0, 8),
      actions: (project?.actions || []).slice(0, 8),
      decisions: (project?.decisions || []).slice(0, 8),
      documents: (project?.documents || []).slice(0, 12).map((document) => ({
        id: document.id,
        name: document.name,
        classification: document.classification,
        fullContentRetrieved: false,
        sourceReference: `project_document:${document.id}`,
      })),
    },
    boundaries: DOCUMENT_REVIEW_BOUNDARY,
    sourceRecordReferences: allSourceReferences({
      projectProfile: project?.profile,
      sources,
    }),
  };
  return input;
}

export function deterministicDocumentReview(input = {}) {
  const sourceText = inputSourceText(input);
  const requirements = requirementLines(input.clientRequirements || input.incomingEmail);
  const sourceRefs = allSourceReferences(input);
  const sourceRef = sourceRefs[1]?.reference || sourceRefs[0]?.reference || "document_review_source:none";
  const requirementChecks = (requirements.length ? requirements : ["Review the supplied document information against the client question."]).map((requirement) => {
    const evaluated = evaluateRequirement(requirement, sourceText);
    return { requirement, sourceReference: sourceRef, ...evaluated };
  });
  const metadataOnly = !(input.sources || []).some((source) => source.contentExtracted);
  const disciplines = jsonArray(input.disciplines).length ? jsonArray(input.disciplines) : DOCUMENT_REVIEW_DISCIPLINES;
  const consultantReviews = disciplines.slice(0, 6).map((discipline) => ({
    consultant: `${discipline} Consultant`,
    discipline,
    assessment: metadataOnly
      ? `${discipline} can only complete a metadata-level review until document text is supplied.`
      : `${discipline} reviewed the supplied extracted text and client requirements for ${firstProjectName(input)}.`,
    keyFindings: [
      metadataOnly ? "Exact file link/metadata is captured, but full contents were not extracted." : "Extracted document text was available for review.",
      requirementChecks.some((item) => item.status === "not_evidenced") ? "Some requirements are not yet clearly evidenced." : "No major unevidenced requirement was found by the deterministic check.",
    ],
    concerns: [
      metadataOnly ? "Do not issue a compliance statement until the relevant text or source extract has been reviewed." : "",
      "Patrick should review the draft before it is used externally.",
    ].filter(Boolean),
    recommendedActions: [
      metadataOnly ? "Paste the relevant document extract or use a text-readable upload before finalising the response." : "Check source extracts against the original file before sending any client response.",
      "Keep the response as a draft until Patrick approves it.",
    ],
    confidence: metadataOnly ? "low" : "medium",
    sourceReference: sourceRef,
  }));
  const riskIssueLog = requirementChecks
    .filter((item) => item.status === "not_evidenced" || item.status === "partially_met")
    .slice(0, 6)
    .map((item, index) => ({
      ref: `R${index + 1}`,
      issue: item.status === "not_evidenced" ? `Requirement not evidenced: ${compactText(item.requirement, 100)}` : `Requirement partially evidenced: ${compactText(item.requirement, 100)}`,
      impact: item.status === "not_evidenced" ? "Medium" : "Low",
      mitigation: item.responsePosition,
      severity: item.status === "not_evidenced" ? "medium" : "low",
      sourceReference: item.sourceReference,
    }));
  return {
    executiveSummary: metadataOnly
      ? `Sarah has captured the review source for ${firstProjectName(input)}, but full document content has not been extracted yet.`
      : `Sarah and the digital construction consultants reviewed the supplied document text against the client requirements for ${firstProjectName(input)}.`,
    consultantReviews,
    requirementChecks,
    riskIssueLog,
    recommendedNextSteps: [
      metadataOnly ? "Provide pasted/extracted text from the linked document before making a final technical claim." : "Patrick to review the consultant findings and confirm the final client position.",
      "Keep the email as draft-only; no email has been sent.",
    ],
    confidenceLevel: metadataOnly ? "low" : "medium",
    assumptions: [
      metadataOnly ? "Only file metadata/link information was available; no full document content was reviewed." : "The review is based on supplied extracted text, not a live edit of the source file.",
      "This is advisory only and requires Patrick review before external use.",
    ],
    sourceRecordReferences: sourceRefs,
  };
}

export function saveDocumentReview(db, {
  projectProfileId,
  title = "",
  reviewType = "client_requirement_review",
  disciplines = [],
  clientRequirements = "",
  incomingEmail = "",
  sourceIds = [],
  reviewOutput = {},
  model = MODEL_DETERMINISTIC_REVIEW,
} = {}) {
  const result = db.prepare(`
    INSERT INTO document_reviews (
      project_profile_id, title, review_type, disciplines, client_requirements,
      incoming_email, source_ids, review_output, model, status, execution_attempted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft_internal', 0)
  `).run(
    projectProfileId ? Number(projectProfileId) : null,
    normalizeText(title || reviewOutput.executiveSummary || "Document review").slice(0, 240),
    normalizeText(reviewType),
    JSON.stringify(jsonArray(disciplines)),
    normalizeText(clientRequirements),
    normalizeText(incomingEmail),
    JSON.stringify(jsonArray(sourceIds).map(Number).filter(Boolean)),
    JSON.stringify(reviewOutput),
    normalizeText(model || MODEL_DETERMINISTIC_REVIEW),
  );
  return getDocumentReview(db, Number(result.lastInsertRowid));
}

export function getDocumentReview(db, id) {
  const row = db.prepare("SELECT * FROM document_reviews WHERE id = ?").get(Number(id));
  const review = mapRow(row, ["disciplines", "source_ids", "review_output"]);
  if (!review) return null;
  return {
    ...review,
    disciplines: safeJsonParse(row.disciplines, []),
    sourceIds: safeJsonParse(row.source_ids, []),
    reviewOutput: safeJsonParse(row.review_output, {}),
    executionAttempted: Boolean(row.execution_attempted),
    sourceReference: `document_review:${row.id}`,
  };
}

export function formatClientResponseMarkdown({
  analysis = {},
  projectName = "the project",
  clientName = "the client",
  incomingEmail = "",
} = {}) {
  const subject = `Re: ${extractEmailSubject(incomingEmail)}`;
  const checks = analysis.requirementChecks || [];
  const risks = analysis.riskIssueLog || [];
  const nextSteps = analysis.recommendedNextSteps || [];
  return [
    `Subject: ${subject}`,
    "",
    "Hi,",
    "",
    "Thank you for your email.",
    "",
    `Please see our response below following Sarah's BIM/GIS/Digital Twin review for ${projectName}. This remains a draft for Patrick's approval before issue.`,
    "",
    "1. Client Requirement Review",
    "",
    "Objective",
    "",
    `Review the supplied client requirements and document information for ${clientName}.`,
    "",
    "Activities",
    "",
    ...(checks.length ? checks.slice(0, 8).map((item) => `- ${item.requirement} — ${item.status.replaceAll("_", " ")}. ${item.evidence}`) : ["- No detailed client requirements were supplied in the review request."]),
    "",
    "Outcome",
    "",
    analysis.executiveSummary || "The review has been completed as an internal draft only.",
    "",
    "2. Consultant Observations",
    "",
    ...(analysis.consultantReviews || []).slice(0, 6).map((item) => [
      `${item.discipline}`,
      "",
      "Objective",
      "",
      `Assess ${item.discipline} implications for the client response.`,
      "",
      "Activities",
      "",
      ...((item.keyFindings || []).map((finding) => `- ${finding}`)),
      ...((item.concerns || []).map((concern) => `- Concern: ${concern}`)),
      "",
      "Outcome",
      "",
      item.assessment,
      "",
    ].join("\n")),
    "3. Risk & Issue Log",
    "",
    "| Ref | Issue | Impact | Mitigation |",
    "| --- | --- | --- | --- |",
    ...(risks.length ? risks.map((risk) => `| ${risk.ref} | ${risk.issue} | ${risk.impact} | ${risk.mitigation} |`) : ["| R1 | No material issue identified in the supplied extract | Low | Confirm against the source file before issue |"]),
    "",
    "4. Next Steps",
    "",
    ...(nextSteps.length ? nextSteps.map((step) => `- ${step}`) : ["- Patrick to review and approve the draft before it is sent externally."]),
    "",
    "Kind regards,",
    "",
    "Patrick King",
    "Digitize Consultants",
  ].join("\n");
}

export function saveClientResponseDraft(db, {
  projectProfileId,
  documentReviewId,
  subject = "",
  recipient = "",
  incomingEmail = "",
  draftBodyMarkdown = "",
  sourceReferences = [],
  assumptions = [],
  model = MODEL_DETERMINISTIC_DRAFT,
} = {}) {
  const result = db.prepare(`
    INSERT INTO client_response_drafts (
      project_profile_id, document_review_id, subject, recipient, incoming_email,
      draft_body_markdown, draft_format, source_references, assumptions, model,
      status, send_enabled, execution_attempted
    )
    VALUES (?, ?, ?, ?, ?, ?, 'digitize_progress_response', ?, ?, ?, 'draft_only', 0, 0)
  `).run(
    projectProfileId ? Number(projectProfileId) : null,
    documentReviewId ? Number(documentReviewId) : null,
    normalizeText(subject || extractEmailSubject(incomingEmail)).slice(0, 240),
    normalizeText(recipient).slice(0, 240),
    normalizeText(incomingEmail),
    normalizeText(draftBodyMarkdown),
    JSON.stringify(sourceReferences || []),
    JSON.stringify(assumptions || []),
    normalizeText(model || MODEL_DETERMINISTIC_DRAFT),
  );
  return getClientResponseDraft(db, Number(result.lastInsertRowid));
}

export function getClientResponseDraft(db, id) {
  const row = db.prepare("SELECT * FROM client_response_drafts WHERE id = ?").get(Number(id));
  const draft = mapRow(row, ["source_references", "assumptions"]);
  if (!draft) return null;
  return {
    ...draft,
    sourceReferences: safeJsonParse(row.source_references, []),
    assumptions: safeJsonParse(row.assumptions, []),
    sendEnabled: Boolean(row.send_enabled),
    executionAttempted: Boolean(row.execution_attempted),
    sourceReference: `client_response_draft:${row.id}`,
  };
}

export function listDocumentReviewDashboard(db, { projectProfileId = null } = {}) {
  const sources = listDocumentReviewSources(db, { projectProfileId, limit: 12 });
  const reviewRows = projectProfileId
    ? db.prepare("SELECT * FROM document_reviews WHERE project_profile_id = ? ORDER BY created_at DESC, id DESC LIMIT 12").all(Number(projectProfileId))
    : db.prepare("SELECT * FROM document_reviews ORDER BY created_at DESC, id DESC LIMIT 12").all();
  const draftRows = projectProfileId
    ? db.prepare("SELECT * FROM client_response_drafts WHERE project_profile_id = ? ORDER BY created_at DESC, id DESC LIMIT 12").all(Number(projectProfileId))
    : db.prepare("SELECT * FROM client_response_drafts ORDER BY created_at DESC, id DESC LIMIT 12").all();
  return {
    sources,
    reviews: reviewRows.map((row) => getDocumentReview(db, row.id)),
    drafts: draftRows.map((row) => getClientResponseDraft(db, row.id)),
    disciplines: DOCUMENT_REVIEW_DISCIPLINES,
    boundary: DOCUMENT_REVIEW_BOUNDARY,
  };
}

export function recordDocumentReviewAudit(db, {
  eventType,
  userAction = "",
  projectProfileId = null,
  dataCategories = [],
  outputSaved = true,
  model = "",
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO document_review_audit_events (
      event_type, user_action, project_profile_id, data_categories, output_saved,
      model, status, error_code, execution_attempted, external_write_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    String(eventType),
    String(userAction),
    projectProfileId ? Number(projectProfileId) : null,
    JSON.stringify(jsonArray(dataCategories)),
    outputSaved ? 1 : 0,
    String(model),
    String(status),
    String(errorCode).slice(0, 200),
    JSON.stringify({ ...metadata, boundary: DOCUMENT_REVIEW_BOUNDARY }),
  );
  return Number(result.lastInsertRowid);
}

export function listDocumentReviewAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM document_review_audit_events
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    ...mapRow(row, ["data_categories", "metadata"]),
    dataCategories: safeJsonParse(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    externalWriteAttempted: Boolean(row.external_write_attempted),
    metadata: safeJsonParse(row.metadata, {}),
  }));
}
