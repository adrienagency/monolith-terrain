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

// ═══ LE BUDGET D'ATTENTE, ET POURQUOI IL EST LOAD-BEARING ════════════════════
//
// Overpass est un ENRICHISSEMENT : le calque d'eau sait déjà se dessiner sans
// lui (tuiles Overture locales, puis Natural Earth). Mais jusqu'au 2026-07-31
// cet enrichissement facultatif tenait en otage la donnée garantie, parce que
// rien ne bornait l'attente côté client.
//
// MESURÉ in situ le 2026-07-31 (Chrome, page servie, Chamonix z12, en mode
// ordinaire ET en mode continu — ce n'est pas un défaut du 3×3) :
//   - le calque finissait par produire 186 objets… à 42 SECONDES ;
//   - quatre requêtes vers overpass-api.de mouraient en
//     ERR_CONNECTION_TIMED_OUT, 31 à 42 s chacune ;
//   - `curl` depuis la même machine n'établit même pas la connexion
//     (time_connect = 0, abandon à 21,6 s) : l'API est injoignable d'ici ;
//   - pendant ce temps les tuiles Overture, LOCALES, avaient leurs 256 entités
//     prêtes en moins d'une seconde, derrière le `await Promise.all(...)`.
// Autrement dit : « le calque d'eau ne produit RIEN » était en réalité « le
// calque d'eau attend 42 s ». Un silence, pas une panne — donc invisible.
//
// ⚠️ Le `[timeout:25]` des requêtes ne protège de rien dans ce cas : c'est le
// budget d'EXÉCUTION du serveur, il ne commence à courir qu'une fois la
// connexion établie. Sans connexion, on tombait sur le délai TCP du navigateur.
//
// D'où les deux garde-fous ci-dessous.

// ① Le temps qu'on accepte d'attendre Overpass avant de dessiner sans lui.
// 6 s, et le chiffre n'est pas pris au hasard : la mesure de référence de ce
// module donne 927 ms pour la requête à tag nu (voir WAY_TAG plus haut), donc
// 6 s laisse SIX FOIS la marge à une requête saine — aucune n'est coupée — tout
// en ramenant la fenêtre sans eau de 42 s à 6 s. Au-delà, on rend la main : la
// requête, elle, continue dans le cache et servira au prochain rebuild.
export const OVERPASS_ATTENTE_MS = 6000

// ② Le repos après une panne d'accès. Sans lui, sur une machine qui n'atteint
// pas Overpass, CHAQUE changement de zone repaie les 6 s. Avec lui, seul le
// premier les paie. Une minute : assez long pour ne pas re-sonder un réseau
// visiblement coupé, assez court pour que le retour du réseau se voie vite.
export const OVERPASS_PANNE_MS = 60_000

let _panneJusqua = 0
export function overpassEnPanne(maintenant = Date.now()) { return maintenant < _panneJusqua }
export function noterPanneOverpass(maintenant = Date.now()) { _panneJusqua = maintenant + OVERPASS_PANNE_MS }
export function oublierPanneOverpass() { _panneJusqua = 0 } // tests, et retour manuel

// Une erreur de REQUÊTE (statut HTTP, charge refusée) — par opposition à une
// panne d'ACCÈS. La distinction commande le disjoncteur : un 400 sur une bbox
// trop dense ou un 429 ponctuel ne dit rien de l'accessibilité du point
// d'accès, et couper l'eau partout pendant une minute pour ça fabriquerait la
// panne qu'on cherche à éviter. Seule l'absence de réponse l'ouvre.
class ErreurRequeteOverpass extends Error {}

// Ce que rend une attente arrivée à son terme. Un SYMBOLE, pas `null` : le
// disjoncteur doit distinguer « la requête n'a pas répondu à temps » de « la
// requête a répondu, et c'est vide ». Les deux se dessinent pareil, mais l'un
// est une panne d'accès et l'autre pas.
export const ABANDON = Symbol('overpass:abandon')

/**
 * Attend `job` au plus `ms`, puis rend `ABANDON` sans l'annuler.
 *
 * On n'annule PAS la requête : elle reste dans le cache et, si elle finit par
 * répondre, un rebuild ultérieur sur la MÊME emprise la trouve instantanément.
 * Abandonner l'ATTENTE coûte zéro ; abandonner la REQUÊTE jetterait un
 * enrichissement déjà payé. Le minuteur est toujours annulé — un setTimeout par
 * requête abandonnée retiendrait le processus (et, en test node, la suite).
 */
export function attendreOuAbandonner(job, ms) {
  if (!(ms > 0)) return job
  let minuteur = null
  const abandon = new Promise((resolve) => { minuteur = setTimeout(() => resolve(ABANDON), ms) })
  return Promise.race([job, abandon]).finally(() => clearTimeout(minuteur))
}

