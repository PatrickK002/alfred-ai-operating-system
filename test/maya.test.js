import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  MAYA_READ_ONLY_BOUNDARY,
  createMarketingCampaign,
  createMarketingContentItem,
  generateMayaAnalysis,
  getMayaDashboard,
  getMayaProfile,
  listMayaAudit,
  mayaBriefingForDaily,
  recordMarketingFeedback,
  searchMayaKnowledge,
} from "../maya.js";
import { getMondayOperatingDashboard } from "../monday-operating-system.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-maya-"));
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

test("Maya profile is active advisory and marketing seeds are present", () => {
  withDatabase((db) => {
    const profile = getMayaProfile(db);
    const dashboard = getMayaDashboard(db);

    assert.equal(profile.name, "Maya");
    assert.equal(profile.status, "Active");
    assert.equal(profile.reportsTo, "Alfred");
    assert.equal(profile.boundary.socialPostingEnabled, false);
    assert.equal(profile.boundary.externalPublishingEnabled, false);
    assert.equal(dashboard.channels.length, 3);
    assert.equal(dashboard.campaigns.length, 1);
    assert.equal(dashboard.contentItems.length, 3);
    assert.equal(dashboard.opportunities.length, 2);
    assert.equal(dashboard.boundary.autonomousExecutionEnabled, false);
    assert.equal(dashboard.channels.every((channel) => channel.publishingEnabled === false), true);
    assert.equal(dashboard.campaigns.every((campaign) => campaign.externalPublishingEnabled === false), true);
  });
});

test("Maya dashboard integrates with Monday OS workload, deliverables, opportunities and feedback", () => {
  withDatabase((db) => {
    const content = createMarketingContentItem(db, {
      channelId: "linkedin",
      title: "Council assurance thought leadership",
      contentType: "thought_leadership_post",
      summary: "Explain the Council Assurance Platform without naming confidential client details.",
      priority: "High",
      plannedDate: "2026-06-20",
    });
    const campaign = createMarketingCampaign(db, {
      name: "Council Assurance authority lane",
      objective: "Develop a safe thought leadership lane around public-sector assurance.",
      channels: ["linkedin", "youtube"],
      successMetrics: ["Approved narrative", "Reusable post framework"],
    });
    const feedback = recordMarketingFeedback(db, {
      contentItemId: content.id,
      campaignId: campaign.id,
      feedback: "Sharper distinction needed between confirmed Alfred features and planned future capabilities.",
      rating: "useful",
      futureWorkSuggestion: "Keep advisory-only boundary visible in content.",
    });
    const dashboard = getMayaDashboard(db);
    const monday = getMondayOperatingDashboard(db);

    assert.ok(dashboard.monday.workItems.some((item) => item.sourceType === "marketing_content" && String(item.sourceId) === String(content.id)));
    assert.ok(dashboard.monday.deliverables.some((item) => item.sourceType === "marketing_campaign" && String(item.sourceId) === String(campaign.id)));
    assert.ok(dashboard.monday.opportunities.some((item) => item.sourceType === "marketing_opportunity"));
    assert.ok(dashboard.monday.feedback.some((item) => item.sourceType === "marketing_feedback" && String(item.sourceId) === String(feedback.id)));
    assert.ok(monday.agentWorkloads.some((item) => item.agentId === "maya" && item.activeItems >= 1));
    assert.equal(monday.boundary.mondayWriteEnabled, false);
  });
});

test("Maya analysis and daily briefing are recommendation-only and audited", () => {
  withDatabase((db) => {
    const analysis = generateMayaAnalysis(db, {
      topic: "Alfred executive operating system",
      channelId: "linkedin",
      userAction: "test:maya-analysis",
    });
    const briefing = mayaBriefingForDaily(db);
    const audit = listMayaAudit(db);

    assert.equal(analysis.specialist.name, "Maya");
    assert.equal(analysis.boundary.socialPostingEnabled, false);
    assert.equal(analysis.boundary.outboundMessagesEnabled, false);
    assert.equal(analysis.boundary.mondayWriteEnabled, false);
    assert.equal(analysis.assumptions.some((item) => /not posted/i.test(item)), true);
    assert.ok(analysis.sourceRecordReferences.some((reference) => reference.startsWith("marketing_channel:")));
    assert.ok(briefing.items.length >= 1);
    assert.equal(briefing.boundary.externalPublishingEnabled, false);
    assert.ok(audit.some((event) => event.eventType === "marketing_analysis" && event.executionAttempted === false && event.externalWriteAttempted === false));
  });
});

test("Maya search and semantic source records link back to marketing IDs", () => {
  withDatabase((db) => {
    const search = searchMayaKnowledge(db, "LinkedIn Alfred");
    const sourceRecords = listSemanticSourceRecords(db);

    assert.ok(search.contentItems.some((item) => /Alfred/i.test(item.title) || /Alfred/i.test(item.summary)));
    assert.ok(search.campaigns.some((campaign) => /Alfred/i.test(campaign.name)));
    assert.ok(sourceRecords.some((record) => record.sourceType === "marketing_content" && record.sourceId));
    assert.ok(sourceRecords.some((record) => record.sourceType === "marketing_campaign" && record.summary.includes("No social post")));
    assert.ok(sourceRecords.every((record) => record.sensitivityCategory === "local_sensitive_business_data"));
  });
});

test("Maya frontend, API routes and avatar metadata are exposed safely", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("app.js", "utf8");
  const server = readFileSync("server.js", "utf8");
  const avatars = readFileSync("agent-avatars.js", "utf8");

  assert.match(html, /data-view="maya"/);
  assert.match(html, /id="maya-view"/);
  assert.match(html, /id="maya-agent-identity"/);
  assert.match(app, /renderMaya/);
  assert.match(app, /askMayaAnalysis/);
  assert.match(server, /\/api\/maya\/dashboard/);
  assert.match(server, /\/api\/ai\/maya\/analyse-marketing/);
  assert.match(avatars, /id: "maya"[\s\S]*status: "Active advisory"/);
  assert.equal(MAYA_READ_ONLY_BOUNDARY.socialPostingEnabled, false);
  assert.equal(MAYA_READ_ONLY_BOUNDARY.microsoftWritePermissions, false);
  assert.equal(MAYA_READ_ONLY_BOUNDARY.externalPublishingEnabled, false);
});
