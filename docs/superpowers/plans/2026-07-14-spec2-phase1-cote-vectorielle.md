# Spec 2 Phase 1 — Côte vectorielle Natural Earth (z4–z8) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remplacer, au zoom coarse (z4–z8), la côte déduite de l'isoligne 0 m du DEM par un masque terre/mer rastérisé depuis Natural Earth 10m — trait de côte et classification terre/mer qui suivent les vraies cartes.

**Architecture:** Un jeu Natural Earth 10m « land » simplifié (lazy-fetch) est rastérisé par patch en masque terre/mer 2048² (aligné au DEM, comme `region-mask.js`), poussé au shader terrain via un uniform `uCoastMask`. Le shader décide terre/mer d'après le masque (pas l'altitude) et trace la côte à son contour 0.5. Gaté : hors z4–z8 ou en cas d'échec, repli exact sur le comportement actuel.

**Tech Stack:** JS ES modules, Three.js r172, Vite, `node --test`. Données préparées avec `mapshaper` (build-time, déjà fait — voir Task 1). Aucune nouvelle dépendance runtime.

## Global Constraints

- Phase 1 = **z4–z8 uniquement**. Hors de cette plage → repli EXACT sur le rendu actuel (isoligne 0 m + `sea-mask.js`), aucune régression.
- Source = **Natural Earth 10m land**, domaine public, **aucune attribution requise**, aucune clé, **aucune dépendance runtime nouvelle**.
- La donnée est **lazy-fetchée** (`public/data/land-10m.json`), JAMAIS dans le bundle initial.
- Ne PAS toucher : `dem.js`, le mode « isolate the zone » (`region-mask.js` reste fonctionnel), la logique z9+.
- `sea-mask.js` reste le garde-fou z9+ (inchangé).
- Three.js reste r172. Suite de tests verte (90/90 au départ).
- Le déploiement reste la décision d'Adrien.
- Vérif rendu = preview navigateur (`javascript_tool` sondes + `read_console_messages` ; screenshots intermittents — préférer les sondes DOM/pixel). Piège connu : erreurs shader fantômes en HMR intermédiaire → seul un cold-load dit la vérité.

---

### Task 1: Ajouter la donnée Natural Earth 10m land

**Files:**
- Create: `public/data/land-10m.json` (le fichier simplifié, ~1.8 MB — déjà produit dans le scratchpad)
- Create: `public/data/land-10m.README.md` (provenance + commande de reprod)

**Interfaces:** none (asset). Produces: `public/data/land-10m.json` — FeatureCollection GeoJSON WGS84 de la terre émergée.

- [ ] **Step 1: Copier le fichier de données préparé**

Le fichier a déjà été téléchargé et simplifié (build-time). Copier depuis le scratchpad :
```bash
cp "C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/land_18.json" "C:/Dev/monolith-terrain/public/data/land-10m.json"
```

- [ ] **Step 2: Valider le GeoJSON**

```bash
node -e 'const g=require("./public/data/land-10m.json"); const n=g.features.length; let pts=0; for(const f of g.features){const mp=f.geometry.type==="Polygon"?[f.geometry.coordinates]:f.geometry.coordinates; for(const poly of mp) for(const r of poly) pts+=r.length;} console.log("type",g.type,"features",n,"points",pts)'
```
Expected: `type FeatureCollection features 11 points 82450` (± selon la version NE). Taille ~1.8 MB.

- [ ] **Step 3: Documenter la provenance**

Create `public/data/land-10m.README.md`:
```markdown
# land-10m.json

Natural Earth 1:10m "land" polygons (`ne_10m_land`), **public domain** —
no attribution required. Lazy-fetched at runtime by src/coast-mask.js to build
the coarse-zoom (z4–z8) land/sea mask; never bundled.

Reproduction (build-time, needs npx):
1. curl -sL -o ne_10m_land.geojson \
   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson
2. npx mapshaper ne_10m_land.geojson -simplify 18% keep-shapes -o land-10m.json format=geojson

Simplified to ~18% (Visvalingam, keep-shapes) → crisp coastline through z8,
~1.8 MB. Bump the percentage for more fidelity if Phase 2 wants it.
```

