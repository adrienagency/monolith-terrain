// NORMALES D'UNE GRILLE RÉGULIÈRE — la somme des six faces, écrite en clair.
//
// `BufferGeometry.computeVertexNormals()` est GÉNÉRIQUE : il lit l'index,
// calcule une normale de face par produit vectoriel, l'accumule sur les trois
// sommets de chaque triangle, puis normalise tout. Sur un maillage quelconque
// c'est le seul moyen. Sur une grille régulière, c'est du travail perdu — et il
// coûte cher, mesuré in situ sur la géométrie affichée (banc `f3-verif.mjs`,
// même machine, même dalle, cinq passes, médiane) :
//
//   zone       | res | computeVertexNormals | gridNormals | facteur
//   Chamonix   | 768 |              83,8 ms |      4,6 ms |   18,2×
//   La Réunion | 768 |             120,5 ms |      4,4 ms |   27,4×
//
// soit **81 % du coût de fabrication d'une dalle** (89,9 ms sur 95 à res 768).
//
// ⚠️ CE N'EST PAS UNE APPROXIMATION, ET ÇA NE PEUT PAS EN ÊTRE UNE.
// La première version calculait la normale par DIFFÉRENCES CENTRÉES :
// n = normalize(−∂h/∂x, 1, −∂h/∂z), la tangente évaluée au sommet. Sur du
// relief synthétique lisse elle donnait 0,008° d'écart. Sur du MNT RÉEL elle
// donnait **1,6° en moyenne à Chamonix, 3,2° à La Réunion, et jusqu'à 119° au
// pire**. La raison : un MNT porte du bruit à la fréquence de Nyquist du
// maillage — une alternance d'un pixel sur deux, née de la quantification en
// mètres et du rééchantillonnage. La différence centrée lit hW et hE et ne lit
// JAMAIS h0 : ce bruit lui est invisible. La somme des faces, elle, le voit
// intégralement, et c'est elle que l'œil voit à l'écran.
//
// LA DÉRIVATION. `gridTemplate` range les sommets en `i = iy·(res+1) + ix`,
// avec x croissant en ix, z croissant en iy, et découpe chaque maille en deux
// triangles (a,b,d) puis (b,c,d), où a=(ix,iy), b=(ix,iy+1), c=(ix+1,iy+1),
// d=(ix+1,iy). three accumule sur chaque sommet la normale NON normalisée
// `(vC−vB) × (vA−vB)` — un vecteur dont la longueur vaut deux fois l'aire du
// triangle. Avec un pas `s` identique dans les deux directions, ces deux
// produits vectoriels valent, pour la maille (ix,iy) :
//
//     n₁ = ( s·(h_a − h_d) , s² , s·(h_a − h_b) )
//     n₂ = ( s·(h_b − h_c) , s² , s·(h_d − h_c) )
//
// Un sommet intérieur appartient à quatre mailles, dans quatre rôles distincts :
// il est `a` de la sienne (1 triangle), `d` de celle de gauche (2), `b` de celle
// du dessus (2) et `c` de la diagonale haut-gauche (1) — six triangles en tout.
// En sommant les six et en divisant par `s` (sans effet après normalisation) :
//
//     X = 2·(hW − hE) + (hWD − hD) + (hU − hEU)
//     Y = 6·s
//     Z = 2·(hU − hD) + (hW − hWD) + (hEU − hE)
//
// ⚠️ LE STENCIL EST ASYMÉTRIQUE, et ce n'est pas une faute de frappe : il lit
// la diagonale ouest-bas et la diagonale est-haut, jamais les deux autres.
// C'est l'orientation du découpage en triangles qui le veut — la diagonale de
// chaque maille va de b=(ix,iy+1) à d=(ix+1,iy). Symétriser ce stencil
// « pour faire propre » reviendrait à mailler autrement que ce qu'on affiche.
//
// ⚠️ LE BORD FAIT PARTIE DE LA FORMULE, il n'est pas un cas dégradé. Un sommet
// de bord touche trois faces, un coin une ou trois : le nombre de faces
// réellement présentes est le `Y = c·s` du vecteur. Il n'y a donc AUCUNE
// différence décentrée à inventer, aucun schéma d'ordre inférieur : le bord est
// aussi exact que le centre, et le test l'exige explicitement.
//
// ⚠️ LE RELIEF ABSENT. Une mer plate, une dalle sans données, un plateau : X et
// Z sont nuls et Y vaut c·s > 0. La normale sort (0,1,0) FRANC, sans branche et
// sans 0/0 possible — c'est la raison pour laquelle on ne divise jamais par `s`
// avant de normaliser.

