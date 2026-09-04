// LA MER SUR LA SPHÈRE — Tâche F du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// Module PUR : ni DOM, ni three.js, ni état. Testable sous node
// (`test/mer-sphere.test.js`), comme `crop-sphere`, `parois-crop`,
// `habillage-crop` et `rampe-crop` avant lui.
//
// ══════════ 0. CE QUE CETTE TÂCHE CHANGE ═══════════════════════════════════
//
// **Décision 5 d'Adrien, tranchée le 2026-08-21 :** « la mer riche est PARTOUT,
// DÉGRADÉE AVEC LA DISTANCE ». Et : « la mer devra aussi être recalculée ».
//
// Aujourd'hui la mer est **un plan à hauteur fixe cuit sur une grille plate** :
// `ocean.js` bâtit une `PlaneGeometry`, la couche à `mesh.position.y = seaBase`,
// et rien dans ce fichier ne connaît la courbure. À l'échelle du bloc l'erreur
// est petite — **2,13 m** sur les 10,4 km que le §3 du plan lui prête, **3,68 m**
// sur les **13 690 m** que `largeurCropM` mesure réellement au crop de La
// Réunion (3 tuiles z13, lat −21,1°). ⚠️ **Les deux chiffres sortent de la MÊME
// loi et ne se contredisent pas** : 2,13 × (13 690 / 10 419)² = 3,68. Ils
// diffèrent parce qu'ils ne mesurent pas la même largeur, et il fallait le dire
// plutôt que de reprendre celui du plan de confiance.
//
// Sur la nappe que la décision 5 réclame, en revanche, la même erreur vaut
// **784,79 m à 100 km** et **32 274 m à l'horizon du seuil de naissance du
// socle**. Le plan ne tient plus.
//
// ══════════ 1. LA FLÈCHE, ET POURQUOI ELLE NE S'ÉCRIT PAS `1 − cos` ════════
//
// La flèche (sagitta) d'un arc de longueur `d` sur une sphère de rayon `R` :
//
//     f = R (1 − cos(d/R))  =  2 R sin²(d/2R)
//
// Les deux expressions sont égales en mathématiques. **Elles ne le sont pas en
// flottant** : la première soustrait deux nombres voisins de 1 et perd ses
// chiffres significatifs par annulation. Mesuré (`.banc/rejoue-F.mjs`), à
// `d = 6 m` : `1 − cos` rend **2,825048·10⁻⁶** là où la valeur exacte vaut
// **2,825302·10⁻⁶** — **quatre chiffres perdus**. La seconde forme n'a aucune
// soustraction et reste exacte.
//
// ⚠️ **CE N'EST PAS UN RAFFINEMENT THÉORIQUE :** la maille de la calotte est
// évaluée sommet par sommet, et deux sommets voisins d'une grille fine sont
// séparés de quelques mètres. Une flèche fausse au quatrième chiffre à cette
// échelle, c'est une surface qui **ondule** au lieu d'être lisse.
//
// ══════════ 2. LE REPÈRE — CELUI DES PAROIS, PAS UN JUMEAU ═════════════════
//
// La calotte vit dans le repère local du crop : origine au centre, sur la
// SPHÈRE NUE, base directe **(est, haut, sud)**. C'est **exactement** celui de
// `construireSolideCrop`, et ce module l'obtient en APPELANT `repereLocalCrop`
// (extraite de `parois-crop.js` par cette tâche), pas en la recopiant.
//
// ⚠️ **SI LA MER ET LA PAROI N'AVAIENT PAS LA MÊME BASE, L'EAU NE RENCONTRERAIT
// PAS LE MUR** — le liseré que `fenetre-clip.js` raconte avoir déjà payé une
// fois, à une dimension de plus. Et c'est la question 2 du §1 de
// `/threejs-optimisation` : une constante recopiée diverge en silence.
//
// ══════════ 3. LE NIVEAU DE LA MER, ET SON EPSILON ═════════════════════════
//
// `globe.js` (`_buildMesh`, `posAt`) pose ses sommets à
// `Math.max(sampleHeights(...), 0)` — « oceans stay on the sphere ». **Le fond
// marin du globe est donc EXACTEMENT sur la sphère de rayon `R_GLOBE`**, et une
// surface de mer posée là aussi se disputerait le même plan : le scintillement
// de profondeur (z-fighting) sur **tout** l'océan.
//
// `ocean.js` connaît ce défaut et le nomme : « il ne reste que l'epsilon de
// coplanarité : sans lui la surface et le trait de côte se disputent le même
// plan et scintillent ». Il vaut **0,003 unité de scène sur un bloc de 56**.
//
// ⚠️ **ET IL SE CONVERTIT, IL NE SE RECOPIE PAS.** Posé tel quel sur le globe,
// `0,003` unité de scène vaut, à l'exagération 2,8,
// `0,003 / (R_GLOBE / EARTH_RADIUS_M) / 2,8 = 68,3 mètres` de niveau de la mer :
// une marée de soixante-huit mètres sur toute la planète. C'est la faute
// symétrique de celle que `habillage-crop.js` raconte pour la marge de côte
// (« le recopier tel quel aurait donné deux centimètres »), et elle est du même
// ordre de gravité dans l'autre sens. `epsilonMerDuCrop` fait la conversion.
//
// ══════════ 4. LA DÉGRADATION — CE QU'ELLE NE DOIT SURTOUT PAS ÊTRE ════════
//
// `ocean.js` fond DÉJÀ sa mer avec la distance : `uViewCalm = 0.08 + 0.92·calm`
// et `uSurfCalm = 0.08 + 0.92·…`. **Mais ces deux facteurs MULTIPLIENT le
// résultat : le travail est fait puis mis à zéro.** L'Étape 1 de cette tâche l'a
// mesuré (`.banc/mesure-F.js`, sorties brutes dans `.banc/F1-brut.json`) :
//
// | station | uSurfCalm | mer riche − témoin | par Mpx couvert |
// |---|---|---|---|
// | 2 093 m | **1,000** | 0,0461 ms | 0,0569 |
// | 6 978 m | 0,717 | 0,0419 ms | 0,0660 |
// | 15 701 m | **0,080** | 0,0266 ms | **0,0974** |
//
// **Le coût par pixel de mer ne baisse pas avec la distance : il MONTE**, parce
// que la part FIXE s'amortit sur moins de pixels. Ajustement affine sur les
// trois stations : **0,0372 ms/Mpx + 0,0169 ms de fixe** (résidus ≤ 0,0014 ms).
// Autrement dit : **la richesse s'éteint à l'écran sans que le travail diminue.**
//
// D'où la loi de ce module : une **richesse** dans [0, 1] qui vaut EXACTEMENT 1
// avant sa bande et EXACTEMENT 0 après, pour que l'appelant puisse SAUTER le
// calcul au-delà — pas le multiplier par 0,08.
//
// ⚠️ **ET « EXACTEMENT ZÉRO » EST LA PROPRIÉTÉ CENTRALE, PAS UN DÉTAIL.** Avec
// le plancher de `ocean.js`, sauter le calcul au bout de la bande ferait
// disparaître d'un coup 8 % de l'effet : **une marche visible, c'est-à-dire
// exactement ce que la décision 5 interdit.** `.banc/rejoue-F.mjs` rejoue cette
// loi sous le nom `PLANCHER`, et l'assertion F5 la tue.
//
// ══════════ 5. OÙ SE PLACE LA BASCULE — DÉRIVÉE, PAS CHOISIE ═══════════════
//
// Le plan dit « À MESURER ». La mesure a besoin d'une LOI à confirmer ou à
// réfuter, sinon elle ne fait que choisir un nombre. La loi est
// l'échantillonnage : un détail de longueur d'onde `λ` a besoin d'au moins deux
// pixels par période pour exister à l'écran (Nyquist). Un pixel couvre
// `2 d tan(fov/2) / hauteurPx` au sol. Le détail meurt donc à
//
//     d = λ · hauteurPx / (2 · parDetail · tan(fov/2))
//
// ⚠️ **`parDetail` N'EST PAS UN GOÛT : 2 EST LA BORNE DE NYQUIST**, en dessous
// de laquelle le détail n'est plus représenté mais REPLIÉ (aliasing). L'Étape 4
// mesure si 2 suffit *perceptivement* ; c'est elle qui a le dernier mot, et son
// chiffre est dans le compte rendu.

import { latLonDeLocal } from './crop-sphere.js'
import { MERCATOR_LAT_MAX } from './seuil-socle.js'
import { repereLocalCrop, surSphere, contourCrop, PAS_CONTOUR } from './parois-crop.js'
import {
  unitesEnMetres,
  largeurCropM,
  COTE_CROP_UNITES,
  EXAG_SOCLE_NOMINALE,
} from './habillage-crop.js'

// ══════════ ① LA FLÈCHE ════════════════════════════════════════════════════

/**
 * La flèche d'un arc de longueur `distance` sur une sphère de rayon `rayon`,
 * dans la même unité que les deux.
 *
 * ⚠️ **`2 R sin²(θ/2)`, ET JAMAIS `R (1 − cos θ)`** — voir le §1 de l'en-tête :
 * la seconde forme perd quatre chiffres significatifs à six mètres.
 */
export function fleche(distance, rayon) {
  if (!(rayon > 0) || !Number.isFinite(distance)) {
    throw new TypeError('fleche : `distance` finie et `rayon` > 0 sont obligatoires')
  }
  const s = Math.sin(distance / rayon / 2)
  return 2 * rayon * s * s
}

// ══════════ ② L'EPSILON DE COPLANARITÉ ═════════════════════════════════════

/**
 * L'epsilon de coplanarité du socle, en UNITÉS DE SCÈNE.
 *
 * ⚠️ **CE NOMBRE VIENT DU DÉPÔT, PAS DE MON INSTINCT** : `ocean.js` écrit
 * `this._seaBase = seaY + 0.003`, et la ligne au-dessus dit pourquoi — « sans
 * lui la surface et le trait de côte se disputent le même plan et scintillent ».
 * Le §0 du plan interdit un chiffre sans sa source.
 */
