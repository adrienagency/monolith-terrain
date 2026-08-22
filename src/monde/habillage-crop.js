// L'HABILLAGE DU CROP — Tâche C du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE MODULE EST, ET POURQUOI IL EST PUR ════════════════════
//
// Décision 6 d'Adrien : « je veux le même rendu que la qualité de rendu des
// tuiles à plat qui vont donc disparaître ». Le nuanceur du globe doit porter ce
// que porte celui du socle. **Quatre postes sont dans le périmètre de cette
// tâche** : courbes de niveau calées sur le local, grain, masque de côte,
// occupation du sol. La rampe est la Tâche D, la mer la Tâche F, les étiquettes
// ne sont pas du nuanceur.
//
// Comme `crop-sphere.js` et `parois-crop.js` avant lui, ce fichier ne connaît ni
// three ni le DOM : **la loi se vérifie sous node**, et le nuanceur en est la
// TRANSCRIPTION, vérifiée comme texte par `test/crop-habillage.test.js`.
//
// ══════════ LE FAIT QUI REND TOUT CECI POSSIBLE, ET IL EST DÉMONTRÉ ═════════
//
// Les champs cuits du socle (masque de côte, masque de mer, analyse) sont lus
// par `terrain.js` en **UV DE BLOC** :
//
//     cmUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5
//
// et hors mode continu `uBlockOffset = (0,0)`, `uFenetre = (0,0)` et
// `uMaskSpan = 2 · uSlabHalf = 56`. Donc `cmUv = vWorldPos.xz / 56 + 0.5`.
//
// Or le bloc est une fenêtre MERCATOR alignée sur les tuiles, et `latLonToWorld`
// (`src/geo.js:47`) le dit en toutes lettres :
//
//     x / span = (tx − originTileX) · tpx / size − 0.5
//
// avec `size = tuilesParBloc · tpx`, donc `tpx / size = 1 / tuilesParBloc` ; et
// `empriseSocle` (`seuil-socle.js:337-345`) prend `tuileX(lon, z) −
// tuilesParBloc/2` **sans arrondi**, donc `originTileX + tuilesParBloc/2 =
// cx · 2^z`. Il vient
//
//     x / span = (mercX − cx) · 2^z / tuilesParBloc = (mercX − cx) / (2 · demi)
//              = u / 2
//
// c'est-à-dire **`x = 28 · u` et `z = 28 · v`**, où (u, v) sont exactement les
// coordonnées locales que `localCrop` rend dans [−1, 1]. Le globe lit donc les
// champs du socle **au même texel, sans facteur d'ajustement** :
//
//     cmUv = q · 0,5 + 0,5
//
// ⚠️ **CE N'EST PAS UNE COÏNCIDENCE HEUREUSE, C'EST LA RAISON D'ÊTRE DE LA
// TÂCHE** : si les deux lectures divergeaient d'un texel, le trait de côte du
// globe ne tomberait pas sur celui du socle, et « une seule Terre » redeviendrait
// « deux Terres qui se ressemblent ». `test/crop-habillage.test.js` rejoue cette
// égalité contre `latLonToWorld` DU DÉPÔT, qui sert d'oracle indépendant.

// ══════════ ⓪ L'HABILLAGE ÉTEINT — ce que le globe peint sans crop ══════════

/**
 * Les réglages du globe SANS habillage — ceux d'avant la Tâche C.
 *
 * ⚠️ **AJOUTÉE AU TOUR 1, ET ELLE RÉPARE UN VRAI DÉFAUT.** `uContourInterval` et
 * `uContourOpacity` sont des uniformes **PARTAGÉS** par toutes les tuiles, et le
 * bloc des courbes les lit **SANS GARDE** : `uHabOn` à 0 ne les neutralise pas.
 * `poserHabillage` les écrasait, `retirerHabillage` ne les remettait pas —
 * **après un `retirerCrop`, la planète entière gardait l'intervalle du crop**
 * (250 m à La Réunion au lieu de 500). La docstring promettait « au bit près ».
 *
 * ⚠️ **UNE SEULE ÉCRITURE, LUE DES DEUX CÔTÉS** — c'est `RAMPE_MONDE` de la
 * Tâche D, repris tel quel : le constructeur du globe pose ces valeurs, et
 * `retirerHabillage` les rend. Deux littéraux jumeaux auraient divergé en
 * silence (§1 de `/threejs-optimisation`, question 2), et c'est exactement ce
 * qui venait de se produire.
 */
