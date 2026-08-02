// QUI A LE DROIT DE DEVENIR UNE SURFACE D'EAU ANIMÉE — et pourquoi la platitude
// ne suffit plus à le décider.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node, et c'est la
// condition pour que le garde-fou (test/garde-plans-eau.test.js) puisse
// l'interroger sur du VRAI relief, hors ligne.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT, TEL QU'IL SE VOIT : « la mer qui rentre dans les côtes »
// ═══════════════════════════════════════════════════════════════════════════
//
// Brest, z12, occupation du sol allumée : des traînées d'eau bleu pâle
// DENTELÉES s'enfoncent dans les terres, loin du rivage, en formes ramifiées
// qui suivent les vallées. Le même défaut avait été rapporté un mois plus tôt
// dans la vallée du Rhône, en plaine ; il porte le même nom et il a la même
// cause, mais à Brest il se lit comme une marée, parce qu'une des nappes longe
// le rivage.
//
// ⚠️ CE N'EST PAS LA MER, ET CE N'EST PAS LE TRAIT DE CÔTE. Mesuré à Brest sur
// l'instance vivante (bloc 1 536², 12,7 m/cellule), en comparant le masque
// côtier OSM au MNT, cellule par cellule :
//
//   · le trait de côte déclare 37,78 % du bloc en mer ;
//   · de ces 891 375 cellules de mer, **88 (0,01 %) portent plus de 20 m de
//     relief** — autrement dit le trait de côte ne monte PAS dans les vallées ;
//   · des 872 618 cellules du bloc situées à 0 m ou moins, 0,24 % seulement
//     sont déclarées TERRE (les quais et les digues) ;
//   · et en peignant la rampe océan en magenta, la mer s'arrête EXACTEMENT au
//     goulet, à la rade et au port : zéro pénétration dans les terres.
//
// La proportion de pixels déclarés TERRE par le trait de côte et peints en eau
// par la mer est donc **nulle**. La vraie limite de l'eau salée à Brest — les
// abers, l'estuaire de l'Élorn, le fond de rade — est cartographiée et le
// masque la respecte. `sea-mask.js`, `bathy.js`, `coast-mask.js` et
// `mer-emprise.js` sont hors de cause, et les éteindre un à un l'a confirmé.
//
// CE QUI PEINT CETTE EAU : les PLANS D'EAU D'ALTITUDE (`src/lake.js` →
// `ocean.js`), qui ont leur propre détecteur et ne consultent ni le trait de
// côte ni le masque de mer. Vérifié par extinction : masquer le seul groupe
// `real-water-lacs` fait disparaître EXACTEMENT les dentelles bleu pâle, et
// rien d'autre. Six d'entre elles étaient posées à Brest, larges de 29 à 47 m
// au sol, à 6, 53 et 90 m d'altitude, 100 % de leurs cellules sur des terres
// que le trait de côte déclare TERRE.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA CAUSE : dem-quant.js a retiré au détecteur son seul signal
// ═══════════════════════════════════════════════════════════════════════════
//
// `detectLakes` (src/lake.js) repose sur une prémisse écrite en tête de ce
// fichier-là : « une surface d'eau est EXACTEMENT plate dans la donnée source
// (sub-métrique), là où une tolérance lâche sur une pente douce fabrique des
// bandes de contour ». La tolérance vaut 0,35 m, et c'est ce sub-métrique qui
// séparait l'eau du sol.
//
// 🔴 `dem.data` est un **Int16Array en mètres ENTIERS** depuis dem-quant.js.
// Deux voisins ne se rejoignent donc que s'ils portent le même entier : la
// tolérance RÉELLE n'est plus 0,35 m mais 1 m, toute composante est plate à
// zéro près, et comme la platitude COURT-CIRCUITE les tests de forme
// (`watery || (fill && !thin)`), ceux-là ne servent plus non plus. Le détecteur
// n'a plus aucun filtre actif au-delà du plancher d'aire.
//
// Sur une pente douce — plaine alluviale OU plateau côtier — chaque mètre
// entier découpe alors une DENTELLE de plusieurs kilomètres d'envergure.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA BONNE QUESTION : PAS « EST-CE PLAT ? » MAIS « EST-CE LARGE ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// Une bande de contour n'a pas de largeur propre : elle vaut 1 m / pente. C'est
// un artefact de PENTE, pas une étendue. Une étendue d'eau, elle, est plate
// dans LES DEUX directions — c'est la définition d'une surface libre. Exiger
// une largeur minimale, c'est exiger cette seconde dimension, celle que la
// quantification ne sait pas fabriquer.
//
// La largeur moyenne d'une forme se lit sans érosion ni squelette :
//
//     largeur = 2 × aire / périmètre
//
// (pour un ruban de longueur L et de largeur w : 2·Lw/2L = w, exactement).
//
// ⚠️ EN MÈTRES, PAS EN CELLULES. La largeur d'une dentelle est fixée par la
// PENTE DU SOL : elle vaut la même chose en mètres quelle que soit la finesse
// du MNT, tandis qu'en cellules elle double quand on double la résolution.
//
// RELEVÉ, sur les dix MNT cuits ET sur l'instance vivante (Chrome, blocs
// 1 536² de production) :
//
//   zone / objet                            | largeur | verdict
//   ----------------------------------------|---------|---------
//   Brest, dentelles de plateau             | 29-50 m | refusé  ← LE DÉFAUT
//   Annecy, terrasse urbaine                |  49 m   | refusé
//   Camargue, dentelles du delta            | 60-70 m | refusé
//   Paris, dentelles de la vallée de Seine  | 58-87 m | refusé
//   Rhône (Valence), dentelles de plaine    | 64-81 m | refusé
//   ——————————————— la frontière ————————————| 150 m  |
//   Rhône (Valence), LE FLEUVE              | 170 m   | gardé
//   Sognefjord, lac d'altitude à 1 060 m    | 284 m   | gardé
//   Serre-Ponçon, lac de barrage            | 369 m   | gardé
//   Annecy, LE LAC                          | 820 m   | gardé
//
// Le seuil est posé à **150 m**, à peu près la moyenne géométrique des deux
// camps (√(87 × 284) = 157) : un facteur ~2 de marge de chaque côté. C'est un
// PLANCHER largement sous le premier vrai plan d'eau, pas une égalité — même
// règle que scripts/verifie-dist.mjs, on attrape l'effondrement, pas le
// frémissement.
//
// CE QUE ÇA COÛTE, honnêtement : un vrai plan d'eau plus étroit que 150 m perd
// sa surface ANIMÉE (vagues, reflet, écume). Il ne disparaît pas de la carte —
// le calque vectoriel (src/map/water-layer.js, données OSM) continue de le
// peindre, et c'est d'ailleurs la source JUSTE pour un cours d'eau.
export const LARGEUR_MIN_M = 150

