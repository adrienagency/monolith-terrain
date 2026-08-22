// LA COLORISATION NATURELLE, PARTAGÉE — Tâche P2 du plan « LE STUDIO SUR LE
// GLOBE » (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CETTE TÂCHE RÉPARE, ET C'EST LA DEMANDE D'ADRIEN ═════════
//
// > **Adrien, 2026-08-22 :** « Plus aucune texture sur la terre. » ·
// > « Je voudrais qu'on arrive à retrouver la texture comme elle était avant de
// > faire la modification vers la sphère. Pour l'instant le détail est trop
// > basique. »
//
// La Tâche C avait porté sur le globe **l'emballage** de l'habillage (courbes,
// grain, masque de côte, occupation du sol) et mesuré qu'il ne déplace que
// **1,01 %** des pixels. Son bilan nommait ce qui restait :
//
// > « Ce qui fait la richesse de l'image du socle, c'est le TEXTURE SHADING et
// > la rampe locale. »
//
// ⚠️ **ET LE RÉGLAGE D'OUVERTURE DE L'APPLICATION L'EMPLOIE À FOND.** Le gabarit
// de départ (`public/templates/defaults/shibustart.json`, chargé par `main.js`
// via `STARTUP_LOOK`) pose `colorMode: "natural"`, `texShade: 1`, `wetK: 0,96`,
// `rampDry: 0,84`, `rampWet: 1`, `heightContrast: 1,5`, `heightPivot: 0,6`.
// **Le socle qu'Adrien compare est donc en mode Naturel à l'intensité maximale,
// et le globe n'en portait RIEN.**
//
// ══════════ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'EST PAS UNE COPIE ══
//
// Règle D13, §③ : « ① ADAPTER en place · ② EXTRAIRE en module pur partagé dans
// `src/monde/` · ③ COPIER en dernier recours ». Ce fichier est le ②.
//
// ⚠️ **CE N'EST PAS UNE TRANSCRIPTION, C'EST UNE EXTRACTION — ET LA DIFFÉRENCE
// EST TOUT L'ENJEU.** Une transcription laisse DEUX écritures de la même loi, et
// `terrain.js` porte déjà la cicatrice de ce choix (« Deux écritures jumelles
// finiraient par diverger »). Ici, `terrain.js` ET `globe.js` **injectent le
// MÊME texte GLSL** — celui de `GLSL_NATUREL` ci-dessous. Il n'y a donc qu'une
// seule écriture de la loi, et `test/crop-naturel.test.js` exige qu'aucun des
// deux nuanceurs ne réécrive une seule des formules.
//
// Module PUR : ni DOM, ni three.js, ni état. Les jumeaux JS des fonctions GLSL
// vivent ici aussi, et le test EXTRAIT le texte GLSL puis l'EXÉCUTE contre eux —
// pas une recherche de nom, une exécution (protocole de `test/crop-rampe.js`).
//
// ══════════ LES UNITÉS, CÔTÉ SOCLE ET CÔTÉ GLOBE ═══════════════════════════
//
// Les fonctions ci-dessous ne prennent QUE des grandeurs normalisées : `hNorm`
// dans [0, 1], les quatre canaux de l'analyse dans [0, 1], une distance au
// centre du bloc dans [0, 1]. **C'est ce qui les rend partageables** — le socle
// tient son relief en unités de scène exagérées, le globe en mètres bruts, et
// aucune des deux unités n'entre ici.
//
//   · `hNorm` — socle : `(vWorldPos.y − uHeightRange.x) / max(uHeightRange.y −
//     uHeightRange.x, 1e-4)`. Globe : `(h − uLandBas) / max(uLandMax − uLandBas,
//     uPlancherRampeM)`, c'est-à-dire **l'expression que la Tâche D avait déjà
//     posée dans `float t`** — on ne l'invente pas, on la nomme.
//   · `fd` (la distance du voile) — socle : `length(vWorldPos.xz − uBlockOffset)
//     / max(uSlabHalf, 1e-3)`. Globe : `length(qCrop)`, **et c'est la même
//     grandeur, pas une approximation** : l'en-tête de `habillage-crop.js`
//     démontre `x = 28 · u` avec `uSlabHalf = 28`, donc
//     `qCrop = (vWorldPos.xz − uBlockOffset) / uSlabHalf` exactement.
//
// ══════════ CE QUE CE MODULE NE PORTE PAS, ET POURQUOI ═════════════════════
//
//   · ⛔ **`mapTint`.** Le socle l'emploie pour `diffuseColor.rgb = mix(
//     diffuseColor.rgb, mapCol · paintShade, effTint)` : il dose la peinture
//     hypsométrique CONTRE l'albédo d'un `MeshStandardMaterial` et contre les
//     matières de relief. Le nuanceur des tuiles du globe est un `ShaderMaterial`
//     NU : il n'a ni albédo, ni matière de surface, ni bruit de révélation. Il
//     n'y a **rien contre quoi doser** — lui donner un sens ici serait inventer
//     une seconde loi, pas en porter une.
//   · ⛔ **`slopeTint`.** C'est la branche `else` du mode Classique
//     (`mix(mapCol, brun, smoothstep(0.3, 0.8, slope) · uSlopeTint)`) et elle
//     lit `slope`, tiré de la NORMALE DU RELIEF (`vNormal` du maillage du bloc).
//     Les tuiles du globe ne portent que `vNormalW`, la normale de la SPHÈRE :
//     la pente du terrain n'existe pas dans ce nuanceur. La fabriquer par
//     dérivées d'écran de `h` serait une seconde loi de pente, mesurée dans une
//     autre unité, pour un poste que le gabarit d'ouverture n'emploie pas
//     (`colorMode: "natural"`, où cette branche est morte).
//
// **Les deux sont donc DÉCLARÉS LAISSÉS, pas oubliés** — c'est l'Étape 4 de la
// tâche, qui demande « rends-les vivants, ou dis lesquels tu laisses et
// pourquoi ». Les deux autres, `heightContrast` et `heightPivot`, sont vivants.

