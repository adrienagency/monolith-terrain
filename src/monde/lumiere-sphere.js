// L'ÉCLAIRAGE DU CROP, CÔTÉ SPHÈRE — Tâche R21 du chantier « le studio sur le
// globe ». Huit réglages de l'inventaire (`inventaire-studio-2.md`) portaient
// ⛔ : 68 (douceur des ombres), 69 à 73 (l'appoint), 26 (ombrage auto) et
// 30 (ombrage des pentes).
//
// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que
// `directionSoleilLocale` (`eclairage-crop.js`, Tâche P3) et `fillDirection`
// (`daycycle.js`) — les deux lois qui existent déjà, pour ne pas en écrire une
// troisième. Il se vérifie sous node (`test/lumiere-sphere.test.js`).
//
// (Pas d'accent GRAVE dans les blocs `/* glsl */` plus bas : ils vivent dans des
// template literals JS et le termineraient — le piège que `terrain.js`,
// `ocean.js`, `naturel-crop.js` et `eclairage-crop.js` documentent tous.)
//
// ══════════ 0. CE QUE LA MESURE A DIT, AVANT TOUTE LIGNE DE CODE ════════════
//
// Banc : `scripts/sonde-studio-r18.mjs --fige`, Chrome sans tête 1280 × 800,
// ANGLE (NVIDIA RTX 3080, D3D11), port 5601, aucun paramètre d'URL — le mode
// sphère est le mode de démarrage depuis que `src/flags.js` lève ses drapeaux.
// Mouvement ambiant coupé, plancher de bruit relevé à **0,0000 / 0,0000** sur
// six relevés consécutifs. Les huit rendaient bien 0,000 et 0,000.
//
// ⚠️ **ET LE PALIER MACHINE EST RELEVÉ DANS LE MÊME PASSAGE, PAS SUPPOSÉ.**
// `window.__palierMachine` sur ce banc : `palier 0 « PLEINE QUALITÉ »`,
// `ombres: "dynamic"`, `ombresRes: 1024`, `params.shadowMode: "dynamic"`,
// `sun.castShadow: true`, `sun.shadow.mapSize: 1024 × 1024`. **Les ombres ne
// sont donc PAS éteintes par le palier** quand on mesure le n° 68 — le zéro
// qu'il rend n'est pas celui d'un mode dégradé. (`signaux.ecran` vaut
// `[800, 600]` et non la taille du panneau : le palier se décide au boot, avant
// `setViewport`. Ça ne change rien ici, le palier 0 est déjà le plus haut.)
//
// ══════════ 1. ⚡ LE DÉPARTAGE, ET DEUX VERDICTS DU BRIEF SONT FAUX ═════════
//
// | n° | réglage | issue | pourquoi, mesuré |
// |---|---|---|---|
// | 68 | Douceur des ombres | **sans objet** | le nuanceur du globe ne porte AUCUN bloc d'ombre (0 occurrence de `shadowmap` dans `globe.js`), le maillage du bloc plat n'est plus dessiné (`visibiliteSurface` : `socle = false` sous le drapeau, `terrain.mesh.visible = false` relevé), et la scène du bloc ne compte plus qu'UN receveur visible — un `ShadowMaterial` — pour ZÉRO maillage casteur (seule la lampe porte `castShadow`) |
// | 69-73 | Appoint (5) | **branchés** | une seconde direct est un terme ADDITIF de `RE_Direct` ; le crop reçoit déjà les trois autres irradiances |
// | 26 | Ombrage auto | **déjà branché — le 0,000 était un défaut de protocole** | c'est un LOQUET, et le rebasculer recalcule les MÊMES valeurs |
// | 30 | Ombrage des pentes | **branché** | la pente existe désormais sur la sphère : `nMonde`, la normale par fragment de la Tâche P9 |
//
// ══════════ 2. ⛔ LE 68 : LA PRÉMISSE DU BRIEF EST FAUSSE, ET DEUX FOIS ═════
//
// > Le brief R21 : *« `sun.shadow.radius` est en unités-monde. Si tu le recopies
// > tel quel côté globe, tu te trompes du rapport des deux échelles. »*
//
// ⛔ **NON.** `main.js` pose `renderer.shadowMap.type = THREE.VSMShadowMap`, et
// sous VSM `shadow.radius` est le rayon du flou gaussien appliqué à la CARTE
// D'OMBRE, exprimé en **texels de cette carte** (1 024 × 1 024 ici, valeur
// donnée par le palier machine, pas par un réglage). Ce n'est pas une longueur
// de scène : il n'y a donc aucun rapport d'échelle à appliquer, et un portage
// « converti » aurait été faux dans les deux sens.
//
// ⛔ **ET IL N'Y A RIEN À CONVERTIR PARCE QU'IL N'Y A RIEN À OMBRER.** Trois
// constats indépendants, tous relevés dans l'application vivante :
//   ① `globe.js` ne contient pas une seule occurrence de `shadowmap` /
//      `shadowMap` : le matériau de tuile est un `ShaderMaterial` nu, il ne peut
//      ni couler ni recevoir d'ombre — aucune ligne à écrire ne le changerait
//      sans porter tout `lights_fragment_begin` ;
//   ② `visibiliteSurface({terreUnique: true, …}).socle` vaut **false**, et
//      `terrain.mesh.visible` a été relevé à **false** : le seul receveur
//      historique n'est plus dessiné ;
//   ③ dans la scène du bloc, **42 objets visibles, 1 receveur, 1 casteur** — le
//      casteur est la `DirectionalLight` elle-même, le receveur est un
//      `ShadowMaterial` (le plan d'ombre portée). **Zéro maillage casteur.**
//
// ➡️ Le curseur est donc **caché en mode sphère** (`ui/light-panel.js`), et
// c'est tout ce qu'il y a à faire : il pilote toujours le bloc plat quand le
// bloc plat est dessiné, et il voyage dans les gabarits.
//
// ══════════ 3. ⚡ LE 26 : UN LOQUET MESURÉ COMME UN INTERRUPTEUR ════════════
//
// ⛔ **L'INVENTAIRE A MESURÉ LE BON CONTRÔLE AVEC LE MAUVAIS GESTE.**
// « Ombrage auto » n'est pas un interrupteur d'effet : c'est un LOQUET.
// `setShadeAuto(v)` fait `params.shadeAuto = v` puis, **si v est vrai**,
// `applyAutoShade({force: true})`. Or l'auto est allumé au départ et ses quatre
// valeurs sont DÉJÀ appliquées :
//   · l'éteindre n'écrit rien (la fonction sort sur `if (!params.shadeAuto)`) ;
//   · le rallumer recalcule `gradeForDem(...)` sur le MÊME MNT et réécrit les
//     MÊMES quatre nombres.
// **Un aller-retour idempotent rend 0,000 par construction**, et c'est ce que
// l'inventaire a lu. Le protocole qui le voit : FIGER d'abord un des quatre
// (bouger « Contraste d'altitude » appelle `markShadeDirty`), puis rallumer
// l'auto — `force: true` efface le gel et la valeur revient. Mesuré ainsi :
// **moy 1,684 · grad 0,553** (le même écart que le curseur lui-même).
//
// ⚠️ **ET TROIS DE SES QUATRE CLÉS ATTEIGNENT DÉJÀ LA SPHÈRE**, par
// `applyStyle` → `terrain.mapUniforms` → `contexteCrop` → `poserHabillage` :
// `mapTint` (→ `uAlbedoTeinte`, relevé 0,68 des deux côtés), `heightContrast`
// (2,5) et `heightPivot` (0,65). La quatrième était `slopeTint` — le n° 30, que
// cette tâche branche. **Après R21, les quatre voyagent.**
//
// ══════════ 4. LE 30 : LA PENTE EXISTE ENFIN SUR LA SPHÈRE ═════════════════
//
// `naturel-crop.js` déclarait `slopeTint` LAISSÉ, et sa raison était juste
// **à l'époque où elle a été écrite** :
//
// > *« Les tuiles du globe ne portent que `vNormalW`, la normale de la SPHÈRE :
// > la pente du terrain n'existe pas dans ce nuanceur. »*
//
// ⚡ **LA TÂCHE P9 L'A CRÉÉE DEPUIS.** `nMonde` est la normale par fragment,
// dérivée de la texture de hauteur de la tuile (`normaleParGradientSol`), et
// D15 / R6 l'allument PARTOUT (`uNormaleFineOn`, relevé à 1). La transcription
// est alors littérale, et **sans facteur** :
//
//   socle  `float slope = 1.0 - clamp(wN.y, 0.0, 1.0);`   (`terrain.js:959`)
//   globe  `float slope = 1.0 - clamp(dot(n, haut), 0.0, 1.0);`
//
// ⚠️ **LA CONVERSION EST DE FACTEUR 1, ET VOICI POURQUOI CE N'EST PAS UN
// RACCOURCI.** `wN.y` est le cosinus entre la normale et la verticale du socle,
// qui est `+Y` parce que le bloc est plat ; `dot(n, haut)` est le cosinus entre
// la normale et la verticale LOCALE, qui n'est plus `+Y` sur une sphère.
// **La grandeur est la même — un cosinus, sans dimension — parce que les deux
// verticales sont la même verticale**, celle du lieu.
//
// ⛔ **RECOPIER `nMonde.y` AURAIT ÉTÉ LA FAUTE, ET ELLE EST CHIFFRÉE.** Au lieu
// par défaut, La Réunion, lat **−21,26°** : `haut = (0,7702 · −0,3626 · 0,5246)`,
// donc `haut.y` est **NÉGATIF**. `clamp(nMonde.y, 0, 1)` y vaut **0** sur un sol
// rigoureusement plat, et la pente lue vaut **1 — le maximum** : tout
// l'hémisphère SUD aurait été peint en brun de versant, à plat. Dans
// l'hémisphère nord la faute est moins spectaculaire et non moins fausse : à
// Annecy (45,9°) elle rend **0,282** au lieu de 0.
//
// ⚠️ **CE QUI RESTE DIFFÉRENT, ET IL FAUT LE DIRE : LE PAS DE LA DÉRIVÉE.** Le
// socle tire `wN` de `computeVertexNormals` sur SA grille (771 sommets pour
// 27 354 m d'emprise relevés, soit **35,5 m** entre deux sommets) ; le globe
// tire `nMonde` d'une différence centrée au pas `max(1/uTilePx, pasEmpreinte)`.
// Une pente lue à un pas plus large est plus DOUCE. La loi est donc la même,
// **la finesse ne l'est pas** — et c'est le `smoothstep(0.3, 0.8, slope)` qui
// encaisse l'écart. Ce n'est pas une conversion d'unité, c'est une résolution :
// aucun facteur ne la corrigerait, seul un pas égal le ferait.
//
// ══════════ 5. L'APPOINT : UN TERME ADDITIF, ET RIEN D'AUTRE ═══════════════
//
// ⛔ **CE QUE L'APPOINT EST DANS LA SCÈNE DU BLOC** : une `THREE.DirectionalLight`
// sans ombre (`main.js`, `fillLight`), créée au boot et jamais retirée — trois
// lampes dans la scène, `sun` + `hemi` + `fillLight`. `three` en accumule la
// contribution dans `RE_Direct`, c'est-à-dire **`couleur × intensité × max(N·L, 0)`
// ajouté à `irradiance`**, avant le `BRDF_Lambert` unique.
//
// ⚡ **LE CROP FAIT DÉJÀ EXACTEMENT ÇA POUR LE SOLEIL** : `irradianceCrop`
// (`eclairage-crop.js`) rend `soleil × max(ndl, 0) + mix(sol, ciel, w)`. Ajouter
// l'appoint, c'est **un second terme direct dans la même somme** — pas une
// seconde loi, pas un second `BRDF`. C'est la garde que D13 §③ demande.
//
// ══════════ 6. ⚠️ LES CONVERSIONS D'UNITÉ, ÉCRITES, AVEC LEUR FACTEUR ══════
//
// Le brief compte NEUF occurrences de ce défaut sur ce chantier (facteurs
// 121,6 · 10 · 130,4 · 6, une portée de flou de 1 465 km, des toponymes 1 830 m
// sous les Alpes). Voici les quatre grandeurs que R21 déplace, chacune avec son
// facteur CHIFFRÉ — y compris quand il vaut 1, parce qu'un 1 non écrit est un
// 1 non vérifié.
//
// | grandeur | espace de départ | espace d'arrivée | facteur | pourquoi |
// |---|---|---|---|---|
// | azimut de l'appoint | degrés, repère du socle (est/haut/nord), origine EST, sens vers le SUD en z | degrés, même convention | **1** | `placeFill` construit sa position avec `(cos az cos el, sin el, sin az cos el)` — **les trois mêmes termes que `placeSun`**, ligne à ligne. `directionSoleilLocale` est écrite pour cette convention-là et le test ⑤ de `crop-eclairage.test.js` la garde. |
// | élévation de l'appoint | degrés au-dessus de l'horizon local, **bornée [−10 ; 90]** par `fillDirection` | idem | **1** | ⚠️ **ET LA BORNE BASSE N'EST PAS COSMÉTIQUE** : à −10° la lampe éclaire PAR-DESSOUS. `directionSoleilLocale` le rend sans broncher (`sin(el) < 0` sur `haut`), et `max(ndl, 0)` l'éteint sur les faces qui lui tournent le dos. C'est le comportement du socle, au bit près. |
// | intensité | `fillLight.intensity`, sans unité three | irradiance linéaire du nuanceur | **1** | ⚠️ **ET C'EST MESURÉ, PAS DÉDUIT.** Le soleil suit le même chemin : relevé dans l'application vivante, `sun.intensity = 3,8` et `sun.color = #fff7e6` donnent `uSoleilIrr = (3,800 · 3,534 · 3,007)`, c'est-à-dire **exactement `couleur_linéaire × intensité`** (linéaire de `#fff7e6` = 1 · 0,9301 · 0,7913). `poserIrradiance` ne fait rien d'autre, et l'appoint y entre par la même porte. |
// | couleur | `#rrggbb` sRVB | linéaire | **la conversion de three**, pas une formule écrite ici | `Color.setStyle(hex, SRGBColorSpace)`. `#ffcf9a` → (1 · 0,6038 · 0,3231). |
//
// ⛔ **ET LA VALEUR SE LIT SUR LA LAMPE, JAMAIS SUR `params`** — c'est la règle
// que `contexteCrop` porte déjà en toutes lettres pour le soleil. `fillLight`
// porte deux choses que `params.fillIntensity` ne porte pas : l'interrupteur
// (`fillLightIntensity` rend **0 exactement** quand `fillEnabled` est faux) et
// l'écrêtage à **[0 ; 4]**. Lire `params` aurait donné un crop éclairé par un
// appoint éteint, et un appoint à 12 quand un gabarit porte 12.

