export const WESTBRIDGE_COMPANY_ID = "westbridge";
export const WESTBRIDGE_BUSINESS_ENTITY_ID = "westbridge-property-group";
export const PROPERTY_TARGET_MONTHLY_CASHFLOW = 10000;
export const PROPERTY_STRETCH_MONTHLY_CASHFLOW = 15000;

export const PROPERTY_READ_ONLY_BOUNDARY = {
  advisoryOnly: true,
  readOnly: true,
  externalActionsEnabled: false,
  purchasesEnabled: false,
  offersEnabled: false,
  legalInstructionsEnabled: false,
  communicationsEnabled: false,
  regulatedFinancialAdviceEnabled: false,
  approvalRequiredForRecommendations: true,
};

export const PROPERTY_PIPELINE_STAGES = [
  "Lead",
  "Reviewing",
  "Due Diligence",
  "Offer Made",
  "Negotiating",
  "Exchanged",
  "Completed",
  "Rejected",
];

export const DUE_DILIGENCE_CATEGORIES = [
  "Legal Review",
  "Planning Review",
  "Flood Risk",
  "EPC",
  "Insurance",
  "Survey",
  "Finance",
  "Tenancy Review",
  "Environmental Review",
];

export const WESTBRIDGE_RULES = [
  "No HMOs",
  "Long-term cashflow first",
  "Operational assets preferred",
  "Yield alone is not enough",
  "Include acquisition costs",
  "Include management costs",
  "Assess refinance potential",
  "Highlight major risks",
  "Prioritise quality locations",
  "Preserve capital first",
];

const DEFAULT_ANALYSIS_ASSUMPTIONS = [
  "Analysis is advisory only and is not regulated financial, tax, legal or investment advice.",
  "SDLT is an illustrative estimate and must be verified against current HMRC guidance before any decision.",
  "No offer, purchase, legal instruction, payment or external communication is created by Alfred.",
];

function safeJsonParse(value, fallback = {}) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/£|,|%|\s/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeStage(stage) {
  const requested = normalizeText(stage || "Lead");
  return PROPERTY_PIPELINE_STAGES.find((item) => item.toLowerCase() === requested.toLowerCase()) || "Lead";
}

function statusLabel(status = "") {
  const normalized = normalizeText(status || "Amber").toLowerCase();
  if (normalized === "green") return "Green";
  if (normalized === "red") return "Red";
  return "Amber";
}

function mapOpportunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    title: row.title,
    address: row.address,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    sourceMetadata: safeJsonParse(row.source_metadata, {}),
    stage: row.stage,
    assetType: row.asset_type,
    tenure: row.tenure,
    purchasePrice: row.purchase_price,
    rentMonthly: row.rent_monthly,
    refurbCost: row.refurb_cost,
    managementCostMonthly: row.management_cost_monthly,
    otherCosts: row.other_costs,
    committedCapital: row.committed_capital,
    forecastNetMonthlyCashflow: row.forecast_net_monthly_cashflow,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessEntityId: row.business_entity_id,
    companyId: row.company_id,
    address: row.address,
    assetType: row.asset_type,
    tenure: row.tenure,
    status: row.status,
    purchasePrice: row.purchase_price,
    currentValue: row.current_value,
    outstandingDebt: row.outstanding_debt,
    monthlyRent: row.monthly_rent,
    monthlyCosts: row.monthly_costs,
    netMonthlyCashflow: row.net_monthly_cashflow,
    acquiredAt: row.acquired_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnalysis(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    analysisType: row.analysis_type,
    inputs: safeJsonParse(row.inputs, {}),
    assumptions: safeJsonParse(row.assumptions, []),
    results: safeJsonParse(row.results, {}),
    rules: safeJsonParse(row.rules, []),
    recommendation: row.recommendation,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapDueDiligence(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    opportunityTitle: row.opportunity_title,
    category: row.category,
    status: row.status,
    detail: row.detail,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    actor: row.actor,
    userAction: row.user_action,
    opportunityId: row.opportunity_id,
    dataCategories: safeJsonParse(row.data_categories, []),
    executionAttempted: Boolean(row.execution_attempted),
    metadata: safeJsonParse(row.metadata, {}),
    createdAt: row.created_at,
  };
}

function mapMemory(row) {
  if (!row) return null;
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    semanticMemoryId: row.semantic_memory_id,
    summary: row.summary,
    sensitivityCategory: row.sensitivity_category,
    createdAt: row.created_at,
  };
}

