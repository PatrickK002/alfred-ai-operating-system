import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, getDashboardData, listSemanticSourceRecords } from "../db.js";
import {
  ETHAN_READ_ONLY_BOUNDARY,
  createTechnologyDecision,
  createTechnologyRisk,
  ethanBriefingForDaily,
  generateEthanAnalysis,
  getEthanDashboard,
  getEthanProfile,
  listEthanAudit,
  searchEthanKnowledge,
} from "../ethan.js";
import { getMondayOperatingDashboard } from "../monday-operating-system.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-ethan-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  const cleanup = () => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const result = run(db);
    if (result && typeof result.then === "function") return result.finally(cleanup);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

test("Ethan profile is active advisory and technology seeds are present", () => {
  withDatabase((db) => {
    const profile = getEthanProfile(db);
    const dashboard = getEthanDashboard(db);
    const core = getDashboardData(db);

    assert.equal(profile.name, "Ethan");
    assert.equal(profile.status, "Active");
    assert.ok(profile.tools.includes("Architecture"));
    assert.ok(core.agents.some((agent) => agent.id === "ethan" && agent.status === "Active"));
    assert.ok(dashboard.systems.some((system) => system.name === "Alfred AI Operating System"));
    assert.ok(dashboard.risks.some((risk) => /authentication/i.test(risk.title)));
    assert.equal(dashboard.boundary.deploymentEnabled, false);
    assert.equal(dashboard.boundary.repoWriteEnabled, false);
  });
});

test("Ethan dashboard integrates with Monday OS workload, risks, decisions and deliverables", () => {
  withDatabase((db) => {
    const risk = createTechnologyRisk(db, {
      title: "CI release gate drift",
      detail: "Release gates need a consistent checklist before merge.",
      severity: "High",
      businessImpact: "Unstable releases could weaken Alfred confidence.",
      recommendedAction: "Keep CI and browser checks mandatory.",
      userAction: "test:ethan:risk",
    });
    const decision = createTechnologyDecision(db, {
      title: "Approve deployment boundary",
      detail: "Confirm first production deployment boundary.",
      priority: "High",
      userAction: "test:ethan:decision",
    });
    const dashboard = getEthanDashboard(db);
    const monday = getMondayOperatingDashboard(db);

    assert.ok(dashboard.monday.workItems.some((item) => item.sourceType === "technology_risk" && String(item.sourceId) === String(risk.id)));
    assert.ok(dashboard.monday.risks.some((item) => item.sourceType === "technology_risk" && String(item.sourceId) === String(risk.id)));
    assert.ok(dashboard.monday.decisions.some((item) => item.sourceType === "technology_decision" && String(item.sourceId) === String(decision.id)));
    assert.ok(dashboard.monday.deliverables.some((item) => item.sourceType === "technology_roadmap"));
    assert.ok(monday.agentWorkloads.some((item) => item.agentId === "ethan" && item.activeItems >= 1));
  });
});

test("Ethan analysis and daily briefing are recommendation-only and audited", () => {
  withDatabase((db) => {
    const analysis = generateEthanAnalysis(db, {
      topic: "production readiness",
      userAction: "test:ethan-analysis",
    });
    const briefing = ethanBriefingForDaily(db);
    const audit = listEthanAudit(db);

    assert.equal(analysis.specialist.name, "Ethan");
    assert.equal(analysis.boundary.deploymentEnabled, false);
    assert.equal(analysis.boundary.cloudChangeEnabled, false);
    assert.match(analysis.assumptions.join(" "), /No repository write|deployment|cloud change/i);
    assert.ok(analysis.sourceRecordReferences.some((reference) => reference.startsWith("technology_risk:")));
    assert.match(briefing.summary, /No deployments|repo writes|cloud changes/i);
    assert.equal(briefing.boundary.externalWritesEnabled, false);
    assert.ok(audit.some((event) => event.eventType === "technology_analysis" && event.executionAttempted === 0 && event.externalWriteAttempted === 0));
  });
});

test("Ethan search and semantic source records link back to technology IDs", () => {
  withDatabase((db) => {
    const search = searchEthanKnowledge(db, "backup release architecture");
    const sourceRecords = listSemanticSourceRecords(db).filter((record) => String(record.sourceType).startsWith("technology_"));

    assert.ok(search.systems.some((system) => /Alfred|SQLite|GitHub/i.test(system.name)));
    assert.ok(search.risks.some((risk) => /Backup|Release|authentication/i.test(risk.title)));
    assert.ok(search.roadmap.some((item) => /backup|release/i.test(item.title)));
    assert.ok(sourceRecords.some((record) => record.sourceType === "technology_system" && record.sourceId));
    assert.ok(sourceRecords.some((record) => record.sourceType === "technology_risk" && /no technical change was executed/i.test(record.summary)));
  });
});

test("Ethan frontend, API routes and avatar metadata are exposed safely", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("app.js", "utf8");
  const server = readFileSync("server.js", "utf8");
  const avatars = readFileSync("agent-avatars.js", "utf8");

  assert.match(html, /data-view="ethan"/);
  assert.match(html, /id="ethan-view"/);
  assert.match(html, /id="ethan-agent-identity"/);
  assert.match(app, /renderEthan/);
  assert.match(app, /askEthanAnalysis/);
  assert.match(server, /\/api\/ethan\/dashboard/);
  assert.match(server, /\/api\/ai\/ethan\/analyse-technology/);
  assert.match(avatars, /id: "ethan"[\s\S]*status: "Active advisory"/);
  assert.equal(ETHAN_READ_ONLY_BOUNDARY.externalWritesEnabled, false);
});
