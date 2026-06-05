import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESOURCE_CONFIG,
  createApprovalRequest,
  createDatabase,
  createResource,
  deleteResource,
  getApprovalRequest,
  getApprovalSummary,
  getDashboardData,
  getBriefing,
  getMorningBrief,
  listApprovalRequests,
  listBriefings,
  listResource,
  reviewApprovalRequest,
  saveBriefing,
  saveBriefingFeedback,
  setIntegrationStatus,
  updateResource,
} from "./db.js";
import { buildExecutiveAnalysis } from "./briefing.js";
import { MICROSOFT_SCOPES, MicrosoftGraphClient } from "./microsoft.js";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const db = createDatabase();
const microsoft = new MicrosoftGraphClient();

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { status: "ok", database: "connected" });
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    return sendJson(response, 200, getDashboardData(db));
  }
  if (request.method === "GET" && url.pathname === "/api/morning-brief") {
    return sendJson(response, 200, await generateExecutiveBrief());
  }
  if (request.method === "GET" && url.pathname === "/api/briefings") {
    return sendJson(response, 200, listBriefings(db, url.searchParams.get("limit") || 20));
  }
  if (url.pathname === "/api/approvals") {
    if (request.method === "GET") {
      return sendJson(response, 200, {
        items: listApprovalRequests(db, url.searchParams.get("status") || ""),
        summary: getApprovalSummary(db),
      });
    }
    if (request.method === "POST") {
      return sendJson(response, 201, createApprovalRequest(db, await readJson(request)));
    }
  }
  const approvalMatch = url.pathname.match(/^\/api\/approvals\/(\d+)(?:\/(approve|reject|cancel))?$/);
  if (approvalMatch) {
    const approvalId = Number(approvalMatch[1]);
    const action = approvalMatch[2];
    if (request.method === "GET" && !action) {
      const approval = getApprovalRequest(db, approvalId);
      return approval
        ? sendJson(response, 200, approval)
        : sendJson(response, 404, { error: "Approval request not found" });
    }
    if (request.method === "POST" && action) {
      const decisions = { approve: "approved", reject: "rejected", cancel: "cancelled" };
      return sendJson(
        response,
        200,
        reviewApprovalRequest(db, approvalId, decisions[action], await readJson(request)),
      );
    }
  }
  const briefingMatch = url.pathname.match(/^\/api\/briefings\/(\d+)(?:\/feedback)?$/);
  if (briefingMatch) {
    const briefingId = Number(briefingMatch[1]);
    if (request.method === "GET" && !url.pathname.endsWith("/feedback")) {
      const briefing = getBriefing(db, briefingId);
      return briefing
        ? sendJson(response, 200, briefing)
        : sendJson(response, 404, { error: "Briefing not found" });
    }
    if (request.method === "POST" && url.pathname.endsWith("/feedback")) {
      return sendJson(response, 201, saveBriefingFeedback(db, briefingId, await readJson(request)));
    }
  }

  if (url.pathname === "/api/microsoft/status" && request.method === "GET") {
    return sendJson(response, 200, {
      ...(await syncMicrosoftStatus()),
      scopes: MICROSOFT_SCOPES,
      readOnly: true,
    });
  }
  if (url.pathname === "/api/microsoft/connect" && request.method === "POST") {
    return sendJson(response, 200, await microsoft.startDeviceFlow());
  }
  if (url.pathname === "/api/microsoft/connect/complete" && request.method === "POST") {
    try {
      await microsoft.completeDeviceFlow();
      return sendJson(response, 200, await syncMicrosoftStatus());
    } catch (error) {
      if (error.statusCode === 202) {
        return sendJson(response, 202, {
          pending: true,
          retryAfter: error.retryAfter,
          message: "Waiting for Microsoft authorization",
        });
      }
      throw error;
    }
  }
  if (url.pathname === "/api/microsoft/messages" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listMessages({
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 15,
    }));
  }
  if (url.pathname === "/api/microsoft/calendar" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listCalendar({
      start: url.searchParams.get("start") || undefined,
      end: url.searchParams.get("end") || undefined,
      limit: url.searchParams.get("limit") || 25,
    }));
  }
  if (url.pathname === "/api/microsoft/files" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listFiles({
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 20,
    }));
  }

  const match = url.pathname.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?$/);
  if (!match) return sendJson(response, 404, { error: "API route not found" });

  const [, resource, id] = match;
  if (!RESOURCE_CONFIG[resource]) {
    return sendJson(response, 404, { error: "API resource not found" });
  }

  if (request.method === "GET" && !id) {
    return sendJson(response, 200, listResource(db, resource));
  }
  if (request.method === "GET" && id) {
    const record = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(decodeURIComponent(id));
    if (!record) return sendJson(response, 404, { error: `${resource.slice(0, -1)} not found` });
    const records = listResource(db, resource);
    return sendJson(response, 200, records.find((item) => String(item.id) === String(id)));
  }
  if (request.method === "POST" && !id) {
    const record = createResource(db, resource, await readJson(request));
    return sendJson(response, 201, record);
  }
  if ((request.method === "PATCH" || request.method === "PUT") && id) {
    const record = updateResource(db, resource, decodeURIComponent(id), await readJson(request));
    return sendJson(response, 200, record);
  }
  if (request.method === "DELETE" && id) {
    deleteResource(db, resource, decodeURIComponent(id));
    response.writeHead(204);
    return response.end();
  }

  response.setHeader("Allow", id ? "PATCH, PUT, DELETE" : "GET, POST");
  return sendJson(response, 405, { error: "Method not allowed" });
}