import { directionSoleilLocale } from './eclairage-crop.js'
import { fillDirection } from '../daycycle.js'

/**
 * L'état de repos de l'appoint sur la sphère : **éteint, et donc neutre au bit
 * près**.
 *
 * ⚠️ **L'IRRADIANCE NULLE EST LA GARDE, PAS UN INTERRUPTEUR DE PLUS.** À
 * `(0, 0, 0)`, `irradianceAppoint` rend `(0, 0, 0)` quelle que soit la normale
 * et quelle que soit la direction : la somme du nuanceur est inchangée, terme à
 * terme. C'est le même patron que `uReliefMondeGain = 0` (`planete-eclairee.js`)
 * et que `ECLAIRAGE_MONDE` (`eclairage-crop.js`) — pas de second booléen à tenir
 * d'accord.
 */
export const APPOINT_MONDE_ETEINT = Object.freeze({
  dir: Object.freeze([0, 1, 0]),
  irr: Object.freeze([0, 0, 0]),
})

/**
 * L'ombrage des pentes AU REPOS : zéro, donc `teintePente` rend `mapCol` au bit
 * près (`mix(a, b, 0)` vaut `a` exactement en float32). C'est la garde du
 * n° 30, et c'est la même que `RELIEF_MONDE_NUL` (`planete-eclairee.js`).
 */
