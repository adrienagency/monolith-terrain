// LE PIVOT DE LA ROTATION SUR LE BLOC — Tâche R13.
//
// Module PUR : ni DOM, ni three.js. Testable en node — `test/pivot-bloc.test.js`.
//
// ══════════ LA DEMANDE, ET CE QUE LA MESURE EN A FAIT ══════════════════════
//
// > **Adrien :** *« Le comportement de la rotation de la vue autour de la Terre
// > est parfait en mode orbital. Peut-on appliquer celui-là jusqu'au mode
// > crop ? »*
//
// ⛔ **CE N'EST PAS LA VITESSE, ET C'ÉTAIT L'HYPOTHÈSE ÉVIDENTE.** Relevé sur un
// glissé de 100 px, écran 1280×800 (`.banc/R13/avant.json`) :
//
//   | régime                   | rotateSpeed | azimut par pixel |
//   |--------------------------|-------------|------------------|
//   | orbite, 60 000 km        | 1           | **0,447079 °/px**|
//   | orbite, 10 000 km        | 1           | 0,447753 °/px    |
//   | orbite, 1 000 km         | 0,219746    | 0,098919 °/px    |
//   | orbite, 40 km            | 0,015       | 0,006716 °/px    |
//   | **le bloc**              | **1**       | **0,447079 °/px**|
//
// **Le même nombre aux deux bouts.** Les deux régimes emploient le MÊME
// `OrbitControls` et la même loi (`2π·dx/hauteur·rotateSpeed`) ; là où Adrien
// juge le geste « parfait » — l'orbite haute, celle où l'on tourne vraiment
// autour de la Terre — `rotateSpeed` vaut 1 des deux côtés.
//
// ⚡ **CE QUI DIFFÈRE, C'EST LA CIBLE.** En orbite, `controls.target = (0, 0, 0)` :
// le CENTRE de l'objet regardé. La Terre reste plantée au milieu du cadre quoi
// qu'on fasse — c'est ça, « tourner autour d'elle ». Sur le bloc, la cible est
// le point VISÉ, qui se décentre au premier déplacement. Mesuré, cible à
// 21,3 unités de l'axe du bloc (`.banc/R13/cibles.json`) :
//
//   | pivot                       | dérive du centre du bloc à l'écran |
//   |-----------------------------|------------------------------------|
//   | le point visé (avant R13)   | **68,324 px** pour 100 px de souris |
//   | l'axe du bloc, au sol       | **0,001 px**                        |
//   | l'axe du bloc, centre volume| **0,000 px**                        |
//   | le point sous le curseur    | **130,467 px**                      |
//
// ══════════ POURQUOI UNE ROTATION *RIGIDE*, ET PAS UNE CIBLE DÉPLACÉE ══════
//
// ⛔ **ÉCRIRE `controls.target` AU CENTRE DU BLOC EST INTERDIT.** `veille-repos.js`
// surveille `|Δ ln(distance caméra→cible)|` avec `SEUIL_BOUGE_LOG = 1e-4`, et
// c'est ce signal qui arme la bascule de trois quarts de D16 ter
// (`veilleCrop.repos` = crop posé ET vue au repos). Déplacer la cible sur l'axe
// du bloc produit, sur la pose relevée, **6,608e-3 — soit 66 fois le seuil**
// (171 × pour le centre du volume, 615 × pour le point sous le curseur). La
// bascule tomberait ailleurs, et D16 ter est acquis à 0,000 057° d'inclinaison
// sur 971 images. **On ne dépense pas ça pour une sensation.**
//
// ➡️ **ON FAIT DONC TOURNER LA CAMÉRA *ET* LA CIBLE ENSEMBLE**, autour de l'axe
// vertical du bloc. La distance caméra→cible devient invariante **par
// construction** — pas par réglage — et `veille-repos` ne voit rigoureusement
// rien.
//
// L'algèbre tient en une ligne, et c'est elle qui rend la chose si simple :
//
//     rot(P, d)(X) − rot(T, d)(X) = (I − Ry(d))·(P − T)
//
// Le membre de droite **ne dépend pas de `X`**. Corriger une rotation faite
// autour de la cible `T` en une rotation faite autour du pivot `P`, c'est donc
// ajouter **le même vecteur** à la caméra et à la cible : une TRANSLATION.
// D'où l'invariance de la distance, et d'où le fait que ce module n'a besoin de
// connaître ni la caméra, ni la scène, ni three.js.
//
// ══════════ TROIS LIMITES ASSUMÉES, ÉCRITES ICI PARCE QU'ELLES SE PAIENT ═══
//
// ⚠️ **① L'AXE EST VERTICAL, ET SEULEMENT VERTICAL.** Une rotation rigide autour
// d'un axe horizontal ferait passer la cible SOUS le terrain et pencher
// l'horizon. L'élévation (l'angle polaire) reste donc prise autour de la cible,
// comme avant R13. ⚡ Conséquence utile : le `y` du pivot n'entre nulle part, et
// le choix « centre au sol » contre « centre du volume » devient sans objet —
// c'est ce que la mesure montre déjà (0,001 px contre 0,000 px).
//
// ⚠️ **② LE PIVOT EST L'ORIGINE DE LA GÉOMÉTRIE, PAS UN POINT GÉOGRAPHIQUE.** En
// mode continu, la fenêtre 3×3 glisse mais **la géométrie ne bouge pas** : c'est
// la LECTURE qui se décale de `terrain.fenetre` (voir `pointUnder` et
// `chargeCartouche` dans `main.js`). Le centre du bloc À L'ÉCRAN est donc
// toujours `(0, ·, 0)` en géométrie. ⛔ **Ne pas y ajouter `terrain.fenetre`** :
// ce serait la faute inverse de celle que l'escalier de zoom avait commise.
//
// ⚠️ **③ ÇA NE SUPPRIME PAS LE SAUT DE VITESSE AU FRANCHISSEMENT.** Mesuré :
// `rotateSpeed` passe de **0,015 à 1 en une image** quand la traversée pose le
// mode surface — un facteur **66,67**, et le geste passe de 0,006716 à
// 0,447079 °/px. **Ce saut préexiste à R13 et R13 n'y touche pas** : il est
// consigné dans le rapport, pas corrigé ici (voir la réserve n° 1).

