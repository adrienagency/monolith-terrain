# Parcours + shortcuts + UI + routes/places — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Every task: work in **C:\Dev\monolith-terrain** (branch feat/orbital-globe) — begin Bash with `cd /c/Dev/monolith-terrain &&`; stage ONLY the files you edit (never `git add -A`). New test files → register in `package.json`. Verify `node --check` + `node --test` + `npx vite build` each task; browser-verify UI/GL at the end of each wave.

**Goal:** Ship the A–E batch: routes polish, GeoNames progressive place names, UI restructure (Camera under Scan, Templates panel + Reset), keyboard shortcuts with a self-updating overlay + full undo/redo, and a first-class Parcours (GPX) panel.

**Architecture:** Mostly targeted edits + a few new modules (`shortcuts.js`, `history.js`, `ui/templates-panel.js`, `ui/shortcuts-overlay.js`), and an extended `GpxLayer`. Shortcuts are a single registry read by both the key handler and the overlay. Undo snapshots `params` and re-applies via one `applyAllParams`.

**Tech Stack:** Three.js r172 (Line2/LineSegments2 + LineMaterial dashes/vertex colours), vanilla JS ESM, Vite, `node --test`.

## Global Constraints
- Vanilla JS ESM; pure logic unit-tested; UI/GL browser-verified. Follow existing patterns.
- Shortcuts registry is the single source of truth; overlay renders from it; inert while a text input/textarea/contenteditable is focused.
- Undo = full params history (deep-clone snapshots, debounced push on committed change, diff to suppress no-ops), restored via `applyAllParams`.
- GeoNames data = CC-BY → "© GeoNames (CC BY 4.0)" credit when Places on. OSM full fidelity unchanged.
- "Reset map" resets look/params to frozen defaults, NOT location/zoom.
- Route line stays legible (auto-contrast); playback head drives animated alt/slope readouts.

---

## WAVE 1 — Routes + Places (A, B)

### Task 1: Road casing toggle + far-view detail by scalerank (A)
**Files:** `src/map/roads-layer.js`, `src/main.js` (params), `src/ui/map-panel.js`, `src/templates-user.js`.
- [ ] Params: add `roadsCasing: true` in main.js.
- [ ] `roads-layer.js`: compute `casing = params.roadsCasing === false ? null : (params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)')` and pass through to `buildLineSegments`. In the **Natural Earth branch** (not OSM), filter by scalerank per notch: keep feature if `(f.properties.scalerank ?? 10) <= (params.roadsDetail>=2 ? 99 : params.roadsDetail>=1 ? 9 : 7)`. (OSM branch unchanged — it already filters by `roadHighwayFilter`.)
- [ ] `map-panel.js` Roads section: add `toggle({ label:'Casing', get:()=>params.roadsCasing, set:v=>{params.roadsCasing=v; ctx.rebuildMapLayers()} })`.
- [ ] `TEMPLATE_KEYS` += `'roadsCasing'`.
- [ ] Verify; commit `feat(map): road casing toggle + far-view detail by rank`.

### Task 2: GeoNames places data (B, pure build + test)
**Files:** `scripts/build-places.mjs` (new), generated `public/data/map/places.json`, `test/places-minzoom.test.js`.
**Interfaces:** `popToMinZoom(pop, capital): number` (exported from the script or a small `src/map/place-tier.js` for testing).
- [ ] Create `src/map/place-tier.js`: `export function popToMinZoom(pop, capital){ if(capital) return 3; if(pop>=1e6) return 4; if(pop>=3e5) return 6; if(pop>=5e4) return 8; if(pop>=1e4) return 10; if(pop>=2e3) return 12; return 13 }`.
- [ ] `test/places-minzoom.test.js`: assert the bands (capital→3, 2M→4, 5e5→6, 8e4→8, 2e4→10, 5e3→12, 500→13). Register in package.json. TDD.
- [ ] `scripts/build-places.mjs`: fetch GeoNames `cities5000` (and `cities1000` for denser villages) from `https://download.geonames.org/export/dump/cities5000.zip` — since it's a zip, prefer a pre-extracted TSV mirror or unzip; if network zip handling is hard, use `cities15000`/`cities5000` TSV via a reliable source. Parse TSV columns (name=1, lat=4, lon=5, feature code=7, population=14), keep `population>0`, map `capital = /^PPLC$/.test(featureCode)`, emit `[name, round(lat,4), round(lon,4), pop, capital?1:0, popToMinZoom(pop,capital)]`, sort by pop desc, write `public/data/map/places.json` (target ≤ ~2 MB — cap to top ~40k by population if larger). Add `"build:places"` npm script.
- [ ] Run it; verify `places.json` shape + a capital near front + size. If GeoNames fetch fails, report and fall back to keeping the current NE places.json but still ship `place-tier.js` + widened tiering (Task 3) — document.
- [ ] Commit `feat(map): GeoNames places data + population→min_zoom tiering`.

