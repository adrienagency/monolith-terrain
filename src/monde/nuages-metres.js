// LE PLAFOND DES NUAGES EN MÈTRES — Tâche NUA (mission du 2026-09-05, N1–N2).
//
// Module PUR : ni DOM, ni three.js, ni état. Il rend des nombres. Tout se
// vérifie sous node (`test/nuages-metres.test.js`).
//
// ══════════ 0. LE DÉFAUT — LA QUATORZIÈME CONFUSION D'ESPACES ══════════════
//
// ⛔ **`cloudAltitude` VALAIT 13,5 UNITÉS DE BLOC, ET L'UNITÉ DE BLOC CHANGE DE
// VALEUR À CHAQUE PALIER.** Le bloc mesure toujours `TERRAIN_SIZE = 56` unités
// de côté, quel que soit le zoom : une unité vaut donc `largeurBlocM / 56`
// mètres à l'horizontale, et `largeurBlocM / 56 / exagération` à la verticale.
// Quand le socle rétrécit d'un facteur 2 par palier, les 13,5 unités du
// plafond rétrécissent avec lui. Mesuré au banc (`scripts/banc-nua.mjs`,
// Provence 44,3425 / 5,7777, exagération 2, `.banc/NUA/avant/journal.json`) :
//
//   | palier | largeur du bloc | 1 unité de bloc (verticale) | plafond 13,5 u | crête la plus haute |
//   |---|---|---|---|---|
//   | z9  | 167 933 m | 1 499,4 m | **21 346 m** | 3 908 m (les Écrins) |
//   | z10 |  83 967 m |   749,7 m | **11 209 m** | 3 368 m |
//   | z11 |  41 983 m |   374,8 m |  **5 994 m** | 2 000 m |
//   | z12 |  20 992 m |   187,4 m |  **3 407 m** | 1 829 m |
//   | z13 |  10 496 m |    93,7 m |  **2 016 m** | 1 425 m |
//
// À z13 le ciel est à 600 m au-dessus de la crête, à z14 il serait dessous ; et
// VID2 relevait « la moitié de l'écran est un nuage » à z13 au repos. C'est
// N1. La mémoire du projet notait déjà la réserve : « `cloudAltitude` en unités
// de bloc » (rapport R20 bis, réserve 3).
//
// ══════════ 1. LE FACTEUR DE CONVERSION, ÉCRIT ══════════════════════════════
//
// ⚡ **mètres → unités de bloc (verticale) : × `span / extentMeters × exagération`**
// — c'est `echelleBloc` de `loi-altitude.js`, mot pour mot la formule de
// `terrain.js` `_makeDemSampler` et de `fenetre-bornee.js` `appliquerHauteurs`
// (`y = (hauteur − moyenne) × 56 / largeur × exagération`). Sa valeur :
//
//   · z13, bloc de 10 496 m, exagération 2 : 56 / 10 496 × 2 = **0,010 671**
//     unité de bloc par mètre — soit **93,7 m par unité** ;
//   · z9, bloc de 167 933 m, exagération 2 : 56 / 167 933 × 2 = **0,000 667**
//     unité par mètre — soit **1 499 m par unité** ;
//   · La Réunion z12 (relevé R20, 27 354 m) : 0,004 094 — 244 m par unité.
//
// ⚠️ **ET LE ZÉRO DU BLOC N'EST PAS LA MER : c'est la MOYENNE du relief**
// (`fenetre.moyenneM`, ou `dem.meanM`). Une altitude au-dessus de la mer se
// convertit donc en `(altitude − moyenneM) × facteur`. Oublier la moyenne
// poserait le plafond 750 à 1 100 m trop haut en Provence, et 0 m trop haut au
// large — un défaut qui ne se verrait qu'en montagne.
//
// ⚠️ **L'EXAGÉRATION EST DANS LE FACTEUR**, exprès : le relief du bloc est
// exagéré, et un plafond posé sans l'exagération passerait SOUS des crêtes
// dessinées deux fois plus hautes qu'elles ne le sont. Le ciel doit être
// exagéré comme le sol qu'il surplombe (même raisonnement que le §3 de
// `nuages-globe.js`).
//
// ══════════ 2. LA VALEUR — 6 000 m, DÉRIVÉE, PAS CHOISIE ═══════════════════
//
// Deux contraintes, toutes deux mesurées sur le vol de la vidéo :
//
//   ① **le plafond passe au-dessus de la crête la plus haute de TOUS les blocs
//      du vol**, avec une marge : à z9 le bloc de 168 km inclut la Barre des
//      Écrins, `maxM = 3 908 m` (banc, ci-dessus). Marge 500 m → ≥ 4 400 m ;
//   ② **la base de la couche passe au-dessus de la caméra au repos du palier
//      le plus fin de la vidéo** — 3 115 m à z13 (rapport VID2), sinon la
//      caméra vole DANS la couche et « la moitié de l'écran est un nuage ». La
//      base vaut `moyenne + (1 − étalement) × (plafond − moyenne)` avec
//      l'étalement du gabarit d'ouverture (0,45) et une moyenne de ~800 m :
//      base ≥ 3 115 + 300 ⇒ plafond ≥ 800 + 2 615 / 0,55 = **5 555 m**.
//
// ➡️ **6 000 m** : un plafond d'altocumulus (2 à 6 km dans les classifications
// météo), base à ~3 660 m en Provence. Au-dessus du Mont Blanc (4 808 m) ; et
// la crête garde un plancher de sécurité (`maxM + MARGE_CRETE_M`) pour
// l'Himalaya, où 6 000 m serait sous les sommets.
//
// ⚠️ La tirette « Altitude » du panneau porte désormais des MÈTRES
// (`cloudAltitudeM`). L'ancienne `cloudAltitude` (unités de bloc) reste lue
// sur le terrain procédural, où il n'existe pas de mètres.

