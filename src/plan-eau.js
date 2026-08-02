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
// Le seuil a longtemps été posé à **150 m**, à peu près la moyenne géométrique
// des deux camps d'alors (√(87 × 284) = 157) : un facteur ~2 de marge de chaque
// côté. C'est un PLANCHER largement sous le premier vrai plan d'eau, pas une
// égalité — même règle que scripts/verifie-dist.mjs, on attrape l'effondrement,
// pas le frémissement.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LE 2026-08-02, ADRIEN A CHANGÉ LA QUESTION : « L'EFFET SUR LES LACS SEULEMENT »
// ═══════════════════════════════════════════════════════════════════════════
//
// « La nappe d'eau animée ne doit plus jamais se poser sur un COURS D'EAU. Les
// fleuves et rivières gardent leur trait bleu vectoriel. »
//
// ⚠️ CE N'EST PAS UN RÉGLAGE DE SEUIL, C'EST LA LEVÉE DU MUR. Trois tentatives
// avaient échoué sur une seule contrainte, écrite juste au-dessus : « il faut
// 215 m de largeur pour vider Dijon, et le fleuve en fait 170 ». Les deux camps
// se chevauchaient — MAIS SEULEMENT PARCE QU'IL FALLAIT GARDER LE FLEUVE. Du
// jour où le Rhône doit lui aussi perdre sa nappe, le chevauchement disparaît :
// il ne reste plus qu'un camp à refuser (dentelles ET cours d'eau) et un camp à
// garder (les lacs). Aucun critère nouveau n'était nécessaire ; c'est la
// CONSIGNE qui bloquait, pas la géométrie.
//
// BALAYAGE REFAIT SUR LES ONZE FIXTURES (2026-08-02, nombre d'étendues
// retenues ; « ! » = un vrai lac a disparu) :
//
//   seuil  | dijon z11 | dijon z12 | annecy | serre-ponçon | sognefjord | Rhône
//   -------|-----------|-----------|--------|--------------|------------|-------
//   150 m  |    14     |     3     |   1    |      1       |     1      | gardé
//   171 m  |     7     |     1     |   1    |      1       |     1      | refusé
//   200 m  |     3     |     0     |   1    |      1       |     1      | refusé
//   215 m  |     0     |     0     |   1    |      1       |     1      | refusé
//   250 m  |     0     |     0     |   1    |      1       |     1      | refusé
//   280 m  |     0     |     0     |   1    |      1       |     1      | refusé
//
// LES DEUX CAMPS, MESURÉS :
//
//   à REFUSER — la dentelle la plus large de chaque plaine
//     Dijon z11 (la vue d'Adrien)  215 m   ← le plus large de tout le camp
//     Dijon z12                    182 m
//     Rhône fin (13,5 m/cellule)   108 m
//     Rhône Valence                 81 m
//     Paris-IdF                     87 m
//     Camargue                      70 m
//     Brest                         50 m
//     et LE FLEUVE lui-même        170 m   (relevé à z12 comme à z14)
//   ————————————————— la frontière —————————————————
//   à GARDER — les vrais plans d'eau
//     Sognefjord, lac à 1 060 m    284 m   ← le plus étroit du camp
//     Serre-Ponçon                 369 m
//     Annecy z12                   820 m
//     Annecy z15                 1 032 m
//
// ⚠️ ET LES FIXTURES NE DONNENT PAS LE PIRE CAS. Vérifié à l'écran le
// 2026-08-02, sur l'instance vivante (blocs 1 536² de production, mapterhorn),
// en mesurant les DEUX seuils sur le même relief chargé :
//
//   lieu             |zoom| avant (150 m)      | après | largeurs des dentelles
//   -----------------|----|--------------------|-------|-----------------------
//   Dijon (la vue)   |z11 | 17 étendues 4,30 % |   0   | 154 … 201, **236**
//   Dijon            |z12 |  6 étendues 2,64 % |   0   | 150 … 189
//   Dijon nord       |z11 |  3 étendues        |   0   | … 168
//
// La dentelle la plus large de l'écran fait **236 m**, pas 215 : la fixture de
// Dijon, cadrée autrement, ne portait pas le pire cas. Un seuil à 240 m
// n'aurait laissé que 4 m de marge — un cadrage de plus et la dentelle
// revenait. Les deux camps RÉELS sont donc 236 m et 284 m.
//
// Le seuil est posé à **250 m**. Même méthode qu'en v1, la moyenne géométrique
// des deux camps (√(236 × 284) = 259), arrondie vers le bas comme 157 l'avait
// été vers 150 — en cas de doute on préfère garder un plan d'eau de trop que
// d'en assécher un. Il reste 6 % de marge au-dessus de la pire dentelle et
// 14 % sous le plus étroit des vrais lacs.
//
// AVANT/APRÈS COMPLET, MESURÉ À L'ÉCRAN (part du bloc peinte en eau animée) :
//
//   lieu             |zoom| avant   | après   | verdict
//   -----------------|----|---------|---------|---------------------------
//   Dijon            |z11 |  4,30 % |  0,00 % | ✅ la plaine est vidée
//   Dijon            |z12 |  2,64 % |  0,00 % | ✅
//   Rhône (Valence)  |z12 |  1,12 % |  0,00 % | ✅ le fleuve perd sa nappe
//   Rhône (Valence)  |z14 |  6,04 % |  0,00 % | ✅ idem, VOULU
//   Annecy           |z12 |  6,47 % |  6,47 % | ✅ intact (1 037 m de large)
//   Annecy           |z15 | 72,36 % | 72,36 % | ✅ intact (1 090 m)
//   Léman            |z12 | 54,72 % | 54,72 % | ✅ intact (8 167 m)
//   Léman            |z15 |100,00 % |100,00 % | ✅ intact
//   Serre-Ponçon     |z12 |  6,07 % |  6,07 % | ✅ intact (284 et 516 m)
//   Serre-Ponçon     |z15 | 37,32 % | 37,32 % | ✅ intact (763 m)
//   Brest            |z12 |  0,00 % |  0,00 % | ✅ déjà propre, pas de recul
//   Flevoland        |z12 |  0,00 % |  0,00 % | ✅ le polder reste sec
//
// AUCUN lac ne bouge. Les seules lignes qui changent sont les plaines et le
// fleuve — c'est exactement, et seulement, la demande.
//
// ⚠️ LA LIGNE LA PLUS SERRÉE DE CE TABLEAU EST SERRE-PONÇON À z12 : son bras
// étroit mesure 284 m contre un seuil de 250. C'est le vrai plan d'eau le plus
// menacé du monde connu, et c'est lui qu'il faut rouvrir en premier si
// quelqu'un veut remonter le seuil.
//
// ⚠️ ET LA MARGE EST MINCE, IL FAUT LE DIRE : 1,20× entre les deux camps réels
// (236 et 284), là où la v1 en avait 3,3×. Ce n'est pas un plancher
// confortable, c'est un couloir. Concrètement : si quelqu'un recuit les
// fixtures à un pas au sol plus fin, les dentelles ne s'élargiront PAS (une
// bande vaut 1 m ÷ pente, en mètres, cf. plus haut) — mais un lac de montagne
// étroit, lui, passe sous le seuil. C'est le coût assumé, et
// test/garde-plans-eau.test.js le surveille aux DEUX bornes, jamais à une seule.
//
// CE QUE ÇA COÛTE, honnêtement : tout plan d'eau plus étroit que 250 m perd sa
// surface ANIMÉE (vagues, reflet, écume) — les fleuves et rivières de France
// sans exception, et les petits lacs de montagne avec eux. Rien ne disparaît de
// la carte pour autant : le calque vectoriel (src/map/water-layer.js, données
// OSM) continue de les peindre, et c'est d'ailleurs la source JUSTE pour un
// cours d'eau, celle qu'Adrien a désignée.
//
// ⚠️ CE QUE ÇA NE FAIT PAS, et personne ne doit le découvrir à l'écran : un
// fleuve de PLUS de 250 m de large garde sa nappe. La Loire à son estuaire,
// l'Amazone, le Danube. Aucun critère de forme ne les sépare d'un lac de
// barrage — c'est mesuré, pas supposé, voir `remplissageEnveloppe` juste en
// dessous : Serre-Ponçon EST un fleuve barré, il en a exactement la géométrie.
// Sur la France, où la consigne a été donnée, le compte est bon.
export const LARGEUR_MIN_M = 250

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

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LE REMPLISSAGE D'ENVELOPPE — MESURÉ, ET REFUSÉ. NE LE RÉESSAIE PAS.
// ═══════════════════════════════════════════════════════════════════════════
//
// L'idée est séduisante et elle revient à chaque tentative : « un lac est
// COMPACT, un cours d'eau ne l'est pas ; écartons les composantes allongées ».
// Un rapport antérieur (branche `tour-2km`) annonçait même la séparation :
// vrais lacs 0,65-0,91, dentelles 0,27-0,64, Rhône 0,11.
//
// ⚠️ CE RAPPORT EST FAUX PARCE QU'IL EST INCOMPLET : il n'avait mesuré que le
// lac d'Annecy. Refait ici sur les ONZE fixtures (scripts/mesure-enveloppe.mjs,
// 2026-08-02), le classement s'effondre :
//
//   objet                              | enveloppe | verdict attendu
//   -----------------------------------|-----------|----------------
//   Annecy z15                         |   0,897   | À GARDER
//   Annecy z12                         |   0,644   | À GARDER
//   dentelles de Dijon (14, z11)       | 0,271-0,644 | à refuser
//   dentelles de Dijon (3, z12)        | 0,283-0,704 | à refuser
//   Sognefjord, lac à 1 060 m          |   0,529   | À GARDER
//   🔴 Serre-Ponçon, lac de barrage    |   0,260   | À GARDER
//
// TROIS RECOUVREMENTS, chacun fatal à lui seul :
//   · Annecy z12 (0,644) est À ÉGALITÉ avec la pire dentelle de Dijon (0,644) ;
//   · une dentelle de Dijon z12 monte à 0,704, AU-DESSUS d'Annecy z12 ;
//   · et Serre-Ponçon, à 0,260, est MOINS compact que 13 des 14 dentelles.
//
// Ce dernier point n'est pas un accident de mesure, c'est la nature de l'objet :
// **un lac de barrage EST un fleuve barré**. Il a la forme d'un fleuve, il
// serpente dans une vallée, il est long et fin. Aucune mesure de compacité ne
// peut le distinguer d'un cours d'eau, parce qu'il n'en est pas distinct.
// L'élongation (longueur/largeur) échoue pour la même raison : Serre-Ponçon
// vaut 45, la plus allongée des dentelles de Dijon 45 aussi.
//
// CETTE FONCTION EST DONC GARDÉE POUR UNE SEULE RAISON : le test
// « le remplissage d'enveloppe ne sépare pas Serre-Ponçon des dentelles »
// de test/garde-plans-eau.test.js s'en sert pour VERROUILLER ce résultat
// négatif. Sans lui, la quatrième tentative recommencerait le même calcul.
// Elle n'est appelée par aucun chemin de rendu.
//
// ⚠️ ENVELOPPE CONVEXE, PAS BOÎTE ENGLOBANTE. Le remplissage de BOÎTE a déjà
// été mesuré et il échoue (cf. le garde-fou en tête de lake.js) : une dentelle
// qui serpente en diagonale remplit très bien la boîte qui la contient, parce
// que la boîte, elle, ne serpente pas. L'enveloppe convexe épouse la forme :
// c'est la plus petite région convexe qui contient l'étendue, et le rapport
// aire/enveloppe dit exactement « à quel point cette tache est-elle pleine ».
//
// L'ENVELOPPE EST CALCULÉE SUR LES COINS DES CELLULES, pas sur leurs centres.
// Sur les centres, une composante d'une cellule de large donne une enveloppe
// d'aire NULLE — donc un remplissage infini, donc une dentelle acceptée. Sur
// les coins, chaque cellule est un carré unité, l'enveloppe contient toujours
// toutes les cellules, et le rapport reste borné par 1 par construction.
//
// ⚠️ SEULS LES EXTRÊMES DE CHAQUE LIGNE SONT CANDIDATS. Un sommet d'enveloppe
// convexe est nécessairement le plus à gauche ou le plus à droite de sa ligne :
// un point qui a des cellules des deux côtés est déjà dans le segment qui les
// joint. On passe donc de 36 000 points (le lac d'Annecy) à deux par ligne,
// sans changer d'un iota le résultat.
export function remplissageEnveloppe(lac) {
  const { cells, size } = lac
  const n = cells.length
  if (!n) return 0
  let minY = size, maxY = -1
  for (const c of cells) {
    const y = (c / size) | 0
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const hauteur = maxY - minY + 1
  const gauche = new Int32Array(hauteur).fill(size)
  const droite = new Int32Array(hauteur).fill(-1)
  for (const c of cells) {
    const y = ((c / size) | 0) - minY
    const x = c % size
    if (x < gauche[y]) gauche[y] = x
    if (x > droite[y]) droite[y] = x
  }
  const pts = []
  for (let y = 0; y < hauteur; y++) {
    if (droite[y] < 0) continue // ligne vide : une composante peut être en U
    const yy = y + minY
    pts.push([gauche[y], yy], [gauche[y], yy + 1], [droite[y] + 1, yy], [droite[y] + 1, yy + 1])
  }
  const aireEnv = aireEnveloppeConvexe(pts)
  return aireEnv > 0 ? Math.min(1, n / aireEnv) : 1
}

/** Chaîne monotone d'Andrew, puis lacet de Gauss. Rien d'exotique, mais écrit
 *  ici plutôt qu'importé : le module doit rester PUR et sans dépendance, c'est
 *  ce qui permet au garde-fou de l'interroger hors ligne. */
function aireEnveloppeConvexe(pts) {
  if (pts.length < 3) return 0
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const croix = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const bas = []
  for (const p of pts) {
    while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop()
    bas.push(p)
  }
  const haut = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop()
    haut.push(p)
  }
  bas.pop()
  haut.pop()
  const hull = bas.concat(haut)
  if (hull.length < 3) return 0
  let deux = 0
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) deux += hull[j][0] * hull[i][1] - hull[i][0] * hull[j][1]
  return Math.abs(deux) / 2
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
