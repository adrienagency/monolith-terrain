// LES PAROIS ET LA BASE DU CROP — Tâche B du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// Module PUR : ni DOM, ni three.js, ni état, ni réseau. Il prend une loi de
// forme, un champ de hauteurs et un repère, et rend des tableaux de nombres.
// Tout se vérifie sous node (`test/crop-parois.test.js`).
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// La Tâche A a coupé les tuiles du globe à la forme du socle, dans le nuanceur.
// **Le crop est donc devenu une PEAU FLOTTANTE** — une carte sans épaisseur,
// posée sur une planète qu'on voit à travers. Il lui faut ses parois et sa base.
//
// ══════════ 1. LA DÉCISION D'ADRIEN, ET ELLE PRIME ══════════════════════════
//
// ⚠️ **LES PAROIS SONT VERTICALES ET PARALLÈLES, PAS RADIALES. LA BASE A LA MÊME
// TAILLE QUE LE DESSUS.** (Décision 2 du plan, tranchée le 2026-08-21.)
//
// Physiquement c'est faux : sur une planète, « vertical » tourne avec la
// latitude, et deux verticales distantes de 10,4 km convergent d'un angle de
// 10 377 / 6 371 000 = **1,63·10⁻³ rad**. Une base radiale serait donc plus
// petite que le dessus de ce facteur-là. Adrien a tranché contre : **c'est
// l'objet-affiche que ses utilisateurs connaissent, la justesse physique cède au
// produit.** Ce fichier applique la décision, il ne la rediscute pas.
//
// La conséquence technique est heureuse : elle donne le repère. **`y` est la
// verticale UNIQUE du crop — le rayon de la planète en son CENTRE** — et toute
// la géométrie se construit dans ce repère-là.
//
// ══════════ 2. LE REPÈRE LOCAL — ET CE QU'IL ACHÈTE ═════════════════════════
//
// Base orthonormée DIRECTE prise au centre du crop :
//
//     x = est · y = HAUT (le rayon) · z = SUD          (est × haut = sud)
//
// C'est **exactement la convention d'axes de `computeSlab`** (`plinth.js:152` :
// « z = −HALF est le NORD, z = +HALF le SUD, x = +HALF l'EST »), ce qui permet
// de reprendre son tracé d'anneau sans le retourner.
//
// Trois choses en découlent, et aucune n'est cosmétique :
//
//   · **LE RTC EST GRATUIT** (§4 de `/threejs-optimisation`). Les sommets sont
//     relatifs au centre du crop, donc de magnitude ~0,12 unité au lieu de 100 :
//     le pas représentable du float32 tombe de 0,486 m à **4,8·10⁻⁴ m**. La
//     position mondiale vit dans la matrice de l'objet, comme pour les tuiles.
//   · **`auditerSolide` PEUT MESURER LES HAUTEURS.** Son relevé se fait sur un
//     axe de tableau (`axeHauteur: 'y'`) ; dans le repère du MONDE, `y` du globe
//     n'a rien à voir avec la verticale d'un crop à 45° de latitude, et
//     `hauteurs.amplitude` n'aurait mesuré que l'inclinaison du crop.
//   · **LES PAROIS SONT VERTICALES PAR CONSTRUCTION** : le sommet du bas est le
//     sommet du haut avec `y` remplacé par `baseY`, ses `x` et `z` **au bit
//     près**. Aucune projection, donc aucune dérive à mesurer.
//
// ══════════ 3. LA FORME — LA MÊME QUE LA SURFACE, ET C'EST TOUT LE SUJET ════
//
// ⚠️ **LA FORME EST `dansDalle` (`damier-bords.js:181`), LA SUPERELLIPSE EXACTE.**
// C'est la loi que le nuanceur du socle découpe, celle que `slabInside`
// (`map/block-clip.js`) dit « mirror terrain.js's slab-corner discard », et celle
// que la Tâche A a posée dans le nuanceur du globe. **Si la paroi et la surface
// n'appliquaient pas EXACTEMENT la même loi, il y aurait un liseré.**
//
// ⚠️ **ET LE DÉTAIL QUI DOIT SERVIR D'AVERTISSEMENT : l'écart entre la
// superellipse et son octogone circonscrit (`dansFenetre`) est NUL à 45°** — le
// plan diagonal y est tangent, mesuré à 1,4·10⁻¹⁴ par la Tâche A. **Un test posé
// là ne les aurait pas distinguées.** Il est maximal à **44,3°, où il vaut 0,129
// unité, soit 23,9 m au sol.** `test/crop-parois.test.js` pose donc son test de
// forme à 44,3°, et il écrit à côté ce que 45° aurait laissé passer.
//
// On ne retrace donc pas la courbe : **on appelle `arcCoin`** (`fenetre-clip.js`),
// exactement comme `computeSlab`, avec le même pas et le même exposant. La
// superellipse est invariante d'échelle — la tester à demi-côté 1 avec un rayon
// normalisé rend le même verdict qu'à demi-côté 28 —, donc l'anneau se trace une
// fois pour toutes dans le carré ±1 du crop.
//
// ══════════ 4. LA FRONTIÈRE TOMBE AU MILIEU DES TUILES ══════════════════════
//
// ⚠️ **LE PIÈGE QUE LE PLAN NOMME (Étape 3).** Le bord du crop ne suit aucune
// grille : il traverse les tuiles du quadtree en diagonale, et un sommet de
// paroi accroché « au sommet de tuile le plus proche » serait à une autre
// hauteur que la surface dessinée juste à côté. C'est un liseré, et il se voit.
//
// D'où la signature : ce module ne reçoit pas une grille, il reçoit **une
// fonction `hauteur(lat, lon)`** et l'appelle **au point de coupe exact**. Le
// globe la sert par `hauteurSurface`, qui interpole bilinéairement dans la tuile
// la plus fine qui couvre le point (même geste que `remplirHauteurs`, à un point
// au lieu d'une grille). Mesuré au banc du test (`.banc/mesure-B2.mjs`, champ
// de relief synthétique, anneau de 1 020 points) : accrocher au nœud le plus
// proche d'une tuile z13 à 512 px déplace le sommet de **29,96 m au pire** —
// quatre texels et demi de socle, et le liseré est là.
//
// ⚠️ **ET LE PLANCHER DE MER EST CELUI DU GLOBE, PAS UN CHOIX D'ICI.**
// `globe.js` (`_buildMesh`, `posAt`) pose ses sommets à
// `Math.max(sampleHeights(...), 0)` — « oceans stay on the sphere ». Une paroi
// qui suivrait la bathymétrie brute passerait SOUS la surface dessinée : encore
// un liseré, et celui-là ferait le tour de chaque côte. `plancherMer` porte donc
// la valeur 0 par défaut, et le test la verrouille.
//
// ⚠️ **ET DEPUIS LA TÂCHE J bis, LA PHRASE CI-DESSUS N'EST VRAIE QUE DU DÉFAUT.**
// Le globe pose désormais un FOND sur le crop (`src/monde/fond-crop.js`) : sa
// surface descend à −2 116,3 m à La Réunion, et c'est alors un plancher à zéro
// qui ferait passer la paroi AU-DESSUS de sa propre surface. `globe.js` descend
// donc `plancherMer` à la profondeur du champ quand un fond est posé, et le
// laisse à zéro sinon. **Le raisonnement du dessus n'a pas changé : la paroi
// suit la surface DESSINÉE. C'est la surface dessinée qui a changé.**
//
// ══════════ 5. CE QU'ON A PORTÉ DE `buildSlabWalls`, ET CE QUI SE PERD ══════
//
// `buildSlabWalls` (`plinth.js:232`) offre **douze options**. L'Étape 4 de la
// tâche demande de dire, pour chacune, ce qui passe et ce qui se perd.
//
// **PORTÉES — sept :**
//   ① `depth` → `profondeur`. ⚠️ **EN FRACTION DE LA LARGEUR, PAS EN UNITÉS.**
//      Le socle fait 7 unités de profondeur pour 56 de large ; recopier « 7 »
//      dans un crop qui fait 0,163 unité de large aurait donné un puits de
//      quarante fois sa largeur. `FRACTION_PROFONDEUR = 7 / 56` porte la
//      proportion, qui est ce qui se voit.
//   ② `resolution` → `PAS_CONTOUR`, le pas de l'anneau ramené au demi-côté 1
//      (`TERRAIN_SIZE / 256` devient `2 / 256`).
//   ③ `cornerR` → `forme.coin`, le rayon NORMALISÉ que `poserCrop` pose déjà.
//   ④ `cornerExp` → `forme.expo`, idem. Ce sont les deux mêmes nombres que le
//      nuanceur reçoit en `uCropCoin` / `uCropCoinN` : **une seule source.**
//   ⑤ `baseYFloor` → tel quel. Il n'a pas de damier à servir ici, mais c'est la
//      seule manière d'imposer un fond commun, et il coûte une ligne.
//   ⑥ `aoForce` et ⑦ `aoBande` → l'occlusion de contact, cuite dans un attribut
//      de couleur par sommet. **C'est elle qui fait lire « objet posé » plutôt
//      que « carte flottante »**, et elle ne touche à aucune géométrie, donc à
//      aucun verdict de fermeture. La formule est RECOPIÉE (voir
//      `occlusionContact`), pas importée : `plinth.js` tire three.js **et**
//      `terrain.js`, et ce module doit rester pur. ⚠️ **Une recopie n'est
//      acceptable que tenue par un test**, et `test/crop-parois.test.js` la
//      confronte point par point à `contactAO`.
//
// **PERDUES — cinq, et voici pourquoi :**
//   ⑧ `masqueArrondi` et ⑨ `bords` — **SANS OBJET ICI, structurellement.** Les
//      deux existent pour le DAMIER : « deux congés qui se font face à une
//      jointure creusent une rainure » (`damier-bords.js`). Le crop est **un
//      seul bloc, sans voisine** ; `facteursCoins(null)` rend déjà les quatre
//      coins arrondis, c'est-à-dire le cas isolé. Les porter aurait été porter
//      deux paramètres dont l'entrée n'existe pas. ⚠️ **Et ce n'est plus vrai le
//      jour où un damier de crops apparaît** — la Tâche H et les « crops
//      continentaux » du §8 le rouvriraient.
//   ⑩ `chanfrein` et ⑪ `arrondi` / ⑫ `arrondiSeg` — **UNE VRAIE PERTE, ASSUMÉE
//      ET DATÉE.** Le liseré d'arête haute et le congé bas sont le geste qui
//      donne sa matière au socle (« il est vraiment arrondi, et c'est un vrai
//      chanfrein dessous », capture d'Adrien). Trois raisons de ne pas les
//      porter dans CETTE tâche, dans l'ordre de leur poids :
//        · ils demandent la machinerie de bissectrice et d'onglet de
//          `buildSlabWalls` (~35 lignes) **plus** des normales analytiques pour
//          le congé — sans elles, trois segments se lisent comme trois facettes,
//          « l'inverse exact de l'intention » ;
//        · le chanfrein fait rentrer le mur sous son sommet, donc **rétrécit la
//          base** de 0,29 % de la largeur. C'est minuscule, mais c'est
//          littéralement la décision 2 qu'on entamerait, et une entame se
//          rediscute avec Adrien, pas toute seule ;
//        · leur garde-fou (`min(x, (topMax − baseY) × 0,25)`) est calibré sur un
//          socle à exagération 2,8. **Le globe est à 18** (Tâche E), donc
//          `topMax − baseY` y est six fois plus grand qu'il ne le sera : tout
//          rayon posé maintenant serait à reposer après la Tâche E.
//      ⚠️ **CONSÉQUENCE VISIBLE, ET IL FAUT LA DIRE : le bloc a pour l'instant
//      des arêtes VIVES, en haut comme en bas.** C'est plus dur, plus « CAO »,
//      que le socle d'aujourd'hui.
//
// ⚠️ **ET LA DÉCISION 5 RESTE :** « la gravure ne s'écrit qu'à l'arrêt ». Ce
// module reconstruit toute la géométrie à chaque appel — il n'est pas fait pour
// tourner par image. C'est l'appelant qui décide quand, et `globe.js` ne le
// rappelle que si le repère du crop a bougé.
//
// ══════════ 6. LE COUVERCLE-TÉMOIN — CE QU'IL EST ET CE QU'IL N'EST PAS ═════
//
// ⚠️ **IL N'EST PAS LIVRÉ, ET IL NE DOIT PAS L'ÊTRE.** Le dessus du crop est
// dessiné par les tuiles du globe, sur le GPU ; poser une nappe CPU par-dessus
// serait à la fois le rééchantillonnage que le §5 du plan enterre et une
// bagarre de profondeur.
//
// Mais `auditerSolide` mesure une COQUE FERMÉE, et parois + fond sont ouverts
// par le haut. `indicesCouvercle` referme donc la coque **sur les mêmes sommets
// d'anneau que les parois** — un éventail depuis le point de surface au centre
// du crop. C'est un témoin légitime : si une paroi manque, si le fond manque, si
// l'anneau haut et l'anneau bas ont cessé de coïncider, Ā monte. Ce qu'il ne
// prouve pas, c'est que le GPU dessine bien la surface là où l'anneau l'attend —
// **et rien ne le prouve sous node.** C'est l'affaire de l'Étape 7.

