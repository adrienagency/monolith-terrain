// L'EMPRISE 3×3 — neuf MNT recollés en UN SEUL champ.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node.
//
// ══════════ POURQUOI UN SEUL CHAMP, ET PAS NEUF DALLES ══════════════════════
//
// C'est la conclusion principale de l'étude 3×3 (§3.2/§3.3), et elle ne porte
// pas d'abord sur la mémoire :
//
//   | | neuf dalles qui défilent | une fenêtre sur UN champ |
//   | mémoire du terrain      |      ~430 Mo |    109 Mo |
//   | sommets par image       |      594 441 |   148 225 |
//   | coutures à recoudre     |            4 |    AUCUNE |
//   | statistiques globales   | à geler une par une | par construction |
//
// La dernière ligne est la vraie raison. Avec neuf champs, chacun a son échelle
// de couleurs, son p95, sa topologie de mer — et une cuvette CHANGEAIT DE
// COULEUR selon la dalle où elle tombait. Avec un seul champ, la question
// n'existe plus : un champ, une échelle, une topologie.
//
// ══════════ CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS ══════════════════
//
// Il RECOLLE, il ne rééchantillonne pas : `metersPerPixel` est identique, seul
// `extentMeters` triple. Le champ obtenu a exactement la forme que rend
// `loadDem` (dem.js:519), donc `sampleDem` et tout ce qui lit un `dem` le
// lisent sans savoir qu'il est trois fois plus grand.
//
// ⚠️ IL NE DEMANDE PAS `tilesAcross: 9` À `loadDem`, et c'est délibéré : celui-ci
// peindrait un canevas 4608², en lirait l'ImageData et la décoderait — un pic
// transitoire de ~255 Mo, inacceptable sur l'iMac 2015. Neuf appels à
// `tilesAcross: 3` avec neuf `originTile` coûtent le même total sans le pic.
//
// ══════════ LES DEUX STATISTIQUES QUI NE SE TRAITENT PAS PAREIL ═════════════
//
// `minM`/`maxM` — SUR L'EMPRISE ENTIÈRE. C'est la septième statistique globale
// de l'étude, celle qui manquait à la liste : `uHeightRange` normalise la rampe
// de couleurs ET l'amplitude des sommets. Si elle restait celle du centre, une
// voisine plus haute verrait ses sommets SATURER — un massif entier peint d'une
// seule couleur dès qu'on défile vers lui.
//
// `meanM` — CELUI DU CENTRE, et surtout pas la moyenne des neuf. `meanM` ne
// normalise rien : c'est le ZÉRO VERTICAL, ce qui cale le terrain en hauteur.
// Le prendre sur l'emprise ferait sauter le relief de plusieurs centaines de
// mètres à l'instant précis où l'on entre en mode continu, alors que la règle
// est qu'à décalage nul l'image doit être IDENTIQUE à celle d'aujourd'hui.

// Le 3×3 borné qu'Adrien a fixé. Ce n'est pas un réglage à faire varier : toute
// l'architecture (une seule géométrie, tout précuit au chargement, aucune mise
// à jour torique) ne tient QUE parce que l'emprise est finie et petite.
export const EMPRISE_COTE = 3

/**
 * Les neuf origines de tuile d'une emprise centrée sur un bloc.
 *
 * Rendues en LIGNE-MAJOR (gauche→droite, puis haut→bas), l'ordre que
 * `recollerEmprise` attend et celui dans lequel `block-grid.js` raisonne déjà.
 *
 * @param {{originTileX:number, originTileY:number}} centre - le bloc central
 * @param {number} tilesAcross - tuiles par bloc (3 aujourd'hui)
 * @returns {Array<{x:number,y:number}>} neuf origines
 */
export function originesEmprise(centre, tilesAcross) {
  const o = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      o.push({ x: centre.originTileX + dx * tilesAcross, y: centre.originTileY + dy * tilesAcross })
    }
  }
  return o
}

/**
 * Recolle neuf blocs de MNT en un champ unique de 3×3 blocs.
 *
 * @param {Array<object>} blocs - neuf blocs rendus par `loadDem`, en ligne-major
 * @returns {object} un champ de la MÊME forme qu'un bloc de `loadDem`
 */
export function recollerEmprise(blocs) {
  const n = EMPRISE_COTE * EMPRISE_COTE
  if (!Array.isArray(blocs) || blocs.length !== n) throw new Error(`emprise : il faut neuf blocs, reçu ${blocs?.length}`)
  for (let k = 0; k < n; k++) if (!blocs[k]?.data) throw new Error(`emprise : bloc manquant au rang ${k}`)

  const centre = blocs[4]
  const cote = centre.size
  for (const b of blocs) {
    if (b.size !== cote) throw new Error(`emprise : taille de bloc hétérogène (${b.size} contre ${cote})`)
    // ⚠️ Zoom ET metersPerPixel : deux blocs de même zoom mais servis par des
    // sources différentes n'ont pas la même résolution au sol, et les recoller
    // ferait une couture invisible en mémoire mais bien visible à l'écran.
    if (b.zoom !== centre.zoom) throw new Error(`emprise : zoom hétérogène (${b.zoom} contre ${centre.zoom})`)
    if (b.metersPerPixel !== centre.metersPerPixel) throw new Error(`emprise : résolution au sol hétérogène`)
  }

  const size = cote * EMPRISE_COTE
  const data = new Int16Array(size * size)
  let minM = Infinity
  let maxM = -Infinity
  for (let k = 0; k < n; k++) {
    const b = blocs[k]
    const ox = (k % EMPRISE_COTE) * cote
    const oy = ((k / EMPRISE_COTE) | 0) * cote
    // Recopie ligne par ligne : `set` sur une sous-vue est la voie rapide
    // (memcpy natif), et elle rend le rangement ligne-major explicite.
    for (let y = 0; y < cote; y++) data.set(b.data.subarray(y * cote, y * cote + cote), (oy + y) * size + ox)
    if (b.minM < minM) minM = b.minM
    if (b.maxM > maxM) maxM = b.maxM
  }

  return {
    data,
    size,
    tilePx: centre.tilePx,
    demSource: centre.demSource,
    maxZoom: centre.maxZoom,
    metersPerPixel: centre.metersPerPixel,
    // Trois blocs de large : l'étendue au sol triple, la résolution ne bouge pas.
    extentMeters: centre.extentMeters * EMPRISE_COTE,
    minM,
    maxM,
    // le ZÉRO VERTICAL, pas une normalisation — voir l'en-tête
    meanM: centre.meanM,
    // le centre de l'emprise EST le centre du bloc central
    lat: centre.lat,
    lon: centre.lon,
    zoom: centre.zoom,
    // ⚠️ le géoréférencement est celui du coin HAUT-GAUCHE de l'emprise, pas du
    // centre : c'est lui que `geo.js` lit pour convertir lat/lon ↔ XZ monde.
    originTileX: blocs[0].originTileX,
    originTileY: blocs[0].originTileY,
    // marqueur : les lecteurs qui doivent savoir qu'ils tiennent une emprise et
    // non un bloc (le socle, les statistiques globales) le lisent ici.
    empriseCote: EMPRISE_COTE,
  }
}
