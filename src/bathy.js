// BATHYMÉTRIE — fusionner un relief terrarium avec une source marine plus fine.
//
// Pourquoi : les tuiles terrarium d'AWS n'ont sous l'eau qu'ETOPO1, à ~1 850 m
// de résolution. Les bassins sont lisses, les dorsales floues, et une côte est
// illisible. GEBCO_2026 donne 464 m (et les sources côtières régionales
// descendent bien plus bas encore) — d'où ce module, qui décide COMMENT les
// deux se rencontrent.
//
// LA RÈGLE, en une phrase : la terre ne bouge jamais, la mer prend la
// profondeur de la source fine, et le raccord se fait en fondu au large.
//
// ⚠️ « La terre ne bouge jamais » n'est pas une précaution de style, c'est la
// leçon d'une session entière passée sur les polders : un trait de côte qui se
// déplace d'un pixel, et Amsterdam se retrouve sous la mer du Nord. La source
// fine ne sert donc QU'À CREUSER — elle ne peut jamais faire émerger un pixel
// que le relief de référence dit immergé, ni l'inverse.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (t) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

// Profondeur (en mètres sous 0) à partir de laquelle la source fine parle
// SEULE. Au-dessus, on mélange, pour que le raccord au rivage soit invisible.
export const BLEND_DEPTH = 25

// Un pixel de mer reste de la mer : on ne le laisse jamais remonter à 0.
const SEA_EPS = 0.05

// Un demi-pas de quantification terrarium (1/256 m). En deçà, une altitude est
// tenue pour une ABSENCE de mesure et non pour un terrain à l'altitude zéro.
const NODATA_EPS = 1 / 512

// ══════════ LES APLATS DE REMPLISSAGE — le remplissage ne vaut pas zéro ══════
//
// 🔴 LE PIÈGE QUI A COÛTÉ LES « PLATEAUX RECTANGULAIRES » DE LA CIOTAT.
//
// `NODATA_EPS` suppose qu'un relief de référence qui n'a rien à dire sur la mer
// y écrit ZÉRO PILE. C'était vrai des tuiles AWS/EU-DEM. Ce ne l'est PAS de
// Mapterhorn, qui cale sa mer sur une constante propre à chaque dalle — mesuré
// au décodage du bloc, en part des pixels immergés :
//
//   Nice z14            −0,344 m sur 99,3 %
//   rade de Brest z14   −2,781 m sur 86,8 %
//   La Ciotat z14       −0,094 m sur 34,3 %  ET  −0,406 m sur 26,4 %
//
// Ces valeurs passent sous le radar de `NODATA_EPS`. La fusion les prend alors
// pour une bathymétrie réelle : elle pilote son fondu dessus, et à −0,34 m le
// fondu vaut 0,08 % — la source fine est MUSELÉE à 99,92 %. Le pixel garde donc
// le remplissage, et comme un remplissage est constant, on obtient un aplat
// parfaitement plat à ras de l'eau, borné par le rectangle de la dalle. Mesuré
// à Nice : 833 054 pixels rendus à −0,34 m là où la source fine donnait −25,2 m.
//
// LA SIGNATURE N'EST PAS LA VALEUR, C'EST LA PART. Un remplissage occupe une
// fraction énorme du champ immergé sur UNE SEULE valeur, au 1/256 de mètre près.
// Une vraie bathymétrie ne se concentre jamais ainsi — contre-épreuve sur des
// blocs où la référence porte de l'ETOPO1 :
//
//   baie de Tokyo z12  1,9 %   ·  Manche z11  1,1 %
//   large de Toulon z10, mer Égée z10, Atlantique z8   0,0 %
//
// Douze fois d'écart entre le plus petit aplat (26,4 %) et la plus forte
// concentration légitime (1,9 %) : le seuil tient au milieu du gouffre.
export const FILL_SHARE = 0.1

// Pas d'échantillonnage. On ne compte qu'un pixel sur 17 : un aplat qui porte
// 10 % du champ ressort de n'importe quel échantillon (le bloc le plus pauvre
// en mer des huit mesurés, la rade de Brest, donne encore 8 000 sondes), et
// l'histogramme coûte alors une poignée de millisecondes au lieu d'en coûter
// des dizaines sur 2,4 M de pixels. 17 est premier avec toutes nos largeurs de
// dalle (256, 512, 768, 1536) : l'échantillon ne peut pas se coincer sur une
// colonne.
const FILL_STEP = 17

// En deçà, « 10 % du champ » ne veut plus rien dire — deux pixels identiques
// feraient un faux aplat. Le module s'abstient plutôt que de deviner.
const FILL_MIN_SONDES = 64

/**
 * LES VALEURS DE REMPLISSAGE d'un relief de référence, constatées et non
 * supposées. Voir le bloc ci-dessus pour le pourquoi et les chiffres.
 *
 * ⚠️ ON NE REGARDE QUE LE CÔTÉ IMMERGÉ. Un aplat POSITIF — une plaine
 * littorale rigoureusement plate, un lac aplani — est de la TERRE, et la terre
 * ne bouge jamais. Le déclarer muet autoriserait la source marine à la creuser,
 * c'est-à-dire à déplacer un trait de côte : exactement ce que ce module
 * interdit depuis la session polders.
 *
 * @param {Float32Array} land - relief de référence, en mètres
 * @param {{seaLevel?: number, fillShare?: number}} [opts]
 * @returns {Set<number>} les altitudes tenues pour du remplissage (vide si on
 *   ne peut pas conclure)
 */
export function detectFillLevels(land, opts = {}) {
  const out = new Set()
  if (!land) return out
  const level = opts.seaLevel ?? 0
  const part = opts.fillShare ?? FILL_SHARE
  const compte = new Map()
  let sondes = 0
  for (let i = 0; i < land.length; i += FILL_STEP) {
    const l = land[i]
    if (!(l < level)) continue
    sondes++
    compte.set(l, (compte.get(l) ?? 0) + 1)
  }
  if (sondes < FILL_MIN_SONDES) return out
  const seuil = sondes * part
  for (const [v, c] of compte) if (c >= seuil) out.add(v)
  return out
}

// ══════════ LE BRUIT AUTOUR DE ZÉRO — B5, Porquerolles ═══════════════════════
//
// 🔴 LE REMPLISSAGE DE MER DU TERRARIUM N'EST PAS UNE CONSTANTE, C'EST UN BRUIT.
// Mapterhorn sert du .webp, c'est-à-dire du lossy : son « zéro » de mer ressort
// à **0 ± 0,5 m, étalé sur plusieurs valeurs, DES DEUX CÔTÉS du zéro**. Relevé
// au transect sur la tuile z13/4237/3010 (sud de Porquerolles), nord → sud :
// terre 0,9…56 m, puis **+0,5 +0,2 +0,3 +0,4 +0,4 … +0,3 sur ~1 km de mer**,
// puis 0 exact. Les remplissages NÉGATIFS déjà mesurés (−0,094 / −0,344 /
// −0,406 m, encart ci-dessus) sont le même bruit, de l'autre côté.
//
// Trois défenses existaient, aucune ne l'attrape :
//   · `NODATA_EPS` ne voit que le zéro EXACT ;
//   · `detectFillLevels` ne voit qu'une valeur UNIQUE tenant ≥ 10 % — un bruit
//     étalé sur 0,2 / 0,3 / 0,4 / 0,5 n'en donne aucune ;
//   · et surtout « un aplat POSITIF est de la terre » : +0,3 m est classé TERRE,
//     la source fine (EMODnet, −80 m) n'est même pas lue, h > 0 sort tel quel.
// À l'écran : un plateau plat couleur terre, RECTANGULAIRE (c'est l'emprise du
// remplissage positif), qui déborde le vrai trait de côte et couvre la mer
// peu profonde ; la mer sombre commence là où le remplissage retombe à 0 pile.
// Mesuré (scripts/sonde-b5.mjs, îles d'Hyères / Marseille, damier z12–z13) :
// **77 000 à 300 000 pixels par bloc** rendus à 0 ou au-dessus sur de la mer.
//
// LA SIGNATURE EST LA MÊME QUE POUR LES APLATS : LA PART, PAS LA VALEUR. Un
// vrai trait de côte occupe la bande |h| ≤ 0,6 m sur une LIGNE — quelques
// pour-mille des pixels que la source fine dit immergés. Un remplissage bruité
// l'occupe sur un CHAMP. On compte donc, parmi les pixels que la source fine
// dit immergés, la part qui tombe dans la bande ; au-delà de `FILL_SHARE`,
// la bande est un remplissage et vaut une absence.
//
// ⚠️ CE QUI NE BOUGE PAS : la bande est étroite (0,6 m — au-dessus du bruit
// mesuré, en dessous de toute plage réelle ou d'un polder à −4 m) ; elle
// n'agit QUE là où la source fine dit immergé ; et elle exige la même part et
// le même minimum de sondes que `detectFillLevels`. Une plage de 40 pixels à
// +0,3 m au bord d'un bloc reste de la terre (test/bathy-platier-b5.test.js).
export const NOISE_BAND = 0.6
// ⚠️ ET LA SOURCE FINE DOIT DIRE FRANCHEMENT IMMERGÉ. Une cellule EMODnet à
// cheval sur le rivage rend −1 ou −2 m sous une vraie plage : à ce prix-là, la
// plage reste de la terre. Le remplissage de Porquerolles, lui, recouvre une
// mer que la source fine donne à −5…−80 m dès la première cellule.
export const NOISE_MIN_DEPTH = 2