### Task 3: Places layer progressive density + GeoNames credit (B)
**Files:** `src/map/places-layer.js`, `src/map/layer-manager.js`/`src/main.js` (credit).
- [ ] `places-layer.js`: widen `maxN` so density grows with zoom, e.g. `maxN = Math.round((zoom>=13?60:zoom>=11?40:zoom>=9?26:zoom>=7?16:10) * (params.placesDensity ?? 1))`. Keep declutter `minDist` but shrink it a touch at high zoom so villages fit.
- [ ] Add a "© GeoNames (CC BY 4.0)" credit shown when Places is on — reuse the OSM-credit DOM/refresh pattern in main.js (`refreshOsmCredit` → generalise to also append the GeoNames line when `params.placesEnabled`).
- [ ] Verify; commit `feat(map): progressive place density by zoom + GeoNames credit`.
- [ ] **Wave 1 browser-verify + deploy:** casing on/off; far notch reveals secondary roads; zoom in → more/smaller names + credit. Then build + deploy + push.

---

## WAVE 2 — UI restructure (C)

### Task 4: Camera panel to left dock under Scan
**Files:** `src/ui/camera-panel.js`, `src/main.js` (build order).
- [ ] `camera-panel.js`: `side: 'left'`.
- [ ] In `src/main.js`, ensure `buildScanPanel(...)` is built BEFORE `buildCameraPanel(...)` so Camera docks below Scan on the left. (Check current build order; reorder the calls.)
- [ ] Verify; browser-check Camera is under Scan on the left, right dock = Create/Shaders/Map. Commit `refactor(ui): move Camera panel to the left dock under Scan`.

### Task 5: Templates panel + Reset map
**Files:** `src/ui/templates-panel.js` (new), `src/ui/create-panel.js` (remove Templates section), `src/main.js` (build order + `resetAll` + ctx), `src/templates-user.js` (unaffected).
- [ ] Create `src/ui/templates-panel.js` `buildTemplatesPanel(ctx)` → `Panel { title:'Templates', side:'right', width:268 }`. Move the built-in template cards, user-template list (save/load/import/export/delete), Dark mode + Mono + Reset-look rows OUT of create-panel into here. At the TOP add a prominent `button('Reset map', () => { ctx.resetAll(); refreshAll(); ctx.syncDark?.() }, { accent:false, ghost:true })` with a confirm-tip.
- [ ] `create-panel.js`: delete the Templates section (`sTpl` and its content) — Create now starts at Colours.
- [ ] `src/main.js`: build `buildTemplatesPanel(ctx)` BEFORE `buildCreatePanel(ctx)` (Templates above Create in the right dock). Add `resetAll()` extending `resetLook()`: also reset background (`applyBackground` after clearing bgMode/bgEnv/colours to defaults), plinth/socle params, `terrainSurfaceMat=''` + `terrain.setMaterialMode('', params)`, liquid metal off, surfaceFx 0, clouds off, fog off, and Map-layer params (roadsEnabled/waterEnabled false, placesEnabled default, detail/opacity defaults) + `rebuildMapLayers()`. Expose `resetAll` + template ctx methods to the new panel.
- [ ] Verify; browser-check Templates panel above Create, Reset map clears everything (not location). Commit `feat(ui): Templates panel above Create + Reset map (full defaults)`.
- [ ] **Wave 2 deploy** after browser-verify.

---

