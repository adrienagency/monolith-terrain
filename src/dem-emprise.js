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

// ══════════ L'ATLAS DE CHAMPS — JALON 2 ═══════════════════════════════════
//
// Une seule cuisson, sur l'emprise entière, au lieu d'une par bloc traversé.
// C'est ce que le 3×3 BORNÉ offre gratuitement, et c'est la comparaison qui
// tranche (étude §2.2, banc `bench-atlas.mjs`) :
//
//   neuf dalles cuites séparément (analyse 1024² chacune) : 9 × 307 = 2 767 ms
//   un atlas 2304², à la MÊME densité que neuf dalles à 768² :      1 378 ms
//
// Deux fois moins cher, et il n'y a plus qu'un objet — donc plus qu'une échelle
// de couleurs, un p95 et une topologie de mer. C'est cette dernière ligne qui
// compte le plus : avec neuf champs, une cuvette CHANGEAIT DE COULEUR selon la
// dalle où elle tombait (`robustScale` dépend de la RÉSOLUTION du champ, pas
// seulement de son contenu — étude §4.4). L'atlas ne corrige pas ce défaut, il
// SUPPRIME LA CONDITION qui le rendait possible.
//
// 2304 sur les 168 unités de l'emprise = 13,7 px/unité, contre 27,4 pour le
// bloc central d'aujourd'hui et 18,3 pour une voisine du damier. Un cran plus
// grossier, mais la règle de `test/damier-memoire.test.js` — « aucun champ ne
// dépasse quatre fois la densité du maillage qui le porte » — est tenue avec de
// la marge : à res 384 (6,9 sommets/unité), 13,7 px/u fait 1,99×.
//
// ⚠️ 2304 DIVISE EXACTEMENT 4608, le côté du MNT recollé en tuiles 512 px.
// `resampleField` et `minPoolField` retombent alors sur la moyenne (ou le
// minimum) de blocs 2×2, le chemin entier — deux fois moins cher que le chemin
// des poids fractionnaires, pour un résultat identique. Un 2 300 « rond » aurait
// coûté le double sans rien apporter.
export const ATLAS_ANALYSE = 2304
export const ATLAS_MER = 2304

// Côté du masque côtier cuit sur l'emprise, en R8.
//
// ⚠️ CE CHIFFRE A ÉTÉ TRANCHÉ PAR COMPARAISON D'IMAGES, PAS PAR LE RAISONNEMENT
// GÉOMÉTRIQUE. L'étude (§2.1) proposait 768 par bloc comme « plancher
// défendable » et 1024 comme « marge d'un cran » à partir d'un simple compte de
// texels par pixel d'écran, en notant qu'aucune image n'avait jamais été
// comparée. Elle l'a été (voir le journal de session du jalon 2) : les chiffres
// et le verdict sont consignés au point d'appel, dans main.js.
export const ATLAS_COTE = 2304

/**
 * Le seuil de « grand bassin » d'un masque de mer, converti à l'emprise.
 *
 * ⚠️ SANS CETTE CONVERSION, LES MERS FERMÉES BASCULENT EN TERRE. `buildSeaMask`
 * garde une poche basse non connectée au bord quand elle occupe au moins 2 % du
 * champ (`minBasinFrac`) — c'est ce qui sauve la Caspienne et la mer Morte.
 * Relire ces 2 % sur une emprise de 3×3 blocs, c'est exiger NEUF FOIS la même
 * surface absolue : la mer Morte tomberait sous le seuil et se peindrait en
 * terre à l'instant précis où l'on entre en mode continu.
 *
 * La conversion garde la SURFACE ABSOLUE, à la cellule près (le test le
 * verrouille sur quatre côtes et trois résolutions) : `frac / côté²`, parce que
 * le nombre de cellules du champ, lui, est multiplié par `côté²`.
 *
 * Rend la fraction inchangée hors mode continu — 2 % restent 2 %.
 *
 * @param {number} frac fraction pour UN bloc (0,02 par défaut de sea-mask.js)
 * @param {number} cote côté de l'emprise en blocs
 */
export function fracBassinEmprise(frac, cote) {
  const c = cote > 1 ? cote : 1
  return frac / (c * c)
}

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

