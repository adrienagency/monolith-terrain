# Roads detail + labels + realistic rivers — plan

> subagent-driven-development. Work in **C:\Dev\monolith-terrain** (feat/orbital-globe); `cd` first; stage only edited files; register new tests in package.json; verify node --check + node --test + vite build each task; browser-verify per wave.

## Global constraints
- Roads full fidelity preserved; OSM threshold varies with the detail notch, never simplifies.
- City labels float ABOVE summits (never occluded/merged with rock), sized by population, readable at any zoom; serif + halo kept; declutter kept.
- Rivers clearly BLUE with realistic varying width (NE strokeweight far; OSM water-area polygons zoomed). ODbL credit already handled.
- Vanilla JS ESM; pure logic tested.

### Task 1 (R1): Road OSM tier by detail notch
**Files:** `src/map/roads-layer.js`.
- [ ] Replace `const useOsm = zoom >= OSM_MIN_ZOOM` with `const osmThreshold = params.roadsDetail >= 2 ? 10 : params.roadsDetail >= 1 ? 11 : 12; const useOsm = zoom >= osmThreshold`. Keep `OSM_MIN_ZOOM` export (used by water-layer) = 12.
- [ ] Verify; commit `feat(map): road OSM detail tier scales with the detail notch`.

### Task 2 (R3): NE rivers — width by strokeweight + blue
**Files:** `scripts/build-mapdata.mjs`, generated `public/data/map/rivers.json` (+ lakes/coastline unchanged), `src/map/water-layer.js`, `src/map/river-width.js` (pure) + `test/river-width.test.js`.
- [ ] `scripts/build-mapdata.mjs`: for rivers, source **NE 10m** rivers_lake_centerlines (+ `_europe`,`_north_america` supplements if easily fetchable) and KEEP `strokeweight` (aka `strokeweig`) in the trimmed props alongside name/min_zoom/scalerank/kind. Regenerate `rivers.json` (gentle epsilon; expect more features than 461). Keep lakes/coastline as-is.
- [ ] `src/map/river-width.js`: `export function riverWidthPx(strokeweight){ const s = Math.max(0, Math.min(9, strokeweight ?? 2)); return 0.8 + (s/9)*2.4 }`. TDD `test/river-width.test.js` (0→0.8, 9→3.2, missing→~1.3). Register.
- [ ] `src/map/water-layer.js`: rivers use `riverWidthPx(f.properties.strokeweight)` per feature instead of a flat 1.4; ink clearly blue `params.darkMode ? '#7fb2d6' : '#2b7fc4'`; lakes/coastline same blue (their own widths). Keep casing/clip/batch — but note batching by ONE width per LineSegments2 means you must **group river runs by width bucket** (round strokeweight to a few buckets) and build one LineSegments2 per bucket, so widths actually vary. Implement bucketed builds for rivers.
- [ ] Verify; commit `feat(map): rivers blue with natural width from Natural Earth strokeweight`.

### Task 3 (R2): Floating city labels above summits, sized by population
**Files:** `src/map/places-layer.js`, `src/map/place-scale.js` (pure) + `test/place-scale.test.js`.
- [ ] `src/map/place-scale.js`: `export function labelScale(pop, capital){ const p = Math.max(0, pop||0); const s = 0.7 + Math.min(1.6, Math.log10(p+10)/7*1.6); return capital ? s*1.25 : s }` (bigger pop → bigger, capitals bump). TDD `test/place-scale.test.js` (monotonic in pop; capital > non-capital same pop; bounded). Register.
- [ ] `places-layer.js` rebuild: compute `patchMaxY` = max terrain height over a coarse grid of the patch (or track from the DEM). For each pick: build an **upright billboard Sprite** from `makeLabelTexture(name…)` (reuse it), `sprite.material.depthTest=false; depthWrite=false; sprite.renderOrder=30`. Position at `(w.x, Math.max(terrain.sample(w.x,w.z), patchMaxY) + clearance, w.z)`. Set `sprite.scale` from `labelScale(pop,cap)` × a base (× aspect for x). Add a small ground **dot** (depthTest:false, at terrain height) + a thin **leader line** from the dot up to the label base. Keep the zoom-tier (min_zoom) + declutter. Remove the old flat-plane label.
  - Readability at zoom: sprites are world-scaled; to keep them from shrinking too much when far, either leave size-attenuation on with a generous base, OR set `sprite.material.sizeAttenuation=false` and scale in screen units — pick the one that keeps them readable pulled-back (test in browser; the spec wants "bigger when far" = don't shrink). Default: sizeAttenuation off + screen-space scale by `labelScale`, clamped.
- [ ] Verify; commit `feat(map): floating city labels above summits, sized by population`.
- [ ] **Deploy R1–R3** after browser-verify (roads at 73km, blue varied rivers, floating pop-sized labels above peaks).

### Task 4 (R4): OSM water-area polygons (realistic river width, zoomed)
**Files:** `src/map/overpass.js` (+ test), `src/map/water-polygon.js` (pure triangulate/drape helper) + test, `src/map/water-layer.js`.
- [ ] `overpass.js`: `export async function fetchOverpassAreas(bbox, opts)` querying `(way["natural"="water"](bbox); way["waterway"="riverbank"](bbox); relation["natural"="water"](bbox););out geom;` → parse to polygons: each way with a closed geometry → one outer ring `[lon,lat][]`; relations → their outer member ways (use `out geom` member geometry). Return `{ rings: [[lon,lat][]] }[]` (holes optional/ignore for v1). Cache/throttle like `fetchOverpassLines`; key includes 'areas'. Add `buildAreaQuery(bbox)` (pure) + test (well-formed).
- [ ] `src/map/water-polygon.js`: `export function drapeFilledPolygon(ringWorldPts, sample, insideBlock, offset)` → use `THREE.ShapeUtils.triangulateShape(contour, [])` on the XZ contour to get triangle indices, drape each vertex (`y=sample+offset`), drop triangles whose centroid is outside `insideBlock`, return `{positions:Float32Array, index}`. (Pure of DOM; imports THREE. If THREE import blocks node --test, keep the triangulation call in the layer and unit-test only a small pure `centroidInside` helper.) Prefer: put the THREE-dependent build in the layer, and unit-test a pure `polygonRingsFromWay(geom)` in overpass.js.
- [ ] `water-layer.js`: when `useOsm` (z≥12), also `fetchOverpassAreas(bounds)`; for each polygon ring → world pts → `drapeFilledPolygon` → a filled blue `MeshBasicMaterial` mesh (`color` = the river blue, `transparent:true, opacity: params.waterOpacity, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1`), added to the water group + disposed on rebuild. This gives real varying-width rivers. Keep the waterway LINES for streams. Fallback on area-fetch failure = lines only.
- [ ] Verify (node --check, tests, build) + **browser-verify at a big-river city (e.g. a Rhine/Rhône town) z≥12**: filled river band with realistic width. Commit `feat(map): OSM water-area polygons for realistic river width (zoomed)`.
- [ ] **Final review (opus), deploy, push, memory.**

## Self-review
Coverage: R1→T1, R3→T2, R2→T3, R4→T4. Pure tests: river-width, place-scale, overpass area query/parse. Heavy/risky: T3 (billboard readability tuning), T4 (polygon triangulate + drape + Overpass areas) — browser-verified. Deploy R1–R3 first, then R4.
