// LA RAMPE DU CROP — Tâche D du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE MODULE EST, ET POURQUOI IL EXISTE ═════════════════════
//
// **Décision 4 d'Adrien, tranchée le 2026-08-21 :** « la rampe de couleur se
// calcule SUR LE CROP, et les alentours la suivent ». Couleurs stables et
// reproductibles pour l'affiche, **aucune couture au bord**.
//
// C'est le défaut que ses captures montrent, et il est chiffré au §3 du plan :
//
// | | globe | socle |
// |---|---|---|
// | échelle de la rampe | **mondiale FIXE** (`uLandMax = 5600 m`) | **locale** (`uHeightRange`) |
//
// ⚠️ **À l'île Maurice, qui culmine à 828 m, le globe n'utilise que 14,3 % du bas
// de sa rampe** — et ce chiffre n'est pas repris de confiance, il est REJOUÉ
// contre le dépôt : `.banc/rejoue-D.mjs` évalue l'expression de rampe EXTRAITE
// de `git show 82e8b87:src/globe.js` et rend `t(828 m) = 0,4429`, soit
// `(0,4429 − 0,35) / 0,65 = 14,3 %`. Le socle, lui, l'étale sur 100 %.
//
// Comme `crop-sphere.js`, `parois-crop.js` et `habillage-crop.js` avant lui, ce
// fichier ne connaît ni three ni le DOM : **la loi se vérifie sous node**
// (`test/crop-rampe.test.js`), et le nuanceur en est la TRANSCRIPTION — que le
// test vérifie en EXTRAYANT l'expression du nuanceur et en l'évaluant, pas en
// cherchant un nom dedans.
//
// ══════════ R1 — POURQUOI CE MODULE A LE DROIT DE LIRE LE RELIEF ════════════
//
// R2 du plan précédent, R1 ici : « aucune décision de CADRAGE ne lit une
// quantité dérivée du terrain ». Elle a mordu **trois fois** sur ce chantier —
// `surfaceCamAltMeters` qui ajoutait `meanM` et pilotait `enterOrbit` ; un
// pilote d'exagération de gain mesuré **1,44**, donc divergent ; et un second
// qui **gelait**.
//
// ⚠️ **LA RAMPE N'EST PAS UNE DÉCISION DE CADRAGE, C'EST UNE DÉCISION DE RENDU.**
// Elle a donc le droit de lire le relief. Ce qui est interdit, c'est la boucle
// de retour — et elle a été VÉRIFIÉE OUVERTE avant d'écrire une ligne :
//
//   · `grep -rn "uLandMax\|uOceanDepth" src/ test/` ne rend, hors `globe.js`,
//     **AUCUNE occurrence**. Personne ne relit l'échelle de la rampe.
//   · les sorties de ce module ne vont QUE dans des uniformes de couleur
//     (`uLandBas`, `uLandMax`, `uOceanDepth`, `uPlancherRampeM`) ; aucun n'est lu
//     par `seuil-socle.js`, `descente-bornee.js`, `exageration-continue.js` ni
//     par `_traverse`.
//   · l'entrée du module est `hauteur(lat, lon)`, c'est-à-dire les tuiles DÉJÀ
//     chargées : la rampe suit le chargement, le chargement ne suit pas la rampe.
//
// **La boucle est coupée, pas amortie.** C'est la formulation que la Tâche E a
// retenue après avoir mesuré ses deux divergences, et elle vaut ici.
//
// ══════════ LA CONSÉQUENCE QU'ADRIEN A ACCEPTÉE ════════════════════════════
//
// ⚠️ **LES ZONES LOINTAINES PEUVENT SATURER**, et c'est écrit dans la décision :
// « une plaine à côté d'un crop alpin sera monochrome ». `saturation()` ci-dessous
// la MESURE — c'est l'Étape 4 de la tâche, et son chiffre est dans le compte
// rendu. On ne la corrige pas : la corriger, ce serait rebaser la rampe sur la
// vue, c'est-à-dire exactement la couture au bord que la décision refuse.

import { dansCrop, latLonDeLocal } from './crop-sphere.js'
import {
  unitesEnMetres,
  largeurCropM,
  COTE_CROP_UNITES,
  EXAG_SOCLE_NOMINALE,
} from './habillage-crop.js'

// ══════════ ① LE PLANCHER D'AMPLITUDE — CONVERTI, PAS CHOISI ═══════════════

