// ══════════════ LA MATIÈRE DU RELIEF SUR LA SPHÈRE — Tâche R25 ══════════════
//
// L'option 38 de l'inventaire : *« picker (17 vignettes) »*, avec en commentaire
// **« le globe n'a pas de matière PBR de relief ; seule `terrain.material.color`
// traverse (`albedoBase`) »**.
//
// ⛔ **ET CE COMMENTAIRE DIT MOINS QUE CE QUE LA MESURE DIT.** Relevé le
// 2026-09-01, La Réunion, réglages par défaut, pleine résolution 1280 × 800, les
// dix-sept vignettes CLIQUÉES une par une (`scripts/sonde-r25.mjs`) :
//
// | comparaison | écart moyen /255 |
// |---|---|
// | « Aucune » contre elle-même (plancher de bruit du banc) | **0,231** |
// | « Verre » contre « Aucune » | **0,301** — *sous le plancher, donc rien* |
// | n'importe quelle matière opaque contre « Aucune » | **3,29 à 3,57** |
// | **les quinze matières opaques ENTRE ELLES** | **0,025 à 0,338** |
//
// ⚡ **Les quinze rendent la MÊME image, à moins que le plancher de bruit.** Le
// sélecteur n'était pas un choix entre dix-sept matières : c'était un
// **interrupteur à deux positions** — « carte topographique » ou « aplat blanc »
// — habillé en dix-sept vignettes. Et la seconde position est une PERTE : tout
// ce qui traversait était `m.color.set('#ffffff')` et `uTint = 0`, c'est-à-dire
// la peinture hypsométrique retirée et rien mis à la place.
//
// ⚠️ **LE ✅ 3,560 DE L'INVENTAIRE N'EST PAS FAUX, IL EST INCOMPLET** — c'est la
// ligne « Éboulis contre Aucune ». Une seule matière comparée à l'absence de
// matière ne peut pas voir que les quinze sont interchangeables. C'est la
// leçon ① du dossier (« le chiffre le plus favorable ») prise par un autre bout :
// ici le chiffre publié était le seul qu'on avait pensé à prendre.
//
// ────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE PORTE, ET CE QU'IL NE PORTE PAS
//
// ✅ **L'ALBÉDO DE LA MATIÈRE**, et la transcription est LITTÉRALE, pas une
// seconde loi. `terrain.js` écrit `mix(diffuseColor.rgb, mapCol * paintShade,
// effTint)` où `diffuseColor.rgb` contient DÉJÀ `material.map` (three le
// multiplie dans `map_fragment`). Côté globe, `albedoCrop(col, uAlbedoBase, …)`
// est le même `mix` avec `uAlbedoBase` en lieu et place de `diffuseColor.rgb`.
// **Il manquait donc exactement UN facteur : la texture.**
//
// ✅ **LA CARTE DE NORMALES** (le curseur « Relief de la matière »), parce que
// le crop EST éclairé depuis P3/R21 : une normale perturbée s'y lit.
//
// ✅ **LE BRUIT QUI RÉVÈLE LA CARTE** et **« au-dessus du niveau zéro »** —
// deux uniformes et une conversion d'unité.
//
// ⛔ **PAS LA RUGOSITÉ, PAS LE MÉTAL, PAS `envMapIntensity` : IL N'Y A AUCUN
// RECEVEUR, ET C'EST STRUCTUREL.** Le crop du globe est éclairé par
// `albedo × irradianceCrop(…) × 1/π` — c'est-à-dire `BRDF_Lambert` et RIEN
// D'AUTRE. Il n'y a pas un terme spéculaire dans `globe.js`, pas d'`envMap` sur
// les tuiles, et `uSoleilIrr`/`uCielIrr`/`uSolIrr` sont des IRRADIANCES, pas des
// lampes. Écrire un GGX ici ne serait pas une transcription : ce serait une
// SECONDE loi d'éclairage à tenir d'accord avec celle de `three`, exactement ce
// que D13 §③ interdit. ➡️ Le curseur « Rugosité » est donc **caché en mode
// sphère** (même mécanique que R21 : `reglageAgit` + `visibleWhen`).
//
// ⛔ **PAS LE VERRE, ET LE COÛT EST MESURÉ** — voir `COUT_TRANSMISSION` plus bas.
//
// ⛔ **PAS LA DIFFUSION DE L'ALBÂTRE (`sss`)** : elle demande le vecteur de VUE
// (`normalize(vViewPosition)` dans `terrain.js`), et le nuanceur des tuiles n'en
// porte aucun — ses sommets sont en RTC (relatifs au centre de LEUR tuile)
// **exprès** pour ne pas payer l'ulp float32 à magnitude 100 (0,486 m), donc il
// n'y a pas de position monde d'où tirer V. Ajouter un varying de vue rouvrirait
// cette précision-là. L'albâtre reste distinguable par son albédo et sa normale.

