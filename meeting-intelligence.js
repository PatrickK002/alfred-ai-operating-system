export const MEETING_READ_ONLY_BOUNDARY = Object.freeze({
  readOnly: true,
  advisoryOnly: true,
  microsoftWritePermissions: false,
  teamsWritePermissions: false,
  calendarWriteEnabled: false,
  emailSendEnabled: false,
  mondayWriteEnabled: false,
  externalActionsEnabled: false,
  rawAudioStored: false,
  transcriptStoredByDefault: false,
});

const MODEL = "deterministic-meeting-intelligence-v1";
const SENTENCE_LIMIT = 14;

const SIGNALS = Object.freeze({
  action: ["action", "follow up", "next step", "todo", "owner", "by friday", "deadline", "send", "prepare", "review", "confirm"],
  decision: ["agreed", "decided", "decision", "approved", "confirmed", "signed off", "go with", "accept"],
  risk: ["risk", "issue", "concern", "blocker", "delay", "overdue", "missing", "escalation", "confidential", "security", "access", "breach", "data protection"],
  opportunity: ["opportunity", "improve", "upsell", "proposal", "expand", "automate", "efficiency", "future phase", "potential"],
  feedback: ["feedback", "useful", "not useful", "accepted", "rejected", "client said", "client confirmed", "positive", "negative"],
  financial: ["revenue", "invoice", "payment", "cashflow", "forecast", "order book", "commercial", "fee", "variation"],
  property: ["property", "portfolio", "acquisition", "due diligence", "tenant", "rent", "yield", "refinance"],
  product: ["product", "saas", "mvp", "validation", "roadmap", "pricing", "customer discovery", "assurance platform", "council assurance"],
  digitalConstruction: ["bim", "iso 19650", "cobie", "eir", "air", "bep", "midp", "tidp", "gis", "digital twin", "information management"],
  powerPlatform: ["power platform", "power apps", "dataverse", "power automate", "power bi", "sharepoint", "canvas app", "model-driven", "low-code"],
  security: ["confidential", "security", "permission", "access", "data protection", "gdpr", "sensitive", "identity", "mfa", "secret", "prompt injection"],
});

const REVIEWERS = Object.freeze([
  { id: "alfred", name: "Alfred", type: "executive", always: true },
  { id: "sarah", name: "Sarah", type: "digital_construction", signals: SIGNALS.digitalConstruction },
  { id: "liam", name: "Liam", type: "power_platform", signals: SIGNALS.powerPlatform },
  { id: "olivia", name: "Olivia", type: "financial", signals: SIGNALS.financial },
  { id: "westbridge-property-director", name: "Westbridge Property Director", type: "property", signals: SIGNALS.property },
  { id: "james", name: "James", type: "product", signals: SIGNALS.product },
  { id: "sentinel", name: "Sentinel", type: "security", signals: SIGNALS.security },
]);

function nowIso() {
  return new Date().toISOString();
}

function clean(value = "") {
  return String(value ?? "").trim();
}

function normalizeStatus(value, fallback = "open") {
  return clean(value || fallback).toLowerCase().replace(/\s+/g, "_");
}

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function boolInt(value) {
  return value ? 1 : 0;
}