export const HABILLAGE_MONDE = Object.freeze({
  contourIntervalM: 500,
  contourOpacite: 0.55,
  contourPoids: 0.7,
  grainForceM: 0,
  grainEchelle: 96,
  solOpacite: 1,
  margeCoteM: 0,
})

// ══════════ ① LES CHAMPS CUITS — masque de côte, masque de mer, analyse ═════

/**
 * (u, v) locaux du crop, dans [−1, 1] → UV du champ cuit du socle, dans [0, 1].
 *
 * ⚠️ **AUCUN RETOURNEMENT EN Y, ET C'EST UNE DÉCISION, PAS UN OUBLI.**
 * `terrain.js` lit `uCoastMask` / `uSeaMask` / `uAnalysis` en `vWorldPos.xz`
 * DIRECT. Le retournement (`uv.y = 1 − uv.y`) n'existe QUE dans `uvSolDrape`,
 * pour les couches en tuiles Web Mercator dont les lignes vont nord→sud.
 * Retourner ici mettrait la mer sur les crêtes — et rien ne lèverait d'erreur.
 *
 * @param {number} u
 * @param {number} v
 * @returns {{x:number, y:number}}
 */
export function uvChampCrop(u, v) {
  return { x: u * 0.5 + 0.5, y: v * 0.5 + 0.5 }
}

/**
 * (u, v) locaux du crop → UV des couches DRAPÉES (occupation du sol, canopée,
 * photo aérienne) : c'est `uvSolDrape` de `terrain.js`, transcrit.
 *
 * ⚠️ **LE RETOURNEMENT EN Y EST OBLIGATOIRE ICI, ET LUI SEUL LE PORTE** — voir
 * `uvSolDrape` : « les lignes de texture vont nord→sud, le +Z du monde va
 * sud→nord ».
 *
 * ⚠️ **LA BANDE DE BORD (`bordIn`) DE `uvSolDrape` N'EST PAS PORTÉE, ET C'EST
 * MESURÉ, PAS OMIS** : elle vaut `mix(1, edge, cont)` avec
 * `cont = step(uSlabHalf·2 + 1, uMaskSpan)`, donc **exactement 1 hors mode
 * continu** — et le crop n'est jamais en mode continu (`FLAGS.fenetreContinue`
 * est faux, le damier est hors périmètre du plan). La porter aurait ajouté
 * quatre `smoothstep` par fragment pour multiplier par un.
 */
export function uvDrapeCrop(u, v) {
  return { x: u * 0.5 + 0.5, y: 1 - (v * 0.5 + 0.5) }
}

// ══════════ ② LE MASQUE DE CÔTE — qui décide de la mer ══════════════════════

/**
 * La marge d'autorité du masque de côte, en UNITÉS DE SCÈNE — la valeur du
 * socle, `terrain.js` : `landness < 0.5 && vWorldPos.y < uSeaY + 0.02`.
 */
export const MARGE_COTE_UNITES = 0.02

/**
 * `BASE_EXAG` de `main.js:3305`, recopié ici.
 *
 * ⚠️ **UNE CONSTANTE RECOPIÉE FINIT PAR DIVERGER — c'est la question 2 du §1 de
 * `/threejs-optimisation`.** On ne peut pas l'importer : `main.js` n'exporte
 * rien et n'est chargé par aucun test ; l'importer depuis `terrain.js` ferait un
 * cycle `globe → terrain → geo → terrain`. La parade est donc un test :
 * `test/crop-habillage.test.js` LIT `main.js` et échoue si les deux valeurs
 * cessent d'être égales.
 */
