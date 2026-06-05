import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(ROOT_DIR, "data", "alfred.db");

export const RESOURCE_CONFIG = {
  companies: {
    fields: ["id", "name", "short_name", "symbol", "color", "purpose", "status", "services"],
    required: ["id", "name", "short_name", "symbol", "color", "purpose", "status"],
    json: ["services"],
  },
  clients: {
    fields: ["company_id", "name", "status", "notes"],
    required: ["company_id", "name"],
  },
  projects: {
    fields: ["company_id", "client_id", "name", "purpose", "status"],
    required: ["company_id", "name"],
  },
  actions: {
    fields: ["company_id", "project_id", "title", "detail", "priority", "due", "status"],
    required: ["company_id", "title", "detail"],
  },
  risks: {
    fields: ["company_id", "project_id", "title", "detail", "priority", "due", "status"],
    required: ["company_id", "title", "detail"],
  },
  opportunities: {
    fields: ["company_id", "title", "detail", "priority", "due", "status", "value_gbp"],
    required: ["company_id", "title", "detail"],
  },
  decisions: {
    fields: ["company_id", "title", "detail", "priority", "due", "status"],
    required: ["company_id", "title", "detail"],
  },
  agents: {
    fields: ["id", "name", "role", "company_id", "department", "mission", "tools", "status"],
    required: ["id", "name", "role", "department", "mission", "status"],
    json: ["tools"],
  },
  memories: {
    fields: ["type", "title", "detail", "company_id", "recorded_at"],
    required: ["type", "title", "detail"],
  },
  integrations: {
    fields: ["id", "name", "symbol", "description", "status"],
    required: ["id", "name", "symbol", "description", "status"],
  },
};

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    color TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL,
    services TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    name TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    project_id INTEGER REFERENCES projects(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due TEXT NOT NULL DEFAULT 'This week',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    project_id INTEGER REFERENCES projects(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due TEXT NOT NULL DEFAULT 'This week',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due TEXT NOT NULL DEFAULT 'Next',
    status TEXT NOT NULL DEFAULT 'open',
    value_gbp REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL REFERENCES companies(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    due TEXT NOT NULL DEFAULT 'This week',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    company_id TEXT REFERENCES companies(id),
    department TEXT NOT NULL,
    mission TEXT NOT NULL,
    tools TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Planned',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    company_id TEXT REFERENCES companies(id),
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Not connected', 'Planned', 'Connected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS briefing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at TEXT NOT NULL,
    source TEXT NOT NULL,
    summary TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS briefing_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    briefing_id INTEGER NOT NULL REFERENCES briefing_history(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK(rating IN ('useful', 'not_useful')),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    target_system TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    risk_level TEXT NOT NULL DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    requested_by TEXT NOT NULL DEFAULT 'Alfred',
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_note TEXT NOT NULL DEFAULT '',
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS approval_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN ('requested', 'approved', 'rejected', 'cancelled', 'expired')),
    actor TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const COMPANY_SEEDS = [
  ["digitize", "Digitize Consultants", "Digitize", "DC", "#62ead5", "Digital construction and information consultancy", "Operating", ["BIM", "ISO 19650", "Information Management", "GIS", "Digital Twin", "Power Platform", "AI Solutions"]],
  ["product", "Product Studio", "Product", "PS", "#7fa9e2", "Create scalable SaaS businesses", "Building", ["Council Construction Assurance Platform"]],
  ["venture", "AI Venture Studio", "Venture", "AV", "#b18ae2", "Build recurring-income online businesses", "Discovery", ["Target: £5,000+ monthly profit"]],
  ["media", "Media Studio", "Media", "MS", "#e2b46b", "Build automated YouTube and content businesses", "Discovery", ["Target: £5,000+ monthly income"]],
];

const CLIENT_SEEDS = [
  ["digitize", "KSPF"],
  ["digitize", "Westminster City Council"],
  ["digitize", "RBKC"],
  ["digitize", "Islington Council"],
];

const AGENT_SEEDS = [
  ["sarah", "Sarah", "Digital Construction Director", "digitize", "Delivery", "Lead BIM, GIS, Digital Twin and ISO 19650 delivery for Digitize.", [], "Planned"],
  ["alex", "Alex", "Growth Director", null, "Growth", "Find and qualify revenue opportunities across the group.", [], "Planned"],
  ["maya", "Maya", "Media Director", "media", "Media", "Build content businesses with repeatable production and monetisation systems.", [], "Planned"],
  ["james", "James", "Product CEO", "product", "Product", "Validate, build and operate scalable SaaS products.", [], "Planned"],
];

const INTEGRATION_SEEDS = [
  ["outlook", "Microsoft Outlook", "O", "Read and search Outlook email for briefings. Sending and drafting are disabled.", "Not connected"],
  ["calendar", "Outlook Calendar", "C", "Read upcoming meetings for preparation and briefings. Calendar changes are disabled.", "Not connected"],
  ["sharepoint", "OneDrive (SharePoint planned)", "S", "List and search the signed-in user's OneDrive files. File changes are disabled; SharePoint-wide search is planned.", "Planned"],
  ["monday", "Monday.com", "M", "Boards, projects, tasks, updates and operating reports.", "Planned"],
  ["krisp", "Krisp", "K", "Meeting summaries, actions, risks and follow-up extraction.", "Planned"],
  ["elevenlabs", "ElevenLabs", "E", "Natural voice output for executive briefings and alerts.", "Planned"],
  ["deepgram", "Deepgram", "D", "Speech-to-text input for voice commands and conversations.", "Planned"],
  ["voyage", "Voyage AI", "V", "Semantic long-term memory and retrieval across operating records.", "Planned"],
  ["anthropic", "Anthropic", "A", "Reasoning and language-model execution for Alfred intelligence workflows.", "Planned"],
];

function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function mapRow(row, jsonFields = []) {
  if (!row) return null;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const mappedKey = toCamelCase(key);
      return [mappedKey, jsonFields.includes(key) ? JSON.parse(value || "[]") : value];
    }),
  );
}

