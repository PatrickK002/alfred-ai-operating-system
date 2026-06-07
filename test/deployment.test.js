import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  APP_METADATA,
  apiKeyAssignmentReadiness,
  buildHealthResponse,
  buildProductionPreflight,
  currentEnvironment,
  pwaReadiness,
  validateEnvironment,
} from "../app-metadata.js";

const ROOT = process.cwd();

test("health endpoint model includes environment, database, integrations and version", () => {
  const health = buildHealthResponse({
    env: {
      NODE_ENV: "testing",
      APP_ENV: "testing",
      APP_BASE_URL: "https://testing.alfred.example",
      ANTHROPIC_API_KEY: "secret-anthropic",
    },
    databaseStatus: "connected",
    integrationConfiguration: {
      anthropic: { configured: true, status: "Planned" },
      microsoft: { configured: false, connected: false, readOnlyScopes: ["Mail.Read"] },
    },
    uptimeSeconds: 12,
  });

  assert.equal(health.status, "ok");
  assert.equal(health.environment, "testing");
  assert.equal(health.database.status, "connected");
  assert.equal(health.version, APP_METADATA.packageVersion);
  assert.equal(health.integrations.microsoft.readOnlyScopes[0], "Mail.Read");
  assert.equal(health.security.externalWritesEnabled, false);
});

test("environment validation warns for production without secure base URL and authentication", () => {
  const validation = validateEnvironment({
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_BASE_URL: "http://alfred.example",
    AUTHENTICATION_ENABLED: "false",
  });

  assert.equal(currentEnvironment({ APP_ENV: "production" }), "production");
  assert.equal(validation.productionReady, false);
  assert.ok(validation.warnings.some((warning) => warning.code === "APP_BASE_URL_HTTPS_REQUIRED"));
  assert.ok(validation.warnings.some((warning) => warning.code === "AUTHENTICATION_PLACEHOLDER"));
  assert.ok(validation.variables.some((variable) => variable.key === "ANTHROPIC_API_KEY" && variable.secret));
});

test("production configuration warnings do not expose raw secrets", () => {
  const health = buildHealthResponse({
    env: {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_BASE_URL: "https://alfred.example",
      AUTHENTICATION_ENABLED: "true",
      ANTHROPIC_API_KEY: "super-secret-anthropic-key",
      VOYAGE_API_KEY: "super-secret-voyage-key",
    },
    databaseStatus: "connected",
  });
  const serialized = JSON.stringify(health);

  assert.doesNotMatch(serialized, /super-secret-anthropic-key/);
  assert.doesNotMatch(serialized, /super-secret-voyage-key/);
  assert.equal(health.security.secretsInFrontend, false);
  assert.equal(health.security.apiKeysInLocalStorage, false);
  assert.equal(health.apiKeyReadiness.valuesRedacted, true);
});

test("production preflight blocks live exposure without HTTPS auth and persistent database", () => {
  const preflight = buildProductionPreflight({
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_BASE_URL: "http://alfred.example",
    AUTHENTICATION_ENABLED: "false",
    ENFORCE_HTTPS: "true",
  }, { nodeVersion: "24.0.0" });

  assert.equal(preflight.goLiveReady, false);
  assert.ok(preflight.checks.some((check) => check.id === "https_public_url" && check.status === "block"));
  assert.ok(preflight.checks.some((check) => check.id === "authentication_gate" && check.status === "block"));
  assert.ok(preflight.checks.some((check) => check.id === "persistent_database" && check.status === "block"));
  assert.equal(preflight.securityBoundary.externalWritesEnabled, false);
  assert.equal(preflight.securityBoundary.providerValuesRedacted, true);
});

test("API key assignment readiness reports status without exposing values", () => {
  const readiness = apiKeyAssignmentReadiness({
    ANTHROPIC_API_KEY: "secret-anthropic-key",
    VOYAGE_API_KEY: "secret-voyage-key",
    MICROSOFT_CLIENT_ID: "client-id",
    MICROSOFT_TENANT_ID: "tenant-id",
  });
  const serialized = JSON.stringify(readiness);

  assert.equal(readiness.groups.find((group) => group.id === "anthropic").status, "ready");
  assert.equal(readiness.groups.find((group) => group.id === "microsoft").status, "ready");
  assert.equal(readiness.groups.find((group) => group.id === "monday").status, "missing");
  assert.doesNotMatch(serialized, /secret-anthropic-key/);
  assert.doesNotMatch(serialized, /secret-voyage-key/);
  assert.equal(readiness.valuesRedacted, true);
});

test("production preflight can pass blockers while warning for optional provider keys", () => {
  const preflight = buildProductionPreflight({
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_BASE_URL: "https://alfred.example",
    AUTHENTICATION_ENABLED: "true",
    ALFRED_DB_PATH: "/home/data/alfred.db",
    ALFRED_BACKUP_STRATEGY: "azure-app-service-backup",
    ENFORCE_HTTPS: "true",
    ANTHROPIC_API_KEY: "secret-anthropic-key",
  }, { nodeVersion: "24.0.0" });

  assert.equal(preflight.goLiveReady, true);
  assert.equal(preflight.blockers, 0);
  assert.ok(preflight.warnings >= 1);
  assert.ok(preflight.checks.some((check) => check.id === "api_key_assignment" && check.status === "warn"));
});

test("PWA manifest and service worker assets exist with install metadata", () => {
  const manifestPath = join(ROOT, "manifest.json");
  const workerPath = join(ROOT, "service-worker.js");
  const offlinePath = join(ROOT, "offline.html");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const worker = readFileSync(workerPath, "utf8");
  const readiness = pwaReadiness();

  assert.equal(existsSync(manifestPath), true);
  assert.equal(existsSync(workerPath), true);
  assert.equal(existsSync(offlinePath), true);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#071011");
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
  assert.match(worker, /offline\.html/);
  assert.equal(readiness.installReady, true);
});

test("service worker registration is guarded and cannot break unsupported browsers", () => {
  const app = readFileSync(join(ROOT, "app.js"), "utf8");

  assert.match(app, /serviceWorker" in navigator/);
  assert.match(app, /navigator\.serviceWorker\.register/);
  assert.match(app, /\.catch\(\(error\)/);
});

test("version metadata and release notes are present", () => {
  const releasePath = join(ROOT, "docs", "releases", "v0.4-cloud-pwa-preparation.md");

  assert.equal(APP_METADATA.release.version, "v0.4");
  assert.equal(APP_METADATA.packageName, "alfred-ai-operating-system");
  assert.equal(existsSync(releasePath), true);
  assert.match(readFileSync(releasePath, "utf8"), /Cloud\/PWA Preparation/);
});

test("iPhone and iPad responsive layout markers are present", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const css = readFileSync(join(ROOT, "styles.css"), "utf8");

  assert.match(html, /data-layout-marker="ipad-executive-mode"/);
  assert.match(html, /data-layout-marker="voice-panel"/);
  assert.match(css, /max-width: 760px/);
  assert.match(css, /min-width: 761px/);
  assert.match(css, /max-width: 1366px/);
  assert.match(css, /min-height: 44px/);
});

test("settings page exposes live readiness and API key assignment panels", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const app = readFileSync(join(ROOT, "app.js"), "utf8");

  assert.match(html, /api-key-readiness-list/);
  assert.match(html, /live-readiness-list/);
  assert.match(app, /apiKeyReadiness/);
  assert.match(app, /liveReadiness/);
});
