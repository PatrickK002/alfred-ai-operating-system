import {
  buildProjectAnalysisInput,
  getProjectDashboard,
  getProjectDetail,
  listDigitalConstructionDomains,
  listProjectProfiles,
} from "./project-intelligence.js";

export const SARAH_READ_ONLY_BOUNDARY = {
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  microsoftWritePermissions: false,
  sharePointWriteEnabled: false,
  oneDriveWriteEnabled: false,
  emailSendEnabled: false,
  calendarWriteEnabled: false,
  fileEditingEnabled: false,
  financialWriteEnabled: false,
  applicationGenerationEnabled: false,
  documentPublishingEnabled: false,
};

export const SARAH_DOMAINS = [
  {
    id: "BIM",
    label: "BIM",
    expertise: ["BIM Strategy", "BIM Execution Plans", "EIR", "AIR", "MIDP", "TIDP", "BIM Delivery", "BIM Governance"],
  },
  {
    id: "ISO19650",
    label: "ISO 19650",
    expertise: ["Information Requirements", "Information Management", "CDE", "Information Delivery", "Appointing Party", "Lead Appointed Party"],
  },
  {
    id: "COBie",
    label: "COBie",
    expertise: ["Asset Information", "COBie Structure", "COBie Quality", "Information Completeness"],
  },
  {
    id: "GIS",
    label: "GIS",
    expertise: ["GIS Strategy", "Spatial Information", "Asset Mapping", "Geospatial Data"],
  },
  {
    id: "DigitalTwin",
    label: "Digital Twins",
    expertise: ["Digital Twin Strategy", "Asset Performance", "Operational Data", "Smart Asset Management"],
  },
  {
    id: "BuildingSafety",
    label: "Building Safety",
    expertise: ["Golden Thread", "Building Safety Act", "Information Assurance", "Compliance Information"],
  },
  {
    id: "PowerPlatform",
    label: "Power Platform",
    expertise: ["Power Apps", "Dataverse", "Power Automate", "Power BI", "SharePoint"],
  },
  {
    id: "InformationManagement",
    label: "Information Management",
    expertise: ["Information Quality", "Information Governance", "Delivery Controls", "Information Completeness"],
  },
  {
    id: "AssetInformation",
    label: "Asset Information",
    expertise: ["AIR", "Asset Registers", "Asset Data", "Handover Metadata"],
  },
];

export const SARAH_DELIVERABLE_TYPES = [
  "bim_strategy_outline",
  "eir_outline",
  "air_outline",
  "bep_outline",
  "information_management_plan",
  "digital_twin_strategy_outline",
  "gis_strategy_outline",
];

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

function compactRecord(record, fields) {
  return Object.fromEntries(fields.map((field) => [field, record?.[field]]).filter(([, value]) => value !== undefined));
}

function sourceReference(reference, label, category) {
  return { reference, label: normalizeText(label), category };
}

function severityRank(value = "") {
  return { high: 0, medium: 1, low: 2 }[String(value).toLowerCase()] ?? 3;
}

function domainLabel(domainId) {
  return SARAH_DOMAINS.find((domain) => domain.id === domainId)?.label || domainId;
}

function documentClasses(detail) {
  return new Set((detail.documents || []).map((document) => document.classification));
}

function projectDomainIds(detail) {
  return new Set((detail.tags || []).map((tag) => tag.domainId));
}

function confidenceFor({ confirmed = false, inferred = false }) {
  if (confirmed) return "high";
  if (inferred) return "medium";
  return "low";
}

