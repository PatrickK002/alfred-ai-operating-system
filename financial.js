import { createHash } from "node:crypto";
import { parseOrderBookWorkbookFromBase64 } from "./excel-orderbook.js";

export const FINANCIAL_READ_ONLY_BOUNDARY = {
  readOnly: true,
  externalWritesEnabled: false,
  invoiceCapability: false,
  paymentCapability: false,
  accountingWriteCapability: false,
};

const MONTHS = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const DEFAULT_BUSINESS_ENTITY_ID = "digitize";
const DEFAULT_GROUP_ENTITY_ID = "group";
const SCOPE_TYPES = new Set(["group", "division", "business", "product", "venture"]);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function toIsoTimestamp(value) {
  if (!value || String(value).includes("T")) return value || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return `${value}T00:00:00Z`;
  return `${String(value).replace(" ", "T")}Z`;
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

function normalizeProbability(value, status = "") {
  if (value === undefined || value === null || value === "") {
    return classifyEntryType(status).entryType === "secured" ? 1 : 0.5;
  }
  const parsed = toNumber(value, 0);
  if (parsed > 1) return Math.min(parsed / 100, 1);
  return Math.max(0, Math.min(parsed, 1));
}

function normalizeText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/g, " ").trim();
}

function mapBusinessEntity(row) {
  return {
    id: row.id,
    name: row.name,
    entityType: row.entity_type,
    parentEntityId: row.parent_entity_id,
    companyId: row.company_id,
    status: row.status,
    notes: row.notes,
  };
}

export function listFinancialBusinessEntities(db) {
  return db.prepare(`
    SELECT *
    FROM financial_business_entities
    ORDER BY
      CASE entity_type
        WHEN 'group' THEN 0
        WHEN 'division' THEN 1
        WHEN 'business' THEN 2
        WHEN 'product' THEN 3
        WHEN 'venture' THEN 4
        ELSE 5
      END,
      name ASC
  `).all().map(mapBusinessEntity);
}

function getFinancialBusinessEntity(db, id = DEFAULT_BUSINESS_ENTITY_ID) {
  const requested = normalizeText(id || DEFAULT_BUSINESS_ENTITY_ID);
  const row = db.prepare("SELECT * FROM financial_business_entities WHERE id = ?").get(requested);
  if (row) return mapBusinessEntity(row);
  const fallback = db.prepare("SELECT * FROM financial_business_entities WHERE id = ?").get(DEFAULT_BUSINESS_ENTITY_ID)
    || db.prepare("SELECT * FROM financial_business_entities WHERE id = ?").get(DEFAULT_GROUP_ENTITY_ID);
  return fallback ? mapBusinessEntity(fallback) : {
    id: DEFAULT_BUSINESS_ENTITY_ID,
    name: "Digitize Consultants",
    entityType: "business",
    parentEntityId: DEFAULT_GROUP_ENTITY_ID,
    companyId: "digitize",
    status: "active",
    notes: "",
  };
}

function descendantEntityIds(entities, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of entities) {
      if (entity.parentEntityId && ids.has(entity.parentEntityId) && !ids.has(entity.id)) {
        ids.add(entity.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

function normalizeFinancialScope(db, options = {}) {
  const entities = listFinancialBusinessEntities(db);
  const requestedId = normalizeText(options.businessEntityId || options.scopeId || DEFAULT_GROUP_ENTITY_ID);
  const root = entities.find((entity) => entity.id === requestedId)
    || entities.find((entity) => entity.id === DEFAULT_GROUP_ENTITY_ID)
    || entities[0]
    || {
      id: DEFAULT_GROUP_ENTITY_ID,
      name: "Patrick King Group",
      entityType: "group",
      parentEntityId: null,
      companyId: null,
      status: "active",
      notes: "",
    };
  const requestedScopeType = normalizeText(options.scopeType || root.entityType || "group").toLowerCase();
  const scopeType = SCOPE_TYPES.has(requestedScopeType) ? requestedScopeType : root.entityType || "group";
  const entityIds = scopeType === "group" && root.id === DEFAULT_GROUP_ENTITY_ID
    ? entities.map((entity) => entity.id)
    : descendantEntityIds(entities, root.id);
  return {
    scopeType,
    scopeId: root.id,
    label: root.name,
    root,
    entityIds: entityIds.length ? entityIds : [root.id],
    businessEntities: entities,
  };
}

function scopeWhereClause(alias, entityIds) {
  const column = alias ? `${alias}.business_entity_id` : "business_entity_id";
  const ids = entityIds?.length ? entityIds : [DEFAULT_GROUP_ENTITY_ID];
  return {
    clause: `${column} IN (${ids.map(() => "?").join(", ")})`,
    params: ids,
  };
}

function importBusinessEntity(db, businessEntityId) {
  const requested = normalizeText(businessEntityId || DEFAULT_BUSINESS_ENTITY_ID);
  const entity = getFinancialBusinessEntity(db, requested === DEFAULT_GROUP_ENTITY_ID ? DEFAULT_BUSINESS_ENTITY_ID : requested);
  return entity.entityType === "group" ? getFinancialBusinessEntity(db, DEFAULT_BUSINESS_ENTITY_ID) : entity;
}

function classifyEntryType(status = "") {
  const text = normalizeText(status).toLowerCase();
  if (/secured|won|confirmed|order|contracted|approved/.test(text)) return { entryType: "secured", probability: 1 };
  if (/opportunity|lead|prospect/.test(text)) return { entryType: "opportunity", probability: 0.25 };
  if (/forecast|expected/.test(text)) return { entryType: "forecast", probability: 0.75 };
  return { entryType: "pipeline", probability: 0.5 };
}

function quarterForMonth(month) {
  const value = Number(String(month || "").slice(5, 7));
  if (!value) return "";
  if (value >= 4 && value <= 6) return "Q1";
  if (value >= 7 && value <= 9) return "Q2";
  if (value >= 10 && value <= 12) return "Q3";
  return "Q4";
}

function inferMonth(value, financialYear) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return "";
  const iso = text.match(/20\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const monthKey = Object.keys(MONTHS).find((key) => text.includes(key));
  if (!monthKey) return "";
  const startYear = Number(financialYear?.startDate?.slice(0, 4)) || new Date().getFullYear();
  const month = MONTHS[monthKey];
  const year = Number(month) >= 4 ? startYear : startYear + 1;
  return `${year}-${month}`;
}

export function detectFinancialYear(sheetName) {
  const text = normalizeText(sheetName);
  const range = text.match(/(?:fy|financial year|year)?\s*(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})/i);
  if (range) {
    const startYear = Number(range[1]);
    const endYear = range[2].length === 2 ? Number(`20${range[2]}`) : Number(range[2]);
    return {
      label: `FY${startYear}-${String(endYear).slice(2)}`,
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    };
  }
  const single = text.match(/(?:fy|financial year|year)?\s*(20\d{2})/i);
  if (single) {
    const startYear = Number(single[1]);
    return {
      label: `FY${startYear}-${String(startYear + 1).slice(2)}`,
      startDate: `${startYear}-04-01`,
      endDate: `${startYear + 1}-03-31`,
    };
  }
  return null;
}

function mapRow(row) {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase().trim(), value]));
  const find = (...aliases) => aliases.map((alias) => lower[alias]).find((value) => value !== undefined && value !== "");
  return {
    clientName: normalizeText(find("client", "client name", "customer", "organisation", "organization")),
    projectName: normalizeText(find("project", "project name", "job", "assignment")),
    serviceLine: normalizeText(find("service", "service line", "discipline", "workstream", "department")),
    title: normalizeText(find("title", "description", "work", "scope", "opportunity", "project")),
    status: normalizeText(find("status", "stage", "type", "category")),
    amountGbp: toNumber(find("amount", "amount gbp", "value", "value gbp", "revenue", "fee", "forecast")),
    probability: find("probability", "probability %", "weighted probability", "confidence"),
    forecastMonth: normalizeText(find("month", "forecast month", "period", "date", "expected month")),
    forecastQuarter: normalizeText(find("quarter", "forecast quarter")),
    notes: normalizeText(find("notes", "comment", "comments")),
  };
}

