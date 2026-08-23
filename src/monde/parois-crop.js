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
// **PERDUES — deux, et voici pourquoi :**
//   ⑧ `masqueArrondi` et ⑨ `bords` — **SANS OBJET ICI, structurellement.** Les
//      deux existent pour le DAMIER : « deux congés qui se font face à une
//      jointure creusent une rainure » (`damier-bords.js`). Le crop est **un
//      seul bloc, sans voisine** ; `facteursCoins(null)` rend déjà les quatre
//      coins arrondis, c'est-à-dire le cas isolé. Les porter aurait été porter
//      deux paramètres dont l'entrée n'existe pas. ⚠️ **Et ce n'est plus vrai le
//      jour où un damier de crops apparaît** — la Tâche H et les « crops
//      continentaux » du §8 le rouvriraient.
//
// ══════════ 5 bis. LE CHANFREIN ET LE CONGÉ — LA PERTE, REPRISE (Tâche P13) ══
//
// ⑩ `chanfrein` · ⑪ `arrondi` · ⑫ `arrondiSeg` **SONT PORTÉS DEPUIS LA TÂCHE
// P13.** La Tâche B les avait laissés de côté en écrivant trois raisons ; ce §
// dit, une par une, ce qu'elles sont devenues. **Aucune n'est effacée : deux
// sont périmées par des décisions postérieures, une est payée et chiffrée.**
//
//   ⚡ **LA TROISIÈME EST PÉRIMÉE, ET ELLE L'EST DEUX FOIS.** Elle disait : « leur
//      garde-fou `min(x, (topMax − baseY) × 0,25)` est calibré sur un socle à
//      exagération 2,8, **le globe est à 18**, donc tout rayon posé maintenant
//      serait à reposer ».
//        ① ⚠️ **L'exagération du globe est FIXE À 2 depuis la décision D10**
//           (`EXAGERATION_UNIQUE`, `zoom-continu.js` §1 ter, Adrien le
//           2026-08-22 : « une exagération d'altitude unique à ×2 sur toute la
//           map »). Il n'y a plus rien à reposer après coup.
//        ② ⚡ **ET SURTOUT : LES DEUX VALEURS SONT ANCRÉES À LA LARGEUR, QUE
//           L'EXAGÉRATION NE TOUCHE PAS.** Seul le garde-fou dépend de la
//           hauteur du mur — et il ne mord ni à 2 ni à 18. Relevé sur le banc
//           de `test/crop-parois.test.js` (relief d'essai, centre 45° N) :
//           mur **0,107 909** contre un garde-fou de **0,026 977**, pour un
//           congé de **2,618·10⁻³** et un chanfrein de **4,654·10⁻⁴**. Il
//           faudrait donc un mur **10,3 fois plus écrasé** pour que le congé
//           soit rogné, **58 fois** pour le chanfrein. Le test ⑬f mesure ces
//           deux marges au lieu de les supposer, et vérifie que le garde-fou
//           mord bel et bien quand on l'y force.
//
//   ⚡ **LA PREMIÈRE EST PAYÉE — la machinerie EST ici.** Bissectrice, onglet et
//      normales analytiques du congé sont portés plus bas, et l'appariement des
//      deux conventions de normale est tenu par un test qui confronte
//      `normalesParois` à `computeVertexNormals` de three (⑬d). ⚠️ **Sans les
//      normales analytiques, trois segments d'arc se liraient comme trois
//      facettes — « l'inverse exact de l'intention »** ; c'est pourquoi le
//      congé ne se contente PAS des normales de face que `globe.js` calculait.
//
//   ⚠️ **LA DEUXIÈME EST RÉELLE, ET ELLE EST CHIFFRÉE PLUTÔT QU'ARBITRÉE.** Le
//      chanfrein fait rentrer le mur sous son sommet. La Tâche B y voyait une
//      entame de la décision 2 (« LA BASE A LA MÊME TAILLE QUE LE DESSUS »).
//      **Ce que la décision 2 interdit, c'est la CONVERGENCE RADIALE**, et elle
//      reste interdite : le mur garde exactement la même empreinte sur toute sa
//      hauteur (test ⑬b, au bit près). Ce que le chanfrein retire, c'est un
//      retrait CONSTANT — **`2 × 0,16 / 56 = 0,571 % de la largeur** —, et le
//      congé un second de **`2 × 0,9 / 56 = 3,214 %`** sur la seule hauteur du
//      congé. ⚡ **Ce sont les proportions EXACTES du socle d'Adrien** : c'est
//      lui, l'objet de référence, et c'est lui qui porte le liseré que le noteur
//      réclame depuis la note 01. Faire l'inverse — garder l'arête vive pour
//      préserver une base au millimètre — préserverait une lettre contre
//      l'objet qu'elle décrit.
//
// ⚠️ **ET LA MONNAIE EST LE PIÈGE PRINCIPAL DE CE PORTAGE.** `SOCLE_CHANFREIN`
// vaut **0,16 unité de scène** sur un socle **large de 56**. Le crop, lui, fait
// **0,163 unité de large** : recopier 0,16 y aurait posé un chanfrein presque
// aussi large que le bloc entier. C'est la faute qui a été payée cinq fois sur
// ce chantier (`uMerHoule` ×121,6, `skirtDrop` ×10, l'ancre `uOceanDepth`…).
// ➡️ **Les deux valeurs sont donc des FRACTIONS DE LA LARGEUR**, exactement
// comme `FRACTION_PROFONDEUR = 7 / 56`, et exactement comme
// `RETRAIT_EAU_CROP = (0,16 + 0,06) / 28` de `mer-sphere.js` — qui est **déjà**
// dans cette monnaie-là.
//
// ⚡ **ET CE VOISIN-LÀ EST LA PREUVE QUE LE CHANFREIN MANQUAIT.**
// `RETRAIT_EAU_CROP` rentre l'eau du crop de **chanfrein + marge**, c'est-à-dire
// de la distance qui la met DANS le mur du socle. Tant que le mur du crop
// n'était pas rentré du chanfrein, cette eau était rentrée d'un chanfrein de
// trop : les deux pièces se lisaient dans deux géométries différentes. **Le
// portage les remet d'accord**, et le test ⑬e le vérifie contre le fichier de
// `mer-sphere.js` plutôt que contre un nombre recopié.
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

