ac58500 tache P9 : la projection des tangentes etait du code mort, une survivante l a dit
d9dc91f tache P9 : le bloc du crop etait eclaire par une normale 105 fois trop grossiere

 src/globe.js                   | 111 ++++++++++++++++++
 src/main.js                    |  27 ++++-
 src/monde/branchement-crop.js  |   8 ++
 src/monde/eclairage-crop.js    | 175 ++++++++++++++++++++++++++++
 src/monde/habillage-crop.js    |   5 +
 test/crop-eclairage.test.js    | 251 +++++++++++++++++++++++++++++++++++++++++
 test/crop-habillage.test.js    |   4 +
 test/crop-naturel.test.js      |   2 +-
 test/exageration-globe.test.js |  13 +++
 9 files changed, 592 insertions(+), 4 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index c330727..44b9c25 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -119,20 +119,24 @@ import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
 //
 // Même patron que `naturel-crop.js` juste au-dessus : la loi vit dans un module
 // PUR qui porte son propre texte GLSL, et ce fichier l'INJECTE. Il n'y a donc
 // pas deux écritures de l'éclairage à garder d'accord.
 import {
   GLSL_ECLAIRAGE,
   // ⚠️ **LE MORCEAU DÉTACHÉ, POUR LES PAROIS — Tâche P6.** Leur nuanceur est
   // NU : ni rampe, ni peinture, donc pas de `natLuminance`, dont
   // `GLSL_ECLAIRAGE` dépend. C'est la MÊME loi, injectée seule.
   GLSL_IRRADIANCE,
+  // ⚠️ **LA NORMALE PAR FRAGMENT — Tâche P9.** Même patron : la loi (celle de
+  // Mikkelsen, que `three` porte) et sa dérivation vivent dans le module PUR ;
+  // ce fichier n'en injecte que le texte.
+  GLSL_NORMALE_FINE,
   RECIPROQUE_PI,
   ECLAIRAGE_MONDE,
   directionSoleilLocale,
   hautLocal,
   irradianceAmbiante,
 } from './monde/eclairage-crop.js'
 // ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
 //
 // > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
 // > est en PLAQUES. »
@@ -738,36 +742,64 @@ varying vec2 vLatLon;
 // ⚠️ ET C'EST LA PROFONDEUR (-z de vue), PAS LA LONGUEUR DU VECTEUR. Pour une
 // camera en perspective, un pixel couvre 2 z tan(fov/2) / hauteurPx d'un plan
 // perpendiculaire a l'axe de vue : la grandeur exacte est la PROFONDEUR. Prendre
 // length(mv.xyz) surestimerait de 1/cos(theta) sur les bords — jusqu'a +8 % au
 // coin a fov 33 — et ferait varier la loi avec la position a l'ecran, ce que la
 // tache existe justement pour supprimer.
 //
 // ⚠️ ET C'EST UN varying, PAS UN ATTRIBUT : aucun octet de geometrie en plus,
 // contrairement a la cible de morphing chiffree a +23 % par l'etude.
 varying float vProfCam;
+// LA POSITION EN ESPACE DE VUE — Tache P9, la normale par fragment.
+//
+// ⚠️ EN ESPACE DE VUE, ET C'EST LA MEME RAISON QUE vProfCam JUSTE AU-DESSUS :
+// la normale fine a besoin de dFdx(P) et dFdy(P), c'est-a-dire de la TANGENTE
+// d'ecran de la surface. Une coordonnee MONDE de magnitude 100 a un ulp
+// float32 de 0,38 m quand cette tangente vaut quelques dizaines de metres par
+// pixel : la derivee serait bruitee de plusieurs pour cent. mv.xyz est relatif
+// a la CAMERA — quelques unites — et sa derivee est nette.
+//
+// ⚠️ ET C'EST UN varying DE PLUS, PAS UN ATTRIBUT : aucun octet de geometrie
+// en plus, et mv est deja calcule ci-dessous pour vProfCam et gl_Position.
+varying vec3 vVue;
 attribute vec2 latlon;
 void main() {
   vUv = uv;
   vLatLon = latlon;
   vNormalW = normalize(mat3(modelMatrix) * normal);
   vec4 mv = modelViewMatrix * vec4(position, 1.0);
   vProfCam = -mv.z;
+  vVue = mv.xyz;
   gl_Position = projectionMatrix * mv;
 }
 `
 
 const FRAG = /* glsl */ `
 precision highp float;
 varying vec2 vUv;
 varying vec3 vNormalW;
 varying vec2 vLatLon;
+// ══════════ LA NORMALE PAR FRAGMENT — Tache P9 ═════════════════════════════
+//
+// ⚠️ uNormaleFineOn VAUT ZERO PAR DEFAUT, exactement comme uCropOn, uHabOn,
+// uMerRampeOn, uEclairageOn et uMppFacteur : sans poserHabillage la vue
+// orbitale en production rend au bit pres ce qu'elle rendait.
+//
+// Ce que ce poste repare est mesure et decompose dans l'en-tete §6 de
+// src/monde/eclairage-crop.js : la COULEUR du crop porte deja plus de detail
+// que celle du socle (10,250 contre 8,723 en energie, lumiere coupee des deux
+// cotes), et c'est son OMBRAGE qui manque en entier — parce que ses normales
+// viennent d'une grille de 5 625 sommets sur le bloc contre 594 434 au socle.
+varying vec3 vVue;
+uniform float uNormaleFineOn;
+// unites de scene par METRE de relief : (R_GLOBE / EARTH_RADIUS_M) x exageration
+uniform float uUnitesParMetre;
 uniform sampler2D uTex;
 uniform sampler2D uRamp;
 uniform vec3 uSunDir;
 uniform vec3 uInk;
 uniform vec3 uShadowColor;
 uniform float uContourInterval;
 uniform float uContourOpacity;
 uniform float uGraticuleOpacity;
 uniform float uOceanDepth;
 uniform float uLandMax;
@@ -1084,20 +1116,26 @@ float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); ret
 // jumelles » dont terrain.js porte la cicatrice.
 ${GLSL_NATUREL}
 
 // ⚠️ INJECTE, PAS RECOPIE — Tache P3, et il vient APRES GLSL_NATUREL parce
 // qu'il APPELLE natLuminance. La loi d'eclairage n'est pas maison : c'est celle
 // de three.js (BRDF_Lambert, getHemisphereLightIrradiance) et de terrain.js
 // (fxShade, la valeur par sommet). test/crop-eclairage.test.js va la relire
 // dans node_modules/three plutot que de croire ce commentaire.
 ${GLSL_ECLAIRAGE}
 
+// ⚠️ INJECTE, PAS RECOPIE — Tache P9. La loi de Mikkelsen, celle que porte
+// three (bumpmap_pars_fragment.glsl.js), moins la normalisation de sigma que
+// son propre commentaire dit etre une convention d'artiste. La derivation et
+// l'ecart sont ecrits dans src/monde/eclairage-crop.js, §6 de l'en-tete.
+${GLSL_NORMALE_FINE}
+
 // ══════ LA COUCHE APPARENCE — Tache P3, et le gabarit d'ouverture l'ALLUME ══
 //
 // ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
 // public/templates/defaults/shibustart.json pose look.surfaceFx = 9. Releve
 // dans l'application vivante : uSurfaceFx = 9, uFxOpacity = 0,44,
 // uFxBlend = 2 (Multiply), uFxColA = #14161d. Mesure : socle rendu avec un
 // albedo force a BLANC sous un hemisphere blanc d'irradiance 1 (le pixel
 // devrait valoir 1/PI) — couche allumee 0,591 / 0,575 / 0,571, couche eteinte
 // 0,997 / 0,997 / 0,997. ELLE MULTIPLIE L'ALBEDO DU SOCLE PAR 0,59.
 //