- [ ] **Step 4: Commit**
```bash
git add public/data/land-10m.json public/data/land-10m.README.md
git commit -m "data: Natural Earth 10m land polygons (public domain) for coarse coastline mask"
```

---

### Task 2: `src/coast-mask.js` — masque terre/mer par patch

**Files:**
- Create: `src/coast-mask.js`
- Create: `test/coast-mask.test.js`
- Modify: `package.json` (add the test file to the `test` script)

**Interfaces:**
- Consumes: `latLonToWorld` (`geo.js`), `TERRAIN_SIZE` (`terrain.js`).
- Produces:
  - `patchLatLonBBox(dem) → {west,south,east,north}` (pure)
  - `bboxIntersects(a, b) → boolean` (pure; a,b = {west,south,east,north})
  - `ringBBox(ring) → {west,south,east,north}` (pure; ring = [[lon,lat],...])
  - `landPolygonsInBBox(features, bbox) → Array<rings>` (pure; rings = GeoJSON polygon = [outer, ...holes])
  - `fetchCoastMask({lat, lon, zoom, dem}) → Promise<{maskTexture}|null>` (browser; null outside z4–z8 or on failure)
  - `COAST_ZOOM_MIN = 4`, `COAST_ZOOM_MAX = 8`

- [ ] **Step 1: Write the failing test — `test/coast-mask.test.js`**
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bboxIntersects, ringBBox, landPolygonsInBBox } from '../src/coast-mask.js'

test('bboxIntersects: overlap, touch, and disjoint', () => {
  const a = { west: 0, south: 0, east: 10, north: 10 }
  assert.equal(bboxIntersects(a, { west: 5, south: 5, east: 15, north: 15 }), true)
  assert.equal(bboxIntersects(a, { west: 10, south: 0, east: 20, north: 10 }), true) // edge touch
  assert.equal(bboxIntersects(a, { west: 11, south: 0, east: 20, north: 10 }), false)
  assert.equal(bboxIntersects(a, { west: 0, south: 11, east: 10, north: 20 }), false)
})

test('ringBBox spans the ring extent', () => {
  const bb = ringBBox([[2, 3], [-1, 8], [4, -2], [2, 3]])
  assert.deepEqual(bb, { west: -1, south: -2, east: 4, north: 8 })
})

