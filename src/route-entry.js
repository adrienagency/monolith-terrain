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
