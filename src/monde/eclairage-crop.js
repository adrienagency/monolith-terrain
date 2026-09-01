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

/**
 * Le repère de sol en un point de la sphère : est, nord, haut.
 *
 * ⚠️ **UNE SEULE ÉCRITURE DES TROIS VECTEURS, ET C'EST LA TÂCHE P10 QUI L'A
 * IMPOSÉE.** Ils étaient écrits DEUX fois dans ce fichier — `hautLocal` et le
 * corps de `directionSoleilLocale` — et la normale par fragment en aurait
 * demandé une troisième, en GLSL. « Deux écritures jumelles finiraient par
 * diverger » (`terrain.js`) : les deux appellent désormais celle-ci, et le
 * jumeau GLSL est `GLSL_REPERE_SOL`, INJECTÉ dans le nuanceur de sommets.
 *
 * ⚡ **ET LE TRIÈDRE EST DIRECT** : `est × nord = haut`, donc
 * `haut × est = nord` — c'est ce qui permet au nuanceur de fragment de
 * n'interpoler que DEUX varyings et de retrouver le troisième par un produit
 * vectoriel.
 *
 * @param {number} latDeg latitude en degrés
 * @param {number} lonDeg longitude en degrés
 * @returns {{est:number[], nord:number[], haut:number[]}}
 */
export function repereSolSphere(latDeg, lonDeg) {
  const la = latDeg * D2R
  const lo = lonDeg * D2R
  const cla = Math.cos(la)
  const sla = Math.sin(la)
  const clo = Math.cos(lo)
  const slo = Math.sin(lo)
  return {
    est: [clo, 0, -slo],
    nord: [-sla * slo, cla, -sla * clo],
    haut: [cla * slo, sla, cla * clo],
  }
}

