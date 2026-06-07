import { getDashboardData, listSemanticSourceRecords } from "./db.js";
import { listMeetings } from "./meeting-intelligence.js";
import { getMondayOperatingDashboard, mondayOperatingCollection } from "./monday-operating-system.js";

export const ALEX_READ_ONLY_BOUNDARY = Object.freeze({
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  outboundMessagesEnabled: false,
  emailSendEnabled: false,
  calendarWriteEnabled: false,
  microsoftWritePermissions: false,
  mondayWriteEnabled: false,
  crmReadEnabled: false,
  crmWriteEnabled: false,
  leadEnrichmentEnabled: false,
  externalWritesEnabled: false,
  approvalRequiredForFutureWrites: true,
});

export const ALEX_DOMAINS = Object.freeze([
  "Sales pipeline",
  "Partnerships",
  "Lead generation",
  "Opportunity scoring",
  "CRM intelligence",
  "Growth strategy",
]);

const COMPLETE_STATUSES = new Set(["Complete", "Rejected", "Closed", "Won", "Lost"]);

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function bool(value) {
  return Boolean(Number(value));
}

function mapRow(row, jsonFields = ["metadata"]) {
  if (!row) return null;
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    mapped[camel] = jsonFields.includes(camel) || jsonFields.includes(key) ? parseJson(value, {}) : value;
  }
  return mapped;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(number(value))));
}

