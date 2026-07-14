# Spec 1 — Rangement + quick wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ranger ShibuMap avec des feature-flags (mer + éclairage studio OFF, code gardé), couper le fine-detail au zoom lointain, ajouter un palier continent z4, rendre les labels villes toujours lisibles, et produire un fichier de suivi des fonctions.

**Architecture:** Un module `src/flags.js` central pilote l'init + l'UI des features en développement. Les changements de zoom (fine-detail par-zoom, palier z4) passent par des helpers purs testables (`src/zoom-detail.js`, `src/modes.js`). Les fixes de rendu (labels) et le doc de suivi sont directs.

**Tech Stack:** JavaScript ES modules (vanilla), Three.js r172, Vite, test runner `node --test`. Aucune nouvelle dépendance.

## Global Constraints

- Mécanisme dev/prod = **feature-flags dans le code**, OFF par défaut pour le dev ; le code reste dans le repo, réactivable en changeant le flag à `true`.
- **Trafic aérien varié = ON en prod** (ne pas toucher `traffic.js` init).
- **Fine-detail = coupure nette à z≤6** (z4/z5/z6 → detail 0 ; z7+ inchangé).
- **Palier continent = z4** ajouté ; le globe s'ouvre au-dessus de z4.
- Ne PAS toucher au pipeline de données côtières (Spec 2) : `sea-mask.js`, `dem.js`, la logique côte/mer restent en l'état.
- **Three.js reste en r172** (pas de bump — jugé risqué).
- Le déploiement en prod est un **feu vert manuel d'Adrien** — le plan produit l'état de code propre, il ne pousse pas.
- Suite de tests toujours verte (86/86 au départ) ; les helpers purs nouveaux ont leurs tests ajoutés au script `npm test`.
- Vérification des changements de rendu/UI : preview navigateur (outils MCP `preview_*` / `read_page` / `read_console_messages`), pas de test unitaire pour le WebGL/DOM.

---

### Task 1: Module de flags + Mer OFF

**Files:**
- Create: `src/flags.js`
- Modify: `src/main.js` (import ~L38 ; `realWater` init L410 ; call sites L881, L933, L1295, L1711)
- Modify: `src/ui/create-panel.js` (section Water L176-188)

**Interfaces:**
- Produces: `FLAGS` (named export) — `{ water: boolean, lightingPresets: boolean }`. Consommé par Task 2, et par `main.js` / `create-panel.js`.

- [ ] **Step 1: Créer le module de flags**

Create `src/flags.js`:
```js
// Central feature flags. The default value here is exactly what ships to
// production. OFF (false) means: skip the module's initialisation AND its UI
// section, so there are no orphan controllers and no empty panels. The
// feature's code stays in the repo — flip the flag to true to bring it back.
export const FLAGS = {
  water: false, // v37 water simulation (ocean.js) — rejected by Adrien, kept disabled
  lightingPresets: false, // v40 studio presets + 24h slider (lighting.js) — rejected, kept disabled
}
```

- [ ] **Step 2: Importer FLAGS dans main.js**

In `src/main.js`, next to the other imports (near L38 `import { RealWater } from './ocean.js'`), add:
```js
import { FLAGS } from './flags.js'
```

- [ ] **Step 3: Gater l'init de la simulation d'eau**

In `src/main.js` L410, change:
```js
const realWater = new RealWater(scene) // the water simulation — empty until waterReal is on
```
to:
```js
// water simulation is behind FLAGS.water (v37, disabled in prod); null when off
const realWater = FLAGS.water ? new RealWater(scene) : null
```

- [ ] **Step 4: Rendre les appels realWater tolérants au null**

In `src/main.js`, guard every `realWater.` call so a null instance is a no-op:
- L881 `realWater.rebuild({ terrain, params })` → `realWater?.rebuild({ terrain, params })`
- L933 `realWater.setVisible(v)` → `realWater?.setVisible(v)`
- L1295 `const waterRebuild = () => realWater.rebuild({ terrain, params })` → `const waterRebuild = () => realWater?.rebuild({ terrain, params })`
- L1711 `realWater.update(dt, sun)` → `realWater?.update(dt, sun)`

