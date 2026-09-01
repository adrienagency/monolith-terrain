// LA BUTÉE QUI TIENT LA CAMÉRA AU-DESSUS DU SOL — Tâche R23.
//
// Module PUR : ni DOM, ni three.js, ni terrain. Testable en node —
// `test/butee-sol.test.js`.
//
// ══════════ CE QUE ÇA REMPLACE, ET CE QUE LA MESURE EN A DIT ════════════════
//
// `main.js` et `modes.js` posaient `controls.maxPolarAngle = Math.PI × 0,49`
// — **88,2°** — et `modes.js` la relâchait à `Math.PI` en orbite. C'est une
// valeur de MODE PLAT : elle dit « ne descends pas sous l'horizon de la cible »,
// et elle ne sait rien du relief ni de la distance.
//
// ⛔ **RELEVÉ AU NAVIGATEUR** (`scripts/sonde-vitesse-r23.mjs`, glissé poussé à
// la butée puis 360° d'azimut EN RESTANT à la butée, `.banc/R23/avant.json`) :
//
//   | bloc z12    | hauteur caméra − sol, minimum | images sous le sol |
//   |-------------|-------------------------------|--------------------|
//   | Mont-Blanc  | **−11,7616 u**                | **450 / 505**      |
//   | Cervin      | −8,6115 u                     | 155 / 504          |
//   | Everest     | **−11,8422 u**                | 173 / 504          |
//
// **La caméra passe SOUS le terrain sur 89 % des images d'un tour au
// Mont-Blanc.** À 365,2 m par unité de bloc, −11,84 u valent **−4 325 m de
// relief dessiné**, soit **−2 163 m de relief réel** (l'exagération unique vaut
// ×2, `zoom-continu.js`). ⚠️ **Les deux chiffres sont publiés** : le premier est
// la profondeur dans la scène, le second ce que ça vaut sur la carte.
//
// ══════════ POURQUOI UNE CONSTANTE NE PEUT PAS MARCHER ══════════════════════
//
// La hauteur de la caméra au-dessus de la cible vaut `d × cos φ`. À la butée,
// `cos(88,2°) = 0,0314` : à `d = 150` la caméra n'est qu'à **4,71 unités**
// au-dessus de la cible, pendant qu'un sommet du bloc en fait **16**. Le nombre
// qui manque à `0,49π` n'est pas un facteur, c'est **`d` et le relief** — la
// butée est une fonction, pas une constante.
//
// ⚠️ **ET C'EST LA CLASSE DE DÉFAUT QUI EST REVENUE NEUF FOIS SUR CE
// CHANTIER** : une constante transportée d'un espace à l'autre sans sa
// conversion. `0,49π` bornait un ANGLE là où la contrainte porte sur une
// HAUTEUR.
//
// ══════════ LA LOI ══════════════════════════════════════════════════════════
//
// On parcourt le chemin que la caméra emprunterait en s'inclinant — à azimut
// constant, `φ` de 0 (l'aplomb) jusqu'à la butée dure — et on s'arrête au
// dernier `φ` dont la caméra reste au-dessus du sol de `marge`.
//
// ⚠️ **ON SUIT LE CHEMIN, ON NE PREND PAS LE MAXIMUM DU BLOC.** Le premier jet
// prenait le sommet du disque de rayon `d` : à `d = 6` (la butée basse) et un
// sommet à 16 unités, il interdisait TOUTE inclinaison — c'est-à-dire qu'il
// supprimait la vue de trois quarts, qui EST le produit. Le sommet d'à côté ne
// gêne pas une caméra qui ne passera jamais dessus.
//
// ⚠️ **LA MARGE DOIT DÉPASSER LE PLAN PROCHE.** `planProche` sature à
// `NEAR_MAX = 0,5` (`loi-altitude.js`) : une marge plus petite laisserait le sol
// traverser le plan de coupe avant de toucher la caméra. `MARGE_SOL_U = 1`,
// soit deux fois le plan proche saturé — c'est de là que vient le nombre.

// la butée DURE : on ne passe jamais sous l'horizon de la cible, relief ou pas.
// C'est la valeur historique de `main.js` et de `modes.js`, gardée comme
// PLAFOND de la loi et non plus comme la loi elle-même.
export const POLAIRE_MAX_DURE = Math.PI * 0.49

// la marge de dégagement, en unités de bloc — voir l'en-tête (2 × NEAR_MAX).
export const MARGE_SOL_U = 1

// le nombre de pas du parcours, AVANT la dichotomie du dernier pas.
//
// ⚠️ **48 ET PAS 24, ET C'EST UNE MESURE QUI L'A IMPOSÉ.** Avec 24 pas, le
// parcours échantillonne le sol tous les ~3 unités à `d = 70` : une crête plus
// étroite que ça passe ENTRE deux points. Le banc l'a attrapé — **−1,1331 u au
// Cervin, sur 1 image de 504** — là où toutes les autres poses étaient
// dégagées. À 48 pas l'écart tombe à ~1,4 unité, sous la marge elle-même.
export const PAS_PARCOURS = 48