export function normalizePayload(payload, config) {
  const normalized = {};
  for (const field of config.fields) {
    const camelField = toCamelCase(field);
    if (payload[camelField] !== undefined) {
      normalized[field] = config.json?.includes(field)
        ? JSON.stringify(payload[camelField] || [])
        : payload[camelField];
    } else if (payload[field] !== undefined) {
      normalized[field] = config.json?.includes(field)
        ? JSON.stringify(payload[field] || [])
        : payload[field];
    }
  }
  return normalized;
}

export function createDatabase(dbPath = process.env.ALFRED_DB_PATH || DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  seedDatabase(db);
  return db;
}

export function seedDatabase(db) {
  const companyCount = db.prepare("SELECT COUNT(*) AS count FROM companies").get().count;
  if (companyCount > 0) {
    updateIntegrationDefinitions(db);
    return;
  }

  db.exec("BEGIN");
  try {
    const insertCompany = db.prepare(`
      INSERT INTO companies (id, name, short_name, symbol, color, purpose, status, services)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const company of COMPANY_SEEDS) {
      insertCompany.run(...company.slice(0, 7), JSON.stringify(company[7]));
    }

    const insertClient = db.prepare("INSERT INTO clients (company_id, name) VALUES (?, ?)");
    for (const client of CLIENT_SEEDS) insertClient.run(...client);

    db.prepare(`
      INSERT INTO projects (company_id, name, purpose, status)
      VALUES (?, ?, ?, ?)
    `).run("product", "Council Construction Assurance Platform", "Create a SaaS platform for council construction assurance.", "Discovery");

    db.prepare(`
      INSERT INTO risks (company_id, title, detail, priority, due)
      VALUES (?, ?, ?, ?, ?)
    `).run("digitize", "Westminster delivery review", "Confirm current deliverables and identify any actions requiring chairman input.", "high", "Today");

    db.prepare(`
      INSERT INTO actions (company_id, title, detail, priority, due)
      VALUES (?, ?, ?, ?, ?)
    `).run("digitize", "Review KSPF project position", "Prepare an updated commercial and delivery summary.", "medium", "This week");

    db.prepare(`
      INSERT INTO decisions (company_id, title, detail, priority, due)
      VALUES (?, ?, ?, ?, ?)
    `).run("product", "Define assurance platform MVP", "Approve the first user journey and validation scope.", "high", "This week");

    const insertOpportunity = db.prepare(`
      INSERT INTO opportunities (company_id, title, detail, priority, due)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertOpportunity.run("venture", "Select first venture thesis", "Choose one recurring-revenue concept for structured validation.", "medium", "Next");
    insertOpportunity.run("media", "Define first channel niche", "Score channel concepts by demand, production effort and monetisation.", "low", "Next");

    const insertAgent = db.prepare(`
      INSERT INTO agents (id, name, role, company_id, department, mission, tools, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const agent of AGENT_SEEDS) {
      insertAgent.run(...agent.slice(0, 6), JSON.stringify(agent[6]), agent[7]);
    }

    const insertMemory = db.prepare(`
      INSERT INTO memories (type, title, detail, company_id, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertMemory.run("decision", "Alfred operating principle", "Build the operating system before specialist agents. Patrick remains the final decision maker.", null, "2026-06-05");
    insertMemory.run("client", "Westminster City Council", "Registered as an active Digitize Consultants client. Delivery context requires connection to live project systems.", "digitize", "2026-06-05");
    insertMemory.run("idea", "Council Construction Assurance Platform", "Initial Product Studio SaaS concept focused on council construction assurance.", "product", "2026-06-05");

    updateIntegrationDefinitions(db);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function updateIntegrationDefinitions(db) {
  const insertIntegration = db.prepare(`
    INSERT OR IGNORE INTO integrations (id, name, symbol, description, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateIntegration = db.prepare(`
    UPDATE integrations
    SET name = ?, symbol = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const [id, name, symbol, description, status] of INTEGRATION_SEEDS) {
    insertIntegration.run(id, name, symbol, description, status);
    updateIntegration.run(name, symbol, description, id);
  }
}

export function listResource(db, resource) {
  const config = RESOURCE_CONFIG[resource];
  return db
    .prepare(`SELECT * FROM ${resource} ORDER BY created_at ASC`)
    .all()
    .map((row) => mapRow(row, config.json));
}

export function createResource(db, resource, payload) {
  const config = RESOURCE_CONFIG[resource];
  const values = normalizePayload(payload, config);
  const missing = config.required.filter((field) => values[field] === undefined || values[field] === "");
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.map(toCamelCase).join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const fields = Object.keys(values);
  const placeholders = fields.map(() => "?").join(", ");
  const result = db
    .prepare(`INSERT INTO ${resource} (${fields.join(", ")}) VALUES (${placeholders})`)
    .run(...fields.map((field) => values[field]));

  const id = values.id ?? Number(result.lastInsertRowid);
  const row = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id);
  return mapRow(row, config.json);
}

export function updateResource(db, resource, id, payload) {
  const config = RESOURCE_CONFIG[resource];
  const values = normalizePayload(payload, config);
  delete values.id;
  const fields = Object.keys(values);
  if (!fields.length) {
    const error = new Error("No supported fields supplied");
    error.statusCode = 400;
    throw error;
  }

  const result = db
    .prepare(`UPDATE ${resource} SET ${fields.map((field) => `${field} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...fields.map((field) => values[field]), id);
  if (!result.changes) {
    const error = new Error(`${resource.slice(0, -1)} not found`);
    error.statusCode = 404;
    throw error;
  }
  return mapRow(db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(id), config.json);
}

export function deleteResource(db, resource, id) {
  const result = db.prepare(`DELETE FROM ${resource} WHERE id = ?`).run(id);
  if (!result.changes) {
    const error = new Error(`${resource.slice(0, -1)} not found`);
    error.statusCode = 404;
    throw error;
  }
}

export function getDashboardData(db) {
  const companies = listResource(db, "companies");
  const clients = listResource(db, "clients");
  const projects = listResource(db, "projects");
  const actions = listResource(db, "actions");
  const risks = listResource(db, "risks");
  const opportunities = listResource(db, "opportunities");
  const decisions = listResource(db, "decisions");

  return {
    companies: companies.map((company) => ({
      ...company,
      clients: clients.filter((client) => client.companyId === company.id).map((client) => client.name),
      projects: projects.filter((project) => project.companyId === company.id),
    })),
    clients,
    projects,
    actions,
    risks,
    opportunities,
    decisions,
    operatingItems: [
      ...actions.map((item) => ({ ...item, type: "action" })),
      ...risks.map((item) => ({ ...item, type: "risk" })),
      ...opportunities.map((item) => ({ ...item, type: "opportunity" })),
      ...decisions.map((item) => ({ ...item, type: "decision" })),
    ],
    agents: listResource(db, "agents"),
    memories: listResource(db, "memories").map((memory) => ({
      ...memory,
      date: memory.recordedAt.slice(0, 10),
    })),
    integrations: listResource(db, "integrations"),
    approvals: listApprovalRequests(db),
    approvalSummary: getApprovalSummary(db),
  };
}

export function getMorningBrief(db) {
  const dashboard = getDashboardData(db);
  const open = (items) => items.filter((item) => item.status === "open");
  const actions = open(dashboard.actions);
  const risks = open(dashboard.risks);
  const opportunities = open(dashboard.opportunities);
  const decisions = open(dashboard.decisions);
  const agents = dashboard.agents;
  const calendar = dashboard.integrations.find((integration) => integration.id === "calendar");

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOpen: actions.length + risks.length + opportunities.length + decisions.length,
      actions: actions.length,
      risks: risks.length,
      opportunities: opportunities.length,
      decisions: decisions.length,
      agentsPlanned: agents.filter((agent) => agent.status === "Planned").length,
      agentsConnected: agents.filter((agent) => agent.status === "Connected").length,
    },
    actions,
    risks,
    meetings: {
      available: calendar?.status === "Connected",
      items: [],
      message: calendar?.status === "Connected"
        ? "Calendar is connected, but no meetings are currently recorded."
        : "Calendar is not connected. No meeting data was reviewed.",
    },
    opportunities,
    decisions,
    agents: agents.map(({ id, name, role, status }) => ({ id, name, role, status })),
    source: "backend",
  };
}

export function setIntegrationStatus(db, id, status) {
  if (!["Not connected", "Planned", "Connected"].includes(status)) {
    throw new Error(`Unsupported integration status: ${status}`);
  }
  db.prepare(`
    UPDATE integrations
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);
}

export function saveBriefing(db, brief) {
  const result = db.prepare(`
    INSERT INTO briefing_history (generated_at, source, summary, snapshot)
    VALUES (?, ?, ?, ?)
  `).run(
    brief.generatedAt,
    brief.source || "backend",
    JSON.stringify(brief.summary || {}),
    JSON.stringify(brief),
  );
  return getBriefing(db, Number(result.lastInsertRowid));
}

export function getBriefing(db, id) {
  const row = db.prepare(`
    SELECT
      h.*,
      COUNT(f.id) AS feedback_count,
      SUM(CASE WHEN f.rating = 'useful' THEN 1 ELSE 0 END) AS useful_count,
      SUM(CASE WHEN f.rating = 'not_useful' THEN 1 ELSE 0 END) AS not_useful_count
    FROM briefing_history h
    LEFT JOIN briefing_feedback f ON f.briefing_id = h.id
    WHERE h.id = ?
    GROUP BY h.id
  `).get(id);
  if (!row) return null;
  return {
    id: row.id,
    generatedAt: row.generated_at,
    source: row.source,
    summary: JSON.parse(row.summary),
    snapshot: JSON.parse(row.snapshot),
    feedback: {
      count: row.feedback_count,
      useful: row.useful_count || 0,
      notUseful: row.not_useful_count || 0,
    },
  };
}

export function listBriefings(db, limit = 20) {
  return db.prepare(`
    SELECT
      h.id,
      h.generated_at,
      h.source,
      h.summary,
      COUNT(f.id) AS feedback_count,
      SUM(CASE WHEN f.rating = 'useful' THEN 1 ELSE 0 END) AS useful_count,
      SUM(CASE WHEN f.rating = 'not_useful' THEN 1 ELSE 0 END) AS not_useful_count
    FROM briefing_history h
    LEFT JOIN briefing_feedback f ON f.briefing_id = h.id
    GROUP BY h.id
    ORDER BY h.generated_at DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 20, 1), 100)).map((row) => ({
    id: row.id,
    generatedAt: row.generated_at,
    source: row.source,
    summary: JSON.parse(row.summary),
    feedback: {
      count: row.feedback_count,
      useful: row.useful_count || 0,
      notUseful: row.not_useful_count || 0,
    },
  }));
}