// ══════════ 7. LA TUILE ABSENTE — LA DÉCISION, ET SON MOTIF ════════════════
//
// ⚠️ **LA PREMIÈRE VERSION DE CE MODULE RENDAIT `0` SUR UN POINT NON COUVERT,
// ET C'ÉTAIT UN DÉFAUT SILENCIEUX.** Zéro n'est pas « pas de donnée » : c'est
// **le niveau de la mer**. Une tuile qui manque au bord du crop creusait donc
// une ENCOCHE dans la paroi, exactement à la hauteur de la mer, sans qu'aucun
// appelant ne puisse le voir — `couverture` sortait bien de la fonction, et
// personne ne la lisait.
//
// **DÉCISION : la paroi REFUSE de se bâtir sous `couvertureMin`, qui vaut 1.**
// Trois raisons, dans l'ordre de leur poids :
//
//   ① **Le repli sur un ancêtre plus grossier existe DÉJÀ, et il est gratuit.**
//      `globe.hauteurSurface` prend la tuile **la plus fine qui couvre le
//      point** : si la z13 n'est pas là mais la z8 oui, elle rend la z8. Le cas
//      « pas assez fin » est donc traité en amont et ne remonte jamais ici.
//      `null` ne veut pas dire « grossier », il veut dire **rien du tout** —
//      et `globe.js` ne purge jamais ses seize racines z2. En pratique cela
//      n'arrive qu'AVANT que les racines soient chargées.
//   ② **Une paroi à encoches est pire que pas de paroi.** Le crop est un objet
//      d'affiche ; une encoche au niveau de la mer se lit comme un défaut du
//      produit, pas comme un chargement en cours. Ne rien dessiner se lit,
//      lui, comme un chargement.
//   ③ **Le refus est RÉVERSIBLE et sans effet de bord** : `globe.js` ne touche
//      pas aux parois déjà en place quand il refuse. Le bloc précédent reste à
//      l'écran jusqu'à ce que la donnée arrive.
//
// ⚠️ **ET SI L'APPELANT ABAISSE LE SEUIL, IL ACHÈTE LES ENCOCHES** : les points
// manquants se posent alors au plancher de mer. C'est écrit ici pour que ce ne
// soit jamais une surprise.