function validateEntry(entry) {
  const errors = [];
  if (!entry.clientName) errors.push("Missing client");
  if (!entry.projectName && !entry.title) errors.push("Missing project/title");
  if (!entry.amountGbp) errors.push("Missing amount");
  return errors;
}

function ensureFinancialYear(db, year) {
  const existing = db.prepare("SELECT * FROM financial_years WHERE label = ?").get(year.label);
  if (existing) return existing;
  const result = db.prepare(`
    INSERT INTO financial_years (label, start_date, end_date)
    VALUES (?, ?, ?)
  `).run(year.label, year.startDate, year.endDate);
  return db.prepare("SELECT * FROM financial_years WHERE id = ?").get(Number(result.lastInsertRowid));
}

function ensureServiceLine(db, name) {
  const value = normalizeText(name || "Unassigned");
  db.prepare("INSERT OR IGNORE INTO service_lines (name) VALUES (?)").run(value);
  return value;
}

export function recordFinancialAudit(db, {
  eventType,
  actor = "Olivia",
  source = "",
  businessEntityId = DEFAULT_GROUP_ENTITY_ID,
  metadata = {},
}) {
  const result = db.prepare(`
    INSERT INTO financial_audit_events (business_entity_id, event_type, actor, source, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(String(businessEntityId || DEFAULT_GROUP_ENTITY_ID), String(eventType), String(actor), String(source), JSON.stringify(metadata));
  return { id: Number(result.lastInsertRowid), businessEntityId, eventType, actor, source, metadata };
}

function createImportRecord(db, payload) {
  const result = db.prepare(`
    INSERT INTO financial_imports (
      source_type, source_name, business_entity_id, source_hash, status, rows_total, rows_imported,
      rows_updated, duplicates_count, validation_errors_count, overwrite_approved, summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.sourceType,
    payload.sourceName,
    payload.businessEntityId || DEFAULT_BUSINESS_ENTITY_ID,
    payload.sourceHash,
    payload.status,
    payload.rowsTotal,
    payload.rowsImported,
    payload.rowsUpdated,
    payload.duplicatesCount,
    payload.validationErrorsCount,
    payload.overwriteApproved ? 1 : 0,
    JSON.stringify(payload.summary || {}),
  );
  return Number(result.lastInsertRowid);
}

function recordImportChange(db, importId, { changeType, sourceRef, before = {}, after = {}, message = "" }) {
  db.prepare(`
    INSERT INTO financial_import_changes (import_id, change_type, source_ref, before_snapshot, after_snapshot, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(importId, changeType, sourceRef, JSON.stringify(before), JSON.stringify(after), message);
}

function entrySnapshot(entry) {
  return {
    financialYearId: entry.financial_year_id,
    businessEntityId: entry.business_entity_id,
    clientName: entry.client_name,
    projectName: entry.project_name,
    serviceLine: entry.service_line,
    title: entry.title,
    entryType: entry.entry_type,
    status: entry.status,
    amountGbp: entry.amount_gbp,
    probability: entry.probability,
    weightedAmountGbp: entry.weighted_amount_gbp,
    forecastMonth: entry.forecast_month,
    forecastQuarter: entry.forecast_quarter,
    sourceRef: entry.source_ref,
    sourceHash: entry.source_hash,
  };
}

function normalizeImportEntry({ row, financialYear, sheetName, rowNumber, fileName, importId, businessEntity }) {
  const mapped = mapRow(row);
  const classification = classifyEntryType(mapped.status);
  const probability = normalizeProbability(mapped.probability, mapped.status || classification.entryType);
  const forecastMonth = inferMonth(mapped.forecastMonth, financialYear);
  const forecastQuarter = mapped.forecastQuarter || quarterForMonth(forecastMonth);
  const title = mapped.title || mapped.projectName || `${mapped.clientName} order book row`;
  const entity = businessEntity || { id: DEFAULT_BUSINESS_ENTITY_ID, companyId: "digitize" };
  const normalized = {
    businessEntityId: entity.id,
    businessEntityName: entity.name || entity.id,
    companyId: entity.companyId || "digitize",
    clientName: mapped.clientName,
    projectName: mapped.projectName || title,
    serviceLine: mapped.serviceLine || "Unassigned",
    title,
    entryType: classification.entryType,
    status: mapped.status || classification.entryType,
    amountGbp: mapped.amountGbp,
    probability,
    weightedAmountGbp: mapped.amountGbp * probability,
    forecastMonth,
    forecastQuarter,
    sourceType: "excel_order_book",
    sourceFile: fileName,
    sourceSheet: sheetName,
    sourceRow: rowNumber,
    sourceRef: `excel_order_book:${entity.id}:${fileName}:${sheetName}:${rowNumber}`,
    notes: mapped.notes,
    importId,
  };
  return {
    ...normalized,
    duplicateKey: sha256([
      normalized.businessEntityId,
      financialYear.label,
      normalized.clientName.toLowerCase(),
      normalized.projectName.toLowerCase(),
      normalized.title.toLowerCase(),
      normalized.amountGbp,
    ].join("|")),
    sourceHash: sha256(stableJson({ financialYear, normalized, row })),
  };
}

function upsertOrderBookEntry(db, financialYearRow, entry, { overwriteApproved, dryRun, importId }) {
  const existing = db.prepare("SELECT * FROM order_book_entries WHERE source_ref = ?").get(entry.sourceRef);
  if (existing && existing.source_hash !== entry.sourceHash && !overwriteApproved) {
    recordImportChange(db, importId, {
      changeType: "overwrite_required",
      sourceRef: entry.sourceRef,
      before: entrySnapshot(existing),
      after: entry,
      message: "Existing order book row changed. Re-import requires explicit overwrite approval.",
    });
    return "overwrite_required";
  }
  if (dryRun) {
    recordImportChange(db, importId, {
      changeType: existing ? existing.source_hash === entry.sourceHash ? "unchanged" : "would_update" : "would_add",
      sourceRef: entry.sourceRef,
      before: existing ? entrySnapshot(existing) : {},
      after: entry,
    });
    return existing ? "would_update" : "would_add";
  }
  ensureServiceLine(db, entry.serviceLine);
  if (existing) {
    db.prepare(`
      UPDATE order_book_entries
      SET financial_year_id = ?, business_entity_id = ?, company_id = ?, client_name = ?, project_name = ?, service_line = ?,
          title = ?, entry_type = ?, status = ?, amount_gbp = ?, probability = ?,
          weighted_amount_gbp = ?, forecast_month = ?, forecast_quarter = ?, source_hash = ?,
          duplicate_key = ?, import_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      financialYearRow.id,
      entry.businessEntityId,
      entry.companyId,
      entry.clientName,
      entry.projectName,
      entry.serviceLine,
      entry.title,
      entry.entryType,
      entry.status,
      entry.amountGbp,
      entry.probability,
      entry.weightedAmountGbp,
      entry.forecastMonth,
      entry.forecastQuarter,
      entry.sourceHash,
      entry.duplicateKey,
      importId,
      entry.notes,
      existing.id,
    );
    recordImportChange(db, importId, {
      changeType: existing.source_hash === entry.sourceHash ? "unchanged" : "updated",
      sourceRef: entry.sourceRef,
      before: entrySnapshot(existing),
      after: entry,
    });
    return existing.source_hash === entry.sourceHash ? "unchanged" : "updated";
  }

  db.prepare(`
    INSERT INTO order_book_entries (
      financial_year_id, business_entity_id, company_id, client_name, project_name, service_line, title,
      entry_type, status, amount_gbp, probability, weighted_amount_gbp,
      forecast_month, forecast_quarter, source_type, source_file, source_sheet,
      source_row, source_ref, source_hash, duplicate_key, import_id, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    financialYearRow.id,
    entry.businessEntityId,
    entry.companyId,
    entry.clientName,
    entry.projectName,
    entry.serviceLine,
    entry.title,
    entry.entryType,
    entry.status,
    entry.amountGbp,
    entry.probability,
    entry.weightedAmountGbp,
    entry.forecastMonth,
    entry.forecastQuarter,
    entry.sourceType,
    entry.sourceFile,
    entry.sourceSheet,
    entry.sourceRow,
    entry.sourceRef,
    entry.sourceHash,
    entry.duplicateKey,
    importId,
    entry.notes,
  );
  recordImportChange(db, importId, { changeType: "added", sourceRef: entry.sourceRef, after: entry });
  return "added";
}

export function importOrderBookSheets(db, {
  fileName = "order-book.xlsx",
  sheets = [],
  overwriteApproved = false,
  dryRun = false,
  businessEntityId = DEFAULT_BUSINESS_ENTITY_ID,
} = {}) {
  const businessEntity = importBusinessEntity(db, businessEntityId);
  const sourceHash = sha256(stableJson({ businessEntityId: businessEntity.id, fileName, sheets }));
  const rows = [];
  for (const sheet of sheets) {
    const financialYear = detectFinancialYear(sheet.name);
    if (!financialYear) continue;
    for (const row of sheet.rows || []) {
      rows.push({ sheetName: sheet.name, row, rowNumber: row.__rowNumber || rows.length + 2, financialYear });
    }
  }

  const seenDuplicateKeys = new Map();
  const prepared = rows.map((item) => {
    const normalized = normalizeImportEntry({
      row: item.row,
      financialYear: item.financialYear,
      sheetName: item.sheetName,
      rowNumber: item.rowNumber,
      fileName,
      importId: null,
      businessEntity,
    });
    return {
      ...item,
      normalized,
      validationErrors: validateEntry(normalized),
    };
  });
  const duplicates = [];
  for (const item of prepared) {
    if (seenDuplicateKeys.has(item.normalized.duplicateKey)) duplicates.push(item.normalized.sourceRef);
    seenDuplicateKeys.set(item.normalized.duplicateKey, item.normalized.sourceRef);
  }

  const importId = createImportRecord(db, {
    sourceType: "excel_order_book",
    sourceName: fileName,
    businessEntityId: businessEntity.id,
    sourceHash,
    status: dryRun ? "dry_run" : "imported",
    rowsTotal: rows.length,
    rowsImported: 0,
    rowsUpdated: 0,
    duplicatesCount: duplicates.length,
    validationErrorsCount: prepared.filter((item) => item.validationErrors.length).length,
    overwriteApproved,
    summary: { businessEntityId: businessEntity.id, businessEntityName: businessEntity.name, sheets: sheets.map((sheet) => sheet.name), duplicates },
  });

  const stats = {
    importId,
    sourceName: fileName,
    businessEntityId: businessEntity.id,
    businessEntityName: businessEntity.name,
    status: dryRun ? "dry_run" : "imported",
    rowsTotal: rows.length,
    rowsImported: 0,
    rowsUpdated: 0,
    rowsUnchanged: 0,
    duplicates,
    validationErrors: [],
    overwriteRequired: [],
    approvalRequired: false,
    dryRun,
  };

  db.exec("BEGIN");
  try {
    for (const item of prepared) {
      if (item.validationErrors.length) {
        stats.validationErrors.push({ sourceRef: item.normalized.sourceRef, errors: item.validationErrors });
        recordImportChange(db, importId, {
          changeType: "validation_error",
          sourceRef: item.normalized.sourceRef,
          after: item.normalized,
          message: item.validationErrors.join("; "),
        });
        continue;
      }
      const financialYearRow = ensureFinancialYear(db, item.financialYear);
      const action = upsertOrderBookEntry(db, financialYearRow, { ...item.normalized, importId }, {
        overwriteApproved,
        dryRun,
        importId,
      });
      if (action === "added" || action === "would_add") stats.rowsImported += 1;
      if (action === "updated" || action === "would_update") stats.rowsUpdated += 1;
      if (action === "unchanged") stats.rowsUnchanged += 1;
      if (action === "overwrite_required") stats.overwriteRequired.push(item.normalized.sourceRef);
    }
    if (stats.overwriteRequired.length) {
      stats.approvalRequired = true;
      stats.status = "pending_overwrite";
      db.prepare("UPDATE financial_imports SET status = ?, summary = ? WHERE id = ?")
        .run("pending_overwrite", JSON.stringify({ ...stats, boundary: FINANCIAL_READ_ONLY_BOUNDARY }), importId);
    } else {
      db.prepare(`
        UPDATE financial_imports
        SET rows_imported = ?, rows_updated = ?, validation_errors_count = ?, summary = ?
        WHERE id = ?
      `).run(
        stats.rowsImported,
        stats.rowsUpdated,
        stats.validationErrors.length,
        JSON.stringify({ ...stats, boundary: FINANCIAL_READ_ONLY_BOUNDARY }),
        importId,
      );
    }
    recordFinancialAudit(db, {
      eventType: dryRun ? "order_book_import_dry_run" : stats.approvalRequired ? "order_book_import_pending_overwrite" : "order_book_import",
      source: fileName,
      businessEntityId: businessEntity.id,
      metadata: stats,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.prepare("UPDATE financial_imports SET status = ?, summary = ? WHERE id = ?")
      .run("failed", JSON.stringify({ error: error.message }), importId);
    throw error;
  }

  return stats;
}

export function importOrderBookWorkbook(db, payload = {}) {
  const parsed = payload.sheets
    ? { fileName: payload.fileName || "order-book.json", sheets: payload.sheets }
    : parseOrderBookWorkbookFromBase64({
        fileName: payload.fileName,
        dataBase64: payload.dataBase64,
      });
  return importOrderBookSheets(db, {
    fileName: parsed.fileName,
    sheets: parsed.sheets,
    overwriteApproved: Boolean(payload.overwriteApproved),
    dryRun: Boolean(payload.dryRun),
    businessEntityId: payload.businessEntityId || DEFAULT_BUSINESS_ENTITY_ID,
  });
}

export function listFinancialImports(db, limit = 20) {
  return db.prepare(`
    SELECT *
    FROM financial_imports
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 20, 1), 100)).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    sourceName: row.source_name,
    businessEntityId: row.business_entity_id,
    status: row.status,
    rowsTotal: row.rows_total,
    rowsImported: row.rows_imported,
    rowsUpdated: row.rows_updated,
    duplicatesCount: row.duplicates_count,
    validationErrorsCount: row.validation_errors_count,
    overwriteApproved: Boolean(row.overwrite_approved),
    summary: JSON.parse(row.summary || "{}"),
    createdAt: toIsoTimestamp(row.created_at),
  }));
}

