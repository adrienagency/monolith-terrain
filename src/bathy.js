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

/**
 * Fusionne deux champs d'altitude de MÊME taille, en mètres.
 *
 * @param {Float32Array} land - relief de référence (terrarium). Fait autorité
 *   sur le trait de côte et sur toute la terre émergée.
 * @param {Float32Array|null} sea - bathymétrie fine, alignée pixel à pixel.
 *   `null` ou taille différente ⇒ on rend `land` inchangé (repli sûr).
 * @param {{blendDepth?: number, seaLevel?: number, fillShare?: number}} [opts]
 *   `fillShare` règle la détection des aplats de remplissage (detectFillLevels).
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
    const noData = (l > -NODATA_EPS && l < NODATA_EPS) || remplissage
    // TERRE — intouchable, et c'est elle qui définit le rivage
    if (l >= level && !noData) {
      out[i] = l
      continue
    }
    const s = sea[i]
    if (!Number.isFinite(s)) {
      out[i] = l
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
    if (s >= level) {
      out[i] = l
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
    const base = noData ? level : l
    const t = smooth((level - (noData ? deep : l)) / blend)
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
