import { listSemanticSourceRecords } from "./db.js";
import {
  calculateAgentWorkloads,
  createDeliverable,
  createOperationalDecision,
  createOperationalOpportunity,
  createOperationalRisk,
  createWorkItem,
  getMondayOperatingDashboard,
} from "./monday-operating-system.js";

export const LIAM_READ_ONLY_BOUNDARY = Object.freeze({
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  microsoftWritePermissions: false,
  powerAppsCreationEnabled: false,
  powerAutomateFlowCreationEnabled: false,
  dataverseWriteEnabled: false,
  powerBiPublishEnabled: false,
  sharePointWriteEnabled: false,
  tenantAdminEnabled: false,
  environmentCreationEnabled: false,
  connectorCreationEnabled: false,
  externalWritesEnabled: false,
});

export const LIAM_DOMAINS = Object.freeze([
  { id: "power_apps", label: "Power Apps", focus: ["App strategy", "Canvas/model-driven fit", "User journeys", "Governance"] },
  { id: "dataverse", label: "Dataverse", focus: ["Data model", "Ownership", "Security roles", "Retention"] },
  { id: "power_automate", label: "Power Automate", focus: ["Workflow design", "Approval gates", "Execution controls", "Auditability"] },
  { id: "power_bi", label: "Power BI", focus: ["Reporting model", "KPI definitions", "Data quality", "Board/client packs"] },
  { id: "sharepoint", label: "SharePoint", focus: ["Information architecture", "Permissions", "Evidence libraries", "Metadata"] },
  { id: "governance", label: "Low-code Governance", focus: ["ALM", "Licensing", "Environments", "Support model"] },
]);

const MODEL = "liam-deterministic-v1";
const COMPLETE_STATUSES = new Set(["closed", "complete", "rejected", "done"]);

function clean(value = "") {
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

function severityRank(value = "") {
  return { high: 0, medium: 1, low: 2 }[String(value).toLowerCase()] ?? 3;
}

function priorityRank(value = "") {
  return { critical: 0, high: 1, medium: 2, low: 3 }[String(value).toLowerCase()] ?? 4;
}

function sourceReference(type, id) {
  return `${type}:${id}`;
}

function recordExists(db, table, sourceType, sourceId) {
  return Boolean(db.prepare(`
    SELECT id FROM ${table}
    WHERE source_type = ? AND source_id = ?
    LIMIT 1
  `).get(sourceType, String(sourceId)));
}

export function recordLiamAudit(db, {
  eventType,
  userAction = "",
  dataCategories = [],
  outputSaved = false,
  model = MODEL,
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO liam_audit_events (
      event_type, user_action, data_categories, output_saved, model, status,
      error_code, execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    clean(eventType || "liam_event"),
    clean(userAction),
    JSON.stringify([...new Set((dataCategories || []).map(String).filter(Boolean))]),
    outputSaved ? 1 : 0,
    clean(model),
    status === "error" ? "error" : "success",
    clean(errorCode).slice(0, 200),
    JSON.stringify({ ...metadata, boundary: LIAM_READ_ONLY_BOUNDARY }),
  );
  return Number(result.lastInsertRowid);
}

export function listLiamAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM liam_audit_events
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    ...mapRow(row, ["data_categories"]),
    dataCategories: safeJsonParse(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    metadata: safeJsonParse(row.metadata, {}),
  }));
}

export function getLiamProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'liam'").get();
  return row ? {
    ...mapRow(row, ["tools"]),
    reportsTo: "Alfred",
    boundary: LIAM_READ_ONLY_BOUNDARY,
  } : null;
}

export function listPowerPlatformSolutions(db) {
  return db.prepare(`
    SELECT
      s.*,
      p.project_name,
      p.client_name AS project_client_name,
      (
        SELECT COUNT(*)
        FROM power_platform_components c
        WHERE c.solution_id = s.id
      ) AS component_count,
      (
        SELECT COUNT(*)
        FROM power_platform_risks r
        WHERE r.solution_id = s.id AND lower(r.status) NOT IN ('closed', 'complete', 'rejected')
      ) AS open_risk_count
    FROM power_platform_solutions s
    LEFT JOIN project_profiles p ON p.id = s.project_profile_id
    ORDER BY
      CASE lower(s.status) WHEN 'discovery' THEN 1 WHEN 'proposed' THEN 2 WHEN 'planned' THEN 3 ELSE 4 END,
      s.updated_at DESC,
      s.id DESC
  `).all().map((row) => mapRow(row));
}