import { echelleBloc } from '../loi-altitude.js'

/** Plafond par défaut, en mètres au-dessus de la mer (§2). */
export const PLAFOND_NUAGES_M = 6000

/** Le plafond ne descend jamais sous la crête la plus haute du bloc + ceci. */
export const MARGE_CRETE_M = 500

/** Bande de fondu au bord du socle, en unités de bloc (N2, même exigence que D24). */
export const BANDE_FONDU_BORNE = 3

/**
 * L'ÉCHELLE VERTICALE DU TERRAIN AFFICHÉ, ou `null` s'il n'a pas de mètres.
 *
 * La fenêtre bornée passe en premier, pour la même raison que
 * `largeurBlocM()` dans `main.js` : `dem` passe à `null` pendant tout le
 * rechargement d'un cran, la fenêtre ne disparaît pas. Et sa
 * `echelleVerticale` est la valeur que `terrain.js` utilise pour poser la
 * ligne d'eau — la surface réellement dessinée.
 *
 * @param {object} o
 * @param {object|null} o.fenetreBornee `terrain.fenetreBornee`
 * @param {object|null} o.dem `terrain.dem`
 * @param {number} o.span côté du champ de hauteurs en unités de bloc (`terrain._span()`)
 * @param {number} o.exageration `lireExageration(params)`
 * @returns {{blocParMetre:number, moyenneM:number, maxM:number, extentMeters:number}|null}
 */
export function verticaleDuTerrain({ fenetreBornee = null, dem = null, span, exageration }) {
  const f = fenetreBornee
  if (f && f.largeurM > 0 && Number.isFinite(f.moyenneM)) {
    const bpm = f.echelleVerticale > 0
      ? f.echelleVerticale
      : echelleBloc({ extentMeters: f.largeurM, span, exageration })
    return { blocParMetre: bpm, moyenneM: f.moyenneM, maxM: Number.isFinite(f.maxM) ? f.maxM : f.moyenneM, extentMeters: f.largeurM }
  }
  if (dem && dem.extentMeters > 0 && Number.isFinite(dem.meanM) && span > 0 && exageration > 0) {
    return {
      blocParMetre: echelleBloc({ extentMeters: dem.extentMeters, span, exageration }),
      moyenneM: dem.meanM,
      maxM: Number.isFinite(dem.maxM) ? dem.maxM : dem.meanM,
      extentMeters: dem.extentMeters,
    }
  }
  return null
}

/**
 * LE PLAFOND EFFECTIF, EN MÈTRES : la valeur demandée, relevée si la crête la
 * plus haute du bloc passe dessus.
 */
export function plafondEffectifM({ plafondM = PLAFOND_NUAGES_M, maxM = -Infinity, margeCreteM = MARGE_CRETE_M } = {}) {
  const p = Number.isFinite(plafondM) ? plafondM : PLAFOND_NUAGES_M
  return Number.isFinite(maxM) ? Math.max(p, maxM + margeCreteM) : p
}

