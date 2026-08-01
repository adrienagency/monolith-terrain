// LE RELIEF EN INT16 — deux fois moins de mémoire, sans déplacer un seul
// trait de côte.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node.
//
// ══════════ POURQUOI L'ENTIER, ET POURQUOI IL NE VA PAS DE SOI ══════════════
//
// `dem.data` est le plus gros tableau du dépôt : 1536² en Float32, soit
// 9,44 Mo par bloc, et le damier en retient plusieurs. En `Int16` c'est
// 4,72 Mo — et la lecture est 9,5 % PLUS RAPIDE (banc de l'étude 3×3, §2.3) :
// deux fois plus d'échantillons par ligne de cache. Un levier qui gagne des
// deux côtés, c'est rare.
//
// L'unité est LE MÈTRE ENTIER, et ce choix est ce qui rend le changement
// indolore : `data[i]` continue de rendre des mètres. Aucun des huit
// consommateurs (sampler, tracé de la jupe, veille des bateaux, buildSeaMask,
// rasterizeMask, analyzeDem/resampleField, elevationHistogram, lake.js) n'a
// besoin d'un facteur d'échelle — donc aucun ne peut l'oublier. Une unité de
// 0,5 m aurait été deux fois plus fine et aurait exigé un `* 0.5` sur huit
// sites : exactement le genre de foulée oubliée qui a coûté cher au masque
// côtier.
//
// La portée de l'Int16 (±32 767 m) couvre l'Everest et la fosse des Mariannes
// avec un facteur 3.
//
// ══════════ LE PIÈGE QUE L'ÉTUDE N'AVAIT PAS VU ═════════════════════════════
//
// 🔴 Le risque de l'arrondi n'est PAS géométrique, il est TOPOLOGIQUE.
//
// Deux modules tranchent terre/mer sur l'altitude : `region-mask.js` à
// `LAND_MIN_ELEV_M = 0.3` et `sea-mask.js` à `seaLevelM = 0.5`. Or **aucun
// entier ne vit dans l'intervalle (0,3 ; 0,5]**. Un arrondi naïf y renvoie
// tout le monde à zéro — c'est-à-dire qu'il NOIE de la terre. C'est mot pour
// mot ce que `src/bathy.js` interdit depuis la session polders : « un trait de
// côte qui se déplace d'un pixel, et Amsterdam se retrouve sous la mer du
// Nord ».
//
// MESURÉ sur du MNT réel (banc `.banc/f3-quant.mjs`, blocs 1536² affichés) :
//
//   zone                     | pixels de la bande | plus grand amas connexe
//   Chamonix z12             |          0         |     0
//   La Réunion z13           |          0         |     0
//   Flevoland z12 (polders)  |      1 475         |    90   ← ~8 hectares
//
// En montagne le piège est vide ; sur les POLDERS, celui-là même de la session
// qui a écrit la règle, il noie une plaque de 90 pixels d'un seul tenant. Une
// mesure sur relief synthétique — ou sur les seules zones de référence —
// n'aurait rien vu. C'est la leçon des normales, appliquée une seconde fois.
//
// ══════════ LA PARADE : LA QUANTIFICATION NE PEUT QUE TERRESTRIALISER ═══════
//
// Le contrat tient en une phrase : **l'arrondi peut rendre un pixel plus
// terrestre, jamais moins.**
//
//  · L'arrondi ordinaire ne fait JAMAIS émerger la mer : `Math.round(0.3)`
//    vaut 0, donc tout pixel ≤ 0,3 m reste ≤ 0 m. C'est acquis par
//    construction, et le test `un pixel de MER ne peut jamais émerger` le tient.
//  · Il noie en revanche la bande (0,3 ; 0,5). Le garde-fou l'y rattrape à
//    1 m — la première altitude entière que les DEUX seuils déclarent terre.
//
// Le prix : ≤ 1 m d'écart au lieu de ≤ 0,5 m, sur cette bande et sur elle
// seule. Sur les trois zones mesurées, cela concerne au pire 0,63 pixel pour
// mille. L'écart moyen sur tout le champ reste de 0,25 m — soit, à z12 et à
// l'exagération du dépôt, **0,044 pixel d'écran** (étude 3×3 §2.3).
//
// Le sens du garde-fou est le MÊME que celui de `fuseBathymetry` : en cas de
// doute, la terre gagne. Deux modules, une seule règle.

// Le seuil terre/mer le plus BAS du dépôt (`region-mask.js LAND_MIN_ELEV_M`).
// C'est lui qui borne la bande à protéger : au-dessus de lui, un pixel est de
// la terre pour au moins un consommateur, donc il ne doit pas retomber à zéro.
export const QUANT_LAND_MIN_M = 0.3

// La première altitude ENTIÈRE que tous les seuils déclarent terre. Le
// garde-fou y dépose la bande fatale.
const PREMIERE_TERRE = 1

const MIN16 = -32768
const MAX16 = 32767

/**
 * Quantifie UNE altitude (en mètres) au mètre entier, bornée à l'Int16.
 *
 * ⚠️ Monotone non décroissante : `a <= b` ⟹ `q(a) <= q(b)`. C'est ce qui
 * autorise `dem.js` à quantifier les EXTREMA d'un champ plutôt que de les
 * rechercher à nouveau — les extrema du champ quantifié sont les quantifiés
 * des extrema. Le garde-fou ne casse pas cette propriété : il ne fait que
 * relever la bande (0,3 ; 0,5) jusqu'à 1, où l'arrondi ordinaire l'aurait
 * déjà envoyée un cran plus loin.
 *
 * @param {number} v - altitude en mètres
 * @returns {number} l'altitude en mètres ENTIERS
 */
export function quantizeElevation(v) {
  // NaN = ABSENCE DE MESURE, et zéro est la façon dont tout le dépôt l'écrit
  // (dem.js le fait déjà pour l'alpha nul, bathy.js le lit via NODATA_EPS).
  // Sans ce cas, un Infinity se replierait en −32768 : une fosse imaginaire.
  if (Number.isNaN(v)) return 0
  // ⚠️ `Math.round` arrondit les demis VERS LE HAUT, y compris chez les
  // négatifs (−2,5 → −2) : le demi va donc toujours du côté de la terre.
  let q = Math.round(v)
  if (v > QUANT_LAND_MIN_M && q < PREMIERE_TERRE) q = PREMIERE_TERRE
  return q < MIN16 ? MIN16 : q > MAX16 ? MAX16 : q
}

/**
 * Quantifie un champ d'altitudes (en mètres) au mètre entier, en `Int16Array`.
 *
 * Rend un NOUVEAU tableau — l'entrée n'est pas mutée. Un champ déjà `Int16Array`
 * ressort à l'identique (la fonction est idempotente : la requantifier ne la
 * déplace plus, ce qui rend un rechargement de bloc reproductible).
 *
 * @param {Float32Array|Int16Array|null} data - altitudes en mètres
 * @returns {Int16Array|null} le champ quantifié, `null` si l'entrée l'était
 */
export function quantizeElevations(data) {
  if (!data) return null
  const n = data.length
  const out = new Int16Array(n)
  for (let i = 0; i < n; i++) out[i] = quantizeElevation(data[i])
  return out
}
