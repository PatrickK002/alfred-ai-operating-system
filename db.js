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
  ["outlook", "Microsoft Outlook", "O", "Email reading, attachment analysis, action extraction and draft replies.", "Not connected"],
  ["calendar", "Outlook Calendar", "C", "Meeting context, daily schedules, preparation and briefing inputs.", "Not connected"],
  ["sharepoint", "OneDrive / SharePoint", "S", "Read and create Word, Excel, PDF and PowerPoint documents.", "Planned"],
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
  if (companyCount > 0) return;

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

    const insertIntegration = db.prepare(`
      INSERT INTO integrations (id, name, symbol, description, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const integration of INTEGRATION_SEEDS) insertIntegration.run(...integration);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
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
