92b8da6 tache K : la loi de texture quitte l espace-tuile

 package.json                   |   2 +-
 src/globe.js                   | 137 +++++++++++-
 src/main.js                    |  32 +++
 src/monde/loi-texture-monde.js | 194 ++++++++++++++++
 test/loi-texture-monde.test.js | 498 +++++++++++++++++++++++++++++++++++++++++
 5 files changed, 859 insertions(+), 4 deletions(-)

diff --git a/package.json b/package.json
index fa3146c..fe4d48f 100644
--- a/package.json
+++ b/package.json
@@ -11,21 +11,21 @@
     "build:places": "node scripts/build-places.mjs",
     "build:mapcells": "node scripts/build-map-cells.mjs",
     "build:watertiles": "node scripts/build-water-tiles.mjs",
     "build:laketiles": "node scripts/build-world-lake-tiles.mjs",
     "build:bathytiles": "node scripts/build-bathy-tiles.mjs",
     "build:sol": "node scripts/build-occupation-sol.mjs",
     "build:solmonde": "node scripts/build-occupation-sol.mjs --bbox -180,-60,180,84 --zmin 8 --zmax 9 --zone Monde --paralleles 32 --reprendre",
     "build:canopee": "node scripts/build-canopee.mjs",
     "build:canopeemonde": "node scripts/build-canopee.mjs --bbox -180,-60,180,84 --zmin 8 --zmax 9 --zone Monde --paralleles 32 --reprendre",
     "build:geofr": "node scripts/fetch-geo-fr.mjs",
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js",
     "build:emodnet": "node scripts/fetch-emodnet.mjs",
     "build:bathyindex": "node scripts/build-bathy-index.mjs",
     "verifie:dist": "node scripts/verifie-dist.mjs",
     "deploy": "node scripts/garde-deploiement.mjs && npm run build:mapcells && npm run carte && npm run nettoie:dist && npx vite build && npm run verifie:dist && netlify deploy --prod --dir dist --site 74e18fe8-c86f-47ad-9807-479cd59f1d8c",
     "cuire:fixtures-relief": "node scripts/cuire-fixtures-relief.mjs",
     "controle:pdf": "node --max-old-space-size=4096 scripts/controle-pdf-affiche.mjs",
     "inspecte:pdf": "node --max-old-space-size=6144 scripts/inspecte-pdf-affiche.mjs",
     "build:volcans": "node scripts/build-volcans.mjs",
     "carte": "node scripts/carte-ecosysteme.mjs",
     "nettoie:dist": "node scripts/nettoie-dist.mjs",
