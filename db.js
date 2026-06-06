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

  CREATE TABLE IF NOT EXISTS ai_analysis_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    analysis_type TEXT NOT NULL,
    user_action TEXT NOT NULL,
    data_categories TEXT NOT NULL DEFAULT '[]',
    output_saved INTEGER NOT NULL DEFAULT 0 CHECK(output_saved IN (0, 1)),
    model TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'error')),
    error_code TEXT NOT NULL DEFAULT '',
    execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK(execution_attempted IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS semantic_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_created_at TEXT NOT NULL,
    summary TEXT NOT NULL,
    embedding TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dimension INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    sensitivity_category TEXT NOT NULL DEFAULT 'local_sensitive_business_data',
    indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_id)
  );

  CREATE INDEX IF NOT EXISTS semantic_memory_source
  ON semantic_memory(source_type, source_id);

  CREATE TABLE IF NOT EXISTS financial_business_entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('group', 'division', 'business', 'product', 'venture')),
    parent_entity_id TEXT REFERENCES financial_business_entities(id),
    company_id TEXT REFERENCES companies(id),
    status TEXT NOT NULL DEFAULT 'planned',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS service_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_type TEXT NOT NULL,
    source_name TEXT NOT NULL,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    source_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('imported', 'dry_run', 'pending_overwrite', 'failed')),
    rows_total INTEGER NOT NULL DEFAULT 0,
    rows_imported INTEGER NOT NULL DEFAULT 0,
    rows_updated INTEGER NOT NULL DEFAULT 0,
    duplicates_count INTEGER NOT NULL DEFAULT 0,
    validation_errors_count INTEGER NOT NULL DEFAULT 0,
    overwrite_approved INTEGER NOT NULL DEFAULT 0 CHECK(overwrite_approved IN (0, 1)),
    summary TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_import_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES financial_imports(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    before_snapshot TEXT NOT NULL DEFAULT '{}',
    after_snapshot TEXT NOT NULL DEFAULT '{}',
    message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_book_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    financial_year_id INTEGER NOT NULL REFERENCES financial_years(id),
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    company_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES companies(id),
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    service_line TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('secured', 'pipeline', 'opportunity', 'forecast')),
    status TEXT NOT NULL DEFAULT '',
    amount_gbp REAL NOT NULL DEFAULT 0,
    probability REAL NOT NULL DEFAULT 1,
    weighted_amount_gbp REAL NOT NULL DEFAULT 0,
    forecast_month TEXT NOT NULL DEFAULT '',
    forecast_quarter TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'excel_order_book',
    source_file TEXT NOT NULL DEFAULT '',
    source_sheet TEXT NOT NULL DEFAULT '',
    source_row INTEGER NOT NULL DEFAULT 0,
    source_ref TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    duplicate_key TEXT NOT NULL,
    import_id INTEGER REFERENCES financial_imports(id),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_ref)
  );

  CREATE INDEX IF NOT EXISTS order_book_entries_year
  ON order_book_entries(financial_year_id);

  CREATE TABLE IF NOT EXISTS forecast_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    financial_year_id INTEGER NOT NULL REFERENCES financial_years(id),
    period_type TEXT NOT NULL CHECK(period_type IN ('month', 'quarter', 'year')),
    period_label TEXT NOT NULL,
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_entity_id, financial_year_id, period_type, period_label)
  );

  CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    financial_year_id INTEGER NOT NULL REFERENCES financial_years(id),
    forecast_period_id INTEGER REFERENCES forecast_periods(id),
    scenario TEXT NOT NULL CHECK(scenario IN ('best_case', 'expected_case', 'worst_case', 'probability_weighted', 'resource_revenue')),
    amount_gbp REAL NOT NULL DEFAULT 0,
    basis TEXT NOT NULL DEFAULT '',
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS revenue_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    financial_year_id INTEGER REFERENCES financial_years(id),
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    service_line TEXT NOT NULL DEFAULT '',
    amount_gbp REAL NOT NULL DEFAULT 0,
    source_type TEXT NOT NULL DEFAULT 'order_book',
    source_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cost_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL REFERENCES financial_business_entities(id),
    financial_year_id INTEGER REFERENCES financial_years(id),
    cost_category TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    amount_gbp REAL NOT NULL DEFAULT 0,
    period_label TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual_summary',
    source_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL REFERENCES financial_business_entities(id),
    financial_year_id INTEGER REFERENCES financial_years(id),
    budget_type TEXT NOT NULL CHECK(budget_type IN ('revenue', 'cost', 'cashflow', 'margin', 'kpi')),
    period_label TEXT NOT NULL DEFAULT '',
    amount_gbp REAL NOT NULL DEFAULT 0,
    target_value REAL,
    unit TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual_summary',
    source_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kpi_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL REFERENCES financial_business_entities(id),
    financial_year_id INTEGER REFERENCES financial_years(id),
    kpi_name TEXT NOT NULL,
    kpi_value REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '',
    period_label TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual_summary',
    source_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoice_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    source_system TEXT NOT NULL DEFAULT 'monday',
    external_id TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    invoice_reference TEXT NOT NULL DEFAULT '',
    amount_gbp REAL NOT NULL DEFAULT 0,
    issued_date TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL DEFAULT '',
    paid_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('issued', 'paid', 'overdue', 'draft', 'unknown')),
    raw_summary TEXT NOT NULL DEFAULT '{}',
    last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_entity_id, source_system, external_id)
  );

  CREATE TABLE IF NOT EXISTS debtor_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    source_system TEXT NOT NULL DEFAULT 'monday',
    client_name TEXT NOT NULL,
    amount_outstanding_gbp REAL NOT NULL DEFAULT 0,
    amount_overdue_gbp REAL NOT NULL DEFAULT 0,
    invoice_count INTEGER NOT NULL DEFAULT 0,
    oldest_due_date TEXT NOT NULL DEFAULT '',
    last_refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_entity_id, source_system, client_name)
  );

  CREATE TABLE IF NOT EXISTS cashflow_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'digitize' REFERENCES financial_business_entities(id),
    snapshot_date TEXT NOT NULL,
    expected_inflow_gbp REAL NOT NULL DEFAULT 0,
    overdue_gbp REAL NOT NULL DEFAULT 0,
    commentary TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'financial_dashboard',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS board_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT REFERENCES financial_business_entities(id),
    scope_type TEXT NOT NULL DEFAULT 'group' CHECK(scope_type IN ('group', 'division', 'business', 'product', 'venture')),
    scope_id TEXT NOT NULL DEFAULT 'group',
    financial_year_id INTEGER REFERENCES financial_years(id),
    quarter TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '{}',
    markdown TEXT NOT NULL,
    generated_by TEXT NOT NULL DEFAULT 'Olivia',
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'group' REFERENCES financial_business_entities(id),
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
    source_ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'group' REFERENCES financial_business_entities(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
    amount_gbp REAL NOT NULL DEFAULT 0,
    source_ref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'group' REFERENCES financial_business_entities(id),
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    value_gbp REAL NOT NULL DEFAULT 0,
    probability REAL NOT NULL DEFAULT 0,
    source_ref TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'group' REFERENCES financial_business_entities(id),
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'Olivia',
    source TEXT NOT NULL DEFAULT '',
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

const FINANCIAL_BUSINESS_ENTITY_SEEDS = [
  ["group", "Patrick King Group", "group", null, null, "active", "Consolidated reporting scope for all Alfred-managed businesses."],
  ["digitize", "Digitize Consultants", "business", "group", "digitize", "active", "Digital construction consultancy and current order book source."],
  ["council-assurance-platform", "Council Assurance Platform", "product", "group", "product", "planned", "Future SaaS product for council construction assurance."],
  ["media-businesses", "Media Businesses", "division", "group", "media", "planned", "Media Studio and automated content businesses."],
  ["ai-businesses", "AI Businesses", "division", "group", "venture", "planned", "AI Venture Studio and AI-led businesses."],
  ["future-saas-products", "Future SaaS Products", "division", "group", "product", "planned", "Future software products managed by Alfred."],
  ["future-ventures", "Future Ventures", "venture", "group", "venture", "planned", "Future venture businesses and recurring-income experiments."],
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
  ["olivia", "Olivia", "Chief Financial Officer", null, "Finance", "Act as Group CFO across Alfred-managed businesses, producing read-only revenue, forecast, debtor, cashflow, KPI and board-reporting intelligence.", [], "Planned"],
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
  ["anthropic", "Anthropic Claude", "A", "Read-only reasoning for executive briefings, risk review, prioritisation and decision support.", "Planned"],
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
  ensureDefaultSettings(db);
  migrateApprovalSchema(db);
  migrateFinancialBusinessSchema(db);
  seedDatabase(db);
  return db;
}

function ensureDefaultSettings(db) {
  const semanticDefault = String(process.env.SEMANTIC_INDEXING_ENABLED || "true").toLowerCase() === "false"
    ? "false"
    : "true";
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('semantic_indexing_enabled', ?)
  `).run(semanticDefault);
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

function migrateFinancialBusinessSchema(db) {
  const columnsFor = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  const addColumn = (table, definition) => {
    const name = definition.trim().split(/\s+/)[0];
    if (!columnsFor(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };

  for (const table of ["financial_imports", "order_book_entries", "forecasts", "revenue_lines", "invoice_summaries", "debtor_summaries", "cashflow_snapshots"]) {
    addColumn(table, "business_entity_id TEXT NOT NULL DEFAULT 'digitize'");
  }
  addColumn("forecast_periods", "business_entity_id TEXT NOT NULL DEFAULT 'digitize'");
  addColumn("board_reports", "business_entity_id TEXT");
  addColumn("board_reports", "scope_type TEXT NOT NULL DEFAULT 'group'");
  addColumn("board_reports", "scope_id TEXT NOT NULL DEFAULT 'group'");
  for (const table of ["financial_insights", "financial_risks", "financial_opportunities", "financial_audit_events"]) {
    addColumn(table, "business_entity_id TEXT NOT NULL DEFAULT 'group'");
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS invoice_summaries_business_source_external_unique
    ON invoice_summaries(business_entity_id, source_system, external_id);

    CREATE UNIQUE INDEX IF NOT EXISTS debtor_summaries_business_source_client_unique
    ON debtor_summaries(business_entity_id, source_system, client_name);
  `);
}