/** La verticale locale du crop, dans le repère du globe. */
export function hautLocal(latDeg, lonDeg) {
  return repereSolSphere(latDeg, lonDeg).haut
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
  const cEst = Math.cos(az) * Math.cos(el)
  const cHaut = Math.sin(el)
  const cNord = -Math.sin(az) * Math.cos(el)
  const { est, nord, haut } = repereSolSphere(latDeg, lonDeg)
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

/**
 * L'ENVIRONNEMENT QU'UN MATÉRIAU VOIT VRAIMENT — Tâche P8.
 *
 * ⛔ **CE N'EST PAS UNE COMMODITÉ, C'EST LA RÈGLE DE `three`, ET LE CROP EN
 * MANQUAIT LA MOITIÉ SUR SES PAROIS.** `WebGLRenderer.js` (r172) :
 *
 *     if ( material.isMeshStandardMaterial && material.envMap === null
 *          && scene.environment !== null )
 *         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
 *
 * Autrement dit : **un matériau qui porte SON PROPRE `envMap` ne voit ni
 * `scene.environment` ni `scene.environmentIntensity`** — il voit SA texture, à
 * SON intensité. `irradianceAmbiante` (juste au-dessus) cite déjà cette ligne
 * pour conclure qu'`envMapIntensity` est du code MORT sur le relief
 * (`terrain.material.envMap === null`, relevé). ⚡ **L'AUTRE MOITIÉ DE LA MÊME
 * LIGNE N'AVAIT JAMAIS ÉTÉ TIRÉE : LA PAROI DU SOCLE, ELLE, A SON PROPRE
 * `envMap`.** `plinth.js` l'écrit en toutes lettres à `setEnvMap` — *« give the
 * socle walls their own studio env map (overrides scene.environment for this
 * material only… while the terrain keeps the neutral room env) »* — et
 * `main.js` lui pose `makeSocleEnvMap(renderer)`, une pièce SOMBRE (fond
 * `0x15171d`, sol noir) à `envMapIntensity = 1`.
 *
 * ⚡ **LES DEUX AMBIANTES, MESURÉES AU MÊME INSTANT DANS LA PAGE VIVANTE**
 * (2026-08-22, La Réunion z12, `.banc/P8/S3-ambiante-P8.json`), irradiance
 * versée à plat sur une paroi VERTICALE (`ndu = 0`) :
 *
 *   · relief (`scene.environment` × `scene.environmentIntensity = 0,395`)
 *     → **(1,526 · 1,526 · 1,526)**, rigoureusement neutre ;
 *   · paroi (`wallMat.envMap` × `envMapIntensity = 1`)
 *     → **(0,989 · 0,947 · 0,931)**.
 *
 * **La paroi du crop prenait la PREMIÈRE**, celle du relief. Elle en sortait
 * **1,68 fois trop claire** (face sombre 26,63 contre 15,88 au socle) pour un
 * contraste inter-faces **1,52 fois trop faible** — les deux constantes que la
 * notation-02 §5 nomme.
 *
 * ⚠️ **ET LA CAUSE EST PROUVÉE EN LA BOUGEANT DES DEUX CÔTÉS** (leçon de P6 :
 * une concordance au défaut n'est pas un branchement) :
 *   · retirer son studio à la paroi DU SOCLE — elle retombe alors sur
 *     `scene.environment`, c'est-à-dire sur la source du crop — la fait sauter
 *     de **15,88 à 38,11** et effondre son contraste de **3,045 à 1,405** ;
 *   · donner l'ambiante DE LA PAROI au crop le fait tomber de **26,63 à 17,87**
 *     et monte son contraste de **2,008 à 2,490**.
 *   **Les deux aller-retours rendent le chiffre de départ.**
 *
 * @param {object|null} envMap la texture propre au matériau
 * @param {number} envMapIntensite son intensité à lui
 * @param {object|null} sceneEnv `scene.environment`
 * @param {number} sceneIntensite `scene.environmentIntensity`
 * @returns {{texture: object|null, intensite: number}} ce que `three` fait lire
 */
export function environnementEffectif(envMap, envMapIntensite, sceneEnv, sceneIntensite) {
  if (envMap) return { texture: envMap, intensite: Number.isFinite(envMapIntensite) ? Math.max(0, envMapIntensite) : 1 }
  if (sceneEnv) return { texture: sceneEnv, intensite: Number.isFinite(sceneIntensite) ? Math.max(0, sceneIntensite) : 1 }
  return { texture: null, intensite: 0 }
}

export const GLSL_OMBRE_PEINTURE = /* glsl */ `
float natOmbrePeinture(float lum) {
  return clamp(lum * ${OMBRE_GAIN}, ${OMBRE_MIN}, ${OMBRE_MAX});
}
`

/**
 * L'IRRADIANCE SEULE, détachable — Tâche P6.
 *
 * ⚠️ **PARCE QUE LES PAROIS N'ONT NI RAMPE NI PEINTURE, DONC PAS
 * `natLuminance`.** `GLSL_ECLAIRAGE` ci-dessous en dépend (`GLSL_NATUREL` est
 * injecté avant lui dans le nuanceur des tuiles) ; celui des parois est un
 * `ShaderMaterial` NU qui n'a aucune des deux. Extraire ce seul morceau leur
 * donne **LA MÊME LOI, PAS UNE SECONDE** — et `GLSL_ECLAIRAGE` l'INTERPOLE au
 * lieu de la réécrire, donc il n'y a toujours qu'une écriture.
 */
export const GLSL_IRRADIANCE = /* glsl */ `
vec3 irradianceCrop(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol) {
  return soleil * max(ndl, 0.0) + mix(sol, ciel, 0.5 * ndu + 0.5);
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
// ══ LA MATIERE DU RELIEF — Tache R25 ═══════════════════════════════════════
// terrain.js dose la peinture avec un paintShade que le BRUIT DE MATIERE tire
// vers 1 (« la carte revelee est ramenee vers sa clarte naturelle, pas ombree
// par l albedo de la matiere »). Le crop avait la loi sans ce levier.
// ⚠️ UNE SEULE ECRITURE : albedoCrop DELEGUE, il ne recopie pas. Passer
// natOmbrePeinture(natLuminance(fond)) rend l ancienne loi AU BIT PRES.
vec3 albedoCropMat(vec3 mapCol, vec3 base, float gris, float teinte, float ombre) {
  return mix(base * gris, mapCol * ombre, teinte);
}
vec3 albedoCrop(vec3 mapCol, vec3 base, float gris, float teinte) {
  vec3 fond = base * gris;
  return albedoCropMat(mapCol, base, gris, teinte, natOmbrePeinture(natLuminance(fond)));
}
${GLSL_IRRADIANCE}
vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, float ndl,
                  vec3 soleil, vec3 ciel, vec3 sol) {
  vec3 albedo = albedoCrop(mapCol, base, natGris(hn, ndu), teinte);
  return albedo * irradianceCrop(ndl, ndu, soleil, ciel, sol) * ${RECIPROQUE_PI};
}
`

// ══════════ 6. LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════
//
// > **L'agent noteur, `notation-02.md` §5-5️⃣ :** *« Le crop rend 65,7 % de
// > l'énergie de détail du socle. Et le levier que notation-01 désignait est
// > désormais tiré sans effet : couper l'éclairage du crop ne lui coûte que
// > 4,22 % de son modelé, quand couper le soleil du socle lui en coûte 45,39 %.
// > Le crop est éclairé et reste plat. »*
//
// ⚡ **LA DÉCOMPOSITION QUI NOMME LA CAUSE**, mesurée dans la MÊME page, cadrage
// intérieur, masques appariés à **−0,155 %** (`.banc/P9/S5-relief-P9.json`,
// octet linéaire) :
//
// | | allumé | lumière coupée | part de la lumière |
// |---|---|---|---|
// | socle | **16,086** | **8,723** | **45,8 %** |
// | crop | 10,972 | **10,250** | **6,6 %** |
//
// ⛔ **LA COULEUR DU CROP EST DONC DÉJÀ PLUS RICHE QUE CELLE DU SOCLE — 10,250
// contre 8,723, soit +17,5 % — ET C'EST L'OMBRAGE QUI MANQUE, EN ENTIER.**
// C'est l'inverse de ce que le chantier cherchait : il n'y a pas de détail à
// AJOUTER à la peinture, il y a une lumière qui ne module rien.
//
// ⚠️ **ET LE GRAIN N'EST PAS LE LEVIER — MESURÉ, PAS SUPPOSÉ.** Le grain du
// socle (`terrain.js`, `_makeDemSampler`) vaut `detail = 0,02` UNITÉ DE SCÈNE
// sur `scale = 0,004 090` unité par mètre, c'est-à-dire **6,60 m de relief**,
// de longueur d'onde **611 m**. Posé sur le crop à sa valeur convertie
// (`grainForceM = 4,89`, `grainEchelle = 22,4`), il déplace l'énergie de détail
// de **10,972 à 10,972 — 0,000 %** ; il faut **×50** (244 m de relief inventé,
// 37 fois le socle) pour gagner **4,4 %**. Aller-retour à **0 canal**.
//
// ⚡ **UN OMBRAGE QUI NE MODULE PAS, C'EST UNE NORMALE QUI NE VARIE PAS — ET
// L'ARITHMÉTIQUE SUFFIT À LE DIRE.** Le maillage d'une tuile du globe est
// `gridFor(z) = 24` quads (`globe.js`), soit `(24 + 1)² = 625` sommets ; le crop
// de La Réunion en fait **3 × 3 tuiles**, donc **5 625 sommets** sur le bloc.
// Le socle, lui, maille le MÊME bloc à `resMaillage = 768`, soit **594 434
// sommets relevés dans la page vivante**. ⛔ **CENT CINQ FOIS PLUS, 10,7 fois
// par axe.** Relevé au même instant, la dispersion de `N · haut` : écart-type
// **0,2447** au socle contre **0,1994** au crop, et surtout un minimum de
// **−1** contre **0,2126** — le crop n'a AUCUNE face raide, elles ont toutes été
// moyennées.
//
// ⚠️ **ET LA DONNÉE, ELLE, EST LÀ** : la texture de hauteur d'une tuile fait
// **256 × 256**, que le nuanceur lit déjà par fragment (`decodeMetersAA`) pour
// la rampe et pour les courbes de niveau. **La couleur voit le relief fin ; la
// lumière ne le voyait pas.** D'où cette section : reconstruire la normale AU
// FRAGMENT depuis la hauteur que le fragment tient déjà.
//
// ══════════ ⛔ ET CETTE LOI-LÀ A ÉTÉ RETIRÉE — Tâche P10 ════════════════════
//
// **P9 a livré la loi de Mikkelsen** (`three`,
// `bumpmap_pars_fragment.glsl.js`), qui reconstruit la normale depuis les
// **dérivées d'écran** `dFdx`/`dFdy` de la hauteur. Elle a fermé le poste au
// repos — **68,3 % → 98,02 %** de l'énergie de détail du socle — et **P9 a
// déclaré n'avoir rien mesuré en mouvement** (sa réserve n° 4).
//
// ⛔ **LE NOTEUR L'A MESURÉ, ET LE PRIX ÉTAIT LOURD** (`notation-03.md` §4 ;
// données brutes `.banc/vues-notation-03/N3-mouvement-N03.json`). Le protocole
// n'a besoin ni d'horloge ni de parallaxe : on décale la caméra d'un nombre
// **entier de pixels** (`setViewOffset`), donc l'image rendue DOIT être l'image
// de départ translatée d'autant. Ce qui reste après recalage est le
// scintillement. Résidu moyen, en octets de luminance, cadrage intérieur :
//
// | décalage | socle | crop, normale fine ON | crop OFF |
// |---|---|---|---|
// | **1 px** | **0,030** | ⛔ **10,872** | 0,863 |
// | 2 px | 0,001 | **0,800** | 0,834 |
// | **3 px** | **0,030** | ⛔ **10,856** | 0,865 |
//
// ⚡ **ÉNORME AUX DÉCALAGES IMPAIRS, NUL AUX PAIRS : LA SIGNATURE NOMME LA
// CAUSE.** Un décalage PAIR conserve la parité des quads 2 × 2 sur lesquels le
// GPU évalue `dFdx`/`dFdy` ; un décalage IMPAIR la retourne, et la différence
// finie change de voisin. **38,49 % des pixels de surface bougeaient de plus de
// 8 octets pour UN SEUL pixel de caméra — 360 fois le socle.**
//
// ⚠️ **CE DÉFAUT NE SE RÈGLE PAS, IL CHANGE DE LOI.** Baisser le gain ne ferait
// que réduire l'amplitude d'un défaut STRUCTUREL : tant que le gradient est une
// différence finie prise sur le voisin d'ÉCRAN, il dépend de QUEL voisin, donc
// de la parité. **La sortie est de prendre le gradient là où la donnée vit :
// dans la texture de hauteur.**
//
// ══════════ LA LOI LIVRÉE — LE GRADIENT EN ESPACE TEXTURE ═══════════════════
//
// La surface du crop est un **champ de hauteur posé sur la sphère** : en un
// point, le sol a un repère orthonormé (est, nord, haut) et le relief monte le
// long de `haut`. La normale d'un tel champ est la définition même, sans une
// ligne de Mikkelsen :
//
//     N = normalize( haut − gEst · est − gNord · nord )
//
// où `gEst` et `gNord` sont les pentes **au sol**, c'est-à-dire les dérivées de
// la hauteur par unité de DISTANCE, les deux dans la même unité de longueur.
// Le sol monte vers l'est ⇒ la normale se penche vers l'ouest : le signe est
// lisible à l'œil, ce que la forme de Mikkelsen ne permettait pas.
//
// ⚡ **ET C'EST LA MÊME LOI, PAS UNE APPROXIMATION.** La formule de Mikkelsen
// est invariante par changement de paramétrage — `test/crop-eclairage.test.js`
// ⑧b l'assertait déjà pour l'échelle. Nourrie du paramétrage (est, nord), qui
// est ORTHONORMÉ, elle donne `R1 = nord × haut = est`, `R2 = haut × est = nord`
// et `det = est · est = 1` : elle **SE RÉDUIT** à l'expression ci-dessus.
// ⚡ **Le test ⑧a le rejoue terme à terme contre l'écriture de P9**, qui survit
// dans le seul fichier de test, comme oracle.
//
// ⚠️ **CE QU'ON GAGNE EN INVARIANCE, ET C'EST TOUT LE POINT.** Les trois
// vecteurs du repère viennent de `latlon` — un ATTRIBUT de sommet, donc une
// fonction exacte de la position, jamais du voisin d'écran. Les deux pentes
// viennent de quatre `texture2D` aux voisins en espace UV, à un pas qui ne
// dépend que de `vProfCam` (un varying) et d'uniformes. ⚡ **Aucune dérivée
// d'écran n'entre plus dans la normale : un décalage entier de caméra rend la
// même image, translatée.**
//
// ⚠️ **ET LA PRÉCISION N'EST PLUS UN SUJET.** P9 devait travailler en espace de
// VUE parce que `dFdx(P)` sur une coordonnée monde de magnitude 100 se noyait
// dans l'ulp float32 (0,38 m). Ici les trois vecteurs sont **unitaires** et la
// hauteur est lue en MÈTRES : il n'y a plus de grande magnitude à différencier,
// et le varying `vVue` de P9 disparaît avec la loi qu'il servait.
//
// ══════════ LE PAS DES QUATRE LECTURES, ET POURQUOI IL N'EST PAS UN TEXEL ═══
//
// ⚠️ **UN PAS D'UN TEXEL EST LA RÉPONSE ÉVIDENTE ET ELLE EST INCOMPLÈTE.** La
// texture de hauteur d'une tuile fait 256 (ou 512) texels ; au cadrage de la
// notation, le bloc en montre **plus d'un par pixel d'écran** — la texture est
// MINIFIÉE. Une différence centrée à un texel échantillonnerait donc plus fin
// que ce que l'écran peut porter, et nourrirait le crénelage que la notation
// reproche DÉJÀ au crop au repos (`notation-03.md` §3 ①).
//
// ➡️ **Le pas est donc le plus grand des deux : un texel, ou la demi-empreinte
// du pixel** — de sorte que la différence centrée couvre une empreinte
// complète, exactement la bande que `dFdx(h)` couvrait. C'est ce qui laisse
// l'ÉNERGIE de relief là où P9 l'a mise tout en retirant la parité.
//
// ⚡ **ET L'EMPREINTE SE LIT SANS UNE SEULE DÉRIVÉE D'ÉCRAN** : la Tâche K a
// posé `uMppFacteur`, les mètres de sol par pixel PAR UNITÉ DE DISTANCE CAMÉRA,
// et `vProfCam` porte la distance. `mppEcran = vProfCam × uMppFacteur` est donc
// une fonction de la POSITION — c'est justement pourquoi la Tâche K l'a écrite
// (« ni du niveau de la tuile, ni de l'inclinaison de la caméra »). ⚠️ **Et
// quand elle n'est pas posée (`uMppFacteur = 0`, la production), le pas retombe
// au texel : jamais sur `fwidth`, qui ramènerait la parité par la fenêtre.**

/**
 * La normale d'un champ de hauteur posé sur un plan tangent.
 *
 * ⚠️ **VECTEURS EN TABLEAUX DE TROIS, ET PAS DE `three`** : ce module est PUR
 * (voir l'en-tête), et `test/crop-eclairage.test.js` le rejoue sous node contre
 * un ORACLE INDÉPENDANT — la surface est construite point par point et sa
 * normale prise par un vrai produit vectoriel — PUIS contre la loi de Mikkelsen
 * de P9, qui survit dans le test comme second oracle.
 *
 * ⚠️ **LES DEUX PENTES SONT SANS DIMENSION** : `gEst` est la montée de la
 * surface par unité de distance vers l'est, dans la MÊME unité de longueur des
 * deux côtés. C'est l'appelant qui convertit — et c'est là que vit la faute de
 * MONNAIE que ce chantier a payée quatre fois.
 *
 * ⚠️ **LE CAS DÉGÉNÉRÉ REND `haut`**, jamais un vecteur nul : `normalize(0)`
 * plus loin rendrait NaN, et un NaN dans une normale peint un trou noir.
 *
 * @param {number} gEst pente au sol vers l'est
 * @param {number} gNord pente au sol vers le nord
 * @param {number[]} est vecteur unitaire vers l'est
 * @param {number[]} nord vecteur unitaire vers le nord
 * @param {number[]} haut vecteur unitaire vers le haut (la sphère nue)
 * @returns {number[]} la normale perturbée, normalisée
 */
export function normaleParGradientSol(gEst, gNord, est, nord, haut) {
  const v = [
    haut[0] - gEst * est[0] - gNord * nord[0],
    haut[1] - gEst * est[1] - gNord * nord[1],
    haut[2] - gEst * est[2] - gNord * nord[2],
  ]
  const l = Math.hypot(v[0], v[1], v[2])
  if (!(l > 0)) return [haut[0], haut[1], haut[2]]
  return [v[0] / l, v[1] / l, v[2] / l]
}

/**
 * Le texte GLSL du repère de sol — INJECTÉ dans le nuanceur de SOMMETS.
 *
 * ⚠️ **AU SOMMET ET PAS AU FRAGMENT, ET C'EST UNE ÉCONOMIE MESURABLE** :
 * `latlon` est un ATTRIBUT, donc quatre `sin`/`cos` par SOMMET — 5 625 sur le
 * bloc — au lieu de quatre par FRAGMENT, soit 144 631 au cadrage de la
 * notation. Le fragment ré-orthonormalise ce qu'il reçoit : l'interpolation
 * linéaire de deux vecteurs unitaires n'en rend pas un unitaire.
 */
export const GLSL_REPERE_SOL = /* glsl */ `
// ═══ LE REPERE DE SOL — src/monde/eclairage-crop.js, Tache P10 ═════════════
// La derivee de latLonToSphere (src/geo.js), pas une seconde convention :
// P = R (cos la sin lo, sin la, cos la cos lo), est = dP/dlo, nord = dP/dla.
// Triedre DIRECT : est x nord = haut, donc haut x est = nord.
void repereSolSphere(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut) {
  float la = radians(latDeg);
  float lo = radians(lonDeg);
  float cla = cos(la), sla = sin(la), clo = cos(lo), slo = sin(lo);
  est = vec3(clo, 0.0, -slo);
  nord = vec3(-sla * slo, cla, -sla * clo);
  haut = vec3(cla * slo, sla, cla * clo);
}
`

/**
 * Le texte GLSL de la loi — INJECTÉ dans le nuanceur de FRAGMENTS, jamais
 * recopié. ⚠️ **ELLE REND SA NORMALE DANS L'ESPACE DE SES ENTRÉES**, c'est-à-
 * dire en espace MONDE : plus de transposée à écrire, plus d'aller-retour, et
 * `nMondeDepuisVue` s'en va avec la loi de P9 qu'elle servait.
 */
export const GLSL_NORMALE_FINE = /* glsl */ `
// ═══ LA NORMALE PAR FRAGMENT — src/monde/eclairage-crop.js, Tache P10 ══════
// Le champ de hauteur pose sur le plan tangent, sans une ligne de Mikkelsen :
// on retranche a la verticale les deux pentes DE SOL. Le sol monte vers l'est,
// la normale se penche vers l'ouest. Les pentes sont SANS DIMENSION : c'est
// l'appelant qui convertit, et c'est la que vit la faute de monnaie.
vec3 normaleParGradientSol(float gEst, float gNord, vec3 est, vec3 nord, vec3 haut) {
  vec3 v = haut - gEst * est - gNord * nord;
  float l = length(v);
  return l > 0.0 ? v / l : haut;
}
`
