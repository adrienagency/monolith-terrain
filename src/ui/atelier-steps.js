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
  { id: 'zone', label: 'Zone' },
  { id: 'template', label: 'Template' },
  { id: 'palette', label: 'Palette' },
  { id: 'ciel', label: 'Ciel' },
  { id: 'calques', label: 'Calques' },
  { id: 'meteo', label: 'Météo' },
]

// ---- ⓪ la zone : le seul préalable qui en soit vraiment un ----------------
// POURQUOI cette étape existe : on peut habiller une carte qu'on n'a pas
// encore choisie, et le premier visiteur arrivait dans l'assistant devant une
// zone qui n'était pas la sienne. Habiller une carte qui n'est pas la vôtre,
// c'est perdre son temps deux fois.
//
// Le PIÈGE qu'on évite : proposer de choisir une zone à quelqu'un qui vient
// justement d'en travailler une. Reprendre sa zone est le contraire de la lui
// reprendre — d'où entryStep() : sans zone on ouvre SUR l'étape ⓪ (il faut
// bien choisir), avec zone on ouvre sur le template et l'étape ⓪ reste
// atteignable par le rail. Le chemin ne bloque toujours personne.
export const entryStep = (hasZone) => (hasZone ? indexOfStep('template') : 0)

// PIÈGE : « Custom » n'est pas un nom de zone, c'est le mot que le moteur
// écrit dans demLocation dès qu'on a volé quelque part sans nom de lieu. Le
// montrer tel quel donnerait « Ta zone : Custom », qui n'apprend rien. Les
// coordonnées, elles, disent au moins où l'on est.
export function zoneSummary(zone) {
  const n = typeof zone === 'string' ? zone : zone?.name
  if (n && n !== 'Custom') return String(n)
  const lat = Number(zone?.lat)
  const lon = Number(zone?.lon)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
  return 'Aucune zone choisie'
}

// Les calques d'HABILLAGE, dans l'ordre du panneau Carte. Ce panneau est passé
// dans le Studio avancé et est devenu inatteignable en mode simple : cette
// liste est ce qui répare ça. Volontairement SANS les courbes de niveau ni la
// grille (voir SIMPLE_EXCLUDED) — ce sont des outils de lecture, pas d'habillage.
//
// PLUS DE « Trait de côte » (Adrien, retiré partout) : le liseré venait de
// Natural Earth 1:10m, trop grossier pour tenir à côté d'un relief au mètre —
// il coupait les caps et débordait les baies. Un calque qui ment sur la
// géographie vaut moins que pas de calque du tout.
// ⚠️ À NE PAS CONFONDRE avec le MASQUE terre-mer (coast-mask.js / uCoastMask) :
// lui reste, c'est la vérité terre-mer du shader, il tient les polders sous le
// niveau zéro et sert à la découpe de zone.
//
// PLUS DE « Routes » non plus (Adrien : « très lourd, très mauvais »). Même
// raison de fond que le trait de côte : les 12,6 Mo de Natural Earth ne
// donnaient qu'un réseau grossier, et la seule version fine (tuiles Overture)
// n'a jamais couvert que les Alpes. La clé `roadsEnabled` traîne encore dans
// de vieux gabarits — elle n'est plus dans TEMPLATE_KEYS, donc simplement
// ignorée, aucune migration à écrire.
export const LAYERS = [
  { key: 'waterEnabled', label: 'Rivières & eau', short: 'Eau', hint: 'Cours d’eau, lacs et mers.' },
  { key: 'placesEnabled', label: 'Villes & lieux', short: 'Lieux', hint: 'Les noms des villes et des sites.' },
  { key: 'aerialEnabled', label: 'Photo aérienne', short: 'Photo', hint: 'L’imagerie réelle là où elle existe (France, Suisse).' },
]