/**
 * Le liseré d'arête haute, en FRACTION DE LA LARGEUR du bloc — §5 bis.
 *
 * ⚠️ **0,16 / 56, ET LES DEUX CHIFFRES SONT AU DÉPÔT** : `SOCLE_CHANFREIN = 0.16`
 * et `TERRAIN_SIZE = 56`. Écrire `0.16` tel quel dans un crop large de
 * **0,163 unité** aurait posé un chanfrein aussi large que le bloc.
 * ⚡ **ET LA FRACTION EST LA BONNE MONNAIE POUR UNE RAISON D'ÉCRAN, PAS SEULEMENT
 * D'ALGÈBRE** : `plinth.js` calibre 0,16 pour que le liseré fasse « ~3 px au
 * cadrage large » sur un socle qui occupe ~1 000 px. Les deux blocs sont cadrés
 * pour remplir la même fraction d'image ; **à fraction de largeur égale, le
 * liseré fait le même nombre de pixels.** Une valeur en unités de scène, elle,
 * ne voudrait rien dire d'un bloc à l'autre.
 * ⚠️ Recopié, pas importé (`plinth.js` tire three.js) — `test/crop-parois.test.js`
 * ⑬a RELIT `src/plinth.js` sur le disque et refuse la divergence.
 */
export const FRACTION_CHANFREIN = 0.16 / 56

/** Le rayon du congé bas, même monnaie. `plinth.js` : `SOCLE_ARRONDI = 0.9`. */
export const FRACTION_ARRONDI = 0.9 / 56

/** Les segments de l'arc du congé. `plinth.js` : `SOCLE_ARRONDI_SEG = 3`. */
export const ARRONDI_SEG = 3

/**
 * Le garde-fou de `buildSlabWalls` : ni le chanfrein ni le congé ne mangent
 * plus du quart du mur. **Sur un bloc écrasé, un pli qui descend jusqu'au pied
 * n'est plus un pli, c'est un biseau qui remplace le mur.**
 */
