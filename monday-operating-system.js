export const MONDAY_OPERATING_BOUNDARY = Object.freeze({
  internalOnly: true,
  advisoryOnly: true,
  mondayConnected: false,
  mondayReadEnabled: false,
  mondayWriteEnabled: false,
  externalWritesEnabled: false,
  autonomousExecutionEnabled: false,
  approvalRequiredForFutureWrites: true,
});

export const MONDAY_STATUSES = Object.freeze([
  "New",
  "Planned",
  "In Progress",
  "Waiting",
  "Blocked",
  "Review",
  "Approved",
  "Rejected",
  "Complete",
]);

export const MONDAY_PRIORITIES = Object.freeze([
  "Low",
  "Medium",
  "High",
  "Critical",
]);

export const AGENT_BOARD_MODELS = Object.freeze([
  {
    agentId: "alfred",
    agentName: "Alfred",
    businessArea: "Group Executive Office",
    businessEntityId: "group",
    capacity: 10,
    boards: [
      ["executive_coordination", "Alfred - Executive Coordination", "Cross-business work, priorities and operating cadence."],
      ["decisions", "Alfred - Decisions", "Patrick decisions, approvals and board-level choices."],
      ["cross_business_actions", "Alfred - Cross-Business Actions", "Actions spanning multiple Alfred-managed businesses."],
    ],
  },
  {
    agentId: "sarah",
    agentName: "Sarah",
    businessArea: "Digital Construction",
    businessEntityId: "digitize",
    capacity: 8,
    boards: [
      ["project_reviews", "Sarah - Project Reviews", "Digitize project reviews and attention signals."],
      ["bim_reviews", "Sarah - BIM Reviews", "BIM, ISO 19650, COBie and information management review queue."],
      ["digital_construction_actions", "Sarah - Digital Construction Actions", "Advisory digital construction follow-ups."],
      ["client_risks", "Sarah - Client Risks", "Client/project information risks requiring review."],
    ],
  },
  {
    agentId: "olivia",
    agentName: "Olivia",
    businessArea: "Group Finance",
    businessEntityId: "group",
    capacity: 8,
    boards: [
      ["forecasts", "Olivia - Forecasts", "Forecast reviews and revenue planning."],
      ["board_reports", "Olivia - Board Reports", "Quarterly and board-level financial reporting."],
      ["revenue_reviews", "Olivia - Revenue Reviews", "Order book, debtor and revenue intelligence."],
      ["order_book_actions", "Olivia - Order Book Actions", "Internal follow-ups from financial analysis."],
    ],
  },
  {
    agentId: "westbridge-property-director",
    agentName: "Westbridge Property Director",
    businessArea: "Westbridge Property Group",
    businessEntityId: "westbridge-property-group",
    capacity: 8,
    boards: [
      ["property_opportunities", "Westbridge - Property Opportunities", "Property leads, opportunities and pipeline reviews."],
      ["due_diligence", "Westbridge - Due Diligence", "Legal, planning, finance and survey due diligence checklist."],
      ["portfolio_reviews", "Westbridge - Portfolio Reviews", "Portfolio performance and cashflow reviews."],
      ["investment_decisions", "Westbridge - Investment Decisions", "Advisory-only investment decisions requiring Patrick review."],
    ],
  },
  {
    agentId: "sentinel",
    agentName: "Sentinel",
    businessArea: "Group Security",
    businessEntityId: "group",
    capacity: 8,
    boards: [
      ["security_reviews", "Sentinel - Security Reviews", "Security review queue and advisory findings."],
      ["permission_reviews", "Sentinel - Permission Reviews", "Microsoft, SharePoint and access-control review queue."],
      ["risk_reviews", "Sentinel - Risk Reviews", "Security and AI-governance risk reviews."],
      ["compliance_actions", "Sentinel - Compliance Actions", "Compliance and policy follow-ups."],
    ],
  },
  {
    agentId: "maya",
    agentName: "Maya",
    businessArea: "Media Studio",
    businessEntityId: "media-businesses",
    capacity: 6,
    boards: [
      ["content_pipeline", "Maya - Content Pipeline", "Future media content pipeline."],
      ["linkedin", "Maya - LinkedIn", "Future LinkedIn content operating board."],
      ["youtube", "Maya - YouTube", "Future YouTube content operating board."],
      ["tiktok", "Maya - TikTok", "Future TikTok content operating board."],
      ["campaigns", "Maya - Campaigns", "Future campaign planning board."],
    ],
  },
  {
    agentId: "alex",
    agentName: "Alex",
    businessArea: "Group Growth",
    businessEntityId: "group",
    capacity: 6,
    boards: [
      ["growth_pipeline", "Alex - Growth Pipeline", "Future growth opportunities and lead intelligence."],
      ["partnerships", "Alex - Partnerships", "Future partner and channel development."],
      ["sales_opportunities", "Alex - Sales Opportunities", "Future sales opportunity triage."],
      ["crm_actions", "Alex - CRM Actions", "Future CRM follow-ups and hygiene."],
    ],
  },
  {
    agentId: "ethan",
    agentName: "Ethan",
    businessArea: "Technology",
    businessEntityId: "group",
    capacity: 6,
    boards: [
      ["platform_architecture", "Ethan - Platform Architecture", "Future architecture and product engineering review."],
      ["hosting", "Ethan - Hosting", "Future cloud hosting and deployment operations."],
      ["devops", "Ethan - DevOps", "Future CI, release and operations board."],
      ["technical_debt", "Ethan - Technical Debt", "Future engineering quality and debt review."],
      ["security_implementation", "Ethan - Security Implementation", "Future technical security implementation queue."],
    ],
  },
  {
    agentId: "liam",
    agentName: "Liam",
    businessArea: "Power Platform",
    businessEntityId: "digitize",
    capacity: 6,
    boards: [
      ["power_apps", "Liam - Power Apps", "Future Power Apps delivery queue."],
      ["power_bi", "Liam - Power BI", "Future analytics and reporting queue."],
      ["dataverse", "Liam - Dataverse", "Future Dataverse architecture queue."],
      ["sharepoint", "Liam - SharePoint", "Future SharePoint and document platform queue."],
      ["power_automate", "Liam - Power Automate", "Future workflow automation queue."],
    ],
  },
  {
    agentId: "emma",
    agentName: "Emma",
    businessArea: "Customer Success",
    businessEntityId: "group",
    capacity: 6,
    boards: [
      ["customer_success", "Emma - Customer Success", "Future customer success operating board."],
      ["support_tickets", "Emma - Support Tickets", "Future support triage board."],
      ["client_feedback", "Emma - Client Feedback", "Future client feedback review board."],
      ["escalations", "Emma - Escalations", "Future client escalation board."],
    ],
  },
  {
    agentId: "james",
    agentName: "James",
    businessArea: "Product Studio",
    businessEntityId: "council-assurance-platform",
    capacity: 6,
    boards: [
      ["product_roadmap", "James - Product Roadmap", "Future product roadmap board."],
      ["platform_features", "James - Platform Features", "Future SaaS feature review board."],
      ["saas_opportunities", "James - SaaS Opportunities", "Future SaaS opportunity validation board."],
    ],
  },
]);

const COMPLETE_STATUSES = new Set(["Complete", "Rejected"]);
const SOURCE_DISPLAY_NAMES = Object.freeze({
  action: "Executive Briefing",
  risk: "Risk Register",
  opportunity: "Opportunity Register",
  decision: "Decision Register",
  meeting_action: "Meeting Intelligence",
  meeting_decision: "Meeting Intelligence",
  meeting_risk: "Meeting Intelligence",
  meeting_opportunity: "Meeting Intelligence",
  meeting_feedback: "Meeting Intelligence",
  project_intelligence: "Project Intelligence",
  financial: "Olivia",
  property: "Westbridge",
  sarah: "Sarah",
  power_platform_risk: "Liam",
  power_platform_opportunity: "Liam",
  power_platform_decision: "Liam",
  power_platform_solution: "Liam",
  product_risk: "James",
  product_opportunity: "James",
  product_decision: "James",
  product_roadmap_item: "James",
  product_venture: "James",
  memory: "Memory",
});

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

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

