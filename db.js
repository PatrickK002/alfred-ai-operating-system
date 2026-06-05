import { mkdirSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
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
    payload_hash TEXT NOT NULL DEFAULT '',
    idempotency_key TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS approval_preflight_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    checked_by TEXT NOT NULL,
    result TEXT NOT NULL,
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
  migrateApprovalSchema(db);
  seedDatabase(db);
  return db;
}

function migrateApprovalSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const actionFingerprintV2 = db.prepare(`
    SELECT id FROM schema_migrations WHERE id = 'approval_action_fingerprint_v2'
  `).get();
  const columns = new Set(db.prepare("PRAGMA table_info(approval_requests)").all().map((column) => column.name));
  if (!columns.has("payload_hash")) {
    db.exec("ALTER TABLE approval_requests ADD COLUMN payload_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has("idempotency_key")) {
    db.exec("ALTER TABLE approval_requests ADD COLUMN idempotency_key TEXT");
  }

  const requests = db.prepare(`
    SELECT id, action_type, target_system, title, description, payload, payload_hash, idempotency_key
    FROM approval_requests
  `).all();
  const update = db.prepare(`
    UPDATE approval_requests
    SET payload_hash = ?, idempotency_key = ?
    WHERE id = ?
  `);
  for (const request of requests) {
    const parsedPayload = JSON.parse(request.payload || "{}");
    const fingerprint = requestFingerprint({
      actionType: request.action_type,
      targetSystem: request.target_system,
      title: request.title,
      description: request.description,
      payload: parsedPayload,
    });
    const payloadHash = !actionFingerprintV2 || !request.payload_hash ? fingerprint : request.payload_hash;
    const idempotencyKey = request.idempotency_key || `legacy-${request.id}-${fingerprint.slice(0, 24)}`;
    update.run(payloadHash, idempotencyKey, request.id);
  }
  if (!actionFingerprintV2) {
    db.prepare("INSERT INTO schema_migrations (id) VALUES ('approval_action_fingerprint_v2')").run();
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS approval_requests_idempotency_key
    ON approval_requests(idempotency_key);
    CREATE TABLE IF NOT EXISTS approval_preflight_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      approval_id INTEGER NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
      checked_by TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
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
    payloadHash: row.payload_hash,
    idempotencyKey: row.idempotency_key,
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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestFingerprint(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex");
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

function normalizeExpiry(value) {
  const now = Date.now();
  const parsed = value ? Date.parse(value) : now + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(parsed) || parsed <= now) {
    const error = new Error("expiresAt must be a future date");
    error.statusCode = 400;
    throw error;
  }
  if (parsed > now + 7 * 24 * 60 * 60 * 1000) {
    const error = new Error("expiresAt cannot be more than seven days in the future");
    error.statusCode = 400;
    throw error;
  }
  return new Date(parsed).toISOString();
}

function verifyApprovalIntegrity(row) {
  return requestFingerprint({
    actionType: row.action_type,
    targetSystem: row.target_system,
    title: row.title,
    description: row.description,
    payload: JSON.parse(row.payload || "{}"),
  }) === row.payload_hash;
}

export function expireApprovalRequests(db, now = new Date()) {
  const expired = db.prepare(`
    SELECT id
    FROM approval_requests
    WHERE status IN ('pending', 'approved')
      AND expires_at IS NOT NULL
      AND datetime(expires_at) <= datetime(?)
  `).all(now.toISOString());
  if (!expired.length) return 0;

  db.exec("BEGIN");
  try {
    const update = db.prepare(`
      UPDATE approval_requests
      SET status = 'expired', reviewed_at = COALESCE(reviewed_at, ?),
          review_note = CASE WHEN review_note = '' THEN 'Approval expired before execution.' ELSE review_note END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('pending', 'approved')
    `);
    const event = db.prepare(`
      INSERT INTO approval_events (approval_id, event_type, actor, note, metadata)
      VALUES (?, 'expired', 'Alfred', 'Approval validity window expired. No external action executed.', ?)
    `);
    for (const request of expired) {
      const result = update.run(now.toISOString(), request.id);
      if (result.changes) event.run(request.id, JSON.stringify({ executionAvailable: false }));
    }
    db.exec("COMMIT");
    return expired.length;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createApprovalRequest(db, payload) {
  const actionType = String(payload.actionType || "").trim();
  const targetSystem = String(payload.targetSystem || "").trim();
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const riskLevel = String(payload.riskLevel || "medium").toLowerCase();
  const requestedBy = String(payload.requestedBy || "Alfred").trim();
  const requestPayload = payload.payload || {};
  const payloadHash = requestFingerprint({
    actionType,
    targetSystem,
    title,
    description,
    payload: requestPayload,
  });
  const idempotencyKey = String(payload.idempotencyKey || randomUUID()).trim();
  const expiresAt = normalizeExpiry(payload.expiresAt);

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
  if (!idempotencyKey || idempotencyKey.length > 200) {
    const error = new Error("idempotencyKey must be between 1 and 200 characters");
    error.statusCode = 400;
    throw error;
  }

  const existing = db.prepare("SELECT id, payload_hash FROM approval_requests WHERE idempotency_key = ?").get(idempotencyKey);
  if (existing) {
    if (existing.payload_hash !== payloadHash) {
      const error = new Error("Idempotency key is already associated with a different approval request");
      error.statusCode = 409;
      throw error;
    }
    return getApprovalRequest(db, existing.id);
  }

  db.exec("BEGIN");
  try {
    const result = db.prepare(`
      INSERT INTO approval_requests (
        action_type, target_system, title, description, payload, payload_hash,
        idempotency_key, risk_level,
        requested_by, expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionType,
      targetSystem,
      title,
      description,
      JSON.stringify(requestPayload),
      payloadHash,
      idempotencyKey,
      riskLevel,
      requestedBy || "Alfred",
      expiresAt,
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
  expireApprovalRequests(db);
  const rows = status
    ? db.prepare("SELECT * FROM approval_requests WHERE status = ? ORDER BY requested_at DESC, id DESC").all(status)
    : db.prepare("SELECT * FROM approval_requests ORDER BY requested_at DESC, id DESC").all();
  return rows.map((row) => ({
    ...mapApprovalRow(row),
    latestPreflight: getLatestApprovalPreflight(db, row.id),
  }));
}

export function getApprovalRequest(db, id) {
  expireApprovalRequests(db);
  const request = mapApprovalRow(db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id));
  if (!request) return null;
  return {
    ...request,
    events: db
      .prepare("SELECT * FROM approval_events WHERE approval_id = ? ORDER BY created_at ASC, id ASC")
      .all(id)
      .map(mapApprovalEvent),
    integrityVerified: requestFingerprint({
      actionType: request.actionType,
      targetSystem: request.targetSystem,
      title: request.title,
      description: request.description,
      payload: request.payload,
    }) === request.payloadHash,
    latestPreflight: getLatestApprovalPreflight(db, id),
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
  expireApprovalRequests(db);
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
  if (!verifyApprovalIntegrity(current)) {
    const error = new Error("Approval payload integrity check failed");
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
  expireApprovalRequests(db);
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
    preflightChecks: db.prepare("SELECT COUNT(*) AS count FROM approval_preflight_checks").get().count,
    releaseReady: 0,
    executionEnabled: false,
  };
}

function getLatestApprovalPreflight(db, id) {
  const row = db.prepare(`
    SELECT *
    FROM approval_preflight_checks
    WHERE approval_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(id);
  if (!row) return null;
  return {
    id: row.id,
    approvalId: row.approval_id,
    checkedBy: row.checked_by,
    result: JSON.parse(row.result),
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function runApprovalPreflight(db, id, { actor = "Patrick King" } = {}) {
  expireApprovalRequests(db);
  const row = db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id);
  if (!row) {
    const error = new Error("Approval request not found");
    error.statusCode = 404;
    throw error;
  }

  const expiresAt = row.expires_at ? Date.parse(toIsoTimestamp(row.expires_at)) : null;
  const checks = {
    approved: {
      passed: row.status === "approved",
      message: row.status === "approved" ? "Explicit approval is recorded." : `Request status is ${row.status}.`,
    },
    notExpired: {
      passed: row.status !== "expired" && (!expiresAt || expiresAt > Date.now()),
      message: row.status === "expired" ? "Approval has expired." : "Approval is within its validity window.",
    },
    payloadIntegrity: {
      passed: verifyApprovalIntegrity(row),
      message: verifyApprovalIntegrity(row) ? "Stored action matches its SHA-256 fingerprint." : "Stored action has changed.",
    },
    idempotency: {
      passed: Boolean(row.idempotency_key),
      message: row.idempotency_key ? "A retry-safe idempotency key is present." : "No idempotency key is present.",
    },
    identityReauthentication: {
      passed: false,
      available: false,
      message: "Identity re-authentication is not implemented.",
    },
    executor: {
      passed: false,
      available: false,
      message: "No external action executor is installed.",
    },
  };
  const result = {
    ready: Object.values(checks).every((check) => check.passed),
    checks,
    executionAvailable: false,
    checkedAt: new Date().toISOString(),
  };
  const checkedBy = String(actor || "Patrick King").trim() || "Patrick King";
  const insert = db.prepare(`
    INSERT INTO approval_preflight_checks (approval_id, checked_by, result)
    VALUES (?, ?, ?)
  `).run(id, checkedBy, JSON.stringify(result));
  return {
    id: Number(insert.lastInsertRowid),
    approvalId: Number(id),
    checkedBy,
    result,
  };
}
