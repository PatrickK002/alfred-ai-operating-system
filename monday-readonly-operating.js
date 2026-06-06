import { MONDAY_API_URL, MONDAY_API_VERSION } from "./monday-finance.js";
import {
  AGENT_BOARD_MODELS,
  MONDAY_READONLY_OPERATING_BOUNDARY,
} from "./monday-operating-system.js";

function splitIds(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(value = "") {
  const text = clean(value);
  if (!text) return "";
  const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function createConfigurationError() {
  const error = new Error("Monday.com operating sync is not configured. Set MONDAY_API_TOKEN and MONDAY_OPERATING_BOARD_IDS.");
  error.statusCode = 503;
  error.code = "MONDAY_OPERATING_NOT_CONFIGURED";
  return error;
}

function createWriteBlockedError() {
  const error = new Error("Monday.com operating sync is read-only. GraphQL mutations are blocked.");
  error.statusCode = 400;
  error.code = "MONDAY_WRITE_BLOCKED";
  return error;
}

function columnMap(item) {
  const values = {};
  for (const column of item.column_values || []) {
    const title = clean(column.column?.title || column.title || column.id).toLowerCase();
    if (!title) continue;
    values[title] = clean(column.text || "");
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

function canonicalStatus(value = "") {
  const text = clean(value).toLowerCase().replace(/[_-]+/g, " ");
  if (!text) return "New";
  if (/complete|completed|done|closed/.test(text)) return "Complete";
  if (/reject|declin|cancel/.test(text)) return "Rejected";
  if (/approve|accepted/.test(text)) return "Approved";
  if (/review|qa|checking/.test(text)) return "Review";
  if (/block|stuck|hold/.test(text)) return "Blocked";
  if (/wait|pending|dependency/.test(text)) return "Waiting";
  if (/progress|started|doing|active/.test(text)) return "In Progress";
  if (/plan|backlog|scheduled/.test(text)) return "Planned";
  return "New";
}

function canonicalPriority(value = "") {
  const text = clean(value).toLowerCase();
  if (/critical|urgent|red|p1/.test(text)) return "Critical";
  if (/high|amber|p2/.test(text)) return "High";
  if (/low|green|p4/.test(text)) return "Low";
  return "Medium";
}

function inferAgentId(text = "") {
  const lower = clean(text).toLowerCase();
  for (const agent of AGENT_BOARD_MODELS) {
    if (lower.includes(agent.agentId) || lower.includes(agent.agentName.toLowerCase())) {
      return agent.agentId;
    }
  }
  if (/(bim|cobie|ifc|eir|air|bep|midp|tidp|iso 19650|digital construction|westminster|rbkc|islington|kspf)/i.test(lower)) return "sarah";
  if (/(invoice|cashflow|forecast|revenue|debtor|order book|finance|financial|board report)/i.test(lower)) return "olivia";
  if (/(property|portfolio|tenant|rent|yield|refinance|due diligence|westbridge)/i.test(lower)) return "westbridge-property-director";
  if (/(security|permission|access|mfa|gdpr|confidential|secret|data protection|sentinel)/i.test(lower)) return "sentinel";
  if (/(content|youtube|linkedin|tiktok|campaign|media)/i.test(lower)) return "maya";
  if (/(growth|sales|partnership|lead|pipeline|crm)/i.test(lower)) return "alex";
  if (/(platform|hosting|devops|technical debt|architecture|code|cto)/i.test(lower)) return "ethan";
  if (/(power apps|power bi|dataverse|sharepoint|power automate)/i.test(lower)) return "liam";
  if (/(product|saas|mvp|roadmap|feature)/i.test(lower)) return "james";
  return "alfred";
}

function businessEntityForAgent(agentId = "alfred", text = "") {
  const agent = AGENT_BOARD_MODELS.find((item) => item.agentId === agentId);
  const lower = clean(text).toLowerCase();
  if (/digitize|westminster|rbkc|islington|kspf/.test(lower)) return "digitize";
  if (/westbridge|property/.test(lower)) return "westbridge-property-group";
  if (/council assurance|product studio|saas/.test(lower)) return "council-assurance-platform";
  if (/media|youtube|linkedin|tiktok/.test(lower)) return "media-businesses";
  if (/venture|ai business/.test(lower)) return "ai-businesses";
  return agent?.businessEntityId || "group";
}

function companyForBusinessEntity(businessEntityId = "") {
  if (businessEntityId === "digitize") return "digitize";
  if (businessEntityId === "westbridge-property-group") return "westbridge";
  if (businessEntityId === "council-assurance-platform") return "product";
  if (businessEntityId === "media-businesses") return "media";
  if (businessEntityId === "ai-businesses") return "venture";
  return "";
}

function inferItemType(text = "") {
  const lower = clean(text).toLowerCase();
  if (/deliverable|output|report|pack|document/.test(lower)) return "deliverable";
  if (/decision|approval/.test(lower)) return "decision";
  if (/risk|issue|concern/.test(lower)) return "risk";
  if (/opportunity|lead|pipeline/.test(lower)) return "opportunity";
  if (/meeting|follow.?up/.test(lower)) return "meeting_followup";
  return "task";
}

function compactColumns(columns) {
  return Object.fromEntries(
    Object.entries(columns)
      .filter(([, value]) => value)
      .slice(0, 20),
  );
}

export function mapMondayItemToOperatingRecord(item, { boardId = "", boardName = "" } = {}) {
  const columns = columnMap(item);
  const board = clean(boardName || item.boardName || "");
  const groupName = clean(item.group?.title || item.groupName || "");
  const columnText = Object.values(columns).join(" ");
  const routingText = [
    board,
    groupName,
    item.name,
    firstValue(columns, "agent", "owner", "lead", "person", "specialist"),
    columnText,
  ].join(" ");
  const ownerAgentId = inferAgentId(routingText);
  const businessEntityId = clean(firstValue(columns, "business", "business entity", "company")) || businessEntityForAgent(ownerAgentId, routingText);
  const projectName = firstValue(columns, "project", "job", "scheme", "site");
  const clientName = firstValue(columns, "client", "customer", "organisation", "organization");
  const externalId = String(item.id || "");
  const resolvedBoardId = String(boardId || item.boardId || "");
  const title = clean(item.name || "Untitled Monday item");
  const detail = clean(firstValue(columns, "detail", "description", "summary", "notes", "brief"))
    || `Read-only Monday.com item imported from ${board || "configured board"}${groupName ? ` / ${groupName}` : ""}.`;

  return {
    sourceSystem: "monday",
    sourceType: "monday_readonly",
    externalId,
    boardId: resolvedBoardId,
    boardName: board,
    groupName,
    title,
    detail,
    itemType: inferItemType(`${board} ${groupName} ${title} ${detail}`),
    ownerAgentId,
    businessEntityId,
    companyId: companyForBusinessEntity(businessEntityId),
    clientName,
    projectName,
    priority: canonicalPriority(firstValue(columns, "priority", "urgency", "importance")),
    status: canonicalStatus(firstValue(columns, "status", "state", "stage", "progress")),
    dueDate: parseDate(firstValue(columns, "due", "due date", "deadline", "target date", "date")),
    mondayItemUrl: clean(item.url || ""),
    sourceReference: `Monday.com read-only (${board || resolvedBoardId}:${externalId}) - ${title}`,
    columnSummary: compactColumns(columns),
    rawSummary: {
      boardId: resolvedBoardId,
      boardName: board,
      groupName,
      itemId: externalId,
      itemName: title,
      updatedAt: item.updated_at || item.updatedAt || "",
      createdAt: item.created_at || item.createdAt || "",
      readOnly: true,
    },
  };
}

export class MondayOperatingReadClient {
  constructor({
    apiToken = process.env.MONDAY_API_TOKEN || "",
    boardIds = splitIds(process.env.MONDAY_OPERATING_BOARD_IDS),
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
      boundary: MONDAY_READONLY_OPERATING_BOUNDARY,
    };
  }

  async request(query, variables = {}) {
    if (/\bmutation\b/i.test(String(query || ""))) throw createWriteBlockedError();
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
        const timeout = new Error("Monday.com operating read timed out");
        timeout.statusCode = 504;
        timeout.code = "MONDAY_OPERATING_TIMEOUT";
        throw timeout;
      }
      throw error;
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.errors?.length) {
      const error = new Error(body.errors?.[0]?.message || `Monday.com operating read failed with status ${response.status}`);
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      error.code = "MONDAY_OPERATING_READ_FAILED";
      throw error;
    }
    return body.data || {};
  }

  async listBoardItems(boardId) {
    const query = `
      query ReadOperatingBoard($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          id
          name
          items_page(limit: 100, cursor: $cursor) {
            cursor
            items {
              id
              name
              url
              created_at
              updated_at
              group { id title }
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

  async fetchOperatingItems() {
    const status = this.status();
    if (!status.configured) throw createConfigurationError();
    const rawItems = [];
    for (const boardId of this.boardIds) {
      rawItems.push(...await this.listBoardItems(boardId));
    }
    return {
      items: rawItems.map((item) => mapMondayItemToOperatingRecord(item, {
        boardId: item.boardId,
        boardName: item.boardName,
      })),
      boardsRead: this.boardIds.length,
      itemsRead: rawItems.length,
      readOnly: true,
      writesEnabled: false,
      boundary: MONDAY_READONLY_OPERATING_BOUNDARY,
    };
  }
}