import { arcCoin } from '../fenetre-clip.js' // pur : aucune importation
import { latLonDeLocal } from './crop-sphere.js'

/** Le pas de l'anneau, ramené au demi-côté 1. `plinth.js` : TERRAIN_SIZE / 256. */
export const PAS_CONTOUR = 2 / 256

/**
 * La profondeur du bloc, en FRACTION de sa largeur.
 * ⚠️ **7 / 56, ET LES DEUX CHIFFRES SONT AU DÉPÔT** : `depth = 7` par défaut
 * dans `buildSlabWalls`, `TERRAIN_SIZE = 56` dans `terrain.js`. Ce n'est pas un
 * goût, c'est la proportion du socle d'aujourd'hui.
 */
export const FRACTION_PROFONDEUR = 7 / 56

/** La bande d'occlusion, en fraction de la hauteur du mur. `plinth.js` : 0,12. */
export const FRACTION_BANDE_AO = 0.12

/** L'assombrissement au contact. `plinth.js` : SOCLE_AO_FORCE = 0,2. */
export const FORCE_AO = 0.2

/** Le balayage intérieur du « basin guard ». `plinth.js` : INTERIOR_STEPS = 12. */
const PAS_INTERIEUR = 12

const D2R = Math.PI / 180

/**
 * L'occlusion de contact — **RECOPIE VERROUILLÉE de `contactAO`**
 * (`plinth.js:110`). 1 au grand jour, `1 − force` au pied du mur, chute en carré.
 *
 * ⚠️ **RECOPIÉE, PAS IMPORTÉE, ET C'EST UN CHOIX SOURCÉ** : `plinth.js` importe
 * three.js et `terrain.js`, ce module doit rester pur. Le précédent est explicite
 * dans ce dépôt — `dem-emprise.js:428` : « RECOPIÉE VOLONTAIREMENT plutôt
 * qu'importée : ce module doit rester pur ». Et comme là-bas, **la recopie est
 * tenue par un test** qui la confronte à l'originale.
 */