/**
 * Normales d'une grille régulière rangée en `iy · (res+1) + ix`, avec les
 * altitudes dans la composante Y de `position` (la disposition exacte de
 * `gridTemplate`), identiques à celles de `computeVertexNormals` sur la même
 * géométrie — à l'arrondi Float32 près.
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
  const seg = size / res
  const y6 = 6 * seg

  // L'INTÉRIEUR — les six faces existent, la forme fermée s'applique telle
  // quelle. C'est 99,5 % des sommets à res 768, et six lectures par sommet :
  // `h0` n'apparaît pas dans la formule, il n'est donc même pas lu.
  for (let iy = 1; iy < res; iy++) {
    const rang = iy * n
    for (let ix = 1; ix < res; ix++) {
      const i = rang + ix
      const hE = position[(i + 1) * 3 + 1]
      const hW = position[(i - 1) * 3 + 1]
      const hD = position[(i + n) * 3 + 1]
      const hU = position[(i - n) * 3 + 1]
      const hWD = position[(i + n - 1) * 3 + 1]
      const hEU = position[(i - n + 1) * 3 + 1]
      const x = 2 * (hW - hE) + (hWD - hD) + (hU - hEU)
      const z = 2 * (hU - hD) + (hW - hWD) + (hEU - hE)
      const inv = 1 / Math.sqrt(x * x + y6 * y6 + z * z)
      normals[i * 3] = x * inv
      normals[i * 3 + 1] = y6 * inv
      normals[i * 3 + 2] = z * inv
    }
  }

  // LE BORD — la même somme, maille par maille, en ne comptant que les mailles
  // qui existent. C'est ~4·res sommets sur (res+1)², soit 0,5 % à res 768 : le
  // détour par une fonction et ses quatre tests ne pèse rien.
  const bord = (ix, iy) => {
    const i = iy * n + ix
    const h0 = position[i * 3 + 1]
    const aG = ix > 0
    const aD = ix < res
    const aH = iy > 0
    const aB = iy < res
    let x = 0
    let z = 0
    let c = 0
    // maille (ix, iy) — on y est le sommet `a`, présent dans le seul (a,b,d)
    if (aD && aB) {
      x += h0 - position[(i + 1) * 3 + 1]
      z += h0 - position[(i + n) * 3 + 1]
      c += 1
    }
    // maille (ix−1, iy) — on y est le sommet `d`, présent dans les DEUX
    if (aG && aB) {
      const hW = position[(i - 1) * 3 + 1]
      const hD = position[(i + n) * 3 + 1]
      const hWD = position[(i + n - 1) * 3 + 1]
      x += hW - h0 + (hWD - hD)
      z += hW - hWD + (h0 - hD)
      c += 2
    }
    // maille (ix, iy−1) — on y est le sommet `b`, présent dans les DEUX
    if (aD && aH) {
      const hE = position[(i + 1) * 3 + 1]
      const hU = position[(i - n) * 3 + 1]
      const hEU = position[(i - n + 1) * 3 + 1]
      x += hU - hEU + (h0 - hE)
      z += hU - h0 + (hEU - hE)
      c += 2
    }
    // maille (ix−1, iy−1) — on y est le sommet `c`, présent dans le seul (b,c,d)
    if (aG && aH) {
      x += position[(i - 1) * 3 + 1] - h0
      z += position[(i - n) * 3 + 1] - h0
      c += 1
    }
    const y = c * seg
    const inv = 1 / Math.sqrt(x * x + y * y + z * z)
    normals[i * 3] = x * inv
    normals[i * 3 + 1] = y * inv
    normals[i * 3 + 2] = z * inv
  }
  for (let ix = 0; ix < n; ix++) {
    bord(ix, 0)
    bord(ix, res)
  }
  for (let iy = 1; iy < res; iy++) {
    bord(0, iy)
    bord(res, iy)
  }
  return normals
}
