f78cb3f tache P6 : les six trous que la campagne de mutation a trouves
9275686 tache P6 : la houle du crop etait 121,6 fois trop haute — une valeur juste dans la mauvaise monnaie
6979b36 tache P6 : la forme du bloc du crop prend celle du socle, et les tests des dix branchements
d9b2213 tache P6 : le soleil du bloc atteint enfin la mer et les parois, et la lame d eau prend les quatre reglages du socle

 src/globe.js                  | 314 +++++++++++++++++++++++++++++++++---
 src/main.js                   |  49 ++++++
 src/monde/branchement-crop.js | 106 +++++++++++-
 src/monde/eclairage-crop.js   |  20 ++-
 src/monde/ecume-mer.js        | 164 +++++++++++++++++++
 src/monde/mer-sphere.js       |  30 ++++
 src/monde/parois-crop.js      |  17 +-
 src/ocean.js                  |  80 +++++++--
 test/crop-branche.test.js     | 169 ++++++++++++++++++-
 test/crop-eclairage.test.js   |  77 +++++++++
 test/ecume-mer.test.js        | 337 +++++++++++++++++++++++++++++++++++++-
 test/mer-sphere.test.js       | 367 +++++++++++++++++++++++++++++++++++++++++-
 12 files changed, 1672 insertions(+), 58 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index 19f6336..670821b 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -115,34 +115,47 @@ import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
 // ══════════ L'ÉCLAIRAGE DU CROP — Tâche P3 ═════════════════════════════════
 //
 // > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
 // > tuile du globe est une COULEUR NUE. »
 //
 // Même patron que `naturel-crop.js` juste au-dessus : la loi vit dans un module
 // PUR qui porte son propre texte GLSL, et ce fichier l'INJECTE. Il n'y a donc
 // pas deux écritures de l'éclairage à garder d'accord.
 import {
   GLSL_ECLAIRAGE,
+  // ⚠️ **LE MORCEAU DÉTACHÉ, POUR LES PAROIS — Tâche P6.** Leur nuanceur est
+  // NU : ni rampe, ni peinture, donc pas de `natLuminance`, dont
+  // `GLSL_ECLAIRAGE` dépend. C'est la MÊME loi, injectée seule.
+  GLSL_IRRADIANCE,
+  RECIPROQUE_PI,
   ECLAIRAGE_MONDE,
   directionSoleilLocale,
   hautLocal,
   irradianceAmbiante,
 } from './monde/eclairage-crop.js'
 // ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
 //
 // > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
 // > est en PLAQUES. »
 //
 // Même patron encore : la loi vit une seule fois dans un module PUR, `ocean.js`
 // et ce fichier injectent le MÊME texte. L'en-tête d'`ecume-mer.js` nomme les
 // quatre entrées qui manquaient et donne leur mesure.
-import { GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE, ETAT_MER_NEUTRE } from './monde/ecume-mer.js'
+// ⚠️ **ET LA LAME D'EAU DEPUIS LA TÂCHE P6**, pour la même raison et par le même
+// chemin : `corpsEau`, `opaciteEau`, `clapotNormale`, `glintTavelureMer` et
+// `blanchirEcume` vivaient UNIQUEMENT dans `ocean.js`, et ce fichier n'en
+// portait qu'une version tronquée — sans la tirette de transparence, sans le
+// glacis de lagon, sans la nuit, et sans le moindre clapot de normale.
+import {
+  GLSL_ECUME, GLSL_LAME_EAU, FREQ_TAVELURE,
+  ACCALMIE_NEUTRE, ETAT_MER_NEUTRE, LAME_EAU_NEUTRE, CLAPOT_NORMALE,
+} from './monde/ecume-mer.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -262,23 +275,37 @@ void main() {
   // UNITES DE SCENE. Deux unites dans la meme soustraction, et rien ne l'aurait
   // dit. (Aucun accent grave dans ce bloc : template literal.)
   // ⚠️ LA HOULE PORTE L ACCALMIE DE VUE, ET C EST L EXPRESSION D ocean.js —
   // Tache P5. La-bas : oceanGerstner(xz, t, uWaveH * uViewCalm, ...) au vertex,
   // et shoreSurf recoit uWaveH BRUT. Ici uMerCalmeVue EST uViewCalm, pose par
   // majReglagesMer depuis l uniforme vivant du socle. Sans ce facteur, brancher
   // uMerHoule sur uWaveH aurait rendu une houle 2,5 fois trop haute (uWaveH = 2,
   // uViewCalm = 0,4039 releves le meme instant). ⚠️ Le NEUTRE de l accalmie vaut
   // 1 (ACCALMIE_NEUTRE), donc sans socle a lire ce facteur ne change rien.
   // (Aucun accent grave ni apostrophe dans ce bloc : template literal.)
-  vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule * uMerCalmeVue, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
+  // ⛔ ET L AMPLITUDE ETAIT DANS LA MAUVAISE MONNAIE — Tache P6, VU A L ECRAN.
+  // uMerHoule vaut ce que vaut uWaveH du socle, c est-a-dire des UNITES DE
+  // SOCLE ; oceanGerstner ajoute cette amplitude aux coordonnees du maillage,
+  // qui sont ici en UNITES DE SCENE. Releve le 2026-08-22 a La Reunion :
+  // uMerUnite = 0,008227, donc uMerHoule = 2 valait 121,6 FOIS l amplitude du
+  // socle. Le deplacement HORIZONTAL (disp.xz, que l ecretage de deferlement ne
+  // borne pas) atteignait plusieurs fois la largeur du bloc : le maillage se
+  // repliait sur lui-meme et la nappe rendait de grands rubans pales a bords en
+  // escalier. A/B a temoin nul dans la meme page, boucle coupee : uMerHoule mis
+  // a zero les fait DISPARAITRE, uMerHoule x uMerUnite aussi
+  // (.banc/P6/D2-CROP-mer-sans-houle.png et D4-CROP-mer-houle-convertie.png).
+  // C EST LA MEME FAUTE QUE LA TAVELURE DE P4 ET QUE LE BUDGET DE FOND DE P5 :
+  // une valeur juste, branchee dans la mauvaise unite. uMerLambda, lui, etait
+  // deja converti — l asymetrie est ce qui l a rendue invisible.
+  vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule * uMerCalmeVue * uMerUnite, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
   float creteS = 0.0;
-  vec3 surf = shoreSurf(uvF, uMerChamp, uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, richesseMer, creteS);
+  vec3 surf = shoreSurf(uvF, uMerChamp, uMerTemps, uMerHoule * uMerUnite, uMerChop, uMerVitesse, uMerLambda, richesseMer, creteS);
   disp.y += surf.x;
   nAcc.x += surf.y;
   nAcc.z += surf.z;
   crete = max(crete, creteS);
 
   // ---- CRITÈRE DE DÉFERLEMENT, porté de ocean.js : une vague ne dépasse pas
   // 0,78 fois sa profondeur. Limite DOUCE, pas un écrêtage : cap(1 − e^(−a/cap))
   // vaut a en eau profonde et tend vers cap en eau basse.
   float cap = 0.78 * vProfondeur;
   float amp = abs(disp.y);
@@ -316,20 +343,39 @@ uniform float uMerBrillance;
 uniform float uMerPortee;
 uniform float uMerLambda;
 uniform float uMerUnite;      // unites de scene par unite de socle — Tache P4
 // ══════ LES DEUX ACCALMIES D'ocean.js, LUES ET NON RECALCULEES — Tache P4 ══
 // Elles pesent 0,4039 et 0,08 dans la page vivante du 2026-08-22 : le ressac du
 // socle y est multiplie par 0,0323 quand la calotte le multipliait par 1. Un
 // seul ecrivain, Ocean.setView ; la calotte prend ses valeurs. Neutre : 1.
 uniform float uMerCalmeVue;
 uniform float uMerCalmeSurf;
 uniform float uMerGivre;   // le socle de verre du mode plat (uFrost) — 0 = pas de verre
+// ══════ LA LAME D'EAU — Tache P6, la reserve n° 2 de P5 ═══════════════════
+// QUATRE reglages d'ocean.js que la calotte n'avait JAMAIS recus, et aucun
+// parametre ne les portait. Releves le 2026-08-22 dans la page vivante :
+// uTransp = 0,57 (la lame du crop etait 1,556 fois trop opaque), uSunFx = 0,72
+// (28 % de glint de trop), uDetail = 0,75 (la calotte n'avait AUCUN clapot de
+// normale), uDayLight (la mer du crop ne s'eteint pas la nuit).
+uniform float uMerTransp;
+uniform float uMerSoleilFx;
+uniform float uMerJour;
+uniform float uMerDetail;
+// ══════ LE SOLEIL DU BLOC, PAS CELUI DE LA PLANETE — Tache P6 ════════════
+// uSunDir est repose A CHAQUE IMAGE sur camGlobe.position tournee de 42° : le
+// glint de la mer du crop suivait la CAMERA. Releve le meme jour :
+// uSunDir = (0,2305 -0,3687 0,9005) — SOUS l'horizon — pendant que le soleil de
+// la scene pointait (0,4392 0,5629 -0,7001). uSoleilDir, lui, est deja le
+// soleil du socle place dans le repere du globe (Tache P3) ; il n'est valable
+// que sous uEclairageOn, et sans lui la calotte reprend la loi de planete.
+uniform vec3 uSoleilDir;
+uniform float uEclairageOn;
 uniform float uCropCoin;
 uniform float uCropCoinN;
 // LE BORD DE LA MER — Tache J. (debut, fin) du fondu, en demi-cotes de crop,
 // MESURES DEPUIS LA FRONTIERE DE LA DECOUPE : 0 = la frontiere. La loi vit dans
 // src/monde/mer-sphere.js (bordDeMer) et SUIT L'ESTOMPAGE de la Terre autour.
 // ⚠️ uCropCoin et uCropCoinN etaient DECLARES ICI ET LUS PAR PERSONNE depuis la
 // Tache F — deux uniformes morts, exactement ce que le §Q du plan traque. Ils
 // portent desormais la mesure du bord, la MEME que celle de la decoupe
 // (globe.js, cq / pn du nuanceur des tuiles) : pas une seconde ecriture de la
 // superellipse, la meme, appliquee a une autre surface.
@@ -337,20 +383,21 @@ uniform vec2 uMerBord;
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
 varying float vFonduRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
 varying float vJupe;
 ${GLSL_ECUME}
+${GLSL_LAME_EAU}
 ${GLSL_JUPE_MER}
 
 float bruitMer(vec2 q) {
   vec2 i = floor(q);
   vec2 f = fract(q);
   f = f * f * (3.0 - 2.0 * f);
   float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
   float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
   float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
   float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
@@ -394,33 +441,55 @@ void main() {
   // haute de la paroi. Le terme min(max(q.x, q.y), 0.0) est la distance
   // interieure de la boite arrondie (la forme close usuelle) : il vaut ZERO
   // dehors, donc le dehors reste au bit pres ce qu il etait.
   vec2 q = abs(vCrop) - (1.0 - uCropCoin);
   vec2 cq = max(q, 0.0);
   float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
   float dBord = pn - uCropCoin + min(max(q.x, q.y), 0.0); // 0 = frontiere, < 0 = DEDANS
   float bord = 1.0 - smoothstep(uMerBord.x, uMerBord.y, dBord);
   if (bord <= 0.0) discard;
 
-  float d01 = clamp(vProfondeur / max(uMerProfMax, 1e-9), 0.0, 1.0);
+  // ⛔ ICI VIVAIT UN d01 QUE PERSONNE NE LISAIT — un uniforme mort de plus, de
+  // la famille que le §Q du plan traque et que uCropCoin a deja illustree.
   // le dégradé lagon vit sur les premiers 15 % du budget — une baie de 30 m est
   // un lagon, le budget couvre des colonnes de mille mètres (ocean.js)
   float dLagon = clamp(vProfondeur / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
-  vec3 col = mix(uMerPeu, uMerFond, pow(dLagon, 0.7));
+  // ══════ LE CORPS DE L EAU — Tache P6 ═════════════════════════════════════
+  // Il portait mix(uMerPeu, uMerFond, pow(dLagon, 0.7)) : le corps d ocean.js
+  // AMPUTE de son glacis de lagon (donc de la tirette de transparence) et de sa
+  // nuit. corpsEau est la loi entiere, injectee depuis monde/ecume-mer.js.
+  vec3 col = corpsEau(uMerPeu, uMerFond, dLagon, poidsLagonEau(uMerTransp), uMerJour);
 
   vec3 V = normalize(cameraPosition - vMonde);
-  vec3 N = normalize(vNormMer);
-  vec3 L = normalize(uSunDir);
+  // ══════ LE CLAPOT DE NORMALE — Tache P6, ET LA CALOTTE N EN AVAIT AUCUN ══
+  // ocean.js : rp = xz * 6.0, ou xz est en UNITES DE SOCLE. On convertit par
+  // uMerUnite, exactement comme la tavelure depuis P4 — la meme monnaie, pas
+  // une seconde. C est ce terme qui fait qu une lame d eau AJOUTE de la
+  // variation au lieu d en retirer (mesure de la reserve n° 2 de P5).
+  vec2 rp = vLocal / max(uMerUnite, 1e-9) * ${CLAPOT_NORMALE.freq.toFixed(1)};
+  float r1 = bruitMer(rp + vec2(uMerTemps * 0.9, 0.0));
+  float r2 = bruitMer(rp * 1.9 - vec2(0.0, uMerTemps * 1.2));
+  vec3 N = clapotNormale(normalize(vNormMer), uMerDetail, uMerCalmeVue, r1, r2);
+  // ══════ LE SOLEIL DU BLOC, PAS CELUI DE LA PLANETE — Tache P6 ════════════
+  // uSunDir suit la CAMERA (main.js le repose par image sur camGlobe.position
+  // tournee de 42°). Releve le 2026-08-22 : il pointait SOUS l horizon
+  // (y = -0,3687) pendant que le soleil de la scene etait a +0,5629. Le glint de
+  // la mer du crop ne venait donc pas du soleil. uSoleilDir est le meme soleil
+  // que celui des tuiles depuis P3 — pas un second, LE meme uniforme.
+  vec3 L = normalize(uEclairageOn > 0.5 ? uSoleilDir : uSunDir);
   float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);
+  // ⚠️ APRES fres, COMME DANS ocean.js : le plancher de Fresnel en fait partie.
+  float opac = opaciteEau(dLagon, uMerTransp, fres);
   col = mix(col, uSky, fres * 0.35);
   vec3 H = normalize(L + V);
-  col += uSunColor * pow(max(dot(N, H), 0.0), uMerBrillance) * (0.5 + 1.6 * fres) * vRichesse;
+  // ⚠️ uMerSoleilFx : la tirette « soleil sur l eau » du socle, jamais branchee.
+  col += uSunColor * pow(max(dot(N, H), 0.0), uMerBrillance) * (0.5 + 1.6 * fres) * uMerSoleilFx * vRichesse;
 
   // ══════ L'ÉCUME — ET ELLE NE COÛTE RIEN AU-DELÀ DE LA BANDE ═══════════════
   if (vRichesse > 0.0) {
     // ⚠️ EN ESPACE DE SPECTRE, COMME DANS ocean.js — « le bruit d ecume vit en
     // espace spectre (xz / uLenScale), il suit donc la taille des vagues a tous
     // les zooms : fini les mouchetures pixel des vues larges ». La premiere
     // version l indexait sur vCrop x 90, c est-a-dire sur la PORTEE de la
     // calotte : la taille des mouchetures changeait avec l emprise.
     vec2 sm = vLocal / max(uMerLambda, 1e-9);
     float n1 = bruitMer(sm * 0.55 + vec2(uMerTemps * 0.25, -uMerTemps * 0.18));
@@ -439,25 +508,28 @@ void main() {
     // cellule de tavelure faisait 28,4 % de la largeur du bloc contre 5,41 %
     // sur le socle. CINQ FOIS UN QUART trop large — ce sont LES PLAQUES.
     float tavelure = tavelureMer(bruitMer(vLocal / max(uMerUnite, 1e-9) * ${FREQ_TAVELURE} + vec2(uMerTemps * 0.015, -uMerTemps * 0.011)));
     // ⚠️ LA MEME FONCTION QUE LE SOCLE, INJECTEE ET NON RECOPIEE. vRichesse
     // reste en facteur : c est l echelle d ECHANTILLONNAGE de la calotte (elle
     // atteint zero et fait sortir le vertex), la ou uMerCalmeVue/Surf sont les
     // deux echelles de LOOK d ocean.js. Deux echelles, deux roles, toutes deux
     // presentes — c est exactement ce qui manquait.
     float ecume = clamp(ecumeMer(vCrete, vFonduRive, n1, n2, tavelure, uMerTemps,
       uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf) * vRichesse, 0.0, 1.0);
-    col = mix(col, vec3(${BLANC_ECUME.toFixed(2)}), ecume);
-    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)), ecume * 0.85));
+    // ⚠️ blanchirEcume PORTE LA NUIT — Tache P6. La ligne d avant ecrivait
+    // vec3(0.96) NU : l ecume du crop restait blanche a minuit quand celle du
+    // socle tombe a 0,14 de sa valeur.
+    col = blanchirEcume(col, ecume, uMerJour);
+    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * opac, ecume * 0.85));
     return;
   }
-  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)));
+  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeur) * opac);
 }
 `
 
 // La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
 // `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
 // fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
 // IMPORTÉE, pas recopiée : une constante dupliquée diverge en silence (§1 de
 // /threejs-optimisation, question 2).
 const CIRCONFERENCE_MERCATOR = CIRCONFERENCE_M
 
