// LA RAMPE FIXE — une couleur, une altitude, à toutes les échelles.
//
// Module PUR : ni DOM, ni three.js, ni fetch. Testable en node
// (`test/rampe-fixe.test.js`).
//
// ══════════ LE DÉFAUT, ET CE QU'IL EST VRAIMENT ═════════════════════════════
//
// > **Adrien :** « Je vois toujours une belle carte bien définie qui est
// > recouverte à chaque changement d'échelle par une carte plus colorée en
// > moins bonne définition. »
//
// `rapport-SUR.md` a nommé la cause : la rampe hypsométrique **se re-normalise
// sur le bloc courant** à chaque cran. Le nuanceur (`terrain.js:1009`) écrit
//
//     hNorm = (y − uHeightRange.x) / (uHeightRange.y − uHeightRange.x)
//     rampT = 0,5 + (hNorm − uHeightPivot) × uHeightContrast
//
// et `uHeightRange` est réécrit avec le min/max du MNT chargé.
//
// ⚡ **MAIS LE DOMAINE N'EST QUE LA MOITIÉ DU DÉFAUT, ET C'EST LE POINT QUE CE
// MODULE AJOUTE À SUR.** En composant les deux lignes, la couleur d'une altitude
// `h` ne dépend PAS de `uHeightRange` seul : elle dépend de DEUX GRANDEURS EN
// MÈTRES, et d'elles seules —
//
//     rampT(h) = 0,5 + (h − pivotM) / fenetreM
//     avec  pivotM   = minM + uHeightPivot × (maxM − minM)
//           fenetreM = (maxM − minM) / uHeightContrast
//
// Figer `uHeightRange` sans toucher au reste ne suffirait donc pas :
// `applyAutoShade` **regrade** à chaque chargement (`gradeForDem` sur
// `dem.minM/maxM`), et le pivot repartirait. Mesuré aux Alpes suisses
// (46,0122 / 7,8223), neuf crans, `.banc/RAMP-AVANT/crans.json` :
//
//   | | cran 0 | cran 9 |
//   |---|---|---|
//   | définition du MNT | 26,54 m/texel | **1,66 m/texel** |
//   | amplitude du bloc | 3 930 m | 799 m |
//   | **pivotM** | 2 578,4 m | 2 740,7 m — **étendue 458,9 m** |
//   | **fenetreM** | 1 637,5 m | 380,5 m — **×4,30** |
//
// ⚡ **C'est `fenetreM` qui fait le voile** : la même rampe de huit teintes,
// étalée sur 1 637 m puis sur 380 m, sature quatre fois plus vite. Écart de
// teinte relevé entre deux crans VOISINS : **26,82/255**, étendue de chroma
// **32,95/255** sur les neuf crans.
//
// ══════════ CE QUE CE MODULE POSE — ET CE QU'IL NE POSE PAS ═════════════════
//
// ⛔ **IL NE TOUCHE PAS À `uHeightRange`**, et c'est délibéré. Cet uniforme ne
// sert pas qu'à la couleur : `traffic.js:235` y lit l'altitude du plus haut
// sommet pour poser les avions, et le balayage (`terrain.js:1397`) y prend son
// plan. Le figer sur une référence de couleur ferait voler les avions à
// l'altitude d'une constante de rampe. **On laisse le domaine vivant et on
// corrige les deux réglages qui le traversent.**
//
// La loi posée est donc : `params.heightPivot` et `params.heightContrast` sont
// exprimés dans un **domaine de RÉFÉRENCE stable**, et la conversion vers le
// domaine VIVANT du nuanceur est faite au dernier moment :
//
//     pivotM   = refBasM + pivotRef × refAmpM
//     fenetreM = refAmpM / contrasteRef
//     uHeightPivot    = (pivotM − demBasM) / demAmpM
//     uHeightContrast = demAmpM / fenetreM
//
// ⚠️ **CE N'EST PAS UNE SECONDE LOI.** C'est EXACTEMENT la conversion que
// `gradeBlocEffectif` (`src/monde/rampe-crop.js` §⑨) fait déjà pour le bloc du
// globe — « grader sur le domaine où l'on consomme », direction A de la Tâche
// GRA. Le socle était le dernier régime resté à se regrader sur lui-même.
//
// ══════════ LA RÉFÉRENCE — DÉRIVÉE, PAS COPIÉE ══════════════════════════════
//
// ⛔ **LE GLOBE GARDE `uLandMax = 5 600 m` FIXE ; LE SOCLE NE PEUT PAS.** Le
// brief demandait de vérifier ce plafond avant de le reprendre : il ne convient
// pas, et le calcul le dit. Aux Alpes, le nuage d'altitudes du bloc tient dans
// 3 930 m ; la rampe planétaire `[−6 000 ; 5 600]` en couvre 11 600. Un gabarit
// qui pose `heightPivot: 0,42` viserait alors **−1 128 m** au lieu de 1 344 m,
// et son `heightContrast` devrait être multiplié par 2,95 pour rendre la même
// image. **Un plafond planétaire ne déplace pas la rampe des gabarits, il la
// détruit** — et « l'identité de tous les templates est d'abord une rampe de
// couleur » (SUR). La question « quel plafond ? quel plancher ? et sous la
// mer ? » n'a donc pas de bonne réponse sous cette forme : ⚡ **la référence du
// socle n'est pas une paire d'altitudes planétaires, c'est une EMPRISE
// GÉOGRAPHIQUE.**
//
// La contrainte se lit en trois lignes :
//   ① **invariante par cran** — sinon on n'a rien réparé ;
//   ② **fonction du LIEU** — sinon les gabarits perdent leur identité ;
//   ③ **indépendante du CHEMIN** — le piège nommé par TUILE (35 % de saturation
//      d'écart selon qu'on arrive direct ou par paliers).
//
// Une seule forme les tient toutes les trois : **un carré au sol de côté fixe,
// centré sur la carte**. On grade dessus, pas sur le MNT entier.
export const COTE_REF_M = 40000
// ⚠️ **40 km EST MESURÉ, PAS CHOISI.** C'est l'emprise du MNT au zoom
// D'ARRIVÉE du produit : relevé **40 770 m** à z11 aux Alpes suisses
// (`.banc/RAMP-AVANT/crans.json`, crans 0 à 2), puis 20 385 · 10 192 · 5 096 ·
// 2 548 m aux crans suivants. Deux conséquences, et ce sont les deux qu'on veut :
//
//   · **au zoom d'arrivée et au-dessus**, le carré de 40 km tient dans le MNT :
//     la référence s'y recalcule à l'identique, cran après cran, et **un
//     dézoomage ne la déplace pas non plus** (on ne regarde jamais plus large
//     que 40 km). C'est ce qui distingue ce carré d'un « on garde le premier
//     grade vu » : celui-là serait le chemin, pas le lieu.
//   · **au-delà**, le MNT est plus petit que le carré : il n'y a plus rien à
//     regrader, et la référence tient toute seule.
//
// ⚠️ **ET LE CHIFFRE EST VÉRIFIÉ CONTRE LE RISQUE QU'IL PORTE** : à z11 le carré
// couvre 40 000 / 40 770 = **98,1 %** du MNT, donc le grade de référence n'est
// PAS tout à fait celui d'aujourd'hui. L'écart mesuré est au §« GABARITS » du
// rapport ; il devait tenir sous le critère de 2 niveaux/255, et il le tient.

