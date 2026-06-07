import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  LIAM_READ_ONLY_BOUNDARY,
  buildLiamAnalysisInput,
  createPowerPlatformDecision,
  createPowerPlatformRisk,
  generateLiamAnalysis,
  getLiamDashboard,
  getLiamProfile,
  liamBriefingForDaily,
  listLiamAudit,
  searchLiamKnowledge,
} from "../liam.js";
import { getMondayOperatingDashboard } from "../monday-operating-system.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-liam-"));
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

test("Liam profile is active advisory and Power Platform seeds are present", () => {
  withDatabase((db) => {
    const profile = getLiamProfile(db);
    const dashboard = getLiamDashboard(db);

    assert.equal(profile.name, "Liam");
    assert.equal(profile.role, "Power Platform Director");
    assert.equal(profile.status, "Active");
    assert.equal(profile.reportsTo, "Alfred");
    assert.equal(profile.boundary.powerAppsCreationEnabled, false);
    assert.equal(profile.boundary.dataverseWriteEnabled, false);
    assert.equal(profile.boundary.powerAutomateFlowCreationEnabled, false);
    assert.equal(dashboard.metrics.solutions, 4);
    assert.ok(dashboard.solutions.some((solution) => solution.name === "Council Construction Assurance Platform"));
    assert.ok(dashboard.components.some((component) => component.componentType === "Dataverse"));
    assert.ok(dashboard.risks.some((risk) => risk.title === "Power Automate execution boundary"));
  });
});

test("Liam dashboard integrates with internal Monday OS without live writes", () => {
  withDatabase((db) => {
    const dashboard = getLiamDashboard(db);
    const monday = getMondayOperatingDashboard(db);
    const liamWorkload = monday.agentWorkloads.find((item) => item.agentId === "liam");

    assert.equal(dashboard.boundary.externalWritesEnabled, false);
    assert.ok(dashboard.monday.workItems.length >= 1);
    assert.ok(dashboard.monday.risks.length >= 1);
    assert.ok(dashboard.monday.decisions.length >= 1);
    assert.ok(dashboard.monday.deliverables.length >= 1);
    assert.ok(liamWorkload.activeItems >= 1);
    assert.equal(monday.boundary.mondayWriteEnabled, false);
  });
});

test("Liam analysis, briefing and manual records remain recommendation-only", () => {
  withDatabase((db) => {
    const risk = createPowerPlatformRisk(db, {
      title: "Power Apps licensing uncertainty",
      detail: "Licensing assumptions should be confirmed before app blueprint approval.",
      severity: "medium",
      userAction: "test:liam:risk",
    });
    const decision = createPowerPlatformDecision(db, {
      title: "Confirm first Dataverse entity set",
      detail: "Patrick should approve the first Dataverse entity set before any build plan.",
      priority: "high",
      userAction: "test:liam:decision",
    });
    const analysis = generateLiamAnalysis(db, { userAction: "test:liam:analysis" });
    const briefing = liamBriefingForDaily(db);
    const audit = listLiamAudit(db);

    assert.equal(risk.severity, "medium");
    assert.equal(decision.approvalRequired, true);
    assert.equal(analysis.executionAttempted, false);
    assert.equal(analysis.boundary.powerBiPublishEnabled, false);
    assert.equal(analysis.executedActions.length, 0);
    assert.ok(analysis.recommendations.some((item) => item.approvalRequiredBeforeAction));
    assert.ok(analysis.assumptions.some((item) => /No Microsoft tenant/i.test(item)));
    assert.ok(briefing.items.some((item) => item.sourceReference.startsWith("power_platform_")));
    assert.ok(audit.some((event) => event.eventType === "power_platform_analysis" && event.executionAttempted === false));
  });
});

test("Liam search and semantic source records link back to local Power Platform IDs", () => {
  withDatabase((db) => {
    const search = searchLiamKnowledge(db, "Dataverse Council Assurance Power BI");
    const semantic = listSemanticSourceRecords(db).filter((record) => record.sourceType.startsWith("power_platform_"));

    assert.ok(search.results.some((result) => result.sourceReference.startsWith("power_platform_solution:")));
    assert.ok(search.results.some((result) => /Dataverse|Power BI|Council/i.test(`${result.title} ${result.summary}`)));
    assert.ok(semantic.some((record) => record.sourceType === "power_platform_solution"));
    assert.ok(semantic.some((record) => record.sourceType === "power_platform_risk"));
    assert.ok(semantic.every((record) => record.sensitivityCategory === "local_sensitive_business_data"));
  });
});

test("Liam analysis input, frontend hooks and API routes are exposed safely", () => {
  withDatabase((db) => {
    const input = buildLiamAnalysisInput(db, {
      retrievedMemoryContext: {
        records: [{ sourceReference: "memory:liam", summary: "Power Platform memory" }],
        sourceRecordReferences: [{ reference: "memory:liam", label: "Power Platform memory", category: "memory" }],
      },
    });
    const html = readFileSync("index.html", "utf8");
    const app = readFileSync("app.js", "utf8");
    const server = readFileSync("server.js", "utf8");

    assert.equal(input.specialist.name, "Liam");
    assert.equal(input.boundary.sharePointWriteEnabled, false);
    assert.ok(input.solutions.length > 0);
    assert.ok(input.relevantMemory.some((record) => record.sourceReference === "memory:liam"));
    assert.match(html, /id="liam-view"/);
    assert.match(html, /id="liam-agent-identity"/);
    assert.match(app, /renderLiam/);
    assert.match(app, /askLiamAnalysis/);
    assert.match(server, /\/api\/liam\/dashboard/);
    assert.match(server, /\/api\/ai\/liam\/analyse-power-platform/);
    assert.equal(LIAM_READ_ONLY_BOUNDARY.externalWritesEnabled, false);
  });
});