export const PENTE_MONDE_NULLE = 0

/**
 * La direction de l'appoint dans le repère du globe.
 *
 * ⚠️ **DEUX LOIS EXISTANTES, ZÉRO LOI NEUVE.** `fillDirection` (`daycycle.js`)
 * fait la somme azimut du soleil + écart et l'écrêtage d'élévation — c'est elle
 * que `placeFill` appelle, et c'est donc elle qui définit « l'appoint suit le
 * soleil ». `directionSoleilLocale` (`eclairage-crop.js`, Tâche P3) replace un
 * couple (azimut, élévation) du repère du socle dans celui du globe. Les
 * réécrire ici aurait fait deux jumelles à garder d'accord.
 *
 * @param {number} soleilAzimutDeg `params.sunAzimuth`
 * @param {number} ecartDeg `params.fillAzimuthOffset` — l'écart AU SOLEIL
 * @param {number} hauteurDeg `params.fillElevation`, borné [−10 ; 90] par `fillDirection`
 * @param {number} latDeg latitude du centre du crop
 * @param {number} lonDeg longitude du centre du crop
 * @returns {number[]|null} un vecteur UNITAIRE, ou `null` si une donnée manque —
 *   l'appelant laisse alors l'appoint éteint plutôt que de pointer nulle part.
 */
