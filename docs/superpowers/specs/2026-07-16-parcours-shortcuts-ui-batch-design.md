# Parcours + shortcuts + UI + routes/places batch — design

**Date:** 2026-07-16
**Status:** approved ("go pour tout"), awaiting implementation plan
**Scope:** Five independent sub-projects (A–E) + a keyboard-shortcut system with a
self-updating overlay. Sequenced quick→heavy in the plan.

---

## A — Routes polish

1. **Casing toggle.** New `params.roadsCasing` (default `true`). A toggle in the Map
   panel Roads section. `roads-layer.js` passes `casing: params.roadsCasing ? casingColour : null`
   to `buildLineSegments` (which already gates on `if (casing)`), so the contrasting
   outline can be turned off.
2. **Far-view detail by rank.** The existing 3-notch `roadsDetail` currently only
   affects the OSM (zoomed) tier. Make it ALSO filter the Natural Earth far tier by
   `scalerank`: notch 0 → `scalerank ≤ 7` (major), notch 1 → `≤ 9` (+ secondary/national),
   notch 2 → all. So at distance a higher notch reveals secondary roads. `roads.json`
   already carries `scalerank`; add the filter in `roads-layer.js`'s NE branch.

## B — Progressive city names (GeoNames)

Replace the Natural-Earth-only `places.json` with a **GeoNames**-derived set so names
reveal progressively by zoom down to villages.
- Build step (`scripts/build-mapdata.mjs` or a new `build-places.mjs`): fetch GeoNames
  `cities1000`/`cities5000` (TSV, CC-BY), emit compact `[name, lat, lon, pop, cap, min_zoom]`
  where **`min_zoom` is derived from population** (big cities low min_zoom, villages high)
  and capitals promoted. Sorted by population desc. Keep it well-bounded (~1–2 MB).
- `places-layer.js`: keep `pickPlaces` (zoom-tiered + declutter); widen `maxN(zoom)` so
  density grows further as you zoom in (more small towns appear).
- **Attribution:** show "© GeoNames (CC BY 4.0)" in the map credit (reuse the OSM-credit
  DOM pattern) whenever the Places layer is on.

## C — UI restructure

1. **Camera → left dock, under Scan.** Change `buildCameraPanel` to `side: 'left'` and
   build it AFTER the Scan panel so it docks directly below Scan. Right dock keeps
   Create / Shaders / Map. (Panels keep the exclusive-accordion behaviour per dock.)
2. **Templates → its own panel, above Create.** Extract the Templates section out of
   `create-panel.js` into a new `src/ui/templates-panel.js` (`Panel { title: 'Templates',
   side: 'right' }`), and build it BEFORE Create so it sits above it. Move the built-in +
   user templates, save/load, dark-mode + mono + reset rows into it.