export function occlusionContact(y, baseY, bande, force = FORCE_AO) {
  if (!(bande > 0) || !(force > 0)) return 1
  const t = Math.max(0, Math.min(1, (y - baseY) / bande))
  const k = 1 - t
  return 1 - force * k * k
}

/**
 * L'anneau du crop, en coordonnées LOCALES (±1), sens horaire vu du dessus.
 *
 * ⚠️ **LE TRACÉ EST CELUI DE `computeSlab`, RAMENÉ AU DEMI-CÔTÉ 1** — mêmes
 * côtés droits, mêmes arcs par `arcCoin`, même ordre de parcours. Les points
 * d'arc vont de `a0` INCLUS à `a1` EXCLU (convention d'`arcCoin`), donc aucun
 * doublon avec le côté droit qui suit : un doublon serait un triangle dégénéré
 * de paroi, et `auditerSolide` le refuserait.
 *
 * @param {number} coin - rayon d'arrondi, en FRACTION du demi-côté (0 = carré)
 * @param {number} expo - exposant de superellipse (2 = cercle, 4,4 = défaut)
 * @param {number} pas - espacement visé, en unités locales
 * @returns {Array<{u:number,v:number}>}
 */
export function contourCrop(coin = 0, expo = 2, pas = PAS_CONTOUR) {
  const r = Math.max(0, Math.min(coin, 1))
  const anneau = []
  const bord = (u, v) => anneau.push({ u, v })
  if (r === 0) {
    const n = Math.max(8, Math.round(2 / pas))
    for (let i = 0; i < n; i++) bord(-1 + (2 * i) / n, -1)
    for (let i = 0; i < n; i++) bord(1, -1 + (2 * i) / n)
    for (let i = 0; i < n; i++) bord(1 - (2 * i) / n, 1)
    for (let i = 0; i < n; i++) bord(-1, 1 - (2 * i) / n)
    return anneau
  }
  const inner = 1 - r
  const droitN = Math.max(1, Math.round((inner * 2) / pas))
  const ligne = (u0, v0, u1, v1) => {
    for (let i = 0; i < droitN; i++) {
      const t = i / droitN
      bord(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t)
    }
  }
  const arc = (cu, cv, a0, a1) => {
    for (const [eu, ev] of arcCoin(a0, a1, r, expo, pas)) bord(cu + eu, cv + ev)
  }
  ligne(-inner, -1, inner, -1) //  côté nord (v = −1)
  arc(inner, -inner, -Math.PI / 2, 0) //  coin nord-est
  ligne(1, -inner, 1, inner) //  côté est
  arc(inner, inner, 0, Math.PI / 2) //  coin sud-est
  ligne(inner, 1, -inner, 1) //  côté sud
  arc(-inner, inner, Math.PI / 2, Math.PI) //  coin sud-ouest
  ligne(-1, inner, -1, -inner) //  côté ouest
  arc(-inner, -inner, Math.PI, Math.PI * 1.5) //  coin nord-ouest
  return anneau
}