export function calculateSdlt(purchasePrice, { assetType = "", additionalProperty = true } = {}) {
  const price = toNumber(purchasePrice);
  if (!price) {
    return { amount: 0, basis: "No purchase price supplied.", assumptions: DEFAULT_ANALYSIS_ASSUMPTIONS };
  }

  const isCommercial = /commercial|garage|land|mixed/i.test(String(assetType || ""));
  const bands = isCommercial
    ? [
        [150000, 0],
        [250000, 0.02],
        [Infinity, 0.05],
      ]
    : additionalProperty
      ? [
          [125000, 0.05],
          [250000, 0.07],
          [925000, 0.10],
          [1500000, 0.15],
          [Infinity, 0.17],
        ]
      : [
          [125000, 0],
          [250000, 0.02],
          [925000, 0.05],
          [1500000, 0.10],
          [Infinity, 0.12],
        ];

  let remaining = price;
  let previousLimit = 0;
  let tax = 0;
  for (const [limit, rate] of bands) {
    if (remaining <= 0) break;
    const bandAmount = Math.min(remaining, limit - previousLimit);
    tax += bandAmount * rate;
    remaining -= bandAmount;
    previousLimit = limit;
  }

  return {
    amount: roundMoney(tax),
    basis: isCommercial
      ? "Illustrative non-residential SDLT bands."
      : additionalProperty
        ? "Illustrative England residential higher-rate property bands."
        : "Illustrative England residential standard-rate bands.",
    assumptions: DEFAULT_ANALYSIS_ASSUMPTIONS,
  };
}