// ══════════ 🔴 PLAT — UNE SOURCE NE REDESSINE UN RIVAGE QU'À SON ÉCHELLE ═════
//
// LE PROBLÈME DE FOND, celui qu'Adrien voit revenir. La bande de bruit ci-dessus
// est la SEULE règle du module qui prenne une TERRE FRANCHE ET POSITIVE et la
// rende à la mer. Elle le fait sur le seul avis de « la source fine ». Or
// « fine » est une propriété RELATIVE, et personne ne la vérifiait :
//
//   Camargue, 43,45 / 4,60, bloc z17 → **0,433 m par pixel**.
//   La source bathymétrique qui y répond est EMODnet z10 → **111,8 m de maille**.
//   Rapport : **258**. Une cellule de la « source fine » couvre 256 pixels du
//   bloc — un carré de 256 × 256 px à angles droits.
//
// Mesuré (scripts/plat-champs.mjs, `.banc/PLAT/avant/`) : **728 813 pixels de
// terre franche** (31 % du bloc, terrarium à +0,1 … +0,6 m, texturé, aucune
// valeur constante) rendus à la mer par cette seule règle, en blocs rectangulaires
// alignés sur la grille EMODnet — **les carrés plats d'Adrien** — et une cellule
// restée émergée au milieu : **le carré blanc dans l'eau**. La profondeur
// réclamée par EMODnet y est de −2,00 à −2,26 m : elle passe le garde
// `NOISE_MIN_DEPTH` d'un cheveu, et emporte la décision sur un relief IGN à 1 m.
//
// ⛔ LE GARDE N'EST PAS UNE PROFONDEUR DE PLUS. Le même relevé sur cinq lieux
// montre que la variable qui sépare le bon du mauvais n'est ni la profondeur ni
// le zoom, c'est la MAILLE de la source fine, ramenée au pixel du bloc :
//
//   lieu / zoom          maille source   px du bloc   rapport   verdict
//   Porquerolles z13     EMODnet 111,8      6,99 m       16     B5 nécessaire ✅
//   Camargue z13         EMODnet 111,8      6,94 m       16     correct ✅
//   Bretagne z15         EMODnet 111,8      1,58 m       64     10 px basculés
//   Camargue z17         EMODnet 111,8      0,433 m     258     728 813 px ⛔
//   Porquerolles z17     EMODnet 111,8      0,434 m     258      16 029 px ⛔
//   fjord Bergen z15     GEBCO   611        1,18 m      518       9 889 px ⛔
//
// La règle : au-delà de `CELLULE_MAX_PX` pixels de bloc par cellule de source,
// la source fine n'est plus fine ICI — elle ne sait plus où est le rivage à
// mieux qu'un gros carré — et elle perd le droit de RECLASSER de la terre. Elle
// garde tout le reste : elle creuse la mer comme avant, au bit près, partout où
// le terrarium est muet ou immergé. **Seule la reclassification terre → mer est
// suspendue.** C'est ce qui rend le correctif sûr pour « le relief des tuiles
// déjà correctes ».
export const CELLULE_MAX_PX = 32

/**
 * La bande de bruit est-elle admissible à cette échelle ?
 *
 * @param {number} resolutionSourceM - maille au sol de la tuile bathy peinte (m)
 * @param {number} metersPerPixel - pas au sol d'un pixel du champ fusionné (m)
 * @returns {number} la valeur à passer en `noiseBand` — `NOISE_BAND`, ou 0 pour
 *   éteindre la règle. ⚠️ Une entrée non finie rend `NOISE_BAND` : un appelant
 *   qui ne sait pas mesurer son échelle garde le comportement d'avant, AU BIT.
 */