export function listPowerPlatformComponents(db) {
  return db.prepare(`
    SELECT c.*, s.name AS solution_name, s.platform_area
    FROM power_platform_components c
    LEFT JOIN power_platform_solutions s ON s.id = c.solution_id
    ORDER BY s.name ASC, c.component_type ASC, c.name ASC
  `).all().map((row) => mapRow(row));
}

export function listPowerPlatformRisks(db) {
  return db.prepare(`
    SELECT r.*, s.name AS solution_name, s.platform_area
    FROM power_platform_risks r
    LEFT JOIN power_platform_solutions s ON s.id = r.solution_id
    ORDER BY
      CASE r.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      r.updated_at DESC,
      r.id DESC
  `).all().map((row) => mapRow(row));
}

export function listPowerPlatformOpportunities(db) {
  return db.prepare(`
    SELECT o.*, s.name AS solution_name, s.platform_area
    FROM power_platform_opportunities o
    LEFT JOIN power_platform_solutions s ON s.id = o.solution_id
    ORDER BY
      CASE lower(o.priority) WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      o.updated_at DESC,
      o.id DESC
  `).all().map((row) => mapRow(row));
}

export function listPowerPlatformDecisions(db) {
  return db.prepare(`
    SELECT d.*, s.name AS solution_name, s.platform_area
    FROM power_platform_decisions d
    LEFT JOIN power_platform_solutions s ON s.id = d.solution_id
    ORDER BY
      d.approval_required DESC,
      CASE lower(d.priority) WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      d.updated_at DESC,
      d.id DESC
  `).all().map((row) => ({
    ...mapRow(row),
    approvalRequired: Boolean(row.approval_required),
  }));
}

