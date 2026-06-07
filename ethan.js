import { listSemanticSourceRecords } from "./db.js";
import { getMondayOperatingDashboard, mondayOperatingCollection } from "./monday-operating-system.js";

export const ETHAN_READ_ONLY_BOUNDARY = Object.freeze({
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  repoWriteEnabled: false,
  deploymentEnabled: false,
  cloudChangeEnabled: false,
  infrastructureWriteEnabled: false,
  configurationChangeEnabled: false,
  secretWriteEnabled: false,
  microsoftWritePermissions: false,
  mondayWriteEnabled: false,
  externalWritesEnabled: false,
  approvalRequiredForFutureWrites: true,
});

export const ETHAN_DOMAINS = Object.freeze([
  "Architecture",
  "Cloud Operations",
  "DevOps",
  "Release Governance",
  "Engineering Quality",
  "Technical Debt",
  "Security Implementation",
  "Data Platform",
  "AI Platform",
]);

const COMPLETE_STATUSES = new Set(["Complete", "Rejected", "Closed", "Resolved"]);

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function safeJsonParse(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
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
    jsonFields.includes(key) ? safeJsonParse(value, Array.isArray(value) ? [] : {}) : value,
  ]));
}

function mapRows(rows, jsonFields = []) {
  return rows.map((row) => mapRow(row, jsonFields));
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function sourceReference(type, id) {
  return `${type}:${id}`;
}

function priorityRank(value = "") {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[clean(value)] ?? 4;
}

function severityRank(value = "") {
  return { Critical: 0, High: 1, Medium: 2, Low: 3 }[clean(value)] ?? 4;
}

function recordExists(db, table, sourceType, sourceId) {
  return db.prepare(`
    SELECT id FROM ${table}
    WHERE source_type = ? AND source_id = ?
  `).get(String(sourceType), String(sourceId));
}

export function recordEthanAudit(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO ethan_audit_events (
      event_type, user_action, record_type, record_id, data_categories,
      output_saved, model, execution_attempted, external_write_attempted,
      status, error_code, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
  `).run(
    clean(payload.eventType || "ethan_event"),
    clean(payload.userAction || "ethan:system"),
    clean(payload.recordType || ""),
    clean(payload.recordId || ""),
    json([...new Set((payload.dataCategories || []).map(String).filter(Boolean))]),
    payload.outputSaved === false ? 0 : 1,
    clean(payload.model || "ethan-deterministic-v1"),
    clean(payload.status || "success") || "success",
    clean(payload.errorCode || ""),
    json({ ...(payload.metadata || {}), boundary: ETHAN_READ_ONLY_BOUNDARY }),
  );
  return Number(result.lastInsertRowid);
}

export function listEthanAudit(db, limit = 50) {
  return mapRows(db.prepare(`
    SELECT *
    FROM ethan_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)), ["data_categories", "metadata"]);
}

export function getEthanProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'ethan'").get();
  return row
    ? mapRow(row, ["tools"])
    : {
        id: "ethan",
        name: "Ethan",
        role: "Chief Technology Officer",
        department: "Technology",
        status: "Active",
        tools: ETHAN_DOMAINS,
      };
}

export function listTechnologyDomains(db) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_domains
    ORDER BY name ASC
  `).all());
}

export function listTechnologySystems(db, limit = 100) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_systems
    ORDER BY
      CASE criticality WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 300)), ["metadata"]);
}

export function listTechnologyRisks(db, limit = 100) {
  return mapRows(db.prepare(`
    SELECT r.*, s.name AS system_name
    FROM technology_risks r
    LEFT JOIN technology_systems s ON s.id = r.system_id
    ORDER BY
      CASE r.severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      r.updated_at DESC,
      r.id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 300)), ["metadata"]);
}

export function listTechnologyDecisions(db, limit = 100) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_decisions
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 300)), ["metadata"]);
}

export function listTechnologyRoadmap(db, limit = 100) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_roadmap_items
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 300)), ["metadata"]);
}

export function listTechnologyDebt(db, limit = 100) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_debt_items
    ORDER BY
      CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 300)), ["metadata"]);
}

