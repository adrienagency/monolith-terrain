d258d0b tache P10 : le banc, la campagne de mutation, et les quatre survivantes du premier tour
7ebc588 tache P10 : le pas des quatre lectures couvre une empreinte de pixel ENTIERE
9fdae0f tache P10 : la normale du crop scintillait a la parite des quads, le gradient passe en espace texture

 src/globe.js                | 231 +++++++++++++++----
 src/monde/eclairage-crop.js | 292 +++++++++++++++---------
 test/crop-eclairage.test.js | 543 ++++++++++++++++++++++++++++++++------------
 test/crop-parois.test.js    |   8 +-
 4 files changed, 771 insertions(+), 303 deletions(-)

diff --git a/src/globe.js b/src/globe.js
index 44b9c25..ba5d2c2 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -119,23 +119,26 @@ import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
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
-  // ⚠️ **LA NORMALE PAR FRAGMENT — Tâche P9.** Même patron : la loi (celle de
-  // Mikkelsen, que `three` porte) et sa dérivation vivent dans le module PUR ;
-  // ce fichier n'en injecte que le texte.
+  // ⚠️ **LA NORMALE PAR FRAGMENT — Tâche P9, RÉÉCRITE PAR P10.** Même patron :
+  // la loi et sa dérivation vivent dans le module PUR ; ce fichier n'en injecte
+  // que le texte. ⚡ **DEUX MORCEAUX DEPUIS P10** : le repère de sol part au
+  // nuanceur de SOMMETS (`latlon` y est un attribut exact), la normale reste au
+  // nuanceur de fragments.
+  GLSL_REPERE_SOL,
   GLSL_NORMALE_FINE,
   RECIPROQUE_PI,
   ECLAIRAGE_MONDE,
   directionSoleilLocale,
   hautLocal,
   irradianceAmbiante,
 } from './monde/eclairage-crop.js'
 // ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
 //
 // > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
@@ -715,21 +718,44 @@ const IMAGES_QUARANTAINE = 600
 // on the limb
 function gridFor(z) {
   if (z <= 2) return 64
   if (z <= 3) return 48
   if (z <= 5) return 32
   return 24
 }
 
 // ---------------------------------------------------------------- shader
 
