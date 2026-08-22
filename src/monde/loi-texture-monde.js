// LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
// (`test/loi-texture-monde.test.js`).
//
// ══════════ 0. CE QUE CE MODULE RÉPARE, ET LA MESURE QUI LE FONDE ══════════
//
// Le nuanceur de fragment du globe écrit une partie de sa loi de couleur **en
// espace-tuile** : `vUv` va de 0 à 1 quelle que soit l'étendue au sol, et
// `uTilePx` vaut 256 ou 512 SELON LA TUILE. Deux tuiles voisines de niveaux
// différents rendent donc deux lois différentes, et la frontière se lit comme
// une **arête droite** séparant un champ plat d'un champ texturé.
//
// ⚠️ **CE N'EST PAS UNE DÉDUCTION, C'EST UNE MESURE.** Étape 1 de la Tâche K,
// banc A/B côté GPU (on gèle un terme, on compte les pixels qui CHANGENT ;
// témoin deux rendus consécutifs = 0 pixel, et le banc n'est pas inerte
// puisque les variantes, elles, changent des centaines de milliers de pixels) :
//
//   La Réunion, altitude 22,8 km, même cible, même jeu de tuiles, fov 33 lu en
//   direct, cadre 1088 × 731, grain de pellicule et vignette mis à 0.
//
//     terme gelé                    nadir (polaire 8°)   isométrique (55°)
//     minFade → 1                        23,5 %                41,0 %
//     grain désindexé de vUv             42,0 %                28,8 %
//     empreinte de decodeMetersAA → 0     1,9 %                 1,8 %
//     crowd → 1                           0,05 %                0,21 %
//
//   Et sur la planète rendue OPAQUE (`uEstompage = 0`, qui retire l'artefact de
//   transparence de l'estompage), la surface PLATE de l'image (écart-type local
//   3×3 sous 1,2/255) tombe de **38,4 % à 24,9 %** au nadir et de **36,0 % à
//   14,3 %** en isométrique quand on gèle `minFade` : c'est lui, et lui seul,
//   qui fabrique les champs plats. Le grain touche plus de pixels mais avec une
//   amplitude neuf à douze fois plus faible (3,7/255 contre 33 à 43/255) et il
//   ne change PAS la fraction plate (0,3838 → 0,3835).
//
// ⚠️ **ET LA PART DE `minFade` GRANDIT AVEC L'INCLINAISON** : à altitude
// IDENTIQUE, basculer de 8° à 55° la fait passer de 23,5 % à 41,0 % de l'image.
// C'est la dépendance à l'angle qu'Adrien décrit (« en top-down du vert
// partout ; en isométrique une texture avec de l'aliasing »).
//
// ══════════ 1. LES SEPT `fwidth` DU NUANCEUR, ET LEQUEL EST EN CAUSE ═══════
//
// `fwidth` mesure une variation PAR PIXEL D'ÉCRAN. Ce n'est pas un défaut en
// soi : une largeur de trait DOIT se mesurer en pixels, sinon le trait s'épaissit
// au loin. Ce qui fait une arête, c'est de mesurer en **espace-tuile**.
//
//   · `decodeMetersAA` (`fwidth(uv)`) — ⚠️ écrit en espace-tuile, MAIS
//     `fwidth(uv) × étendueAuSolDeLaTuile` est l'empreinte du pixel **en mètres
//     de sol**, la même quel que soit le niveau : l'expression est locale, la
//     grandeur ne l'est pas. Mesuré : 1,8 à 1,9 % de l'image. **Laissé tel quel.**
//   · la bordure du crop (`fwidth(d)`) — `d` est en unités de crop, monde.
//   · l'anticrénelage de côte (`fwidth(landness)`) — `landness` vient d'un champ
//     CUIT indexé sur `qCrop`, monde. ⚠️ Le commentaire du dépôt dit que la garde
//     est un uniforme, donc que la dérivée est définie : **vérifié, il a raison,
//     et rien n'est touché là.**
//   · la largeur des courbes mineures et majeures (`fwidth(ch)`, `fwidth(ch5)`) —
//     `ch = h / intervalle`, donc des MÈTRES par pixel d'écran. Monde.
//   · le graticule (`fwidth(g)`) — `g = vLatLon / 10`, monde.
//   · ⛔ **`minFade` (`fwidth(vUv) × uTilePx`) — LE SEUL qui reste en
//     espace-tuile de bout en bout**, parce que ni `vUv` ni `uTilePx` ne sont
//     ramenés au sol. C'est celui que ce module remplace.
//
// ══════════ 2. LA GRANDEUR D'ANCRAGE : MÈTRES DE SOL PAR PIXEL D'ÉCRAN ═════
//
// Une caméra en perspective voit, à la distance `d`, une hauteur de
// `2 d tan(fov/2)` ; répartie sur `hauteurPx` pixels, cela fait
// `2 d tan(fov/2) / hauteurPx` unités de scène par pixel. Multiplié par les
// mètres par unité de globe, c'est **le mètre de sol par pixel d'écran**.
//
// ⚠️ **ELLE NE DÉPEND QUE DE LA DISTANCE**, donc ni du niveau de la tuile
// (pas d'arête) ni de l'inclinaison de la caméra (même loi en nadir et en
// isométrique). C'est exactement le critère de sortie demandé.
//
// ⚠️ **ET LE `fov` SE LIT EN DIRECT.** Le §0 du plan est formel : le code dit
// 30, l'application vivante tourne à 33 parce qu'un template repose
// `params.fov`. Ce module ne connaît aucun fov par défaut : il le REÇOIT.

