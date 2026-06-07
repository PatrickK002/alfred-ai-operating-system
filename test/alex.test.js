import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  ALEX_READ_ONLY_BOUNDARY,
  alexBriefingForDaily,
  createGrowthLead,
  createGrowthOpportunity,
  generateAlexAnalysis,
  getAlexDashboard,
  getAlexProfile,
  listAlexAudit,
  recordGrowthFeedback,
  searchAlexKnowledge,
} from "../alex.js";
import { getMondayOperatingDashboard } from "../monday-operating-system.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-alex-"));
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

test("Alex profile is active advisory and growth seeds are present", () => {
  withDatabase((db) => {
    const profile = getAlexProfile(db);
    const dashboard = getAlexDashboard(db);

    assert.equal(profile.name, "Alex");
    assert.equal(profile.status, "Active");
    assert.equal(profile.reportsTo, "Alfred");
    assert.equal(profile.boundary.outboundMessagesEnabled, false);
    assert.equal(profile.boundary.crmWriteEnabled, false);
    assert.equal(dashboard.channels.length, 4);
    assert.equal(dashboard.leads.length, 2);
    assert.equal(dashboard.opportunities.length, 2);
    assert.equal(dashboard.partnerships.length, 1);
    assert.equal(dashboard.strategies.length, 1);
    assert.equal(dashboard.boundary.autonomousExecutionEnabled, false);
    assert.equal(dashboard.channels.every((channel) => channel.outboundEnabled === false && channel.crmWriteEnabled === false), true);
  });
});

test("Alex dashboard integrates with Monday OS workload, opportunities, deliverables and feedback", () => {
  withDatabase((db) => {
    const lead = createGrowthLead(db, {
      title: "Digitize partnership lead",
      organisationName: "Public sector partner",
      sourceChannelId: "partnerships",
      estimatedValueGbp: 80000,
      probability: 50,
      strategicFit: 80,
      qualificationNotes: "Potential channel partner. Do not contact until Patrick approves.",
      recommendedNextStep: "Prepare internal qualification notes only.",
    });
    const opportunity = createGrowthOpportunity(db, {
      title: "Council Assurance Platform sales validation",
      targetMarket: "Council construction assurance teams",
      estimatedValueGbp: 150000,
      probability: 40,
      strategicFit: 90,
      businessImpact: "Could validate SaaS demand.",
      recommendedAction: "Define validation criteria before any outreach.",
    });
    const feedback = recordGrowthFeedback(db, {
      relatedType: "growth_analysis",
      relatedId: opportunity.id,
      feedback: "Scoring should separate confirmed pipeline from assumptions.",
      rating: "useful",
      futureWorkSuggestion: "Keep CRM write boundary visible.",
    });
    const dashboard = getAlexDashboard(db);
    const monday = getMondayOperatingDashboard(db);

    assert.ok(dashboard.monday.workItems.some((item) => item.sourceType === "growth_lead" && String(item.sourceId) === String(lead.id)));
    assert.ok(dashboard.monday.opportunities.some((item) => item.sourceType === "growth_opportunity" && String(item.sourceId) === String(opportunity.id)));
    assert.ok(dashboard.monday.deliverables.some((item) => item.sourceType === "growth_partnership"));
    assert.ok(dashboard.monday.feedback.some((item) => item.sourceType === "growth_feedback" && String(item.sourceId) === String(feedback.id)));
    assert.ok(monday.agentWorkloads.some((item) => item.agentId === "alex" && item.activeItems >= 1));
    assert.equal(monday.boundary.mondayWriteEnabled, false);
  });
});

test("Alex analysis and daily briefing are recommendation-only and audited", () => {
  withDatabase((db) => {
    const analysis = generateAlexAnalysis(db, {
      topic: "Council Assurance Platform pipeline",
      userAction: "test:alex-analysis",
    });
    const briefing = alexBriefingForDaily(db);
    const dashboard = getAlexDashboard(db);
    const audit = listAlexAudit(db);

    assert.equal(analysis.specialist.name, "Alex");
    assert.equal(analysis.boundary.outboundMessagesEnabled, false);
    assert.equal(analysis.boundary.crmWriteEnabled, false);
    assert.equal(analysis.boundary.mondayWriteEnabled, false);
    assert.equal(analysis.assumptions.some((item) => /No outbound/i.test(item)), true);
    assert.ok(analysis.sourceRecordReferences.some((reference) => reference.startsWith("growth_opportunity:")));
    assert.ok(briefing.items.length >= 1);
    assert.equal(briefing.boundary.outboundMessagesEnabled, false);
    assert.ok(dashboard.metrics.weightedPipeline > 0);
    assert.ok(audit.some((event) => event.eventType === "growth_analysis" && event.executionAttempted === false && event.externalWriteAttempted === false));
  });
});

test("Alex search and semantic source records link back to growth IDs", () => {
  withDatabase((db) => {
    const search = searchAlexKnowledge(db, "council pipeline");
    const sourceRecords = listSemanticSourceRecords(db).filter((record) => String(record.sourceType).startsWith("growth_"));

    assert.ok(search.opportunities.some((item) => /Council/i.test(item.title) || /Council/i.test(item.detail)));
    assert.ok(search.leads.some((lead) => /Council/i.test(lead.title) || /Council/i.test(lead.organisationName)));
    assert.ok(sourceRecords.some((record) => record.sourceType === "growth_lead" && record.sourceId));
    assert.ok(sourceRecords.some((record) => record.sourceType === "growth_opportunity" && /No outbound message/i.test(record.summary)));
    assert.equal(sourceRecords.every((record) => record.sensitivityCategory === "local_sensitive_business_data"), true);
  });
});

test("Alex frontend, API routes and avatar metadata are exposed safely", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("app.js", "utf8");
  const server = readFileSync("server.js", "utf8");
  const avatars = readFileSync("agent-avatars.js", "utf8");

  assert.match(html, /data-view="alex"/);
  assert.match(html, /id="alex-view"/);
  assert.match(html, /id="alex-agent-identity"/);
  assert.match(app, /renderAlex/);
  assert.match(app, /askAlexAnalysis/);
  assert.match(server, /\/api\/alex\/dashboard/);
  assert.match(server, /\/api\/ai\/alex\/analyse-growth/);
  assert.match(avatars, /id: "alex"[\s\S]*status: "Active advisory"/);
  assert.equal(ALEX_READ_ONLY_BOUNDARY.outboundMessagesEnabled, false);
  assert.equal(ALEX_READ_ONLY_BOUNDARY.crmWriteEnabled, false);
  assert.equal(ALEX_READ_ONLY_BOUNDARY.externalWritesEnabled, false);
});