export function seedDatabase(db) {
  const companyCount = db.prepare("SELECT COUNT(*) AS count FROM companies").get().count;
  if (companyCount > 0) {
    updateFinancialBusinessEntities(db);
    updateAgentDefinitions(db);
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

    updateFinancialBusinessEntities(db);

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

function updateAgentDefinitions(db) {
  const insertAgent = db.prepare(`
    INSERT OR IGNORE INTO agents (id, name, role, company_id, department, mission, tools, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateAgent = db.prepare(`
    UPDATE agents
    SET name = ?, role = ?, company_id = ?, department = ?, mission = ?, tools = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const agent of AGENT_SEEDS) {
    insertAgent.run(...agent.slice(0, 6), JSON.stringify(agent[6]), agent[7]);
    updateAgent.run(agent[1], agent[2], agent[3], agent[4], agent[5], JSON.stringify(agent[6]), agent[0]);
  }
}

function updateFinancialBusinessEntities(db) {
  const insertEntity = db.prepare(`
    INSERT OR IGNORE INTO financial_business_entities (
      id, name, entity_type, parent_entity_id, company_id, status, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateEntity = db.prepare(`
    UPDATE financial_business_entities
    SET name = ?, entity_type = ?, parent_entity_id = ?, company_id = ?,
        status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const entity of FINANCIAL_BUSINESS_ENTITY_SEEDS) {
    insertEntity.run(...entity);
    updateEntity.run(entity[1], entity[2], entity[3], entity[4], entity[5], entity[6], entity[0]);
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`;
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

export function recordAiAnalysisAudit(db, {
  analysisType,
  userAction,
  dataCategories = [],
  outputSaved = false,
  model,
  status,
  errorCode = "",
  executionAttempted = false,
}) {
  const result = db.prepare(`
    INSERT INTO ai_analysis_audit (
      analysis_type, user_action, data_categories, output_saved,
      model, status, error_code, execution_attempted
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(analysisType),
    String(userAction),
    JSON.stringify(dataCategories),
    outputSaved ? 1 : 0,
    String(model),
    String(status),
    String(errorCode).slice(0, 200),
    executionAttempted ? 1 : 0,
  );
  return getAiAnalysisAudit(db, Number(result.lastInsertRowid));
}

export function getAiAnalysisAudit(db, id) {
  const row = db.prepare("SELECT * FROM ai_analysis_audit WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    requestedAt: toIsoTimestamp(row.requested_at),
    analysisType: row.analysis_type,
    userAction: row.user_action,
    dataCategories: JSON.parse(row.data_categories || "[]"),
    outputSaved: Boolean(row.output_saved),
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    executionAttempted: Boolean(row.execution_attempted),
  };
}

export function listAiAnalysisAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM ai_analysis_audit
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    id: row.id,
    requestedAt: toIsoTimestamp(row.requested_at),
    analysisType: row.analysis_type,
    userAction: row.user_action,
    dataCategories: JSON.parse(row.data_categories || "[]"),
    outputSaved: Boolean(row.output_saved),
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    executionAttempted: Boolean(row.execution_attempted),
  }));
}

