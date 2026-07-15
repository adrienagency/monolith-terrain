# Map Layers SP2 — OSM detail + block clipping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a full-detail OpenStreetMap tier (Overpass) for Roads and waterways, auto-activated at close zoom, and clip every draped line to the block footprint so nothing spills past the slab/region edge.

**Architecture:** New pure modules `block-clip` (footprint predicate + polyline clip with boundary bisection) and `overpass` (query/parse/cache), plus `line-segments` (one batched `LineSegments2` per layer). Roads/water layers gain a zoom-based tier switch (Natural Earth ↔ Overpass) and route BOTH tiers through the same clip→batch pipeline. Terrain exposes its block footprint (slab superellipse + region-mask sampler) to JS.

**Tech Stack:** Three.js r172 (`examples/jsm/lines` LineSegments2/LineSegmentsGeometry/LineMaterial), vanilla JS ESM, Vite, `node --test`. Data: Overpass API (raw OSM, no simplification).

## Global Constraints

- **Full fidelity:** OSM geometry is rendered UNSIMPLIFIED (no Douglas–Peucker, no vertex dropping). Density is contained by BATCHING into `LineSegments2`, never by reducing data.
- **Nothing leaves the block:** every draped line (both tiers) is geometrically clipped to the block footprint — the slab superellipse (`uSlabHalf=TERRAIN_SIZE/2`, `uSlabCorner`, `uSlabCornerN`, matching the terrain shader's discard) AND, when `uRegionOn`, the region-mask silhouette (CPU-sampled, red ≥ 0.5 = inside). Boundary crossings are bisected so run ends land on the edge.
- **Activation:** automatic — `useOsm = params.demZoom >= OSM_MIN_ZOOM` (const, default 12). Below → Natural Earth (SP1). On Overpass failure/timeout, fall back to the Natural Earth tier for that patch (never blank).
- **Draping unchanged:** vertex Y = `terrain.sample(x,z) + offset`; line materials `depthTest:true, depthWrite:false`.
- **Overpass discipline:** POST to a const `OVERPASS_URL` (`https://overpass-api.de/api/interpreter`), cache by rounded bbox+kind, in-flight dedup, min interval between hits, graceful null on error. Query only the patch bbox.
- **Attribution:** show "© OpenStreetMap contributors" whenever OSM data is on screen (ODbL).
- Vanilla JS ESM; pure modules unit-tested via `node --test` and registered in `package.json` `test`; rendering/UI browser-verified. Follow SP1 patterns (build-id supersede guard, dispose-on-supersede/clear).

---

### Task 1: block-clip module (footprint predicate + polyline clip)

**Files:**
- Create: `src/map/block-clip.js`
- Test: `test/block-clip.test.js`

**Interfaces:**
- Produces:
  - `slabInside(x, z, half, corner, cornerN): boolean` — superellipse footprint test.
  - `makeInsideBlock({half, corner, cornerN, regionOn, regionSample}): (x,z)=>boolean`.
  - `clipPolylineToBlock(pts, insideBlock, step?, bisect?): {x,z}[][]` — inside-runs, crossings bisected onto the boundary.

- [ ] **Step 1: Write the failing test**

Create `test/block-clip.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slabInside, makeInsideBlock, clipPolylineToBlock } from '../src/map/block-clip.js'

test('slabInside: plain square (corner 0)', () => {
  assert.equal(slabInside(0, 0, 28, 0, 2), true)
  assert.equal(slabInside(27.9, 0, 28, 0, 2), true)
  assert.equal(slabInside(28.1, 0, 28, 0, 2), false)
})

test('slabInside: rounded corner cuts the corner region', () => {
  // half 28, corner 8, n 2 → circle of r8 centered at (20,20)
  assert.equal(slabInside(20, 20, 28, 8, 2), true)   // at the corner center
  assert.equal(slabInside(27.9, 27.9, 28, 8, 2), false) // past the fillet
  assert.equal(slabInside(0, 27.9, 28, 8, 2), true)  // straight edge unaffected
})

test('makeInsideBlock composes region sampler', () => {
  const f = makeInsideBlock({ half: 28, corner: 0, cornerN: 2, regionOn: true, regionSample: (x) => (x < 0 ? 1 : 0) })
  assert.equal(f(-5, 0), true)   // inside slab AND region
  assert.equal(f(5, 0), false)   // inside slab, outside region
})

test('clipPolylineToBlock: fully inside passes as one run', () => {
  const inside = () => true
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 2, z: 0 }], inside, 1)
  assert.equal(runs.length, 1)
})

test('clipPolylineToBlock: fully outside yields no runs', () => {
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 2, z: 0 }], () => false, 1)
  assert.equal(runs.length, 0)
})

test('clipPolylineToBlock: crossing splits and lands on boundary x=10', () => {
  const inside = (x) => x <= 10
  const runs = clipPolylineToBlock([{ x: 0, z: 0 }, { x: 20, z: 0 }], inside, 1)
  assert.equal(runs.length, 1)
  const end = runs[0][runs[0].length - 1]
  assert.ok(Math.abs(end.x - 10) < 0.2, `end x ${end.x} ~ 10`)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/block-clip.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/map/block-clip.js`:

```js
// The block footprint, in JS, so overlay lines can be clipped to exactly what the
// terrain shows. slabInside mirrors terrain.js's slab-corner discard (superellipse).

export function slabInside(x, z, half, corner, cornerN) {
  if (Math.abs(x) > half || Math.abs(z) > half) return false
  if (corner <= 0) return true
  const qx = Math.max(Math.abs(x) - (half - corner), 0)
  const qz = Math.max(Math.abs(z) - (half - corner), 0)
  if (qx === 0 && qz === 0) return true
  const pn = Math.pow(Math.pow(qx, cornerN) + Math.pow(qz, cornerN), 1 / cornerN)
  return pn <= corner
}

// insideBlock predicate = slab AND (region mask when a region cutout is active)
export function makeInsideBlock({ half, corner, cornerN, regionOn, regionSample }) {
  if (regionOn && regionSample) {
    return (x, z) => slabInside(x, z, half, corner, cornerN) && regionSample(x, z) >= 0.5
  }
  return (x, z) => slabInside(x, z, half, corner, cornerN)
}

// Clip a world-space polyline to the block: densify to `step`, keep contiguous
// inside-runs, and bisect each in/out crossing so the run end sits on the edge.
export function clipPolylineToBlock(pts, insideBlock, step = 0.6, bisect = 7) {
  if (pts.length < 2) return pts.length && insideBlock(pts[0].x, pts[0].z) ? [] : []
  const dense = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const d = Math.hypot(b.x - a.x, b.z - a.z)
    const n = Math.max(1, Math.ceil(d / step))
    for (let k = 0; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
  }
  dense.push(pts[pts.length - 1])

  const boundary = (inPt, outPt) => {
    let lo = inPt, hi = outPt
    for (let i = 0; i < bisect; i++) {
      const mid = { x: (lo.x + hi.x) / 2, z: (lo.z + hi.z) / 2 }
      if (insideBlock(mid.x, mid.z)) lo = mid; else hi = mid
    }
    return lo
  }
  const runs = []
  let run = null, prev = null, prevIn = false
  for (const p of dense) {
    const inside = insideBlock(p.x, p.z)
    if (inside) {
      if (!prevIn && prev) { run = [boundary(p, prev)] }
      else if (!run) run = []
      run.push(p)
    } else if (prevIn && run) {
      run.push(boundary(prev, p))
      if (run.length >= 2) runs.push(run)
      run = null
    }
    prev = p; prevIn = inside
  }
  if (run && run.length >= 2) runs.push(run)
  return runs
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/block-clip.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Register test + commit**

Append ` test/block-clip.test.js` to the `"test"` script in `package.json`, then:
```bash
node --test 2>&1 | grep -iE "tests |pass |fail "   # all green
git add src/map/block-clip.js test/block-clip.test.js package.json
git commit -m "feat(map): block-clip footprint predicate + polyline clip (SP2)"
```

---

### Task 2: overpass module (query, parse, cache)

**Files:**
- Create: `src/map/overpass.js`
- Test: `test/overpass.test.js`

**Interfaces:**
- Produces:
  - `OVERPASS_URL: string`, `WAY_TAG = { roads:'highway', water:'waterway' }`.
  - `buildQuery(bbox, kind): string` — `bbox={minLat,minLon,maxLat,maxLon}`.
  - `parseOverpass(json, kind): {coords:[lon,lat][], kind:string, name:string}[]` — FULL geometry, no reduction.
  - `bboxKey(bbox, kind): string`.
  - `fetchOverpassLines(bbox, kind, opts?): Promise<features[]|null>` — cache+throttle (browser).

- [ ] **Step 1: Write the failing test**

Create `test/overpass.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, parseOverpass, bboxKey } from '../src/map/overpass.js'

