// L'ÉCLAIRAGE DU CROP — Tâche P3 du plan « LE STUDIO SUR LE GLOBE ».
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que `LUMA_709` de
// `naturel-crop.js`, pour ne pas écrire une seconde fois les poids de luminance
// que ce dépôt porte déjà. Tout se vérifie sous node (`test/crop-eclairage.test.js`).
//
// (Pas d'accent GRAVE dans les blocs `/* glsl */` plus bas : ils vivent dans des
// template literals JS et le termineraient — le piège que `terrain.js`,
// `ocean.js` et `naturel-crop.js` documentent tous les trois.)
//
// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
//
// > **L'agent noteur, 2026-08-22 (`notation-01.md`, §5.1) :** « Le socle est un
// > matériau ÉCLAIRÉ. La tuile du globe est une COULEUR NUE. »
//
// Sa mesure, sur des cadrages appariés à **0,0032 %** : couper l'hémisphère du
// socle lui retire **53,7 %** de sa richesse de teinte et **58,7 %** de ses
// neutres ; couper le soleil lui retire **43,3 %** de son énergie de détail.
// « L'hémisphère fabrique la couleur ; le soleil fabrique le relief. Le crop
// n'a ni l'un ni l'autre. »
//
// ⚠️ **ET LE CROP EN AVAIT UN TROISIÈME QUI MANQUAIT, QUE PERSONNE N'AVAIT
// NOMMÉ : L'ENVIRONNEMENT.** Relevé le 2026-08-22 dans l'application vivante,
// La Réunion z12, socle rallumé dans la même page, rendu sans compositeur dans
// une cible **demi-flottante** (donc en linéaire, sans écrêtage) :
//
//   · socle éclairé par un hémisphère BLANC d'irradiance 1 et rien d'autre
//     → le pixel vaut exactement `albedo / PI` (l'irradiance d'un hémisphère
//       blanc ne dépend pas de la normale : `mix(1, 1, w)` vaut 1) ;
//   · socle éclairé par le SEUL `scene.environment`, à son intensité vivante,
//     **moins** le spéculaire mesuré à part (albédo forcé à noir) ;
//   · le rapport des deux, par pixel, sur **133 786 pixels** :
//     **E_env = (2,0155 · 2,0153 · 2,0152)**, écart-type 0,3575 (17,7 %).
//
// ⚡ **L'environnement pèse donc plus que le soleil et l'hémisphère réunis dans
// l'ambiante, et il est RIGOUREUSEMENT NEUTRE** — c'est lui, la source des
// « neutres » que le noteur trouve 5,7 fois trop rares sur le crop. Un portage
// qui n'aurait pris que les deux lampes nommées aurait rendu un crop trop
// sombre et trop coloré, et la mesure l'aurait dit.
//
// ⚠️ **TÉMOIN NUL DE CETTE MESURE, ET IL EST UNE PREUVE, PAS UN BANC VIDE** :
// toutes lampes éteintes et environnement débranché, le rendu vaut **0 sur les
// 3 072 000 canaux** ; deux rendus consécutifs du même état diffèrent de **0
// canal** ; et le même état allumé porte **184 229 pixels** non nuls. Les
// relevés bruts sont dans `.banc/vues-P3/`.
//
// ══════════ 1. LA LOI N'EST PAS INVENTÉE : ELLE EST CELLE DE three.js ═══════
//
// ⛔ **POSER UNE SECONDE LOI D'ÉCLAIRAGE SERAIT LA FAUTE QUE D13 §③ INTERDIT.**
// Ce que le socle applique n'est pas une recette maison : c'est le chemin
// Lambert de `MeshPhysicalMaterial`, écrit dans `three/src/renderers/shaders/` :
//
//   · `bsdfs.glsl.js`            — `BRDF_Lambert(d) = RECIPROCAL_PI * d`
//   · `lights_pars_begin.glsl.js`— `getHemisphereLightIrradiance` :
//                                  `mix(groundColor, skyColor, 0.5 * dotNL + 0.5)`
//   · `lights_fragment_begin`    — direct : `irradiance = dotNL * directLight.color`
//
// **`test/crop-eclairage.test.js` LIT CES FICHIERS DANS `node_modules` et exige
// que les fonctions ci-dessous les suivent terme à terme.** Ce n'est pas une
// transcription qu'on promet d'entretenir : c'est une transcription qui rougit
// le jour où three change d'avis.
//
// ⚠️ **`light.color` PORTE DÉJÀ L'INTENSITÉ** (`WebGLLights` :
// `color.copy(light.color).multiplyScalar(light.intensity)`). Les uniformes de
// ce module sont donc des IRRADIANCES, pas des couleurs : c'est l'appelant qui
// multiplie, une seule fois, et le nuanceur n'a pas à savoir qu'il existe une
// intensité.
//
// ══════════ 2. L'ALBÉDO — ET IL N'EST PAS `col` ═════════════════════════════
//
// ⛔ **LA TÂCHE P2 A LAISSÉ `mapTint` EN ÉCRIVANT « il n'y a rien contre quoi
// doser ». C'ÉTAIT VRAI, ET ÇA NE L'EST PLUS.** Son argument était que la tuile
// du globe est un `ShaderMaterial` nu : « ni albédo, ni matière de surface ».
// Dès qu'on lui donne une lumière, la couleur de rampe DEVIENT un albédo, et
// `mapTint` retrouve exactement le sens qu'il a dans `terrain.js` :
//
//     diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * paintShade, effTint)
//                                                        (terrain.js:1137)
//
// **Vérifié dans l'application vivante, pas déduit** : trois rendus du socle au
// même instant, `uTint` posé à 0, à 1, puis à sa valeur vivante (0,68), et
// `mix(albédo₀, albédo₁, 0,68)` reproduit l'albédo vivant à **7,5 × 10⁻⁵** de
// moyenne sur **182 997 pixels**. La loi est donc celle-là, et pas une autre.
//
// Le fond contre lequel la peinture est dosée est `params.color` × la **valeur
// par sommet** que `terrain.js` cuit (« vertex tint: height-graded value +
// slope darkening + grain jitter »). ⚠️ **Ce fond n'est pas décoratif : c'est
// 32 % de l'albédo du socle, il est presque neutre, et il monte avec
// l'altitude.** C'est lui, avec l'environnement, qui fabrique les neutres.
//
// ⚠️ **CE QUI N'EST PAS PORTÉ, ET JE LE DIS PLUTÔT QUE DE LE TAIRE :** le
// `tint[i] * 0.05` de `terrain.js` (deux octaves de simplex PRÉ-CUITES sur la
// grille du bloc, `detail-noise.js`). Il vaut ±0,05 sur un terme qui pèse 0,32
// de l'albédo, soit **±1,6 %** — et le nuanceur du globe porte déjà son propre
// grain de papier au même endroit de la chaîne. Le porter demanderait de cuire
// le champ de bruit du bloc pour le crop ; ce n'est pas le poste n° 1.

