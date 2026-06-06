import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  APP_METADATA,
  buildHealthResponse,
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