/**
 * La fenêtre carrée de référence dans un MNT carré de `n` texels de côté
 * couvrant `extentM` mètres.
 *
 * ⚠️ **CENTRÉE, ET ÇA N'EST PAS UN DÉTAIL** : `dem-emprise.js` recolle une
 * emprise 3×3 dont le centre EST le centre de la carte, et `meanM` — le zéro
 * vertical — est déjà celui du centre. La référence doit viser le même point,
 * sinon elle décrirait le voisinage plutôt que le lieu.
 *
 * ⚠️ **RENVOIE LE MNT ENTIER QUAND IL EST PLUS PETIT QUE LE CARRÉ**, sans
 * mentir : le champ `couvre` dit lequel des deux cas on est, et l'appelant s'en
 * sert pour décider s'il a le droit de POSER une nouvelle référence ou
 * seulement de garder celle qu'il a.
 *
 * @param {number} n - côté du MNT en texels
 * @param {number} extentM - largeur au sol du MNT, en mètres
 * @param {number} [coteRefM]
 * @returns {{i0:number, n1:number, couvre:boolean}}
 */
export function fenetreRef(n, extentM, coteRefM = COTE_REF_M) {
  if (!Number.isFinite(n) || n < 1) return { i0: 0, n1: 0, couvre: false }
  if (!Number.isFinite(extentM) || !(extentM > 0)) return { i0: 0, n1: n, couvre: false }
  if (!(extentM > coteRefM)) return { i0: 0, n1: n, couvre: false }
  // ⚠️ `round`, PAS `floor`, et la fenêtre reste centrée **à un texel près** —
  // pas exactement. À 1 536 texels sur 40 770 m, `n1` vaut 1 507 et le reste,
  // 29, est IMPAIR : une marge vaut 15, l'autre 14, soit 26,5 m de décentrage au
  // sol. J'avais écrit « centrée » tout court ; le test l'a corrigé avant le
  // rapport. `floor` doublerait ce biais sans rien gagner.
  const n1 = Math.max(2, Math.round((n * coteRefM) / extentM))
  return { i0: Math.round((n - n1) / 2), n1, couvre: true }
}

