// LE PIVOT EN OBLIQUE — LE FRANCHISSEMENT NE DÉPLACE PAS LA CAMÉRA (Tâche OBL)
//
// Module PUR : ni DOM, ni three.js, ni globe. Tout se vérifie sous node
// (`test/pivot-oblique.test.js`). Même patron que `zoom-continu.js` et
// `frontiere-rendu.js` : la RÈGLE vit ici, la plomberie reste dans `modes.js`
// (`_suivreEmprise`, `_rescale`, `cranZoom`) et `main.js` (le crochet
// `similitudeBloc`).
//
// ══════════ LE DÉFAUT, MESURÉ AU GESTE (rapport-OBL.md) ═════════════════════
//
// > **Adrien (D19) :** *« quand je scrolle pour zoomer ou dézoomer, je scrolle
// > vers le point visé au centre de l'écran. »*
// > **Adrien :** *« Au zoom, la terre se décale, comme visible dans la vidéo. »*
//
// À 45° d'inclinaison, La Réunion, vingt crans de molette au centre de l'écran :
// **à l'intérieur d'un niveau, le point rendu sous le centre ne bouge pas
// (0,2 px)** — le zoom vise bien `_zoomPivot`, le point du cadre. **Au
// franchissement, il saute de 324 / 199 / 180 px** (z11→z12→z13→z14), avec une
// excursion de 491 à 753 px pendant le glissé qui suit. Au nadir : 0 px.
//
// ⚠️ **LA HAUTEUR RENDUE DU RELIEF, ELLE, NE CHANGE PAS D'UN NIVEAU À L'AUTRE**
// — Piton de la Fournaise dessiné à 2 239 m (z11, z12) et 2 237 m (z13, z14),
// rayon du maillage lu par lancer de rayon. L'hypothèse « le relief est
// ré-échelonné par niveau » (rapport-VID3, cause 2) est RÉFUTÉE : ce que
// `terrain.sample` rendait de différent (3 303 / 2 144 / 2 039 / 1 010 m) est
// le BLOC, dont le plan `y = 0` est la MOYENNE du bloc (`appliquerHauteurs`,
// `fenetre-bornee.js`) — une moyenne qui change à chaque emprise, et un bloc
// invisible sous « terre unique ». Le relief dessiné est le globe.
//
// ══════════ LA CAUSE : LE BLOC CHANGE DE REPÈRE, LA CAMÉRA NE SUIT QU'EN `y` ═
//
// La caméra vit dans le repère du BLOC (56 unités de côté, plan `y = 0` à la
// moyenne du bloc). Ce qu'on voit est dessiné par `camGlobe`, image du bloc par
// la similitude de `frontiere-rendu.js` (`poseFond`) :
//
//     G(p) = haut · rayonAncre(moyenneM) + k · R · (p − origine)
//
// et TROIS de ses termes changent au franchissement : `k` (l'emprise est
// divisée par deux), `rayonAncre` (la moyenne du nouveau bloc n'est pas celle
// de l'ancien : −727 m → +426 m → +351 m → +630 m à La Réunion, z11 → z14) et
// `R` (le bloc est recalé sur la grille de tuiles). Or `_suivreEmprise` ne
// convertissait que `camera.y` par le rapport des emprises, et `_rescale`
// reposait la cible à `Y_CIBLE = −0,3` sous une caméra dont la DIRECTION était
// gardée : la caméra physique — celle de `camGlobe` — se déplaçait, et le point
// du cadre avec elle. Et `_zoomPivot`, exprimé dans l'ancien repère, restait
// tel quel : le glissé qui suivait zoomait vers un point qui n'existait plus.
//
// ══════════ LA RÈGLE : L'INVARIANT EST LA POSE PHYSIQUE ═════════════════════
//
// Quand le bloc change de repère — emprise, moyenne, exagération, calage —,
// la caméra, la cible et le pivot sont RÉEXPRIMÉS dans le nouveau repère de
// sorte que leur image par la similitude ne bouge pas :
//
//     p' = G'⁻¹(G(p))
//
// `camGlobe` est alors identique au bit près avant et après (à l'arrondi
// flottant près), donc l'image aussi. C'est la seule conversion qui rende
// « aucun saut » exact : l'altitude de fond (`camY × emprise`) n'en était que
// la projection sur `y`, juste quand la moyenne et le calage ne bougeaient pas.

import { repereGlobe, facteurEchelle, rayonAncre } from './frontiere-rendu.js'