import { LUMA_709 } from './naturel-crop.js'

// ══════════ LES CONSTANTES, ET CHACUNE REMONTE À UNE LIGNE DU DÉPÔT ═════════

/** `BRDF_Lambert` — `three/src/renderers/shaders/ShaderChunk/bsdfs.glsl.js`. */
export const RECIPROQUE_PI = 0.3183098861837907

// `terrain.js`, « vertex tint » : `lerp(0.62, 0.95, max(0, hn) ** 0.85)`.
export const GRIS_BAS = 0.62
export const GRIS_HAUT = 0.95
export const GRIS_EXPO = 0.85
// `terrain.js`, même ligne : `*= lerp(0.78, 1.0, max(0, ny) ** 0.6)`.
export const PENTE_BAS = 0.78
export const PENTE_HAUT = 1.0
export const PENTE_EXPO = 0.6
// `terrain.js` : `float fxShade = clamp(luma * 2.4, 0.2, 1.4);`
export const OMBRE_GAIN = 2.4
export const OMBRE_MIN = 0.2
export const OMBRE_MAX = 1.4

const D2R = Math.PI / 180

/**
 * Les défauts MONDE : l'éclairage éteint, et des valeurs qui ne peuvent rien
 * peindre si quelqu'un les lisait quand même.
 *
 * ⚠️ **MÊME GARDE ET MÊME RAISON QUE `uCropOn`, `uHabOn`, `uMerRampeOn` ET
 * `uMppFacteur`** : le nuanceur des tuiles est PARTAGÉ par toutes les tuiles du
 * globe, y compris celles qui ne verront jamais de crop. Sans `poserEclairage`,
 * la vue orbitale en production rend exactement ce qu'elle rendait, au bit près.
 */
