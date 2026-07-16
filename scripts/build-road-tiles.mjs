// Tiled Overture road layer, for the same region as build-water-tiles.mjs
// (Annecy/Chamonix/Léman/Bourget/Geneva). Zoomed-in roads used to come from
// live public Overpass, which Overpass's own docs list as an unacceptable
// use for an app like this one (non-mapper-facing, backend-style traffic,
// margins ~10k req/day — this repo got 429'd from one IP in dozens of
// requests). It also isn't SAFE: a z12 (24 km) bbox over central Paris
// returns 351,414 ways / 238 MB with a 200 OK, so the "fetch fails -> fall
// back to Natural Earth" net never fires and the tab chokes (see
// OVERPASS_MAXSIZE in overpass.js for the guard that only degrades this,
// doesn't fix it). Tiling the region from Overture, exactly like the water
// layer already does, removes the live dependency entirely for in-region
// patches.
//
// ODbL share-alike: Overture `transportation/segment` is derived from OSM
// and licensed ODbL, same as `base/water`. The produced tiles here are a
// straight subset/reprojection (subtype+class+quantize only, no added
// creative content), not a "derivative database" in the copyleft sense — see
// the same note in build-water-tiles.mjs. The required credit
// ("© OpenStreetMap contributors") is handled client-side by
// refreshOsmCredit() in main.js — RoadsLayer sets `usingOsm = true` whenever
// it renders tile-sourced roads, same as it already does for Overpass data
// (and same as WaterLayer does for its own tiles).
//
// Run: npm run build:roadtiles
import { mkdir, writeFile } from 'node:fs/promises'
import { DuckDBInstance } from '@duckdb/node-api'
import { REGION, ROAD_LOD_LEVELS, tilesForBBox } from '../src/map/tile-index.js'
import { roadRank } from '../src/map/road-tier.js'

