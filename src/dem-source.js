// SOURCE D'ALTIMÉTRIE — quel serveur de tuiles terrarium, et jusqu'où il voit.
//
// Deux sources, MÊME encodage terrarium (meters = R*256 + G + B/256 − 32768),
// donc interchangeables pixel pour pixel — seule la TAILLE de tuile diffère :
//
//   mapterhorn — 512 px, agrège les jeux nationaux (IGN RGE ALTI en France,
//     swissALTI3D en Suisse, …). C'est la source par défaut. Couverture
//     VARIABLE : z12 partout sur les terres émergées, z13–z17 selon les pays,
//     et RIEN au-dessus de z4 en pleine mer (404).
//   aws — 256 px, le bucket public elevation-tiles-prod. Figé à novembre 2017
//     (EU-DEM 25 m en Europe : plus aucune information réelle au-delà de
//     6,6 m/pixel). C'est le REPLI, pas le choix par défaut.
//
// Pourquoi garder le repli : Mapterhorn est un projet associatif, sans
// engagement de service. Une panne (réseau, 5xx, DNS, WebP indécodable) doit
// dégrader la carte, pas l'éteindre — d'où la bascule automatique, retenue pour
// toute la session.
//
// ⚠️ UN 404 N'EST PAS UNE PANNE. C'est la façon normale dont Mapterhorn dit
// « je ne couvre pas ici, à ce zoom-là ». On ne bascule donc JAMAIS sur un 404 :
// on surzoome depuis l'ancêtre (bathy.js/overzoomTile), ou — si la zone n'est
// pas couverte du tout — on prend AWS POUR CETTE ZONE seulement.
//
// Module PUR : ni DOM, ni three.js. `fetch` est injectable, tout est testable
// en node.

export const MAPTERHORN_ATTRIBUTION_URL = 'https://mapterhorn.com/attribution'

export const DEM_SOURCES = {
  mapterhorn: {
    id: 'mapterhorn',
    credit: '© Mapterhorn',
    creditUrl: MAPTERHORN_ATTRIBUTION_URL,
    url: (z, x, y) => `https://tiles.mapterhorn.com/${z}/${x}/${y}.webp`,
    tilePx: 512,
    // Plancher de COUVERTURE : mesuré, toute terre émergée répond au moins
    // jusqu'à z12 (Everest, Sahara, Rio) ; la pleine mer s'arrête à z4. Une
    // zone qui ne répond pas à z12 est donc « pas couverte » → repli AWS.
    baseZoom: 12,
    // Plafond de SONDAGE : le plus fin qu'on ait vu (Zermatt/swissALTI3D).
    maxZoom: 17,
    probe: true,
  },
  aws: {
    id: 'aws',
    credit: 'Terrain Tiles — Mapzen / Tilezen (AWS Open Data)',
    creditUrl: 'https://registry.opendata.aws/terrain-tiles/',
    url: (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
    tilePx: 256,
    baseZoom: 0,
    maxZoom: 15, // le jeu s'arrête là ; au-delà on surzoome
    probe: false, // couverture mondiale uniforme : rien à sonder
  },
}

export const DEFAULT_SOURCE_ID = 'mapterhorn'
export const FALLBACK_SOURCE_ID = 'aws'

// Taille de tuile du DEM chargé. Le défaut 256 n'est PAS décoratif : les DEM
// factices des tests (et tout objet {size, originTileX…} construit à la main)
// n'ont pas de `tilePx`, et l'ancienne convention doit continuer à marcher.
export const demTilePx = (dem) => dem?.tilePx || 256

// Panne de source — par opposition au 404 de couverture, qui n'en est pas une.
export class DemSourceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DemSourceError'
  }
}

// ------------------------------------------------------------------ le drapeau

let activeId = DEFAULT_SOURCE_ID
let forcedId = null // choix explicite (URL / localStorage) — jamais écrasé par le repli

// `?dem=aws` (ou localStorage monolith.demSource) épingle une source. Sert à
// comparer les deux à l'écran, et à revenir à AWS d'un geste si Mapterhorn
// devait tomber durablement.
function readFlag() {
  try {
    if (typeof location !== 'undefined' && location.search) {
      const v = new URLSearchParams(location.search).get('dem')
      if (v && DEM_SOURCES[v]) return v
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('monolith.demSource')
      if (v && DEM_SOURCES[v]) return v
    }
  } catch {}
  return null
}
forcedId = readFlag()
if (forcedId) activeId = forcedId

export function activeDemSource() {
  return DEM_SOURCES[activeId]
}

