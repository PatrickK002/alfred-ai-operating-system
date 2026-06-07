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

export const JAMES_READ_ONLY_BOUNDARY = Object.freeze({
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  productBuildEnabled: false,
  codeDeploymentEnabled: false,
  productPublishingEnabled: false,
  customerOutreachEnabled: false,
  pricingChangeEnabled: false,
  paymentProcessingEnabled: false,
  contractChangeEnabled: false,
  externalWritesEnabled: false,
});

export const JAMES_DOMAINS = Object.freeze([
  { id: "product_strategy", label: "Product Strategy", focus: ["ICP", "Positioning", "Category", "Product thesis"] },
  { id: "mvp_validation", label: "MVP Validation", focus: ["Problem interviews", "Hypotheses", "Evidence", "Kill criteria"] },
  { id: "roadmap", label: "Roadmap", focus: ["Themes", "Non-goals", "Sequencing", "Decision gates"] },
  { id: "commercial", label: "Commercial", focus: ["Pricing hypothesis", "Revenue model", "Pilot offer", "Buyer urgency"] },
  { id: "product_risk", label: "Product Risk", focus: ["Scope creep", "Build risk", "Market risk", "Founder attention"] },
]);

const MODEL = "james-deterministic-v1";
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

function active(records) {
  return (records || []).filter((record) => !COMPLETE_STATUSES.has(String(record.status || "").toLowerCase()));
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

export function recordJamesAudit(db, {
  eventType,
  userAction = "",
  productVentureId = null,
  dataCategories = [],
  outputSaved = false,
  model = MODEL,
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO james_audit_events (
      event_type, user_action, product_venture_id, data_categories,
      output_saved, model, status, error_code, execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    clean(eventType || "james_event"),
    clean(userAction),
    productVentureId || null,
    JSON.stringify([...new Set((dataCategories || []).map(String).filter(Boolean))]),
    outputSaved ? 1 : 0,
    clean(model),
    status === "error" ? "error" : "success",
    clean(errorCode).slice(0, 200),
    JSON.stringify({ ...metadata, boundary: JAMES_READ_ONLY_BOUNDARY }),
  );
  return Number(result.lastInsertRowid);
}

export function listJamesAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM james_audit_events
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

export function getJamesProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'james'").get();
  return row ? {
    ...mapRow(row, ["tools"]),
    reportsTo: "Alfred",
    boundary: JAMES_READ_ONLY_BOUNDARY,
  } : null;
}

export function listProductVentures(db) {
  return db.prepare(`
    SELECT
      v.*,
      (
        SELECT COUNT(*)
        FROM product_features f
        WHERE f.product_venture_id = v.id
      ) AS feature_count,
      (
        SELECT COUNT(*)
        FROM product_experiments e
        WHERE e.product_venture_id = v.id
      ) AS experiment_count,
      (
        SELECT COUNT(*)
        FROM product_risks r
        WHERE r.product_venture_id = v.id AND lower(r.status) NOT IN ('closed', 'complete', 'rejected')
      ) AS open_risk_count
    FROM product_ventures v
    ORDER BY
      CASE lower(v.stage) WHEN 'discovery' THEN 1 WHEN 'validation' THEN 2 WHEN 'ideation' THEN 3 ELSE 4 END,
      v.updated_at DESC,
      v.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductFeatures(db) {
  return db.prepare(`
    SELECT f.*, v.name AS product_name, v.stage AS product_stage, v.business_entity_id
    FROM product_features f
    LEFT JOIN product_ventures v ON v.id = f.product_venture_id
    ORDER BY
      CASE lower(f.priority) WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      f.updated_at DESC,
      f.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductExperiments(db) {
  return db.prepare(`
    SELECT e.*, v.name AS product_name, v.stage AS product_stage, v.business_entity_id
    FROM product_experiments e
    LEFT JOIN product_ventures v ON v.id = e.product_venture_id
    ORDER BY
      CASE lower(e.status) WHEN 'active' THEN 1 WHEN 'planned' THEN 2 WHEN 'complete' THEN 3 ELSE 4 END,
      e.updated_at DESC,
      e.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductRoadmapItems(db) {
  return db.prepare(`
    SELECT r.*, v.name AS product_name, v.business_entity_id
    FROM product_roadmap_items r
    LEFT JOIN product_ventures v ON v.id = r.product_venture_id
    ORDER BY
      CASE lower(r.priority) WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      r.updated_at DESC,
      r.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductRisks(db) {
  return db.prepare(`
    SELECT r.*, v.name AS product_name, v.business_entity_id
    FROM product_risks r
    LEFT JOIN product_ventures v ON v.id = r.product_venture_id
    ORDER BY
      CASE r.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      r.updated_at DESC,
      r.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductOpportunities(db) {
  return db.prepare(`
    SELECT o.*, v.name AS product_name, v.business_entity_id
    FROM product_opportunities o
    LEFT JOIN product_ventures v ON v.id = o.product_venture_id
    ORDER BY
      CASE lower(o.priority) WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      o.updated_at DESC,
      o.id DESC
  `).all().map((row) => mapRow(row));
}

export function listProductDecisions(db) {
  return db.prepare(`
    SELECT d.*, v.name AS product_name, v.business_entity_id
    FROM product_decisions d
    LEFT JOIN product_ventures v ON v.id = d.product_venture_id
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

export function listProductReviews(db, limit = 20) {
  return db.prepare(`
    SELECT r.*, v.name AS product_name
    FROM product_reviews r
    LEFT JOIN product_ventures v ON v.id = r.product_venture_id
    ORDER BY r.requested_at DESC, r.id DESC
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

function jamesMetrics({ ventures, features, experiments, roadmap, risks, opportunities, decisions }) {
  const activeRisks = active(risks);
  const activeOpportunities = active(opportunities);
  const activeDecisions = active(decisions);
  return {
    products: ventures.length,
    features: active(features).length,
    experiments: active(experiments).length,
    roadmapItems: active(roadmap).length,
    highRisks: activeRisks.filter((risk) => risk.severity === "high").length,
    openRisks: activeRisks.length,
    opportunities: activeOpportunities.length,
    decisionsRequired: activeDecisions.filter((decision) => decision.approvalRequired).length,
    advisoryOnly: true,
  };
}

export function ensureJamesMondayIntegration(db) {
  const risks = active(listProductRisks(db));
  const decisions = active(listProductDecisions(db));
  const opportunities = active(listProductOpportunities(db));
  const roadmap = active(listProductRoadmapItems(db));

  for (const risk of risks) {
    if (!recordExists(db, "work_items", "product_risk", risk.id)) {
      createWorkItem(db, {
        title: risk.title,
        detail: risk.detail,
        itemType: "product_risk_review",
        ownerAgentId: "james",
        businessEntityId: risk.businessEntityId || "council-assurance-platform",
        companyId: "product",
        projectName: risk.productName || "",
        priority: risk.severity === "high" ? "High" : "Medium",
        status: "New",
        sourceType: "product_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("product_risk", risk.id),
        metadata: { boundary: JAMES_READ_ONLY_BOUNDARY, recommendedAction: risk.recommendedAction },
        userAction: "james:sync-monday:work-risk",
      });
    }
    if (!recordExists(db, "operational_risks", "product_risk", risk.id)) {
      createOperationalRisk(db, {
        title: risk.title,
        detail: risk.detail,
        ownerAgentId: "james",
        businessEntityId: risk.businessEntityId || "council-assurance-platform",
        companyId: "product",
        businessImpact: risk.productName || "Product Studio",
        priority: risk.severity === "high" ? "High" : "Medium",
        status: "New",
        recommendedAction: risk.recommendedAction,
        sourceType: "product_risk",
        sourceId: risk.id,
        sourceReference: sourceReference("product_risk", risk.id),
        metadata: { boundary: JAMES_READ_ONLY_BOUNDARY },
        userAction: "james:sync-monday:operational-risk",
      });
    }
  }

  for (const decision of decisions) {
    if (!recordExists(db, "operational_decisions", "product_decision", decision.id)) {
      createOperationalDecision(db, {
        title: decision.title,
        detail: decision.detail,
        ownerAgentId: "james",
        businessEntityId: decision.businessEntityId || "council-assurance-platform",
        companyId: "product",
        approvalRequired: decision.approvalRequired,
        priority: decision.priority === "high" ? "High" : "Medium",
        status: "New",
        sourceType: "product_decision",
        sourceId: decision.id,
        sourceReference: sourceReference("product_decision", decision.id),
        metadata: { boundary: JAMES_READ_ONLY_BOUNDARY, decisionRequiredBy: decision.decisionRequiredBy },
        userAction: "james:sync-monday:decision",
      });
    }
  }

  for (const opportunity of opportunities) {
    if (!recordExists(db, "operational_opportunities", "product_opportunity", opportunity.id)) {
      createOperationalOpportunity(db, {
        title: opportunity.title,
        detail: opportunity.detail,
        ownerAgentId: "james",
        businessEntityId: opportunity.businessEntityId || "council-assurance-platform",
        companyId: "product",
        businessImpact: opportunity.businessValue,
        priority: opportunity.priority === "high" ? "High" : "Medium",
        status: "New",
        recommendedAction: opportunity.recommendedAction,
        sourceType: "product_opportunity",
        sourceId: opportunity.id,
        sourceReference: sourceReference("product_opportunity", opportunity.id),
        metadata: { boundary: JAMES_READ_ONLY_BOUNDARY },
        userAction: "james:sync-monday:opportunity",
      });
    }
  }

  for (const item of roadmap) {
    if (!recordExists(db, "deliverables", "product_roadmap_item", item.id)) {
      createDeliverable(db, {
        title: `${item.title} product pack`,
        detail: `Prepare an advisory-only Product Studio pack. ${item.detail}`,
        ownerAgentId: "james",
        businessEntityId: item.businessEntityId || "council-assurance-platform",
        companyId: "product",
        projectName: item.productName || "",
        status: "Planned",
        priority: item.priority === "high" ? "High" : "Medium",
        linkedBusinessId: item.businessEntityId || "council-assurance-platform",
        linkedMemoryReference: sourceReference("product_roadmap_item", item.id),
        sourceType: "product_roadmap_item",
        sourceId: item.id,
        sourceReference: sourceReference("product_roadmap_item", item.id),
        metadata: { boundary: JAMES_READ_ONLY_BOUNDARY, output: "product_pack_only" },
        userAction: "james:sync-monday:deliverable",
      });
    }
  }

  calculateAgentWorkloads(db);
}

export function getJamesDashboard(db) {
  ensureJamesMondayIntegration(db);
  const ventures = listProductVentures(db);
  const features = listProductFeatures(db);
  const experiments = listProductExperiments(db);
  const roadmap = listProductRoadmapItems(db);
  const risks = listProductRisks(db);
  const opportunities = listProductOpportunities(db);
  const decisions = listProductDecisions(db);
  const monday = getMondayOperatingDashboard(db);
  return {
    profile: getJamesProfile(db),
    boundary: JAMES_READ_ONLY_BOUNDARY,
    domains: JAMES_DOMAINS,
    metrics: jamesMetrics({ ventures, features, experiments, roadmap, risks, opportunities, decisions }),
    ventures,
    features,
    experiments,
    roadmap,
    risks,
    opportunities,
    decisions,
    reviews: listProductReviews(db, 10),
    monday: {
      workload: (monday.agentWorkloads || []).find((item) => item.agentId === "james") || null,
      workItems: (monday.workItems || []).filter((item) => item.ownerAgentId === "james"),
      deliverables: (monday.deliverables || []).filter((item) => item.ownerAgentId === "james"),
      risks: (monday.operationalRisks || []).filter((item) => item.ownerAgentId === "james"),
      decisions: (monday.operationalDecisions || []).filter((item) => item.ownerAgentId === "james"),
      boundary: monday.boundary,
    },
    audit: listJamesAudit(db, 10),
  };
}

export function createProductRisk(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO product_risks (
      product_venture_id, title, detail, severity, status, recommended_action,
      source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(
    payload.productVentureId || payload.product_venture_id || null,
    clean(payload.title || "Untitled product risk"),
    clean(payload.detail || ""),
    ["low", "medium", "high"].includes(String(payload.severity).toLowerCase()) ? String(payload.severity).toLowerCase() : "medium",
    clean(payload.status || "open"),
    clean(payload.recommendedAction || payload.recommended_action || ""),
    clean(payload.sourceId || payload.source_id || `manual-${Date.now()}`),
    ["confirmed", "inferred", "assumption"].includes(payload.confidence) ? payload.confidence : "confirmed",
  );
  recordJamesAudit(db, {
    eventType: "risk_created",
    userAction: payload.userAction || "james:risk:create",
    productVentureId: payload.productVentureId || payload.product_venture_id || null,
    dataCategories: ["product_risk"],
    outputSaved: true,
    metadata: { riskId: Number(result.lastInsertRowid) },
  });
  return listProductRisks(db).find((risk) => Number(risk.id) === Number(result.lastInsertRowid));
}

export function createProductDecision(db, payload = {}) {
  const result = db.prepare(`
    INSERT INTO product_decisions (
      product_venture_id, title, detail, priority, status, approval_required,
      decision_required_by, source_type, source_id, confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(
    payload.productVentureId || payload.product_venture_id || null,
    clean(payload.title || "Untitled product decision"),
    clean(payload.detail || ""),
    clean(payload.priority || "medium"),
    clean(payload.status || "open"),
    payload.approvalRequired === false ? 0 : 1,
    clean(payload.decisionRequiredBy || payload.decision_required_by || "Patrick King"),
    clean(payload.sourceId || payload.source_id || `manual-${Date.now()}`),
    ["confirmed", "inferred", "assumption"].includes(payload.confidence) ? payload.confidence : "confirmed",
  );
  recordJamesAudit(db, {
    eventType: "decision_created",
    userAction: payload.userAction || "james:decision:create",
    productVentureId: payload.productVentureId || payload.product_venture_id || null,
    dataCategories: ["product_decision"],
    outputSaved: true,
    metadata: { decisionId: Number(result.lastInsertRowid) },
  });
  return listProductDecisions(db).find((decision) => Number(decision.id) === Number(result.lastInsertRowid));
}

export function generateJamesAnalysis(db, { productVentureId = null, userAction = "james:analyse-product" } = {}) {
  const ventures = listProductVentures(db);
  const selected = productVentureId
    ? ventures.find((venture) => Number(venture.id) === Number(productVentureId))
    : ventures[0];
  const ventureFilter = (record) => !selected || !record.productVentureId || Number(record.productVentureId) === Number(selected.id);
  const features = active(listProductFeatures(db)).filter(ventureFilter).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const experiments = active(listProductExperiments(db)).filter(ventureFilter);
  const roadmap = active(listProductRoadmapItems(db)).filter(ventureFilter).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const risks = active(listProductRisks(db)).filter(ventureFilter).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const opportunities = active(listProductOpportunities(db)).filter(ventureFilter).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const decisions = active(listProductDecisions(db)).filter(ventureFilter).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const topRisk = risks[0];
  const topOpportunity = opportunities[0];
  const topDecision = decisions[0];
  const productName = selected?.name || "Product Studio portfolio";
  const recommendations = [
    topRisk ? {
      recommendation: `Resolve ${topRisk.title} before James recommends product build activity.`,
      rationale: topRisk.detail,
      sourceReference: sourceReference("product_risk", topRisk.id),
      approvalRequiredBeforeAction: true,
    } : null,
    topDecision ? {
      recommendation: `Ask Patrick to decide: ${topDecision.title}.`,
      rationale: topDecision.detail,
      sourceReference: sourceReference("product_decision", topDecision.id),
      approvalRequiredBeforeAction: true,
    } : null,
    topOpportunity ? {
      recommendation: `Prepare a validation pack for ${topOpportunity.title}; keep it as analysis only.`,
      rationale: topOpportunity.businessValue || topOpportunity.detail,
      sourceReference: sourceReference("product_opportunity", topOpportunity.id),
      approvalRequiredBeforeAction: false,
    } : null,
  ].filter(Boolean);
  const sourceReferences = [
    ...(selected ? [{ reference: sourceReference("product_venture", selected.id), label: selected.name, category: "product" }] : []),
    ...risks.slice(0, 4).map((risk) => ({ reference: sourceReference("product_risk", risk.id), label: risk.title, category: "risk" })),
    ...decisions.slice(0, 3).map((decision) => ({ reference: sourceReference("product_decision", decision.id), label: decision.title, category: "decision" })),
    ...opportunities.slice(0, 3).map((opportunity) => ({ reference: sourceReference("product_opportunity", opportunity.id), label: opportunity.title, category: "opportunity" })),
    ...roadmap.slice(0, 3).map((item) => ({ reference: sourceReference("product_roadmap_item", item.id), label: item.title, category: "roadmap" })),
  ];
  const executiveSummary = topRisk
    ? `James recommends keeping ${productName} in validation mode until ${topRisk.title.toLowerCase()} is resolved with evidence.`
    : `James found no open product risks for ${productName}; keep decisions evidence-led before build.`;
  const result = {
    executiveSummary,
    productSummary: {
      product: productName,
      stage: selected?.stage || "Portfolio",
      features: features.length,
      experiments: experiments.length,
      roadmapItems: roadmap.length,
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
      sourceReference: sourceReference("product_risk", risk.id),
    })),
    opportunities: opportunities.slice(0, 5).map((opportunity) => ({
      opportunity: opportunity.title,
      businessValue: opportunity.businessValue,
      recommendedAction: opportunity.recommendedAction,
      sourceReference: sourceReference("product_opportunity", opportunity.id),
    })),
    decisionsRequired: decisions.slice(0, 5).map((decision) => ({
      decision: decision.title,
      detail: decision.detail,
      approvalRequired: decision.approvalRequired,
      sourceReference: sourceReference("product_decision", decision.id),
    })),
    nextRoadmapItems: roadmap.slice(0, 5).map((item) => ({
      title: item.title,
      theme: item.theme,
      quarter: item.quarter,
      sourceReference: sourceReference("product_roadmap_item", item.id),
    })),
    assumptions: [
      "James reviewed local Alfred Product Studio records only.",
      "No product code, deployment, publication, customer outreach, pricing, payment, contract or external system action was executed.",
      "Any future build, launch, outreach or commercial action requires Patrick approval and a separate execution framework.",
    ],
    confidenceLevel: risks.length || experiments.length || opportunities.length ? "medium" : "low",
    sourceRecordReferences: sourceReferences,
    model: MODEL,
    boundary: JAMES_READ_ONLY_BOUNDARY,
    readOnly: true,
    executedActions: [],
    executionAttempted: false,
  };

  const review = db.prepare(`
    INSERT INTO product_reviews (
      product_venture_id, user_action, model, executive_summary,
      recommendations, risks, opportunities, source_references,
      confidence_level, output_saved, execution_attempted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
  `).run(
    selected?.id || null,
    clean(userAction),
    MODEL,
    result.executiveSummary,
    JSON.stringify(result.recommendations),
    JSON.stringify(result.risks),
    JSON.stringify(result.opportunities),
    JSON.stringify(result.sourceRecordReferences),
    result.confidenceLevel,
  );
  recordJamesAudit(db, {
    eventType: "product_analysis",
    userAction,
    productVentureId: selected?.id || null,
    dataCategories: ["product_ventures", "product_features", "product_experiments", "product_risks", "product_opportunities", "product_decisions", "internal_monday_operating_system"],
    outputSaved: true,
    metadata: { reviewId: Number(review.lastInsertRowid), boundary: JAMES_READ_ONLY_BOUNDARY },
  });
  return { ...result, reviewId: Number(review.lastInsertRowid) };
}

export function jamesBriefingForDaily(db) {
  const risks = active(listProductRisks(db)).sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const decisions = active(listProductDecisions(db)).filter((decision) => decision.approvalRequired);
  const opportunities = active(listProductOpportunities(db)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const roadmap = active(listProductRoadmapItems(db)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const items = [
    ...risks.slice(0, 3).map((risk) => ({
      type: "product_risk",
      title: risk.title,
      detail: risk.detail,
      priority: risk.severity === "high" ? "high" : "medium",
      sourceReference: sourceReference("product_risk", risk.id),
      confidence: risk.confidence,
    })),
    ...decisions.slice(0, 3).map((decision) => ({
      type: "product_decision",
      title: decision.title,
      detail: decision.detail,
      priority: decision.priority,
      sourceReference: sourceReference("product_decision", decision.id),
      confidence: decision.confidence,
    })),
    ...opportunities.slice(0, 2).map((opportunity) => ({
      type: "product_opportunity",
      title: opportunity.title,
      detail: opportunity.businessValue || opportunity.detail,
      priority: opportunity.priority,
      sourceReference: sourceReference("product_opportunity", opportunity.id),
      confidence: opportunity.confidence,
    })),
    ...roadmap.slice(0, 2).map((item) => ({
      type: "product_roadmap_item",
      title: item.title,
      detail: item.detail,
      priority: item.priority,
      sourceReference: sourceReference("product_roadmap_item", item.id),
      confidence: "assumption",
    })),
  ];
  return {
    title: "James Product CEO Brief",
    summary: `${items.length} James Product Studio signal(s). Advisory only; no product build, launch, outreach, pricing, payment or contract action occurred.`,
    items,
    boundary: JAMES_READ_ONLY_BOUNDARY,
    metrics: jamesMetrics({
      ventures: listProductVentures(db),
      features: listProductFeatures(db),
      experiments: listProductExperiments(db),
      roadmap,
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

export function searchJamesKnowledge(db, query = "") {
  const q = clean(query);
  if (!q) return { query: q, results: [], boundary: JAMES_READ_ONLY_BOUNDARY };
  const buckets = [
    ["venture", listProductVentures(db), (item) => `${item.name} ${item.productType} ${item.stage} ${item.targetCustomer} ${item.problemStatement} ${item.valueProposition}`],
    ["feature", listProductFeatures(db), (item) => `${item.title} ${item.detail} ${item.userValue} ${item.productName}`],
    ["experiment", listProductExperiments(db), (item) => `${item.title} ${item.hypothesis} ${item.method} ${item.successMetric} ${item.productName}`],
    ["roadmap_item", listProductRoadmapItems(db), (item) => `${item.title} ${item.detail} ${item.theme} ${item.productName}`],
    ["risk", listProductRisks(db), (item) => `${item.title} ${item.detail} ${item.productName} ${item.recommendedAction}`],
    ["opportunity", listProductOpportunities(db), (item) => `${item.title} ${item.detail} ${item.businessValue} ${item.recommendedAction}`],
    ["decision", listProductDecisions(db), (item) => `${item.title} ${item.detail} ${item.productName}`],
  ];
  const directResults = buckets.flatMap(([type, rows, textFor]) => rows.map((item) => ({
    type,
    id: item.id,
    title: item.name || item.title,
    summary: item.problemStatement || item.summary || item.detail || item.businessValue || item.userValue || "",
    relevanceScore: scoreText(q, textFor(item)),
    timestamp: item.updatedAt || item.createdAt,
    sensitivityLabel: "local_sensitive_business_data",
    sourceReference: sourceReference(`product_${type}`, item.id),
  }))).filter((item) => item.relevanceScore > 0);
  const semanticResults = listSemanticSourceRecords(db)
    .filter((record) => record.sourceType.startsWith("product_"))
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
    boundary: JAMES_READ_ONLY_BOUNDARY,
  };
}

export function buildJamesAnalysisInput(db, { productVentureId = null, retrievedMemoryContext = null } = {}) {
  const dashboard = getJamesDashboard(db);
  const selected = productVentureId
    ? dashboard.ventures.find((venture) => Number(venture.id) === Number(productVentureId))
    : dashboard.ventures[0];
  return {
    specialist: {
      name: "James",
      role: "Product CEO",
      reportsTo: "Alfred",
      business: "Product Studio",
    },
    boundary: JAMES_READ_ONLY_BOUNDARY,
    domains: JAMES_DOMAINS,
    selectedProduct: selected || null,
    ventures: dashboard.ventures.slice(0, 8),
    features: dashboard.features.slice(0, 12),
    experiments: dashboard.experiments.slice(0, 12),
    roadmap: dashboard.roadmap.slice(0, 12),
    risks: dashboard.risks.slice(0, 10),
    opportunities: dashboard.opportunities.slice(0, 10),
    decisions: dashboard.decisions.slice(0, 10),
    mondayContext: dashboard.monday,
    relevantMemory: retrievedMemoryContext?.records || [],
    sourceRecordReferences: [
      ...dashboard.ventures.slice(0, 4).map((venture) => ({ reference: sourceReference("product_venture", venture.id), label: venture.name, category: "product" })),
      ...dashboard.risks.slice(0, 6).map((risk) => ({ reference: sourceReference("product_risk", risk.id), label: risk.title, category: "risk" })),
      ...(retrievedMemoryContext?.sourceRecordReferences || []),
    ],
  };
}