export function saveBriefingFeedback(db, briefingId, { rating, note = "" }) {
  if (!["useful", "not_useful"].includes(rating)) {
    const error = new Error("Feedback rating must be useful or not_useful");
    error.statusCode = 400;
    throw error;
  }
  if (!db.prepare("SELECT id FROM briefing_history WHERE id = ?").get(briefingId)) {
    const error = new Error("Briefing not found");
    error.statusCode = 404;
    throw error;
  }
  const result = db.prepare(`
    INSERT INTO briefing_feedback (briefing_id, rating, note)
    VALUES (?, ?, ?)
  `).run(briefingId, rating, String(note).slice(0, 2000));
  return {
    id: Number(result.lastInsertRowid),
    briefingId: Number(briefingId),
    rating,
    note: String(note).slice(0, 2000),
  };
}

function mapApprovalRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    actionType: row.action_type,
    targetSystem: row.target_system,
    title: row.title,
    description: row.description,
    payload: JSON.parse(row.payload || "{}"),
    riskLevel: row.risk_level,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: toIsoTimestamp(row.requested_at),
    reviewedBy: row.reviewed_by,
    reviewedAt: toIsoTimestamp(row.reviewed_at),
    reviewNote: row.review_note,
    expiresAt: toIsoTimestamp(row.expires_at),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function toIsoTimestamp(value) {
  if (!value || value.includes("T")) return value;
  return `${value.replace(" ", "T")}Z`;
}