function boolInt(value) {
  return value ? 1 : 0;
}

function normalizeStatus(value, fallback = "New") {
  const text = clean(value || fallback).toLowerCase().replace(/[_-]+/g, " ");
  const match = MONDAY_STATUSES.find((status) => status.toLowerCase() === text);
  if (match) return match;
  if (["open", "todo", "to do"].includes(text)) return "New";
  if (["in progress", "started", "active"].includes(text)) return "In Progress";
  if (["waiting", "pending"].includes(text)) return "Waiting";
  if (["blocked", "stuck"].includes(text)) return "Blocked";
  if (["review", "needs review", "unreviewed"].includes(text)) return "Review";
  if (["approved", "accepted"].includes(text)) return "Approved";
  if (["rejected", "declined", "closed"].includes(text)) return "Rejected";
  if (["complete", "completed", "done"].includes(text)) return "Complete";
  return fallback;
}

function normalizePriority(value, fallback = "Medium") {
  const text = clean(value || fallback).toLowerCase();
  const match = MONDAY_PRIORITIES.find((priority) => priority.toLowerCase() === text);
  if (match) return match;
  if (["urgent", "critical", "red"].includes(text)) return "Critical";
  if (["high", "amber"].includes(text)) return "High";
  if (["low", "green"].includes(text)) return "Low";
  return fallback;
}

function normalizeAgentId(value = "alfred") {
  const requested = clean(value || "alfred").toLowerCase();
  const byId = AGENT_BOARD_MODELS.find((agent) => agent.agentId === requested);
  if (byId) return byId.agentId;
  const byName = AGENT_BOARD_MODELS.find((agent) => agent.agentName.toLowerCase() === requested);
  return byName?.agentId || "alfred";
}

function agentDefinition(agentId = "alfred") {
  return AGENT_BOARD_MODELS.find((agent) => agent.agentId === normalizeAgentId(agentId)) || AGENT_BOARD_MODELS[0];
}

function businessEntityFor({ agentId = "", businessEntityId = "", companyId = "" } = {}) {
  if (clean(businessEntityId)) return clean(businessEntityId);
  const company = clean(companyId).toLowerCase();
  if (company === "digitize") return "digitize";
  if (company === "westbridge") return "westbridge-property-group";
  if (company === "product") return "council-assurance-platform";
  if (company === "media") return "media-businesses";
  if (company === "venture") return "ai-businesses";
  return agentDefinition(agentId).businessEntityId || "group";
}

function companyForBusinessEntity(businessEntityId = "") {
  const id = clean(businessEntityId);
  if (id === "digitize") return "digitize";
  if (id === "westbridge-property-group") return "westbridge";
  if (id === "council-assurance-platform") return "product";
  if (id === "media-businesses") return "media";
  if (id === "ai-businesses" || id === "future-ventures") return "venture";
  return "";
}

function sourceReference(sourceType = "manual", sourceId = "", label = "") {
  const sourceName = SOURCE_DISPLAY_NAMES[sourceType] || "Alfred";
  const suffix = sourceId ? `:${sourceId}` : "";
  return `${sourceName} (${sourceType}${suffix})${label ? ` - ${label}` : ""}`;
}

function rowId(row) {
  return row?.lastInsertRowid ? Number(row.lastInsertRowid) : undefined;
}

function getMappingForAgent(db, agentId = "alfred") {
  ensureMondayBoardMappings(db);
  const normalized = normalizeAgentId(agentId);
  return db.prepare(`
    SELECT *
    FROM monday_board_mappings
    WHERE agent_id = ?
    ORDER BY id ASC
    LIMIT 1
  `).get(normalized) || null;
}