(Lines 1313/1323 call `waterRebuild()`, which becomes a no-op via the `?.` — no change needed. `ctx.realWater` / `window.__exp.realWater` staying null is fine.)

- [ ] **Step 5: Gater la section Water de l'UI**

In `src/ui/create-panel.js`, wrap the whole Water block (L176-188, from the comment through the closing `)` of `sWat.body.append(...)`) so it only builds when the flag is on. It needs `FLAGS` — add `import { FLAGS } from '../flags.js'` at the top of the file if not already present. Then:
```js
  // ---------------------------------------------------------------- Water
  if (FLAGS.water) {
    // The water simulation (v37): translucent sunlit shallows with bold caustic
    // rays, darkening depths, gentle Beaufort sea states.
    const sWat = addTo(section('Water'))
    sWat.body.append(
      toggle({ label: 'Water simulation (beta)', get: () => params.waterReal, set: (v) => { params.waterReal = v; ctx.waterRebuild() } }),
      el('div', 'ce-label', 'GPU-heavy — may slow down some computers. Turn it off anytime.'),
      color({ label: 'Water colour', get: () => params.lakeColor, set: (v) => { params.lakeColor = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Sea state (F1–F3)', min: 1, max: 3, step: 1, get: () => params.waterWind ?? 2, set: (v) => { params.waterWind = v; ctx.realWater?.setWind(v) } }),
      slider({ label: 'Transparency', min: 0, max: 1, step: 0.01, get: () => params.waterTransparency ?? 0.4, set: (v) => { params.waterTransparency = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Sun reflection', min: 0, max: 2, step: 0.02, get: () => params.waterSunFx ?? 1, set: (v) => { params.waterSunFx = v; ctx.realWater?.setLook(params) } })
    )
  }
```

- [ ] **Step 6: Lancer l'app et vérifier**

