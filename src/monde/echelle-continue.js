// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
// (`test/echelle-continue.test.js`). Il n'importe qu'UNE chose : les pentes de
// Fritsch–Carlson d'`exageration-continue.js` — voir le §5.
//
// ══════════ 0. CE QU'ADRIEN VOIT, ET LES QUATRE NOMBRES QUI LE FONT ════════
//
// > « On dirait qu'il y a plein de façons de traiter l'affichage de la terre…
// >   la mer est bleu profond, puis clair, puis verte. On ne peut pas conserver
// >   une texture unique à tous les niveaux ? »
//
// ⚠️ **CE N'EST PAS UNE IMPRESSION : C'EST UN RELEVÉ.** La Réunion, descente
// ORB → Z4 → Z6 → Z9 → Z11 → Z13 dans l'application vivante, `fov` lu en direct
// à 33, drapeau levé. Données brutes : `.banc/vues-Kbis/AV-descente.json`,
// dépouillées par `.banc/bilan-Kbis.mjs` :
//
//   station   altitude    uLandBas  uLandMax  uOceanDepth  uMerFondBudgetM
//   ORB       3 000 000 m     0,0    2 584,4     2 106,771         3 510,5
//   Z4          189 119 m     0,0    5 600,0     6 000,000         6 000,0
//   Z6           26 720 m     0,0    2 457,3     5 639,500         6 228,0
//   Z9            6 339 m     0,0    2 848,8     4 913,000         6 028,0
//   Z11           8 001 m     0,0    3 005,5     1 827,149         6 028,0
//   Z13           9 564 m   533,7    3 057,2         0,009         4 415,2
//
// ⛔ **AUCUNE DES QUATRE COLONNES N'EST MONOTONE, ET DEUX S'EFFONDRENT.**
//   · `uOceanDepth` tombe de 6 000 m à **9 millimètres** : au crop de Z13 il n'y
//     a plus un seul point sous le niveau de la mer, donc `echelleRampe` rend le
//     PLANCHER de division. Toute la mer sature alors sur le premier texel.
//   · `uLandMax` fait 5 600 → 2 457 → 2 849 → 3 006 → 3 057 : il DESCEND puis
//     REMONTE. Une même altitude de terrain change de teinte dans les deux sens.
//   · `uLandBas` saute de 0 à 533,7 m au dernier cran : le crop de Z13 n'a plus
//     de littoral, son point de terre le plus bas est à 534 m, et **tout ce qui
//     est en dessous s'écrase sur la première teinte de terre — le vert.**
//
// **Écart maximal mesuré AVANT, pour une hauteur physique DONNÉE** (même
// dépouillement) : `t` (rampe hypsométrique `uRamp`) **0,3499 — 179 texels sur
// 512** ; `dMer01` (rampe nautique) **0,2480**. ⚠️ Ce sont DEUX MONNAIES : la
// première indexe une table de 512 couleurs, la seconde interpole trois couleurs
// en linéaire. **On ne les additionne jamais**, et le rapport les tient séparées.
//
// ══════════ 1. LA SORTIE N'EST NI L'ÉCHELLE FIGÉE NI LA RE-MESURE ══════════
//
// ⚠️ **REVENIR À L'ÉCHELLE MONDIALE FIGÉE SERAIT UNE RÉGRESSION DÉJÀ MESURÉE ET
// DÉJÀ REJETÉE.** La Tâche C l'a chiffrée : sous la rampe mondiale (5 600 m),
// La Réunion n'occupe que **163 texels sur 512** et le crop rend « une masse
// plate et orange » ; la rampe locale en occupe **368, soit ×2,26**.
//
// Et l'inverse — re-mesurer à chaque pose — est ce qui produit la table du §0.
//
// **La troisième voie : l'échelle est une COURBE CONTINUE DE L'ALTITUDE.** Les
// mesures ne sont plus POSÉES, elles sont ANCRÉES ; ce que le nuanceur reçoit
// est la valeur de la courbe à l'altitude de l'image.
//
// ══════════ 2. LE CRAN — ET IL N'EST PAS INVENTÉ ═══════════════════════════
//
// L'abscisse de la courbe est **`log2(altitude en mètres)`**, et le pas d'ancrage
// est **1**, c'est-à-dire un facteur 2 d'altitude.
//
// ⚠️ **CE PAS VIENT DU DÉPÔT, PAS DE MON INSTINCT.** Toute la descente de
// ShibuMap est GÉOMÉTRIQUE de raison 2 : `STEP_IN = STEP_OUT = Math.LN2`
// (`modes.js:171-172`), et `PAS_NIVEAU = Math.LN2` d'`exageration-continue.js`
// le redit — « un niveau vaut un facteur 2 ». Un cran de la courbe est donc un
// cran de l'escalier d'Adrien, pas une subdivision de plus.
//
// ⚠️ **ET C'EST CE QUI FAIT TENIR LE CRITÈRE D'ADRIEN LÀ OÙ IL REGARDE.** Les
// trois stations profondes du relevé — Z9, Z11, Z13 — sont à **6 339, 8 001 et
// 9 564 m**, c'est-à-dire `log2` = 12,63 / 12,97 / 13,22 : **le MÊME cran 13**.
// Elles partagent donc UNE ancre, et la même profondeur physique y rend
// EXACTEMENT la même couleur. Ce n'est pas une coïncidence heureuse — c'est ce
// que « une ancre par facteur 2 d'altitude » veut dire sur un escalier de
// raison 2 : trois crans de zoom consécutifs tiennent dans un facteur 2
// d'altitude parce que la caméra ne redescend pas d'autant qu'elle zoome.
//
// ══════════ 3. UNE ANCRE S'ÉCRIT UNE FOIS — ET C'EST LA PROPRIÉTÉ ══════════
//
// ⚠️ **UN CRAN DÉJÀ MESURÉ GARDE SA VALEUR.** Sans cette règle, redescendre au
// même endroit rendrait une autre couleur qu'à la descente précédente, et la
// « re-mesure par saut » serait simplement déguisée en courbe.
//
// ⚠️ **ET LA PREMIÈRE VISITE D'UN CRAN NEUF DÉPLACE ENCORE LA COURBE. JE NE LE
// CACHE PAS** : c'est le résidu de cette loi, il est mesuré et écrit dans le
// compte rendu. On ne peut pas connaître le relief d'un lieu avant de l'avoir
// mesuré ; ce qu'on peut, c'est ne le mesurer qu'une fois par facteur 2.
//
// ══════════ 4. UNE MESURE DÉGÉNÉRÉE N'EST PAS UNE ANCRE ════════════════════
//
// ⛔ **LE `0,009` DU §0 EST UN « JE NE SAIS PAS », PAS UN « LA MER EST PLATE ».**
// `echelleRampe` rend `profondeur = max(-min(0, minM), plancher)` : quand aucun
// point du crop n'est sous le niveau de la mer, elle rend le PLANCHER DE
// DIVISION. C'est exactement la doctrine que `mesurerRelief` porte déjà pour la
// couverture — « prendre `null` pour zéro, c'est prendre "je ne sais pas" pour
// "niveau de la mer" » — appliquée au contenu au lieu de la couverture.
//
// **Un champ dont la mesure est dégénérée n'est donc pas ancré du tout** : la
// courbe prolonge ses voisins, et l'échelle de mer d'un crop alpin reste celle
// que la mer avait quand on la voyait encore.
//
// ══════════ 5. POURQUOI FRITSCH–CARLSON, ET POURQUOI IMPORTÉ ═══════════════
//
// La forme est celle d'`exageration-continue.js` — cubique monotone par
// morceaux, C¹, **sans dépassement** : entre deux ancres la courbe reste entre
// leurs valeurs. Un `smoothstep` annulerait la pente à chaque ancre, donc
// rendrait un escalier ADOUCI ; du linéaire casserait la pente à chaque ancre.
//
// ⚠️ **LES PENTES SONT IMPORTÉES, PAS RECOPIÉES.** « Une constante dupliquée
// diverge en silence » (§1 de `/threejs-optimisation`) vaut aussi pour un
// algorithme : `pentesMonotones` est écrit UNE fois dans ce dépôt, dans
// `exageration-continue.js`, avec sa correction d'extremum que son propre test a
// attrapée. Le recopier ici aurait fait deux Fritsch–Carlson à maintenir.
// ⚠️ Et cette importation ne casse pas la règle d'`exageration-continue.js` :
// **c'est LUI qui n'importe rien** (cycle `terrain.js`), pas ses lecteurs.
//
// ══════════ 6. LE MÉLANGE SE FAIT EN `log1p`, ET C'EST MOTIVÉ ══════════════
//
// Les quatre nombres sont des MÈTRES POSITIFS OU NULS, et trois d'entre eux sont
// des ÉCHELLES (`terreHaut`, `profondeur`, `fondBudget`) : entre 1 000 et 4 000,
// le milieu qui a un sens est 2 000, pas 2 500 — un facteur 2 vers le haut et un
// facteur 2 vers le bas doivent se valoir. C'est la moyenne GÉOMÉTRIQUE.
//
// ⚠️ **`log1p` ET PAS `log` : PARCE QUE ZÉRO EXISTE.** `terreBas` vaut 0 sur
// tout crop littoral, `terreHaut` vaut 0 sur un crop entièrement en mer, et
// `log(0)` est `-Infinity` — un `NaN` posé dans un uniforme, c'est-à-dire une
// comparaison FAUSSE dans le nuanceur, c'est-à-dire le contraire du but (le
// §« écrêtage de Mercator » de `globe.js` dit où cela mène). `log1p` est défini
// en 0, strictement croissant, et vaut `log` à un cheveu près dès la centaine de
// mètres : à 1 000 m l'écart relatif est de **1,4·10⁻⁴**.