// ═══════════════════════════════════════════════════════════════════════════
// ET LE PLANCHER DE LONGUEUR, QUI EFFAÇAIT LES LACS QUAND ON ZOOMAIT
// ═══════════════════════════════════════════════════════════════════════════
//
// La règle d'Adrien de la v40 — « moins de 3 km dans sa plus grande dimension,
// pas de couche maritime » — écartait les zones plates urbaines que
// `detectLakes` prenait pour des plans d'eau (les taches bleues d'Annecy). Elle
// reste NÉCESSAIRE : sur la fixture paris-idf, deux terrasses bâties à 173 m
// passent le test de largeur (157 et 174 m) sans être de l'eau. La supprimer
// aurait échangé un défaut contre son symétrique.
//
// 🔴 MAIS 3 000 m EST UNE LONGUEUR ABSOLUE, ET UN BLOC RÉTRÉCIT QUAND ON ZOOME.
// Une composante ne peut pas être plus longue que le bloc qui la contient :
// dès que le bloc mesure moins de 3 km, le plancher devient INSATISFIABLE et
// TOUS les plans d'eau disparaissent, quelle que soit leur taille réelle.
//
// MESURÉ SUR L'INSTANCE VIVANTE, lac d'Annecy (27 km²), sans rien changer au
// dépôt — c'est le comportement d'AUJOURD'HUI :
//
//   zoom | largeur du bloc | plans d'eau posés
//   -----|-----------------|-------------------
//   z12  |     20,4 km     | 1  (le lac)
//   z13  |     10,2 km     | 1  (le lac)
//   z14  |      5,1 km     | 1  (le lac)
//   z15  |      2,6 km     | **0**  ← le lac d'Annecy n'existe plus
//
// C'est, mot pour mot, le « au-delà de z10, plus aucun lac ni aucune rivière »
// qui a fait annuler la tentative du 2026-08-02 — un défaut PRÉEXISTANT, que
// cette tentative n'avait pas causé mais n'avait pas vu non plus, puisqu'elle
// gardait le plancher absolu par-dessus son nouveau critère.
//
// LE PLANCHER EST DONC BORNÉ PAR LE BLOC : au-delà de 3,75 km de bloc il vaut
// 3 000 m comme avant, en dessous il vaut 80 % de la vue. « 80 % » dit la même
// chose que « 3 km sur 20 » quand on ne voit plus que le lac : occuper
// l'essentiel du champ dans sa plus grande dimension. Une dentelle peut, elle
// aussi, traverser un petit bloc — c'est le test de LARGEUR qui la refuse, et
// il est indifférent au zoom (Brest : 29-50 m à 12,7 m/cellule comme à 25,4).
//
// ⚠️ LA LARGEUR DU BLOC, PAS CELLE DE L'EMPRISE. En mode continu le champ
// recollé couvre trois blocs (`dem.extentMeters` est déjà multiplié par
// `empriseCote`, cf. dem-emprise.js) : passer l'emprise ici multiplierait le
// plancher par trois et ferait disparaître les lacs que ce correctif existe
// pour sauver. L'appelant divise, et le test « le plancher ne dépend pas de
// l'emprise » tient la règle.
export const LONGUEUR_MIN_M = 3000
export const LONGUEUR_PART_BLOC = 0.8