// ══════════ 🔴 VETO — LE TRAIT DE CÔTE DÉCIDE, PAS UNE SOURCE GROSSIÈRE ══════
//
// La règle d'échelle ci-dessus borne le régime « rapport > 32 ». Elle ne mord
// PAS à z11–z13 (rapport 8 à 16), et c'est LÉGITIME : c'est exactement le
// régime où la bande de B5 est prouvée nécessaire à Porquerolles. Or c'est là
// que la Camargue perd encore 100 % de deux tuiles (relevé PLAT, §⑥ de son
// rapport), et **à z12 aucune règle LOCALE ne peut trancher** entre un marais
// IGN uniformément à +0,13 m et un remplissage WebP uniformément à +0,3 m —
// quatre discriminants testés, aucun ne tient.
//
// L'information manquante est NON LOCALE, et elle est déjà au dépôt : le trait
// de côte vectoriel (`src/coast-veto.js`, polygones OSM de
// `public/data/coast-z6`). D'où `terreVeto` :
//
//   > **une cellule que le trait de côte déclare TERRE ne peut pas être rendue
//   > à la mer par la bande de bruit, quoi que dise la source fine.**
//
// ⛔ ET SEULEMENT LA BANDE DE BRUIT. C'est le point qui garde la mer en mer.
// La bande de B5 est la SEULE règle de ce module qui prenne une terre franche
// et POSITIVE et la reclasse en mer (voir l'encart de `NOISE_BAND`). Les autres
// chemins — zéro exact, aplat de remplissage, pixel déjà sous le niveau —
// restent ouverts AU BIT, et c'est par eux que l'eau réelle arrive : les étangs
// de Camargue passent par le zéro exact du terrarium (contours ORGANIQUES,
// `.banc/PLAT/apres/cam15-muets.png`), pas par la bande. Un veto qui aurait
// aussi fermé ces portes aurait asséché le Vaccarès.
//
// ⚠️ `terreVeto` absent ⇒ comportement d'avant, AU BIT. C'est testé.
export function bandeBruitAdmise(resolutionSourceM, metersPerPixel) {
  if (!Number.isFinite(resolutionSourceM) || !Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return NOISE_BAND
  return resolutionSourceM > CELLULE_MAX_PX * metersPerPixel ? 0 : NOISE_BAND
}

/**
 * Maille au sol, en mètres, d'un pixel d'une tuile bathy de 256 px au zoom `z`.
 * @param {number} z
 * @param {number} lat - latitude en degrés
 */
export function resolutionBathyM(z, lat) {
  if (!Number.isFinite(z) || z < 0) return NaN
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z
}

/**
 * Le champ porte-t-il, autour du niveau, un REMPLISSAGE BRUITÉ ?
 * @param {Float32Array} land
 * @param {Float32Array} sea
 * @param {{seaLevel?: number, fillShare?: number, noiseBand?: number}} [opts]
 * @returns {boolean}
 */
export function detectNoiseFill(land, sea, opts = {}) {
  if (!land || !sea || sea.length !== land.length) return false
  const level = opts.seaLevel ?? 0
  const part = opts.fillShare ?? FILL_SHARE
  const bande = opts.noiseBand ?? NOISE_BAND
  // 🔴 PLAT — `noiseBand: 0` ÉTEINT LA RÈGLE, il ne la rétrécit pas à zéro. Sans
  // ce test, une bande nulle laisserait passer `d >= -0 && d <= 0`, c'est-à-dire
  // le zéro EXACT — que `NODATA_EPS` traite déjà, mais qui suffirait à faire
  // rendre `true` sur une dalle de remplissage et à rallumer toute la règle.
  if (!(bande > 0)) return false
  let sondes = 0
  let dedans = 0
  const seuilMer = level - (opts.noiseMinDepth ?? NOISE_MIN_DEPTH)
  for (let i = 0; i < land.length; i += FILL_STEP) {
    const s = sea[i]
    if (!(s < seuilMer)) continue // seule la mer FRANCHE de la source fine compte
    sondes++
    const d = land[i] - level
    if (d >= -bande && d <= bande) dedans++
  }
  if (sondes < FILL_MIN_SONDES) return false
  return dedans >= sondes * part
}

// ══════════ 🔴 B6 — DEUX ABSENCES NE FONT PAS UNE TERRE ══════════════════════
//
// PLAT et VETO ont travaillé sur les QUATRE portes qui mettent un pixel SOUS
// l'eau (le zéro exact, l'aplat de remplissage, la bande de bruit, le pixel déjà
// négatif). Le défaut de Rodrigues est le SENS INVERSE, et il n'a qu'une sortie :
//
//   > `if (s >= level || sMuet) { out[i] = l }`
//
// C'est le SEUL endroit de ce module où un pixel peut ressortir ÉMERGÉ alors que
// la source marine a été lue. Il est juste tant que `l` mesure quelque chose. En
// pleine mer profonde, `l` ne mesure RIEN : mesuré à Rodrigues, la tuile
// terrarium rend **0,000 m pile sur 262 144 pixels sur 262 144**. Et `s >= level`
// veut dire que la source fine ne mesure rien non plus (le tuileur aplatit la
// terre à zéro). Deux absences — et le code rendait celle qui veut dire TERRE.
//
// À l'écran : des barres beiges longues, fines, à bout franc, posées sur 4 000 m
// de fond (images `f_003`, `f_018` d'Adrien). Leur longueur est celle d'une
// tuile, parce que c'est une frange de tuile.
//
// D'OÙ VIENNENT LES `s >= level` EN PLEIN OCÉAN — mesuré, pas supposé
// (`scripts/b6-porte.mjs`, `scripts/b6-striage.mjs`) :
//
//   tuile bathy z8 171/142 (large de Rodrigues), fichier PNG SANS PERTE
//     valeurs distinctes 673 · pas de quantification 1,00 m
//     min −4 640,00 m · **max 0,00 m EXACTEMENT** · 79 pixels à zéro
//   le même champ après `resampleCatmullRom` (256 → 512) : **max +6,18 m**
//
// Le positif n'est donc pas dans la donnée : c'est le DÉPASSEMENT du cubique
// autour de la sentinelle de terre du tuileur. 257 pixels sortent émergés.
//
// LA RÈGLE : quand les deux sources sont muettes **et que le trait de côte a été
// consulté et ne déclare aucune terre**, le pixel n'est pas de la terre — il
// prend `level − SEA_EPS`. Le juge est le même que celui de VETO, pris dans
// l'autre sens : VETO retire à la mer le droit de prendre de la terre, B6 retire
// à l'absence le droit d'en fabriquer. Voir `merFranche` (src/coast-veto.js).
//
// ⚠️ `merFranche` absent ou faux ⇒ comportement d'avant, AU BIT. C'est testé.
/**
 * Fusionne deux champs d'altitude de MÊME taille, en mètres.
 *
 * @param {Float32Array} land - relief de référence (terrarium). Fait autorité
 *   sur le trait de côte et sur toute la terre émergée.
 * @param {Float32Array|null} sea - bathymétrie fine, alignée pixel à pixel.
 *   `null` ou taille différente ⇒ on rend `land` inchangé (repli sûr).
 * @param {{blendDepth?: number, seaLevel?: number, fillShare?: number,
 *   noiseBand?: number, terreVeto?: Uint8Array, merFranche?: boolean}} [opts]
 *   `fillShare` règle la détection des aplats de remplissage (detectFillLevels).
 *   `terreVeto` : masque du trait de côte VECTORIEL aligné pixel à pixel sur
 *   `land` (≠ 0 = TERRE certaine). Voir l'encart 🔴 VETO ci-dessus.
 *   `merFranche` : le trait de côte a été consulté ET ne déclare AUCUNE terre
 *   sur cette emprise. Voir l'encart 🔴 B6 ci-dessus.
 * @returns {Float32Array} un NOUVEAU tableau (les entrées ne sont pas mutées)
 */
export function fuseBathymetry(land, sea, opts = {}) {
  if (!land) return land
  if (!sea || sea.length !== land.length) return land.slice()
  const blend = Math.max(1e-3, opts.blendDepth ?? BLEND_DEPTH)
  const level = opts.seaLevel ?? 0
  // Les aplats de remplissage de CE bloc, constatés une fois pour toutes.
  //
  // Le plus PROFOND d'entre eux fait PLANCHER DE CRÉDIBILITÉ : au-dessus de
  // lui, le relief de référence n'a aucune résolution en mer — ce qu'on y
  // trouve n'est que le bord anti-aliasé du remplissage. Mesuré à La Ciotat :
  // une fois les deux aplats traités (−0,094 et −0,406 m), il restait un
  // LISERÉ à −0,02 … −0,37 m tout autour de chaque dalle, encore visible à
  // l'œil comme un rectangle en relief posé sur le fond.
  const aplats = detectFillLevels(land, opts)
  // NaN quand aucun aplat n'a été constaté : toutes les comparaisons ci-dessous
  // rendent alors `false`, et le module se comporte exactement comme avant.
  const plancher = aplats.size ? Math.min(...aplats) : NaN
  // B5 — le bruit autour du zéro, voir l'encart au-dessus de `NOISE_BAND`.
  const bande = opts.noiseBand ?? NOISE_BAND
  const bruitZero = detectNoiseFill(land, sea, opts)
  // 🔴 VETO — le trait de côte, aligné pixel à pixel sur `land`. Une taille
  // différente est ignorée EN SILENCE VOLONTAIRE plutôt que de décaler le veto
  // d'un demi-champ : mieux vaut le comportement d'avant qu'un masque de
  // travers. Voir l'encart au-dessus de `bandeBruitAdmise`.
  const veto = opts.terreVeto && opts.terreVeto.length === land.length ? opts.terreVeto : null
  // 🔴 B6 — DEUX ABSENCES NE FONT PAS UNE TERRE. Voir l'encart au-dessus de
  // `fuseBathymetry`. ⚠️ `=== true` : une valeur absente, `undefined` ou
  // truthy-par-accident garde le comportement d'avant, AU BIT.
  const merFranche = opts.merFranche === true && !(level > 0)
  const out = new Float32Array(land.length)
  for (let i = 0; i < land.length; i++) {
    const l = land[i]
    // ⚠️ UN ZÉRO EXACT DANS LE RELIEF DE RÉFÉRENCE N'EST PAS DE LA TERRE PLATE,
    // C'EST UNE ABSENCE DE DONNÉE — et c'est le cas le plus fréquent en mer.
    // Mesuré au large de Toulon à z12 : la tuile terrarium est à 100 % à zéro
    // exact, 0 % de valeurs négatives. À Santorin, 73 % de zéros et 12 m de
    // profondeur maximale. La raison : à ces zooms les tuiles AWS viennent de
    // l'EU-DEM, qui ne décrit QUE la terre ; la mer y est un remplissage.
    //
    // Les traiter comme de la terre revenait à interdire à GEBCO d'y toucher —
    // d'où des fonds parfaitement plats à zéro dès qu'on approchait, alors que
    // tout allait bien de loin (là, les tuiles portent encore de l'ETOPO1).
    //
    // Le seuil vaut un demi-pas de quantification terrarium (1/256 m) : un
    // relief réel ne rend quasiment jamais 0,000 pile, un remplissage si.
    //
    // ⚠️ ET LE REMPLISSAGE NE VAUT PAS TOUJOURS ZÉRO : Mapterhorn cale sa mer
    // sur une constante par dalle (−0,094 / −0,344 / −0,406 / −2,781 m selon la
    // dalle mesurée). `aplats` les a constatés sur le champ ; ils valent
    // exactement la même chose qu'un zéro — une ABSENCE. Voir detectFillLevels.
    //
    // ⚠️ LE `l < level` N'EST PAS DÉCORATIF. Sans lui, un pixel de TERRE à
    // +5 m serait « au-dessus du plancher » donc déclaré muet, et il sortirait
    // du test de terre pour tomber dans la branche marine. Le trait de côte
    // serait remis entre les mains de la source fine — la faute que ce module
    // interdit depuis la session polders. Un remplissage est TOUJOURS immergé.
    const remplissage = l < level && l >= plancher
    // B5 — dans la bande de bruit ET là où la source fine dit immergé : absence.
    // ⚠️ `sea[i] < level` est lu ICI, avant le test de terre, parce que c'est
    // précisément un pixel classé terre (+0,3 m) qu'il faut rendre à la mer.
    // 🔴 VETO — `!(veto && veto[i])` EST TOUT LE CORRECTIF DE LA TÂCHE VETO, et
    // il est posé ICI et NULLE PART AILLEURS. Le trait de côte ne rend pas de la
    // terre : il retire à la bande de bruit le droit d'en prendre.
    const bruit = !(veto && veto[i]) && bruitZero && l >= level - bande && l <= level + bande && sea[i] < level - (opts.noiseMinDepth ?? NOISE_MIN_DEPTH)
    const noData = (l > -NODATA_EPS && l < NODATA_EPS) || remplissage || bruit
    // TERRE — intouchable, et c'est elle qui définit le rivage
    if (l >= level && !noData) {
      out[i] = l
      continue
    }
    const s = sea[i]
    if (!Number.isFinite(s)) {
      // 🔴 B6 — L'AUTRE FORME DE LA MÊME ABSENCE, ET C'EST LA PLUS GRANDE.
      //
      // Ici la source fine n'a RIEN PEINT (case hors couverture). En pleine mer
      // profonde c'est le cas MASSIF, parce que le tuileur écarte délibérément
      // les tuiles qui n'ont que de l'abysse (`build-bathy-tiles.mjs`, garde
      // `SHELF = −500`), au motif que « les tuiles écartées gardent
      // silencieusement l'ancien relief ». ⛔ **CE MOTIF N'EST PLUS VRAI** : le
      // terrarium Mapterhorn n'a PAS d'ancien relief en mer — mesuré à
      // Rodrigues, 262 144 pixels sur 262 144 à 0,000 m PILE. L'absence de
      // bathymétrie n'y laisse donc pas un fond grossier, elle laisse **zéro**,
      // que le nuanceur peint en TERRE.
      //
      // Compté (`scripts/b6-marches.mjs`, bande de 7×7 tuiles à Rodrigues) :
      // **26 tuiles sur 49 (53,1 % du champ) sans aucune bathymétrie à z9** au
      // plancher normal. Le globe s'en sort par la seconde chance du terrarium
      // muet (`fondMarinTuile`) ; les deux autres chemins n'en ont pas toujours.
      //
      // Même juge et même prudence que ci-dessous : on ne creuse que si le trait
      // de côte a répondu ET ne déclare aucune terre.
      out[i] = merFranche && noData ? level - SEA_EPS : l
      continue
    }
    // ⚠️ UN ÉCHANTILLON ÉMERGÉ N'EST PAS UN FOND À ZÉRO — c'est une ABSENCE.
    // Le tuileur aplatit délibérément la terre à 0 (le canal G y coûtait 62 Ko
    // par tuile pour une information que cette fonction n'utilise jamais). Ce 0
    // ne mesure donc rien.
    //
    // Sans ce test, `Math.min(s, level - SEA_EPS)` le ramenait à −0,05 m et
    // ÉCRASAIT la mer à zéro. Invisible au large, catastrophique près des côtes :
    // au-delà de z8 on surzoome, et à z14 la tuile entière est reconstruite
    // depuis 4×4 pixels de l'ancêtre — près d'un rivage, presque tous émergés.
    // C'est le fond plat à zéro vu sur Santorin et Toulon, alors que les tuiles
    // portaient bien −2 408 m et −2 432 m.
    //
    // 🔴 B3 — ET SOUS UNE NAPPE DE LAC, `s >= level` NE SUFFIT PLUS.
    // Le tuileur écrit `0` pour « ce pixel n'est pas de la mer » (voir
    // ci-dessus). Tant que `level` vaut 0, ce `0` est attrapé par le test
    // ci-dessus et tout va bien. Dès qu'une zone déclare une NAPPE de lac
    // (`waterLevelM`), `level` vaut par exemple 456,5 m : le marqueur de terre
    // `0` passe alors pour un fond à 456 m sous la surface du lac, et TOUTE la
    // terre située sous la cote du lac se fait creuser. Mesuré par B2 sur
    // l'exutoire du Rhône à Genève : **347,67 m de vallée détruits**.
    //
    // La SENTINELLE, donc : sous une nappe déclarée, un échantillon nul est une
    // ABSENCE, pas un fond. ⚠️ Le garde `level > 0` n'est pas décoratif — il
    // rend le chemin marin identique AU BIT (à `level = 0`, `s >= level`
    // couvre déjà `s === 0`).
    const sMuet = level > 0 && s > -NODATA_EPS && s < NODATA_EPS
    if (s >= level || sMuet) {
      // 🔴 B6 — DEUX ABSENCES NE FONT PAS UNE TERRE.
      //
      // On arrive ici parce que la source fine ne mesure rien (`s >= level` :
      // le tuileur APLATIT la terre à zéro, ce zéro ne mesure pas un fond). Et
      // si `noData` est vrai, le relief de référence ne mesure rien non plus.
      // `out[i] = l` rend alors **le zéro muet du terrarium**, que le nuanceur
      // peint en TERRE — au milieu de 4 000 m de fond. C'est la barre beige à
      // arête franche qu'Adrien a filmée à Rodrigues.
      //
      // ⛔ ET CE N'EST PAS UNE CINQUIÈME PORTE DE PLUS, C'EST LA SORTIE : les
      // quatre portes de `VETO §②` mettent un pixel SOUS l'eau ; celle-ci l'en
      // fait SORTIR. Elle est donc la seule qui puisse fabriquer de la terre.
      //
      // MESURÉ (`scripts/b6-porte.mjs`, tuile z8 171/142 au large de Rodrigues) :
      // la tuile bathy brute a pour maximum **0,00 m EXACTEMENT** (79 pixels de
      // haut-fond aplatis par le tuileur) ; après `resampleCatmullRom` le champ
      // monte à **+6,18 m** — le dépassement du cubique autour de la sentinelle
      // de terre. 257 pixels franchissent alors `s >= level` et ressortent
      // émergés à 0 m, en une frange à bord franc de la largeur de la tuile.
      //
      // ⚠️ LE GARDE EST LE TRAIT DE CÔTE, ET IL EST NON LOCAL — c'est le même
      // juge que VETO, pris dans l'autre sens. `merFranche` n'est vrai que si
      // les polygones OSM ont été chargés SANS ERREUR et ne déclarent AUCUNE
      // terre sur l'emprise (`src/coast-veto.js`). Un haut-fond réellement
      // émergé (Cargados Carajos, un motu, un îlot) est dans OSM : la côte n'y
      // est pas franche, et le pixel garde son `l` AU BIT. Un banc entièrement
      // submergé (Saya de Malha) n'y est pas, et il n'a rien à faire en terre.
      //
      // ⛔ ET ON N'INVENTE PAS DE PROFONDEUR : `level − SEA_EPS`, c'est-à-dire
      // « de l'eau, la moins profonde possible » — la constante que ce module
      // utilise déjà pour dire « un pixel de mer ne remonte jamais à zéro ».
      // Creuser jusqu'au fond voisin serait une mesure fabriquée.
      //
      // ⚠️ `level > 0` (nappe de lac déclarée) ÉTEINT la règle : `merFranche`
      // parle de la côte MARINE, elle n'a rien à dire sous un lac. C'est dans
      // la définition de `merFranche` ci-dessus, et c'est testé.
      out[i] = merFranche && noData ? level - SEA_EPS : l
      continue
    }
    // MER — la source fine ne peut que creuser sous le niveau, jamais émerger
    const deep = Math.min(s, level - SEA_EPS)
    // FONDU — il mesure la DISTANCE AU RIVAGE, et il change de pilote seulement
    // là où le relief de référence n'a rien à dire.
    //
    // Quand la référence porte une vraie bathymétrie, sa propre profondeur est
    // le bon indicateur : on garde le comportement d'origine, au pixel près.
    // Quand elle est muette (remplissage à zéro), il ne reste que la source
    // fine — et c'est un indicateur légitime, GEBCO étant elle aussi peu
    // profonde près des côtes.
    //
    // ⚠️ Ne PAS prendre le maximum des deux : au large la source fine dit
    // −2 000 m partout, le fondu saturerait à 1 jusque sur le rivage et le
    // trait de côte sauterait. Mesuré : un pixel de bord passait à −400 m.
    //
    // 🔴 B3 — SOUS UNE NAPPE DÉCLARÉE, LA RÉFÉRENCE N'A PAS DE FOND À DÉFENDRE.
    // B1 l'a mesuré sur cinq lacs, aux deux chemins et à tous les zooms :
    // le terrarium n'y rend pas un fond, il rend **la surface, étendue 9×9 =
    // 0,00 m**. Piloter le fondu sur `l` reviendrait donc à le piloter sur la
    // cote de l'eau : à 1,5 m sous `level`, `t ≈ 0,01` et la source fine sort
    // **pondérée à 1 %** — le Léman à 371,6 m au lieu de 62 (mesuré par B2).
    // Quand une nappe est déclarée, la source fine est donc la seule autorité
    // sous elle, exactement comme sur un pixel muet. ⚠️ Les pixels de TERRE
    // sous la cote du lac ne passent jamais ici : la sentinelle ci-dessus les a
    // déjà rendus intacts.
    const sousNappe = level > 0
    // 🔴 B5 — QUAND LA RÉFÉRENCE EST MUETTE, LA SOURCE FINE PARLE ENTIÈRE.
    //
    // Le fondu ci-dessus a UN rôle : raccorder la source fine au relief de
    // référence près du rivage, là où la référence PORTE un rivage. Sur un pixel
    // muet (0 exact, ou remplissage détecté), il n'y a rien à raccorder — et le
    // piloter sur la profondeur de la source fine elle-même la MUSELAIT :
    // à −1 m, t = smooth(1/25) = 0,5 %, sortie ≈ −0,005 m ; le damier arrondit
    // en Int16 (« les demis vont du côté de la terre ») → 0 → `h < 0` faux →
    // TERRE pour le nuanceur. Mesuré (scripts/sonde-b5.mjs, îles d'Hyères et
    // Marseille, z12/z13) : **77 000 à 300 000 pixels par bloc à 0 exact**,
    // tous issus d'un terrarium muet et d'un platier EMODnet à −1…−4 m. À
    // l'écran, des plateaux couleur terre bornés par les rectangles des dalles
    // (une dalle Mapterhorn remplie à 0 exact → muette → plateau ; sa voisine
    // remplie à −0,344 → détectée comme remplissage… et muselée pareil).
    //
    // La règle est donc : muet ⇒ t = 1, la source fine sort telle quelle,
    // bornée par `deep ≤ level − SEA_EPS` (elle ne peut toujours pas émerger).
    // ⚠️ La référence BAVARDE (l < level, non muette) garde le fondu d'origine
    // au bit : c'est elle qui porte le rivage, et le raccord y reste invisible.
    // ⚠️ L'ancien contrat « au rivage le fondu reste nul » testait un pixel à
    // 0 EXACT — c'est-à-dire une absence, pas un rivage. Réécrit (test/bathy.test.js).
    const seul = noData || sousNappe
    const base = seul ? level : l
    const t = seul ? 1 : smooth((level - l) / blend)
    out[i] = base + (deep - base) * t
  }
  return out
}

/**
 * LISSE LE FOND MARIN à l'échelle des facettes du surzoom.
 *
 * POURQUOI. Nos tuiles bathymétriques s'arrêtent à z8 — c'est la résolution
 * native de GEBCO, il n'y a rien de plus fin à avoir. Au-delà, `overzoomTile`
 * reconstruit la dalle depuis une sous-fenêtre de l'ancêtre : à z12 la tuile
 * entière vient de 4×4 pixels, à z14 de 2×2. L'agrandissement bilinéaire en
 * fait de grandes facettes plates aux arêtes franches — l'« effet creusement
 * par cube » signalé par Adrien. La quantification en profondeur du tuileur
 * (pas de 4 m puis 8 m) ajoute ses propres terrasses par-dessus.
 *
 * Lisser à la TAILLE DE LA FACETTE ne détruit aucune information réelle : sous
 * 463 m au sol, il n'y en a plus. Ça n'efface que l'artefact.
 *
 * DEUX PRÉCAUTIONS, et elles ne sont pas facultatives :
 *   · le flou n'additionne QUE des pixels de mer — mélanger la terre ferait
 *     remonter le fond près des côtes et redescendre le rivage ;
 *   · il s'éteint au voisinage du rivage, où le relief de référence fait
 *     autorité et où le trait de côte ne doit pas bouger d'un pixel.
 *
 * @param {Float32Array} data - altitudes en mètres, modifiées SUR PLACE
 * @param {number} size - côté de la grille carrée
 * @param {{radius?: number, seaLevel?: number, fadeDepth?: number}} [opts]
 * @returns {Float32Array} `data`
 */
export function smoothSeaFloor(data, size, opts = {}) {
  const r = Math.floor(opts.radius ?? 0)
  if (!data || r < 1 || size < 3) return data
  const level = opts.seaLevel ?? 0
  // au-dessus de cette profondeur le lissage s'éteint : c'est la zone où le
  // rivage se joue, et elle doit rester nette
  const fade = Math.max(1e-3, opts.fadeDepth ?? 40)
  const n = size * size
  const val = new Float32Array(n)
  const wgt = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = data[i]
    if (v < level) { val[i] = v; wgt[i] = 1 }
  }
  // flou par boîte séparable, en sommes glissantes : O(1) par pixel quel que
  // soit le rayon, sinon un rayon de 32 coûterait 65 fois le prix
  const boxPass = (src, horizontal) => {
    const dst = new Float32Array(n)
    const w = 2 * r + 1
    for (let a = 0; a < size; a++) {
      let acc = 0
      const at = (b) => (horizontal ? a * size + b : b * size + a)
      for (let b = -r; b <= r; b++) acc += src[at(Math.min(size - 1, Math.max(0, b)))]
      for (let b = 0; b < size; b++) {
        dst[at(b)] = acc / w
        acc += src[at(Math.min(size - 1, b + r + 1))] - src[at(Math.max(0, b - r))]
      }
    }
    return dst
  }
  const vB = boxPass(boxPass(val, true), false)
  const wB = boxPass(boxPass(wgt, true), false)
  for (let i = 0; i < n; i++) {
    const v = data[i]
    if (v >= level || wB[i] < 1e-4) continue
    const moyenne = vB[i] / wB[i]
    // plein effet au large, nul au rivage
    const k = smooth((level - v) / fade)
    data[i] = v + (moyenne - v) * k
  }
  return data
}