import { pentesMonotones } from './exageration-continue.js'

// ══════════ ① LES CHAMPS, ET CE QU'ILS PILOTENT ════════════════════════════

/**
 * Les quatre nombres qui décident de la couleur d'une hauteur.
 *
 * ⚠️ **`fondBudget` EST DE LA PARTIE, ET LE CONFONDRE AVEC `profondeur` SE VOIT.**
 * `globe.js` le dit déjà (§ « LE BUDGET DU FOND N'EST PAS uOceanDepth ») :
 * `uOceanDepth` indexe la table `uRamp`, `uMerFondBudgetM` indexe la rampe
 * NAUTIQUE à trois couleurs — et c'est la NAUTIQUE qui peint le fond dès que
 * `poserMer` a pris (`uMerRampeOn = 1`). Le relevé du §0 mesure les deux, et le
 * `dMer01` de la seconde bouge de **0,248** sur la descente : la laisser hors de
 * la courbe aurait laissé l'essentiel de la couleur de mer dehors.
 */
/**
 * ⚠️ **`creux` EST LE CINQUIÈME, ET IL N'EST PAS UNE ÉCHELLE DE MER — Tâche P11.**
 * Les quatre autres pilotent la COULEUR D'UNE HAUTEUR ; celui-ci porte l'ANCRE
 * BASSE DU RELIEF (`terreBas − creux` EST `minM`, voir `rampe-crop.js`), c'est-à-
 * dire le jumeau d'`uHeightRange.x` du socle. Il entre dans la courbe pour la
 * même raison que les autres — sans quoi il sauterait d'un cran à l'autre
 * pendant que ses voisins glissent, et la rampe se contredirait elle-même.
 */