const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

test('buildQuery: roads uses highway + south,west,north,east bbox', () => {
  const q = buildQuery(bbox, 'roads')
  assert.match(q, /way\["highway"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

test('buildQuery: water uses waterway', () => {
  assert.match(buildQuery(bbox, 'water'), /way\["waterway"\]/)
})

test('parseOverpass keeps ALL vertices, maps tags', () => {
  const json = { elements: [
    { type: 'way', tags: { highway: 'primary', name: 'D1' }, geometry: [ { lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 } ] },
    { type: 'way', tags: { highway: 'residential' }, geometry: [ { lat: 0, lon: 0 } ] }, // <2 pts dropped
    { type: 'node', lat: 9, lon: 9 }, // non-way ignored
  ] }
  const feats = parseOverpass(json, 'roads')
  assert.equal(feats.length, 1)
  assert.deepEqual(feats[0].coords, [ [2, 1], [4, 3], [6, 5] ]) // [lon,lat], all 3 kept
  assert.equal(feats[0].kind, 'primary')
  assert.equal(feats[0].name, 'D1')
})

test('bboxKey rounds to 3 decimals', () => {
  assert.equal(bboxKey({ minLat: 45.80001, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }, 'roads'), 'roads:45.8,6.1,45.95,6.3')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/overpass.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/map/overpass.js`:

```js
// Full-detail OSM lines via the Overpass API — raw geometry, NO simplification.
// Endpoint is a const so a self-hosted instance can replace the public one.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
export const WAY_TAG = { roads: 'highway', water: 'waterway' }

// Overpass bbox order is (south,west,north,east) = (minLat,minLon,maxLat,maxLon)
export function buildQuery(bbox, kind) {
  const tag = WAY_TAG[kind]
  const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  return `[out:json][timeout:25];way["${tag}"](${b});out geom;`
}

// Overpass `out geom` gives each way a `geometry:[{lat,lon},…]`. Keep every vertex.
export function parseOverpass(json, kind) {
  const tag = WAY_TAG[kind]
  const out = []
  for (const e of json?.elements || []) {
    if (e.type !== 'way' || !Array.isArray(e.geometry)) continue
    const coords = e.geometry.map((g) => [g.lon, g.lat])
    if (coords.length < 2) continue
    out.push({ coords, kind: e.tags?.[tag] || kind, name: e.tags?.name || '' })
  }
  return out
}

export function bboxKey(bbox, kind) {
  const r = (n) => Math.round(n * 1000) / 1000
  return `${kind}:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
}

// cache by zone+kind, dedupe in-flight, min gap between network hits, null on fail
const _cache = new Map()
let _lastAt = 0
export async function fetchOverpassLines(bbox, kind, { url = OVERPASS_URL, minInterval = 1200 } = {}) {
  const key = bboxKey(bbox, kind)
  if (!_cache.has(key)) {
    const body = buildQuery(bbox, kind)
    const job = (async () => {
      const wait = Math.max(0, _lastAt + minInterval - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      _lastAt = Date.now()
      const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
      if (!r.ok) throw new Error(`overpass ${r.status}`)
      return parseOverpass(await r.json(), kind)
    })()
    _cache.set(key, job)
    job.catch(() => _cache.delete(key))
  }
  try { return await _cache.get(key) } catch { return null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/overpass.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Register test + commit**

Append ` test/overpass.test.js` to `package.json` `"test"`, then:
```bash
node --test 2>&1 | grep -iE "tests |pass |fail "
git add src/map/overpass.js test/overpass.test.js package.json
git commit -m "feat(map): overpass query/parse/cache (full-detail OSM, SP2)"
```

---

### Task 3: line-segments batched builder

**Files:**
- Create: `src/map/line-segments.js`

**Interfaces:**
- Produces: `buildLineSegments(runs, sample, { color, casing, widthPx, offset, renderOrder, resolution }): THREE.Group` — ALL runs' segments packed into one `LineSegments2` (ink) over one casing; `depthTest:true, depthWrite:false`. Browser-verified.

- [ ] **Step 1: Write the implementation**

Create `src/map/line-segments.js`:

```js
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

// pack every segment of every run into one flat [x,y,z, x,y,z, …] segment list,
// draped (y = sample+offset). One LineSegments2 = one draw call for the layer.
function segPositions(runs, sample, offset) {
  const pos = []
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i], b = run[i + 1]
      pos.push(a.x, sample(a.x, a.z) + offset, a.z, b.x, sample(b.x, b.z) + offset, b.z)
    }
  }
  return pos
}
function seg(pos, color, widthPx, renderOrder, resolution) {
  const geo = new LineSegmentsGeometry()
  geo.setPositions(pos)
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: widthPx, transparent: true, depthTest: true, depthWrite: false, worldUnits: false })
  mat.resolution.copy(resolution)
  const l = new LineSegments2(geo, mat)
  l.computeLineDistances()
  l.renderOrder = renderOrder
  return l
}
export function buildLineSegments(runs, sample, { color, casing, widthPx, offset, renderOrder, resolution }) {
  const g = new THREE.Group()
  const pos = segPositions(runs, sample, offset)
  if (!pos.length) return g
  if (casing) g.add(seg(pos, casing, widthPx + 2.0, renderOrder, resolution))
  g.add(seg(pos, color, widthPx, renderOrder + 1, resolution))
  return g
}
```

- [ ] **Step 2: Verify imports resolve**

Run: `node --check src/map/line-segments.js && npx vite build 2>&1 | tail -3`
Expected: build succeeds (confirms `LineSegments2`/`LineSegmentsGeometry` resolve). If they don't resolve, report BLOCKED with the exact error.

- [ ] **Step 3: Commit**

```bash
git add src/map/line-segments.js
git commit -m "feat(map): batched LineSegments2 builder (SP2)"
```

---

### Task 4: terrain exposes its block footprint (slab + region sampler)

**Files:**
- Modify: `src/terrain.js`

**Interfaces:**
- Produces on the Terrain instance:
  - `blockFootprint(): { half, corner, cornerN, regionOn, regionSample }` — reads `this.mapUniforms.uSlabHalf/uSlabCorner/uSlabCornerN/uRegionOn`; `regionSample` is a fn or null.
  - The region mask ImageData is captured whenever the mask is set so `regionSample(x,z)` can read it.

- [ ] **Step 1: Capture region mask ImageData when the mask is set**

Find the method that sets the region mask (grep `uRegionMask` in terrain.js — it assigns `this.mapUniforms.uRegionMask.value = texture` and toggles `uRegionOn`). It receives a CanvasTexture whose `.image` is the mask canvas. In that method, when a real mask is set, capture its pixels:

```js
    // capture CPU pixels so overlay lines can be clipped to the region silhouette
    const cv = texture?.image
    if (cv && cv.width) {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height
      const cx = c.getContext('2d'); cx.drawImage(cv, 0, 0)
      this._regionImage = cx.getImageData(0, 0, cv.width, cv.height)
    }
```
And in the branch that clears the region mask (region off / placeholder), set `this._regionImage = null`.

- [ ] **Step 2: Add `blockFootprint()` (and the sampler)**

Add to the Terrain class:

```js
  // world XZ → region-mask coverage in [0,1] (1 = inside / no mask). uv = xz/T + 0.5
  regionSample(x, z) {
    const img = this._regionImage
    if (!img) return 1
    const u = x / TERRAIN_SIZE + 0.5, v = z / TERRAIN_SIZE + 0.5
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0
    const px = Math.min(img.width - 1, (u * img.width) | 0)
    const py = Math.min(img.height - 1, (v * img.height) | 0)
    return img.data[(py * img.width + px) * 4] / 255 // red channel
  }
  // the block footprint for overlay clipping (slab superellipse + region cutout)
  blockFootprint() {
    const u = this.mapUniforms
    const regionOn = u.uRegionOn.value > 0.5
    return {
      half: u.uSlabHalf.value,
      corner: u.uSlabCorner.value,
      cornerN: u.uSlabCornerN.value,
      regionOn,
      regionSample: regionOn ? (x, z) => this.regionSample(x, z) : null,
    }
  }
```
(`TERRAIN_SIZE` is already in scope in terrain.js.)

- [ ] **Step 3: Verify**

Run: `node --check src/terrain.js && node --test 2>&1 | grep -iE "tests |pass |fail "`
Expected: OK; tests still pass (no test touches this; browser-verified in Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/terrain.js
git commit -m "feat(map): terrain exposes block footprint + region-mask sampler (SP2)"
```

---

### Task 5: Roads layer — OSM tier + block clip + batched build

**Files:**
- Modify: `src/map/roads-layer.js`

**Interfaces:**
- Consumes: `fetchOverpassLines` (Task 2), `makeInsideBlock`/`clipPolylineToBlock` (Task 1), `buildLineSegments` (Task 3), `terrain.blockFootprint()` (Task 4), plus existing `loadLayer/patchBounds/clipToPatch/filterByZoom`, `latlonToWorldPts`, `latLonToWorld`.
- Produces: unchanged public API (`rebuild/setVisible/setOpacity/dispose`), now with `OSM_MIN_ZOOM` export.

- [ ] **Step 1: Rewrite `rebuild` to switch tiers, clip, and batch**

Replace the body of `RoadsLayer` with:

```js
import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'

export const OSM_MIN_ZOOM = 12 // at/above this demZoom, roads come from full-detail OSM

const STYLE = { motorway: { widthPx: 2.6 }, primary: { widthPx: 1.8 }, secondary: { widthPx: 1.1 } }
// OSM highway value → our 3 weight classes (keeps ALL roads, just styles them)
function roadClass(h = '') {
  if (/^(motorway|trunk)(_link)?$/.test(h)) return 'motorway'
  if (/^primary(_link)?$/.test(h)) return 'primary'
  return 'secondary'
}

export class RoadsLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'roads'; scene.add(this.group)
    this._buildId = 0; this.usingOsm = false; this.loading = false
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.roadsEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // gather rings as {coords:[lon,lat][], klass} from the chosen tier
    let rings = null
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'roads')
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) rings = feats.map((f) => ({ coords: f.coords, klass: roadClass(f.kind) }))
    }
    if (!rings) { // Natural Earth tier (or OSM failed → fallback)
      const fc = await loadLayer('roads')
      if (id !== this._buildId || dem !== terrain.dem || !fc) return
      rings = []
      for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
        const rs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
        for (const r of rs) rings.push({ coords: r, klass: f.properties.kind || 'secondary' })
      }
    }
    this.usingOsm = useOsm && rings != null

    const insideBlock = makeInsideBlock(terrain.blockFootprint())
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#d9c7b0' : '#3a3128'
    const casing = params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)'
    // clip every ring to the block, bucket runs by weight class
    const byClass = { motorway: [], primary: [], secondary: [] }
    for (const r of rings) {
      const pts = latlonToWorldPts(r.coords, dem, latLonToWorld)
      const runs = clipPolylineToBlock(pts, insideBlock)
      if (runs.length) (byClass[r.klass] || byClass.secondary).push(...runs)
    }
    for (const klass of Object.keys(byClass)) {
      if (!byClass[klass].length) continue
      const obj = buildLineSegments(byClass[klass], sample, { color: ink, casing, widthPx: STYLE[klass].widthPx, offset: 0.08, renderOrder: 20, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.roadsOpacity ?? 0.9 })
      this.group.add(obj)
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
```

- [ ] **Step 2: Verify**

Run: `node --check src/map/roads-layer.js && node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`
Expected: OK, tests green, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/map/roads-layer.js
git commit -m "feat(map): roads OSM tier + block clip + batched segments (SP2)"
```

---

### Task 6: Water layer — OSM waterways tier + block clip + batched build

**Files:**
- Modify: `src/map/water-layer.js`

**Interfaces:** same helpers as Task 5. Rivers switch to OSM waterways at zoom; lakes + coastline stay Natural Earth (areas/coast). ALL water sublayers are clipped to the block and batched.

- [ ] **Step 1: Rewrite `rebuild`**

Replace `WaterLayer` with:

```js
import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'
import { OSM_MIN_ZOOM } from './roads-layer.js'

function ringsOf(g) {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

export class WaterLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'water'; scene.add(this.group)
    this._buildId = 0; this.usingOsm = false; this.loading = false
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  // Natural Earth line rings for a static layer (lakes/coastline, and rivers when NE)
  async _neRings(name, bounds, zoom) {
    const fc = await loadLayer(name)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const r of ringsOf(f.geometry)) if (r.length >= 2) out.push(r)
    return out
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // rivers: OSM waterways when zoomed in, else NE river centerlines
    let riverRings = null
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'water')
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) riverRings = feats.map((f) => f.coords)
    }
    if (!riverRings) riverRings = await this._neRings('rivers', bounds, zoom)
    // lakes + coastline: always Natural Earth
    const lakeRings = await this._neRings('lakes', bounds, zoom)
    const coastRings = await this._neRings('coastline', bounds, zoom)
    if (id !== this._buildId || dem !== terrain.dem) return
    this.usingOsm = useOsm && riverRings != null

    const insideBlock = makeInsideBlock(terrain.blockFootprint())
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#8fb7cf' : '#4d7fa6'
    const casing = params.darkMode ? 'rgba(15,17,20,0.5)' : 'rgba(252,250,246,0.6)'
    const clipAll = (ringList) => { const runs = []; for (const r of ringList) { const pts = latlonToWorldPts(r, dem, latLonToWorld); runs.push(...clipPolylineToBlock(pts, insideBlock)) } return runs }

    const groups = [
      { runs: clipAll(riverRings), widthPx: 1.4 },
      { runs: clipAll(lakeRings), widthPx: 1.2 },
      { runs: clipAll(coastRings), widthPx: 1.2 },
    ]
    for (const g of groups) {
      if (!g.runs.length) continue
      const obj = buildLineSegments(g.runs, sample, { color: ink, casing, widthPx: g.widthPx, offset: 0.07, renderOrder: 18, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.waterOpacity ?? 0.9 })
      this.group.add(obj)
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
```

- [ ] **Step 2: Verify**

Run: `node --check src/map/water-layer.js && node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`
Expected: OK, tests green, build OK.

- [ ] **Step 3: Commit**

```bash
git add src/map/water-layer.js
git commit -m "feat(map): water OSM waterways tier + block clip + batched segments (SP2)"
```

---

### Task 7: Manager OSM state + attribution credit + loading indicator

**Files:**
- Modify: `src/map/layer-manager.js`
- Modify: `src/main.js` (create the credit + loading DOM; poll/refresh from the manager)

**Interfaces:**
- `MapLayers` gains `isOsmActive(): boolean` (any enabled layer `usingOsm`) and `isLoading(): boolean` (any layer `loading`). `onResize` already covers `LineMaterial` (LineSegments2 uses it) — leave as is.
- main.js shows a fixed "© OpenStreetMap contributors" element when `isOsmActive()`, and a subtle "Détail OSM · chargement…" indicator when `isLoading()`, refreshed after each `rebuildMapLayers()` and on a short timer while loading.

- [ ] **Step 1: Add state getters to MapLayers**

In `src/map/layer-manager.js`, add:

```js
  isOsmActive() { return Object.values(this._layers).some((l) => l.usingOsm) }
  isLoading() { return Object.values(this._layers).some((l) => l.loading) }
```

- [ ] **Step 2: Credit + loading DOM in main.js**

Near the other DOM/overlay setup in main.js, add a credit + status element and a refresh function; call it after `rebuildMapLayers()` resolves and while loading:

```js
// OSM attribution + loading status for the Map layers (ODbL requires the credit)
const osmCredit = document.createElement('div')
osmCredit.className = 'osm-credit'
osmCredit.innerHTML = '<span class="osm-status"></span>© OpenStreetMap contributors'
osmCredit.style.display = 'none'
document.body.appendChild(osmCredit)
function refreshOsmCredit() {
  const on = mapLayers.isOsmActive(), loading = mapLayers.isLoading()
  osmCredit.style.display = on || loading ? 'flex' : 'none'
  osmCredit.querySelector('.osm-status').textContent = loading ? 'Détail OSM · chargement… ' : ''
}
```
Make `rebuildMapLayers` refresh the credit — change it to:
```js
const rebuildMapLayers = () => { refreshOsmCredit(); return mapLayers.rebuild({ dem, terrain, params }).then(() => refreshOsmCredit()) }
```
(Calling `refreshOsmCredit()` first shows the loading state immediately; the `.then` clears it. If the existing `rebuildMapLayers` is referenced elsewhere as fire-and-forget that's fine — it still returns the promise.)

- [ ] **Step 3: Minimal CSS for the credit**

Add to `src/ui/v28.css` (or the main stylesheet):

```css
.osm-credit { position: fixed; right: 10px; bottom: 8px; z-index: 40; display: flex; gap: 6px; align-items: center;
  font: 500 10.5px/1.3 var(--ce-font, system-ui, sans-serif); color: var(--ce-muted, rgba(28,30,34,.55));
  background: var(--ce-glass, rgba(252,252,253,.62)); padding: 3px 8px; border-radius: 8px; pointer-events: none; }
.osm-credit .osm-status { color: var(--ce-accent, #e8622c); }
```

- [ ] **Step 4: Verify**

Run: `node --check src/map/layer-manager.js src/main.js && node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`
Expected: OK, tests green, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/map/layer-manager.js src/main.js src/ui/v28.css
git commit -m "feat(map): OSM attribution credit + loading indicator (SP2)"
```

---

### Task 8: Browser verification + ship

- [ ] **Step 1: Preview + verify OSM detail, block clip, region clip, fallback**

Start the preview, load a city at demZoom ≥ 12 (e.g. paste a city center), enable Roads + Rivers & water. Run a probe:

```js
(() => {
  const exp = window.__exp
  exp.params.roadsEnabled = exp.params.waterEnabled = true
  return exp.rebuildMapLayers().then(() => {
    const fp = exp.terrain.blockFootprint()
    // sample every road/water segment endpoint: assert ALL are insideBlock
    const { makeInsideBlock } = window // not exported; instead check counts + a screenshot
    return {
      usingOsm: exp.mapLayers.isOsmActive(),
      roads: exp.mapLayers.roads.group.children.length,
      water: exp.mapLayers.water.group.children.length,
      footprint: fp,
    }
  })
})()
```
Expected at z≥12 over a city: `usingOsm:true`, roads/water children > 0 (dense OSM). Take a screenshot: **verify no line crosses the block edge** (the constraint), lines hug the relief, roads read by class. Then set demZoom < 12 (or navigate out) and rebuild → `usingOsm:false` (Natural Earth). Test region mode ON (individualiser la zone) at a country level → lines clip to the country silhouette. Simulate an Overpass failure (e.g. temporarily point `OVERPASS_URL` wrong, or throttle) → confirm fallback to NE, no blank, no thrown error in console.

To rigorously confirm the clip, sample endpoints against the footprint in-page:
```js
(() => { const e=window.__exp, fp=e.terrain.blockFootprint();
  const inside=(x,z)=>{ if(Math.abs(x)>fp.half||Math.abs(z)>fp.half) return false; if(fp.corner<=0) return true;
    const qx=Math.max(Math.abs(x)-(fp.half-fp.corner),0), qz=Math.max(Math.abs(z)-(fp.half-fp.corner),0);
    if(qx===0&&qz===0) return true; return Math.pow(Math.pow(qx,fp.cornerN)+Math.pow(qz,fp.cornerN),1/fp.cornerN)<=fp.corner+0.5; };
  let checked=0, outside=0;
  for(const layer of [e.mapLayers.roads, e.mapLayers.water]) layer.group.traverse(o=>{ if(o.isLineSegments2){ const a=o.geometry.getAttribute('instanceStart'); if(a) for(let i=0;i<a.count;i++){ checked++; if(!inside(a.getX(i),a.getZ(i))) outside++; } } });
  return { checked, outsideBlock: outside }; })()
```
Expected: `outsideBlock: 0` (nothing past the edge) — this is the hard constraint's proof.

- [ ] **Step 2: Confirm no console errors, dark-mode re-ink still works, opacity + resize still work.**

- [ ] **Step 3: Full test + build**

Run: `node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`
Expected: all pass, build clean.

- [ ] **Step 4: Final whole-branch review (opus) over the SP2 range** (`git merge-base`/the SP2 base commit .. HEAD), then fix Critical/Important.

- [ ] **Step 5: Deploy + push + memory**

```bash
npx vite build
netlify deploy --prod --dir dist --site 74e18fe8-c86f-47ad-9807-479cd59f1d8c
git push adrien HEAD:feat/orbital-globe && git push adrien HEAD:main
```
Update the ShibuMap map-layers memory: SP2 shipped (Overpass full-detail tier auto at z≥12, block clip via block-clip.js, batched LineSegments2, ODbL credit); note the endpoint const for self-hosting.

---

## Self-Review

**Spec coverage:**
- Full-fidelity OSM (no simplification) → Task 2 `parseOverpass` keeps all vertices; batching via `LineSegments2` (Task 3) not reduction. ✓
- Nothing leaves the block (slab + region), bisected crossings → Task 1 `block-clip`, applied in Tasks 5/6 to BOTH tiers. ✓
- Auto activation by zoom (`OSM_MIN_ZOOM`) + NE fallback on failure → Tasks 5/6. ✓
- Region-cutout clip via CPU mask sampler → Task 4 `terrain.regionSample`/`blockFootprint` + Task 1 `makeInsideBlock`. ✓
- Overpass public + cache/dedupe/throttle/null-on-fail, swappable endpoint → Task 2. ✓
- ODbL attribution + loading indicator → Task 7. ✓
- Draping/occlusion unchanged → Tasks 3/5/6 (offset + depthTest true). ✓
- Tests registered; pure modules `node --test` → Tasks 1/2. ✓

**Placeholder scan:** none. The probes in Task 8 are concrete.

**Type consistency:** `fetchOverpassLines(bbox, kind)` returns `{coords,kind,name}[]`; consumers read `.coords`/`.kind`. `clipPolylineToBlock(pts, insideBlock)` → `{x,z}[][]`; `buildLineSegments(runs, …)` consumes `{x,z}[][]`. `terrain.blockFootprint()` shape matches `makeInsideBlock(...)` arg. `OSM_MIN_ZOOM` exported from roads-layer, imported by water-layer. `isLineSegments2` used in disposal + the clip probe. Consistent.

**Note:** Tasks 3/5/6/7 are browser-verified (THREE/DOM); their gate is Task 8's in-browser probes + the `outsideBlock:0` proof.
