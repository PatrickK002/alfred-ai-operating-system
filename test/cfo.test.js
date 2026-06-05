import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import test from "node:test";
import {
  calculateForecast,
  generateBoardReport,
  generateOliviaAnalysis,
  getFinancialDashboardData,
  importOrderBookSheets,
  importOrderBookWorkbook,
  listFinancialAudit,
  saveMondayFinancialSummaries,
} from "../financial.js";
import { mapMondayItemToInvoiceSummary, MondayFinanceClient, MONDAY_API_URL } from "../monday-finance.js";
import { createApprovalRequest, createDatabase, getApprovalRequest } from "../db.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-cfo-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  try {
    return run(db);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function cfoWorkbookRows() {
  return [{
    name: "FY2026-27",
    rows: [
      { __rowNumber: 2, Client: "Westminster", Project: "Assurance Review", Service: "BIM", Status: "Secured", Amount: "100000", Probability: "100%", Month: "Apr" },
      { __rowNumber: 3, Client: "RBKC", Project: "COBie Validation", Service: "Information Management", Status: "Pipeline", Amount: "50000", Probability: "50%", Month: "May" },
      { __rowNumber: 4, Client: "RBKC", Project: "COBie Validation", Service: "Information Management", Status: "Pipeline", Amount: "50000", Probability: "50%", Month: "May" },
      { __rowNumber: 5, Client: "", Project: "Missing client", Service: "BIM", Status: "Pipeline", Amount: "25000", Probability: "25%" },
    ],
  }];
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const compressed = deflateRawSync(data);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    local.push(localHeader, nameBuffer, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, eocd]);
}

