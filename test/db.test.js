import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createDatabase,
  createResource,
  getDashboardData,
  getMorningBrief,
  listResource,
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