function toIso(value) {
  const text = clean(value);
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function textForMeeting(meeting = {}) {
  return [
    meeting.title,
    meeting.subject,
    meeting.bodyPreview,
    meeting.location?.displayName,
    meeting.organizer?.emailAddress?.name,
    meeting.organizer?.emailAddress?.address,
    ...(meeting.attendees || []).map((attendee) => attendee.emailAddress?.name || attendee.emailAddress?.address || attendee.name || attendee.email || ""),
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasAny(text, words) {
  const lower = clean(text).toLowerCase();
  return words.filter((word) => lower.includes(word));
}

function sentenceParts(text) {
  return clean(text)
    .replace(/\r/g, "\n")
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((part) => part.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((part) => part.length > 4)
    .slice(0, 80);
}

function compactSummary(text, fallback) {
  const sentences = sentenceParts(text);
  if (!sentences.length) return fallback;
  return sentences.slice(0, 4).join(" ").slice(0, 1200);
}

function itemFromSentence(sentence, type, meetingId) {
  const title = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
  const priority = hasAny(sentence, ["urgent", "critical", "high", "overdue", "blocker"]).length ? "high" : "medium";
  return {
    meetingId,
    title,
    detail: sentence,
    owner: "",
    dueDate: "",
    priority,
    status: "open",
    severity: priority,
    confidenceLevel: "inferred",
    sourceReference: `meeting_transcript:${meetingId}`,
    type,
  };
}

export function extractMeetingSignals(text, { meetingId = "" } = {}) {
  const sentences = sentenceParts(text).slice(0, SENTENCE_LIMIT);
  const actions = [];
  const decisions = [];
  const risks = [];
  const opportunities = [];
  const questions = [];
  const feedback = [];

  for (const sentence of sentences) {
    if (hasAny(sentence, SIGNALS.action).length) actions.push(itemFromSentence(sentence, "action", meetingId));
    if (hasAny(sentence, SIGNALS.decision).length) decisions.push(itemFromSentence(sentence, "decision", meetingId));
    if (hasAny(sentence, SIGNALS.risk).length) risks.push(itemFromSentence(sentence, "risk", meetingId));
    if (hasAny(sentence, SIGNALS.opportunity).length) opportunities.push(itemFromSentence(sentence, "opportunity", meetingId));
    if (sentence.includes("?")) questions.push({
      meetingId,
      question: sentence,
      owner: "",
      status: "open",
      confidenceLevel: "inferred",
      sourceReference: `meeting_transcript:${meetingId}`,
    });
    if (hasAny(sentence, SIGNALS.feedback).length) feedback.push({
      meetingId,
      outputType: "meeting_discussion",
      agentId: "alfred",
      userFeedback: sentence,
      recommendationStatus: hasAny(sentence, ["accepted", "useful", "confirmed"]).length ? "accepted" : hasAny(sentence, ["rejected", "not useful"]).length ? "rejected" : "unreviewed",
      followUpResult: "",
      lessonLearned: sentence,
      notes: sentence,
    });
  }

  return {
    actions: dedupeByTitle(actions).slice(0, 8),
    decisions: dedupeByTitle(decisions).slice(0, 8),
    risks: dedupeByTitle(risks).slice(0, 8),
    opportunities: dedupeByTitle(opportunities).slice(0, 8),
    questions: dedupeByQuestion(questions).slice(0, 8),
    feedback: feedback.slice(0, 6),
  };
}

function dedupeByTitle(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeByQuestion(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeAttendee(attendee = {}) {
  const emailAddress = attendee.emailAddress || {};
  return {
    name: clean(attendee.name || emailAddress.name || emailAddress.address || attendee.email || ""),
    email: clean(attendee.email || emailAddress.address || ""),
    role: clean(attendee.role || attendee.type || "attendee"),
    responseStatus: clean(attendee.responseStatus?.response || attendee.status || ""),
    required: attendee.type === "required" || attendee.required === true,
  };
}

function findAssociations(db, meeting) {
  const text = textForMeeting(meeting);
  const projects = db.prepare("SELECT * FROM project_profiles ORDER BY updated_at DESC, id DESC").all();
  const clients = db.prepare("SELECT * FROM clients ORDER BY updated_at DESC, id DESC").all();
  let project = null;
  for (const candidate of projects) {
    const terms = [candidate.project_name, candidate.client_name].filter(Boolean).map((term) => term.toLowerCase());
    if (terms.some((term) => term && text.includes(term))) {
      project = candidate;
      break;
    }
  }
  let client = null;
  if (project?.client_id) client = clients.find((item) => item.id === project.client_id) || null;
  if (!client) {
    client = clients.find((candidate) => candidate.name && text.includes(candidate.name.toLowerCase())) || null;
  }

  const agentSignals = [
    [SIGNALS.security, "sentinel"],
    [SIGNALS.property, "westbridge-property-director"],
    [SIGNALS.financial, "olivia"],
    [SIGNALS.powerPlatform, "liam"],
    [SIGNALS.product, "james"],
    [SIGNALS.digitalConstruction, "sarah"],
  ];
  const relatedAgent = agentSignals.find(([signals]) => hasAny(text, signals).length)?.[1] || (project ? "sarah" : "alfred");
  const companyId = project?.company_id || client?.company_id || "";
  const businessEntityId = companyId === "westbridge"
    ? "westbridge-property-group"
    : companyId === "digitize"
      ? "digitize"
      : companyId === "product"
        ? "council-assurance-platform"
        : "group";

  return {
    project,
    client,
    companyId,
    businessEntityId,
    relatedAgent,
    confidenceLevel: project ? "inferred" : client ? "inferred" : "assumption",
    assumptions: project || client
      ? ["Project/client association inferred from meeting metadata. Verify before acting."]
      : ["No project/client association could be confirmed from metadata."],
  };
}

function normalizeMeeting(db, meeting = {}, { sourceSystem = "microsoft_calendar" } = {}) {
  const organizer = meeting.organizer?.emailAddress || {};
  const attendees = (meeting.attendees || []).map(normalizeAttendee);
  const association = findAssociations(db, meeting);
  const start = toIso(meeting.start?.dateTime || meeting.startDateTime || meeting.start || "");
  const end = toIso(meeting.end?.dateTime || meeting.endDateTime || meeting.end || "");
  const externalId = clean(meeting.id || meeting.externalId || meeting.iCalUId || `${meeting.subject || meeting.title}:${start}`);
  return {
    sourceSystem,
    externalId,
    title: clean(meeting.subject || meeting.title || "(Untitled meeting)"),
    startDatetime: start,
    endDatetime: end,
    organizerName: clean(meeting.organizerName || organizer.name || organizer.address || ""),
    organizerEmail: clean(meeting.organizerEmail || organizer.address || ""),
    location: clean(meeting.location?.displayName || meeting.location || ""),
    webUrl: clean(meeting.webLink || meeting.webUrl || ""),
    onlineMeetingUrl: clean(meeting.onlineMeeting?.joinUrl || meeting.onlineMeetingUrl || meeting.joinUrl || ""),
    clientId: association.client?.id || null,
    clientName: clean(association.project?.client_name || association.client?.name || ""),
    projectProfileId: association.project?.id || null,
    projectName: clean(association.project?.project_name || ""),
    businessEntityId: association.businessEntityId,
    companyId: association.companyId || null,
    relatedAgent: association.relatedAgent,
    transcriptAvailable: Boolean(meeting.transcriptText || meeting.transcriptAvailable),
    transcriptSource: clean(meeting.transcriptSource || ""),
    transcriptReference: clean(meeting.transcriptReference || ""),
    transcriptPermission: meeting.transcriptText || meeting.transcriptAvailable ? "available" : "not_available",
    transcriptStatus: meeting.transcriptText ? "available" : "not_available",
    sourceReference: `${sourceSystem}:${externalId}`,
    confidenceLevel: association.confidenceLevel,
    assumptions: association.assumptions,
    attendees,
    bodyPreview: clean(meeting.bodyPreview || ""),
    transcriptText: clean(meeting.transcriptText || ""),
    metadata: {
      originalSource: sourceSystem,
      categories: meeting.categories || [],
      bodyPreviewAvailable: Boolean(meeting.bodyPreview),
      transcriptContentAvailable: Boolean(meeting.transcriptText),
      calendarWriteAvailable: false,
      teamsWriteAvailable: false,
    },
  };
}

function mapMeetingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceSystem: row.source_system,
    externalId: row.external_id,
    title: row.title,
    startDatetime: row.start_datetime,
    endDatetime: row.end_datetime,
    organizerName: row.organizer_name,
    organizerEmail: row.organizer_email,
    location: row.location,
    webUrl: row.web_url,
    onlineMeetingUrl: row.online_meeting_url,
    bodyPreview: row.body_preview,
    clientId: row.client_id,
    clientName: row.client_name,
    projectProfileId: row.project_profile_id,
    projectName: row.project_name,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    relatedAgent: row.related_agent,
    transcriptAvailable: Boolean(row.transcript_available),
    transcriptSource: row.transcript_source,
    transcriptReference: row.transcript_reference,
    transcriptPermission: row.transcript_permission,
    transcriptStatus: row.transcript_status,
    sourceReference: row.source_reference,
    confidenceLevel: row.confidence_level,
    assumptions: parseJson(row.assumptions, []),
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSimpleRow(row) {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
    ["metadata", "assumptions", "confirmed_facts", "inferred_points", "source_references", "recommendations", "concerns"].includes(key)
      ? parseJson(value, [])
      : value,
  ]));
}

export function recordMeetingAudit(db, {
  meetingId = null,
  eventType,
  userAction = "",
  sourceSystem = "alfred",
  dataCategories = [],
  outputSaved = true,
  model = MODEL,
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO meeting_audit_events (
      meeting_id, event_type, user_action, source_system, data_categories,
      output_saved, model, status, error_code, execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    meetingId,
    eventType,
    userAction,
    sourceSystem,
    json(dataCategories),
    boolInt(outputSaved),
    model,
    status,
    errorCode,
    json({ ...metadata, boundary: MEETING_READ_ONLY_BOUNDARY }),
  );
  return db.prepare("SELECT * FROM meeting_audit_events WHERE id = ?").get(Number(result.lastInsertRowid));
}

function upsertMeeting(db, normalized) {
  db.prepare(`
    INSERT INTO meeting_records (
      source_system, external_id, title, start_datetime, end_datetime, organizer_name, organizer_email,
      location, web_url, online_meeting_url, body_preview, client_id, client_name, project_profile_id, project_name,
      business_entity_id, company_id, related_agent, transcript_available, transcript_source,
      transcript_reference, transcript_permission, transcript_status, source_reference, confidence_level,
      assumptions, metadata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_system, external_id) DO UPDATE SET
      title = excluded.title,
      start_datetime = excluded.start_datetime,
      end_datetime = excluded.end_datetime,
      organizer_name = excluded.organizer_name,
      organizer_email = excluded.organizer_email,
      location = excluded.location,
      web_url = excluded.web_url,
      online_meeting_url = excluded.online_meeting_url,
      body_preview = excluded.body_preview,
      client_id = excluded.client_id,
      client_name = excluded.client_name,
      project_profile_id = excluded.project_profile_id,
      project_name = excluded.project_name,
      business_entity_id = excluded.business_entity_id,
      company_id = excluded.company_id,
      related_agent = excluded.related_agent,
      transcript_available = excluded.transcript_available,
      transcript_source = excluded.transcript_source,
      transcript_reference = excluded.transcript_reference,
      transcript_permission = excluded.transcript_permission,
      transcript_status = excluded.transcript_status,
      source_reference = excluded.source_reference,
      confidence_level = excluded.confidence_level,
      assumptions = excluded.assumptions,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    normalized.sourceSystem,
    normalized.externalId,
    normalized.title,
    normalized.startDatetime,
    normalized.endDatetime,
    normalized.organizerName,
    normalized.organizerEmail,
    normalized.location,
    normalized.webUrl,
    normalized.onlineMeetingUrl,
    normalized.bodyPreview,
    normalized.clientId,
    normalized.clientName,
    normalized.projectProfileId,
    normalized.projectName,
    normalized.businessEntityId,
    normalized.companyId,
    normalized.relatedAgent,
    boolInt(normalized.transcriptAvailable),
    normalized.transcriptSource,
    normalized.transcriptReference,
    normalized.transcriptPermission,
    normalized.transcriptStatus,
    normalized.sourceReference,
    normalized.confidenceLevel,
    json(normalized.assumptions),
    json(normalized.metadata),
  );
  const row = db.prepare("SELECT * FROM meeting_records WHERE source_system = ? AND external_id = ?")
    .get(normalized.sourceSystem, normalized.externalId);
  replaceAttendees(db, row.id, normalized.attendees);
  ensureTranscriptFallback(db, row.id, normalized);
  ensureMeetingMemoryLink(db, row.id, "meeting_record", row.id, compactMeetingMemorySummary(db, row.id));
  return getMeetingDetail(db, row.id);
}

function replaceAttendees(db, meetingId, attendees = []) {
  db.prepare("DELETE FROM meeting_attendees WHERE meeting_id = ?").run(meetingId);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO meeting_attendees (
      meeting_id, name, email, role, response_status, required
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const attendee of attendees) {
    insert.run(meetingId, attendee.name, attendee.email, attendee.role, attendee.responseStatus, boolInt(attendee.required));
  }
}

function ensureTranscriptFallback(db, meetingId, normalized) {
  if (normalized.transcriptText) return;
  const existing = db.prepare("SELECT id FROM meeting_summaries WHERE meeting_id = ?").get(meetingId);
  if (existing) return;
  db.prepare(`
    INSERT INTO meeting_summaries (
      meeting_id, summary, confirmed_facts, inferred_points, assumptions, confidence_level, source_references
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    meetingId,
    "Transcript not available. Alfred reviewed calendar metadata only and has not inferred meeting content.",
    json([
      `Meeting title: ${normalized.title}`,
      normalized.startDatetime ? `Start: ${normalized.startDatetime}` : "",
      normalized.organizerName ? `Organizer: ${normalized.organizerName}` : "",
    ].filter(Boolean)),
    json([]),
    json(["Transcript not available. Do not treat metadata as meeting minutes."]),
    "assumption",
    json([normalized.sourceReference]),
  );
  createAgentReviews(db, meetingId, "", { metadataOnly: true });
}

export function createMeetingRecord(db, payload = {}) {
  const normalized = normalizeMeeting(db, payload, { sourceSystem: payload.sourceSystem || "alfred_manual" });
  const detail = upsertMeeting(db, normalized);
  if (normalized.transcriptText) {
    processMeetingTranscript(db, detail.meeting.id, {
      transcriptText: normalized.transcriptText,
      transcriptReference: normalized.transcriptReference || detail.meeting.sourceReference,
      transcriptPermitted: payload.transcriptPermitted !== false,
      storeTranscriptText: payload.storeTranscriptText === true,
      userAction: payload.userAction || "meeting:create-with-transcript",
    });
  }
  recordMeetingAudit(db, {
    meetingId: detail.meeting.id,
    eventType: "meeting_record_created",
    userAction: payload.userAction || "meeting:create",
    sourceSystem: normalized.sourceSystem,
    dataCategories: ["meeting_metadata", normalized.transcriptText ? "transcript_summary" : "transcript_unavailable"],
    metadata: { readOnly: true, title: normalized.title },
  });
  return getMeetingDetail(db, detail.meeting.id);
}

export function importMeetingMetadata(db, meetings = [], { sourceSystem = "microsoft_calendar", userAction = "meeting:import-calendar" } = {}) {
  const stored = [];
  for (const meeting of meetings) {
    const normalized = normalizeMeeting(db, meeting, { sourceSystem });
    stored.push(upsertMeeting(db, normalized).meeting);
  }
  recordMeetingAudit(db, {
    eventType: "meeting_metadata_imported",
    userAction,
    sourceSystem,
    dataCategories: ["calendar_metadata", "meeting_metadata"],
    metadata: { meetingsRead: meetings.length, meetingsStored: stored.length, readOnly: true, transcriptContentRead: false },
  });
  return {
    readOnly: true,
    sourceSystem,
    meetingsRead: meetings.length,
    meetingsStored: stored.length,
    transcriptContentRead: false,
    meetings: stored,
    boundary: MEETING_READ_ONLY_BOUNDARY,
  };
}

export function processMeetingTranscript(db, meetingId, {
  transcriptText = "",
  transcriptReference = "",
  transcriptPermitted = true,
  storeTranscriptText = false,
  userAction = "meeting:process-transcript",
} = {}) {
  const meeting = getMeeting(db, meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }
  const text = clean(transcriptText);
  if (!text || !transcriptPermitted) {
    db.prepare(`
      UPDATE meeting_records
      SET transcript_available = 0, transcript_permission = ?, transcript_status = 'not_available', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(transcriptPermitted ? "not_available" : "not_permitted", meetingId);
    recordMeetingAudit(db, {
      meetingId,
      eventType: "transcript_unavailable",
      userAction,
      dataCategories: ["meeting_metadata"],
      metadata: { transcriptPermitted, transcriptAvailable: false },
    });
    return getMeetingDetail(db, meetingId);
  }

  const summary = compactSummary(text, `Transcript available for ${meeting.title}, but no extractable summary was found.`);
  db.prepare("DELETE FROM meeting_transcripts WHERE meeting_id = ?").run(meetingId);
  db.prepare(`
    INSERT INTO meeting_transcripts (
      meeting_id, source_system, transcript_reference, content_summary, transcript_text,
      raw_content_stored, permission_status, available, updated_at
    )
    VALUES (?, 'teams', ?, ?, ?, ?, 'available', 1, CURRENT_TIMESTAMP)
  `).run(meetingId, transcriptReference || meeting.sourceReference, summary, storeTranscriptText ? text : "", boolInt(storeTranscriptText));
  db.prepare(`
    UPDATE meeting_records
    SET transcript_available = 1, transcript_reference = ?, transcript_permission = 'available',
        transcript_status = 'summary_extracted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(transcriptReference || meeting.sourceReference, meetingId);

  const extracted = extractMeetingSignals(text, { meetingId });
  replaceMeetingSummary(db, meetingId, {
    summary,
    confirmedFacts: [
      `Transcript content was provided for ${meeting.title}.`,
      `Raw transcript stored: ${storeTranscriptText ? "yes" : "no"}.`,
    ],
    inferredPoints: [
      ...extracted.actions.map((item) => `Action signal: ${item.title}`),
      ...extracted.decisions.map((item) => `Decision signal: ${item.title}`),
      ...extracted.risks.map((item) => `Risk signal: ${item.title}`),
    ].slice(0, 12),
    assumptions: ["Action, decision, risk and opportunity extraction is deterministic and should be reviewed before action."],
    confidenceLevel: "inferred",
    sourceReferences: [`meeting_transcript:${meetingId}`],
  });
  replaceExtractedRecords(db, meetingId, extracted);
  createAgentReviews(db, meetingId, text, { metadataOnly: false });
  ensureMeetingMemoryLink(db, meetingId, "meeting_record", meetingId, compactMeetingMemorySummary(db, meetingId));
  ensureMeetingMemoryLink(db, meetingId, "meeting_summary", meetingId, compactMeetingMemorySummary(db, meetingId));
  recordMeetingAudit(db, {
    meetingId,
    eventType: "transcript_processed",
    userAction,
    dataCategories: ["meeting_transcript_summary", "meeting_actions", "meeting_decisions", "meeting_risks", "meeting_opportunities", "meeting_feedback"],
    metadata: {
      transcriptPermitted: true,
      rawTranscriptStored: storeTranscriptText,
      actions: extracted.actions.length,
      decisions: extracted.decisions.length,
      risks: extracted.risks.length,
      opportunities: extracted.opportunities.length,
      feedback: extracted.feedback.length,
    },
  });
  return getMeetingDetail(db, meetingId);
}

function replaceMeetingSummary(db, meetingId, { summary, confirmedFacts, inferredPoints, assumptions, confidenceLevel, sourceReferences }) {
  db.prepare("DELETE FROM meeting_summaries WHERE meeting_id = ?").run(meetingId);
  db.prepare(`
    INSERT INTO meeting_summaries (
      meeting_id, summary, confirmed_facts, inferred_points, assumptions, confidence_level, source_references
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(meetingId, summary, json(confirmedFacts), json(inferredPoints), json(assumptions), confidenceLevel, json(sourceReferences));
}

function replaceExtractedRecords(db, meetingId, extracted) {
  for (const table of ["meeting_actions", "meeting_decisions", "meeting_risks", "meeting_opportunities", "meeting_questions"]) {
    db.prepare(`DELETE FROM ${table} WHERE meeting_id = ?`).run(meetingId);
  }
  removeGeneratedTranscriptFeedback(db, meetingId);
  const actionInsert = db.prepare(`
    INSERT INTO meeting_actions (meeting_id, title, detail, owner, due_date, priority, status, confidence_level, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  extracted.actions.forEach((item) => actionInsert.run(meetingId, item.title, item.detail, item.owner, item.dueDate, item.priority, item.status, item.confidenceLevel, item.sourceReference));
  const decisionInsert = db.prepare(`
    INSERT INTO meeting_decisions (meeting_id, title, detail, status, approval_required, confidence_level, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  extracted.decisions.forEach((item) => decisionInsert.run(meetingId, item.title, item.detail, item.status, boolInt(hasAny(item.detail, ["patrick", "approval", "approve"]).length), item.confidenceLevel, item.sourceReference));
  const riskInsert = db.prepare(`
    INSERT INTO meeting_risks (meeting_id, title, detail, severity, status, confidence_level, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  extracted.risks.forEach((item) => riskInsert.run(meetingId, item.title, item.detail, item.severity, item.status, item.confidenceLevel, item.sourceReference));
  const opportunityInsert = db.prepare(`
    INSERT INTO meeting_opportunities (meeting_id, title, detail, owner, status, confidence_level, source_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  extracted.opportunities.forEach((item) => opportunityInsert.run(meetingId, item.title, item.detail, item.owner, item.status, item.confidenceLevel, item.sourceReference));
  const questionInsert = db.prepare(`
    INSERT INTO meeting_questions (meeting_id, question, owner, status, confidence_level, source_reference)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  extracted.questions.forEach((item) => questionInsert.run(meetingId, item.question, item.owner, item.status, item.confidenceLevel, item.sourceReference));
  for (const feedback of extracted.feedback) {
    recordMeetingFeedback(db, { ...feedback, meetingId, outputType: "meeting_discussion", userAction: "meeting:transcript-feedback-extraction" });
  }
}

function removeGeneratedTranscriptFeedback(db, meetingId) {
  const generatedFeedback = db.prepare(`
    SELECT id, memory_update_reference
    FROM meeting_feedback
    WHERE meeting_id = ? AND output_type = 'meeting_discussion'
  `).all(meetingId);
  const deleteMemoryLink = db.prepare("DELETE FROM meeting_memory_links WHERE meeting_id = ? AND source_type = 'meeting_feedback' AND source_id = ?");
  const deleteMemory = db.prepare("DELETE FROM memories WHERE id = ?");
  for (const feedback of generatedFeedback) {
    deleteMemoryLink.run(meetingId, String(feedback.id));
    const memoryId = clean(feedback.memory_update_reference).match(/^memory:(\d+)$/)?.[1];
    if (memoryId) deleteMemory.run(Number(memoryId));
  }
  db.prepare("DELETE FROM meeting_feedback WHERE meeting_id = ? AND output_type = 'meeting_discussion'").run(meetingId);
}

function createAgentReviews(db, meetingId, text, { metadataOnly = false } = {}) {
  const meeting = getMeeting(db, meetingId);
  const context = `${meeting.title} ${meeting.clientName} ${meeting.projectName} ${meeting.bodyPreview || ""} ${text}`.toLowerCase();
  const insert = db.prepare(`
    INSERT INTO meeting_agent_reviews (
      meeting_id, agent_id, agent_name, review_type, summary, recommendations, concerns,
      source_references, relevance, status, confidence_level, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(meeting_id, agent_id, review_type) DO UPDATE SET
      summary = excluded.summary,
      recommendations = excluded.recommendations,
      concerns = excluded.concerns,
      source_references = excluded.source_references,
      relevance = excluded.relevance,
      status = excluded.status,
      confidence_level = excluded.confidence_level,
      updated_at = CURRENT_TIMESTAMP
  `);
  for (const reviewer of REVIEWERS) {
    const matched = reviewer.always || hasAny(context, reviewer.signals || []).length;
    const shouldCreate = matched || (metadataOnly && ["alfred", "sentinel"].includes(reviewer.id));
    if (!shouldCreate) continue;
    const securityNoSignal = reviewer.id === "sentinel" && !hasAny(context, SIGNALS.security).length;
    const summary = metadataOnly
      ? reviewer.id === "sentinel"
        ? "Sentinel placeholder: no transcript is available, so security/confidentiality review is limited to metadata."
        : "Alfred reviewed meeting metadata only. Transcript content is not available."
      : securityNoSignal
        ? "No explicit security concern was detected in available meeting text. Sentinel remains planned and advisory only."
        : `${reviewer.name} advisory review generated from meeting metadata${text ? " and transcript summary" : ""}.`;
    const recommendations = reviewer.id === "alfred"
      ? ["Review extracted actions and decisions before creating any external follow-up."]
      : securityNoSignal
        ? ["Confirm attendee list and sharing boundaries before circulating sensitive notes."]
        : [`Route relevant ${reviewer.type.replaceAll("_", " ")} points to ${reviewer.name} for future review.`];
    const concerns = reviewer.id === "sentinel" && (securityNoSignal || hasAny(context, SIGNALS.security).length)
      ? ["Check confidentiality, access-control and data-protection implications before sharing meeting outputs."]
      : [];
    insert.run(
      meetingId,
      reviewer.id,
      reviewer.name,
      reviewer.type,
      summary,
      json(recommendations),
      json(concerns),
      json([`meeting:${meetingId}`]),
      matched ? "relevant" : "placeholder",
      reviewer.id === "sentinel" ? "planned_review" : "advisory_review",
      metadataOnly ? "assumption" : "inferred",
    );
  }
}

function ensureMeetingMemoryLink(db, meetingId, sourceType, sourceId, summary, relevanceScore = 0.8) {
  db.prepare(`
    INSERT INTO meeting_memory_links (
      meeting_id, source_type, source_id, summary, relevance_score, sensitivity_category, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'local_sensitive_business_data', CURRENT_TIMESTAMP)
    ON CONFLICT(meeting_id, source_type, source_id) DO UPDATE SET
      summary = excluded.summary,
      relevance_score = excluded.relevance_score,
      updated_at = CURRENT_TIMESTAMP
  `).run(meetingId, sourceType, String(sourceId), summary, relevanceScore);
}

function compactMeetingMemorySummary(db, meetingId) {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) return "";
  const summary = detail.summary?.summary || "Transcript not available. Metadata only.";
  return [
    `Meeting: ${detail.meeting.title}.`,
    detail.meeting.projectName ? `Project: ${detail.meeting.projectName}.` : "",
    detail.meeting.clientName ? `Client: ${detail.meeting.clientName}.` : "",
    `Transcript status: ${detail.meeting.transcriptStatus}.`,
    summary,
    detail.actions.length ? `Actions: ${detail.actions.map((item) => item.title).slice(0, 3).join("; ")}.` : "",
    detail.decisions.length ? `Decisions: ${detail.decisions.map((item) => item.title).slice(0, 3).join("; ")}.` : "",
    detail.risks.length ? `Risks: ${detail.risks.map((item) => item.title).slice(0, 3).join("; ")}.` : "",
  ].filter(Boolean).join(" ").slice(0, 1800);
}

export function recordMeetingFeedback(db, payload = {}) {
  const meetingId = Number(payload.meetingId);
  const meeting = getMeeting(db, meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }
  const result = db.prepare(`
    INSERT INTO meeting_feedback (
      meeting_id, output_type, agent_id, user_feedback, recommendation_status,
      follow_up_result, lesson_learned, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    meetingId,
    clean(payload.outputType || "meeting_summary"),
    clean(payload.agentId || "alfred"),
    clean(payload.userFeedback || payload.feedback || ""),
    normalizeStatus(payload.recommendationStatus || "unreviewed", "unreviewed"),
    clean(payload.followUpResult || ""),
    clean(payload.lessonLearned || ""),
    clean(payload.notes || ""),
  );
  const feedbackId = Number(result.lastInsertRowid);
  let memoryReference = "";
  if (payload.lessonLearned || payload.userFeedback || payload.feedback) {
    const memory = db.prepare(`
      INSERT INTO memories (type, title, detail, company_id, recorded_at)
      VALUES ('meeting_feedback', ?, ?, ?, ?)
    `).run(
      `Feedback: ${meeting.title}`.slice(0, 200),
      [
        clean(payload.userFeedback || payload.feedback),
        payload.recommendationStatus ? `Recommendation status: ${payload.recommendationStatus}.` : "",
        payload.followUpResult ? `Follow-up result: ${payload.followUpResult}.` : "",
        payload.lessonLearned ? `Lesson learned: ${payload.lessonLearned}.` : "",
      ].filter(Boolean).join(" "),
      meeting.companyId || null,
      nowIso(),
    );
    memoryReference = `memory:${Number(memory.lastInsertRowid)}`;
    db.prepare("UPDATE meeting_feedback SET memory_update_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(memoryReference, feedbackId);
    ensureMeetingMemoryLink(db, meetingId, "meeting_feedback", feedbackId, `Meeting feedback memory: ${payload.lessonLearned || payload.userFeedback || payload.feedback}`, 0.9);
  }
  recordMeetingAudit(db, {
    meetingId,
    eventType: "feedback_captured",
    userAction: payload.userAction || "meeting:feedback",
    dataCategories: ["meeting_feedback", memoryReference ? "memory" : ""].filter(Boolean),
    metadata: { feedbackId, memoryReference, outputType: payload.outputType || "meeting_summary" },
  });
  return getMeetingDetail(db, meetingId);
}

export function getMeeting(db, meetingId) {
  return mapMeetingRow(db.prepare("SELECT * FROM meeting_records WHERE id = ?").get(Number(meetingId)));
}

function listRows(db, table, meetingId, orderBy = "created_at DESC, id DESC") {
  return db.prepare(`SELECT * FROM ${table} WHERE meeting_id = ? ORDER BY ${orderBy}`).all(Number(meetingId)).map(mapSimpleRow);
}

export function getMeetingDetail(db, meetingId) {
  const meeting = getMeeting(db, meetingId);
  if (!meeting) return null;
  const summaries = listRows(db, "meeting_summaries", meeting.id);
  return {
    meeting,
    attendees: listRows(db, "meeting_attendees", meeting.id, "name ASC, email ASC"),
    transcripts: listRows(db, "meeting_transcripts", meeting.id),
    summary: summaries[0] || null,
    actions: listRows(db, "meeting_actions", meeting.id, "status ASC, created_at DESC, id DESC"),
    decisions: listRows(db, "meeting_decisions", meeting.id),
    risks: listRows(db, "meeting_risks", meeting.id),
    opportunities: listRows(db, "meeting_opportunities", meeting.id),
    questions: listRows(db, "meeting_questions", meeting.id),
    feedback: listRows(db, "meeting_feedback", meeting.id),
    agentReviews: listRows(db, "meeting_agent_reviews", meeting.id, "agent_id ASC"),
    memoryLinks: listRows(db, "meeting_memory_links", meeting.id),
    boundary: MEETING_READ_ONLY_BOUNDARY,
  };
}

export function listMeetings(db, { limit = 30 } = {}) {
  return db.prepare(`
    SELECT *
    FROM meeting_records
    ORDER BY COALESCE(NULLIF(start_datetime, ''), created_at) DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 30, 1), 100)).map(mapMeetingRow);
}

export function getMeetingDashboard(db) {
  const meetings = listMeetings(db, { limit: 20 });
  const followUps = db.prepare(`
    SELECT a.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM meeting_actions a
    JOIN meeting_records m ON m.id = a.meeting_id
    WHERE a.status != 'complete'
    ORDER BY CASE a.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, a.created_at DESC
    LIMIT 30
  `).all().map(mapSimpleRow);
  const decisions = db.prepare(`
    SELECT d.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM meeting_decisions d
    JOIN meeting_records m ON m.id = d.meeting_id
    ORDER BY d.created_at DESC
    LIMIT 20
  `).all().map(mapSimpleRow);
  const risks = db.prepare(`
    SELECT r.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM meeting_risks r
    JOIN meeting_records m ON m.id = r.meeting_id
    WHERE r.status != 'closed'
    ORDER BY CASE r.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, r.created_at DESC
    LIMIT 20
  `).all().map(mapSimpleRow);
  const feedback = db.prepare(`
    SELECT f.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM meeting_feedback f
    JOIN meeting_records m ON m.id = f.meeting_id
    ORDER BY f.created_at DESC
    LIMIT 20
  `).all().map(mapSimpleRow);
  const agentReviews = db.prepare(`
    SELECT r.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM meeting_agent_reviews r
    JOIN meeting_records m ON m.id = r.meeting_id
    ORDER BY r.updated_at DESC
    LIMIT 30
  `).all().map(mapSimpleRow);
  const transcriptUnavailable = meetings.filter((meeting) => !meeting.transcriptAvailable || meeting.transcriptStatus === "not_available");
  return {
    metrics: {
      totalMeetings: db.prepare("SELECT COUNT(*) AS count FROM meeting_records").get().count,
      recentMeetings: meetings.length,
      meetingsNeedingFollowUp: new Set(followUps.map((item) => item.meetingId)).size,
      openActions: followUps.length,
      decisions: decisions.length,
      risks: risks.length,
      feedbackSignals: feedback.length,
      transcriptUnavailable: transcriptUnavailable.length,
      sentinelConcerns: agentReviews.filter((review) => review.agentId === "sentinel" && (review.concerns || []).length).length,
    },
    recentMeetings: meetings,
    meetingsNeedingFollowUp: meetings.filter((meeting) => followUps.some((item) => item.meetingId === meeting.id)),
    followUpQueue: followUps,
    decisions,
    risks,
    feedback,
    agentReviews,
    transcriptUnavailable,
    boundary: MEETING_READ_ONLY_BOUNDARY,
  };
}

function relevance(text, query) {
  const terms = clean(query).toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  if (!terms.length) return 0;
  const haystack = clean(text).toLowerCase();
  return terms.filter((term) => haystack.includes(term)).length / terms.length;
}

export function searchMeetingKnowledge(db, query) {
  const cleanQuery = clean(query);
  if (!cleanQuery) {
    const error = new Error("q is required");
    error.statusCode = 400;
    throw error;
  }
  const meetings = listMeetings(db, { limit: 100 })
    .map((meeting) => ({ ...meeting, relevanceScore: relevance(`${meeting.title} ${meeting.clientName} ${meeting.projectName} ${meeting.organizerName}`, cleanQuery), sourceReference: `meeting:${meeting.id}` }))
    .filter((meeting) => meeting.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 12);
  const searchTable = (table, fields, category) => db.prepare(`
    SELECT r.*, m.title AS meeting_title, m.project_name, m.client_name
    FROM ${table} r
    JOIN meeting_records m ON m.id = r.meeting_id
    ORDER BY r.created_at DESC
    LIMIT 200
  `).all().map((row) => ({
    ...mapSimpleRow(row),
    relevanceScore: relevance(fields.map((field) => row[field] || "").join(" "), cleanQuery),
    sourceReference: `${category}:${row.id}`,
  })).filter((row) => row.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 12);
  const actions = searchTable("meeting_actions", ["title", "detail", "meeting_title", "project_name", "client_name"], "meeting_action");
  const decisions = searchTable("meeting_decisions", ["title", "detail", "meeting_title", "project_name", "client_name"], "meeting_decision");
  const risks = searchTable("meeting_risks", ["title", "detail", "meeting_title", "project_name", "client_name"], "meeting_risk");
  const feedback = searchTable("meeting_feedback", ["user_feedback", "lesson_learned", "notes", "meeting_title", "project_name", "client_name"], "meeting_feedback");
  return {
    query: cleanQuery,
    matchingMeetings: meetings,
    relatedActions: actions,
    relatedDecisions: decisions,
    relatedRisks: risks,
    feedbackSignals: feedback,
    sourceReferences: [
      ...meetings.map((item) => ({ reference: item.sourceReference, label: item.title, category: "meeting" })),
      ...actions.map((item) => ({ reference: item.sourceReference, label: item.title, category: "meeting_action" })),
      ...decisions.map((item) => ({ reference: item.sourceReference, label: item.title, category: "meeting_decision" })),
      ...risks.map((item) => ({ reference: item.sourceReference, label: item.title, category: "meeting_risk" })),
      ...feedback.map((item) => ({ reference: item.sourceReference, label: item.userFeedback || item.lessonLearned, category: "meeting_feedback" })),
    ].slice(0, 50),
  };
}

export function meetingBriefingForDaily(db) {
  const dashboard = getMeetingDashboard(db);
  const items = [
    ...dashboard.followUpQueue.slice(0, 4).map((item) => ({
      title: `Meeting action: ${item.title}`,
      detail: `${item.meetingTitle || item.meeting_title} · ${item.projectName || item.project_name || item.clientName || item.client_name || "No project linked"}`,
      priority: item.priority || "medium",
      sourceReference: `meeting_action:${item.id}`,
      sourceType: "meeting_action",
    })),
    ...dashboard.risks.slice(0, 3).map((item) => ({
      title: `Meeting risk: ${item.title}`,
      detail: `${item.meetingTitle || item.meeting_title} · ${item.detail || ""}`,
      priority: item.severity === "high" ? "high" : "medium",
      sourceReference: `meeting_risk:${item.id}`,
      sourceType: "meeting_risk",
    })),
    ...dashboard.decisions.slice(0, 3).map((item) => ({
      title: `Meeting decision: ${item.title}`,
      detail: `${item.meetingTitle || item.meeting_title} · ${item.approvalRequired ? "Patrick approval may be required." : "Review decision record."}`,
      priority: item.approvalRequired ? "high" : "medium",
      sourceReference: `meeting_decision:${item.id}`,
      sourceType: "meeting_decision",
    })),
    ...dashboard.agentReviews
      .filter((review) => review.agentId === "sentinel" && (review.concerns || []).length)
      .slice(0, 2)
      .map((review) => ({
        title: "Sentinel meeting concern",
        detail: `${review.meetingTitle || review.meeting_title} · ${(review.concerns || []).join("; ")}`,
        priority: "medium",
        sourceReference: `meeting_agent_review:${review.id}`,
        sourceType: "meeting_agent_review",
      })),
  ];
  return {
    title: "Teams Meeting Intelligence Brief",
    summary: items.length
      ? `${items.length} meeting intelligence signal(s) require review.`
      : "No meeting intelligence exceptions detected from current records.",
    items: items.slice(0, 8),
    metrics: dashboard.metrics,
    boundary: MEETING_READ_ONLY_BOUNDARY,
  };
}

export function listMeetingAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM meeting_audit_events
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    requestedAt: row.requested_at,
    eventType: row.event_type,
    userAction: row.user_action,
    sourceSystem: row.source_system,
    dataCategories: parseJson(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    executionAttempted: Boolean(row.execution_attempted),
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
  }));
}