export function listTechnologyReviews(db, limit = 50) {
  return mapRows(db.prepare(`
    SELECT *
    FROM technology_reviews
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)), ["recommendations", "risks", "source_references"]);
}

function technologyMeetings(db) {
  return db.prepare(`
    SELECT *
    FROM meeting_records
    ORDER BY start_datetime DESC, id DESC
    LIMIT 100
  `).all().map((row) => mapRow(row, ["assumptions", "metadata"])).filter((meeting) => {
    const text = `${meeting.title || ""} ${meeting.bodyPreview || ""} ${meeting.projectName || ""}`.toLowerCase();
    return meeting.relatedAgent === "ethan" || /(architecture|platform|hosting|deployment|devops|technical debt|release|engineering|github|ci|database|backup|restore|pwa)/.test(text);
  });
}

export function ensureEthanMondayIntegration(db) {
  for (const risk of listTechnologyRisks(db, 100).filter((item) => !COMPLETE_STATUSES.has(item.status))) {
    if (!recordExists(db, "work_items", "technology_risk", risk.id)) {
      mondayOperatingCollection(db, "work-items", {
        title: risk.title,
        detail: risk.recommendedAction || risk.detail,
        itemType: "technology_risk",
        ownerAgentId: "ethan",
        businessEntityId: "group",
        priority: risk.severity,
        status: "New",
        sourceType: "technology_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("technology_risk", risk.id),
        metadata: { systemName: risk.systemName },
        userAction: "ethan:monday-sync",
      });
    }
    if (!recordExists(db, "operational_risks", "technology_risk", risk.id)) {
      mondayOperatingCollection(db, "risks", {
        title: risk.title,
        detail: risk.detail,
        ownerAgentId: "ethan",
        businessEntityId: "group",
        businessImpact: risk.businessImpact,
        priority: risk.severity,
        status: "New",
        recommendedAction: risk.recommendedAction,
        sourceType: "technology_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("technology_risk", risk.id),
        userAction: "ethan:monday-sync",
      });
    }
  }

  for (const decision of listTechnologyDecisions(db, 100).filter((item) => !COMPLETE_STATUSES.has(item.status))) {
    if (!recordExists(db, "operational_decisions", "technology_decision", decision.id)) {
      mondayOperatingCollection(db, "decisions", {
        title: decision.title,
        detail: decision.detail,
        ownerAgentId: "ethan",
        businessEntityId: "group",
        approvalRequired: Boolean(decision.approvalRequired),
        priority: decision.priority,
        status: "New",
        sourceType: "technology_decision",
        sourceId: decision.id,
        sourceReference: sourceReference("technology_decision", decision.id),
        userAction: "ethan:monday-sync",
      });
    }
  }

  for (const item of listTechnologyRoadmap(db, 100).filter((record) => !COMPLETE_STATUSES.has(record.status))) {
    if (!recordExists(db, "deliverables", "technology_roadmap", item.id)) {
      mondayOperatingCollection(db, "deliverables", {
        title: item.title,
        detail: item.detail,
        ownerAgentId: "ethan",
        businessEntityId: "group",
        status: "Planned",
        priority: item.priority,
        linkedMemoryReference: sourceReference("technology_roadmap", item.id),
        sourceType: "technology_roadmap",
        sourceId: item.id,
        sourceReference: sourceReference("technology_roadmap", item.id),
        userAction: "ethan:monday-sync",
      });
    }
  }
}

export function getEthanDashboard(db) {
  ensureEthanMondayIntegration(db);
  const systems = listTechnologySystems(db);
  const risks = listTechnologyRisks(db);
  const decisions = listTechnologyDecisions(db);
  const roadmap = listTechnologyRoadmap(db);
  const debt = listTechnologyDebt(db);
  const reviews = listTechnologyReviews(db);
  const meetings = technologyMeetings(db);
  const monday = getMondayOperatingDashboard(db);
  const workload = monday.agentWorkloads.find((item) => item.agentId === "ethan") || null;
  const openRisks = risks.filter((item) => !COMPLETE_STATUSES.has(item.status));
  const openDebt = debt.filter((item) => !COMPLETE_STATUSES.has(item.status));
  return {
    profile: getEthanProfile(db),
    boundary: ETHAN_READ_ONLY_BOUNDARY,
    domains: listTechnologyDomains(db),
    systems,
    risks,
    decisions,
    roadmap,
    debt,
    reviews,
    meetings,
    monday: {
      workload,
      workItems: monday.workItems.filter((item) => item.ownerAgentId === "ethan"),
      deliverables: monday.deliverables.filter((item) => item.ownerAgentId === "ethan"),
      risks: monday.operationalRisks.filter((item) => item.ownerAgentId === "ethan"),
      decisions: monday.operationalDecisions.filter((item) => item.ownerAgentId === "ethan"),
    },
    metrics: {
      systems: systems.length,
      highCriticalSystems: systems.filter((item) => ["High", "Critical"].includes(item.criticality)).length,
      openRisks: openRisks.length,
      highRisks: openRisks.filter((item) => ["High", "Critical"].includes(item.severity)).length,
      decisionsRequired: decisions.filter((item) => !COMPLETE_STATUSES.has(item.status) && item.approvalRequired).length,
      roadmapItems: roadmap.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      technologyDebt: openDebt.length,
      highDebt: openDebt.filter((item) => ["High", "Critical"].includes(item.severity)).length,
      relatedMeetings: meetings.length,
      openWorkItems: workload?.activeItems || 0,
    },
  };
}

export function createTechnologyRisk(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO technology_risks (
      system_id, title, detail, severity, status, business_impact,
      recommended_action, source_type, source_id, source_reference, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.systemId || payload.system_id || null,
    clean(payload.title || "Untitled technology risk"),
    clean(payload.detail || ""),
    clean(payload.severity || "Medium"),
    clean(payload.status || "Open"),
    clean(payload.businessImpact || payload.business_impact || ""),
    clean(payload.recommendedAction || payload.recommended_action || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    clean(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || ""),
    json(payload.metadata || {}),
  );
  const risk = mapRow(db.prepare("SELECT * FROM technology_risks WHERE id = ?").get(Number(result.lastInsertRowid)), ["metadata"]);
  recordEthanAudit(db, {
    eventType: "technology_risk_created",
    userAction: payload.userAction || "ethan:risk:create",
    recordType: "technology_risk",
    recordId: risk.id,
    dataCategories: ["technology_risk", "local_technology_intelligence"],
  });
  return risk;
}

export function createTechnologyDecision(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO technology_decisions (
      title, detail, decision_area, priority, status, approval_required,
      source_type, source_id, source_reference, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || "Untitled technology decision"),
    clean(payload.detail || ""),
    clean(payload.decisionArea || payload.decision_area || "Architecture"),
    clean(payload.priority || "Medium"),
    clean(payload.status || "Open"),
    payload.approvalRequired === false || payload.approval_required === 0 ? 0 : 1,
    clean(payload.sourceType || payload.source_type || "manual"),
    clean(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || ""),
    json(payload.metadata || {}),
  );
  const decision = mapRow(db.prepare("SELECT * FROM technology_decisions WHERE id = ?").get(Number(result.lastInsertRowid)), ["metadata"]);
  recordEthanAudit(db, {
    eventType: "technology_decision_created",
    userAction: payload.userAction || "ethan:decision:create",
    recordType: "technology_decision",
    recordId: decision.id,
    dataCategories: ["technology_decision", "local_technology_intelligence"],
  });
  return decision;
}

export function createTechnologyRoadmapItem(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO technology_roadmap_items (
      title, detail, roadmap_area, priority, status, target_quarter,
      source_type, source_id, source_reference, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || "Untitled technology roadmap item"),
    clean(payload.detail || ""),
    clean(payload.roadmapArea || payload.roadmap_area || "Platform"),
    clean(payload.priority || "Medium"),
    clean(payload.status || "Planned"),
    clean(payload.targetQuarter || payload.target_quarter || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    clean(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || ""),
    json(payload.metadata || {}),
  );
  const item = mapRow(db.prepare("SELECT * FROM technology_roadmap_items WHERE id = ?").get(Number(result.lastInsertRowid)), ["metadata"]);
  recordEthanAudit(db, {
    eventType: "technology_roadmap_created",
    userAction: payload.userAction || "ethan:roadmap:create",
    recordType: "technology_roadmap",
    recordId: item.id,
    dataCategories: ["technology_roadmap", "local_technology_intelligence"],
  });
  return item;
}

export function generateEthanAnalysis(db, payload = {}) {
  const dashboard = getEthanDashboard(db);
  const topic = clean(payload.topic || "Alfred technology platform");
  const topRisks = [...dashboard.risks].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 4);
  const topRoadmap = [...dashboard.roadmap].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 4);
  const topDebt = [...dashboard.debt].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 3);
  const decisions = dashboard.decisions.filter((item) => !COMPLETE_STATUSES.has(item.status)).slice(0, 4);
  const analysis = {
    specialist: { id: "ethan", name: "Ethan", role: "Chief Technology Officer", reportsTo: "Alfred" },
    topic,
    executiveSummary: `Ethan recommends treating ${topRisks[0]?.title || "production readiness"} as the main CTO attention point while keeping all technical work advisory until Patrick approves a delivery path.`,
    platformSummary: {
      systems: dashboard.metrics.systems,
      highRisks: dashboard.metrics.highRisks,
      decisionsRequired: dashboard.metrics.decisionsRequired,
      roadmapItems: dashboard.metrics.roadmapItems,
      technologyDebt: dashboard.metrics.technologyDebt,
    },
    topPriorities: [
      ...topRisks.map((item) => ({
        title: item.title,
        detail: item.businessImpact || item.detail,
        priority: item.severity,
        sourceReference: sourceReference("technology_risk", item.id),
      })),
      ...topRoadmap.slice(0, 2).map((item) => ({
        title: item.title,
        detail: item.detail,
        priority: item.priority,
        sourceReference: sourceReference("technology_roadmap", item.id),
      })),
    ],
    decisionsRequired: decisions.map((item) => ({
      title: item.title,
      detail: item.detail,
      sourceReference: sourceReference("technology_decision", item.id),
      approvalRequired: Boolean(item.approvalRequired),
    })),
    risks: topRisks.map((item) => `${item.title}: ${item.recommendedAction || item.detail}`),
    technicalDebt: topDebt.map((item) => ({
      title: item.title,
      detail: item.recommendedAction || item.detail,
      sourceReference: sourceReference("technology_debt", item.id),
    })),
    recommendedNextActions: [
      "Confirm the first production-readiness decision Patrick wants to review.",
      "Turn the top technology risk into an internal mitigation plan only.",
      "Keep CI, syntax checks, browser verification and security boundary checks as merge requirements.",
      "Do not deploy, edit infrastructure, change repo settings or update external systems from this analysis.",
    ],
    assumptions: [
      "Ethan reviewed local Alfred technology records and internal Monday OS context only.",
      "No repository write, deployment, cloud change, configuration edit or external action was executed.",
      "Live infrastructure telemetry is not connected; current findings are based on seeded and local operating records.",
    ],
    confidenceLevel: dashboard.metrics.systems ? "medium" : "low",
    boundary: ETHAN_READ_ONLY_BOUNDARY,
    sourceRecordReferences: [
      ...topRisks.map((item) => sourceReference("technology_risk", item.id)),
      ...topRoadmap.map((item) => sourceReference("technology_roadmap", item.id)),
      ...decisions.map((item) => sourceReference("technology_decision", item.id)),
      ...topDebt.map((item) => sourceReference("technology_debt", item.id)),
    ],
  };
  const review = db.prepare(`
    INSERT INTO technology_reviews (
      review_type, title, summary, recommendations, risks, source_references, model, output_saved
    )
    VALUES ('cto_analysis', ?, ?, ?, ?, ?, 'ethan-deterministic-v1', 1)
  `).run(
    topic,
    analysis.executiveSummary,
    json(analysis.recommendedNextActions),
    json(analysis.risks),
    json(analysis.sourceRecordReferences),
  );
  const auditId = recordEthanAudit(db, {
    eventType: "technology_analysis",
    userAction: payload.userAction || "ethan:analyse-technology",
    recordType: "technology_review",
    recordId: Number(review.lastInsertRowid),
    dataCategories: ["technology_systems", "technology_risks", "technology_decisions", "technology_roadmap", "technology_debt", "monday_operating_system", "semantic_memory"],
    model: "ethan-deterministic-v1",
  });
  return { ...analysis, auditId, reviewId: Number(review.lastInsertRowid), model: "ethan-deterministic-v1" };
}

export function ethanBriefingForDaily(db) {
  const dashboard = getEthanDashboard(db);
  const items = [
    ...dashboard.risks.filter((item) => ["High", "Critical"].includes(item.severity) && !COMPLETE_STATUSES.has(item.status)).slice(0, 4).map((item) => ({
      title: item.title,
      detail: item.recommendedAction || item.detail,
      priority: item.severity === "Critical" ? "critical" : "high",
      sourceReference: sourceReference("technology_risk", item.id),
    })),
    ...dashboard.decisions.filter((item) => item.approvalRequired && !COMPLETE_STATUSES.has(item.status)).slice(0, 3).map((item) => ({
      title: item.title,
      detail: item.detail,
      priority: item.priority?.toLowerCase?.() || "medium",
      sourceReference: sourceReference("technology_decision", item.id),
    })),
    ...dashboard.roadmap.filter((item) => item.priority === "High" && !COMPLETE_STATUSES.has(item.status)).slice(0, 2).map((item) => ({
      title: item.title,
      detail: item.detail,
      priority: "medium",
      sourceReference: sourceReference("technology_roadmap", item.id),
    })),
  ];
  return {
    title: "Ethan CTO Brief",
    summary: items.length
      ? `${items.length} Ethan technology signal(s) need review. No deployments, repo writes, cloud changes, configuration changes or external technical actions occurred.`
      : "No Ethan CTO exceptions detected from current records.",
    items,
    metrics: dashboard.metrics,
    boundary: ETHAN_READ_ONLY_BOUNDARY,
  };
}

function searchableText(record) {
  return Object.values(record || {}).filter((value) => typeof value !== "object").join(" ").toLowerCase();
}

function matchesQuery(record, query) {
  const text = searchableText(record);
  const terms = clean(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  return terms.some((term) => text.includes(term));
}

export function searchEthanKnowledge(db, query = "") {
  const systems = listTechnologySystems(db, 300).filter((item) => matchesQuery(item, query));
  const risks = listTechnologyRisks(db, 300).filter((item) => matchesQuery(item, query));
  const decisions = listTechnologyDecisions(db, 300).filter((item) => matchesQuery(item, query));
  const roadmap = listTechnologyRoadmap(db, 300).filter((item) => matchesQuery(item, query));
  const debt = listTechnologyDebt(db, 300).filter((item) => matchesQuery(item, query));
  return {
    query,
    systems,
    risks,
    decisions,
    roadmap,
    debt,
    sourceReferences: ["technology_system", "technology_risk", "technology_decision", "technology_roadmap", "technology_debt", "monday_operating_system", "meeting_intelligence"],
    boundary: ETHAN_READ_ONLY_BOUNDARY,
  };
}

export function ethanRelevantMemory(db, query = "technology") {
  const terms = clean(query).toLowerCase().split(/\s+/).filter(Boolean);
  return listSemanticSourceRecords(db)
    .filter((record) => String(record.sourceType).startsWith("technology_") || terms.some((term) => `${record.title || ""} ${record.summary || ""}`.toLowerCase().includes(term)))
    .slice(0, 8)
    .map((record) => ({
      sourceReference: `${record.sourceType}:${record.sourceId}`,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      summary: record.summary,
      sensitivityLabel: record.sensitivityCategory,
    }));
}

export function ethanExecutiveContext(db) {
  const dashboard = getEthanDashboard(db);
  return {
    systems: dashboard.systems.slice(0, 8),
    risks: dashboard.risks.slice(0, 8),
    decisions: dashboard.decisions.slice(0, 6),
    roadmap: dashboard.roadmap.slice(0, 6),
    debt: dashboard.debt.slice(0, 6),
    metrics: dashboard.metrics,
    relevantMemory: ethanRelevantMemory(db, "technology architecture platform release"),
    boundary: ETHAN_READ_ONLY_BOUNDARY,
  };
}
