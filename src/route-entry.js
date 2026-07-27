// « Charger un parcours » — la décision, et RIEN d'autre.
//
// Le déclencheur est le CONTENU, jamais le contenant : un .gpx peut n'être
// qu'une poignée de repères, un gabarit .shibumap-template.json peut très bien
// embarquer une trace, un lien publié peut être une carte nue. Décider sur
// l'extension du fichier ou sur le bouton cliqué produisait six règles qui
// divergeaient ; il n'y en a qu'une, ici, et elle est pure — donc testable sans
// DOM, ce qui est tout l'intérêt (voir test/route-entry.test.js).
//
// Le niveau d'interface (Simple / Avancé) est un CHOIX de l'utilisateur : on
// l'oriente vers le bon espace DANS son niveau, on ne le change pas de niveau.

// Un parcours, c'est une LIGNE : au moins deux points géoréférencés. Un point
// seul est un repère, pas un tracé — et un GPX de <wpt> nus (les bornes d'un
// road-book, par exemple) n'est pas davantage une course.
const MIN_POINTS = 2

const isLat = (v) => Number.isFinite(v) && v >= -90 && v <= 90
const isLon = (v) => Number.isFinite(v) && v >= -180 && v <= 180

// On lit le XML à la main plutôt qu'avec DOMParser : la décision doit tourner
// dans node (tests) autant que dans le navigateur, et compter deux balises ne
// justifie pas de parser tout le document — un GPX de course fait plusieurs Mo.
const PT_TAG_RE = /<(?:trkpt|rtept)\b([^>]*)>/gi
const LAT_RE = /\blat\s*=\s*["']\s*([^"']*?)\s*["']/i
const LON_RE = /\blon\s*=\s*["']\s*([^"']*?)\s*["']/i

function gpxPointCount(text, limit = MIN_POINTS) {
  let n = 0
  PT_TAG_RE.lastIndex = 0 // regex globale partagée : sans ça, un appel reprend où le précédent s'est arrêté
  let m
  while ((m = PT_TAG_RE.exec(text))) {
    const attrs = m[1] || ''
    const la = LAT_RE.exec(attrs)
    const lo = LON_RE.exec(attrs)
    if (!la || !lo) continue
    if (!isLat(Number(la[1])) || !isLon(Number(lo[1]))) continue
    if (++n >= limit) break // on cherche un OUI/NON, pas un inventaire
  }
  return n
}

// une trace déjà analysée (GpxLayer.track, ou le bloc points d'un bundle)
function pointsCount(arr, limit = MIN_POINTS) {
  if (!Array.isArray(arr)) return 0
  let n = 0
  for (const p of arr) {
    if (!p || !isLat(Number(p.lat)) || !isLon(Number(p.lon))) continue
    if (++n >= limit) break
  }
  return n
}

