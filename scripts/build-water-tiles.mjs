// Tiled Overture water layer, for one region (Annecy/Chamonix/Léman/Bourget/
// Geneva). Natural Earth's `lakes` layer is a coverage problem, not a
// precision one: 1345 lakes worldwide, 3 in all of France, and Lac d'Annecy
// isn't in it at all. Overture's `base/water` theme (derived from OSM) has
// it — 26.81 km², 2578 points, named — but the full region is 258k features
// / 4.85M verts / ~102 MB as ONE file, 7x over the ~15 MB/layer ceiling this
// repo otherwise holds to. So: tile it, and drop subtypes never wanted at
// map scale (stream/human_made/wastewater/spring/physical — 67% of the
// vertex weight, live-measured, see task-10 report for the full table).
//
// ODbL share-alike: Overture `base/water` is derived from OSM and licensed
// ODbL. The produced tiles here are a straight subset/reprojection with no
// added creative content, not a "derivative database" in the copyleft
// sense, but if this pipeline ever gains derived/enriched attributes beyond
// what OSM already carries, that share-alike obligation needs revisiting.
// The required credit ("© OpenStreetMap contributors") is handled client-side
// by refreshOsmCredit() in main.js — WaterLayer must set `usingOsm = true`
// whenever it renders tile-sourced water, same as it does for Overpass data.
//
// Run: npm run build:watertiles
import { mkdir, writeFile } from 'node:fs/promises'
import { DuckDBInstance } from '@duckdb/node-api'
import { WATER_REGION, LOD_LEVELS, tilesForBBox } from '../src/map/tile-index.js'