function findSourceRecord(db, table, sourceType, sourceId) {
  return db.prepare(`
    SELECT *
    FROM ${table}
    WHERE source_type = ? AND source_id = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(sourceType, String(sourceId)) || null;
}

function projectNameFor(db, projectId = "") {
  if (!projectId) return "";
  const project = db.prepare("SELECT name FROM projects WHERE id = ?").get(projectId);
  return project?.name || "";
}

function clientNameFor(db, clientId = "") {
  if (!clientId) return "";
  const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(clientId);
  return client?.name || "";
}

function mapWorkItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    itemType: row.item_type,
    ownerAgentId: row.owner_agent_id,
    ownerAgentName: row.owner_agent_name,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    clientName: row.client_name,
    projectName: row.project_name,
    priority: row.priority,
    status: row.status,
    dueDate: row.due_date,
    blockedReason: row.blocked_reason,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceReference: row.source_reference,
    mondayBoardMappingId: row.monday_board_mapping_id,
    mondayItemId: row.monday_item_id,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkload(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    businessArea: row.business_area,
    activeItems: row.active_items,
    overdueItems: row.overdue_items,
    blockedItems: row.blocked_items,
    priorityItems: row.priority_items,
    deliverablesDue: row.deliverables_due,
    workloadScore: row.workload_score,
    healthStatus: row.health_status,
    workloadStatus: row.workload_status,
    capacity: row.capacity,
    notes: row.notes,
    calculatedAt: row.calculated_at,
    updatedAt: row.updated_at,
  };
}

function mapDeliverable(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    ownerAgentId: row.owner_agent_id,
    ownerAgentName: row.owner_agent_name,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    projectName: row.project_name,
    clientName: row.client_name,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    linkedFilePlaceholder: row.linked_file_placeholder,
    linkedMeetingId: row.linked_meeting_id,
    linkedProjectId: row.linked_project_id,
    linkedBusinessId: row.linked_business_id,
    linkedMemoryReference: row.linked_memory_reference,
    feedbackStatus: row.feedback_status,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceReference: row.source_reference,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkloadMetric(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    openItems: row.open_items,
    highPriorityItems: row.high_priority_items,
    overdueItems: row.overdue_items,
    blockedItems: row.blocked_items,
    deliverablesDue: row.deliverables_due,
    workloadScore: row.workload_score,
    healthStatus: row.health_status,
    calculatedAt: row.calculated_at,
    metadata: parseJson(row.metadata, {}),
    updatedAt: row.updated_at,
  };
}

function mapOperationalSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    ownerAgentId: row.owner_agent_id,
    ownerAgentName: row.owner_agent_name,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    businessImpact: row.business_impact,
    priority: row.priority,
    status: row.status,
    recommendedAction: row.recommended_action,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceReference: row.source_reference,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDecision(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    ownerAgentId: row.owner_agent_id,
    ownerAgentName: row.owner_agent_name,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    approvalRequired: Boolean(row.approval_required),
    priority: row.priority,
    status: row.status,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceReference: row.source_reference,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeetingFollowup(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meeting_id,
    meetingTitle: row.meeting_title,
    sourceType: row.source_type,
    sourceId: row.source_id,
    workItemId: row.work_item_id,
    ownerAgentId: row.owner_agent_id,
    ownerAgentName: row.owner_agent_name,
    extractedAction: row.extracted_action,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    sourceReference: row.source_reference,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOutputFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    outputType: row.output_type,
    outputTitle: row.output_title,
    rating: row.rating,
    recommendationStatus: row.recommendation_status,
    lessonLearned: row.lesson_learned,
    futureWorkSuggestion: row.future_work_suggestion,
    memoryReference: row.memory_reference,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceReference: row.source_reference,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBoardMapping(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    boardKind: row.board_kind,
    boardName: row.board_name,
    mondayBoardId: row.monday_board_id,
    mondayGroupId: row.monday_group_id,
    status: row.status,
    description: row.description,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSyncStatus(row) {
  if (!row) return null;
  return {
    id: row.id,
    mappingId: row.mapping_id,
    agentId: row.agent_id,
    boardKind: row.board_kind,
    status: row.status,
    readEnabled: Boolean(row.read_enabled),
    writeEnabled: Boolean(row.write_enabled),
    lastReadAt: row.last_read_at,
    lastWriteAt: row.last_write_at,
    message: row.message,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    userAction: row.user_action,
    recordType: row.record_type,
    recordId: row.record_id,
    agentId: row.agent_id,
    dataCategories: parseJson(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    externalWriteAttempted: Boolean(row.external_write_attempted),
    status: row.status,
    errorCode: row.error_code,
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
  };
}

export function ensureMondayBoardMappings(db) {
  const insertMapping = db.prepare(`
    INSERT INTO monday_board_mappings (
      agent_id, agent_name, board_kind, board_name, monday_board_id, monday_group_id,
      status, description, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, '', '', 'Planned', ?, ?, ?, ?)
    ON CONFLICT(agent_id, board_kind) DO UPDATE SET
      agent_name = excluded.agent_name,
      board_name = excluded.board_name,
      description = excluded.description,
      status = CASE
        WHEN monday_board_mappings.status = 'Connected' THEN 'Connected'
        ELSE 'Planned'
      END,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
  const upsertSync = db.prepare(`
    INSERT INTO monday_sync_status (
      mapping_id, agent_id, board_kind, status, read_enabled, write_enabled,
      message, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, 'Planned', 0, 0, ?, ?, ?, ?)
    ON CONFLICT(agent_id, board_kind) DO UPDATE SET
      mapping_id = excluded.mapping_id,
      status = CASE
        WHEN monday_sync_status.status = 'Connected' THEN 'Connected'
        ELSE 'Planned'
      END,
      read_enabled = 0,
      write_enabled = 0,
      message = excluded.message,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
  const timestamp = nowIso();
  for (const agent of AGENT_BOARD_MODELS) {
    for (const [boardKind, boardName, description] of agent.boards) {
      insertMapping.run(
        agent.agentId,
        agent.agentName,
        boardKind,
        boardName,
        description,
        json({ businessArea: agent.businessArea, businessEntityId: agent.businessEntityId, capacity: agent.capacity }),
        timestamp,
        timestamp,
      );
      const mapping = db.prepare(`
        SELECT id FROM monday_board_mappings WHERE agent_id = ? AND board_kind = ?
      `).get(agent.agentId, boardKind);
      upsertSync.run(
        mapping.id,
        agent.agentId,
        boardKind,
        "Future Monday.com sync placeholder only. No live read or write connection is enabled.",
        json({ boundary: MONDAY_OPERATING_BOUNDARY }),
        timestamp,
        timestamp,
      );
    }
  }

  return db.prepare("SELECT * FROM monday_board_mappings ORDER BY agent_id ASC, board_kind ASC")
    .all()
    .map(mapBoardMapping);
}

export function recordMondayAudit(db, {
  eventType,
  userAction = "",
  recordType = "",
  recordId = "",
  agentId = "",
  dataCategories = [],
  outputSaved = true,
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO monday_audit_events (
      event_type, user_action, record_type, record_id, agent_id, data_categories,
      output_saved, execution_attempted, external_write_attempted, status, error_code,
      metadata, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
  `).run(
    eventType || "monday_operating_event",
    clean(userAction),
    clean(recordType),
    String(recordId || ""),
    normalizeAgentId(agentId || "alfred"),
    json(dataCategories),
    boolInt(outputSaved),
    status === "error" ? "error" : "success",
    clean(errorCode),
    json({ ...metadata, boundary: MONDAY_OPERATING_BOUNDARY }),
    nowIso(),
  );
  return db.prepare("SELECT * FROM monday_audit_events WHERE id = ?").get(rowId(result));
}

function insertWorkItem(db, payload = {}, { audit = true } = {}) {
  ensureMondayBoardMappings(db);
  const ownerAgentId = normalizeAgentId(payload.ownerAgentId || payload.owner_agent_id || payload.agentId);
  const owner = agentDefinition(ownerAgentId);
  const businessEntityId = businessEntityFor({
    agentId: ownerAgentId,
    businessEntityId: payload.businessEntityId || payload.business_entity_id,
    companyId: payload.companyId || payload.company_id,
  });
  const companyId = clean(payload.companyId || payload.company_id || companyForBusinessEntity(businessEntityId));
  const mapping = getMappingForAgent(db, ownerAgentId);
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO work_items (
      title, detail, item_type, owner_agent_id, owner_agent_name, business_entity_id,
      company_id, client_name, project_name, priority, status, due_date, blocked_reason,
      source_type, source_id, source_reference, monday_board_mapping_id, monday_item_id,
      metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || "Untitled work item"),
    clean(payload.detail || ""),
    clean(payload.itemType || payload.item_type || "task"),
    ownerAgentId,
    owner.agentName,
    businessEntityId,
    companyId || null,
    clean(payload.clientName || payload.client_name),
    clean(payload.projectName || payload.project_name),
    normalizePriority(payload.priority),
    normalizeStatus(payload.status),
    clean(payload.dueDate || payload.due_date || payload.due || ""),
    clean(payload.blockedReason || payload.blocked_reason || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || sourceReference(payload.sourceType || payload.source_type || "manual", payload.sourceId || payload.source_id || "")),
    mapping?.id || null,
    "",
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const item = db.prepare("SELECT * FROM work_items WHERE id = ?").get(rowId(result));
  if (audit) {
    recordMondayAudit(db, {
      eventType: "work_item_created",
      userAction: payload.userAction || "monday-os:work-item:create",
      recordType: "work_item",
      recordId: item.id,
      agentId: ownerAgentId,
      dataCategories: ["work_item", "internal_monday_operating_system"],
      metadata: { sourceType: item.source_type, sourceId: item.source_id },
    });
  }
  return mapWorkItem(item);
}

export function createWorkItem(db, payload = {}) {
  return insertWorkItem(db, payload);
}

export function updateWorkItem(db, id, payload = {}) {
  const current = db.prepare("SELECT * FROM work_items WHERE id = ?").get(id);
  if (!current) {
    const error = new Error("Work item not found");
    error.statusCode = 404;
    throw error;
  }
  const ownerAgentId = normalizeAgentId(payload.ownerAgentId || payload.owner_agent_id || current.owner_agent_id);
  const owner = agentDefinition(ownerAgentId);
  const businessEntityId = businessEntityFor({
    agentId: ownerAgentId,
    businessEntityId: payload.businessEntityId || payload.business_entity_id || current.business_entity_id,
    companyId: payload.companyId || payload.company_id || current.company_id,
  });
  db.prepare(`
    UPDATE work_items SET
      title = ?,
      detail = ?,
      item_type = ?,
      owner_agent_id = ?,
      owner_agent_name = ?,
      business_entity_id = ?,
      company_id = ?,
      client_name = ?,
      project_name = ?,
      priority = ?,
      status = ?,
      due_date = ?,
      blocked_reason = ?,
      metadata = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    clean(payload.title ?? current.title),
    clean(payload.detail ?? current.detail),
    clean(payload.itemType || payload.item_type || current.item_type),
    ownerAgentId,
    owner.agentName,
    businessEntityId,
    clean(payload.companyId || payload.company_id || current.company_id || companyForBusinessEntity(businessEntityId)) || null,
    clean(payload.clientName || payload.client_name || current.client_name),
    clean(payload.projectName || payload.project_name || current.project_name),
    normalizePriority(payload.priority || current.priority),
    normalizeStatus(payload.status || current.status),
    clean(payload.dueDate || payload.due_date || payload.due || current.due_date),
    clean(payload.blockedReason || payload.blocked_reason || current.blocked_reason),
    json({ ...parseJson(current.metadata, {}), ...(payload.metadata || {}) }),
    nowIso(),
    id,
  );
  recordMondayAudit(db, {
    eventType: "work_item_updated",
    userAction: payload.userAction || "monday-os:work-item:update",
    recordType: "work_item",
    recordId: id,
    agentId: ownerAgentId,
    dataCategories: ["work_item", "internal_monday_operating_system"],
    metadata: {
      previousStatus: current.status,
      nextStatus: normalizeStatus(payload.status || current.status),
    },
  });
  return mapWorkItem(db.prepare("SELECT * FROM work_items WHERE id = ?").get(id));
}

export function listWorkItems(db, { limit = 100, ownerAgentId = "", status = "" } = {}) {
  const clauses = [];
  const params = [];
  if (ownerAgentId) {
    clauses.push("owner_agent_id = ?");
    params.push(normalizeAgentId(ownerAgentId));
  }
  if (status) {
    clauses.push("status = ?");
    params.push(normalizeStatus(status));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(Number(limit) || 100);
  return db.prepare(`
    SELECT *
    FROM work_items
    ${where}
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      CASE status WHEN 'Blocked' THEN 1 WHEN 'Review' THEN 2 WHEN 'In Progress' THEN 3 WHEN 'New' THEN 4 ELSE 5 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(...params).map(mapWorkItem);
}

export function createDeliverable(db, payload = {}) {
  ensureMondayBoardMappings(db);
  const ownerAgentId = normalizeAgentId(payload.ownerAgentId || payload.owner_agent_id || payload.agentId);
  const owner = agentDefinition(ownerAgentId);
  const businessEntityId = businessEntityFor({
    agentId: ownerAgentId,
    businessEntityId: payload.businessEntityId || payload.business_entity_id,
    companyId: payload.companyId || payload.company_id,
  });
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO deliverables (
      title, detail, owner_agent_id, owner_agent_name, business_entity_id, company_id,
      project_name, client_name, status, priority, due_date, linked_file_placeholder,
      linked_meeting_id, linked_project_id, linked_business_id, linked_memory_reference,
      feedback_status, source_type, source_id, source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || "Untitled deliverable"),
    clean(payload.detail || ""),
    ownerAgentId,
    owner.agentName,
    businessEntityId,
    clean(payload.companyId || payload.company_id || companyForBusinessEntity(businessEntityId)) || null,
    clean(payload.projectName || payload.project_name),
    clean(payload.clientName || payload.client_name),
    normalizeStatus(payload.status || "Planned"),
    normalizePriority(payload.priority),
    clean(payload.dueDate || payload.due_date || ""),
    clean(payload.linkedFilePlaceholder || payload.linked_file_placeholder),
    payload.linkedMeetingId || payload.linked_meeting_id || null,
    payload.linkedProjectId || payload.linked_project_id || null,
    clean(payload.linkedBusinessId || payload.linked_business_id || businessEntityId),
    clean(payload.linkedMemoryReference || payload.linked_memory_reference || payload.memoryReference || ""),
    clean(payload.feedbackStatus || payload.feedback_status || "unreviewed"),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || sourceReference(payload.sourceType || payload.source_type || "manual", payload.sourceId || payload.source_id || "")),
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const deliverable = db.prepare("SELECT * FROM deliverables WHERE id = ?").get(rowId(result));
  recordMondayAudit(db, {
    eventType: "deliverable_created",
    userAction: payload.userAction || "monday-os:deliverable:create",
    recordType: "deliverable",
    recordId: deliverable.id,
    agentId: ownerAgentId,
    dataCategories: ["deliverable", "internal_monday_operating_system"],
  });
  return mapDeliverable(deliverable);
}

function createOperationalSignal(db, table, recordType, payload = {}) {
  const ownerAgentId = normalizeAgentId(payload.ownerAgentId || payload.owner_agent_id || payload.agentId);
  const owner = agentDefinition(ownerAgentId);
  const businessEntityId = businessEntityFor({
    agentId: ownerAgentId,
    businessEntityId: payload.businessEntityId || payload.business_entity_id,
    companyId: payload.companyId || payload.company_id,
  });
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO ${table} (
      title, detail, owner_agent_id, owner_agent_name, business_entity_id, company_id,
      business_impact, priority, status, recommended_action, source_type, source_id,
      source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || `Untitled ${recordType}`),
    clean(payload.detail || ""),
    ownerAgentId,
    owner.agentName,
    businessEntityId,
    clean(payload.companyId || payload.company_id || companyForBusinessEntity(businessEntityId)) || null,
    clean(payload.businessImpact || payload.business_impact || ""),
    normalizePriority(payload.priority),
    normalizeStatus(payload.status),
    clean(payload.recommendedAction || payload.recommended_action || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || sourceReference(payload.sourceType || payload.source_type || "manual", payload.sourceId || payload.source_id || "")),
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const record = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(rowId(result));
  recordMondayAudit(db, {
    eventType: `${recordType}_created`,
    userAction: payload.userAction || `monday-os:${recordType}:create`,
    recordType,
    recordId: record.id,
    agentId: ownerAgentId,
    dataCategories: [recordType, "internal_monday_operating_system"],
  });
  return mapOperationalSignal(record);
}

export function createOperationalRisk(db, payload = {}) {
  return createOperationalSignal(db, "operational_risks", "operational_risk", payload);
}

export function createOperationalOpportunity(db, payload = {}) {
  return createOperationalSignal(db, "operational_opportunities", "operational_opportunity", payload);
}

export function createOperationalDecision(db, payload = {}) {
  const ownerAgentId = normalizeAgentId(payload.ownerAgentId || payload.owner_agent_id || payload.agentId);
  const owner = agentDefinition(ownerAgentId);
  const businessEntityId = businessEntityFor({
    agentId: ownerAgentId,
    businessEntityId: payload.businessEntityId || payload.business_entity_id,
    companyId: payload.companyId || payload.company_id,
  });
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO operational_decisions (
      title, detail, owner_agent_id, owner_agent_name, business_entity_id, company_id,
      approval_required, priority, status, source_type, source_id, source_reference,
      metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.title || "Untitled decision"),
    clean(payload.detail || ""),
    ownerAgentId,
    owner.agentName,
    businessEntityId,
    clean(payload.companyId || payload.company_id || companyForBusinessEntity(businessEntityId)) || null,
    boolInt(Boolean(payload.approvalRequired ?? payload.approval_required)),
    normalizePriority(payload.priority),
    normalizeStatus(payload.status),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || sourceReference(payload.sourceType || payload.source_type || "manual", payload.sourceId || payload.source_id || "")),
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const decision = db.prepare("SELECT * FROM operational_decisions WHERE id = ?").get(rowId(result));
  recordMondayAudit(db, {
    eventType: "operational_decision_created",
    userAction: payload.userAction || "monday-os:decision:create",
    recordType: "operational_decision",
    recordId: decision.id,
    agentId: ownerAgentId,
    dataCategories: ["operational_decision", "internal_monday_operating_system"],
  });
  return mapDecision(decision);
}

