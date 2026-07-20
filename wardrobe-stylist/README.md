# The Wardrobe — personal stylist

Tag the clothes and accessories you already own, and get outfit suggestions based on the live weather where you are. Everything is stored locally in your browser; nothing about your wardrobe leaves your device (weather uses only your coordinates against a free, no-signup API).

## What it does

- **Add pieces** — upload photos and tag them by category, colour, tone, warmth, and occasion (fast tap-buttons). If you set up an API key, uploads are pre-tagged automatically and you just confirm.
- **Closet** — browse and edit everything, filterable by category.
- **Today's look** — pulls current weather, you pick the occasion, and it styles a full outfit (favouring one bold statement piece and avoiding clashing colours).
- **AI Stylist chat** — on Today's Look, the stylist asks what style you're going for and whether you have pieces in mind, then suggests a look from your closet and answers follow-up questions (needs an API key — see Setup).
- **My Style** — upload photos of outfits you've worn and loved; the AI stylist uses them as visual taste context.
- **Saved looks** — keep any outfit you love with one tap; it's stored (with the weather it was styled for) so you can pull it up again later.
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

- Wardrobe items (including photos, as data URLs) live in your browser's `localStorage` under the key `wardrobe_items_v1`. Saved looks live under `wardrobe_looks_v1`.
- Clearing site data or switching browsers/devices starts you fresh. There is no cloud sync.
- Photos stored this way count against the browser's storage quota (typically a few MB). For a very large wardrobe you may want to swap in IndexedDB — see `src/App.jsx` `loadItems`/`saveItems`.

## Project layout

```
index.html          app entry
src/main.jsx        React bootstrap
src/App.jsx         the whole app (UI + styling logic)
server/index.js     tiny proxy for AI auto-tagging (optional)
vite.config.js      dev server + /api proxy
.env.example        where your API key goes
```

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
