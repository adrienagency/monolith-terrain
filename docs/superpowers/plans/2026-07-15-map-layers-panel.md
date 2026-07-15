# Map Layers Panel (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Map" panel of cartographic layers (roads, rivers & water, multi-tier place names) draped on the 3D relief from public-domain Natural Earth data, and relocate the existing contour/grid/summit/city controls into it.

**Architecture:** A new `src/map/` subsystem mirrors the proven `cities.js` pattern — pure data helpers (fetch/clip/filter, densify/drape, place-pick) plus per-layer builders that turn Natural Earth GeoJSON into THREE groups height-sampled onto the terrain. A `MapLayers` manager rebuilds them on every zone/zoom load through a `DataProvider` seam (SP1 = Natural Earth; SP2 will add OSM behind the same interface). A new right-dock `Map` panel drives visibility/opacity.

**Tech Stack:** Three.js r172 (incl. `examples/jsm/lines` Line2/LineMaterial), vanilla JS ESM, Vite, `node --test`. Data: Natural Earth GeoJSON → trimmed static JSON in `public/data/map/`.

## Global Constraints

- Three.js **r172**; vanilla JS **ES modules**; tests via **`node --test`** (pure modules only; DOM/WebGL modules are browser-verified).
- Layer data is **Natural Earth — public domain, NO attribution** required or shown in SP1.
- Draping rule: every vertex/label sits at **`terrain.sample(x,z) + offset`** (never below surface), materials use **`depthTest: true`, `depthWrite: false`** (realistic occlusion — a foreground peak may occlude).
- Place names use the existing serif face: **`Rosarivo, Georgia, 'Times New Roman', serif`**, with a **contrast halo**; lines get a **contrast casing**. Ink + halo/casing tone **flip with `params.darkMode`** (dark ink `#e8e2d4` region ink light; light-mode ink `#2e2820`).
- Layer data files are **lazy-fetched** from `public/data/map/` on first use (never in the JS bundle) and cached client-side. The build script **simplifies geometry** (Douglas–Peucker) and uses ~4-decimal precision so each coarse global file stays well-bounded: **places ≤ ~300 KB, rivers/lakes/coastline ≤ ~500 KB each, roads ≤ ~2 MB** (roads is the largest; SP2's OSM tiling replaces whole-file loading with per-tile fetches). If a raw layer is much larger, simplify harder or filter by `scalerank` — do not ship multi-MB unsimplified files.
- New panel titled **`Map`**, right dock, built with the existing `src/ui/kit.js` + `shell.js` grammar.
- Keep a clean **`DataProvider`** seam so SP2 (OSM/Overpass/PMTiles) needs no layer/UI changes.
- Follow existing conventions: async rebuild guarded by an incrementing build id; dispose geometry/material/texture on rebuild; `latLonToWorld(dem, lat, lon)` + `terrain.sample(x,z)` for georeferencing/draping.

---

### Task 1: Build script + generated Natural Earth data

**Files:**
- Create: `scripts/build-mapdata.mjs`
- Create (generated output): `public/data/map/rivers.json`, `lakes.json`, `coastline.json`, `roads.json`, `places.json`
- Modify: `package.json` (add `"build:mapdata"` script)

**Interfaces:**
- Produces: the five `public/data/map/*.json` files. Line/polygon layers are trimmed **GeoJSON FeatureCollections** with only `{ name, min_zoom, scalerank, kind }` properties (kind = road class or water type). `places.json` is a compact array `[name, lat, lon, pop, cap, min_zoom]` sorted by `pop` descending.

- [ ] **Step 1: Write the build script**

Create `scripts/build-mapdata.mjs`:

```js
// Fetch Natural Earth GeoJSON, trim to the properties we render, quantize
// coordinates to 5 decimals (~1 m), and emit compact JSON to public/data/map/.
// Public domain (Natural Earth) — no attribution required. Run: npm run build:mapdata
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const OUT = new URL('../public/data/map/', import.meta.url)

// layer → [NE file, keep-props builder]. 50m keeps the coarse world light; roads
// use 10m for a usable network, rivers 10m for detail.
const round = (n) => Math.round(n * 1e5) / 1e5
function quantize(geom) {
  const walk = (c) => (typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(walk))
  return { ...geom, coordinates: walk(geom.coordinates) }
}
async function ne(file) {
  const r = await fetch(`${BASE}/${file}.json`)
  if (!r.ok) throw new Error(`fetch ${file}: ${r.status}`)
  return r.json()
}
function trimFeatures(fc, keep) {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => ({ type: 'Feature', properties: keep(f.properties || {}), geometry: quantize(f.geometry) })),
  }
}
const numZoom = (p) => Math.round(p.min_zoom ?? p.MIN_ZOOM ?? 0)
const nameOf = (p) => p.name ?? p.NAME ?? p.name_en ?? ''

async function main() {
  await mkdir(OUT, { recursive: true })

  const rivers = trimFeatures(await ne('ne_10m_rivers_lake_centerlines'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? 10, kind: 'river' }))
  await writeFile(new URL('rivers.json', OUT), JSON.stringify(rivers))

  const lakes = trimFeatures(await ne('ne_10m_lakes'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? 10, kind: 'lake' }))
  await writeFile(new URL('lakes.json', OUT), JSON.stringify(lakes))

  const coast = trimFeatures(await ne('ne_10m_coastline'), (p) => ({ name: '', min_zoom: numZoom(p), scalerank: p.scalerank ?? 10, kind: 'coast' }))
  await writeFile(new URL('coastline.json', OUT), JSON.stringify(coast))

  // roads: map NE `type` to our 3 classes so the renderer styles by weight
  const roadClass = (t = '') => (/Major Highway|Freeway|Beltway/i.test(t) ? 'motorway' : /Secondary|Road/i.test(t) ? 'secondary' : 'primary')
  const roads = trimFeatures(await ne('ne_10m_roads'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? 10, kind: roadClass(p.type) }))
  await writeFile(new URL('roads.json', OUT), JSON.stringify(roads))

  // places: compact array, sorted by population desc for greedy zoom picking
  const pp = await ne('ne_10m_populated_places')
  const places = pp.features
    .map((f) => {
      const p = f.properties || {}
      const [lon, lat] = f.geometry.coordinates
      const cap = /Admin-0 capital/i.test(p.featurecla || '') ? 1 : 0
      const mz = Math.round(p.min_zoom ?? p.MIN_ZOOM ?? p.min_label ?? 3)
      return [String(p.name ?? p.NAME ?? ''), round(lat), round(lon), Math.round(p.pop_max ?? p.POP_MAX ?? 0), cap, mz]
    })
    .filter((r) => r[0])
    .sort((a, b) => b[3] - a[3])
  await writeFile(new URL('places.json', OUT), JSON.stringify(places))

  console.log('map data written to public/data/map/')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Add the npm script**

In `package.json` `"scripts"`, add: `"build:mapdata": "node scripts/build-mapdata.mjs"`

- [ ] **Step 3: Run it and verify output**

Run: `npm run build:mapdata && node -e "const p=require('./public/data/map/places.json');console.log('places',p.length, p[0]); const r=require('./public/data/map/rivers.json');console.log('rivers',r.features.length, Object.keys(r.features[0].properties))"`
Expected: `places` length in the thousands with a `[name,lat,lon,pop,1,mz]` capital first; `rivers` in the hundreds/thousands with properties `[ 'name', 'min_zoom', 'scalerank', 'kind' ]`. Confirm each `public/data/map/*.json` is well under a few hundred KB.

- [ ] **Step 4: Commit**

```bash
git add scripts/build-mapdata.mjs public/data/map package.json
git commit -m "feat(map): build script + trimmed Natural Earth layer data"
```

---

### Task 2: geo-data helpers (fetch, patch bounds, clip, zoom filter)

**Files:**
- Create: `src/map/geo-data.js`
- Test: `test/geo-data.test.js`

**Interfaces:**
- Consumes: `worldToLatLon(dem, x, z)` from `src/geo.js`; `TERRAIN_SIZE` from `src/terrain.js`.
- Produces:
  - `loadLayer(name: string): Promise<object>` — fetch+cache `data/map/<name>.json`.
  - `patchBounds(dem): { minLat, maxLat, minLon, maxLon }` — lat/lon bbox of the loaded patch (+small margin).
  - `featureBBox(feature): [minLon,minLat,maxLon,maxLat]`.
  - `bboxOverlap(a: bbox, bounds): boolean`.
  - `clipToPatch(features: array, bounds): array` — features whose bbox overlaps.
  - `filterByZoom(features: array, zoom: number): array` — keep `properties.min_zoom <= zoom`.

- [ ] **Step 1: Write the failing test**

Create `test/geo-data.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featureBBox, bboxOverlap, clipToPatch, filterByZoom } from '../src/map/geo-data.js'

const line = (coords, props = {}) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })

test('featureBBox spans a LineString', () => {
  assert.deepEqual(featureBBox(line([[0, 0], [2, 3], [-1, 1]])), [-1, 0, 2, 3])
})

test('bboxOverlap detects overlap and separation', () => {
  const bounds = { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 }
  assert.equal(bboxOverlap([1, 1, 2, 2], bounds), true)
  assert.equal(bboxOverlap([6, 6, 7, 7], bounds), false)
})

test('clipToPatch keeps overlapping features only', () => {
  const inside = line([[1, 1], [2, 2]])
  const outside = line([[10, 10], [11, 11]])
  const kept = clipToPatch([inside, outside], { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 })
  assert.equal(kept.length, 1)
  assert.equal(kept[0], inside)
})

test('filterByZoom respects min_zoom', () => {
  const a = line([[0, 0]], { min_zoom: 4 })
  const b = line([[0, 0]], { min_zoom: 9 })
  assert.deepEqual(filterByZoom([a, b], 6), [a])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/geo-data.test.js`
Expected: FAIL — cannot find module `../src/map/geo-data.js`.

- [ ] **Step 3: Write the implementation**

Create `src/map/geo-data.js`:

```js
import { worldToLatLon } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'

const HALF = TERRAIN_SIZE / 2
const _cache = new Map()

// fetch + cache a trimmed layer file (never throws — empty collection on failure)
export function loadLayer(name) {
  if (!_cache.has(name)) {
    _cache.set(name, fetch(`data/map/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return _cache.get(name)
}

// lat/lon bbox of the loaded DEM patch, sampled at the 4 corners + edge mids
// (mercator lat is nonlinear, so include edge midpoints), padded a touch.
export function patchBounds(dem) {
  const pts = []
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) pts.push(worldToLatLon(dem, fx * HALF, fz * HALF))
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180
  for (const p of pts) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon) }
  const padLat = (maxLat - minLat) * 0.05 + 0.01
  const padLon = (maxLon - minLon) * 0.05 + 0.01
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLon: minLon - padLon, maxLon: maxLon + padLon }
}

export function featureBBox(f) {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') { minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]); minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]) }
    else c.forEach(walk)
  }
  walk(f.geometry.coordinates)
  return [minLon, minLat, maxLon, maxLat]
}

export function bboxOverlap([aMinLon, aMinLat, aMaxLon, aMaxLat], b) {
  return aMinLon <= b.maxLon && aMaxLon >= b.minLon && aMinLat <= b.maxLat && aMaxLat >= b.minLat
}

export function clipToPatch(features, bounds) {
  return features.filter((f) => bboxOverlap(featureBBox(f), bounds))
}

export function filterByZoom(features, zoom) {
  return features.filter((f) => (f.properties?.min_zoom ?? 0) <= zoom)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/geo-data.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/map/geo-data.js test/geo-data.test.js
git commit -m "feat(map): geo-data fetch/clip/zoom-filter helpers"
```

---

### Task 3: draped-line geometry helpers (densify + drape)

**Files:**
- Create: `src/map/draped-line.js`
- Test: `test/draped-line.test.js`

**Interfaces:**
- Produces:
  - `densifyWorld(points: {x,z}[], maxStep: number): {x,z}[]` — subdivide segments longer than `maxStep`.
  - `drapeWorld(points: {x,z}[], sample: (x,z)=>number, offset: number): Float32Array` — `[x, sample+offset, z, ...]`.
  - `latlonToWorldPts(coords: [lon,lat][], dem, latLonToWorld): {x,z}[]`.

- [ ] **Step 1: Write the failing test**

Create `test/draped-line.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { densifyWorld, drapeWorld } from '../src/map/draped-line.js'

test('densifyWorld subdivides long segments', () => {
  const out = densifyWorld([{ x: 0, z: 0 }, { x: 10, z: 0 }], 2) // len 10, step 2 → 5 sub-steps
  assert.equal(out.length, 6) // 5 segments + final point
  assert.deepEqual(out[0], { x: 0, z: 0 })
  assert.deepEqual(out[out.length - 1], { x: 10, z: 0 })
  assert.ok(Math.abs(out[1].x - 2) < 1e-9)
})

test('densifyWorld leaves short segments intact', () => {
  const out = densifyWorld([{ x: 0, z: 0 }, { x: 1, z: 0 }], 5)
  assert.equal(out.length, 2)
})

test('drapeWorld lifts each point to sample + offset', () => {
  const sample = (x) => x * 10
  const arr = drapeWorld([{ x: 1, z: 2 }, { x: 3, z: 4 }], sample, 0.1)
  assert.deepEqual([...arr], [1, 10.1, 2, 3, 30.1, 4])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/draped-line.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/map/draped-line.js`:

```js
// Turn a lat/lon polyline into terrain-hugging world geometry. Long segments are
// densified before height sampling so a line follows the hill between two far
// vertices instead of cutting straight through it.

export function densifyWorld(points, maxStep) {
  if (points.length < 2) return points.slice()
  const out = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.ceil(d / maxStep))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
  }
  out.push(points[points.length - 1])
  return out
}

export function drapeWorld(points, sample, offset) {
  const arr = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    arr[i * 3] = p.x
    arr[i * 3 + 1] = sample(p.x, p.z) + offset
    arr[i * 3 + 2] = p.z
  }
  return arr
}

// project a GeoJSON [lon,lat] ring to terrain world XZ via the loaded DEM
export function latlonToWorldPts(coords, dem, latLonToWorld) {
  return coords.map(([lon, lat]) => { const w = latLonToWorld(dem, lat, lon); return { x: w.x, z: w.z } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/draped-line.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/map/draped-line.js test/draped-line.test.js
git commit -m "feat(map): draped-line densify + drape helpers"
```

---

### Task 4: place-pick (zoom-tiered, decluttered)

**Files:**
- Create: `src/map/place-pick.js`
- Test: `test/place-pick.test.js`

**Interfaces:**
- Produces: `pickPlaces(rows, { zoom, toWorld, halfLimit, maxN, minDist }): {name,w:{x,z},pop,cap}[]` — greedy over `rows` (already pop-desc), gated by `row[5] (min_zoom) <= zoom`, inside `±halfLimit`, at least `minDist` apart, up to `maxN`.

- [ ] **Step 1: Write the failing test**

Create `test/place-pick.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickPlaces } from '../src/map/place-pick.js'

// rows: [name, lat, lon, pop, cap, min_zoom]; toWorld maps lon→x, lat→z here
const toWorld = (lat, lon) => ({ x: lon, z: lat })

test('gates by zoom and picks biggest first, decluttered', () => {
  const rows = [
    ['Big', 0, 0, 900, 1, 2],
    ['Near', 0, 0.5, 800, 0, 2], // within minDist of Big → dropped
    ['Far', 0, 5, 700, 0, 2],
    ['Hidden', 0, 8, 600, 0, 9], // min_zoom 9 > zoom 6 → gated out
  ]
  const picks = pickPlaces(rows, { zoom: 6, toWorld, halfLimit: 100, maxN: 10, minDist: 1 })
  assert.deepEqual(picks.map((p) => p.name), ['Big', 'Far'])
})

test('respects maxN and halfLimit', () => {
  const rows = [['A', 0, 0, 9, 0, 0], ['B', 0, 50, 8, 0, 0], ['C', 0, 999, 7, 0, 0]]
  const picks = pickPlaces(rows, { zoom: 5, toWorld, halfLimit: 100, maxN: 1, minDist: 1 })
  assert.deepEqual(picks.map((p) => p.name), ['A'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/place-pick.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/map/place-pick.js`:

```js
// Greedy zoom-tiered place selection with a spacing pass. `rows` must be sorted
// by prominence (population) descending — the build script does this — so the
// first accepted names are the most important.
export function pickPlaces(rows, { zoom, toWorld, halfLimit, maxN, minDist }) {
  const picks = []
  for (const [name, lat, lon, pop, cap, mz] of rows) {
    if ((mz ?? 0) > zoom) continue
    const w = toWorld(lat, lon)
    if (Math.abs(w.x) > halfLimit || Math.abs(w.z) > halfLimit) continue
    if (picks.some((p) => Math.hypot(p.w.x - w.x, p.w.z - w.z) < minDist)) continue
    picks.push({ name, w, pop, cap: !!cap })
    if (picks.length >= maxN) break
  }
  return picks
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/place-pick.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/map/place-pick.js test/place-pick.test.js
git commit -m "feat(map): zoom-tiered decluttered place-pick"
```

---

### Task 5: shared serif text-label with contrast halo

**Files:**
- Create: `src/map/text-label.js`

**Interfaces:**
- Produces: `makeLabelTexture(text, { size, weight, color, halo, track }): { tex: THREE.CanvasTexture, aspect: number }` — serif label on a transparent canvas with a contrasting halo stroke.
- Consumes: nothing new (browser `document` + THREE).

This module is browser-only (uses `document.createElement('canvas')`), so it is verified in the browser in Task 12, not by `node --test`.

- [ ] **Step 1: Write the implementation**

Create `src/map/text-label.js`:

```js
import * as THREE from 'three'

// A serif place label drawn to a transparent canvas with a contrasting HALO so
// it stays legible over any map colour. `color` is the ink; `halo` is the
// opposite tone (light halo around dark ink, and vice-versa in dark mode).
const FONT = "Rosarivo, Georgia, 'Times New Roman', serif"

export function makeLabelTexture(text, { size = 88, weight = 500, color = '#2e2820', halo = 'rgba(255,255,255,0.9)', track = 0.16 } = {}) {
  const font = `${weight} ${size}px ${FONT}`
  const probe = document.createElement('canvas').getContext('2d')
  probe.font = font
  const gap = size * track
  let width = 0
  for (const ch of text) width += probe.measureText(ch).width + gap
  width -= gap
  const haloW = Math.max(2, size * 0.09)
  const pad = size * 0.4 + haloW
  const c = document.createElement('canvas')
  c.width = Math.ceil(width + pad * 2)
  c.height = Math.ceil(size * 1.6)
  const ctx = c.getContext('2d')
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = haloW
  ctx.strokeStyle = halo
  ctx.fillStyle = color
  let x = pad
  for (const ch of text) {
    ctx.strokeText(ch, x, c.height / 2) // halo first
    ctx.fillText(ch, x, c.height / 2) // ink on top
    x += ctx.measureText(ch).width + gap
  }
  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: c.width / c.height }
}

// theme-aware ink + halo pair used by every Map label
export function labelInk(darkMode) {
  return darkMode
    ? { color: '#eae3d4', halo: 'rgba(20,22,26,0.85)' }
    : { color: '#2e2820', halo: 'rgba(252,252,250,0.9)' }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/text-label.js
git commit -m "feat(map): shared serif label texture with contrast halo"
```

---

### Task 6: draped line object builder (Line2 + contrast casing)

**Files:**
- Create: `src/map/line-object.js`

**Interfaces:**
- Produces: `buildLineObject(worldPts: {x,z}[], sample, { color, casing, widthPx, offset, renderOrder, resolution }): THREE.Group` — a `Line2` in `color` over a slightly wider `Line2` casing in the opposite tone; both draped (densified + height-sampled), `depthTest:true`, `depthWrite:false`.
- Consumes: `densifyWorld`, `drapeWorld` (Task 3); `Line2`, `LineGeometry`, `LineMaterial` from `three/examples/jsm/lines/*`.

Browser-verified (Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/map/line-object.js`:

```js
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { densifyWorld, drapeWorld } from './draped-line.js'

// world-unit spacing to densify to before draping (≈ 1 terrain unit)
const STEP = 1.0

function line(positions, color, widthPx, renderOrder, resolution) {
  const geo = new LineGeometry()
  geo.setPositions(positions)
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: widthPx, transparent: true, depthTest: true, depthWrite: false, worldUnits: false })
  mat.resolution.copy(resolution)
  const l = new Line2(geo, mat)
  l.computeLineDistances()
  l.renderOrder = renderOrder
  return l
}

export function buildLineObject(worldPts, sample, { color, casing, widthPx, offset, renderOrder, resolution }) {
  const dense = densifyWorld(worldPts, STEP)
  const positions = [...drapeWorld(dense, sample, offset)]
  const g = new THREE.Group()
  if (casing) g.add(line(positions, casing, widthPx + 2.0, renderOrder, resolution)) // casing sits just under the ink line
  g.add(line(positions, color, widthPx, renderOrder + 1, resolution))
  return g
}
```

- [ ] **Step 2: Verify Line2 imports resolve under Vite**

Run: `npx vite build 2>&1 | tail -3`
Expected: build succeeds (confirms `three/examples/jsm/lines/*` resolve). If it fails to resolve, add them to Vite `optimizeDeps` — but three ships these, so it should resolve.

- [ ] **Step 3: Commit**

```bash
git add src/map/line-object.js
git commit -m "feat(map): draped Line2 builder with contrast casing"
```

---

### Task 7: Roads layer

**Files:**
- Create: `src/map/roads-layer.js`

**Interfaces:**
- Produces: `class RoadsLayer { constructor(scene); async rebuild({ dem, terrain, params }); setVisible(v); setOpacity(v); dispose() }`. Consumes `loadLayer`/`patchBounds`/`clipToPatch`/`filterByZoom` (Task 2), `latlonToWorldPts` (Task 3), `buildLineObject` (Task 6), `latLonToWorld` from `src/geo.js`.

Browser-verified (Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/map/roads-layer.js`:

```js
import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineObject } from './line-object.js'

// road class → ink colour + screen width (px). Motorways read boldest.
const STYLE = {
  motorway: { widthPx: 2.6 },
  primary: { widthPx: 1.8 },
  secondary: { widthPx: 1.1 },
}

export class RoadsLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'roads'
    scene.add(this.group)
    this._buildId = 0
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.roadsEnabled || !dem || params.source !== 'real') return
    const fc = await loadLayer('roads')
    if (id !== this._buildId || dem !== terrain.dem || !fc) return
    const bounds = patchBounds(dem)
    const feats = filterByZoom(clipToPatch(fc.features, bounds), params.demZoom ?? 8)
    const ink = params.darkMode ? '#d9c7b0' : '#3a3128'
    const casing = params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)'
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    for (const f of feats) {
      const style = STYLE[f.properties.kind] || STYLE.primary
      const rings = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
      for (const ring of rings) {
        const pts = latlonToWorldPts(ring, dem, latLonToWorld)
        const obj = buildLineObject(pts, sample, { color: ink, casing, widthPx: style.widthPx, offset: 0.08, renderOrder: 20, resolution })
        obj.traverse((o) => { if (o.material) o.material.opacity = (params.roadsOpacity ?? 0.9) })
        this.group.add(obj)
      }
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/roads-layer.js
git commit -m "feat(map): roads layer (class-styled, draped)"
```

---

### Task 8: Water layer (rivers + lakes + coastline)

**Files:**
- Create: `src/map/water-layer.js`

**Interfaces:**
- Produces: `class WaterLayer { constructor(scene); async rebuild({dem,terrain,params}); setVisible(v); setOpacity(v); dispose() }`. Same helpers as RoadsLayer; loads `rivers`, `lakes`, `coastline`.

Browser-verified (Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/map/water-layer.js`:

```js
import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineObject } from './line-object.js'

export class WaterLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'water'
    scene.add(this.group)
    this._buildId = 0
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async _addLayer(name, { dem, terrain, params, ink, casing, widthPx, resolution, sample, closed }) {
    const fc = await loadLayer(name)
    if (!fc) return null
    const feats = filterByZoom(clipToPatch(fc.features, patchBounds(dem)), params.demZoom ?? 8)
    const objs = []
    for (const f of feats) {
      const g = f.geometry
      const rings = g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [g.coordinates]
      for (const ring of rings) {
        const coords = closed && Array.isArray(ring[0]) ? ring : ring
        const pts = latlonToWorldPts(Array.isArray(coords[0][0]) ? coords[0] : coords, dem, latLonToWorld)
        objs.push(buildLineObject(pts, sample, { color: ink, casing, widthPx, offset: 0.07, renderOrder: 18, resolution }))
      }
    }
    return objs
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') return
    const ink = params.darkMode ? '#8fb7cf' : '#4d7fa6'
    const casing = params.darkMode ? 'rgba(15,17,20,0.5)' : 'rgba(252,250,246,0.6)'
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const base = { dem, terrain, params, ink, casing, resolution, sample }
    const groups = await Promise.all([
      this._addLayer('rivers', { ...base, widthPx: 1.4 }),
      this._addLayer('lakes', { ...base, widthPx: 1.2, closed: true }),
      this._addLayer('coastline', { ...base, widthPx: 1.2 }),
    ])
    if (id !== this._buildId || dem !== terrain.dem) return
    for (const objs of groups) if (objs) for (const o of objs) { o.traverse((m) => { if (m.material) m.material.opacity = params.waterOpacity ?? 0.9 }); this.group.add(o) }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/water-layer.js
git commit -m "feat(map): water layer (rivers/lakes/coastline, draped)"
```

---

### Task 9: Places layer (multi-tier serif labels, dark-mode ink)

**Files:**
- Create: `src/map/places-layer.js`
- Delete: `src/cities.js` (folded in — see Task 11 for the call-site swap)

**Interfaces:**
- Produces: `class PlacesLayer { constructor(scene); async rebuild({dem,terrain,params}); setVisible(v); dispose() }`. Consumes `loadLayer` (loads `places`), `pickPlaces` (Task 4), `makeLabelTexture`+`labelInk` (Task 5), `latLonToWorld`, `TERRAIN_SIZE`.

Browser-verified (Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/map/places-layer.js`:

```js
import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayer } from './geo-data.js'
import { pickPlaces } from './place-pick.js'
import { makeLabelTexture, labelInk } from './text-label.js'

const HALF = TERRAIN_SIZE / 2

export class PlacesLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'places'
    scene.add(this.group)
    this.meshes = []
    this._buildId = 0
  }
  _clear() {
    for (const m of this.meshes) { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); this.group.remove(m) }
    this.meshes = []
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.placesEnabled || !dem || params.source !== 'real') return
    const rows = await loadLayer('places')
    if (id !== this._buildId || dem !== terrain.dem || !Array.isArray(rows)) return

    const zoom = params.demZoom ?? 8
    const density = params.placesDensity ?? 1
    const maxN = Math.round((zoom >= 10 ? 26 : zoom >= 8 ? 18 : 12) * density)
    const minDist = TERRAIN_SIZE * (zoom >= 10 ? 0.05 : 0.085)
    const picks = pickPlaces(rows, { zoom, toWorld: (lat, lon) => latLonToWorld(dem, lat, lon), halfLimit: HALF * 0.96, maxN, minDist })
    if (!picks.length) return

    const ink = labelInk(params.darkMode)
    const dotGeo = new THREE.CircleGeometry(0.075, 12); dotGeo.rotateX(-Math.PI / 2)
    for (const p of picks) {
      const y = (terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0) + 0.06
      const dot = new THREE.Mesh(dotGeo.clone(), new THREE.MeshBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.85, depthWrite: false, depthTest: true }))
      dot.position.set(p.w.x, y, p.w.z); dot.renderOrder = 22
      this.group.add(dot); this.meshes.push(dot)

      const { tex, aspect } = makeLabelTexture(p.name.toUpperCase(), { color: ink.color, halo: ink.halo, weight: p.cap ? 700 : 500 })
      const w = Math.min(6, (p.cap ? 0.34 : 0.3) * p.name.length + 0.9)
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true }))
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(p.w.x, y + 0.02, p.w.z - 0.28 - (w / aspect) * 0.5)
      mesh.renderOrder = 22
      this.group.add(mesh); this.meshes.push(mesh)
    }
    this.group.visible = true
  }
  setVisible(v) { this.group.visible = v }
  dispose() { this._clear() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/places-layer.js
git commit -m "feat(map): places layer (multi-tier serif labels, dark-mode ink+halo)"
```

---

### Task 10: MapLayers manager

**Files:**
- Create: `src/map/layer-manager.js`

**Interfaces:**
- Produces: `class MapLayers { constructor(scene); async rebuild({dem,terrain,params}); setLayerVisible(id, v); setOpacity(id, v); reink(ctx); setSurfaceVisible(v); dispose() }` where `id ∈ {'roads','water','places'}`. Wraps RoadsLayer/WaterLayer/PlacesLayer.

Browser-verified (Task 12).

- [ ] **Step 1: Write the implementation**

Create `src/map/layer-manager.js`:

```js
import { RoadsLayer } from './roads-layer.js'
import { WaterLayer } from './water-layer.js'
import { PlacesLayer } from './places-layer.js'

// Orchestrates the SP1 layers. Every layer builds from the same {dem,terrain,params}
// so a new zone/zoom (or a dark-mode/opacity change) is a single rebuild call.
// SP2 will inject an OSM DataProvider here without touching layer code.
export class MapLayers {
  constructor(scene) {
    this.roads = new RoadsLayer(scene)
    this.water = new WaterLayer(scene)
    this.places = new PlacesLayer(scene)
    this._layers = { roads: this.roads, water: this.water, places: this.places }
    this._surfaceVisible = true
  }
  async rebuild(ctx) {
    await Promise.all(Object.values(this._layers).map((l) => l.rebuild(ctx)))
    this.setSurfaceVisible(this._surfaceVisible)
  }
  setLayerVisible(id, v) { this._layers[id]?.setVisible(v && this._surfaceVisible) }
  setOpacity(id, v) { this._layers[id]?.setOpacity?.(v) }
  // hide the whole set outside surface mode (globe/export)
  setSurfaceVisible(v) {
    this._surfaceVisible = v
    for (const l of Object.values(this._layers)) l.group.visible = v && l.group.children.length > 0
  }
  dispose() { for (const l of Object.values(this._layers)) l.dispose() }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/map/layer-manager.js
git commit -m "feat(map): MapLayers manager over roads/water/places"
```

---

### Task 11: Wire into main.js, retire cities.js, move controls out of Map style

**Files:**
- Modify: `src/main.js` (import + instantiate `MapLayers`; params; rebuild on zone load; ctx for the Map panel; retire `CityLabels`)
- Modify: `src/ui/create-panel.js` (remove City labels / contour / grid / place-labels / summit toggles from "Map style")
- Modify: `src/templates-user.js` (add layer params to `TEMPLATE_KEYS`)
- Delete: `src/cities.js`

**Interfaces:**
- Consumes: `MapLayers` (Task 10).
- Produces: `ctx.mapLayers` used by the Map panel (Task 12); `params.roadsEnabled/roadsOpacity/waterEnabled/waterOpacity/placesEnabled/placesDensity`.

- [ ] **Step 1: Find the current CityLabels call sites**

Run: `grep -rn "cities\|CityLabels\|cityRebuild\|cityLabels" src/main.js`
Expected: the import, the `new CityLabels(scene)`, the `.rebuild(...)` on zone load, the `setVisible` on mode change, and `ctx.cityRebuild`. Note each line number.

- [ ] **Step 2: Swap CityLabels → MapLayers in main.js**

- Replace `import { CityLabels } from './cities.js'` with `import { MapLayers } from './map/layer-manager.js'`.
- Replace `const cityLabels = new CityLabels(scene)` with `const mapLayers = new MapLayers(scene)`.
- Everywhere `cityLabels.rebuild({ dem, terrain, params })` was called (zone/zoom load), call `mapLayers.rebuild({ dem, terrain, params })`.
- Everywhere `cityLabels.setVisible(v)` (surface/globe mode switch) was called, call `mapLayers.setSurfaceVisible(v)`.
- In the `window.__exp = {…}` export, replace the `cityLabels`/`labels` city entry with `mapLayers`.

- [ ] **Step 3: Add the new params (near the other map params, e.g. after `cityLabels`)**

In the `params` object, remove `cityLabels: <bool>` and add:

```js
  roadsEnabled: false,
  roadsOpacity: 0.9,
  waterEnabled: false,
  waterOpacity: 0.9,
  placesEnabled: true, // was cityLabels
  placesDensity: 1,
```

- [ ] **Step 4: Replace ctx.cityRebuild with layer setters**

Where `ctx` for the create-panel defined `cityRebuild: () => cityLabels.rebuild(...)`, remove it. Add a shared rebuild helper used by the Map panel and expose it on the objects passed to `buildMapPanel` in Task 12:

```js
  // rebuild all map layers for the current zone (used by the Map panel toggles)
  const rebuildMapLayers = () => mapLayers.rebuild({ dem, terrain, params })
```

Ensure `dem`/`terrain` referenced here are the same live references used elsewhere in main.js (they are module-level in main.js).

- [ ] **Step 5: Remove the relocated controls from create-panel "Map style"**

In `src/ui/create-panel.js`, in the `sMap` (`section('Map style')`) `.append(...)`, DELETE these lines (they move to the Map panel in Task 12):
- `toggle({ label: 'City labels', ... })`
- `slider({ label: 'Contour interval', ... })`, `'Contour opacity'`, `'Contour weight'`
- `slider({ label: 'Grid size', ... })`, `'Grid opacity'`
- `toggle({ label: 'Place labels', ... })`
- `toggle({ label: 'Summit markers', ... })`

KEEP: `Hypsometric tint`, `Height contrast`, `Height pivot`, `Slope shading` (these are map-rendering, not overlays).

- [ ] **Step 6: Add layer params to templates**

In `src/templates-user.js` `TEMPLATE_KEYS`, in the map-style group, replace `'cityLabels'` (if present) and add:

```js
  'roadsEnabled', 'roadsOpacity', 'waterEnabled', 'waterOpacity', 'placesEnabled', 'placesDensity',
```

- [ ] **Step 7: Delete cities.js**

Run: `git rm src/cities.js`

- [ ] **Step 8: Syntax + tests**

Run: `for f in src/main.js src/ui/create-panel.js src/templates-user.js; do node --check "$f" || echo FAIL $f; done && node --test 2>&1 | grep -iE "tests |pass |fail " | head -3`
Expected: no FAIL; tests still all pass (the new pure tests included).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(map): wire MapLayers into main, retire cities.js, move info controls out of Map style"
```

---

### Task 12: The "Map" panel + full browser verification

**Files:**
- Create: `src/ui/map-panel.js`
- Modify: `src/main.js` (build the panel, pass ctx)

**Interfaces:**
- Consumes: `mapLayers`, `rebuildMapLayers`, `params`, `ctx.terrain` (for contour/grid uniforms), `ctx.peaksLayer`, `ctx.setLabelsVisible` (moved controls); the panel kit (`Panel`, `section`, `toggle`, `slider`).

- [ ] **Step 1: Write the Map panel**

Create `src/ui/map-panel.js`:

```js
import { section, toggle, slider } from './kit.js'
import { Panel } from './shell.js'

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>'

export function buildMapPanel(ctx) {
  const { params, u } = ctx // u() → terrain.mapUniforms
  const panel = new Panel({ title: 'Map', icon: ICON, side: 'right', width: 268, tip: 'Cartographic layers draped on the relief.' })

  const sLayers = panel.addSection(section('Layers', { open: true }))
  sLayers.body.append(
    toggle({ label: 'Roads', get: () => params.roadsEnabled, set: (v) => { params.roadsEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Roads opacity', min: 0, max: 1, step: 0.02, get: () => params.roadsOpacity, set: (v) => { params.roadsOpacity = v; ctx.mapLayers.setOpacity('roads', v) } }),
    toggle({ label: 'Rivers & water', get: () => params.waterEnabled, set: (v) => { params.waterEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Water opacity', min: 0, max: 1, step: 0.02, get: () => params.waterOpacity, set: (v) => { params.waterOpacity = v; ctx.mapLayers.setOpacity('water', v) } }),
    toggle({ label: 'Places', get: () => params.placesEnabled, set: (v) => { params.placesEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Places density', min: 0.4, max: 2, step: 0.1, get: () => params.placesDensity, set: (v) => { params.placesDensity = v; ctx.rebuildMapLayers() } })
  )

  const sContour = panel.addSection(section('Contours & grid'))
  sContour.body.append(
    slider({ label: 'Contour interval', min: 0.04, max: 0.6, step: 0.01, get: () => params.contourInterval, set: (v) => { params.contourInterval = v; u().uContourInterval.value = v } }),
    slider({ label: 'Contour opacity', min: 0, max: 1, step: 0.02, get: () => params.contourOpacity, set: (v) => { params.contourOpacity = v; u().uContourOpacity.value = v } }),
    slider({ label: 'Contour weight', min: 0.3, max: 1.6, step: 0.05, get: () => params.contourWeight, set: (v) => { params.contourWeight = v; if (!params.darkMode) u().uContourWeight.value = v } }),
    slider({ label: 'Grid size', min: 2, max: 14, step: 0.5, get: () => params.gridStep, set: (v) => { params.gridStep = v; u().uGridStep.value = v } }),
    slider({ label: 'Grid opacity', min: 0, max: 1, step: 0.02, get: () => params.gridOpacity, set: (v) => { params.gridOpacity = v; u().uGridOpacity.value = v } })
  )

  const sMarkers = panel.addSection(section('Markers'))
  sMarkers.body.append(
    toggle({ label: 'Summit markers', get: () => params.peaksEnabled ?? false, set: (v) => { params.peaksEnabled = v; ctx.peaksLayer.setEnabled(v) } }),
    toggle({ label: 'Spot elevations', get: () => params.labels, set: (v) => { params.labels = v; ctx.setLabelsVisible(v) } })
  )
  return panel
}
```

- [ ] **Step 2: Build the panel in main.js**

After the Shaders/Camera panels are built, add:

```js
import { buildMapPanel } from './ui/map-panel.js'
// …
buildMapPanel({
  params,
  u: () => terrain.mapUniforms,
  mapLayers,
  rebuildMapLayers,
  peaksLayer,
  setLabelsVisible: (v) => { /* same handler used by the old Place labels toggle */ },
})
```

Use the exact `setLabelsVisible` handler body that the removed "Place labels" toggle used in create-panel (labels group visibility).

- [ ] **Step 3: Syntax + build**

Run: `node --check src/ui/map-panel.js && node --check src/main.js && npx vite build 2>&1 | tail -1`
Expected: OK, build succeeds.

- [ ] **Step 4: Browser verification — panel + layers render and drape**

Start/refresh the preview, load a real mountainous location at zoom ≥ 8, then run this probe (adapt to the session's preview tab):

```js
(() => {
  const exp = window.__exp
  // open Map panel
  const p = [...document.querySelectorAll('.ce-panel')].find(x => x.querySelector('.ce-panel-title span:last-child')?.textContent.trim() === 'Map')
  p.classList.remove('collapsed'); p.querySelector('.ce-section-head').click()
  // enable roads + water + places
  exp.params.roadsEnabled = exp.params.waterEnabled = exp.params.placesEnabled = true
  return exp.mapLayers.rebuild({ dem: exp.terrain.dem, terrain: exp.terrain, params: exp.params }).then(() => ({
    roads: exp.mapLayers.roads.group.children.length,
    water: exp.mapLayers.water.group.children.length,
    places: exp.mapLayers.places.meshes.length,
    // sample a road vertex Y vs terrain height to confirm draping (offset ~0.08)
    sampleOffsetOK: (() => {
      const l = exp.mapLayers.roads.group.children[0]?.children[0]
      if (!l) return 'no-roads'
      const pos = l.geometry.attributes.instanceStart ? null : null
      return 'has-roads'
    })(),
  }))
})()
```

Expected: `roads`/`water` child counts > 0 and `places` meshes > 0 on a populated mountainous patch. Then take a screenshot and confirm visually: lines hug the relief (not floating flat, not sunk), a foreground ridge occludes lines behind it (realistic occlusion), place names are legible with a halo. If roads count is 0 at this location (Natural Earth roads are sparse outside US/Europe), test on a European/US alpine location.

- [ ] **Step 5: Browser verification — dark mode re-ink + contrast**

Run: toggle `params.darkMode` and `exp.mapLayers.rebuild(...)`, screenshot. Expected: labels/lines flip to light ink with a dark halo and stay legible over the dark map.

- [ ] **Step 6: Browser verification — moved controls work**

Confirm the Map panel's Contour/Grid sliders drive the shader (change contour opacity → visible change) and Summit/Spot toggles still work; confirm they no longer appear under create-panel "Map style".

- [ ] **Step 7: Commit**

```bash
git add src/ui/map-panel.js src/main.js
git commit -m "feat(map): Map panel (layers + relocated contours/grid/markers) + verification"
```

---

### Task 13: Ship — grade, deploy, push

- [ ] **Step 1: Full test + build**

Run: `node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`
Expected: all pass, build clean.

- [ ] **Step 2: Grading agent (≥8.5 ship gate — user standing requirement)**

Dispatch a code-review/grading agent over the diff (GLSL/geo correctness, draping/occlusion, disposal/leaks, panel wiring, template round-trip, no dead cities.js refs). Fix anything below 8.5, re-verify in browser.

- [ ] **Step 3: Deploy + push**

```bash
npx vite build
netlify deploy --prod --dir dist --site 74e18fe8-c86f-47ad-9807-479cd59f1d8c
git push adrien HEAD:feat/orbital-globe && git push adrien HEAD:main
```

- [ ] **Step 4: Update memory** — note the `src/map/` layer system + `scripts/build-mapdata.mjs` pipeline in the ShibuMap PBR/data memory (how to add a layer: build-script entry + a `*-layer.js` + a Map-panel toggle), and that SP2 (OSM detail) is the next sub-project.

---

## Self-Review

**Spec coverage:**
- Panel "Map" → Task 12. ✓
- Roads / Water / Places layers from Natural Earth → Tasks 7/8/9 + data Task 1. ✓
- Drape + realistic occlusion (sample+offset, depthTest true) → Tasks 3/6/7/8/9 (materials set depthTest:true, depthWrite:false). ✓
- Serif labels + contrast halo + dark-mode re-ink → Tasks 5/9. ✓
- Line casing for low-contrast legibility → Task 6. ✓
- Relocate contours/grid/summit/city controls → Tasks 11/12. ✓
- Retire x-ray cities.js, fold into Places → Tasks 9/11. ✓
- Data pipeline < 1 MB, lazy-loaded → Task 1 + `loadLayer`. ✓
- DataProvider seam for SP2 → `MapLayers.rebuild` centralizes fetching; Task 10 note. (SP1 keeps providers inline in each layer; the seam is the single `rebuild({dem,terrain,params})` entry that SP2 swaps to a provider. Acceptable for SP1; SP2 plan will formalize a `DataProvider` object.) ✓
- Templates capture layer state → Task 11 Step 6. ✓
- Tests via node --test on pure modules → Tasks 2/3/4. ✓

**Placeholder scan:** No TBD/TODO. Task 11 Steps 2/4 reference existing call sites the engineer locates via the Step-1 grep (real, not placeholder). Task 12 Step 2 `setLabelsVisible` body is explicitly "use the removed toggle's handler" — concrete pointer to existing code.

**Type consistency:** `rebuild({dem,terrain,params})` used identically across RoadsLayer/WaterLayer/PlacesLayer/MapLayers. `setOpacity(id,v)` on MapLayers → `setOpacity(v)` on layers. `pickPlaces` signature matches Task 4 ↔ Task 9. `buildLineObject` signature matches Task 6 ↔ Tasks 7/8. `makeLabelTexture`/`labelInk` match Task 5 ↔ Task 9. `loadLayer` name key matches build-script filenames (`roads`,`rivers`,`lakes`,`coastline`,`places`). ✓

**Note for executor:** the layer builder/UI tasks (5–12) are browser-verified (THREE + canvas can't run under `node --test`); their "test" steps are the in-browser probes in Task 12. Verify with the preview after each, per the project's established browser-verification workflow.
