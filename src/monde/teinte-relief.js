// LA TEINTE PAR SOMMET DU BLOC, SORTIE DE `_ecrireRelief` — Tâche FLU, poste ④.
//
// ⚠️ **C'EST LE POSTE LE PLUS CHER DU RAFFINEMENT PAR TUILE, ET IL NE DÉCIDE DE
// RIEN.** Mesuré sur la descente vers Chamonix, CPU ×4
// (`.banc/PA/budget-base-x4-vsync.json`, profil V8) : `natGris` **1 118 ms** de
// temps propre + la boucle qui l'appelle, sur 14,8 s de descente — deux
// `Math.pow` par sommet, 148 225 sommets à res 384 et 591 361 à res 768, rejoués
// à CHAQUE tuile qui atterrit (`socleRaffine` → `rafraichirFenetre`). Or la
// couleur n'est lue que par le GPU : rien sur le fil principal n'attend son
// résultat. Elle peut donc se calculer AILLEURS et arriver une image plus tard.
//
// Ce module est PUR (ni DOM, ni three) : c'est ce qui l'autorise à tourner dans
// le Worker de terrain (`terrain-jobs.js`, `kind: 'teinte'`) ET sur le fil
// principal en repli — la MÊME fonction, donc le MÊME octet. `test/teinte-relief
// .test.js` verrouille l'identité bit à bit avec la boucle d'origine.
//
// ⚠️ **LA LOI EST DANS `eclairage-crop.js` (`natGris`) ET LE GRAIN DANS
// `detail-noise.js` (`tintField`)** — ce fichier n'écrit aucune formule, il ne
// fait que les composer, exactement comme `_ecrireRelief` le faisait en ligne :
// `v = natGris(hn, ny) + tint[i] · 0,05`, en double, rangé en Float32.

import { natGris } from './eclairage-crop.js'
import { tintField } from '../detail-noise.js'

/**
 * Les couleurs par sommet, `count × 3` (gris répété sur R, G, B).
 *
 * @param {object} arg
 * @param {Float32Array} arg.y        les altitudes des `count` premiers sommets (unités de scène)
 * @param {Float32Array} arg.ny       la composante Y de la normale de chacun
 * @param {number} arg.count          `(res+1)²` — la nappe, jamais la jupe
 * @param {number} arg.minH
 * @param {number} arg.maxH
 * @param {number} arg.seedTeinte     `params.seed + 101`, déjà décalée par l'appelant
 * @param {number} arg.res
 * @param {number} arg.size           `TERRAIN_SIZE`
 * @param {Float32Array} [arg.out]    tampon de sortie (≥ count × 3), alloué sinon
 * @returns {Float32Array}
 */
export function couleursRelief({ y, ny, count, minH, maxH, seedTeinte, res, size, out = null }) {
  const tint = tintField(seedTeinte, res, size)
  const colors = out || new Float32Array(count * 3)
  // ⚠️ MOT POUR MOT `_ecrireRelief` : le même `span`, le même `hn`, le même
  // `Math.max(0, …)` dans `natGris`, la même composition. Un seul signe qui
  // diverge et la teinte du bloc change au dernier bit sur une partie des
  // sommets — le test le verrait, l'œil non, et c'est justement pour ça qu'on
  // ne réécrit pas.
  const span = Math.max(1e-5, maxH - minH)
  for (let i = 0; i < count; i++) {
    const hn = (y[i] - minH) / span
    let v = natGris(hn, ny[i])
    v += tint[i] * 0.05
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
  }
  return colors
}

/**
 * Extrait de la géométrie entrelacée ce que `couleursRelief` lit : `y` et la
 * composante Y des normales, en deux tableaux compacts — c'est ce qui voyage
 * vers le Worker (deux copies de `count` flottants, pas la géométrie entière).
 *
 * @param {Float32Array} position  X/Y/Z entrelacés
 * @param {Float32Array} normal    X/Y/Z entrelacés
 * @param {number} count
 */
export function extraireYNy(position, normal, count) {
  const y = new Float32Array(count)
  const ny = new Float32Array(count)
  for (let i = 0, k = 1; i < count; i++, k += 3) {
    y[i] = position[k]
    ny[i] = normal[k]
  }
  return { y, ny }
}
