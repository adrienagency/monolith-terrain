// ON ATTRAPE LA TERRE — règle D19, Tâche R32.
//
// Module PUR : ni DOM, ni three.js, aucun import. Testable en node —
// `test/saisie-terre.test.js`.
//
// ══════════ LA RÈGLE, ET L'ESPACE OÙ ELLE SE VÉRIFIE ═══════════════════════
//
// > **Adrien, 2026-09-01 :** *« quand je déplace et fais tourner la Terre au
// > clic, la Terre se déplace autour de son centre »* — *« je veux que les
// > contrôles soient exactement les mêmes que pour Google Earth »*.
//
// Google Earth, au glissé gauche : le point de la surface saisi au clic RESTE
// SOUS LE CURSEUR tant que le bouton est tenu (on « attrape » la planète) ; la
// planète tourne autour de son centre, le nord reste en haut, l'altitude ne
// change pas ; passé le limbe, la rotation continue au rythme du bord ; au
// relâché, l'élan décroît en une fraction de seconde.
//
// ⛔ **CE N'EST PAS `rotateSpeed`.** `OrbitControls` tourne de `2π·dx/H` par
// pixel quelle que soit l'altitude : à 60 000 km cela coïncide à peu près avec
// la saisie (le disque de la Terre fait ~130 px de rayon, donc 0,44°/px) ; à
// 8 000 km c'est **8,4 fois trop vite** (5,9 km/px au sol pour 0,053°/px), à
// 130 km plus de deux cents fois. Le point saisi file sous le curseur et sort
// de l'écran. Le geste juste n'a pas de VITESSE : il a une CONTRAINTE — `G`
// sous le pointeur — et c'est elle qu'on résout.
//
// ══════════ LA LOI ══════════════════════════════════════════════════════════
//
// La caméra est au nadir, nord en haut (à un roulis près, connu), à `h`
// unités-globe au-dessus d'un point `S` de la sphère. Au clic on retient `G`,
// le point de la sphère sous le pointeur. À chaque image, `D` est le point de
// la sphère sous le pointeur MAINTENANT. Déplacer `S` de `(G − D)` en
// latitude/longitude ramène `G` là où `D` se projette, c'est-à-dire sous le
// pointeur : c'est `pasDeSaisie`. Au premier ordre — la projection n'est pas
// linéaire en lat/lon (perspective, courbure) —, donc `deplacementDeSaisie`
// ITÈRE sur un modèle de la caméra (`poseNadir`, `pointSousLePixel`) : trois
// à cinq itérations tiennent sous le centième de pixel (test ⑤), et l'image
// suivante relit `D` sur la caméra réellement posée, ce qui absorbe l'écart
// entre le modèle et la scène.
//
// ⚠️ **LE PAS EST PLAFONNÉ EN ANGLE** (`PLAFOND_PAS_DEG`) : si `D` est loin de
// `G` (le pointeur a sauté pendant un chargement, ou il est passé le limbe), on
// avance de 30° au plus par image et le reste se fait aux images suivantes —
// jamais un demi-tour en une image.
//
// ⚠️ **LE LIMBE.** Un rayon qui rate la sphère rend le point du limbe le plus
// proche (`pointSousLeRayon`, `limbe: true`) : le pas garde alors la direction
// du bord, ce qui est le geste de Google Earth passé le disque.
//
// ⚠️ **AUCUNE VITESSE EN °/px N'EST ÉCRITE ICI**, et c'est la preuve que ce
// n'est pas un réglage : à 60 000 km comme à 50 km, la loi est la même
// contrainte. Le test ⑤ ter mesure ce que ça rend en °/px, il ne le fixe pas.

/** Le rayon de la sphère des contrôles, en unités-globe — `R_GLOBE` (geo.js). */
export const RAYON_TERRE_U = 100
/** Le plafond d'un pas de saisie, en degrés d'arc par image. */
export const PLAFOND_PAS_DEG = 30
/**
 * Le pas par image quand le pointeur est SORTI du disque (le rayon rate la
 * sphère) : il n'y a plus de point à rejoindre, on avance au rythme du bord.
 * ⚠️ Mesuré avant d'exister (`.banc/R32/apres.json`, première passe) : sans
 * lui, un glissé de 200 px à 60 000 km sortait du disque (~130 px de rayon) et
 * le pas plafonné à 30° par image emportait la caméra de 63,7° de latitude et
 * 89° de longitude jusqu'au pôle — puis tout le reste du banc mesurait un cas
 * dégénéré. 0,75° par image, c'est ~45 °/s : la vitesse à laquelle Google Earth
 * continue de tourner quand on tire au-delà du bord.
 */