import { COTE_CROP_UNITES } from './habillage-crop.js'

export { COTE_CROP_UNITES }

// ══════════ ① LE TUILAGE — SANS DIMENSION, ET LE FACTEUR EST 1 ═════════════
//
// ⚠️ **C'EST LA CLASSE DE DÉFAUT N° 1 DE CE CHANTIER, ET ICI ELLE NE MORD PAS —
// mais il faut le DIRE, pas le supposer.** `terrain.js` pose
// `texture.repeat.set(rep, rep)` sur le maillage du socle, dont les UV vont de
// 0 à 1 **d'un bord à l'autre du bloc** (`PlaneGeometry` : ses UV sont 0..1
// quelle que soit sa taille). Le globe, lui, tient `qCrop ∈ [−1, 1]`, également
// d'un bord à l'autre du bloc. Les deux grandeurs sont donc des **répétitions
// par largeur de bloc**, et la conversion est `uv = qCrop × 0,5 + 0,5`, la MÊME
// que `cmUv` emploie déjà pour les masques cuits. **Facteur 1.**
//
// ⚡ **ET C'EST POUR ÇA QU'IL N'Y A PAS DE `uFxFenetre` ICI, contrairement à la
// couche d'apparence.** L'apparence indexe son motif sur `champXZ()` — du x/z de
// MONDE en unités de scène — donc la fenêtre continue doit l'y décaler. Une
// carte de matière est indexée sur l'**UV DU MAILLAGE**, qui suit le bloc quand
// il se déplace : y ajouter la fenêtre ferait GLISSER la texture sous le socle.
// Deux couches, deux ancrages, et le second est le plus simple des deux.
//
// ⚠️ **ON LIT `texture.repeat`, PAS `params.terrainMatScale`** — même règle que
// les dix curseurs d'Atlas dans `contexteCrop`. `rep` vaut
// `(preset.repeat ?? 6) × scale × zoomRepeat(demZoom)` : `params` ne porte ni le
// `repeat` du préréglage ni le facteur de zoom, et les redériver ici serait une
// seconde écriture de la loi.
/**
 * Les répétitions de la carte de matière en travers du bloc.
 * @param {number} repeatSocle `material.map.repeat.x` du socle, VIVANT
 * @returns {number} la même grandeur, côté globe — facteur 1
 */
export function tuilageMatiere(repeatSocle) {
  const r = Number(repeatSocle)
  return Number.isFinite(r) && r > 0 ? r : 0
}

// ══════════ ② LA BANDE DU NIVEAU ZÉRO — VERTICALE, DONC / EXAGÉRATION ══════
//
// ⛔ **ET C'EST EXACTEMENT LE DÉPARTAGE QUE `pasGrilleBloc` ET
// `intervalleCourbesBloc` SE PARTAGENT, PRIS UNE TROISIÈME FOIS.** `terrain.js`
// écrit la bascule « Au-dessus du niveau zéro » ainsi :
//
//     float below = 1.0 - smoothstep(uSeaY - 0.05, uSeaY + 0.05, vWorldPos.y);
//
// `vWorldPos.y` est une hauteur en **UNITÉS DE SCÈNE**, sur un relief **DÉJÀ
// EXAGÉRÉ** ; le globe, lui, tient `h` en **MÈTRES BRUTS** et son niveau de la
// mer vaut **0 m**. Recopier « 0,05 » aurait donné cinq centimètres de bande
// là où le socle en a **12,21 m** à La Réunion à exagération 2 — c'est-à-dire
// une marche franche au lieu d'un fondu, sur toute la ligne de côte.
//
// ⚡ **LE FACTEUR, CHIFFRÉ** : unités de scène par mètre = `(span / e) × x`
// = `(56 / 27 356,4) × 2` = **4,094 4 × 10⁻³** — la valeur que `rapport-R24.md`
// publie pour « mètres→bloc » à La Réunion, exagération 2, retrouvée ici par le
// même chemin. Son inverse, **244,23 m par unité de scène**, est ce qui
// transforme 0,05 en **12,211 m**.
//
// ⚠️ **`/ exagération` PARCE QUE C'EST UNE HAUTEUR**, et le voisin horizontal
// (`pasGrilleBloc`) ne le porte PAS : `_ecrireRelief` n'applique l'exagération
// qu'à `y`. Les deux fautes symétriques ont déjà été payées sur ce chantier.
export const BANDE_ZERO_BLOC = 0.05 // la demi-bande de `terrain.js`, en unités de scène

