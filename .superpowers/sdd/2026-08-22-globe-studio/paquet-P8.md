a0a600a tache P8 : les trois survivantes du premier tour de mutation
64501f6 tache P8 : la frange cotiere du crop manquait le repli distance-au-rivage
1051fe2 tache P8 : la paroi du crop empruntait l ambiante du relief, pas la sienne

 src/globe.js                  | 100 +++++++++++++++++++++++--
 src/main.js                   |  41 +++++++++++
 src/monde/branchement-crop.js |  11 +++
 src/monde/eclairage-crop.js   |  57 +++++++++++++++
 src/monde/ecume-mer.js        |  73 +++++++++++++++++++
 test/crop-eclairage.test.js   | 165 +++++++++++++++++++++++++++++++++++++++++-
 test/crop-habillage.test.js   |   7 ++
 test/crop-naturel.test.js     |   3 +-
 test/ecume-mer.test.js        | 102 ++++++++++++++++++++++++++
 9 files changed, 548 insertions(+), 11 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index 2e54664..c330727 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -198,20 +198,27 @@ uniform float uMerUnite;
 // lit deja pour l ecume (Tache P4) ; le vertex en a besoin pour la HOULE, parce
 // qu ocean.js multiplie son amplitude par uViewCalm avant d appeler Gerstner.
 // C est le MEME uniforme, pas un second : un seul ecrivain, majReglagesMer.
 uniform float uMerCalmeVue;
 __GERSTNER__
 __SHORE_SURF__
 ${GLSL_ECUME}
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
+// ⛔ LA PROFONDEUR AVEC LE REPLI DISTANCE-AU-RIVAGE — Tache P8. vProfondeur
+// est la bathymetrie NUE (elle decide de la terre, du deferlement et du declin
+// cotier) ; celle-ci porte en plus le secours d ocean.js, et c est elle que le
+// GLACIS DE LAGON et l alpha lisent. La mesure qui l exige est a profondeurEau
+// (monde/ecume-mer.js) : le champ du crop ne porte qu un echantillon vrai tous
+// les 240 m, et le glacis y etait peint sur un plateau a paliers.
+varying float vProfondeurEau;
 // ⚠️ CE N EST PLUS LA DISTANCE BRUTE, ET LE NOM LE DIT — Tache P4. Elle portait
 // champ.g tel quel pendant que les seuils qui la lisent (0,002 / 0,03 / 0,10 /
 // 0,75) sont ceux d ocean.js, cales sur vFade, c est-a-dire sur le declin
 // FONDU. C etait ca, l ecume 7,7 fois trop etendue. (Aucun accent grave ni
 // apostrophe dans ce bloc : template literal.)
 varying float vFonduRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
@@ -222,20 +229,22 @@ void main() {
   vJupe = aJupe;
   // le BAS du rideau tient au fond du bloc et ne suit aucune vague : c est lui
   // qui soude la nappe a la levre de la paroi, laquelle plonge au fond marin.
   bool basDuRideau = aJupe > 0.5;
   if (basDuRideau) p.y = uMerBasY;
   vCrop = aCrop;
   vLocal = vec2(position.x, position.z);
   vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;
   vec2 champ = texture2D(uMerChamp, uvF).rg;
   vProfondeur = max(-champ.r, 0.0);
+  // le repli d ocean.js, converti dans la monnaie de la calotte par uMerUnite
+  vProfondeurEau = profondeurEauMer(vProfondeur, champ.g, uMerUnite);
   // ⚠️ LA PROFONDEUR EN UNITÉS DE SOCLE, PUIS LE DÉCLIN D'ocean.js. Les deux
   // grandeurs qu'il compare — deux fois la profondeur, et la distance au rivage
   // normalisée sur quinze unités de socle — doivent vivre dans la MÊME monnaie.
   float declin = declinRivageMer(vProfondeur / max(uMerUnite, 1e-9), champ.g);
   vFonduRive = fonduRessacMer(declin);
   vec3 monde = (modelMatrix * vec4(p, 1.0)).xyz;
 
   // ══════ LA MER — LA DÉGRADATION, ET ELLE ATTEINT ZÉRO ═════════════════════
   //
   // ⚠️ EN LOGARITHME DE DISTANCE : la bande est GÉOMÉTRIQUE, donc la bascule en
@@ -376,20 +385,21 @@ uniform float uCropCoinN;
 // src/monde/mer-sphere.js (bordDeMer) et SUIT L'ESTOMPAGE de la Terre autour.
 // ⚠️ uCropCoin et uCropCoinN etaient DECLARES ICI ET LUS PAR PERSONNE depuis la
 // Tache F — deux uniformes morts, exactement ce que le §Q du plan traque. Ils
 // portent desormais la mesure du bord, la MEME que celle de la decoupe
 // (globe.js, cq / pn du nuanceur des tuiles) : pas une seconde ecriture de la
 // superellipse, la meme, appliquee a une autre surface.
 uniform vec2 uMerBord;
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
+varying float vProfondeurEau;
 varying float vFonduRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
 varying float vJupe;
 ${GLSL_ECUME}
 ${GLSL_LAME_EAU}
 ${GLSL_JUPE_MER}
 
@@ -445,21 +455,29 @@ void main() {
   vec2 cq = max(q, 0.0);
   float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
   float dBord = pn - uCropCoin + min(max(q.x, q.y), 0.0); // 0 = frontiere, < 0 = DEDANS
   float bord = 1.0 - smoothstep(uMerBord.x, uMerBord.y, dBord);
   if (bord <= 0.0) discard;
 
   // ⛔ ICI VIVAIT UN d01 QUE PERSONNE NE LISAIT — un uniforme mort de plus, de
   // la famille que le §Q du plan traque et que uCropCoin a deja illustree.
   // le dégradé lagon vit sur les premiers 15 % du budget — une baie de 30 m est
   // un lagon, le budget couvre des colonnes de mille mètres (ocean.js)
-  float dLagon = clamp(vProfondeur / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
+  //
+  // ⛔ ET IL LIT LA PROFONDEUR AVEC LE REPLI, LA OU ocean.js LIT LA BATHYMETRIE
+  // NUE — Tache P8. C est un ECART au socle, mesure et assume : sur le crop, le
+  // repli pose sur la seule alpha ne deplace RIEN (glacis 11,72 % contre 11,71 %
+  // au depart, force periodique 0,24), pose sur le glacis il rend 9,69 % et
+  // 0,048. LES DENTS VIVENT DANS LE GLACIS. Le pourquoi — un echantillon vrai
+  // de bathymetrie tous les 240 m dans le champ du crop — est a profondeurEau
+  // (monde/ecume-mer.js), avec le halo qu ocean.js redoute, declare comme risque.
+  float dLagon = clamp(vProfondeurEau / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
   // ══════ LE CORPS DE L EAU — Tache P6 ═════════════════════════════════════
   // Il portait mix(uMerPeu, uMerFond, pow(dLagon, 0.7)) : le corps d ocean.js
   // AMPUTE de son glacis de lagon (donc de la tirette de transparence) et de sa
   // nuit. corpsEau est la loi entiere, injectee depuis monde/ecume-mer.js.
   vec3 col = corpsEau(uMerPeu, uMerFond, dLagon, poidsLagonEau(uMerTransp), uMerJour);
 
   vec3 V = normalize(cameraPosition - vMonde);
   // ══════ LE CLAPOT DE NORMALE — Tache P6, ET LA CALOTTE N EN AVAIT AUCUN ══
   // ocean.js : rp = xz * 6.0, ou xz est en UNITES DE SOCLE. On convertit par
   // uMerUnite, exactement comme la tavelure depuis P4 — la meme monnaie, pas
@@ -512,24 +530,24 @@ void main() {
     // reste en facteur : c est l echelle d ECHANTILLONNAGE de la calotte (elle
     // atteint zero et fait sortir le vertex), la ou uMerCalmeVue/Surf sont les
     // deux echelles de LOOK d ocean.js. Deux echelles, deux roles, toutes deux
     // presentes — c est exactement ce qui manquait.
     float ecume = clamp(ecumeMer(vCrete, vFonduRive, n1, n2, tavelure, uMerTemps,
       uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf) * vRichesse, 0.0, 1.0);
     // ⚠️ blanchirEcume PORTE LA NUIT — Tache P6. La ligne d avant ecrivait
     // vec3(0.96) NU : l ecume du crop restait blanche a minuit quand celle du
     // socle tombe a 0,14 de sa valeur.
     col = blanchirEcume(col, ecume, uMerJour);
-    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * opac, ecume * 0.85));
+    gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeurEau) * opac, ecume * 0.85));
     return;
   }
-  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeur) * opac);
+  gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeurEau) * opac);
 }
 `
 
 // La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
 // `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
 // fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
 // IMPORTÉE, pas recopiée : une constante dupliquée diverge en silence (§1 de
 // /threejs-optimisation, question 2).
 const CIRCONFERENCE_MERCATOR = CIRCONFERENCE_M
 
@@ -2383,20 +2401,35 @@ export class Globe {
       //
       // ⚠️ **LES DÉFAUTS SONT CEUX DU MODULE, PAS DES NOMBRES RECOPIÉS ICI** —
       // même discipline que `NATUREL_MONDE` et `HABILLAGE_MONDE` : deux jeux de
       // défauts qui divergeraient, c'est un aller-retour bit-à-bit qui ment.
       uEclairageOn: { value: 0 },
       uSoleilDir: { value: new THREE.Vector3(0, 1, 0) },
       uSoleilIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.soleilIrr) },
       uHemiHaut: { value: new THREE.Vector3(0, 1, 0) },
       uCielIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.cielIrr) },
       uSolIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.solIrr) },
+      // ══════ L'AMBIANTE PROPRE À LA PAROI — Tâche P8 ═══════════════════════
+      //
+      // ⛔ **DEUX AMBIANTES ET NON UNE, PARCE QUE LE SOCLE EN A DEUX.** Le
+      // relief voit `scene.environment` (« the neutral room env ») ; la paroi
+      // voit `wallMat.envMap` (« their own studio env map »), et `three`
+      // n'applique `scene.environmentIntensity` qu'aux matériaux SANS `envMap` à
+      // eux. La démonstration, les deux relevés et les deux témoins sont à
+      // `environnementEffectif` (`monde/eclairage-crop.js`).
+      //
+      // ⚠️ **LE DÉFAUT EST CELUI DES TUILES, PAS ZÉRO.** Sans donnée de paroi,
+      // `poserHabillage` y recopie `uCielIrr`/`uSolIrr` : l'image d'avant cette
+      // tâche est alors rendue AU BIT PRÈS. Un zéro aurait fait une paroi noire
+      // chez tout appelant qui ne connaît pas encore ces deux champs.
+      uParoiCielIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.cielIrr) },
+      uParoiSolIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.solIrr) },
       uAlbedoBase: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.albedoBase) },
       uAlbedoTeinte: { value: ECLAIRAGE_MONDE.albedoTeinte },
       // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════
       uSurfaceFx: { value: APPARENCE_MONDE.surfaceFx },
       uFxBlend: { value: APPARENCE_MONDE.fxBlend },
       uFxOpacite: { value: APPARENCE_MONDE.fxOpacity },
       uFxScale: { value: APPARENCE_MONDE.fxScale },
       uFxTime: { value: APPARENCE_MONDE.fxTime },
       uFxColA: { value: new THREE.Color(APPARENCE_MONDE.fxColA) },
       uFxColB: { value: new THREE.Color(APPARENCE_MONDE.fxColB) },
