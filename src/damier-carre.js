// LE CARRÉ COUVRANT — la clé de voûte du damier multi-blocs.
//
// Un tracé GPX ne traverse qu'un chemin de cases, et charger ce seul chemin
// laisse des trous béants entre les cases. La règle : on prend la boîte
// englobante des cases traversées, on l'étend au CARRÉ, et on charge tout.
//
// ⚠️ POURQUOI UN CARRÉ ET PAS « LES CASES ADJACENTES À AU MOINS DEUX AUTRES ».
// Compter les adjacences ne rend PAS une forme rectangulaire : un tracé en L
// garde son L, avec le creux du L pour trou. C'est le RÉSULTAT qui est voulu
// — pas de trou, forme régulière — donc c'est lui qu'on calcule.
//
// Et ce n'est pas seulement esthétique. Le carré rend EXACTES quatre choses
// qui seraient sinon des heuristiques : quelles arêtes du socle sont
// extérieures (les arrondis), l'emprise de la mer, le tracé de sa jupe, et
// de combien les textes gravés doivent s'écarter du bloc.

import { resChamp, spanChamp } from './mer-emprise.js'

const CLE = (i, j) => `${i},${j}`

const entier = (v) => (Number.isFinite(v) ? Math.round(v) : null)

function litCles(cellules) {
  const out = []
  if (!cellules) return out
  for (const k of cellules) {
    if (typeof k !== 'string') continue
    const parts = k.split(',')
    if (parts.length !== 2) continue
    const i = entier(Number(parts[0]))
    const j = entier(Number(parts[1]))
    if (i === null || j === null) continue
    out.push([i, j])
  }
  return out
}

/**
 * Le plus petit carré qui contient les cases données ET le bloc central,
 * plafonné à `cotemax` de côté.
 *
 * ⚠️ LE BLOC CENTRAL EST TOUJOURS DEDANS, et ce n'est pas négociable : il
 * porte le cartouche gravé, la rampe hypsométrique que les voisines
 * empruntent (terrain.js:1521) et le zéro vertical commun (block-grid.js:518).
 * Un carré qui l'excluerait laisserait un bloc hors grille.
 *
 * @param {Iterable<string>} cellules - clés "i,j"
 * @returns {{i0:number, j0:number, cote:number}} coin bas-gauche inclus + côté
 */
export function carreCouvrant(cellules, { cotemax = 3 } = {}) {
  const cles = litCles(cellules)
  // le centre participe toujours à la boîte englobante
  let iMin = 0
  let iMax = 0
  let jMin = 0
  let jMax = 0
  for (const [i, j] of cles) {
    if (i < iMin) iMin = i
    if (i > iMax) iMax = i
    if (j < jMin) jMin = j
    if (j > jMax) jMax = j
  }
  const plafond = Math.max(1, Math.round(cotemax))
  const cote = Math.min(plafond, Math.max(iMax - iMin + 1, jMax - jMin + 1))
  return { i0: ancre(iMin, iMax, cote), j0: ancre(jMin, jMax, cote), cote }
}

// Où poser le carré sur un axe. On veut trois choses, dans cet ordre :
// contenir le zéro (le bloc central), rester au plus près de la boîte
// demandée, et être DÉTERMINISTE — un damier qui change de forme selon
// l'ordre d'itération d'un Set se rebâtirait à chaque synchro.
function ancre(min, max, cote) {
  // centrer sur la boîte, puis arrondir vers le bas (choix arbitraire mais fixe)
  let a = Math.floor((min + max - cote + 1) / 2)
  // ne jamais laisser sortir la boîte demandée QUAND ELLE TIENT dans le côté.
  //
  // ⚠️ Le garde-fou `tient` est indispensable : si la boîte NE tient PAS
  // (débordement plafonné), les deux corrections ci-dessous se contredisent
  // — l'une pousse l'ancre vers min, l'autre la repousse vers max — et sans
  // garde c'est la seconde qui l'emporte à chaque fois, ce qui recolle le
  // carré au bord max au lieu de le garder centré sur zéro. Repéré via le
  // test « un tracé qui déborde est ramené à 3x3 sans trou » : sans ce
  // garde-fou, carreCouvrant(['-2,-2','2,2']) rendait {i0:0} au lieu de
  // {i0:-1}, un carré [0,2] qui sort du 3x3 attendu.
  const tient = max - min + 1 <= cote
  if (tient) {
    if (a > min) a = min
    if (a + cote - 1 < max) a = max - cote + 1
  }
  // et toujours contenir le zéro
  if (a > 0) a = 0
  if (a + cote - 1 < 0) a = -(cote - 1)
  return a
}