/**
 * La demi-bande de fondu du niveau zéro, des unités de bloc aux mètres.
 * @param {object} a
 * @param {number} [a.bandeBloc] la demi-bande du socle (0,05 par défaut)
 * @param {number} a.extentMeters la largeur au sol du bloc, en mètres
 * @param {number} a.exageration l'exagération verticale VIVANTE
 * @param {number} [a.span] la largeur du bloc en unités de scène
 * @returns {number|null} la demi-bande en mètres, ou `null` si indécidable
 */
export function bandeZeroMatiereM({ bandeBloc = BANDE_ZERO_BLOC, extentMeters, exageration, span = COTE_CROP_UNITES } = {}) {
  const v = Number(bandeBloc)
  const e = Number(extentMeters)
  const x = Number(exageration)
  const s = Number(span)
  if (!(v > 0) || !(e > 0) || !(x > 0) || !(s > 0)) return null
  const echelle = (s / e) * x // unités de scène par mètre — la loi de `loi-altitude.js`
  const m = v / echelle
  return Number.isFinite(m) && m > 0 ? m : null
}

// ══════════ ③ L'ÉCHELLE DU BRUIT — HORIZONTALE, EN UNITÉS DE SCÈNE ═════════
//
// ⚠️ **ET ICI LE FACTEUR EST 28, PAS 1 — c'est le piège de cette tâche.**
// `terrain.js` écrit `mnNoise(champXZ() * uMatNoiseScale)`, et `champXZ()` rend
// des **unités de scène** (le x/z de monde, plus la fenêtre). Le globe ne
// connaît que `qCrop ∈ [−1, 1]`. Poser `mnNoise(qCrop * uMatNoiseScale)` aurait
// rendu des taches **vingt-huit fois plus grandes** que celles du socle : à
// `uMatNoiseScale = 0,5`, **0,5 période** en travers du bloc au lieu de 14 —
// c'est-à-dire UNE tache, donc pas un motif.
//
// ⚡ **LE FACTEUR EXISTE DÉJÀ ET IL EST VIVANT : `uFxDemiBloc` (= `uSlabHalf`).**
// La couche d'apparence le porte depuis P3 pour exactement cette raison, et la
// fenêtre continue le déplace. On réemploie **la même expression**,
// `qCrop × uFxDemiBloc + uFxFenetre`, plutôt que d'en écrire une seconde.
/**
 * Le champ du bruit de matière, en unités de scène (le jumeau JS de `champFx`).
 * @param {number[]} qCrop les coordonnées locales dans [−1, 1]
 * @param {number} demiBloc `uSlabHalf` VIVANT (28 à l'usine)
 * @param {number[]} [fenetre] le décalage de la fenêtre continue
 */
export function champMatiere(qCrop, demiBloc, fenetre = [0, 0]) {
  return [qCrop[0] * demiBloc + fenetre[0], qCrop[1] * demiBloc + fenetre[1]]
}