export const CHAMPS = Object.freeze(['terreBas', 'terreHaut', 'profondeur', 'creux', 'fondBudget'])

// ══════════ ② LE CRAN ══════════════════════════════════════════════════════

/**
 * Le cran RÉEL d'une altitude — `log2(mètres)`. Non arrondi : c'est l'abscisse
 * de la courbe. `NaN` sur une altitude inutilisable, et l'appelant garde alors
 * ce qu'il avait (même contrat que `socleVisible`).
 */
export function cranReel(altitudeM) {
  const a = Number(altitudeM)
  if (!(a > 0)) return NaN
  return Math.log2(a)
}

/** Le cran ENTIER — celui sous lequel une mesure est rangée. */
export function cranAncre(altitudeM) {
  const c = cranReel(altitudeM)
  return Number.isFinite(c) ? Math.round(c) : NaN
}

// ══════════ ③ CE QU'UNE MESURE DIT, ET CE QU'ELLE NE DIT PAS ═══════════════

/**
 * Quels champs d'une mesure sont EXPLOITABLES — voir le §4.
 *
 * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number,fondBudget?:number}} e
 * @returns {{terreBas:boolean,terreHaut:boolean,profondeur:boolean,fondBudget:boolean}}
 */
export function champsUtiles(e) {
  const p = Number.isFinite(e?.plancherM) && e.plancherM > 0 ? e.plancherM : 0
  const fini = (v) => Number.isFinite(v)
  // ⚠️ **LE PLANCHER EST LA FRONTIÈRE, ET IL EST STRICT.** `echelleRampe` rend
  // EXACTEMENT `plancherM` quand elle n'a rien vu ; une mesure qui vaut le
  // plancher est donc muette, pas plate.
  const terre = fini(e?.terreBas) && fini(e?.terreHaut) && e.terreHaut > e.terreBas + p
  return {
    terreBas: terre,
    terreHaut: terre,
    profondeur: fini(e?.profondeur) && e.profondeur > p,
    // ⛔ **`creux` NE PASSE PAS PAR LE TEST DU PLANCHER, ET C'EST TOUT LE POINT
    // DE LA TÂCHE P11.** Le plancher distingue « la mer est plate » de « je ne
    // sais pas à quelle profondeur elle descend » — une distinction qui n'a de
    // sens que pour un BUDGET. `creux = 0` veut dire « aucun point de ce crop ne
    // descend sous sa terre la plus basse », et c'est une mesure prise sur les
    // mêmes `pas²` points que `terreBas`. Le rendre muet aurait laissé l'ancre
    // basse du relief au défaut MONDIAL (−6 000 m) sur tout crop intérieur.
    //
    // ⚠️ **IL SUIT LA TERRE, ET LA RAISON EST ARITHMÉTIQUE** : l'ancre basse est
    // `terreBas − creux`. Ancrer l'un sans l'autre ferait une soustraction entre
    // une mesure et un défaut mondial — un désaccord de monnaie, la faute que ce
    // chantier a payée quatre fois.
    creux: terre && fini(e?.creux),
    fondBudget: fini(e?.fondBudget) && e.fondBudget > p,
  }
}