@@ -1515,20 +1553,51 @@ void main() {
   // postes peignent donc sur un ALBEDO. Poser le melange APRES eux — ce que la
   // premiere version de cette tache faisait — fait passer le motif de
   // l'apparence une seconde fois dans mix(fond, x, teinte), et le motif ressort
   // delave. MESURE : l'apparence assombrit l'albedo du socle a 0,58 et celui du
   // crop a 0,73 seulement, pour un motif pourtant CALE au meme endroit du sol
   // (vues P3-MOTIF-SOCLE.png et P3-MOTIF-CROP.png : memes points, meme phase).
   //
   // ⚠️ partBloc VAUT ZERO SANS ECLAIRAGE, et alors rien de tout ce qui suit ne
   // s'applique : la production est intouchee au bit pres.
   vec3 nMonde = normalize(vNormalW);
+  // ══════ LA NORMALE PAR FRAGMENT — Tache P9 ═══════════════════════════════
+  //
+  // ⛔ CE QUI MANQUAIT N'ETAIT PAS DU DETAIL DE PEINTURE, C'ETAIT DE L'OMBRAGE.
+  // Mesure, cadrage interieur, masques apparies a -0,155 % : lumiere coupee des
+  // deux cotes, le crop rend 10,250 d'energie de detail contre 8,723 au socle —
+  // sa COULEUR est deja PLUS riche. Allumes, il rend 10,972 contre 16,086 : la
+  // lumiere fabrique 45,8 % du modele du socle et 6,6 % du sien.
+  //
+  // ⚠️ ET LA CAUSE EST ARITHMETIQUE, PAS ESTHETIQUE : vNormalW vient de
+  // _buildMesh, qui pose gridFor(z) = 24 quads par tuile — 5 625 sommets sur un
+  // bloc de 3 x 3 tuiles, contre 594 434 au socle (releve). La texture de
+  // hauteur, elle, fait 256 x 256 par tuile et le fragment la lit DEJA
+  // (decodeMetersAA, quelques lignes plus haut) : la couleur voyait le relief
+  // fin, la lumiere ne le voyait pas.
+  //
+  // ⚠️ h EST DEJA LE BON h : le fond marin (Tache J bis) et le grain (Tache C)
+  // l'ont modifie au-dessus, et c'est la surface REELLE qu'on veut deriver.
+  //
+  // ⚠️ ET LA BASE EST LA SPHERE NUE, JAMAIS vNormalW : ce dernier PORTE deja la
+  // pente de la grille, et le perturber par le gradient COMPLET de h compterait
+  // deux fois la composante grossiere. Le globe est « une sphere de rayon
+  // R_GLOBE = 100 centree a l'origine » (monde/frontiere-rendu.js), donc le
+  // centre de la planete en espace de vue est viewMatrix x (0, 0, 0, 1).
+  if (uNormaleFineOn > 0.5) {
+    vec3 nSphere = normalize(vVue - vec3(viewMatrix[3]));
+    nMonde = nMondeDepuisVue(
+      mat3(viewMatrix),
+      normaleFineCrop(dFdx(vVue), dFdy(vVue), nSphere,
+                      dFdx(h) * uUnitesParMetre, dFdy(h) * uUnitesParMetre)
+    );
+  }
   float nduCrop = dot(nMonde, uHemiHaut);
   float partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0;
   vec3 fondCrop = uAlbedoBase * natGris(hNormRelief, max(nduCrop, 0.0));
   if (partBloc > 0.0) {
     col = mix(col, albedoCrop(col, uAlbedoBase, natGris(hNormRelief, max(nduCrop, 0.0)), uAlbedoTeinte), partBloc);
   }
 
   // ══════ LA COUCHE APPARENCE — Tache P3, le gabarit d'ouverture l'ALLUME ════
   //
   // ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
@@ -2342,20 +2411,31 @@ export class Globe {
       uSol: { value: null },
       uSolLut: { value: null },
       uSolOn: { value: 0 },
       uSolOpacite: { value: HABILLAGE_MONDE.solOpacite },
       uSolOffset: { value: new THREE.Vector2(0, 0) },
       uSolScale: { value: new THREE.Vector2(1, 1) },
       uSolTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) },
       uGrainForceM: { value: HABILLAGE_MONDE.grainForceM },
       uGrainEchelle: { value: HABILLAGE_MONDE.grainEchelle },
       uContourWeight: { value: HABILLAGE_MONDE.contourPoids },
+      // LA NORMALE PAR FRAGMENT — Tâche P9. ⚠️ **`uNormaleFineOn: 0` : sans
+      // `poserHabillage`, RIEN ne change** — même garde et même raison que
+      // `uCropOn`, `uHabOn`, `uMerRampeOn`, `uEclairageOn` et `uMppFacteur`.
+      // ⚠️ **ET `uUnitesParMetre` N'A PAS DE « NEUTRE » : c'est une ÉCHELLE, pas
+      // un réglage.** Elle est juste dès la construction et suit l'exagération
+      // (`setExaggeration`), parce qu'une échelle fausse ne se voit pas — elle
+      // rend juste des pentes fausses, et c'est exactement la faute que
+      // `uMerHoule` (121,6× trop haute) et `skirtDrop` (10× trop long) ont
+      // coûtée à ce chantier.
+      uNormaleFineOn: { value: 0 },
+      uUnitesParMetre: { value: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration },
 
       // LE FOND DU CROP — Tâche J bis.
       //
       // ⚠️ `uFondOn: 0` : sans `poserFondCrop`, RIEN NE CHANGE — même garde et
       // même raison que `uCropOn`, `uEstompageOn` et `uHabOn`. Partagés eux
       // aussi : le fond est une propriété du CROP, pas de la tuile.
       //
       // ⚠️ **`uFondMetres` PART À 1 ET NON À 0** : c'est un DIVISEUR déguisé (le
       // champ est cuit en unités locales, `brut × echelle`), et un zéro par
       // défaut rendrait un fond marin plat au niveau de la mer le jour où
