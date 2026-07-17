// Tiled Overture WORLD lake layer — every lake on the planet above a
// per-LOD area floor, tiled so the client only ever fetches what's in view.
//
// WHY THIS EXISTS, and why it is a separate script from build-water-tiles.mjs:
//
// Natural Earth's `lakes` layer is a COVERAGE problem, not a precision one:
// 1,345 lakes worldwide, 3 in all of France, and Lac d'Annecy is not in it at
// all. build-water-tiles.mjs fixed that — but only inside REGION (a 3°x2.5°
// Alps box), and outside it the client still falls back to Natural Earth, so
// most of the planet has no lakes. Widening REGION the same way does not
// scale: the Alps box alone is ~85 MB / 487 tiles, and France would be ~10x
// that.
//
// But the thing that matters is TINY. Measured over the shipped Alps tiles:
// `river` is 47.9% of the bytes, `water` 10%, `canal` 7.5%, `reservoir` 5.7%,
// `pond` 5.4% — and `lake` only 23.5% by bytes / 2,022 features. On the raw
// Overture region query, `lake` was 2.4% of ALL water vertices. So a
// LAKE-ONLY world layer is a completely different size class from "the water
// theme, worldwide", and that is what makes worldwide tractable at all.
//
// HOW THE TWO LAYERS COMPOSE (water-layer.js implements this):
//   - inside REGION  -> Alps water tiles: rich water (river/canal/pond/
//                       reservoir/water) + lakes. Unchanged, still shipped.
//   - outside REGION -> THIS layer: lakes ONLY (no rivers/canals/ponds — the
//                       world tile set never carries those subtypes), plus
//                       Natural Earth for coastline as before.
// The world layer never replaces the Alps tiles; it sits behind them in the
// fallback chain, so nothing already shipped regresses.
//
// ODbL share-alike: Overture `base/water` is derived from OSM and licensed
// ODbL, same as the Alps water tiles and the Overpass paths. These tiles are
// a straight subset/reprojection with no added creative content. The required
// credit ("© OpenStreetMap contributors") is handled client-side by
// refreshOsmCredit() in main.js — WaterLayer sets `usingOsm = true` on this
// path too (see `worldLakeOk` there).
//
// Run: npm run build:laketiles
import { mkdir, writeFile } from 'node:fs/promises'
import { DuckDBInstance } from '@duckdb/node-api'
import { LAKE_LOD_LEVELS, tilesForBBox } from '../src/map/tile-index.js'