// Chargements de MNT en vol en même temps pendant le montage de l'emprise.
//
// ⚠️ CE CHIFFRE EST LE PIC, ET LE PIC EST LE SEUL POSTE QUI AIT JAMAIS DÉBORDÉ.
//
// L'en-tête dit qu'on refuse `tilesAcross: 9` pour éviter un pic transitoire de
// ~255 Mo, et que « neuf appels à `tilesAcross: 3` coûtent le même total sans
// le pic ». La deuxième moitié de cette phrase n'était vraie qu'à une condition
// jamais écrite : que les neuf appels ne soient pas EN VOL EN MÊME TEMPS. Ils
// l'étaient — un seul `Promise.all` sur les neuf origines (main.js) — et chaque
// `loadDem` en vol tient au passage son `ImageData` (9,4 Mo), son
// `Float32Array` (9,4 Mo), sa grille bathy et son champ fusionné avant de ne
// rendre que 4,7 Mo d'Int16. Le pic écarté par la porte est rentré par la
// fenêtre, à l'identique.
//
// ⚠️ ET IL SE MESURE RAMASSAGE FORCÉ, SINON ON MESURE LE DÉCHET.
//
// `usedJSHeapSize` lu brut pendant un chargement compte tout ce qui est MORT
// mais pas encore ramassé. Il monte à 386 Mo (La Réunion z13) qu'on borne les
// chargements ou non — c'est ce chiffre-là, lu par un banc dont le `window.gc()`
// était un no-op faute de `--js-flags=--expose-gc`, qui a fait croire à 306 et
// 453 Mo de terrain RETENU. Il n'y a rien de retenu : au repos, ramassage forcé,
// le mode continu tient en 158 Mo — MOINS que le bloc unique d'aujourd'hui
// (100 à 105 Mo de gros tampons contre 96), parce que sa géométrie est
// plafonnée à res 384 quand celle du bloc court à 768.
//
// Le PIC VIF, lui — ramassage forcé avant chaque lecture, `.banc/f3-pic-vif.mjs` :
//
//   | en vol | La Réunion z13   | Chamonix z12     |
//   |   9    | 242 Mo (+97)     | 255 Mo (+65)     |
//   |   3    | 215 Mo (+70)     | 246 Mo (+56)     |
//
// Trois en vol : ~3 × 30 Mo d'intermédiaires au lieu de ~9 × 30, pour un
// parallélisme réseau qui reste de 27 tuiles simultanées et un temps de
// chargement inchangé (2 264 ms contre 2 336 ms, dans le bruit).
//
// ⚠️ Le gain est réel mais MODESTE, et plus petit qu'on ne l'attendrait de 9→3 :
// le ramasse-miettes ne repasse pas entre deux blocs, donc une partie des
// intermédiaires « libérés » occupe encore la place quand le suivant alloue. Ne
// pas descendre à 1 en espérant y gagner trois fois plus — ce serait payer le
// réseau en série pour un gain qui n'est pas là.
export const EMPRISE_EN_VOL_MAX = 3

/**
 * Applique `charger` à chaque entrée, JAMAIS plus de `limite` à la fois.
 *
 * Rend les résultats DANS L'ORDRE DES ENTRÉES, et non dans celui des arrivées :
 * `recollerEmprise` lit ses neuf blocs en ligne-major, un tableau rangé par
 * ordre de réponse du réseau recollerait un relief faux sans lever d'erreur.
 *
 * Le premier échec remonte — main.js compte dessus pour retomber sur le bloc
 * unique plutôt que d'afficher une emprise trouée.
 *
 * @param {Array<any>} entrees
 * @param {number} limite - ramenée à 1 au minimum (une limite nulle rendrait une
 *   promesse éternelle, or le voile de chargement l'attend)
 * @param {(entree:any, rang:number) => Promise<any>} charger
 * @returns {Promise<Array<any>>}
 */
export async function enVolBorne(entrees, limite, charger) {
  const n = entrees.length
  const out = new Array(n)
  const max = Math.min(n, Math.max(1, Math.floor(limite) || 1))
  let suivant = 0
  // `max` ouvriers tirent dans la même file : dès qu'un chargement finit, son
  // ouvrier prend l'entrée suivante. Un découpage en vagues de `max` ferait
  // attendre les trois de la vague sur le plus lent des trois.
  const ouvrier = async () => {
    while (suivant < n) {
      const k = suivant++
      out[k] = await charger(entrees[k], k)
    }
  }
  await Promise.all(Array.from({ length: max }, ouvrier))
  return out
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
    if (b.zoom !== centre.zoom) throw new Error(`emprise : zoom hétérogène (${b.zoom} contre ${centre.zoom})`)
    if (b.tilePx !== centre.tilePx) throw new Error(`emprise : taille de tuile hétérogène (${b.tilePx} contre ${centre.tilePx})`)
  }
  // ⚠️ ON NE COMPARE PAS `metersPerPixel`, ET C'EST UN FAIT DE MERCATOR, PAS UN
  // RELÂCHEMENT DE LA RÈGLE.
  //
  // `metersPerPixel = 156543,03 · cos(lat) / 2^zoom · (256/tilePx)` : il DÉPEND
  // DE LA LATITUDE. Les voisins nord et sud d'une emprise ne sont donc jamais à
  // la même résolution au sol que le centre — à Chamonix (45,9°) l'écart entre
  // la rangée du haut et celle du bas atteint 0,6 %. Une première version
  // exigeait l'égalité : elle a refusé les deux zones de référence, aucune
  // emprise ne s'est jamais montée, et le drag ne bougeait pas d'un pixel.
  //
  // Recoller en espace TUILE est précisément ce qu'il faut faire : la grille de
  // tuiles est uniforme en Mercator, chaque bloc occupe exactement 3×3 tuiles,
  // et c'est déjà ainsi que le damier pose ses dalles voisines à des décalages
  // monde fixes. L'étirement de Mercator est porté par la projection, pas par
  // le recollage. `metersPerPixel` retenu est celui du centre : une valeur
  // NOMINALE, comme elle l'a toujours été pour un bloc de 21 km de large.
  //
  // Ce qui doit être homogène, et qui l'est vérifié ci-dessus, c'est la
  // GÉOMÉTRIE du recollage : même côté en pixels, même zoom, même taille de
  // tuile. Là, un écart ferait vraiment une couture.

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