test('landPolygonsInBBox keeps only polygons whose bbox meets the patch', () => {
  const features = [
    { geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } }, // near origin
    { geometry: { type: 'Polygon', coordinates: [[[50, 50], [51, 50], [51, 51], [50, 51], [50, 50]]] } }, // far
    { geometry: { type: 'MultiPolygon', coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]],   // near
      [[[80, 80], [81, 80], [81, 81], [80, 80]]], // far part of same feature
    ] } },
  ]
  const bbox = { west: -1, south: -1, east: 2, north: 2 }
  const kept = landPolygonsInBBox(features, bbox)
  // the near single polygon + the near part of the multipolygon = 2 rings-groups; the two far ones dropped
  assert.equal(kept.length, 2)
  assert.ok(kept.every((rings) => Array.isArray(rings) && Array.isArray(rings[0])))
})
```

- [ ] **Step 2: Run it, verify it FAILS**

`node --test test/coast-mask.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement `src/coast-mask.js`**
```js
// COASTLINE MASK — the real land/sea boundary at coarse zoom (z4–z8).
//
// At coarse zoom the DEM's 0 m isoline is a poor proxy for the true coast
// (flat coastal plains shift it kilometres; bilinear smoothing erodes shape).
// So we stop deriving land/sea from elevation and rasterize a REAL vector
// coastline instead: Natural Earth 1:10m "land" polygons (public domain),
// filtered to the patch bbox and drawn white-on-black over the exact DEM
// footprint — the same georeferencing region-mask.js uses. The terrain shader
// samples this as uCoastMask and decides land/sea from it (see terrain.js).
//
// Self-contained rasterizer (small, deliberate ~25-line overlap with
// region-mask.js) so the working "isolate the zone" path is left untouched.

import * as THREE from 'three'
import { latLonToWorld } from './geo.js'
import { TERRAIN_SIZE } from './terrain.js'

export const COAST_ZOOM_MIN = 4
export const COAST_ZOOM_MAX = 8
export const MASK_SIZE = 2048

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// ---- pure geometry (unit tested) ----

export function bboxIntersects(a, b) {
  return a.west <= b.east && b.west <= a.east && a.south <= b.north && b.south <= a.north
}

export function ringBBox(ring) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return { west, south, east, north }
}

// GeoJSON features → flat list of polygon ring-groups whose outer ring meets bbox
export function landPolygonsInBBox(features, bbox) {
  const kept = []
  for (const f of features) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const rings of polys) {
      if (!rings.length || !rings[0].length) continue
      if (bboxIntersects(ringBBox(rings[0]), bbox)) kept.push(rings)
    }
  }
  return kept
}

// lon/lat bbox of the DEM patch footprint, from its four corners
export function patchLatLonBBox(dem) {
  // sample the patch edges in world space isn't needed — the DEM already knows
  // its geographic span via its tile georef; derive corners from tile math.
  const n = 2 ** dem.zoom
  const tileToLon = (tx) => (tx / n) * 360 - 180
  const tileToLat = (ty) => {
    const m = Math.PI * (1 - 2 * (ty / n))
    return (180 / Math.PI) * Math.atan(Math.sinh(m))
  }
  const tilesAcross = dem.size / 256
  const west = tileToLon(dem.originTileX)
  const east = tileToLon(dem.originTileX + tilesAcross)
  const north = tileToLat(dem.originTileY) // north edge = smaller ty
  const south = tileToLat(dem.originTileY + tilesAcross)
  return { west, south, east, north }
}

// ---- browser rasterizer (self-contained) ----

function project(dem, lon, lat, size) {
  const w = latLonToWorld(dem, clampLat(lat), lon)
  return [(w.x / TERRAIN_SIZE + 0.5) * size, (w.z / TERRAIN_SIZE + 0.5) * size]
}

function rasterize(ringGroups, dem, size) {
  const sharp = document.createElement('canvas')
  sharp.width = sharp.height = size
  const ctx = sharp.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  for (const rings of ringGroups) {
    ctx.beginPath()
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [px, py] = project(dem, ring[i][0], ring[i][1], size)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
    ctx.fill('evenodd') // outer ring + holes
  }
  // soft coast: blur so the shader's 0.5 iso-line is smooth, not stair-stepped
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const bctx = canvas.getContext('2d')
  bctx.filter = 'blur(1.5px)'
  bctx.drawImage(sharp, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

// ---- data (lazy, memoised) ----
// public/ is served at the site root by Vite, so public/data/land-10m.json is
// fetched as 'data/land-10m.json' — the exact pattern cities.js uses.
let landPromise = null
function loadLand() {
  landPromise ??= fetch('data/land-10m.json').then((r) => {
    if (!r.ok) throw new Error(`land-10m.json → HTTP ${r.status}`)
    return r.json()
  })
  return landPromise
}

// ---- public API ----
// Build the land/sea mask for the current patch, or null when out of the
// coarse band (z4–z8) or on any failure — the caller then keeps the current
// elevation-based rendering (repli).
export async function fetchCoastMask({ lat, lon, zoom, dem }) {
  if (!dem || zoom < COAST_ZOOM_MIN || zoom > COAST_ZOOM_MAX) return null
  try {
    const fc = await loadLand()
    const bbox = patchLatLonBBox(dem)
    const rings = landPolygonsInBBox(fc.features, bbox)
    // no land in view (open ocean) is legitimate — still return a mask so the
    // shader paints all-sea rather than falling back to the noisy 0-isoline
    const tex = rasterize(rings, dem, MASK_SIZE)
    return { maskTexture: tex }
  } catch (err) {
    console.warn('coast mask failed:', err)
    return null
  }
}
```

- [ ] **Step 4: Run tests, verify PASS**

`node --test test/coast-mask.test.js` → PASS (3 tests).

- [ ] **Step 5: Add to package.json test script + full suite**

Append ` test/coast-mask.test.js` to the `"test"` script's file list. Then:
`npm test` → all green (90 + 3 = 93).
`node --check src/coast-mask.js` → OK.