+// ══════════ LES DEUX CONVERSIONS DE LA NORMALE FINE — Tâche P10 ════════════
+//
+// ⚠️ **ELLES SONT INJECTÉES DANS LE TEXTE GLSL, PAS RECOPIÉES À LA MAIN**, et
+// elles DÉRIVENT toutes les deux de `R_GLOBE` et `EARTH_RADIUS_M` — les deux
+// constantes de `geo.js` sur lesquelles `_buildMesh` pose déjà ses sommets
+// (`dispScale = (R_GLOBE / EARTH_RADIUS_M) * exagération`). Un chiffre écrit en
+// dur ici serait la CINQUIÈME faute de monnaie de ce chantier.
+//
+// ⛔ **ET CE N'EST PAS `CIRCONFERENCE_M` (40 075 016,686 m, l'équateur WGS84)**,
+// que `habillage-crop.js` emploie pour convertir des demi-côtés de Mercator en
+// mètres de sol RÉELS. Ici on mesure une distance SUR LA SPHÈRE DU GLOBE, et
+// cette sphère-là a le rayon MOYEN `EARTH_RADIUS_M = 6 371 000` : c'est lui,
+// et lui seul, qui rend la pente cohérente avec `uUnitesParMetre`. Les deux
+// diffèrent de 0,11 % — invisible, et faux.
+const TOUR_SPHERE_M = 2 * Math.PI * EARTH_RADIUS_M
+// unités de scène par mètre de SOL — l'échelle HORIZONTALE, celle que
+// l'exagération ne touche PAS (elle n'étire que le relief).
+const UNITES_PAR_METRE_SOL = R_GLOBE / EARTH_RADIUS_M
+
 const VERT = /* glsl */ `
+// ⚠️ INJECTE, PAS RECOPIE — Tache P10. Le repere de sol est la DERIVEE de
+// latLonToSphere ; son jumeau JS (repereSolSphere) est rejoue sous node contre
+// latLonToSphere elle-meme dans test/crop-eclairage.test.js.
+${GLSL_REPERE_SOL}
 varying vec2 vUv;
 varying vec3 vNormalW;
 varying vec2 vLatLon;
 // LA DISTANCE CAMERA DU FRAGMENT — Tache K, la loi de texture ancree au monde.
 //
 // (Pas d'accent grave dans ce bloc : il vit dans un template literal JS et le
 // terminerait — le piege que terrain.js, ocean.js et le bloc du crop
 // documentent tous les trois, et qui a coute une passe de syntaxe ici meme.)
 //
 // ⚠️ PRISE EN ESPACE DE VUE, PAS EN ESPACE MONDE, ET C'EST LA PRECISION QUI LE
@@ -742,64 +768,89 @@ varying vec2 vLatLon;
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
-// LA POSITION EN ESPACE DE VUE — Tache P9, la normale par fragment.
+// LE REPERE DE SOL EN ESPACE MONDE — Tache P10, la normale par fragment.
 //
-// ⚠️ EN ESPACE DE VUE, ET C'EST LA MEME RAISON QUE vProfCam JUSTE AU-DESSUS :
-// la normale fine a besoin de dFdx(P) et dFdy(P), c'est-a-dire de la TANGENTE
-// d'ecran de la surface. Une coordonnee MONDE de magnitude 100 a un ulp
-// float32 de 0,38 m quand cette tangente vaut quelques dizaines de metres par
-// pixel : la derivee serait bruitee de plusieurs pour cent. mv.xyz est relatif
-// a la CAMERA — quelques unites — et sa derivee est nette.
+// ⛔ P9 PASSAIT LA POSITION EN ESPACE DE VUE (vVue) POUR EN PRENDRE dFdx ET
+// dFdy. C'est cette derivee d'ecran qui rendait la normale sensible a la PARITE
+// des quads : 10,872 octets de residu pour UN pixel de camera contre 0,030 au
+// socle (notation-03 §4). Elle est partie, et vVue avec elle.
 //
-// ⚠️ ET C'EST UN varying DE PLUS, PAS UN ATTRIBUT : aucun octet de geometrie
-// en plus, et mv est deja calcule ci-dessous pour vProfCam et gl_Position.
-varying vec3 vVue;
+// ⚠️ ICI, RIEN N'EST UNE DERIVEE. latlon est un ATTRIBUT — la latitude et la
+// longitude EXACTES du sommet, deja la pour le graticule et pour la decoupe —,
+// donc le repere est une fonction de la POSITION. Un decalage entier de camera
+// ne peut plus le changer.
+//
+// ⚠️ ET LA PRECISION N'EST PLUS UN SUJET : ces vecteurs sont UNITAIRES. La
+// raison qui obligeait P9 a l'espace de vue (l'ulp float32 a magnitude 100 vaut
+// 0,486 m) ne s'applique pas a un vecteur de longueur 1.
+//
+// ⚠️ DEUX VARYINGS ET PAS TROIS : le triedre est DIRECT, donc le fragment
+// retrouve le nord par cross(haut, est). Un varying de vec3 coute plus cher
+// qu'un produit vectoriel par fragment.
+varying vec3 vEstW;
+varying vec3 vHautW;
 attribute vec2 latlon;
 void main() {
   vUv = uv;
   vLatLon = latlon;
   vNormalW = normalize(mat3(modelMatrix) * normal);
+  // ⚠️ mat3(modelMatrix) ET PAS LE REPERE NU : le groupe du globe pourrait
+  // porter une rotation un jour, et vNormalW, uSunDir et uHemiHaut vivent tous
+  // dans l'espace MONDE. Poser le repere dans l'espace du MODELE ferait glisser
+  // la lumiere le jour ou quelqu'un tourne le groupe, sans qu'aucune erreur ne
+  // soit levee.
+  vec3 estL, nordL, hautL;
+  repereSolSphere(latlon.x, latlon.y, estL, nordL, hautL);
+  vEstW = mat3(modelMatrix) * estL;
+  vHautW = mat3(modelMatrix) * hautL;
   vec4 mv = modelViewMatrix * vec4(position, 1.0);
   vProfCam = -mv.z;
-  vVue = mv.xyz;
   gl_Position = projectionMatrix * mv;
 }
 `
 
 const FRAG = /* glsl */ `
 precision highp float;
 varying vec2 vUv;
 varying vec3 vNormalW;
 varying vec2 vLatLon;
 // ══════════ LA NORMALE PAR FRAGMENT — Tache P9 ═════════════════════════════
 //
 // ⚠️ uNormaleFineOn VAUT ZERO PAR DEFAUT, exactement comme uCropOn, uHabOn,
 // uMerRampeOn, uEclairageOn et uMppFacteur : sans poserHabillage la vue
 // orbitale en production rend au bit pres ce qu'elle rendait.
 //
 // Ce que ce poste repare est mesure et decompose dans l'en-tete §6 de
 // src/monde/eclairage-crop.js : la COULEUR du crop porte deja plus de detail
 // que celle du socle (10,250 contre 8,723 en energie, lumiere coupee des deux
 // cotes), et c'est son OMBRAGE qui manque en entier — parce que ses normales
 // viennent d'une grille de 5 625 sommets sur le bloc contre 594 434 au socle.
-varying vec3 vVue;
+varying vec3 vEstW;
+varying vec3 vHautW;
 uniform float uNormaleFineOn;
 // unites de scene par METRE de relief : (R_GLOBE / EARTH_RADIUS_M) x exageration
 uniform float uUnitesParMetre;
+// ⚠️ LA FRACTION DU MONDE MERCATOR QUE COUVRE UNE UNITE D'UV : 1 / 2^z, DONC
+// PROPRE A LA TUILE, comme uTex et uTilePx. Elle donne les metres de sol par
+// unite d'uv (le tour de la sphere x cos(latitude) x elle), c'est-a-dire la
+// MONNAIE qui convertit une denivelee en metres en une PENTE. La mettre dans
+// this.uniforms, partage, ferait juger toutes les tuiles sur le niveau de la
+// derniere chargee -- exactement le defaut que uTilePx documente juste a cote.
+uniform float uUvParMonde;
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
@@ -1116,26 +1167,75 @@ float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); ret
 // jumelles » dont terrain.js porte la cicatrice.
 ${GLSL_NATUREL}
 
 // ⚠️ INJECTE, PAS RECOPIE — Tache P3, et il vient APRES GLSL_NATUREL parce
 // qu'il APPELLE natLuminance. La loi d'eclairage n'est pas maison : c'est celle
 // de three.js (BRDF_Lambert, getHemisphereLightIrradiance) et de terrain.js
 // (fxShade, la valeur par sommet). test/crop-eclairage.test.js va la relire
 // dans node_modules/three plutot que de croire ce commentaire.
 ${GLSL_ECLAIRAGE}
 
-// ⚠️ INJECTE, PAS RECOPIE — Tache P9. La loi de Mikkelsen, celle que porte
-// three (bumpmap_pars_fragment.glsl.js), moins la normalisation de sigma que
-// son propre commentaire dit etre une convention d'artiste. La derivation et
-// l'ecart sont ecrits dans src/monde/eclairage-crop.js, §6 de l'en-tete.
+// ⚠️ INJECTE, PAS RECOPIE — Tache P10. Le champ de hauteur pose sur le plan
+// tangent : N = normalize(haut - gEst.est - gNord.nord). Elle REMPLACE la loi
+// de Mikkelsen de P9, dont les derivees d'ecran rendaient la normale sensible a
+// la parite des quads. La derivation, la mesure et le pourquoi sont ecrits dans
+// src/monde/eclairage-crop.js, §6 de l'en-tete.
 ${GLSL_NORMALE_FINE}
 
+// ══════ LA HAUTEUR DU BLOC, ECRITE UNE FOIS — Tache P10 ════════════════════
+//
+// ⚠️ DEUX APPELANTS, UNE SEULE ECRITURE. main() la compose sur un decodage
+// ANTIALIASE (cinq taps) ; le gradient de la normale fine la rappelle QUATRE
+// fois, sur un decodage simple, aux voisins en espace UV. Recopier la loi du
+// fond marin ou celle du grain dans le gradient aurait fait deux ecritures qui
+// divergent -- la cicatrice que terrain.js documente deja.
+//
+// ⛔ ET IL EN FAUT DEUX, PAS UNE, PARCE QUE L'ORDRE DU DEPOT PASSE ENTRE LES
+// DEUX : main() lit sousEau APRES le fond marin mais AVANT le grain. Les fondre
+// en une seule fonction deplacerait ce test d'un cran, et la rampe changerait de
+// branche sur les fragments ou le grain fait passer h de negatif a positif.
+//
+// ⚠️ ET LA BORNE DU CHAMP N'EST PAS DECORATIVE : au-dela de uFondPortee
+// demi-cotes, une texture en ClampToEdge prolongerait sa derniere ligne sur
+// toute la planete estompee sans qu'aucune erreur ne soit levee.
+// ⚠️ LES DEUX PARAMETRES S'APPELLENT qCrop ET h, COMME AU POINT D'APPEL, ET
+// C'EST DELIBERE : test/fond-crop.test.js EXTRAIT ce bloc de la source pour
+// l'EXECUTER contre altitudeSonde. Les renommer ne casserait pas le nuanceur —
+// il casserait la seule chose qui LIT ce nuanceur.
+float hauteurFond(vec2 qCrop, float h) {
+  if (uFondOn > 0.5 && uCropOn > 0.5
+      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0) {
+    h = min(texture2D(uFondChamp, qCrop / (2.0 * uFondPortee) + 0.5).r * uFondMetres, 0.0);
+  }
+  return h;
+}
+// ⚠️ INDEXE SUR LE CROP, JAMAIS SUR vUv NI SUR L'ECRAN, et il ne mord que sur
+// la TERRE (h > 0) comme le landFactor du socle : les raisons sont ecrites au
+// point d'appel, dans main().
+float hauteurGrain(vec2 qCrop, float h) {
+  if (uGrainForceM > 0.0 && h > 0.0) {
+    vec2 gp = qCrop * uGrainEchelle;
+    float g1 = mnNoise(gp);
+    float g2 = mnNoise(gp * 2.17 + vec2(19.3, -7.1));
+    h += uGrainForceM * ((g1 - 0.5) * 2.0 + (g2 - 0.5) * 0.7);
+  }
+  return h;
+}
+// La MEME hauteur qu'au point courant, prise ailleurs. ⚠️ decodeMeters ET PAS
+// decodeMetersAA : le lissage de l'AA vaut cinq taps, donc VINGT pour les
+// quatre lectures du gradient ; et il est deja porte par le PAS, qui couvre une
+// empreinte de pixel entiere.
+float hauteurEchant(vec2 uv, vec2 q) {
+  float hh = hauteurFond(q, decodeMeters(uv));
+  return uHabOn > 0.5 ? hauteurGrain(q, hh) : hh;
+}
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
@@ -1297,43 +1397,40 @@ void main() {
     float couvertureTuile = mix(1.0, dedans, estompeTuile);
     couvertureCrop = couvertureTuile;
 
     // ⚠️ LE discard RESTE, ET IL RESTE ICI. A estompage plein il economise tout
     // le corps du nuanceur sur les tuiles du dehors, exactement comme avant. En
     // cours de fondu il ne coupe plus rien : c'est le prix de dessiner la Terre
     // autour, et c'est le sujet meme de la tache.
     if (couvertureCrop <= 0.0) discard;
   }
 
-  float h = decodeMetersAA(vUv);
+  // ⚠️ L'APPEL EST hauteurFond, PAS LE CORPS : la MEME loi sert au gradient de
+  // la normale fine, quatre fragments plus bas (Tache P10).
+  float h = hauteurFond(qCrop, decodeMetersAA(vUv));
 
   // ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
   //
   // ⚠️ AVANT L'HABILLAGE, ET POUR LA MEME RAISON QUE LE GRAIN EST AVANT LA RAMPE
   // (voir le bloc suivant) : ce qui change h doit passer avant tout ce qui LIT h
   // — la rampe, les courbes de niveau, et le test sousEau qui les commande.
   //
   // ⚠️ C'EST LA TRANSCRIPTION DE altitudeSonde (src/monde/fond-crop.js), PAS UNE
   // SECONDE LOI : la mer prend min(fond, 0), la terre garde la tuile. Le CPU
   // (posAt, hauteurSurface) et le GPU lisent le meme tableau par la meme
   // formule d'uv, et test/fond-crop.test.js confronte les deux ecritures.
   //
   // ⚠️ ET LA BORNE N'EST PAS DECORATIVE. Le champ ne couvre que uFondPortee
   // demi-cotes ; au-dela, une texture en ClampToEdge prolongerait sa derniere
   // ligne sur toute la planete estompee, sans qu'aucune erreur ne soit levee.
   // C'est le meme garde que echantillonnerFond, ecrit deux fois parce que le
-  // GPU ne sait pas rendre null.
-  if (uFondOn > 0.5 && uCropOn > 0.5
-      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0) {
-    float hFond = texture2D(uFondChamp, qCrop / (2.0 * uFondPortee) + 0.5).r * uFondMetres;
-    h = min(hFond, 0.0);
-  }
+  // GPU ne sait pas rendre null. Le corps est hauteurFond, ci-dessus.
 
   // ══════ L'HABILLAGE, POSTES ③ ET ② — Tache C ═══════════════════════════════
   //
   // ⚠️ AVANT LA RAMPE ET AVANT LES COURBES, ET CE N'EST PAS UN RANGEMENT : le
   // grain modifie h, donc la rampe ET les courbes doivent le voir. C'est ce que
   // fait le socle, qui cuit son grain dans la GEOMETRIE : sa couleur et ses
   // courbes le portent parce qu'elles lisent vWorldPos.y. Pose apres, le grain
   // ne serait qu'un bruit de teinte, et les courbes resteraient lisses.
   float landness = 1.0;
   // ══════ h == 0 NE PREND PLUS LA BRANCHE TERRE — Tache K bis ══════════════
@@ -1355,26 +1452,21 @@ void main() {
   if (uHabOn > 0.5) {
     // ③ LE GRAIN. ⚠️ INDEXE SUR LE CROP, JAMAIS SUR vUv NI SUR L'ECRAN. vUv est
     // local a la TUILE : lu la, le grain se repeterait a chaque tuile — seize
     // grains au lieu d'un. Et evalue en coordonnees d'ecran il resterait COLLE
     // A L'ECRAN pendant que le relief defile, le moirage qu'Adrien a attrape a
     // l'oeil (terrain.js, etude 5.4).
     //
     // ⚠️ ET IL NE MORD QUE SUR LA TERRE (h > 0), comme le landFactor du socle :
     // sans cela le fond marin se couvrirait d'une rugosite que la bathymetrie ne
     // porte pas, et les courbes bathymetriques se mettraient a onduler.
-    if (uGrainForceM > 0.0 && h > 0.0) {
-      vec2 gp = qCrop * uGrainEchelle;
-      float g1 = mnNoise(gp);
-      float g2 = mnNoise(gp * 2.17 + vec2(19.3, -7.1));
-      h += uGrainForceM * ((g1 - 0.5) * 2.0 + (g2 - 0.5) * 0.7);
-    }
+    h = hauteurGrain(qCrop, h);
     // ② LE MASQUE DE COTE. La lecture tombe au MEME TEXEL que celle du socle —
     // la demonstration est en tete de src/monde/habillage-crop.js, et
     // test/crop-habillage.test.js la rejoue contre latLonToWorld du depot.
     //
     // ⚠️ LE MASQUE DECIDE, LA HAUTEUR NE FAIT QUE L'EMPECHER DE MENTIR. C'est le
     // correctif v42 de terrain.js : la rampe ocean se peignait sur des montagnes
     // quand le masque etait faux. Et uMargeCoteM est le 0,02 UNITE du socle
     // CONVERTI en metres — le recopier tel quel aurait donne deux centimetres.
     if (uCoastMaskOn > 0.5) {
       vec2 cmUv = qCrop * 0.5 + 0.5;
@@ -1573,30 +1665,73 @@ void main() {
   // bloc de 3 x 3 tuiles, contre 594 434 au socle (releve). La texture de
   // hauteur, elle, fait 256 x 256 par tuile et le fragment la lit DEJA
   // (decodeMetersAA, quelques lignes plus haut) : la couleur voyait le relief
   // fin, la lumiere ne le voyait pas.
   //
   // ⚠️ h EST DEJA LE BON h : le fond marin (Tache J bis) et le grain (Tache C)
   // l'ont modifie au-dessus, et c'est la surface REELLE qu'on veut deriver.
   //
   // ⚠️ ET LA BASE EST LA SPHERE NUE, JAMAIS vNormalW : ce dernier PORTE deja la
   // pente de la grille, et le perturber par le gradient COMPLET de h compterait
-  // deux fois la composante grossiere. Le globe est « une sphere de rayon
-  // R_GLOBE = 100 centree a l'origine » (monde/frontiere-rendu.js), donc le
-  // centre de la planete en espace de vue est viewMatrix x (0, 0, 0, 1).
+  // deux fois la composante grossiere. vHautW EST cette sphere nue, posee par le
+  // nuanceur de sommets depuis l'attribut latlon.
+  //
+  // ⛔ ET LE GRADIENT EST PRIS EN ESPACE TEXTURE, PLUS EN ESPACE ECRAN — Tache
+  // P10. La loi de P9 lisait dFdx(h) / dFdy(h) : une difference finie sur le
+  // VOISIN D'ECRAN, donc sur un voisin qui CHANGE avec la parite du quad 2 x 2.
+  // Mesure du noteur (notation-03 §4, .banc/vues-notation-03/N3-mouvement) : un
+  // decalage de camera d'UN pixel laissait 10,872 octets de residu contre 0,030
+  // au socle, et 38,49 % des pixels de surface bougeaient de plus de 8 octets.
+  // Aux decalages PAIRS, qui conservent la parite, le residu retombait a 0,800.
   if (uNormaleFineOn > 0.5) {
-    vec3 nSphere = normalize(vVue - vec3(viewMatrix[3]));
-    nMonde = nMondeDepuisVue(
-      mat3(viewMatrix),
-      normaleFineCrop(dFdx(vVue), dFdy(vVue), nSphere,
-                      dFdx(h) * uUnitesParMetre, dFdy(h) * uUnitesParMetre)
-    );
+    // ⚠️ RE-ORTHONORMALISE : l'interpolation lineaire de deux vecteurs unitaires
+    // n'en rend pas un unitaire, et sur une tuile de bas niveau (z2 couvre 90
+    // degres) l'ecart n'est pas negligeable.
+    vec3 haut = normalize(vHautW);
+    vec3 est = vEstW - haut * dot(haut, vEstW);
+    est = normalize(est);
+    vec3 nord = cross(haut, est);
+
+    // ⚠️ LA MONNAIE, ET C'EST LE POINT OU CE CHANTIER A DEJA PAYE QUATRE FOIS.
+    // Une unite d'uv couvre 1 / 2^z de tour de Mercator, donc uUvParMonde x le
+    // tour de la sphere x cos(latitude) METRES DE SOL. Mercator est conforme :
+    // la meme longueur vaut pour u et pour v.
+    float cosLat = max(cos(radians(vLatLon.x)), 1e-4);
+    float metresParUv = ${TOUR_SPHERE_M} * uUvParMonde * cosLat;
+    float uniteParUv = metresParUv * ${UNITES_PAR_METRE_SOL};
+
+    // ⚠️ LE PAS NE VIENT D'AUCUNE DERIVEE D'ECRAN, SINON LA PARITE RENTRERAIT
+    // PAR LA FENETRE. mppEcran = vProfCam x uMppFacteur est la grandeur de la
+    // Tache K : les metres de sol par pixel, fonction de la seule DISTANCE.
+    // Sans elle (uMppFacteur = 0, la production), le pas retombe au texel.
+    float pasEmpreinte = uMppFacteur > 0.0
+      ? vProfCam * uMppFacteur / metresParUv
+      : 0.0;
+    float pas = max(1.0 / uTilePx, pasEmpreinte);
+
+    // ⚠️ ET qCrop SUIT L'UV, PARCE QUE hauteurEchant LIT LES DEUX. uv.x va vers
+    // l'EST (mercator x croissant) ; uv.y va vers le NORD, donc vers un mercator
+    // y DECROISSANT — c'est le « 1 - v » de _buildMesh. Le signe moins est ce
+    // retournement, et lui seul.
+    float qParUv = uUvParMonde / max(uCropDemi, 1e-9);
+    vec2 dqU = vec2(qParUv * pas, 0.0);
+    vec2 dqV = vec2(0.0, -qParUv * pas);
+    float dhU = hauteurEchant(vUv + vec2(pas, 0.0), qCrop + dqU)
+              - hauteurEchant(vUv - vec2(pas, 0.0), qCrop - dqU);
+    float dhV = hauteurEchant(vUv + vec2(0.0, pas), qCrop + dqV)
+              - hauteurEchant(vUv - vec2(0.0, pas), qCrop - dqV);
+
+    // la pente de sol : une denivelee en unites de scene par une distance en
+    // unites de scene. Le 2 x pas du denominateur est celui de la difference
+    // CENTREE, et uUnitesParMetre porte l'exageration -- pas uniteParUv.
+    float k = uUnitesParMetre / (2.0 * pas * uniteParUv);
+    nMonde = normaleParGradientSol(dhU * k, dhV * k, est, nord, haut);
   }
   float nduCrop = dot(nMonde, uHemiHaut);
   float partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0;
   vec3 fondCrop = uAlbedoBase * natGris(hNormRelief, max(nduCrop, 0.0));
   if (partBloc > 0.0) {
     col = mix(col, albedoCrop(col, uAlbedoBase, natGris(hNormRelief, max(nduCrop, 0.0)), uAlbedoTeinte), partBloc);
   }
 
   // ══════ LA COUCHE APPARENCE — Tache P3, le gabarit d'ouverture l'ALLUME ════
   //
@@ -2550,28 +2685,35 @@ export class Globe {
     // valent ce qu'ils valaient. `poserRampe` et `poserMer` ANCRENT ;
     // `majEchelleRampe` évalue la courbe et POSE. Personne d'autre n'écrit.
     this._echelleContinue = creerEchelleContinue(RAMPE_MONDE)
     this._cleFondPosee = ''
     this.rebuildRamp(params)
 
     // ⚠️ `uTilePx` EST PROPRE À LA TUILE, comme `uTex` : deux tuiles voisines
     // peuvent venir de deux sources de tailles différentes (voir `planTuile`).
     // Le mettre dans `this.uniforms`, partagé, aurait fait juger la minification
     // de toutes les tuiles sur la taille de la dernière chargée.
-    this._materialFor = (texture, tilePx = 256) =>
+    this._materialFor = (texture, tilePx = 256, uvParMonde = 1) =>
       new THREE.ShaderMaterial({
         vertexShader: VERT,
         fragmentShader: FRAG,
         uniforms: {
           ...this.uniforms,
           uTex: { value: texture },
           uTilePx: { value: tilePx },
+          // ⚠️ **PROPRE À LA TUILE POUR LA MÊME RAISON QUE `uTilePx`** : c'est
+          // `1 / 2^z`, la fraction du monde Mercator qu'une unité d'`uv` couvre.
+          // Partagée, elle ferait juger la pente de toutes les tuiles sur le
+          // niveau de la dernière chargée. **Le défaut `1` est le niveau ZÉRO** :
+          // une tuile sans niveau déclaré rend une pente 4 096 fois trop faible,
+          // donc un bloc PLAT — visible, pas silencieux.
+          uUvParMonde: { value: uvParMonde },
         },
         // LE MÉLANGE SUIT LE CROP — Tâche B, Étape 5. ⚠️ **PAS TOUJOURS VRAI, ET
         // C'EST LA PRODUCTION QU'ON PROTÈGE** : `transparent` fait passer l'objet
         // dans la liste TRIÉE du moteur, derrière les opaques. Sans crop, la
         // couverture vaut 1 partout et le mélange ne servirait qu'à changer
         // l'ordre de dessin de 750 tuiles pour rien.
         transparent: !!this._crop,
         // ⚠️ **ET LA PROFONDEUR RESTE ÉCRITE.** C'est ce qui rend le régime
         // transparent indolore ici : à l'intérieur du crop l'alpha vaut
         // exactement 1, donc le mélange est l'identité, et le tri arrière-avant
@@ -5471,21 +5613,24 @@ export class Globe {
     geo.computeBoundingSphere()
     // ⚠️ **DE QUOI RETAILLER LA JUPE PLUS TARD — Tâche P7, ET L'ORDRE L'EXIGE.**
     // Le fond du bloc n'existe qu'une fois les parois posées, et les parois
     // exigent des tuiles bâties : quand `_buildMesh` tourne pour le premier
     // bloc, `_baseYCrop` est encore nul. Borner ICI ne toucherait donc que les
     // tuiles arrivées APRÈS, et le bloc d'ouverture garderait ses langues. On
     // garde de quoi RECALCULER la jupe depuis son anneau de bord — jamais depuis
     // sa position courante, pour que `_retaillerJupe` soit idempotente.
     geo.userData.jupe = { nV, bord: border, rabattement: skirtDrop }
 
-    const mesh = new THREE.Mesh(geo, this._materialFor(t.texture, t.size))
+    // ⚠️ **`2 ** -t.z` ET PAS `1 / (1 << t.z)`** : `t.z` monte à 22 dans les vues
+    // de surface, et un décalage d'entier 32 bits y serait encore juste — mais
+    // il déborderait à 31, sans un mot. La puissance flottante n'a pas de bord.
+    const mesh = new THREE.Mesh(geo, this._materialFor(t.texture, t.size, 2 ** -t.z))
     mesh.position.copy(origine) // la position mondiale vit ICI, plus dans les sommets
     mesh.visible = false
     mesh.name = t.key
     t.mesh = mesh
     this.group.add(mesh)
     // le bloc est peut-être DÉJÀ là (déplacement de fenêtre, tuile de remplacement)
     this._retaillerJupe(t)
 
     // ⚠️ LES HAUTEURS SONT RELÂCHÉES ICI, ET C'EST LEUR DERNIER LECTEUR (plan
     // « globe continu », Tâche 4 sexies, Étape 1). `t.heights` est un
diff --git a/src/monde/eclairage-crop.js b/src/monde/eclairage-crop.js
index 6216000..01c16e2 100644
--- a/src/monde/eclairage-crop.js
+++ b/src/monde/eclairage-crop.js
@@ -251,50 +251,77 @@ export function eclairerCrop({ mapCol, base, teinte, hn, ndu, ndl, soleil, ciel,
 //   · socle — `latLonToWorld` (`geo.js`) : `x` croît avec la LONGITUDE (est) et
 //     `z` croît avec la coordonnée de tuile `y`, c'est-à-dire vers le SUD. Le
 //     nord est donc `−z`, le haut `+y`.
 //   · globe — `latLonToSphere` (`geo.js`) :
 //     `p = R (cos φ sin λ, sin φ, cos φ cos λ)`, d'où par dérivation
 //     `est = (cos λ, 0, −sin λ)` et `nord = (−sin φ sin λ, cos φ, −sin φ cos λ)`.
 //   · le soleil, `placeSun` (`main.js`) :
 //     `(cos az cos el, sin el, sin az cos el)` — sa composante `z` est donc
 //     dirigée vers le SUD, et sa composante nord vaut `−sin az cos el`.
 
-/** La verticale locale du crop, dans le repère du globe. */
-export function hautLocal(latDeg, lonDeg) {
+/**
+ * Le repère de sol en un point de la sphère : est, nord, haut.
+ *
+ * ⚠️ **UNE SEULE ÉCRITURE DES TROIS VECTEURS, ET C'EST LA TÂCHE P10 QUI L'A
+ * IMPOSÉE.** Ils étaient écrits DEUX fois dans ce fichier — `hautLocal` et le
+ * corps de `directionSoleilLocale` — et la normale par fragment en aurait
+ * demandé une troisième, en GLSL. « Deux écritures jumelles finiraient par
+ * diverger » (`terrain.js`) : les deux appellent désormais celle-ci, et le
+ * jumeau GLSL est `GLSL_REPERE_SOL`, INJECTÉ dans le nuanceur de sommets.
+ *
+ * ⚡ **ET LE TRIÈDRE EST DIRECT** : `est × nord = haut`, donc
+ * `haut × est = nord` — c'est ce qui permet au nuanceur de fragment de
+ * n'interpoler que DEUX varyings et de retrouver le troisième par un produit
+ * vectoriel.
+ *
+ * @param {number} latDeg latitude en degrés
+ * @param {number} lonDeg longitude en degrés
+ * @returns {{est:number[], nord:number[], haut:number[]}}
+ */
+export function repereSolSphere(latDeg, lonDeg) {
   const la = latDeg * D2R
   const lo = lonDeg * D2R
-  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
+  const cla = Math.cos(la)
+  const sla = Math.sin(la)
+  const clo = Math.cos(lo)
+  const slo = Math.sin(lo)
+  return {
+    est: [clo, 0, -slo],
+    nord: [-sla * slo, cla, -sla * clo],
+    haut: [cla * slo, sla, cla * clo],
+  }
+}
+
+/** La verticale locale du crop, dans le repère du globe. */
+export function hautLocal(latDeg, lonDeg) {
+  return repereSolSphere(latDeg, lonDeg).haut
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
-  const la = latDeg * D2R
-  const lo = lonDeg * D2R
   const cEst = Math.cos(az) * Math.cos(el)
   const cHaut = Math.sin(el)
   const cNord = -Math.sin(az) * Math.cos(el)
-  const est = [Math.cos(lo), 0, -Math.sin(lo)]
-  const haut = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
-  const nord = [-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)]
+  const { est, nord, haut } = repereSolSphere(latDeg, lonDeg)
   const v = [
     est[0] * cEst + haut[0] * cHaut + nord[0] * cNord,
     est[1] * cEst + haut[1] * cHaut + nord[1] * cNord,
     est[2] * cEst + haut[2] * cHaut + nord[2] * cNord,
   ]
   const n = Math.hypot(v[0], v[1], v[2]) || 1
   return [v[0] / n, v[1] / n, v[2] / n]
 }
 
 /**
@@ -471,137 +498,178 @@ vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, flo
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
-// ══════════ LA LOI EST CELLE DE MIKKELSEN, ET `three` LA PORTE ══════════════
-//
-// `three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js`
-// (`perturbNormalArb`, d'après *Bump Mapping Unparametrized Surfaces on the
-// GPU*, Morten S. Mikkelsen). La dérivation, écrite ici parce qu'elle justifie
-// le seul point où l'on s'écarte de `three` :
-//
-//     S(x, y) = P(x, y) + N · h(x, y)
-//     dS/dx = sx + N·hx        dS/dy = sy + N·hy
-//     n = dS/dx × dS/dy = sx×sy − hx·R1 − hy·R2
-//         avec R1 = sy × N, R2 = N × sx, et sx×sy = det · N,
-//         det = sx · R1
-//
-// ⛔ **ET VOICI L'ÉCART, ASSUMÉ ET NÉCESSAIRE : `three` NORMALISE `sx` ET `sy`,
-// PAS NOUS.** Son commentaire le dit — *« normalize is done to ensure that the
-// bump map looks the same regardless of the texture's scale »* : c'est une
-// convention d'ARTISTE, qui rend la pente proportionnelle au dénivelé PAR PIXEL
-// D'ÉCRAN au lieu du dénivelé PAR MÈTRE DE SOL. Sous elle, la même montagne
-// s'aplatirait en s'éloignant et se creuserait en s'approchant. Le crop veut la
-// normale GÉOMÉTRIQUE, celle que `_buildMesh` calcule déjà par différences
-// centrées sur la surface déplacée — donc `sigma` non normalisé, et `h` dans la
-// même unité de longueur que `P`.
-//
-// ⚠️ **LE REPÈRE EST CELUI DE LA VUE, ET LA PRÉCISION L'EXIGE.** `VERT` explique
-// déjà pourquoi les sommets sont en RTC : *« ne pas payer l'ulp float32 à
-// magnitude 100 (0,486 m) »*. Une coordonnée MONDE de magnitude 100 a un ulp de
-// 0,38 m, quand `dFdx(P)` sur un pixel vaut ici quelques dizaines de mètres :
-// la dérivée serait bruitée de plusieurs pour cent. En espace de VUE, `P` est
-// relatif à la caméra — quelques unités — et la dérivée est nette.
-//
-// ⚠️ **LA NORMALE DE BASE EST CELLE DE LA SPHÈRE NUE, JAMAIS `vNormalW`.**
-// `vNormalW` PORTE DÉJÀ la pente du maillage : la perturber par le gradient
-// COMPLET de `h` compterait deux fois la composante grossière. La sphère est
-// centrée à l'origine du monde — `frontiere-rendu.js` l'écrit (*« une sphère de
-// rayon `R_GLOBE` = 100 centrée à l'origine »*) et le relevé le confirme
-// (`globe.group.matrixWorld` a une translation de **(0, 0, 0)**,
-// `.banc/P9/S6-normale-P9.json`) —, donc la normale de sphère en espace de vue
-// vaut `normalize(pVue − viewMatrix · (0, 0, 0, 1))`.
-//
-// ⚡ **CE QUE ÇA REND À L'ÉCRAN, MESURÉ AVANT D'ÊTRE ÉCRIT** (`.banc/P9/S6`,
-// rustine posée dans la page, témoin de compilation à **0 canal** éteinte) :
-// énergie de détail **10,966 → 15,733** contre **16,069** au socle, soit
-// **68,2 % → 97,9 %** ; et la part de la lumière dans le modelé du crop passe de
-// **6,6 % à 20,0 %**.
+// ══════════ ⛔ ET CETTE LOI-LÀ A ÉTÉ RETIRÉE — Tâche P10 ════════════════════
+//
+// **P9 a livré la loi de Mikkelsen** (`three`,
+// `bumpmap_pars_fragment.glsl.js`), qui reconstruit la normale depuis les
+// **dérivées d'écran** `dFdx`/`dFdy` de la hauteur. Elle a fermé le poste au
+// repos — **68,3 % → 98,02 %** de l'énergie de détail du socle — et **P9 a
+// déclaré n'avoir rien mesuré en mouvement** (sa réserve n° 4).
+//
+// ⛔ **LE NOTEUR L'A MESURÉ, ET LE PRIX ÉTAIT LOURD** (`notation-03.md` §4 ;
+// données brutes `.banc/vues-notation-03/N3-mouvement-N03.json`). Le protocole
+// n'a besoin ni d'horloge ni de parallaxe : on décale la caméra d'un nombre
+// **entier de pixels** (`setViewOffset`), donc l'image rendue DOIT être l'image
+// de départ translatée d'autant. Ce qui reste après recalage est le
+// scintillement. Résidu moyen, en octets de luminance, cadrage intérieur :
+//
+// | décalage | socle | crop, normale fine ON | crop OFF |
+// |---|---|---|---|
+// | **1 px** | **0,030** | ⛔ **10,872** | 0,863 |
+// | 2 px | 0,001 | **0,800** | 0,834 |
+// | **3 px** | **0,030** | ⛔ **10,856** | 0,865 |
+//
+// ⚡ **ÉNORME AUX DÉCALAGES IMPAIRS, NUL AUX PAIRS : LA SIGNATURE NOMME LA
+// CAUSE.** Un décalage PAIR conserve la parité des quads 2 × 2 sur lesquels le
+// GPU évalue `dFdx`/`dFdy` ; un décalage IMPAIR la retourne, et la différence
+// finie change de voisin. **38,49 % des pixels de surface bougeaient de plus de
+// 8 octets pour UN SEUL pixel de caméra — 360 fois le socle.**
+//
+// ⚠️ **CE DÉFAUT NE SE RÈGLE PAS, IL CHANGE DE LOI.** Baisser le gain ne ferait
+// que réduire l'amplitude d'un défaut STRUCTUREL : tant que le gradient est une
+// différence finie prise sur le voisin d'ÉCRAN, il dépend de QUEL voisin, donc
+// de la parité. **La sortie est de prendre le gradient là où la donnée vit :
+// dans la texture de hauteur.**
+//
+// ══════════ LA LOI LIVRÉE — LE GRADIENT EN ESPACE TEXTURE ═══════════════════
+//
+// La surface du crop est un **champ de hauteur posé sur la sphère** : en un
+// point, le sol a un repère orthonormé (est, nord, haut) et le relief monte le
+// long de `haut`. La normale d'un tel champ est la définition même, sans une
+// ligne de Mikkelsen :
+//
+//     N = normalize( haut − gEst · est − gNord · nord )
+//
+// où `gEst` et `gNord` sont les pentes **au sol**, c'est-à-dire les dérivées de
+// la hauteur par unité de DISTANCE, les deux dans la même unité de longueur.
+// Le sol monte vers l'est ⇒ la normale se penche vers l'ouest : le signe est
+// lisible à l'œil, ce que la forme de Mikkelsen ne permettait pas.
+//
+// ⚡ **ET C'EST LA MÊME LOI, PAS UNE APPROXIMATION.** La formule de Mikkelsen
+// est invariante par changement de paramétrage — `test/crop-eclairage.test.js`
+// ⑧b l'assertait déjà pour l'échelle. Nourrie du paramétrage (est, nord), qui
+// est ORTHONORMÉ, elle donne `R1 = nord × haut = est`, `R2 = haut × est = nord`
+// et `det = est · est = 1` : elle **SE RÉDUIT** à l'expression ci-dessus.
+// ⚡ **Le test ⑧a le rejoue terme à terme contre l'écriture de P9**, qui survit
+// dans le seul fichier de test, comme oracle.
+//
+// ⚠️ **CE QU'ON GAGNE EN INVARIANCE, ET C'EST TOUT LE POINT.** Les trois
+// vecteurs du repère viennent de `latlon` — un ATTRIBUT de sommet, donc une
+// fonction exacte de la position, jamais du voisin d'écran. Les deux pentes
+// viennent de quatre `texture2D` aux voisins en espace UV, à un pas qui ne
+// dépend que de `vProfCam` (un varying) et d'uniformes. ⚡ **Aucune dérivée
+// d'écran n'entre plus dans la normale : un décalage entier de caméra rend la
+// même image, translatée.**
+//
+// ⚠️ **ET LA PRÉCISION N'EST PLUS UN SUJET.** P9 devait travailler en espace de
+// VUE parce que `dFdx(P)` sur une coordonnée monde de magnitude 100 se noyait
+// dans l'ulp float32 (0,38 m). Ici les trois vecteurs sont **unitaires** et la
+// hauteur est lue en MÈTRES : il n'y a plus de grande magnitude à différencier,
+// et le varying `vVue` de P9 disparaît avec la loi qu'il servait.
+//
+// ══════════ LE PAS DES QUATRE LECTURES, ET POURQUOI IL N'EST PAS UN TEXEL ═══
+//
+// ⚠️ **UN PAS D'UN TEXEL EST LA RÉPONSE ÉVIDENTE ET ELLE EST INCOMPLÈTE.** La
+// texture de hauteur d'une tuile fait 256 (ou 512) texels ; au cadrage de la
+// notation, le bloc en montre **plus d'un par pixel d'écran** — la texture est
+// MINIFIÉE. Une différence centrée à un texel échantillonnerait donc plus fin
+// que ce que l'écran peut porter, et nourrirait le crénelage que la notation
+// reproche DÉJÀ au crop au repos (`notation-03.md` §3 ①).
+//
+// ➡️ **Le pas est donc le plus grand des deux : un texel, ou la demi-empreinte
+// du pixel** — de sorte que la différence centrée couvre une empreinte
+// complète, exactement la bande que `dFdx(h)` couvrait. C'est ce qui laisse
+// l'ÉNERGIE de relief là où P9 l'a mise tout en retirant la parité.
+//
+// ⚡ **ET L'EMPREINTE SE LIT SANS UNE SEULE DÉRIVÉE D'ÉCRAN** : la Tâche K a
+// posé `uMppFacteur`, les mètres de sol par pixel PAR UNITÉ DE DISTANCE CAMÉRA,
+// et `vProfCam` porte la distance. `mppEcran = vProfCam × uMppFacteur` est donc
+// une fonction de la POSITION — c'est justement pourquoi la Tâche K l'a écrite
+// (« ni du niveau de la tuile, ni de l'inclinaison de la caméra »). ⚠️ **Et
+// quand elle n'est pas posée (`uMppFacteur = 0`, la production), le pas retombe
+// au texel : jamais sur `fwidth`, qui ramènerait la parité par la fenêtre.**
 
 /**
- * La normale d'une surface déplacée en hauteur, au point où l'on est.
+ * La normale d'un champ de hauteur posé sur un plan tangent.
  *
  * ⚠️ **VECTEURS EN TABLEAUX DE TROIS, ET PAS DE `three`** : ce module est PUR
  * (voir l'en-tête), et `test/crop-eclairage.test.js` le rejoue sous node contre
- * un ORACLE INDÉPENDANT — la surface déplacée y est construite point par point
- * et sa normale prise par un vrai produit vectoriel.
+ * un ORACLE INDÉPENDANT — la surface est construite point par point et sa
+ * normale prise par un vrai produit vectoriel — PUIS contre la loi de Mikkelsen
+ * de P9, qui survit dans le test comme second oracle.
  *
- * ⚡ **CE QU'ELLE DÉCRIT EXACTEMENT, ET IL FAUT LE DIRE : LE PLAN DE `n`,
- * DÉPLACÉ DE `h`.** La formule ne rend PAS la normale de la surface engendrée
- * par `sx` et `sy` : elle remplace `sx × sy` par `det · n`, c'est-à-dire qu'elle
- * perturbe **la normale qu'on lui DONNE**. C'est précisément ce qu'on veut ici —
- * `n` est la normale de la SPHÈRE NUE, et `h` porte tout le relief ; les
- * tangentes ne servent qu'à mesurer la distance au sol par pixel. Perturber
- * `vNormalW` à la place compterait deux fois la pente du maillage.
+ * ⚠️ **LES DEUX PENTES SONT SANS DIMENSION** : `gEst` est la montée de la
+ * surface par unité de distance vers l'est, dans la MÊME unité de longueur des
+ * deux côtés. C'est l'appelant qui convertit — et c'est là que vit la faute de
+ * MONNAIE que ce chantier a payée quatre fois.
  *
- * ⛔ **ET UNE PROJECTION DES TANGENTES SUR LE PLAN DE `n` NE CHANGERAIT RIEN —
- * C'EST UNE SURVIVANTE DE MUTATION QUI L'A PROUVÉ, ET LA VERSION D'AVANT DE CE
- * COMMENTAIRE ÉTAIT FAUSSE.** L'algèbre : `(sy − n(sy·n)) × n = sy × n` (le
- * terme retiré est colinéaire à `n`), donc `R1` et `R2` sont inchangés ; et
- * `det = (sx − n(sx·n)) · R1 = sx · R1` puisque `R1 ⟂ n`. **Trois lignes de code
- * mort, retirées** — le dixième code mort de ce chantier trouvé par une
- * survivante. L'invariance est désormais une ASSERTION (⑧a), pas une croyance.
+ * ⚠️ **LE CAS DÉGÉNÉRÉ REND `haut`**, jamais un vecteur nul : `normalize(0)`
+ * plus loin rendrait NaN, et un NaN dans une normale peint un trou noir.
  *
- * @param {number[]} sx la tangente d'écran en x, dans l'unité de `P`
- * @param {number[]} sy la tangente d'écran en y
- * @param {number[]} n la normale de la surface de BASE (normalisée)
- * @param {number} dhx la dérivée d'écran de `h` en x, dans la MÊME unité que `P`
- * @param {number} dhy la dérivée d'écran de `h` en y
+ * @param {number} gEst pente au sol vers l'est
+ * @param {number} gNord pente au sol vers le nord
+ * @param {number[]} est vecteur unitaire vers l'est
+ * @param {number[]} nord vecteur unitaire vers le nord
+ * @param {number[]} haut vecteur unitaire vers le haut (la sphère nue)
  * @returns {number[]} la normale perturbée, normalisée
  */
-export function normaleParDeplacement(sx, sy, n, dhx, dhy) {
-  const croix = (a, b) => [
-    a[1] * b[2] - a[2] * b[1],
-    a[2] * b[0] - a[0] * b[2],
-    a[0] * b[1] - a[1] * b[0],
-  ]
-  const point = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
-  const r1 = croix(sy, n)
-  const r2 = croix(n, sx)
-  const det = point(sx, r1)
-  const s = det < 0 ? -1 : det > 0 ? 1 : 0
+export function normaleParGradientSol(gEst, gNord, est, nord, haut) {
   const v = [
-    Math.abs(det) * n[0] - s * (dhx * r1[0] + dhy * r2[0]),
-    Math.abs(det) * n[1] - s * (dhx * r1[1] + dhy * r2[1]),
-    Math.abs(det) * n[2] - s * (dhx * r1[2] + dhy * r2[2]),
+    haut[0] - gEst * est[0] - gNord * nord[0],
+    haut[1] - gEst * est[1] - gNord * nord[1],
+    haut[2] - gEst * est[2] - gNord * nord[2],
   ]
   const l = Math.hypot(v[0], v[1], v[2])
-  if (!(l > 0)) return [n[0], n[1], n[2]]
+  if (!(l > 0)) return [haut[0], haut[1], haut[2]]
   return [v[0] / l, v[1] / l, v[2] / l]
 }
 
 /**
- * Le texte GLSL de la même loi — INJECTÉ, jamais recopié.
+ * Le texte GLSL du repère de sol — INJECTÉ dans le nuanceur de SOMMETS.
  *
- * ⚠️ **`normaleFineCrop` REND SA NORMALE EN ESPACE DE VUE**, comme ses entrées.
- * L'appelant la ramène au monde par la transposée de `mat3(viewMatrix)` (une
- * rotation : sa transposée EST son inverse). GLSL ES 1.0 n'a pas `transpose()`,
- * d'où `nMondeDepuisVue`, écrit ici plutôt que sur place.
+ * ⚠️ **AU SOMMET ET PAS AU FRAGMENT, ET C'EST UNE ÉCONOMIE MESURABLE** :
+ * `latlon` est un ATTRIBUT, donc quatre `sin`/`cos` par SOMMET — 5 625 sur le
+ * bloc — au lieu de quatre par FRAGMENT, soit 144 631 au cadrage de la
+ * notation. Le fragment ré-orthonormalise ce qu'il reçoit : l'interpolation
+ * linéaire de deux vecteurs unitaires n'en rend pas un unitaire.
+ */
+export const GLSL_REPERE_SOL = /* glsl */ `
+// ═══ LE REPERE DE SOL — src/monde/eclairage-crop.js, Tache P10 ═════════════
+// La derivee de latLonToSphere (src/geo.js), pas une seconde convention :
+// P = R (cos la sin lo, sin la, cos la cos lo), est = dP/dlo, nord = dP/dla.
+// Triedre DIRECT : est x nord = haut, donc haut x est = nord.
+void repereSolSphere(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut) {
+  float la = radians(latDeg);
+  float lo = radians(lonDeg);
+  float cla = cos(la), sla = sin(la), clo = cos(lo), slo = sin(lo);
+  est = vec3(clo, 0.0, -slo);
+  nord = vec3(-sla * slo, cla, -sla * clo);
+  haut = vec3(cla * slo, sla, cla * clo);
+}
+`
+
+/**
+ * Le texte GLSL de la loi — INJECTÉ dans le nuanceur de FRAGMENTS, jamais
+ * recopié. ⚠️ **ELLE REND SA NORMALE DANS L'ESPACE DE SES ENTRÉES**, c'est-à-
+ * dire en espace MONDE : plus de transposée à écrire, plus d'aller-retour, et
+ * `nMondeDepuisVue` s'en va avec la loi de P9 qu'elle servait.
  */
 export const GLSL_NORMALE_FINE = /* glsl */ `
