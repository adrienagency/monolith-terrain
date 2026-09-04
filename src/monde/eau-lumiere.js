// LA LUMIÈRE DE LA MER — ce qui fait qu'une mer est LUE comme une mer.
// Tâche EAU (2026-09-05), sur la demande d'Adrien :
//
// > *« Si jamais tu peux redonner un vrai effet "eau" à la mer, ce serait top,
// > car là ce n'est pas la folie visuellement. Base-toi sur ce qui fait qu'une
// > mer ressemble vraiment à une mer, il y a des tonnes d'études 3D là-dessus. »*
//
// Module PUR : ni DOM, ni three.js, ni état. Les jumeaux JS sont exécutés par
// `test/eau-lumiere.test.js` ; `GLSL_EAU_LUMIERE` est le MÊME texte, injecté
// dans `MER_FRAG` (`src/globe.js`) — une seule écriture, comme `eau-refraction.js`.
//
// ══════════ CE QUE LA RECHERCHE DIT, ET CE QUI EST APPLIQUÉ ICI ═══════════
//
// L'étude complète, sourcée, est dans `rapport-EAU.md`. Les quatre mécanismes
// que ce module porte, avec leur source :
//
//   ① **FRESNEL DE SCHLICK, F0 = 0,02.** Schlick (1994) :
//      `R(θ) = R0 + (1 − R0)(1 − cos θ)^5`, `R0 = ((n1 − n2)/(n1 + n2))²`. Pour
//      l'eau, n = 1,333 : `R0 = (0,333/2,333)² = 0,0204`. Tessendorf (2001,
//      §4.2, fig. 21) trace la réflectivité exacte : ~2 % au nadir, → 1 au
//      rasant. ⛔ **La loi d'avant** (`fres = min((1 − N·V)^5, 0.5)` puis
//      `mix(col, uSky, fres * 0.35)`) rendait **0 au nadir et 0,175 au rasant** :
//      la mer ne devenait jamais un miroir, et c'est ce qui la rendait « pas la
//      folie » — Tessendorf le dit en toutes lettres : *« variation of the
//      reflectivity across an image is an important source of the "texture" or
//      feel of water »*.
//   ② **LE REFLET DU CIEL N'EST PAS UNE COULEUR UNIE.** Un ciel est plus sombre
//      et plus saturé au zénith qu'à l'horizon ; la mer, vue au rasant, reflète
//      l'horizon (clair), vue à 45° elle reflète le ciel haut (bleu profond).
//      C'est le gradient que Dupuy & Bruneton (2012, `meanSkyRadiance`) et le
//      nuanceur de Tessendorf (`color sky = (0.69, 0.84, 1)`, et un « air »
//      sombre) posent chacun à leur manière. Ici : un dégradé horizon → zénith
//      indexé sur l'élévation du rayon réfléchi.
//   ③ **LE SPÉCULAIRE DU SOLEIL EST UNE DISTRIBUTION DE PENTES (Cox & Munk
//      1954), PAS UN `pow(N·H, brillance)`.** Cox & Munk ont photographié le
//      miroitement depuis un B-17 et mesuré `σ² = 0,003 + 0,00512·U` (U = vent
//      à 12,5 m, en m/s, valable jusqu'à 14 m/s). Un `pow` de Blinn-Phong donne
//      une tache ronde ; une distribution de pentes (Beckmann, `D = exp(−tan²θh
//      / 2σ²) / (2π σ² cos⁴θh)`) donne la traînée **allongée vers l'observateur**
//      que la NOAA décrit (*« the ratio of the glitter-pattern width to its
//      length is given by the sine of the source elevation angle »*), parce que
//      la géométrie du demi-vecteur H y est respectée. C'est le
//      `reflectedSunRadiance` de Dupuy & Bruneton, simplifié en isotrope.
//   ④ **LA DIFFUSION SOUS-SURFACE DANS LES CRÊTES À CONTRE-JOUR.** Sea of
//      Thieves (Ang, SIGGRAPH 2018) : *« We blend between a deep water colour
//      and a sub-surface water colour based on a combination of view angle, sun
//      direction and a wave peak mask […] wave peaks […] show more sub-surface
//      due to shorter distance traveled by light through the water »*. Atlas
//      (GDC 2019) le formule en `k1·hauteur × k2·(V·−L)^n × k3·(N·L) × k4`.
//      Ici : la hauteur de houle normalisée et la crête (jacobien de Gerstner,
//      Tessendorf §3.3) modulent une lueur turquoise quand on regarde vers le
//      soleil.
//
// ⚠️ **AUCUN ACCENT NI APOSTROPHE DANS LE GLSL** : ce texte part au compilateur.

