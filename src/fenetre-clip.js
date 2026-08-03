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
// ═══════ UN POINT SUR LE COIN DU BLOC — UNE SEULE FORMULE, TROIS CLIENTS ═════
//
// Elle était recopiée à l'identique dans `computeSlab` (l'anneau du socle) et
// dans `buildRimGeometry` (le flanc d'eau) — sauf que la seconde copie était
// restée en CERCLE quand la première est passée au squircle. Un squircle étant
// plus plein, le flanc rentrait dans les quatre angles pendant que la surface,
// clipée par le nuanceur, allait jusqu'au bord : un liseré de vide s'ouvrait
// dans chaque coin. Deux copies d'une même règle finissent toujours par
// diverger ; il n'y en a plus qu'une.
//
// À `expo` = 2 on retrouve exactement l'arc de cercle d'avant, au bit près.
//
// @param {number} a - l'angle, en radians
// @param {number} r - le rayon du coin
// @param {number} expo - l'exposant de superellipse (voir exposantCoin)
// @returns {[number, number]} le décalage depuis le CENTRE du coin
export function pointCoin(a, r, expo = 2) {
  const n = Math.max(2, expo)
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  return [
    Math.sign(ca) * Math.pow(Math.abs(ca), 2 / n) * r,
    Math.sign(sa) * Math.pow(Math.abs(sa), 2 / n) * r,
  ]
}

// ═══ UN ARC DE COIN À PAS CONSTANT — ET POURQUOI L'ANGLE NE SUFFIT PAS ═══════
//
// ⚠️ LA SUPERELLIPSE N'EST PAS UNIFORME EN LONGUEUR D'ARC, et c'est contre
// l'intuition : plus l'exposant monte, plus elle se tasse. Mesuré sur le coin
// par défaut (rayon 1, exposant 4,4, sept segments) : le PREMIER segment après
// l'axe fait 0,505 quand les côtés droits échantillonnent tous les 0,219. La
// raison est dans la formule — |sin a| élevé à 0,45 décolle verticalement de
// zéro, donc un petit pas d'angle y fait un grand pas de position.
//
// Multiplier les segments ne réglait rien : le saut restait au même endroit,
// juste divisé. Il faut échantillonner en LONGUEUR. On calcule donc l'arc dense
// une fois, puis on le rééchantillonne à pas constant.
//
// C'est ce défaut qu'Adrien lit comme « la qualité du chanfrein paraît faible
// dans les angles » : le liseré épouse l'anneau, donc il épouse ses trous.
//
// Rend les points de a0 (inclus) à a1 (EXCLU) — la convention de l'anneau, où
// le point suivant appartient déjà au côté droit.
// ⚠️ ON INTERPOLE L'ANGLE, PAS LA POSITION, et la nuance a un test derrière
// elle. Interpoler entre deux points denses coupe la corde : le point tombe
// 5,3·10⁻⁶ EN DEDANS de la courbe (mesuré, rayon 4,48, 512 échantillons), et
// `plinth.test.js` vérifie depuis toujours que l'anneau reste étanche, sur la
// courbe exacte, à 10⁻⁶ près. Un anneau qui rentre, si peu que ce soit, c'est
// du jour sous la carte. On se sert donc de l'échantillonnage dense UNIQUEMENT
// pour inverser la longueur d'arc, puis on évalue la vraie formule.
export function arcCoin(a0, a1, r, expo = 2, pas = 0.25) {
  const memo = (arcCoin._memo ??= new Map())
  const cle = `${a0}|${a1}|${r}|${expo}|${pas}`
  const vu = memo.get(cle)
  if (vu) return vu
  // ⚠️ ÉCHANTILLONNAGE ADAPTATIF, PAS UNIFORME EN ANGLE — et c'est le cœur du
  // problème. Une table uniforme de 256 pas laissait sa PREMIÈRE cellule
  // couvrir 0,585 unité (rayon 6, exposant 4,4) : plus large que l'espacement
  // visé. Inverser une longueur dedans par interpolation linéaire donnait 0,375
  // au lieu de 0,214, et le trou dans l'angle restait. On subdivise donc là où
  // la courbe est raide, jusqu'à ce qu'aucune corde ne dépasse le quart du pas.
  const fin = Math.max(1e-4, pas / 4)
  let angles = [a0, a1]
  for (let tour = 0; tour < 24 && angles.length < 4096; tour++) {
    const suiv = [angles[0]]
    let coupe = false
    for (let i = 1; i < angles.length; i++) {
      const pa = pointCoin(angles[i - 1], r, expo)
      const pb = pointCoin(angles[i], r, expo)
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > fin) {
        suiv.push((angles[i - 1] + angles[i]) / 2)
        coupe = true
      }
      suiv.push(angles[i])
    }
    angles = suiv
    if (!coupe) break
  }
  const bruts = angles.map((a) => pointCoin(a, r, expo))
  const cum = [0]
  for (let i = 1; i < bruts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(bruts[i][0] - bruts[i - 1][0], bruts[i][1] - bruts[i - 1][1]))
  }
  const total = cum[cum.length - 1]
  // Plafonné : un grand rayon multiplierait les points d'anneau, et chacun coûte
  // onze triangles de socle.
  const n = Math.max(2, Math.min(96, Math.ceil(total / Math.max(1e-6, pas))))
  const out = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const cible = (total * k) / n
    while (j < cum.length - 2 && cum[j + 1] < cible) j++
    const t = (cible - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j])
    out.push(pointCoin(angles[j] + (angles[j + 1] - angles[j]) * t, r, expo))
  }
  // Mémoïsé : la forme d'un coin ne dépend que du rayon, de l'exposant et du
  // pas — trois valeurs qui changent au réglage, pas à l'image. Sans ça, la
  // subdivision serait repayée à CHAQUE reconstruction de socle, c'est-à-dire à
  // chaque déplacement de fenêtre continue.
  if (memo.size > 64) memo.clear()
  memo.set(cle, out)
  return out
}

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