export function calculateDealAnalysis(input = {}) {
  const purchasePrice = toNumber(input.purchasePrice);
  const rentMonthly = toNumber(input.rentMonthly ?? input.rent);
  const annualRent = rentMonthly * 12;
  const refurbCosts = toNumber(input.refurbCost);
  const managementCostMonthly = input.managementCostMonthly !== undefined
    ? toNumber(input.managementCostMonthly)
    : roundMoney(rentMonthly * 0.1);
  const serviceChargeMonthly = toNumber(input.serviceChargeMonthly);
  const groundRentMonthly = toNumber(input.groundRentMonthly);
  const insuranceMonthly = toNumber(input.insuranceMonthly);
  const maintenanceMonthly = toNumber(input.maintenanceMonthly);
  const financeCostMonthly = toNumber(input.financeCostMonthly ?? input.mortgagePaymentMonthly);
  const legalFees = input.legalFees !== undefined ? toNumber(input.legalFees) : (purchasePrice ? 2000 : 0);
  const brokerFees = toNumber(input.brokerFees);
  const surveyCosts = input.surveyCosts !== undefined ? toNumber(input.surveyCosts) : (purchasePrice ? 600 : 0);
  const financeCosts = toNumber(input.financeCosts);
  const otherCosts = toNumber(input.otherCosts);
  const sdltEstimate = input.sdlt !== undefined
    ? { amount: toNumber(input.sdlt), basis: "User-supplied SDLT estimate.", assumptions: DEFAULT_ANALYSIS_ASSUMPTIONS }
    : calculateSdlt(purchasePrice, { assetType: input.assetType, additionalProperty: input.additionalProperty !== false });
  const depositAmount = input.depositAmount !== undefined ? toNumber(input.depositAmount) : roundMoney(purchasePrice * 0.25);
  const loanAmount = input.loanAmount !== undefined ? toNumber(input.loanAmount) : Math.max(0, purchasePrice - depositAmount);
  const totalAcquisitionCost = roundMoney(purchasePrice + sdltEstimate.amount + legalFees + brokerFees + surveyCosts + refurbCosts + financeCosts + otherCosts);
  const monthlyOperatingCosts = roundMoney(
    managementCostMonthly
    + serviceChargeMonthly
    + groundRentMonthly
    + insuranceMonthly
    + maintenanceMonthly
    + financeCostMonthly,
  );
  const netMonthlyCashflow = roundMoney(rentMonthly - monthlyOperatingCosts);
  const annualCashflow = roundMoney(netMonthlyCashflow * 12);
  const grossYield = purchasePrice ? roundPercent((annualRent / purchasePrice) * 100) : 0;
  const netYield = totalAcquisitionCost ? roundPercent((annualCashflow / totalAcquisitionCost) * 100) : 0;
  const cashInvested = roundMoney(depositAmount + sdltEstimate.amount + legalFees + brokerFees + surveyCosts + refurbCosts + financeCosts + otherCosts);
  const roi = cashInvested ? roundPercent((annualCashflow / cashInvested) * 100) : 0;
  const roce = roi;
  const refinanceValue = toNumber(input.refinanceValue ?? input.afterRepairValue);
  const refinanceLoanToValue = toNumber(input.refinanceLoanToValue, 0.75);
  const refinanceDebtPotential = refinanceValue ? roundMoney(refinanceValue * refinanceLoanToValue) : 0;
  const refinancePotential = refinanceValue ? roundMoney(Math.max(0, refinanceDebtPotential - loanAmount)) : 0;
  const cashLeftInDeal = refinanceValue ? roundMoney(Math.max(0, cashInvested - refinancePotential)) : cashInvested;
  const warnings = [
    /hmo/i.test(String(input.assetType || "")) ? "HMOs are excluded by Westbridge rules." : "",
    purchasePrice ? "" : "Purchase price is missing.",
    rentMonthly ? "" : "Monthly rent is missing.",
    netMonthlyCashflow <= 0 && rentMonthly ? "Net monthly cashflow is not positive." : "",
    !refinanceValue ? "Refinance potential has not been evidenced with an after-refurb/value assumption." : "",
  ].filter(Boolean);

  return {
    purchasePrice: roundMoney(purchasePrice),
    rentMonthly: roundMoney(rentMonthly),
    annualRent: roundMoney(annualRent),
    sdlt: sdltEstimate.amount,
    sdltBasis: sdltEstimate.basis,
    legalFees: roundMoney(legalFees),
    brokerFees: roundMoney(brokerFees),
    surveyCosts: roundMoney(surveyCosts),
    refurbCosts: roundMoney(refurbCosts),
    financeCosts: roundMoney(financeCosts),
    otherCosts: roundMoney(otherCosts),
    managementCostMonthly: roundMoney(managementCostMonthly),
    monthlyOperatingCosts,
    totalAcquisitionCost,
    depositAmount,
    loanAmount,
    grossYield,
    netYield,
    roi,
    roce,
    netMonthlyCashflow,
    annualCashflow,
    refinanceValue: roundMoney(refinanceValue),
    refinanceLoanToValue,
    refinancePotential,
    cashInvested,
    cashLeftInDeal,
    warnings,
    assumptions: [
      ...DEFAULT_ANALYSIS_ASSUMPTIONS,
      managementCostMonthly ? "Management costs are included in monthly operating costs." : "Management cost was estimated at 10% of rent where not supplied.",
      financeCostMonthly ? "Finance costs are included from the supplied monthly finance cost." : "No monthly finance cost was supplied.",
    ],
  };
}

