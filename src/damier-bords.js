// QUELLES ARÊTES DU SOCLE SONT ENCORE EXPOSÉES — et lesquelles doivent perdre
// leur arrondi.
//
// Le congé bas (SOCLE_ARRONDI = 0,9) et le chanfrein haut (SOCLE_CHANFREIN =
// 0,16) sont appliqués aux QUATRE côtés de chaque cellule. Sur une jointure
// entre deux cases, les deux congés se font face et creusent une rainure — le
// « les arrondis posent problème et sont vilains » des captures d'Adrien.
//
// ⚠️ ON INTERROGE LES CASES POSÉES, PAS LA FORME SUPPOSÉE DU DAMIER. Déduire
// « suis-je au bord ? » d'un carré plein serait plus court et serait FAUX : le
// mode zone isolée pose des figures trouées (deux îlots opposés ne remplissent
// pas le carré entre eux, block-grid.js:151-153). Une arête déclarée
// intérieure sans voisine derrière, c'est un mur qu'on ne construit pas — et
// le jour sous la carte à cet endroit. Poser la question à l'ensemble des
// cases est juste dans les deux modes, et se réduit tout seul au cas du carré.

/**
 * Les quatre arêtes de la case (i,j) touchent-elles le vide ?
 *
 * Convention d'axes de computeSlab (plinth.js:152-155) : z = −HALF est le
 * NORD, z = +HALF le SUD, x = +HALF l'EST, x = −HALF l'OUEST. `j` croît vers
 * le sud, `i` vers l'est.
 *
 * ⚠️ LE BLOC CENTRAL (0,0) EXISTE TOUJOURS et ne figure JAMAIS dans
 * `cellules` — la boucle qui peuple le damier le saute explicitement
 * (block-grid.js:178). L'oublier arrondirait le bord d'une voisine collée au
 * héros : une rainure en plein milieu du damier.
 *
 * @param {number} i - colonne de la case, vers l'est
 * @param {number} j - rangée de la case, vers le sud
 * @param {Set<string>} cellules - clés "i,j" des cases voisines posées
 */
export function bordsExterieurs(i, j, cellules) {
  const posee = (di, dj) => {
    const ci = i + di
    const cj = j + dj
    if (ci === 0 && cj === 0) return true // le héros est toujours là
    return !!cellules?.has(`${ci},${cj}`)
  }
  return {
    nord: !posee(0, -1),
    est: !posee(1, 0),
    sud: !posee(0, 1),
    ouest: !posee(-1, 0),
  }
}

/**
 * Le masque d'arrondi : un réel par sommet du contour rendu par computeSlab,
 * 1 = arrondi de plein droit, 0 = arête vive.
 *
 * ⚠️ ON ÉTIQUETTE PAR POSITION, PAS PAR INDEX. Reproduire le découpage de
 * computeSlab (straightN, longueurs d'arc rendues par arcCoin) marcherait
 * aujourd'hui et casserait au prochain réglage de densité d'arc — un couplage
 * muet entre deux fichiers, exactement ce qui a déjà coûté un chantier ici
 * (cf. « LA DENSITÉ DE L'ARC SE MESURE EN LONGUEUR », plinth.js:163). La
 * position, elle, ne ment pas.
 *
 * ⚠️ LES COINS. Un sommet d'arc n'est sur aucun des quatre côtés droits : il
 * appartient au COIN entre deux d'entre eux, et n'est arrondi que si les deux
 * le sont. Un quart de rond qui se termine à plat contre une jointure est pire
 * que pas d'arrondi du tout.
 *
 * @param {Array<{x:number,z:number}>} contour - le `ring` de computeSlab
 * @param {number} demi - HALF, le demi-côté du bloc
 * @param {{nord:boolean,est:boolean,sud:boolean,ouest:boolean}} bords
 * @param {number} marge - tolérance monde pour « ce sommet est sur ce côté »
 * @returns {Float32Array}
 */
export function masqueDepuisContour(contour, demi, bords, marge = 1e-3) {
  const b = bords || { nord: true, est: true, sud: true, ouest: true }
  const m = new Float32Array(contour.length)
  for (let k = 0; k < contour.length; k++) {
    const { x, z } = contour[k]
    // de quel(s) côté(s) ce sommet est-il ? un sommet d'arc en touche deux
    const auNord = z <= -demi + marge
    const auSud = z >= demi - marge
    const aLEst = x >= demi - marge
    const aLOuest = x <= -demi + marge
    // sur un arc, aucun des quatre n'est vrai : on prend le côté le plus proche
    let exposes = []
    if (auNord) exposes.push(b.nord)
    if (auSud) exposes.push(b.sud)
    if (aLEst) exposes.push(b.est)
    if (aLOuest) exposes.push(b.ouest)
    if (!exposes.length) {
      // sommet d'arc : il appartient au coin entre les deux côtés qu'il relie
      exposes = [z < 0 ? b.nord : b.sud, x > 0 ? b.est : b.ouest]
    }
    // UN COIN N'EST ARRONDI QUE SI SES DEUX CÔTÉS LE SONT
    m[k] = exposes.every(Boolean) ? 1 : 0
  }
  return m
}
