# ShibuMap polish batch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Every task: work in **C:\Dev\monolith-terrain** (branch feat/orbital-globe) — begin Bash with `cd /c/Dev/monolith-terrain &&`; stage ONLY the files you edit (never `git add -A`).

**Goal:** A batch of fixes + small features (clouds/fog defaults, material trims + above-sea-level option + scroll fix, road detail slider + colour + faithful far-view data, region-mode block depth + cut-edge sealing) plus a 4-level UI hierarchy rework.

**Architecture:** Mostly targeted edits to existing modules. New pure helpers: Overpass road-detail filter (tested), region mask edge-segments via marching squares (tested). New shader uniform for above-sea-level material gating.

**Tech Stack:** Three.js r172, vanilla JS ESM, Vite, `node --test`.

## Global Constraints

- Vanilla JS ESM; pure logic unit-tested (`node --test`, register new test files in `package.json`); rendering/UI browser-verified.
- Clouds & fog OFF by default in all modes.
- OSM full fidelity preserved (SP2 rule) — the road-detail notch changes WHICH highway classes are queried, never simplifies geometry.
- Above-sea-level material: below `uSeaY` the surface shows the hypsometric map colour.
- Region-mode block: depth follows `params.plinthDepth`; the cut edge is sealed to the plate.
- UI: strict 4-level hierarchy — L1 panel title (12.5px/700/+0.02em/Title), L2 section (12.5px/600/Title), L3 sub-group (10.5px/600/+0.06em/UPPERCASE/muted), L4 control label (12px/500/Sentence). Same level ⇒ identical weight/case/typeface/size; one spacing token per relationship.
- Follow existing patterns (build-id guards, dispose on rebuild).

---

### Task 1: Defaults (clouds/fog OFF) + remove 5 relief materials

**Files:** Modify `src/main.js` (param defaults), `src/material-catalog.js`.

- [ ] **Step 1: Clouds/fog defaults** — in `src/main.js` `params`, set `cloudsEnabled: false` and `fogEnabled: false` (find the current defaults and flip them). Verify nothing else force-enables them at init: grep `cloudsEnabled`/`fogEnabled` in main.js and confirm init respects the param (clouds not built when false; `scene.fog` null when false). If an init line hard-sets fog/clouds on, gate it on the param.

- [ ] **Step 2: Remove 5 materials** — in `src/material-catalog.js` `MATERIALS`, delete the entries with `id` `rock064`, `snow015`, `fabric`, `fabric048`, `wood`. Leave their categories in `MATERIAL_CATEGORIES` (empty categories are already filtered out by `materialsByCategory()`).

- [ ] **Step 3: Verify** — `cd /c/Dev/monolith-terrain && node --check src/main.js src/material-catalog.js && node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`. Expected: OK, tests green, build OK.

- [ ] **Step 4: Commit** — `git add src/main.js src/material-catalog.js && git commit -m "feat: clouds/fog off by default; trim 5 relief materials"`

---

### Task 2: Material picker scroll-jump fix

**Files:** Modify `src/ui/shaders-panel.js`.

- [ ] **Step 1: Read `renderPicker`** in `src/ui/shaders-panel.js`. It rebuilds the whole `.ce-mat-pick` grid via `replaceChildren()` on every tile click (via `renderPicker()` in the tile handler), which resets `matPick.scrollTop`.

- [ ] **Step 2: Update highlight in place instead of rebuilding.** Change the tile click handler so selecting a material does NOT call `renderPicker()`; instead it calls `ctx.setSurfaceMat(id); renderMat();` and updates the `.on` class in place:
```js
    b.addEventListener('click', () => {
      ctx.setSurfaceMat(id)
      matPick.querySelectorAll('.ce-mat-vig.on').forEach((t) => t.classList.remove('on'))
      b.classList.add('on')
      renderMat()
    })
```
Keep `renderPicker()` itself (used by `registerRefresh` for template/exclusivity changes) — but there, preserve scroll: wrap its body with `const st = matPick.scrollTop; …; matPick.scrollTop = st`.