/**
 * L'axe vertical du bloc, en coordonnées de GÉOMÉTRIE.
 *
 * ⚠️ `(0, 0)` et pas `controls.target` : c'est toute la tâche. Le bloc
 * (`TERRAIN_SIZE = 56`, `terrain.js`) est centré sur l'origine de la géométrie.
 */
export const PIVOT_BLOC_X = 0
export const PIVOT_BLOC_Z = 0

const fini = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * L'angle dont l'azimut a tourné entre deux images, SANS enroulement.
 *
 * ⚠️ `getAzimuthalAngle()` rend un angle sur ]−π, π]. Une rotation qui franchit
 * ±π rendrait, en soustraction naïve, un delta de près de 2π — c'est-à-dire une
 * correction de pivot de 360° dans une seule image, un saut de la classe même
 * que la campagne vient de supprimer.
 *
 * @param {number} avant azimut lu avant `controls.update()`
 * @param {number} apres azimut lu après
 * @returns {number} le delta signé, dans ]−π, π]
 */
export function deltaAzimut(avant, apres) {
  if (!fini(avant) || !fini(apres)) return 0
  let d = apres - avant
  while (d > Math.PI) d -= 2 * Math.PI
  while (d <= -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * Le décalage à ajouter À LA FOIS à la caméra et à la cible pour convertir la
 * rotation qu'`OrbitControls` vient de faire autour de la cible en la même
 * rotation faite autour de l'axe vertical du bloc.
 *
 * `δ = (I − Ry(d))·(P − T)` — voir l'en-tête pour l'identité qui le justifie.
 *
 * ⚠️ **`y` VAUT TOUJOURS 0**, et ce n'est pas une commodité : `Ry` laisse la
 * composante verticale intacte, donc `(I − Ry)` l'annule. C'est la garantie que
 * tourner autour du bloc n'ajoute pas un mètre d'altitude — le défaut « +32,6 %
 * d'altitude parasite » que D16 ter laisse ouvert ne peut pas revenir par ici.
 *
 * @param {object} a
 * @param {number} a.cibleX `controls.target.x`
 * @param {number} a.cibleZ `controls.target.z`
 * @param {number} a.angle le delta d'azimut, en radians (voir `deltaAzimut`)
 * @param {number} [a.pivotX] l'axe du bloc — paramétré pour le test, jamais en production
 * @param {number} [a.pivotZ]
 * @returns {{x:number, y:number, z:number}}
 */
export function decalagePivot({ cibleX, cibleZ, angle, pivotX = PIVOT_BLOC_X, pivotZ = PIVOT_BLOC_Z } = {}) {
  const nul = { x: 0, y: 0, z: 0 }
  if (!fini(cibleX) || !fini(cibleZ) || !fini(angle) || !fini(pivotX) || !fini(pivotZ)) return nul
  if (angle === 0) return nul
  const ux = pivotX - cibleX
  const uz = pivotZ - cibleZ
  if (ux === 0 && uz === 0) return nul // la cible est déjà sur l'axe : rien à corriger
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  // (I − Ry(d))·u, avec Ry(d)·u = (ux·cos + uz·sin, uy, −ux·sin + uz·cos)
  return {
    x: ux - (ux * c + uz * s),
    y: 0,
    z: uz - (-ux * s + uz * c),
  }
}