// ══════════ ④ LE PARTAGE — UN ÉCRIVAIN, N LECTEURS ═════════════════════════

/**
 * ⚠️ **LA RAMPE, LA MER ET LE FOND DOIVENT LIRE LA MÊME ÉCHELLE AU MÊME
 * INSTANT**, exactement comme l'exagération de la Tâche E. C'est la famille de
 * défauts déjà payée trois fois ici : une valeur écrite d'un côté, jamais
 * transmise à l'autre. `poserRampe` et `poserMer` écrivent tous les deux, à des
 * moments différents, dans des uniformes que TOUTES les tuiles partagent.
 *
 * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number}} monde
 *   l'échelle de repli — `RAMPE_MONDE`. ⚠️ **PASSÉE, PAS RECOPIÉE** : elle est
 *   nommée une seule fois dans ce dépôt (`rampe-crop.js`), et ce module n'a pas
 *   à en faire une seconde copie.
 */
export function creerEchelleContinue(monde) {
  const m = monde || {}
  const repli = {
    terreBas: Number.isFinite(m.terreBas) ? m.terreBas : 0,
    terreHaut: Number.isFinite(m.terreHaut) ? m.terreHaut : 0,
    profondeur: Number.isFinite(m.profondeur) ? m.profondeur : 0,
    creux: Number.isFinite(m.creux) ? m.creux : 0,
    fondBudget: Number.isFinite(m.fondBudget) ? m.fondBudget : (Number.isFinite(m.profondeur) ? m.profondeur : 0),
    plancherM: Number.isFinite(m.plancherM) ? m.plancherM : 0,
  }
  return {
    monde: repli,
    /** `Map<cranEntier, {champ: valeur}>` — les mesures retenues. */
    ancres: new Map(),
    /** Le plancher de division de la DERNIÈRE mesure ancrée. */
    plancherM: repli.plancherM,
    /** La valeur courante — ce que les lecteurs prennent. */
    valeur: { ...repli },
    altitudeM: null,
    cran: null,
  }
}

/**
 * Range une mesure sous son cran. **Une ancre par cran et par champ, écrite une
 * seule fois** (§3) ; un champ dégénéré n'est pas rangé du tout (§4).
 *
 * @returns {string[]} les champs RÉELLEMENT ancrés par cet appel — vide si rien
 *   n'a bougé. C'est ce que les tests et les bancs lisent.
 */
export function ancrerMesure(partage, altitudeM, mesure) {
  const k = cranAncre(altitudeM)
  if (!Number.isFinite(k) || !mesure) return []
  const utile = champsUtiles(mesure)
  const place = partage.ancres.get(k) || {}
  const poses = []
  for (const c of CHAMPS) {
    if (!utile[c]) continue
    if (Number.isFinite(place[c])) continue // déjà mesuré à ce cran — il garde sa valeur
    place[c] = Number(mesure[c])
    poses.push(c)
  }
  if (poses.length) {
    partage.ancres.set(k, place)
    if (Number.isFinite(mesure.plancherM)) partage.plancherM = mesure.plancherM
  }
  return poses
}

/** Oublie tout — le lieu a changé, ses mesures ne veulent plus rien dire. */
export function oublierAncres(partage) {
  partage.ancres.clear()
  partage.valeur = { ...partage.monde }
  partage.altitudeM = null
  partage.cran = null
}

// ══════════ ⑤ LA COURBE ════════════════════════════════════════════════════

const log1p = Math.log1p
const expm1 = Math.expm1

