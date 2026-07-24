// Race Studio — POI transports par Overpass (même endpoint que peaks.js).
// Catégories demandées par Adrien : gare, bus, téléphérique/télécabine,
// aéroport, métro, maritime. Parsing pur (testé) ; fetch avec cache par
// bounds+cats ; le retrait individuel d'un POI vit dans raceState.removed.

const OVERPASS = 'https://overpass-api.de/api/interpreter'

export const TRANSPORT_CATS = [
  { key: 'gare', label: 'Gares', fallback: 'Gare', match: (t) => t.railway === 'station' && t.station !== 'subway' },
  { key: 'bus', label: 'Bus', fallback: 'Gare routière', match: (t) => t.amenity === 'bus_station' },
  { key: 'telepherique', label: 'Téléphériques', fallback: 'Remontée', match: (t) => !!t.aerialway },
  { key: 'aeroport', label: 'Aéroports', fallback: 'Aérodrome', match: (t) => t.aeroway === 'aerodrome' },
  { key: 'metro', label: 'Métro', fallback: 'Métro', match: (t) => t.station === 'subway' },
  { key: 'bateau', label: 'Maritime', fallback: 'Embarcadère', match: (t) => t.amenity === 'ferry_terminal' },
]

const CLAUSES = {
  gare: ['node["railway"="station"]'],
  bus: ['node["amenity"="bus_station"]'],
  telepherique: ['node["aerialway"="station"]'],
  aeroport: ['node["aeroway"="aerodrome"]'],
  metro: ['node["station"="subway"]'],
  bateau: ['node["amenity"="ferry_terminal"]'],
}

export function overpassTransportQuery(b, cats) {
  const bbox = `(${b.s},${b.w},${b.n},${b.e})`
  const body = cats.flatMap((k) => CLAUSES[k] || []).map((c) => `${c}${bbox};`).join('')
  return `[out:json][timeout:20];(${body});out body 400;`
}

export function parseOverpassTransports(json) {
  const seen = new Set()
  const out = []
  for (const el of json?.elements || []) {
    if (el.type !== 'node' || !el.tags) continue
    const cat = TRANSPORT_CATS.find((c) => c.match(el.tags))
    if (!cat) continue
    const id = `tp_${el.id}`
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, cat: cat.key, name: el.tags.name || cat.fallback, lat: el.lat, lon: el.lon })
  }
  return out
}

const _cache = new Map()
export async function fetchTransports(bounds, cats) {
  const key = `${bounds.s.toFixed(3)},${bounds.w.toFixed(3)},${bounds.n.toFixed(3)},${bounds.e.toFixed(3)}|${[...cats].sort().join(',')}`
  if (_cache.has(key)) return _cache.get(key)
  const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(overpassTransportQuery(bounds, cats)) })
  if (!r.ok) throw new Error(`overpass → HTTP ${r.status}`)
  const pois = parseOverpassTransports(await r.json())
  _cache.set(key, pois)
  return pois
}