export function listPowerPlatformReviews(db, limit = 20) {
  return db.prepare(`
    SELECT *
    FROM power_platform_reviews
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 20, 1), 100)).map((row) => ({
    ...mapRow(row, ["recommendations", "risks", "opportunities", "source_references"]),
    recommendations: safeJsonParse(row.recommendations, []),
    risks: safeJsonParse(row.risks, []),
    opportunities: safeJsonParse(row.opportunities, []),
    sourceReferences: safeJsonParse(row.source_references, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
  }));
}

function active(records) {
  return (records || []).filter((record) => !COMPLETE_STATUSES.has(String(record.status || "").toLowerCase()));
}

function liamMetrics({ solutions, components, risks, opportunities, decisions }) {
  const activeRisks = active(risks);
  const activeOpportunities = active(opportunities);
  const activeDecisions = active(decisions);
  return {
    solutions: solutions.length,
    components: components.length,
    highRisks: activeRisks.filter((risk) => risk.severity === "high").length,
    openRisks: activeRisks.length,
    openOpportunities: activeOpportunities.length,
    decisionsRequired: activeDecisions.filter((decision) => decision.approvalRequired).length,
    advisoryOnly: true,
  };
}

export function ensureLiamMondayIntegration(db) {
  const risks = listPowerPlatformRisks(db).filter((risk) => !COMPLETE_STATUSES.has(String(risk.status).toLowerCase()));
  const decisions = listPowerPlatformDecisions(db).filter((decision) => !COMPLETE_STATUSES.has(String(decision.status).toLowerCase()));
  const opportunities = listPowerPlatformOpportunities(db).filter((opportunity) => !COMPLETE_STATUSES.has(String(opportunity.status).toLowerCase()));

  for (const risk of risks) {
    if (!recordExists(db, "work_items", "power_platform_risk", risk.id)) {
      createWorkItem(db, {
        title: risk.title,
        detail: risk.detail,
        itemType: "power_platform_risk_review",
        ownerAgentId: "liam",
        businessEntityId: "digitize",
        companyId: "digitize",
        projectName: risk.solutionName || "",
        clientName: "",
        priority: risk.severity === "high" ? "High" : "Medium",
        status: "New",
        sourceType: "power_platform_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("power_platform_risk", risk.id),
        metadata: { boundary: LIAM_READ_ONLY_BOUNDARY, recommendedAction: risk.recommendedAction },
        userAction: "liam:sync-monday:work-risk",
      });
    }
    if (!recordExists(db, "operational_risks", "power_platform_risk", risk.id)) {
      createOperationalRisk(db, {
        title: risk.title,
        detail: risk.detail,
        ownerAgentId: "liam",
        businessEntityId: "digitize",
        companyId: "digitize",
        businessImpact: risk.solutionName || "Power Platform governance",
        priority: risk.severity === "high" ? "High" : "Medium",
        status: "New",
        recommendedAction: risk.recommendedAction,
        sourceType: "power_platform_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("power_platform_risk", risk.id),
        metadata: { boundary: LIAM_READ_ONLY_BOUNDARY },
        userAction: "liam:sync-monday:operational-risk",
      });
    }
  }

  for (const decision of decisions) {
    if (!recordExists(db, "operational_decisions", "power_platform_decision", decision.id)) {
      createOperationalDecision(db, {
        title: decision.title,
        detail: decision.detail,
        ownerAgentId: "liam",
        businessEntityId: "digitize",
        companyId: "digitize",
        approvalRequired: decision.approvalRequired,
        priority: decision.priority === "high" ? "High" : "Medium",
        status: "New",
        sourceType: "power_platform_decision",
        sourceId: decision.id,
        sourceReference: sourceReference("power_platform_decision", decision.id),
        metadata: { boundary: LIAM_READ_ONLY_BOUNDARY, decisionRequiredBy: decision.decisionRequiredBy },
        userAction: "liam:sync-monday:decision",
      });
    }
  }

  for (const opportunity of opportunities) {
    if (!recordExists(db, "operational_opportunities", "power_platform_opportunity", opportunity.id)) {
      createOperationalOpportunity(db, {
        title: opportunity.title,
        detail: opportunity.detail,
        ownerAgentId: "liam",
        businessEntityId: "digitize",
        companyId: "digitize",
        businessImpact: opportunity.businessValue,
        priority: opportunity.priority === "high" ? "High" : "Medium",
        status: "New",
        recommendedAction: opportunity.recommendedAction,
        sourceType: "power_platform_opportunity",
        sourceId: opportunity.id,
        sourceReference: sourceReference("power_platform_opportunity", opportunity.id),
        metadata: { boundary: LIAM_READ_ONLY_BOUNDARY },
        userAction: "liam:sync-monday:opportunity",
      });
    }
    if (!recordExists(db, "deliverables", "power_platform_opportunity", opportunity.id)) {
      createDeliverable(db, {
        title: `${opportunity.title} blueprint`,
        detail: `Prepare an advisory-only Power Platform blueprint. ${opportunity.detail}`,
        ownerAgentId: "liam",
        businessEntityId: "digitize",
        companyId: "digitize",
        projectName: opportunity.solutionName || "",
        status: "Planned",
        priority: opportunity.priority === "high" ? "High" : "Medium",
        linkedBusinessId: "digitize",
        linkedMemoryReference: sourceReference("power_platform_opportunity", opportunity.id),
        sourceType: "power_platform_opportunity",
        sourceId: opportunity.id,
        sourceReference: sourceReference("power_platform_opportunity", opportunity.id),
        metadata: { boundary: LIAM_READ_ONLY_BOUNDARY, output: "blueprint_only" },
        userAction: "liam:sync-monday:deliverable",
      });
    }
  }

  calculateAgentWorkloads(db);
}

export function getLiamDashboard(db) {
  ensureLiamMondayIntegration(db);
  const solutions = listPowerPlatformSolutions(db);
  const components = listPowerPlatformComponents(db);
  const risks = listPowerPlatformRisks(db);
  const opportunities = listPowerPlatformOpportunities(db);
  const decisions = listPowerPlatformDecisions(db);
  const dashboard = getMondayOperatingDashboard(db);
  const liamWorkItems = (dashboard.workItems || []).filter((item) => item.ownerAgentId === "liam");
  const liamDeliverables = (dashboard.deliverables || []).filter((item) => item.ownerAgentId === "liam");
  const liamRisks = (dashboard.operationalRisks || []).filter((item) => item.ownerAgentId === "liam");
  const liamDecisions = (dashboard.operationalDecisions || []).filter((item) => item.ownerAgentId === "liam");
  const workload = (dashboard.agentWorkloads || []).find((item) => item.agentId === "liam") || null;
  return {
    profile: getLiamProfile(db),
    boundary: LIAM_READ_ONLY_BOUNDARY,
    domains: LIAM_DOMAINS,
    metrics: liamMetrics({ solutions, components, risks, opportunities, decisions }),
    solutions,
    components,
    risks,
    opportunities,
    decisions,
    reviews: listPowerPlatformReviews(db, 10),
    monday: {
      workload,
      workItems: liamWorkItems,
      deliverables: liamDeliverables,
      risks: liamRisks,
      decisions: liamDecisions,
      boundary: dashboard.boundary,
    },
    audit: listLiamAudit(db, 10),
  };
}

export function createPowerPlatformRisk(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO power_platform_risks (
      solution_id, title, detail, severity, status, recommended_action,
      source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(
    payload.solutionId || payload.solution_id || null,
    clean(payload.title || "Untitled Power Platform risk"),
    clean(payload.detail || ""),
    ["low", "medium", "high"].includes(String(payload.severity).toLowerCase()) ? String(payload.severity).toLowerCase() : "medium",
    clean(payload.status || "open"),
    clean(payload.recommendedAction || payload.recommended_action || ""),
    clean(payload.sourceId || payload.source_id || `manual-${Date.now()}`),
    ["confirmed", "inferred", "assumption"].includes(payload.confidence) ? payload.confidence : "confirmed",
  );
  recordLiamAudit(db, {
    eventType: "risk_created",
    userAction: payload.userAction || "liam:risk:create",
    dataCategories: ["power_platform_risk"],
    outputSaved: true,
    metadata: { riskId: Number(result.lastInsertRowid) },
  });
  return listPowerPlatformRisks(db).find((risk) => Number(risk.id) === Number(result.lastInsertRowid));
}

export function createPowerPlatformDecision(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO power_platform_decisions (
      solution_id, title, detail, priority, status, approval_required,
      decision_required_by, source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(
    payload.solutionId || payload.solution_id || null,
    clean(payload.title || "Untitled Power Platform decision"),
    clean(payload.detail || ""),
    clean(payload.priority || "medium"),
    clean(payload.status || "open"),
    payload.approvalRequired === false ? 0 : 1,
    clean(payload.decisionRequiredBy || payload.decision_required_by || "Patrick King"),
    clean(payload.sourceId || payload.source_id || `manual-${Date.now()}`),
    ["confirmed", "inferred", "assumption"].includes(payload.confidence) ? payload.confidence : "confirmed",
  );
  recordLiamAudit(db, {
    eventType: "decision_created",
    userAction: payload.userAction || "liam:decision:create",
    dataCategories: ["power_platform_decision"],
    outputSaved: true,
    metadata: { decisionId: Number(result.lastInsertRowid) },
  });
  return listPowerPlatformDecisions(db).find((decision) => Number(decision.id) === Number(result.lastInsertRowid));
}

export function generateLiamAnalysis(db, { userAction = "liam:analyse-power-platform" } = {}) {
  const solutions = listPowerPlatformSolutions(db);
  const components = listPowerPlatformComponents(db);
  const risks = active(listPowerPlatformRisks(db)).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const opportunities = active(listPowerPlatformOpportunities(db)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const decisions = active(listPowerPlatformDecisions(db)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const topRisk = risks[0];
  const topOpportunity = opportunities[0];
  const recommendations = [
    topRisk ? {
      recommendation: `Resolve ${topRisk.title} before any Power Platform build activity.`,
      rationale: topRisk.detail,
      sourceReference: sourceReference("power_platform_risk", topRisk.id),
      approvalRequiredBeforeAction: true,
    } : null,
    decisions[0] ? {
      recommendation: `Ask Patrick to decide: ${decisions[0].title}.`,
      rationale: decisions[0].detail,
      sourceReference: sourceReference("power_platform_decision", decisions[0].id),
      approvalRequiredBeforeAction: true,
    } : null,
    topOpportunity ? {
      recommendation: `Prepare a blueprint for ${topOpportunity.title}; keep it as analysis only.`,
      rationale: topOpportunity.businessValue || topOpportunity.detail,
      sourceReference: sourceReference("power_platform_opportunity", topOpportunity.id),
      approvalRequiredBeforeAction: false,
    } : null,
  ].filter(Boolean);
  const sourceReferences = [
    ...solutions.slice(0, 4).map((solution) => ({ reference: sourceReference("power_platform_solution", solution.id), label: solution.name, category: "solution" })),
    ...risks.slice(0, 4).map((risk) => ({ reference: sourceReference("power_platform_risk", risk.id), label: risk.title, category: "risk" })),
    ...decisions.slice(0, 3).map((decision) => ({ reference: sourceReference("power_platform_decision", decision.id), label: decision.title, category: "decision" })),
    ...opportunities.slice(0, 3).map((opportunity) => ({ reference: sourceReference("power_platform_opportunity", opportunity.id), label: opportunity.title, category: "opportunity" })),
  ];
  const executiveSummary = topRisk
    ? `Liam recommends treating ${topRisk.title} as the main Power Platform governance issue before any app, flow, Dataverse, Power BI or SharePoint build path is considered.`
    : "Liam found no open Power Platform risks in local Alfred records.";
  const result = {
    executiveSummary,
    platformSummary: {
      solutions: solutions.length,
      components: components.length,
      openRisks: risks.length,
      opportunities: opportunities.length,
      decisionsRequired: decisions.filter((decision) => decision.approvalRequired).length,
    },
    recommendations,
    risks: risks.slice(0, 5).map((risk) => ({
      risk: risk.title,
      impact: risk.detail,
      severity: risk.severity,
      recommendedAction: risk.recommendedAction,
      sourceReference: sourceReference("power_platform_risk", risk.id),
    })),
    opportunities: opportunities.slice(0, 5).map((opportunity) => ({
      opportunity: opportunity.title,
      businessValue: opportunity.businessValue,
      recommendedAction: opportunity.recommendedAction,
      sourceReference: sourceReference("power_platform_opportunity", opportunity.id),
    })),
    decisionsRequired: decisions.slice(0, 5).map((decision) => ({
      decision: decision.title,
      detail: decision.detail,
      approvalRequired: decision.approvalRequired,
      sourceReference: sourceReference("power_platform_decision", decision.id),
    })),
    assumptions: [
      "Liam reviewed local Alfred Power Platform records and project metadata only.",
      "No Microsoft tenant, Power Platform environment, SharePoint site, Dataverse table, Power BI report or flow was read or changed.",
      "Any future build, publish, tenant or connector action requires Patrick approval and a separate execution framework.",
    ],
    confidenceLevel: risks.length || opportunities.length ? "medium" : "low",
    sourceRecordReferences: sourceReferences,
    model: MODEL,
    boundary: LIAM_READ_ONLY_BOUNDARY,
    readOnly: true,
    executedActions: [],
    executionAttempted: false,
  };

  const review = db.prepare(`
    INSERT INTO power_platform_reviews (
      user_action, model, executive_summary, recommendations, risks,
      opportunities, source_references, confidence_level, output_saved, execution_attempted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(
    clean(userAction),
    MODEL,
    result.executiveSummary,
    JSON.stringify(result.recommendations),
    JSON.stringify(result.risks),
    JSON.stringify(result.opportunities),
    JSON.stringify(result.sourceRecordReferences),
    result.confidenceLevel,
  );
  recordLiamAudit(db, {
    eventType: "power_platform_analysis",
    userAction,
    dataCategories: ["power_platform_solutions", "power_platform_risks", "power_platform_opportunities", "power_platform_decisions", "internal_monday_operating_system"],
    outputSaved: true,
    metadata: { reviewId: Number(review.lastInsertRowid), boundary: LIAM_READ_ONLY_BOUNDARY },
  });
  return { ...result, reviewId: Number(review.lastInsertRowid) };
}

export function liamBriefingForDaily(db) {
  const risks = active(listPowerPlatformRisks(db)).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const decisions = active(listPowerPlatformDecisions(db)).filter((decision) => decision.approvalRequired);
  const opportunities = active(listPowerPlatformOpportunities(db)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const items = [
    ...risks.slice(0, 3).map((risk) => ({
      type: "power_platform_risk",
      title: risk.title,
      detail: risk.detail,
      priority: risk.severity === "high" ? "high" : "medium",
      sourceReference: sourceReference("power_platform_risk", risk.id),
      confidence: risk.confidence,
    })),
    ...decisions.slice(0, 3).map((decision) => ({
      type: "power_platform_decision",
      title: decision.title,
      detail: decision.detail,
      priority: decision.priority,
      sourceReference: sourceReference("power_platform_decision", decision.id),
      confidence: decision.confidence,
    })),
    ...opportunities.slice(0, 2).map((opportunity) => ({
      type: "power_platform_opportunity",
      title: opportunity.title,
      detail: opportunity.businessValue || opportunity.detail,
      priority: opportunity.priority,
      sourceReference: sourceReference("power_platform_opportunity", opportunity.id),
      confidence: opportunity.confidence,
    })),
  ];
  return {
    title: "Liam Power Platform Brief",
    summary: `${items.length} Liam Power Platform signal(s). Advisory only; no apps, flows, Dataverse, Power BI, SharePoint or tenant changes occurred.`,
    items,
    boundary: LIAM_READ_ONLY_BOUNDARY,
    metrics: liamMetrics({
      solutions: listPowerPlatformSolutions(db),
      components: listPowerPlatformComponents(db),
      risks,
      opportunities,
      decisions,
    }),
  };
}

function scoreText(query, text) {
  const terms = clean(query).toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = clean(text).toLowerCase();
  if (!terms.length || !haystack) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) / terms.length;
}

export function searchLiamKnowledge(db, query = "") {
  const q = clean(query);
  if (!q) return { query: q, results: [], boundary: LIAM_READ_ONLY_BOUNDARY };
  const buckets = [
    ["solution", listPowerPlatformSolutions(db), (item) => `${item.name} ${item.solutionType} ${item.platformArea} ${item.summary}`],
    ["component", listPowerPlatformComponents(db), (item) => `${item.name} ${item.componentType} ${item.solutionName} ${item.summary}`],
    ["risk", listPowerPlatformRisks(db), (item) => `${item.title} ${item.detail} ${item.solutionName} ${item.recommendedAction}`],
    ["opportunity", listPowerPlatformOpportunities(db), (item) => `${item.title} ${item.detail} ${item.businessValue} ${item.recommendedAction}`],
    ["decision", listPowerPlatformDecisions(db), (item) => `${item.title} ${item.detail} ${item.solutionName}`],
  ];
  const directResults = buckets.flatMap(([type, rows, textFor]) => rows.map((item) => ({
    type,
    id: item.id,
    title: item.name || item.title,
    summary: item.summary || item.detail || item.businessValue || "",
    relevanceScore: scoreText(q, textFor(item)),
    timestamp: item.updatedAt || item.createdAt,
    sensitivityLabel: "local_sensitive_business_data",
    sourceReference: sourceReference(`power_platform_${type}`, item.id),
  }))).filter((item) => item.relevanceScore > 0);
  const semanticResults = listSemanticSourceRecords(db)
    .filter((record) => record.sourceType.startsWith("power_platform_"))
    .map((record) => ({
      type: "semantic",
      id: record.sourceId,
      title: record.title,
      summary: record.summary,
      relevanceScore: scoreText(q, `${record.title} ${record.summary}`) * 0.9,
      timestamp: record.sourceCreatedAt,
      sensitivityLabel: record.sensitivityCategory,
      sourceReference: `${record.sourceType}:${record.sourceId}`,
    }))
    .filter((item) => item.relevanceScore > 0);
  return {
    query: q,
    results: [...directResults, ...semanticResults]
      .sort((a, b) => b.relevanceScore - a.relevanceScore || String(a.title).localeCompare(String(b.title)))
      .slice(0, 20),
    boundary: LIAM_READ_ONLY_BOUNDARY,
  };
}

export function buildLiamAnalysisInput(db, { retrievedMemoryContext = null } = {}) {
  const dashboard = getLiamDashboard(db);
  return {
    specialist: {
      name: "Liam",
      role: "Power Platform Director",
      reportsTo: "Alfred",
      business: "Digitize Consultants",
    },
    boundary: LIAM_READ_ONLY_BOUNDARY,
    domains: LIAM_DOMAINS,
    solutions: dashboard.solutions.slice(0, 10),
    components: dashboard.components.slice(0, 20),
    risks: dashboard.risks.slice(0, 10),
    opportunities: dashboard.opportunities.slice(0, 10),
    decisions: dashboard.decisions.slice(0, 10),
    mondayContext: dashboard.monday,
    relevantMemory: retrievedMemoryContext?.records || [],
    sourceRecordReferences: [
      ...dashboard.solutions.slice(0, 6).map((solution) => ({ reference: sourceReference("power_platform_solution", solution.id), label: solution.name, category: "solution" })),
      ...dashboard.risks.slice(0, 6).map((risk) => ({ reference: sourceReference("power_platform_risk", risk.id), label: risk.title, category: "risk" })),
      ...(retrievedMemoryContext?.sourceRecordReferences || []),
    ],
  };
}