// ══════════ 🟣 LISS — LE STRIAGE DE L'ABYSSE, ET RIEN D'AUTRE ════════════════
//
// LE DÉFAUT. Adrien filme un PEIGNE sur toute la mer : des bandes régulières,
// verticales et horizontales, criantes quand le relief est exagéré. B6 a mesuré
// et TRANCHÉ : ce n'est pas un bogue. C'est la LIGNÉATION PROPRE DE GEBCO — les
// traces des campagnes de sondage — présente dans le fichier PNG SANS PERTE
// avant qu'on y touche, à 25-97 m de pic-à-pic contre 1,00 m de pas
// d'encodage. Et le rééchantillonnage ne l'ajoute pas : il l'ATTÉNUE.
//
// On ne « corrige » donc pas une erreur : on prend un ARBITRAGE, celui d'Adrien
// — lisser le relief sous-marin PROFOND, là où personne ne vérifie la vérité
// bathymétrique au mètre près, en laissant intacts le trait de côte et les
// hauts-fonds.
//
// ─────────────────────────────── OÙ COMMENCE « LE PROFOND » — LA DÉRIVATION
//
// ⛔ CE SEUIL N'EST PAS POSÉ AU GOÛT. Il est pris à la seule grandeur du produit
// qui sépare déjà le plateau de l'abysse, et elle est écrite dans le tuileur :
//
//     scripts/build-bathy-tiles.mjs:88     const SHELF = +arg('shelf', -500)
//     …:326   if (m > SHELF) return true   // du plateau
//
// `probeWorthIt` n'écrit une tuile bathy QUE si elle touche de l'eau plus haute
// que SHELF. Autrement dit, **−500 m est la profondeur sous laquelle le produit
// a décidé qu'il n'y avait plus rien de fin à décrire** : sous elle, aucune
// tuile n'est cuite pour elle-même, et c'est le socle GEBCO — 464 m de maille,
// interpolé entre des traces de sondage — qui répond seul. C'est exactement la
// définition que le brief demandait : « la profondeur sous laquelle plus aucune
// source fine ne couvre ». Le seuil du lissage EST le seuil du tuileur.
//
// ────────── ET LA TRANSITION — TROIS ÉCRITURES, DEUX RÉFUTÉES PAR LA CAPTURE
//
// Le fondu vaut le même nombre que le seuil : le lissage vaut 0 à −500 m et
// plein à −1 000 m. ⚠️ **Mais ce n'est PAS le fondu qui rend la transition
// invisible, et je l'ai cru deux fois.**
//
// ① `fondu = 500` SEUL ⇒ **UN LISERÉ EN ESCALIER** tout autour du plateau de
//    Rodrigues (capture). Un fondu est une distance en PROFONDEUR ; ce qui se
//    voit, c'est sa largeur au SOL. Or l'isobathe 500 m n'est pas un endroit
//    quelconque : **c'est le TALUS**, l'endroit le plus raide de l'océan.
//    Mesuré sur 120 tuiles z8 : la bande −500 → −1 000 m fait **1 pixel de
//    large en médiane**. La force passait donc de 0 à plein en UNE cellule.
//    ⚡ CONTRE-ÉPREUVE QUI TRANCHE (`.banc/LISS/essai-seuil2000/`) : en
//    déplaçant le SEUIL à 2 000 m, le liseré **suit le seuil**. Ce n'était donc
//    pas « le talus enfin révélé sous le bruit », c'était bien MA transition.
//    Sans ce contrôle j'aurais livré le liseré en le prenant pour de la
//    géographie.
// ② `fondu = 3 000` ⇒ le liseré disparaît (capture `essai-fondu3000/`), **et le
//    critère se perd** : sur 250 tuiles abyssales le striage résiduel remonte
//    de 0,5 à 2,3 m de médiane et **62 tuiles sur 250 repassent au-dessus de
//    5 m**, parce que tout ce qui est entre 1 000 et 3 000 m n'est plus lissé
//    qu'à moitié. Élargir le fondu, c'est acheter la transition avec le défaut.
// ③ ⚡ **CE QUI MARCHE : `force = k · wB`** — voir le corps de `lisseAbysse`.
//    `wB` est la moyenne de boîte des poids, c'est-à-dire **la même porte, mais
//    lue sur le VOISINAGE au lieu du pixel**. Elle monte donc sur la largeur de
//    la fenêtre du filtre, en ESPACE, quelle que soit la raideur du talus — et
//    elle est déjà calculée, donc gratuite. Fondu de nouveau à 500 : le liseré
//    ne revient pas (capture `apres/rodrigues-large.png`) ET le striage
//    retombe à 0,5 m de médiane, 246 tuiles sur 250 sous le critère.
//    ⛔ Le seuil, lui, ne bouge pas d'un mètre : c'est lui, et lui seul, qui
//    garantit qu'aucun haut-fond n'est touché.
//
// `smooth()` (smoothstep) a une dérivée NULLE aux deux bouts : la transition
// est C¹ par construction, pas par réglage. Mesurée : rapport-LISS §④.
//
// ──────────────────────────────────────── LE RAYON — UNE LONGUEUR AU SOL
//
// ⛔ PAS UN RAYON EN PIXELS. Une tuile z8 porte 575 m de maille à Rodrigues, une
// tuile z4 en porte 9 210 : le même rayon en pixels lisserait 2,9 km ici et
// 46 km là. Or les niveaux GROSSIERS n'ont PAS le défaut — ils sont déjà
// moyennés par le tuileur, et B6 a mesuré que le Catmull-Rom du surzoom leur
// retire encore l'essentiel (pic-à-pic divisé par 30 à 200 après ×32). Le
// peigne vient des tuiles servies NATIVEMENT. Un rayon exprimé en MÈTRES AU SOL
// se convertit donc en 5 px sur une tuile z8, en 1 px sur une z6, et en **0 px
// sur une z4** : la règle s'éteint d'elle-même là où elle nuirait.
//
// La VALEUR, elle, est dérivée du critère et pas de l'esthétique — c'est la plus
// petite qui passe sous 5 m de pic-à-pic bande-à-bande sur les quatre tuiles
// abyssales mesurées (scripts/liss-striage.mjs, fenêtre 128² entièrement sous
// −1 000 m, projection sur chaque axe puis écart d'une bande à la moyenne de ses
// deux voisines) :
//
//   tuile                brut X/Y     r=3×2      r=4×2      **r=5×2**   r=6×2
//   z8 173/142 (−3 059)   8,5/ 7,9   1,0/1,5    0,8/1,1    0,6/0,9    0,5/0,8
//   z8 172/142 (−3 905)  28,8/36,8   3,8/7,7    2,9/5,7    2,0/4,5    1,4/3,6
//   z8 171/142 (−4 067)  42,1/18,7   4,3/3,9    3,0/2,9    1,8/2,3    1,3/1,9
//   z6  43/35  (−3 451)  48,0/31,7   4,1/6,2    3,0/3,7    2,0/2,4    1,6/1,9
//
// r=4×2 laisse 5,7 m ; r=5×2 passe partout. 5 px × 575 m = **2 900 m**.
//
// ⚠️ DEUX PASSES, ET C'EST MESURÉ AUSSI. Une boîte seule est un mauvais
// passe-bas : son premier lobe secondaire laisse ~22 % du signal (r=2×1 rend
// encore 9,1/12,0 là où r=2×2 rend 6,2/8,1). Deux boîtes valent un filtre
// triangulaire, dont les lobes sont au carré. Le coût reste O(1) par pixel.
//
// ⛔ ET UN RAYON PLANCHER DE 3 PIXELS, QUI EST UN REFUS DE LISSER.
// En dessous, la boîte n'est plus un passe-bas, c'est une moyenne de trois
// cases : elle retire du relief RÉEL sans atteindre le critère. Mesuré sur la
// tuile z6 43/35, où le rayon au sol ne vaut qu'1 px : le striage tombe de
// 48,0 à 14,2 m — encore TROIS FOIS le critère — pour un déplacement maximal de
// **1 062 m** et la plus grosse marche latérale de tout le relevé. Le mauvais
// marché, très exactement. À r < 3 on ne lisse donc PAS, et c'est sans
// conséquence sur le peigne : B6 a mesuré que les niveaux grossiers arrivent à
// l'écran par un surzoom ×4 à ×32 dont le Catmull-Rom divise déjà le striage
// par 30 à 200. **Le peigne vient des tuiles servies NATIVEMENT.**
//
// ──────────────────────── ⚠️ CE QUE J'AI CRU PUIS RÉFUTÉ, ET QUI EST DANS LE CODE
//
// ① « Il suffit de réutiliser `smoothSeaFloor` en lui passant `seaLevel: −500`. »
//    Élégant — et FAUX, pour une raison qui ne se voit qu'à la mesure. Son
//    masque est BINAIRE (`v < level` ⇒ poids 1, sinon 0). Au voisinage de
//    l'isobathe, la fenêtre ne contient qu'une poignée de pixels admis, tous du
//    côté profond : la moyenne saute d'un pixel à l'autre. Mesuré sur 1 061
//    tuiles : **2 591 m de marche latérale** du champ de correction. On aurait
//    remplacé le peigne par un liseré le long de l'isobathe 500 — exactement
//    l'artefact contre l'artefact que le brief interdit. D'où le poids CONTINU
//    ci-dessous : le poids d'un pixel dans la moyenne EST sa propre force de
//    lissage `k`, qui vaut 0 à −500 m et monte en smoothstep. Plus de masque,
//    plus de saut : 2 591 → 1 373 m, puis 341 m avec le plancher de rayon.
//
// ② « On borne la correction à ±100 m, et le lissage ne peut plus abîmer une
//    falaise. » ➡️ RÉFUTÉ PAR LA MESURE, et à l'envers : la borne **rallume le
//    striage**. `moyenne − v` n'est pas fait que du striage, il porte surtout la
//    COURBURE locale du fond ; la borne mord donc partout où le relief est
//    marqué, et elle mord de façon IRRÉGULIÈRE — ce qui réinjecte de la haute
//    fréquence. Mesuré : sans borne le striage tombe à 1,8/4,5 m ; borné à
//    100 m il reste à **14,9/21,4 m**, trois fois le critère. La borne a été
//    retirée.
//
// ────────────────────────────────── ⛔ LES TROIS INTERDITS, PAR CONSTRUCTION
//
// Ce ne sont pas des promesses vérifiées après coup : ils tombent de la forme de
// la règle, et c'est ce qui les rend tenables.
//
//  1. **LE TRAIT DE CÔTE NE BOUGE PAS.** Le rivage est décidé par le relief de
//     référence dans `fuseBathymetry` (branche TERRE, en amont de tout), jamais
//     par la source marine — leçon des polders. Et ici on ne touche QUE des
//     pixels de source déjà sous −500 m.
//  2. **LES HAUTS-FONDS ET PLATEAUX RESTENT NETS.** `smoothSeaFloor` saute tout
//     pixel `v >= level` : au-dessus de −500 m, la sortie est l'entrée AU BIT.
//     Lagons, récifs, plateaux continentaux, EMODnet, BlueTopo, swisstopo — tout
//     ce pour quoi la bathymétrie fine a été intégrée vit là, et n'est pas lu.
//  3. **AUCUN PIXEL NE CHANGE DE CÔTÉ.** La moyenne ne porte que sur des pixels
//     eux-mêmes sous −500 m, donc `moyenne < −500` ; la sortie
//     `v + (moyenne − v)·k` avec `k ∈ [0,1]` est entre deux valeurs sous
//     −500 m, donc sous −500 m. **Un pixel lissé ne peut pas remonter à zéro,
//     ni s'en approcher à moins de 500 m.** C'est une PREUVE, pas un relevé.
//
// ⚠️ OÙ C'EST BRANCHÉ, ET POURQUOI PAS AILLEURS. Le brief laissait trois
// endroits : la cuisson (permanent, mais il faut tout recuire, et la
// bathymétrie sur disque est une jonction partagée), la FUSION (CPU, à chaque
// tuile — c'est là que `smoothSeaFloor` a déjà coûté 84 ms par bloc et s'est
// fait retirer, voir src/dem.js), ou le RENDU. Aucun des trois : c'est branché
// au **DÉCODAGE DE LA TUILE SOURCE** (`loadBathyTile`, src/dem.js), qui est
// MÉMOÏSÉ. Une tuile z8 sert 2 070 fois ; le lissage y coûte donc une fois ce
// que la fusion aurait coûté deux mille fois. ⚡ Et surtout : les TROIS sites de
// fusion (`dem.js`, `flux-terrain.js`, `globe.js:fondMarinTuile`) passent tous
// par `peindreBathyTuile`, donc par `loadBathyTile`. Un seul point de pose, et
// les trois sites en héritent — ce que le brief exigeait et qu'aucun correctif
// posé à un seul site n'avait tenu ici.

