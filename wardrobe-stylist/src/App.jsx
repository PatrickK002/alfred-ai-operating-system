import React, { useState, useEffect, useRef, useContext, createContext } from "react";

// ---------- Category system ----------
const CATEGORIES = [
  "Tops", "Bottoms", "Dresses", "Jumpsuits", "Outerwear", "Shoes",
  "Bags", "Belts", "Accessories",
  "Necklaces", "Brooches", "Earrings", "Rings", "Bracelets",
];

// Which categories are "core" garments vs accessories for outfit building
const CORE = ["Tops", "Bottoms", "Dresses", "Jumpsuits", "Outerwear", "Shoes"];
const JEWELRY = ["Necklaces", "Brooches", "Earrings", "Rings", "Bracelets"];

const WARMTH = ["Very light", "Light", "Medium", "Warm", "Very warm", "Not applicable"];
const FORMALITY = ["Casual", "Work", "Going out"];
const TONES = ["Muted", "Classic", "Bold"];
const COLORS = [
  "Black", "White", "Black & White", "Grey", "Beige", "Cream", "Brown", "Tan",
  "Navy", "Blue", "Green", "Red", "Pink", "Purple", "Orange",
  "Yellow", "Gold", "Silver", "Denim", "Floral", "Multicolour",
];

// Style directions the AI stylist offers as Q1 quick-picks.
const STYLE_OPTIONS = [
  "Casual", "Smart / work", "Going out", "Elegant",
  "Streetwear", "Cosy", "Romantic", "Bold statement",
];

// ---------- Weather helpers ----------
function weatherLabel(code) {
  const m = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
    85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  return m[code] || "Unknown";
}
function isWet(code) {
  return [51,53,55,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99].includes(code);
}
// "Tue 22 Jul" style label for a forecast day (YYYY-MM-DD).
function dayLabel(iso) {
  try { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
  catch { return iso; }
}

// ---------- Saved-look season / temperature range ----------
// A rough °C each warmth level suits, used to estimate a look's climate when it has
// no weather stamp (e.g. holiday-plan looks). The warmest piece sets the coldest
// temperature the outfit is built for — a coat means winter.
const WARMTH_TEMP = { "Very warm": 4, "Warm": 11, "Medium": 18, "Light": 24, "Very light": 28 };
function estTempFromPieces(pieces, byId) {
  const ts = (pieces || []).map(p => WARMTH_TEMP[p.warmth || byId?.get?.(p.id)?.warmth]).filter(v => v != null);
  return ts.length ? Math.min(...ts) : null;
}
// Wearing-season + appropriate temperature range for a temperature (°C).
function climateFor(temp) {
  if (temp == null) return { season: "Any season", range: "any temp", emoji: "🧥" };
  if (temp >= 22) return { season: "Summer", range: "22°C +", emoji: "☀️" };
  if (temp >= 12) return { season: "Spring / Autumn", range: "12–21°C", emoji: "🍃" };
  if (temp >= 5) return { season: "Winter", range: "5–11°C", emoji: "❄️" };
  return { season: "Deep winter", range: "under 5°C", emoji: "🧣" };
}
const SEASON_ORDER = ["Summer", "Spring / Autumn", "Winter", "Deep winter", "Any season"];
function lookClimate(look, byId) {
  const temp = look?.weather?.temp != null ? look.weather.temp : estTempFromPieces(look?.pieces, byId);
  return { temp, ...climateFor(temp) };
}

// ---------- Four-season tag for saved looks ----------
// Temperature can't tell spring from autumn (same °C), so the season is an editable
// tag: auto-guessed from the month the look was saved + its temperature, then the user
// can change it.
const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
const SEASON_EMOJI = { Spring: "🌸", Summer: "☀️", Autumn: "🍂", Winter: "❄️" };
function monthSeason(m) { // 0–11 → N-hemisphere meteorological season
  if (m === 11 || m <= 1) return "Winter";
  if (m <= 4) return "Spring";
  if (m <= 7) return "Summer";
  return "Autumn";
}
function guessSeason(look, byId) {
  const temp = look?.weather?.temp != null ? look.weather.temp : estTempFromPieces(look?.pieces, byId);
  if (temp != null && temp >= 24) return "Summer";
  if (temp != null && temp < 4) return "Winter";
  if (look?.savedAt) { const d = new Date(look.savedAt); if (!isNaN(d)) return monthSeason(d.getMonth()); }
  if (temp != null) return temp >= 12 ? "Spring" : "Winter";
  return "Summer";
}
// The look's tag: an explicit user choice if set, else the auto guess.
function lookSeason(look, byId) {
  return look?.season && SEASONS.includes(look.season) ? look.season : guessSeason(look, byId);
}
// Map temperature (°C) to needed warmth levels
function warmthForTemp(t) {
  if (t >= 26) return ["Very light", "Light"];
  if (t >= 20) return ["Very light", "Light", "Medium"];
  if (t >= 13) return ["Light", "Medium", "Warm"];
  if (t >= 6) return ["Medium", "Warm", "Very warm"];
  return ["Warm", "Very warm"];
}
// Whether a piece can be styled for the given occasion + weather right now, and why
// not. Occasion must match; warmth (unless "Not applicable") must suit the temperature.
const WARMTH_ORDER = ["Very light", "Light", "Medium", "Warm", "Very warm"];
function eligibilityFor(item, occasion, weather) {
  const occOk = (item.formality || []).includes(occasion);
  let warmthOk = true, warmthNote = "";
  if (weather && item.warmth && item.warmth !== "Not applicable") {
    const needed = warmthForTemp(weather.temp);
    warmthOk = needed.includes(item.warmth);
    if (!warmthOk) {
      const idx = WARMTH_ORDER.indexOf(item.warmth);
      const maxNeeded = Math.max(...needed.map(w => WARMTH_ORDER.indexOf(w)));
      warmthNote = idx > maxNeeded ? "Too warm" : "Too cool";
    }
  }
  const reason = !occOk ? `Not for ${occasion.toLowerCase()}` : (!warmthOk ? warmthNote : "");
  return { occOk, warmthOk, eligible: occOk && warmthOk, reason };
}

// ---------- Color coordination ----------
const NEUTRALS = ["Black", "White", "Black & White", "Grey", "Beige", "Navy", "Brown", "Cream", "Tan", "Denim", "Multicolour", "Floral"];
function colorsClash(a, b) {
  if (!a || !b) return false;
  if (NEUTRALS.includes(a) || NEUTRALS.includes(b)) return false;
  // two different saturated colors — mild clash unless same
  return a !== b;
}

// Approximate hex for each colour tag, for the palette visuals on the Insights page.
const COLOR_HEX = {
  "Black": "#1c1c1c", "White": "#f4f1ee", "Black & White": "#5a5a5a", "Grey": "#9a9a9a",
  "Beige": "#d8c7ad", "Cream": "#efe6d3", "Brown": "#6f4b33", "Tan": "#c19a6b",
  "Navy": "#2a3550", "Blue": "#3f6fb0", "Green": "#4c7a52", "Red": "#b23a34",
  "Pink": "#e0a3b4", "Purple": "#7a5490", "Orange": "#d1743a", "Yellow": "#e3c04a",
  "Gold": "#c8a24b", "Silver": "#c3c6cb", "Denim": "#4a6274", "Floral": "#c98a9e",
  "Multicolour": "#b57f5a",
};
function colorHex(name) { return COLOR_HEX[name] || "#b9a08f"; }

// ---------- Outfit composition (shared by Today + Travel) ----------
// Pure: builds one outfit from the closet for a given weather + occasion. Uses
// randomness so repeated calls give different looks; callers dedupe by `key`.
function composeOutfit(items, weather, occasion, avoidIds, favorIds, stylePref) {
  if (!weather) return { pieces: [], notes: [], key: "" };
  const needWarmth = warmthForTemp(weather.temp);
  const wet = isWet(weather.code);
  const pool = items.filter(i => i.formality?.includes(occasion));

  const result = { pieces: [], notes: [] };
  const hasBold = () => result.pieces.some(p => p.tone === "Bold");

  const pick = (cat, opts = {}) => {
    let cand = pool.filter(i => i.category === cat);
    if (opts.warmthOk) cand = cand.filter(i => i.warmth === "Not applicable" || needWarmth.includes(i.warmth));
    if (opts.avoidColor) cand = cand.filter(i => !colorsClash(i.color, opts.avoidColor)).concat(cand.filter(i => colorsClash(i.color, opts.avoidColor)));
    if (!cand.length && opts.warmthOk) cand = pool.filter(i => i.category === cat); // relax warmth
    if (!cand.length) return null;
    // Learn from removals: lean away from pieces the user keeps taking out.
    if (avoidIds && avoidIds.size) {
      const kept = cand.filter(i => !avoidIds.has(i.id));
      if (kept.length) cand = kept;
    }
    // Palette discipline: once the look has a saturated (non-neutral) colour, prefer
    // pieces that are neutral or share that colour, so brights don't stack up.
    const sat = result.pieces.map(p => p.color).filter(c => c && !NEUTRALS.includes(c));
    if (sat.length) {
      const calm = cand.filter(i => NEUTRALS.includes(i.color) || sat.includes(i.color));
      if (calm.length) cand = calm;
    }
    if (hasBold()) {
      const quiet = cand.filter(i => i.tone !== "Bold");
      if (quiet.length) cand = quiet;
    }
    // Learn from saved looks: often lean toward pieces the user has saved before.
    if (favorIds && favorIds.size) {
      const fav = cand.filter(i => favorIds.has(i.id));
      if (fav.length && Math.random() < 0.6) cand = fav;
    }
    // Learn from My Style "liked" outfits: lean toward the colours (and, before any
    // bold is placed, the vibe) the user is drawn to — so the free look reflects taste.
    if (stylePref && stylePref.colors && stylePref.colors.size) {
      const onTaste = cand.filter(i => stylePref.colors.has(i.color));
      if (onTaste.length && Math.random() < 0.55) cand = onTaste;
    }
    if (stylePref && stylePref.tone && !hasBold()) {
      const onTone = cand.filter(i => i.tone === stylePref.tone);
      if (onTone.length && Math.random() < 0.4) cand = onTone;
    }
    return cand[Math.floor(Math.random() * cand.length)];
  };

  const useOnePiece = Math.random() < 0.4 && (pool.some(i => i.category === "Dresses") || pool.some(i => i.category === "Jumpsuits"));
  let baseColor = null;
  function pushTopBottom() {
    const top = pick("Tops", { warmthOk: true });
    if (top) { result.pieces.push(top); baseColor = top.color; }
    const bottom = pick("Bottoms", { warmthOk: true, avoidColor: baseColor });
    if (bottom) result.pieces.push(bottom);
  }
  if (useOnePiece) {
    const one = pick("Dresses", { warmthOk: true }) || pick("Jumpsuits", { warmthOk: true });
    if (one) { result.pieces.push(one); baseColor = one.color; }
    else { pushTopBottom(); }
  } else { pushTopBottom(); }

  if (weather.temp < 16 || wet) {
    const outer = pick("Outerwear", { warmthOk: weather.temp < 16, avoidColor: baseColor });
    if (outer) result.pieces.push(outer);
    else if (weather.temp < 12) result.notes.push("It's chilly — add a warm layer if you have one un-tagged.");
  }
  const shoes = pick("Shoes", { avoidColor: baseColor });
  if (shoes) result.pieces.push(shoes);
  // Accessories, all colour-coordinated and kept deliberately restrained so the look
  // reads as styled, not piled on: one bag, sometimes a belt, sometimes one accessory,
  // and at most a single piece of jewellery.
  const bag = pick("Bags", { avoidColor: baseColor }); if (bag) result.pieces.push(bag);
  if (!useOnePiece && Math.random() < 0.5) { const belt = pick("Belts", { avoidColor: baseColor }); if (belt) result.pieces.push(belt); }
  if (Math.random() < 0.6) { const acc = pick("Accessories", { avoidColor: baseColor }); if (acc) result.pieces.push(acc); }
  const jcats = JEWELRY.filter(j => pool.some(i => i.category === j));
  if (jcats.length && Math.random() < 0.7) {
    const jp = pick(jcats[Math.floor(Math.random() * jcats.length)], { avoidColor: baseColor });
    if (jp) result.pieces.push(jp);
  }

  if (wet) result.notes.push("Rain expected — closed shoes and a jacket recommended.");
  if (weather.wind > 30) result.notes.push("Windy out — a fitted layer beats anything loose.");
  const boldPiece = result.pieces.find(p => p.tone === "Bold");
  if (boldPiece) result.notes.push(`Let the ${boldPiece.name.toLowerCase()} be the statement — everything else stays quiet.`);
  if (!result.pieces.length) result.notes.push("No items match this occasion + weather yet. Add more pieces or switch the occasion.");

  result.key = occasion + "|" + result.pieces.map(p => p.id).sort().join(",");
  return result;
}

// Pick a different closet piece to stand in for one the user removed from a look:
// same category, right occasion + warmth, not already in the look, avoiding clashes.
function pickAlternative(items, weather, occasion, piece, current, avoidIds, favorIds, stylePref) {
  const usedIds = new Set(current.map(p => p.id));
  let cand = items.filter(i => i.category === piece.category && i.formality?.includes(occasion) && !usedIds.has(i.id));
  if (weather) {
    const needWarmth = warmthForTemp(weather.temp);
    const warm = cand.filter(i => i.warmth === "Not applicable" || needWarmth.includes(i.warmth));
    if (warm.length) cand = warm;
  }
  if (!cand.length) return null;
  if (avoidIds && avoidIds.size) {
    const kept = cand.filter(i => !avoidIds.has(i.id));
    if (kept.length) cand = kept;
  }
  const otherColors = current.filter(p => p.id !== piece.id).map(p => p.color);
  const nonClash = cand.filter(c => !otherColors.some(oc => colorsClash(c.color, oc)));
  if (nonClash.length) cand = nonClash;
  if (favorIds && favorIds.size) {
    const fav = cand.filter(i => favorIds.has(i.id));
    if (fav.length && Math.random() < 0.6) cand = fav;
  }
  if (stylePref && stylePref.colors && stylePref.colors.size) {
    const onTaste = cand.filter(i => stylePref.colors.has(i.color));
    if (onTaste.length && Math.random() < 0.55) cand = onTaste;
  }
  return cand[Math.floor(Math.random() * cand.length)];
}

// Build several distinct outfit recommendations (for the Today carousel).
function recommendOutfits(items, weather, occasion, count = 6, avoidIds, favorIds, stylePref) {
  if (!weather) return [];
  const out = [];
  const seen = new Set();
  for (let tries = 0; tries < count * 6 && out.length < count; tries++) {
    const o = composeOutfit(items, weather, occasion, avoidIds, favorIds, stylePref);
    if (!o.pieces.length) break;
    if (seen.has(o.key)) continue;
    seen.add(o.key);
    out.push(o);
  }
  return out;
}

// Summarise the user's saved looks into a positive taste signal: the piece ids they
// favour, plus a short text digest for the stylist.
function savedTaste(looks) {
  if (!looks || !looks.length) return { favorIds: new Set(), text: "" };
  const counts = {};
  looks.forEach(l => (l.pieces || []).forEach(p => {
    counts[p.id] = counts[p.id] || { name: p.name, n: 0 };
    counts[p.id].n++;
  }));
  const favorIds = new Set(Object.keys(counts));
  const topPieces = Object.values(counts).sort((a, b) => b.n - a.n).slice(0, 6).map(c => c.name);
  const recent = looks.slice(0, 3).map(l => `${l.occasion}: ${(l.pieces || []).map(p => p.name).join(" + ")}`);
  const text = `Looks they've SAVED because they love them (lean into these pieces and pairings when it fits):` +
    (topPieces.length ? `\n- Pieces they save most: ${topPieces.join(", ")}.` : "") +
    (recent.length ? `\n- Recent saved looks:\n${recent.map(c => `  · ${c}`).join("\n")}` : "");
  return { favorIds, text };
}

// Turn the user's LIKED My Style outfits (aspiration photos) into a lightweight taste
// signal the FREE rule engine can act on: the colours that recur across those looks and
// the dominant vibe. Each liked photo is tagged with { colors, tone } by a one-time
// vision scan; this just tallies them. `colors` is a Set of the top colour tags; `tone`
// is the most common vibe; `text` is a short digest for the AI engines.
function styleTasteFromLiked(liked) {
  const colorCounts = {}, toneCounts = {};
  (liked || []).forEach(p => {
    (p.colors || []).forEach(c => { colorCounts[c] = (colorCounts[c] || 0) + 1; });
    if (p.tone) toneCounts[p.tone] = (toneCounts[p.tone] || 0) + 1;
  });
  const rankedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const colors = new Set(rankedColors.slice(0, 5));
  const tone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const analysed = (liked || []).filter(p => p.colors && p.colors.length).length;
  const text = colors.size
    ? `Colours and vibe they're drawn to (learned from ${analysed} outfit(s) they like — lean toward this palette when it fits):\n- Colours: ${rankedColors.slice(0, 5).join(", ")}.` + (tone ? `\n- Overall vibe: ${tone}.` : "")
    : "";
  return { colors, tone, text, analysed };
}

// ---------- Parse a stylist outfit reply ----------
// Match a named piece back to a closet item (exact, then fuzzy contains).
function matchItem(items, name) {
  const low = (name || "").trim().toLowerCase();
  if (!low) return null;
  return items.find(i => (i.name || "").toLowerCase() === low)
    || items.find(i => (i.name || "").length >= 3 && low.includes((i.name || "").toLowerCase()))
    || items.find(i => low.length >= 3 && (i.name || "").toLowerCase().includes(low));
}
// The stylist is asked to end an outfit with a "Pieces:" block, one line per piece:
//   - <exact name> | <core|optional> | <reason>
// Returns { title, prose (block stripped), pieces: [{...item, role, reason}] }.
function parseOutfitReply(text, items) {
  let body = text || "", title = null;
  const tm = body.match(/^\s*(?:look|outfit|title)\s*:\s*(.+)/i);
  if (tm) { title = tm[1].trim().replace(/[\s.·–—-]+$/, "").slice(0, 40); body = body.slice(tm[0].length).replace(/^\s+/, ""); }
  const pieces = [];
  const seen = new Set();
  const kept = [];
  let inBlock = false;
  for (const line of body.split("\n")) {
    if (/^\s*pieces\s*:/i.test(line)) { inBlock = true; continue; }
    const m = line.match(/^\s*[-*•]\s*(.+?)\s*\|\s*(core|optional)\s*\|\s*(.+?)\s*$/i);
    if (m) {
      inBlock = true;
      const it = matchItem(items, m[1]);
      if (it && !seen.has(it.id)) { seen.add(it.id); pieces.push({ ...it, role: /optional/i.test(m[2]) ? "optional" : "core", reason: m[3].trim() }); }
      continue;
    }
    if (inBlock && !line.trim()) continue;
    kept.push(line);
  }
  return { title, prose: kept.join("\n").trim(), pieces };
}

// Parse a multi-outfit AI reply into carousel looks (same shape composeOutfit
// returns: { pieces, notes, key, ... }). The stylist is asked to separate looks
// with a "===" line and precede the pieces with a one-line "Why:" overview.
function parseMultiOutfits(text, items, occasion) {
  const blocks = (text || "").split(/^\s*={2,}\s*$/m).map(b => b.trim()).filter(Boolean);
  const looks = [];
  const seen = new Set();
  for (const b of blocks) {
    const wm = b.match(/^\s*why\s*:\s*(.+)$/im);
    const why = wm ? wm[1].trim() : "";
    const body = b.replace(/^\s*why\s*:.*$/im, "");
    const parsed = parseOutfitReply(body, items);
    if (parsed.pieces.length < 2) continue; // skip stray/incomplete blocks
    const ids = parsed.pieces.map(p => p.id).sort().join(",");
    if (seen.has(ids)) continue; // drop duplicate looks
    seen.add(ids);
    const overview = why || parsed.prose || "";
    looks.push({
      pieces: parsed.pieces,
      notes: overview ? [overview] : [],
      title: parsed.title || "",
      key: occasion + "|" + ids,
      swapNote: undefined,
    });
  }
  return looks;
}

// ---------- Travel / holiday planning ----------
const PACK_GROUPS = {
  Clothing: ["Tops", "Bottoms", "Dresses", "Jumpsuits", "Outerwear"],
  Shoes: ["Shoes"],
  Accessories: ["Bags", "Belts", "Accessories", "Necklaces", "Brooches", "Earrings", "Rings", "Bracelets"],
};
function packGroup(cat) {
  for (const [g, cats] of Object.entries(PACK_GROUPS)) if (cats.includes(cat)) return g;
  return "Accessories";
}
// You add outfits to each day of a trip from your Saved Looks and tag each one.
const TRAVEL_TAGS = ["Day look", "Night look", "Other"];
function snapshotPiece(p) { return { id: p.id, name: p.name, category: p.category, color: p.color, tone: p.tone, warmth: p.warmth, img: p.img }; }
// The list of dates (inclusive) a trip covers, capped for sanity.
function tripDays(start, end) {
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  if (isNaN(s) || isNaN(e) || e < s) return [];
  const out = [];
  for (let t = new Date(s); t <= e && out.length < 30; t.setDate(t.getDate() + 1)) out.push(new Date(t));
  return out;
}
// A trip's plan is an object keyed by date ISO → array of outfit entries the user
// added (each { id, lookId, tag, occasion, pieces:[snapshot] }). Old auto-generated
// plans were stored as an array; treat those (and missing plans) as an empty plan.
function tripPlan(trip) {
  return trip && trip.plan && !Array.isArray(trip.plan) ? trip.plan : {};
}
// Unique pieces across every outfit added to the trip, grouped for packing.
function travelPacking(trip) {
  const plan = tripPlan(trip);
  const byId = new Map();
  for (const date of Object.keys(plan)) for (const e of (plan[date] || [])) for (const p of (e.pieces || [])) byId.set(p.id, p);
  const pieces = [...byId.values()];
  const groups = { Clothing: 0, Shoes: 0, Accessories: 0 };
  for (const p of pieces) groups[packGroup(p.category)]++;
  return { total: pieces.length, groups, pieces };
}
function fmtDate(iso, opts) { try { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, opts); } catch { return iso; } }

