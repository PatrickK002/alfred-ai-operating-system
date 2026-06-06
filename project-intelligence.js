export const PROJECT_READ_ONLY_BOUNDARY = {
  readOnly: true,
  microsoftWritePermissions: false,
  fileEditsEnabled: false,
  emailSendEnabled: false,
  calendarWriteEnabled: false,
  sharePointWriteEnabled: false,
  oneDriveWriteEnabled: false,
  mondayWriteEnabled: false,
  financialWriteEnabled: false,
  autonomousExecutionEnabled: false,
};

const DOCUMENT_CLASSIFICATIONS = [
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
];

const REQUIRED_DOCUMENT_CLASSES = ["EIR", "BEP", "MIDP", "TIDP"];
const RISK_WORDS = ["risk", "issue", "delay", "blocked", "missing", "overdue", "breach", "escalation"];
const DECISION_WORDS = ["approve", "approval", "decision", "decide", "confirm", "sign off", "agreed", "agreement"];

function toIsoTimestamp(value) {
  if (!value) return "";
  const text = String(value);
  if (text.includes("T")) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00Z`;
  return `${text.replace(" ", "T")}Z`;
}

function normalizeText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
    jsonFields.includes(key) ? safeJsonParse(value, []) : value,
  ]));
}

function projectKeywordTerms(project, contacts = []) {
  const terms = [
    project.projectName,
    project.clientName,
    project.serviceLine,
    ...(project.projectName || "").split(/\s+/),
    ...(project.clientName || "").split(/\s+/),
    ...contacts.map((contact) => contact.email),
    ...contacts.map((contact) => contact.name),
  ]
    .map((term) => normalizeText(term).toLowerCase())
    .filter((term) => term.length >= 3);
  return [...new Set(terms)];
}

function textForSignal(value) {
  if (!value) return "";
  return [
    value.subject,
    value.title,
    value.name,
    value.bodyPreview,
    value.webUrl,
    value.path,
    value.parentFolder,
    value.from?.emailAddress?.name,
    value.from?.emailAddress?.address,
    value.organizer?.emailAddress?.name,
    value.organizer?.emailAddress?.address,
    ...(value.attendees || []).map((attendee) => attendee.emailAddress?.name || attendee.emailAddress?.address || ""),
  ].filter(Boolean).join(" ").toLowerCase();
}

function scoreAssociation(text, project, contacts = []) {
  const terms = projectKeywordTerms(project, contacts);
  const matchedTerms = terms.filter((term) => text.includes(term));
  const strongTerms = [project.projectName, project.clientName]
    .map((term) => normalizeText(term).toLowerCase())
    .filter(Boolean);
  let score = 0;
  for (const term of matchedTerms) {
    score += strongTerms.includes(term) ? 0.45 : 0.15;
  }
  if (contacts.some((contact) => contact.email && text.includes(contact.email.toLowerCase()))) score += 0.35;
  const confidence = Math.max(0, Math.min(1, score));
  return {
    confidence,
    matchedTerms,
    reason: matchedTerms.length
      ? `Matched ${matchedTerms.slice(0, 5).join(", ")}`
      : "No project/client/contact keyword match",
  };
}

function extensionFor(name = "") {
  return String(name).split(".").pop()?.toLowerCase() || "";
}

export function classifyProjectDocument(file = {}) {
  const text = `${file.name || ""} ${file.path || ""} ${file.webUrl || ""} ${file.parentFolder || ""}`.toLowerCase();
  if (/\beir\b|exchange information requirement/.test(text)) return "EIR";
  if (/\bair\b|asset information requirement/.test(text)) return "AIR";
  if (/\bbep\b|bim execution plan/.test(text)) return "BEP";
  if (/\bmidp\b|master information delivery plan/.test(text)) return "MIDP";
  if (/\btidp\b|task information delivery plan/.test(text)) return "TIDP";
  if (/cobie|\.xlsx?$/.test(text) && /cobie/.test(text)) return "COBie";
  if (/\.ifc\b|industry foundation class/.test(text)) return "IFC";
  if (/drawing|drawings|\bdwg\b|\.dwg\b|\.rvt\b|\.nwd\b/.test(text)) return "Drawings";
  if (/minutes|meeting note|mom\b|action log/.test(text)) return "Meeting minutes";
  if (/report|dashboard|review|assessment/.test(text)) return "Reports";
  if (/proposal|quote|tender|bid/.test(text)) return "Proposals";
  if (/contract|appointment|agreement|terms/.test(text)) return "Contracts";
  if (/commercial|fee|invoice|cost|payment|order book/.test(text)) return "Commercial";
  return "Unknown";
}

export function associateEmailToProject(email, project, contacts = []) {
  const result = scoreAssociation(textForSignal(email), project, contacts);
  const signalWords = [...RISK_WORDS, ...DECISION_WORDS].filter((word) => textForSignal(email).includes(word));
  return {
    ...result,
    signalWords,
    associated: result.confidence >= 0.3,
    sourceType: "email",
  };
}

export function associateMeetingToProject(meeting, project, contacts = []) {
  const result = scoreAssociation(textForSignal(meeting), project, contacts);
  return {
    ...result,
    associated: result.confidence >= 0.3,
    sourceType: "calendar",
  };
}

export function associateFileToProject(file, project, contacts = []) {
  const result = scoreAssociation(textForSignal(file), project, contacts);
  return {
    ...result,
    associated: result.confidence >= 0.25,
    sourceType: "file",
  };
}

export function recordProjectAudit(db, {
  projectProfileId = null,
  eventType,
  actor = "Alfred",
  source = "",
  metadata = {},
}) {
  const result = db.prepare(`
    INSERT INTO project_audit_events (project_profile_id, event_type, actor, source, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectProfileId, String(eventType), String(actor), String(source), JSON.stringify(metadata));
  return { id: Number(result.lastInsertRowid), projectProfileId, eventType, actor, source, metadata };
}

