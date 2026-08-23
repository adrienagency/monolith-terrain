// LA RÉFRACTION DE LA LAME D'EAU, PARTAGÉE — Tâche R2 du plan « UNE SEULE
// TERRE » (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CETTE TÂCHE RÉPARE ══════════════════════════════════════
//
// > **Adrien, 2026-08-23 :** « La qualité de la mer a vraiment régressé, on
// > dirait qu'elle est quasiment transparente. Corrige la mer et rends-la
// > réaliste, avec réfraction, et tout le tralala. »
//
// ⚠️ **ET LE CONSTAT DU CAHIER DES CHARGES ÉTAIT FAUX SUR SON INVENTAIRE.** Il
// cherchait la matière d'eau du crop dans `src/monde/mer-sphere.js` — qui est un
// module de LOIS (flèche, budget de profondeur, géométrie de calotte) et n'a
// jamais porté de nuanceur. La matière du crop vit dans `src/globe.js`
// (`MER_VERT` / `MER_FRAG`), et les Tâches P4 et P6 y ont DÉJÀ branché le corps
// d'eau, le glacis de lagon, l'écume, le clapot de normale, le Fresnel en `^5`
// avec son plafond, le glint solaire et la nuit. **Cinq des sept postes que le
// cahier des charges déclarait absents existaient.**
//
// Ce qui manquait vraiment, mesuré dans l'application vivante le 2026-08-23 :
//
//   ① **la réfraction en espace écran** — aucune copie du tampon d'image côté
//      crop, donc aucun fond marin tordu par la pente de la surface ;
//   ② **l'ordre de composite** — `ocean.js` compose le fond réfracté DANS le
//      nuanceur (`mix(through, col, wOp)`) puis pose le ciel et le glint
//      PAR-DESSUS, à alpha 1. Le crop, lui, sortait `alpha = opac`, donc le
//      reflet de ciel et le glint étaient DILUÉS par la transparence — le défaut
//      exact qu'`ocean.js` documente en v44 : « les reflets sont des reflets DE
//      SURFACE : ils s'appliquent APRÈS le composite, sinon ils sont dilués
//      comme s'ils venaient du fond — le glint avait disparu (Adrien) ».
//
// ══════════ POURQUOI CE FICHIER EXISTE ═════════════════════════════════════
//
// Règle D13 §③ : « ① ADAPTER en place · ② EXTRAIRE en module pur partagé dans
// `src/monde/` · ③ COPIER en dernier recours ». Ce fichier est le ②, et il suit
// le précédent de `naturel-crop.js` : `ocean.js` ET `globe.js` **injectent le
// MÊME texte GLSL**, il n'y a donc qu'une seule écriture de la loi, et
// `test/eau-refraction.test.js` TRADUIT ce texte et l'EXÉCUTE contre les jumeaux
// JS d'en dessous — pas une recherche de nom, une exécution.
//
// Module PUR : ni DOM, ni three.js, ni état. Testable sous node.
//
// ══════════ LES UNITÉS, ET IL N'Y EN A QU'UNE À CONVERTIR ══════════════════
//
// ⚠️ **LE DÉCALAGE DE RÉFRACTION EST EN UV D'ÉCRAN DES DEUX CÔTÉS.** `0,09` ne
// s'exprime ni en unités de bloc ni en unités de scène : il multiplie une
// composante de normale UNITAIRE (donc sans dimension) et le résultat s'ajoute à
// `gl_FragCoord.xy / résolution`, c'est-à-dire à une fraction d'écran. **Il n'y
// a donc RIEN à convertir sur le gain** — et c'est la réponse à la question des
// unités, pas son esquive. La conversion nécessaire est ailleurs : c'est celle
// du REPÈRE de la normale, et elle avait été manquée.
//
// ⚠️ **LA NORMALE DE LA MER DU CROP VIT DANS LE REPÈRE LOCAL DU CROP, PAS DANS
// LE MONDE.** `MER_VERT` écrit `vNormMer = normalize(vec3(-nAcc.x, 1.0 - nAcc.y,
// -nAcc.z))` à partir de coordonnées LOCALES (`p.x`, `p.z`), donc son « haut »
// est `(0, 1, 0) LOCAL`. Le fragment, lui, la confrontait à `V = cameraPosition
// − vMonde`, qui est en repère MONDE. **Mesuré dans l'application vivante le
// 2026-08-23, La Réunion, `?terre=unique` :** le haut local du crop tombe sur
// `(0,7705 ; −0,3624 ; 0,5243)` en monde, soit **111,25° d'écart** ; au centre de
// la nappe `dot(N_local, V) = −0,7519` quand `dot(N_monde, V) = +0,5024`. Le
// premier est négatif, donc écrêté à zéro, donc `fres = min(pow(1, 5), 0.5)` =
// **0,5, le PLAFOND** — au lieu de **0,0305**. Un facteur **16,4**, saturé sur
// toute la nappe. Conséquence directe : `mix(col, uSky, fres * 0.35)` lavait la
// mer de **17,5 %** de couleur de ciel au lieu de **1,07 %**. **C'est ça, « on
// dirait qu'elle est quasiment transparente ».**
//
// ➡️ **DEUX USAGES, DEUX REPÈRES, ET C'EST VOULU** :
//
//   · **le décalage de réfraction** prend la pente HORIZONTALE de la surface
//     dans le repère de la nappe. Côté socle c'est `N.xz` (le monde, dont le
//     haut EST celui de la mer) ; côté crop c'est `nLocal.xz` (le local, dont le
//     haut est celui de la nappe). **Ce sont les mêmes deux nombres**, aucune
//     conversion, et le décalage reste solidaire du bloc de chaque côté.
//   · **le Fresnel et le glint** dotent la normale avec `V` et `L`, qui sont en
//     monde des deux côtés. Le socle y est déjà ; le crop doit convertir sa
//     normale par la rotation de son repère (`uMerVersMonde`).
//
// ⚠️ **ET LE FONDU DE RIVE EST LA MÊME GRANDEUR DES DEUX CÔTÉS, VÉRIFIÉ** :
// `ocean.js` écrit `vFade = fonduRessacMer(shoreD)` (ligne 282) et `MER_VERT`
// écrit `vFonduRive = fonduRessacMer(declin)`. Même fonction, même entrée
// normalisée. Le `(0.3 + 0.7 · fondu)` se transcrit donc à l'identique.

