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
 * @param {{i0:number, n1:number}} fen
 * @param {number} [bins]
 */
export function statsFenetre(data, n, { i0, n1 }, bins = 256) {
  let minM = Infinity
  let maxM = -Infinity
  let somme = 0
  let vus = 0
  for (let j = i0; j < i0 + n1; j++) {
    const base = j * n
    for (let i = i0; i < i0 + n1; i++) {
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
    for (let j = i0; j < i0 + n1; j++) {
      const base = j * n
      for (let i = i0; i < i0 + n1; i++) {
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
