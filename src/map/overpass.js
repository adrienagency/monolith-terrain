// Full-detail OSM lines via the Overpass API — raw geometry, NO simplification.
// Endpoint is a const so a self-hosted instance can replace the public one.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
export const WAY_TAG = { roads: 'highway', water: 'waterway' }

// Overpass highway predicate. ALWAYS the bare tag test, for every detail notch.
//
// Do NOT reintroduce a `["highway"~"^(motorway|trunk|…)$"]` regex here. A regex
// predicate makes Overpass scan every way in the bbox instead of hitting the tag
// index, and on a dense patch it blows the timeout: measured against the live
// API on a Chamonix z13 bbox, `way["highway"]` returned 4570 ways in 927 ms while
// the regex form took 6.5 s and came back **504**. The 504 made fetchOverpassLines
// return null, which silently fell back to Natural Earth — which carries nothing
// at that zoom — so notches 1 and 2 rendered an EMPTY map while notch 3 (the only
// one already using the bare tag) worked. That was the whole bug.
//
// Fidelity is unaffected (no simplification either way), and filtering is not
// lost: which classes actually render at a notch is decided client-side and
// RELATIVELY in road-tier.js, from whatever classes the patch really contains.
// One predicate for all notches also means all three share a single cache entry,
// so moving the slider re-filters instantly instead of re-hitting rate-limited
// public Overpass.
export function roadHighwayFilter() {
  return '["highway"]'
}

// Overpass bbox order is (south,west,north,east) = (minLat,minLon,maxLat,maxLon)
export function buildQuery(bbox, kind, detail = 1) {
  const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  if (kind === 'roads') return `[out:json][timeout:25];way${roadHighwayFilter(detail)}(${b});out geom;`
  const tag = WAY_TAG[kind]
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

// Water AREAS (riverbanks/lakes) — polygons, not lines. Overpass bbox order
// matches buildQuery: (south,west,north,east).
export function buildAreaQuery(bbox) {
  const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  return `[out:json][timeout:25];(way["natural"="water"](${b});way["waterway"="riverbank"](${b});relation["natural"="water"](${b}););out geom;`
}

function closedRing(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 4) return null
  const first = geometry[0], last = geometry[geometry.length - 1]
  if (first.lat !== last.lat || first.lon !== last.lon) return null
  return geometry.map((g) => [g.lon, g.lat])
}

// `out geom` gives ways a `geometry:[{lat,lon},…]` and relations `members:[{role,geometry},…]`.
// A way is one ring if closed. A relation contributes one ring per `outer` member.
// Holes/inner roles are ignored for v1.
export function parseOverpassAreas(json) {
  const out = []
  for (const e of json?.elements || []) {
    if (e.type === 'way') {
      const ring = closedRing(e.geometry)
      if (ring) out.push({ ring })
    } else if (e.type === 'relation' && Array.isArray(e.members)) {
      for (const m of e.members) {
        if (m.role !== 'outer' || !Array.isArray(m.geometry) || m.geometry.length < 4) continue
        out.push({ ring: m.geometry.map((g) => [g.lon, g.lat]) })
      }
    }
  }
  return out
}

// `variant` is what distinguishes cache entries for the same bbox+kind — for
// roads this is the Overpass filter STRING (not the raw detail notch), so
// detail 1 and 2 (which now share a filter) collide onto the same cache
// entry and toggling the notch reuses the cached response instead of
// re-hitting rate-limited public Overpass.
export function bboxKey(bbox, kind, variant) {
  const r = (n) => Math.round(n * 1000) / 1000
  const base = `${kind}:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
  return kind === 'roads' && variant !== undefined ? `${base}:${variant}` : base
}

// cache by zone+kind(+detail), dedupe in-flight, min gap between network hits, null on fail
const _cache = new Map()
let _lastAt = 0
export async function fetchOverpassLines(bbox, kind, { detail = 1, url = OVERPASS_URL, minInterval = 1200 } = {}) {
  const variant = kind === 'roads' ? roadHighwayFilter(detail) : detail
  const key = bboxKey(bbox, kind, variant)
  if (!_cache.has(key)) {
    const body = buildQuery(bbox, kind, detail)
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

function areaBboxKey(bbox) {
  const r = (n) => Math.round(n * 1000) / 1000
  return `areas:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
}

// Same cache/dedupe/throttle contract as fetchOverpassLines, but for water AREAS.
export async function fetchOverpassAreas(bbox, { url = OVERPASS_URL, minInterval = 1200 } = {}) {
  const key = areaBboxKey(bbox)
  if (!_cache.has(key)) {
    const body = buildAreaQuery(bbox)
    const job = (async () => {
      const wait = Math.max(0, _lastAt + minInterval - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      _lastAt = Date.now()
      const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
      if (!r.ok) throw new Error(`overpass ${r.status}`)
      return parseOverpassAreas(await r.json())
    })()
    _cache.set(key, job)
    job.catch(() => _cache.delete(key))
  }
  try { return await _cache.get(key) } catch { return null }
}