## WAVE 3 — Shortcuts + history (D)

### Task 6: history module (pure, TDD)
**Files:** `src/history.js`, `test/history.test.js`.
**Interfaces:** `class History { constructor(getSnapshot, apply, {limit=50}); record(); undo(); redo(); canUndo(); canRedo() }` — `getSnapshot()` returns a deep clone; `record()` pushes if different from top (diff via JSON); `undo/redo` call `apply(snapshot)`.
- [ ] TDD `test/history.test.js`: record dedups identical snapshots; undo restores previous + returns it; redo re-applies; branching (record after undo clears redo); limit caps stack. Use plain objects + a stub apply. Register in package.json.
- [ ] Implement `src/history.js` (no THREE/DOM). Commit `feat: params undo/redo history module`.

### Task 7: shortcuts registry + binding + overlay + wiring
**Files:** `src/shortcuts.js` (new), `src/ui/shortcuts-overlay.js` (new), `src/main.js` (wire `bindShortcuts`, `applyAllParams`, history push points, top-bar button), `src/ui/bars.js` (top-bar keyboard button), `test/shortcuts.test.js`.
**Interfaces:** `SHORTCUTS: {id, keys:string[], label, category, run(ctx)}[]`; `matchShortcut(e): entry|null` (pure, tested — maps a KeyboardEvent-like `{code, key, ctrlKey, shiftKey}` to an entry, respecting modifiers); `bindShortcuts(ctx)`; `buildShortcutsOverlay()`.
- [ ] TDD `test/shortcuts.test.js`: `matchShortcut` maps `Numpad5`→top-down entry, `Ctrl+KeyZ`→undo, `Ctrl+Shift+KeyZ`→redo, plain `KeyR`→roads, and returns null for an unknown combo. Register in package.json.
- [ ] `src/shortcuts.js`: the locked SHORTCUTS list from the spec (numpad camera via `ctx.cameraPreset(name)`; Space `ctx.togglePlay()`; Esc `ctx.stopPlay()`; Ctrl+Z/redo `ctx.undo()/ctx.redo()`; H `ctx.toggleUI()`; D `ctx.toggleDark()`; F `ctx.reframe()`; `/` focus search; E `ctx.openExport()`; R/W/P/C/G `ctx.toggleLayer(id)`; I `ctx.toggleRegion()`; `?` `ctx.toggleShortcuts()`), + `matchShortcut` + `bindShortcuts(ctx)` (one keydown listener, inert on text-input focus).
- [ ] `src/ui/shortcuts-overlay.js`: renders `SHORTCUTS` grouped by category into a centered glass overlay; `?`/Esc/close-button toggle. Auto-updates because it reads the array.
- [ ] `src/main.js`: implement the ctx handlers (`cameraPreset` via `flyTo` with per-name poses incl. top-down; `togglePlay/stopPlay` bridging the tour/track fly; `undo/redo` via a `History` instance whose `apply = applyAllParams`; `toggleUI/toggleDark/reframe/openExport/toggleLayer/toggleRegion/toggleShortcuts`). Add `applyAllParams(params)` (the full apply pipeline). Call `history.record()` at committed-change points (wrap the panels' set handlers is heavy — instead record on a debounced global "params changed" hook: simplest is to `record()` after `refreshAll()`-triggering commits; document the chosen hook). Add the top-bar **keyboard button** (`src/ui/bars.js`) that calls `ctx.toggleShortcuts()`.
- [ ] Verify; browser-check every shortcut fires, overlay lists them + toggles, undo/redo works across a slider+colour+toggle. Commit `feat: keyboard shortcuts + self-updating overlay + undo/redo`.
- [ ] **Wave 3 deploy** after verify.

---

## WAVE 4 — Parcours (E)

### Task 8: Route panel scaffold + line width/colour + casing auto-contrast
**Files:** `src/ui/route-panel.js` (new) or extend camera/creation; `src/gpx.js`, `src/main.js` (params + ctx + build).
- [ ] Params: `gpxWidth:3, gpxColor:'' (=' accent'), gpxAutoContrast:true, gpxGradient:false, gpxGradientMode:'elevation', gpxGlow:false, gpxShimmer:false, gpxPoints:true, gpxStart:true, gpxEnd:true, gpxAltReadout:true, gpxSlopeReadout:false`. Add all to TEMPLATE_KEYS.
- [ ] `src/ui/route-panel.js` `buildRoutePanel(ctx)` → `Panel { title:'Route', side:'left' }` (or a section under Explore). Controls: Load GPX (reuse existing), Width slider, Colour, Auto-contrast toggle. Wire to `gpxLayer` setters + `gpxLayer.rebuild()`.
- [ ] `gpx.js`: `setWidth(v)`, `setColor(v)` (exists), and an **auto-contrast casing**: render a second wider line under the main line in the contrasting tone (dark-mode aware) when `gpxAutoContrast`. Depth/offset like the map casing.
- [ ] Verify + browser (load a GPX, width/colour/casing). Commit `feat(route): Route panel — width, colour, auto-contrast casing`.

### Task 9: Gradient along track + glow + shimmer
**Files:** `src/gpx.js`, `src/ui/route-panel.js`.
- [ ] Gradient: build the line with **per-vertex colours** (`LineGeometry.setColors`, `LineMaterial.vertexColors=true`) ramped by mode: `elevation` (min→max ele), `slope` (grade % → green/amber/red), `progress` (start→end hue). Toggle + mode select in the panel.
- [ ] Glow: an additive, wider, low-opacity duplicate line (or feed the bloom pass) behind the main line when `gpxGlow`.
- [ ] Shimmer: animate `LineMaterial` `dashOffset` (dashed + `dashSize/gapSize`) each frame for a flowing highlight when `gpxShimmer`; hook into the render loop tick.
- [ ] Verify + browser (each effect visibly toggles). Commit `feat(route): gradient / glow / shimmer line styling`.

### Task 10: Points, naming, start/finish, km markers
**Files:** `src/gpx.js`, `src/ui/route-panel.js`.
- [ ] Show/hide track points (`gpxPoints`) — small dots at decimated vertices. Start/finish markers each independently toggleable (`gpxStart`/`gpxEnd`). Km markers (tick + label every N km, density by zoom).
- [ ] Point naming: allow editing a waypoint's label (stored on the track; default elevation/km). A minimal inline editor from the panel or on click.
- [ ] Verify + browser. Commit `feat(route): points, naming, start/finish, km markers`.

### Task 11: Progressive reveal playback + animated alt/slope at the head
**Files:** `src/gpx.js`, `src/main.js` (playback tie to Space), `src/ui/route-panel.js`.
- [ ] Playback: a `play()`/`pause()`/`stop()` that advances a `headT` 0→1; render reveals the line up to the head (animate `Line2` draw range / `instanceCount`) with a **head marker** at the tip. Optional camera-follow (reuse `buildFlightCurve`).
- [ ] Readouts: at the head, show **altitude** (`gpxAltReadout`) and **slope %** (`gpxSlopeReadout`), each toggleable, as a small label beside the head; numbers **tween** as the head advances (ease between sampled track values). Profile cursor tracks the head.
- [ ] Wire `Space`/`Esc` (via the shortcuts ctx `togglePlay/stopPlay`) to route playback when a track is loaded.
- [ ] Verify + browser (reveal animates, head readouts animate, Space toggles). Commit `feat(route): progressive reveal playback + animated altitude/slope readouts`.
- [ ] **Wave 4 final browser-verify, whole-batch review (opus), deploy, push, memory.**

---

## Self-Review
**Coverage:** A→T1; B→T2/T3; C→T4/T5; D→T6/T7; E→T8–T11. ✓
**Placeholders:** none — feature GLSL/behaviour specified; the one soft spot is T2's GeoNames zip fetch (fallback documented) and T7's history-record hook (choose + document).
**Types:** `popToMinZoom`(T2)↔test; `History`(T6)↔`apply=applyAllParams`(T7); `matchShortcut`/`SHORTCUTS`(T7)↔overlay(T7)↔test; gpx params consistent across T8–T11.
**Heavy/risky:** T7 (shortcuts+history wiring into main.js), T11 (reveal + tweened readouts). Browser-verified per wave. Deploy after each wave.
