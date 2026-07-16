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

// layer → [resolution, theme, NE file, keep-props builder]. lakes/coastline
// use 50m (coarse world) to stay well under the size budget; roads, places,
// and rivers (for density + the strokeweig width attribute) use 10m.
const round = (n) => Math.round(n * 1e4) / 1e4
const round5 = (n) => Math.round(n * 1e5) / 1e5

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

function quantize(geom, roundFn = round) {
  const walk = (c) => (typeof c[0] === 'number' ? [roundFn(c[0]), roundFn(c[1])] : c.map(walk))
  return { ...geom, coordinates: walk(geom.coordinates) }
}
async function ne(resolution, theme, file) {
  const url = `${BASE}/${resolution}/${theme}/${file}.json`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`fetch ${file}: ${r.status} (${url})`)
  return r.json()
}
function trimFeatures(fc, keep, epsilon = 0, roundFn = round) {
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry && f.geometry.coordinates)
      .map((f) => {
        const geom = epsilon > 0 ? simplifyGeometry(f.geometry, epsilon) : f.geometry
        if (!geom) return null
        return { type: 'Feature', properties: keep(f.properties || {}), geometry: quantize(geom, roundFn) }
      })
      .filter(Boolean),
  }
}
const numZoom = (p) => Math.round(p.min_zoom ?? p.MIN_ZOOM ?? 0)
const nameOf = (p) => p.name ?? p.NAME ?? p.name_en ?? p.NAME_EN ?? ''
const scalerankOf = (p) => p.scalerank ?? p.SCALERANK ?? 10

async function main() {
  await mkdir(OUT, { recursive: true })

  // lakes/coastline use 50m (coarse world) source: the 10m variants are
  // 5-9 MB even after trimming (dense per-vertex geometry dwarfs the
  // property savings), blowing well past the size budget. Rivers and roads
  // use 10m below for density / a usable network, per the brief.
  // Douglas-Peucker simplification (epsilon in degrees, tuned per layer
  // below) further bounds payload size without dropping features.
  const RIVERS_EPS = 0.01
  const LAKES_EPS = 0.008
  const COAST_EPS = 0.09
  // Roads use a near-lossless epsilon and 5-decimal (~1.1 m) quantization so
  // far-view road shapes stay faithful to the source geometry; this trades a
  // larger payload (~5-8 MB) for fidelity, per the fix in task 6.
  const ROADS_EPS = 0.0005

  // rivers: 10m gives natural per-feature line width via `strokeweig`
  // (cartographic stroke weight, 0-9) and far more features than the 50m
  // centerlines (461). Base layer is the global `_scale_rank` variant (the
  // one NE ships strokeweig on); `_europe` and `_north_america` are regional
  // supplements with extra density, merged in when reachable. Falls back to
  // 50m (no strokeweig on that layer, so width falls back to 2 everywhere)
  // if the 10m mirror path 404s.
  const strokeweightOf = (p) => p.strokeweig ?? p.strokeweight ?? 2
  const riverKeep = (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'river', strokeweight: strokeweightOf(p) })
  let riversRaw
  try {
    const [global10m, europe, northAmerica] = await Promise.all([
      ne('10m', 'physical', 'ne_10m_rivers_lake_centerlines_scale_rank'),
      ne('10m', 'physical', 'ne_10m_rivers_europe').catch((e) => { console.warn('rivers_europe supplement unavailable:', e.message); return null }),
      ne('10m', 'physical', 'ne_10m_rivers_north_america').catch((e) => { console.warn('rivers_north_america supplement unavailable:', e.message); return null }),
    ])
    const features = [...global10m.features, ...(europe?.features ?? []), ...(northAmerica?.features ?? [])]
    riversRaw = { type: 'FeatureCollection', features }
  } catch (e) {
    console.warn('NE 10m rivers unavailable, falling back to 50m centerlines:', e.message)
    riversRaw = await ne('50m', 'physical', 'ne_50m_rivers_lake_centerlines')
  }
  const rivers = trimFeatures(riversRaw, riverKeep, RIVERS_EPS)
  await writeFile(new URL('rivers.json', OUT), JSON.stringify(rivers))

  const lakes = trimFeatures(await ne('50m', 'physical', 'ne_50m_lakes'), (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'lake' }), LAKES_EPS)
  await writeFile(new URL('lakes.json', OUT), JSON.stringify(lakes))

  const coast = trimFeatures(await ne('50m', 'physical', 'ne_50m_coastline'), (p) => ({ name: '', min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: 'coast' }), COAST_EPS)
  await writeFile(new URL('coastline.json', OUT), JSON.stringify(coast))

  // roads: map NE `type` to our 3 classes so the renderer styles by weight
  const roadClass = (t = '') => (/Major Highway|Freeway|Beltway/i.test(t) ? 'motorway' : /Secondary|Road/i.test(t) ? 'secondary' : 'primary')
  const roadsRaw = await ne('10m', 'cultural', 'ne_10m_roads')
  // Scalerank cap relaxed from 3 to 5 (was tightened all the way to 3 to fit
  // a strict 2 MB budget under the old aggressive epsilon). With near-lossless
  // ROADS_EPS the full unfiltered network is ~21 MB, so we still cap — just
  // much less aggressively — to land in the ~5-8 MB range while keeping
  // faithful shapes and including more of the road network than before.
  const ROADS_SCALERANK_CAP = 5
  const roads = trimFeatures(
    { type: 'FeatureCollection', features: roadsRaw.features.filter((f) => f.geometry && scalerankOf(f.properties || {}) <= ROADS_SCALERANK_CAP) },
    (p) => ({ name: nameOf(p), min_zoom: numZoom(p), scalerank: scalerankOf(p), kind: roadClass(p.type ?? p.TYPE) }),
    ROADS_EPS,
    round5,
  )
  const roadsJson = JSON.stringify(roads)
  await writeFile(new URL('roads.json', OUT), roadsJson)

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
