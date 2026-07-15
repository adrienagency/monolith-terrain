// Fetch Natural Earth GeoJSON, trim to the properties we render, simplify
// line/polygon geometry (Douglas-Peucker) to bound payload size, quantize
// coordinates to 4 decimals (~11 m), and emit compact JSON to public/data/map/.
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
const round = (n) => Math.round(n * 1e4) / 1e4

// --- Douglas-Peucker line simplification -----------------------------------
// points: array of [lon, lat] pairs. epsilon: perpendicular-distance
// threshold in degrees. Iterative (explicit stack) to avoid recursion-depth
// issues on very long lines. Always keeps the first and last point.
function perpDist(p, a, b) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  const cx = ax + t * dx, cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
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
// Simplify a closed ring (Polygon/MultiPolygon), preserving closure.
function simplifyRing(ring, epsilon) {
  if (ring.length < 4) return ring
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring.slice()
  const simplified = simplifyLine(open, epsilon)
  if (simplified.length < 3) return null // collapsed — can't form a ring
  return [...simplified, simplified[0]]
}
function simplifyGeometry(geom, epsilon) {
  switch (geom.type) {
    case 'Point':
    case 'MultiPoint':
      return geom
    case 'LineString': {
      const line = simplifyLine(geom.coordinates, epsilon)
      return line.length < 2 ? null : { ...geom, coordinates: line }
    }
    case 'MultiLineString': {
      const lines = geom.coordinates.map((l) => simplifyLine(l, epsilon)).filter((l) => l.length >= 2)
      return lines.length === 0 ? null : { ...geom, coordinates: lines }
    }
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
      return geom
  }
}

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
function trimFeatures(fc, keep, epsilon = 0) {
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => {
        const geom = epsilon > 0 ? simplifyGeometry(f.geometry, epsilon) : f.geometry
        if (!geom) return null
        return { type: 'Feature', properties: keep(f.properties || {}), geometry: quantize(geom) }
      })
      .filter(Boolean),
  }
}
const numZoom = (p) => Math.round(p.min_zoom ?? p.MIN_ZOOM ?? 0)
const nameOf = (p) => p.name ?? p.NAME ?? p.name_en ?? p.NAME_EN ?? ''
const scalerankOf = (p) => p.scalerank ?? p.SCALERANK ?? 10

async function main() {
  await mkdir(OUT, { recursive: true })

  // rivers/lakes/coastline use 50m (coarse world) source: the 10m variants
  // are 5-9 MB even after trimming (dense per-vertex geometry dwarfs the
  // property savings), blowing well past the size budget. Roads keeps 10m
  // below for a usable network, per the brief. Douglas-Peucker simplification
  // (epsilon in degrees, tuned per layer below) further bounds payload size
  // without dropping features.
  const RIVERS_EPS = 0.01
  const LAKES_EPS = 0.008
  const COAST_EPS = 0.09
  const ROADS_EPS = 0.02

  const rivers = trimFeatures(await ne('50m', 'physical', 'ne_50m_rivers_lake_centerlines'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'river' }), RIVERS_EPS)
  await writeFile(new URL('rivers.json', OUT), JSON.stringify(rivers))

  const lakes = trimFeatures(await ne('50m', 'physical', 'ne_50m_lakes'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'lake' }), LAKES_EPS)
  await writeFile(new URL('lakes.json', OUT), JSON.stringify(lakes))

  const coast = trimFeatures(await ne('50m', 'physical', 'ne_50m_coastline'), (p) => ({ name: '', min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'coast' }), COAST_EPS)
  await writeFile(new URL('coastline.json', OUT), JSON.stringify(coast))

  // roads: map NE `type` to our 3 classes so the renderer styles by weight
  const roadClass = (t = '') => (/Major Highway|Freeway|Beltway/i.test(t) ? 'motorway' : /Secondary|Road/i.test(t) ? 'secondary' : 'primary')
  const roadsRaw = await ne('10m', 'cultural', 'ne_10m_roads')
  const buildRoads = (maxScalerank) =>
    trimFeatures(
      { type: 'FeatureCollection', features: roadsRaw.features.filter((f) => f.geometry && (maxScalerank == null || scalerankOf(f.properties || {}) <= maxScalerank)) },
      (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: roadClass(p.type ?? p.TYPE) }),
      ROADS_EPS,
    )
  const ROADS_BUDGET = 2 * 1024 * 1024
  let roads = buildRoads(null)
  let roadsJson = JSON.stringify(roads)
  let roadsScalerankCap = null
  // Simplification alone (bounded at ROADS_EPS ~0.02 deg so roads still read
  // as roads, not straight segments) isn't enough to bring the dense 10m
  // road network under the 2 MB budget — fall back to dropping less
  // important roads by scalerank, tightening the cap until the budget is
  // met, so we keep as much of the network as the budget allows.
  for (const cap of [7, 6, 5, 4, 3, 2, 1]) {
    if (roadsJson.length <= ROADS_BUDGET) break
    roadsScalerankCap = cap
    roads = buildRoads(cap)
    roadsJson = JSON.stringify(roads)
  }
  await writeFile(new URL('roads.json', OUT), roadsJson)
  if (roadsScalerankCap != null) console.log(`roads.json: simplification alone did not hit the 2 MB budget — filtered to scalerank <= ${roadsScalerankCap}`)

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
