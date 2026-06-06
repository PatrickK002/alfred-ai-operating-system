import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase } from "../db.js";
import {
  MONDAY_READONLY_OPERATING_BOUNDARY,
  getMondayOperatingDashboard,
  listMondayAudit,
  listMondayOperatingCollection,
  syncMondayReadOnlyOperatingItems,
} from "../monday-operating-system.js";
import {
  MondayOperatingReadClient,
  mapMondayItemToOperatingRecord,
} from "../monday-readonly-operating.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-monday-readonly-"));
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

function mondayBoardItem(overrides = {}) {
  return {
    id: "monday-001",
    name: "Westminster COBie review",
    url: "https://patrick.monday.com/boards/123/pulses/monday-001",
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-06T10:30:00Z",
    group: { id: "topics", title: "Project reviews" },
    column_values: [
      { id: "status", text: "In progress", column: { title: "Status" } },
      { id: "priority", text: "High", column: { title: "Priority" } },
      { id: "due", text: "2026-06-12", column: { title: "Due date" } },
      { id: "project", text: "Westminster", column: { title: "Project" } },
      { id: "client", text: "Westminster City Council", column: { title: "Client" } },
      { id: "detail", text: "Review COBie risk before the next client update.", column: { title: "Detail" } },
    ],
    ...overrides,
  };
}

test("maps Monday board items into read-only Alfred operating records", () => {
  const record = mapMondayItemToOperatingRecord(mondayBoardItem(), {
    boardId: "123",
    boardName: "Sarah - Project Reviews",
  });

  assert.equal(record.sourceType, "monday_readonly");
  assert.equal(record.boardId, "123");
  assert.equal(record.externalId, "monday-001");
  assert.equal(record.title, "Westminster COBie review");
  assert.equal(record.ownerAgentId, "sarah");
  assert.equal(record.businessEntityId, "digitize");
  assert.equal(record.companyId, "digitize");
  assert.equal(record.projectName, "Westminster");
  assert.equal(record.clientName, "Westminster City Council");
  assert.equal(record.priority, "High");
  assert.equal(record.status, "In Progress");
  assert.equal(record.dueDate, "2026-06-12");
  assert.equal(record.rawSummary.readOnly, true);
});

test("Monday operating client performs read queries and blocks mutations", async () => {
  const requests = [];
  const client = new MondayOperatingReadClient({
    apiToken: "test-token",
    boardIds: ["123"],
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            boards: [{
              id: "123",
              name: "Sarah - Project Reviews",
              items_page: {
                cursor: null,
                items: [mondayBoardItem()],
              },
            }],
          },
        }),
      };
    },
  });

  const fetched = await client.fetchOperatingItems();
  assert.equal(fetched.itemsRead, 1);
  assert.equal(fetched.items[0].sourceType, "monday_readonly");
  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /query ReadOperatingBoard/);
  assert.doesNotMatch(requests[0].query, /\bmutation\b/i);

  await assert.rejects(
    () => client.request(`${"mut"}ation { ${"create"}_item { id } }`),
    /read-only/,
  );
});

test("sync imports and updates Monday items as local work records without enabling writes", () => {
  withDatabase((db) => {
    const firstRecord = mapMondayItemToOperatingRecord(mondayBoardItem(), {
      boardId: "123",
      boardName: "Sarah - Project Reviews",
    });
    const firstResult = syncMondayReadOnlyOperatingItems(db, {
      items: [firstRecord],
      userAction: "test:monday-readonly:first-sync",
    });
    const updatedRecord = {
      ...firstRecord,
      status: "Blocked",
      detail: "Review COBie risk before the next client update. Patrick decision needed.",
    };
    const secondResult = syncMondayReadOnlyOperatingItems(db, {
      items: [updatedRecord],
      userAction: "test:monday-readonly:second-sync",
    });
    const workItems = listMondayOperatingCollection(db, "work-items", 20).filter((item) => item.sourceType === "monday_readonly");
    const syncStatus = listMondayOperatingCollection(db, "sync-status", 100).filter((item) => item.boardKind === "readonly_123");
    const dashboard = getMondayOperatingDashboard(db);
    const audit = listMondayAudit(db, 20);

    assert.equal(firstResult.importedRecords, 1);
    assert.equal(firstResult.updatedRecords, 0);
    assert.equal(secondResult.importedRecords, 0);
    assert.equal(secondResult.updatedRecords, 1);
    assert.equal(workItems.length, 1);
    assert.equal(workItems[0].status, "Blocked");
    assert.equal(workItems[0].mondayItemId, "monday-001");
    assert.equal(workItems[0].metadata.readOnly, true);
    assert.equal(workItems[0].metadata.writesEnabled, false);
    assert.equal(syncStatus.length, 1);
    assert.equal(syncStatus[0].readEnabled, true);
    assert.equal(syncStatus[0].writeEnabled, false);
    assert.equal(dashboard.metrics.readEnabledBoards, 1);
    assert.equal(dashboard.boundary.mondayReadEnabled, true);
    assert.equal(dashboard.boundary.mondayWriteEnabled, false);
    assert.ok(audit.some((event) => event.eventType === "monday_readonly_work_item_imported"));
    assert.ok(audit.some((event) => event.eventType === "monday_readonly_work_item_updated"));
    assert.equal(audit.every((event) => event.executionAttempted === false && event.externalWriteAttempted === false), true);
  });
});

test("frontend, API, docs and CI expose Monday read-only import safely", () => {
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const docs = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  assert.match(server, /\/api\/monday-os\/monday-readonly\/status/);
  assert.match(server, /\/api\/monday-os\/monday-readonly\/refresh/);
  assert.match(app, /refreshMondayReadOnly/);
  assert.match(html, /refresh-monday-readonly/);
  assert.match(envExample, /MONDAY_OPERATING_BOARD_IDS=/);
  assert.match(workflow, /node --check monday-readonly-operating\.js/);
  assert.match(docs, /Monday\.com Operating Read-Only Import/);
  assert.equal(MONDAY_READONLY_OPERATING_BOUNDARY.mondayWriteEnabled, false);
  assert.equal(MONDAY_READONLY_OPERATING_BOUNDARY.externalWritesEnabled, false);
  assert.equal(MONDAY_READONLY_OPERATING_BOUNDARY.autonomousExecutionEnabled, false);
});
