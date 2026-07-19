# Spec 1 — progress ledger

Plan: docs/superpowers/plans/2026-07-14-spec1-rangement-quick-wins.md
Baseline (v37-v40 committed): cc1918a
Test baseline: 86/86 green

Execution order: 1 → 2 → 3 → 4 → 5 → 7 → 6

- [x] Task 1: FLAGS module + water OFF (commit a9006d7, review clean)
- [x] Task 2: studio lighting OFF (commit 7d3c370, review clean)
- [x] Task 3: fine-detail cut z<=6 (commit bbb5a43, review clean, 90/90)
- [x] Task 4: z4 continental tier (commit cdf0c0f, review clean, 90/90)
  - MINOR (for final review): staircase test dropped stepZoom(11,1)/stepZoom(12,1,14) refine assertions (brief-mandated); pickDiveTier assertions out of altitude order (readability)
- [x] Task 5: city labels above relief (commit a7aaf3e, controller-reviewed diff clean, 90/90)
- [x] Task 7: thin coastline stroke (commit c606434, controller-reviewed diff clean, 90/90)
- [x] Task 6: docs/fonctions.md (commit b5c39ab)

All 7 tasks implemented + verified. Range cc1918a..015f59a.
- Browser verification (controller): water null + Water/Studio-preset sections absent, base sun rig present, z6/z4 detail=0, z4 loads source=real exag 2.5, z9 detail=0.02, no console errors. Tasks 5/7 code-verified (deterministic).
- Final whole-branch review (opus): MERGE-READY: yes, 0 Critical/Important, 3 Minor (2 fixed in 015f59a, 1 readability left).
- Tests: 90/90. SPEC 1 COMPLETE.

## Log
(baseline v37-v40 frozen in 5 commits b11db7a..cc1918a; specs+plan 22aefec/14f3e27/7962f46)

---

# Spec 2 Phase 1 — côte vectorielle NE (z4-z8)

Plan: docs/superpowers/plans/2026-07-14-spec2-phase1-cote-vectorielle.md
Baseline: 692a740 (after Task 1 data)  ·  Tests: 90/90

- [x] Task 1: NE 10m land data (commit 692a740, 1.8MB, validated)
- [x] Task 2: coast-mask.js + tests (commit 4da3017, review clean, 93/93)
  - MINOR (final review): lat/lon unused in fetchCoastMask; patchLatLonBBox dup of geo.tileToLatLon; antimeridian patches unhandled (Phase-1 limitation, falls back)
- [x] Task 3: terrain.js shader uCoastMask (commit 642cea3, review clean, 93/93)
  - MINOR: stale/doubled coastline comment above the gated block (cosmetic)
- [x] Task 4: main.js wiring + live verify (commit 3b3d9d2, controller-reviewed, 93/93)
  - LIVE VERIFIED: coastMaskOn=1 @z4-8 / =0 @z9; land/sea correct vs real geo (Rome/Naples/Florence=land, Corsica/Sardinia islands=land, Tyrrhenian/Adriatic/Ligurian=sea); Netherlands polders (DEM -3m)=LAND; North Sea=sea; 0 console errors; clean coastline render on slab.

Final whole-branch review (opus, 692a740~1..3b3d9d2): MERGE-READY: yes, 0 Critical.
- Important #1 (cache disposed-while-cached + unbounded growth) → FIXED in b275c20 (LRU cap 16, setCoastMask no longer disposes, in-flight promise memoised). Live-verified Italy->France->Italy.
- Minor: lat/lon unused; patchLatLonBBox dup; antimeridian unhandled; stale comment. Left (non-blocking).
SPEC 2 PHASE 1 COMPLETE. Tests 93/93. Prod still v34 (nothing pushed/deployed).

---

# Spec — Map layers panel (SP1)

Plan: docs/superpowers/plans/2026-07-15-map-layers-panel.md
Baseline: f723b7e  ·  Branch: feat/orbital-globe