-// ═══ LA NORMALE PAR FRAGMENT — src/monde/eclairage-crop.js, Tache P9 ═══════
-// Loi de Mikkelsen, celle que porte three (bumpmap_pars_fragment.glsl.js),
-// SANS la normalisation de sigma : elle rendrait la pente proportionnelle au
-// denivele par PIXEL au lieu du denivele par METRE. Voir l'en-tete du module.
-vec3 normaleFineCrop(vec3 sx, vec3 sy, vec3 n, float dhx, float dhy) {
-  // ⚠️ ELLE PERTURBE LA NORMALE QU'ON LUI DONNE : n est la SPHERE NUE, les
-  // tangentes ne servent qu'a mesurer la distance au sol par pixel. Projeter
-  // sx et sy sur le plan de n ne changerait RIEN (voir le module).
-  vec3 r1 = cross(sy, n);
-  vec3 r2 = cross(n, sx);
-  float det = dot(sx, r1);
-  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
-  vec3 v = abs(det) * n - grad;
+// ═══ LA NORMALE PAR FRAGMENT — src/monde/eclairage-crop.js, Tache P10 ══════
+// Le champ de hauteur pose sur le plan tangent, sans une ligne de Mikkelsen :
+// on retranche a la verticale les deux pentes DE SOL. Le sol monte vers l'est,
+// la normale se penche vers l'ouest. Les pentes sont SANS DIMENSION : c'est
+// l'appelant qui convertit, et c'est la que vit la faute de monnaie.
+vec3 normaleParGradientSol(float gEst, float gNord, vec3 est, vec3 nord, vec3 haut) {
+  vec3 v = haut - gEst * est - gNord * nord;
   float l = length(v);
-  return l > 0.0 ? v / l : n;
-}
-// La transposee d'une rotation EST son inverse : (V^T u)_i = dot(colonne_i, u).
-vec3 nMondeDepuisVue(mat3 V, vec3 u) {
-  return normalize(vec3(dot(V[0], u), dot(V[1], u), dot(V[2], u)));
+  return l > 0.0 ? v / l : haut;
 }
 `
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
index b58f3a9..87f8d3e 100644
--- a/test/crop-eclairage.test.js
+++ b/test/crop-eclairage.test.js
@@ -43,25 +43,31 @@ import {
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
-  // ⚠️ **La normale par fragment — Tache P9.**
-  normaleParDeplacement,
+  // ⚠️ **La normale par fragment — Tache P9, RÉÉCRITE PAR P10.**
+  repereSolSphere,
+  normaleParGradientSol,
+  GLSL_REPERE_SOL,
   GLSL_NORMALE_FINE,
 } from '../src/monde/eclairage-crop.js'
 import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
+// ⚠️ **L'ORACLE DU REPÈRE DE SOL — Tâche P10.** `repereSolSphere` PRÉTEND être
+// la dérivée de `latLonToSphere` ; on la lui oppose plutôt que de croire son
+// commentaire. C'est la même discipline que ⑧c, qui lit `three`.
+import { latLonToSphere, tileToLatLon, R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'
 import { LUMA_709 } from '../src/monde/naturel-crop.js'
 import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
 import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
 // ⚠️ **Tache P6** : le morceau d irradiance DETACHE, pour les parois.
 import { GLSL_IRRADIANCE } from '../src/monde/eclairage-crop.js'
 
 // ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
 // appelle `document.createElement('canvas')` au constructeur. C'est le patron de
 // `test/loi-texture-monde.test.js` et de `test/damier-cadre.test.js`.
 globalThis.document = {
@@ -989,219 +995,462 @@ test('⑦c SANS donnée de paroi, la paroi retombe sur les tuiles — AU BIT PR
   // défaut MONDE — sans ça, l'égalité ci-dessus serait « zéro égale zéro ».
   assert.ok(u.uParoiCielIrr.value.x > 2, 'le repli porte une vraie irradiance')
   assert.notDeepEqual(u.uParoiCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
   // … et une ambiante de paroi NULLE n'est PAS le repli : un matériau dont
   // l'environnement a été retiré doit garder sa seule lampe hémisphérique.
   g.poserHabillage({ ...base, paroiAmbianteCoef: null, paroiAmbianteIntensite: 0 })
   assert.ok(u.uParoiCielIrr.value.x < u.uCielIrr.value.x, 'ambiante nulle, pas repli')
   assert.ok(u.uParoiCielIrr.value.x > 0.18, 'la lampe hemispherique reste')
 })
 
-// ══════════ ⑧ LA NORMALE PAR FRAGMENT — Tâche P9 ════════════════════════════
+// ══════════ ⑧ LA NORMALE PAR FRAGMENT — Tâche P9, RÉÉCRITE PAR P10 ══════════
+//
+// ⛔ **P9 AVAIT LIVRÉ LA LOI DE MIKKELSEN, ET ELLE A ÉTÉ RETIRÉE.** Elle
+// reconstruisait la normale depuis `dFdx(h)` / `dFdy(h)` — une différence finie
+// prise sur le VOISIN D'ÉCRAN, donc sur un voisin qui change avec la parité du
+// quad 2 × 2. Le noteur l'a mesuré (`notation-03.md` §4) : un décalage de caméra
+// d'UN pixel laissait **10,872 octets de résidu contre 0,030 au socle**, et
+// **38,49 % des pixels de surface** bougeaient de plus de 8 octets. Aux
+// décalages PAIRS, qui conservent la parité, le résidu retombait à **0,800**.
+//
+// La loi livrée par P10 est le champ de hauteur posé sur le plan tangent :
+// `N = normalize(haut − gEst·est − gNord·nord)`, avec un repère qui vient de
+// l'attribut `latlon` et deux pentes qui viennent de quatre lectures de texture.
 //
 // ⚠️ **CE QUE CE BLOC VÉRIFIE, ET DANS QUEL ORDRE** :
-//   ⑧a la loi PURE, contre un oracle INDÉPENDANT — la surface déplacée est
-//      construite point par point et sa normale obtenue par un vrai produit
-//      vectoriel de différences finies. Le jumeau JS n'est donc pas comparé à
-//      lui-même ;
-//   ⑧b l'INVARIANCE D'ÉCHELLE D'ÉCRAN, qui est la propriété pour laquelle on
-//      s'écarte de `three` — et le contre-exemple, la version de `three`, est
-//      rejoué à côté pour montrer qu'elle, elle ne l'a pas ;
-//   ⑧c la RÉFÉRENCE, LUE DANS `node_modules/three` : les quatre termes y sont,
-//      et le `normalize( dFdx( surf_pos` aussi. Notre écart est donc réel,
-//      nommé, et pas un oubli ;
-//   ⑧d la TRANSCRIPTION GLSL, terme à terme, sur le texte SANS SES COMMENTAIRES ;
-//   ⑧e le BRANCHEMENT dans le nuanceur — la faiblesse récurrente du chantier ;
+//   ⑧a la loi PURE, contre un oracle INDÉPENDANT — la surface est construite
+//      point par point et sa normale obtenue par un vrai produit vectoriel de
+//      différences finies. Le jumeau JS n'est donc pas comparé à lui-même ;
+//   ⑧b ⚡ **LA RÉDUCTION** : la loi livrée EST celle de Mikkelsen nourrie d'un
+//      repère orthonormé. L'écriture de P9 survit ici, comme SECOND oracle, et
+//      les deux doivent rendre le même vecteur au 1e−12 ;
+//   ⑧c la RÉFÉRENCE, LUE DANS `node_modules/three` : l'oracle de ⑧b est bien la
+//      formule de `three`, terme à terme, et pas notre souvenir d'elle ;
+//   ⑧d le REPÈRE DE SOL, contre `latLonToSphere` du dépôt, et la
+//      TRANSCRIPTION GLSL des deux lois, sur le texte SANS SES COMMENTAIRES ;
+//   ⑧e le BRANCHEMENT dans le nuanceur — la faiblesse récurrente du chantier —
+//      et ⚡ **l'absence de TOUTE dérivée d'écran dans le bloc**, qui est la
+//      seule chose que node puisse dire de l'invariance par translation ;
 //   ⑧f le BRANCHEMENT dans la chaîne : `poserHabillage`, `retirerHabillage`,
 //      `CHAMPS_HABILLAGE`, `contexteCrop` et `setExaggeration`.
 
 /** Le produit vectoriel et le produit scalaire, une fois pour tout ce bloc. */
 const CROIX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
 const NORME = (v) => Math.hypot(v[0], v[1], v[2])
 const UNITE = (v) => { const l = NORME(v); return [v[0] / l, v[1] / l, v[2] / l] }
+const POINT = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
 
 /**
- * L'ORACLE INDÉPENDANT — il ne connaît pas `normaleParDeplacement`.
- *
- * ⚠️ **CE QU'IL DÉCRIT, ET C'EST LE POINT DÉLICAT DE TOUT CE BLOC : LE PLAN DE
- * `n`, DÉPLACÉ DE `h` LE LONG DE `n`.** C'est la surface que le crop peint — la
- * sphère nue, plus le relief le long de son rayon — et c'est celle que la
- * formule de Mikkelsen rend, puisqu'elle perturbe la normale QU'ON LUI DONNE.
- * Les tangentes d'écran, elles, viennent de la surface DÉPLACÉE : leur
- * composante radiale n'est pas un déplacement au sol, on la retire.
- * ⚡ **Et c'est bien le même objet des deux côtés** : ⑧a assert plus bas que
- * `normaleParDeplacement` est INVARIANTE par cette projection, donc que la
- * retirer de la loi (ce qu'a fait la campagne de mutation) est un no-op.
+ * L'ORACLE INDÉPENDANT — il ne connaît pas `normaleParGradientSol`.
  *
- * On CONSTRUIT la surface en trois points et on prend le produit vectoriel des
- * deux différences finies. C'est la définition, pas la formule de Mikkelsen.
+ * On CONSTRUIT trois points de la surface — l'origine, un pas vers l'est, un pas
+ * vers le nord, chacun remonté de la hauteur que la pente y donne — et on prend
+ * le produit vectoriel des deux différences. C'est la DÉFINITION d'une normale,
+ * pas une formule.
  */
-function normaleOracle(sx, sy, n, dhx, dhy) {
-  // ⚠️ **LE DÉPLACEMENT SE FAIT DEPUIS LE PLAN DE `n`**, parce que c'est la
-  // surface qu'on décrit : la sphère nue, plus `h` le long de son rayon. Les
-  // tangentes d'écran portent déjà la pente du maillage ; leur composante
-  // radiale n'est pas un déplacement au sol.
-  const proj = (v) => { const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d] }
-  const tx = proj(sx)
-  const ty = proj(sy)
-  const a = [tx[0] + n[0] * dhx, tx[1] + n[1] * dhx, tx[2] + n[2] * dhx]
-  const b = [ty[0] + n[0] * dhy, ty[1] + n[1] * dhy, ty[2] + n[2] * dhy]
-  const c = CROIX(a, b)
-  // le produit vectoriel donne la normale au SIGNE de l'orientation près : on la
-  // remet du côté de la normale de base, comme le fait `sign(fDet)`.
-  const s = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= 0 ? 1 : -1
+function normaleOracle(gEst, gNord, est, nord, haut) {
+  const p = (a, b) => [
+    est[0] * a + nord[0] * b + haut[0] * (gEst * a + gNord * b),
+    est[1] * a + nord[1] * b + haut[1] * (gEst * a + gNord * b),
+    est[2] * a + nord[2] * b + haut[2] * (gEst * a + gNord * b),
+  ]
+  const c = CROIX(p(1, 0), p(0, 1))
+  const s = POINT(c, haut) >= 0 ? 1 : -1
   return UNITE([c[0] * s, c[1] * s, c[2] * s])
 }
 
-test('⑧a la normale par déplacement suit la DÉFINITION — oracle indépendant', () => {
-  // ① gradient nul : la normale ne bouge pas d'un bit.
-  assert.deepEqual(normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0, 0), [0, 1, 0])
-  // ② un cas à la main, vérifiable de tête : pente 1/2 vers l'est.
-  const n2 = normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0.5, 0)
+/**
+ * ⚡ **LE SECOND ORACLE : L'ÉCRITURE DE P9, MOT POUR MOT.**
+ *
+ * ⚠️ **ELLE NE VIT PLUS QUE DANS CE FICHIER, ET C'EST VOULU.** La loi de
+ * Mikkelsen a quitté `src/` avec la Tâche P10 — ⑧c prouve juste en dessous que
+ * cette transcription est bien celle de `three` — mais elle reste le meilleur
+ * témoin que la nouvelle loi n'a rien changé à la GÉOMÉTRIE : la nouvelle est
+ * l'ancienne, nourrie d'un paramétrage orthonormé.
+ */
+function normaleMikkelsen(sx, sy, n, dhx, dhy) {
+  const r1 = CROIX(sy, n)
+  const r2 = CROIX(n, sx)
+  const det = POINT(sx, r1)
+  const s = det < 0 ? -1 : det > 0 ? 1 : 0
+  const v = [
+    Math.abs(det) * n[0] - s * (dhx * r1[0] + dhy * r2[0]),
+    Math.abs(det) * n[1] - s * (dhx * r1[1] + dhy * r2[1]),
+    Math.abs(det) * n[2] - s * (dhx * r1[2] + dhy * r2[2]),
+  ]
+  const l = NORME(v)
+  if (!(l > 0)) return [n[0], n[1], n[2]]
+  return [v[0] / l, v[1] / l, v[2] / l]
+}
+
+/** Quelques repères de sol RÉELS, pris sur la sphère du globe. */
+const LIEUX = [
+  [-21.115, 55.536], // La Réunion, le cadrage intérieur de la notation
+  [-21.05, 55.25], // La Réunion, le cadrage côte
+  [0, 0], // le point origine — là où sin/cos sont dégénérés
+  [45.83, 6.865], // le Mont-Blanc
+  [-33.9, 151.2], // l'antipode de longitude
+  [78.2, -15.6], // haute latitude, longitude négative
+]
+
+test('⑧a la normale par gradient suit la DÉFINITION — oracle indépendant', () => {
+  const { est, nord, haut } = repereSolSphere(-21.115, 55.536)
+  // ① gradient nul : la normale EST la verticale, au bit près.
+  assert.deepEqual(normaleParGradientSol(0, 0, est, nord, haut), UNITE(haut))
+  // ② un cas à la main, vérifiable de tête : pente 1/2 vers l'est, repère canonique.
+  const n2 = normaleParGradientSol(0.5, 0, [1, 0, 0], [0, 0, -1], [0, 1, 0])
   const attendu = UNITE([-0.5, 1, 0])
   for (let i = 0; i < 3; i++) assert.ok(Math.abs(n2[i] - attendu[i]) < 1e-12, `${n2} contre ${attendu}`)
   // ⚠️ **ET LE SENS EST LE BON** : le sol MONTE vers l'est, donc la normale se
   // penche vers l'OUEST. Une mutation de signe passerait l'égalité de norme.
   assert.ok(n2[0] < 0, 'la normale se penche du mauvais cote')
-  // ③ ⚡ **LE BALAYAGE CONTRE L'ORACLE**, sur des repères et des pentes variés —
-  // y compris un repère NON orthogonal et une base inclinée, où une formule
-  // approchée « (−hx, 1, −hy) » tomberait.
-  const bases = [
-    { sx: [1, 0, 0], sy: [0, 0, 1], n: [0, 1, 0] },
-    { sx: [0.7, 0.1, 0], sy: [0.2, -0.05, 0.9], n: UNITE([0.2, 0.95, -0.1]) },
-    { sx: [3, -1, 2], sy: [-1, 0.5, 4], n: UNITE([1, 2, 3]) },
-    { sx: [0.001, 0, 0], sy: [0, 0, 0.001], n: [0, 1, 0] },
-  ]
+  // ③ ⚡ **LE BALAYAGE CONTRE L'ORACLE**, sur des repères de sol RÉELS et des
+  // pentes qui vont de la plaine à la falaise.
   let compares = 0
-  for (const b of bases) {
+  for (const [lat, lon] of LIEUX) {
+    const r = repereSolSphere(lat, lon)
     for (const t of balayage(11)) {
-      const dhx = (t - 0.5) * 0.9
-      const dhy = (0.5 - t) * 0.4
-      const a = normaleParDeplacement(b.sx, b.sy, b.n, dhx, dhy)
-      const o = normaleOracle(b.sx, b.sy, b.n, dhx, dhy)
+      const gE = (t - 0.5) * 4.2
+      const gN = (0.5 - t) * 1.7
+      const a = normaleParGradientSol(gE, gN, r.est, r.nord, r.haut)
+      const o = normaleOracle(gE, gN, r.est, r.nord, r.haut)
       for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - o[i]) < 1e-9, `${a} contre l'oracle ${o}`)
       compares++
     }
   }
-  assert.ok(compares >= 48, `banc vide : ${compares} comparaisons`)
-  // ④ ⛔ **L'INVARIANCE PAR PROJECTION, ET ELLE VIENT D'UNE SURVIVANTE DE
-  // MUTATION.** La loi portait trois lignes qui projetaient `sx` et `sy` sur le
-  // plan de `n` ; retirées, AUCUN test ne rougissait. L'algèbre dit pourquoi :
-  // `(sy − n(sy·n)) × n = sy × n`, et `det` ne voit pas la part radiale parce
-  // que `R1 ⟂ n`. Les trois lignes sont parties ; l'invariance reste, ASSERTÉE.
-  for (const b of bases) {
-    const proj = (v) => { const d = v[0] * b.n[0] + v[1] * b.n[1] + v[2] * b.n[2]; return [v[0] - b.n[0] * d, v[1] - b.n[1] * d, v[2] - b.n[2] * d] }
-    const a = normaleParDeplacement(b.sx, b.sy, b.n, 0.31, -0.12)
-    const c = normaleParDeplacement(proj(b.sx), proj(b.sy), b.n, 0.31, -0.12)
-    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - c[i]) < 1e-12, `la projection n'est plus un no-op : ${a} contre ${c}`)
+  assert.ok(compares >= 60, `banc vide : ${compares} comparaisons`)
+  // ④ ⛔ **LE CAS DÉGÉNÉRÉ, ET LA PREMIÈRE ÉCRITURE DE CE TEST ÉTAIT UNE
+  // TAUTOLOGIE — c'est une MUTATION SURVIVANTE qui l'a dit.** Elle appelait la
+  // loi avec `haut = [0, 0, 0]` : les DEUX branches rendent alors le même
+  // vecteur nul, donc « rendre `haut` » et « rendre zéro » étaient
+  // indistinguables. Le vrai dégénéré demande un repère où la soustraction
+  // s'annule — `est` COLINÉAIRE à `haut`, avec une pente de 1.
+  const versLeHaut = [0, 1, 0]
+  assert.deepEqual(normaleParGradientSol(1, 0, versLeHaut, [0, 0, 1], versLeHaut), versLeHaut,
+    'le degenere rend un vecteur nul : un NaN plus loin, donc un trou noir')
+  // ⚡ **ET VOICI POURQUOI LE NUANCEUR NE PEUT PAS Y TOMBER, PAR L'ALGÈBRE** :
+  // le repère qu'il passe est ORTHONORMÉ (il ré-orthonormalise juste avant),
+  // donc `|v|² = 1 + gEst² + gNord² ≥ 1`. La branche protège le CONTRAT de la
+  // fonction pure, pas le GPU — et le jumeau GLSL la garde pour ne pas
+  // diverger de son jumeau JS, ce qui coûterait plus cher qu'une comparaison.
+  const r0 = repereSolSphere(-21.115, 55.536)
+  for (const t of balayage(9)) {
+    const gE = (t - 0.5) * 6
+    const gN = (0.5 - t) * 3
+    const v = [
+      r0.haut[0] - gE * r0.est[0] - gN * r0.nord[0],
+      r0.haut[1] - gE * r0.est[1] - gN * r0.nord[1],
+      r0.haut[2] - gE * r0.est[2] - gN * r0.nord[2],
+    ]
+    assert.ok(Math.abs(NORME(v) ** 2 - (1 + gE * gE + gN * gN)) < 1e-9,
+      'l identite |v|2 = 1 + g2 tombe : le repere n est plus orthonorme')
   }