// le nombre de points échantillonnés sur le cercle de la cible — voir
// `distanceMinSol`.
export const PAS_CERCLE = 32

const fini = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Le plancher de distance caméra → cible qui garde la caméra au-dessus du sol
 * **même à l'aplomb**.
 *
 * ══════════ POURQUOI UN PLANCHER EN PLUS DE LA BUTÉE D'ANGLE ════════════════
 *
 * ⛔ **PARCE QUE LA CIBLE PEUT ÊTRE ENTERRÉE, ET ELLE L'EST.** `_cibleVisee`
 * (`modes.js`) pose `y = Y_CIBLE = −0,3` — une constante — alors que le sol y
 * monte à 14 unités sur un bloc de montagne. À `d = 6` (la butée basse), la
 * caméra à l'aplomb est donc à `−0,3 + 6 = 5,7`, c'est-à-dire **8 unités sous le
 * terrain**, et AUCUN angle ne l'en sort. Mesuré après le premier correctif
 * (`.banc/R23/apres.json`) : **−5,0982 u au Mont-Blanc sur 504 images de 504**,
 * −5,5263 à l'Everest sur 396 de 504, pendant que toutes les autres distances
 * étaient revenues au-dessus du sol.
 *
 * ══════════ ET POURQUOI LE CERCLE, PAS LE POINT ═════════════════════════════
 *
 * ⚡ **LE PLANCHER DOIT ÊTRE INVARIANT PAR LA ROTATION, SINON IL DÉPENSE
 * D16 ter.** R13 fait tourner la caméra ET la cible autour de l'axe du bloc
 * (`monde/pivot-bloc.js`) : pendant un glissé, la cible SE DÉPLACE. Un plancher
 * lu sous la cible changerait donc à chaque image, `OrbitControls` écrêterait le
 * rayon, et la distance caméra → cible bougerait — c'est exactement le signal
 * que `veille-repos` surveille à `SEUIL_BOUGE_LOG = 1e-4`, et qui arme la
 * bascule de trois quarts.
 *
 * ➡️ **On lit donc le sol sur le CERCLE que la cible décrit autour de l'axe du
 * bloc.** Ce cercle, lui, ne bouge pas d'un millimètre quand on tourne : le
 * plancher est constant sous rotation **par construction**, pas par réglage —
 * même argument, et même forme, que la rotation rigide elle-même.
 *
 * @param {object} a
 * @param {number} a.cibleX `controls.target.x`
 * @param {number} a.cibleY `controls.target.y`
 * @param {number} a.cibleZ `controls.target.z`
 * @param {(x:number, z:number)=>number} a.sol
 * @param {number} [a.plancher] le plancher d'avant (`DISTANCE_MIN_SURFACE`)
 * @param {number} [a.plafond] `controls.maxDistance` — un plancher AU-DESSUS du
 *   plafond mettrait `OrbitControls` en contradiction avec lui-même
 * @param {number} [a.marge]
 * @param {number} [a.pivotX] l'axe du bloc — `PIVOT_BLOC_X` en production
 * @param {number} [a.pivotZ]
 * @param {number} [a.pas]
 * @returns {number}
 */
export function distanceMinSol({
  cibleX = 0,
  cibleY = 0,
  cibleZ = 0,
  sol,
  plancher = 0,
  plafond = Infinity,
  marge = MARGE_SOL_U,
  pivotX = 0,
  pivotZ = 0,
  pas = PAS_CERCLE,
} = {}) {
  const bas = fini(plancher) ? plancher : 0
  // ⚠️ **JAMAIS AU-DESSUS DU PLAFOND.** Aux zooms fins, le relief EN UNITÉS DE
  // BLOC grandit (l'emprise rétrécit à côté constant) : le plancher calculé peut
  // dépasser `maxDistance`, et `OrbitControls` écrête alors le rayon entre deux
  // bornes croisées — la caméra se ferait tirer dans les deux sens. Le plafond
  // gagne : la butée d'angle et le redressement prennent le relais.
  const haut2 = fini(plafond) ? plafond : Infinity
  if (typeof sol !== 'function') return Math.min(bas, haut2)
  const cx = fini(cibleX) ? cibleX : 0
  const cy = fini(cibleY) ? cibleY : 0
  const cz = fini(cibleZ) ? cibleZ : 0
  const px = fini(pivotX) ? pivotX : 0
  const pz = fini(pivotZ) ? pivotZ : 0
  const r = Math.hypot(cx - px, cz - pz)
  const n = Number.isInteger(pas) && pas > 0 ? pas : PAS_CERCLE
  const m = fini(marge) ? marge : MARGE_SOL_U
  let haut = -Infinity
  // ⛔ **LES POINTS SONT À DES ANGLES ABSOLUS, ET LE PREMIER JET PARTAIT DE LA
  // CIBLE.** Un échantillonnage qui tourne AVEC la cible n'est pas invariant :
  // le maximum lu changeait de **0,2500 unité** sur un tour, donc le plancher
  // bougeait, donc le rayon se faisait écrêter, donc la distance caméra → cible
  // bougeait — exactement ce que `veille-repos` surveille. Des angles fixes
  // rendent l'invariance EXACTE : la valeur ne dépend plus que du rayon et de
  // `cibleY`, tous deux invariants par la rotation rigide.
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n
    const h = r > 1e-9 ? sol(px + r * Math.sin(a), pz + r * Math.cos(a)) : sol(cx, cz)
    if (fini(h) && h > haut) haut = h
    if (r <= 1e-9) break
  }
  if (!Number.isFinite(haut)) return Math.min(bas, haut2)
  return Math.min(Math.max(bas, haut + m - cy), Math.max(bas, haut2))
}

