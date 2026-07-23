// Zero-dependency server for The Wardrobe.
//
// Two jobs, one process:
//   1. POST /api/tag  — proxies auto-tagging to the Anthropic API, holding the
//      key server-side so it never reaches the browser.
//   2. everything else — serves the built static app from ../dist (used when the
//      app is deployed as a single service, e.g. on Render). In local dev the
//      Vite dev server serves the app and only proxies /api here, so static
//      serving is a no-op then.
//
// Run with: node server/index.js  (reads ANTHROPIC_API_KEY from the environment)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Tiny .env loader (no dependency): loads KEY=VALUE lines into process.env.
// A real environment variable (e.g. set in the Render dashboard) always wins.
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const DIST = fileURLToPath(new URL("../dist", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

// Serve a file from the built app, with an SPA fallback to index.html.
function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const resolved = path.normalize(path.join(DIST, urlPath));
  // Guard against path traversal outside the dist directory.
  if (resolved !== DIST && !resolved.startsWith(DIST + path.sep)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  fs.stat(resolved, (err, stat) => {
    const file = !err && stat.isDirectory() ? path.join(resolved, "index.html") : resolved;
    fs.readFile(file, (readErr, data) => {
      if (readErr) {
        // Unknown path → serve index.html so client-side routing / a fresh load works.
        fs.readFile(path.join(DIST, "index.html"), (fallbackErr, html) => {
          if (fallbackErr) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not built yet. Run `npm run build` first.");
          } else {
            res.writeHead(200, { "Content-Type": MIME[".html"] });
            res.end(html);
          }
        });
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
}

function handleTag(req, res) {
  if (!API_KEY) {
    return send(res, 503, { error: "ANTHROPIC_API_KEY is not set. Auto-tagging is disabled; the app falls back to manual tagging." });
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { base64, mediaType, categories, colors, tones, warmth, formality } = JSON.parse(raw);
      const prompt = `You are a fashion cataloguer. Look at this single clothing/accessory item and return ONLY a JSON object, no markdown, no prose. Schema:
{"category": one of ${JSON.stringify(categories)}, "color": one of ${JSON.stringify(colors)} (use "Multicolour" for patterned items, "Floral" for florals, "Black & White" for monochrome), "tone": one of ${JSON.stringify(tones)} ("Muted"=soft/dusty/pastel, "Classic"=standard, "Bold"=bright/vivid), "warmth": one of ${JSON.stringify(warmth)} (use "Not applicable" for jewellery), "formality": array from ${JSON.stringify(formality)}, "name": very short 2-4 word description, "brand": the brand/label name if you can read it from a clear LOGO or wordmark, or from legible TEXT anywhere in the photo (on the item, a neck/care label, a swing tag, or packaging) — transcribe the brand name exactly as shown; otherwise "" (only report a name you can actually see or read — never guess or infer from style), "brandUrl": that brand's official website homepage (e.g. "gucci.com") ONLY if you are confident and only when brand is set — otherwise ""}
Respond with JSON only.`;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return send(res, anthropicRes.status, { error: data?.error?.message || "Anthropic API error" });

      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const tags = JSON.parse(clean);
      send(res, 200, { tags });
    } catch (err) {
      send(res, 500, { error: String(err?.message || err) });
    }
  });
}

// Conversational stylist. The client sends a system prompt (persona + wardrobe
// context) and the message history; the reply is plain assistant text. Images
// (photos of past outfits) may ride along inside message content blocks.
function handleChat(req, res) {
  if (!API_KEY) {
    return send(res, 503, { error: "ANTHROPIC_API_KEY is not set. The AI stylist is unavailable; weather-based styling still works." });
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { system, messages, max_tokens } = JSON.parse(raw);
      if (!Array.isArray(messages) || !messages.length) return send(res, 400, { error: "messages required" });

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: Math.min(Math.max(Number(max_tokens) || 700, 1), 2000),
          // Accept either a plain string or an array of system blocks (the latter
          // lets the client mark a large, stable prefix — e.g. the closet — with
          // cache_control so repeat calls read it from cache instead of re-billing).
          system: (typeof system === "string" || Array.isArray(system)) ? system : undefined,
          messages,
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return send(res, anthropicRes.status, { error: data?.error?.message || "Anthropic API error" });

      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
      send(res, 200, { text });
    } catch (err) {
      send(res, 500, { error: String(err?.message || err) });
    }
  });
}

// Brand-only vision scan: read a brand/label from one photo (a clear logo/wordmark
// or legible text on the item, a tag, or packaging). Used to find brands in pieces
// already in the closet. Returns { brand, brandUrl } — empty when none is legible.
function handleBrand(req, res) {
  if (!API_KEY) {
    return send(res, 503, { error: "ANTHROPIC_API_KEY is not set. Brand scanning is disabled." });
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { base64, mediaType } = JSON.parse(raw);
      if (!base64) return send(res, 400, { error: "base64 required" });
      const prompt = `Look at this clothing/accessory photo. If you can read a brand/label name from a clear LOGO or wordmark, or from legible TEXT anywhere in the image (on the item, a neck/care label, a swing tag, or packaging), report it exactly as shown. Only report a name you can actually see or read — never guess or infer from style. Return ONLY JSON, no prose: {"brand": name or "", "brandUrl": that brand's official homepage like "gucci.com" (only if confident and brand is set) or ""}`;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return send(res, anthropicRes.status, { error: data?.error?.message || "Anthropic API error" });
      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      let brand = "", brandUrl = "";
      try { const j = JSON.parse(clean); brand = (j.brand || "").trim(); brandUrl = (j.brandUrl || "").trim(); } catch {}
      send(res, 200, { brand, brandUrl });
    } catch (err) {
      send(res, 500, { error: String(err?.message || err) });
    }
  });
}

// Personal shopper. Like /api/chat, but with the Anthropic web-search server tool
// enabled so the shopper can look up brands, specific items, and current sales on
// the live web. The search runs server-side inside the same request; we return the
// model's final assistant text (which includes any links it cites).
function handleShop(req, res) {
  if (!API_KEY) {
    return send(res, 503, { error: "ANTHROPIC_API_KEY is not set. The personal shopper is unavailable." });
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { system, messages, max_tokens } = JSON.parse(raw);
      if (!Array.isArray(messages) || !messages.length) return send(res, 400, { error: "messages required" });

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: Math.min(Math.max(Number(max_tokens) || 1200, 1), 2000),
          system: typeof system === "string" ? system : undefined,
          messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
        }),
      });

      const data = await anthropicRes.json();
      if (!anthropicRes.ok) return send(res, anthropicRes.status, { error: data?.error?.message || "Anthropic API error" });

      const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
      send(res, 200, { text });
    } catch (err) {
      send(res, 500, { error: String(err?.message || err) });
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.url === "/api/tag") {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    return handleTag(req, res);
  }
  if (req.url === "/api/chat") {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    return handleChat(req, res);
  }
  if (req.url === "/api/shop") {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    return handleShop(req, res);
  }
  if (req.url === "/api/brand") {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    return handleBrand(req, res);
  }
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  return send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`The Wardrobe running on http://localhost:${PORT}`);
  if (!API_KEY) console.log("⚠  ANTHROPIC_API_KEY not set — auto-tagging returns 503 and the app falls back to manual tagging.");
});