function listOrderBookEntries(db, scope) {
  const where = scopeWhereClause("e", scope?.entityIds);
  return db.prepare(`
    SELECT e.*, y.label AS financial_year, y.start_date, y.end_date,
           b.name AS business_entity_name, b.entity_type AS business_entity_type
    FROM order_book_entries e
    JOIN financial_years y ON y.id = e.financial_year_id
    LEFT JOIN financial_business_entities b ON b.id = e.business_entity_id
    WHERE ${where.clause}
    ORDER BY y.start_date ASC, e.client_name ASC, e.project_name ASC
  `).all(...where.params).map((row) => ({
    id: row.id,
    financialYearId: row.financial_year_id,
    financialYear: row.financial_year,
    businessEntityId: row.business_entity_id,
    businessEntityName: row.business_entity_name || row.business_entity_id,
    businessEntityType: row.business_entity_type || "",
    companyId: row.company_id,
    clientName: row.client_name,
    projectName: row.project_name,
    serviceLine: row.service_line,
    title: row.title,
    entryType: row.entry_type,
    status: row.status,
    amountGbp: row.amount_gbp,
    probability: row.probability,
    weightedAmountGbp: row.weighted_amount_gbp,
    forecastMonth: row.forecast_month,
    forecastQuarter: row.forecast_quarter,
    sourceRef: row.source_ref,
    sourceFile: row.source_file,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
    notes: row.notes,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  }));
}