/**
 * La fenêtre de référence, RECENTRÉE sur le lieu — Tâche BLA.
 *
 * ⛔ **LE CENTRE DU MNT N'EST PAS LE CENTRE DE LA CARTE, ET L'ÉCART EST
 * MESURÉ.** Le bloc central de l'emprise est ALIGNÉ SUR LES TUILES : relevé
 * dans l'application vivante (Provence 44,2 / 5,78, `scratchpad/sonde-ref.mjs`),
 * le centre du bloc vaut **44,34 / 5,98 à z9** (20 km du lieu), 44,15 / 5,71 à
 * z11 (6 km), 44,198 / 5,779 à z13. Le carré de 40 km « centré » l'était donc
 * sur un point qui BOUGE avec le zoom, et la référence avec lui : **[444 ;
 * 2 103] m à z9 contre [362 ; 1 823] m à z11** — 82 m de plancher et 280 m de
 * plafond, sur le même lieu. C'est la propriété ③ de l'en-tête (« fonction du
 * LIEU ») qui ne tenait qu'à un demi-bloc près.
 *
 * ➡️ On centre le carré sur `dem.lat / dem.lon` — le centre DEMANDÉ, celui de
 * la carte — converti en fraction du MNT par `latLonToWorld` (main.js), et on
 * l'écrête dans le MNT : quand le carré déborde (à z11 il est à 6 km du bord
 * d'un MNT de 42 km), il glisse jusqu'au bord au lieu de sortir. Le décalage
 * résiduel est alors celui du DÉBORD, pas celui de l'alignement des tuiles.
 *
 * @param {{i0:number, n1:number, couvre:boolean}} fen - `fenetreRef(...)`
 * @param {number} n - côté du MNT en texels
 * @param {number} fx - le centre voulu, en fraction du MNT (0,5 = centre du MNT)
 * @param {number} fy
 * @returns {{ix0:number, iy0:number, n1:number, couvre:boolean, glissePx:number}}
 *   `glissePx` : de combien l'écrêtage a fait glisser le carré (0 = il tenait)
 */
export function centrerFenetreRef(fen, n, fx, fy) {
  const { n1, couvre } = fen
  if (!couvre || !Number.isFinite(fx) || !Number.isFinite(fy)) return { ix0: fen.i0, iy0: fen.i0, n1, couvre, glissePx: 0 }
  const borne = (v) => Math.min(Math.max(v, 0), Math.max(n - n1, 0))
  const vx = Math.round(fx * n - n1 / 2)
  const vy = Math.round(fy * n - n1 / 2)
  const ix0 = borne(vx)
  const iy0 = borne(vy)
  return { ix0, iy0, n1, couvre, glissePx: Math.max(Math.abs(ix0 - vx), Math.abs(iy0 - vy)) }
}