export const EXAG_SOCLE_NOMINALE = 2.8

/**
 * La marge d'autorité du masque de côte, EN MÈTRES BRUTS.
 *
 * ⚠️ **CE NOMBRE N'EST PAS CHOISI, IL EST CONVERTI.** Le 0,02 du socle est en
 * unités de scène, et le socle les obtient d'un relief DÉJÀ EXAGÉRÉ. Le globe,
 * lui, tient sa hauteur en mètres bruts (`decodeMetersAA`). La conversion est
 *
 *     marge_m = 0,02 · (mètres par unité) / exagération
 *
 * et rien d'autre. Recopier « 0.02 » côté globe aurait donné **deux
 * centimètres** — une marge cinquante fois trop courte, donc un liseré de terre
 * sur chaque lagune et chaque estuaire.
 */
export function margeCoteM(metresParUnite, exageration = EXAG_SOCLE_NOMINALE) {
  return unitesEnMetres(MARGE_COTE_UNITES, metresParUnite, exageration)
}

/**
 * Une longueur en UNITÉS DE SCÈNE du socle → la même longueur en MÈTRES BRUTS.
 *
 * ⚠️ **AJOUTÉE PAR LA TÂCHE D, ET ELLE NE REMPLACE RIEN** — c'est la règle des
 * listes du §0 : « on élargit une liste, on ne la remplace jamais ». La
 * conversion était déjà écrite, à l'intérieur de `margeCoteM` ; la Tâche D en a
 * besoin pour un SECOND nombre (le plancher d'amplitude `1e-4` de
 * `terrain.js:1016`). On la sort donc, et `margeCoteM` l'appelle — **son
 * comportement est inchangé au bit près, et `test/crop-habillage.test.js` le
 * tient déjà** (④, la marge convertie et non recopiée).
 *
 * ⚠️ **LE `/ exagération` N'EST PAS DÉCORATIF** : les unités de scène du socle
 * mesurent un relief DÉJÀ exagéré, les mètres du globe sont bruts. L'oublier
 * gonflerait chaque longueur du facteur d'exagération — 2,8 côté socle, 18 côté
 * globe.
 */
export function unitesEnMetres(unites, metresParUnite, exageration = EXAG_SOCLE_NOMINALE) {
  const x = Number(unites)
  const m = Number(metresParUnite)
  const k = Number(exageration)
  if (!Number.isFinite(x) || !Number.isFinite(m) || !Number.isFinite(k) || k <= 0) {
    throw new TypeError('unitesEnMetres : unités et mètres par unité finis, exagération finie et > 0')
  }
  return (x * m) / k
}

/** La circonférence équatoriale Web-Mercator, en mètres (celle des tuiles). */
export const CIRCONFERENCE_M = 40075016.686

/** Le côté du bloc, en unités de scène — `TERRAIN_SIZE` de `terrain.js`. */
export const COTE_CROP_UNITES = 56

/**
 * La largeur au sol du crop, en mètres, d'après son seul repère.
 *
 * ⚠️ **LE `cos(lat)` N'EST PAS DÉCORATIF.** En Web-Mercator une largeur en
 * mercator est une largeur en mètres SEULEMENT à l'équateur : à 60° de latitude
 * elle vaut la moitié. Sans lui, la marge de côte d'un crop islandais serait
 * deux fois trop grande.
 */
export function largeurCropM(repere) {
  const demi = Number(repere?.demi)
  const cy = Number(repere?.cy)
  if (!Number.isFinite(demi) || !Number.isFinite(cy)) {
    throw new TypeError('largeurCropM : le repère doit porter `demi` et `cy` finis')
  }
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180) / Math.PI
  return 2 * demi * CIRCONFERENCE_M * Math.cos((lat * Math.PI) / 180)
}