export const EPS_COPLANARITE_UNITES = 0.003

/**
 * L'epsilon de coplanarité EN MÈTRES pour un crop donné — c'est-à-dire de
 * combien la surface de la mer se pose au-dessus du niveau zéro.
 *
 * ⚠️ **CONVERTI, EXACTEMENT COMME `margeCoteM` ET `plancherAmplitudeM`.** Voir
 * le §3 de l'en-tête : recopier `0,003` côté globe donnerait **68,3 m** de
 * marée.
 */
export function epsilonMerDuCrop(repere, exageration = EXAG_SOCLE_NOMINALE) {
  return unitesEnMetres(EPS_COPLANARITE_UNITES, largeurCropM(repere) / COTE_CROP_UNITES, exageration)
}

// ══════════ ②bis LE BUDGET DE PROFONDEUR ═══════════════════════════════════

/**
 * Le budget de profondeur du socle, en UNITÉS DE SCÈNE.
 *
 * ⚠️ **CE NOMBRE VIENT DU DÉPÔT** : `ocean.js` pose `uDepthMax = 2.2` quand la
 * colonne bathymétrique est réelle (0,75 sinon). C'est la profondeur à laquelle
 * la mer lit « pleine teinte » ; **le glacis clair des lagons vit sur les 15 %
 * du bas de ce budget**, ce que le nuanceur écrit noir sur blanc (« une baie de
 * 30 m est un lagon »).
 */
export const BUDGET_PROFONDEUR_UNITES = 2.2

/**
 * Le budget de profondeur, EN MÈTRES, pour un crop donné.
 *
 * ⚠️ **ET CE N'EST SURTOUT PAS LA PROFONDEUR RÉELLE DU FOND — LA PREMIÈRE
 * VERSION A FAIT CETTE FAUTE, ET ELLE SE VOIT À L'ŒIL.** La calotte prenait
 * pour budget le maximum du champ, soit **4 310 m** au large de La Réunion une
 * fois la bathymétrie GEBCO fusionnée. Le glacis de lagon couvrait alors tout ce
 * qui est **sous 646 m** — c'est-à-dire tout le plateau insulaire — et la mer
 * peignait la côte en cyan pâle sur des kilomètres. Sur le socle le même glacis
 * ne couvre que les **29 premiers mètres**.
 *
 * Converti comme `margeCoteM`, `plancherAmplitudeM` et `epsilonMerDuCrop` : par
 * la largeur au sol du crop et l'exagération. Sur le crop de La Réunion il vaut
 * **192 m**, contre 384 m sur le socle — les deux ne diffèrent que parce que le
 * MNT du socle couvre 27 354 m quand le crop en couvre 13 690.
 */
export function budgetProfondeurM(repere, exageration = EXAG_SOCLE_NOMINALE) {
  return unitesEnMetres(BUDGET_PROFONDEUR_UNITES, largeurCropM(repere) / COTE_CROP_UNITES, exageration)
}

/**
 * Le seuil d'anticrénelage du trait d'eau du socle, en UNITÉS DE SCÈNE.
 *
 * ⚠️ **CE NOMBRE VIENT DU DÉPÔT** : `ocean.js` écrit
 * `float shoreAA = smoothstep(0.0, 0.02, depth)`. C'est la profondeur sur
 * laquelle la lame d'eau monte de transparente à sa transparence nominale — la
 * frange d'un trait de côte, **3,5 mètres d'eau** sur le socle.
 *
 * ⚠️ **ET C'EST LA TROISIÈME CONSTANTE DE CE FICHIER QUE RECOPIER AURAIT
 * RUINÉE, CELLE-CI À L'ŒIL.** Posée telle quelle sur le globe, `0,02` unité de
 * scène vaut **455 mètres d'eau** : toute la mer côtière devenait
 * semi-transparente, le fond olive du globe se lisait à travers, et la côte
 * rendait un turquoise pâle sur des kilomètres. Relevé pixel par pixel — au
 * centre du cadre la mer ne couvrait le fond qu'à **24 %**.
 */
export const SEUIL_TRAIT_EAU_UNITES = 0.02

/** Le seuil d'anticrénelage du trait d'eau, EN MÈTRES, pour un crop donné. */
export function seuilTraitEauM(repere, exageration = EXAG_SOCLE_NOMINALE) {
  return unitesEnMetres(SEUIL_TRAIT_EAU_UNITES, largeurCropM(repere) / COTE_CROP_UNITES, exageration)
}

// ══════════ ②ter L'ÉCHELLE DE HOULE ═══════════════════════════════════════

/**
 * L'échelle de houle du socle, en UNITÉS DE SCÈNE PAR MÈTRE DE SPECTRE.
 *
 * ⚠️ **CE NOMBRE VIENT DU DÉPÔT, ET IL EST DÉLIBÉRÉMENT SURDIMENSIONNÉ.**
 * `ocean.js` pose `LEN_SCALE = 0.42` et l'explique : « 0,12 était mis à
 * l'échelle *physiquement* — la mer du vent passait sous la maille (invisible :
 * un seul train de houle se lisait à l'écran) et toute la mer était trop
 * calme. 0,42 est délibérément surdimensionné : les deux systèmes croisés se
 * résolvent, la mer se lit COOL plutôt que réaliste (choix d'Adrien). »
 */
export const ECHELLE_HOULE_UNITES = 0.42

/**
 * L'échelle de houle, EN MÈTRES DE SCÈNE PAR MÈTRE DE SPECTRE, pour un crop.
 *
 * ⚠️ **HORIZONTALE, DONC PAS DIVISÉE PAR L'EXAGÉRATION** — à la différence de
 * `epsilonMerDuCrop`, de `margeCoteM` et de `plancherAmplitudeM`, qui sont des
 * hauteurs. Diviser par 2,8 ici allongerait la houle d'autant.
 *
 * ⚠️ **ET LA PREMIÈRE VERSION PRENAIT LE PAS DE LA MAILLE À LA PLACE, CE QUI SE
 * VOIT À L'ÉCRAN.** À portée 12 et pas 256 la maille fait 688 m ; les trains du
 * spectre (12 à 24 mètres de spectre) devenaient alors des houles de **8 à
 * 16 km**, c'est-à-dire plus longues que tout ce que le cadre montre au-dessus
 * du socle. Mesuré : la mer riche et la mer plate rendaient **exactement la même
 * image** (ΔE = 0) jusqu'à 12,7 km d'altitude. Avec cette échelle-ci, un train
 * de 12 m de spectre fait **1,23 km** — le même rapport à la largeur du bloc que
 * sur le socle.
 */
export function echelleHouleM(repere) {
  return (ECHELLE_HOULE_UNITES * largeurCropM(repere)) / COTE_CROP_UNITES
}

// ══════════ ②quater LA RAMPE NAUTIQUE DU FOND ══════════════════════════════

/**
 * Les trois couleurs du fond marin du socle.
 *
 * ⚠️ **CE SONT CELLES DE `terrain.js:376-378`, AU CARACTÈRE PRÈS**, et c'est la
 * pièce que la Tâche D avait nommée sans la prendre : « le socle peint la mer
 * par une rampe nautique à TROIS couleurs (`uOceanShallow/Mid/Deep`) […] la
 * réconcilier suppose de toucher à la mer, c'est-à-dire la Tâche F ».
 *
 * ⚠️ **ET C'EST CE QU'ON VOIT.** Côte à côte (`.banc/vues/W-socle-bloc.jpg`), le
 * socle rend une mer presque NOIRE au large avec une frange TURQUOISE étroite au
 * littoral. Cette frange n'est pas la lame d'eau : c'est le FOND, vu au travers.
 * Le globe peignait le même fond avec le bas de sa propre table hypsométrique —
 * un olive sombre sans frange.
 */
export const RAMPE_NAUTIQUE = Object.freeze({
  peu: '#dce8ec',
  moyen: '#7fa8b8',
  fond: '#31576b',
})

/**
 * Les trois couleurs VIVANTES du fond marin du socle — Tâche P5.
 *
 * ⛔ **`RAMPE_NAUTIQUE` CI-DESSUS N'EST PAS LA PALETTE : C'EST LE DÉFAUT DE
 * `terrain.js`** (`params.oceanShallow ?? '#dce8ec'`). Le socle ne vit JAMAIS
 * dessus en production : `main.js` y écrit `params.ocean*` à chaque palette, et
 * le panneau « Sea » y écrit en plus un fond de `SEABEDS` (le gabarit
 * d'ouverture pose « lagoon »). Relevé le 2026-08-22 dans la page vivante, La
 * Réunion z12 : le socle porte **`#c8f2e4` / `#62cfc1` / `#136e7d`**, la calotte
 * **`#dce8ec` / `#7fa8b8` / `#31576b`** — les défauts.
 *
 * ⚠️ **C'EST LA MÊME FAUTE QUE LA COULEUR DES PAROIS (manque n° 2 du noteur) ET
 * QUE `uSky` (Tâche P4), AU MÊME ENDROIT DU MÊME OBJET** : un défaut de module
 * gelé dans un uniforme que personne ne repose. `poserMer` portait bien un
 * paramètre `couleursFond` — **aucun appelant ne l'a jamais passé**, et c'est
 * pourquoi il disparaît au profit d'un écrivain unique par image.
 *
 * ⚠️ **ELLE NE CALCULE RIEN, ELLE LIT.** Les seuls écrivains de ces trois
 * valeurs restent `applyPalette` et le panneau « Sea » ; les redériver ici
 * ferait deux palettes à garder d'accord — la faute que D13 §③ nomme, et celle
 * que P2 a évitée en prenant `terrain.mapUniforms.uRampTex` tel quel.
 *
 * ⚠️ **ELLE PREND TROIS COULEURS, PAS LA POIGNÉE DES UNIFORMES DU SOCLE**, et
 * ce n'est pas un goût : `test/damier-uniformes.test.js` ③ INTERDIT de céder
 * `terrain.mapUniforms` en bloc — « un module qui la reçoit écrit dedans quand
 * il veut, et aucune des deux autres propriétés de ce fichier ne le voit
 * passer ». C'est la même règle que `contexteCrop` suit déjà (« les uniformes se
 * lisent un par un, jamais en bloc »). Le test l'a attrapé à la première
 * écriture de cette tâche.
 *
 * @param {object|null} peu la couleur du haut-fond (`uOceanShallow`)
 * @param {object|null} moyen la couleur intermédiaire (`uOceanMid`)
 * @param {object|null} fond la couleur d'abysse (`uOceanDeep`)
 * @returns {{peu:object, moyen:object, fond:object}|null} les trois `Color`
 *   VIVANTES du socle, ou `null` si l'une des trois manque — **on ne pose jamais
 *   un demi-triplet** : deux couleurs du socle et une du défaut seraient pires
 *   que les trois du défaut, exactement comme le demi-couple d'accalmies de P4.
 */
