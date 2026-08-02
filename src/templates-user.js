// User templates — snapshot the current LOOK, save it (localStorage), export it
// to a .json file, and feed templates back in. A template captures only the
// look, never the location or camera, so applying it restyles the CURRENT view
// without flying anywhere. Each carries a thumbnail (data URL) for its card.
//
// This module is pure/DOM-free (capture, (de)serialize, localStorage). The scene
// wiring (thumbnail grab + pushing the look onto the live scene) lives in main.js.

const LS_KEY = 'shibumap-user-templates'
const FORMAT = 'shibumap-template'
const VERSION = 1

// The look whitelist — every param a template restores. Deliberately EXCLUDES
// demLat/demLon/demZoom/demLocation/source (location),
// the loaded GPX track itself (path/visibility/altitude), and per-zoom
// exaggeration, so a template never moves or reshapes the view. GPX *styling*
// (width/colour/casing/gradient/glow/…) is a look param like lakeColor and
// IS included, so a template restyles whatever track happens to be loaded.
export const TEMPLATE_KEYS = [
  // colours / ramp / oceans / theme
  'rampStops', 'oceanShallow', 'oceanMid', 'oceanDeep', 'darkMode',
  // map style — shadeAuto dit si l'Ombrage est DÉRIVÉ du relief chargé
  // (relief-grade.js) ou figé aux valeurs ci-dessous ; un look sauvé avec un
  // ombrage réglé à la main doit le retrouver tel quel au rechargement
  'shadeAuto', 'mapTint', 'heightContrast', 'heightPivot', 'slopeTint',
  // colorisation du relief (terrain-analysis.js) — absent d'un template
  // ancien ⇒ params garde ses valeurs d'usine, c'est-à-dire le mode Classique
  // et des amplitudes nulles : le rendu d'avant, à l'identique
  'colorMode', 'rampOklab', 'rampDry', 'rampWet', 'texShade', 'wetK', 'expoK',
  'treeLine', 'hazeAmt', 'hazeAlt', 'hazeDist',
  // PLUS de 'coastLine' : le liseré Natural Earth a quitté le site (trop
  // grossier). La clé traîne encore dans de vieux templates enregistrés —
  // applyUserTemplate filtre sur cette liste, elle est donc simplement ignorée,
  // aucune migration à écrire. Ne pas la confondre avec aerialCoastFade
  // (ci-dessous, photo aérienne) ni avec le masque terre-mer.
  // PLUS de 'roadsEnabled' / 'roadsOpacity' / 'roadsDetail' / 'roadColor' non
  // plus : le calque Routes a quitté le site (Adrien : « très lourd, très
  // mauvais »). Exactement le même cas que 'coastLine' ci-dessus — ces quatre
  // clés traînent dans les gabarits déjà enregistrés chez les visiteurs et dans
  // les fichiers .shibumap-template exportés avant aujourd'hui ; le filtre de
  // applyUserTemplate les laisse tomber, elles ne rallument rien et n'écrasent
  // rien. Aucune migration à écrire, aucun numéro de version à changer.
  // Ne pas confondre 'roadColor' avec les réglages GPX (gpxColor & co) : la
  // TRACE, elle, reste — c'est le RÉSEAU routier qui est parti.
  // PLUS de 'waterFill', 'placesDensity', 'placesSize' ni 'placesHalo' : ces
  // quatre réglages ont été retirés de l'interface le 2026-08-02 et leur
  // comportement est FIGÉ dans le rendu (remplissage toujours actif, densité et
  // taille au défaut, halo supprimé). Exactement le même cas que 'coastLine' et
  // 'roadsEnabled' ci-dessus : les clés traînent dans les gabarits déjà
  // enregistrés et dans les .shibumap-template exportés avant aujourd'hui, le
  // filtre de applyUserTemplate les laisse tomber, elles ne rallument rien et
  // n'écrasent rien. Aucune migration, aucun numéro de version à changer.
  'waterEnabled', 'waterOpacity', 'aerialEnabled', 'aerialOpacity', 'aerialCoastFade', 'placesEnabled',
  // animated sea (ocean-waves spectrum) — lakeColor is the shared water tint
  // seaEnabled : la mer se débraye entièrement (Adrien). Elle appartient au
  // look, donc un template peut livrer une carte SANS mer.
  'waterReal', 'waterTransparency', 'waterSunFx', 'lakeColor',
  'seaEnabled', 'seaWaveH', 'seaChop', 'seaSpeed', 'seaSeed', 'seaBed', 'seaEdge', 'seaEdgeFrost', 'seaRefract',
  // grid / contour / ink
  'contourInterval', 'contourOpacity', 'contourWeight', 'contourColor',
  'gridStep', 'gridOpacity', 'gridColor', 'hudInk', 'hudAccent', 'labels',
  // light
  // ⚠️ sunIntensity/sunElevation/sunAzimuth/hemiIntensity/envLight sont DÉRIVÉES
  // du cycle horaire : applyTimeOfDay les recalcule pour timeOfDay au lieu
  // courant, donc ce qu'un gabarit en sauve n'est qu'une trace. Ce que
  // l'utilisateur possède vraiment, ce sont les *Gain et l'appoint ci-dessous.
  // Un gabarit qui ne les porte pas est d'AVANT eux : applyUserTemplate les
  // remet au neutre plutôt que de lui refiler ceux de la session en cours.
  'sunIntensity', 'sunAzimuth', 'sunElevation', 'hemiIntensity', 'envLight',
  'shadowSoftness', 'timeOfDay', 'shadowMode',
  'sunGain', 'hemiGain', 'envGain',
  'fillIntensity', 'fillAzimuthOffset', 'fillElevation', 'fillColor',
  // les deux INTERRUPTEURS. Même règle que les gains : un gabarit qui ne les
  // porte pas est d'AVANT eux, et applyUserTemplate lui rend le neutre
  // (soleil allumé, appoint éteint) — c'est-à-dire l'image qu'il rendait hier.
  'sunEnabled', 'fillEnabled',
  // surface material scalars
  'color', 'roughness', 'roughnessVariation', 'roughnessScale', 'bumpScale', 'envMapIntensity',
  // post FX + fog
  'exposure', 'contrast', 'saturation', 'vignette', 'grain',
  // PLUS de 'bloomEnabled' / 'bloomIntensity' / 'bloomThreshold' : la passe de
  // bloom a été retirée le 2026-08-02. PLUS de 'fogNear' / 'fogFar' /
  // 'fogEnabled' non plus : la brume aussi. Même précédent que 'coastLine' —
  // les clés traînent dans les gabarits livrés (public/templates/…) et chez les
  // visiteurs, applyUserTemplate les laisse tomber, aucune migration.
  //
  // ⚠️ 'fogColor' RESTE, et ce n'est pas un oubli : c'est la teinte de la
  // FEUILLE DE FOND (scene.background, voile de transition du mode sombre), pas
  // celle de la brume. La retirer viderait le fond des treize gabarits livrés.
  'ssaoEnabled', 'ssaoIntensity', 'fogColor',
  // background (solid / gradient / HDRI sky) — bgStops/bgPoints = Fonds v2
  // (stops arbitraires + dégradé de points) ; A/B/C restent pour la compat
  'bgMode', 'bgColorA', 'bgColorB', 'bgColorC', 'bgAngle', 'bgEnv', 'bgStops', 'bgPoints', 'bgAuto',
  // camera lens / depth-of-field (NOT position/location) — shadowMode lives in
  // the light group above; listed once there, not duplicated here
  'fov', 'autoFocus', 'focusDistance', 'focusRange', 'bokehEnabled', 'bokehScale',
  // socle (block)
  'plinth', 'plinthDepth', 'plinthColor', 'plinthFinish', 'plinthPbr', 'plinthGlass',
  'plinthGlassDiffusion', 'plinthGlassProjection', 'plinthGlassBump', 'plinthGlassRefract', 'plinthBump',
  'slabCorner', 'slabCornerSmoothing', 'groundInfo',
  // relief material
  'terrainSurfaceMat', 'terrainSurfaceBump', 'terrainMatScale', 'terrainMatRoughness', 'terrainMatNoise', 'terrainMatAboveZero',
  'terrainGlassFrost', 'terrainGlassThickness', 'terrainGlassTint', 'terrainGlassClarity', 'terrainGlassReflection',
  // liquid metal
  'liquidMetal', 'lmMetalness', 'lmRoughness', 'lmReflection', 'lmSpeed',
  // surface shader
  'surfaceFx', 'fx',
  // clouds — cloudsV2 choisit le moteur (entités instanciées vs champ global),
  // windDir/windSpeed poussent le ciel (et l'orographie en phase 2)
  'windDir', 'windSpeed',
  'cloudsEnabled', 'cloudOpacity', 'cloudAltitude', 'cloudDrift', 'cloudScale', 'cloudCoverage',
  'cloudBillow', 'cloudBrightness', 'cloudAltSpread', 'cloudDriftVar', 'cloudContrast', 'cloudSSS',
  // Route (GPX) styling — not the track itself, see note above. A template
  // saved before the start/finish markers became one toggle may still carry
  // the old 'gpxStart'/'gpxEnd' keys; they're simply not in this list any
  // more so they're ignored on load (harmless) rather than breaking.
  'gpxWidth', 'gpxColor', 'gpxGradient', 'gpxGradientMode', 'gpxGlow',
  'gpxMarkers', 'gpxKm', 'gpxAltReadout', 'gpxSlopeReadout',
  // Race Studio : cartouches espace-écran + anti-chevauchement (débrayable)
  'gpxCartouches', 'gpxLabelAvoid',
  // lecture du parcours (drone-follow) — c'est du comportement de rendu, pas
  // la trace elle-même, donc ça voyage avec le look
  'gpxFollow', 'gpxFollowSpeed',
  // ---------------------------------------------------------------- OUBLIS
  // Tout ce bloc MANQUAIT alors que chaque clé pilote quelque chose de
  // visible : un look exporté puis réimporté ne rendait pas comme l'écran
  // qu'on venait de quitter (Adrien : « tous les paramètres n'étaient pas
  // pris en compte »). Les voisines immédiates de chacune étaient déjà là —
  // tous les cloud* sauf cloudTexMix, tout le style GPX sauf gpxArchColor :
  // ce sont des oublis, pas des exclusions. (hazeColor, elle, reste dehors :
  // elle est DÉRIVÉE de bgColorA et recalculée à chaque application, la
  // sauver donnerait une clé qui ne survit pas à sa propre relecture.)
  'peaksEnabled', 'cloudTexMix', 'gpxArchColor', 'transmission',
  // relief vertical + découpe à la frontière administrative : les deux
  // réglages qui changent le plus la silhouette du bloc
  'demExaggeration', 'regionMode',
  // vitesse du cycle jour/nuit (la tirette du soleil)
  'dayCycleSpeed',
  // teinte de l'interface dérivée de la palette + verre du chrome
  'uiTint', 'uiBlur', 'uiBgOpacity',
  // balayage « scan »
  'sweepSpeed', 'scanColor', 'scanDuration', 'scanWidth', 'scanBlur',
  'scanDispHeight', 'scanDispFalloff',
  // automatismes de caméra (le mouvement, PAS la pose — celle-ci vit dans le
  // bloc `view` du fichier, voir captureView plus bas)
  'camMove', 'camSpeed', 'surveyLines',
  // look de la vue orbitale
  'globeExaggeration', 'globeContourInterval', 'globeContourOpacity', 'globeGraticule',
]

