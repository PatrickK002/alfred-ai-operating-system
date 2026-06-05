import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createApprovalRequest,
  createDatabase,
  createResource,
  getApprovalRequest,
  getApprovalSummary,
  getBriefing,
  getDashboardData,
  getMorningBrief,
  listResource,
  listBriefings,
  saveBriefing,
  saveBriefingFeedback,
  reviewApprovalRequest,
  updateResource,
} from "../db.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-core-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  try {
    return run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

test("seeds the Phase 1 operating registry", () => {
  withDatabase((db) => {
    const dashboard = getDashboardData(db);

    assert.equal(dashboard.companies.length, 4);
    assert.equal(dashboard.clients.length, 4);
    assert.equal(dashboard.projects.length, 1);
    assert.equal(dashboard.agents.length, 4);
    assert.equal(dashboard.integrations.length, 9);
    assert.equal(dashboard.operatingItems.length, 5);
    assert.equal(dashboard.integrations.find((item) => item.id === "anthropic").status, "Planned");
  });
});

test("creates and updates persistent operating records", () => {
  withDatabase((db) => {
    const action = createResource(db, "actions", {
      companyId: "digitize",
      title: "Review new delivery risk",
      detail: "Prepare the commercial response.",
      priority: "high",
      due: "Today",
      status: "open",
    });

    assert.equal(action.id, 2);
    assert.equal(listResource(db, "actions").length, 2);

    const completed = updateResource(db, "actions", action.id, { status: "complete" });
    assert.equal(completed.status, "complete");

    const dashboard = getDashboardData(db);
    assert.equal(dashboard.actions.find((item) => item.id === action.id).status, "complete");
  });
});

test("stores memories and generates the brief from database state", () => {
  withDatabase((db) => {
    createResource(db, "memories", {
      type: "lesson",
      title: "SQLite foundation",
      detail: "Operating records now survive server restarts.",
      companyId: "digitize",
    });
    createResource(db, "risks", {
      companyId: "product",
      title: "Validation scope",
      detail: "MVP scope needs confirmation.",
      priority: "medium",
      due: "This week",
      status: "open",
    });

    const brief = getMorningBrief(db);

    assert.equal(listResource(db, "memories").length, 4);
    assert.equal(brief.summary.risks, 2);
    assert.equal(brief.summary.agentsPlanned, 4);
    assert.equal(brief.meetings.available, false);
    assert.match(brief.meetings.message, /not connected/i);
    assert.equal(brief.source, "backend");
  });
});

test("stores briefing history and feedback", () => {
  withDatabase((db) => {
    const saved = saveBriefing(db, {
      generatedAt: "2026-06-05T09:00:00.000Z",
      source: "backend",
      summary: { totalOpen: 5, priorityEmails: 2 },
      actions: [],
    });
    saveBriefingFeedback(db, saved.id, { rating: "useful", note: "Good priorities." });

    const history = listBriefings(db);
    const briefing = getBriefing(db, saved.id);

    assert.equal(history.length, 1);
    assert.equal(history[0].feedback.useful, 1);
    assert.equal(briefing.snapshot.summary.priorityEmails, 2);
  });
});

test("records explicit approval decisions without enabling execution", () => {
  withDatabase((db) => {
    const request = createApprovalRequest(db, {
      actionType: "send_email",
      targetSystem: "Microsoft Outlook",
      title: "Send Westminster follow-up",
      description: "Send the reviewed project follow-up to the client.",
      riskLevel: "high",
      requestedBy: "Alfred",
      payload: { recipient: "client@example.com" },
    });

    assert.equal(request.status, "pending");
    assert.equal(request.events[0].eventType, "requested");
    assert.equal(request.execution.available, false);
    assert.match(request.requestedAt, /T.*Z$/);

    const approved = reviewApprovalRequest(db, request.id, "approved", {
      actor: "Patrick King",
      note: "Content reviewed.",
    });

    assert.equal(approved.status, "approved");
    assert.equal(approved.reviewedBy, "Patrick King");
    assert.equal(approved.events.length, 2);
    assert.equal(approved.events[1].eventType, "approved");
    assert.equal(approved.execution.available, false);
    assert.equal(getApprovalSummary(db).approved, 1);
    assert.equal(getApprovalRequest(db, request.id).payload.recipient, "client@example.com");
  });
});

test("prevents an approval request from being decided twice", () => {
  withDatabase((db) => {
    const request = createApprovalRequest(db, {
      actionType: "calendar_change",
      targetSystem: "Outlook Calendar",
      title: "Move client review",
      description: "Move the review meeting by 30 minutes.",
    });
    reviewApprovalRequest(db, request.id, "rejected", { actor: "Patrick King" });

    assert.throws(
      () => reviewApprovalRequest(db, request.id, "approved", { actor: "Patrick King" }),
      (error) => error.statusCode === 409 && /already rejected/.test(error.message),
    );
  });
});