export function recordOutputFeedback(db, payload = {}) {
  const agentId = normalizeAgentId(payload.agentId || payload.agent_id || "alfred");
  const agent = agentDefinition(agentId);
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO output_feedback (
      agent_id, agent_name, output_type, output_title, rating, recommendation_status,
      lesson_learned, future_work_suggestion, memory_reference, source_type, source_id,
      source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agentId,
    agent.agentName,
    clean(payload.outputType || payload.output_type || "agent_output"),
    clean(payload.outputTitle || payload.output_title || payload.title || "Untitled output"),
    clean(payload.rating || "unrated"),
    clean(payload.recommendationStatus || payload.recommendation_status || "unreviewed"),
    clean(payload.lessonLearned || payload.lesson_learned || ""),
    clean(payload.futureWorkSuggestion || payload.future_work_suggestion || ""),
    clean(payload.memoryReference || payload.memory_reference || ""),
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || sourceReference(payload.sourceType || payload.source_type || "manual", payload.sourceId || payload.source_id || "")),
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const feedback = db.prepare("SELECT * FROM output_feedback WHERE id = ?").get(rowId(result));
  recordMondayAudit(db, {
    eventType: "output_feedback_recorded",
    userAction: payload.userAction || "monday-os:feedback:create",
    recordType: "output_feedback",
    recordId: feedback.id,
    agentId,
    dataCategories: ["output_feedback", "internal_monday_operating_system"],
  });
  createWorkItem(db, {
    title: `Review feedback: ${feedback.output_title}`,
    detail: feedback.future_work_suggestion || feedback.lesson_learned || feedback.user_feedback || "Review feedback and decide whether it should change future Alfred outputs.",
    itemType: "feedback_review",
    ownerAgentId: agentId,
    priority: feedback.rating === "negative" ? "High" : "Medium",
    status: "Review",
    sourceType: "output_feedback",
    sourceId: feedback.id,
    sourceReference: sourceReference("meeting_feedback", feedback.id, feedback.output_title),
    metadata: { feedbackRecordId: feedback.id },
    userAction: "monday-os:feedback-review-work-item",
  });
  return mapOutputFeedback(feedback);
}