/**
 * Les trois nombres du décalage de réfraction d'`ocean.js` (ligne 600), et le
 * quatrième de son échantillonnage (ligne 603).
 *
 * ⚠️ **AUCUN N'EST CHOISI ICI** : ce sont ceux du dépôt, relevés à la ligne.
 * `0,09` est le gain, en UV d'écran par unité de pente. `0,3` est le plancher de
 * réfraction au large et `0,7` le poids que le fondu de rive lui ajoute —
 * `ocean.js` explique le plancher : « la réfraction reste ACTIVE près des côtes
 * (0.3 plancher) : c'est là que le fond a du détail à tordre ; au large un fond
 * uniforme ne montre rien, l'ancien `*vFade` l'éteignait donc exactement où elle
 * se voyait ». `0,999` (et son miroir `0,001`) borne l'échantillonnage pour que
 * le décalage n'aille jamais chercher un texel hors du tampon copié.
 */
export const REFRACTION = Object.freeze({
  gain: 0.09,
  plancherRive: 0.3,
  poidsRive: 0.7,
  borne: 0.999,
  // ⚠️ **ÉCRITE, PAS CALCULÉE PAR `1 − borne`.** `ocean.js` porte les deux
  // littéraux (`vec2(0.001)` et `vec2(0.999)`), et `1 − 0,999` vaut
  // `0.0010000000000000009` en double : le jumeau JS et le texte GLSL auraient
  // divergé au douzième chiffre, ce qui suffit à faire mentir une comparaison
  // stricte. Le test ① vérifie que les deux littéraux sont bien ceux du dépôt.
  borneBasse: 0.001,
})

/**
 * La force de réfraction NEUTRE : le `??` d'`ocean.js`.
 *
 * ⚠️ **C'EST UN `??` DU DÉPÔT, PAS UN NOMBRE CHOISI ICI** :
 * `uRefract: { value: params.seaRefract ?? 0.6 }` (`ocean.js`), et
 * `seaRefract: 0.6` (`main.js`). Sans mer de socle à lire, le crop prend
 * exactement ça — la même règle que `LAME_EAU_NEUTRE` d'`ecume-mer.js`.
 */
export const REFRACTION_NEUTRE = 0.6

