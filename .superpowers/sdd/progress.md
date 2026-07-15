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