function groupSum(entries, key, amountKey = "amountGbp") {
  const grouped = new Map();
  for (const entry of entries) {
    const label = entry[key] || "Unassigned";
    grouped.set(label, (grouped.get(label) || 0) + (Number(entry[amountKey]) || 0));
  }
  return [...grouped.entries()]
    .map(([label, amountGbp]) => ({ label, amountGbp }))
    .sort((a, b) => b.amountGbp - a.amountGbp);
}

function listInvoices(db, scope) {
  const where = scopeWhereClause("i", scope?.entityIds);
  return db.prepare(`
    SELECT i.*, b.name AS business_entity_name, b.entity_type AS business_entity_type
    FROM invoice_summaries i
    LEFT JOIN financial_business_entities b ON b.id = i.business_entity_id
    WHERE ${where.clause}
    ORDER BY i.due_date ASC, i.id ASC
  `).all(...where.params).map((row) => ({
    id: row.id,
    businessEntityId: row.business_entity_id,
    businessEntityName: row.business_entity_name || row.business_entity_id,
    businessEntityType: row.business_entity_type || "",
    sourceSystem: row.source_system,
    externalId: row.external_id,
    clientName: row.client_name,
    projectName: row.project_name,
    invoiceReference: row.invoice_reference,
    amountGbp: row.amount_gbp,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    status: row.status,
    rawSummary: JSON.parse(row.raw_summary || "{}"),
    lastRefreshedAt: toIsoTimestamp(row.last_refreshed_at),
  }));
}