/** = |SHELF| du tuileur. Voir l'encart ci-dessus : c'est LA dérivation. */
export const ABYSSE_M = 500
/**
 * Le fondu, en mètres de profondeur au-delà du seuil.
 * ⚠️ Il ne suffit PAS à rendre la transition invisible — c'est `k · wB` qui le
 * fait, en espace. Voir l'encart, ① à ③ : l'élargir a été essayé, mesuré, et
 * refusé (il rachète la transition en perdant le critère).
 */
export const ABYSSE_FONDU_M = 500
/** Rayon du lissage, EN MÈTRES AU SOL (jamais en pixels). Voir l'encart. */
export const RAYON_ABYSSE_M = 2900
/** Deux boîtes valent un filtre triangulaire — les lobes secondaires au carré. */
export const PASSES_ABYSSE = 2
/** ⛔ En dessous, on REFUSE de lisser. Voir l'encart : c'est un mauvais marché. */
export const RAYON_ABYSSE_MIN_PX = 3

/**
 * Le rayon en pixels de tuile, pour une maille au sol donnée.
 * ⚠️ Rend 0 — donc « ne rien faire » — dès que la maille est trop grosse pour
 * que le rayon demandé fasse plus de `RAYON_ABYSSE_MIN_PX` pixels : c'est ce
 * qui éteint la règle sur les niveaux de repli grossiers. Une maille non finie
 * ou nulle rend 0 : un appelant qui ne sait pas mesurer son échelle garde le
 * comportement d'avant, AU BIT.
 * @param {number} mailleM - maille au sol d'un pixel de la tuile (m)
 * @param {number} [rayonM]
 */