diff --git a/src/globe.js b/src/globe.js
index 0cdc7e7..cf98926 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -65,20 +65,21 @@ import {
 // 2026-08-21 : `params.fov = 33`, `camera.fov = 33`, `camGlobe.fov = 33` —
 // `templates-user.js` sauvegarde `'fov'`, donc un template appliqué au démarrage
 // repose `params.fov`. « 33 n'existe nulle part dans le dépôt » était vrai de la
 // SOURCE et faux de ce qui tourne : **l'appelant doit passer le fov vivant.**
 import { FOV_DEG } from './monde/seuil-socle.js'
 // L'EXAGÉRATION PARTAGÉE — Tâche E. ⚠️ **UN ÉCRIVAIN, N LECTEURS, ET LE GLOBE
 // EST LE QUATORZIÈME** (`terrain.js` ×5, `ocean.js` ×2, `gpx.js` ×1,
 // `main.js` ×5). ⚠️ Ce module n'importe RIEN — c'est sa seule règle, et elle est
 // gardée par un test —, donc aucun cycle n'est ouvert ici.
 import { lireExageration } from './monde/exageration-continue.js'
+import { loiTextureMonde, GRAIN_PAR_PIXEL, METRES_PAR_DEGRE } from './monde/loi-texture-monde.js'
 // LE FOND DU CROP — Tâche J bis. Pur lui aussi (il n'importe que
 // `crop-sphere.js`, pur) : il ne rend que des nombres, et c'est ce fichier-ci
 // qui décide QUAND les lire. Son en-tête porte les mesures qui le fondent.
 import { altitudeMaillage, altitudeSonde, echantillonnerFond, cleFond } from './monde/fond-crop.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
@@ -479,26 +480,51 @@ function gridFor(z) {
   if (z <= 5) return 32
   return 24
 }
 
 // ---------------------------------------------------------------- shader
 
 const VERT = /* glsl */ `
 varying vec2 vUv;
 varying vec3 vNormalW;
 varying vec2 vLatLon;
+// LA DISTANCE CAMERA DU FRAGMENT — Tache K, la loi de texture ancree au monde.
+//
+// (Pas d'accent grave dans ce bloc : il vit dans un template literal JS et le
+// terminerait — le piege que terrain.js, ocean.js et le bloc du crop
+// documentent tous les trois, et qui a coute une passe de syntaxe ici meme.)
+//
+// ⚠️ PRISE EN ESPACE DE VUE, PAS EN ESPACE MONDE, ET C'EST LA PRECISION QUI LE
+// DICTE : les sommets sont en RTC (relatifs au centre de LEUR tuile) expres pour
+// ne pas payer l'ulp float32 a magnitude 100 (0,486 m, recalcule par l'etude du
+// fondu de niveaux). modelViewMatrix * position rend la position dans le repere
+// de la CAMERA, dont la longueur EST la distance cherchee — sans jamais
+// reconstruire une coordonnee monde de grande magnitude.
+//
+// ⚠️ ET C'EST LA PROFONDEUR (-z de vue), PAS LA LONGUEUR DU VECTEUR. Pour une
+// camera en perspective, un pixel couvre 2 z tan(fov/2) / hauteurPx d'un plan
+// perpendiculaire a l'axe de vue : la grandeur exacte est la PROFONDEUR. Prendre
+// length(mv.xyz) surestimerait de 1/cos(theta) sur les bords — jusqu'a +8 % au
+// coin a fov 33 — et ferait varier la loi avec la position a l'ecran, ce que la
+// tache existe justement pour supprimer.
+//
+// ⚠️ ET C'EST UN varying, PAS UN ATTRIBUT : aucun octet de geometrie en plus,
+// contrairement a la cible de morphing chiffree a +23 % par l'etude.
+varying float vProfCam;
 attribute vec2 latlon;
 void main() {
   vUv = uv;
   vLatLon = latlon;
   vNormalW = normalize(mat3(modelMatrix) * normal);
-  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
+  vec4 mv = modelViewMatrix * vec4(position, 1.0);
+  vProfCam = -mv.z;
+  gl_Position = projectionMatrix * mv;
 }
 `
 
 const FRAG = /* glsl */ `
 precision highp float;
 varying vec2 vUv;
 varying vec3 vNormalW;
 varying vec2 vLatLon;
 uniform sampler2D uTex;
 uniform sampler2D uRamp;
@@ -555,20 +581,36 @@ uniform float uMerRampeOn;
 // couverture. Le socle, lui, prend l'amplitude de SON champ (uSeaRange). Ce
 // budget-ci vient donc du champ de la calotte, ou il est mesure.
 uniform float uMerFondBudgetM;
 uniform vec3 uOceanShallow;
 uniform vec3 uOceanMid;
 uniform vec3 uOceanDeep;
 uniform float uPlancherRampeM; // garde de division, en metres — voir le module
 // côté de la tuile en texels — 256 (AWS) ou 512 (Mapterhorn), voir planTuile
 uniform float uTilePx;
 
+// ══════════ LA LOI DE TEXTURE ANCREE AU MONDE — Tache K ═══════════════════
+//
+// ⚠️ uMppFacteur A 0 : RIEN NE CHANGE. Meme garde et meme raison que uCropOn,
+// uHabOn et uMerRampeOn — la production (la vue orbitale du globe, en ligne sur
+// shibumap.com) rend exactement ce qu'elle rendait, au bit pres, tant que
+// poserLoiMonde n'a pas ete appele. C'est le patron « on elargit sans changer le
+// defaut » (distanceRivage de F, aussi: null de J, le fond de J bis).
+//
+// La loi vit dans src/monde/loi-texture-monde.js et se verifie sous node
+// (test/loi-texture-monde.test.js) ; ce bloc-ci en est la TRANSCRIPTION.
+uniform float uMppFacteur;    // metres de sol par pixel d'ecran, PAR unite de distance
+uniform float uResRefM;       // metres de sol par texel de la donnee de reference
+uniform float uGrainParPixel; // cellules de grain par pixel d'ecran
+uniform float uMetresParDegre;
+varying float vProfCam;
+
 // ══════════ LE CROP DÉCOUPÉ DANS LA SPHÈRE — Tâche A, « UNE SEULE TERRE » ═══
 //
 // Adrien, le 2026-08-21 : « Le crop doit se faire dans la terre arrondie. » Les
 // tuiles cessent d'être dessinées entières ; elles sont coupées à la forme du
 // socle. La loi vit dans src/monde/crop-sphere.js et se vérifie sous node
 // (test/crop-sphere.test.js) ; ce bloc-ci en est la TRANSCRIPTION.
 //
 // (Pas d'accent grave dans ce bloc : il vit dans un template literal JS, il le
 // terminerait — le piège que terrain.js et ocean.js documentent tous les deux,
 // et il a coûté une suite entière la fois précédente.)
@@ -999,21 +1041,44 @@ void main() {
   float crowdK = uHabOn > 0.5 ? 0.22 : 0.30;
   float minor = 1.0 - smoothstep(0.0, dch * poidsC, abs(fract(ch + 0.5) - 0.5));
   float ch5 = ch / 5.0;
   float major = 1.0 - smoothstep(0.0, fwidth(ch5) * poidsC, abs(fract(ch5 + 0.5) - 0.5));
   float crowd = clamp(1.0 - dch * crowdK, 0.0, 1.0);
   // MINIFICATION fade (Adrien : scintillement de la map en orbite) — the height
   // texture carries no mipmaps (they corrupt the packed metres), so when the
   // tile shrinks in the orbital/travel view the sampled height aliases and the
   // contour lines CRAWL. Fade them out as the tile minifies (texels per screen
   // pixel > ~1) so the far globe reads clean; they return in full up close.
-  float texel = max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx;
+  //
+  // ══════ ET C'EST ICI QUE LA LOI QUITTE L'ESPACE-TUILE — Tache K ══════════
+  //
+  // ⛔ fwidth(vUv) EST LA DERIVEE D'UN UV LOCAL A LA TUILE, ET uTilePx VAUT 256
+  // OU 512 SELON LA TUILE. Une tuile grossiere couvre plus de terrain pour
+  // autant de texels, donc fwidth(vUv) est mecaniquement plus petit : minFade
+  // peut valoir 1 d'un cote d'une frontiere de niveaux et 0 de l'autre — UNE
+  // TUILE ENTIERE S'AFFICHE COMME UN CHAMP PLAT pendant que sa voisine garde ses
+  // courbes. C'est l'arete droite qu'Adrien voit, et l'Etape 1 de la Tache K l'a
+  // MESUREE : geler minFade change 23,5 % de l'image au nadir et 41,0 % en
+  // isometrique, contre 0,05 % et 0,21 % pour crowd. C'est lui qui domine.
+  //
+  // ⚠️ ET DES SEPT fwidth DU NUANCEUR, C'EST LE SEUL QUI SOIT EN ESPACE-TUILE
+  // DE BOUT EN BOUT : les six autres mesurent des metres, des degres ou une
+  // couverture de cote, c'est-a-dire des grandeurs de MONDE par pixel d'ecran.
+  // Le detail de l'audit est en tete de src/monde/loi-texture-monde.js.
+  //
+  // La grandeur de remplacement ne depend QUE de la distance camera : ni du
+  // niveau de la tuile (donc plus d'arete), ni de l'inclinaison de la camera
+  // (donc la meme loi en nadir et en isometrique — le critere de sortie).
+  float mppEcran = vProfCam * uMppFacteur; // metres de sol par pixel d'ecran
+  float texelTuile = max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx; // la loi du depot
+  float texelMonde = mppEcran / max(uResRefM, 1e-6);
+  float texel = uMppFacteur > 0.0 ? texelMonde : texelTuile;
   float minFade = clamp(1.6 - texel * 0.55, 0.0, 1.0);
   float contour = max(minor * minorK, major) * uContourOpacity * crowd * minFade;
   contour *= h < 0.0 ? 0.35 : 1.0; // bathymetric contours read lighter
   col = mix(col, uInk, contour);
 
   // 10° graticule — the survey grid of the planet view
   vec2 g = vLatLon / 10.0;
   vec2 dg = fwidth(g);
   vec2 dist = abs(fract(g + 0.5) - 0.5);
   float gl = max(
@@ -1028,21 +1093,42 @@ void main() {
 
   // terminateur jour/nuit (demande Adrien, façon Google Earth) : la face à
   // l'ombre FOND VERS LA COULEUR DU FOND (uShadowColor — poussée par
   // applyBackground, elle suit donc le fond ET le cycle jour/nuit) — la
   // planète s'éteint dans son propre décor, pas dans un noir générique.
   // Bande de crépuscule douce, 10 % de carte résiduelle en pleine nuit.
   float day = smoothstep(-0.22, 0.16, dot(normalize(vNormalW), uSunDir));
   col = mix(uShadowColor, col, 0.10 + 0.90 * day);
 
   // faint paper grain
-  col += (hash12(vUv * 941.7 + vLatLon) - 0.5) * 0.02 * (0.2 + 0.8 * day);
+  // ⛔ LE GRAIN ETAIT INDEXE SUR vUv, DONC SUR LA TUILE. vUv va de 0 a 1 quelle
+  // que soit l'etendue au sol : 941,7 cellules par tuile, donc une frequence
+  // inversement proportionnelle a la taille de la tuile, donc un grain qui
+  // DOUBLE de taille a chaque frontiere de niveaux. vLatLon ne compensait pas —
+  // le terme 941,7 x vUv domine de plusieurs ordres de grandeur.
+  //
+  // ⚠️ C'EST LA MEME DISCIPLINE QUE L'HABILLAGE, QUI INDEXE DEJA SON GRAIN SUR
+  // qCrop « sinon le grain se repeterait a chaque tuile ». Ici la coordonnee
+  // continue est le METRE DE SOL absolu, tire de vLatLon (absolu, il etait deja
+  // la pour le graticule et pour la decoupe), ramene en PIXELS D'ECRAN par
+  // mppEcran. Le grain garde donc sa finesse — 941,7/256 = 3,678 cellules par
+  // pixel, derive et non pose — mais son ancrage est le SOL, pas la tuile.
+  //
+  // ⚠️ ET IL NE RESTE PAS COLLE A L'ECRAN : tourner ou deplacer la camera ne
+  // change pas la coordonnee (le sol ne bouge pas), seule la distance la remet a
+  // l'echelle — exactement comme le niveau de tuile le faisait, mais sans marche.
+  // Le moirage que terrain.js documente (etude 5.4) demanderait une coordonnee
+  // d'ecran ; ce n'en est pas une.
+  float grainX = vLatLon.y * cos(radians(vLatLon.x)) * uMetresParDegre / max(mppEcran, 1e-3) * uGrainParPixel;
+  float grainY = vLatLon.x * uMetresParDegre / max(mppEcran, 1e-3) * uGrainParPixel;
+  vec2 grainP = uMppFacteur > 0.0 ? vec2(grainX, grainY) : vUv * 941.7 + vLatLon;
+  col += (hash12(grainP) - 0.5) * 0.02 * (0.2 + 0.8 * day);
 
   gl_FragColor = vec4(col, couvertureCrop);
 }
 `
 
 // ---------------------------------------------------------------- tile math
 
 function tileKey(z, x, y) {
   return `${z}/${x}/${y}`
 }
@@ -1549,20 +1635,30 @@ export class Globe {
       uMerRampeOn: { value: 0 },
       uMerFondBudgetM: { value: RAMPE_MONDE.profondeur },
       uOceanShallow: { value: new THREE.Color(RAMPE_NAUTIQUE.peu) },
       uOceanMid: { value: new THREE.Color(RAMPE_NAUTIQUE.moyen) },
       uOceanDeep: { value: new THREE.Color(RAMPE_NAUTIQUE.fond) },
       // LE CROP — Tâche A, « UNE SEULE TERRE ». ⚠️ `uCropOn: 0` : sans
       // `poserCrop`, RIEN NE CHANGE. Ces cinq-là sont PARTAGÉS (ils vivent dans
       // `this.uniforms`, que `_materialFor` étale dans chaque matériau) : le
       // crop est une propriété du monde, pas de la tuile — contrairement à
       // `uTex` et `uTilePx`, qui sont propres à chacune.
+      // LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K. ⚠️ **`uMppFacteur: 0` :
+      // sans `poserLoiMonde`, RIEN NE CHANGE** — même garde et même raison que
+      // `uCropOn`, `uHabOn` et `uMerRampeOn`. Ces quatre-là sont PARTAGÉS (ils
+      // vivent dans `this.uniforms`, que `_materialFor` étale dans chaque
+      // matériau) : la loi est une propriété du MONDE, pas de la tuile — c'est
+      // le sujet même de la tâche, et la mettre par tuile la referait mentir.
+      uMppFacteur: { value: 0 },
+      uResRefM: { value: 1 },
+      uGrainParPixel: { value: GRAIN_PAR_PIXEL },
+      uMetresParDegre: { value: METRES_PAR_DEGRE },
       uCropOn: { value: 0 },
       uCropCentre: { value: new THREE.Vector2(0, 0) },
       uCropDemi: { value: 1 },
       uCropCoin: { value: 0 },
       uCropCoinN: { value: 2 },
 
       // L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3.
       //
       // ⚠️ `uEstompageOn: 0` : sans `poserEstompage`, RIEN NE CHANGE — même
       // garde et même raison que `uCropOn`. Ces deux-là sont PARTAGÉS au sens
@@ -1788,20 +1884,55 @@ export class Globe {
     this._melangeCalottes(true)
     // ⚠️ **ET LA MER SUIT, SINON ELLE FLOTTE.** Tâche J : sans cette ligne, la
     // planète s'efface et il reste un rectangle bleu de plusieurs centaines de
     // kilomètres au-dessus du vide — relevé à l'écran, « la mer déborde de
     // ~400 km sur un bloc de 10 km ». C'est le SEUL appel par image du bord, et
     // `creerVeilleEstompage` ne le déclenche que sur changement de valeur.
     this._majBordMer()
     return v
   }
 
+  /**
+   * LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K.
+   *
+   * Pose les quatre uniformes qui font quitter l'espace-tuile à `minFade` et au
+   * grain de papier. ⚠️ **APPELÉE PAR IMAGE**, parce que le `fov` et la hauteur
+   * du cadre changent en cours de session : le §0 du plan est formel, « tout ce
+   * qui dérive un seuil du fov lit `camera.fov` EN DIRECT » — le code dit 30,
+   * l'application vivante tourne à 33.
+   *
+   * ⚠️ **REND `false` ET NE TOUCHE À RIEN SI LA LOI N'EST PAS CALCULABLE.** Un
+   * `NaN` posé dans `uMppFacteur` ferait basculer chaque fragment sur la branche
+   * monde avec une échelle absurde — un écran noir sans un mot d'erreur.
+   *
+   * @param {{fovDeg:number, hauteurPx:number, lat:number}} o
+   */
+  poserLoiMonde({ fovDeg, hauteurPx, lat = 0 } = {}) {
+    const loi = loiTextureMonde({ fovDeg, hauteurPx, lat })
+    if (!loi) return false
+    const u = this.uniforms
+    u.uMppFacteur.value = loi.mppFacteur
+    u.uResRefM.value = loi.resRefM
+    u.uGrainParPixel.value = loi.grainParPixel
+    u.uMetresParDegre.value = loi.metresParDegre
+    return true
+  }
+
+  /**
+   * Retire la loi de monde — le nuanceur reprend celle du dépôt, AU BIT PRÈS.
+   * C'est ce qui garantit que la production (la vue orbitale de shibumap.com)
+   * n'est pas concernée tant que `?terre=unique` n'est pas levé.
+   */
+  retirerLoiMonde() {
+    this.uniforms.uMppFacteur.value = 0
+  }
+
   /** Retire l'estompage — on revient au crop SEUL, le comportement de la Tâche A. */
   retirerEstompage() {
     const u = this.uniforms
     u.uEstompageOn.value = 0
     u.uEstompage.value = 1
     this._melangeCalottes(false)
     this._majBordMer()
   }
 
   /** Les calottes passent (ou non) dans la liste triée du moteur. */
diff --git a/src/main.js b/src/main.js
index 04587cd..e0a1b29 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4672,20 +4672,51 @@ const veilleEstompage = creerVeilleEstompage({ appliquer: (f) => globe?.poserEst
 // qui naîtrait sur une altitude et une planète qui s'effacerait sur une autre se
 // contrediraient à l'écran, et c'est mot pour mot l'argument écrit trois lignes
 // plus haut pour l'ordre des deux appels dans `tick()`.
 function majEstompage() {
   if (!frontiereActive) return
   if (terreUniqueBranchee) return
   if (modes?.busy || !(largeurBlocM() > 0)) return
   veilleEstompage.maj(altitudeCadrageM())
 }
 
+// ══════════ LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K ════════════════════
+//
+// ⚠️ **LUE ICI ET NULLE PART AILLEURS, ET LE `fov` EST LU EN DIRECT.** Le §0 du
+// plan a payé deux fautes critiques là-dessus : le code dit `FOV_DEG = 30`
+// (`main.js:289`) mais l'application vivante tourne à **33** parce qu'un
+// template repose `params.fov`. Un seuil dérivé d'un fov écrit en dur serait
+// faux de 10 % sur toute la session, en silence.
+//
+// ⚠️ **ET LA HAUTEUR EST CELLE DU TAMPON DE DESSIN, PAS CELLE DU CSS.** Sur un
+// écran Retina le tampon fait deux fois la hauteur en points ; prendre
+// `clientHeight` doublerait les mètres par pixel et ferait disparaître les
+// courbes de niveau sur les seules machines à forte densité — un défaut que
+// personne ne reproduirait sur son poste.
+//
+// ⚠️ **SOUS DRAPEAU, ET LE DÉFAUT EST L'ANCIEN.** Hors `?terre=unique`, la loi
+// est RETIRÉE : `uMppFacteur` retombe à 0 et le nuanceur reprend `fwidth(vUv) ×
+// uTilePx`, au bit près. La vue orbitale en production ne bouge pas.
+const _tailleDessin = new THREE.Vector2()
+function majLoiTextureMonde() {
+  if (!globe) return
+  if (!terreUniqueBranchee) { globe.retirerLoiMonde(); return }
+  renderer.getDrawingBufferSize(_tailleDessin)
+  const cam = frontiereActive ? camGlobe : camera
+  const ancre = latLonOrigineBloc()
+  globe.poserLoiMonde({
+    fovDeg: cam?.fov ?? camera.fov,
+    hauteurPx: _tailleDessin.y,
+    lat: Number.isFinite(ancre?.lat) ? ancre.lat : 0,
+  })
+}
+
 // ══════════ UNE SEULE TERRE — Tâche I, LE CONTEXTE ET LA VEILLE ════════════
 //
 // ⚠️ **LE CROP DOIT TOMBER EXACTEMENT SUR LE BLOC, ET LA SIMILITUDE NE PARDONNE
 // PAS.** `majCameraFond` pose la caméra de fond en ancrant le globe sur
 // `latLonOrigineBloc()` — le lat/lon qui est à l'origine du bloc, PAS le lieu
 // demandé (`params.demLat/demLon` décalait la planète de 28 px sur 562, mesuré).
 // Le crop prend donc **la même ancre**, sans quoi la découpe et le bloc qu'elle
 // remplace ne seraient pas au même endroit à l'écran.
 //
 // ⚠️ **ET LA LARGEUR SE DÉDUIT DE L'EMPRISE, PAS DE `params.demZoom`.** Le
@@ -11425,20 +11456,21 @@ function tick() {
   // se contrediraient à l'écran. Avant `majCameraFond`, parce que c'est elle qui
   // pose la caméra dont la passe de fond va se servir : l'uniforme doit être
   // écrit avant le dessin, pas après.
   majEstompage()
   // ══════ LA FRONTIÈRE DE RENDU — Tâche 1b bis ════════════════════════
   //
   // La caméra de fond se repose AVANT le dessin, et **avant `globe.update`** :
   // en mode surface c'est elle, et pas la caméra principale, qui dit au quadtree
   // où il est regardé. Sans drapeau, `majCameraFond` rend la main tout de suite.
   majCameraFond()
+  majLoiTextureMonde()
   if (frontiereActive && modes.mode === 'surface') {
     // ⚠️ **LE GLOBE STREAME MAINTENANT EN MODE SURFACE, ET C'EST UN COÛT
     // RÉEL, PAS UN EFFET DE BORD GRATUIT.** Il est le fond : sans cet appel il
     // reste à ses seize racines et le raccord montre une planète floue. Le
     // trafic que ça ouvre n'a PAS été mesuré sur un vol complet — c'est écrit
     // dans le compte rendu de la tâche, et c'est l'une des raisons du drapeau.
     globe.update(camGlobe, dtAmb)
     // le soleil du fond suit la même loi qu'en orbite (voir juste dessous) :
     // un soleil de scène laisserait la moitié du fond dans la nuit
     _orbSun.copy(camGlobe.position).normalize().applyAxisAngle(_upY, -0.73)
diff --git a/src/monde/loi-texture-monde.js b/src/monde/loi-texture-monde.js
new file mode 100644
index 0000000..fde7bdb
--- /dev/null
+++ b/src/monde/loi-texture-monde.js
@@ -0,0 +1,194 @@
+// LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
+// (`test/loi-texture-monde.test.js`).
+//
+// ══════════ 0. CE QUE CE MODULE RÉPARE, ET LA MESURE QUI LE FONDE ══════════
+//
+// Le nuanceur de fragment du globe écrit une partie de sa loi de couleur **en
+// espace-tuile** : `vUv` va de 0 à 1 quelle que soit l'étendue au sol, et
+// `uTilePx` vaut 256 ou 512 SELON LA TUILE. Deux tuiles voisines de niveaux
+// différents rendent donc deux lois différentes, et la frontière se lit comme
+// une **arête droite** séparant un champ plat d'un champ texturé.
+//
+// ⚠️ **CE N'EST PAS UNE DÉDUCTION, C'EST UNE MESURE.** Étape 1 de la Tâche K,
+// banc A/B côté GPU (on gèle un terme, on compte les pixels qui CHANGENT ;
+// témoin deux rendus consécutifs = 0 pixel, et le banc n'est pas inerte
+// puisque les variantes, elles, changent des centaines de milliers de pixels) :
+//
+//   La Réunion, altitude 22,8 km, même cible, même jeu de tuiles, fov 33 lu en
+//   direct, cadre 1088 × 731, grain de pellicule et vignette mis à 0.
+//
+//     terme gelé                    nadir (polaire 8°)   isométrique (55°)
+//     minFade → 1                        23,5 %                41,0 %
+//     grain désindexé de vUv             42,0 %                28,8 %
+//     empreinte de decodeMetersAA → 0     1,9 %                 1,8 %
+//     crowd → 1                           0,05 %                0,21 %
+//
+//   Et sur la planète rendue OPAQUE (`uEstompage = 0`, qui retire l'artefact de
+//   transparence de l'estompage), la surface PLATE de l'image (écart-type local
+//   3×3 sous 1,2/255) tombe de **38,4 % à 24,9 %** au nadir et de **36,0 % à
+//   14,3 %** en isométrique quand on gèle `minFade` : c'est lui, et lui seul,
+//   qui fabrique les champs plats. Le grain touche plus de pixels mais avec une
+//   amplitude neuf à douze fois plus faible (3,7/255 contre 33 à 43/255) et il
+//   ne change PAS la fraction plate (0,3838 → 0,3835).
+//
+// ⚠️ **ET LA PART DE `minFade` GRANDIT AVEC L'INCLINAISON** : à altitude
+// IDENTIQUE, basculer de 8° à 55° la fait passer de 23,5 % à 41,0 % de l'image.
+// C'est la dépendance à l'angle qu'Adrien décrit (« en top-down du vert
+// partout ; en isométrique une texture avec de l'aliasing »).
+//
+// ══════════ 1. LES SEPT `fwidth` DU NUANCEUR, ET LEQUEL EST EN CAUSE ═══════
+//
+// `fwidth` mesure une variation PAR PIXEL D'ÉCRAN. Ce n'est pas un défaut en
+// soi : une largeur de trait DOIT se mesurer en pixels, sinon le trait s'épaissit
+// au loin. Ce qui fait une arête, c'est de mesurer en **espace-tuile**.
+//
+//   · `decodeMetersAA` (`fwidth(uv)`) — ⚠️ écrit en espace-tuile, MAIS
+//     `fwidth(uv) × étendueAuSolDeLaTuile` est l'empreinte du pixel **en mètres
+//     de sol**, la même quel que soit le niveau : l'expression est locale, la
+//     grandeur ne l'est pas. Mesuré : 1,8 à 1,9 % de l'image. **Laissé tel quel.**
+//   · la bordure du crop (`fwidth(d)`) — `d` est en unités de crop, monde.
+//   · l'anticrénelage de côte (`fwidth(landness)`) — `landness` vient d'un champ
+//     CUIT indexé sur `qCrop`, monde. ⚠️ Le commentaire du dépôt dit que la garde
+//     est un uniforme, donc que la dérivée est définie : **vérifié, il a raison,
+//     et rien n'est touché là.**
+//   · la largeur des courbes mineures et majeures (`fwidth(ch)`, `fwidth(ch5)`) —
+//     `ch = h / intervalle`, donc des MÈTRES par pixel d'écran. Monde.
+//   · le graticule (`fwidth(g)`) — `g = vLatLon / 10`, monde.
+//   · ⛔ **`minFade` (`fwidth(vUv) × uTilePx`) — LE SEUL qui reste en
+//     espace-tuile de bout en bout**, parce que ni `vUv` ni `uTilePx` ne sont
+//     ramenés au sol. C'est celui que ce module remplace.
+//
+// ══════════ 2. LA GRANDEUR D'ANCRAGE : MÈTRES DE SOL PAR PIXEL D'ÉCRAN ═════
+//
+// Une caméra en perspective voit, à la distance `d`, une hauteur de
+// `2 d tan(fov/2)` ; répartie sur `hauteurPx` pixels, cela fait
+// `2 d tan(fov/2) / hauteurPx` unités de scène par pixel. Multiplié par les
+// mètres par unité de globe, c'est **le mètre de sol par pixel d'écran**.
+//
+// ⚠️ **ELLE NE DÉPEND QUE DE LA DISTANCE**, donc ni du niveau de la tuile
+// (pas d'arête) ni de l'inclinaison de la caméra (même loi en nadir et en
+// isométrique). C'est exactement le critère de sortie demandé.
+//
+// ⚠️ **ET LE `fov` SE LIT EN DIRECT.** Le §0 du plan est formel : le code dit
+// 30, l'application vivante tourne à 33 parce qu'un template repose
+// `params.fov`. Ce module ne connaît aucun fov par défaut : il le REÇOIT.
+
+import { ORBITAL_M_PER_UNIT } from '../geo.js'
+import { ZOOM_SOCLE } from './seuil-socle.js'
+// ⚠️ **LA CIRCONFÉRENCE VIENT DE `habillage-crop.js`, ELLE N'EST PAS RÉÉCRITE.**
+// Le dépôt la porte déjà (40 075 016,686 — la circonférence WGS84, celle du
+// pavage Web-Mercator, PAS 2π × `EARTH_RADIUS_M` qui vaut 0,11 % de moins). Une
+// seconde écriture aurait divergé de la première dès le premier chiffre, et
+// c'est la cicatrice que `terrain.js` documente déjà.
+import { CIRCONFERENCE_M } from './habillage-crop.js'
+
+const D2R = Math.PI / 180
+
+/**
+ * Mètres de sol par pixel d'écran, PAR UNITÉ de distance caméra.
+ *
+ * Le nuanceur multiplie ce facteur par la distance caméra du fragment
+ * (`vDistCam`, en unités de globe) et obtient les mètres de sol par pixel.
+ *
+ * ⚠️ **REND 0 SI UNE ENTRÉE EST ABSURDE**, et 0 est la valeur qui dit au
+ * nuanceur « loi non posée, garde celle du dépôt ». C'est le patron
+ * `aussi: null` de la Tâche J : on élargit sans changer le défaut.
+ */
+export function facteurMppParUnite({ fovDeg, hauteurPx, metresParUnite = ORBITAL_M_PER_UNIT } = {}) {
+  if (!(fovDeg > 0) || !(fovDeg < 180)) return 0
+  if (!(hauteurPx > 0)) return 0
+  if (!(metresParUnite > 0)) return 0
+  return (2 * Math.tan((fovDeg * D2R) / 2) * metresParUnite) / hauteurPx
+}
+
+// ══════════ 3. LA RÉSOLUTION DE RÉFÉRENCE ══════════════════════════════════
+//
+// `minFade` compare les mètres de sol par pixel d'écran à une résolution de
+// DONNÉE. Aujourd'hui c'est celle de LA TUILE — d'où l'arête. Il faut une
+// résolution qui soit une propriété du MONDE, pas de la tuile.
+//
+// ⚠️ **CELLE DU SOCLE, ET C'EST UN CHOIX QUI A UNE SOURCE.** `ZOOM_SOCLE = 13`
+// est le zoom auquel le bloc est défini dans tout le produit
+// (`seuil-socle.js`) ; `TUILE_REF_PX = 256` est le côté des tuiles AWS, la
+// source qui couvre TOUJOURS (`planTuile` : sous le plancher de la source fine
+// et hors de sa couverture, on retombe sur AWS). La règle se lit donc :
+// **les courbes de niveau restent tant que l'écran résout la donnée du socle.**
+//
+// ⚠️ **UN SEUL NIVEAU, PAS CELUI DE LA TUILE COURANTE, ET SURTOUT PAS UNE
+// RE-MESURE PAR POSE** : c'est précisément la re-mesure par pose qui donne à la
+// mer une couleur différente à chaque altitude (voir les réserves du rapport K).
+export const TUILE_REF_PX = 256
+
+/**
+ * Mètres de sol par texel de la donnée de référence, à une latitude donnée.
+ *
+ * Web-Mercator : un degré de longitude vaut `cos(lat)` fois moins de sol qu'à
+ * l'équateur, et c'est cette largeur-là que la tuile couvre.
+ */
+export function resolutionRefM({ lat = 0, zoom = ZOOM_SOCLE, tuilePx = TUILE_REF_PX } = {}) {
+  if (!Number.isFinite(lat)) return 0
+  if (!(zoom >= 0) || !(tuilePx > 0)) return 0
+  const cos = Math.cos(Math.min(Math.abs(lat), 85.05112878) * D2R)
+  return (CIRCONFERENCE_M * cos) / (2 ** zoom * tuilePx)
+}
+
+// ══════════ 4. LE GRAIN DE PAPIER ══════════════════════════════════════════
+//
+// Le dépôt indexe le grain sur `vUv * 941.7`, c'est-à-dire **941,7 cellules par
+// côté de tuile**, quelle que soit l'étendue au sol de la tuile. La fréquence du
+// grain est donc inversement proportionnelle à la taille de la tuile : à la
+// frontière de niveaux, le grain double de taille d'un coup.
+//
+// ⚠️ **LA CONSTANTE DE REMPLACEMENT SE DÉRIVE, ELLE NE SE POSE PAS.** À la
+// condition de référence de `minFade` — un texel de donnée pour un pixel
+// d'écran — une tuile de `TUILE_REF_PX` texels occupe `TUILE_REF_PX` pixels, et
+// les 941,7 cellules du dépôt s'y répartissent : **941,7 / 256 = 3,678 cellules
+// par pixel d'écran**. On garde ce chiffre-là, et le grain garde donc SON grain
+// — c'est son ancrage qui change, pas son apparence.
+//
+// ⚠️ **ET IL RESTE ACCROCHÉ AU SOL, PAS À L'ÉCRAN.** `terrain.js` (étude 5.4)
+// documente le moirage qu'Adrien a attrapé à l'œil quand un grain est évalué en
+// coordonnées d'écran : il reste collé pendant que le relief défile. Ici la
+// coordonnée est le MÈTRE DE SOL absolu ; seule sa mise à l'échelle suit la
+// distance, exactement comme aujourd'hui elle suit le niveau de la tuile — à
+// ceci près qu'elle la suit sans marche.
+export const GRAIN_CELLULES_PAR_TUILE = 941.7
+export const GRAIN_PAR_PIXEL = GRAIN_CELLULES_PAR_TUILE / TUILE_REF_PX
+
+// Mètres de sol par degré de latitude. Sert au nuanceur à convertir `vLatLon`
+// en mètres absolus. ⚠️ Dérivé de `CIRCONFERENCE_M`, comme tout le reste.
+export const METRES_PAR_DEGRE = CIRCONFERENCE_M / 360
+
+/**
+ * La coordonnée du grain, en CELLULES, pour un point du globe.
+ *
+ * ⚠️ **C'EST LE JUMEAU JS DES DEUX LIGNES `grainX` / `grainY` DU NUANCEUR**, et
+ * `test/loi-texture-monde.test.js` EXTRAIT ces deux lignes du GLSL puis les
+ * exécute contre cette fonction. Une transcription qui divergerait — un
+ * `cos` oublié, un facteur inversé — fait tomber une VALEUR, pas une chaîne.
+ *
+ * ⚠️ **LE `cos(lat)` N'EST PAS DÉCORATIF** : sans lui, un degré de longitude
+ * vaudrait autant de mètres au pôle qu'à l'équateur et le grain s'étirerait en
+ * bandes horizontales en montant vers les hautes latitudes.
+ */
+export function coordonneeGrain({ lat, lon, mppEcran, grainParPixel = GRAIN_PAR_PIXEL } = {}) {
+  const k = (METRES_PAR_DEGRE / Math.max(mppEcran, 1e-3)) * grainParPixel
+  return [lon * Math.cos(lat * D2R) * k, lat * k]
+}
+
+/**
+ * Le paquet complet que `Globe.poserLoiMonde` étale dans les uniformes.
+ *
+ * ⚠️ **REND `null` SI LE FACTEUR EST NUL** — l'appelant repose alors 0 et le
+ * nuanceur reprend la loi du dépôt, au bit près.
+ */
+export function loiTextureMonde({ fovDeg, hauteurPx, lat = 0, metresParUnite } = {}) {
+  const mppFacteur = facteurMppParUnite({ fovDeg, hauteurPx, metresParUnite })
+  if (!(mppFacteur > 0)) return null
+  const resRefM = resolutionRefM({ lat })
+  if (!(resRefM > 0)) return null
+  return { mppFacteur, resRefM, grainParPixel: GRAIN_PAR_PIXEL, metresParDegre: METRES_PAR_DEGRE }
+}
diff --git a/test/loi-texture-monde.test.js b/test/loi-texture-monde.test.js
new file mode 100644
index 0000000..2c68456
--- /dev/null
+++ b/test/loi-texture-monde.test.js
@@ -0,0 +1,498 @@
+// LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
+//
+//   ① LA LOI PURE — le facteur « mètres de sol par pixel d'écran » ne dépend QUE
+//      de la distance, du fov et de la hauteur du cadre ; il est linéaire en
+//      distance, et il rend 0 (donc « loi non posée ») sur toute entrée absurde.
+//   ② LA RÉSOLUTION DE RÉFÉRENCE est une propriété du MONDE — elle se dérive de
+//      `ZOOM_SOCLE` et de la circonférence du dépôt, jamais d'une tuile.
+//   ③ LE GRAIN — sa coordonnée est CONTINUE (deux points voisins du sol rendent
+//      deux coordonnées voisines), elle ne dépend d'AUCUNE grandeur de tuile, et
+//      sa fréquence se dérive du 941,7 du dépôt au lieu d'être posée.
+//   ④ LE NUANCEUR, EXTRAIT PUIS EXÉCUTÉ — les quatre affectations de `globe.js`
+//      (`texelTuile`, `texelMonde`, `texel`, `grainX`, `grainY`) sont prises AU
+//      TEXTE, traduites mécaniquement et APPELÉES. C'est le patron de
+//      `test/estompage-terre.test.js` (⑤) : une mutation fait tomber une VALEUR,
+//      pas une chaîne.
+//   ⑤ L'ÉTEINT EST L'ANCIEN — `uMppFacteur` à 0 rend, sur les deux sites,
+//      exactement l'expression du dépôt. C'est la garde que `uCropOn`, `uHabOn`
+//      et `uMerRampeOn` portent déjà, et pour la même raison : la vue orbitale
+//      en production ne doit pas bouger.
+//   ⑥ LE BRANCHEMENT — `poserLoiMonde` / `retirerLoiMonde` sont EXERCÉES sur un
+//      globe minimal, et le texte de `main.js` est vérifié (aucun test de ce
+//      dépôt ne charge `main.js`, §0 du plan) : la loi est appelée par image,
+//      sous drapeau, avec le fov LU EN DIRECT et la hauteur du TAMPON DE DESSIN.
+//
+// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le GPU exécute bien ce
+// texte, et que l'image qui en sort ferme les arêtes. Seul l'écran le dit —
+// l'Étape 4 de la tâche et son compte rendu (`rapport-K.md`, captures dans
+// `.banc/vues-K/`) sont là pour ça.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
+// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
+// `test/damier-cadre.test.js`. Le posticher plutôt que d'emprunter la méthode au
+// prototype est ici INDISPENSABLE : ce qu'on veut vérifier, c'est justement que
+// `_materialFor` — une fermeture d'instance, pas une méthode de prototype —
+// étale les MÊMES objets d'uniforme dans chaque matériau.
+globalThis.document = {
+  createElement: () => ({
+    width: 0,
+    height: 0,
+    getContext: () => ({
+      createLinearGradient: () => ({ addColorStop() {} }),
+      fillRect() {},
+      set fillStyle(_v) {},
+    }),
+  }),
+}
+const { Globe } = await import('../src/globe.js')
+import {
+  GRAIN_CELLULES_PAR_TUILE,
+  GRAIN_PAR_PIXEL,
+  METRES_PAR_DEGRE,
+  TUILE_REF_PX,
+  coordonneeGrain,
+  facteurMppParUnite,
+  loiTextureMonde,
+  resolutionRefM,
+} from '../src/monde/loi-texture-monde.js'
+import { CIRCONFERENCE_M } from '../src/monde/habillage-crop.js'
+import { ZOOM_SOCLE } from '../src/monde/seuil-socle.js'
+import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
+
+const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
+const SRC_MAIN = new URL('../src/main.js', import.meta.url)
+const SRC_MODULE = new URL('../src/monde/loi-texture-monde.js', import.meta.url)
+const GLOBE = readFileSync(SRC_GLOBE, 'utf8')
+const MAIN = readFileSync(SRC_MAIN, 'utf8')
+
+// ══════════ ① LA LOI PURE ══════════════════════════════════════════════════
+
+test('①a le facteur est la trigonométrie de la perspective, rejouée', () => {
+  // hauteur vue à la distance d : 2 d tan(fov/2) ; répartie sur hauteurPx.
+  for (const fovDeg of [20, 30, 33, 60, 90]) {
+    for (const hauteurPx of [256, 731, 860, 2160]) {
+      const attendu = ((2 * Math.tan((fovDeg * Math.PI) / 360)) / hauteurPx) * ORBITAL_M_PER_UNIT
+      assert.ok(
+        Math.abs(facteurMppParUnite({ fovDeg, hauteurPx }) - attendu) < 1e-12,
+        `fov ${fovDeg}, hauteur ${hauteurPx}`
+      )
+    }
+  }
+})
+
+test('①b LINÉAIRE EN DISTANCE — deux fois plus loin, deux fois plus de sol par pixel', () => {
+  // ⚠️ MUTATION VISÉE : mettre le facteur au carré, ou l'inverser. Les deux
+  // passent une comparaison de signe et tombent ici.
+  const f = facteurMppParUnite({ fovDeg: 33, hauteurPx: 731 })
+  assert.ok(Math.abs(2 * f * 3 - f * 6) < 1e-9)
+  assert.ok(f > 0)
+})
+
+test('①c LA HAUTEUR DIVISE, LE FOV MULTIPLIE — un écran plus haut résout MIEUX', () => {
+  const bas = facteurMppParUnite({ fovDeg: 33, hauteurPx: 400 })
+  const haut = facteurMppParUnite({ fovDeg: 33, hauteurPx: 800 })
+  assert.ok(haut < bas, 'doubler la hauteur du cadre doit HALVER les mètres par pixel')
+  assert.ok(Math.abs(haut * 2 - bas) < 1e-12)
+  const etroit = facteurMppParUnite({ fovDeg: 20, hauteurPx: 731 })
+  const large = facteurMppParUnite({ fovDeg: 60, hauteurPx: 731 })
+  assert.ok(large > etroit, 'un champ plus large voit plus de sol par pixel')
+})
+
+test('①d TOUTE ENTRÉE ABSURDE REND 0 — et 0 veut dire « loi non posée »', () => {
+  // ⚠️ Ce n'est pas de la coquetterie : un NaN dans `uMppFacteur` ferait
+  // basculer CHAQUE fragment sur la branche monde avec une échelle absurde —
+  // un écran noir sans un mot d'erreur.
+  const mauvais = [
+    { fovDeg: 0, hauteurPx: 731 },
+    { fovDeg: 180, hauteurPx: 731 },
+    { fovDeg: NaN, hauteurPx: 731 },
+    { fovDeg: -33, hauteurPx: 731 },
+    { fovDeg: 33, hauteurPx: 0 },
+    { fovDeg: 33, hauteurPx: NaN },
+    { fovDeg: 33, hauteurPx: -10 },
+    { fovDeg: 33, hauteurPx: 731, metresParUnite: 0 },
+    {},
+  ]
+  for (const o of mauvais) assert.equal(facteurMppParUnite(o), 0, JSON.stringify(o))
+  for (const o of mauvais) assert.equal(loiTextureMonde(o), null, JSON.stringify(o))
+})
+
+test('①e AUCUN FOV PAR DÉFAUT DANS LE MODULE — il le reçoit, il ne le devine pas', () => {
+  // ⚠️ §0 du plan : le code dit `FOV_DEG = 30`, l'application vivante tourne à
+  // **33** parce qu'un template repose `params.fov`. Deux fautes critiques ont
+  // déjà été payées là-dessus. Un fov écrit ici serait la troisième.
+  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
+  assert.ok(!/FOV/.test(code), 'le module connaît un FOV — il doit le recevoir')
+  assert.ok(!/\bfovDeg\s*=\s*\d/.test(code), 'un fov par défaut est écrit dans le module')
+})
+
+// ══════════ ② LA RÉSOLUTION DE RÉFÉRENCE ═══════════════════════════════════
+
+test('②a elle se dérive de ZOOM_SOCLE et de la circonférence du dépôt', () => {
+  for (const lat of [0, -21.115, 45, 60, -80]) {
+    const attendu = (CIRCONFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (2 ** ZOOM_SOCLE * TUILE_REF_PX)
+    assert.ok(Math.abs(resolutionRefM({ lat }) - attendu) < 1e-9, `lat ${lat}`)
+  }
+})
+
+test('②b LA CIRCONFÉRENCE N’EST PAS RÉÉCRITE — elle vient d’`habillage-crop.js`', () => {
+  // ⚠️ Le dépôt porte 40 075 016,686 (WGS84, le pavage Web-Mercator). Une
+  // seconde écriture — par exemple 2π × EARTH_RADIUS_M, qui vaut 0,11 % de
+  // moins — divergerait dès le premier chiffre.
+  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
+  assert.ok(!/40\s?075/.test(code), 'la circonférence est recopiée dans le module')
+  assert.ok(/from '\.\/habillage-crop\.js'/.test(code), 'elle doit être importée')
+  assert.equal(CIRCONFERENCE_M, 40075016.686)
+})
+
+test('②c c’est une propriété du MONDE — elle ignore la tuile courante', () => {
+  // ⚠️ C'EST LE COEUR DE LA TÂCHE. `uTilePx` vaut 256 ou 512 SELON LA TUILE, et
+  // c'est ce « selon » qui fabrique l'arête droite. La référence, elle, ne
+  // change pas d'une tuile à l'autre : à latitude égale, même valeur.
+  const a = resolutionRefM({ lat: -21.115 })
+  const b = resolutionRefM({ lat: -21.115 })
+  assert.equal(a, b)
+  // et un zoom plus profond donne bien une donnée plus fine, d'un facteur DEUX
+  assert.ok(Math.abs(resolutionRefM({ lat: 0, zoom: 12 }) / resolutionRefM({ lat: 0, zoom: 13 }) - 2) < 1e-12)
+})
+
+test('②d entrées absurdes : 0, jamais un NaN', () => {
+  for (const o of [{ lat: NaN }, { lat: 0, zoom: -1 }, { lat: 0, tuilePx: 0 }, { lat: Infinity }]) {
+    assert.equal(resolutionRefM(o), 0, JSON.stringify(o))
+  }
+})
+
+// ══════════ ③ LE GRAIN ═════════════════════════════════════════════════════
+
+test('③a la fréquence SE DÉRIVE du 941,7 du dépôt — elle n’est pas posée', () => {
+  assert.equal(GRAIN_CELLULES_PAR_TUILE, 941.7)
+  assert.equal(TUILE_REF_PX, 256)
+  assert.equal(GRAIN_PAR_PIXEL, 941.7 / 256)
+  assert.ok(Math.abs(GRAIN_PAR_PIXEL - 3.678515625) < 1e-12)
+})
+
+test('③b CONTINU au passage d’une frontière de tuiles — c’est la propriété demandée', () => {
+  // ⚠️ Deux points distants d'un dixième de mètre de part et d'autre d'un bord
+  // de tuile z13 doivent rendre des coordonnées de grain distantes de la même
+  // fraction de cellule. Avec `vUv`, l'une valait 0 et l'autre 1 : un saut de
+  // 941,7 cellules — c'est-à-dire un grain qui change de taille d'un coup.
+  const mpp = 20
+  const bordLon = (360 * 4321) / 2 ** 13 - 180 // un bord de tuile z13, exactement
+  const eps = 1e-6 // ~0,1 m en longitude
+  const a = coordonneeGrain({ lat: -21.115, lon: bordLon - eps, mppEcran: mpp })
+  const b = coordonneeGrain({ lat: -21.115, lon: bordLon + eps, mppEcran: mpp })
+  const saut = Math.hypot(a[0] - b[0], a[1] - b[1])
+  assert.ok(saut < 0.1, `saut de grain au bord de tuile : ${saut} cellule(s)`)
+  // le témoin : ce que la loi du dépôt faisait au MÊME endroit — vUv y passe de
+  // 1 à 0, donc 941,7 cellules d'un bord à l'autre.
+  assert.ok(GRAIN_CELLULES_PAR_TUILE > 100 * 0.1, 'le témoin ne distingue plus rien')
+})
+
+test('③c la coordonnée ne dépend d’AUCUNE grandeur de tuile', () => {
+  const code = readFileSync(SRC_MODULE, 'utf8').replace(/\/\/[^\n]*/g, ' ')
+  for (const interdit of ['vUv', 'uTilePx', 'tileKey', 'uTex']) {
+    assert.ok(!code.includes(interdit), `le module lit \`${interdit}\` — la loi redeviendrait locale`)
+  }
+})
+
+test('③d le grain SUIT L’ÉCHELLE : deux fois plus de sol par pixel, deux fois moins de cellules', () => {
+  // ⚠️ MUTATION VISÉE : multiplier au lieu de diviser par `mppEcran`. Le grain
+  // deviendrait alors géant de près et invisible de loin — l'inverse exact.
+  const a = coordonneeGrain({ lat: 10, lon: 20, mppEcran: 10 })
+  const b = coordonneeGrain({ lat: 10, lon: 20, mppEcran: 20 })
+  assert.ok(Math.abs(a[0] - 2 * b[0]) < 1e-9)
+  assert.ok(Math.abs(a[1] - 2 * b[1]) < 1e-9)
+})
+
+test('③e le `cos(lat)` est là — sinon le grain s’étire en bandes aux hautes latitudes', () => {
+  // à latitude 60°, un degré de longitude vaut la MOITIÉ d'un degré de latitude
+  const g = coordonneeGrain({ lat: 60, lon: 1, mppEcran: 10 })
+  const h = coordonneeGrain({ lat: 60, lon: 2, mppEcran: 10 })
+  const parDegreLon = h[0] - g[0]
+  const parDegreLat = coordonneeGrain({ lat: 61, lon: 1, mppEcran: 10 })[1] - g[1]
+  assert.ok(Math.abs(parDegreLon / parDegreLat - Math.cos((60 * Math.PI) / 180)) < 1e-9)
+})
+
+test('③f `mppEcran` nul ne fabrique pas un infini', () => {
+  for (const mppEcran of [0, -1, 1e-9]) {
+    const g = coordonneeGrain({ lat: -21, lon: 55, mppEcran })
+    assert.ok(Number.isFinite(g[0]) && Number.isFinite(g[1]), `mpp ${mppEcran}`)
+  }
+})
+
+// ══════════ ④ LE NUANCEUR, EXTRAIT PUIS EXÉCUTÉ ════════════════════════════
+//
+// ⚠️ **PAS UN GREP DE NOM.** On prend le TEXTE du GLSL, on le traduit
+// mécaniquement en JS et on l'APPELLE. C'est la leçon du Tour 1 de la Tâche C
+// (« une mutation doit changer le COMPORTEMENT, pas la CHAÎNE ») et la leçon de
+// la Tâche J bis, qui n'a atteint 36/36 qu'au troisième tour parce que ses
+// tests de BRANCHEMENT manquaient tous.
+
+/** L'affectation `float <nom> = … ;` du nuanceur, prise au texte. */
+function affectation(nom) {
+  const i = GLOBE.indexOf(`float ${nom} = `)
+  assert.ok(i >= 0, `le nuanceur doit porter « float ${nom} = »`)
+  const j = GLOBE.indexOf(';', i)
+  assert.ok(j > i, `« float ${nom} » sans point-virgule`)
+  return GLOBE.slice(i + `float ${nom} = `.length, j)
+}
+
+/** Une expression GLSL scalaire, rendue exécutable. */
+function loi(expr, noms) {
+  const js = expr
+    .replace(/\/\/[^\n]*/g, ' ')
+    .replace(/\s+/g, ' ')
+    // `vLatLon.y` n'est pas un identifiant JS : on l'aplatit en `vLatLon_y`,
+    // c'est la SEULE réécriture de nom, et elle ne change aucune opération.
+    .replace(/\bvLatLon\.([xy])\b/g, 'vLatLon_$1')
+    .replace(/\bmax\s*\(/g, 'Math.max(')
+    .replace(/\bmin\s*\(/g, 'Math.min(')
+    .replace(/\bcos\s*\(/g, 'Math.cos(')
+    .replace(/\bclamp\s*\(/g, 'CLAMP(')
+    .replace(/\bradians\s*\(/g, 'RADIANS(')
+    .trim()
+  const CLAMP = (v, a, b) => Math.min(b, Math.max(a, v))
+  const RADIANS = (d) => (d * Math.PI) / 180
+  // eslint-disable-next-line no-new-func
+  const f = new Function(...noms, 'CLAMP', 'RADIANS', `return (${js});`)
+  return (args) => f(...noms.map((n) => args[n]), CLAMP, RADIANS)
+}
+
+test('④a `texel` bascule sur `uMppFacteur`, et l’ÉTEINT est la loi du dépôt', () => {
+  const f = loi(affectation('texel'), ['uMppFacteur', 'texelMonde', 'texelTuile'])
+  assert.equal(f({ uMppFacteur: 0, texelMonde: 7, texelTuile: 3 }), 3, 'éteint, ce doit être la loi de tuile')
+  assert.equal(f({ uMppFacteur: 51.6, texelMonde: 7, texelTuile: 3 }), 7, 'posée, ce doit être la loi de monde')
+})
+
+test('④b `texelMonde` est bien « mètres par pixel / résolution de référence »', () => {
+  const f = loi(affectation('texelMonde'), ['mppEcran', 'uResRefM'])
+  for (const [mpp, res] of [[20, 17.8], [5, 17.8], [100, 4.5], [1, 1]]) {
+    assert.ok(Math.abs(f({ mppEcran: mpp, uResRefM: res }) - mpp / res) < 1e-12, `${mpp}/${res}`)
+  }
+  // ⚠️ et la garde de division : une résolution nulle ne rend pas un infini
+  assert.ok(Number.isFinite(f({ mppEcran: 20, uResRefM: 0 })))
+})
+
+test('④c `mppEcran` est le produit profondeur × facteur — rien d’autre', () => {
+  const f = loi(affectation('mppEcran'), ['vProfCam', 'uMppFacteur'])
+  for (const d of [0.1, 0.4, 3, 100]) {
+    assert.ok(Math.abs(f({ vProfCam: d, uMppFacteur: 43.888 }) - d * 43.888) < 1e-9, `d ${d}`)
+  }
+})
+
+test('④c-bis le nuanceur de SOMMETS rend la PROFONDEUR, pas la longueur du vecteur', () => {
+  // ⚠️ **CETTE MUTATION A SURVÉCU AU PREMIER TOUR** (`.banc/mutations-K.mjs`,
+  // M25) : `length(mv.xyz)` passe tous les tests de loi pure, et se trompe
+  // pourtant. Un pixel couvre `2 z tan(fov/2) / hauteurPx` d'un plan
+  // perpendiculaire à l'axe de vue : la grandeur exacte est la PROFONDEUR.
+  // `length` surestime de 1/cos(θ) sur les bords — jusqu'à +8 % au coin à
+  // fov 33 — donc la loi varierait avec la POSITION À L'ÉCRAN. Le départage se
+  // fait sur un point HORS AXE : sur l'axe les deux écritures coïncident, et un
+  // test posé là n'aurait rien distingué.
+  const i = GLOBE.indexOf('vProfCam = ')
+  assert.ok(i > 0, 'le nuanceur de sommets ne pose plus vProfCam')
+  const expr = GLOBE.slice(i + 'vProfCam = '.length, GLOBE.indexOf(';', i))
+  const js = expr.replace(/\bmv\.xyz\b/g, '[mv.x, mv.y, mv.z]').replace(/\blength\s*\(/g, 'LEN(')
+  // eslint-disable-next-line no-new-func
+  const f = new Function('mv', 'LEN', `return (${js});`)
+  const LEN = (v) => Math.hypot(v[0], v[1], v[2])
+  assert.ok(Math.abs(f({ x: 0, y: 0, z: -100 }, LEN) - 100) < 1e-9, 'sur l’axe, la profondeur vaut 100')
+  const horsAxe = f({ x: 30, y: 20, z: -100 }, LEN)
+  assert.ok(Math.abs(horsAxe - 100) < 1e-9, `hors axe, la loi rend ${horsAxe} au lieu de 100`)
+  // le témoin : ce que `length` aurait rendu au même endroit — il distingue bien
+  assert.ok(Math.abs(LEN([30, 20, -100]) - 100) > 5, 'le témoin ne distingue plus rien')
+})
+
+test('④d `minFade` garde la courbe du dépôt : 1 près, 0 loin, et le genou à 1,09', () => {
+  // ⚠️ La courbe ne change pas — seule son ENTRÉE change. Une mutation qui
+  // toucherait 1.6 ou 0.55 déplacerait le fondu de moitié.
+  const f = loi(affectation('minFade'), ['texel'])
+  assert.equal(f({ texel: 0 }), 1)
+  assert.ok(Math.abs(f({ texel: 1.5 }) - (1.6 - 1.5 * 0.55)) < 1e-12)
+  assert.equal(f({ texel: 1.6 / 0.55 }), 0)
+  assert.equal(f({ texel: 100 }), 0)
+  // le genou (là où le fondu s'amorce) : texel = 0,6/0,55 = 1,0909…
+  assert.ok(Math.abs(f({ texel: 0.6 / 0.55 }) - 1) < 1e-12)
+  assert.ok(f({ texel: 1.2 }) < 1)
+})
+
+test('④e `grainX` / `grainY` du GLSL sont le JUMEAU EXACT de `coordonneeGrain`', () => {
+  // ⚠️ **C'EST LE TEST DE TRANSCRIPTION.** Le GLSL et le JS sont deux écritures
+  // de la même loi ; deux écritures jumelles finissent par diverger (terrain.js
+  // porte déjà cette cicatrice). Ici elles sont confrontées sur une grille.
+  const fx = loi(affectation('grainX'), ['vLatLon_x', 'vLatLon_y', 'uMetresParDegre', 'mppEcran', 'uGrainParPixel'])
+  const fy = loi(affectation('grainY'), ['vLatLon_x', 'uMetresParDegre', 'mppEcran', 'uGrainParPixel'])
+  // ⚠️ ET LES DEUX COMPOSANTES NE SONT PAS INTERCHANGEABLES : `vLatLon.x` est la
+  // LATITUDE, `vLatLon.y` la LONGITUDE (convention de `globe.js`, posée par
+  // l'attribut `latlon`). Les échanger étirerait le grain à l'envers.
+  assert.ok(affectation('grainX').includes('vLatLon.y'), 'grainX doit lire la LONGITUDE')
+  assert.ok(affectation('grainY').includes('vLatLon.x'), 'grainY doit lire la LATITUDE')
+  for (const lat of [-60, -21.115, 0, 33.7, 70]) {
+    for (const lon of [-179.5, -55, 0, 55.536, 179.9]) {
+      for (const mppEcran of [0.5, 20, 300, 12000]) {
+        const attendu = coordonneeGrain({ lat, lon, mppEcran })
+        const args = {
+          vLatLon_x: lat,
+          vLatLon_y: lon,
+          uMetresParDegre: METRES_PAR_DEGRE,
+          mppEcran,
+          uGrainParPixel: GRAIN_PAR_PIXEL,
+        }
+        const gx = fx(args)
+        const gy = fy(args)
+        const ech = Math.max(1, Math.abs(attendu[0]), Math.abs(attendu[1]))
+        assert.ok(Math.abs(gx - attendu[0]) < 1e-9 * ech, `x lat ${lat} lon ${lon} mpp ${mppEcran}`)
+        assert.ok(Math.abs(gy - attendu[1]) < 1e-9 * ech, `y lat ${lat} lon ${lon} mpp ${mppEcran}`)
+      }
+    }
+  }
+})
+
+test('④f `grainP` bascule sur `uMppFacteur`, et l’ÉTEINT est LE TEXTE DU DÉPÔT', () => {
+  // ⚠️ **LA GARANTIE DE NON-RÉGRESSION DE LA PRODUCTION.** Sans `poserLoiMonde`,
+  // le grain doit être exactement `vUv * 941.7 + vLatLon`, l'expression d'avant
+  // la Tâche K. La vue orbitale de shibumap.com en dépend.
+  const i = GLOBE.indexOf('vec2 grainP = ')
+  assert.ok(i >= 0)
+  const expr = GLOBE.slice(i + 'vec2 grainP = '.length, GLOBE.indexOf(';', i))
+  assert.ok(/uMppFacteur\s*>\s*0\.0\s*\?/.test(expr), 'la bascule doit se faire sur uMppFacteur')
+  assert.ok(/:\s*vUv\s*\*\s*941\.7\s*\+\s*vLatLon\s*$/.test(expr.trim()), `éteint ≠ dépôt : ${expr}`)
+})
+
+test('④g `texelTuile` est, LUI AUSSI, le texte du dépôt, intact', () => {
+  const expr = affectation('texelTuile').replace(/\/\/[^\n]*/g, '').trim()
+  assert.equal(expr, 'max(fwidth(vUv).x, fwidth(vUv).y) * uTilePx')
+})
+
+test('④h LES SIX AUTRES `fwidth` NE SONT PAS TOUCHÉS — l’audit de la tâche', () => {
+  // ⚠️ Le nuanceur porte SEPT `fwidth`. Un seul était en espace-tuile de bout en
+  // bout (`minFade`) ; les six autres mesurent des mètres, des degrés ou une
+  // couverture de côte — des grandeurs de MONDE par pixel d'écran, donc des
+  // largeurs de trait légitimes. Ce test fige le compte : si quelqu'un en ajoute
+  // ou en retire un, la question se rouvre.
+  const iFrag = GLOBE.indexOf('const FRAG')
+  const frag = GLOBE.slice(iFrag, GLOBE.indexOf('\n`\n', iFrag))
+  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS D'ABORD** : ce fichier PARLE de `fwidth`
+  // plusieurs fois. Compter les mentions au lieu des appels aurait fait un test
+  // qui tombe sur une phrase — exactement la mutation de CHAÎNE qu'on refuse.
+  const code = frag.replace(/\/\/[^\n]*/g, ' ')
+  const appels = code.match(/fwidth\s*\(/g) || []
+  const sites = code.split('\n').filter((l) => /fwidth\s*\(/.test(l))
+  // SEPT sites, HUIT appels : `texelTuile` en porte deux (les deux composantes
+  // de `fwidth(vUv)`), et c'est le seul.
+  assert.equal(sites.length, 7, `le nuanceur porte ${sites.length} sites de fwidth, pas 7`)
+  assert.equal(appels.length, 8, `le nuanceur porte ${appels.length} appels à fwidth, pas 8`)
+  assert.equal(sites.filter((l) => (l.match(/fwidth\s*\(/g) || []).length === 2).length, 1)
+  // et celui de la côte garde sa garde par UNIFORME — c'est ce qui rend sa
+  // dérivée définie, et c'est pour ça qu'on ne l'a pas touché.
+  const iCote = code.indexOf('fwidth(landness)')
+  assert.ok(iCote > 0)
+  const avant = code.slice(Math.max(0, iCote - 300), iCote)
+  assert.ok(/uHabOn > 0\.5 && uCoastMaskOn > 0\.5/.test(avant), 'la garde de la côte doit rester un uniforme')
+})
+
+// ══════════ ⑤ LE BRANCHEMENT ═══════════════════════════════════════════════
+
+function globeMinimal() {
+  return new Globe({ radius: 100 })
+}
+
+test('⑤a `poserLoiMonde` écrit les quatre uniformes, et ils sont PARTAGÉS', () => {
+  const g = globeMinimal()
+  assert.equal(g.uniforms.uMppFacteur.value, 0, 'au repos, la loi est retirée')
+  const ok = g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: -21.115 })
+  assert.equal(ok, true)
+  const attendu = loiTextureMonde({ fovDeg: 33, hauteurPx: 731, lat: -21.115 })
+  assert.equal(g.uniforms.uMppFacteur.value, attendu.mppFacteur)
+  assert.equal(g.uniforms.uResRefM.value, attendu.resRefM)
+  assert.equal(g.uniforms.uGrainParPixel.value, attendu.grainParPixel)
+  assert.equal(g.uniforms.uMetresParDegre.value, attendu.metresParDegre)
+})
+
+test('⑤b `retirerLoiMonde` remet 0 — donc le dépôt, au bit près', () => {
+  const g = globeMinimal()
+  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 0 })
+  assert.ok(g.uniforms.uMppFacteur.value > 0)
+  g.retirerLoiMonde()
+  assert.equal(g.uniforms.uMppFacteur.value, 0)
+})
+
+test('⑤c une pose IMPOSSIBLE ne touche à RIEN et le dit', () => {
+  // ⚠️ Un `NaN` posé ici basculerait chaque fragment sur la branche monde avec
+  // une échelle absurde. La pose doit refuser, pas écrire à moitié.
+  const g = globeMinimal()
+  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 0 })
+  const avant = g.uniforms.uMppFacteur.value
+  for (const o of [{ fovDeg: NaN, hauteurPx: 731 }, { fovDeg: 33, hauteurPx: 0 }, {}]) {
+    assert.equal(g.poserLoiMonde(o), false, JSON.stringify(o))
+    assert.equal(g.uniforms.uMppFacteur.value, avant, 'la pose refusée a quand même écrit')
+  }
+})
+
+test('⑤d le matériau de tuile reçoit les uniformes PARTAGÉS, pas une copie', () => {
+  // ⚠️ La leçon de `test/damier-uniformes.test.js` : une poignée cédée à une
+  // variable n'atteint jamais les dalles voisines. Ici la loi est une propriété
+  // du MONDE — si chaque tuile en gardait une copie, elle rementirait par tuile,
+  // c'est-à-dire exactement le défaut que la tâche répare.
+  const g = globeMinimal()
+  const mat = g._materialFor(256)
+  assert.equal(mat.uniforms.uMppFacteur, g.uniforms.uMppFacteur, 'uMppFacteur n’est pas partagé')
+  assert.equal(mat.uniforms.uResRefM, g.uniforms.uResRefM)
+  g.poserLoiMonde({ fovDeg: 33, hauteurPx: 731, lat: 12 })
+  assert.ok(mat.uniforms.uMppFacteur.value > 0, 'la pose n’atteint pas le matériau')
+  // et `uTex`/`uTilePx`, eux, restent PROPRES à la tuile — on ne les a pas cassés
+  assert.notEqual(mat.uniforms.uTilePx, g.uniforms.uTilePx)
+})
+
+test('⑤e `main.js` appelle la loi PAR IMAGE, et avant `globe.update`', () => {
+  // ⚠️ Aucun test de ce dépôt ne charge `main.js` (§0 du plan) : on en vérifie
+  // le TEXTE, comme `test/crop-habillage.test.js` et `test/estompage-terre.test.js`.
+  assert.ok(MAIN.includes('majLoiTextureMonde()'), 'la loi n’est appelée nulle part')
+  const iAppel = MAIN.indexOf('  majLoiTextureMonde()')
+  const iUpdate = MAIN.indexOf('globe.update(camGlobe, dtAmb)')
+  assert.ok(iAppel > 0 && iUpdate > iAppel, 'la loi doit être posée AVANT le dessin du globe')
+})
+
+test('⑤f le fov est LU EN DIRECT sur la caméra, jamais écrit en dur', () => {
+  const i = MAIN.indexOf('function majLoiTextureMonde()')
+  assert.ok(i > 0)
+  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
+  assert.ok(/fovDeg:\s*cam\?\.fov\s*\?\?\s*camera\.fov/.test(corps), `le fov n’est pas lu en direct : ${corps}`)
+  assert.ok(!/fovDeg:\s*\d/.test(corps), 'un fov en dur dans le branchement')
+  assert.ok(!/FOV_DEG/.test(corps), 'le branchement lit la constante au lieu de la caméra vivante')
+})
+
+test('⑤g la hauteur est celle du TAMPON DE DESSIN, pas du CSS', () => {
+  // ⚠️ Sur un écran Retina le tampon fait deux fois la hauteur en points.
+  // `clientHeight` doublerait les mètres par pixel et effacerait les courbes de
+  // niveau sur les seules machines à forte densité.
+  const i = MAIN.indexOf('function majLoiTextureMonde()')
+  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
+  assert.ok(/getDrawingBufferSize/.test(corps), 'la hauteur ne vient pas du tampon de dessin')
+  assert.ok(!/clientHeight|innerHeight/.test(corps))
+})
+
+test('⑤h HORS DRAPEAU, la loi est RETIRÉE — la production ne bouge pas', () => {
+  const i = MAIN.indexOf('function majLoiTextureMonde()')
+  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
+  assert.ok(
+    /if \(!terreUniqueBranchee\) \{ globe\.retirerLoiMonde\(\); return \}/.test(corps),
+    `le garde de drapeau manque ou a changé : ${corps}`
+  )
+})
+
+test('⑤i aucun échafaudage de banc n’est resté dans le nuanceur', () => {
+  // ⚠️ L'Étape 1 a posé quatre uniformes de mesure (`uKminFade`, `uKgrain`,
+  // `uKaa`, `uKcrowd`). Ils ont servi, ils sont partis. Ce test empêche qu'un
+  // prochain tour les réintroduise en douce.
+  for (const nom of ['uKminFade', 'uKgrain', 'uKaa', 'uKcrowd', 'BANC K']) {
+    assert.ok(!GLOBE.includes(nom), `\`${nom}\` est resté dans src/globe.js`)
+  }
+})