function deriveAgentFromText(text = "", fallback = "alfred") {
  const lower = clean(text).toLowerCase();
  if (/(bim|cobie|ifc|eir|air|bep|midp|tidp|iso 19650|digital construction|westminster|rbkc|islington|kspf)/i.test(lower)) return "sarah";
  if (/(invoice|cashflow|forecast|revenue|debtor|order book|finance|financial)/i.test(lower)) return "olivia";
  if (/(property|portfolio|tenant|rent|yield|refinance|due diligence|westbridge)/i.test(lower)) return "westbridge-property-director";
  if (/(security|permission|access|mfa|gdpr|confidential|secret|data protection)/i.test(lower)) return "sentinel";
  if (/(content|youtube|linkedin|tiktok|campaign|media)/i.test(lower)) return "maya";
  if (/(growth|sales|partnership|lead|pipeline)/i.test(lower)) return "alex";
  if (/(platform|hosting|devops|technical debt|architecture|code)/i.test(lower)) return "ethan";
  if (/(power apps|power bi|dataverse|sharepoint|power automate)/i.test(lower)) return "liam";
  if (/(product|saas|mvp|roadmap|feature)/i.test(lower)) return "james";
  return normalizeAgentId(fallback);
}

function createWorkItemFromSource(db, payload) {
  const sourceId = String(payload.sourceId || "");
  const sourceType = payload.sourceType;
  const existing = sourceId ? findSourceRecord(db, "work_items", sourceType, sourceId) : null;
  if (existing) return { record: mapWorkItem(existing), created: false };
  return { record: insertWorkItem(db, payload, { audit: true }), created: true };
}

function createOperationalSource(db, table, type, payload, createFn) {
  const existing = payload.sourceId ? findSourceRecord(db, table, payload.sourceType, payload.sourceId) : null;
  if (existing) return { record: type === "decision" ? mapDecision(existing) : mapOperationalSignal(existing), created: false };
  return { record: createFn(db, payload), created: true };
}

function syncCoreOperatingRegisters(db) {
  let created = 0;
  const coreSources = [
    { table: "actions", sourceType: "action", itemType: "action" },
    { table: "risks", sourceType: "risk", itemType: "risk" },
    { table: "opportunities", sourceType: "opportunity", itemType: "opportunity" },
    { table: "decisions", sourceType: "decision", itemType: "decision" },
  ];
  for (const source of coreSources) {
    const rows = db.prepare(`
      SELECT *
      FROM ${source.table}
      ORDER BY updated_at DESC, id DESC
      LIMIT 250
    `).all();
    for (const row of rows) {
      const projectName = projectNameFor(db, row.project_id);
      const text = `${row.title} ${row.detail} ${projectName}`;
      const agentId = deriveAgentFromText(text, row.company_id === "westbridge" ? "westbridge-property-director" : row.company_id === "digitize" ? "sarah" : "alfred");
      const result = createWorkItemFromSource(db, {
        title: row.title,
        detail: row.detail,
        itemType: source.itemType,
        ownerAgentId: source.sourceType === "decision" ? "alfred" : agentId,
        businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
        companyId: row.company_id,
        projectName,
        priority: row.priority,
        status: normalizeStatus(row.status),
        dueDate: row.due,
        sourceType: source.sourceType,
        sourceId: row.id,
        sourceReference: sourceReference(source.sourceType, row.id, row.title),
        metadata: { originalStatus: row.status },
        userAction: "monday-os:sync-core-registers",
      });
      if (result.created) created += 1;
      if (source.sourceType === "risk") {
        const risk = createOperationalSource(db, "operational_risks", "risk", {
          title: row.title,
          detail: row.detail,
          ownerAgentId: agentId,
          businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
          companyId: row.company_id,
          businessImpact: row.detail,
          priority: row.priority,
          status: normalizeStatus(row.status),
          sourceType: "risk",
          sourceId: row.id,
          sourceReference: sourceReference("risk", row.id, row.title),
          userAction: "monday-os:sync-core-risks",
        }, createOperationalRisk);
        if (risk.created) created += 1;
      }
      if (source.sourceType === "opportunity") {
        const opportunity = createOperationalSource(db, "operational_opportunities", "opportunity", {
          title: row.title,
          detail: row.detail,
          ownerAgentId: agentId,
          businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
          companyId: row.company_id,
          businessImpact: row.value_gbp ? `Potential value: £${row.value_gbp}` : row.detail,
          priority: row.priority,
          status: normalizeStatus(row.status),
          sourceType: "opportunity",
          sourceId: row.id,
          sourceReference: sourceReference("opportunity", row.id, row.title),
          userAction: "monday-os:sync-core-opportunities",
        }, createOperationalOpportunity);
        if (opportunity.created) created += 1;
      }
      if (source.sourceType === "decision") {
        const decision = createOperationalSource(db, "operational_decisions", "decision", {
          title: row.title,
          detail: row.detail,
          ownerAgentId: "alfred",
          businessEntityId: businessEntityFor({ agentId: "alfred", companyId: row.company_id }),
          companyId: row.company_id,
          approvalRequired: true,
          priority: row.priority,
          status: normalizeStatus(row.status),
          sourceType: "decision",
          sourceId: row.id,
          sourceReference: sourceReference("decision", row.id, row.title),
          userAction: "monday-os:sync-core-decisions",
        }, createOperationalDecision);
        if (decision.created) created += 1;
      }
    }
  }
  return created;
}