-  // ⑤ ⚠️ **LE CAS DÉGÉNÉRÉ, ET IL EST ATTEIGNABLE** : au pixel où les deux
-  // tangentes d'écran sont colinéaires (une silhouette), `det` vaut zéro et le
-  // gradient aussi — la loi doit rendre la normale de BASE, pas un vecteur nul
-  // que `normalize` ferait exploser en NaN plus loin.
-  const degenere = normaleParDeplacement([1, 0, 0], [2, 0, 0], [0, 1, 0], 0, 0)
-  assert.deepEqual(degenere, [0, 1, 0])
+  // ⑤ ⛔ **ET LES DEUX PENTES NE SONT PAS INTERCHANGEABLES.** Une mutation qui
+  // les échange fait tourner le gradient de quatre-vingt-dix degrés et éclaire
+  // les flancs perpendiculaires ; elle a survécu au premier tour de P9.
+  const r = repereSolSphere(-21.115, 55.536)
+  const droit = normaleParGradientSol(0.7, 0.2, r.est, r.nord, r.haut)
+  const echange = normaleParGradientSol(0.2, 0.7, r.est, r.nord, r.haut)
+  assert.ok(NORME([droit[0] - echange[0], droit[1] - echange[1], droit[2] - echange[2]]) > 0.05,
+    'echanger les deux pentes ne change rien : le test ne mord pas')
 })
 