Start the dev server (MCP `preview_start` with the project's launch config, or `npx vite` and open the local URL). Then:
- `read_console_messages` → aucune erreur (pas de `Cannot read properties of null`).
- `read_page` sur le panneau Create → **aucune section "Water"**.
- La carte affiche la mer à plat (rampe océan du terrain), pas de plan d'eau animé.

Expected: app boots clean, no Water panel, flat sea renders.

- [ ] **Step 7: Vérifier la réactivation (non destructif)**

Temporarily set `FLAGS.water = true` in `src/flags.js`, reload, confirm the Water section reappears and water renders, then set it back to `false`. This proves the flag round-trips. Leave it at `false`.

- [ ] **Step 8: Commit**

```bash
git add src/flags.js src/main.js src/ui/create-panel.js
git commit -m "feat: FLAGS module + water simulation behind FLAGS.water (off in prod)"
```

---

### Task 2: Éclairage studio OFF

**Files:**
- Modify: `src/main.js` (studio init L334 ; guards in `applyLightPreset` L353, `applyTimeOfDay` L336)
- Modify: `src/ui/create-panel.js` (Light section L190-200: studio preset select + time-of-day slider)

**Interfaces:**
- Consumes: `FLAGS.lightingPresets` from Task 1.

- [ ] **Step 1: Gater l'init du rig studio**

In `src/main.js` L334, change:
```js
const studio = new StudioLighting({ scene, sun, hemi })
```
to:
```js
// studio lighting rig (8 presets + 24h cycle) is behind FLAGS.lightingPresets
// (v40, disabled in prod); null when off — the base sun/hemi rig stays active
const studio = FLAGS.lightingPresets ? new StudioLighting({ scene, sun, hemi }) : null
```

- [ ] **Step 2: Rendre applyLightPreset / applyTimeOfDay sûrs quand studio est null**

In `src/main.js`, `applyLightPreset` (L353) calls `studio.apply(...)`. Guard it:
```js
function applyLightPreset(name) {
  if (!studio) return // presets disabled — base sun rig governs
  studio.apply(name, { params, placeSun, setBackground: setStudioBackground })
}
```
`applyTimeOfDay` (L336) computes sun az/el/intensity from the hour and calls `placeSun()`; it does not touch `studio`, so it is safe as-is. Leave it. (It is only reachable from the gated UI anyway.)

- [ ] **Step 3: Gater les contrôles preset + 24h dans le panneau Light**

In `src/ui/create-panel.js`, the Light section (L190-209) currently appends the studio preset `select` (L194-196) and the time-of-day `slider` (L197-200) before the manual sun overrides. Wrap ONLY those two appends in the flag; keep the manual sun sliders (L201-209) always. `FLAGS` is already imported (Task 1). Result:
```js
  // ---------------------------------------------------------------- Light
  const sLig = addTo(section('Light'))
  if (FLAGS.lightingPresets) {
    // studio lighting presets — reconfigure sun + hemi + IBL into a photographer's rig
    sLig.body.append(
      select({ label: 'Studio preset', options: ctx.lightPresets, get: () => params.lightPreset, set: (v) => { ctx.applyLightPreset(v); refreshAll() } })
    )
    // 24 h sun cycle: one slider drives azimuth, elevation, intensity and warmth
    sLig.body.append(
      slider({ label: 'Time of day (h)', min: 0, max: 24, step: 0.25, get: () => params.timeOfDay, set: (v) => { params.timeOfDay = v; ctx.applyTimeOfDay(v); refreshAll() } })
    )
    sLig.body.append(el('div', 'ce-label', 'Manual sun overrides (also driven by the two above)'))
  }
  sLig.body.append(
    slider({ label: 'Sun intensity', min: 0, max: 16, step: 0.1, get: () => params.sunIntensity, set: (v) => { params.sunIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Sun azimuth', min: 0, max: 360, step: 1, get: () => params.sunAzimuth, set: (v) => { params.sunAzimuth = v; ctx.placeSun() } }),
    slider({ label: 'Sun elevation', min: 5, max: 85, step: 1, get: () => params.sunElevation, set: (v) => { params.sunElevation = v; ctx.placeSun() } }),
    slider({ label: 'Ambient', min: 0, max: 2, step: 0.05, get: () => params.hemiIntensity, set: (v) => { params.hemiIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Shadow fill', min: 0, max: 1.5, step: 0.02, get: () => params.envLight, set: (v) => { params.envLight = v; ctx.scene.environmentIntensity = v } }),
    slider({ label: 'Shadow softness', min: 0, max: 30, step: 0.5, get: () => params.shadowSoftness, set: (v) => { params.shadowSoftness = v; ctx.sun.shadow.radius = v } })
  )
```

- [ ] **Step 4: Lancer l'app et vérifier**

Reload the preview. Then:
- `read_console_messages` → aucune erreur.
- `read_page` sur le panneau Light → **pas de "Studio preset", pas de "Time of day"** ; les sliders Sun intensity/azimuth/elevation/Ambient/Shadow présents.
- Bouger "Sun azimuth" → l'ombrage du relief change (le rig de base répond).

Expected: no preset dropdown / 24h slider, base sun controls work.

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/ui/create-panel.js
git commit -m "feat: studio lighting presets + 24h slider behind FLAGS.lightingPresets (off in prod)"
```

---

### Task 3: Fine-detail coupé net à z≤6

**Files:**
- Create: `src/zoom-detail.js`
- Create: `test/zoom-detail.test.js`
- Modify: `package.json` (test script)
- Modify: `src/main.js` (add `syncDetailToZoom`, call in `fetchAndBuildDem` L834 area)

**Interfaces:**
- Produces: `DETAIL_DEFAULTS` (object, zoom→detail) and `detailForZoom(zoom, store, base)` (pure) — consumed by `main.js` and extended by Task 4 (`DETAIL_DEFAULTS[4] = 0`).

- [ ] **Step 1: Écrire le test qui échoue**

Create `test/zoom-detail.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DETAIL_DEFAULTS, detailForZoom } from '../src/zoom-detail.js'

