// Le cheminement du Studio SIMPLE — la logique pure de l'assistant
// « Habiller ma carte » (atelier.js pose le DOM, ce module dit quoi).
//
// POURQUOI un module à part : l'enchaînement, ce qu'une étape possède, ce qui
// est écarté du mode simple et ce qu'une étape a « posé » sont des règles, pas
// du dessin. Elles se testent sans DOM et elles doivent rester vraies quand la
// colonne sera redessinée.
//
// LE POINT QUI DÉCIDE DE TOUT : un template porte le look COMPLET (voir
// TEMPLATE_KEYS) — palette, ciel, calques ET météo. L'étape ① ne précède donc
// pas les autres, elle les PRÉ-REMPLIT. C'est pour ça que chaque étape aval
// s'ouvre sur ce que le template a posé et se lit « affiner » : sans ça, les
// étapes ② à ⑤ défont l'étape ① et l'assistant n'est plus un cheminement.
// Le test `chaque clé des étapes 2 à 5 est portée par un template` verrouille
// cette propriété — si quelqu'un ajoute un réglage hors template, il tombe.

export const ATELIER_STEPS = [
  { id: 'template', label: 'Template' },
  { id: 'palette', label: 'Palette' },
  { id: 'ciel', label: 'Ciel' },
  { id: 'calques', label: 'Calques' },
  { id: 'meteo', label: 'Météo' },
]

// Les calques d'HABILLAGE, dans l'ordre du panneau Carte. Ce panneau est passé
// dans le Studio avancé et est devenu inatteignable en mode simple : cette
// liste est ce qui répare ça. Volontairement SANS les courbes de niveau ni la
// grille (voir SIMPLE_EXCLUDED) — ce sont des outils de lecture, pas d'habillage.
export const LAYERS = [
  { key: 'roadsEnabled', label: 'Routes', short: 'Routes', hint: 'Le réseau routier drapé sur le relief.' },
  { key: 'waterEnabled', label: 'Rivières & eau', short: 'Eau', hint: 'Cours d’eau, lacs et mers.' },
  { key: 'placesEnabled', label: 'Villes & lieux', short: 'Lieux', hint: 'Les noms des villes et des sites.' },
  { key: 'coastLine', label: 'Trait de côte', short: 'Côtes', hint: 'Le liseré qui souligne le rivage.' },
  { key: 'aerialEnabled', label: 'Photo aérienne', short: 'Photo', hint: 'L’imagerie réelle là où elle existe (France, Suisse).' },
]

// Ce que chaque étape possède EN PROPRE. L'étape ① n'y figure pas : elle ne
// possède rien, elle pose tout le reste. Deux étapes ne doivent jamais se
// partager une clé, sinon la pastille « modifié » s'allume au mauvais endroit.
export const STEP_KEYS = {
  palette: ['rampStops', 'oceanShallow', 'oceanMid', 'oceanDeep'],
  ciel: ['bgEnv', 'bgMode', 'bgStops', 'bgColorA', 'bgColorB', 'bgColorC', 'bgAngle'],
  calques: LAYERS.map((l) => l.key).concat('waterFill'),
  // les chips « caractère du ciel » et « état de mer » du panneau Éléments
  // bougent PLUSIEURS clés d'un coup : elles sont toutes listées, sinon la
  // pastille « modifié » resterait éteinte après un vrai changement
  meteo: [
    'cloudsEnabled', 'cloudCoverage', 'cloudBillow', 'cloudContrast', 'cloudOpacity',
    'windDir', 'windSpeed',
    'seaWaveH', 'seaChop', 'seaSpeed',
  ],
}

// Écartés du mode simple, explicitement (Adrien) : shaders et effets, matières
// du terrain, grilles et courbes de niveau. Ils ne disparaissent pas — ils
// restent dans le mode Avancé. Cette liste sert de GARDE : un test vérifie
// qu'aucune étape ne les atteint, et qu'elles existent vraiment côté template
// (une garde qui nomme des clés fantômes ne garde rien).
export const SIMPLE_EXCLUDED = [
  // shaders & effets
  'surfaceFx', 'fx', 'liquidMetal', 'bloomEnabled', 'bloomIntensity', 'ssaoEnabled', 'grain', 'vignette',
  // matières du terrain et du socle
  'terrainSurfaceMat', 'terrainMatScale', 'terrainMatRoughness', 'plinthFinish', 'plinthPbr',
  // grilles et courbes de niveau
  'gridStep', 'gridOpacity', 'gridColor', 'contourInterval', 'contourOpacity', 'contourWeight', 'contourColor',
]