- [x] Task 1: build-mapdata + data (commits 996df30..966f6f2, review clean)
  - sizes: roads 1.95MB, coastline 471KB, rivers 473KB, lakes 305KB, places 276KB
  - MINOR (watch at render): coastline DP epsilon 0.09° may look blocky; build-script re-simplifies per scalerank pass (one-time, fine)

- [x] Task 2: geo-data.js + tests (commit 182d1cd, review Minor→fixed)
  - fix: registered test/geo-data.test.js in npm test script (commit follow-up). 101/101.

- [x] Task 3: draped-line.js + tests (commit edc1a36, review clean, 104/104)
  - implementer fixed brief float32 test (10.1 not exact in Float32) — good catch

- [x] Task 4: place-pick.js + tests (commit 084dcdf, review clean, 106/106)
  - MINOR (final review): test2 does not isolate halfLimit (maxN:1 short-circuits); code correct, brief-inherited gap

- [x] Task 5: text-label.js (commit 3372c10, controller-reviewed verbatim+node-check, browser-verify deferred)

- [x] Task 6: line-object.js Line2 builder (commit 1686808, controller-reviewed, vite build OK)
  - NOTE: THREE.Color(rgba) drops alpha; layers set material.opacity globally so inert

- [x] Task 7: roads-layer.js (commit 77a5367, controller-reviewed verbatim+node-check)
  - NOTE: 2 Line2 per ring (casing+ink) = draw calls; watch perf on dense patches

- [x] Task 8: water-layer.js (commit a0a8b4c, controller-reviewed; brief ring-bug corrected via ringsOf helper)
  - MINOR (final review): superseded rebuild drops built Line2 objs without explicit .dispose() -> small GPU leak on rapid zone switch (roads/places share pattern)

- [x] Task 9: places-layer.js (commit 70b5fb7, controller-reviewed verbatim; cities.js preserved for Task 11)

- [x] Task 10: layer-manager.js (commit a16c2b1, controller-reviewed verbatim)

- [x] Task 11: main wiring + retire cities.js + move controls (commit ec9f853, reviewer sonnet Spec✅ Quality Approved, 110/110)
  - rebuild call site in regenerateTerrain; setSurfaceVisible in Modes hook; rebuildMapLayers closes live dem/terrain/params; __exp exposes mapLayers+rebuildMapLayers

- [x] Task 12: map-panel.js + wiring (commit 9550237, controller-reviewed + BROWSER-VERIFIED)
  - LIVE @Chamonix/Annecy z10: Map panel [Layers/Contours&grid/Markers]; roads 3/water 7/places 4 all built+visible; draping exact (place +0.06, road +0.08 = sample+offset, Y follows terrain -0.39..0.46); depthTest true (realistic occlusion); dark-mode ink flips light (halo); contour uniform 0.5->0.9; 0 console errors; ANNECY serif label w/ halo renders.

Final whole-branch review (opus, f723b7e..HEAD): MERGE-READY yes, 0 Critical.
- Important #1 (applyUserTemplate did not rebuild layers) FIXED in 93986f7 + verified (rebuilds 0->3).
- Important #2 (Line2 resolution not updated on resize) FIXED in 93986f7 + verified (onResize 1009x910->1234x567).
- Minor (water superseded-build GPU leak) FIXED in 93986f7 (roads/places correctly guard before build).
- Left as known Minors: casing rgba alpha inert (cosmetic); antimeridian world-span; toggle rebuilds all 3; waterFill not implemented (spec-optional trim); dead create-panel props.
SP1 COMPLETE. Tests 110/110. Ready to ship.

---

# Spec — Map layers SP2 (OSM detail + block clip)

Plan: docs/superpowers/plans/2026-07-15-map-layers-osm-sp2.md
Baseline: 9ae7c5c  ·  Branch: feat/orbital-globe