export const PLAFOND_LIMBE_DEG = 0.75
/** Le nombre d'itérations du modèle par image — voir le test ⑤. */
export const ITERATIONS_SAISIE = 5
/** La constante de temps de l'élan au relâché — celle qu'OrbitControls donnait (`dampingFactor` 0,03, « τ ≈ 0,35 s »). */
export const TAU_ELAN_S = 0.35
/** Sous cette vitesse, l'élan est éteint (en degrés par seconde). */
export const VITESSE_ELAN_MIN_DEG_S = 0.01
/**
 * La latitude au-delà de laquelle la caméra ne va pas. Le nord en haut y perd
 * son sens, Mercator s'arrête à 85,05°, et le bloc de surface y est dégénéré :
 * mesuré (`.banc/R32/apres.json`, première passe, caméra clampée à −85°), la
 * cible reste bornée par `viseeArrivee` hors du voisinage de l'axe, et le bloc
 * se rechargeait À CHAQUE IMAGE (busy alterné, 3 images par seconde). 80°
 * laisse une marge de deux blocs z4 sous la limite de Mercator.
 */
export const LAT_MAX_DEG = 80

const R2D = 180 / Math.PI
const D2R = Math.PI / 180
const fini = (v) => typeof v === 'number' && Number.isFinite(v)
const vecFini = (v) => Array.isArray(v) && v.length === 3 && v.every(fini)
const norme = (v) => Math.hypot(v[0], v[1], v[2])
const unit = (v) => { const n = norme(v); return n > 1e-12 ? [v[0] / n, v[1] / n, v[2] / n] : null }
const croix = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const point = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Un delta de longitude replié sur ]−180, 180]. */
export function enroulerLon(d) {
  if (!fini(d)) return 0
  let r = ((((d + 180) % 360) + 360) % 360) - 180
  if (r === -180) r = 180
  return r
}

/**
 * Le point de la sphère sous un rayon (caméra → pixel), ou le point du limbe le
 * plus proche si le rayon rate la sphère.
 *
 * Convention : `origine` et `direction` en unités-globe, sphère centrée à
 * l'origine. Rend un vecteur UNITAIRE (la direction du point depuis le centre).
 *
 * @returns {{point:number[], limbe:boolean}|null} null si la sphère est derrière
 */
export function pointSousLeRayon({ origine, direction, rayon = RAYON_TERRE_U } = {}) {
  if (!vecFini(origine) || !vecFini(direction) || !(rayon > 0)) return null
  const d = unit(direction)
  if (!d) return null
  const b = point(origine, d)
  const c = point(origine, origine) - rayon * rayon
  const disc = b * b - c
  if (disc >= 0) {
    const t = -b - Math.sqrt(disc)
    if (t >= 0) {
      const p = unit([origine[0] + d[0] * t, origine[1] + d[1] * t, origine[2] + d[2] * t])
      if (p) return { point: p, limbe: false }
    }
  }
  // le rayon rate (ou part de l'intérieur) : le point le plus proche du centre
  const t = -b
  if (t < 0) return null
  const p = unit([origine[0] + d[0] * t, origine[1] + d[1] * t, origine[2] + d[2] * t])
  return p ? { point: p, limbe: true } : null
}

/** Lat/lon (degrés) d'un vecteur — la convention de `geo.js` : pôle nord +Y, lon 0 vers +Z, 90°E vers +X. */
export function latLonDe(v) {
  if (!vecFini(v)) return null
  const r = norme(v)
  if (!(r > 0)) return null
  return { lat: Math.asin(Math.max(-1, Math.min(1, v[1] / r))) * R2D, lon: Math.atan2(v[0], v[2]) * R2D }
}

/** Le vecteur unitaire d'un lat/lon (degrés) — réciproque de `latLonDe`. */
export function vecteurDe(lat, lon) {
  if (!fini(lat) || !fini(lon)) return null
  const la = lat * D2R, lo = lon * D2R
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}

/**
 * Le repère d'une caméra au NADIR au-dessus de `sousCamera`, à `hauteur`
 * unités-globe, nord en haut à `roulisDeg` près (positif : le haut de l'écran
 * tourne du nord vers l'ouest, la convention d'OrbitControls en espace bloc).
 *
 * @returns {{position:number[], droite:number[], haut:number[], avant:number[]}|null}
 */