/** (lat, lon, rayon) → position sphérique. Recopie de `geo.js:209`, qui tire three. */
export function surSphere(lat, lon, rayon) {
  const la = lat * D2R
  const lo = lon * D2R
  return [rayon * Math.cos(la) * Math.sin(lo), rayon * Math.sin(la), rayon * Math.cos(la) * Math.cos(lo)]
}

/**
 * Le repère LOCAL du crop : origine au centre, sur la SPHÈRE NUE, base
 * orthonormée directe **(est, haut, sud)**.
 *
 * ⚠️ **EXTRAITE DE `construireSolideCrop` PAR LA TÂCHE F, ET C'EST TOUT LE
 * POINT.** La mer de la Tâche F vit dans CE repère, et pas dans un jumeau :
 * si la calotte et les parois n'avaient pas exactement la même base, la
 * surface de l'eau ne rencontrerait pas le mur — c'est le liseré que le §3 de
 * ce fichier passe déjà son temps à éviter, à une dimension de plus.
 * La question 2 du §1 de `/threejs-optimisation` dit la même chose : une
 * constante — ici une base — recopiée diverge en silence.
 *
 * ⚠️ **SUR LA SPHÈRE NUE, ET PAS SUR LA SURFACE DÉPLACÉE** — à l'inverse de
 * `_buildMesh`, qui prend son origine sur la surface déplacée pour le RTC. La
 * raison est ici différente : `y = 0` doit vouloir dire « le niveau de la mer »
 * pour que `hauteurs` reste lisible et que `baseY` se compare d'un crop à
 * l'autre. Le gain de précision est le même à 10⁻⁴ près (le relief exagéré ne
 * décale l'origine que d'une fraction de la largeur du crop).
 *
 * @param {{cx:number,cy:number,demi:number}} repere - `repereCrop`
 * @param {number} rayon - rayon de la sphère, en unités de scène
 * @returns {{origine:number[], est:number[], haut:number[], sud:number[], centre:{lat:number,lon:number}}}
 */
export function repereLocalCrop(repere, rayon) {
  const centre = latLonDeLocal(0, 0, repere)
  const O = surSphere(centre.lat, centre.lon, rayon)
  const haut = [O[0] / rayon, O[1] / rayon, O[2] / rayon]
  // le nord local : la composante du pôle orthogonale au rayon
  const nord = [-haut[1] * haut[0], 1 - haut[1] * haut[1], -haut[1] * haut[2]]
  const ln = Math.hypot(nord[0], nord[1], nord[2])
  if (!(ln > 1e-12)) throw new Error('repereLocalCrop : crop au pôle, le nord local est indéfini')
  nord[0] /= ln; nord[1] /= ln; nord[2] /= ln
  // est = nord × haut ; sud = −nord. (est, haut, sud) est DIRECT : est × haut = sud
  const est = [
    nord[1] * haut[2] - nord[2] * haut[1],
    nord[2] * haut[0] - nord[0] * haut[2],
    nord[0] * haut[1] - nord[1] * haut[0],
  ]
  return { origine: O, est, haut, sud: [-nord[0], -nord[1], -nord[2]], centre }
}