// Ce qui reste DÉLIBÉRÉMENT dehors, et pourquoi :
//   source/demLat/demLon/demZoom/demLocation — la LOCALISATION. Un template
//     restyle la carte courante, il ne téléporte pas. La vue de départ de
//     l'application est posée séparément (START_VIEW dans main.js).
//   seed/scale/octaves/lacunarity/gain/amplitude/warp/detail/detailScale/
//     resolution — terrain PROCÉDURAL, sans objet sur du relief réel.
//   pixelRatio/shadowRes — réglages de PERFORMANCE, propres à la machine.
//     Les faire voyager ferait ramer un portable avec le template d'une
//     grosse machine : c'est le seul groupe qu'il serait nuisible d'ajouter.
//   gpxVisible/gpxAltitude — la trace elle-même, pas son style.
//   paused — état transitoire.
//   ringSpeed/flyDuration/flyEasing — aucune interface ne les expose, ils
//     valent donc toujours leur défaut ; les sauver n'apporterait rien.

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

// deep-copy just the look keys out of the live params
export function captureLook(params) {
  const out = {}
  for (const k of TEMPLATE_KEYS) if (k in params) out[k] = clone(params[k])
  return out
}

// ---- file (export / import) ----
// A template carries a colour STRIP (vignette) — an array of hex swatches from
// its palette — instead of a screenshot thumbnail. `shaders` flags whether it
// uses a surface shader / liquid metal, which sorts it into a category.
// ---- la POSE de caméra ----------------------------------------------------
// Le fichier ne portait AUCUNE information de caméra : un template rendait le
// même bloc sous un angle quelconque, donc jamais tout à fait l'image qu'on
// avait exportée (Adrien : « l'angle de caméra doit être pris en compte »).
//
// On ne stocke ni la position absolue ni la distance en unités monde : elles
// dépendent de la taille du bloc, qui change avec le zoom. On stocke la même
// chose que les vues iso de main.js — une DIRECTION normalisée, un facteur k
// relatif à controls.maxDistance, et la cible. Le cadrage se reproduit donc à
// l'identique sur un bloc de n'importe quelle échelle.
export function captureView(camera, controls) {
  const t = controls.target
  const dx = camera.position.x - t.x
  const dy = camera.position.y - t.y
  const dz = camera.position.z - t.z
  const len = Math.hypot(dx, dy, dz)
  if (!(len > 0) || !(controls.maxDistance > 0)) return null
  return {
    dir: [dx / len, dy / len, dz / len],
    k: len / controls.maxDistance,
    target: [t.x, t.y, t.z],
  }
}

