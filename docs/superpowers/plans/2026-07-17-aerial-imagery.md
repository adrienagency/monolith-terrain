# Aerial Imagery Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An optional, off-by-default aerial-photo skin for the terrain, fetched only for the view being looked at, from public WMTS servers we do not host.

**Architecture:** No tiles are stored or deployed. The layer resolves a *provider* from the current DEM patch's bbox (IGN for France, Swisstopo for Switzerland), fetches the tiles covering that patch directly from the provider's public WMTS, composites them into a single canvas texture, and hands it to the terrain material as an optional albedo blended over the existing hypsometric paint. Outside covered countries the layer reports "no coverage" and stays off.

**Tech Stack:** Vanilla JS ESM, Three.js r172 (`CanvasTexture`), the existing tile-index slippy maths (`src/map/tile-index.js`), the existing credits line (`refreshOsmCredit` pattern in `main.js`).

## Global Constraints

- **Default OFF.** `aerialEnabled: false`. The product's identity is the quiet editorial relief; photography is a tool the organiser reaches for, never the default look.
- **Zero hosting.** No tile ever lands in `public/`, in the repo, or in a Netlify deploy. Anything that would add megabytes to `dist/` is out of scope — the road-tile lesson (887 MB, deferred) applies to anything we *store*, and the whole point here is that we store nothing.
- **Attribution is a legal obligation, not a courtesy.** Every provider's exact string must be visible whenever its imagery is on screen, and must disappear when the layer is off. Exact strings in Task 2.
- **Licences (verified, do not re-derive):**
  - IGN BD ORTHO — Licence Ouverte Etalab 2.0, commercial use permitted, no API key, `Access-Control-Allow-Origin: *` (verified live).
  - Swisstopo SWISSIMAGE — OGD since March 2021, commercial use explicitly permitted, no key, `Access-Control-Allow-Origin: *` (verified live).
  - **Sentinel-2 cloudless (EOX) is BANNED from this project**: vintages 2018–2024 are **CC BY-NC-SA 4.0** — non-commercial. Only the 2016 vintage is CC BY 4.0. Do not wire it up.
  - **Esri World Imagery is BANNED**: grants no rights outside three enumerated ArcGIS cases.
  - Raw Copernicus Sentinel-2 *is* commercially usable, but requires building our own mosaic — explicitly out of scope for this plan (see "Deferred").
- **`node --test` stays green after every task.** `npx vite build` must succeed after every task.
- **Commit after every task.** The workstation loses power without warning; it has already corrupted the git index once and killed several agents mid-edit.

## Measured facts this plan is built on

Per-view cost, computed from the real patch widths this app uses and the real byte sizes of four fetched Annecy/Randa tiles (14.7–33.4 KB, avg ~18 KB):

| patch | imagery zoom | tiles | bytes/view |
|---|---|---|---|
| 360 km | z10 (106 m/px) | 196 | 3.4 MB |
| 91 km | z12 (27 m/px) | 196 | 3.4 MB |
| 24 km | z13 (13 m/px) | 64 | 1.1 MB |
| 13 km | z14 (6.6 m/px) | 64 | 1.1 MB |

Comparable to the existing water tiles (2.9 MB/view) — and unlike those, nothing is stored.

Visual quality, judged by looking at real fetched tiles:
- Sentinel-2 at 13 m/px over Annecy: town and lake legible but **mushy** — that is its floor.
- IGN at 3.3 m/px: individual buildings and streets. At 0.83 m/px: bridges, boats, trees, cars.
- Swisstopo at 1.66 m/px over Randa (foot of the Europaweg): chalets, tennis courts, roads — same class as IGN.

## File Structure

- **Create `src/map/aerial-providers.js`** — pure, no DOM, no THREE. Provider table: bbox, tile-URL template, max zoom, attribution string. One exported resolver `providerForBBox(bbox)`. Unit-testable in node.
- **Create `src/map/aerial-layer.js`** — fetches + composites tiles into a `CanvasTexture` for a given DEM patch. Owns its abort/caching. Browser-only.
- **Modify `src/terrain.js`** — accept an optional aerial texture uniform and blend it over the existing paint. The blend factor is what protects the product's identity.
- **Modify `src/ui/map-panel.js`** — the toggle + opacity control, gated by `visibleWhen` on coverage.
- **Modify `src/main.js`** — params, wiring, attribution line.
- **Create `test/aerial-providers.test.js`** — provider resolution, bbox containment, attribution presence.