export function couleursFondDuSocle(peu, moyen, fond) {
  if (!peu?.isColor || !moyen?.isColor || !fond?.isColor) return null
  return { peu, moyen, fond }
}

/**
 * Les deux couleurs de la LAME D'EAU du socle — Tâche P6.
 *
 * ⛔ **LA MÊME FAUTE QUE `couleursFond` CI-DESSUS, UN CRAN PLUS HAUT, ET ELLE A
 * SURVÉCU À P5 PARCE QUE LE DÉFAUT COÏNCIDAIT.** `poserMer` porte un paramètre
 * `couleurs` depuis la Tâche F ; **aucun appelant ne l'a jamais passé**, donc la
 * calotte vit sur `couleursEau({})`, c'est-à-dire sur
 * `params.lakeColor ?? '#8fc6e8'` — **le DÉFAUT, pas la palette.**
 *
 * ⚡ **ET LE RELEVÉ DU 2026-08-22 A FAILLI DIRE « BRANCHÉ »** : les deux côtés
 * rendaient `#88d2e1` / `#184465`, au caractère près… parce que
 * `params.lakeColor` valait justement `#8fc6e8`. **Le témoin l'a dit** : posé à
 * `#c81e1e` dans la page VIVANTE, le socle est passé à `#a77572` / `#1e3350` et
 * **la calotte n'a pas bougé d'un bit** ; le retour rend les deux valeurs de
 * départ. ➡️ **Une concordance au défaut n'est PAS un branchement**, et c'est la
 * leçon de méthode de la Tâche P6.
 *
 * ⚠️ **DEUX COULEURS, PAS LA POIGNÉE** — même règle que `couleursFondDuSocle`,
 * et même refus du demi-couple : une couleur du socle et une du défaut seraient
 * pires que les deux du défaut.
 *
 * @param {object|null} peu le glacis clair (`uShallowT` d'`ocean.js`)
 * @param {object|null} fond le bleu du large (`uDeep` d'`ocean.js`)
 * @returns {{peu:object, fond:object}|null}
 */
export function couleursEauDuSocle(peu, fond) {
  if (!peu?.isColor || !fond?.isColor) return null
  return { peu, fond }
}

/**
 * La profondeur maximale du champ **DANS LE CROP**, en mètres — Tâche P5.
 *
 * ⛔ **LE BUDGET DU FOND ÉTAIT CELUI DE LA CALOTTE, ET LE SOCLE PREND CELUI DE
 * SON BLOC.** `terrain.js` pose `uSeaRange = (0 − dem.minM) × demScale`, et
 * `dem` couvre EXACTEMENT le bloc. `poserMer`, lui, posait `champ.profMaxM`,
 * mesuré sur la calotte — trois fois plus large. Relevé le 2026-08-22, La
 * Réunion z12 : **3 510,49 m contre 2 116 m**, soit **×1,658**.
 *
 * ⚠️ **ET CE N'EST PAS UN DÉTAIL DE NORMALISATION : ÇA DOUBLE LA FRANGE PÂLE.**
 * Le segment clair de la rampe nautique (`d01 < 0,45`, `uOceanShallow` →
 * `uOceanMid`) couvrait **38,89 %** des 5 449 nœuds d'eau du crop avec le budget
 * de la calotte, et **19,82 %** avec celui du crop. Ce sont les « gradins pâles »
 * de la Tâche P4.
 *
 * ⚠️ **MESURÉE SUR LE CHAMP DÉJÀ CUIT, PAS SUR UN SECOND BALAYAGE, ET PAS SUR
 * `uOceanDepth`.** `poserRampe` mesure la même grandeur sur SA grille (relevé à
 * 2 106,77 m, soit 0,44 % du socle) — mais elle peut REFUSER faute de
 * couverture, et son refus laisse le défaut MONDIAL de 6 000 m, c'est-à-dire une
 * frange encore plus pâle qu'aujourd'hui. C'est le piège que l'en-tête de
 * `uMerFondBudgetM` nomme déjà. On mesure donc sur le champ de la mer, qui est
 * là par construction.
 *
 * @param {Float32Array|Array<number>} valeurs - le champ, ligne-major
 * @param {number} cote - côté du champ, en nœuds
 * @param {number} portee - demi-largeur du champ, en demi-côtés de crop
 * @returns {number} la profondeur maximale (positive) dans `|q| <= 1`, ou 0
 */
export function profondeurMaxDuCrop(valeurs, cote, portee) {
  if (!valeurs || !(cote > 1) || !(portee > 0)) return 0
  const n = cote - 1
  let max = 0
  for (let j = 0; j < cote; j++) {
    // ⚠️ **LA MÊME CONVENTION QUE `uvFond` ET QUE `MER_VERT`, À L'ENVERS** : le
    // nœud `i` porte `q = (2 i / (cote − 1) − 1) × portee`. Une seconde
    // convention ici, et le budget serait mesuré ailleurs que là où il sert.
    const qv = (2 * j) / n - 1
    if (Math.abs(qv * portee) > 1) continue
    const base = j * cote
    for (let i = 0; i < cote; i++) {
      const qu = (2 * i) / n - 1
      if (Math.abs(qu * portee) > 1) continue
      const h = valeurs[base + i]
      if (h < 0 && -h > max) max = -h
    }
  }
  return max
}

/**
 * La loi de couleur du fond marin — la transcription de `terrain.js:1019-1023`.
 *
 * ⚠️ **EXPOSANT 0,55 ET COUDE À 0,45 : LES DEUX VIENNENT DU SOCLE.** L'exposant
 * écrase la profondeur pour que la frange côtière occupe une part visible de la
 * rampe ; le coude place le bleu moyen aux 45 % du budget. Les changer, c'est
 * changer la mer du socle, pas la porter.
 *
 * @param {number} profondeurM - profondeur en mètres (positive)
 * @param {number} budgetM - la profondeur qui vaut « abysse »
 * @returns {number} l'abscisse `d01` dans [0, 1], APRÈS l'exposant
 */
export function abscisseNautique(profondeurM, budgetM) {
  const p = Math.max(0, profondeurM)
  return Math.pow(Math.min(1, Math.max(0, p / Math.max(budgetM, 1e-4))), 0.55)
}

// ══════════ ③ LA CALOTTE ═══════════════════════════════════════════════════

/**
 * La portée par défaut de la calotte, en demi-côtés de crop.
 *
 * ⚠️ **DÉRIVÉE DU SEUIL DU SOCLE, PAS POSÉE.** `seuil-socle.js` fait naître le
 * socle à **32 274 m** d'altitude de cadrage. À cette altitude l'horizon
 * géométrique est à `√(2 R h) = 641 km`. Un demi-côté de crop valant **6 845 m**
 * à La Réunion (`largeurCropM / 2`), il faut **93,7 demi-côtés** pour que la mer
 * aille jusqu'à l'horizon.
 *
 * ⚠️ **ET 128 NE SUFFISAIT PAS — C'EST LE TEST ③i QUI L'A DIT, PAS MOI.**
 * `largeurCropM` porte un `cos φ` : un crop islandais (lat 64,9°) est deux fois
 * plus étroit au sol, donc il lui faut **206 demi-côtés** pour le même horizon.
 * La valeur est donc **256**, et sa limite est écrite plutôt que cachée :
 * `256 × demi ≥ 641 km` exige `largeurCropM ≥ 5 008 m`, c'est-à-dire
 * **|φ| ≤ 70,05°**. Au-delà, l'appelant DOIT passer par `porteeHorizon` — une
 * constante qui deviendrait fausse en silence est exactement ce que le §2 de
 * `/threejs-optimisation` appelle une limite inatteignable, à l'envers.
 *
 * ⚠️ **ET CE N'EST PAS UNE CONSTANTE UNIVERSELLE** : elle dépend de la LATITUDE
 * (par `largeurCropM`) et de l'altitude regardée. `porteeHorizon` la calcule ;
 * cette valeur-ci n'est que le défaut.
 */
export const PORTEE_DEFAUT = 256

/**
 * La portée qu'il faut pour que la mer atteigne l'horizon, vue de `altitudeM`.
 *
 * ⚠️ **L'HORIZON GÉOMÉTRIQUE, PAS UNE CONSTANTE.** C'est le §5 de
 * `/threejs-optimisation` : « un seuil d'horizon écrit en constante au lieu du
 * vrai horizon géométrique » y vaut une calotte jusqu'à 1 076 fois trop large.
 * Ici l'erreur irait dans l'autre sens — une mer qui s'arrête avant l'horizon
 * laisse un trou — mais c'est la même faute.
 */
export function porteeHorizon(repere, altitudeM, rayonM) {
  if (!(altitudeM >= 0) || !(rayonM > 0)) {
    throw new TypeError('porteeHorizon : `altitudeM` >= 0 et `rayonM` > 0')
  }
  const demiCoteM = largeurCropM(repere) / 2
  if (!(demiCoteM > 0)) throw new TypeError('porteeHorizon : le repère ne donne pas de demi-côté')
  return Math.sqrt(2 * rayonM * altitudeM) / demiCoteM
}