// ══════════ ④ LE VERRE — LE COÛT EST MESURÉ, ET IL EST RÉDHIBITOIRE ════════
//
// ⛔ **LA TRANSMISSION DE `three` N'EST PAS UNE LIGNE DE NUANCEUR : C'EST UN
// SECOND RENDU DE LA SCÈNE.** `WebGLRenderer.renderTransmissionPass` appelle
// `renderer.render(scene, camera)` dans `_transmissionRenderTarget` avant de
// dessiner l'objet transmissif. Sur le crop du socle, la scène est UN BLOC. Sur
// le globe, **la scène est la Terre entière**.
//
// ⚡ **MESURÉ AVANT DE PORTER QUOI QUE CE SOIT**, minuterie du pilote
// (`EXT_disjoint_timer_query_webgl2`), témoin de validité ×4 fragments ⇒ ×6,9 à
// ×7,6 de temps (`scripts/diag-r25-cout.mjs`, `.banc/R25/cout-transmission.json`) :
//
// | altitude | image seule | + une passe de scène | facteur |
// |---|---|---|---|
// | crop (dist 145,5) | **0,412 ms** | **1,593 ms** (pleine) / **1,715 ms** (au quart des fragments) | **×3,87** |
// | orbite (dist 100,6) | **0,405 ms** | **1,932 ms** / **1,955 ms** | **×4,78** |
//
// ⚠️ **ET LA SORTIE DE SECOURS N'EN EST PAS UNE : BAISSER LA RÉSOLUTION DE LA
// PASSE NE COÛTE PAS MOINS CHER.** Au quart des fragments (ciseau à 640 × 400),
// le surcoût est de **1,303 ms** contre 1,181 ms en pleine résolution —
// c'est-à-dire **le même, à la dérive du banc près**. La passe n'est pas limitée
// par les fragments : elle est limitée par la **re-soumission de la scène** (le
// quadtree entier, ses centaines de tuiles). Une cible demi-résolution, qui est
// précisément ce que `three` alloue, n'y changerait rien.
//
// ➡️ **DÉCISION : le verre est SANS OBJET en mode sphère, et sa vignette est
// CACHÉE** (avec ses cinq réglages). Ce n'est pas « tant pis » : c'est le
// départage que D16 exige — *« n'ajoute ni caméra ni passe de rendu sans l'avoir
// chiffrée »* —, chiffré.
export const COUT_TRANSMISSION = Object.freeze({
  crop: Object.freeze({ baseMs: 0.4119, avecMs: 1.5929, facteur: 3.867 }),
  orbite: Object.freeze({ baseMs: 0.4046, avecMs: 1.9319, facteur: 4.775 }),
})

// ══════════ ⑤ LES DEUX LONGUEURS DU VERRE, PUISQU'ON LES A CHERCHÉES ═══════
//
// ⚠️ **ELLES SONT ÉCRITES PARCE QU'ELLES ONT ÉTÉ LA PREMIÈRE PISTE, ET QUE LE
// PROCHAIN QUI ROUVRIRA LE VERRE LES REDEMANDERA.** `_makeGlassMaterial` pose
// `thickness: 8` et `attenuationDistance: 12` — des longueurs en **UNITÉS DE
// SCÈNE**, sur un relief déjà exagéré, donc la même conversion que la bande du
// niveau zéro. À La Réunion, exagération 2 :
//
//     8 unités  → 8 / 4,094 4e−3  = **1 954 m** d'épaisseur de verre
//     12 unités → 12 / 4,094 4e−3 = **2 931 m** de distance d'atténuation
//
// Recopier « 8 » et « 12 » dans un nuanceur qui compte en mètres aurait donné
// **huit mètres** de verre et huit mètres de teinte : un bloc de 27 km de large
// serait sorti **entièrement opaque**, la teinte saturée au premier mètre.
/**
 * Une longueur optique du verre, des unités de bloc aux mètres.
 * ⚠️ Même loi que `bandeZeroMatiereM` — une seule écriture n'était pas possible
 * sans donner à l'une le défaut de l'autre (`bandeBloc` a une valeur par
 * défaut, une longueur optique n'en a pas).
 */
export function longueurVerreM({ valeurBloc, extentMeters, exageration, span = COTE_CROP_UNITES } = {}) {
  return bandeZeroMatiereM({ bandeBloc: valeurBloc, extentMeters, exageration, span })
}

