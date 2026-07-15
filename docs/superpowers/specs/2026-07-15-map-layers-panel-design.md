# "Map" panel — cartographic layers over the relief (SP1)

**Date:** 2026-07-15
**Status:** design, awaiting implementation plan
**Scope:** Sub-project 1 of 2. This spec covers the layer framework + the worldwide
Natural Earth tier only. The detailed OSM tier (Overpass, then Protomaps PMTiles)
is SP2 and is explicitly out of scope here — but the interfaces below leave a clean
seam for it.

---

## 1. Goal

Add a dedicated **"Map"** panel that gathers everything that displays *as information
on top of the map* into toggleable layers, each draped onto the 3D relief:

- **Roads** (Natural Earth, styled by class)
- **Rivers & water** (rivers, lakes, coastline)
- **Places** (multi-tier place names by zoom — absorbs the existing city labels)
- **Relocated from "Map style":** contours, grid, summit markers, spot elevations

Everything hugs the relief (never sinks under the surface) with **realistic occlusion**
(a foreground mountain can hide what's behind it — the user's chosen behaviour). Place
names use the existing serif face (Rosarivo / Georgia).

### Non-goals (SP1)
- OSM street-level detail (Overpass / PMTiles) → SP2.
- Borders/admin, railways, land-use, POIs → later.
- Any paid tile key or external hosting infra.

---

## 2. Data sources (verified)

All SP1 data is **Natural Earth — public domain, no attribution required.**

| Layer | Natural Earth file(s) | Useful fields |
|---|---|---|
| Rivers | `ne_10m_rivers_lake_centerlines` (+`_europe`, `_north_america`) | `scalerank`, `min_zoom`, `name` |
| Lakes | `ne_10m_lakes` | `scalerank`, `min_zoom`, `name` |
| Coastline | `ne_10m_coastline` | `scalerank`, `min_zoom` |
| Roads | `ne_10m_roads` | `scalerank`, `type`, `min_zoom` |
| Places | `ne_10m_populated_places` (already shipped, will extend) | `min_label`, `pop_max`, `featurecla`, `scalerank` |

GeoJSON mirror: `github.com/nvkelso/natural-earth-vector` (or `martynafford/natural-earth-geojson`).

### Build-time pipeline
A Node script `scripts/build-mapdata.mjs`:
1. Reads the Natural Earth GeoJSON (50m for coarse, 10m for detail where useful).
2. Drops all properties except the ones above.
3. Quantizes coordinates to 5 decimals (~1 m).
4. Emits compact JSON to `public/data/map/`: `rivers.json`, `lakes.json`,
   `coastline.json`, `roads.json`, and an extended `places.json` (multi-tier,
   supersedes `cities.json`).

