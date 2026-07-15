// Full-detail OSM lines via the Overpass API — raw geometry, NO simplification.
// Endpoint is a const so a self-hosted instance can replace the public one.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
export const WAY_TAG = { roads: 'highway', water: 'waterway' }

// Overpass bbox order is (south,west,north,east) = (minLat,minLon,maxLat,maxLon)
export function buildQuery(bbox, kind) {
  const tag = WAY_TAG[kind]
  const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  return `[out:json][timeout:25];way["${tag}"](${b});out geom;`
}

// Overpass `out geom` gives each way a `geometry:[{lat,lon},…]`. Keep every vertex.
export function parseOverpass(json, kind) {
  const tag = WAY_TAG[kind]
  const out = []
  for (const e of json?.elements || []) {
    if (e.type !== 'way' || !Array.isArray(e.geometry)) continue
    const coords = e.geometry.map((g) => [g.lon, g.lat])
    if (coords.length < 2) continue
    out.push({ coords, kind: e.tags?.[tag] || kind, name: e.tags?.name || '' })
  }
  return out
}

export function bboxKey(bbox, kind) {
  const r = (n) => Math.round(n * 1000) / 1000
  return `${kind}:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
}

// cache by zone+kind, dedupe in-flight, min gap between network hits, null on fail
const _cache = new Map()
let _lastAt = 0
export async function fetchOverpassLines(bbox, kind, { url = OVERPASS_URL, minInterval = 1200 } = {}) {
  const key = bboxKey(bbox, kind)
  if (!_cache.has(key)) {
    const body = buildQuery(bbox, kind)
    const job = (async () => {
      const wait = Math.max(0, _lastAt + minInterval - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      _lastAt = Date.now()
      const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
      if (!r.ok) throw new Error(`overpass ${r.status}`)
      return parseOverpass(await r.json(), kind)
    })()
    _cache.set(key, job)
    job.catch(() => _cache.delete(key))
  }
  try { return await _cache.get(key) } catch { return null }
}