-test('⑧b ⚡ L’INVARIANCE D’ÉCHELLE D’ÉCRAN — la raison de s’écarter de three', () => {
-  // La géométrie ne dépend pas du zoom : rendre le MÊME sol deux fois plus près
-  // double `dFdx(P)` ET `dFdx(h)`, et la normale doit être INCHANGÉE.
-  const sx = [0.7, 0.1, 0]
-  const sy = [0.2, -0.05, 0.9]
-  const n = UNITE([0.2, 0.95, -0.1])
-  const a = normaleParDeplacement(sx, sy, n, 0.13, -0.04)
-  for (const k of [0.25, 2, 17]) {
-    const b = normaleParDeplacement(sx.map((v) => v * k), sy.map((v) => v * k), n, 0.13 * k, -0.04 * k)
-    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-12, `k=${k} : ${b} contre ${a}`)
+test('⑧b ⚡ LA RÉDUCTION — la loi livrée EST celle de Mikkelsen, nourrie du repère', () => {
+  // ⚠️ **C'EST L'ASSERTION QUI AUTORISE P10 À RETIRER LA LOI DE P9.** Mikkelsen
+  // perturbe la normale qu'on lui donne à partir d'un paramétrage QUELCONQUE
+  // (`sx`, `sy`) et des dérivées de `h` DANS CE PARAMÉTRAGE. Nourrie de
+  // (est, nord) — orthonormé, donc `R1 = est`, `R2 = nord`, `det = 1` —, elle
+  // rend exactement `haut − gEst·est − gNord·nord`, normalisé.
+  let compares = 0
+  for (const [lat, lon] of LIEUX) {
+    const { est, nord, haut } = repereSolSphere(lat, lon)
+    for (const t of balayage(13)) {
+      const gE = (t - 0.5) * 3.1
+      const gN = (0.5 - t) * 2.6
+      const a = normaleParGradientSol(gE, gN, est, nord, haut)
+      const m = normaleMikkelsen(est, nord, haut, gE, gN)
+      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - m[i]) < 1e-12, `${a} contre Mikkelsen ${m}`)
+      compares++
+    }
   }
-  // ⛔ **ET LE CONTRE-EXEMPLE : LA VERSION DE `three`, REJOUÉE ICI, N'A PAS
-  // CETTE PROPRIÉTÉ.** C'est elle qui normalise `sigma` ; son commentaire dit
-  // pourquoi (« regardless of the texture's scale »), et c'est une convention
-  // d'ARTISTE. Sous elle, la même montagne s'aplatit en s'éloignant.
-  const troisJS = (sxx, syy, nn, dhx, dhy) => normaleParDeplacement(UNITE(sxx), UNITE(syy), nn, dhx, dhy)
-  const t1 = troisJS(sx, sy, n, 0.13, -0.04)
-  const t2 = troisJS(sx.map((v) => v * 2), sy.map((v) => v * 2), n, 0.13 * 2, -0.04 * 2)
-  assert.ok(Math.abs(t1[0] - t2[0]) > 0.02, 'la version de three serait invariante : le contre-exemple ne mord pas')
+  assert.ok(compares >= 60, `banc vide : ${compares} comparaisons`)
+  // ⛔ **ET CE N'EST PAS UNE ÉGALITÉ TRIVIALE** : nourrie d'un paramétrage NON
+  // orthonormé — celui des tangentes d'ÉCRAN, que P9 employait — la formule de
+  // Mikkelsen rend un AUTRE vecteur. C'est bien le repère qui fait la réduction,
+  // pas la formule.
+  const { est, nord, haut } = repereSolSphere(-21.115, 55.536)
+  const oblique = [est[0] * 2 + nord[0] * 0.6, est[1] * 2 + nord[1] * 0.6, est[2] * 2 + nord[2] * 0.6]
+  const autre = normaleMikkelsen(oblique, nord, haut, 0.4, -0.2)
+  const droit = normaleParGradientSol(0.4, -0.2, est, nord, haut)
+  assert.ok(NORME([autre[0] - droit[0], autre[1] - droit[1], autre[2] - droit[2]]) > 0.02,
+    'le contre-exemple ne mord pas : la reduction serait vraie pour n\'importe quoi')
 })
 
