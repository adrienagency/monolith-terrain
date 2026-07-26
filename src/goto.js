// Go-to travel: paste coordinates or search a place name, then let the mode
// machine fly there over the globe and dive into surface mode.

import { parseLatLon } from './geo.js'
import { stepZoom } from './modes.js'
import { zoomForSpanKm } from './landmarks.js'
import { frameRegion, NEAR_ISLAND_KM } from './region-mask.js'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// name → { lat, lon, label, bbox } via Nominatim (no key; be a polite client).
// bbox is Nominatim's [south, north, west, east] — used to FRAME the whole
// feature on the socle (a country fits the block, not a tight zoom in the middle).
export async function geocode(query) {
  // polygon_geojson : la VRAIE géométrie, pas seulement l'emprise. C'est elle
  // qui permet de cadrer sur la France métropolitaine plutôt que sur une boîte
  // étirée jusqu'à Wallis-et-Futuna. Le seuil de simplification garde la
  // réponse légère (quelques dizaines de Ko pour un pays).
  const url = `${NOMINATIM}?format=json&limit=1&polygon_geojson=1&polygon_threshold=0.02&q=${encodeURIComponent(query)}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`geocoding → HTTP ${r.status}`)
  const results = await r.json()
  if (!results.length) return null
  const hit = results[0]
  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), label: hit.display_name, bbox: hit.boundingbox, geojson: hit.geojson }
}

// From Nominatim's boundingbox → { lat, lon, zoom } that frames the WHOLE
// feature centred on the block (Adrien : « je veux voir la France, toute la
// France tient sur le block »). Null if the bbox is missing/degenerate, so the
// caller can fall back to its default landing zoom.
// Les morceaux du polygone qui décrivent LE territoire demandé : celui qui
// contient le point représentatif, plus ceux à moins de NEAR_ISLAND_KM (la
// Corse tient au dessin de la France, la Réunion non). Même règle que la
// découpe de zone, appliquée ici sans DEM — on est avant tout chargement.
export function mainParts(geojson, lat, lon, maxKm = NEAR_ISLAND_KM) {
  const coords = geojson?.type === 'Polygon' ? [geojson.coordinates] : geojson?.type === 'MultiPolygon' ? geojson.coordinates : null
  if (!coords?.length) return null
  const box = (ring) => {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity
    for (const [x, y] of ring) { if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > d) d = y }
    return { a, b, c, d }
  }
  const gap = (p, q) => {
    const dLon = Math.max(0, p.a - q.b, q.a - p.b)
    const dLat = Math.max(0, p.c - q.d, q.c - p.d)
    return Math.hypot(dLat * 110.54, dLon * 111.32 * Math.cos((lat * Math.PI) / 180))
  }
  const parts = coords.filter((r) => r?.[0]?.length).map((rings) => ({ rings, box: box(rings[0]) }))
  if (!parts.length) return null
  // la graine : le morceau dont l'emprise contient le point représentatif ;
  // à défaut, le plus proche de lui
  let graine = parts.find((p) => lon >= p.box.a && lon <= p.box.b && lat >= p.box.c && lat <= p.box.d)
  if (!graine) graine = parts.reduce((m, p) => (gap(p.box, { a: lon, b: lon, c: lat, d: lat }) < gap(m.box, { a: lon, b: lon, c: lat, d: lat }) ? p : m))
  return parts.filter((p) => p === graine || gap(p.box, graine.box) <= maxKm).map((p) => p.rings)
}

// Une emprise dont la longitude couvre plus que ça n'encercle pas un territoire
// d'un seul tenant : c'est une nation à possessions lointaines, et Nominatim
// l'étire jusqu'à l'antiméridien.
const BBOX_LON_MAX = 90
// Et une emprise dont le centre s'éloigne autant du point représentatif ne
// décrit plus le même endroit.
const BBOX_DRIFT_KM = 500

export function frameFromBBox(bbox, { min = 4, max = 15, at = null } = {}) {
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const [s, n, w, e] = bbox.map(Number)
  if ([s, n, w, e].some((v) => !Number.isFinite(v))) return null

  // LE CENTRE VIENT DU POINT REPRÉSENTATIF, JAMAIS DE L'EMPRISE.
  //
  // Nominatim étire l'emprise d'un pays jusqu'à ses territoires les plus
  // lointains : celle de la France couvre 350° de longitude (Wallis-et-Futuna
  // à −178,4°, Matthew et Hunter à +172,3°). Son centroïde tombait dans le
  // golfe de Guinée, à 300 km au sud du Ghana — d'où un bloc peuplé de
  // Casablanca, Lagos et Kinshasa sur une recherche « France », et un cartouche
  // « UNCHARTED SECTOR » faute de savoir géocoder l'océan. Le lat/lon renvoyé
  // juste à côté, lui, était bon : 46,60 / 1,89, plein centre de la métropole.
  const latC = Number.isFinite(at?.lat) ? at.lat : (s + n) / 2
  const lonC = Number.isFinite(at?.lon) ? at.lon : (w + e) / 2

  const nsKm = Math.abs(n - s) * 111.32
  const ewKm = Math.abs(e - w) * 111.32 * Math.cos((latC * Math.PI) / 180)
  const spanKm = Math.max(nsKm, ewKm)
  if (!(spanKm > 0)) return null

  // L'emprise ne décide du ZOOM que si elle est crédible. Sinon on ne rend
  // aucun cadre : l'appelant retombe sur son zoom d'atterrissage, ce qui vaut
  // mieux qu'un plancher à z4 hérité d'un span de 39 000 km.
  const driftKm = at
    ? Math.hypot(((s + n) / 2 - latC) * 111.32, ((w + e) / 2 - lonC) * 111.32 * Math.cos((latC * Math.PI) / 180))
    : 0
  if (Math.abs(e - w) > BBOX_LON_MAX || driftKm > BBOX_DRIFT_KM) return null

  return { lat: latC, lon: lonC, zoom: zoomForSpanKm(spanKm, latC, { min, max }) }
}

// Wire the two GUI fields to the mode machine. `modes.flyTo` does the rest.
// `getFineZoom` (optional): the user's own finest detail zoom — task 30
// Fix B: "quand on rentre une localité, ne fais pas apparaître le zoom
// maxi... mais le niveau supérieur, sinon on ne comprend pas ce qu'on voit."
// A bare paste/search used to hand flyTo() no zoom at all, which lands on
// the FINEST tier available (modes.js's _dive(): `tier.zoom ?? getFineZoom()`
// when tr.zoom is null) — too tight to show what's actually around the
// place. landingZoom() below steps one staircase notch OUT from that finest
// zoom (stepZoom's own coarsen direction, the same helper the coarsen-wheel
// path already uses) and hands flyTo() that explicit zoom instead, so the
// arrival shows the locality WITH its surroundings. GPX framing (main.js's
// frameTrack) is a separate call path and is untouched by this.
function landingZoom(getFineZoom) {
  if (!getFineZoom) return null
  return stepZoom(getFineZoom(), -1)
}

export function createGoto({ modes, announce, getFineZoom }) {
  return {
    async go(text) {
      const c = parseLatLon(text)
      if (!c) {
        announce('UNREADABLE COORDINATES — TRY “45.8326, 6.8652”')
        return false
      }
      if (!(await modes.flyTo(c.lat, c.lon, landingZoom(getFineZoom)))) {
        announce('NAVIGATION BUSY — TRY AGAIN IN A MOMENT')
        return false
      }
      announce(`COURSE SET — ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`)
      return true
    },

    async search(query) {
      if (!query || !query.trim()) return false
      announce(`SEARCHING — ${query.toUpperCase()}`)
      try {
        const hit = await geocode(query.trim())
        if (!hit) {
          announce('NO MATCH FOUND')
          return false
        }
        // frame the WHOLE feature from its bounding box (country/city fills the
        // block) ; fall back to the point + default landing zoom if there's no bbox
        const fine = getFineZoom ? getFineZoom() : 15
        // RÈGLE DE BASE (Adrien) : la recherche doit montrer la ZONE ENTIÈRE,
        // jamais un zoom en son milieu. Le cadre vient donc de la GÉOMÉTRIE
        // réelle, débarrassée des territoires lointains.
        //
        // ⚠️ Première tentative ratée : refuser l'emprise aberrante pour
        // retomber sur le zoom d'atterrissage. Ça corrigeait bien le centre
        // (la France ne partait plus dans le golfe de Guinée) mais violait la
        // règle de plein fouet — on atterrissait serré au milieu du pays.
        // `at` reste l'arbitre du repli quand aucune géométrie n'est fournie.
        const parts = mainParts(hit.geojson, hit.lat, hit.lon)
        const framed =
          (parts && frameRegion(parts, { min: 4, max: fine })) ||
          frameFromBBox(hit.bbox, { min: 4, max: fine, at: hit })
        const lat = framed?.lat ?? hit.lat
        const lon = framed?.lon ?? hit.lon
        const zoom = framed?.zoom ?? landingZoom(getFineZoom)
        if (!(await modes.flyTo(lat, lon, zoom))) {
          announce('NAVIGATION BUSY — TRY AGAIN IN A MOMENT')
          return false
        }
        announce(`TARGET — ${hit.label.split(',').slice(0, 2).join(',').toUpperCase()}`)
        return true
      } catch {
        announce('SEARCH OFFLINE — USE COORDINATES')
        return false
      }
    },
  }
}