export const OVERTURE_RELEASE = '2026-06-17.0'
const SOURCE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=base/type=water/*`

const OUT = new URL('../public/data/lake-tiles/', import.meta.url)

// Per-LOD area floor, in km² of REAL surface area. A coarse LOD only wants
// big lakes (a 180 km view does not need a pond); the close LOD wants
// everything above a small floor. These literals are MEASURED, not guessed —
// see the area-band table in the task-19 report for the count+vertex
// distribution they were picked against.
//
// LOD0 (far, z5): a fully-zoomed-out view can see a whole continent at once,
//   so this LOD's world-wide byte total is effectively "one view's payload"
//   in the worst case. Only genuinely large lakes.
// LOD1 (mid, z7): the >=1 km² band — "a lake you'd name on a regional map".
// LOD2 (close, z9): the floor a trail-race organiser actually cares about —
//   a small named alpine lake next to a col must be there.
// MEASURED, first full run (2026-07-17): area gates ALONE cannot bound this
// layer. At gates 100/1/0.1 the world came out at **9.0 GB / 24,598 tiles,
// biggest tile 41.5 MB** — full-fidelity shoreline is simply heavy (≥1 km²
// alone was 49,856 lakes / 1.7 GB, ~34 KB/lake), and one monster (the
// Caspian) rode whole into every LOD. So each LOD also SIMPLIFIES
// (Douglas-Peucker, helpers below) with a tolerance chosen to stay around
// one on-screen pixel at that LOD's intended viewing distance — invisible
// where it's used, and the only thing that makes "worldwide" a real size.
// (The project's "never simplify" rule is about routes/ruisseaux as drawn at
// map scale — a sub-pixel shoreline tolerance at continental distance is a
// different animal, and the in-region Alps tiles stay near-lossless for
// close-ups.)
//   LOD0 z5, views ≥360 km wide: 1 px ≈ 280 m → eps 0.0025°
//   LOD1 z7, views 90-180 km:    1 px ≈  70 m → eps 0.0006°
//   LOD2 z9, views ≤46 km:       1 px ≈  19 m → eps 0.00017°
const LAKE_AREA_GATES_KM2 = [
  { lod: 0, minAreaKm2: 100, epsilonDeg: 0.0025 }, // z5 far — only big lakes
  { lod: 1, minAreaKm2: 5, epsilonDeg: 0.0006 }, // z7 mid — lakes you'd name on a regional map
  { lod: 2, minAreaKm2: 0.5, epsilonDeg: 0.00017 }, // z9 close — small named alpine lakes
]

// The coarsest floor gates the SQL: no LOD wants anything below it, so
// nothing below it is ever fetched.
const MIN_GATE_KM2 = Math.min(...LAKE_AREA_GATES_KM2.map((g) => g.minAreaKm2))

// --- Douglas-Peucker simplification ------------------------------------------
// Copied verbatim from scripts/build-mapdata.mjs (which top-level-executes on
// import, so it can't be imported from). Iterative (explicit stack), keeps
// endpoints, ring-closure preserved.
function perpDist(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
function simplifyLine(points, epsilon) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()
    if (end <= start + 1) continue
    let maxDist = -1, maxIdx = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpDist(points[i], points[start], points[end])
      if (d > maxDist) { maxDist = d; maxIdx = i }
    }
    if (maxDist > epsilon) {
      keep[maxIdx] = 1
      stack.push([start, maxIdx], [maxIdx, end])
    }
  }
  const out = []
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i])
  return out
}
function simplifyRing(ring, epsilon) {
  if (ring.length < 4) return ring
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice()
  const simplified = simplifyLine(open, epsilon)
  if (simplified.length < 3) return null // collapsed — can't form a ring
  return [...simplified, simplified[0]]
}
function simplifyGeometry(geom, epsilon) {
  switch (geom.type) {
    case 'Polygon': {
      const rings = geom.coordinates.map((r) => simplifyRing(r, epsilon)).filter(Boolean)
      return rings.length === 0 ? null : { ...geom, coordinates: rings }
    }
    case 'MultiPolygon': {
      const polys = geom.coordinates
        .map((poly) => poly.map((r) => simplifyRing(r, epsilon)).filter(Boolean))
        .filter((poly) => poly.length > 0)
      return polys.length === 0 ? null : { ...geom, coordinates: polys }
    }
    default:
      return geom // lakes are polygons; anything else passes through untouched
  }
}

// Continent bbox windows. The world query is run per-continent and unioned,
// NOT as one global scan — see the comment on `APPROX_KM2` below for why this
// is the difference between a query that returns and one that does not.
// Together these cover every landmass; a lake is assigned by its bbox, and
// the windows do not overlap, so no lake is counted twice.
const CONTINENTS = [
  { name: 'Europe', minLon: -25, maxLon: 45, minLat: 34, maxLat: 72 },
  { name: 'N.America', minLon: -170, maxLon: -50, minLat: 5, maxLat: 84 },
  { name: 'S.America', minLon: -82, maxLon: -34, minLat: -56, maxLat: 13 },
  { name: 'Africa', minLon: -18, maxLon: 52, minLat: -35, maxLat: 38 },
  { name: 'Asia', minLon: 45, maxLon: 180, minLat: -11, maxLat: 78 },
  { name: 'Oceania', minLon: 110, maxLon: 180, minLat: -48, maxLat: -10 },
]

// bbox-extent area proxy, in real km² — pure scalar arithmetic on the bbox
// columns. This is the load-bearing trick of this script:
//
// ST_Area(geometry) in a WHERE/projection forces DuckDB to PARSE THE GEOMETRY
// of every water feature on the planet, so the whole ~100 GB theme gets read
// (measured: 12 GB RSS, never returned). The bbox.* columns are plain scalars
// carried in the parquet ROW-GROUP STATISTICS, so filtering on them prunes
// whole row groups without touching geometry at all (measured: 26s for a
// continent).
//
// The bbox extent is a SAFE pre-filter for a real-area gate: a bounding
// rectangle always OVER-estimates the polygon it encloses (a lake never fills
// its own bbox), so `approx_km2 >= X` can never drop a lake whose true
// ST_Area >= X. It only lets extra small ones through — and the exact
// ST_Area, computed below on the survivors only, is what actually gates them.
const APPROX_KM2 = `((bbox.xmax - bbox.xmin) * (bbox.ymax - bbox.ymin) * 111.32 * 111.32 * cos(radians((bbox.ymin + bbox.ymax) / 2)))`

// Quantize coordinates to 5 decimals (~1.1 m) — the SAME precision
// build-water-tiles.mjs / build-road-tiles.mjs / build-mapdata.mjs use. No
// Douglas-Peucker: shapes are never simplified, per the standing project
// constraint — this only reduces float noise, not vertices.
const round5 = (n) => Math.round(n * 1e5) / 1e5
function quantize(geom) {
  const walk = (c) => (typeof c[0] === 'number' ? [round5(c[0]), round5(c[1])] : c.map(walk))
  return { ...geom, coordinates: walk(geom.coordinates) }
}

async function main() {
  const instance = await DuckDBInstance.create(':memory:')
  const conn = await instance.connect()
  await conn.run(`INSTALL spatial; LOAD spatial;`)
  await conn.run(`INSTALL httpfs; LOAD httpfs;`)
  await conn.run(`SET s3_region='us-west-2';`)
  // S3 reads of this size occasionally drop a connection; retry rather than
  // lose a whole continent's query to one transient failure.
  await conn.run(`SET http_retries=8;`)
  await conn.run(`SET http_retry_wait_ms=1500;`)
  await conn.run(`SET http_retry_backoff=2;`)

  const features = []
  for (const c of CONTINENTS) {
    const t0 = Date.now()
    // `subtype = 'lake'` is a plain column predicate and stays pushed down —
    // evaluated alongside the bbox predicates, before any geometry parse.
    const reader = await conn.runAndReadAll(`
      WITH prefiltered AS (
        SELECT id, names.primary as name, subtype, geometry,
               bbox.xmin as xmin, bbox.xmax as xmax, bbox.ymin as ymin, bbox.ymax as ymax,
               (bbox.ymin + bbox.ymax) / 2 as center_lat
        FROM read_parquet('${SOURCE}', filename=true, hive_partitioning=1)
        WHERE subtype = 'lake'
          AND bbox.xmin >= ${c.minLon} AND bbox.xmax <= ${c.maxLon}
          AND bbox.ymin >= ${c.minLat} AND bbox.ymax <= ${c.maxLat}
          AND ${APPROX_KM2} >= ${MIN_GATE_KM2}
      )
      SELECT id, name, subtype, xmin, xmax, ymin, ymax,
             ST_Area(geometry) * 111.32 * 111.32 * cos(radians(center_lat)) as area_km2,
             ST_AsGeoJSON(geometry) as gj
      FROM prefiltered
      WHERE ST_Area(geometry) * 111.32 * 111.32 * cos(radians(center_lat)) >= ${MIN_GATE_KM2}
    `)
    const rows = reader.getRowObjects()
    console.log(`${c.name}: ${rows.length} lakes >= ${MIN_GATE_KM2} km2 in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    for (const r of rows) {
      features.push({
        id: r.id,
        name: r.name ?? '',
        subtype: r.subtype,
        bbox: { minLon: r.xmin, maxLon: r.xmax, minLat: r.ymin, maxLat: r.ymax },
        areaKm2: r.area_km2,
        geometry: quantize(JSON.parse(r.gj)),
      })
    }
  }
  console.log(`\n${features.length} lakes worldwide >= ${MIN_GATE_KM2} km2`)
  const named = features.filter((f) => f.name).length
  console.log(`${named} named (${((named / features.length) * 100).toFixed(1)}%) — lakes must stay NAMED, that's the whole point vs HydroLAKES`)

  await mkdir(OUT, { recursive: true })

  const manifestLods = []
  let grandTotalTiles = 0
  let grandTotalBytes = 0
  let grandBiggestKB = 0

  for (let i = 0; i < LAKE_LOD_LEVELS.length; i++) {
    const { lod, tileZoom } = LAKE_LOD_LEVELS[i]
    const gate = LAKE_AREA_GATES_KM2[i]
    // Each LOD gets its OWN simplified copy at that LOD's sub-pixel epsilon —
    // see the note above LAKE_AREA_GATES_KM2 for why gates alone measured 9 GB.
    // A lake whose ring collapses entirely at this epsilon is genuinely
    // invisible at this LOD's viewing distance: drop it.
    const kept = features
      .filter((f) => f.areaKm2 >= gate.minAreaKm2)
      .map((f) => {
        const g = simplifyGeometry(f.geometry, gate.epsilonDeg)
        return g ? { ...f, geometry: g } : null
      })
      .filter(Boolean)

    // Feature/tile assignment: duplicate a feature into EVERY tile its bbox
    // intersects (via the same tilesForBBox the client uses), and dedupe
    // client-side by id — never clip geometry at tile borders. Same rule as
    // build-water-tiles.mjs: clipping creates seams in filled draped polygons.
    const byTile = new Map()
    let assignments = 0
    for (const f of kept) {
      for (const t of tilesForBBox(f.bbox, tileZoom)) {
        const key = `${t.z}/${t.x}/${t.y}`
        if (!byTile.has(key)) byTile.set(key, [])
        byTile.get(key).push(f)
        assignments++
      }
    }

    let lodBytes = 0
    let biggestKB = 0
    let tileCount = 0
    for (const [key, feats] of byTile) {
      // Only non-empty tiles are ever written — most of the planet is not
      // lake, and the tile count must reflect that. A 404 means "empty" and
      // the client handles it silently (tile-loader.js).
      if (!feats.length) continue
      const fc = {
        type: 'FeatureCollection',
        features: feats.map((f) => ({
          type: 'Feature',
          // {id, name, subtype} per feature — `name` is a hard requirement
          // (HydroLAKES was rejected partly because its name field is empty
          // below 500 km²).
          properties: { id: f.id, name: f.name, subtype: f.subtype },
          geometry: f.geometry,
        })),
      }
      const json = JSON.stringify(fc)
      const [z, x, y] = key.split('/')
      await mkdir(new URL(`${z}/${x}/`, OUT), { recursive: true })
      await writeFile(new URL(`${z}/${x}/${y}.json`, OUT), json)
      lodBytes += json.length
      biggestKB = Math.max(biggestKB, json.length / 1024)
      tileCount++
    }

    const dupOverhead = kept.length ? (assignments / kept.length).toFixed(2) : '0'
    console.log(
      `LOD${lod} (z${tileZoom}, gate ${gate.minAreaKm2}km2): ${kept.length} lakes kept, ` +
        `${assignments} tile-assignments (${dupOverhead}x duplication), ${tileCount} tiles written, ` +
        `${(lodBytes / 1024 / 1024).toFixed(2)} MB, biggest tile ${biggestKB.toFixed(1)} KB`
    )

    manifestLods.push({ lod, tileZoom, minAreaKm2: gate.minAreaKm2, tiles: tileCount, bytes: lodBytes })
    grandTotalTiles += tileCount
    grandTotalBytes += lodBytes
    grandBiggestKB = Math.max(grandBiggestKB, biggestKB)
  }

  const manifest = {
    world: true, // no region bbox — this layer covers the whole planet
    release: OVERTURE_RELEASE,
    subtypesKept: ['lake'],
    lods: manifestLods,
    totalTiles: grandTotalTiles,
    totalBytes: grandTotalBytes,
    biggestTileKB: Math.round(grandBiggestKB * 10) / 10,
  }
  await writeFile(new URL('index.json', OUT), JSON.stringify(manifest, null, 2))
  console.log(`manifest written — ${grandTotalTiles} tiles total, ${(grandTotalBytes / 1024 / 1024).toFixed(2)} MB total, biggest tile ${grandBiggestKB.toFixed(1)} KB`)
  if (grandBiggestKB > 2048) console.warn(`WARNING: biggest tile ${grandBiggestKB.toFixed(1)} KB exceeds the ~2 MB/tile ceiling — raise an area gate or use a finer tileZoom for that LOD.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