export function directionAppointMonde(soleilAzimutDeg, ecartDeg, hauteurDeg, latDeg, lonDeg) {
  if (!Number.isFinite(soleilAzimutDeg)) return null
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null
  const d = fillDirection(soleilAzimutDeg, ecartDeg, hauteurDeg)
  return directionSoleilLocale(d.azimuth, d.elevation, latDeg, lonDeg)
}

/**
 * L'irradiance que l'appoint verse sur une normale — le terme direct de plus.
 *
 * ⚠️ **`max(ndl, 0)` ET NON `abs`** : une lampe directionnelle n'éclaire pas la
 * face arrière. C'est le `dotNL` de `three` (`RE_Direct`), et c'est aussi ce que
 * `irradianceCrop` fait déjà pour le soleil — **une grandeur, une loi**.
 *
 * @param {number} ndl `dot(N, L)` — NON borné à l'entrée, borné ici
 * @param {number[]} appoint l'irradiance linéaire de la lampe (couleur × intensité)
 * @returns {number[]} trois canaux, jamais négatifs
 */
export function irradianceAppoint(ndl, appoint) {
  const d = Math.max(Number.isFinite(ndl) ? ndl : 0, 0)
  const a = Array.isArray(appoint) ? appoint : APPOINT_MONDE_ETEINT.irr
  return [(a[0] || 0) * d, (a[1] || 0) * d, (a[2] || 0) * d]
}