/**
 * Les statistiques de la fenêtre de référence : extrema, moyenne, histogramme.
 *
 * ⚠️ **JUMEAU DE `elevationHistogram` (`relief-grade.js`), ET IL NE PEUT PAS
 * L'APPELER** — même raison, dite au même endroit, que
 * `histogrammeDesHauteurs` dans `rampe-crop.js` : celui-là bine `data` ENTIER,
 * or on ne veut QUE la fenêtre centrale. Lui passer le tableau complet
 * compterait tout le voisinage, c'est-à-dire précisément le relief dont on
 * cherche à s'affranchir.
 *
 * ⚠️ **UNE SEULE PASSE, ET ELLE EST PLUS COURTE QUE CELLE D'AUJOURD'HUI.**
 * `currentReliefGrade` bine 1 536² = 2 359 296 texels ; au cran 0 la fenêtre en
 * couvre 1 507² = 2 271 049, soit **96,3 %**, et aux crans suivants elle bine le
 * MNT entier comme avant. Le coût est donc nul ou négatif — mais on ne peut pas
 * réutiliser `dem._elevHist`, qui est celui du MNT entier : le mémo de
 * référence est côté appelant, sur la clé de la fenêtre.
 *
 * @param {ArrayLike<number>} data - `dem.data`, rangée par lignes
 * @param {number} n - côté
 * @param {{i0?:number, ix0?:number, iy0?:number, n1:number}} fen - `i0` pour
 *   une fenêtre centrée (les deux axes), ou `ix0` / `iy0` pour une fenêtre
 *   DÉCALÉE (`centrerFenetreRef`, Tâche BLA)
 * @param {number} [bins]
 */
export function statsFenetre(data, n, { i0, ix0, iy0, n1 }, bins = 256) {
  const x0 = Number.isFinite(ix0) ? ix0 : i0
  const y0 = Number.isFinite(iy0) ? iy0 : i0
  let minM = Infinity
  let maxM = -Infinity
  let somme = 0
  let vus = 0
  for (let j = y0; j < y0 + n1; j++) {
    const base = j * n
    for (let i = x0; i < x0 + n1; i++) {
      const h = data[base + i]
      if (!Number.isFinite(h)) continue
      if (h < minM) minM = h
      if (h > maxM) maxM = h
      somme += h
      vus++
    }
  }
  if (!vus) return null
  const histogram = new Uint32Array(bins)
  const span = maxM - minM
  if (span > 0) {
    const k = bins / span
    for (let j = y0; j < y0 + n1; j++) {
      const base = j * n
      for (let i = x0; i < x0 + n1; i++) {
        const h = data[base + i]
        if (!Number.isFinite(h)) continue
        const b = (h - minM) * k
        histogram[b <= 0 ? 0 : b >= bins ? bins - 1 : b | 0]++
      }
    }
  }
  return { minM, maxM, meanM: somme / vus, histogram, vus }
}

/**
 * La loi de teinte, **en mètres** — les deux seules grandeurs qui décident de
 * la couleur d'une altitude.
 *
 * ⛔ **EN MÈTRES, ET C'EST LA DÉCISION QUI ÉVITE DE REJOUER LE DÉFAUT** — la
 * même que `gradeCrop` (`rampe-crop.js` §⑨) a prise pour le bloc, pour la même
 * raison : un nombre normalisé ne veut rien dire sans son domaine, et le
 * domaine glisse. Un mètre, lui, ne dépend d'aucun domaine.
 */
export function loiEnMetres({ heightPivot, heightContrast }, basM, ampM) {
  return {
    pivotM: basM + heightPivot * ampM,
    fenetreM: ampM / Math.max(heightContrast, 1e-6),
  }
}