- [ ] **Step 6: Commit**
```bash
git add src/coast-mask.js test/coast-mask.test.js package.json
git commit -m "feat: coast-mask.js — Natural Earth land/sea mask per patch (pure bbox filter unit-tested)"
```

---

### Task 3: `terrain.js` — intégration du masque au shader

**Files:**
- Modify: `src/terrain.js` (uniforms block ~L68; uniform decls ~L151; shader body ~L218-251; new `setCoastMask` ~L398)

**Interfaces:**
- Consumes: `terrain.setCoastMask(texture|null)` called by Task 4.
- Produces: uniforms `uCoastMask`/`uCoastMaskOn`; shader decides land/sea from the mask when on.

- [ ] **Step 1: Add the uniforms to mapUniforms (terrain.js ~L68, next to uSeaMask)**

After the `uSeaMaskOn: { value: 0 },` line, add:
```js
      uCoastMask: { value: (this._coastPlaceholder = whiteTexture()) },
      uCoastMaskOn: { value: 0 },
```

- [ ] **Step 2: Declare them in the fragment shader (terrain.js ~L152, after `uniform float uSeaMaskOn;`)**
```glsl
uniform sampler2D uCoastMask;
uniform float uCoastMaskOn;
```

- [ ] **Step 3: Sample the mask + redefine the land/sea decision (terrain.js ~L218-223)**

Replace the current block:
```glsl
  float seaMask = 1.0;
  if (uSeaMaskOn > 0.5) {
    vec2 smUv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    seaMask = texture2D(uSeaMask, smUv).r;
  }
  bool underwater = vWorldPos.y < uSeaY && seaMask > 0.5;
```
with:
```glsl
  float seaMask = 1.0;
  if (uSeaMaskOn > 0.5) {
    vec2 smUv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    seaMask = texture2D(uSeaMask, smUv).r;
  }
  // coarse-zoom coast (z4–z8): the real Natural-Earth land/sea mask is the
  // source of truth — a cell is sea because the vector coast says so, not
  // because its (noisy, coarse) DEM height dipped below 0. Fixes flooded flat
  // coasts AND phantom inland lakes. Off (z9+ / fetch failed) → old behaviour.
  float landness = 1.0;
  if (uCoastMaskOn > 0.5) {
    vec2 cmUv = vWorldPos.xz / (uSlabHalf * 2.0) + 0.5;
    landness = texture2D(uCoastMask, cmUv).r;
  }
  bool underwater = uCoastMaskOn > 0.5
    ? (landness < 0.5)
    : (vWorldPos.y < uSeaY && seaMask > 0.5);
```
(The ocean depth ramp below already `clamp`s `uSeaY - vWorldPos.y` to [0,1], so a mask-sea cell whose DEM height is ≥ 0 simply paints as shallowest water — no further change needed there.)

- [ ] **Step 4: Draw the coastline at the mask contour when active (terrain.js ~L245-251)**

Replace the coastline block:
```glsl
  if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 1.3, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  }
```
with:
```glsl
  // coastline: at coarse zoom follow the mask's 0.5 contour (the real shore);
  // otherwise the sea-level (elevation 0) isoline as before.
  if (uCoastMaskOn > 0.5) {
    float caa = max(fwidth(landness), 1e-4);
    float coast = 1.0 - smoothstep(0.0, caa * 1.5, abs(landness - 0.5));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  } else if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 1.3, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  }
```

CRITICAL PITFALL: this GLSL lives in a JS template literal — never introduce a backtick. Run `node --check src/terrain.js` after editing.

- [ ] **Step 5: Add `setCoastMask` (terrain.js, after `setRegionMask` ~L398)**

Mirror `setRegionMask` exactly:
```js
  setCoastMask(texture) {
    const prev = this.mapUniforms.uCoastMask.value
    if (texture) {
      if (prev !== texture) {
        this.mapUniforms.uCoastMask.value = texture
        if (prev && prev !== this._coastPlaceholder) prev.dispose()
      }
      this.mapUniforms.uCoastMaskOn.value = 1
    } else {
      this._coastPlaceholder ??= whiteTexture()
      this.mapUniforms.uCoastMask.value = this._coastPlaceholder
      if (prev && prev !== this._coastPlaceholder) prev.dispose()
      this.mapUniforms.uCoastMaskOn.value = 0
    }
  }
```