/** La marge de côte, en mètres, pour un crop donné. */
export function margeCoteDuCrop(repere, exageration = EXAG_SOCLE_NOMINALE) {
  return margeCoteM(largeurCropM(repere) / COTE_CROP_UNITES, exageration)
}

/**
 * Ce fragment est-il sous l'eau ? — la loi du socle (`COTE_AUTORITE_GLSL`),
 * transcrite en mètres.
 *
 * ⚠️ **LE MASQUE DÉCIDE, LA HAUTEUR NE FAIT QUE L'EMPÊCHER DE MENTIR.** C'est le
 * correctif v42 de `terrain.js` : « le masque côtier ne peut JAMAIS déclarer
 * sous-marine une terre au-dessus du niveau de la mer » — la rampe océan se
 * peignait sur des montagnes quand le masque était faux (retour Adrien).
 *
 * ⚠️ **ET SANS MASQUE, ON RETOMBE EXACTEMENT SUR LE PRÉDICAT DU GLOBE
 * D'AUJOURD'HUI (`h < 0`), PAS SUR UN TROISIÈME COMPORTEMENT.** Un poste éteint
 * doit rendre l'image d'avant, sinon la mutation qui l'éteint ne prouve rien.
 *
 * ══════════ `zeroSousEau` — TÂCHE K bis, ET IL EST À `false` PAR DÉFAUT ══════
 *
 * ⛔ **`h == 0` PRENAIT LA BRANCHE TERRE, ET C'EST LE GRAND APLAT VERT.** Zéro
 * est la hauteur la PLUS FRÉQUENTE du globe — c'est la surface de la mer. Avec
 * `h < 0`, elle rend `t = 0,35` exactement, c'est-à-dire le premier texel de
 * TERRE de `uRamp` : relevé dans l'application vivante, texel 179 sur 512,
 * `rgb(147, 160, 116)`, un olive vert. Et le fragment d'à côté, à `h = −1 m`,
 * passe par la rampe NAUTIQUE et rend un bleu pâle. **Un mètre d'écart, deux
 * familles de couleur.**
 *
 * ⚠️ **AVEC LE MASQUE ACTIF, RIEN NE CHANGE, ET CE N'EST PAS UN OUBLI** : la
 * branche du masque compare déjà `hM < margeM` avec `margeM > 0`, donc `h == 0`
 * y est DÉJÀ sous l'eau quand le masque dit « mer ». Le défaut ne vivait que
 * dans le prédicat de repli.
 */
export function sousEauCrop({ masqueActif, landness, hM, margeM, zeroSousEau = false }) {
  if (!masqueActif) return zeroSousEau ? hM <= 0 : hM < 0
  return landness < 0.5 && hM < margeM
}

// ══════════ ③ LE GRAIN — et il appartient AU SOL, pas à l'écran ═════════════

/**
 * Le bruit de valeur du dépôt — `mnHash` / `mnNoise` de `terrain.js:459`, mot
 * pour mot, en JS.
 *
 * ⚠️ **CE N'EST PAS UNE SECONDE LOI DE BRUIT, ET C'EST TOUT L'ENJEU.** Deux
 * formules jumelles finissent par diverger, et `terrain.js` en porte déjà la
 * cicatrice (« Deux écritures jumelles finiraient par diverger »). Le test
 * rejoue cette fonction contre le TEXTE du nuanceur.
 *
 * ⚠️ **ET CE N'EST PAS LE MÊME BRUIT QUE `detailField`, QUI EST DU SIMPLEX À
 * CINQ OCTAVES.** Le porter tel quel coûterait cinq octaves de simplex PAR
 * FRAGMENT là où le socle les paie par SOMMET, une fois, et les met en cache
 * (`detail-noise.js` : 175 ms pour 1 050 625 sommets). Le grain du crop est donc
 * un bruit de valeur à deux octaves, de même amplitude et de même famille —
 * **une approximation assumée, pas une transcription**, et il faut le dire.
 */