/**
 * Le plancher d'amplitude du socle, en UNITÉS DE SCÈNE.
 *
 * ⚠️ **CE NOMBRE VIENT DU DÉPÔT, PAS DE MON INSTINCT.** `terrain.js:1016` écrit
 *
 *     hNorm = clamp((vWorldPos.y - uHeightRange.x)
 *                   / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 1.0);
 *
 * Ce `1e-4` EST le garde-fou de division du socle. On le reprend au lieu d'en
 * poser un nouveau : le §0 du plan interdit un chiffre sans sa source, et le §1
 * de `/threejs-optimisation` rappelle qu'une constante recopiée diverge.
 */
export const PLANCHER_AMPLITUDE_UNITES = 1e-4

/**
 * Le plancher d'amplitude, EN MÈTRES BRUTS, pour un crop donné.
 *
 * ⚠️ **CONVERTI, EXACTEMENT COMME `margeCoteM`.** Le socle tient son amplitude
 * en unités de scène sur un relief DÉJÀ exagéré ; le globe tient sa hauteur en
 * mètres bruts (`decodeMetersAA`). Recopier « 1e-4 » côté globe aurait donné
 * un dixième de millimètre — un plancher qui ne planche rien.
 *
 * ⚠️ **ET IL N'EST PAS DÉCORATIF** : sans lui, un crop RIGOUREUSEMENT PLAT (un
 * lagon, une plaine, une emprise entièrement en mer) donne `maxM − minM = 0`,
 * donc une division par zéro, donc un NaN — et le §« écrêtage de Mercator » de
 * `globe.js` dit où mène un NaN dans ce nuanceur : une comparaison FAUSSE, donc
 * un fragment gardé, donc le contraire du but. `.banc/rejoue-D.mjs` le rejoue :
 * la loi « naïve » sans plancher est ROUGE sur D5, la cible est verte.
 */
export function plancherAmplitudeM(metresParUnite, exageration) {
  return unitesEnMetres(PLANCHER_AMPLITUDE_UNITES, metresParUnite, exageration)
}

// ══════════ ② LA MESURE DU RELIEF DU CROP ══════════════════════════════════

/**
 * Le pas de balayage, en cellules par côté du crop.
 *
 * ⚠️ **MESURÉ, PAS CHOISI** — `.banc/pose-D.js`, `convergence()`, La Réunion,
 * crop z13 de 3 tuiles, neuf tuiles z12 à 512 px chargées, couverture 1,0 :
 *
 * | pas | échantillons | `maxM` | `minM` | ms |
 * |---|---|---|---|---|
 * | 4 | 16 | 2 286,21 | 0,00 | 0,0 |
 * | 8 | 64 | 2 561,32 | −0,50 | 0,0 |
 * | 16 | 256 | 2 545,59 | −0,72 | 0,2 |
 * | 32 | 1 024 | 2 602,44 | −87,83 | 1,0 |
 * | 64 | 4 096 | 2 584,35 | −130,36 | 2,8 |
 * | **128** | **16 380** | **2 613,64** | **−223,13** | **10,8** |
 * | 256 | 65 516 | 2 624,08 | −204,83 | 41,8 |
 * | 512 | 262 044 | 2 622,42 | −234,77 | 152,4 |
 * | 1 024 | 1 048 176 | 2 624,81 | −240,99 | 608,2 |
 *
 * **128 rend `maxM` à 11,2 m du relevé le plus fin, soit 0,43 % de l'amplitude**
 * — moins d'un texel sur un LUT de 512 (0,43 % × 0,65 = 0,0028 en `t`, contre
 * 0,00195 par texel). Passer à 256 gagne 0,03 % pour **quatre fois le temps**.
 *
 * ⚠️ **MAIS LE FOND DE MER, LUI, N'EST PAS CONVERGÉ, ET IL FAUT LE DIRE** : −223
 * à 128, **−205 à 256**, −235 à 512, −241 à 1 024. La suite n'est pas monotone
 * parce que les points les plus profonds sont RARES — quelques échantillons au
 * bord du crop. L'erreur sur `profondeur` est donc de l'ordre de **7 %**, soit
 * 0,026 en `t`, **treize texels** de la rampe bathymétrique. Un crop dont la mer
 * compte pourra vouloir un pas plus fin ; l'argument est ici pour qu'on puisse
 * le contredire avec une mesure.
 *
 * ⚠️ **ET LE POINT DE COMPARAISON EST LE SOCLE, QUI NE BALAIE PAS** : lui prend
 * les extrema du CHAMP ENTIER (`dem.minM`, `dem.maxM`, `terrain.js:2517`), soit
 * 4,2 millions d'échantillons. Un balayage à 128 en prend 16 380, **deux cent
 * cinquante fois moins**. Ce n'est donc pas la même mesure.
 *
 * ⚠️ **10,8 ms, ET LA MESURE NE TOURNE QU'À L'ARRÊT** (décision 5, « la gravure
 * ne s'écrit qu'à l'arrêt »). C'est **cinq fois** la reconstruction des parois
 * (1,9 ms de médiane, Tâche B) : l'appelant doit le savoir avant de la mettre
 * dans une boucle.
 */