function buildDomainObservations(detail) {
  const domains = projectDomainIds(detail);
  const classes = documentClasses(detail);
  const observations = [];
  const add = (domainId, observation, sourceReferenceValue, confidence = "medium") => {
    observations.push({
      domainId,
      domain: domainLabel(domainId),
      observation,
      confidence,
      sourceReference: sourceReferenceValue || `project_profile:${detail.profile.id}`,
    });
  };

  if (domains.has("BIM") || classes.has("BEP") || classes.has("IFC") || classes.has("Drawings")) {
    add("BIM", classes.has("BEP")
      ? "BEP metadata is present, so Sarah can review BIM delivery governance once contents are available."
      : "BIM domain is tagged, but baseline BEP metadata is not yet linked.", `project_profile:${detail.profile.id}`, classes.has("BEP") ? "high" : "medium");
  }
  if (domains.has("ISO19650") || ["EIR", "AIR", "BEP", "MIDP", "TIDP"].some((classification) => classes.has(classification))) {
    const missing = ["EIR", "BEP", "MIDP", "TIDP"].filter((classification) => !classes.has(classification));
    add("ISO19650", missing.length
      ? `ISO 19650 baseline metadata is incomplete. Missing ${missing.join(", ")}.`
      : "Baseline ISO 19650 delivery metadata is present.", `project_profile:${detail.profile.id}`, missing.length ? "medium" : "high");
  }
  if (domains.has("COBie") || classes.has("COBie")) {
    add("COBie", classes.has("COBie")
      ? "COBie document metadata is linked; quality and completeness review remains future work."
      : "COBie domain is tagged, but no COBie metadata is linked yet.", `project_profile:${detail.profile.id}`, classes.has("COBie") ? "high" : "medium");
  }
  if (domains.has("GIS") || classes.has("GIS Documents")) {
    add("GIS", classes.has("GIS Documents")
      ? "GIS document metadata is linked; no spatial dataset analysis has been run."
      : "GIS domain is tagged, but no GIS document metadata is linked yet.", `project_profile:${detail.profile.id}`, classes.has("GIS Documents") ? "high" : "medium");
  }
  if (domains.has("DigitalTwin") || classes.has("Digital Twin Documents")) {
    add("DigitalTwin", "Digital Twin opportunity context exists, but no twin model, sensor or operational data analysis has been run.", `project_profile:${detail.profile.id}`);
  }
  if (domains.has("BuildingSafety") || classes.has("Building Safety Documents")) {
    add("BuildingSafety", "Building Safety context exists; golden-thread and compliance information should be reviewed before any delivery claim.", `project_profile:${detail.profile.id}`);
  }
  if (domains.has("PowerPlatform")) {
    add("PowerPlatform", "Power Platform is tagged as a potential workflow/reporting domain. Sarah may recommend discovery only; no app generation is enabled.", `project_tag:${(detail.tags || []).find((tag) => tag.domainId === "PowerPlatform")?.id || detail.profile.id}`);
  }
  return observations;
}