export const ECLAIRAGE_MONDE = Object.freeze({
  soleilIrr: Object.freeze([0, 0, 0]),
  cielIrr: Object.freeze([0, 0, 0]),
  solIrr: Object.freeze([0, 0, 0]),
  albedoBase: Object.freeze([1, 1, 1]),
  albedoTeinte: 1,
})

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * La valeur par sommet du socle, en fonction de l'altitude normalisée et de
 * l'inclinaison — `terrain.js`, boucle « vertex tint ».
 *
 * ⚠️ **`Math.max(0, …)` AUX DEUX ENDROITS, ET CE N'EST PAS UNE PRÉCAUTION DE
 * STYLE** : `Math.pow(x, 0.85)` rend **NaN** pour `x < 0`, et `terrain.js`
 * documente en douze lignes le sommet qui passe sous `minH` sur un champ alpin
 * (421 à 433 sommets sur 4 225 mesurés). Le globe lit `hNormRelief`, déjà borné
 * — la borne est donc redondante ICI et indispensable dans le jumeau, ce qui
 * est exactement la raison de la porter dans la loi et pas au point d'usage.
 *
 * @param {number} hn altitude normalisée sur l'amplitude COMPLÈTE du champ
 * @param {number} ny cosinus entre la normale et la verticale locale
 */
export function natGris(hn, ny) {
  const v = lerp(GRIS_BAS, GRIS_HAUT, Math.pow(Math.max(0, hn), GRIS_EXPO))
  return v * lerp(PENTE_BAS, PENTE_HAUT, Math.pow(Math.max(0, ny), PENTE_EXPO))
}

/**
 * Le dosage de la peinture contre la matière — `terrain.js`, `fxShade`.
 * @param {number} lum luminance 709 du fond
 */
export function natOmbrePeinture(lum) {
  return clamp(lum * OMBRE_GAIN, OMBRE_MIN, OMBRE_MAX)
}

/** La luminance 709 d'un triplet — les mêmes poids que `natLuminance` (GLSL). */
export function natLum(c) {
  return c[0] * LUMA_709[0] + c[1] * LUMA_709[1] + c[2] * LUMA_709[2]
}

/**
 * L'albédo du crop : le fond du socle, et la peinture dosée dessus.
 * Transcription de `terrain.js:1137` — `mix(diffuseColor, mapCol * paintShade, effTint)`.
 *
 * @param {number[]} mapCol la couleur de rampe, LINÉAIRE (la table est en sRGB,
 *   le GPU la décode) — c'est `col` dans le nuanceur des tuiles
 * @param {number[]} base `params.color`, linéaire
 * @param {number} gris la valeur par sommet (`natGris`)
 * @param {number} teinte `mapTint`
 */
export function albedoCrop(mapCol, base, gris, teinte) {
  const fond = [base[0] * gris, base[1] * gris, base[2] * gris]
  const ombre = natOmbrePeinture(natLum(fond))
  return [
    lerp(fond[0], mapCol[0] * ombre, teinte),
    lerp(fond[1], mapCol[1] * ombre, teinte),
    lerp(fond[2], mapCol[2] * ombre, teinte),
  ]
}

/**
 * L'irradiance qui tombe sur une normale : soleil + hémisphère + ambiante.
 *
 * ⚠️ **LES TROIS TERMES SONT ADDITIFS ET DANS CET ORDRE, PARCE QUE C'EST CE QUE
 * FAIT `lights_fragment_begin`** : l'indirecte (hémisphère + sonde) est
 * accumulée dans `irradiance`, la directe est ajoutée par `RE_Direct`, et les
 * deux passent par le MÊME `BRDF_Lambert`. Les séparer en deux lois — l'une
 * multiplicative, l'autre additive — serait la faute de D13 §③.
 *
 * @param {number} ndl `max(dot(N, L), 0)` — `dotNL` de three
 * @param {number} ndu `dot(N, haut)` — `dotNL` de l'hémisphère, NON borné :
 *   c'est tout l'intérêt d'une lampe hémisphérique que sa face basse reçoive la
 *   couleur du sol
 */
export function irradianceCrop(ndl, ndu, soleil, ciel, sol) {
  const w = 0.5 * ndu + 0.5
  const d = Math.max(ndl, 0)
  return [
    soleil[0] * d + lerp(sol[0], ciel[0], w),
    soleil[1] * d + lerp(sol[1], ciel[1], w),
    soleil[2] * d + lerp(sol[2], ciel[2], w),
  ]
}

/**
 * La chaîne entière — le jumeau JS de ce que le nuanceur évalue.
 * @returns {number[]} la couleur LINÉAIRE de sortie
 */