export const clampStep = (i) => {
  const n = Math.trunc(Number(i))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(ATELIER_STEPS.length - 1, n))
}

export const indexOfStep = (id) => ATELIER_STEPS.findIndex((s) => s.id === id)

// Toutes les clés atteignables depuis les étapes ② à ⑤ — le domaine du mode
// simple, en une seule liste.
export const downstreamKeys = () => Object.values(STEP_KEYS).flat()

// Comparaison par VALEUR : rampStops et bgStops sont des tableaux d'objets
// recréés à chaque application, une égalité par référence marquerait « modifié »
// sans que rien n'ait bougé.
const same = (a, b) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// Ce qu'une étape a changé DEPUIS le template posé à l'étape ①. Sans référence
// (personne n'a encore choisi de template), rien n'est « modifié » : on ne peut
// pas affiner par rapport à rien.
export function changedKeys(step, look, base) {
  if (!base || !look) return []
  return (STEP_KEYS[step] || []).filter((k) => !same(look[k], base[k]))
}
export const isStepTouched = (step, look, base) => changedKeys(step, look, base).length > 0

// ---- résumés : ce qu'une étape a posé, lisible sans l'ouvrir ---------------

export function paletteSummary(params) {
  const n = Array.isArray(params?.rampStops) ? params.rampStops.length : 0
  if (!n) return 'Palette par défaut'
  return `${n} teinte${n > 1 ? 's' : ''}`
}

// Un ciel absent et un ciel dont le fichier a disparu se disent pareil : ce que
// l'utilisateur voit, c'est un fond uni dans les deux cas.
export function skySummary(params, environments = []) {
  const id = params?.bgEnv || ''
  const env = id ? environments.find((e) => e.id === id) : null
  return env ? env.label : 'Aucun ciel'
}

export function layersSummary(params) {
  const on = LAYERS.filter((l) => params?.[l.key]).map((l) => l.short)
  return on.length ? on.join(' · ') : 'Aucun calque'
}

// Le vent ne se voit QUE sur les nuages (il pousse le ciel) : sans nuages, on
// le dit « sans vent » plutôt que d'afficher une force qui ne produit rien.
// windDir = 0 pointe vers l'est, et le tableau tourne dans le sens des angles.
const CARDINAL = ['l’est', 'le nord-est', 'le nord', 'le nord-ouest', 'l’ouest', 'le sud-ouest', 'le sud', 'le sud-est']
export function windSummary(params) {
  if (!params?.cloudsEnabled) return 'sans vent'
  const s = Number(params.windSpeed) || 0
  if (s < 0.05) return 'air calme'
  const force = s < 0.5 ? 'brise' : s < 1.4 ? 'vent soutenu' : 'grand vent'
  const deg = ((Math.round((Number(params.windDir) || 0) / 45) % 8) + 8) % 8
  return `${force} vers ${CARDINAL[deg]}`
}

// Seuils repris des chips d'état de mer du panneau Éléments (Calme / Brise /
// Agitée). C'est une DESCRIPTION de l'état courant, pas le nom d'un preset :
// une houle réglée à la main doit quand même se raconter.
export function seaSummary(params) {
  const h = Number(params?.seaWaveH) || 0
  if (h < 0.5) return 'mer d’huile'
  if (h < 1.2) return 'petites vagues'
  return 'mer formée'
}

export function weatherSummary(params) {
  const sky = params?.cloudsEnabled ? 'Nuages' : 'Ciel dégagé'
  return `${sky} · ${windSummary(params)} · ${seaSummary(params)}`
}

// L'étape ① reste muette : son résumé, c'est la vignette du template choisi,
// pas une phrase — et un « 8 teintes » sous « Template » laisserait croire
// qu'elle ne pose que ça.
export function stepSummary(id, params, environments = []) {
  if (id === 'palette') return paletteSummary(params)
  if (id === 'ciel') return skySummary(params, environments)
  if (id === 'calques') return layersSummary(params)
  if (id === 'meteo') return weatherSummary(params)
  return ''
}