3. **"Reset map" at the top of Templates.** A prominent button = a full **`resetAll()`**:
   extends the existing `resetLook()` to also reset background (solid + gradient + HDRI),
   plinth/socle, relief material (→ topographic), liquid metal, surface shader, clouds,
   fog, and the Map layers (roads/water/places back to defaults) — every look/param to its
   frozen default. Location/zoom are NOT reset (that's navigation, not a "look").

## D — Keyboard shortcuts + self-updating overlay

**Single source of truth** `src/shortcuts.js` exporting `SHORTCUTS: { id, keys:[…],
label, category, run(ctx) }[]`. A `bindShortcuts(ctx)` attaches ONE `keydown` listener
that matches events to entries and calls `run(ctx)` — **inert when the focus is a text
input/textarea/contenteditable**. The help **overlay renders from the same array**,
grouped by `category`, so adding an entry updates both the binding and the panel.

**Button/overlay:** a keyboard icon in the top bar (next to the help "?") toggles a
centered overlay listing all shortcuts by category; `?` also toggles it; Esc closes.

**The set (locked):**
- Camera (numpad, spatial layout): `Num5` top-down; `Num8/2/4/6` N/S/W/E; `Num7/9/1/3`
  iso corners NW/NE/SW/SE; `Num0` default iso home; `Num+/Num-` dolly in/out. (All via `flyTo`.)
- Playback: `Space` play/pause fly-along/automation; `Esc` stop/return.
- History: `Ctrl+Z` undo; `Ctrl+Shift+Z` / `Ctrl+Y` redo.
- View/UI: `H` hide/show UI; `D` dark mode; `F` reframe/home; `?` shortcuts help.
- General: `/` focus search; `E` export.
- Layer toggles (power-user): `R` roads, `W` water, `P` places, `C` contours, `G` grid,
  `I` isolate-the-zone.

**Undo/redo (full history).** New `src/history.js`: a bounded stack of deep-cloned
`params` snapshots. `pushHistory()` is called on **committed** changes (slider `change`,
toggle/colour/select) — debounced so a drag is one entry; snapshots are diffed so no-ops
don't push. `undo()`/`redo()` restore a snapshot and re-apply via a single
`applyAllParams(params)` that runs the existing apply pipeline (palette/style/light/
surface/look/background/plinth/material/layers) — the same set `applyUserTemplate` uses,
extended to the full param surface. UI controls refresh via `refreshAll()`.

## E — Parcours (GPX) section

Rename/relocate the GPX instruments into a first-class **"Route"** panel (English UI;
"Parcours" in FR copy) and extend the existing `GpxLayer`. The layer already has:
draping, an elevation-profile strip, a hover cursor with altitude/km/grade, a
Catmull-Rom fly-along, and start/end/waypoint sprites — we expose these as controls and
add the requested styling + playback.

**Panel controls (Route):**
- **Line width** (`gpxWidth`) and **colour** (`gpxColor`).
- **Gradient along the track** (`gpxGradient` on/off + mode `elevation | slope | progress`):
  a per-vertex vertex-colour ramp on the `Line2`/`LineSegments2` geometry.
- **Auto-contrast** (`gpxAutoContrast`, default on): a contrasting casing/halo under the
  line whose tone follows dark-mode + local map luminance, so the track stays legible on
  any terrain (reuse the map casing idea).
- **Track points** show/hide (`gpxPoints`) + **name points** (editable waypoint labels;
  start with elevation/km, allow custom text stored on the track).
- **Start / finish markers** show/hide independently (`gpxStart`, `gpxEnd`).
- **Glow** (`gpxGlow`): additive bloom halo around the line (a second, wider, additive,
  low-opacity line, or a bloom pass contribution).
- **Shimmer** (`gpxShimmer`): an animated dashed/flow highlight travelling along the line
  (dash offset animated per frame).
- **Elevation readout** (`gpxAltReadout`) and **slope/gradient readout** (`gpxSlopeReadout`),
  each toggleable — shown next to the **moving head** during playback, numbers **animating**
  (tweened) as the head advances.

**Progressive reveal / playback.** A play mode reveals the line as a **head** travels
along it (the drawn portion grows from start to head; the fly-along camera can follow).
Implement by animating the `Line2` draw range (or a per-frame `instanceCount`/`gl.drawRange`)
0→N with the head marker at the tip; `Space` toggles play/pause (ties into the shortcut).
The alt/slope readouts and the profile cursor track the head.

**Tasteful additions (curated, from route-viz best practice — kept minimal):**
- **Km markers** (small tick + label every N km, density by zoom).
- **Grade colouring** as one of the gradient modes (green→amber→red by slope %).
- A **soft drop-shadow of the line on the terrain** when glow is off (premium, cheap).

**Data.** `parseGpx` already yields `{lat,lon,ele}`; derive distance (haversine, present),
grade (present), and smooth elevation noise for the readouts. Time/HR/power are often
absent in bare GPX — features depending on them are out of scope for v1 (gradient modes
use elevation/slope/progress only).

---

## Shortcut registry (shared by D)
`src/shortcuts.js` is the single list; `src/ui/shortcuts-overlay.js` renders it; the top-bar
button + `?` toggle it. Future shortcuts = one array entry, overlay auto-updates.

## Testing
- Pure `node --test`: NE road scalerank→notch filter; GeoNames population→min_zoom
  mapping; history push/undo/redo diffing (snapshot equality/no-op suppression); shortcut
  key-matching (event → entry) ignoring text-input focus.
- Browser: casing toggle; far-view notch reveals secondary roads; villages appear on zoom
  + GeoNames credit; Camera under Scan; Templates panel above Create + Reset map clears
  everything; every shortcut fires + overlay lists them + auto-updates; undo/redo across a
  slider/colour/toggle; Route panel — width/colour/gradient/glow/shimmer/points/markers,
  progressive reveal with animated alt+slope at the head.

## Sequencing (plan)
A (routes) → B (places) → C (UI restructure) → D (shortcuts + history) → E (Parcours),
deploying after logical chunks. D's `history.js` and E's playback share the `Space`/`Esc`
playback control.