export function rayonAbyssePx(mailleM, rayonM = RAYON_ABYSSE_M) {
  if (!Number.isFinite(mailleM) || mailleM <= 0 || !Number.isFinite(rayonM) || rayonM <= 0) return 0
  const r = Math.floor(rayonM / mailleM)
  return r < RAYON_ABYSSE_MIN_PX ? 0 : r
}

/**
 * LISSE L'ABYSSE d'une tuile bathymétrique carrée, SUR PLACE.
 *
 * ⚡ CONVOLUTION NORMALISÉE À POIDS CONTINU. Le poids d'un pixel dans la moyenne
 * EST sa force de lissage `k = smoothstep((profondeur − seuil) / fondu)` : nul
 * au-dessus de l'isobathe du seuil, plein un fondu plus bas. Il n'y a donc
 * AUCUN masque binaire nulle part, et c'est ce qui interdit la ligne de niveau
 * (voir ① de l'encart ci-dessus, mesuré à 2 591 m de marche avec un masque).
 *
 * ⛔ ET LES TROIS INTERDITS TOMBENT DE LÀ, SANS RELEVÉ :
 *   · `k = 0` au-dessus de −seuil ⇒ un haut-fond sort AU BIT ;
 *   · les poids sont nuls au-dessus de −seuil ⇒ `moyenne < −seuil` ;
 *   · sortie = `v + (moyenne − v)·k`, barycentre de deux valeurs sous −seuil,
 *     donc **sous −seuil** : aucun pixel ne remonte, aucun ne change de côté.
 *
 * @param {Float32Array} data - altitudes en mètres (négatives en mer)
 * @param {number} size - côté de la grille carrée
 * @param {{mailleM?: number, radius?: number, rayonM?: number, seuilM?: number,
 *   fonduM?: number, passes?: number}} [opts]
 *   `mailleM` : maille au sol d'un pixel — c'est l'entrée normale. `radius`
 *   court-circuite la conversion (bancs et tests).
 * @returns {Float32Array} `data`
 */