function mapProfile(row) {
  const profile = mapRow(row);
  if (!profile) return null;
  return {
    ...profile,
    createdAt: toIsoTimestamp(profile.createdAt),
    updatedAt: toIsoTimestamp(profile.updatedAt),
  };
}

function listRows(db, table, projectProfileId, orderBy = "updated_at DESC, id DESC", jsonFields = []) {
  return db.prepare(`
    SELECT *
    FROM ${table}
    WHERE project_profile_id = ?
    ORDER BY ${orderBy}
  `).all(Number(projectProfileId)).map((row) => mapRow(row, jsonFields));
}

export function listProjectProfiles(db) {
  return db.prepare(`
    SELECT p.*, c.short_name AS company_short_name, c.name AS company_name
    FROM project_profiles p
    LEFT JOIN companies c ON c.id = p.company_id
    ORDER BY p.status = 'Active' DESC, p.project_name ASC
  `).all().map((row) => ({
    ...mapProfile(row),
    companyShortName: row.company_short_name,
    companyName: row.company_name,
  }));
}

export function getProjectProfile(db, id) {
  return mapProfile(db.prepare("SELECT * FROM project_profiles WHERE id = ?").get(Number(id)));
}

export function createProjectProfile(db, payload = {}) {
  const projectName = normalizeText(payload.projectName);
  if (!projectName) {
    const error = new Error("projectName is required");
    error.statusCode = 400;
    throw error;
  }
  const companyId = normalizeText(payload.companyId || "digitize");
  const clientName = normalizeText(payload.clientName || "");
  const client = clientName
    ? db.prepare("SELECT id FROM clients WHERE company_id = ? AND lower(name) = lower(?)").get(companyId, clientName)
    : null;
  const result = db.prepare(`
    INSERT INTO project_profiles (
      project_id, company_id, client_id, client_name, project_name, status,
      service_line, lead_name, start_date, end_date, current_phase, summary,
      financial_business_entity_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.projectId || null,
    companyId,
    payload.clientId || client?.id || null,
    clientName,
    projectName,
    normalizeText(payload.status || "Active"),
    normalizeText(payload.serviceLine || "Information Management"),
    normalizeText(payload.leadName || ""),
    normalizeText(payload.startDate || ""),
    normalizeText(payload.endDate || ""),
    normalizeText(payload.currentPhase || "Discovery"),
    normalizeText(payload.summary || ""),
    normalizeText(payload.financialBusinessEntityId || "digitize"),
  );
  const profile = getProjectProfile(db, Number(result.lastInsertRowid));
  recordProjectAudit(db, {
    projectProfileId: profile.id,
    eventType: "project_profile_created",
    source: "alfred_project_intelligence",
    metadata: { projectName: profile.projectName, readOnly: true },
  });
  linkProjectMemoryRecord(db, profile.id, {
    sourceType: "project_profile",
    sourceId: profile.id,
    summary: compactProjectSummary({ profile }),
    relevanceScore: 1,
  });
  return profile;
}

export function updateProjectProfile(db, id, payload = {}) {
  const existing = getProjectProfile(db, id);
  if (!existing) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  const allowed = [
    "companyId",
    "clientId",
    "clientName",
    "projectName",
    "status",
    "serviceLine",
    "leadName",
    "startDate",
    "endDate",
    "currentPhase",
    "summary",
    "financialBusinessEntityId",
  ];
  const fields = allowed.filter((field) => payload[field] !== undefined);
  if (!fields.length) return existing;
  const column = (field) => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  db.prepare(`
    UPDATE project_profiles
    SET ${fields.map((field) => `${column(field)} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(...fields.map((field) => payload[field]), Number(id));
  const profile = getProjectProfile(db, id);
  recordProjectAudit(db, {
    projectProfileId: profile.id,
    eventType: "project_profile_updated",
    source: "alfred_project_intelligence",
    metadata: { fields, readOnly: true },
  });
  linkProjectMemoryRecord(db, profile.id, {
    sourceType: "project_profile",
    sourceId: profile.id,
    summary: compactProjectSummary({ profile }),
    relevanceScore: 1,
  });
  return profile;
}

export function importProjectDocuments(db, projectProfileId, files = [], { sourceSystem = "microsoft" } = {}) {
  const profile = getProjectProfile(db, projectProfileId);
  if (!profile) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  const contacts = listRows(db, "project_contacts", profile.id);
  const upsert = db.prepare(`
    INSERT INTO project_documents (
      project_profile_id, source_system, external_id, name, path, web_url, file_type,
      classification, size_bytes, created_datetime, modified_datetime, parent_folder,
      association_confidence, association_reason, metadata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_profile_id, source_system, external_id) DO UPDATE SET
      name = excluded.name,
      path = excluded.path,
      web_url = excluded.web_url,
      file_type = excluded.file_type,
      classification = excluded.classification,
      size_bytes = excluded.size_bytes,
      created_datetime = excluded.created_datetime,
      modified_datetime = excluded.modified_datetime,
      parent_folder = excluded.parent_folder,
      association_confidence = excluded.association_confidence,
      association_reason = excluded.association_reason,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `);
  let stored = 0;
  const storedIds = [];
  for (const file of files) {
    const fileRecord = normalizeMicrosoftFile(file);
    const association = associateFileToProject(fileRecord, profile, contacts);
    if (!association.associated && files.length > 1) continue;
    upsert.run(
      profile.id,
      sourceSystem,
      fileRecord.externalId,
      fileRecord.name,
      fileRecord.path,
      fileRecord.webUrl,
      fileRecord.fileType,
      classifyProjectDocument(fileRecord),
      fileRecord.sizeBytes,
      fileRecord.createdDateTime,
      fileRecord.modifiedDateTime,
      fileRecord.parentFolder,
      files.length === 1 && !association.associated ? 1 : association.confidence,
      files.length === 1 && !association.associated ? "Manual/project-specific import" : association.reason,
      JSON.stringify({ rawMetadata: fileRecord.rawMetadata, fullContentIndexed: false }),
    );
    const saved = db.prepare(`
      SELECT id FROM project_documents
      WHERE project_profile_id = ? AND source_system = ? AND external_id = ?
    `).get(profile.id, sourceSystem, fileRecord.externalId);
    if (saved) linkProjectMemoryRecord(db, profile.id, {
      sourceType: "project_document",
      sourceId: saved.id,
      summary: `Project document metadata: ${fileRecord.name}. Classification: ${classifyProjectDocument(fileRecord)}. Full document content was not indexed.`,
      relevanceScore: association.confidence || 0.5,
    });
    stored += 1;
    if (saved) storedIds.push(saved.id);
  }
  if (stored) {
    recordProjectAudit(db, {
      projectProfileId: profile.id,
      eventType: "project_documents_imported",
      source: sourceSystem,
      metadata: { filesRead: files.length, documentsStored: stored, readOnly: true },
    });
  }
  return { projectProfileId: profile.id, filesRead: files.length, documentsStored: stored, storedIds, readOnly: true };
}

export function importProjectEmailSignals(db, projectProfileId, emails = [], { sourceSystem = "microsoft" } = {}) {
  const profile = getProjectProfile(db, projectProfileId);
  const contacts = listRows(db, "project_contacts", projectProfileId);
  const upsert = db.prepare(`
    INSERT INTO project_email_signals (
      project_profile_id, source_system, external_id, subject, from_name, from_email,
      received_datetime, importance, is_read, body_preview, web_url,
      association_confidence, association_reason, metadata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_profile_id, source_system, external_id) DO UPDATE SET
      subject = excluded.subject,
      from_name = excluded.from_name,
      from_email = excluded.from_email,
      received_datetime = excluded.received_datetime,
      importance = excluded.importance,
      is_read = excluded.is_read,
      body_preview = excluded.body_preview,
      web_url = excluded.web_url,
      association_confidence = excluded.association_confidence,
      association_reason = excluded.association_reason,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `);
  let stored = 0;
  for (const email of emails) {
    const association = associateEmailToProject(email, profile, contacts);
    if (!association.associated) continue;
    const from = email.from?.emailAddress || {};
    upsert.run(
      projectProfileId,
      sourceSystem,
      String(email.id || `${email.subject}:${email.receivedDateTime}`),
      normalizeText(email.subject || "(No subject)"),
      normalizeText(from.name || ""),
      normalizeText(from.address || ""),
      normalizeText(email.receivedDateTime || ""),
      normalizeText(email.importance || ""),
      email.isRead ? 1 : 0,
      normalizeText(email.bodyPreview || "").slice(0, 1000),
      normalizeText(email.webLink || ""),
      association.confidence,
      association.reason,
      JSON.stringify({ signalWords: association.signalWords, fullEmailIndexed: false }),
    );
    const saved = db.prepare(`
      SELECT id FROM project_email_signals
      WHERE project_profile_id = ? AND source_system = ? AND external_id = ?
    `).get(projectProfileId, sourceSystem, String(email.id || `${email.subject}:${email.receivedDateTime}`));
    if (saved) linkProjectMemoryRecord(db, projectProfileId, {
      sourceType: "project_email_signal",
      sourceId: saved.id,
      summary: `Project email signal: ${email.subject || "(No subject)"}. ${email.bodyPreview || ""}`.slice(0, 1200),
      relevanceScore: association.confidence,
    });
    stored += 1;
  }
  if (stored) recordProjectAudit(db, {
    projectProfileId,
    eventType: "project_email_signals_imported",
    source: sourceSystem,
    metadata: { emailsRead: emails.length, emailsStored: stored, rawFullEmailsIndexed: false, readOnly: true },
  });
  return { projectProfileId, emailsRead: emails.length, emailsStored: stored, readOnly: true };
}

export function importProjectMeetings(db, projectProfileId, meetings = [], { sourceSystem = "microsoft" } = {}) {
  const profile = getProjectProfile(db, projectProfileId);
  const contacts = listRows(db, "project_contacts", projectProfileId);
  const upsert = db.prepare(`
    INSERT INTO project_meetings (
      project_profile_id, source_system, external_id, title, start_datetime, end_datetime,
      organizer, attendees, web_url, body_preview, association_confidence,
      association_reason, metadata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(project_profile_id, source_system, external_id) DO UPDATE SET
      title = excluded.title,
      start_datetime = excluded.start_datetime,
      end_datetime = excluded.end_datetime,
      organizer = excluded.organizer,
      attendees = excluded.attendees,
      web_url = excluded.web_url,
      body_preview = excluded.body_preview,
      association_confidence = excluded.association_confidence,
      association_reason = excluded.association_reason,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP
  `);
  let stored = 0;
  for (const meeting of meetings) {
    const association = associateMeetingToProject(meeting, profile, contacts);
    if (!association.associated) continue;
    const attendees = (meeting.attendees || []).map((attendee) => attendee.emailAddress || attendee);
    upsert.run(
      projectProfileId,
      sourceSystem,
      String(meeting.id || `${meeting.subject}:${meeting.start?.dateTime}`),
      normalizeText(meeting.subject || meeting.title || "(Untitled meeting)"),
      normalizeText(meeting.start?.dateTime || meeting.start || ""),
      normalizeText(meeting.end?.dateTime || meeting.end || ""),
      normalizeText(meeting.organizer?.emailAddress?.name || meeting.organizer?.emailAddress?.address || ""),
      JSON.stringify(attendees),
      normalizeText(meeting.webLink || ""),
      normalizeText(meeting.bodyPreview || "").slice(0, 1000),
      association.confidence,
      association.reason,
      JSON.stringify({ location: meeting.location || {}, fullCalendarWriteAvailable: false }),
    );
    const saved = db.prepare(`
      SELECT id FROM project_meetings
      WHERE project_profile_id = ? AND source_system = ? AND external_id = ?
    `).get(projectProfileId, sourceSystem, String(meeting.id || `${meeting.subject}:${meeting.start?.dateTime}`));
    if (saved) linkProjectMemoryRecord(db, projectProfileId, {
      sourceType: "project_meeting",
      sourceId: saved.id,
      summary: `Project meeting metadata: ${meeting.subject || meeting.title || "(Untitled meeting)"}. ${meeting.bodyPreview || ""}`.slice(0, 1200),
      relevanceScore: association.confidence,
    });
    stored += 1;
  }
  if (stored) recordProjectAudit(db, {
    projectProfileId,
    eventType: "project_meetings_imported",
    source: sourceSystem,
    metadata: { meetingsRead: meetings.length, meetingsStored: stored, readOnly: true },
  });
  return { projectProfileId, meetingsRead: meetings.length, meetingsStored: stored, readOnly: true };
}

function normalizeMicrosoftFile(file) {
  const parentPath = file.parentReference?.path || file.parentFolder || "";
  return {
    externalId: String(file.id || file.externalId || file.webUrl || file.name),
    name: normalizeText(file.name || ""),
    path: normalizeText(file.path || parentPath || ""),
    webUrl: normalizeText(file.webUrl || ""),
    fileType: normalizeText(file.file?.mimeType || extensionFor(file.name) || (file.folder ? "folder" : "")),
    sizeBytes: Number(file.size || file.sizeBytes || 0),
    createdDateTime: normalizeText(file.createdDateTime || file.created_datetime || ""),
    modifiedDateTime: normalizeText(file.lastModifiedDateTime || file.modifiedDateTime || file.modified_datetime || ""),
    parentFolder: normalizeText(file.parentReference?.name || file.parentFolder || parentPath.split("/").pop() || ""),
    rawMetadata: {
      folder: Boolean(file.folder),
      file: Boolean(file.file),
      parentReference: file.parentReference || null,
    },
  };
}

function upsertSourceRecord(db, table, projectProfileId, record) {
  const existing = record.sourceId
    ? db.prepare(`SELECT id FROM ${table} WHERE project_profile_id = ? AND source_type = ? AND source_id = ?`).get(projectProfileId, record.sourceType, String(record.sourceId))
    : null;
  if (existing) {
    db.prepare(`
      UPDATE ${table}
      SET title = ?, detail = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(record.title, record.detail, existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO ${table} (
      project_profile_id, title, detail, priority, due, status, source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectProfileId,
    record.title,
    record.detail,
    record.priority || "medium",
    record.due || "",
    record.status || "open",
    record.sourceType || "alfred",
    String(record.sourceId || ""),
    record.confidence || "confirmed",
  );
  return Number(result.lastInsertRowid);
}

function upsertProjectRisk(db, projectProfileId, record) {
  const existing = record.sourceId
    ? db.prepare("SELECT id FROM project_risks WHERE project_profile_id = ? AND source_type = ? AND source_id = ?").get(projectProfileId, record.sourceType, String(record.sourceId))
    : null;
  if (existing) {
    db.prepare("UPDATE project_risks SET title = ?, detail = ?, severity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(record.title, record.detail, record.severity || record.priority || "medium", record.status || "open", existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO project_risks (
      project_profile_id, title, detail, severity, status, source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projectProfileId, record.title, record.detail, record.severity || record.priority || "medium", record.status || "open", record.sourceType || "alfred", String(record.sourceId || ""), record.confidence || "confirmed");
  return Number(result.lastInsertRowid);
}

function upsertProjectDecision(db, projectProfileId, record) {
  const existing = record.sourceId
    ? db.prepare("SELECT id FROM project_decisions WHERE project_profile_id = ? AND source_type = ? AND source_id = ?").get(projectProfileId, record.sourceType, String(record.sourceId))
    : null;
  if (existing) {
    db.prepare("UPDATE project_decisions SET title = ?, detail = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(record.title, record.detail, record.status || "open", existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO project_decisions (
      project_profile_id, title, detail, status, source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectProfileId, record.title, record.detail, record.status || "open", record.sourceType || "alfred", String(record.sourceId || ""), record.confidence || "confirmed");
  return Number(result.lastInsertRowid);
}

export function syncOperatingRecordsToProjects(db) {
  const profiles = listProjectProfiles(db);
  let linked = 0;
  for (const profile of profiles) {
    const contacts = listRows(db, "project_contacts", profile.id);
    for (const [table, target] of [
      ["actions", "project_actions"],
      ["risks", "project_risks"],
      ["decisions", "project_decisions"],
    ]) {
      const rows = db.prepare(`SELECT * FROM ${table} WHERE company_id = ? ORDER BY updated_at DESC`).all(profile.companyId);
      for (const row of rows) {
        const association = scoreAssociation(`${row.title} ${row.detail}`.toLowerCase(), profile, contacts);
        if (row.project_id && row.project_id === profile.projectId || association.confidence >= 0.3) {
          if (target === "project_risks") {
            upsertProjectRisk(db, profile.id, {
              title: row.title,
              detail: row.detail,
              severity: row.priority,
              status: row.status,
              sourceType: "operating_risk",
              sourceId: row.id,
            });
          } else if (target === "project_decisions") {
            upsertProjectDecision(db, profile.id, {
              title: row.title,
              detail: row.detail,
              status: row.status,
              sourceType: "operating_decision",
              sourceId: row.id,
            });
          } else {
            upsertSourceRecord(db, target, profile.id, {
              title: row.title,
              detail: row.detail,
              priority: row.priority,
              due: row.due,
              status: row.status,
              sourceType: "operating_action",
              sourceId: row.id,
            });
          }
          linked += 1;
        }
      }
    }
  }
  return { linked };
}

function parseDueDate(value, now = new Date()) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return null;
  if (text === "today") return new Date(now.toISOString().slice(0, 10));
  if (text === "tomorrow") return new Date(now.getTime() + 86_400_000);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function isProjectActionOverdue(action, now = new Date()) {
  const due = parseDueDate(action.due, now);
  return action.status !== "complete" && due && due.getTime() < now.getTime();
}

export function calculateProjectHealthScore(bundle, { now = new Date() } = {}) {
  const highRisks = bundle.risks.filter((risk) => risk.status !== "closed" && risk.severity === "high").length;
  const openRisks = bundle.risks.filter((risk) => risk.status !== "closed").length;
  const openActions = bundle.actions.filter((action) => action.status !== "complete").length;
  const overdueActions = bundle.actions.filter((action) => isProjectActionOverdue(action, now)).length;
  const classes = new Set(bundle.documents.map((document) => document.classification));
  const missingClasses = REQUIRED_DOCUMENT_CLASSES.filter((classification) => !classes.has(classification));
  const latestActivity = [
    ...bundle.updates.map((item) => item.createdAt || item.created_at),
    ...bundle.documents.map((item) => item.modifiedDatetime || item.modified_datetime),
    ...bundle.meetings.map((item) => item.startDatetime || item.start_datetime),
    ...bundle.emailSignals.map((item) => item.receivedDatetime || item.received_datetime),
  ].filter(Boolean).sort().pop();
  const daysSinceActivity = latestActivity
    ? (now.getTime() - new Date(latestActivity).getTime()) / 86_400_000
    : Number.POSITIVE_INFINITY;

  let score = 100;
  score -= highRisks * 30;
  score -= Math.max(0, openRisks - highRisks) * 12;
  score -= overdueActions * 18;
  score -= Math.max(0, openActions - overdueActions) * 7;
  score -= missingClasses.length * 6;
  if (!bundle.contacts.length) score -= 8;
  if (!Number.isFinite(daysSinceActivity)) score -= 20;
  else if (daysSinceActivity > 21) score -= 14;
  else if (daysSinceActivity > 7) score -= 6;
  if (bundle.financialSummary?.riskLevel === "high") score -= 15;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const status = score < 55 || highRisks ? "red" : score < 78 || overdueActions || missingClasses.length ? "amber" : "green";
  const explanation = [
    highRisks ? `${highRisks} high risk item(s)` : "",
    overdueActions ? `${overdueActions} overdue action(s)` : "",
    missingClasses.length ? `Missing ${missingClasses.join(", ")}` : "",
    !bundle.contacts.length ? "No confirmed contacts" : "",
    !Number.isFinite(daysSinceActivity) ? "No recent activity recorded" : daysSinceActivity > 7 ? `Last activity ${Math.round(daysSinceActivity)} day(s) ago` : "",
  ].filter(Boolean).join("; ") || "No material project exceptions detected from current records.";

  return {
    score,
    status,
    riskLevel: highRisks ? "high" : openRisks ? "medium" : "low",
    actionStatus: overdueActions ? "overdue" : openActions ? "open" : "clear",
    documentCompleteness: missingClasses.length ? "incomplete" : "baseline",
    recentActivity: !Number.isFinite(daysSinceActivity) ? "none" : daysSinceActivity > 21 ? "stale" : daysSinceActivity > 7 ? "aging" : "recent",
    clientResponsiveness: bundle.emailSignals.length || bundle.meetings.length ? "observed" : "unknown",
    financialRisk: bundle.financialSummary?.riskLevel || "unknown",
    explanation,
    inputs: { highRisks, openRisks, openActions, overdueActions, missingClasses, latestActivity },
  };
}

export function saveProjectHealthScore(db, projectProfileId, health) {
  const result = db.prepare(`
    INSERT INTO project_health_scores (
      project_profile_id, score, status, risk_level, action_status, document_completeness,
      recent_activity, client_responsiveness, financial_risk, explanation, inputs
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectProfileId,
    health.score,
    health.status,
    health.riskLevel,
    health.actionStatus,
    health.documentCompleteness,
    health.recentActivity,
    health.clientResponsiveness,
    health.financialRisk,
    health.explanation,
    JSON.stringify(health.inputs || {}),
  );
  return Number(result.lastInsertRowid);
}

function latestHealth(db, projectProfileId) {
  const row = db.prepare(`
    SELECT *
    FROM project_health_scores
    WHERE project_profile_id = ?
    ORDER BY calculated_at DESC, id DESC
    LIMIT 1
  `).get(projectProfileId);
  if (!row) return null;
  return {
    ...mapRow(row),
    inputs: safeJsonParse(row.inputs, {}),
    calculatedAt: toIsoTimestamp(row.calculated_at),
  };
}

export function getProjectFinancialSummary(db, profile) {
  const term = `%${normalizeText(profile.projectName).toLowerCase()}%`;
  const clientTerm = profile.clientName ? `%${normalizeText(profile.clientName).toLowerCase()}%` : term;
  const rows = db.prepare(`
    SELECT *
    FROM order_book_entries
    WHERE lower(project_name) LIKE ? OR lower(client_name) LIKE ?
  `).all(term, clientTerm);
  const securedRevenue = rows.filter((row) => row.entry_type === "secured").reduce((sum, row) => sum + Number(row.amount_gbp || 0), 0);
  const weightedRevenue = rows.reduce((sum, row) => sum + Number(row.weighted_amount_gbp || 0), 0);
  return {
    linkedOrderBookEntries: rows.length,
    securedRevenue,
    weightedForecastRevenue: weightedRevenue,
    riskLevel: rows.length && weightedRevenue === 0 ? "medium" : "unknown",
    sourceReferences: rows.slice(0, 5).map((row) => `financial_order_book:${row.id}`),
  };
}

export function getProjectDetail(db, id, { calculateHealth = true } = {}) {
  syncOperatingRecordsToProjects(db);
  const profile = getProjectProfile(db, id);
  if (!profile) return null;
  const bundle = {
    profile,
    documents: listRows(db, "project_documents", id, "modified_datetime DESC, updated_at DESC, id DESC").map((row) => ({
      ...row,
      metadata: safeJsonParse(row.metadata, {}),
    })),
    updates: listRows(db, "project_updates", id, "created_at DESC, id DESC"),
    actions: listRows(db, "project_actions", id, "status ASC, due ASC, updated_at DESC, id DESC"),
    risks: listRows(db, "project_risks", id, "severity DESC, updated_at DESC, id DESC"),
    decisions: listRows(db, "project_decisions", id, "updated_at DESC, id DESC"),
    meetings: listRows(db, "project_meetings", id, "start_datetime DESC, id DESC", ["attendees"]).map((row) => ({
      ...row,
      metadata: safeJsonParse(row.metadata, {}),
    })),
    contacts: listRows(db, "project_contacts", id),
    milestones: listRows(db, "project_milestones", id, "due_date ASC, id ASC"),
    emailSignals: listRows(db, "project_email_signals", id, "received_datetime DESC, id DESC").map((row) => ({
      ...row,
      metadata: safeJsonParse(row.metadata, {}),
    })),
    memoryLinks: listRows(db, "project_memory_links", id, "relevance_score DESC, id DESC"),
    financialSummary: getProjectFinancialSummary(db, profile),
  };
  const health = calculateProjectHealthScore(bundle);
  if (calculateHealth) saveProjectHealthScore(db, id, health);
  return {
    ...bundle,
    healthScore: health,
    boundary: PROJECT_READ_ONLY_BOUNDARY,
  };
}

export function getProjectDashboard(db) {
  const profiles = listProjectProfiles(db);
  const now = new Date();
  const projects = profiles.map((profile) => getProjectDetail(db, profile.id, { calculateHealth: false }));
  const activeProjects = projects.filter((project) => project.profile.status === "Active");
  const highRiskProjects = projects.filter((project) => project.healthScore.status === "red" || project.healthScore.riskLevel === "high");
  const overdueActions = projects.flatMap((project) => project.actions
    .filter((action) => isProjectActionOverdue(action, now))
    .map((action) => ({ ...action, projectProfileId: project.profile.id, projectName: project.profile.projectName })));
  const missingInformation = projects
    .filter((project) => project.healthScore.documentCompleteness === "incomplete" || !project.contacts.length || !project.updates.length)
    .map((project) => ({
      projectProfileId: project.profile.id,
      projectName: project.profile.projectName,
      missing: [
        project.healthScore.inputs?.missingClasses?.length ? `Documents: ${project.healthScore.inputs.missingClasses.join(", ")}` : "",
        !project.contacts.length ? "Contacts" : "",
        !project.updates.length ? "Latest update" : "",
      ].filter(Boolean),
    }));
  return {
    boundary: PROJECT_READ_ONLY_BOUNDARY,
    metrics: {
      activeProjects: activeProjects.length,
      highRiskProjects: highRiskProjects.length,
      overdueActions: overdueActions.length,
      recentlyUpdatedProjects: projects.filter((project) => project.healthScore.recentActivity === "recent").length,
      projectsWithMissingInformation: missingInformation.length,
    },
    projects: projects.map((project) => ({
      profile: project.profile,
      healthScore: project.healthScore,
      latestUpdate: project.updates[0] || null,
      documentCount: project.documents.length,
      actionCount: project.actions.filter((action) => action.status !== "complete").length,
      riskCount: project.risks.filter((risk) => risk.status !== "closed").length,
      meetingCount: project.meetings.length,
      emailSignalCount: project.emailSignals.length,
      financialSummary: project.financialSummary,
    })),
    highRiskProjects: highRiskProjects.map((project) => ({ projectProfileId: project.profile.id, projectName: project.profile.projectName, healthScore: project.healthScore })),
    overdueActions,
    recentlyUpdatedProjects: projects.filter((project) => project.healthScore.recentActivity === "recent").map((project) => project.profile),
    missingInformation,
  };
}

export function linkProjectMemoryRecord(db, projectProfileId, {
  sourceType,
  sourceId,
  semanticMemoryId = null,
  relevanceScore = 0,
  summary = "",
}) {
  db.prepare(`
    INSERT INTO project_memory_links (
      project_profile_id, source_type, source_id, semantic_memory_id, relevance_score, summary
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_profile_id, source_type, source_id) DO UPDATE SET
      semantic_memory_id = excluded.semantic_memory_id,
      relevance_score = excluded.relevance_score,
      summary = excluded.summary
  `).run(projectProfileId, sourceType, String(sourceId), semanticMemoryId, Number(relevanceScore) || 0, normalizeText(summary).slice(0, 1200));
}

export function compactProjectSummary({ profile, documents = [], actions = [], risks = [], decisions = [], meetings = [] }) {
  const missingDocs = REQUIRED_DOCUMENT_CLASSES.filter((classification) => !documents.some((document) => document.classification === classification));
  return [
    `Project: ${profile.projectName}.`,
    profile.clientName ? `Client: ${profile.clientName}.` : "",
    `Status: ${profile.status}.`,
    `Service line: ${profile.serviceLine}.`,
    `Phase: ${profile.currentPhase}.`,
    profile.summary,
    `Open actions: ${actions.filter((action) => action.status !== "complete").length}.`,
    `Open risks: ${risks.filter((risk) => risk.status !== "closed").length}.`,
    `Decisions: ${decisions.length}.`,
    `Documents: ${documents.length}.`,
    `Meetings: ${meetings.length}.`,
    missingDocs.length ? `Missing document metadata: ${missingDocs.join(", ")}.` : "Baseline document metadata present.",
  ].filter(Boolean).join(" ");
}

export function searchProjectKnowledge(db, query) {
  const cleanQuery = normalizeText(query).toLowerCase();
  if (!cleanQuery) {
    const error = new Error("q is required");
    error.statusCode = 400;
    throw error;
  }
  const projects = listProjectProfiles(db)
    .map((profile) => {
      const text = `${profile.projectName} ${profile.clientName} ${profile.serviceLine} ${profile.currentPhase} ${profile.summary}`.toLowerCase();
      const score = cleanQuery.split(/\W+/).filter((term) => term && text.includes(term)).length;
      return { ...profile, relevanceScore: score };
    })
    .filter((profile) => profile.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const projectIds = projects.map((project) => project.id);
  const documents = projectIds.length
    ? db.prepare(`
      SELECT d.*, p.project_name
      FROM project_documents d
      JOIN project_profiles p ON p.id = d.project_profile_id
      WHERE d.project_profile_id IN (${projectIds.map(() => "?").join(",")})
      ORDER BY d.modified_datetime DESC, d.id DESC
      LIMIT 20
    `).all(...projectIds).map((row) => mapRow(row))
    : [];
  const related = (table) => projectIds.length
    ? db.prepare(`
      SELECT r.*, p.project_name
      FROM ${table} r
      JOIN project_profiles p ON p.id = r.project_profile_id
      WHERE r.project_profile_id IN (${projectIds.map(() => "?").join(",")})
      ORDER BY r.updated_at DESC, r.id DESC
      LIMIT 20
    `).all(...projectIds).map((row) => mapRow(row))
    : [];
  const memoryReferences = projectIds.length
    ? db.prepare(`
      SELECT l.*, p.project_name
      FROM project_memory_links l
      JOIN project_profiles p ON p.id = l.project_profile_id
      WHERE l.project_profile_id IN (${projectIds.map(() => "?").join(",")})
      ORDER BY l.relevance_score DESC, l.id DESC
      LIMIT 20
    `).all(...projectIds).map((row) => mapRow(row))
    : [];
  return {
    query,
    matchingProjects: projects,
    relevantDocuments: documents,
    relatedRisks: related("project_risks"),
    relatedActions: related("project_actions"),
    relatedDecisions: related("project_decisions"),
    memoryReferences,
  };
}

export async function discoverMicrosoftProjectSignals(db, microsoft, {
  fileLimit = 20,
  emailLimit = 20,
  meetingLimit = 25,
} = {}) {
  const profiles = listProjectProfiles(db);
  const results = [];
  const meetings = await microsoft.listCalendar({ limit: meetingLimit }).catch(() => []);
  for (const profile of profiles) {
    const searchTerms = [profile.projectName, profile.clientName].filter(Boolean).slice(0, 2);
    const files = [];
    const emails = [];
    for (const term of searchTerms) {
      files.push(...await microsoft.listFiles({ search: term, limit: fileLimit }).catch(() => []));
      emails.push(...await microsoft.listMessages({ search: term, limit: emailLimit }).catch(() => []));
    }
    const uniqueFiles = dedupeBy(files, (file) => file.id || file.webUrl || file.name);
    const uniqueEmails = dedupeBy(emails, (email) => email.id || email.webLink || email.subject);
    const documents = importProjectDocuments(db, profile.id, uniqueFiles);
    const emailSignals = importProjectEmailSignals(db, profile.id, uniqueEmails);
    const projectMeetings = importProjectMeetings(db, profile.id, meetings);
    results.push({
      projectProfileId: profile.id,
      projectName: profile.projectName,
      documents,
      emailSignals,
      meetings: projectMeetings,
    });
  }
  return {
    readOnly: true,
    projectsChecked: profiles.length,
    results,
  };
}

function dedupeBy(records, keyFn) {
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = String(keyFn(record) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

export function buildProjectAnalysisInput(db, projectProfileId, {
  retrievedMemoryContext = { records: [], sourceRecordReferences: [] },
} = {}) {
  const detail = getProjectDetail(db, projectProfileId, { calculateHealth: false });
  if (!detail) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  return {
    projectProfile: detail.profile,
    linkedRisks: detail.risks.slice(0, 12),
    linkedActions: detail.actions.slice(0, 12),
    linkedDecisions: detail.decisions.slice(0, 12),
    linkedDocumentMetadata: detail.documents.slice(0, 20).map((document) => ({
      id: document.id,
      name: document.name,
      classification: document.classification,
      path: document.path,
      webUrl: document.webUrl,
      modifiedDatetime: document.modifiedDatetime,
      sourceReference: `project_document:${document.id}`,
      fullContentRetrieved: false,
    })),
    linkedMeetings: detail.meetings.slice(0, 10),
    linkedEmailSignals: detail.emailSignals.slice(0, 10).map((email) => ({
      id: email.id,
      subject: email.subject,
      fromName: email.fromName,
      receivedDatetime: email.receivedDatetime,
      importance: email.importance,
      bodyPreview: email.bodyPreview,
      sourceReference: `project_email_signal:${email.id}`,
      fullEmailRetrieved: false,
    })),
    relevantMemory: retrievedMemoryContext.records,
    oliviaFinancialContext: detail.financialSummary,
    healthScore: detail.healthScore,
    boundaries: PROJECT_READ_ONLY_BOUNDARY,
    fullDocumentContentsRetrieved: false,
    sourceRecordReferences: [
      { reference: `project_profile:${detail.profile.id}`, label: detail.profile.projectName, category: "project_profile" },
      ...detail.documents.slice(0, 10).map((document) => ({ reference: `project_document:${document.id}`, label: document.name, category: "project_document" })),
      ...detail.risks.slice(0, 10).map((risk) => ({ reference: `project_risk:${risk.id}`, label: risk.title, category: "project_risk" })),
      ...detail.actions.slice(0, 10).map((action) => ({ reference: `project_action:${action.id}`, label: action.title, category: "project_action" })),
      ...detail.decisions.slice(0, 10).map((decision) => ({ reference: `project_decision:${decision.id}`, label: decision.title, category: "project_decision" })),
      ...(retrievedMemoryContext.sourceRecordReferences || []),
    ].slice(0, 50),
  };
}

export function projectAttentionForBriefing(db) {
  const dashboard = getProjectDashboard(db);
  return {
    projectsNeedingAttention: dashboard.projects
      .filter((project) => ["red", "amber"].includes(project.healthScore.status))
      .slice(0, 5)
      .map((project) => ({
        id: `project-${project.profile.id}`,
        title: project.profile.projectName,
        detail: `${project.healthScore.status.toUpperCase()} · ${project.healthScore.explanation}`,
        priority: project.healthScore.status === "red" ? "high" : "medium",
        sourceType: "project_health",
        sourceId: project.profile.id,
      })),
    projectRisks: dashboard.highRiskProjects,
    overdueProjectActions: dashboard.overdueActions,
    recentlyUpdatedProjects: dashboard.recentlyUpdatedProjects,
    projectsWithMissingInformation: dashboard.missingInformation,
  };
}

export function listProjectAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM project_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    ...mapRow(row),
    metadata: safeJsonParse(row.metadata, {}),
  }));
}