export const PAS_MESURE = 128

/**
 * Balaie le crop et rend les extrema de son relief, en mètres bruts.
 *
 * ⚠️ **SUR LA FORME, PAS SUR LA BOÎTE.** Un pic qui tombe dans un coin ARRONDI
 * du crop n'est pas dessiné (Tâche A : `discard` hors de la superellipse) : le
 * compter dans l'amplitude étirerait la rampe sur un relief invisible, et
 * l'affiche perdrait ses blancs. `.banc/rejoue-D.mjs` rejoue le cas : la loi
 * « boîte » est ROUGE sur D1 et D6.
 *
 * ⚠️ **ET LE VERDICT DE COUVERTURE EST CELUI DES PAROIS (§7 de
 * `parois-crop.js`), POUR LA MÊME RAISON.** Un point non couvert rend `null` ;
 * le prendre pour zéro, c'est prendre « je ne sais pas » pour « niveau de la
 * mer ». Sur la paroi cela creusait une encoche ; ici cela **écraserait
 * `minTerreM` à zéro et repeindrait tout le crop** dès qu'une seule tuile
 * manque. On refuse la mesure plutôt que de rendre du faux, et l'appelant garde
 * la rampe précédente.
 *
 * @param {object} arg
 * @param {{cx:number,cy:number,demi:number}} arg.repere - `repereCrop`
 * @param {{coin:number, expo:number}} [arg.forme] - rayon NORMALISÉ, exposant
 * @param {(lat:number, lon:number) => (number|null)} arg.hauteur - en MÈTRES
 * @param {number} [arg.pas]
 * @param {number} [arg.couvertureMin]
 * @returns {{refus:string|null, couverture:number, vus:number, manquants:number,
 *            minM:number, maxM:number, minTerreM:number, maxTerreM:number}}
 */
export function mesurerRelief({
  repere,
  forme = { coin: 0, expo: 2 },
  hauteur,
  pas = PAS_MESURE,
  couvertureMin = 1,
} = {}) {
  if (!repere || !Number.isFinite(repere.demi)) {
    throw new TypeError('mesurerRelief : il faut un `repere` (repereCrop)')
  }
  if (typeof hauteur !== 'function') {
    throw new TypeError('mesurerRelief : `hauteur(lat, lon)` est obligatoire')
  }
  const n = Math.max(2, Math.round(pas))
  let minM = Infinity
  let maxM = -Infinity
  let minTerreM = Infinity
  let maxTerreM = -Infinity
  let vus = 0
  let manquants = 0
  // ⚠️ **LES CENTRES DE CELLULE, PAS LES NŒUDS.** Sur les nœuds, la rangée
  // `i = 0` tombe EXACTEMENT sur `u = -1`, c'est-à-dire sur la frontière, où
  // `dansDalle` répond « non » et où la hauteur du bord manque : la couverture
  // tomberait sous 1 par construction, et le refus serait permanent.
  for (let j = 0; j < n; j++) {
    const v = -1 + (2 * j + 1) / n
    for (let i = 0; i < n; i++) {
      const u = -1 + (2 * i + 1) / n
      const { lat, lon } = latLonDeLocal(u, v, repere)
      if (!dansCrop(lat, lon, repere, forme)) continue
      const h = hauteur(lat, lon)
      if (h == null || !Number.isFinite(h)) {
        manquants++
        continue
      }
      vus++
      if (h < minM) minM = h
      if (h > maxM) maxM = h
      // ⚠️ **LE PRÉDICAT DE TERRE EST `h >= 0`, ET C'EST UNE APPROXIMATION
      // ASSUMÉE.** Le nuanceur, lui, peut interroger le masque de côte quand
      // l'habillage est posé (`sousEau = landness < 0.5 && h < uMargeCoteM`).
      // Ce module est PUR : il n'a pas la texture. `h < 0` est le prédicat que
      // le globe applique par défaut, et l'écart ne porte que sur la frange
      // littorale — quelques mètres de hauteur, donc quelques millièmes de
      // rampe. **C'est écrit ici pour que ce ne soit jamais une surprise.**
      if (h >= 0) {
        if (h < minTerreM) minTerreM = h
        if (h > maxTerreM) maxTerreM = h
      }
    }
  }
  const couverture = vus + manquants > 0 ? vus / (vus + manquants) : 0
  if (couverture < couvertureMin) {
    return { refus: 'couverture', couverture, vus, manquants, minM: 0, maxM: 0, minTerreM: 0, maxTerreM: 0 }
  }
  return {
    refus: null,
    couverture,
    vus,
    manquants,
    minM: Number.isFinite(minM) ? minM : 0,
    maxM: Number.isFinite(maxM) ? maxM : 0,
    minTerreM: Number.isFinite(minTerreM) ? minTerreM : 0,
    maxTerreM: Number.isFinite(maxTerreM) ? maxTerreM : 0,
  }
}

