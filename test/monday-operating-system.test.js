import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  AGENT_BOARD_MODELS,
  MONDAY_OPERATING_BOUNDARY,
  createDeliverable,
  createOperationalDecision,
  createOperationalOpportunity,
  createOperationalRisk,
  createWorkItem,
  getMondayOperatingDashboard,
  listMondayAudit,
  mondayOperatingBriefForDaily,
  recordOutputFeedback,
  searchMondayOperatingSystem,
  syncMeetingFollowupsToWorkItems,
  updateWorkItem,
} from "../monday-operating-system.js";
import { MICROSOFT_SCOPES } from "../microsoft.js";
import { createMeetingRecord, processMeetingTranscript } from "../meeting-intelligence.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-monday-os-"));
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

function pastDate() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function westminsterMeeting() {
  return {
    id: "calendar-monday-os-westminster",
    subject: "Westminster Teams operating review",
    start: { dateTime: "2026-06-08T09:30:00Z" },
    end: { dateTime: "2026-06-08T10:00:00Z" },
    organizer: { emailAddress: { name: "Client Lead", address: "lead@westminster.gov.uk" } },
    attendees: [
      { type: "required", emailAddress: { name: "Patrick King", address: "patrick@example.test" } },
      { type: "required", emailAddress: { name: "Westminster PM", address: "pm@westminster.gov.uk" } },
    ],
    bodyPreview: "Westminster BIM, ISO 19650 and access review.",
    webLink: "https://example.test/calendar/westminster",
  };
}

function transcriptText() {
  return [
    "Action: Patrick to confirm the Westminster COBie owner by Friday.",
    "Decision: Patrick approval is required before any external follow-up is sent.",
    "Risk: confidential access to the BIM folder needs review.",
    "Opportunity to automate the weekly ISO 19650 report.",
    "Client confirmed the summary feedback was useful.",
  ].join(" ");
}

test("creates planned Monday board mappings for every executive specialist without enabling sync writes", () => {
  withDatabase((db) => {
    const dashboard = getMondayOperatingDashboard(db);
    const agentIds = new Set(dashboard.agentBoards.map((agent) => agent.agentId));
    const mappingAgents = new Set(dashboard.boardMappings.map((mapping) => mapping.agentId));

    assert.equal(agentIds.size, AGENT_BOARD_MODELS.length);
    for (const expected of ["alfred", "sarah", "olivia", "westbridge-property-director", "sentinel", "maya", "alex", "ethan", "liam", "emma", "james"]) {
      assert.ok(agentIds.has(expected));
      assert.ok(mappingAgents.has(expected));
    }
    assert.equal(dashboard.syncStatus.every((sync) => sync.writeEnabled === false), true);
    assert.equal(dashboard.syncStatus.every((sync) => sync.readEnabled === false), true);
    assert.equal(dashboard.boundary.mondayWriteEnabled, false);
  });
});

test("supports work item CRUD, source links, audit logging and workload calculation", () => {
  withDatabase((db) => {
    const created = createWorkItem(db, {
      title: "Review Westminster blocked action",
      detail: "Internal review only.",
      ownerAgentId: "sarah",
      businessEntityId: "digitize",
      companyId: "digitize",
      projectName: "Westminster",
      priority: "Critical",
      status: "Blocked",
      dueDate: pastDate(),
      sourceType: "project_intelligence",
      sourceId: "westminster-risk-1",
      sourceReference: "Project Intelligence (project_intelligence:westminster-risk-1)",
    });
    const updated = updateWorkItem(db, created.id, {
      status: "Review",
      blockedReason: "Patrick reviewed the blocker.",
    });
    const dashboard = getMondayOperatingDashboard(db);
    const sarahWorkload = dashboard.agentWorkloads.find((item) => item.agentId === "sarah");
    const audit = listMondayAudit(db);

    assert.equal(updated.status, "Review");
    assert.equal(updated.sourceReference.includes("Project Intelligence"), true);
    assert.ok(sarahWorkload.activeItems >= 1);
    assert.ok(sarahWorkload.priorityItems >= 1);
    assert.equal(typeof sarahWorkload.workloadScore, "number");
    assert.equal(sarahWorkload.healthStatus, "Red");
    assert.ok(sarahWorkload.deliverablesDue >= 0);
    assert.ok(dashboard.workloadMetrics.some((item) => item.agentId === "sarah" && item.healthStatus === "Red"));
    assert.equal(dashboard.metrics.workloadHealth.red >= 1, true);
    assert.equal(audit.some((event) => event.eventType === "work_item_created"), true);
    assert.equal(audit.some((event) => event.eventType === "work_item_updated"), true);
    assert.equal(audit.every((event) => event.executionAttempted === false && event.externalWriteAttempted === false), true);
  });
});