@@ -2907,20 +2987,25 @@ export class Globe {
    * @param {number} arg.solOpacite
    * @param {{x:number,y:number}|null} arg.solOffset
    * @param {{x:number,y:number}|null} arg.solScale
    * @param {{x:number,y:number}|null} arg.solTexel
    * @param {number|null} arg.amplitudeM - amplitude du relief du crop, en mètres
    * @param {number|null} arg.contourIntervalM - impose l'intervalle (sinon calé)
    * @param {number} arg.contourOpacity
    * @param {number} arg.contourWeight
    * @param {number} arg.grainForceM - amplitude du grain, en MÈTRES de relief
    * @param {number} arg.grainEchelle
+   * @param {boolean} arg.normaleFine - la normale du bloc est-elle reconstruite
+   *   AU FRAGMENT depuis la texture de hauteur ? ⚠️ **Faux = le dépôt au bit
+   *   près** : la normale reste celle des sommets, c'est-à-dire d'une grille de
+   *   24 quads par tuile. Voir le §6 de `monde/eclairage-crop.js` pour la
+   *   décomposition qui a nommé ce manque.
    *
    * ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
    *
    * ⚠️ **ELLE ENTRE PAR L'HABILLAGE, ET PAS PAR `poserRampe` — C'EST UNE
    * DÉCISION.** `poserRampe` REFUSE quand la couverture du crop est incomplète
    * (`refus: 'couverture'`), et un refus « ne touche pas à ce qui est en place ».
    * L'analyse, elle, n'est jamais mesurée : c'est une texture déjà cuite par le
    * socle. La faire dépendre d'une mesure l'aurait rendue absente exactement
    * quand la Tâche K ter a montré qu'elle manque — pendant la course de
    * chargement. Et l'habillage est le SEUL maillon que la veille rafraîchit par
@@ -2956,20 +3041,21 @@ export class Globe {
     solOpacite = 1,
     solOffset = null,
     solScale = null,
     solTexel = null,
     amplitudeM = null,
     contourIntervalM = null,
     contourOpacity = null,
     contourWeight = 0.7,
     grainForceM = 0,
     grainEchelle = 96,
+    normaleFine = false,
     analyse = null,
     rampe2D = null,
     texShade = NATUREL_MONDE.texShade,
     wetK = NATUREL_MONDE.wetK,
     expoK = NATUREL_MONDE.expoK,
     hemi = NATUREL_MONDE.hemi,
     treeLine = NATUREL_MONDE.treeLine,
     heightContrast = NATUREL_MONDE.heightContrast,
     heightPivot = NATUREL_MONDE.heightPivot,
     hazeAmt = NATUREL_MONDE.hazeAmt,
@@ -3063,20 +3149,30 @@ export class Globe {
     // 800 m, cela ne trace qu'UNE courbe. C'est la ligne « échelle » du §3 du
     // plan, appliquée aux lignes au lieu du dégradé.
     if (contourIntervalM > 0) u.uContourInterval.value = contourIntervalM
     else if (amplitudeM > 0) u.uContourInterval.value = intervalleCourbes(amplitudeM)
     if (contourOpacity != null) u.uContourOpacity.value = contourOpacity
     u.uContourWeight.value = contourWeight
 
     u.uGrainForceM.value = grainForceM
     u.uGrainEchelle.value = grainEchelle
 
+    // ══════ LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════════
+    //
+    // ⚠️ **ELLE ENTRE PAR L'HABILLAGE, ET C'EST LE MÊME ARGUMENT QUE
+    // L'ÉCLAIRAGE (Tâche P3) :** `poserHabillage` est le SEUL maillon que la
+    // veille rejoue par image (`CHAMPS_HABILLAGE`). Posée à la naissance du
+    // crop, la normale fine s'éteindrait au premier changement de palette qui
+    // rejoue l'habillage sans la repasser.
+    u.uNormaleFineOn.value = normaleFine ? 1 : 0
+
+
     // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
     //
     // ⚠️ **DEUX INTERRUPTEURS ET NON UN, PARCE QUE LES DEUX ARRIVENT SÉPARÉMENT
     // ET QUE LEUR ABSENCE NE VEUT PAS LA MÊME CHOSE.** Le LUT 2D existe TOUJOURS
     // (le socle le cuit dès la première palette, en Classique comme en Naturel :
     // en Classique il est constant en Y et sa ligne médiane EST la rampe
     // historique) ; l'analyse, elle, n'existe qu'en mode Naturel et seulement une
     // fois le travailleur revenu. Un seul interrupteur aurait donc éteint le
     // pivot et le contraste de rampe — qui, eux, valent dans les DEUX modes —
     // pendant toute l'attente de l'analyse.
@@ -3226,20 +3322,27 @@ export class Globe {
     u.uSolOn.value = 0
     u.uSolOpacite.value = HABILLAGE_MONDE.solOpacite
     u.uSolOffset.value.set(0, 0)
     u.uSolScale.value.set(1, 1)
     u.uSolTexel.value.set(1 / 2048, 1 / 2048)
     u.uContourInterval.value = HABILLAGE_MONDE.contourIntervalM
     u.uContourOpacity.value = HABILLAGE_MONDE.contourOpacite
     u.uContourWeight.value = HABILLAGE_MONDE.contourPoids
     u.uGrainForceM.value = HABILLAGE_MONDE.grainForceM
     u.uGrainEchelle.value = HABILLAGE_MONDE.grainEchelle
+    // ⚠️ **ET LA NORMALE FINE S'ÉTEINT — Tâche P9.** Sans crop il n'y a plus de
+    // bloc à modeler, et `HABILLAGE_MONDE.normaleFine` vaut faux : c'est
+    // l'aller-retour bit-à-bit que `test/crop-habillage.test.js` (⑨) exige.
+    // ⚠️ **`uUnitesParMetre` N'EST PAS RENDU, ET C'EST DÉLIBÉRÉ** : ce n'est pas
+    // un réglage d'habillage mais l'échelle verticale DU GLOBE, qui vaut pour
+    // toute la planète et que `setExaggeration` tient à jour.
+    u.uNormaleFineOn.value = HABILLAGE_MONDE.normaleFine ? 1 : 0
     // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
     //
     // ⚠️ **LES DEUX TEXTURES SONT LÂCHÉES, PAS SEULEMENT DÉBRANCHÉES** — même
     // raison que le masque de côte deux lignes plus haut : gardées dans un
     // uniforme PARTAGÉ, l'analyse et le LUT du crop précédent restaient
     // joignables par le ramasse-miettes, et l'analyse d'un MNT 1536² pèse 12 Mo
     // mipmaps comprises (`terrain.js`, `_analysisMax`).
     //
     // ⚠️ **ET LES CURSEURS SONT RENDUS AUSSI, ALORS QU'ILS SONT DÉJÀ GARDÉS.**
     // Ce n'est pas du code mort : `uHeightContrast` et `uHeightPivot` entrent
@@ -5900,20 +6003,28 @@ export class Globe {
     // réseau pour personne, et toute la descente resterait bloquée derrière
     // elles — sans erreur, sans test rouge, sans rien à l'écran.
     this.chargeRacines()
   }
 
   // relief exaggeration is baked into vertex positions — rebuild ready meshes.
   // ⚠️ Les hauteurs ne survivent plus au maillage (voir `_buildMesh`) : la
   // reconstruction passe donc par le réseau, pas par un tampon retenu.
   setExaggeration(v) {
     this.exaggeration = v
+    // ⚠️ **L'ÉCHELLE DE RELIEF SUIT, ET C'EST OBLIGATOIRE — Tâche P9.** Le
+    // relief est cuit dans les SOMMETS, mais la normale par fragment le dérive
+    // de la texture de hauteur : elle a besoin du même facteur mètre → unité de
+    // scène que `_buildMesh`. Laissée en arrière, elle rendrait des pentes
+    // fausses d'un facteur `exagAvant / exagApres` — invisible à l'œil nu, et
+    // c'est précisément la famille de fautes (`uMerHoule`, `skirtDrop`) que ce
+    // chantier a payée quatre fois.
+    this.uniforms.uUnitesParMetre.value = (R_GLOBE / EARTH_RADIUS_M) * v
     this._rechargeTuiles()
   }
 
   // ═══════════ LE QUATORZIÈME LECTEUR — Tâche E, « UNE SEULE TERRE » ═════════
   //
   // ⚠️ **LE GLOBE NE CALCULE PLUS SON EXAGÉRATION : IL LA LIT.** C'est la
   // décision 14 et son partage (`monde/exageration-continue.js`) — un écrivain,
   // N lecteurs. Un lecteur ne peut pas fabriquer sa propre valeur : il n'a pas
   // la courbe. Appelé par `syncExagToZoom` (`main.js`), l'unique écrivain.
   //
diff --git a/src/main.js b/src/main.js
index 20ef2ad..366ae54 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4823,23 +4823,36 @@ function majLoiTextureMonde() {
 //   · ~~**`remplir` pour la mer, donc PAS DE BATHYMÉTRIE.**~~ ✅ **RÉPARÉ PAR LA
 //     TÂCHE J**, et il faut dire comment, parce que l'obstacle écrit ici était
 //     réel : `demanderEmprise` REMPLACE `gardeHauteurs` à chaque appel (« un seul
 //     flux par globe »), donc un SECOND appel pour la mer aurait repris au bloc
 //     ses réservations. La sortie n'est pas un second appel, c'est **une seule
 //     réservation qui connaît les deux emprises** — `demanderEmprise` a été
 //     ÉLARGIE d'un `aussi` dont le défaut (`null`) reproduit le dépôt au bit
 //     près. Et la portée de la calotte n'est plus l'horizon (256 demi-largeurs)
 //     mais `PORTEE_CROP = 3`, l'emprise 3×3 du mode plat : c'est ce qui rend
 //     l'emprise de la mer réservable.
-//   · **le grain** reste à zéro : `HABILLAGE_MONDE.grainForceM` vaut 0 et rien
-//     dans les réglages du socle ne s'y traduit en mètres de relief sans une
-//     mesure qu'on n'a pas faite.
+//   · **le grain** reste à zéro — ⚡ **ET LA MESURE QUI MANQUAIT EXISTE
+//     MAINTENANT (Tâche P9), ELLE DIT QUE ÇA NE VAUT PAS LA CONVERSION.**
+//     `_makeDemSampler` ajoute `detail × fbm` en UNITÉS DE SCÈNE sur
+//     `scale = (span / dem.extentMeters) × exagération` : à la valeur vivante
+//     (`detail = 0,02`, `scale = 0,004 090`) cela fait **6,60 m de relief**, de
+//     longueur d'onde **611 m**. Posé sur le crop à sa conversion exacte
+//     (`grainForceM = detail × largeurCropM / COTE_CROP_UNITES / exagération`
+//     = **4,89 m** ; `grainEchelle = detailScale × COTE_CROP_UNITES / 2` =
+//     **22,4**, parce que `qCrop` couvre ±1 là où le socle indexe des unités de
+//     scène), il déplace l'énergie de détail de **10,972 à 10,972 — 0,000 %**,
+//     et la luminance moyenne de **0,002 octet**. Il faut **×50** (244 m de
+//     relief inventé) pour gagner 4,4 %, et le curseur, lui, est plafonné à
+//     `NATURAL_DETAIL_MAX = 0,15`, soit **36,7 m**. ⛔ **Une cinquième monnaie à
+//     convertir pour un zéro mesuré : non porté, et c'est une décision, pas un
+//     oubli.** La recette est ci-dessus pour qui la voudra.
+//     (`.banc/P9/S5-relief-P9.json`, aller-retour à 0 canal.)
 // Le LIEU et la LARGEUR du crop, seuls — extraits de `contexteCrop` par la
 // Tâche J. ⚠️ **PARCE QUE DEUX APPELANTS EN ONT BESOIN, ET QU'UNE SECONDE
 // ÉCRITURE DIVERGERAIT** : `contexteCrop` (ce que la chaîne reçoit) et
 // `empriseZoomMer` (ce que la réservation doit couvrir) doivent tomber sur
 // EXACTEMENT le même repère, sinon la mer se remplirait à côté du bloc.
 function assietteCrop() {
   const centre = latLonOrigineBloc()
   if (!Number.isFinite(centre?.lat) || !Number.isFinite(centre?.lon)) return null
   const emprise = terrain.fenetreBornee?.emprise || empriseDuSocle()
   if (!emprise) return null
@@ -4998,20 +5011,28 @@ function contexteCrop() {
       coastMask: cote,
       sol,
       solLut: sol ? terrain.mapUniforms.uSolLut.value : null,
       solOpacite: terrain.mapUniforms.uSolOpacite.value,
       solOffset: terrain.mapUniforms.uSolOffset.value,
       solScale: terrain.mapUniforms.uSolScale.value,
       solTexel: terrain.mapUniforms.uSolTexel.value,
       amplitudeM: amplitudeM > 0 ? amplitudeM : null,
       contourOpacity: terrain.mapUniforms.uContourOpacity.value,
       contourWeight: terrain.mapUniforms.uContourWeight.value,
+      // ══════ LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════
+      //
+      // ⚠️ **VRAI DÈS QU'IL Y A UN CROP, ET PAS UN RÉGLAGE.** Ce n'est pas une
+      // option d'utilisateur : c'est la réparation d'un désaccord de MAILLAGE
+      // entre les deux Terres — 5 625 sommets sur le bloc côté globe contre
+      // 594 434 côté socle. Le §6 de `monde/eclairage-crop.js` porte la mesure
+      // qui l'a nommé et celle de ce qu'il rend.
+      normaleFine: true,
       // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════
       //
       // ⚠️ **LES SEPT SOUS-RÉGLAGES D'ATLAS PASSENT ICI, ET LES DEUX CURSEURS DE
       // RAMPE AVEC EUX.** L'inventaire les comptait morts : `texShade`, `wetK`,
       // `expoK`, `treeLine`, `hazeAmt` **ne traversaient pas** ; `rampDry`,
       // `rampWet` et `rampOklab` non plus. Les cinq premiers sont des uniformes ;
       // les trois derniers arrivent **cuits dans `rampe2D`**, ce qui est
       // précisément pourquoi on partage la table du socle au lieu d'en rebâtir
       // une. `heightContrast` et `heightPivot` ferment les deux derniers.
       //
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index 23cf1a3..333dbb5 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -157,20 +157,28 @@ export const CHAMPS_HABILLAGE = Object.freeze([
   'coastMask',
   'sol',
   'solLut',
   'solOpacite',
   'amplitudeM',
   'contourIntervalM',
   'contourOpacity',
   'contourWeight',
   'grainForceM',
   'grainEchelle',
+  // ⚠️ **`normaleFine` — Tâche P9, ET SANS CETTE LIGNE ELLE S'ÉTEINDRAIT SEULE.**
+  // La veille ne repose l'habillage que lorsqu'un champ SURVEILLÉ change ; un
+  // champ absent d'ici n'est jamais comparé, donc jamais reposé — mais il est
+  // bel et bien PASSÉ à chaque pose déclenchée par un autre champ. Le défaut
+  // serait donc muet tant que rien d'autre ne bouge, et se réparerait tout seul
+  // au premier changement de palette : exactement la course que la Tâche K ter
+  // a nommée, et qui rend un défaut invisible un chargement sur deux.
+  'normaleFine',
   // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════════
   //
   // ⚠️ **`analyse` EST LE CHAMP LE PLUS EN RETARD DE TOUTE LA LISTE, ET C'EST
   // POURQUOI IL DOIT Y ÊTRE.** Le masque de côte arrive du réseau ; l'analyse,
   // elle, arrive d'un TRAVAILLEUR après une dizaine de flous sur le MNT entier —
   // `terrain.js` mesure **464 ms** rien que pour La Réunion sur un retour de
   // zoom. Elle ne peut donc pas être là quand le crop naît. Sans cette ligne, le
   // peigné n'apparaîtrait qu'au prochain changement de LIEU : c'est la course
   // que la Tâche K ter a nommée, aggravée d'un demi-seconde de retard garanti.
   //
diff --git a/src/monde/eclairage-crop.js b/src/monde/eclairage-crop.js
index 143de71..6216000 100644
--- a/src/monde/eclairage-crop.js
+++ b/src/monde/eclairage-crop.js
@@ -423,10 +423,185 @@ vec3 albedoCrop(vec3 mapCol, vec3 base, float gris, float teinte) {
   vec3 fond = base * gris;
   return mix(fond, mapCol * natOmbrePeinture(natLuminance(fond)), teinte);
 }
 ${GLSL_IRRADIANCE}
 vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, float ndl,
                   vec3 soleil, vec3 ciel, vec3 sol) {
   vec3 albedo = albedoCrop(mapCol, base, natGris(hn, ndu), teinte);
   return albedo * irradianceCrop(ndl, ndu, soleil, ciel, sol) * ${RECIPROQUE_PI};
 }
 `
+
+// ══════════ 6. LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════
+//
+// > **L'agent noteur, `notation-02.md` §5-5️⃣ :** *« Le crop rend 65,7 % de
+// > l'énergie de détail du socle. Et le levier que notation-01 désignait est
+// > désormais tiré sans effet : couper l'éclairage du crop ne lui coûte que
+// > 4,22 % de son modelé, quand couper le soleil du socle lui en coûte 45,39 %.
+// > Le crop est éclairé et reste plat. »*
+//
+// ⚡ **LA DÉCOMPOSITION QUI NOMME LA CAUSE**, mesurée dans la MÊME page, cadrage
+// intérieur, masques appariés à **−0,155 %** (`.banc/P9/S5-relief-P9.json`,
+// octet linéaire) :
+//
+// | | allumé | lumière coupée | part de la lumière |
+// |---|---|---|---|
+// | socle | **16,086** | **8,723** | **45,8 %** |
+// | crop | 10,972 | **10,250** | **6,6 %** |
+//
+// ⛔ **LA COULEUR DU CROP EST DONC DÉJÀ PLUS RICHE QUE CELLE DU SOCLE — 10,250
+// contre 8,723, soit +17,5 % — ET C'EST L'OMBRAGE QUI MANQUE, EN ENTIER.**
+// C'est l'inverse de ce que le chantier cherchait : il n'y a pas de détail à
+// AJOUTER à la peinture, il y a une lumière qui ne module rien.
+//
+// ⚠️ **ET LE GRAIN N'EST PAS LE LEVIER — MESURÉ, PAS SUPPOSÉ.** Le grain du
+// socle (`terrain.js`, `_makeDemSampler`) vaut `detail = 0,02` UNITÉ DE SCÈNE
+// sur `scale = 0,004 090` unité par mètre, c'est-à-dire **6,60 m de relief**,
+// de longueur d'onde **611 m**. Posé sur le crop à sa valeur convertie
+// (`grainForceM = 4,89`, `grainEchelle = 22,4`), il déplace l'énergie de détail
+// de **10,972 à 10,972 — 0,000 %** ; il faut **×50** (244 m de relief inventé,
+// 37 fois le socle) pour gagner **4,4 %**. Aller-retour à **0 canal**.
+//
+// ⚡ **UN OMBRAGE QUI NE MODULE PAS, C'EST UNE NORMALE QUI NE VARIE PAS — ET
+// L'ARITHMÉTIQUE SUFFIT À LE DIRE.** Le maillage d'une tuile du globe est
+// `gridFor(z) = 24` quads (`globe.js`), soit `(24 + 1)² = 625` sommets ; le crop
+// de La Réunion en fait **3 × 3 tuiles**, donc **5 625 sommets** sur le bloc.
+// Le socle, lui, maille le MÊME bloc à `resMaillage = 768`, soit **594 434
+// sommets relevés dans la page vivante**. ⛔ **CENT CINQ FOIS PLUS, 10,7 fois
+// par axe.** Relevé au même instant, la dispersion de `N · haut` : écart-type
+// **0,2447** au socle contre **0,1994** au crop, et surtout un minimum de
+// **−1** contre **0,2126** — le crop n'a AUCUNE face raide, elles ont toutes été
+// moyennées.
+//
+// ⚠️ **ET LA DONNÉE, ELLE, EST LÀ** : la texture de hauteur d'une tuile fait
+// **256 × 256**, que le nuanceur lit déjà par fragment (`decodeMetersAA`) pour
+// la rampe et pour les courbes de niveau. **La couleur voit le relief fin ; la
+// lumière ne le voyait pas.** D'où cette section : reconstruire la normale AU
+// FRAGMENT depuis la hauteur que le fragment tient déjà.
+//
+// ══════════ LA LOI EST CELLE DE MIKKELSEN, ET `three` LA PORTE ══════════════
+//
+// `three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js`
+// (`perturbNormalArb`, d'après *Bump Mapping Unparametrized Surfaces on the
+// GPU*, Morten S. Mikkelsen). La dérivation, écrite ici parce qu'elle justifie
+// le seul point où l'on s'écarte de `three` :
+//
+//     S(x, y) = P(x, y) + N · h(x, y)
+//     dS/dx = sx + N·hx        dS/dy = sy + N·hy
+//     n = dS/dx × dS/dy = sx×sy − hx·R1 − hy·R2
+//         avec R1 = sy × N, R2 = N × sx, et sx×sy = det · N,
+//         det = sx · R1
+//
+// ⛔ **ET VOICI L'ÉCART, ASSUMÉ ET NÉCESSAIRE : `three` NORMALISE `sx` ET `sy`,
+// PAS NOUS.** Son commentaire le dit — *« normalize is done to ensure that the
+// bump map looks the same regardless of the texture's scale »* : c'est une
+// convention d'ARTISTE, qui rend la pente proportionnelle au dénivelé PAR PIXEL
+// D'ÉCRAN au lieu du dénivelé PAR MÈTRE DE SOL. Sous elle, la même montagne
+// s'aplatirait en s'éloignant et se creuserait en s'approchant. Le crop veut la
+// normale GÉOMÉTRIQUE, celle que `_buildMesh` calcule déjà par différences
+// centrées sur la surface déplacée — donc `sigma` non normalisé, et `h` dans la
+// même unité de longueur que `P`.
+//
+// ⚠️ **LE REPÈRE EST CELUI DE LA VUE, ET LA PRÉCISION L'EXIGE.** `VERT` explique
+// déjà pourquoi les sommets sont en RTC : *« ne pas payer l'ulp float32 à
+// magnitude 100 (0,486 m) »*. Une coordonnée MONDE de magnitude 100 a un ulp de
+// 0,38 m, quand `dFdx(P)` sur un pixel vaut ici quelques dizaines de mètres :
+// la dérivée serait bruitée de plusieurs pour cent. En espace de VUE, `P` est
+// relatif à la caméra — quelques unités — et la dérivée est nette.
+//
+// ⚠️ **LA NORMALE DE BASE EST CELLE DE LA SPHÈRE NUE, JAMAIS `vNormalW`.**
+// `vNormalW` PORTE DÉJÀ la pente du maillage : la perturber par le gradient
+// COMPLET de `h` compterait deux fois la composante grossière. La sphère est
+// centrée à l'origine du monde — `frontiere-rendu.js` l'écrit (*« une sphère de
+// rayon `R_GLOBE` = 100 centrée à l'origine »*) et le relevé le confirme
+// (`globe.group.matrixWorld` a une translation de **(0, 0, 0)**,
+// `.banc/P9/S6-normale-P9.json`) —, donc la normale de sphère en espace de vue
+// vaut `normalize(pVue − viewMatrix · (0, 0, 0, 1))`.
+//
+// ⚡ **CE QUE ÇA REND À L'ÉCRAN, MESURÉ AVANT D'ÊTRE ÉCRIT** (`.banc/P9/S6`,
+// rustine posée dans la page, témoin de compilation à **0 canal** éteinte) :
+// énergie de détail **10,966 → 15,733** contre **16,069** au socle, soit
+// **68,2 % → 97,9 %** ; et la part de la lumière dans le modelé du crop passe de
+// **6,6 % à 20,0 %**.
+
+/**
+ * La normale d'une surface déplacée en hauteur, au point où l'on est.
+ *
+ * ⚠️ **VECTEURS EN TABLEAUX DE TROIS, ET PAS DE `three`** : ce module est PUR
+ * (voir l'en-tête), et `test/crop-eclairage.test.js` le rejoue sous node contre
+ * un ORACLE INDÉPENDANT — la surface déplacée y est construite point par point
+ * et sa normale prise par un vrai produit vectoriel.
+ *
+ * ⚡ **CE QU'ELLE DÉCRIT EXACTEMENT, ET IL FAUT LE DIRE : LE PLAN DE `n`,
+ * DÉPLACÉ DE `h`.** La formule ne rend PAS la normale de la surface engendrée
+ * par `sx` et `sy` : elle remplace `sx × sy` par `det · n`, c'est-à-dire qu'elle
+ * perturbe **la normale qu'on lui DONNE**. C'est précisément ce qu'on veut ici —
+ * `n` est la normale de la SPHÈRE NUE, et `h` porte tout le relief ; les
+ * tangentes ne servent qu'à mesurer la distance au sol par pixel. Perturber
+ * `vNormalW` à la place compterait deux fois la pente du maillage.
+ *
+ * ⛔ **ET UNE PROJECTION DES TANGENTES SUR LE PLAN DE `n` NE CHANGERAIT RIEN —
+ * C'EST UNE SURVIVANTE DE MUTATION QUI L'A PROUVÉ, ET LA VERSION D'AVANT DE CE
+ * COMMENTAIRE ÉTAIT FAUSSE.** L'algèbre : `(sy − n(sy·n)) × n = sy × n` (le
+ * terme retiré est colinéaire à `n`), donc `R1` et `R2` sont inchangés ; et
+ * `det = (sx − n(sx·n)) · R1 = sx · R1` puisque `R1 ⟂ n`. **Trois lignes de code
+ * mort, retirées** — le dixième code mort de ce chantier trouvé par une
+ * survivante. L'invariance est désormais une ASSERTION (⑧a), pas une croyance.
+ *
+ * @param {number[]} sx la tangente d'écran en x, dans l'unité de `P`
+ * @param {number[]} sy la tangente d'écran en y
+ * @param {number[]} n la normale de la surface de BASE (normalisée)
+ * @param {number} dhx la dérivée d'écran de `h` en x, dans la MÊME unité que `P`
+ * @param {number} dhy la dérivée d'écran de `h` en y
+ * @returns {number[]} la normale perturbée, normalisée
+ */
+export function normaleParDeplacement(sx, sy, n, dhx, dhy) {
+  const croix = (a, b) => [
+    a[1] * b[2] - a[2] * b[1],
+    a[2] * b[0] - a[0] * b[2],
+    a[0] * b[1] - a[1] * b[0],
+  ]
+  const point = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
+  const r1 = croix(sy, n)
+  const r2 = croix(n, sx)
+  const det = point(sx, r1)
+  const s = det < 0 ? -1 : det > 0 ? 1 : 0
+  const v = [
+    Math.abs(det) * n[0] - s * (dhx * r1[0] + dhy * r2[0]),
+    Math.abs(det) * n[1] - s * (dhx * r1[1] + dhy * r2[1]),
+    Math.abs(det) * n[2] - s * (dhx * r1[2] + dhy * r2[2]),
+  ]
+  const l = Math.hypot(v[0], v[1], v[2])
+  if (!(l > 0)) return [n[0], n[1], n[2]]
+  return [v[0] / l, v[1] / l, v[2] / l]
+}
+
+/**
+ * Le texte GLSL de la même loi — INJECTÉ, jamais recopié.
+ *
+ * ⚠️ **`normaleFineCrop` REND SA NORMALE EN ESPACE DE VUE**, comme ses entrées.
+ * L'appelant la ramène au monde par la transposée de `mat3(viewMatrix)` (une
+ * rotation : sa transposée EST son inverse). GLSL ES 1.0 n'a pas `transpose()`,
+ * d'où `nMondeDepuisVue`, écrit ici plutôt que sur place.
+ */
+export const GLSL_NORMALE_FINE = /* glsl */ `
+// ═══ LA NORMALE PAR FRAGMENT — src/monde/eclairage-crop.js, Tache P9 ═══════
+// Loi de Mikkelsen, celle que porte three (bumpmap_pars_fragment.glsl.js),
+// SANS la normalisation de sigma : elle rendrait la pente proportionnelle au
+// denivele par PIXEL au lieu du denivele par METRE. Voir l'en-tete du module.
+vec3 normaleFineCrop(vec3 sx, vec3 sy, vec3 n, float dhx, float dhy) {
+  // ⚠️ ELLE PERTURBE LA NORMALE QU'ON LUI DONNE : n est la SPHERE NUE, les
+  // tangentes ne servent qu'a mesurer la distance au sol par pixel. Projeter
+  // sx et sy sur le plan de n ne changerait RIEN (voir le module).
+  vec3 r1 = cross(sy, n);
+  vec3 r2 = cross(n, sx);
+  float det = dot(sx, r1);
+  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
+  vec3 v = abs(det) * n - grad;
+  float l = length(v);
+  return l > 0.0 ? v / l : n;
+}
+// La transposee d'une rotation EST son inverse : (V^T u)_i = dot(colonne_i, u).
+vec3 nMondeDepuisVue(mat3 V, vec3 u) {
+  return normalize(vec3(dot(V[0], u), dot(V[1], u), dot(V[2], u)));
+}
+`
diff --git a/src/monde/habillage-crop.js b/src/monde/habillage-crop.js
index b37b593..e25d601 100644
--- a/src/monde/habillage-crop.js
+++ b/src/monde/habillage-crop.js
@@ -66,20 +66,25 @@
  * `retirerHabillage` les rend. Deux littéraux jumeaux auraient divergé en
  * silence (§1 de `/threejs-optimisation`, question 2), et c'est exactement ce
  * qui venait de se produire.
  */
 export const HABILLAGE_MONDE = Object.freeze({
   contourIntervalM: 500,
   contourOpacite: 0.55,
   contourPoids: 0.7,
   grainForceM: 0,
   grainEchelle: 96,
+  // ⚠️ **FAUX, ET C'EST LE DÉPÔT AU BIT PRÈS — Tâche P9.** Sans crop, la normale
+  // du globe reste celle des SOMMETS : c'est ce que la vue orbitale rend depuis
+  // toujours. Le §6 de `eclairage-crop.js` explique pourquoi le BLOC, lui, ne
+  // peut pas s'en contenter — 5 625 sommets sur le bloc contre 594 434 au socle.
+  normaleFine: false,
   solOpacite: 1,
   margeCoteM: 0,
 })
 
 // ══════════ ① LES CHAMPS CUITS — masque de côte, masque de mer, analyse ═════
 
 /**
  * (u, v) locaux du crop, dans [−1, 1] → UV du champ cuit du socle, dans [0, 1].
  *
  * ⚠️ **AUCUN RETOURNEMENT EN Y, ET C'EST UNE DÉCISION, PAS UN OUBLI.**
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
index 991cfab..b58f3a9 100644
--- a/test/crop-eclairage.test.js
+++ b/test/crop-eclairage.test.js
@@ -43,24 +43,28 @@ import {
   natLum,
   albedoCrop,
   irradianceCrop,
   eclairerCrop,
   hautLocal,
   directionSoleilLocale,
   irradianceAmbiante,
   environnementEffectif,
   GLSL_ECLAIRAGE,
   GLSL_OMBRE_PEINTURE,
+  // ⚠️ **La normale par fragment — Tache P9.**
+  normaleParDeplacement,
+  GLSL_NORMALE_FINE,
 } from '../src/monde/eclairage-crop.js'
 import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
 import { LUMA_709 } from '../src/monde/naturel-crop.js'
 import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
+import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
 // ⚠️ **Tache P6** : le morceau d irradiance DETACHE, pour les parois.
 import { GLSL_IRRADIANCE } from '../src/monde/eclairage-crop.js'
 
 // ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
 // appelle `document.createElement('canvas')` au constructeur. C'est le patron de
 // `test/loi-texture-monde.test.js` et de `test/damier-cadre.test.js`.
 globalThis.document = {
   createElement: () => ({
     width: 0,
     height: 0,
@@ -984,10 +988,257 @@ test('⑦c SANS donnée de paroi, la paroi retombe sur les tuiles — AU BIT PR
   // ⚠️ **ET CE N'EST PAS UN BANC VIDE** : les valeurs ne sont ni nulles ni le
   // défaut MONDE — sans ça, l'égalité ci-dessus serait « zéro égale zéro ».
   assert.ok(u.uParoiCielIrr.value.x > 2, 'le repli porte une vraie irradiance')
   assert.notDeepEqual(u.uParoiCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
   // … et une ambiante de paroi NULLE n'est PAS le repli : un matériau dont
   // l'environnement a été retiré doit garder sa seule lampe hémisphérique.
   g.poserHabillage({ ...base, paroiAmbianteCoef: null, paroiAmbianteIntensite: 0 })
   assert.ok(u.uParoiCielIrr.value.x < u.uCielIrr.value.x, 'ambiante nulle, pas repli')
   assert.ok(u.uParoiCielIrr.value.x > 0.18, 'la lampe hemispherique reste')
 })
+
+// ══════════ ⑧ LA NORMALE PAR FRAGMENT — Tâche P9 ════════════════════════════
+//
+// ⚠️ **CE QUE CE BLOC VÉRIFIE, ET DANS QUEL ORDRE** :
+//   ⑧a la loi PURE, contre un oracle INDÉPENDANT — la surface déplacée est
+//      construite point par point et sa normale obtenue par un vrai produit
+//      vectoriel de différences finies. Le jumeau JS n'est donc pas comparé à
+//      lui-même ;
+//   ⑧b l'INVARIANCE D'ÉCHELLE D'ÉCRAN, qui est la propriété pour laquelle on
+//      s'écarte de `three` — et le contre-exemple, la version de `three`, est
+//      rejoué à côté pour montrer qu'elle, elle ne l'a pas ;
+//   ⑧c la RÉFÉRENCE, LUE DANS `node_modules/three` : les quatre termes y sont,
+//      et le `normalize( dFdx( surf_pos` aussi. Notre écart est donc réel,
+//      nommé, et pas un oubli ;
+//   ⑧d la TRANSCRIPTION GLSL, terme à terme, sur le texte SANS SES COMMENTAIRES ;
+//   ⑧e le BRANCHEMENT dans le nuanceur — la faiblesse récurrente du chantier ;
+//   ⑧f le BRANCHEMENT dans la chaîne : `poserHabillage`, `retirerHabillage`,
+//      `CHAMPS_HABILLAGE`, `contexteCrop` et `setExaggeration`.
+
+/** Le produit vectoriel et le produit scalaire, une fois pour tout ce bloc. */
+const CROIX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
+const NORME = (v) => Math.hypot(v[0], v[1], v[2])
+const UNITE = (v) => { const l = NORME(v); return [v[0] / l, v[1] / l, v[2] / l] }
+
+/**
+ * L'ORACLE INDÉPENDANT — il ne connaît pas `normaleParDeplacement`.
+ *
+ * ⚠️ **CE QU'IL DÉCRIT, ET C'EST LE POINT DÉLICAT DE TOUT CE BLOC : LE PLAN DE
+ * `n`, DÉPLACÉ DE `h` LE LONG DE `n`.** C'est la surface que le crop peint — la
+ * sphère nue, plus le relief le long de son rayon — et c'est celle que la
+ * formule de Mikkelsen rend, puisqu'elle perturbe la normale QU'ON LUI DONNE.
+ * Les tangentes d'écran, elles, viennent de la surface DÉPLACÉE : leur
+ * composante radiale n'est pas un déplacement au sol, on la retire.
+ * ⚡ **Et c'est bien le même objet des deux côtés** : ⑧a assert plus bas que
+ * `normaleParDeplacement` est INVARIANTE par cette projection, donc que la
+ * retirer de la loi (ce qu'a fait la campagne de mutation) est un no-op.
+ *
+ * On CONSTRUIT la surface en trois points et on prend le produit vectoriel des
+ * deux différences finies. C'est la définition, pas la formule de Mikkelsen.
+ */
+function normaleOracle(sx, sy, n, dhx, dhy) {
+  // ⚠️ **LE DÉPLACEMENT SE FAIT DEPUIS LE PLAN DE `n`**, parce que c'est la
+  // surface qu'on décrit : la sphère nue, plus `h` le long de son rayon. Les
+  // tangentes d'écran portent déjà la pente du maillage ; leur composante
+  // radiale n'est pas un déplacement au sol.
+  const proj = (v) => { const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d] }
+  const tx = proj(sx)
+  const ty = proj(sy)
+  const a = [tx[0] + n[0] * dhx, tx[1] + n[1] * dhx, tx[2] + n[2] * dhx]
+  const b = [ty[0] + n[0] * dhy, ty[1] + n[1] * dhy, ty[2] + n[2] * dhy]
+  const c = CROIX(a, b)
+  // le produit vectoriel donne la normale au SIGNE de l'orientation près : on la
+  // remet du côté de la normale de base, comme le fait `sign(fDet)`.
+  const s = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= 0 ? 1 : -1
+  return UNITE([c[0] * s, c[1] * s, c[2] * s])
+}
+
+test('⑧a la normale par déplacement suit la DÉFINITION — oracle indépendant', () => {
+  // ① gradient nul : la normale ne bouge pas d'un bit.
+  assert.deepEqual(normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0, 0), [0, 1, 0])
+  // ② un cas à la main, vérifiable de tête : pente 1/2 vers l'est.
+  const n2 = normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0.5, 0)
+  const attendu = UNITE([-0.5, 1, 0])
+  for (let i = 0; i < 3; i++) assert.ok(Math.abs(n2[i] - attendu[i]) < 1e-12, `${n2} contre ${attendu}`)
+  // ⚠️ **ET LE SENS EST LE BON** : le sol MONTE vers l'est, donc la normale se
+  // penche vers l'OUEST. Une mutation de signe passerait l'égalité de norme.
+  assert.ok(n2[0] < 0, 'la normale se penche du mauvais cote')
+  // ③ ⚡ **LE BALAYAGE CONTRE L'ORACLE**, sur des repères et des pentes variés —
+  // y compris un repère NON orthogonal et une base inclinée, où une formule
+  // approchée « (−hx, 1, −hy) » tomberait.
+  const bases = [
+    { sx: [1, 0, 0], sy: [0, 0, 1], n: [0, 1, 0] },
+    { sx: [0.7, 0.1, 0], sy: [0.2, -0.05, 0.9], n: UNITE([0.2, 0.95, -0.1]) },
+    { sx: [3, -1, 2], sy: [-1, 0.5, 4], n: UNITE([1, 2, 3]) },
+    { sx: [0.001, 0, 0], sy: [0, 0, 0.001], n: [0, 1, 0] },
+  ]
+  let compares = 0
+  for (const b of bases) {
+    for (const t of balayage(11)) {
+      const dhx = (t - 0.5) * 0.9
+      const dhy = (0.5 - t) * 0.4
+      const a = normaleParDeplacement(b.sx, b.sy, b.n, dhx, dhy)
+      const o = normaleOracle(b.sx, b.sy, b.n, dhx, dhy)
+      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - o[i]) < 1e-9, `${a} contre l'oracle ${o}`)
+      compares++
+    }
+  }
+  assert.ok(compares >= 48, `banc vide : ${compares} comparaisons`)
+  // ④ ⛔ **L'INVARIANCE PAR PROJECTION, ET ELLE VIENT D'UNE SURVIVANTE DE
+  // MUTATION.** La loi portait trois lignes qui projetaient `sx` et `sy` sur le
+  // plan de `n` ; retirées, AUCUN test ne rougissait. L'algèbre dit pourquoi :
+  // `(sy − n(sy·n)) × n = sy × n`, et `det` ne voit pas la part radiale parce
+  // que `R1 ⟂ n`. Les trois lignes sont parties ; l'invariance reste, ASSERTÉE.
+  for (const b of bases) {
+    const proj = (v) => { const d = v[0] * b.n[0] + v[1] * b.n[1] + v[2] * b.n[2]; return [v[0] - b.n[0] * d, v[1] - b.n[1] * d, v[2] - b.n[2] * d] }
+    const a = normaleParDeplacement(b.sx, b.sy, b.n, 0.31, -0.12)
+    const c = normaleParDeplacement(proj(b.sx), proj(b.sy), b.n, 0.31, -0.12)
+    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - c[i]) < 1e-12, `la projection n'est plus un no-op : ${a} contre ${c}`)
+  }
+  // ⑤ ⚠️ **LE CAS DÉGÉNÉRÉ, ET IL EST ATTEIGNABLE** : au pixel où les deux
+  // tangentes d'écran sont colinéaires (une silhouette), `det` vaut zéro et le
+  // gradient aussi — la loi doit rendre la normale de BASE, pas un vecteur nul
+  // que `normalize` ferait exploser en NaN plus loin.
+  const degenere = normaleParDeplacement([1, 0, 0], [2, 0, 0], [0, 1, 0], 0, 0)
+  assert.deepEqual(degenere, [0, 1, 0])
+})
+
+test('⑧b ⚡ L’INVARIANCE D’ÉCHELLE D’ÉCRAN — la raison de s’écarter de three', () => {
+  // La géométrie ne dépend pas du zoom : rendre le MÊME sol deux fois plus près
+  // double `dFdx(P)` ET `dFdx(h)`, et la normale doit être INCHANGÉE.
+  const sx = [0.7, 0.1, 0]
+  const sy = [0.2, -0.05, 0.9]
+  const n = UNITE([0.2, 0.95, -0.1])
+  const a = normaleParDeplacement(sx, sy, n, 0.13, -0.04)
+  for (const k of [0.25, 2, 17]) {
+    const b = normaleParDeplacement(sx.map((v) => v * k), sy.map((v) => v * k), n, 0.13 * k, -0.04 * k)
+    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-12, `k=${k} : ${b} contre ${a}`)
+  }
+  // ⛔ **ET LE CONTRE-EXEMPLE : LA VERSION DE `three`, REJOUÉE ICI, N'A PAS
+  // CETTE PROPRIÉTÉ.** C'est elle qui normalise `sigma` ; son commentaire dit
+  // pourquoi (« regardless of the texture's scale »), et c'est une convention
+  // d'ARTISTE. Sous elle, la même montagne s'aplatit en s'éloignant.
+  const troisJS = (sxx, syy, nn, dhx, dhy) => normaleParDeplacement(UNITE(sxx), UNITE(syy), nn, dhx, dhy)
+  const t1 = troisJS(sx, sy, n, 0.13, -0.04)
+  const t2 = troisJS(sx.map((v) => v * 2), sy.map((v) => v * 2), n, 0.13 * 2, -0.04 * 2)
+  assert.ok(Math.abs(t1[0] - t2[0]) > 0.02, 'la version de three serait invariante : le contre-exemple ne mord pas')
+})
+
+test('⑧c la référence est LUE DANS node_modules/three, et l’écart est nommé', () => {
+  const bump = readFileSync(
+    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js', import.meta.url),
+    'utf8'
+  ).replace(/\s+/g, ' ')
+  // les quatre termes de Mikkelsen sont bien ceux-là, chez three
+  assert.match(bump, /vec3 R1 = cross\( vSigmaY, vN \);/)
+  assert.match(bump, /vec3 R2 = cross\( vN, vSigmaX \);/)
+  assert.match(bump, /float fDet = dot\( vSigmaX, R1 \)/)
+  assert.match(bump, /vec3 vGrad = sign\( fDet \) \* \( dHdxy\.x \* R1 \+ dHdxy\.y \* R2 \);/)
+  assert.match(bump, /return normalize\( abs\( fDet \) \* surf_norm - vGrad \);/)
+  // ⚡ **ET L'ÉCART EST RÉEL** : c'est bien three qui normalise, et nous qui ne
+  // le faisons pas. Le jour où three cesse de normaliser, ce test rougit et le
+  // commentaire du module devient faux : il faudra le corriger.
+  assert.match(bump, /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);/)
+  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '')
+  assert.ok(!/normalize\s*\(\s*sx\s*\)/.test(nu) && !/normalize\s*\(\s*sy\s*\)/.test(nu),
+    'le crop normalise sigma : il reprend la convention d\'artiste de three, et la pente suivrait le zoom')
+})
+
+test('⑧d le GLSL est la TRANSCRIPTION du jumeau JS — terme à terme, sans commentaires', () => {
+  // ⚠️ **SANS SES COMMENTAIRES** : la Tâche K ter a trouvé une assertion verte
+  // parce qu'elle lisait une formule DANS UN COMMENTAIRE.
+  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
+  assert.match(nu, /vec3 normaleFineCrop\(vec3 sx, vec3 sy, vec3 n, float dhx, float dhy\) \{/)
+  assert.match(nu, /vec3 r1 = cross\(sy, n\);/)
+  assert.match(nu, /vec3 r2 = cross\(n, sx\);/)
+  assert.match(nu, /float det = dot\(sx, r1\);/)
+  // ⛔ **ET AUCUNE PROJECTION** : elle serait un no-op (⑧a l'assert), donc trois
+  // lignes de code mort dans un nuanceur exécuté par fragment.
+  assert.ok(!/dot\(sx, n\)/.test(nu), 'le GLSL projette : trois lignes mortes par fragment')
+  assert.match(nu, /vec3 grad = sign\(det\) \* \(dhx \* r1 \+ dhy \* r2\);/)
+  assert.match(nu, /vec3 v = abs\(det\) \* n - grad;/)
+  assert.match(nu, /return l > 0\.0 \? v \/ l : n;/)
+  // et la transposée, qui n'existe pas en GLSL ES 1.0
+  assert.match(nu, /vec3 nMondeDepuisVue\(mat3 V, vec3 u\) \{ return normalize\(vec3\(dot\(V\[0\], u\), dot\(V\[1\], u\), dot\(V\[2\], u\)\)\); \}/)
+  // ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
+  // ce texte. Ce que ce fichier peut faire, c'est garantir que le JS que ⑧a
+  // vérifie contre un oracle et le GLSL disent la MÊME chose ; l'écran, lui, est
+  // dans `.banc/P9/` et dans le compte rendu de la tâche.
+})
+
+test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, échelle, varying', () => {
+  const nu = FRAG_NU.replace(/\s+/g, ' ')
+  // ① la garde est un UNIFORME, déclaré, et le bloc est SOUS elle
+  assert.match(FRAG_NU, /uniform float uNormaleFineOn;/)
+  assert.match(FRAG_NU, /uniform float uUnitesParMetre;/)
+  assert.match(nu, /if \(uNormaleFineOn > 0\.5\) \{ vec3 nSphere/)
+  // ② ⛔ LA BASE EST LA SPHÈRE NUE, PAS `vNormalW` — c'est le point où un
+  // implémenteur pressé compterait deux fois la pente du maillage.
+  assert.match(nu, /vec3 nSphere = normalize\(vVue - vec3\(viewMatrix\[3\]\)\);/)
+  const bloc = nu.slice(nu.indexOf('if (uNormaleFineOn > 0.5)'), nu.indexOf('float nduCrop'))
+  assert.ok(!/vNormalW/.test(bloc), 'la normale fine part de vNormalW : la pente grossiere est comptee deux fois')
+  // ③ l'échelle est APPLIQUÉE aux DEUX dérivées, pas à une seule
+  assert.match(bloc, /dFdx\(h\) \* uUnitesParMetre, dFdy\(h\) \* uUnitesParMetre/)
+  // ⛔ **ET LES QUATRE ARGUMENTS SONT APPARIÉS DANS LE BON ORDRE — une mutation
+  // qui échange les deux TANGENTES a survécu au premier tour.** `dFdx(vVue)`
+  // doit aller avec `dFdx(h)` : appariés à l'envers, le gradient tourne de
+  // quatre-vingt-dix degrés et la lumière éclaire les flancs perpendiculaires.
+  assert.match(bloc, /normaleFineCrop\(dFdx\(vVue\), dFdy\(vVue\), nSphere, dFdx\(h\) \* uUnitesParMetre, dFdy\(h\) \* uUnitesParMetre\)/)
+  // ④ et c'est bien `h`, la hauteur du fragment APRÈS le fond marin et le grain
+  assert.ok(nu.indexOf('if (uNormaleFineOn > 0.5)') > nu.indexOf('h += uGrainForceM'),
+    'la normale fine est calculee AVANT le grain : elle deriverait une autre surface')
+  // ⑤ le varying existe des DEUX côtés
+  const VERT_SRC = GLOBE_SRC.slice(GLOBE_SRC.indexOf('const VERT ='), GLOBE_SRC.indexOf('const FRAG ='))
+  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /varying vec3 vVue;/)
+  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /vVue = mv\.xyz;/)
+  assert.match(FRAG_NU, /varying vec3 vVue;/)
+  // ⑥ et le texte de la loi est INJECTÉ, pas recopié
+  assert.ok(GLOBE_NU.includes('${GLSL_NORMALE_FINE}'), 'le globe recopie la loi au lieu de l\'injecter')
+  assert.ok(!/vec3 normaleFineCrop\(vec3/.test(GLOBE_NU.replace('${GLSL_NORMALE_FINE}', '')),
+    'une SECONDE ecriture de normaleFineCrop vit dans globe.js')
+})
+
+test('⑧f ⛔ LE BRANCHEMENT DANS LA CHAÎNE — pose, retrait, veille, contexte, échelle', () => {
+  const g = new Globe({ radius: 100, globeExaggeration: 18 })
+  const u = g.uniforms
+  // ① le défaut est le dépôt au bit près
+  assert.equal(u.uNormaleFineOn.value, 0)
+  assert.equal(HABILLAGE_MONDE.normaleFine, false)
+  // ② POSÉE, elle s'allume ; POSÉE À FAUX, elle s'éteint — les deux sens.
+  g.poserHabillage({ normaleFine: true })
+  assert.equal(u.uNormaleFineOn.value, 1)
+  g.poserHabillage({ normaleFine: false })
+  assert.equal(u.uNormaleFineOn.value, 0, 'une pose a faux laisse la normale fine allumee')
+  // ⚠️ **ET L'INTERRUPTEUR EST L'ABSENCE DE DONNÉE** — le patron de `uCropOn`,
+  // `uHabOn`, `coastMask` et de l'ambiante de paroi (⑦c). Un appelant qui ne
+  // connaît pas ce champ doit rendre l'image d'AVANT la Tâche P9, pas un globe
+  // modelé au fragment sur toute la planète.
+  g.poserHabillage({ normaleFine: true })
+  g.poserHabillage({})
+  assert.equal(u.uNormaleFineOn.value, 0, 'une pose SANS le champ allume la normale fine')
+  // ③ et `retirerHabillage` la rend
+  g.poserHabillage({ normaleFine: true })
+  g.retirerHabillage()
+  assert.equal(u.uNormaleFineOn.value, 0)
+  // ④ la veille la SURVEILLE — sans quoi elle ne serait jamais reposée
+  assert.ok(CHAMPS_HABILLAGE.includes('normaleFine'), 'la veille ne surveille pas normaleFine')
+  assert.ok(habillageDifferent({ normaleFine: true }, { normaleFine: false }),
+    'la veille ne voit pas normaleFine changer')
+  // ⑤ ⚡ **ET `contexteCrop` LA PASSE** — c'est le maillon que ce chantier rate
+  // treize fois sur treize. On lit le texte de `main.js`, sans ses commentaires.
+  const ctx = MAIN_SRC.replace(/\/\/[^\n]*/g, '')
+  const i = ctx.indexOf('habillage: {')
+  assert.ok(i > 0, '`contexteCrop` n\'a plus d\'objet `habillage`')
+  const bloc = ctx.slice(i, ctx.indexOf('paroiCouleur', i) + 40)
+  assert.match(bloc, /normaleFine:\s*true/)
+  // ⑥ ⛔ L'ÉCHELLE DE RELIEF EST JUSTE, ET ELLE SUIT L'EXAGÉRATION. Une échelle
+  // fausse ne se voit pas : elle rend juste des pentes fausses. C'est la famille
+  // de fautes que `uMerHoule` (121,6×) et `skirtDrop` (10×) ont coûtée.
+  assert.ok(Math.abs(u.uUnitesParMetre.value - (100 / 6371000) * 18) < 1e-18,
+    `uUnitesParMetre vaut ${u.uUnitesParMetre.value} a la naissance`)
+  g._rechargeTuiles = () => {}
+  g.setExaggeration(2.8)
+  assert.ok(Math.abs(u.uUnitesParMetre.value - (100 / 6371000) * 2.8) < 1e-18,
+    'l\'echelle de relief n\'a pas suivi setExaggeration')
+  // ⑦ et elle est bien celle de `_buildMesh` — la MÊME formule, pas une voisine.
+  assert.match(GLOBE_NU, /const dispScale = \(R_GLOBE \/ EARTH_RADIUS_M\) \* this\.exaggeration/)
+})
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index 6d63e89..0eaa5c4 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -602,20 +602,24 @@ function globeStub(crop = REPERE) {
       uSolOn: val(0),
       uSolOpacite: val(HABILLAGE_MONDE.solOpacite),
       uSolOffset: val(vec2(0, 0)),
       uSolScale: val(vec2(1, 1)),
       uSolTexel: val(vec2(1 / 2048, 1 / 2048)),
       uContourInterval: val(HABILLAGE_MONDE.contourIntervalM),
       uContourOpacity: val(HABILLAGE_MONDE.contourOpacite),
       uContourWeight: val(HABILLAGE_MONDE.contourPoids),
       uGrainForceM: val(HABILLAGE_MONDE.grainForceM),
       uGrainEchelle: val(HABILLAGE_MONDE.grainEchelle),
+      // ⚠️ **LA NORMALE PAR FRAGMENT — Tâche P9**, au même défaut que le
+      // constructeur : c'est ce qui rend ⑨h (l'aller-retour bit à bit) capable
+      // de voir un `retirerHabillage` qui l'oublierait.
+      uNormaleFineOn: val(HABILLAGE_MONDE.normaleFine ? 1 : 0),
       // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
       //
       // ⚠️ **LE STUB PORTE LES SEIZE UNIFORMES DE L'HABILLAGE PLUS LES QUATORZE
       // DE LA COLORISATION**, et il les part aux MÊMES valeurs que le
       // constructeur : c'est ce qui rend ⑨h (l'aller-retour bit à bit) capable de
       // voir un uniforme que `retirerHabillage` oublierait de rendre.
       uAnalysis: val(null),
       uAnalysisOn: val(0),
       uTexShade: val(NATUREL_MONDE.texShade),
       uWetK: val(NATUREL_MONDE.wetK),
diff --git a/test/crop-naturel.test.js b/test/crop-naturel.test.js
index 5530be1..30c8185 100644
--- a/test/crop-naturel.test.js
+++ b/test/crop-naturel.test.js
@@ -638,21 +638,21 @@ const val = (v) => ({ value: v })
 const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this }, copy() { return this } })
 const couleurStub = () => ({ set() {}, setStyle() {} })
 function globeStub() {
   return {
     _crop: null,
     uniforms: {
       uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
       uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
       uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
       uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
-      uGrainForceM: val(0), uGrainEchelle: val(96),
+      uGrainForceM: val(0), uGrainEchelle: val(96), uNormaleFineOn: val(0),
       uAnalysis: val(null), uAnalysisOn: val(0),
       uTexShade: val(NATUREL_MONDE.texShade), uWetK: val(NATUREL_MONDE.wetK),
       uExpoK: val(NATUREL_MONDE.expoK), uHemi: val(NATUREL_MONDE.hemi),
       uTreeLine: val(NATUREL_MONDE.treeLine),
       uRampCrop: val(null), uRampCropOn: val(0),
       uHeightContrast: val(NATUREL_MONDE.heightContrast), uHeightPivot: val(NATUREL_MONDE.heightPivot),
       uHazeAmt: val(NATUREL_MONDE.hazeAmt), uHazeAlt: val(NATUREL_MONDE.hazeAlt),
       uHazeDist: val(NATUREL_MONDE.hazeDist),
       uHazeColor: val({ hex: NATUREL_MONDE.hazeColor, set(v) { this.hex = v } }),
       // ══════ L'ÉCLAIRAGE ET LA COUCHE APPARENCE — Tâche P3 ═══════════════
diff --git a/test/exageration-globe.test.js b/test/exageration-globe.test.js
index 5b59c20..5c82a24 100644
--- a/test/exageration-globe.test.js
+++ b/test/exageration-globe.test.js
@@ -311,37 +311,50 @@ test('②c les surcharges d\'Adrien traversent le nouveau pilote', () => {
 // méthode avec un `this` minimal, exactement comme `test/globe-precision.test.js`
 // emprunte `_buildMesh`. Ce qui est vérifié, c'est la MÉTHODE, pas le montage.
 
 /** Le `this` minimal dont `majExageration` et `setExaggeration` ont besoin. */
 function fauxGlobe({ exagSuivie, exaggeration = 18 }) {
   return {
     exagSuivie,
     exaggeration,
     tiles: new Map(),
     recharges: 0,
+    // ⚠️ **L'ÉCHELLE DE RELIEF FAIT PARTIE DU CONTRAT DEPUIS LA TÂCHE P9**, et
+    // ce faux la porte plutôt que la source ne l'esquive par un `?.` : la
+    // normale par fragment dérive la hauteur de la TEXTURE, donc elle a besoin
+    // du même facteur mètre → unité de scène que `_buildMesh`. Un
+    // `setExaggeration` qui ne le mettrait pas à jour rendrait des pentes
+    // fausses d'un facteur `exagAvant / exagAprès` — invisible à l'œil nu.
+    uniforms: { uUnitesParMetre: { value: (100 / 6371000) * exaggeration } },
     chargeRacines() { this.recharges++ },
     setExaggeration: Globe.prototype.setExaggeration,
     _rechargeTuiles: Globe.prototype._rechargeTuiles,
     majExageration: Globe.prototype.majExageration,
   }
 }
 
 test('③ le globe LIT le partage — il ne calcule plus sa propre valeur', () => {
   const src = lire('src/globe.js')
   assert.ok(/import\s*\{[^}]*lireExageration[^}]*\}\s*from\s*'\.\/monde\/exageration-continue\.js'/.test(src),
     '`globe.js` n\'importe pas `lireExageration` — il n\'est pas le quatorzième lecteur')
   const partage = creerExagerationPartagee()
   const g = fauxGlobe({ exagSuivie: true })
   poserExageration(partage, 3.2)
   assert.equal(g.majExageration({ exagPartage: partage }), 3.2)
   assert.equal(g.exaggeration, 3.2)
   assert.equal(g.recharges, 1, 'la géométrie est cuite : elle doit être redemandée')
+  // ⚠️ **ET L'ÉCHELLE DE RELIEF A SUIVI — Tâche P9.** Le relief est cuit dans
+  // les SOMMETS, mais la normale par fragment le dérive de la TEXTURE : elle a
+  // besoin du même facteur mètre → unité de scène. Restée à 18 pendant que
+  // l'exagération tombe à 3,2, elle rendrait des pentes 5,6 fois trop raides.
+  assert.ok(Math.abs(g.uniforms.uUnitesParMetre.value - (100 / 6371000) * 3.2) < 1e-15,
+    `uUnitesParMetre vaut ${g.uniforms.uUnitesParMetre.value} : l'échelle de relief n'a pas suivi l'exagération`)
   // …et une valeur INCHANGÉE ne redemande rien.
   g.majExageration({ exagPartage: partage })
   assert.equal(g.recharges, 1, 'le globe se recharge pour rien')
 })
 
 test('③b SANS DRAPEAU, RIEN NE CHANGE — le globe reste à 18', () => {
   const partage = creerExagerationPartagee()
   poserExageration(partage, 3.2)
   const g = fauxGlobe({ exagSuivie: false })
   assert.equal(g.majExageration({ exagPartage: partage }), 18)