export const REGION = WATER_REGION // re-exported for clarity; single source of truth lives in tile-index.js
export const OVERTURE_RELEASE = '2026-06-17.0'
const SOURCE = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=base/type=water/*`

const OUT = new URL('../public/data/water-tiles/', import.meta.url)

// Subtypes kept: lake, river, water, canal, pond, reservoir. Dropped:
// stream, human_made, wastewater, spring, physical — measured at 67% of all
// vertices in this region and never wanted at these map scales.
const KEEP_SUBTYPES = ['lake', 'river', 'water', 'canal', 'pond', 'reservoir']

// Per-LOD area gate, in km² of REAL surface area (not degrees — degrees are
// converted per-feature using the feature's own center-latitude cos factor,
// same idea as the live spike). `lakeMinAreaKm2` is a separate, lower gate
// for the `lake` subtype specifically: LOD1 wants "all lakes" (even a small
// named alpine lake matters at mid zoom) while still thresholding the other
// subtypes, which is why this is two numbers per LOD, not one.
//
// Chosen against a live measurement of the whole region (see task-10
// report): area>=1km2 keeps 77 features (34 river/24 reservoir/17 lake/2
// water) — naturally "large lakes/reservoirs + major rivers" with NO
// subtype allow-list needed, ponds/canals are just never that big.
// area>=0.05km2 keeps ~1580 total across subtypes; LOD1 additionally
// exempts `lake` from any threshold (956 lakes region-wide, 116,581 verts —
// small on its own) so small-but-real lakes don't disappear at mid zoom.
// LOD2 keeps everything (0 threshold), matching "everything kept" and the
// project's no-simplification rule — nothing is dropped by shape, only by
// this per-LOD, per-subtype area gate.
const AREA_GATES_KM2 = [
  { minAreaKm2: 1, lakeMinAreaKm2: 1 }, // LOD0 z7 far
  { minAreaKm2: 0.05, lakeMinAreaKm2: 0 }, // LOD1 z9 mid
  { minAreaKm2: 0, lakeMinAreaKm2: 0 }, // LOD2 z11 close — everything kept
]

const D2R = Math.PI / 180
const KM_PER_DEG = 111.32
// deg² -> real km², using the feature's own center latitude (not a fixed
// region-wide constant) so the conversion stays accurate across the whole
// region's ~2.5° latitude span.
function areaKm2(areaDeg2, centerLat) {
  return areaDeg2 * KM_PER_DEG * KM_PER_DEG * Math.cos(centerLat * D2R)
}

// Quantize coordinates to 5 decimals (~1.1 m) — the SAME precision
// build-mapdata.mjs uses for its near-lossless layers (see ROADS_EPS /
// round5 there). No Douglas-Peucker: shapes are never simplified, per the
// standing project constraint — this only reduces float noise, not vertices.
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

  console.log(`fetching Overture ${OVERTURE_RELEASE} base/water over region`, REGION)
  const t0 = Date.now()
  const reader = await conn.runAndReadAll(`
    SELECT id, names.primary as name, subtype, class,
           bbox.xmin as xmin, bbox.xmax as xmax, bbox.ymin as ymin, bbox.ymax as ymax,
           ST_Area(geometry) as area_deg2,
           ST_AsGeoJSON(geometry) as gj
    FROM read_parquet('${SOURCE}', filename=true, hive_partitioning=1)
    WHERE bbox.xmin <= ${REGION.maxLon} AND bbox.xmax >= ${REGION.minLon}
      AND bbox.ymin <= ${REGION.maxLat} AND bbox.ymax >= ${REGION.minLat}
      AND subtype IN (${KEEP_SUBTYPES.map((s) => `'${s}'`).join(',')})
  `)
  const rows = reader.getRowObjects()
  console.log(`fetched ${rows.length} features in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // Parse once per feature (not per LOD) — geometry + trimmed properties.
  const features = rows.map((r) => ({
    id: r.id,
    name: r.name ?? '',
    subtype: r.subtype,
    class: r.class ?? null,
    bbox: { minLon: r.xmin, maxLon: r.xmax, minLat: r.ymin, maxLat: r.ymax },
    areaKm2: areaKm2(r.area_deg2, (r.ymin + r.ymax) / 2),
    geometry: quantize(JSON.parse(r.gj)),
  }))

  await mkdir(OUT, { recursive: true })

  const manifestLods = []
  let grandTotalTiles = 0
  let grandTotalBytes = 0
  let grandBiggestKB = 0

  for (let i = 0; i < LOD_LEVELS.length; i++) {
    const { lod, tileZoom } = LOD_LEVELS[i]
    const gate = AREA_GATES_KM2[i]
    const kept = features.filter((f) => (f.subtype === 'lake' ? f.areaKm2 >= gate.lakeMinAreaKm2 : f.areaKm2 >= gate.minAreaKm2))

    // Feature/tile assignment: duplicate a feature into EVERY tile its bbox
    // intersects (via the same tilesForBBox the client uses), and dedupe
    // client-side by id — never clip geometry at tile borders (clipping
    // creates seams in filled draped polygons; duplication is cheap at
    // these sizes, verified below).
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
          properties: { id: f.id, name: f.name, subtype: f.subtype, class: f.class },
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
      `LOD${lod} (z${tileZoom}, gate ${gate.minAreaKm2}km2 / lake ${gate.lakeMinAreaKm2}km2): ` +
        `${kept.length} features kept, ${assignments} tile-assignments (${dupOverhead}x duplication), ` +
        `${tileCount} tiles written, ${(lodBytes / 1024 / 1024).toFixed(2)} MB, biggest tile ${biggestKB.toFixed(1)} KB`
    )

    manifestLods.push({ lod, tileZoom, minAreaKm2: gate.minAreaKm2, lakeMinAreaKm2: gate.lakeMinAreaKm2, tiles: tileCount, bytes: lodBytes })
    grandTotalTiles += tileCount
    grandTotalBytes += lodBytes
    grandBiggestKB = Math.max(grandBiggestKB, biggestKB)
  }

  const manifest = {
    region: REGION,
    release: OVERTURE_RELEASE,
    subtypesKept: KEEP_SUBTYPES,
    lods: manifestLods,
    totalTiles: grandTotalTiles,
    totalBytes: grandTotalBytes,
    biggestTileKB: Math.round(grandBiggestKB * 10) / 10,
  }
  await writeFile(new URL('index.json', OUT), JSON.stringify(manifest, null, 2))
  console.log(`manifest written — ${grandTotalTiles} tiles total, ${(grandTotalBytes / 1024 / 1024).toFixed(2)} MB total, biggest tile ${grandBiggestKB.toFixed(1)} KB`)
  if (grandBiggestKB > 2048) console.warn(`WARNING: biggest tile ${grandBiggestKB.toFixed(1)} KB exceeds the ~2 MB/tile ceiling — tighten an area gate or split that LOD further.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