Target: **per-file budgets** (roads ≤ ~2 MB, rivers/lakes/coastline ≤ ~500 KB, places ≤
~300 KB — global vertex density makes a single "< 1 MB total" impractical without the
per-tile fetching that is SP2's job), each file lazy-fetched on first use of its layer
(never in the JS bundle) and cached — same discipline as today's 73 KB `cities.json`.
Geometry is Douglas–Peucker–simplified at build time to hold these budgets.

---

## 3. Architecture

New subsystem under `src/map/`, mirroring the proven `cities.js` pattern (async
rebuild guarded by a build id, dispose on rebuild, height-sampled draping):

- **`src/map/layer-manager.js`** — `MapLayers` class. Owns the layer instances, exposes
  `rebuild({ dem, terrain, params })` (called on every zone/zoom load, where
  `cityLabels.rebuild` is called today), `setLayerVisible(id, v)`, `setOpacity(id, v)`,
  and a `dispose()`.
- **`src/map/geo-data.js`** — fetch + cache each `public/data/map/*.json`; provide
  `clipToPatch(features, dem)` (bbox test in lat/lon) and `filterByZoom(features, z)`
  (using `min_zoom`/`scalerank`). Pure, unit-testable.
- **`src/map/draped-line.js`** — `drapeLine(latlonPts, { dem, terrain, offset })`:
  converts each point via `latLonToWorld`, **densifies** segments longer than the DEM
  sample spacing (so a line follows the hill between two far vertices instead of cutting
  through it), samples `terrain.sample(x,z)`, returns a `THREE.BufferGeometry` of world
  positions raised by `offset`. Pure geometry (takes a `sample` fn), unit-testable.
- **`src/map/roads.js`, `water.js`, `places.js`** — per-layer build: load → clip →
  filter by zoom → build draped geometry / labels → add to the layer group.

### Data-provider seam (for SP2)
`MapLayers` reads features through a `DataProvider` interface
(`getRoads(bbox, zoom)`, `getWater(...)`, `getPlaces(...)`). SP1 ships a single
`NaturalEarthProvider`. SP2 adds `OverpassProvider` / `PMTilesProvider`, chosen by zoom
inside the manager — no layer-code changes.

### Reused existing hooks
- `latLonToWorld(dem, lat, lon)` and `terrain.sample(x, z)` (draping).
- The serif canvas-label helper from `cities.js` (extracted into a shared
  `src/map/text-label.js` so roads/places/labels reuse it).
- The panel/section/toggle/slider UI kit (`src/ui/kit.js`, `shell.js`).

---

## 4. Rendering & occlusion

**Lines (roads, rivers, coastline):** `Line2` / `LineMaterial` (three `examples/jsm/lines`)
so width can vary **by class** (motorway thicker/lighter, secondary thinner) —
`LineBasicMaterial.linewidth` is ignored on most platforms, so fat lines are required for
the "par classe" weighting. `depthTest: true`, `depthWrite: false`, a small `renderOrder`
so lines sit just above the surface. The `LineMaterial.resolution` uniform is updated on
resize.

**Water bodies (lakes):** draped outline (same as lines) + an optional faint filled
polygon (triangulated, height-sampled) at low opacity. SP1 default: outline only, fill
behind a per-layer option.

**Places (labels):** serif canvas-texture planes (Rosarivo/Georgia), laid flat and
height-sampled, **depth-tested** (realistic occlusion). Multi-tier by zoom using
`min_label` / `pop_max` to gate appearance and `scalerank` / `pop_max` to rank; a
world-space spacing pass declutters (as `cities.js` already does). Count scales with
`demZoom`.

**"Hugs the relief, never sinks, realistic occlusion":** every draped vertex/label sits
at `terrain.sample + offset` (never below the surface) with normal depth testing. To keep
the whole system consistent, **`cities.js` is switched from its current `depthTest:false`
(x-ray) to depth-tested** and folded into the Places layer.

### Contrast & legibility (dark mode + low-contrast map)
Info must never disappear into the map — neither in dark mode nor over a low-contrast
region (a pale plateau, a busy material, a mid-tone hypsometric band).

1. **Dark-mode ink.** Every layer's ink follows the theme — light ink on dark, dark ink
   on light — extending the rule `cities.js` already uses
   (`ink = params.darkMode ? '#e8e2d4' : '#2e2820'`). A dark-mode toggle re-inks the whole
   Map layer set (rebuild), like the existing labels/cartouche.
2. **Contrast halo / casing (the real guarantee).** Independent of theme, every info
   element carries a contrasting outline in the *opposite* tone so it reads over any map
   colour: place labels get a soft text halo (light halo around dark text, dark halo around
   light text) drawn on the canvas texture; lines (roads/rivers/coastline) get a thin
   **casing** — a slightly wider underline stroke in the opposite tone rendered just beneath
   the coloured line. This is the standard cartographic technique and makes the layers
   legible even where the map/relief contrast is weak. The halo/casing tone flips with dark
   mode along with the ink.

---

## 5. UI — the "Map" panel

New `src/ui/map-panel.js` builds a `Panel { title: 'Map', side: 'right' }` (same grammar
as Shaders/Camera), with accordion sections:

- **Roads** — toggle + opacity. (Classes auto-styled; no per-class toggles in SP1.)
- **Water** — toggle + opacity (+ "lake fill" option).
- **Places** — toggle + density/opacity. Replaces the old "City labels" toggle.
- **Contours & grid** — the existing contour interval/opacity/weight + grid size/opacity
  sliders, **moved here** from create-panel's "Map style".
- **Markers** — Summit markers + Spot elevations, **moved here**.

`src/ui/create-panel.js` "Map style" keeps only the true map-*rendering* controls
(hypsometric tint, height contrast/pivot, slope shading); the info-overlay controls move
out to the Map panel.

### Params & state
Add `params`: `roadsEnabled`, `roadsOpacity`, `waterEnabled`, `waterOpacity`,
`waterFill`, `placesEnabled` (migrates the old `cityLabels`), `placesDensity`. Contour/grid/
peaks params are unchanged (only their UI moves). The relevant new toggles/opacities join
`TEMPLATE_KEYS` so a saved look restores which layers are on (the underlying geodata is
re-derived from the current location).

---

## 6. Testing

`node --test` units (pure, no DOM/WebGL):
- `geo-data`: bbox clip keeps/drops the right features; zoom filter respects `min_zoom`;
  coordinate trimming precision.
- `draped-line`: densification subdivides long segments; output Y equals the sampled
  height + offset for a stubbed `sample`.
- `places` tiering: correct feature set per zoom band; declutter spacing removes
  overlaps.

Manual in-browser verification: layers toggle on/off, drape correctly on a mountainous
patch (no floating/sinking), labels stay legible and occlude realistically, panel controls
moved cleanly, no regression in the existing city labels.

---

## 7. SP2 preview (not built here)

Detailed OSM tier behind the same `DataProvider` seam: `OverpassProvider` (live bbox fetch,
debounced + cached, enabled past ~z10) first — no infra; then `PMTilesProvider` (Protomaps
regional extract on R2/S3) for scale. Turning the OSM tier on adds a visible
"© OpenStreetMap contributors" attribution. None of this changes SP1's layer or UI code.