function priorityFromScore(score) {
  if (score >= 80) return "Critical";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function calculateGrowthScore({ estimatedValueGbp = 0, probability = 0, strategicFit = 50, urgency = 40 } = {}) {
  const valueScore = Math.min(35, Math.log10(Math.max(number(estimatedValueGbp), 1)) * 6);
  const probabilityScore = Math.min(30, Math.max(0, number(probability)) * 0.3);
  const fitScore = Math.min(25, Math.max(0, number(strategicFit)) * 0.25);
  const urgencyScore = Math.min(10, Math.max(0, number(urgency)) * 0.1);
  return clampScore(valueScore + probabilityScore + fitScore + urgencyScore);
}

function sourceReference(type, id) {
  return `${type}:${id}`;
}

function recordExists(db, table, sourceType, sourceId) {
  return db.prepare(`SELECT id FROM ${table} WHERE source_type = ? AND source_id = ? LIMIT 1`).get(sourceType, String(sourceId));
}

export function recordAlexAudit(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO alex_audit_events (
      event_type, user_action, record_type, record_id, data_categories, model,
      output_saved, execution_attempted, external_write_attempted, status, error_code, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
  `).run(
    clean(payload.eventType || "alex_event"),
    clean(payload.userAction || "alex:system"),
    clean(payload.recordType || ""),
    String(payload.recordId || ""),
    json(payload.dataCategories || []),
    clean(payload.model || ""),
    payload.outputSaved === false ? 0 : 1,
    payload.status || "success",
    clean(payload.errorCode || ""),
    json(payload.metadata || {}),
  );
  return Number(result.lastInsertRowid);
}

export function listAlexAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM alex_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => ({
    ...mapRow(row, ["data_categories", "metadata"]),
    outputSaved: bool(row.output_saved),
    executionAttempted: bool(row.execution_attempted),
    externalWriteAttempted: bool(row.external_write_attempted),
  }));
}

export function getAlexProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'alex'").get();
  return {
    ...(row ? mapRow(row, ["tools"]) : {
      id: "alex",
      name: "Alex",
      role: "Growth Director",
      department: "Growth",
      status: "Active",
      tools: ALEX_DOMAINS,
    }),
    reportsTo: "Alfred",
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
}

export function listGrowthChannels(db) {
  return db.prepare(`
    SELECT *
    FROM growth_channels
    ORDER BY name
  `).all().map((row) => ({
    ...mapRow(row, ["metadata"]),
    outboundEnabled: bool(row.outbound_enabled),
    crmWriteEnabled: bool(row.crm_write_enabled),
  }));
}

export function listGrowthLeads(db, limit = 100) {
  return db.prepare(`
    SELECT l.*, c.name AS channel_name
    FROM growth_leads l
    LEFT JOIN growth_channels c ON c.id = l.source_channel_id
    ORDER BY l.score DESC, l.updated_at DESC, l.id DESC
    LIMIT ?
  `).all(Number(limit) || 100).map((row) => mapRow(row, ["metadata"]));
}

export function listGrowthOpportunities(db, limit = 100) {
  return db.prepare(`
    SELECT o.*, c.name AS channel_name
    FROM growth_opportunities o
    LEFT JOIN growth_channels c ON c.id = o.source_channel_id
    ORDER BY o.score DESC, o.updated_at DESC, o.id DESC
    LIMIT ?
  `).all(Number(limit) || 100).map((row) => mapRow(row, ["metadata"]));
}

export function listGrowthPartnerships(db, limit = 100) {
  return db.prepare(`
    SELECT *
    FROM growth_partnerships
    ORDER BY score DESC, updated_at DESC, id DESC
    LIMIT ?
  `).all(Number(limit) || 100).map((row) => mapRow(row, ["metadata"]));
}

export function listGrowthStrategies(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM growth_strategies
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => mapRow(row, ["metadata"]));
}

export function listGrowthFeedback(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM growth_feedback
    ORDER BY updated_at DESC, id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => mapRow(row, ["metadata"]));
}

function growthMeetings(db) {
  return listMeetings(db, 25).filter((meeting) => {
    const text = `${meeting.title || ""} ${meeting.clientName || ""} ${meeting.projectName || ""}`.toLowerCase();
    return meeting.relatedAgent === "alex" || /(growth|sales|pipeline|partnership|lead|crm|opportunity)/.test(text);
  });
}

export function ensureAlexMondayIntegration(db) {
  for (const lead of listGrowthLeads(db, 100)) {
    if (!recordExists(db, "work_items", "growth_lead", lead.id)) {
      mondayOperatingCollection(db, "work-items", {
        title: lead.title,
        detail: lead.qualificationNotes || lead.recommendedNextStep || "Growth lead requires qualification.",
        itemType: "growth_lead",
        ownerAgentId: "alex",
        businessEntityId: lead.businessEntityId || "group",
        companyId: lead.companyId || null,
        clientName: lead.clientName || lead.organisationName || "",
        priority: priorityFromScore(lead.score),
        status: lead.status || "Research",
        sourceType: "growth_lead",
        sourceId: lead.id,
        sourceReference: sourceReference("growth_lead", lead.id),
        metadata: { probability: lead.probability, score: lead.score, noOutbound: true },
        userAction: "alex:monday-sync",
      });
    }
  }

  for (const opportunity of listGrowthOpportunities(db, 100)) {
    if (!recordExists(db, "operational_opportunities", "growth_opportunity", opportunity.id)) {
      mondayOperatingCollection(db, "opportunities", {
        title: opportunity.title,
        detail: opportunity.detail,
        ownerAgentId: "alex",
        businessEntityId: opportunity.businessEntityId || "group",
        companyId: opportunity.companyId || null,
        businessImpact: opportunity.businessImpact,
        priority: priorityFromScore(opportunity.score),
        status: opportunity.stage || "Identified",
        recommendedAction: opportunity.recommendedAction,
        sourceType: "growth_opportunity",
        sourceId: opportunity.id,
        sourceReference: sourceReference("growth_opportunity", opportunity.id),
        metadata: { probability: opportunity.probability, score: opportunity.score, noOutbound: true },
        userAction: "alex:monday-sync",
      });
    }
  }

  for (const partnership of listGrowthPartnerships(db, 100)) {
    if (!recordExists(db, "deliverables", "growth_partnership", partnership.id)) {
      mondayOperatingCollection(db, "deliverables", {
        title: `${partnership.partnerName} partnership review`,
        detail: partnership.strategicValue || partnership.recommendedNextStep || "Partnership requires review.",
        ownerAgentId: "alex",
        businessEntityId: partnership.businessEntityId || "group",
        companyId: partnership.companyId || null,
        status: partnership.status || "Research",
        priority: priorityFromScore(partnership.score),
        linkedBusinessId: partnership.businessEntityId || "group",
        linkedMemoryReference: sourceReference("growth_partnership", partnership.id),
        sourceType: "growth_partnership",
        sourceId: partnership.id,
        sourceReference: sourceReference("growth_partnership", partnership.id),
        metadata: { probability: partnership.probability, score: partnership.score, noOutbound: true },
        userAction: "alex:monday-sync",
      });
    }
  }

  for (const feedback of listGrowthFeedback(db, 100)) {
    if (!recordExists(db, "output_feedback", "growth_feedback", feedback.id)) {
      mondayOperatingCollection(db, "feedback", {
        agentId: "alex",
        outputType: "growth_feedback",
        outputTitle: feedback.relatedType || "Alex growth feedback",
        rating: feedback.rating,
        recommendationStatus: feedback.recommendationStatus,
        lessonLearned: feedback.lessonLearned || feedback.feedback,
        futureWorkSuggestion: feedback.futureWorkSuggestion,
        memoryReference: sourceReference("growth_feedback", feedback.id),
        sourceType: "growth_feedback",
        sourceId: feedback.id,
        sourceReference: sourceReference("growth_feedback", feedback.id),
        metadata: { noOutbound: true },
        userAction: "alex:monday-sync",
      });
    }
  }
}

export function getAlexDashboard(db) {
  ensureAlexMondayIntegration(db);
  const profile = getAlexProfile(db);
  const channels = listGrowthChannels(db);
  const leads = listGrowthLeads(db);
  const opportunities = listGrowthOpportunities(db);
  const partnerships = listGrowthPartnerships(db);
  const strategies = listGrowthStrategies(db);
  const feedback = listGrowthFeedback(db);
  const meetings = growthMeetings(db);
  const monday = getMondayOperatingDashboard(db);
  const alexWorkload = monday.agentWorkloads.find((item) => item.agentId === "alex") || null;
  const weightedPipeline = [...leads, ...opportunities, ...partnerships]
    .reduce((total, item) => total + (number(item.estimatedValueGbp || item.potentialValueGbp) * number(item.probability) / 100), 0);
  return {
    profile,
    domains: ALEX_DOMAINS,
    channels,
    leads,
    opportunities,
    partnerships,
    strategies,
    feedback,
    meetings,
    monday: {
      workload: alexWorkload,
      workItems: monday.workItems.filter((item) => item.ownerAgentId === "alex"),
      deliverables: monday.deliverables.filter((item) => item.ownerAgentId === "alex"),
      opportunities: monday.operationalOpportunities.filter((item) => item.ownerAgentId === "alex"),
      risks: monday.operationalRisks.filter((item) => item.ownerAgentId === "alex"),
      decisions: monday.operationalDecisions.filter((item) => item.ownerAgentId === "alex"),
      feedback: monday.outputFeedback.filter((item) => item.agentId === "alex"),
    },
    metrics: {
      channels: channels.length,
      activeLeads: leads.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      activeOpportunities: opportunities.filter((item) => !COMPLETE_STATUSES.has(item.stage)).length,
      partnerships: partnerships.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      weightedPipeline,
      highScoreItems: [...leads, ...opportunities, ...partnerships].filter((item) => number(item.score) >= 65).length,
      feedbackForReview: feedback.filter((item) => item.recommendationStatus === "unreviewed").length,
      relatedMeetings: meetings.length,
      openWorkItems: alexWorkload?.activeItems || 0,
    },
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
}

export function createGrowthLead(db, payload = {}) {
  const score = payload.score !== undefined
    ? clampScore(payload.score)
    : calculateGrowthScore(payload);
  const result = db.prepare(`
    INSERT INTO growth_leads (
      business_entity_id, company_id, client_name, contact_name, organisation_name,
      title, source_channel_id, lead_type, status, priority, estimated_value_gbp,
      probability, score, qualification_notes, recommended_next_step, source_type, source_id, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.businessEntityId || payload.business_entity_id || "group"),
    clean(payload.companyId || payload.company_id) || null,
    clean(payload.clientName || payload.client_name),
    clean(payload.contactName || payload.contact_name),
    clean(payload.organisationName || payload.organisation_name),
    clean(payload.title || "Untitled growth lead"),
    clean(payload.sourceChannelId || payload.source_channel_id || "crm-placeholder"),
    clean(payload.leadType || payload.lead_type || "lead"),
    clean(payload.status || "Research"),
    clean(payload.priority || priorityFromScore(score)),
    number(payload.estimatedValueGbp || payload.estimated_value_gbp),
    clampScore(payload.probability),
    score,
    clean(payload.qualificationNotes || payload.qualification_notes || payload.detail || ""),
    clean(payload.recommendedNextStep || payload.recommended_next_step || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    json(payload.metadata || {}),
  );
  const lead = db.prepare("SELECT * FROM growth_leads WHERE id = ?").get(Number(result.lastInsertRowid));
  recordAlexAudit(db, {
    eventType: "growth_lead_created",
    userAction: payload.userAction || "alex:lead:create",
    recordType: "growth_lead",
    recordId: lead.id,
    dataCategories: ["growth_lead", "local_growth_intelligence"],
    metadata: { score, outboundEnabled: false },
  });
  return mapRow(lead, ["metadata"]);
}

export function createGrowthOpportunity(db, payload = {}) {
  const score = payload.score !== undefined
    ? clampScore(payload.score)
    : calculateGrowthScore(payload);
  const result = db.prepare(`
    INSERT INTO growth_opportunities (
      business_entity_id, company_id, title, detail, target_market, source_channel_id,
      stage, priority, estimated_value_gbp, probability, score, business_impact,
      recommended_action, owner_notes, source_type, source_id, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.businessEntityId || payload.business_entity_id || "group"),
    clean(payload.companyId || payload.company_id) || null,
    clean(payload.title || "Untitled growth opportunity"),
    clean(payload.detail || ""),
    clean(payload.targetMarket || payload.target_market || ""),
    clean(payload.sourceChannelId || payload.source_channel_id || "inbound"),
    clean(payload.stage || "Identified"),
    clean(payload.priority || priorityFromScore(score)),
    number(payload.estimatedValueGbp || payload.estimated_value_gbp),
    clampScore(payload.probability),
    score,
    clean(payload.businessImpact || payload.business_impact || ""),
    clean(payload.recommendedAction || payload.recommended_action || ""),
    clean(payload.ownerNotes || payload.owner_notes || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    json(payload.metadata || {}),
  );
  const opportunity = db.prepare("SELECT * FROM growth_opportunities WHERE id = ?").get(Number(result.lastInsertRowid));
  recordAlexAudit(db, {
    eventType: "growth_opportunity_created",
    userAction: payload.userAction || "alex:opportunity:create",
    recordType: "growth_opportunity",
    recordId: opportunity.id,
    dataCategories: ["growth_opportunity", "local_growth_intelligence"],
    metadata: { score, outboundEnabled: false },
  });
  return mapRow(opportunity, ["metadata"]);
}

export function recordGrowthFeedback(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO growth_feedback (
      related_type, related_id, feedback, rating, recommendation_status,
      lesson_learned, future_work_suggestion, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.relatedType || payload.related_type || "growth_output"),
    String(payload.relatedId || payload.related_id || ""),
    clean(payload.feedback || "Growth feedback captured."),
    clean(payload.rating || "unrated"),
    clean(payload.recommendationStatus || payload.recommendation_status || "unreviewed"),
    clean(payload.lessonLearned || payload.lesson_learned || ""),
    clean(payload.futureWorkSuggestion || payload.future_work_suggestion || ""),
    json(payload.metadata || {}),
  );
  const feedback = db.prepare("SELECT * FROM growth_feedback WHERE id = ?").get(Number(result.lastInsertRowid));
  recordAlexAudit(db, {
    eventType: "growth_feedback_recorded",
    userAction: payload.userAction || "alex:feedback:create",
    recordType: "growth_feedback",
    recordId: feedback.id,
    dataCategories: ["growth_feedback", "local_growth_intelligence"],
  });
  return mapRow(feedback, ["metadata"]);
}

export function generateAlexAnalysis(db, payload = {}) {
  const dashboard = getAlexDashboard(db);
  const topic = clean(payload.topic || "group growth pipeline");
  const topLeads = dashboard.leads.slice(0, 3);
  const topOpportunities = dashboard.opportunities.slice(0, 3);
  const topPartnerships = dashboard.partnerships.slice(0, 2);
  const risks = [
    "Treating unvalidated market signals as qualified pipeline.",
    "Starting outbound activity before Patrick approves positioning, audience and governance.",
    "Weak CRM hygiene once a real CRM is connected unless read/write boundaries are explicit.",
  ];
  const analysis = {
    specialist: { id: "alex", name: "Alex", role: "Growth Director", reportsTo: "Alfred" },
    topic,
    executiveSummary: `Alex recommends focusing growth review on ${topOpportunities[0]?.title || "the highest-scoring opportunity"} while keeping all activity advisory-only until Patrick approves any external contact.`,
    pipelineSummary: {
      weightedPipeline: dashboard.metrics.weightedPipeline,
      activeLeads: dashboard.metrics.activeLeads,
      activeOpportunities: dashboard.metrics.activeOpportunities,
      partnerships: dashboard.metrics.partnerships,
    },
    topPriorities: [
      ...topOpportunities.map((item) => ({
        title: item.title,
        detail: item.businessImpact || item.detail,
        sourceReference: sourceReference("growth_opportunity", item.id),
      })),
      ...topLeads.map((item) => ({
        title: item.title,
        detail: item.qualificationNotes || item.recommendedNextStep,
        sourceReference: sourceReference("growth_lead", item.id),
      })),
    ].slice(0, 5),
    partnerships: topPartnerships.map((item) => ({
      title: item.partnerName,
      detail: item.strategicValue || item.recommendedNextStep,
      sourceReference: sourceReference("growth_partnership", item.id),
    })),
    risks,
    decisionsRequired: [
      "Approve which growth lane deserves Patrick's time this week.",
      "Confirm whether Alex should prepare an internal outreach brief for review, without sending anything.",
      "Decide the minimum qualification criteria before any future CRM or outbound integration.",
    ],
    recommendedNextActions: [
      "Review the top-scoring opportunity and confirm the target outcome.",
      "Turn the highest-value lead into an internal qualification note only.",
      "Capture feedback after Patrick review so Alex can improve future scoring.",
    ],
    confidenceLevel: "medium",
    assumptions: [
      "No outbound messages, CRM updates or external growth actions were executed.",
      "Scores are local prioritisation heuristics, not confirmed revenue forecasts.",
      "CRM intelligence is a placeholder until a read-only CRM connector is explicitly configured.",
    ],
    sourceRecordReferences: [
      ...topOpportunities.map((item) => sourceReference("growth_opportunity", item.id)),
      ...topLeads.map((item) => sourceReference("growth_lead", item.id)),
      ...topPartnerships.map((item) => sourceReference("growth_partnership", item.id)),
    ],
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
  const auditId = recordAlexAudit(db, {
    eventType: "growth_analysis",
    userAction: payload.userAction || "alex:analyse-growth",
    recordType: "growth_analysis",
    dataCategories: ["growth_leads", "growth_opportunities", "growth_partnerships", "meeting_intelligence", "monday_operating_system", "semantic_memory"],
    model: "alex-deterministic-v1",
    metadata: { topic, recordsReviewed: analysis.sourceRecordReferences.length },
  });
  return { ...analysis, auditId, model: "alex-deterministic-v1" };
}

export function alexBriefingForDaily(db) {
  const dashboard = getAlexDashboard(db);
  const items = [
    ...dashboard.opportunities.filter((item) => number(item.score) >= 60).slice(0, 3).map((item) => ({
      title: item.title,
      detail: item.businessImpact || item.recommendedAction || item.detail,
      priority: number(item.score) >= 75 ? "high" : "medium",
      sourceReference: sourceReference("growth_opportunity", item.id),
    })),
    ...dashboard.leads.filter((item) => number(item.score) >= 60).slice(0, 3).map((item) => ({
      title: item.title,
      detail: item.qualificationNotes || item.recommendedNextStep,
      priority: number(item.score) >= 75 ? "high" : "medium",
      sourceReference: sourceReference("growth_lead", item.id),
    })),
    ...dashboard.feedback.filter((item) => item.recommendationStatus === "unreviewed").slice(0, 2).map((item) => ({
      title: "Growth feedback needs review",
      detail: item.feedback || item.futureWorkSuggestion,
      priority: item.rating === "negative" ? "high" : "medium",
      sourceReference: sourceReference("growth_feedback", item.id),
    })),
  ].slice(0, 6);
  return {
    title: "Alex Growth Brief",
    summary: items.length
      ? `${items.length} Alex growth signal(s) need review. No outbound messages, CRM updates or external growth actions occurred.`
      : "No Alex growth exceptions detected from current records.",
    metrics: dashboard.metrics,
    items,
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
}

export function searchAlexKnowledge(db, query = "") {
  const normalizedQuery = clean(query).toLowerCase();
  if (!normalizedQuery) {
    return {
      query: "",
      leads: [],
      opportunities: [],
      partnerships: [],
      strategies: [],
      feedback: [],
      boundary: ALEX_READ_ONLY_BOUNDARY,
    };
  }
  const terms = [...new Set([normalizedQuery, ...normalizedQuery.split(/\s+/).filter((part) => part.length > 2)])].map((term) => `%${term}%`);
  const search = (sqlPrefix, fields, orderBy, mapper) => {
    const clauses = [];
    const params = [];
    for (const field of fields) {
      for (const term of terms) {
        clauses.push(`LOWER(COALESCE(${field}, '')) LIKE ?`);
        params.push(term);
      }
    }
    return db.prepare(`${sqlPrefix} WHERE ${clauses.join(" OR ")} ${orderBy}`).all(...params).map(mapper);
  };
  return {
    query: clean(query),
    leads: search(`
      SELECT l.*, c.name AS channel_name
      FROM growth_leads l
      LEFT JOIN growth_channels c ON c.id = l.source_channel_id
    `, ["l.title", "l.client_name", "l.organisation_name", "l.qualification_notes", "l.recommended_next_step", "c.name"], `
      ORDER BY l.score DESC, l.updated_at DESC, l.id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    opportunities: search(`
      SELECT o.*, c.name AS channel_name
      FROM growth_opportunities o
      LEFT JOIN growth_channels c ON c.id = o.source_channel_id
    `, ["o.title", "o.detail", "o.target_market", "o.business_impact", "o.recommended_action", "c.name"], `
      ORDER BY o.score DESC, o.updated_at DESC, o.id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    partnerships: search(`
      SELECT *
      FROM growth_partnerships
    `, ["partner_name", "partner_type", "strategic_value", "recommended_next_step"], `
      ORDER BY score DESC, updated_at DESC, id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    strategies: search(`
      SELECT *
      FROM growth_strategies
    `, ["title", "focus_area", "summary", "target_outcome"], `
      ORDER BY updated_at DESC, id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    feedback: search(`
      SELECT *
      FROM growth_feedback
    `, ["feedback", "lesson_learned", "future_work_suggestion"], `
      ORDER BY updated_at DESC, id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    sourceReferences: ["growth_lead", "growth_opportunity", "growth_partnership", "growth_strategy", "growth_feedback", "monday_operating_system", "meeting_intelligence"],
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
}

export function alexSemanticRecords(db) {
  const rows = [
    ...listGrowthLeads(db, 200).map((row) => ({
      sourceType: "growth_lead",
      sourceId: row.id,
      title: row.title,
      summary: `Growth lead: ${row.title}. Organisation: ${row.organisationName || row.clientName}. Status: ${row.status}. Score: ${row.score}. Probability: ${row.probability}%. ${row.qualificationNotes} Recommended next step: ${row.recommendedNextStep}. No outbound message or CRM write occurred.`,
      sourceCreatedAt: row.updatedAt || row.createdAt,
    })),
    ...listGrowthOpportunities(db, 200).map((row) => ({
      sourceType: "growth_opportunity",
      sourceId: row.id,
      title: row.title,
      summary: `Growth opportunity: ${row.title}. Market: ${row.targetMarket}. Stage: ${row.stage}. Score: ${row.score}. ${row.detail} Impact: ${row.businessImpact}. Recommended action: ${row.recommendedAction}. No outbound message or CRM write occurred.`,
      sourceCreatedAt: row.updatedAt || row.createdAt,
    })),
    ...listGrowthPartnerships(db, 200).map((row) => ({
      sourceType: "growth_partnership",
      sourceId: row.id,
      title: row.partnerName,
      summary: `Growth partnership: ${row.partnerName}. Type: ${row.partnerType}. Status: ${row.status}. Score: ${row.score}. ${row.strategicValue} Recommended next step: ${row.recommendedNextStep}. No outbound message or CRM write occurred.`,
      sourceCreatedAt: row.updatedAt || row.createdAt,
    })),
    ...listGrowthStrategies(db, 100).map((row) => ({
      sourceType: "growth_strategy",
      sourceId: row.id,
      title: row.title,
      summary: `Growth strategy: ${row.title}. Focus: ${row.focusArea}. Status: ${row.status}. ${row.summary} Target outcome: ${row.targetOutcome}.`,
      sourceCreatedAt: row.updatedAt || row.createdAt,
    })),
    ...listGrowthFeedback(db, 100).map((row) => ({
      sourceType: "growth_feedback",
      sourceId: row.id,
      title: `Growth feedback ${row.id}`,
      summary: `Growth feedback: ${row.feedback}. Rating: ${row.rating}. Recommendation status: ${row.recommendationStatus}. ${row.lessonLearned} ${row.futureWorkSuggestion}`,
      sourceCreatedAt: row.updatedAt || row.createdAt,
    })),
  ];
  return rows.map((record) => ({
    ...record,
    sourceId: String(record.sourceId),
    sourceCreatedAt: record.sourceCreatedAt || new Date().toISOString(),
    summary: clean(record.summary).slice(0, 2400),
    sensitivityCategory: "local_sensitive_business_data",
  }));
}

export function alexRelevantMemory(db, query = "growth") {
  const term = clean(query).toLowerCase();
  return listSemanticSourceRecords(db)
    .filter((record) => `${record.title || ""} ${record.summary || ""}`.toLowerCase().includes(term))
    .slice(0, 8)
    .map((record) => ({
      sourceReference: `${record.sourceType}:${record.sourceId}`,
      summary: record.summary,
      sensitivityLabel: record.sensitivityCategory,
    }));
}

export function alexExecutiveContext(db) {
  const dashboard = getAlexDashboard(db);
  const base = getDashboardData(db);
  return {
    profile: dashboard.profile,
    metrics: dashboard.metrics,
    topLeads: dashboard.leads.slice(0, 5),
    topOpportunities: dashboard.opportunities.slice(0, 5),
    partnerships: dashboard.partnerships.slice(0, 5),
    strategies: dashboard.strategies.slice(0, 5),
    relatedCompanyOpportunities: base.opportunities.slice(0, 5),
    relevantMemory: alexRelevantMemory(db, "growth"),
    boundary: ALEX_READ_ONLY_BOUNDARY,
  };
}