@@ -2964,20 +2997,29 @@ export class Globe {
     centreLon = null,
     soleilAzimut = null,
     soleilElevation = null,
     soleilCouleur = null,
     soleilIntensite = null,
     hemiCiel = null,
     hemiSol = null,
     hemiIntensite = null,
     ambianteCoef = null,
     ambianteIntensite = null,
+    // ══════ L'AMBIANTE DE LA PAROI — Tâche P8 ════════════════════════════════
+    //
+    // ⚠️ **MÊME PATRON QUE PARTOUT ICI : L'INTERRUPTEUR EST L'ABSENCE DE
+    // DONNÉE.** Un appelant qui ne les passe pas fait retomber la paroi sur
+    // l'ambiante des tuiles, c'est-à-dire sur l'image d'avant cette tâche AU BIT
+    // PRÈS. C'est ce que `test/crop-eclairage.test.js` verrouille, et c'est ce
+    // qui rend la mutation « on oublie de les poser » visible en test.
+    paroiAmbianteCoef = null,
+    paroiAmbianteIntensite = null,
     albedoBase = null,
     albedoTeinte = null,
     // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
     //
     // ⚠️ **`fxTime` N'EST PAS DANS CETTE LISTE, ET C'EST DÉLIBÉRÉ** : il avance
     // À CHAQUE IMAGE (`terrain.js` : `uFxTime.value += dt * speed`). Le faire
     // entrer par ici mettrait `habillageDifferent` à vrai soixante fois par
     // seconde, donc reposerait l'habillage ENTIER — textures comprises — à
     // chaque image. Il passe par `poserTempsApparence`.
     surfaceFx = null,
@@ -3085,20 +3127,49 @@ export class Globe {
       u.uCielIrr.value.set(
         u.uCielIrr.value.x + amb.ciel[0],
         u.uCielIrr.value.y + amb.ciel[1],
         u.uCielIrr.value.z + amb.ciel[2]
       )
       u.uSolIrr.value.set(
         u.uSolIrr.value.x + amb.sol[0],
         u.uSolIrr.value.y + amb.sol[1],
         u.uSolIrr.value.z + amb.sol[2]
       )
+      // ══════ ET LA PAROI PREND SON PROPRE ENVIRONNEMENT — Tâche P8 ══════════
+      //
+      // ⚠️ **LA LAMPE HÉMISPHÉRIQUE EST LA MÊME, L'ENVIRONNEMENT NON.** Une
+      // `HemisphereLight` éclaire toute la scène ; un `envMap` posé sur un
+      // matériau n'éclaire que lui. On repart donc du même hémisphère et on lui
+      // ajoute l'ambiante DE LA PAROI au lieu de celle du relief.
+      //
+      // ⚠️ **SANS DONNÉE DE PAROI, ON RECOPIE CELLE DES TUILES** — pas zéro : le
+      // défaut doit être l'image d'avant cette tâche, au bit près.
+      const ambParoi = paroiAmbianteCoef != null || Number.isFinite(paroiAmbianteIntensite)
+        ? irradianceAmbiante(paroiAmbianteCoef, paroiAmbianteIntensite)
+        : null
+      if (ambParoi) {
+        poserIrradiance(u.uParoiCielIrr.value, hemiCiel, hemiIntensite)
+        poserIrradiance(u.uParoiSolIrr.value, hemiSol, hemiIntensite)
+        u.uParoiCielIrr.value.set(
+          u.uParoiCielIrr.value.x + ambParoi.ciel[0],
+          u.uParoiCielIrr.value.y + ambParoi.ciel[1],
+          u.uParoiCielIrr.value.z + ambParoi.ciel[2]
+        )
+        u.uParoiSolIrr.value.set(
+          u.uParoiSolIrr.value.x + ambParoi.sol[0],
+          u.uParoiSolIrr.value.y + ambParoi.sol[1],
+          u.uParoiSolIrr.value.z + ambParoi.sol[2]
+        )
+      } else {
+        u.uParoiCielIrr.value.copy(u.uCielIrr.value)
+        u.uParoiSolIrr.value.copy(u.uSolIrr.value)
+      }
       if (albedoBase != null) {
         // ⚠️ **`setStyle`, PAS `set`** : `set` accepte aussi un nombre, et une
         // chaîne '#rrggbb' est ce que le contexte transporte (une chaîne se
         // compare par `Object.is`, un `THREE.Color` muté en place ne se compare
         // pas — la remarque que `CHAMPS_HABILLAGE` porte déjà pour `hazeColor`).
         // Le passage sRVB → linéaire est celui de three, pas une formule écrite ici.
         _couleurTampon.setStyle(albedoBase, THREE.SRGBColorSpace)
         u.uAlbedoBase.value.set(_couleurTampon.r, _couleurTampon.g, _couleurTampon.b)
       }
       if (Number.isFinite(albedoTeinte)) u.uAlbedoTeinte.value = albedoTeinte
@@ -3199,20 +3270,25 @@ export class Globe {
     // `test/crop-habillage.test.js` exige porte sur les VALEURS, pas sur leur
     // effet. Un uniforme resté sur le soleil d'un crop mort est un état qui
     // traîne, et ce fichier en a déjà payé un (`uContourInterval`, la planète
     // entière à 250 m).
     u.uEclairageOn.value = 0
     u.uSoleilDir.value.set(0, 1, 0)
     u.uHemiHaut.value.set(0, 1, 0)
     u.uSoleilIrr.value.fromArray(ECLAIRAGE_MONDE.soleilIrr)
     u.uCielIrr.value.fromArray(ECLAIRAGE_MONDE.cielIrr)
     u.uSolIrr.value.fromArray(ECLAIRAGE_MONDE.solIrr)
+    // ⚠️ **LES DEUX DE LA PAROI AUSSI — Tâche P8**, et pour la raison que ce
+    // bloc porte déjà : l'aller-retour bit-à-bit porte sur les VALEURS. Une
+    // paroi restée sur le studio d'un crop mort est un état qui traîne.
+    u.uParoiCielIrr.value.fromArray(ECLAIRAGE_MONDE.cielIrr)
+    u.uParoiSolIrr.value.fromArray(ECLAIRAGE_MONDE.solIrr)
     u.uAlbedoBase.value.fromArray(ECLAIRAGE_MONDE.albedoBase)
     u.uAlbedoTeinte.value = ECLAIRAGE_MONDE.albedoTeinte
     u.uParoiCouleur.value.set('#d8d4cc')
     u.uSurfaceFx.value = APPARENCE_MONDE.surfaceFx
     u.uFxBlend.value = APPARENCE_MONDE.fxBlend
     u.uFxOpacite.value = APPARENCE_MONDE.fxOpacity
     u.uFxScale.value = APPARENCE_MONDE.fxScale
     u.uFxTime.value = APPARENCE_MONDE.fxTime
     u.uFxColA.value.set(APPARENCE_MONDE.fxColA)
     u.uFxColB.value.set(APPARENCE_MONDE.fxColB)
@@ -4584,26 +4660,38 @@ export class Globe {
         // que le soleil de la scène pointait `(0,4392 · 0,5629 · −0,7001)`, et
         // `uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil
         // laisse à `day ≈ 0` rend donc **exactement `uShadowColor`** : c'est un
         // aplat de la couleur du fond, pas une paroi éclairée.
         //
         // ⚠️ **ET LE TERMINATEUR N'A RIEN À FAIRE SUR UN BLOC** — P3 le dit déjà
         // pour les tuiles : *« Le socle n'a pas de nuit : il est un objet de
         // studio, éclairé par trois sources. »* La paroi du socle est un
         // `MeshPhysicalMaterial` rugosité 0,95, métal 0, occlusion par sommet :
         // un diffus pur. `irradianceCrop` est cette loi-là, et c'est la MÊME
-        // fonction, les MÊMES uniformes que les tuiles — pas une seconde.
+        // fonction que les tuiles — pas une seconde.
+        //
+        // ⛔ **MAIS PAS LES MÊMES UNIFORMES D'AMBIANTE, ET P6 SE TROMPAIT SUR CE
+        // POINT — Tâche P8.** La ligne au-dessus disait « les MÊMES uniformes
+        // que les tuiles ». Elle a coûté la moitié du manque n° 3 du noteur :
+        // **le relief et la paroi du socle ne voient PAS le même
+        // environnement.** Le relief voit `scene.environment` à
+        // `scene.environmentIntensity` ; la paroi voit son propre studio à
+        // `envMapIntensity`, parce que `three` n'écrase l'intensité que sur les
+        // matériaux SANS `envMap` à eux. La paroi du crop empruntait donc
+        // l'ambiante du RELIEF, **1,54 fois plus forte à plat sur un mur
+        // vertical** — d'où ses 26,63 contre 15,88. Mesures, témoins et
+        // aller-retours : `environnementEffectif` (`monde/eclairage-crop.js`).
         uSoleilDir: this.uniforms.uSoleilDir,
         uHemiHaut: this.uniforms.uHemiHaut,
         uSoleilIrr: this.uniforms.uSoleilIrr,
-        uCielIrr: this.uniforms.uCielIrr,
-        uSolIrr: this.uniforms.uSolIrr,
+        uCielIrr: this.uniforms.uParoiCielIrr,
+        uSolIrr: this.uniforms.uParoiSolIrr,
         uEclairageOn: this.uniforms.uEclairageOn,
       },
       vertexShader: /* glsl */ `
         attribute vec3 aoCrop;
         varying vec3 vN;
         varying float vAo;
         void main() {
           vN = normalize(mat3(modelMatrix) * normal);
           vAo = aoCrop.r;
           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
diff --git a/src/main.js b/src/main.js
index b7260fb..20ef2ad 100644
--- a/src/main.js
+++ b/src/main.js
@@ -80,20 +80,26 @@ import { creerVeilleCrop } from './monde/branchement-crop.js'
 // > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
 // > tuile du globe est une COULEUR NUE. »
 //
 // `irradianceAmbiante` est la LOI (module pur, vérifiable sous node) ;
 // `coefAmbiante` est la MESURE (elle a besoin du renderer, donc elle vit à
 // côté). ⚠️ **L'ambiante n'est pas une constante** : elle pèse 47 % de
 // l'irradiance du socle et `applyBackground` peut remplacer
 // `scene.environment` par un ciel HDRI — un nombre en dur serait devenu faux
 // sans que rien ne le dise.
 import { coefAmbiante } from './sonde-ambiante.js'
+// ⛔ **ET LA PAROI N'EST PAS ÉCLAIRÉE PAR LE MÊME ENVIRONNEMENT QUE LE RELIEF —
+// Tâche P8.** `environnementEffectif` est la règle de `three` (« un matériau qui
+// porte son propre `envMap` ne voit ni `scene.environment` ni
+// `scene.environmentIntensity` »), écrite une fois, vérifiable sous node. C'est
+// elle qui dit LAQUELLE des deux textures sonder pour la paroi du crop.
+import { environnementEffectif } from './monde/eclairage-crop.js'
 // LE REPOS DE LA VUE — Tâche N. ⚠️ **PUR, POUR LA MÊME RAISON QUE LES TROIS
 // VEILLES CI-DESSUS** : c'est un SEUIL, et le seuil du socle a produit onze
 // bascules là où il en fallait une. Ses deux nombres sont MESURÉS sur des traces
 // par image relevées dans l'application vivante — voir le §3 du module.
 import { creerVeilleRepos } from './monde/veille-repos.js'
 // ⚠️ `landmarks.js` N'IMPORTE RIEN — c'est ce qui en fait « la seule source de
 // la largeur du socle » (`seuil-socle.js`, §0), et ce qui rend cet import sans
 // risque de cycle depuis `main.js`, qui est en bout de chaîne.
 import { BLOCK_TILES } from './landmarks.js'
 // ⚠️ `exageration-continue.js` N'IMPORTE RIEN — voir son en-tête : passer par
@@ -4917,20 +4923,31 @@ function contexteCrop() {
   // `heightPivot`, qui valent dans les DEUX modes et que le gabarit « realistic »
   // pousse à 5,1. Le conditionner au mode Naturel les aurait laissés morts.
   const rampe2D = terrain.mapUniforms.uRampTex.value || null
   // l'amplitude du relief du crop : elle CALE l'intervalle des courbes de niveau
   // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
   const f = terrain.fenetreBornee
   const amplitudeM = Number.isFinite(f?.maxM) && Number.isFinite(f?.minM)
     ? f.maxM - f.minM
     : (Number.isFinite(dem?.maxM) && Number.isFinite(dem?.minM) ? dem.maxM - dem.minM : null)
 
+  // ⛔ **L'ENVIRONNEMENT DE LA PAROI N'EST PAS CELUI DU RELIEF — Tâche P8.** La
+  // règle est celle de `three` et elle est écrite dans `environnementEffectif` ;
+  // ici on ne fait que l'appliquer au matériau de paroi VIVANT. `?.` parce que
+  // `contexteCrop` tourne aussi avant que la plinthe existe.
+  const envParoi = environnementEffectif(
+    plinth?.wallMat?.envMap ?? null,
+    plinth?.wallMat?.envMapIntensity,
+    scene.environment,
+    scene.environmentIntensity
+  )
+
   const ctx = {
     centre,
     zoom,
     tuilesParBloc: BLOCK_TILES,
     // ══════════ LA FORME DU BLOC — Tâche P6 ═══════════════════════════════════
     //
     // ⛔ **`poserCrop` PORTE `half`, `corner` ET `expo` DEPUIS LA TÂCHE A ET
     // PERSONNE NE LES A JAMAIS PASSÉS.** Le bloc du crop était donc un CARRÉ À
     // ANGLES VIFS pendant que celui du socle est un squircle : relevé le
     // 2026-08-22 au même instant dans la même page, `uCropCoin = 0` et
@@ -5062,20 +5079,44 @@ function contexteCrop() {
       // pas d'`envMap` à lui (`WebGLRenderer.js`, r172), et
       // `terrain.material.envMap === null`. Le facteur 6,7 que ça donnait a été
       // attrapé par la mesure du socle, pas par la lecture du code.
       //
       // ⚠️ **`coefAmbiante` REND UN OBJET GELÉ MIS EN CACHE PAR TEXTURE** : son
       // identité ne bouge pas, donc `Object.is` le voit égal et l'habillage ne
       // se repose pas à chaque image. C'est la contrainte que
       // `CHAMPS_HABILLAGE` impose à tout ce qui n'est ni scalaire ni chaîne.
       ambianteCoef: coefAmbiante(renderer, scene.environment),
       ambianteIntensite: scene.environmentIntensity,
+      // ══════ ET L'AMBIANTE DE LA PAROI, QUI N'EST PAS CELLE-LÀ — Tâche P8 ═══
+      //
+      // ⛔ **LE COMMENTAIRE JUSTE AU-DESSUS NE TIRE QUE LA MOITIÉ DE SA PROPRE
+      // LIGNE DE `three`.** Il conclut, à raison, qu'`envMapIntensity` est du
+      // code MORT sur le relief parce que `terrain.material.envMap === null`.
+      // **La paroi du socle, elle, a son propre `envMap`** — `plinth.setEnvMap`
+      // lui pose `makeSocleEnvMap(renderer)`, et son commentaire l'annonce :
+      // *« give the socle walls their own studio env map (overrides
+      // scene.environment for this material only… while the terrain keeps the
+      // neutral room env) »*. La règle de `three` s'inverse alors : c'est
+      // `wallMat.envMapIntensity` qui compte, et `scene.environmentIntensity`
+      // qui est morte.
+      //
+      // ⚡ **MESURÉ AU MÊME INSTANT DANS LA MÊME PAGE** (La Réunion z12,
+      // `.banc/P8/S3-ambiante-P8.json`), irradiance à plat sur un mur vertical :
+      // relief **(1,526 · 1,526 · 1,526)** contre paroi **(0,989 · 0,947 ·
+      // 0,931)**. La paroi du crop prenait la première : **1,68 fois trop
+      // claire** (26,63 contre 15,88), contraste **1,52 fois trop faible**.
+      //
+      // ⚠️ **ON LIT LE MATÉRIAU, PAS `params` — la même règle que `paroiCouleur`
+      // vingt lignes plus bas** : un préréglage PBR repose `envMapIntensity`
+      // (`plinth.setMaterial`), et `params.envMapIntensity` ne le sait pas.
+      paroiAmbianteCoef: coefAmbiante(renderer, envParoi.texture),
+      paroiAmbianteIntensite: envParoi.intensite,
       // le fond contre lequel `mapTint` dose la peinture — `terrain.js:1137`
       albedoBase: `#${terrain.material.color.getHexString()}`,
       albedoTeinte: terrain.mapUniforms.uTint.value,
       // ══════ LA COULEUR DES PAROIS — Tâche P3, manque n° 2 ═══════════════
       //
       // ⛔ **`params.plinthColor` EST LE MAUVAIS NOMBRE, ET LE NOTEUR L'A MESURÉ
       // AU MÊME INSTANT DANS LA MÊME PAGE** : `params.plinthColor = #d8d4cc`,
       // `plinth.wallMat.color = c06a44`. `setColors` ne retient
       // `params.plinthColor` que si le socle n'est ni en verre ni sur un
       // préréglage PBR ; c'est donc le MATÉRIAU qui dit la vérité, jamais
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index 6451276..23cf1a3 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -216,20 +216,31 @@ export const CHAMPS_HABILLAGE = Object.freeze([
   'hemiCiel',
   'hemiSol',
   'hemiIntensite',
   // ⚠️ **L'AMBIANTE EST UN NOMBRE MESURÉ, PAS UNE CONSTANTE** : c'est
   // l'irradiance que `scene.environment` verse sur une surface diffuse
   // (`src/sonde-ambiante.js`), multipliée par les deux intensités vivantes. Elle
   // pèse **47 %** de l'irradiance totale du socle et suit le cycle horaire —
   // absente d'ici, le bloc s'éclairerait à l'ambiante de son premier instant.
   'ambianteCoef',
   'ambianteIntensite',
+  // ⛔ **ET LA PAROI A LA SIENNE, QUI N'EST PAS CELLE-LÀ — Tâche P8.** Le relief
+  // voit `scene.environment` (« the neutral room env ») ; la paroi voit son
+  // propre `wallMat.envMap` (« their own studio env map »), et `three`
+  // n'applique `scene.environmentIntensity` qu'aux matériaux SANS `envMap` à
+  // eux. La paroi du crop empruntait l'ambiante du RELIEF — **1,54 fois plus
+  // forte à plat sur un mur vertical**, les deux mesurées au même instant dans
+  // la même page — et en sortait **1,68 fois trop claire**. Les deux champs
+  // suivent la palette (un préréglage PBR repose `envMap` et `envMapIntensity`)
+  // et le cycle horaire, donc leur place est ICI et pas à la construction.
+  'paroiAmbianteCoef',
+  'paroiAmbianteIntensite',
   'albedoBase',
   'albedoTeinte',
   // ⚠️ **`paroiCouleur` N'EST PAS `params.plinthColor`, ET C'EST TOUT LE
   // DÉFAUT** : `plinth.setColors` ne retient `params.plinthColor` que si le socle
   // n'est ni en verre ni sur un préréglage PBR. Relevé au même instant dans la
   // même page : `params.plinthColor = #d8d4cc`, paroi vivante `c06a44`. La
   // valeur qui compte est celle du matériau, et elle change avec la palette
   // sans que les parois du crop soient rebâties — d'où sa place ICI.
   'paroiCouleur',
   // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
diff --git a/src/monde/eclairage-crop.js b/src/monde/eclairage-crop.js
index 4c48264..143de71 100644
--- a/src/monde/eclairage-crop.js
+++ b/src/monde/eclairage-crop.js
@@ -323,20 +323,77 @@ export function directionSoleilLocale(azDeg, elDeg, latDeg, lonDeg) {
 export function irradianceAmbiante(coef, envIntensite) {
   const k = Number.isFinite(envIntensite) ? Math.max(0, envIntensite) : 0
   const c = coef && Array.isArray(coef.ciel) && Array.isArray(coef.sol) ? coef : null
   if (!c || k === 0) return { ciel: [0, 0, 0], sol: [0, 0, 0] }
   return {
     ciel: [c.ciel[0] * k, c.ciel[1] * k, c.ciel[2] * k],
     sol: [c.sol[0] * k, c.sol[1] * k, c.sol[2] * k],
   }
 }
 
+/**
+ * L'ENVIRONNEMENT QU'UN MATÉRIAU VOIT VRAIMENT — Tâche P8.
+ *
+ * ⛔ **CE N'EST PAS UNE COMMODITÉ, C'EST LA RÈGLE DE `three`, ET LE CROP EN
+ * MANQUAIT LA MOITIÉ SUR SES PAROIS.** `WebGLRenderer.js` (r172) :
+ *
+ *     if ( material.isMeshStandardMaterial && material.envMap === null
+ *          && scene.environment !== null )
+ *         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
+ *
+ * Autrement dit : **un matériau qui porte SON PROPRE `envMap` ne voit ni
+ * `scene.environment` ni `scene.environmentIntensity`** — il voit SA texture, à
+ * SON intensité. `irradianceAmbiante` (juste au-dessus) cite déjà cette ligne
+ * pour conclure qu'`envMapIntensity` est du code MORT sur le relief
+ * (`terrain.material.envMap === null`, relevé). ⚡ **L'AUTRE MOITIÉ DE LA MÊME
+ * LIGNE N'AVAIT JAMAIS ÉTÉ TIRÉE : LA PAROI DU SOCLE, ELLE, A SON PROPRE
+ * `envMap`.** `plinth.js` l'écrit en toutes lettres à `setEnvMap` — *« give the
+ * socle walls their own studio env map (overrides scene.environment for this
+ * material only… while the terrain keeps the neutral room env) »* — et
+ * `main.js` lui pose `makeSocleEnvMap(renderer)`, une pièce SOMBRE (fond
+ * `0x15171d`, sol noir) à `envMapIntensity = 1`.
+ *
+ * ⚡ **LES DEUX AMBIANTES, MESURÉES AU MÊME INSTANT DANS LA PAGE VIVANTE**
+ * (2026-08-22, La Réunion z12, `.banc/P8/S3-ambiante-P8.json`), irradiance
+ * versée à plat sur une paroi VERTICALE (`ndu = 0`) :
+ *
+ *   · relief (`scene.environment` × `scene.environmentIntensity = 0,395`)
+ *     → **(1,526 · 1,526 · 1,526)**, rigoureusement neutre ;
+ *   · paroi (`wallMat.envMap` × `envMapIntensity = 1`)
+ *     → **(0,989 · 0,947 · 0,931)**.
+ *
+ * **La paroi du crop prenait la PREMIÈRE**, celle du relief. Elle en sortait
+ * **1,68 fois trop claire** (face sombre 26,63 contre 15,88 au socle) pour un
+ * contraste inter-faces **1,52 fois trop faible** — les deux constantes que la
+ * notation-02 §5 nomme.
+ *
+ * ⚠️ **ET LA CAUSE EST PROUVÉE EN LA BOUGEANT DES DEUX CÔTÉS** (leçon de P6 :
+ * une concordance au défaut n'est pas un branchement) :
+ *   · retirer son studio à la paroi DU SOCLE — elle retombe alors sur
+ *     `scene.environment`, c'est-à-dire sur la source du crop — la fait sauter
+ *     de **15,88 à 38,11** et effondre son contraste de **3,045 à 1,405** ;
+ *   · donner l'ambiante DE LA PAROI au crop le fait tomber de **26,63 à 17,87**
+ *     et monte son contraste de **2,008 à 2,490**.
+ *   **Les deux aller-retours rendent le chiffre de départ.**
+ *
+ * @param {object|null} envMap la texture propre au matériau
+ * @param {number} envMapIntensite son intensité à lui
+ * @param {object|null} sceneEnv `scene.environment`
+ * @param {number} sceneIntensite `scene.environmentIntensity`
+ * @returns {{texture: object|null, intensite: number}} ce que `three` fait lire
+ */
+export function environnementEffectif(envMap, envMapIntensite, sceneEnv, sceneIntensite) {
+  if (envMap) return { texture: envMap, intensite: Number.isFinite(envMapIntensite) ? Math.max(0, envMapIntensite) : 1 }
+  if (sceneEnv) return { texture: sceneEnv, intensite: Number.isFinite(sceneIntensite) ? Math.max(0, sceneIntensite) : 1 }
+  return { texture: null, intensite: 0 }
+}
+
 export const GLSL_OMBRE_PEINTURE = /* glsl */ `
 float natOmbrePeinture(float lum) {
   return clamp(lum * ${OMBRE_GAIN}, ${OMBRE_MIN}, ${OMBRE_MAX});
 }
 `
 
 /**
  * L'IRRADIANCE SEULE, détachable — Tâche P6.
  *
  * ⚠️ **PARCE QUE LES PAROIS N'ONT NI RAMPE NI PEINTURE, DONC PAS
diff --git a/src/monde/ecume-mer.js b/src/monde/ecume-mer.js
index 363b492..bd9ecbe 100644
--- a/src/monde/ecume-mer.js
+++ b/src/monde/ecume-mer.js
@@ -76,20 +76,87 @@ export const FONDU_HOULE_FIN = 0.1
  * normalisée sur quinze de ces mêmes unités. La calotte doit donc convertir sa
  * profondeur (unités de scène) avant d'appeler : c'est `uMerUnite`.
  *
  * @param {number} profondeur en unités de socle
  * @param {number} distance canal G du champ, déjà normalisé
  */
 export function declinRivage(profondeur, distance) {
   return Math.max(profondeur * POIDS_PROFONDEUR, distance)
 }
 
+/**
+ * Le poids du repli distance-au-rivage. `ocean.js` : `f.g * 1.6`.
+ * ⚠️ **UNE SEULE ÉCRITURE, ET `test/ecume-mer.test.js` VA LA RELIRE DANS
+ * `ocean.js`** — le jour où le socle change d'avis, le test rougit.
+ */
+export const REPLI_RIVAGE = 1.6
+
+/**
+ * ⛔ **LE REPLI DISTANCE-AU-RIVAGE — LA DEMI-LIGNE QUE LE CROP N'AVAIT PAS.**
+ * Tâche P8, manque n° 4 du noteur (« la frange côtière quantifiée en marches »).
+ *
+ * `ocean.js` (FRAG), en toutes lettres :
+ *
+ *     // real bathymetry when the tiles carry it; distance-to-shore as the
+ *     // stand-in where the sea floor is a flat 0 m plain (fine zooms)
+ *     float depth = max(uWaterY - f.r, f.g * 1.6);
+ *
+ * La calotte du crop écrivait `vProfondeur = max(-champ.r, 0.0)` — **la
+ * bathymétrie SEULE, sans le secours**. Or son champ n'en porte presque pas.
+ *
+ * ⚡ **MESURÉ SUR LE CHAMP VIVANT** (2026-08-22, La Réunion z12,
+ * `.banc/P8/S13-donnee-P8.json`) : le tableau fait 385 nœuds, soit **128 par
+ * largeur de bloc** — mais l'autocorrélation de sa DÉRIVÉE SECONDE le long
+ * d'une ligne pique à **3 nœuds** (force 0,261), et **25,8 %** des nœuds d'eau
+ * ont une dérivée seconde négligeable. **La donnée vraie est donc trois fois
+ * plus grossière que la grille : ~43 échantillons en travers de 10,4 km, un
+ * tous les 240 m.** Le commentaire de `CHAMP_FOND` (`globe.js`) l'annonçait
+ * déjà — « la bathymétrie plafonne à `BATHY_BASE_ZMAX = 8` — soit 48 pixels de
+ * donnée vraie en travers ».
+ *
+ * **Le glacis de lagon, qui vit sur les 15 % premiers du budget de profondeur,
+ * était donc peint sur un plateau à paliers : d'où les dents.** Mesuré à
+ * l'écran, cadrage côte, masques appariés à +0,52 % : le crop rendait un glacis
+ * de **11,7 %** de sa mer contre **7,97 %** au socle, et l'autocorrélation de
+ * sa dérivée seconde piquait à **12 px** avec une force de **0,22** quand celle
+ * du socle n'a **aucun pic**.
+ *
+ * ⚠️ **ET J'ÉTENDS LE REPLI PLUS LOIN QU'`ocean.js` — JE LE DIS, ET JE DIS
+ * POURQUOI.** `ocean.js` réserve `depth` à l'ALPHA et garde la bathymétrie
+ * SEULE pour le corps de l'eau, avec un avertissement : *« profondeur reelle
+ * (bathymetrie seule - pas le proxy distance-au-rivage, c'etait lui le halo) »*.
+ * **Sur le crop, le repli posé sur la seule alpha ne déplace RIEN** — A/B à
+ * aller-retour, même page, même seconde : glacis **11,72 %** contre 11,71 % au
+ * départ, force périodique **0,24**. Posé sur le GLACIS, il rend **9,69 %** et
+ * **0,048** ; sur les deux, **9,68 %** et **0,021**. ➡️ **Les dents vivent dans
+ * le glacis, pas dans l'alpha.** Le socle peut s'en passer parce que son champ
+ * couvre le bloc à 384 texels et lit la vraie descente du relief au rivage ; le
+ * crop, non. **Le halo qu'`ocean.js` redoute reste un risque DÉCLARÉ : il ne
+ * s'est pas montré à mes deux cadrages, et je ne l'ai pas cherché ailleurs.**
+ *
+ * @param {number} profondeur en unités de SCÈNE (celle de la calotte)
+ * @param {number} distance canal G du champ, normalisé sur ~15 unités de socle
+ * @param {number} unite `uMerUnite` — unités de scène par unité de socle
+ */
+export function profondeurEau(profondeur, distance, unite) {
+  const p = Math.max(0, profondeur)
+  if (!(unite > 0)) return p
+  // ⛔ **PAS DE `Math.max(0, distance)` ICI, ET C'EST UNE CAMPAGNE DE MUTATION
+  // QUI L'A DIT.** La première version en portait un ; la mutation qui le retire
+  // a SURVECU, et elle avait raison : `p` est déjà borné à zéro et `unite > 0`,
+  // donc une distance négative rend un produit négatif que le `Math.max` extérieur
+  // écarte de toute façon. **La garde était du CODE MORT** — le neuvième de ce
+  // chantier trouvé par une survivante. `ocean.js` n'en a pas non plus
+  // (`f.g * 1.6`, nu). On la retire plutôt que de la laisser rassurer.
+  return Math.max(p, distance * REPLI_RIVAGE * unite)
+}
+
 /** Le repère côtier LARGE que l'écume lit. `ocean.js:270`. */
 export function fonduRessac(declin) {
   return pas0a1(0, FONDU_RESSAC_FIN, declin)
 }
 
 /** Le fondu qui tue la houle au rivage. `ocean.js:268`. */
 export function fonduHoule(declin) {
   return pas0a1(0, FONDU_HOULE_FIN, declin)
 }
 
@@ -430,20 +497,26 @@ float glintTavelureMer(float tavelure) {
 vec3 blanchirEcume(vec3 col, float ecume, float jour) {
   return mix(col, vec3(${BLANC_ECUME.toFixed(2)}) * mix(${NUIT_ECUME.toFixed(2)}, 1.0, jour), ecume);
 }
 `
 
 export const GLSL_ECUME = /* glsl */ `
 // ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
 float declinRivageMer(float profondeur, float distance) {
   return max(profondeur * ${POIDS_PROFONDEUR.toFixed(1)}, distance);
 }
+// Le repli distance-au-rivage d'ocean.js, dans la monnaie de l'appelant.
+// Tache P8 : voir profondeurEau, le jumeau JS, pour la mesure qui l'exige.
+float profondeurEauMer(float profondeur, float distance, float unite) {
+  float p = max(profondeur, 0.0);
+  return max(p, distance * ${REPLI_RIVAGE.toFixed(1)} * unite);
+}
 float fonduRessacMer(float declin) {
   return smoothstep(0.0, ${FONDU_RESSAC_FIN.toFixed(2)}, declin);
 }
 float fonduHouleMer(float declin) {
   return smoothstep(0.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin);
 }
 float tavelureMer(float bruit) {
   return smoothstep(${TAVELURE_SEUIL.bas.toFixed(2)}, ${TAVELURE_SEUIL.haut.toFixed(2)}, bruit);
 }
 float largeurRessacMer(float fade) {
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
index 730bc52..991cfab 100644
--- a/test/crop-eclairage.test.js
+++ b/test/crop-eclairage.test.js
@@ -40,20 +40,21 @@ import {
   ECLAIRAGE_MONDE,
   natGris,
   natOmbrePeinture,
   natLum,
   albedoCrop,
   irradianceCrop,
   eclairerCrop,
   hautLocal,
   directionSoleilLocale,
   irradianceAmbiante,
+  environnementEffectif,
   GLSL_ECLAIRAGE,
   GLSL_OMBRE_PEINTURE,
 } from '../src/monde/eclairage-crop.js'
 import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
 import { LUMA_709 } from '../src/monde/naturel-crop.js'
 import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
 // ⚠️ **Tache P6** : le morceau d irradiance DETACHE, pour les parois.
 import { GLSL_IRRADIANCE } from '../src/monde/eclairage-crop.js'
 
 // ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
@@ -389,20 +390,25 @@ const CHAMPS_P3 = [
   'centreLon',
   'soleilAzimut',
   'soleilElevation',
   'soleilCouleur',
   'soleilIntensite',
   'hemiCiel',
   'hemiSol',
   'hemiIntensite',
   'ambianteCoef',
   'ambianteIntensite',
+  // ⚠️ **LES DEUX DE LA PAROI — Tâche P8.** Elles sont dans cette liste-ci et
+  // pas seulement dans `CHAMPS_HABILLAGE` pour que ④j leur impose la même
+  // exigence qu'aux vingt-sept autres : lire une SOURCE VIVANTE.
+  'paroiAmbianteCoef',
+  'paroiAmbianteIntensite',
   'albedoBase',
   'albedoTeinte',
   'paroiCouleur',
   'surfaceFx',
   'fxBlend',
   'fxOpacity',
   'fxScale',
   'fxColA',
   'fxColB',
   'fxColC',
@@ -448,21 +454,35 @@ test('④c contexteCrop lit les LAMPES et le MATÉRIAU, jamais params', () => {
   assert.match(ctx, /hemiCiel: `#\$\{hemi\.color\.getHexString\(\)\}`/)
   assert.match(ctx, /hemiSol: `#\$\{hemi\.groundColor\.getHexString\(\)\}`/)
   assert.match(ctx, /hemiIntensite: hemi\.intensity/)
   // ⛔ la paroi vient du MATÉRIAU, pas de `params.plinthColor` — relevé au même
   // instant : `params.plinthColor = #d8d4cc` et la paroi vivante `c06a44`
   assert.match(ctx, /paroiCouleur: `#\$\{plinth\.wallMat\.color\.getHexString\(\)\}`/)
   assert.equal(/paroiCouleur:\s*params\.plinthColor/.test(ctx), false)
   // l'ambiante est MESURÉE, et sur la seule intensité que three applique
   assert.match(ctx, /ambianteCoef: coefAmbiante\(renderer, scene\.environment\)/)
   assert.match(ctx, /ambianteIntensite: scene\.environmentIntensity/)
-  assert.equal(/envMapIntensity/.test(ctx), false)
+  // ⛔ **ET LA PAROI A LA SIENNE — Tâche P8.** `envMapIntensity` est du code
+  // MORT sur le RELIEF (`terrain.material.envMap === null`, et `three` écrase
+  // alors l'uniforme par `scene.environmentIntensity`) — la ligne ci-dessus le
+  // garde. Mais la PAROI porte son propre `envMap` (`plinth.setEnvMap` ←
+  // `makeSocleEnvMap`), donc pour elle c'est l'inverse : `envMapIntensity`
+  // compte et `scene.environmentIntensity` est morte. Le crop prenait
+  // l'ambiante du relief sur ses parois — **1,68 fois trop claires**.
+  assert.equal(/ambianteIntensite:.*envMapIntensity/.test(ctx), false)
+  assert.match(ctx, /paroiAmbianteCoef: coefAmbiante\(renderer, envParoi\.texture\)/)
+  assert.match(ctx, /paroiAmbianteIntensite: envParoi\.intensite/)
+  // ⚠️ **LA RÈGLE VIENT DU MODULE PUR, ET LE MATÉRIAU DIT LA VÉRITÉ** — même
+  // règle que `paroiCouleur` : `params.envMapIntensity` vaut 0,15 pendant que
+  // le matériau vivant porte 1 (un préréglage PBR le repose).
+  assert.match(ctx, /environnementEffectif\(\s*plinth\?\.wallMat\?\.envMap \?\? null,\s*plinth\?\.wallMat\?\.envMapIntensity,/)
+  assert.equal(/params\.envMapIntensity/.test(ctx), false)
   // la couche Apparence vient des uniformes du socle
   for (const u of ['uSurfaceFx', 'uFxBlend', 'uFxOpacity', 'uFxScale', 'uFxP1', 'uFxP2', 'uFxP3']) {
     assert.match(ctx, new RegExp(`terrain\\.mapUniforms\\.${u}\\.value`))
   }
   assert.match(ctx, /fxDemiBloc: terrain\.mapUniforms\.uSlabHalf/)
   // le lieu du crop, l'albédo et sa teinte — les trois que la campagne de
   // mutation a trouvés NON COUVERTS au premier tour (voir ④j)
   assert.match(ctx, /centreLat: centre\.lat/)
   assert.match(ctx, /centreLon: centre\.lon/)
   assert.match(ctx, /albedoBase: `#\$\{terrain\.material\.color\.getHexString\(\)\}`/)
@@ -479,40 +499,47 @@ test('④j ⛔ CHAQUE champ surveillé lit une SOURCE VIVANTE — aucun ne peut
   // ⚠️ **ON N'ÉNUMÈRE PLUS À LA MAIN** : la liste vient de `CHAMPS_HABILLAGE`,
   // donc un champ ajouté demain est couvert dès son ajout — c'est la leçon que
   // `uHemi` a coûtée à la Tâche P2, dont le ④c ne vérifiait que trois curseurs
   // sur dix.
   const ctx = MAIN_SRC.slice(
     MAIN_SRC.indexOf('function contexteCrop()'),
     MAIN_SRC.indexOf('\nconst veilleCrop')
   ).replace(/\/\/[^\n]*/g, '')
   // une source vivante : un uniforme du socle, une lampe, la scène, le
   // matériau, le socle-plinthe, le centre du crop, ou la sonde d'ambiante.
-  const VIVANT = /^\s*(terrain\.|sun\.|hemi\.|scene\.|plinth\.|centre\.|coefAmbiante\(|params\.sun|`#\$\{)/
+  // ⚠️ `envParoi.` est vivant parce qu'il est BÂTI juste au-dessus depuis
+  // `plinth?.wallMat` — c'est ④c qui garde CETTE ligne-là.
+  const VIVANT = /^\s*(terrain\.|sun\.|hemi\.|scene\.|plinth\.|centre\.|coefAmbiante\(|envParoi\.|params\.sun|`#\$\{)/
   let n = 0
   for (const champ of CHAMPS_P3) {
     const m = ctx.match(new RegExp(`\\n\\s*${champ}:([^\\n]*)`))
     assert.ok(m, `${champ} n'est pas rempli par contexteCrop`)
     assert.match(m[1], VIVANT, `${champ} est figé : « ${m[1].trim()} »`)
     n++
   }
   assert.equal(n, CHAMPS_P3.length)
-  assert.equal(n, 27) // le dénominateur est COMPTÉ, pas annoncé par le titre
+  assert.equal(n, 29) // le dénominateur est COMPTÉ, pas annoncé par le titre
 })
 
 test('④d poserHabillage POSE les uniformes, et retirerHabillage les REND', () => {
   const g = new Globe({ radius: 100 })
   const u = g.uniforms
   const depart = {
     eclairage: u.uEclairageOn.value,
     soleil: u.uSoleilIrr.value.toArray(),
     ciel: u.uCielIrr.value.toArray(),
     sol: u.uSolIrr.value.toArray(),
+    // ⚠️ **LES DEUX DE LA PAROI — Tâche P8.** Sans eux, la mutation qui retire
+    // leur remise à zéro de `retirerHabillage` SURVIT : elle l'a fait au premier
+    // tour de la campagne.
+    paroiCiel: u.uParoiCielIrr.value.toArray(),
+    paroiSol: u.uParoiSolIrr.value.toArray(),
     base: u.uAlbedoBase.value.toArray(),
     teinte: u.uAlbedoTeinte.value,
     paroi: u.uParoiCouleur.value.getHexString(),
     fx: u.uSurfaceFx.value,
     fxOp: u.uFxOpacite.value,
   }
   assert.equal(depart.eclairage, 0) // ⚠️ la garde MONDE, comme uCropOn et uHabOn
   assert.equal(depart.fx, APPARENCE_MONDE.surfaceFx)
 
   g.poserHabillage({
@@ -551,29 +578,34 @@ test('④d poserHabillage POSE les uniformes, et retirerHabillage les REND', ()
   assert.equal(u.uFxOpacite.value, 0.44)
   assert.equal(u.uFxScale.value, 1.5)
   assert.equal(u.uFxColB.value.getHexString(), 'c9885a')
   assert.deepEqual(u.uFxFenetre.value.toArray(), [3, -4])
   assert.equal(u.uAlbedoTeinte.value, 0.68)
   // ⚠️ **L'IRRADIANCE PORTE L'INTENSITÉ**, comme `WebGLLights` la porte
   assert.ok(u.uSoleilIrr.value.x > 3.7 && u.uSoleilIrr.value.x <= 3.74)
   // ⚠️ **ET L'AMBIANTE S'AJOUTE À L'HÉMISPHÈRE, ELLE NE VIT PAS À CÔTÉ**
   assert.ok(u.uCielIrr.value.x > 1, 'le ciel porte l’ambiante mesurée')
   assert.ok(u.uSolIrr.value.x > 0.19, 'le sol porte l’ambiante mesurée')
+  // ⚠️ **ET CE N'EST PAS UN BANC VIDE** : sans donnée de paroi, ses deux
+  // uniformes portent le repli, c'est-à-dire ceux des tuiles — non nuls.
+  assert.ok(u.uParoiCielIrr.value.x > 1, 'la paroi porte le repli, pas zéro')
   // la verticale locale et le soleil sont des vecteurs UNITAIRES
   assert.ok(Math.abs(u.uHemiHaut.value.length() - 1) < 1e-9)
   assert.ok(Math.abs(u.uSoleilDir.value.length() - 1) < 1e-9)
 
   g.retirerHabillage()
   assert.equal(u.uEclairageOn.value, depart.eclairage)
   assert.deepEqual(u.uSoleilIrr.value.toArray(), depart.soleil)
   assert.deepEqual(u.uCielIrr.value.toArray(), depart.ciel)
   assert.deepEqual(u.uSolIrr.value.toArray(), depart.sol)
+  assert.deepEqual(u.uParoiCielIrr.value.toArray(), depart.paroiCiel)
+  assert.deepEqual(u.uParoiSolIrr.value.toArray(), depart.paroiSol)
   assert.deepEqual(u.uAlbedoBase.value.toArray(), depart.base)
   assert.equal(u.uAlbedoTeinte.value, depart.teinte)
   assert.equal(u.uParoiCouleur.value.getHexString(), depart.paroi)
   assert.equal(u.uSurfaceFx.value, depart.fx)
   assert.equal(u.uFxOpacite.value, depart.fxOp)
 })
 
 test('④e SANS LIEU, PAS D’ÉCLAIRAGE — le repère est une dépendance', () => {
   // ⛔ L'azimut et l'élévation sont exprimés dans le repère du SOCLE. Sans la
   // latitude et la longitude du centre du crop, les replacer dans celui du
@@ -777,23 +809,39 @@ test('⑤g les défauts MONDE sont ceux des modules, pas des nombres recopiés',
 // **60 / 72**, et CINQ des onze survivantes visaient ce seul nuanceur — il
 // n'était gardé par rien du tout. On EXÉCUTE ce qui s'exécute (l'identité des
 // uniformes partagés) et on DÉCLARE ce qui ne s'exécute pas (le texte GLSL).
 
 test('⑥a `_materiauParois` PARTAGE les uniformes du bloc — pas des copies', () => {
   const g = new Globe({ radius: 100 })
   const m = g._materiauParois()
   // ⚠️ **PARTAGÉS, ET C'EST CE QUI FAIT QUE LA TIRETTE D'HEURE LES DÉPLACE.**
   // `poserHabillage` écrit dans `this.uniforms` ; les parois ne sont rebâties
   // qu'à l'arrêt. Des copies figeraient leur soleil à la naissance du bloc.
-  for (const nom of ['uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uCielIrr', 'uSolIrr', 'uEclairageOn']) {
+  for (const nom of ['uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uEclairageOn']) {
     assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit être PARTAGÉ avec les tuiles`)
   }
+  // ⛔ **MAIS PAS L'AMBIANTE, ET C'EST LE MANQUE N° 3 DU NOTEUR — Tâche P8.**
+  // Le relief du socle voit `scene.environment` à `scene.environmentIntensity` ;
+  // sa PAROI voit son propre `wallMat.envMap` à `envMapIntensity`, parce que
+  // `three` n'écrase l'intensité que sur les matériaux SANS `envMap` à eux.
+  // Mesuré au même instant dans la même page : l'ambiante du relief verse
+  // **1,54 fois** celle de la paroi à plat sur un mur vertical, et la paroi du
+  // crop prenait la première — **26,63 contre 15,88 au socle**.
+  // ⚠️ **ILS EXISTENT, D'ABORD.** Sans cette ligne, retirer purement et
+  // simplement les deux uniformes du constructeur laisse `undefined === undefined`
+  // et la mutation survit — elle l'a fait au premier tour de la campagne.
+  assert.ok(m.uniforms.uCielIrr && m.uniforms.uCielIrr.value, 'uCielIrr doit exister')
+  assert.ok(m.uniforms.uSolIrr && m.uniforms.uSolIrr.value, 'uSolIrr doit exister')
+  assert.equal(m.uniforms.uCielIrr, g.uniforms.uParoiCielIrr, 'la paroi lit SON ciel')
+  assert.equal(m.uniforms.uSolIrr, g.uniforms.uParoiSolIrr, 'la paroi lit SON sol')
+  assert.notEqual(m.uniforms.uCielIrr, g.uniforms.uCielIrr, 'la paroi ne lit PAS le ciel des tuiles')
+  assert.notEqual(m.uniforms.uSolIrr, g.uniforms.uSolIrr, 'la paroi ne lit PAS le sol des tuiles')
   // les trois d'avant P6 le restent — le repli de planète existe encore
   for (const nom of ['uSunDir', 'uShadowColor']) {
     assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit rester partagé`)
   }
   assert.equal(m.uniforms.uCol, g.uniforms.uParoiCouleur, 'la couleur de paroi vit dans this.uniforms')
   // ⚠️ **LE TÉMOIN** : un uniforme qui n'a rien à faire là ne doit PAS être
   // partagé, sinon la boucle ci-dessus passerait sur n'importe quel matériau.
   assert.equal(m.uniforms.uRamp, undefined)
 })
 
@@ -827,10 +875,119 @@ test('⑥c `GLSL_IRRADIANCE` est INJECTÉ dans `GLSL_ECLAIRAGE`, jamais réécri
   assert.match(src, /\$\{GLSL_IRRADIANCE\}\nvec3 eclairerCrop/)
   // une seule écriture du corps, dans le morceau détaché
   const nCorps = (src.match(/soleil \* max\(ndl, 0\.0\) \+ mix\(sol, ciel, 0\.5 \* ndu \+ 0\.5\)/g) || []).length
   assert.equal(nCorps, 1, `la loi doit être écrite UNE fois, pas ${nCorps}`)
   // …et le texte assemblé la porte quand même
   assert.match(GLSL_ECLAIRAGE, /vec3 irradianceCrop\(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol\)/)
   // ⚠️ **ET LE GLOBE INJECTE LE MORCEAU DÉTACHÉ DANS LES PAROIS**, une fois.
   assert.equal((GLOBE_NU.match(/\$\{GLSL_IRRADIANCE\}/g) || []).length, 1)
   assert.match(GLOBE_NU, /GLSL_IRRADIANCE,/)
 })
+
+// ══════════ ⑦ L'AMBIANTE DE LA PAROI N'EST PAS CELLE DU RELIEF — Tâche P8 ═══
+//
+// ⛔ **LE MANQUE N° 3 DU NOTEUR TENAIT DANS UNE MOITIÉ DE LIGNE DE `three`.**
+// `sonde-ambiante.js` la cite depuis P3 :
+//
+//     if ( material.isMeshStandardMaterial && material.envMap === null
+//          && scene.environment !== null )
+//         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
+//
+// et en tire, à raison, qu'`envMapIntensity` est du code MORT sur le relief.
+// **L'autre moitié n'avait jamais été tirée** : la PAROI du socle porte son
+// propre `envMap` (`plinth.setEnvMap(makeSocleEnvMap(renderer))`, une pièce
+// SOMBRE à fond `0x15171d` et sol noir), donc pour elle la règle s'inverse.
+//
+// ⚡ **LES DEUX AMBIANTES, MESURÉES AU MÊME INSTANT DANS LA PAGE VIVANTE**
+// (`.banc/P8/S3-ambiante-P8.json`), à plat sur un mur vertical :
+// relief **(1,526 · 1,526 · 1,526)** contre paroi **(0,989 · 0,947 · 0,931)**.
+// La paroi du crop prenait la première : **26,63 contre 15,88 au socle**.
+
+test('⑦a `environnementEffectif` applique la règle de three, pas une commodité', () => {
+  const propre = { nom: 'studio' }
+  const scene = { nom: 'salle' }
+  // ⛔ un matériau qui a SON `envMap` ne voit NI la texture de scène NI son
+  // intensité — c'est le cas de la paroi du socle
+  assert.deepEqual(environnementEffectif(propre, 1, scene, 0.395), { texture: propre, intensite: 1 })
+  assert.deepEqual(environnementEffectif(propre, 1.4, scene, 0.395), { texture: propre, intensite: 1.4 })
+  // … et un matériau SANS `envMap` voit celle de la scène, à l'intensité de la
+  // scène : c'est le cas du relief, et c'est ce que P3 avait déjà mesuré
+  assert.deepEqual(environnementEffectif(null, 0.15, scene, 0.395), { texture: scene, intensite: 0.395 })
+  // ⚠️ **LE TÉMOIN QUI TUE LA MUTATION « on prend toujours la scène »** : les
+  // deux appels ci-dessous rendent des textures DIFFÉRENTES pour la même scène.
+  assert.notEqual(
+    environnementEffectif(propre, 1, scene, 0.395).texture,
+    environnementEffectif(null, 1, scene, 0.395).texture
+  )
+  // rien du tout : pas de lumière, et surtout pas une intensité qui traîne
+  assert.deepEqual(environnementEffectif(null, 1, null, 0.395), { texture: null, intensite: 0 })
+  // une intensité absente ou aberrante ne fabrique pas un `NaN` d'irradiance
+  assert.deepEqual(environnementEffectif(propre, undefined, scene, 0.4), { texture: propre, intensite: 1 })
+  assert.deepEqual(environnementEffectif(propre, NaN, scene, 0.4), { texture: propre, intensite: 1 })
+  assert.deepEqual(environnementEffectif(propre, -3, scene, 0.4), { texture: propre, intensite: 0 })
+  assert.deepEqual(environnementEffectif(null, 1, scene, undefined), { texture: scene, intensite: 1 })
+})
+
+test('⑦b la paroi prend SON ambiante, les tuiles gardent la LEUR', () => {
+  const g = new Globe({ radius: 100 })
+  const u = g.uniforms
+  const commun = {
+    centreLat: -21.115, centreLon: 55.536, soleilAzimut: 302.02, soleilElevation: 34.33,
+    soleilCouleur: '#fff7e6', soleilIntensite: 3.743,
+    hemiCiel: '#85c2eb', hemiSol: '#4a3a2a', hemiIntensite: 0.8105,
+  }
+  // les DEUX coefficients RÉELS, relevés par la sonde du dépôt le 2026-08-22
+  const RELIEF = { ciel: [6.6827, 6.6827, 6.6827], sol: [1.0452, 1.0452, 1.0452] }
+  const PAROI = { ciel: [1.8348, 1.7796, 1.7636], sol: [0.1436, 0.1137, 0.0987] }
+  g.poserHabillage({
+    ...commun,
+    ambianteCoef: RELIEF, ambianteIntensite: 0.3951,
+    paroiAmbianteCoef: PAROI, paroiAmbianteIntensite: 1,
+  })
+  // ⚠️ **LA LAMPE HÉMISPHÉRIQUE EST LA MÊME DES DEUX CÔTÉS** — elle éclaire
+  // toute la scène ; seul l'environnement diffère. On vérifie donc l'ÉCART, qui
+  // doit valoir exactement la différence des deux ambiantes.
+  const ecartCiel = u.uCielIrr.value.x - u.uParoiCielIrr.value.x
+  assert.ok(Math.abs(ecartCiel - (6.6827 * 0.3951 - 1.8348)) < 1e-6, 'ecart ciel ' + ecartCiel)
+  const ecartSol = u.uSolIrr.value.x - u.uParoiSolIrr.value.x
+  assert.ok(Math.abs(ecartSol - (1.0452 * 0.3951 - 0.1436)) < 1e-6, 'ecart sol ' + ecartSol)
+  // ⛔ **ET LE SENS COMPTE** : c'est le relief qui est le PLUS clair à plat sur
+  // un mur vertical (1,526 contre 0,989 mesuré), donc la paroi doit être PLUS
+  // SOMBRE. Une mutation qui échangerait les deux passerait l'égalité ci-dessus
+  // au signe près ; elle ne passe pas celle-ci.
+  const platTuiles = (u.uCielIrr.value.x + u.uSolIrr.value.x) / 2
+  const platParoi = (u.uParoiCielIrr.value.x + u.uParoiSolIrr.value.x) / 2
+  assert.ok(platParoi < platTuiles, 'la paroi doit etre plus sombre que les tuiles')
+  assert.ok(platTuiles / platParoi > 1.3, 'rapport mesure 1,54 ; ici ' + platTuiles / platParoi)
+  // ⚡ **ET LE MATÉRIAU DE PAROI LIT BIEN CES DEUX-LÀ** (⑥a garde l'identité ;
+  // ici on garde la VALEUR, donc le chemin entier de `poserHabillage` au GPU)
+  const m = g._materiauParois()
+  assert.equal(m.uniforms.uCielIrr.value.x, u.uParoiCielIrr.value.x)
+  assert.notEqual(m.uniforms.uCielIrr.value.x, u.uCielIrr.value.x)
+})
+
+test('⑦c SANS donnée de paroi, la paroi retombe sur les tuiles — AU BIT PRÈS', () => {
+  // ⚠️ **L'INTERRUPTEUR EST L'ABSENCE DE DONNÉE**, le patron de `uCropOn`,
+  // `uHabOn`, `coastMask` et `sol`. Un appelant qui ne connaît pas encore ces
+  // deux champs doit rendre l'image d'AVANT la Tâche P8, pas une paroi noire.
+  const g = new Globe({ radius: 100 })
+  const u = g.uniforms
+  const base = {
+    centreLat: -21.115, centreLon: 55.536, soleilAzimut: 302.02, soleilElevation: 34.33,
+    soleilCouleur: '#fff7e6', soleilIntensite: 3.743,
+    hemiCiel: '#85c2eb', hemiSol: '#4a3a2a', hemiIntensite: 0.8105,
+    ambianteCoef: { ciel: [6.6827, 6.6827, 6.6827], sol: [1.0452, 1.0452, 1.0452] },
+    ambianteIntensite: 0.3951,
+  }
+  g.poserHabillage({ ...base })
+  assert.deepEqual(u.uParoiCielIrr.value.toArray(), u.uCielIrr.value.toArray())
+  assert.deepEqual(u.uParoiSolIrr.value.toArray(), u.uSolIrr.value.toArray())
+  // ⚠️ **ET CE N'EST PAS UN BANC VIDE** : les valeurs ne sont ni nulles ni le
+  // défaut MONDE — sans ça, l'égalité ci-dessus serait « zéro égale zéro ».
+  assert.ok(u.uParoiCielIrr.value.x > 2, 'le repli porte une vraie irradiance')
+  assert.notDeepEqual(u.uParoiCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
+  // … et une ambiante de paroi NULLE n'est PAS le repli : un matériau dont
+  // l'environnement a été retiré doit garder sa seule lampe hémisphérique.
+  g.poserHabillage({ ...base, paroiAmbianteCoef: null, paroiAmbianteIntensite: 0 })
+  assert.ok(u.uParoiCielIrr.value.x < u.uCielIrr.value.x, 'ambiante nulle, pas repli')
+  assert.ok(u.uParoiCielIrr.value.x > 0.18, 'la lampe hemispherique reste')
+})
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index c6a57a9..6d63e89 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -577,20 +577,22 @@ const couleurStub = (hex) => ({
   setStyle(v) { this.hex = v },
 })
 // ⚠️ **UN VECTEUR À TROIS COMPOSANTES POUR LES IRRADIANCES — Tâche P3.** Elles
 // ne sont ni des couleurs (elles dépassent 1) ni des `vec2` : les poster dans
 // un stub à deux composantes aurait laissé le canal bleu invisible à ⑨h.
 const vec3 = (x, y, z) => ({
   x, y, z,
   set(a, b, c) { this.x = a; this.y = b; this.z = c; return this },
   fromArray(t) { this.x = t[0]; this.y = t[1]; this.z = t[2]; return this },
   normalize() { const n = Math.hypot(this.x, this.y, this.z) || 1; this.x /= n; this.y /= n; this.z /= n; return this },
+  // `copy` : le repli de l'ambiante de paroi sur celle des tuiles (Tâche P8)
+  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this },
 })
 
 /** Un globe minimal : rien que les uniformes et le repère du crop. */
 function globeStub(crop = REPERE) {
   return {
     _crop: crop,
     uniforms: {
       uHabOn: val(0),
       uCoastMask: val(null),
       uCoastMaskOn: val(0),
@@ -632,20 +634,25 @@ function globeStub(crop = REPERE) {
       //
       // ⚠️ **AUX MÊMES VALEURS QUE LE CONSTRUCTEUR**, pour la raison écrite
       // dix lignes plus haut : c'est ce qui rend ⑨h capable de voir un
       // uniforme que `retirerHabillage` oublierait de rendre.
       uEclairageOn: val(0),
       uSoleilDir: val(vec3(0, 1, 0)),
       uSoleilIrr: val(vec3(...ECLAIRAGE_MONDE.soleilIrr)),
       uHemiHaut: val(vec3(0, 1, 0)),
       uCielIrr: val(vec3(...ECLAIRAGE_MONDE.cielIrr)),
       uSolIrr: val(vec3(...ECLAIRAGE_MONDE.solIrr)),
+      // ⚠️ **LES DEUX DE LA PAROI — Tâche P8.** Elles partent des MÊMES défauts
+      // que celles des tuiles (le constructeur du globe fait pareil) : c'est ce
+      // qui permet à ⑨h de voir un `retirerHabillage` qui les oublierait.
+      uParoiCielIrr: val(vec3(...ECLAIRAGE_MONDE.cielIrr)),
+      uParoiSolIrr: val(vec3(...ECLAIRAGE_MONDE.solIrr)),
       uAlbedoBase: val(vec3(...ECLAIRAGE_MONDE.albedoBase)),
       uAlbedoTeinte: val(ECLAIRAGE_MONDE.albedoTeinte),
       uParoiCouleur: val(couleurStub('#d8d4cc')),
       uSurfaceFx: val(APPARENCE_MONDE.surfaceFx),
       uFxBlend: val(APPARENCE_MONDE.fxBlend),
       uFxOpacite: val(APPARENCE_MONDE.fxOpacity),
       uFxScale: val(APPARENCE_MONDE.fxScale),
       uFxTime: val(APPARENCE_MONDE.fxTime),
       uFxColA: val(couleurStub(APPARENCE_MONDE.fxColA)),
       uFxColB: val(couleurStub(APPARENCE_MONDE.fxColB)),
diff --git a/test/crop-naturel.test.js b/test/crop-naturel.test.js
index dec9738..5530be1 100644
--- a/test/crop-naturel.test.js
+++ b/test/crop-naturel.test.js
@@ -628,21 +628,21 @@ test('⑤d le pivot, la limite des arbres et le voile lisent hNormRelief — l
   assert.equal(plancherPivot(0), MARGE_PIVOT)
   // les trois lecteurs de l'échelle du socle emploient hNormRelief, aucun hNorm
   for (const appel of ['natRampT(hNormRelief,', 'natHumiditeY(anl.b, anl.a, hNormRelief,', 'natVoile(hNormRelief,']) {
     assert.ok(FRAG_GLOBE.includes(appel), `${appel} : un lecteur est resté sur l’échelle de la Tâche D`)
   }
 })
 
 // --- le stub, en fin de fichier : il n'est utile qu'aux tests ④
 
 const val = (v) => ({ value: v })
-const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this } })
+const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this }, copy() { return this } })
 const couleurStub = () => ({ set() {}, setStyle() {} })
 function globeStub() {
   return {
     _crop: null,
     uniforms: {
       uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
       uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
       uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
       uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
       uGrainForceM: val(0), uGrainEchelle: val(96),
@@ -655,20 +655,21 @@ function globeStub() {
       uHazeAmt: val(NATUREL_MONDE.hazeAmt), uHazeAlt: val(NATUREL_MONDE.hazeAlt),
       uHazeDist: val(NATUREL_MONDE.hazeDist),
       uHazeColor: val({ hex: NATUREL_MONDE.hazeColor, set(v) { this.hex = v } }),
       // ══════ L'ÉCLAIRAGE ET LA COUCHE APPARENCE — Tâche P3 ═══════════════
       // Ce stub n'exerce que ④ : il lui suffit de PORTER les uniformes que
       // `poserHabillage` écrit. Leur aller-retour bit à bit est vérifié par
       // `crop-habillage` ⑨h et par `crop-eclairage` ④d.
       uEclairageOn: val(0),
       uSoleilDir: val(vecStub()), uSoleilIrr: val(vecStub()),
       uHemiHaut: val(vecStub()), uCielIrr: val(vecStub()), uSolIrr: val(vecStub()),
+      uParoiCielIrr: val(vecStub()), uParoiSolIrr: val(vecStub()),
       uAlbedoBase: val(vecStub()), uAlbedoTeinte: val(1),
       uParoiCouleur: val(couleurStub()),
       uSurfaceFx: val(0), uFxBlend: val(0), uFxOpacite: val(0), uFxScale: val(1), uFxTime: val(0),
       uFxColA: val(couleurStub()), uFxColB: val(couleurStub()), uFxColC: val(couleurStub()),
       uFxP1: val(0), uFxP2: val(0), uFxP3: val(0),
       uFxDemiBloc: val(28), uFxFenetre: val({ set() {} }),
     },
   }
 }
 
diff --git a/test/ecume-mer.test.js b/test/ecume-mer.test.js
index 1e020e6..297a06c 100644
--- a/test/ecume-mer.test.js
+++ b/test/ecume-mer.test.js
@@ -20,20 +20,22 @@ import test from 'node:test'
 import assert from 'node:assert/strict'
 import { readFileSync } from 'node:fs'
 
 import {
   lisse01,
   pas0a1,
   POIDS_PROFONDEUR,
   FONDU_RESSAC_FIN,
   FONDU_HOULE_FIN,
   declinRivage,
+  REPLI_RIVAGE,
+  profondeurEau,
   fonduRessac,
   fonduHoule,
   ACCALMIE_NEUTRE,
   accalmieDuSocle,
   FREQ_TAVELURE,
   TAVELURE_SEUIL,
   POIDS_RESSAC,
   POIDS_LISERE,
   BLANC_ECUME,
   ecumeMoutons,
@@ -1119,10 +1121,110 @@ test('⑧l l ORDRE de `opaciteEau` est celui d ocean.js, et le clamp N EST PAS m
   let mord = 0
   for (let d = 0; d <= 1.0001; d += 0.01) {
     for (let t = LAGON_FIN; t <= 1.0001; t += 0.01) {
       const brut = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(d, OPACITE_EAU.expo)
       const x = brut * (TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * t)
       if (x > OPACITE_ECRETAGE.haut || x < OPACITE_ECRETAGE.bas) mord++
     }
   }
   assert.equal(mord, 0, 'l ecretage ne doit jamais mordre la ou le glacis est plein')
 })
+
+// ══════════ ⑦ LE REPLI DISTANCE-AU-RIVAGE — Tâche P8, manque n° 4 ══════════
+//
+// ⛔ **« LA FRANGE CÔTIÈRE QUANTIFIÉE EN MARCHES » TENAIT DANS UNE DEMI-LIGNE.**
+// `ocean.js` : `float depth = max(uWaterY - f.r, f.g * 1.6);` — la bathymétrie,
+// **et la distance au rivage en secours là où le fond marin est une plaine
+// plate**. La calotte du crop n'avait que la bathymétrie, et son champ ne porte
+// qu'un échantillon VRAI tous les 240 m (mesuré : autocorrélation de la dérivée
+// seconde du champ vivant, pic à 3 nœuds sur une grille de 128 par largeur de
+// bloc). Le glacis de lagon était donc peint sur un plateau à paliers.
+
+test('⑦a `profondeurEau` est le `max(bathymétrie, distance × 1,6)` d ocean.js', () => {
+  // ⚠️ **LA MONNAIE FAIT PARTIE DE LA LOI** : `f.g` est normalisé sur ~15 unités
+  // de SOCLE, `vProfondeur` est en unités de SCÈNE. C'est `uMerUnite` qui les
+  // réconcilie, et c'est la cinquième fois que ce chantier voit une valeur juste
+  // dans la mauvaise monnaie.
+  const unite = 0.008226960014635628 // relevé dans la page vivante, La Réunion z12
+  // la bathymétrie domine : le repli ne fait rien
+  assert.equal(profondeurEau(1, 0.001, unite), 1)
+  // le repli domine : 0,5 × 1,6 × unité
+  assert.equal(profondeurEau(0, 0.5, unite), 0.5 * REPLI_RIVAGE * unite)
+  // ⛔ **LE TÉMOIN DE MONNAIE** : sans la conversion, le repli vaudrait 0,8 —
+  // quarante-neuf fois la profondeur maximale mesurée du crop (0,0169 unité).
+  assert.ok(0.5 * REPLI_RIVAGE > 48 * profondeurEau(0, 0.5, unite))
+  // les gardes : une unité absente ou nulle rend la bathymétrie SEULE, jamais NaN
+  assert.equal(profondeurEau(0.3, 0.9, 0), 0.3)
+  assert.equal(profondeurEau(0.3, 0.9, NaN), 0.3)
+  assert.equal(profondeurEau(-2, 0.9, 0), 0)
+  // ⚠️ **UNE DISTANCE NÉGATIVE EST ÉCARTÉE PAR LE `max` EXTÉRIEUR, PAS PAR UNE
+  // GARDE** — la garde qui existait ici était du CODE MORT, et c'est une
+  // survivante de la campagne qui l'a dit. L'assertion reste : elle documente le
+  // comportement, elle ne prétend plus garder une ligne.
+  assert.equal(profondeurEau(0.2, -5, unite), 0.2)
+  assert.equal(profondeurEau(0, -5, unite), 0)
+  // monotone en distance, jamais sous la bathymétrie
+  let prec = -1
+  for (let d = 0; d <= 1.0001; d += 0.01) {
+    const v = profondeurEau(0.004, d, unite)
+    assert.ok(v >= 0.004 - 1e-12, 'jamais sous la bathymetrie')
+    assert.ok(v >= prec - 1e-12, 'monotone')
+    prec = v
+  }
+})
+
+test('⑦b `REPLI_RIVAGE` remonte à `ocean.js`, et le test le RELIT là-bas', () => {
+  // ⚠️ **PAS UN LITTÉRAL RECOPIÉ DANS UN TEST** : un chiffre recopié ne rougit
+  // pas quand la source change sous lui. On lit la ligne d'`ocean.js`.
+  const o = sansCommentaires(ocean())
+  const m = /max\(uWaterY - f\.r, f\.g \* ([0-9.]+)\)/.exec(o)
+  assert.ok(m, 'la ligne de repli d ocean.js a disparu ou changé de forme')
+  assert.equal(Number(m[1]), REPLI_RIVAGE)
+})
+
+test('⑦c le GLSL `profondeurEauMer` calcule ce que le jumeau JS calcule', () => {
+  const g = sansCommentaires(GLSL_ECUME)
+  assert.match(g, /float profondeurEauMer\(float profondeur, float distance, float unite\)/)
+  assert.match(g, /max\(p, distance \* 1\.6 \* unite\)/)
+  // ⚠️ **ET LA BORNE SUR LA PROFONDEUR, ELLE, N'EST PAS MORTE** : c'est elle
+  // qui empêche une bathymétrie POSITIVE (au-dessus de l'eau) de ressortir telle
+  // quelle. La borne sur la DISTANCE, si — une campagne de mutation l'a montré,
+  // et elle a été retirée de la source plutôt que gardée pour rassurer.
+  assert.match(g, /float p = max\(profondeur, 0\.0\);/)
+  // une seule écriture du corps, dans le morceau injecté
+  assert.equal((g.match(/\* 1\.6 \* unite/g) || []).length, 1)
+})
+
+test('⑦d le nuanceur de la calotte BRANCHE le repli, et SEULEMENT là où il faut', () => {
+  const src = globe()
+  const vert = sansCommentaires(blocGlsl(src, 'MER_VERT'))
+  const frag = sansCommentaires(blocGlsl(src, 'MER_FRAG'))
+  // ① le sommet calcule les DEUX, et le repli passe par la fonction injectée
+  assert.match(vert, /vProfondeur = max\(-champ\.r, 0\.0\);/)
+  assert.match(vert, /vProfondeurEau = profondeurEauMer\(vProfondeur, champ\.g, uMerUnite\);/)
+  // ② le GLACIS le lit — c'est LUI qui portait les dents (mesuré : le repli posé
+  //    sur la seule alpha ne déplace rien, 11,72 % contre 11,71 % au départ)
+  assert.match(frag, /float dLagon = clamp\(vProfondeurEau \/ max\(uMerProfMax \* 0\.15/)
+  // ③ l'ALPHA le lit aussi — c'est le `shoreAA` d'ocean.js, sur `depth`
+  assert.equal((frag.match(/smoothstep\(0\.0, uMerSeuilEau, vProfondeurEau\)/g) || []).length, 2)
+  assert.equal((frag.match(/smoothstep\(0\.0, uMerSeuilEau, vProfondeur\)/g) || []).length, 0)
+  // ⛔ **ET LA TERRE RESTE DÉCIDÉE PAR LA BATHYMÉTRIE NUE.** Une mutation qui
+  // ferait discarder sur `vProfondeurEau` NOIERAIT LA CÔTE : le repli est > 0
+  // partout où la distance au rivage l'est, c'est-à-dire sur la terre aussi.
+  assert.match(frag, /if \(vProfondeur <= 0\.0\) discard;/)
+  assert.equal(/if \(vProfondeurEau <= 0\.0\) discard;/.test(frag), false)
+  // ⛔ **ET LE DÉCLIN CÔTIER AUSSI** : `declinRivageMer` compare DÉJÀ la
+  // profondeur à la distance (`max(prof × 2, distance)`). Lui passer le repli
+  // ferait entrer la distance deux fois, et le ressac d'`ocean.js` n'est pas ça.
+  assert.match(vert, /declinRivageMer\(vProfondeur \/ max\(uMerUnite, 1e-9\), champ\.g\)/)
+  assert.equal(/declinRivageMer\(vProfondeurEau/.test(vert), false)
+  // ⛔ **ET LE DÉFERLEMENT** : `cap = 0,78 × profondeur` est un critère PHYSIQUE
+  // (la hauteur qu'une vague tient sur un fond). Le repli n'est pas une hauteur
+  // d'eau, c'est un pis-aller de teinte.
+  assert.match(vert, /float cap = 0\.78 \* vProfondeur;/)
+  // ④ les deux varyings sont déclarés des DEUX côtés — sans quoi le programme
+  //    ne lie pas, et trois campagnes de ce chantier ont payé un varying muet
+  for (const bloc of [vert, frag]) {
+    assert.match(bloc, /varying float vProfondeur;/)
+    assert.match(bloc, /varying float vProfondeurEau;/)
+  }
+})
