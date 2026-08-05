// GPX layer: drop a .gpx file anywhere (or use the GUI) — the map recenters
// on the track, drapes it over the relief as a fat accent-colored line, and
// gives it instruments: a hover cursor with real altitude / distance / grade,
// an interactive elevation-profile strip, and a cinematic fly-along that
// reuses the tour flight controller.

import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { construitRuban, teintesDepuis, fractionDeTraine, TEINTES_COURSE, largeurRuban, RUBAN_DEMI_LARGEUR_BASE } from './ruban-trace.js'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld, metersPerPixel, surfaceMetersPerUnit, demSpan, EARTH_RADIUS_M } from './geo.js'
import { dansFenetre } from './fenetre-clip.js'
import { loadLayerForBounds, patchBounds } from './map/geo-data.js'
import { makeLabelTexture, labelPlate, labelPlateInk, labelFontReady } from './map/text-label.js'
import { computeArchSpecs, buildArchMesh, disposeArchGroup } from './arch.js'
import { animationsActives } from './animations.js'
import { survolVientDeLaSouris } from './clic-ruban.js'

const MAX_POINTS = 2400 // decimation budget — hover & profile stay O(small)

export function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('not a valid GPX file')
  let nodes = [...doc.querySelectorAll('trkpt')]
  if (!nodes.length) nodes = [...doc.querySelectorAll('rtept')]
  if (!nodes.length) nodes = [...doc.querySelectorAll('wpt')]
  if (nodes.length < 2) throw new Error('no track points found')

  const stride = Math.max(1, Math.ceil(nodes.length / MAX_POINTS))
  const points = []
  for (let i = 0; i < nodes.length; i += stride) {
    const n = nodes[i]
    const lat = parseFloat(n.getAttribute('lat'))
    const lon = parseFloat(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleN = n.querySelector('ele')
    // ⚠️ L'HEURE DU POINT ÉTAIT JETÉE, ET AVEC ELLE LA SEULE DONNÉE TEMPORELLE
    // QUE LE MODÈLE POUVAIT AVOIR. Un <trkpt> sorti d'une montre ou d'un export
    // de course porte presque toujours un <time> ; on lisait lat/lon/ele et on
    // laissait celui-là au parseur. Résultat : le carnet de course déclarait
    // dans ses commentaires qu'aucune durée n'était calculable — vrai de ce que
    // le modèle CONTENAIT, faux de ce qu'il pouvait contenir.
    // Ce qu'on en tire est une SOUSTRACTION, pas une prédiction : le temps que
    // la trace enregistrée a mis d'ici à l'arrivée (voir dureeRestante() dans
    // carnet-course.js). Un parcours dessiné à la main n'a pas de <time> : la
    // valeur reste null et tout l'aval retombe sur le tiret cadratin.
    const tN = n.querySelector('time')
    const t = tN ? Date.parse(tN.textContent) : NaN
    points.push({ lat, lon, ele: eleN ? parseFloat(eleN.textContent) : null, t: Number.isFinite(t) ? t : null })
  }
  if (points.length < 2) throw new Error('no usable track points')
  const name = doc.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim()
  return { points, name: name || 'TRACK' }
}

// Pick center + zoom so a whole track fits comfortably in the DEM patch.
// Pure — exported for tests.
export function frameTrack(points) {
  // unwrap longitudes relative to the first point so a track crossing the
  // antimeridian stays contiguous instead of spanning the whole planet
  const lon0 = points[0].lon
  let latMin = 90, latMax = -90, lonMin = Infinity, lonMax = -Infinity
  for (const p of points) {
    const pLon = lon0 + (((p.lon - lon0 + 540) % 360) - 180)
    latMin = Math.min(latMin, p.lat)
    latMax = Math.max(latMax, p.lat)
    lonMin = Math.min(lonMin, pLon)
    lonMax = Math.max(lonMax, pLon)
  }
  const lat = (latMin + latMax) / 2
  let lon = (lonMin + lonMax) / 2
  if (lon > 180) lon -= 360
  else if (lon < -180) lon += 360
  const widthM = Math.max(
    (lonMax - lonMin) * 111320 * Math.cos((lat * Math.PI) / 180),
    (latMax - latMin) * 110540,
    800
  )
  let zoom = 14
  // 768 = l'ÉTENDUE AU SOL d'un patch de 3 tuiles dans la convention « pixel de
  // tuile 256 » — invariante quand la source sert du 512 px (même emprise)
  while (zoom > 10 && metersPerPixel(lat, zoom) * 768 < widthM * 1.35) zoom--
  return { lat, lon, zoom }
}

// ---------------------------------------------------------------- colour ramps

// dark green -> bright red, used for the elevation ramp (the default gradient
// mode). Hue sweeps green -> amber -> orange -> red (0.33 -> 0.0) so the
// transition reads naturally; saturation and lightness both rise with it too
// — a hue-only sweep at constant tone doesn't land as "foncé" (dark) at the
// low end or "vif" (vivid/bright) at the high end, only a colour-only shift.
function elevationRampColor(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  const hue = THREE.MathUtils.lerp(0.33, 0.0, c)
  const sat = THREE.MathUtils.lerp(0.65, 0.9, c)
  const light = THREE.MathUtils.lerp(0.25, 0.55, c)
  return new THREE.Color().setHSL(hue, sat, light)
}

// six-stop grade ramp: blue (flat) -> green -> yellow -> orange -> red ->
// black (max), per the user's exact spec ("pente faible bleu > vert >
// jaune > orange > rouge > noir"). This REPLACES a 2-segment HSL hue sweep
// (green->amber->red) that was abandoned outright, not just re-tuned: a
// hue-only lerp can never reach black (black has no hue — it's zero
// lightness), and blue->green->yellow->orange->red is not a monotonic hue
// path either (blue sits at hue ~0.6, red wraps back near hue ~0.0/1.0 —
// naively lerping hue between arbitrary stops crosses through purple/magenta
// instead of the intended sequence). So this uses explicit RGB colour stops
// and lerps between the bracketing pair with THREE.Color.lerpColors, which
// interpolates in RGB space and has no wraparound to get wrong.
const SLOPE_STOPS = [
  new THREE.Color('#1e78e0'), // blue   — flat
  new THREE.Color('#2fb350'), // green
  new THREE.Color('#f4d30a'), // yellow
  new THREE.Color('#ff8c1a'), // orange
  new THREE.Color('#e3342f'), // red
  new THREE.Color('#141414'), // black  — max
]
// Grade domain, chosen from the two real fixtures (see the task report for
// the full measured distribution), not guessed:
//  - _staging/test-track.gpx (Jura gravel/road, 222km, D+4000): abs grade
//    p50 2.5%, p90 8.0%, p95 10.2%, p99 15.9%, max 33%.
//  - _staging/europaweg.gpx (Valais alpine trail, 39km, 1316->2350m,
//    D+2880): abs grade p50 10.7%, p90 37.8%, max 104% (GPS-noisy switchback
//    sections, not literal — a hiking trail's point-to-point grade spikes
//    hard on tight hairpins).
// A real road climb like the reference's Côte de Domancy averages 9.4%.
// 0-20%, in even 4-point steps, puts that squarely in the yellow/orange
// middle of the ramp (the brief's own bar: a climb must not pin one end)
// while still giving the Jura fixture a full spread (its p95 lands in
// orange, only its rare >20% kickers reach black) and letting the alpine
// trail legitimately run hot — a route that's genuinely often above 20%
// SHOULD read red/black, that's the point of colouring by what the athlete
// feels instead of by altitude.
const SLOPE_DOMAIN_MAX = 20
// exported so test/gpx.test.js can pin the ramp's actual colours/domain —
// same rationale as HM_APEX_V/HEAD_MARKER_GROUND_GAP above: a pure function,
// no DOM required, worth locking down directly rather than only indirectly
// through _trackColors.
export function slopeRampColor(gradePct) {
  const g = THREE.MathUtils.clamp(Math.abs(gradePct), 0, SLOPE_DOMAIN_MAX)
  const f = (g / SLOPE_DOMAIN_MAX) * (SLOPE_STOPS.length - 1)
  const i = Math.min(Math.floor(f), SLOPE_STOPS.length - 2)
  const out = new THREE.Color()
  return out.lerpColors(SLOPE_STOPS[i], SLOPE_STOPS[i + 1], f - i)
}

// pleasant hue sweep along the track's index (start -> end)
function progressRampColor(t) {
  const hue = (0.58 + THREE.MathUtils.lerp(0, 0.72, THREE.MathUtils.clamp(t, 0, 1))) % 1
  return new THREE.Color().setHSL(hue, 0.72, 0.55)
}

