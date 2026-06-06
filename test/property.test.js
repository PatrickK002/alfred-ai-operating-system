import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createDatabase,
  getDashboardData,
  listSemanticSourceRecords,
} from "../db.js";
import {
  PROPERTY_READ_ONLY_BOUNDARY,
  calculateDealAnalysis,
  createPropertyOpportunity,
  getPropertyDashboardData,
  listPropertyAudit,
  listPropertyDueDiligence,
  listPropertyMemory,
  runWestbridgeRules,
  savePropertyAnalysis,
  searchPropertyKnowledge,
  updatePropertyOpportunity,
  upsertDueDiligenceItem,
  westbridgeBriefingForDaily,
} from "../property.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-property-"));
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

test("Westbridge is seeded as a first-class business with an advisory director", () => {
  withDatabase((db) => {
    const dashboard = getDashboardData(db);
    const property = getPropertyDashboardData(db);

    assert.ok(dashboard.companies.some((company) => company.id === "westbridge"));
    assert.ok(dashboard.agents.some((agent) => agent.id === "westbridge-property-director"));
    assert.equal(property.business.name, "Westbridge Property Group");
    assert.equal(property.director.role, "AI Investment Director");
    assert.equal(property.boundary.purchasesEnabled, false);
    assert.equal(property.metrics.targetMonthlyCashflow, 10000);
    assert.ok(property.opportunities.some((opportunity) => opportunity.title === "Garage block acquisition search"));
  });
});

test("property CRUD preserves pipeline stages, due diligence and audit records", () => {
  withDatabase((db) => {
    const opportunity = createPropertyOpportunity(db, {
      title: "Test single-let terrace",
      address: "1 Example Street",
      purchasePrice: 120000,
      rentMonthly: 950,
      assetType: "Single let",
      tenure: "Freehold",
      refurbCost: 8000,
      managementCostMonthly: 95,
      sourceUrl: "https://example.test/property",
    });
    const updated = updatePropertyOpportunity(db, opportunity.id, { stage: "Due Diligence", notes: "Legal pack received." });
    const dueDiligence = listPropertyDueDiligence(db, opportunity.id);
    const audit = listPropertyAudit(db);

    assert.equal(updated.stage, "Due Diligence");
    assert.equal(updated.sourceUrl, "https://example.test/property");
    assert.equal(dueDiligence.length, 9);
    assert.ok(audit.some((event) => event.eventType === "opportunity_created"));
    assert.ok(audit.some((event) => event.eventType === "opportunity_updated"));
    assert.equal(audit.every((event) => event.executionAttempted === false), true);
  });
});

test("deal analysis calculates yields, cashflow, acquisition costs and refinance position", () => {
  const analysis = calculateDealAnalysis({
    purchasePrice: 100000,
    rentMonthly: 1000,
    assetType: "Single let",
    managementCostMonthly: 100,
    financeCostMonthly: 300,
    refurbCost: 10000,
    refinanceValue: 130000,
    refinanceLoanToValue: 0.75,
  });

  assert.equal(analysis.grossYield, 12);
  assert.equal(analysis.netMonthlyCashflow, 600);
  assert.equal(analysis.sdlt, 5000);
  assert.equal(analysis.refinancePotential, 22500);
  assert.equal(analysis.cashLeftInDeal, 20100);
  assert.ok(analysis.assumptions.some((item) => /advisory only/i.test(item)));
});

test("Westbridge rules reject HMOs and prioritise cashflow/capital preservation", () => {
  const analysis = calculateDealAnalysis({
    purchasePrice: 90000,
    rentMonthly: 700,
    assetType: "HMO",
    managementCostMonthly: 100,
  });
  const rules = runWestbridgeRules({ assetType: "HMO", notes: "High operational complexity." }, analysis);

  assert.equal(rules.find((rule) => rule.rule === "No HMOs").status, "fail");
  assert.ok(rules.some((rule) => rule.rule === "Long-term cashflow first"));
  assert.ok(rules.some((rule) => rule.rule === "Preserve capital first"));
});