import { ORBITAL_M_PER_UNIT } from '../geo.js'
import { ZOOM_SOCLE } from './seuil-socle.js'
// ⚠️ **LA CIRCONFÉRENCE VIENT DE `habillage-crop.js`, ELLE N'EST PAS RÉÉCRITE.**
// Le dépôt la porte déjà (40 075 016,686 — la circonférence WGS84, celle du
// pavage Web-Mercator, PAS 2π × `EARTH_RADIUS_M` qui vaut 0,11 % de moins). Une
// seconde écriture aurait divergé de la première dès le premier chiffre, et
// c'est la cicatrice que `terrain.js` documente déjà.
import { CIRCONFERENCE_M } from './habillage-crop.js'

const D2R = Math.PI / 180

/**
 * Mètres de sol par pixel d'écran, PAR UNITÉ de distance caméra.
 *
 * Le nuanceur multiplie ce facteur par la distance caméra du fragment
 * (`vDistCam`, en unités de globe) et obtient les mètres de sol par pixel.
 *
 * ⚠️ **REND 0 SI UNE ENTRÉE EST ABSURDE**, et 0 est la valeur qui dit au
 * nuanceur « loi non posée, garde celle du dépôt ». C'est le patron
 * `aussi: null` de la Tâche J : on élargit sans changer le défaut.
 */
export function facteurMppParUnite({ fovDeg, hauteurPx, metresParUnite = ORBITAL_M_PER_UNIT } = {}) {
  if (!(fovDeg > 0) || !(fovDeg < 180)) return 0
  if (!(hauteurPx > 0)) return 0
  if (!(metresParUnite > 0)) return 0
  return (2 * Math.tan((fovDeg * D2R) / 2) * metresParUnite) / hauteurPx
}

// ══════════ 3. LA RÉSOLUTION DE RÉFÉRENCE ══════════════════════════════════
//
// `minFade` compare les mètres de sol par pixel d'écran à une résolution de
// DONNÉE. Aujourd'hui c'est celle de LA TUILE — d'où l'arête. Il faut une
// résolution qui soit une propriété du MONDE, pas de la tuile.
//
// ⚠️ **CELLE DU SOCLE, ET C'EST UN CHOIX QUI A UNE SOURCE.** `ZOOM_SOCLE = 13`
// est le zoom auquel le bloc est défini dans tout le produit
// (`seuil-socle.js`) ; `TUILE_REF_PX = 256` est le côté des tuiles AWS, la
// source qui couvre TOUJOURS (`planTuile` : sous le plancher de la source fine
// et hors de sa couverture, on retombe sur AWS). La règle se lit donc :
// **les courbes de niveau restent tant que l'écran résout la donnée du socle.**
//
// ⚠️ **UN SEUL NIVEAU, PAS CELUI DE LA TUILE COURANTE, ET SURTOUT PAS UNE
// RE-MESURE PAR POSE** : c'est précisément la re-mesure par pose qui donne à la
// mer une couleur différente à chaque altitude (voir les réserves du rapport K).
export const TUILE_REF_PX = 256

/**
 * Mètres de sol par texel de la donnée de référence, à une latitude donnée.
 *
 * Web-Mercator : un degré de longitude vaut `cos(lat)` fois moins de sol qu'à
 * l'équateur, et c'est cette largeur-là que la tuile couvre.
 */
