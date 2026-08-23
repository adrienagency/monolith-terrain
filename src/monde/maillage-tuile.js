// LE MAILLAGE D'UNE TUILE — Tâche P11 du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, ni état. Tout se vérifie sous node
// (`test/maillage-tuile.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// > **L'agent noteur, notation-03 §6.2 :** « AU CADRAGE INTÉRIEUR, C'EST LE
// > TERRAIN QUI DRAPE LA PAROI : 54 379 px de tuiles dans la bande verticale du
// > mur, contre 2 722 au socle — ×20. On le voit en une seconde : une jupe brune
// > continue pend par-dessus l'arête ouest et sud. »
//
// ⚠️ **CE N'EST PAS LA JUPE DES TUILES, ET C'EST MESURÉ.** La Tâche P7 les avait
// déjà divisées par 2 186 ; le banc de P11 (`.banc/P11/d3-paroi.js`) les ÉTEINT
// en retirant leurs triangles du tampon d'indices, dans la page vivante, avec
// aller-retour à **0 canal** : `dansLaBande` passe de **54 430 à 54 356**, soit
// **0,14 %**. La jupe est hors de cause.
//
// ⛔ **CE QUI RESTE EST UN DÉSACCORD ENTRE DEUX SURFACES QUI DEVRAIENT ÊTRE LA
// MÊME.** La paroi du crop pose son anneau haut sur `globe.hauteurSurface`,
// c'est-à-dire sur la TEXTURE de hauteur, interpolée bilinéairement à sa pleine
// résolution (256 ou 512 texels par tuile). Le GPU, lui, dessine le MAILLAGE de
// la tuile : `segmentsTuile(z)` quads, soit **24 × 24 à z12** — vingt-cinq
// sommets là où la donnée en a deux cent cinquante-six. Les deux ne peuvent pas
// coïncider, et l'écart se lit dans les DEUX SENS :
//
//   · l'anneau AU-DESSUS du maillage → la paroi dépasse la surface qu'elle
//     porte, et on voit du mur là où le socle montre du terrain ;
//   · l'anneau AU-DESSOUS → la surface pend par-dessus l'arête haute — le
//     « drapé » que le noteur nomme.
//
// **Mesuré sur les 1 020 points de l'anneau, La Réunion z12, page vivante**
// (`.banc/P11/M1-bord-avant.json`) : écart moyen **−1,86 m**, moyenne des
// valeurs absolues **18,94 m**, p05 **−54,1 m**, p95 **+46,7 m**, extrêmes
// **−270,6 / +202,4 m** — soit, projeté à l'écran au cadrage du noteur,
// **|0,65| px en moyenne, 9,8 px au pire**.
//
// ➡️ **LA PAROI DOIT SUIVRE LA SURFACE QUE LE GPU DESSINE, PAS LA DONNÉE QUE LE
// GPU N'A PAS.** Ce module porte la loi d'interpolation du maillage, et
// `globe.hauteurDessinee` la nourrit avec la MÊME loi de nœud que `_buildMesh`.
//
// ⚠️ **ET LA COULEUR, ELLE, RESTE SUR LA TEXTURE.** Le nuanceur de fragment
// calcule `h` par `decodeMetersAA(vUv)` : il colore à la résolution de la
// donnée, et c'est ce qui fait la richesse du crop. `poserRampe` continue donc
// de mesurer le relief avec `hauteurSurface`. **La géométrie lit le maillage,
// la couleur lit la texture** — ce sont deux questions différentes, et les
// confondre est exactement ce qui a produit le drapé.
//
// ══════════ 1. CE QUE CE MODULE NE PROMET PAS ═══════════════════════════════
//
// ⚠️ **IL NE FERME PAS L'ÉCART DE RÉSOLUTION.** Le socle porte **594 434
// sommets** sur son bloc ; le crop en porte **5 625** (9 tuiles × 25², relevé).
// La silhouette du bloc reste donc dix fois plus grossière que celle du socle.
// Ce module fait coïncider la paroi et la surface ; il ne rend pas la surface
// plus fine.
//
// ⚠️ **ET L'INTERPOLATION EST CELLE DES HAUTEURS, PAS CELLE DES POSITIONS.** Le
// GPU interpole des points 3D : à l'intérieur d'un triangle, le rayon dessiné
// est légèrement INFÉRIEUR à l'interpolation linéaire des rayons — c'est la
// flèche de la corde. Elle vaut `d² / (8 R)` : à z12 la cellule fait 380 m sur
// une sphère de 6 371 km, soit **2,8 millimètres**. `test/maillage-tuile.test.js`
// ④ la MESURE contre `latLonToSphere` du dépôt au lieu de la supposer.

