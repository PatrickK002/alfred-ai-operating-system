# The Wardrobe — personal stylist

Tag the clothes and accessories you already own, and get outfit suggestions based on the live weather where you are. Everything is stored locally in your browser; nothing about your wardrobe leaves your device (weather uses only your coordinates against a free, no-signup API).

## What it does

- **Add pieces** — upload photos and tag them by category, colour, tone, warmth, and occasion (fast tap-buttons). If you set up an API key, uploads are pre-tagged automatically and you just confirm.
- **Closet** — browse and edit everything, filterable by category.
- **Today's look** — pulls current weather, you pick the occasion, and it styles a full outfit (favouring one bold statement piece and avoiding clashing colours).
- **Saved looks** — keep any outfit you love with one tap; it's stored (with the weather it was styled for) so you can pull it up again later.

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