/**
 * La calotte sphérique au niveau de la mer, dans le repère LOCAL du crop.
 *
 * ⚠️ **UNE SEULE SURFACE, DU CENTRE DU CROP À L'HORIZON.** La décision 5 dit
 * « la mer riche est PARTOUT » ; la tentation est d'en faire deux — celle du
 * crop et une nappe autour. `.banc/rejoue-F.mjs` rejoue ce raccourci sous le nom
 * `CHORDE`, et **trois assertions le tuent** (F1, F3, F10) : la marche au bord
 * du crop y vaut la flèche du demi-côté, soit 2,13 m d'eau qui tombent d'un cran
 * tout le long de la frontière.
 *
 * ⚠️ **LA GRILLE EST EN COORDONNÉES DE CROP, PAS EN DEGRÉS.** `latLonDeLocal`
 * fait la conversion, avec son repli d'antiméridien ; un maillage tracé en
 * lat/lon aurait ses lignes serrées au nord et lâches au sud.
 *
 * @param {object} arg
 * @param {{cx:number,cy:number,demi:number}} arg.repere - `repereCrop`
 * @param {number} arg.rayon - rayon de la sphère (unités de scène)
 * @param {number} [arg.portee] - demi-largeur, en demi-côtés de crop
 * @param {number} [arg.pas] - segments par côté de la grille
 * @param {number} [arg.hauteur] - décalage radial de la surface (unités de
 *   scène) : l'epsilon de coplanarité, converti par l'appelant
 * @param {number} [arg.emprise] - **jusqu'où va la SURFACE**, en demi-côtés.
 *   ⚡ **CE N'EST PAS `portee`, ET C'EST TOUTE LA TÂCHE D24.** `portee` reste ce
 *   sur quoi le CHAMP est cuit (`_cuireChampMer`), ce qui normalise le canal G
 *   et ce qui ancre le budget du fond — c'est-à-dire **la couleur de la mer**,
 *   que le rapport MER §4 interdit de déplacer. `emprise` ne dit qu'une chose :
 *   jusqu'où des SOMMETS existent. Défaut : `portee`, donc la calotte d'avant au
 *   bit près. ⚠️ **`uv` reste en demi-côtés bruts** : la lecture du champ vaut
 *   `uv / (2 · portee) + 0,5` chez l'appelant, et elle ne bouge pas.
 * @returns {{positions:Float32Array, indices:Uint32Array, uv:Float32Array,
 *            origine:number[], base:object, flecheMax:number, compte:object}}
 */
export function construireCalotte({ repere, rayon, portee = PORTEE_DEFAUT, pas = 128, hauteur = 0, emprise = undefined } = {}) {
  if (!repere || !Number.isFinite(repere.demi)) {
    throw new TypeError('construireCalotte : il faut un `repere` (repereCrop)')
  }
  if (!(rayon > 0)) throw new TypeError('construireCalotte : `rayon` doit être fini et > 0')
  if (!(portee > 0)) throw new TypeError('construireCalotte : `portee` doit être > 0')
  const etendue = Number.isFinite(emprise) && emprise > 0 ? Math.min(emprise, portee) : portee
  const n = Math.max(2, Math.round(pas))
  const { origine: O, est, haut, sud, centre } = repereLocalCrop(repere, rayon)
  const R = rayon + hauteur

  const nV = (n + 1) * (n + 1)
  const positions = new Float32Array(nV * 3)
  // ⚠️ L'UV EST EN COORDONNÉES DE CROP, NORMALISÉ SUR LA PORTÉE. C'est lui qui
  // porte la distance au centre du crop, donc la superellipse ET la lecture du
  // champ. Le calculer dans le nuanceur depuis `position` supposerait de rejouer
  // la projection de Mercator par fragment — la seconde écriture que `globe.js`
  // refuse déjà au §« qCrop est hissé hors du bloc de découpe ».
  const uv = new Float32Array(nV * 2)
  let flecheMax = 0
  let k = 0
  for (let j = 0; j <= n; j++) {
    const v = (-1 + (2 * j) / n) * etendue
    for (let i = 0; i <= n; i++) {
      const u = (-1 + (2 * i) / n) * etendue
      const { lat, lon } = latLonDeLocal(u, v, repere)
      const P = surSphere(lat, lon, R)
      const d = [P[0] - O[0], P[1] - O[1], P[2] - O[2]]
      const x = d[0] * est[0] + d[1] * est[1] + d[2] * est[2]
      const y = d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2]
      const z = d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2]
      positions[k * 3] = x
      positions[k * 3 + 1] = y
      positions[k * 3 + 2] = z
      uv[k * 2] = u
      uv[k * 2 + 1] = v
      if (hauteur - y > flecheMax) flecheMax = hauteur - y
      k++
    }
  }

  // ⚠️ Uint32, PAS Uint16 : une grille de 256 dépasse 65 536 sommets, et
  // l'index déborderait en SILENCE — le maillage se replierait sur lui-même.
  const indices = new Uint32Array(n * n * 6)
  let m = 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i
      const b = a + 1
      const c = a + (n + 1)
      const e = c + 1
      // sens de parcours : la normale sort vers le HAUT local (voir l'audit de
      // `parois-crop.js` — un solide retourné passe l'audit de bords libres)
      indices[m++] = a; indices[m++] = c; indices[m++] = b
      indices[m++] = b; indices[m++] = c; indices[m++] = e
    }
  }

  return {
    positions,
    indices,
    uv,
    origine: O,
    base: { est, haut, sud },
    centre,
    flecheMax,
    compte: { sommets: nV, triangles: n * n * 2, pas: n, portee, emprise: etendue },
  }
}

// ══════════ ③bis LE RIDEAU D'EAU — Tâche P4 ════════════════════════════════
//
// ⛔ **LA PIÈCE QUE LE SOCLE A ET QUE LE CROP N'AVAIT PAS.** Le noteur (manque
// n° 4) : *« la nappe de mer et le dessus du bloc ne sont pas la même surface —
// deux niveaux, un porte-à-faux »*. Le brief l'attribuait à un désaccord entre
// `poserMer` et `construireParoisCrop`. **Ce n'en est pas un : les deux
// s'accordent parfaitement.** L'anneau haut de la paroi suit la SURFACE, et sous
// l'eau la surface est le FOND MARIN : au bord mouillé, la lèvre du bloc plonge
// à la bathymétrie (−2 116 m relevés à La Réunion) pendant que la nappe reste au
// niveau zéro. Elle flotte donc au-dessus du vide, et par le trou on voit la
// face interne de la paroi et le fond du bloc.
//
// ⚡ **LE SOCLE A EXACTEMENT LE MÊME BLOC ET PAS LE DÉFAUT, PARCE QU'IL A UN
// RIDEAU D'EAU** : `ocean.js` bâtit DEUX maillages, la surface (66 049 sommets,
// renderOrder 18) et une jupe (1 474 sommets, renderOrder 16). **A/B relevé dans
// la même page le 2026-08-22 : cacher la jupe du socle change 30 453 px (2,97 %
// du cadre) et fait apparaître le MÊME porte-à-faux au flanc est**
// (`.banc/vues-P4/Z4-SOCLE-sans-jupe-est.png` contre `-avec-jupe-`).
//
// ⚠️ **ELLE EST EN RETRAIT, ET C'EST LE MÊME RETRAIT QUE `bordDeMer`** :
// `plinth.js` pose l'eau du mode plat à `HALF − chanfrein − marge`, donc DANS le
// mur. Le rideau du crop vit sur le même anneau, rentré de `RETRAIT_EAU_CROP`.
//
// ⚠️ **UN SEUL MAILLAGE, UN SEUL MATÉRIAU, UNE SEULE LOI DE HOULE.** Le ruban
// est CONCATÉNÉ à la calotte : ses sommets du haut portent le même `aCrop`, donc
// le nuanceur de sommets leur applique la MÊME houle, au bit près. Un second
// maillage aurait fallu une seconde écriture du déplacement — et `ocean.js`
// écrit lui-même ce que ça coûte : « si les deux divergeaient d'un millimètre,
// un jour s'ouvrirait entre la jupe et la mer sur tout le périmètre du bloc ».

/**
 * Le rideau d'eau du pourtour du crop, dans le repère LOCAL de la calotte.
 *
 * @param {object} arg
 * @param {{cx:number,cy:number,demi:number}} arg.repere
 * @param {number} arg.rayon rayon de la sphère (unités de scène)
 * @param {{coin:number,expo:number}} [arg.forme] la MÊME que la découpe
 * @param {number} arg.basY le fond du bloc, en Y local — `construireSolideCrop`
 * @param {number} [arg.hauteur] décalage radial de la surface (epsilon)
 * @param {number} [arg.retrait] en demi-côtés de crop — le retrait du HAUT
 * @param {number} [arg.retraitBas] le retrait du BAS, en demi-côtés. ⛔ **SANS
 *   LUI, LE RIDEAU DÉPASSE DU BLOC DEPUIS QUE LE MUR PORTE UN CONGÉ (P13).**
 *   `retrait` met le rideau `chanfrein + marge` en dedans, ce qui suffit tant
 *   que le mur est vertical sur toute sa hauteur ; le congé, lui, rentre la
 *   base de `chanfrein + congé`, donc **de 3,9 fois plus**. Mesuré à l'écran
 *   avant d'être réparé : **792 px de mer sous le bas du mur, en 4 langues**,
 *   là où l'état d'avant P13 en rendait **0** (`.banc/P13/P2-jupes-P13.json`).
 *   C'est mot pour mot le défaut que `plinth.js` raconte sur le socle — « LE
 *   DÉFAUT DU 2026-08-03, on voit l'eau à travers le bloc » —, et sa parade est
 *   la même : **une définition de « où finit le bloc », lue au lieu d'être
 *   devinée.** Défaut : `retrait`, c'est-à-dire le rideau droit d'avant, au bit
 *   près.
 * @param {number} [arg.pas] espacement de l'anneau
 * @returns {{positions:Float32Array, uv:Float32Array, jupe:Float32Array,
 *            indices:Uint32Array, compte:object}}
 */