export function isFallbackActive() {
  return activeId === FALLBACK_SOURCE_ID && forcedId !== FALLBACK_SOURCE_ID
}

/**
 * Bascule DÉFINITIVE (pour la session) sur le bucket AWS après une panne.
 * Idempotent, et sans effet si l'utilisateur a épinglé une source.
 * @returns {object} la source à utiliser désormais
 */
export function fallbackToAws(reason) {
  if (forcedId) return DEM_SOURCES[forcedId]
  if (activeId !== FALLBACK_SOURCE_ID) {
    activeId = FALLBACK_SOURCE_ID
    // les zooms mémorisés décrivaient la couverture de l'AUTRE source
    regionZooms.clear()
    inFlight.clear()
    trous.clear() // idem : un trou est un trou DANS la source qu'on vient de quitter
    try {
      console.warn('[dem] source altimétrique repliée sur AWS —', reason?.message ?? reason)
    } catch {}
  }
  return DEM_SOURCES[FALLBACK_SOURCE_ID]
}

// remise à zéro complète — tests uniquement
export function _resetDemSource(id = DEFAULT_SOURCE_ID) {
  activeId = id
  forcedId = null
  regionZooms.clear()
  inFlight.clear()
  trous.clear() // CIB : la mémoire des 404 est de la couverture, elle se remet à zéro ici
}

// ------------------------------------------------------------------ zones

// Granularité de la MÉMOIRE de couverture. Une tuile z8 fait ~150 km de large :
// assez fin pour distinguer la France de la Suisse, assez grossier pour qu'un
// déplacement ordinaire ne resonde jamais. Le sondage coûte une poignée de
// requêtes HEAD ; sans mémoire, il se paierait à chaque chargement de bloc.
export const REGION_ZOOM = 8

/**
 * Fabrique la fonction « quelle tuile couvre le CENTRE de ce patch au zoom z ».
 * On part du centre FRACTIONNAIRE (cx+0.5, cy+0.5) : à l'inverse d'une simple
 * division d'entiers, un patch continental sonde alors une tuile fine posée
 * sous son centre — pas le coin nord-ouest de son ancêtre, qui peut être en mer
 * alors que le centre est sur la terre ferme.
 */
export function tileForZoomAt(zoom, cx, cy) {
  const fx = cx + 0.5
  const fy = cy + 0.5
  return (z) => {
    const s = 2 ** (z - zoom)
    const n = 2 ** z
    const wrap = (v) => ((Math.floor(v) % n) + n) % n
    return { x: wrap(fx * s), y: Math.min(n - 1, Math.max(0, Math.floor(fy * s))) }
  }
}

/** Clé de zone : la tuile z8 sous le centre du patch, par source. */
export function regionKey(sourceId, zoom, cx, cy) {
  const t = tileForZoomAt(zoom, cx, cy)(REGION_ZOOM)
  return `${sourceId}:${t.x},${t.y}`
}

// clé → zoom max couvert (number), ou null quand la zone n'est PAS couverte
const regionZooms = new Map()
const inFlight = new Map() // clé → Promise en cours (dédoublonne les blocs voisins)

/** Lecture SYNCHRONE de la mémoire : `undefined` = pas encore sondé. */
export function peekRegionMaxZoom(key) {
  return regionZooms.has(key) ? regionZooms.get(key) : undefined
}
export function rememberRegionMaxZoom(key, value) {
  regionZooms.set(key, value)
  return value
}
export function clearRegionMemo() {
  regionZooms.clear()
  inFlight.clear()
  trous.clear()
}

// ══════════ LES TROUS DE COUVERTURE, TUILE PAR TUILE — CIB ══════════════════
//
// La sonde de zone (`REGION_ZOOM = 8`, ~150 km) dit « cette zone monte à z14 ».
// Elle ne dit RIEN de la mer À L'INTÉRIEUR de la zone : une z13 au large d'une
// côte couverte rend 404, et `fetchTile` la rattrape sur AWS — au prix d'un
// SECOND aller-retour. Mesuré par PF2 (§5) : **679 des 1 704 requêtes d'une
// descente en dev, soit 40 %**, chacune payée deux fois.
//
// ⚠️ **ET CE N'EST PAS UNE PANNE** : l'en-tête de ce module le dit, un 404 est
// la façon normale dont Mapterhorn dit « je ne couvre pas ici ». On ne bascule
// donc PAS la source de session (`fallbackToAws`) — on note le TROU, et les
// DESCENDANTS de la tuile trouée vont droit chez AWS sans réessayer la source
// fine. La pyramide est monotone dans ce sens-là : si (z, x, y) n'existe pas,
// aucun de ses descendants n'existe (`probeMaxZoom` s'appuie déjà sur
// l'implication inverse, « un z16 servi implique z15, z14, … »).
//
// ⚠️ **LE PLAFOND N'EST PAS DÉCORATIF.** Une mémoire non bornée alimentée par
// le parcours est exactement la file non bornée du §2 de `/threejs-optimisation`.
// Au plafond, on VIDE plutôt que d'évincer au hasard : reperdre la mémoire coûte
// un aller-retour de plus par tuile, jamais une erreur, et le cas ne se présente
// que sur une session qui a survolé plus de 4 096 trous distincts.
const TROUS_MAX = 4096
const trous = new Set() // `sourceId:z/x/y` — la tuile a rendu 404 sur la source fine