export const PART_MUR_MAX = 0.25

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
 * Le rabattement d'une jupe de tuile, BORNÉ PAR LE PLANCHER DU BLOC — Tâche P7.
 *
 * ⛔ **LE DÉFAUT, MESURÉ AVANT D'ÊTRE RÉPARÉ.** `globe.js` rabat le contour de
 * chaque tuile vers le centre de la planète pour cacher les fentes entre niveaux
 * de détail (`skirtDrop`, borné entre **0,1 et 0,9 unité de scène**). Ce
 * rabattement est dans la monnaie du GLOBE ; le bloc du crop, lui, ne fait que
 * **0,0507 à 0,0955 unité d'épaisseur** au relevé de La Réunion. **La jupe
 * traverse donc le fond du bloc et pend dessous** — c'est le manque n° 5 du
 * noteur, et c'est la même faute que la tavelure de P4, que le budget de fond de
 * P5 et que la houle de P6 : *une valeur juste dans la mauvaise monnaie.*
 *
 * ⚡ **A/B à témoin nul dans la page vivante** (La Réunion z12, cadrage intérieur
 * de la notation-01, boucle gelée) : en remontant les sommets de jupe au
 * plancher DANS LE TAMPON DE POSITIONS, les pixels de tuile qui pendent sous
 * l'arête basse de la paroi tombent de **2 186 px en 12 langues à 1 px en
 * 1 langue** — le socle en rend **0**. Retour : **2 186 px et 12 langues,
 * colonne pour colonne.** (`.banc/P7/S7-ab-jupes--21.115-P7.json`.)
 * ⚠️ **Et les 2 186 px / 12 langues sont EXACTEMENT le relevé du noteur**
 * (`F-jupes-N02.json`), aux douze colonnes près : la convention de mesure de ce
 * banc et la sienne sont donc la même.
 *
 * ⚠️ **ON BORNE, ON NE SUPPRIME PAS.** Les deux sorties que le noteur nommait
 * étaient « couper la jupe par sa hauteur » et « ne pas bâtir de jupe sur une
 * tuile de frontière ». La seconde ne peut pas marcher : **les douze langues ne
 * viennent PAS des tuiles de frontière** — mesuré, **168 tuiles sur 168** ont
 * des sommets de jupe sous le plancher, y compris en plein milieu du bloc ; ce
 * qu'on voit est ce qui dépasse de la SILHOUETTE. La première est celle-ci, et
 * elle garde à la jupe toute la longueur que le bloc lui laisse — donc son
 * service anti-fente à l'intérieur.
 *
 * ⚠️ **LE PLANCHER EST UN PLAN, ON LE BORNE PAR UNE SPHÈRE, ET L'ÉCART EST
 * CHIFFRÉ.** Le fond du bloc est le plan `y = baseY` du repère local ; ce qu'on
 * compare ici est un RAYON. Les deux se touchent au centre du crop et divergent
 * de la flèche du crop — **3,68 m à La Réunion, soit 5,8·10⁻⁵ unité de scène,
 * 0,06 % de l'épaisseur du bloc**, c'est-à-dire **six centièmes de pixel** au
 * cadrage de ce banc. Dit plutôt que caché.
 *
 * @param {number} rabattement le `skirtDrop` du globe, en unités de scène
 * @param {number} rayonSommet le rayon du sommet de BORD, depuis le centre
 * @param {number} rayonPlancher le rayon du fond du bloc — `0` (ou non fini)
 *   quand aucun bloc n'est posé : le rabattement est alors rendu TEL QUEL
 * @returns {number} le rabattement à appliquer
 */
