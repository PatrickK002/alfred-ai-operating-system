// Minimal zero-dependency proxy so the Anthropic API key never reaches the browser.
// Run with: node server/index.js  (reads ANTHROPIC_API_KEY from the environment)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// Tiny .env loader (no dependency): loads KEY=VALUE lines into process.env.
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

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST" || req.url !== "/api/tag") return send(res, 404, { error: "Not found" });

  if (!API_KEY) {
    return send(res, 503, { error: "ANTHROPIC_API_KEY is not set. Auto-tagging is disabled; the app falls back to manual tagging." });
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      const { base64, mediaType, categories, colors, tones, warmth, formality } = JSON.parse(raw);
      const prompt = `You are a fashion cataloguer. Look at this single clothing/accessory item and return ONLY a JSON object, no markdown, no prose. Schema:
{"category": one of ${JSON.stringify(categories)}, "color": one of ${JSON.stringify(colors)} (use "Multicolour" for patterned items, "Floral" for florals, "Black & White" for monochrome), "tone": one of ${JSON.stringify(tones)} ("Muted"=soft/dusty/pastel, "Classic"=standard, "Bold"=bright/vivid), "warmth": one of ${JSON.stringify(warmth)} (use "Not applicable" for jewellery), "formality": array from ${JSON.stringify(formality)}, "name": very short 2-4 word description}
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
          max_tokens: 400,
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
});

server.listen(PORT, () => {
  console.log(`Tagging proxy on http://localhost:${PORT}`);
  if (!API_KEY) console.log("⚠  ANTHROPIC_API_KEY not set — auto-tagging will return 503 and the app falls back to manual tagging.");
});