/**
 * La pente du sol, sur la sphère — le jumeau de `1 - clamp(wN.y, 0, 1)`.
 *
 * ⚠️ **`dot(n, haut)` ET NON `n.y`**, et le §4 en donne le chiffre : à
 * La Réunion (lat −21,26°), `haut` ne porte que **0,3625** de composante Y. Un
 * `n.y` recopié aurait déclaré 63,7° de pente sur un sol horizontal.
 *
 * @param {number[]} n la normale par fragment (unitaire)
 * @param {number[]} haut la verticale locale (unitaire)
 * @returns {number} 0 à plat, 1 à la verticale
 */
export function penteSol(n, haut) {
  const d = n[0] * haut[0] + n[1] * haut[1] + n[2] * haut[2]
  return 1 - Math.min(1, Math.max(0, d))
}

/**
 * Le brun des versants — `terrain.js:1096`, transcrit sans un chiffre de plus.
 *
 * ⚠️ **LES TROIS CONSTANTES VIENNENT DU DÉPÔT** : la couleur (0,42 · 0,31 ·
 * 0,21) et les deux bornes du `smoothstep` (0,3 et 0,8) sont celles de la
 * branche `else` du mode Classique. Les rechoisir aurait fait deux ombrages de
 * pente qui ne se ressemblent pas de part et d'autre du seuil du crop.
 */
export const PENTE_BRUN = Object.freeze([0.42, 0.31, 0.21])
export const PENTE_BAS_SLOPE = 0.3
export const PENTE_HAUT_SLOPE = 0.8

/**
 * @param {number[]} mapCol la couleur de carte déjà peinte
 * @param {number} slope ce que rend `penteSol`
 * @param {number} k `uSlopeTint`, 0 = neutre AU BIT PRÈS
 * @returns {number[]}
 */
export function teintePente(mapCol, slope, k) {
  const t = lissePente(slope) * (Number.isFinite(k) ? k : 0)
  return [
    mapCol[0] + (PENTE_BRUN[0] - mapCol[0]) * t,
    mapCol[1] + (PENTE_BRUN[1] - mapCol[1]) * t,
    mapCol[2] + (PENTE_BRUN[2] - mapCol[2]) * t,
  ]
}

/** Le `smoothstep(0.3, 0.8, slope)` de GLSL, en JS — l'oracle du jumeau. */
export function lissePente(slope) {
  const t = Math.min(1, Math.max(0, (slope - PENTE_BAS_SLOPE) / (PENTE_HAUT_SLOPE - PENTE_BAS_SLOPE)))
  return t * t * (3 - 2 * t)
}

/**
 * ⚠️ **UNE SEULE ÉCRITURE DE CHAQUE LOI, ET C'EST CELLE-CI.** Le GLSL ci-dessous
 * est la transcription des trois fonctions au-dessus ;
 * `test/lumiere-sphere.test.js` le TRADUIT ET L'EXÉCUTE contre elles, il ne le
 * cherche pas par son nom — la Tâche K ter a trouvé une assertion verte parce
 * qu'elle lisait une formule dans un commentaire, et `planete-eclairee.js` porte
 * la même précaution mot pour mot.
 */