export { REGION } // re-exported for clarity; single source of truth lives in tile-index.js
export const OVERTURE_RELEASE = '2026-06-17.0'
const SOURCE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=transportation/type=segment/*`

const OUT = new URL('../public/data/road-tiles/', import.meta.url)

// LOD by roadRank (road-tier.js), NOT by hardcoding class names — reusing the
// exact same absolute-importance ranking the client already uses for
// relative tiering keeps "what a LOD keeps" and "what a zoomed-in view
// prioritizes" answering the same question. Measured Chamonix-valley class
// histogram (4126 segments, task-18 spike): service 1104, path 880, footway
// 467, track 465, residential 450, unclassified 232, tertiary 151, unknown
// 95, steps 86, secondary 83, trunk 59, pedestrian 34, living_street 10,
// cycleway 10 — a long tail exactly like water's area distribution: the
// walkable classes dominate by COUNT, the important roads are few. Region-
// WIDE (not just Chamonix) rank histogram, live-measured: rank0
// (motorway/trunk) 6203, rank1 (primary) 40617, rank2 (secondary) 60461,
// rank3 (tertiary) 86861, rank4 (unclassified/residential/living_street)
// 398518, rank5 (service) 445425, rank6 (track/path/footway/cycleway/
// bridleway/steps) 693401, rank7 (default: pedestrian/unknown/anything else)
// 54710.
//
// Region-wide totals, not per-tile, drove these gates — a fully-zoomed-out
// view (demZoom<=8) can see the WHOLE built region at once, so LOD0's
// region-wide byte total IS effectively "one view's payload" in the worst
// case, unlike LOD2 where a 24 km view only ever touches a handful of its
// (much finer) tiles:
//   LOD0 (far,  z8):  maxRank 0 -> motorway/trunk only. 3.8 MB region-wide,
//                      biggest tile ~1.0 MB — matches water's own LOD0
//                      budget (4.1 MB) almost exactly. A valley with no
//                      motorway (Chamonix: 0 motorway, 59 trunk) still gets
//                      its trunk roads at this LOD — never empty — same
//                      "whatever's present becomes tier 0" guarantee
//                      relativeTiers already provides client-side.
//   LOD1 (mid,  z11): maxRank 2 -> + primary/secondary. 42 MB region-wide,
//                      biggest tile ~0.9 MB.
//   LOD2 (close, z14): maxRank Infinity -> everything, INCLUDING footway/
//                      path/track/steps/cycleway/pedestrian/unknown. This is
//                      the hard constraint: notch 3 zoomed in must keep
//                      seeing footway/steps, so the closest LOD is never
//                      filtered by class at all. A 24 km view only touches a
//                      handful of this LOD's (very fine, z14) tiles, so the
//                      ~1 GB region-wide total here is NOT what a single
//                      view fetches — see the task-18 report for the
//                      measured per-view bytes.
// `unknown` (Overture's own catch-all, not an OSM highway=* value — verified
// against road-tier.js, which was written for OSM's vocabulary) falls
// through roadRank's default (rank 7, same bucket as footway/track) since we
// don't know what it actually represents; that's the same conservative
// default an unrecognized OSM highway=* value already got before this
// switch, so behaviour for the "we don't know" case is unchanged.
const CLASS_RANK_GATES = [
  { lod: 0, maxRank: 0 }, // z8 far — motorway/trunk only
  { lod: 1, maxRank: 2 }, // z11 mid — + primary/secondary
  { lod: 2, maxRank: Infinity }, // z14 close — everything, never filtered
]

// Quantize coordinates to 5 decimals (~1.1 m) — the SAME precision
// build-water-tiles.mjs / build-mapdata.mjs use. No Douglas-Peucker: road
// geometry is NEVER simplified, per the standing project constraint ("tu as
// interdiction de modifier les routes et les ruisseaux, même si c'est
// lourd") — this only reduces float noise, not vertices.
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

  console.log(`fetching Overture ${OVERTURE_RELEASE} transportation/segment (subtype=road) over region`, REGION)
  const t0 = Date.now()
  const reader = await conn.runAndReadAll(`
    SELECT id, names.primary as name, subtype, class,
           bbox.xmin as xmin, bbox.xmax as xmax, bbox.ymin as ymin, bbox.ymax as ymax,
           ST_AsGeoJSON(geometry) as gj
    FROM read_parquet('${SOURCE}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin <= ${REGION.maxLon} AND bbox.xmax >= ${REGION.minLon}
      AND bbox.ymin <= ${REGION.maxLat} AND bbox.ymax >= ${REGION.minLat}
      AND subtype = 'road'
  `)
  const rows = reader.getRowObjects()
  console.log(`fetched ${rows.length} segments in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // Parse once per feature (not per LOD) — geometry + trimmed properties +
  // the roadRank of its class, computed once and reused by every LOD gate.
  const features = rows.map((r) => ({
    id: r.id,
    name: r.name ?? '',
    class: r.class ?? null,
    subtype: r.subtype,
    bbox: { minLon: r.xmin, maxLon: r.xmax, minLat: r.ymin, maxLat: r.ymax },
    rank: roadRank(r.class),
    geometry: quantize(JSON.parse(r.gj)),
  }))

  // Sanity check against the measured spike histogram's class vocabulary —
  // fail loudly rather than silently mis-tiering if Overture ever changes
  // `class` to something roadRank can't place at all (roadRank always
  // returns an integer via its default branch, so this can only fire if
  // roadRank itself is broken).
  for (const f of features) {
    if (!Number.isInteger(f.rank)) throw new Error(`roadRank returned non-integer for class=${f.class}`)
  }

  await mkdir(OUT, { recursive: true })

  const manifestLods = []
  let grandTotalTiles = 0
  let grandTotalBytes = 0
  let grandBiggestKB = 0

  for (let i = 0; i < ROAD_LOD_LEVELS.length; i++) {
    const { lod, tileZoom } = ROAD_LOD_LEVELS[i]
    const gate = CLASS_RANK_GATES[i]
    const kept = features.filter((f) => f.rank <= gate.maxRank)

    // Feature/tile assignment: duplicate a feature into EVERY tile its bbox
    // intersects (via the same tilesForBBox the client uses), and dedupe
    // client-side by id — never clip geometry at tile borders (clipping a
    // road mid-way creates a seam matching the same visual bug the water
    // layer's doc comment describes for polygons; for lines it would just
    // truncate the road at the tile edge).
    const byTile = new Map()
    let assignments = 0
    for (const f of kept) {
      const tiles = tilesForBBox(f.bbox, tileZoom)
      for (const t of tiles) {
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
      if (!feats.length) continue // only write non-empty tiles — a 404 means "empty"
      const fc = {
        type: 'FeatureCollection',
        features: feats.map((f) => ({
          type: 'Feature',
          properties: { id: f.id, name: f.name, class: f.class, subtype: f.subtype },
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
      `LOD${lod} (z${tileZoom}, maxRank ${gate.maxRank}): ` +
        `${kept.length} segments kept, ${assignments} tile-assignments (${dupOverhead}x duplication), ` +
        `${tileCount} tiles written, ${(lodBytes / 1024 / 1024).toFixed(2)} MB, biggest tile ${biggestKB.toFixed(1)} KB`
    )

    manifestLods.push({ lod, tileZoom, maxRank: gate.maxRank, tiles: tileCount, bytes: lodBytes })
    grandTotalTiles += tileCount
    grandTotalBytes += lodBytes
    grandBiggestKB = Math.max(grandBiggestKB, biggestKB)
  }

  const manifest = {
    region: REGION,
    release: OVERTURE_RELEASE,
    classRankGates: CLASS_RANK_GATES,
    lods: manifestLods,
    totalTiles: grandTotalTiles,
    totalBytes: grandTotalBytes,
    biggestTileKB: Math.round(grandBiggestKB * 10) / 10,
  }
  await writeFile(new URL('index.json', OUT), JSON.stringify(manifest, null, 2))
  console.log(`manifest written — ${grandTotalTiles} tiles total, ${(grandTotalBytes / 1024 / 1024).toFixed(2)} MB total, biggest tile ${grandBiggestKB.toFixed(1)} KB`)
  if (grandBiggestKB > 2048) console.warn(`WARNING: biggest tile ${grandBiggestKB.toFixed(1)} KB exceeds the ~2 MB/tile ceiling — tighten a class gate or split that LOD further.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