export function runWestbridgeRules(input = {}, analysis = calculateDealAnalysis(input)) {
  const assetType = normalizeText(input.assetType);
  const locationQuality = normalizeText(input.locationQuality || input.location || "");
  const riskNotes = normalizeText(input.riskNotes || input.notes || "");
  return WESTBRIDGE_RULES.map((rule) => {
    if (rule === "No HMOs") {
      const fail = /hmo/i.test(assetType);
      return { rule, status: fail ? "fail" : "pass", detail: fail ? "Reject: HMOs are outside Westbridge policy." : "Asset type does not indicate HMO." };
    }
    if (rule === "Long-term cashflow first") {
      const fail = analysis.netMonthlyCashflow <= 0 && analysis.rentMonthly > 0;
      return { rule, status: fail ? "fail" : analysis.netMonthlyCashflow > 0 ? "pass" : "review", detail: `${analysis.netMonthlyCashflow > 0 ? "Positive" : "Unproven"} net monthly cashflow: £${analysis.netMonthlyCashflow}.` };
    }
    if (rule === "Operational assets preferred") {
      const operational = /tenanted|operational|occupied|income/i.test(String(input.operationalStatus || input.status || input.notes || ""));
      return { rule, status: operational ? "pass" : "review", detail: operational ? "Operational income signal recorded." : "Operational status not confirmed." };
    }
    if (rule === "Yield alone is not enough") {
      return { rule, status: "review", detail: "Review cashflow, debt, location, condition, legal pack and exit/refinance assumptions before any decision." };
    }
    if (rule === "Include acquisition costs") {
      const included = analysis.sdlt + analysis.legalFees + analysis.surveyCosts + analysis.refurbCosts + analysis.otherCosts > 0;
      return { rule, status: included ? "pass" : "review", detail: included ? "Acquisition costs are included." : "Acquisition costs are incomplete." };
    }
    if (rule === "Include management costs") {
      return { rule, status: analysis.managementCostMonthly > 0 ? "pass" : "review", detail: `Management cost used: £${analysis.managementCostMonthly}/month.` };
    }
    if (rule === "Assess refinance potential") {
      return { rule, status: analysis.refinanceValue > 0 ? "pass" : "review", detail: analysis.refinanceValue > 0 ? `Refinance value assumption: £${analysis.refinanceValue}.` : "No refinance valuation assumption recorded." };
    }
    if (rule === "Highlight major risks") {
      const hasRisks = analysis.warnings.length > 0 || riskNotes.length > 0;
      return { rule, status: hasRisks ? "review" : "pass", detail: hasRisks ? [...analysis.warnings, riskNotes].filter(Boolean).join(" ") : "No major risk notes captured yet; due diligence still required." };
    }
    if (rule === "Prioritise quality locations") {
      return { rule, status: /good|prime|quality|strong|established/i.test(locationQuality) ? "pass" : "review", detail: locationQuality ? `Location signal: ${locationQuality}.` : "Location quality has not been evidenced." };
    }
    if (rule === "Preserve capital first") {
      const fail = analysis.cashInvested > 0 && analysis.cashLeftInDeal > analysis.cashInvested * 0.9 && analysis.netMonthlyCashflow <= 0;
      return { rule, status: fail ? "fail" : "review", detail: `Cash invested £${analysis.cashInvested}; cash left in deal after refinance assumption £${analysis.cashLeftInDeal}.` };
    }
    return { rule, status: "review", detail: "Rule requires review." };
  });
}

function recommendationFor(analysis, rules) {
  if (rules.some((rule) => rule.status === "fail")) return "Reject or pause until the failed rule is resolved.";
  if (!analysis.purchasePrice || !analysis.rentMonthly) return "Incomplete: capture price, rent and due diligence evidence before assessment.";
  if (analysis.netMonthlyCashflow <= 0) return "Reject or rework: cashflow does not meet Westbridge's long-term cashflow-first rule.";
  if (analysis.netMonthlyCashflow >= 1000 && analysis.grossYield >= 7) return "Strong candidate for Patrick review and formal due diligence. Recommendation only.";
  return "Keep under review: positive signal but not enough evidence for board-level decision.";
}