// ══════════ ⑥ CE QUI AGIT EN MODE SPHÈRE, ET CE QUI SE CACHE ═══════════════
//
// ⚠️ **MÊME MÉCANIQUE QUE `POSTES_LUMIERE_SPHERE` (R21), ET C'EST VOULU** : une
// table qui dit, poste par poste, s'il a un receveur — et le panneau la lit par
// `visibleWhen`. Une seule écriture de « ça n'agit pas », lisible par un test.
export const POSTES_MATIERE_SPHERE = Object.freeze({
  terrainMatScale: Object.freeze({ label: 'Échelle (tuilage)', surSphere: true, motif: 'uMatRepeat — les répétitions par largeur de bloc, facteur 1' }),
  terrainSurfaceBump: Object.freeze({ label: 'Relief de la matière', surSphere: true, motif: 'uMatBump — l’amplitude de la carte de normales' }),
  terrainMatRoughness: Object.freeze({ label: 'Rugosité', surSphere: false, motif: 'aucun receveur : le crop est éclairé par BRDF_Lambert seul (albedo × irradianceCrop × 1/π), 0 terme spéculaire et 0 envMap dans globe.js' }),
  terrainMatNoise: Object.freeze({ label: 'Bruit (révèle la base)', surSphere: true, motif: 'uMatNoise* — la révélation de la peinture, champ en unités de scène' }),
  terrainMatAboveZero: Object.freeze({ label: 'Au-dessus du niveau zéro', surSphere: true, motif: 'uMatAboveZero + uMatBandeM — la bande convertie en mètres' }),
  terrainGlassTint: Object.freeze({ label: 'Teinte du verre', surSphere: false, motif: 'la transmission est une passe de rendu : ×3,87 (crop) à ×4,78 (orbite) du temps d’image, mesuré' }),
  terrainGlassFrost: Object.freeze({ label: 'Givre', surSphere: false, motif: 'idem — passe de transmission' }),
  terrainGlassThickness: Object.freeze({ label: 'Épaisseur', surSphere: false, motif: 'idem — passe de transmission' }),
  terrainGlassClarity: Object.freeze({ label: 'Clarté', surSphere: false, motif: 'idem — passe de transmission' }),
  terrainGlassReflection: Object.freeze({ label: 'Reflet', surSphere: false, motif: 'idem — passe de transmission' }),
})

/** Le réglage `cle` a-t-il un receveur ? (`surSphere` faux ⇒ il se cache) */
export function matiereAgit(cle, surSphere) {
  const p = POSTES_MATIERE_SPHERE[cle]
  if (!p) return true
  return surSphere ? p.surSphere : true
}

/**
 * La vignette `id` a-t-elle un receveur en mode sphère ?
 * ⛔ **Seul le verre n'en a pas** — et c'est la mesure de `COUT_TRANSMISSION`
 * qui le dit, pas un goût.
 */
export function vignetteAgit(id, surSphere) {
  if (!surSphere) return true
  return id !== 'glass'
}

// ══════════ ⑦ LE JUMEAU JS DE LA RÉVÉLATION — pour que le test soit un test ═
//
// ⚠️ **`terrain.js` NE MÉLANGE PAS DEUX RÉVÉLATIONS, IL EN PREND LE MAXIMUM PAR
// UN AUTRE CHEMIN** : il écrit `effTint = max(effTint, below)` APRÈS
// `effTint = mix(uTint, 1.0, reveal)`. Comme `uTint` vaut 0 dès qu'une matière
// est posée, `mix(0, 1, reveal) = reveal`, donc `max(reveal, below)` — et c'est
// exactement ce que la forme ci-dessous écrit, en une fois.
/**
 * @param {number} teinte `uTint` (0 quand une matière est posée)
 * @param {number} reveal la part révélée par le bruit, dans [0, 1]
 * @param {number} below la part sous le niveau zéro, dans [0, 1]
 */
export function teinteMatiere(teinte, reveal, below) {
  const t = teinte + (1 - teinte) * Math.max(0, Math.min(1, reveal))
  return Math.max(t, Math.max(0, Math.min(1, below)))
}