export function rabattementBorne(rabattement, rayonSommet, rayonPlancher) {
  if (!(rayonPlancher > 0) || !(rayonSommet > 0)) return rabattement
  return Math.min(rabattement, Math.max(0, rayonSommet - rayonPlancher))
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
 * @param {number} [arg.fractionChanfrein] - le liseré d'arête haute, EN FRACTION
 *   DE LA LARGEUR (§5 bis). `0` rend l'arête vive d'avant la Tâche P13.
 * @param {number} [arg.fractionArrondi] - le rayon du congé bas, même monnaie.
 *   `0` rend l'arête basse vive.
 * @param {number} [arg.arrondiSeg] - les segments de l'arc du congé.
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
  fractionChanfrein = FRACTION_CHANFREIN,
  fractionArrondi = FRACTION_ARRONDI,
  arrondiSeg = ARRONDI_SEG,
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

  // ─── ③ LE PROFIL DU MUR — CHANFREIN, MUR, BANDE, CONGÉ (§5 bis) ──────────
  //
  // ⚠️ **LES DEUX RENTRÉES SONT BORNÉES PAR LE MÊME GARDE-FOU QUE `plinth.js`** :
  // ni l'une ni l'autre ne mange plus du quart du mur. Il ne mord plus au réglage
  // livré — l'exagération est fixe à 2 — mais il reste la seule chose qui protège
  // un bloc écrasé, et le test ⑬f mesure de combien il est loin de mordre plutôt
  // que de l'affirmer.
  const mur = Math.max(0, hautMax - baseY)
  const frCh = Number.isFinite(fractionChanfrein) ? Math.max(0, fractionChanfrein) : FRACTION_CHANFREIN
  const frRd = Number.isFinite(fractionArrondi) ? Math.max(0, fractionArrondi) : FRACTION_ARRONDI
  const ch = Math.min(frCh * largeur, mur * PART_MUR_MAX)
  const rd = Math.min(frRd * largeur, mur * PART_MUR_MAX)
  const segArc = rd > 0 ? Math.max(1, Math.round(Number.isFinite(arrondiSeg) ? arrondiSeg : ARRONDI_SEG)) : 0

  // ══════ LA BISSECTRICE ET L'ONGLET — PORTÉS DE `buildSlabWalls` ═══════════
  //
  // On prend la BISSECTRICE des deux arêtes voisines, allongée de `1/cos(θ/2)` :
  // le retrait perpendiculaire vaut alors exactement la distance voulue sur les
  // DEUX faces, y compris dans un angle droit. Une simple direction « vers le
  // centre » y creuserait un cran de `d·(1 − 1/√2)`.
  //
  // ⚠️ **LE SIGNE SE DÉMONTRE, IL NE SE RECOPIE PAS.** `contourCrop` court dans
  // le sens des `u` croissants sur le côté NORD (`v = −1`), c'est-à-dire vers
  // l'EST ; dans le repère local (`x = est`, `z = sud`) la direction du segment
  // y vaut `(+1, 0)` et `[−dz/L, +dx/L]` rend `(0, +1)` — vers le SUD, donc vers
  // le DEDANS. C'est la même démonstration que celle du §④ pour l'orientation
  // des faces, et le test ⑬b la refait en mesurant l'empreinte.
  const bissX = new Float64Array(n)
  const bissZ = new Float64Array(n)
  const onglet = new Float64Array(n)
  const normSeg = (ax, az, bx, bz) => {
    const dx = bx - ax
    const dz = bz - az
    const L = Math.hypot(dx, dz)
    return L > 1e-15 ? [-dz / L, dx / L] : null
  }
  for (let k = 0; k < n; k++) {
    const p = (k - 1 + n) % n
    const s = (k + 1) % n
    const a = normSeg(hautX[p], hautZ[p], hautX[k], hautZ[k])
    const b = normSeg(hautX[k], hautZ[k], hautX[s], hautZ[s])
    const na = a || b
    const nb = b || a
    if (!na || !nb) { bissX[k] = 0; bissZ[k] = 0; onglet[k] = 1; continue }
    const mx = na[0] + nb[0]
    const mz = na[1] + nb[1]
    const L = Math.hypot(mx, mz)
    if (L < 1e-12) { bissX[k] = 0; bissZ[k] = 0; onglet[k] = 1; continue }
    bissX[k] = mx / L
    bissZ[k] = mz / L
    // onglet borné, comme `plinth.js` : un repli très aigu ferait diverger 1/cos
    const cos = Math.max(0.35, bissX[k] * na[0] + bissZ[k] * na[1])
    onglet[k] = 1 / cos
  }

  // ══════ LES RANGS DU PROFIL ═══════════════════════════════════════════════
  //
  // ⓪ la surface           · `d = 0`  — ⚠️ **LE SOMMET DU MUR NE BOUGE PAS.** Il
  //    doit rester exactement sur le bord du relief, sinon on voit le jour sous
  //    la carte. C'est le pied du chanfrein qui rentre, jamais sa tête.
  // ① le pied du chanfrein · `d = ch`
  // ② le haut de la bande d'occlusion · `d = ch`
  //    ⚠️ **CE RANG N'EXISTAIT PAS, ET SON ABSENCE ÉTAIT UN DÉFAUT.** L'occlusion
  //    de contact voyage en couleur de sommet : avec deux rangs seulement, elle
  //    s'interpolait LINÉAIREMENT sur toute la hauteur du mur, et la « bande » de
  //    12 % ne contenait aucun sommet — elle n'existait pas. `plinth.js` écrit le
  //    même constat sur le socle (« sur un mur de 33 unités l'assombrissement
  //    s'étalait sur 33 »). Le rang ② la fixe à une hauteur MONDE.
  // ③ … ③+segArc  le congé, de θ = 0 (le pied du mur) à θ = 90° (le fond)
  //
  // Les altitudes sont forcées DÉCROISSANTES : sur un bord très bas, le pied du
  // chanfrein peut passer sous le départ du congé.
  const yFil = baseY + rd
  const yChanfrein = (k) => Math.max(ch > 0 ? hautY[k] - ch : hautY[k], yFil)
  const rangs = []
  const pousseRang = (fy, fd) => {
    const y = new Float64Array(n)
    const d = new Float64Array(n)
    for (let k = 0; k < n; k++) { y[k] = fy(k); d[k] = fd(k) }
    rangs.push({ y, d })
  }
  pousseRang((k) => hautY[k], () => 0)
  if (ch > 0) pousseRang(yChanfrein, () => ch)
  pousseRang((k) => Math.min(Math.max(baseY + bande, yFil), yChanfrein(k)), () => ch)
  const rangArc0 = rangs.length
  for (let m = 0; m <= segArc; m++) {
    const th = segArc > 0 ? (Math.PI / 2) * (m / segArc) : 0
    const yArc = baseY + rd - rd * Math.sin(th)
    const dArc = ch + rd - rd * Math.cos(th)
    pousseRang(() => yArc, () => dArc)
  }
  const R = rangs.length

  // ─── ③ bis LES SOMMETS ───────────────────────────────────────────────────
  //
  // rang r, point k → `r·n + k` · R·n = le centre du fond · R·n+1 = le sommet du
  // couvercle-témoin. **Le rang 0 reste les indices 0 … n−1** : le couvercle et
  // le premier bandeau de mur gardent donc exactement les entiers d'avant.
  const nbSommets = R * n + 2
  const positions = new Float32Array(nbSommets * 3)
  const couleurs = new Uint8Array(nbSommets * 3)
  // les normales ANALYTIQUES du congé — voir `normalesParois`. Elles ne sont
  // lues que sur les rangs d'arc ; ailleurs le tableau porte la normale de
  // bissectrice, qui n'est jamais consommée.
  const normales = new Float32Array(nbSommets * 3)
  const teinte = (i, y) => {
    const ao = Math.round(255 * occlusionContact(y, baseY, bande, aoForce))
    couleurs[i * 3] = ao; couleurs[i * 3 + 1] = ao; couleurs[i * 3 + 2] = ao
  }
  for (let r = 0; r < R; r++) {
    const rang = rangs[r]
    // ══════ LA NORMALE DU CONGÉ, ET LE SIGNE QUI LA SOUDE ══════════════════
    //
    // ⚠️ **LES NORMALES DE CE SOLIDE POINTENT VERS LE DEHORS** — c'est ce que
    // le §④ démontre sur le sens de parcours, et ce que le volume signé positif
    // exigé par `test/crop-parois.test.js` confirme. La normale d'arc est donc
    // **`(−bissectrice · cos θ, −sin θ, −bissectrice · cos θ)`** : horizontale
    // SORTANTE à θ = 0, VERS LE BAS à θ = 90°.
    //
    // ⚡ **C'EST CETTE DOUBLE COÏNCIDENCE QUI SOUDE LE CONGÉ** : à θ = 0 elle
    // vaut la normale du mur (raccord invisible), à θ = 90° celle du fond
    // (`(0, −1, 0)`, le fond étant plan). Le test ⑬d les apparie toutes les deux
    // contre `computeVertexNormals` de three plutôt que contre un nombre écrit.
    //
    // ⚠️ **ET LE SIGNE DE LA VERTICALE EST LE PIÈGE HISTORIQUE.** `plinth.js`
    // raconte la version où seule la moitié de la normale était retournée : « la
    // bande du congé recevait la lumière comme si elle était tournée vers le
    // ciel », et Adrien a lu « la base du socle est traitée comme un objet
    // séparé ». Ce n'en était pas un : c'était un signe.
    const th = r >= rangArc0 && segArc > 0 ? (Math.PI / 2) * ((r - rangArc0) / segArc) : 0
    const cth = Math.cos(th)
    const sth = Math.sin(th)
    for (let k = 0; k < n; k++) {
      const i = r * n + k
      const d = rang.d[k] * onglet[k]
      positions[i * 3] = hautX[k] + bissX[k] * d
      positions[i * 3 + 1] = rang.y[k]
      positions[i * 3 + 2] = hautZ[k] + bissZ[k] * d
      teinte(i, rang.y[k])
      const nx = -bissX[k] * cth
      const ny = -sth
      const nz = -bissZ[k] * cth
      const L = Math.hypot(nx, ny, nz) || 1
      normales[i * 3] = nx / L
      normales[i * 3 + 1] = ny / L
      normales[i * 3 + 2] = nz / L
    }
  }
  positions[R * n * 3] = 0; positions[R * n * 3 + 1] = baseY; positions[R * n * 3 + 2] = 0
  teinte(R * n, baseY)
  normales[R * n * 3 + 1] = -1
  const sommet = surface(0, 0)
  positions[(R * n + 1) * 3] = sommet[0]
  positions[(R * n + 1) * 3 + 1] = sommet[1]
  positions[(R * n + 1) * 3 + 2] = sommet[2]
  teinte(R * n + 1, sommet[1])
  normales[(R * n + 1) * 3 + 1] = 1

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
  //
  // ⚠️ **LES BANDEAUX SORTENT DANS L'ORDRE DES RANGS, ET `k` TOURNE À
  // L'INTÉRIEUR.** Le premier bandeau garde donc exactement les entiers d'avant
  // la Tâche P13 — c'est ce que `test/ecume-mer.test.js` ⑤bis-a compare au
  // rideau d'eau pour prouver que les deux pièces tournent dans le même sens.
  //
  // ⚠️ **UN TRIANGLE DONT DEUX SOMMETS SE CONFONDENT N'EST PAS ÉMIS.** Deux
  // rangs peuvent coïncider en un point — un bord très bas dont le chanfrein
  // tombe déjà sous la bande d'occlusion, un bloc plat dont le congé est plus
  // haut qu'elle. `plinth.js` laisse `pousse` jeter ces triangles ; ici ils
  // seraient COMPTÉS, et `auditerSolide` exige `degeneres === 0`. La comparaison
  // se fait sur les coordonnées **telles qu'elles sont rangées** (`Float32`) :
  // deux `Float64` distincts qui tombent sur le même `Float32` feraient un
  // dégénéré que le tampon porterait et qu'une comparaison en double raterait.
  const memePoint = (a, b) => (
    positions[a * 3] === positions[b * 3] &&
    positions[a * 3 + 1] === positions[b * 3 + 1] &&
    positions[a * 3 + 2] === positions[b * 3 + 2]
  )
  const listeIndices = []
  let triArc0 = -1
  for (let r = 0; r < R - 1; r++) {
    if (r === rangArc0) triArc0 = listeIndices.length / 3
    const hautRang = r * n
    const basRang = (r + 1) * n
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n
      const p0 = hautRang + k
      const q0 = hautRang + j
      const p1 = basRang + k
      const q1 = basRang + j
      if (!memePoint(p0, p1)) listeIndices.push(p0, q0, p1)
      if (!memePoint(q0, q1)) listeIndices.push(q0, q1, p1)
    }
  }
  if (triArc0 < 0) triArc0 = listeIndices.length / 3
  const parois = listeIndices.length / 3
  // le fond, vu de dessous : l'anneau tourne dans l'autre sens qu'au-dessus
  const dernier = (R - 1) * n
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n
    listeIndices.push(R * n, dernier + k, dernier + j)
  }
  const fond = listeIndices.length / 3 - parois
  const indices = Uint32Array.from(listeIndices)
  // LE COUVERCLE-TÉMOIN — NON LIVRÉ, voir le §6
  const indicesCouvercle = new Uint32Array(n * 3)
  let c = 0
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n
    indicesCouvercle[c++] = R * n + 1; indicesCouvercle[c++] = j; indicesCouvercle[c++] = k
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
    normales,
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
    chanfrein: ch,
    arrondi: rd,
    rangs: R,
    rangArc: rangArc0,
    triArc: triArc0,
    compte: { anneau: n, parois, fond, couvercle: n, sommets: nbSommets, rangs: R },
  }
}

