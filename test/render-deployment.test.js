import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const RENDER_YAML = join(ROOT, "render.yaml");

test("Render Blueprint exists with Node service and persistent SQLite disk", () => {
  assert.equal(existsSync(RENDER_YAML), true);
  const blueprint = readFileSync(RENDER_YAML, "utf8");

  assert.match(blueprint, /runtime:\s*node/);
  assert.match(blueprint, /name:\s*alfred-ai-operating-system/);
  assert.match(blueprint, /region:\s*frankfurt/);
  assert.match(blueprint, /plan:\s*starter/);
  assert.match(blueprint, /healthCheckPath:\s*\/api\/healthz/);
  assert.match(blueprint, /mountPath:\s*\/var\/data/);
  assert.match(blueprint, /sizeGB:\s*1/);
  assert.match(blueprint, /ALFRED_DB_PATH[\s\S]*value:\s*\/var\/data\/alfred\.db/);
  assert.match(blueprint, /MICROSOFT_TOKEN_PATH[\s\S]*value:\s*\/var\/data\/microsoft-token\.json/);
});

test("Render Blueprint prompts only for launch gate secrets", () => {
  const blueprint = readFileSync(RENDER_YAML, "utf8");
  const launchGateKeys = ["ALFRED_BASIC_AUTH_USERNAME", "ALFRED_BASIC_AUTH_PASSWORD", "ALFRED_ALLOWED_USERS"];
  const providerKeys = ["ANTHROPIC_API_KEY", "VOYAGE_API_KEY", "MONDAY_API_TOKEN", "DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY"];

  for (const key of launchGateKeys) {
    assert.match(blueprint, new RegExp(`key:\\s*${key}[\\s\\S]*?sync:\\s*false`));
  }
  for (const key of providerKeys) {
    assert.doesNotMatch(blueprint, new RegExp(`key:\\s*${key}`));
  }
  assert.doesNotMatch(blueprint, /sk-ant-/i);
  assert.doesNotMatch(blueprint, /eyJ[a-z0-9_-]+\./i);
});