export function getSetting(db, key, fallback = "") {
  return db.prepare("SELECT value FROM app_settings WHERE key = ?").get(String(key))?.value ?? fallback;
}

export function setSetting(db, key, value) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(String(key), String(value));
  return getSetting(db, key);
}

export function getSemanticIndexingEnabled(db) {
  return getSetting(db, "semantic_indexing_enabled", "true") === "true";
}

export function setSemanticIndexingEnabled(db, enabled) {
  return setSetting(db, "semantic_indexing_enabled", enabled ? "true" : "false") === "true";
}

function semanticRecord({
  sourceType,
  sourceId,
  sourceCreatedAt,
  title,
  summary,
  sensitivityCategory = "local_sensitive_business_data",
}) {
  return {
    sourceType,
    sourceId: String(sourceId),
    sourceCreatedAt: toIsoTimestamp(String(sourceCreatedAt || new Date().toISOString())),
    title: String(title || `${sourceType}:${sourceId}`).slice(0, 300),
    summary: String(summary || "").replace(/\s+/g, " ").trim().slice(0, 2400),
    sensitivityCategory,
  };
}

function companyLabel(row) {
  return row.company_short_name || row.company_name || "Group";
}

function operatingSummary(kind, row) {
  const parts = [
    `${kind}: ${row.title}.`,
    row.detail,
    `Company: ${companyLabel(row)}.`,
    `Priority: ${row.priority || "medium"}.`,
    `Status: ${row.status || "open"}.`,
    row.due ? `Timing: ${row.due}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function briefingSummaryRecord(row) {
  const summary = safeJsonParse(row.summary, {});
  const snapshot = safeJsonParse(row.snapshot, {});
  const priorities = (snapshot.executivePriorities || [])
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.detail || item.category || ""}`)
    .join(" ");
  return semanticRecord({
    sourceType: "briefing",
    sourceId: row.id,
    sourceCreatedAt: row.generated_at,
    title: `Executive briefing ${row.id}`,
    summary: [
      `Executive briefing generated ${row.generated_at}.`,
      `Open records: ${summary.totalOpen || 0}.`,
      `Priority emails: ${summary.priorityEmails || 0}.`,
      `Meetings within 24 hours: ${summary.meetingsToday || 0}.`,
      `Decision prompts: ${summary.decisionPrompts || 0}.`,
      priorities ? `Top priorities: ${priorities}` : "",
    ].filter(Boolean).join(" "),
  });
}