/**
 * Toutes les cases du carré, **centre exclu** — le bloc central n'appartient
 * pas au damier (cf. block-grid.js:178, la boucle saute i===0 && j===0).
 */
export function cellulesDuCarre({ i0, j0, cote } = {}) {
  const out = new Set()
  const c = Math.max(0, Math.round(cote ?? 0))
  for (let dj = 0; dj < c; dj++) {
    for (let di = 0; di < c; di++) {
      const i = i0 + di
      const j = j0 + dj
      if (i === 0 && j === 0) continue
      out.add(CLE(i, j))
    }
  }
  return out
}

/**
 * Rétrécit le carré tant qu'il demande plus de voisines que la machine n'en
 * supporte (`damierMax` de palier-machine.js : 24/12/8/4 selon la puissance).
 *
 * ⚠️ ON RÉTRÉCIT LE CÔTÉ, ON NE RETIRE PAS DES CASES. Retirer des cases
 * rouvrirait exactement le trou que tout ce module existe pour boucher.
 */
export function carreSousPlafond(carre, damierMax) {
  const max = Number.isFinite(damierMax) ? damierMax : Infinity
  let c = { ...carre }
  while (c.cote > 1 && cellulesDuCarre(c).size > max) {
    const cote = c.cote - 1
    c = { i0: ancre(c.i0, c.i0 + c.cote - 1, cote), j0: ancre(c.j0, c.j0 + c.cote - 1, cote), cote }
  }
  return c
}

/**
 * Le centre du carré, en unités monde.
 *
 * ⚠️ UN CARRÉ DE CÔTÉ PAIR N'EST PAS CENTRÉ SUR LE BLOC PRINCIPAL : son
 * centre tombe sur une jointure. Poser la mer en (0,0) la ferait déborder
 * d'un demi-bloc d'un côté et manquer de l'autre — un défaut qui ne se voit
 * qu'en 2×2, donc rarement, donc tard.
 */
export function centreDuCarre({ i0, j0, cote } = {}, taille) {
  const c = Math.max(1, Math.round(cote ?? 1))
  return {
    x: ((i0 ?? 0) + (c - 1) / 2) * taille,
    z: ((j0 ?? 0) + (c - 1) / 2) * taille,
  }
}

/**
 * Où poser les textes du cartouche pour qu'ils restent à la MÊME distance du
 * bloc le plus proche, quelle que soit la taille de la grille.
 *
 * « Lorsqu'on a plusieurs cases, les blocs se construisent SUR les textes. Il
 * faut que les textes s'éloignent tout en restant à la même distance du bloc le
 * plus proche qu'ils le sont actuellement. » (Adrien)
 *
 * `ground-info-layer.js` pose tout son cartouche à partir d'un demi-bloc unique
 * (`HALF`) : le flanc sud à `HALF + 0,06`, l'anneau de sécurité au sol à
 * `HALF + 6`. Avec un damier ce n'est plus le demi-BLOC qu'il faut, mais le
 * demi-côté du CARRÉ — et il faut y ajouter le CENTRE du carré, qui n'est nul
 * que pour un côté impair (voir `centreDuCarre`). Oublier le centre collerait
 * tous les textes d'un seul côté en 2×2.
 *
 * La marge, elle, ne bouge JAMAIS : c'est elle, la « même distance ».
 *
 * ⚠️ L'APPELANT DOIT LIRE `BlockGrid.empriseVivante()`, PAS `carreCourant()` —
 * même règle qu'`empriseDeMer` ci-dessous, et pour la même raison.
 *
 * @param {{i0:number, j0:number, cote:number}} carre - le carré POSÉ
 * @param {number} taille - largeur d'un bloc (TERRAIN_SIZE)
 * @param {number} marge - la distance au bloc le plus proche, inchangée
 * @returns {{sud:number, nord:number, est:number, ouest:number}} en unités monde
 */
export function ecartTextes(carre, taille, marge) {
  const cote = Math.max(1, Math.round(carre?.cote ?? 1))
  const demi = (taille * cote) / 2
  const c = centreDuCarre(carre || { i0: 0, j0: 0, cote: 1 }, taille)
  return {
    sud: c.z + demi + marge,
    nord: c.z - demi - marge,
    est: c.x + demi + marge,
    ouest: c.x - demi - marge,
  }
}

