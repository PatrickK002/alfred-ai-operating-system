# The Wardrobe — personal stylist

Tag the clothes and accessories you already own, and get outfit suggestions based on the live weather for the location you choose. Everything is stored locally in your browser; nothing about your wardrobe leaves your device (weather uses only the city you pick against a free, no-signup API).

## What it does

- **Add pieces** — upload photos and tag them by category, colour, tone, warmth, and occasion (fast tap-buttons). If you set up an API key, uploads are pre-tagged automatically and you just confirm — and any brand the photo clearly shows — a logo or readable label/tag text — is added to your saved shops for the Personal Shopper.
- **Closet** — add new pieces (upload photos right at the top of the tab) *and* browse and edit everything, filterable by category and warmth.
- **Today's look** — set your location (you choose the city — no GPS) and the **day of the week** (uses that day's forecast), optionally type a **specific temperature to dress for** (overrides the actual temp for the suggestions), pick the occasion, and it lines up a **carousel of recommended looks** to swipe through and save. Two ways to fill the carousel: **Style me** builds looks instantly from the built-in rules (free, works offline, each favouring one bold statement piece and avoiding clashing colours); **✨ AI looks** asks the AI stylist to reason out several coordinated outfits — each with a name, a *why this works* overview, and a reason for every piece (needs your hosted app; roughly a few cents per tap, and it caches your closet so repeat taps are cheaper). If the AI is unavailable it quietly falls back to the rule-based looks, so you always get suggestions. For the quickest start, tap **🪄 Dress me for … today** at the very top — it styles the day's look in one tap using your last engine and jumps you straight to it. Don't like a piece in a look? Tap **↻** for an instant swap, or **✨** to have the AI stylist pick the best alternative and tell you why. The AI stylist chat sits right at the top. The app also **remembers your last settings** — occasion, chosen engine, packing view and sale-store selection — so it opens where you left off.
- **Insights** — a read on your style drawn from your tagged pieces: your colour palette, the balance of your wardrobe (neutrals vs colour, tone, categories, occasions), and an optional written stylist's take.
- **Travel** — planning a holiday? Enter the destination, dates, temperature and vibe (the dates set how many days you plan for), then build each day yourself: add outfits from your **saved looks** and tag each one **Day look**, **Night look** or **Other** (2–3 a day is the suggestion). The same look can be reused across days, each day shows how many outfits it has, and a **packing overview** lists every unique piece across the trip — including a **packing list** you tick off as you pack (it remembers what's ticked) — switch between a name-only **checklist** and a **photo** grid, both marking what's already packed — and **download as a text file or copy** it to share.
- **AI Stylist chat** — on Today's Look, the stylist asks what style you're going for and whether you have pieces in mind, then suggests a look from your closet and answers follow-up questions (needs an API key — see Setup). Each suggested look is a live board: swap (✨/↻) or remove (×) any piece, expand it for a bigger view, and read a **why each piece** overview. Just-in-case layers (a jacket "if it gets cooler") are tagged **Optional** and shown separately. The stylist learns from what you save (it leans into those pieces and pairings) and from what you remove (it leans away). Your conversation is saved (it resumes if you close and reopen the app), and the stylist remembers what you've told it in past chats — you can wipe that memory anytime with **Forget**.
- **My Style** — upload photos of outfits you've worn *and* outfits you like (aspiration); the AI stylist chat and the **✨ AI looks** carousel both *see* these photos as visual taste context (what suits you, plus the direction you want to lean). Both sets also feed the **free** recommendations: each photo is read once for its dominant colours and vibe (needs the hosted app for that one read), and from then on the offline **Style me** engine leans toward that palette — tap **Learn my taste** to read outfits added earlier.
- **Personal Shopper** — save the stores and brands you love, and an AI shopper (which searches the live web) suggests new pieces that fill gaps in your closet, checks your saved stores for current sales, and discovers new brands you can save with one tap. Brands are added automatically from new piece photos, and **Scan closet for brands** finds them in pieces you've already added — it only scans photos it hasn't scanned before, so re-running it just covers anything new (needs an API key — see Setup).
- **Saved looks** — keep any outfit you love with one tap (or build one by hand from the Closet); it's stored (with the weather it was styled for) so you can pull it up again later. Each look gets a **season tag** — Spring, Summer, Autumn or Winter (auto-set, and you can change it with a tap) — plus its temperature range, and you can filter by occasion, season *and* whether you've **worn** it. Tap **Mark worn** on a look to flag outfits you've actually worn: they show up under **My Style → Outfits you've worn** and count as a stronger *"what suits me"* signal for the stylist.
- Tap any photo to enlarge it.

## Install as an app (iPad / iPhone / Android)

The Wardrobe is an installable web app. Once it's hosted at a URL, open that URL
in the browser and add it to your home screen — it then gets its own icon and
opens full-screen with no browser chrome, like a native app:

- **iPad / iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** menu (⋮) → **Install app** / **Add to Home screen**.

Your closet and saved looks live in the app's local storage on that device.

## Requirements

- Node.js 18 or newer (needs the built-in `fetch`).

## Setup

```bash
npm install
```

### Run without auto-tagging (manual tap-tagging only)

```bash
npm run dev
```

Open the URL Vite prints (default http://localhost:5173).

### Run with AI auto-tagging

1. Copy the env file and add your Anthropic API key:
   ```bash
   cp .env.example .env
   # edit .env and set ANTHROPIC_API_KEY
   ```
2. Start both the web app and the tagging proxy together:
   ```bash
   npm start
   ```

The proxy (`server/index.js`) holds your key so it never reaches the browser. If the key is missing or the proxy is down, the app silently falls back to manual tagging — nothing breaks.

## How your data is stored

- Your wardrobe (pieces, saved looks, and My Style photos) is stored on your device in **IndexedDB** — it saves and loads automatically, and is large and durable enough for photos. (Older versions used `localStorage`; that data is migrated in automatically.)
- Data is kept per browser/app and does not sync to the cloud. On iOS, a site opened in Safari and the same site added to the Home Screen can keep **separate** storage — for the most reliable experience, use one of them consistently (the Home Screen app is recommended).
- **iOS can clear local storage** (under storage pressure or long inactivity), which can wipe your photos even though they're stored durably. Two safeguards guard against this: a **backup reminder** appears when it's been over a week (or you've never backed up), and a **save-guard** refuses to overwrite your stored pieces with an empty or photo-stripped version — so a transient glitch can't quietly erase your photos. **Keep an off-device backup** (Files/iCloud) — it's the only thing that survives an iOS storage reset.
- **Backup:** the Closet tab has *Download backup* / *Restore backup* — a single JSON file you can keep as a safety copy or use to move your wardrobe to another device or link.

## Project layout

```
index.html          app entry
src/main.jsx        React bootstrap
src/App.jsx         the whole app (UI + styling logic)
server/index.js     tiny proxy for AI auto-tagging (optional)
vite.config.js      dev server + /api proxy
.env.example        where your API key goes
```

## Architecture

A high-level tour of how the app is built and why.

**Shape**
- **Front end:** one React component tree in `src/App.jsx` (kept single-file on purpose — easy to read and reason about), built by Vite to a static `dist/`.
- **Back end:** a zero-dependency Node server (`server/index.js`, built-in `http`/`fs`/`fetch` only) that serves the built app *and* proxies every AI call so the Anthropic API key never reaches the browser.
- **AI endpoints:** `/api/tag` (auto-tag a piece), `/api/brand` (read a brand from a photo), `/api/palette` (colour/vibe of a My Style outfit), `/api/chat` (the stylist + AI-looks carousel), `/api/shop` (personal shopper, with live web search). All degrade gracefully to a 503 the app handles.

**Two styling engines**
- **Rule engine** (`composeOutfit`/`recommendOutfits`) — a pure, deterministic function: filters by occasion + weather-appropriate warmth, builds a coherent silhouette, keeps one statement piece, avoids colour clashes, and biases toward learned taste. Free, instant, works offline.
- **AI engine** (`/api/chat`) — the conversational stylist and the ✨ AI-looks carousel, which reason over the closet, weather, taste signals and My Style photos. The closet is sent as a `cache_control` block for cheap repeat calls; any failure falls back to the rule engine.

**Learning the user**
- Signals: **saved looks** (favour), **removed** pieces (avoid), **disliked** combos (never repeat), and **My Style** photos (worn + liked) turned into a colour/vibe taste that biases the rule engine and is shown to the AI engines (as text and, for the chat/carousel, as images).

**Data & persistence**
- Local-first in **IndexedDB** (a tiny `kv` store), auto-migrating from legacy `localStorage`; everything saves/loads automatically. Saved looks and trip outfits are self-contained **snapshots** so they survive edits/deletes of the underlying pieces.
- **Resilience:** a **save-guard** refuses to overwrite good stored data with an empty/photo-stripped version, and a **backup reminder** nudges an off-device JSON backup (the only thing that survives an iOS storage reset).

**How it was built**
- Feature-by-feature, each shipped as a small self-contained change: implement → **headless Playwright test** against a production preview build → commit on a fresh branch from `main` → PR → squash-merge → auto-deploy on Render.

## Build for production

```bash
npm run build      # outputs static site to dist/
npm run preview    # preview the build
```

Note: the auto-tagging proxy is a dev convenience. For a deployed site, host `server/index.js` (or an equivalent serverless function) somewhere your frontend can reach at `/api/tag`, and keep the API key server-side.

## Deploy on Render (hosted app **with** auto-tagging)

`server/index.js` serves the built app *and* the `/api/tag` proxy, so a single
Render **Web Service** gives you a hosted, installable app whose API key stays
private (held as a Render environment variable, never in the code).

1. In the Render dashboard: **New → Web Service**, and connect this repository.
2. Configure:
   - **Root Directory:** `wardrobe-stylist`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build -- --base=/`
   - **Start Command:** `node server/index.js`
   - **Instance Type:** Free is fine.
3. Under **Environment**, add:
   - `ANTHROPIC_API_KEY` = your key (`sk-ant-…`). Optionally `ANTHROPIC_MODEL`.
   - Render sets `PORT` automatically; the server reads it.
4. Deploy. Render gives you a URL like `https://the-wardrobe.onrender.com` — open
   it in Safari and **Add to Home Screen**.

The key lives only in Render's environment settings. If it's missing or wrong,
`/api/tag` returns 503 and the app quietly falls back to manual tagging.

> On Render's free tier the service sleeps after inactivity, so the first request
> after a while takes ~30–60 s to wake. Paid instances stay always-on.
