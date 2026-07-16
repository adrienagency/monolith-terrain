# Roads detail + city labels + realistic rivers — design

**Date:** 2026-07-16
**Status:** approved direction, awaiting plan
**Scope:** Four map-legibility fixes from live feedback.

## Diagnosis (grounded in the data)
- `public/data/map/roads.json` contains **only scalerank 3–5** (major roads) — no secondary
  roads exist in it, so the detail-notch scalerank filter is a no-op at distance. OSM (which
  has everything) only activates at `demZoom ≥ 12`.
- City labels are **flat planes on the terrain** (`rotation.x=-π/2`, `y=sample+0.06`,
  `depthTest:true`), **fixed world size** (no population/zoom scaling) → invisible when zoomed
  out and blending into the rock.
- Rivers: only 461 features, **fixed 1.4px** width, muted blue `#4d7fa6`, width attribute
  (`strokeweight`) was trimmed out.

## R1 — Road detail at distance
Tie the OSM tier to the detail notch so more detail = OSM roads from further out:
`OSM road threshold = roadsDetail>=2 ? 10 : roadsDetail>=1 ? 11 : 12` (in `roads-layer.js`,
replacing the constant `useOsm = zoom >= 12`). At mid-zoom (~73 km ≈ z10–11) notch 2 now
pulls full OSM roads. At continental scale (359 km ≈ z8) roads stay NE-major — full OSM there
is impractical and cartographically noisy (documented, not a bug). Keep the (harmless)
scalerank filter. Water OSM threshold unchanged.

## R2 — City labels: floating, above summits, sized by population
Rework `places-layer.js` labels from flat draped planes to **upright billboard sprites**:
- **Always above the summits:** position each label at the city's XZ but at
  `y = max(localSampledHeight, patchMaxHeight) + clearance` (compute the patch's max terrain
  height once per rebuild), and render with `depthTest:false` so it never hides behind or
  merges into a peak. A small ground **dot + a thin leader line** connects label to the city.
- **Sized by population:** sprite scale = base × f(pop) (bigger cities noticeably bigger;
  capitals bump). Multi-tier by zoom (min_zoom) preserved.
- **Readable at any zoom:** sprites keep a roughly constant on-screen size (size-attenuation
  tuned / distance-compensated) so pulling the camera back doesn't shrink them — "plus on est
  loin, plus le nom reste gros". Serif face + contrast halo retained (reuse `makeLabelTexture`).
- Keep the world-space declutter (`pickPlaces` minDist) so labels don't overlap.

## R3 — Rivers blue + natural width (Natural Earth tier)
- Regenerate `rivers.json` from **Natural Earth 10m** (rivers_lake_centerlines + the europe /
  north-america supplements for density) keeping `strokeweight` (NE's cartographic width, 1–9)
  and `scalerank`. `build-mapdata.mjs` keeps the extra property for rivers.
- `water-layer.js`: river line **width ∝ strokeweight** (map 1–9 → ~0.8–3.0 px), and a
  clearly **blue** ink (e.g. `#2b7fc4` light / `#7fb2d6` dark). Lakes/coastline also bluer.

## R4 — Realistic river width via OSM water areas (zoomed tier)
When the water OSM tier is active (`demZoom ≥ 12`), in addition to waterway LINES, fetch
**water AREAS** and render them as **filled blue polygons draped on the relief** — real river
shapes with genuine thin/wide variation:
- `overpass.js`: a `fetchOverpassAreas(bbox)` querying `way["natural"="water"]`,
  `way["waterway"="riverbank"]`, `relation["natural"="water"]` with `out geom` (relations →
  outer ways). Returns polygon rings ([lon,lat][], with holes where present).
- `water-layer.js`: for each polygon, build a `THREE.Shape` (outer + holes), triangulate with
  **`THREE.ShapeUtils.triangulateShape`**, project vertices to world, **drape** (sample terrain
  height + small offset), clip to the block footprint (reuse `makeInsideBlock`; drop tris whose
  centroid is outside), build a filled blue `MeshBasicMaterial` mesh (depthWrite:false,
  polygonOffset to avoid z-fight). Streams (`waterway` lines without an area) stay thin blue
  lines. Cache + throttle like the existing Overpass calls; ODbL credit already shown.
- Fallback: OSM area fetch failure → the NE strokeweight lines (never blank).

## Testing
- `node --test`: strokeweight→width mapping (pure); population→sprite-scale (pure); the
  road-notch→OSM-threshold mapping; overpass area query string + polygon parse (rings/holes).
- Browser: at ~73 km, notch 2 shows dense OSM roads; city names float above the summits,
  bigger for bigger cities, readable when zoomed out; rivers are blue with visibly varying
  width (thin streams, wide rivers), and at OSM zoom big rivers render as filled bands.

## Sequencing
R1 (roads threshold) → R3 (NE rivers width+blue, incl. data regen) → R2 (labels) → R4 (OSM
water polygons — heaviest), deploy after R1–R3 then after R4.
