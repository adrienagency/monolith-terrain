// Full-detail OSM lines via the Overpass API — raw geometry, NO simplification.
// Endpoint is a const so a self-hosted instance can replace the public one.
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
// ══════ LES MIROIRS OVERPASS, MESURÉS DEPUIS CETTE MACHINE — RIV-C ══════════
//
// `curl` POST, même requête (`way["waterway"]` sur une bbox de Lyon, 0,15° de
// côté), quatre tours, 2026-09-04 :
//
//   | point d'accès                     | 200 | temps        | corps      |
//   |-----------------------------------|-----|--------------|------------|
//   | **overpass-api.de** (celui d'ici) | 0/4 | expire       | —          |
//   | overpass.kumi.systems             | 1/4 | 5,7 s        | 363 328 o  |
//   | **overpass.osm.ch**               | 4/4 | 0,13–0,33 s  | **272 o**  |
//   | maps.mail.ru/osm/tools/overpass   | 4/4 | 1,1–4,0 s    | 363 867 o  |
//
// ⛔ **overpass.osm.ch EST UN PIÈGE, PAS UN MIROIR.** Il répond 200 en 130 ms
// avec `"elements": []` : c'est un extrait SUISSE. Sur Lyon — et sur les 99 %
// du monde hors de sa couverture — il rend un SUCCÈS VIDE. Or un succès vide
// n'emprunte pas le chemin `null → Natural Earth` : `if (feats)` est vrai pour
// un tableau vide, donc il EFFACERAIT les rivières de repli au lieu de les
// laisser. Le basculer serait remplacer une lenteur par une perte de données
// silencieuse. **Ne pas l'utiliser.**
//
// ⚠️ Et `overpass.kumi.systems`, donné pour « 200 en 4,5 s », n'a répondu qu'une
// fois sur quatre pour moi, en 5,7 s — sous les 6 s du budget, mais de peu.
//
// ➡️ **ON NE BASCULE PAS, ET LE RISQUE EST ÉCRIT.** Les trois miroirs sont des
// services publics gratuits qui limitent par IP du VISITEUR (voir le § damier
// de water-layer.js) ; `maps.mail.ru` ajoute une juridiction et une pérennité
// qu'on ne maîtrise pas, pour un enrichissement facultatif. Depuis RIV-C le
// repli local peint en premier : un point d'accès mort ne coûte plus qu'un
// enrichissement manqué, plus une attente. Changer de serveur n'achèterait donc
// plus de latence — seulement de la donnée fine, contre une dépendance de plus.
// Le jour où l'eau fine doit vraiment arriver, la réponse écrite dans ce dépôt
// reste la même : des tuiles vectorielles auto-hébergées, ou une instance à
// nous. Un miroir peut tomber demain ; `public/data/map/rivers.json`, non.
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

// ③ LE BUDGET DE LA **SONDE** — après un échec d'accès franc, on ne repaie pas
// six secondes pour réapprendre ce qu'on sait déjà.
//
// ⚠️ MESURÉ (`scripts/sonde-riv-c.mjs`, contexte neuf) : les DEUX premières
// reconstructions payaient un budget PLEIN — 6 010 ms puis 6 200 à 10 000 ms —
// avant que le disjoncteur ne serve à quoi que ce soit. Le repos de 60 s
// (OVERPASS_PANNE_MS) protège les zones SUIVANTES, mais rien ne protégeait la
// deuxième tentative, ni la première d'après le repos.
//
// 1,5 s, et le chiffre n'est pas pris au hasard non plus : la mesure de
// référence du module donne 927 ms pour une requête saine, donc une sonde à
// 1,5 s laisse encore passer un point d'accès qui répond normalement, tout en
// divisant par quatre le prix d'un point d'accès mort. Un point d'accès sain
// mais lent perd son enrichissement sur CETTE arrivée seulement : la requête
// n'est pas annulée, elle continue de remplir le cache, et la reconstruction
// suivante sur la même emprise la trouve — et remet le compteur à zéro.
export const OVERPASS_ATTENTE_SONDE_MS = 1500

// ② Le repos après une panne d'accès. Sans lui, sur une machine qui n'atteint
// pas Overpass, CHAQUE changement de zone repaie les 6 s. Avec lui, seul le
// premier les paie. Une minute : assez long pour ne pas re-sonder un réseau
// visiblement coupé, assez court pour que le retour du réseau se voie vite.
export const OVERPASS_PANNE_MS = 60_000