// ══════════ ③ L'ÉCHELLE — TROIS NOMBRES, ET RIEN D'AUTRE ═══════════════════

/**
 * L'échelle de la rampe, déduite d'une mesure de crop.
 *
 * ⚠️ **DEUX ANCRES POUR LA TERRE, PAS UNE — ET C'EST LA LETTRE DU PLAN.**
 * L'Étape 1 dit « la rampe **s'étale sur l'amplitude locale** ». L'amplitude,
 * c'est `max − min`, pas `max` seul : sur un crop alpin intérieur dont la vallée
 * est à 402 m et le sommet à 4 808, ne caler que le haut laisserait le fond de
 * vallée à 8 % de la rampe au lieu de 0. Le socle, lui, pose bien les deux
 * (`uHeightRange = (minH, maxH)`, `terrain.js:2084`). `.banc/rejoue-D.mjs`
 * rejoue le cas : la loi du dépôt ET la loi « naïve » sont ROUGES sur D2.
 *
 * ⚠️ **MAIS L'ANCRE BASSE EST LE MINIMUM DE LA *TERRE*, PAS DU RELIEF.** Sur un
 * crop côtier avec une fosse à −140 m, prendre `minM` mettrait le niveau de la
 * mer à `0,35 + 0,65 · 140/968 = 0,44` : la côte quitterait le bas de la rampe
 * et prendrait les teintes de moyenne montagne. **Le zéro de la mer est un
 * repère cartographique, pas une valeur comme une autre.**
 *
 * ⚠️ **ET LA MER GARDE SON SEGMENT.** Le globe partage la rampe en deux : la
 * bathymétrie occupe `[0 ; 0,35]`, la terre `[0,35 ; 1]`. Ce partage NE BOUGE
 * PAS — c'est lui qui garantit qu'un littoral reste un littoral d'un crop à
 * l'autre, et c'est le garde-fou D8 du banc de rejeu (vert contre le dépôt,
 * ROUGE contre la loi « naïve » à rampe unique).
 *
 * @param {{minM:number, maxM:number, minTerreM:number, maxTerreM:number}} mesure
 * @param {{plancherM?:number}} [opts]
 * @returns {{terreBas:number, terreHaut:number, profondeur:number, plancherM:number}}
 */
export function echelleRampe(mesure, { plancherM = 0 } = {}) {
  if (!mesure || !Number.isFinite(mesure.maxM)) {
    throw new TypeError('echelleRampe : il faut une mesure (mesurerRelief)')
  }
  const p = Number.isFinite(plancherM) && plancherM > 0 ? plancherM : 0
  const terreBas = Number.isFinite(mesure.minTerreM) ? mesure.minTerreM : 0
  const brut = Number.isFinite(mesure.maxTerreM) ? mesure.maxTerreM : terreBas
  const terreHaut = Math.max(brut, terreBas + p)
  const profondeur = Math.max(-Math.min(0, mesure.minM), p)
  return { terreBas, terreHaut, profondeur, plancherM: p }
}

// ══════════ ④ LA LOI — LA TRANSCRIPTION QUE LE NUANCEUR PORTE ══════════════

/**
 * L'indice de rampe, dans [0, 1] — la loi du nuanceur, en JS.
 *
 * ⚠️ **CE N'EST PAS UNE SECONDE LOI, C'EST LA MÊME.** `test/crop-rampe.test.js`
 * EXTRAIT l'expression `float t = sousEau ? … ;` du nuanceur, la traduit
 * mécaniquement en JS et la confronte à cette fonction sur un balayage de
 * hauteurs. Une divergence est une erreur de test, pas un désaccord de goût —
 * c'est le protocole que la Tâche C a employé pour son grain, après que
 * `terrain.js` eut documenté ce que coûtent « deux écritures jumelles ».
 *
 * @param {number} hM - hauteur en mètres bruts
 * @param {{terreBas:number, terreHaut:number, profondeur:number, plancherM:number}} e
 * @param {boolean} sousEau
 */