/**
 * Le solide du crop : ses parois VERTICALES, son fond PLAT, et le
 * couvercle-témoin qui permet de l'auditer (§6).
 *
 * Tout sort dans le repère LOCAL du crop (§2) : `origine` et `base` disent où le
 * poser dans le monde.
 *
 * @param {object} arg
 * @param {{cx:number,cy:number,demi:number}} arg.repere - `repereCrop(...)`
 * @param {{coin:number,expo:number}} arg.forme - la MÊME que celle du nuanceur
 * @param {(lat:number, lon:number) => number} arg.hauteur - mètres, au point EXACT
 * @param {number} arg.rayon - R_GLOBE, en unités de scène
 * @param {number} arg.echelle - unités de scène par mètre d'altitude
 * @param {number} [arg.pas] - espacement de l'anneau (voir `PAS_CONTOUR`)
 * @param {number} [arg.profondeur] - en unités ; défaut `fractionProfondeur × largeur`
 * @param {number} [arg.fractionProfondeur] - la profondeur EN FRACTION de la
 *   largeur du bloc, quand `profondeur` n'est pas imposée. ⛔ **Tâche P6 : elle
 *   n'existait pas, et `FRACTION_PROFONDEUR = 7 / 56` était donc GELÉE** —
 *   c'est-à-dire `params.plinthDepth` à son défaut, pendant que la tirette
 *   « profondeur du socle » vit et déplace celle du bloc plat. Même famille que
 *   `couleursFond` (P5) et que `corner` (P6) : un défaut qui a l'air juste parce
 *   qu'il coïncide avec le réglage d'usine.
 * @param {number|null} [arg.baseYFloor] - fond IMPOSÉ, jamais plus haut
 * @param {number} [arg.plancherMer] - le plancher du globe (§4), 0 par défaut
 * @param {number} [arg.couvertureMin] - fraction de points qui doivent avoir
 *   une hauteur connue ; **1 par défaut : un seul trou et la paroi REFUSE de
 *   se bâtir** (§7). Rend alors `{ refus: 'couverture', couverture }`.
 * @param {number} [arg.aoForce] - profondeur de l'occlusion de contact
 * @param {number|null} [arg.aoBande] - la bande IMPOSÉE, en unités monde
 */