function mapApprovalEvent(row) {
  return {
    id: row.id,
    approvalId: row.approval_id,
    eventType: row.event_type,
    actor: row.actor,
    note: row.note,
    metadata: JSON.parse(row.metadata || "{}"),
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function createApprovalRequest(db, payload) {
  const actionType = String(payload.actionType || "").trim();
  const targetSystem = String(payload.targetSystem || "").trim();
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const riskLevel = String(payload.riskLevel || "medium").toLowerCase();
  const requestedBy = String(payload.requestedBy || "Alfred").trim();

  if (!actionType || !targetSystem || !title || !description) {
    const error = new Error("actionType, targetSystem, title and description are required");
    error.statusCode = 400;
    throw error;
  }
  if (!["low", "medium", "high"].includes(riskLevel)) {
    const error = new Error("riskLevel must be low, medium or high");
    error.statusCode = 400;
    throw error;
  }

  db.exec("BEGIN");
  try {
    const result = db.prepare(`
      INSERT INTO approval_requests (
        action_type, target_system, title, description, payload, risk_level,
        requested_by, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionType,
      targetSystem,
      title,
      description,
      JSON.stringify(payload.payload || {}),
      riskLevel,
      requestedBy || "Alfred",
      payload.expiresAt || null,
    );
    const id = Number(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO approval_events (approval_id, event_type, actor, note, metadata)
      VALUES (?, 'requested', ?, ?, ?)
    `).run(id, requestedBy || "Alfred", "Approval requested; no external action executed.", "{}");
    db.exec("COMMIT");
    return getApprovalRequest(db, id);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listApprovalRequests(db, status = "") {
  const rows = status
    ? db.prepare("SELECT * FROM approval_requests WHERE status = ? ORDER BY requested_at DESC, id DESC").all(status)
    : db.prepare("SELECT * FROM approval_requests ORDER BY requested_at DESC, id DESC").all();
  return rows.map(mapApprovalRow);
}

export function getApprovalRequest(db, id) {
  const request = mapApprovalRow(db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id));
  if (!request) return null;
  return {
    ...request,
    events: db
      .prepare("SELECT * FROM approval_events WHERE approval_id = ? ORDER BY created_at ASC, id ASC")
      .all(id)
      .map(mapApprovalEvent),
    execution: {
      available: false,
      message: "Approval records authorization only. External execution is disabled.",
    },
  };
}

export function reviewApprovalRequest(db, id, decision, { actor = "Patrick King", note = "" } = {}) {
  if (!["approved", "rejected", "cancelled"].includes(decision)) {
    const error = new Error("Decision must be approved, rejected or cancelled");
    error.statusCode = 400;
    throw error;
  }
  const current = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id);
  if (!current) {
    const error = new Error("Approval request not found");
    error.statusCode = 404;
    throw error;
  }
  if (current.status !== "pending") {
    const error = new Error(`Approval request is already ${current.status}`);
    error.statusCode = 409;
    throw error;
  }

  const reviewer = String(actor || "Patrick King").trim() || "Patrick King";
  const reviewNote = String(note || "").slice(0, 2000);
  db.exec("BEGIN");
  try {
    db.prepare(`
      UPDATE approval_requests
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          review_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, reviewer, reviewNote, id);
    db.prepare(`
      INSERT INTO approval_events (approval_id, event_type, actor, note, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      decision,
      reviewer,
      reviewNote || `${decision[0].toUpperCase()}${decision.slice(1)} without external execution.`,
      JSON.stringify({ executionAvailable: false }),
    );
    db.exec("COMMIT");
    return getApprovalRequest(db, id);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getApprovalSummary(db) {
  const counts = Object.fromEntries(
    db.prepare("SELECT status, COUNT(*) AS count FROM approval_requests GROUP BY status")
      .all()
      .map((row) => [row.status, row.count]),
  );
  return {
    pending: counts.pending || 0,
    approved: counts.approved || 0,
    rejected: counts.rejected || 0,
    cancelled: counts.cancelled || 0,
    expired: counts.expired || 0,
    executionEnabled: false,
  };
}