test('coarse continental zooms force fine-detail to zero', () => {
  // z6 and wider: procedural stippling off (real DEM only)
  assert.equal(detailForZoom(6, {}, 0.02), 0)
  assert.equal(detailForZoom(5, {}, 0.02), 0)
  assert.equal(detailForZoom(4, {}, 0.02), 0)
})

test('z7 and finer keep the base detail', () => {
  assert.equal(detailForZoom(7, {}, 0.02), 0.02)
  assert.equal(detailForZoom(12, {}, 0.02), 0.02)
})

test('a user override in the store wins at any zoom', () => {
  assert.equal(detailForZoom(6, { 6: 0.15 }, 0.02), 0.15) // user re-added detail
  assert.equal(detailForZoom(12, { 12: 0.3 }, 0.02), 0.3)
})

test('DETAIL_DEFAULTS zeroes the coarse tiers only', () => {
  assert.equal(DETAIL_DEFAULTS[6], 0)
  assert.equal(DETAIL_DEFAULTS[5], 0)
  assert.equal(DETAIL_DEFAULTS[7], undefined) // finer zooms fall back to base
})
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node --test test/zoom-detail.test.js`
Expected: FAIL — `Cannot find module '../src/zoom-detail.js'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Create `src/zoom-detail.js`:
```js
// Per-zoom fine-detail defaults. At continental scale (z6 and wider) the DEM
// tiles are so resampled that the procedural FBM "fine detail" reads as fake
// stippling all over the plains (user feedback: the France example). So the
// default detail is forced to 0 for z4/z5/z6; z7 and finer keep the base value.
// A user-set value in the persistent store always wins, mirroring the per-zoom
// exaggeration logic in main.js.
export const DETAIL_DEFAULTS = { 4: 0, 5: 0, 6: 0 }

export function detailForZoom(zoom, store, base) {
  if (store[zoom] != null) return store[zoom]
  if (DETAIL_DEFAULTS[zoom] != null) return DETAIL_DEFAULTS[zoom]
  return base
}
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node --test test/zoom-detail.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Câbler dans main.js**

In `src/main.js`, add the import near the other local imports:
```js
import { detailForZoom } from './zoom-detail.js'
```
Add a persistent store + sync helper next to the exag ones (after `syncExagToZoom`, around L829). `BASE_DETAIL` is the current default (`params.detail` starts at 0.02, L95):
```js
const DETAIL_KEY = 'monolith.zoomDetail'
const BASE_DETAIL = 0.02
let zoomDetailStore = (() => {
  try {
    return JSON.parse(localStorage.getItem(DETAIL_KEY) || '{}') || {}
  } catch {
    return {}
  }
})()
function saveZoomDetail(z, v) {
  zoomDetailStore[z] = v
  try {
    localStorage.setItem(DETAIL_KEY, JSON.stringify(zoomDetailStore))
  } catch {}
}
// pull the current zoom's fine-detail (0 at continental scale) into params
function syncDetailToZoom() {
  params.detail = detailForZoom(params.demZoom, zoomDetailStore, BASE_DETAIL)
}
```
Then in `fetchAndBuildDem` (L834), add the call right after `syncExagToZoom()`:
```js
  syncExagToZoom() // this zoom's saved (or default) vertical exaggeration
  syncDetailToZoom() // fine-detail off at continental scale (z<=6)