export function construireJupeMer({
  repere,
  rayon,
  forme = { coin: 0, expo: 2 },
  basY,
  hauteur = 0,
  retrait = RETRAIT_EAU_CROP,
  retraitBas = undefined,
  pas = PAS_CONTOUR,
} = {}) {
  if (!repere || !Number.isFinite(repere.demi)) {
    throw new TypeError('construireJupeMer : il faut un `repere` (repereCrop)')
  }
  if (!(rayon > 0)) throw new TypeError('construireJupeMer : `rayon` doit être fini et > 0')
  if (!Number.isFinite(basY)) throw new TypeError('construireJupeMer : `basY` est obligatoire')
  const { origine: O, est, haut, sud } = repereLocalCrop(repere, rayon)
  const anneau = contourCrop(forme.coin ?? 0, forme.expo ?? 2, pas)
  const n = anneau.length
  const k = 1 - Math.min(1, Math.max(0, retrait))
  // ⚠️ **LE BAS PEUT RENTRER PLUS QUE LE HAUT, ET C'EST TOUT L'OBJET.** Le
  // rideau devient légèrement conique et épouse l'enveloppe du bloc : son haut
  // reste soudé au bord de la calotte (`bordDeMer` lit le même `retrait`), son
  // bas se glisse derrière le congé. ⚠️ **ET IL NE REMONTE JAMAIS** : un
  // `retraitBas` plus petit que `retrait` ferait ressortir le rideau, ce que ce
  // paramètre existe précisément pour empêcher.
  const rb = Number.isFinite(retraitBas) ? Math.max(retrait, retraitBas) : retrait
  const kBas = 1 - Math.min(1, Math.max(0, rb))
  const R = rayon + hauteur

  const positions = new Float32Array(n * 2 * 3)
  const uv = new Float32Array(n * 2 * 2)
  // ⚠️ **0 EN HAUT, 1 EN BAS, ET LA CALOTTE PORTE 0** : le fragment reconnaît le
  // rideau à `vJupe > 0`, et la valeur EST la profondeur relative que le socle
  // appelle `g`. Deux usages, une grandeur — pas un drapeau plus un dégradé.
  const jupe = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const u = anneau[i].u * k
    const v = anneau[i].v * k
    const { lat, lon } = latLonDeLocal(u, v, repere)
    const P = surSphere(lat, lon, R)
    const d = [P[0] - O[0], P[1] - O[1], P[2] - O[2]]
    const x = d[0] * est[0] + d[1] * est[1] + d[2] * est[2]
    const y = d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2]
    const z = d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2]
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z
    // le sommet du BAS, sur son propre retrait — identique au haut quand
    // `retraitBas` n'est pas donné, au bit près (`kBas === k`)
    const uB = anneau[i].u * kBas
    const vB = anneau[i].v * kBas
    const pB = latLonDeLocal(uB, vB, repere)
    const Q = surSphere(pB.lat, pB.lon, R)
    const dB = [Q[0] - O[0], Q[1] - O[1], Q[2] - O[2]]
    positions[(n + i) * 3] = dB[0] * est[0] + dB[1] * est[1] + dB[2] * est[2]
    positions[(n + i) * 3 + 1] = basY
    positions[(n + i) * 3 + 2] = dB[0] * sud[0] + dB[1] * sud[1] + dB[2] * sud[2]
    uv[i * 2] = u; uv[i * 2 + 1] = v
    uv[(n + i) * 2] = uB; uv[(n + i) * 2 + 1] = vB
    jupe[i] = 0
    jupe[n + i] = 1
  }

  // ⛔ **LE SENS DE PARCOURS ÉTAIT RETOURNÉ, ET C'EST LE TABLIER DE MER —
  // Tâche P7, VU À L'ÉCRAN PUIS PROUVÉ EN LE BOUGEANT.** La Tâche P4 avait bâti
  // ce ruban et écrit ici « le sens de parcours suit celui des parois » ; il ne
  // le suivait pas. `construireSolideCrop` (`parois-crop.js` §④), sur le MÊME
  // anneau, avec le MÊME agencement (0…n−1 en haut, n…2n−1 en bas), pose
  // `(k, j, n+k)` puis `(j, n+j, n+k)` — et il le DÉMONTRE ligne à ligne, puis
  // `auditerSolide` exige un volume signé POSITIF. Ces deux lignes-ci posaient
  // `(i, n+i, j)` et `(j, n+i, n+j)`, c'est-à-dire **l'exact inverse** : les
  // faces avant du rideau pointaient vers l'INTÉRIEUR du bloc.
  //
  // ⚠️ **ET LE MATÉRIAU DE LA CALOTTE EST EN `FrontSide`** (relevé sur la page
  // vivante : `side = 0`, quand la jupe du socle est en `DoubleSide`). Sur
  // chaque flanc TOURNÉ VERS LA CAMÉRA le rideau était donc **éliminé au
  // culling**, et par le trou on voyait la lèvre nue du fond marin passer
  // par-dessus l'arête haute de la paroi : le « tablier pâle à bord festonné »
  // du noteur.
  //
  // ⚡ **A/B à témoin nul dans la même page, boucle gelée, La Réunion z12,
  // cadrage côte de la notation-01 :** en retournant le ruban DANS LE TAMPON
  // D'INDEX, le liséré de fond marin nu entre la nappe et l'arête haute tombe
  // de **5 314 px à 186 px** sur les 210 colonnes où le socle, lui, amène son
  // eau jusqu'à son mur (le socle en rend **441**) ; le rideau visible passe de
  // **1 519 px à 6 642 px**. Retour au sens d'origine : **les trois chiffres
  // reviennent au pixel.** (`.banc/P7/S5-ab-rideau-P7.json`.)
  //
  // ⚠️ **`DoubleSide` RENDRAIT LA MÊME IMAGE, ET N'EST PAS LA RÉPARATION.**
  // Mesuré aussi : `side = DoubleSide` sur le sens fautif rend **exactement le
  // même liséré (186 px)** — il ne fait que rattraper le culling. Le ruban est
  // un anneau FERMÉ autour d'un bloc opaque : d'un point de vue extérieur, la
  // moitié lointaine est de toute façon cachée par le bloc. On répare le sens,
  // on ne paie pas la seconde face.
  const indices = new Uint32Array(n * 6)
  let m = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    indices[m++] = i; indices[m++] = j; indices[m++] = n + i
    indices[m++] = j; indices[m++] = n + j; indices[m++] = n + i
  }
  return { positions, uv, jupe, indices, compte: { anneau: n, sommets: n * 2, triangles: n * 2 } }
}

/**
 * La couleur du rideau d'eau — **UNE SEULE ÉCRITURE, DEUX LECTEURS.**
 *
 * Ce sont les six lignes de `SKIRT_FRAG` (`ocean.js`), extraites plutôt que
 * recopiées : la calotte du crop en a besoin mot pour mot, et ce chantier a déjà
 * payé quatre fois une loi de mer écrite deux fois.
 *
 * ⚠️ **`givre` EST LE SOCLE DE VERRE, ET LE CROP N'EN A PAS.** Il passe `0`, ce
 * qui rend `mix(col, …, 0)` et `mix(0.55, 0.94, 0)` exacts : la branche givre
 * est neutre, pas approximée. Le jour où le crop portera un socle de verre, il
 * aura le terme sans qu'on l'écrive une seconde fois.
 * ⚠️ **`jour` VAUT 1 SUR LE CROP** : sa mer n'a pas encore de loi jour/nuit —
 * `MER_FRAG` n'en porte aucune non plus. Dit ici plutôt que découvert de nuit.
 */
export const GLSL_JUPE_MER = /* glsl */ `
vec4 couleurJupeMer(vec3 fond, vec3 ciel, float g, float givre, float jour, float grain) {
  vec3 col = fond * mix(1.05, 0.45, g);
  col *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), jour);
  col = mix(col, col * 0.75 + ciel * 0.30 * (0.5 + 0.5 * grain), givre * 0.65);
  float a = mix(0.55, 0.94, givre);
  a *= 1.0 - 0.15 * (1.0 - givre) * grain;
  return vec4(col, a);
}
`

// ══════════ ④ LA DÉGRADATION ═══════════════════════════════════════════════