/**
 * Le plus grand angle polaire auquel la caméra reste au-dessus du sol.
 *
 * Convention `OrbitControls` : `position = cible + (d·sinφ·sin(az), d·cosφ,
 * d·sinφ·cos(az))`. `φ = 0` est l'aplomb, `φ = π/2` l'horizontale.
 *
 * @param {object} a
 * @param {number} a.distance distance caméra → cible (`controls.getDistance()`)
 * @param {number} [a.cibleX] `controls.target.x`
 * @param {number} [a.cibleY] `controls.target.y`
 * @param {number} [a.cibleZ] `controls.target.z`
 * @param {number} [a.azimut] `controls.getAzimuthalAngle()`
 * @param {(x:number, z:number)=>number} a.sol la hauteur du sol, en unités de bloc
 * @param {number} [a.marge]
 * @param {number} [a.polaireMax] le plafond dur
 * @param {number} [a.pas]
 * @returns {number} l'angle, dans `[0, polaireMax]`
 */
export function polaireMaxSol({
  distance,
  cibleX = 0,
  cibleY = 0,
  cibleZ = 0,
  azimut = 0,
  sol,
  marge = MARGE_SOL_U,
  polaireMax = POLAIRE_MAX_DURE,
  pas = PAS_PARCOURS,
} = {}) {
  // ⚠️ **SANS ÉCHANTILLON, ON REND LE PLAFOND — JAMAIS ZÉRO.** Le manque de
  // mesure et la mesure d'un manque sont deux choses (même règle que
  // `debitObserve` dans `descente-bornee.js`) : un `sol` absent veut dire « on
  // ne sait pas », et clouer la caméra à l'aplomb serait une régression muette.
  if (typeof sol !== 'function' || !fini(distance) || !(distance > 0)) return polaireMax
  if (!fini(polaireMax) || !(polaireMax > 0)) return 0
  const n = Number.isInteger(pas) && pas > 0 ? pas : PAS_PARCOURS
  const m = fini(marge) ? marge : MARGE_SOL_U
  const sa = Math.sin(fini(azimut) ? azimut : 0)
  const ca = Math.cos(fini(azimut) ? azimut : 0)
  const cx = fini(cibleX) ? cibleX : 0
  const cy = fini(cibleY) ? cibleY : 0
  const cz = fini(cibleZ) ? cibleZ : 0
  // ⚠️ un `sol` qui rend n'importe quoi ne doit pas fabriquer une butée : on le
  // traite comme « on ne sait pas », donc on ne bloque pas dessus.
  const degage = (phi) => {
    const r = distance * Math.sin(phi)
    const h = sol(cx + r * sa, cz + r * ca)
    return !fini(h) || cy + distance * Math.cos(phi) >= h + m
  }
  let dernier = 0
  let bute = -1
  for (let k = 0; k <= n; k++) {
    const phi = (polaireMax * k) / n
    if (!degage(phi)) { bute = phi; break }
    dernier = phi
  }
  if (bute < 0) return dernier
  // ══════ ET ON AFFINE LE DERNIER PAS, SINON LA BUTÉE AVANCE PAR MARCHES ═════
  //
  // ⛔ **UNE BUTÉE QUI AVANCE PAR MARCHES EST UN SAUT COMME UN AUTRE.** Sans cet
  // affinage, la valeur rendue est un point de la grille : quand la distance
  // glisse, l'indice retenu tombe d'un cran d'un coup et `OrbitControls` ramène
  // `φ` d'autant en UNE image. Mesuré sur la grille nue, relief de bloc :
  // **14,700° en une image** (quatre pas de 3,675°), là où R4 plafonne le
  // balayage de pose à 1,5°. La dichotomie rend la butée continue.
  let bas = dernier
  let haut = bute
  for (let i = 0; i < 14; i++) {
    const mid = (bas + haut) / 2
    if (degage(mid)) bas = mid
    else haut = mid
  }
  return bas
}
