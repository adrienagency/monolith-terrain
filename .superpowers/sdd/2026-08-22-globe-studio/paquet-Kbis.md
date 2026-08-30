d6d6478 tache K bis : l echelle de couleur devient continue, et h == 0 quitte la terre

 package.json                      |   2 +-
 src/globe.js                      | 173 +++++++++++-
 src/main.js                       |  30 ++-
 src/monde/echelle-continue.js     | 355 ++++++++++++++++++++++++
 src/monde/exageration-continue.js |  10 +-
 src/monde/habillage-crop.js       |  19 +-
 test/crop-branche.test.js         |  33 ++-
 test/crop-habillage.test.js       |  65 ++++-
 test/crop-rampe.test.js           |  13 +
 test/echelle-continue.test.js     | 554 ++++++++++++++++++++++++++++++++++++++
 test/mer-sphere.test.js           |   9 +
 11 files changed, 1242 insertions(+), 21 deletions(-)

diff --git a/package.json b/package.json
index fe4d48f..ec900b8 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js",
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
index cf98926..3b97e57 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -23,20 +23,32 @@ import { repereCrop, coinNormalise, zoomCropPrescrit, mercX, mercY } from './mon
 // c'est ce fichier-ci qui en fait une géométrie three.
 import { construireSolideCrop } from './monde/parois-crop.js'
 import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M } from './monde/habillage-crop.js'
 import {
   RAMPE_MONDE,
   PAS_MESURE,
   mesurerRelief,
   echelleRampe,
   plancherRampeDuCrop,
 } from './monde/rampe-crop.js'
+// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. Pur lui aussi : il ne rend que
+// des nombres. ⚠️ **C'EST LUI QUI TIENT LES QUATRE NOMBRES DE RAMPE, ET PLUS
+// `poserRampe`** — les mesures y sont ANCRÉES par cran d'altitude, la valeur
+// posée est celle d'une courbe monotone. Sans ancre, il rend `RAMPE_MONDE` :
+// la production est intouchée au bit près.
+import {
+  creerEchelleContinue,
+  ancrerMesure,
+  majEchelle,
+  lireEchelle,
+  oublierAncres,
+} from './monde/echelle-continue.js'
 // LA MER — Tâche F, « partout et dégradée avec la distance ». Pur lui aussi :
 // il rend des nombres et des tampons, c'est ce fichier-ci qui en fait une
 // géométrie three. ⚠️ **`ocean.js` N'EST PAS IMPORTÉ ICI, ET C'EST DÉLIBÉRÉ** :
 // il tire `ocean-waves` par un ALIAS de Vite, que node ne résout pas — et
 // `test/crop-rampe.test.js` charge `Globe` sous node. Les morceaux de nuanceur
 // partagés arrivent donc par une importation DYNAMIQUE, dans `poserMer`.
 import {
   bordDeMer,
   PORTEE_CROP,
   construireCalotte,
@@ -578,20 +590,24 @@ uniform float uMerRampeOn;
 // ⚠️ LE BUDGET DU FOND N'EST PAS uOceanDepth, ET LE CONFONDRE SE VOIT. La rampe
 // de la Tache D cale uOceanDepth sur la profondeur mesuree du CROP — qui vaut
 // 6 000 m (la valeur MONDIALE) tant que poserRampe est refusee faute de
 // couverture. Le socle, lui, prend l'amplitude de SON champ (uSeaRange). Ce
 // budget-ci vient donc du champ de la calotte, ou il est mesure.
 uniform float uMerFondBudgetM;
 uniform vec3 uOceanShallow;
 uniform vec3 uOceanMid;
 uniform vec3 uOceanDeep;
 uniform float uPlancherRampeM; // garde de division, en metres — voir le module
+// ══════════ LE ZERO DE LA MER — Tache K bis ════════════════════════════════
+// 0 : sousEau vaut h < 0, la production au bit pres. 1 : h <= 0, et le plan de
+// mer cesse de peindre la premiere teinte de terre. Voir le corps du nuanceur.
+uniform float uMerZeroSousEau;
 // côté de la tuile en texels — 256 (AWS) ou 512 (Mapterhorn), voir planTuile
 uniform float uTilePx;
 
 // ══════════ LA LOI DE TEXTURE ANCREE AU MONDE — Tache K ═══════════════════
 //
 // ⚠️ uMppFacteur A 0 : RIEN NE CHANGE. Meme garde et meme raison que uCropOn,
 // uHabOn et uMerRampeOn — la production (la vue orbitale du globe, en ligne sur
 // shibumap.com) rend exactement ce qu'elle rendait, au bit pres, tant que
 // poserLoiMonde n'a pas ete appele. C'est le patron « on elargit sans changer le
 // defaut » (distanceRivage de F, aussi: null de J, le fond de J bis).
@@ -901,21 +917,36 @@ void main() {
   }
 
   // ══════ L'HABILLAGE, POSTES ③ ET ② — Tache C ═══════════════════════════════
   //
   // ⚠️ AVANT LA RAMPE ET AVANT LES COURBES, ET CE N'EST PAS UN RANGEMENT : le
   // grain modifie h, donc la rampe ET les courbes doivent le voir. C'est ce que
   // fait le socle, qui cuit son grain dans la GEOMETRIE : sa couleur et ses
   // courbes le portent parce qu'elles lisent vWorldPos.y. Pose apres, le grain
   // ne serait qu'un bruit de teinte, et les courbes resteraient lisses.
   float landness = 1.0;
-  bool sousEau = h < 0.0;
+  // ══════ h == 0 NE PREND PLUS LA BRANCHE TERRE — Tache K bis ══════════════
+  //
+  // ⚠️ uMerZeroSousEau A 0 : RIEN NE CHANGE. Meme garde et meme raison que
+  // uCropOn, uHabOn, uMerRampeOn et uMppFacteur — la vue orbitale en production
+  // rend exactement ce qu'elle rendait, au bit pres, tant que poserRampe n'a pas
+  // recu zeroSousEau.
+  //
+  // ⚠️ ET LE DEFAUT REPARE EST MESURE, PAS SUPPOSE. h == 0 est la surface de la
+  // mer, c'est-a-dire la valeur la PLUS FREQUENTE du globe. Avec h < 0.0 elle
+  // prend la branche TERRE, donc t = 0,35 exactement, donc uRamp au texel 179 —
+  // LA PREMIERE TEINTE DE TERRE. Releve dans l'application vivante, palette du
+  // jour : rgb(147, 160, 116), un olive vert. Et la mer d'a cote, a h = -1 m,
+  // prend la rampe NAUTIQUE (uMerRampeOn = 1) sur uOceanShallow, un bleu pale.
+  // Un metre d'ecart, deux familles de couleur : c'est le grand aplat vert
+  // qu'Adrien voit au nadir.
+  bool sousEau = uMerZeroSousEau > 0.5 ? h <= 0.0 : h < 0.0;
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
@@ -1627,20 +1658,24 @@ export class Globe {
       uOceanDepth: { value: RAMPE_MONDE.profondeur },
       uLandMax: { value: RAMPE_MONDE.terreHaut },
       uLandBas: { value: RAMPE_MONDE.terreBas },
       uPlancherRampeM: { value: RAMPE_MONDE.plancherM },
       uRamp: { value: null },
       // LA RAMPE NAUTIQUE — Tâche F. ⚠️ `uMerRampeOn: 0` : sans `poserMer`, RIEN
       // NE CHANGE — même garde et même raison que `uCropOn` et `uHabOn`. Les
       // trois couleurs sont celles de `terrain.js:376-378`, au caractère près.
       uMerRampeOn: { value: 0 },
       uMerFondBudgetM: { value: RAMPE_MONDE.profondeur },
+      // LE ZÉRO DE LA MER — Tâche K bis. ⚠️ **`uMerZeroSousEau: 0` : sans
+      // `poserRampe({ zeroSousEau: true })`, RIEN NE CHANGE** — même garde et
+      // même raison que `uCropOn`, `uHabOn`, `uMerRampeOn` et `uMppFacteur`.
+      uMerZeroSousEau: { value: 0 },
       uOceanShallow: { value: new THREE.Color(RAMPE_NAUTIQUE.peu) },
       uOceanMid: { value: new THREE.Color(RAMPE_NAUTIQUE.moyen) },
       uOceanDeep: { value: new THREE.Color(RAMPE_NAUTIQUE.fond) },
       // LE CROP — Tâche A, « UNE SEULE TERRE ». ⚠️ `uCropOn: 0` : sans
       // `poserCrop`, RIEN NE CHANGE. Ces cinq-là sont PARTAGÉS (ils vivent dans
       // `this.uniforms`, que `_materialFor` étale dans chaque matériau) : le
       // crop est une propriété du monde, pas de la tuile — contrairement à
       // `uTex` et `uTilePx`, qui sont propres à chacune.
       // LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K. ⚠️ **`uMppFacteur: 0` :
       // sans `poserLoiMonde`, RIEN NE CHANGE** — même garde et même raison que
@@ -1719,20 +1754,26 @@ export class Globe {
       uFondChamp: { value: null },
       uFondOn: { value: 0 },
       uFondPortee: { value: PORTEE_CROP },
       uFondMetres: { value: 1 },
     }
     // ⚠️ **LE FOND VIT À CÔTÉ DES UNIFORMES, PAS DEDANS** : c'est un
     // `Float32Array` de 148 225 valeurs (593 Kio) que le CPU lit — `posAt` et
     // `hauteurSurface` —, pas une texture. `null` = pas de fond, et toute la
     // chaîne le sait (voir `src/monde/fond-crop.js`).
     this._fondCrop = null
+    // L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. ⚠️ **UN ÉCRIVAIN, N
+    // LECTEURS**, et le repli est `RAMPE_MONDE` : tant que personne n'ancre de
+    // mesure, `lireEchelle` rend l'échelle mondiale et les quatre uniformes
+    // valent ce qu'ils valaient. `poserRampe` et `poserMer` ANCRENT ;
+    // `majEchelleRampe` évalue la courbe et POSE. Personne d'autre n'écrit.
+    this._echelleContinue = creerEchelleContinue(RAMPE_MONDE)
     this._cleFondPosee = ''
     this.rebuildRamp(params)
 
     // ⚠️ `uTilePx` EST PROPRE À LA TUILE, comme `uTex` : deux tuiles voisines
     // peuvent venir de deux sources de tailles différentes (voir `planTuile`).
     // Le mettre dans `this.uniforms`, partagé, aurait fait juger la minification
     // de toutes les tuiles sur la taille de la dernière chargée.
     this._materialFor = (texture, tilePx = 256) =>
       new THREE.ShaderMaterial({
         vertexShader: VERT,
@@ -1820,20 +1861,36 @@ export class Globe {
    *
    * ⚠️ **LE REPÈRE VIENT DE `crop-sphere.js`, QUI LIT `empriseSocle`.** Le globe
    * ne calcule pas l'emprise : il l'applique. Deux producteurs d'emprise, c'est
    * un socle et une découpe qui divergent d'un pixel puis d'un mètre.
    *
    * @param {{centre:{lat:number,lon:number}, zoom?:number, tuilesParBloc?:number,
    *          half?:number, corner?:number, expo?:number}} arg
    */
   poserCrop({ centre, zoom, tuilesParBloc, half = 28, corner = 0, expo = 2 } = {}) {
     const rep = repereCrop({ centre, zoom, tuilesParBloc })
+    // ⚠️ **UN DÉMÉNAGEMENT EFFACE LES ANCRES, UN CRAN DE ZOOM NON — Tâche K
+    // bis.** Les ancres de l'échelle continue disent « à ce lieu, à ce cran
+    // d'altitude, le relief vaut ceci » : les garder après un saut à l'autre
+    // bout du monde peindrait la Corse avec l'amplitude de l'Himalaya. Mais les
+    // EFFACER à chaque cran de zoom rouvrirait exactement le défaut que la
+    // tâche ferme — la re-mesure par saut. Le test est donc géométrique : le
+    // nouveau centre tombe-t-il DANS l'ancien crop, à la plus large des deux
+    // demi-largeurs ? Une descente reste dedans (les deux repères sont
+    // concentriques à la maille de tuile près), un `flyTo` ailleurs en sort.
+    const avant = this._crop
+    if (avant) {
+      const marge = Math.max(avant.demi, rep.demi)
+      if (Math.abs(rep.cx - avant.cx) > marge || Math.abs(rep.cy - avant.cy) > marge) {
+        oublierAncres(this._echelleContinue)
+      }
+    }
     this._crop = rep
     const u = this.uniforms
     u.uCropCentre.value.set(rep.cx, rep.cy)
     u.uCropDemi.value = rep.demi
     u.uCropCoin.value = coinNormalise(corner, half)
     u.uCropCoinN.value = Math.max(2, expo)
     u.uCropOn.value = 1
     // la couverture douce du bord ne veut rien dire sans mélange — Tâche B
     this._melangeCrop(true)
     return rep
@@ -2172,21 +2229,21 @@ export class Globe {
    *
    * @param {object} [arg]
    * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number}} [arg.echelle]
    *   impose l'échelle au lieu de la mesurer (bancs, tests, réglage manuel)
    * @param {number} [arg.pas] finesse du balayage — voir `PAS_MESURE`
    * @param {number} [arg.couvertureMin] ⚠️ **1 par défaut, et c'est le §7 de
    *   `parois-crop.js` appliqué à la rampe** : une tuile manquante rend `null`,
    *   et prendre `null` pour zéro repeindrait tout le crop.
    * @returns {{refus:string|null, echelle:object|null, mesure:object|null}}
    */
-  poserRampe({ echelle = null, pas = PAS_MESURE, couvertureMin = 1 } = {}) {
+  poserRampe({ echelle = null, pas = PAS_MESURE, couvertureMin = 1, altitudeM = null, zeroSousEau = false } = {}) {
     const u = this.uniforms
     let e = echelle
     let mesure = null
     if (!e) {
       if (!this._crop) return { refus: 'crop', echelle: null, mesure: null }
       // ⚠️ LA LISTE EST PRÉ-FILTRÉE UNE FOIS, comme pour les parois : le balayage
       // fait `pas²` points, et reparcourir `this.tiles` (jusqu'à 1 700 entrées)
       // à chacun ferait des dizaines de millions d'itérations.
       const liste = this.tuilesAvecHauteurs()
       mesure = mesurerRelief({
@@ -2196,35 +2253,121 @@ export class Globe {
         pas,
         couvertureMin,
       })
       // ⚠️ **LE REFUS NE TOUCHE PAS À LA RAMPE EN PLACE.** C'est ce qui le rend
       // acceptable : les couleurs précédentes restent à l'écran jusqu'à ce que
       // la donnée arrive, et l'appelant n'a rien à défaire. Même discipline que
       // le refus de couverture des parois.
       if (mesure.refus) return { refus: mesure.refus, echelle: null, mesure }
       e = echelleRampe(mesure, { plancherM: plancherRampeDuCrop(this._crop) })
     }
+    // ⚠️ **LE ZÉRO DE LA MER SUIT LA RAMPE, ET IL EST OPTIONNEL** — Tâche K
+    // bis. `false` par défaut : un appelant qui ne le demande pas retrouve le
+    // globe d'avant au bit près, et les bancs de la Tâche D continuent de poser
+    // une échelle sans changer la couleur du plan de mer.
+    if (zeroSousEau) u.uMerZeroSousEau.value = 1
+
+    // ══════ L'ÉCHELLE CONTINUE — Tâche K bis ═══════════════════════════════
+    //
+    // ⚠️ **AVEC UNE ALTITUDE, LA MESURE N'EST PLUS POSÉE : ELLE EST ANCRÉE.**
+    // C'est toute la tâche. Ce qui atteint les uniformes est la valeur d'une
+    // courbe monotone évaluée à l'altitude de l'image, et `majEchelleRampe` la
+    // réévalue par image — donc l'échelle GLISSE au lieu de sauter.
+    //
+    // ⚠️ **SANS ALTITUDE, LE CHEMIN EST CELUI DU DÉPÔT, AU BIT PRÈS.** Ce n'est
+    // pas une politesse envers les tests : `poserRampe({ echelle })` est le
+    // point d'entrée des bancs et du réglage manuel, et leur imposer un cran
+    // d'altitude leur ferait mesurer autre chose que ce qu'ils demandent.
+    if (Number.isFinite(altitudeM)) {
+      ancrerMesure(this._echelleContinue, altitudeM, e)
+      const v = majEchelle(this._echelleContinue, altitudeM)
+      this._poserUniformesRampe(v)
+      this._rampe = e
+      return { refus: null, echelle: e, mesure, posee: v }
+    }
+
+    this._poserUniformesRampe(e)
+    this._rampe = e
+    return { refus: null, echelle: e, mesure }
+  }
+
+  /**
+   * ⚠️ **LE SEUL SITE QUI ÉCRIT LES QUATRE UNIFORMES DE RAMPE.** Il y en avait
+   * DEUX (`poserRampe` et `retirerRampe`), plus un troisième pour le budget du
+   * fond dans `poserMer` : trois écritures qui pouvaient diverger, et deux
+   * l'avaient déjà fait — c'est le relevé `uOceanDepth = 130,36 m` sous
+   * 2 116,3 m de fond que la Tâche J bis a corrigé par une LISTE de lecteurs.
+   *
+   * ⚠️ **`fondBudget` EST BORNÉ À 1 m COMME AVANT** (`Math.max(profMaxM, 1)`,
+   * ligne d'origine de `poserMer`) : ce n'est pas un plancher neuf, c'est celui
+   * du dépôt, déplacé ici pour qu'il n'y en ait qu'un.
+   */
+  _poserUniformesRampe(e) {
+    const u = this.uniforms
     u.uLandBas.value = e.terreBas
     u.uLandMax.value = e.terreHaut
     u.uOceanDepth.value = e.profondeur
     u.uPlancherRampeM.value = e.plancherM
-    this._rampe = e
-    return { refus: null, echelle: e, mesure }
+    // ⚠️ **LE BUDGET DU FOND NE S'ÉCRIT QUE SI LA RAMPE NAUTIQUE EST ALLUMÉE.**
+    // Éteinte, `uMerFondBudgetM` ne peint rien (le nuanceur le garde derrière
+    // `uMerRampeOn > 0.5`) et `retirerMer` est le seul à devoir le rendre à
+    // `RAMPE_MONDE`. L'écrire ici de toute façon ferait deux écrivains pour un
+    // uniforme éteint — le genre de code mort que ce chantier a trouvé quatre
+    // fois.
+    if (u.uMerRampeOn.value > 0.5 && Number.isFinite(e.fondBudget)) {
+      u.uMerFondBudgetM.value = Math.max(e.fondBudget, 1)
+    }
+  }
+
+  /**
+   * **L'ÉVALUATION PAR IMAGE — Tâche K bis.** Réévalue la courbe à l'altitude
+   * courante et pose les uniformes. Sans ancre, elle rend `RAMPE_MONDE` et
+   * n'écrit donc rien de neuf.
+   *
+   * ⚠️ **ELLE NE MESURE RIEN.** `poserRampe` balaie `pas²` points et ne tourne
+   * qu'à l'arrêt (décision 5) ; celle-ci évalue quatre cubiques et a le droit de
+   * tourner à chaque image. C'est la séparation que la tâche installe : la
+   * MESURE est rare, la POSE est continue.
+   *
+   * ⚠️ **ET ELLE NE FAIT RIEN SANS ANCRE**, donc rien tant que `poserRampe` n'a
+   * pas reçu d'altitude : la production est intouchée au bit près.
+   */
+  majEchelleRampe(altitudeM) {
+    const partage = this._echelleContinue
+    if (!partage || partage.ancres.size === 0) return null
+    const v = majEchelle(partage, altitudeM)
+    this._poserUniformesRampe(v)
+    return v
+  }
+
+  /** L'échelle que le nuanceur porte en ce moment — pour les sondes et les bancs. */
+  echelleRampePosee() {
+    return lireEchelle(this._echelleContinue)
   }
 
   /** Rend la rampe MONDIALE — le globe reprend ses couleurs d'avant, au bit près. */
   retirerRampe() {
     const u = this.uniforms
     u.uLandBas.value = RAMPE_MONDE.terreBas
     u.uLandMax.value = RAMPE_MONDE.terreHaut
     u.uOceanDepth.value = RAMPE_MONDE.profondeur
     u.uPlancherRampeM.value = RAMPE_MONDE.plancherM
+    // ⚠️ **LE ZÉRO DE LA MER S'ÉTEINT AVEC LA RAMPE, ET C'EST LE DÉFAUT C-3 DE
+    // LA TÂCHE C APPLIQUÉ D'AVANCE** : là-bas `retirerHabillage` ne rendait que
+    // quatre uniformes sur seize et la planète entière gardait l'intervalle du
+    // crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles.
+    u.uMerZeroSousEau.value = 0
+    // ⚠️ **LES ANCRES TOMBENT AUSSI.** Sans cela, `majEchelleRampe` les
+    // reposerait à l'image suivante et `retirerRampe` ne retirerait rien — une
+    // méthode qui ment sur ce qu'elle fait. Le lieu, lui, est déjà parti : ce
+    // site n'est appelé que par `retirerCrop`.
+    oublierAncres(this._echelleContinue)
     this._rampe = null
   }
 
   // ═══════════ LA MER — Tâche F, décision 5 ══════════════════════════════════
   //
   // **Adrien, le 2026-08-21 :** « la mer riche est PARTOUT, DÉGRADÉE AVEC LA
   // DISTANCE », et « la mer devra aussi être recalculée ».
   //
   // La mer cesse d'être un plan à hauteur fixe cuit sur une grille plate : elle
   // devient une CALOTTE SPHÉRIQUE au niveau de la mer. La loi vit dans
@@ -2425,21 +2568,41 @@ export class Globe {
       vertexShader: MER_VERT
         .replace('__GERSTNER__', mod.GERSTNER_GLSL)
         .replace('__SHORE_SURF__', mod.SHORE_SURF_GLSL),
       fragmentShader: MER_FRAG,
     })
 
     this.retirerMer()
     // ⚠️ LE FOND MARIN AUSSI, ET C'EST LE MEME GESTE : la mer, ce n'est pas
     // seulement la lame d'eau, c'est le fond qu'on voit au travers.
     u.uMerRampeOn.value = 1
-    u.uMerFondBudgetM.value = Math.max(champ.profMaxM, 1)
+    // ══════ LE BUDGET DU FOND ENTRE PAR LA COURBE — Tâche K bis ═════════════
+    //
+    // ⚠️ **C'EST LUI QUI PEINT LA MER, ET IL BOUGEAIT AUTANT QUE LES AUTRES.**
+    // Relevé sur la descente de La Réunion (`.banc/vues-Kbis/AV-descente.json`) :
+    // 6 000 → 6 228 → 6 028 → 6 028 → **4 415,2 m**. Sur `dMer01`, qui indexe la
+    // rampe nautique, cela déplace la couleur d'une profondeur donnée de
+    // **0,248** au maximum — plus que tout le reste de la mer réuni. Le laisser
+    // hors de la courbe aurait laissé le turquoise d'Adrien intact.
+    //
+    // ⚠️ **ET IL EST ANCRÉ SOUS LA MÊME ALTITUDE QUE LA RAMPE**, pas sous une
+    // seconde : `poserMer` et `poserRampe` reçoivent tous deux `altitudeM` du
+    // MÊME `contexteCrop`, et deux crans qui divergeraient rouvriraient le
+    // désaccord que la Tâche J bis a fermé (`LECTEURS_DU_FOND`).
+    ancrerMesure(this._echelleContinue, altitudeM, {
+      fondBudget: Math.max(champ.profMaxM, 1),
+      plancherM: u.uPlancherRampeM.value,
+    })
+    const _v = majEchelle(this._echelleContinue, altitudeM)
+    u.uMerFondBudgetM.value = Number.isFinite(_v?.fondBudget)
+      ? Math.max(_v.fondBudget, 1)
+      : Math.max(champ.profMaxM, 1)
     if (couleursFond) {
       u.uOceanShallow.value.set(couleursFond.peu ?? RAMPE_NAUTIQUE.peu)
       u.uOceanMid.value.set(couleursFond.moyen ?? RAMPE_NAUTIQUE.moyen)
       u.uOceanDeep.value.set(couleursFond.fond ?? RAMPE_NAUTIQUE.fond)
     }
     const mesh = new THREE.Mesh(geo, mat)
     mesh.name = 'crop-mer'
     mesh.frustumCulled = false // les vagues la déplacent, et elle est immense
     mesh.renderOrder = 18 // le même que la mer du socle
     const M = new THREE.Matrix4().makeBasis(
diff --git a/src/main.js b/src/main.js
index e0a1b29..5d0068a 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4627,21 +4627,36 @@ function majSeuilSocle() {
   // `largeurBlocM()` rend 0 et `altitudeCadrageM()` bascule sur un TOUT AUTRE
   // calcul (`terrain.heightToFeet`, le relief procédural) : c'est l'instant que
   // `entrerEnVol` ouvre en posant `dem = null`. Une altitude d'une autre échelle
   // ferait naître le socle au milieu d'un vol.
   if (modes?.busy || !(largeurBlocM() > 0)) return
   // ⚠️ **SOUS `terre unique`, C'EST LE CROP QUI DÉCIDE, SUR LA MÊME ALTITUDE ET
   // À LA MÊME IMAGE.** Les deux automates portent la même loi (`socleVisible`) ;
   // les faire tourner tous les deux ne changerait rien à l'écran — le bloc plat
   // est éteint pour de bon — mais ferait deux compteurs de bascules pour un seul
   // geste, et c'est exactement le genre d'écart qu'on met des soirées à lire.
-  if (terreUniqueBranchee) { veilleCrop.maj(altitudeCadrageM()); return }
+  if (terreUniqueBranchee) {
+    // ⚠️ **UNE SEULE LECTURE D'ALTITUDE, DEUX CONSOMMATEURS — Tâche K bis.** La
+    // veille du crop et l'échelle de couleur continue doivent décider sur la
+    // MÊME altitude à la MÊME image. Deux appels à `altitudeCadrageM()` seraient
+    // deux valeurs (la caméra bouge entre les deux dans la boucle de rendu ? non
+    // — mais le patron se recopie, et c'est ainsi que naissent les désaccords
+    // que ce chantier a payés trois fois). Une variable, deux lecteurs.
+    const alt = altitudeCadrageM()
+    veilleCrop.maj(alt)
+    // ⚠️ **L'ÉCHELLE GLISSE ICI, ET NULLE PART AILLEURS.** `poserRampe` ANCRE
+    // (à l'arrêt, `pas²` points) ; cet appel-ci ÉVALUE la courbe (quatre
+    // cubiques) et pose les uniformes. Sans ancre il ne fait rien, donc rien
+    // tant que la chaîne du crop n'a pas pris.
+    globe?.majEchelleRampe(alt)
+    return
+  }
   veilleSocle.maj(altitudeCadrageM())
 }
 
 // ══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3 ═══════════
 //
 // « La planète autour du crop se fond progressivement vers le fond à mesure
 // qu'on descend, pour que le bloc se détache. »
 //
 // ⚠️ **C'EST LA TÂCHE QUI REND L'IMAGE JUGEABLE.** Avant elle, poser le crop ne
 // creusait pas un trou dans la planète : il effaçait la planète et gardait le
@@ -4871,20 +4886,33 @@ function contexteCrop() {
   //
   // ⚠️ **IL LIT LE MÊME CHAMP QUE LA MER, ET IL LE LIT PAR LES MÊMES ARGUMENTS.**
   // Ce n'est pas une économie de frappe : la Tâche J a fermé le désaccord entre
   // la mer et le fond du crop, et deux jeux d'arguments qui divergeraient — une
   // portée ici, une autre là — le rouvriraient exactement. On DÉRIVE donc de
   // `ctx.mer` au lieu de recopier, et une mutation qui les désaccorde rougit.
   //
   // ⚠️ **PAS DE `fovDeg` NI D'`altitudeM` ICI** : le fond ne décide d'aucune
   // bascule, il ne fait que cuire un champ sur une emprise. Les lui passer
   // laisserait croire qu'il en dépend.
+  // ══════════ L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis ═══════════════════
+  //
+  // ⚠️ **DÉRIVÉE DE `ctx.mer`, PAS RECOPIÉE**, exactement comme `ctx.fond` juste
+  // dessous et pour la même raison : la rampe, le fond et la mer doivent ancrer
+  // sous le MÊME cran d'altitude. Deux `altitudeCadrageM()` écrits côte à côte
+  // finiraient par diverger, et une échelle ancrée à un cran pendant que le
+  // budget du fond l'est à un autre rouvrirait le désaccord que la Tâche J bis
+  // a fermé.
+  //
+  // ⚠️ **`zeroSousEau: true` EST LE SEUL SITE QUI ALLUME `uMerZeroSousEau`.**
+  // Hors `?terre=unique` ce contexte n'existe pas, donc l'uniforme reste à 0 et
+  // la vue orbitale en production rend son plan de mer comme avant, au bit près.
+  ctx.rampe = { altitudeM: ctx.mer.altitudeM, zeroSousEau: true }
   ctx.fond = {
     remplir: ctx.mer.remplir,
     portee: ctx.mer.portee,
     couvertureMin: ctx.mer.couvertureMin,
     exigerBathy: ctx.mer.exigerBathy,
   }
   return ctx
 }
 
 // ⚠️ **`globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR.** Il est assigné
diff --git a/src/monde/echelle-continue.js b/src/monde/echelle-continue.js
new file mode 100644
index 0000000..05e3b33
--- /dev/null
+++ b/src/monde/echelle-continue.js
@@ -0,0 +1,355 @@
+// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
+// (`test/echelle-continue.test.js`). Il n'importe qu'UNE chose : les pentes de
+// Fritsch–Carlson d'`exageration-continue.js` — voir le §5.
+//
+// ══════════ 0. CE QU'ADRIEN VOIT, ET LES QUATRE NOMBRES QUI LE FONT ════════
+//
+// > « On dirait qu'il y a plein de façons de traiter l'affichage de la terre…
+// >   la mer est bleu profond, puis clair, puis verte. On ne peut pas conserver
+// >   une texture unique à tous les niveaux ? »
+//
+// ⚠️ **CE N'EST PAS UNE IMPRESSION : C'EST UN RELEVÉ.** La Réunion, descente
+// ORB → Z4 → Z6 → Z9 → Z11 → Z13 dans l'application vivante, `fov` lu en direct
+// à 33, drapeau levé. Données brutes : `.banc/vues-Kbis/AV-descente.json`,
+// dépouillées par `.banc/bilan-Kbis.mjs` :
+//
+//   station   altitude    uLandBas  uLandMax  uOceanDepth  uMerFondBudgetM
+//   ORB       3 000 000 m     0,0    2 584,4     2 106,771         3 510,5
+//   Z4          189 119 m     0,0    5 600,0     6 000,000         6 000,0
+//   Z6           26 720 m     0,0    2 457,3     5 639,500         6 228,0
+//   Z9            6 339 m     0,0    2 848,8     4 913,000         6 028,0
+//   Z11           8 001 m     0,0    3 005,5     1 827,149         6 028,0
+//   Z13           9 564 m   533,7    3 057,2         0,009         4 415,2
+//
+// ⛔ **AUCUNE DES QUATRE COLONNES N'EST MONOTONE, ET DEUX S'EFFONDRENT.**
+//   · `uOceanDepth` tombe de 6 000 m à **9 millimètres** : au crop de Z13 il n'y
+//     a plus un seul point sous le niveau de la mer, donc `echelleRampe` rend le
+//     PLANCHER de division. Toute la mer sature alors sur le premier texel.
+//   · `uLandMax` fait 5 600 → 2 457 → 2 849 → 3 006 → 3 057 : il DESCEND puis
+//     REMONTE. Une même altitude de terrain change de teinte dans les deux sens.
+//   · `uLandBas` saute de 0 à 533,7 m au dernier cran : le crop de Z13 n'a plus
+//     de littoral, son point de terre le plus bas est à 534 m, et **tout ce qui
+//     est en dessous s'écrase sur la première teinte de terre — le vert.**
+//
+// **Écart maximal mesuré AVANT, pour une hauteur physique DONNÉE** (même
+// dépouillement) : `t` (rampe hypsométrique `uRamp`) **0,3499 — 179 texels sur
+// 512** ; `dMer01` (rampe nautique) **0,2480**. ⚠️ Ce sont DEUX MONNAIES : la
+// première indexe une table de 512 couleurs, la seconde interpole trois couleurs
+// en linéaire. **On ne les additionne jamais**, et le rapport les tient séparées.
+//
+// ══════════ 1. LA SORTIE N'EST NI L'ÉCHELLE FIGÉE NI LA RE-MESURE ══════════
+//
+// ⚠️ **REVENIR À L'ÉCHELLE MONDIALE FIGÉE SERAIT UNE RÉGRESSION DÉJÀ MESURÉE ET
+// DÉJÀ REJETÉE.** La Tâche C l'a chiffrée : sous la rampe mondiale (5 600 m),
+// La Réunion n'occupe que **163 texels sur 512** et le crop rend « une masse
+// plate et orange » ; la rampe locale en occupe **368, soit ×2,26**.
+//
+// Et l'inverse — re-mesurer à chaque pose — est ce qui produit la table du §0.
+//
+// **La troisième voie : l'échelle est une COURBE CONTINUE DE L'ALTITUDE.** Les
+// mesures ne sont plus POSÉES, elles sont ANCRÉES ; ce que le nuanceur reçoit
+// est la valeur de la courbe à l'altitude de l'image.
+//
+// ══════════ 2. LE CRAN — ET IL N'EST PAS INVENTÉ ═══════════════════════════
+//
+// L'abscisse de la courbe est **`log2(altitude en mètres)`**, et le pas d'ancrage
+// est **1**, c'est-à-dire un facteur 2 d'altitude.
+//
+// ⚠️ **CE PAS VIENT DU DÉPÔT, PAS DE MON INSTINCT.** Toute la descente de
+// ShibuMap est GÉOMÉTRIQUE de raison 2 : `STEP_IN = STEP_OUT = Math.LN2`
+// (`modes.js:171-172`), et `PAS_NIVEAU = Math.LN2` d'`exageration-continue.js`
+// le redit — « un niveau vaut un facteur 2 ». Un cran de la courbe est donc un
+// cran de l'escalier d'Adrien, pas une subdivision de plus.
+//
+// ⚠️ **ET C'EST CE QUI FAIT TENIR LE CRITÈRE D'ADRIEN LÀ OÙ IL REGARDE.** Les
+// trois stations profondes du relevé — Z9, Z11, Z13 — sont à **6 339, 8 001 et
+// 9 564 m**, c'est-à-dire `log2` = 12,63 / 12,97 / 13,22 : **le MÊME cran 13**.
+// Elles partagent donc UNE ancre, et la même profondeur physique y rend
+// EXACTEMENT la même couleur. Ce n'est pas une coïncidence heureuse — c'est ce
+// que « une ancre par facteur 2 d'altitude » veut dire sur un escalier de
+// raison 2 : trois crans de zoom consécutifs tiennent dans un facteur 2
+// d'altitude parce que la caméra ne redescend pas d'autant qu'elle zoome.
+//
+// ══════════ 3. UNE ANCRE S'ÉCRIT UNE FOIS — ET C'EST LA PROPRIÉTÉ ══════════
+//
+// ⚠️ **UN CRAN DÉJÀ MESURÉ GARDE SA VALEUR.** Sans cette règle, redescendre au
+// même endroit rendrait une autre couleur qu'à la descente précédente, et la
+// « re-mesure par saut » serait simplement déguisée en courbe.
+//
+// ⚠️ **ET LA PREMIÈRE VISITE D'UN CRAN NEUF DÉPLACE ENCORE LA COURBE. JE NE LE
+// CACHE PAS** : c'est le résidu de cette loi, il est mesuré et écrit dans le
+// compte rendu. On ne peut pas connaître le relief d'un lieu avant de l'avoir
+// mesuré ; ce qu'on peut, c'est ne le mesurer qu'une fois par facteur 2.
+//
+// ══════════ 4. UNE MESURE DÉGÉNÉRÉE N'EST PAS UNE ANCRE ════════════════════
+//
+// ⛔ **LE `0,009` DU §0 EST UN « JE NE SAIS PAS », PAS UN « LA MER EST PLATE ».**
+// `echelleRampe` rend `profondeur = max(-min(0, minM), plancher)` : quand aucun
+// point du crop n'est sous le niveau de la mer, elle rend le PLANCHER DE
+// DIVISION. C'est exactement la doctrine que `mesurerRelief` porte déjà pour la
+// couverture — « prendre `null` pour zéro, c'est prendre "je ne sais pas" pour
+// "niveau de la mer" » — appliquée au contenu au lieu de la couverture.
+//
+// **Un champ dont la mesure est dégénérée n'est donc pas ancré du tout** : la
+// courbe prolonge ses voisins, et l'échelle de mer d'un crop alpin reste celle
+// que la mer avait quand on la voyait encore.
+//
+// ══════════ 5. POURQUOI FRITSCH–CARLSON, ET POURQUOI IMPORTÉ ═══════════════
+//
+// La forme est celle d'`exageration-continue.js` — cubique monotone par
+// morceaux, C¹, **sans dépassement** : entre deux ancres la courbe reste entre
+// leurs valeurs. Un `smoothstep` annulerait la pente à chaque ancre, donc
+// rendrait un escalier ADOUCI ; du linéaire casserait la pente à chaque ancre.
+//
+// ⚠️ **LES PENTES SONT IMPORTÉES, PAS RECOPIÉES.** « Une constante dupliquée
+// diverge en silence » (§1 de `/threejs-optimisation`) vaut aussi pour un
+// algorithme : `pentesMonotones` est écrit UNE fois dans ce dépôt, dans
+// `exageration-continue.js`, avec sa correction d'extremum que son propre test a
+// attrapée. Le recopier ici aurait fait deux Fritsch–Carlson à maintenir.
+// ⚠️ Et cette importation ne casse pas la règle d'`exageration-continue.js` :
+// **c'est LUI qui n'importe rien** (cycle `terrain.js`), pas ses lecteurs.
+//
+// ══════════ 6. LE MÉLANGE SE FAIT EN `log1p`, ET C'EST MOTIVÉ ══════════════
+//
+// Les quatre nombres sont des MÈTRES POSITIFS OU NULS, et trois d'entre eux sont
+// des ÉCHELLES (`terreHaut`, `profondeur`, `fondBudget`) : entre 1 000 et 4 000,
+// le milieu qui a un sens est 2 000, pas 2 500 — un facteur 2 vers le haut et un
+// facteur 2 vers le bas doivent se valoir. C'est la moyenne GÉOMÉTRIQUE.
+//
+// ⚠️ **`log1p` ET PAS `log` : PARCE QUE ZÉRO EXISTE.** `terreBas` vaut 0 sur
+// tout crop littoral, `terreHaut` vaut 0 sur un crop entièrement en mer, et
+// `log(0)` est `-Infinity` — un `NaN` posé dans un uniforme, c'est-à-dire une
+// comparaison FAUSSE dans le nuanceur, c'est-à-dire le contraire du but (le
+// §« écrêtage de Mercator » de `globe.js` dit où cela mène). `log1p` est défini
+// en 0, strictement croissant, et vaut `log` à un cheveu près dès la centaine de
+// mètres : à 1 000 m l'écart relatif est de **1,4·10⁻⁴**.
+
+import { pentesMonotones } from './exageration-continue.js'
+
+// ══════════ ① LES CHAMPS, ET CE QU'ILS PILOTENT ════════════════════════════
+
+/**
+ * Les quatre nombres qui décident de la couleur d'une hauteur.
+ *
+ * ⚠️ **`fondBudget` EST DE LA PARTIE, ET LE CONFONDRE AVEC `profondeur` SE VOIT.**
+ * `globe.js` le dit déjà (§ « LE BUDGET DU FOND N'EST PAS uOceanDepth ») :
+ * `uOceanDepth` indexe la table `uRamp`, `uMerFondBudgetM` indexe la rampe
+ * NAUTIQUE à trois couleurs — et c'est la NAUTIQUE qui peint le fond dès que
+ * `poserMer` a pris (`uMerRampeOn = 1`). Le relevé du §0 mesure les deux, et le
+ * `dMer01` de la seconde bouge de **0,248** sur la descente : la laisser hors de
+ * la courbe aurait laissé l'essentiel de la couleur de mer dehors.
+ */
+export const CHAMPS = Object.freeze(['terreBas', 'terreHaut', 'profondeur', 'fondBudget'])
+
+// ══════════ ② LE CRAN ══════════════════════════════════════════════════════
+
+/**
+ * Le cran RÉEL d'une altitude — `log2(mètres)`. Non arrondi : c'est l'abscisse
+ * de la courbe. `NaN` sur une altitude inutilisable, et l'appelant garde alors
+ * ce qu'il avait (même contrat que `socleVisible`).
+ */
+export function cranReel(altitudeM) {
+  const a = Number(altitudeM)
+  if (!(a > 0)) return NaN
+  return Math.log2(a)
+}
+
+/** Le cran ENTIER — celui sous lequel une mesure est rangée. */
+export function cranAncre(altitudeM) {
+  const c = cranReel(altitudeM)
+  return Number.isFinite(c) ? Math.round(c) : NaN
+}
+
+// ══════════ ③ CE QU'UNE MESURE DIT, ET CE QU'ELLE NE DIT PAS ═══════════════
+
+/**
+ * Quels champs d'une mesure sont EXPLOITABLES — voir le §4.
+ *
+ * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number,fondBudget?:number}} e
+ * @returns {{terreBas:boolean,terreHaut:boolean,profondeur:boolean,fondBudget:boolean}}
+ */
+export function champsUtiles(e) {
+  const p = Number.isFinite(e?.plancherM) && e.plancherM > 0 ? e.plancherM : 0
+  const fini = (v) => Number.isFinite(v)
+  // ⚠️ **LE PLANCHER EST LA FRONTIÈRE, ET IL EST STRICT.** `echelleRampe` rend
+  // EXACTEMENT `plancherM` quand elle n'a rien vu ; une mesure qui vaut le
+  // plancher est donc muette, pas plate.
+  const terre = fini(e?.terreBas) && fini(e?.terreHaut) && e.terreHaut > e.terreBas + p
+  return {
+    terreBas: terre,
+    terreHaut: terre,
+    profondeur: fini(e?.profondeur) && e.profondeur > p,
+    fondBudget: fini(e?.fondBudget) && e.fondBudget > p,
+  }
+}
+
+// ══════════ ④ LE PARTAGE — UN ÉCRIVAIN, N LECTEURS ═════════════════════════
+
+/**
+ * ⚠️ **LA RAMPE, LA MER ET LE FOND DOIVENT LIRE LA MÊME ÉCHELLE AU MÊME
+ * INSTANT**, exactement comme l'exagération de la Tâche E. C'est la famille de
+ * défauts déjà payée trois fois ici : une valeur écrite d'un côté, jamais
+ * transmise à l'autre. `poserRampe` et `poserMer` écrivent tous les deux, à des
+ * moments différents, dans des uniformes que TOUTES les tuiles partagent.
+ *
+ * @param {{terreBas:number,terreHaut:number,profondeur:number,plancherM:number}} monde
+ *   l'échelle de repli — `RAMPE_MONDE`. ⚠️ **PASSÉE, PAS RECOPIÉE** : elle est
+ *   nommée une seule fois dans ce dépôt (`rampe-crop.js`), et ce module n'a pas
+ *   à en faire une seconde copie.
+ */
+export function creerEchelleContinue(monde) {
+  const m = monde || {}
+  const repli = {
+    terreBas: Number.isFinite(m.terreBas) ? m.terreBas : 0,
+    terreHaut: Number.isFinite(m.terreHaut) ? m.terreHaut : 0,
+    profondeur: Number.isFinite(m.profondeur) ? m.profondeur : 0,
+    fondBudget: Number.isFinite(m.fondBudget) ? m.fondBudget : (Number.isFinite(m.profondeur) ? m.profondeur : 0),
+    plancherM: Number.isFinite(m.plancherM) ? m.plancherM : 0,
+  }
+  return {
+    monde: repli,
+    /** `Map<cranEntier, {champ: valeur}>` — les mesures retenues. */
+    ancres: new Map(),
+    /** Le plancher de division de la DERNIÈRE mesure ancrée. */
+    plancherM: repli.plancherM,
+    /** La valeur courante — ce que les lecteurs prennent. */
+    valeur: { ...repli },
+    altitudeM: null,
+    cran: null,
+  }
+}
+
+/**
+ * Range une mesure sous son cran. **Une ancre par cran et par champ, écrite une
+ * seule fois** (§3) ; un champ dégénéré n'est pas rangé du tout (§4).
+ *
+ * @returns {string[]} les champs RÉELLEMENT ancrés par cet appel — vide si rien
+ *   n'a bougé. C'est ce que les tests et les bancs lisent.
+ */
+export function ancrerMesure(partage, altitudeM, mesure) {
+  const k = cranAncre(altitudeM)
+  if (!Number.isFinite(k) || !mesure) return []
+  const utile = champsUtiles(mesure)
+  const place = partage.ancres.get(k) || {}
+  const poses = []
+  for (const c of CHAMPS) {
+    if (!utile[c]) continue
+    if (Number.isFinite(place[c])) continue // déjà mesuré à ce cran — il garde sa valeur
+    place[c] = Number(mesure[c])
+    poses.push(c)
+  }
+  if (poses.length) {
+    partage.ancres.set(k, place)
+    if (Number.isFinite(mesure.plancherM)) partage.plancherM = mesure.plancherM
+  }
+  return poses
+}
+
+/** Oublie tout — le lieu a changé, ses mesures ne veulent plus rien dire. */
+export function oublierAncres(partage) {
+  partage.ancres.clear()
+  partage.valeur = { ...partage.monde }
+  partage.altitudeM = null
+  partage.cran = null
+}
+
+// ══════════ ⑤ LA COURBE ════════════════════════════════════════════════════
+
+const log1p = Math.log1p
+const expm1 = Math.expm1
+
+/**
+ * La courbe d'UN champ, évaluée au cran réel `x`.
+ *
+ * ⚠️ **LES TROUS SONT COMBLÉS EN LINÉAIRE `log1p` AVANT FRITSCH–CARLSON**, et
+ * pas après : les pentes monotones supposent un pas RÉGULIER (c'est le contrat
+ * de `pentesMonotones`, écrit pour un pas de 1 zoom). Une grille à trous les
+ * rendrait fausses en silence — le genre de faute que le §0 du plan appelle
+ * « une assertion qui se rejoue contre le dépôt ».
+ *
+ * ⚠️ **ET AUX DEUX BOUTS, LA COURBE EST PLATE.** Au-delà du cran le plus haut
+ * ancré et en deçà du plus bas, on rend la valeur du bout — jamais une
+ * extrapolation. Extrapoler une échelle de couleur sur un cran jamais visité,
+ * c'est inventer un relief.
+ */
+export function valeurChamp(partage, champ, cranX) {
+  const pts = []
+  for (const [k, v] of partage.ancres) {
+    if (Number.isFinite(v?.[champ])) pts.push([k, v[champ]])
+  }
+  if (!pts.length) return partage.monde[champ]
+  pts.sort((a, b) => a[0] - b[0])
+  if (pts.length === 1) return pts[0][1]
+  const k0 = pts[0][0]
+  const k1 = pts[pts.length - 1][0]
+  const x = Number(cranX)
+  if (!Number.isFinite(x)) return partage.monde[champ]
+  if (x <= k0) return pts[0][1]
+  if (x >= k1) return pts[pts.length - 1][1]
+  // la grille pleine, en log1p, trous comblés en linéaire
+  const n = k1 - k0
+  const ys = new Array(n + 1)
+  let i = 0
+  for (let k = k0; k <= k1; k++) {
+    while (i < pts.length - 1 && pts[i + 1][0] <= k) i++
+    if (pts[i][0] === k) { ys[k - k0] = log1p(Math.max(0, pts[i][1])); continue }
+    const [ka, va] = pts[i]
+    const [kb, vb] = pts[i + 1]
+    const t = (k - ka) / (kb - ka)
+    ys[k - k0] = log1p(Math.max(0, va)) + (log1p(Math.max(0, vb)) - log1p(Math.max(0, va))) * t
+  }
+  const p = pentesMonotones(ys)
+  const j = Math.min(n - 1, Math.max(0, Math.floor(x - k0)))
+  const t = x - k0 - j
+  const t2 = t * t
+  const t3 = t2 * t
+  const h00 = 2 * t3 - 3 * t2 + 1
+  const h10 = t3 - 2 * t2 + t
+  const h01 = -2 * t3 + 3 * t2
+  const h11 = t3 - t2
+  const y = h00 * ys[j] + h10 * p[j] + h01 * ys[j + 1] + h11 * p[j + 1]
+  return Math.max(0, expm1(y))
+}
+
+/**
+ * **L'UNIQUE ÉCRIVAIN.** Évalue les quatre champs à cette altitude et pose la
+ * valeur partagée.
+ *
+ * ⚠️ **IL NE MESURE RIEN, ET C'EST TOUTE LA TÂCHE.** La mesure entre par
+ * `ancrerMesure`, à l'arrêt ; celui-ci ne fait qu'évaluer une courbe — huit
+ * opérations par champ, et il a le droit de tourner par image.
+ *
+ * ⚠️ **`terreHaut` NE PEUT PAS PASSER SOUS `terreBas`.** Les deux champs sont
+ * interpolés séparément et rien ne le garantit : deux ancres où `terreBas` monte
+ * plus vite que `terreHaut` rendraient une amplitude NÉGATIVE, donc un `t` qui
+ * s'inverse. Le nuanceur, lui, borne déjà par `max(…, uPlancherRampeM)` ; on
+ * borne ici aussi pour que la loi JS et le nuanceur disent la même chose.
+ */
+export function majEchelle(partage, altitudeM) {
+  const x = cranReel(altitudeM)
+  if (!Number.isFinite(x)) return partage.valeur
+  const v = {
+    terreBas: valeurChamp(partage, 'terreBas', x),
+    terreHaut: valeurChamp(partage, 'terreHaut', x),
+    profondeur: valeurChamp(partage, 'profondeur', x),
+    fondBudget: valeurChamp(partage, 'fondBudget', x),
+    plancherM: partage.plancherM,
+  }
+  const p = v.plancherM > 0 ? v.plancherM : 0
+  v.terreHaut = Math.max(v.terreHaut, v.terreBas + p)
+  partage.valeur = v
+  partage.altitudeM = Number(altitudeM)
+  partage.cran = x
+  return v
+}
+
+/**
+ * **LE SEUL LECTEUR AUTORISÉ.** Rend l'échelle courante — jamais recalculée par
+ * un lecteur, qui n'a pas les ancres.
+ */
+export function lireEchelle(partage) {
+  return partage?.valeur ?? null
+}
diff --git a/src/monde/exageration-continue.js b/src/monde/exageration-continue.js
index a68068c..def2240 100644
--- a/src/monde/exageration-continue.js
+++ b/src/monde/exageration-continue.js
@@ -100,22 +100,30 @@ export function exagPalier (zoom, { surcharges = null, ancres = EXAG_ANCRES, bas
  * Les pentes de Fritsch–Carlson : une interpolation cubique **monotone par
  * morceaux**, donc SANS DÉPASSEMENT.
  *
  * ⚠️ **POURQUOI PAS UN `smoothstep`, ET POURQUOI PAS DU LINÉAIRE.** Le linéaire
  * passe par les ancres mais casse la PENTE à chacune : la vitesse de
  * l'exagération saute, et c'est encore un cran, plus petit. Le `smoothstep`
  * annule la pente à chaque ancre — donc il rend un escalier ADOUCI, ce qui est
  * exactement ce que la décision 14 refuse. Fritsch–Carlson est C¹, passe
  * exactement par les ancres, et ne peut pas dépasser : entre 2,5 et 5 la courbe
  * reste dans [2,5 ; 5], ce qu'un Catmull-Rom nu ne garantit pas.
+ *
+ * ⚠️ **EXPORTÉE POUR LA TÂCHE K bis, ET C'EST POUR NE PAS L'ÉCRIRE DEUX FOIS.**
+ * `src/monde/echelle-continue.js` a besoin de la MÊME cubique monotone pour son
+ * échelle de couleur ; la recopier aurait fait deux Fritsch–Carlson à maintenir,
+ * dont un sans la correction d'extremum ci-dessous — celle qu'un test a
+ * attrapée. ⚠️ **Ce fichier, lui, n'importe toujours RIEN** : la règle porte sur
+ * ce qu'il IMPORTE, pas sur qui le lit, et le test qui la garde le vérifie bien
+ * dans ce sens-là.
  */
-function pentesMonotones (ys) {
+export function pentesMonotones (ys) {
   const m = ys.length
   const d = new Array(m - 1)
   for (let i = 0; i < m - 1; i++) d[i] = ys[i + 1] - ys[i] // pas = 1 zoom
   const p = new Array(m)
   p[0] = d[0]
   p[m - 1] = d[m - 2]
   for (let i = 1; i < m - 1; i++) p[i] = (d[i - 1] + d[i]) / 2
   // ⚠️ **L'ÉTAPE QUE J'AVAIS SAUTÉE, ET LE TEST L'A ATTRAPÉE** : à un EXTREMUM
   // local, la pente doit être annulée. Sans elle la courbe montait à **5,000746
   // à z = 5,001** — au-dessus de l'ancre la plus haute, alors qu'aucune ancre ne
diff --git a/src/monde/habillage-crop.js b/src/monde/habillage-crop.js
index 3e1783f..b37b593 100644
--- a/src/monde/habillage-crop.js
+++ b/src/monde/habillage-crop.js
@@ -212,23 +212,38 @@ export function margeCoteDuCrop(repere, exageration = EXAG_SOCLE_NOMINALE) {
  * transcrite en mètres.
  *
  * ⚠️ **LE MASQUE DÉCIDE, LA HAUTEUR NE FAIT QUE L'EMPÊCHER DE MENTIR.** C'est le
  * correctif v42 de `terrain.js` : « le masque côtier ne peut JAMAIS déclarer
  * sous-marine une terre au-dessus du niveau de la mer » — la rampe océan se
  * peignait sur des montagnes quand le masque était faux (retour Adrien).
  *
  * ⚠️ **ET SANS MASQUE, ON RETOMBE EXACTEMENT SUR LE PRÉDICAT DU GLOBE
  * D'AUJOURD'HUI (`h < 0`), PAS SUR UN TROISIÈME COMPORTEMENT.** Un poste éteint
  * doit rendre l'image d'avant, sinon la mutation qui l'éteint ne prouve rien.
+ *
+ * ══════════ `zeroSousEau` — TÂCHE K bis, ET IL EST À `false` PAR DÉFAUT ══════
+ *
+ * ⛔ **`h == 0` PRENAIT LA BRANCHE TERRE, ET C'EST LE GRAND APLAT VERT.** Zéro
+ * est la hauteur la PLUS FRÉQUENTE du globe — c'est la surface de la mer. Avec
+ * `h < 0`, elle rend `t = 0,35` exactement, c'est-à-dire le premier texel de
+ * TERRE de `uRamp` : relevé dans l'application vivante, texel 179 sur 512,
+ * `rgb(147, 160, 116)`, un olive vert. Et le fragment d'à côté, à `h = −1 m`,
+ * passe par la rampe NAUTIQUE et rend un bleu pâle. **Un mètre d'écart, deux
+ * familles de couleur.**
+ *
+ * ⚠️ **AVEC LE MASQUE ACTIF, RIEN NE CHANGE, ET CE N'EST PAS UN OUBLI** : la
+ * branche du masque compare déjà `hM < margeM` avec `margeM > 0`, donc `h == 0`
+ * y est DÉJÀ sous l'eau quand le masque dit « mer ». Le défaut ne vivait que
+ * dans le prédicat de repli.
  */
-export function sousEauCrop({ masqueActif, landness, hM, margeM }) {
-  if (!masqueActif) return hM < 0
+export function sousEauCrop({ masqueActif, landness, hM, margeM, zeroSousEau = false }) {
+  if (!masqueActif) return zeroSousEau ? hM <= 0 : hM < 0
   return landness < 0.5 && hM < margeM
 }
 
 // ══════════ ③ LE GRAIN — et il appartient AU SOL, pas à l'écran ═════════════
 
 /**
  * Le bruit de valeur du dépôt — `mnHash` / `mnNoise` de `terrain.js:459`, mot
  * pour mot, en JS.
  *
  * ⚠️ **CE N'EST PAS UNE SECONDE LOI DE BRUIT, ET C'EST TOUT L'ENJEU.** Deux
diff --git a/test/crop-branche.test.js b/test/crop-branche.test.js
index 8fe8bd3..e285506 100644
--- a/test/crop-branche.test.js
+++ b/test/crop-branche.test.js
@@ -604,26 +604,51 @@ test('⑦ bis `terreUniqueActive()` EXIGE la frontière de rendu', async () => {
   }
 })
 
 // ══════════ ⑧ LE CÂBLAGE DE `main.js` — LU, PAS CHARGÉ ══════════════════════
 
 test('⑧ `main.js` importe le drapeau et la veille du crop', () => {
   assert.match(SRC_MAIN, /import\s*\{[^}]*terreUniqueActive[^}]*\}\s*from\s*'\.\/flags\.js'/)
   assert.match(SRC_MAIN, /import\s*\{[^}]*creerVeilleCrop[^}]*\}\s*from\s*'\.\/monde\/branchement-crop\.js'/)
 })
 
-test('⑧ bis la veille du crop est nourrie par `altitudeCadrageM()`, et par elle seule', () => {
+test('⑧ bis la veille du crop ET l’échelle de couleur lisent LA MÊME altitude', () => {
   // ⚠️ **RÈGLE R1**, et c'est la seule chose que ce fichier ne peut pas prouver
   // autrement : `altitudeCadrageM()` est l'instrument SANS `dem.meanM`.
-  assert.match(SRC_MAIN, /veilleCrop\.maj\(\s*altitudeCadrageM\(\)\s*\)/)
-  const appels = SRC_MAIN.match(/veilleCrop\.maj\(/g) || []
-  assert.equal(appels.length, 1, 'un seul point d’alimentation, sinon deux lois')
+  //
+  // ⚠️ **ET DEPUIS LA TÂCHE K bis IL Y A DEUX CONSOMMATEURS**, donc la question
+  // n'est plus seulement « lit-on le bon instrument » mais « les deux
+  // lisent-ils LA MÊME VALEUR à LA MÊME IMAGE ». Deux appels à
+  // `altitudeCadrageM()` côte à côte seraient verts sur l'ancienne assertion et
+  // rouvriraient exactement le désaccord que ce chantier a payé trois fois.
+  const i = SRC_MAIN.indexOf('function majSeuilSocle()')
+  assert.ok(i > 0)
+  const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
+  const m = corps.match(/const (\w+) = altitudeCadrageM\(\)/)
+  assert.ok(m, 'l’altitude doit être lue UNE fois, dans une variable')
+  const v = m[1]
+  assert.match(corps, new RegExp('veilleCrop\\.maj\\(' + v + '\\)'),
+    'la veille du crop doit recevoir la variable, pas une seconde lecture')
+  assert.match(corps, new RegExp('majEchelleRampe\\(' + v + '\\)'),
+    'l’échelle de couleur doit recevoir LA MÊME variable')
+  // un seul point d'alimentation pour chacun, sinon deux lois
+  assert.equal((SRC_MAIN.match(/veilleCrop\.maj\(/g) || []).length, 1)
+  assert.equal((SRC_MAIN.match(/majEchelleRampe\(/g) || []).length, 1)
+  // ⚠️ **ET LA BRANCHE `terre unique` NE LIT L'INSTRUMENT QU'UNE FOIS.** On
+  // retire les commentaires avant de compter — le corps en cite le nom, et une
+  // assertion qui compterait les citations serait rouge sur une correction de
+  // prose et verte sur une seconde lecture. (L'autre appel du corps est celui
+  // de `veilleSocle`, le chemin SANS drapeau, qui n'est pas de cette tâche.)
+  const code = corps.replace(/\/\/[^\n]*/g, '')
+  const branche = code.slice(code.indexOf('if (terreUniqueBranchee)'), code.indexOf('veilleSocle.maj('))
+  assert.equal((branche.match(/altitudeCadrageM\(\)/g) || []).length, 1,
+    'la branche `terre unique` doit lire l’altitude UNE seule fois')
 })
 
 test('⑧ ter le crop se décide APRÈS `modes.update` et AVANT le dessin', () => {
   const iTick = SRC_MAIN.indexOf('\nfunction tick() {')
   assert.ok(iTick > 0)
   const iModes = SRC_MAIN.indexOf('modes.update(dt)', iTick)
   const iSeuil = SRC_MAIN.indexOf('majSeuilSocle()', iTick)
   const iRender = SRC_MAIN.indexOf('composer.render(dtAmb)', iTick)
   assert.ok(iModes > 0 && iSeuil > iModes && iRender > iSeuil)
   // et `majSeuilSocle` est bien le porteur des deux décisions
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index d76ea6e..255629f 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -291,31 +291,71 @@ test('⑤ le masque décide, mais il ne peut JAMAIS noyer une terre au-dessus de
   // choisi) se peignait sur des montagnes quand le masque était faux » (retour
   // Adrien). Un masque à 0 (mer) sur un sommet à 2 000 m ne doit rien noyer.
   assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 2000, margeM: 1.33 }), false)
   assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 1.32, margeM: 1.33 }), true)
   // et l'inverse : une lagune à +3 m que le MNT croit émergée reste de la mer
   // pour le globe d'aujourd'hui (h < 0 est faux), et le masque ne la sauve pas
   // au-delà de la marge — c'est la limite ASSUMÉE de la marge, pas un oubli.
   assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 3, margeM: 1.33 }), false)
   // une terre franche reste terre quelle que soit sa hauteur
   assert.equal(sousEauCrop({ masqueActif: true, landness: 1, hM: -50, margeM: 1.33 }), false)
+  // ⚠️ **ET `zeroSousEau` NE TOUCHE PAS À CETTE BRANCHE — Tâche K bis.** Le
+  // défaut du zéro ne vivait que dans le prédicat de REPLI : sous le masque, la
+  // comparaison est `hM < margeM` avec `margeM > 0`, donc `h == 0` y est DÉJÀ
+  // sous l'eau quand le masque dit « mer ». Étendre l'option ici déplacerait la
+  // marge d'un cran et noierait la ligne d'eau exacte de la côte.
+  // (La campagne de mutation a laissé survivre cette extension : ce bloc la tue.)
+  for (const [landness, hM] of [[0, 1.33], [0, 0], [0, -50], [1, 1.33], [1, 0], [0, 2000]]) {
+    assert.equal(
+      sousEauCrop({ masqueActif: true, landness, hM, margeM: 1.33, zeroSousEau: true }),
+      sousEauCrop({ masqueActif: true, landness, hM, margeM: 1.33 }),
+      'sous le masque, l’option ne doit RIEN changer — landness=' + landness + ' hM=' + hM
+    )
+  }
+  // et le point exact que l'extension déplacerait : h == margeM reste de la TERRE
+  assert.equal(sousEauCrop({ masqueActif: true, landness: 0, hM: 1.33, margeM: 1.33, zeroSousEau: true }), false)
 })
 
-test('⑤ le nuanceur pose bien `sousEau = h < 0.0` avant toute garde', () => {
-  const i = FRAG.indexOf('bool sousEau = h < 0.0;')
-  assert.ok(i > 0, 'le nuanceur ne pose pas la valeur d’avant comme défaut')
+test('⑤ le nuanceur pose `sousEau` AVANT la garde, et son défaut est celui d’avant', () => {
+  const i = FRAG.indexOf('bool sousEau =')
+  assert.ok(i > 0, 'le nuanceur ne pose pas de défaut pour `sousEau`')
   assert.ok(i < FRAG.indexOf('if (uHabOn > 0.5) {'), 'la valeur d’avant est posée APRÈS la garde')
+  // ⚠️ **CE TEST NE CHERCHE PLUS LA CHAÎNE `h < 0.0`, IL L'EXÉCUTE — Tâche K
+  // bis.** La ligne porte maintenant une ternaire sur `uMerZeroSousEau`, et une
+  // assertion de PRÉSENCE serait verte sur n'importe quelle ternaire, y compris
+  // sur celle qui échange ses deux branches. On CAPTURE donc l'expression et on
+  // la fait tourner aux DEUX valeurs de l'uniforme.
+  const m = capture(FRAG, /bool sousEau = ([^;]+);/, 'le défaut de sousEau')
+  const f = loi(m[1], ['uMerZeroSousEau', 'h'])
+  // uniforme à 0 : le prédicat du dépôt, au bit près — c'est la garde de
+  // production, la même que `uCropOn: 0` et `uMppFacteur: 0`
+  assert.equal(!!f.appel(0, -0.001), true)
+  assert.equal(!!f.appel(0, 0), false, 'à 0, h == 0 doit RESTER sur la branche terre')
+  assert.equal(!!f.appel(0, 0.001), false)
+  // uniforme à 1 : zéro passe sous l'eau, et RIEN D'AUTRE ne bouge
+  assert.equal(!!f.appel(1, -0.001), true)
+  assert.equal(!!f.appel(1, 0), true, 'à 1, h == 0 doit quitter la branche terre')
+  assert.equal(!!f.appel(1, 0.001), false, 'à 1, un millimètre de terre reste de la terre')
   // et la rampe lit `sousEau`, pas `h < 0.0` — sinon le masque ne servirait
   // qu'au trait de côte et la couleur resterait celle du MNT
   assert.match(FRAG, /float t = sousEau\s*\n/, 'la rampe ne lit pas `sousEau`')
 })
 
+test('⑤ bis l’uniforme du zéro de la mer est DÉCLARÉ, et son défaut est 0', () => {
+  // ⚠️ **LA GARDE DE PRODUCTION SE VÉRIFIE DES DEUX CÔTÉS** : le nuanceur doit
+  // DÉCLARER l'uniforme (sans quoi la ternaire ne compile pas) ET `globe.js`
+  // doit le faire naître à 0 (sans quoi la vue orbitale en ligne changerait de
+  // couleur sans que personne l'ait demandé). Même patron que `uMerRampeOn`.
+  assert.match(FRAG, /uniform float uMerZeroSousEau;/)
+  assert.match(GLOBE_SRC, /uMerZeroSousEau: \{ value: 0 \}/)
+})
+
 // ══════════ ⑥ LE GRAIN — sur le sol, sur la terre, et borné ════════════════
 
 test('⑥ le grain est SOLIDAIRE DU SOL : deux points du même endroit rendent la même valeur', () => {
   // ⚠️ C'EST LE DÉFAUT QU'ADRIEN A ATTRAPÉ À L'ŒIL sur le socle : « évalué en x
   // seul, le grain resterait COLLÉ À L'ÉCRAN pendant que le relief défile ».
   // Indexé sur (u, v) du crop, il ne dépend que de l'endroit.
   const a = grainCrop({ u: 0.31, v: -0.17, force: 3, echelle: 96 })
   const b = grainCrop({ u: 0.31, v: -0.17, force: 3, echelle: 96 })
   assert.equal(a, b)
   // et il CHANGE quand l'endroit change — sinon il serait constant, ce qui
@@ -759,24 +799,35 @@ test('⑩a la garde v42 du nuanceur rend le MÊME verdict que la loi — sur 5 0
   }
   assert.ok(vus > 5000, 'le balayage doit être large, sinon il ne prouve rien')
   // les trois cas nommés du correctif v42, en clair
   assert.equal(f.appel(0, 2000, 1.745), false, 'un sommet à 2 000 m que le masque croit en mer doit rester TERRE')
   assert.equal(f.appel(0, 1.7, 1.745), true)
   assert.equal(f.appel(1, -50, 1.745), false)
 })
 
 test('⑩b sans masque, le nuanceur retombe sur le prédicat d’avant — exécuté, pas décrit', () => {
   const m = capture(FRAG, /bool sousEau = ([^;]+);/, 'la valeur par défaut de sousEau')
-  const f = loi(m[1], ['h'])
-  for (let j = -60; j <= 60; j++) {
-    const h = j * 91.7
-    assert.equal(!!f.appel(h), sousEauCrop({ masqueActif: false, landness: 0, hM: h, margeM: 1.745 }), 'h=' + h)
+  const f = loi(m[1], ['uMerZeroSousEau', 'h'])
+  // ⚠️ **LES DEUX BRANCHES SONT CONFRONTÉES À LA LOI PURE — Tâche K bis.** Le
+  // nuanceur et `sousEauCrop` doivent dire la même chose aux DEUX valeurs de
+  // l'uniforme, zéro compris : c'est là, et seulement là, qu'elles diffèrent.
+  for (const zero of [0, 1]) {
+    for (let j = -60; j <= 60; j++) {
+      const h = j * 91.7
+      assert.equal(
+        !!f.appel(zero, h),
+        sousEauCrop({ masqueActif: false, landness: 0, hM: h, margeM: 1.745, zeroSousEau: zero > 0.5 }),
+        'zero=' + zero + ' h=' + h
+      )
+    }
+    // et le point qui SÉPARE les deux lois, en propre
+    assert.equal(!!f.appel(zero, 0), zero > 0.5, 'h == 0, uMerZeroSousEau=' + zero)
   }
 })
 
 test('⑩c la rampe est pilotée par le jeton sousEau — CAPTURÉ, pas cherché', () => {
   // Un retour à « h < 0.0 » change la capture, et le masque de côte ne
   // déciderait plus que du trait, plus de la couleur.
   const m = capture(FRAG, /float t = ([A-Za-z_][A-Za-z0-9_]*)\s*\n/, 'la ternaire de la rampe')
   assert.equal(m[1], 'sousEau', 'la rampe est pilotée par ' + m[1] + ' et non par sousEau')
 })
 
diff --git a/test/crop-rampe.test.js b/test/crop-rampe.test.js
index 3093be2..542a868 100644
--- a/test/crop-rampe.test.js
+++ b/test/crop-rampe.test.js
@@ -48,20 +48,21 @@ import {
   plancherRampeDuCrop,
   plancherAmplitudeM,
   mesurerRelief,
   echelleRampe,
   rampeT,
   saturation,
 } from '../src/monde/rampe-crop.js'
 import { unitesEnMetres, margeCoteM, MARGE_COTE_UNITES } from '../src/monde/habillage-crop.js'
 import { repereCrop, latLonDeLocal, localCrop, dansCrop } from '../src/monde/crop-sphere.js'
 import { Globe } from '../src/globe.js'
+import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
 
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 const SRC_TERRAIN = new URL('../src/terrain.js', import.meta.url)
 const globeSrc = readFileSync(SRC_GLOBE, 'utf8')
 
 // ══════════ L'OUTILLAGE — EXTRAIRE ET EXÉCUTER L'EXPRESSION DU NUANCEUR ════
 //
 // ⚠️ **`.banc/extrait-D.mjs` EN PORTE UNE COPIE, ET C'EST VOULU** : le banc de
 // rejeu doit pouvoir évaluer la rampe d'une révision ANCIENNE (`git show`), ce
 // qu'un test n'a pas à faire. Les deux copies sont confrontées par ②e, qui exige
@@ -352,21 +353,33 @@ function faussGlobe(crop, hauteur) {
   const val = (v) => ({ value: v })
   return {
     _crop: crop,
     uniforms: {
       uLandBas: val(RAMPE_MONDE.terreBas),
       uLandMax: val(RAMPE_MONDE.terreHaut),
       uOceanDepth: val(RAMPE_MONDE.profondeur),
       uPlancherRampeM: val(RAMPE_MONDE.plancherM),
       uCropCoin: val(FORME.coin),
       uCropCoinN: val(FORME.expo),
+      // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis, ET CE SONT DES MÉTHODES QU'IL EXERCE.**
+      // Ce faux globe porte exactement ce que `poserRampe` lit et écrit ; la
+      // tâche lui a donné un uniforme de plus (le zéro de la mer), un poseur
+      // d'uniformes unique et le partage de l'échelle continue. Les emprunter
+      // au VRAI prototype plutôt que les bricoler est ce qui rend ce banc utile
+      // — un bouchon de `_poserUniformesRampe` laisserait passer une pose qui
+      // n'écrit rien.
+      uMerZeroSousEau: val(0),
+      uMerRampeOn: val(0),
+      uMerFondBudgetM: val(RAMPE_MONDE.profondeur),
     },
+    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
+    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
     tuilesAvecHauteurs: () => [],
     hauteurSurface: (lat, lon) => hauteur(lat, lon),
   }
 }
 
 const poser = (g, arg) => Globe.prototype.poserRampe.call(g, arg)
 const lire = (g) => ({
   uLandBas: g.uniforms.uLandBas.value,
   uLandMax: g.uniforms.uLandMax.value,
   uOceanDepth: g.uniforms.uOceanDepth.value,
diff --git a/test/echelle-continue.test.js b/test/echelle-continue.test.js
new file mode 100644
index 0000000..9244fa1
--- /dev/null
+++ b/test/echelle-continue.test.js
@@ -0,0 +1,554 @@
+// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis du plan « LE STUDIO SUR LE GLOBE ».
+//
+// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
+//
+// ① LA LOI vit dans un module PUR (`src/monde/echelle-continue.js`) et se
+//    vérifie sous node, point par point.
+// ② LE REJEU : la loi est confrontée aux SIX RELEVÉS BRUTS de la descente
+//    d'Adrien, recopiés du fichier que le harnais a laissé sur le disque.
+// ③ ⚠️ **LE BRANCHEMENT**, et c'est la moitié que ce chantier oublie. Le §0 du
+//    plan le dit : une tâche a vu **12 de ses 15 mutations survivre**, une autre
+//    n'a atteint 36/36 qu'au troisième tour — « ses tests de loi pure étaient
+//    bons, ses tests de BRANCHEMENT manquaient tous ». Le §③ exerce donc
+//    `Globe.poserRampe`, `Globe.majEchelleRampe`, `Globe.poserCrop` et
+//    `Globe.retirerRampe` sur un faux globe qui porte de VRAIS uniformes.
+//
+// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute le nuanceur, et que
+// l'image obtenue soit celle qu'Adrien veut. Seul l'écran le dit — Étape 5 de la
+// tâche, et son compte rendu.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import {
+  CHAMPS,
+  cranReel,
+  cranAncre,
+  champsUtiles,
+  creerEchelleContinue,
+  ancrerMesure,
+  oublierAncres,
+  valeurChamp,
+  majEchelle,
+  lireEchelle,
+} from '../src/monde/echelle-continue.js'
+import { RAMPE_MONDE, echelleRampe } from '../src/monde/rampe-crop.js'
+import { repereCrop } from '../src/monde/crop-sphere.js'
+import { Globe } from '../src/globe.js'
+
+const SRC_MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+const SRC_GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+
+// ══════════ LES RELEVÉS BRUTS DE LA DESCENTE D'ADRIEN ══════════════════════
+//
+// ⚠️ **RECOPIÉS DE `.banc/vues-Kbis/AV-descente.json`, QUI EST RESTÉ SUR LE
+// DISQUE.** Le banc est hors dépôt (`.banc/` est ignoré), donc un test ne peut
+// pas le lire ; ces six lignes en sont l'extrait, et `.banc/bilan-Kbis.mjs` les
+// redonne à la décimale près. Même patron que `MAURICE` / `ALPIN` de
+// `test/crop-rampe.test.js`.
+//
+// La Réunion, `?terre=unique&globe=continu&socle=quadtree`, fov lu en direct
+// à 33, six stations : ORB, Z4, Z6, Z9, Z11, Z13.
+const DESCENTE = [
+  { nom: 'ORB', altM: 3000000, terreBas: 0, terreHaut: 2584.3525390625, profondeur: 2106.7706909179688, fondBudget: 3510.4921875 },
+  { nom: 'Z4', altM: 189119, terreBas: 0, terreHaut: 5600, profondeur: 6000, fondBudget: 6000 },
+  { nom: 'Z6', altM: 26720, terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, fondBudget: 6228 },
+  { nom: 'Z9', altM: 6339, terreBas: 0, terreHaut: 2848.75, profondeur: 4913, fondBudget: 6028.046875 },
+  { nom: 'Z11', altM: 8001, terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, fondBudget: 6028.046875 },
+  { nom: 'Z13', altM: 9564, terreBas: 533.6875, terreHaut: 3057.181640625, profondeur: 0.008731811511228657, fondBudget: 4415.2265625 },
+]
+const PLANCHER_Z13 = 0.008731811511228657
+
+/** `t` de la rampe hypsométrique — la loi du nuanceur, transcrite. */
+function rampeT(hM, e) {
+  const p = e.plancherM > 0 ? e.plancherM : 0
+  if (hM < 0) return 0.35 * (1 - clamp01(-hM / Math.max(e.profondeur, p)))
+  return 0.35 + 0.65 * clamp01((hM - e.terreBas) / Math.max(e.terreHaut - e.terreBas, p))
+}
+function clamp01(x) { return Math.min(Math.max(x, 0), 1) }
+
+// ══════════ ① LA LOI ═══════════════════════════════════════════════════════
+
+test('①a le cran est `log2(altitude)`, et une altitude impossible n’en a pas', () => {
+  assert.equal(cranReel(1024), 10)
+  assert.equal(cranReel(8192), 13)
+  assert.ok(Math.abs(cranReel(9564) - 13.2237) < 1e-3)
+  // ⚠️ **LES TROIS STATIONS PROFONDES TOMBENT SUR LE MÊME CRAN, ET C'EST LA
+  // PROPRIÉTÉ QUI TIENT LE CRITÈRE D'ADRIEN.** 6 339, 8 001 et 9 564 m.
+  assert.equal(cranAncre(6339), 13)
+  assert.equal(cranAncre(8001), 13)
+  assert.equal(cranAncre(9564), 13)
+  // et Z6 comme Z4 tombent ailleurs — sinon la courbe n'aurait qu'un point
+  assert.equal(cranAncre(26720), 15)
+  assert.equal(cranAncre(189119), 18)
+  for (const mauvais of [0, -1, NaN, null, undefined, Infinity * 0]) {
+    assert.ok(Number.isNaN(cranReel(mauvais)), String(mauvais))
+    assert.ok(Number.isNaN(cranAncre(mauvais)), String(mauvais))
+  }
+})
+
+test('①b une mesure au PLANCHER est MUETTE, pas plate — le 0,009 m de Z13', () => {
+  // ⛔ **C'EST LE DÉFAUT LE PLUS VIOLENT DU RELEVÉ.** Au crop de Z13 aucun point
+  // n'est sous le niveau de la mer : `echelleRampe` rend le plancher de
+  // division, 8,7 millimètres. Le prendre pour une profondeur, c'est prendre
+  // « je ne sais pas » pour « la mer est plate » — et toute la mer sature.
+  const z13 = DESCENTE[5]
+  const u = champsUtiles({ ...z13, plancherM: PLANCHER_Z13 })
+  assert.equal(u.profondeur, false, 'une profondeur au plancher ne dit rien')
+  assert.equal(u.terreHaut, true, 'la terre, elle, dit quelque chose')
+  assert.equal(u.terreBas, true)
+  assert.equal(u.fondBudget, true)
+  // et une VRAIE profondeur est bien retenue
+  assert.equal(champsUtiles({ ...DESCENTE[3], plancherM: 0.14 }).profondeur, true)
+  // un crop rigoureusement plat ne dit rien de sa terre non plus
+  const plat = echelleRampe({ minM: 12, maxM: 12, minTerreM: 12, maxTerreM: 12 }, { plancherM: 0.0066 })
+  assert.equal(champsUtiles(plat).terreHaut, false)
+})
+
+test('①c une ancre s’écrit UNE FOIS par cran — la re-mesure ne repasse pas', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const poses = ancrerMesure(p, 8192, { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000, plancherM: 0.01 })
+  assert.deepEqual(poses.sort(), [...CHAMPS].sort())
+  // une seconde mesure au MÊME cran ne change RIEN — c'est la propriété qui
+  // remplace « re-mesurée par saut à chaque pose »
+  const rien = ancrerMesure(p, 9564, { terreBas: 400, terreHaut: 3057, profondeur: 900, fondBudget: 4415, plancherM: 0.01 })
+  assert.deepEqual(rien, [])
+  assert.deepEqual(p.ancres.get(13), { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000 })
+  // ... mais un cran VOISIN, lui, s'écrit
+  const autre = ancrerMesure(p, 26720, { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, fondBudget: 6228, plancherM: 1.13 })
+  assert.deepEqual(autre.sort(), [...CHAMPS].sort())
+  assert.equal(p.ancres.size, 2)
+})
+
+test('①d sans ancre, l’échelle est EXACTEMENT `RAMPE_MONDE` — la garde de production', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const v = majEchelle(p, 12345)
+  for (const c of ['terreBas', 'terreHaut', 'profondeur']) {
+    assert.ok(Object.is(v[c], RAMPE_MONDE[c]), c + ' = ' + v[c])
+  }
+  assert.ok(Object.is(v.fondBudget, RAMPE_MONDE.profondeur))
+  assert.ok(Object.is(v.plancherM, RAMPE_MONDE.plancherM))
+  // et sur 2 001 hauteurs, la rampe rend le bit près de la rampe mondiale
+  for (let i = 0; i <= 2000; i++) {
+    const h = -6000 + i * 6
+    assert.ok(Object.is(rampeT(h, v), rampeT(h, RAMPE_MONDE)), 'h=' + h)
+  }
+})
+
+test('①e UNE SEULE ancre ⇒ la MÊME couleur à TOUTES les altitudes — le critère d’Adrien, exact', () => {
+  // ⚠️ **C'EST LE CŒUR DE LA TÂCHE, ET IL EST EXACT ICI.** Tant qu'un seul cran
+  // est mesuré, la même profondeur physique rend rigoureusement la même couleur
+  // de l'orbite au sol : écart NUL, pas « petit ».
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  ancrerMesure(p, 8000, { terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, fondBudget: 6028, plancherM: 0.02 })
+  const ref = majEchelle(p, 8000)
+  for (const alt of [1, 100, 4000, 8000, 26720, 189119, 3000000]) {
+    const v = majEchelle(p, alt)
+    for (const c of CHAMPS) assert.ok(Object.is(v[c], ref[c]), c + ' à ' + alt + ' m')
+  }
+})
+
+test('①f la courbe passe EXACTEMENT par ses ancres', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const ancres = [[13, 2848.75], [15, 2457.25], [18, 5600]]
+  for (const [k, v] of ancres) ancrerMesure(p, 2 ** k, { terreBas: 0, terreHaut: v, plancherM: 0 })
+  for (const [k, v] of ancres) {
+    const y = valeurChamp(p, 'terreHaut', k)
+    assert.ok(Math.abs(y - v) < 1e-9, 'cran ' + k + ' : ' + y + ' au lieu de ' + v)
+  }
+})
+
+test('①g entre deux ancres la courbe NE DÉPASSE PAS — Fritsch–Carlson, pas Catmull-Rom', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  // la suite RÉELLE du relevé, qui DESCEND puis REMONTE : c'est exactement le
+  // cas où un Catmull-Rom nu dépasse
+  for (const [k, v] of [[13, 2848.75], [15, 2457.25], [18, 5600]]) {
+    ancrerMesure(p, 2 ** k, { terreBas: 0, terreHaut: v, plancherM: 0 })
+  }
+  for (let x = 13; x <= 15; x += 0.01) {
+    const y = valeurChamp(p, 'terreHaut', x)
+    assert.ok(y <= 2848.75 + 1e-9 && y >= 2457.25 - 1e-9, 'x=' + x.toFixed(2) + ' y=' + y)
+  }
+  for (let x = 15; x <= 18; x += 0.01) {
+    const y = valeurChamp(p, 'terreHaut', x)
+    assert.ok(y >= 2457.25 - 1e-9 && y <= 5600 + 1e-9, 'x=' + x.toFixed(2) + ' y=' + y)
+  }
+})
+
+test('①g bis la courbe est CONTINUE : aucun saut d’un centième de cran à l’autre', () => {
+  // ⚠️ **C'EST LA PROPRIÉTÉ QU'ADRIEN DEMANDE, ET ELLE SE MESURE.** Le relevé
+  // AVANT saute de `uOceanDepth` 4 913 → 1 827 → 0,009 d'une pose à l'autre.
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  for (const [k, v] of [[13, 4913], [15, 5639.5], [18, 6000]]) {
+    ancrerMesure(p, 2 ** k, { profondeur: v, plancherM: 0 })
+  }
+  let saut = 0
+  let avant = valeurChamp(p, 'profondeur', 12)
+  for (let x = 12; x <= 19; x += 0.01) {
+    const y = valeurChamp(p, 'profondeur', x)
+    saut = Math.max(saut, Math.abs(y - avant))
+    avant = y
+  }
+  // un centième de cran vaut 0,7 % d'altitude : le pas de la courbe y est
+  // NÉCESSAIREMENT petit devant les 3 086 m que le dépôt saute d'une pose à
+  // l'autre. On exige deux ordres de grandeur.
+  assert.ok(saut < 30, 'saut maximal ' + saut.toFixed(2) + ' m par centième de cran')
+})
+
+test('①h hors du domaine ancré, la courbe est PLATE — on n’extrapole pas un relief', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  ancrerMesure(p, 2 ** 13, { terreBas: 0, terreHaut: 2848.75, plancherM: 0 })
+  ancrerMesure(p, 2 ** 15, { terreBas: 0, terreHaut: 2457.25, plancherM: 0 })
+  assert.equal(valeurChamp(p, 'terreHaut', 9), 2848.75)
+  assert.equal(valeurChamp(p, 'terreHaut', 13), 2848.75)
+  assert.equal(valeurChamp(p, 'terreHaut', 15), 2457.25)
+  assert.equal(valeurChamp(p, 'terreHaut', 22), 2457.25)
+})
+
+test('①i `terreHaut` ne peut pas passer sous `terreBas` — l’amplitude ne s’inverse jamais', () => {
+  // ⚠️ **CE JEU D'ANCRES N'EST PAS INVENTÉ : IL A ÉTÉ CHERCHÉ, ET LA PREMIÈRE
+  // RÉDACTION DE CE TEST N'EN AVAIT PAS TROUVÉ.** Avec deux ancres seulement, la
+  // borne ne mord jamais — la campagne de mutation l'a prouvé en laissant la
+  // mutation « la borne disparaît » SURVIVRE. Un balayage de 40 000 jeux
+  // aléatoires (2 à 5 ancres, `.banc/`) rend celui-ci : au cran 13,5 le HAUT
+  // passe **320,7 m SOUS** le BAS, donc l'amplitude s'inverse et `t` avec elle.
+  // Il faut cinq ancres et des crans irréguliers pour l'atteindre.
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const jeu = [
+    [10, 1807.9719439699797, 2419.150590946163],
+    [13, 947.5364238565364, 1117.7760759429925],
+    [12, 66.50886347802043, 1983.4226614743816],
+    [16, 3192.083214561154, 6556.468119982739],
+    [14, 2673.882335732158, 2769.4861022780397],
+  ]
+  for (const [k, bas, haut] of jeu) {
+    ancrerMesure(p, 2 ** k, { terreBas: bas, terreHaut: haut, plancherM: 5 })
+  }
+  let vuNegatif = false
+  for (let x = 10; x <= 16; x += 0.01) {
+    const brut = valeurChamp(p, 'terreHaut', x) - valeurChamp(p, 'terreBas', x)
+    if (brut < 0) vuNegatif = true
+    const v = majEchelle(p, 2 ** x)
+    assert.ok(v.terreHaut >= v.terreBas + 5 - 1e-9,
+      'x=' + x.toFixed(2) + ' bas=' + v.terreBas + ' haut=' + v.terreHaut)
+  }
+  assert.ok(vuNegatif, 'le jeu d’ancres doit VRAIMENT inverser l’amplitude, sinon la borne n’est pas exercée')
+})
+
+test('①j `oublierAncres` rend l’échelle MONDIALE et vide la table', () => {
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  ancrerMesure(p, 8000, { terreBas: 10, terreHaut: 2000, profondeur: 900, fondBudget: 3000, plancherM: 1 })
+  majEchelle(p, 8000)
+  assert.notEqual(lireEchelle(p).terreHaut, RAMPE_MONDE.terreHaut)
+  oublierAncres(p)
+  assert.equal(p.ancres.size, 0)
+  assert.equal(lireEchelle(p).terreHaut, RAMPE_MONDE.terreHaut)
+  assert.equal(p.altitudeM, null)
+})
+
+test('①k le mélange est GÉOMÉTRIQUE, pas arithmétique — et la différence se voit', () => {
+  // ⚠️ **CE TEST TUE LA LOI « lerp linéaire ».** Entre 1 500 et 6 000 m, le
+  // milieu arithmétique est 3 750, le milieu géométrique 3 000 : un écart de
+  // 750 m, c'est-à-dire 0,08 en `t` à −1 500 m, quarante texels sur 512.
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  ancrerMesure(p, 2 ** 13, { profondeur: 1500, plancherM: 0 })
+  ancrerMesure(p, 2 ** 15, { profondeur: 6000, plancherM: 0 })
+  const y = valeurChamp(p, 'profondeur', 14)
+  const geo = Math.expm1((Math.log1p(1500) + Math.log1p(6000)) / 2)
+  assert.ok(Math.abs(y - geo) < 1e-6, 'géométrique attendu ' + geo + ', obtenu ' + y)
+  assert.ok(Math.abs(y - 3750) > 500, 'la loi arithmétique aurait rendu 3 750')
+})
+
+// ══════════ ② LE REJEU CONTRE LA DESCENTE RÉELLE ═══════════════════════════
+
+test('②a la loi DIVISE l’écart de couleur mesuré sur la descente d’Adrien', () => {
+  // ⚠️ **DEUX MONNAIES, JAMAIS ADDITIONNÉES** : `t` indexe une table de 512
+  // couleurs, `dMer01` interpole trois couleurs en linéaire. On mesure `t` seul.
+  //
+  // ⚠️ **LE JEU EST CELUI DES STATIONS OÙ LE CROP EST POSÉ — Z6, Z9, Z11, Z13 —
+  // ET CE N'EST PAS UN TRI COMMODE.** À Z4 le relevé donne `uCropOn = 0` : il
+  // n'y a pas de crop, donc pas de mesure, donc la rampe MONDIALE, et le code
+  // fait exactement pareil (`retirerRampe` oublie les ancres). Les compter
+  // comparerait une échelle mesurée à un repli, c'est-à-dire deux monnaies de
+  // plus. ⚠️ **Et l'ORB du relevé porte la rampe d'un crop POSÉ à 3 000 km — un
+  // défaut réel, mais qui n'est pas celui-ci** ; il est nommé dans le rapport.
+  const jeu = DESCENTE.filter((s) => ['Z6', 'Z9', 'Z11', 'Z13'].includes(s.nom))
+  const hauteurs = [-3000, -2000, -1000, -500, -200, -50, -1, 500, 1200, 2000, 3000]
+  const plancher = (s) => (s.nom === 'Z13' ? PLANCHER_Z13 : 0)
+
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const avant = jeu.map((s) => ({ ...s, plancherM: plancher(s) }))
+  const apres = jeu.map((s) => {
+    ancrerMesure(p, s.altM, { ...s, plancherM: plancher(s) })
+    return { ...majEchelle(p, s.altM) }
+  })
+
+  const etendue = (set) => {
+    let max = 0
+    for (const h of hauteurs) {
+      const ts = set.map((e) => rampeT(h, e))
+      max = Math.max(max, Math.max(...ts) - Math.min(...ts))
+    }
+    return max
+  }
+  const eAvant = etendue(avant)
+  const eApres = etendue(apres)
+  // `.banc/rejoue-Kbis.mjs`, qui rejoue le fichier brut : 0,3499 → 0,0727,
+  // c'est-à-dire 179 texels sur 512 → 37.
+  assert.ok(Math.abs(eAvant - 0.3499) < 0.001, 'écart AVANT ' + eAvant.toFixed(4))
+  assert.ok(Math.abs(eApres - 0.0727) < 0.001, 'écart APRÈS ' + eApres.toFixed(4))
+  // ⚠️ **ET IL N'EST PAS NUL. JE NE PRÉTENDS PAS QU'IL L'EST.** La première
+  // visite d'un cran neuf déplace encore la courbe (§3 du module) : les crans 13
+  // et 15 de cette descente portent deux reliefs différents, et c'est le résidu
+  // assumé de la loi. Ce que la tâche promet est un écart DIVISÉ PAR 4,8.
+  assert.ok(eApres < eAvant / 4, 'écart APRÈS ' + eApres.toFixed(4) + ' contre ' + eAvant.toFixed(4))
+})
+
+test('②b les trois stations PROFONDES rendent la MÊME couleur — écart NUL', () => {
+  // ⚠️ **C'EST LÀ QU'ADRIEN REGARDE, ET C'EST LÀ QUE LE CRITÈRE EST EXACT.**
+  // Z9, Z11 et Z13 partagent le cran 13 : une seule ancre, donc une seule
+  // échelle, donc la même couleur pour la même profondeur.
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  const profondes = DESCENTE.filter((s) => ['Z9', 'Z11', 'Z13'].includes(s.nom))
+  const vues = profondes.map((s) => {
+    ancrerMesure(p, s.altM, { ...s, plancherM: s.nom === 'Z13' ? PLANCHER_Z13 : 0 })
+    return { ...majEchelle(p, s.altM) }
+  })
+  for (let h = -4000; h <= 4000; h += 7) {
+    const ts = vues.map((e) => rampeT(h, e))
+    assert.ok(Object.is(ts[0], ts[1]) && Object.is(ts[1], ts[2]), 'h=' + h + ' → ' + ts.join(' '))
+  }
+  // et le 0,009 m de Z13 n'est JAMAIS arrivé jusqu'à l'écran
+  assert.equal(vues[2].profondeur, 4913)
+})
+
+test('②c le GAIN LOCAL est conservé — on ne revient PAS à l’échelle mondiale figée', () => {
+  // ⚠️ **LA RÉGRESSION QU'IL NE FAUT PAS COMMETTRE, ET ELLE EST DÉJÀ MESURÉE.**
+  // La Tâche C l'a relevée : sous la rampe mondiale le crop rend « une masse
+  // plate et orange ». Son chiffre était 163 texels contre 368, soit ×2,26.
+  //
+  // ⚠️ **JE RECOMPTE AU LIEU DE LE REPRENDRE, ET JE NE TOMBE PAS SUR LE MÊME.**
+  // Avec le sommet réel de La Réunion (Piton des Neiges, 3 070 m) et la loi
+  // d'aujourd'hui, la rampe mondiale en occupe **182**, pas 163 — la Tâche C
+  // comptait sur une autre altitude de sommet, que son compte rendu ne donne
+  // pas. Le rapport de cette tâche-ci cite donc SES chiffres, pas les siens :
+  // c'est la règle des dénominateurs du §0.
+  const texels = (e) => Math.round((rampeT(3070, e) - rampeT(0, e)) * 511)
+  assert.equal(texels(RAMPE_MONDE), 182, 'la rampe mondiale, recomptée')
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  for (const s of DESCENTE) {
+    ancrerMesure(p, s.altM, { ...s, plancherM: s.nom === 'Z13' ? PLANCHER_Z13 : 0 })
+  }
+  const auSol = majEchelle(p, 9564)
+  assert.equal(texels(auSol), 332, 'la rampe posée au sol, recomptée')
+  // ×1,82 : le gain de la rampe locale est conservé, pas rendu au monde
+  assert.ok(texels(auSol) / texels(RAMPE_MONDE) > 1.8)
+})
+
+// ══════════ ③ LE BRANCHEMENT ═══════════════════════════════════════════════
+
+const REPERE = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
+
+function faussGlobe(crop = REPERE, hauteur = () => 400) {
+  const val = (v) => ({ value: v })
+  return {
+    _crop: crop,
+    uniforms: {
+      uLandBas: val(RAMPE_MONDE.terreBas),
+      uLandMax: val(RAMPE_MONDE.terreHaut),
+      uOceanDepth: val(RAMPE_MONDE.profondeur),
+      uPlancherRampeM: val(RAMPE_MONDE.plancherM),
+      uMerFondBudgetM: val(RAMPE_MONDE.profondeur),
+      uMerRampeOn: val(0),
+      uMerZeroSousEau: val(0),
+      uCropOn: val(1),
+      uCropCentre: { value: { set() {} } },
+      uCropDemi: val(1),
+      uCropCoin: val(0),
+      uCropCoinN: val(2),
+    },
+    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
+    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
+    _melangeCrop() {},
+    tuilesAvecHauteurs: () => [],
+    hauteurSurface: (lat, lon) => hauteur(lat, lon),
+  }
+}
+
+const poser = (g, arg) => Globe.prototype.poserRampe.call(g, arg)
+const lire = (g) => ({
+  uLandBas: g.uniforms.uLandBas.value,
+  uLandMax: g.uniforms.uLandMax.value,
+  uOceanDepth: g.uniforms.uOceanDepth.value,
+  uPlancherRampeM: g.uniforms.uPlancherRampeM.value,
+})
+
+test('③a SANS altitude, `poserRampe` pose la mesure TELLE QUELLE — le dépôt au bit près', () => {
+  const g = faussGlobe()
+  const e = { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 }
+  poser(g, { echelle: e })
+  assert.deepEqual(lire(g), { uLandBas: 11, uLandMax: 2200, uOceanDepth: 33, uPlancherRampeM: 0.01 })
+  assert.equal(g._echelleContinue.ancres.size, 0, 'sans altitude, rien ne doit être ancré')
+})
+
+test('③b AVEC une altitude, `poserRampe` ANCRE et pose la COURBE', () => {
+  const g = faussGlobe()
+  const e = { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }
+  const r = poser(g, { echelle: e, altitudeM: 6339 })
+  assert.equal(g._echelleContinue.ancres.size, 1)
+  assert.deepEqual([...g._echelleContinue.ancres.keys()], [13])
+  // une seule ancre : la courbe rend la mesure elle-même
+  assert.equal(lire(g).uLandMax, 2848.75)
+  assert.equal(lire(g).uOceanDepth, 4913)
+  assert.ok(r.posee, 'le retour doit porter l’échelle POSÉE, distincte de la MESURÉE')
+})
+
+test('③c deux poses au MÊME cran, deux mesures : les uniformes NE BOUGENT PAS', () => {
+  // ⚠️ **C'EST LE DÉFAUT DE LA TÂCHE, ET C'EST LE TEST QUI LE TUE.** Le dépôt
+  // reposait `uOceanDepth` 4 913 → 1 827 → 0,009 sur ces trois poses.
+  const g = faussGlobe()
+  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 6339 })
+  const apres1 = lire(g)
+  poser(g, { echelle: { terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, plancherM: 0.03 }, altitudeM: 8001 })
+  assert.deepEqual(lire(g), apres1, 'la seconde pose du même cran a bougé les uniformes')
+  poser(g, { echelle: { terreBas: 533.6875, terreHaut: 3057.181640625, profondeur: PLANCHER_Z13, plancherM: PLANCHER_Z13 }, altitudeM: 9564 })
+  assert.deepEqual(lire(g), apres1, 'la troisième pose du même cran a bougé les uniformes')
+})
+
+test('③d `majEchelleRampe` SANS ancre n’écrit RIEN — la garde de production', () => {
+  const g = faussGlobe()
+  const avant = lire(g)
+  const r = Globe.prototype.majEchelleRampe.call(g, 12345)
+  assert.equal(r, null)
+  assert.deepEqual(lire(g), avant)
+})
+
+test('③e `majEchelleRampe` fait GLISSER l’échelle entre deux crans ancrés', () => {
+  const g = faussGlobe()
+  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 8192 })
+  poser(g, { echelle: { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, plancherM: 1.13 }, altitudeM: 32768 })
+  // à mi-chemin (cran 14), la valeur est STRICTEMENT entre les deux — donc la
+  // courbe est bien évaluée, et pas figée sur l'une des deux ancres
+  Globe.prototype.majEchelleRampe.call(g, 2 ** 14)
+  const m = lire(g)
+  assert.ok(m.uLandMax < 2848.75 && m.uLandMax > 2457.25, 'uLandMax=' + m.uLandMax)
+  assert.ok(m.uOceanDepth > 4913 && m.uOceanDepth < 5639.5, 'uOceanDepth=' + m.uOceanDepth)
+  // et la marche entre deux images voisines est PETITE
+  Globe.prototype.majEchelleRampe.call(g, 2 ** 14)
+  const a = lire(g).uOceanDepth
+  Globe.prototype.majEchelleRampe.call(g, 2 ** 14.01)
+  const b = lire(g).uOceanDepth
+  assert.ok(Math.abs(b - a) < 30, 'marche de ' + Math.abs(b - a).toFixed(2) + ' m par centième de cran')
+})
+
+test('③f `zeroSousEau` est OPTIONNEL, et `retirerRampe` l’éteint', () => {
+  const g = faussGlobe()
+  poser(g, { echelle: { terreBas: 0, terreHaut: 100, profondeur: 100, plancherM: 0 } })
+  assert.equal(g.uniforms.uMerZeroSousEau.value, 0, 'le défaut doit laisser la production intacte')
+  poser(g, { echelle: { terreBas: 0, terreHaut: 100, profondeur: 100, plancherM: 0 }, zeroSousEau: true })
+  assert.equal(g.uniforms.uMerZeroSousEau.value, 1)
+  Globe.prototype.retirerRampe.call(g)
+  assert.equal(g.uniforms.uMerZeroSousEau.value, 0, 'retirer la rampe doit rendre le prédicat d’avant')
+})
+
+test('③g `retirerRampe` rend `RAMPE_MONDE` ET oublie les ancres', () => {
+  const g = faussGlobe()
+  poser(g, { echelle: { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 }, altitudeM: 8192 })
+  assert.notDeepEqual(lire(g), {
+    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
+    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
+  })
+  Globe.prototype.retirerRampe.call(g)
+  assert.deepEqual(lire(g), {
+    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
+    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
+  })
+  // ⚠️ **SANS CET OUBLI, `majEchelleRampe` LES REPOSERAIT À L'IMAGE SUIVANTE**
+  // et `retirerRampe` ne retirerait rien.
+  assert.equal(g._echelleContinue.ancres.size, 0)
+  assert.equal(Globe.prototype.majEchelleRampe.call(g, 8192), null)
+  assert.deepEqual(lire(g), {
+    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
+    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
+  })
+})
+
+test('③h un CRAN DE ZOOM garde les ancres, un DÉMÉNAGEMENT les jette', () => {
+  const g = faussGlobe()
+  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 8192 })
+  assert.equal(g._echelleContinue.ancres.size, 1)
+  // ⚠️ **LE CENTRE NE RESTE PAS IDENTIQUE D'UN CRAN À L'AUTRE — IL SE CALE SUR
+  // LA GRILLE DE TUILES, ET C'EST CE QUI SÉPARE `max` DE `min`.** La première
+  // rédaction de ce test reposait le crop au centre EXACT : `Math.max` et
+  // `Math.min` y répondaient pareil, et la campagne de mutation a laissé
+  // survivre l'échange des deux. Le cas réel est celui-ci : à z14 le centre a
+  // glissé de plus d'une demi-largeur de z14, mais reste très loin dans le crop
+  // de z12. `max` garde, `min` jetterait — et jeter à chaque cran rouvrirait la
+  // re-mesure par saut que la tâche ferme.
+  const decale = { lat: -20.9 + 0.06, lon: 55.5 + 0.06 }
+  const repFin = repereCrop({ centre: decale, zoom: 14, tuilesParBloc: 3 })
+  assert.ok(Math.abs(repFin.cx - REPERE.cx) > repFin.demi,
+    'le décalage doit dépasser la demi-largeur FINE, sinon le test ne sépare rien')
+  assert.ok(Math.abs(repFin.cx - REPERE.cx) < REPERE.demi, 'et rester dans le crop LARGE')
+  Globe.prototype.poserCrop.call(g, { centre: decale, zoom: 14, tuilesParBloc: 3 })
+  assert.equal(g._echelleContinue.ancres.size, 1, 'un cran de zoom ne doit rien jeter')
+  // l'autre bout du monde : les ancres n'y veulent plus rien dire
+  Globe.prototype.poserCrop.call(g, { centre: { lat: 45.9, lon: 6.86 }, zoom: 14, tuilesParBloc: 3 })
+  assert.equal(g._echelleContinue.ancres.size, 0, 'un déménagement doit tout jeter')
+})
+
+test('③i le budget du fond ne s’écrit QUE sous la rampe nautique allumée', () => {
+  // ⚠️ **SINON DEUX ÉCRIVAINS POUR UN UNIFORME ÉTEINT.** `retirerMer` est le
+  // seul à devoir le rendre au MONDIAL, et le nuanceur le garde derrière
+  // `uMerRampeOn > 0.5`.
+  const g = faussGlobe()
+  Globe.prototype._poserUniformesRampe.call(g, {
+    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 1234, plancherM: 0,
+  })
+  assert.equal(g.uniforms.uMerFondBudgetM.value, RAMPE_MONDE.profondeur, 'éteinte, elle ne doit rien écrire')
+  g.uniforms.uMerRampeOn.value = 1
+  Globe.prototype._poserUniformesRampe.call(g, {
+    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 1234, plancherM: 0,
+  })
+  assert.equal(g.uniforms.uMerFondBudgetM.value, 1234)
+  // et le plancher à 1 m est celui du dépôt (`Math.max(profMaxM, 1)`), déplacé
+  Globe.prototype._poserUniformesRampe.call(g, {
+    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 0.2, plancherM: 0,
+  })
+  assert.equal(g.uniforms.uMerFondBudgetM.value, 1)
+})
+
+test('③j `main.js` DÉRIVE `ctx.rampe` de `ctx.mer` — une seule altitude, pas deux', () => {
+  // ⚠️ **MÊME EXIGENCE QUE `ctx.fond` (Tâche J bis), ET POUR LA MÊME RAISON.**
+  // Deux `altitudeCadrageM()` écrits côte à côte finiraient par diverger, et la
+  // rampe s'ancrerait à un cran pendant que le budget du fond le ferait à un
+  // autre.
+  assert.match(SRC_MAIN, /ctx\.rampe = \{ altitudeM: ctx\.mer\.altitudeM, zeroSousEau: true \}/)
+  // et c'est le SEUL site qui allume le zéro de la mer. ⚠️ On retire les
+  // commentaires avant de compter : le corps en cite le nom, et une assertion
+  // qui compterait les citations serait rouge sur une correction de prose.
+  const code = SRC_MAIN.replace(/\/\/[^\n]*/g, '')
+  assert.equal((code.match(/zeroSousEau/g) || []).length, 1)
+})
+
+test('③k `poserMer` ANCRE son budget au lieu de l’écrire en direct', () => {
+  // ⚠️ **ASSERTION SUR LE TEXTE, ET ELLE EST BORNÉE À CE QU'ELLE PROUVE** :
+  // `poserMer` exige three et `ocean.js`, que node ne résout pas ici. Ce que
+  // cette assertion tue, c'est le retour à l'écriture directe — la ligne
+  // `u.uMerFondBudgetM.value = Math.max(champ.profMaxM, 1)` qu'elle remplace.
+  const i = SRC_GLOBE.indexOf('async poserMer({')
+  assert.ok(i > 0)
+  const corps = SRC_GLOBE.slice(i, SRC_GLOBE.indexOf('\n  }\n', i))
+  assert.match(corps, /ancrerMesure\(this\._echelleContinue, altitudeM, \{/)
+  assert.ok(!/u\.uMerFondBudgetM\.value = Math\.max\(champ\.profMaxM, 1\)\s*\n/.test(corps),
+    'le budget ne doit plus être écrit sans passer par la courbe')
+})
+
+test('③l le module de la loi ne connaît ni three ni le DOM', () => {
+  const src = readFileSync(new URL('../src/monde/echelle-continue.js', import.meta.url), 'utf8')
+  const imports = [...src.matchAll(/^import[^\n]*from '([^']+)'/gm)].map((m) => m[1])
+  assert.deepEqual(imports, ['./exageration-continue.js'],
+    'la loi ne doit importer que les pentes monotones — voir le §5 du module')
+  assert.ok(!/\bTHREE\b|\bdocument\b|\bwindow\b|\bfetch\(/.test(src))
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index 0feb558..37179e7 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -70,20 +70,22 @@ import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
 // champ, la construction du maillage — n'étaient exercées par PERSONNE.
 registerHooks({
   resolve(spec, ctx, suivant) {
     if (spec === 'ocean-waves') {
       return { url: new URL('../src/vendor/ocean-waves/index.js', import.meta.url).href, shortCircuit: true }
     }
     return suivant(spec, ctx)
   },
 })
 import { Globe } from '../src/globe.js'
+import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
+import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
 import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
 // LA LOI DE SURFACE — Tache J bis : l'epsilon de coplanarite depend de son DEFAUT.
 import { altitudeMaillage } from '../src/monde/fond-crop.js'
 import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
 import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
 import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 
@@ -959,28 +961,35 @@ function globeAvecCrop(overrides = {}) {
       remove(m) { this.children = this.children.filter((x) => x !== m) },
     },
     _mer: null,
     _merEtat: null,
     uniforms: {
       uSunDir: val({}),
       uCropCoin: val(0),
       uCropCoinN: val(2),
       uMerRampeOn: val(0),
       uMerFondBudgetM: val(6000),
+      // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis** : `poserMer` n'écrit plus le budget du
+      // fond en direct, il l'ANCRE dans l'échelle continue puis lit la courbe.
+      // Le faux globe porte donc le plancher de division et le partage — même
+      // discipline que le reste de ce bâtisseur : ce que la méthode exerce, il
+      // le porte pour de vrai.
+      uPlancherRampeM: val(0),
       uOceanShallow: val({ set() {} }),
       uOceanMid: val({ set() {} }),
       uOceanDeep: val({ set() {} }),
       // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
       // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
       uEstompageOn: val(0),
       uEstompage: val(1),
     },
+    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
     retirerMer: Globe.prototype.retirerMer,
     _cuireChampMer: Globe.prototype._cuireChampMer,
     _majBordMer: Globe.prototype._majBordMer,
     _melangeCalottes() {},
     _calottes: [],
     ...overrides,
   }
 }
 
 // un fond marin de synthèse, uniformément à −500 m : ces tests n'ont rien à