// plain-object 3D distance (not THREE.Vector3.distanceTo) so detectLoop stays
// usable from a unit test with bare {x,y,z} points, no THREE instance needed.
function dist3(a, b) {
  const dx = a.x - b.x
  const dy = (a.y ?? 0) - (b.y ?? 0)
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Is this drawn (world-space) track a loop? Same tolerance rule rebuild() has
// always used (see its own comment, preserved verbatim below) — extracted so
// arch.js (task 22 §6: one arch on a loop, two on a point-to-point route) and
// the GpxLayerManager can both reuse the EXACT same answer rebuild() draws
// from, instead of a second, driftable copy of this math.
//
// Loop detection: compare the first/last track points in WORLD units (not
// lat/lon — this is what's actually drawn) against a tolerance relative to
// the track's own drawn length, not a fixed distance. A fixed meter
// threshold would false-match a tiny out-and-back track or miss an obvious
// loop on a huge one. A closed loop rarely re-samples the exact same GPS fix
// as the start, so this must not be an exact equality check either — 1.5% of
// the total drawn length, floored at 1 world unit (roughly one GPS sample's
// worth of jitter at this scale), is generous enough to catch a real loop's
// closing gap without mistaking two merely-nearby points for the same place.
export function detectLoop(world) {
  if (!world || world.length < 2) return false
  let worldLen = 0
  for (let i = 1; i < world.length; i++) worldLen += dist3(world[i], world[i - 1])
  const loopTol = Math.max(1, worldLen * 0.015)
  return dist3(world[0], world[world.length - 1]) <= loopTol
}

// haversine meters
function distM(a, b) {
  const R = EARTH_RADIUS_M
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// ---------------------------------------------------------------- reveal head

// ⚠️ L'ABSCISSE CURVILIGNE EST LA SEULE RÉFÉRENCE, ET C'EST TOUT LE SUJET.
//
// L'ancienne version rendait `round(t × nbSegments)` : `t` y était une
// fraction d'INDEX DE SOMMET. Or tout le reste de l'affichage se gradue en
// DISTANCE PARCOURUE — le profil place ses abscisses en `cumKm[i]/totKm`
// (voir _drawProfile), le carnet compte des kilomètres, et le ruban se
// dévoile sur sa distance cumulée normalisée. Ces deux mesures ne coïncident
// que si les points du GPX sont régulièrement espacés, ce qu'ils ne sont
// jamais : un relevé est dense en lacets et très étiré en ligne droite. À
// 50 % d'index on pouvait donc être à 35 % de la distance — la tête, les
// chiffres et le profil partaient chacun de leur côté.
//
// Ici, `t` est une fraction de DISTANCE. On cherche dans quel intervalle de
// `cumKm` elle tombe, et on rend l'index réel correspondant. Le ruban lit le
// même `t` directement dans son shader : les deux ne peuvent plus diverger.
export function indexALAbscisse(t, cumKm) {
  const n = cumKm?.length ?? 0
  if (n < 2) return 0
  const total = cumKm[n - 1]
  if (!(total > 0)) return 0
  const cible = THREE.MathUtils.clamp(t, 0, 1) * total
  // recherche dichotomique : appelée à chaque image, sur des tracés de
  // plusieurs milliers de points
  let bas = 0
  let haut = n - 1
  while (bas < haut) {
    const mid = (bas + haut) >> 1
    if (cumKm[mid] < cible) bas = mid + 1
    else haut = mid
  }
  // on rend le sommet le PLUS PROCHE en distance, pas le suivant : un demi-
  // intervalle d'erreur systématique se verrait sur le réticule du profil
  if (bas > 0 && cible - cumKm[bas - 1] < cumKm[bas] - cible) bas--
  return bas
}

// padding horizontal du profil quand il n'est PAS embarqué (panneau HUD
// flottant) — même valeur que le `pad` local de _drawProfile, nommée ici
// pour n'exister qu'à UN endroit : c'est ELLE qui définit X(i), et c'est
// fractionAuClic() ci-dessous qui doit en rendre l'exacte réciproque.
export const PROFILE_PAD_X = 8

// L'INVERSE EXACT DE X(i) DANS _drawProfile — même piège qu'indexALAbscisse
// ci-dessus, à un cran plus bas : X(i) place l'abscisse i à
// `padX + (cumKm[i]/totKm) * (largeur - 2*padX)`. Cliquer à `x` doit donc
// rendre la MÊME fraction de distance que celle qui a servi à dessiner ce
// point-là, pas une fraction de pixels bruts — sans quoi le padding (nul
// embarqué, 8 px en HUD flottant) décale systématiquement le point cliqué.
// Le résultat se pose tel quel dans `headT` : c'est déjà une fraction
// d'abscisse curviligne, aucune conversion d'index ne s'intercale ici.
export function fractionAuClic(x, largeur, padX) {
  const utile = largeur - padX * 2
  if (!(utile > 0)) return 0
  return THREE.MathUtils.clamp((x - padX) / utile, 0, 1)
}

// GARDE DE L'ÉTAT DE SURVOL DU PROFIL (task 12), EXTRAITE EN FONCTION PURE —
// même esprit que peutSurvolerLeTrace ci-dessous : un `pointerleave` doit
// EFFACER le repère, pas le laisser figé sur la dernière position connue.
// Volontairement triviale (elle ne fait QUE filtrer les valeurs non finies) :
// c'est la fraction elle-même — celle de fractionAuClic, PAS un index de
// sommet — qui doit alimenter le trait, pour qu'il suive le pixel exact du
// curseur plutôt que de s'aimanter au sommet le plus proche comme le fait le
// réticule de lecture (hoverIdx, plus haut dans ce fichier).
export function repereDeSurvol(fraction) {
  return typeof fraction === 'number' && Number.isFinite(fraction) ? THREE.MathUtils.clamp(fraction, 0, 1) : null
}

// GARDE DE pointerMove(), EXTRAITE EN FONCTION PURE (task 9, relecture) —
// un calque est survolable s'il porte des sommets ET si son groupe (le
// toggle « afficher le tracé ») est visible. `group.visible`, PAS
// `line.visible` : ce dernier reste vrai calque masqué, ce qui gardait
// jadis l'infobulle DOM vivante sur un tracé invisible.
//
// ⚠️ ELLE NE PREND VOLONTAIREMENT AUCUN PARAMÈTRE « line ». La garde en ligne
// qu'elle remplace exigeait `this.line` — construit UNIQUEMENT quand Line2
// remplace le ruban (mode dégradé de pente), jamais sous le rendu PAR DÉFAUT
// (ruban). Sous ce rendu par défaut, `this.line` valait toujours `null` et
// la garde sortait à chaque appel : le survol 3D du tracé — et tout ce qui
// en dépend, y compris le clic-pour-reprendre de cette tâche — ne
// s'exécutait JAMAIS. Rien ne le testait, donc rien ne l'a vu pendant des
// semaines de ce plan. Extraite ici et testée seule (sans DOM ni caméra
// THREE), un futur remaniement qui réintroduirait une dépendance au rendu
// Line2 fera rougir CE test avant d'atteindre le navigateur.
export function peutSurvolerLeTrace(track, groupVisible) {
  return !!track?.world && !!groupVisible
}

// GARDE STRUCTURELLE DE L'ÉCOUTEUR pointermove GLOBAL (task 13) — extraite en
// fonction PURE, même esprit que peutSurvolerLeTrace ci-dessus.
//
// POURQUOI CET ÉCOUTEUR GLOBAL EXISTE. `main.js` pose un `pointermove` sur
// `window`, pas sur le canevas 3D lui-même : il doit connaître la position de
// la souris même quand elle n'est PAS au-dessus du rendu (pour l'autofocus du
// bokeh, entre autres), et un écouteur sur `window` reçoit tous les
// mouvements où qu'ils tombent.
//
// POURQUOI IL ÉTAIT INOFFENSIF JUSQU'ICI. Le picking 3D qu'il déclenche
// (GpxLayer.pointerMove) passait par une garde qui exigeait `this.line` —
// l'ancienne Line2, jamais construite sous le ruban, le rendu PAR DÉFAUT.
// Cette garde sortait donc TOUJOURS avant le raycast, quel que soit
// l'endroit d'où venait l'événement : DOM ou canevas, aucune différence.
//
// CE QUI L'A RÉVEILLÉ. La task 9 a — à raison — remplacé cette garde par
// `peutSurvolerLeTrace`, qui ne regarde plus `this.line` et laisse donc le
// raycast s'exécuter sous le rendu par défaut. Un mouvement de souris au-
// dessus du profil (un `<canvas>` DOM, empilé par-dessus le rendu WebGL,
// PAS dedans) bulle jusqu'à `window` et relance ce raycast : il ne touche
// rien (la souris n'est pas sur le tracé en 3D) et écrase hoverIdx à -1
// DANS LE MÊME TICK que le survol légitime du profil (task 12), avant tout
// repaint — d'où le réticule et le carnet qui ne s'affichaient plus jamais
// hors lecture.
//
// LA RÈGLE, ET POURQUOI ELLE NE LISTE AUCUN PANNEAU. La correction évidente
// — ignorer les événements venant « du profil » — se ferait mal en testant
// une classe CSS ou une liste de sélecteurs : il existe au moins trois
// profils (barre de course, HUD flottant, panneau Parcours), et un autre
// viendra un jour. La question posée ici est structurelle et vaut pour
// n'importe quelle surface DOM empilée au-dessus du rendu, présente ou
// future : l'événement vise-t-il le canevas 3D LUI-MÊME, ou autre chose ?
export function viseLeCanevas3D(cible, canevas3D) {
  return cible === canevas3D
}

// One step of critically-damped exponential follow of the marker's OWN
// transform toward the true reveal-head vertex (mutates + returns `disp`).
// This is the "smoothing in TIME, not space" fix: the target itself is
// always the exact real vertex above (never a different, smoother curve) —
// any visual softness comes from how the marker's displayed position chases
// that target frame to frame, exactly like DroneCam's own posHalfLife
// critical-damping. `valid` false means "no prior position to ease from"
// (a fresh track / a restarted play()) — snap instead of easing in from a
// stale spot.
export function stepHeadFollow(disp, target, lambda, dt, valid) {
  if (!valid) {
    disp.copy(target)
  } else {
    disp.x = THREE.MathUtils.damp(disp.x, target.x, lambda, dt)
    disp.y = THREE.MathUtils.damp(disp.y, target.y, lambda, dt)
    disp.z = THREE.MathUtils.damp(disp.z, target.z, lambda, dt)
  }
  return disp
}

// lambda for stepHeadFollow — half-life ~1/14 s (THREE.MathUtils.damp's decay
// constant, not a literal half-life, but in that ballpark): fast enough that
// the displayed marker stays within a small fraction of a track-vertex
// spacing of the true head at any normal playback speed (measured — see the
// task-16 report), while still smoothing away the frame-to-frame speed/
// direction judder of uneven GPS vertex spacing.
const HEAD_FOLLOW_LAMBDA = 14

// ---------------------------------------------------------------- km labels

// A track-length-adaptive km-label interval, snapped to a human ladder
// (never "every 7km") — targets a roughly constant LABEL COUNT across track
// lengths instead of a constant spacing, so a 5km loop gets one or two
// discreet labels instead of none, and an 80km epic gets ~5 instead of 8
// crowding the line. See buildRoutePanel/rebuild()'s "km markers" section.
const KM_LADDER = [1, 2, 5, 10, 20, 50, 100]
const TARGET_KM_LABELS = 5
export function pickKmInterval(totalKm) {
  if (!(totalKm > 0)) return KM_LADDER[0]
  const raw = totalKm / TARGET_KM_LABELS
  let best = KM_LADDER[0]
  let bestDiff = Infinity
  for (const step of KM_LADDER) {
    const diff = Math.abs(step - raw)
    if (diff < bestDiff) {
      bestDiff = diff
      best = step
    }
  }
  return best
}

// Texte de la barre-titre du profil (bandeau du bas). Le nom du calque prime
// sur le <name> du GPX : un fichier exporté par une montre ou un traceur
// s'appelle « idee itinerante. 2026-23216768 », l'organisateur, lui, a
// nommé sa course. La coupe à 28 signes est la largeur tenable de la barre
// (monospace) — au-delà le titre pousse les stats hors du cartouche.
export function profileTitle(displayName, trackName) {
  return (displayName || trackName || 'TRACK').toUpperCase().slice(0, 28)
}

// ---------------------------------------------------------------- villages

// Along-track village "announcements" (task 16 §3): pick real places (rows
// from loadLayer('places'), each [name, lat, lon, pop, capital, minZoom] per
// geo-data.js) that sit within `radiusWorld` of some point on the track and
// have pop > minPop. `toWorld(lat, lon)` is injected (not `dem` directly) so
// this stays pure/testable, mirroring place-pick.js's pickPlaces() — same
// idea, different selection geometry (along-track nearest-point vs viewport
// bbox). Rows arrive prominence-sorted (population descending, per
// pickPlaces' own comment); a greedy minKmSpacing pass (same shape as
// pickPlaces' minDist) keeps two closely-spaced named places from both
// firing almost simultaneously, favouring the more prominent one.
export function pickVillagesAlongTrack(rows, { toWorld, world, cumKm, minPop = 5000, radiusWorld = 5, minKmSpacing = 0.3 } = {}) {
  const candidates = []
  for (const row of rows) {
    const [name, lat, lon, pop] = row
    if (!(pop > minPop)) continue
    const w = toWorld(lat, lon)
    let bestI = -1
    let bestD = Infinity
    for (let i = 0; i < world.length; i++) {
      const dx = world[i].x - w.x
      const dz = world[i].z - w.z
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestD = d
        bestI = i
      }
    }
    if (bestD > radiusWorld * radiusWorld || bestI < 0) continue
    candidates.push({ name, pop, idx: bestI, km: cumKm[bestI], w })
  }
  const hits = []
  for (const c of candidates) {
    if (hits.some((h) => Math.abs(h.km - c.km) < minKmSpacing)) continue
    hits.push(c)
  }
  hits.sort((a, b) => a.km - b.km)
  return hits
}

// Lead distance (km) a village announcement appears BEFORE the head reaches
// it — proportional to track length (a long track covers ground "faster" in
// km per unit of the journey, so it earns a longer heads-up), clamped to a
// sensible 100m..1.2km band so a short local loop still gets a real lead and
// a huge multi-day route doesn't announce absurdly early.
export function villageLeadKm(totalKm) {
  return THREE.MathUtils.clamp(totalKm * 0.02, 0.1, 1.2)
}

// Opacity of a village announcement at the head's current km: ramps 0->1
// over the lead-in (reaching full opacity exactly as the head arrives), then
// eases back out over `fadeKm` after passing — long enough that the name is
// still readable for a beat once the head is abreast of it, not gone the
// instant it arrives.
export function villageOpacity(km, hitKm, leadKm, fadeKm) {
  if (km < hitKm - leadKm) return 0
  if (km < hitKm) return (km - (hitKm - leadKm)) / leadKm
  if (km < hitKm + fadeKm) return 1 - (km - hitKm) / fadeKm
  return 0
}

// Screen-space label size for scale=1, in CLIP units (sizeAttenuation:false) —
// the EXACT same sizing trap as PlacesLayer.BASE_H (see places-layer.js's big
// comment above its own BASE_H): a sprite's real on-screen size is
// projectionMatrix[0/5]*scale, NOT scale/2*viewport — at this app's 30° fov
// that's a ~3.7x factor. Previously this sprite had no sizeAttenuation set at
// all (Three's default `true`), so it was sized in actual WORLD units (6.8
// world units wide) and only shrank with perspective distance — with the
// camera close to the route that's what made "START & FINISH · 25" span ~40%
// of the screen. Tuned so the label reads at the same visual size as a city
// name (places-layer.js labels land ~7.5–14px cap-height, measured live) —
// see the task-13 report for the exact px this produced.
const GPX_LABEL_BASE_H = 0.0128
const GPX_LABEL_ASPECT = 512 / 80

function textSprite(text, color, scale = 1, opacity = 1, renderOrder = 20) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 80
  const ctx = c.getContext('2d')
  ctx.font = '600 44px "SF Mono", ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.fillText(text, 256, 44)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity })
  )
  sp.material.sizeAttenuation = false
  sp.scale.set(GPX_LABEL_BASE_H * scale * GPX_LABEL_ASPECT, GPX_LABEL_BASE_H * scale, 1)
  sp.renderOrder = renderOrder
  return sp
}
// How far the drawn track floats above the terrain it's draped on, in WORLD
// units. This used to be 0.16 and it read as a visible hover — the track
// hanging in the air over ridgelines instead of lying on them.
//
// The trap: a world unit is NOT a fixed real-world distance. The block is
// always TERRAIN_SIZE (56) units wide whatever it REPRESENTS, so the same
// 0.16 measured, live on a real track:
//     demZoom 13 (13 km patch) ->  37 m of float
//     demZoom 11 (19 km patch) ->  54 m   <- what the user photographed
//     demZoom 10 (91 km patch) -> 260 m
//     demZoom  8 (360 km patch) -> 1029 m
// A constant lift cannot be right at every scale, so it shouldn't be doing
// this job at all. The lift existed only to stop the line z-fighting the
// terrain surface; polygonOffset on the line materials (see LineMaterial
// below, and the water layer, which already solved this properly) does that
// in depth-buffer space instead — screen-constant, scale-independent, and it
// leaves the geometry ON the ground. What remains here is a hair of physical
// clearance for the head marker and hover cursor to sit against.
const DRAPE_LIFT = 0.012
// Le ruban (voir ruban-trace.js). Le PAS est ce qui l'empêche de traverser le
// relief : 0,07 unité, soit plus fin que la maille du terrain la plus dense
// (~0,11 pour un bloc de 56 unités en 512 segments), donc la corde entre deux
// sections reste toujours sous la flèche du relief.
const RUBAN_PAS = 0.07
// La demi-largeur de base (RUBAN_DEMI_LARGEUR_BASE) et le calcul qui la
// combine au réglage du panneau (largeurRuban) vivent dans ruban-trace.js,
// PAS ici — voir ce module pour le pourquoi (setWidth() en dépend aussi).
// LE SURVOL. Toutes ces longueurs sont en unités monde, à rapporter à un bloc
// de 56 unités dont le relief occupe une trentaine en vertical.
//   • garde : le ruban doit se lire comme un objet POSÉ AU-DESSUS du relief et
//     non comme une décalcomanie ; en dessous, l'ombrage du terrain le ravale
//     dans la pente. Redescendue de 0,30 à 0,20 en même temps que la largeur :
//     un ruban fin qui vole aussi haut qu'un ruban épais ne survole plus, il
//     lévite — la garde se lit toujours PAR RAPPORT à la largeur.
//   • parPente reste FAIBLE. La non-pénétration est déjà garantie ailleurs
//     (plancher pris au point le plus haut sous la largeur, puis garde remise
//     après lissage) : ce terme n'est plus qu'un confort visuel. Trop fort, il
//     faisait varier le survol de 0,31 à 1,48 selon la pente — un survol qui
//     change du simple au quintuple se lit comme un défaut, pas comme un vol.
//   • lissages : le chemin se contente d'un adoucissement court (le bruit GPS
//     se compte en dizaines de mètres), l'altitude en demande beaucoup plus,
//     parce que c'est le RELIEF sous le tracé qui est bruité, pas le tracé.
// ⚠️ QUATRIÈME RÉGLAGE — encore plus bas, encore plus fidèle. Le survol tombe
// à 0,06, soit moins de la MOITIÉ de la largeur du ruban : à cette hauteur il
// ne plane plus, il effleure. Et les lissages sont à nouveau divisés par deux.
//
// Ce qui rend cette précision possible SANS danger, c'est que la
// non-pénétration ne repose PAS sur le lissage : le plancher est pris au point
// le plus haut sous toute la largeur, et la garde est remise APRÈS lissage
// (voir ruban-trace.js). On peut donc serrer ces valeurs autant qu'on veut —
// le ruban suivra le terrain de plus en plus près sans jamais y entrer. La
// seule limite est esthétique : à lissage nul, il reprendrait le bruit du DEM.
const RUBAN_GARDE = 0.06
const RUBAN_PAR_PENTE = 0.06
const RUBAN_PLAFOND = 0.1
const RUBAN_LISSAGE_CHEMIN = 0.1
const RUBAN_LISSAGE_ALTITUDE = 0.3
const RUBAN_DILATATION = 0.1
// Fondu des bords, en fraction de la demi-largeur : au-delà de ce seuil le
// ruban s'efface progressivement au lieu de s'arrêter net. C'est l'autre
// moitié du « dégradé plus diffus » — la couleur s'adoucit (voir
// DIFFUSION_TEINTES) ET la silhouette cesse d'être découpée au ciseau.
const RUBAN_FONDU_BORD = 0.55

// ── LE SILLAGE DE TÊTE ────────────────────────────────────────────────────
// L'effet de vitesse demandé par Adrien : une lueur filante qui vit devant le
// tracé et se résorbe en quelques dizaines de mètres.
// ⚠️ IL EST FABRIQUÉ EN GÉOMÉTRIE, PAS EN POST-TRAITEMENT. La passe de bloom
// de l'appli a été retirée le 2026-08-02 (voir main.js) : pousser des couleurs
// au-delà de 1 ne produirait donc AUCUNE lueur. Un second ruban, plus large et
// en mélange additif, la fabrique explicitement — et coûte un draw call au lieu
// d'une passe plein écran.
const SILLAGE_LARGEUR = 5.5 // multiplie la demi-largeur du ruban
const SILLAGE_TRAINE = 1.6 // longueur de la traîne, en unités monde
const SILLAGE_VITESSE = 7 // défilement des filaments
const SILLAGE_DENSITE = 5.5 // nombre de filaments par unité monde
// village announcements (task 16 §3) — "plus de 5k habitants" per the brief,
// verbatim.
const VILLAGE_MIN_POP = 5000
// "à côté de la route" — 600m gives a real named place near the road some
// slack for the GeoNames point not sitting exactly on the road centreline,
// while still excluding a village merely visible in the distance across a
// valley (a few km away) that the rider never actually passes.
const VILLAGE_RADIUS_M = 600
const VILLAGE_LINE_HEIGHT = 2.4 // world units — a real vertical mark, not a leader tick