/**
 * Le plancher de longueur effectif pour un bloc de `blocM` mètres de côté.
 * Sans `blocM` (appelant qui ne le sait pas), on retombe sur l'absolu d'avant.
 */
export function longueurMinM(blocM) {
  return blocM > 0 ? Math.min(LONGUEUR_MIN_M, LONGUEUR_PART_BLOC * blocM) : LONGUEUR_MIN_M
}

/**
 * Mesure géométrique d'une composante de `detectLakes`, en mètres au sol.
 *
 * @param {{cells: Int32Array, size: number}} lac
 * @param {number} cellM  côté d'une cellule du MNT, en mètres
 * @param {Uint8Array} [marque]  tampon size² partagé, remis à zéro en sortant
 * @returns {{minX:number, minY:number, w:number, h:number, aire:number,
 *            longueurM:number, largeurM:number}}
 *
 * ⚠️ LE PÉRIMÈTRE IGNORE LES BORDS DE GRILLE. Un lac coupé par le bord du bloc
 * verrait sinon sa tranche comptée comme du rivage, et sa largeur mesurée
 * chuterait — un Léman à cheval sur deux blocs se serait asséché d'un côté.
 * On ne mesure que la frontière VISIBLE, qui est aussi la seule qu'on sache
 * interpréter. (C'est ce qui fait tenir le lac d'Annecy à z15, où il déborde
 * de tous les côtés : 1 032 m de large mesurés, contre 820 m à z12.)
 */
export function mesurePlanEau(lac, cellM, marque) {
  const { cells, size } = lac
  const n = cells.length
  let minX = size, maxX = -1, minY = size, maxY = -1
  // `marque` est un tampon partagé par tous les lacs d'un même appel : allouer
  // un Uint8Array(size²) par composante coûterait 2,4 Mo à chaque plan d'eau.
  const dedans = marque ?? new Uint8Array(size * size)
  for (const c of cells) {
    dedans[c] = 1
    const x = c % size
    const y = (c / size) | 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  let perimetre = 0
  for (const c of cells) {
    const x = c % size
    const y = (c / size) | 0
    if (x > 0 && !dedans[c - 1]) perimetre++
    if (x < size - 1 && !dedans[c + 1]) perimetre++
    if (y > 0 && !dedans[c - size]) perimetre++
    if (y < size - 1 && !dedans[c + size]) perimetre++
  }
  for (const c of cells) dedans[c] = 0 // rendu propre au suivant
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  return {
    minX,
    minY,
    w,
    h,
    aire: n,
    longueurM: Math.max(w, h) * cellM,
    // périmètre nul = la composante occupe toute la grille : largeur infinie,
    // pas une division par zéro.
    largeurM: perimetre > 0 ? (2 * n * cellM) / perimetre : Infinity,
  }
}

/**
 * Les composantes qui méritent une surface d'eau animée, chacune avec sa mesure.
 *
 * @param {Array<{cells: Int32Array, size: number, elevM: number}>} lacs
 * @param {{cellM:number, blocM?:number, largeurMinM?:number, longueurMinM?:number}} opts
 * @returns {Array<{lac: object, mesure: object}>}
 *
 * ⚠️ `cellM` INVALIDE REND LA LISTE ENTIÈRE, PAS UNE LISTE VIDE. C'est le
 * contraire de ce qu'on écrit d'instinct, et c'est délibéré : sans pas au sol,
 * aucune des deux règles n'a de sens, et un garde-fou qui ne sait pas juger
 * doit LAISSER PASSER plutôt que tout effacer. La version annulée du
 * 2026-08-02 rendait `[]` — un `extentMeters` manquant sur un chemin oublié y
 * aurait effacé tous les lacs de la carte en silence, ce qui est exactement le
 * reproche qui lui a été fait.
 */
export function plansEauRetenus(lacs, { cellM, blocM = 0, largeurMinM = LARGEUR_MIN_M, longueurMinM: lgMin } = {}) {
  if (!lacs?.length) return []
  const cellValide = Number.isFinite(cellM) && cellM > 0
  const marque = cellValide ? new Uint8Array(lacs[0].size * lacs[0].size) : null
  const planche = lgMin ?? longueurMinM(cellValide ? blocM : 0)
  const gardes = []
  for (const lac of lacs) {
    if (!cellValide) {
      gardes.push({ lac, mesure: null })
      continue
    }
    const mesure = mesurePlanEau(lac, cellM, lac.size * lac.size === marque.length ? marque : undefined)
    if (mesure.longueurM < planche) continue
    if (mesure.largeurM < largeurMinM) continue
    gardes.push({ lac, mesure })
  }
  return gardes
}

/**
 * La part du bloc peinte en eau animée, entre 0 et 1 — la mesure que le
 * garde-fou compare à un plafond. Une seule définition, partagée par le test et
 * par toute sonde future : deux calculs concurrents finiraient par diverger.
 */
export function partSurfaceEau(retenus, size) {
  let n = 0
  for (const r of retenus) n += r.mesure ? r.mesure.aire : r.lac.cells.length
  return n / (size * size)
}