// ---------- Persistence (IndexedDB, auto-migrating from localStorage) ----------
// Wardrobe data (including photos as data URLs) is stored in IndexedDB — far
// larger and more durable than localStorage, so photos survive app updates and
// reopening the app. Everything saves and loads automatically; there is no
// manual step. Legacy localStorage data is migrated in on first load.
//   - items:  the wardrobe pieces (key `wardrobe_items_v1`)
//   - looks:  saved outfits (key `wardrobe_looks_v1`), each a self-contained
//             snapshot so it survives edits/deletes of the underlying pieces
//   - inspo:  "My Style" photos of past outfits (key `wardrobe_inspo_v1`)
const KEY = "wardrobe_items_v1";
const LOOKS_KEY = "wardrobe_looks_v1";
const INSPO_KEY = "wardrobe_inspo_v1";   // outfits the user has worn ("My Style")
const LIKED_KEY = "wardrobe_liked_v1";   // outfits the user likes / aspires to (inspiration)
const DISLIKED_KEY = "wardrobe_disliked_v1"; // outfit combinations the stylist must never suggest again
const BRANDS_KEY = "wardrobe_brands_v1"; // stores/brands the user likes (for the personal shopper)
const TRIPS_KEY = "wardrobe_trips_v1"; // planned holidays (Travel page)
const PREFS_KEY = "wardrobe_prefs_v1"; // learned style signals (e.g. pieces the user removes)
const MEMORY_KEY = "wardrobe_memory_v1"; // what the stylist remembers across conversations

const DB_NAME = "wardrobe";
const STORE = "kv";
let _dbPromise = null;
function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Prefer IndexedDB; if a collection is missing there, migrate any legacy
// localStorage value in (so upgrading from the old version loses nothing).
async function loadStore(idbKey, lsKey) {
  try {
    let v = await idbGet(idbKey);
    if (v == null) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw) { v = JSON.parse(raw); if (Array.isArray(v)) await idbSet(idbKey, v); }
      } catch {}
    }
    return Array.isArray(v) ? v : [];
  } catch {
    try { return JSON.parse(localStorage.getItem(lsKey)) || []; } catch { return []; }
  }
}
async function saveStore(idbKey, lsKey, value) {
  try { await idbSet(idbKey, value); }
  catch {
    try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch (e) { console.warn("Could not save (storage full?):", e); }
  }
}

// ---------- Image helpers ----------
function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
// Shrink a photo to a sane size for storage + AI vision (keeps aspect ratio).
async function downscaleImage(file, max = 768, quality = 0.82) {
  const dataUrl = await readFileAsDataURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl; // fall back to the original if canvas fails
  }
}

// ---------- AI: auto-tagging (via local proxy) ----------
// Calls /api/tag on the bundled Node server, which holds your API key.
// If the server or key is unavailable, callers fall back to manual tagging.
async function autoTag(base64, mediaType) {
  const res = await fetch("/api/tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType, categories: CATEGORIES, colors: COLORS, tones: TONES, warmth: WARMTH, formality: FORMALITY }),
  });
  if (!res.ok) throw new Error("tag request failed");
  const data = await res.json();
  return data.tags; // { category, color, tone, warmth, formality, name }
}

// ---------- Lightbox (tap any photo to enlarge) ----------
const LightboxContext = createContext(() => {});

// ---------- Image thumbnail with placeholder ----------
// Any thumbnail with a real photo is tappable to open the full-size lightbox.
function Thumb({ src, alt, style }) {
  const openLightbox = useContext(LightboxContext);
  const base = { width: "100%", height: "100%", objectFit: "cover", ...style };
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ ...base, cursor: "zoom-in" }}
        onClick={(e) => { e.stopPropagation(); openLightbox(src); }}
      />
    );
  }
  return (
    <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", background: "#EBD9DA", color: "#8a6a76", fontFamily: "system-ui,sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", textAlign: "center", padding: 4 }}>
      No photo
    </div>
  );
}

// ---------- Styles ----------
const S = {
  aubergine: "#3B2233",
  aubergineDeep: "#2A1826",
  blush: "#EBD9DA",
  blushSoft: "#F6EEEF",
  clay: "#B5654A",
  gold: "#C8A24B",
  ink: "#241019",
  paper: "#FBF7F5",
};