-test('⑧c la référence est LUE DANS node_modules/three, et l’écart est nommé', () => {
+test('⑧c l’oracle de ⑧b EST la formule de three, LUE DANS node_modules', () => {
   const bump = readFileSync(
     new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js', import.meta.url),
     'utf8'
   ).replace(/\s+/g, ' ')
-  // les quatre termes de Mikkelsen sont bien ceux-là, chez three
+  // les quatre termes de Mikkelsen sont bien ceux que `normaleMikkelsen` écrit
   assert.match(bump, /vec3 R1 = cross\( vSigmaY, vN \);/)
   assert.match(bump, /vec3 R2 = cross\( vN, vSigmaX \);/)
   assert.match(bump, /float fDet = dot\( vSigmaX, R1 \)/)
   assert.match(bump, /vec3 vGrad = sign\( fDet \) \* \( dHdxy\.x \* R1 \+ dHdxy\.y \* R2 \);/)
   assert.match(bump, /return normalize\( abs\( fDet \) \* surf_norm - vGrad \);/)
-  // ⚡ **ET L'ÉCART EST RÉEL** : c'est bien three qui normalise, et nous qui ne
-  // le faisons pas. Le jour où three cesse de normaliser, ce test rougit et le
-  // commentaire du module devient faux : il faudra le corriger.
+  // ⛔ **ET C'EST BIEN SUR DES DÉRIVÉES D'ÉCRAN QUE `three` LA NOURRIT** : c'est
+  // exactement ce que P10 a retiré, et ce que `three` continue de faire.
   assert.match(bump, /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);/)
-  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '')
-  assert.ok(!/normalize\s*\(\s*sx\s*\)/.test(nu) && !/normalize\s*\(\s*sy\s*\)/.test(nu),
-    'le crop normalise sigma : il reprend la convention d\'artiste de three, et la pente suivrait le zoom')
+  // ⛔ **ET PLUS AUCUNE LIGNE DE MIKKELSEN NE VIT DANS `src/`** : ni `cross`, ni
+  // `sign(det)`, ni `abs(det)`. Si elle y revient, c'est que quelqu'un a refait
+  // le chemin de P9 sans lire notation-03 §4.
+  const loi = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '')
+  assert.ok(!/sign\s*\(/.test(loi) && !/cross\s*\(/.test(loi),
+    'la loi livree porte encore la forme de Mikkelsen')
 })
 
-test('⑧d le GLSL est la TRANSCRIPTION du jumeau JS — terme à terme, sans commentaires', () => {
-  // ⚠️ **SANS SES COMMENTAIRES** : la Tâche K ter a trouvé une assertion verte
-  // parce qu'elle lisait une formule DANS UN COMMENTAIRE.
+test('⑧d le repère de sol EST la dérivée de latLonToSphere — et le GLSL est son jumeau', () => {
+  // ① ⚡ **CONTRE LE DÉPÔT, PAS CONTRE SON PROPRE COMMENTAIRE.** `haut` doit
+  // être `latLonToSphere` normalisé, et les deux tangentes ses dérivées, prises
+  // NUMÉRIQUEMENT sur la fonction du dépôt elle-même.
+  const eps = 1e-6
+  const pos = (la, lo) => { const v = latLonToSphere(la, lo, 1); return [v.x, v.y, v.z] }
+  for (const [lat, lon] of LIEUX) {
+    const { est, nord, haut } = repereSolSphere(lat, lon)
+    const p = pos(lat, lon)
+    for (let i = 0; i < 3; i++) assert.ok(Math.abs(haut[i] - p[i]) < 1e-12, `haut n'est pas latLonToSphere en ${lat},${lon}`)
+    const dE = UNITE(pos(lat, lon + eps).map((v, i) => v - pos(lat, lon - eps)[i]))
+    const dN = UNITE(pos(lat + eps, lon).map((v, i) => v - pos(lat - eps, lon)[i]))
+    for (let i = 0; i < 3; i++) {
+      assert.ok(Math.abs(est[i] - dE[i]) < 1e-6, `est n'est pas dP/dlon en ${lat},${lon}`)
+      assert.ok(Math.abs(nord[i] - dN[i]) < 1e-6, `nord n'est pas dP/dlat en ${lat},${lon}`)
+    }
+    // ② ⚡ **LE TRIÈDRE EST DIRECT** — c'est ce qui autorise le nuanceur de
+    // fragment à n'interpoler que DEUX varyings et à retrouver le nord par
+    // `cross(haut, est)`. Un trièdre indirect retournerait le nord, donc
+    // l'éclairage des versants nord-sud, sans qu'aucune erreur ne se lève.
+    const c = CROIX(est, nord)
+    for (let i = 0; i < 3; i++) assert.ok(Math.abs(c[i] - haut[i]) < 1e-12, `est x nord n'est pas haut en ${lat},${lon}`)
+    const cn = CROIX(haut, est)
+    for (let i = 0; i < 3; i++) assert.ok(Math.abs(cn[i] - nord[i]) < 1e-12, `haut x est n'est pas nord en ${lat},${lon}`)
+    // et il est ORTHONORMÉ
+    for (const v of [est, nord, haut]) assert.ok(Math.abs(NORME(v) - 1) < 1e-12)
+    assert.ok(Math.abs(POINT(est, nord)) < 1e-12 && Math.abs(POINT(est, haut)) < 1e-12 && Math.abs(POINT(nord, haut)) < 1e-12)
+  }
+  // ③ ⚠️ **ET LES DEUX AUTRES LECTEURS DU REPÈRE PASSENT PAR LUI** : les trois
+  // vecteurs étaient écrits DEUX fois dans le module avant P10.
+  for (const [lat, lon] of LIEUX) {
+    assert.deepEqual(hautLocal(lat, lon), repereSolSphere(lat, lon).haut)
+  }
+  const MOD_NU = readFileSync(new URL('../src/monde/eclairage-crop.js', import.meta.url), 'utf8')
+    .replace(/\/\/[^\n]*/g, '')
+    .replace(/\/\*[\s\S]*?\*\//g, '')
+    .replace(/\s+/g, ' ')
+  assert.match(MOD_NU, /export function hautLocal\(latDeg, lonDeg\) \{ return repereSolSphere\(latDeg, lonDeg\)\.haut \}/,
+    'hautLocal reecrit la verticale au lieu de la lire')
+  assert.match(MOD_NU, /const \{ est, nord, haut \} = repereSolSphere\(latDeg, lonDeg\)/,
+    'directionSoleilLocale reecrit le repere au lieu de le lire')
+  // ④ LA TRANSCRIPTION GLSL, terme à terme, SANS SES COMMENTAIRES.
+  const rep = GLSL_REPERE_SOL.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
+  assert.match(rep, /void repereSolSphere\(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut\) \{/)
+  assert.match(rep, /float la = radians\(latDeg\); float lo = radians\(lonDeg\);/)
+  assert.match(rep, /est = vec3\(clo, 0\.0, -slo\);/)
+  assert.match(rep, /nord = vec3\(-sla \* slo, cla, -sla \* clo\);/)
+  assert.match(rep, /haut = vec3\(cla \* slo, sla, cla \* clo\);/)
   const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
-  assert.match(nu, /vec3 normaleFineCrop\(vec3 sx, vec3 sy, vec3 n, float dhx, float dhy\) \{/)
-  assert.match(nu, /vec3 r1 = cross\(sy, n\);/)
-  assert.match(nu, /vec3 r2 = cross\(n, sx\);/)
-  assert.match(nu, /float det = dot\(sx, r1\);/)
-  // ⛔ **ET AUCUNE PROJECTION** : elle serait un no-op (⑧a l'assert), donc trois
-  // lignes de code mort dans un nuanceur exécuté par fragment.
-  assert.ok(!/dot\(sx, n\)/.test(nu), 'le GLSL projette : trois lignes mortes par fragment')
-  assert.match(nu, /vec3 grad = sign\(det\) \* \(dhx \* r1 \+ dhy \* r2\);/)
-  assert.match(nu, /vec3 v = abs\(det\) \* n - grad;/)
-  assert.match(nu, /return l > 0\.0 \? v \/ l : n;/)
-  // et la transposée, qui n'existe pas en GLSL ES 1.0
-  assert.match(nu, /vec3 nMondeDepuisVue\(mat3 V, vec3 u\) \{ return normalize\(vec3\(dot\(V\[0\], u\), dot\(V\[1\], u\), dot\(V\[2\], u\)\)\); \}/)
+  assert.match(nu, /vec3 normaleParGradientSol\(float gEst, float gNord, vec3 est, vec3 nord, vec3 haut\) \{/)
+  assert.match(nu, /vec3 v = haut - gEst \* est - gNord \* nord;/)
+  assert.match(nu, /float l = length\(v\);/)
+  assert.match(nu, /return l > 0\.0 \? v \/ l : haut;/)
   // ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
-  // ce texte. Ce que ce fichier peut faire, c'est garantir que le JS que ⑧a
-  // vérifie contre un oracle et le GLSL disent la MÊME chose ; l'écran, lui, est
-  // dans `.banc/P9/` et dans le compte rendu de la tâche.
+  // ce texte. Ce fichier garantit que le JS que ⑧a et ⑧b vérifient et le GLSL
+  // disent la MÊME chose ; l'écran, lui, est dans `.banc/P10/`.
 })
 
-test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, échelle, varying', () => {
-  const nu = FRAG_NU.replace(/\s+/g, ' ')
+// ⚡ **LE NUANCEUR CUIT, PAS LA SOURCE — Tâche P10.** `FRAG` est un template
+// literal : lu dans le fichier, il porte encore le nom des deux conversions. Le
+// matériau, lui, porte le TEXTE QUE LE GPU COMPILE, avec les nombres dedans — et
+// c'est le seul endroit où l'on peut vérifier que la monnaie injectée est la
+// bonne, et que l'injection a bien eu lieu.
+const MAT_CUIT = new Globe({ radius: 100, globeExaggeration: 18 })._materialFor(null, 256, 2 ** -12)
+const FRAG_CUIT = MAT_CUIT.fragmentShader.replace(/\/\/[^\n]*/g, '')
+const VERT_CUIT = MAT_CUIT.vertexShader.replace(/\/\/[^\n]*/g, '')
+
+test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, monnaie, pas, et AUCUNE dérivée', () => {
+  const nu = FRAG_CUIT.replace(/\s+/g, ' ')
   // ① la garde est un UNIFORME, déclaré, et le bloc est SOUS elle
-  assert.match(FRAG_NU, /uniform float uNormaleFineOn;/)
-  assert.match(FRAG_NU, /uniform float uUnitesParMetre;/)
-  assert.match(nu, /if \(uNormaleFineOn > 0\.5\) \{ vec3 nSphere/)
+  assert.match(FRAG_CUIT, /uniform float uNormaleFineOn;/)
+  assert.match(FRAG_CUIT, /uniform float uUnitesParMetre;/)
+  assert.match(FRAG_CUIT, /uniform float uUvParMonde;/)
+  assert.match(nu, /if \(uNormaleFineOn > 0\.5\) \{ vec3 haut = normalize\(vHautW\);/)
+  const bloc = nu.slice(nu.indexOf('if (uNormaleFineOn > 0.5)'), nu.indexOf('float nduCrop'))
   // ② ⛔ LA BASE EST LA SPHÈRE NUE, PAS `vNormalW` — c'est le point où un
   // implémenteur pressé compterait deux fois la pente du maillage.
-  assert.match(nu, /vec3 nSphere = normalize\(vVue - vec3\(viewMatrix\[3\]\)\);/)
-  const bloc = nu.slice(nu.indexOf('if (uNormaleFineOn > 0.5)'), nu.indexOf('float nduCrop'))
   assert.ok(!/vNormalW/.test(bloc), 'la normale fine part de vNormalW : la pente grossiere est comptee deux fois')
-  // ③ l'échelle est APPLIQUÉE aux DEUX dérivées, pas à une seule
-  assert.match(bloc, /dFdx\(h\) \* uUnitesParMetre, dFdy\(h\) \* uUnitesParMetre/)
-  // ⛔ **ET LES QUATRE ARGUMENTS SONT APPARIÉS DANS LE BON ORDRE — une mutation
-  // qui échange les deux TANGENTES a survécu au premier tour.** `dFdx(vVue)`
-  // doit aller avec `dFdx(h)` : appariés à l'envers, le gradient tourne de
-  // quatre-vingt-dix degrés et la lumière éclaire les flancs perpendiculaires.
-  assert.match(bloc, /normaleFineCrop\(dFdx\(vVue\), dFdy\(vVue\), nSphere, dFdx\(h\) \* uUnitesParMetre, dFdy\(h\) \* uUnitesParMetre\)/)
-  // ④ et c'est bien `h`, la hauteur du fragment APRÈS le fond marin et le grain
-  assert.ok(nu.indexOf('if (uNormaleFineOn > 0.5)') > nu.indexOf('h += uGrainForceM'),
-    'la normale fine est calculee AVANT le grain : elle deriverait une autre surface')
-  // ⑤ le varying existe des DEUX côtés
-  const VERT_SRC = GLOBE_SRC.slice(GLOBE_SRC.indexOf('const VERT ='), GLOBE_SRC.indexOf('const FRAG ='))
-  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /varying vec3 vVue;/)
-  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /vVue = mv\.xyz;/)
-  assert.match(FRAG_NU, /varying vec3 vVue;/)
-  // ⑥ et le texte de la loi est INJECTÉ, pas recopié
+  // ③ ⚡ **ET AUCUNE DÉRIVÉE D'ÉCRAN N'ENTRE DANS LE BLOC.** C'est TOUT ce que
+  // node peut dire de l'invariance par translation — et c'est exactement la
+  // régression que la Tâche P10 répare : `dFdx`, `dFdy` et `fwidth` y étaient.
+  assert.ok(!/\bdFdx\b|\bdFdy\b|\bfwidth\b/.test(bloc),
+    'une derivee d ecran est revenue dans la normale fine : la parite des quads avec')
+  // ④ ⛔ LA MONNAIE — les deux conversions, et elles sont APPARIÉES. `metresParUv`
+  // porte le cosinus de la latitude (Mercator rétrécit vers les pôles) et
+  // `uniteParUv` la ramène en unités de scène ; `uUnitesParMetre` porte
+  // l'exagération, `UNITES_PAR_METRE_SOL` ne la porte PAS. Les intervertir
+  // rendrait des pentes fausses d'un facteur `exagération²`, en silence.
+  assert.match(bloc, /float cosLat = max\(cos\(radians\(vLatLon\.x\)\), 1e-4\);/)
+  assert.match(bloc, /float metresParUv = [\d.]+ \* uUvParMonde \* cosLat;/)
+  assert.match(bloc, /float uniteParUv = metresParUv \* [\d.e-]+;/)
+  assert.match(bloc, /float k = uUnitesParMetre \/ \(2\.0 \* pas \* uniteParUv\);/)
+  assert.match(bloc, /normaleParGradientSol\(dhU \* k, dhV \* k, est, nord, haut\)/)
+  // ⑤ le PAS : le texel est un PLANCHER, l'empreinte l'emporte quand elle est
+  // plus grande, et sans `uMppFacteur` on retombe sur le texel — jamais sur
+  // `fwidth`, qui ramènerait la parité par la fenêtre.
+  assert.match(bloc, /float pasEmpreinte = uMppFacteur > 0\.0 \? vProfCam \* uMppFacteur \/ metresParUv : 0\.0;/)
+  assert.match(bloc, /float pas = max\(1\.0 \/ uTilePx, pasEmpreinte\);/)
+  // ⑥ ⛔ LE DÉCALAGE DE `qCrop` SUIT L'UV, ET LE SIGNE DU NORD EST RETOURNÉ.
+  // `uv.y` croît vers le NORD (`1 - v` dans `_buildMesh`) quand le `y` de
+  // Mercator croît vers le SUD. Le signe perdu, le fond marin serait lu de
+  // l'autre côté du bloc — invisible sur un fond plat, faux sur un talus.
+  // ⛔ **LE NORD DU FRAGMENT — UNE MUTATION SURVIVANTE.** `cross(est, haut)`
+  // rendrait le SUD, et l'éclairage des versants nord-sud s'inverserait. ⑧d
+  // prouve que le trièdre est direct ; ici on vérifie que le nuanceur s'en sert
+  // dans le bon ordre.
+  assert.match(bloc, /vec3 nord = cross\(haut, est\);/)
+  // ⛔ **ET LE DEMI-CÔTÉ DU CROP DIVISE, IL NE MULTIPLIE PAS — deuxième
+  // survivante.** `qCrop` est en demi-côtés : `q = (mercator − centre) /
+  // uCropDemi`. Le test exécutable de la loi est juste en dessous (⑧e ter).
+  assert.match(bloc, /float qParUv = uUvParMonde \/ max\(uCropDemi, 1e-9\);/)
+  assert.match(bloc, /vec2 dqU = vec2\(qParUv \* pas, 0\.0\);/)
+  assert.match(bloc, /vec2 dqV = vec2\(0\.0, -qParUv \* pas\);/)
+  // ⑦ les quatre lectures sont CENTRÉES : `+pas` contre `−pas`, sur les deux axes
+  assert.match(bloc, /float dhU = hauteurEchant\(vUv \+ vec2\(pas, 0\.0\), qCrop \+ dqU\) - hauteurEchant\(vUv - vec2\(pas, 0\.0\), qCrop - dqU\);/)
+  assert.match(bloc, /float dhV = hauteurEchant\(vUv \+ vec2\(0\.0, pas\), qCrop \+ dqV\) - hauteurEchant\(vUv - vec2\(0\.0, pas\), qCrop - dqV\);/)
+  // ⑧ ⚡ ET `hauteurEchant` EST LA MÊME LOI QUE `main()` — une seule écriture du
+  // fond marin et du grain. Un second `texture2D(uFondChamp` dans le fragment
+  // serait la « seconde écriture jumelle » que `terrain.js` documente.
+  assert.equal((FRAG_CUIT.match(/texture2D\(uFondChamp/g) || []).length, 1,
+    'le fond marin est lu par DEUX ecritures dans le nuanceur')
+  assert.equal((FRAG_CUIT.match(/mnNoise\(gp\)/g) || []).length, 1,
+    'le grain est ecrit DEUX fois dans le nuanceur')
+  assert.match(nu, /float hauteurEchant\(vec2 uv, vec2 q\) \{ float hh = hauteurFond\(q, decodeMeters\(uv\)\); return uHabOn > 0\.5 \? hauteurGrain\(q, hh\) : hh; \}/)
+  // et `main()` passe par les deux mêmes fonctions, dans l'ordre du dépôt
+  assert.match(nu, /float h = hauteurFond\(qCrop, decodeMetersAA\(vUv\)\);/)
+  assert.match(nu, /h = hauteurGrain\(qCrop, h\);/)
+  assert.ok(nu.indexOf('bool sousEau =') > nu.indexOf('float h = hauteurFond(qCrop'),
+    'sousEau est lu AVANT le fond marin')
+  assert.ok(nu.indexOf('bool sousEau =') < nu.indexOf('h = hauteurGrain(qCrop, h);'),
+    'le grain est applique AVANT sousEau : la rampe changerait de branche')
+  // ⑨ les deux varyings existent des DEUX côtés, et `vVue` est bien parti
+  assert.match(VERT_CUIT, /varying vec3 vEstW;/)
+  assert.match(VERT_CUIT, /varying vec3 vHautW;/)
+  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /repereSolSphere\(latlon\.x, latlon\.y, estL, nordL, hautL\);/)
+  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /vEstW = mat3\(modelMatrix\) \* estL; vHautW = mat3\(modelMatrix\) \* hautL;/)
+  // ⚠️ **ET LE REPÈRE EST BIEN ARRIVÉ DANS LE TEXTE COMPILÉ**, pas seulement
+  // dans la source : une injection oubliée ne se verrait qu'à l'écran.
+  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /void repereSolSphere\(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut\)/)
+  assert.match(FRAG_CUIT, /varying vec3 vEstW;/)
+  assert.match(FRAG_CUIT, /varying vec3 vHautW;/)
+  assert.ok(!/\bvVue\b/.test(GLOBE_NU), 'le varying vVue de P9 est reste : il ne sert plus personne')
+  // ⑩ et le texte des deux lois est INJECTÉ, pas recopié
+  assert.ok(GLOBE_NU.includes('${GLSL_REPERE_SOL}'), 'le globe recopie le repere au lieu de l\'injecter')
   assert.ok(GLOBE_NU.includes('${GLSL_NORMALE_FINE}'), 'le globe recopie la loi au lieu de l\'injecter')
-  assert.ok(!/vec3 normaleFineCrop\(vec3/.test(GLOBE_NU.replace('${GLSL_NORMALE_FINE}', '')),
-    'une SECONDE ecriture de normaleFineCrop vit dans globe.js')
+  const sansInjection = GLOBE_NU.replace('${GLSL_REPERE_SOL}', '').replace('${GLSL_NORMALE_FINE}', '')
+  assert.ok(!/vec3 normaleParGradientSol\(float/.test(sansInjection),
+    'une SECONDE ecriture de normaleParGradientSol vit dans globe.js')
+  assert.ok(!/void repereSolSphere\(float/.test(sansInjection),
+    'une SECONDE ecriture de repereSolSphere vit dans globe.js')
+})
+
+test('⑧e bis ⛔ `uUvParMonde` EST PROPRE À LA TUILE, ET IL VAUT `1 / 2^z`', () => {
+  // ⚠️ **C'EST LA MONNAIE DE LA PENTE, ET CE CHANTIER A DÉJÀ PAYÉ QUATRE FOIS
+  // CETTE FAMILLE DE FAUTES** (`uMerHoule` ×121,6, `skirtDrop` ×10). Une valeur
+  // partagée ferait juger toutes les tuiles sur le niveau de la dernière
+  // chargée — exactement le défaut que `uTilePx` documente à côté d'elle.
+  const g = new Globe({ radius: 100, globeExaggeration: 18 })
+  // ① le défaut est le niveau ZÉRO, donc un bloc PLAT : visible, pas silencieux.
+  assert.equal(g._materialFor(null, 256).uniforms.uUvParMonde.value, 1)
+  // ② et il n'est PAS dans `this.uniforms` : il ne s'étale pas
+  assert.equal(g.uniforms.uUvParMonde, undefined, 'uUvParMonde est partage par toutes les tuiles')
+  // ③ POSÉ, il suit le niveau — dans les DEUX sens, et sur toute la plage utile
+  for (const z of [0, 2, 6, 12, 15, 22]) {
+    assert.equal(g._materialFor(null, 256, 2 ** -z).uniforms.uUvParMonde.value, 2 ** -z)
+  }
+  // ④ ⚡ **ET C'EST BIEN `_buildMesh` QUI LE POSE**, avec le niveau de SA tuile.
+  assert.match(GLOBE_NU.replace(/\s+/g, ' '),
+    /this\._materialFor\(t\.texture, t\.size, 2 \*\* -t\.z\)/)
+  // ⑤ ⚠️ **LA CONVERSION EN MÈTRES DE SOL EST JUSTE, ET ELLE EST VÉRIFIABLE À LA
+  // MAIN** : une unité d'uv à z12, à la latitude de La Réunion, couvre la
+  // largeur d'une tuile — 9 129 m relevés par `_makeDemSampler` (P9 publie
+  // `extentMeters = 27 381` pour les TROIS tuiles du bloc).
+  const tour = Number(FRAG_CUIT.match(/float metresParUv = ([\d.]+) \* uUvParMonde/)[1])
+  const largeur = tour * 2 ** -12 * Math.cos((-21.115 * Math.PI) / 180)
+  assert.ok(Math.abs(largeur * 3 - 27381) < 400, `le bloc ferait ${largeur * 3} m au lieu de 27 381`)
+  // ⛔ **ET CE N'EST PAS `CIRCONFERENCE_M`** : la sphère du globe a le rayon
+  // MOYEN, celui que `uUnitesParMetre` emploie. Prendre l'équateur WGS84 ferait
+  // 0,11 % d'erreur — invisible, et faux.
+  assert.ok(Math.abs(tour - 2 * Math.PI * EARTH_RADIUS_M) < 1, `le tour vaut ${tour}`)
+  assert.ok(Math.abs(tour - 40075016.686) > 40000, 'le tour est celui de l\'equateur WGS84')
+  // ⑥ ⚡ **L'INVARIANT QUI APPARIE LES DEUX CONVERSIONS, ET C'EST UNE MUTATION
+  // SURVIVANTE QUI L'A DEMANDÉ.** Le tour est en MÈTRES, l'autre facteur est en
+  // unités de scène PAR mètre : leur produit est donc la circonférence de la
+  // sphère du globe EN UNITÉS DE SCÈNE, c'est-à-dire `2 π R_GLOBE`. Retourner
+  // l'un ou l'autre — la faute d'`uMerHoule`, quatre fois payée — fait exploser
+  // ce produit de neuf ordres de grandeur.
+  const unite = Number(FRAG_CUIT.match(/float uniteParUv = metresParUv \* ([\d.e+-]+);/)[1])
+  assert.ok(Math.abs(tour * unite - 2 * Math.PI * R_GLOBE) < 1e-6,
+    `le tour en unites de scene vaut ${tour * unite} au lieu de ${2 * Math.PI * R_GLOBE}`)
+})
+
+test('⑧e ter ⛔ LE DÉCALAGE DE `qCrop` SUIT VRAIMENT L’UV — exécuté, pas cherché', () => {
+  // ⚠️ **MUTATION SURVIVANTE** : `uUvParMonde * uCropDemi` au lieu de
+  // `/ uCropDemi`. Le fond marin serait alors lu à des demi-côtés de distance du
+  // point qu'on éclaire — invisible sur un fond plat, faux sur un talus.
+  //
+  // ⚠️ **ON N'ASSERTE PAS UNE CHAÎNE, ON REJOUE LA LOI** : `qCrop` est calculé
+  // par le nuanceur depuis `vLatLon`, qui vient de `tileToLatLon`. On refait le
+  // chemin sur la fonction DU DÉPÔT et on exige que la différence de `qCrop`
+  // entre deux points séparés de `pas` en `uv` soit exactement ce que le bloc
+  // pose — signe compris.
+  const bloc = FRAG_CUIT.replace(/\s+/g, ' ')
+  const bloc2 = bloc.slice(bloc.indexOf('if (uNormaleFineOn > 0.5)'), bloc.indexOf('float nduCrop'))
+  assert.match(bloc2, /float qParUv = uUvParMonde \/ max\(uCropDemi, 1e-9\);/)
+  // la transcription du nuanceur, ligne pour ligne (bloc « LA DÉCOUPE »)
+  const mx = (lon) => (lon + 180) / 360
+  const my = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * 0.017453292519943295) / 2)) / (2 * Math.PI)
+  const DEMI = 0.000366210937 // uCropDemi relevé : trois tuiles z12 en demi-côtés de Mercator
+  for (const z of [10, 12, 14]) {
+    const uvParMonde = 2 ** -z
+    const qParUv = uvParMonde / DEMI
+    // une tuile quelconque, loin du méridien et de l'équateur
+    const tx = Math.floor(2 ** z * mx(55.5))
+    const ty = Math.floor(2 ** z * 0.6)
+    for (const pas of [1 / 256, 1 / 64]) {
+      for (const [u, v] of [[0.25, 0.4], [0.6, 0.75], [0.5, 0.5]]) {
+        // uv.y = 1 − v (le « canvas row 0 = north » de `_buildMesh`)
+        const q = (uu, vv) => {
+          const p = tileToLatLon(tx + uu, ty + vv, z)
+          return { x: (mx(p.lon) - 0) / DEMI, y: (my(p.lat) - 0) / DEMI }
+        }
+        const a0 = q(u, 1 - 0.5)
+        // un pas de +`pas` en uv.x
+        const aU = q(u + pas, 1 - 0.5)
+        assert.ok(Math.abs(aU.x - a0.x - qParUv * pas) < 1e-9,
+          `z=${z} : dq/duv.x rend ${aU.x - a0.x} au lieu de ${qParUv * pas}`)
+        assert.ok(Math.abs(aU.y - a0.y) < 1e-12, 'un pas en uv.x bouge le q en y')
+        // un pas de +`pas` en uv.y, donc de −`pas` en v de tuile : le SIGNE
+        const aV = q(u, 1 - 0.5 - pas)
+        assert.ok(Math.abs(aV.y - a0.y + qParUv * pas) < 1e-6,
+          `z=${z} : dq/duv.y rend ${aV.y - a0.y} au lieu de ${-qParUv * pas}`)
+        assert.ok(aV.y - a0.y < 0, 'le retournement « 1 - v » est perdu : le nord part au sud')
+        assert.ok(v > 0, 'garde-fou de banc vide')
+      }
+    }
+  }
 })
 
 test('⑧f ⛔ LE BRANCHEMENT DANS LA CHAÎNE — pose, retrait, veille, contexte, échelle', () => {
   const g = new Globe({ radius: 100, globeExaggeration: 18 })
   const u = g.uniforms
   // ① le défaut est le dépôt au bit près
   assert.equal(u.uNormaleFineOn.value, 0)
   assert.equal(HABILLAGE_MONDE.normaleFine, false)
   // ② POSÉE, elle s'allume ; POSÉE À FAUX, elle s'éteint — les deux sens.
   g.poserHabillage({ normaleFine: true })
diff --git a/test/crop-parois.test.js b/test/crop-parois.test.js
index c81bfd0..856e121 100644
--- a/test/crop-parois.test.js
+++ b/test/crop-parois.test.js
@@ -467,21 +467,27 @@ test('les couleurs de sommet portent l occlusion, et elles sont SOMBRES au pied'
 // **Une assertion qui ne distingue rien coûte de la confiance sans en donner.**
 // Les huit qui suivent ont toutes été rejouées : **fausses avant, vraies
 // après**, et le banc les rejoue à la demande.
 //
 // ⚠️ **ET LE BLOC EST BORNÉ DES DEUX CÔTÉS.** L'ancienne tranche courait jusqu'à
 // la fin du fichier ; c'est elle qui laissait passer les `smoothstep` du reste
 // du nuanceur.
 
 const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
 const DEBUT_CROP = GLOBE_SRC.indexOf('if (uCropOn > 0.5) {')
-const FIN_CROP = GLOBE_SRC.indexOf('float h = decodeMetersAA', DEBUT_CROP)
+// ⚠️ **LA BORNE BASSE EST LA PREMIÈRE LIGNE D'APRÈS LE BLOC, ET ELLE A BOUGÉ
+// À LA TÂCHE P10** : `float h = decodeMetersAA(vUv);` est devenu
+// `float h = hauteurFond(qCrop, decodeMetersAA(vUv));`, parce que la loi du fond
+// marin est désormais une FONCTION — la normale par fragment la rappelle quatre
+// fois. Si cette ligne disparaît à son tour, `FIN_CROP` vaut −1 et la première
+// assertion du test le dit.
+const FIN_CROP = GLOBE_SRC.indexOf('float h = hauteurFond(', DEBUT_CROP)
 const BLOC = GLOBE_SRC.slice(DEBUT_CROP, FIN_CROP)
 
 test('le bloc de découpe est BORNÉ — sans quoi tout le reste du nuanceur y entre', () => {
   assert.ok(DEBUT_CROP > 0, 'la garde `if (uCropOn > 0.5) {` a disparu du nuanceur')
   assert.ok(FIN_CROP > DEBUT_CROP, 'la borne basse du bloc a disparu')
   // le témoin de ce qui rendait l'ancienne assertion inutile : hors du bloc, le
   // nuanceur porte d'autres `smoothstep` (contours, graticule, terminateur).
   const dehors = GLOBE_SRC.slice(FIN_CROP)
   assert.ok((dehors.match(/smoothstep/g) || []).length >= 2,
     'plus aucun `smoothstep` hors du bloc : le piège a disparu, ce commentaire est à revoir')
