// Pure slippy-tile math for the tiled Overture water layer. No THREE, no DOM,
// no fetch — safe to import from the build script (Node) AND the client.
// Single source of truth for: the region the water tiles cover, the LOD→tile-
// zoom mapping, and the tile-covering math both the build script and the
// client tile-loader need to agree on.

// Region currently covered by water tiles: Annecy, Chamonix, Léman, Bourget,
// Geneva (lon 5.0–8.0, lat 44.5–47.0). Widen this bbox — and rerun
// `npm run build:watertiles` — to cover more of the world; every consumer
// (build script, tile-loader, water-layer) keys off this one constant.
export const WATER_REGION = { minLon: 5.0, minLat: 44.5, maxLon: 8.0, maxLat: 47.0 }

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

export function lodForZoom(demZoom) {
  for (const l of LOD_LEVELS) if (demZoom <= l.demZoomMax) return l.lod
  return LOD_LEVELS[LOD_LEVELS.length - 1].lod
}

export function tileZoomForLod(lod) {
  const l = LOD_LEVELS.find((x) => x.lod === lod)
  return l ? l.tileZoom : LOD_LEVELS[LOD_LEVELS.length - 1].tileZoom
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
