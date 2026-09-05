// Ground info: the cartographic blurb laid out on the base around the slab —
// place name, coordinates, elevation range, a short description. Data is pulled
// from free, no-key web sources (Nominatim reverse-geocode + Wikipedia geo
// search/summary) plus the loaded DEM's own elevation stats. The anecdote
// source is a pluggable hook (`fetchAnecdote`) so a Claude Sonnet backend can
// be dropped in later without touching the rest.

const NOMINATIM = 'https://nominatim.openstreetmap.org'
const WIKI = 'https://en.wikipedia.org'

// ---------------------------------------------------------------- pure format

// "45.8326°N  6.8652°E" — decimal, hemisphere-suffixed. Pure & tested.
export function formatCoord(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${ns}  ${Math.abs(lon).toFixed(4)}°${ew}`
}

// "40°50′57″N" degrees-minutes-seconds for one axis
export function toDMS(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  let v = Math.abs(value)
  const d = Math.floor(v)
  v = (v - d) * 60
  const m = Math.floor(v)
  const s = Math.round((v - m) * 60)
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${hemi}`
}

// "ELEV  1,035 – 3,305 m  ·  mean 2,100 m" from DEM meters. Pure & tested.
export function formatElevation(minM, maxM, meanM) {
  const m = (x) => Math.round(x).toLocaleString('en-US')
  return `ELEV  ${m(minM)} – ${m(maxM)} m  ·  mean ${m(meanM)} m`
}

// clean a Wikipedia extract into a short one/two-sentence blurb
export function trimBlurb(text, maxChars = 260) {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.trimEnd() + '…').trim()
}

// split an extract into a short description (opening) and a distinct anecdote —
// a later sentence carrying a number or a superlative, the sort of fact that
// reads well as a standalone note. Pure & tested.
export function splitBlurb(text) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { description: '', anecdote: '' }
  const sentences = clean.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) || [clean]
  const description = trimBlurb(sentences.slice(0, 2).join(' '), 200)
  const notable = /\d|highest|largest|longest|deepest|oldest|first|only|most|world'?s|tallest|active/i
  const anecdote = sentences.slice(1).find((s) => notable.test(s) && s !== description) || sentences[2] || ''
  return { description, anecdote: trimBlurb(anecdote, 170) }
}

// ══════════ QUAND LE CARTOUCHE DOIT SE RAFRAÎCHIR ═══════════════════════════
//
// ⚠️ CE N'EST PAS UN PROBLÈME DE SUIVI, C'EST DE LA FRAÎCHEUR. `ground-info`
// reste dans le socle et NE DOIT PAS défiler — c'est du mobilier, pas du
// paysage (audit du jalon 3). Mais son CONTENU parle du sol : nom du lieu,
// coordonnées, plage d'altitude. Après un défilement d'un socle entier —
// 21 km à z12, d'Annecy à Chamonix — il décrit un endroit où l'on n'est plus.
//
// Trois raisons interdisent de le refaire à chaque image :
//  · il interroge Nominatim ET Wikipédia (deux services publics, sans clé) ;
//  · il regrave une dizaine de canevas et autant de textures ;
//  · un cartouche dont le texte change en continu sous le doigt est illisible.
//
// D'où DEUX conditions, et la seconde est celle qui compte :
//
//  1. AVOIR ASSEZ BOUGÉ. Un quart de socle — au-delà, la moitié de ce que
//     décrit le cartouche est sortie du cadre. En dessous, on regraverait des
//     textures pour un texte identique : le mémo web est déjà arrondi à 0,01°,
//     soit ~1,1 km, donc même le nom du lieu ne bougerait pas.
//  2. ÊTRE AU REPOS. La même notion que la finesse du maillage : on ne demande
//     rien au réseau et on ne regrave rien pendant que l'image bouge. Le
//     rafraîchissement arrive donc APRÈS le geste, comme le maillage fin —
//     on voit le relief se poser, puis la légende se mettre d'accord avec lui.
//     C'est aussi le seul ordre lisible.
export const CARTOUCHE_SEUIL_FRAC = 0.25