// Tap-to-reveal for per-piece controls on touch. Pointer devices use CSS :hover;
// on a touch device (no hover), tapping a piece reveals its controls (and marks it
// `.revealed`), tapping elsewhere hides them. Returns the revealed key + a capture
// handler to attach to each `.piece` element.
function useTapReveal() {
  const [revealed, setRevealed] = useState(null);
  useEffect(() => {
    if (revealed == null) return;
    const onDoc = (e) => { if (!(e.target.closest && e.target.closest(".piece"))) setRevealed(null); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [revealed]);
  const isTouch = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches;
  const tapReveal = (key) => (e) => {
    if (!isTouch()) return;                       // pointer: hover handles it, taps zoom
    if (e.target.closest && e.target.closest("button")) return; // let control taps through
    e.stopPropagation();                          // don't open the lightbox
    setRevealed(cur => (cur === key ? null : key));
  };
  return { revealed, tapReveal };
}

export default function App() {
  const [items, setItems] = useState([]);
  const [looks, setLooks] = useState([]);
  const [inspo, setInspo] = useState([]); // outfits worn
  const [liked, setLiked] = useState([]); // outfits liked (inspiration)
  const [disliked, setDisliked] = useState([]); // combinations never to suggest again
  const [brands, setBrands] = useState([]); // saved stores/brands for the personal shopper
  const [trips, setTrips] = useState([]); // planned holidays
  const [prefs, setPrefs] = useState({ removed: {} }); // learned signals: { removed: { pieceId: {name, count} } }
  const [memory, setMemory] = useState({ notes: [], styles: [] }); // stylist's cross-conversation memory
  const [ready, setReady] = useState(false); // true once data has loaded from storage
  const [view, setView] = useState("today"); // today | looks | mystyle | closet | shop | insights | travel | add
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [loadingW, setLoadingW] = useState(false);
  const [location, setLocation] = useState(null); // { name, lat, lon } — manually chosen
  const [locBusy, setLocBusy] = useState(false);
  const [forecast, setForecast] = useState(null); // [{date, tmax, tmin, code, wind}] up to 7 days
  const [currentWx, setCurrentWx] = useState(null); // live "now" conditions
  const [dayIndex, setDayIndex] = useState(0); // which forecast day the weather reflects
  const [occasion, setOccasion] = useState("Casual");
  const [tempOverride, setTempOverride] = useState(""); // optional "dress for this °C" override
  const [outfit, setOutfit] = useState(null);
  const [recs, setRecs] = useState([]); // carousel of recommended looks
  const [recsSource, setRecsSource] = useState("rule"); // "rule" | "ai" — which engine built the current carousel
  const [aiBusy, setAiBusy] = useState(false); // an AI-looks request is in flight
  const [swapping, setSwapping] = useState(null); // "recIndex:pieceId" being AI-swapped
  const [queue, setQueue] = useState([]); // pending uploads awaiting tags
  const [autoTagging, setAutoTagging] = useState(false);
  const [scanning, setScanning] = useState(null); // { done, total } while scanning the closet for brands
  const [lightbox, setLightbox] = useState(null); // src of enlarged photo
  const [notice, setNotice] = useState(null); // transient toast message
  const noticeTimer = useRef();
  const fileRef = useRef();

  // Brief bottom toast (e.g. "Skipped 2 duplicate photos").
  function flash(msg) {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  // Load everything from durable storage on first mount, then keep it saved.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [it, lk, ip, li, di, br, tr, loc, pf, me] = await Promise.all([
        loadStore("items", KEY), loadStore("looks", LOOKS_KEY), loadStore("inspo", INSPO_KEY), loadStore("liked", LIKED_KEY), loadStore("disliked", DISLIKED_KEY), loadStore("brands", BRANDS_KEY), loadStore("trips", TRIPS_KEY),
        idbGet("location").catch(() => null), idbGet("prefs").catch(() => null), idbGet("memory").catch(() => null),
      ]);
      if (!alive) return;
      setItems(it); setLooks(lk); setInspo(ip); setLiked(li); setDisliked(di); setBrands(br); setTrips(tr); setReady(true);
      if (pf && typeof pf === "object") setPrefs({ removed: pf.removed || {} });
      if (me && typeof me === "object") setMemory({ notes: Array.isArray(me.notes) ? me.notes : [], styles: Array.isArray(me.styles) ? me.styles : [] });
      if (loc && loc.lat != null) { setLocation(loc); fetchWeather(loc); } // weather for the remembered place
      try { navigator.storage?.persist?.(); } catch {} // ask iOS not to evict our data
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (ready) saveStore("items", KEY, items); }, [items, ready]);
  useEffect(() => { if (ready) saveStore("looks", LOOKS_KEY, looks); }, [looks, ready]);
  useEffect(() => { if (ready) saveStore("inspo", INSPO_KEY, inspo); }, [inspo, ready]);
  useEffect(() => { if (ready) saveStore("liked", LIKED_KEY, liked); }, [liked, ready]);
  useEffect(() => { if (ready) saveStore("disliked", DISLIKED_KEY, disliked); }, [disliked, ready]);
  useEffect(() => { if (ready) saveStore("brands", BRANDS_KEY, brands); }, [brands, ready]);
  useEffect(() => { if (ready) saveStore("trips", TRIPS_KEY, trips); }, [trips, ready]);

  // ----- Trips (Travel page) -----
  function saveTrip(trip) {
    setTrips(prev => {
      const i = prev.findIndex(t => t.id === trip.id);
      if (i >= 0) { const c = [...prev]; c[i] = trip; return c; }
      return [trip, ...prev];
    });
  }
  function deleteTrip(id) { setTrips(prev => prev.filter(t => t.id !== id)); }

  // ----- Learned style signals -----
  useEffect(() => { if (ready) idbSet("prefs", prefs).catch(() => {}); }, [prefs, ready]);
  // Record that the user took a piece out of a suggested look (a soft negative
  // signal the stylist + recommendations lean away from).
  function notePieceRemoved(piece) {
    if (!piece || !piece.id) return;
    setPrefs(prev => {
      const removed = { ...(prev.removed || {}) };
      const cur = removed[piece.id];
      removed[piece.id] = { name: piece.name || cur?.name || "a piece", count: (cur?.count || 0) + 1 };
      return { ...prev, removed };
    });
  }
  // Ids the user removes often — leaned away from in suggestions.
  const avoidIds = new Set(Object.entries(prefs.removed || {}).filter(([, r]) => (r.count || 0) >= 2).map(([id]) => id));
  const removedNames = Object.values(prefs.removed || {}).filter(r => (r.count || 0) >= 2).map(r => r.name);

  // Positive taste signal from the looks the user has saved.
  const taste = savedTaste(looks);
  // Taste signal from the outfits the user LIKES (My Style) — colours/vibe they lean to.
  const styleTaste = styleTasteFromLiked(liked);

  // Optional "dress for this temperature" override — when the user types a value it's
  // used for styling (recommendations + AI stylist) instead of the actual temperature.
  const overrideTemp = tempOverride !== "" && !isNaN(Number(tempOverride)) ? Number(tempOverride) : null;
  const styleWeather = overrideTemp != null
    ? { temp: overrideTemp, code: weather?.code ?? 0, wind: weather?.wind ?? 0, override: true, dayLabel: weather?.dayLabel }
    : weather;

  // ----- Stylist memory (carried across conversations) -----
  useEffect(() => { if (ready) idbSet("memory", memory).catch(() => {}); }, [memory, ready]);
  // Remember something the user told the stylist (a request/question) and/or a style
  // they went for, so future conversations can reference it. Deduped and capped.
  function remember({ note, style } = {}) {
    setMemory(prev => {
      let notes = prev.notes || [], styles = prev.styles || [];
      const n = (note || "").trim();
      if (n && n.length <= 240) notes = [n, ...notes.filter(x => x.toLowerCase() !== n.toLowerCase())].slice(0, 40);
      const s = (style || "").trim();
      if (s) styles = [s, ...styles.filter(x => x.toLowerCase() !== s.toLowerCase())].slice(0, 10);
      return { notes, styles };
    });
  }
  function clearMemory() { setMemory({ notes: [], styles: [] }); }

  // ----- Saved stores/brands (personal shopper) -----
  function addBrand(b) {
    const name = (b.name || "").trim();
    let url = (b.url || "").trim();
    if (!name && !url) return false;
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const norm = (u) => (u || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
    const dup = brands.some(x =>
      (url && norm(x.url) === norm(url)) ||
      (name && (x.name || "").toLowerCase() === name.toLowerCase()));
    if (dup) { flash("That store is already saved"); return false; }
    setBrands(prev => [{ id: crypto.randomUUID(), name: name || url, url, note: (b.note || "").trim() }, ...prev]);
    return true;
  }
  function removeBrand(id) { setBrands(prev => prev.filter(b => b.id !== id)); }

  // Record an outfit combination the stylist must never suggest again.
  function dislikeCombo(pieces) {
    if (!pieces || !pieces.length) return;
    const key = pieces.map(p => p.id).sort().join(",");
    setDisliked(prev => prev.some(d => d.key === key) ? prev : [{ key, names: pieces.map(p => p.name) }, ...prev]);
  }
  function removeDislike(key) { setDisliked(prev => prev.filter(d => d.key !== key)); }

  // ----- Backup (optional; move your wardrobe between devices/links) -----
  function exportData() {
    try {
      const data = { app: "the-wardrobe", version: 1, items, looks, inspo, liked, disliked, brands, trips, prefs, memory };
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "wardrobe-backup.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { alert("Couldn't create the backup file."); }
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.items)) setItems(data.items);
      if (Array.isArray(data.looks)) setLooks(data.looks);
      if (Array.isArray(data.inspo)) setInspo(data.inspo);
      if (Array.isArray(data.liked)) setLiked(data.liked);
      if (Array.isArray(data.disliked)) setDisliked(data.disliked);
      if (Array.isArray(data.brands)) setBrands(data.brands);
      if (Array.isArray(data.trips)) setTrips(data.trips);
      if (data.prefs && typeof data.prefs === "object") setPrefs({ removed: data.prefs.removed || {} });
      if (data.memory && typeof data.memory === "object") setMemory({ notes: data.memory.notes || [], styles: data.memory.styles || [] });
      alert("Backup restored.");
    } catch { alert("That file didn't look like a wardrobe backup."); }
  }

  // ----- Saved looks -----
  const currentLookSaved = !!(outfit?.key && looks.some(l => l.key === outfit.key));
  function saveCurrentLook() {
    if (!outfit || !outfit.pieces.length) return;
    if (currentLookSaved) return;
    const savedAt = new Date().toISOString();
    const weatherSnap = weather ? { temp: weather.temp, code: weather.code } : null;
    const pieces = outfit.pieces.map(p => ({
      id: p.id, name: p.name, category: p.category, color: p.color, tone: p.tone, warmth: p.warmth, img: p.img,
    }));
    const look = {
      id: crypto.randomUUID(), key: outfit.key, occasion,
      weather: weatherSnap, savedAt,
      season: guessSeason({ weather: weatherSnap, pieces, savedAt }),
      pieces, // snapshot so the saved look survives later edits/deletes
    };
    setLooks(prev => [look, ...prev]);
  }
  function deleteLook(id) { setLooks(prev => prev.filter(l => l.id !== id)); }
  // Change a saved look's season tag.
  function setLookSeason(id, season) { setLooks(prev => prev.map(l => l.id === id ? { ...l, season } : l)); }

  // Save an arbitrary set of pieces (e.g. the AI stylist's suggestion, a Today
  // recommendation, or a holiday-plan outfit) as a look. `opts` lets callers
  // override the occasion label, attach a note (e.g. "Positano · Day 2 · Dinner"),
  // and set the weather snapshot. Returns the look's stable key so callers can show
  // a "Saved" state.
  function saveLookPieces(pieces, opts = {}) {
    if (!pieces || !pieces.length) return null;
    const occ = opts.occasion || occasion;
    const key = "ai|" + occ + "|" + pieces.map(p => p.id).sort().join(",");
    if (!looks.some(l => l.key === key)) {
      const savedAt = new Date().toISOString();
      const weatherSnap = opts.weather !== undefined ? opts.weather : (weather ? { temp: weather.temp, code: weather.code } : null);
      const snap = pieces.map(p => ({ id: p.id, name: p.name, category: p.category, color: p.color, tone: p.tone, warmth: p.warmth, img: p.img }));
      const look = {
        id: crypto.randomUUID(), key, occasion: occ,
        note: opts.note || undefined,
        weather: weatherSnap, savedAt,
        season: guessSeason({ weather: weatherSnap, pieces: snap, savedAt }),
        pieces: snap,
      };
      setLooks(prev => [look, ...prev]);
    }
    return key;
  }

  // ----- My Style photos (worn outfits + liked/inspiration outfits) -----
  // Skips any photo already in the set (identical downscaled image data).
  async function addPhotos(setter, current, e, analyze) {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      const seen = new Set(current.map(p => p.img));
      const added = [];
      let dup = 0;
      for (const f of files) {
        const img = await downscaleImage(f);
        if (seen.has(img)) { dup++; continue; }
        seen.add(img);
        added.push({ id: crypto.randomUUID(), img });
      }
      if (added.length) setter(prev => [...added, ...prev]);
      if (dup) flash(`Skipped ${dup} photo${dup > 1 ? "s" : ""} already added`);
      // For LIKED outfits, learn the colours/vibe so the free engine can lean toward
      // them. Best-effort and silent — if there's no API key the look just stays untagged.
      if (analyze && added.length) analyzeTaste(added, setter);
    }
    e.target.value = ""; // allow re-selecting the same file
  }
  const addInspo = (e) => addPhotos(setInspo, inspo, e);
  const addLiked = (e) => addPhotos(setLiked, liked, e, true);
  const deleteInspo = (id) => setInspo(prev => prev.filter(p => p.id !== id));
  const deleteLiked = (id) => setLiked(prev => prev.filter(p => p.id !== id));

  // Ask the palette endpoint for the dominant colours + vibe of some liked outfit
  // photos and tag each with { colors, tone }. Used both on add and by the backfill
  // scan below. Silent on any failure (no key / offline) — the tags are optional.
  async function analyzeTaste(list, setter) {
    for (const p of list) {
      if (!(typeof p.img === "string" && p.img.startsWith("data:"))) continue;
      try {
        const comma = p.img.indexOf(",");
        const mediaType = (p.img.slice(0, comma).match(/data:(.*?);/) || [])[1] || "image/jpeg";
        const res = await fetch("/api/palette", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64: p.img.slice(comma + 1), mediaType, colors: COLORS, tones: TONES }) });
        if (res.status === 503) return; // no key — stop quietly
        if (res.ok) {
          const d = await res.json();
          if ((d.colors && d.colors.length) || d.tone) {
            setter(prev => prev.map(x => x.id === p.id ? { ...x, colors: d.colors || x.colors, tone: d.tone || x.tone } : x));
          }
        }
      } catch {}
    }
  }
  // Backfill: analyse liked outfits added before this feature (or that failed to tag).
  async function scanLikedTaste() {
    const todo = liked.filter(p => typeof p.img === "string" && p.img.startsWith("data:") && !(p.colors && p.colors.length));
    if (!todo.length) { flash("Taste already learned from your liked outfits"); return; }
    setScanning({ done: 0, total: todo.length });
    for (let k = 0; k < todo.length; k++) {
      const p = todo[k];
      try {
        const comma = p.img.indexOf(",");
        const mediaType = (p.img.slice(0, comma).match(/data:(.*?);/) || [])[1] || "image/jpeg";
        const res = await fetch("/api/palette", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64: p.img.slice(comma + 1), mediaType, colors: COLORS, tones: TONES }) });
        if (res.status === 503) { setScanning(null); flash("Taste-learning needs your hosted app (Render)"); return; }
        if (res.ok) {
          const d = await res.json();
          if ((d.colors && d.colors.length) || d.tone) setLiked(prev => prev.map(x => x.id === p.id ? { ...x, colors: d.colors || x.colors, tone: d.tone || x.tone } : x));
        }
      } catch {}
      setScanning({ done: k + 1, total: todo.length });
    }
    setScanning(null);
    flash(`Learned your taste from ${todo.length} liked outfit${todo.length > 1 ? "s" : ""}`);
  }

  // ----- Weather (manual location only — no GPS; pick any day this week) -----
  async function fetchWeather(loc) {
    if (!loc) return;
    setLoadingW(true); setWeatherErr(null);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max&forecast_days=7&timezone=auto`);
      const d = await r.json();
      setCurrentWx(d.current ? { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code, wind: Math.round(d.current.wind_speed_10m) } : null);
      const days = (d.daily?.time || []).map((date, i) => ({
        date,
        tmax: Math.round(d.daily.temperature_2m_max[i]),
        tmin: Math.round(d.daily.temperature_2m_min[i]),
        code: d.daily.weather_code[i],
        wind: Math.round(d.daily.wind_speed_10m_max[i]),
      }));
      setForecast(days.length ? days : null);
      setDayIndex(0);
    } catch { setWeatherErr("Couldn't reach the weather service. Check your connection and try again."); }
    setLoadingW(false);
  }
  // Weather reflects the selected day: "today" uses live conditions; other days use
  // that day's forecast (a mid-point of the high/low for dressing).
  useEffect(() => {
    if (dayIndex === 0 && currentWx) { setWeather({ ...currentWx, dayLabel: "Today" }); return; }
    const dd = forecast?.[dayIndex];
    if (dd) setWeather({ temp: Math.round((dd.tmax + dd.tmin) / 2), code: dd.code, wind: dd.wind, tmax: dd.tmax, tmin: dd.tmin, dayLabel: dayIndex === 0 ? "Today" : dayLabel(dd.date) });
    else if (dayIndex === 0 && !currentWx && !forecast) setWeather(null);
  }, [forecast, currentWx, dayIndex]);
  // Look up a place the user typed, remember it, and get its weather.
  async function chooseLocation(name) {
    const q = (name || "").trim();
    if (!q) return;
    setLocBusy(true); setWeatherErr(null);
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`);
      const d = await r.json();
      const g = d.results?.[0];
      if (!g) { setWeatherErr(`Couldn't find “${q}”. Try a city or town name.`); setLocBusy(false); return; }
      const loc = { name: [g.name, g.admin1, g.country_code].filter(Boolean).join(", "), lat: g.latitude, lon: g.longitude };
      setLocation(loc);
      await fetchWeather(loc);
    } catch { setWeatherErr("Couldn't look up that place — check your connection and try again."); }
    setLocBusy(false);
  }
  function refreshWeather() { if (location) fetchWeather(location); }
  // Remember the chosen location and load its weather on next open (no GPS prompt).
  useEffect(() => { if (ready && location) idbSet("location", location).catch(() => {}); }, [location, ready]);

  // ----- Upload (wardrobe pieces) -----
  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Skip photos already in the closet or the pending queue, and dupes within
    // this batch (identical image data).
    const seen = new Set([...items.map(i => i.img).filter(Boolean), ...queue.map(q => q.img)]);
    const newQueue = [];
    let dup = 0;
    for (const f of files) {
      const dataUrl = await readFileAsDataURL(f);
      if (seen.has(dataUrl)) { dup++; continue; }
      seen.add(dataUrl);
      newQueue.push({
        id: crypto.randomUUID(), img: dataUrl, mediaType: f.type, status: "manual",
        tags: { category: "", color: "", tone: "Classic", warmth: "Medium", formality: ["Casual"], name: "" },
      });
    }
    e.target.value = "";
    if (dup) flash(`Skipped ${dup} photo${dup > 1 ? "s" : ""} already added`);
    if (!newQueue.length) return;
    setQueue(q => [...q, ...newQueue]);

    // Try AI auto-tagging in the background. Anything that fails just stays
    // as a manual card — nothing is lost, no fake defaults are invented.
    setAutoTagging(true);
    for (const item of newQueue) {
      try {
        const base64 = item.img.split(",")[1];
        const tags = await autoTag(base64, item.mediaType);
        setQueue(cur => cur.map(x => x.id === item.id
          ? { ...x, status: "auto", tags: { ...x.tags, ...tags } }
          : x));
      } catch {
        // leave as manual
      }
    }
    setAutoTagging(false);
  }

  // Auto-save any brands the auto-tagger spotted in the photos to Saved Shops.
  // Dedupes against existing brands and within the batch; silent when nothing new.
  function autoSaveBrands(found) {
    const norm = (u) => (u || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
    const existing = new Set();
    brands.forEach(x => { existing.add((x.name || "").toLowerCase()); const u = norm(x.url); if (u) existing.add(u); });
    const toAdd = [];
    const seen = new Set();
    for (const b of found) {
      const name = (b.name || "").trim();
      if (!name) continue;
      let url = (b.url || "").trim();
      if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
      const nkey = name.toLowerCase(), ukey = norm(url);
      if (existing.has(nkey) || (ukey && existing.has(ukey)) || seen.has(nkey)) continue;
      seen.add(nkey);
      toAdd.push({ id: crypto.randomUUID(), name, url, note: "Spotted in your closet" });
    }
    if (toAdd.length) setBrands(prev => [...toAdd, ...prev]);
    return toAdd.length;
  }
  // Scan the photos of pieces already in the closet for brands (retroactive).
  async function scanClosetBrands() {
    const withImg = items.filter(i => typeof i.img === "string" && i.img.startsWith("data:"));
    if (!withImg.length) { flash("No piece photos to scan yet"); return; }
    setScanning({ done: 0, total: withImg.length });
    const found = [];
    for (let k = 0; k < withImg.length; k++) {
      const it = withImg[k];
      try {
        const comma = it.img.indexOf(",");
        const mediaType = (it.img.slice(0, comma).match(/data:(.*?);/) || [])[1] || "image/jpeg";
        const res = await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base64: it.img.slice(comma + 1), mediaType }) });
        if (res.status === 503) { setScanning(null); flash("Brand scanning needs your hosted app (Render)"); return; }
        if (res.ok) { const d = await res.json(); if (d.brand) found.push({ name: d.brand, url: d.brandUrl }); }
      } catch {}
      setScanning({ done: k + 1, total: withImg.length });
    }
    setScanning(null);
    const added = autoSaveBrands(found);
    flash(added ? `Added ${added} brand${added > 1 ? "s" : ""} to your shops` : (found.length ? "Those brands are already saved" : "No brands recognised in your closet photos"));
  }

  function commitQueue() {
    const ready = queue.filter(q => q.tags && q.tags.category);
    const committed = ready.map(q => ({
      id: q.id, img: q.img,
      category: q.tags.category, color: q.tags.color || "Unspecified", tone: q.tags.tone || "Classic",
      warmth: q.tags.warmth || "Medium", formality: q.tags.formality?.length ? q.tags.formality : ["Casual"],
      name: q.tags.name || q.tags.category,
      brand: q.tags.brand || undefined,
    }));
    setItems(prev => [...committed, ...prev]);
    // Any brands the vision tagger identified go straight to Saved Shops.
    const added = autoSaveBrands(ready.map(q => ({ name: q.tags.brand, url: q.tags.brandUrl })).filter(b => b.name));
    if (added) flash(`Added ${added} brand${added > 1 ? "s" : ""} to your shops`);
    // keep any still-untagged items in the queue
    setQueue(prev => prev.filter(q => !q.tags?.category));
    if (ready.length && ready.length === queue.length) setView("closet");
  }

  function updateQueueTag(id, field, value) {
    setQueue(cur => cur.map(x => x.id === id ? { ...x, tags: { ...x.tags, [field]: value } } : x));
  }
  function removeQueue(id) { setQueue(cur => cur.filter(x => x.id !== id)); }
  function deleteItem(id) { setItems(prev => prev.filter(i => i.id !== id)); }

  // Correctly-tagged example set based on the pieces in your screenshot,
  // so you can see the app working end to end before tagging your own.
  function seedExamples() {
    const ex = [
      { name: "Green off-shoulder dress", category: "Dresses", color: "Green", tone: "Bold", warmth: "Light", formality: ["Casual","Going out"] },
      { name: "Red floral off-shoulder dress", category: "Dresses", color: "Floral", tone: "Bold", warmth: "Light", formality: ["Casual","Going out"] },
      { name: "Heart beanie", category: "Accessories", color: "Beige", tone: "Muted", warmth: "Warm", formality: ["Casual"] },
      { name: "Black loafers", category: "Shoes", color: "Black", tone: "Classic", warmth: "Very light", formality: ["Casual","Work"] },
      { name: "Blue loafers", category: "Shoes", color: "Blue", tone: "Classic", warmth: "Very light", formality: ["Casual","Work"] },
      { name: "Woven flats", category: "Shoes", color: "Cream", tone: "Muted", warmth: "Very light", formality: ["Casual"] },
      { name: "Grey check coat", category: "Outerwear", color: "Grey", tone: "Muted", warmth: "Very warm", formality: ["Casual","Work"] },
      { name: "Cream check coat", category: "Outerwear", color: "Cream", tone: "Muted", warmth: "Very warm", formality: ["Casual","Work"] },
      { name: "Striped bikini top", category: "Tops", color: "Navy", tone: "Classic", warmth: "Very light", formality: ["Casual"] },
    ].map(e => ({ id: crypto.randomUUID(), img: "", ...e }));
    setItems(prev => [...ex, ...prev]);
    setView("closet");
  }
  function updateItem(id, field, value) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  // ----- Outfit builder -----
  // Build a fresh set of recommended looks for the Today carousel (rule engine).
  function buildOutfit() {
    if (!styleWeather) return;
    const list = recommendOutfits(items, styleWeather, occasion, 6, avoidIds, taste.favorIds, styleTaste);
    setRecs(list);
    setRecsSource("rule");
    setOutfit(list[0] || composeOutfit(items, styleWeather, occasion, avoidIds, taste.favorIds, styleTaste));
  }
  // Build the carousel with the AI stylist instead of the rule engine: one API call
  // reasons out several complete, coordinated looks from the closet, each with a
  // "why" overview and per-piece reasons. The closet is sent as a cache_control
  // block so repeat taps read it from cache. Falls back to the rule engine on any
  // failure (no key / offline / unparseable) so the user always gets looks.
  const AI_LOOK_COUNT = 4;
  async function buildAiOutfit() {
    if (!styleWeather || !items.length || aiBusy) return;
    setAiBusy(true);
    try {
      const closet = items.map(i => `- ${i.name} (${i.category}, ${i.color}, ${i.tone} tone, warmth ${i.warmth}, for ${(i.formality || []).join("/") || "any"})`).join("\n");
      const w = `${styleWeather.temp}°C${styleWeather.override ? " (a temperature they've chosen to dress for)" : ""}, ${weatherLabel(styleWeather.code)}${styleWeather.wind > 25 ? ", windy" : ""}`;
      const persona =
        `You are a warm, sharp personal stylist working inside the user's own wardrobe app. ` +
        `Build ${AI_LOOK_COUNT} DISTINCT, complete, genuinely wearable outfits using ONLY the pieces in their closet. ` +
        `For each look: choose a considered silhouette for the occasion and weather, keep a colour story that works (don't stack clashing brights — let neutrals carry, allow at most one bold statement piece), and coordinate accessories rather than piling them on. ` +
        `Rotate through the wardrobe so the ${AI_LOOK_COUNT} looks feel different from one another — don't reuse the same hero piece in every look. Reference pieces by their EXACT closet names.\n\n` +
        `Return ONLY the ${AI_LOOK_COUNT} outfits and nothing else. Separate each outfit with a line containing exactly "===". Format each outfit EXACTLY as:\n` +
        `Look: <2-4 word name>\n` +
        `Why: <one short sentence on why this outfit works together>\n` +
        `Pieces:\n- <exact closet piece name> | core|optional | <one short reason you chose it>\n` +
        `Mark a piece "optional" ONLY when it's a just-in-case layer (e.g. a jacket if it turns cooler); everything actually worn is "core". No markdown, no preamble.`;
      const extra = [
        taste.text || "",
        styleTaste.text || "",
        (removedNames && removedNames.length) ? `They often remove these pieces from looks — lean away unless a piece is clearly ideal: ${removedNames.join(", ")}.` : "",
        (disliked && disliked.length) ? `Never suggest these exact combinations again (they were disliked): ${disliked.map(d => (d.names || []).join(" + ")).join("; ")}.` : "",
      ].filter(Boolean).join("\n\n");
      // System = stable persona + cached closet block (the big, repeat-stable prefix).
      const system = [
        { type: "text", text: persona },
        { type: "text", text: `Their closet:\n${closet}`, cache_control: { type: "ephemeral" } },
      ];
      const userMsg = `Style ${AI_LOOK_COUNT} outfits for me now.\n- Occasion: ${occasion}\n- Weather: ${w}` + (extra ? `\n\n${extra}` : "");
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, messages: [{ role: "user", content: userMsg }], max_tokens: 1600 }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      const looks = parseMultiOutfits(data.text || "", items, occasion);
      if (!looks.length) throw new Error("empty");
      setRecs(looks);
      setRecsSource("ai");
      setOutfit(looks[0]);
      flash(`✨ ${looks.length} AI-styled look${looks.length > 1 ? "s" : ""}`);
    } catch (e) {
      // Always leave the user with looks: fall back to the free rule engine.
      const list = recommendOutfits(items, styleWeather, occasion, 6, avoidIds, taste.favorIds, styleTaste);
      setRecs(list);
      setRecsSource("rule");
      setOutfit(list[0] || null);
      flash(e.message === "needs-key" ? "AI looks need your hosted app (Render) — showing rule-based looks"
        : e.message === "empty" ? "Couldn't style AI looks just now — showing rule-based looks"
        : "Couldn't reach the stylist — showing rule-based looks");
    }
    setAiBusy(false);
  }
  // Deselect a piece in a recommended look and swap in an alternative (or drop it
  // if the closet has no other match). Keeps the look's stable key in sync.
  function swapPiece(recIndex, pieceId) {
    setRecs(prev => prev.map((o, i) => {
      if (i !== recIndex) return o;
      const piece = o.pieces.find(p => p.id === pieceId);
      if (!piece) return o;
      const alt = pickAlternative(items, styleWeather, occasion, piece, o.pieces, avoidIds, taste.favorIds, styleTaste);
      const pieces = alt ? o.pieces.map(p => p.id === pieceId ? alt : p) : o.pieces.filter(p => p.id !== pieceId);
      if (!alt) flash(`No other ${piece.category.toLowerCase()} for this look — removed it`);
      return { ...o, pieces, key: occasion + "|" + pieces.map(p => p.id).sort().join(","), swapNote: undefined };
    }));
  }
  // Remove a piece from a recommended look entirely (no replacement). Records the
  // removal so the stylist + recommendations learn to lean away from it.
  function removePiece(recIndex, pieceId) {
    const removed = recs[recIndex]?.pieces.find(p => p.id === pieceId);
    notePieceRemoved(removed);
    setRecs(prev => prev.map((o, i) => {
      if (i !== recIndex) return o;
      const pieces = o.pieces.filter(p => p.id !== pieceId);
      return { ...o, pieces, key: occasion + "|" + pieces.map(p => p.id).sort().join(","), swapNote: undefined };
    }));
  }
  // AI-reasoned swap: ask the stylist to pick the best replacement from the closet
  // for one piece, and explain why. Falls back to the deterministic pick if needed.
  async function aiSwapPiece(recIndex, pieceId) {
    if (swapping) return;
    const o = recs[recIndex];
    const piece = o?.pieces.find(p => p.id === pieceId);
    if (!piece) return;
    const usedIds = new Set(o.pieces.map(p => p.id));
    const alts = items.filter(i => i.category === piece.category && i.formality?.includes(occasion) && !usedIds.has(i.id));
    if (!alts.length) { flash(`No other ${piece.category.toLowerCase()} to swap in`); return; }
    setSwapping(recIndex + ":" + pieceId);
    try {
      const lookDesc = o.pieces.map(p => `${p.name} (${p.category}, ${p.color})`).join("; ");
      const options = alts.map(a => `- ${a.name} (${a.color}, ${a.tone} tone, warmth ${a.warmth})`).join("\n");
      const w = styleWeather ? `${styleWeather.temp}°C${styleWeather.override ? " (a temperature they chose to dress for)" : ""}, ${weatherLabel(styleWeather.code)}` : "unknown";
      const sys = "You are a personal stylist. The user wants to replace ONE piece in an outfit built from their own closet. Pick the single best replacement from the provided options ONLY. Reply with ONE line in EXACTLY this format, nothing else:\nSwap: <exact option name> | <one short sentence on why it works>";
      const msg = `Occasion: ${occasion}. Weather: ${w}.\nThe outfit: ${lookDesc}.\nReplace this piece: ${piece.name} (${piece.category}).\nChoose from these options:\n${options}`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, messages: [{ role: "user", content: msg }], max_tokens: 200 }) });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      const m = (data.text || "").match(/^\s*swap\s*:\s*(.+)$/im);
      let chosen = null, reason = "";
      if (m) {
        const [nm, ...rest] = m[1].split("|").map(s => s.trim());
        reason = rest.join(" | ");
        const low = nm.toLowerCase();
        chosen = alts.find(a => a.name.toLowerCase() === low) || alts.find(a => low.includes(a.name.toLowerCase()));
      }
      const alt = chosen || pickAlternative(items, styleWeather, occasion, piece, o.pieces, avoidIds, taste.favorIds, styleTaste);
      if (!alt) { flash("Couldn't find an alternative"); setSwapping(null); return; }
      setRecs(prev => prev.map((r, i) => {
        if (i !== recIndex) return r;
        const pieces = r.pieces.map(p => p.id === pieceId ? alt : p);
        return { ...r, pieces, key: occasion + "|" + pieces.map(p => p.id).sort().join(","), swapNote: `${piece.name} → ${alt.name}${reason ? " — " + reason : ""}` };
      }));
    } catch (e) {
      flash(e.message === "needs-key" ? "AI swap needs your hosted app (Render)" : "Couldn't reach the stylist — try again");
    }
    setSwapping(null);
  }

  // ---------- Render ----------
  return (
    <LightboxContext.Provider value={setLightbox}>
    <div style={{ minHeight: "100vh", background: S.paper, color: S.ink, fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        button, .chip, .navbtn, a { touch-action: manipulation; }
        .chip { border:1px solid ${S.aubergine}33; background:#fff; padding:2px 8px; border-radius:20px; font-size:11px; font-family:system-ui,sans-serif; letter-spacing:.02em; }
        .btn { cursor:pointer; border:none; font-family:system-ui,sans-serif; letter-spacing:.04em; text-transform:uppercase; font-size:12px; font-weight:600; padding:11px 18px; border-radius:2px; transition:.15s; }
        .btn:focus-visible { outline:2px solid ${S.gold}; outline-offset:2px; }
        .btn:disabled { opacity:.5; cursor:default; }
        .btn-primary { background:${S.aubergine}; color:${S.blush}; }
        .btn-primary:hover:not(:disabled) { background:${S.aubergineDeep}; }
        .btn-ghost { background:transparent; color:${S.aubergine}; border:1px solid ${S.aubergine}55; }
        .btn-ghost:hover:not(:disabled) { background:${S.blushSoft}; }
        select, input, textarea { font-family:system-ui,sans-serif; font-size:13px; padding:6px 8px; border:1px solid ${S.aubergine}33; border-radius:2px; background:#fff; color:${S.ink}; }
        .navbtn { background:none; border:none; cursor:pointer; font-family:system-ui,sans-serif; font-size:12px; letter-spacing:.14em; text-transform:uppercase; padding:8px 4px; color:${S.blush}99; border-bottom:2px solid transparent; }
        .navbtn.active { color:${S.blush}; border-bottom-color:${S.gold}; }
        .card { background:#fff; border:1px solid ${S.aubergine}18; border-radius:4px; overflow:hidden; }
        /* Per-piece controls: a bar along the bottom of the photo. Revealed on hover
           with a pointer, or by tapping the piece on touch (adds .revealed). */
        .pieceActions { position:absolute; left:0; right:0; bottom:0; display:flex; gap:5px; justify-content:center; padding:6px; background:linear-gradient(to top, #000000b0, #00000000); opacity:0; transform:translateY(4px); transition:opacity .15s, transform .15s; pointer-events:none; }
        .piece:hover .pieceActions, .piece:focus-within .pieceActions, .piece.revealed .pieceActions { opacity:1; transform:translateY(0); pointer-events:auto; }
        .pieceBtn { width:26px; height:26px; border-radius:50%; border:none; color:#fff; cursor:pointer; line-height:1; display:flex; align-items:center; justify-content:center; touch-action:manipulation; box-shadow:0 1px 4px #0005; }
        .pieceBtn:disabled { cursor:default; opacity:.6; }
        @media (prefers-reduced-motion: reduce){ .btn, .pieceActions {transition:none;} }
      `}</style>

      {/* Header */}
      <header style={{ background: S.aubergine, padding: "22px 20px 0" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ color: S.gold, fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase", marginBottom: 4 }}>Your personal atelier</div>
          <h1 style={{ color: S.blush, margin: 0, fontSize: 34, fontWeight: 400, letterSpacing: ".01em" }}>The Wardrobe</h1>
          <nav style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <button className={`navbtn ${view==="today"?"active":""}`} onClick={()=>setView("today")}>Today's Look</button>
            <button className={`navbtn ${view==="looks"?"active":""}`} onClick={()=>setView("looks")}>Saved Looks ({looks.length})</button>
            <button className={`navbtn ${view==="mystyle"?"active":""}`} onClick={()=>setView("mystyle")}>My Style ({inspo.length + liked.length})</button>
            <button className={`navbtn ${view==="closet"?"active":""}`} onClick={()=>setView("closet")}>Closet ({items.length})</button>
            <button className={`navbtn ${view==="insights"?"active":""}`} onClick={()=>setView("insights")}>Insights</button>
            <button className={`navbtn ${view==="travel"?"active":""}`} onClick={()=>setView("travel")}>Travel</button>
            <button className={`navbtn ${view==="shop"?"active":""}`} onClick={()=>setView("shop")}>Personal Shopper</button>
            <button className={`navbtn ${view==="add"?"active":""}`} onClick={()=>setView("add")}>Add Pieces</button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "26px 20px 60px" }}>
        {view === "today" && (
          <Today weather={weather} weatherErr={weatherErr} loadingW={loadingW} styleWeather={styleWeather}
            tempOverride={tempOverride} setTempOverride={setTempOverride}
            location={location} onChooseLocation={chooseLocation} refreshWeather={refreshWeather} locBusy={locBusy}
            forecast={forecast} currentWx={currentWx} dayIndex={dayIndex} onSelectDay={setDayIndex}
            occasion={occasion} setOccasion={setOccasion} buildOutfit={buildOutfit} buildAiOutfit={buildAiOutfit} aiBusy={aiBusy} recsSource={recsSource} outfit={outfit} recs={recs} items={items} setView={setView}
            inspo={inspo} liked={liked} onSaveLook={saveLookPieces} looks={looks} onSwapPiece={swapPiece} onAiSwapPiece={aiSwapPiece} onRemovePiece={removePiece} swapping={swapping}
            disliked={disliked} onDislike={dislikeCombo} removedNames={removedNames} onNotePieceRemoved={notePieceRemoved}
            memory={memory} onRemember={remember} onForget={clearMemory} savedTaste={taste.text} />
        )}
        {view === "looks" && (
          <Looks looks={looks} deleteLook={deleteLook} setView={setView}
            disliked={disliked} removeDislike={removeDislike} items={items} setLookSeason={setLookSeason} />
        )}
        {view === "mystyle" && (
          <MyStyle inspo={inspo} addInspo={addInspo} deleteInspo={deleteInspo}
            liked={liked} addLiked={addLiked} deleteLiked={deleteLiked} setView={setView}
            styleTaste={styleTaste} onScanTaste={scanLikedTaste} scanning={scanning} />
        )}
        {view === "closet" && (
          <Closet items={items} deleteItem={deleteItem} updateItem={updateItem} setView={setView}
            exportData={exportData} importData={importData} />
        )}
        {view === "insights" && (
          <Insights items={items} inspo={inspo} liked={liked} looks={looks} setView={setView} />
        )}
        {view === "travel" && (
          <Travel items={items} trips={trips} saveTrip={saveTrip} deleteTrip={deleteTrip} weather={weather} setView={setView}
            onSaveLook={saveLookPieces} looks={looks} />
        )}
        {view === "shop" && (
          <Shopper items={items} brands={brands} addBrand={addBrand} removeBrand={removeBrand}
            inspo={inspo} liked={liked} setView={setView} onScanCloset={scanClosetBrands} scanning={scanning} />
        )}
        {view === "add" && (
          <Add fileRef={fileRef} handleFiles={handleFiles} queue={queue} autoTagging={autoTagging}
            updateQueueTag={updateQueueTag} removeQueue={removeQueue} commitQueue={commitQueue} seedExamples={seedExamples} />
        )}
      </main>

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "#1a0e15ee", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50, cursor: "zoom-out" }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 6, boxShadow: "0 10px 40px #0008" }} />
          <button onClick={() => setLightbox(null)} aria-label="Close"
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "#0006", color: "#fff", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
      )}

      {notice && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", zIndex: 60, pointerEvents: "none", padding: "0 16px" }}>
          <div style={{ background: S.aubergine, color: S.blush, fontFamily: "system-ui,sans-serif", fontSize: 13, padding: "10px 16px", borderRadius: 22, boxShadow: "0 6px 20px #0004" }}>{notice}</div>
        </div>
      )}
    </div>
    </LightboxContext.Provider>
  );
}

// ---------- Today view ----------
function Today({ weather, weatherErr, loadingW, styleWeather, tempOverride, setTempOverride, location, onChooseLocation, refreshWeather, locBusy, forecast, currentWx, dayIndex, onSelectDay, occasion, setOccasion, buildOutfit, buildAiOutfit, aiBusy, recsSource, outfit, recs, items, setView, inspo, liked, onSaveLook, looks, onSwapPiece, onAiSwapPiece, onRemovePiece, swapping, disliked, onDislike, removedNames, onNotePieceRemoved, memory, onRemember, onForget, savedTaste }) {
  const [saved, setSaved] = useState(() => new Set()); // look keys saved this session
  const [locInput, setLocInput] = useState("");
  const [editingLoc, setEditingLoc] = useState(false);
  const [expanded, setExpanded] = useState(null); // index of the look shown in the big view
  const [showEligible, setShowEligible] = useState(false); // eligible-pieces panel toggle
  const { revealed, tapReveal } = useTapReveal();  // touch: tap a piece to show controls
  const savedKeys = new Set([...(looks || []).map(l => l.key), ...saved]);
  const saveRec = (o) => { const k = onSaveLook(o.pieces); if (k) setSaved(s => new Set(s).add(k)); };
  const recKey = (o) => "ai|" + occasion + "|" + o.pieces.map(p => p.id).sort().join(",");
  const submitLoc = () => { if (locInput.trim()) { onChooseLocation(locInput); setEditingLoc(false); } };
  const showLocInput = editingLoc || !location;

  return (
    <div>
      {/* Weather strip — manual location only (no GPS) */}
      <div className="card" style={{ padding: 18, marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#B5654A", marginBottom: 4 }}>Weather where you're dressing</div>
          {loadingW && <div>Checking the sky…</div>}
          {weather && !loadingW && (
            <div style={{ fontSize: 26 }}>{weather.temp}°C · <span style={{ fontSize: 18 }}>{weatherLabel(weather.code)}</span>{weather.wind > 25 ? "  ·  windy" : ""}
              {weather.tmax != null && dayIndex !== 0 && <span style={{ fontSize: 14, color: "#8a6a76" }}>  ·  {weather.tmin}–{weather.tmax}°</span>}
            </div>
          )}
          {location && !loadingW && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76", marginTop: 2 }}>{location.name}{weather?.dayLabel ? ` · ${weather.dayLabel}` : ""}</div>
          )}
          {!location && !loadingW && !weatherErr && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66" }}>Choose your location to get weather-based picks.</div>
          )}
          {weatherErr && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#8a4a3a", marginTop: 4 }}>{weatherErr}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Optional: dress for a temperature of your choice instead of the actual one */}
          <label title="Optional — dress for a temperature of your choice instead of the actual one"
            style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: S.ink, background: S.blushSoft, border: `1px solid ${S.aubergine}22`, borderRadius: 20, padding: "5px 10px" }}>
            🌡️ Dress for
            <input type="number" inputMode="numeric" value={tempOverride} onChange={e => setTempOverride(e.target.value)} placeholder={weather ? `${weather.temp}` : "°C"} style={{ width: 52, padding: "4px 6px" }} />°C
            {tempOverride !== "" && <button onClick={() => setTempOverride("")} title="Use the actual temperature" style={{ border: "none", background: "transparent", color: S.clay, cursor: "pointer", fontFamily: "system-ui,sans-serif", fontSize: 12, textDecoration: "underline", padding: 0 }}>clear</button>}
          </label>
          {showLocInput ? (
            <>
              <input value={locInput} onChange={e => setLocInput(e.target.value)} placeholder="City, e.g. London"
                onKeyDown={e => { if (e.key === "Enter") submitLoc(); }} style={{ width: 180 }} />
              <button className="btn btn-primary" style={{ padding: "9px 14px" }} onClick={submitLoc} disabled={locBusy || !locInput.trim()}>{locBusy ? "…" : "Set"}</button>
              {location && <button className="btn btn-ghost" style={{ padding: "9px 12px" }} onClick={() => setEditingLoc(false)}>Cancel</button>}
            </>
          ) : (
            <>
              {forecast && forecast.length > 1 && (
                <label style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66" }}>Day:&nbsp;
                  <select value={dayIndex} onChange={e => onSelectDay(Number(e.target.value))}>
                    {forecast.map((d, i) => <option key={d.date} value={i}>{i === 0 ? "Today" : dayLabel(d.date)}</option>)}
                  </select>
                </label>
              )}
              <button className="btn btn-ghost" onClick={refreshWeather} disabled={loadingW}>Refresh</button>
              <button className="btn btn-ghost" onClick={() => { setEditingLoc(true); setLocInput(""); }}>Change location</button>
            </>
          )}
        </div>
      </div>

      {/* AI stylist chat — moved above Today's Look (uses the chosen temperature if set) */}
      <Stylist items={items} weather={styleWeather} occasion={occasion} outfit={outfit} inspo={inspo} liked={liked} setView={setView} onSaveLook={onSaveLook} disliked={disliked} onDislike={onDislike} removedNames={removedNames} onNotePieceRemoved={onNotePieceRemoved} memory={memory} onRemember={onRemember} onForget={onForget} savedTaste={savedTaste} />

      {/* Today Look Recommendations (carousel) */}
      <div style={{ marginTop: 34 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", borderBottom: `1px solid ${S.aubergine}22`, paddingBottom: 8 }}>
          <div>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 2 }}>
              {styleWeather?.override ? `For ${styleWeather.temp}°C (your chosen temperature)` : `For ${weather?.dayLabel && dayIndex !== 0 ? weather.dayLabel : "today"}'s weather`}
            </div>
            <h2 style={{ fontWeight: 400, fontSize: 22, margin: 0 }}>Look recommendations</h2>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontFamily:"system-ui,sans-serif", fontSize: 13 }}>For:&nbsp;
              <select value={occasion} onChange={e=>setOccasion(e.target.value)}>
                {FORMALITY.map(f => <option key={f}>{f}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" onClick={buildOutfit} disabled={!styleWeather || !items.length || aiBusy}
              title="Instant looks from the built-in rules — free, works offline">
              {recs.length && recsSource === "rule" ? "Refresh looks" : "Style me"}
            </button>
            <button className="btn btn-ghost" onClick={buildAiOutfit} disabled={!styleWeather || !items.length || aiBusy}
              title="Let the AI stylist reason out coordinated looks (uses your hosted app; ~3¢ per tap)"
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {aiBusy ? "Styling…" : (recs.length && recsSource === "ai" ? "✨ Restyle with AI" : "✨ AI looks")}
            </button>
          </div>
        </div>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 6 }}>
          <strong style={{ color: S.clay }}>Style me</strong> is instant &amp; free (built-in rules). <strong style={{ color: S.clay }}>✨ AI looks</strong> asks the stylist to reason out coordinated outfits — richer picks, ~3¢ a tap, needs your hosted app.
        </div>

        {items.length > 0 && (() => {
          const rows = items.map(i => ({ item: i, ...eligibilityFor(i, occasion, styleWeather) }));
          const eligible = rows.filter(r => r.eligible);
          const ineligible = rows.filter(r => !r.eligible);
          const noOcc = ineligible.filter(r => !r.occOk).length;
          const warmthN = ineligible.filter(r => r.occOk && !r.warmthOk).length;
          const tile = (r, showReason) => (
            <div key={r.item.id} title={r.item.name} style={{ opacity: r.eligible ? 1 : 0.85 }}>
              <div style={{ aspectRatio: "1", background: S.blushSoft, borderRadius: 6, overflow: "hidden", position: "relative", border: `1px solid ${S.aubergine}14` }}>
                <Thumb src={r.item.img} alt={r.item.name} />
                {showReason && r.reason && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#8a4a3ad9", color: "#fff", fontFamily: "system-ui,sans-serif", fontSize: 9.5, textAlign: "center", padding: "2px 3px" }}>{r.reason}</div>
                )}
              </div>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.item.name}</div>
            </div>
          );
          return (
            <div className="card" style={{ padding: 14, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: S.ink }}>
                  <strong>{eligible.length}</strong> of {items.length} pieces can be styled for {occasion.toLowerCase()}{styleWeather ? ` at ${styleWeather.temp}°C` : ""}.
                </div>
                <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => setShowEligible(v => !v)}>{showEligible ? "Hide" : "See which pieces"}</button>
              </div>
              {showEligible && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#6a8a6a", marginBottom: 8 }}>Eligible now ({eligible.length})</div>
                  {eligible.length
                    ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 10 }}>{eligible.map(r => tile(r, false))}</div>
                    : <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76" }}>Nothing qualifies yet — widen the occasion or warmth on some pieces.</div>}
                  {ineligible.length > 0 && (
                    <>
                      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: S.clay, margin: "16px 0 4px" }}>Not eligible ({ineligible.length})</div>
                      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginBottom: 8 }}>
                        {[noOcc ? `${noOcc} not tagged for ${occasion.toLowerCase()}` : "", warmthN ? `${warmthN} not suited to ${styleWeather ? styleWeather.temp + "°C" : "the temperature"}` : ""].filter(Boolean).join(" · ")}. Fix a piece's tags to bring it into play.
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 10 }}>{ineligible.map(r => tile(r, true))}</div>
                      <button className="btn btn-ghost" style={{ marginTop: 12, padding: "6px 12px" }} onClick={() => setView("closet")}>Edit tags in Closet →</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {!items.length && (
          <Empty title="Your closet is empty" body="Add a few pieces and I'll start putting looks together for the weather outside."
            action={<button className="btn btn-primary" onClick={()=>setView("add")}>Add pieces</button>} />
        )}

        {items.length > 0 && recs.length === 0 && (
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13.5, color: "#7a5a66", background: S.blushSoft, borderRadius: 10, padding: "16px 18px", marginTop: 16 }}>
            Tap <strong>{styleWeather ? "Style me" : "…once you set a location or a temperature"}</strong> and I'll line up a few looks for {occasion.toLowerCase()}{styleWeather?.override ? ` at ${styleWeather.temp}°C` : " in today's weather"} — swipe through and save the ones you love.
          </div>
        )}

        {recs.length > 0 && (
          <div style={{ display: "flex", gap: 16, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 10, marginTop: 18, WebkitOverflowScrolling: "touch" }}>
            {recs.map((o, idx) => {
              const isSaved = savedKeys.has(recKey(o));
              return (
                <div key={o.key} style={{ flex: "0 0 auto", width: "min(300px, 82vw)", scrollSnapAlign: "start", background: S.blushSoft, border: `1px solid ${S.aubergine}18`, borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <div style={{ display: "inline-block", background: "#fff", color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={o.title || `Look ${idx + 1}`}>
                        {recsSource === "ai" && o.title ? o.title : `Look ${idx + 1}`}
                      </div>
                      {recsSource === "ai" && (
                        <span title="Reasoned by the AI stylist" style={{ background: S.gold, color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>✨ AI</span>
                      )}
                    </div>
                    <button onClick={() => setExpanded(idx)} title="Expand this look"
                      style={{ border: `1px solid ${S.aubergine}33`, background: "#fff", color: S.aubergine, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "system-ui,sans-serif", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>⤢ Expand</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                    {o.pieces.map(p => {
                      const isAiSwapping = swapping === idx + ":" + p.id;
                      return (
                      <div key={p.id} style={{ minWidth: 0 }}>
                        <div className={"piece" + (revealed === idx + ":" + p.id ? " revealed" : "")} onClickCapture={tapReveal(idx + ":" + p.id)} style={{ aspectRatio: "1", background: "#fff", borderRadius: 8, overflow: "hidden", border: `1px solid ${S.aubergine}12`, position: "relative" }}>
                          <Thumb src={p.img} alt={p.name} />
                          <div className="pieceActions">
                            <button className="pieceBtn" style={{ background: S.clay, fontSize: 12 }} onClick={() => onAiSwapPiece(idx, p.id)} disabled={!!swapping} title="Ask the stylist to swap this (with a reason)">{isAiSwapping ? "…" : "✨"}</button>
                            <button className="pieceBtn" style={{ background: S.aubergine, fontSize: 13 }} onClick={() => onSwapPiece(idx, p.id)} title="Quick swap for another piece">↻</button>
                            <button className="pieceBtn" style={{ background: "#8a4a3a", fontSize: 15 }} onClick={() => onRemovePiece(idx, p.id)} title="Remove this piece from the look">×</button>
                          </div>
                        </div>
                        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</div>
                      </div>
                      );
                    })}
                  </div>
                  {o.swapNote
                    ? <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: S.ink, background: "#fff", border: `1px solid ${S.aubergine}18`, borderLeft: `3px solid ${S.gold}`, borderRadius: 4, padding: "7px 10px", marginTop: 8, lineHeight: 1.4 }}>✨ {o.swapNote}</div>
                    : <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, color: "#8a6a76", marginTop: 8 }}>Tap or hover a piece for ✨ stylist swap · ↻ quick swap · × remove</div>}
                  {o.notes.length > 0 && (
                    <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#7a5a66", marginTop: 6, lineHeight: 1.4 }}>{o.notes[0]}</div>
                  )}
                  <button className="btn btn-primary" style={{ marginTop: 12, padding: "8px 14px" }} disabled={isSaved} onClick={() => saveRec(o)}>
                    {isSaved ? "Saved ✓" : "♥ Save look"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {expanded != null && recs[expanded] && (
        <LookDetail
          look={recs[expanded]} idx={expanded}
          title={recsSource === "ai" ? (recs[expanded].title || undefined) : undefined}
          saved={savedKeys.has(recKey(recs[expanded]))} swapping={swapping}
          onSwapPiece={onSwapPiece} onAiSwapPiece={onAiSwapPiece} onRemovePiece={onRemovePiece}
          onSave={() => saveRec(recs[expanded])} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

// ---------- Expanded look view (bigger, with per-piece controls) ----------
function LookDetail({ look, idx, title, saved, swapping, onSwapPiece, onAiSwapPiece, onRemovePiece, onSave, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#1a0e15cc", zIndex: 56, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: S.paper, borderRadius: 14, width: "min(680px, 100%)", margin: "auto", boxShadow: "0 20px 60px #0007", overflow: "hidden" }}>
        <div style={{ position: "sticky", top: 0, background: S.aubergine, color: S.blush, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 19 }}>{title || `Look ${idx + 1}`}</div>
          <button onClick={onClose} title="Close" style={{ border: "none", background: "#ffffff22", color: S.blush, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 18 }}>
          {look.pieces.length === 0 && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 14, color: "#7a5a66", padding: "24px 0", textAlign: "center" }}>You've removed every piece from this look. Swap some back in or refresh your looks.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 16 }}>
            {look.pieces.map(p => {
              const isAiSwapping = swapping === idx + ":" + p.id;
              return (
                <div key={p.id} style={{ background: "#fff", border: `1px solid ${S.aubergine}14`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "1", background: S.blushSoft, position: "relative" }}>
                    <Thumb src={p.img} alt={p.name} />
                    {p.role === "optional" && (
                      <div style={{ position: "absolute", top: 6, left: 6, background: S.gold, color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 10 }}>Optional</div>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginBottom: p.reason ? 6 : 10 }}>{p.category}{p.color ? ` · ${p.color}` : ""}{p.tone ? ` · ${p.tone}` : ""}</div>
                    {p.reason && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#6a5560", marginBottom: 10, lineHeight: 1.4 }}>{p.reason}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => onAiSwapPiece(idx, p.id)} disabled={!!swapping} className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }}>{isAiSwapping ? "…" : "✨ Stylist"}</button>
                      <button onClick={() => onSwapPiece(idx, p.id)} className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11 }}>↻ Swap</button>
                      <button onClick={() => onRemovePiece(idx, p.id)} className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 11, color: S.clay }}>× Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {look.swapNote && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: S.ink, background: "#fff", border: `1px solid ${S.aubergine}18`, borderLeft: `3px solid ${S.gold}`, borderRadius: 4, padding: "9px 12px", marginTop: 16, lineHeight: 1.45 }}>✨ {look.swapNote}</div>
          )}
          {look.notes.length > 0 && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", marginTop: 14, lineHeight: 1.5 }}>{look.notes.map((n, i) => <div key={i}>· {n}</div>)}</div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={saved || !look.pieces.length} onClick={onSave}>
            {saved ? "Saved ✓" : "♥ Save look"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Closet-style piece picker (used in the stylist's Q2) ----------
// Shows about two rows and scrolls vertically for the rest, so it stays compact.
function PiecePicker({ items, picked, onToggle }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...CATEGORIES.filter(c => items.some(i => i.category === c))];
  const shown = filter === "All" ? items : items.filter(i => i.category === filter);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {cats.map(c => (
          <button key={c} type="button" className="chip"
            style={{ cursor: "pointer", touchAction: "manipulation", background: filter === c ? S.aubergine : "#fff", color: filter === c ? S.blush : S.ink }}
            onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      <div style={{ maxHeight: 340, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 8, border: `1px solid ${S.aubergine}18`, borderRadius: 8, background: S.blushSoft }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(128px,1fr))", gap: 12 }}>
          {shown.map(i => {
            const on = picked.includes(i.id);
            return (
              <button key={i.id} type="button" onClick={() => onToggle(i.id)} className="card"
                style={{
                  textAlign: "left", padding: 0, cursor: "pointer", touchAction: "manipulation",
                  border: `${on ? 2 : 1}px solid ${on ? S.aubergine : S.aubergine + "18"}`,
                  boxShadow: on ? `0 0 0 1px ${S.aubergine}` : "none",
                }}>
                <div style={{ aspectRatio: "1", background: "#fff", position: "relative" }}>
                  {i.img
                    ? <img src={i.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a6a76", fontFamily: "system-ui,sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>No photo</div>}
                  {on && (
                    <div style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: S.aubergine, color: S.blush, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, boxShadow: "0 1px 4px #0004" }}>✓</div>
                  )}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13.5, color: S.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                  <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, color: "#8a6a76", marginTop: 2 }}>{i.category}{i.color ? ` · ${i.color}` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginTop: 6 }}>Scroll to see more · {picked.length} selected</div>
    </div>
  );
}

// ---------- AI Stylist chat ----------
function Stylist({ items, weather, occasion, outfit, inspo, liked, setView, onSaveLook, disliked, onDislike, removedNames, onNotePieceRemoved, memory, onRemember, onForget, savedTaste }) {
  const dislikedKeys = new Set((disliked || []).map(d => d.key));
  const comboKey = (pcs) => pcs.map(p => p.id).sort().join(",");
  const [step, setStep] = useState("q1"); // q1 | q2 | chat
  const [style, setStyle] = useState("");
  const [styleOther, setStyleOther] = useState("");
  const [pieces, setPieces] = useState("");       // free-text pieces in mind
  const [picked, setPicked] = useState([]);       // ids of closet pieces tapped in Q2
  const [piecesUsed, setPiecesUsed] = useState(""); // combined pieces text used this conversation
  const [chat, setChat] = useState([]); // {role:'user'|'assistant', content:string}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [savedKeys, setSavedKeys] = useState(() => new Set()); // stylist looks saved this session
  const [boards, setBoards] = useState({});   // per-message edited outfit boards
  const [boardSwapping, setBoardSwapping] = useState(null); // "msgIndex:pieceId" being AI-swapped
  const [expanded, setExpanded] = useState(null); // message index shown in the big view
  const [restored, setRestored] = useState(false); // true once a saved thread has loaded
  const { revealed, tapReveal } = useTapReveal();  // touch: tap a piece to show controls
  const endRef = useRef(null);

  // Resume the conversation from durable storage so it survives reloads.
  useEffect(() => {
    let alive = true;
    idbGet("stylistchat").then(t => {
      if (alive && t && typeof t === "object") {
        if (t.step) setStep(t.step);
        if (t.style) setStyle(t.style);
        if (typeof t.piecesUsed === "string") setPiecesUsed(t.piecesUsed);
        if (Array.isArray(t.chat)) setChat(t.chat);
      }
      if (alive) setRestored(true);
    }).catch(() => { if (alive) setRestored(true); });
    return () => { alive = false; };
  }, []);
  // Persist the thread as it changes (only after the initial restore).
  useEffect(() => {
    if (!restored) return;
    idbSet("stylistchat", { step, style, piecesUsed, chat }).catch(() => {});
  }, [step, style, piecesUsed, chat, restored]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [chat, busy]);

  function systemPrompt(chosenStyle, piecesTextValue) {
    const closet = items.length
      ? items.map(i => `- ${i.name} (${i.category}, ${i.color}, ${i.tone} tone, warmth ${i.warmth}, for ${(i.formality||[]).join("/") || "any"})`).join("\n")
      : "(the closet is empty)";
    const suggestion = outfit?.pieces?.length
      ? outfit.pieces.map(p => `${p.name} (${p.category}, ${p.color})`).join("; ")
      : "(none generated yet)";
    const w = weather ? `${weather.dayLabel && weather.dayLabel !== "Today" ? weather.dayLabel + ", " : ""}${weather.temp}°C${weather.override ? " (a temperature they've chosen to dress for)" : ""}, ${weatherLabel(weather.code)}${weather.wind > 25 ? ", windy" : ""}` : "unknown";
    return `You are a warm, sharp personal stylist working inside the user's own wardrobe app. ` +
      `Build looks ONLY from the pieces in their closet below; if something useful is missing, say so briefly. ` +
      `Make FULL use of their closet: consider every eligible piece for the occasion and weather, and rotate through their wardrobe across suggestions — don't lean on the same few items each time. When you offer another option, deliberately reach for pieces you haven't used yet unless one is genuinely the best choice or they've asked for it. ` +
      `Reference pieces by their exact names. Keep replies concise and friendly — a few sentences, not an essay. Use plain text (no markdown headers).\n\n` +
      `When you propose a full outfit, format your reply as:\n` +
      `1. A first line: "Look: <2-4 word name>".\n` +
      `2. A short, friendly explanation (2-4 sentences).\n` +
      `3. A final block listing every piece, one per line, in EXACTLY this format:\n` +
      `Pieces:\n- <exact closet piece name> | <core or optional> | <one short reason you chose it>\n` +
      `Mark a piece "optional" ONLY when it is a just-in-case layer (e.g. a jacket to add if the evening gets cooler); everything actually worn is "core". Give a genuine reason for each.\n\n` +
      `Today's context:\n` +
      `- Weather: ${w}\n` +
      `- Occasion: ${occasion}\n` +
      `- Style they want: ${chosenStyle || "unspecified"}\n` +
      `- Pieces they'd like to include: ${piecesTextValue || "none specified"}\n` +
      `- The app's weather-based suggestion: ${suggestion}\n` +
      `- Their closet:\n${closet}\n` +
      (inspo.length ? `\nThey've shared ${inspo.length} photo(s) of outfits they've WORN (their usual style — match what suits them).` : "") +
      (liked.length ? `\nThey've also shared ${liked.length} photo(s) of outfits they LIKE and want to lean toward (aspiration — nudge the look in this direction, while only using pieces from their closet).` : "") +
      (savedTaste ? `\n\n${savedTaste}` : "") +
      ((memory && (memory.styles?.length || memory.notes?.length)) ? `\n\nCARRY OVER what you've learned about them from earlier conversations — actively take these requests, comments and past suggestions into account (honour what they asked for, don't repeat looks you've already suggested unless they ask, and keep continuity with their taste). Weave it in naturally; don't recite it back:` +
        (memory.styles?.length ? `\n- Styles they've asked for before: ${memory.styles.slice(0, 8).join(", ")}.` : "") +
        (memory.notes?.length ? `\n- Their past requests, comments and looks you've already suggested (most recent first):\n${memory.notes.slice(0, 24).map(n => `  · ${n}`).join("\n")}` : "") : "") +
      ((removedNames && removedNames.length) ? `\n\nThe user often REMOVES these pieces from suggested looks — lean away from them unless they're clearly ideal: ${removedNames.join(", ")}.` : "") +
      ((disliked && disliked.length) ? `\n\nNEVER suggest these exact combinations again — the user disliked them:\n${disliked.map(d => `- ${d.names.join(" + ")}`).join("\n")}` : "");
  }

  async function send(userText, chosenStyle, withImages, piecesTextValue) {
    setBusy(true); setErr(null);
    const nextChat = [...chat, { role: "user", content: userText }];
    setChat(nextChat);
    try {
      const apiMessages = nextChat.map(m => ({ role: m.role, content: m.content }));
      // Attach style photos to the very first message only (once per conversation).
      const firstReply = chat.some(m => m.role === "assistant");
      if (withImages && !firstReply && (inspo.length || liked.length)) {
        const blocks = [];
        const pushImg = (p) => {
          const comma = p.img.indexOf(",");
          const mt = (p.img.slice(0, comma).match(/data:(.*?);/) || [])[1] || "image/jpeg";
          blocks.push({ type: "image", source: { type: "base64", media_type: mt, data: p.img.slice(comma + 1) } });
        };
        if (inspo.length) { blocks.push({ type: "text", text: "Photos of outfits I've worn (my usual style):" }); inspo.slice(0, 3).forEach(pushImg); }
        if (liked.length) { blocks.push({ type: "text", text: "Photos of outfits I like and want to lean toward:" }); liked.slice(0, 3).forEach(pushImg); }
        blocks.push({ type: "text", text: userText });
        apiMessages[0] = { role: "user", content: blocks };
      }
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt(chosenStyle, piecesTextValue), messages: apiMessages, max_tokens: 700 }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      const reply = data.text || "(no reply)";
      setChat(c => [...c, { role: "assistant", content: reply }]);
      // Remember the outfits the stylist proposes, so later chats recall them.
      const proposed = parseOutfitReply(reply, items);
      if (proposed.pieces.length >= 2) {
        onRemember?.({ note: `You suggested ${proposed.title ? `"${proposed.title}"` : "a look"}: ${proposed.pieces.map(p => p.name).join(", ")}.` });
      }
    } catch (e) {
      setErr(e.message === "needs-key"
        ? "The AI stylist needs the hosted app that holds your API key (your Render deployment). The weather-based “Style me” above works everywhere."
        : "Couldn't reach the stylist just now — please try again in a moment.");
    }
    setBusy(false);
  }

  function chooseStyle(s) { setStyle(s); setStyleOther(""); setStep("q2"); }
  function chooseStyleOther() {
    const s = styleOther.trim();
    if (!s) return;
    setStyle(s); setStep("q2");
  }
  function togglePiece(id) {
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }
  // Tapped closet pieces + any free text, as one phrase for the stylist.
  function combinedPieces() {
    const names = items.filter(i => picked.includes(i.id)).map(i => i.name);
    return [names.join(", "), pieces.trim()].filter(Boolean).join("; ");
  }
  function begin(piecesTextValue) {
    setStep("chat");
    setPiecesUsed(piecesTextValue);
    onRemember?.({ style, note: `Dressed for ${occasion.toLowerCase()}, wanted a "${style}" look${piecesTextValue ? ` built around ${piecesTextValue}` : ""}.` });
    const tempLine = weather
      ? (weather.override
          ? `I want to dress for ${weather.temp}°C. `
          : `It's ${weather.temp}°C, ${weatherLabel(weather.code).toLowerCase()}. `)
      : "";
    const opener = `I'm dressing for ${occasion.toLowerCase()}. The style I'm after is "${style}". ` +
      (piecesTextValue ? `I'd like to build it around: ${piecesTextValue}. ` : `I don't have specific pieces in mind. `) +
      tempLine +
      `Please style a full outfit from my closet and tell me why it works.`;
    send(opener, style, true, piecesTextValue);
  }
  function submitFollowup() {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    onRemember?.({ note: t }); // remember what they ask, across conversations
    send(t, style, false, piecesUsed);
  }
  function reset() {
    setStep("q1"); setStyle(""); setStyleOther(""); setPieces(""); setPicked([]); setPiecesUsed(""); setChat([]); setInput(""); setErr(null); setBoards({});
    idbSet("stylistchat", null).catch(() => {}); // clear the saved thread, keep memory
  }

  // Which closet pieces does a stylist reply name? (so we can show their photos)
  function mentionedPieces(text) {
    if (!text) return [];
    const low = text.toLowerCase();
    const seen = new Set();
    const out = [];
    for (const it of items) {
      const n = (it.name || "").trim();
      if (n.length >= 3 && low.includes(n.toLowerCase()) && !seen.has(it.id)) {
        seen.add(it.id); out.push(it);
      }
    }
    return out.slice(0, 8);
  }
  const pieceStrip = (pcs, key) => (
    <div key={key} style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
      {pcs.map(p => (
        <div key={p.id} style={{ width: 78 }}>
          <div style={{ aspectRatio: "1", background: S.blushSoft, borderRadius: 6, overflow: "hidden", border: `1px solid ${S.aubergine}18` }}>
            <Thumb src={p.img} alt={p.name} />
          </div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</div>
        </div>
      ))}
    </div>
  );

  function regenerate() {
    if (busy) return;
    // Tell the stylist which pieces it's already shown, so it reaches into the rest of
    // the closet instead of repeating the same items. (Not a rejection of the last one.)
    const used = new Set();
    chat.forEach((m, i) => {
      if (m.role !== "assistant") return;
      boardBase(i).forEach(p => used.add(p.name));
      (boards[i]?.pieces || []).forEach(p => used.add(p.name));
    });
    const names = [...used].filter(Boolean);
    const avoid = names.length
      ? ` So far you've shown me: ${names.join(", ")}. Please build this one around DIFFERENT pieces from my closet and make use of more of my wardrobe.`
      : "";
    send(`Could you show me another option from my closet? I'd like to see more of my wardrobe — I'm not rejecting the last one.${avoid}`, style, false, piecesUsed);
  }

  // ----- Editable outfit boards (per assistant message) -----
  // The pieces a message's board starts from (structured block, else name-mentions).
  const boardBase = (i) => {
    const text = chat[i]?.content || "";
    const parsed = parseOutfitReply(text, items);
    if (parsed.pieces.length >= 2) return parsed.pieces;
    return mentionedPieces(text).map(it => ({ ...it, role: "core", reason: "" }));
  };
  const boardPieces = (i) => boards[i]?.pieces ?? boardBase(i);
  const boardSwapNote = (i) => boards[i]?.swapNote;
  function setBoard(i, patch) { setBoards(prev => ({ ...prev, [i]: { ...(prev[i] || { pieces: boardBase(i) }), ...patch } })); }

  function boardSwap(i, pieceId) {
    const cur = boardPieces(i);
    const piece = cur.find(p => p.id === pieceId);
    if (!piece) return;
    const alt = pickAlternative(items, weather, occasion, piece, cur);
    const pieces = alt ? cur.map(p => p.id === pieceId ? { ...alt, role: piece.role, reason: "" } : p) : cur.filter(p => p.id !== pieceId);
    setBoard(i, { pieces, swapNote: undefined });
  }
  function boardRemove(i, pieceId) {
    const cur = boardPieces(i);
    const piece = cur.find(p => p.id === pieceId);
    if (piece) onNotePieceRemoved?.(piece); // learn from the removal
    setBoard(i, { pieces: cur.filter(p => p.id !== pieceId), swapNote: undefined });
  }
  async function boardAiSwap(i, pieceId) {
    if (boardSwapping) return;
    const cur = boardPieces(i);
    const piece = cur.find(p => p.id === pieceId);
    if (!piece) return;
    const usedIds = new Set(cur.map(p => p.id));
    const alts = items.filter(it => it.category === piece.category && it.formality?.includes(occasion) && !usedIds.has(it.id));
    if (!alts.length) { setErr(`No other ${piece.category.toLowerCase()} in your closet to swap in.`); return; }
    setBoardSwapping(i + ":" + pieceId); setErr(null);
    try {
      const lookDesc = cur.map(p => `${p.name} (${p.category}, ${p.color})`).join("; ");
      const options = alts.map(a => `- ${a.name} (${a.color}, ${a.tone} tone, warmth ${a.warmth})`).join("\n");
      const w = weather ? `${weather.temp}°C, ${weatherLabel(weather.code)}` : "unknown";
      const sys = "You are a personal stylist. The user wants to replace ONE piece in an outfit from their own closet. Pick the single best replacement from the provided options ONLY. Reply with ONE line in EXACTLY this format, nothing else:\nSwap: <exact option name> | <one short sentence on why it works>";
      const msg = `Occasion: ${occasion}. Weather: ${w}.\nThe outfit: ${lookDesc}.\nReplace this piece: ${piece.name} (${piece.category}).\nChoose from these options:\n${options}`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ system: sys, messages: [{ role: "user", content: msg }], max_tokens: 200 }) });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      const m = (data.text || "").match(/^\s*swap\s*:\s*(.+)$/im);
      let chosen = null, reason = "";
      if (m) { const [nm, ...rest] = m[1].split("|").map(s => s.trim()); reason = rest.join(" | "); const low = nm.toLowerCase(); chosen = alts.find(a => a.name.toLowerCase() === low) || alts.find(a => low.includes(a.name.toLowerCase())); }
      const alt = chosen || pickAlternative(items, weather, occasion, piece, cur);
      if (!alt) { setErr("Couldn't find an alternative."); setBoardSwapping(null); return; }
      const cur2 = boardPieces(i);
      setBoard(i, { pieces: cur2.map(p => p.id === pieceId ? { ...alt, role: piece.role, reason: reason || "" } : p), swapNote: `${piece.name} → ${alt.name}${reason ? " — " + reason : ""}` });
    } catch (e) {
      setErr(e.message === "needs-key" ? "AI swap needs your hosted app (Render)." : "Couldn't reach the stylist — try again.");
    }
    setBoardSwapping(null);
  }

  // A small piece tile: the controls (✨ stylist swap / ↻ swap / × remove) sit in a
  // bar along the bottom of the photo and appear on hover.
  const pieceTile = (i, p) => {
    const isAiSwapping = boardSwapping === i + ":" + p.id;
    return (
      <div key={p.id} style={{ minWidth: 0 }}>
        <div className={"piece" + (revealed === i + ":" + p.id ? " revealed" : "")} onClickCapture={tapReveal(i + ":" + p.id)} style={{ aspectRatio: "1", background: "#fff", borderRadius: 8, overflow: "hidden", border: `1px solid ${S.aubergine}12`, position: "relative" }}>
          <Thumb src={p.img} alt={p.name} />
          {p.role === "optional" && (
            <div style={{ position: "absolute", top: 4, left: 4, background: S.gold, color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 10 }}>Optional</div>
          )}
          <div className="pieceActions">
            <button className="pieceBtn" style={{ background: S.clay, width: 24, height: 24, fontSize: 11 }} onClick={() => boardAiSwap(i, p.id)} disabled={!!boardSwapping} title="Ask the stylist to swap this (with a reason)">{isAiSwapping ? "…" : "✨"}</button>
            <button className="pieceBtn" style={{ background: S.aubergine, width: 24, height: 24, fontSize: 12 }} onClick={() => boardSwap(i, p.id)} title="Quick swap">↻</button>
            <button className="pieceBtn" style={{ background: "#8a4a3a", width: 24, height: 24, fontSize: 14 }} onClick={() => boardRemove(i, p.id)} title="Remove from look">×</button>
          </div>
        </div>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</div>
      </div>
    );
  };

  // A visual outfit board: title, core pieces, optional layers (tagged separately),
  // a "why each piece" overview, per-piece controls, and save / dislike / redo.
  const outfitBoard = (title, allPieces, i) => {
    const pcs = allPieces;
    const core = pcs.filter(p => p.role !== "optional");
    const optional = pcs.filter(p => p.role === "optional");
    const withReasons = pcs.filter(p => p.reason);
    const key = "ai|" + occasion + "|" + pcs.map(p => p.id).sort().join(",");
    const saved = savedKeys.has(key);
    const isDisliked = dislikedKeys.has(comboKey(pcs));
    const note = boardSwapNote(i);
    return (
      <div key={"o" + i} style={{ background: S.blushSoft, border: `1px solid ${S.aubergine}18`, borderRadius: 12, padding: 14, margin: "0 0 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "inline-block", background: "#fff", color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 4 }}>
            {title || style || "Your look"}
          </div>
          <button onClick={() => setExpanded(i)} title="Expand this look"
            style={{ border: `1px solid ${S.aubergine}33`, background: "#fff", color: S.aubergine, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "system-ui,sans-serif", fontSize: 12 }}>⤢ Expand</button>
        </div>

        {core.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 10 }}>
            {core.map(p => pieceTile(i, p))}
          </div>
        )}
        {optional.length > 0 && (
          <>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: S.clay, margin: "12px 0 6px" }}>Optional layer — only if needed</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 10 }}>
              {optional.map(p => pieceTile(i, p))}
            </div>
          </>
        )}

        {withReasons.length > 0 && (
          <div style={{ background: "#fff", border: `1px solid ${S.aubergine}14`, borderRadius: 8, padding: "10px 12px", marginTop: 12 }}>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: S.clay, marginBottom: 7 }}>Why this look</div>
            {withReasons.map(p => (
              <div key={p.id} style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: S.ink, marginBottom: 5, lineHeight: 1.4 }}>
                <strong>{p.name}</strong>{p.role === "optional" ? " (optional)" : ""} — <span style={{ color: "#6a5560" }}>{p.reason}</span>
              </div>
            ))}
          </div>
        )}

        {note && (
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: S.ink, background: "#fff", border: `1px solid ${S.aubergine}18`, borderLeft: `3px solid ${S.gold}`, borderRadius: 4, padding: "7px 10px", marginTop: 10, lineHeight: 1.4 }}>✨ {note}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ padding: "8px 14px" }} disabled={saved || !pcs.length}
            onClick={() => { const k = onSaveLook(pcs); if (k) setSavedKeys(s => new Set(s).add(k)); }}>
            {saved ? "Saved ✓" : "♥ Save look"}
          </button>
          <button className="btn btn-ghost" style={{ padding: "8px 14px" }} disabled={busy || isDisliked || !pcs.length}
            onClick={() => {
              onDislike(pcs);
              const names = pcs.map(p => p.name).join(", ");
              send(`I don't like this combination — never suggest it again (${names}). Please style a different outfit from my closet.`, style, false, piecesUsed);
            }}>
            {isDisliked ? "Won't suggest again ✓" : "👎 Don't suggest again"}
          </button>
          <button className="btn btn-ghost" style={{ padding: "8px 14px" }} disabled={busy} onClick={regenerate}>Suggest another</button>
        </div>
      </div>
    );
  };

  const bubble = (who, text, key) => (
    <div key={key} style={{ display: "flex", justifyContent: who === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{
        maxWidth: "82%", whiteSpace: "pre-wrap", fontFamily: "system-ui,sans-serif", fontSize: 13.5, lineHeight: 1.5,
        padding: "9px 13px", borderRadius: 14,
        background: who === "user" ? S.aubergine : "#fff",
        color: who === "user" ? S.blush : S.ink,
        border: who === "user" ? "none" : `1px solid ${S.aubergine}22`,
        borderBottomRightRadius: who === "user" ? 4 : 14,
        borderBottomLeftRadius: who === "user" ? 14 : 4,
      }}>{text}</div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 30, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 2 }}>Ask your stylist</div>
          <div style={{ fontSize: 19 }}>AI Stylist</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(memory?.notes?.length > 0 || memory?.styles?.length > 0) && (
            <button className="btn btn-ghost" style={{ padding: "6px 12px" }}
              onClick={() => { if (confirm("Forget everything the stylist remembers from past conversations?")) onForget?.(); }}>Forget memory</button>
          )}
          {(step !== "q1" || chat.length > 0) && (
            <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={reset}>Start over</button>
          )}
        </div>
      </div>

      {/* Q1 — what style */}
      {step === "q1" && (
        <div>
          {bubble("assistant", "Hi — I'll help you get dressed. First: what kind of look are you going for today?", "q1")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 6px" }}>
            {STYLE_OPTIONS.map(s => (
              <button key={s} type="button" onClick={() => chooseStyle(s)}
                style={{ cursor: "pointer", fontFamily: "system-ui,sans-serif", fontSize: 12.5, padding: "7px 12px", borderRadius: 16, border: `1px solid ${S.aubergine}33`, background: "#fff", color: S.ink, touchAction: "manipulation" }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={styleOther} onChange={e => setStyleOther(e.target.value)} placeholder="…or describe it in your own words"
              onKeyDown={e => { if (e.key === "Enter") chooseStyleOther(); }} style={{ flex: 1 }} />
            <button className="btn btn-ghost" style={{ padding: "8px 12px" }} onClick={chooseStyleOther} disabled={!styleOther.trim()}>Next</button>
          </div>
        </div>
      )}

      {/* Q2 — pieces in mind */}
      {step === "q2" && (
        <div>
          {bubble("user", style, "q1a")}
          {bubble("assistant", "Lovely. Tap any pieces you'd like to build the look around — or describe them below. (optional)", "q2")}
          {items.length > 0 && (
            <div style={{ margin: "12px 0" }}>
              <PiecePicker items={items} picked={picked} onToggle={togglePiece} />
            </div>
          )}
          <textarea value={pieces} onChange={e => setPieces(e.target.value)} rows={2}
            placeholder="…or describe pieces in your own words — or leave blank"
            style={{ width: "100%", marginTop: 4, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => begin(combinedPieces())}>Style me</button>
            <button className="btn btn-ghost" onClick={() => begin("")}>Nothing specific</button>
            <button className="btn btn-ghost" onClick={() => setStep("q1")}>Back</button>
          </div>
        </div>
      )}

      {/* Chat */}
      {step === "chat" && (
        <div>
          <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
            {chat.map((m, i) => {
              if (m.role !== "assistant") {
                return <React.Fragment key={i}>{bubble("user", m.content, "b" + i)}</React.Fragment>;
              }
              const parsed = parseOutfitReply(m.content, items);
              const current = boardPieces(i);
              const isBoard = boards[i] ? current.length >= 1 : current.length >= 2;
              if (isBoard) {
                return (
                  <React.Fragment key={i}>
                    {bubble("assistant", parsed.prose || m.content, "b" + i)}
                    {outfitBoard(parsed.title, current, i)}
                  </React.Fragment>
                );
              }
              const one = mentionedPieces(m.content);
              return (
                <React.Fragment key={i}>
                  {bubble("assistant", m.content, "b" + i)}
                  {one.length === 1 && pieceStrip(one, "s" + i)}
                </React.Fragment>
              );
            })}
            {busy && bubble("assistant", "Thinking…", "busy")}
            {err && (
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a4a3a", background: S.blushSoft, borderLeft: `3px solid ${S.clay}`, padding: "10px 12px", borderRadius: 4, marginBottom: 8 }}>
                {err}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about the look, or request a change…"
              onKeyDown={e => { if (e.key === "Enter") submitFollowup(); }} disabled={busy} style={{ flex: 1 }} />
            <button className="btn btn-primary" style={{ padding: "10px 16px" }} onClick={submitFollowup} disabled={busy || !input.trim()}>Send</button>
          </div>
          {inspo.length === 0 && liked.length === 0 && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 8 }}>
              Tip: add photos in <button onClick={() => setView("mystyle")} style={{ background: "none", border: "none", color: S.clay, cursor: "pointer", textDecoration: "underline", font: "inherit", padding: 0 }}>My Style</button> so the stylist learns your taste.
            </div>
          )}
        </div>
      )}

      {expanded != null && boardPieces(expanded).length > 0 && (
        <LookDetail
          look={{ pieces: boardPieces(expanded), notes: [], swapNote: boardSwapNote(expanded) }}
          idx={expanded}
          title={parseOutfitReply(chat[expanded]?.content || "", items).title || style || "Your look"}
          saved={savedKeys.has("ai|" + occasion + "|" + boardPieces(expanded).map(p => p.id).sort().join(","))}
          swapping={boardSwapping}
          onSwapPiece={(i, pid) => boardSwap(i, pid)} onAiSwapPiece={(i, pid) => boardAiSwap(i, pid)} onRemovePiece={(i, pid) => boardRemove(i, pid)}
          onSave={() => { const k = onSaveLook(boardPieces(expanded)); if (k) setSavedKeys(s => new Set(s).add(k)); }}
          onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

// ---------- Personal Shopper ----------
// Saved stores + an AI shopper that can search the live web (via /api/shop) to
// suggest new pieces for the closet, find current sales at the saved stores, and
// discover new brands the user can save.
const SALE_STALE_MS = 20 * 60 * 60 * 1000; // treat a sale check older than ~20h as stale

// Turn bare URLs in a string into clickable links (for shopper replies).
function linkify(text) {
  const parts = (text || "").split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: S.clay, wordBreak: "break-word" }}>{p.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>
      : <React.Fragment key={i}>{p}</React.Fragment>
  );
}

// Pull "Brand: name | url | reason" lines out of a reply so the app can offer to
// save them; return the remaining prose plus the parsed brand suggestions.
function splitBrandLines(text) {
  const found = [];
  const kept = [];
  for (const line of (text || "").split("\n")) {
    const m = line.match(/^\s*brand\s*:\s*(.+)$/i);
    if (m) {
      const [name, url, ...rest] = m[1].split("|").map(s => s.trim());
      if (name) found.push({ name, url: url || "", reason: rest.join(" | ") });
    } else kept.push(line);
  }
  return { text: kept.join("\n").trim(), brands: found };
}

function Shopper({ items, brands, addBrand, removeBrand, inspo, liked, setView, onScanCloset, scanning }) {
  const scannable = items.filter(i => typeof i.img === "string" && i.img.startsWith("data:")).length;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [chat, setChat] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [news, setNews] = useState(null); // { at, text } — last sale check, persisted
  const endRef = useRef(null);

  useEffect(() => { idbGet("shopnews").then(v => { if (v && v.text) setNews(v); }).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [chat, busy]);

  const saleStale = !news || (Date.now() - Date.parse(news.at || 0)) > SALE_STALE_MS;
  const brandNorm = (u) => (u || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
  const isSaved = (b) => brands.some(x =>
    (b.url && brandNorm(x.url) === brandNorm(b.url)) ||
    (b.name && (x.name || "").toLowerCase() === b.name.toLowerCase()));

  function systemPrompt() {
    const closet = items.length
      ? items.map(i => `- ${i.name} (${i.category}, ${i.color}, ${i.tone} tone, for ${(i.formality || []).join("/") || "any"})`).join("\n")
      : "(the closet is empty)";
    const stores = brands.length
      ? brands.map(b => `- ${b.name}${b.url ? ` (${b.url})` : ""}${b.note ? ` — ${b.note}` : ""}`).join("\n")
      : "(no stores saved yet)";
    return `You are a sharp, friendly personal shopper working inside the user's own wardrobe app. ` +
      `You help them buy new pieces that complement the closet they already own and match their taste. ` +
      `You can search the live web — use it to find specific items, real current prices, and genuine current sales; never invent a sale or a link. ` +
      `Be concise and concrete: name specific brands and items, give an approximate price, and include a real product or store link when you have one. ` +
      `Prefer the user's saved stores when suggesting where to buy, but you may recommend others too.\n\n` +
      `When you recommend a brand or shop that is NOT already in their saved list, put it on its OWN line in EXACTLY this format so the app can offer to save it:\n` +
      `Brand: <name> | <homepage url> | <short reason it suits them>\n\n` +
      `Their saved stores:\n${stores}\n\n` +
      `Their closet:\n${closet}\n` +
      (inspo.length || liked.length ? `\nThey've shared photos of their style in the app (worn + aspirational looks) — assume a taste consistent with the closet above.` : "");
  }

  async function ask(userText, opts = {}) {
    if (busy) return;
    setBusy(true); setErr(null);
    const nextChat = [...chat, { role: "user", content: userText }];
    setChat(nextChat);
    try {
      const res = await fetch("/api/shop", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt(), messages: nextChat.map(m => ({ role: m.role, content: m.content })), max_tokens: 1500 }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      const text = data.text || "(no reply)";
      setChat(c => [...c, { role: "assistant", content: text }]);
      if (opts.recordSale) {
        const rec = { at: new Date().toISOString(), text };
        setNews(rec); idbSet("shopnews", rec).catch(() => {});
      }
    } catch (e) {
      setErr(e.message === "needs-key"
        ? "The personal shopper needs the hosted app that holds your API key (your Render deployment). Saving stores works everywhere."
        : "Couldn't reach the shopper just now — please try again in a moment.");
    }
    setBusy(false);
  }

  const suggestPieces = () => ask(
    "Look at my closet and suggest 3–5 specific new pieces I should buy to fill gaps and get more outfits out of what I own. " +
    "Prefer my saved stores, name specific items with an approximate price, and include a link for each. Explain briefly how each works with pieces I already have.");
  const findSales = () => ask(
    "Check each of my saved stores for any sales, discounts, or promotions happening right now. " +
    "For each store, tell me whether there's a sale on, what's discounted, and include a link. If a store has nothing on, say so briefly.",
    { recordSale: true });
  const discoverBrands = () => ask(
    "Search the web for a few brands or shops I don't already have saved that fit my taste and closet. " +
    "Give each as a 'Brand:' line so I can save it, with a short reason it suits me.");

  function submit() {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    ask(t);
  }
  function addStore() {
    if (addBrand({ name, url, note })) { setName(""); setUrl(""); setNote(""); }
  }

  const bubble = (who, children, key) => (
    <div key={key} style={{ display: "flex", justifyContent: who === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div style={{
        maxWidth: "88%", whiteSpace: "pre-wrap", fontFamily: "system-ui,sans-serif", fontSize: 13.5, lineHeight: 1.5,
        padding: "9px 13px", borderRadius: 14,
        background: who === "user" ? S.aubergine : "#fff",
        color: who === "user" ? S.blush : S.ink,
        border: who === "user" ? "none" : `1px solid ${S.aubergine}22`,
        borderBottomRightRadius: who === "user" ? 4 : 14,
        borderBottomLeftRadius: who === "user" ? 14 : 4,
      }}>{children}</div>
    </div>
  );

  // A saveable brand suggestion the shopper surfaced in a reply.
  const brandCard = (b, key) => {
    const saved = isSaved(b);
    return (
      <div key={key} style={{ background: S.blushSoft, border: `1px solid ${S.aubergine}18`, borderRadius: 10, padding: "10px 13px", margin: "0 0 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15 }}>{b.name}</div>
          {b.url && <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: S.clay, wordBreak: "break-word" }}>{brandNorm(b.url)}</a>}
        </div>
        {b.reason && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66", margin: "4px 0 8px" }}>{b.reason}</div>}
        <button className="btn btn-ghost" style={{ padding: "6px 12px" }} disabled={saved}
          onClick={() => addBrand({ name: b.name, url: b.url, note: b.reason })}>
          {saved ? "Saved ✓" : "+ Save brand"}
        </button>
      </div>
    );
  };

  return (
    <div>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", maxWidth: 600, margin: "0 0 22px" }}>
        Save the stores and brands you love, and your personal shopper will suggest new pieces that fit your closet, watch for sales, and hunt down brands you might like. It searches the live web, so it needs your hosted app (Render).
      </p>

      {/* Saved stores */}
      <div className="card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 4 }}>Your stores</div>
        <div style={{ fontSize: 19, marginBottom: 12 }}>Saved brands & shops ({brands.length})</div>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", marginBottom: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Store name (e.g. Aritzia)" style={{ minWidth: 0 }} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Link (e.g. aritzia.com)" onKeyDown={e => { if (e.key === "Enter") addStore(); }} style={{ minWidth: 0 }} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional — what you buy there)" onKeyDown={e => { if (e.key === "Enter") addStore(); }} style={{ width: "100%", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary" onClick={addStore} disabled={!name.trim() && !url.trim()}>Add store</button>
          {scannable > 0 && (
            <button className="btn btn-ghost" onClick={onScanCloset} disabled={!!scanning}>
              {scanning ? `Scanning ${scanning.done}/${scanning.total}…` : `Scan closet for brands (${scannable})`}
            </button>
          )}
        </div>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 8 }}>
          New pieces you add have their brand saved automatically. Use <em>Scan closet for brands</em> to find brands in pieces you've already added.
        </div>

        {brands.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 16 }}>
            {brands.map(b => (
              <div key={b.id} style={{ border: `1px solid ${S.aubergine}18`, borderRadius: 8, padding: "10px 12px", position: "relative" }}>
                <div style={{ fontSize: 15, paddingRight: 20 }}>{b.name}</div>
                {b.url && <a href={/^https?:\/\//i.test(b.url) ? b.url : "https://" + b.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: S.clay, wordBreak: "break-word" }}>{brandNorm(b.url)}</a>}
                {b.note && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: "#8a6a76", marginTop: 4 }}>{b.note}</div>}
                <button onClick={() => removeBrand(b.id)} title="Remove" style={{ position: "absolute", top: 6, right: 6, border: "none", background: "transparent", color: "#8a6a76", fontSize: 18, lineHeight: 1, cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        )}
        {brands.length === 0 && (
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76", marginTop: 12 }}>
            Add a store or two above — then ask your shopper to find pieces or check them for sales.
          </div>
        )}
      </div>

      {/* Sale watch */}
      <div className="card" style={{ padding: 18, marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 2 }}>Sale watch</div>
            <div style={{ fontSize: 19 }}>Sales at your stores</div>
          </div>
          <button className="btn btn-primary" onClick={findSales} disabled={busy || !brands.length}>Check for sales now</button>
        </div>
        {news && (
          <div style={{ marginTop: 14, background: S.blushSoft, borderLeft: `3px solid ${S.gold}`, padding: "12px 16px", fontFamily: "system-ui,sans-serif", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            <div style={{ fontSize: 11, color: "#8a6a76", marginBottom: 6 }}>
              Last checked {new Date(news.at).toLocaleString()}{saleStale ? " · check again for the latest" : ""}
            </div>
            {linkify(news.text)}
          </div>
        )}
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 12 }}>
          Tip: I can't send background alerts on their own — open this page and tap <em>Check for sales</em> whenever you want the latest; your last check stays here.
        </div>
      </div>

      {/* Shopper conversation */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 2 }}>Ask your shopper</div>
        <div style={{ fontSize: 19, marginBottom: 14 }}>Personal Shopper</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={suggestPieces} disabled={busy}>Suggest pieces for my closet</button>
          <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={discoverBrands} disabled={busy}>Discover new brands</button>
          {chat.length > 0 && <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={() => { setChat([]); setErr(null); }} disabled={busy}>Clear chat</button>}
        </div>

        {chat.length === 0 && !busy && (
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", background: S.blushSoft, borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            Hi — I'm your personal shopper. Tap a button above, or ask me anything: “find me a camel coat under £150”, “what shoes go with my green dress?”, or “which of my stores has the best knitwear?”
          </div>
        )}

        <div style={{ maxHeight: 460, overflowY: "auto", paddingRight: 4 }}>
          {chat.map((m, i) => {
            if (m.role === "user") return <React.Fragment key={i}>{bubble("user", m.content, "b" + i)}</React.Fragment>;
            const { text, brands: found } = splitBrandLines(m.content);
            return (
              <React.Fragment key={i}>
                {text && bubble("assistant", linkify(text), "b" + i)}
                {found.map((b, j) => brandCard(b, "br" + i + "-" + j))}
              </React.Fragment>
            );
          })}
          {busy && bubble("assistant", "Searching…", "busy")}
          {err && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a4a3a", background: S.blushSoft, borderLeft: `3px solid ${S.clay}`, padding: "10px 12px", borderRadius: 4, marginBottom: 8 }}>
              {err}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask for a piece, a brand, or a price…"
            onKeyDown={e => { if (e.key === "Enter") submit(); }} disabled={busy} style={{ flex: 1 }} />
          <button className="btn btn-primary" style={{ padding: "10px 16px" }} onClick={submit} disabled={busy || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Insights (style profile + colour palette) ----------
// A small meter bar used across the insights breakdowns.
function Meter({ label, value, max, count, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: S.ink, marginBottom: 4 }}>
        <span>{label}</span><span style={{ color: "#8a6a76" }}>{count}</span>
      </div>
      <div style={{ height: 8, background: "#00000010", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color || S.aubergine, borderRadius: 6 }} />
      </div>
    </div>
  );
}

function Insights({ items, inspo, liked, looks, setView }) {
  const [ai, setAi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!items.length) return (
    <Empty title="Nothing to analyse yet"
      body="Add and tag a few pieces and I'll map out your colour palette, the balance of your wardrobe, and what defines your style."
      action={<button className="btn btn-primary" onClick={() => setView("add")}>Add pieces</button>} />
  );

  const count = (arr, pred) => arr.filter(pred).length;
  const tally = (key) => { const m = {}; items.forEach(i => { const v = i[key]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };

  const palette = tally("color");
  const maxColor = palette[0]?.[1] || 1;
  const catList = tally("category");
  const maxCat = catList[0]?.[1] || 1;
  const tone = { Muted: count(items, i => i.tone === "Muted"), Classic: count(items, i => i.tone === "Classic"), Bold: count(items, i => i.tone === "Bold") };
  const neutralN = count(items, i => NEUTRALS.includes(i.color));
  const neutralPct = Math.round((neutralN / items.length) * 100);
  const boldPct = Math.round((tone.Bold / items.length) * 100);
  const occ = FORMALITY.map(f => [f, count(items, i => i.formality?.includes(f))]);
  const maxOcc = Math.max(1, ...occ.map(o => o[1]));

  const topCats = catList.slice(0, 3).map(c => c[0].toLowerCase());
  const topColors = palette.slice(0, 3).map(c => c[0].toLowerCase());
  const summary =
    `Your wardrobe is ${neutralPct >= 60 ? "grounded in neutrals" : neutralPct >= 35 ? "a balance of neutrals and colour" : "colour-forward"}, ` +
    `and reads ${boldPct >= 25 ? "bold and expressive" : tone.Muted >= tone.Classic ? "soft and muted" : "classic and understated"}. ` +
    `It's strongest in ${topCats.join(", ") || "a few categories"}` +
    (topColors.length ? `, with ${topColors.join(", ")} the colours you reach for most.` : ".");

  async function deeperRead() {
    setBusy(true); setErr(null);
    try {
      const closet = items.map(i => `- ${i.name} (${i.category}, ${i.color}, ${i.tone} tone)`).join("\n");
      const sys = "You are a perceptive personal stylist. In 2 short paragraphs, describe this person's style identity, their colour story, and one or two ways to build on it. Warm, specific, plain text — no markdown headers.";
      const msg = `Here is my closet:\n${closet}\n\nA quick read: neutrals ${neutralPct}%, bold pieces ${boldPct}%. Strongest categories: ${topCats.join(", ")}. Top colours: ${topColors.join(", ")}.`;
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: sys, messages: [{ role: "user", content: msg }], max_tokens: 600 }),
      });
      if (!res.ok) throw new Error(res.status === 503 ? "needs-key" : "failed");
      const data = await res.json();
      setAi(data.text || "");
    } catch (e) {
      setErr(e.message === "needs-key" ? "The AI read needs your hosted app (Render). The breakdowns above work everywhere." : "Couldn't reach the stylist just now — please try again.");
    }
    setBusy(false);
  }

  const sectionTitle = (kicker, title) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 2 }}>{kicker}</div>
      <div style={{ fontSize: 19 }}>{title}</div>
    </div>
  );

  return (
    <div>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", maxWidth: 620, margin: "0 0 22px" }}>
        A read on your style, drawn from the {items.length} pieces you've tagged — your colour palette, the balance of your wardrobe, and what you reach for.
      </p>

      {/* Style summary */}
      <div className="card" style={{ padding: 20, marginBottom: 22, borderLeft: `4px solid ${S.gold}` }}>
        {sectionTitle("Your style", "In a nutshell")}
        <p style={{ fontSize: 17, lineHeight: 1.55, margin: 0 }}>{summary}</p>
      </div>

      {/* Colour palette */}
      <div className="card" style={{ padding: 20, marginBottom: 22 }}>
        {sectionTitle("Your colours", "Colour palette")}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {palette.map(([c, n]) => {
            const size = 44 + Math.round((n / maxColor) * 40);
            return (
              <div key={c} style={{ textAlign: "center", width: size }}>
                <div style={{ width: size, height: size, borderRadius: "50%", background: colorHex(c), border: `1px solid ${S.aubergine}22`, boxShadow: "inset 0 0 0 2px #ffffff55" }} title={`${c} · ${n}`} />
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, color: "#7a5a66", marginTop: 5, lineHeight: 1.2 }}>{c}<br />{n}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginTop: 20, border: `1px solid ${S.aubergine}18` }}>
          {palette.map(([c, n]) => <div key={c} style={{ width: `${(n / items.length) * 100}%`, background: colorHex(c) }} title={`${c} ${Math.round(n / items.length * 100)}%`} />)}
        </div>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: "#8a6a76", marginTop: 10 }}>
          {neutralPct}% neutrals · {100 - neutralPct}% colour
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 22, marginBottom: 22 }}>
        {/* Categories */}
        <div className="card" style={{ padding: 20 }}>
          {sectionTitle("What you own", "By category")}
          {catList.map(([c, n]) => <Meter key={c} label={c} value={n} max={maxCat} count={n} />)}
        </div>

        {/* Balance */}
        <div className="card" style={{ padding: 20 }}>
          {sectionTitle("The feel", "Tone & balance")}
          <Meter label="Muted" value={tone.Muted} max={items.length} count={tone.Muted} color="#b9a08f" />
          <Meter label="Classic" value={tone.Classic} max={items.length} count={tone.Classic} color={S.aubergine} />
          <Meter label="Bold" value={tone.Bold} max={items.length} count={tone.Bold} color={S.clay} />
          <div style={{ height: 12 }} />
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a6a76", marginBottom: 8 }}>Dressed for</div>
          {occ.map(([f, n]) => <Meter key={f} label={f} value={n} max={maxOcc} count={n} color={S.gold} />)}
        </div>
      </div>

      {/* AI deeper read */}
      <div className="card" style={{ padding: 20 }}>
        {sectionTitle("Optional", "A stylist's read")}
        {ai
          ? <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{ai}</p>
          : <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", margin: "0 0 14px", maxWidth: 560 }}>Want a warmer, written take on your style and how to build on it? I can put one together from your closet.</p>}
        {!ai && <button className="btn btn-primary" onClick={deeperRead} disabled={busy}>{busy ? "Reading your closet…" : "Get a stylist's read"}</button>}
        {err && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a4a3a", marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

// ---------- Travel / holiday planner ----------
const VIBES = ["Relaxed", "Smart casual", "Dressy", "Mixed"];

function Travel({ items, trips, saveTrip, deleteTrip, weather, setView, onSaveLook, looks }) {
  const [activeId, setActiveId] = useState(trips[0]?.id || null);
  const [editing, setEditing] = useState(!trips.length);
  const [dayIdx, setDayIdx] = useState(0);
  const [showPack, setShowPack] = useState(false);
  const [picking, setPicking] = useState(false); // saved-looks picker open for the active day
  const blank = { destination: "", start: "", end: "", temp: 24, vibe: "Relaxed", notes: "" };
  const [form, setForm] = useState(blank);

  const active = trips.find(t => t.id === activeId) || trips[0] || null;

  function startNew() { setForm(blank); setActiveId(null); setEditing(true); }
  function startEdit() {
    if (!active) return;
    setForm({ destination: active.destination, start: active.start, end: active.end, temp: active.temp ?? 24, vibe: active.vibe || "Relaxed", notes: active.notes || "" });
    setEditing(true);
  }
  function build() {
    // Editing the active trip keeps its id (and any outfits already planned).
    const isEdit = active && activeId === active.id;
    const tripId = isEdit ? active.id : crypto.randomUUID();
    const trip = {
      id: tripId,
      destination: form.destination.trim() || "My trip",
      start: form.start, end: form.end, temp: Number(form.temp) || 24, vibe: form.vibe, notes: form.notes.trim(),
      createdAt: (isEdit && active.createdAt) || new Date().toISOString(),
      plan: isEdit ? tripPlan(active) : {}, // keep outfits already added when editing details
    };
    saveTrip(trip);
    setActiveId(trip.id);
    setEditing(false);
    setDayIdx(0);
  }

  const canBuild = form.destination.trim() && form.start && form.end && tripDays(form.start, form.end).length > 0;

  // ----- Setup form -----
  if (editing || !active) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontWeight: 400, fontSize: 26, margin: 0 }}>Holiday</h2>
            <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", margin: "4px 0 0" }}>Plan your own outfits for each day of the trip from your saved looks.</p>
          </div>
          {trips.length > 0 && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Back to trip</button>}
        </div>

        <div className="card" style={{ padding: 20, marginTop: 20, maxWidth: 560 }}>
          <FieldLabel>Where are you going?</FieldLabel>
          <input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Positano, Italy" style={{ width: "100%", marginBottom: 12 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>From</FieldLabel><input type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} style={{ width: "100%" }} /></div>
            <div><FieldLabel>To</FieldLabel><input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} style={{ width: "100%" }} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div><FieldLabel>Typical temp (°C)</FieldLabel><input type="number" value={form.temp} onChange={e => setForm(f => ({ ...f, temp: e.target.value }))} style={{ width: "100%" }} /></div>
            <div><FieldLabel>Vibe</FieldLabel><select value={form.vibe} onChange={e => setForm(f => ({ ...f, vibe: e.target.value }))} style={{ width: "100%" }}>{VIBES.map(v => <option key={v}>{v}</option>)}</select></div>
          </div>
          <FieldLabel>Notes (optional)</FieldLabel>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Coastal town, fine dining, beach clubs…" style={{ width: "100%", resize: "vertical", marginBottom: 14 }} />
          <button className="btn btn-primary" onClick={build} disabled={!canBuild}>{active && activeId === active.id ? "Save details" : "Start planning"}</button>
          {form.start && form.end && !tripDays(form.start, form.end).length && (
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a4a3a", marginTop: 10 }}>Check the dates — the end date should be on or after the start.</div>
          )}
        </div>
      </div>
    );
  }

  // ----- Trip planner -----
  const dates = tripDays(active.start, active.end).map(d => d.toISOString().slice(0, 10));
  const plan = tripPlan(active);
  const dateISO = dates[Math.min(dayIdx, dates.length - 1)] || dates[0];
  const dayEntries = plan[dateISO] || [];
  const pack = travelPacking(active);
  const totalOutfits = dates.reduce((n, d) => n + (plan[d]?.length || 0), 0);
  const daysCovered = dates.filter(d => (plan[d]?.length || 0) > 0).length;

  const commitPlan = (nextPlan) => saveTrip({ ...active, plan: nextPlan });
  const addLook = (look) => {
    const entry = { id: crypto.randomUUID(), lookId: look.id, tag: TRAVEL_TAGS[0], occasion: look.occasion || "", note: look.note || "", pieces: (look.pieces || []).map(snapshotPiece) };
    commitPlan({ ...plan, [dateISO]: [...dayEntries, entry] });
  };
  const removeEntry = (entryId) => commitPlan({ ...plan, [dateISO]: dayEntries.filter(e => e.id !== entryId) });
  const retag = (entryId, tag) => commitPlan({ ...plan, [dateISO]: dayEntries.map(e => e.id === entryId ? { ...e, tag } : e) });

  const TAG_COLOR = { "Day look": S.gold, "Night look": S.aubergine, "Other": S.clay };
  const miniBoard = (pieces, key) => {
    const cols = Math.min(4, Math.max(1, pieces.length));
    return (
      <div key={key} style={{ display: "grid", gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`, gap: 6 }}>
        {pieces.map(p => (
          <div key={p.id} style={{ minWidth: 0 }}>
            <div style={{ aspectRatio: "1", background: "#fff", borderRadius: 6, overflow: "hidden", border: `1px solid ${S.aubergine}12` }}>
              <Thumb src={p.img} alt={p.name} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h2 style={{ fontWeight: 400, fontSize: 26, margin: 0 }}>Holiday</h2>
          <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", margin: "4px 0 0" }}>Add your saved looks to each day and tag them day, night or other.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={startNew}>+ New trip</button>
        </div>
      </div>

      {/* Trip switcher */}
      {trips.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {trips.map(t => (
            <button key={t.id} className="chip" style={{ cursor: "pointer", background: t.id === active.id ? S.aubergine : "#fff", color: t.id === active.id ? S.blush : S.ink }}
              onClick={() => { setActiveId(t.id); setDayIdx(0); }}>{t.destination}</button>
          ))}
        </div>
      )}

      {/* Summary card */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div style={{ fontSize: 24 }}>{active.destination}</div>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#8a6a76", margin: "6px 0 16px" }}>
              {fmtDate(active.start, { day: "numeric", month: "short" })} – {fmtDate(active.end, { day: "numeric", month: "short", year: "numeric" })}
            </div>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 22 }}>{dates.length}</div><div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6a76" }}>Days</div></div>
              <div><div style={{ fontSize: 22 }}>{active.temp}°C</div><div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6a76" }}>Typical</div></div>
              <div><div style={{ fontSize: 22 }}>{active.vibe}</div><div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6a76" }}>Vibe</div></div>
            </div>
            {active.notes && <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", margin: "16px 0 0", maxWidth: 460 }}>{active.notes}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={startEdit}>Edit trip details</button>
              <button className="btn btn-ghost" style={{ padding: "8px 13px" }} onClick={() => { if (confirm("Delete this trip?")) { deleteTrip(active.id); const rest = trips.filter(t => t.id !== active.id); setActiveId(rest[0]?.id || null); setEditing(!rest.length); } }}>Delete</button>
            </div>
          </div>
          <div style={{ flex: "0 1 250px", background: S.blushSoft, borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: S.clay, marginBottom: 10 }}>Planning progress</div>
            {[
              `${totalOutfits} outfit${totalOutfits === 1 ? "" : "s"} planned`,
              `${daysCovered} of ${dates.length} day${dates.length === 1 ? "" : "s"} covered`,
              `${pack.total} piece${pack.total === 1 ? "" : "s"} to pack`,
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: S.ink, marginBottom: 7 }}>
                <span style={{ color: S.gold }}>✓</span><span>{b}</span>
              </div>
            ))}
            {daysCovered < dates.length && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 4 }}>Tip: aim for 2–3 outfits a day.</div>}
          </div>
        </div>
      </div>

      {/* Day selector */}
      <h3 style={{ fontWeight: 400, fontSize: 20, margin: "0 0 14px" }}>Plan by day</h3>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 18 }}>
        {dates.map((d, i) => {
          const n = plan[d]?.length || 0;
          const on = i === dayIdx;
          return (
            <button key={d} onClick={() => setDayIdx(i)} className="card"
              style={{ flex: "0 0 auto", cursor: "pointer", padding: "10px 16px", textAlign: "center", border: `1px solid ${on ? S.aubergine : S.aubergine + "22"}`, background: on ? S.aubergine : "#fff", color: on ? S.blush : S.ink }}>
              <div style={{ fontSize: 14 }}>Day {i + 1}</div>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, opacity: .8 }}>{fmtDate(d, { weekday: "short", day: "numeric", month: "short" })}</div>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, marginTop: 3, color: on ? S.gold : (n ? S.clay : "#b9a3ad") }}>{n ? `${n} outfit${n > 1 ? "s" : ""}` : "empty"}</div>
            </button>
          );
        })}
      </div>

      {/* Active day */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18 }}>Day {Math.min(dayIdx, dates.length - 1) + 1} · {fmtDate(dateISO, { weekday: "long", day: "numeric", month: "long" })}</div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76" }}>{dayEntries.length} outfit{dayEntries.length === 1 ? "" : "s"} · 2–3 suggested</div>
        </div>
        <button className="btn btn-primary" style={{ padding: "9px 15px" }} onClick={() => setPicking(true)}>+ Add outfit</button>
      </div>

      {!looks.length ? (
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13.5, color: "#7a5a66", background: S.blushSoft, borderRadius: 10, padding: "16px 18px", marginBottom: 28 }}>
          You have no saved looks yet. Save some outfits from <button onClick={() => setView("today")} style={{ background: "none", border: "none", color: S.clay, cursor: "pointer", textDecoration: "underline", font: "inherit", padding: 0 }}>Today's Look</button> or the stylist, then add them to your trip days here.
        </div>
      ) : dayEntries.length === 0 ? (
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13.5, color: "#7a5a66", background: S.blushSoft, borderRadius: 10, padding: "16px 18px", marginBottom: 28 }}>
          No outfits for this day yet — tap <strong>+ Add outfit</strong> to pick from your saved looks.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14, marginBottom: 28 }}>
          {dayEntries.map(e => (
            <div key={e.id} className="card" style={{ padding: 14, display: "flex", flexDirection: "column", position: "relative" }}>
              <button onClick={() => removeEntry(e.id)} title="Remove from this day" style={{ position: "absolute", top: 8, right: 8, border: "none", background: "#00000066", color: "#fff", width: 24, height: 24, borderRadius: "50%", cursor: "pointer", lineHeight: 1 }}>×</button>
              {e.pieces?.length ? miniBoard(e.pieces, e.id) : <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: "#8a6a76", padding: "18px 4px" }}>This saved look has no pieces.</div>}
              {e.occasion && <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginTop: 8 }}>{e.occasion}{e.note ? ` · ${e.note}` : ""}</div>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {TRAVEL_TAGS.map(t => {
                  const on = e.tag === t;
                  return (
                    <button key={t} className="chip" aria-pressed={on} onClick={() => retag(e.id, t)}
                      style={{ cursor: "pointer", background: on ? TAG_COLOR[t] : "#fff", color: on ? (t === "Day look" ? S.ink : S.blush) : S.ink, borderColor: on ? TAG_COLOR[t] : undefined }}>
                      {on ? "✓ " : ""}{t}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved-looks picker */}
      {picking && (
        <div onClick={() => setPicking(false)} style={{ position: "fixed", inset: 0, background: "#1a0e15cc", zIndex: 56, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: S.paper, borderRadius: 14, width: "min(760px, 100%)", margin: "auto", boxShadow: "0 20px 60px #0007", overflow: "hidden" }}>
            <div style={{ position: "sticky", top: 0, background: S.aubergine, color: S.blush, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 18 }}>Add a saved look to Day {Math.min(dayIdx, dates.length - 1) + 1}</div>
              <button onClick={() => setPicking(false)} title="Done" style={{ border: "none", background: "#ffffff22", color: S.blush, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              {!looks.length ? (
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13.5, color: "#7a5a66" }}>You have no saved looks yet. Save some outfits first, then come back to add them.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
                  {looks.map(l => (
                    <div key={l.id} className="card" style={{ padding: 12 }}>
                      {miniBoard(l.pieces || [], "pick-" + l.id)}
                      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, color: "#8a6a76", margin: "8px 0 6px" }}>{l.occasion || "Look"}{l.season ? ` · ${l.season}` : ""}</div>
                      <button className="btn btn-primary" style={{ padding: "6px 12px", width: "100%" }} onClick={() => addLook(l)}>+ Add</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 14 }}>Add as many as you like — you can reuse a look across days, then tag each one on the day.</div>
            </div>
          </div>
        </div>
      )}

      {/* Packing overview */}
      {pack.total > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <h3 style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>Packing overview</h3>
            <div className="chip">{pack.total} items</div>
          </div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: "#8a6a76", marginBottom: 12 }}>Every unique piece across the outfits you've planned.</div>
          {["Clothing", "Shoes", "Accessories"].map(g => (
            <Meter key={g} label={g} value={pack.groups[g]} max={pack.total || 1} count={`${pack.groups[g]} · ${pack.total ? Math.round(pack.groups[g] / pack.total * 100) : 0}%`} color={g === "Shoes" ? S.clay : g === "Accessories" ? S.gold : S.aubergine} />
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 8, padding: "7px 13px" }} onClick={() => setShowPack(v => !v)}>{showPack ? "Hide packing list" : "View full packing list"}</button>
          {showPack && (
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(72px,1fr))", gap: 10 }}>
              {pack.pieces.map(p => (
                <div key={p.id} title={p.name}>
                  <div style={{ aspectRatio: "1", background: S.blushSoft, borderRadius: 4, overflow: "hidden" }}><Thumb src={p.img} alt={p.name} /></div>
                  <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- "Not suggested again" (disliked combinations) ----------
function DislikedList({ disliked, removeDislike, items }) {
  const byId = new Map(items.map(i => [i.id, i]));
  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={{ fontWeight: 400, fontSize: 22, borderBottom: `1px solid ${S.aubergine}22`, paddingBottom: 8, marginTop: 0 }}>
        Not suggested again ({disliked.length})
      </h2>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66", margin: "10px 0 0", maxWidth: 560 }}>
        Combinations you've told the stylist to avoid. Tap “Allow again” to let it suggest one of these.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 18 }}>
        {disliked.map(d => {
          const pcs = d.key.split(",").map(id => byId.get(id)).filter(Boolean);
          return (
            <div key={d.key} className="card" style={{ padding: 14 }}>
              {pcs.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(64px,1fr))", gap: 8, marginBottom: 12 }}>
                  {pcs.map(p => (
                    <div key={p.id} title={p.name}>
                      <div style={{ aspectRatio: "1", background: S.blushSoft, borderRadius: 3, overflow: "hidden" }}>
                        <Thumb src={p.img} alt={p.name} />
                      </div>
                      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: S.ink, marginBottom: 12 }}>{(d.names || []).join(" + ")}</div>
              )}
              <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={() => removeDislike(d.key)}>Allow again</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Saved looks view (kept looks + blocked combinations) ----------
function Looks({ looks, deleteLook, setView, disliked, removeDislike, items, setLookSeason }) {
  const hasDisliked = disliked && disliked.length > 0;
  const [filter, setFilter] = useState("All");    // by occasion
  const [season, setSeason] = useState("All");    // by season tag
  if (!looks.length) return (
    <div>
      <Empty title="No saved looks yet"
        body="When a look comes together, tap “Save look” on the stylist's suggestion (or “Save this look” on Today's Look) to keep it here."
        action={<button className="btn btn-primary" onClick={()=>setView("today")}>Style a look</button>} />
      {hasDisliked && <DislikedList disliked={disliked} removeDislike={removeDislike} items={items} />}
    </div>
  );

  // Tag every look with its occasion, its season, and its temperature range.
  const byId = new Map(items.map(i => [i.id, i]));
  const tagged = looks.map(l => ({ ...l, seasonTag: lookSeason(l, byId), climate: lookClimate(l, byId) }));

  const occasions = FORMALITY.filter(f => looks.some(l => l.occasion === f));
  const occCats = ["All", ...occasions];
  const seasonCats = ["All", ...SEASONS.filter(s => tagged.some(l => l.seasonTag === s))];

  const matches = (l) => (filter === "All" || l.occasion === filter) && (season === "All" || l.seasonTag === season);
  const occCount = (c) => tagged.filter(l => (c === "All" || l.occasion === c) && (season === "All" || l.seasonTag === season)).length;
  const seasonCount = (s) => tagged.filter(l => (s === "All" || l.seasonTag === s) && (filter === "All" || l.occasion === filter)).length;
  const shown = tagged.filter(matches);

  const chip = (label, active, onClick) => (
    <button key={label} className="chip" style={{ cursor: "pointer", background: active ? S.aubergine : "#fff", color: active ? S.blush : S.ink }} onClick={onClick}>{label}</button>
  );

  return (
    <div>
      <h2 style={{ fontWeight: 400, fontSize: 22, borderBottom: `1px solid ${S.aubergine}22`, paddingBottom: 8, marginTop: 0 }}>
        Saved looks ({looks.length})
      </h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0 6px" }}>
        <span style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a6a76", marginRight: 2 }}>Occasion</span>
        {occCats.map(c => chip(`${c} (${occCount(c)})`, filter === c, () => setFilter(c)))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "4px 0" }}>
        <span style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#8a6a76", marginRight: 2 }}>Season</span>
        {seasonCats.map(s => chip(s === "All" ? `All (${seasonCount("All")})` : `${SEASON_EMOJI[s]} ${s} (${seasonCount(s)})`, season === s, () => setSeason(s)))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 18 }}>
        {shown.map(l => (
          <div key={l.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 17 }}>{l.occasion}</div>
              <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11, color: "#8a6a76" }}>
                {l.weather ? `${l.weather.temp}°C · ${weatherLabel(l.weather.code)}` : l.climate.range}
              </div>
            </div>
            {/* Season tag — tap a season to set it */}
            <div style={{ marginBottom: l.note ? 8 : 12 }}>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a6a76", marginBottom: 5 }}>Season</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {SEASONS.map(s => {
                  const on = l.seasonTag === s;
                  return (
                    <button key={s} className="chip" title={`Tag as ${s}`} onClick={() => setLookSeason(l.id, s)}
                      style={{ cursor: "pointer", padding: "3px 9px", background: on ? S.aubergine : "#fff", color: on ? S.blush : S.ink, borderColor: on ? S.aubergine : `${S.aubergine}33` }}>
                      {SEASON_EMOJI[s]} {s}
                    </button>
                  );
                })}
              </div>
            </div>
            {l.note && <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11.5, color: S.clay, marginBottom: 12 }}>✈ {l.note}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(72px,1fr))", gap: 8 }}>
              {l.pieces.map(p => (
                <div key={p.id} title={`${p.name} · ${p.category}`}>
                  <div style={{ aspectRatio: "1", background: S.blushSoft, borderRadius: 3, overflow: "hidden" }}>
                    <Thumb src={p.img} alt={p.name} />
                  </div>
                  <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 12, padding: "6px 12px" }} onClick={()=>deleteLook(l.id)}>Remove look</button>
          </div>
        ))}
      </div>
      {hasDisliked && <DislikedList disliked={disliked} removeDislike={removeDislike} items={items} />}
    </div>
  );
}

// ---------- My Style photos: one uploadable section ----------
function PhotoSection({ title, blurb, cta, photos, onAdd, onRemove }) {
  const ref = useRef();
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontWeight: 400, fontSize: 20, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66", margin: "0 0 12px", maxWidth: 560 }}>{blurb}</p>
      <input ref={ref} type="file" accept="image/*" multiple onChange={onAdd} style={{ display: "none" }} />
      <button className="btn btn-primary" onClick={() => ref.current?.click()}>{cta}</button>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12, marginTop: 14 }}>
          {photos.map(p => (
            <div key={p.id} className="card" style={{ position: "relative" }}>
              <div style={{ aspectRatio: "3/4", background: S.blushSoft }}>
                <Thumb src={p.img} alt="Outfit" />
              </div>
              <button onClick={() => onRemove(p.id)} title="Remove"
                style={{ position:"absolute", top:6, right:6, border:"none", background:"#00000088", color:"#fff", width:24, height:24, borderRadius:"50%", cursor:"pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- My Style view (worn outfits + liked/inspiration outfits) ----------
function MyStyle({ inspo, addInspo, deleteInspo, liked, addLiked, deleteLiked, setView, styleTaste, onScanTaste, scanning }) {
  const learned = styleTaste?.colors ? [...styleTaste.colors] : [];
  const unscanned = liked.filter(p => !(p.colors && p.colors.length)).length;
  return (
    <div>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", maxWidth: 560, margin: "0 0 22px" }}>
        Add photos to teach the stylist your taste. Everything stays on your device.
      </p>
      <PhotoSection
        title="Outfits you've worn"
        blurb="Pictures of yourself in outfits you've worn and loved — so the stylist knows what suits you and what you actually reach for."
        cta="Add worn outfits"
        photos={inspo} onAdd={addInspo} onRemove={deleteInspo} />
      <PhotoSection
        title="Outfits you like"
        blurb="Looks you're drawn to and want to lean toward — screenshots, pins, anyone's outfits. Both the AI stylist and the free “Style me” recommendations lean toward the colours and vibe of these outfits."
        cta="Add liked outfits"
        photos={liked} onAdd={addLiked} onRemove={deleteLiked} />

      {liked.length > 0 && (
        <div className="card" style={{ padding: 16, margin: "0 0 26px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 6 }}>Taste your looks lean toward</div>
              {learned.length ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {learned.map(c => (
                      <span key={c} title={c} style={{ width: 22, height: 22, borderRadius: "50%", background: colorHex(c), border: `1px solid ${S.aubergine}22`, display: "inline-block" }} />
                    ))}
                  </div>
                  <span style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66" }}>
                    {learned.join(", ")}{styleTaste?.tone ? ` · ${styleTaste.tone.toLowerCase()} vibe` : ""}
                  </span>
                </div>
              ) : (
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76" }}>
                  Not read yet — tap <em>Learn my taste</em> to pull the colours &amp; vibe from these outfits so your looks lean toward them.
                </div>
              )}
            </div>
            {unscanned > 0 && (
              <button className="btn btn-ghost" onClick={onScanTaste} disabled={!!scanning} style={{ whiteSpace: "nowrap" }}>
                {scanning ? `Reading ${scanning.done}/${scanning.total}…` : `Learn my taste (${unscanned})`}
              </button>
            )}
          </div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11.5, color: "#8a6a76", marginTop: 10 }}>
            New liked outfits are read automatically. Reading a photo uses your hosted app (Render); once learned it works offline and free.
          </div>
        </div>
      )}

      {inspo.length === 0 && liked.length === 0 && (
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#8a6a76", marginTop: 4 }}>
          Add a few photos above, then head to <button onClick={() => setView("today")} style={{ background: "none", border: "none", color: S.clay, cursor: "pointer", textDecoration: "underline", font: "inherit", padding: 0 }}>Today's Look</button> to ask the stylist.
        </div>
      )}
    </div>
  );
}

// ---------- Backup card (export / import wardrobe) ----------
function Backup({ exportData, importData }) {
  const ref = useRef();
  return (
    <div className="card" style={{ marginTop: 30, padding: 16 }}>
      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: S.clay, marginBottom: 4 }}>Backup</div>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 12.5, color: "#7a5a66", margin: "0 0 12px", maxWidth: 560 }}>
        Your wardrobe saves automatically on this device — you don't need to do anything day to day. Use a backup only to keep a safety copy or move your wardrobe to another device or link.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={exportData}>Download backup</button>
        <input ref={ref} type="file" accept="application/json,.json" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f && confirm("Restore this backup? It replaces your current wardrobe on this device.")) importData(f); e.target.value = ""; }} />
        <button className="btn btn-ghost" onClick={() => ref.current?.click()}>Restore backup</button>
      </div>
    </div>
  );
}

// ---------- Closet view ----------
function Closet({ items, deleteItem, updateItem, setView, exportData, importData }) {
  // Both filters are multi-select: an empty set means "All"; otherwise show any match.
  const [catSel, setCatSel] = useState(() => new Set());
  const [warmthSel, setWarmthSel] = useState(() => new Set());
  const cats = CATEGORIES.filter(c => items.some(i => i.category === c));
  const warmths = WARMTH.filter(w => items.some(i => i.warmth === w));
  const toggle = (setter) => (v) => setter(prev => {
    const next = new Set(prev);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  });
  const toggleCat = toggle(setCatSel);
  const toggleWarmth = toggle(setWarmthSel);
  const shown = items.filter(i =>
    (catSel.size === 0 || catSel.has(i.category)) &&
    (warmthSel.size === 0 || warmthSel.has(i.warmth)));
  const [editId, setEditId] = useState(null);

  // One multi-select filter group (an "All" chip + a toggle chip per value).
  const filterGroup = (label, values, sel, setSel, onToggle) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: S.clay, marginBottom: 8 }}>
        {label}{sel.size > 0 ? ` · ${sel.size}` : ""} <span style={{ textTransform: "none", letterSpacing: 0, color: "#a58a94" }}>(pick any)</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="chip" style={{ cursor:"pointer", background: sel.size===0?S.aubergine:"#fff", color: sel.size===0?S.blush:S.ink }} onClick={()=>setSel(new Set())}>All</button>
        {values.map(v => {
          const on = sel.has(v);
          return <button key={v} className="chip" aria-pressed={on} style={{ cursor:"pointer", background: on?S.aubergine:"#fff", color: on?S.blush:S.ink }} onClick={()=>onToggle(v)}>{on ? "✓ " : ""}{v}</button>;
        })}
      </div>
    </div>
  );

  if (!items.length) return (
    <div>
      <Empty title="Nothing here yet" body="Upload photos of your clothes and accessories to build your digital closet."
        action={<button className="btn btn-primary" onClick={()=>setView("add")}>Add pieces</button>} />
      <Backup exportData={exportData} importData={importData} />
    </div>
  );

  const anyFilter = catSel.size > 0 || warmthSel.size > 0;
  return (
    <>
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* Filters — pinned to the left; wraps above the grid on narrow screens. */}
      <aside style={{ flex: "1 1 170px", maxWidth: 220, minWidth: 150, position: "sticky", top: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: S.aubergine }}>Filter</div>
          {anyFilter && <button onClick={() => { setCatSel(new Set()); setWarmthSel(new Set()); }} style={{ background:"none", border:"none", color:S.clay, cursor:"pointer", textDecoration:"underline", fontFamily:"system-ui,sans-serif", fontSize:12, padding:0 }}>Clear</button>}
        </div>
        {filterGroup("Category", cats, catSel, setCatSel, toggleCat)}
        {warmths.length > 0 && filterGroup("Warmth", warmths, warmthSel, setWarmthSel, toggleWarmth)}
      </aside>

      {/* Grid */}
      <div style={{ flex: "999 1 320px", minWidth: 0 }}>
        <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 12, color: "#8a6a76", marginBottom: 14 }}>
          Showing {shown.length} of {items.length} piece{items.length === 1 ? "" : "s"}.
        </div>
        {shown.length === 0 && (
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#8a6a76", background: S.blushSoft, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            No pieces match the selected filters. <button onClick={() => { setCatSel(new Set()); setWarmthSel(new Set()); }} style={{ background:"none", border:"none", color:S.clay, cursor:"pointer", textDecoration:"underline", font:"inherit", padding:0 }}>Clear filters</button>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 16 }}>
          {shown.map(i => (
          <div key={i.id} className="card">
            <div style={{ aspectRatio: "1", background: S.blushSoft, position: "relative" }}>
              <Thumb src={i.img} alt={i.name} />
              <button onClick={()=>deleteItem(i.id)} title="Remove" style={{ position:"absolute", top:6, right:6, border:"none", background:"#00000088", color:"#fff", width:24, height:24, borderRadius:"50%", cursor:"pointer" }}>×</button>
            </div>
            <div style={{ padding: "10px 12px" }}>
              {/* Tapping the details (or the button) opens the full edit panel. */}
              <div onClick={()=>setEditId(i.id)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 15 }}>{i.name}</div>
                <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginBottom: 6 }}>{i.category} · {i.color}{i.tone?` · ${i.tone}`:""} · {i.warmth}</div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom: 8 }}>
                  {i.formality?.map(f => <span key={f} className="chip">{f}</span>)}
                </div>
                <button className="btn btn-ghost" style={{ padding:"6px 12px" }} onClick={(e)=>{ e.stopPropagation(); setEditId(i.id); }}>Edit tags</button>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
    <Backup exportData={exportData} importData={importData} />
    {editId != null && items.some(i => i.id === editId) && (
      <EditPanel
        item={items.find(i => i.id === editId)}
        updateItem={updateItem}
        deleteItem={(id)=>{ deleteItem(id); setEditId(null); }}
        onClose={()=>setEditId(null)}
      />
    )}
    </>
  );
}

// ---------- Edit panel (side drawer) ----------
// Slides in from the right showing the item's large photo and every editable
// attribute. Sits above the lightbox (which is z-index 50) so its own photo uses
// a plain <img>, not a Thumb, to avoid a nested-lightbox conflict.
function EditPanel({ item, updateItem, deleteItem, onClose }) {
  const [confirmDel, setConfirmDel] = useState(false);
  if (!item) return null;
  const toggleFormality = (f) => {
    const has = item.formality?.includes(f);
    updateItem(item.id, "formality", has ? item.formality.filter(x=>x!==f) : [...(item.formality||[]), f]);
  };
  return (
    <div
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"#1a0e15aa", zIndex:55, display:"flex", justifyContent:"flex-end" }}
    >
      <div
        onClick={(e)=>e.stopPropagation()}
        style={{ width:"min(440px,100%)", height:"100%", background:S.paper, overflowY:"auto", boxShadow:"-8px 0 30px #00000033", display:"flex", flexDirection:"column" }}
      >
        <div style={{ position:"sticky", top:0, zIndex:1, background:S.aubergine, color:S.blush, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize: 18 }}>Edit piece</div>
          <button onClick={onClose} title="Close" style={{ border:"none", background:"#ffffff22", color:S.blush, width:32, height:32, borderRadius:"50%", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:18 }}>
          <div style={{ background:S.blushSoft, borderRadius:8, overflow:"hidden", marginBottom:18, aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <img src={item.img} alt={item.name} style={{ width:"100%", height:"100%", objectFit:"contain" }} />
          </div>

          <FieldLabel>Name</FieldLabel>
          <input value={item.name||""} onChange={e=>updateItem(item.id,"name",e.target.value)}
            style={{ width:"100%", padding:"9px 11px", fontSize:15, border:`1px solid ${S.aubergine}33`, borderRadius:4, marginBottom:12, boxSizing:"border-box" }} />

          <FieldLabel>Category</FieldLabel>
          <TagButtons options={CATEGORIES} value={item.category} onSelect={v=>updateItem(item.id,"category",v)} />
          <div style={{ height:12 }} />

          <FieldLabel>Colour</FieldLabel>
          <TagButtons options={COLORS} value={item.color} onSelect={v=>updateItem(item.id,"color",v)} />
          <div style={{ height:12 }} />

          <FieldLabel>Tone</FieldLabel>
          <TagButtons options={TONES} value={item.tone||"Classic"} onSelect={v=>updateItem(item.id,"tone",v)} />
          <div style={{ height:12 }} />

          <FieldLabel>Warmth</FieldLabel>
          <TagButtons options={WARMTH} value={item.warmth||"Medium"} onSelect={v=>updateItem(item.id,"warmth",v)} />
          <div style={{ height:12 }} />

          <FieldLabel>Occasion</FieldLabel>
          <TagButtons options={FORMALITY} multi value={item.formality} onSelect={toggleFormality} />
        </div>

        <div style={{ position:"sticky", bottom:0, background:S.paper, borderTop:`1px solid ${S.aubergine}22`, padding:"12px 18px", display:"flex", gap:10, justifyContent:"space-between", marginTop:"auto" }}>
          {confirmDel ? (
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ fontFamily:"system-ui,sans-serif", fontSize:13, color:S.ink }}>Delete this piece?</span>
              <button className="btn btn-ghost" style={{ padding:"6px 12px" }} onClick={()=>setConfirmDel(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ padding:"6px 12px", background:S.clay }} onClick={()=>deleteItem(item.id)}>Delete</button>
            </div>
          ) : (
            <button className="btn btn-ghost" style={{ padding:"8px 14px", color:S.clay }} onClick={()=>setConfirmDel(true)}>Delete piece</button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Tap-button group ----------
function TagButtons({ options, value, onSelect, multi }) {
  const isOn = (o) => multi ? (value || []).includes(o) : value === o;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onSelect(o)}
          style={{
            cursor: "pointer", fontFamily: "system-ui,sans-serif", fontSize: 12.5,
            padding: "8px 13px", borderRadius: 3, transition: ".12s", touchAction: "manipulation",
            border: `1px solid ${isOn(o) ? S.aubergine : S.aubergine + "33"}`,
            background: isOn(o) ? S.aubergine : "#fff",
            color: isOn(o) ? S.blush : S.ink,
          }}>{o}</button>
      ))}
    </div>
  );
}

function FieldLabel({ children, required, done }) {
  return (
    <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: done ? "#6a8a6a" : (required ? "#8a4a3a" : "#8a6a76"), marginBottom: 6, marginTop: 4 }}>
      {children}{required && !done ? " · required" : ""}{done ? " ✓" : ""}
    </div>
  );
}

// ---------- Add view ----------
function Add({ fileRef, handleFiles, queue, autoTagging, updateQueueTag, removeQueue, commitQueue, seedExamples }) {
  const untagged = queue.filter(q => !q.tags?.category).length;
  return (
    <div>
      <div className="card" style={{ padding: 26, textAlign: "center", marginBottom: 22, borderStyle: "dashed" }}>
        <div style={{ fontSize: 20, marginBottom: 6 }}>Add your pieces</div>
        <p style={{ fontFamily:"system-ui,sans-serif", fontSize: 13, color: "#7a5a66", maxWidth: 460, margin: "0 auto 16px" }}>
          Choose several photos at once. If auto-tagging is set up, I'll pre-fill each one — otherwise just tap to tag. Category is all that's required.
        </p>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <button className="btn btn-primary" onClick={()=>fileRef.current?.click()}>Choose photos</button>
          <button className="btn btn-ghost" onClick={seedExamples}>Load example closet</button>
        </div>
        {autoTagging && <div style={{ fontFamily:"system-ui,sans-serif", fontSize:12, color:"#8a6a76", marginTop:12 }}>Reading your photos…</div>}
      </div>

      {queue.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 14, flexWrap:"wrap", gap:8, position:"sticky", top:0, background:S.paper, padding:"6px 0", zIndex:2 }}>
            <h2 style={{ fontWeight: 400, fontSize: 20, margin: 0 }}>
              Tag your pieces ({queue.length})
              {untagged > 0 && <span style={{ fontFamily:"system-ui,sans-serif", fontSize:12, color:"#8a4a3a", marginLeft:8 }}>· {untagged} still need a category</span>}
            </h2>
            <button className="btn btn-primary" onClick={commitQueue} disabled={untagged === queue.length}>
              {untagged > 0 ? `Save ${queue.length - untagged} tagged` : "Save all to closet"}
            </button>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {queue.map(q => {
              const needs = !q.tags?.category;
              return (
              <div key={q.id} className="card" style={{ padding: 16, borderColor: needs ? "#C8A24B" : undefined, boxShadow: needs ? "0 0 0 1px #C8A24B" : undefined }}>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                  <div style={{ width: 96, flexShrink: 0 }}>
                    <div style={{ width: 96, height: 96, borderRadius: 4, overflow:"hidden", background:S.blushSoft }}>
                      <Thumb src={q.img} alt="" />
                    </div>
                    <input value={q.tags.name||""} onChange={e=>updateQueueTag(q.id,"name",e.target.value)} placeholder="Name (optional)" style={{ width: "100%", marginTop: 8 }} />
                    <button className="btn btn-ghost" style={{ marginTop:8, padding:"5px 10px", width:"100%" }} onClick={()=>removeQueue(q.id)}>Remove</button>
                  </div>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <FieldLabel required done={!!q.tags.category}>Category</FieldLabel>
                    <TagButtons options={CATEGORIES} value={q.tags.category} onSelect={v=>updateQueueTag(q.id,"category", v)} />

                    <FieldLabel done={!!q.tags.color}>Colour</FieldLabel>
                    <TagButtons options={COLORS} value={q.tags.color} onSelect={v=>updateQueueTag(q.id,"color", v)} />

                    <FieldLabel>Tone</FieldLabel>
                    <TagButtons options={TONES} value={q.tags.tone||"Classic"} onSelect={v=>updateQueueTag(q.id,"tone", v)} />

                    <FieldLabel>Warmth</FieldLabel>
                    <TagButtons options={WARMTH} value={q.tags.warmth||"Medium"} onSelect={v=>updateQueueTag(q.id,"warmth", v)} />

                    <FieldLabel>Occasion</FieldLabel>
                    <TagButtons options={FORMALITY} multi value={q.tags.formality}
                      onSelect={v=>{ const arr=q.tags.formality||[]; const has=arr.includes(v); updateQueueTag(q.id,"formality", has?arr.filter(x=>x!==v):[...arr,v]); }} />
                  </div>
                </div>
              </div>
            );})}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Empty state ----------
function Empty({ title, body, action }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "#7a5a66" }}>
      <div style={{ fontSize: 24, color: S.ink, marginBottom: 8 }}>{title}</div>
      <p style={{ fontFamily:"system-ui,sans-serif", fontSize: 14, maxWidth: 380, margin: "0 auto 20px" }}>{body}</p>
      {action}
    </div>
  );
}