@@ -2449,20 +2521,34 @@ export class Globe {
   // l'appelle, `uCropOn` vaut 0 et le globe est celui d'avant, au bit près —
   // c'est ce que vérifie `test/crop-sphere.test.js`.
 
   /**
    * Pose le crop : les tuiles cesseront d'être dessinées hors de sa forme.
    *
    * ⚠️ **LE REPÈRE VIENT DE `crop-sphere.js`, QUI LIT `empriseSocle`.** Le globe
    * ne calcule pas l'emprise : il l'applique. Deux producteurs d'emprise, c'est
    * un socle et une découpe qui divergent d'un pixel puis d'un mètre.
    *
+   * ⛔ **`half`, `corner` ET `expo` N'ONT ÉTÉ PASSÉS PAR PERSONNE DE LA TÂCHE A
+   * À LA TÂCHE P6.** Le crop a donc vécu dix tâches sur `corner = 0`, `expo = 2`
+   * — **un carré à angles vifs** — pendant que le socle vivait sur
+   * `params.slabCorner = 0,04` (un rayon de 8 % du demi-côté) et
+   * `params.slabCornerSmoothing = 0,6` (un squircle d'exposant 4,4). Relevé le
+   * 2026-08-22 au même instant dans la même page : `uCropCoin = 0`,
+   * `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`,
+   * `uSlabHalf = 28`. La Tâche P4 l'avait même ÉCRIT en passant — « relevé sur
+   * la page vivante : `uCropCoin` vaut ZERO » — sans y voir un branchement
+   * absent.
+   *
+   * ⚠️ **LES DÉFAUTS RESTENT CEUX D'AVANT** : un appelant muet (test, banc,
+   * globe de papier) obtient le carré vif, au bit près.
+   *
    * @param {{centre:{lat:number,lon:number}, zoom?:number, tuilesParBloc?:number,
    *          half?:number, corner?:number, expo?:number}} arg
    */
   poserCrop({ centre, zoom, tuilesParBloc, half = 28, corner = 0, expo = 2 } = {}) {
     const rep = repereCrop({ centre, zoom, tuilesParBloc })
     // ⚠️ **UN DÉMÉNAGEMENT EFFACE LES ANCRES, UN CRAN DE ZOOM NON — Tâche K
     // bis.** Les ancres de l'échelle continue disent « à ce lieu, à ce cran
     // d'altitude, le relief vaut ceci » : les garder après un saut à l'autre
     // bout du monde peindrait la Corse avec l'amplitude de l'Himalaya. Mais les
     // EFFACER à chaque cran de zoom rouvrirait exactement le défaut que la
@@ -3394,23 +3480,35 @@ export class Globe {
   async poserMer({
     remplir = null,
     portee = null,
     couvertureMin = 0,
     exigerBathy = false,
     pas = 192,
     hauteurPx = 900,
     fovDeg = FOV_DEG,
     largeurBande = 4,
     altitudeM = 32274,
-    couleurs = null,
-    graine = 0,
   } = {}) {
+    // ⛔ **`couleurs` ET `graine` NE SONT PLUS DES PARAMÈTRES — Tâche P6, ET
+    // C'EST LE MÊME GESTE QUE P5 SUR LES QUATRE PRÉCÉDENTS.** Ils l'étaient
+    // depuis la Tâche F, et **aucun appelant ne les a jamais passés** : la lame
+    // d'eau du crop vivait sur `couleursEau({})` — donc sur
+    // `params.lakeColor ?? '#8fc6e8'`, le DÉFAUT — et son spectre sur un tirage
+    // au hasard, pendant que le socle vit sur sa palette et sur
+    // `params.seaSeed`. ⚡ **Et la coïncidence a failli les cacher** : au relevé
+    // du 2026-08-22 les deux couleurs étaient IDENTIQUES au caractère près,
+    // parce que `params.lakeColor` valait justement le défaut du module. C'est
+    // le témoin (lakeColor posé à `#c81e1e` dans la page vivante) qui a montré
+    // que la calotte ne bougeait pas. Les deux arrivent désormais par
+    // `majReglagesMer`, **par image, depuis les uniformes VIVANTS du socle** —
+    // et le spectre par RÉFÉRENCE, parce que `setSeed`/`reseed` le remplacent
+    // en cours de session sans rebâtir quoi que ce soit.
     // ⛔ **`couleursFond`, `houle`, `chop` ET `ecumeEchelle` NE SONT PLUS DES
     // PARAMÈTRES — Tâche P5.** Ils l'étaient depuis les Tâches F et M, et
     // **aucun appelant ne les a jamais passés** : le fond marin et l'état de mer
     // du crop vivaient donc sur les défauts de ce module pendant que le socle
     // vivait sur sa palette et sur les curseurs de l'utilisateur. Deux
     // écrivains pour une grandeur, dont un muet, c'est la faute que D13 §③
     // nomme ; la mer prend désormais ses six réglages et ses trois couleurs de
     // fond par `majReglagesMer`, **par image, depuis les uniformes VIVANTS du
     // socle** — le maillon que la Tâche P4 a posé pour les deux accalmies.
     // `ETAT_MER_NEUTRE` porte les valeurs d'avant, au bit près.
@@ -3506,37 +3604,68 @@ export class Globe {
     // ⚠️ **LA PREMIÈRE VERSION SERVAIT `maille` COMME ÉCHELLE DE HOULE**, ce qui
     // faisait des vagues de 8 à 16 km : la mer riche et la mer plate rendaient
     // EXACTEMENT la même image jusqu'à 12,7 km d'altitude.
     const echelleH = echelleHouleM(rep) * (R_GLOBE / EARTH_RADIUS_M)
     const maille = (2 * p * rep.demi * CIRCONFERENCE_MERCATOR * (R_GLOBE / EARTH_RADIUS_M)) / pas
     const lambda = maille
     const bascule = distanceBascule({ lambda, hauteurPx, fovDeg })
     const bande = bandeDegradation(bascule, largeurBande)
 
     const mod = await import('./ocean.js')
-    const cols = couleurs || mod.couleursEau({})
+    // ⚠️ **LE NEUTRE, ET IL EST BRANCHÉ DÈS LA PREMIÈRE IMAGE.** `couleursEau({})`
+    // rend le défaut du module (`params.lakeColor ?? '#8fc6e8'`) ; c'est ce que
+    // voit un crop SANS mer de socle à lire, et rien d'autre.
+    const cols = mod.couleursEau({})
     // ⚠️ LE SPECTRE, ET SANS LUI LA MER EST UNE NAPPE PLATE — MESURÉ. Le morceau
     // `GERSTNER_GLSL` déclare `uWaveA[16]` / `uWaveB[16]` et saute tout train
     // dont l'amplitude est nulle : à uniformes vides, `disp` et `nAcc` valent
     // zéro et la surface est un miroir. Le premier relevé de l'Étape 4 rendait
     // **zéro pixel de différence** entre la mer riche et la mer dégradée, à
     // toutes les distances, et c'est ce zéro trop propre qui l'a dénoncé.
-    const spectre = mod.seaStateToUniforms(mod.makeSeaState(graine || undefined))
+    // ⚠️ **UN TIRAGE NEUF, ET C'EST LE NEUTRE.** `majReglagesMer` remplace ces
+    // deux tableaux par CEUX DU SOCLE (par référence) dès la première image où
+    // il y a une mer de socle à lire — donc le tirage ne survit qu'aux crops
+    // sans socle (banc, test, mer coupée).
+    const spectre = mod.seaStateToUniforms(mod.makeSeaState())
     const u = this.uniforms
     const mat = new THREE.ShaderMaterial({
       transparent: true,
       depthWrite: false,
       side: THREE.FrontSide,
       uniforms: {
+        // ⚠️ **LES TROIS PREMIERS SONT PARTAGÉS AVEC LES TUILES — Tâche P6.**
+        // `uSunDir` reste le soleil de PLANÈTE (le repli quand il n'y a pas
+        // d'éclairage de bloc) ; `uSoleilDir` et `uEclairageOn` sont les MÊMES
+        // objets que ceux de `poserHabillage`, pas des copies : le soleil de la
+        // mer et celui du relief ne peuvent donc pas diverger, et une tirette
+        // d'heure les déplace ensemble sans reposer la mer.
         uSunDir: u.uSunDir,
+        uSoleilDir: u.uSoleilDir,
+        uEclairageOn: u.uEclairageOn,
+        // ⛔ **`0xffffff` CODÉ EN DUR CONTRE `#fff7e6` VIVANT.** Posé au NEUTRE
+        // ici et branché par `majReglagesMer` (`Ocean.update` recopie
+        // `sun.color` par image) — même famille que `uSky`, que P4 a trouvé
+        // codé en dur au même endroit du même objet.
         uSunColor: { value: new THREE.Color(0xffffff) },
         uSky: { value: new THREE.Color('#bcd8ea') },
+        // ══════ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ═════════════
+        //
+        // ⚠️ **AU NEUTRE D'`ocean.js` À LA NAISSANCE, BRANCHÉS PAR IMAGE.**
+        // `LAME_EAU_NEUTRE` porte les quatre `??` de `waterMaterial`, pas des
+        // nombres choisis ici — et l'en-tête d'`ecume-mer.js` dit pourquoi
+        // AUCUNE valeur ne pouvait reproduire le nuanceur d'avant : il portait
+        // le `mix(0,45 ; 0,95)` **sans** la tirette et le glacis de lagon **à
+        // plein régime**, deux choses qu'aucun `uTransp` ne rend ensemble.
+        uMerTransp: { value: LAME_EAU_NEUTRE.transparence },
+        uMerSoleilFx: { value: LAME_EAU_NEUTRE.soleilFx },
+        uMerJour: { value: LAME_EAU_NEUTRE.jour },
+        uMerDetail: { value: LAME_EAU_NEUTRE.detail },
         uMerTemps: { value: 0 },
         uMerHoule: { value: houle },
         uMerChop: { value: chop },
         uMerVitesse: { value: 1 },
         uMerLambda: { value: echelleH },
         uMerMaille: { value: maille },
         uMerPortee: { value: p },
         // ⚠️ **LA MÊME VALEUR QUE CELLE QUI A NORMALISÉ LE CANAL G** — elle sort
         // de `_cuireChampMer`, elle n'est pas recalculée ici (Tâche P4).
         uMerUnite: { value: champ.unite },
@@ -3953,25 +4082,35 @@ export class Globe {
    * **Six réglages** (`etatMerDuSocle`, `monde/ecume-mer.js`) et **trois
    * couleurs** (`couleursFondDuSocle`, `monde/mer-sphere.js`) — tous LUS sur les
    * uniformes vivants du socle, aucun redérivé.
    *
    * ⚠️ **LES TROIS COULEURS DE FOND VIVENT SUR `this.uniforms`, PAS SUR LA
    * MER** : elles peignent les TUILES (la rampe nautique du fragment), pas la
    * lame d'eau. Elles restent malgré tout derrière la garde `this._mer` :
    * `retirerMer` éteint `uMerRampeOn` et remet `RAMPE_NAUTIQUE`, donc sans mer
    * ces trois-là ne peignent rien et ne doivent pas bouger.
    *
+   * ⚠️ **ET DEPUIS LA TÂCHE P6, LA LAME D'EAU ELLE-MÊME PASSE PAR ICI** : ses
+   * quatre réglages (`uTransp`, `uSunFx`, `uDayLight`, `uDetail`), ses deux
+   * couleurs, la couleur du soleil et le SPECTRE de houle. Tous LUS sur les
+   * uniformes vivants du socle, aucun redérivé — et tous par image, parce que
+   * la tirette de transparence, celle d'heure et `reseed` changent SANS
+   * déplacer le crop.
+   *
    * @param {{vue:number, surface:number, givre?:number, ciel?:object,
    *   etat?:{houle:number,chop:number,ecume:number,ecumeEchelle:number,brillance:number,vitesse:number},
-   *   fond?:{peu:object,moyen:object,fond:object}}|null} [reglages]
-   * @returns {{vue:number, surface:number, givre:number, etat:object, fond:boolean}|null}
-   *   ce qui a été posé
+   *   fond?:{peu:object,moyen:object,fond:object},
+   *   eau?:{transparence:number,soleilFx:number,jour:number,detail:number},
+   *   couleurs?:{peu:object,fond:object}, soleilCouleur?:object,
+   *   spectre?:{a:Array,b:Array}}|null} [reglages]
+   * @returns {{vue:number, surface:number, givre:number, etat:object, fond:boolean,
+   *   eau:object, couleurs:boolean, spectre:boolean}|null} ce qui a été posé
    */
   majReglagesMer(reglages = null) {
     if (!this._mer) return null
     const ok = reglages && Number.isFinite(reglages.vue) && Number.isFinite(reglages.surface)
     const a = ok ? reglages : ACCALMIE_NEUTRE
     const u = this._mer.material.uniforms
     u.uMerCalmeVue.value = a.vue
     u.uMerCalmeSurf.value = a.surface
     const givre = Number.isFinite(reglages?.givre) ? reglages.givre : 0
     u.uMerGivre.value = givre
@@ -4000,21 +4139,92 @@ export class Globe {
     // ⚠️ **`copy`, PAS `set`** : ce sont les objets `Color` VIVANTS du socle, et
     // les recopier plutôt que les partager est délibéré. Partager l'objet
     // ferait qu'un `retirerMer` remettant `RAMPE_NAUTIQUE` REPEINDRAIT le socle.
     const f = reglages?.fond
     const fond = !!(f?.peu?.isColor && f?.moyen?.isColor && f?.fond?.isColor)
     if (fond) {
       this.uniforms.uOceanShallow.value.copy(f.peu)
       this.uniforms.uOceanMid.value.copy(f.moyen)
       this.uniforms.uOceanDeep.value.copy(f.fond)
     }
-    return { vue: a.vue, surface: a.surface, givre, etat, fond }
+
+    // ══════ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ═════════════════
+    //
+    // ⚠️ **TOUT OU RIEN, ET LE TOUT EST QUATRE** — même raisonnement que les six
+    // de l'état de mer juste au-dessus : une transparence du socle avec un
+    // clapot du module serait la mer de personne. `lameEauDuSocle` rend quatre
+    // nombres finis par construction, et sans socle à lire il rend
+    // `LAME_EAU_NEUTRE`, c'est-à-dire les `??` d'`ocean.js`.
+    const l = reglages?.eau
+    const eau = l && [l.transparence, l.soleilFx, l.jour, l.detail].every(Number.isFinite)
+      ? l
+      : LAME_EAU_NEUTRE
+    u.uMerTransp.value = eau.transparence
+    u.uMerSoleilFx.value = eau.soleilFx
+    u.uMerJour.value = eau.jour
+    u.uMerDetail.value = eau.detail
+
+    // ══════ LES DEUX COULEURS DE LA LAME — Tâche P6 ═════════════════════════
+    //
+    // ⚠️ **`copy`, PAS `set`, ET POUR LA MÊME RAISON QUE LES TROIS DU FOND** :
+    // ce sont les `Color` VIVANTS du socle, et partager l'objet ferait qu'un
+    // `retirerMer`… ne les touche pas — mais `_applySea` du socle, si, et deux
+    // matériaux qui partagent une couleur finissent par se la disputer.
+    const c = reglages?.couleurs
+    const couleurs = !!(c?.peu?.isColor && c?.fond?.isColor)
+    if (couleurs) {
+      u.uMerPeu.value.copy(c.peu)
+      u.uMerFond.value.copy(c.fond)
+    }
+    // ⚠️ **LA COULEUR DU SOLEIL, MÊME PATRON** : `#ffffff` était codé en dur
+    // dans `poserMer` contre `#fff7e6` vivant.
+    if (reglages?.soleilCouleur?.isColor) u.uSunColor.value.copy(reglages.soleilCouleur)
+
+    // ══════ LE SPECTRE DE HOULE — Tâche P6, PAR RÉFÉRENCE ═══════════════════
+    //
+    // ⛔ **LE CROP TIRAIT SA PROPRE MER AU HASARD.** `poserMer` faisait
+    // `makeSeaState(graine || undefined)` avec une `graine` que personne n'a
+    // jamais passée, pendant que le socle vit sur `makeSeaState(params.seaSeed)`
+    // — relevé le 2026-08-22 : `params.seaSeed = 9879`, et le premier train de
+    // houle valait `(0,230 · 0,973 · …)` côté crop contre `(0,659 · −0,753 · …)`
+    // côté socle. **Deux houles de directions différentes.**
+    //
+    // ⚠️ **PAR RÉFÉRENCE, ET C'EST CE QUE FAIT DÉJÀ `_applySea`** : lui aussi
+    // assigne `u.a` / `u.b` à TOUS ses matériaux sans les cloner. Un `graine`
+    // sur `poserMer` n'aurait pas suffi — `setSeed`/`reseed` remplacent les deux
+    // tableaux en cours de session sans rien rebâtir, et la calotte serait
+    // restée sur l'ancienne mer.
+    const sp = reglages?.spectre
+    const spectre = !!(Array.isArray(sp?.a) && Array.isArray(sp?.b) && sp.a.length && sp.b.length)
+    if (spectre) {
+      u.uWaveA.value = sp.a
+      u.uWaveB.value = sp.b
+    }
+
+    // ══════ L'ÉCHELLE DE LONGUEUR DE HOULE — Tâche P6, réserve n° 3 de P5 ═══
+    //
+    // ⛔ **`ECHELLE_HOULE_UNITES = 0,42` ÉTAIT ÉCRIT EN DUR** pendant que le
+    // socle vit sur `LEN_SCALE × clamp(waveScale)` — relevé à `0,231`. P5 avait
+    // mesuré l'écart (« le spectre du crop est 1,818 fois plus étiré ») et ne
+    // l'avait pas fermé « parce que les deux vivent dans des systèmes d'unités
+    // différents ». **Le système de conversion existe : c'est `uMerUnite`**, la
+    // même monnaie que la tavelure (P4) et que l'amplitude de houle.
+    //
+    // ⚠️ **CONVERTI ICI ET NULLE PART AILLEURS** : `ocean.js` remonte des unités
+    // de SOCLE, le crop est le seul à savoir ce que vaut une unité de socle chez
+    // lui. Sans échelle à lire, `poserMer` garde celle du module.
+    const es = reglages?.echelleSpectre
+    const unite = u.uMerUnite?.value
+    const echelleSpectre = Number.isFinite(es) && es > 0 && Number.isFinite(unite) && unite > 0
+    if (echelleSpectre) u.uMerLambda.value = es * unite
+
+    return { vue: a.vue, surface: a.surface, givre, etat, fond, eau, couleurs, spectre, echelleSpectre }
   }
 
   /** Retire la mer — le globe redevient une planète sans eau animée. */
   retirerMer() {
     // ⚠️ LA RAMPE NAUTIQUE S'ÉTEINT MÊME SANS MAILLAGE, et c'est le défaut C-3
     // de la Tâche C appliqué d'avance : là-bas `retirerHabillage` ne rendait
     // que quatre uniformes sur seize, et la planète entière gardait l'intervalle
     // de courbes du crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles :
     // le laisser allumé repeindrait tous les océans du monde.
     const u = this.uniforms
@@ -4105,41 +4315,52 @@ export class Globe {
   }
 
   /**
    * Bâtit les parois et la base du crop, et les pose dans le groupe du globe.
    *
    * ⚠️ **ELLE RECONSTRUIT TOUT, ET ELLE N'EST PAS FAITE POUR TOURNER PAR IMAGE.**
    * Décision 5 du plan précédent, toujours en vigueur : « la gravure ne s'écrit
    * qu'à l'arrêt ». L'appelant décide quand.
    *
    * @param {object} [arg]
-   * @param {number} [arg.profondeur] en unités de scène ; défaut : la proportion
-   *   du socle (7 sur 56), voir `FRACTION_PROFONDEUR`
+   * @param {number} [arg.profondeur] en unités de scène ; défaut :
+   *   `fractionProfondeur × largeur`
+   * @param {number} [arg.fractionProfondeur] la profondeur EN FRACTION de la
+   *   largeur. ⛔ **Tâche P6 : `FRACTION_PROFONDEUR = 7 / 56` était GELÉE.** Sept
+   *   et cinquante-six sont `params.plinthDepth` et `TERRAIN_SIZE` **à leur
+   *   valeur d'usine** ; la tirette « profondeur du socle » creuse le bloc plat
+   *   et ne touchait pas le bloc du crop. Relevé le 2026-08-22 :
+   *   `plinth.depth = 7` — donc **concordant par coïncidence**, exactement comme
+   *   les deux couleurs de la lame d'eau.
    * @param {number} [arg.baseYFloor] fond imposé, jamais plus haut
    * @returns {{mesh: object, couverture: number, solide: object}|null}
    */
-  construireParoisCrop({ profondeur = null, baseYFloor = null, couvertureMin = 1 } = {}) {
+  construireParoisCrop({ profondeur = null, fractionProfondeur = undefined, baseYFloor = null, couvertureMin = 1 } = {}) {
     if (!this._crop) return null
     // ⚠️ LA LISTE EST PRÉ-FILTRÉE UNE FOIS : l'anneau fait plus de mille points,
     // et reparcourir `this.tiles` (jusqu'à 1 700 entrées) à chacun ferait deux
     // millions d'itérations pour une géométrie qu'on ne bâtit qu'à l'arrêt.
     const liste = this.tuilesAvecHauteurs()
     // ⚠️ **ON PASSE `hauteurSurface` TELLE QUELLE, `null` COMPRIS.** L'ancienne
     // version rattrapait le `null` en `0` — le niveau de la mer — et fabriquait
     // une encoche muette. La décision et son motif sont au §7 de `parois-crop.js`.
     const solide = construireSolideCrop({
       couvertureMin,
       repere: this._crop,
       forme: {
         coin: this.uniforms.uCropCoin.value,
         expo: this.uniforms.uCropCoinN.value,
       },
+      // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE, ET C'EST VOULU** : une
+      // valeur écrite ici en serait une seconde, et deux défauts jumeaux
+      // divergent (le `uContourInterval` de la Tâche C, réparé au tour 1).
+      fractionProfondeur,
       hauteur: (lat, lon) => this.hauteurSurface(lat, lon, liste),
       rayon: R_GLOBE,
       echelle: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration,
       profondeur,
       baseYFloor,
       // ⚠️ **LE PLANCHER SUIT LA SURFACE — Tâche J bis, ET SANS LUI LE BLOC EST
       // FAUX.** Le §4 de `parois-crop.js` écrit pourquoi il valait zéro : « le
       // globe pose ses sommets à `Math.max(sampleHeights(...), 0)`, une paroi
       // qui suivrait la bathymétrie brute passerait SOUS la surface dessinée ».
       // C'est exactement l'inverse depuis qu'un fond est posé : c'est un
@@ -4244,42 +4465,87 @@ export class Globe {
     return new THREE.ShaderMaterial({
       side: THREE.DoubleSide,
       uniforms: {
         uSunDir: this.uniforms.uSunDir,
         uShadowColor: this.uniforms.uShadowColor,
         // ⚠️ **PARTAGÉ, PAS PROPRE AU MATÉRIAU — Tâche P3.** Il valait
         // `new THREE.Color('#d8d4cc')`, le DÉFAUT de `params.plinthColor`,
         // pendant que la paroi vivante du socle rendait `c06a44`. Le pourquoi
         // du partage est écrit à la déclaration de `uParoiCouleur`.
         uCol: this.uniforms.uParoiCouleur,
+        // ══════ LES CINQ DE L'ÉCLAIRAGE — Tâche P6 ═══════════════════════════
+        //
+        // ⛔ **P3 A ÉCLAIRÉ LES TUILES ET A LAISSÉ LES PAROIS SUR LE SOLEIL DE
+        // LA PLANÈTE, C'EST-À-DIRE SUR LA CAMÉRA.** Elle l'écrit noir sur blanc
+        // pour les tuiles — *« uSunDir n'est pas le soleil de la scène : en mode
+        // surface, main.js le repose À CHAQUE IMAGE sur camGlobe.position
+        // tournée de 42 degrés »* — et n'a pas refait le geste ici. Les parois
+        // gardaient donc `0,74 + 0,30 × diff` **contre une direction de caméra**,
+        // PLUS le terminateur jour/nuit de la planète.
+        //
+        // ⚡ **ET C'EST LE GRAND APLAT BEIGE DE LA RÉSERVE N° 1 DE P5.** Relevé
+        // le 2026-08-22, La Réunion, au même instant dans la même page :
+        // `uSunDir = (0,2305 · −0,3687 · 0,9005)` — **sous l'horizon** — pendant
+        // que le soleil de la scène pointait `(0,4392 · 0,5629 · −0,7001)`, et
+        // `uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil
+        // laisse à `day ≈ 0` rend donc **exactement `uShadowColor`** : c'est un
+        // aplat de la couleur du fond, pas une paroi éclairée.
+        //
+        // ⚠️ **ET LE TERMINATEUR N'A RIEN À FAIRE SUR UN BLOC** — P3 le dit déjà
+        // pour les tuiles : *« Le socle n'a pas de nuit : il est un objet de
+        // studio, éclairé par trois sources. »* La paroi du socle est un
+        // `MeshPhysicalMaterial` rugosité 0,95, métal 0, occlusion par sommet :
+        // un diffus pur. `irradianceCrop` est cette loi-là, et c'est la MÊME
+        // fonction, les MÊMES uniformes que les tuiles — pas une seconde.
+        uSoleilDir: this.uniforms.uSoleilDir,
+        uHemiHaut: this.uniforms.uHemiHaut,
+        uSoleilIrr: this.uniforms.uSoleilIrr,
+        uCielIrr: this.uniforms.uCielIrr,
+        uSolIrr: this.uniforms.uSolIrr,
+        uEclairageOn: this.uniforms.uEclairageOn,
       },
       vertexShader: /* glsl */ `
         attribute vec3 aoCrop;
         varying vec3 vN;
         varying float vAo;
         void main() {
           vN = normalize(mat3(modelMatrix) * normal);
           vAo = aoCrop.r;
           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
         }`,
       fragmentShader: /* glsl */ `
         varying vec3 vN;
         varying float vAo;
         uniform vec3 uSunDir;
         uniform vec3 uShadowColor;
         uniform vec3 uCol;
+        uniform vec3 uSoleilDir;
+        uniform vec3 uHemiHaut;
+        uniform vec3 uSoleilIrr;
+        uniform vec3 uCielIrr;
+        uniform vec3 uSolIrr;
+        uniform float uEclairageOn;
+        ${GLSL_IRRADIANCE}
         void main() {
           vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
+          // ⚠️ SANS ECLAIRAGE, LA LOI DE PLANETE — AU BIT PRES. C'est le repli
+          // exact d'avant P6, et c'est ce que rend un globe sans crop pose.
           float diff = max(dot(N, uSunDir), 0.0);
-          vec3 col = uCol * (0.74 + 0.30 * diff) * vAo;
+          vec3 colPlanete = uCol * (0.74 + 0.30 * diff) * vAo;
           float day = smoothstep(-0.22, 0.16, dot(N, uSunDir));
-          gl_FragColor = vec4(mix(uShadowColor, col, 0.10 + 0.90 * day), 1.0);
+          colPlanete = mix(uShadowColor, colPlanete, 0.10 + 0.90 * day);
+          // L ALBEDO DE LA PAROI : sa couleur x son occlusion de contact, tout
+          // comme le socle multiplie material.color par son attribut color.
+          vec3 colBloc = uCol * vAo
+            * irradianceCrop(dot(N, uSoleilDir), dot(N, uHemiHaut), uSoleilIrr, uCielIrr, uSolIrr)
+            * ${RECIPROQUE_PI};
+          gl_FragColor = vec4(uEclairageOn > 0.5 ? colBloc : colPlanete, 1.0);
         }`,
     })
   }
 
   /**
    * Le mélange des tuiles suit le crop — Tâche B, Étape 5.
    *
    * ⚠️ **IL FAUT LE POSER SUR LES MATÉRIAUX DÉJÀ CRÉÉS**, pas seulement dans
    * `_materialFor` : le globe porte jusqu'à 1 700 tuiles quand `poserCrop`
    * arrive, et chacune a le sien (`uTex` et `uTilePx` sont propres à la tuile).
diff --git a/src/main.js b/src/main.js
index b078761..b7260fb 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4921,20 +4921,69 @@ function contexteCrop() {
   // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
   const f = terrain.fenetreBornee
   const amplitudeM = Number.isFinite(f?.maxM) && Number.isFinite(f?.minM)
     ? f.maxM - f.minM
     : (Number.isFinite(dem?.maxM) && Number.isFinite(dem?.minM) ? dem.maxM - dem.minM : null)
 
   const ctx = {
     centre,
     zoom,
     tuilesParBloc: BLOCK_TILES,
+    // ══════════ LA FORME DU BLOC — Tâche P6 ═══════════════════════════════════
+    //
+    // ⛔ **`poserCrop` PORTE `half`, `corner` ET `expo` DEPUIS LA TÂCHE A ET
+    // PERSONNE NE LES A JAMAIS PASSÉS.** Le bloc du crop était donc un CARRÉ À
+    // ANGLES VIFS pendant que celui du socle est un squircle : relevé le
+    // 2026-08-22 au même instant dans la même page, `uCropCoin = 0` et
+    // `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`,
+    // `uSlabHalf = 28`. **C'est la silhouette du bloc, et elle se voit sur les
+    // quatre coins.** La Tâche P4 avait même relevé le zéro en passant, sans y
+    // voir un branchement absent.
+    //
+    // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params` — MÊME RÈGLE QUE POUR
+    // LES DIX CURSEURS D'ATLAS ET POUR LES LAMPES.** `terrain.js` porte deux
+    // règles que `params` ne porte pas : l'écrêtage du rayon
+    // (`min(TERRAIN_SIZE/2 − 0,05, max(0,05, slabCorner × TERRAIN_SIZE))`, donc
+    // un plancher NON NUL même à tirette zéro) et `exposantCoin`, qui traduit la
+    // douceur en exposant de superellipse. Passer par `params` aurait redérivé
+    // les deux.
+    //
+    // ⚠️ **ET `uSlabHalf` VIVANT, PAS 28 EN DUR** : c'est lui qui NORMALISE le
+    // rayon, et la fenêtre continue le déplace. C'est déjà l'argument que
+    // `fxDemiBloc` porte quelques lignes plus bas.
+    forme: {
+      half: terrain.mapUniforms.uSlabHalf?.value ?? 28,
+      corner: terrain.mapUniforms.uSlabCorner?.value ?? 0,
+      expo: terrain.mapUniforms.uSlabCornerN?.value ?? 2,
+    },
+    // ══════════ LA PROFONDEUR DU BLOC — Tâche P6 ══════════════════════════════
+    //
+    // ⛔ **`construireParoisCrop` PORTE `profondeur` DEPUIS LA TÂCHE B, ET
+    // PERSONNE NE L'A JAMAIS PASSÉE.** Le crop vivait donc sur
+    // `FRACTION_PROFONDEUR = 7 / 56`, c'est-à-dire `params.plinthDepth` et
+    // `TERRAIN_SIZE` **à leur valeur d'usine**. Relevé le 2026-08-22 :
+    // `plinth.depth = 7` — donc **concordant par coïncidence**, exactement comme
+    // les deux couleurs de la lame d'eau. La tirette « profondeur » creusait le
+    // bloc plat et laissait celui du crop où il était.
+    //
+    // ⚠️ **`plinth.depth`, PAS `params.plinthDepth`** : c'est `rebuild` qui
+    // écrit `this.depth = params.plinthDepth ?? this.depth`, donc le MATÉRIEL
+    // qui dit la vérité — la règle de `plinth.wallMat.color` (manque n° 2 du
+    // noteur), appliquée à la géométrie.
+    //
+    // ⚠️ **EN FRACTION DE LA LARGEUR, PAS EN UNITÉS** : le §4 de
+    // `parois-crop.js` l'écrit — « recopier 7 dans un crop qui fait 0,163 unité
+    // de large aurait donné un puits de quarante fois sa largeur ». Le
+    // dénominateur est la LARGEUR du socle, donc `2 × uSlabHalf`.
+    parois: {
+      fractionProfondeur: plinth.depth / (2 * (terrain.mapUniforms.uSlabHalf?.value || 28)),
+    },
     habillage: {
       coastMask: cote,
       sol,
       solLut: sol ? terrain.mapUniforms.uSolLut.value : null,
       solOpacite: terrain.mapUniforms.uSolOpacite.value,
       solOffset: terrain.mapUniforms.uSolOffset.value,
       solScale: terrain.mapUniforms.uSolScale.value,
       solTexel: terrain.mapUniforms.uSolTexel.value,
       amplitudeM: amplitudeM > 0 ? amplitudeM : null,
       contourOpacity: terrain.mapUniforms.uContourOpacity.value,
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index 36d65a6..6451276 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -324,25 +324,82 @@ export function habillageDifferent(pose, voulu) {
 // geste — mot pour mot l'argument que `majSeuilSocle` écrit déjà pour `maj`.
 
 /** L'instantané qu'on garde pour la comparaison — les champs surveillés, seuls. */
 function instantaneHabillage(habillage) {
   const src = habillage || {}
   const out = {}
   for (const champ of CHAMPS_HABILLAGE) out[champ] = src[champ]
   return out
 }
 
+/**
+ * Les champs de la FORME du bloc — Tâche P6.
+ *
+ * ⚠️ **`half` EN EST, ET CE N'EST PAS DÉCORATIF** : c'est lui qui normalise
+ * `corner`, donc deux valeurs de `half` pour un même `corner` sont deux
+ * silhouettes. La fenêtre continue le déplace (`uSlabHalf` vaut 28 hors damier,
+ * autre chose dedans) — c'est déjà la raison pour laquelle `fxDemiBloc` figure
+ * dans `CHAMPS_HABILLAGE`.
+ */
+export const CHAMPS_FORME = Object.freeze(['half', 'corner', 'expo', 'fractionProfondeur'])
+
+/**
+ * La forme du bloc, aplatie depuis le contexte — Tâche P6.
+ *
+ * ⚠️ **ELLE VIT DANS DEUX SOUS-OBJETS ET C'EST UNE SEULE GRANDEUR** : `half`,
+ * `corner` et `expo` vont à `poserCrop` (la silhouette vue de dessus),
+ * `fractionProfondeur` va à `construireParoisCrop` (l'épaisseur). Les surveiller
+ * séparément ferait deux veilles pour un seul geste — et un bloc dont le contour
+ * s'arrondit sans que son flanc suive.
+ */
+export function formeDuCrop(ctx) {
+  const f = ctx?.forme || {}
+  const p = ctx?.parois || {}
+  return { half: f.half, corner: f.corner, expo: f.expo, fractionProfondeur: p.fractionProfondeur }
+}
+
+/**
+ * La forme à poser diffère-t-elle de celle qui est posée ?
+ *
+ * ⚠️ **MÊME CONTRAT QU'`habillageDifferent`, `Object.is` COMPRIS**, et pour la
+ * même raison : un `NaN` d'arrondi ne doit pas se comparer égal à lui-même.
+ */
+export function formeDifferente(pose, voulu) {
+  if (!pose) return true
+  const v = voulu || {}
+  for (const champ of CHAMPS_FORME) {
+    if (!Object.is(pose[champ], v[champ])) return true
+  }
+  return false
+}
+
 // Un maillon rend `{ refus }` — `null` s'il a pris, une chaîne sinon — et,
 // pour la mer seule, une `promesse` dont le refus n'arrive que plus tard.
 const POSEURS = {
-  crop({ globe, centre, zoom, tuilesParBloc }) {
-    const rep = globe.poserCrop({ centre, zoom, tuilesParBloc })
+  // ══════════ LA FORME DU BLOC — Tâche P6 ═══════════════════════════════════
+  //
+  // ⛔ **`poserCrop` PORTE `corner`, `expo` ET `half` DEPUIS LA TÂCHE A, ET
+  // AUCUN APPELANT NE LES A JAMAIS PASSÉS.** Le crop tournait donc sur
+  // `corner = 0`, `expo = 2` — un carré à angles VIFS — pendant que le socle vit
+  // sur `params.slabCorner = 0,04` et `params.slabCornerSmoothing = 0,6`,
+  // c'est-à-dire un rayon d'arrondi de **8 % du demi-côté** et un exposant de
+  // squircle de **4,4**. Relevé le 2026-08-22 au même instant dans la même page :
+  // `uCropCoin = 0` et `uCropCoinN = 2` contre `uSlabCorner = 2,24`,
+  // `uSlabCornerN = 4,4`, `uSlabHalf = 28`. **C'est la SILHOUETTE du bloc**, et
+  // `parois-crop.js` §4 le dit déjà : `cornerR` s'y traduit par `forme.coin`,
+  // « le rayon NORMALISÉ que `poserCrop` pose déjà ».
+  //
+  // ⚠️ **LE COIN ARRIVE EN UNITÉS DU SOCLE ET SE NORMALISE DANS `poserCrop`** —
+  // par `coinNormalise(corner, half)`, la SEULE conversion, celle qui existait
+  // déjà. Une normalisation faite ici en serait une seconde.
+  crop({ globe, centre, zoom, tuilesParBloc, forme }) {
+    const rep = globe.poserCrop({ centre, zoom, tuilesParBloc, ...(forme || {}) })
     return { refus: rep ? null : 'crop' }
   },
   fond({ globe, fond }) {
     // ⚠️ **UN GLOBE SANS `poserFondCrop` N'EST PAS UNE PANNE.** Ce module est
     // vérifiable sous node contre un globe de papier (`test/crop-branche.test.js`), et
     // il a toujours accepté les faux globes qui portent les méthodes qu'ils
     // exercent. Un fond absent laisse la surface du dépôt — c'est exactement le
     // comportement d'avant la Tâche J bis, et il ne se signale pas par un refus
     // qui bloquerait la reprise pour toujours.
     if (typeof globe.poserFondCrop !== 'function') return { refus: null }
@@ -481,20 +538,27 @@ export function creerVeilleCrop({
 
   let pose = !!cropAuDepart
   let modeSurface = !!modeSurfaceAuDepart
   let signature = null
   let refus = []
   let bascules = 0
   let depuisPose = 0
   // ⚠️ **CE QU'ON A POSÉ, PAS CE QU'ON A VU** — voir `habillageDifferent`.
   let habillagePose = null
   let rafraichissements = 0
+  // ⚠️ **LA FORME, SURVEILLÉE À PART — Tâche P6.** Elle n'est PAS dans la
+  // signature de lieu, et c'est une décision de coût : `signature` déclenche
+  // `poserTout`, donc un champ de mer de 385² et un balayage de rampe de 128², à
+  // CHAQUE image d'un glissement de la tirette d'arrondi. Ici on ne rejoue que
+  // les DEUX maillons qui lisent la forme.
+  let formePosee = null
+  let reformages = 0
   // ⚠️ **LES PROMESSES EN VOL SONT GARDÉES**, et pas par confort : sans elles un
   // test ne peut pas attendre le refus de la mer, et rien ne l'obligerait à
   // exister. C'est aussi ce qui permet à `retirerCrop` de ne pas se faire
   // écraser par une mer partie avant lui.
   let enVol = Promise.resolve()
   let jeton = 0
   // ⚠️ **UNE FOIS PAR ENTRÉE EN SURFACE, ET LE « UNE FOIS » COMPTE.** La liste
   // de calques que `masquerSocle` rappelle en touche quatorze : la repasser à
   // chaque image serait exactement ce que la garde de `creerVeilleSocle` évite.
   let socleMasque = false
@@ -556,35 +620,67 @@ export function creerVeilleCrop({
     // ⚠️ **AVANT LA CHAÎNE, PAS APRÈS.** `_buildMesh` relâche les hauteurs des
     // tuiles NON réservées : une tuile bâtie avant la réservation les a déjà
     // perdues, et `demanderEmprise` doit la redemander. L'ordre n'est pas
     // cosmétique — c'est celui que `flux-terrain.js` écrit déjà pour le socle.
     reserverHauteurs?.(ctx)
     jeton++
     const r = poserChaineCrop({ globe: g, ...ctx })
     refus = r.refus
     depuisPose = 0
     habillagePose = instantaneHabillage(ctx.habillage)
+    formePosee = formeDuCrop(ctx)
     suivreMer(r.mer, jeton)
   }
 
   /**
    * ⚠️ **LE SEUL MAILLON QU'ON SURVEILLE PAR IMAGE, ET IL NE COÛTE QUE DES
    * UNIFORMES.** Voir le pavé « LE RAFRAÎCHISSEMENT DE L'HABILLAGE ».
    */
   function rafraichirHabillage(g, ctx) {
     if (!habillageDifferent(habillagePose, ctx.habillage)) return false
     POSEURS.habillage({ globe: g, ...ctx })
     habillagePose = instantaneHabillage(ctx.habillage)
     rafraichissements++
     return true
   }
 
+  /**
+   * LA FORME DU BLOC, SURVEILLÉE PAR IMAGE — Tâche P6.
+   *
+   * ⚠️ **DEUX MAILLONS, PAS SIX, ET LE CHOIX EST CHIFFRÉ.** Les tirettes
+   * « arrondi » et « douceur des coins » du socle rebâtissent SES parois à
+   * chaque image de glissement ; ici, rejouer la chaîne entière coûterait EN
+   * PLUS un champ de mer de 385² et un balayage de rampe de 128² par image.
+   *
+   * ⚠️ **ET LA MER SUIT SANS ÊTRE REJOUÉE** : son matériau partage `uCropCoin`
+   * et `uCropCoinN` avec les tuiles (`poserMer` les prend sur `this.uniforms`),
+   * donc `poserCrop` seul déplace aussi le bord de la nappe. C'est la mécanique
+   * d'uniformes partagés que la Tâche A a posée, pas un heureux hasard.
+   *
+   * ⚠️ **LA RAMPE, ELLE, N'EST PAS REJOUÉE, ET JE LE DIS** : `mesurerRelief`
+   * échantillonne la superellipse, donc son amplitude bouge d'un cheveu quand
+   * l'arrondi change. Elle se remesure au prochain déplacement. Un balayage de
+   * `pas²` points par image de glissement n'en vaut pas le prix.
+   */
+  function rafraichirForme(g, ctx) {
+    if (!formeDifferente(formePosee, formeDuCrop(ctx))) return false
+    const r = POSEURS.crop({ globe: g, ...ctx })
+    // ⚠️ **ET LES PAROIS AVEC, SINON LE BLOC EST À DEUX FORMES** : la surface
+    // serait arrondie et son flanc resterait carré — pire que les deux carrés.
+    const p = POSEURS.parois({ globe: g, ...ctx })
+    formePosee = formeDuCrop(ctx)
+    reformages++
+    // un refus des parois retourne dans la file de reprise, comme partout
+    if (p.refus && !refus.includes('parois')) refus.push('parois')
+    return !r.refus
+  }
+
   // ⚠️ **ELLE NE REJOUE QUE CE QUI A REFUSÉ, ET JAMAIS LA DÉCOUPE.** Rejouer la
   // chaîne entière pour rattraper une paroi coûterait le champ de mer (385²) et
   // le balayage de rampe (128²) à chaque tentative.
   function reprendre(g, ctx) {
     depuisPose = 0
     reserverHauteurs?.(ctx)
     // ⚠️ **IL Y AVAIT ICI UNE GARDE `if (nom === 'crop') continue`, ET C'ÉTAIT DU
     // CODE MORT — TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** La
     // muter ne faisait rougir aucun test, et pour cause : `refus` ne peut PAS
     // contenir `'crop'`. `poserCrop` rend toujours son repère, et les trois
@@ -679,20 +775,24 @@ export function creerVeilleCrop({
         signature = s
         poserTout(g, ctx)
         return true
       }
       depuisPose++
       if (refus.length && depuisPose >= periodeReprise) reprendre(g, ctx)
       // ⚠️ **APRÈS LA REPRISE, ET PAS AVANT.** La reprise peut reposer
       // l'habillage elle-même (s'il figurait dans les refus, ce qui n'arrive
       // pas aujourd'hui mais reste ouvert) ; le rafraîchissement doit juger sur
       // l'état FINAL de l'image, sinon il reposerait deux fois.
+      // ⚠️ **LA FORME AVANT L'HABILLAGE, ET L'ORDRE COMPTE** : `poserHabillage`
+      // dérive sa marge de côte du crop POSÉ (`margeCoteDuCrop(this._crop)`).
+      // L'inverse la calculerait sur le repère d'avant le reformage.
+      rafraichirForme(g, ctx)
       rafraichirHabillage(g, ctx)
       return true
   }
 
   return {
     /**
      * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
      * au-dessus de l'ellipsoïde — règle R1, celle que `loi-altitude.js` porte
      * SANS `meanM`. Une altitude non finie conserve l'état, même contrat que
      * `socleVisible`.
@@ -735,16 +835,18 @@ export function creerVeilleCrop({
     /** Le repos est-il RELAYÉ (donc : crop posé, en surface) — Tâche N. */
     get repos() { return reposApplique },
     /** Combien de fois le repos relayé a basculé : le compteur de battement. */
     get basculesRepos() { return basculesRepos },
     /** Les maillons qui ont refusé et que la reprise redemande. */
     get refus() { return [...refus] },
     /** Combien de fois le crop est né ou mort depuis le chargement. */
     get bascules() { return bascules },
     /** Combien de fois l'habillage a été RAFRAÎCHI hors pose — Tâche K ter. */
     get rafraichissements() { return rafraichissements },
+    /** Combien de fois la FORME a été rejouée hors pose — Tâche P6. */
+    get reformages() { return reformages },
     /** Le lieu sur lequel la chaîne est posée — pour les sondes et les bancs. */
     get signature() { return signature },
     /** La dernière mer partie, pour qui doit l'attendre (les tests, les bancs). */
     enVol() { return enVol },
   }
 }
diff --git a/src/monde/eclairage-crop.js b/src/monde/eclairage-crop.js
index ecade60..4c48264 100644
--- a/src/monde/eclairage-crop.js
+++ b/src/monde/eclairage-crop.js
@@ -329,33 +329,47 @@ export function irradianceAmbiante(coef, envIntensite) {
     sol: [c.sol[0] * k, c.sol[1] * k, c.sol[2] * k],
   }
 }
 
 export const GLSL_OMBRE_PEINTURE = /* glsl */ `
 float natOmbrePeinture(float lum) {
   return clamp(lum * ${OMBRE_GAIN}, ${OMBRE_MIN}, ${OMBRE_MAX});
 }
 `
 
+/**
+ * L'IRRADIANCE SEULE, détachable — Tâche P6.
+ *
+ * ⚠️ **PARCE QUE LES PAROIS N'ONT NI RAMPE NI PEINTURE, DONC PAS
+ * `natLuminance`.** `GLSL_ECLAIRAGE` ci-dessous en dépend (`GLSL_NATUREL` est
+ * injecté avant lui dans le nuanceur des tuiles) ; celui des parois est un
+ * `ShaderMaterial` NU qui n'a aucune des deux. Extraire ce seul morceau leur
+ * donne **LA MÊME LOI, PAS UNE SECONDE** — et `GLSL_ECLAIRAGE` l'INTERPOLE au
+ * lieu de la réécrire, donc il n'y a toujours qu'une écriture.
+ */
+export const GLSL_IRRADIANCE = /* glsl */ `
+vec3 irradianceCrop(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol) {
+  return soleil * max(ndl, 0.0) + mix(sol, ciel, 0.5 * ndu + 0.5);
+}
+`
+
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
-vec3 irradianceCrop(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol) {
-  return soleil * max(ndl, 0.0) + mix(sol, ciel, 0.5 * ndu + 0.5);
-}
+${GLSL_IRRADIANCE}
 vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, float ndl,
                   vec3 soleil, vec3 ciel, vec3 sol) {
   vec3 albedo = albedoCrop(mapCol, base, natGris(hn, ndu), teinte);
   return albedo * irradianceCrop(ndl, ndu, soleil, ciel, sol) * ${RECIPROQUE_PI};
 }
 `
diff --git a/src/monde/ecume-mer.js b/src/monde/ecume-mer.js
index c1a655a..363b492 100644
--- a/src/monde/ecume-mer.js
+++ b/src/monde/ecume-mer.js
@@ -187,20 +187,149 @@ export function etatMerDuSocle(uniformes) {
   return {
     houle: lire('uWaveH', ETAT_MER_NEUTRE.houle),
     chop: lire('uChop', ETAT_MER_NEUTRE.chop),
     ecume: lire('uFoam', ETAT_MER_NEUTRE.ecume),
     ecumeEchelle: lire('uFoamScale', ETAT_MER_NEUTRE.ecumeEchelle),
     brillance: lire('uGloss', ETAT_MER_NEUTRE.brillance),
     vitesse: lire('uSpeedMul', ETAT_MER_NEUTRE.vitesse),
   }
 }
 
+// ── ②ter LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ───────────────────
+//
+// ⛔ **QUATRE RÉGLAGES D'`ocean.js` QUE LA CALOTTE N'A JAMAIS REÇUS, ET AUCUN
+// PARAMÈTRE NE LES PORTAIT.** P5 avait mesuré le symptôme sans pouvoir
+// l'attribuer : *« la concentration de luminance vaut 80,97 % côté crop contre
+// 30,33 % au socle ; sur le fond marin NU, 40,14 % contre 38,73 %. Presque tout
+// l'écart vit dans la NAPPE. »* Relevé le 2026-08-22 **au même instant, dans la
+// même page** (La Réunion z12) :
+//
+//   ① **`uTransp = 0,57`** (`params.waterTransparency`) — le nuanceur de la
+//      calotte n'a **aucun terme de transparence**. `ocean.js` multiplie son
+//      opacité d'eau par `mix(1,15 ; 0,26 ; uTransp)`, soit **0,6427** ici : la
+//      lame du crop est **1,556 fois trop opaque**, et à tirette pleine elle le
+//      serait **3,85 fois**. ⚡ **C'est le « plus sombre et plus opaque » de la
+//      réserve n° 2 de P5, chiffré et attribué.**
+//   ② **`uSunFx = 0,72`** (`params.waterSunFx`) — la calotte ne dose pas son
+//      reflet solaire : **28 % de glint de trop**.
+//   ③ **`uDetail = 0,75`** (`chopLook(seaChop).detail`) — `ocean.js` perturbe la
+//      normale de sa surface par deux bruits (`vNorm + uDetail × 0,6 ×
+//      uViewCalm × …`). **La calotte n'en avait pas un seul.** ⚡ **C'est la
+//      mesure que P5 laissait ouverte** : « la mer du socle AJOUTE de la
+//      variation (2,46 → 3,36) ; celle du crop en RETIRE (1,55 → 1,37) ».
+//   ④ **`uDayLight`** — la mer du socle S'ÉTEINT la nuit (corps multiplié par
+//      `(0,10 · 0,16 · 0,30)`, écume par 0,14). Celle du crop reste en plein
+//      jour à minuit. Vaut 1 au relevé, donc **invisible aujourd'hui et faux
+//      dès qu'on touche la tirette d'heure**.
+//
+// ⚠️ **LE NEUTRE EST CELUI D'`ocean.js`, PAS « LA CALOTTE D'AVANT ».** Il
+// n'existe AUCUNE valeur de `transparence` qui reproduise le nuanceur d'avant :
+// il portait `mix(0,45 ; 0,95)` **sans le facteur de tirette** (donc
+// `transparence ≈ 0,1685`) **et** le glacis de lagon à plein régime (donc
+// `transparence ≥ 0,35`). Les deux ne peuvent pas être vraies ensemble — **c'est
+// la signature d'une loi tronquée, pas d'un réglage.** Le neutre retenu est donc
+// celui des `??` de `waterMaterial` : `0,4`, `1`, `1` et `chopLook(0,7).detail`,
+// exactement la famille d'`ETAT_MER_NEUTRE`. ⚠️ **Et il ne touche pas la
+// production** : `poserMer` n'est appelée que sous `?terre=unique` ; drapeau
+// baissé il n'y a pas de mer de crop du tout.
+
+/** Le `detail` de `chopLook(c)` d'`ocean.js` : `0,25 + 0,5 c`. */
+export function detailClapot(chop) {
+  return 0.25 + 0.5 * chop
+}
+
+/**
+ * La lame d'eau NEUTRE : les défauts de `waterMaterial` d'`ocean.js`.
+ *
+ * ⚠️ **LES QUATRE SONT DES `??` DU DÉPÔT**, pas des nombres choisis ici :
+ * `params.waterTransparency ?? 0.4`, `params.waterSunFx ?? 1`,
+ * `uDayLight: { value: 1 }`, `chopLook(params.seaChop ?? 0.7).detail`.
+ */
+export const LAME_EAU_NEUTRE = Object.freeze({
+  transparence: 0.4,
+  soleilFx: 1,
+  jour: 1,
+  detail: detailClapot(0.7),
+})
+
+/**
+ * La lame d'eau VIVANTE du socle, ou le neutre s'il n'y en a pas.
+ *
+ * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT, champ par champ, exactement comme
+ * `etatMerDuSocle` juste au-dessus et pour la même raison — un uniforme absent
+ * rend SA valeur neutre, jamais celle du voisin.
+ *
+ * @param {object|null} uniformes les uniformes du matériau de mer du socle
+ * @returns {{transparence:number, soleilFx:number, jour:number, detail:number}}
+ */
+export function lameEauDuSocle(uniformes) {
+  const lire = (nom, neutre) => {
+    const v = uniformes?.[nom]?.value
+    return Number.isFinite(v) ? v : neutre
+  }
+  return {
+    transparence: lire('uTransp', LAME_EAU_NEUTRE.transparence),
+    soleilFx: lire('uSunFx', LAME_EAU_NEUTRE.soleilFx),
+    jour: lire('uDayLight', LAME_EAU_NEUTRE.jour),
+    detail: lire('uDetail', LAME_EAU_NEUTRE.detail),
+  }
+}
+
+/** Le seuil du glacis de lagon. `ocean.js` : `smoothstep(0.0, 0.35, uTransp)`. */
+export const LAGON_FIN = 0.35
+
+/** Le poids du glacis de lagon, tiré de la tirette de transparence. */
+export function poidsLagon(transparence) {
+  return pas0a1(0, LAGON_FIN, transparence)
+}
+
+/** L'exposant du dégradé de lagon. `ocean.js` : `pow(dRt, 0.7)`. */
+export const LAGON_EXPO = 0.7
+
+/** Les trois bornes de l'opacité d'eau brute. `ocean.js` : `mix(0.45, 0.95, pow(d, 0.55))`. */
+export const OPACITE_EAU = Object.freeze({ bas: 0.45, haut: 0.95, expo: 0.55 })
+
+/** Les deux bornes du facteur de tirette. `ocean.js` : `mix(1.15, 0.26, uTransp)`. */
+export const TIRETTE_EAU = Object.freeze({ opaque: 1.15, clair: 0.26 })
+
+/** L'écrêtage de l'opacité d'eau. `ocean.js` : `clamp(…, 0.05, 0.97)`. */
+export const OPACITE_ECRETAGE = Object.freeze({ bas: 0.05, haut: 0.97 })
+
+/**
+ * L'opacité de la lame d'eau — `wOp` d'`ocean.js`, transcrite terme pour terme.
+ *
+ * ⚠️ **LES QUATRE LIGNES SONT DANS L'ORDRE D'`ocean.js`, ET L'ORDRE COMPTE** :
+ * l'écrêtage tombe AVANT le plancher de Fresnel, et le glacis de lagon ferme la
+ * marche. Les intervertir change le résultat sur les bords et sur les eaux
+ * peintes (`transparence < 0,35`, où la lame redevient une PEINTURE pleine).
+ */
+export function opaciteEau(dLagon, transparence, fresnel) {
+  const lagon = poidsLagon(transparence)
+  let w = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(Math.max(dLagon, 0), OPACITE_EAU.expo)
+  w *= TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * transparence
+  w = Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, w))
+  w = Math.max(w, fresnel * 0.5)
+  return 1 + (w - 1) * lagon
+}
+
+/** L'assombrissement nocturne du corps de l'eau. `ocean.js` : `vec3(0.10, 0.16, 0.30)`. */
+export const NUIT_EAU = Object.freeze([0.1, 0.16, 0.3])
+
+/** L'assombrissement nocturne de l'écume. `ocean.js` : `mix(0.14, 1.0, uDayLight)`. */
+export const NUIT_ECUME = 0.14
+
+/** Le facteur et le biais du clapot de normale. `ocean.js` : `uDetail * 0.6 * uViewCalm * vec3(n1-0.5, 0.9, n2-0.5)`. */
+export const CLAPOT_NORMALE = Object.freeze({ gain: 0.6, haut: 0.9, freq: 6 })
+
+/** La modulation du glint par la tavelure. `ocean.js` : `(0.35 + 0.85 * patchy)`. */
+export const GLINT_TAVELURE = Object.freeze({ base: 0.35, gain: 0.85 })
+
 // ── ③ LA TAVELURE ET LE BRUIT ──────────────────────────────────────────────
 
 /**
  * La fréquence de la tavelure, **PAR UNITÉ DE SOCLE**. `ocean.js:537` :
  * `vnoise(xz * 0.33 + …)` où `xz = vWorld.xz`, donc des unités de socle.
  *
  * ⚠️ **LA CALOTTE ÉCRIVAIT `vLocal * 0.33 / uMerLambda * 0.08`**, c'est-à-dire
  * en espace de SPECTRE avec un facteur `0,08` qui n'existe nulle part dans
  * `ocean.js`. Relevé sur la page vivante (La Réunion z12,
  * `uMerLambda = 0,0032204`, largeur du crop `0,429` unité de scène) : la cellule
@@ -261,20 +390,55 @@ export function ecumeMer(a) {
 // multiplication flottante n'est pas associative : réordonner `a * b * c` en
 // `a * (b * c)` changerait des bits, et la preuve bit-à-bit du socle (§6 du
 // rapport P2, refaite ici) le verrait.
 //
 // ⚠️ **LES CONSTANTES SONT INTERPOLÉES DEPUIS LES EXPORTS CI-DESSUS**, pas
 // réécrites : c'est ce qui permet à `test/ecume-mer.test.js` d'exiger qu'aucune
 // des sept formules ne reparaisse ailleurs dans `ocean.js` ou `globe.js`.
 // (Une campagne de mutation de P2 a survécu parce que ses motifs cherchaient
 // `0.35` dans un texte qui portait `${PART_OMBRAGE.toFixed(2)}` : les motifs de
 // ce module-ci visent les NOMS, pas les chiffres.)
+// ══════════ LA LAME D'EAU EN GLSL — Tâche P6, UNE ÉCRITURE, DEUX LECTEURS ══
+//
+// ⚠️ **MÊME PATRON QUE `GLSL_ECUME` JUSTE DESSOUS, ET POUR LA MÊME RAISON.**
+// Ces trois lois vivaient **uniquement** dans `ocean.js` ; la calotte du globe
+// n'en portait qu'un fragment tronqué (`mix(uMerPeu, uMerFond, pow(d, 0.7))` et
+// `mix(0.45, 0.95, pow(d, 0.55))`, sans la tirette, sans le glacis, sans la
+// nuit). Les recopier aurait fait une seconde écriture de plus ; **on les
+// extrait, et `ocean.js` INJECTE le même texte.**
+export const GLSL_LAME_EAU = /* glsl */ `
+// ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
+float poidsLagonEau(float transparence) {
+  return smoothstep(0.0, ${LAGON_FIN.toFixed(2)}, transparence);
+}
+vec3 corpsEau(vec3 peu, vec3 fond, float dLagon, float lagon, float jour) {
+  vec3 c = mix(fond, mix(peu, fond, pow(dLagon, ${LAGON_EXPO.toFixed(1)})), lagon);
+  return c * mix(vec3(${NUIT_EAU[0].toFixed(2)}, ${NUIT_EAU[1].toFixed(2)}, ${NUIT_EAU[2].toFixed(2)}), vec3(1.0), jour);
+}
+float opaciteEau(float dLagon, float transparence, float fresnel) {
+  float lagon = poidsLagonEau(transparence);
+  float w = mix(${OPACITE_EAU.bas.toFixed(2)}, ${OPACITE_EAU.haut.toFixed(2)}, pow(dLagon, ${OPACITE_EAU.expo.toFixed(2)}));
+  w = clamp(w * mix(${TIRETTE_EAU.opaque.toFixed(2)}, ${TIRETTE_EAU.clair.toFixed(2)}, transparence), ${OPACITE_ECRETAGE.bas.toFixed(2)}, ${OPACITE_ECRETAGE.haut.toFixed(2)});
+  w = max(w, fresnel * 0.5);
+  return mix(1.0, w, lagon);
+}
+vec3 clapotNormale(vec3 normale, float detail, float calmeVue, float b1, float b2) {
+  return normalize(normale + detail * ${CLAPOT_NORMALE.gain.toFixed(1)} * calmeVue * vec3(b1 - 0.5, ${CLAPOT_NORMALE.haut.toFixed(1)}, b2 - 0.5));
+}
+float glintTavelureMer(float tavelure) {
+  return ${GLINT_TAVELURE.base.toFixed(2)} + ${GLINT_TAVELURE.gain.toFixed(2)} * tavelure;
+}
+vec3 blanchirEcume(vec3 col, float ecume, float jour) {
+  return mix(col, vec3(${BLANC_ECUME.toFixed(2)}) * mix(${NUIT_ECUME.toFixed(2)}, 1.0, jour), ecume);
+}
+`
+
 export const GLSL_ECUME = /* glsl */ `
 // ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
 float declinRivageMer(float profondeur, float distance) {
   return max(profondeur * ${POIDS_PROFONDEUR.toFixed(1)}, distance);
 }
 float fonduRessacMer(float declin) {
   return smoothstep(0.0, ${FONDU_RESSAC_FIN.toFixed(2)}, declin);
 }
 float fonduHouleMer(float declin) {
   return smoothstep(0.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin);
diff --git a/src/monde/mer-sphere.js b/src/monde/mer-sphere.js
index 21f4255..5b9b5f7 100644
--- a/src/monde/mer-sphere.js
+++ b/src/monde/mer-sphere.js
@@ -315,20 +315,50 @@ export const RAMPE_NAUTIQUE = Object.freeze({
  * @returns {{peu:object, moyen:object, fond:object}|null} les trois `Color`
  *   VIVANTES du socle, ou `null` si l'une des trois manque — **on ne pose jamais
  *   un demi-triplet** : deux couleurs du socle et une du défaut seraient pires
  *   que les trois du défaut, exactement comme le demi-couple d'accalmies de P4.
  */
 export function couleursFondDuSocle(peu, moyen, fond) {
   if (!peu?.isColor || !moyen?.isColor || !fond?.isColor) return null
   return { peu, moyen, fond }
 }
 
+/**
+ * Les deux couleurs de la LAME D'EAU du socle — Tâche P6.
+ *
+ * ⛔ **LA MÊME FAUTE QUE `couleursFond` CI-DESSUS, UN CRAN PLUS HAUT, ET ELLE A
+ * SURVÉCU À P5 PARCE QUE LE DÉFAUT COÏNCIDAIT.** `poserMer` porte un paramètre
+ * `couleurs` depuis la Tâche F ; **aucun appelant ne l'a jamais passé**, donc la
+ * calotte vit sur `couleursEau({})`, c'est-à-dire sur
+ * `params.lakeColor ?? '#8fc6e8'` — **le DÉFAUT, pas la palette.**
+ *
+ * ⚡ **ET LE RELEVÉ DU 2026-08-22 A FAILLI DIRE « BRANCHÉ »** : les deux côtés
+ * rendaient `#88d2e1` / `#184465`, au caractère près… parce que
+ * `params.lakeColor` valait justement `#8fc6e8`. **Le témoin l'a dit** : posé à
+ * `#c81e1e` dans la page VIVANTE, le socle est passé à `#a77572` / `#1e3350` et
+ * **la calotte n'a pas bougé d'un bit** ; le retour rend les deux valeurs de
+ * départ. ➡️ **Une concordance au défaut n'est PAS un branchement**, et c'est la
+ * leçon de méthode de la Tâche P6.
+ *
+ * ⚠️ **DEUX COULEURS, PAS LA POIGNÉE** — même règle que `couleursFondDuSocle`,
+ * et même refus du demi-couple : une couleur du socle et une du défaut seraient
+ * pires que les deux du défaut.
+ *
+ * @param {object|null} peu le glacis clair (`uShallowT` d'`ocean.js`)
+ * @param {object|null} fond le bleu du large (`uDeep` d'`ocean.js`)
+ * @returns {{peu:object, fond:object}|null}
+ */
+export function couleursEauDuSocle(peu, fond) {
+  if (!peu?.isColor || !fond?.isColor) return null
+  return { peu, fond }
+}
+
 /**
  * La profondeur maximale du champ **DANS LE CROP**, en mètres — Tâche P5.
  *
  * ⛔ **LE BUDGET DU FOND ÉTAIT CELUI DE LA CALOTTE, ET LE SOCLE PREND CELUI DE
  * SON BLOC.** `terrain.js` pose `uSeaRange = (0 − dem.minM) × demScale`, et
  * `dem` couvre EXACTEMENT le bloc. `poserMer`, lui, posait `champ.profMaxM`,
  * mesuré sur la calotte — trois fois plus large. Relevé le 2026-08-22, La
  * Réunion z12 : **3 510,49 m contre 2 116 m**, soit **×1,658**.
  *
  * ⚠️ **ET CE N'EST PAS UN DÉTAIL DE NORMALISATION : ÇA DOUBLE LA FRANGE PÂLE.**
diff --git a/src/monde/parois-crop.js b/src/monde/parois-crop.js
index c8b1458..8acd221 100644
--- a/src/monde/parois-crop.js
+++ b/src/monde/parois-crop.js
@@ -356,37 +356,45 @@ export function repereLocalCrop(repere, rayon) {
  * Tout sort dans le repère LOCAL du crop (§2) : `origine` et `base` disent où le
  * poser dans le monde.
  *
  * @param {object} arg
  * @param {{cx:number,cy:number,demi:number}} arg.repere - `repereCrop(...)`
  * @param {{coin:number,expo:number}} arg.forme - la MÊME que celle du nuanceur
  * @param {(lat:number, lon:number) => number} arg.hauteur - mètres, au point EXACT
  * @param {number} arg.rayon - R_GLOBE, en unités de scène
  * @param {number} arg.echelle - unités de scène par mètre d'altitude
  * @param {number} [arg.pas] - espacement de l'anneau (voir `PAS_CONTOUR`)
- * @param {number} [arg.profondeur] - en unités ; défaut `FRACTION_PROFONDEUR × largeur`
+ * @param {number} [arg.profondeur] - en unités ; défaut `fractionProfondeur × largeur`
+ * @param {number} [arg.fractionProfondeur] - la profondeur EN FRACTION de la
+ *   largeur du bloc, quand `profondeur` n'est pas imposée. ⛔ **Tâche P6 : elle
+ *   n'existait pas, et `FRACTION_PROFONDEUR = 7 / 56` était donc GELÉE** —
+ *   c'est-à-dire `params.plinthDepth` à son défaut, pendant que la tirette
+ *   « profondeur du socle » vit et déplace celle du bloc plat. Même famille que
+ *   `couleursFond` (P5) et que `corner` (P6) : un défaut qui a l'air juste parce
+ *   qu'il coïncide avec le réglage d'usine.
  * @param {number|null} [arg.baseYFloor] - fond IMPOSÉ, jamais plus haut
  * @param {number} [arg.plancherMer] - le plancher du globe (§4), 0 par défaut
  * @param {number} [arg.couvertureMin] - fraction de points qui doivent avoir
  *   une hauteur connue ; **1 par défaut : un seul trou et la paroi REFUSE de
  *   se bâtir** (§7). Rend alors `{ refus: 'couverture', couverture }`.
  * @param {number} [arg.aoForce] - profondeur de l'occlusion de contact
  * @param {number|null} [arg.aoBande] - la bande IMPOSÉE, en unités monde
  */
 export function construireSolideCrop({
   repere,
   forme = { coin: 0, expo: 2 },
   hauteur,
   rayon,
   echelle,
   pas = PAS_CONTOUR,
   profondeur = null,
+  fractionProfondeur = FRACTION_PROFONDEUR,
   baseYFloor = null,
   plancherMer = 0,
   couvertureMin = 1,
   aoForce = FORCE_AO,
   aoBande = null,
 } = {}) {
   if (!repere || !Number.isFinite(repere.demi)) {
     throw new TypeError('construireSolideCrop : il faut un `repere` (repereCrop)')
   }
   if (typeof hauteur !== 'function') {
@@ -481,21 +489,26 @@ export function construireSolideCrop({
   // (not just the border) so a deep interior basin can never pierce the base
   // plane ». Un lac de cratère au milieu du crop percerait le fond sans lui.
   for (let j = 1; j < PAS_INTERIEUR; j++) {
     for (let i = 1; i < PAS_INTERIEUR; i++) {
       const y = surface(-1 + (2 * i) / PAS_INTERIEUR, -1 + (2 * j) / PAS_INTERIEUR)[1]
       if (y < minY) minY = y
     }
   }
 
   const largeur = Math.max(x1 - x0, z1 - z0)
-  const prof = Number.isFinite(profondeur) ? Math.max(0, profondeur) : FRACTION_PROFONDEUR * largeur
+  // ⚠️ **LA FRACTION EST ÉCRÊTÉE À ZÉRO, PAS SEULEMENT LA PROFONDEUR** : une
+  // tirette négative (ou un `NaN` remonté d'un uniforme absent) ferait un bloc
+  // dont le fond passe AU-DESSUS de sa surface, et `computeSlab` du socle borne
+  // déjà de la même façon.
+  const fr = Number.isFinite(fractionProfondeur) ? Math.max(0, fractionProfondeur) : FRACTION_PROFONDEUR
+  const prof = Number.isFinite(profondeur) ? Math.max(0, profondeur) : fr * largeur
   const baseBrut = minY - prof
   const baseY = baseYFloor != null ? Math.min(baseYFloor, baseBrut) : baseBrut
   const bande = Number.isFinite(aoBande) ? Math.max(0, aoBande) : FRACTION_BANDE_AO * Math.max(0, hautMax - baseY)
 
   // ─── LE VERDICT DE COUVERTURE — voir le §7 ───────────────────────────────
   //
   // ⚠️ **AVANT DE POSER LE MOINDRE SOMMET.** Une paroi à trous n'est pas une
   // paroi dégradée, c'est une paroi FAUSSE : les points manquants tombent au
   // niveau de la mer et découpent des encoches dans le flanc du bloc.
   const couverture = vus + manquants > 0 ? vus / (vus + manquants) : 0
diff --git a/src/ocean.js b/src/ocean.js
index d099519..78c687f 100644
--- a/src/ocean.js
+++ b/src/ocean.js
@@ -28,24 +28,32 @@ import { lireExageration } from './monde/exageration-continue.js' // un seul par
 import { lacsMemoLire, lacsMemoEcrire } from './dem-memo.js'
 import { plansEauRetenus } from './plan-eau.js'
 // LE CHAMP SUIT LE RELIEF — règles pures et testées, voir src/mer-emprise.js
 // pour la mesure d'avant/après et le pourquoi de chaque choix.
 import { resChamp, spanChamp } from './mer-emprise.js'
 // LA DISTANCE AU RIVAGE — une seule loi, deux lecteurs (voir _bakeField).
 // ⚠️ AUCUN CYCLE : `monde/mer-sphere.js` est PUR (ni three ni DOM) et n'importe
 // que `crop-sphere`, `parois-crop` et `habillage-crop`, dont aucun ne remonte
 // jusqu'ici. Vérifié : `grep -rn "from '.*ocean" src/monde/` ne rend RIEN (le nom
 // du fichier n'y apparaît que dans des commentaires).
-import { distanceRivage, GLSL_JUPE_MER } from './monde/mer-sphere.js'
+import { distanceRivage, GLSL_JUPE_MER, couleursEauDuSocle } from './monde/mer-sphere.js'
 // L'ÉCUME — une seule loi, deux lecteurs (Tâche P4). Même motif, même absence
 // de cycle : `monde/ecume-mer.js` n'importe RIEN du tout.
-import { GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle, etatMerDuSocle } from './monde/ecume-mer.js'
+// ⚠️ **ET LA LAME D'EAU DEPUIS LA TÂCHE P6**, pour exactement la même raison :
+// les trois lois de `corpsEau` / `opaciteEau` / `clapotNormale` ne vivaient QUE
+// dans le fragment ci-dessous, et la calotte du globe en portait une version
+// TRONQUÉE — sans la tirette de transparence, sans le glacis de lagon, sans la
+// nuit. Le texte est le même des deux côtés parce qu'il n'y en a qu'un.
+import {
+  GLSL_ECUME, GLSL_LAME_EAU, FREQ_TAVELURE,
+  accalmieDuSocle, etatMerDuSocle, lameEauDuSocle,
+} from './monde/ecume-mer.js'
 // L'emprise du DAMIER — même machinerie, autre cause : ici la mer s'étend parce
 // que des cases voisines sont posées, pas parce que le relief défile.
 import { empriseDeMer, coteGeometrique, geometrieDeMer } from './damier-carre.js'
 // wave engine shared with ocean-lab (C:\Dev\ocean-lab) — the Vite alias
 // resolves to the LIVE ocean-lab source when it's cloned next to this repo,
 // to the committed src/vendor/ocean-waves copy otherwise (npm run sync:waves)
 import { makeSeaState, seaStateToUniforms, GERSTNER_GLSL } from 'ocean-waves'
 
 const FIELD_RES = 384 // height/shore field over the whole slab
 
@@ -417,20 +425,21 @@ varying float vFade;
 // small tiling value noise for ripples + foam breakup
 float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
 float vnoise(vec2 p) {
   vec2 i = floor(p);
   vec2 f = fract(p);
   f = f * f * (3.0 - 2.0 * f);
   return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
              mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
 }
 ${GLSL_ECUME}
+${GLSL_LAME_EAU}
 
 // sun caustics — the classic iterated-phase shimmer (Hoskins-style), cheap
 // and convincing where the water is clear
 float caustic(vec2 p, float t) {
   vec2 i = p;
   float c = 1.0;
   for (int n = 0; n < 3; n++) {
     float ft = t * (1.0 - (3.5 / float(n + 1)));
     i = p + vec2(cos(ft - i.x) + sin(ft + i.y), sin(ft - i.y) + cos(ft + i.x));
     c += 1.0 / length(vec2(p.x / (sin(i.x + ft) / 0.6), p.y / (cos(i.y + ft) / 0.6)));
@@ -489,24 +498,28 @@ void main() {
     vec2 uvM = uvMasqueCotier(xzChamp);
     if (uvM.x >= 0.0) coastLand = texture2D(uCoastMask, uvM).r;
     if (coastLand > 0.8) discard;
   }
   float shoreAA = smoothstep(0.0, 0.02, depth);
 #endif
   float d01 = clamp(depth / uDepthMax, 0.0, 1.0);
   float dpow = pow(d01, 0.65);
 
   // ripple micro-normals on top of the Gerstner normal
+  // ⚠️ **clapotNormale VIENT DE monde/ecume-mer.js DEPUIS LA TACHE P6** — la
+  // calotte du globe n'avait AUCUN clapot de normale, et c'est ce qui faisait
+  // que sa lame d'eau RETIRAIT de la variation la ou celle-ci en AJOUTE
+  // (reserve n° 2 de P5). Le texte est injecte, pas recopie (GLSL_LAME_EAU).
   vec2 rp = xz * 6.0;
   float n1 = vnoise(rp + vec2(uTime * 0.9, 0.0));
   float n2 = vnoise(rp * 1.9 - vec2(0.0, uTime * 1.2));
-  vec3 N = normalize(vNorm + uDetail * 0.6 * uViewCalm * vec3(n1 - 0.5, 0.9, n2 - 0.5));
+  vec3 N = clapotNormale(vNorm, uDetail, uViewCalm, n1, n2);
 
   vec3 V = normalize(cameraPosition - vWorld);
   vec3 L = normalize(uSunDir);
   // ^5 not ^3: the softer curve painted flat pale "fresnel continents" in
   // rows across wave backs at F2-F3; the cap kills the same artefact on
   // steep F3 wave backs, where dot(N,V)→0 saturates any exponent
   float fres = min(pow(1.0 - max(dot(N, V), 0.0), 5.0), 0.5);
 
   // v41 : le FOND vit sur le terrain (les vignettes Seabed pilotent la rampe
   // ocean oceanShallow/Mid/Deep du relief) - ici l'eau n'est qu'une lame
@@ -525,23 +538,23 @@ void main() {
 #endif
   // le degrade lagon vit sur les ~premiers 15% du budget de profondeur
   // (une baie de 30 m est un lagon ; uDepthMax couvre des colonnes de 1 km)
 #ifdef IS_LAKE
   float dRt = d01;
 #else
   float dRt = clamp(max(uWaterY - f.r, 0.0) / max(uDepthMax * 0.15, 0.02), 0.0, 1.0);
 #endif
   // transp 0 -> teinte pleine uDeep (peinture opaque, eau foncee possible) ;
   // en montant le slider, le glacis clair des faibles profondeurs s'installe
-  float lagoonW = smoothstep(0.0, 0.35, uTransp);
-  vec3 body = mix(uDeep, mix(uShallowT, uDeep, pow(dRt, 0.7)), lagoonW);
-  body *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);
+  // ⚠️ **corpsEau ET poidsLagonEau VIENNENT DE monde/ecume-mer.js — Tache P6.**
+  float lagoonW = poidsLagonEau(uTransp);
+  vec3 body = corpsEau(uShallowT, uDeep, dRt, lagoonW, uDayLight);
 
   // large-scale patchiness: without it the glitter and the whitecaps line up
   // in parallel rows along the dominant swell — the "repeating waves" flag
   // (named patchy: "patch" is a reserved word in GLSL and kills the compile)
   float patchy = tavelureMer(vnoise(xz * ${FREQ_TAVELURE} + vec2(uTime * 0.015, -uTime * 0.011)));
 
   // v44: les reflets (ciel + glint solaire) sont des reflets DE SURFACE :
   // ils s'appliquent APRES le composite de transparence, sinon ils sont
   // dilues comme s'ils venaient du fond — le glint avait disparu (Adrien)
   vec3 col = body;
@@ -568,36 +581,39 @@ void main() {
   foam *= 1.0 - smoothstep(0.35, 0.65, coastLand);
 #endif
 
   // v43 : COMPOSITE REFRACTE (grab pass). Le fond deja rendu est
   // echantillonne avec un decalage de Snell : la pente de la surface devie
   // ce qu'on voit a travers. Lisible a toutes les echelles (pas d'attenuation
   // d'altitude), seule la cote l'eteint (vFade).
   // v45 : la tirette couvre une VRAIE plage — à fond, l'eau du large garde
   // ~25 % de teinte (le fond se lit clairement) au lieu du plancher 47 % qui
   // rendait la transparence indiscernable (retour Adrien)
-  float wOp = mix(0.45, 0.95, pow(dRt, 0.55));
-  wOp = clamp(wOp * mix(1.15, 0.26, uTransp), 0.05, 0.97);
-  wOp = max(wOp, fres * 0.5);
-  // sous ~0.35 de transparence : PEINTURE pleine (eau foncee comme avant)
-  wOp = mix(1.0, wOp, lagoonW);
+  // ⚠️ **opaciteEau VIENT DE monde/ecume-mer.js — Tache P6.** Sous ~0.35 de
+  // transparence la lame redevient une PEINTURE pleine ; la calotte du globe
+  // n'avait ni ce palier ni le facteur de tirette, donc une eau 1,556 fois trop
+  // opaque au reglage vivant du 2026-08-22.
+  float wOp = opaciteEau(dRt, uTransp, fres);
   vec2 screenUv = gl_FragCoord.xy / uResolution;
   // v45 : la réfraction reste ACTIVE près des côtes (0.3 plancher) — c'est là
   // que le fond a du détail à tordre ; au large un fond uniforme ne montre
   // rien, l'ancien *vFade l'éteignait donc exactement où elle se voyait
   vec2 refOff = N.xz * uRefract * 0.09 * (0.3 + 0.7 * vFade);
   vec3 through = texture2D(uSceneTex, clamp(screenUv + refOff, vec2(0.001), vec2(0.999))).rgb;
   col = mix(through, col, wOp);
   // reflets de surface : jamais attenues par la transparence
   col = mix(col, uSky, fres * 0.35);
-  col += uSunColor * spec * uSunFx * (0.35 + 0.85 * patchy);
-  col = mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam);
+  // ⚠️ **glintTavelureMer ET blanchirEcume VIENNENT DE monde/ecume-mer.js —
+  // Tache P6.** La calotte du globe ne dosait pas son glint (uSunFx) et ne
+  // faisait pas tomber son ecume la nuit : deux entrees, jamais branchees.
+  col += uSunColor * spec * uSunFx * glintTavelureMer(patchy);
+  col = blanchirEcume(col, foam, uDayLight);
   float alpha = max(shoreAA, foam * 0.85);
 #ifndef IS_LAKE
   alpha *= 1.0 - smoothstep(0.35, 0.65, coastLand); // la lame d'eau meurt en douceur sur la terre du masque
 #endif
 
   gl_FragColor = vec4(col, alpha);
   #include <fog_fragment>
 }
 `
 
@@ -1839,20 +1855,58 @@ export class RealWater {
       // (manque n° 2 du noteur), au même endroit du même objet.
       ciel: u?.uSky?.value ?? null,
       // ⚠️ **ET L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4.** Six nombres,
       // LUS ici et recalculés nulle part. Relevé le 2026-08-22 dans la page
       // vivante : le socle vit à `uWaveH = 2`, `uChop = 1`, `uFoam = 1,9`,
       // `uFoamScale = 1`, `uGloss = 110`, `uSpeedMul = 0,4` ; la calotte vivait
       // sur les défauts de `poserMer` — `0,5 / 0,7 / 0,931 / 0,35 / 149 / 1`.
       // **Six sur six différents**, dont la VITESSE, que P4 n'avait pas nommée
       // et qui faisait défiler la houle du crop 2,5 fois trop vite.
       etat: etatMerDuSocle(u),
+      // ══════ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ═══════════════
+      //
+      // ⛔ **QUATRE RÉGLAGES DE PLUS QUE LA CALOTTE N'A JAMAIS REÇUS**, et
+      // aucun n'avait de paramètre pour les porter : `uTransp` (0,57 au relevé
+      // du 2026-08-22), `uSunFx` (0,72), `uDayLight`, `uDetail` (0,75). C'est
+      // la NAPPE, celle dont P5 a mesuré qu'elle portait « presque tout
+      // l'écart » sans pouvoir l'attribuer.
+      eau: lameEauDuSocle(u),
+      // ⚠️ **ET LES DEUX COULEURS DE LA LAME.** `poserMer` porte un paramètre
+      // `couleurs` que **personne n'a jamais passé** : la calotte vit sur
+      // `couleursEau({})`, donc sur `params.lakeColor ?? '#8fc6e8'`. Le témoin
+      // du 2026-08-22 (lakeColor posé à `#c81e1e`) : le socle bouge, la
+      // calotte non. Même faute que `couleursFond` (P5) et `uSky` (P4).
+      couleurs: couleursEauDuSocle(u?.uShallowT?.value ?? null, u?.uDeep?.value ?? null),
+      // ⚠️ **LA COULEUR DU SOLEIL, LUE SUR LA MER DU SOCLE ET NON SUR LA
+      // LAMPE.** `update(dt, sun)` y recopie `sun.color` par image ; la calotte
+      // portait `new THREE.Color(0xffffff)` **codé en dur** contre `#fff7e6`
+      // vivant. Passer par la lampe aurait fait un second chemin pour une
+      // grandeur dont `update` est déjà l'unique écrivain.
+      soleilCouleur: u?.uSunColor?.value ?? null,
+      // ⚠️ **LE SPECTRE, PAR RÉFÉRENCE — Tâche P6.** `_applySea` assigne déjà
+      // `u.a` / `u.b` à TOUS les matériaux du socle sans les cloner ; la calotte
+      // du globe entre dans la même liste de lecteurs. Un seul écrivain,
+      // `_applySea`, et plus deux mers tirées séparément au hasard.
+      spectre: u ? { a: u.uWaveA?.value ?? null, b: u.uWaveB?.value ?? null } : null,
+      // ⛔ **L'ÉCHELLE DE LONGUEUR DE HOULE — la réserve n° 3 de P5, fermée.**
+      // Elle l'avait mesurée sans la refermer : *« le socle vit à
+      // `lenSea = LEN_SCALE × clamp(waveScale) = 0,231` pendant que le crop
+      // dérive la sienne de `ECHELLE_HOULE_UNITES = 0,42` EN DUR. Le spectre du
+      // crop est donc 1,818 fois plus étiré. »* Relevé le 2026-08-22 :
+      // `uLenScale = 0,231` contre un `uMerLambda` de 0,003220 pour un
+      // `uMerUnite` de 0,008227, soit **1,695 fois** — le rapport bouge avec
+      // `waveScale`, ce qui est précisément pourquoi il doit être LU et non posé.
+      //
+      // ⚠️ **EN UNITÉS DE SOCLE ICI** : la conversion en unités de scène se fait
+      // du côté du crop, qui est le seul à connaître `uMerUnite`. Une conversion
+      // faite ici demanderait à `ocean.js` de savoir ce qu'est un crop.
+      echelleSpectre: Number.isFinite(u?.uLenScale?.value) ? u.uLenScale.value : null,
     }
   }
 
   // Le Y de la surface de mer courante, ou null tant qu'aucune mer n'est
   // construite.
   get seaY() {
     return this.meshes.length ? this._seaBase : null
   }
 
   update(dt, sun) {
diff --git a/test/crop-branche.test.js b/test/crop-branche.test.js
index bbfbc10..d6d5a2e 100644
--- a/test/crop-branche.test.js
+++ b/test/crop-branche.test.js
@@ -35,20 +35,24 @@ import assert from 'node:assert/strict'
 import fs from 'node:fs'
 import path from 'node:path'
 import { fileURLToPath } from 'node:url'
 
 import {
   creerVeilleCrop,
   poserChaineCrop,
   MAILLONS,
   CHAMPS_HABILLAGE,
   habillageDifferent,
+  // ⚠️ **Tâche P6** : la FORME du bloc, surveillée à part de la signature de lieu.
+  CHAMPS_FORME,
+  formeDuCrop,
+  formeDifferente,
 } from '../src/monde/branchement-crop.js'
 import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'
 
 const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
 const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')
 const SRC_FLAGS = fs.readFileSync(path.join(RACINE, 'src/flags.js'), 'utf8')
 
 // ══════════ LE GLOBE FACTICE — IL REFUSE, IL NE FAIT PAS SEMBLANT ═══════════
 //
 // Il porte exactement ce que la chaîne lit et écrit, et **il se comporte comme
@@ -56,21 +60,24 @@ const SRC_FLAGS = fs.readFileSync(path.join(RACINE, 'src/flags.js'), 'utf8')
 // suivent la découpe rendent `null` ou un refus tant que `_crop` est nul, comme
 // `poserFondCrop`, `construireParoisCrop`, `poserRampe` et `poserMer` le font en
 // tête de corps.
 function globeFactice({ refuse = {} } = {}) {
   const j = []
   const g = {
     _crop: null,
     journal: j,
     refuse: { fond: false, parois: false, rampe: false, mer: false, ...refuse },
     poserCrop(a) {
-      j.push({ quoi: 'crop', centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
+      // ⚠️ **Tâche P6 : L'ARGUMENT ENTIER EST JOURNALISÉ.** Trois champs
+      // recopiés ne diraient rien de `half`, `corner` et `expo` — ceux-là mêmes
+      // que personne n'a jamais passés pendant dix tâches.
+      j.push({ quoi: 'crop', arg: a, centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
       g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }
       return g._crop
     },
     // LE FOND DU CROP — Tâche J bis. ⚠️ **IL REFUSE SANS CROP, comme le vrai** :
     // `poserFondCrop` sort à sa première ligne quand `_crop` est nul.
     poserFondCrop(a) {
       j.push({ quoi: 'fond', arg: a })
       if (!g._crop) return { refus: 'crop', couverture: 0, bathy: false }
       return g.refuse.fond
         ? { refus: 'champ', couverture: 0.3, bathy: false }
@@ -141,23 +148,28 @@ test('① bis la liste des maillons est celle que le globe expose', () => {
   assert.deepEqual(MAILLONS, ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
 })
 
 test('① ter les bornes du crop sont CELLES DU CONTEXTE, pas des constantes locales', () => {
   // ⚠️ **C'EST LE POINT QUI FAIT COÏNCIDER LE CROP ET LE BLOC.** Si la chaîne
   // posait son propre centre ou son propre zoom, la découpe tomberait à côté du
   // bloc que la similitude de la passe de fond aligne — et ce serait invisible
   // partout sauf à l'écran.
   const g = globeFactice()
   poserChaineCrop({ globe: g, centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3 })
-  assert.deepEqual(g.journal[0], {
+  const { arg, ...borne } = g.journal[0]
+  assert.deepEqual(borne, {
     quoi: 'crop', centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3,
   })
+  // ⚠️ **Tâche P6** : l argument entier est journalisé à côté, et sans forme au
+  // contexte il ne porte AUCUN coin — le carré vif d avant, au bit près.
+  assert.equal(arg.corner, undefined)
+  assert.equal(arg.expo, undefined)
 })
 
 test('① quater ce que chaque maillon reçoit vient du contexte, pas d’un défaut', () => {
   const g = globeFactice()
   const ctx = contexteFactice()()
   poserChaineCrop({ globe: g, ...ctx })
   assert.equal(g.journal[3].arg.coastMask, 'masque', 'l’habillage doit recevoir le masque de côte du socle')
   assert.equal(g.journal[3].arg.amplitudeM, 2400)
   assert.equal(g.journal[5].arg.fovDeg, 33, 'la mer doit recevoir le fov VIVANT, pas le défaut du module')
   assert.equal(g.journal[5].arg.altitudeM, 12_000)
@@ -1002,10 +1014,163 @@ test('⑩d le retrait n’introduit AUCUN seuil d’altitude — consigne « zé
   const v = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
   const alt = SEUIL_NAISSANCE_M - 1000
   v.maj(alt)
   assert.ok(v.pose)
   v.poserMode(false)
   assert.equal(v.pose, false, 'à altitude IDENTIQUE, c’est le mode seul qui décide')
   v.poserMode(true)
   v.maj(alt)
   assert.ok(v.pose, 'et le retour rétablit, toujours à la même altitude')
 })
+
+// ══════════ ⑧ LA FORME DU BLOC, SURVEILLÉE PAR IMAGE — Tâche P6 ════════════
+//
+// ⛔ **`poserCrop` PORTE `half`, `corner` ET `expo` DEPUIS LA TÂCHE A, ET
+// PERSONNE NE LES A JAMAIS PASSÉS** ; `construireParoisCrop` porte
+// `profondeur` depuis la Tâche B, même sort. Le bloc du crop était donc un
+// CARRÉ À ANGLES VIFS pendant que celui du socle est un squircle — relevé le
+// 2026-08-22 au même instant dans la même page : `uCropCoin = 0`,
+// `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`.
+//
+// ⚠️ **ET LA SURVEILLANCE EST À PART DE LA SIGNATURE DE LIEU, PAR CALCUL DE
+// COÛT** : `signature` déclenche `poserTout`, donc un champ de mer de 385² et
+// un balayage de rampe de 128² à CHAQUE image d'un glissement de tirette.
+
+test('⑧a la forme est TRANSMISE à `poserCrop`, et le poseur ne la fabrique pas', async () => {
+  const g = globeFactice()
+  const ctx = {
+    ...contexteFactice()(),
+    forme: { half: 28, corner: 2.24, expo: 4.4 },
+    parois: { fractionProfondeur: 0.125 },
+  }
+  const r = poserChaineCrop({ globe: g, ...ctx })
+  const crop = g.journal.find((e) => e.quoi === 'crop')
+  assert.ok(crop.arg, 'le poseur doit transmettre l argument entier')
+  assert.equal(crop.arg.corner, 2.24)
+  assert.equal(crop.arg.expo, 4.4)
+  assert.equal(crop.arg.half, 28)
+  const parois = g.journal.find((e) => e.quoi === 'parois')
+  assert.equal(parois.arg.fractionProfondeur, 0.125)
+  await r.mer
+})
+
+test('⑧b sans forme au contexte, `poserCrop` reçoit ses défauts — le carré vif d avant', async () => {
+  const g = globeFactice()
+  const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
+  const crop = g.journal.find((e) => e.quoi === 'crop')
+  assert.equal(crop.arg.corner, undefined, 'aucun coin inventé')
+  assert.equal(crop.arg.expo, undefined)
+  assert.equal(crop.arg.half, undefined)
+  await r.mer
+})
+
+test('⑧c `formeDuCrop` aplatit les DEUX sous-objets — une grandeur, une veille', () => {
+  assert.deepEqual(
+    formeDuCrop({ forme: { half: 28, corner: 2.24, expo: 4.4 }, parois: { fractionProfondeur: 0.125 } }),
+    { half: 28, corner: 2.24, expo: 4.4, fractionProfondeur: 0.125 })
+  // ⚠️ **UN CONTEXTE VIDE REND QUATRE `undefined`, PAS UN OBJET VIDE** : c'est
+  // ce qui rend `Object.is` capable de dire « rien n'a changé ».
+  assert.deepEqual(formeDuCrop(null), { half: undefined, corner: undefined, expo: undefined, fractionProfondeur: undefined })
+  assert.deepEqual(CHAMPS_FORME, ['half', 'corner', 'expo', 'fractionProfondeur'])
+})
+
+test('⑧d `formeDifferente` compare par `Object.is`, champ par champ', () => {
+  const a = { half: 28, corner: 2.24, expo: 4.4, fractionProfondeur: 0.125 }
+  assert.equal(formeDifferente(null, a), true, 'rien de posé : tout diffère')
+  assert.equal(formeDifferente(a, { ...a }), false)
+  for (const champ of CHAMPS_FORME) {
+    assert.equal(formeDifferente(a, { ...a, [champ]: 9 }), true, `${champ} doit être surveillé`)
+  }
+  // ⚠️ **UN `NaN` DIFFÈRE DE LUI-MÊME SOUS `==` MAIS PAS SOUS `Object.is`** —
+  // même contrat qu'`habillageDifferent`, et pour la même raison.
+  assert.equal(formeDifferente({ ...a, corner: NaN }, { ...a, corner: NaN }), false)
+  assert.equal(formeDifferente(a, { ...a, corner: NaN }), true)
+})
+
+test('⑧e un changement de forme rejoue la DÉCOUPE ET LES PAROIS, et RIEN d autre', async () => {
+  const g = globeFactice()
+  let forme = { half: 28, corner: 2.24, expo: 4.4 }
+  const ctx = () => ({ ...contexteFactice()(), forme, parois: { fractionProfondeur: 0.125 } })
+  const veille = creerVeilleCrop({ globe: g, contexte: ctx })
+  veille.maj(20_000)
+  await veille.enVol()
+  assert.equal(veille.reformages, 0)
+  const avant = g.journal.length
+  // même forme : RIEN ne se rejoue
+  veille.maj(20_000)
+  assert.equal(g.journal.length, avant, 'une forme inchangée ne doit rien rejouer')
+  assert.equal(veille.reformages, 0)
+  // la tirette bouge
+  forme = { half: 28, corner: 11.2, expo: 2 }
+  veille.maj(20_000)
+  assert.equal(veille.reformages, 1)
+  const rejoues = g.journal.slice(avant).map((e) => e.quoi)
+  // ⚠️ **DEUX MAILLONS, PAS SIX** : la mer suit par l'uniforme PARTAGÉ
+  // `uCropCoin`, et la rampe se remesure au prochain déplacement. Rejouer la
+  // chaîne entière coûterait un champ de 385² par image de glissement.
+  assert.deepEqual(rejoues, ['crop', 'parois'])
+  assert.equal(g.journal[g.journal.length - 2].arg.corner, 11.2)
+  // et la profondeur est surveillée AUSSI — elle vit dans l'autre sous-objet
+  const avant2 = g.journal.length
+  veille.maj(20_000)
+  assert.equal(g.journal.length, avant2, 'la forme est posée : plus rien à rejouer')
+})
+
+test('⑧f la PROFONDEUR entre dans la même veille que le coin', async () => {
+  const g = globeFactice()
+  let fraction = 0.125
+  const ctx = () => ({
+    ...contexteFactice()(),
+    forme: { half: 28, corner: 2.24, expo: 4.4 },
+    parois: { fractionProfondeur: fraction },
+  })
+  const veille = creerVeilleCrop({ globe: g, contexte: ctx })
+  veille.maj(20_000)
+  await veille.enVol()
+  const avant = g.journal.length
+  fraction = 0.375
+  veille.maj(20_000)
+  assert.equal(veille.reformages, 1, 'la profondeur doit déclencher un reformage')
+  assert.deepEqual(g.journal.slice(avant).map((e) => e.quoi), ['crop', 'parois'])
+  assert.equal(g.journal[g.journal.length - 1].arg.fractionProfondeur, 0.375)
+})
+
+test('⑧g un reformage qui voit les parois REFUSER les remet dans la file de reprise', async () => {
+  const g = globeFactice()
+  let forme = { half: 28, corner: 2.24, expo: 4.4 }
+  const ctx = () => ({ ...contexteFactice()(), forme, parois: { fractionProfondeur: 0.125 } })
+  const veille = creerVeilleCrop({ globe: g, contexte: ctx, periodeReprise: 2 })
+  veille.maj(20_000)
+  await veille.enVol()
+  assert.deepEqual(veille.refus, [], 'témoin : rien ne refuse au départ')
+  g.refuse.parois = true
+  forme = { half: 28, corner: 11.2, expo: 2 }
+  veille.maj(20_000)
+  // ⚠️ **UN REFUS PENDANT UN REFORMAGE N'EST PAS PERDU** : sans cette ligne, le
+  // bloc garderait une surface arrondie et un flanc carré jusqu'au prochain
+  // déplacement — deux formes pour un objet, pire que deux carrés.
+  assert.ok(veille.refus.includes('parois'), 'le refus doit rejoindre la file de reprise')
+})
+
+test('⑧h `contexteCrop` de `main.js` remplit les deux sous-objets — lecture de SOURCE', () => {
+  // ⚠️ **AUCUN TEST NE CHARGE `main.js`** (§0 du plan) : ce garde-fou est une
+  // lecture, et il est DÉCLARÉ tel.
+  const i = SRC_MAIN.indexOf('function contexteCrop()')
+  assert.ok(i > 0)
+  const bloc = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n  ctx.rampe =', i))
+  assert.match(bloc, /forme: \{/)
+  assert.match(bloc, /parois: \{/)
+  // ⚠️ **LES UNIFORMES DU SOCLE, PAS `params`** — même règle que pour les dix
+  // curseurs d'Atlas et pour les lampes : `terrain.js` porte l'écrêtage du rayon
+  // et `exposantCoin`, que `params` ne porte pas.
+  assert.match(bloc, /terrain\.mapUniforms\.uSlabCorner/)
+  assert.match(bloc, /terrain\.mapUniforms\.uSlabCornerN/)
+  assert.match(bloc, /plinth\.depth/)
+  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER UNE FORMULE** — la
+  // Tâche K ter a eu une mutation survivante parce qu'une assertion lisait une
+  // formule dans un pavé de prose. Ici le pavé NOMME `params.plinthDepth` pour
+  // dire précisément qu'on ne s'en sert pas.
+  const code = bloc.replace(/\/\/[^\n]*/g, '')
+  assert.ok(!/params\.slabCorner/.test(code), 'la forme ne doit pas passer par params')
+  assert.ok(!/params\.plinthDepth/.test(code), 'la profondeur ne doit pas passer par params')
+  assert.match(code, /terrain\.mapUniforms\.uSlabCorner/, 'le témoin : le code lui-même porte bien la lecture')
+})
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
index e2bfa1c..730bc52 100644
--- a/test/crop-eclairage.test.js
+++ b/test/crop-eclairage.test.js
@@ -46,20 +46,22 @@ import {
   eclairerCrop,
   hautLocal,
   directionSoleilLocale,
   irradianceAmbiante,
   GLSL_ECLAIRAGE,
   GLSL_OMBRE_PEINTURE,
 } from '../src/monde/eclairage-crop.js'
 import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
 import { LUMA_709 } from '../src/monde/naturel-crop.js'
 import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
+// ⚠️ **Tache P6** : le morceau d irradiance DETACHE, pour les parois.
+import { GLSL_IRRADIANCE } from '../src/monde/eclairage-crop.js'
 
 // ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
 // appelle `document.createElement('canvas')` au constructeur. C'est le patron de
 // `test/loi-texture-monde.test.js` et de `test/damier-cadre.test.js`.
 globalThis.document = {
   createElement: () => ({
     width: 0,
     height: 0,
     getContext: () => ({
       createLinearGradient: () => ({ addColorStop() {} }),
@@ -750,10 +752,85 @@ test('⑤g les défauts MONDE sont ceux des modules, pas des nombres recopiés',
   assert.equal(u.uSurfaceFx.value, APPARENCE_MONDE.surfaceFx)
   assert.equal(u.uFxOpacite.value, APPARENCE_MONDE.fxOpacity)
   assert.equal(u.uFxDemiBloc.value, APPARENCE_MONDE.fxDemiBloc)
   // ⚠️ et le défaut de l'apparence est ÉTEINT : sans lui, toutes les tuiles du
   // globe — y compris celles qui ne verront jamais de crop — porteraient un
   // motif de bloc.
   assert.equal(APPARENCE_MONDE.surfaceFx, 0)
   assert.equal(APPARENCE_MONDE.fxOpacity, 0)
   assert.equal(ECLAIRAGE_MONDE.albedoTeinte, 1)
 })
+
+// ══════════ ⑥ LES PAROIS SONT ÉCLAIRÉES COMME LES TUILES — Tâche P6 ════════
+//
+// ⛔ **P3 A ÉCLAIRÉ LES TUILES ET A LAISSÉ LES PAROIS SUR LE SOLEIL DE LA
+// PLANÈTE, C'EST-À-DIRE SUR LA CAMÉRA.** Elle l'écrit noir sur blanc pour les
+// tuiles — *« uSunDir n'est pas le soleil de la scène : en mode surface,
+// main.js le repose À CHAQUE IMAGE sur camGlobe.position tournée de 42 degrés »*
+// — et n'a pas refait le geste sur `_materiauParois`. Relevé le 2026-08-22 au
+// même instant dans la même page : `uSunDir = (0,2305 · −0,3687 · 0,9005)`,
+// **sous l'horizon**, contre `(0,4392 · 0,5629 · −0,7001)` pour le soleil de la
+// scène, et `uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil
+// laisse à `day ≈ 0` rendait donc **exactement `uShadowColor`** : c'est le grand
+// aplat beige de la réserve n° 1 de P5, et ce n'était pas une paroi éclairée.
+//
+// ⚠️ **CES SIX TESTS SONT NÉS D'UNE CAMPAGNE DE MUTATION.** Premier tour de P6 :
+// **60 / 72**, et CINQ des onze survivantes visaient ce seul nuanceur — il
+// n'était gardé par rien du tout. On EXÉCUTE ce qui s'exécute (l'identité des
+// uniformes partagés) et on DÉCLARE ce qui ne s'exécute pas (le texte GLSL).
+
+test('⑥a `_materiauParois` PARTAGE les uniformes du bloc — pas des copies', () => {
+  const g = new Globe({ radius: 100 })
+  const m = g._materiauParois()
+  // ⚠️ **PARTAGÉS, ET C'EST CE QUI FAIT QUE LA TIRETTE D'HEURE LES DÉPLACE.**
+  // `poserHabillage` écrit dans `this.uniforms` ; les parois ne sont rebâties
+  // qu'à l'arrêt. Des copies figeraient leur soleil à la naissance du bloc.
+  for (const nom of ['uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uCielIrr', 'uSolIrr', 'uEclairageOn']) {
+    assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit être PARTAGÉ avec les tuiles`)
+  }
+  // les trois d'avant P6 le restent — le repli de planète existe encore
+  for (const nom of ['uSunDir', 'uShadowColor']) {
+    assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit rester partagé`)
+  }
+  assert.equal(m.uniforms.uCol, g.uniforms.uParoiCouleur, 'la couleur de paroi vit dans this.uniforms')
+  // ⚠️ **LE TÉMOIN** : un uniforme qui n'a rien à faire là ne doit PAS être
+  // partagé, sinon la boucle ci-dessus passerait sur n'importe quel matériau.
+  assert.equal(m.uniforms.uRamp, undefined)
+})
+
+test('⑥b le nuanceur des parois porte la loi d IRRADIANCE, et son albédo est couleur × occlusion', () => {
+  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE TELLE** : ce nuanceur ne se compile pas
+  // sous node. Ce qu'elle garde est la STRUCTURE de la loi, pas une valeur.
+  const i = GLOBE_SRC.indexOf('_materiauParois() {')
+  assert.ok(i > 0, '_materiauParois doit rester lisible')
+  const bloc = GLOBE_SRC.slice(i, GLOBE_SRC.indexOf('\n  /**', i)).replace(/\/\/[^\n]*/g, '')
+  // l'albédo : la couleur de paroi FOIS l'occlusion de contact par sommet —
+  // c'est ce que le socle fait avec `material.color` et son attribut `color`.
+  assert.match(bloc, /vec3 colBloc = uCol \* vAo/)
+  // l'irradiance : la MÊME fonction que les tuiles, avec les MÊMES cinq entrées
+  assert.match(bloc, /irradianceCrop\(dot\(N, uSoleilDir\), dot\(N, uHemiHaut\), uSoleilIrr, uCielIrr, uSolIrr\)/)
+  // …et son 1 / π, interpolé depuis le module et non écrit à la main
+  assert.match(bloc, /\* \$\{RECIPROQUE_PI\};/)
+  // ⛔ **ET LE TERMINATEUR NE FRANCHIT PAS LA FRONTIÈRE DU BLOC** — P3 le dit
+  // déjà pour les tuiles : « le socle n'a pas de nuit, c'est un objet de studio ».
+  assert.match(bloc, /gl_FragColor = vec4\(uEclairageOn > 0\.5 \? colBloc : colPlanete, 1\.0\);/)
+  // le repli de planète reste, AU BIT PRÈS : c'est lui qu'un globe sans crop rend
+  assert.match(bloc, /vec3 colPlanete = uCol \* \(0\.74 \+ 0\.30 \* diff\) \* vAo;/)
+  assert.match(bloc, /colPlanete = mix\(uShadowColor, colPlanete, 0\.10 \+ 0\.90 \* day\);/)
+})
+
+test('⑥c `GLSL_IRRADIANCE` est INJECTÉ dans `GLSL_ECLAIRAGE`, jamais réécrit', () => {
+  // ⛔ **DEUX ÉCRITURES DE LA MÊME LOI, C'EST LA FAUTE QUE D13 §③ NOMME**, et ce
+  // chantier l'a déjà payée sur `blLum`, sur l'écume et sur `chopLook`. Le
+  // morceau est détaché parce que le nuanceur des parois est NU — ni rampe, ni
+  // peinture, donc pas de `natLuminance` dont `GLSL_ECLAIRAGE` dépend.
+  const src = readFileSync(new URL('../src/monde/eclairage-crop.js', import.meta.url), 'utf8')
+  assert.match(src, /\$\{GLSL_IRRADIANCE\}\nvec3 eclairerCrop/)
+  // une seule écriture du corps, dans le morceau détaché
+  const nCorps = (src.match(/soleil \* max\(ndl, 0\.0\) \+ mix\(sol, ciel, 0\.5 \* ndu \+ 0\.5\)/g) || []).length
+  assert.equal(nCorps, 1, `la loi doit être écrite UNE fois, pas ${nCorps}`)
+  // …et le texte assemblé la porte quand même
+  assert.match(GLSL_ECLAIRAGE, /vec3 irradianceCrop\(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol\)/)
+  // ⚠️ **ET LE GLOBE INJECTE LE MORCEAU DÉTACHÉ DANS LES PAROIS**, une fois.
+  assert.equal((GLOBE_NU.match(/\$\{GLSL_IRRADIANCE\}/g) || []).length, 1)
+  assert.match(GLOBE_NU, /GLSL_IRRADIANCE,/)
+})
diff --git a/test/ecume-mer.test.js b/test/ecume-mer.test.js
index 8672b0a..80aa5f3 100644
--- a/test/ecume-mer.test.js
+++ b/test/ecume-mer.test.js
@@ -39,20 +39,36 @@ import {
   ecumeMoutons,
   largeurRessac,
   frontsRessac,
   ecumeRessac,
   ecumeLisere,
   ecumeMer,
   GLSL_ECUME,
   // ⚠️ **Tâche P5** : l'état de mer, LU sur le socle et jamais recalculé.
   ETAT_MER_NEUTRE,
   etatMerDuSocle,
+  // ⚠️ **Tâche P6** : la LAME D'EAU — quatre réglages de plus, même patron.
+  GLSL_LAME_EAU,
+  LAME_EAU_NEUTRE,
+  lameEauDuSocle,
+  detailClapot,
+  poidsLagon,
+  opaciteEau,
+  LAGON_FIN,
+  LAGON_EXPO,
+  OPACITE_EAU,
+  TIRETTE_EAU,
+  OPACITE_ECRETAGE,
+  NUIT_EAU,
+  NUIT_ECUME,
+  CLAPOT_NORMALE,
+  GLINT_TAVELURE,
 } from '../src/monde/ecume-mer.js'
 import {
   construireJupeMer,
   GLSL_JUPE_MER,
   RETRAIT_EAU_CROP,
   bordDeMer,
   PORTEE_CROP,
 } from '../src/monde/mer-sphere.js'
 import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
 
@@ -101,21 +117,29 @@ test('①b le POIDS de la profondeur et les deux fins de rampe sortent d ocean.j
   // n'est pas de la loi d'écume, et l'y ranger l'aurait rendu muet.
   assert.match(s, /float fadeLift = smoothstep\(0\.0, 0\.55, shoreD\);/)
 })
 
 test('①c les poids, le blanc et la tavelure remontent à ocean.js', () => {
   const s = ocean()
   // les trois constantes que le brief accusait — et elles n'ont JAMAIS divergé
   assert.equal(POIDS_RESSAC, 1.8)
   assert.equal(POIDS_LISERE, 1.1)
   assert.equal(BLANC_ECUME, 0.96)
-  assert.match(s, /col = mix\(col, vec3\(0\.96\) \* mix\(0\.14, 1\.0, uDayLight\), foam\)/)
+  // ⚠️ **LE BLANCHIMENT A DÉMÉNAGÉ DANS LE MODULE — Tâche P6.** `ocean.js`
+  // portait `mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam)` et le
+  // globe portait `mix(col, vec3(0.96), ecume)` : la MÊME loi, amputée de sa
+  // nuit d'un côté. Elle vit maintenant une seule fois, dans `GLSL_LAME_EAU`,
+  // et les deux fichiers l'APPELLENT.
+  assert.match(GLSL_LAME_EAU, /mix\(col, vec3\(0\.96\) \* mix\(0\.14, 1\.0, jour\), ecume\)/)
+  assert.match(s, /col = blanchirEcume\(col, foam, uDayLight\);/)
+  assert.ok(!/vec3\(0\.96\) \* mix\(0\.14, 1\.0, uDayLight\), foam\)/.test(s),
+    'ocean.js ne doit plus porter sa propre ecriture du blanchiment')
   assert.equal(FREQ_TAVELURE, 0.33)
   assert.equal(TAVELURE_SEUIL.bas, 0.32)
   assert.equal(TAVELURE_SEUIL.haut, 0.72)
   // la tavelure d'ocean.js est indexée sur `xz`, EN UNITÉS DE SOCLE
   // ⚠️ **LA FRÉQUENCE EST INTERPOLÉE DEPUIS LE MODULE, PAS ÉCRITE** : la source
   // porte `${FREQ_TAVELURE}`, ce qui est précisément ce qu'on veut garder — une
   // campagne de mutation de P2 a survécu parce que ses motifs cherchaient un
   // chiffre dans un texte qui portait un gabarit.
   assert.match(s, /float patchy = tavelureMer\(vnoise\(xz \* \$\{FREQ_TAVELURE\} \+ vec2\(uTime \* 0\.015, -uTime \* 0\.011\)\)\)/)
   assert.match(s, /vec2 xz = vWorld\.xz;/)
@@ -210,28 +234,33 @@ function traduire(glsl, nom, params) {
   const corps = new RegExp(`float ${nom}\\(([\\s\\S]*?)\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(glsl)
   assert.ok(corps, `fonction ${nom} introuvable dans le GLSL`)
   const js = corps[2]
     .replace(/\bfloat\b/g, 'let')
     .replace(/\bsmoothstep\(/g, 'SS(')
     .replace(/\bclamp\(/g, 'CL(')
     .replace(/\bmix\(/g, 'MIX(')
     .replace(/\bmax\(/g, 'Math.max(')
     .replace(/\bmin\(/g, 'Math.min(')
     .replace(/\bsin\(/g, 'Math.sin(')
+    // ⚠️ **Tâche P6** : `pow` et `poidsLagonEau` entrent dans le traducteur —
+    // sans eux `opaciteEau` ne se traduit pas, et un test qui ne tourne pas ne
+    // garde rien.
+    .replace(/\bpow\(/g, 'Math.pow(')
     .replace(/\blargeurRessacMer\(/g, 'largeurRessacMer(')
   const SS = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x) }
   const CL = (v, a, b) => Math.min(b, Math.max(a, v))
   const MIX = (a, b, t) => a + (b - a) * t
   const largeurRessacMer = (f) => (1 - SS(0.1, 0.75, f)) * SS(0.002, 0.03, f)
+  const poidsLagonEau = (t) => SS(0, LAGON_FIN, t)
   // eslint-disable-next-line no-new-func
-  const f = new Function('SS', 'CL', 'MIX', 'largeurRessacMer', ...params, js)
-  return (...args) => f(SS, CL, MIX, largeurRessacMer, ...args)
+  const f = new Function('SS', 'CL', 'MIX', 'largeurRessacMer', 'poidsLagonEau', ...params, js)
+  return (...args) => f(SS, CL, MIX, largeurRessacMer, poidsLagonEau, ...args)
 }
 
 test('②a le GLSL `declinRivageMer` calcule ce que le jumeau JS calcule', () => {
   const g = traduire(GLSL_ECUME, 'declinRivageMer', ['profondeur', 'distance'])
   let n = 0
   for (let p = 0; p <= 2; p += 0.05) {
     for (let d = 0; d <= 1; d += 0.02) {
       assert.ok(Math.abs(g(p, d) - declinRivage(p, d)) < 1e-12, `${p} ${d}`)
       n++
     }
@@ -330,26 +359,33 @@ test('③b les deux fichiers INJECTENT le texte partagé, ils ne le recopient pa
   const o = ocean()
   const g = globe()
   // ⚠️ **LA LISTE EXACTE N'EST PLUS EXIGÉE, LES NOMS LE SONT — Tâche P5.**
   // Cette assertion cassait à chaque nom ajouté au module sans rien prouver de
   // plus : ce qui compte est qu'il n'y ait qu'UNE importation, et qu'elle porte
   // ce dont chaque fichier se sert.
   const importOcean = o.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
   const importGlobe = g.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
   assert.ok(importOcean, "ocean.js doit importer monde/ecume-mer.js")
   assert.ok(importGlobe, "globe.js doit importer monde/ecume-mer.js")
-  for (const nom of ['GLSL_ECUME', 'FREQ_TAVELURE', 'accalmieDuSocle', 'etatMerDuSocle']) {
+  for (const nom of ['GLSL_ECUME', 'GLSL_LAME_EAU', 'FREQ_TAVELURE', 'accalmieDuSocle', 'etatMerDuSocle', 'lameEauDuSocle']) {
     assert.ok(importOcean[1].includes(nom), `ocean.js doit importer ${nom}`)
   }
-  for (const nom of ['GLSL_ECUME', 'FREQ_TAVELURE', 'BLANC_ECUME', 'ACCALMIE_NEUTRE', 'ETAT_MER_NEUTRE']) {
+  for (const nom of ['GLSL_ECUME', 'GLSL_LAME_EAU', 'FREQ_TAVELURE', 'ACCALMIE_NEUTRE', 'ETAT_MER_NEUTRE', 'LAME_EAU_NEUTRE', 'CLAPOT_NORMALE']) {
     assert.ok(importGlobe[1].includes(nom), `globe.js doit importer ${nom}`)
   }
+  // ⚠️ **UNE SEULE ÉCRITURE DE LA LAME D'EAU, ET ELLE EST INJECTÉE DES DEUX
+  // CÔTÉS — Tâche P6.** Le texte vit dans `GLSL_LAME_EAU` ; `ocean.js` et
+  // `globe.js` l'interpolent une fois chacun, dans leur fragment de mer.
+  assert.equal((o.match(/\$\{GLSL_LAME_EAU\}/g) || []).length, 1,
+    'ocean.js doit injecter GLSL_LAME_EAU une fois')
+  assert.equal((g.match(/\$\{GLSL_LAME_EAU\}/g) || []).length, 1,
+    'globe.js doit injecter GLSL_LAME_EAU une fois')
   // injecté dans les DEUX nuanceurs de chaque fichier
   // ⚠️ **TROIS, ET LE TROISIÈME EST LE VERTEX DE LA JUPE DU SOCLE** : il portait
   // lui aussi sa propre copie du déclin côtier (`max((uWaterY − f.r) * 2.0, f.g)`
   // et `smoothstep(0.0, 0.10, shoreD)`). ③a l'a trouvée — trois écritures, pas
   // deux. C'est la neuvième constante muette de ce chantier.
   assert.equal((o.match(/\$\{GLSL_ECUME\}/g) || []).length, 3,
     'ocean.js doit injecter dans son vertex, son fragment ET le vertex de sa jupe')
   assert.equal((g.match(/\$\{GLSL_ECUME\}/g) || []).length, 2, 'globe.js doit injecter dans MER_VERT ET MER_FRAG')
   assert.equal((o.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
   assert.equal((g.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
@@ -646,10 +682,301 @@ test('⑦e `ocean.js` REMONTE son état de mer par `reglagesMer`, et par lui seu
 test('⑦f `majReglagesMer` est le SEUL écrivain des six uniformes d état de mer', () => {
   // ⚠️ **DEUX ÉCRIVAINS POUR UNE GRANDEUR, C EST LA FAUTE QUE D13 §③ NOMME**, et
   // ce chantier l'a payée sur `hNorm`, sur `uMerUnite` et sur le déclin côtier.
   // Chaque uniforme n'est ASSIGNÉ qu'une fois hors de sa déclaration.
   const g = sansCommentaires(globe())
   for (const uni of ['uMerHoule', 'uMerChop', 'uMerEcume', 'uMerEcumeEchelle', 'uMerBrillance', 'uMerVitesse']) {
     const ecritures = (g.match(new RegExp(`u\\.${uni}\\.value = `, 'g')) || []).length
     assert.equal(ecritures, 1, `${uni} doit avoir UN seul écrivain, pas ${ecritures}`)
   }
 })
+
+// ══════════ ⑧ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ══════════════
+//
+// ⛔ **QUATRE RÉGLAGES QUI N'AVAIENT AUCUN PARAMÈTRE POUR ARRIVER.** P5 avait
+// mesuré le symptôme — *« la concentration de luminance vaut 80,97 % côté crop
+// contre 30,33 % au socle […] presque tout l'écart vit dans la NAPPE »* — et
+// écrit qu'elle ne l'attribuait pas. Relevé le 2026-08-22 au même instant dans
+// la même page : `uTransp = 0,57`, `uSunFx = 0,72`, `uDetail = 0,75`,
+// `uDayLight = 1`. **Le nuanceur de la calotte n'en portait pas un seul.**
+//
+// ⚠️ **ET LE NEUTRE N'EST PAS « LA CALOTTE D'AVANT », PARCE QU'IL NE PEUT PAS
+// L'ÊTRE** : le nuanceur d'avant portait `mix(0,45 ; 0,95)` SANS le facteur de
+// tirette (donc `transparence ≈ 0,1685`) ET le glacis de lagon à plein régime
+// (donc `transparence ≥ 0,35`). ⑧d le démontre au lieu de l'affirmer.
+
+test('⑧a `lameEauDuSocle` LIT les quatre uniformes vivants', () => {
+  assert.deepEqual(lameEauDuSocle({
+    uTransp: { value: 0.57 }, uSunFx: { value: 0.72 },
+    uDayLight: { value: 0.31 }, uDetail: { value: 0.75 },
+  }), { transparence: 0.57, soleilFx: 0.72, jour: 0.31, detail: 0.75 })
+})
+
+test('⑧b sans socle à lire, `lameEauDuSocle` rend le NEUTRE d ocean.js', () => {
+  for (const rien of [null, undefined, {}]) {
+    assert.deepEqual(lameEauDuSocle(rien), LAME_EAU_NEUTRE)
+  }
+  // ⚠️ **LES QUATRE NEUTRES REMONTENT À `ocean.js` RELU SUR LE DISQUE**, pas à
+  // des littéraux recopiés ici : c'est la discipline du §0 du plan.
+  const s = ocean()
+  assert.match(s, /uTransp: \{ value: params\.waterTransparency \?\? 0\.4 \}/)
+  assert.match(s, /uSunFx: \{ value: params\.waterSunFx \?\? 1 \}/)
+  assert.match(s, /uDayLight: \{ value: 1 \}/)
+  assert.equal(LAME_EAU_NEUTRE.transparence, 0.4)
+  assert.equal(LAME_EAU_NEUTRE.soleilFx, 1)
+  assert.equal(LAME_EAU_NEUTRE.jour, 1)
+  // le detail est `chopLook(seaChop ?? 0.7).detail`, re-dérivé depuis la SOURCE
+  const m = /function chopLook\(c\) \{\s*\n?\s*return \{ detail: ([\d.]+) \+ ([\d.]+) \* c,/.exec(s)
+  assert.ok(m, 'chopLook doit rester lisible dans ocean.js')
+  assert.equal(LAME_EAU_NEUTRE.detail, Number(m[1]) + Number(m[2]) * 0.7)
+  assert.equal(detailClapot(0.7), LAME_EAU_NEUTRE.detail)
+  assert.match(s, /uDetail: \{ value: look\.detail \}/)
+})
+
+test('⑧c un uniforme absent ou NaN rend SA valeur neutre, jamais celle du voisin', () => {
+  // même piège que ⑦c : une lecture qui retomberait EN BLOC sur le neutre dès
+  // qu'un seul uniforme manque jetterait trois valeurs justes.
+  const noms = { transparence: 'uTransp', soleilFx: 'uSunFx', jour: 'uDayLight', detail: 'uDetail' }
+  for (const [champ, uni] of Object.entries(noms)) {
+    const seul = lameEauDuSocle({ [uni]: { value: 0.123456 } })
+    assert.equal(seul[champ], 0.123456, `${uni} n atteint pas ${champ}`)
+    for (const [autre, v] of Object.entries(LAME_EAU_NEUTRE)) {
+      if (autre === champ) continue
+      assert.equal(seul[autre], v, `${uni} a débordé sur ${autre}`)
+    }
+    assert.equal(lameEauDuSocle({ [uni]: { value: NaN } })[champ], LAME_EAU_NEUTRE[champ])
+    assert.equal(lameEauDuSocle({ [uni]: {} })[champ], LAME_EAU_NEUTRE[champ])
+  }
+})
+
+test('⑧d AUCUNE transparence ne reproduit le nuanceur d avant — la loi était TRONQUÉE', () => {
+  // ⛔ **CE TEST EST LA JUSTIFICATION DU NEUTRE, ET IL EST EXÉCUTÉ.** Le
+  // nuanceur d'avant P6 portait DEUX choses incompatibles :
+  //   · une opacité `mix(0.45, 0.95, pow(d, 0.55))` SANS facteur de tirette,
+  //     ce qui exige `mix(1.15, 0.26, t) = 1`, donc `t = 0,15 / 0,89` ;
+  //   · un corps `mix(peu, fond, pow(d, 0.7))` SANS glacis, c'est-à-dire
+  //     `poidsLagon(t) = 1`, donc `t >= 0,35`.
+  const tOpacite = (TIRETTE_EAU.opaque - 1) / (TIRETTE_EAU.opaque - TIRETTE_EAU.clair)
+  assert.ok(tOpacite < LAGON_FIN, `${tOpacite} devrait etre sous le seuil de lagon ${LAGON_FIN}`)
+  assert.ok(poidsLagon(tOpacite) < 1, 'les deux exigences se contredisent')
+  // et à la transparence vivante du socle, la lame est bien MOINS opaque
+  const brute = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(0.5, OPACITE_EAU.expo)
+  const vivante = opaciteEau(0.5, 0.57, 0)
+  assert.ok(vivante < brute, `${vivante} devrait etre sous ${brute}`)
+  // le rapport mesuré : mix(1.15, 0.26, 0.57) = 0,6427
+  const facteur = TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * 0.57
+  assert.ok(Math.abs(facteur - 0.6427) < 1e-4, `${facteur}`)
+  assert.ok(Math.abs(vivante / brute - facteur) < 1e-12, 'a lagon plein le rapport EST le facteur de tirette')
+})
+
+test('⑧e `opaciteEau` est bornée, monotone en profondeur, et le lagon ferme la marche', () => {
+  let n = 0
+  for (let t = 0; t <= 1.0001; t += 0.01) {
+    let precedent = -1
+    for (let d = 0; d <= 1.0001; d += 0.01) {
+      const w = opaciteEau(d, t, 0)
+      assert.ok(w >= 0 && w <= 1, `w=${w} hors [0,1] a t=${t} d=${d}`)
+      assert.ok(w >= precedent - 1e-12, `non monotone a t=${t} d=${d}`)
+      precedent = w
+      n++
+    }
+  }
+  assert.ok(n > 10000, `${n} points seulement`)
+  // transparence NULLE : peinture pleine, l'eau est opaque partout
+  for (const d of [0, 0.3, 0.7, 1]) assert.equal(opaciteEau(d, 0, 0), 1)
+  // le plancher de Fresnel remonte l'opacité, et il tombe APRÈS l'écrêtage
+  assert.ok(opaciteEau(0, 1, 1) > opaciteEau(0, 1, 0))
+})
+
+test('⑧f le GLSL de la lame d eau suit ses jumeaux JS, point par point', () => {
+  const gl = traduire(GLSL_LAME_EAU, 'poidsLagonEau', ['transparence'])
+  const go = traduire(GLSL_LAME_EAU, 'opaciteEau', ['dLagon', 'transparence', 'fresnel'])
+  let n = 0
+  for (let t = 0; t <= 1.0001; t += 0.02) {
+    assert.ok(Math.abs(gl(t) - poidsLagon(t)) < 1e-12, `lagon ${t}`)
+    for (let d = 0; d <= 1.0001; d += 0.05) {
+      for (const f of [0, 0.25, 0.5]) {
+        assert.ok(Math.abs(go(d, t, f) - opaciteEau(d, t, f)) < 1e-12, `opacite ${d} ${t} ${f}`)
+        n++
+      }
+    }
+  }
+  assert.ok(n > 3000, `${n} points seulement`)
+})
+
+test('⑧g les lois de `GLSL_LAME_EAU` sont INTERPOLÉES, jamais réécrites', () => {
+  // ⚠️ **LES MOTIFS VISENT LES NOMS, PAS LES CHIFFRES** — la leçon d'une
+  // mutation survivante de P2 : ses motifs cherchaient `0.35` dans un texte qui
+  // portait `${PART_OMBRAGE.toFixed(2)}`.
+  const src = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')
+  for (const nom of ['LAGON_FIN', 'LAGON_EXPO', 'OPACITE_EAU', 'TIRETTE_EAU', 'OPACITE_ECRETAGE', 'NUIT_EAU', 'NUIT_ECUME', 'CLAPOT_NORMALE', 'GLINT_TAVELURE', 'BLANC_ECUME']) {
+    assert.ok(new RegExp(`\\$\\{${nom}`).test(src), `${nom} doit être interpolé dans le GLSL`)
+  }
+  // et les valeurs elles-mêmes sont celles d'ocean.js
+  assert.equal(LAGON_FIN, 0.35)
+  assert.equal(LAGON_EXPO, 0.7)
+  assert.deepEqual(NUIT_EAU, [0.1, 0.16, 0.3])
+  assert.equal(NUIT_ECUME, 0.14)
+  assert.equal(CLAPOT_NORMALE.gain, 0.6)
+  assert.equal(CLAPOT_NORMALE.haut, 0.9)
+  assert.equal(CLAPOT_NORMALE.freq, 6)
+  assert.equal(GLINT_TAVELURE.base, 0.35)
+  assert.equal(GLINT_TAVELURE.gain, 0.85)
+  assert.equal(OPACITE_ECRETAGE.bas, 0.05)
+  assert.equal(OPACITE_ECRETAGE.haut, 0.97)
+  // ⚠️ **ET `ocean.js` NE PORTE PLUS AUCUNE DES CINQ FORMULES.** Une seconde
+  // écriture, même identique aujourd'hui, diverge demain — c'est le motif que ce
+  // fichier existe pour fermer.
+  const o = sansCommentaires(ocean())
+  assert.ok(!/mix\(0\.45, 0\.95, pow\(dRt, 0\.55\)\)/.test(o), 'wOp est encore ecrit dans ocean.js')
+  assert.ok(!/mix\(1\.15, 0\.26, uTransp\)/.test(o), 'le facteur de tirette est encore dans ocean.js')
+  assert.ok(!/smoothstep\(0\.0, 0\.35, uTransp\)/.test(o), 'le poids de lagon est encore dans ocean.js')
+  assert.ok(!/uDetail \* 0\.6 \* uViewCalm/.test(o), 'le clapot de normale est encore dans ocean.js')
+  assert.ok(!/0\.35 \+ 0\.85 \* patchy/.test(o), 'le glint de tavelure est encore dans ocean.js')
+  // …et `ocean.js` les APPELLE toutes
+  const brut = ocean()
+  for (const appel of [
+    /float lagoonW = poidsLagonEau\(uTransp\);/,
+    /vec3 body = corpsEau\(uShallowT, uDeep, dRt, lagoonW, uDayLight\);/,
+    /float wOp = opaciteEau\(dRt, uTransp, fres\);/,
+    /vec3 N = clapotNormale\(vNorm, uDetail, uViewCalm, n1, n2\);/,
+    /col \+= uSunColor \* spec \* uSunFx \* glintTavelureMer\(patchy\);/,
+    /col = blanchirEcume\(col, foam, uDayLight\);/,
+  ]) assert.match(brut, appel)
+})
+
+test('⑧h la calotte du globe APPELLE les mêmes lois, avec les uniformes branchés', () => {
+  const g = sansCommentaires(globe())
+  // ⛔ **LES DEUX FORMULES TRONQUÉES ONT DISPARU DU NUANCEUR DE LA CALOTTE.**
+  assert.ok(!/mix\(uMerPeu, uMerFond, pow\(dLagon, 0\.7\)\)/.test(g), 'le corps tronque est encore la')
+  assert.ok(!/mix\(0\.45, 0\.95, pow\(dLagon, 0\.55\)\)/.test(g), 'l opacite tronquee est encore la')
+  for (const appel of [
+    /vec3 col = corpsEau\(uMerPeu, uMerFond, dLagon, poidsLagonEau\(uMerTransp\), uMerJour\);/,
+    /float opac = opaciteEau\(dLagon, uMerTransp, fres\);/,
+    /vec3 N = clapotNormale\(normalize\(vNormMer\), uMerDetail, uMerCalmeVue, r1, r2\);/,
+    /col = blanchirEcume\(col, ecume, uMerJour\);/,
+    /\* uMerSoleilFx \* vRichesse;/,
+  ]) assert.match(g, appel)
+  // ⚠️ **LE CLAPOT EST INDEXÉ EN UNITÉS DE SOCLE**, converti par `uMerUnite` —
+  // la MÊME monnaie que la tavelure depuis P4, pas une seconde.
+  // ⚠️ **ET LE MOTIF VISE LE NOM, PAS LE CHIFFRE** : la source porte le gabarit
+  // `${CLAPOT_NORMALE.freq…}`, pas `6.0`. Une assertion sur le chiffre ne
+  // rougirait pas si quelqu'un remplaçait l'interpolation par un littéral,
+  // c'est-à-dire par la seconde écriture qu'on interdit.
+  assert.match(g, /vec2 rp = vLocal \/ max\(uMerUnite, 1e-9\) \* \$\{CLAPOT_NORMALE\.freq\.toFixed\(1\)\};/)
+  // ⛔ **ET LE SOLEIL DE LA MER N EST PLUS CELUI DE LA PLANÈTE.** Relevé le
+  // 2026-08-22 : `uSunDir` valait (0,2305 -0,3687 0,9005), SOUS l'horizon,
+  // parce que `main.js` le repose par image sur la CAMÉRA.
+  assert.match(g, /vec3 L = normalize\(uEclairageOn > 0\.5 \? uSoleilDir : uSunDir\);/)
+})
+
+test('⑧i les quatre uniformes de lame ont UN SEUL écrivain — `majReglagesMer`', () => {
+  const g = sansCommentaires(globe())
+  for (const uni of ['uMerTransp', 'uMerSoleilFx', 'uMerJour', 'uMerDetail']) {
+    const n = (g.match(new RegExp(`u\\.${uni}\\.value = `, 'g')) || []).length
+    assert.equal(n, 1, `${uni} doit avoir UN seul écrivain, pas ${n}`)
+  }
+  // …et les deux couleurs de la lame aussi
+  for (const uni of ['uMerPeu', 'uMerFond']) {
+    const n = (g.match(new RegExp(`u\\.${uni}\\.value\\.(copy|set)\\(`, 'g')) || []).length
+    assert.equal(n, 1, `${uni} doit avoir UN seul écrivain, pas ${n}`)
+  }
+})
+
+test('⑧j `ocean.js` REMONTE la lame, les couleurs, le soleil et le spectre', () => {
+  const src = ocean()
+  assert.match(src, /eau: lameEauDuSocle\(u\),/)
+  assert.match(src, /couleurs: couleursEauDuSocle\(u\?\.uShallowT\?\.value \?\? null, u\?\.uDeep\?\.value \?\? null\),/)
+  assert.match(src, /soleilCouleur: u\?\.uSunColor\?\.value \?\? null,/)
+  // ⚠️ **LE SPECTRE PAR RÉFÉRENCE** — c'est ce que `_applySea` fait déjà pour
+  // les matériaux du socle ; la calotte entre dans la même liste de lecteurs.
+  assert.match(src, /spectre: u \? \{ a: u\.uWaveA\?\.value \?\? null, b: u\.uWaveB\?\.value \?\? null \} : null,/)
+  assert.match(src, /mat\.uniforms\.uWaveA\.value = u\.a/)
+  // ⛔ **ET LA COULEUR DU SOLEIL EST BIEN CELLE QU `update` RECOPIE PAR IMAGE**,
+  // pas la lampe lue une seconde fois : une grandeur, un écrivain.
+  assert.match(src, /if \(sun && mat\.uniforms\.uSunColor\) mat\.uniforms\.uSunColor\.value\.copy\(sun\.color\)/)
+})
+
+test('⑧k les trois lois `vec3` de la lame gardent leur STRUCTURE, terme par terme', () => {
+  // ⛔ **SURVIVANTES N° 30 ET 38 DU PREMIER TOUR.** `corpsEau`, `clapotNormale`
+  // et `blanchirEcume` rendent des `vec3` : le traducteur de ⑧f ne prend que
+  // les `float`, et rien ne les gardait. ⚠️ **ASSERTIONS DE SOURCE, DÉCLARÉES
+  // TELLES** — elles gardent la STRUCTURE de la loi ; les VALEURS, elles, sont
+  // gardées par ⑧g, qui les confronte au module.
+  //
+  // ⚠️ **ET LES BORNES SONT INTERPOLÉES DEPUIS LES CONSTANTES DU MODULE, PAS
+  // RECOPIÉES** : `GLSL_LAME_EAU` est le texte RÉSOLU (le gabarit est évalué au
+  // chargement), donc un motif qui porterait `0.7` en dur cesserait de suivre
+  // `LAGON_EXPO`. C'est la leçon de la mutation survivante de P2.
+  const e = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
+  const corps = new RegExp(
+    'vec3 corpsEau\\(vec3 peu, vec3 fond, float dLagon, float lagon, float jour\\) \\{\\s*\\n'
+    + '\\s*vec3 c = mix\\(fond, mix\\(peu, fond, pow\\(dLagon, ' + e(LAGON_EXPO.toFixed(1)) + '\\)\\), lagon\\);\\s*\\n'
+    + '\\s*return c \\* mix\\(vec3\\(' + e(NUIT_EAU[0].toFixed(2)) + ', ' + e(NUIT_EAU[1].toFixed(2)) + ', '
+    + e(NUIT_EAU[2].toFixed(2)) + '\\), vec3\\(1\\.0\\), jour\\);')
+  assert.match(GLSL_LAME_EAU, corps, 'le glacis de lagon doit encadrer le dégradé, et la nuit multiplier le tout')
+  // ⚠️ **LE TÉMOIN QUI DIT QUE CE MOTIF DISTINGUE QUELQUE CHOSE** : privé du
+  // glacis — c'est mot pour mot ce que faisait la survivante n° 30 — il doit
+  // rougir. Sans ce témoin, un motif trop lâche « passerait » sans rien garder.
+  assert.ok(!corps.test(GLSL_LAME_EAU.replace('mix(fond, mix(peu, fond,', 'mix(peu, fond,')),
+    'le motif du corps doit rougir si le glacis disparaît')
+
+  // le clapot porte l'accalmie de vue ET le réglage de clapot — survivante n° 38
+  const clapot = new RegExp(
+    'vec3 clapotNormale\\(vec3 normale, float detail, float calmeVue, float b1, float b2\\) \\{\\s*\\n'
+    + '\\s*return normalize\\(normale \\+ detail \\* ' + e(CLAPOT_NORMALE.gain.toFixed(1))
+    + ' \\* calmeVue \\* vec3\\(b1 - 0\\.5, ' + e(CLAPOT_NORMALE.haut.toFixed(1)) + ', b2 - 0\\.5\\)\\);')
+  assert.match(GLSL_LAME_EAU, clapot, 'le clapot doit porter le réglage ET l accalmie de vue')
+  assert.ok(!clapot.test(GLSL_LAME_EAU.replace(' * calmeVue * vec3(b1', ' * vec3(b1')),
+    'le motif du clapot doit rougir si l accalmie disparaît')
+
+  // l'écume se blanchit VERS un blanc qui tombe la nuit
+  const blanc = new RegExp(
+    'return mix\\(col, vec3\\(' + e(BLANC_ECUME.toFixed(2)) + '\\) \\* mix\\('
+    + e(NUIT_ECUME.toFixed(2)) + ', 1\\.0, jour\\), ecume\\);')
+  assert.match(GLSL_LAME_EAU, blanc)
+  assert.ok(!blanc.test(GLSL_LAME_EAU.replace(' * mix(' + NUIT_ECUME.toFixed(2) + ', 1.0, jour)', '')),
+    'le motif du blanchiment doit rougir si la nuit disparaît')
+})
+
+test('⑧l l ORDRE de `opaciteEau` est celui d ocean.js, et le clamp N EST PAS mort', () => {
+  // ⚠️ **UNE MUTATION DE MON PREMIER TOUR ÉTAIT NEUTRE, ET JE LE DIS PLUTÔT QUE
+  // DE LA COMPTER.** « le plancher de Fresnel tombe AVANT l'écrêtage » —
+  // `max(clamp(x), y)` contre `clamp(max(x, y))` — est mathématiquement
+  // IDENTIQUE tant que `y` reste entre les deux bornes. Or `fresnel` est écrêté
+  // à 0,5 dans les deux nuanceurs, donc `y = fresnel × 0,5 ≤ 0,25`, et
+  // 0,05 ≤ 0,25 ≤ 0,97. **Ce n'était pas un trou de test : la permutation ne
+  // change rien.** Ce test le DÉMONTRE au lieu de l'affirmer.
+  let n = 0
+  for (let d = 0; d <= 1.0001; d += 0.01) {
+    for (let t = 0; t <= 1.0001; t += 0.01) {
+      for (const f of [0, 0.1, 0.25, 0.5]) {
+        const lagon = poidsLagon(t)
+        const brut = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(d, OPACITE_EAU.expo)
+        const x = brut * (TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * t)
+        const y = f * 0.5
+        const ordreA = Math.max(Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, x)), y)
+        const ordreB = Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, Math.max(x, y)))
+        assert.equal(ordreA, ordreB, `les deux ordres divergent a d=${d} t=${t} f=${f}`)
+        assert.ok(Math.abs(opaciteEau(d, t, f) - (1 + (ordreA - 1) * lagon)) < 1e-15)
+        n++
+      }
+    }
+  }
+  assert.ok(n > 40000, `${n} points seulement`)
+  // ⛔ **ET LE CLAMP LUI-MÊME EST INERTE DANS LA PLAGE VISIBLE, C'EST MESURÉ.**
+  // Là où le glacis est plein (`transparence >= 0,35`), le facteur de tirette
+  // vaut au plus 0,8385 et l'opacité brute au plus 0,95 : le produit plafonne à
+  // 0,7966, sous les 0,97 de l'écrêtage haut ; et au plus bas 0,45 × 0,26 =
+  // 0,117, au-dessus des 0,05 de l'écrêtage bas. **Il ne mord que là où
+  // `mix(1, w, lagon)` l'efface.** Dit ici plutôt que découvert par une
+  // survivante de plus.
+  let mord = 0
+  for (let d = 0; d <= 1.0001; d += 0.01) {
+    for (let t = LAGON_FIN; t <= 1.0001; t += 0.01) {
+      const brut = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(d, OPACITE_EAU.expo)
+      const x = brut * (TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * t)
+      if (x > OPACITE_ECRETAGE.haut || x < OPACITE_ECRETAGE.bas) mord++
+    }
+  }
+  assert.equal(mord, 0, 'l ecretage ne doit jamais mordre la ou le glacis est plein')
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index c5b2d31..3b797f3 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -53,25 +53,31 @@ import {
   seuilTraitEauM,
   ECHELLE_HOULE_UNITES,
   echelleHouleM,
   RAMPE_NAUTIQUE,
   abscisseNautique,
   PORTEE_CROP,
   RETRAIT_EAU_CROP,
   FRACTION_BANDE_BORD,
   bordDeMer,
   couleursFondDuSocle,
+  // ⚠️ **Tache P6** : les deux couleurs de la LAME, la meme faute un cran plus haut.
+  couleursEauDuSocle,
   profondeurMaxDuCrop,
 } from '../src/monde/mer-sphere.js'
 // ⚠️ **Tâche P4** : le fondu de rivage n'est plus écrit dans `globe.js`, il est
 // INJECTÉ depuis le module partagé — le test suit donc la valeur à sa source.
-import { FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle, ETAT_MER_NEUTRE, etatMerDuSocle } from '../src/monde/ecume-mer.js'
+import {
+  FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle, ETAT_MER_NEUTRE, etatMerDuSocle,
+  // ⚠️ **Tâche P6** : la lame d'eau, quatre réglages de plus par le même maillon.
+  LAME_EAU_NEUTRE, lameEauDuSocle,
+} from '../src/monde/ecume-mer.js'
 import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
 // ⚠️ L'ALIAS QUE VITE POSE (`vite.config.js`), RÉSOLU SANS VITE — le patron de
 // `test/damier-mer-runtime.test.js` : la copie vendorée fait foi ici, et cinq
 // lignes suffisent. Sans ce hook, `Globe.prototype.poserMer` ne peut être
 // exercée QUE jusqu'à sa clause de refus (`await import('./ocean.js')` lève),
 // ce qui est exactement le trou du Tour de correction 1 (constat I1/F-3) :
 // ~150 lignes de corps de méthode — la dérivation de portée, la cuisson du
 // champ, la construction du maillage — n'étaient exercées par PERSONNE.
 registerHooks({
   resolve(spec, ctx, suivant) {
@@ -80,21 +86,24 @@ registerHooks({
     }
     return suivant(spec, ctx)
   },
 })
 import { Globe } from '../src/globe.js'
 import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
 import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
 import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
 // LA LOI DE SURFACE — Tache J bis : l'epsilon de coplanarite depend de son DEFAUT.
 import { altitudeMaillage } from '../src/monde/fond-crop.js'
-import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
+// ⚠️ **Tâche P6** : `FRACTION_PROFONDEUR` entre ici parce que ⑭h l'exerce — la
+// fraction etait GELEE, et un test qui recopierait `7 / 56` ne rougirait pas si
+// le module changeait sous lui.
+import { repereLocalCrop, construireSolideCrop, FRACTION_PROFONDEUR } from '../src/monde/parois-crop.js'
 import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
 import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES, CIRCONFERENCE_M } from '../src/monde/habillage-crop.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 
 // La Réunion — le crop de toutes les tâches de ce chantier.
 const CENTRE = { lat: -21.115, lon: 55.536 }
 const REPERE = repereCrop({ centre: CENTRE })
 const R_TERRE_M = 6371000 // `EARTH_RADIUS_M` de src/geo.js
@@ -626,21 +635,24 @@ test('⑤c une mer sans terre reste à l infini, une terre pleine reste à zéro
 
 test('⑤d `ocean.js` A CESSÉ de porter sa propre boucle — garde-fou de SOURCE, déclaré', () => {
   // ⚠️ ASSERTION DE SOURCE, DÉCLARÉE : elle ne prouve pas un comportement, elle
   // garde l'UNICITÉ de la loi. `_bakeField` tire three, donc node ne peut pas
   // l'exécuter — c'est la limite de ce fichier, et elle est écrite en tête.
   const src = readFileSync(SRC_OCEAN, 'utf8')
   assert.ok(!/dist\[k - n - 1\]/.test(src), 'la boucle de chanfrein est encore dans ocean.js')
   // ⚠️ **Tâche P4** : l'importation en porte maintenant DEUX — `GLSL_JUPE_MER`
   // est la couleur du rideau d'eau, extraite de `SKIRT_FRAG` pour que le crop
   // lise les mêmes six lignes. Le garde-fou reste le même : une seule écriture.
-  assert.match(src, /import \{ distanceRivage, GLSL_JUPE_MER \} from '\.\/monde\/mer-sphere\.js'/)
+  // ⚠️ **Tâche P6** : elle en porte TROIS — `couleursEauDuSocle` remonte les
+  // deux couleurs de la LAME d'eau, celles que `poserMer` prenait sur son propre
+  // défaut faute d'appelant pour son paramètre `couleurs`.
+  assert.match(src, /import \{ distanceRivage, GLSL_JUPE_MER, couleursEauDuSocle \} from '\.\/monde\/mer-sphere\.js'/)
   assert.ok(!/float alpha = mix\(0\.55, 0\.94, uFrost\)/.test(src),
     'la couleur du rideau est encore ecrite dans ocean.js')
   assert.match(src, /gl_FragColor = couleurJupeMer\(uDeep, uSky, g, uFrost, uDayLight, grain\);/)
 })
 
 // ══════════ ⑥ L'EMPRISE ════════════════════════════════════════════════════
 
 test('⑥a à portée 1, l emprise de la calotte EST celle du socle', () => {
   // ⚠️ ELLE N'EST PAS « À PEU PRÈS » CELLE DU SOCLE : c'est par elle que
   // `remplirHauteurs` va chercher la BATHYMÉTRIE FUSIONNÉE, et une emprise
@@ -1018,27 +1030,38 @@ function globeAvecCrop(overrides = {}) {
       // discipline que le reste de ce bâtisseur : ce que la méthode exerce, il
       // le porte pour de vrai.
       uPlancherRampeM: val(0),
       uOceanShallow: val(couleurBouchon(RAMPE_NAUTIQUE.peu)),
       uOceanMid: val(couleurBouchon(RAMPE_NAUTIQUE.moyen)),
       uOceanDeep: val(couleurBouchon(RAMPE_NAUTIQUE.fond)),
       // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
       // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
       uEstompageOn: val(0),
       uEstompage: val(1),
+      // ⚠️ **Tâche P6, ET C'EST LA MÊME DISCIPLINE** : ce que la méthode
+      // exerce, ce bâtisseur le porte pour de vrai. `poserMer` PARTAGE
+      // désormais le soleil du bloc et son interrupteur avec les tuiles ; et
+      // `poserCrop` écrit les trois uniformes de la découpe.
+      uSoleilDir: val({ x: 0, y: 1, z: 0 }),
+      uEclairageOn: val(0),
+      uCropCentre: val({ x: 0, y: 0, set(a, b) { this.x = a; this.y = b } }),
+      uCropDemi: val(1),
+      uCropOn: val(0),
     },
     _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
     retirerMer: Globe.prototype.retirerMer,
     _cuireChampMer: Globe.prototype._cuireChampMer,
     _majBordMer: Globe.prototype._majBordMer,
     _melangeCalottes() {},
+    _melangeCrop() {},
     _calottes: [],
+    tiles: new Map(),
     ...overrides,
   }
 }
 
 // un fond marin de synthèse, uniformément à −500 m : ces tests n'ont rien à
 // prouver sur la bathymétrie (§3 de la tâche, déjà couvert ailleurs),
 // seulement sur ce que `poserMer` FAIT du résultat de `remplir`.
 const remplirBouchon = (emprise, n, sortie) => {
   sortie.fill(-500)
   return { remplis: sortie.length }
@@ -1313,20 +1336,28 @@ test('⑫a `majReglagesMer` pose les DEUX accalmies, le givre et le ciel', () =>
     assert.equal(u.uMerCalmeSurf.value, 0.08, 'la seconde accalmie doit être posée AUSSI')
     assert.equal(u.uMerGivre.value, 0.56, 'le givre du socle de verre doit être posé')
     assert.equal(cible.recu, ciel, 'le ciel doit être COPIÉ, pas remplacé')
     assert.deepEqual(pose, {
       vue: 0.4039, surface: 0.08, givre: 0.56,
       // ⚠️ **SANS `etat`, LE NEUTRE — la mer d'avant P5 au bit près.** Le retour
       // le DIT plutôt que de le taire : un appelant qui ne passe pas d'état de
       // mer doit pouvoir lire dans le résultat qu'il a hérité du neutre.
       etat: ETAT_MER_NEUTRE,
       fond: false,
+      // ⚠️ **Tâche P6, MÊME RÈGLE POUR LA LAME D'EAU** : sans `eau`, le neutre
+      // d'`ocean.js`, et le retour le dit au lieu de le taire.
+      eau: LAME_EAU_NEUTRE,
+      couleurs: false,
+      spectre: false,
+      // ⚠️ **Tâche P6** : sans échelle de spectre à lire, la calotte garde celle
+      // que `poserMer` a posée — et le retour le DIT.
+      echelleSpectre: false,
     })
   })
 })
 
 test('⑫b un demi-couple retombe sur le NEUTRE — pas sur une moitié d accalmie', () => {
   return merPosee().then(({ g, u }) => {
     // ⚠️ **UN DEMI-COUPLE EST PIRE QUE PAS D ACCALMIE DU TOUT** : le ressac
     // serait multiplié par 0,08 pendant que les moutons resteraient à 1.
     for (const mauvais of [{ vue: 0.4, surface: NaN }, { vue: NaN, surface: 0.08 }, {}, null, undefined]) {
       Globe.prototype.majReglagesMer.call(g, mauvais)
@@ -1464,24 +1495,34 @@ test('⑫j `reglagesMer` d `ocean.js` LIT vraiment ses trois réglages — exéc
     materials: [
       { uniforms: { uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 }, uSky: { value: ciel } } },
       { uniforms: { uFrost: { value: 0.56 } } },
     ],
   }
   assert.deepEqual(d.get.call(socle), {
     vue: 0.4039, surface: 0.08, givre: 0.56, ciel,
     // ⚠️ **Tâche P5** : le faux socle ci-dessus ne porte AUCUN des six uniformes
     // d'état de mer, donc l'accesseur doit rendre le neutre — champ par champ.
     etat: ETAT_MER_NEUTRE,
+    // ⚠️ **Tâche P6, MÊME RÈGLE** : ni `uTransp`, ni `uSunFx`, ni `uDayLight`,
+    // ni `uDetail`, ni `uShallowT`/`uDeep`, ni `uSunColor` — donc le neutre, un
+    // `null` de couleurs (jamais un demi-couple) et un spectre à deux `null`.
+    eau: LAME_EAU_NEUTRE,
+    couleurs: null,
+    soleilCouleur: null,
+    spectre: { a: null, b: null },
+    echelleSpectre: null,
   })
   // sans mer construite : le NEUTRE, c'est-à-dire la calotte d'avant P4
-  assert.deepEqual(d.get.call({ materials: [] }),
-    { vue: 1, surface: 1, givre: 0, ciel: null, etat: ETAT_MER_NEUTRE })
+  assert.deepEqual(d.get.call({ materials: [] }), {
+    vue: 1, surface: 1, givre: 0, ciel: null, etat: ETAT_MER_NEUTRE,
+    eau: LAME_EAU_NEUTRE, couleurs: null, soleilCouleur: null, spectre: null, echelleSpectre: null,
+  })
   // un givre non fini ne remonte pas
   assert.equal(d.get.call({ materials: [{ uniforms: { uFrost: { value: NaN } } }] }).givre, 0)
   // ⛔ **ET L'ÉTAT DE MER REMONTE VRAIMENT — la réserve n° 1 de P4, exécutée.**
   // Les six valeurs sont celles RELEVÉES le 2026-08-22 sur la page vivante.
   const agite = {
     materials: [
       {
         uniforms: {
           uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 },
           uWaveH: { value: 2 }, uChop: { value: 1 }, uFoam: { value: 1.9 },
@@ -1714,22 +1755,34 @@ test('⑬i un état de mer INCOMPLET retombe sur le neutre entier, pas sur une m
 })
 
 test('⑬j la HOULE porte l accalmie de vue — l expression d `ocean.js`, pas une seconde loi', () => {
   const src = readFileSync(SRC_GLOBE, 'utf8')
   const ocean = readFileSync(SRC_OCEAN, 'utf8')
   // `ocean.js` : oceanGerstner(xz, uTime, uWaveH * uViewCalm, …) au vertex …
   assert.match(ocean, /oceanGerstner\(xz, uTime, uWaveH \* uViewCalm, uChop, uSpeedMul, uLenScale/)
   // … et uWaveH BRUT dans shoreSurf.
   assert.match(ocean, /shoreSurf\(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm/)
   // la calotte fait le MÊME partage, avec ses propres noms
-  assert.match(src, /oceanGerstner\(vec2\(p\.x, p\.z\), uMerTemps, uMerHoule \* uMerCalmeVue, uMerChop, uMerVitesse, uMerLambda/)
-  assert.match(src, /shoreSurf\(uvF, uMerChamp, uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, richesseMer/)
+  // ⛔ **ET AVEC LA CONVERSION DE MONNAIE — Tâche P6, VU À L'ÉCRAN.**
+  // `uMerHoule` vaut ce que vaut `uWaveH`, c'est-à-dire des UNITÉS DE SOCLE ;
+  // `oceanGerstner` ajoute cette amplitude à un maillage en UNITÉS DE SCÈNE.
+  // Relevé le 2026-08-22 : `uMerUnite = 0,008227`, donc `uMerHoule = 2` valait
+  // **121,6 fois** l'amplitude du socle, et le déplacement HORIZONTAL — que
+  // l'écrêtage de déferlement ne borne pas — repliait le maillage sur lui-même.
+  // Même faute que la tavelure (P4) et que le budget du fond (P5) : une valeur
+  // juste, branchée dans la mauvaise unité.
+  assert.match(src, /oceanGerstner\(vec2\(p\.x, p\.z\), uMerTemps, uMerHoule \* uMerCalmeVue \* uMerUnite, uMerChop, uMerVitesse, uMerLambda/)
+  assert.match(src, /shoreSurf\(uvF, uMerChamp, uMerTemps, uMerHoule \* uMerUnite, uMerChop, uMerVitesse, uMerLambda, richesseMer/)
+  // ⚠️ **ET `uMerUnite` EST DÉCLARÉ DANS LE VERTEX, UNE SEULE FOIS** — deux
+  // déclarations ne compilent pas, et le banc ne le dirait qu'à l'écran.
+  const v0 = src.slice(src.indexOf('const MER_VERT'), src.indexOf('const MER_FRAG'))
+  assert.equal((v0.match(/uniform float uMerUnite;/g) || []).length, 1)
   // ⚠️ **ET L UNIFORME EST DÉCLARÉ DANS LE VERTEX**, sinon la compilation tombe.
   const vert = src.slice(src.indexOf('const MER_VERT'), src.indexOf('const MER_FRAG'))
   assert.match(vert, /uniform float uMerCalmeVue;/)
   // ⚠️ **UNE SEULE DÉCLARATION** : deux `uniform float uMerCalmeVue` dans le
   // même nuanceur ne compilent pas, et le banc ne le dirait qu'à l'écran.
   assert.equal((vert.match(/uniform float uMerCalmeVue;/g) || []).length, 1)
 })
 
 test('⑬k `poserMer` n accepte PLUS les quatre paramètres que personne ne passait', () => {
   const src = readFileSync(SRC_GLOBE, 'utf8')
@@ -1756,10 +1809,310 @@ test('⑬l `retirerMer` rend les trois couleurs au défaut du module', () => {
     assert.ok(Math.abs(g.uniforms.uOceanShallow.value.r - 0.1) < 1e-6)
     Globe.prototype.retirerMer.call(g)
     // ⚠️ L'UNIFORME EST PARTAGÉ PAR TOUTES LES TUILES : le laisser sur la
     // palette du crop repeindrait tous les océans du monde en vue orbitale.
     assert.equal('#' + g.uniforms.uOceanShallow.value.getHexString(), RAMPE_NAUTIQUE.peu)
     assert.equal('#' + g.uniforms.uOceanMid.value.getHexString(), RAMPE_NAUTIQUE.moyen)
     assert.equal('#' + g.uniforms.uOceanDeep.value.getHexString(), RAMPE_NAUTIQUE.fond)
     assert.equal(g.uniforms.uMerRampeOn.value, 0)
   })
 })
+
+// ══════════ ⑭ LA LAME D'EAU ET LA FORME DU BLOC — Tâche P6 ═════════════════
+//
+// ⛔ **LE MOTIF DE DIX TÂCHES, CHERCHÉ EN BLOC AU LIEU D'ÊTRE ATTENDU** : un
+// paramètre existe, il a un défaut, personne ne l'a branché. Six trouvés d'un
+// coup — `couleurs` et `graine` de `poserMer`, `half` / `corner` / `expo` de
+// `poserCrop`, `profondeur` de `construireParoisCrop` —, plus quatre réglages
+// de la lame d'eau qui n'avaient **aucun paramètre** pour arriver.
+//
+// ⚠️ **ON EXÉCUTE.** C'est la leçon de la campagne de P4 : « une assertion qui
+// lit un fichier prouve qu'un texte est là ; elle ne prouve pas qu'il pose la
+// bonne valeur ».
+
+test('⑭a `majReglagesMer` pose les QUATRE réglages de lame, un par un', () => {
+  return merPosee().then(({ g, u }) => {
+    // le témoin : à la naissance, la calotte porte le NEUTRE d'`ocean.js`
+    assert.equal(u.uMerTransp.value, LAME_EAU_NEUTRE.transparence)
+    assert.equal(u.uMerDetail.value, LAME_EAU_NEUTRE.detail)
+    const eau = { transparence: 0.57, soleilFx: 0.72, jour: 0.31, detail: 0.75 }
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau })
+    assert.deepEqual(pose.eau, eau)
+    assert.equal(u.uMerTransp.value, 0.57)
+    assert.equal(u.uMerSoleilFx.value, 0.72)
+    assert.equal(u.uMerJour.value, 0.31)
+    assert.equal(u.uMerDetail.value, 0.75)
+    // ⚠️ **UN PAR UN, ET LES TROIS AUTRES NE BOUGENT PAS** — c'est ce qui tue
+    // une mutation qui échangerait deux affectations.
+    const noms = { transparence: 'uMerTransp', soleilFx: 'uMerSoleilFx', jour: 'uMerJour', detail: 'uMerDetail' }
+    for (const champ of Object.keys(noms)) {
+      const un = { ...LAME_EAU_NEUTRE, [champ]: 0.246813 }
+      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau: un })
+      for (const [autre, uni] of Object.entries(noms)) {
+        const attendu = autre === champ ? 0.246813 : LAME_EAU_NEUTRE[autre]
+        assert.equal(u[uni].value, attendu, `${champ} a débordé sur ${autre}`)
+      }
+    }
+  })
+})
+
+test('⑭b une lame INCOMPLÈTE retombe sur le neutre entier, pas sur une eau hybride', () => {
+  return merPosee().then(({ g, u }) => {
+    Globe.prototype.majReglagesMer.call(g,
+      { vue: 1, surface: 1, eau: { transparence: 0.57, soleilFx: 0.72, jour: 1, detail: 0.75 } })
+    assert.equal(u.uMerTransp.value, 0.57)
+    // ⛔ un champ manquant, ou un NaN : TOUT retombe au neutre — le raisonnement
+    // du demi-couple d'accalmies de P4, appliqué à quatre.
+    for (const cassee of [
+      { transparence: 0.57, soleilFx: 0.72, jour: 1 },
+      { transparence: NaN, soleilFx: 0.72, jour: 1, detail: 0.75 },
+      { transparence: 0.57, soleilFx: 0.72, jour: 1, detail: null },
+    ]) {
+      const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau: cassee })
+      assert.deepEqual(pose.eau, LAME_EAU_NEUTRE)
+      assert.equal(u.uMerTransp.value, LAME_EAU_NEUTRE.transparence)
+      assert.equal(u.uMerDetail.value, LAME_EAU_NEUTRE.detail)
+    }
+  })
+})
+
+test('⑭c `majReglagesMer` COPIE les deux couleurs de la lame — jamais un demi-couple', () => {
+  return merPosee().then(({ g, u }) => {
+    const peu = { isColor: true, r: 0.53, g: 0.82, b: 0.88, copyDepuis: null }
+    const fond = { isColor: true, r: 0.09, g: 0.27, b: 0.4 }
+    const avant = { r: u.uMerPeu.value.r, g: u.uMerPeu.value.g, b: u.uMerPeu.value.b }
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, couleurs: { peu, fond } })
+    assert.equal(pose.couleurs, true)
+    for (const [uni, src] of [[u.uMerPeu, peu], [u.uMerFond, fond]]) {
+      assert.ok(Math.abs(uni.value.r - src.r) < 1e-6, 'canal R')
+      assert.ok(Math.abs(uni.value.g - src.g) < 1e-6, 'canal V')
+      assert.ok(Math.abs(uni.value.b - src.b) < 1e-6, 'canal B')
+      // ⚠️ **COPIÉ, PAS PARTAGÉ** : `_applySea` du socle repose ces objets, et
+      // deux matériaux qui partagent une couleur finissent par se la disputer.
+      assert.notEqual(uni.value, src)
+    }
+    // ⛔ un demi-couple ne pose RIEN
+    const pose2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, couleurs: { peu } })
+    assert.equal(pose2.couleurs, false)
+    assert.ok(Math.abs(u.uMerPeu.value.r - peu.r) < 1e-6, 'un demi-couple ne doit rien écrire')
+    // …et sans couleurs du tout, la calotte garde ce qu'elle a
+    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1 })
+    assert.ok(Math.abs(u.uMerPeu.value.r - peu.r) < 1e-6)
+    assert.ok(avant.r !== peu.r, 'le témoin doit distinguer le défaut de la valeur posée')
+  })
+})
+
+test('⑭d la couleur du soleil et le SPECTRE traversent — le spectre par RÉFÉRENCE', () => {
+  return merPosee().then(({ g, u }) => {
+    const soleilCouleur = { isColor: true, r: 1, g: 0.97, b: 0.9 }
+    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, soleilCouleur })
+    assert.ok(Math.abs(u.uSunColor.value.g - 0.97) < 1e-6, 'la couleur du soleil doit être copiée')
+    assert.notEqual(u.uSunColor.value, soleilCouleur, 'copiée, pas partagée')
+    // ⚠️ **LE SPECTRE, LUI, EST PARTAGÉ, ET C'EST DÉLIBÉRÉ** : `_applySea`
+    // assigne déjà `u.a` / `u.b` à TOUS les matériaux du socle sans les cloner.
+    // Un clone par image serait 32 `Vector4` recopiés pour rien, et surtout un
+    // `reseed` ne traverserait plus.
+    const a = [{ x: 1 }, { x: 2 }]
+    const b = [{ y: 1 }, { y: 2 }]
+    const avantA = u.uWaveA.value
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
+    assert.equal(pose.spectre, true)
+    assert.equal(u.uWaveA.value, a, 'le spectre doit être partagé, pas copié')
+    assert.equal(u.uWaveB.value, b)
+    assert.notEqual(avantA, a, 'le témoin : la calotte naît avec SON tirage')
+    // ⛔ un spectre vide ou incomplet ne remplace RIEN — sinon la mer devient un
+    // miroir plat (le zéro trop propre de l'Étape 4 de la Tâche F).
+    for (const cassee of [{ a: [], b }, { a, b: null }, { a: null, b: null }, {}]) {
+      const p2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: cassee })
+      assert.equal(p2.spectre, false)
+      assert.equal(u.uWaveA.value, a, 'un spectre cassé ne doit rien écraser')
+    }
+  })
+})
+
+test('⑭e `poserMer` n accepte PLUS `couleurs` ni `graine`', () => {
+  // ⛔ **DEUX PARAMÈTRES QUE PERSONNE N'A JAMAIS PASSÉS**, exactement comme les
+  // quatre que P5 a retirés. D13 §① : « plus de paramètre de compatibilité à
+  // traîner ».
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  const i = src.indexOf('async poserMer({')
+  assert.ok(i > 0)
+  const sig = src.slice(i, src.indexOf('} = {}) {', i))
+  for (const mort of ['couleurs =', 'graine =']) {
+    assert.ok(!sig.includes(mort), `poserMer ne doit plus porter ${mort}`)
+  }
+  // et la mer se construit sur le NEUTRE du module, jamais sur un argument
+  assert.match(src, /const cols = mod\.couleursEau\(\{\}\)/)
+  assert.match(src, /mod\.seaStateToUniforms\(mod\.makeSeaState\(\)\)/)
+  // …et `contexteCrop().mer` ne les porte pas non plus
+  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+  const j = main.indexOf('    mer: {')
+  assert.ok(j > 0, 'le bloc mer du contexte doit rester lisible')
+  const bloc = main.slice(j, main.indexOf('\n  }\n', j))
+  for (const mort of ['couleurs:', 'graine:']) {
+    assert.ok(!bloc.includes(mort), `contexteCrop().mer ne doit pas porter ${mort}`)
+  }
+})
+
+// ── LA FORME DU BLOC ───────────────────────────────────────────────────────
+
+test('⑭f `poserCrop` prend le coin et l exposant du socle, et les NORMALISE une fois', () => {
+  const g = globeAvecCrop()
+  // le témoin : sans argument, le carré à angles vifs d'avant P6, au bit près
+  assert.equal(g.uniforms.uCropCoin.value, 0)
+  assert.equal(g.uniforms.uCropCoinN.value, 2)
+  // les valeurs RELEVÉES le 2026-08-22 sur le socle vivant
+  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 4.4 })
+  assert.ok(Math.abs(g.uniforms.uCropCoin.value - 0.08) < 1e-12, 'coin = 2,24 / 28')
+  assert.equal(g.uniforms.uCropCoinN.value, 4.4)
+  // ⚠️ **LA NORMALISATION EST CELLE DE `coinNormalise`, ET ELLE EST BORNÉE** :
+  // un rayon plus grand que le demi-côté est écrêté à 1, un négatif à 0.
+  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 999, expo: 4.4 })
+  assert.equal(g.uniforms.uCropCoin.value, 1)
+  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: -5, expo: 4.4 })
+  assert.equal(g.uniforms.uCropCoin.value, 0)
+  // ⚠️ **`half` COMPTE** : le même rayon sur un demi-côté deux fois plus grand
+  // est un arrondi deux fois plus petit. Une mutation qui figerait 28 tombe ici.
+  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 56, corner: 2.24, expo: 4.4 })
+  assert.ok(Math.abs(g.uniforms.uCropCoin.value - 0.04) < 1e-12)
+  // ⚠️ **ET L EXPOSANT NE DESCEND JAMAIS SOUS 2** : sous 2 la « superellipse »
+  // devient concave, et le bloc rentrerait dans ses propres coins.
+  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 0.5 })
+  assert.equal(g.uniforms.uCropCoinN.value, 2)
+})
+
+test('⑭g la MER lit le même coin que les tuiles — un uniforme, pas deux', () => {
+  return merPosee().then(({ g, u }) => {
+    // ⚠️ **C'EST CE PARTAGE QUI FAIT QUE LA NAPPE SUIT SANS ÊTRE REBÂTIE**, et
+    // c'est pourquoi `rafraichirForme` ne rejoue que `crop` et `parois`.
+    assert.equal(u.uCropCoin, g.uniforms.uCropCoin)
+    assert.equal(u.uCropCoinN, g.uniforms.uCropCoinN)
+    Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 4.4 })
+    assert.ok(Math.abs(u.uCropCoin.value - 0.08) < 1e-12, 'la mer doit voir le coin sans rebâtir')
+  })
+})
+
+test('⑭h la PROFONDEUR du bloc suit la tirette du socle, en FRACTION de la largeur', () => {
+  // ⛔ **`FRACTION_PROFONDEUR = 7 / 56` ÉTAIT GELÉE** : sept et cinquante-six
+  // sont `params.plinthDepth` et `TERRAIN_SIZE` À LEUR VALEUR D'USINE. Le
+  // défaut avait donc l'air juste — c'est la même coïncidence que les deux
+  // couleurs de la lame d'eau, et c'est pourquoi personne ne l'a vue.
+  const base = { repere: REPERE, forme: { coin: 0, expo: 2 }, rayon: 1, echelle: 1e-6, hauteur: () => 0 }
+  const defaut = construireSolideCrop(base)
+  const triple = construireSolideCrop({ ...base, fractionProfondeur: FRACTION_PROFONDEUR * 3 })
+  assert.ok(!defaut.refus && !triple.refus, 'les deux solides doivent se bâtir')
+  // ⚠️ **LE ZÉRO N'EST PAS ZÉRO, ET C'EST LA SPHÈRE.** `hauteur()` rend 0
+  // partout, mais l'anneau court sur une CALOTTE : son point le plus bas est à
+  // −1,15 × 10⁻⁶ unité, pas à 0. Mesurer le rapport sur `baseY` brut rendait
+  // 2,9915 au lieu de 3 — un chiffre presque juste, donc le pire genre. On
+  // mesure donc l'ÉPAISSEUR, `baseY − minY`, et `minY` se lit à fraction nulle.
+  const minY = construireSolideCrop({ ...base, fractionProfondeur: 0 }).baseY
+  assert.ok(minY < 0 && minY > -1e-5, `minY = ${minY} : la calotte doit être presque plate`)
+  const epaisseur = (s) => minY - s.baseY
+  // ⚠️ **LE TÉMOIN D'ABORD** : sans épaisseur, le rapport de deux zéros ne
+  // distinguerait rien — la classe d'erreur que P5 nomme (« une assertion qui
+  // prouve qu'un texte est là »).
+  assert.ok(epaisseur(defaut) > 0, 'le bloc doit avoir une épaisseur')
+  assert.ok(Math.abs(epaisseur(triple) / epaisseur(defaut) - 3) < 1e-9,
+    `${epaisseur(triple)} / ${epaisseur(defaut)}`)
+  // ⚠️ **UNE FRACTION NÉGATIVE OU NON FINIE NE RETOURNE PAS LE BLOC** — un fond
+  // au-dessus de sa propre surface, c'est le défaut que `plancherMer` a déjà
+  // coûté une fois.
+  assert.equal(construireSolideCrop({ ...base, fractionProfondeur: -1 }).baseY, minY)
+  assert.equal(construireSolideCrop({ ...base, fractionProfondeur: NaN }).baseY, defaut.baseY)
+  // …et `profondeur` (absolue) garde la priorité, pour les bancs et les tests
+  assert.ok(Math.abs(epaisseur(construireSolideCrop({ ...base, profondeur: 0.5, fractionProfondeur: 9 })) - 0.5) < 1e-12)
+})
+
+test('⑭i `construireParoisCrop` TRANSMET la fraction, et `contexteCrop` la calcule', () => {
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  assert.match(src, /construireParoisCrop\(\{ profondeur = null, fractionProfondeur = undefined,/)
+  // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE** : une valeur réécrite ici en
+  // serait une seconde, et deux défauts jumeaux divergent (`uContourInterval`,
+  // Tâche C, tour 1).
+  assert.match(src, /\n      fractionProfondeur,\n/)
+  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+  // ⚠️ **`plinth.depth`, PAS `params.plinthDepth`** : c'est `rebuild` qui écrit
+  // `this.depth`, donc le matériel qui dit la vérité — la règle de
+  // `plinth.wallMat.color` (manque n° 2 du noteur), appliquée à la géométrie.
+  assert.match(main, /fractionProfondeur: plinth\.depth \/ \(2 \* \(terrain\.mapUniforms\.uSlabHalf\?\.value \|\| 28\)\)/)
+  // et la forme vient des UNIFORMES du socle, jamais de `params`
+  assert.match(main, /half: terrain\.mapUniforms\.uSlabHalf\?\.value \?\? 28/)
+  assert.match(main, /corner: terrain\.mapUniforms\.uSlabCorner\?\.value \?\? 0/)
+  assert.match(main, /expo: terrain\.mapUniforms\.uSlabCornerN\?\.value \?\? 2/)
+  assert.ok(!/corner: params\.slabCorner/.test(main), 'la forme ne doit pas passer par params')
+})
+
+test('⑭j l ÉCHELLE DE SPECTRE arrive du socle, CONVERTIE par `uMerUnite` — réserve n° 3 de P5', () => {
+  return merPosee().then(({ g, u }) => {
+    // ⛔ **`ECHELLE_HOULE_UNITES = 0,42` ÉTAIT ÉCRIT EN DUR** pendant que le
+    // socle vit sur `LEN_SCALE × clamp(waveScale)`. P5 avait mesuré l'écart
+    // (« le spectre du crop est 1,818 fois plus étiré ») et ne l'avait pas
+    // fermé « parce que les deux vivent dans des systèmes d'unités différents ».
+    // **Le système de conversion existe : c'est `uMerUnite`.**
+    const avant = u.uMerLambda.value
+    const unite = u.uMerUnite.value
+    assert.ok(unite > 0, 'témoin : le champ doit rendre son unité')
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, echelleSpectre: 0.231 })
+    assert.equal(pose.echelleSpectre, true)
+    assert.ok(Math.abs(u.uMerLambda.value - 0.231 * unite) < 1e-15, `${u.uMerLambda.value}`)
+    assert.notEqual(u.uMerLambda.value, avant, 'le témoin : la valeur du module n était PAS celle du socle')
+    // ⛔ sans échelle à lire — ou avec une échelle absurde — on garde celle du
+    // module : une longueur de houle nulle rendrait la mer étale sans un mot.
+    for (const mauvaise of [null, undefined, 0, -1, NaN]) {
+      u.uMerLambda.value = avant
+      const p = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, echelleSpectre: mauvaise })
+      assert.equal(p.echelleSpectre, false, `${mauvaise} ne doit pas passer`)
+      assert.equal(u.uMerLambda.value, avant)
+    }
+  })
+})
+
+test('⑭k `ocean.js` REMONTE son échelle de spectre, en unités de SOCLE', async () => {
+  const { RealWater } = await import('../src/ocean.js')
+  const d = Object.getOwnPropertyDescriptor(RealWater.prototype, 'reglagesMer')
+  const socle = { materials: [{ uniforms: { uLenScale: { value: 0.231 } } }] }
+  assert.equal(d.get.call(socle).echelleSpectre, 0.231)
+  // ⚠️ **PAS DE CONVERSION CÔTÉ SOCLE** : `ocean.js` n'a pas à savoir ce qu'est
+  // un crop. La seule conversion vit dans `majReglagesMer`, avec `uMerUnite`.
+  const src = readFileSync(SRC_OCEAN, 'utf8')
+  assert.match(src, /echelleSpectre: Number\.isFinite\(u\?\.uLenScale\?\.value\) \? u\.uLenScale\.value : null,/)
+  assert.equal(d.get.call({ materials: [{ uniforms: {} }] }).echelleSpectre, null)
+  assert.equal(d.get.call({ materials: [{ uniforms: { uLenScale: { value: NaN } } }] }).echelleSpectre, null)
+})
+
+test('⑭l la MER partage le soleil du BLOC avec les tuiles — pas une copie', () => {
+  // ⛔ **SURVIVANTE N° 03 DU PREMIER TOUR, ET ELLE VISAIT UN VRAI TROU.**
+  // Sans ce partage, le soleil de la mer serait figé à la naissance du crop :
+  // la tirette d'heure déplacerait l'ombrage du relief et pas le glint de l'eau.
+  return merPosee().then(({ g, u }) => {
+    assert.equal(u.uSoleilDir, g.uniforms.uSoleilDir, 'uSoleilDir doit être PARTAGÉ')
+    assert.equal(u.uEclairageOn, g.uniforms.uEclairageOn, 'uEclairageOn doit être PARTAGÉ')
+    assert.equal(u.uSunDir, g.uniforms.uSunDir, 'le repli de planète reste partagé lui aussi')
+    // ⚠️ **LE TÉMOIN** : la couleur du soleil, elle, est PROPRE à la mer —
+    // `majReglagesMer` y COPIE celle du socle. Un matériau qui partagerait tout
+    // passerait la boucle ci-dessus sans rien prouver.
+    assert.notEqual(u.uSunColor, g.uniforms.uSunDir)
+    assert.equal(g.uniforms.uSunColor, undefined, 'le globe n a pas de uSunColor à lui')
+  })
+})
+
+test('⑭m `couleursEauDuSocle` LIT deux couleurs, dans cet ordre, et refuse un demi-couple', () => {
+  // ⛔ **SURVIVANTES N° 26 ET 27 DU PREMIER TOUR.** ⑭c exerçait
+  // `majReglagesMer` ; personne n'exerçait le module lui-même, donc ni sa garde
+  // ni son ORDRE. Deux couleurs échangées rendent une mer claire au large et
+  // sombre au rivage — l'inverse exact d'un lagon.
+  const peu = { isColor: true, r: 0.53, g: 0.82, b: 0.88 }
+  const fond = { isColor: true, r: 0.09, g: 0.27, b: 0.4 }
+  const r = couleursEauDuSocle(peu, fond)
+  assert.equal(r.peu, peu, 'le glacis clair doit rester le PREMIER argument')
+  assert.equal(r.fond, fond, 'le bleu du large doit rester le SECOND')
+  // ⚠️ **ET LES DEUX SONT DISTINCTS** : un test sur deux couleurs égales ne
+  // distinguerait pas un échange.
+  assert.notEqual(peu, fond)
+  // le demi-couple, dans les deux sens, et l'absence
+  assert.equal(couleursEauDuSocle(peu, null), null)
+  assert.equal(couleursEauDuSocle(null, fond), null)
+  assert.equal(couleursEauDuSocle(null, null), null)
+  assert.equal(couleursEauDuSocle(undefined, undefined), null)
+  assert.equal(couleursEauDuSocle({ r: 1 }, fond), null, 'un objet sans isColor n est pas une couleur')
+})