export function construireSolideCrop({
  repere,
  forme = { coin: 0, expo: 2 },
  hauteur,
  rayon,
  echelle,
  pas = PAS_CONTOUR,
  profondeur = null,
  fractionProfondeur = FRACTION_PROFONDEUR,
  baseYFloor = null,
  plancherMer = 0,
  couvertureMin = 1,
  aoForce = FORCE_AO,
  aoBande = null,
} = {}) {
  if (!repere || !Number.isFinite(repere.demi)) {
    throw new TypeError('construireSolideCrop : il faut un `repere` (repereCrop)')
  }
  if (typeof hauteur !== 'function') {
    throw new TypeError('construireSolideCrop : `hauteur(lat, lon)` est obligatoire — voir le §4')
  }
  if (!(rayon > 0) || !Number.isFinite(echelle)) {
    throw new TypeError('construireSolideCrop : `rayon` et `echelle` doivent être finis')
  }

  const anneau = contourCrop(forme.coin ?? 0, forme.expo ?? 2, pas)
  const n = anneau.length

  // ─── ① LE REPÈRE LOCAL (§2) : origine au centre du crop, sur la SPHÈRE NUE ─
  //
  // ⚠️ **SUR LA SPHÈRE NUE, ET PAS SUR LA SURFACE DÉPLACÉE** — à l'inverse de
  // `_buildMesh`, qui prend son origine sur la surface déplacée pour le RTC. La
  // raison est ici différente : `y = 0` doit vouloir dire « le niveau de la mer »
  // pour que `hauteurs` reste lisible et que `baseY` se compare d'un crop à
  // l'autre. Le gain de précision est le même à 10⁻⁴ près (le relief exagéré ne
  // décale l'origine que d'une fraction de la largeur du crop).
  // ⚠️ **APPELÉE, PAS RECOPIÉE** : depuis la Tâche F, la mer sphérique lit LE
  // MÊME repère (`repereLocalCrop`, plus haut dans ce fichier). Deux bases
  // écrites deux fois auraient fini par diverger, et la mer ne rencontrerait
  // plus le mur.
  const { origine: O, est, haut, sud, centre } = repereLocalCrop(repere, rayon)

  // ─── LA COUVERTURE : CE QU'ON FAIT QUAND PERSONNE NE SAIT (§7) ───────────
  let vus = 0
  let manquants = 0

  /**
   * La hauteur au point EXACT, plancher de mer appliqué — ou `null` quand la
   * source ne sait pas.
   *
   * ⚠️ **`null` EST UNE RÉPONSE, PAS UNE PANNE, ET CE N'EST PAS ZÉRO.** La
   * première version de ce module rendait `0` sur un point non couvert, c'est-à-
   * dire **le niveau de la mer** : une tuile absente creusait une ENCOCHE dans
   * la paroi, à la hauteur exacte de la mer, sans que rien ne le dise. Voir le
   * §7 pour la décision et son motif.
   */
  const lire = (lat, lon) => {
    const h = hauteur(lat, lon)
    if (h == null || !Number.isFinite(h)) { manquants++; return null }
    vus++
    return Math.max(h, plancherMer) // le plancher du globe, §4
  }

  /**
   * Un point de la surface DÉPLACÉE, en coordonnées locales (doubles).
   * Rend `null` si la hauteur manque ET que l'appelant tolère les trous ; sinon
   * le point se pose au NIVEAU DE LA MER et le compteur s'en souvient.
   *
   * ⚠️ **LE REPLI D'UN POINT INCONNU EST ZÉRO, PAS `plancherMer` — ET DEPUIS LA
   * TÂCHE J bis CE N'EST PLUS LA MÊME CHOSE.** `plancherMer` valait 0 tant que
   * le globe écrêtait sa mer sur la sphère : les deux écritures rendaient donc
   * le même nombre, au bit près. Maintenant que le crop porte son fond marin,
   * l'appelant descend `plancherMer` à la profondeur du champ (−2 116,3 m relevés
   * à La Réunion) — et poser là un point INCONNU l'enverrait au fond de la
   * fosse. `couvertureMin = 1` refuse avant que ça n'atteigne la géométrie, mais
   * un repli qui ne tient que par la garde du dessus n'est pas un repli.
   */
  const surface = (u, v) => {
    const { lat, lon } = latLonDeLocal(u, v, repere)
    const h = lire(lat, lon) ?? 0
    const P = surSphere(lat, lon, rayon + h * echelle)
    const d = [P[0] - O[0], P[1] - O[1], P[2] - O[2]]
    return [
      d[0] * est[0] + d[1] * est[1] + d[2] * est[2],
      d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2],
      d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2],
    ]
  }

  // ─── ② L'ANNEAU HAUT, ET LES EXTRÊMES ────────────────────────────────────
  const hautX = new Float64Array(n)
  const hautY = new Float64Array(n)
  const hautZ = new Float64Array(n)
  let minY = Infinity
  let hautMax = -Infinity
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (let k = 0; k < n; k++) {
    const p = surface(anneau[k].u, anneau[k].v)
    hautX[k] = p[0]; hautY[k] = p[1]; hautZ[k] = p[2]
    if (p[1] < minY) minY = p[1]
    if (p[1] > hautMax) hautMax = p[1]
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]
    if (p[2] < z0) z0 = p[2]; if (p[2] > z1) z1 = p[2]
  }

  // ⚠️ LE BALAYAGE INTÉRIEUR — le « basin guard » de `computeSlab`, porté tel
  // quel : « baseY sits `depth` below the LOWEST point anywhere on the patch
  // (not just the border) so a deep interior basin can never pierce the base
  // plane ». Un lac de cratère au milieu du crop percerait le fond sans lui.
  for (let j = 1; j < PAS_INTERIEUR; j++) {
    for (let i = 1; i < PAS_INTERIEUR; i++) {
      const y = surface(-1 + (2 * i) / PAS_INTERIEUR, -1 + (2 * j) / PAS_INTERIEUR)[1]
      if (y < minY) minY = y
    }
  }

  const largeur = Math.max(x1 - x0, z1 - z0)
  // ⚠️ **LA FRACTION EST ÉCRÊTÉE À ZÉRO, PAS SEULEMENT LA PROFONDEUR** : une
  // tirette négative (ou un `NaN` remonté d'un uniforme absent) ferait un bloc
  // dont le fond passe AU-DESSUS de sa surface, et `computeSlab` du socle borne
  // déjà de la même façon.
  const fr = Number.isFinite(fractionProfondeur) ? Math.max(0, fractionProfondeur) : FRACTION_PROFONDEUR
  const prof = Number.isFinite(profondeur) ? Math.max(0, profondeur) : fr * largeur
  const baseBrut = minY - prof
  const baseY = baseYFloor != null ? Math.min(baseYFloor, baseBrut) : baseBrut
  const bande = Number.isFinite(aoBande) ? Math.max(0, aoBande) : FRACTION_BANDE_AO * Math.max(0, hautMax - baseY)

  // ─── LE VERDICT DE COUVERTURE — voir le §7 ───────────────────────────────
  //
  // ⚠️ **AVANT DE POSER LE MOINDRE SOMMET.** Une paroi à trous n'est pas une
  // paroi dégradée, c'est une paroi FAUSSE : les points manquants tombent au
  // niveau de la mer et découpent des encoches dans le flanc du bloc.
  const couverture = vus + manquants > 0 ? vus / (vus + manquants) : 0
  if (couverture < couvertureMin) {
    return { refus: 'couverture', couverture, vus, manquants, anneau, compte: { anneau: n } }
  }

  // ─── ③ LES SOMMETS ───────────────────────────────────────────────────────
  //
  // 0 … n−1     l'anneau HAUT, sur la surface exacte
  // n … 2n−1    l'anneau BAS : le MÊME x et le MÊME z, y = baseY (§2)
  // 2n          le centre du fond
  // 2n+1        le point de surface au centre du crop — le sommet du couvercle
  const nbSommets = 2 * n + 2
  const positions = new Float32Array(nbSommets * 3)
  const couleurs = new Uint8Array(nbSommets * 3)
  const teinte = (i, y) => {
    const ao = Math.round(255 * occlusionContact(y, baseY, bande, aoForce))
    couleurs[i * 3] = ao; couleurs[i * 3 + 1] = ao; couleurs[i * 3 + 2] = ao
  }
  for (let k = 0; k < n; k++) {
    positions[k * 3] = hautX[k]; positions[k * 3 + 1] = hautY[k]; positions[k * 3 + 2] = hautZ[k]
    teinte(k, hautY[k])
    const b = n + k
    positions[b * 3] = hautX[k]; positions[b * 3 + 1] = baseY; positions[b * 3 + 2] = hautZ[k]
    teinte(b, baseY)
  }
  positions[2 * n * 3] = 0; positions[2 * n * 3 + 1] = baseY; positions[2 * n * 3 + 2] = 0
  teinte(2 * n, baseY)
  const sommet = surface(0, 0)
  positions[(2 * n + 1) * 3] = sommet[0]
  positions[(2 * n + 1) * 3 + 1] = sommet[1]
  positions[(2 * n + 1) * 3 + 2] = sommet[2]
  teinte(2 * n + 1, sommet[1])

  // ─── ④ LES FACES ─────────────────────────────────────────────────────────
  //
  // ⚠️ L'ORIENTATION SE DÉMONTRE, ELLE NE SE DEVINE PAS. L'anneau court dans le
  // sens des `u` croissants sur le côté NORD (v = −1), c'est-à-dire vers l'EST.
  // Pour le premier triangle de mur, (T_k, T_{k+1}, B_k) :
  //   e1 = T_{k+1} − T_k ≈ +est · s,   e2 = B_k − T_k ≈ −haut · d
  //   e1 × e2 = −(est × haut) · s·d = −sud · s·d = **+nord**
  // c'est-à-dire vers le DEHORS sur le côté nord. Le volume signé qu'en tire
  // `auditerSolide` est donc positif, et le test l'exige explicitement — Ā seule
  // ne verrait pas un solide retourné (§1 d'`audit-solide.js`).
  const parois = 2 * n
  const fond = n
  const indices = new Uint32Array((parois + fond) * 3)
  let w = 0
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n
    indices[w++] = k; indices[w++] = j; indices[w++] = n + k
    indices[w++] = j; indices[w++] = n + j; indices[w++] = n + k
  }
  // le fond, vu de dessous : l'anneau tourne dans l'autre sens qu'au-dessus
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n
    indices[w++] = 2 * n; indices[w++] = n + k; indices[w++] = n + j
  }
  // LE COUVERCLE-TÉMOIN — NON LIVRÉ, voir le §6
  const indicesCouvercle = new Uint32Array(n * 3)
  let c = 0
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n
    indicesCouvercle[c++] = 2 * n + 1; indicesCouvercle[c++] = j; indicesCouvercle[c++] = k
  }

  return {
    refus: null,
    couverture,
    vus,
    manquants,
    positions,
    indices,
    indicesCouvercle,
    couleurs,
    anneau,
    origine: { x: O[0], y: O[1], z: O[2] },
    base: {
      est: { x: est[0], y: est[1], z: est[2] },
      haut: { x: haut[0], y: haut[1], z: haut[2] },
      sud: { x: sud[0], y: sud[1], z: sud[2] },
    },
    baseY,
    minY,
    hautMax,
    largeur,
    profondeur: prof,
    bande,
    compte: { anneau: n, parois, fond, couvercle: n, sommets: nbSommets },
  }
}