/**
 * LES NORMALES DE LA GÉOMÉTRIE DÉ-INDEXÉE — **normales de FACE partout, sauf
 * sur le congé, qui prend les siennes, ANALYTIQUES.**
 *
 * ⛔ **POURQUOI CETTE FONCTION EXISTE PLUTÔT QU'UN `computeVertexNormals`.**
 * `globe.js` dé-indexait puis appelait `computeVertexNormals`, qui rend la
 * normale de FACE de chaque triangle. C'est exactement ce qu'il faut pour le
 * mur et pour le liseré d'arête — « c'est elle qui donne au liseré sa cassure
 * nette » (`plinth.js`) — et exactement ce qu'il ne faut PAS pour le congé :
 * **trois segments à normales de face se lisent comme trois facettes, l'inverse
 * exact de l'intention.** Le congé n'est pas une silhouette, c'est une normale.
 *
 * ⚠️ **ET ELLE EST ICI, DANS LE MODULE PUR, POUR UNE RAISON DE PREUVE.** Écrite
 * dans `globe.js` elle n'aurait été gardée que par une assertion sur le TEXTE
 * SOURCE — le trou que le tour de correction P8-P12 a démasqué (une mutation qui
 * échangeait deux valeurs dans l'objet retourné a survécu à 4 082 tests parce
 * que le garde était un `assert.match`). Ici, elle s'exécute sous node.
 *
 * ⚠️ **L'ORDRE DES SOMMETS EST CELUI DE `BufferGeometry.toNonIndexed()`** : le
 * sommet non indexé `t` est le sommet indexé `indices[t]`, dans l'ordre. C'est
 * la seule chose que cette fonction suppose de three, et le test ⑬d la confronte
 * à three pour de bon.
 *
 * @param {object} solide - ce que rend `construireSolideCrop`
 * @returns {Float32Array} 3 réels par sommet DÉ-INDEXÉ, dans l'ordre de `indices`
 */