function microsoftSummaryRecords(row) {
  const snapshot = safeJsonParse(row.snapshot, {});
  const emails = (snapshot.emails || []).slice(0, 10).map((email, index) => semanticRecord({
    sourceType: "microsoft_email_summary",
    sourceId: `${row.id}:${email.id || index}`,
    sourceCreatedAt: email.receivedDateTime || row.generated_at,
    title: email.title || "(No subject)",
    summary: [
      `Outlook email summary captured in briefing ${row.id}.`,
      `Subject: ${email.title || "(No subject)"}.`,
      email.detail,
      email.importance ? `Importance: ${email.importance}.` : "",
      email.priority ? `Priority: ${email.priority}.` : "",
      email.reasons?.length ? `Reasons: ${email.reasons.join("; ")}.` : "",
    ].filter(Boolean).join(" "),
  }));
  const meetings = (snapshot.meetings?.items || []).slice(0, 10).map((meeting, index) => semanticRecord({
    sourceType: "microsoft_calendar_summary",
    sourceId: `${row.id}:${meeting.id || index}`,
    sourceCreatedAt: meeting.start?.dateTime || row.generated_at,
    title: meeting.title || "(Untitled meeting)",
    summary: [
      `Calendar meeting summary captured in briefing ${row.id}.`,
      `Meeting: ${meeting.title || "(Untitled meeting)"}.`,
      meeting.detail,
      meeting.urgency ? `Urgency: ${meeting.urgency}.` : "",
      meeting.preparation?.length ? `Preparation: ${meeting.preparation.join("; ")}.` : "",
    ].filter(Boolean).join(" "),
  }));
  return [...emails, ...meetings];
}