// cache by zone+kind, dedupe in-flight, min gap between network hits, null on fail
const _cache = new Map()
let _lastAt = 0

// Le `fetch` du navigateur par défaut ; injectable pour les tests (ce module
// n'a aucune autre dépendance à l'environnement).
const _fetch = (impl) => impl ?? ((...a) => globalThis.fetch(...a))

// Enregistre le job dans le cache et lui attache la comptabilité des pannes.
// `job.catch` ici n'est PAS le rattrapage de l'appelant : c'est ce qui empêche
// un rejet non traité, purge l'entrée pour qu'un rebuild ultérieur retente, et
// ouvre le disjoncteur si — et seulement si — l'accès a échoué.
function _memoriser(key, job, maintenant) {
  _cache.set(key, job)
  job.catch((err) => {
    _cache.delete(key)
    if (!(err instanceof ErreurRequeteOverpass)) noterPanneOverpass(maintenant())
  })
  return job
}

async function _lire(r, kind, lecteur) {
  if (!r.ok) throw new ErreurRequeteOverpass(`overpass ${r.status}`)
  try { assertSaneSize(r) } catch (err) { throw new ErreurRequeteOverpass(err.message) }
  return lecteur(await r.json(), kind)
}

// L'attente commune aux deux points d'entrée. Un abandon OUVRE le disjoncteur :
// six secondes sans réponse d'un service dont le nominal mesuré est 927 ms est
// une preuve suffisante. Sans ça le disjoncteur n'aurait servi à rien dans le
// cas réel — MESURÉ : la requête suspendue ne se rejette qu'au délai TCP du
// navigateur (42 s), donc un changement de zone à 10 s repayait le budget
// entier. Se tromper coûte au pire Natural Earth au lieu d'Overpass pendant une
// minute, et la requête abandonnée continue de remplir le cache.
async function _attendre(key, attenteMs, maintenant) {
  try {
    const r = await attendreOuAbandonner(_cache.get(key), attenteMs)
    if (r === ABANDON) { noterPanneOverpass(maintenant()); return null }
    return r
  } catch { return null }
}

// ⚠️ Le CACHE est consulté AVANT le disjoncteur, et l'ordre est load-bearing :
// le disjoncteur interdit d'ouvrir une requête NEUVE, pas de lire une réponse
// déjà payée. Une emprise dont la requête a fini par aboutir doit rendre sa
// donnée riche même pendant le repos — l'inverse jetterait ce qu'on vient
// justement de ne pas annuler.
export async function fetchOverpassLines(bbox, kind, { url = OVERPASS_URL, minInterval = 1200, attenteMs = OVERPASS_ATTENTE_MS, fetchImpl, now = Date.now } = {}) {
  const key = bboxKey(bbox, kind)
  if (!_cache.has(key)) {
    if (overpassEnPanne(now())) return null
    const body = buildQuery(bbox, kind)
    const f = _fetch(fetchImpl)
    _memoriser(key, (async () => {
      const wait = Math.max(0, _lastAt + minInterval - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      _lastAt = Date.now()
      const r = await f(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
      return _lire(r, kind, parseOverpass)
    })(), now)
  }
  return _attendre(key, attenteMs, now)
}

function areaBboxKey(bbox) {
  const r = (n) => Math.round(n * 1000) / 1000
  return `areas:${r(bbox.minLat)},${r(bbox.minLon)},${r(bbox.maxLat)},${r(bbox.maxLon)}`
}

// Same cache/dedupe/throttle contract as fetchOverpassLines, but for water AREAS
// — budget d'attente et disjoncteur inclus, pour les mêmes raisons (voir
// OVERPASS_ATTENTE_MS). Les deux requêtes partaient ensemble dans un
// `Promise.all` : en border une seule n'aurait rien borné du tout.
export async function fetchOverpassAreas(bbox, { url = OVERPASS_URL, minInterval = 1200, attenteMs = OVERPASS_ATTENTE_MS, fetchImpl, now = Date.now } = {}) {
  const key = areaBboxKey(bbox)
  if (!_cache.has(key)) {
    if (overpassEnPanne(now())) return null
    const body = buildAreaQuery(bbox)
    const f = _fetch(fetchImpl)
    _memoriser(key, (async () => {
      const wait = Math.max(0, _lastAt + minInterval - Date.now())
      if (wait) await new Promise((r) => setTimeout(r, wait))
      _lastAt = Date.now()
      const r = await f(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' } })
      return _lire(r, null, parseOverpassAreas)
    })(), now)
  }
  return _attendre(key, attenteMs, now)
}