/**
 * La réflectance de l'eau au nadir — Schlick, n = 1,333.
 *
 * ⚠️ **DÉRIVÉE, PAS POSÉE** : `((1 − 1,333) / (1 + 1,333))² = 0,02037`. On écrit
 * 0,02, la valeur que Dupuy & Bruneton (`0.02 + 0.98 * pow(1 - dot(V, H), 5)`)
 * et toute la littérature temps réel emploient ; l'écart avec 0,0204 est sous le
 * pas d'un octet de couleur.
 */
export const F0_EAU = 0.02

/** L'indice de l'eau, pour que le test refasse la dérivation de `F0_EAU`. */
export const INDICE_EAU = 1.333

/** Schlick : `F0 + (1 − F0)(1 − cosθ)^5`. `cosTheta` est `N·V` écrêté à [0, 1]. */
export function schlickEau(cosTheta) {
  const c = Math.min(1, Math.max(0, cosTheta))
  const m = 1 - c
  return F0_EAU + (1 - F0_EAU) * m * m * m * m * m
}

/**
 * Cox & Munk (1954) : la variance des pentes en fonction du vent,
 * `σ² = 0,003 + 0,00512·U` (U à 12,5 m, en m/s, mesuré jusqu'à 14 m/s).
 *
 * ⚠️ **C'EST LA VARIANCE TOTALE (deux axes).** Pour une distribution isotrope
 * on prend la moitié par axe, c'est le `sigmaSq` de Dupuy & Bruneton. Le vent
 * est borné à la plage MESURÉE par Cox & Munk : au-delà, on extrapolerait.
 */
export const COX_MUNK = Object.freeze({ base: 0.003, pente: 0.00512, ventMax: 14 })

export function varianceCoxMunk(ventMs) {
  const u = Math.min(COX_MUNK.ventMax, Math.max(0, ventMs))
  return (COX_MUNK.base + COX_MUNK.pente * u) / 2
}

/**
 * Le vent (m/s) dérivé de la houle du socle.
 *
 * ⚠️ **UNE CONVENTION, ET ELLE EST DITE** : `ocean.js` ne porte pas de vent, il
 * porte `uWaveH` (2 au relevé du 2026-08-22, `ETAT_MER_NEUTRE.houle = 0,5`).
 * Une houle de 0,5 rend ~4 m/s (brise), une houle de 2 rend 10 m/s (vent
 * frais). La plage reste dans les mesures de Cox & Munk.
 */
export const VENT_DE_HOULE = Object.freeze({ base: 2, gain: 4 })

export function ventDeHoule(houle) {
  const h = Number.isFinite(houle) ? Math.max(0, houle) : 0
  return Math.min(COX_MUNK.ventMax, VENT_DE_HOULE.base + VENT_DE_HOULE.gain * h)
}

/**
 * Le miroitement du soleil — distribution de Beckmann sur les pentes de Cox &
 * Munk, `D(H) = exp(−tan²θh / (2σ²)) / (2π σ² cos⁴θh)`, et la radiance
 * réfléchie `F(V·H) · D / (4 · N·V)` (le `N·L` du BRDF est simplifié avec celui
 * de l'irradiance — c'est l'écriture de Dupuy & Bruneton sans le terme d'ombrage
 * de Smith, qui ne compte qu'au rasant extrême).
 *
 * ⚠️ **ÉCRÊTÉE À `PLAFOND_GLITTER`** : au vent nul, `D` tend vers un Dirac et le
 * pixel saturerait à des centaines — le plafond est la borne visible.
 */