function syncMeetingSources(db) {
  let created = 0;
  const actions = db.prepare(`
    SELECT a.*, m.title AS meeting_title, m.project_name, m.client_name, m.company_id
    FROM meeting_actions a
    JOIN meeting_records m ON m.id = a.meeting_id
    ORDER BY a.updated_at DESC, a.id DESC
    LIMIT 250
  `).all();
  for (const row of actions) {
    const agentId = deriveAgentFromText(`${row.title} ${row.detail} ${row.project_name} ${row.client_name}`, "alfred");
    const work = createWorkItemFromSource(db, {
      title: row.title,
      detail: row.detail,
      itemType: "meeting_followup",
      ownerAgentId: agentId,
      businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
      companyId: row.company_id,
      projectName: row.project_name,
      clientName: row.client_name,
      priority: row.priority,
      status: normalizeStatus(row.status),
      dueDate: row.due_date,
      sourceType: "meeting_action",
      sourceId: row.id,
      sourceReference: sourceReference("meeting_action", row.id, row.meeting_title),
      metadata: { meetingId: row.meeting_id, confidenceLevel: row.confidence_level },
      userAction: "monday-os:sync-meeting-action",
    });
    if (work.created) created += 1;
    const existingFollowup = findSourceRecord(db, "meeting_followups", "meeting_action", row.id);
    if (!existingFollowup) {
      const owner = agentDefinition(agentId);
      db.prepare(`
        INSERT INTO meeting_followups (
          meeting_id, meeting_title, source_type, source_id, work_item_id,
          owner_agent_id, owner_agent_name, extracted_action, due_date, priority,
          status, source_reference, metadata, created_at, updated_at
        )
        VALUES (?, ?, 'meeting_action', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.meeting_id,
        row.meeting_title,
        String(row.id),
        work.record.id,
        agentId,
        owner.agentName,
        row.title,
        row.due_date,
        normalizePriority(row.priority),
        normalizeStatus(row.status),
        sourceReference("meeting_action", row.id, row.meeting_title),
        json({ confidenceLevel: row.confidence_level }),
        nowIso(),
        nowIso(),
      );
      created += 1;
    }
  }

  for (const row of db.prepare(`
    SELECT d.*, m.title AS meeting_title, m.project_name, m.client_name, m.company_id
    FROM meeting_decisions d
    JOIN meeting_records m ON m.id = d.meeting_id
    ORDER BY d.updated_at DESC, d.id DESC
    LIMIT 250
  `).all()) {
    const result = createOperationalSource(db, "operational_decisions", "decision", {
      title: row.title,
      detail: row.detail,
      ownerAgentId: "alfred",
      businessEntityId: businessEntityFor({ agentId: "alfred", companyId: row.company_id }),
      companyId: row.company_id,
      approvalRequired: Boolean(row.approval_required),
      priority: row.approval_required ? "High" : "Medium",
      status: row.approval_required ? "Review" : normalizeStatus(row.status),
      sourceType: "meeting_decision",
      sourceId: row.id,
      sourceReference: sourceReference("meeting_decision", row.id, row.meeting_title),
      metadata: { meetingId: row.meeting_id, projectName: row.project_name, clientName: row.client_name },
      userAction: "monday-os:sync-meeting-decision",
    }, createOperationalDecision);
    if (result.created) created += 1;
  }

  for (const row of db.prepare(`
    SELECT r.*, m.title AS meeting_title, m.project_name, m.client_name, m.company_id
    FROM meeting_risks r
    JOIN meeting_records m ON m.id = r.meeting_id
    ORDER BY r.updated_at DESC, r.id DESC
    LIMIT 250
  `).all()) {
    const agentId = deriveAgentFromText(`${row.title} ${row.detail} ${row.project_name}`, "sentinel");
    const result = createOperationalSource(db, "operational_risks", "risk", {
      title: row.title,
      detail: row.detail,
      ownerAgentId: agentId,
      businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
      companyId: row.company_id,
      businessImpact: row.detail,
      priority: row.severity || row.priority,
      status: normalizeStatus(row.status),
      sourceType: "meeting_risk",
      sourceId: row.id,
      sourceReference: sourceReference("meeting_risk", row.id, row.meeting_title),
      metadata: { meetingId: row.meeting_id, projectName: row.project_name, clientName: row.client_name },
      userAction: "monday-os:sync-meeting-risk",
    }, createOperationalRisk);
    if (result.created) created += 1;
  }

  for (const row of db.prepare(`
    SELECT o.*, m.title AS meeting_title, m.project_name, m.client_name, m.company_id
    FROM meeting_opportunities o
    JOIN meeting_records m ON m.id = o.meeting_id
    ORDER BY o.updated_at DESC, o.id DESC
    LIMIT 250
  `).all()) {
    const agentId = deriveAgentFromText(`${row.title} ${row.detail} ${row.project_name}`, "alex");
    const result = createOperationalSource(db, "operational_opportunities", "opportunity", {
      title: row.title,
      detail: row.detail,
      ownerAgentId: agentId,
      businessEntityId: businessEntityFor({ agentId, companyId: row.company_id }),
      companyId: row.company_id,
      businessImpact: row.detail,
      priority: row.priority,
      status: normalizeStatus(row.status),
      sourceType: "meeting_opportunity",
      sourceId: row.id,
      sourceReference: sourceReference("meeting_opportunity", row.id, row.meeting_title),
      metadata: { meetingId: row.meeting_id, projectName: row.project_name, clientName: row.client_name },
      userAction: "monday-os:sync-meeting-opportunity",
    }, createOperationalOpportunity);
    if (result.created) created += 1;
  }

  for (const row of db.prepare(`
    SELECT f.*, m.title AS meeting_title, m.project_name, m.client_name, m.company_id
    FROM meeting_feedback f
    JOIN meeting_records m ON m.id = f.meeting_id
    ORDER BY f.updated_at DESC, f.id DESC
    LIMIT 250
  `).all()) {
    const existing = findSourceRecord(db, "output_feedback", "meeting_feedback", row.id);
    if (!existing) {
      recordOutputFeedback(db, {
        agentId: row.agent_id,
        outputType: row.output_type,
        outputTitle: row.meeting_title || "Meeting feedback",
        rating: row.recommendation_status === "accepted" ? "positive" : row.recommendation_status === "rejected" ? "negative" : "unrated",
        recommendationStatus: row.recommendation_status,
        lessonLearned: row.lesson_learned,
        futureWorkSuggestion: row.follow_up_result || row.user_feedback,
        memoryReference: row.memory_update_reference,
        sourceType: "meeting_feedback",
        sourceId: row.id,
        sourceReference: sourceReference("meeting_feedback", row.id, row.meeting_title),
        metadata: { meetingId: row.meeting_id, projectName: row.project_name, clientName: row.client_name, companyId: row.company_id },
        userAction: "monday-os:sync-meeting-feedback",
      });
      created += 1;
    }
  }

  return created;
}

export function syncInternalOperatingSources(db, { userAction = "monday-os:sync-internal-sources" } = {}) {
  ensureMondayBoardMappings(db);
  const created = syncCoreOperatingRegisters(db) + syncMeetingSources(db);
  const workloads = calculateAgentWorkloads(db);
  recordMondayAudit(db, {
    eventType: "internal_sources_synced",
    userAction,
    recordType: "monday_operating_system",
    dataCategories: ["actions", "risks", "opportunities", "decisions", "meeting_intelligence", "internal_monday_operating_system"],
    metadata: { recordsCreated: created, workloadRows: workloads.length },
  });
  return {
    recordsCreated: created,
    workloadsCalculated: workloads.length,
    boundary: MONDAY_OPERATING_BOUNDARY,
  };
}

export function syncMeetingFollowupsToWorkItems(db) {
  return syncInternalOperatingSources(db, { userAction: "monday-os:sync-meeting-followups" });
}

function calculateWorkloadHealth({ activeItems, highPriorityItems, overdueItems, blockedItems, deliverablesDue, capacity }) {
  const capacityScore = capacity ? Math.round(Math.min(activeItems / capacity, 2) * 35) : activeItems * 5;
  const score = Math.min(100, capacityScore + (highPriorityItems * 8) + (overdueItems * 14) + (blockedItems * 22) + (deliverablesDue * 8));
  const healthStatus = blockedItems || overdueItems || score >= 70
    ? "Red"
    : score >= 40 || highPriorityItems || deliverablesDue
      ? "Amber"
      : "Green";
  return { workloadScore: score, healthStatus };
}

export function calculateAgentWorkloads(db) {
  ensureMondayBoardMappings(db);
  const today = todayIsoDate();
  const rows = db.prepare("SELECT * FROM work_items").all().map(mapWorkItem);
  const deliverableRows = db.prepare("SELECT * FROM deliverables").all().map(mapDeliverable);
  const timestamp = nowIso();
  const upsert = db.prepare(`
    INSERT INTO agent_workloads (
      agent_id, agent_name, business_area, active_items, overdue_items,
      blocked_items, priority_items, deliverables_due, workload_score, health_status,
      workload_status, capacity, notes, calculated_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      agent_name = excluded.agent_name,
      business_area = excluded.business_area,
      active_items = excluded.active_items,
      overdue_items = excluded.overdue_items,
      blocked_items = excluded.blocked_items,
      priority_items = excluded.priority_items,
      deliverables_due = excluded.deliverables_due,
      workload_score = excluded.workload_score,
      health_status = excluded.health_status,
      workload_status = excluded.workload_status,
      capacity = excluded.capacity,
      notes = excluded.notes,
      calculated_at = excluded.calculated_at,
      updated_at = excluded.updated_at
  `);
  const upsertMetrics = db.prepare(`
    INSERT INTO workload_metrics (
      agent_id, agent_name, open_items, high_priority_items, overdue_items,
      blocked_items, deliverables_due, workload_score, health_status, calculated_at,
      metadata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      agent_name = excluded.agent_name,
      open_items = excluded.open_items,
      high_priority_items = excluded.high_priority_items,
      overdue_items = excluded.overdue_items,
      blocked_items = excluded.blocked_items,
      deliverables_due = excluded.deliverables_due,
      workload_score = excluded.workload_score,
      health_status = excluded.health_status,
      calculated_at = excluded.calculated_at,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
  for (const agent of AGENT_BOARD_MODELS) {
    const owned = rows.filter((row) => row.ownerAgentId === agent.agentId);
    const active = owned.filter((row) => !COMPLETE_STATUSES.has(row.status));
    const overdue = active.filter((row) => row.dueDate && row.dueDate.slice(0, 10) < today);
    const blocked = active.filter((row) => row.status === "Blocked");
    const priority = active.filter((row) => ["High", "Critical"].includes(row.priority));
    const activeDeliverables = deliverableRows.filter((row) => row.ownerAgentId === agent.agentId && !COMPLETE_STATUSES.has(row.status));
    const dueDeliverables = activeDeliverables.filter((row) => row.dueDate && row.dueDate.slice(0, 10) <= today);
    const health = calculateWorkloadHealth({
      activeItems: active.length,
      highPriorityItems: priority.length,
      overdueItems: overdue.length,
      blockedItems: blocked.length,
      deliverablesDue: dueDeliverables.length,
      capacity: agent.capacity,
    });
    const status = blocked.length
      ? "Blocked"
      : active.length > agent.capacity
        ? "Overloaded"
        : priority.length
          ? "Priority"
          : active.length
            ? "Active"
            : "Available";
    const notes = [
      `${active.length} active internal work item(s).`,
      `Workload health: ${health.healthStatus} (${health.workloadScore}/100).`,
      overdue.length ? `${overdue.length} overdue.` : "",
      blocked.length ? `${blocked.length} blocked.` : "",
      dueDeliverables.length ? `${dueDeliverables.length} deliverable(s) due.` : "",
      "No external Monday sync is enabled.",
    ].filter(Boolean).join(" ");
    upsert.run(
      agent.agentId,
      agent.agentName,
      agent.businessArea,
      active.length,
      overdue.length,
      blocked.length,
      priority.length,
      dueDeliverables.length,
      health.workloadScore,
      health.healthStatus,
      status,
      agent.capacity,
      notes,
      timestamp,
      timestamp,
    );
    upsertMetrics.run(
      agent.agentId,
      agent.agentName,
      active.length,
      priority.length,
      overdue.length,
      blocked.length,
      dueDeliverables.length,
      health.workloadScore,
      health.healthStatus,
      timestamp,
      json({
        capacity: agent.capacity,
        businessArea: agent.businessArea,
        boundary: MONDAY_OPERATING_BOUNDARY,
      }),
      timestamp,
    );
  }
  return db.prepare("SELECT * FROM agent_workloads ORDER BY active_items DESC, priority_items DESC, agent_name ASC")
    .all()
    .map(mapWorkload);
}

function listDeliverables(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM deliverables
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      due_date ASC,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapDeliverable);
}

function listOperationalRisks(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM operational_risks
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapOperationalSignal);
}

function listOperationalOpportunities(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM operational_opportunities
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapOperationalSignal);
}

function listOperationalDecisions(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM operational_decisions
    ORDER BY
      approval_required DESC,
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapDecision);
}

function listMeetingFollowups(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM meeting_followups
    ORDER BY
      CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      created_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapMeetingFollowup);
}