async function generateExecutiveBrief() {
  const brief = getMorningBrief(db);
  const dashboard = getDashboardData(db);
  const microsoftStatus = await microsoft.status();
  brief.microsoft = microsoftStatus;
  let messages = [];
  let meetings = [];

  if (microsoftStatus.connected) {
    [messages, meetings] = await Promise.all([
      microsoft.listMessages({ limit: 30 }),
      microsoft.listCalendar({ limit: 25 }),
    ]);
  }

  const analysis = buildExecutiveAnalysis({
    baseBrief: brief,
    messages,
    meetings,
    clients: dashboard.clients,
    projects: dashboard.projects,
  });

  brief.emails = analysis.priorityEmails.slice(0, 10).map((message) => ({
    id: message.id,
    title: message.subject || "(No subject)",
    detail: message.detail,
    receivedDateTime: message.receivedDateTime,
    isRead: message.isRead,
    importance: message.importance,
    priority: message.priority,
    score: message.score,
    reasons: message.reasons,
    webLink: message.webLink,
  }));
  brief.meetings = {
    available: microsoftStatus.connected,
    items: analysis.meetingPreparation,
    message: microsoftStatus.connected
      ? analysis.meetingPreparation.length
        ? ""
        : "No meetings are scheduled in the next seven days."
      : "Calendar is not connected. No meeting data was reviewed.",
  };
  brief.riskSignals = analysis.riskSignals;
  brief.decisionPrompts = analysis.decisionPrompts;
  brief.executivePriorities = analysis.executivePriorities;
  brief.summary.priorityEmails = analysis.priorityEmails.filter((email) => email.priority === "high").length;
  brief.summary.meetingsToday = analysis.meetingPreparation.filter((meeting) => meeting.hoursUntil >= 0 && meeting.hoursUntil <= 24).length;
  brief.summary.riskSignals = analysis.riskSignals.length;
  brief.summary.decisionPrompts = analysis.decisionPrompts.length;
  brief.analysisMethod = "deterministic-v1";

  const saved = saveBriefing(db, brief);
  return { ...brief, briefingId: saved.id };
}

async function syncMicrosoftStatus() {
  const status = await microsoft.status();
  if (!status.connected) {
    setIntegrationStatus(db, "outlook", "Not connected");
    setIntegrationStatus(db, "calendar", "Not connected");
    if (status.configured) setIntegrationStatus(db, "sharepoint", "Planned");
    return status;
  }

  const services = {
    profile: { connected: true },
    mail: { connected: false },
    calendar: { connected: false },
    files: { connected: false },
  };
  const checks = await Promise.allSettled([
    microsoft.listMessages({ limit: 1 }),
    microsoft.listCalendar({ limit: 1 }),
    microsoft.listFiles({ limit: 1 }),
  ]);
  services.mail = checks[0].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[0].reason.message };
  services.calendar = checks[1].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[1].reason.message };
  services.files = checks[2].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[2].reason.message };

  setIntegrationStatus(db, "outlook", services.mail.connected ? "Connected" : "Not connected");
  setIntegrationStatus(db, "calendar", services.calendar.connected ? "Connected" : "Not connected");
  setIntegrationStatus(db, "sharepoint", services.files.connected ? "Connected" : "Planned");
  return { ...status, services };
}

function serveStatic(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(ROOT_DIR, relativePath);
  const pathFromRoot = relative(ROOT_DIR, filePath);
  if (pathFromRoot.startsWith("..") || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (!serveStatic(response, decodeURIComponent(url.pathname))) {
      sendJson(response, 404, { error: "Not found" });
    }
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Internal server error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Alfred Core running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${process.env.ALFRED_DB_PATH || resolve(ROOT_DIR, "data", "alfred.db")}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