/**
 * La courbe d'UN champ, évaluée au cran réel `x`.
 *
 * ⚠️ **LES TROUS SONT COMBLÉS EN LINÉAIRE `log1p` AVANT FRITSCH–CARLSON**, et
 * pas après : les pentes monotones supposent un pas RÉGULIER (c'est le contrat
 * de `pentesMonotones`, écrit pour un pas de 1 zoom). Une grille à trous les
 * rendrait fausses en silence — le genre de faute que le §0 du plan appelle
 * « une assertion qui se rejoue contre le dépôt ».
 *
 * ⚠️ **ET AUX DEUX BOUTS, LA COURBE EST PLATE.** Au-delà du cran le plus haut
 * ancré et en deçà du plus bas, on rend la valeur du bout — jamais une
 * extrapolation. Extrapoler une échelle de couleur sur un cran jamais visité,
 * c'est inventer un relief.
 */
export function valeurChamp(partage, champ, cranX) {
  const pts = []
  for (const [k, v] of partage.ancres) {
    if (Number.isFinite(v?.[champ])) pts.push([k, v[champ]])
  }
  if (!pts.length) return partage.monde[champ]
  pts.sort((a, b) => a[0] - b[0])
  if (pts.length === 1) return pts[0][1]
  const k0 = pts[0][0]
  const k1 = pts[pts.length - 1][0]
  const x = Number(cranX)
  if (!Number.isFinite(x)) return partage.monde[champ]
  if (x <= k0) return pts[0][1]
  if (x >= k1) return pts[pts.length - 1][1]
  // la grille pleine, en log1p, trous comblés en linéaire
  const n = k1 - k0
  const ys = new Array(n + 1)
  let i = 0
  for (let k = k0; k <= k1; k++) {
    while (i < pts.length - 1 && pts[i + 1][0] <= k) i++
    if (pts[i][0] === k) { ys[k - k0] = log1p(Math.max(0, pts[i][1])); continue }
    const [ka, va] = pts[i]
    const [kb, vb] = pts[i + 1]
    const t = (k - ka) / (kb - ka)
    ys[k - k0] = log1p(Math.max(0, va)) + (log1p(Math.max(0, vb)) - log1p(Math.max(0, va))) * t
  }
  const p = pentesMonotones(ys)
  const j = Math.min(n - 1, Math.max(0, Math.floor(x - k0)))
  const t = x - k0 - j
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const y = h00 * ys[j] + h10 * p[j] + h01 * ys[j + 1] + h11 * p[j + 1]
  return Math.max(0, expm1(y))
}

/**
 * **L'UNIQUE ÉCRIVAIN.** Évalue les quatre champs à cette altitude et pose la
 * valeur partagée.
 *
 * ⚠️ **IL NE MESURE RIEN, ET C'EST TOUTE LA TÂCHE.** La mesure entre par
 * `ancrerMesure`, à l'arrêt ; celui-ci ne fait qu'évaluer une courbe — huit
 * opérations par champ, et il a le droit de tourner par image.
 *
 * ⚠️ **`terreHaut` NE PEUT PAS PASSER SOUS `terreBas`.** Les deux champs sont
 * interpolés séparément et rien ne le garantit : deux ancres où `terreBas` monte
 * plus vite que `terreHaut` rendraient une amplitude NÉGATIVE, donc un `t` qui
 * s'inverse. Le nuanceur, lui, borne déjà par `max(…, uPlancherRampeM)` ; on
 * borne ici aussi pour que la loi JS et le nuanceur disent la même chose.
 */
export function majEchelle(partage, altitudeM) {
  const x = cranReel(altitudeM)
  if (!Number.isFinite(x)) return partage.valeur
  const v = {
    terreBas: valeurChamp(partage, 'terreBas', x),
    terreHaut: valeurChamp(partage, 'terreHaut', x),
    profondeur: valeurChamp(partage, 'profondeur', x),
    creux: valeurChamp(partage, 'creux', x),
    fondBudget: valeurChamp(partage, 'fondBudget', x),
    plancherM: partage.plancherM,
  }
  const p = v.plancherM > 0 ? v.plancherM : 0
  v.terreHaut = Math.max(v.terreHaut, v.terreBas + p)
  partage.valeur = v
  partage.altitudeM = Number(altitudeM)
  partage.cran = x
  return v
}

/**
 * **LE SEUL LECTEUR AUTORISÉ.** Rend l'échelle courante — jamais recalculée par
 * un lecteur, qui n'a pas les ancres.
 */
export function lireEchelle(partage) {
  return partage?.valeur ?? null
}
