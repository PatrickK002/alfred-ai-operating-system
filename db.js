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

  CREATE TABLE IF NOT EXISTS project_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id),
    company_id TEXT NOT NULL REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    service_line TEXT NOT NULL DEFAULT 'Information Management',
    lead_name TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '',
    current_phase TEXT NOT NULL DEFAULT 'Discovery',
    summary TEXT NOT NULL DEFAULT '',
    financial_business_entity_id TEXT REFERENCES financial_business_entities(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, client_name, project_name)
  );

  CREATE TABLE IF NOT EXISTS project_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'microsoft',
    external_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    path TEXT NOT NULL DEFAULT '',
    web_url TEXT NOT NULL DEFAULT '',
    file_type TEXT NOT NULL DEFAULT '',
    classification TEXT NOT NULL DEFAULT 'Unknown',
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_datetime TEXT NOT NULL DEFAULT '',
    modified_datetime TEXT NOT NULL DEFAULT '',
    parent_folder TEXT NOT NULL DEFAULT '',
    owner_name TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    association_confidence REAL NOT NULL DEFAULT 0,
    association_reason TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, source_system, external_id)
  );

  CREATE TABLE IF NOT EXISTS project_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL DEFAULT 'status',
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'alfred',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'medium',
    due TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    source_type TEXT NOT NULL DEFAULT 'alfred',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'open',
    source_type TEXT NOT NULL DEFAULT 'alfred',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    decided_at TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'alfred',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'microsoft',
    external_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    start_datetime TEXT NOT NULL DEFAULT '',
    end_datetime TEXT NOT NULL DEFAULT '',
    organizer TEXT NOT NULL DEFAULT '',
    attendees TEXT NOT NULL DEFAULT '[]',
    web_url TEXT NOT NULL DEFAULT '',
    body_preview TEXT NOT NULL DEFAULT '',
    association_confidence REAL NOT NULL DEFAULT 0,
    association_reason TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, source_system, external_id)
  );

  CREATE TABLE IF NOT EXISTS project_email_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    source_system TEXT NOT NULL DEFAULT 'microsoft',
    external_id TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL DEFAULT '',
    received_datetime TEXT NOT NULL DEFAULT '',
    importance TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
    body_preview TEXT NOT NULL DEFAULT '',
    web_url TEXT NOT NULL DEFAULT '',
    association_confidence REAL NOT NULL DEFAULT 0,
    association_reason TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, source_system, external_id)
  );

  CREATE VIEW IF NOT EXISTS project_emails AS
    SELECT * FROM project_email_signals;

  CREATE TABLE IF NOT EXISTS project_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, email)
  );

  CREATE TABLE IF NOT EXISTS project_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planned',
    source_type TEXT NOT NULL DEFAULT 'manual',
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_health_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('green', 'amber', 'red')),
    risk_level TEXT NOT NULL DEFAULT 'low',
    action_status TEXT NOT NULL DEFAULT 'clear',
    document_completeness TEXT NOT NULL DEFAULT 'unknown',
    recent_activity TEXT NOT NULL DEFAULT 'unknown',
    client_responsiveness TEXT NOT NULL DEFAULT 'unknown',
    financial_risk TEXT NOT NULL DEFAULT 'unknown',
    explanation TEXT NOT NULL DEFAULT '',
    inputs TEXT NOT NULL DEFAULT '{}',
    calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_memory_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    semantic_memory_id INTEGER REFERENCES semantic_memory(id),
    relevance_score REAL NOT NULL DEFAULT 0,
    summary TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, source_type, source_id)
  );

  CREATE TABLE IF NOT EXISTS digital_construction_domains (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sarah_future_scope TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    domain_id TEXT NOT NULL REFERENCES digital_construction_domains(id),
    tag TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'confirmed' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    source_type TEXT NOT NULL DEFAULT 'seed',
    source_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, domain_id, tag)
  );

  CREATE TABLE IF NOT EXISTS project_knowledge_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER NOT NULL REFERENCES project_profiles(id) ON DELETE CASCADE,
    from_type TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_type TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relationship TEXT NOT NULL,
    confidence TEXT NOT NULL DEFAULT 'inferred' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    explanation TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'alfred_project_intelligence',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_profile_id, from_type, from_id, to_type, to_id, relationship)
  );

  CREATE TABLE IF NOT EXISTS cobie_facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_attributes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cobie_validation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    result TEXT NOT NULL DEFAULT 'not_run',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_coordinates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    coordinate_reference_system TEXT NOT NULL DEFAULT '',
    latitude REAL,
    longitude REAL,
    easting REAL,
    northing REAL,
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_spatial_datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gis_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_systems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS digital_twin_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'placeholder',
    source_id TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'Alfred',
    source TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS project_profiles_company
  ON project_profiles(company_id, client_name, project_name);

  CREATE INDEX IF NOT EXISTS project_documents_profile
  ON project_documents(project_profile_id, classification, modified_datetime);

  CREATE INDEX IF NOT EXISTS project_actions_profile
  ON project_actions(project_profile_id, status, due);

  CREATE INDEX IF NOT EXISTS project_risks_profile
  ON project_risks(project_profile_id, status, severity);

  CREATE INDEX IF NOT EXISTS project_meetings_profile
  ON project_meetings(project_profile_id, start_datetime);

  CREATE INDEX IF NOT EXISTS project_email_signals_profile
  ON project_email_signals(project_profile_id, received_datetime);

  CREATE INDEX IF NOT EXISTS project_tags_profile
  ON project_tags(project_profile_id, domain_id);

  CREATE INDEX IF NOT EXISTS project_knowledge_links_profile
  ON project_knowledge_links(project_profile_id, relationship, to_type);

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

  CREATE TABLE IF NOT EXISTS sarah_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    user_action TEXT NOT NULL DEFAULT '',
    project_profile_id INTEGER REFERENCES project_profiles(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL DEFAULT '',
    data_categories TEXT NOT NULL DEFAULT '[]',
    output_saved INTEGER NOT NULL DEFAULT 0 CHECK(output_saved IN (0, 1)),
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('success', 'error')),
    error_code TEXT NOT NULL DEFAULT '',
    execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK(execution_attempted IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sarah_team_placeholders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    expertise TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Placeholder',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created', 'listening', 'thinking', 'speaking', 'completed', 'error')),
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voice_conversation_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES voice_sessions(id) ON DELETE SET NULL,
    speaker TEXT NOT NULL DEFAULT 'Patrick',
    transcript TEXT NOT NULL DEFAULT '',
    detected_intent TEXT NOT NULL DEFAULT 'unknown',
    response TEXT NOT NULL DEFAULT '',
    linked_project TEXT NOT NULL DEFAULT '',
    linked_client TEXT NOT NULL DEFAULT '',
    linked_business TEXT NOT NULL DEFAULT '',
    linked_agent TEXT NOT NULL DEFAULT '',
    audit_reference TEXT NOT NULL DEFAULT '',
    transcript_logged INTEGER NOT NULL DEFAULT 1 CHECK(transcript_logged IN (0, 1)),
    source_references TEXT NOT NULL DEFAULT '[]',
    specialist_contributions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voice_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    user_action TEXT NOT NULL DEFAULT '',
    session_id INTEGER REFERENCES voice_sessions(id) ON DELETE SET NULL,
    data_categories TEXT NOT NULL DEFAULT '[]',
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('success', 'error')),
    error_code TEXT NOT NULL DEFAULT '',
    output_saved INTEGER NOT NULL DEFAULT 0 CHECK(output_saved IN (0, 1)),
    execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK(execution_attempted IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  CREATE TABLE IF NOT EXISTS property_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'westbridge-property-group' REFERENCES financial_business_entities(id),
    company_id TEXT NOT NULL DEFAULT 'westbridge' REFERENCES companies(id),
    address TEXT NOT NULL,
    asset_type TEXT NOT NULL DEFAULT 'Unknown',
    tenure TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Held',
    purchase_price REAL NOT NULL DEFAULT 0,
    current_value REAL NOT NULL DEFAULT 0,
    outstanding_debt REAL NOT NULL DEFAULT 0,
    monthly_rent REAL NOT NULL DEFAULT 0,
    monthly_costs REAL NOT NULL DEFAULT 0,
    net_monthly_cashflow REAL NOT NULL DEFAULT 0,
    acquired_at TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_entity_id TEXT NOT NULL DEFAULT 'westbridge-property-group' REFERENCES financial_business_entities(id),
    company_id TEXT NOT NULL DEFAULT 'westbridge' REFERENCES companies(id),
    title TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL DEFAULT 'manual',
    source_url TEXT NOT NULL DEFAULT '',
    source_metadata TEXT NOT NULL DEFAULT '{}',
    stage TEXT NOT NULL DEFAULT 'Lead',
    asset_type TEXT NOT NULL DEFAULT 'Unknown',
    tenure TEXT NOT NULL DEFAULT '',
    purchase_price REAL NOT NULL DEFAULT 0,
    rent_monthly REAL NOT NULL DEFAULT 0,
    refurb_cost REAL NOT NULL DEFAULT 0,
    management_cost_monthly REAL NOT NULL DEFAULT 0,
    other_costs REAL NOT NULL DEFAULT 0,
    committed_capital REAL NOT NULL DEFAULT 0,
    forecast_net_monthly_cashflow REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS property_opportunities_stage
  ON property_opportunities(stage, updated_at);

  CREATE TABLE IF NOT EXISTS property_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL DEFAULT 'metadata_placeholder',
    name TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    metadata TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'metadata_only',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_deal_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL REFERENCES property_opportunities(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL DEFAULT 'deal_analysis',
    inputs TEXT NOT NULL DEFAULT '{}',
    assumptions TEXT NOT NULL DEFAULT '[]',
    results TEXT NOT NULL DEFAULT '{}',
    rules TEXT NOT NULL DEFAULT '[]',
    recommendation TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT 'Westbridge Property Director',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS property_deal_analyses_opportunity
  ON property_deal_analyses(opportunity_id, created_at);

  CREATE TABLE IF NOT EXISTS property_due_diligence_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL REFERENCES property_opportunities(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Amber' CHECK(status IN ('Green', 'Amber', 'Red')),
    detail TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(opportunity_id, category)
  );

  CREATE TABLE IF NOT EXISTS property_risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'open',
    source_ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    decision_required_by TEXT NOT NULL DEFAULT 'Patrick King',
    source_ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_valuations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE CASCADE,
    asset_id INTEGER REFERENCES property_assets(id) ON DELETE CASCADE,
    valuation_type TEXT NOT NULL DEFAULT 'desktop',
    amount_gbp REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT '',
    confidence TEXT NOT NULL DEFAULT 'assumption' CHECK(confidence IN ('confirmed', 'inferred', 'assumption')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_refinance_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE CASCADE,
    asset_id INTEGER REFERENCES property_assets(id) ON DELETE CASCADE,
    refinance_value_gbp REAL NOT NULL DEFAULT 0,
    loan_to_value REAL NOT NULL DEFAULT 0.75,
    expected_debt_gbp REAL NOT NULL DEFAULT 0,
    cash_released_gbp REAL NOT NULL DEFAULT 0,
    cash_left_in_deal_gbp REAL NOT NULL DEFAULT 0,
    assumptions TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS property_memory_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    semantic_memory_id INTEGER REFERENCES semantic_memory(id),
    summary TEXT NOT NULL DEFAULT '',
    sensitivity_category TEXT NOT NULL DEFAULT 'local_sensitive_business_data',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(opportunity_id, source_type, source_id)
  );

  CREATE TABLE IF NOT EXISTS property_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'Westbridge Property Director',
    user_action TEXT NOT NULL DEFAULT '',
    opportunity_id INTEGER REFERENCES property_opportunities(id) ON DELETE SET NULL,
    data_categories TEXT NOT NULL DEFAULT '[]',
    execution_attempted INTEGER NOT NULL DEFAULT 0 CHECK(execution_attempted IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

const COMPANY_SEEDS = [
  ["digitize", "Digitize Consultants", "Digitize", "DC", "#62ead5", "Digital construction and information consultancy", "Operating", ["BIM", "ISO 19650", "Information Management", "GIS", "Digital Twin", "Power Platform", "AI Solutions"]],
  ["westbridge", "Westbridge Property Group", "Westbridge", "WP", "#d7b56d", "Acquire and manage cashflow-producing property assets targeting £10,000-£15,000 net monthly income within five years.", "Building", ["Property Investment", "Portfolio Management", "Acquisition Analysis", "Due Diligence"]],
  ["product", "Product Studio", "Product", "PS", "#7fa9e2", "Create scalable SaaS businesses", "Building", ["Council Construction Assurance Platform"]],
  ["venture", "AI Venture Studio", "Venture", "AV", "#b18ae2", "Build recurring-income online businesses", "Discovery", ["Target: £5,000+ monthly profit"]],
  ["media", "Media Studio", "Media", "MS", "#e2b46b", "Build automated YouTube and content businesses", "Discovery", ["Target: £5,000+ monthly income"]],
];

const FINANCIAL_BUSINESS_ENTITY_SEEDS = [
  ["group", "Patrick King Group", "group", null, null, "active", "Consolidated reporting scope for all Alfred-managed businesses."],
  ["digitize", "Digitize Consultants", "business", "group", "digitize", "active", "Digital construction consultancy and current order book source."],
  ["westbridge-property-group", "Westbridge Property Group", "business", "group", "westbridge", "active", "Property investment business targeting £10,000-£15,000 net monthly income over five years."],
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

const PROJECT_PROFILE_SEEDS = [
  {
    companyId: "digitize",
    clientName: "KSPF",
    projectName: "KSPF",
    status: "Active",
    serviceLine: "Information Management",
    currentPhase: "Delivery",
    summary: "Digitize project profile for KSPF. Confirm live scope, commercial position, document set and outstanding actions from Microsoft 365 metadata.",
    financialBusinessEntityId: "digitize",
  },
  {
    companyId: "digitize",
    clientName: "Westminster City Council",
    projectName: "Westminster",
    status: "Active",
    serviceLine: "Digital Construction Assurance",
    currentPhase: "Delivery Review",
    summary: "Digitize project profile for Westminster. Track delivery review, key risks, client agreements, documents and outstanding chairman-level actions.",
    financialBusinessEntityId: "digitize",
  },
  {
    companyId: "digitize",
    clientName: "RBKC",
    projectName: "RBKC",
    status: "Active",
    serviceLine: "COBie / Information Management",
    currentPhase: "Delivery",
    summary: "Digitize project profile for RBKC. Track COBie, information management and assurance risks using confirmed project records and inferred Microsoft 365 signals.",
    financialBusinessEntityId: "digitize",
  },
  {
    companyId: "digitize",
    clientName: "Islington Council",
    projectName: "Islington",
    status: "Active",
    serviceLine: "Information Management",
    currentPhase: "Delivery",
    summary: "Digitize project profile for Islington. Track outstanding actions, recent meetings, project documents and missing information.",
    financialBusinessEntityId: "digitize",
  },
  {
    companyId: "product",
    clientName: "",
    projectName: "Council Construction Assurance Platform",
    status: "Discovery",
    serviceLine: "SaaS Product",
    currentPhase: "MVP Definition",
    summary: "Product Studio project profile for the Council Construction Assurance Platform SaaS concept.",
    financialBusinessEntityId: "council-assurance-platform",
  },
];

const DIGITAL_CONSTRUCTION_DOMAIN_SEEDS = [
  ["BIM", "BIM", "Building information modelling delivery, coordination and model-based information management.", "Sarah will later review BIM risks, model coordination signals and delivery exceptions."],
  ["GIS", "GIS", "Geospatial project information, layers, spatial datasets and location-based asset context.", "Sarah will later review GIS issues, spatial data quality and GIS opportunities."],
  ["COBie", "COBie", "Construction Operations Building information exchange data, registers and validation readiness.", "Sarah will later review COBie gaps, validation results and handover readiness."],
  ["ISO19650", "ISO 19650", "Information management process, appointments, BEPs, EIRs, MIDPs, TIDPs and CDE discipline.", "Sarah will later review ISO 19650 compliance and information management risks."],
  ["AssetInformation", "Asset Information", "Asset information requirements, asset data, maintainable asset registers and handover metadata.", "Sarah will later review asset information quality and missing requirements."],
  ["DigitalTwin", "Digital Twin", "Digital twin strategy, models, connected systems, sensors and operational twin records.", "Sarah will later review digital twin opportunities and twin readiness."],
  ["BuildingSafety", "Building Safety", "Building safety information, golden thread, risk records and public-sector assurance context.", "Sarah will later review building safety information completeness and exceptions."],
  ["InformationManagement", "Information Management", "Project information strategy, governance, records, data quality and delivery controls.", "Sarah will later review information management performance and missing records."],
  ["PowerPlatform", "Power Platform", "Power Platform solutions, apps, automations, reporting and low-code delivery context.", "Sarah will later review Power Platform opportunities and delivery risks."],
];

const PROJECT_TAG_SEEDS = [
  ["KSPF", "InformationManagement", "Information Management", "confirmed"],
  ["KSPF", "ISO19650", "ISO 19650", "inferred"],
  ["Westminster", "BIM", "BIM", "inferred"],
  ["Westminster", "ISO19650", "ISO 19650", "inferred"],
  ["Westminster", "BuildingSafety", "Building Safety", "inferred"],
  ["Westminster", "InformationManagement", "Information Management", "confirmed"],
  ["RBKC", "COBie", "COBie", "confirmed"],
  ["RBKC", "AssetInformation", "Asset Information", "inferred"],
  ["RBKC", "InformationManagement", "Information Management", "confirmed"],
  ["Islington", "InformationManagement", "Information Management", "confirmed"],
  ["Islington", "BIM", "BIM", "inferred"],
  ["Council Construction Assurance Platform", "PowerPlatform", "Power Platform", "inferred"],
  ["Council Construction Assurance Platform", "BuildingSafety", "Building Safety", "inferred"],
  ["Council Construction Assurance Platform", "DigitalTwin", "Digital Twin", "assumption"],
  ["Council Construction Assurance Platform", "InformationManagement", "Information Management", "confirmed"],
];

const AGENT_SEEDS = [
  ["alfred", "Alfred", "AI Chief of Staff / Operating Partner", null, "Executive Operations", "Protect Patrick's time, coordinate the executive team and keep recommendations factual, sourced and approval-led. Advisory only; no autonomous execution.", ["Executive Briefings", "Prioritisation", "Risk Review", "Decision Support"], "Active"],
  ["olivia", "Olivia", "Chief Financial Officer", null, "Finance", "Act as Group CFO across Alfred-managed businesses, producing read-only revenue, forecast, debtor, cashflow, KPI and board-reporting intelligence.", ["Forecasting", "Order Book", "Debtors", "Board Reporting"], "Active"],
  ["sarah", "Sarah", "Digital Construction Director", "digitize", "Delivery", "Executive Specialist reporting to Alfred. Provides advisory-only BIM, GIS, ISO 19650, COBie, Asset Information, Digital Twin, Building Safety, Information Management and Power Platform intelligence for Digitize. No autonomous execution.", ["BIM", "GIS", "ISO 19650", "COBie", "Asset Information", "Digital Twin", "Building Safety", "Information Management", "Power Platform"], "Active"],
  ["westbridge-property-director", "Westbridge Property Director", "AI Investment Director", "westbridge", "Property Investment", "Board-level investment director for Westbridge Property Group. Analyses acquisition pipeline, portfolio cashflow, due diligence, refinance potential and investment risks. Advisory only; no purchases, offers, legal instructions, communications or external execution.", ["Portfolio Metrics", "Deal Analysis", "Westbridge Rules", "Due Diligence", "Refinance Scenarios", "Property Memory"], "Active"],
  ["maya", "Maya", "Media Director", "media", "Media", "Build content businesses with repeatable production and monetisation systems.", [], "Planned"],
  ["alex", "Alex", "Growth Director", null, "Growth", "Find and qualify revenue opportunities across the group.", [], "Planned"],
  ["ethan", "Ethan", "Chief Technology Officer", null, "Technology", "Future placeholder for platform architecture, engineering quality, cloud operations and technical risk.", [], "Planned"],
  ["liam", "Liam", "Power Platform Director", "digitize", "Power Platform", "Future placeholder for Power Platform advisory, app strategy and low-code delivery intelligence.", [], "Planned"],
  ["james", "James", "Product CEO", "product", "Product", "Validate, build and operate scalable SaaS products.", [], "Planned"],
];

const SARAH_TEAM_PLACEHOLDER_SEEDS = [
  ["bim-consultant", "BIM Consultant", "BIM Consultant", ["BIM Strategy", "BIM Execution Plans", "BIM Delivery", "BIM Governance"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["information-manager", "Information Manager", "Information Manager", ["ISO 19650", "CDE", "Information Delivery", "Information Requirements"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["cobie-specialist", "COBie Specialist", "COBie Specialist", ["COBie Structure", "COBie Quality", "Asset Information", "Information Completeness"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["gis-consultant", "GIS Consultant", "GIS Consultant", ["GIS Strategy", "Spatial Information", "Asset Mapping", "Geospatial Data"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["digital-twin-consultant", "Digital Twin Consultant", "Digital Twin Consultant", ["Digital Twin Strategy", "Operational Data", "Asset Performance", "Smart Asset Management"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["building-safety-consultant", "Building Safety Consultant", "Building Safety Consultant", ["Golden Thread", "Building Safety Act", "Information Assurance", "Compliance Information"], "Future placeholder only. No runtime or autonomous behaviour."],
  ["power-platform-consultant", "Power Platform Consultant", "Power Platform Consultant", ["Power Apps", "Dataverse", "Power Automate", "Power BI", "SharePoint"], "Future placeholder only. No runtime or autonomous behaviour."],
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
  migrateProjectIntelligenceSchema(db);
  migratePropertySchema(db);
  seedDatabase(db);
  return db;
}

function ensureDefaultSettings(db) {
  const semanticDefault = String(process.env.SEMANTIC_INDEXING_ENABLED || "true").toLowerCase() === "false"
    ? "false"
    : "true";
  const voiceDefault = String(process.env.VOICE_ENABLED || "true").toLowerCase() === "false"
    ? "false"
    : "true";
  const transcriptLoggingDefault = String(process.env.VOICE_TRANSCRIPT_LOGGING_ENABLED || "true").toLowerCase() === "false"
    ? "false"
    : "true";
  const transcriptRetentionDays = Math.min(
    Math.max(Number(process.env.VOICE_TRANSCRIPT_RETENTION_DAYS) || 30, 1),
    3650,
  );
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('semantic_indexing_enabled', ?)
  `).run(semanticDefault);
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('voice_enabled', ?)
  `).run(voiceDefault);
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('voice_transcript_logging_enabled', ?)
  `).run(transcriptLoggingDefault);
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('voice_selection', ?)
  `).run(process.env.ELEVENLABS_VOICE_ID || "alfred");
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('voice_speech_speed', '1')
  `).run();
  db.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('voice_transcript_retention_days', ?)
  `).run(String(transcriptRetentionDays));
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

function migrateProjectIntelligenceSchema(db) {
  const columnsFor = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  const addColumn = (table, definition) => {
    const name = definition.trim().split(/\s+/)[0];
    if (!columnsFor(table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };

  addColumn("project_documents", "owner_name TEXT NOT NULL DEFAULT ''");
  addColumn("project_documents", "location TEXT NOT NULL DEFAULT ''");
  db.exec("CREATE VIEW IF NOT EXISTS project_emails AS SELECT * FROM project_email_signals");
}

function migratePropertySchema(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS property_opportunities_stage
    ON property_opportunities(stage, updated_at);

    CREATE INDEX IF NOT EXISTS property_deal_analyses_opportunity
    ON property_deal_analyses(opportunity_id, created_at);
  `);
}

export function seedDatabase(db) {
  const companyCount = db.prepare("SELECT COUNT(*) AS count FROM companies").get().count;
  if (companyCount > 0) {
    updateCompanyDefinitions(db);
    updateFinancialBusinessEntities(db);
    updateProjectProfiles(db);
    updateDigitalConstructionDomains(db);
    updateProjectTags(db);
    updateAgentDefinitions(db);
    updateSarahTeamPlaceholders(db);
    updateIntegrationDefinitions(db);
    updateWestbridgePropertySeeds(db);
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
    updateProjectProfiles(db);
    updateDigitalConstructionDomains(db);
    updateProjectTags(db);

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
    updateSarahTeamPlaceholders(db);

    const insertMemory = db.prepare(`
      INSERT INTO memories (type, title, detail, company_id, recorded_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertMemory.run("decision", "Alfred operating principle", "Build the operating system before specialist agents. Patrick remains the final decision maker.", null, "2026-06-05");
    insertMemory.run("client", "Westminster City Council", "Registered as an active Digitize Consultants client. Delivery context requires connection to live project systems.", "digitize", "2026-06-05");
    insertMemory.run("idea", "Council Construction Assurance Platform", "Initial Product Studio SaaS concept focused on council construction assurance.", "product", "2026-06-05");

    updateIntegrationDefinitions(db);
    updateWestbridgePropertySeeds(db);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function updateCompanyDefinitions(db) {
  const insertCompany = db.prepare(`
    INSERT OR IGNORE INTO companies (id, name, short_name, symbol, color, purpose, status, services)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateCompany = db.prepare(`
    UPDATE companies
    SET name = ?, short_name = ?, symbol = ?, color = ?, purpose = ?,
        status = ?, services = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const company of COMPANY_SEEDS) {
    insertCompany.run(...company.slice(0, 7), JSON.stringify(company[7]));
    updateCompany.run(company[1], company[2], company[3], company[4], company[5], company[6], JSON.stringify(company[7]), company[0]);
  }
}

function updateAgentDefinitions(db) {
  const insertAgent = db.prepare(`
    INSERT OR IGNORE INTO agents (id, name, role, company_id, department, mission, tools, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateAgent = db.prepare(`
    UPDATE agents
    SET name = ?, role = ?, company_id = ?, department = ?, mission = ?, tools = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const agent of AGENT_SEEDS) {
    insertAgent.run(...agent.slice(0, 6), JSON.stringify(agent[6]), agent[7]);
    updateAgent.run(agent[1], agent[2], agent[3], agent[4], agent[5], JSON.stringify(agent[6]), agent[7], agent[0]);
  }
}

function updateSarahTeamPlaceholders(db) {
  const insertPlaceholder = db.prepare(`
    INSERT OR IGNORE INTO sarah_team_placeholders (id, name, role, expertise, notes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updatePlaceholder = db.prepare(`
    UPDATE sarah_team_placeholders
    SET name = ?, role = ?, expertise = ?, status = 'Placeholder',
        notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const placeholder of SARAH_TEAM_PLACEHOLDER_SEEDS) {
    insertPlaceholder.run(placeholder[0], placeholder[1], placeholder[2], JSON.stringify(placeholder[3]), placeholder[4]);
    updatePlaceholder.run(placeholder[1], placeholder[2], JSON.stringify(placeholder[3]), placeholder[4], placeholder[0]);
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

function insertOperatingRecordIfMissing(db, table, companyId, title, detail, priority = "medium", due = "Next") {
  db.prepare(`
    INSERT INTO ${table} (company_id, title, detail, priority, due)
    SELECT ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM ${table}
      WHERE company_id = ? AND title = ?
    )
  `).run(companyId, title, detail, priority, due, companyId, title);
}

function updateWestbridgePropertySeeds(db) {
  insertOperatingRecordIfMissing(
    db,
    "opportunities",
    "westbridge",
    "Build Westbridge acquisition pipeline",
    "Create a disciplined property acquisition pipeline focused on long-term cashflow, no HMOs, acquisition costs, management costs, refinance potential and capital preservation.",
    "high",
    "This quarter",
  );
  insertOperatingRecordIfMissing(
    db,
    "risks",
    "westbridge",
    "Property investment execution boundary",
    "All Westbridge recommendations require Patrick review and professional legal, tax, lending and survey due diligence. Alfred cannot make offers, purchases, legal instructions or external communications.",
    "high",
    "Always",
  );
  insertOperatingRecordIfMissing(
    db,
    "decisions",
    "westbridge",
    "Confirm first Westbridge acquisition criteria",
    "Approve the first written investment criteria before reviewing live property opportunities: asset types, locations, minimum cashflow, maximum leverage, capital allocation and due diligence rules.",
    "high",
    "Before first offer",
  );

  db.prepare(`
    INSERT INTO memories (type, title, detail, company_id, recorded_at)
    SELECT 'strategy', 'Westbridge Property Group target',
      'Westbridge Property Group is a property investment business owned by Patrick King. The objective is to build a cashflow-producing portfolio generating £10,000-£15,000 net monthly income within five years. Advisory only; no external execution is permitted.',
      'westbridge', '2026-06-06'
    WHERE NOT EXISTS (
      SELECT 1 FROM memories
      WHERE company_id = 'westbridge' AND title = 'Westbridge Property Group target'
    )
  `).run();

  db.prepare(`
    INSERT INTO property_opportunities (
      business_entity_id, company_id, title, address, source_type, stage,
      asset_type, tenure, notes
    )
    SELECT 'westbridge-property-group', 'westbridge', 'Garage block acquisition search', '',
      'manual', 'Lead', 'Garage block', '',
      'Pipeline placeholder only. No live property has been sourced; use this record to capture garage block opportunities when real references are available.'
    WHERE NOT EXISTS (
      SELECT 1 FROM property_opportunities
      WHERE company_id = 'westbridge' AND title = 'Garage block acquisition search'
    )
  `).run();
  const opportunity = db.prepare(`
    SELECT id FROM property_opportunities
    WHERE company_id = 'westbridge' AND title = 'Garage block acquisition search'
  `).get();
  if (opportunity) {
    const insertDueDiligence = db.prepare(`
      INSERT OR IGNORE INTO property_due_diligence_items (
        opportunity_id, category, status, detail
      )
      VALUES (?, ?, 'Amber', 'Not reviewed yet.')
    `);
    for (const category of [
      "Legal Review",
      "Planning Review",
      "Flood Risk",
      "EPC",
      "Insurance",
      "Survey",
      "Finance",
      "Tenancy Review",
      "Environmental Review",
    ]) {
      insertDueDiligence.run(opportunity.id, category);
    }
    db.prepare(`
      INSERT OR IGNORE INTO property_memory_links (
        opportunity_id, source_type, source_id, summary, sensitivity_category
      )
      VALUES (?, 'property_opportunity', ?, 'Garage block acquisition search is a placeholder pipeline record for Westbridge. No property has been sourced or analysed yet.', 'local_sensitive_business_data')
    `).run(opportunity.id, String(opportunity.id));
  }

  db.prepare(`
    INSERT INTO property_risks (opportunity_id, title, detail, severity, source_ref)
    SELECT ?, 'No live deal evidence yet',
      'The current Westbridge pipeline contains a placeholder search record only. Do not treat it as a sourced investment opportunity.',
      'medium', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM property_risks
      WHERE title = 'No live deal evidence yet'
    )
  `).run(opportunity?.id || null, opportunity ? `property_opportunity:${opportunity.id}` : "");

  db.prepare(`
    INSERT INTO property_decisions (opportunity_id, title, detail, status, decision_required_by, source_ref)
    SELECT ?, 'Approve Westbridge investment criteria',
      'Patrick should approve written investment criteria before any offer-stage property opportunity is considered.',
      'open', 'Patrick King', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM property_decisions
      WHERE title = 'Approve Westbridge investment criteria'
    )
  `).run(opportunity?.id || null, opportunity ? `property_opportunity:${opportunity.id}` : "");
}

function updateProjectProfiles(db) {
  const findClient = db.prepare("SELECT id FROM clients WHERE company_id = ? AND lower(name) = lower(?)");
  const insertClient = db.prepare("INSERT INTO clients (company_id, name) VALUES (?, ?)");
  const findProject = db.prepare("SELECT id FROM projects WHERE company_id = ? AND lower(name) = lower(?)");
  const insertProject = db.prepare(`
    INSERT INTO projects (company_id, client_id, name, purpose, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertProfile = db.prepare(`
    INSERT OR IGNORE INTO project_profiles (
      project_id, company_id, client_id, client_name, project_name, status,
      service_line, current_phase, summary, financial_business_entity_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateProfile = db.prepare(`
    UPDATE project_profiles
    SET project_id = ?, client_id = ?, client_name = ?, status = ?,
        service_line = ?, current_phase = ?, summary = ?,
        financial_business_entity_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE company_id = ? AND client_name = ? AND project_name = ?
  `);

  for (const seed of PROJECT_PROFILE_SEEDS) {
    let clientId = null;
    if (seed.clientName) {
      let client = findClient.get(seed.companyId, seed.clientName);
      if (!client) {
        const result = insertClient.run(seed.companyId, seed.clientName);
        client = { id: Number(result.lastInsertRowid) };
      }
      clientId = client.id;
    }

    let project = findProject.get(seed.companyId, seed.projectName);
    if (!project) {
      const result = insertProject.run(seed.companyId, clientId, seed.projectName, seed.summary, seed.status);
      project = { id: Number(result.lastInsertRowid) };
    }

    insertProfile.run(
      project.id,
      seed.companyId,
      clientId,
      seed.clientName,
      seed.projectName,
      seed.status,
      seed.serviceLine,
      seed.currentPhase,
      seed.summary,
      seed.financialBusinessEntityId,
    );
    updateProfile.run(
      project.id,
      clientId,
      seed.clientName,
      seed.status,
      seed.serviceLine,
      seed.currentPhase,
      seed.summary,
      seed.financialBusinessEntityId,
      seed.companyId,
      seed.clientName,
      seed.projectName,
    );
  }
}

function updateDigitalConstructionDomains(db) {
  const insertDomain = db.prepare(`
    INSERT OR IGNORE INTO digital_construction_domains (id, label, description, sarah_future_scope)
    VALUES (?, ?, ?, ?)
  `);
  const updateDomain = db.prepare(`
    UPDATE digital_construction_domains
    SET label = ?, description = ?, sarah_future_scope = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  for (const domain of DIGITAL_CONSTRUCTION_DOMAIN_SEEDS) {
    insertDomain.run(...domain);
    updateDomain.run(domain[1], domain[2], domain[3], domain[0]);
  }
}

function updateProjectTags(db) {
  const findProfile = db.prepare("SELECT id FROM project_profiles WHERE project_name = ?");
  const insertTag = db.prepare(`
    INSERT OR IGNORE INTO project_tags (
      project_profile_id, domain_id, tag, confidence, source_type
    )
    VALUES (?, ?, ?, ?, 'seed')
  `);
  const updateTag = db.prepare(`
    UPDATE project_tags
    SET tag = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP
    WHERE project_profile_id = ? AND domain_id = ?
  `);
  for (const [projectName, domainId, tag, confidence] of PROJECT_TAG_SEEDS) {
    const profile = findProfile.get(projectName);
    if (!profile) continue;
    insertTag.run(profile.id, domainId, tag, confidence);
    updateTag.run(tag, confidence, profile.id, domainId);
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

function safeJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

export function getVoiceSettings(db) {
  return {
    enabled: getSetting(db, "voice_enabled", "false") === "true",
    transcriptLoggingEnabled: getSetting(db, "voice_transcript_logging_enabled", "true") === "true",
    voiceSelection: getSetting(db, "voice_selection", process.env.ELEVENLABS_VOICE_ID || "alfred"),
    speechSpeed: Number(getSetting(db, "voice_speech_speed", "1")) || 1,
    transcriptRetentionDays: Number(getSetting(db, "voice_transcript_retention_days", "30")) || 30,
  };
}

export function setVoiceSettings(db, settings = {}) {
  if (typeof settings.enabled === "boolean") setSetting(db, "voice_enabled", settings.enabled ? "true" : "false");
  if (typeof settings.transcriptLoggingEnabled === "boolean") {
    setSetting(db, "voice_transcript_logging_enabled", settings.transcriptLoggingEnabled ? "true" : "false");
  }
  if (settings.voiceSelection !== undefined) setSetting(db, "voice_selection", String(settings.voiceSelection || "alfred"));
  if (settings.speechSpeed !== undefined) {
    const speed = Math.min(Math.max(Number(settings.speechSpeed) || 1, 0.5), 1.5);
    setSetting(db, "voice_speech_speed", String(speed));
  }
  if (settings.transcriptRetentionDays !== undefined) {
    const days = Math.min(Math.max(Number(settings.transcriptRetentionDays) || 30, 1), 3650);
    setSetting(db, "voice_transcript_retention_days", String(days));
  }
  return getVoiceSettings(db);
}

export function createVoiceSession(db, { status = "created", metadata = {} } = {}) {
  const result = db.prepare(`
    INSERT INTO voice_sessions (status, metadata)
    VALUES (?, ?)
  `).run(status, JSON.stringify(metadata || {}));
  return getVoiceSession(db, Number(result.lastInsertRowid));
}

export function updateVoiceSession(db, id, { status, metadata, completed = false } = {}) {
  const current = getVoiceSession(db, id);
  if (!current) return null;
  db.prepare(`
    UPDATE voice_sessions
    SET status = ?, metadata = ?, completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status || current.status,
    JSON.stringify(metadata || current.metadata || {}),
    completed ? 1 : 0,
    id,
  );
  return getVoiceSession(db, id);
}

export function getVoiceSession(db, id) {
  const row = db.prepare("SELECT * FROM voice_sessions WHERE id = ?").get(Number(id));
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    startedAt: toIsoTimestamp(row.started_at),
    completedAt: toIsoTimestamp(row.completed_at),
    metadata: safeJson(row.metadata, {}),
  };
}

export function recordVoiceAudit(db, {
  eventType,
  userAction = "",
  sessionId = null,
  dataCategories = [],
  model = "",
  status = "success",
  errorCode = "",
  outputSaved = false,
  executionAttempted = false,
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO voice_audit_events (
      event_type, user_action, session_id, data_categories, model, status,
      error_code, output_saved, execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(eventType || "voice_command"),
    String(userAction || ""),
    sessionId,
    JSON.stringify(dataCategories || []),
    String(model || ""),
    String(status || "success"),
    String(errorCode || "").slice(0, 200),
    outputSaved ? 1 : 0,
    executionAttempted ? 1 : 0,
    JSON.stringify(metadata || {}),
  );
  return getVoiceAuditEvent(db, Number(result.lastInsertRowid));
}

export function getVoiceAuditEvent(db, id) {
  const row = db.prepare("SELECT * FROM voice_audit_events WHERE id = ?").get(Number(id));
  if (!row) return null;
  return {
    id: row.id,
    requestedAt: toIsoTimestamp(row.requested_at),
    eventType: row.event_type,
    userAction: row.user_action,
    sessionId: row.session_id,
    dataCategories: safeJson(row.data_categories, []),
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    metadata: safeJson(row.metadata, {}),
  };
}

export function listVoiceAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM voice_audit_events
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    id: row.id,
    requestedAt: toIsoTimestamp(row.requested_at),
    eventType: row.event_type,
    userAction: row.user_action,
    sessionId: row.session_id,
    dataCategories: safeJson(row.data_categories, []),
    model: row.model,
    status: row.status,
    errorCode: row.error_code,
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    metadata: safeJson(row.metadata, {}),
  }));
}

export function recordVoiceConversationTurn(db, {
  sessionId = null,
  speaker = "Patrick",
  transcript = "",
  detectedIntent = "unknown",
  response = "",
  linkedProject = "",
  linkedClient = "",
  linkedBusiness = "",
  linkedAgent = "",
  auditReference = "",
  transcriptLogged = true,
  sourceReferences = [],
  specialistContributions = [],
} = {}) {
  const result = db.prepare(`
    INSERT INTO voice_conversation_turns (
      session_id, speaker, transcript, detected_intent, response, linked_project,
      linked_client, linked_business, linked_agent, audit_reference, transcript_logged,
      source_references, specialist_contributions
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    String(speaker || "Patrick"),
    transcriptLogged ? String(transcript || "") : "",
    String(detectedIntent || "unknown"),
    String(response || ""),
    String(linkedProject || ""),
    String(linkedClient || ""),
    String(linkedBusiness || ""),
    String(linkedAgent || ""),
    String(auditReference || ""),
    transcriptLogged ? 1 : 0,
    JSON.stringify(sourceReferences || []),
    JSON.stringify(specialistContributions || []),
  );
  return getVoiceConversationTurn(db, Number(result.lastInsertRowid));
}

export function getVoiceConversationTurn(db, id) {
  const row = db.prepare("SELECT * FROM voice_conversation_turns WHERE id = ?").get(Number(id));
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    speaker: row.speaker,
    transcript: row.transcript,
    detectedIntent: row.detected_intent,
    response: row.response,
    linkedProject: row.linked_project,
    linkedClient: row.linked_client,
    linkedBusiness: row.linked_business,
    linkedAgent: row.linked_agent,
    auditReference: row.audit_reference,
    transcriptLogged: Boolean(row.transcript_logged),
    sourceReferences: safeJson(row.source_references, []),
    specialistContributions: safeJson(row.specialist_contributions, []),
    createdAt: toIsoTimestamp(row.created_at),
  };
}

export function listVoiceConversationTurns(db, limit = 20) {
  return db.prepare(`
    SELECT *
    FROM voice_conversation_turns
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 20, 1), 100)).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    speaker: row.speaker,
    transcript: row.transcript,
    detectedIntent: row.detected_intent,
    response: row.response,
    linkedProject: row.linked_project,
    linkedClient: row.linked_client,
    linkedBusiness: row.linked_business,
    linkedAgent: row.linked_agent,
    auditReference: row.audit_reference,
    transcriptLogged: Boolean(row.transcript_logged),
    sourceReferences: safeJson(row.source_references, []),
    specialistContributions: safeJson(row.specialist_contributions, []),
    createdAt: toIsoTimestamp(row.created_at),
  }));
}

export function purgeVoiceConversationTurns(db, { olderThanDays = 30 } = {}) {
  const days = Math.min(Math.max(Number(olderThanDays) || 30, 1), 3650);
  const result = db.prepare(`
    DELETE FROM voice_conversation_turns
    WHERE datetime(created_at) < datetime('now', ?)
  `).run(`-${days} days`);
  return {
    deletedCount: result.changes,
    olderThanDays: days,
  };
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

  const projectRows = db.prepare(`
    SELECT
      p.*,
      c.short_name AS company_short_name,
      c.name AS company_name,
      (SELECT COUNT(*) FROM project_documents d WHERE d.project_profile_id = p.id) AS document_count,
      (SELECT COUNT(*) FROM project_actions a WHERE a.project_profile_id = p.id AND a.status != 'complete') AS open_action_count,
      (SELECT COUNT(*) FROM project_risks r WHERE r.project_profile_id = p.id AND r.status != 'closed') AS open_risk_count,
      (SELECT MAX(created_at) FROM project_updates u WHERE u.project_profile_id = p.id) AS latest_update_at,
      (
        SELECT group_concat(d.label, ', ')
        FROM project_tags t
        JOIN digital_construction_domains d ON d.id = t.domain_id
        WHERE t.project_profile_id = p.id
      ) AS digital_domains
    FROM project_profiles p
    LEFT JOIN companies c ON c.id = p.company_id
    ORDER BY p.updated_at DESC, p.id DESC
  `).all();
  for (const row of projectRows) {
    records.push(semanticRecord({
      sourceType: "project_profile",
      sourceId: row.id,
      sourceCreatedAt: row.updated_at,
      title: row.project_name,
      summary: [
        `Project profile: ${row.project_name}.`,
        row.client_name ? `Client: ${row.client_name}.` : "",
        `Company: ${companyLabel(row)}.`,
        `Status: ${row.status}.`,
        `Service line: ${row.service_line}.`,
        `Phase: ${row.current_phase}.`,
        row.digital_domains ? `Digital construction domains: ${row.digital_domains}.` : "",
        row.summary,
        `Documents linked: ${row.document_count || 0}.`,
        `Open project actions: ${row.open_action_count || 0}.`,
        `Open project risks: ${row.open_risk_count || 0}.`,
        row.latest_update_at ? `Latest project update: ${row.latest_update_at}.` : "",
      ].filter(Boolean).join(" "),
    }));
  }

  const projectDocuments = db.prepare(`
    SELECT d.*, p.project_name, p.client_name
    FROM project_documents d
    JOIN project_profiles p ON p.id = d.project_profile_id
    ORDER BY d.modified_datetime DESC, d.updated_at DESC, d.id DESC
    LIMIT 300
  `).all();
  for (const row of projectDocuments) {
    records.push(semanticRecord({
      sourceType: "project_document",
      sourceId: row.id,
      sourceCreatedAt: row.modified_datetime || row.updated_at,
      title: row.name,
      summary: [
        `Project document metadata: ${row.name}.`,
        `Project: ${row.project_name}.`,
        row.client_name ? `Client: ${row.client_name}.` : "",
        `Classification: ${row.classification}.`,
        row.owner_name ? `Owner: ${row.owner_name}.` : "",
        row.location ? `Location: ${row.location}.` : "",
        row.path ? `Path: ${row.path}.` : "",
        row.modified_datetime ? `Modified: ${row.modified_datetime}.` : "",
        `Association: ${row.association_reason || "metadata match"}.`,
        "Full document content was not indexed.",
      ].filter(Boolean).join(" "),
    }));
  }

  const projectEmailSignals = db.prepare(`
    SELECT e.*, p.project_name, p.client_name
    FROM project_email_signals e
    JOIN project_profiles p ON p.id = e.project_profile_id
    ORDER BY e.received_datetime DESC, e.id DESC
    LIMIT 200
  `).all();
  for (const row of projectEmailSignals) {
    records.push(semanticRecord({
      sourceType: "project_email_signal",
      sourceId: row.id,
      sourceCreatedAt: row.received_datetime || row.created_at,
      title: row.subject || "(No subject)",
      summary: [
        `Project email signal metadata: ${row.subject || "(No subject)"}.`,
        `Project: ${row.project_name}.`,
        row.client_name ? `Client: ${row.client_name}.` : "",
        row.from_name || row.from_email ? `From: ${row.from_name || row.from_email}.` : "",
        row.body_preview,
        `Association: ${row.association_reason || "metadata match"}.`,
        "Raw full email content was not indexed.",
      ].filter(Boolean).join(" "),
    }));
  }

  const projectMeetings = db.prepare(`
    SELECT m.*, p.project_name, p.client_name
    FROM project_meetings m
    JOIN project_profiles p ON p.id = m.project_profile_id
    ORDER BY m.start_datetime DESC, m.id DESC
    LIMIT 200
  `).all();
  for (const row of projectMeetings) {
    records.push(semanticRecord({
      sourceType: "project_meeting",
      sourceId: row.id,
      sourceCreatedAt: row.start_datetime || row.created_at,
      title: row.title || "(Untitled meeting)",
      summary: [
        `Project meeting metadata: ${row.title || "(Untitled meeting)"}.`,
        `Project: ${row.project_name}.`,
        row.client_name ? `Client: ${row.client_name}.` : "",
        row.organizer ? `Organizer: ${row.organizer}.` : "",
        row.body_preview,
        `Association: ${row.association_reason || "metadata match"}.`,
      ].filter(Boolean).join(" "),
    }));
  }

  const projectTags = db.prepare(`
    SELECT t.*, d.label AS domain_label, d.description, p.project_name, p.client_name
    FROM project_tags t
    JOIN digital_construction_domains d ON d.id = t.domain_id
    JOIN project_profiles p ON p.id = t.project_profile_id
    ORDER BY t.updated_at DESC, t.id DESC
    LIMIT 300
  `).all();
  for (const row of projectTags) {
    records.push(semanticRecord({
      sourceType: "project_tag",
      sourceId: row.id,
      sourceCreatedAt: row.updated_at || row.created_at,
      title: `${row.project_name} ${row.domain_label}`,
      summary: [
        `Project digital construction tag: ${row.domain_label}.`,
        `Project: ${row.project_name}.`,
        row.client_name ? `Client: ${row.client_name}.` : "",
        `Tag: ${row.tag}.`,
        `Confidence: ${row.confidence}.`,
        row.description,
      ].filter(Boolean).join(" "),
    }));
  }

  const propertyOpportunities = db.prepare(`
    SELECT o.*, c.short_name AS company_short_name, c.name AS company_name
    FROM property_opportunities o
    LEFT JOIN companies c ON c.id = o.company_id
    ORDER BY o.updated_at DESC, o.id DESC
    LIMIT 300
  `).all();
  for (const row of propertyOpportunities) {
    records.push(semanticRecord({
      sourceType: "property_opportunity",
      sourceId: row.id,
      sourceCreatedAt: row.updated_at || row.created_at,
      title: row.title,
      summary: [
        `Westbridge property opportunity: ${row.title}.`,
        `Company: ${companyLabel(row)}.`,
        `Stage: ${row.stage}.`,
        row.address ? `Address: ${row.address}.` : "",
        `Asset type: ${row.asset_type || "Unknown"}.`,
        row.tenure ? `Tenure: ${row.tenure}.` : "",
        `Purchase price: £${row.purchase_price || 0}.`,
        `Monthly rent: £${row.rent_monthly || 0}.`,
        `Forecast net monthly cashflow: £${row.forecast_net_monthly_cashflow || 0}.`,
        row.source_url ? `URL reference: ${row.source_url}. Metadata only; no scraping was performed.` : "",
        row.notes,
        "Advisory only. No offer, purchase, legal instruction or external communication has been made.",
      ].filter(Boolean).join(" "),
    }));
  }

  const propertyAnalyses = db.prepare(`
    SELECT a.*, o.title AS opportunity_title, o.stage, o.asset_type
    FROM property_deal_analyses a
    JOIN property_opportunities o ON o.id = a.opportunity_id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 200
  `).all();
  for (const row of propertyAnalyses) {
    const results = safeJsonParse(row.results, {});
    records.push(semanticRecord({
      sourceType: "property_deal_analysis",
      sourceId: row.id,
      sourceCreatedAt: row.created_at,
      title: `${row.opportunity_title} deal analysis`,
      summary: [
        `Westbridge deal analysis for ${row.opportunity_title}.`,
        `Stage: ${row.stage}.`,
        `Asset type: ${row.asset_type || "Unknown"}.`,
        `Gross yield: ${results.grossYield || 0}%.`,
        `Net yield: ${results.netYield || 0}%.`,
        `ROI: ${results.roi || 0}%.`,
        `Net monthly cashflow: £${results.netMonthlyCashflow || 0}.`,
        `Cash left in deal: £${results.cashLeftInDeal || 0}.`,
        row.recommendation ? `Recommendation: ${row.recommendation}.` : "",
        "Recommendation only; no investment action was executed.",
      ].filter(Boolean).join(" "),
    }));
  }

  const propertyDueDiligence = db.prepare(`
    SELECT d.*, o.title AS opportunity_title
    FROM property_due_diligence_items d
    JOIN property_opportunities o ON o.id = d.opportunity_id
    ORDER BY d.updated_at DESC, d.id DESC
    LIMIT 300
  `).all();
  for (const row of propertyDueDiligence) {
    records.push(semanticRecord({
      sourceType: "property_due_diligence",
      sourceId: row.id,
      sourceCreatedAt: row.reviewed_at || row.updated_at || row.created_at,
      title: `${row.opportunity_title} ${row.category}`,
      summary: [
        `Westbridge due diligence: ${row.category}.`,
        `Opportunity: ${row.opportunity_title}.`,
        `Status: ${row.status}.`,
        row.detail,
        "Due diligence status is tracked inside Alfred only; no external instruction was issued.",
      ].filter(Boolean).join(" "),
    }));
  }

  const propertyMemory = db.prepare(`
    SELECT *
    FROM property_memory_links
    ORDER BY created_at DESC, id DESC
    LIMIT 300
  `).all();
  for (const row of propertyMemory) {
    records.push(semanticRecord({
      sourceType: "property_memory",
      sourceId: row.id,
      sourceCreatedAt: row.created_at,
      title: `${row.source_type}:${row.source_id}`,
      summary: row.summary,
      sensitivityCategory: row.sensitivity_category || "local_sensitive_business_data",
    }));
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
