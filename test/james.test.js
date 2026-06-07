import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  JAMES_READ_ONLY_BOUNDARY,
  buildJamesAnalysisInput,
  createProductDecision,
  createProductRisk,
  generateJamesAnalysis,
  getJamesDashboard,
  getJamesProfile,
  jamesBriefingForDaily,
  listJamesAudit,
  searchJamesKnowledge,
} from "../james.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-james-"));
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

test("James profile is active advisory and product seeds are present", () => {
  withDatabase((db) => {
    const profile = getJamesProfile(db);
    const dashboard = getJamesDashboard(db);

    assert.equal(profile.name, "James");
    assert.equal(profile.role, "Product CEO");
    assert.equal(profile.status, "Active");
    assert.equal(profile.reportsTo, "Alfred");
    assert.equal(profile.boundary.codeDeploymentEnabled, false);
    assert.equal(dashboard.boundary.customerOutreachEnabled, false);
    assert.ok(dashboard.ventures.some((venture) => venture.name === "Council Construction Assurance Platform"));
    assert.ok(dashboard.features.some((feature) => /evidence register/i.test(feature.title)));
    assert.ok(dashboard.experiments.some((experiment) => /problem interview/i.test(experiment.title)));
    assert.ok(dashboard.roadmap.some((item) => /MVP scope/i.test(item.title)));
  });
});

test("James dashboard integrates with internal Monday OS without live writes", () => {
  withDatabase((db) => {
    const dashboard = getJamesDashboard(db);

    assert.equal(dashboard.boundary.externalWritesEnabled, false);
    assert.equal(dashboard.monday.boundary.mondayWriteEnabled, false);
    assert.ok(dashboard.metrics.openRisks >= 1);
    assert.ok(dashboard.monday.workItems.some((item) => item.ownerAgentId === "james"));
    assert.ok(dashboard.monday.deliverables.some((item) => item.sourceType === "product_roadmap_item"));
    assert.ok(dashboard.monday.decisions.some((item) => item.sourceType === "product_decision"));
  });
});

test("James analysis, briefing and manual records remain recommendation-only", () => {
  withDatabase((db) => {
    const risk = createProductRisk(db, {
      title: "Pricing not validated",
      detail: "Pricing should be tested before packaging the SaaS offer.",
      severity: "medium",
      recommendedAction: "Capture pricing assumptions and buyer feedback.",
      userAction: "test:james:risk",
    });
    const decision = createProductDecision(db, {
      title: "Approve pricing hypothesis",
      detail: "Patrick should approve the first pricing hypothesis before any market action.",
      priority: "high",
      userAction: "test:james:decision",
    });
    const analysis = generateJamesAnalysis(db, { userAction: "test:james:analysis" });
    const brief = jamesBriefingForDaily(db);
    const audit = listJamesAudit(db);

    assert.equal(risk.sourceType, "manual");
    assert.equal(decision.approvalRequired, true);
    assert.equal(analysis.executionAttempted, false);
    assert.deepEqual(analysis.executedActions, []);
    assert.equal(analysis.boundary.productPublishingEnabled, false);
    assert.ok(analysis.assumptions.some((item) => /No product code/.test(item)));
    assert.ok(brief.items.some((item) => item.sourceReference.startsWith("product_risk:")));
    assert.ok(audit.some((event) => event.eventType === "product_analysis" && event.executionAttempted === false));
  });
});

test("James search and semantic source records link back to local product IDs", () => {
  withDatabase((db) => {
    const result = searchJamesKnowledge(db, "Council Assurance Platform MVP validation");
    const semantic = listSemanticSourceRecords(db).filter((record) => record.sourceType.startsWith("product_"));

    assert.ok(result.results.some((item) => item.sourceReference.startsWith("product_venture:")));
    assert.ok(result.results.some((item) => /Council/.test(item.title)));
    assert.ok(semantic.some((record) => record.sourceType === "product_venture"));
    assert.ok(semantic.every((record) => record.sensitivityCategory === "local_sensitive_business_data"));
  });
});

test("James analysis input, frontend hooks and API routes are exposed safely", () => {
  withDatabase((db) => {
    const input = buildJamesAnalysisInput(db, {
      retrievedMemoryContext: {
        records: [{ sourceReference: "memory:1", summary: "Product memory", sensitivityLabel: "local_sensitive_business_data" }],
        sourceRecordReferences: [{ reference: "memory:1", label: "Product memory", category: "memory" }],
      },
    });
    const html = readFileSync("index.html", "utf8");
    const app = readFileSync("app.js", "utf8");
    const server = readFileSync("server.js", "utf8");
    const voice = readFileSync("voice.js", "utf8");

    assert.equal(input.specialist.name, "James");
    assert.equal(input.boundary.customerOutreachEnabled, false);
    assert.ok(input.relevantMemory.some((record) => record.sourceReference === "memory:1"));
    assert.match(html, /id="james-view"/);
    assert.match(html, /id="james-agent-identity"/);
    assert.match(app, /renderJames/);
    assert.match(app, /\/api\/james\/dashboard/);
    assert.match(server, /\/api\/ai\/james\/analyse-product/);
    assert.match(voice, /james_product_review/);
    assert.equal(JAMES_READ_ONLY_BOUNDARY.externalWritesEnabled, false);
  });
});
