// QUI A LE DROIT DE DEVENIR UNE SURFACE D'EAU ANIMÉE — et pourquoi la platitude
// ne suffit plus à le décider.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node, et c'est la
// condition pour que le garde-fou (test/garde-plans-eau.test.js) puisse
// l'interroger sur du VRAI relief, hors ligne.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT : « les mers qui rentrent dans les terres » (Adrien, 2026-08-02)
// ═══════════════════════════════════════════════════════════════════════════
//
// Vallée du Rhône vers Valence, photo aérienne allumée : le fleuve peint trois
// fois trop large, et des NAPPES d'eau étalées sur les terres agricoles plates
// de la rive gauche. Ni fleuve, ni lac, ni mer. Le Vercors, en face, est juste.
// Le défaut frappe LE PLAT, pas la pente.
//
// ⚠️ CE N'EST PAS LE MASQUE DE MER. Mesuré sur place : `uSeaY` vaut −1,75 et le
// point le plus bas du bloc +91 m — AUCUN pixel n'est sous le niveau de la mer,
// `underwater` est faux partout, et `uCoastMask` déclare tout le bloc TERRE.
// Les trois correctifs précédents (sea-mask.js, bathy.js, mer-emprise.js)
// portent tous sur la mer : ils ne pouvaient pas attraper ce cas-ci, ils ne
// regardaient pas le bon calque. L'eau fautive vient de `real-water-lacs`,
// la couche des PLANS D'EAU D'ALTITUDE d'ocean.js, qui a son propre détecteur.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA CAUSE : dem-quant.js a retiré au détecteur son seul signal
// ═══════════════════════════════════════════════════════════════════════════
//
// `detectLakes` (src/lake.js) repose sur une prémisse écrite noir sur blanc en
// tête de ce fichier : « une surface d'eau est EXACTEMENT plate dans la donnée
// source (sub-métrique après rééchantillonnage), là où une tolérance lâche sur
// une pente douce fabrique des bandes de contour ». La tolérance vaut 0,35 m,
// et c'est ce sub-métrique qui séparait l'eau du sol.
//
// 🔴 `dem.data` est un **Int16Array en mètres ENTIERS** depuis dem-quant.js.
// Deux voisins ne se rejoignent donc que s'ils portent le même entier : la
// tolérance RÉELLE n'est plus 0,35 m mais **1 m**, et toute composante est
// plate à zéro près. lake.js le SAIT et le dit (« 0 composante sur 12,9
// millions a un écart interne non nul ») — la session qui l'a découvert l'a
// consigné comme une optimisation à résultat identique, ce qu'elle était. Mais
// le fait qu'elle a relevé est plus grave que l'optimisation : le test de
// platitude ne décide plus rien, il dit OUI à tout. Et comme il court-circuite
// les tests de forme (`watery || (fill && !thin)`), ceux-là ne servent plus non
// plus. Le détecteur n'a plus AUCUN filtre actif au-delà du plancher d'aire.
//
// Sur une plaine alluviale, dont la pente est de quelques mètres au kilomètre,
// chaque mètre entier découpe une DENTELLE de plusieurs kilomètres d'envergure.
// Mesuré sur le bloc de Valence en production (1 536², 13,5 m/cellule) :
// 46 « plans d'eau » retenus, 199 125 cellules, **8,44 % du bloc peint en eau
// animée** là où l'eau réelle occupe environ 1 %.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI PAS UN QUATRIÈME RÉGLAGE D'ALTITUDE — TROIS PISTES, TROIS MESURES
// ═══════════════════════════════════════════════════════════════════════════
//
// Les six MNT de référence (test/fixtures/relief) opposent LA DENTELLE (Rhône,
// Camargue) au VRAI PLAN D'EAU (Serre-Ponçon, un lac de barrage en Y de 23 km²
// que le détecteur dessine au pixel près — la capture le montre). Trois
// critères géométriques ont été essayés contre ces six zones :
//
//   critère                       | dentelles     | Serre-Ponçon | verdict
//   ------------------------------|---------------|--------------|--------
//   remplissage de la boîte       | 11 à 22 %     | 14 %         | ✗ mêlés
//   frontière en aval (rebord)    | 43 à 56 %     | 43 %         | ✗ mêlés
//   érosion ×2 (part survivante)  | 11 à 22 %     | 83 %         | ✓
//
// Les deux premiers ÉCHOUENT, et c'est le résultat important : sur un MNT
// quantifié, ni la compacité ni le rebord ne distinguent une plaine d'un lac.
// Aucun réglage d'altitude supplémentaire ne pouvait marcher — c'est ce qui
// justifie de changer de question plutôt que d'ajouter un seuil.
//
// ═══════════════════════════════════════════════════════════════════════════
// LA BONNE QUESTION : PAS « EST-CE PLAT ? » MAIS « EST-CE LARGE ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// Une bande de contour n'a pas de largeur propre : elle est large de
// 1 m / pente. C'est un artefact de PENTE, pas une étendue. Une étendue d'eau,
// elle, est plate dans LES DEUX directions — c'est la définition même d'une
// surface libre. Exiger une largeur minimale, c'est exiger cette seconde
// dimension, celle que la quantification ne peut pas fabriquer.
//
// La largeur moyenne d'une forme se lit sans érosion ni squelette :
//
//     largeur = 2 × aire / périmètre
//
// (pour un ruban de longueur L et de largeur w : 2·Lw/2L = w, exactement).
//
// ⚠️ EN MÈTRES, PAS EN CELLULES, et ce n'est pas cosmétique : la largeur d'une
// dentelle est fixée par la PENTE DU SOL, donc elle vaut la même chose en
// mètres quelle que soit la finesse du MNT, tandis qu'en cellules elle double
// quand on double la résolution. Un seuil en cellules aurait été juste à 768²
// et faux à 1 536² — le genre de défaut qui revient une cinquième fois.
//
// RELEVÉ DU 2026-08-02, largeur moyenne mesurée sur les six zones cuites :
//
//   zone / objet                          | largeur | verdict
//   --------------------------------------|---------|--------------------
//   Camargue, dentelles du delta          |  62 m   | refusé
//   Vallée du Rhône, dentelles de la plaine| 64-80 m | refusé  ← LE DÉFAUT
//   ——————————— la frontière ———————————— | 150 m   |
//   Sognefjord, lac d'altitude à 1 060 m  | 284 m   | gardé
//   Serre-Ponçon, lac de barrage          | 365 m   | gardé
//
// Le seuil est posé à **150 m**, à peu près la moyenne géométrique des deux
// camps (√(80 × 284) = 151) : un facteur ~2 de marge de chaque côté. C'est un
// PLANCHER largement sous le premier vrai lac, pas une égalité — même règle que
// scripts/verifie-dist.mjs : on attrape l'effondrement, pas la variation.
//
// CE QUE ÇA COÛTE, honnêtement : un vrai plan d'eau plus étroit que 150 m perd
// sa surface ANIMÉE (vagues, reflet, écume). Il ne disparaît pas de la carte —
// le calque vectoriel (src/map/water-layer.js, données OSM/Overture) continue de
// le peindre, et c'est d'ailleurs la source JUSTE pour un cours d'eau : c'est
// elle qui donnera au Rhône sa vraie largeur, au lieu de la terrasse entière.
export const LARGEUR_MIN_M = 150