export function recordPropertyAudit(db, {
  eventType,
  actor = "Westbridge Property Director",
  userAction = "",
  opportunityId = null,
  dataCategories = [],
  executionAttempted = false,
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO property_audit_events (
      event_type, actor, user_action, opportunity_id, data_categories,
      execution_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventType,
    actor,
    userAction,
    opportunityId,
    JSON.stringify(dataCategories),
    executionAttempted ? 1 : 0,
    JSON.stringify(metadata),
  );
  return db.prepare("SELECT * FROM property_audit_events WHERE id = ?").get(Number(result.lastInsertRowid));
}

function upsertPropertyMemory(db, { opportunityId, sourceType, sourceId, summary }) {
  db.prepare(`
    INSERT INTO property_memory_links (
      opportunity_id, source_type, source_id, summary, sensitivity_category
    )
    VALUES (?, ?, ?, ?, 'local_sensitive_business_data')
    ON CONFLICT(opportunity_id, source_type, source_id)
    DO UPDATE SET summary = excluded.summary, created_at = CURRENT_TIMESTAMP
  `).run(opportunityId, sourceType, String(sourceId), summary);
}

function ensureDefaultDueDiligence(db, opportunityId) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO property_due_diligence_items (
      opportunity_id, category, status, detail
    )
    VALUES (?, ?, 'Amber', 'Not reviewed yet.')
  `);
  for (const category of DUE_DILIGENCE_CATEGORIES) insert.run(opportunityId, category);
}

export function createPropertyOpportunity(db, payload = {}) {
  const stage = normalizeStage(payload.stage);
  const analysis = calculateDealAnalysis(payload);
  const title = normalizeText(payload.title)
    || normalizeText(payload.address)
    || normalizeText(payload.sourceUrl)
    || "Property opportunity";
  const result = db.prepare(`
    INSERT INTO property_opportunities (
      business_entity_id, company_id, title, address, source_type, source_url,
      source_metadata, stage, asset_type, tenure, purchase_price, rent_monthly,
      refurb_cost, management_cost_monthly, other_costs, committed_capital,
      forecast_net_monthly_cashflow, status, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(
    payload.businessEntityId || WESTBRIDGE_BUSINESS_ENTITY_ID,
    payload.companyId || WESTBRIDGE_COMPANY_ID,
    title,
    normalizeText(payload.address),
    normalizeText(payload.sourceType || (payload.sourceUrl ? "url_reference" : "manual")),
    normalizeText(payload.sourceUrl),
    JSON.stringify(payload.sourceMetadata || {}),
    stage,
    normalizeText(payload.assetType || "Unknown"),
    normalizeText(payload.tenure),
    analysis.purchasePrice,
    analysis.rentMonthly,
    analysis.refurbCosts,
    analysis.managementCostMonthly,
    analysis.otherCosts,
    analysis.cashInvested,
    analysis.netMonthlyCashflow,
    normalizeText(payload.notes),
  );
  const opportunity = getPropertyOpportunity(db, Number(result.lastInsertRowid));
  ensureDefaultDueDiligence(db, opportunity.id);
  savePropertyAnalysis(db, opportunity.id, payload, { userAction: payload.userAction || "property:create-opportunity" });
  upsertPropertyMemory(db, {
    opportunityId: opportunity.id,
    sourceType: "property_opportunity",
    sourceId: opportunity.id,
    summary: `Property opportunity: ${opportunity.title}. Stage: ${opportunity.stage}. Forecast cashflow: £${analysis.netMonthlyCashflow}/month. Advisory only.`,
  });
  recordPropertyAudit(db, {
    eventType: "opportunity_created",
    userAction: payload.userAction || "property:create-opportunity",
    opportunityId: opportunity.id,
    dataCategories: ["property_opportunity", "deal_analysis", "due_diligence"],
    metadata: { stage, sourceType: opportunity.sourceType },
  });
  return getPropertyOpportunity(db, opportunity.id);
}

export function updatePropertyOpportunity(db, id, payload = {}) {
  const current = getPropertyOpportunity(db, id);
  if (!current) {
    const error = new Error("Property opportunity not found");
    error.statusCode = 404;
    throw error;
  }
  const merged = { ...current, ...payload, stage: payload.stage ? normalizeStage(payload.stage) : current.stage };
  const analysis = calculateDealAnalysis(merged);
  db.prepare(`
    UPDATE property_opportunities
    SET title = ?, address = ?, source_type = ?, source_url = ?, source_metadata = ?,
        stage = ?, asset_type = ?, tenure = ?, purchase_price = ?, rent_monthly = ?,
        refurb_cost = ?, management_cost_monthly = ?, other_costs = ?,
        committed_capital = ?, forecast_net_monthly_cashflow = ?,
        status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    normalizeText(merged.title || "Property opportunity"),
    normalizeText(merged.address),
    normalizeText(merged.sourceType || "manual"),
    normalizeText(merged.sourceUrl),
    JSON.stringify(merged.sourceMetadata || {}),
    merged.stage,
    normalizeText(merged.assetType || "Unknown"),
    normalizeText(merged.tenure),
    analysis.purchasePrice,
    analysis.rentMonthly,
    analysis.refurbCosts,
    analysis.managementCostMonthly,
    analysis.otherCosts,
    analysis.cashInvested,
    analysis.netMonthlyCashflow,
    normalizeText(merged.status || "active"),
    normalizeText(merged.notes),
    id,
  );
  upsertPropertyMemory(db, {
    opportunityId: id,
    sourceType: "property_opportunity",
    sourceId: id,
    summary: `Updated property opportunity: ${merged.title}. Stage: ${merged.stage}. Forecast cashflow: £${analysis.netMonthlyCashflow}/month.`,
  });
  recordPropertyAudit(db, {
    eventType: "opportunity_updated",
    userAction: payload.userAction || "property:update-opportunity",
    opportunityId: id,
    dataCategories: ["property_opportunity", "deal_analysis"],
    metadata: { stage: merged.stage },
  });
  return getPropertyOpportunity(db, id);
}

export function savePropertyAnalysis(db, opportunityId, inputs = {}, { userAction = "property:analyse-deal" } = {}) {
  const opportunity = getPropertyOpportunity(db, opportunityId);
  if (!opportunity) {
    const error = new Error("Property opportunity not found");
    error.statusCode = 404;
    throw error;
  }
  const merged = { ...opportunity, ...inputs };
  const analysis = calculateDealAnalysis(merged);
  const rules = runWestbridgeRules(merged, analysis);
  const recommendation = recommendationFor(analysis, rules);
  const result = db.prepare(`
    INSERT INTO property_deal_analyses (
      opportunity_id, analysis_type, inputs, assumptions, results, rules, recommendation, created_by
    )
    VALUES (?, 'deal_analysis', ?, ?, ?, ?, ?, 'Westbridge Property Director')
  `).run(
    opportunityId,
    JSON.stringify(merged),
    JSON.stringify(analysis.assumptions),
    JSON.stringify(analysis),
    JSON.stringify(rules),
    recommendation,
  );
  db.prepare(`
    UPDATE property_opportunities
    SET committed_capital = ?, forecast_net_monthly_cashflow = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(analysis.cashInvested, analysis.netMonthlyCashflow, opportunityId);
  upsertPropertyMemory(db, {
    opportunityId,
    sourceType: "property_deal_analysis",
    sourceId: Number(result.lastInsertRowid),
    summary: `Deal analysis for ${opportunity.title}: gross yield ${analysis.grossYield}%, net yield ${analysis.netYield}%, net monthly cashflow £${analysis.netMonthlyCashflow}. Recommendation: ${recommendation}`,
  });
  recordPropertyAudit(db, {
    eventType: "deal_analysis_generated",
    userAction,
    opportunityId,
    dataCategories: ["property_opportunity", "deal_analysis", "westbridge_rules"],
    metadata: { recommendation, executionAttempted: false },
  });
  return {
    opportunity: getPropertyOpportunity(db, opportunityId),
    analysis,
    rules,
    recommendation,
    boundary: PROPERTY_READ_ONLY_BOUNDARY,
    executionAttempted: false,
  };
}

export function getPropertyOpportunity(db, id) {
  const row = db.prepare("SELECT * FROM property_opportunities WHERE id = ?").get(id);
  return mapOpportunity(row);
}

export function listPropertyOpportunities(db) {
  return db.prepare(`
    SELECT *
    FROM property_opportunities
    ORDER BY
      CASE stage
        WHEN 'Due Diligence' THEN 0
        WHEN 'Reviewing' THEN 1
        WHEN 'Lead' THEN 2
        WHEN 'Offer Made' THEN 3
        WHEN 'Negotiating' THEN 4
        WHEN 'Exchanged' THEN 5
        WHEN 'Completed' THEN 6
        WHEN 'Rejected' THEN 7
        ELSE 8
      END,
      updated_at DESC,
      id DESC
  `).all().map(mapOpportunity);
}

export function listPropertyAnalyses(db, opportunityId = null) {
  const rows = opportunityId
    ? db.prepare("SELECT * FROM property_deal_analyses WHERE opportunity_id = ? ORDER BY created_at DESC, id DESC").all(opportunityId)
    : db.prepare("SELECT * FROM property_deal_analyses ORDER BY created_at DESC, id DESC LIMIT 30").all();
  return rows.map(mapAnalysis);
}

export function listPropertyDueDiligence(db, opportunityId = null) {
  const query = `
    SELECT d.*, o.title AS opportunity_title
    FROM property_due_diligence_items d
    JOIN property_opportunities o ON o.id = d.opportunity_id
    ${opportunityId ? "WHERE d.opportunity_id = ?" : ""}
    ORDER BY d.opportunity_id DESC,
      CASE d.status WHEN 'Red' THEN 0 WHEN 'Amber' THEN 1 ELSE 2 END,
      d.category ASC
  `;
  return (opportunityId ? db.prepare(query).all(opportunityId) : db.prepare(query).all()).map(mapDueDiligence);
}

export function upsertDueDiligenceItem(db, opportunityId, payload = {}) {
  const category = DUE_DILIGENCE_CATEGORIES.find((item) => item.toLowerCase() === normalizeText(payload.category).toLowerCase())
    || normalizeText(payload.category || "Legal Review");
  const status = statusLabel(payload.status);
  db.prepare(`
    INSERT INTO property_due_diligence_items (
      opportunity_id, category, status, detail, reviewed_at
    )
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(opportunity_id, category)
    DO UPDATE SET status = excluded.status, detail = excluded.detail,
      reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  `).run(opportunityId, category, status, normalizeText(payload.detail));
  recordPropertyAudit(db, {
    eventType: "due_diligence_updated",
    userAction: payload.userAction || "property:update-due-diligence",
    opportunityId,
    dataCategories: ["property_due_diligence"],
    metadata: { category, status },
  });
  upsertPropertyMemory(db, {
    opportunityId,
    sourceType: "property_due_diligence",
    sourceId: category,
    summary: `Due diligence update for opportunity ${opportunityId}: ${category} is ${status}. ${normalizeText(payload.detail)}`,
  });
  return listPropertyDueDiligence(db, opportunityId).find((item) => item.category === category);
}

export function listPropertyAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM property_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map(mapAudit);
}

export function listPropertyMemory(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM property_memory_links
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map(mapMemory);
}

export function searchPropertyKnowledge(db, query = "") {
  const terms = normalizeText(query).toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const matches = (text) => {
    if (!terms.length) return 0;
    const haystack = normalizeText(text).toLowerCase();
    return terms.filter((term) => haystack.includes(term)).length / terms.length;
  };
  const opportunities = listPropertyOpportunities(db)
    .map((item) => ({
      ...item,
      relevanceScore: matches(`${item.title} ${item.address} ${item.assetType} ${item.stage} ${item.notes} ${item.sourceUrl}`),
      sourceReference: `property_opportunity:${item.id}`,
    }))
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const memories = listPropertyMemory(db)
    .map((item) => ({
      ...item,
      relevanceScore: matches(item.summary),
      sourceReference: `${item.sourceType}:${item.sourceId}`,
    }))
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  return {
    query,
    matchingOpportunities: opportunities.slice(0, 10),
    propertyMemory: memories.slice(0, 10),
    sourceReferences: [
      ...opportunities.slice(0, 5).map((item) => ({ reference: item.sourceReference, label: item.title, category: "property_opportunity" })),
      ...memories.slice(0, 5).map((item) => ({ reference: item.sourceReference, label: item.summary.slice(0, 120), category: "property_memory" })),
    ],
    boundary: PROPERTY_READ_ONLY_BOUNDARY,
  };
}

export function getPropertyDashboardData(db) {
  const assets = db.prepare("SELECT * FROM property_assets ORDER BY updated_at DESC, id DESC").all().map(mapAsset);
  const opportunities = listPropertyOpportunities(db);
  const activeOpportunities = opportunities.filter((item) => !["Completed", "Rejected"].includes(item.stage));
  const analyses = listPropertyAnalyses(db);
  const dueDiligence = listPropertyDueDiligence(db);
  const risks = db.prepare(`
    SELECT *
    FROM property_risks
    WHERE status != 'closed'
    ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, updated_at DESC
    LIMIT 20
  `).all().map((row) => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    title: row.title,
    detail: row.detail,
    severity: row.severity,
    status: row.status,
    sourceReference: row.source_ref,
  }));
  const decisions = db.prepare(`
    SELECT *
    FROM property_decisions
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `).all().map((row) => ({
    id: row.id,
    opportunityId: row.opportunity_id,
    title: row.title,
    detail: row.detail,
    status: row.status,
    decisionRequiredBy: row.decision_required_by,
    sourceReference: row.source_ref,
  }));
  const portfolioValue = assets.reduce((sum, asset) => sum + (asset.currentValue || asset.purchasePrice || 0), 0);
  const outstandingDebt = assets.reduce((sum, asset) => sum + (asset.outstandingDebt || 0), 0);
  const monthlyCashflow = assets.reduce((sum, asset) => sum + (asset.netMonthlyCashflow || 0), 0);
  const forecastMonthlyCashflow = activeOpportunities.reduce((sum, item) => sum + (item.forecastNetMonthlyCashflow || 0), 0);
  const redDueDiligence = dueDiligence.filter((item) => item.status === "Red");
  const amberDueDiligence = dueDiligence.filter((item) => item.status === "Amber");
  return {
    business: {
      id: WESTBRIDGE_COMPANY_ID,
      businessEntityId: WESTBRIDGE_BUSINESS_ENTITY_ID,
      name: "Westbridge Property Group",
      businessType: "Property Investment",
      owner: "Patrick King",
      mission: "Acquire and manage cashflow-producing property assets.",
      targetMonthlyCashflow: PROPERTY_TARGET_MONTHLY_CASHFLOW,
      stretchMonthlyCashflow: PROPERTY_STRETCH_MONTHLY_CASHFLOW,
    },
    director: {
      name: "Westbridge Property Director",
      role: "AI Investment Director",
      reportsTo: "Patrick King",
      status: "Advisory only",
    },
    metrics: {
      totalProperties: assets.length,
      portfolioValue: roundMoney(portfolioValue),
      netEquity: roundMoney(portfolioValue - outstandingDebt),
      outstandingDebt: roundMoney(outstandingDebt),
      monthlyCashflow: roundMoney(monthlyCashflow),
      annualCashflow: roundMoney(monthlyCashflow * 12),
      targetMonthlyCashflow: PROPERTY_TARGET_MONTHLY_CASHFLOW,
      stretchMonthlyCashflow: PROPERTY_STRETCH_MONTHLY_CASHFLOW,
      cashflowTargetProgress: Math.min(100, roundPercent((monthlyCashflow / PROPERTY_TARGET_MONTHLY_CASHFLOW) * 100)),
      activeOpportunities: activeOpportunities.length,
      capitalCommitted: roundMoney(activeOpportunities.reduce((sum, item) => sum + (item.committedCapital || 0), 0)),
      monthlyCashflowForecast: roundMoney(forecastMonthlyCashflow),
      portfolioGrowth: opportunities.filter((item) => item.stage === "Completed").length,
      dueDiligenceRed: redDueDiligence.length,
      dueDiligenceAmber: amberDueDiligence.length,
    },
    assets,
    opportunities,
    activeOpportunities,
    dueDiligence,
    analyses: analyses.slice(0, 8),
    risks,
    decisions,
    propertyMemory: listPropertyMemory(db, 20),
    rules: WESTBRIDGE_RULES,
    pipelineStages: PROPERTY_PIPELINE_STAGES,
    boundary: PROPERTY_READ_ONLY_BOUNDARY,
  };
}

