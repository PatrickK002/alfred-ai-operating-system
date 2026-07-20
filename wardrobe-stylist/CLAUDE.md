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
- **Persistence**: data is stored in **IndexedDB** (`openDB`/`idbGet`/`idbSet`, DB
  `wardrobe`, store `kv`) under keys `items`/`looks`/`inspo`, which is durable and
  large enough for photos (localStorage was too small/evictable on iOS). `loadStore`
  migrates legacy `localStorage` values (`wardrobe_items_v1`, `wardrobe_looks_v1`,
  `wardrobe_inspo_v1`, `wardrobe_liked_v1`) in on first run. "My Style" holds two
  photo sets: `inspo` (outfits worn) and `liked` (outfits liked / aspiration);
  both are sent to the stylist, labelled, on the first message. Load is async — App holds a `ready` flag so
  the save effects don't clobber storage before the initial load finishes; it also
  calls `navigator.storage.persist()`. `downscaleImage` shrinks "My Style" photos.
  `exportData`/`importData` provide an optional JSON backup (Backup card in Closet).
- **AI Stylist**: the `Stylist` component (on the Today view) runs a Q1 (style) →
  Q2 (pieces in mind) → chat flow, POSTing to `/api/chat`. The client builds the
  system prompt (persona + closet inventory + weather + occasion + current
  suggestion) and sends the message history; up to 3 "My Style" photos ride along
  on the first message as image blocks. `/api/chat` (in `server/index.js`) proxies
  to the Anthropic Messages API and returns assistant text; 503 without a key, and
  the UI degrades gracefully.
- **Stylist outfit board**: when a reply names ≥2 closet pieces, it renders as a
  titled `outfitCard` (a soft-background board with the pieces laid out) instead of
  plain text. The title comes from a `Look: <name>` first line the model is asked to
  emit (`parseReply` strips it). Actions: "Save look" (`onSaveLook` →
  `saveLookPieces` adds to Saved Looks) and "Suggest another" (`regenerate`).
- **Lightbox**: `LightboxContext` provides an `open(src)` fn; any `Thumb` with a
  photo is tappable to enlarge.
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