// un .json importé n'est pas de confiance : on n'accepte que des nombres finis
const vec3 = (v) => (Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n)) ? v.map(Number) : null)
export function parseView(v) {
  if (!v || typeof v !== 'object') return null
  const dir = vec3(v.dir)
  const target = vec3(v.target)
  const k = Number(v.k)
  if (!dir || !target || !Number.isFinite(k) || k <= 0) return null
  // une direction nulle ne définit aucun angle — refus plutôt que division par 0
  if (!Math.hypot(...dir)) return null
  return { dir, k, target }
}

export function serializeTemplate(t) {
  return JSON.stringify({ format: FORMAT, version: VERSION, name: t.name, thumb: t.thumb, strip: t.strip, shaders: t.shaders, view: t.view || null, look: t.look }, null, 0)
}
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/
// only accept an image data URL for the thumbnail — an imported .json is
// untrusted and the value is used as an <img src>
const THUMB_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
export function parseTemplate(text) {
  let o
  try { o = JSON.parse(text) } catch { return null }
  if (!o || o.format !== FORMAT || !o.look || typeof o.look !== 'object') return null
  const thumb = typeof o.thumb === 'string' && THUMB_RE.test(o.thumb) ? o.thumb : null
  // re-derive strip + category from the actual look rather than trusting the
  // file's flags (a hand-edited/older export could mis-sort itself)
  const derived = stripFromLook(o.look)
  const strip = Array.isArray(o.strip) ? o.strip.filter((c) => typeof c === 'string' && HEX_RE.test(c)).slice(0, 8) : []
  return { name: String(o.name || 'Imported').slice(0, 40), thumb, strip: strip.length ? strip : derived.strip, shaders: derived.shaders, view: parseView(o.view), look: o.look }
}

// derive the vignette strip + shader category from a captured look
export function stripFromLook(look = {}) {
  const stops = Array.isArray(look.rampStops) ? look.rampStops : []
  const strip = stops.map((s) => s && s.c).filter((c) => typeof c === 'string' && HEX_RE.test(c))
  const shaders = !!((look.surfaceFx | 0) > 0 || look.liquidMetal || (look.terrainSurfaceMat && look.terrainSurfaceMat !== ''))
  return { strip: strip.length ? strip : ['#cbd5e1'], shaders }
}

// ---- localStorage list ----
export function loadUserTemplates() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(arr) ? arr.filter((t) => t && t.look) : []
  } catch { return [] }
}
// returns false if storage is full (thumbnails are data URLs and add up) so the
// caller can tell the user instead of silently losing the save
export function saveUserTemplates(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true } catch { return false }
}