export function westbridgeBriefingForDaily(db) {
  const dashboard = getPropertyDashboardData(db);
  const opportunities = dashboard.activeOpportunities.slice(0, 5);
  const redDueDiligence = dashboard.dueDiligence.filter((item) => item.status === "Red").slice(0, 5);
  const amberDueDiligence = dashboard.dueDiligence.filter((item) => item.status === "Amber").slice(0, 5);
  const negativeCashflow = opportunities.filter((item) => (item.forecastNetMonthlyCashflow || 0) <= 0 && (item.rentMonthly || 0) > 0);
  const items = [
    ...negativeCashflow.map((item) => ({
      title: `${item.title} cashflow requires review`,
      detail: `Forecast net monthly cashflow is £${item.forecastNetMonthlyCashflow}. Stage: ${item.stage}.`,
      priority: "high",
      sourceReference: `property_opportunity:${item.id}`,
    })),
    ...redDueDiligence.map((item) => ({
      title: `${item.category} red on ${item.opportunityTitle}`,
      detail: item.detail || "Due diligence item is marked red.",
      priority: "high",
      sourceReference: `property_due_diligence:${item.id}`,
    })),
    ...amberDueDiligence.slice(0, 3).map((item) => ({
      title: `${item.category} not yet cleared`,
      detail: `${item.opportunityTitle} remains amber. Confirm evidence before any investment decision.`,
      priority: "medium",
      sourceReference: `property_due_diligence:${item.id}`,
    })),
    ...opportunities.slice(0, 3).map((item) => ({
      title: `${item.title} in ${item.stage}`,
      detail: `Forecast cashflow £${item.forecastNetMonthlyCashflow}/month. Purchase price £${item.purchasePrice}.`,
      priority: item.stage === "Due Diligence" ? "high" : "medium",
      sourceReference: `property_opportunity:${item.id}`,
    })),
  ];
  return {
    title: "Westbridge Property Brief",
    summary: `${dashboard.metrics.activeOpportunities} active opportunity(s), £${dashboard.metrics.monthlyCashflow} current monthly cashflow and £${dashboard.metrics.monthlyCashflowForecast} forecast pipeline cashflow against a £${PROPERTY_TARGET_MONTHLY_CASHFLOW}/month target.`,
    items: items.slice(0, 8),
    metrics: dashboard.metrics,
    boundary: PROPERTY_READ_ONLY_BOUNDARY,
  };
}