const lissage = (a, b, x) => {
  if (!(b > a)) return x < a ? 0 : 1
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * La richesse de la mer à la distance `d` : 1 de près, 0 au loin.
 *
 * ⚠️ **EXACTEMENT 1 AVANT `debut`, EXACTEMENT 0 APRÈS `fin`** — et les deux
 * « exactement » sont la propriété qui fait qu'on peut SAUTER le calcul sans que
 * la bascule se voie. Voir le §4 de l'en-tête : la loi de `ocean.js`
 * (`0.08 + 0.92·s`) ne les a NI l'un NI l'autre, et un saut posé sur elle
 * ferait disparaître 8 % de l'effet d'un coup.
 *
 * ⚠️ **ET C'EST UN LISSAGE, PAS UN SEUIL.** `.banc/rejoue-F.mjs` rejoue le seuil
 * sous le nom `DURE` : trois assertions le tuent.
 */
export function richesseMer(d, debut, fin) {
  // ⚠️ **EN LOGARITHME DE DISTANCE, ET LE TEST ④g L'A EXIGÉ.** Une transition
  // lisse sur `d` a beau border une bande géométrique, elle n'y est pas
  // symétrique : sur la bande [50 ; 200] la bascule 100 y valait **0,74** et non
  // 0,5. En logarithme, `richesseMer(bascule) = 0,5` EXACTEMENT, la transition
  // dure le même nombre d'octaves de chaque côté, et les deux « exactement »
  // des bouts sont conservés (`lissage` écrête à 0 et à 1).
  if (!(d > 0)) return 1
  return 1 - lissage(Math.log(debut), Math.log(fin), Math.log(d))
}

/**
 * La distance à laquelle un détail de longueur d'onde `lambda` cesse d'exister
 * à l'écran — la borne d'échantillonnage, en unités de `lambda`.
 *
 * ⚠️ **DÉRIVÉE, PAS CHOISIE**, voir le §5 de l'en-tête. Une distance posée en
 * constante serait juste à une seule taille de fenêtre et à un seul champ de
 * vision ; `.banc/rejoue-F.mjs` rejoue cette faute sous le nom `DURE` (la
 * constante `SURF_FAR = 64` de `ocean.js` promue en bascule) et **F8 comme F9
 * la tuent** : elle ne suit ni la hauteur d'image ni la finesse du détail.
 */
export function distanceBascule({ lambda, hauteurPx, fovDeg, parDetail = 2 } = {}) {
  if (!(lambda > 0) || !(hauteurPx > 0) || !(fovDeg > 0) || !(fovDeg < 180) || !(parDetail > 0)) {
    throw new TypeError('distanceBascule : `lambda`, `hauteurPx`, `parDetail` > 0 et 0 < `fovDeg` < 180')
  }
  return (lambda * hauteurPx) / (2 * parDetail * Math.tan((fovDeg * Math.PI) / 360))
}

/**
 * La bande de dégradation : `{debut, fin}`, autour de la bascule.
 *
 * ⚠️ **LA BANDE EST GÉOMÉTRIQUE, PAS ADDITIVE**, et c'est la seule forme qui
 * garde son sens sur cinq ordres de grandeur de distance. Une bande de « ±10
 * unités » serait la moitié de la vue à 20 unités et invisible à 2 000. Le
 * facteur `largeur` dit combien d'octaves de distance dure la transition :
 * `debut = bascule / √largeur`, `fin = bascule · √largeur`.
 */
export function bandeDegradation(bascule, largeur = 2) {
  if (!(bascule > 0) || !(largeur > 1)) {
    throw new TypeError('bandeDegradation : `bascule` > 0 et `largeur` > 1')
  }
  const k = Math.sqrt(largeur)
  return { debut: bascule / k, fin: bascule * k }
}

// ══════════ ⑤ LA DISTANCE AU RIVAGE ════════════════════════════════════════

/**
 * Le pas diagonal du chanfrein.
 *
 * ⚠️ **1,414 ET NON `Math.SQRT2`, ET C'EST LE DÉPÔT QUI LE DIT** : `ocean.js`
 * écrit ce littéral depuis toujours. L'écart (1,5·10⁻⁴ par cellule) est sans
 * effet sur une frange de ressac ; le « corriger » changerait la mer du SOCLE,
 * que ce chantier n'a pas le droit de toucher.
 */
export const PAS_DIAGONAL = 1.414

/**
 * La distance à la terre la plus proche, par chanfrein en deux passes.
 *
 * ⚠️ **EXTRAITE DE `ocean.js` (`_bakeField`) PAR CETTE TÂCHE, PAS RÉÉCRITE.**
 * C'est la seule façon d'avoir la MÊME frange de ressac sur le socle et sur la
 * calotte : deux écritures jumelles auraient fini par diverger, et le §« deux
 * écritures qui divergent » de `terrain.js` raconte ce que ça coûte.
 *
 * ══════════ ⚠️ CE QUE L'EXTRACTION A TROUVÉ, ET QUI EST UN DÉFAUT DU DÉPÔT ══
 *
 * **Le demi-masque de `ocean.js` est INCOMPLET.** Une passe avant de chanfrein
 * à huit voisins doit lire QUATRE voisins déjà écrits — ouest, nord,
 * nord-ouest **et nord-est** — et la passe arrière les quatre symétriques.
 * `ocean.js` n'en lit que TROIS de chaque côté : les anti-diagonales manquent.
 *
 * **Conséquence, mesurée sur une grille 65² avec une seule cellule de terre au
 * centre** (`test/mer-sphere.test.js`, ⑤a) : dans les quadrants (+x, −y) et
 * (−x, +y) la distance ne peut voyager que par pas d'axe.
 *
 * | direction | chanfrein du dépôt | euclidienne | écart |
 * |---|---|---|---|
 * | (+8, 0) | 8,0000 | 8,0000 | **0,0 %** |
 * | (+8, +8) | 11,3120 | 11,3137 | −0,02 % |
 * | **(+8, −8)** | **16,0000** | 11,3137 | **+41,4 %** |
 * | (+4, −8) | 12,0000 | 8,9443 | +34,2 % |
 *
 * **Le pire écart vaut +41,42 % ( = √2 − 1 ), et il est atteint sur toute la
 * diagonale (+x, −y).** Ce champ pilote la houle de côte (`shoreSurf`), les
 * bandes d'écume et le ressac (`vFade`) : **la frange de ressac du socle meurt
 * 41 % trop tôt sur deux orientations de côte sur quatre.** Personne ne l'avait
 * relevé parce que rien ne comparait ce champ à une référence indépendante.
 *
 * ⚠️ **ON NE LE CORRIGE PAS DANS `ocean.js`, ON ÉLARGIT.** Le §5 du plan met le
 * damier hors périmètre, et `_bakeField` sert la mer du socle qui est en
 * production. Le défaut est donc **nommé, chiffré, et laissé** ; l'option
 * `completes` ajoute les deux voisins manquants, et **c'est elle que la mer
 * sphérique emploie**. Le socle garde son comportement AU BIT PRÈS, ⑤e le
 * prouve. C'est la règle des listes du §0 : on élargit, on ne remplace jamais.
 *
 * @param {ArrayLike<number>} eau - 1 = mer, 0 = terre, `n × n` en ligne d'abord
 * @param {number} n
 * @param {number} cellule - largeur d'une cellule, dans l'unité voulue
 * @param {{completes?:boolean}} [opts] - `completes` ajoute les anti-diagonales
 * @returns {Float32Array} la distance, même disposition
 */
export function distanceRivage(eau, n, cellule, { completes = false } = {}) {
  if (!Number.isFinite(n) || n < 1) throw new TypeError('distanceRivage : `n` doit être un entier >= 1')
  if (!(cellule > 0)) throw new TypeError('distanceRivage : `cellule` doit être > 0')
  if (!eau || eau.length < n * n) throw new TypeError('distanceRivage : `eau` doit faire n × n')
  const INF = 1e9
  const diag = cellule * PAS_DIAGONAL
  const dist = new Float32Array(n * n)
  for (let k = 0; k < n * n; k++) dist[k] = eau[k] ? INF : 0
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + cellule)
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - n] + cellule)
      if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - n - 1] + diag)
      // le NORD-EST, que `ocean.js` n'a jamais lu — voir la table ci-dessus
      if (completes && i < n - 1 && j > 0) dist[k] = Math.min(dist[k], dist[k - n + 1] + diag)
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i
      if (i < n - 1) dist[k] = Math.min(dist[k], dist[k + 1] + cellule)
      if (j < n - 1) dist[k] = Math.min(dist[k], dist[k + n] + cellule)
      if (i < n - 1 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n + 1] + diag)
      // le SUD-OUEST, symétrique du précédent
      if (completes && i > 0 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n - 1] + diag)
    }
  }
  return dist
}

// ══════════ ⑥ L'EMPRISE DE LA CALOTTE ══════════════════════════════════════

/**
 * L'emprise géographique de la calotte, au format que `remplirHauteurs` attend
 * (`{ouest, sud, est, nord}` en degrés).
 *
 * ⚠️ **C'EST PAR ELLE QUE LA FUSION BATHYMÉTRIQUE ENTRE.** L'Étape 3 de la tâche
 * dit « en réutilisant la fusion bathymétrique DÉJÀ dans le flux » :
 * `remplirHauteurs` (`monde/flux-terrain.js`) appelle `fuseBathymetry` sur
 * l'emprise ENTIÈRE, en une fois — écart en mer **615 m → 3,2 m**. Le globe seul
 * (`hauteurSurface`) lit **zéro** partout où le terrarium n'a pas de fond marin,
 * et la mer y serait d'un bleu uniforme de bord à bord.
 *
 * ⚠️ **ET LA PORTÉE EST ÉCRÊTÉE EN LATITUDE, PAS EN LONGITUDE.** Au-delà des
 * pôles, `latLonDeLocal` rend une latitude qui tend vers ±90 sans jamais y
 * arriver ; en longitude, en revanche, une portée large fait le tour du monde et
 * `ouest > est` n'aurait plus de sens. On borne donc à un demi-tour.
 */
export function empriseCalotte(repere, portee = PORTEE_DEFAUT) {
  if (!repere || !Number.isFinite(repere.demi)) {
    throw new TypeError('empriseCalotte : il faut un `repere` (repereCrop)')
  }
  // ⚠️ **ÉCRÊTÉE À LA COUVERTURE DE MERCATOR, ET LE TEST ⑥b L'A EXIGÉ.** À
  // grande portée, `latLonDeLocal` passe par `sinh(π · 36,5)`, qui DÉBORDE en
  // `Infinity` : `atan` rendait alors **exactement 90°**, c'est-à-dire un pôle.
  // `tuileY(90)` vaut l'infini, et `remplirHauteurs` aurait demandé une emprise
  // infinie sans que rien ne le signale. C'est le même écrêtage que `mercY`
  // (`crop-sphere.js`), et pour la même raison — sauf qu'ici il ne s'agit pas
  // d'un `discard` gardé mais d'une requête réseau.
  const borne = (lat) => Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat))
  const nord = borne(latLonDeLocal(0, -portee, repere).lat)
  const sud = borne(latLonDeLocal(0, portee, repere).lat)
  const demiLonDeg = Math.min(180, portee * repere.demi * 360)
  const centreLon = latLonDeLocal(0, 0, repere).lon
  let ouest = centreLon - demiLonDeg
  let est = centreLon + demiLonDeg
  if (demiLonDeg >= 180) { ouest = -180; est = 180 }
  else {
    if (ouest < -180) ouest += 360
    if (est > 180) est -= 360
  }
  return { ouest, sud, est, nord }
}