---

### Task 1: Provider table and resolver

**Files:**
- Create: `src/map/aerial-providers.js`
- Test: `test/aerial-providers.test.js`

**Interfaces:**
- Produces: `providerForBBox(bbox) -> Provider | null` where `bbox` is `{minLon, maxLon, minLat, maxLat}` (the shape `patchBounds()` already returns in `src/map/geo-data.js`), and `Provider` is `{ id, label, maxZoom, attribution, tileUrl(z, x, y) -> string }`.
- Produces: `AERIAL_PROVIDERS` (the array), for tests and for a future settings UI.

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { providerForBBox, AERIAL_PROVIDERS } from '../src/map/aerial-providers.js'

test('providerForBBox: an Annecy patch resolves to IGN', () => {
  const p = providerForBBox({ minLon: 6.05, maxLon: 6.25, minLat: 45.8, maxLat: 45.95 })
  assert.equal(p?.id, 'ign')
})

test('providerForBBox: a Valais patch resolves to Swisstopo', () => {
  const p = providerForBBox({ minLon: 7.7, maxLon: 7.85, minLat: 46.0, maxLat: 46.2 })
  assert.equal(p?.id, 'swisstopo')
})

test('providerForBBox: an uncovered patch resolves to null, not a guess', () => {
  // Patagonia — neither provider covers it, and no world provider is wired
  // (EOX cloudless is CC BY-NC-SA, Esri grants no rights — see the plan header)
  assert.equal(providerForBBox({ minLon: -73, maxLon: -72, minLat: -51, maxLat: -50 }), null)
})

test('every provider carries a non-empty attribution string', () => {
  for (const p of AERIAL_PROVIDERS) {
    assert.ok(p.attribution && p.attribution.length > 5, `${p.id} has no attribution`)
  }
})