export function poseNadir({ sousCamera, hauteur, roulisDeg = 0, rayon = RAYON_TERRE_U } = {}) {
  if (!sousCamera || !fini(sousCamera.lat) || !fini(sousCamera.lon) || !fini(hauteur) || !fini(roulisDeg)) return null
  const up = vecteurDe(sousCamera.lat, sousCamera.lon)
  const position = [up[0] * (rayon + hauteur), up[1] * (rayon + hauteur), up[2] * (rayon + hauteur)]
  // le nord local : la composante de +Y orthogonale à `up` (indéfini aux pôles)
  const nord = unit([-up[0] * up[1], 1 - up[1] * up[1], -up[2] * up[1]])
  if (!nord) return null
  const est = croix(nord, up)
  const cr = Math.cos(roulisDeg * D2R), sr = Math.sin(roulisDeg * D2R)
  // rotation de `roulis` autour de `up` : v cos + (up × v) sin
  const tourne = (v) => { const w = croix(up, v); return [v[0] * cr + w[0] * sr, v[1] * cr + w[1] * sr, v[2] * cr + w[2] * sr] }
  return { position, droite: tourne(est), haut: tourne(nord), avant: [-up[0], -up[1], -up[2]] }
}

/**
 * Le roulis (degrés) d'une pose : l'angle du haut de l'écran contre le nord
 * local, dans la convention de `poseNadir`. Sert à relire la pose RÉELLE de la
 * caméra avant d'itérer sur le modèle.
 */
export function roulisDe({ position, haut } = {}) {
  if (!vecFini(position) || !vecFini(haut)) return 0
  const up = unit(position)
  if (!up) return 0
  const nord = unit([-up[0] * up[1], 1 - up[1] * up[1], -up[2] * up[1]])
  if (!nord) return 0
  const est = croix(nord, up)
  // haut = nord cos r + (up × nord) sin r, et up × nord = −est
  return Math.atan2(-point(haut, est), point(haut, nord)) * R2D
}

/**
 * Le point de la sphère sous le pixel `(px, py)` d'une pose, en trou d'épingle.
 * `fovDeg` est le champ VERTICAL (la convention de three), `aspect = largeur /
 * hauteur`.
 */
export function pointSousLePixel({ pose, fovDeg, aspect, largeurPx, hauteurPx, px, py, rayon = RAYON_TERRE_U } = {}) {
  if (!pose || !fini(fovDeg) || !(aspect > 0) || !(largeurPx > 0) || !(hauteurPx > 0) || !fini(px) || !fini(py)) return null
  const t = Math.tan((fovDeg / 2) * D2R)
  const x = ((px / largeurPx) * 2 - 1) * t * aspect
  const y = -((py / hauteurPx) * 2 - 1) * t
  const direction = [0, 1, 2].map((i) => pose.droite[i] * x + pose.haut[i] * y + pose.avant[i])
  return pointSousLeRayon({ origine: pose.position, direction, rayon })
}

/**
 * Le déplacement du point SOUS LA CAMÉRA qui ramène le point saisi sous le
 * pointeur : `S' = S + (G − D)`, plafonné en angle. UN pas, au premier ordre.
 *
 * @param {object} a
 * @param {{lat:number,lon:number}} a.saisi  `G`, retenu au clic
 * @param {{lat:number,lon:number}} a.sous   `D`, sous le pointeur maintenant
 * @param {number} [a.plafondDeg]
 * @returns {{dLat:number, dLon:number, plafonne:boolean}}
 */
export function pasDeSaisie({ saisi, sous, plafondDeg = PLAFOND_PAS_DEG } = {}) {
  const rien = { dLat: 0, dLon: 0, plafonne: false }
  if (!saisi || !sous || !fini(saisi.lat) || !fini(saisi.lon) || !fini(sous.lat) || !fini(sous.lon)) return rien
  const dLat = saisi.lat - sous.lat
  const dLon = enroulerLon(saisi.lon - sous.lon)
  // la norme se mesure en degrés d'ARC : la longitude compte au cosinus de la latitude
  const cl = Math.cos(((saisi.lat + sous.lat) / 2) * D2R)
  const arc = Math.hypot(dLat, dLon * cl)
  if (!(plafondDeg > 0) || arc <= plafondDeg) return { dLat, dLon, plafonne: false }
  const k = plafondDeg / arc
  return { dLat: dLat * k, dLon: dLon * k, plafonne: true }
}