/**
 * Faut-il refaire le cartouche ?
 *
 * @param {object} o
 * @param {{x:number,z:number}|null} o.derniere - fenêtre du dernier cartouche posé
 * @param {{x:number,z:number}|null} o.courante - fenêtre affichée maintenant
 * @param {boolean} o.repos - l'image est-elle posée ? (fenetre-finesse.js)
 * @param {number} o.tailleSocle - TERRAIN_SIZE, en unités monde
 * @returns {boolean}
 */
export function doitRafraichirCartouche({ derniere, courante, repos, tailleSocle }) {
  if (!repos || !courante || !derniere) return false
  // ⚠️ « jamais posé » (derniere null) n'est PAS l'affaire de cette règle : elle
  // sait dire « il a vieilli », pas « il n'existe pas ». Le premier cartouche
  // est posé par le chargement de la zone, qui a le lieu sous la main.
  const d = Math.hypot(courante.x - derniere.x, courante.z - derniere.z)
  return Number.isFinite(d) && d >= tailleSocle * CARTOUCHE_SEUIL_FRAC
}

// a real scale bar label for a patch that is `extentMeters` across: a round
// segment (1/2/5/10/25/50/100…) near a quarter of the width. Pure & tested.
export function scaleBar(extentMeters) {
  if (!extentMeters || extentMeters <= 0) return ''
  const targetKm = extentMeters / 1000 / 4
  const steps = [1, 2, 5, 10, 25, 50, 100, 250, 500]
  const seg = steps.reduce((best, s) => (Math.abs(s - targetKm) < Math.abs(best - targetKm) ? s : best), steps[0])
  return `SCALE  0 ─── ${seg} ─── ${seg * 2} km`
}

// ---------------------------------------------------------------- fetchers

async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=9&accept-language=en`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`nominatim → HTTP ${r.status}`)
  const j = await r.json()
  const a = j.address || {}
  const name =
    a.state || a.region || a.county || a.city || a.town || a.village || j.name || j.display_name?.split(',')[0] || ''
  return { name: name.trim(), country: (a.country || '').trim() }
}

// nearest Wikipedia article to the coordinates, with its summary extract
async function nearbyWikipedia(lat, lon) {
  const geo = `${WIKI}/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=10000&gslimit=1&format=json&origin=*`
  const gr = await fetch(geo)
  if (!gr.ok) throw new Error(`wiki geosearch → HTTP ${gr.status}`)
  const gj = await gr.json()
  const hit = gj.query?.geosearch?.[0]
  if (!hit) return { title: '', extract: '' }
  const sum = `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`
  const sr = await fetch(sum)
  if (!sr.ok) return { title: hit.title, extract: '' }
  const sj = await sr.json()
  return { title: hit.title, extract: sj.extract || '' }
}

// default anecdote source — the nearest Wikipedia article's summary, split into
// a description + a distinct anecdote. Swap this hook for a Claude Sonnet call
// (needs a key/proxy) when one is available.
export async function wikipediaAnecdote({ lat, lon }) {
  try {
    const { title, extract } = await nearbyWikipedia(lat, lon)
    return { title, ...splitBlurb(extract) }
  } catch {
    return { title: '', description: '', anecdote: '' }
  }
}

// memo cache of the web parts, keyed by rounded lat/lon, so reloading a zone
// (or nudging the zoom) doesn't re-hit Nominatim/Wikipedia every time
const webCache = new Map()
const webKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`