/**
 * La force de réfraction VIVANTE du socle, ou le neutre s'il n'y en a pas.
 *
 * ⚠️ **ELLE VIT ICI ET PAS DANS `ecume-mer.js`, ET C'EST UN INVARIANT DU DÉPÔT
 * QUI LE DIT** : `test/ecume-mer.test.js` ③c exige que `ecume-mer.js` n'ait
 * AUCUNE importation (« chargeable sous node »). Y ajouter un cinquième réglage
 * de lame aurait demandé soit de casser cette garde, soit de recopier `0,6` —
 * les deux mauvaises. La réfraction a donc son propre lecteur, du même patron :
 * il LIT, il ne calcule rien, et un uniforme absent rend SA valeur neutre.
 *
 * ⚠️ **RELEVÉ À 0,34 SUR LA PAGE VIVANTE DU 2026-08-23**, pas à `0,6` : un
 * gabarit pose cette tirette. Sans cette lecture, la mer du crop aurait
 * réfracté **1,76 fois** trop fort.
 *
 * @param {object|null} uniformes les uniformes du matériau de mer du socle
 * @returns {number} la force de réfraction
 */
export function refractionDuSocle(uniformes) {
  const v = uniformes?.uRefract?.value
  return Number.isFinite(v) ? v : REFRACTION_NEUTRE
}

/**
 * Le décalage de réfraction, composante par composante.
 *
 * Le jumeau JS de `decalageRefraction` du GLSL ci-dessous. `pente` est la paire
 * horizontale de la normale de surface DANS LE REPÈRE DE LA NAPPE (voir l'en-tête).
 *
 * @param {[number, number]} pente les deux composantes horizontales de la normale
 * @param {number} force la tirette `uRefract` / `uMerRefract`
 * @param {number} fonduRive `vFade` du socle, `vFonduRive` du crop — la MÊME loi
 * @returns {[number, number]} le décalage, en UV d'écran
 */
export function decalageRefraction(pente, force, fonduRive) {
  const k = force * REFRACTION.gain * (REFRACTION.plancherRive + REFRACTION.poidsRive * fonduRive)
  // `+ 0` : `-0.2 * 0` rend `-0` en JS, que `assert.deepEqual` distingue de `0`.
  // Le GLSL ne fait pas cette distinction ; le jumeau ne doit pas l'inventer.
  return [pente[0] * k + 0, pente[1] * k + 0]
}

/**
 * Les UV bornées où l'on va chercher le fond déjà rendu.
 *
 * @param {[number, number]} uv `gl_FragCoord.xy / résolution`
 * @param {[number, number]} decalage ce que rend `decalageRefraction`
 * @returns {[number, number]} les UV d'échantillonnage, bornées
 */
export function uvRefractee(uv, decalage) {
  const b = (x) => Math.min(Math.max(x, REFRACTION.borneBasse), REFRACTION.borne)
  return [b(uv[0] + decalage[0]), b(uv[1] + decalage[1])]
}

/**
 * Le composite de la lame d'eau : le fond réfracté sous le corps d'eau.
 *
 * ⚠️ **C'EST CETTE LIGNE QUI DÉCIDE DE L'ORDRE.** Après elle, le reflet de ciel
 * et le glint solaire s'ajoutent à alpha PLEIN — ils ne passent plus par la
 * transparence. C'est la leçon v44 d'`ocean.js`, citée dans l'en-tête.
 *
 * @param {number[]} travers le fond déjà rendu, échantillonné réfracté
 * @param {number[]} corps le corps d'eau (`corpsEau`)
 * @param {number} opacite ce que rend `opaciteEau`
 * @returns {number[]} la couleur composée
 */
export function composeLameEau(travers, corps, opacite) {
  return travers.map((t, i) => t + (corps[i] - t) * opacite)
}

/**
 * ⚠️ **INJECTÉ, PAS RECOPIÉ** — `ocean.js` et `globe.js` insèrent ce MÊME texte.
 * `test/eau-refraction.test.js` le traduit et l'exécute contre les jumeaux JS
 * ci-dessus, et interdit à l'un des deux nuanceurs de réécrire une formule.
 */
export const GLSL_REFRACTION = /* glsl */ `
// ── eau-refraction.js — INJECTÉ, PAS RECOPIÉ ───────────────────────────────
vec2 decalageRefraction(vec2 pente, float force, float fonduRive) {
  return pente * force * ${REFRACTION.gain.toFixed(2)} * (${REFRACTION.plancherRive.toFixed(1)} + ${REFRACTION.poidsRive.toFixed(1)} * fonduRive);
}
vec2 uvRefractee(vec2 uv, vec2 decalage) {
  return clamp(uv + decalage, vec2(${REFRACTION.borneBasse.toFixed(3)}), vec2(${REFRACTION.borne.toFixed(3)}));
}
vec3 composeLameEau(vec3 travers, vec3 corps, float opacite) {
  return mix(travers, corps, opacite);
}
`