- [ ] **Step 6: Verify headlessly**

`node --check src/terrain.js` → OK. `npm test` → 93/93 (no test touches the shader, but confirm nothing broke).

- [ ] **Step 7: Commit**
```bash
git add src/terrain.js
git commit -m "feat: terrain shader decides land/sea from uCoastMask at coarse zoom, coastline at mask contour"
```

---

### Task 4: `main.js` — câblage + vérification live

**Files:**
- Modify: `src/main.js` (import; build/clear coast mask in `fetchAndBuildDem`)

**Interfaces:**
- Consumes: `fetchCoastMask` (Task 2), `terrain.setCoastMask` (Task 3).

- [ ] **Step 1: Import (main.js, near the other local imports)**
```js
import { fetchCoastMask } from './coast-mask.js'
```

- [ ] **Step 2: Build/clear the coast mask in fetchAndBuildDem**

In `fetchAndBuildDem` (after `await regenerateTerrain()` and near the other async layer loads like `groundInfo.load`), add a non-blocking coast-mask build that sets it on the terrain, with a cache. Add a module-level cache near the top of main.js:
```js
const coastMaskCache = new Map() // patch key → THREE texture
```
Then in `fetchAndBuildDem`, after the terrain is rebuilt:
```js
  // real coastline (Natural Earth) at coarse zoom — async, non-blocking; the
  // shader falls back to the elevation isoline until it arrives / if it fails
  {
    const key = `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}`
    const cached = coastMaskCache.get(key)
    if (cached) {
      terrain.setCoastMask(cached)
    } else {
      terrain.setCoastMask(null)
      fetchCoastMask({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, dem })
        .then((res) => {
          if (!res) return
          coastMaskCache.set(key, res.maskTexture)
          // only apply if we're still on the same patch
          const stillHere = `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}` === key
          if (stillHere) terrain.setCoastMask(res.maskTexture)
        })
        .catch(() => {})
    }
  }
```
Place this alongside the existing non-blocking loads (e.g. right after the `if (params.groundInfo) groundInfo.load(...)` line).

- [ ] **Step 3: Verify live (controller does this — the implementer stops here)**

The controller will drive the preview: load Italy (z7/z8), France (z6), Corsica, the Netherlands, and a coarse phantom-lake case, and confirm the coast follows real maps, below-sea land stays land, phantom lakes vanish, z9+ is unchanged, and no console errors. The implementer only runs `node --check src/main.js` + `npm test` (93/93).

- [ ] **Step 4: Commit**
```bash
git add src/main.js
git commit -m "feat: build Natural Earth coast mask per patch at coarse zoom (async, cached, non-blocking)"
```

---

## Self-Review

**Spec coverage:**
- §1 donnée `land-10m.json` → Task 1. ✓
- §2 masque `coast-mask.js` (filtre bbox + rastérisation) → Task 2. ✓
- §3 shader `uCoastMask` (décision terre/mer + trait de côte + repli) → Task 3. ✓
- §4 câblage `main.js` (async non-bloquant, cache, z4–8) → Task 4. ✓
- Critères de succès (Italie/France/Corse/Pays-Bas/faux lac, z9+ inchangé, échec = repli, bundle inchangé) → couverts par la vérif live de Task 4 + le gating. ✓

**Placeholder scan:** aucun TBD ; tout le code est concret. ✓

**Type consistency:** `fetchCoastMask({lat,lon,zoom,dem}) → {maskTexture}|null` cohérent Task 2↔4 ; `setCoastMask(texture|null)` cohérent Task 3↔4 ; `uCoastMask`/`uCoastMaskOn` cohérents (uniform block, decls, body, setter) dans Task 3 ; `landPolygonsInBBox` renvoie des ring-groups, consommés par `rasterize`. ✓

**Scope:** Phase 1 z4–z8 seulement ; z9+ et Protomaps explicitement hors périmètre. ✓

**Ordre d'exécution :** 1 (data) → 2 (module + tests) → 3 (shader) → 4 (wiring + vérif live).