function listDebtors(db, scope) {
  const where = scopeWhereClause("d", scope?.entityIds);
  return db.prepare(`
    SELECT d.*, b.name AS business_entity_name, b.entity_type AS business_entity_type
    FROM debtor_summaries d
    LEFT JOIN financial_business_entities b ON b.id = d.business_entity_id
    WHERE ${where.clause}
    ORDER BY d.amount_overdue_gbp DESC, d.amount_outstanding_gbp DESC
  `).all(...where.params).map((row) => ({
    id: row.id,
    businessEntityId: row.business_entity_id,
    businessEntityName: row.business_entity_name || row.business_entity_id,
    businessEntityType: row.business_entity_type || "",
    sourceSystem: row.source_system,
    clientName: row.client_name,
    amountOutstandingGbp: row.amount_outstanding_gbp,
    amountOverdueGbp: row.amount_overdue_gbp,
    invoiceCount: row.invoice_count,
    oldestDueDate: row.oldest_due_date,
    lastRefreshedAt: toIsoTimestamp(row.last_refreshed_at),
  }));
}

export function calculateForecast(entries) {
  const secured = entries.filter((entry) => entry.entryType === "secured");
  const pipeline = entries.filter((entry) => entry.entryType !== "secured");
  const securedRevenue = secured.reduce((sum, entry) => sum + entry.amountGbp, 0);
  const pipelineRevenue = pipeline.reduce((sum, entry) => sum + entry.amountGbp, 0);
  const weightedForecastRevenue = entries.reduce((sum, entry) => sum + entry.weightedAmountGbp, 0);
  const monthly = groupSum(entries.filter((entry) => entry.forecastMonth), "forecastMonth", "weightedAmountGbp");
  const quarterly = groupSum(entries.filter((entry) => entry.forecastQuarter), "forecastQuarter", "weightedAmountGbp");
  const annual = groupSum(entries, "financialYear", "weightedAmountGbp");
  return {
    securedRevenue,
    pipelineRevenue,
    weightedForecastRevenue,
    bestCase: securedRevenue + pipelineRevenue,
    expectedCase: weightedForecastRevenue,
    worstCase: securedRevenue + pipelineRevenue * 0.25,
    probabilityWeighted: weightedForecastRevenue,
    byBusiness: groupSum(entries, "businessEntityName", "weightedAmountGbp"),
    resourceRevenue: groupSum(entries, "serviceLine", "weightedAmountGbp"),
    monthly,
    quarterly,
    annual,
    gapAnalysis: annual.map((item) => ({
      financialYear: item.label,
      expectedGbp: item.amountGbp,
      securedGbp: entries
        .filter((entry) => entry.financialYear === item.label && entry.entryType === "secured")
        .reduce((sum, entry) => sum + entry.amountGbp, 0),
      pipelineDependencyGbp: item.amountGbp - entries
        .filter((entry) => entry.financialYear === item.label && entry.entryType === "secured")
        .reduce((sum, entry) => sum + entry.amountGbp, 0),
    })),
  };
}