export function eclairerCrop({ mapCol, base, teinte, hn, ndu, ndl, soleil, ciel, sol }) {
  const albedo = albedoCrop(mapCol, base, natGris(hn, Math.max(0, ndu)), teinte)
  const irr = irradianceCrop(ndl, ndu, soleil, ciel, sol)
  return [albedo[0] * irr[0] * RECIPROQUE_PI, albedo[1] * irr[1] * RECIPROQUE_PI, albedo[2] * irr[2] * RECIPROQUE_PI]
}

// ══════════ 3. LE REPÈRE — ET C'EST LE VRAI BRANCHEMENT DE CETTE TÂCHE ══════
//
// ⛔ **LE SOLEIL DU GLOBE N'EST PAS LE SOLEIL DE LA SCÈNE, ET IL NE L'EST
// JAMAIS EN MODE SURFACE.** Relevé dans `main.js` (boucle d'image) :
//
//     _orbSun.copy(camGlobe.position).normalize().applyAxisAngle(_upY, -0.73)
//     globe.setSunDir(_orbSun)
//
// C'est-à-dire : **le soleil du globe SUIT LA CAMÉRA**, décalé de 42°, pour que
// la face visible de la planète ne soit jamais dans la nuit. Le commentaire du
// dépôt le dit en toutes lettres (« un soleil de scène laisserait la moitié du
// fond dans la nuit »), et c'est un bon choix — **pour une planète**.
//
// ⚠️ **POUR UN BLOC, C'EST LE CONTRAIRE DE CE QU'IL FAUT** : l'ombrage du crop
// ne dépendait donc pas de l'heure, mais de l'endroit d'où on regarde. Relevé
// le 2026-08-22, La Réunion, drapeau levé : `uSunDir = (0,2282 · −0,3679 ·
// 0,9014)` pendant que le soleil de la scène pointait `(0,4392 · 0,5631 ·
// −0,7002)`. **Deux directions sans rapport, dont une seule est le soleil.**
//
// ➡️ Le crop reçoit donc SA PROPRE direction, dérivée de l'azimut et de
// l'élévation du cycle horaire, replacée dans le repère local du crop.
//
// **La correspondance des deux repères se lit dans le dépôt, elle ne se devine
// pas :**
//
//   · socle — `latLonToWorld` (`geo.js`) : `x` croît avec la LONGITUDE (est) et
//     `z` croît avec la coordonnée de tuile `y`, c'est-à-dire vers le SUD. Le
//     nord est donc `−z`, le haut `+y`.
//   · globe — `latLonToSphere` (`geo.js`) :
//     `p = R (cos φ sin λ, sin φ, cos φ cos λ)`, d'où par dérivation
//     `est = (cos λ, 0, −sin λ)` et `nord = (−sin φ sin λ, cos φ, −sin φ cos λ)`.
//   · le soleil, `placeSun` (`main.js`) :
//     `(cos az cos el, sin el, sin az cos el)` — sa composante `z` est donc
//     dirigée vers le SUD, et sa composante nord vaut `−sin az cos el`.

/** La verticale locale du crop, dans le repère du globe. */
export function hautLocal(latDeg, lonDeg) {
  const la = latDeg * D2R
  const lo = lonDeg * D2R
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
}

/**
 * La direction du soleil de la SCÈNE, replacée dans le repère local du crop.
 *
 * ⚠️ **`azDeg`/`elDeg` SONT CEUX DE `params`, ET `params` EST LE SEUL À LES
 * PORTER** : `applyTimeOfDay` les DÉRIVE de l'heure et du lieu (`daycycle.js`)
 * puis les écrit là. Lire `sun.position` à la place aurait marché aussi, mais
 * `sun.position` porte en plus le rayon 34 et l'atténuation rasante appliquée à
 * l'INTENSITÉ, pas à la direction : deux grandeurs pour une, et un jour où
 * `placeSun` change, deux lectures à corriger.
 *
 * @returns {number[]} un vecteur UNITAIRE dans le repère du globe
 */
export function directionSoleilLocale(azDeg, elDeg, latDeg, lonDeg) {
  const az = azDeg * D2R
  const el = elDeg * D2R
  const la = latDeg * D2R
  const lo = lonDeg * D2R
  const cEst = Math.cos(az) * Math.cos(el)
  const cHaut = Math.sin(el)
  const cNord = -Math.sin(az) * Math.cos(el)
  const est = [Math.cos(lo), 0, -Math.sin(lo)]
  const haut = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
  const nord = [-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)]
  const v = [
    est[0] * cEst + haut[0] * cHaut + nord[0] * cNord,
    est[1] * cEst + haut[1] * cHaut + nord[1] * cNord,
    est[2] * cEst + haut[2] * cHaut + nord[2] * cNord,
  ]
  const n = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}

