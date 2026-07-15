# "Map" panel SP2 — full-detail OSM roads & waterways, clipped to the block

**Date:** 2026-07-15
**Status:** design, awaiting approval
**Scope:** Sub-project 2 of the Map layers feature. Adds a detailed OpenStreetMap
tier for the Roads and Rivers-&-water layers, and clips all draped lines to the
block footprint. Builds on SP1 (shipped) behind its `DataProvider` seam.

---

## 1. Goal & hard constraints

Two user constraints are **non-negotiable and drive the whole design**:

1. **Full fidelity — no simplification.** OSM roads and waterways are displayed
   exactly as they are, no Douglas–Peucker, no generalization, **even if heavy**.
   → This rules out Protomaps/OpenMapTiles (pre-generalized per zoom). The source
   is **Overpass** (raw OSM geometry).
2. **Nothing leaves the block.** Roads and waterways must **never** extend outside
   the block footprint. → All draped lines are **geometrically clipped** to the
   block (slab superellipse, and the region cutout when region mode is on). This
   clip applies to **both** tiers (it also fixes SP1's edge spill).

Secondary decisions (confirmed):
- **Activation: automatic by zoom.** When zoomed in past a threshold, Roads/Water
  switch from the Natural Earth tier (SP1) to the OSM tier automatically; zoomed
  out they stay on Natural Earth.
- **Source: public Overpass** (`overpass-api.de`) with per-zone cache, debounce,
  and quota/error handling; endpoint is a const so a self-hosted instance can be
  swapped in later.
- **Region-cutout clipping included** (clip to the country silhouette when region
  mode is active), via CPU sampling of the region mask canvas.

### Non-goals (SP2)
- Protomaps/PMTiles hosting (rejected — pre-generalized).
- OSM layers beyond roads + waterways (no buildings/landuse/rail).
- Offline/bundled OSM.

---

## 2. Architecture

Everything hangs off SP1's existing seam — the single
`mapLayers.rebuild({dem, terrain, params})` entry and the per-layer `rebuild`.

### New modules (`src/map/`)
- **`overpass.js`** — `fetchOverpassLines(bbox, kind, opts)` where `kind ∈ {'roads','water'}`.
  Builds an Overpass QL query (`way["highway"]` / `way["waterway"]` within the
  bbox, `out geom`), fetches from a configurable `OVERPASS_URL`, parses to
  features (each = a full-resolution `[lon,lat][]` polyline + a `kind`/class
  tag). **No coordinate reduction.** Caching by rounded-bbox key, in-flight
  dedup, and a minimum request interval (mirrors `region-mask.js` Nominatim
  discipline). Returns `{features}` or `null` on failure/timeout. Pure of THREE.
- **`block-clip.js`** — the "never leaves the block" core, all pure & unit-tested:
  - `makeInsideBlock(terrain, regionSampler)` → `insideBlock(x,z): boolean`.
    When `uRegionOn`, samples `regionSampler(x,z)` (region mask, ≥0.5 = inside)
    **and** the slab; otherwise the slab superellipse from `uSlabHalf`,
    `uSlabCorner`, `uSlabCornerN` (identical math to the terrain shader's footprint
    discard).
  - `clipPolylineToBlock(worldPts, insideBlock, step)` → `{x,z}[][]` — densifies,
    tests each point, splits into contiguous **inside-runs**, and **bisects the
    segment at each boundary crossing** (≈6 iterations) so a run ends exactly on
    the footprint edge — nothing spills past it.
- **`line-segments.js`** — `buildLineSegments(runs, sample, style)` returning a
  batched object: all runs' segments packed into **one `LineSegments2`**
  (`three/examples/jsm/lines/LineSegments2.js` + `LineSegmentsGeometry`) for the
  ink, over one for the casing. This keeps draw calls to ~2 per layer even with
  thousands of full-detail OSM segments — batching, **not** simplification.

### Region sampler (for country-cutout clipping)
`main.js` already receives the region mask **canvas** from
`region-mask.js fetchRegionMask`. Capture its `ImageData` once when the mask is
set, and expose `terrain.regionSample(x,z)` (or pass a sampler into
`mapLayers.rebuild`) that maps world XZ → mask pixel
(`uv = xz/TERRAIN_SIZE + 0.5`) and returns the red channel /255. When no region
mask is active it returns 1 (everything inside → slab-only clip governs).

### Layer changes (`roads-layer.js`, `water-layer.js`)
`rebuild` gains a **tier switch**:
```
const useOsm = params.demZoom >= OSM_MIN_ZOOM   // e.g. 12, tunable
const feats = useOsm ? await fetchOverpassLines(bbox, kind) : <NE loadLayer path>
```
Both tiers then go through the **same** pipeline: project each ring to world →
`clipPolylineToBlock(...)` → collect runs → `buildLineSegments(runs, ...)`. So
the block clip and batching apply to Natural Earth too (fixing SP1 spill). The
build-id supersede guard and dispose-on-supersede stay. On OSM fetch failure the
layer falls back to the Natural Earth tier for that patch (never blank).

### Manager / UI / attribution
- `MapLayers` exposes whether any layer is currently showing OSM data + a
  loading flag; it toggles a small **"© OpenStreetMap contributors"** credit
  element (bottom corner) whenever OSM data is on screen (ODbL requirement) and a
  subtle **loading indicator** while Overpass is in flight.
- No new Map-panel controls are required (activation is automatic); an optional
  read-only status line ("Détail OSM · chargement…/actif") may be added.

---

## 3. Performance & correctness

- **Heavy is accepted.** Full-detail OSM for a patch can be thousands of ways.
  Draw-call blow-up is contained by `LineSegments2` batching (≈2 objects/layer),
  not by dropping data. If a query is very large, Overpass may be slow — the
  loading indicator + cache cover this; no truncation.
- **Bbox = the block, slightly padded.** Query only the patch bbox (from
  `patchBounds`), and since everything is clipped to the block, off-block ways are
  discarded client-side. This keeps the query as small as the constraint allows.
- **Quota discipline:** cache by zone, dedupe in-flight, min interval between
  hits, graceful fallback on 429/503/timeout. Endpoint swappable for self-hosting.
- **Clip exactness:** bisection at crossings guarantees run endpoints sit on the
  footprint (≤ epsilon), so "jamais hors du block" holds for the rounded slab and
  the region silhouette alike.

---

## 4. Testing

`node --test` (pure):
- `block-clip`: `insideBlock` superellipse matches known inside/outside points;
  `clipPolylineToBlock` splits a line crossing the boundary into the right runs
  and the crossing point lands on the edge (within epsilon); a fully-inside line
  passes through unsplit; a fully-outside line yields no runs.
- `overpass`: QL query string for roads vs water is well-formed for a bbox; the
  response parser turns Overpass `geometry` arrays into full `[lon,lat][]`
  features without dropping vertices; cache key rounding.

Browser-verified: at a city patch past the threshold, dense OSM roads+waterways
render at full detail, **clipped exactly to the block edge** (nothing spills),
draped on relief; region-cutout mode clips to the country silhouette; the OSM
credit shows; zooming back out returns to the Natural Earth tier; a failed/slow
Overpass call falls back to NE without blanking.

---

## 5. Files

- Create: `src/map/overpass.js`, `src/map/block-clip.js`, `src/map/line-segments.js`
- Modify: `src/map/roads-layer.js`, `src/map/water-layer.js` (tier switch + clip +
  batched build), `src/map/layer-manager.js` (OSM-on / loading state + credit),
  `src/main.js` (region sampler capture; credit + loading DOM; `OSM_MIN_ZOOM`
  wiring), `src/terrain.js` (expose `regionSample` or the mask ImageData)
- Tests: `test/block-clip.test.js`, `test/overpass.test.js`
- Attribution: a small credit element (in `index.html` or created in `main.js`)
