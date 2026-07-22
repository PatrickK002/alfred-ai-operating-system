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
  `wardrobe_inspo_v1`, `wardrobe_liked_v1`, `wardrobe_disliked_v1`) in on first run. "My Style" holds two
  photo sets: `inspo` (outfits worn) and `liked` (outfits liked / aspiration);
  both are sent to the stylist, labelled, on the first message. Load is async — App holds a `ready` flag so
  the save effects don't clobber storage before the initial load finishes; it also
  calls `navigator.storage.persist()`. `downscaleImage` shrinks "My Style" photos.
  `exportData`/`importData` provide an optional JSON backup (Backup card in Closet).
- **Today view order**: weather strip → `Stylist` (AI chat, moved to the top) →
  **Today look recommendations** carousel. `buildOutfit` now calls
  `recommendOutfits` (repeated `composeOutfit` calls, deduped by `key`) to fill a
  horizontally-scrolling carousel of looks, each with a per-look "♥ Save look".
- **composeOutfit / recommendOutfits**: `buildOutfit`'s logic is extracted into the
  pure module-level `composeOutfit(items, weather, occasion)` so it can be reused by
  both the Today carousel and the travel planner (which passes a synthetic weather
  from the trip's temperature).
- **Temperature override**: an optional "Dress for … °C" input on Today sets
  `tempOverride`. When non-empty, `styleWeather` replaces the actual temp with the
  chosen one (keeping the real code/wind) and is passed to `buildOutfit`, the swap
  helpers, and the `Stylist` (its prompt flags it as a chosen temperature) — the
  weather strip still shows the actual conditions. With an override set you can style
  even without a location (`styleWeather` truthy). Blank = use the actual temperature.
- **Saved looks filtering**: the `Looks` view has two filter-chip rows — **Occasion**
  and **Season**. Each look carries an editable four-**season tag** (`look.season` ∈
  Spring/Summer/Autumn/Winter): tap a season chip on the card to set it (`setLookSeason`).
  New looks default via `guessSeason` (temperature extremes decide Summer/Winter
  outright; otherwise the save month `look.savedAt` picks Spring vs Autumn); `lookSeason`
  returns the explicit tag or the guess. The card also shows the temperature **range**
  from `lookClimate` (`WARMTH_TEMP`/`estTempFromPieces` estimate temp from the warmest
  piece when a look has no weather stamp — a coat ⇒ winter). Piece snapshots include
  `warmth`, and looks store `savedAt`, so both work for weather-less looks (holiday
  plans, etc.).
- **Insights** (`insights` view): a computed style profile — colour palette (swatches
  + a proportion bar, using `COLOR_HEX`/`colorHex`), category and tone/occasion
  `Meter` bars, a neutrals-vs-colour split, and a one-line summary. An optional
  "stylist's read" button posts to `/api/chat` for a written take (degrades without a
  key). All the visuals are deterministic and work offline.
- **Travel** (`travel` view): plan a holiday. `trips` (key `wardrobe_trips_v1`, in
  backup) each hold `{ destination, start, end, temp, vibe, notes, plan }`.
  `generateTripPlan` builds a per-day, per-slot (Day/Afternoon/Evening/Night) outfit
  plan from the closet via `composeForSlot` (snapshots pieces so it survives edits),
  and `packingSummary` aggregates the unique pieces for the packing overview. The
  dashboard mirrors the reference design: summary card, day tabs, slot cards, packing
  bars, and "outfits at a glance". Each holiday outfit has a "♥ Save look" that goes
  into Saved Looks via `onSaveLook` with a `note` ("Positano · Day 2 · Dinner") shown
  on the saved-look card.
- **saveLookPieces(pieces, opts)**: the shared save-a-look helper takes optional
  `{ occasion, note, weather }` so Today, the stylist, and the travel planner can all
  save into the one Saved Looks collection with the right label.
- **Per-piece controls (hover / tap reveal)**: on the compact piece tiles (Today
  carousel and chat boards) the ✨/↻/× buttons live in a `.pieceActions` bar along the
  bottom of the photo, hidden by default. Pointer devices reveal on
  `.piece:hover`/`:focus-within`; touch devices use `useTapReveal()` — an
  `onClickCapture` on each `.piece` that (only when `matchMedia("(hover: none)")`)
  stops the tap from opening the lightbox and toggles a `.revealed` class, with a
  document listener that hides it when you tap outside any `.piece`. Taps on the
  control buttons pass through.
- **Grid overflow**: piece grids inside fixed/scrolling cards (Today carousel, travel
  mini-boards) use `repeat(N, minmax(0,1fr))` + `minWidth:0` so photos can't spill
  past the card edge (a plain `1fr` track floors at the image's min-content width).
- **AI Stylist**: the `Stylist` component (on the Today view) runs a Q1 (style) →
  Q2 (pieces in mind) → chat flow, POSTing to `/api/chat`. The client builds the
  system prompt (persona + closet inventory + weather + occasion + current
  suggestion) and sends the message history; up to 3 "My Style" photos ride along
  on the first message as image blocks. `/api/chat` (in `server/index.js`) proxies
  to the Anthropic Messages API and returns assistant text; 503 without a key, and
  the UI degrades gracefully.
- **Stylist outfit board**: the model is asked to end an outfit reply with a
  `Pieces:` block, one line per piece: `- <name> | <core|optional> | <reason>`.
  `parseOutfitReply` pulls the `Look:` title + this block out of the prose and matches
  each name to a closet item (`matchItem`); it powers the board, the per-item **why**
  overview box, and the **Optional layer** tag (optional = just-in-case layers like a
  jacket "if it gets cooler", shown separately from core pieces). Each board is
  editable per message (`boards[msgIndex]`): per-piece **✨ stylist swap** (`boardAiSwap`
  → `/api/chat`, returns `Swap: <name> | <why>`), **↻ quick swap** (`boardSwap` →
  `pickAlternative`), **× remove** (`boardRemove`, which calls `onNotePieceRemoved`),
  and **⤢ Expand** (opens the shared `LookDetail` modal). Board actions: "Save look",
  "Don't suggest again" (`onDislike` → `dislikeCombo`), "Suggest another" (`regenerate`).
- **Stylist memory**: the conversation is persisted (IDB key `stylistchat`) so it
  resumes across reloads (restored on mount before the save effect arms). Across
  conversations, `memory` (App state, key `wardrobe_memory_v1`, in backup — `{ notes,
  styles }`) accumulates what the user tells the stylist: `onRemember` is called from
  `begin` (style + occasion), every follow-up message, and every outfit the stylist
  proposes (parsed from the reply in `send`). `systemPrompt` injects a
  "what you remember about them from earlier conversations" digest. Memory works
  silently — the note contents/history are not shown; the stylist header only offers a
  **Forget memory** button (`clearMemory`) when memory exists. "Start over" clears the
  visible transcript but keeps memory.
- **Learning from saved looks (`savedTaste`)**: the looks the user saves are a
  positive signal. `savedTaste(looks)` returns `favorIds` (piece ids that appear in
  saved looks) — passed to `composeOutfit`/`pickAlternative`, which lean toward those
  pieces ~60% of the time — plus a text digest (most-saved pieces + recent saved
  combos) injected into the stylist's system prompt so it leans into pairings the user
  loves. Recomputed from `looks` each render (cheap).
- **Learning (`prefs`)**: `prefs.removed` (key `wardrobe_prefs_v1`, in backup) counts
  how often each piece is removed from a look. Pieces removed ≥2× go into `avoidIds`
  (leaned away from by `composeOutfit`/`pickAlternative`) and `removedNames` (listed in
  the stylist system prompt). `notePieceRemoved` is called from both the Today
  recommendations and the chat boards. Within a session the stylist also has the full
  chat history (questions, requests) as context.
- **Personal Shopper**: the `Shopper` component (its own "Personal Shopper" view)
  lets the user save stores/brands they like (`brands`, key `wardrobe_brands_v1`,
  each `{ id, name, url, note }`; `addBrand` dedupes by host/name, included in
  backup). It POSTs to `/api/shop`, which is like `/api/chat` but enables the
  Anthropic **web-search** server tool so the shopper can look up real items,
  prices, and current sales. Quick actions send templated prompts: *Suggest pieces
  for my closet* (gap-fill from saved stores), *Discover new brands*, and *Check for
  sales now* (persists the last report to IDB key `shopnews` with a timestamp, shown
  under "Sale watch" — there's no background push, so it's an on-demand check). The
  model is asked to emit `Brand: name | url | reason` lines; `splitBrandLines` pulls
  them out and renders saveable brand cards (`+ Save brand` → `addBrand`), and
  `linkify` makes URLs in replies clickable.
- **Closet editing**: tapping a piece (or its "Edit tags" button) opens `EditPanel`,
  a right-side drawer (`position:fixed`, z-index 55 — above the lightbox) showing the
  item's large photo and every attribute as `TagButtons` groups, plus a Delete
  (confirm) / Done footer. Edits call `updateItem` live. The old cramped inline card
  form is gone.
- **Lightbox**: `LightboxContext` provides an `open(src)` fn; any `Thumb` with a
  photo is tappable to enlarge.
- **Saved looks**: from Today's Look, "Save this look" stores the current outfit
  under a stable `outfit.key` (occasion + sorted piece ids) so a given combination
  saves only once. Each saved look snapshots its pieces, so it survives later item
  edits/deletes. The `Looks` view lists and removes them.
- **Auto-tagging**: `autoTag()` posts to `/api/tag` (the Node proxy in
  `server/index.js`). Failures fall back to manual tagging; never invent tag defaults.
  The tagger also returns `brand` (+ `brandUrl`) when it can read a clear logo/wordmark
  or legible brand text (neck/care label, swing tag, packaging) in the photo — it
  transcribes what's visible and never guesses; on commit, `autoSaveBrands` adds any
  spotted brands to the Personal
  Shopper's saved brands (deduped by name/host, note "Spotted in your closet"), and the
  brand is stored on the item.
- **Styling engine**: `buildOutfit()` filters by occasion + weather-appropriate
  warmth, builds a dress/jumpsuit or top+bottom silhouette, adds outerwear when
  cool/wet, then shoes and accessories. It favours a single "Bold" tone piece and
  avoids clashing two saturated colours (`colorsClash`, `NEUTRALS`).
- **Weather**: Open-Meteo, no API key, **manual location only** (no geolocation/GPS).
  `chooseLocation(name)` geocodes the typed city and `fetchWeather(loc)` pulls current
  conditions **plus a 7-day daily forecast**. A **Day** selector in the weather strip
  sets `dayIndex`; a derived effect makes `weather` reflect that day (today = live
  conditions; other days = a mid-point of the forecast high/low, with `dayLabel`,
  `tmax`, `tmin`). The chosen `location` is persisted (`idbSet("location")`) and
  reloaded on open. `warmthForTemp()` maps °C → allowed warmth; `"Not applicable"`
  warmth is always allowed.
- **Swap a piece**: each piece in a Today recommendation has two buttons — ↻ (quick)
  and ✨ (AI). `swapPiece(recIndex, pieceId)` does the instant, deterministic pick via
  `pickAlternative` (same category, right occasion/warmth, avoids clashes, excludes
  pieces already in the look) or drops it if there's no other match. `aiSwapPiece`
  asks the stylist (`/api/chat`) to choose the best replacement from the same-category
  options and return `Swap: <name> | <why>`; the chosen piece is swapped in and the
  reason is shown on the card as `swapNote` (falls back to `pickAlternative` / degrades
  without a key). `swapping` holds the `"recIndex:pieceId"` being AI-swapped.
  `removePiece(recIndex, pieceId)` drops a piece from a look (× button beside ↻).
- **Expanded look**: each recommendation card has an "⤢ Expand" button that opens
  `LookDetail`, a modal (z-index 56) with larger photos and per-piece labelled
  controls (✨ Stylist / ↻ Swap / × Remove) plus the notes and Save; it reads
  `recs[expanded]` so swaps/removes reflect live.
- **Piece picker**: the stylist Q2 `PiecePicker` shows ~two rows in a `maxHeight`
  scroll container (compact) rather than the full closet.

## Conventions

- Serif display type, aubergine/blush palette defined in the `S` object.
- Prefer prose-free, minimal-dependency code; the server is intentionally
  zero-dependency (built-in `http` + `fetch`).