- [x] Task 1: block-clip.js + tests (commit 3ee9b2a, reviewer Spec✅ Quality Approved)
  - hard-constraint verified: boundary() returns inside point, both crossings pass inside-arg first -> no emitted vertex outside block
  - MINOR: dead ternary in <2pt guard (both branches []); test gap (no start-out->in->out double-bisect case); scratch report files collide with SP1 (overwrite in future tasks)

- [x] Task 2: overpass.js + tests (commit 378b4a8, reviewer Spec✅ Quality Approved, 4/4)
  - full fidelity confirmed: parseOverpass 1:1 [lon,lat] map, no thinning; fetch never throws + evicts on fail
  - MINOR: throttle _lastAt race across roads+water same tick (best-effort); fetch untested (browser)

- [x] Task 3: line-segments.js (commit be668b1, controller-reviewed verbatim, vite build OK)

- [x] Task 4: terrain blockFootprint + regionSample (commit 5a09f27, controller-reviewed, repo integrity verified 249 files)
  - NOTE: subagent hit a git-index scare (git add -A staged 248 deletes); self-fixed; final commit clean 1 file. Future dispatches: stage only own files.

- [x] Task 5: roads-layer OSM tier + clip + batch (commit c7e4284, controller-reviewed, 120/120)

- [x] Task 6: water-layer OSM rivers + NE lakes/coast + clip + batch (commit e801f78, controller-reviewed, 120/120)

- [x] Task 7: manager isOsmActive/isLoading + OSM credit + loading (commit 5b2a860, controller-reviewed, 120/120)

- [x] Task 8: BROWSER-VERIFIED (Geneva z13)
  - usingOsm true; 0 of 496036 segment vertices outside block (HARD CONSTRAINT PROVEN); 496k verts = full detail no simplify; 10 batched LineSegments2; OSM credit visible; z10 fallback -> NE + credit hidden; 0 console errors.
  - region-cutout clip: code-verified (blockFootprint regionSample wired + unit-tested), not live-exercised (avoid Nominatim flake).

Final whole-branch review (opus, 9ae7c5c..HEAD): both HARD constraints provably hold (full fidelity + nothing leaves block across all tiers/fallback/region orientation).
- BLOCKER (ODbL credit missing on regenerateTerrain zoom path) FIXED in fce30e7 + verified (code wired L1109-1110; deterministic credit=flex when isOsmActive).
- Important (usingOsm true on NE fallback) FIXED + live-confirmed (overpass fail -> usingOsm false, credit hidden).
- Minors FIXED: dead loading indicator (reorder), region-mode corner over-clip (corner=0 when regionOn), concave bulge (step 0.3 in region mode).
- Left non-blocking: overpass bbox unpadded; throttle race; dead <2pt ternary.
NOTE: public Overpass throttled me after heavy verification (expected quota reality); NE fallback graceful. SP2 COMPLETE, 120/120.

---

# Spec — polish batch (defaults/materials/roads/blocks/UI)

Plan: docs/superpowers/plans/2026-07-16-polish-batch.md
Baseline: 1892f65  ·  Branch: feat/orbital-globe

- [x] Task 1: clouds/fog off default + trim 5 materials (commit af7793a, controller-reviewed diff, 120/120, browser-confirmed no fog/clouds)

- [x] Task 2: relief-material scroll preserved on select (commit 5205181, controller-reviewed diff)

- [x] Task 3: region block depth follows plinthDepth (commit 6bbc907, DONE_WITH_CONCERNS)
  - DISCOVERY: region-plate.js/buildRegionPlate is DEAD; live region block = region-skirt.js buildRegionSkirt (already welds walls to terrain along mask iso, drops to baseY=min-plinthDepth). Depth already read plinthDepth; bug was the Thickness slider light-rebuild path not re-welding the skirt. Fixed by wrapping plinth.rebuild (monkey-patch — NOTE for final review, cleaner would be create-panel slider handler).
  - TASKS 7 & 8 (mask-contour + buildRegionSkirt) = REDUNDANT, CANCELLED (skirt already exists). G4-F to be re-scoped after browser investigation (likely: patch-edge ±HALF not walled where region reaches it).

