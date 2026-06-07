import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase } from "../db.js";
import {
  buildLiveBetaStatus,
  buildPrivateBetaChecklist,
  createSqliteBackup,
  listSqliteBackups,
} from "../live-beta.js";
import { MICROSOFT_SCOPES, MicrosoftGraphClient } from "../microsoft.js";

function withTempDirectory(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-live-beta-"));
  try {
    return run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function withDatabase(run) {
  return withTempDirectory((directory) => {
    const dbPath = join(directory, "alfred.db");
    const backupDir = join(directory, "backups");
    const db = createDatabase(dbPath);
    try {
      return run(db, { directory, dbPath, backupDir });
    } finally {
      db.close();
    }
  });
}

test("Microsoft token metadata redacts token values and reports refresh visibility", () => {
  withTempDirectory((directory) => {
    const tokenPath = join(directory, "microsoft-token.json");
    const client = new MicrosoftGraphClient({
      clientId: "client-id",
      tokenPath,
      fetchImpl: async () => {
        throw new Error("Network should not be called");
      },
    });

    client.saveToken({
      access_token: "secret-access-token",
      refresh_token: "secret-refresh-token",
      expires_in: 3600,
      scope: MICROSOFT_SCOPES.join(" "),
    });

    const metadata = client.tokenMetadata(Date.now());
    const serialized = JSON.stringify(metadata);

    assert.equal(metadata.configured, true);
    assert.equal(metadata.connected, true);
    assert.equal(metadata.refreshTokenPresent, true);
    assert.equal(metadata.expiryStatus, "healthy");
    assert.equal(metadata.valuesRedacted, true);
    assert.equal(metadata.scopes.some((scope) => /Write|Send/i.test(scope)), false);
    assert.doesNotMatch(serialized, /secret-access-token/);
    assert.doesNotMatch(serialized, /secret-refresh-token/);
  });
});

test("SQLite backup creation stores a local redacted snapshot", () => {
  withDatabase((db, { dbPath, backupDir }) => {
    const env = {
      ALFRED_DB_PATH: dbPath,
      ALFRED_BACKUP_DIR: backupDir,
      ALFRED_BACKUP_STRATEGY: "local-test-snapshots",
      ALFRED_BACKUP_RETENTION_DAYS: "7",
    };
    const backup = createSqliteBackup(db, env, { now: new Date("2026-06-07T12:00:00.000Z") });
    const backups = listSqliteBackups(env, { now: Date.parse("2026-06-07T13:00:00.000Z") });
    const serialized = JSON.stringify(backup);

    assert.equal(backup.created, true);
    assert.equal(backup.valuesRedacted, true);
    assert.equal(backup.boundary.externalWritesEnabled, false);
    assert.equal(existsSync(join(backupDir, backup.backup.fileName)), true);
    assert.equal(backups.count, 1);
    assert.equal(backups.latest.fileName, backup.backup.fileName);
    assert.equal(backups.retentionDays, 7);
    assert.equal(Object.hasOwn(backup.backup, "filePath"), false);
    assert.doesNotMatch(serialized, new RegExp(backupDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});

test("live beta status includes monitoring, checklist and closed write boundary", () => {
  withDatabase((db, { dbPath, backupDir }) => {
    const env = {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_BASE_URL: "https://alfred-ai-operating-system.onrender.com",
      AUTHENTICATION_ENABLED: "true",
      AUTHENTICATION_PROVIDER: "basic-auth",
      ALFRED_BASIC_AUTH_USERNAME: "patrick",
      ALFRED_BASIC_AUTH_PASSWORD: "strong-password",
      ALFRED_ALLOWED_USERS: "patrick",
      ALFRED_REQUIRE_USER_ALLOWLIST: "true",
      ALFRED_DB_PATH: dbPath,
      ALFRED_BACKUP_DIR: backupDir,
      ALFRED_BACKUP_STRATEGY: "render-persistent-disk-daily-snapshots",
      ALFRED_TEMPORARY_RENDER_KEY_REVOKED: "true",
      ENFORCE_HTTPS: "true",
      ANTHROPIC_API_KEY: "secret-anthropic-key",
      VOYAGE_API_KEY: "secret-voyage-key",
      MICROSOFT_CLIENT_ID: "client-id",
      MICROSOFT_TENANT_ID: "organizations",
      DEEPGRAM_API_KEY: "secret-deepgram-key",
      ELEVENLABS_API_KEY: "secret-elevenlabs-key",
      ELEVENLABS_VOICE_ID: "voice-id",
    };
    createSqliteBackup(db, env, { now: new Date("2026-06-07T12:00:00.000Z") });

    const status = buildLiveBetaStatus({
      db,
      env,
      now: Date.parse("2026-06-07T13:00:00.000Z"),
      uptimeSeconds: 120,
      microsoftStatus: { connected: true, readOnlyScopes: MICROSOFT_SCOPES },
      microsoft: {
        tokenMetadata: () => ({
          configured: true,
          connected: true,
          expiryStatus: "healthy",
          expiresInMinutes: 55,
          refreshTokenPresent: true,
          scopes: MICROSOFT_SCOPES,
          valuesRedacted: true,
        }),
      },
    });
    const serialized = JSON.stringify(status);

    assert.equal(status.valuesRedacted, true);
    assert.equal(status.securityBoundary.externalWritesEnabled, false);
    assert.equal(status.securityBoundary.microsoftWriteScopesAllowed, false);
    assert.ok(status.monitoring.checks.some((check) => check.id === "database_integrity" && check.status === "pass"));
    assert.ok(status.checklist.items.some((item) => item.id === "temporary_keys_revoked" && item.status === "pass"));
    assert.equal(status.backups.count, 1);
    assert.doesNotMatch(serialized, /secret-anthropic-key|secret-voyage-key|secret-deepgram-key|secret-elevenlabs-key/);
  });
});

test("private beta checklist warns when backup and temporary key confirmation are missing", () => {
  const checklist = buildPrivateBetaChecklist({
    env: {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_BASE_URL: "https://alfred-ai-operating-system.onrender.com",
      AUTHENTICATION_ENABLED: "true",
      AUTHENTICATION_PROVIDER: "basic-auth",
      ALFRED_BASIC_AUTH_USERNAME: "patrick",
      ALFRED_BASIC_AUTH_PASSWORD: "strong-password",
      ALFRED_ALLOWED_USERS: "patrick",
      ALFRED_DB_PATH: "/var/data/alfred.db",
      ENFORCE_HTTPS: "true",
    },
    backups: { latest: null },
    microsoftToken: { configured: true, connected: true, expiryStatus: "healthy" },
  });

  assert.ok(checklist.items.some((item) => item.id === "backup_plan" && item.status === "warn"));
  assert.ok(checklist.items.some((item) => item.id === "recent_backup" && item.status === "warn"));
  assert.ok(checklist.items.some((item) => item.id === "temporary_keys_revoked" && item.status === "warn"));
});

test("live beta routes and Settings UI hooks are exposed", () => {
  const server = readFileSync(join(process.cwd(), "server.js"), "utf8");
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const app = readFileSync(join(process.cwd(), "app.js"), "utf8");
  const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");

  assert.match(server, /"\/api\/live-beta\/status"/);
  assert.match(server, /"\/api\/live-beta\/backups"/);
  assert.match(html, /id="live-beta-summary-facts"/);
  assert.match(html, /id="microsoft-token-facts"/);
  assert.match(html, /id="create-live-backup"/);
  assert.match(app, /createLiveBetaBackup/);
  assert.match(app, /\/api\/live-beta\/status/);
  assert.match(app, /\/api\/live-beta\/backups/);
  assert.match(readme, /Live beta hardening/);
  assert.match(readme, /ALFRED_TEMPORARY_RENDER_KEY_REVOKED/);
});
