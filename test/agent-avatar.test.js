import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AGENT_AVATAR_PROFILES,
  CURRENT_AGENT_IDS,
  PLANNED_AGENT_IDS,
  agentFallbackInitials,
  buildAgentAvatarRenderModel,
  buildExecutiveTeamRoster,
  isLocalAvatarPath,
} from "../agent-avatars.js";
import { VOICE_PERSONAS } from "../voice.js";

const REQUIRED_AGENT_IDS = [
  "alfred",
  "olivia",
  "sarah",
  "westbridge-property-director",
  "sentinel",
  "maya",
  "alex",
  "ethan",
  "liam",
  "james",
];

test("agent avatar metadata exists for all executive identities", () => {
  assert.deepEqual(AGENT_AVATAR_PROFILES.map((agent) => agent.id), REQUIRED_AGENT_IDS);
  for (const agent of AGENT_AVATAR_PROFILES) {
    assert.ok(agent.name);
    assert.ok(agent.title);
    assert.ok(agent.businessArea);
    assert.ok(agent.department);
    assert.ok(agent.avatarPath);
    assert.ok(agent.fallbackInitials);
    assert.match(agent.accentColor, /^#[0-9a-f]{6}$/i);
    assert.ok(agent.voicePersonaPlaceholder);
    assert.ok(agent.reportingLine);
    assert.ok(agent.currentCapabilitySummary);
    assert.ok(agent.plannedCapabilitySummary);
    assert.ok(agent.expertiseTags.length);
  }
});

test("Sentinel CISO metadata exists as planned advisory governance only", () => {
  const sentinel = buildAgentAvatarRenderModel({ id: "sentinel" });
  assert.equal(sentinel.name, "Sentinel");
  assert.equal(sentinel.title, "Chief Information Security Officer");
  assert.equal(sentinel.department, "Security");
  assert.equal(sentinel.statusCategory, "planned");
  assert.equal(sentinel.reportingLine, "Patrick King");
  assert.equal(sentinel.fallbackInitials, "S");
  assert.ok(sentinel.expertiseTags.includes("AI Governance"));
  assert.ok(sentinel.expertiseTags.includes("Prompt Injection Defence"));
  assert.match(sentinel.currentCapabilitySummary, /placeholder/i);
  assert.match(sentinel.plannedCapabilitySummary, /MFA|GitHub|dependencies|incident/i);
});

test("fallback initials are generated and known long names can override safely", () => {
  assert.equal(agentFallbackInitials("Missing Avatar"), "MA");
  assert.equal(buildAgentAvatarRenderModel({ name: "Missing Image", avatarPath: "" }).fallbackInitials, "MI");
  assert.equal(buildAgentAvatarRenderModel({ id: "westbridge-property-director" }).fallbackInitials, "W");
});

test("avatar paths are local only and assets exist", () => {
  assert.equal(isLocalAvatarPath("https://example.com/avatar.png"), false);
  assert.equal(isLocalAvatarPath("//example.com/avatar.png"), false);
  assert.equal(isLocalAvatarPath("data:image/svg+xml;base64,abc"), false);
  assert.equal(isLocalAvatarPath("/assets/avatars/alfred.svg"), true);

  for (const agent of AGENT_AVATAR_PROFILES) {
    assert.equal(isLocalAvatarPath(agent.avatarPath), true, agent.id);
    assert.equal(agent.avatarPath.startsWith("/assets/avatars/"), true, agent.id);
    assert.equal(existsSync(`.${agent.avatarPath}`), true, agent.avatarPath);
  }
});

test("avatar SVG placeholders do not hotlink external image content", () => {
  for (const agent of AGENT_AVATAR_PROFILES) {
    const svg = readFileSync(`.${agent.avatarPath}`, "utf8");
    assert.doesNotMatch(svg, /<image\b/i, agent.avatarPath);
    assert.doesNotMatch(svg, /\bhref=["']https?:\/\//i, agent.avatarPath);
  }
});

test("executive team roster renders current and planned agents safely", () => {
  const roster = buildExecutiveTeamRoster([]);
  assert.deepEqual(roster.map((agent) => agent.id), REQUIRED_AGENT_IDS);
  assert.deepEqual(roster.filter((agent) => agent.statusCategory === "active").map((agent) => agent.id), CURRENT_AGENT_IDS);
  assert.deepEqual(roster.filter((agent) => agent.statusCategory === "planned").map((agent) => agent.id), PLANNED_AGENT_IDS);
  assert.equal(roster.every((agent) => agent.avatarPath || agent.fallbackInitials), true);
});

test("missing or external avatar image metadata falls back without external URL", () => {
  const model = buildAgentAvatarRenderModel({
    id: "custom-agent",
    name: "Custom Agent",
    avatarPath: "https://example.com/not-allowed.png",
  });
  assert.equal(model.avatarPath, "");
  assert.equal(model.fallbackInitials, "CA");
  assert.equal(model.voicePersonaPlaceholder, "ca-voice-placeholder");
});

test("voice persona placeholders exist for current and future agents", () => {
  assert.deepEqual(VOICE_PERSONAS.map((persona) => persona.id), REQUIRED_AGENT_IDS);
  for (const persona of VOICE_PERSONAS) {
    assert.ok(persona.voicePersonaPlaceholder, persona.id);
  }
});

test("avatar UI hooks exist for dashboards and briefing surfaces", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("app.js", "utf8");
  assert.match(html, /id="executive-team-identity"/);
  assert.match(html, /id="voice-agent-identity"/);
  assert.match(html, /id="finance-agent-identity"/);
  assert.match(html, /id="sarah-agent-identity"/);
  assert.match(html, /id="property-agent-identity"/);
  assert.match(html, /id="settings-avatar-summary"/);
  assert.match(app, /renderBriefAgentStatus/);
  assert.match(app, /enhanceAvatarFallbacks/);
  assert.doesNotMatch(app, /roster\.slice\(0,\s*9\)/);
});

test("roadmap documents Sentinel, Teams Meeting Intelligence, feedback loops and Monday operating layer", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.match(readme, /Sentinel CISO Foundation/);
  assert.match(readme, /Teams Meeting Intelligence/i);
  assert.match(readme, /Agent Feedback Loop Roadmap/);
  assert.match(readme, /Monday\.com Operating System Roadmap/);
  assert.match(readme, /Sentinel must exist before future write-capable or autonomous agents/);
});