// ══════════ ① LES CONSTANTES — CHACUNE VIENT DU DÉPÔT, AUCUNE N'EST CHOISIE ═

/**
 * Le gain de l'axe humidité du LUT.
 *
 * ⚠️ **IL N'EST PAS DE MOI : IL EST REPRIS DE `terrain.js`, QUI EN PORTE LA
 * JUSTIFICATION EN DOUZE LIGNES.** 1,62 compense le soft-clip
 * d'`encodeTextureShade` (le 95e centile sort à 0,808, soit 0,616 une fois ramené
 * en ±1) ; le ×3 est une demande d'Adrien par-dessus cette compensation. 4,86 est
 * leur produit, écrit tel quel dans le dépôt.
 */
export const GAIN_HUMIDITE = 4.86

/**
 * Le gain de contraste du peigné et de l'ombrage, AVANT le soft light.
 *
 * ⚠️ **ON NE PEUT PAS MONTER LE `mix` AU-DELÀ DE 1** : on écarte donc le signal
 * de son neutre avant le mélange. C'est le contraste qui triple, pas le dosage —
 * `terrain.js` l'écrit, et c'est aussi une demande d'Adrien.
 */
export const GAIN_PEIGNE = 3

/**
 * La part de l'ombrage classique, rapportée au peigné.
 *
 * ⚠️ **AU DÉZOOM LES BANDES FINES DU PEIGNÉ TOMBENT SOUS LA TAILLE DU PIXEL** et
 * se moyennent en gris : c'est l'ombrage qui garde alors le massif lisible.
 * C'est écrit dans l'en-tête de `terrain-analysis.js` (`hillshade`), et le
 * facteur vient de `terrain.js`.
 */
export const PART_OMBRAGE = 0.35

/** La largeur de l'extinction de la végétation au-dessus de la limite des arbres. */
export const BANDE_VEGETATION = 0.18

/** La marge que le plancher de pivot ajoute au niveau de la mer. */
export const MARGE_PIVOT = 0.02

/** Le plafond du plancher de pivot — au-delà, la terre perdrait ses teintes basses. */
export const PLAFOND_PIVOT = 0.95

/** Les coefficients de luminance Rec. 709 du voile aérien. */
export const LUMA_709 = Object.freeze([0.2126, 0.7152, 0.0722])

/**
 * Les réglages du mode Naturel ÉTEINTS — ce que le globe porte sans habillage.
 *
 * ⚠️ **MÊME DISCIPLINE QUE `HABILLAGE_MONDE` ET `RAMPE_MONDE`** : une seule
 * écriture, lue par le constructeur du globe ET par `retirerHabillage`. Deux
 * littéraux jumeaux auraient divergé en silence — c'est exactement le défaut que
 * la Tâche C a réparé sur `uContourInterval`.
 *
 * ⚠️ **ET CES VALEURS NE SONT PAS UN GOÛT : ELLES SONT LES DÉFAUTS DE
 * `main.js`** (`params.texShade = 0`, `wetK = 0`, `expoK = 0`, `treeLine = 0,62`,
 * `hazeAmt = 0`, `hazeAlt = 0,5`, `hazeDist = 0,5`) et de `terrain.js`
 * (`uHemi = 1`, `uHeightContrast`/`uHeightPivot` neutres à 1 et 0,5 — voir
 * `natRampT`, qui rend alors `hNorm` au bit près).
 */