- [x] Task 4: 3-notch road detail + road colour (commit 2a7dae3, controller-reviewed, 121/121)
  - roadHighwayFilter(0/1/2), buildQuery detail, bboxKey detail-keyed; roadsDetail/roadColor params+panel+TEMPLATE_KEYS

- [x] Task 5: above-sea-level material option (commit aece02b, controller-reviewed shader, 121/121)
  - uMatAboveZero uniform+decl; GLSL below-sea shows mapCol; setter seeded opaque / zeroed glass+none

- [x] Task 6: regenerate roads near-lossless (commit 94dfe60, 7.08MB / 230182 verts vs 1.95MB / 35333, other files unchanged)
- [ ] Tasks 7 & 8: CANCELLED (region-skirt.js already implements the cut-edge seal). G4-F re-scoped to T10 browser investigation.

- [x] Task 9: 4-level UI hierarchy (commit 23186d2, 121/121 node --test, build OK — 117 via npm-list, all pass)
  - unified L1-L4 type; merged fx-head/mat-cat/utpl-cat -> L3; spacing tokens; casing/colour fixes; stray FR->EN
  - browser-verify hierarchy pending (T10)

- [x] G4-E VERIFIED: Thickness slider re-welds region skirt (plinthDepth 7->2, skirt minY -7.96->-2.96).
- [x] G4-F: patch-edge walls added to region-skirt traceSkirt (commit e572640). VERIFIED: 2124 verts at |x|/|z|=28, tris 2088->2786, block closes at patch boundary.
- [x] UI hierarchy VERIFIED via screenshot: L1 titles / L2 sections / L3 uppercase-muted sub-groups (RELIEF MATERIAL/PREMIUM/SHADERS) / L4 sentence controls — consistent poupees russes.
- [x] clouds not rendering (0 meshes), scroll preserved (77 vs 80 not 0), 5 materials removed (17 tiles).

Final whole-branch review (opus, 1892f65..HEAD): MERGE-READY yes, 0 Critical, 0 Important. Monkey-patch safe, above-sea shader correct, detail cache correct, patch-edge skirt correct, labels not broken, defaults off all modes, templates round-trip.
- Minor #1 (double region-skirt rebuild) + #3 (stale wood comment) FIXED in follow-up commit.
- Left non-blocking: roadColor cannot reset to auto (color input); notch2 = all highway (superset of paths); rare patch-edge z-fight sliver; material-catalog labels stay French.
POLISH BATCH COMPLETE. 121/121. T7/T8 cancelled (skirt pre-existed).

---

# Spec — parcours/shortcuts/UI/routes batch (A-E)

Plan: docs/superpowers/plans/2026-07-16-parcours-shortcuts-ui-batch.md
Baseline: 8f92ed7  ·  Branch: feat/orbital-globe

- [x] W1 T1: road casing toggle + far-view rank detail (commit e3b723a, controller-reviewed, 121/121)

- [x] W1 T2: GeoNames places.json 40k/1.58MB + popToMinZoom tested (commit 7fd768a, controller-reviewed)

- [x] W1 T3: progressive place density + GeoNames credit (commit c190277, 123/123). WAVE 1 VERIFIED: GeoNames 40k (Shanghai/min_zoom4), 20 rendered @z10, casing param, credit shows.

- [x] W2 T4: Camera panel -> left under Scan (commit f92ce97, controller-reviewed, 123/123)

- [x] W2 T5: Templates panel above Create + Reset map (commit 03ba9e9, big refactor)
  - WAVE 2 VERIFIED: left Explore/Scan/Camera, right Templates/Create/Shaders/Map; Reset map clears look (roads/fog false) keeps location; 0 console errors.

- [x] W3 T6: history.js undo/redo module + tests (commit e4927bc, controller-reviewed, 128/128)