test('tileUrl builds a concrete URL with the coordinates substituted', () => {
  const ign = AERIAL_PROVIDERS.find((p) => p.id === 'ign')
  const url = ign.tileUrl(15, 16941, 11670)
  assert.ok(url.includes('16941') && url.includes('11670') && url.startsWith('https://'))
  assert.ok(!/\{[zxy]\}/.test(url), 'placeholders must be substituted')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/Dev/monolith-terrain && node --test test/aerial-providers.test.js`
Expected: FAIL — `Cannot find module '../src/map/aerial-providers.js'`

- [ ] **Step 3: Write minimal implementation**

```js
// Aerial-imagery providers. PURE — no DOM, no THREE, no fetch: just "which
// public WMTS covers this bbox, and what URL serves its tiles".
//
// Every provider here is fetched DIRECTLY from its public server, per view.
// We host nothing. That is the whole reason this layer is affordable — see
// the plan header's measured table (1.1-3.4 MB per view, 0 bytes stored).
//
// DO NOT ADD without checking the licence yourself:
//   - EOX Sentinel-2 cloudless: CC BY-NC-SA 4.0 for 2018-2024 vintages
//     (NON-COMMERCIAL). Only the 2016 vintage is CC BY 4.0. Banned here.
//   - Esri World Imagery: grants no rights outside three enumerated ArcGIS
//     cases. Banned here.
// Both are the obvious-looking choices, which is exactly why they're named.

// Attribution strings are LEGAL OBLIGATIONS, quoted from each provider's own
// licence page. Do not paraphrase or shorten them.
const IGN_ATTRIBUTION = 'Orthophotos © IGN — Licence Ouverte 2.0'
const SWISSTOPO_ATTRIBUTION = 'SWISSIMAGE © swisstopo'

export const AERIAL_PROVIDERS = [
  {
    id: 'ign',
    label: 'France (IGN)',
    // metropolitan France + a margin; DROM are covered by IGN too but are
    // separate bboxes — add them when a user actually needs one
    bbox: { minLon: -5.5, maxLon: 9.8, minLat: 41.2, maxLat: 51.2 },
    maxZoom: 19,
    attribution: IGN_ATTRIBUTION,
    tileUrl: (z, x, y) =>
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
      `&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  },
  {
    id: 'swisstopo',
    label: 'Suisse (swisstopo)',
    bbox: { minLon: 5.9, maxLon: 10.6, minLat: 45.8, maxLat: 47.9 },
    maxZoom: 18,
    attribution: SWISSTOPO_ATTRIBUTION,
    tileUrl: (z, x, y) =>
      `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`,
  },
]

// A patch resolves to a provider only if its CENTRE falls inside that
// provider's bbox. Centre, not overlap: a patch straddling the French border
// should not flip to IGN just because one corner clips France — the user is
// looking at whatever is in the middle of their block.
export function providerForBBox(bbox) {
  if (!bbox) return null
  const lon = (bbox.minLon + bbox.maxLon) / 2
  const lat = (bbox.minLat + bbox.maxLat) / 2
  for (const p of AERIAL_PROVIDERS) {
    const b = p.bbox
    if (lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat) return p
  }
  return null // no coverage — the UI must say so, never silently show nothing
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/Dev/monolith-terrain && node --test test/aerial-providers.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
cd /c/Dev/monolith-terrain
git add src/map/aerial-providers.js test/aerial-providers.test.js
git commit -m "feat(aerial): provider table + bbox resolver (IGN, swisstopo)"
```

---

### Task 2: Fetch and composite a patch texture

**Files:**
- Create: `src/map/aerial-layer.js`

**Interfaces:**
- Consumes: `providerForBBox` from Task 1; `tilesForBBox` from `src/map/tile-index.js` (already exists, already tested).
- Produces: `class AerialLayer` with `async buildTexture({ bbox, demZoom }) -> { texture, provider } | null`, and `dispose()`.

- [ ] **Step 1: Write the module**

There is no unit test for this task: it is a network+canvas+WebGL integration, and a mocked test would only assert that the mock was called. It is verified in the browser in Task 4 instead, where the real thing is observable. Everything *decidable* (which provider, which tiles) lives in Task 1 and IS unit-tested.

```js
// Fetches aerial tiles for the CURRENT DEM patch and composites them into one
// CanvasTexture. Nothing is stored: tiles come straight from the provider's
// public WMTS, per view. See src/map/aerial-providers.js for the licences.
import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'
import { providerForBBox } from './aerial-providers.js'

const TILE_PX = 256
// Cap the composited texture. 2048 keeps a 24 km patch at ~12 m/px on screen
// (measured: 64 tiles, ~1.1 MB) and stays inside every WebGL2 device's
// guaranteed max texture size. Raising this multiplies BOTH the fetch count
// and the VRAM, quadratically — re-measure both before touching it.
const MAX_TEXTURE_PX = 2048

export class AerialLayer {
  constructor() {
    this._texture = null
    this._buildId = 0
  }

  // Pick the imagery zoom whose tile grid just covers the patch at
  // MAX_TEXTURE_PX, clamped to what the provider actually serves.
  _zoomFor(bbox, provider) {
    for (let z = 6; z <= provider.maxZoom; z++) {
      const n = tilesForBBox(bbox, z).length
      if (n * TILE_PX * TILE_PX >= MAX_TEXTURE_PX * MAX_TEXTURE_PX) return z
    }
    return provider.maxZoom
  }

  async buildTexture({ bbox, demZoom }) {
    const id = ++this._buildId
    const provider = providerForBBox(bbox)
    if (!provider) return null // no coverage — caller shows the "unavailable" state

    const z = this._zoomFor(bbox, provider)
    const tiles = tilesForBBox(bbox, z)
    if (!tiles.length) return null

    const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y)
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    const cols = Math.max(...xs) - x0 + 1, rows = Math.max(...ys) - y0 + 1

    const canvas = document.createElement('canvas')
    canvas.width = cols * TILE_PX
    canvas.height = rows * TILE_PX
    const ctx = canvas.getContext('2d')

    // A single failed tile must not fail the whole patch — a hole in the
    // mosaic is far better than no imagery at all, and providers do
    // occasionally 404 on edge tiles.
    await Promise.all(
      tiles.map(async (t) => {
        try {
          const img = await loadImage(provider.tileUrl(t.z, t.x, t.y))
          if (id !== this._buildId) return // superseded by a newer patch
          ctx.drawImage(img, (t.x - x0) * TILE_PX, (t.y - y0) * TILE_PX)
        } catch {}
      })
    )
    if (id !== this._buildId) return null

    this.dispose()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.needsUpdate = true
    this._texture = texture
    return { texture, provider }
  }

  dispose() {
    this._texture?.dispose()
    this._texture = null
  }
}

// crossOrigin is required: both providers send Access-Control-Allow-Origin: *
// (verified live), and without this flag the canvas would be tainted and
// WebGL would refuse the texture.
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
```

- [ ] **Step 2: Verify it parses and the suite still passes**

Run: `cd /c/Dev/monolith-terrain && node --check src/map/aerial-layer.js && node --test 2>&1 | tail -6 | head -2`
Expected: no syntax error; `pass` count unchanged from before this task, `fail 0`

- [ ] **Step 3: Commit**

```bash
cd /c/Dev/monolith-terrain
git add src/map/aerial-layer.js
git commit -m "feat(aerial): fetch + composite a per-patch CanvasTexture"
```

---

### Task 3: Blend the texture into the terrain material

**Files:**
- Modify: `src/terrain.js`

**Interfaces:**
- Consumes: the `texture` from Task 2.
- Produces: `terrain.setAerial(texture | null)` and `terrain.setAerialOpacity(v)`.

- [ ] **Step 1: Add the uniforms**

In `src/terrain.js`, alongside the existing map/paint uniforms, add:

```js
uAerial: { value: null },
uAerialOn: { value: 0 },
uAerialOpacity: { value: 0.85 },
```

- [ ] **Step 2: Blend in the fragment shader**

In the `#include <color_fragment>` replacement (the same block that already
mixes the map paint), after the existing paint is resolved and BEFORE the
relief material/shader passes, add:

```glsl
if (uAerialOn > 0.5) {
  vec3 aerial = texture2D(uAerial, vMapUv).rgb;
  // Multiply by the paint's own luminance rather than replacing it outright:
  // the hypsometric shading and hillshade stay visible THROUGH the photo, so
  // the relief still reads as relief and the product keeps its own look
  // instead of becoming a plain satellite viewer.
  float shade = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, aerial * (0.6 + 0.8 * shade), uAerialOpacity);
}
```

Use the same varying the existing map paint samples with (`vMapUv` here is a
placeholder for whatever that block already uses — read it and match it; do
not introduce a second UV convention).

- [ ] **Step 3: Add the setters**

```js
setAerial(texture) {
  const u = this.mapUniforms
  u.uAerial.value = texture
  u.uAerialOn.value = texture ? 1 : 0
},
setAerialOpacity(v) {
  this.mapUniforms.uAerialOpacity.value = v
},
```

- [ ] **Step 4: Verify the terrain still compiles ON THE GPU**

`node --check` proves nothing about GLSL — a shader string is valid JS and can
still fail to compile on the card. Open the app and confirm the terrain still
draws, with no shader error in the console:

Run: `cd /c/Dev/monolith-terrain && npx vite build 2>&1 | tail -1`
Then load `http://localhost:5199` and check the console is free of
`THREE.WebGLProgram` errors and the relief renders.

- [ ] **Step 5: Commit**

```bash
cd /c/Dev/monolith-terrain
git add src/terrain.js
git commit -m "feat(terrain): optional aerial albedo blended over the hypsometric paint"
```

---

### Task 4: Wire it up — param, toggle, attribution

**Files:**
- Modify: `src/main.js`, `src/ui/map-panel.js`

**Interfaces:**
- Consumes: `AerialLayer` (Task 2), `terrain.setAerial` (Task 3), `patchBounds` from `src/map/geo-data.js`.

- [ ] **Step 1: Add the params in `src/main.js`**

```js
// Aerial photo skin — OFF by default. The product's identity is the quiet
// editorial relief; photography is a tool the organiser reaches for, not the
// default look. Covered countries only (see aerial-providers.js).
aerialEnabled: false,
aerialOpacity: 0.85,
```

- [ ] **Step 2: Build and refresh the layer**

Instantiate `const aerialLayer = new AerialLayer()` next to the other map
layers, and refresh it wherever `rebuildMapLayers()` already runs:

```js
async function refreshAerial() {
  if (!params.aerialEnabled || !dem || params.source !== 'real') {
    terrain.setAerial(null)
    refreshOsmCredit()
    return
  }
  const built = await aerialLayer.buildTexture({ bbox: patchBounds(dem), demZoom: params.demZoom })
  terrain.setAerial(built ? built.texture : null)
  aerialProvider = built ? built.provider : null
  refreshOsmCredit() // the attribution line depends on which provider is live
}
```

- [ ] **Step 3: Wire the attribution**

The attribution is a **legal obligation** and must appear only while the
imagery is on screen. In the same place `refreshOsmCredit()` already appends
the GeoNames credit, append `aerialProvider.attribution` when
`params.aerialEnabled && aerialProvider` — and nothing when the layer is off.

- [ ] **Step 4: Add the controls in `src/ui/map-panel.js`**

```js
const aerialToggle = toggle({
  label: 'Aerial photo',
  get: () => params.aerialEnabled,
  set: (v) => { params.aerialEnabled = v; ctx.refreshAerial(); refreshAll() },
})
const aerialOpacity = slider({
  label: 'Aerial opacity', min: 0, max: 1, step: 0.02,
  get: () => params.aerialOpacity,
  set: (v) => { params.aerialOpacity = v; ctx.terrain.setAerialOpacity(v) },
})
sLayers.body.append(aerialToggle, aerialOpacity)
visibleWhen(aerialOpacity, () => params.aerialEnabled)
```

- [ ] **Step 5: Verify in the browser — this is the real acceptance test**

Over **Annecy** (`demLat 45.9, demLon 6.13, demZoom 12`): switch the toggle on.
Confirm, and report the numbers:
- the photo appears, and the relief still reads through it (Task 3's blend)
- the network panel shows tiles from `data.geopf.fr` and **nothing added to `dist/`**
- bytes fetched for the view (expect ~1.1 MB at a 24 km patch)
- the IGN attribution appears in the credits line, and **disappears** when the toggle goes off
- over **Randa** (`46.02, 7.75`) the provider switches to swisstopo and its attribution replaces IGN's
- over **Patagonia** (`-50.5, -72.5`) the toggle reports no coverage rather than showing a blank terrain

- [ ] **Step 6: Commit**

```bash
cd /c/Dev/monolith-terrain
git add src/main.js src/ui/map-panel.js
git commit -m "feat(aerial): toggle, opacity, and per-provider attribution"
```

---

## Deferred, deliberately

- **World imagery.** The two obvious sources are legally unusable (EOX cloudless is CC BY-NC-SA; Esri grants no rights). Raw Copernicus Sentinel-2 *is* commercially usable but would mean building and hosting our own cloud-free mosaic — a project in itself, and at 10 m/px it is **mushy exactly at the valley scale trail organisers care about** (verified by looking at real tiles over Annecy). France + Switzerland covers the initial market at 50× the resolution, for nothing.
- **Other countries' open orthophoto services** (Austria, Italy, Spain, the Nordics all have some form). Adding one is a single entry in `AERIAL_PROVIDERS` plus its verified licence — cheap to add on demand, not worth pre-building.

## Open question for the user — a taste call, not an engineering one

The research could not settle whether photography *belongs* in this product. That is Adrien's call, and Task 3's blend factor is where it gets decided: at opacity 1.0 the app becomes a satellite viewer like every competitor; at 0.5–0.85 the photo informs while the hypsometric relief and contours still carry the identity. **Ship it at 0.85 and let him judge it on his own courses.**