export function normalesParois(solide) {
  if (!solide || !solide.positions || !solide.indices) {
    throw new TypeError('normalesParois : il faut le solide de `construireSolideCrop`')
  }
  const { positions, indices, normales, triArc, compte } = solide
  const sortie = new Float32Array(indices.length * 3)
  const finArc = compte.parois
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t]
    const ib = indices[t + 1]
    const ic = indices[t + 2]
    const tri = t / 3
    if (normales && tri >= triArc && tri < finArc) {
      for (let c = 0; c < 3; c++) {
        const src = indices[t + c] * 3
        sortie[(t + c) * 3] = normales[src]
        sortie[(t + c) * 3 + 1] = normales[src + 1]
        sortie[(t + c) * 3 + 2] = normales[src + 2]
      }
      continue
    }
    // la normale de FACE, au produit vectoriel — la formule de three, à la
    // lettre : (b − a) × (c − a), normalisée.
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2]
    const bx = positions[ib * 3] - ax, by = positions[ib * 3 + 1] - ay, bz = positions[ib * 3 + 2] - az
    const cx = positions[ic * 3] - ax, cy = positions[ic * 3 + 1] - ay, cz = positions[ic * 3 + 2] - az
    let nx = by * cz - bz * cy
    let ny = bz * cx - bx * cz
    let nz = bx * cy - by * cx
    const L = Math.hypot(nx, ny, nz)
    if (L > 0) { nx /= L; ny /= L; nz /= L }
    for (let c = 0; c < 3; c++) {
      sortie[(t + c) * 3] = nx
      sortie[(t + c) * 3 + 1] = ny
      sortie[(t + c) * 3 + 2] = nz
    }
  }
  return sortie
}