- [x] W3 T7: shortcuts registry + overlay + top-bar button + undo/redo (commit 183c4c0, 135/135). WAVE 3 VERIFIED: overlay 34 shortcuts grouped by category, opens via button + ?, R toggles roads, Numpad5 fires, Ctrl+Z reverts roads (undo works), 0 console errors.

- [x] W4 T8: Route panel + width/colour/auto-contrast casing (commit 605d9ac, 139/139)

- [x] W4 T9: gradient/glow/shimmer + tick (commit b54f1e1, 139/139)

- [x] W4 T10: points/naming/start-finish/km markers (commit 4f7e8a8, 139/139)

- [x] W4 T11: reveal playback + animated readouts (commit a12b364, 139/139). WAVE 4 VERIFIED: Route panel; casing+gradient(vertexColors)+glow+shimmer(dashed) active; playback isPlaying+headLabel+headT advances; 45 group children; 0 console errors.

Final whole-branch review (opus, 8f92ed7..HEAD): MERGE-READY yes, 0 Critical/Important. Undo fidelity, bindShortcuts input-inertness, GpxLayer disposal, panel wiring all sound.
- 4 Minors FIXED in 0aeff3e: GeoNames credit gated (real+surface) + refresh on orbit; route head-label hide/pause on setVisible(false); resetAll adds roadsCasing/roadColor; D dark-toggle now undoable.
- Left: uncleared 200ms play-btn interval (harmless); setWidth not updating shimmer dash scale (nit).
BATCH A-E COMPLETE. 139/139. Camera-follow intentionally skipped.

---

# Spec — roads/labels/rivers (R1-R4)
Plan: docs/superpowers/plans/2026-07-16-roads-labels-rivers.md
Baseline: 0b2fe3c

- [x] R1: road OSM threshold by notch (notch2->z10, notch1->z11, notch0->z12)

- [x] R3: rivers blue + natural width (commit 1e2ecbe, 461->10771 features, strokeweight bucketed widths)

- [x] R2: floating city labels above summits, pop-sized (commit 575b3a1, 144/144)

- [x] R3 FIX: riverWidthPx remapped to the REAL NE strokeweight range 0.1-2 (was assuming 0-9 -> every river hit the floor). sqrt curve: 0.9px rill -> 3.5px trunk; median 0.2 -> 1.5px.
  - R1-R3 VERIFIED: rivers blue #2b7fc4 with 6 distinct rendered widths; labels = floating sprites above summits (y 4.97 vs ground -0.73), depthTest off, sizeAttenuation off, scales vary by pop. R1 OSM-by-notch logic correct but OSM fetch throttled during verification (env limit).

- [x] R4: OSM water-area polygons filled+draped+clipped (commit dbe2b32, 153/153, 4 new tests; degrades to lines when Overpass throttles)
BATCH R1-R4 COMPLETE. 153/153. Live-verify of OSM tiers blocked by Overpass rate-limit in this env (logic unit-tested + graceful fallback confirmed).

- [x] FIX: city label size — BASE_H 0.09 -> 0.018. sizeAttenuation:false makes sprite.scale CLIP-space (2.0 = full viewport height), so 0.09*labelScale rendered names at ~1/6 screen. Now ~14-16px on 910px viewport, verified by screenshot (ANNECY reads as a proper map label).

- [x] 4 fixes: labels (BASE_H 0.013 + placesSize slider + SCREEN-SPACE declutter greedy pop-desc + throttled refresh; halo off by default + toggle); roads detail = 3 real levels 1-3 (NE scalerank cap 3/4/5 -> 10024/15731/19838, OSM threshold 12/11/10) + casing off by default; lakes & seas FILL re-enabled (shared _buildFilledRing with OSM areas).
  - VERIFIED @Milan z6 density2: labels 13-16px no overlap, no casing, no halo, 5 water fill meshes (Garda/Como/Maggiore visible filled).