let _panneJusqua = 0
// Le nombre d'échecs d'ACCÈS d'affilée. Zéro = on n'a aucune raison de douter
// du point d'accès, il a droit au budget plein. Au-delà, la prochaine requête
// neuve est une SONDE (voir OVERPASS_ATTENTE_SONDE_MS). Toute réponse lue
// remet le compteur à zéro : le réseau est revenu, on lui rend sa confiance.
let _pannesDAffilee = 0
export function overpassEnPanne(maintenant = Date.now()) { return maintenant < _panneJusqua }
export function noterPanneOverpass(maintenant = Date.now()) { _panneJusqua = maintenant + OVERPASS_PANNE_MS; _pannesDAffilee++ }
export function oublierPanneOverpass() { _panneJusqua = 0; _pannesDAffilee = 0 } // tests, et retour manuel
export function overpassSondeSeulement() { return _pannesDAffilee > 0 }
// Le budget qu'on accorde à une requête NEUVE, sachant ce qu'on sait du point
// d'accès. `Math.min` et pas un remplacement : un appelant qui demande déjà
// moins que la sonde (les tests le font) garde sa valeur.
function _budget(attenteMs) { return _pannesDAffilee > 0 ? Math.min(attenteMs, OVERPASS_ATTENTE_SONDE_MS) : attenteMs }

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
// ② L'ÉCHÉANCE, UNE PAR REQUÊTE ET PARTAGÉE — RIV-C.
//
// ⛔ **CHAQUE RECONSTRUCTION ROUVRAIT SON PROPRE BUDGET DE 6 s SUR UNE REQUÊTE
// DÉJÀ EN VOL.** Le cache dédoublonne bien la REQUÊTE — une seule part sur le
// réseau — mais `_attendre` posait un minuteur NEUF à chaque appel. Deux
// reconstructions sur la même emprise (c'est le cas courant : le vol en
// déclenche plusieurs) attendaient donc 6 s, puis encore 6 s, sur la MÊME
// connexion morte.
//
// MESURÉ avant, contexte neuf, Rhône z13 : 6 008,6 ms puis **9 988,2 ms** —
// la deuxième attente est même plus longue que le budget, parce qu'elle
// démarre son minuteur après le sien.
//
// Une échéance par clé, posée par le PREMIER qui attend. Les suivants héritent
// de ce qui reste ; ils ne redémarrent pas le compteur.
//
// ⚠️ **`Math.max(1, reste)` ET PAS `Math.max(0, reste)`.** À zéro,
// `attendreOuAbandonner` rend le job NU (`if (!(ms > 0)) return job`) : sur une
// requête qui ne répond jamais, l'attente redeviendrait infinie — exactement le
// défaut de 42 s que ce module a été écrit pour supprimer. Et 1 ms suffit à ne
// jamais jeter une réponse déjà arrivée : une promesse réglée gagne toujours la
// course contre un `setTimeout`, qui est une macrotâche. Le cache reste donc
// lisible même échéance dépassée, comme le veut la règle « le cache passe avant
// le disjoncteur ».
const _echeances = new Map()
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
    // L'échéance meurt avec l'entrée : une reconstruction ultérieure ouvre une
    // requête NEUVE, elle a droit à un budget neuf.
    _echeances.delete(key)
    if (!(err instanceof ErreurRequeteOverpass)) noterPanneOverpass(maintenant())
  })
  return job
}

async function _lire(r, kind, lecteur) {
  if (!r.ok) throw new ErreurRequeteOverpass(`overpass ${r.status}`)
  try { assertSaneSize(r) } catch (err) { throw new ErreurRequeteOverpass(err.message) }
  const v = lecteur(await r.json(), kind)
  // Le point d'accès a RÉPONDU : il a de nouveau droit au budget plein.
  _pannesDAffilee = 0
  return v
}

// L'attente commune aux deux points d'entrée. Un abandon OUVRE le disjoncteur :
// six secondes sans réponse d'un service dont le nominal mesuré est 927 ms est
// une preuve suffisante. Sans ça le disjoncteur n'aurait servi à rien dans le
// cas réel — MESURÉ : la requête suspendue ne se rejette qu'au délai TCP du
// navigateur (42 s), donc un changement de zone à 10 s repayait le budget
// entier. Se tromper coûte au pire Natural Earth au lieu d'Overpass pendant une
// minute, et la requête abandonnée continue de remplir le cache.
async function _attendre(key, attenteMs, maintenant) {
  // L'échéance est posée UNE FOIS par le premier attendeur (voir _echeances).
  let echeance = _echeances.get(key)
  if (echeance === undefined) { echeance = maintenant() + attenteMs; _echeances.set(key, echeance) }
  const reste = echeance - maintenant()
  try {
    const r = await attendreOuAbandonner(_cache.get(key), Math.max(1, reste))
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
  return _attendre(key, _budget(attenteMs), now)
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
  return _attendre(key, _budget(attenteMs), now)
}
