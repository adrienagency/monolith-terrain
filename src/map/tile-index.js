// Pure slippy-tile math for the tiled Overture water layer. No THREE, no DOM,
// no fetch — safe to import from the build script (Node) AND the client.
// Single source of truth for: the region the water tiles cover, the LOD→tile-
// zoom mapping, and the tile-covering math both the build script and the
// client tile-loader need to agree on.

// Region currently covered by tiled Overture layers: Annecy, Chamonix,
// Léman, Bourget, Geneva (lon 5.0–8.0, lat 44.5–47.0). Widen this bbox — and
// rerun EVERY `build:*tiles` script (water, road, …) — to cover more of the
// world; every consumer (build scripts, tile-loader, water-layer,
// roads-layer) keys off this one constant. `REGION` is the neutral alias new
// (non-water) tiled layers should import; `WATER_REGION` is kept as the
// original name so existing imports/tests are unaffected — both point at the
// exact same object, there is only one region.
export const WATER_REGION = { minLon: 5.0, minLat: 44.5, maxLon: 8.0, maxLat: 47.0 }
export const REGION = WATER_REGION

// LOD level → slippy tile zoom used to write/fetch tiles, and the demZoom
// band (inclusive upper bound) that LOD serves. demZoomMax: Infinity for the
// last entry means "everything above the previous band".
//   LOD0 z8  (far,  demZoom <= 8)  — only large lakes/reservoirs + major rivers
//   LOD1 z9  (mid,  demZoom 9-11)  — all lakes + river/water/reservoir
//   LOD2 z11 (close, demZoom >= 12) — everything kept
//
// LOD0 started at z7 (one zoom coarser than its demZoom ceiling, mirroring
// LOD2's z11-for-demZoom>=12 pattern) but measurement forced a change: at z7
// a single ~312 km tile can bundle several genuinely-huge lakes together
// (Léman + Neuchâtel + Thunersee + Brienzersee all landed in one tile over
// the Alps region) and the no-simplification rule means their full vertex
// count always ships, so that tile alone measured 2.3 MB — over the ~2
// MB/tile ceiling. Tightening the area gate can't fix it (Léman IS exactly
// the "large lake" LOD0 exists to show); z8 halves each tile's footprint in
// both axes instead, which is what actually separates co-located giant
// lakes into different tiles. See task-10 report for the measured before/after.
export const LOD_LEVELS = [
  { lod: 0, tileZoom: 8, demZoomMax: 8 },
  { lod: 1, tileZoom: 9, demZoomMax: 11 },
  { lod: 2, tileZoom: 11, demZoomMax: Infinity },
]

// Road tiles reuse the exact same 3-level, demZoom<=8 / 9-11 / >=12 SCHEME
// (far/mid/close) as water's LOD_LEVELS above, but need much finer slippy
// tile zooms at every level: a road network is far denser than a water/lake
// layer (measured: ~1.8M kept road segments region-wide vs. water's ~258k),
// so water's tile-zoom values would blow the ~2 MB/tile ceiling by 10-20x.
// Chosen by direct measurement (task-18 report) — for each LOD, the
// COARSEST tileZoom whose biggest tile still lands under ~2 MB, against the
// per-LOD class-rank gate in build-road-tiles.mjs:
//   LOD0 z8  (far):  motorway/trunk only     -> 3.8 MB region-wide, biggest ~1.0 MB
//   LOD1 z11 (mid):  + primary/secondary     -> 42 MB region-wide, biggest ~0.9 MB
//   LOD2 z14 (close): everything             -> ~1 GB region-wide, biggest ~1.1 MB
// LOD2's total is large in absolute terms, but that's the measured cost of
// "never simplify, never drop footway/steps at the closest zoom" applied to
// a real, densely-mapped alpine region — not a tiling inefficiency (z13
// already blows the 2 MB ceiling at ~3.1 MB biggest tile).
export const ROAD_LOD_LEVELS = [
  { lod: 0, tileZoom: 8, demZoomMax: 8 },
  { lod: 1, tileZoom: 11, demZoomMax: 11 },
  { lod: 2, tileZoom: 13, demZoomMax: Infinity },
]

