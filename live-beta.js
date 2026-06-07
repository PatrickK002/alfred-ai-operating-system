import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiKeyAssignmentReadiness,
  buildProductionPreflight,
  currentEnvironment,
  pwaReadiness,
} from "./app-metadata.js";

const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = resolve(ROOT_DIR, "data", "alfred.db");
const DEFAULT_BACKUP_RETENTION_DAYS = 14;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function configuredDatabasePath(env = process.env) {
  return env.ALFRED_DB_PATH || DEFAULT_DB_PATH;
}

function configuredBackupDirectory(env = process.env) {
  if (hasValue(env.ALFRED_BACKUP_DIR)) return env.ALFRED_BACKUP_DIR;
  return resolve(dirname(configuredDatabasePath(env)), "backups");
}

function backupRetentionDays(env = process.env) {
  const parsed = Number.parseInt(env.ALFRED_BACKUP_RETENTION_DAYS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_RETENTION_DAYS;
}

function pathCategory(path = "") {
  const value = String(path);
  if (value.startsWith("/var/data")) return "render-persistent-disk";
  if (value.includes("/home/data")) return "azure-persistent-storage";
  if (value.includes("/data/")) return "local-data-directory";
  return "custom";
}

function sqlStringLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function fileMetadata(fileName, directory, now = Date.now()) {
  const filePath = resolve(directory, fileName);
  const stat = statSync(filePath);
  return {
    fileName,
    sizeBytes: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    ageHours: Math.round(((now - stat.mtimeMs) / ONE_HOUR_MS) * 10) / 10,
    pathCategory: pathCategory(filePath),
  };
}

export function listSqliteBackups(env = process.env, { now = Date.now() } = {}) {
  const directory = configuredBackupDirectory(env);
  if (!existsSync(directory)) {
    return {
      strategy: env.ALFRED_BACKUP_STRATEGY || "not-configured",
      directoryConfigured: hasValue(directory),
      directoryCategory: pathCategory(directory),
      retentionDays: backupRetentionDays(env),
      count: 0,
      latest: null,
      items: [],
      valuesRedacted: true,
    };
  }
  const items = readdirSync(directory)
    .filter((fileName) => /^alfred-backup-\d{4}-\d{2}-\d{2}T.*\.db$/.test(fileName))
    .map((fileName) => fileMetadata(fileName, directory, now))
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  return {
    strategy: env.ALFRED_BACKUP_STRATEGY || "not-configured",
    directoryConfigured: true,
    directoryCategory: pathCategory(directory),
    retentionDays: backupRetentionDays(env),
    count: items.length,
    latest: items[0] || null,
    items: items.slice(0, 10),
    valuesRedacted: true,
  };
}

export function createSqliteBackup(db, env = process.env, { now = new Date() } = {}) {
  const directory = configuredBackupDirectory(env);
  mkdirSync(directory, { recursive: true });
  const fileName = `alfred-backup-${now.toISOString().replace(/[:.]/g, "-")}.db`;
  const filePath = resolve(directory, fileName);
  db.exec(`VACUUM INTO ${sqlStringLiteral(filePath)}`);
  const backup = fileMetadata(fileName, directory, now.getTime());
  return {
    created: true,
    backup,
    boundary: {
      localSqliteSnapshotOnly: true,
      externalWritesEnabled: false,
      microsoftWritesEnabled: false,
      mondayWritesEnabled: false,
    },
    valuesRedacted: true,
  };
}

function databaseRuntimeStatus(db, env = process.env) {
  const dbPath = configuredDatabasePath(env);
  const status = {
    configuredPathCategory: pathCategory(dbPath),
    persistentPathConfigured: hasValue(env.ALFRED_DB_PATH),
    filePresent: existsSync(dbPath),
    integrity: "unknown",
    journalMode: "unknown",
    pageCount: 0,
    sizeBytes: 0,
    valuesRedacted: true,
  };
  try {
    status.integrity = db.prepare("PRAGMA integrity_check").get()?.integrity_check || "unknown";
    status.journalMode = db.prepare("PRAGMA journal_mode").get()?.journal_mode || "unknown";
    status.pageCount = Number(db.prepare("PRAGMA page_count").get()?.page_count || 0);
    const pageSize = Number(db.prepare("PRAGMA page_size").get()?.page_size || 0);
    status.sizeBytes = status.pageCount * pageSize;
  } catch (error) {
    status.integrity = "error";
    status.error = error.message;
  }
  return status;
}

function statusFromChecks(checks) {
  const blockers = checks.filter((check) => check.status === "block").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  return {
    status: blockers ? "attention-required" : warnings ? "watch" : "ready",
    blockers,
    warnings,
    passing: checks.filter((check) => check.status === "pass").length,
  };
}

function check(id, label, status, message, action = "") {
  return { id, label, status, message, action };
}

function recentBackupStatus(backups, env = process.env) {
  if (!hasValue(env.ALFRED_BACKUP_STRATEGY)) return "warn";
  if (!backups.latest) return "warn";
  return backups.latest.ageHours <= 24 ? "pass" : "warn";
}

function microsoftTokenCheck(token) {
  if (!token.configured) return "warn";
  if (!token.connected) return "warn";
  if (token.expiryStatus === "expired") return "block";
  if (token.expiryStatus === "expiring") return "warn";
  return "pass";
}

export function buildPrivateBetaChecklist({
  env = process.env,
  preflight = buildProductionPreflight(env),
  backups = listSqliteBackups(env),
  microsoftToken = {},
} = {}) {
  const apiKeys = apiKeyAssignmentReadiness(env);
  const pwa = pwaReadiness();
  const items = [
    check(
      "live_url_https",
      "Live URL uses HTTPS",
      preflight.checks?.find((item) => item.id === "https_public_url")?.status || "warn",
      "Alfred should only be shared through the HTTPS Render URL.",
      "Keep APP_BASE_URL on the live HTTPS domain.",
    ),
    check(
      "authentication_gate",
      "Authentication gate is enforced",
      preflight.checks?.find((item) => item.id === "authentication_gate")?.status || "warn",
      "Private beta access must remain behind server-side authentication.",
      "Keep Basic Auth or a future Entra gate enabled.",
    ),
    check(
      "persistent_database",
      "Persistent database path is configured",
      preflight.checks?.find((item) => item.id === "persistent_database")?.status || "warn",
      "SQLite operating records must live on persistent storage.",
      "Use /var/data on Render or equivalent persistent storage.",
    ),
    check(
      "backup_plan",
      "Backup strategy is documented",
      hasValue(env.ALFRED_BACKUP_STRATEGY) ? "pass" : "warn",
      "Database backups must be owned before relying on live operating memory.",
      "Set ALFRED_BACKUP_STRATEGY and use local backup snapshots.",
    ),
    check(
      "recent_backup",
      "Recent SQLite backup exists",
      recentBackupStatus(backups, env),
      backups.latest ? `Latest local snapshot is ${backups.latest.ageHours} hour(s) old.` : "No local SQLite backup snapshot has been recorded yet.",
      "Create a backup from Settings before beta use.",
    ),
    check(
      "provider_keys",
      "Provider keys are assigned server-side",
      apiKeys.missingCount === 0 && apiKeys.partialCount === 0 ? "pass" : "warn",
      apiKeys.summary,
      "Assign missing provider keys in Render only; never in Git or browser storage.",
    ),
    check(
      "microsoft_read_only",
      "Microsoft 365 is connected read-only",
      microsoftTokenCheck(microsoftToken),
      microsoftToken.connected
        ? `Token ${microsoftToken.expiryStatus || "status unknown"}; read scopes only.`
        : "Microsoft is not connected or token metadata is unavailable.",
      "Reconnect Microsoft if token expiry or refresh fails.",
    ),
    check(
      "pwa_install",
      "PWA install assets are available",
      pwa.installReady ? "pass" : "warn",
      `Install targets: ${(pwa.installTargets || []).join(", ")}.`,
      "Keep manifest, icon and service worker assets available.",
    ),
    check(
      "approval_safeguards",
      "Approval safeguards remain required",
      "pass",
      "Approval preflight exists and execution remains disabled.",
      "Do not add write executors until separately reviewed.",
    ),
    check(
      "external_write_boundary",
      "External write boundary is closed",
      "pass",
      "No Microsoft, Monday, finance, property, voice or autonomous write action is enabled.",
      "Future write paths must be separate, explicit and approval-gated.",
    ),
    check(
      "temporary_keys_revoked",
      "Temporary deployment keys revoked",
      env.ALFRED_TEMPORARY_RENDER_KEY_REVOKED === "true" ? "pass" : "warn",
      "This is a manual operational confirmation, not something Alfred can verify.",
      "Revoke temporary Render/GitHub/Azure keys after setup and set ALFRED_TEMPORARY_RENDER_KEY_REVOKED=true if you want the checklist to mark it complete.",
    ),
  ];
  return {
    items,
    summary: statusFromChecks(items),
  };
}

export function buildLiveBetaStatus({
  db,
  microsoft,
  microsoftStatus = null,
  env = process.env,
  uptimeSeconds = 0,
  now = Date.now(),
} = {}) {
  const preflight = buildProductionPreflight(env);
  const database = databaseRuntimeStatus(db, env);
  const backups = listSqliteBackups(env, { now });
  const microsoftToken = microsoft?.tokenMetadata ? microsoft.tokenMetadata(now) : { configured: false, connected: false };
  const checklist = buildPrivateBetaChecklist({ env, preflight, backups, microsoftToken });
  const monitoringChecks = [
    check(
      "database_integrity",
      "SQLite integrity",
      database.integrity === "ok" ? "pass" : "block",
      `SQLite integrity check returned ${database.integrity}.`,
      "Investigate database before relying on live records.",
    ),
    check(
      "backup_freshness",
      "Backup freshness",
      recentBackupStatus(backups, env),
      backups.latest ? `Latest backup is ${backups.latest.ageHours} hour(s) old.` : "No backup snapshot found.",
      "Create a backup from Settings.",
    ),
    check(
      "microsoft_token",
      "Microsoft token freshness",
      microsoftTokenCheck(microsoftToken),
      microsoftToken.connected
        ? `Token expires in ${microsoftToken.expiresInMinutes ?? "unknown"} minute(s); refresh token present: ${microsoftToken.refreshTokenPresent ? "yes" : "no"}.`
        : "Microsoft token is not connected.",
      "Reconnect Microsoft 365 if token refresh is unavailable.",
    ),
    check(
      "auth_and_https",
      "Authentication and HTTPS",
      preflight.checks?.some((item) => item.id === "authentication_gate" && item.status === "pass")
        && preflight.checks?.some((item) => item.id === "https_public_url" && item.status === "pass")
        ? "pass" : "warn",
      "Private beta should remain authenticated and HTTPS-only.",
      "Review Render environment variables if this warns.",
    ),
    check(
      "read_only_boundary",
      "Read-only operating boundary",
      "pass",
      "External writes and autonomous execution are disabled.",
      "Keep future write actions behind explicit approval workflow.",
    ),
  ];
  const summary = statusFromChecks([...monitoringChecks, ...checklist.items]);
  return {
    generatedAt: new Date(now).toISOString(),
    environment: currentEnvironment(env),
    uptimeSeconds,
    summary,
    database,
    backups,
    microsoft: {
      ...microsoftStatus,
      token: microsoftToken,
    },
    monitoring: {
      checks: monitoringChecks,
      summary: statusFromChecks(monitoringChecks),
    },
    checklist,
    securityBoundary: {
      localBackupsOnly: true,
      externalWritesEnabled: false,
      autonomousExecutionEnabled: false,
      microsoftWriteScopesAllowed: false,
      mondayWritesAllowed: false,
      approvalSafeguardsRequired: true,
      providerValuesRedacted: true,
      secretsExposed: false,
    },
    valuesRedacted: true,
  };
}