function minimalXlsxBase64() {
  const sheet = `
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>
        <row r="1"><c r="A1" t="inlineStr"><is><t>Client</t></is></c><c r="B1" t="inlineStr"><is><t>Project</t></is></c><c r="C1" t="inlineStr"><is><t>Status</t></is></c><c r="D1" t="inlineStr"><is><t>Amount</t></is></c><c r="E1" t="inlineStr"><is><t>Probability</t></is></c></row>
        <row r="2"><c r="A2" t="inlineStr"><is><t>Westminster</t></is></c><c r="B2" t="inlineStr"><is><t>Order book</t></is></c><c r="C2" t="inlineStr"><is><t>Secured</t></is></c><c r="D2"><v>1000</v></c><c r="E2"><v>1</v></c></row>
      </sheetData>
    </worksheet>
  `;
  const workbook = `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="FY2026-27" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
  return zip({
    "xl/workbook.xml": workbook,
    "xl/_rels/workbook.xml.rels": rels,
    "xl/worksheets/sheet1.xml": sheet,
  }).toString("base64");
}

test("forecast calculations separate secured, pipeline and weighted revenue", () => {
  const forecast = calculateForecast([
    { entryType: "secured", amountGbp: 100000, weightedAmountGbp: 100000, forecastQuarter: "Q1", financialYear: "FY2026-27", serviceLine: "BIM" },
    { entryType: "pipeline", amountGbp: 50000, weightedAmountGbp: 25000, forecastQuarter: "Q1", financialYear: "FY2026-27", serviceLine: "IM" },
  ]);

  assert.equal(forecast.securedRevenue, 100000);
  assert.equal(forecast.pipelineRevenue, 50000);
  assert.equal(forecast.weightedForecastRevenue, 125000);
  assert.equal(forecast.bestCase, 150000);
  assert.equal(forecast.worstCase, 112500);
});

test("imports Excel order book sheets, validates rows and flags duplicates", () => {
  withDatabase((db) => {
    const result = importOrderBookSheets(db, { fileName: "Digitize Order Book.xlsx", sheets: cfoWorkbookRows() });
    const dashboard = getFinancialDashboardData(db);

    assert.equal(result.rowsTotal, 4);
    assert.equal(result.rowsImported, 3);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.validationErrors.length, 1);
    assert.equal(dashboard.metrics.securedRevenue, 100000);
    assert.equal(dashboard.metrics.weightedForecastRevenue, 150000);
  });
});

test("parses a minimal XLSX workbook import", () => {
  withDatabase((db) => {
    const result = importOrderBookWorkbook(db, {
      fileName: "minimal-order-book.xlsx",
      dataBase64: minimalXlsxBase64(),
    });

    assert.equal(result.rowsImported, 1);
    assert.equal(getFinancialDashboardData(db).metrics.securedRevenue, 1000);
  });
});

test("re-import detects changed rows and requires overwrite approval", () => {
  withDatabase((db) => {
    importOrderBookSheets(db, { fileName: "Order Book.xlsx", sheets: cfoWorkbookRows() });
    const changed = cfoWorkbookRows();
    changed[0].rows[0].Amount = "125000";
    const blocked = importOrderBookSheets(db, { fileName: "Order Book.xlsx", sheets: changed });
    assert.equal(blocked.approvalRequired, true);
    assert.equal(getFinancialDashboardData(db).metrics.securedRevenue, 100000);

    const approved = importOrderBookSheets(db, { fileName: "Order Book.xlsx", sheets: changed, overwriteApproved: true });
    assert.equal(approved.rowsUpdated > 0, true);
    assert.equal(getFinancialDashboardData(db).metrics.securedRevenue, 125000);
  });
});

test("Monday connector maps invoice summaries and uses read-only queries", async () => {
  const calls = [];
  const client = new MondayFinanceClient({
    apiToken: "test-token",
    boardIds: ["123"],
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body), headers: options.headers });
      assert.doesNotMatch(JSON.parse(options.body).query, /mutation/i);
      return new Response(JSON.stringify({
        data: {
          boards: [{
            id: "123",
            name: "Invoices Issued",
            items_page: {
              cursor: null,
              items: [{
                id: "i1",
                name: "INV-001",
                updated_at: "2026-06-01",
                group: { title: "Westminster" },
                column_values: [
                  { id: "amount", text: "10000", column: { title: "Amount" } },
                  { id: "status", text: "Overdue", column: { title: "Status" } },
                  { id: "due", text: "2026-05-01", column: { title: "Due Date" } },
                  { id: "project", text: "Assurance Review", column: { title: "Project" } },
                ],
              }],
            },
          }],
        },
      }));
    },
  });

  const result = await client.fetchFinancialSummaries();
  assert.equal(calls[0].url, MONDAY_API_URL);
  assert.equal(calls[0].headers.Authorization, "test-token");
  assert.equal(result.invoiceSummaries[0].status, "overdue");
  assert.equal(result.invoiceSummaries[0].amountGbp, 10000);
});

test("Monday summaries feed debtor dashboard without external writes", () => {
  withDatabase((db) => {
    saveMondayFinancialSummaries(db, {
      invoiceSummaries: [mapMondayItemToInvoiceSummary({
        id: "i1",
        name: "INV-001",
        group: { title: "Westminster" },
        column_values: [
          { text: "10000", column: { title: "Amount" } },
          { text: "Overdue", column: { title: "Status" } },
          { text: "2026-05-01", column: { title: "Due Date" } },
        ],
      })],
    });
    const dashboard = getFinancialDashboardData(db);

    assert.equal(dashboard.metrics.outstandingDebtors, 10000);
    assert.equal(dashboard.metrics.overdueDebtors, 10000);
    assert.equal(dashboard.boundary.paymentCapability, false);
    assert.equal(listFinancialAudit(db)[0].eventType, "monday_financial_refresh");
  });
});

test("board report generation and Olivia analysis remain recommendation-only", () => {
  withDatabase((db) => {
    importOrderBookSheets(db, { fileName: "Order Book.xlsx", sheets: cfoWorkbookRows() });
    const report = generateBoardReport(db, { quarter: "Q1" });
    const analysis = generateOliviaAnalysis(db);

    assert.match(report.markdown, /Executive Summary/);
    assert.match(report.markdown, /No invoices, payments, accounting records or external systems were modified/);
    assert.equal(analysis.boundary.invoiceCapability, false);
    assert.equal(analysis.recommendedActions.every((item) => item.executionAvailable === false), true);
    assert.ok(listFinancialAudit(db).some((event) => event.eventType === "board_report_generated"));
  });
});

test("approval integration records financial action review without execution", () => {
  withDatabase((db) => {
    const request = createApprovalRequest(db, {
      actionType: "external_task",
      targetSystem: "Finance",
      title: "Review debtor plan",
      description: "Human review of debtor follow-up plan. No chase action executed.",
      payload: { sourceHash: createHash("sha256").update("debtor-plan").digest("hex") },
    });
    const saved = getApprovalRequest(db, request.id);

    assert.equal(saved.execution.available, false);
    assert.match(saved.events[0].note, /no external action executed/i);
  });
});
