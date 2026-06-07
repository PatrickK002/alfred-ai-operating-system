import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const TEMPLATE_PATHS = [
  join(ROOT, "deploy", "azure-app-settings.testing.example.json"),
  join(ROOT, "deploy", "azure-app-settings.production.example.json"),
];
const REQUIRED_APP_SETTINGS = [
  "NODE_ENV",
  "APP_ENV",
  "APP_BASE_URL",
  "HOST",
  "AUTHENTICATION_ENABLED",
  "AUTHENTICATION_PROVIDER",
  "AUTHENTICATED_USER_HEADER",
  "ALFRED_ALLOWED_USERS",
  "ALFRED_REQUIRE_USER_ALLOWLIST",
  "ALFRED_DB_PATH",
  "ALFRED_BACKUP_STRATEGY",
  "ENFORCE_HTTPS",
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_TENANT_ID",
  "MONDAY_API_TOKEN",
  "DEEPGRAM_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
];
const SECRET_SETTINGS = [
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "MONDAY_API_TOKEN",
  "DEEPGRAM_API_KEY",
  "ELEVENLABS_API_KEY",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("live environment setup guide and Azure app setting templates exist", () => {
  assert.equal(existsSync(join(ROOT, "docs", "live", "environment-setup.md")), true);
  for (const path of TEMPLATE_PATHS) {
    assert.equal(existsSync(path), true);
  }
});

test("Azure app setting templates include auth gate, persistent DB and provider settings", () => {
  for (const path of TEMPLATE_PATHS) {
    const settings = readJson(path);
    for (const key of REQUIRED_APP_SETTINGS) {
      assert.ok(Object.hasOwn(settings, key), `${key} missing from ${path}`);
    }
    assert.equal(settings.AUTHENTICATION_ENABLED, "true");
    assert.equal(settings.AUTHENTICATION_PROVIDER, "azure-app-service-easy-auth");
    assert.equal(settings.AUTHENTICATED_USER_HEADER, "x-ms-client-principal");
    assert.equal(settings.ALFRED_REQUIRE_USER_ALLOWLIST, "true");
    assert.match(settings.ALFRED_DB_PATH, /^\/home\/data\/alfred.*\.db$/);
    assert.equal(settings.ENFORCE_HTTPS, "true");
  }
});

test("Azure app setting templates contain placeholders rather than live secrets", () => {
  const forbidden = [
    /sk-ant-/i,
    /eyJ[a-z0-9_-]+\./i,
    /-----BEGIN/i,
    /patrickking/i,
  ];

  for (const path of TEMPLATE_PATHS) {
    const raw = readFileSync(path, "utf8");
    const settings = readJson(path);
    for (const pattern of forbidden) {
      assert.doesNotMatch(raw, pattern, `${path} contains a value that looks like a live secret`);
    }
    for (const key of SECRET_SETTINGS) {
      const value = settings[key];
      assert.ok(
        String(value).startsWith("<") || String(value).startsWith("@Microsoft.KeyVault("),
        `${key} must stay as a placeholder or Key Vault reference in ${path}`,
      );
    }
  }
});

test("README links to live environment setup handoff", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");

  assert.match(readme, /docs\/live\/environment-setup\.md/);
  assert.match(readme, /azure-app-settings\.testing\.example\.json/);
  assert.match(readme, /azure-app-settings\.production\.example\.json/);
});
