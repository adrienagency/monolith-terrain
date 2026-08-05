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

// ══════════ LE MÊME ARRONDI, MAIS SUR LA SURFACE DE CARTE ═══════════════════
//
// Le socle (ci-dessus) et la SURFACE sont deux arrondis INDÉPENDANTS. Le socle
// est de la géométrie, masquée par sommet ; la surface est découpée dans le
// fragment shader (terrain.js, `else if (uSlabCorner > 0.0)`) par une distance
// signée à un rectangle aux coins arrondis. La Tâche 5 n'a traité que le
// premier — d'où, sur les captures, une rainure sombre le long de chaque
// jointure et un TROU EN ÉTOILE là où quatre blocs se rejoignent : quatre
// coins arrondis qui se font face.
//
// Le `abs()` de ce clip le rend symétrique sur les quatre côtés : chaque bloc
// du damier a son propre carré arrondi, jointures comprises. La correction est
// de choisir le rayon PAR QUADRANT, avec la règle du socle, mot pour mot :
// UN COIN N'EST ARRONDI QUE SI SES DEUX CÔTÉS SONT EXTÉRIEURS.
//
// ⚠️ CE MODULE EST LA SEULE VÉRITÉ, ET IL A DEUX LECTEURS QUI NE PEUVENT PAS SE
// PARLER : le shader (transcrit à la main, aucun test ne le compile ici) et
// `map/block-clip.js` (le pendant JS, qui découpe les calques en surimpression).
// Les deux appellent `rayonCoin` — le JS pour de vrai, le GLSL en copie d'une
// ligne, volontairement lisible côte à côte.

/**
 * Les quatre coins de la dalle, dans l'ordre des quadrants du plan (x, z) :
 * `ne` = (x ≥ 0, z < 0), `se` = (x ≥ 0, z ≥ 0), `so` = (x < 0, z ≥ 0),
 * `no` = (x < 0, z < 0). 1 = le coin garde son arrondi, 0 = il reste vif.
 *
 * Convention d'axes de computeSlab, la même que `bordsExterieurs` : z = −HALF
 * est le NORD, z = +HALF le SUD, x = +HALF l'EST, x = −HALF l'OUEST.
 *
 * `bords` absent = bloc isolé : les quatre coins arrondis, c'est-à-dire le
 * comportement d'avant, au bit près.
 *
 * @param {{nord:boolean,est:boolean,sud:boolean,ouest:boolean}} [bords]
 * @returns {{ne:number,se:number,so:number,no:number}}
 */
export function facteursCoins(bords) {
  const b = bords || { nord: true, est: true, sud: true, ouest: true }
  return {
    ne: b.nord && b.est ? 1 : 0,
    se: b.sud && b.est ? 1 : 0,
    so: b.sud && b.ouest ? 1 : 0,
    no: b.nord && b.ouest ? 1 : 0,
  }
}

/**
 * Le rayon d'arrondi qui s'applique AU POINT (x, z) : celui de son quadrant.
 *
 * ⚠️ C'EST UNE FONCTION DU POINT, PAS DU COIN LE PLUS PROCHE. La formule du
 * clip reste celle d'avant — `max(|p| − (demi − r), 0)` puis superellipse — et
 * elle n'a besoin que d'un `r` par fragment. Choisir le quadrant par le SIGNE
 * des coordonnées suffit : le rayon ne pèse que dans le coin de son quadrant,
 * et au milieu d'un côté droit les deux composantes de la différence
 * s'annulent quel que soit `r` (voir plus bas, `dansDalle`).
 *
 * La frontière entre quadrants tombe pile sur x = 0 et z = 0, au CENTRE de la
 * dalle, à `demi` unités de tout bord : un changement de rayon y est
 * rigoureusement invisible.
 *
 * @param {number} x - abscisse LOCALE au bloc (le décalage de damier retranché)
 * @param {number} z - ordonnée locale au bloc
 * @param {number} rayon - le rayon nominal, celui que règle l'utilisateur
 * @param {{ne:number,se:number,so:number,no:number}} [facteurs]
 */
export function rayonCoin(x, z, rayon, facteurs) {
  const f = facteurs || { ne: 1, se: 1, so: 1, no: 1 }
  const k = x >= 0 ? (z >= 0 ? f.se : f.ne) : z >= 0 ? f.so : f.no
  return rayon * k
}

/**
 * Le point (x, z) survit-il au clip de surface ? LE PENDANT EXACT du shader.
 *
 * Rendu ici plutôt que dans `map/block-clip.js` pour que la règle et sa preuve
 * vivent dans le module pur : `slabInside` s'y ramène en une ligne, et les
 * tests de cette fonction sont la SEULE preuve possible du shader, faute de
 * contexte graphique.
 *
 * @param {number} x - abscisse locale au bloc
 * @param {number} z - ordonnée locale au bloc
 * @param {number} demi - le demi-côté du bloc
 * @param {number} rayon - rayon nominal des coins (0 = carré vif)
 * @param {number} exposant - l'exposant de la superellipse (2 = cercle)
 * @param {{ne:number,se:number,so:number,no:number}} [facteurs]
 */
export function dansDalle(x, z, demi, rayon, exposant, facteurs) {
  if (Math.abs(x) > demi || Math.abs(z) > demi) return false
  const r = rayonCoin(x, z, rayon, facteurs)
  if (r <= 0) return true // coin vif : la dalle va jusqu'au carré, comme le socle
  const qx = Math.max(Math.abs(x) - (demi - r), 0)
  const qz = Math.max(Math.abs(z) - (demi - r), 0)
  if (qx === 0 && qz === 0) return true
  return Math.pow(Math.pow(qx, exposant) + Math.pow(qz, exposant), 1 / exposant) <= r
}