// Décalage nul, partagé — hors mode continu il n'y a rien à retrancher.
const ZERO = { x: 0, z: 0 }
const VILLAGE_LABEL_GAP = 0.35 // above the line's top
// same BASE_H sizing convention as places-layer.js's own BASE_H (task 27 §2
// bumped it 0.007 -> 0.010, see its big comment for the measured px) — these
// ARE place names, of the same visual class, just triggered along-track
// instead of by viewport picking, so they should read at the same size. If
// anything these are the MORE important case for "je veux voir les
// informations des villes et villages qu'on traverse" — an announced
// village IS a village the route passes through, verbatim.
const VILLAGE_LABEL_BASE_H = 0.01

export class GpxLayer {
  // getGrid (optionnel) : le damier de blocs voisins (block-grid.js) — permet
  // de draper la trace sur les blocs adjacents quand elle déborde du central
  constructor({ scene, camera, terrain, params, getDem, getGrid }) {
    this.getGrid = getGrid
    this.scene = scene
    this.camera = camera
    this.terrain = terrain
    this.params = params
    this.getDem = getDem
    this.track = null // { points, name, cumKm[], world[] }
    this.displayName = '' // titre du bandeau si le calque a été renommé — voir setDisplayName()
    this._raceNameCustom = false // le nom éditorial vient-il de l'organisateur ou du GPX ? voir setRaceName()
    this.group = new THREE.Group()
    this.group.name = 'gpx'
    scene.add(this.group)
    // ══════════ LE DÉCALAGE DE FENÊTRE (mode continu 3×3) ═══════════════════
    //
    // La trace est cuite en coordonnées de CHAMP (`latLonToWorld`) et le groupe
    // porte −fenêtre : c'est ce qui la garde plantée sur son chemin pendant que
    // le relief défile dessous. Le miroir JS du `group.position` sert à tout ce
    // qui raisonne en monde sans passer par la scène — le rayon de survol et le
    // test de fenêtre des objets ponctuels.
    // Hors mode continu il reste à (0,0) et rien de tout ça ne s'allume.
    this._fen = { x: 0, z: 0 }
    this._ponctuels = [] // sprites ancrés au sol, masqués hors fenêtre
    this.line = null
    this.lineMat = null
    this.glowLine = null
    this.glowMat = null
    this.ruban = null
    this.rubanMat = null
    this.sillage = null
    this.sillageMat = null
    this.hoverIdx = -1
    // ⚠️ hoverIdx A DEUX ÉCRIVAINS (relecture finale, 2026-08-04, BLOQUANT) —
    // voir le détail complet dans setHover() ci-dessous et dans clic-ruban.js.
    // _survolSouris distingue LEQUEL des deux a écrit en dernier : vrai
    // seulement quand c'est un survol souris réel, jamais la tête de lecture.
    this._survolSouris = false
    // repère de survol du profil (task 12) — fraction de DISTANCE (0..1),
    // au pixel, indépendante de hoverIdx qui s'aimante au sommet le plus
    // proche : null quand la souris n'est pas sur le canevas
    this._survolFraction = null

    // progressive-reveal playback: headT is the play position (0..1, by
    // segment index) — _revealT is what's currently drawn (persists across
    // rebuild() so a mid-playback terrain rebuild doesn't snap the line back)
    this.playing = false
    this.headT = 0
    this._revealT = 1
    // vrai le temps d'UNE image quand la poursuite commande la tête (setHeadAt)
    this._headCommande = false
    this.raceTicks = null // Race Studio : [{km}] — traits verticaux sur le profil
    this._segCount = 0
    this._dispAlt = null
    this._dispSlope = null

    // hover cursor: accent sphere pinned to the nearest track point (mouse
    // hover only — see setHover()'s isPlaybackHead branch)
    this.cursor = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 20, 14),
      new THREE.MeshBasicMaterial({ color: params.hudAccent, depthTest: false })
    )
    this.cursor.renderOrder = 21
    this.cursor.visible = false
    this.group.add(this.cursor)

    // ⚠️ PLUS DE PICTO DE TÊTE DE COURSE. Le cartouche billboardé qui suivait
    // la lecture a été retiré à la demande d'Adrien : sur une carte déjà
    // peuplée de cartouches de points de passage, un cartouche de plus, mobile
    // et toujours au premier plan, écrasait la lecture du parcours lui-même.
    // Ce qui suit N'EST PAS mort pour autant : _headDisp reste la position de
    // la tête, amortie dans le TEMPS (stepHeadFollow), et c'est elle que la
    // caméra de poursuite lit via getHeadPos(). On a supprimé le dessin, pas
    // le suivi.
    this._headDisp = new THREE.Vector3()
    this._headDispValid = false

    // multi-layer stacking (task 22 §2, "comme dans Figma") — an additive
    // renderOrder offset + a tiny world-Y nudge, set via setRenderDepth()
    // from GpxLayerManager.reorder(). Both default to zero, so a bare
    // `new GpxLayer(...)` (every pre-existing single-track call site) keeps
    // the EXACT renderOrder/height values it always had.
    this._renderOffset = 0
    this._depthOffsetY = 0

    // start/finish 3D arches (task 22 §6) — built in rebuild(), disposed in
    // _disposeArches(); see that method + arch.js for the placement math.
    this._archGroups = []

    // along-track village announcements (task 16 §3) — precomputed once per
    // rebuild() (see _buildVillages()), then just a cheap opacity lookup per
    // frame in _updateVillages(). _villageBuildId guards the async
    // loadLayer('places') fetch against a rebuild() that starts a newer one
    // before the previous fetch resolves.
    this._villageHits = []
    this._villageMarkers = []
    this._villageLeadKm = 0
    this._villageFadeKm = 0
    this._villageBuildId = 0

    // uniforme PARTAGÉ entre le matériau du ruban et _applyReveal : créé une
    // seule fois pour survivre aux rebuild() du terrain (qui reconstruisent
    // le maillage mais ne doivent pas rembobiner la lecture en cours)
    this._rubanProgress = { value: 1 }
    // horloge du sillage, avancée par tick() — PARTAGÉE elle aussi, pour la
    // même raison : un rebuild du terrain en pleine lecture ne doit pas
    // rembobiner l'animation des filaments
    this._tempsSillage = { value: 0 }
    this._buildDom()
    this._ray = new THREE.Raycaster()
    this._mouseWorld = new THREE.Vector2()
  }

  // ---------------------------------------------------------------- DOM

  _buildDom() {
    const tip = document.createElement('div')
    tip.className = 'gpx-tip hidden'
    document.body.appendChild(tip)
    this.tipEl = tip

    const wrap = document.createElement('div')
    // même grammaire visuelle que les panneaux (Explore…) : carte en verre
    wrap.className = 'gpx-profile ce-glassbox hidden'
    // race-name header (task 22 §7): "ce nom apparaitra au dessus du profil
    // de la course en bas" — a dedicated line ABOVE the existing (small,
    // monospace) track-name bar, editorial/Rosarivo styling (see style.css),
    // hidden by default (an unset race name shouldn't show an empty bar).
    wrap.innerHTML =
      '<div class="gpx-race-name hidden"></div><div class="gpx-profile-head"><span class="gpx-name">TRACK</span><span class="gpx-stats"></span><button class="gpx-collapse" aria-label="Replier le profil"></button><button class="gpx-close" aria-label="Fermer le parcours">✕</button></div><canvas width="720" height="96"></canvas>'
    document.body.appendChild(wrap)
    this.profileEl = wrap
    this.raceNameEl = wrap.querySelector('.gpx-race-name')
    this.profileCanvas = wrap.querySelector('canvas')
    // ✕ ferme le PARCOURS entier (trace 3D comprise) — navigation libre ensuite
    wrap.querySelector('.gpx-close').addEventListener('click', () => this.clear())
    // chevron : replie le profil sur sa seule ligne d'entête (comme les panneaux)
    wrap.querySelector('.gpx-collapse').addEventListener('click', () => wrap.classList.toggle('collapsed'))

    this.profileCanvas.addEventListener('pointermove', (e) => {
      if (!this.track) return
      const r = this.profileCanvas.getBoundingClientRect()
      // ⚠️ REPÈRE DE SURVOL (task 12) — MÊME fractionAuClic que le clic-pour-
      // reprendre (réciproque exacte de X(i) dans _drawProfile), PAS le calcul
      // km/findIndex ci-dessous qui alimente hoverIdx : celui-ci s'aimante au
      // sommet le plus proche pour le réticule de LECTURE, alors qu'Adrien
      // demande un trait qui « suit exactement ma souris » — au pixel, sans
      // s'accrocher à aucun sommet. Posé AVANT setHover() : son appel interne
      // à _drawProfile() dessine alors les deux repères dans la MÊME image.
      const emb = !!this.profileCanvas.closest?.('.cb-embedded')
      this._survolFraction = repereDeSurvol(fractionAuClic(e.clientX - r.left, r.width, emb ? 0 : PROFILE_PAD_X))
      const f = (e.clientX - r.left) / r.width
      const km = f * this.track.cumKm[this.track.cumKm.length - 1]
      let i = this.track.cumKm.findIndex((v) => v >= km)
      if (i < 0) i = this.track.cumKm.length - 1
      this.setHover(i, false)
    })
    this.profileCanvas.addEventListener('pointerleave', () => {
      // même ordre : effacer le repère AVANT setHover(), qui redessine
      this._survolFraction = repereDeSurvol(null)
      this.setHover(-1, false)
    })
    // ⚠️ CLIC-POUR-REPRENDRE (task 9) — GpxLayer se contente de convertir le
    // pixel cliqué en fraction de DISTANCE (fractionAuClic, réciproque exacte
    // de X(i) dans _drawProfile) et de prévenir main.js par le MÊME canal que
    // le survol (params.onHoverIndex existe déjà pour ça). Positionner la
    // tête ET relancer lecture + suivi caméra vivent dans main.js : c'est là
    // que se trouvent gpxLayer.play()/engageGpxFollow() et leurs gardes
    // (peutEngagerLeSuivi, gpxFollowCoupeParFinale) — les dupliquer ici
    // créerait un second chemin susceptible de diverger du bouton Lecture.
    this.profileCanvas.addEventListener('click', (e) => {
      if (!this.track) return
      const r = this.profileCanvas.getBoundingClientRect()
      const emb = !!this.profileCanvas.closest?.('.cb-embedded')
      const f = fractionAuClic(e.clientX - r.left, r.width, emb ? 0 : PROFILE_PAD_X)
      this.params.onSeekRequest?.(f)
    })
    // le profil est redessiné quand SA BOÎTE change, pas seulement quand la
    // trace change : embarqué dans la barre course, il passe d'un panneau
    // flottant étroit à une zone pleine largeur — sans ça il garderait le
    // bitmap de l'ancienne taille, donc une courbe étirée
    if (typeof ResizeObserver !== 'undefined') {
      this._profileRO = new ResizeObserver(() => this._drawProfile())
      this._profileRO.observe(this.profileCanvas)
    }

    // playback head label: altitude + slope readouts, tweened, floating near
    // the moving head (position:fixed DOM, same idea as gpx-tip)
    const head = document.createElement('div')
    head.className = 'gpx-head-label hidden'
    head.innerHTML = '<div class="gpx-head-alt hidden"></div><div class="gpx-head-slope hidden"></div>'
    document.body.appendChild(head)
    this.headLabel = head
    this._headAltEl = head.querySelector('.gpx-head-alt')
    this._headSlopeEl = head.querySelector('.gpx-head-slope')
  }

  // ---------------------------------------------------------------- data

  // Pick center + zoom so the whole track fits comfortably in the patch.
  frame(points) {
    return frameTrack(points)
  }

  setTrack(points, name) {
    const cumKm = [0]
    for (let i = 1; i < points.length; i++) cumKm.push(cumKm[i - 1] + distM(points[i - 1], points[i]) / 1000)
    // pointNames: optional index -> custom label map, set via setPointName();
    // a fresh track always starts with no custom names
    this.track = { points, name, cumKm, world: null, pointNames: {} }
    this._elesCache = null
    // trace neuve = titre neuf : ni le renommage du calque précédent ni le nom
    // de course de la trace précédente ne survivent (voir setDisplayName)
    this.displayName = ''
    this._raceNameCustom = false
    // race-name default = the GPX's own <name> (task 22 §7 spec: "nommer sa
    // course" — an organiser who never touches the field still sees a name,
    // not blank chrome); setRaceName() is the same call the panel's editable
    // field makes later, so overriding it just re-runs this one path.
    // `custom: false` : c'est une valeur PAR DÉFAUT, pas un choix
    // d'organisateur — un renommage du calque a donc le droit de la remplacer.
    this.setRaceName(name, { custom: false })
  }

  // (Re)drape the loaded track onto the current terrain patch — called after
  // every terrain rebuild so the line always matches the relief under it.
  rebuild() {
    this._disposeLine()
    // le drapage réécrit track.world EN PLACE : l'objet `track` ne change pas
    // de référence, donc le cache d'altitudes de _elevations() ne peut pas le
    // détecter tout seul. C'est ici qu'on le purge.
    this._elesCache = null
    const dem = this.getDem()
    if (!this.track || !dem) return

    const pts = []
    const world = []
    const grid = this.getGrid?.()
    // ⚠️ `demSpan(dem)/2`, PAS `TERRAIN_SIZE/2`. Sur une emprise 3×3 le champ
    // fait 168 unités : le test écrit en dur ne reconnaissait comme « drapable »
    // que le bloc CENTRAL et renvoyait tout le reste au repli à plat du damier,
    // c'est-à-dire une trace posée à l'altitude 0 dès qu'on défilait.
    const demiChamp = demSpan(dem) / 2
    // ⚠️ ET `terrain.sample` PARLE EN COORDONNÉES DE GÉOMÉTRIE. Il ajoute
    // lui-même le décalage de fenêtre : lui passer `w.x` (une coordonnée de
    // champ) lui ferait lire le sol DEUX FOIS décalé, donc draper la trace sur
    // le relief d'un autre endroit. Même correction que map/water-layer.js.
    // Hors mode continu `fen` vaut (0,0) et l'expression est celle d'avant.
    const fen = this.terrain?.fenetre ?? ZERO
    for (const p of this.track.points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const inside = Math.abs(w.x) < demiChamp && Math.abs(w.z) < demiChamp
      // _depthOffsetY (task 22 §2): a small per-layer lift so two stacked
      // layers whose tracks coincide (e.g. the same GPX loaded twice) don't
      // z-fight — see GpxLayerManager.reorder()/setRenderDepth().
      // hors du bloc central : draper sur le bloc VOISIN du damier s'il est
      // chargé (block-grid.js) ; sinon l'ancien fallback à plat
      let y
      if (inside) y = this.terrain.sample(w.x - fen.x, w.z - fen.z) + DRAPE_LIFT
      else {
        const h = grid?.heightAt(w.x, w.z)
        y = (h != null ? h : 0) + DRAPE_LIFT
      }
      y += this._depthOffsetY
      world.push(new THREE.Vector3(w.x, y, w.z))
      pts.push(w.x, y, w.z)
    }
    this.track.world = world
    this._segCount = Math.max(0, world.length - 1)

    const lineColor = this.params.gpxColor || this.params.hudAccent
    const width = this.params.gpxWidth ?? 3

    const eles = this._elevations()
    const gradientOn = !!this.params.gpxGradient
    const vertexColors = gradientOn ? this._trackColors(eles) : null
    const ro = this._renderOffset

    // ── LE RUBAN ────────────────────────────────────────────────────────
    // Le tracé par défaut n'est plus une ligne d'écran mais un ruban couché
    // dans le relief (voir l'en-tête de ruban-trace.js). Line2 reste en
    // dessous, joignable par `gpxRuban: false` : il sert encore au dégradé
    // par altitude/pente, que le ruban n'implémente pas (son dégradé à lui
    // est transversal, c'est un modelé, pas une donnée).
    const utiliseRuban = this.params.gpxRuban !== false && !gradientOn
    if (utiliseRuban) {
      this._construitRuban(world, lineColor, ro)
      this._applyReveal(this._revealT ?? 1)
    }
    this._rebuildSuite({ pts, world, eles, vertexColors, gradientOn, lineColor, width, ro, utiliseRuban })
  }

  // Ruban qui survole le relief — la géométrie vient du module pur
  // ruban-trace.js, ici on ne fait que l'habiller et l'accrocher à la scène.
  _construitRuban(world, lineColor, ro) {
    const fen = this.terrain?.fenetre ?? { x: 0, z: 0 }
    const demiChamp = TERRAIN_SIZE / 2
    const grid = this.getGrid?.()
    // ⚠️ MÊME SOURCE D'ALTITUDE QUE LE DRAPÉ DES POINTS, sans quoi le ruban
    // flotterait au-dessus du bloc voisin (ou s'y enfoncerait) dès qu'un tracé
    // déborde du bloc central : c'est la règle du damier (voir rebuild()).
    const sol = (x, z) => {
      const dedans = Math.abs(x) < demiChamp && Math.abs(z) < demiChamp
      if (dedans) return this.terrain.sample(x - fen.x, z - fen.z) + this._depthOffsetY
      const h = grid?.heightAt(x, z)
      return (h != null ? h : 0) + this._depthOffsetY
    }

    // ⚠️ CETTE VALEUR EST CUITE DANS LA GÉOMÉTRIE — voir setWidth() et
    // ruban-trace.js. rayonNez (plus bas) et _construitSillage() reçoivent
    // tous les deux CETTE MÊME variable `largeur` : c'est ce qui les garde
    // cohérents entre eux quand le réglage du panneau change.
    const largeur = largeurRuban(RUBAN_DEMI_LARGEUR_BASE, this.params.gpxWidth)

    // ⚠️ LES TEINTES SONT ÉCRITES EN sRGB, LE TAMPON VEUT DU LINÉAIRE. three.js
    // (ColorManagement, actif par défaut depuis r152) considère un attribut
    // `color` comme DÉJÀ linéaire et ne le convertit pas. Passer des valeurs
    // sRGB brutes, c'est les faire éclaircir en sortie : le vermillon 1/0,42/0,08
    // ressortait en 1/0,68/0,30, un ambre délavé qui se noyait dans la carte
    // pâle — exactement le défaut qu'on essayait de corriger. Et le liseré
    // « presque noir » 0,07/0,05/0,09 ressortait en brun moyen, donc n'ombrait
    // plus rien. Un aller-retour par THREE.Color remet tout d'aplomb.
    const versLineaire = (stops) => stops.map((c) => {
      const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)
      return [k.r, k.g, k.b]
    })
    // la couleur du panneau arrive en HEX, donc déjà convertie en linéaire par
    // THREE.Color : on la relit en sRGB pour que les DEUX chemins déclinent le
    // modelé dans le même espace, sinon les demi-teintes ne se ressemblent pas
    const srgb = new THREE.Color(lineColor).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace)
    const teintes = this.params.gpxRubanOr === false
      ? teintesDepuis([srgb.r, srgb.g, srgb.b])
      : TEINTES_COURSE

    const r = construitRuban(world, {
      sol,
      demiLargeur: largeur,
      pas: RUBAN_PAS,
      garde: RUBAN_GARDE,
      parPente: RUBAN_PAR_PENTE,
      plafond: RUBAN_PLAFOND,
      lissageChemin: RUBAN_LISSAGE_CHEMIN,
      lissageAltitude: RUBAN_LISSAGE_ALTITUDE,
      dilatationLongueur: RUBAN_DILATATION,
      teintes: versLineaire(teintes),
    })
    if (!r.indices.length) return

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(r.positions), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(r.couleurs), 3))
    // la position le long du tracé, par sommet : c'est elle qui permet un
    // dévoilement CONTINU (voir _applyReveal)
    geo.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(r.distances), 1))
    // position EN TRAVERS (-1..1) : elle sert au fondu des bords, voir le
    // shader plus bas
    geo.setAttribute('aTrav', new THREE.BufferAttribute(new Float32Array(r.transverses), 1))
    geo.setIndex(r.indices)
    geo.computeBoundingSphere()

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      // ⚠️ LE RUBAN ÉCRIT SA PROFONDEUR — contrairement à la version « posée au
      // sol ». Tant qu'il était coplanaire au relief, écrire la profondeur ne
      // faisait que provoquer du z-fighting pour rien. Maintenant qu'il SURVOLE,
      // c'est un objet à part entière : sans écriture, un lacet qui repasse
      // au-dessus d'un autre se mélangerait aux deux au lieu de le masquer, et
      // le tracé perdrait sa lecture en épingles.
      depthWrite: true,
    })
    // ⚠️ LE DÉVOILEMENT SE FAIT AU FRAGMENT, PAS À LA GÉOMÉTRIE. setDrawRange
    // ne coupe qu'aux sommets : la tête avançait par bonds d'un sommet entier,
    // et c'est exactement le « ça saccade » d'Adrien. En comparant une distance
    // interpolée à un uniforme, la coupe tombe où elle veut DANS le triangle —
    // l'avancée devient continue quelle que soit la densité du tracé.
    // rayon du nez arrondi, dans l'unité du dévoilement (fraction de tracé) :
    // il vaut la demi-largeur du ruban, ce qui fait du contour un demi-cercle
    // exact — voir retraitDuNez() dans ruban-trace.js
    const rayonNez = fractionDeTraine(largeur, r.longueur)
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uProgress = this._rubanProgress
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aDist;\nattribute float aTrav;\nvarying float vDist;\nvarying float vTrav;',
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDist = aDist;\nvTrav = aTrav;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uProgress;\nvarying float vDist;\nvarying float vTrav;',
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           // ⚠️ NEZ ARRONDI. La distance le long du tracé est la MÊME sur toute
           // la largeur d'une section : couper dessus donnait un couperet bien
           // droit, que la moindre capture d'écran trahissait. On recule la
           // coupe sur les bords selon 1 − √(1 − u²) — le contour devient un
           // demi-cercle exact de rayon égal à la demi-largeur. Transcription
           // littérale de retraitDuNez() (ruban-trace.js), où la géométrie est
           // décrite et vérifiée.
           float aT = min(1.0, abs(vTrav));
           float tete = uProgress - ${rayonNez.toFixed(8)} * (1.0 - sqrt(1.0 - aT * aT));
           if (vDist > tete) discard;
           // pointe adoucie : une coupe franche ferait un bord net qui
           // « clignote » quand la tête traverse un sommet
           gl_FragColor.a *= smoothstep(tete, tete - 0.004, vDist) * 0.15 + 0.85;
           // FONDU DES BORDS — la seconde moitié du « dégradé plus diffus ».
           // La couleur s'adoucit déjà d'un rail à l'autre ; ici c'est la
           // SILHOUETTE qui cesse d'être découpée au ciseau : au-delà du seuil,
           // le ruban s'efface au lieu de s'arrêter net sur le relief.
           gl_FragColor.a *= 1.0 - smoothstep(${RUBAN_FONDU_BORD.toFixed(2)}, 1.0, abs(vTrav));
           // ⚠️ ON JETTE CE QUI EST QUASI TRANSPARENT. Le ruban ÉCRIT sa
           // profondeur : sans ce rejet, la frange invisible du bord écrirait
           // quand même dans le tampon et masquerait ce qui passe derrière.
           if (gl_FragColor.a < 0.02) discard;`
        )
    }
    mat.customProgramCacheKey = () => 'ruban-trace'
    this._coupeALaFenetre(mat)

    this.rubanMat = mat
    this.ruban = new THREE.Mesh(geo, mat)
    this.ruban.renderOrder = 6 + ro
    this.ruban.frustumCulled = false
    this.group.add(this.ruban)

    this._construitSillage(world, sol, largeur, r, ro)
  }

  // ─────────────────────────── LE SILLAGE DE TÊTE ───────────────────────────
  // « un effet de vitesse un peu tech qui bouge, un peu comme un blur et
  // brillant à la fois, qui se résorbe progressivement » (Adrien).
  //
  // Un second ruban, bien plus large, en MÉLANGE ADDITIF : là où il se
  // superpose à lui-même et au tracé, les lumières s'ajoutent et le cœur
  // sature vers le blanc — c'est ce qui donne le noyau incandescent des
  // références, sans passe de bloom (retirée de l'appli, voir les constantes).
  //
  // ⚠️ LA TRAÎNE SE COMPTE EN UNITÉS MONDE, PAS EN MÈTRES RÉELS. Un bloc fait
  // toujours 56 unités quelle que soit l'étendue qu'il représente : une traîne
  // fixée en mètres réels serait invisible sur un 200 km et noierait un 5 km.
  // Un effet visuel se règle à l'échelle où on le REGARDE.
  _construitSillage(world, sol, largeur, ruban, ro) {
    // ⚠️ MÊMES ALTITUDES QUE LE RUBAN, imposées. Le halo est cinq fois plus
    // large : s'il calculait son propre plancher, il le prendrait sur une bande
    // cinq fois plus large donc plus haute, et sur un versant la lueur
    // décollerait du tracé qu'elle enveloppe.
    const s = construitRuban(world, {
      sol,
      demiLargeur: largeur * SILLAGE_LARGEUR,
      pas: RUBAN_PAS,
      lissageChemin: RUBAN_LISSAGE_CHEMIN,
      altitudesImposees: ruban.altitudes,
    })
    if (!s.indices.length) return

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(s.positions), 3))
    geo.setAttribute('aDist', new THREE.BufferAttribute(new Float32Array(s.distances), 1))
    geo.setAttribute('aTrav', new THREE.BufferAttribute(new Float32Array(s.transverses), 1))
    geo.setIndex(s.indices)
    geo.computeBoundingSphere()

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      // additif : la lumière s'AJOUTE au terrain au lieu de le remplacer
      blending: THREE.AdditiveBlending,
      // pas d'écriture de profondeur (sinon le halo masquerait le tracé qu'il
      // entoure), mais le TEST reste actif : une crête avale la lueur, ce qui
      // se lit comme une vraie lumière et non comme un autocollant
      depthWrite: false,
      // ⚠️ SANS CE BIAIS, LE SILLAGE EST INVISIBLE — mesuré : UN pixel gagné sur
      // 935 × 595. Le halo partage exactement les altitudes du ruban (c'est
      // voulu, voir plus haut) et le ruban, lui, ÉCRIT sa profondeur. Le cœur
      // du halo — la partie qui porte toute la lumière — se retrouvait donc
      // recalé par le test de profondeur contre le tracé qu'il est censé faire
      // rayonner. Le biais se fait en espace de PROFONDEUR, pas en déplaçant la
      // géométrie : constant à l'écran, et il ne décolle donc pas la lueur du
      // tracé quand on s'éloigne (c'est la règle déjà retenue pour la ligne,
      // voir le commentaire de DRAPE_LIFT).
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
      uniforms: {
        uProgress: this._rubanProgress,
        uTemps: this._tempsSillage,
        uTraine: { value: fractionDeTraine(SILLAGE_TRAINE, s.longueur) },
        // le halo a SON propre rayon de nez (il est bien plus large) : sans ça
        // une lueur au front carré déborderait autour d'une pointe ronde
        uRayonNez: { value: fractionDeTraine(largeur * SILLAGE_LARGEUR, s.longueur) },
        uLongueur: { value: s.longueur },
        uBraise: { value: new THREE.Color().setRGB(1, 0.3, 0.05, THREE.SRGBColorSpace) },
        uEtincelle: { value: new THREE.Color().setRGB(1, 0.93, 0.72, THREE.SRGBColorSpace) },
      },
      vertexShader: `
        attribute float aDist;
        attribute float aTrav;
        varying float vDist;
        varying float vTrav;
        void main() {
          vDist = aDist;
          vTrav = aTrav;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uProgress, uTemps, uTraine, uLongueur, uRayonNez;
        uniform vec3 uBraise, uEtincelle;
        varying float vDist;
        varying float vTrav;
        void main() {
          // MÊME NEZ ARRONDI QUE LE RUBAN (voir retraitDuNez, ruban-trace.js) :
          // la tête du halo recule sur ses bords, sinon la lueur se terminerait
          // au carré autour d'une pointe ronde.
          float aT = min(1.0, abs(vTrav));
          float tete = uProgress - uRayonNez * (1.0 - sqrt(1.0 - aT * aT));
          // distance DERRIÈRE la tête, en fraction de tracé
          float d = tete - vDist;
          if (d < 0.0 || d > uTraine) discard;
          // résorption : le carré concentre la lumière juste derrière la tête
          // et laisse la traîne s'éteindre en douceur, comme les références
          float f = 1.0 - d / uTraine;
          f *= f;

          // DEUX gaussiennes superposées : un noyau étroit qui donne le trait
          // incandescent, un halo large qui donne le flou. C'est leur somme qui
          // fait lire « net ET flou en même temps ».
          float a = abs(vTrav);
          float noyau = exp(-a * a * 30.0);
          float halo  = exp(-a * a * 2.6);

          // LES FILAMENTS — l'effet de vitesse. Ils défilent vers l'arrière et
          // sont cisaillés par la position transversale, ce qui les fait
          // diverger en éventail au lieu de rester parallèles.
          float phase = vDist * uLongueur * ${SILLAGE_DENSITE.toFixed(1)} - uTemps * ${SILLAGE_VITESSE.toFixed(1)} + a * 5.0;
          float filaments = 0.62 + 0.38 * sin(phase);

          float i = f * (noyau + halo * 0.42 * filaments);
          // le cœur vire au blanc chaud, la traîne reste braise
          vec3 teinte = mix(uBraise, uEtincelle, clamp(noyau * f * 1.4, 0.0, 1.0));
          gl_FragColor = vec4(teinte * i, i);
        }`,
    })
    this._coupeALaFenetre(mat)

    this.sillageMat = mat
    this.sillage = new THREE.Mesh(geo, mat)
    // au-dessus du ruban : additif, il ne masque rien de toute façon
    this.sillage.renderOrder = 7 + ro
    this.sillage.frustumCulled = false
    this.sillage.visible = false
    this.group.add(this.sillage)
  }

  // La suite du rebuild : l'ancienne ligne Line2 (seulement quand le ruban
  // n'est pas utilisé), puis tout ce qui se pose PAR-DESSUS le tracé —
  // étiquettes, points de passage, bornes kilométriques, arches. Extrait de
  // rebuild() pour que la construction du tracé ait deux implémentations sans
  // dupliquer la centaine de lignes qui les suit.
  _rebuildSuite({ pts, world, eles, vertexColors, gradientOn, lineColor, width, ro, utiliseRuban }) {
    if (utiliseRuban) return this._rebuildDecors({ world, eles, ro })
    const geo = new LineGeometry()
    geo.setPositions(pts)
    if (vertexColors) geo.setColors(vertexColors)
    this.lineMat = new LineMaterial({
      // vertex colours are multiplied by the base colour in LineMaterial's
      // shader — go white so the ramp shows true when it's driving the line
      color: new THREE.Color(gradientOn ? '#ffffff' : lineColor),
      linewidth: width,
      alphaToCoverage: false,
      vertexColors: gradientOn,
      // Depth bias instead of lifting the geometry — see DRAPE_LIFT. Line2
      // draws fat lines as instanced TRIANGLES, so polygonOffset applies to
      // them exactly as it does to the water layer's filled rings, and it
      // biases in DEPTH-BUFFER space: constant on screen, and it never moves
      // the track off the ground it's supposed to be lying on.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    this.lineMat.resolution.set(window.innerWidth, window.innerHeight)
    this._coupeALaFenetre(this.lineMat)
    this.line = new Line2(geo, this.lineMat)
    this.line.computeLineDistances()
    this.line.renderOrder = 6 + ro
    this.group.add(this.line)

    // glow: a second, wider, additive, low-opacity halo behind the main line
    if (this.params.gpxGlow) {
      const glowGeo = new LineGeometry()
      glowGeo.setPositions(pts)
      if (vertexColors) glowGeo.setColors(vertexColors)
      this.glowMat = new LineMaterial({
        color: new THREE.Color(gradientOn ? '#ffffff' : lineColor),
        linewidth: width * 2.4,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: gradientOn,
        alphaToCoverage: false,
      })
      this.glowMat.resolution.set(window.innerWidth, window.innerHeight)
      this._coupeALaFenetre(this.glowMat)
      this.glowLine = new Line2(glowGeo, this.glowMat)
      this.glowLine.computeLineDistances()
      this.glowLine.renderOrder = 4 + ro
      this.group.add(this.glowLine)
    }

    return this._rebuildDecors({ world, eles, ro })
  }

  // Tout ce qui se pose PAR-DESSUS le tracé, quelle que soit la façon dont il
  // est dessiné : étiquettes de points, bornes kilométriques, arches, stats.
  _rebuildDecors({ world, eles, ro }) {
    // relus ici plutôt que passés depuis rebuild() : ce sont les deux seules
    // valeurs de son ancienne portée dont les décors se servent, et les
    // relire coûte moins qu'un paramètre de plus à faire suivre par les deux
    // chemins de construction du tracé
    const dem = this.getDem()
    const fen = this.terrain?.fenetre ?? ZERO
    const names = this.track.pointNames || {}
    const mk = (label, v, scale = 1, opacity = 1) => {
      const s = textSprite(label, this.params.hudAccent, scale, opacity, 20 + ro)
      s.position.copy(v).add(new THREE.Vector3(0, scale > 0.8 ? 1.25 : 0.85, 0))
      this.group.add(s)
      // ⚠️ LES OBJETS PONCTUELS SE CACHENT, ILS NE SE COUPENT PAS. Les plans de
      // coupe conviennent à la trace (une ligne coupée net au bord du socle se
      // lit comme un bord de carte) ; sur une étiquette ils trancheraient le
      // texte en plein milieu d'un mot. On les masque donc entiers — même règle
      // que les noms de lieux (map/places-layer.js:_declutter).
      this._ponctuels.push({ obj: s, x: s.position.x, z: s.position.z })
      return s
    }

    // start / finish — ONE toggle governs both (gpxMarkers): a route has a
    // start and an end, showing only one rarely makes sense, so this is a
    // single on/off rather than two independent switches. A 3D arch (task 22
    // §6, see _buildArches()) now REPLACES the old flat ◆/▶/■ text sprites —
    // showing both would be redundant (the brief: "don't show both") — so
    // those sprites are built ONLY as the arch's fallback when the arch
    // itself can't be placed (a degenerate 1-point track with no direction
    // to orient a gate against).
    const lastIdx = eles.length - 1
    const isLoop = detectLoop(world)
    this._disposeArches()
    const archesBuilt = this.params.gpxMarkers ? this._buildArches(world, isLoop, names, eles) : false

    if (archesBuilt) {
      this.startSprite = null
      this.endSprite = null
    } else if (isLoop && this.params.gpxMarkers) {
      // same place — one combined sprite, no separate end marker at all
      let label
      if (names[0] && names[lastIdx]) label = `◆ ${names[0]} & ${names[lastIdx]}`
      else if (names[0]) label = `◆ ${names[0]}`
      else if (names[lastIdx]) label = `◆ ${names[lastIdx]}`
      else label = `◆ START & FINISH · ${Math.round(eles[0])} M`
      this.startSprite = mk(label, world[0])
      this.endSprite = null
    } else {
      this.startSprite = this.params.gpxMarkers
        ? mk(names[0] ? `▶ ${names[0]}` : `▶ START · ${Math.round(eles[0])} M`, world[0])
        : null
      this.endSprite = this.params.gpxMarkers
        ? mk(names[lastIdx] ? `■ ${names[lastIdx]}` : `■ FINISH · ${Math.round(eles[lastIdx])} M`, world[world.length - 1])
        : null
    }

    // altitude waypoints along the way — one every ~2 km, six at most, plus
    // any custom-named point so a name set via the panel is always visible
    this.waypoints = []
    const wpKm = this.track.cumKm[this.track.cumKm.length - 1]
    const nWp = Math.min(6, Math.max(2, Math.round(wpKm / 2)))
    const wpIndices = new Set()
    for (let k = 1; k <= nWp; k++) {
      const target = (k / (nWp + 1)) * wpKm
      let i = this.track.cumKm.findIndex((v) => v >= target)
      if (i < 0) i = this.track.cumKm.length - 1
      wpIndices.add(i)
    }
    for (const idxStr of Object.keys(names)) {
      const i = parseInt(idxStr, 10)
      if (Number.isFinite(i) && i > 0 && i < lastIdx) wpIndices.add(i)
    }
    for (const i of wpIndices) {
      const label = names[i] ? `◆ ${names[i]}` : `◆ ${Math.round(eles[i])} M`
      this.waypoints.push(mk(label, world[i], 0.62, 0.85))
    }

    // km markers — a small, quiet "N KM" text every so often (no dots — see
    // the task-16 brief: the old marker dots read as "moche"/ugly). The
    // interval adapts to the track's own length via pickKmInterval() so a
    // 5km loop and an 80km epic both land around ~5 discreet labels instead
    // of one fixed spacing crowding or starving either end. Scale/opacity
    // are deliberately smaller & quieter than the waypoint diamonds above —
    // secondary to the track, not competing with it.
    this.kmMarkers = []
    if (this.params.gpxKm) {
      const totKm = this.track.cumKm[this.track.cumKm.length - 1]
      const totKmWhole = Math.floor(totKm)
      if (totKmWhole >= 1) {
        const stride = pickKmInterval(totKm)
        for (let km = stride; km <= totKmWhole; km += stride) {
          let i = this.track.cumKm.findIndex((v) => v >= km)
          if (i < 0) i = this.track.cumKm.length - 1
          const label = mk(`${km} KM`, world[i], 0.36, 0.6)
          this.kmMarkers.push(label)
        }
      }
    }

    this.cursor.material.color.set(this.params.hudAccent)
    this._syncProfileTitle()
    const totKm = this.track.cumKm[this.track.cumKm.length - 1]
    const gain = eles.reduce((g, e, i) => (i && e > eles[i - 1] ? g + e - eles[i - 1] : g), 0)
    // ⚠️ Virgule décimale, pas point : cette ligne voisine le Carnet de course
    // dans la barre course, qui formate en français. Deux séparateurs
    // décimaux côte à côte dans la même barre, ça se remarque.
    const km1 = totKm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    this.profileEl.querySelector('.gpx-stats').textContent =
      `${km1} KM · ↗ ${Math.round(gain)} M · ${Math.round(Math.min(...eles))}–${Math.round(Math.max(...eles))} M`
    // respect the layer's visibility — a terrain rebuild must not resurrect
    // the profile strip while the track is hidden (or while in orbit)
    this.profileEl.classList.toggle('hidden', !this.group.visible)
    this._drawProfile()

    // a fresh line/casing/glow always starts fully revealed — reapply the
    // persisted reveal amount so a rebuild mid-playback (e.g. a terrain
    // rebuild) doesn't snap the drawn line back to 100%
    this._applyReveal(this._revealT)

    // along-track village announcements (task 16 §3) — dispose the previous
    // build's markers right away (their ground heights belong to the old
    // terrain/dem) and kick off the async re-pick. loadLayer('places') is
    // cached after the first call (see geo-data.js), so every rebuild after
    // the track's first load resolves near-instantly; _villageBuildId guards
    // against a rebuild() firing again before an in-flight fetch resolves.
    this._disposeVillages()
    const villageBuildId = ++this._villageBuildId
    this._buildVillages(villageBuildId, dem, world, totKm)

    // Les étiquettes qui viennent d'être créées ne connaissent pas encore la
    // fenêtre : sans cette passe, une reconstruction pendant un défilement les
    // rallumerait toutes, y compris les huit neuvièmes hors socle.
    this._ecreteFenetre()
  }

  // Fetches places (cached after the first call), picks the along-track
  // hits once, and builds their (initially invisible) markers. Never
  // throws — a failed/late fetch just means no village announcements.
  async _buildVillages(buildId, dem, world, totKm) {
    if (!dem) return
    try {
      const [rows] = await Promise.all([loadLayerForBounds('places', patchBounds(dem)), labelFontReady()])
      if (buildId !== this._villageBuildId || !this.track || !Array.isArray(rows)) return
      const radiusWorld = VILLAGE_RADIUS_M / surfaceMetersPerUnit(dem)
      this._villageHits = pickVillagesAlongTrack(rows, {
        toWorld: (lat, lon) => latLonToWorld(dem, lat, lon),
        world,
        cumKm: this.track.cumKm,
        minPop: VILLAGE_MIN_POP,
        radiusWorld,
      })
      this._villageLeadKm = villageLeadKm(totKm)
      this._villageFadeKm = this._villageLeadKm * 1.5
      this._buildVillageMarkers()
    } catch {
      this._villageHits = []
    }
  }

  // Builds one (vertical line + name label, both initially opacity 0) per
  // precomputed hit — reuses text-label.js's makeLabelTexture(), same
  // BASE_H sizing convention as a normal place name (see VILLAGE_LABEL_BASE_H
  // above). Per-frame work is just an opacity lookup in _updateVillages().
  // ink/plate both use tier 0 (the boldest step of labelInk/labelPlate's
  // ranking) — every announced village is, by construction, a name worth
  // the rider's attention right now, not one competing against neighbours
  // for screen space the way the viewport-picked Places layer's tiers do.
  _buildVillageMarkers() {
    this._disposeVillages()
    if (!this._villageHits.length) return
    // task 29: the plate deliberately runs OPPOSITE the theme (dark plate on
    // a light map, light plate on a dark map — see labelPlate), so the text
    // drawn on top of it must run opposite labelInk's normal on-map ink too,
    // via labelPlateInk, or it reads dark-on-dark / light-on-light.
    const plateInk = labelPlateInk(this.params.darkMode)
    const plate = labelPlate(this.params.darkMode)
    const accentColor = new THREE.Color(this.params.hudAccent)
    for (const hit of this._villageHits) {
      // coordonnées de CHAMP → coordonnées de géométrie pour le sampler
      const fenV = this.terrain?.fenetre ?? ZERO
      const groundY = this.terrain.sample ? this.terrain.sample(hit.w.x - fenV.x, hit.w.z - fenV.z) : 0
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(hit.w.x, groundY, hit.w.z),
        new THREE.Vector3(hit.w.x, groundY + VILLAGE_LINE_HEIGHT, hit.w.z),
      ])
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false })
      )
      line.renderOrder = 24 + this._renderOffset
      line.visible = false
      this.group.add(line)

      const { tex, aspect } = makeLabelTexture(hit.name.toUpperCase(), { color: plateInk, plate, weight: 700 })
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
      )
      label.material.sizeAttenuation = false
      label.scale.set(VILLAGE_LABEL_BASE_H * aspect, VILLAGE_LABEL_BASE_H, 1)
      label.position.set(hit.w.x, groundY + VILLAGE_LINE_HEIGHT + VILLAGE_LABEL_GAP, hit.w.z)
      label.renderOrder = 25 + this._renderOffset
      label.visible = false
      this.group.add(label)

      this._villageMarkers.push({ hit, line, label })
    }
  }

  // Per-frame (well, per _updateHead call — playback only): cheap opacity
  // lookup against the precomputed hits, no track/place re-scan (see the
  // task-16 brief: "précalcule... une fois, ne scanne pas par frame").
  _updateVillages(km) {
    if (!this._villageMarkers.length) return
    for (const m of this._villageMarkers) {
      const op = villageOpacity(km, m.hit.km, this._villageLeadKm, this._villageFadeKm)
      // Le fondu de lecture ET le test de fenêtre : un village annoncé à
      // l'instant juste ne s'affiche pas s'il est hors du socle (mode continu).
      const visible = op > 0.002 && this._dansFenetre(m.hit.w.x, m.hit.w.z)
      m.line.visible = visible
      m.label.visible = visible
      m.line.material.opacity = op
      m.label.material.opacity = op
    }
  }

  _disposeVillages() {
    for (const m of this._villageMarkers) {
      this.group.remove(m.line)
      m.line.geometry.dispose()
      m.line.material.dispose()
      this.group.remove(m.label)
      m.label.material.map?.dispose()
      m.label.material.dispose()
    }
    this._villageMarkers = []
  }

  // hides (opacity 0) every village marker without disposing them — used
  // when playback stops/hides so a paused/stopped view doesn't leave a
  // half-faded announcement hanging.
  _hideVillages() {
    for (const m of this._villageMarkers) {
      m.line.visible = false
      m.label.visible = false
      m.line.material.opacity = 0
      m.label.material.opacity = 0
    }
  }

  // ---------------------------------------------------------------- arches

  // Builds the start/finish 3D arch(es) for the current track (task 22 §6,
  // now the user's own modelled GLB — task 25) — called from rebuild(),
  // gated by params.gpxMarkers (the arch REPLACES the old flat ◆/▶/■
  // sprites — see rebuild()'s own comment on why both shouldn't show).
  // Returns true if at least one arch was actually placed, false for a
  // degenerate (<2 point) track — the caller falls back to the flat sprites
  // only in that false case, so a track never ends up with neither kind of
  // start/finish marker. buildArchMesh() itself is synchronous (returns a
  // group immediately, populates it once the GLB — loaded once, cached —
  // resolves), so this stays synchronous too.
  _buildArches(world, isLoop, names, eles) {
    if (!world || world.length < 2) return false
    const specs = computeArchSpecs(world, isLoop)
    if (!specs.length) return false
    // task 25 §4: "l'utilisateur pourra choisir la couleur de l'arche" — an
    // explicit choice (params.gpxArchColor) wins; empty (the default, same
    // sentinel convention as gpxColor) falls back to the old darkMode-driven
    // ink so an untouched arch still reads correctly in both look modes.
    const archColor = this.params.gpxArchColor || (this.params.darkMode ? '#e7e9ec' : '#2b2f33')
    for (const spec of specs) {
      // ⚠️ `sampleGround` reçoit des coordonnées de CHAMP (spec.pos vient de
      // `world`), et `terrain.sample` répond en coordonnées de géométrie — d'où
      // le décalage retranché, comme au drapage de la trace elle-même.
      const fen = this.terrain?.fenetre ?? ZERO
      const group = buildArchMesh(spec, {
        sampleGround: (x, z) => this.terrain.sample?.(x - fen.x, z - fen.z) ?? spec.pos.y,
        ink: archColor,
        renderOrder: 22 + this._renderOffset,
      })
      this.group.add(group)
      this._archGroups.push(group)
      this._ponctuels.push({ obj: group, x: spec.pos.x, z: spec.pos.z })
    }
    return true
  }

  _disposeArches() {
    for (const group of this._archGroups) {
      this.group.remove(group)
      disposeArchGroup(group)
    }
    this._archGroups = []
  }

  // ⚠️ MÉMORISÉ, ET LE COMPTE DES APPELS ÉTAIT FAUX. Par image de LECTURE, ce
  // tableau était reconstruit QUATRE fois : setHover(), _drawProfile() (que
  // setHover appelle), le Carnet de course (main.js, params.onHoverIndex) et
  // _updateHead(). Le commentaire de main.js en comptait deux et en concluait
  // qu'un troisième appel serait « cher en mémoire » — le raisonnement était
  // bon, la mesure fausse, et la conclusion ne protégeait rien : à 2 400
  // points (MAX_POINTS) c'étaient ~4 tableaux neufs par image, soit ~2 Mo/s de
  // déchets pendant qu'une scène WebGL cherche à tenir 60 im/s.
  //
  // La clé d'invalidation est EXACTEMENT ce dont le résultat dépend, rien de
  // plus : l'objet DEM (main.js rend `() => dem`, donc une référence NEUVE à
  // chaque chargement de relief), l'exagération (elle divise mPerUnit) et la
  // trace. `track.world` n'y figure pas parce qu'il est réécrit EN PLACE dans
  // un objet `track` inchangé : c'est rebuild() qui vide le cache à la main,
  // et setTrack() aussi. Sans ces deux purges, la mémoïsation rendrait des
  // altitudes drapées sur le relief d'avant.
  _elevations() {
    const dem = this.getDem()
    const exag = this.params.demExaggeration
    if (this.track && this._elesCache && this._elesTrack === this.track
        && this._elesDem === dem && this._elesExag === exag) return this._elesCache
    const mPerUnit = dem ? surfaceMetersPerUnit(dem) / exag : 1
    const out = this.track.points.map((p, i) => {
      if (p.ele != null && Number.isFinite(p.ele)) return p.ele
      const w = this.track.world?.[i]
      // subtract the SAME lift rebuild() added, or every derived altitude is
      // off by it — this is why DRAPE_LIFT is a named constant and not a
      // literal repeated in two places that can drift apart
      return w && dem ? (w.y - DRAPE_LIFT) * mPerUnit + dem.meanM : 0
    })
    this._elesTrack = this.track
    this._elesDem = dem
    this._elesExag = exag
    this._elesCache = out
    return out
  }

  // per-vertex [r,g,b, r,g,b, ...] ramp for the gradient modes, one triple
  // per track point (parallel to the pts/world arrays built in rebuild()).
  _trackColors(eles) {
    const cumKm = this.track.cumKm
    const n = eles.length
    const eMin = Math.min(...eles)
    const eMax = Math.max(...eles)
    const eRange = Math.max(eMax - eMin, 1e-6)
    const mode = this.params.gpxGradientMode || 'elevation'
    const out = new Array(n * 3)
    for (let i = 0; i < n; i++) {
      let c
      if (mode === 'slope') {
        const j = Math.min(i + 1, n - 1)
        const k = Math.max(i - 1, 0)
        const dKm = cumKm[j] - cumKm[k]
        const grade = dKm > 0 ? ((eles[j] - eles[k]) / (dKm * 1000)) * 100 : 0
        c = slopeRampColor(grade)
      } else if (mode === 'progress') {
        c = progressRampColor(n > 1 ? i / (n - 1) : 0)
      } else {
        c = elevationRampColor((eles[i] - eMin) / eRange)
      }
      out[i * 3] = c.r
      out[i * 3 + 1] = c.g
      out[i * 3 + 2] = c.b
    }
    return out
  }

  // ---------------------------------------------------------------- profile

  _drawProfile() {
    if (!this.track?.world) return
    const cv = this.profileCanvas
    // ⚠️ ON NE DESSINE PAS DANS UNE BOÎTE QUI N'EST PAS POSÉE — et surtout on
    // ne retombe JAMAIS sur la taille du bitmap. Les deux états que le client
    // a explicitement demandés mettent ce canvas à 0×0 en CSS SANS arrêter la
    // lecture : la barre repliée (`.cb-collapsed .cb-body { height: 0 }`) et
    // le téléphone (`.cb-zone-parcours { display: none }` sous 680 px). Le
    // repli `cv.clientWidth || cv.width` rendait alors la taille du BITMAP —
    // qu'on venait ensuite multiplier par la densité d'écran. Avec dpr = 2 :
    // bmW = cv.width × 2 ≠ cv.width, donc on réécrivait cv.width = 2 × cv.width
    // et l'image d'après recommençait : 800 → 1600 → 3200 → 6400… À raison
    // d'un appel par image (setHover, en continu pendant la lecture), on
    // dépassait la limite de canvas du navigateur en une fraction de seconde,
    // pendant que la scène 3D tourne. Sur dpr = 1 c'était inoffensif : voilà
    // pourquoi ça a pu passer.
    // Sortir ici, c'est aussi ne plus rien redessiner NI appeler _elevations()
    // tant que la barre est repliée ou la zone masquée.
    if (!cv.clientWidth || !cv.clientHeight) return
    const ctx = cv.getContext('2d')
    // ⚠️ LES JETONS SE LISENT SUR LE CANVAS, PAS SUR <html>. Le mode sombre
    // (body.dark) et la teinte de palette (main.js écrit les jetons sur
    // document.body.style) posent les --ce-* sur BODY : lus sur
    // documentElement, on récupérait les valeurs CLAIRES de :root — d'où une
    // pastille de survol en porcelaine blanche au milieu d'une barre noire.
    // Les propriétés personnalisées s'héritent : le canvas les a toutes.
    const css = getComputedStyle(cv)
    // ⚠️ DEUX ORANGES ET DEUX NOIRS COHABITAIENT DANS 152 px DE HAUT. Le
    // profil se dessinait en --hud-ink (#17191b, noir FROID) et --hud-accent
    // (#ff4d00, vermillon) pendant que la barre qui l'entoure est en --ce-ink
    // (stone-900, noir CHAUD) et --ce-accent (orange-600). Le trait de la
    // courbe touchait presque le chiffre « 42,3 » écrit dans une autre encre,
    // et le remplissage orange de la courbe — la plus grande surface colorée
    // de la barre — jurait avec le seul --ce-accent de la composition.
    // Embarqué, le profil parle donc la langue de la barre ; autonome (HUD
    // flottant), il garde la sienne.
    const emb = !!cv.closest?.('.cb-embedded')
    const jeton = (nom, repli) => css.getPropertyValue(nom).trim() || repli
    const ink = emb ? jeton('--ce-ink', '#1c1917') : jeton('--hud-ink', '#17191b')
    const accent = emb ? jeton('--ce-accent', '#ea580c') : jeton('--hud-accent', '#ff4d00')
    // ⚠️ LE BITMAP SUIT SA BOÎTE — il n'est PLUS figé au 720×96 de l'attribut
    // HTML. Un bitmap fixe étiré par CSS déforme tout ce qu'on y dessine :
    // dans la barre course (large et basse), la courbe s'aplatissait et les
    // chiffres du survol se comprimaient jusqu'à l'illisible. On redimensionne
    // donc le bitmap à la taille RENDUE × la densité d'écran, et on dessine
    // ensuite en pixels CSS (setTransform) — le code de tracé plus bas n'a pas
    // à savoir que la densité existe. Plafond à 2 : au-delà on paie de la
    // mémoire vidéo pour une courbe lissée que personne ne verra plus nette.
    // ⚠️ clientWidth/clientHeight SEULS : voir la garde en tête de méthode.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = Math.max(1, Math.round(cv.clientWidth))
    const H = Math.max(1, Math.round(cv.clientHeight))
    const bmW = Math.round(W * dpr)
    const bmH = Math.round(H * dpr)
    if (cv.width !== bmW || cv.height !== bmH) { cv.width = bmW; cv.height = bmH }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const eles = this._elevations()
    // guard: a stationary track (identical points) has totKm 0 → X(i) NaN
    const totKm = Math.max(this.track.cumKm[this.track.cumKm.length - 1], 1e-6)
    const eMin = Math.min(...eles)
    const eMax = Math.max(...eles)
    const pad = 8
    // ⚠️ LE PADDING HORIZONTAL ET LE VERTICAL N'ONT PAS LE MÊME PATRON. Le
    // vertical (`pad`) est une réserve DE DESSIN : la courbe ne doit pas coller
    // au bord haut/bas de son bitmap. L'horizontal, lui, était une MARGE — et
    // une marge de plus, en double de celle que la zone porte déjà. Embarqué,
    // le profil vit dans .cb-zone-parcours, qui a 22 px de padding (--cb-gutter,
    // la marge de zone) : la courbe démarrait donc à 30 px du bord de la barre
    // et l'étiquette « 1840 m » à 32, quand le titre de la tête, lui, commence
    // à 22. Dix pixels de dérive entre les deux seuls textes calés à gauche de
    // cette moitié de barre, et une zone dont le contenu ne touche jamais ses
    // bords alors que le parti pris écrit en tête de course-bar.css est que le
    // profil « est le sujet, il occupe la moitié de la barre et respire ».
    // Autonome (HUD flottant), le panneau n'a pas de zone autour de lui : il
    // garde ses 8 px. Valeur PARTAGÉE avec fractionAuClic (voir plus haut) —
    // c'est cette même constante que le clic doit retrancher pour retomber
    // sur la fraction de distance qui a servi à placer X(i) ici.
    const padX = emb ? 0 : PROFILE_PAD_X
    const X = (i) => padX + (this.track.cumKm[i] / totKm) * (W - padX * 2)
    // ⚠️ LA RÉSERVE DU HAUT DOIT LOGER LA PASTILLE DE SURVOL, PAS LA MOITIÉ.
    // Elle valait 10 px pour une pastille posée à `pad + 1` et haute de 17 px,
    // soit 18 px d'encombrement : il en manquait 8, et la pastille passait
    // donc systématiquement par-dessus le POINT CULMINANT — l'endroit exact
    // qu'un coureur regarde en premier. En lecture, hoverIdx est maintenu en
    // continu par la tête, donc le sommet était masqué en permanence.
    // ⚠️ RELECTURE FINALE (2026-08-04) — INCONDITIONNELLE, ET C'EST DÉLIBÉRÉ.
    // Une réserve conditionnelle (19 en survol, 4 sinon) ne se voyait jamais
    // tant que le survol souris HORS LECTURE était cassé (voir _survolSouris
    // dans setHover, et le clic-pour-reprendre plus bas dans ce fichier) :
    // hoverIdx ne passait alors jamais de -1 à ≥0 sous la souris. Depuis que
    // c'est réparé, entrer/sortir du profil fait bien passer hoverIdx par les
    // deux valeurs — et la réserve, donc l'amplitude Y, changeait à CHAQUE
    // survol : la courbe entière se redessinait 15 px plus bas puis remontait,
    // un tressautement sur ce que l'en-tête de ce fichier appelle « le sujet »
    // de la barre. Une courbe stable vaut mieux qu'une courbe ample qui
    // tressaute : la réserve reste à 19 en permanence, la courbe perd 15 px
    // d'amplitude tout le temps plutôt que de sauter parfois.
    const reserve = 19
    // Amplitude plancher à 1. ⚠️ LE COMMENTAIRE D'AVANT DISAIT FAUX : il
    // affirmait que « dans une barre repliée (corps à 0 px) H vaut 1 ». H
    // valait cv.height, c'est-à-dire le bitmap — c'était l'écroulement décrit
    // en tête de méthode. La barre repliée ne passe désormais plus par ici du
    // tout ; le plancher reste pour la TRANSITION de repli, où la boîte est
    // posée mais de quelques pixels seulement (H - 16 - 19 y serait négatif,
    // donc une courbe dessinée à l'envers).
    const ampli = Math.max(H - pad * 2 - reserve, 1)
    const Y = (e) => H - pad - ((e - eMin) / Math.max(eMax - eMin, 1)) * ampli

    // LIGNE DE BASE — la clé de lecture la moins chère qui soit : sans elle,
    // rien ne dit où la courbe « pose » et l'aire flotte dans le vide.
    if (emb) {
      ctx.strokeStyle = jeton('--ce-hairline', 'rgba(0,0,0,0.08)')
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padX, H - pad + 0.5)
      ctx.lineTo(W - padX, H - pad + 0.5)
      ctx.stroke()
    }

    // area fill + line
    ctx.beginPath()
    ctx.moveTo(X(0), H - pad)
    for (let i = 0; i < eles.length; i++) ctx.lineTo(X(i), Y(eles[i]))
    ctx.lineTo(X(eles.length - 1), H - pad)
    ctx.closePath()
    // ⚠️ L'ACCENT EST RÉSERVÉ À LA POSITION DE LECTURE (réticule, repères de
    // points, pastille) — voir la règle de couleur en tête de course-bar.css.
    // Le remplissage de l'aire est la PLUS GRANDE surface de la barre et la
    // plus STATIQUE : peint en accent, il dépensait la couleur vive sur ce qui
    // ne change jamais, et la règle écrite disait le contraire de ce que le
    // code faisait. Une ombre d'encre à 8 % dit « voici le volume » sans
    // prétendre « voici ce qui bouge ». Le HUD flottant autonome, lui, garde
    // sa propre langue (--hud-accent) : ce n'est pas la même composition.
    ctx.fillStyle = emb ? ink + '14' : accent + '22'
    ctx.fill()
    ctx.beginPath()
    for (let i = 0; i < eles.length; i++) i ? ctx.lineTo(X(i), Y(eles[i])) : ctx.moveTo(X(i), Y(eles[i]))
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Race Studio : un trait vertical par point de passage DÉJÀ franchi par
    // la tête de course (en lecture) — tous visibles hors lecture (Adrien)
    if (this.raceTicks?.length) {
      const headKm = this.isPlaying() ? this.headT * totKm : Infinity
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      for (const t of this.raceTicks) {
        if (t.km > headKm) continue
        const x = padX + (Math.min(t.km, totKm) / totKm) * (W - padX * 2)
        ctx.globalAlpha = 0.55
        ctx.beginPath()
        ctx.moveTo(x, pad)
        ctx.lineTo(x, H - pad)
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(x, pad + 2, 2, 0, Math.PI * 2)
        ctx.fillStyle = accent
        ctx.fill()
      }
    }

    // LES DEUX ALTITUDES EXTRÊMES, ÉCRITES SUR LE GRAPHIQUE (profil embarqué).
    // ⚠️ C'EST L'ÉCHELLE Y DU DESSIN, pas une décoration : eMin/eMax sont
    // littéralement les bornes de Y(). Elles vivaient uniquement dans le bloc
    // « Altitude 320–1840 m » de la tête de barre — c'est-à-dire ailleurs, et
    // masqué dès 1100 px de large. Un profil de 136 px de haut sans aucune
    // graduation n'est pas un graphique, c'est une silhouette : on ne peut y
    // lire ni à quelle altitude on court, ni quelle amplitude la courbe
    // couvre. Écrites ici, elles suivent le graphique partout où il va.
    // 72 % d'encre = --ce-muted-fort, en hexadécimal parce que le canvas doit
    // recevoir une couleur qu'il sait lire dans TOUS les navigateurs (le jeton
    // est un color-mix(), que fillStyle n'accepte pas partout).
    if (emb) {
      ctx.font = '500 11px "SF Mono", ui-monospace, monospace'
      ctx.fillStyle = ink.length === 7 ? ink + 'b8' : ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      // même bord gauche que la courbe (donc que le titre de la tête) : ces
      // deux nombres sont l'ÉCHELLE du graphique, ils se lisent au ras de lui
      ctx.fillText(`${Math.round(eMax)} m`, padX, pad + 1)
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${Math.round(eMin)} m`, padX, H - pad - 2)
      ctx.textBaseline = 'alphabetic'
    }

    // ⚠️ REPÈRE DE SURVOL (task 12) — « une couleur différente de celles qui
    // sont déjà sur le profil ». L'accent est déjà pris trois fois sur ce
    // graphique (réticule ci-dessous, sa pastille, les points de passage) et
    // la règle en tête de course-bar.css le réserve à LA POSITION DE LECTURE.
    // Ce trait-ci ne dit pas « c'est ici que tu es » mais « c'est ici que tu
    // IRAIS si tu cliques » — une intention différente, qui ne doit donc pas
    // parler la langue de l'accent. `ink` en encre atténuée ET en pointillé
    // (double distinction : teinte ET tracé) évite toute confusion visuelle
    // avec le réticule plein ci-dessous quand les deux sont visibles à la
    // fois — ce qui arrive à chaque survol du profil, puisque le réticule
    // (hoverIdx, aimanté au sommet le plus proche) et ce repère (la fraction
    // EXACTE du pixel, via fractionAuClic) sont posés par le MÊME pointermove.
    // Dessiné APRÈS la courbe et AVANT la pastille de survol ci-dessous, pour
    // ne masquer ni l'une ni l'autre.
    if (this._survolFraction != null) {
      const xs = padX + this._survolFraction * (W - padX * 2)
      ctx.save()
      ctx.strokeStyle = ink
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(xs, pad)
      ctx.lineTo(xs, H - pad)
      ctx.stroke()
      ctx.restore()
    }

    // hover crosshair
    if (this.hoverIdx >= 0) {
      const i = this.hoverIdx
      ctx.strokeStyle = accent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(X(i), pad)
      ctx.lineTo(X(i), H - pad)
      ctx.stroke()
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(X(i), Y(eles[i]), 3.2, 0, Math.PI * 2)
      ctx.fill()
      // pastille lisible plutôt que du texte nu posé sur la courbe : dans la
      // barre course le profil est large et clair, un texte fin s'y perdait
      // virgule décimale : ce texte voisine le Carnet, qui formate en français
      const kmTxt = this.track.cumKm[i].toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      const txt = `${Math.round(eles[i])} m · km ${kmTxt}`
      ctx.font = '600 11px "SF Mono", ui-monospace, monospace'
      const aDroite = X(i) > W / 2
      const tw = ctx.measureText(txt).width
      const bx = X(i) + (aDroite ? -tw - 12 : 6)
      const by = pad + 1
      ctx.globalAlpha = 0.92
      ctx.fillStyle = css.getPropertyValue('--ce-porcelain').trim() || '#fbfbfc'
      ctx.beginPath()
      // le rayon vient du système (v28.css : --ce-radius-xs), il ne s'invente
      // pas ici — la barre affichait cinq rayons dont deux, 5 et 2, n'étaient
      // dans aucune échelle. Le canvas ne peut pas consommer un jeton CSS : on
      // le LIT, on ne le recopie pas.
      const rPastille = parseFloat(jeton('--ce-radius-xs', '4px')) || 4
      ctx.roundRect?.(bx, by, tw + 10, 17, rPastille)
      if (ctx.roundRect) ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(txt, bx + 5, by + 9)
      ctx.textBaseline = 'alphabetic'
    }
  }

  // ---------------------------------------------------------------- hover

  // nearest track point to the pointer ray (screen-space tolerance)
  pointerMove(mouseNdc, clientX, clientY) {
    // Garde extraite en fonction PURE (voir peutSurvolerLeTrace ci-dessus,
    // avant la classe) — testable sans DOM ni caméra THREE, ce qu'une
    // condition en ligne ne permettait pas. Sans ce test, `!this.line` a pu
    // se réintroduire ici sans qu'aucun test ne rougisse : c'est EXACTEMENT
    // ce qui s'est produit (task 9) — Line2 n'est construit que quand le
    // ruban n'est PAS utilisé, or le ruban est le rendu PAR DÉFAUT, donc
    // `this.line` valait toujours null et ce picking — et tout ce qui en
    // dépend, y compris le clic-pour-reprendre — ne s'exécutait JAMAIS.
    if (!peutSurvolerLeTrace(this.track, this.group.visible)) return
    this._ray.setFromCamera(mouseNdc, this.camera)
    const ray = this._ray.ray
    // ⚠️ LE RAYON EST EN MONDE, `track.world` EST EN CHAMP. En mode continu le
    // groupe porte −fenêtre : comparer les deux tels quels ferait survoler la
    // trace à l'endroit qu'elle occupait avant le défilement. On amène donc le
    // rayon dans le repère du champ — une addition sur son origine, plutôt que
    // de translater chacun des milliers de points de la trace.
    // Hors mode continu `_fen` vaut (0,0) et le rayon est celui d'avant.
    ray.origin.x += this._fen.x
    ray.origin.z += this._fen.z
    const camDist = this.camera.position.distanceTo(this.cursor.visible ? this.cursor.position : ray.origin)
    const tol = Math.max(0.4, camDist * 0.022)
    let best = -1
    let bestD = tol * tol
    for (let i = 0; i < this.track.world.length; i++) {
      const d = ray.distanceSqToPoint(this.track.world[i])
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    this.setHover(best, true, clientX, clientY)
  }

  // isPlaybackHead distinguishes the two callers that share this bookkeeping
  // (hoverIdx tracking, profile crosshair, tooltip text): mouse-driven hover
  // (from the 3D scene or the profile strip) shows the accent sphere ;
  // pendant la LECTURE, la position de la tête ne se marque plus d'aucun objet
  // 3D (le picto a été retiré, voir le constructeur) — c'est la pointe du
  // ruban dévoilé qui la donne, et le réticule du profil qui la chiffre.
  //
  // ⚠️ hoverIdx A DEUX ÉCRIVAINS, ET LE CLIC-POUR-REPRENDRE (main.js) LES
  // CONFONDAIT (relecture finale, 2026-08-04, BLOQUANT). Ce setter est appelé
  // À CHAQUE IMAGE de lecture par _updateHead (isPlaybackHead=true), ET par le
  // picking souris réel (pointerMove ci-dessus, isPlaybackHead=false, PUIS le
  // profil embarqué, même valeur). Un rAF s'intercale TOUJOURS entre le
  // pointerdown et le pointerup d'un clic : pendant une lecture, hoverIdx vaut
  // donc l'index de la TÊTE au moment du clic, quel que soit ce qu'il y a sous
  // le curseur — un `hoverIdx >= 0` tout seul ne peut pas distinguer les deux.
  // `_survolSouris` porte cette distinction, et LUI SEUL : vrai uniquement
  // quand ce setter vient d'être appelé pour un survol souris réel. Voir
  // clic-ruban.js (doitReprendreLaLecture) pour l'endroit qui en dépend, et le
  // test qui verrouille le cas — ce piège se réintroduit tout seul dès qu'un
  // nouvel appelant de setHover apparaît sans passer par isPlaybackHead.
  setHover(i, fromScene, clientX, clientY, isPlaybackHead = false) {
    this.hoverIdx = i
    this._survolSouris = survolVientDeLaSouris(isPlaybackHead, i)
    if (i < 0 || !this.track?.world) {
      this.cursor.visible = false
      this.tipEl.classList.add('hidden')
      this._drawProfile()
      this.params.onHoverIndex?.(-1)
      return
    }
    if (isPlaybackHead) {
      this.cursor.visible = false
    } else {
      this.cursor.visible = true
      this.cursor.position.copy(this.track.world[i])
      const s = Math.max(0.5, this.camera.position.distanceTo(this.cursor.position) * 0.02)
      this.cursor.scale.setScalar(s)
    }

    const eles = this._elevations()
    const km = this.track.cumKm[i]
    const j = Math.min(i + 1, eles.length - 1)
    const dKm = this.track.cumKm[j] - this.track.cumKm[Math.max(i - 1, 0)]
    const grade = dKm > 0 ? ((eles[j] - eles[Math.max(i - 1, 0)]) / (dKm * 1000)) * 100 : 0
    const text = `ALT ${Math.round(eles[i])} M · KM ${km.toFixed(2)} · ${grade >= 0 ? '+' : ''}${grade.toFixed(1)}%`

    if (fromScene && clientX != null) {
      this.tipEl.textContent = text
      this.tipEl.style.left = `${clientX + 16}px`
      this.tipEl.style.top = `${clientY - 10}px`
      this.tipEl.classList.remove('hidden')
    } else {
      this.tipEl.classList.add('hidden')
    }
    this._drawProfile()
    // Hook générique pour un lecteur externe (Le Carnet de course) : reçoit
    // le même index que la crosshair du profil, qu'il vienne du survol
    // souris OU de la tête de lecture animée. GpxLayer ne sait rien du
    // Carnet — il ne fait que prévenir.
    this.params.onHoverIndex?.(i)
  }

  // ---------------------------------------------------------------- fly

  // Catmull-Rom above the track with a smoothed clearance envelope — handed
  // to the existing tour controller for the flight itself.
  buildFlightCurve(altitude) {
    const w = this.track?.world
    if (!w || w.length < 2) return null
    const stride = Math.max(1, Math.floor(w.length / 90))
    const raw = []
    for (let i = 0; i < w.length; i += stride) raw.push(w[i])
    raw.push(w[w.length - 1])

    // rolling-max envelope, then box blur — same recipe as the poi tour
    const win = 4
    const ys = raw.map((_, i) => {
      let m = -Infinity
      for (let j = Math.max(0, i - win); j <= Math.min(raw.length - 1, i + win); j++) m = Math.max(m, raw[j].y)
      return m
    })
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < ys.length; i++) {
        let s = 0
        let c = 0
        for (let j = Math.max(0, i - 3); j <= Math.min(ys.length - 1, i + 3); j++) {
          s += ys[j]
          c++
        }
        ys[i] = s / c
      }
    }

    const pts = [this.camera.position.clone()]
    for (let i = 0; i < raw.length; i++) pts.push(new THREE.Vector3(raw[i].x, ys[i] + altitude, raw[i].z))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    curve.arcLengthDivisions = 600
    curve.updateArcLengths()
    return curve
  }

  // ---------------------------------------------------------------- misc

  onResize(w, h) {
    this.lineMat?.resolution.set(w, h)
    this.glowMat?.resolution.set(w, h)
  }

  setColor(color) {
    const c = color || this.params.hudAccent
    // when the gradient ramp is driving the line, its base colour must stay
    // white (see rebuild()) — the accent swatch only applies to the solid path
    if (!this.params.gpxGradient) {
      this.lineMat?.color.set(c)
      this.glowMat?.color.set(c)
    }
    this.cursor.material.color.set(c)
  }

  // ⚠️ LE RUBAN SE RECONSTRUIT, LA LIGNE SE RÈGLE. La largeur du ruban est CUITE
  // dans sa géométrie (voir _construitRuban) : changer un uniforme n'y suffit pas.
  // C'est la régression qu'Adrien a vue — depuis que le ruban a remplacé Line2,
  // les puces Fine/Classique/Épaisse ne changeaient plus rien.
  setWidth(v) {
    if (this.lineMat) this.lineMat.linewidth = v
    if (this.glowMat) this.glowMat.linewidth = v * 2.4
    if (this.ruban && this.track) this.rebuild()
  }

  // gradient / glow need the geometry (vertex colours) or a second line rebuilt.
  setGradient(on, mode) {
    this.params.gpxGradient = on
    if (mode) this.params.gpxGradientMode = mode
    this.rebuild()
  }

  setGlow(v) {
    this.params.gpxGlow = v
    this.rebuild()
  }

  // multi-layer stacking (task 22 §2) — additive renderOrder + a small
  // world-Y nudge, applied on the NEXT rebuild(). See the constructor
  // comment on _renderOffset/_depthOffsetY for why both default to zero.
  setRenderDepth(renderOffset, yNudge = 0) {
    this._renderOffset = renderOffset || 0
    this._depthOffsetY = yNudge || 0
    if (this.track) this.rebuild()
  }

  // advances the progressive-reveal head while playing — called from the
  // main render loop each frame with a real per-frame dt.
  tick(dt) {
    // les filaments du sillage défilent en TEMPS, pas en distance : ils
    // continuent donc de vibrer même quand la tête est commandée image par
    // image par la poursuite, ou quand la lecture est en pause sur place
    // ⚠️ SEUL ce scintillement obéit à l'interrupteur Animations. La lecture du
    // parcours (headT, quelques lignes plus bas) n'est PAS un agrément qu'on
    // coupe — c'est le produit lui-même — donc elle reçoit `dt` sans condition,
    // même animations coupées : voir la note de recensement de animations.js.
    if (animationsActives({ reglage: this.params.animations })) this._tempsSillage.value += dt
    // ⚠️ QUELQU'UN A LA MAIN SUR LA TÊTE — ON N'AVANCE PAS. La poursuite
    // hélicoptère commande la tête image par image (voir setHeadAt) et son
    // horloge n'a AUCUNE raison de coïncider avec celle de la lecture : la
    // lecture parcourt les 47 km en 71 s, la poursuite ne couvre que le tronçon
    // retenu, à l'allure de Tobler. Laisser les deux avancer, c'est deux
    // positions pour une seule tête — le marqueur finirait à des kilomètres du
    // sujet que la caméra vise. Le drapeau se CONSOMME ici : dès qu'une image
    // passe sans commande, la lecture reprend la main toute seule.
    if (this._headCommande) {
      this._headCommande = false
      return
    }
    if (this.playing && this.track?.world?.length > 1) {
      const totalKm = this.track.cumKm[this.track.cumKm.length - 1] || 0
      const duration = Math.min(90, Math.max(8, totalKm * 1.5))
      // the Follow-speed slider (Route panel) only scales the advance rate
      // while drone-follow is actually on — normal playback pace is
      // untouched otherwise. Because the reveal head AND the chase camera
      // (driven from this same headT, see main.js) both read this one
      // value, they can never drift apart regardless of speed.
      const speedMul = this.params.gpxFollow ? THREE.MathUtils.clamp(this.params.gpxFollowSpeed || 1, 0.1, 6) : 1
      this.headT = Math.min(1, this.headT + (dt * speedMul) / duration)
      this._applyReveal(this.headT)
      this._updateHead(dt)
      if (this.headT >= 1) this.playing = false // reached the end — auto-pause
    }
  }

  // ---------------------------------------------------------------- playback

  isPlaying() {
    return this.playing
  }

  play() {
    if (!this.track?.world || this.track.world.length < 2) return
    if (this.headT >= 1) {
      this.headT = 0
      this._headDispValid = false // restarting from the top — snap, don't ease across from the old end position
    }
    this.playing = true
  }

  // ⚠️ NE REMET PAS hoverIdx À -1 — C'EST VOULU, PAS UN OUBLI. hoverIdx reste
  // à l'index de la tête au moment de la pause, pour garder le réticule du
  // profil visible sur la position quittée plutôt que de l'effacer. Ça ne
  // relance PAS la lecture au clic suivant pour autant : le dernier écrivain
  // de hoverIdx reste la tête (setHover(…, isPlaybackHead=true), voir tick()),
  // donc _survolSouris reste faux tant qu'aucun mouvement de souris n'a
  // retraversé le canevas 3D ou le profil (voir clic-ruban.js). Un clic loin
  // du tracé, juste après Pause, plonge donc bien sur le terrain — il ne
  // relance pas la lecture là où elle s'est arrêtée.
  pause() {
    this.playing = false
  }

  stop() {
    this.playing = false
    this.headT = 0
    this._headDispValid = false
    this._applyReveal(1) // restore the full line
    this._hideVillages()
    this.headLabel?.classList.add('hidden')
    this.setHover(-1, false)
  }

  // ---- tête COMMANDÉE de l'extérieur (poursuite hélicoptère) ---------------
  //
  // `t` est une fraction 0..1 d'indice de segment, exactement comme `headT` :
  // c'est la poursuite qui la calcule (voir `fractionSurTrace` dans
  // poursuite.js), parce qu'elle seule sait où en est son sujet. On repasse par
  // les MÊMES deux appels que tick() — révélation de la ligne puis marqueur —
  // pour qu'il n'existe jamais deux façons de placer cette tête (c'est
  // exactement le bug de la tâche 16, voir `revealVertexIndex`).
  setHeadAt(t, dt = 1 / 60) {
    if (!this.track?.world || this.track.world.length < 2) return
    this._headCommande = true
    this.headT = THREE.MathUtils.clamp(t, 0, 1)
    this._applyReveal(this.headT)
    this._updateHead(dt)
  }

  // La poursuite rend la main. Si rien ne lit, on restaure la ligne entière :
  // une trace amputée au milieu, avec plus rien qui bouge, se lit comme un bug.
  releaseHead() {
    this._headCommande = false
    if (this.playing || !this.track) return
    this._applyReveal(1)
    this.headLabel?.classList.add('hidden')
    this._hideVillages()
    this.setHover(-1, false)
  }

  setAltReadout(v) {
    this.params.gpxAltReadout = v
  }

  setSlopeReadout(v) {
    this.params.gpxSlopeReadout = v
  }

  // limits how much of the line/glow Line2 draws — instanceCount is the
  // fat-line addon's per-segment draw-range knob (see LineSegmentsGeometry
  // .setPositions, which sets it to the full segment count by default).
  _applyReveal(t) {
    this._revealT = THREE.MathUtils.clamp(t, 0, 1)
    // ⚠️ LE RUBAN NE SE COUPE PAS À LA GÉOMÉTRIE. Un simple uniforme, comparé
    // par fragment à la distance interpolée le long du tracé (voir le shader
    // dans _construitRuban) : la coupe tombe où elle veut À L'INTÉRIEUR d'un
    // triangle. C'est ce qui supprime les à-coups — instanceCount, lui, ne
    // pouvait avancer que d'un sommet entier à la fois, et sur un GPX décimé
    // à 2 400 points ce cran se voyait.
    this._rubanProgress.value = this._revealT
    // le sillage n'a de sens que s'il Y A une tête : tracé entièrement
    // dévoilé, plus rien n'avance, donc plus de lueur de vitesse
    if (this.sillage) this.sillage.visible = this._revealT < 0.999
    // Line2 (repli quand le dégradé de pente est actif) ne sait couper qu'à un
    // sommet entier : on lui donne le sommet qui correspond à la même
    // DISTANCE, pas au même rang — voir indexALAbscisse.
    const count = Math.min(indexALAbscisse(this._revealT, this.track?.cumKm), this._segCount)
    if (this.line) this.line.geometry.instanceCount = count
    if (this.glowLine) this.glowLine.geometry.instanceCount = count
  }

  // Place la position de tête suivie par la caméra, l'étiquette alt/pente, et
  // pousse le réticule du profil au même endroit (setHover garde l'infobulle
  // DOM muette puisque fromScene est faux ici).
  _updateHead(dt) {
    const world = this.track.world
    // ⚠️ LA MÊME MESURE QUE LE RUBAN — la distance parcourue, pas le rang du
    // sommet (voir indexALAbscisse). C'est ce qui recale entre eux le ruban,
    // le réticule du profil, les chiffres du carnet et la caméra : ils lisent
    // tous le même `headT`, converti une seule fois, ici.
    const headIdx = indexALAbscisse(this.headT, this.track.cumKm)
    this.setHover(headIdx, false, undefined, undefined, true)

    const eles = this._elevations()
    const cumKm = this.track.cumKm
    const j = Math.min(headIdx + 1, eles.length - 1)
    const k = Math.max(headIdx - 1, 0)
    const dKm = cumKm[j] - cumKm[k]
    const targetSlope = dKm > 0 ? ((eles[j] - eles[k]) / (dKm * 1000)) * 100 : 0
    const targetAlt = eles[headIdx]

    // ease toward the sampled value instead of snapping, so the digits
    // visibly animate as the head advances
    const lambda = 6
    this._dispAlt = this._dispAlt == null ? targetAlt : THREE.MathUtils.damp(this._dispAlt, targetAlt, lambda, dt)
    this._dispSlope =
      this._dispSlope == null ? targetSlope : THREE.MathUtils.damp(this._dispSlope, targetSlope, lambda, dt)

    // La position de tête n'est plus dessinée (le picto a été retiré), mais
    // elle reste calculée : c'est ce que la caméra de poursuite lit via
    // getHeadPos(), et ce qui ancre l'étiquette alt/pente juste en dessous.
    // Amortie dans le TEMPS, jamais le long d'une courbe différente — sans
    // quoi la caméra viserait un point que le ruban n'a pas encore atteint.
    stepHeadFollow(this._headDisp, world[headIdx], HEAD_FOLLOW_LAMBDA, dt, this._headDispValid)
    this._headDispValid = true
    const pos = this._headDisp

    const v = pos.clone().project(this.camera)
    const x = (v.x * 0.5 + 0.5) * window.innerWidth
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight
    this.headLabel.style.left = `${x + 18}px`
    this.headLabel.style.top = `${y - 10}px`

    const showAlt = !!this.params.gpxAltReadout
    const showSlope = !!this.params.gpxSlopeReadout
    this._headAltEl.textContent = `ALT ${Math.round(this._dispAlt)} M`
    this._headAltEl.classList.toggle('hidden', !showAlt)
    this._headSlopeEl.textContent = `${this._dispSlope >= 0 ? '+' : ''}${this._dispSlope.toFixed(1)}%`
    this._headSlopeEl.classList.toggle('hidden', !showSlope)
    this.headLabel.classList.toggle('hidden', !(showAlt || showSlope))

    this._updateVillages(cumKm[headIdx])
  }

  // rebuild-driven toggles — geometry (ticks/labels) is only constructed
  // when its flag is on, so each of these needs a rebuild()
  // single toggle for both markers — see the rebuild() comment above
  setMarkers(v) {
    this.params.gpxMarkers = v
    this.rebuild()
  }

  // task 25 §4 — user-choosable arch colour; '' resets to the darkMode
  // default (see _buildArches). Full rebuild, same as setGlow/setMarkers
  // above: cheapest correct way to re-run _buildArches with the new colour.
  setArchColor(v) {
    this.params.gpxArchColor = v
    this.rebuild()
  }

  setKm(v) {
    this.params.gpxKm = v
    this.rebuild()
  }

  // Race name (task 22 §7) — organiser-entered, shown above this profile
  // strip's own track-name bar. An empty name hides the line entirely
  // rather than showing blank chrome (the track-name bar below already
  // covers "no name set" — see rebuild()'s '.gpx-name' text). Stored on the
  // instance (not just painted to the DOM) so the Route panel's race-name
  // field can read back the current value when focus moves between layers
  // — see GpxLayerManager.raceName / setRaceName().
  // `custom` distingue le nom SAISI par l'organisateur (champ « Nom de la
  // course » du panneau) de la simple recopie du <name> du GPX posée par
  // setTrack : seul le second est remplaçable par un renommage de calque.
  setRaceName(name, { custom = true } = {}) {
    const trimmed = (name || '').trim()
    this.raceName = trimmed
    if (custom) this._raceNameCustom = true
    if (this.raceNameEl) {
      this.raceNameEl.textContent = trimmed
      this.raceNameEl.classList.toggle('hidden', !trimmed)
    }
  }

  // Nom du CALQUE (donc le nom de la course) affiché dans le cartouche du
  // profil. Piège qui a produit le bug : le calque est renommé APRÈS le
  // chargement de la trace — importRace() dans main.js appelle loadGpxText()
  // puis setName() —, donc un titre posé une fois pour toutes au setTrack
  // reste bloqué sur le <name> brut du GPX (« idee itinerante. 2026-… »)
  // pendant que le panneau Parcours, lui, affiche le vrai nom. Le titre passe
  // donc par _syncProfileTitle(), rejoué à chaque rebuild() (le relief se
  // reconstruit souvent) et à chaque renommage.
  setDisplayName(name) {
    const trimmed = (name || '').trim()
    // le nom éditorial au-dessus du profil est périmé pour la même raison
    // tant qu'il n'est que la recopie du <name> : on le fait suivre. Dès que
    // l'organisateur a écrit le sien, il est à lui, on n'y touche plus.
    if (trimmed && !this._raceNameCustom) this.setRaceName(trimmed, { custom: false })
    this.displayName = trimmed
    this._syncProfileTitle()
  }

  _syncProfileTitle() {
    const el = this.profileEl?.querySelector('.gpx-name')
    if (el) el.textContent = profileTitle(this.displayName, this.track?.name)
  }

  // stores (or clears, when name is empty) a custom label for a track-point
  // index — shown on the waypoint/start/end sprite in place of the default
  // elevation readout; index is a plain track-point index (e.g. hoverIdx)
  setPointName(index, name) {
    if (!this.track || index == null || index < 0) return
    if (!this.track.pointNames) this.track.pointNames = {}
    const trimmed = (name || '').trim()
    if (trimmed) this.track.pointNames[index] = trimmed
    else delete this.track.pointNames[index]
    this.rebuild()
  }

  // ══════════ LA TRACE SUIT LE RELIEF (mode continu 3×3) ═════════════════════
  //
  // Une écriture de `group.position` et une passe de visibilité sur les objets
  // ponctuels — appelée quand la fenêtre BOUGE, pas à chaque image.
  //
  // La trace elle-même, la ligne et son halo, est écrêtée par les huit plans de
  // coupe posés à la construction : le GPU la coupe pile au bord du socle, pour
  // rien, sans qu'on ait à refaire la moindre géométrie (fenetre-clip.js).
  //
  // ⚠️ SANS ÇA LE TRACÉ DÉBORDE. `gpx.js` n'a JAMAIS eu d'écrêtage : le test
  // `inside` du drapage ne choisit que la SOURCE de l'altitude, il ne coupe
  // rien. Sur une emprise 3×3 la trace est cuite sur 168 unités et déborderait
  // visiblement du socle de 56 — l'étude §5.2 le signalait comme le seul calque
  // sans découpe du tout.
  setFenetre(x, z) {
    this._fen.x = x
    this._fen.z = z
    this.group.position.set(-x, 0, -z)
    this._ecreteFenetre()
  }

  // Pose la découpe de fenêtre sur un matériau. Sans effet hors mode continu :
  // `plansFenetre()` rend alors `null`, et three.js ne compile même pas le code
  // de coupe sans plans — le matériau reste celui d'avant, variante de shader
  // comprise. Même mécanique que map/water-layer.js.
  _coupeALaFenetre(mat) {
    const plans = this.terrain?.plansFenetre?.()
    if (!mat || !plans) return
    mat.clippingPlanes = plans
    mat.clipShadows = false
    mat.needsUpdate = true
  }

  // Un point de CHAMP tombe-t-il dans le socle affiché ? Toujours vrai hors mode
  // continu — là, tout ce qui existe est déjà dans le bloc, et poser l'octogone
  // quand même risquerait de masquer une étiquette de coin qui s'affiche
  // parfaitement aujourd'hui.
  _dansFenetre(x, z) {
    const fp = this.terrain?.empriseFootprint?.()
    if (!fp) return true
    const bloc = this.terrain.blockFootprint()
    return dansFenetre(x - this._fen.x, z - this._fen.z, bloc.half, bloc.corner)
  }

  _ecreteFenetre() {
    if (!this.terrain?.empriseFootprint?.()) return
    for (const p of this._ponctuels) p.obj.visible = this._dansFenetre(p.x, p.z)
  }

  setVisible(v) {
    this.group.visible = v
    if (!v) {
      this.setHover(-1, false)
      this.pause?.()
      this.headLabel?.classList.add('hidden')
    }
    this.profileEl.classList.toggle('hidden', !v || !this.track)
  }

  _disposeLine() {
    this._disposeArches()
    this._ponctuels = [] // les objets qu'il pointait viennent d'être détruits
    this._segCount = 0
    if (this.sillage) {
      this.group.remove(this.sillage)
      this.sillage.geometry.dispose()
      this.sillageMat?.dispose()
      this.sillage = null
      this.sillageMat = null
    }
    if (this.ruban) {
      this.group.remove(this.ruban)
      this.ruban.geometry.dispose()
      this.rubanMat?.dispose()
      this.ruban = null
      this.rubanMat = null
    }
    if (this.line) {
      this.group.remove(this.line)
      this.line.geometry.dispose()
      this.lineMat.dispose()
      this.line = null
    }
    if (this.glowLine) {
      this.group.remove(this.glowLine)
      this.glowLine.geometry.dispose()
      this.glowMat.dispose()
      this.glowLine = null
      this.glowMat = null
    }
    for (const s of [this.startSprite, this.endSprite, ...(this.waypoints || [])]) {
      if (s) {
        this.group.remove(s)
        s.material.map.dispose()
        s.material.dispose()
      }
    }
    this.startSprite = this.endSprite = null
    this.waypoints = []
    for (const m of this.kmMarkers || []) {
      this.group.remove(m)
      if (m.isSprite) {
        m.material.map.dispose()
        m.material.dispose()
      }
    }
    this.kmMarkers = []
  }

  // position monde amortie de la tête (ce que l'utilisateur voit) — null tant
  // qu'aucune tête n'est active ; la caméra de suivi la vise pour la centrer
  get headWorld() {
    return this._headDispValid ? this._headDisp : null
  }

  clear() {
    this._disposeLine()
    this._disposeVillages()
    this.track = null
    this.cursor.visible = false
    this._headDispValid = false
    this._villageHits = []
    this._villageLeadKm = 0
    this._villageFadeKm = 0
    this.tipEl.classList.add('hidden')
    this.profileEl.classList.add('hidden')
    this.playing = false
    this.headT = 0
    this._revealT = 1
    this.raceTicks = null // Race Studio : [{km}] — traits verticaux sur le profil
    this._dispAlt = null
    this._dispSlope = null
    this.headLabel?.classList.add('hidden')
    this.onCleared?.() // le damier de blocs voisins se resynchronise (main.js)
  }
}