export const PLAFOND_GLITTER = 6

export function glitterSoleil(nDotH, vDotH, nDotV, sigma2) {
  const c = Math.min(1, Math.max(1e-4, nDotH))
  const c2 = c * c
  const tan2 = (1 - c2) / c2
  const s2 = Math.max(sigma2, 1e-5)
  const D = Math.exp(-tan2 / (2 * s2)) / (2 * Math.PI * s2 * c2 * c2)
  const F = schlickEau(vDotH)
  return Math.min(PLAFOND_GLITTER, (F * D) / (4 * Math.max(nDotV, 1e-3)))
}

/**
 * La lueur sous-surface des crêtes à contre-jour (Sea of Thieves / Atlas).
 *
 * @param {number} hauteur la hauteur de houle NORMALISÉE (0 au creux/plat, 1 à la
 *   crête d'amplitude nominale) — `vHouleH` du sommet
 * @param {number} crete le jacobien de Gerstner normalisé (`vCrete`)
 * @param {number} lDotMoinsV `dot(L, −V)` : 1 quand on regarde droit vers le soleil
 * @param {number} fresnel ce qui est déjà réfléchi ne rentre pas dans l'eau
 */
export const SSS = Object.freeze({ poidsHauteur: 0.65, poidsCrete: 0.35, expo: 3, gain: 0.9 })

export function lueurSousSurface(hauteur, crete, lDotMoinsV, fresnel) {
  const h = Math.min(1, Math.max(0, hauteur))
  const c = Math.min(1, Math.max(0, crete))
  const v = Math.max(0, lDotMoinsV)
  return SSS.gain * (SSS.poidsHauteur * h + SSS.poidsCrete * c) * Math.pow(v, SSS.expo) * (1 - Math.min(1, Math.max(0, fresnel)))
}

/**
 * La crête qui MOUTONNE — le seuil de déferlement, Tâche EAU.
 *
 * ⛔ **MESURÉ AVANT D'ÊTRE ÉCRIT** : à Saint-Malo, z11, 15 h 30, la loi du socle
 * (`ecumeMoutons`, `smoothstep(0.30, 0.60, crete)`) couvrait la baie de
 * plaques blanches de la taille du kilomètre — la houle du crop y fait 1,2 km
 * de long (`echelleHouleM`) et son jacobien passe 0,3 sur une large part de
 * chaque crête. Or la couverture réelle en moutons est PETITE : Monahan &
 * O'Muircheartaigh (1980) la mesurent à **W = 3,84·10⁻⁶ · U^3,41** — 1 % à
 * 10 m/s, 3 % à 14 m/s, 0,1 % à 5 m/s. Tessendorf (2001, §3.3) ne fait mousser
 * que là où le jacobien **plie** (J < 0), c'est-à-dire l'extrême de la crête.
 *
 * Le crop ne réécrit pas la loi du socle (elle est partagée) : il lui passe une
 * crête **remise à l'échelle** — nulle sous `SEUIL_CRETE`, pleine à 1 — donc
 * seule la part la plus cambrée de chaque crête moutonne. Le ressac et le liseré
 * de côte, eux, lisent le fondu de rive et ne bougent pas.
 */
export const SEUIL_CRETE = 0.62

export function creteMoutonnante(crete) {
  const c = Number.isFinite(crete) ? crete : 0
  return Math.min(1, Math.max(0, (c - SEUIL_CRETE) / (1 - SEUIL_CRETE)))
}

/**
 * Monahan & O'Muircheartaigh (1980) : la couverture en moutons, fraction de la
 * surface, en fonction du vent à 10 m. Le témoin de la mesure d'écran.
 *
 * ⚠️ **LE PAPIER PORTE DEUX AJUSTEMENTS** : `3,84·10⁻⁶ · U^3,41` (moindres
 * carrés) et `2,95·10⁻⁶ · U^3,52` (« optimal », robuste). À 10 m/s ils rendent
 * 0,99 % et 0,98 % ; on écrit le premier, le plus cité (NASA OceanColor l'emploie
 * pour sa correction de moutons).
 */