// La règle d'Adrien de la v40, inchangée et rapatriée ici pour que les deux
// conditions d'admission vivent au même endroit : `detectLakes` prenait des
// zones plates urbaines pour des plans d'eau (les taches bleues d'Annecy).
// Une étendue de moins de 3 km dans sa plus grande dimension n'a pas droit à
// la couche maritime.
export const LONGUEUR_MIN_M = 3000

/**
 * Mesure géométrique d'une composante de `detectLakes`, en mètres au sol.
 *
 * @param {{cells: Int32Array, size: number}} lac
 * @param {number} cellM  côté d'une cellule du MNT, en mètres
 * @returns {{minX:number, minY:number, w:number, h:number, aire:number,
 *            longueurM:number, largeurM:number}}
 *
 * ⚠️ LE PÉRIMÈTRE IGNORE LES BORDS DE GRILLE. Un lac coupé par le bord du bloc
 * verrait sinon sa tranche comptée comme du rivage, et sa largeur mesurée
 * chuterait — un Léman à cheval sur deux blocs se serait asséché d'un côté.
 * On ne mesure que la frontière VISIBLE, ce qui est aussi la seule qu'on sache
 * interpréter.
 */
export function mesurePlanEau(lac, cellM, marque) {
  const { cells, size } = lac
  const n = cells.length
  let minX = size, maxX = -1, minY = size, maxY = -1
  // `marque` est un tampon partagé par tous les lacs d'un même appel : allouer
  // un Uint8Array(size²) par composante coûterait 4,7 Mo à chaque plan d'eau.
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
 * @param {{cellM: number, largeurMinM?: number, longueurMinM?: number}} opts
 * @returns {Array<{lac: object, mesure: object}>}
 */
export function plansEauRetenus(lacs, { cellM, largeurMinM = LARGEUR_MIN_M, longueurMinM = LONGUEUR_MIN_M } = {}) {
  const gardes = []
  if (!lacs?.length || !(cellM > 0)) return gardes
  const marque = new Uint8Array(lacs[0].size * lacs[0].size)
  for (const lac of lacs) {
    const mesure = mesurePlanEau(lac, cellM, lac.size * lac.size === marque.length ? marque : undefined)
    if (mesure.longueurM < longueurMinM) continue
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
  for (const r of retenus) n += r.mesure.aire
  return n / (size * size)
}
