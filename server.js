import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESOURCE_CONFIG,
  createDatabase,
  createResource,
  deleteResource,
  getDashboardData,
  getMorningBrief,
  listResource,
  updateResource,
} from "./db.js";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const db = createDatabase();

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
    return sendJson(response, 200, getMorningBrief(db));
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

server.listen(PORT, () => {
  console.log(`Alfred Core running at http://localhost:${PORT}`);
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