// ══════════ ⑦ LE BORD DE LA MER — Tâche J ══════════════════════════════════
//
// ⚠️ **CE QUE CETTE SECTION RÉPARE, ET IL A ÉTÉ VU À L'ÉCRAN** : « la mer
// déborde de ~400 km sur un bloc de 10 km, et l'estompage ne la touche pas ».
// La calotte partait jusqu'à l'HORIZON GÉOMÉTRIQUE (`porteeHorizon`), ce qui est
// juste tant que la planète est entière — et faux dès que l'estompage l'efface :
// il reste alors un grand rectangle bleu flottant sur un fond vide.
//
// ⚠️ **LA GÉOMÉTRIE NE BOUGE PAS, C'EST LE FONDU QUI SUIT.** La calotte se cuit
// à l'arrêt (§« la gravure ne s'écrit qu'à l'arrêt ») : faire varier `portee`
// par image la reconstruirait — 385² de champ et 193² de sommets. Le bord vit
// donc dans le FRAGMENT, sur la même mesure de superellipse que la découpe
// (`globe.js`, `uCropCoin` / `uCropCoinN`), et ne coûte que deux flottants.

/**
 * La portée de la calotte, en demi-côtés de crop.
 *
 * ⚠️ **TROIS, ET C'EST L'EMPRISE 3×3 DU MODE PLAT, PAS UN GOÛT.** La calotte
 * couvre `u ∈ [−portee, +portee]`, soit **`portee` largeurs de crop** : 3 est
 * donc exactement l'emprise sur laquelle `mer-emprise.js` cuit le champ du mode
 * continu (**168 unités = 3 × 56**, `resChamp(3)`). C'est le plus large que le
 * mode plat considère pour sa mer, et il n'y a aucune raison que la sphère aille
 * plus loin — sa géométrie à LUI s'arrête même à un seul bloc
 * (`coteGeometrique`, `damier-carre.js`).
 *
 * ⚠️ **ELLE REMPLACE `PORTEE_DEFAUT` POUR LE CROP, ELLE NE L'ABROGE PAS.**
 * `porteeHorizon` reste juste pour ce qu'elle calcule (une mer qui va jusqu'à
 * l'horizon d'une planète ENTIÈRE) ; ce n'est simplement plus ce qu'on veut sous
 * `?terre=unique`, où la planète autour s'efface.
 */
export const PORTEE_CROP = 3

/**
 * Le retrait de l'eau du mode plat, converti en demi-côtés de crop.
 *
 * ⚠️ **RECOPIÉ DE `plinth.js`, PAS RÉINVENTÉ — et recopié parce qu'il ne peut
 * PAS être importé** : `plinth.js` tire three.js, ce module doit rester
 * chargeable sous node. `test/mer-sphere.test.js` RELIT `src/plinth.js` sur le
 * disque pour confronter les deux, exactement comme `mer-emprise.test.js` le
 * fait déjà pour `CHAMP_RES` — un chiffre recopié sans garde diverge en silence.
 *
 * Là-bas : `rayonEauDansSocle() = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`,
 * soit `28 − 0,16 − 0,06`. Le retrait vaut donc `0,22` unité sur un demi-côté de
 * `COTE_CROP_UNITES / 2 = 28`.
 */
export const RETRAIT_EAU_CROP = (0.16 + 0.06) / (COTE_CROP_UNITES / 2)

/**
 * La MARGE seule — `SOCLE_MARGE_EAU` de `plinth.js`, en demi-côtés de crop.
 *
 * ⚠️ **ELLE EXISTE À PART DEPUIS LA TÂCHE P13**, parce que le bas du rideau ne
 * rentre plus de la même chose que son haut : en haut c'est `chanfrein + marge`
 * (le mur est vertical), en bas c'est `chanfrein + congé + marge`. La marge est
 * la seule part commune, et l'écrire une fois évite le troisième 0,06 du dépôt.
 */
export const MARGE_EAU_CROP = 0.06 / (COTE_CROP_UNITES / 2)

// ⛔ **`FRACTION_BANDE_BORD` A ÉTÉ RETIRÉE, ET C'EST LE DÉFAUT ② QUI L'EMPORTE.**
// Elle valait 0,5 et disait « le fondu court sur la moitié de l'anneau
// EXTÉRIEUR ». Depuis que la nappe s'arrête à l'emprise du socle, il n'y a plus
// d'anneau extérieur du tout : la bande vaut le retrait, et rien ne la module.
// Une constante que le corps n'atteint plus est la constante morte que ce
// chantier a déjà trouvée cinq fois — retirée plutôt que laissée à 0,5.

/**
 * Où la mer s'éteint : **à l'emprise du socle, et à rien d'autre.**
 *
 * Les deux bornes sont exprimées dans la MESURE DE LA DÉCOUPE : `0` est
 * exactement la frontière du crop, `portee − 1` le bord de la calotte. C'est la
 * grandeur que `globe.js` calcule déjà par fragment (`pn − uCropCoin`), donc
 * aucune seconde écriture de la superellipse.
 *
 * ⛔ **ELLE PRENAIT L'ESTOMPAGE EN ENTRÉE, ET C'ÉTAIT LE DÉFAUT ② D'ADRIEN
 * (2026-09-04)** : *« la mer prend beaucoup plus que la taille du crop, et
 * parfois ne se crope pas du tout »*. La loi d'avant valait
 * `fin = (portee − 1) · (1 − estompage) − RETRAIT`, donc la nappe s'étendait
 * jusqu'à **`portee − 1` demi-côtés HORS du crop** dès que l'estompage n'était
 * pas plein. Or l'estompage n'est plein qu'**au repos** (`veille-repos.js`,
 * 30 images calmes) : au moindre geste il retombe sur la rampe d'altitude.
 *
 * MESURÉ AU GPU, La Réunion, crop posé, `sonde-mer-crop.mjs` (écran 1 280×800) :
 *
 *   estompage   uMerBord.fin   mer dessinée HORS de l'emprise du socle
 *   0,00          +1,992        407 358 px  (39,8 % de l'écran)
 *   0,22          +1,552        407 352 px  (39,8 %)
 *   0,50          +0,992        324 292 px  (31,7 %)
 *   0,75          +0,492        204 742 px  (20,0 %)
 *   1,00          −0,0079             0 px
 *
 * Et l'estompage vu pendant un simple zoom à la molette (aucun réglage forcé) :
 * **0,295 depuis 31 km sur 178 images sur 180**, **0,000 depuis 55 km sur
 * 180/180** — c'est-à-dire la calotte entière, trois largeurs de crop. Le
 * *« parfois »* d'Adrien n'est pas un aléa : c'est le bas de cette rampe.
 *
 * ➡️ **D23 TRANCHE, ET C'EST LA RAISON DE FOND** : *« la mer animée et les
 * effets ne s'activent qu'à partir de ce niveau de crop »*. La nappe simulée
 * appartient au crop ; hors du crop l'océan est la bathymétrie peinte par le
 * nuanceur de tuile (rapport PF3 §1). Une nappe qui déborde ne repose donc pas
 * « sur des océans dessinés » — elle repose sur le fond de l'affiche, et c'est
 * le grand voile bleu de la capture d'Adrien.
 *
 * ⛔ **ET LE RETRAIT ALLAIT DANS LE MAUVAIS SENS — Tâche P4.** Il portait
 * `fin = max(RETRAIT_EAU_CROP, …)`, donc la mer allait **JUSQU'À `+RETRAIT`,
 * c'est-à-dire 0,22 unité de socle EN DEHORS du crop** : pleine opacité sur la
 * frontière elle-même, puis un fondu au-dessus du vide. Or le mode plat fait
 * l'INVERSE — `plinth.js` :
 * `rayonEauDansSocle() = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`, l'eau
 * **RENTRE** de 0,22 unité. **Ce retrait-là est gardé au bit près** : c'est lui
 * qui fait coïncider le bord de la nappe et le bord du socle.
 *
 * ⚠️ **AUCUN PARAMÈTRE, ET C'EST LE POINT.** Ni l'estompage ni la portée
 * n'entrent plus : un paramètre que le corps ignore serait le paramètre mort
 * que ce chantier a déjà trouvé cinq fois. La bande de fondu vaut le retrait —
 * pas un plancher à zéro, qui serait une arête dure.
 *
 * @returns {{debut:number, fin:number}} en demi-côtés de crop, mesurés depuis
 *   la frontière du crop (0 = la frontière, négatif = DEDANS)
 */
export function bordDeMer() {
  const fin = -RETRAIT_EAU_CROP
  return { debut: fin - RETRAIT_EAU_CROP, fin }
}