export function lisseAbysse(data, size, opts = {}) {
  const r = Number.isFinite(opts.radius) ? Math.floor(opts.radius) : rayonAbyssePx(opts.mailleM, opts.rayonM)
  if (!data || r < 1 || !(size >= 3) || data.length !== size * size) return data
  const seuil = Number.isFinite(opts.seuilM) && opts.seuilM > 0 ? opts.seuilM : ABYSSE_M
  const fondu = Math.max(1e-3, Number.isFinite(opts.fonduM) && opts.fonduM > 0 ? opts.fonduM : ABYSSE_FONDU_M)
  const passes = Number.isFinite(opts.passes) && opts.passes >= 1 ? Math.floor(opts.passes) : PASSES_ABYSSE
  const n = size * size
  const val = new Float32Array(n)
  const wgt = new Float32Array(n)
  const k = new Float32Array(n)
  const w = 2 * r + 1
  // flou par boîte séparable en sommes glissantes — O(1) par pixel quel que soit
  // le rayon, comme `smoothSeaFloor`. Le bord est RÉPLIQUÉ (voir §⑤ du rapport :
  // le biais de bord est mesuré, il ne fabrique pas de couture).
  const boxPass = (src, horizontal) => {
    const dst = new Float32Array(n)
    for (let a = 0; a < size; a++) {
      let acc = 0
      const at = (b) => (horizontal ? a * size + b : b * size + a)
      for (let b = -r; b <= r; b++) acc += src[at(Math.min(size - 1, Math.max(0, b)))]
      for (let b = 0; b < size; b++) {
        dst[at(b)] = acc / w
        acc += src[at(Math.min(size - 1, b + r + 1))] - src[at(Math.max(0, b - r))]
      }
    }
    return dst
  }
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      const v = data[i]
      // ⚠️ `-v - seuil` et pas `seuil - v` : `v` est NÉGATIF en mer. Une valeur
      // non finie (case non peinte) rend NaN ⇒ `smooth` la ramène à 0 ⇒ poids
      // nul et pixel intact — pas de NaN qui se propage dans la somme glissante.
      const kk = Number.isFinite(v) ? smooth((-v - seuil) / fondu) : 0
      k[i] = kk
      val[i] = kk > 0 ? v * kk : 0
      wgt[i] = kk > 0 ? kk : 0
    }
    const vB = boxPass(boxPass(val, true), false)
    const wB = boxPass(boxPass(wgt, true), false)
    for (let i = 0; i < n; i++) {
      // ⚡ LA FORCE EST `k · wB`, ET LE SECOND FACTEUR EST GRATUIT.
      //
      // `wB[i]` est déjà le VOISINAGE de `k` (la moyenne de boîte des poids) :
      // c'est donc la même porte, mais ÉTALÉE SUR LE RAYON DU FILTRE au lieu
      // d'être lue au pixel. C'est elle qui tue le liseré du talus — voir ③ de
      // l'encart 🟣 LISS : `k` seul saute de 0 à 1 en UNE cellule au talus,
      // `k · wB` monte sur toute la largeur de la fenêtre, par construction.
      //
      // ⛔ ET LES TROIS INTERDITS TIENNENT TOUJOURS : `k[i] = 0` au-dessus du
      // seuil (le pixel sort au bit), `wB ∈ [0,1]` (donc `k·wB ∈ [0,1]`, la
      // sortie reste le barycentre de deux valeurs sous −seuil).
      if (!(k[i] > 0) || !(wB[i] > 1e-6)) continue
      data[i] += (vB[i] - data[i] * wB[i]) * k[i]
    }
  }
  return data
}

// ══════════════ AGRANDISSEMENT DU FOND MARIN — Catmull-Rom ═══════════════════
//
// POURQUOI ce module contient sa propre interpolation plutôt que de laisser
// `ctx.drawImage` agrandir la tuile : parce que drawImage agrandit en
// BILINÉAIRE, et qu'une surface bilinéaire est continue mais que SA PENTE
// CASSE À CHAQUE BORD DE CELLULE. Or `terrain.js` appelle
// `geo.computeVertexNormals()` sur un maillage qui monte à 1024 segments : la
// cassure est intégralement résolue, et l'éclairage la révèle comme une grille
// de carrés de 464 m — les « gros blocs » de la baie de Tokyo.
//
// Mesuré sur la vraie tuile 8/227/101 (baie de Tokyo), 48×48 cellules :
//
//   bilinéaire                        saut de pente 3,825 m/cellule (max 57,0)
//   Catmull-Rom libre                               0,003 m/cellule (max  0,05)
//   Catmull-Rom + bride rivage (retenu)             0,006 m/cellule (max  1,26)
//   Catmull-Rom + clamp 2×2 complet (écarté)        0,296 m/cellule (max 17,86)
//
// Soit 640× moins de cassure, pour ZÉRO octet transféré et ZÉRO source nouvelle.
//
// 🔴 ET IL Y AVAIT PIRE QUE LA PENTE : `drawImage` INTERPOLE DES OCTETS.
//
// L'encodage terrarium vaut R·256 + V + B/256 − 32768. Le canal R pèse donc
// 256 MÈTRES par unité, et un canevas ne stocke que des entiers 8 bits : un
// demi-LSB d'arrondi sur R, et l'altitude saute de 128 m. Agrandir la tuile
// AVANT de la décoder, c'était interpoler l'ENCODAGE au lieu de l'altitude.
//
// Mesuré : entre 0 m et −1 m, le milieu interpolé en octets rend +128,00 m au
// lieu de −0,50 m. L'erreur est maximale à chaque multiple de 256 m — et le
// premier d'entre eux est ZÉRO, c'est-à-dire LE TRAIT DE CÔTE. Sur toutes les
// paires de profondeurs de 0 à −120 m, 0,8 % des points interpolés se trompaient
// de plus d'un mètre.
//
// À l'écran, dans la baie de Tokyo à z12 : 21 388 pixels du bloc (1,2 %)
// portaient des profondeurs allant jusqu'à −247 m dans une baie qui en fait 48.
// Et comme la palette de relief s'étale sur [min, max], ces faux gouffres
// écrasaient la rampe de couleurs de TOUTE la baie, qui rendait délavée.
// Après correction, le bloc tient dans [−47,8 ; +48,4], ce que GEBCO décrit.
//
// D'où la règle : ON DÉCODE EN MÈTRES, PUIS ON INTERPOLE. Jamais l'inverse.
//
// ⚠️ LE CLAMP « ANTI-RINGING » CLASSIQUE EST UN PIÈGE ICI. Brider la sortie à
// la plage du voisinage 2×2 — la recette habituelle des redimensionneurs
// d'images — mord sur 3,6 % des pixels et REND au champ 100× de cassure de
// pente. On ne garde donc que la bride STRICTEMENT nécessaire : celle du
// rivage, ci-dessous.

const clampIdx = (i, n) => (i < 0 ? 0 : i >= n ? n - 1 : i)

// Catmull-Rom uniforme sur 4 points, évaluée en t ∈ [0,1] entre p1 et p2.
// C¹ par construction : c'est exactement ce qui manquait au bilinéaire.
const cr4 = (p0, p1, p2, p3, t) => {
  const a = 0.5 * (3 * (p1 - p2) + p3 - p0)
  const b = 0.5 * (2 * p0 - 5 * p1 + 4 * p2 - p3)
  const c = 0.5 * (p2 - p0)
  return ((a * t + b) * t + c) * t + p1
}

// les 4 poids de base, écrits dans `out[o..o+3]`. Leur somme vaut 1 pour tout
// t : un champ constant reste donc rigoureusement constant.
const poids4 = (out, o, t) => {
  const t2 = t * t
  const t3 = t2 * t
  out[o] = -0.5 * t3 + t2 - 0.5 * t
  out[o + 1] = 1.5 * t3 - 2.5 * t2 + 1
  out[o + 2] = -1.5 * t3 + 2 * t2 + 0.5 * t
  out[o + 3] = 0.5 * t3 - 0.5 * t2
}

/**
 * LA BRIDE DU RIVAGE — la seule contrainte qu'on impose au dépassement.
 *
 * ⚠️ Catmull-Rom DÉPASSE par construction, contrairement au bilinéaire. Sans
 * garde-fou, ce dépassement peut traverser le niveau de la mer, et là il ne
 * produit pas une erreur de quelques centimètres mais un CHANGEMENT DE NATURE :
 *
 *  · un échantillon marin qui ressort ≥ niveau est lu par `fuseBathymetry`
 *    comme une ABSENCE de mesure (la source aplatit la terre à 0). Le pixel
 *    retombe alors sur le terrarium, qui près des côtes est un remplissage à
 *    zéro : c'est le « fond plat à zéro » de Santorin et Toulon, en trou
 *    d'épingle ;
 *  · un échantillon terrestre qui ressort < niveau creuse au contraire un trou
 *    d'eau au milieu d'un estran, là où le terrarium est muet.
 *
 * Mesuré sur la tuile 8/227/101, 1 048 576 sondes : 9 dépassements du premier
 * type et 3 705 du second, jusqu'à 3,75 m d'amplitude. Ce n'est pas théorique.
 *
 * La règle est donc MINIMALE, et c'est ce qui la rend gratuite : le résultat ne
 * peut pas traverser le niveau CONTRE LE VERDICT UNANIME de ses 4 voisins. Là
 * où le voisinage est franchement en mer — l'immense majorité des pixels — elle
 * ne mord jamais, et le champ garde sa continuité C¹ intacte.
 *
 * Elle ne PEUT PAS déplacer un trait de côte : le rivage est décidé par le
 * relief de référence dans `fuseBathymetry`, pas ici. Elle empêche seulement la
 * source marine de mentir sur sa propre nature.
 */
const brideRivage = (v, a, b, c, d, level) => {
  const hi = a > b ? (a > c ? (a > d ? a : d) : c > d ? c : d) : b > c ? (b > d ? b : d) : c > d ? c : d
  if (hi < level) return v >= level ? hi : v
  const lo = a < b ? (a < c ? (a < d ? a : d) : c < d ? c : d) : b < c ? (b < d ? b : d) : c < d ? c : d
  if (lo >= level) return v < level ? lo : v
  return v
}

/**
 * Échantillonne une grille d'altitudes en coordonnées de CELLULE fractionnaires.
 *
 * Le bord du tableau est RÉPLIQUÉ (pas de lecture hors limites, jamais de NaN
 * introduit) : une tuile ne connaît pas ses voisines, et répliquer son bord est
 * ce que faisait déjà `drawImage`.
 *
 * @param {Float32Array} src - grille source, `w × h`, en mètres
 * @param {number} w
 * @param {number} h
 * @param {number} x - abscisse en cellules source (0 = centre du premier pixel)
 * @param {number} y
 * @param {{seaLevel?: number}} [opts]
 * @returns {number} mètres
 */