```

- [ ] **Step 6: Persister l'override du slider Fine detail**

So a user re-adding detail at a coarse zoom sticks across rebuilds, make the "Fine detail" slider write to the store. In `src/ui/create-panel.js` L128, the slider is:
```js
slider({ label: 'Fine detail', min: 0, max: 0.8, step: 0.01, get: () => params.detail, set: (v) => { params.detail = v } }),
```
Change its `set` to also persist via a ctx hook: `set: (v) => { params.detail = v; ctx.saveZoomDetail?.(params.demZoom, v) }`. Then expose `saveZoomDetail` on the ctx object passed to `createPanel` in `main.js` (the ctx literal near L1451 — add `saveZoomDetail,`).

- [ ] **Step 7: Lancer l'app et vérifier (exemple France)**

Reload the preview. Search "France" (or dive out to a z6/z7 view of France). Compare with a fine view:
- À z6/z7 : le relief n'a plus le stippling procédural sur les plaines — seul le vrai relief (Alpes, Massif Central, Pyrénées) ressort (comme la 2ᵉ image de référence d'Adrien).
- À z8+ : le fine-detail est toujours là.
- `read_console_messages` → aucune erreur.

- [ ] **Step 8: Mettre à jour le script de test + commit**

In `package.json`, append `test/zoom-detail.test.js` to the `"test"` script's file list. Run the full suite:
Run: `npm test`
Expected: all green (existing + 4 new).
```bash
git add src/zoom-detail.js test/zoom-detail.test.js package.json src/main.js src/ui/create-panel.js
git commit -m "feat: fine-detail hard-cut to zero at continental zoom (z<=6), user-overridable"
```

---

### Task 4: Palier continent z4

**Files:**
- Modify: `src/modes.js` (`DIVE_TIERS`, `stepZoom`, `enterOrbit` auto-entry clamp L169)
- Modify: `test/modes.test.js` (staircase + tier assertions)
- Modify: `src/main.js` (`getCoarsenTarget` guard L985 ; `ZOOM_EXAG_DEFAULTS` L809)
- Modify: `src/zoom-detail.js` (`DETAIL_DEFAULTS[4]` already `0` from Task 3 — verify)

**Interfaces:**
- Consumes: `DETAIL_DEFAULTS` from Task 3 (already includes `4: 0`).
- Produces: `DIVE_TIERS` with a z4 entry ; `stepZoom` floored at 4 with a z5→z4 tail step.

- [ ] **Step 1: Mettre à jour les tests modes (échec attendu)**

In `test/modes.test.js`, update the two coarse assertions and add z4 coverage. Change the widening staircase test (L30-42) so the floor is z4:
```js
test('the surface staircase widens through z5 to the z4 continental block', () => {
  assert.equal(stepZoom(12, -1), 10)
  assert.equal(stepZoom(10, -1), 8)
  assert.equal(stepZoom(8, -1), 6)
  assert.equal(stepZoom(6, -1), 5)
  assert.equal(stepZoom(5, -1), 4) // z5 → z4 (one final step to the continental block)
  assert.equal(stepZoom(4, -1), 4) // continental floor
  // refining (zoom-in against the stop) unchanged: 2 steps at a time
  assert.equal(stepZoom(5, 1), 7)
  assert.equal(stepZoom(8, 1), 10)
  assert.equal(stepZoom(10, 1), 12)
})
```
And add a z4 tier assertion in the `pickDiveTier` test (near L24):
```js
  assert.equal(pickDiveTier(3000000).zoom, 5) // ~z5 block, ~3 760 km across
  assert.equal(pickDiveTier(5000000).zoom, 4) // ~z4 continental block, ~7 500 km
  assert.equal(pickDiveTier(9000000), null) // above z4 → orbit gate (globe)
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `node --test test/modes.test.js`
Expected: FAIL on `stepZoom(5,-1)` (got 5, want 4) and on the new `pickDiveTier(5000000)` (got null, want 4).

- [ ] **Step 3: Ajouter le tier z4 dans DIVE_TIERS**

In `src/modes.js`, the `DIVE_TIERS` array (L20-29) ends with `{ altM: 4000000, zoom: 5 }`. Append the z4 tier (order fine→coarse, ascending altM):
```js
  { altM: 4000000, zoom: 5 },
  { altM: 8000000, zoom: 4 }, // continental block (~7 500 km); above this the globe opens
]
```

- [ ] **Step 4: Étendre stepZoom avec le pas final z5→z4**