function listOutputFeedback(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM output_feedback
    ORDER BY
      CASE recommendation_status WHEN 'unreviewed' THEN 1 WHEN 'rejected' THEN 2 WHEN 'accepted' THEN 3 ELSE 4 END,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapOutputFeedback);
}

function getBoardMappings(db) {
  return ensureMondayBoardMappings(db);
}

function getSyncStatus(db) {
  ensureMondayBoardMappings(db);
  return db.prepare("SELECT * FROM monday_sync_status ORDER BY agent_id ASC, board_kind ASC")
    .all()
    .map(mapSyncStatus);
}

function listWorkloadMetrics(db) {
  return db.prepare(`
    SELECT *
    FROM workload_metrics
    ORDER BY
      CASE health_status WHEN 'Red' THEN 1 WHEN 'Amber' THEN 2 ELSE 3 END,
      workload_score DESC,
      agent_name ASC
  `).all().map(mapWorkloadMetric);
}

function dashboardMetrics({ workItems, deliverables, risks, decisions, followups, feedback, boardMappings, workloadMetrics }) {
  const today = todayIsoDate();
  const active = workItems.filter((item) => !COMPLETE_STATUSES.has(item.status));
  const workloadHealth = {
    green: workloadMetrics.filter((item) => item.healthStatus === "Green").length,
    amber: workloadMetrics.filter((item) => item.healthStatus === "Amber").length,
    red: workloadMetrics.filter((item) => item.healthStatus === "Red").length,
  };
  return {
    agents: AGENT_BOARD_MODELS.length,
    plannedBoards: boardMappings.length,
    activeWorkItems: active.length,
    blockedItems: active.filter((item) => item.status === "Blocked").length,
    overdueItems: active.filter((item) => item.dueDate && item.dueDate.slice(0, 10) < today).length,
    priorityItems: active.filter((item) => ["High", "Critical"].includes(item.priority)).length,
    deliverablesDue: deliverables.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
    highPriorityRisks: risks.filter((item) => ["High", "Critical"].includes(item.priority) && !COMPLETE_STATUSES.has(item.status)).length,
    decisionsAwaitingApproval: decisions.filter((item) => item.approvalRequired && !COMPLETE_STATUSES.has(item.status)).length,
    meetingFollowups: followups.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
    feedbackForReview: feedback.filter((item) => item.recommendationStatus === "unreviewed").length,
    workloadHealth,
    mondayWritesEnabled: false,
  };
}