/**
 * LE déplacement d'une image : itère `pasDeSaisie` sur le modèle `poseNadir`
 * jusqu'à ce que `G` se projette sous le pointeur.
 *
 * `poseReelle` (optionnelle) est la pose de la caméra qui a rendu l'image
 * précédente : le premier `D` s'y lit, et le roulis en est déduit ; les
 * itérations suivantes se font sur le modèle. Sans elle, tout se fait sur le
 * modèle.
 *
 * @returns {{dLat:number, dLon:number, plafonne:boolean, iterations:number, limbe:boolean, residuDeg:number}}
 */
export function deplacementDeSaisie({
  saisi, sousCamera, hauteur, poseReelle = null, roulisDeg = null,
  fovDeg, aspect, largeurPx, hauteurPx, px, py,
  iterations = ITERATIONS_SAISIE, plafondDeg = PLAFOND_PAS_DEG, rayon = RAYON_TERRE_U,
} = {}) {
  const rien = { dLat: 0, dLon: 0, plafonne: false, iterations: 0, limbe: false, residuDeg: 0 }
  if (!saisi || !sousCamera || !fini(sousCamera.lat) || !fini(sousCamera.lon) || !fini(hauteur)) return rien
  const roulis = fini(roulisDeg) ? roulisDeg : poseReelle ? roulisDe(poseReelle) : 0
  const proj = { fovDeg, aspect, largeurPx, hauteurPx, px, py, rayon }
  let s = { lat: sousCamera.lat, lon: sousCamera.lon }
  let total = { dLat: 0, dLon: 0 }
  let plafonne = false, limbe = false, n = 0, residu = Infinity
  for (; n < Math.max(1, iterations); n++) {
    const pose = n === 0 && poseReelle ? poseReelle : poseNadir({ sousCamera: s, hauteur, roulisDeg: roulis, rayon })
    const D = pointSousLePixel({ pose, ...proj })
    if (!D) break
    limbe = limbe || D.limbe
    // hors du disque, il n'y a rien à rejoindre : un pas au rythme du bord, et
    // on n'itère pas (le modèle ne convergerait vers rien)
    const plafondIci = D.limbe ? PLAFOND_LIMBE_DEG : plafondDeg - Math.hypot(total.dLat, total.dLon * Math.cos(s.lat * D2R))
    const pas = pasDeSaisie({ saisi, sous: latLonDe(D.point), plafondDeg: plafondIci })
    residu = Math.hypot(pas.dLat, pas.dLon * Math.cos(s.lat * D2R))
    if (pas.plafonne) plafonne = true
    s = { lat: Math.max(-LAT_MAX_DEG, Math.min(LAT_MAX_DEG, s.lat + pas.dLat)), lon: enroulerLon(s.lon + pas.dLon) }
    total = { dLat: s.lat - sousCamera.lat, dLon: enroulerLon(s.lon - sousCamera.lon) }
    if (plafonne || limbe || residu < 1e-9) { n++; break }
  }
  return { dLat: total.dLat, dLon: total.dLon, plafonne, iterations: n, limbe, residuDeg: residu === Infinity ? 0 : residu }
}

/**
 * Une image d'élan après le relâché : la vitesse (degrés/s) décroît en
 * `exp(−dt/τ)`, et le pas de l'image est l'intégrale exacte sur `dt`.
 *
 * @returns {{pas:{dLat:number,dLon:number}, vitesse:{dLat:number,dLon:number}, fini:boolean}}
 */
export function elanDeSaisie({ vitesse, dt, tau = TAU_ELAN_S, vitesseMin = VITESSE_ELAN_MIN_DEG_S } = {}) {
  const zero = { pas: { dLat: 0, dLon: 0 }, vitesse: { dLat: 0, dLon: 0 }, fini: true }
  if (!vitesse || !fini(vitesse.dLat) || !fini(vitesse.dLon) || !fini(dt) || !(dt > 0) || !(tau > 0)) return zero
  const f = Math.exp(-dt / tau)
  const integrale = tau * (1 - f) // ∫₀^dt exp(−t/τ) dt
  const pas = { dLat: vitesse.dLat * integrale, dLon: vitesse.dLon * integrale }
  const apres = { dLat: vitesse.dLat * f, dLon: vitesse.dLon * f }
  const finiIci = Math.hypot(apres.dLat, apres.dLon) < vitesseMin
  return { pas, vitesse: finiIci ? { dLat: 0, dLon: 0 } : apres, fini: finiIci }
}