- [ ] **Step 3: Verify** — `node --check src/ui/shaders-panel.js && npx vite build 2>&1 | tail -1`. (Browser-verified in Task 10.)

- [ ] **Step 4: Commit** — `git add src/ui/shaders-panel.js && git commit -m "fix(map): keep relief-material scroll position on select"`

---

### Task 3: Region-mode block depth follows plinthDepth (G4-E)

**Files:** Modify `src/main.js` (the `buildRegionPlate` call site).

- [ ] **Step 1: Find the call** — grep `buildRegionPlate` in `src/main.js`. It's called with `{ maskCanvas, params, topY, ... }` and currently no `height` (so it defaults to `PLATE_HEIGHT`). Read the surrounding region-mode wiring.

- [ ] **Step 2: Pass the depth** — add `height: (params.plinthDepth ?? PLATE_HEIGHT)` to the call (import `PLATE_HEIGHT` from `region-plate.js` if a fallback is wanted, or use the square slab's own depth scaling if `plinthDepth` is already in world units — check how the square slab (`computeSlab`) consumes `plinthDepth` and match the scaling so region + square depths feel identical). Ensure the region plate rebuilds when `plinthDepth` changes (find where the square slab rebuilds on the depth slider and add the region-plate rebuild there, or reuse the existing region rebuild path).

- [ ] **Step 3: Verify** — `node --check src/main.js && npx vite build 2>&1 | tail -1`. (Browser-verified Task 10: region mode + move the depth slider → plate thickness changes.)

- [ ] **Step 4: Commit** — `git add src/main.js && git commit -m "fix(block): region plate thickness follows plinth depth"`

---

### Task 4: Road detail 3-notch + manual colour

**Files:** Modify `src/map/overpass.js` (+ `test/overpass.test.js`), `src/map/roads-layer.js`, `src/main.js` (params), `src/ui/map-panel.js` (controls).

**Interfaces:** `buildQuery(bbox, kind, detail=0)` — for roads, `detail` selects the highway predicate; `roadHighwayFilter(detail): string` returns the Overpass tag predicate.

- [ ] **Step 1: Failing test** — add to `test/overpass.test.js`:
```js
import { roadHighwayFilter } from '../src/map/overpass.js'
test('roadHighwayFilter: 0 major, 1 drivable, 2 all', () => {
  assert.match(roadHighwayFilter(0), /motorway\|trunk\|primary/)
  assert.equal(/residential/.test(roadHighwayFilter(0)), false)
  assert.match(roadHighwayFilter(1), /residential/)
  assert.equal(/footway|path/.test(roadHighwayFilter(1)), false)
  assert.equal(roadHighwayFilter(2), '["highway"]') // all
})
```
Run: `cd /c/Dev/monolith-terrain && node --test test/overpass.test.js` → FAIL.

- [ ] **Step 2: Implement** in `src/map/overpass.js`:
```js
export function roadHighwayFilter(detail = 0) {
  if (detail >= 2) return '["highway"]'
  const major = 'motorway|trunk|primary'
  const drivable = major + '|secondary|tertiary|residential|unclassified|service|living_street'
  return `["highway"~"^(${detail >= 1 ? drivable : major})(_link)?$"]`
}
```
Update `buildQuery(bbox, kind, detail = 0)`: for `kind === 'roads'` use `way${roadHighwayFilter(detail)}(${b});`; water unchanged. Thread `detail` through `fetchOverpassLines(bbox, kind, { detail, ...})` and into the cache key (`bboxKey` must include detail: append `:${detail}` for roads).

- [ ] **Step 3: Test pass** — `node --test test/overpass.test.js` → PASS. Keep the existing 4 tests green.

- [ ] **Step 4: Params + roads-layer** — in `src/main.js` params add `roadsDetail: 0`, `roadColor: ''`. In `src/map/roads-layer.js`: pass `params.roadsDetail` into `fetchOverpassLines(bounds, 'roads', { detail: params.roadsDetail })`; set `const ink = params.roadColor || (params.darkMode ? '#d9c7b0' : '#3a3128')`.

- [ ] **Step 5: Map-panel controls** — in `src/ui/map-panel.js` Roads section add (after Roads opacity): a 3-step slider `Détail routes` (min 0 max 2 step 1, get/set `params.roadsDetail`, set→`ctx.rebuildMapLayers()`), and a colour control `Couleur routes` (get/set `params.roadColor`, set→`ctx.rebuildMapLayers()`; empty allowed). Use the kit's `slider`/`color`.

- [ ] **Step 6: Add roadsDetail/roadColor to TEMPLATE_KEYS** in `src/templates-user.js` (map-style group).

- [ ] **Step 7: Register test line already present; verify** — `node --check` the 4 files, `node --test 2>&1 | grep -iE "tests |pass |fail "`, `npx vite build 2>&1 | tail -1`.

- [ ] **Step 8: Commit** — `git add src/map/overpass.js test/overpass.test.js src/map/roads-layer.js src/main.js src/ui/map-panel.js src/templates-user.js && git commit -m "feat(map): 3-notch road detail + manual road colour"`

---

### Task 5: Above-sea-level material option (G2)

**Files:** Modify `src/terrain.js` (uniform + shader), `src/main.js` (param + ctx), `src/ui/shaders-panel.js` (checkbox), `src/templates-user.js`.

- [ ] **Step 1: Uniform** — in `src/terrain.js` `mapUniforms`, add `uMatAboveZero: { value: 0 }`. Declare `uniform float uMatAboveZero;` in the fragment `#include <common>` injection (near the other material uniforms).

- [ ] **Step 2: Shader gate** — in the fragment, right AFTER the existing material-noise `effTint`/`paintShade` block (the one before `diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * paintShade, effTint);`), add:
```glsl
  if (uMatAboveZero > 0.5) {
    float below = 1.0 - smoothstep(uSeaY - 0.05, uSeaY + 0.05, vWorldPos.y);
    effTint = max(effTint, below);           // below sea → show the map paint
    paintShade = mix(paintShade, 1.0, below);
  }
```
(`uSeaY` and `vWorldPos` already exist in this shader.)

- [ ] **Step 3: Setter** — in `src/terrain.js` add `setMatAboveZero(v) { this.mapUniforms.uMatAboveZero.value = v ? 1 : 0 }`. In `setMaterialMode`, seed it from params in the opaque branch (`this.setMatAboveZero(params.terrainMatAboveZero)`) and force 0 in the glass/none branches.

- [ ] **Step 4: Param + ctx** — `src/main.js`: `params.terrainMatAboveZero = false`; in the shaders-panel ctx add `getMatAboveZero: () => params.terrainMatAboveZero, setMatAboveZero: (v) => { params.terrainMatAboveZero = v; terrain.setMatAboveZero(v) }`. Add `terrainMatAboveZero` to `TEMPLATE_KEYS`.

- [ ] **Step 5: Checkbox** — in `src/ui/shaders-panel.js` opaque-material controls (the `renderMat` else-branch, next to Scale/Bump/Roughness/Noise), add `toggle({ label: 'Au-dessus du niveau zéro', get: () => ctx.getMatAboveZero(), set: (v) => ctx.setMatAboveZero(v) })`.

- [ ] **Step 6: Verify** — `node --check` the files, `node --test`, `npx vite build`. (Browser Task 10: enable a material near a coast, toggle on → below-sea shows map colour.)

- [ ] **Step 7: Commit** — `git add src/terrain.js src/main.js src/ui/shaders-panel.js src/templates-user.js && git commit -m "feat(map): relief material above-sea-level-only option"`

---

### Task 6: Regenerate faithful far-view roads data (G3)

**Files:** Modify `scripts/build-mapdata.mjs`; regenerate `public/data/map/roads.json`.

- [ ] **Step 1: Per-layer epsilon** — in `scripts/build-mapdata.mjs`, give roads a near-lossless epsilon (~`0.0005`) instead of the aggressive value, and use 5-decimal quantization for roads (keep others as-is). If the script has a global `round`/epsilon, parameterize per layer so ONLY roads change.

- [ ] **Step 2: Regenerate** — `cd /c/Dev/monolith-terrain && npm run build:mapdata` then `ls -la public/data/map/roads.json`. Expected: roads ~5–8 MB (up from 1.95 MB), other files unchanged. Spot-check a road feature has many vertices again (`node -e "const r=require('./public/data/map/roads.json');console.log(r.features.length, r.features.reduce((a,f)=>a+f.geometry.coordinates.length,0))"`).

- [ ] **Step 3: Commit** — `git add scripts/build-mapdata.mjs public/data/map/roads.json && git commit -m "fix(map): regenerate far-view roads near-lossless (faithful shapes)"`

---

### Task 7: Region mask edge-segments (marching squares) — pure, TDD (G4-F)

**Files:** Create `src/map/mask-contour.js`, `test/mask-contour.test.js`.

**Interfaces:** `maskEdgeSegments(data, size, threshold=127): {x0,z0,x1,z1}[]` — world-XZ iso segments along the mask 0.5 boundary (world via `px/size - 0.5)*TERRAIN_SIZE`).

- [ ] **Step 1: Failing test** — `test/mask-contour.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maskEdgeSegments } from '../src/map/mask-contour.js'
// 4x4 RGBA mask, white 2x2 block in the middle → a closed boundary of 4 segments
function mask(size, white) { const d = new Uint8ClampedArray(size*size*4); for (const [x,y] of white) d[(y*size+x)*4]=255; return d }
test('a solid block yields a closed ring of edge segments', () => {
  const size = 4
  const white = []; for (let y=1;y<3;y++) for (let x=1;x<3;x++) white.push([x,y])
  const segs = maskEdgeSegments(mask(size, white), size)
  assert.ok(segs.length >= 4, `got ${segs.length} segments`)
  // every segment endpoint within the world bounds
  for (const s of segs) for (const v of [s.x0,s.z0,s.x1,s.z1]) assert.ok(Math.abs(v) <= 28.01)
})
test('all-black mask yields no segments', () => {
  assert.equal(maskEdgeSegments(new Uint8ClampedArray(16*4), 4).length, 0)
})
```
Run → FAIL.

- [ ] **Step 2: Implement** `src/map/mask-contour.js` (standard marching-squares edge emission; interpolate endpoints on cell edges; map px→world):
```js
import { TERRAIN_SIZE } from '../terrain.js'
// Emit iso-0.5 boundary segments of a white-on-black mask via marching squares.
// data: RGBA (red channel), size: square edge. Returns world-XZ segments.
export function maskEdgeSegments(data, size, threshold = 127) {
  const at = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? 0 : data[(y * size + x) * 4] > threshold ? 1 : 0)
  const toW = (p) => (p / size - 0.5) * TERRAIN_SIZE
  const segs = []
  // edge midpoints per cell (top,right,bottom,left of the cell at (x,y)..(x+1,y+1))
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1)
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl
      if (c === 0 || c === 15) continue
      const T = { x: x + 0.5, y }, R = { x: x + 1, y: y + 0.5 }, B = { x: x + 0.5, y: y + 1 }, L = { x, y: y + 0.5 }
      const push = (a, b) => segs.push({ x0: toW(a.x), z0: toW(a.y), x1: toW(b.x), z1: toW(b.y) })
      // 16-case table (ambiguous 5/10 split into two segments)
      const E = { 1: [L, B], 2: [B, R], 3: [L, R], 4: [T, R], 5: [[L, T], [B, R]], 6: [T, B], 7: [L, T],
        8: [L, T], 9: [T, B], 10: [[L, B], [T, R]], 11: [T, R], 12: [L, R], 13: [B, R], 14: [L, B] }
      const e = E[c]
      if (Array.isArray(e[0])) { push(e[0][0], e[0][1]); push(e[1][0], e[1][1]) } else push(e[0], e[1])
    }
  }
  return segs
}
```

- [ ] **Step 3: Test pass** → PASS. Append `test/mask-contour.test.js` to `package.json` `"test"`.

- [ ] **Step 4: Commit** — `git add src/map/mask-contour.js test/mask-contour.test.js package.json && git commit -m "feat(block): mask edge-segments via marching squares (region skirt)"`

---

### Task 8: Region cut-edge skirt build + wiring (G4-F)

**Files:** Modify `src/region-plate.js` (skirt geometry), `src/main.js` (build/dispose alongside plate).

**Interfaces:** `buildRegionSkirt({ maskCanvas, sample, plateTopY, params }): THREE.Mesh | null` — walls along the mask boundary from `sample(x,z)` (terrain height) down to `plateTopY`, plinth-wall material.

- [ ] **Step 1: Implement `buildRegionSkirt`** in `src/region-plate.js` (uses `maskEdgeSegments` from `./map/mask-contour.js`):
```js
import { maskEdgeSegments } from './map/mask-contour.js'
export function buildRegionSkirt({ maskCanvas, sample, plateTopY, params = {} }) {
  const size = maskCanvas.width
  const data = maskCanvas.getContext('2d').getImageData(0, 0, size, size).data
  const segs = maskEdgeSegments(data, size)
  if (!segs.length) return null
  const pos = [], nor = []
  const pushTri = (ax,ay,az,bx,by,bz,cx,cy,cz) => {
    const ux=bx-ax,uy=by-ay,uz=bz-az, vx=cx-ax,vy=cy-ay,vz=cz-az
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx
    const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l
    pos.push(ax,ay,az,bx,by,bz,cx,cy,cz); for(let i=0;i<3;i++) nor.push(nx,ny,nz)
  }
  for (const s of segs) {
    const y0 = sample(s.x0, s.z0), y1 = sample(s.x1, s.z1)
    // quad (x0 top→bottom, x1 top→bottom) as two tris, both windings via DoubleSide
    pushTri(s.x0,y0,s.z0,  s.x0,plateTopY,s.z0,  s.x1,y1,s.z1)
    pushTri(s.x1,y1,s.z1,  s.x0,plateTopY,s.z0,  s.x1,plateTopY,s.z1)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(params.plinthColor ?? '#d8d4cc'), roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat); mesh.name = 'region-skirt'; mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
```
(`THREE` is already imported in region-plate.js.)

- [ ] **Step 2: Wire into main.js** — where `buildRegionPlate` result is added to the scene, also build `buildRegionSkirt({ maskCanvas, sample: (x,z)=>terrain.sample(x,z), plateTopY: <the plate top world Y used for the plate>, params })`, add its mesh to the scene, and dispose it together with the region plate (same lifecycle: on new region / region off). Match the plate's `topY` so the skirt bottom meets the plate top.

- [ ] **Step 3: Verify** — `node --check src/region-plate.js src/main.js && node --test 2>&1 | grep -iE "tests |pass |fail " && npx vite build 2>&1 | tail -1`. (Browser Task 10: a region whose border cuts a mountain → the cut face is now walled down to the plate, no see-through.)

- [ ] **Step 4: Commit** — `git add src/region-plate.js src/main.js && git commit -m "feat(block): seal region cut edge with a wall skirt to the plate"`

---

### Task 9: UI hierarchy rework — 4-level system (G5)

**Files:** Modify `src/ui/v28.css` (type + spacing tokens), `src/ui/kit.js`, `src/ui/shell.js` if needed, and normalize labels across the panels. Use `design-taste-frontend`/`frontend-design`/`ux-copy` for the exact refinement.

- [ ] **Step 1: Define the 4-level tokens in `v28.css`.** Establish/verify classes for each level and make same-level elements identical:
  - L1 `.ce-panel-title` — 12.5px, 700, letter-spacing .02em, text-transform none (Title case in markup), icon accent.
  - L2 `.ce-section-head .ce-section-title` — 12.5px, 600, none, Title case.
  - L3 sub-group headings — unify `.ce-fx-head` and `.ce-mat-cat` (and any category cap) to ONE treatment: 10.5px, 600, letter-spacing .06em, text-transform uppercase, color var(--ce-muted), margin token.
  - L4 control labels (`.ce-label`, slider/toggle/color label spans) — 12px, 500, none, Sentence case, color var(--ce-ink).
  Introduce spacing tokens (e.g. `--ce-gap-control: 8px`, `--ce-gap-group: 14px`) and apply: gap between controls, extra gap before an L3 sub-group, section body padding. Remove ad-hoc margins that conflict.

- [ ] **Step 2: Normalize markup** — audit each panel builder (`create-panel.js`, `map-panel.js`, `shaders-panel.js`, `camera-panel.js`, `scan-panel.js`, `explore-panel.js`) and ensure every heading/label uses the correct level class. Merge duplicate sub-group classes to the unified L3. Fix any label using the wrong weight/case.

- [ ] **Step 3: ux-copy pass** — make wording + casing consistent per level (e.g. all L4 labels Sentence case, all L3 UPPERCASE, consistent terms FR/EN as the app already uses). Keep it light — rename only what's inconsistent.

- [ ] **Step 4: Verify** — `node --check` the JS files, `npx vite build 2>&1 | tail -1`. (Browser Task 10: panels read as a clean nested hierarchy in light + dark; same-level items visually identical.)

- [ ] **Step 5: Commit** — `git add src/ui/*.css src/ui/*.js && git commit -m "refactor(ui): strict 4-level panel type + spacing hierarchy"`

---

### Task 10: Browser verification + ship

- [ ] **Step 1: Preview + verify each item.** Start preview; run probes / screenshots:
  - Clouds/fog OFF on load (params false, `scene.fog` null, no cloud mesh).
  - Picker: removed materials absent (no rock064/snow015/fabric/fabric048/wood tiles); clicking a tile keeps `.ce-mat-pick` scrollTop (scroll down, click, assert scrollTop unchanged).
  - Above-sea-level: enable a material on a coastal patch, toggle on → sample below-sea pixels show map/ocean colour, above-sea show the material.
  - Roads: far view faithful (visual); at z≥12 move the 3-notch → OSM child/segment count grows with detail; set a road colour → line colour changes; `usingOsm` still correct.
  - Region depth: enter isolate-zone, move depth slider → plate thickness changes.
  - Region skirt: pick a region whose border crosses high terrain → the cut face is walled to the plate (no see-through); screenshot.
  - UI: screenshot panels light + dark; confirm the 4 levels read cleanly.
- [ ] **Step 2:** `node --test 2>&1 | grep -iE "tests |pass |fail "` all green; `npx vite build` clean.
- [ ] **Step 3:** Final whole-branch review (opus) over the batch range; fix Critical/Important.
- [ ] **Step 4:** Deploy prod + push both branches; update memory (defaults changed; removed materials; road detail/colour; above-sea option; region depth+skirt; UI 4-level system).

---

## Self-Review
**Spec coverage:** G1 defaults→T1; G2 removals→T1, above-zero→T5, scroll→T2; G3 data→T6, 3-notch+colour→T4; G4-E depth→T3, G4-F skirt→T7+T8; G5 UI→T9; verify/ship→T10. ✓
**Placeholders:** none (G9 tokens are concrete values). **Types:** `roadHighwayFilter(detail)`→`buildQuery(...,detail)`→`fetchOverpassLines(...,{detail})`→`bboxKey` incl. detail (T4 consistent); `maskEdgeSegments`(T7)→`buildRegionSkirt`(T8) consistent; `uMatAboveZero`/`setMatAboveZero`/`terrainMatAboveZero` consistent (T5). ✓
**Note:** T7 pure-tested; T3/T8/T9 browser-verified in T10 (geometry/CSS). T8 (skirt) + T9 (UI) are the heavy items.
