# Project notes for Claude Code

Personal wardrobe stylist. Single-page React app (Vite). The entire UI and the
outfit-styling logic live in `src/App.jsx`. Keep changes there unless splitting
into modules is explicitly requested.

## Run

- `npm install`
- `npm run dev` — app only (manual tagging)
- `npm start` — app + tagging proxy (needs `.env` with `ANTHROPIC_API_KEY`)

## Key concepts in src/App.jsx

- **Data model**: each item = `{ id, img (data URL), category, color, tone, warmth, formality[], name }`.
- **Constants** near the top define the tag vocabularies: `CATEGORIES`, `COLORS`,
  `TONES`, `WARMTH`, `FORMALITY`, plus `NEUTRALS`/`JEWELRY` helpers. Update these
  lists to add/remove tag options; the tap-button UIs read from them automatically.
- **Persistence**: `loadItems`/`saveItems` use `localStorage` (key `wardrobe_items_v1`).
  Saved looks use `loadLooks`/`saveLooks` (key `wardrobe_looks_v1`).
- **Saved looks**: from Today's Look, "Save this look" stores the current outfit
  under a stable `outfit.key` (occasion + sorted piece ids) so a given combination
  saves only once. Each saved look snapshots its pieces, so it survives later item
  edits/deletes. The `Looks` view lists and removes them.
- **Auto-tagging**: `autoTag()` posts to `/api/tag` (the Node proxy in
  `server/index.js`). Failures fall back to manual tagging; never invent tag defaults.
- **Styling engine**: `buildOutfit()` filters by occasion + weather-appropriate
  warmth, builds a dress/jumpsuit or top+bottom silhouette, adds outerwear when
  cool/wet, then shoes and accessories. It favours a single "Bold" tone piece and
  avoids clashing two saturated colours (`colorsClash`, `NEUTRALS`).
- **Weather**: Open-Meteo, no API key. `warmthForTemp()` maps °C → allowed warmth
  levels; `"Not applicable"` warmth is always allowed.

## Conventions

- Serif display type, aubergine/blush palette defined in the `S` object.
- Prefer prose-free, minimal-dependency code; the server is intentionally
  zero-dependency (built-in `http` + `fetch`).
