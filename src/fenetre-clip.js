// LA DÉCOUPE DES CALQUES À LA FENÊTRE — les huit demi-plans, purs.
//
// Module PUR : ni DOM, ni three.js, ni état. Testable en node.
//
// ══════════ LE PROBLÈME ════════════════════════════════════════════════════
//
// Les rivières, les lacs et les plans d'eau sont écrêtés au socle par le CPU,
// dans la géométrie elle-même (`map/block-clip.js` : densification au pas de
// 0,6 unité, bissection à chaque franchissement, Sutherland–Hodgman contre un
// contour de 192 sommets pour les polygones). En mode continu ça ne peut plus
// marcher : le contour de découpe se déplace à chaque image, et l'étude 3×3
// §5.2 chiffre cette découpe à 10⁵–10⁶ tests par reconstruction, soit 10 à
// 100 ms. Impossible à refaire par image, le budget entier étant de 6 ms.
//
// MESURÉ AVANT, Chamonix z12 en mode continu : le calque d'eau rend 186 objets
// et 16 355 sommets, tous contenus dans ±28 — le socle CENTRAL. L'emprise fait
// ±84 : huit neuvièmes de l'eau n'existent pas. On défile, l'eau s'en va, et
// rien n'arrive derrière.
//
// ══════════ LA SORTIE, ET POURQUOI CELLE-LÀ ════════════════════════════════
//
// On construit la géométrie sur l'EMPRISE entière, une seule fois, et c'est le
// GPU qui coupe à la fenêtre. L'étude recommandait de porter le `discard` de
// superellipse du terrain dans chaque matériau par `onBeforeCompile`.
//
// ⚠️ ON FAIT PLUS SIMPLE, ET C'EST MIEUX : des PLANS DE COUPE three.js. Ils
// sont supportés nativement par les trois matériaux du calque — `LineMaterial`
// le déclare en toutes lettres (`clipping: true`, r172), `MeshBasicMaterial`
// depuis toujours — donc zéro chirurgie de shader, zéro varying à ajouter, zéro
// risque de casser une compilation sur un pilote.
//
// ⚠️ ET ILS SONT CONSTANTS. Les plans vivent en coordonnées MONDE, et en mode
// continu le monde affiché EST la fenêtre : le socle reste centré sur l'origine
// pendant que la géométrie défile sous lui (c'est le groupe du calque qui porte
// la translation −fenêtre). Il n'y a donc RIEN à mettre à jour par image. Un
// `plane.constant` recalculé à chaque pas aurait été une occasion de se tromper
// pour un gain nul.
//
// ══════════ CE QUE L'OCTOGONE APPROXIME, ET DE COMBIEN ═════════════════════
//
// Le socle est une superellipse : côtés droits, coins arrondis au rayon
// `corner`. Huit plans en donnent l'octogone circonscrit — quatre côtés
// tangents aux milieux des bords, quatre diagonales tangentes aux coins.
//
// L'octogone DÉBORDE l'arrondi entre ses points de tangence, jamais l'inverse :
// une rivière peut donc dépasser du coin, elle ne peut jamais être coupée trop
// tôt. Au réglage par défaut (`slabCorner` = 0, donc un rayon plancher de 0,05
// unité sur 56) le débordement est de l'ordre du millième d'unité : invisible.
// Au rayon maximal il atteint (√2 − 1)·corner ≈ 0,41·corner sur la diagonale —
// et c'est le seul cas où il faudrait un vrai `discard` de superellipse.
// `debordementCoin` ci-dessous rend ce chiffre pour qu'on puisse le vérifier
// plutôt que de le croire.

const R2 = Math.SQRT2

/**
 * `slabCornerSmoothing` (0..1) → exposant de la superellipse du coin.
 * 2 = arc de cercle pur, plus haut = squircle (le coin continu, celui qui
 * distingue un coin DESSINÉ d'un coin FABRIQUÉ).
 *
 * ⚠️ IL VIT ICI et pas dans plinth.js pour une raison mécanique : terrain.js,
 * ocean.js ET plinth.js en ont tous besoin, et plinth.js importe déjà terrain.js
 * — le poser dans plinth.js fabriquait un cycle d'imports qui laissait
 * TERRAIN_SIZE dans sa zone morte. Ce module-ci n'importe rien, et c'est déjà
 * lui qui documente la superellipse du socle.
 *
 * Le réglage était exposé, persisté dans les gabarits, et relu par PERSONNE :
 * l'exposant restait en dur à 2 en quatre endroits. Absent ou hors bornes = le
 * comportement d'avant, au caractère près.
 */
export function exposantCoin(lissage) {
  const s = Math.max(0, Math.min(1, Number(lissage) || 0))
  return 2 + 4 * s
}

// Distance du centre du coin à sa tangente diagonale, pour une superellipse
// d'exposant n. Le point à 45° est en x = z = r/2^(1/n), donc à r·2^(1/2−1/n)
// du centre — et c'est aussi le maximum du support dans cette direction (la
// courbe est convexe dès n ≥ 2). À n = 2 la formule rend r : le cercle d'avant,
// au bit près.
const porteeCoin = (r, expo) => r * Math.pow(2, 0.5 - 1 / Math.max(2, expo))

/**
 * Les huit demi-plans de la fenêtre, en coordonnées MONDE.
 *
 * Convention THREE.Plane : le fragment est GARDÉ quand
 * `normal · p + constant >= 0`. Chaque plan garde donc l'intérieur.
 *
 * @param {number} half - demi-côté du socle (28)
 * @param {number} corner - rayon d'arrondi des coins (unités monde)
 * @param {number} expo - exposant de superellipse du coin (2 = cercle)
 * @returns {Array<{normal:[number,number,number], constant:number}>}
 */
export function plansFenetre(half, corner = 0, expo = 2) {
  const r = Math.max(0, Math.min(corner, half))
  // distance du centre à la diagonale tangente au coin. ⚠️ Un squircle est PLUS
  // PLEIN qu'un cercle : garder l'ancienne constante couperait le relief dans
  // les coins, exactement l'inverse de l'invariant du module.
  const d = (half - r) * R2 + porteeCoin(r, expo)
  const k = 1 / R2
  return [
    { normal: [1, 0, 0], constant: half }, //  x ≥ −half
    { normal: [-1, 0, 0], constant: half }, //  x ≤ +half
    { normal: [0, 0, 1], constant: half }, //  z ≥ −half
    { normal: [0, 0, -1], constant: half }, //  z ≤ +half
    { normal: [-k, 0, -k], constant: d }, //  +x +z
    { normal: [k, 0, -k], constant: d }, //  −x +z
    { normal: [-k, 0, k], constant: d }, //  +x −z
    { normal: [k, 0, k], constant: d }, //  −x −z
  ]
}

/**
 * De combien l'octogone déborde l'arrondi, au pire (sur la bissectrice du coin).
 * Rendu en unités monde. Sert à décider si l'approximation est acceptable — et
 * à le VÉRIFIER plutôt qu'à l'affirmer.
 */
export function debordementCoin(corner, expo = 2) {
  const r = Math.max(0, corner)
  return (R2 - Math.pow(2, 0.5 - 1 / Math.max(2, expo))) * r
}

/**
 * Un point est-il dans l'octogone ? (le prédicat que les plans appliquent)
 * Sert aux tests, et à toute vérification hors GPU.
 */
export function dansFenetre(x, z, half, corner = 0, expo = 2) {
  for (const p of plansFenetre(half, corner, expo)) {
    if (p.normal[0] * x + p.normal[2] * z + p.constant < 0) return false
  }
  return true
}
