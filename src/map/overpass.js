// Full-detail OSM lines via the Overpass API — raw geometry, NO simplification.
// Endpoint is a const so a self-hosted instance can replace the public one.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// PLUS de `roads` ici. Le calque Routes a quitté le site (Adrien : « très
// lourd, très mauvais ») et avec lui son prédicat `roadHighwayFilter()` et le
// cran de « détail » qui lui servait de variante de cache. L'eau est le seul
// calque qui interroge encore Overpass par ce module ; les autres appelants
// d'Overpass du projet (peaks.js, peak-mask.js, transports.js pour le Race
// Studio) ont chacun leur propre client et n'ont jamais dépendu d'ici.
//
// La LEÇON du calque disparu, elle, reste vraie et vaut pour l'eau : ne JAMAIS
// remettre un prédicat regex du genre `["waterway"~"^(river|…)$"]`. Un regex
// force Overpass à balayer toutes les ways de la bbox au lieu d'attaquer
// l'index de tags — mesuré sur les routes : 6,5 s et un **504**, contre 927 ms
// pour le test de tag nu. Le filtrage fin se fait côté client (voir
// filterRiverwayLines dans water-layer.js).
export const WAY_TAG = { water: 'waterway' }

// Server-side memory ceiling per query, in bytes. This is a LOAD-BEARING guard,
// not a tuning knob. Without it a dense-city patch succeeds and hands us a
// payload big enough to hang the tab: a z12 (24 km) bbox over central Paris
// measured **351,414 ways / 238 MB** — a 200 OK, so the "we fall back to Natural
// Earth on failure" safety net never fires. Sparse patches are unaffected (the
// same z12 width over Chamonix is ~10.7k ways / 15 MB). Overpass rejects a query
// that would exceed maxsize, and that error takes the normal null → Natural
// Earth path, which is a real graceful degradation rather than a frozen browser.
export const OVERPASS_MAXSIZE = 48 * 1024 * 1024

// Overpass bbox order is (south,west,north,east) = (minLat,minLon,maxLat,maxLon)
export function buildQuery(bbox, kind) {
  const b = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`
  const head = `[out:json][timeout:25][maxsize:${OVERPASS_MAXSIZE}]`
  const tag = WAY_TAG[kind]
  return `${head};way["${tag}"](${b});out geom;`
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
  // same maxsize guard as buildQuery — see OVERPASS_MAXSIZE
  return `[out:json][timeout:25][maxsize:${OVERPASS_MAXSIZE}];(way["natural"="water"](${b});way["waterway"="riverbank"](${b});relation["natural"="water"](${b}););out geom;`
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

// Une entrée de cache par zone+kind. Le troisième argument `variant` a disparu
// avec les routes : il ne servait qu'à distinguer les crans de détail du
// réseau routier, l'eau n'en a jamais eu qu'un.
export function bboxKey(bbox, kind) {
  const r = (n) => Math.round(n * 1000) / 1000
  return `${kind}:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
}

// Client-side companion to OVERPASS_MAXSIZE: that caps the SERVER's memory, not
// the bytes it ships us, so refuse an oversized body before spending a main-
// thread .json() parse on it. Throwing here joins the same null → Natural Earth
// fallback as any other failure. Content-Length can be absent (chunked); then we
// let it through rather than reject a payload we can't measure — maxsize is the
// primary guard, this is the belt to its braces.
export function assertSaneSize(response, limit = OVERPASS_MAXSIZE) {
  const len = Number(response.headers?.get?.('content-length'))
  if (Number.isFinite(len) && len > limit) throw new Error(`overpass payload ${len} > ${limit}`)
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
      assertSaneSize(r)
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
      assertSaneSize(r)
      return parseOverpassAreas(await r.json())
    })()
    _cache.set(key, job)
    job.catch(() => _cache.delete(key))
  }
  try { return await _cache.get(key) } catch { return null }
}