export const GLSL_LUMIERE_SPHERE = `
vec3 irradianceAppoint(float ndl, vec3 appoint) {
  return appoint * max(ndl, 0.0);
}
float penteSol(vec3 n, vec3 haut) {
  return 1.0 - clamp(dot(n, haut), 0.0, 1.0);
}
vec3 teintePente(vec3 mapCol, float slope, float k) {
  return mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * k);
}
`

// ══════════ 7. LA TABLE DES HUIT — ELLE COMMANDE L'INTERFACE ════════════════
//
// > **Le brief R21, exigence n° 2 :** *« Aucun curseur ne doit rester affiché en
// > mode sphère s'il n'agit pas. Un réglage mort visible est pire qu'un réglage
// > absent — c'est ce qui a produit cet inventaire. »*
//
// ⚠️ **UNE TABLE, PAS UN `if` DANS LE PANNEAU.** R18 a posé des NOTES dans
// l'interface (« l'appoint éclaire l'ancienne scène ») ; elles étaient justes et
// elles laissaient les curseurs affichés. R21 les retire quand elles sont
// devenues fausses, et CACHE ce qui reste mort. La décision vit ici pour qu'un
// test l'exécute au lieu de la relire dans le DOM.
//
// ⛔ **ON NE RETIRE RIEN DU MOTEUR.** Ces réglages pilotent toujours le bloc
// plat quand le bloc plat est dessiné, et ils voyagent dans les gabarits
// (`templates-user.js`). « Caché en mode sphère » n'est pas « supprimé ».
export const POSTES_LUMIERE_SPHERE = Object.freeze({
  shadowSoftness: Object.freeze({
    n: 68,
    surSphere: false,
    motif: 'aucun receveur : 0 occurrence de shadowmap dans globe.js, terrain.mesh.visible = false, 1 receveur ShadowMaterial pour 0 maillage casteur',
  }),
  fillEnabled: Object.freeze({ n: 69, surSphere: true, motif: 'terme direct additif dans irradianceCrop ; eteint = irradiance nulle, donc somme inchangee' }),
  fillIntensity: Object.freeze({ n: 70, surSphere: true, motif: 'lue sur fillLight.intensity, qui porte l interrupteur et l ecretage [0 ; 4]' }),
  fillAzimuthOffset: Object.freeze({ n: 71, surSphere: true, motif: 'somme par fillDirection puis directionSoleilLocale, facteur 1' }),
  fillElevation: Object.freeze({ n: 72, surSphere: true, motif: 'bornee [-10 ; 90] par fillDirection ; -10 eclaire sous l horizon local' }),
  fillColor: Object.freeze({ n: 73, surSphere: true, motif: 'sRVB vers lineaire par three, comme le soleil, puis x intensite' }),
  shadeAuto: Object.freeze({
    n: 26,
    surSphere: true,
    motif: 'loquet : ses quatre cles traversent par applyStyle -> contexteCrop -> poserHabillage',
  }),
  slopeTint: Object.freeze({
    n: 30,
    surSphere: true,
    motif: 'la pente existe depuis la normale par fragment de la Tache P9',
  }),
})

/**
 * Les réglages à CACHER quand le bloc plat n'est pas dessiné.
 *
 * @param {boolean} surSphere `true` quand le maillage du bloc plat a cédé la
 *   place à la découpe dans la planète — c'est-à-dire `terreUniqueActive()`.
 * @returns {string[]} les clés de `params` dont la ligne doit disparaître
 */
export function curseursMorts(surSphere) {
  if (!surSphere) return []
  return Object.keys(POSTES_LUMIERE_SPHERE).filter((k) => !POSTES_LUMIERE_SPHERE[k].surSphere)
}

/**
 * ⚠️ **LA QUESTION QUE LE PANNEAU POSE, ET ELLE EST NOMMÉE.** Un `visibleWhen`
 * qui inline `!ctx.surSphere?.()` se recopierait à chaque nouveau curseur mort.
 * @param {string} cle une clé de `params`
 * @param {boolean} surSphere
 */
export function reglageAgit(cle, surSphere) {
  const p = POSTES_LUMIERE_SPHERE[cle]
  if (!p) return true
  return surSphere ? p.surSphere : true
}