In `src/modes.js`, replace `stepZoom` (L39-41):
```js
export function stepZoom(zoom, dir, fine = 12) {
  if (dir > 0) return Math.min(zoom + 2, Math.max(fine, 12))
  // widen 2 steps at a time down to z5, then a single step to the z4
  // continental block before the orbit gate; floored at z4
  if (zoom <= 5) return Math.max(zoom - 1, 4)
  return Math.max(zoom - 2, 5)
}
```

- [ ] **Step 5: Lancer les tests, vérifier le succès**

Run: `node --test test/modes.test.js`
Expected: PASS.

- [ ] **Step 6: Étendre le coarsen jusqu'à z4 dans main.js**

In `src/main.js`, `getCoarsenTarget` (L983-988) stops at z5. Widen to z4:
```js
    getCoarsenTarget() {
      // widen down to the z4 continental block; past that the orbit gate opens
      if (params.source !== 'real' || !dem || params.demZoom <= 4) return null
      const { lat, lon } = worldToLatLon(dem, controls.target.x, controls.target.z)
      return { lat, lon, zoom: stepZoom(params.demZoom, -1) }
    },
```

- [ ] **Step 7: Ajouter l'exagération par défaut pour z4**

In `src/main.js` L809, extend `ZOOM_EXAG_DEFAULTS`:
```js
const ZOOM_EXAG_DEFAULTS = { 4: 2.5, 5: 5, 6: 4, 7: 3.2 }
```

- [ ] **Step 8: Relever le plafond d'entrée en orbite pour un bloc z4**

In `src/modes.js` L169 (inside `enterOrbit`), the auto-entry altitude is clamped to 6 000 000 m. A z4 block sits higher, so raise the ceiling so the handover to the globe is smooth (MAX_ALT_M = 16 000 000 already caps above this):
```js
      entryAltM = THREE.MathUtils.clamp(this.hooks.surfaceCamAltMeters() * 1.15, 15000, 9000000)
```

- [ ] **Step 9: Lancer l'app et vérifier la plongée/le dézoom**