/**
 * L'emprise que la mer doit couvrir pour porter tout le damier d'un seul
 * tenant : largeur au sol, résolution de champ, et centre.
 *
 * On réutilise `spanChamp`/`resChamp` de mer-emprise.js — la machinerie de la
 * fenêtre continue, mesurée et éprouvée (3×3 → 1152², 5,3 Mo) — au lieu d'en
 * écrire une seconde qui dirait la même chose autrement.
 *
 * ⚠️ L'APPELANT DOIT LUI PASSER `BlockGrid.empriseVivante()`, PAS
 * `carreCourant()` : la première dit ce qui est POSÉ (jusqu'à 5×5 en zone
 * isolée), la seconde ce que le TRACÉ a réclamé (plafonné à 3×3). Cuire la mer
 * sur la seconde la ferait trop petite pour la carte qu'elle porte, et le
 * défaut n'apparaîtrait qu'en mode zone isolée — donc tard.
 */
export function empriseDeMer(carre, taille) {
  const cote = Math.max(1, Math.round(carre?.cote ?? 1))
  return {
    span: spanChamp(taille, cote),
    res: resChamp(cote),
    centre: centreDuCarre(carre || { i0: 0, j0: 0, cote: 1 }, taille),
    cote,
  }
}

/**
 * La signature d'un carré : son côté ET son coin, en un mot.
 *
 * C'est exactement ce dont la mer a besoin pour savoir si elle doit se rebâtir
 * — deux carrés de même clé ont forcément même côté, même centre, même emprise
 * et même résolution de champ. Ici plutôt que dans `main.js` parce que le
 * nombre de reconstructions qu'elle produit sur une rafale d'arrivées est une
 * PROPRIÉTÉ MESURABLE, et qu'on ne mesure pas ce qui vit dans un fichier
 * intestable (voir test/damier-mer.test.js).
 */
export function cleDuCarre(carre) {
  const c = Math.max(1, Math.round(carre?.cote ?? 1))
  return `${c}:${carre?.i0 ?? 0},${carre?.j0 ?? 0}`
}

/**
 * Le côté que la GÉOMÉTRIE de la mer doit suivre — plan d'eau, clip, jupe.
 *
 * ⚠️ CE N'EST PAS TOUJOURS LE CÔTÉ DU CHAMP, ET LES CONFONDRE SE VOIT À LA
 * PREMIÈRE IMAGE. En mode continu le champ couvre bien trois blocs (c'est tout
 * l'objet de mer-emprise.js), mais le SOCLE reste UN bloc : c'est le relief qui
 * défile dedans, pas le bloc qui grandit. Une mer taillée sur trois blocs y
 * déborderait sur la table, sans rien pour l'arrêter — la surface ne porte
 * aucun plan de coupe, son seul arrêt est `uHalf`.
 *
 * Le damier, lui, POSE réellement les cases : là, et là seulement, la géométrie
 * suit le carré.
 *
 * @param {number} coteFenetre - côté de l'emprise CONTINUE (1 hors mode continu)
 * @param {number} coteCarre - côté du carré du DAMIER
 */
export function coteGeometrique(coteFenetre, coteCarre) {
  if (coteFenetre > 1) return 1
  return Math.max(1, Math.round(coteCarre ?? 1))
}

/**
 * Ce que la mer doit MESURER pour couvrir `cote` blocs : où elle s'arrête, la
 * largeur de sa maille, et sa segmentation.
 *
 * Pur, donc testable — `ocean.js` tire three.js et ne l'est pas. C'est la seule
 * raison pour laquelle ces trois lignes vivent ici plutôt que là-bas.
 *
 * @param {number} cote - côté GÉOMÉTRIQUE (voir coteGeometrique)
 * @param {number} rayonEau - `rayonEauDansSocle()` : où l'eau s'arrête sur UN
 *   bloc, chanfrein et marge déduits (plinth.js)
 * @param {number} taille - largeur d'un bloc (TERRAIN_SIZE)
 */
