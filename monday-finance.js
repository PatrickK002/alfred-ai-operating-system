export const MONDAY_API_URL = "https://api.monday.com/v2";
export const MONDAY_API_VERSION = "2025-04";

function splitIds(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseAmount(value) {
  const parsed = Number(String(value || "").replace(/£|,|\s/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value) {
  const text = normalizeText(value);
  if (!text) return "";
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function createConfigurationError() {
  const error = new Error("Monday.com finance connector is not configured. Set MONDAY_API_TOKEN and MONDAY_FINANCE_BOARD_IDS.");
  error.statusCode = 503;
  error.code = "MONDAY_NOT_CONFIGURED";
  return error;
}

function columnMap(item) {
  const values = {};
  for (const column of item.column_values || []) {
    const title = normalizeText(column.column?.title || column.title || column.id).toLowerCase();
    values[title] = normalizeText(column.text || "");
  }
  return values;
}

function firstValue(columns, ...aliases) {
  const keys = Object.keys(columns);
  for (const alias of aliases) {
    const exact = keys.find((key) => key === alias);
    if (exact && columns[exact]) return columns[exact];
    const partial = keys.find((key) => key.includes(alias));
    if (partial && columns[partial]) return columns[partial];
  }
  return "";
}

export function mapMondayItemToInvoiceSummary(item, { boardId, boardName } = {}) {
  const columns = columnMap(item);
  const statusText = normalizeText(firstValue(columns, "status", "invoice status", "payment status", "paid")).toLowerCase();
  const dueDate = parseDate(firstValue(columns, "due", "due date", "payment due"));
  const paidDate = parseDate(firstValue(columns, "paid date", "date paid", "payment date"));
  const amount = parseAmount(firstValue(columns, "amount", "value", "fee", "invoice amount", "total"));
  let status = "unknown";
  if (/paid|settled|complete/.test(statusText) || paidDate) status = "paid";
  else if (/overdue|late/.test(statusText) || (dueDate && Date.parse(dueDate) < Date.now())) status = "overdue";
  else if (/issued|sent|awaiting|unpaid|open/.test(statusText)) status = "issued";
  else if (/draft/.test(statusText)) status = "draft";

  return {
    sourceSystem: "monday",
    externalId: String(item.id),
    clientName: firstValue(columns, "client", "customer", "organisation", "organization") || item.group?.title || "",
    projectName: firstValue(columns, "project", "job", "assignment") || item.name,
    invoiceReference: firstValue(columns, "invoice", "invoice reference", "invoice no", "reference") || item.name,
    amountGbp: amount,
    issuedDate: parseDate(firstValue(columns, "issued", "issue date", "invoice date")),
    dueDate,
    paidDate,
    status,
    rawSummary: {
      boardId,
      boardName,
      itemId: item.id,
      itemName: item.name,
      group: item.group?.title || "",
      columns,
      updatedAt: item.updated_at,
      readOnly: true,
    },
  };
}

export class MondayFinanceClient {
  constructor({
    apiToken = process.env.MONDAY_API_TOKEN || "",
    boardIds = splitIds(process.env.MONDAY_FINANCE_BOARD_IDS),
    apiVersion = process.env.MONDAY_API_VERSION || MONDAY_API_VERSION,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30_000,
  } = {}) {
    this.apiToken = apiToken;
    this.boardIds = Array.isArray(boardIds) ? boardIds.map(String).filter(Boolean) : splitIds(boardIds);
    this.apiVersion = apiVersion;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  status() {
    return {
      configured: Boolean(this.apiToken && this.boardIds.length),
      boardIds: this.boardIds,
      readOnly: true,
      writesEnabled: false,
    };
  }

  async request(query, variables = {}) {
    if (!this.status().configured) throw createConfigurationError();
    const response = await this.fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiToken,
        "API-Version": this.apiVersion,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({ query, variables }),
    }).catch((error) => {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        const timeout = new Error("Monday.com read timed out");
        timeout.statusCode = 504;
        timeout.code = "MONDAY_TIMEOUT";
        throw timeout;
      }
      throw error;
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors?.length) {
      const error = new Error(body.errors?.[0]?.message || `Monday.com request failed with status ${response.status}`);
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      error.code = "MONDAY_READ_FAILED";
      throw error;
    }
    return body.data || {};
  }

  async listBoardItems(boardId) {
    const query = `
      query ReadFinanceBoard($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          id
          name
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
              updated_at
              group { title }
              column_values {
                id
                text
                value
                type
                column { title }
              }
            }
          }
        }
      }
    `;
    const items = [];
    let cursor = null;
    let boardName = "";
    do {
      const data = await this.request(query, { boardId: [String(boardId)], cursor });
      const board = data.boards?.[0];
      boardName = board?.name || boardName;
      const page = board?.items_page || {};
      items.push(...(page.items || []).map((item) => ({ ...item, boardId, boardName })));
      cursor = page.cursor || null;
    } while (cursor);
    return items;
  }

  async fetchFinancialSummaries() {
    const status = this.status();
    if (!status.configured) throw createConfigurationError();
    const allItems = [];
    for (const boardId of this.boardIds) {
      allItems.push(...await this.listBoardItems(boardId));
    }
    return {
      invoiceSummaries: allItems.map((item) => mapMondayItemToInvoiceSummary(item, {
        boardId: item.boardId,
        boardName: item.boardName,
      })),
      readOnly: true,
      writesEnabled: false,
    };
  }
}
