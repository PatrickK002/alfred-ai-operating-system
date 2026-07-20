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
// Map temperature (°C) to needed warmth levels
function warmthForTemp(t) {
  if (t >= 26) return ["Very light", "Light"];
  if (t >= 20) return ["Very light", "Light", "Medium"];
  if (t >= 13) return ["Light", "Medium", "Warm"];
  if (t >= 6) return ["Medium", "Warm", "Very warm"];
  return ["Warm", "Very warm"];
}

// ---------- Color coordination ----------
const NEUTRALS = ["Black", "White", "Black & White", "Grey", "Beige", "Navy", "Brown", "Cream", "Tan", "Denim", "Multicolour", "Floral"];
function colorsClash(a, b) {
  if (!a || !b) return false;
  if (NEUTRALS.includes(a) || NEUTRALS.includes(b)) return false;
  // two different saturated colors — mild clash unless same
  return a !== b;
}

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

export default function App() {
  const [items, setItems] = useState([]);
  const [looks, setLooks] = useState([]);
  const [inspo, setInspo] = useState([]); // outfits worn
  const [liked, setLiked] = useState([]); // outfits liked (inspiration)
  const [disliked, setDisliked] = useState([]); // combinations never to suggest again
  const [ready, setReady] = useState(false); // true once data has loaded from storage
  const [view, setView] = useState("today"); // today | looks | mystyle | closet | add
  const [weather, setWeather] = useState(null);
  const [weatherErr, setWeatherErr] = useState(null);
  const [loadingW, setLoadingW] = useState(false);
  const [occasion, setOccasion] = useState("Casual");
  const [outfit, setOutfit] = useState(null);
  const [queue, setQueue] = useState([]); // pending uploads awaiting tags
  const [autoTagging, setAutoTagging] = useState(false);
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
      const [it, lk, ip, li, di] = await Promise.all([
        loadStore("items", KEY), loadStore("looks", LOOKS_KEY), loadStore("inspo", INSPO_KEY), loadStore("liked", LIKED_KEY), loadStore("disliked", DISLIKED_KEY),
      ]);
      if (!alive) return;
      setItems(it); setLooks(lk); setInspo(ip); setLiked(li); setDisliked(di); setReady(true);
      try { navigator.storage?.persist?.(); } catch {} // ask iOS not to evict our data
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (ready) saveStore("items", KEY, items); }, [items, ready]);
  useEffect(() => { if (ready) saveStore("looks", LOOKS_KEY, looks); }, [looks, ready]);
  useEffect(() => { if (ready) saveStore("inspo", INSPO_KEY, inspo); }, [inspo, ready]);
  useEffect(() => { if (ready) saveStore("liked", LIKED_KEY, liked); }, [liked, ready]);
  useEffect(() => { if (ready) saveStore("disliked", DISLIKED_KEY, disliked); }, [disliked, ready]);

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
      const data = { app: "the-wardrobe", version: 1, items, looks, inspo, liked, disliked };
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
      alert("Backup restored.");
    } catch { alert("That file didn't look like a wardrobe backup."); }
  }

  // ----- Saved looks -----
  const currentLookSaved = !!(outfit?.key && looks.some(l => l.key === outfit.key));
  function saveCurrentLook() {
    if (!outfit || !outfit.pieces.length) return;
    if (currentLookSaved) return;
    const look = {
      id: crypto.randomUUID(),
      key: outfit.key,
      occasion,
      weather: weather ? { temp: weather.temp, code: weather.code } : null,
      // snapshot the pieces so the saved look is independent of later edits/deletes
      pieces: outfit.pieces.map(p => ({
        id: p.id, name: p.name, category: p.category, color: p.color, tone: p.tone, img: p.img,
      })),
    };
    setLooks(prev => [look, ...prev]);
  }
  function deleteLook(id) { setLooks(prev => prev.filter(l => l.id !== id)); }

  // Save an arbitrary set of pieces (e.g. the AI stylist's suggestion) as a look.
  // Returns the look's stable key so callers can show a "Saved" state.
  function saveLookPieces(pieces) {
    if (!pieces || !pieces.length) return null;
    const key = "ai|" + occasion + "|" + pieces.map(p => p.id).sort().join(",");
    if (!looks.some(l => l.key === key)) {
      const look = {
        id: crypto.randomUUID(), key, occasion,
        weather: weather ? { temp: weather.temp, code: weather.code } : null,
        pieces: pieces.map(p => ({ id: p.id, name: p.name, category: p.category, color: p.color, tone: p.tone, img: p.img })),
      };
      setLooks(prev => [look, ...prev]);
    }
    return key;
  }

  // ----- My Style photos (worn outfits + liked/inspiration outfits) -----
  // Skips any photo already in the set (identical downscaled image data).
  async function addPhotos(setter, current, e) {
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
    }
    e.target.value = ""; // allow re-selecting the same file
  }
  const addInspo = (e) => addPhotos(setInspo, inspo, e);
  const addLiked = (e) => addPhotos(setLiked, liked, e);
  const deleteInspo = (id) => setInspo(prev => prev.filter(p => p.id !== id));
  const deleteLiked = (id) => setLiked(prev => prev.filter(p => p.id !== id));

  // ----- Weather -----
  async function getWeather() {
    setLoadingW(true); setWeatherErr(null);
    if (!navigator.geolocation) { setWeatherErr("Location isn't available on this device. You can still browse your closet."); setLoadingW(false); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
        const d = await r.json();
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          code: d.current.weather_code,
          wind: Math.round(d.current.wind_speed_10m),
        });
      } catch { setWeatherErr("Couldn't reach the weather service. Check your connection and try again."); }
      setLoadingW(false);
    }, () => { setWeatherErr("Location access was blocked. Allow it in your browser to get weather-based picks."); setLoadingW(false); }, { timeout: 10000 });
  }
  useEffect(() => { getWeather(); }, []);

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

  function commitQueue() {
    const ready = queue.filter(q => q.tags && q.tags.category);
    const committed = ready.map(q => ({
      id: q.id, img: q.img,
      category: q.tags.category, color: q.tags.color || "Unspecified", tone: q.tags.tone || "Classic",
      warmth: q.tags.warmth || "Medium", formality: q.tags.formality?.length ? q.tags.formality : ["Casual"],
      name: q.tags.name || q.tags.category,
    }));
    setItems(prev => [...committed, ...prev]);
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
  function buildOutfit() {
    if (!weather) return;
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
      // One statement piece per look: if a bold item is already chosen, prefer
      // non-bold options for the rest, but fall back to bold if that's all there is.
      if (hasBold()) {
        const quiet = cand.filter(i => i.tone !== "Bold");
        if (quiet.length) cand = quiet;
      }
      return cand[Math.floor(Math.random() * cand.length)];
    };

    // Decide silhouette: dress/jumpsuit OR top+bottom
    const useOnePiece = Math.random() < 0.4 && (pool.some(i => i.category === "Dresses") || pool.some(i => i.category === "Jumpsuits"));
    let baseColor = null;
    if (useOnePiece) {
      const one = pick("Dresses", { warmthOk: true }) || pick("Jumpsuits", { warmthOk: true });
      if (one) { result.pieces.push(one); baseColor = one.color; }
      else { pushTopBottom(); }
    } else { pushTopBottom(); }

    function pushTopBottom() {
      const top = pick("Tops", { warmthOk: true });
      if (top) { result.pieces.push(top); baseColor = top.color; }
      const bottom = pick("Bottoms", { warmthOk: true, avoidColor: baseColor });
      if (bottom) result.pieces.push(bottom);
    }

    // Outerwear if cool or wet
    if (weather.temp < 16 || wet) {
      const outer = pick("Outerwear", { warmthOk: weather.temp < 16, avoidColor: baseColor });
      if (outer) result.pieces.push(outer);
      else if (weather.temp < 12) result.notes.push("It's chilly — add a warm layer if you have one un-tagged.");
    }
    // Shoes
    const shoes = pick("Shoes", { avoidColor: baseColor });
    if (shoes) result.pieces.push(shoes);
    // Accessories: one bag, one belt (if bottom present), a little jewelry
    const bag = pick("Bags"); if (bag) result.pieces.push(bag);
    const belt = pick("Belts"); if (belt && !useOnePiece) result.pieces.push(belt);
    const acc = pick("Accessories"); if (acc) result.pieces.push(acc);
    JEWELRY.forEach(j => { const p = pick(j); if (p && Math.random() < 0.6) result.pieces.push(p); });

    if (wet) result.notes.push("Rain expected — closed shoes and a jacket recommended.");
    if (weather.wind > 30) result.notes.push("Windy out — a fitted layer beats anything loose.");
    const boldPiece = result.pieces.find(p => p.tone === "Bold");
    if (boldPiece) result.notes.push(`Let the ${boldPiece.name.toLowerCase()} be the statement — everything else stays quiet.`);
    if (!result.pieces.length) result.notes.push("No items match this occasion + weather yet. Add more pieces or switch the occasion.");

    // Stable identity for this exact combination, so a look can only be saved once.
    result.key = occasion + "|" + result.pieces.map(p => p.id).sort().join(",");
    setOutfit(result);
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
        @media (prefers-reduced-motion: reduce){ .btn{transition:none;} }
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
            <button className={`navbtn ${view==="add"?"active":""}`} onClick={()=>setView("add")}>Add Pieces</button>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "26px 20px 60px" }}>
        {view === "today" && (
          <Today weather={weather} weatherErr={weatherErr} loadingW={loadingW} getWeather={getWeather}
            occasion={occasion} setOccasion={setOccasion} buildOutfit={buildOutfit} outfit={outfit} items={items} setView={setView}
            saveCurrentLook={saveCurrentLook} currentLookSaved={currentLookSaved} inspo={inspo} liked={liked} onSaveLook={saveLookPieces}
            disliked={disliked} onDislike={dislikeCombo} />
        )}
        {view === "looks" && (
          <Looks looks={looks} deleteLook={deleteLook} setView={setView}
            disliked={disliked} removeDislike={removeDislike} items={items} />
        )}
        {view === "mystyle" && (
          <MyStyle inspo={inspo} addInspo={addInspo} deleteInspo={deleteInspo}
            liked={liked} addLiked={addLiked} deleteLiked={deleteLiked} setView={setView} />
        )}
        {view === "closet" && (
          <Closet items={items} deleteItem={deleteItem} updateItem={updateItem} setView={setView}
            exportData={exportData} importData={importData} />
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
function Today({ weather, weatherErr, loadingW, getWeather, occasion, setOccasion, buildOutfit, outfit, items, setView, saveCurrentLook, currentLookSaved, inspo, liked, onSaveLook, disliked, onDislike }) {
  return (
    <div>
      {/* Weather strip */}
      <div className="card" style={{ padding: 18, marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#B5654A", marginBottom: 4 }}>Right now, where you are</div>
          {loadingW && <div>Checking the sky…</div>}
          {weatherErr && <div style={{ fontFamily:"system-ui,sans-serif", fontSize:13, color:"#8a4a3a" }}>{weatherErr}</div>}
          {weather && !loadingW && (
            <div style={{ fontSize: 26 }}>{weather.temp}°C · <span style={{ fontSize: 18 }}>{weatherLabel(weather.code)}</span>{weather.wind>25?`  ·  windy`:""}</div>
          )}
        </div>
        <button className="btn btn-ghost" onClick={getWeather}>Refresh</button>
      </div>

      {/* Occasion + build */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
        <label style={{ fontFamily:"system-ui,sans-serif", fontSize: 13 }}>Dressing for:&nbsp;
          <select value={occasion} onChange={e=>setOccasion(e.target.value)}>
            {FORMALITY.map(f => <option key={f}>{f}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={buildOutfit} disabled={!weather || !items.length}>Style me</button>
      </div>

      {!items.length && (
        <Empty title="Your closet is empty" body="Add a few pieces and I'll start putting looks together for the weather outside."
          action={<button className="btn btn-primary" onClick={()=>setView("add")}>Add pieces</button>} />
      )}

      {outfit && (
        <div>
          <h2 style={{ fontWeight: 400, fontSize: 22, borderBottom: `1px solid ${S.aubergine}22`, paddingBottom: 8 }}>Today's look — {occasion}</h2>
          {outfit.pieces.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14, marginTop: 16 }}>
              {outfit.pieces.map(p => (
                <div key={p.id} className="card">
                  <div style={{ aspectRatio: "1", background: S.blushSoft }}>
                    <Thumb src={p.img} alt={p.name} />
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11, color: "#8a6a76" }}>{p.category} · {p.color}{p.tone?` · ${p.tone}`:""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {outfit.notes.length > 0 && (
            <div style={{ marginTop: 18, background: S.blushSoft, borderLeft: `3px solid ${S.gold}`, padding: "12px 16px", fontFamily:"system-ui,sans-serif", fontSize: 13 }}>
              {outfit.notes.map((n,i) => <div key={i}>· {n}</div>)}
            </div>
          )}
          {outfit.pieces.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button className="btn btn-primary" onClick={saveCurrentLook} disabled={currentLookSaved}>
                {currentLookSaved ? "Saved ✓" : "Save this look"}
              </button>
              <button className="btn btn-ghost" onClick={buildOutfit}>Try another combination</button>
            </div>
          )}
        </div>
      )}

      {/* AI stylist chat */}
      <Stylist items={items} weather={weather} occasion={occasion} outfit={outfit} inspo={inspo} liked={liked} setView={setView} onSaveLook={onSaveLook} disliked={disliked} onDislike={onDislike} />
    </div>
  );
}

// ---------- Closet-style piece picker (used in the stylist's Q2) ----------
function PiecePicker({ items, picked, onToggle }) {
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...CATEGORIES.filter(c => items.some(i => i.category === c))];
  const shown = filter === "All" ? items : items.filter(i => i.category === filter);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {cats.map(c => (
          <button key={c} type="button" className="chip"
            style={{ cursor: "pointer", touchAction: "manipulation", background: filter === c ? S.aubergine : "#fff", color: filter === c ? S.blush : S.ink }}
            onClick={() => setFilter(c)}>{c}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 14 }}>
        {shown.map(i => {
          const on = picked.includes(i.id);
          return (
            <button key={i.id} type="button" onClick={() => onToggle(i.id)} className="card"
              style={{
                textAlign: "left", padding: 0, cursor: "pointer", touchAction: "manipulation",
                border: `${on ? 2 : 1}px solid ${on ? S.aubergine : S.aubergine + "18"}`,
                boxShadow: on ? `0 0 0 1px ${S.aubergine}` : "none",
              }}>
              <div style={{ aspectRatio: "1", background: S.blushSoft, position: "relative" }}>
                {i.img
                  ? <img src={i.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a6a76", fontFamily: "system-ui,sans-serif", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase" }}>No photo</div>}
                {on && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", background: S.aubergine, color: S.blush, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, boxShadow: "0 1px 4px #0004" }}>✓</div>
                )}
              </div>
              <div style={{ padding: "9px 11px" }}>
                <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 14, color: S.ink }}>{i.name}</div>
                <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginTop: 2 }}>{i.category}{i.color ? ` · ${i.color}` : ""}{i.tone ? ` · ${i.tone}` : ""}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- AI Stylist chat ----------
function Stylist({ items, weather, occasion, outfit, inspo, liked, setView, onSaveLook, disliked, onDislike }) {
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
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [chat, busy]);

  function systemPrompt(chosenStyle, piecesTextValue) {
    const closet = items.length
      ? items.map(i => `- ${i.name} (${i.category}, ${i.color}, ${i.tone} tone, warmth ${i.warmth}, for ${(i.formality||[]).join("/") || "any"})`).join("\n")
      : "(the closet is empty)";
    const suggestion = outfit?.pieces?.length
      ? outfit.pieces.map(p => `${p.name} (${p.category}, ${p.color})`).join("; ")
      : "(none generated yet)";
    const w = weather ? `${weather.temp}°C, ${weatherLabel(weather.code)}${weather.wind > 25 ? ", windy" : ""}` : "unknown";
    return `You are a warm, sharp personal stylist working inside the user's own wardrobe app. ` +
      `Build looks ONLY from the pieces in their closet below; if something useful is missing, say so briefly. ` +
      `Reference pieces by name. Keep replies concise and friendly — a few sentences, not an essay. Use plain text (no markdown headers). ` +
      `When you propose a full outfit, begin your reply with a single line "Look: <2-4 word name>", then a blank line, then a short explanation.\n\n` +
      `Today's context:\n` +
      `- Weather: ${w}\n` +
      `- Occasion: ${occasion}\n` +
      `- Style they want: ${chosenStyle || "unspecified"}\n` +
      `- Pieces they'd like to include: ${piecesTextValue || "none specified"}\n` +
      `- The app's weather-based suggestion: ${suggestion}\n` +
      `- Their closet:\n${closet}\n` +
      (inspo.length ? `\nThey've shared ${inspo.length} photo(s) of outfits they've WORN (their usual style — match what suits them).` : "") +
      (liked.length ? `\nThey've also shared ${liked.length} photo(s) of outfits they LIKE and want to lean toward (aspiration — nudge the look in this direction, while only using pieces from their closet).` : "") +
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
      setChat(c => [...c, { role: "assistant", content: data.text || "(no reply)" }]);
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
    const opener = `I'm dressing for ${occasion.toLowerCase()}. The style I'm after is "${style}". ` +
      (piecesTextValue ? `I'd like to build it around: ${piecesTextValue}. ` : `I don't have specific pieces in mind. `) +
      `Please style a full outfit from my closet and tell me why it works.`;
    send(opener, style, true, piecesTextValue);
  }
  function submitFollowup() {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    send(t, style, false, piecesUsed);
  }
  function reset() {
    setStep("q1"); setStyle(""); setStyleOther(""); setPieces(""); setPicked([]); setPiecesUsed(""); setChat([]); setInput(""); setErr(null);
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

  // Pull an optional "Look: <name>" title off the front of a reply.
  function parseReply(text) {
    const m = (text || "").match(/^\s*(?:look|outfit|title)\s*:\s*(.+)/i);
    if (m) {
      const title = m[1].trim().replace(/[\s.·–—-]+$/, "").slice(0, 40);
      const rest = text.slice(m[0].length).replace(/^\s+/, "");
      return { title, text: rest || text };
    }
    return { title: null, text: text || "" };
  }
  function regenerate() {
    if (busy) return;
    send("Not quite — please suggest a different outfit from my closet.", style, false, piecesUsed);
  }

  // A visual outfit board: titled card + the pieces laid out, with save / redo.
  const outfitCard = (title, pcs, i) => {
    const key = "ai|" + occasion + "|" + pcs.map(p => p.id).sort().join(",");
    const saved = savedKeys.has(key);
    const isDisliked = dislikedKeys.has(comboKey(pcs));
    return (
      <div key={"o" + i} style={{ background: S.blushSoft, border: `1px solid ${S.aubergine}18`, borderRadius: 12, padding: 14, margin: "0 0 14px" }}>
        <div style={{ display: "inline-block", background: "#fff", color: S.ink, fontFamily: "system-ui,sans-serif", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 4, marginBottom: 12 }}>
          {title || style || "Your look"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(84px,1fr))", gap: 10 }}>
          {pcs.map(p => (
            <div key={p.id}>
              <div style={{ aspectRatio: "1", background: "#fff", borderRadius: 8, overflow: "hidden", border: `1px solid ${S.aubergine}12` }}>
                <Thumb src={p.img} alt={p.name} />
              </div>
              <div style={{ fontFamily: "system-ui,sans-serif", fontSize: 10, color: "#8a6a76", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={p.name}>{p.name}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ padding: "8px 14px" }} disabled={saved}
            onClick={() => { const k = onSaveLook(pcs); if (k) setSavedKeys(s => new Set(s).add(k)); }}>
            {saved ? "Saved ✓" : "♥ Save look"}
          </button>
          <button className="btn btn-ghost" style={{ padding: "8px 14px" }} disabled={busy || isDisliked}
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
        {(step !== "q1" || chat.length > 0) && (
          <button className="btn btn-ghost" style={{ padding: "6px 12px" }} onClick={reset}>Start over</button>
        )}
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
              const pcs = mentionedPieces(m.content);
              if (pcs.length >= 2) {
                const parsed = parseReply(m.content);
                return (
                  <React.Fragment key={i}>
                    {bubble("assistant", parsed.text, "b" + i)}
                    {outfitCard(parsed.title, pcs, i)}
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={i}>
                  {bubble("assistant", m.content, "b" + i)}
                  {pcs.length === 1 && pieceStrip(pcs, "s" + i)}
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
function Looks({ looks, deleteLook, setView, disliked, removeDislike, items }) {
  const hasDisliked = disliked && disliked.length > 0;
  if (!looks.length) return (
    <div>
      <Empty title="No saved looks yet"
        body="When a look comes together, tap “Save look” on the stylist's suggestion (or “Save this look” on Today's Look) to keep it here."
        action={<button className="btn btn-primary" onClick={()=>setView("today")}>Style a look</button>} />
      {hasDisliked && <DislikedList disliked={disliked} removeDislike={removeDislike} items={items} />}
    </div>
  );

  return (
    <div>
      <h2 style={{ fontWeight: 400, fontSize: 22, borderBottom: `1px solid ${S.aubergine}22`, paddingBottom: 8, marginTop: 0 }}>
        Saved looks ({looks.length})
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 18, marginTop: 18 }}>
        {looks.map(l => (
          <div key={l.id} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 17 }}>{l.occasion}</div>
              <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11, color: "#8a6a76" }}>
                {l.weather ? `${l.weather.temp}°C · ${weatherLabel(l.weather.code)}` : ""}
              </div>
            </div>
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
function MyStyle({ inspo, addInspo, deleteInspo, liked, addLiked, deleteLiked, setView }) {
  return (
    <div>
      <p style={{ fontFamily: "system-ui,sans-serif", fontSize: 13, color: "#7a5a66", maxWidth: 560, margin: "0 0 22px" }}>
        Add photos to teach the AI stylist your taste. Everything stays on your device.
      </p>
      <PhotoSection
        title="Outfits you've worn"
        blurb="Pictures of yourself in outfits you've worn and loved — so the stylist knows what suits you and what you actually reach for."
        cta="Add worn outfits"
        photos={inspo} onAdd={addInspo} onRemove={deleteInspo} />
      <PhotoSection
        title="Outfits you like"
        blurb="Looks you're drawn to and want to lean toward — screenshots, pins, anyone's outfits. The stylist uses these as aspiration when styling you."
        cta="Add liked outfits"
        photos={liked} onAdd={addLiked} onRemove={deleteLiked} />
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
  const [filter, setFilter] = useState("All");
  const cats = ["All", ...CATEGORIES.filter(c => items.some(i => i.category === c))];
  const shown = filter === "All" ? items : items.filter(i => i.category === filter);
  const [editId, setEditId] = useState(null);

  if (!items.length) return (
    <div>
      <Empty title="Nothing here yet" body="Upload photos of your clothes and accessories to build your digital closet."
        action={<button className="btn btn-primary" onClick={()=>setView("add")}>Add pieces</button>} />
      <Backup exportData={exportData} importData={importData} />
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {cats.map(c => (
          <button key={c} className="chip" style={{ cursor:"pointer", background: filter===c?S.aubergine:"#fff", color: filter===c?S.blush:S.ink }} onClick={()=>setFilter(c)}>{c}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 16 }}>
        {shown.map(i => (
          <div key={i.id} className="card">
            <div style={{ aspectRatio: "1", background: S.blushSoft, position: "relative" }}>
              <Thumb src={i.img} alt={i.name} />
              <button onClick={()=>deleteItem(i.id)} title="Remove" style={{ position:"absolute", top:6, right:6, border:"none", background:"#00000088", color:"#fff", width:24, height:24, borderRadius:"50%", cursor:"pointer" }}>×</button>
            </div>
            <div style={{ padding: "10px 12px" }}>
              {editId === i.id ? (
                <div style={{ display:"grid", gap:6 }}>
                  <input value={i.name} onChange={e=>updateItem(i.id,"name",e.target.value)} />
                  <select value={i.category} onChange={e=>updateItem(i.id,"category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>
                  <select value={i.color} onChange={e=>updateItem(i.id,"color",e.target.value)}>{COLORS.map(c=><option key={c}>{c}</option>)}</select>
                  <select value={i.tone||"Classic"} onChange={e=>updateItem(i.id,"tone",e.target.value)}>{TONES.map(t=><option key={t}>{t}</option>)}</select>
                  <select value={i.warmth} onChange={e=>updateItem(i.id,"warmth",e.target.value)}>{WARMTH.map(w=><option key={w}>{w}</option>)}</select>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {FORMALITY.map(f => (
                      <button key={f} className="chip" style={{ cursor:"pointer", background: i.formality?.includes(f)?S.clay:"#fff", color: i.formality?.includes(f)?"#fff":S.ink }}
                        onClick={()=>{ const has=i.formality?.includes(f); updateItem(i.id,"formality", has? i.formality.filter(x=>x!==f):[...(i.formality||[]),f]); }}>{f}</button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={()=>setEditId(null)}>Done</button>
                </div>
              ) : (
                // Tapping the details opens the tag editor (as well as the button).
                <div onClick={()=>setEditId(i.id)} style={{ cursor: "pointer" }}>
                  <div style={{ fontSize: 15 }}>{i.name}</div>
                  <div style={{ fontFamily:"system-ui,sans-serif", fontSize: 11, color: "#8a6a76", marginBottom: 6 }}>{i.category} · {i.color}{i.tone?` · ${i.tone}`:""} · {i.warmth}</div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom: 8 }}>
                    {i.formality?.map(f => <span key={f} className="chip">{f}</span>)}
                  </div>
                  <button className="btn btn-ghost" style={{ padding:"6px 12px" }} onClick={(e)=>{ e.stopPropagation(); setEditId(i.id); }}>Edit tags</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <Backup exportData={exportData} importData={importData} />
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