/**
 * La loi en mètres, redite dans le domaine VIVANT du nuanceur.
 *
 * ⚠️ **RIEN N'EST BORNÉ ICI, ET C'EST VOULU.** `uHeightPivot` peut sortir de
 * [0 ; 1] : `rampT = 0,5 + (hNorm − pivot) × contraste` reste défini, et le
 * clamper reviendrait à ré-introduire une dérive — au cran 9, un pivot de
 * référence à 2 578 m dans un MNT [2 461 ; 3 260] tombe à 0,15, mais dans un
 * MNT plus haut il sortirait par le bas. **Le nuanceur, lui, s'en moque.** Les
 * bornes de `relief-grade.js` (PIVOT_MIN / CONTRAST_MAX) s'appliquent au grade
 * de RÉFÉRENCE, là où elles ont un sens de réglage, pas à sa transposition.
 *
 * ⚠️ **LE PLANCHER DE PIVOT DU NUANCEUR (`pivotFloor`, terrain.js:1047) N'EST
 * PAS TOUCHÉ** : il se calcule sur `uSeaY` et `uHeightRange`, tous deux restés
 * vivants. Un pivot transposé sous le niveau de la mer y est donc encore
 * remonté, exactement comme avant.
 */
export function versDomaine({ pivotM, fenetreM }, basM, ampM) {
  return {
    heightPivot: (pivotM - basM) / ampM,
    heightContrast: ampM / Math.max(fenetreM, 1e-6),
  }
}

/**
 * Le passage complet : un réglage exprimé dans le domaine de RÉFÉRENCE, rendu
 * dans le domaine VIVANT.
 *
 * ⛔ **`ref === null` REND LE RÉGLAGE TEL QUEL, AU BIT PRÈS.** C'est le chemin
 * du dépôt — l'option de re-normalisation cochée, un banc, un test, un MNT pas
 * encore chargé — et c'est un `Object.is` dans `test/rampe-fixe.test.js`, pas
 * une égalité numérique : `x` et `x` doivent être LE MÊME nombre, sans aller-
 * retour de division qui rendrait 0,48000000000000004.
 *
 * @param {{heightPivot:number, heightContrast:number}} reglage
 * @param {{basM:number, ampM:number}|null} ref - le domaine de référence
 * @param {{basM:number, ampM:number}|null} vivant - le domaine du MNT chargé
 */
export function transpose(reglage, ref, vivant) {
  if (!ref || !vivant) return reglage
  if (!(ref.ampM > 0) || !(vivant.ampM > 0)) return reglage
  // ⚡ **LE MÊME DOMAINE REND LE MÊME NOMBRE, SANS PASSER PAR LES MÈTRES.** Sans
  // ce court-circuit, l'option de re-normalisation ne rendrait pas l'ancien
  // comportement « à l'identique AU BIT » mais « à 1e-16 près » — et le critère
  // du brief dit AU BIT.
  if (ref.basM === vivant.basM && ref.ampM === vivant.ampM) return reglage
  return versDomaine(loiEnMetres(reglage, ref.basM, ref.ampM), vivant.basM, vivant.ampM)
}

