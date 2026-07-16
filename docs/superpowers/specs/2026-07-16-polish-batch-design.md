# ShibuMap polish batch — design

**Date:** 2026-07-16
**Status:** design, awaiting approval
**Scope:** A batch of fixes + small features + a UI hierarchy rework, grouped into
5 areas. Two items are substantial (region edge-closure G4-F, UI rework G5); the
rest are quick-to-medium. One spec, sequenced in the plan.

---

## G1 — Defaults: clouds & fog OFF everywhere

- `params.cloudsEnabled` default → **false**; `params.fogEnabled` default → **false**.
- Ensure OFF at init and preserved across mode switches (surface / globe / export)
  — clouds not built, `scene.fog = null`.
- Templates already carry `fogEnabled`; leave existing templates as-authored (a
  template may still turn fog on). This only changes the app default.

## G2 — Relief materials

**Remove** from `src/material-catalog.js` (and thus the picker + `OPAQUE_TERRAIN_MATS`),
in order: **rock064** (Roche pâle), **snow015** (Neige tassée), **fabric** (Denim),
**fabric048** (Laine), **wood** (Bois). (Templates referencing a removed id fall back
to Topographic — `setMaterialMode` already treats an unknown id as "none".)

**"Above sea level only" option** (checkbox in the material controls): a new
`terrainMatAboveZero` param. When on, the relief material paints only where the terrain
is **above sea level**; below sea level the surface shows the **topographic map colour**
(hypsometric / ocean paint) — "ce qu'il y a en dessous". Shader: in the opaque-material
fragment (the `mix(diffuseColor, mapCol*paintShade, effTint)` block, terrain.js), when
`uMatAboveZero > 0.5` push `effTint → 1` (map paint) wherever the fragment height
`hWorld <= uSeaY` (a smoothstep band around sea level for a clean edge). New uniform
`uMatAboveZero`; reuse the existing height varying + `uSeaY`.

**Picker scroll-jump fix** (`src/ui/shaders-panel.js`): clicking a material must NOT
reset the `.ce-mat-pick` scroll. Cause: `renderPicker()` does `replaceChildren()` on
click, resetting `scrollTop`. Fix: on select, **update the `.on` highlight in place**
(toggle the class on the tiles) instead of rebuilding the grid — or capture/restore
`matPick.scrollTop` around the rebuild. Prefer the in-place highlight update.

## G3 — Roads

**Restore far-view fidelity (Natural Earth tier).** The aggressive Douglas–Peucker
ruined road shapes. Regenerate `public/data/map/roads.json` with a **near-lossless**
epsilon (~0.0005°, visually identical) — target ~5–8 MB — and drop 4-decimal quantization
to 5 for roads. Delete the current over-simplified file (overwrite). `build-mapdata.mjs`
gains a per-layer epsilon so roads use the gentle value while others keep theirs.

**3-notch detail slider** (`params.roadsDetail`, 0/1/2, default **0 = principales**),
in the Map panel's Roads controls. Governs the **OSM (Overpass) tier**:
- notch 0: major only — `highway ~ motorway|trunk|primary` (+ `_link`).
- notch 1: + all drivable — add `secondary|tertiary|residential|unclassified|service|living_street`.
- notch 2: + paths — add `footway|path|cycleway|steps|bridleway|track|pedestrian`.
Implemented as a `highway` value regex passed into the Overpass query builder
(`buildQuery(bbox, 'roads', detail)`), so heavier detail only fetches when asked. The
Natural Earth far tier is inherently major-axis and unaffected by the notch.

**Manual road colour** (`params.roadColor`, default `''` = auto). A colour control in
the Roads section. When set, overrides the dark-mode auto ink for the road line colour
(casing still the contrasting tone). Empty = current theme-aware behaviour.

## G4 — Blocks (region / "isolate the zone")

**E — plinth depth drives the region plate height.** The region plate is built with a
**fixed** `PLATE_HEIGHT` (1.2). Pass `params.plinthDepth` (same scaling the square slab
uses) as the `height` into `buildRegionPlate(...)` at its main.js call site, so the depth
slider works in region mode.

**F — seal the cut edge to the plate (the hard one).** When an admin boundary cuts terrain
mid-slope (a mountain sliced at the region silhouette), the terrain's vertical cut face is
open — you see under it; the block doesn't "close" down to the plate. Fix: build a **wall
skirt along the region mask contour**, from the terrain surface height down to the plate
top. Approach:
1. Extract the mask silhouette as world-XZ polyline contour(s) — marching-squares on the
   region mask canvas at the 0.5 iso (a small new pure, tested helper), mapped to world
   via the same `xz/TERRAIN_SIZE` convention the mask uses.
2. For each contour edge, sample `terrain.sample` at both ends → build a vertical quad
   from the terrain surface down to the plate top (`topY`), with the plinth-wall material
   (matches `region-plate.js`).
3. Add this skirt mesh alongside the region plate (built/disposed together).
This is the riskiest item; it gets its own tasks and careful browser verification.

## G5 — UI / UX hierarchy rework (design-driven)

Rework the panel hierarchy for real legibility — "poupées russes": elements at the same
hierarchy level share weight, case, typeface, size, and spacing, per typographic rules.
Define and apply a strict **4-level scale** across the panel kit (`src/ui/kit.js`,
`shell.js`, `v28.css`) and any inconsistent labels:

| Level | Element | Proposed treatment |
|---|---|---|
| L1 | Panel title (Create, Map, Shaders…) | 12.5px, 700, +0.02em, Title case, icon |
| L2 | Section header (Layers, Colors…) | 12.5px, 600, none, Title case, chevron |
| L3 | Sub-group label (Appearance, Relief material, category caps) | 10.5px, 600, +0.06em, UPPERCASE, muted |
| L4 | Control label (slider/toggle/color) | 12px, 500, none, Sentence case |

Plus a consistent **vertical rhythm**: fixed gaps between controls, between a control and
its sub-group, and section padding — one spacing token per relationship, no ad-hoc margins.
Audit the current panels (Create, Map, Shaders, Camera, Scan, Explore) and normalize every
label/heading to its level (many are currently mixed — e.g. `.ce-fx-head` vs `.ce-mat-cat`
vs `.ce-label`). A `/ux-copy` pass unifies wording + casing per level. This is a design
task: the exact tokens are refined with `design-taste-frontend` / `frontend-design`, but
the 4-level system above is the contract.

---

## Testing / verification
- Pure/unit (`node --test`): the roads Overpass detail→regex mapping; the marching-squares
  contour helper (G4-F); the gentle-epsilon build output shape.
- Browser: clouds/fog off by default; each removed material gone + picker scroll preserved
  on click; above-zero material shows map colour below sea level; roads far view faithful;
  3-notch changes OSM density; road colour override; region plate depth responds to the
  slider; region cut edge sealed on a mountainous border; the panels read as a clean
  4-level hierarchy in light + dark.

## Sequencing (for the plan)
Quick wins first (G1 defaults, G2 removals+scroll, G3 colour+detail wiring, G4-E depth),
then G2 above-zero shader, G3 data regen, then the two heavy items (G4-F edge skirt, G5 UI
rework) with their own verification.
