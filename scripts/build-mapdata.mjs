// Fetch Natural Earth GeoJSON, trim to the properties we render, quantize
// coordinates to 5 decimals (~1 m), and emit compact JSON to public/data/map/.
// Public domain (Natural Earth) — no attribution required. Run: npm run build:mapdata
//
// Source mirror: nvkelso/natural-earth-vector doesn't publish flat per-layer
// geojson files at the expected path anymore, so we pull from the
// martynafford/natural-earth-geojson mirror instead, which hosts the same
// public-domain Natural Earth 10m data split by physical/cultural theme.
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master'
const OUT = new URL('../public/data/map/', import.meta.url)

// layer → [resolution, theme, NE file, keep-props builder]. rivers/lakes/
// coastline use 50m (coarse world) to stay well under the size budget; roads
// and places use 10m for a usable network / a rich place list.
const round = (n) => Math.round(n * 1e5) / 1e5
function quantize(geom) {
  const walk = (c) => (typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(walk))
  return { ...geom, coordinates: walk(geom.coordinates) }
}
async function ne(resolution, theme, file) {
  const url = `${BASE}/${resolution}/${theme}/${file}.json`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${file}: ${r.status} (${url})`)
  return r.json()
}
function trimFeatures(fc, keep) {
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => ({ type: 'Feature', properties: keep(f.properties || {}), geometry: quantize(f.geometry) })),
  }
}
const numZoom = (p) => Math.round(p.min_zoom ?? p.MIN_ZOOM ?? 0)
const nameOf = (p) => p.name ?? p.NAME ?? p.name_en ?? p.NAME_EN ?? ''

async function main() {
  await mkdir(OUT, { recursive: true })

  // rivers/lakes/coastline use 50m (coarse world) source: the 10m variants
  // are 5-9 MB even after trimming (dense per-vertex geometry dwarfs the
  // property savings), blowing well past the "few hundred KB" budget. Roads
  // keeps 10m below for a usable network, per the brief.
  const rivers = trimFeatures(await ne('50m', 'physical', 'ne_50m_rivers_lake_centerlines'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? p.SCALERANK ?? 10, kind: 'river' }))
  await writeFile(new URL('rivers.json', OUT), JSON.stringify(rivers))

  const lakes = trimFeatures(await ne('50m', 'physical', 'ne_50m_lakes'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? p.SCALERANK ?? 10, kind: 'lake' }))
  await writeFile(new URL('lakes.json', OUT), JSON.stringify(lakes))

  const coast = trimFeatures(await ne('50m', 'physical', 'ne_50m_coastline'), (p) => ({ name: '', min_zoom: numZoom(p), scalerank: p.scalerank ?? p.SCALERANK ?? 10, kind: 'coast' }))
  await writeFile(new URL('coastline.json', OUT), JSON.stringify(coast))

  // roads: map NE `type` to our 3 classes so the renderer styles by weight
  const roadClass = (t = '') => (/Major Highway|Freeway|Beltway/i.test(t) ? 'motorway' : /Secondary|Road/i.test(t) ? 'secondary' : 'primary')
  const roads = trimFeatures(await ne('10m', 'cultural', 'ne_10m_roads'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: p.scalerank ?? p.SCALERANK ?? 10, kind: roadClass(p.type ?? p.TYPE) }))
  await writeFile(new URL('roads.json', OUT), JSON.stringify(roads))

  // places: compact array, sorted by population desc for greedy zoom picking
  const pp = await ne('10m', 'cultural', 'ne_10m_populated_places')
  const places = pp.features
    .filter((f) => f.geometry && f.geometry.coordinates)
    .map((f) => {
      const p = f.properties || {}
      const [lon, lat] = f.geometry.coordinates
      const cap = /Admin-0 capital/i.test(p.featurecla ?? p.FEATURECLA ?? '') ? 1 : 0
      const mz = Math.round(p.min_zoom ?? p.MIN_ZOOM ?? p.min_label ?? p.MIN_LABEL ?? 3)
      return [String(p.name ?? p.NAME ?? ''), round(lat), round(lon), Math.round(p.pop_max ?? p.POP_MAX ?? 0), cap, mz]
    })
    .filter((r) => r[0])
    .sort((a, b) => b[3] - a[3])
  await writeFile(new URL('places.json', OUT), JSON.stringify(places))

  console.log('map data written to public/data/map/')
}
main().catch((e) => { console.error(e); process.exit(1) })