// ══════════ LE VOILE ET LA LIMITE DES ARBRES — Tâche BLA ════════════════════
//
// > **Adrien, 2026-09-05 (vidéo 22 h 30) :** le relief est **brun et contrasté
// > à z9–z10, blanc et délavé à z11–z14**, en mode « Naturel ».
//
// ⛔ **LA MÊME CLASSE DE DÉFAUT QUE RAMP, DANS L'AUTRE MODE — ET LA RAMPE FIXE
// NE LA COUVRAIT PAS.** RAMP a transposé `uHeightPivot` et `uHeightContrast`
// vers le domaine vivant. Mais le mode Naturel lit `hNorm` DIRECTEMENT deux
// autres fois (`naturel-crop.js`) :
//
//     fa  = 1 − smoothstep(0, hazeAlt, hNorm)          — le voile d'ALTITUDE
//     veg = 1 − smoothstep(treeLine, treeLine + 0,18, hNorm) — la limite des arbres
//
// et `hNorm` est normalisé sur le domaine VIVANT — `uHeightRange` côté socle,
// `[uReliefBas ; uLandMax]` côté globe, tous deux mesurés sur l'emprise chargée.
// Départage par extinction dans l'application vivante (`scripts/diag-bla-
// extinction.mjs`, Provence 44,2 / 5,78, `.banc/BLA/avant/extinction.json`) :
//
//   | zoom | domaine vivant (m) | éteindre le VOILE | éteindre humidité + expo | limite des arbres à 0,2 |
//   |---|---|---|---|---|
//   | z9  | [19 ; 3 792]  | **Δlum −21,7 · Δchroma +25,1** | −2,0 · +3,1 | −0,4 · +0,6 |
//   | z11 | [358 ; 1 770] | **−9,4 · +5,7** | −2,3 · +2,7 | −2,2 · +2,6 |
//   | z13 | [529 ; 1 614] | **−5,0 · +4,2** | −2,1 · +2,3 | −2,0 · +2,2 |
//
// Le voile est le poste dominant, et sa force dépend du domaine : à 1 000 m,
// `hNorm` vaut 0,26 dans le domaine z9 et 0,43 dans le domaine z13, donc `fa`
// passe de 0,60 à 0,17 **pour le même point du sol** — et à l'inverse, un
// domaine qui s'effondre sur une vallée pousse tout le fond de vallée sous
// `hazeAlt` et le voile le peint en gris-blanc. C'est le blanchiment.
//
// ➡️ **LA CORRECTION EST CELLE DE RAMP, APPLIQUÉE AUX DEUX LECTEURS RESTANTS :**
// `hazeAlt` et `treeLine` sont exprimés dans le domaine de RÉFÉRENCE (le carré
// de 40 km, `COTE_REF_M`), et le nuanceur reçoit une conversion AFFINE de son
// `hNorm` vivant vers ce domaine — `natHNormRef(hNorm, a, b)` :
//
//     h        = basVivant + hNorm × ampVivant                     (mètres)
//     hNormRef = (h − basRef) / ampRef
//              = hNorm × (ampVivant / ampRef) + (basVivant − basRef) / ampRef
//                          ╰────── a ───────╯   ╰────────── b ──────────╯
//
// ⚠️ **LE FACTEUR EST CELUI DES DEUX AMPLITUDES**, et il est chiffré : au lieu
// de la vidéo, `a` vaut 3 772 / 1 465 = **2,58** à z9 et 1 085 / 1 465 =
// **0,74** à z13 (référence = le MNT de 42 km d'arrivée, [358 ; 1 823]).
//
// ⛔ **SANS RÉFÉRENCE, `a = 1` ET `b = 0` — AU BIT.** `hNorm × 1.0 + 0.0` rend
// `hNorm` exactement en virgule flottante IEEE : le chemin du dépôt (option de
// re-normalisation cochée, banc, test, MNT pas encore chargé) est intouché.

/**
 * Les deux coefficients de la conversion affine `hNorm` vivant → `hNorm` de
 * référence (voir l'en-tête de section).
 *
 * @param {{basM:number, ampM:number}|null} ref
 * @param {{basM:number, ampM:number}|null} vivant
 * @returns {{a:number, b:number}} `{1, 0}` — l'identité — dès qu'un domaine
 *   manque, dégénère, ou que les deux sont ÉGAUX (même court-circuit que
 *   `transpose` : même domaine, même nombre, sans division)
 */
export function facteursHNormRef(ref, vivant) {
  if (!ref || !vivant) return { a: 1, b: 0 }
  if (!(ref.ampM > 0) || !(vivant.ampM > 0)) return { a: 1, b: 0 }
  if (ref.basM === vivant.basM && ref.ampM === vivant.ampM) return { a: 1, b: 0 }
  return { a: vivant.ampM / ref.ampM, b: (vivant.basM - ref.basM) / ref.ampM }
}