Reload the preview. From a fine view, zoom OUT continuously against the stop and watch the announced zoom / patch scale:
- La cascade passe …→ z6 → z5 → **z4 (~7500 km, un continent entier)** → puis bascule sur le globe **au-dessus** de z4 (plus à z5).
- Re-plonger depuis l'orbite atterrit d'abord sur z4, puis z5… sans blocage.
- `read_console_messages` → aucune erreur (pas d'échec de tuile z4 ; `dem.js` charge z4 nativement).
- Le relief z4 est nu (fine-detail déjà 0 via Task 3).

- [ ] **Step 10: Commit**

```bash
git add src/modes.js test/modes.test.js src/main.js
git commit -m "feat: add z4 continental dive tier (~7500km) below z5, globe opens above it"
```

---

### Task 5: Labels villes toujours au-dessus du relief

**Files:**
- Modify: `src/cities.js` (dot material L101-107 ; name/text material ~L110-118)

**Interfaces:** none (self-contained rendering fix).

- [ ] **Step 1: Désactiver le depth-test + relever le renderOrder du point**

In `src/cities.js`, the marker dot (L101-106) uses a `MeshBasicMaterial` with `depthWrite: false` but depth-testing still on, so a peak between the camera and the dot hides it. Add `depthTest: false` and raise `renderOrder`:
```js
      const dot = new THREE.Mesh(
        dotGeo.clone(),
        new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })
      )
      dot.position.set(p.w.x, y, p.w.z)
      dot.renderOrder = 10
```

- [ ] **Step 2: Idem pour le texte du nom de ville**

Still in `src/cities.js`, the name mesh (~L110-118) uses another `MeshBasicMaterial` (`map: tex`) with `renderOrder = 3`. Add `depthTest: false` to that material and set `mesh.renderOrder = 10` so the letters always draw over the relief (fixes the truncated "PARIS"):
```js
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false })
```
and:
```js
      mesh.renderOrder = 10
```

- [ ] **Step 3: Lancer l'app et vérifier**

Reload the preview. Frame the Alps / a view where a city name sits near high relief (e.g. Paris on the France view, or any peak-adjacent city):
- Le nom complet s'affiche **par-dessus** le relief, aucune lettre tronquée par un pic.
- Les labels restent lisibles quand on incline la caméra (le pic devant ne les mange plus).
- `read_console_messages` → aucune erreur.

Take a `screenshot` (MCP `computer`) of a peak-adjacent city name as proof.

- [ ] **Step 4: Commit**

```bash
git add src/cities.js
git commit -m "fix: city labels always render above relief (depthTest off, higher renderOrder)"
```

---

### Task 7: Trait de côte plus fin et discret

**Files:**
- Modify: `src/terrain.js` (coastline block L245-250)

**Interfaces:** none (self-contained shader tweak). This changes only the line
weight/opacity of the sea-level stroke — NOT where it sits (accuracy = Spec 2).

- [ ] **Step 1: Affiner et adoucir le trait de côte**

In `src/terrain.js`, the coastline block (L245-250) currently is:
```glsl
  // --- coastline: a crisp line exactly at sea level (elevation 0), drawn in the
  // template ink so the shore is unmistakable on every look
  if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 2.5, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.9);
  }
```
Make it thinner (AA factor 2.5 → 1.3) and more discreet (mix 0.9 → 0.55):
```glsl
  // --- coastline: a fine, discreet line at sea level (elevation 0), drawn in
  // the template ink. Kept thin so the shore reads without shouting.
  if (uSeaY > -9000.0) {
    float coastAA = max(fwidth(vWorldPos.y), 1e-4);
    float coast = 1.0 - smoothstep(0.0, coastAA * 1.3, abs(vWorldPos.y - uSeaY));
    diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, coast * 0.55);
  }
```

- [ ] **Step 2: Lancer l'app et vérifier**

Reload the preview on a coastal view (Italy, or any Explore place with a shore):
- Le trait de côte est nettement **plus fin et plus discret** qu'avant, sans
  disparaître.
- `read_console_messages` → aucune erreur de compilation shader (`Shader Error`).
  ⚠️ Piège connu : un cold-load (onglet frais) dit la vérité — les erreurs de
  shader fantômes du HMR après édition d'uniforms n'existent qu'en intermédiaire.
- Take a `screenshot` (MCP `computer`) as before/after proof.

- [ ] **Step 3: Commit**

```bash
git add src/terrain.js
git commit -m "style: thinner, more discreet sea-level coastline stroke"
```

---

### Task 6: Fichier de travail `docs/fonctions.md`

**Files:**
- Create: `docs/fonctions.md`

**Interfaces:** none (documentation deliverable).

- [ ] **Step 1: Écrire la table de suivi des fonctions**

Create `docs/fonctions.md` with a living table. Fill it from the current code + the v33→v40 history. Use these columns and statuses (🟢 prod · 🟡 dev-flag OFF · ⚪ idée/backlog). Include at minimum:

```markdown
# ShibuMap — état des fonctions

Statuts : 🟢 en prod · 🟡 en dev (flag OFF) · ⚪ idée / backlog
Flags : voir `src/flags.js`. Un flag à `true` réactive la fonction.

| Fonction | Statut | Flag | Fichier(s) | Note |
|---|---|---|---|---|
| Terrain topo réel (DEM AWS Terrarium) | 🟢 | — | `dem.js`, `terrain.js` | Cœur du rendu |
| Plongée orbite ⇄ surface + globe | 🟢 | — | `modes.js`, `globe.js` | Paliers z4→z11 |
| Palier continent z4 (~7500 km) | 🟢 | — | `modes.js` | Ajouté Spec 1 |
| Fine-detail coupé au zoom lointain (z≤6) | 🟢 | — | `zoom-detail.js`, `main.js` | Ajouté Spec 1 |
| Templates de look (Iceland, Denali, …) | 🟢 | — | `templates.js` | |
| Rampe hypsométrique 8 teintes | 🟢 | — | `palette.js`, `terrain.js` | |
| Nuages volumétriques | 🟢 | — | `clouds.js` | |
| Socle / plaque 3D + cartouche | 🟢 | — | `plinth.js`, `ground-info*.js` | |
| Isolate the zone (frontières admin) | 🟢 | — | `region-mask.js`, `region-plate.js` | |
| Masque océan (anti faux-lacs) | 🟢 | — | `sea-mask.js` | Garde-fou en attendant Spec 2 |
| Labels villes (au-dessus du relief) | 🟢 | — | `cities.js` | Fix rendu Spec 1 |
| Trafic aérien varié (avions/ballon/planeur) | 🟢 | — | `traffic.js` | Validé, gardé ON |
| Loader brandé | 🟢 | — | `main.js`, loader markup | v39 |
| Bouton vue iso | 🟢 | — | `ui/bars.js` | v39 |
| Tutoriel 9 étapes | 🟢 | — | `ui/tutorial.js` | v39 |
| Scan (radar/sonar/…) | 🟢 | — | `scan.js` | |
| Export PNG/MP4 + REC live | 🟢 | — | `export*.js` | |
| Qualité adaptative | 🟢 | — | `perf.js` | |
| **Simulation d'eau (vagues/caustiques)** | 🟡 | `water` | `ocean.js`, `lake.js` | Rejetée par Adrien, code gardé |
| **Éclairage studio (8 presets + 24h)** | 🟡 | `lightingPresets` | `lighting.js` | Rejeté, code gardé |
| Côte / mer vectorielle (Natural Earth/OSM) | ⚪ | — | — | **Spec 2** — justesse côte/niveau mer |
| Eau lisible sur template Iceland | ⚪ | — | `ocean.js` | Backlog (si l'eau revient) |

_Les entrées v38/v39 (loader, iso, tuto, villes) sont marquées 🟢 par défaut — vetoables ici._
```

- [ ] **Step 2: Commit**

```bash
git add docs/fonctions.md
git commit -m "docs: living feature-status table (prod / dev-flag / backlog)"
```

---

## Self-Review

**Spec coverage:**
- Infra flags (spec §0) → Task 1 (Steps 1-2). ✓
- `docs/fonctions.md` (§1) → Task 6. ✓
- Mer OFF `water` (§2) → Task 1. ✓
- Éclairage OFF `lightingPresets` (§3) → Task 2. ✓
- Fine-detail z≤6 (§4) → Task 3. ✓
- Palier z4 (§5) → Task 4. ✓
- Labels au-dessus du relief (§6) → Task 5. ✓
- Trait de côte fin/discret (§7) → Task 7. ✓
- Critères de succès (tests verts, réactivation flag, dézoom z4→globe, labels non tronqués) → couverts par les steps de vérif de chaque task. ✓

**Placeholder scan:** aucun TBD/TODO ; tout le code des steps est concret. ✓

**Type consistency:** `FLAGS.{water,lightingPresets}` cohérent entre Task 1/2 et l'UI. `detailForZoom(zoom, store, base)` / `DETAIL_DEFAULTS` cohérents entre Task 3 (def) et Task 4 (usage `DETAIL_DEFAULTS[4]=0` déjà posé en Task 3). `stepZoom` floor 4 cohérent avec `getCoarsenTarget` guard `<= 4` et le tier z4 de `DIVE_TIERS`. `saveZoomDetail` exposé sur ctx (Task 3 Step 6) et consommé par le slider. ✓

**Ordre d'exécution :** 1 (flags+mer) → 2 (éclairage) → 3 (fine-detail) → 4 (z4, dépend de Task 3) → 5 (labels) → 7 (trait de côte fin) → 6 (doc, en dernier pour refléter l'état final). (Task 7 est placée après Task 5 dans le fichier ; la numérotation 6/7 est décorrélée de l'ordre — le doc reste la dernière tâche.)