/**
 * L'irradiance de l'environnement, à partir du coefficient MESURÉ pour la
 * texture courante (`src/sonde-ambiante.js`) et de l'intensité vivante.
 *
 * ⛔ **UNE SEULE INTENSITÉ, ET LA PREMIÈRE VERSION EN METTAIT DEUX.** Elle
 * multipliait aussi par `material.envMapIntensity` (0,15 sur le relief). Or
 * `three` (`WebGLRenderer.js`, r172) ÉCRASE cet uniforme quand le matériau n'a
 * pas d'`envMap` à lui et que la scène en a une — et
 * `terrain.material.envMap === null`, relevé dans l'application. **`envMapIntensity`
 * est du code MORT sur le relief**, et le facteur 6,7 que ça donnait a été
 * attrapé par la mesure du socle, pas par la lecture du code.
 *
 * ⚠️ **ELLE REND UN CIEL ET UN SOL, ET L'APPELANT LES AJOUTE À LA LAMPE
 * HÉMISPHÉRIQUE.** Ce n'est pas un raccourci : l'irradiance d'un environnement
 * varie avec la normale (écart-type **17,7 %** mesuré sur le socle), et
 * `mix(sol, ciel, 0.5 · ndu + 0.5)` — la loi que three écrit déjà pour une
 * `HemisphereLight` — en est l'approximation du premier ordre. Les additionner
 * évite un troisième terme dans le nuanceur ET garde la loi unique.
 *
 * @param {{ciel:number[], sol:number[]}|null} coef ce que la sonde a mesuré
 * @param {number} envIntensite `scene.environmentIntensity`
 * @returns {{ciel:number[], sol:number[]}} deux irradiances linéaires
 */
export function irradianceAmbiante(coef, envIntensite) {
  const k = Number.isFinite(envIntensite) ? Math.max(0, envIntensite) : 0
  const c = coef && Array.isArray(coef.ciel) && Array.isArray(coef.sol) ? coef : null
  if (!c || k === 0) return { ciel: [0, 0, 0], sol: [0, 0, 0] }
  return {
    ciel: [c.ciel[0] * k, c.ciel[1] * k, c.ciel[2] * k],
    sol: [c.sol[0] * k, c.sol[1] * k, c.sol[2] * k],
  }
}

export const GLSL_OMBRE_PEINTURE = /* glsl */ `
float natOmbrePeinture(float lum) {
  return clamp(lum * ${OMBRE_GAIN}, ${OMBRE_MIN}, ${OMBRE_MAX});
}
`

export const GLSL_ECLAIRAGE = /* glsl */ `
// ═══ L'ECLAIRAGE DU CROP — src/monde/eclairage-crop.js, Tache P3 ═══════════
// Le texte ci-dessous est INJECTE depuis le module : il n'y a pas deux
// ecritures de cette loi a garder d'accord, il y en a une.
// ⚠️ natLuminance vient de GLSL_NATUREL, injecte AVANT celui-ci.
float natGris(float hn, float ny) {
  float v = mix(${GRIS_BAS}, ${GRIS_HAUT}, pow(max(hn, 0.0), ${GRIS_EXPO}));
  return v * mix(${PENTE_BAS}, ${PENTE_HAUT.toFixed(1)}, pow(max(ny, 0.0), ${PENTE_EXPO}));
}
${GLSL_OMBRE_PEINTURE}
vec3 albedoCrop(vec3 mapCol, vec3 base, float gris, float teinte) {
  vec3 fond = base * gris;
  return mix(fond, mapCol * natOmbrePeinture(natLuminance(fond)), teinte);
}
vec3 irradianceCrop(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol) {
  return soleil * max(ndl, 0.0) + mix(sol, ciel, 0.5 * ndu + 0.5);
}
vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, float ndl,
                  vec3 soleil, vec3 ciel, vec3 sol) {
  vec3 albedo = albedoCrop(mapCol, base, natGris(hn, ndu), teinte);
  return albedo * irradianceCrop(ndl, ndu, soleil, ciel, sol) * ${RECIPROQUE_PI};
}
`