// Ce que chaque étape possède EN PROPRE. L'étape ① n'y figure pas : elle ne
// possède rien, elle pose tout le reste. Deux étapes ne doivent jamais se
// partager une clé, sinon la pastille « modifié » s'allume au mauvais endroit.
export const STEP_KEYS = {
  palette: ['rampStops', 'oceanShallow', 'oceanMid', 'oceanDeep'],
  ciel: ['bgEnv', 'bgMode', 'bgStops', 'bgColorA', 'bgColorB', 'bgColorC', 'bgAngle'],
  // PLUS de 'waterFill' en plus des calques : le remplissage n'est plus un
  // réglage depuis le 2026-08-02 (Adrien : « ça doit toujours être rempli »), il
  // ne peut donc plus être « modifié » par rapport au gabarit.
  // ⚠️ Cette liste et TEMPLATE_KEYS doivent bouger ENSEMBLE — le test
  // « chaque clé des étapes 2 à 5 est portée par un template » tient la règle.
  calques: LAYERS.map((l) => l.key),
  // les chips « caractère du ciel » et « état de mer » du panneau Éléments
  // bougent PLUSIEURS clés d'un coup : elles sont toutes listées, sinon la
  // pastille « modifié » resterait éteinte après un vrai changement
  meteo: [
    'cloudsEnabled', 'cloudCoverage', 'cloudBillow', 'cloudContrast', 'cloudOpacity',
    'windDir', 'windSpeed',
    // seaEnabled AVANT les réglages de houle : c'est l'interrupteur qui décide
    // si les trois suivants produisent quoi que ce soit (cf. seaSummary).
    'seaEnabled', 'seaWaveH', 'seaChop', 'seaSpeed',
  ],
}

// Combien d'éléments une liste montre avant de proposer « voir plus ». Huit
// tient sur une hauteur de colonne sans repousser hors écran ce qui suit —
// c'est ce qui rendait « Vos templates » invisible sous la bibliothèque.
export const LIST_CAP = 8

// Une liste qui déborde ne se coupe pas en silence : elle dit combien elle
// cache. `more` est ce qui décide d'afficher le bouton — il reste faux quand
// la liste tient tout entière, sinon on offrirait de déplier zéro élément.
export function capList(items, expanded = false, cap = LIST_CAP) {
  const all = Array.isArray(items) ? items : []
  const n = Math.max(1, Math.trunc(Number(cap)) || LIST_CAP)
  if (expanded || all.length <= n) return { shown: all, hidden: 0, more: false }
  return { shown: all.slice(0, n), hidden: all.length - n, more: true }
}

// Écartés du mode simple, explicitement (Adrien) : shaders et effets, matières
// du terrain, grilles et courbes de niveau. Ils ne disparaissent pas — ils
// restent dans le mode Avancé. Cette liste sert de GARDE : un test vérifie
// qu'aucune étape ne les atteint, et qu'elles existent vraiment côté template
// (une garde qui nomme des clés fantômes ne garde rien).
export const SIMPLE_EXCLUDED = [
  // shaders & effets
  // PLUS de 'bloomEnabled' / 'bloomIntensity' : la passe de bloom a été retirée
  // le 2026-08-02, ces clés ne sont plus des clés de gabarit. ⚠️ Cette liste ne
  // doit nommer QUE des clés qui existent côté template — un test le vérifie,
  // « une garde qui nomme des clés fantômes ne garde rien ».
  'surfaceFx', 'fx', 'liquidMetal', 'ssaoEnabled', 'grain', 'vignette',
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
// La mer se débraye (Adrien) : certaines cartes sont des îles qu'on veut voir
// posées sur rien. Absente, elle ne se décrit pas par sa houle — un « mer
// d'huile » sous une mer éteinte serait un mensonge poli.
// `seaEnabled` absent vaut ALLUMÉE : tous les looks d'avant l'interrupteur
// n'ont pas la clé, et ils avaient bien une mer.
export function seaSummary(params) {
  if (params?.seaEnabled === false) return 'sans mer'
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
// ---- ce qu'« Annuler » emporte -------------------------------------------
// Une confirmation qui demande « êtes-vous sûr ? » ne dit rien : elle fait
// répéter le geste, elle n'aide pas à décider. Celle qui NOMME ce qu'on perd,
// si. D'où cette liste, comparée au look d'ARRIVÉE (pas au template) : c'est
// bien la séance entière qu'Annuler jette.
// L'étape ⓪ n'y figure jamais — la zone ne vit pas dans le look, et Annuler ne
// la remet pas en place. Dire le contraire serait promettre un retour qui
// n'aura pas lieu.
export function discardSummary(look, entry) {
  if (!look || !entry) return []
  return ATELIER_STEPS.filter((s) => STEP_KEYS[s.id] && changedKeys(s.id, look, entry).length).map((s) => s.label)
}

// « Palette, Ciel et Météo » — l'énumération française veut « et » au dernier
// cran, pas une virgule de plus.
export function frJoin(items) {
  const a = (items || []).filter(Boolean)
  if (a.length < 2) return a[0] || ''
  return `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`
}

export function stepSummary(id, params, environments = []) {
  if (id === 'palette') return paletteSummary(params)
  if (id === 'ciel') return skySummary(params, environments)
  if (id === 'calques') return layersSummary(params)
  if (id === 'meteo') return weatherSummary(params)
  return ''
}