/** Note un 404 de couverture sur la source fine, pour cette tuile et ses descendants. */
export function noterTrouTuile(sourceId, z, x, y) {
  if (trous.size >= TROUS_MAX) trous.clear()
  trous.add(`${sourceId}:${z}/${x}/${y}`)
}

/**
 * Cette tuile — ou l'un de ses ANCÊTRES jusqu'à `zMin` — a-t-il déjà rendu 404 ?
 * ⚠️ La remontée s'arrête au plancher de couverture de la source : au-dessous,
 * `planTuile` ne consulte même pas la source fine.
 */
export function trouConnu(sourceId, z, x, y, zMin = 0) {
  for (let zz = z, xx = x, yy = y; zz >= zMin; zz--, xx >>= 1, yy >>= 1) {
    if (trous.has(`${sourceId}:${zz}/${xx}/${yy}`)) return true
  }
  return false
}

export function clearTrous() {
  trous.clear()
}
export function nombreDeTrous() {
  return trous.size
}

/**
 * Sonde le zoom le plus fin réellement servi pour une zone.
 *
 * Les zooms candidats (source.maxZoom → source.baseZoom) partent EN PARALLÈLE :
 * une poignée de HEAD, un seul aller-retour, et le résultat est mémorisé. La
 * lecture des statuts est la partie délicate :
 *   200 quelque part → le maximum de ces zooms (la pyramide est complète en
 *     dessous : un z16 servi implique z15, z14, …)
 *   que des 404      → zone NON couverte (pleine mer) → `null`
 *   ni 200 ni que des 404 → PANNE (5xx, réseau) → on lève DemSourceError
 *
 * @returns {Promise<number|null>}
 */
export async function probeMaxZoom(source, tileForZoom, fetchImpl) {
  const zooms = []
  for (let z = source.maxZoom; z >= source.baseZoom; z--) zooms.push(z)
  const results = await Promise.all(
    zooms.map(async (z) => {
      const t = tileForZoom(z)
      try {
        const r = await fetchImpl(source.url(z, t.x, t.y), { method: 'HEAD' })
        if (r.ok) return { z, ok: true }
        if (r.status === 404) return { z, miss: true }
        return { z, error: `HTTP ${r.status}` }
      } catch (err) {
        return { z, error: err?.message || String(err) }
      }
    })
  )
  let best = null
  let errors = 0
  for (const r of results) {
    if (r.ok) best = best == null ? r.z : Math.max(best, r.z)
    else if (r.error) errors++
  }
  if (best != null) return best
  if (errors) throw new DemSourceError(`sondage ${source.id} : ${errors}/${results.length} en échec`)
  return null // que des 404 → hors couverture
}

/**
 * Zoom max de la zone contenant le patch, mémorisé. Une source sans `probe`
 * (AWS) rend directement son plafond, sans une seule requête.
 * @returns {Promise<number|null>} null = zone non couverte par cette source
 */
export function resolveRegionMaxZoom(source, zoom, cx, cy, fetchImpl = globalThis.fetch) {
  if (!source.probe) return Promise.resolve(source.maxZoom)
  const key = regionKey(source.id, zoom, cx, cy)
  const known = peekRegionMaxZoom(key)
  if (known !== undefined) return Promise.resolve(known)
  const pending = inFlight.get(key)
  if (pending) return pending
  const job = probeMaxZoom(source, tileForZoomAt(zoom, cx, cy), fetchImpl)
    .then((v) => {
      inFlight.delete(key)
      return rememberRegionMaxZoom(key, v)
    })
    .catch((err) => {
      inFlight.delete(key) // une panne ne se mémorise pas : la zone reste à sonder
      throw err
    })
  inFlight.set(key, job)
  return job
}