export function saveMondayFinancialSummaries(db, {
  invoiceSummaries = [],
  source = "monday",
  businessEntityId = DEFAULT_BUSINESS_ENTITY_ID,
} = {}) {
  const now = new Date().toISOString();
  const businessEntity = importBusinessEntity(db, businessEntityId);
  const upsertInvoice = db.prepare(`
    INSERT INTO invoice_summaries (
      business_entity_id, source_system, external_id, client_name, project_name, invoice_reference,
      amount_gbp, issued_date, due_date, paid_date, status, raw_summary,
      last_refreshed_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(business_entity_id, source_system, external_id) DO UPDATE SET
      client_name = excluded.client_name,
      project_name = excluded.project_name,
      invoice_reference = excluded.invoice_reference,
      amount_gbp = excluded.amount_gbp,
      issued_date = excluded.issued_date,
      due_date = excluded.due_date,
      paid_date = excluded.paid_date,
      status = excluded.status,
      raw_summary = excluded.raw_summary,
      last_refreshed_at = excluded.last_refreshed_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  for (const invoice of invoiceSummaries) {
    upsertInvoice.run(
      businessEntity.id,
      source,
      String(invoice.externalId),
      normalizeText(invoice.clientName),
      normalizeText(invoice.projectName),
      normalizeText(invoice.invoiceReference || invoice.externalId),
      toNumber(invoice.amountGbp),
      normalizeText(invoice.issuedDate),
      normalizeText(invoice.dueDate),
      normalizeText(invoice.paidDate),
      ["issued", "paid", "overdue", "draft", "unknown"].includes(invoice.status) ? invoice.status : "unknown",
      JSON.stringify(invoice.rawSummary || {}),
      now,
    );
  }

  db.prepare("DELETE FROM debtor_summaries WHERE source_system = ? AND business_entity_id = ?").run(source, businessEntity.id);
  const invoices = listInvoices(db, { entityIds: [businessEntity.id] }).filter((invoice) => invoice.sourceSystem === source);
  const byClient = new Map();
  for (const invoice of invoices.filter((item) => item.status !== "paid")) {
    const client = invoice.clientName || "Unassigned";
    const current = byClient.get(client) || {
      amountOutstandingGbp: 0,
      amountOverdueGbp: 0,
      invoiceCount: 0,
      oldestDueDate: "",
    };
    current.amountOutstandingGbp += invoice.amountGbp;
    current.amountOverdueGbp += invoice.status === "overdue" ? invoice.amountGbp : 0;
    current.invoiceCount += 1;
    if (invoice.dueDate && (!current.oldestDueDate || invoice.dueDate < current.oldestDueDate)) current.oldestDueDate = invoice.dueDate;
    byClient.set(client, current);
  }
  const insertDebtor = db.prepare(`
    INSERT INTO debtor_summaries (
      business_entity_id, source_system, client_name, amount_outstanding_gbp, amount_overdue_gbp,
      invoice_count, oldest_due_date, last_refreshed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [clientName, debtor] of byClient.entries()) {
    insertDebtor.run(businessEntity.id, source, clientName, debtor.amountOutstandingGbp, debtor.amountOverdueGbp, debtor.invoiceCount, debtor.oldestDueDate, now);
  }

  recordFinancialAudit(db, {
    eventType: "monday_financial_refresh",
    source,
    businessEntityId: businessEntity.id,
    metadata: {
      businessEntityId: businessEntity.id,
      businessEntityName: businessEntity.name,
      invoicesRead: invoiceSummaries.length,
      externalWritesEnabled: false,
    },
  });
  return {
    businessEntityId: businessEntity.id,
    businessEntityName: businessEntity.name,
    invoicesStored: invoiceSummaries.length,
    debtorsStored: byClient.size,
    refreshedAt: now,
    readOnly: true,
  };
}

export function getFinancialDashboardData(db, options = {}) {
  const scope = normalizeFinancialScope(db, options);
  const entries = listOrderBookEntries(db, scope);
  const invoices = listInvoices(db, scope);
  const debtors = listDebtors(db, scope);
  const forecast = calculateForecast(entries);
  const invoiceStatus = Object.fromEntries(["issued", "paid", "overdue", "draft", "unknown"].map((status) => [
    status,
    invoices.filter((invoice) => invoice.status === status).reduce((sum, invoice) => sum + invoice.amountGbp, 0),
  ]));
  const risks = generateFinancialRisks({ entries, debtors, forecast });
  const opportunities = generateFinancialOpportunities({ entries, forecast });
  return {
    boundary: FINANCIAL_READ_ONLY_BOUNDARY,
    businessEntities: scope.businessEntities,
    scope: {
      type: scope.scopeType,
      id: scope.scopeId,
      label: scope.label,
      entityIds: scope.entityIds,
    },
    metrics: {
      securedRevenue: forecast.securedRevenue,
      pipelineRevenue: forecast.pipelineRevenue,
      weightedForecastRevenue: forecast.weightedForecastRevenue,
      outstandingDebtors: debtors.reduce((sum, debtor) => sum + debtor.amountOutstandingGbp, 0),
      overdueDebtors: debtors.reduce((sum, debtor) => sum + debtor.amountOverdueGbp, 0),
      invoiceCount: invoices.length,
      orderBookEntries: entries.length,
    },
    revenueByFinancialYear: forecast.annual,
    revenueByQuarter: forecast.quarterly,
    revenueByBusiness: forecast.byBusiness,
    revenueByClient: groupSum(entries, "clientName", "weightedAmountGbp"),
    revenueByProject: groupSum(entries, "projectName", "weightedAmountGbp"),
    revenueByServiceLine: forecast.resourceRevenue,
    invoiceStatus,
    debtors,
    forecast,
    risks,
    opportunities,
    recentImports: listFinancialImports(db, 5),
    monday: {
      invoices,
      readOnly: true,
    },
  };
}

function generateFinancialRisks({ entries, debtors, forecast }) {
  const risks = [];
  const byClient = groupSum(entries, "clientName", "weightedAmountGbp");
  const topClient = byClient[0];
  if (topClient && forecast.weightedForecastRevenue && topClient.amountGbp / forecast.weightedForecastRevenue > 0.4) {
    risks.push({
      title: "Revenue concentration risk",
      detail: `${topClient.label} represents ${Math.round((topClient.amountGbp / forecast.weightedForecastRevenue) * 100)}% of weighted forecast revenue.`,
      severity: "high",
      sourceRef: `client:${topClient.label}`,
    });
  }
  const overdue = debtors.reduce((sum, debtor) => sum + debtor.amountOverdueGbp, 0);
  if (overdue > 0) {
    risks.push({
      title: "Overdue debtor exposure",
      detail: `Outstanding overdue debtor balance is £${Math.round(overdue).toLocaleString("en-GB")}.`,
      severity: overdue > 25_000 ? "high" : "medium",
      sourceRef: "monday:overdue_invoices",
    });
  }
  if (forecast.pipelineRevenue > forecast.securedRevenue) {
    risks.push({
      title: "Pipeline dependency",
      detail: "Pipeline value is greater than secured revenue, so forecast delivery depends on conversion quality.",
      severity: "medium",
      sourceRef: "order_book:pipeline",
    });
  }
  return risks;
}

function generateFinancialOpportunities({ entries, forecast }) {
  const opportunities = [];
  const serviceLine = forecast.resourceRevenue[0];
  if (serviceLine) {
    opportunities.push({
      title: "Scale strongest service line",
      detail: `${serviceLine.label} is the largest weighted revenue line. Review capacity and margin upside.`,
      valueGbp: serviceLine.amountGbp,
      probability: 0.7,
      sourceRef: `service_line:${serviceLine.label}`,
    });
  }
  const pipeline = entries.filter((entry) => entry.entryType !== "secured" && entry.probability >= 0.6);
  const value = pipeline.reduce((sum, entry) => sum + entry.weightedAmountGbp, 0);
  if (value > 0) {
    opportunities.push({
      title: "Convert high-probability pipeline",
      detail: "High-probability pipeline should be reviewed for close plans and resourcing.",
      valueGbp: value,
      probability: 0.75,
      sourceRef: "order_book:high_probability_pipeline",
    });
  }
  return opportunities;
}

export function generateOliviaAnalysis(db, options = {}) {
  const dashboard = getFinancialDashboardData(db, options);
  const insights = [
    ...dashboard.risks.map((risk) => ({
      type: "risk",
      title: risk.title,
      detail: risk.detail,
      severity: risk.severity,
      recommendation: risk.title.includes("debtor")
        ? "Review debtor position and agree a human-approved client communication plan before any chase action."
        : "Review concentration and conversion assumptions at the next executive finance review.",
      sourceRef: risk.sourceRef,
    })),
    ...dashboard.opportunities.map((opportunity) => ({
      type: "opportunity",
      title: opportunity.title,
      detail: opportunity.detail,
      severity: "medium",
      recommendation: "Confirm capacity, margin and owner before committing additional growth activity.",
      sourceRef: opportunity.sourceRef,
    })),
  ];
  if (!insights.length) {
    insights.push({
      type: "baseline",
      title: "Financial intelligence baseline",
      detail: `Import order book and read-only invoice summaries for ${dashboard.scope.label} to unlock richer CFO analysis.`,
      severity: "low",
      recommendation: "Start with the relevant business order book import and a read-only Monday refresh.",
      sourceRef: "financial_dashboard",
    });
  }
  recordFinancialAudit(db, {
    eventType: "olivia_analysis_generated",
    source: "financial_dashboard",
    businessEntityId: dashboard.scope.id,
    metadata: {
      scope: dashboard.scope,
      insightCount: insights.length,
      externalWritesEnabled: false,
    },
  });
  return {
    generatedAt: new Date().toISOString(),
    role: "Olivia - Chief Financial Officer",
    scope: dashboard.scope,
    boundary: FINANCIAL_READ_ONLY_BOUNDARY,
    executiveSummary: insights.slice(0, 3).map((item) => item.title).join("; "),
    insights,
    decisionsRequired: insights
      .filter((item) => item.severity === "high")
      .map((item) => ({ title: item.title, reason: item.detail, sourceRef: item.sourceRef })),
    recommendedActions: insights.map((item) => ({
      action: item.recommendation,
      requiresApproval: true,
      executionAvailable: false,
      sourceRef: item.sourceRef,
    })),
  };
}

export function generateBoardReport(db, {
  financialYearId = null,
  quarter = "",
  scopeType = "group",
  scopeId = DEFAULT_GROUP_ENTITY_ID,
  businessEntityId = "",
} = {}) {
  const dashboard = getFinancialDashboardData(db, { scopeType, scopeId, businessEntityId });
  const year = financialYearId
    ? db.prepare("SELECT * FROM financial_years WHERE id = ?").get(financialYearId)
    : db.prepare("SELECT * FROM financial_years ORDER BY start_date DESC LIMIT 1").get();
  const title = `${dashboard.scope.label} ${year?.label || "Financial"} ${quarter || "Board"} Report`;
  const olivia = generateOliviaAnalysis(db, { scopeType: dashboard.scope.type, scopeId: dashboard.scope.id });
  const lines = [
    `# ${title}`,
    "",
    "## Executive Summary",
    `Reporting scope: ${dashboard.scope.label} (${dashboard.scope.type}).`,
    "",
    olivia.executiveSummary || "No material financial exceptions detected.",
    "",
    "## Revenue Performance",
    `Secured revenue: £${Math.round(dashboard.metrics.securedRevenue).toLocaleString("en-GB")}.`,
    `Weighted forecast revenue: £${Math.round(dashboard.metrics.weightedForecastRevenue).toLocaleString("en-GB")}.`,
    "",
    "## Order Book Position",
    `Order book entries: ${dashboard.metrics.orderBookEntries}. Pipeline revenue: £${Math.round(dashboard.metrics.pipelineRevenue).toLocaleString("en-GB")}.`,
    "",
    "## Forecast",
    `Best case: £${Math.round(dashboard.forecast.bestCase).toLocaleString("en-GB")}. Expected case: £${Math.round(dashboard.forecast.expectedCase).toLocaleString("en-GB")}. Worst case: £${Math.round(dashboard.forecast.worstCase).toLocaleString("en-GB")}.`,
    "",
    "## Pipeline",
    dashboard.revenueByClient.slice(0, 5).map((item) => `- ${item.label}: £${Math.round(item.amountGbp).toLocaleString("en-GB")}`).join("\n") || "- No pipeline data imported.",
    "",
    "## Cashflow Commentary",
    `Outstanding debtors: £${Math.round(dashboard.metrics.outstandingDebtors).toLocaleString("en-GB")}. Overdue: £${Math.round(dashboard.metrics.overdueDebtors).toLocaleString("en-GB")}.`,
    "",
    "## Client Performance",
    dashboard.revenueByClient.slice(0, 5).map((item) => `- ${item.label}: £${Math.round(item.amountGbp).toLocaleString("en-GB")}`).join("\n") || "- No client revenue data imported.",
    "",
    "## Project Performance",
    dashboard.revenueByProject.slice(0, 5).map((item) => `- ${item.label}: £${Math.round(item.amountGbp).toLocaleString("en-GB")}`).join("\n") || "- No project revenue data imported.",
    "",
    "## Financial Risks",
    dashboard.risks.map((risk) => `- ${risk.title}: ${risk.detail}`).join("\n") || "- No financial risks detected from current records.",
    "",
    "## Financial Opportunities",
    dashboard.opportunities.map((opportunity) => `- ${opportunity.title}: ${opportunity.detail}`).join("\n") || "- No financial opportunities detected from current records.",
    "",
    "## Recommendations",
    olivia.recommendedActions.map((action) => `- ${action.action}`).join("\n"),
    "",
    "## Decisions Required",
    olivia.decisionsRequired.map((decision) => `- ${decision.title}: ${decision.reason}`).join("\n") || "- No board decisions required from current financial data.",
    "",
    "_Read-only financial intelligence report. No invoices, payments, accounting records or external systems were modified._",
  ];
  const summary = {
    scope: dashboard.scope,
    securedRevenue: dashboard.metrics.securedRevenue,
    weightedForecastRevenue: dashboard.metrics.weightedForecastRevenue,
    outstandingDebtors: dashboard.metrics.outstandingDebtors,
    overdueDebtors: dashboard.metrics.overdueDebtors,
    riskCount: dashboard.risks.length,
    opportunityCount: dashboard.opportunities.length,
  };
  const result = db.prepare(`
    INSERT INTO board_reports (
      business_entity_id, scope_type, scope_id, financial_year_id, quarter, title, summary, markdown
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dashboard.scope.id,
    dashboard.scope.type,
    dashboard.scope.id,
    year?.id || null,
    String(quarter || ""),
    title,
    JSON.stringify(summary),
    lines.join("\n"),
  );
  recordFinancialAudit(db, {
    eventType: "board_report_generated",
    source: title,
    businessEntityId: dashboard.scope.id,
    metadata: { reportId: Number(result.lastInsertRowid), scope: dashboard.scope, externalWritesEnabled: false },
  });
  return getBoardReport(db, Number(result.lastInsertRowid));
}

export function getBoardReport(db, id) {
  const row = db.prepare("SELECT * FROM board_reports WHERE id = ?").get(id);
  if (!row) return null;
  return {
    id: row.id,
    businessEntityId: row.business_entity_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    financialYearId: row.financial_year_id,
    quarter: row.quarter,
    title: row.title,
    summary: JSON.parse(row.summary || "{}"),
    markdown: row.markdown,
    generatedBy: row.generated_by,
    generatedAt: toIsoTimestamp(row.generated_at),
  };
}

export function listBoardReports(db, limit = 20) {
  return db.prepare(`
    SELECT *
    FROM board_reports
    ORDER BY generated_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 20, 1), 100)).map((row) => ({
    id: row.id,
    businessEntityId: row.business_entity_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    financialYearId: row.financial_year_id,
    quarter: row.quarter,
    title: row.title,
    summary: JSON.parse(row.summary || "{}"),
    generatedBy: row.generated_by,
    generatedAt: toIsoTimestamp(row.generated_at),
  }));
}

export function listFinancialAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM financial_audit_events
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    id: row.id,
    businessEntityId: row.business_entity_id,
    eventType: row.event_type,
    actor: row.actor,
    source: row.source,
    metadata: JSON.parse(row.metadata || "{}"),
    createdAt: toIsoTimestamp(row.created_at),
  }));
}