// ══════════ CE QU'ON SAIT TOUT DE SUITE, SANS LE RÉSEAU — Tâche CAR ═════════
//
// ⛔ **LE CARTOUCHE MENTAIT APRÈS CHAQUE PALIER, ET LA CAUSE EST UN `await`.**
// VID2 (N3) : la carte à 44,3167 sous un cartouche à 44,3434 pendant 1,5 à
// 4,9 s ; « Réunion 21,26°S » affiché à Provence pendant 74–600 ms. Le groupe
// se remontrait dès l'arrivée du MNT, mais `load` attendait Nominatim ET
// Wikipédia avant de redessiner : les anciennes mailles restaient gravées tout
// le temps du réseau.
//
// Or **les coordonnées sont connues à l'instant où le lieu est demandé** ; la
// barre d'échelle dès que l'emprise l'est ; la plage d'altitude dès que le MNT
// est là. Seuls le nom et l'anecdote viennent du réseau — et le nom aussi est
// connu tout de suite quand le mémo web a déjà vu cette maille de 0,01°.
// `infoImmediate` rend donc ce qu'on sait, MAINTENANT, avec les mêmes champs
// que `gatherGroundInfo`, et rien qui vienne d'un autre lieu. Pure et testée.
//
// ⚠️ **`name` VIDE, PAS « UNCHARTED SECTOR »** : le repli n'a de sens qu'une
// fois le réseau interrogé ; avant, ce n'est pas « inconnu », c'est « pas
// encore ». Le titre vide se dessine comme une ligne vide, et `load` le remplit.
export function lieuConnu(lat, lon) {
  return webCache.get(webKey(lat, lon)) || null
}

export function infoImmediate({ lat, lon, extentMeters = null, stats = null }) {
  const web = lieuConnu(lat, lon)
  return {
    coord: formatCoord(lat, lon),
    coordDMS: `${toDMS(lat, true)}  ${toDMS(lon, false)}`,
    elevation: stats && Number.isFinite(stats.minM) ? formatElevation(stats.minM, stats.maxM, stats.meanM) : '',
    scale: extentMeters > 0 ? scaleBar(extentMeters) : '',
    name: web?.name || web?.title || '',
    country: web?.country || '',
    title: web?.title || '',
    description: web?.description || '',
    anecdote: web?.anecdote || '',
    // ⚠️ marqué : `load` sait ainsi qu'il complète, et les bancs le lisent
    provisoire: !web,
  }
}

// Assemble the ground-info payload for a location. Never throws — every source
// degrades to a sane fallback so the cartouche always has something to show.
// `stats` : le min/max/moyenne DE CE QU'ON REGARDE (dem-emprise.statsRect), ou
// null pour retomber sur les statistiques du MNT entier.
//
// ⚠️ ET L'ÉTENDUE EST CELLE DU BLOC VISIBLE, PAS DU MNT. En emprise 3×3,
// `dem.extentMeters` est TRIPLÉ (dem-emprise.js le dit en toutes lettres) : la
// barre d'échelle annonçait donc trois fois trop de kilomètres, dès le
// chargement et sans qu'aucun défilement soit nécessaire. C'est la même erreur
// d'un facteur `empriseCote` que `surfaceMetersPerUnit` avait déjà eue à
// corriger dans geo.js — le troisième endroit où elle se glisse.
export async function gatherGroundInfo({ lat, lon, dem, stats = null, fetchAnecdote = wikipediaAnecdote }) {
  const cote = dem?.empriseCote > 1 ? dem.empriseCote : 1
  const h = stats || dem
  const out = {
    coord: formatCoord(lat, lon),
    coordDMS: `${toDMS(lat, true)}  ${toDMS(lon, false)}`,
    elevation: h ? formatElevation(h.minM, h.maxM, h.meanM) : '',
    scale: dem ? scaleBar(dem.extentMeters / cote) : '',
    name: '',
    country: '',
    title: '',
    description: '',
    anecdote: '',
  }
  const key = webKey(lat, lon)
  let web = webCache.get(key)
  if (!web) {
    const [place, anecdote] = await Promise.allSettled([
      reverseGeocode(lat, lon),
      // wrap in an async call so a hook that throws *synchronously* becomes a
      // rejected settlement rather than escaping gatherGroundInfo
      (async () => fetchAnecdote({ lat, lon }))(),
    ])
    web = {
      name: place.status === 'fulfilled' ? place.value.name : '',
      country: place.status === 'fulfilled' ? place.value.country : '',
      title: anecdote.status === 'fulfilled' ? anecdote.value?.title || '' : '',
      description: anecdote.status === 'fulfilled' ? anecdote.value?.description || '' : '',
      anecdote: anecdote.status === 'fulfilled' ? anecdote.value?.anecdote || '' : '',
    }
    webCache.set(key, web)
  }
  Object.assign(out, web)
  if (!out.name) out.name = out.title || 'UNCHARTED SECTOR'
  return out
}