test("portfolio metrics combine held assets with active acquisition pipeline", () => {
  withDatabase((db) => {
    db.prepare(`
      INSERT INTO property_assets (
        address, asset_type, current_value, outstanding_debt, monthly_rent,
        monthly_costs, net_monthly_cashflow
      )
      VALUES ('Held asset', 'Single let', 180000, 100000, 1200, 650, 550)
    `).run();
    createPropertyOpportunity(db, {
      title: "Cashflow candidate",
      purchasePrice: 100000,
      rentMonthly: 1000,
      managementCostMonthly: 100,
      financeCostMonthly: 300,
    });

    const dashboard = getPropertyDashboardData(db);

    assert.equal(dashboard.metrics.totalProperties, 1);
    assert.equal(dashboard.metrics.portfolioValue, 180000);
    assert.equal(dashboard.metrics.netEquity, 80000);
    assert.equal(dashboard.metrics.monthlyCashflow, 550);
    assert.equal(dashboard.metrics.cashflowTargetProgress, 5.5);
    assert.ok(dashboard.metrics.monthlyCashflowForecast >= 600);
  });
});

test("due diligence tracking records status, memory and audit without execution", () => {
  withDatabase((db) => {
    const opportunity = createPropertyOpportunity(db, { title: "Auction lot", purchasePrice: 75000, rentMonthly: 750 });
    const item = upsertDueDiligenceItem(db, opportunity.id, {
      category: "Flood Risk",
      status: "Red",
      detail: "Environment Agency flood map review required.",
    });
    const memory = listPropertyMemory(db);
    const audit = listPropertyAudit(db);

    assert.equal(item.status, "Red");
    assert.ok(memory.some((record) => /Flood Risk/.test(record.summary)));
    assert.ok(audit.some((event) => event.eventType === "due_diligence_updated"));
    assert.equal(PROPERTY_READ_ONLY_BOUNDARY.externalActionsEnabled, false);
  });
});

test("property memory and search link back to source records", () => {
  withDatabase((db) => {
    const opportunity = createPropertyOpportunity(db, {
      title: "Garage block lead",
      assetType: "Garage block",
      notes: "Potential long-term cashflow asset.",
    });
    savePropertyAnalysis(db, opportunity.id, { purchasePrice: 50000, rentMonthly: 600 });
    const result = searchPropertyKnowledge(db, "garage cashflow");
    const semanticSources = listSemanticSourceRecords(db);

    assert.ok(result.matchingOpportunities.some((item) => item.sourceReference.startsWith("property_opportunity:")));
    assert.ok(result.propertyMemory.some((item) => item.sourceReference.startsWith("property_")));
    assert.ok(semanticSources.some((record) => record.sourceType === "property_opportunity"));
    assert.ok(semanticSources.some((record) => record.sourceType === "property_deal_analysis"));
  });
});

test("Westbridge briefing integrates property risks and opportunities for Alfred", () => {
  withDatabase((db) => {
    const opportunity = createPropertyOpportunity(db, {
      title: "Reviewing cashflow property",
      stage: "Due Diligence",
      purchasePrice: 100000,
      rentMonthly: 1000,
      managementCostMonthly: 100,
      financeCostMonthly: 300,
    });
    upsertDueDiligenceItem(db, opportunity.id, {
      category: "Legal Review",
      status: "Red",
      detail: "Legal pack unresolved.",
    });

    const briefing = westbridgeBriefingForDaily(db);

    assert.equal(briefing.boundary.purchasesEnabled, false);
    assert.ok(briefing.items.some((item) => item.sourceReference.startsWith("property_")));
    assert.ok(briefing.summary.includes("active opportunity"));
    assert.ok(briefing.metrics.activeOpportunities >= 1);
  });
});