export function sampleCatmullRom(src, w, h, x, y, opts = {}) {
  const level = opts.seaLevel ?? 0
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const ix0 = clampIdx(x0 - 1, w), ix1 = clampIdx(x0, w)
  const ix2 = clampIdx(x0 + 1, w), ix3 = clampIdx(x0 + 2, w)
  const fx = x - x0
  const ligne = (j) => {
    const r = clampIdx(y0 + j, h) * w
    return cr4(src[r + ix0], src[r + ix1], src[r + ix2], src[r + ix3], fx)
  }
  const v = cr4(ligne(-1), ligne(0), ligne(1), ligne(2), y - y0)
  const ra = clampIdx(y0, h) * w
  const rb = clampIdx(y0 + 1, h) * w
  return brideRivage(v, src[ra + ix1], src[ra + ix2], src[rb + ix1], src[rb + ix2], level)
}

/**
 * AGRANDIT une sous-fenêtre de `src` dans un rectangle de `dst`.
 *
 * C'est le remplaçant direct de `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw,
 * dh)` pour le champ bathymétrique — même géométrie (centres de pixels alignés),
 * mais en Catmull-Rom et en mètres plutôt qu'en octets RVB.
 *
 * ⚠️ ET IL LIT LA TUILE ENTIÈRE, PAS SEULEMENT LA SOUS-FENÊTRE. `drawImage`
 * coupait le voisinage au bord du rectangle source : deux cases voisines
 * servies par le MÊME ancêtre interpolaient chacune comme si le monde s'arrêtait
 * à leur bord, ce qui laissait une couture à chaque frontière de case. Ici les
 * voisins hors sous-fenêtre sont de la vraie donnée, et la couture disparaît.
 *
 * Séparable en deux passes (4 taps + 4 taps au lieu de 16), avec les poids de
 * colonne précalculés une seule fois : le coût est celui d'un flou séparable,
 * pas celui d'une convolution 4×4.
 *
 * @param {object} o
 * @param {Float32Array} o.src
 * @param {number} o.srcW
 * @param {number} o.srcH
 * @param {number} [o.sx] @param {number} [o.sy] - coin de la sous-fenêtre source
 * @param {number} [o.sw] @param {number} [o.sh] - taille de la sous-fenêtre source
 * @param {Float32Array} o.dst
 * @param {number} o.dstStride - largeur de la grille de destination
 * @param {number} [o.dx] @param {number} [o.dy] - coin du rectangle destination
 * @param {number} o.dw @param {number} o.dh - taille du rectangle destination
 * @param {number} [o.seaLevel]
 * @returns {Float32Array} `dst`
 */
export function resampleCatmullRom(o) {
  const { src, srcW, srcH, dst, dstStride } = o
  const sx = o.sx ?? 0, sy = o.sy ?? 0
  const sw = o.sw ?? srcW, sh = o.sh ?? srcH
  const dx = o.dx ?? 0, dy = o.dy ?? 0
  const dw = o.dw, dh = o.dh
  const level = o.seaLevel ?? 0
  if (!src || !dst || dw < 1 || dh < 1) return dst
  const kx = sw / dw, ky = sh / dh

  // --- colonnes : indices et poids, calculés UNE fois pour toute la dalle ----
  const colI = new Int32Array(dw * 4)
  const colW = new Float32Array(dw * 4)
  const colA = new Int32Array(dw) // index clampé de x0   (pour la bride)
  const colB = new Int32Array(dw) // index clampé de x0+1 (pour la bride)
  for (let i = 0; i < dw; i++) {
    // centre du pixel de destination ramené en coordonnées de cellule source —
    // exactement le repère de drawImage, d'où l'aller-retour ±0,5
    const x = sx + (i + 0.5) * kx - 0.5
    const x0 = Math.floor(x)
    const o4 = i * 4
    colI[o4] = clampIdx(x0 - 1, srcW)
    colI[o4 + 1] = colA[i] = clampIdx(x0, srcW)
    colI[o4 + 2] = colB[i] = clampIdx(x0 + 1, srcW)
    colI[o4 + 3] = clampIdx(x0 + 2, srcW)
    poids4(colW, o4, x - x0)
  }

  // --- passe HORIZONTALE, sur la seule bande de lignes réellement lue -------
  const rTop = clampIdx(Math.floor(sy + 0.5 * ky - 0.5) - 1, srcH)
  const rBot = clampIdx(Math.floor(sy + (dh - 0.5) * ky - 0.5) + 2, srcH)
  const nR = rBot - rTop + 1
  const bande = new Float32Array(nR * dw)
  for (let r = 0; r < nR; r++) {
    const so = (rTop + r) * srcW
    const bo = r * dw
    for (let i = 0; i < dw; i++) {
      const o4 = i * 4
      bande[bo + i] =
        colW[o4] * src[so + colI[o4]] +
        colW[o4 + 1] * src[so + colI[o4 + 1]] +
        colW[o4 + 2] * src[so + colI[o4 + 2]] +
        colW[o4 + 3] * src[so + colI[o4 + 3]]
    }
  }

  // --- passe VERTICALE, puis bride du rivage --------------------------------
  const w4 = new Float32Array(4)
  for (let j = 0; j < dh; j++) {
    const y = sy + (j + 0.5) * ky - 0.5
    const y0 = Math.floor(y)
    poids4(w4, 0, y - y0)
    const b0 = (clampIdx(y0 - 1, srcH) - rTop) * dw
    const b1 = (clampIdx(y0, srcH) - rTop) * dw
    const b2 = (clampIdx(y0 + 1, srcH) - rTop) * dw
    const b3 = (clampIdx(y0 + 2, srcH) - rTop) * dw
    const ra = clampIdx(y0, srcH) * srcW
    const rb = clampIdx(y0 + 1, srcH) * srcW
    const oD = (dy + j) * dstStride + dx
    for (let i = 0; i < dw; i++) {
      const v = w4[0] * bande[b0 + i] + w4[1] * bande[b1 + i] + w4[2] * bande[b2 + i] + w4[3] * bande[b3 + i]
      const a = colA[i], b = colB[i]
      dst[oD + i] = brideRivage(v, src[ra + a], src[ra + b], src[rb + a], src[rb + b], level)
    }
  }
  return dst
}

/**
 * Décode un bloc RGBA de tuiles terrarium en mètres.
 * meters = R*256 + G + B/256 − 32768 — le même encodage que nos tuiles, ce qui
 * permet de servir la bathymétrie SANS toucher au décodeur du terrain.
 *
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {Float32Array} [into] - tableau à remplir (évite une allocation)
 */
// ⚠️ L'ALPHA EST LA DONNÉE MANQUANTE, et c'est le piège de ce module. Un
// canevas naît en noir TRANSPARENT ; là où aucune tuile n'a été peinte — cas
// NORMAL, puisqu'on n'écrit pas les tuiles sans mer — le triplet (0,0,0) se
// décode en −32768 m, soit « fosse abyssale ». Bug vu à l'écran : la mer Égée
// passait de −4 427 m à −32 768 m de fond. On rend donc NaN sur alpha nul, et
// la fusion l'ignore comme n'importe quelle valeur non finie.
export function decodeTerrarium(rgba, into) {
  const n = rgba.length >> 2
  const out = into && into.length === n ? into : new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] === 0) {
      out[i] = NaN
      continue
    }
    out[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768
  }
  return out
}

/**
 * Encode une altitude en mètres vers le triplet terrarium.
 * Réciproque exacte de `decodeTerrarium` à 1/256 m près — c'est ce que le
 * tuileur écrit dans les PNG.
 *
 * @param {number} m - mètres
 * @returns {[number, number, number]} R, G, B entiers 0-255
 */
export function encodeTerrarium(m) {
  // la plage encodable est [−32768, +32767.996] ; on borne plutôt que de
  // laisser un débordement produire une altitude absurde
  const v = Math.min(32767.99, Math.max(-32768, m)) + 32768
  const r = Math.floor(v / 256)
  const g = Math.floor(v - r * 256)
  const b = Math.round((v - r * 256 - g) * 256)
  // l'arrondi de B peut atteindre 256 : on reporte sur G (et G sur R)
  if (b === 256) return g === 255 ? [r + 1, 0, 0] : [r, g + 1, 0]
  return [r, g, b]
}

/**
 * Quelle tuile de notre jeu bathymétrique couvre la tuile demandée ?
 * Notre jeu s'arrête à `maxZoom` (au-delà, la donnée n'a rien de plus à dire) :
 * une demande plus profonde retombe sur l'ancêtre, avec la sous-fenêtre à y
 * lire. C'est le SURZOOM, et il est honnête : un fond marin à 464 m est lisse
 * par nature, l'interpoler n'invente rien.
 *
 * @returns {{z:number, x:number, y:number, scale:number, ox:number, oy:number}}
 *   scale = combien de fois la tuile ancêtre est plus large ; ox/oy = position
 *   de la sous-fenêtre, en fraction de l'ancêtre (0..1).
 */
export function overzoomTile(z, x, y, maxZoom) {
  if (z <= maxZoom) return { z, x, y, scale: 1, ox: 0, oy: 0 }
  const d = z - maxZoom
  const scale = 2 ** d
  const px = Math.floor(x / scale)
  const py = Math.floor(y / scale)
  return { z: maxZoom, x: px, y: py, scale, ox: (x - px * scale) / scale, oy: (y - py * scale) / scale }
}