const looksJson = (s) => /^\s*[[{]/.test(s)

// Les seules clés qui peuvent CONTENIR une trace. Liste explicite et courte :
// renifler « tout ce qui ressemble à gpx » ferait basculer sur n'importe quel
// gabarit, puisque le STYLE du tracé (gpxColor, gpxWidth, gpxGradient…) voyage
// dans tous les looks alors que la trace, elle, n'y est jamais.
const TRACK_KEYS = ['gpx', 'gpxText', 'sourceText']

// profondeur bornée : un .json importé n'est pas de confiance, et aucune de nos
// formes n'imbrique la trace à plus de deux niveaux (payload → race → gpx)
function scan(content, depth) {
  if (content == null || depth > 3) return false
  if (typeof content === 'string') {
    if (!content.trim()) return false
    if (looksJson(content)) {
      let parsed
      try { parsed = JSON.parse(content) } catch { parsed = null }
      // JSON illisible : ce peut rester du XML mal détecté, on retombe dessus
      if (parsed != null) return scan(parsed, depth + 1)
    }
    return gpxPointCount(content) >= MIN_POINTS
  }
  if (typeof content !== 'object' || Array.isArray(content)) return false

  for (const k of TRACK_KEYS) {
    if (typeof content[k] === 'string' && scan(content[k], depth + 1)) return true
  }
  if (pointsCount(content.points) >= MIN_POINTS) return true
  if (content.track && typeof content.track === 'object' && pointsCount(content.track.points) >= MIN_POINTS) return true
  return false
}

// --------------------------------------------------- points de passage
//
// Deuxième question posée au même contenu, et pour la même raison : les points
// de passage d'un parcours ne doivent JAMAIS survivre au chargement du suivant.
// Le bug ne se voyait qu'au DEUXIÈME chargement — on rechargeait par-dessus une
// course dont les repères étaient restés là, accrochés à la nouvelle trace.
//
// Trois réponses, et la nuance entre les deux dernières est tout l'enjeu :
//   [...]  ce parcours porte ces points-là
//   []     parcours neuf SANS point : remise à zéro
//   null   aucun parcours ici (un gabarit, une palette) : ON NE TOUCHE À RIEN
// Confondre [] et null effacerait les repères d'une course en cours à chaque
// changement de palette.

// <wpt> = un repère posé sur la carte. Même lecture à la main que PT_TAG_RE
// (voir plus haut) : la décision doit tourner dans node, et un GPX de course
// pèse plusieurs Mo. Le contenu de la balise est capturé pour y pêcher le
// <name>/<ele> ; la forme auto-fermée (<wpt ... />) n'en a pas.
const WPT_RE = /<wpt\b([^>]*?)(\/>|>([\s\S]*?)<\/wpt\s*>)/gi
const TAG_TEXT = (body, tag) => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}\\s*>`, 'i').exec(body || '')?.[1]

// forme commune aux deux provenances (un <wpt> géoréférencé, une ligne de
// projet déjà exprimée en km) : c'est resolveWaypointKm() qui les réconcilie
const wp = (o) => ({
  km: Number.isFinite(o.km) ? o.km : null,
  lat: isLat(o.lat) ? o.lat : null,
  lon: isLon(o.lon) ? o.lon : null,
  name: String(o.name ?? '').trim(),
  alt: Number.isFinite(o.alt) ? o.alt : null,
  pictos: Array.isArray(o.pictos) ? o.pictos.map(String) : [],
  cutoff: String(o.cutoff ?? ''),
})

function gpxWpts(text) {
  const out = []
  WPT_RE.lastIndex = 0 // regex globale partagée — voir gpxPointCount()
  let m
  while ((m = WPT_RE.exec(text))) {
    const attrs = m[1] || ''
    const body = m[3] || ''
    const la = LAT_RE.exec(attrs)
    const lo = LON_RE.exec(attrs)
    if (!la || !lo) continue
    const lat = Number(la[1])
    const lon = Number(lo[1])
    if (!isLat(lat) || !isLon(lon)) continue
    out.push(wp({ lat, lon, name: TAG_TEXT(body, 'name'), alt: Number(TAG_TEXT(body, 'ele')) }))
  }
  return out
}

function incomingFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return null
  if (looksJson(text)) {
    let parsed
    try { parsed = JSON.parse(text) } catch { parsed = null }
    if (parsed != null) return incomingWaypoints(parsed, 1)
  }
  // Une trace <trkpt>/<rtept> : les <wpt> qui l'accompagnent sont des repères.
  if (gpxPointCount(text) >= MIN_POINTS) return gpxWpts(text)
  // Pas de trace : parseGpx() retombe sur les <wpt> pour DESSINER la ligne (voir
  // gpx.js) — les reprendre ici doublerait chaque borne d'un road-book, une fois
  // en tracé, une fois en cartouche. C'est bien un parcours neuf : [], pas null.
  if (gpxWpts(text).length >= MIN_POINTS) return []
  return null
}

export function incomingWaypoints(content, depth = 0) {
  if (content == null || depth > 3) return null
  try {
    if (typeof content === 'string') return incomingFromText(content)
    if (typeof content !== 'object' || Array.isArray(content)) return null

    // La trace d'abord : sans elle, rien n'est arrivé — un projet à la trace
    // vide ne remet rien à zéro, exactement comme un gabarit.
    let fromTrack = null
    for (const k of TRACK_KEYS) {
      if (typeof content[k] !== 'string') continue
      const r = incomingWaypoints(content[k], depth + 1)
      if (r !== null) { fromTrack = r; break }
    }
    if (fromTrack === null && pointsCount(content.points) >= MIN_POINTS) fromTrack = []
    if (fromTrack === null) return null

    // Le projet fait foi sur le GPX qu'il embarque : l'organisateur a réglé ses
    // points dans le studio (noms, pictos, barrières horaires), la montre non.
    const own = content.race?.waypoints ?? content.waypoints
    if (Array.isArray(own) && own.length) return own.map((w) => wp(w || {}))
    return fromTrack
  } catch { return null }
}

// Un repère à 40 km de la trace n'appartient pas à ce parcours : l'accrocher au
// point le plus proche poserait un cartouche mensonger au bord du tracé. 2 km
// laisse passer un parking ou une gare volontairement décalés du chemin.
const SNAP_MAX_KM = 2

// équirectangulaire : sur 2 km l'écart à la haversine est sous le mètre, et on
// compare des distances entre elles, jamais à une mesure réelle
function km2(a, b) {
  const dx = (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * 110.57
  return dx * dx + dy * dy
}

// Résout le km de chaque point de passage contre la trace qui vient d'arriver,
// et rend la liste triée, prête pour raceState. Pure : `track` est simplement
// { points:[{lat,lon,ele}], cumKm:[] } — la forme que gpx.js construit déjà.
export function resolveWaypointKm(list, track, { maxKm = SNAP_MAX_KM } = {}) {
  if (!Array.isArray(list)) return []
  const pts = track?.points
  const cumKm = track?.cumKm
  const out = []
  for (const w of list) {
    if (Number.isFinite(w?.km)) { out.push({ ...w }); continue }
    if (!isLat(w?.lat) || !isLon(w?.lon) || !pts?.length || !cumKm?.length) continue
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = km2(w, pts[i])
      if (d < bestD) { bestD = d; best = i }
    }
    if (best < 0 || bestD > maxKm * maxKm) continue
    out.push({ ...w, km: cumKm[best] ?? 0, alt: w.alt ?? (Number.isFinite(pts[best].ele) ? pts[best].ele : null) })
  }
  return out.sort((a, b) => a.km - b.km)
}

// Ce contenu porte-t-il un parcours ? Accepte tout ce qui entre dans l'app :
// texte GPX, texte JSON, bundle .shibumap-race analysé, payload de lien publié,
// gabarit, trace déjà en mémoire. Ne lève jamais.
export function hasCourse(content) {
  try { return scan(content, 0) } catch { return false }
}

// La décision, et le seul endroit où le niveau d'interface entre en jeu.
// Retourne :
//   'workmode-parcours' — niveau avancé : le mode de travail Parcours
//   'race-studio'       — niveau simple : le Race Studio
//   null                — ce contenu ne porte pas de parcours : on ne touche à rien
// Le niveau non renseigné vaut SIMPLE : au pire on ouvre un espace guidé, alors
// que l'inverse jetterait un débutant au milieu des panneaux.
export function routeEntryFor(content, { advanced = false } = {}) {
  if (!hasCourse(content)) return null
  return advanced ? 'workmode-parcours' : 'race-studio'
}