export function geometrieDeMer({ cote, rayonEau, taille }) {
  const c = Math.max(1, Math.round(cote ?? 1))
  // ⚠️ LE RETRAIT NE SE MULTIPLIE PAS. `rayonEau` vaut `taille/2 − chanfrein −
  // marge` : le multiplier par le côté multiplierait AUSSI les 0,22 unité de
  // retrait, et l'eau d'un 3×3 s'arrêterait à 83,34 au lieu de 83,78 — 0,44
  // unité de socle nu tout autour, dans un chantier qui tient ces nombres à six
  // MILLIÈMES près (plinth.js:64-77). Le retrait est celui du bord EXTÉRIEUR,
  // et il n'y en a qu'un.
  const demiEau = rayonEau + (taille / 2) * (c - 1)
  // ⚠️ LA MAILLE DOIT DÉBORDER LE CLIP, PAS L'INVERSE : c'est `demiEau` qui
  // arrête l'eau, la maille ne fait que la porter. Le facteur 0,998 suffisait
  // sur un bloc (27,944 contre 27,78) et sur un 3×3 (83,832 contre 83,78), mais
  // repassait SOUS le clip au 5×5 — 139,72 contre 139,78 — et rognait un cheveu
  // de mer sur tout le pourtour. À `cote = 1` le maximum retombe sur
  // l'expression d'avant, au bit près.
  const large = Math.max(taille * c * 0.998, (demiEau + 0.05) * 2)
  // ⚠️ LA SEGMENTATION NE SUIT PAS L'EMPRISE LINÉAIREMENT, ET LE PLAFOND DE 384
  // EST MESURÉ (Tâche 7 — il était provisoire).
  //
  // L'ÉTALON EST LE BLOC SEUL : 256 segments sur 55,888 unités, soit 4,581
  // segment/unité. C'est la seule mer de ce dépôt qu'un œil humain ait validée
  // (« vraiment top », Adrien, captures du 2026-08-05) ; toute segmentation de
  // damier se lit donc en pourcentage de celle-là.
  //
  // LES TROIS SEGMENTATIONS, SUR UN DAMIER 3×3 (scripts rejouables dans
  // .superpowers/sdd/2026-08-05-damier-multi-blocs/ : mesure-segmentation.mjs
  // pour les colonnes de gauche, banc-mer.html pour le GPU) :
  //
  //   seg   quadrilatères   construction   mémoire   GPU/image   densité
  //   256      65 536          11,8 ms      3,5 Mo    0,042 ms   33 % ← replie
  //   384     147 456          30,3 ms      7,9 Mo    0,057 ms   50 % ← retenu
  //   512     262 144          55,1 ms     14,0 Mo    0,139 ms   67 %
  //   768     589 824         134,1 ms     31,5 Mo    0,244 ms  100 %
  //
  // (construction : `new THREE.PlaneGeometry` + `rotateX`, médiane de 5, node
  // 24 / three 172, Ryzen 9 5900X. GPU : temps GPU réel par image, requête
  // temporelle WebGL2, 1920×1080, RTX 3080, caméra de survol.)
  //
  // CE QUI DÉCIDE N'EST PAS LE GPU. À 0,057 ms par image, la mer d'un 3×3 coûte
  // 0,34 % d'une image à 60 Hz sur cette carte — et même 768 n'en coûterait que
  // 1,5 %. Ce qui décide, c'est la CONSTRUCTION sur le fil principal : elle est
  // payée à chaque changement de FORME du carré (jusqu'à quatre fois sur un
  // remplissage, cf. `cleDuCarre` et main.js:5175), dans le même tour de boucle
  // synchrone que l'égalisation des murs et le socle du héros. 384 y met 30 ms ;
  // 512 en mettrait 55, sur un pic d'arrivée déjà mesuré à 74 ms.
  //
  // ET L'ESCALIER DE CRÊTE ? À 384 sur un 3×3, la maille fait 0,437 unité. Les
  // longueurs d'onde du spectre (ocean-waves : 2,5 à 26 « mètres de spectre »,
  // × `lenSea` ∈ [0,231 ; 0,420]) donnent 0,58 à 10,9 unités. La houle dominante
  // garde 7 à 19 segments par longueur d'onde : elle ne peut pas faire d'angles.
  // Seule la mer du VENT la plus courte tombe à 1,3 segment au zoom large —
  // sous Nyquist, donc repliée. Elle l'est DÉJÀ à 2,6 sur le bloc seul, et
  // ocean.js:54-57 documente ce compromis depuis la v39. 256 la ferait tomber à
  // 0,9 et emporterait aussi la mer du vent du zoom de course : c'est ce qui
  // écarte 256, pas le GPU.
  //
  // ⚠️ CE QUI N'A PAS ÉTÉ VÉRIFIÉ : l'escalier VU À L'ŒIL. Aucun agent de ce
  // chantier n'a eu de session graphique. Le critère ci-dessus est géométrique.
  // `banc-mer.html?voir=512` affiche la crête à la caméra la plus basse, en un
  // clic, pour trancher à l'œil le jour où quelqu'un regarde.
  const seg = Math.min(384, 256 * c)
  return { demiEau, large, seg, cote: c }
}