/**
 * LE PLAFOND DES NUAGES, EN UNITÉS DE BLOC — la conversion du §1.
 *
 *   ceilY = (plafondEffectifM − moyenneM) × blocParMetre
 *
 * @param {object} o
 * @param {number} o.plafondM plafond demandé, mètres au-dessus de la mer
 * @param {{blocParMetre:number, moyenneM:number, maxM:number}} o.verticale
 * @param {number} [o.margeCreteM]
 * @returns {{ceilY:number, plafondM:number}} le plafond en bloc, et en mètres (effectif)
 */
export function plafondNuagesBloc({ plafondM, verticale, margeCreteM = MARGE_CRETE_M }) {
  const p = plafondEffectifM({ plafondM, maxM: verticale.maxM, margeCreteM })
  return { ceilY: (p - verticale.moyenneM) * verticale.blocParMetre, plafondM: p }
}

/** L'inverse : une hauteur de bloc relue en mètres au-dessus de la mer. */
export function hauteurBlocEnM(y, verticale) {
  return verticale.moyenneM + y / verticale.blocParMetre
}

/**
 * LA COLONNE PEUPLÉE : base et plafond en unités de bloc, avec le plancher
 * marin de R20 bis (`Math.max(base, mer + 0,5)`, épaisseur conservée). C'est
 * la loi de `clouds2.build`, sortie ici pour être exécutée par les tests.
 */
export function colonneNuages({ ceilY, spread, eau }) {
  const s = Math.max(0, Math.min(1, spread))
  const baseVoulue = ceilY * (1 - s)
  const epaisseur = Math.max(ceilY - baseVoulue, 1e-3)
  const baseY = Number.isFinite(eau) ? Math.max(baseVoulue, eau + 0.5) : baseVoulue
  return { baseY, topY: baseY + epaisseur, epaisseur }
}

/**
 * RE-ÉTAGER UNE HAUTEUR quand la colonne change d'échelle (nouveau palier,
 * nouvelle exagération) : la position relative dans la colonne est conservée.
 */
export function reetagerY(y, avant, apres) {
  const bande = Math.max(1e-6, avant.topY - avant.baseY)
  const t = (y - avant.baseY) / bande
  return apres.baseY + t * (apres.topY - apres.baseY)
}

/** Part de l'épaisseur de la couche sur laquelle la présence s'éteint, de part et d'autre. */
export const MARGE_PRESENCE = 0.2

/**
 * LA PRÉSENCE DU CIEL SELON LA HAUTEUR DE LA CAMÉRA — « la caméra vole dans
 * la couche ». Mesuré au banc APRÈS le passage en mètres : à z14, caméra au
 * repos à 5 614 m DANS la couche (3 596 → 6 000 m), **304 033 pixels de nuage
 * sur 1 024 000 — 30 % de l'écran**, un seul nuage à 140 m de l'objectif. C'est
 * la classe de N1 (« la moitié de l'écran est un nuage ») par un autre chemin.
 *
 * ➡️ 1 quand la caméra est franchement AU-DESSUS (elle voit la couche de haut)
 * ou franchement EN DESSOUS (elle la voit de bas), 0 quand elle est DEDANS,
 * fondu sur `marge × épaisseur` de chaque côté. Pas de coupe franche.
 *
 * @param {number} camY hauteur de la caméra en unités de BLOC
 * @param {number} baseY base de la colonne (bloc)
 * @param {number} topY plafond de la colonne (bloc)
 * @returns {number} facteur 0..1 appliqué à la densité
 */
export function presenceSelonCamera(camY, baseY, topY, marge = MARGE_PRESENCE) {
  const ep = Math.max(1e-6, topY - baseY)
  const m = Math.max(1e-6, marge * ep)
  const lisse = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u) }
  // 0 sous base − m, 1 à partir de base ; et 1 jusqu'à top, 0 à partir de top + m
  const dedansBas = lisse((camY - (baseY - m)) / m)
  const dedansHaut = 1 - lisse((camY - topY) / m)
  return 1 - dedansBas * dedansHaut
}

/**
 * L'ATTÉNUATION AU BORD DU SOCLE — N2. Miroir JS de la ligne GLSL de
 * `clouds2.js` (`uBorne`, `uBorneFondu`) : 1 à l'intérieur, fondu sur
 * `bande` unités jusqu'au bord, 0 dehors. `demi = 0` désactive (hors crop).
 */
export function attenuationBorne(x, z, demi, bande = BANDE_FONDU_BORNE) {
  if (!(demi > 0)) return 1
  const d = Math.max(Math.abs(x), Math.abs(z))
  const t = Math.min(1, Math.max(0, (d - (demi - bande)) / Math.max(1e-6, bande)))
  return 1 - t * t * (3 - 2 * t)
}