export function listSemanticSourceRecords(db, { briefingLimit = 10, includeMicrosoftSummaries = true } = {}) {
  const records = [];
  const memoryRows = db.prepare(`
    SELECT m.*, c.short_name AS company_short_name, c.name AS company_name
    FROM memories m
    LEFT JOIN companies c ON c.id = m.company_id
    ORDER BY m.recorded_at DESC, m.id DESC
  `).all();
  for (const row of memoryRows) {
    records.push(semanticRecord({
      sourceType: "memory",
      sourceId: row.id,
      sourceCreatedAt: row.recorded_at,
      title: row.title,
      summary: `Memory (${row.type}): ${row.title}. ${row.detail}. Company: ${companyLabel(row)}.`,
    }));
  }

  for (const [table, label] of [
    ["actions", "Action"],
    ["risks", "Risk"],
    ["opportunities", "Opportunity"],
    ["decisions", "Decision"],
  ]) {
    const rows = db.prepare(`
      SELECT r.*, c.short_name AS company_short_name, c.name AS company_name
      FROM ${table} r
      LEFT JOIN companies c ON c.id = r.company_id
      ORDER BY r.updated_at DESC, r.id DESC
    `).all();
    for (const row of rows) {
      records.push(semanticRecord({
        sourceType: table.slice(0, -1),
        sourceId: row.id,
        sourceCreatedAt: row.created_at,
        title: row.title,
        summary: operatingSummary(label, row),
      }));
    }
  }

  const approvals = db.prepare(`
    SELECT *
    FROM approval_requests
    ORDER BY requested_at DESC, id DESC
  `).all();
  for (const row of approvals) {
    records.push(semanticRecord({
      sourceType: "approval",
      sourceId: row.id,
      sourceCreatedAt: row.requested_at,
      title: row.title,
      summary: [
        `Approval request: ${row.title}.`,
        row.description,
        `Target system: ${row.target_system}.`,
        `Action type: ${row.action_type}.`,
        `Risk level: ${row.risk_level}.`,
        `Status: ${row.status}.`,
      ].filter(Boolean).join(" "),
    }));
  }

  const briefings = db.prepare(`
    SELECT id, generated_at, summary, snapshot
    FROM briefing_history
    ORDER BY generated_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(briefingLimit) || 10, 1), 50));
  for (const row of briefings) {
    records.push(briefingSummaryRecord(row));
    if (includeMicrosoftSummaries) records.push(...microsoftSummaryRecords(row));
  }

  const orderBookRows = db.prepare(`
    SELECT e.*, y.label AS financial_year
    FROM order_book_entries e
    JOIN financial_years y ON y.id = e.financial_year_id
    ORDER BY e.updated_at DESC, e.id DESC
    LIMIT 200
  `).all();
  for (const row of orderBookRows) {
    records.push(semanticRecord({
      sourceType: "financial_order_book",
      sourceId: row.id,
      sourceCreatedAt: row.created_at,
      title: row.title,
      summary: [
        `Financial order book entry: ${row.title}.`,
        `Financial year: ${row.financial_year}.`,
        `Client: ${row.client_name}.`,
        `Project: ${row.project_name}.`,
        `Service line: ${row.service_line}.`,
        `Type: ${row.entry_type}.`,
        `Amount GBP: ${row.amount_gbp}.`,
        `Weighted amount GBP: ${row.weighted_amount_gbp}.`,
        `Source: ${row.source_ref}.`,
      ].join(" "),
    }));
  }

  const boardReports = db.prepare(`
    SELECT id, title, summary, generated_at
    FROM board_reports
    ORDER BY generated_at DESC, id DESC
    LIMIT 20
  `).all();
  for (const row of boardReports) {
    records.push(semanticRecord({
      sourceType: "financial_board_report",
      sourceId: row.id,
      sourceCreatedAt: row.generated_at,
      title: row.title,
      summary: `Financial board report: ${row.title}. Summary: ${row.summary}.`,
    }));
  }

  return records.filter((record) => record.summary);
}

function mapSemanticMemoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceCreatedAt: toIsoTimestamp(row.source_created_at),
    summary: row.summary,
    embedding: JSON.parse(row.embedding || "[]"),
    embeddingModel: row.embedding_model,
    embeddingDimension: row.embedding_dimension,
    contentHash: row.content_hash,
    sensitivityCategory: row.sensitivity_category,
    indexedAt: toIsoTimestamp(row.indexed_at),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export function getSemanticMemoryRecord(db, sourceType, sourceId) {
  return mapSemanticMemoryRow(db.prepare(`
    SELECT *
    FROM semantic_memory
    WHERE source_type = ? AND source_id = ?
  `).get(String(sourceType), String(sourceId)));
}

export function shouldIndexSemanticRecord(db, { sourceType, sourceId, contentHash, embeddingModel }) {
  const existing = getSemanticMemoryRecord(db, sourceType, sourceId);
  return !existing || existing.contentHash !== contentHash || existing.embeddingModel !== embeddingModel;
}

export function upsertSemanticMemoryRecord(db, {
  sourceType,
  sourceId,
  sourceCreatedAt,
  summary,
  embedding,
  embeddingModel,
  contentHash,
  sensitivityCategory = "local_sensitive_business_data",
}) {
  const vector = Array.isArray(embedding) ? embedding.map(Number) : [];
  if (!vector.length) {
    const error = new Error("Semantic memory embedding is required");
    error.statusCode = 400;
    throw error;
  }
  db.prepare(`
    INSERT INTO semantic_memory (
      source_type, source_id, source_created_at, summary,
      embedding, embedding_model, embedding_dimension, content_hash,
      sensitivity_category, indexed_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(source_type, source_id) DO UPDATE SET
      source_created_at = excluded.source_created_at,
      summary = excluded.summary,
      embedding = excluded.embedding,
      embedding_model = excluded.embedding_model,
      embedding_dimension = excluded.embedding_dimension,
      content_hash = excluded.content_hash,
      sensitivity_category = excluded.sensitivity_category,
      indexed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    String(sourceType),
    String(sourceId),
    String(sourceCreatedAt),
    String(summary).slice(0, 2400),
    JSON.stringify(vector),
    String(embeddingModel),
    vector.length,
    String(contentHash),
    String(sensitivityCategory),
  );
  return getSemanticMemoryRecord(db, sourceType, sourceId);
}

export function listSemanticMemoryRecords(db, limit = 1000) {
  return db.prepare(`
    SELECT *
    FROM semantic_memory
    ORDER BY indexed_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 1000, 1), 5000)).map(mapSemanticMemoryRow);
}

export function getSemanticMemoryStats(db) {
  const row = db.prepare("SELECT COUNT(*) AS count, MAX(indexed_at) AS last_indexed_at FROM semantic_memory").get();
  return {
    count: row.count || 0,
    lastIndexedAt: toIsoTimestamp(row.last_indexed_at),
  };
}

export function deleteSemanticMemoryRecord(db, sourceType, sourceId) {
  db.prepare(`
    DELETE FROM semantic_memory
    WHERE source_type = ? AND source_id = ?
  `).run(String(sourceType), String(sourceId));
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