// ══════════ 2. LA DENSITÉ DU MAILLAGE ══════════════════════════════════════

/**
 * Segments par côté de tuile — **l'unique écriture de cette table**.
 *
 * ⚠️ **ELLE VIVAIT DANS `globe.js` SOUS LE NOM `gridFor`, ET ELLE EN SORT PARCE
 * QU'UN SECOND LECTEUR EST APPARU.** `hauteurDessinee` doit connaître la grille
 * EXACTE sur laquelle `_buildMesh` a posé ses sommets ; la relire depuis le
 * maillage (`geometry.userData`) aurait marché tant qu'un maillage existe, et
 * aurait menti le jour où il n'existe pas encore. La recopier aurait fait « deux
 * écritures jumelles qui divergent » — la cicatrice que `terrain.js` documente.
 *
 * Le commentaire d'origine, gardé mot pour mot parce qu'il porte le POURQUOI :
 * les bas zooms forment la silhouette de la planète en vue complète, donc ils
 * reçoivent des grilles plus denses — une tuile z3 couvre 45 degrés de longitude
 * et 24 segments y laissent des facettes visibles sur le limbe.
 */
export function segmentsTuile(z) {
  if (z <= 2) return 64
  if (z <= 3) return 48
  if (z <= 5) return 32
  return 24
}

// ══════════ 3. LA LOI D'INTERPOLATION — CELLE DU TAMPON D'INDICES ══════════

/**
 * La hauteur que le maillage DESSINE en un point d'une tuile.
 *
 * ⚠️ **LA DIAGONALE N'EST PAS UN DÉTAIL DE STYLE : ELLE EST DANS LE TAMPON
 * D'INDICES.** `_buildMesh` écrit, pour la cellule `(i, j)` :
 *
 *     a = j (G+1) + i    b = a + 1    c = a + (G+1)    d = c + 1
 *     indices.push(a, c, b,  b, c, d)
 *
 * Les deux triangles partagent donc l'arête `b–c`, c'est-à-dire
 * l'ANTI-DIAGONALE `su + sv = 1`. Prendre l'autre diagonale rendrait une
 * surface DIFFÉRENTE à l'intérieur de chaque cellule — et une paroi qui suivrait
 * cette autre surface rouvrirait le drapé à moitié.
 *
 * ⚠️ **`hauteurNoeud` EST FOURNIE PAR L'APPELANT, ET C'EST CE QUI GARDE CE
 * MODULE PUR.** C'est lui qui sait lire la texture terrarium et le champ du fond
 * marin ; ici on ne connaît que la grille.
 *
 * @param {number} tu abscisse dans la tuile, dans [0, 1], vers l'EST
 * @param {number} tv ordonnée dans la tuile, dans [0, 1], vers le SUD
 * @param {number} G segments par côté — `segmentsTuile(z)`
 * @param {(i:number, j:number) => number} hauteurNoeud la hauteur au nœud `(i, j)`
 * @returns {number}
 */
export function interpolerMaille(tu, tv, G, hauteurNoeud) {
  const n = Math.max(1, Math.round(G))
  // ⚠️ **L'ÉCRÊTAGE EST CELUI DE LA CELLULE, PAS CELUI DU POINT.** Un `tu` de 1
  // exactement tomberait sur la cellule `n`, qui n'existe pas ; on le range dans
  // la dernière, où `su` vaut alors 1 — le nœud de bord, exactement.
  const fu = Math.min(Math.max(tu, 0), 1) * n
  const fv = Math.min(Math.max(tv, 0), 1) * n
  const i = Math.min(n - 1, Math.floor(fu))
  const j = Math.min(n - 1, Math.floor(fv))
  const su = fu - i
  const sv = fv - j
  const ha = hauteurNoeud(i, j)
  const hb = hauteurNoeud(i + 1, j)
  const hc = hauteurNoeud(i, j + 1)
  if (su + sv <= 1) return ha + su * (hb - ha) + sv * (hc - ha)
  const hd = hauteurNoeud(i + 1, j + 1)
  return hd + (1 - su) * (hc - hd) + (1 - sv) * (hb - hd)
}
