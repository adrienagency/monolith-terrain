// NORMALES D'UNE GRILLE RÉGULIÈRE — par différences centrées, pas par
// parcours de triangles.
//
// `BufferGeometry.computeVertexNormals()` est GÉNÉRIQUE : il lit l'index,
// calcule une normale de face par produit vectoriel, l'accumule sur les trois
// sommets de chaque triangle, puis normalise tout. Sur un maillage quelconque
// c'est le seul moyen. Sur une grille régulière, c'est du travail perdu — et il
// coûte cher : mesuré (étude du 2026-07-29 §2.4, banc `bench-normales.mjs`)
//
//   res | computeVertexNormals | différences centrées | facteur
//   256 |              9,78 ms |              0,61 ms |  16,1×
//   384 |             17,67 ms |              1,38 ms |  12,9×
//   512 |             32,27 ms |              2,27 ms |  14,2×
//   768 |             89,87 ms |              5,10 ms |  17,6×
//
// soit **81 % du coût de fabrication d'une dalle** (89,9 ms sur 95 à res 768).
// C'est le même facteur 18 que Hoppe a obtenu en 2005 en passant sur GPU —
// ici en CPU pur, sans toucher un shader.
//
// LA FORMULE. La surface est y = h(x, z) sur une grille de pas `seg`. Ses deux
// tangentes sont (1, ∂h/∂x, 0) et (0, ∂h/∂z, 1) ; leur produit vectoriel donne
//
//     n = normalize( −∂h/∂x , 1 , −∂h/∂z )
//
// C'est EXACTEMENT la convention que rend `computeVertexNormals` sur
// l'indexation de grid-template.js (triangles (a,b,d) puis (b,c,d), avec
// a=(ix,iy), b=(ix,iy+1), c=(ix+1,iy+1), d=(ix+1,iy)) — vérifié dans
// test/grid-normals.test.js sur cinq rampes affines, où les deux méthodes
// coïncident au 1e-6 près parce qu'un plan est son propre plan tangent.
//
// ⚠️ CE N'EST PAS BIT-IDENTIQUE, et ça ne peut pas l'être. three moyenne des
// normales de FACES pondérées par l'aire ; on évalue la tangente AU SOMMET. Sur
// un relief courbe les deux diffèrent d'un terme du second ordre : mesuré à
// **0,008° d'écart angulaire moyen** sur les 591 361 sommets d'une dalle res
// 768 (pire cas 1,02°, au bord). Le test borne cet écart au lieu de le nier.
//
// ⚠️ LES BORDS. La différence centrée n'existe pas sur la première et la
// dernière ligne/colonne : on y prend une différence DÉCENTRÉE d'un pas (ordre
// 1 au lieu de 2). C'est là que tout l'écart se concentre, et c'est aussi là
// que ça se verrait le plus — une normale fausse au bord marque une couture sur
// le flanc du socle. Le test vérifie séparément l'intérieur (< 0,5°) et le bord
// (< 4°). Ces sommets de bord sont par ailleurs ceux que le `discard` de la
// superellipse (terrain.js) jette dans le rendu du socle.
//
// ⚠️ LE RELIEF ABSENT. Une mer plate, une dalle sans données, un plateau : le
// gradient est nul et la normale doit valoir (0,1,0) FRANC. Elle le vaut par
// construction — la composante Y du vecteur non normalisé est 1, jamais 0, donc
// il n'y a aucun 0/0 possible et aucun cas particulier à écrire. C'est la
// raison pour laquelle on normalise (−gx, 1, −gz) et non une forme
// « équivalente » mise à l'échelle par le pas de grille.

/**
 * Normales d'une grille régulière rangée en `iy · (res+1) + ix`, avec les
 * altitudes dans la composante Y de `position` (la disposition exacte de
 * `gridTemplate`).
 *
 * @param {Float32Array} position — (res+1)² × 3, X/Y/Z entrelacés
 * @param {number} res — nombre de segments par côté
 * @param {number} size — côté du bloc en unités-monde (le pas vaut size/res)
 * @param {Float32Array} [out] — tableau de sortie réutilisé s'il est fourni
 * @returns {Float32Array} (res+1)² × 3
 */
export function gridNormals(position, res, size, out) {
  const n = res + 1
  const count = n * n
  const normals = out || new Float32Array(count * 3)
  // Le pas est le même dans les deux directions (grille carrée). On divise par
  // `2·seg` au centre et par `seg` au bord : c'est le seul endroit où les deux
  // schémas diffèrent, et le facteur est donc porté par la distance réelle
  // entre les deux échantillons lus, pas par un cas particulier.
  const seg = size / res

  for (let iy = 0; iy < n; iy++) {
    const rang = iy * n
    // voisins en Z (lignes) : centré à l'intérieur, décentré sur les deux bords
    const zAvant = iy > 0 ? rang - n : rang
    const zApres = iy < res ? rang + n : rang
    const dz = (iy > 0 ? 1 : 0) + (iy < res ? 1 : 0) // 2 au centre, 1 au bord
    const invZ = 1 / (dz * seg)
    for (let ix = 0; ix < n; ix++) {
      const i = rang + ix
      const xAvant = ix > 0 ? i - 1 : i
      const xApres = ix < res ? i + 1 : i
      const dx = (ix > 0 ? 1 : 0) + (ix < res ? 1 : 0)
      const gx = (position[xApres * 3 + 1] - position[xAvant * 3 + 1]) / (dx * seg)
      const gz = (position[(zApres + ix) * 3 + 1] - position[(zAvant + ix) * 3 + 1]) * invZ
      // (−gx, 1, −gz) normalisé. La composante Y du vecteur brut vaut 1 : la
      // longueur ne peut donc jamais être nulle, et un terrain parfaitement
      // plat sort exactement (0, 1, 0) sans aucune branche.
      const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz)
      normals[i * 3] = -gx * inv
      normals[i * 3 + 1] = inv
      normals[i * 3 + 2] = -gz * inv
    }
  }
  return normals
}