// ══════════ LA DISTANCE DU VOILE, EN MÈTRES ═════════════════════════════════
//
// `fd` était une distance au centre en DEMI-CÔTÉS de bloc : 1 au bord, que le
// bloc fasse 5 ou 170 km. Le voile de distance atteignait donc la même force
// au bord d'un crop de 10 km qu'au bord d'un crop de 168 km — une brume qui
// n'a pas d'échelle. Le brief demande qu'elle agisse **avec la distance réelle**.
//
// ➡️ `fd = distance_m / DISTANCE_VOILE_M`, écrêtée à 1. **`DISTANCE_VOILE_M =
// 2 × COTE_REF_M = 80 000 m`, et c'est MESURÉ, pas choisi** — trois bornes
// posées dans l'application vivante, même session, même chemin
// (`scripts/diag-bla-distance.mjs`, `.banc/BLA/distance/distance.json`,
// chroma moyenne de la fenêtre centrale, Provence, curseurs de la vidéo) :
//
//   | zoom | demi-crop | D = 20 km | D = 40 km | **D = 80 km** | sans distance | voile éteint |
//   |---|---|---|---|---|---|---|
//   | z9  | 84 km  | 20,4 | 29,8 | **39,0** | 52,0 | 57,7 |
//   | z11 | 21 km  | 22,2 | 26,6 | **28,1** | 29,0 | 28,9 |
//   | z13 | 5,3 km | 26,5 | 26,9 | **27,0** | 27,2 | 25,8 |
//
// ⛔ **20 km GRISAIT LA VUE LARGE** : à z9, tout ce qui est à plus de 20 km du
// centre — 95 % de l'emprise — passait à pleine brume, et la chroma tombait de
// 52 à 20. Or la vue large est précisément la « belle carte bien définie »
// d'Adrien (`m_010`, `m_098`). 80 km est la demi-largeur de l'emprise la plus
// large que le crop atteint (z9, 168 km) : la vue large garde l'image
// d'aujourd'hui (facteur 1,05), et plus on descend, plus le bord du crop est
// près — à z13 il est à 5 km, une distance qui ne voile rien, et c'est ce que
// dit la physique. Ce qui reste alors est le voile d'ALTITUDE, celui que la
// tirette décrit (« les basses terres se voilent de bleu-gris »).
//
// Le nuanceur garde son expression en demi-côtés et la MULTIPLIE par un facteur
// (`uFdFacteur`, 1 par défaut — le dépôt au bit) :
//
//     socle : fd = (d_unités / uSlabHalf) × uFdFacteur,
//             uFdFacteur = (dem.extentMeters / 2) / DISTANCE_VOILE_M  (80 km)
//             ⚠️ **uSlabHalf demi-côté en unités de scène ↔ extentMeters / 2 au
//             sol** (terrain.js:3720 : `scale = TERRAIN_SIZE × empriseCote /
//             extentMeters`, et `uSlabHalf = TERRAIN_SIZE × empriseCote / 2`) —
//             le quotient d / uSlabHalf est déjà sans unité, on ne convertit
//             que la BORNE, pas la distance
//     globe : fd = length(qCrop) × uFdFacteur,  uFdFacteur = uCropDemiM / DISTANCE_VOILE_M
//             ⚠️ **qCrop est en demi-côtés de crop ; uCropDemiM est la demi-largeur
//             au sol en mètres (`largeurCropM / 2`) — l'espace du crop, pas celui
//             du globe (R_GLOBE) ni celui de la caméra d'effets**
export const DISTANCE_VOILE_M = 2 * COTE_REF_M

/**
 * Le facteur qui ramène une distance « en demi-côtés » à une distance en
 * fractions de `DISTANCE_VOILE_M`.
 *
 * @param {number} demiM - la demi-largeur au sol du bloc ou du crop, en mètres
 * @returns {number} `1` quand la demi-largeur n'est pas connue (le dépôt au bit)
 */
export function facteurDistanceVoile(demiM) {
  if (!Number.isFinite(demiM) || !(demiM > 0)) return 1
  return demiM / DISTANCE_VOILE_M
}