export const NATUREL_MONDE = Object.freeze({
  texShade: 0,
  wetK: 0,
  expoK: 0,
  hemi: 1,
  treeLine: 0.62,
  hazeAmt: 0,
  hazeAlt: 0.5,
  hazeDist: 0.5,
  hazeColor: '#b9c6d6',
  heightContrast: 1,
  heightPivot: 0.5,
})

// ══════════ ② LES JUMEAUX JS — la loi, vérifiable sous node ═════════════════

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/**
 * `smoothstep` du GLSL, mot pour mot.
 *
 * ⚠️ **PAS DE GARDE SUR `bord1 − bord0`, ET C'EST DÉLIBÉRÉ.** Les deux seuls
 * appels de ce module écartent leurs bornes par construction
 * (`treeLine + 0,18` et `max(hazeAlt, 1e-3)`) : une garde ici serait une
 * promesse qu'aucun appelant réel ne peut déclencher, donc un repli qui ment sur
 * ses garanties — le défaut que la Tâche D a retiré d'`echelleRampe`.
 */
export function smoothstep(bord0, bord1, x) {
  const t = clamp01((x - bord0) / (bord1 - bord0))
  return t * t * (3 - 2 * t)
}

/**
 * Le plancher du pivot : le pivot ne peut JAMAIS descendre sous le niveau de la
 * mer.
 *
 * ⚠️ **`terrain.js` LE DIT EN ANGLAIS ET C'EST UN DÉFAUT VU** : « with a low
 * pivot the whole coastal band rides the top of the ramp and land loses its low
 * tints ». `hNormMer` est l'altitude NORMALISÉE de la surface de la mer — côté
 * socle `(uSeaY − uHeightRange.x) / amplitude`, côté globe
 * `(0 − uLandBas) / amplitude`, puisque le zéro du globe EST le niveau de la mer.
 */
export function plancherPivot(hNormMer) {
  return Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT
}

/**
 * L'indice de rampe du socle — l'axe X du LUT.
 *
 * ⚠️ **AUX DÉFAUTS (`contraste = 1`, `pivot = 0,5`) IL REND `hNorm` AU BIT
 * PRÈS** : `0,5 + (hNorm − 0,5) · 1 = hNorm`. C'est ce qui permet au globe de
 * garder son image d'avant tant que personne ne pose de crop, et c'est la garde
 * que le test vérifie sur un balayage.
 */
export function rampeT(hNorm, pivot, contraste) {
  return clamp01(0.5 + (hNorm - pivot) * contraste)
}

/**
 * L'axe Y du LUT — l'humidité topographique et l'exposition.
 *
 * ⚠️ **C'EST LE SECOND AXE QUI CASSE LA COLORATION PAR COUCHE** : deux points à
 * la même altitude, l'un au fond d'un vallon, l'autre sur une croupe, cessent de
 * recevoir la même couleur. Sans lui, une rampe 1D donne NÉCESSAIREMENT une
 * teinte constante le long de chaque courbe de niveau (`terrain-analysis.js`).
 *
 * `canalB` et `canalA` sont les canaux **bleu** (humidité) et **alpha**
 * (exposition) de l'analyse empaquetée par `packAnalysis` — 0,5 = neutre.
 */
export function humiditeY({ canalB, canalA, hNorm, wetK, expoK, hemi, treeLine }) {
  const veg = 1 - smoothstep(treeLine, treeLine + BANDE_VEGETATION, hNorm)
  const wet = (canalB - 0.5) * 2
  const expo = (canalA - 0.5) * 2
  return clamp01(0.5 + GAIN_HUMIDITE * veg * (wet * wetK + expo * hemi * expoK))
}

/** Un canal d'analyse, écarté de son neutre du gain du peigné. */
export function ecartPeigne(canal) {
  return clamp01(0.5 + (canal - 0.5) * GAIN_PEIGNE)
}