// ══════════ ⑧ LA COUPE PLATE À LA JUPE — D24 ═══════════════════════════════
//
// > **Adrien, 2026-09-04** : *« Je pense que l'effet latéral de vagues pose
// > problème. Il faudrait que le crop se fasse de façon plate, au niveau de la
// > jupe du socle, ça évitera de calculer cette déformation inutile. »*
//
// ⛔ **CE QUE `bordDeMer` NE POUVAIT PAS RÉGLER, ET POURQUOI.** Le fragment
// mesure sa distance au bord sur `vCrop`, c'est-à-dire sur la coordonnée
// paramétrique **AU REPOS** ; le sommet, lui, a déjà été poussé de côté par le
// terme latéral de Gerstner (`q · a · d · cos`). Une crête née à l'intérieur est
// donc **dessinée dehors** : le `discard` la juge sur l'endroit d'où elle vient,
// pas sur celui où elle est. C'est la signature de la capture d'Adrien — des
// **pointes** qui sortent de l'arête, pas une nappe uniformément trop grande.
//
// ⚡ **MESURÉ, ET LE TÉMOIN EST `chop = 0`** (`scripts/sonde-mer-jupe.mjs`,
// l'arête relue dans le tampon d'attributs, projetée, balayage de lignes) :
// **31 px hors arête** au cadrage oblique de sa capture, contre **0 px** dès que
// `uMerChop` — le seul pilote du terme LATÉRAL — est mis à zéro.
//
// ⚠️ **DEUX MOITIÉS, ET LA SECONDE EST CELLE QU'ON RATE.** Rejeter le fragment
// après avoir déplacé le sommet répondrait à « la coupe est plate » et pas du
// tout à « ça évitera de calculer cette déformation ». Les deux lois ci-dessous
// répondent chacune à une moitié :
//   ① `bandeHouleBord` éteint le déplacement AVANT le bord — coupe plate ;
//   ② `EMPRISE_MER_CROP` retire les sommets qui n'ont jamais rien à dessiner —
//      la déformation hors emprise n'est plus calculée, elle n'existe plus.

/**
 * **Jusqu'où la SURFACE de la mer existe**, en demi-côtés de crop.
 *
 * ⚡ **UN, PARCE QUE LE FRAGMENT N'EN GARDE QUE ÇA DEPUIS `bordDeMer()`.** La
 * nappe s'éteint à `−RETRAIT_EAU_CROP`, donc **dans** le crop : tout sommet
 * au-delà de `|u| = 1` ou `|v| = 1` ne peut, par construction, produire que des
 * fragments rejetés. Ils étaient pourtant **ombrés** — Gerstner sur seize
 * trains, `shoreSurf`, la lecture du champ — puis leurs triangles rasterisés
 * pour rien.
 *
 * ⛔ **ET CE N'EST SURTOUT PAS `PORTEE_CROP` QU'ON RÉTRÉCIT.** Le rapport MER §4
 * l'interdit et dit pourquoi : `portee` sert AUSSI à cuire le champ, à
 * normaliser `champ.unite` et à ancrer `profMaxCropM` — **la couleur du
 * turquoise d'Adrien**. Ici le champ garde ses 3 demi-côtés au bit près ; seule
 * la GÉOMÉTRIE se resserre. Les deux grandeurs étaient confondues dans un seul
 * paramètre ; `construireCalotte` les sépare.
 *
 * ⚠️ **LA DENSITÉ DE MAILLE NE BOUGE PAS**, et c'est ce qui rend le crop
 * identique au bit près : l'appelant divise `pas` dans le même rapport
 * (`192 × 1/3 = 64`), et les nœuds de la grille resserrée tombent EXACTEMENT sur
 * un sous-ensemble de ceux de l'ancienne (`(−1 + 2i/64) = (−1 + 2(i+64)/192)·3`).
 */
export const EMPRISE_MER_CROP = 1

/**
 * L'amplitude LATÉRALE maximale de la houle, en unités de scène.
 *
 * ⚠️ **C'EST LE TERME `q · a` DE `oceanGerstner`, REJOUÉ SUR LES MÊMES ENTRÉES**
 * — la borne de Stokes comprise (`q ≤ 1/(k a)`), et avec `fade = 1`, le pire
 * cas. `|d| = 1` et `|cos| ≤ 1`, donc la somme des `q · a` **majore** le
 * déplacement horizontal. Ce n'est pas une seconde loi : c'est la borne de la
 * loi, et le §« deux écritures qui divergent » vaut ici aussi — d'où le test qui
 * RELIT `src/vendor/ocean-waves/gerstner.glsl.js` pour vérifier que les trois
 * lignes qu'on majore sont toujours les siennes.
 *
 * @param {object} arg avec `a` / `b` (les seize `Vector4` du spectre), `houle`,
 *   `chop`, `calme`, `unite` (scène par unité de socle) et `lambda`.
 * @returns {number} en unités de scène, 0 si le spectre est absent ou muet
 */
export function amplitudeLateraleHoule({ a, b, houle, chop, calme = 1, unite, lambda } = {}) {
  if (!Array.isArray(a) || !Array.isArray(b) || !(lambda > 0)) return 0
  const waveH = houle * calme * unite
  if (!(waveH > 0) || !(chop >= 0)) return 0
  let somme = 0
  const n = Math.min(a.length, b.length, 16)
  for (let i = 0; i < n; i++) {
    const k = a[i].z / lambda
    const amp = a[i].w * lambda * waveH
    // ⚠️ **LE MÊME SEUIL QUE LE NUANCEUR** (`if (a < 1e-7) continue`) : un train
    // qu'il saute ne doit pas entrer dans la borne.
    if (!(amp >= 1e-7) || !(k > 0)) continue
    const ka = k * amp
    somme += Math.min((chop * 1.9 * b[i].z) / ka, 1 / ka) * amp
  }
  return somme
}

/**
 * Le facteur de sécurité de la bande d'extinction de la houle.
 *
 * ⚠️ **1,125 EST LA BORNE, PAS UN GOÛT, ET 2 EST LA MARGE.** On veut qu'un
 * sommet ne franchisse JAMAIS le bord : à la distance `δ` du bord, son
 * déplacement vaut au plus `A · lissage(δ/B)` et il faut `A · lissage(δ/B) < δ`
 * pour tout `δ ∈ ]0, B]`. Avec `lissage(t) = 3t² − 2t³`, cela s'écrit
 * `A · (3t − 2t²) < B`, dont le maximum en `t = 0,75` vaut **1,125 A**. Un `B`
 * au-dessus de `1,125 A` suffit donc ; `2 A` laisse 78 % de marge, et le test
 * ⑧c balaie les cent `t` de la bande pour le vérifier plutôt que le croire.
 */
export const MARGE_BANDE_HOULE = 2

/**
 * La largeur de la bande où la houle s'éteint avant le bord, en demi-côtés.
 *
 * ⚡ **C'EST LA MOITIÉ « COUPE PLATE » DE D24.** Dedans, l'amplitude descend à
 * zéro par le même lissage que partout ailleurs dans ce module ; au bord, elle
 * vaut EXACTEMENT zéro — donc le sommet est là où `aCrop` dit qu'il est, donc le
 * `discard` du fragment et la géométrie parlent enfin de la même chose. **Le
 * bord de la nappe coïncide alors avec l'arête du socle par construction**, sans
 * un pixel à mesurer, exactement comme la superellipse le fait déjà pour la
 * découpe.
 *
 * ⚠️ **ELLE EST AUSSI ÉTROITE QUE LA HOULE LE PERMET.** Elle vaut deux fois le
 * déplacement latéral maximal, pas une fraction du crop : au relevé de La
 * Réunion (`amplitude = 3,3·10⁻⁴` unité de scène, demi-côté `0,2126`) elle fait
 * **0,0031 demi-côté**, soit **21 m au sol** — plus étroit que le retrait de
 * l'eau lui-même (53,8 m). Une bande large calmerait la mer sur tout le
 * pourtour ; c'est précisément la régression de qualité qu'Adrien a déjà
 * signalée une fois.
 *
 * @param {number} amplitudeScene la sortie d'`amplitudeLateraleHoule`
 * @param {number} parDemi unités de scène par demi-côté de crop
 * @returns {number} la largeur de bande, en demi-côtés, dans ]0 ; 0,5]
 */
export function bandeHouleBord(amplitudeScene, parDemi) {
  if (!(parDemi > 0) || !(amplitudeScene > 0)) return 0
  // ⚠️ **PLAFONNÉE À UN DEMI-CÔTÉ.** Une houle démesurée (banc, tirette poussée)
  // ne doit pas calmer la moitié du crop en silence : le plafond est visible, et
  // c'est la « limite écrite plutôt que cachée » de `PORTEE_DEFAUT`.
  return Math.min(0.5, (MARGE_BANDE_HOULE * amplitudeScene) / parDemi)
}

/**
 * La distance signée au bord du crop — **une seule écriture, deux lecteurs.**
 *
 * ⛔ **ELLE VIVAIT DANS `MER_FRAG` SEUL, ET D24 A BESOIN D'ELLE AU SOMMET.** La
 * recopier dans `MER_VERT` aurait fait deux superellipses à garder d'accord,
 * c'est-à-dire la faute que ce module raconte cinq fois (`RETRAIT_EAU_CROP`,
 * `CHAMP_RES`, la rampe nautique, `uSky`, l'échelle de houle). Elle est donc
 * **extraite**, injectée dans les deux nuanceurs, et `test/mer-sphere.test.js`
 * ⑧a vérifie qu'aucun des deux ne réécrit `pow(pow(`.
 *
 * ⚠️ **AUCUN ACCENT NI APOSTROPHE** : ce texte part tel quel au compilateur GLSL.
 */
export const GLSL_BORD_CROP = /* glsl */ `
// 0 = la frontiere du crop, < 0 = DEDANS, > 0 = dehors. C est la MEME mesure que
// le discard des tuiles (globe.js, uCropCoin / uCropCoinN) : le terme
// min(max(q.x, q.y), 0.0) est la distance INTERIEURE de la boite arrondie, sans
// lequel dBord se fige a -uCropCoin partout dedans (Tache P4).
float distanceBordCrop(vec2 qCrop, float coin, float expo) {
  vec2 q = abs(qCrop) - (1.0 - coin);
  vec2 cq = max(q, 0.0);
  float pn = pow(pow(cq.x, expo) + pow(cq.y, expo), 1.0 / expo);
  return pn - coin + min(max(q.x, q.y), 0.0);
}

// L attenuation de la houle au bord : 1 partout dedans, EXACTEMENT 0 des que le
// sommet atteint le bord de la nappe. C est le meme lissage que richesseMer, et
// le meme motif : une sortie ANTICIPEE, pas une multiplication par presque zero.
float attenuationBordMer(float dBord, float fin, float bande) {
  return 1.0 - smoothstep(fin - max(bande, 1e-7), fin, dBord);
}
`