// ══════════ ⑧ LE NUANCEUR — INJECTÉ, PAS RECOPIÉ ═══════════════════════════
//
// ⚠️ **`mnHash` / `mnNoise` SONT LES DEUX LIGNES DE `terrain.js` AU CARACTÈRE
// PRÈS.** Un bruit qui différerait d'une constante donnerait des taches au bon
// nombre et au mauvais endroit — le défaut le plus difficile à voir de tous,
// parce qu'il ressemble à un réglage.
//
// ⚠️ **`uMatOn` VAUT ZÉRO PAR DÉFAUT, exactement comme `uCropOn`, `uHabOn`,
// `uEclairageOn` et `uNormaleFineOn`** : sans `poserHabillage`, et sans matière
// choisie, l'image est celle du dépôt AU BIT PRÈS — `baseMat` reste
// `uAlbedoBase`, `teinteMat` reste `uAlbedoTeinte`, `nMat` reste `nMonde`.
//
// ⛔ **ET LES DOUZE UNIFORMES SONT DÉCLARÉS DANS `globe.js`, PAS ICI — C'EST UNE
// CORRECTION, ET UNE GARDE EXISTANTE ME L'A IMPOSÉE.** Je les avais mis dans ce
// texte-ci ; `②d ter` de `test/crop-rampe.test.js` a rougi avec *« uniformes lus
// mais jamais déclarés : uMatOn, uMatMap, … »*. Cette garde lit le TEXTE BRUT du
// fragment, où `${GLSL_MATIERE}` n'est pas encore substitué — elle ne pouvait
// donc pas les voir, et elle existe parce qu'*« un agent a livré du code qui
// plantait au démarrage AVEC 3 098 tests verts »*.
//
// ⚡ **AUCUN des sept autres modules de GLSL injectés ne déclare d'uniforme** —
// vérifié, `grep` sur `^uniform` dans `src/monde/` ne rendait que le mien. La
// convention du dépôt est donc : **un module injecté porte des FONCTIONS, et
// `globe.js` porte les déclarations.** ⛔ Affaiblir la garde pour y faire entrer
// mon écriture aurait été le contraire du travail.
export const GLSL_MATIERE = /* glsl */ `
// ═══ LA MATIERE DU RELIEF — src/monde/matiere-crop.js, Tache R25 ═══════════
// (les douze uniformes sont declares dans le fragment de globe.js — voir
// l en-tete ci-dessus : la garde ②d ter lit le texte BRUT du fragment)
// ⛔ mnHash / mnNoise NE SONT PAS REDECLARES ICI, ET C'EST UNE CORRECTION.
// Je les avais recopies de terrain.js en croyant les apporter : globe.js les
// PORTE DEJA (« le bruit de valeur du grain », ligne 1488, les memes deux lignes
// et les memes constantes). Le compilateur a rendu « function already has a body
// » sur les deux — et le nuanceur ENTIER refusait alors de se lier, donc plus
// une seule tuile ne se dessinait. Le banc differentiel, lui, n'a rien vu :
// dix-sept images CASSEES DE LA MEME FACON s'ecartent de 0,12 a 0,33 les unes
// des autres, c'est-a-dire du bruit. C'est la console qui l'a attrape.
// L UV DE LA MATIERE : qCrop [-1,1] -> uv [0,1] du maillage, puis les
// repetitions. La MEME conversion que cmUv pour les masques cuits. Facteur 1.
vec2 uvMatiere(vec2 qCrop) { return (qCrop * 0.5 + 0.5) * uMatRepeat; }
// LA NORMALE DE LA MATIERE. Le repere tangent est orthonormalise SUR nMonde
// (Gram-Schmidt) et non sur la sphere : sur une pente, la tangente de la sphere
// n est pas dans le plan de la surface, et la bosse s eclairerait de travers.
vec3 normaleMatiere(vec3 n, vec3 est, vec2 uv) {
  vec3 nm = texture2D(uMatNormal, uv).xyz * 2.0 - 1.0;
  nm.xy *= uMatBump;
  vec3 t = est - n * dot(est, n);
  float lt = length(t);
  if (lt < 1e-5) return n;
  t /= lt;
  vec3 b = cross(n, t);
  return normalize(t * nm.x + b * nm.y + n * max(nm.z, 1e-3));
}
`

// ══════════ ⑨ L'ÉTAT DE REPOS — UNE SEULE ÉCRITURE, PAS DEUX ═══════════════
//
// ⚠️ **C'EST LE CONTRAT QU'`⑨i` DE `test/crop-habillage.test.js` IMPOSE DÉJÀ À
// HUIT AUTRES POSTES** : un défaut recopié dans le constructeur ET dans
// `retirerHabillage` finit par diverger, et l'aller-retour bit à bit devient
// faux sans prévenir. Les valeurs vivent donc ici, et les deux endroits de
// `globe.js` les lisent.
//
// ⚠️ **`repeat` VAUT 1 ET NON 0 AU REPOS** : à `uMatOn = 0` l'UV n'est jamais
// calculée, mais un 0 laissé traîner ferait, le jour où quelqu'un allume la
// matière sans poser l'habillage, **un seul texel étiré sur tout le bloc** —
// c'est-à-dire un aplat, donc « la matière ne marche pas ». Un 1 rend la
// texture entière une fois : faux, mais visiblement faux.
export const MATIERE_MONDE_ETEINTE = Object.freeze({
  on: 0,
  normalOn: 0,
  repeat: 1,
  bump: 1,
  noiseOn: 0,
  noiseCut: 0,
  noiseSoft: 0.2,
  noiseScale: 0.5,
  aboveZero: 0,
  bandeM: 0,
})