export function recordSarahAudit(db, {
  eventType,
  userAction = "",
  projectProfileId = null,
  clientName = "",
  dataCategories = [],
  outputSaved = false,
  model = "sarah-deterministic-v1",
  status = "success",
  errorCode = "",
  metadata = {},
}) {
  const result = db.prepare(`
    INSERT INTO sarah_audit_events (
      event_type, user_action, project_profile_id, client_name, data_categories,
      output_saved, model, status, error_code, execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    String(eventType),
    String(userAction),
    projectProfileId ? Number(projectProfileId) : null,
    normalizeText(clientName),
    JSON.stringify([...new Set((dataCategories || []).map(String).filter(Boolean))]),
    outputSaved ? 1 : 0,
    String(model),
    String(status),
    String(errorCode).slice(0, 200),
    JSON.stringify({ ...metadata, boundary: SARAH_READ_ONLY_BOUNDARY }),
  );
  return Number(result.lastInsertRowid);
}

export function listSarahAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM sarah_audit_events
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

export function getSarahProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'sarah'").get();
  return row ? {
    ...mapRow(row, ["tools"]),
    reportsTo: "Alfred",
    boundary: SARAH_READ_ONLY_BOUNDARY,
  } : null;
}

export function listSarahTeamPlaceholders(db) {
  return db.prepare(`
    SELECT *
    FROM sarah_team_placeholders
    ORDER BY name ASC
  `).all().map((row) => mapRow(row, ["expertise"]));
}

export function generateSarahOpportunities(detail) {
  const domains = projectDomainIds(detail);
  const classes = documentClasses(detail);
  const opportunities = [];
  const push = (category, opportunity, businessImpact, confidence, reasoning, estimatedValue = "To be qualified") => {
    opportunities.push({
      category,
      opportunity,
      estimatedValue,
      businessImpact,
      confidence,
      reasoning,
      sourceReference: `project_profile:${detail.profile.id}`,
      projectProfileId: detail.profile.id,
      projectName: detail.profile.projectName,
      clientName: detail.profile.clientName,
      recommendationOnly: true,
    });
  };

  const missingDocs = detail.healthScore?.inputs?.missingClasses || [];
  if (missingDocs.length) {
    push("Information Management", "Baseline information delivery review", "Reduce information delivery risk and clarify EIR/BEP/MIDP/TIDP gaps.", "high", `Missing baseline metadata: ${missingDocs.join(", ")}.`);
  }
  if (domains.has("COBie") || classes.has("COBie") || domains.has("AssetInformation")) {
    push("Asset Information", "Asset information and COBie completeness review", "Improve handover readiness and reduce late-stage asset data remediation.", confidenceFor({ confirmed: classes.has("COBie"), inferred: domains.has("COBie") || domains.has("AssetInformation") }), "COBie or asset information context is present.");
  }
  if (domains.has("GIS") || classes.has("GIS Documents")) {
    push("GIS", "GIS and spatial information discovery", "Identify geospatial data value and asset mapping requirements.", confidenceFor({ confirmed: classes.has("GIS Documents"), inferred: domains.has("GIS") }), "GIS context is present, but no spatial dataset analysis has been run.");
  }
  if (domains.has("DigitalTwin") || classes.has("Digital Twin Documents")) {
    push("Digital Twin", "Digital Twin strategy discovery", "Assess operational data, model and sensor readiness before proposing a twin roadmap.", confidenceFor({ confirmed: classes.has("Digital Twin Documents"), inferred: domains.has("DigitalTwin") }), "Digital Twin context is tagged or linked.");
  }
  if (domains.has("PowerPlatform") || (detail.actions || []).length || (detail.informationQuality?.status && detail.informationQuality.status !== "green")) {
    push("Power Platform", "Project workflow and reporting automation discovery", "Potential to reduce manual chasing and expose project information quality issues.", domains.has("PowerPlatform") ? "medium" : "low", "Open actions or information quality issues could suit workflow/reporting automation. No application generation is enabled.");
  }
  if (domains.has("BuildingSafety") || classes.has("Building Safety Documents")) {
    push("Building Safety", "Building safety information assurance review", "Support golden-thread information quality and compliance evidence review.", confidenceFor({ confirmed: classes.has("Building Safety Documents"), inferred: domains.has("BuildingSafety") }), "Building Safety context is present.");
  }
  return opportunities.slice(0, 10);
}

export function generateSarahProjectHealthReview(db, projectProfileId, {
  userAction = "api:sarah-project-health-review",
  audit = true,
} = {}) {
  const detail = getProjectDetail(db, projectProfileId, { calculateHealth: false });
  if (!detail) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  const classes = documentClasses(detail);
  const domains = projectDomainIds(detail);
  const baselineDocs = ["EIR", "BEP", "MIDP", "TIDP"].filter((classification) => classes.has(classification)).length;
  const bimMaturityScore = Math.round((baselineDocs / 4) * 70 + (domains.has("BIM") ? 15 : 0) + (domains.has("ISO19650") ? 15 : 0));
  const readinessSignals = ["COBie", "GIS", "DigitalTwin", "PowerPlatform", "AssetInformation", "BuildingSafety"]
    .filter((domain) => domains.has(domain)).length;
  const digitalReadinessScore = Math.min(100, Math.round(readinessSignals * 14 + (detail.documents.length ? 10 : 0) + (detail.meetings.length ? 10 : 0)));
  const review = {
    projectProfileId: detail.profile.id,
    projectName: detail.profile.projectName,
    projectScore: detail.healthScore.score,
    projectHealthStatus: detail.healthScore.status,
    informationQualityScore: detail.informationQuality.score,
    informationQualityStatus: detail.informationQuality.status,
    bimMaturityAssessment: {
      score: bimMaturityScore,
      status: bimMaturityScore < 45 ? "low" : bimMaturityScore < 75 ? "developing" : "strong",
      explanation: `${baselineDocs}/4 baseline EIR/BEP/MIDP/TIDP metadata records are linked. BIM tag present: ${domains.has("BIM")}. ISO 19650 tag present: ${domains.has("ISO19650")}.`,
    },
    digitalReadinessAssessment: {
      score: digitalReadinessScore,
      status: digitalReadinessScore < 35 ? "low" : digitalReadinessScore < 70 ? "emerging" : "strong",
      explanation: `${readinessSignals} specialist domain signal(s) found. No autonomous analysis, file reading or external write has been run.`,
    },
    recommendations: [
      ...(detail.healthScore.inputs?.missingClasses || []).map((classification) => ({
        recommendation: `Link or confirm ${classification} metadata.`,
        sourceReference: `project_profile:${detail.profile.id}`,
        confidence: "high",
      })),
      !detail.meetings.length ? {
        recommendation: "Confirm latest client meeting or decision trail.",
        sourceReference: `project_profile:${detail.profile.id}`,
        confidence: "medium",
      } : null,
      detail.informationQuality.status !== "green" ? {
        recommendation: "Run a read-only project information quality review before deeper Sarah recommendations.",
        sourceReference: `project_profile:${detail.profile.id}`,
        confidence: "high",
      } : null,
    ].filter(Boolean).slice(0, 8),
    sourceReferences: [
      sourceReference(`project_profile:${detail.profile.id}`, detail.profile.projectName, "project_profile"),
      sourceReference(`project_health:${detail.profile.id}`, detail.healthScore.explanation, "project_health"),
    ],
    boundary: SARAH_READ_ONLY_BOUNDARY,
  };
  if (audit) recordSarahAudit(db, {
    eventType: "project_health_review",
    userAction,
    projectProfileId: detail.profile.id,
    dataCategories: ["project_profile", "project_health", "information_quality", "digital_construction_domains"],
    metadata: { projectName: detail.profile.projectName, projectScore: review.projectScore },
  });
  return review;
}

export function buildSarahProjectAnalysisInput(db, projectProfileId, {
  retrievedMemoryContext = { records: [], sourceRecordReferences: [] },
} = {}) {
  const detail = getProjectDetail(db, projectProfileId, { calculateHealth: false });
  if (!detail) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  const baseProjectInput = buildProjectAnalysisInput(db, projectProfileId, { retrievedMemoryContext });
  const observations = buildDomainObservations(detail);
  const opportunities = generateSarahOpportunities(detail);
  const healthReview = generateSarahProjectHealthReview(db, projectProfileId, { audit: false });
  return {
    specialist: {
      name: "Sarah",
      title: "Digital Construction Director",
      reportsTo: "Alfred",
      mission: "Help Patrick deliver better projects, reduce project risk, improve information quality, identify opportunities, and support business growth through digital construction expertise.",
      domains: SARAH_DOMAINS,
    },
    ...baseProjectInput,
    sarahDomainObservations: observations,
    sarahOpportunities: opportunities,
    sarahProjectHealthReview: healthReview,
    deliverableSupport: SARAH_DELIVERABLE_TYPES,
    relevantMemory: retrievedMemoryContext.records,
    sourceRecordReferences: [
      ...baseProjectInput.sourceRecordReferences,
      ...observations.map((observation) => sourceReference(observation.sourceReference, observation.observation, "sarah_domain_observation")),
      ...opportunities.map((opportunity) => sourceReference(opportunity.sourceReference, opportunity.opportunity, "sarah_opportunity")),
      ...(retrievedMemoryContext.sourceRecordReferences || []),
    ].slice(0, 80),
    boundary: SARAH_READ_ONLY_BOUNDARY,
  };
}

export function buildSarahClientReviewInput(db, clientName, {
  retrievedMemoryContext = { records: [], sourceRecordReferences: [] },
} = {}) {
  const cleanClient = normalizeText(clientName);
  if (!cleanClient) {
    const error = new Error("client is required");
    error.statusCode = 400;
    throw error;
  }
  const profiles = listProjectProfiles(db)
    .filter((profile) => `${profile.clientName} ${profile.projectName}`.toLowerCase().includes(cleanClient.toLowerCase()));
  const details = profiles.map((profile) => getProjectDetail(db, profile.id, { calculateHealth: false })).filter(Boolean);
  const opportunities = details.flatMap((detail) => generateSarahOpportunities(detail));
  return {
    specialist: { name: "Sarah", title: "Digital Construction Director", reportsTo: "Alfred", domains: SARAH_DOMAINS },
    client: cleanClient,
    portfolioSummary: details.map((detail) => ({
      projectProfileId: detail.profile.id,
      projectName: detail.profile.projectName,
      status: detail.profile.status,
      currentPhase: detail.profile.currentPhase,
      healthStatus: detail.healthScore.status,
      informationQualityStatus: detail.informationQuality.status,
      domains: detail.digitalConstruction.domains,
      sourceReference: `project_profile:${detail.profile.id}`,
    })),
    clientRisks: details.flatMap((detail) => detail.risks.map((risk) => ({ ...compactRecord(risk, ["id", "title", "detail", "severity", "status", "confidence"]), projectName: detail.profile.projectName, sourceReference: `project_risk:${risk.id}` }))).sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 12),
    openActions: details.flatMap((detail) => detail.actions.filter((action) => action.status !== "complete").map((action) => ({ ...compactRecord(action, ["id", "title", "detail", "priority", "due", "status", "confidence"]), projectName: detail.profile.projectName, sourceReference: `project_action:${action.id}` }))).slice(0, 12),
    missingInformation: details.map((detail) => ({
      projectProfileId: detail.profile.id,
      projectName: detail.profile.projectName,
      missing: [
        ...(detail.healthScore.inputs?.missingClasses || []).map((classification) => `Missing ${classification}`),
        !detail.contacts.length ? "No confirmed contacts" : "",
        !detail.meetings.length ? "No linked meetings" : "",
      ].filter(Boolean),
      sourceReference: `project_profile:${detail.profile.id}`,
    })).filter((item) => item.missing.length),
    opportunities,
    relevantMemory: retrievedMemoryContext.records,
    sourceRecordReferences: [
      ...details.map((detail) => sourceReference(`project_profile:${detail.profile.id}`, detail.profile.projectName, "project_profile")),
      ...opportunities.map((opportunity) => sourceReference(opportunity.sourceReference, opportunity.opportunity, "sarah_opportunity")),
      ...(retrievedMemoryContext.sourceRecordReferences || []),
    ].slice(0, 80),
    boundary: SARAH_READ_ONLY_BOUNDARY,
  };
}

export function draftSarahDeliverable(db, {
  projectProfileId,
  deliverableType,
  userAction = "api:sarah-draft-deliverable",
} = {}) {
  if (!SARAH_DELIVERABLE_TYPES.includes(deliverableType)) {
    const error = new Error(`deliverableType must be one of: ${SARAH_DELIVERABLE_TYPES.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
  const detail = getProjectDetail(db, projectProfileId, { calculateHealth: false });
  if (!detail) {
    const error = new Error("Project profile not found");
    error.statusCode = 404;
    throw error;
  }
  const title = deliverableType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const sections = {
    bim_strategy_outline: ["Purpose and Project Context", "BIM Objectives", "Information Requirements", "Delivery Governance", "Risks and Decisions"],
    eir_outline: ["Appointing Party Requirements", "Information Purposes", "Exchange Requirements", "Acceptance Criteria", "Review Questions"],
    air_outline: ["Asset Information Purpose", "Required Asset Data", "COBie/Asset Register Expectations", "Completeness Risks", "Review Questions"],
    bep_outline: ["Project BIM Response", "Roles and Responsibilities", "MIDP/TIDP Approach", "CDE and Review Process", "Risks and Assumptions"],
    information_management_plan: ["Information Governance", "CDE Workflow", "Information Delivery Schedule", "Quality Review", "Escalation Points"],
    digital_twin_strategy_outline: ["Twin Purpose", "Asset and System Scope", "Operational Data Needs", "Model/Sensor Readiness", "Roadmap Questions"],
    gis_strategy_outline: ["Spatial Information Purpose", "Datasets and Layers", "Coordinate/Location Requirements", "Asset Mapping Approach", "GIS Risks"],
  }[deliverableType];
  const outline = sections.map((section, index) => ({
    heading: `${index + 1}. ${section}`,
    prompts: [
      `Use confirmed project profile source project_profile:${detail.profile.id}.`,
      "Confirm assumptions before relying on this in a client deliverable.",
      "No document was created, edited, published or saved externally.",
    ],
  }));
  const draft = {
    title: `${detail.profile.projectName} ${title}`,
    deliverableType,
    projectProfileId: detail.profile.id,
    projectName: detail.profile.projectName,
    clientName: detail.profile.clientName,
    status: "draft_outline_only",
    outline,
    assumptions: [
      "Sarah has not read full document contents unless they are explicitly supplied in project records.",
      "This is an internal draft outline for Patrick's review.",
    ],
    sourceReferences: [
      sourceReference(`project_profile:${detail.profile.id}`, detail.profile.projectName, "project_profile"),
      ...detail.tags.slice(0, 8).map((tag) => sourceReference(`project_tag:${tag.id}`, tag.tag, "project_tag")),
    ],
    boundary: SARAH_READ_ONLY_BOUNDARY,
  };
  recordSarahAudit(db, {
    eventType: "deliverable_draft",
    userAction,
    projectProfileId: detail.profile.id,
    dataCategories: ["project_profile", "project_tags", "deliverable_outline"],
    metadata: { deliverableType, projectName: detail.profile.projectName, externalDocumentCreated: false },
  });
  return draft;
}

export function getSarahDashboard(db) {
  const dashboard = getProjectDashboard(db);
  const details = listProjectProfiles(db).map((profile) => getProjectDetail(db, profile.id, { calculateHealth: false })).filter(Boolean);
  const opportunities = details.flatMap((detail) => generateSarahOpportunities(detail));
  const recent = (table, type, fields = "title, detail, severity, status, updated_at") => db.prepare(`
    SELECT ${fields}, p.project_name
    FROM ${table} r
    JOIN project_profiles p ON p.id = r.project_profile_id
    ORDER BY r.updated_at DESC, r.id DESC
    LIMIT 8
  `).all().map((row) => ({ ...mapRow(row), type }));
  return {
    profile: getSarahProfile(db),
    boundary: SARAH_READ_ONLY_BOUNDARY,
    metrics: {
      projectsRequiringAttention: dashboard.projects.filter((project) => ["red", "amber"].includes(project.healthScore.status)).length,
      informationRisks: dashboard.projects.filter((project) => project.informationQuality?.status !== "green").length,
      highRiskProjects: dashboard.highRiskProjects.length,
      missingInformation: dashboard.missingInformation.length,
      opportunities: opportunities.length,
    },
    projectsRequiringAttention: dashboard.projects.filter((project) => ["red", "amber"].includes(project.healthScore.status)).slice(0, 8),
    informationRisks: dashboard.projects.filter((project) => project.informationQuality?.status !== "green").map((project) => ({
      projectProfileId: project.profile.id,
      projectName: project.profile.projectName,
      informationQuality: project.informationQuality,
    })),
    highRiskProjects: dashboard.highRiskProjects,
    missingInformation: dashboard.missingInformation,
    opportunities,
    digitalTwinOpportunities: opportunities.filter((opportunity) => opportunity.category === "Digital Twin"),
    gisOpportunities: opportunities.filter((opportunity) => opportunity.category === "GIS"),
    powerPlatformOpportunities: opportunities.filter((opportunity) => opportunity.category === "Power Platform"),
    clientOpportunities: Object.values(opportunities.reduce((acc, opportunity) => {
      const key = opportunity.clientName || opportunity.projectName;
      acc[key] ||= { clientName: key, opportunities: [], sourceReferences: [] };
      acc[key].opportunities.push(opportunity.opportunity);
      acc[key].sourceReferences.push(opportunity.sourceReference);
      return acc;
    }, {})),
    recentDecisions: recent("project_decisions", "decision", "r.id, r.title, r.detail, r.status, r.updated_at"),
    recentMeetings: recent("project_meetings", "meeting", "r.id, r.title, r.start_datetime AS updated_at, r.association_reason AS detail"),
    recentRisks: recent("project_risks", "risk", "r.id, r.title, r.detail, r.severity, r.status, r.updated_at"),
    domains: SARAH_DOMAINS,
    digitalConstructionDomains: listDigitalConstructionDomains(db),
    futureTeamPlaceholders: listSarahTeamPlaceholders(db),
  };
}

export function sarahBriefingForDaily(db) {
  const dashboard = getSarahDashboard(db);
  const briefItems = [
    ...dashboard.informationRisks.slice(0, 3).map((item) => ({
      title: `${item.projectName} information quality risk`,
      detail: item.informationQuality.explanation,
      priority: item.informationQuality.status === "red" ? "high" : "medium",
      sourceReference: `project_profile:${item.projectProfileId}`,
    })),
    ...dashboard.opportunities.slice(0, 3).map((opportunity) => ({
      title: `${opportunity.projectName}: ${opportunity.category} opportunity`,
      detail: opportunity.businessImpact,
      priority: opportunity.confidence === "high" ? "medium" : "low",
      sourceReference: opportunity.sourceReference,
    })),
  ].slice(0, 6);
  return {
    title: "Daily Digital Construction Brief",
    items: briefItems,
    summary: briefItems.length
      ? `${briefItems.length} Sarah digital construction signal(s) require review.`
      : "No Sarah digital construction exceptions detected from current records.",
    boundary: SARAH_READ_ONLY_BOUNDARY,
  };
}