export function couvertureMoutons(ventMs) {
  const u = Math.max(0, ventMs)
  return 3.84e-6 * Math.pow(u, 3.41)
}

/**
 * Le ciel réfléchi : un dégradé horizon → zénith indexé sur l'élévation du
 * rayon réfléchi. `horizon` est `uSky` (la couleur de ciel VIVANTE du socle,
 * lue par `majReglagesMer`) ; le zénith en est dérivé par une teinte fixe —
 * plus sombre, plus saturé — et sous l'horizon (rayon qui plonge) la mer
 * reflète… la mer, donc l'horizon assombri.
 */
export const CIEL = Object.freeze({
  zenith: [0.48, 0.62, 0.96],
  sousHorizon: 0.8,
  elevationPleine: 0.55,
})

export function cielReflechi(horizon, elevation) {
  const t = Math.min(1, Math.max(0, elevation / CIEL.elevationPleine))
  const s = t * t * (3 - 2 * t)
  const bas = elevation < 0 ? CIEL.sousHorizon : 1
  return horizon.map((h, i) => (h * bas) * (1 - s) + h * CIEL.zenith[i] * s)
}

/**
 * ⚠️ **INJECTÉ, PAS RECOPIÉ** — `globe.js` insère ce MÊME texte dans `MER_FRAG`.
 * `test/eau-lumiere.test.js` exécute les jumeaux ci-dessus contre une
 * traduction de ce texte et interdit à `MER_FRAG` de réécrire une formule.
 */
export const GLSL_EAU_LUMIERE = /* glsl */ `
// ── eau-lumiere.js — INJECTÉ, PAS RECOPIÉ ──────────────────────────────────
float schlickEau(float cosTheta) {
  float m = 1.0 - clamp(cosTheta, 0.0, 1.0);
  float m2 = m * m;
  return ${F0_EAU.toFixed(2)} + (1.0 - ${F0_EAU.toFixed(2)}) * m2 * m2 * m;
}
float varianceCoxMunk(float ventMs) {
  float u = clamp(ventMs, 0.0, ${COX_MUNK.ventMax.toFixed(1)});
  return (${COX_MUNK.base.toFixed(3)} + ${COX_MUNK.pente.toFixed(5)} * u) * 0.5;
}
float glitterSoleil(float nDotH, float vDotH, float nDotV, float sigma2) {
  float c = clamp(nDotH, 1e-4, 1.0);
  float c2 = c * c;
  float tan2 = (1.0 - c2) / c2;
  float s2 = max(sigma2, 1e-5);
  float D = exp(-tan2 / (2.0 * s2)) / (6.28318530718 * s2 * c2 * c2);
  float F = schlickEau(vDotH);
  return min(${PLAFOND_GLITTER.toFixed(1)}, F * D / (4.0 * max(nDotV, 1e-3)));
}
float lueurSousSurface(float hauteur, float crete, float lDotMoinsV, float fresnel) {
  float h = clamp(hauteur, 0.0, 1.0);
  float c = clamp(crete, 0.0, 1.0);
  float v = max(lDotMoinsV, 0.0);
  return ${SSS.gain.toFixed(2)} * (${SSS.poidsHauteur.toFixed(2)} * h + ${SSS.poidsCrete.toFixed(2)} * c) * pow(v, ${SSS.expo.toFixed(1)}) * (1.0 - clamp(fresnel, 0.0, 1.0));
}
float creteMoutonnante(float crete) {
  return clamp((crete - ${SEUIL_CRETE.toFixed(2)}) / (1.0 - ${SEUIL_CRETE.toFixed(2)}), 0.0, 1.0);
}
vec3 cielReflechi(vec3 horizon, float elevation) {
  float s = smoothstep(0.0, ${CIEL.elevationPleine.toFixed(2)}, elevation);
  float bas = elevation < 0.0 ? ${CIEL.sousHorizon.toFixed(2)} : 1.0;
  return mix(horizon * bas, horizon * vec3(${CIEL.zenith[0].toFixed(2)}, ${CIEL.zenith[1].toFixed(2)}, ${CIEL.zenith[2].toFixed(2)}), s);
}
`