/**
 * Le SOFT LIGHT du W3C — la branche `m == 10` de `fxBlend` (`terrain.js`).
 *
 * ⚠️ **JAMAIS UNE MULTIPLICATION, ET C'EST UN ARGUMENT, PAS UN GOÛT** :
 * multiplier (ou mixer vers le blanc) tire la couleur vers le gris et DÉSATURE —
 * on gagnerait du modelé et on perdrait la palette. Le soft light éclaircit et
 * assombrit en gardant la chroma.
 *
 * Scalaire ici parce que l'opération est **rigoureusement composante par
 * composante** : c'est ce qui permet au test d'exécuter le texte GLSL canal par
 * canal, sans interpréteur de vecteurs.
 *
 * ⚠️ **`mix` ET `step`, PAS UN TERNAIRE — ET L'ÉCART SE MESURE.** Un ternaire
 * dit la même chose mathématiquement et **pas la même chose en virgule
 * flottante** : `mix(a, b, 1.0)` vaut `a + (b − a) · 1`, qui n'est pas `b` au
 * bit près. Écrit en ternaire, ce jumeau divergeait du texte GLSL d'**un ULP**
 * (relevé : 0,665622577482985**5** contre …8**6**, à `b = 0,65`, `s = 0,55`), et
 * le test ② n'aurait plus pu comparer par égalité stricte. Le jumeau suit donc
 * la forme du GPU, pas la forme la plus lisible.
 */
export function softLight(b, s) {
  const mix = (x, y, t) => x + (y - x) * t
  const step = (bord, x) => (x < bord ? 0 : 1)
  const d = mix(((16 * b - 12) * b + 4) * b, Math.sqrt(b), step(0.25, b))
  return mix(b - (1 - 2 * s) * b * (1 - b), b + (2 * s - 1) * (d - b), step(0.5, s))
}

/**
 * Le peigné puis l'ombrage, posés sur une couleur — un canal à la fois.
 *
 * ⚠️ **L'OMBRAGE SE POSE SUR LE RÉSULTAT DU PEIGNÉ, PAS SUR LA COULEUR
 * D'ORIGINE.** `terrain.js` écrit deux `mapCol = mix(mapCol, …)` successifs :
 * la seconde ligne lit le `mapCol` que la première vient d'écrire. Repartir de
 * la couleur d'origine donnerait deux modelés indépendants moyennés, c'est-à-dire
 * un modelé plus plat — et rien ne le signalerait.
 */
export function peigne(col, canalR, canalG, k) {
  const c = col + (softLight(col, ecartPeigne(canalR)) - col) * k
  return c + (softLight(c, ecartPeigne(canalG)) - c) * (k * PART_OMBRAGE)
}

/** La luminance Rec. 709 d'une couleur `[r, g, b]`. */
export function luminance(rgb) {
  return rgb[0] * LUMA_709[0] + rgb[1] * LUMA_709[1] + rgb[2] * LUMA_709[2]
}

/**
 * Le voile de la perspective aérienne (Imhof) — DEUX composantes, pas une.
 *
 * ⚠️ **C'EST L'ALTITUDE, PAS LA DISTANCE, QUI DONNE LE BLEU-GRIS DES PLAINES**
 * sur les planches de référence : l'air épais du fond de vallée est devant elles
 * quelle que soit la distance. `terrain.js` le nomme *Hoehenmodulation*.
 */
export function voile({ hNorm, fd, hazeAmt, hazeAlt, hazeDist }) {
  const fa = 1 - smoothstep(0, Math.max(hazeAlt, 1e-3), hNorm)
  return Math.min(Math.max(hazeAmt * (0.6 * fa + hazeDist * fd), 0), 0.9)
}

/**
 * Le voile appliqué — un canal à la fois, la luminance étant donnée.
 *
 * ⚠️ **DÉSATURER D'ABORD, VIRER VERS LA BRUME ENSUITE** : l'air diffuse la
 * lumière, il ne repeint pas le sol en bleu. Un mix direct vers la couleur de
 * brume donne une carte teintée, pas une carte lointaine.
 *
 * ⚠️ **ET LE REHAUSSEMENT EST INDISSOCIABLE** : sans lui le voile aplatit toute
 * la carte. On remonte le contraste là où le voile est nul — donc sur les
 * sommets, qui reprennent le mordant que les plaines viennent de perdre.
 *
 * ⚠️ **`lum` EST UN ARGUMENT ET NON UN CALCUL INTERNE**, et ce n'est pas un
 * confort d'écriture : c'est ce qui garde la fonction **composante par
 * composante**, donc exécutable canal par canal par le test à partir du TEXTE
 * GLSL. Une `dot` à l'intérieur aurait exigé un interpréteur de vecteurs, et un
 * interpréteur de vecteurs est une troisième écriture de la loi.
 */