// World lake layer (task 19). Unlike LOD_LEVELS/ROAD_LOD_LEVELS — which only
// ever cover REGION (the Alps box) — these tiles are written for the WHOLE
// PLANET, so there is no `inRegion` gate on this layer at all. That changes
// which tradeoff matters: for a region layer the binding constraint is
// bytes-per-tile, but for a world layer it's ALSO the total tile COUNT (one
// file per non-empty tile, worldwide), which is why the coarse LODs stay
// coarse and lean on the area floor instead of on finer tiles.
//
// Same demZoom band SCHEME as water/roads (far <=8, mid 9-11, close >=12) so
// all three layers answer "how zoomed in am I" identically — only tileZoom
// and the gate differ. Lakes are a far sparser layer than water-with-rivers
// (measured: `lake` is 23.5% of the Alps water bytes / 2.4% of the raw
// region's water vertices), so lake tiles can afford to be COARSER than
// water's at every LOD and still stay under the ~2 MB/tile ceiling.
//
// tileZoom and the per-LOD area floor are both MEASURED choices — see the
// area-band table in the task-19 report and LAKE_AREA_GATES_KM2 in
// build-world-lake-tiles.mjs. Re-measure both if you touch either.
export const LAKE_LOD_LEVELS = [
  { lod: 0, tileZoom: 5, demZoomMax: 8 },
  { lod: 1, tileZoom: 7, demZoomMax: 11 },
  { lod: 2, tileZoom: 9, demZoomMax: Infinity },
]

// `levels` defaults to LOD_LEVELS (water) so every existing call site is
// unaffected; pass ROAD_LOD_LEVELS / LAKE_LOD_LEVELS (or any other per-layer
// table) explicitly for a layer whose tile density needs a different tileZoom
// per LOD.
export function lodForZoom(demZoom, levels = LOD_LEVELS) {
  for (const l of levels) if (demZoom <= l.demZoomMax) return l.lod
  return levels[levels.length - 1].lod
}

export function tileZoomForLod(lod, levels = LOD_LEVELS) {
  const l = levels.find((x) => x.lod === lod)
  return l ? l.tileZoom : levels[levels.length - 1].tileZoom
}

// Standard Web-Mercator slippy-tile projection: lon/lat -> fractional tile
// x/y at zoom z (x right 0..n, y down 0..n). Clamp lat to the Mercator
// coverage limit so a bbox that pokes past the poles doesn't blow up the
// log(tan(...)) term.
const MERCATOR_MAX_LAT = 85.05112878
function lonLatToTileXY(lon, lat, z) {
  const n = 2 ** z
  const clampedLat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat))
  const latRad = (clampedLat * Math.PI) / 180
  const x = ((lon + 180) / 360) * n
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

// Every slippy tile {z,x,y} whose square footprint intersects a lat/lon
// bbox, at `tileZoom`. Guards:
//  - poles: lat is clamped inside the projection above, so an out-of-range
//    bbox degrades to the nearest valid row instead of throwing/NaNing.
//  - antimeridian: bbox.minLon > bbox.maxLon means the bbox actually wraps
//    through ±180°, so it's split into two spans ([minLon,180] and
//    [-180,maxLon]) and tiled separately.
export function tilesForBBox(bbox, tileZoom) {
  const n = 2 ** tileZoom
  const spans =
    bbox.minLon > bbox.maxLon ? [[bbox.minLon, 180], [-180, bbox.maxLon]] : [[bbox.minLon, bbox.maxLon]]
  const out = []
  const seen = new Set()
  for (const [lo, hi] of spans) {
    const nw = lonLatToTileXY(lo, bbox.maxLat, tileZoom)
    const se = lonLatToTileXY(hi, bbox.minLat, tileZoom)
    const minX = Math.max(0, Math.floor(nw.x))
    const minY = Math.max(0, Math.floor(nw.y))
    let maxX = Math.min(n - 1, Math.floor(se.x - 1e-9))
    let maxY = Math.min(n - 1, Math.floor(se.y - 1e-9))
    maxX = Math.max(minX, maxX)
    maxY = Math.max(minY, maxY)
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x}/${y}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ z: tileZoom, x, y })
      }
    }
  }
  return out
}

// Whether a lat/lon patch bbox overlaps the covered water-tile region at all
// (plain bbox-overlap test — cheap pre-check before fetching any tiles).
export function inRegion(bbox, region) {
  return bbox.minLon <= region.maxLon && bbox.maxLon >= region.minLon && bbox.minLat <= region.maxLat && bbox.maxLat >= region.minLat
}