export function rampeT(hM, e, sousEau) {
  const plancher = e.plancherM > 0 ? e.plancherM : 0
  if (sousEau) {
    return 0.35 * (1 - clamp01(-hM / Math.max(e.profondeur, plancher)))
  }
  return 0.35 + 0.65 * clamp01((hM - e.terreBas) / Math.max(e.terreHaut - e.terreBas, plancher))
}

function clamp01(x) {
  return Math.min(Math.max(x, 0), 1)
}

// ══════════ ⑤ LA SATURATION — L'ÉTAPE 4, ET ELLE SE MESURE ═════════════════

/**
 * Quelle part d'un jeu de hauteurs BUTE sur une extrémité de la rampe ?
 *
 * ⚠️ **C'EST LA CONSÉQUENCE QU'ADRIEN A ACCEPTÉE EN CONNAISSANCE DE CAUSE**, et
 * l'Étape 4 de la tâche demande de la mesurer et de l'écrire, **pas de la
 * corriger**. La corriger reviendrait à rebaser la rampe sur la vue — c'est-à-dire
 * à rouvrir la couture au bord que la décision 4 supprime, et à contredire
 * l'amendement de la décision 8 (« la référence n'est plus le monde ni la vue,
 * c'est le crop »).
 *
 * ⚠️ **LA SATURATION EST COMPTÉE SUR LES DEUX BOUTS.** Vers le haut, une plaine
 * plus haute que le sommet du crop devient blanche ; vers le BAS, tout ce qui
 * est sous `terreBas` s'écrase sur la première teinte de terre — et sur un crop
 * ALPIN, dont `terreBas` vaut 402 m, cela couvre **toutes les plaines du monde**.
 *
 * @param {ArrayLike<number>} hauteursM
 * @param {{terreBas:number, terreHaut:number, profondeur:number, plancherM:number}} e
 * @returns {{haut:number, bas:number, mer:number, total:number, fraction:number}}
 */
export function saturation(hauteursM, e) {
  let haut = 0
  let bas = 0
  let mer = 0
  let total = 0
  for (let i = 0; i < hauteursM.length; i++) {
    const h = hauteursM[i]
    if (!Number.isFinite(h)) continue
    total++
    if (h < 0) {
      if (-h >= Math.max(e.profondeur, e.plancherM > 0 ? e.plancherM : 0)) mer++
    } else if (h >= e.terreHaut) haut++
    else if (h <= e.terreBas) bas++
  }
  return { haut, bas, mer, total, fraction: total > 0 ? (haut + bas + mer) / total : 0 }
}

// ══════════ ⑥ LE REPLI — L'ÉCHELLE MONDIALE, NOMMÉE UNE FOIS ═══════════════

/**
 * La rampe MONDIALE : l'échelle d'avant cette tâche, et le repli de
 * `retirerRampe`.
 *
 * ⚠️ **NOMMÉE ICI, ET NULLE PART AILLEURS.** `globe.js` posait `5600` et `6000`
 * en littéraux dans `this.uniforms` ; `retirerRampe` en aurait fait une seconde
 * copie, et « une constante dupliquée diverge en silence » est la question 2 du
 * §1 de `/threejs-optimisation`. Les deux sites lisent maintenant cet objet, et
 * `test/crop-rampe.test.js` (②d, ②e) exige que `this.uniforms` le référence
 * plutôt que de recopier ses nombres.
 *
 * ⚠️ **ET CE N'EST PAS UNE VALEUR PAR DÉFAUT ANODINE : C'EST LA GARDE DE
 * PRODUCTION.** Tant que personne n'appelle `poserRampe`, le globe peint avec
 * cette échelle — donc au bit près comme avant la Tâche D. Même discipline que
 * `uCropOn: 0` (Tâche A) et `uHabOn: 0` (Tâche C), et ②e le prouve sur 2 001
 * hauteurs par un `Object.is`.
 */
export const RAMPE_MONDE = Object.freeze({
  terreBas: 0,
  terreHaut: 5600,
  profondeur: 6000,
  plancherM: 0,
})

/**
 * Le plancher d'amplitude d'un crop donné, en mètres — jumeau de
 * `margeCoteDuCrop` (`habillage-crop.js`), et il tire son échelle du même
 * endroit : la largeur au sol du crop, divisée par le côté du bloc.
 */
export function plancherRampeDuCrop(repere, exageration = EXAG_SOCLE_NOMINALE) {
  return plancherAmplitudeM(largeurCropM(repere) / COTE_CROP_UNITES, exageration)
}