export function getMondayOperatingDashboard(db) {
  ensureMondayBoardMappings(db);
  syncInternalOperatingSources(db, { userAction: "monday-os:dashboard-refresh" });
  const workItems = listWorkItems(db, { limit: 100 });
  const deliverables = listDeliverables(db, 50);
  const risks = listOperationalRisks(db, 50);
  const opportunities = listOperationalOpportunities(db, 50);
  const decisions = listOperationalDecisions(db, 50);
  const meetingFollowups = listMeetingFollowups(db, 50);
  const feedback = listOutputFeedback(db, 50);
  const boardMappings = getBoardMappings(db);
  const syncStatus = getSyncStatus(db);
  const agentWorkloads = calculateAgentWorkloads(db);
  const workloadMetrics = listWorkloadMetrics(db);
  return {
    title: "Monday Operating System",
    summary: "Internal Alfred work management foundation for future Monday.com boards. No live Monday.com read/write sync is active.",
    metrics: dashboardMetrics({ workItems, deliverables, risks, decisions, followups: meetingFollowups, feedback, boardMappings, workloadMetrics }),
    agentBoards: AGENT_BOARD_MODELS,
    agentWorkloads,
    workloadMetrics,
    workItems,
    deliverables,
    operationalRisks: risks,
    operationalOpportunities: opportunities,
    operationalDecisions: decisions,
    meetingFollowups,
    outputFeedback: feedback,
    boardMappings,
    syncStatus,
    sourceSystems: [
      "Meeting Intelligence",
      "Project Intelligence",
      "Olivia CFO",
      "Westbridge Property",
      "Sarah",
      "Executive Briefing",
      "Memory",
      "Future Monday.com IDs",
    ],
    boundary: MONDAY_OPERATING_BOUNDARY,
  };
}

export function searchMondayOperatingSystem(db, query = "") {
  ensureMondayBoardMappings(db);
  const term = `%${clean(query).toLowerCase()}%`;
  if (!clean(query)) {
    return {
      query: "",
      workItems: [],
      deliverables: [],
      risks: [],
      opportunities: [],
      decisions: [],
      feedback: [],
      boundary: MONDAY_OPERATING_BOUNDARY,
    };
  }
  const search = (table, mapper, fields) => db.prepare(`
    SELECT *
    FROM ${table}
    WHERE ${fields.map((field) => `LOWER(${field}) LIKE ?`).join(" OR ")}
    ORDER BY updated_at DESC, id DESC
    LIMIT 25
  `).all(...fields.map(() => term)).map(mapper);
  return {
    query: clean(query),
    workItems: search("work_items", mapWorkItem, ["title", "detail", "owner_agent_name", "project_name", "client_name", "source_reference"]),
    deliverables: search("deliverables", mapDeliverable, ["title", "detail", "owner_agent_name", "project_name", "client_name", "linked_business_id", "linked_memory_reference", "source_reference"]),
    risks: search("operational_risks", mapOperationalSignal, ["title", "detail", "owner_agent_name", "business_impact", "source_reference"]),
    opportunities: search("operational_opportunities", mapOperationalSignal, ["title", "detail", "owner_agent_name", "business_impact", "source_reference"]),
    decisions: search("operational_decisions", mapDecision, ["title", "detail", "owner_agent_name", "source_reference"]),
    feedback: search("output_feedback", mapOutputFeedback, ["output_title", "lesson_learned", "future_work_suggestion", "source_reference"]),
    sourceReferences: [
      "Meeting Intelligence",
      "Project Intelligence",
      "Olivia CFO",
      "Westbridge Property",
      "Sarah",
      "Executive Briefing",
      "Memory",
      "Future Monday.com IDs",
    ],
    boundary: MONDAY_OPERATING_BOUNDARY,
  };
}

function briefItem(type, item, reason) {
  return {
    type,
    title: item.title || item.outputTitle || item.extractedAction,
    detail: item.detail || item.lessonLearned || item.futureWorkSuggestion || item.extractedAction || "",
    ownerAgentId: item.ownerAgentId || item.agentId || "alfred",
    ownerAgentName: item.ownerAgentName || item.agentName || "Alfred",
    priority: item.priority || "Medium",
    status: item.status || item.recommendationStatus || "Review",
    dueDate: item.dueDate || "",
    sourceType: item.sourceType || "monday_operating_system",
    sourceId: item.sourceId || item.id,
    sourceReference: item.sourceReference || sourceReference(item.sourceType || "monday_operating_system", item.id, item.title || item.outputTitle || ""),
    reason,
  };
}

export function mondayOperatingBriefForDaily(db) {
  ensureMondayBoardMappings(db);
  syncInternalOperatingSources(db, { userAction: "monday-os:briefing-refresh" });
  const dashboard = getMondayOperatingDashboard(db);
  const today = todayIsoDate();
  const active = dashboard.workItems.filter((item) => !COMPLETE_STATUSES.has(item.status));
  const items = [
    ...active.filter((item) => item.status === "Blocked").slice(0, 5).map((item) => briefItem("blocked_work", item, "Blocked internal work item.")),
    ...active.filter((item) => item.dueDate && item.dueDate.slice(0, 10) < today).slice(0, 5).map((item) => briefItem("overdue_work", item, "Overdue internal work item.")),
    ...dashboard.operationalDecisions.filter((item) => item.approvalRequired && !COMPLETE_STATUSES.has(item.status)).slice(0, 5).map((item) => briefItem("decision_required", item, "Patrick approval or review required.")),
    ...dashboard.meetingFollowups.filter((item) => !COMPLETE_STATUSES.has(item.status)).slice(0, 5).map((item) => briefItem("meeting_followup", item, "Meeting follow-up converted into internal Alfred work.")),
    ...dashboard.operationalRisks.filter((item) => ["High", "Critical"].includes(item.priority) && !COMPLETE_STATUSES.has(item.status)).slice(0, 5).map((item) => briefItem("operational_risk", item, "High-priority operational risk.")),
    ...dashboard.deliverables.filter((item) => !COMPLETE_STATUSES.has(item.status)).slice(0, 5).map((item) => briefItem("deliverable_due", item, "Deliverable due or planned.")),
    ...dashboard.outputFeedback.filter((item) => item.recommendationStatus === "unreviewed").slice(0, 5).map((item) => briefItem("feedback_review", item, "Feedback requires review.")),
  ].slice(0, 18);
  const topWorkloads = dashboard.agentWorkloads
    .filter((item) => item.activeItems > 0 || item.workloadStatus === "Blocked")
    .slice(0, 6);
  return {
    title: "Monday Operating System",
    summary: dashboard.metrics.activeWorkItems
      ? `${dashboard.metrics.activeWorkItems} active internal work item(s), ${dashboard.metrics.blockedItems} blocked, ${dashboard.metrics.overdueItems} overdue.`
      : "No active internal Monday OS work items yet.",
    metrics: dashboard.metrics,
    topWorkloads,
    items,
    boundary: MONDAY_OPERATING_BOUNDARY,
  };
}

export function listMondayAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM monday_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map(mapAudit);
}

export function mondayOperatingCollection(db, kind, payload = {}) {
  switch (kind) {
    case "work-items":
      return createWorkItem(db, payload);
    case "deliverables":
      return createDeliverable(db, payload);
    case "risks":
      return createOperationalRisk(db, payload);
    case "opportunities":
      return createOperationalOpportunity(db, payload);
    case "decisions":
      return createOperationalDecision(db, payload);
    case "feedback":
      return recordOutputFeedback(db, payload);
    default: {
      const error = new Error("Unknown Monday Operating System collection");
      error.statusCode = 404;
      throw error;
    }
  }
}

export function listMondayOperatingCollection(db, kind, limit = 50) {
  switch (kind) {
    case "work-items":
      return listWorkItems(db, { limit });
    case "deliverables":
      return listDeliverables(db, limit);
    case "risks":
      return listOperationalRisks(db, limit);
    case "opportunities":
      return listOperationalOpportunities(db, limit);
    case "decisions":
      return listOperationalDecisions(db, limit);
    case "feedback":
      return listOutputFeedback(db, limit);
    case "board-mappings":
      return getBoardMappings(db);
    case "sync-status":
      return getSyncStatus(db);
    default: {
      const error = new Error("Unknown Monday Operating System collection");
      error.statusCode = 404;
      throw error;
    }
  }
}