export function bruitValeur(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  let fx = x - ix
  let fy = y - iy
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function hash2(x, y) {
  let px = fract(x * 233.34)
  let py = fract(y * 851.73)
  const d = px * (px + 23.45) + py * (py + 23.45)
  px += d
  py += d
  return fract(px * py)
}

function fract(v) {
  return v - Math.floor(v)
}

/**
 * Le grain du socle, transcrit pour le crop — un déplacement en MÈTRES, à
 * ajouter à la hauteur décodée.
 *
 * ⚠️ **INDEXÉ SUR LE CROP, JAMAIS SUR L'UV DE TUILE NI SUR L'ÉCRAN.** C'est le
 * défaut que `terrain.js` documente deux fois et qu'Adrien a attrapé à l'œil :
 * « évalué en x seul, le grain resterait COLLÉ À L'ÉCRAN pendant que le relief
 * défile » — un moirage immobile sur un paysage en mouvement. Et lu en `vUv`,
 * qui est local à la tuile, il se répéterait à chaque tuile : seize grains au
 * lieu d'un.
 *
 * ⚠️ **ET IL NE MORD QUE SUR LA TERRE.** `terrain.js` module son grain par
 * `landFactor` et le documente : « FADE it out at/below sea level so the
 * displacement can never poke above the waterline and paint phantom islands ».
 * Sans cela le fond marin se couvre d'une rugosité que la bathymétrie ne porte
 * pas, et les courbes bathymétriques se mettent à onduler.
 *
 * Deux octaves, la seconde à 0,35 de la première : c'est la composition
 * de `_makeDemSampler` (`detail·a + detail·0,35·b`), rejouée.
 */
export function grainCrop({ u, v, force, echelle, surTerre = true }) {
  if (!(force > 0) || !surTerre) return 0
  const p = echelle > 0 ? echelle : 1
  const n1 = bruitValeur(u * p, v * p)
  const n2 = bruitValeur(u * p * 2.17 + 19.3, v * p * 2.17 - 7.1)
  return force * ((n1 - 0.5) * 2 + (n2 - 0.5) * 0.7)
}

// ══════════ ④ LES COURBES DE NIVEAU — calées sur le local ═══════════════════

/**
 * Les pas cartographiques admissibles, en mètres.
 *
 * ⚠️ **UN INTERVALLE DE 37 M N'EXISTE SUR AUCUNE CARTE**, et il rendrait la
 * lecture des altitudes impossible : on arrondit donc à un pas lisible.
 */
export const PAS_CARTO = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

/**
 * L'écart entre deux courbes, en mètres, calé sur l'amplitude du crop.
 *
 * ⚠️ **C'EST LA LIGNE « ÉCHELLE » DU §3 DU PLAN, APPLIQUÉE AUX COURBES.** Le
 * globe pose `uContourInterval = 500` en dur, valable pour le monde entier. À
 * l'île Maurice, qui culmine à **800 m**, cela fait **une seule courbe** sur
 * toute l'île — quand le socle en trace une vingtaine. C'est exactement le
 * grief des captures d'Adrien, transposé du dégradé aux lignes.
 *
 * ⚠️ **ET IL EST BORNÉ PAR LE BAS**, sinon un crop plat (amplitude nulle)
 * demanderait un intervalle nul, donc `h / 0`, donc un NaN — et le §« écrêtage
 * de Mercator » de `globe.js` rappelle où mène un NaN dans ce nuanceur : une
 * comparaison FAUSSE, donc un fragment gardé, donc le contraire du but.
 */
export function intervalleCourbes(amplitudeM, courbesVoulues = 20) {
  const a = Number(amplitudeM)
  if (!Number.isFinite(a) || a <= 0) return PAS_CARTO[0]
  const brut = a / Math.max(1, courbesVoulues)
  for (const p of PAS_CARTO) if (p >= brut) return p
  return PAS_CARTO[PAS_CARTO.length - 1]
}