export function resolutionRefM({ lat = 0, zoom = ZOOM_SOCLE, tuilePx = TUILE_REF_PX } = {}) {
  if (!Number.isFinite(lat)) return 0
  if (!(zoom >= 0) || !(tuilePx > 0)) return 0
  const cos = Math.cos(Math.min(Math.abs(lat), 85.05112878) * D2R)
  return (CIRCONFERENCE_M * cos) / (2 ** zoom * tuilePx)
}

// ══════════ 4. LE GRAIN DE PAPIER ══════════════════════════════════════════
//
// Le dépôt indexe le grain sur `vUv * 941.7`, c'est-à-dire **941,7 cellules par
// côté de tuile**, quelle que soit l'étendue au sol de la tuile. La fréquence du
// grain est donc inversement proportionnelle à la taille de la tuile : à la
// frontière de niveaux, le grain double de taille d'un coup.
//
// ⚠️ **LA CONSTANTE DE REMPLACEMENT SE DÉRIVE, ELLE NE SE POSE PAS.** À la
// condition de référence de `minFade` — un texel de donnée pour un pixel
// d'écran — une tuile de `TUILE_REF_PX` texels occupe `TUILE_REF_PX` pixels, et
// les 941,7 cellules du dépôt s'y répartissent : **941,7 / 256 = 3,678 cellules
// par pixel d'écran**. On garde ce chiffre-là, et le grain garde donc SON grain
// — c'est son ancrage qui change, pas son apparence.
//
// ⚠️ **ET IL RESTE ACCROCHÉ AU SOL, PAS À L'ÉCRAN.** `terrain.js` (étude 5.4)
// documente le moirage qu'Adrien a attrapé à l'œil quand un grain est évalué en
// coordonnées d'écran : il reste collé pendant que le relief défile. Ici la
// coordonnée est le MÈTRE DE SOL absolu ; seule sa mise à l'échelle suit la
// distance, exactement comme aujourd'hui elle suit le niveau de la tuile — à
// ceci près qu'elle la suit sans marche.
export const GRAIN_CELLULES_PAR_TUILE = 941.7
export const GRAIN_PAR_PIXEL = GRAIN_CELLULES_PAR_TUILE / TUILE_REF_PX

// Mètres de sol par degré de latitude. Sert au nuanceur à convertir `vLatLon`
// en mètres absolus. ⚠️ Dérivé de `CIRCONFERENCE_M`, comme tout le reste.
export const METRES_PAR_DEGRE = CIRCONFERENCE_M / 360

/**
 * La coordonnée du grain, en CELLULES, pour un point du globe.
 *
 * ⚠️ **C'EST LE JUMEAU JS DES DEUX LIGNES `grainX` / `grainY` DU NUANCEUR**, et
 * `test/loi-texture-monde.test.js` EXTRAIT ces deux lignes du GLSL puis les
 * exécute contre cette fonction. Une transcription qui divergerait — un
 * `cos` oublié, un facteur inversé — fait tomber une VALEUR, pas une chaîne.
 *
 * ⚠️ **LE `cos(lat)` N'EST PAS DÉCORATIF** : sans lui, un degré de longitude
 * vaudrait autant de mètres au pôle qu'à l'équateur et le grain s'étirerait en
 * bandes horizontales en montant vers les hautes latitudes.
 */
export function coordonneeGrain({ lat, lon, mppEcran, grainParPixel = GRAIN_PAR_PIXEL } = {}) {
  const k = (METRES_PAR_DEGRE / Math.max(mppEcran, 1e-3)) * grainParPixel
  return [lon * Math.cos(lat * D2R) * k, lat * k]
}

/**
 * Le paquet complet que `Globe.poserLoiMonde` étale dans les uniformes.
 *
 * ⚠️ **REND `null` SI LE FACTEUR EST NUL** — l'appelant repose alors 0 et le
 * nuanceur reprend la loi du dépôt, au bit près.
 */
export function loiTextureMonde({ fovDeg, hauteurPx, lat = 0, metresParUnite } = {}) {
  const mppFacteur = facteurMppParUnite({ fovDeg, hauteurPx, metresParUnite })
  if (!(mppFacteur > 0)) return null
  const resRefM = resolutionRefM({ lat })
  if (!(resRefM > 0)) return null
  return { mppFacteur, resRefM, grainParPixel: GRAIN_PAR_PIXEL, metresParDegre: METRES_PAR_DEGRE }
}