export function brume({ col, lum, veil, couleur, hazeAmt }) {
  let c = col + (lum - col) * (veil * 0.65)
  c = c + (couleur - c) * veil
  const lift = (1 - veil) * hazeAmt * PART_OMBRAGE
  return Math.min(Math.max((c - 0.5) * (1 + lift) + 0.5, 0), 1)
}

// ══════════ ③ LE TEXTE GLSL — LA SEULE ÉCRITURE, INJECTÉE DES DEUX CÔTÉS ═══

/**
 * Les fonctions GLSL de la colorisation naturelle.
 *
 * ⚠️ **`terrain.js` ET `globe.js` INJECTENT CETTE CHAÎNE, ILS NE LA RECOPIENT
 * PAS.** C'est le point entier du fichier, et `test/crop-naturel.test.js` exige
 * qu'aucune des formules ci-dessous ne réapparaisse ailleurs dans `src/`.
 *
 * ⚠️ **AUCUN ACCENT GRAVE ICI.** Ce texte est interpolé dans les gabarits de
 * chaîne des deux nuanceurs : un accent grave les fermerait et casserait les deux
 * modules d'un coup. `terrain.js` et `ocean.js` documentent tous les deux ce
 * piège ; il est ici DOUBLÉ, puisque le texte voyage.
 *
 * ⚠️ **ET LES NOMS SONT PRÉFIXÉS `nat`** : ces fonctions entrent dans un
 * nuanceur de `MeshStandardMaterial` (le socle) dont three.js écrit lui-même la
 * moitié. Un `wetY` ou un `veil` nu y aurait un jour rencontré un homonyme de
 * la bibliothèque, et l'erreur de compilation serait tombée sur une mise à jour
 * de three, pas sur ce commit.
 */
export const GLSL_NATUREL = /* glsl */ `
// LA COLORISATION NATURELLE — src/monde/naturel-crop.js, injecte tel quel.
// Ne pas reecrire ces formules ailleurs : test/crop-naturel.test.js l interdit.
float natPlancherPivot(float hNormMer) {
  return clamp(hNormMer, 0.0, ${PLAFOND_PIVOT.toFixed(2)}) + ${MARGE_PIVOT.toFixed(2)};
}
float natRampT(float hNorm, float pivot, float contraste) {
  return clamp(0.5 + (hNorm - pivot) * contraste, 0.0, 1.0);
}
float natHumiditeY(float canalB, float canalA, float hNorm, float wetK, float expoK, float hemi, float treeLine) {
  float veg = 1.0 - smoothstep(treeLine, treeLine + ${BANDE_VEGETATION.toFixed(2)}, hNorm);
  float wet = (canalB - 0.5) * 2.0;
  float expo = (canalA - 0.5) * 2.0;
  return clamp(0.5 + ${GAIN_HUMIDITE.toFixed(2)} * veg * (wet * wetK + expo * hemi * expoK), 0.0, 1.0);
}
float natEcartPeigne(float canal) {
  return clamp(0.5 + (canal - 0.5) * ${GAIN_PEIGNE.toFixed(1)}, 0.0, 1.0);
}
vec3 natSoftLight(vec3 b, vec3 s) {
  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3(0.25), b));
  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(vec3(0.5), s));
}
vec3 natPeigne(vec3 col, float canalR, float canalG, float k) {
  vec3 c = mix(col, natSoftLight(col, vec3(natEcartPeigne(canalR))), k);
  return mix(c, natSoftLight(c, vec3(natEcartPeigne(canalG))), k * ${PART_OMBRAGE.toFixed(2)});
}
float natLuminance(vec3 c) {
  return dot(c, vec3(${LUMA_709[0]}, ${LUMA_709[1]}, ${LUMA_709[2]}));
}
float natVoile(float hNorm, float fd, float hazeAmt, float hazeAlt, float hazeDist) {
  float fa = 1.0 - smoothstep(0.0, max(hazeAlt, 1e-3), hNorm);
  return clamp(hazeAmt * (0.6 * fa + hazeDist * fd), 0.0, 0.9);
}
vec3 natBrume(vec3 col, float lum, float veil, vec3 couleur, float hazeAmt) {
  vec3 c = mix(col, vec3(lum), veil * 0.65);
  c = mix(c, couleur, veil);
  float lift = (1.0 - veil) * hazeAmt * ${PART_OMBRAGE.toFixed(2)};
  return clamp((c - 0.5) * (1.0 + lift) + 0.5, 0.0, 1.0);
}
`