/**
 * La similitude bloc → globe, et sa RÉCIPROQUE — les mêmes termes que
 * `poseFond` (`frontiere-rendu.js`), lus sur le même couple d'entrées.
 *
 * ⚠️ **`origine` NE PORTE QUE x ET z** : le plan `y = 0` du bloc est ce qui se
 * pose au rayon de l'ancre — exactement la convention de `majCameraFond`
 * (`origineBloc: [x, 0, z]`). L'ancre est l'aplomb de l'origine : `lat`/`lon`
 * DOIVENT être `latLonDuBloc(origine)` dans le repère décrit, sans quoi la
 * similitude pose la planète ailleurs que là où le GPU la dessine.
 *
 * @param {{lat:number, lon:number, origine?:number[], altitudeAncreM?:number,
 *   exageration?:number, extentMeters:number, span:number}} arg
 * @returns {{k:number, rayon:number, versGlobe:(p:number[])=>number[],
 *   versBloc:(P:number[])=>number[]}|null} `null` si l'échelle est inutilisable
 */
export function similitudeBloc({ lat, lon, origine = [0, 0], altitudeAncreM = 0, exageration = 1, extentMeters, span } = {}) {
  const k = facteurEchelle({ extentMeters, span })
  if (!(k > 0) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const { est, haut, sud } = repereGlobe(lat, lon)
  const rayon = rayonAncre({ altitudeAncreM, exageration })
  const ox = Number(origine?.[0]) || 0
  const oz = Number(origine?.[1] ?? origine?.[2]) || 0
  const versGlobe = (p) => {
    const bx = p[0] - ox
    const by = p[1]
    const bz = p[2] - oz
    return [0, 1, 2].map((i) => haut[i] * rayon + k * (bx * est[i] + by * haut[i] + bz * sud[i]))
  }
  // `R` est orthonormée directe (test de `frontiere-rendu`) : son inverse est
  // sa transposée — on projette sur les trois axes de la base locale.
  const versBloc = (P) => {
    const dx = P[0] - haut[0] * rayon
    const dy = P[1] - haut[1] * rayon
    const dz = P[2] - haut[2] * rayon
    const sur = (v) => (dx * v[0] + dy * v[1] + dz * v[2]) / k
    return [sur(est) + ox, sur(haut), sur(sud) + oz]
  }
  return { k, rayon, versGlobe, versBloc }
}

/**
 * L'EMPREINTE d'un repère de bloc — ce qui, en changeant, oblige à transporter.
 *
 * ⚠️ **PAS L'ORIGINE** : l'origine est l'ancre choisie pour ÉCRIRE la
 * similitude (l'aplomb de la cible, qui glisse à chaque image de zoom), pas une
 * propriété du bloc. Deux similitudes de même bloc et d'origines différentes
 * décrivent la même planète.
 *
 * @param {{extentMeters:number, altitudeAncreM?:number, exageration?:number,
 *   latOrigine?:number, lonOrigine?:number}} p
 * @returns {string}
 */
export function empreinteRepere(p) {
  if (!p) return ''
  const n = (v) => (Number.isFinite(v) ? v.toPrecision(12) : '·')
  return `${n(p.extentMeters)}|${n(p.altitudeAncreM)}|${n(p.exageration)}|${n(p.latOrigine)}|${n(p.lonOrigine)}`
}

/**
 * Transporte une pose d'un repère de bloc à un autre, IMAGE INVARIANTE :
 * pour chaque point `p`, `simApres.versGlobe(p') = simAvant.versGlobe(p)`.
 *
 * @param {{simAvant:object, simApres:object, points:Object<string, number[]|null>}} arg
 * @returns {Object<string, number[]|null>} les mêmes clés, transportées
 *   (`null` traverse : un pivot absent reste absent)
 */
export function transporterPose({ simAvant, simApres, points }) {
  const out = {}
  for (const [k, p] of Object.entries(points || {})) {
    out[k] = Array.isArray(p) && p.length === 3 && p.every(Number.isFinite) ? simApres.versBloc(simAvant.versGlobe(p)) : null
  }
  return out
}

/**
 * Le cran ×f AUTOUR D'UN PIVOT : la caméra et la cible sont homothétiques de
 * centre `pivot`, donc le pivot reste immobile à l'écran (D19, règle 2). C'est
 * l'identité de `_applyZoom` (R29 bis) :
 *
 *     T + (C − T)·f + (1 − f)(P − T) = P + (C − P)·f
 *
 * @param {{pivot:number[], camera:number[], cible:number[], facteur:number}} arg
 * @returns {{camera:number[], cible:number[]}}
 */
export function cranAutourDuPivot({ pivot, camera, cible, facteur }) {
  const f = Number(facteur)
  const h = (p) => [0, 1, 2].map((i) => pivot[i] + (p[i] - pivot[i]) * f)
  return { camera: h(camera), cible: h(cible) }
}