test("stores deliverables, operational risks, opportunities, decisions and feedback with business source references", () => {
  withDatabase((db) => {
    const deliverable = createDeliverable(db, {
      title: "Draft board pack outline",
      ownerAgentId: "olivia",
      businessEntityId: "group",
      priority: "High",
      sourceType: "financial",
      sourceId: "board-report-q1",
      linkedBusinessId: "group",
      linkedMemoryReference: "memory:board-report-q1",
    });
    const risk = createOperationalRisk(db, {
      title: "Forecast dependency risk",
      ownerAgentId: "olivia",
      businessEntityId: "group",
      priority: "High",
      sourceType: "financial",
      sourceId: "risk-1",
    });
    const opportunity = createOperationalOpportunity(db, {
      title: "Automate council reporting",
      ownerAgentId: "sarah",
      businessEntityId: "digitize",
      priority: "Medium",
      sourceType: "sarah",
      sourceId: "opp-1",
    });
    const decision = createOperationalDecision(db, {
      title: "Approve weekly board report structure",
      ownerAgentId: "alfred",
      approvalRequired: true,
      priority: "High",
      sourceType: "executive_briefing",
      sourceId: "decision-1",
    });
    const feedback = recordOutputFeedback(db, {
      agentId: "alfred",
      outputTitle: "Executive briefing",
      rating: "positive",
      recommendationStatus: "unreviewed",
      lessonLearned: "Keep blocked work separate from meeting notes.",
      futureWorkSuggestion: "Add clearer owner names.",
      sourceType: "memory",
      sourceId: "briefing-feedback-1",
    });
    const search = searchMondayOperatingSystem(db, "board");

    assert.equal(deliverable.businessEntityId, "group");
    assert.equal(deliverable.linkedBusinessId, "group");
    assert.equal(deliverable.linkedMemoryReference, "memory:board-report-q1");
    assert.equal(risk.sourceReference.includes("Olivia"), true);
    assert.equal(opportunity.ownerAgentId, "sarah");
    assert.equal(decision.approvalRequired, true);
    assert.equal(feedback.agentId, "alfred");
    assert.ok(search.deliverables.some((item) => item.title === "Draft board pack outline"));
    assert.ok(search.decisions.some((item) => item.title === "Approve weekly board report structure"));
  });
});

test("converts meeting intelligence follow-ups into internal Alfred work records only", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting());
    processMeetingTranscript(db, created.meeting.id, { transcriptText: transcriptText() });
    const result = syncMeetingFollowupsToWorkItems(db);
    const dashboard = getMondayOperatingDashboard(db);
    const followup = dashboard.meetingFollowups.find((item) => /Westminster COBie owner/i.test(item.extractedAction));
    const workItem = dashboard.workItems.find((item) => item.id === followup?.workItemId);

    assert.equal(result.boundary.mondayWriteEnabled, false);
    assert.ok(followup);
    assert.ok(workItem);
    assert.equal(workItem.sourceType, "meeting_action");
    assert.match(workItem.sourceReference, /Meeting Intelligence/);
    assert.equal(dashboard.boundary.externalWritesEnabled, false);
  });
});

test("briefing and semantic memory include Monday Operating System context", () => {
  withDatabase((db) => {
    createWorkItem(db, {
      title: "Resolve blocked KSPF board action",
      detail: "Patrick review required.",
      ownerAgentId: "alfred",
      priority: "High",
      status: "Blocked",
      dueDate: pastDate(),
      sourceType: "executive_briefing",
      sourceId: "blocked-kspf-action",
    });
    createDeliverable(db, {
      title: "KSPF action pack",
      ownerAgentId: "sarah",
      businessEntityId: "digitize",
      priority: "High",
      sourceType: "project_intelligence",
      sourceId: "kspf-pack",
    });
    createOperationalDecision(db, {
      title: "Approve KSPF next action",
      approvalRequired: true,
      priority: "High",
      sourceType: "decision",
      sourceId: "kspf-decision",
    });
    recordOutputFeedback(db, {
      outputTitle: "KSPF briefing",
      lessonLearned: "Source references must stay visible.",
      sourceType: "memory",
      sourceId: "kspf-feedback",
    });
    const brief = mondayOperatingBriefForDaily(db);
    const semanticRecords = listSemanticSourceRecords(db);

    assert.ok(brief.items.some((item) => item.type === "blocked_work"));
    assert.ok(brief.items.some((item) => item.type === "decision_required"));
    assert.ok(semanticRecords.some((record) => record.sourceType === "work_item" && /KSPF/i.test(record.summary)));
    assert.ok(semanticRecords.some((record) => record.sourceType === "deliverable" && /KSPF/i.test(record.summary)));
    assert.ok(semanticRecords.some((record) => record.sourceType === "operational_decision" && /KSPF/i.test(record.summary)));
    assert.ok(semanticRecords.some((record) => record.sourceType === "output_feedback" && /KSPF/i.test(record.summary)));
  });
});

test("frontend, API and executive briefing pipeline expose Monday OS safely", () => {
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../db.js", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(server, /\/api\/monday-os\/dashboard/);
  assert.match(server, /brief\.mondayOperating = mondayOperatingBriefForDaily/);
  assert.match(server, /monday_operating_system/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS workload_metrics/);
  assert.match(app, /renderMondayOperating/);
  assert.match(app, /mondayOperating/);
  assert.match(app, /workloadMetrics/);
  assert.match(html, /id="monday-view"/);
  assert.match(html, /monday-workload-health/);
  assert.match(html, /Internal-only operating mode/);
  assert.match(workflow, /node --check monday-operating-system\.js/);
});

test("Monday OS and Microsoft scopes keep all external write actions disabled", () => {
  const forbiddenScopes = ["Mail.Send", "Calendars.ReadWrite", "Files.ReadWrite", "Sites.ReadWrite.All", "Group.ReadWrite.All"];

  for (const scope of forbiddenScopes) {
    assert.equal(MICROSOFT_SCOPES.includes(scope), false);
  }
  assert.equal(MONDAY_OPERATING_BOUNDARY.mondayWriteEnabled, false);
  assert.equal(MONDAY_OPERATING_BOUNDARY.externalWritesEnabled, false);
  assert.equal(MONDAY_OPERATING_BOUNDARY.autonomousExecutionEnabled, false);
  assert.equal(MONDAY_OPERATING_BOUNDARY.approvalRequiredForFutureWrites, true);
});
