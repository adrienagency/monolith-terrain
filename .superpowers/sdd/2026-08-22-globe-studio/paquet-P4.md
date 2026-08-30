a4ec5b1 tache P4 : la garde du couple d accalmie, testee des DEUX cotes
11be1ce tache P4 : la dixieme survivante — reglagesMer d ocean.js, execute
2bd68df tache P4 : les neuf survivantes de la campagne de mutation, tuees par execution
5897c97 tache P4 : la mer du crop reprend la loi du socle

 package.json            |   2 +-
 src/globe.js            | 235 +++++++++++++++++++--
 src/main.js             |  11 +
 src/monde/ecume-mer.js  | 231 ++++++++++++++++++++
 src/monde/mer-sphere.js | 153 +++++++++++++-
 src/ocean.js            |  81 ++++---
 test/ecume-mer.test.js  | 545 ++++++++++++++++++++++++++++++++++++++++++++++++
 test/mer-sphere.test.js | 252 ++++++++++++++++++++--
 8 files changed, 1433 insertions(+), 77 deletions(-)

diff --git a/package.json b/package.json
index 163f278..22b48a6 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js test/ecume-mer.test.js",
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
index 5810a8c..c71c672 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -15,21 +15,21 @@ import * as THREE from 'three'
 import { R_GLOBE, MERCATOR_MAX_LAT, EARTH_RADIUS_M, tileToLatLon, latLonToSphere } from './geo.js'
 import { rampColorStops } from './palette.js'
 import { GlobeClouds } from './globe-clouds.js'
 import { overzoomTile } from './bathy.js'
 // LA FORME DU CROP — Tâche A, « UNE SEULE TERRE ». Module PUR : il n'apporte ni
 // three ni DOM, et c'est lui qui lit `empriseSocle`, pas ce fichier.
 import { repereCrop, coinNormalise, zoomCropPrescrit, tuileDansCrop, mercX, mercY } from './monde/crop-sphere.js'
 // LES PAROIS ET LA BASE — Tâche B. Pur lui aussi : il ne rend que des nombres,
 // c'est ce fichier-ci qui en fait une géométrie three.
 import { construireSolideCrop } from './monde/parois-crop.js'
-import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M } from './monde/habillage-crop.js'
+import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M, COTE_CROP_UNITES } from './monde/habillage-crop.js'
 import {
   RAMPE_MONDE,
   PAS_MESURE,
   mesurerRelief,
   echelleRampe,
   plancherRampeDuCrop,
 } from './monde/rampe-crop.js'
 // L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. Pur lui aussi : il ne rend que
 // des nombres. ⚠️ **C'EST LUI QUI TIENT LES QUATRE NOMBRES DE RAMPE, ET PLUS
 // `poserRampe`** — les mesures y sont ANCRÉES par cran d'altitude, la valeur
@@ -57,20 +57,22 @@ import {
   bandeDegradation,
   distanceRivage,
   RAMPE_NAUTIQUE,
   epsilonMerDuCrop,
   budgetProfondeurM,
   echelleHouleM,
   seuilTraitEauM,
   empriseCalotte,
   porteeHorizon,
   PORTEE_DEFAUT,
+  construireJupeMer,
+  GLSL_JUPE_MER,
 } from './monde/mer-sphere.js'
 // ⚠️ **LE FOV CANONIQUE, PAS UNE CONSTANTE RECOPIÉE.** Tour de correction 1 de
 // la Tâche F : le défaut de `poserMer` portait `33`, une valeur qui n'existe
 // nulle part ailleurs dans le dépôt. `FOV_DEG` est LA source du DÉFAUT — la
 // ligne `fov: 30` des réglages de `main.js` (⚠️ **PAS `main.js:263`, qui parle du
 // maillage du bloc central : citation fausse dans le commentaire même qui
 // réparait une source fausse, corrigée le 2026-08-21 par la Tâche I**), et c'est
 // elle qui alimente `SEUIL_NAISSANCE_M` (32 274 m), le chiffre auquel la bascule
 // de la mer se compare.
 // ⚠️ **ET CE N'EST QU'UN DÉFAUT.** Relevé sur l'application VIVANTE le
@@ -111,20 +113,29 @@ import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
 // Même patron que `naturel-crop.js` juste au-dessus : la loi vit dans un module
 // PUR qui porte son propre texte GLSL, et ce fichier l'INJECTE. Il n'y a donc
 // pas deux écritures de l'éclairage à garder d'accord.
 import {
   GLSL_ECLAIRAGE,
   ECLAIRAGE_MONDE,
   directionSoleilLocale,
   hautLocal,
   irradianceAmbiante,
 } from './monde/eclairage-crop.js'
+// ══════════ L'ÉCUME DE LA MER — Tâche P4 ═══════════════════════════════════
+//
+// > **Le noteur, 2026-08-22 :** « l'écume est 7,7 fois trop étendue — et elle
+// > est en PLAQUES. »
+//
+// Même patron encore : la loi vit une seule fois dans un module PUR, `ocean.js`
+// et ce fichier injectent le MÊME texte. L'en-tête d'`ecume-mer.js` nomme les
+// quatre entrées qui manquaient et donne leur mesure.
+import { GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE } from './monde/ecume-mer.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -137,48 +148,74 @@ import {
 // défaut que `terrain.js` documente sous le nom « deux écritures jumelles ».
 //
 // ⚠️ **ET `SHORE_SURF_GLSL` PORTE `1.0 / 384.0` EN DUR** : c'est la résolution
 // du champ de `ocean.js` (`CHAMP_RES = 384`, `mer-emprise.js`). La calotte cuit
 // donc SON champ à 384 aussi. ⚠️ **Ce littéral est un défaut latent du dépôt et
 // il faut le dire** : sur une emprise 3×3, `resChamp` rend 1 152 et le pas de
 // gradient de la houle de côte y est **trois fois trop grand**. Hors périmètre
 // (c'est le damier), non corrigé, écrit ici pour qu'on puisse le trouver.
 const MER_VERT = /* glsl */ `
 attribute vec2 aCrop;      // (u, v) en demi-côtés de crop — porté par la géométrie
+// LE RIDEAU D EAU — Tache P4. 0 sur la calotte et en haut du ruban, 1 tout en
+// bas : c est A LA FOIS le drapeau du rideau et la profondeur relative que le
+// socle appelle g. Le ruban est CONCATENE a la calotte, donc ses sommets du
+// haut portent le meme aCrop et recoivent la MEME houle, au bit pres.
+attribute float aJupe;
+uniform float uMerBasY;    // le fond du bloc, en Y local — construireSolideCrop
 uniform float uMerTemps;
 uniform float uMerHoule;   // amplitude de houle, en mètres de spectre
 uniform float uMerChop;
 uniform float uMerVitesse;
 uniform float uMerLambda;  // unités LOCALES par mètre de spectre
 uniform float uMerPortee;
 uniform float uMerDebut;   // début de la bande de dégradation, en unités de scène
 uniform float uMerFin;     // fin de la bande : au-delà, on ne calcule PLUS RIEN
 uniform sampler2D uMerChamp; // R : altitude du fond (unités locales), G : rivage
+// ⚠️ UNITÉS DE SCÈNE PAR UNITÉ DE SOCLE — Tâche P4. C'est le facteur qui rend
+// la profondeur du crop comparable à celle du socle, la SEULE monnaie dans
+// laquelle le déclin côtier d'ocean.js a un sens. Un seul écrivain : poserMer.
+uniform float uMerUnite;
 __GERSTNER__
 __SHORE_SURF__
+${GLSL_ECUME}
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
-varying float vRive;
+// ⚠️ CE N EST PLUS LA DISTANCE BRUTE, ET LE NOM LE DIT — Tache P4. Elle portait
+// champ.g tel quel pendant que les seuils qui la lisent (0,002 / 0,03 / 0,10 /
+// 0,75) sont ceux d ocean.js, cales sur vFade, c est-a-dire sur le declin
+// FONDU. C etait ca, l ecume 7,7 fois trop etendue. (Aucun accent grave ni
+// apostrophe dans ce bloc : template literal.)
+varying float vFonduRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
+varying float vJupe;
 
 void main() {
   vec3 p = position;
+  vJupe = aJupe;
+  // le BAS du rideau tient au fond du bloc et ne suit aucune vague : c est lui
+  // qui soude la nappe a la levre de la paroi, laquelle plonge au fond marin.
+  bool basDuRideau = aJupe > 0.5;
+  if (basDuRideau) p.y = uMerBasY;
   vCrop = aCrop;
   vLocal = vec2(position.x, position.z);
   vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;
   vec2 champ = texture2D(uMerChamp, uvF).rg;
   vProfondeur = max(-champ.r, 0.0);
-  vRive = champ.g;
+  // ⚠️ LA PROFONDEUR EN UNITÉS DE SOCLE, PUIS LE DÉCLIN D'ocean.js. Les deux
+  // grandeurs qu'il compare — deux fois la profondeur, et la distance au rivage
+  // normalisée sur quinze unités de socle — doivent vivre dans la MÊME monnaie.
+  float declin = declinRivageMer(vProfondeur / max(uMerUnite, 1e-9), champ.g);
+  vFonduRive = fonduRessacMer(declin);
   vec3 monde = (modelMatrix * vec4(p, 1.0)).xyz;
 
   // ══════ LA MER — LA DÉGRADATION, ET ELLE ATTEINT ZÉRO ═════════════════════
   //
   // ⚠️ EN LOGARITHME DE DISTANCE : la bande est GÉOMÉTRIQUE, donc la bascule en
   // est le milieu EXACT et la transition dure le même nombre d'octaves de
   // chaque côté. C'est la loi de richesseMer (src/monde/mer-sphere.js), et
   // test/mer-sphere.test.js EXTRAIT cette expression pour la confronter à elle.
   //
   // ⚠️ ET C'EST UNE SORTIE ANTICIPÉE, PAS UNE MULTIPLICATION. ocean.js calcule
@@ -194,21 +231,23 @@ void main() {
     vCrete = 0.0;
     vNormMer = vec3(0.0, 1.0, 0.0);
     vMonde = monde;
     gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
     return;
   }
 
   // le fondu de rivage : la houle meurt AVANT le trait d'eau, sinon un creux
   // traverse le fond et le relief sous-marin ressort en peignes (ocean.js, les
   // captures d'Ibiza et de Toulon)
-  float fade = smoothstep(0.0, 0.10, vRive) * richesseMer;
+  // ⚠️ SUR LE DECLIN, PAS SUR LE FONDU — ocean.js lit shoreD ici et vFade dans
+  // le fragment : deux rampes sur la MEME grandeur, pas l une sur l autre.
+  float fade = fonduHouleMer(declin) * richesseMer;
   vec3 nAcc = vec3(0.0);
   float crete = 0.0;
   // ⚠️ ON PASSE uMerLambda EN lenScale, ET LES COORDONNÉES TELLES QUELLES —
   // exactement comme ocean.js. La premiere ecriture divisait xz par lambda et
   // passait lenScale = 1,0 : le deplacement sortait alors en METRES DE SPECTRE
   // pendant que le critere de deferlement ci-dessous compare a une profondeur en
   // UNITES DE SCENE. Deux unites dans la meme soustraction, et rien ne l'aurait
   // dit. (Aucun accent grave dans ce bloc : template literal.)
   vec3 disp = oceanGerstner(vec2(p.x, p.z), uMerTemps, uMerHoule, uMerChop, uMerVitesse, uMerLambda, fade, nAcc, crete);
   float creteS = 0.0;
@@ -222,23 +261,25 @@ void main() {
   // 0,78 fois sa profondeur. Limite DOUCE, pas un écrêtage : cap(1 − e^(−a/cap))
   // vaut a en eau profonde et tend vers cap en eau basse.
   float cap = 0.78 * vProfondeur;
   float amp = abs(disp.y);
   float dy = sign(disp.y) * cap * (1.0 - exp(-amp / max(cap, 1e-9)));
 
   // ⚠️ EN COORDONNEES LOCALES, ET LA VERTICALE Y EST (0,1,0). La premiere
   // ecriture ajoutait normalize(monde), c'est-a-dire un vecteur du repere du
   // MONDE, a une position du repere LOCAL du crop : la houle poussait la
   // surface de travers, d'un angle egal a la latitude du crop.
-  p.x += disp.x;
-  p.z += disp.z;
-  p.y += dy;
+  if (!basDuRideau) {
+    p.x += disp.x;
+    p.z += disp.z;
+    p.y += dy;
+  }
 
   vCrete = crete;
   vNormMer = normalize(vec3(-nAcc.x, 1.0 - nAcc.y, -nAcc.z));
   vMonde = (modelMatrix * vec4(p, 1.0)).xyz;
   gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
 }
 `
 
 const MER_FRAG = /* glsl */ `
 uniform vec3 uSunDir;
@@ -247,67 +288,103 @@ uniform vec3 uMerPeu;    // le glacis clair des faibles profondeurs
 uniform vec3 uMerFond;   // le bleu du large
 uniform vec3 uSky;
 uniform float uMerTemps;
 uniform float uMerProfMax;
 uniform float uMerSeuilEau;
 uniform float uMerEcume;
 uniform float uMerEcumeEchelle;
 uniform float uMerBrillance;
 uniform float uMerPortee;
 uniform float uMerLambda;
+uniform float uMerUnite;      // unites de scene par unite de socle — Tache P4
+// ══════ LES DEUX ACCALMIES D'ocean.js, LUES ET NON RECALCULEES — Tache P4 ══
+// Elles pesent 0,4039 et 0,08 dans la page vivante du 2026-08-22 : le ressac du
+// socle y est multiplie par 0,0323 quand la calotte le multipliait par 1. Un
+// seul ecrivain, Ocean.setView ; la calotte prend ses valeurs. Neutre : 1.
+uniform float uMerCalmeVue;
+uniform float uMerCalmeSurf;
+uniform float uMerGivre;   // le socle de verre du mode plat (uFrost) — 0 = pas de verre
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
 uniform vec2 uMerBord;
 varying vec2 vCrop;
 varying vec2 vLocal;
 varying float vProfondeur;
-varying float vRive;
+varying float vFonduRive;
 varying float vCrete;
 varying vec3 vNormMer;
 varying vec3 vMonde;
 varying float vRichesse;
+varying float vJupe;
+${GLSL_ECUME}
+${GLSL_JUPE_MER}
 
 float bruitMer(vec2 q) {
   vec2 i = floor(q);
   vec2 f = fract(q);
   f = f * f * (3.0 - 2.0 * f);
   float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
   float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
   float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
   float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
   return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
 }
 
 void main() {
   // la TERRE ne porte jamais la mer : le fond au-dessus du niveau zéro discarde
   if (vProfondeur <= 0.0) discard;
 
+  // ══════ LE RIDEAU D EAU — Tache P4 ═══════════════════════════════════════
+  //
+  // ⚠️ AVANT LE BORD, ET C EST OBLIGATOIRE : le ruban vit EN RETRAIT de la
+  // frontiere, exactement la ou bordDeMer eteint la nappe. Le passer au test du
+  // bord le ferait disparaitre entierement — ce qui est arrive au premier essai.
+  // ⚠️ ET IL N A PAS D ECUME : le socle n en met pas non plus sur sa jupe.
+  if (vJupe > 0.0) {
+    float grain = bruitMer(vMonde.xz * 6.0 + vMonde.y * 4.0) * 0.5
+                + bruitMer(vMonde.xz * 17.0 - vMonde.y * 9.0) * 0.5;
+    gl_FragColor = couleurJupeMer(uMerFond, uSky, clamp(vJupe, 0.0, 1.0), uMerGivre, 1.0, grain);
+    return;
+  }
+
   // ══════ LE BORD — LA MER S ARRETE OU IL FAUT, ET ELLE SUIT L ESTOMPAGE ════
   //
   // ⚠️ AVANT TOUT LE RESTE, ET C EST UNE ECONOMIE, PAS UN STYLE : au-dela du
   // bord il n y a ni ecume, ni bruit, ni Fresnel a calculer. Meme geste que la
   // sortie anticipee de richesseMer dans le vertex.
   //
   // ⚠️ ET LA MESURE EST CELLE DE LA DECOUPE, PAS UN CARRE. Un max(|u|,|v|)
   // laisserait la mer deborder aux QUATRE COINS arrondis du crop, la ou il n y a
   // plus de bloc dessous. (Aucun accent grave dans ce bloc : template literal.)
-  vec2 cq = max(abs(vCrop) - (1.0 - uCropCoin), 0.0);
+  //
+  // ⛔ ET ELLE ETAIT MUETTE A L INTERIEUR — Tache P4, et c est LA cause du
+  // porte-a-faux, pas un signe inverse dans bordDeMer. Le terme cq est un
+  // max(.., 0) : DEDANS il vaut zero, donc pn vaut zero et dBord se fige a
+  // -uCropCoin. Releve sur la page vivante du 2026-08-22 : uCropCoin vaut ZERO.
+  // dBord valait donc 0 sur TOUT l interieur du crop, et la mesure ne portait
+  // que le dehors. Le fondu de la mer ne pouvait structurellement pas RENTRER :
+  // il ne savait que sortir, et c est ce qu on voit passer par-dessus l arete
+  // haute de la paroi. Le terme min(max(q.x, q.y), 0.0) est la distance
+  // interieure de la boite arrondie (la forme close usuelle) : il vaut ZERO
+  // dehors, donc le dehors reste au bit pres ce qu il etait.
+  vec2 q = abs(vCrop) - (1.0 - uCropCoin);
+  vec2 cq = max(q, 0.0);
   float pn = pow(pow(cq.x, uCropCoinN) + pow(cq.y, uCropCoinN), 1.0 / uCropCoinN);
-  float dBord = pn - uCropCoin; // 0 = la frontiere du crop, > 0 = dehors
+  float dBord = pn - uCropCoin + min(max(q.x, q.y), 0.0); // 0 = frontiere, < 0 = DEDANS
   float bord = 1.0 - smoothstep(uMerBord.x, uMerBord.y, dBord);
   if (bord <= 0.0) discard;
 
   float d01 = clamp(vProfondeur / max(uMerProfMax, 1e-9), 0.0, 1.0);
   // le dégradé lagon vit sur les premiers 15 % du budget — une baie de 30 m est
   // un lagon, le budget couvre des colonnes de mille mètres (ocean.js)
   float dLagon = clamp(vProfondeur / max(uMerProfMax * 0.15, 1e-9), 0.0, 1.0);
   vec3 col = mix(uMerPeu, uMerFond, pow(dLagon, 0.7));
 
   vec3 V = normalize(cameraPosition - vMonde);
@@ -328,28 +405,35 @@ void main() {
     vec2 sm = vLocal / max(uMerLambda, 1e-9);
     float n1 = bruitMer(sm * 0.55 + vec2(uMerTemps * 0.25, -uMerTemps * 0.18));
     float n2 = n1 * bruitMer(sm * 1.35 - vec2(uMerTemps * 0.15, uMerTemps * 0.2)) * 1.6;
     // ⚠️ LA TAVELURE, ET SON ABSENCE SE VOYAIT — ocean.js l explique : « sans
     // elle, le scintillement et les moutons s alignent en rangees paralleles le
     // long de la houle dominante ». Ici elle faisait pire : la premiere version
     // n avait NI la tavelure NI le facteur d echelle d ecume d ocean.js, et la
     // cote a 7,6 km d altitude etait une masse BLANCHE trouee de bleu. Les deux
     // sont remis. (Le nom « patchy » d ocean.js vient de ce que « patch » est un
     // mot reserve du GLSL et tue la compilation.)
-    float tavelure = smoothstep(0.32, 0.72, bruitMer(vLocal * 0.33 / max(uMerLambda, 1e-9) * 0.08 + vec2(uMerTemps * 0.015, -uMerTemps * 0.011)));
-    float moutons = uMerEcume * uMerEcumeEchelle * smoothstep(0.30, 0.60, vCrete) * smoothstep(0.35, 0.75, n2) * (0.5 + 0.5 * tavelure);
-    float bande = 0.5 + 0.5 * sin(vRive * 14.0 - uMerTemps * 1.6 + n1 * 4.0);
-    float largeurRessac = (1.0 - smoothstep(0.10, 0.75, vRive)) * smoothstep(0.002, 0.03, vRive);
-    float ressac = largeurRessac * smoothstep(0.22, 0.55, n1 * 0.6 + bande * 0.4);
-    float lisere = (1.0 - smoothstep(0.0, 0.02, vRive)) * smoothstep(0.25, 0.6, n1 + 0.2);
-    float ecume = clamp((moutons + ressac * 1.8 + lisere * 1.1) * vRichesse, 0.0, 1.0);
-    col = mix(col, vec3(0.96), ecume);
+    // ⛔ ET ELLE ETAIT INDEXEE DANS LA MAUVAISE MONNAIE — Tache P4. ocean.js
+    // ecrit vnoise(xz * 0.33) ou xz est en UNITES DE SOCLE ; cette ligne
+    // divisait par uMerLambda (espace de spectre) puis remultipliait par un
+    // 0.08 qui n existe nulle part chez lui. Mesure sur la page vivante : la
+    // cellule de tavelure faisait 28,4 % de la largeur du bloc contre 5,41 %
+    // sur le socle. CINQ FOIS UN QUART trop large — ce sont LES PLAQUES.
+    float tavelure = tavelureMer(bruitMer(vLocal / max(uMerUnite, 1e-9) * ${FREQ_TAVELURE} + vec2(uMerTemps * 0.015, -uMerTemps * 0.011)));
+    // ⚠️ LA MEME FONCTION QUE LE SOCLE, INJECTEE ET NON RECOPIEE. vRichesse
+    // reste en facteur : c est l echelle d ECHANTILLONNAGE de la calotte (elle
+    // atteint zero et fait sortir le vertex), la ou uMerCalmeVue/Surf sont les
+    // deux echelles de LOOK d ocean.js. Deux echelles, deux roles, toutes deux
+    // presentes — c est exactement ce qui manquait.
+    float ecume = clamp(ecumeMer(vCrete, vFonduRive, n1, n2, tavelure, uMerTemps,
+      uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf) * vRichesse, 0.0, 1.0);
+    col = mix(col, vec3(${BLANC_ECUME.toFixed(2)}), ecume);
     gl_FragColor = vec4(col, bord * max(smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)), ecume * 0.85));
     return;
   }
   gl_FragColor = vec4(col, bord * smoothstep(0.0, uMerSeuilEau, vProfondeur) * mix(0.45, 0.95, pow(dLagon, 0.55)));
 }
 `
 
 // La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
 // `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
 // fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
@@ -3330,24 +3414,63 @@ export class Globe {
     if (!champ) return { refus: 'champ', portee: p }
     // ⚠️ **LE REFUS N'EFFACE RIEN**, et c'est le contrat des maillons écrit dans
     // `branchement-crop.js` : « le refus ne touche pas à ce qui est en place ».
     // Une mer déjà posée survit donc à une reprise qui échoue.
     if (champ.couverture < couvertureMin || (exigerBathy && !champ.bathy)) {
       champ.texture.dispose()
       return { refus: 'champ', portee: p, couverture: champ.couverture, bathy: champ.bathy }
     }
     const cal = construireCalotte({ repere: rep, rayon: R_GLOBE, portee: p, pas, hauteur: epsUnites })
 
+    // ══════ LE RIDEAU D'EAU, CONCATÉNÉ À LA CALOTTE — Tâche P4 ═══════════════
+    //
+    // ⚠️ **CONCATÉNÉ, PAS POSÉ À CÔTÉ.** Un second maillage aurait eu son propre
+    // nuanceur de sommets, donc une seconde écriture du déplacement de houle —
+    // et `ocean.js` dit lui-même ce que ça coûte : « si les deux divergeaient
+    // d'un millimètre, un jour s'ouvrirait entre la jupe et la mer sur tout le
+    // périmètre du bloc ». Ici, le haut du ruban porte le MÊME `aCrop` que la
+    // nappe et traverse les MÊMES lignes : la soudure est structurelle.
+    //
+    // ⚠️ **SANS PAROIS, PAS DE RIDEAU** — et c'est dit dans `_merEtat.jupe`
+    // plutôt que posé sur un fond deviné. `MAILLONS` met `parois` avant `mer`.
+    const basY = this._baseYCrop
+    const rideau = Number.isFinite(basY)
+      ? construireJupeMer({
+        repere: rep,
+        rayon: R_GLOBE,
+        forme: { coin: this.uniforms.uCropCoin.value, expo: this.uniforms.uCropCoinN.value },
+        basY,
+        hauteur: epsUnites,
+      })
+      : null
+
+    const nCal = cal.positions.length / 3
+    const nJup = rideau ? rideau.positions.length / 3 : 0
+    const positions = new Float32Array((nCal + nJup) * 3)
+    const uvs = new Float32Array((nCal + nJup) * 2)
+    const jupes = new Float32Array(nCal + nJup)
+    positions.set(cal.positions, 0)
+    uvs.set(cal.uv, 0)
+    const indices = new Uint32Array(cal.indices.length + (rideau ? rideau.indices.length : 0))
+    indices.set(cal.indices, 0)
+    if (rideau) {
+      positions.set(rideau.positions, nCal * 3)
+      uvs.set(rideau.uv, nCal * 2)
+      jupes.set(rideau.jupe, nCal)
+      for (let i = 0; i < rideau.indices.length; i++) indices[cal.indices.length + i] = rideau.indices[i] + nCal
+    }
+
     const geo = new THREE.BufferGeometry()
-    geo.setAttribute('position', new THREE.BufferAttribute(cal.positions, 3))
-    geo.setAttribute('aCrop', new THREE.BufferAttribute(cal.uv, 2))
-    geo.setIndex(new THREE.BufferAttribute(cal.indices, 1))
+    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
+    geo.setAttribute('aCrop', new THREE.BufferAttribute(uvs, 2))
+    geo.setAttribute('aJupe', new THREE.BufferAttribute(jupes, 1))
+    geo.setIndex(new THREE.BufferAttribute(indices, 1))
     geo.computeBoundingSphere()
 
     // ─── DEUX ÉCHELLES, ET LES CONFONDRE SE VOIT ─────────────────────────────
     //
     // `echelleH` : unités de scène par mètre de SPECTRE — l'échelle des vagues, tirée
     //   du `LEN_SCALE = 0.42` du socle et convertie par la largeur du crop.
     // `maille` : le pas de la grille. C'est LUI qui borne ce que la surface peut
     //   porter, donc lui qui fixe la bascule par la loi d'échantillonnage.
     //
     // ⚠️ **LA PREMIÈRE VERSION SERVAIT `maille` COMME ÉCHELLE DE HOULE**, ce qui
@@ -3377,20 +3500,35 @@ export class Globe {
         uSunDir: u.uSunDir,
         uSunColor: { value: new THREE.Color(0xffffff) },
         uSky: { value: new THREE.Color('#bcd8ea') },
         uMerTemps: { value: 0 },
         uMerHoule: { value: houle },
         uMerChop: { value: chop },
         uMerVitesse: { value: 1 },
         uMerLambda: { value: echelleH },
         uMerMaille: { value: maille },
         uMerPortee: { value: p },
+        // ⚠️ **LA MÊME VALEUR QUE CELLE QUI A NORMALISÉ LE CANAL G** — elle sort
+        // de `_cuireChampMer`, elle n'est pas recalculée ici (Tâche P4).
+        uMerUnite: { value: champ.unite },
+        // ⚠️ **LE FOND DU BLOC, PAS UNE PROFONDEUR À PART** — le rideau descend
+        // jusqu'à `baseY` des parois. Sans parois, aucun sommet de rideau n'est
+        // bâti et cette valeur ne sert à personne : elle vaut alors 0.
+        uMerBasY: { value: Number.isFinite(basY) ? basY : 0 },
+        // ⚠️ **LES DEUX ACCALMIES D'`ocean.js`, AU NEUTRE À LA NAISSANCE.**
+        // `majAccalmieMer` les pose par image depuis les uniformes VIVANTS de la
+        // mer du socle. Laissées au neutre, la mer est celle d'avant P4 au bit
+        // près — c'est l'instrument de banc que D13 §① demande de garder.
+        uMerCalmeVue: { value: ACCALMIE_NEUTRE.vue },
+        uMerCalmeSurf: { value: ACCALMIE_NEUTRE.surface },
+        // le givre du socle de verre — 0 = pas de verre, le neutre exact
+        uMerGivre: { value: 0 },
         uMerDebut: { value: bande.debut },
         uMerFin: { value: bande.fin },
         uMerChamp: { value: champ.texture },
         // ⚠️ ASSIGNÉS APRÈS COUP, comme `_applySea` le fait : `UniformsUtils.merge`
         // clonerait les tableaux à la construction.
         uWaveA: { value: spectre.a },
         uWaveB: { value: spectre.b },
         // ⚠️ LE BUDGET, PAS LA PROFONDEUR RÉELLE — voir `budgetProfondeurM`.
         // Posé sur le maximum du champ (4 310 m), le glacis de lagon couvrait
         // tout ce qui est sous 646 m et peignait la côte en cyan pâle.
@@ -3463,20 +3601,23 @@ export class Globe {
       new THREE.Vector3(cal.base.haut[0], cal.base.haut[1], cal.base.haut[2]),
       new THREE.Vector3(cal.base.sud[0], cal.base.sud[1], cal.base.sud[2])
     )
     M.setPosition(cal.origine[0], cal.origine[1], cal.origine[2])
     M.decompose(mesh.position, mesh.quaternion, mesh.scale)
     this.group.add(mesh)
     this._mer = mesh
     this._merEtat = {
       portee: p, pas, lambda, maille, echelleH, bascule, bande, epsUnites,
       flecheMax: cal.flecheMax, compte: cal.compte,
+      // ⚠️ **ON DIT SI LE RIDEAU EST LÀ.** Un `false` silencieux serait
+      // exactement le genre d'absence que ce chantier met des soirées à lire.
+      jupe: rideau ? { basY, ...rideau.compte } : null,
       couverture: champ.couverture, profMaxUnites: champ.profMaxUnites,
       bathy: champ.bathy,
     }
     this._majBordMer()
     return this._merEtat
   }
 
   /**
    * Recale le bord de la mer sur l'estompage courant — Tâche J.
    *
@@ -3550,40 +3691,49 @@ export class Globe {
     const eau = new Uint8Array(cote * cote)
     let profMaxM = 0
     for (let k = 0; k < cote * cote; k++) {
       const h = brut[k]
       eau[k] = h < 0 ? 1 : 0
       if (-h > profMaxM) profMaxM = -h
     }
     // la cellule, en unités de scène : la largeur de la calotte divisée par N
     const largeurUnites = 2 * portee * repere.demi * CIRCONFERENCE_MERCATOR * (R_GLOBE / EARTH_RADIUS_M)
     const cellule = largeurUnites / N
+    // ⚠️ **L'UNITÉ DE SOCLE, ET IL N'Y EN A QU'UNE ÉCRITURE — Tâche P4.** Elle
+    // servait déjà, en ligne, à normaliser le canal G ; le déclin côtier
+    // d'`ocean.js` en a besoin AUSSI pour rendre la profondeur comparable à
+    // cette distance. Deux écritures de ce facteur remettraient les deux
+    // grandeurs dans deux monnaies, ce qui est exactement le défaut réparé.
+    // ⚠️ **EN MÈTRES MERCATOR, PAS EN MÈTRES VRAIS** : `largeurCropM` porte un
+    // `cos φ` que `largeurUnites` n'a pas. À La Réunion l'écart vaut 6,8 %.
+    const unite = largeurUnites / (COTE_CROP_UNITES * portee)
     const dist = distanceRivage(eau, cote, cellule, { completes: true })
 
     // ⚠️ DEMI-FLOTTANTS ÉCRITS DIRECTEMENT, comme `_bakeField` : à 385² un
     // Float32Array intermédiaire ne servirait qu'à être converti aussitôt.
     const demi = new Uint16Array(cote * cote * 2)
     for (let k = 0; k < cote * cote; k++) {
       demi[k * 2] = THREE.DataUtils.toHalfFloat(brut[k] * echelle)
       // ⚠️ NORMALISÉE SUR 15 UNITÉS DE SOCLE, CONVERTIES — c'est le déclin
       // côtier d'`ocean.js` (`dist / 15`), et le recopier tel quel aurait donné
       // une frange de ressac quinze fois trop large sur le globe.
-      demi[k * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.min(1, dist[k] / (15 * (largeurUnites / (56 * portee)))))
+      demi[k * 2 + 1] = THREE.DataUtils.toHalfFloat(Math.min(1, dist[k] / (15 * unite)))
     }
     const tex = new THREE.DataTexture(demi, cote, cote, THREE.RGFormat, THREE.HalfFloatType)
     tex.magFilter = THREE.LinearFilter
     tex.minFilter = THREE.LinearFilter
     tex.needsUpdate = true
     return {
       texture: tex,
       couverture,
       bathy,
+      unite,
       profMaxUnites: Math.max(profMaxM * echelle, 1e-6),
       profMaxM,
     }
   }
 
   // ═══════════ LE FOND DU CROP — Tâche J bis ════════════════════════════════
   //
   // **Ce que ce maillon ferme, et il a été établi PAR ÉLIMINATION, pas supposé**
   // (Tâche J, §6) : « le champ de la mer a un fond ; la SURFACE du crop n'en a
   // pas ». Les chiffres sont dans l'en-tête de `src/monde/fond-crop.js` et leurs
@@ -3724,20 +3874,54 @@ export class Globe {
     }
     return n
   }
 
   /** Avance le temps de la mer — l'appelant décide de la cadence. */
   animerMer(dt) {
     if (!this._mer) return
     this._mer.material.uniforms.uMerTemps.value += dt
   }
 
+  /**
+   * Pose les deux accalmies d'`ocean.js` sur l'écume de la calotte — Tâche P4.
+   *
+   * ⚠️ **ELLE NE CALCULE RIEN, ELLE POSE.** La loi vit dans `Ocean.setView` et
+   * nulle part ailleurs ; `accalmieDuSocle` (`monde/ecume-mer.js`) ne fait que
+   * lire ses deux uniformes. **Relevé le 2026-08-22 dans la page vivante,
+   * La Réunion z12 : `uViewCalm = 0,4039`, `uSurfCalm = 0,08`** — le ressac du
+   * socle est donc multiplié par **0,0323** là où la calotte le multipliait par
+   * **1**. Trente et une fois.
+   *
+   * ⚠️ **UN ARGUMENT ABSENT OU INCOMPLET REND LE NEUTRE**, c'est-à-dire la mer
+   * d'avant cette tâche au bit près : un demi-couple (une accalmie posée,
+   * l'autre pas) serait pire que pas d'accalmie du tout.
+   *
+   * ⚠️ **ET LE GIVRE ET LE CIEL PASSENT PAR LÀ AUSSI**, pour la même raison :
+   * `poserMer` codait `uSky` en dur (`#bcd8ea` contre `#85c2eb` vivant) et le
+   * rideau d'eau n'avait aucun givre alors que le socle vit à **0,56**.
+   *
+   * @param {{vue:number, surface:number, givre?:number, ciel?:object}|null} [reglages]
+   * @returns {{vue:number, surface:number, givre:number}|null} ce qui a été posé
+   */
+  majReglagesMer(reglages = null) {
+    if (!this._mer) return null
+    const ok = reglages && Number.isFinite(reglages.vue) && Number.isFinite(reglages.surface)
+    const a = ok ? reglages : ACCALMIE_NEUTRE
+    const u = this._mer.material.uniforms
+    u.uMerCalmeVue.value = a.vue
+    u.uMerCalmeSurf.value = a.surface
+    const givre = Number.isFinite(reglages?.givre) ? reglages.givre : 0
+    u.uMerGivre.value = givre
+    if (reglages?.ciel?.isColor) u.uSky.value.copy(reglages.ciel)
+    return { vue: a.vue, surface: a.surface, givre }
+  }
+
   /** Retire la mer — le globe redevient une planète sans eau animée. */
   retirerMer() {
     // ⚠️ LA RAMPE NAUTIQUE S'ÉTEINT MÊME SANS MAILLAGE, et c'est le défaut C-3
     // de la Tâche C appliqué d'avance : là-bas `retirerHabillage` ne rendait
     // que quatre uniformes sur seize, et la planète entière gardait l'intervalle
     // de courbes du crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles :
     // le laisser allumé repeindrait tous les océans du monde.
     const u = this.uniforms
     u.uMerRampeOn.value = 0
     u.uMerFondBudgetM.value = RAMPE_MONDE.profondeur
@@ -3905,20 +4089,27 @@ export class Globe {
     // lui qui rend le RTC gratuit et la verticale UNIQUE (§2 de parois-crop.js).
     const M = new THREE.Matrix4().makeBasis(
       new THREE.Vector3(solide.base.est.x, solide.base.est.y, solide.base.est.z),
       new THREE.Vector3(solide.base.haut.x, solide.base.haut.y, solide.base.haut.z),
       new THREE.Vector3(solide.base.sud.x, solide.base.sud.y, solide.base.sud.z)
     )
     M.setPosition(solide.origine.x, solide.origine.y, solide.origine.z)
     M.decompose(mesh.position, mesh.quaternion, mesh.scale)
     this.group.add(mesh)
     this._parois = mesh
+    // ⚠️ **LE FOND DU BLOC EST RETENU POUR LE RIDEAU D'EAU — Tâche P4.** Le
+    // ruban de mer descend jusqu'à LUI, pas jusqu'à une profondeur à part : deux
+    // fonds auraient laissé un jour ou un chevauchement sur tout le périmètre.
+    // `MAILLONS` met `parois` AVANT `mer`, donc la valeur est là quand `poserMer`
+    // la lit ; si les parois ont refusé, elle est nulle et le rideau n'est pas
+    // bâti (dit dans `_merEtat.jupe`) plutôt que posé sur un fond deviné.
+    this._baseYCrop = solide.baseY
     return { mesh, solide, couverture: solide.couverture, refus: null }
   }
 
   /** Retire les parois — le crop redevient une peau flottante. */
   retirerParoisCrop() {
     if (!this._parois) return
     this.group.remove(this._parois)
     this._parois.geometry.dispose()
     this._parois.material.dispose()
     this._parois = null
diff --git a/src/main.js b/src/main.js
index 50e5fc9..d7b3a85 100644
--- a/src/main.js
+++ b/src/main.js
@@ -11906,20 +11906,31 @@ function tick() {
     // shader de surface : les voisins suivent le temps de la dalle principale
     // (un composant : ils n'avancent pas leur propre horloge) — animation synchrone
     cell.terrain.mapUniforms.uFxTime.value = terrain.mapUniforms.uFxTime.value
     // … et l'horloge du MÉTAL LIQUIDE, pour la même raison et au même titre.
     // Elle manquait : `tickLiquidMetal` n'avance que celle du bloc central, donc
     // le flux de chrome coulait au centre et restait figé sur les voisines —
     // une jointure visible dès que le métal liquide est allumé.
     cell.terrain.mapUniforms.uLmFlow.value = terrain.mapUniforms.uLmFlow.value
   }
   realWater?.setView(camera.position.y, controls.getDistance?.() ?? camera.position.distanceTo(controls.target)) // accalmie altitude + taille des remous de côte selon la distance d'affichage
+  // ══════════ LES DEUX ACCALMIES PASSENT AU CROP — Tâche P4 ═══════════════════
+  //
+  // ⚠️ **JUSTE APRÈS `setView`, ET C'EST TOUT LE POINT** : `setView` est le SEUL
+  // écrivain des deux facteurs, et le crop les LIT à la même image. Les
+  // recalculer côté globe aurait fait deux lois pour une seule grandeur — la
+  // faute que D13 §③ nomme et que ce chantier a déjà payée sur `hNorm` (P2 §3).
+  //
+  // ⚠️ **SANS MER DE SOCLE, `accalmie` REND LE NEUTRE (1, 1)**, c'est-à-dire la
+  // calotte d'avant cette tâche au bit près. Un crop continental ne s'en plaint
+  // pas : il n'a pas de mer à calmer.
+  if (terreUniqueBranchee) globe?.majReglagesMer(realWater?.reglagesMer)
   // PRÉCHAUFFAGE DES SHADERS — voir warmup.js et le rendez-vous en bas de tick.
   // Tant que les programmes ne sont pas compilés on fait tourner TOUTE la
   // logique de l'image (caméra, tweens, nuages, mer, dalles voisines) mais on
   // ne DESSINE pas : c'est le premier dessin qui bloquait le fil principal.
   // ⚠️ Ne pas remonter ce test plus haut. Une première version coupait `tick()`
   // en entier ; la vue isométrique d'ouverture ne s'appliquait alors plus
   // (applyIsoView passe par un tween, et un tween que personne n'avance ne part
   // jamais) et l'ombrage auto lisait un relief qui n'avait pas fini d'arriver.
   // La carte démarrait plus vite ET fausse. Seul le DESSIN doit attendre.
   // ⚠️ La qualité adaptative attend aussi : sans dessin, la cadence mesurée est
diff --git a/src/monde/ecume-mer.js b/src/monde/ecume-mer.js
new file mode 100644
index 0000000..b91d60b
--- /dev/null
+++ b/src/monde/ecume-mer.js
@@ -0,0 +1,231 @@
+// ═══════════ L'ÉCUME DE LA MER — UNE SEULE ÉCRITURE, DEUX LECTEURS ═════════
+//
+// **Tâche P4.** Le noteur : *« l'écume est 7,7 fois trop étendue — et elle est
+// en PLAQUES »*. Son brief attribuait l'écart aux **trois constantes 1,8 / 1,1 /
+// 0,96** de `globe.js`.
+//
+// ⛔ **CE N'EST PAS ELLES, ET LA SOURCE LE DIT** : `1.8`, `1.1` et `vec3(0.96)`
+// sont **identiques** des deux côtés (`ocean.js:565` et `:594` contre
+// `globe.js`, écume de la calotte). Aucune n'a jamais divergé. Ce qui a divergé,
+// ce sont **quatre entrées** que la calotte du globe ne fournissait pas :
+//
+//   ① `ocean.js` ne lit pas la distance au rivage brute : il lit
+//      **`vFade = smoothstep(0, 0.35, max(2 × profondeur, distance))`**
+//      (`ocean.js:255` et `:270`). La calotte passait `champ.g` TEL QUEL, donc
+//      la distance brute, à des seuils (0,002 / 0,03 / 0,10 / 0,75) calés pour
+//      la grandeur fondue. **Mesuré sur le champ vivant de La Réunion : la bande
+//      de ressac couvrait 68,72 % des nœuds d'eau du crop ; avec la grandeur
+//      d'`ocean.js`, 10,41 %.** Le terme de PROFONDEUR est ce qui tue la bande à
+//      quelques centaines de mètres d'une île volcanique.
+//   ② `ocean.js` multiplie le ressac et le liseré par **`uViewCalm × uSurfCalm`**
+//      (`:562` et `:564`) et les moutons par **`uViewCalm`** (`:554`). **Relevé
+//      le 2026-08-22 dans la page vivante : `uViewCalm = 0,4039`,
+//      `uSurfCalm = 0,08`** — soit un facteur **0,0323** sur le ressac, que la
+//      calotte remplaçait par **1**. **Trente et une fois trop.**
+//   ③ le ressac porte aussi `(0,5 + 0,5 × uFoamScale)` (`:562`), absent.
+//   ④ la tavelure d'`ocean.js` est indexée sur `xz` **en unités de socle**
+//      (`:537`) ; la calotte l'indexait en espace de spectre avec un facteur
+//      `0,08` écrit à la main. **Cellules 5,25 fois trop larges : LES PLAQUES.**
+//
+// ➡️ **Ce module porte la loi UNE SEULE FOIS**, en JS (les jumeaux testables) et
+// en GLSL (`GLSL_ECUME`). **`ocean.js` ET `globe.js` injectent ce même texte.**
+// C'est le patron de `naturel-crop.js` (Tâche P2), pour la même raison : deux
+// écritures jumelles divergent, et celle-ci avait déjà divergé sur quatre points.
+//
+// ⚠️ **AUCUNE IMPORTATION** : ce module doit rester chargeable sous node pour
+// que `test/ecume-mer.test.js` exécute ses jumeaux sans WebGL.
+//
+// ⚠️ **CE QUI N'EST PAS ICI, ET POURQUOI** : l'atténuation par le masque côtier
+// (`foam *= 1 − smoothstep(0.35, 0.65, coastLand)`, `ocean.js:569`) reste chez
+// son lecteur. Elle est sous `#ifndef IS_LAKE` là-bas et n'a pas d'équivalent
+// sur la calotte, où la terre est écartée par un `discard` franc
+// (`vProfondeur <= 0.0`) plutôt que par un masque flou. **La porter demanderait
+// de brancher un second échantillonneur sur la mer du globe pour un service que
+// le `discard` rend déjà ; on le dit plutôt que de le faire à moitié.**
+
+/** `smooth01` d'`ocean.js:75`, au caractère près. */
+export function lisse01(t) {
+  const x = Math.min(1, Math.max(0, t))
+  return x * x * (3 - 2 * x)
+}
+
+/** `smoothstep` du GLSL, pour les jumeaux. */
+export function pas0a1(a, b, t) {
+  return lisse01((t - a) / (b - a))
+}
+
+// ── ① LE DÉCLIN CÔTIER ─────────────────────────────────────────────────────
+
+/**
+ * Le facteur de la profondeur dans le déclin côtier. `ocean.js:255` : `* 2.0`.
+ * ⚠️ **C'EST LUI QUI MANQUAIT**, et c'est le plus gros des quatre écarts.
+ */
+export const POIDS_PROFONDEUR = 2
+
+/** La fin de la rampe du repère côtier LARGE. `ocean.js:270` : `0.35`. */
+export const FONDU_RESSAC_FIN = 0.35
+
+/** La fin de la rampe qui tue la houle au rivage. `ocean.js:268` : `0.10`. */
+export const FONDU_HOULE_FIN = 0.1
+
+/**
+ * Le déclin côtier : la PROFONDEUR d'abord, la distance au rivage en secours.
+ *
+ * ⚠️ **LES DEUX SONT EN UNITÉS DE SOCLE** — `ocean.js` compare
+ * `(uWaterY − f.r) * 2.0`, une hauteur du repère du socle, à `f.g`, la distance
+ * normalisée sur quinze de ces mêmes unités. La calotte doit donc convertir sa
+ * profondeur (unités de scène) avant d'appeler : c'est `uMerUnite`.
+ *
+ * @param {number} profondeur en unités de socle
+ * @param {number} distance canal G du champ, déjà normalisé
+ */
+export function declinRivage(profondeur, distance) {
+  return Math.max(profondeur * POIDS_PROFONDEUR, distance)
+}
+
+/** Le repère côtier LARGE que l'écume lit. `ocean.js:270`. */
+export function fonduRessac(declin) {
+  return pas0a1(0, FONDU_RESSAC_FIN, declin)
+}
+
+/** Le fondu qui tue la houle au rivage. `ocean.js:268`. */
+export function fonduHoule(declin) {
+  return pas0a1(0, FONDU_HOULE_FIN, declin)
+}
+
+// ── ② LES DEUX ACCALMIES ───────────────────────────────────────────────────
+
+/**
+ * ⚠️ **LES DEUX ACCALMIES NE SONT PAS RECALCULÉES ICI, ELLES SONT LUES.**
+ * `ocean.js` les pose par image dans `setView` à partir de l'altitude de la
+ * caméra et du rayon d'orbite ; les redériver sur le globe aurait fait **deux
+ * lois** pour une seule grandeur — exactement la faute que D13 §③ nomme. La
+ * calotte prend donc **les valeurs vivantes des uniformes du socle**, comme P2
+ * prend `terrain.mapUniforms.uRampTex` plutôt que de recuire une rampe.
+ *
+ * Ce couple-ci n'est que le NEUTRE : ce que valent les deux facteurs quand il
+ * n'y a pas de mer de socle à lire (crop continental, banc). **`1` des deux
+ * côtés, c'est-à-dire le globe d'avant cette tâche, au bit près** — la vertu
+ * d'instrument de banc que D13 §① demande de garder.
+ */
+export const ACCALMIE_NEUTRE = Object.freeze({ vue: 1, surface: 1 })
+
+/**
+ * Les deux accalmies vivantes du socle, ou le neutre s'il n'y en a pas.
+ *
+ * ⚠️ **ELLE NE CALCULE RIEN** : elle LIT. Le seul écrivain de ces deux valeurs
+ * reste `Ocean.setView` (`ocean.js`), appelé par image depuis `main.js`.
+ *
+ * @param {{uViewCalm?:{value:number}, uSurfCalm?:{value:number}}|null} uniformes
+ */
+export function accalmieDuSocle(uniformes) {
+  const v = uniformes?.uViewCalm?.value
+  const s = uniformes?.uSurfCalm?.value
+  return {
+    vue: Number.isFinite(v) ? v : ACCALMIE_NEUTRE.vue,
+    surface: Number.isFinite(s) ? s : ACCALMIE_NEUTRE.surface,
+  }
+}
+
+// ── ③ LA TAVELURE ET LE BRUIT ──────────────────────────────────────────────
+
+/**
+ * La fréquence de la tavelure, **PAR UNITÉ DE SOCLE**. `ocean.js:537` :
+ * `vnoise(xz * 0.33 + …)` où `xz = vWorld.xz`, donc des unités de socle.
+ *
+ * ⚠️ **LA CALOTTE ÉCRIVAIT `vLocal * 0.33 / uMerLambda * 0.08`**, c'est-à-dire
+ * en espace de SPECTRE avec un facteur `0,08` qui n'existe nulle part dans
+ * `ocean.js`. Relevé sur la page vivante (La Réunion z12,
+ * `uMerLambda = 0,0032204`, largeur du crop `0,429` unité de scène) : la cellule
+ * de tavelure faisait **28,4 % de la largeur du bloc** contre **5,41 %** sur le
+ * socle (`1 / 0,33 / 56`). **5,25 fois trop large — ce sont les plaques.**
+ */
+export const FREQ_TAVELURE = 0.33
+
+/** Les deux bornes du seuil de tavelure. `ocean.js:537`. */
+export const TAVELURE_SEUIL = Object.freeze({ bas: 0.32, haut: 0.72 })
+
+// ── ④ L'ÉCUME ──────────────────────────────────────────────────────────────
+
+/** Les poids des trois termes. `ocean.js:565` : `crestFoam + shoreFoam * 1.8 + swash * 1.1`. */
+export const POIDS_RESSAC = 1.8
+export const POIDS_LISERE = 1.1
+
+/** Le blanc de l'écume. `ocean.js:594` : `vec3(0.96)`. */
+export const BLANC_ECUME = 0.96
+
+/** Les moutons : `ocean.js:554`. */
+export function ecumeMoutons({ foam, foamEchelle, calmeVue, crete, bruit2, tavelure }) {
+  return foam * foamEchelle * calmeVue * pas0a1(0.3, 0.6, crete) * pas0a1(0.35, 0.75, bruit2) * (0.5 + 0.5 * tavelure)
+}
+
+/** La largeur de la bande de ressac : `ocean.js:562`, premier facteur. */
+export function largeurRessac(fade) {
+  return (1 - pas0a1(0.1, 0.75, fade)) * pas0a1(0.002, 0.03, fade)
+}
+
+/** Les fronts qui arrivent vers la côte : `ocean.js:558`. */
+export function frontsRessac(fade, temps, bruit1) {
+  return 0.5 + 0.5 * Math.sin(fade * 14 - temps * 1.6 + bruit1 * 4)
+}
+
+/** Le ressac : `ocean.js:562`. */
+export function ecumeRessac({ fade, temps, bruit1, foamEchelle, calmeVue, calmeSurface }) {
+  const fronts = frontsRessac(fade, temps, bruit1)
+  return largeurRessac(fade) * pas0a1(0.22, 0.55, bruit1 * 0.6 + fronts * 0.4) * (0.5 + 0.5 * foamEchelle) * calmeVue * calmeSurface
+}
+
+/** Le liseré de ressac : `ocean.js:564`. */
+export function ecumeLisere({ fade, bruit1, calmeVue, calmeSurface }) {
+  return (1 - pas0a1(0, 0.02, fade)) * pas0a1(0.25, 0.6, bruit1 + 0.2) * calmeVue * calmeSurface
+}
+
+/** L'écume totale : `ocean.js:565`. */
+export function ecumeMer(a) {
+  const m = ecumeMoutons(a)
+  const r = ecumeRessac(a)
+  const l = ecumeLisere(a)
+  return Math.min(1, Math.max(0, m + r * POIDS_RESSAC + l * POIDS_LISERE))
+}
+
+// ── LE JUMEAU GLSL — LE MÊME TEXTE POUR LES DEUX LECTEURS ──────────────────
+//
+// ⚠️ **L'ORDRE DES FACTEURS EST CELUI D'`ocean.js`, FACTEUR PAR FACTEUR.** La
+// multiplication flottante n'est pas associative : réordonner `a * b * c` en
+// `a * (b * c)` changerait des bits, et la preuve bit-à-bit du socle (§6 du
+// rapport P2, refaite ici) le verrait.
+//
+// ⚠️ **LES CONSTANTES SONT INTERPOLÉES DEPUIS LES EXPORTS CI-DESSUS**, pas
+// réécrites : c'est ce qui permet à `test/ecume-mer.test.js` d'exiger qu'aucune
+// des sept formules ne reparaisse ailleurs dans `ocean.js` ou `globe.js`.
+// (Une campagne de mutation de P2 a survécu parce que ses motifs cherchaient
+// `0.35` dans un texte qui portait `${PART_OMBRAGE.toFixed(2)}` : les motifs de
+// ce module-ci visent les NOMS, pas les chiffres.)
+export const GLSL_ECUME = /* glsl */ `
+// ── ecume-mer.js — INJECTÉ, PAS RECOPIÉ ────────────────────────────────────
+float declinRivageMer(float profondeur, float distance) {
+  return max(profondeur * ${POIDS_PROFONDEUR.toFixed(1)}, distance);
+}
+float fonduRessacMer(float declin) {
+  return smoothstep(0.0, ${FONDU_RESSAC_FIN.toFixed(2)}, declin);
+}
+float fonduHouleMer(float declin) {
+  return smoothstep(0.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin);
+}
+float tavelureMer(float bruit) {
+  return smoothstep(${TAVELURE_SEUIL.bas.toFixed(2)}, ${TAVELURE_SEUIL.haut.toFixed(2)}, bruit);
+}
+float largeurRessacMer(float fade) {
+  return (1.0 - smoothstep(0.10, 0.75, fade)) * smoothstep(0.002, 0.03, fade);
+}
+float ecumeMer(
+  float crete, float fade, float bruit1, float bruit2, float tavelure, float temps,
+  float foam, float foamEchelle, float calmeVue, float calmeSurface
+) {
+  float moutons = foam * foamEchelle * calmeVue * smoothstep(0.30, 0.60, crete) * smoothstep(0.35, 0.75, bruit2) * (0.5 + 0.5 * tavelure);
+  float fronts = 0.5 + 0.5 * sin(fade * 14.0 - temps * 1.6 + bruit1 * 4.0);
+  float ressac = largeurRessacMer(fade) * smoothstep(0.22, 0.55, bruit1 * 0.6 + fronts * 0.4) * (0.5 + 0.5 * foamEchelle) * calmeVue * calmeSurface;
+  float lisere = (1.0 - smoothstep(0.0, 0.02, fade)) * smoothstep(0.25, 0.6, bruit1 + 0.2) * calmeVue * calmeSurface;
+  return clamp(moutons + ressac * ${POIDS_RESSAC.toFixed(1)} + lisere * ${POIDS_LISERE.toFixed(1)}, 0.0, 1.0);
+}
+`
diff --git a/src/monde/mer-sphere.js b/src/monde/mer-sphere.js
index b7741db..b7daf60 100644
--- a/src/monde/mer-sphere.js
+++ b/src/monde/mer-sphere.js
@@ -112,21 +112,21 @@
 //
 //     d = λ · hauteurPx / (2 · parDetail · tan(fov/2))
 //
 // ⚠️ **`parDetail` N'EST PAS UN GOÛT : 2 EST LA BORNE DE NYQUIST**, en dessous
 // de laquelle le détail n'est plus représenté mais REPLIÉ (aliasing). L'Étape 4
 // mesure si 2 suffit *perceptivement* ; c'est elle qui a le dernier mot, et son
 // chiffre est dans le compte rendu.
 
 import { latLonDeLocal } from './crop-sphere.js'
 import { MERCATOR_LAT_MAX } from './seuil-socle.js'
-import { repereLocalCrop, surSphere } from './parois-crop.js'
+import { repereLocalCrop, surSphere, contourCrop, PAS_CONTOUR } from './parois-crop.js'
 import {
   unitesEnMetres,
   largeurCropM,
   COTE_CROP_UNITES,
   EXAG_SOCLE_NOMINALE,
 } from './habillage-crop.js'
 
 // ══════════ ① LA FLÈCHE ════════════════════════════════════════════════════
 
 /**
@@ -426,20 +426,146 @@ export function construireCalotte({ repere, rayon, portee = PORTEE_DEFAUT, pas =
     indices,
     uv,
     origine: O,
     base: { est, haut, sud },
     centre,
     flecheMax,
     compte: { sommets: nV, triangles: n * n * 2, pas: n, portee },
   }
 }
 
+// ══════════ ③bis LE RIDEAU D'EAU — Tâche P4 ════════════════════════════════
+//
+// ⛔ **LA PIÈCE QUE LE SOCLE A ET QUE LE CROP N'AVAIT PAS.** Le noteur (manque
+// n° 4) : *« la nappe de mer et le dessus du bloc ne sont pas la même surface —
+// deux niveaux, un porte-à-faux »*. Le brief l'attribuait à un désaccord entre
+// `poserMer` et `construireParoisCrop`. **Ce n'en est pas un : les deux
+// s'accordent parfaitement.** L'anneau haut de la paroi suit la SURFACE, et sous
+// l'eau la surface est le FOND MARIN : au bord mouillé, la lèvre du bloc plonge
+// à la bathymétrie (−2 116 m relevés à La Réunion) pendant que la nappe reste au
+// niveau zéro. Elle flotte donc au-dessus du vide, et par le trou on voit la
+// face interne de la paroi et le fond du bloc.
+//
+// ⚡ **LE SOCLE A EXACTEMENT LE MÊME BLOC ET PAS LE DÉFAUT, PARCE QU'IL A UN
+// RIDEAU D'EAU** : `ocean.js` bâtit DEUX maillages, la surface (66 049 sommets,
+// renderOrder 18) et une jupe (1 474 sommets, renderOrder 16). **A/B relevé dans
+// la même page le 2026-08-22 : cacher la jupe du socle change 30 453 px (2,97 %
+// du cadre) et fait apparaître le MÊME porte-à-faux au flanc est**
+// (`.banc/vues-P4/Z4-SOCLE-sans-jupe-est.png` contre `-avec-jupe-`).
+//
+// ⚠️ **ELLE EST EN RETRAIT, ET C'EST LE MÊME RETRAIT QUE `bordDeMer`** :
+// `plinth.js` pose l'eau du mode plat à `HALF − chanfrein − marge`, donc DANS le
+// mur. Le rideau du crop vit sur le même anneau, rentré de `RETRAIT_EAU_CROP`.
+//
+// ⚠️ **UN SEUL MAILLAGE, UN SEUL MATÉRIAU, UNE SEULE LOI DE HOULE.** Le ruban
+// est CONCATÉNÉ à la calotte : ses sommets du haut portent le même `aCrop`, donc
+// le nuanceur de sommets leur applique la MÊME houle, au bit près. Un second
+// maillage aurait fallu une seconde écriture du déplacement — et `ocean.js`
+// écrit lui-même ce que ça coûte : « si les deux divergeaient d'un millimètre,
+// un jour s'ouvrirait entre la jupe et la mer sur tout le périmètre du bloc ».
+
+/**
+ * Le rideau d'eau du pourtour du crop, dans le repère LOCAL de la calotte.
+ *
+ * @param {object} arg
+ * @param {{cx:number,cy:number,demi:number}} arg.repere
+ * @param {number} arg.rayon rayon de la sphère (unités de scène)
+ * @param {{coin:number,expo:number}} [arg.forme] la MÊME que la découpe
+ * @param {number} arg.basY le fond du bloc, en Y local — `construireSolideCrop`
+ * @param {number} [arg.hauteur] décalage radial de la surface (epsilon)
+ * @param {number} [arg.retrait] en demi-côtés de crop
+ * @param {number} [arg.pas] espacement de l'anneau
+ * @returns {{positions:Float32Array, uv:Float32Array, jupe:Float32Array,
+ *            indices:Uint32Array, compte:object}}
+ */
+export function construireJupeMer({
+  repere,
+  rayon,
+  forme = { coin: 0, expo: 2 },
+  basY,
+  hauteur = 0,
+  retrait = RETRAIT_EAU_CROP,
+  pas = PAS_CONTOUR,
+} = {}) {
+  if (!repere || !Number.isFinite(repere.demi)) {
+    throw new TypeError('construireJupeMer : il faut un `repere` (repereCrop)')
+  }
+  if (!(rayon > 0)) throw new TypeError('construireJupeMer : `rayon` doit être fini et > 0')
+  if (!Number.isFinite(basY)) throw new TypeError('construireJupeMer : `basY` est obligatoire')
+  const { origine: O, est, haut, sud } = repereLocalCrop(repere, rayon)
+  const anneau = contourCrop(forme.coin ?? 0, forme.expo ?? 2, pas)
+  const n = anneau.length
+  const k = 1 - Math.min(1, Math.max(0, retrait))
+  const R = rayon + hauteur
+
+  const positions = new Float32Array(n * 2 * 3)
+  const uv = new Float32Array(n * 2 * 2)
+  // ⚠️ **0 EN HAUT, 1 EN BAS, ET LA CALOTTE PORTE 0** : le fragment reconnaît le
+  // rideau à `vJupe > 0`, et la valeur EST la profondeur relative que le socle
+  // appelle `g`. Deux usages, une grandeur — pas un drapeau plus un dégradé.
+  const jupe = new Float32Array(n * 2)
+  for (let i = 0; i < n; i++) {
+    const u = anneau[i].u * k
+    const v = anneau[i].v * k
+    const { lat, lon } = latLonDeLocal(u, v, repere)
+    const P = surSphere(lat, lon, R)
+    const d = [P[0] - O[0], P[1] - O[1], P[2] - O[2]]
+    const x = d[0] * est[0] + d[1] * est[1] + d[2] * est[2]
+    const y = d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2]
+    const z = d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2]
+    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z
+    positions[(n + i) * 3] = x; positions[(n + i) * 3 + 1] = basY; positions[(n + i) * 3 + 2] = z
+    uv[i * 2] = u; uv[i * 2 + 1] = v
+    uv[(n + i) * 2] = u; uv[(n + i) * 2 + 1] = v
+    jupe[i] = 0
+    jupe[n + i] = 1
+  }
+
+  // ⚠️ **`DoubleSide` N'EST PAS UNE OPTION ICI** : le rideau se regarde de
+  // l'extérieur, mais un crop vu de l'autre bord montre sa face interne. Le sens
+  // de parcours suit celui des parois (l'anneau est horaire vu du dessus, donc
+  // haut → bas → suivant sort vers le DEHORS).
+  const indices = new Uint32Array(n * 6)
+  let m = 0
+  for (let i = 0; i < n; i++) {
+    const j = (i + 1) % n
+    indices[m++] = i; indices[m++] = n + i; indices[m++] = j
+    indices[m++] = j; indices[m++] = n + i; indices[m++] = n + j
+  }
+  return { positions, uv, jupe, indices, compte: { anneau: n, sommets: n * 2, triangles: n * 2 } }
+}
+
+/**
+ * La couleur du rideau d'eau — **UNE SEULE ÉCRITURE, DEUX LECTEURS.**
+ *
+ * Ce sont les six lignes de `SKIRT_FRAG` (`ocean.js`), extraites plutôt que
+ * recopiées : la calotte du crop en a besoin mot pour mot, et ce chantier a déjà
+ * payé quatre fois une loi de mer écrite deux fois.
+ *
+ * ⚠️ **`givre` EST LE SOCLE DE VERRE, ET LE CROP N'EN A PAS.** Il passe `0`, ce
+ * qui rend `mix(col, …, 0)` et `mix(0.55, 0.94, 0)` exacts : la branche givre
+ * est neutre, pas approximée. Le jour où le crop portera un socle de verre, il
+ * aura le terme sans qu'on l'écrive une seconde fois.
+ * ⚠️ **`jour` VAUT 1 SUR LE CROP** : sa mer n'a pas encore de loi jour/nuit —
+ * `MER_FRAG` n'en porte aucune non plus. Dit ici plutôt que découvert de nuit.
+ */
+export const GLSL_JUPE_MER = /* glsl */ `
+vec4 couleurJupeMer(vec3 fond, vec3 ciel, float g, float givre, float jour, float grain) {
+  vec3 col = fond * mix(1.05, 0.45, g);
+  col *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), jour);
+  col = mix(col, col * 0.75 + ciel * 0.30 * (0.5 + 0.5 * grain), givre * 0.65);
+  float a = mix(0.55, 0.94, givre);
+  a *= 1.0 - 0.15 * (1.0 - givre) * grain;
+  return vec4(col, a);
+}
+`
+
 // ══════════ ④ LA DÉGRADATION ═══════════════════════════════════════════════
 
 const lissage = (a, b, x) => {
   if (!(b > a)) return x < a ? 0 : 1
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
   return t * t * (3 - 2 * t)
 }
 
 /**
  * La richesse de la mer à la distance `d` : 1 de près, 0 au loin.
@@ -692,27 +818,38 @@ export const FRACTION_BANDE_BORD = 0.5
  * Les deux bornes sont exprimées dans la MESURE DE LA DÉCOUPE : `0` est
  * exactement la frontière du crop, `portee − 1` le bord de la calotte. C'est la
  * grandeur que `globe.js` calcule déjà par fragment (`pn − uCropCoin`), donc
  * aucune seconde écriture de la superellipse.
  *
  * ⚠️ **LE SENS N'EST PAS INTERCHANGEABLE.** `estompage = 0` = la planète est
  * ENTIÈRE : la mer peut aller jusqu'au bord de la calotte, elle repose sur des
  * océans dessinés. `estompage = 1` = il ne reste que le crop : la mer doit
  * s'arrêter **au bloc**, sinon c'est le rectangle bleu flottant qu'Adrien a vu.
  *
- * ⚠️ **ET LE PLANCHER N'EST PAS ZÉRO** : à estompage plein, la mer s'éteint sur
- * `RETRAIT_EAU_CROP`, c'est-à-dire sur la largeur exacte du chanfrein et de la
- * marge d'eau du mode plat. Un plancher à zéro ferait une arête dure.
+ * ⛔ **ET LE RETRAIT ALLAIT DANS LE MAUVAIS SENS — Tâche P4.** Il portait
+ * `fin = max(RETRAIT_EAU_CROP, …)`, donc à estompage plein la mer allait
+ * **JUSQU'À `+RETRAIT`, c'est-à-dire 0,22 unité de socle EN DEHORS du crop** :
+ * pleine opacité sur la frontière elle-même, puis un fondu au-dessus du vide.
+ * Or le mode plat fait l'INVERSE — `plinth.js` :
+ * `rayonEauDansSocle() = HALF − SOCLE_CHANFREIN − SOCLE_MARGE_EAU`, l'eau
+ * **RENTRE** de 0,22 unité. Les deux se trompaient donc de **0,44 unité**, dans
+ * des sens opposés, et c'est **le débordement en porte-à-faux** que le noteur a
+ * vu au flanc est (`.banc/vues-P4/Z1-CROP-est.png` : la nappe passe par-dessus
+ * l'arête haute de la paroi, avec le mur qui reparaît dessous).
+ *
+ * ➡️ **À estompage plein, la mer s'éteint donc à `−RETRAIT_EAU_CROP`**, sur une
+ * bande d'une même largeur : exactement le chanfrein et la marge d'eau du socle,
+ * du bon côté de l'arête. Et pas un plancher à zéro : ce serait une arête dure.
  *
  * @param {number} estompage dans [0, 1] — `estompage-terre.js`
  * @param {number} [portee] en demi-côtés de crop
  * @returns {{debut:number, fin:number}} en demi-côtés de crop, mesurés depuis
- *   la frontière du crop (0 = la frontière)
+ *   la frontière du crop (0 = la frontière, négatif = DEDANS)
  */
 export function bordDeMer(estompage, portee = PORTEE_CROP) {
   const brut = Number(estompage)
   const e = Number.isFinite(brut) ? Math.min(1, Math.max(0, brut)) : 0
   const p = Number.isFinite(portee) && portee > 1 ? portee : PORTEE_CROP
-  const fin = Math.max(RETRAIT_EAU_CROP, (p - 1) * (1 - e))
-  const bande = Math.max(RETRAIT_EAU_CROP, fin * FRACTION_BANDE_BORD)
-  return { debut: Math.max(0, fin - bande), fin }
+  const fin = (p - 1) * (1 - e) - RETRAIT_EAU_CROP
+  const bande = Math.max(RETRAIT_EAU_CROP, (fin + RETRAIT_EAU_CROP) * FRACTION_BANDE_BORD)
+  return { debut: fin - bande, fin }
 }
diff --git a/src/ocean.js b/src/ocean.js
index 7774b8d..2d1915f 100644
--- a/src/ocean.js
+++ b/src/ocean.js
@@ -28,21 +28,24 @@ import { lireExageration } from './monde/exageration-continue.js' // un seul par
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
-import { distanceRivage } from './monde/mer-sphere.js'
+import { distanceRivage, GLSL_JUPE_MER } from './monde/mer-sphere.js'
+// L'ÉCUME — une seule loi, deux lecteurs (Tâche P4). Même motif, même absence
+// de cycle : `monde/ecume-mer.js` n'importe RIEN du tout.
+import { GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle } from './monde/ecume-mer.js'
 // L'emprise du DAMIER — même machinerie, autre cause : ici la mer s'étend parce
 // que des cases voisines sont posées, pas parce que le relief défile.
 import { empriseDeMer, coteGeometrique, geometrieDeMer } from './damier-carre.js'
 // wave engine shared with ocean-lab (C:\Dev\ocean-lab) — the Vite alias
 // resolves to the LIVE ocean-lab source when it's cloned next to this repo,
 // to the committed src/vendor/ocean-waves copy otherwise (npm run sync:waves)
 import { makeSeaState, seaStateToUniforms, GERSTNER_GLSL } from 'ocean-waves'
 
 const FIELD_RES = 384 // height/shore field over the whole slab
 
@@ -195,20 +198,21 @@ uniform float uLift;     // élévation du niveau moyen AU LARGE uniquement :
                          // à la côte le niveau meurt exactement à zéro (fade)
 uniform float uWaterY;
 uniform float uHalf;     // le deplacement horizontal des vagues s'annule au
                          // bord du bloc pour rester soude a la jupe laterale
 uniform float uViewCalm; // 1 pres du sol -> 0 en tres haute altitude (la mer
                          // s'aplatit au-dela de ~10 km : vagues/ecume envahissantes)
 uniform float uSurfCalm; // 1 en vue rapprochee -> ~0 en vue large : efface les
                          // remous de cote grossiers quand on s'eloigne
 ${GERSTNER_GLSL}
 ${SHORE_SURF_GLSL}
+${GLSL_ECUME}
 uniform sampler2D uField;   // R ground Y, G shore distance (slab-wide)
 uniform sampler2D uCoastMask; // OSM land/sea (R : 1 land, 0 sea) — the REAL shore
 uniform float uCoastMaskOn;   // 1 when the coast mask is loaded for this patch
 uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
 uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
 uniform vec2 uCentre;   // centre du carré du damier (0 hors damier) — voir FRAG
 uniform float uSpanMasque; // empreinte du masque côtier — voir MASQUE_UV_GLSL
 ${MASQUE_UV_GLSL}
 #ifdef IS_LAKE
 uniform sampler2D uMask;    // A coverage, G shore distance (lake bbox)
@@ -245,36 +249,36 @@ void main() {
   // wash over the coastline polygons
   // ⚠️ MOINS LE CENTRE DU CARRÉ : le champ est cuit AUTOUR de ce centre, qui
   // tombe sur une jointure quand le côté du damier est pair (damier-carre.js).
   // Hors damier uCentre vaut (0,0) et l'expression est celle d'avant.
   vec2 uvF = (xzChamp - uCentre) / uSpan + 0.5;
   vec2 f = texture2D(uField, uvF).rg;
 #ifdef IS_LAKE
   vec2 m = (xz - uMaskMin) / uMaskSize;
   float shoreD = texture2D(uMask, m).g;
 #else
-  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
+  float shoreD = declinRivageMer(uWaterY - f.r, f.g);
   // masque côtier : sur la vraie terre (polders sous 0 compris) houle, ressac
   // et lift meurent — le fragment y discarde le plan, laisser des vagues au
   // bord dessinerait des artefacts de silhouette le long du trait de côte
   if (uCoastMaskOn > 0.5) {
     vec2 uvM = uvMasqueCotier(xzChamp);
     if (uvM.x >= 0.0) shoreD *= 1.0 - texture2D(uCoastMask, uvM).r;
   }
 #endif
   // v45 : les vagues vivent JUSQU'À la côte — le déclin v40 (0.35) aplatissait
   // toute la frange côtière : plus aucune interaction mer/îles. Le niveau
   // moyen (uLift) garde lui sa longue rampe : pas de mur d'eau. vFade reste
   // le repère côtier LARGE du fragment (écume, réfraction).
-  float fade = smoothstep(0.0, 0.10, shoreD);
+  float fade = fonduHouleMer(shoreD);
   float fadeLift = smoothstep(0.0, 0.55, shoreD);
-  vFade = smoothstep(0.0, 0.35, shoreD);
+  vFade = fonduRessacMer(shoreD);
 
   // shared 16-wave random spectrum (ocean-waves lib): two crossed systems
   // (narrow swell + spread wind sea), energy-weighted Gerstner steepness,
   // breaking measured by the surface jacobian (crest ~1 = folding whitecap).
   // The shore fade rides inside: swell dies on the beach, never over land.
   vec3 nAcc;
   float crest;
   vec3 disp = oceanGerstner(xz, uTime, uWaveH * uViewCalm, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
   // houle de côte : fronts qui suivent le trait de côte, gonflent et cassent
   float crestS;
@@ -412,20 +416,21 @@ varying float vFade;
 
 // small tiling value noise for ripples + foam breakup
 float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
 float vnoise(vec2 p) {
   vec2 i = floor(p);
   vec2 f = fract(p);
   f = f * f * (3.0 - 2.0 * f);
   return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
              mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
 }
+${GLSL_ECUME}
 
 // sun caustics — the classic iterated-phase shimmer (Hoskins-style), cheap
 // and convincing where the water is clear
 float caustic(vec2 p, float t) {
   vec2 i = p;
   float c = 1.0;
   for (int n = 0; n < 3; n++) {
     float ft = t * (1.0 - (3.5 / float(n + 1)));
     i = p + vec2(cos(ft - i.x) + sin(ft + i.y), sin(ft - i.y) + cos(ft + i.x));
     c += 1.0 / length(vec2(p.x / (sin(i.x + ft) / 0.6), p.y / (cos(i.y + ft) / 0.6)));
@@ -527,49 +532,43 @@ void main() {
 #endif
   // transp 0 -> teinte pleine uDeep (peinture opaque, eau foncee possible) ;
   // en montant le slider, le glacis clair des faibles profondeurs s'installe
   float lagoonW = smoothstep(0.0, 0.35, uTransp);
   vec3 body = mix(uDeep, mix(uShallowT, uDeep, pow(dRt, 0.7)), lagoonW);
   body *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);
 
   // large-scale patchiness: without it the glitter and the whitecaps line up
   // in parallel rows along the dominant swell — the "repeating waves" flag
   // (named patchy: "patch" is a reserved word in GLSL and kills the compile)
-  float patchy = smoothstep(0.32, 0.72, vnoise(xz * 0.33 + vec2(uTime * 0.015, -uTime * 0.011)));
+  float patchy = tavelureMer(vnoise(xz * ${FREQ_TAVELURE} + vec2(uTime * 0.015, -uTime * 0.011)));
 
   // v44: les reflets (ciel + glint solaire) sont des reflets DE SURFACE :
   // ils s'appliquent APRES le composite de transparence, sinon ils sont
   // dilues comme s'ils venaient du fond — le glint avait disparu (Adrien)
   vec3 col = body;
   vec3 H = normalize(L + V);
   float spec = pow(max(dot(N, H), 0.0), uGloss) * (0.5 + 1.6 * fres);
 
   // foam — v40 : le bruit d'écume vit en ESPACE SPECTRE (xz / uLenScale),
   // il suit donc la taille des vagues à tous les zooms — fini les
   // mouchetures pixel des vues larges, et les moutons redeviennent visibles.
   vec2 sm = xz / max(uLenScale, 1e-4);
   float foamNoise = vnoise(sm * 0.55 + vec2(uTime * 0.25, -uTime * 0.18));
   float foamNoise2 = foamNoise * vnoise(sm * 1.35 - vec2(uTime * 0.15, uTime * 0.2)) * 1.6;
   // moutons : vCrest est le jacobien de déferlement normalisé du spectre
-  // (~1 quand une crête se replie) — intermittent, seules certaines cassent
-  float crestFoam = uFoam * uFoamScale * uViewCalm * smoothstep(0.30, 0.60, vCrest) * smoothstep(0.35, 0.75, foamNoise2) * (0.5 + 0.5 * patchy);
-  // écume de bord : bande étroite là où les vagues meurent (vFade), avec des
-  // fronts qui arrivent vers la côte — l'écume « contact terre/hauts-fonds »
-  // de la version originale, sans le halo du proxy de profondeur
-  float bands = 0.5 + 0.5 * sin(vFade * 14.0 - uTime * 1.6 + foamNoise * 4.0);
-  // v45 : jonction mer-côte des photos de référence — une bande de ressac
-  // texturée qui ourle le trait de côte, plus un LISERÉ net à la ligne d'eau
-  float shoreW = (1.0 - smoothstep(0.10, 0.75, vFade)) * smoothstep(0.002, 0.03, vFade);
-  float shoreFoam = shoreW * smoothstep(0.22, 0.55, foamNoise * 0.6 + bands * 0.4) * (0.5 + 0.5 * uFoamScale) * uViewCalm * uSurfCalm;
-  // liseré de ressac : blanc franc au contact exact, bord cassé par le bruit
-  float swash = (1.0 - smoothstep(0.0, 0.02, vFade)) * smoothstep(0.25, 0.6, foamNoise + 0.2) * uViewCalm * uSurfCalm;
-  float foam = clamp(crestFoam + shoreFoam * 1.8 + swash * 1.1, 0.0, 1.0);
+  // (~1 quand une crête se replie) — intermittent, seules certaines cassent.
+  // Écume de bord : bande étroite là où les vagues meurent (vFade), avec des
+  // fronts qui arrivent vers la côte. Plus un LISERÉ net à la ligne d'eau.
+  // ⚠️ **LES TROIS TERMES VIVENT DANS monde/ecume-mer.js DEPUIS LA TACHE P4** —
+  // la calotte du globe en avait une seconde ecriture qui avait diverge sur
+  // QUATRE points. Le texte est injecte, pas recopie (GLSL_ECUME).
+  float foam = ecumeMer(vCrest, vFade, foamNoise, foamNoise2, patchy, uTime, uFoam, uFoamScale, uViewCalm, uSurfCalm);
 #ifndef IS_LAKE
   // anti-aliasing du trait de côte : le masque est déjà blurré 1.5px, on fond
   // l'eau (couleur ET écume) autour de l'iso 0.5 au lieu d'un bord crénelé
   foam *= 1.0 - smoothstep(0.35, 0.65, coastLand);
 #endif
 
   // v43 : COMPOSITE REFRACTE (grab pass). Le fond deja rendu est
   // echantillonne avec un decalage de Snell : la pente de la surface devie
   // ce qu'on voit a travers. Lisible a toutes les echelles (pas d'attenuation
   // d'altitude), seule la cote l'eteint (vFade).
@@ -621,44 +620,45 @@ uniform float uSurfCalm;
 uniform sampler2D uField;
 uniform sampler2D uCoastMask; // même masque côtier que la surface (R : 1 terre)
 uniform float uCoastMaskOn;
 uniform float uSpan;    // largeur au sol du champ : 56, ou 168 sur l'emprise 3×3
 uniform vec2 uFenetre;  // décalage de lecture du mode continu (0 sinon)
 uniform float uSpanMasque; // empreinte du masque côtier — voir MASQUE_UV_GLSL
 uniform vec2 uCentre;   // centre du carre du damier (0 sinon) — voir FRAG
 ${MASQUE_UV_GLSL}
 ${GERSTNER_GLSL}
 ${SHORE_SURF_GLSL}
+${GLSL_ECUME}
 varying vec3 vWorld;
 varying float vV;
 #include <fog_pars_vertex>
 
 void main() {
   vec3 p = position; // xz = chemin du bord ; y = 0 (fond) / 1 (surface)
   vV = p.y;
   // ══════════ LA JUPE EST TAILLÉE SUR LE SOCLE, ELLE LIT LE MONDE ════════════
   // Le ruban ne bouge pas — c'est le pourtour du bloc. Mais ce qu'il a SOUS lui
   // défile : le fond marin, la distance au rivage, la terre du masque côtier.
   // Il ajoute donc la fenêtre, EXACTEMENT comme la surface de mer — et c'est
   // cette égalité, pas un réglage, qui garantit que les deux restent soudées.
   // Un demi-pixel d'écart entre ces deux expressions ouvrirait un jour de
   // lumière sur tout le périmètre du bloc.
   vec2 uvF = (p.xz + uFenetre - uCentre) / uSpan + 0.5; // champ centré sur le carré
   vec2 f = texture2D(uField, uvF).rg;
-  float shoreD = max((uWaterY - f.r) * 2.0, f.g);
+  float shoreD = declinRivageMer(uWaterY - f.r, f.g);
   // même règle que la surface : les vagues du haut de jupe meurent sur la
   // terre du masque (le fragment discarde ces colonnes, pas de houle au bord)
   if (uCoastMaskOn > 0.5) {
     vec2 uvM = uvMasqueCotier(p.xz + uFenetre);
     if (uvM.x >= 0.0) shoreD *= 1.0 - texture2D(uCoastMask, uvM).r;
   }
-  float fade = smoothstep(0.0, 0.10, shoreD); // v45 : même déclin serré que la surface
+  float fade = fonduHouleMer(shoreD); // v45 : meme declin serre que la surface
   float fadeLift = smoothstep(0.0, 0.55, shoreD);
   float y = uBottomY;
   if (p.y > 0.5) {
     vec3 nAcc;
     float crest;
     vec3 disp = oceanGerstner(p.xz, uTime, uWaveH * uViewCalm, uChop, uSpeedMul, uLenScale, fade, nAcc, crest);
     float crestS;
     vec3 surf = shoreSurf(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm, crestS);
     // MÊME niveau que la surface, DÉFERLEMENT COMPRIS. Aucun relèvement, et la
     // hauteur bornée par la profondeur exactement comme au-dessus : si les deux
@@ -700,48 +700,45 @@ varying float vV;
 #include <fog_pars_fragment>
 
 float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
 float vnoise(vec2 p) {
   vec2 i = floor(p);
   vec2 f = fract(p);
   f = f * f * (3.0 - 2.0 * f);
   return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
              mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
 }
+${GLSL_JUPE_MER}
 
 void main() {
   // pas de jupe devant la terre (côte qui touche le bord du bloc)
   // MÊME expression que le vertex de la jupe et que la surface : c'est ce qui
   // fait qu'en défilant, le rideau d'eau s'efface pile où la côte arrive au bord.
   vec2 uvF = (vWorld.xz + uFenetre - uCentre) / uSpan + 0.5; // champ centré sur le carré
   float ground = texture2D(uField, uvF).r;
   if (uWaterY - ground < -0.005) discard;
   // masque côtier : pas de rideau d'eau devant un polder sous le niveau 0 —
   // la règle altitude ci-dessus ne sait pas qu'il est terre (contrat : masque
   // absent → comportement inchangé)
   if (uCoastMaskOn > 0.5) {
     vec2 uvM = uvMasqueCotier(vWorld.xz + uFenetre);
     if (uvM.x >= 0.0 && texture2D(uCoastMask, uvM).r > 0.5) discard;
   }
 
   float g = clamp((uWaterY - vWorld.y) / max(uWaterY - uBottomY, 1e-3), 0.0, 1.0);
-  vec3 col = uDeep * mix(1.05, 0.45, g); // s'assombrit vers le fond
-  col *= mix(vec3(0.10, 0.16, 0.30), vec3(1.0), uDayLight);
-
-  // verre poli → dépoli : grain + éclaircissement laiteux avec uFrost
+  // verre poli -> depoli : grain + eclaircissement laiteux avec uFrost.
+  // ⚠️ La COULEUR et l ALPHA vivent dans monde/mer-sphere.js (GLSL_JUPE_MER)
+  // depuis la Tache P4 : le rideau d eau du crop lit les MEMES six lignes.
   float grain = vnoise(vWorld.xz * 6.0 + vWorld.y * 4.0) * 0.5
               + vnoise(vWorld.xz * 17.0 - vWorld.y * 9.0) * 0.5;
-  col = mix(col, col * 0.75 + uSky * 0.30 * (0.5 + 0.5 * grain), uFrost * 0.65);
-  float alpha = mix(0.55, 0.94, uFrost);
-  alpha *= 1.0 - 0.15 * (1.0 - uFrost) * grain;
 
-  gl_FragColor = vec4(col, alpha);
+  gl_FragColor = couleurJupeMer(uDeep, uSky, g, uFrost, uDayLight, grain);
   #include <fog_fragment>
 }
 `
 
 // chemin du périmètre arrondi du bloc (mêmes demi-côté et rayon que le clip
 // de la mer) → ruban vertical indexé, y = 0 (fond) / 1 (surface)
 export function buildRimGeometry(half, corner, cornerN = 2) {
   const r = Math.min(Math.max(corner, 0.02), half)
   const sSide = half - r
   const expo = Math.max(2, cornerN)
@@ -1809,20 +1806,48 @@ export class RealWater {
     if (!this._demScale) return
     const km = Math.max(0, (cameraY - (this._seaBase ?? 0)) / this._demScale / 1000)
     const calm = smooth01((25 - km) / 17)
     const surfCalm = viewDist == null ? 1 : 0.08 + 0.92 * smooth01((SURF_FAR - viewDist) / (SURF_FAR - SURF_NEAR))
     for (const mat of this.materials) {
       if (mat.uniforms.uViewCalm) mat.uniforms.uViewCalm.value = 0.08 + 0.92 * calm
       if (mat.uniforms.uSurfCalm) mat.uniforms.uSurfCalm.value = surfCalm
     }
   }
 
+  /**
+   * Les deux accalmies VIVANTES — Tâche P4.
+   *
+   * ⚠️ **ELLES SONT LUES SUR L'UNIFORME, PAS RECOPIÉES DANS UN CHAMP.**
+   * `setView` reste le seul écrivain ; un second stockage aurait pu diverger de
+   * l'uniforme sans que rien ne le dise. La calotte du globe s'en sert pour
+   * doser SON écume, et c'est ce qui fait qu'il n'y a qu'une loi d'accalmie.
+   *
+   * ⚠️ **AUCUN MATÉRIAU → LE NEUTRE.** Pas de mer, pas d'accalmie : la calotte
+   * retrouve alors le globe d'avant P4, au bit près.
+   */
+  get reglagesMer() {
+    const u = this.materials[0]?.uniforms ?? null
+    // ⚠️ **LE GIVRE VIT SUR LE MATÉRIAU DE LA JUPE, PAS SUR CELUI DE LA
+    // SURFACE** — et il vaut **0,56** dans la page vivante du 2026-08-22, pas 0.
+    // Le rideau du crop bâti sans lui rendait un voile PÂLE sur la paroi
+    // terracotta (alpha 0,55 au lieu de 0,768) : vu à l'écran, pas déduit.
+    const j = this.materials.find((m) => m?.uniforms?.uFrost)?.uniforms ?? null
+    return {
+      ...accalmieDuSocle(u),
+      givre: Number.isFinite(j?.uFrost?.value) ? j.uFrost.value : 0,
+      // ⚠️ **ET LE CIEL AUSSI** : `poserMer` codait `#bcd8ea` en dur là où le
+      // socle vit à `#85c2eb`. Même faute que la couleur des parois du crop
+      // (manque n° 2 du noteur), au même endroit du même objet.
+      ciel: u?.uSky?.value ?? null,
+    }
+  }
+
   // Le Y de la surface de mer courante, ou null tant qu'aucune mer n'est
   // construite.
   get seaY() {
     return this.meshes.length ? this._seaBase : null
   }
 
   update(dt, sun) {
     if (!this.meshes.length) return
     this._time += dt
     const dir = sun ? sun.position.clone().normalize() : null
diff --git a/test/ecume-mer.test.js b/test/ecume-mer.test.js
new file mode 100644
index 0000000..382cd84
--- /dev/null
+++ b/test/ecume-mer.test.js
@@ -0,0 +1,545 @@
+// ═══════════ TÂCHE P4 — L'ÉCUME, LE RIDEAU D'EAU, ET LEUR BRANCHEMENT ══════
+//
+// > **Le noteur, 2026-08-22 :** *« l'écume est 7,7 fois trop étendue — et elle
+// > est en PLAQUES »* (manque n° 3) · *« la nappe de mer et le dessus du bloc ne
+// > sont pas la même surface »* (manque n° 4).
+//
+// ⚠️ **CE FICHIER GARDE UNE UNICITÉ, PAS UN GOÛT.** L'écart mesuré ne venait
+// d'aucune constante de style : il venait de ce que la calotte du globe portait
+// une SECONDE ÉCRITURE de la loi d'écume d'`ocean.js`, qui avait divergé sur
+// quatre points. Les sections ① à ③ interdisent que ça recommence ; ④ garde le
+// FIL (la faiblesse récurrente de ce chantier, sept tâches d'affilée) ; ⑤ garde
+// le rideau d'eau ; ⑥ la mesure SIGNÉE du bord.
+//
+// ⚠️ **CHAQUE CONSTANTE EST CONFRONTÉE À `src/ocean.js` RELU SUR LE DISQUE**, pas
+// à un littéral recopié ici : un chiffre recopié dans un test ne rougit pas
+// quand la source change sous lui (§0 du plan, défaut endémique des
+// dénominateurs).
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import {
+  lisse01,
+  pas0a1,
+  POIDS_PROFONDEUR,
+  FONDU_RESSAC_FIN,
+  FONDU_HOULE_FIN,
+  declinRivage,
+  fonduRessac,
+  fonduHoule,
+  ACCALMIE_NEUTRE,
+  accalmieDuSocle,
+  FREQ_TAVELURE,
+  TAVELURE_SEUIL,
+  POIDS_RESSAC,
+  POIDS_LISERE,
+  BLANC_ECUME,
+  ecumeMoutons,
+  largeurRessac,
+  frontsRessac,
+  ecumeRessac,
+  ecumeLisere,
+  ecumeMer,
+  GLSL_ECUME,
+} from '../src/monde/ecume-mer.js'
+import {
+  construireJupeMer,
+  GLSL_JUPE_MER,
+  RETRAIT_EAU_CROP,
+  bordDeMer,
+  PORTEE_CROP,
+} from '../src/monde/mer-sphere.js'
+import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
+
+const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
+const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
+const SRC_MAIN = new URL('../src/main.js', import.meta.url)
+const ocean = () => readFileSync(SRC_OCEAN, 'utf8')
+const globe = () => readFileSync(SRC_GLOBE, 'utf8')
+
+/**
+ * Le corps d'un `const NOM = /* glsl *\/ ` … `` de `globe.js`.
+ * ⚠️ Les COMMENTAIRES sont retirés avant toute recherche de formule : la Tâche
+ * K ter a eu une mutation survivante parce qu'une assertion lisait une formule
+ * dans un pavé de prose.
+ */
+function blocGlsl(src, nom) {
+  const m = new RegExp(`const ${nom} = /\\* glsl \\*/ \`([\\s\\S]*?)\`\\n`).exec(src)
+  assert.ok(m, `bloc ${nom} introuvable`)
+  return m[1]
+}
+const sansCommentaires = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
+
+// ══════════ ① LA LOI PURE, ET CHAQUE CONSTANTE REMONTE À `ocean.js` ════════
+
+test('①a `lisse01` est le `smooth01` d ocean.js, au caractère près', () => {
+  const m = /const smooth01 = \(t\) => \{ const x = Math\.min\(1, Math\.max\(0, t\)\); return x \* x \* \(3 - 2 \* x\) \}/.exec(ocean())
+  assert.ok(m, 'smooth01 a changé de forme dans ocean.js')
+  for (const t of [-1, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 2]) {
+    const x = Math.min(1, Math.max(0, t))
+    assert.equal(lisse01(t), x * x * (3 - 2 * x))
+  }
+})
+
+test('①b le POIDS de la profondeur et les deux fins de rampe sortent d ocean.js', () => {
+  const s = ocean()
+  // `float shoreD = declinRivageMer(uWaterY - f.r, f.g);` — le facteur 2 est
+  // passé dans le module ; c'est LUI qui doit encore valoir 2.
+  assert.match(s, /float shoreD = declinRivageMer\(uWaterY - f\.r, f\.g\);/)
+  assert.equal(POIDS_PROFONDEUR, 2)
+  assert.match(s, /float fade = fonduHouleMer\(shoreD\);/)
+  assert.match(s, /vFade = fonduRessacMer\(shoreD\);/)
+  // les DEUX rampes gardent leurs bornes historiques (0,10 et 0,35)
+  assert.equal(FONDU_HOULE_FIN, 0.1)
+  assert.equal(FONDU_RESSAC_FIN, 0.35)
+  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : `fadeLift` n'est PAS passé au module — il
+  // n'est pas de la loi d'écume, et l'y ranger l'aurait rendu muet.
+  assert.match(s, /float fadeLift = smoothstep\(0\.0, 0\.55, shoreD\);/)
+})
+
+test('①c les poids, le blanc et la tavelure remontent à ocean.js', () => {
+  const s = ocean()
+  // les trois constantes que le brief accusait — et elles n'ont JAMAIS divergé
+  assert.equal(POIDS_RESSAC, 1.8)
+  assert.equal(POIDS_LISERE, 1.1)
+  assert.equal(BLANC_ECUME, 0.96)
+  assert.match(s, /col = mix\(col, vec3\(0\.96\) \* mix\(0\.14, 1\.0, uDayLight\), foam\)/)
+  assert.equal(FREQ_TAVELURE, 0.33)
+  assert.equal(TAVELURE_SEUIL.bas, 0.32)
+  assert.equal(TAVELURE_SEUIL.haut, 0.72)
+  // la tavelure d'ocean.js est indexée sur `xz`, EN UNITÉS DE SOCLE
+  // ⚠️ **LA FRÉQUENCE EST INTERPOLÉE DEPUIS LE MODULE, PAS ÉCRITE** : la source
+  // porte `${FREQ_TAVELURE}`, ce qui est précisément ce qu'on veut garder — une
+  // campagne de mutation de P2 a survécu parce que ses motifs cherchaient un
+  // chiffre dans un texte qui portait un gabarit.
+  assert.match(s, /float patchy = tavelureMer\(vnoise\(xz \* \$\{FREQ_TAVELURE\} \+ vec2\(uTime \* 0\.015, -uTime \* 0\.011\)\)\)/)
+  assert.match(s, /vec2 xz = vWorld\.xz;/)
+})
+
+test('①d le déclin prend la PROFONDEUR quand elle domine, la distance sinon', () => {
+  // ⛔ **C'EST LE TERME QUI MANQUAIT, ET C'EST LE PLUS GROS DES QUATRE.** Sur une
+  // île volcanique le fond plonge en quelques centaines de mètres : c'est lui
+  // qui tue la bande de ressac, pas la distance au rivage.
+  assert.equal(declinRivage(0.5, 0.1), 1) // 2 × 0,5 l'emporte
+  assert.equal(declinRivage(0.01, 0.4), 0.4) // la distance l'emporte
+  assert.equal(declinRivage(0, 0), 0)
+  // et le fondu large VAUT 1 bien avant que la distance n'y arrive seule
+  assert.ok(fonduRessac(declinRivage(0.2, 0)) === 1)
+  assert.ok(fonduRessac(declinRivage(0, 0.2)) < 1)
+})
+
+test('①e la bande de ressac est BORNÉE, et son maximum est là où ocean.js le met', () => {
+  let arg = null
+  let max = -1
+  for (let i = 0; i <= 4000; i++) {
+    const f = i / 4000
+    const w = largeurRessac(f)
+    assert.ok(w >= 0 && w <= 1, `largeur hors [0,1] à ${f}`)
+    if (w > max) { max = w; arg = f }
+  }
+  assert.ok(max > 0.99, `la bande ne monte qu à ${max}`)
+  assert.ok(arg >= 0.03 && arg < 0.10, `plateau à ${arg}`)
+  assert.equal(largeurRessac(0), 0)
+  assert.equal(largeurRessac(1), 0)
+})
+
+test('①e bis les fronts de ressac et `pas0a1` sont ceux du GLSL, pas des jumeaux libres', () => {
+  // `bands = 0.5 + 0.5 * sin(vFade * 14.0 - uTime * 1.6 + foamNoise * 4.0)`
+  for (const [f, t, b] of [[0, 0, 0], [0.5, 1, 0.25], [1, 3.5, 0.9]]) {
+    assert.ok(Math.abs(frontsRessac(f, t, b) - (0.5 + 0.5 * Math.sin(f * 14 - t * 1.6 + b * 4))) < 1e-15)
+  }
+  // ⚠️ **LES FRONTS SONT LA SEULE PART ANIMÉE DE L'ÉCUME** : sans eux la bande
+  // de ressac serait un anneau figé. Ils balaient bien [0, 1].
+  let bas = 1
+  let haut = 0
+  for (let t = 0; t < 12; t += 0.01) { const v = frontsRessac(0.05, t, 0.3); bas = Math.min(bas, v); haut = Math.max(haut, v) }
+  assert.ok(bas < 0.01 && haut > 0.99, `les fronts ne balaient que [${bas}, ${haut}]`)
+  // `pas0a1` est le `smoothstep` du GLSL, bornes comprises
+  assert.equal(pas0a1(0.2, 0.8, 0.1), 0)
+  assert.equal(pas0a1(0.2, 0.8, 0.9), 1)
+  assert.equal(pas0a1(0, 1, 0.5), 0.5)
+})
+
+test('①f l écume est bornée, monotone en accalmie, et NULLE à accalmie nulle', () => {
+  const a = { foam: 1.9, foamEchelle: 1, crete: 1, bruit1: 0.9, bruit2: 1, tavelure: 1, fade: 0.05, temps: 0 }
+  assert.equal(ecumeMer({ ...a, calmeVue: 0, calmeSurface: 0 }), 0)
+  // ⚠️ **`calmeVue = 0` ÉTEINT TOUT, `calmeSurface = 0` ÉTEINT LES DEUX TERMES
+  // DE CÔTE SEULEMENT** — c'est exactement ce que fait `ocean.js`, et c'est ce
+  // qui rend l'un des deux utilisable comme interrupteur de banc.
+  assert.equal(ecumeMoutons({ ...a, calmeVue: 0 }), 0)
+  assert.ok(ecumeMoutons({ ...a, calmeVue: 1 }) > 0)
+  assert.equal(ecumeRessac({ ...a, calmeVue: 1, calmeSurface: 0 }), 0)
+  assert.equal(ecumeLisere({ ...a, fade: 0.001, calmeVue: 1, calmeSurface: 0 }), 0)
+  let prec = -1
+  for (let i = 0; i <= 20; i++) {
+    const v = ecumeMer({ ...a, calmeVue: i / 20, calmeSurface: 1 })
+    assert.ok(v >= prec - 1e-12, `non monotone à ${i}`)
+    assert.ok(v >= 0 && v <= 1)
+    prec = v
+  }
+})
+
+test('①g le facteur perdu du ressac — (0,5 + 0,5 × foamEchelle) — est bien là', () => {
+  // ⚠️ **RELEVÉ SUR LA PAGE VIVANTE LE 2026-08-22** : le socle porte
+  // `uFoamScale = 1`, `uViewCalm = 0,4039`, `uSurfCalm = 0,08`. Le ressac y est
+  // donc multiplié par 1 × 0,4039 × 0,08 = **0,0323**, quand la calotte le
+  // multipliait par **1**. Trente et une fois.
+  const base = { fade: 0.05, temps: 0, bruit1: 0.9, calmeVue: 1, calmeSurface: 1 }
+  const plein = ecumeRessac({ ...base, foamEchelle: 1 })
+  const nul = ecumeRessac({ ...base, foamEchelle: 0 })
+  assert.ok(Math.abs(plein - 2 * nul) < 1e-12, `le facteur d échelle a disparu : ${plein} / ${nul}`)
+  const vivant = ecumeRessac({ ...base, foamEchelle: 1, calmeVue: 0.4039, calmeSurface: 0.08 })
+  assert.ok(Math.abs(vivant / plein - 0.4039 * 0.08) < 1e-12)
+  assert.ok(Math.abs(plein / vivant - 30.95) < 0.02, `rapport ${plein / vivant}`)
+})
+
+// ══════════ ② LE TEXTE GLSL, TRADUIT ET EXÉCUTÉ ════════════════════════════
+//
+// ⚠️ **EXÉCUTÉ, PAS RELU.** Une assertion qui cherche une CHAÎNE dans le GLSL
+// prouve qu'un texte est là, pas qu'il calcule la même chose que le jumeau JS.
+// On traduit le texte du module — celui-là même que les deux nuanceurs
+// injectent — et on le confronte au jumeau sur une grille dont le dénominateur
+// est COMPTÉ PAR LA BOUCLE, pas annoncé par le titre.
+
+function traduire(glsl, nom, params) {
+  const corps = new RegExp(`float ${nom}\\(([\\s\\S]*?)\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(glsl)
+  assert.ok(corps, `fonction ${nom} introuvable dans le GLSL`)
+  const js = corps[2]
+    .replace(/\bfloat\b/g, 'let')
+    .replace(/\bsmoothstep\(/g, 'SS(')
+    .replace(/\bclamp\(/g, 'CL(')
+    .replace(/\bmix\(/g, 'MIX(')
+    .replace(/\bmax\(/g, 'Math.max(')
+    .replace(/\bmin\(/g, 'Math.min(')
+    .replace(/\bsin\(/g, 'Math.sin(')
+    .replace(/\blargeurRessacMer\(/g, 'largeurRessacMer(')
+  const SS = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x) }
+  const CL = (v, a, b) => Math.min(b, Math.max(a, v))
+  const MIX = (a, b, t) => a + (b - a) * t
+  const largeurRessacMer = (f) => (1 - SS(0.1, 0.75, f)) * SS(0.002, 0.03, f)
+  // eslint-disable-next-line no-new-func
+  const f = new Function('SS', 'CL', 'MIX', 'largeurRessacMer', ...params, js)
+  return (...args) => f(SS, CL, MIX, largeurRessacMer, ...args)
+}
+
+test('②a le GLSL `declinRivageMer` calcule ce que le jumeau JS calcule', () => {
+  const g = traduire(GLSL_ECUME, 'declinRivageMer', ['profondeur', 'distance'])
+  let n = 0
+  for (let p = 0; p <= 2; p += 0.05) {
+    for (let d = 0; d <= 1; d += 0.02) {
+      assert.ok(Math.abs(g(p, d) - declinRivage(p, d)) < 1e-12, `${p} ${d}`)
+      n++
+    }
+  }
+  assert.ok(n >= 2000, `${n} points seulement`)
+})
+
+test('②b les deux fondus GLSL suivent leurs jumeaux', () => {
+  const gr = traduire(GLSL_ECUME, 'fonduRessacMer', ['declin'])
+  const gh = traduire(GLSL_ECUME, 'fonduHouleMer', ['declin'])
+  let n = 0
+  for (let d = -0.2; d <= 1.2; d += 0.001) {
+    assert.ok(Math.abs(gr(d) - fonduRessac(d)) < 1e-12, `ressac ${d}`)
+    assert.ok(Math.abs(gh(d) - fonduHoule(d)) < 1e-12, `houle ${d}`)
+    n++
+  }
+  assert.ok(n > 1000, `${n} points seulement`)
+})
+
+test('②c le GLSL `largeurRessacMer` suit son jumeau', () => {
+  const g = traduire(GLSL_ECUME, 'largeurRessacMer', ['fade'])
+  let n = 0
+  for (let f = 0; f <= 1; f += 0.0005) {
+    assert.ok(Math.abs(g(f) - largeurRessac(f)) < 1e-12, `${f}`)
+    n++
+  }
+  assert.ok(n > 1900, `${n} points seulement`)
+})
+
+test('②d le GLSL `ecumeMer` suit son jumeau, terme par terme', () => {
+  const g = traduire(GLSL_ECUME, 'ecumeMer',
+    ['crete', 'fade', 'bruit1', 'bruit2', 'tavelure', 'temps', 'foam', 'foamEchelle', 'calmeVue', 'calmeSurface'])
+  let n = 0
+  let nonNuls = 0
+  for (const crete of [0, 0.3, 0.45, 0.6, 1]) {
+    for (const fade of [0, 0.002, 0.01, 0.05, 0.2, 0.5, 0.75, 1]) {
+      for (const b1 of [0, 0.35, 0.7, 1]) {
+        for (const b2 of [0, 0.5, 0.9]) {
+          for (const tav of [0, 1]) {
+            for (const cv of [0.08, 0.4039, 1]) {
+              for (const cs of [0.08, 1]) {
+                const a = { crete, fade, bruit1: b1, bruit2: b2, tavelure: tav, temps: 3.5, foam: 1.9, foamEchelle: 1, calmeVue: cv, calmeSurface: cs }
+                const attendu = ecumeMer(a)
+                const rendu = g(crete, fade, b1, b2, tav, 3.5, 1.9, 1, cv, cs)
+                assert.ok(Math.abs(rendu - attendu) < 1e-12, `${JSON.stringify(a)} : ${rendu} contre ${attendu}`)
+                if (attendu > 0) nonNuls++
+                n++
+              }
+            }
+          }
+        }
+      }
+    }
+  }
+  // ⚠️ **LE DÉNOMINATEUR EST COMPTÉ, ET LES POINTS NON NULS AUSSI** : une grille
+  // qui ne rendrait que des zéros passerait sans rien prouver.
+  assert.equal(n, 5 * 8 * 4 * 3 * 2 * 3 * 2)
+  assert.ok(nonNuls > n / 4, `seulement ${nonNuls} points non nuls sur ${n}`)
+})
+
+test('②e le GLSL du rideau d eau suit la loi, et le givre nul est EXACT', () => {
+  const m = /vec4 couleurJupeMer\(([\s\S]*?)\)\s*\{([\s\S]*?)\n\}/.exec(GLSL_JUPE_MER)
+  assert.ok(m, 'couleurJupeMer introuvable')
+  const corps = m[2]
+  // givre = 0 : `mix(col, X, 0)` rend col, et `mix(0.55, 0.94, 0)` rend 0,55 —
+  // c'est EXACT en flottant, pas approché. Le crop passe donc 0 sans dette.
+  assert.match(corps, /float a = mix\(0\.55, 0\.94, givre\);/)
+  assert.match(corps, /a \*= 1\.0 - 0\.15 \* \(1\.0 - givre\) \* grain;/)
+  assert.match(corps, /vec3 col = fond \* mix\(1\.05, 0\.45, g\);/)
+  assert.match(corps, /col \*= mix\(vec3\(0\.10, 0\.16, 0\.30\), vec3\(1\.0\), jour\);/)
+})
+
+// ══════════ ③ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════
+
+test('③a aucune des formules d écume ne reparaît dans ocean.js ni dans globe.js', () => {
+  // ⚠️ **COMMENTAIRES RETIRÉS AVANT DE CHERCHER** : une formule citée dans un
+  // pavé de prose a déjà fait passer une mutation pour morte (Tâche K ter).
+  const cibles = [
+    [/uFoam \* uFoamScale \* uViewCalm \* smoothstep/, 'les moutons'],
+    [/uMerEcume \* uMerEcumeEchelle \* smoothstep/, 'les moutons du crop'],
+    [/smoothstep\(0\.002, 0\.03, v(Fade|FonduRive)\)/, 'la bande de ressac'],
+    [/\* 1\.8 \+ \w+ \* 1\.1/, 'la somme pondérée'],
+    [/smoothstep\(0\.0, 0\.35, shoreD\)/, 'le fondu large'],
+    [/smoothstep\(0\.32, 0\.72, (vnoise|bruitMer)/, 'la tavelure'],
+    [/max\(\(uWaterY - f\.r\) \* 2\.0, f\.g\)/, 'le déclin côtier'],
+    [/mix\(0\.55, 0\.94, uFrost\)/, 'l alpha du rideau'],
+  ]
+  for (const src of [sansCommentaires(ocean()), sansCommentaires(globe())]) {
+    for (const [re, quoi] of cibles) {
+      assert.ok(!re.test(src), `${quoi} est réécrit hors du module partagé`)
+    }
+  }
+})
+
+test('③b les deux fichiers INJECTENT le texte partagé, ils ne le recopient pas', () => {
+  const o = ocean()
+  const g = globe()
+  assert.match(o, /import \{ GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle \} from '\.\/monde\/ecume-mer\.js'/)
+  assert.match(g, /import \{ GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE \} from '\.\/monde\/ecume-mer\.js'/)
+  // injecté dans les DEUX nuanceurs de chaque fichier
+  // ⚠️ **TROIS, ET LE TROISIÈME EST LE VERTEX DE LA JUPE DU SOCLE** : il portait
+  // lui aussi sa propre copie du déclin côtier (`max((uWaterY − f.r) * 2.0, f.g)`
+  // et `smoothstep(0.0, 0.10, shoreD)`). ③a l'a trouvée — trois écritures, pas
+  // deux. C'est la neuvième constante muette de ce chantier.
+  assert.equal((o.match(/\$\{GLSL_ECUME\}/g) || []).length, 3,
+    'ocean.js doit injecter dans son vertex, son fragment ET le vertex de sa jupe')
+  assert.equal((g.match(/\$\{GLSL_ECUME\}/g) || []).length, 2, 'globe.js doit injecter dans MER_VERT ET MER_FRAG')
+  assert.equal((o.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
+  assert.equal((g.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
+  // et les DEUX appellent la même fonction
+  assert.match(o, /float foam = ecumeMer\(vCrest, vFade, foamNoise, foamNoise2, patchy, uTime, uFoam, uFoamScale, uViewCalm, uSurfCalm\);/)
+  assert.match(g, /ecumeMer\(vCrete, vFonduRive, n1, n2, tavelure, uMerTemps,\s*\n\s*uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf\)/)
+})
+
+test('③c le module est PUR : aucune importation, donc chargeable sous node', () => {
+  const src = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')
+  assert.ok(!/^\s*import\s/m.test(src), 'ecume-mer.js doit rester sans importation')
+})
+
+// ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════
+
+test('④a `accalmieDuSocle` LIT les uniformes vivants, et rend le neutre sinon', () => {
+  assert.deepEqual(accalmieDuSocle({ uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 } }),
+    { vue: 0.4039, surface: 0.08 })
+  // ⚠️ **LES DEUX CÔTÉS DU COUPLE, ET SÉPARÉMENT.** Une campagne de mutation a
+  // survécu ici : le cas ne portait un NaN que sur `uViewCalm`, et la faute
+  // symétrique sur `uSurfCalm` passait. **Un guet-apens de test qui ne teste
+  // qu'une moitié d'un couple est un guet-apens qui ne teste rien.**
+  const cas = [
+    null, undefined, {},
+    { uViewCalm: { value: NaN }, uSurfCalm: { value: 0.08 } },
+    { uViewCalm: { value: 0.4 }, uSurfCalm: { value: NaN } },
+    { uViewCalm: { value: NaN }, uSurfCalm: { value: NaN } },
+    { uViewCalm: { value: Infinity }, uSurfCalm: { value: null } },
+    { uViewCalm: {}, uSurfCalm: {} },
+  ]
+  for (const mauvais of cas) {
+    const a = accalmieDuSocle(mauvais)
+    assert.ok(Number.isFinite(a.vue), `vue non finie pour ${JSON.stringify(mauvais)}`)
+    assert.ok(Number.isFinite(a.surface), `surface non finie pour ${JSON.stringify(mauvais)}`)
+  }
+  // ⚠️ **LE NEUTRE EST 1, ET C'EST LA CALOTTE D'AVANT P4 AU BIT PRÈS** — la
+  // vertu d'instrument de banc que D13 §① demande de garder.
+  assert.equal(ACCALMIE_NEUTRE.vue, 1)
+  assert.equal(ACCALMIE_NEUTRE.surface, 1)
+})
+
+test('④b `ocean.js` expose ses réglages vivants, GIVRE et CIEL compris', () => {
+  const s = ocean()
+  assert.match(s, /get reglagesMer\(\) \{/)
+  // le givre vit sur le matériau de la JUPE, pas sur celui de la surface :
+  // le chercher sur `materials[0]` aurait rendu 0 sans un mot.
+  assert.match(s, /this\.materials\.find\(\(m\) => m\?\.uniforms\?\.uFrost\)/)
+  assert.match(s, /ciel: u\?\.uSky\?\.value \?\? null/)
+  assert.ok(!/get accalmie\(\)/.test(s), 'l ancien accesseur doit avoir disparu')
+})
+
+test('④c `main.js` pose les réglages à CHAQUE image, juste après `setView`', () => {
+  const s = readFileSync(SRC_MAIN, 'utf8')
+  const i = s.indexOf('realWater?.setView(')
+  const j = s.indexOf('globe?.majReglagesMer(realWater?.reglagesMer)')
+  assert.ok(i > 0 && j > i, 'l appel doit suivre setView, seul écrivain des deux accalmies')
+  // ⚠️ et il est GARDÉ par le drapeau : sans `terre unique`, rien n'est posé
+  assert.match(s.slice(i, j + 80), /if \(terreUniqueBranchee\) globe\?\.majReglagesMer/)
+  // ⚠️ **ET IL N'Y EN A QU'UN** : deux sites poseraient deux valeurs d'une même
+  // image, et c'est le genre d'écart qu'on met des soirées à lire.
+  assert.equal((s.match(/majReglagesMer\(/g) || []).length, 1)
+})
+
+test('④d le nuanceur de la calotte LIT les quatre uniformes neufs', () => {
+  const frag = sansCommentaires(blocGlsl(globe(), 'MER_FRAG'))
+  const vert = sansCommentaires(blocGlsl(globe(), 'MER_VERT'))
+  for (const u of ['uMerCalmeVue', 'uMerCalmeSurf', 'uMerGivre', 'uMerUnite']) {
+    assert.match(frag, new RegExp(`uniform float ${u};`), `${u} non déclaré`)
+    // déclaré ET LU : la Tâche C a payé une fois un uniforme posé et lu par
+    // personne, et la Tâche J en a réveillé deux autres.
+    const lectures = (frag.match(new RegExp(`\\b${u}\\b`, 'g')) || []).length
+    assert.ok(lectures >= 2, `${u} est déclaré mais lu par personne`)
+  }
+  assert.match(vert, /uniform float uMerUnite;/)
+  assert.match(vert, /uniform float uMerBasY;/)
+  assert.match(vert, /vProfondeur \/ max\(uMerUnite, 1e-9\)/)
+  // la tavelure est indexée en UNITÉS DE SOCLE, plus en espace de spectre
+  assert.match(frag, /bruitMer\(vLocal \/ max\(uMerUnite, 1e-9\) \* \$\{FREQ_TAVELURE\}/)
+  assert.ok(!/vLocal \* 0\.33 \/ max\(uMerLambda/.test(frag), 'l ancienne indexation est encore là')
+})
+
+test('④e le canal G du champ et `uMerUnite` sortent de la MÊME expression', () => {
+  const s = globe()
+  // ⚠️ **UNE SEULE ÉCRITURE DU FACTEUR** : la profondeur et la distance au
+  // rivage doivent vivre dans la MÊME monnaie, et c'est tout le défaut réparé.
+  assert.match(s, /const unite = largeurUnites \/ \(COTE_CROP_UNITES \* portee\)/)
+  assert.match(s, /Math\.min\(1, dist\[k\] \/ \(15 \* unite\)\)/)
+  assert.ok(!/largeurUnites \/ \(56 \* portee\)/.test(s), 'le 56 en dur est revenu')
+  assert.match(s, /uMerUnite: \{ value: champ\.unite \}/)
+})
+
+// ══════════ ⑤ LE RIDEAU D'EAU ══════════════════════════════════════════════
+
+const REPERE = { cx: 0.6549072265625, cy: 0.5604248046875, demi: 0.0003662109375 }
+
+test('⑤a le ruban est FERMÉ, en retrait, et son bas tient au fond du bloc', () => {
+  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, hauteur: 0.001 })
+  const n = j.compte.anneau
+  assert.equal(j.compte.sommets, 2 * n)
+  assert.equal(j.compte.triangles, 2 * n)
+  assert.equal(j.indices.length, n * 6)
+  // ⚠️ **FERMÉ** : le dernier segment revient au premier. Un ruban ouvert
+  // laisserait une fente d'un point sur le périmètre, invisible en test et
+  // parfaitement visible à l'écran.
+  const derniers = Array.from(j.indices.slice(n * 6 - 6))
+  assert.ok(derniers.includes(0) && derniers.includes(n), 'le ruban ne se referme pas')
+  // le bas est PLAT, au fond du bloc ; le haut ne l'est pas (la sphère bombe)
+  // Float32 : on compare a la precision du tampon, pas au bit du double
+  for (let i = 0; i < n; i++) assert.ok(Math.abs(j.positions[(n + i) * 3 + 1] + 0.12) < 1e-7)
+  const hauts = new Set()
+  for (let i = 0; i < n; i++) hauts.add(j.positions[i * 3 + 1].toFixed(6))
+  assert.ok(hauts.size > 1, 'le haut du ruban devrait suivre la courbure')
+  // et `aJupe` vaut 0 en haut, 1 en bas — c'est À LA FOIS le drapeau et le `g`
+  for (let i = 0; i < n; i++) { assert.equal(j.jupe[i], 0); assert.equal(j.jupe[n + i], 1) }
+})
+
+test('⑤b le RETRAIT est celui de `plinth.js`, et il rentre DANS le crop', () => {
+  const plein = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.1, retrait: 0 })
+  const rentre = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.1 })
+  let maxPlein = 0
+  let maxRentre = 0
+  for (let i = 0; i < plein.uv.length; i += 2) {
+    maxPlein = Math.max(maxPlein, Math.abs(plein.uv[i]), Math.abs(plein.uv[i + 1]))
+    maxRentre = Math.max(maxRentre, Math.abs(rentre.uv[i]), Math.abs(rentre.uv[i + 1]))
+  }
+  assert.ok(Math.abs(maxPlein - 1) < 1e-6, `sans retrait le ruban doit toucher la frontière : ${maxPlein}`)
+  assert.ok(Math.abs(maxRentre - (1 - RETRAIT_EAU_CROP)) < 1e-6, `avec retrait : ${maxRentre}`)
+  // 0,22 unité de socle, exactement le chanfrein + la marge d'eau du mode plat
+  assert.ok(Math.abs((1 - maxRentre) * (COTE_CROP_UNITES / 2) - 0.22) < 1e-4)
+})
+
+test('⑤c un `basY` absent est une ERREUR, pas un zéro silencieux', () => {
+  // ⚠️ Le §7 de `parois-crop.js` en toutes lettres : un point inconnu posé à
+  // zéro, c'est-à-dire au NIVEAU DE LA MER, creuse une encoche muette. Ici
+  // ce serait un rideau de hauteur nulle sur tout le périmètre.
+  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100 }), /basY/)
+  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100, basY: NaN }), /basY/)
+  assert.throws(() => construireJupeMer({ rayon: 100, basY: 0 }), /repere/)
+  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 0, basY: 0 }), /rayon/)
+})
+
+test('⑤d `poserMer` CONCATÈNE le ruban à la calotte — un seul maillage, une seule houle', () => {
+  const s = globe()
+  assert.match(s, /const rideau = Number\.isFinite\(basY\)\s*\n\s*\? construireJupeMer\(\{/)
+  assert.match(s, /geo\.setAttribute\('aJupe', new THREE\.BufferAttribute\(jupes, 1\)\)/)
+  // l'index du ruban est DÉCALÉ du nombre de sommets de la calotte : sans ce
+  // décalage le ruban replierait la nappe sur elle-même.
+  assert.match(s, /indices\[cal\.indices\.length \+ i\] = rideau\.indices\[i\] \+ nCal/)
+  // et les parois retiennent le fond du bloc pour lui
+  assert.match(s, /this\._baseYCrop = solide\.baseY/)
+  // le nuanceur reconnaît le rideau et le peint AVANT le test du bord
+  const frag = sansCommentaires(blocGlsl(s, 'MER_FRAG'))
+  const iJupe = frag.indexOf('if (vJupe > 0.0)')
+  const iBord = frag.indexOf('float bord =')
+  assert.ok(iJupe > 0 && iBord > iJupe, 'le rideau doit sortir AVANT le fondu de bord, qui l éteindrait')
+  assert.match(frag, /couleurJupeMer\(uMerFond, uSky, clamp\(vJupe, 0\.0, 1\.0\), uMerGivre, 1\.0, grain\)/)
+  // et le bas du ruban ne prend PAS la houle : c'est lui qui tient au fond
+  const vert = sansCommentaires(blocGlsl(s, 'MER_VERT'))
+  assert.match(vert, /bool basDuRideau = aJupe > 0\.5;/)
+  assert.match(vert, /if \(basDuRideau\) p\.y = uMerBasY;/)
+  assert.match(vert, /if \(!basDuRideau\) \{/)
+})
+
+// ══════════ ⑥ LA MESURE SIGNÉE DU BORD ═════════════════════════════════════
+
+test('⑥a le bord de la mer RENTRE, il ne déborde plus', () => {
+  const b = bordDeMer(1, PORTEE_CROP)
+  assert.ok(b.fin < 0, `à estompage plein la mer doit s éteindre DEDANS : ${b.fin}`)
+  assert.ok(Math.abs(b.fin + RETRAIT_EAU_CROP) < 1e-12)
+  assert.ok(b.debut < b.fin)
+})
+
+test('⑥b `dBord` est SIGNÉ — sans quoi le retrait ne peut pas exister', () => {
+  // ⛔ **LA CAUSE RÉELLE DU PORTE-À-FAUX.** `cq` est un `max(…, 0)` : DEDANS il
+  // vaut zéro, `pn` vaut zéro, et `dBord` se fige à `−uCropCoin` — c'est-à-dire
+  // à **0** puisque `uCropCoin` vaut 0 dans l'application vivante. La mesure ne
+  // portait que le DEHORS, et le fondu ne pouvait structurellement pas rentrer.
+  const frag = sansCommentaires(blocGlsl(globe(), 'MER_FRAG'))
+  assert.match(frag, /vec2 q = abs\(vCrop\) - \(1\.0 - uCropCoin\);/)
+  assert.match(frag, /vec2 cq = max\(q, 0\.0\);/)
+  assert.match(frag, /float dBord = pn - uCropCoin \+ min\(max\(q\.x, q\.y\), 0\.0\);/)
+  // le jumeau JS de la mesure, exécuté : dedans NÉGATIF, dehors INCHANGÉ
+  const dBord = (u, v, coin, n) => {
+    const q = [Math.abs(u) - (1 - coin), Math.abs(v) - (1 - coin)]
+    const cq = [Math.max(q[0], 0), Math.max(q[1], 0)]
+    const pn = Math.pow(Math.pow(cq[0], n) + Math.pow(cq[1], n), 1 / n)
+    return pn - coin + Math.min(Math.max(q[0], q[1]), 0)
+  }
+  for (const coin of [0, 0.2]) {
+    // dedans : strictement négatif, et c'est la distance à la frontière
+    assert.ok(Math.abs(dBord(0.5, 0, coin, 2) + 0.5) < 1e-12, `coin ${coin}`)
+    assert.ok(dBord(0, 0, coin, 2) < -0.99)
+    // dehors : le terme intérieur vaut zéro, donc c'est l'expression d'avant
+    assert.ok(dBord(1.5, 0, coin, 2) > 0)
+    // la frontière est bien à zéro
+    assert.ok(Math.abs(dBord(1, 0, coin, 2)) < 1e-12)
+  }
+  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : avec l'ancienne mesure, à `uCropCoin = 0`,
+  // tout l'intérieur rendait exactement 0 — donc un `fin` négatif discardait la
+  // mer ENTIÈRE. C'est ce qui est arrivé au premier essai, à l'écran.
+  const ancien = (u, v, coin, n) => {
+    const cq = [Math.max(Math.abs(u) - (1 - coin), 0), Math.max(Math.abs(v) - (1 - coin), 0)]
+    return Math.pow(Math.pow(cq[0], n) + Math.pow(cq[1], n), 1 / n) - coin
+  }
+  assert.equal(ancien(0.5, 0, 0, 2), 0)
+  assert.equal(ancien(0, 0, 0, 2), 0)
+  assert.ok(bordDeMer(1).fin < ancien(0.5, 0, 0, 2), 'le fondu tomberait entièrement sous la mesure')
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index 37179e7..8d8a1c6 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -53,20 +53,23 @@ import {
   seuilTraitEauM,
   ECHELLE_HOULE_UNITES,
   echelleHouleM,
   RAMPE_NAUTIQUE,
   abscisseNautique,
   PORTEE_CROP,
   RETRAIT_EAU_CROP,
   FRACTION_BANDE_BORD,
   bordDeMer,
 } from '../src/monde/mer-sphere.js'
+// ⚠️ **Tâche P4** : le fondu de rivage n'est plus écrit dans `globe.js`, il est
+// INJECTÉ depuis le module partagé — le test suit donc la valeur à sa source.
+import { FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle } from '../src/monde/ecume-mer.js'
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
@@ -77,21 +80,21 @@ registerHooks({
   },
 })
 import { Globe } from '../src/globe.js'
 import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
 import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
 import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
 // LA LOI DE SURFACE — Tache J bis : l'epsilon de coplanarite depend de son DEFAUT.
 import { altitudeMaillage } from '../src/monde/fond-crop.js'
 import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
 import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
-import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
+import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES, CIRCONFERENCE_M } from '../src/monde/habillage-crop.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 
 // La Réunion — le crop de toutes les tâches de ce chantier.
 const CENTRE = { lat: -21.115, lon: 55.536 }
 const REPERE = repereCrop({ centre: CENTRE })
 const R_TERRE_M = 6371000 // `EARTH_RADIUS_M` de src/geo.js
 const R_GLOBE = 100 // `R_GLOBE` de src/geo.js
 const DEMI_M = largeurCropM(REPERE) / 2
@@ -618,21 +621,27 @@ test('⑤c une mer sans terre reste à l infini, une terre pleine reste à zéro
   const touteTerre = distanceRivage(new Uint8Array(n * n), n, 1)
   for (const v of touteTerre) assert.equal(v, 0)
 })
 
 test('⑤d `ocean.js` A CESSÉ de porter sa propre boucle — garde-fou de SOURCE, déclaré', () => {
   // ⚠️ ASSERTION DE SOURCE, DÉCLARÉE : elle ne prouve pas un comportement, elle
   // garde l'UNICITÉ de la loi. `_bakeField` tire three, donc node ne peut pas
   // l'exécuter — c'est la limite de ce fichier, et elle est écrite en tête.
   const src = readFileSync(SRC_OCEAN, 'utf8')
   assert.ok(!/dist\[k - n - 1\]/.test(src), 'la boucle de chanfrein est encore dans ocean.js')
-  assert.match(src, /import \{ distanceRivage \} from '\.\/monde\/mer-sphere\.js'/)
+  // ⚠️ **Tâche P4** : l'importation en porte maintenant DEUX — `GLSL_JUPE_MER`
+  // est la couleur du rideau d'eau, extraite de `SKIRT_FRAG` pour que le crop
+  // lise les mêmes six lignes. Le garde-fou reste le même : une seule écriture.
+  assert.match(src, /import \{ distanceRivage, GLSL_JUPE_MER \} from '\.\/monde\/mer-sphere\.js'/)
+  assert.ok(!/float alpha = mix\(0\.55, 0\.94, uFrost\)/.test(src),
+    'la couleur du rideau est encore ecrite dans ocean.js')
+  assert.match(src, /gl_FragColor = couleurJupeMer\(uDeep, uSky, g, uFrost, uDayLight, grain\);/)
 })
 
 // ══════════ ⑥ L'EMPRISE ════════════════════════════════════════════════════
 
 test('⑥a à portée 1, l emprise de la calotte EST celle du socle', () => {
   // ⚠️ ELLE N'EST PAS « À PEU PRÈS » CELLE DU SOCLE : c'est par elle que
   // `remplirHauteurs` va chercher la BATHYMÉTRIE FUSIONNÉE, et une emprise
   // décalée d'un demi-texel décalerait tout le fond marin.
   const a = empriseCalotte(REPERE, 1)
   const b = empriseSocle({ centre: CENTRE })
@@ -768,24 +777,30 @@ test('⑧c la rampe nautique du FOND, dans le nuanceur du globe, transcrit le M
 
 test('⑧d le fondu de rivage du nuanceur GARDE son seuil de 0,10, pas approximatif', () => {
   // ⚠️ Tour de correction 1 (constat I3) : `smoothstep(0.0, 0.10, vRive)`
   // n'était protégé par aucun test — muté à `0.40`, 44/44 restait vert. On
   // vérifie la VALEUR exacte du seuil, pas seulement la présence du nom
   // `fade` — le même défaut que le §0 met en garde contre une assertion qui
   // cherche une CHAÎNE plutôt qu'un COMPORTEMENT.
   const src = readFileSync(SRC_GLOBE, 'utf8')
   const bloc = src.match(/\/\/ ══════ LA MER[\s\S]*?\n\}\n`/)
   assert.ok(bloc, 'le bloc de la mer est absent de globe.js')
-  const m = bloc[0].match(/float fade = smoothstep\(([^,]+), ([^,]+), vRive\) \* richesseMer;/)
-  assert.ok(m, 'le fondu de rivage est absent ou d une autre forme')
-  assert.equal(m[1].trim(), '0.0')
-  assert.equal(m[2].trim(), '0.10')
+  // ⚠️ **DEPUIS LA TÂCHE P4 LE SEUIL VIT DANS `monde/ecume-mer.js`** — c'est le
+  // MÊME que celui d'`ocean.js`, et il n'est plus écrit qu'une fois. Le test
+  // garde sa raison d'être (une mutation du seuil doit rougir) mais suit la
+  // valeur à sa source. **Et il exige que le nuanceur appelle la fonction
+  // partagée sur le DÉCLIN, pas sur le fondu** : c'était toute la faute de P4.
+  assert.ok(/float fade = fonduHouleMer\(declin\) \* richesseMer;/.test(bloc[0]),
+    'le fondu de rivage est absent ou d une autre forme')
+  assert.equal(FONDU_HOULE_FIN, 0.1)
+  assert.ok(new RegExp(`smoothstep\\(0\\.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin\\)`).test(GLSL_ECUME),
+    'le seuil du GLSL partagé a bougé')
 })
 
 // ══════════ ⑨ LES QUATRE CONSTANTES DU SOCLE, CONVERTIES ═══════════════════
 //
 // ⚠️ **CES QUATRE-LÀ N'ONT PAS ÉTÉ TROUVÉES PAR LE RAISONNEMENT, MAIS À
 // L'ÉCRAN**, l'une après l'autre, et c'est ce qui les rend intéressantes : rien
 // dans le code ne les signalait, et chacune donnait une image plausible mais
 // fausse. Chaque test porte donc **le chiffre de ce que la faute aurait coûté**,
 // comme `crop-habillage` le fait pour la marge de côte.
 
@@ -1082,46 +1097,63 @@ test('⑪a `RETRAIT_EAU_CROP` est bien celui de `plinth.js`, relu sur le DISQUE'
   // source, exactement comme `mer-emprise.test.js` le fait pour `CHAMP_RES`.
   const src = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
   const chanfrein = Number(/export const SOCLE_CHANFREIN = ([\d.]+)/.exec(src)?.[1])
   const marge = Number(/export const SOCLE_MARGE_EAU = ([\d.]+)/.exec(src)?.[1])
   assert.ok(Number.isFinite(chanfrein) && Number.isFinite(marge), 'les deux constantes doivent être relues')
   const attendu = (chanfrein + marge) / (COTE_CROP_UNITES / 2)
   assert.ok(Math.abs(RETRAIT_EAU_CROP - attendu) < 1e-12, `${RETRAIT_EAU_CROP} contre ${attendu}`)
 })
 
 test('⑪b la mer S ARRÊTE AU BLOC quand la Terre autour est effacée', () => {
-  // estompage = 1 : il ne reste que le crop. Le fondu doit finir SUR la
-  // frontière, à la largeur du chanfrein près — c'est là que `plinth.js`
-  // arrête l'eau du mode plat (`rayonEauDansSocle`).
+  // estompage = 1 : il ne reste que le crop. Le fondu doit finir DANS le crop,
+  // en RETRAIT de la largeur du chanfrein — c'est là que `plinth.js` arrête
+  // l'eau du mode plat (`rayonEauDansSocle = HALF − chanfrein − marge`).
+  //
+  // ⛔ **CE TEST ENCODAIT LE SIGNE INVERSE, ET C'EST CE QUI L'A LAISSÉ PASSER.**
+  // Avant la Tâche P4 il exigeait `fin = +RETRAIT_EAU_CROP`, c'est-à-dire l'eau
+  // 0,22 unité de socle DEHORS, pleine opacité sur l'arête, fondu au-dessus du
+  // vide. Le socle fait exactement l'inverse. **Un test peut verrouiller un
+  // défaut : celui-ci l'a fait pendant tout le chantier.**
   const b = bordDeMer(1)
-  assert.equal(b.debut, 0, 'le fondu commence exactement à la frontière du crop')
-  assert.ok(Math.abs(b.fin - RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin}`)
+  assert.ok(Math.abs(b.fin + RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin} : la mer doit RENTRER`)
+  assert.ok(b.fin < 0, 'à estompage plein la mer s éteint DANS le crop, pas dehors')
+  assert.ok(Math.abs(b.debut + 2 * RETRAIT_EAU_CROP) < 1e-12,
+    `debut ${b.debut} : la bande vaut le retrait, du bon côté de l arête`)
+  // et le témoin de la faute : elle vaut 0,44 unité de socle d'écart avec ce
+  // que le code d'avant posait, dans le sens qui compte
+  assert.ok(Math.abs((RETRAIT_EAU_CROP - b.fin) * (COTE_CROP_UNITES / 2) - 0.44) < 1e-9)
   // ⚠️ **ET LE TÉMOIN QUI COMPTE** : la mer d'avant la Tâche J allait à
   // l'horizon géométrique, soit ~93 demi-côtés à l'altitude de naissance du
   // socle. Trois ordres de grandeur.
   assert.ok(b.fin < porteeHorizon(REPERE, 32274, R_TERRE_M) / 1000)
 })
 
 test('⑪c la mer VA JUSQU AU BORD DE LA CALOTTE quand la planète est entière', () => {
   const b = bordDeMer(0)
-  assert.ok(Math.abs(b.fin - (PORTEE_CROP - 1)) < 1e-12, `fin ${b.fin} contre ${PORTEE_CROP - 1}`)
+  // ⚠️ **LE RETRAIT S APPLIQUE AUSSI ICI, ET IL EST NÉGLIGEABLE ICI** : 0,22
+  // unité de socle sur deux demi-côtés de calotte, soit 0,4 %. On l'écrit
+  // plutôt que de faire deux lois selon l'estompage.
+  assert.ok(Math.abs(b.fin - (PORTEE_CROP - 1 - RETRAIT_EAU_CROP)) < 1e-12, `fin ${b.fin}`)
   // la bande de fondu couvre la fraction annoncée de l'anneau extérieur
-  assert.ok(Math.abs(b.debut - (PORTEE_CROP - 1) * (1 - FRACTION_BANDE_BORD)) < 1e-12)
+  assert.ok(Math.abs(b.debut - ((PORTEE_CROP - 1) * (1 - FRACTION_BANDE_BORD) - RETRAIT_EAU_CROP)) < 1e-12)
 })
 
 test('⑪d le bord est MONOTONE en estompage — c est ce qui interdit un à-coup', () => {
   // ⚠️ **UNE MUTATION DE SIGNE SURVIT À DEUX BORNES SEULES.** On balaie.
   let precedent = Infinity
   for (let i = 0; i <= 40; i++) {
     const b = bordDeMer(i / 40)
     assert.ok(b.fin <= precedent + 1e-12, `la mer ne doit jamais S ÉTENDRE en descendant (${i})`)
-    assert.ok(b.debut >= 0 && b.debut <= b.fin, `bornes incohérentes à ${i} : ${b.debut} / ${b.fin}`)
+    assert.ok(b.debut <= b.fin, `bornes incohérentes à ${i} : ${b.debut} / ${b.fin}`)
+    // la bande a une largeur STRICTEMENT positive à tout estompage : une bande
+    // nulle serait une arête dure, et c'est ce que le plancher interdit
+    assert.ok(b.fin - b.debut >= RETRAIT_EAU_CROP - 1e-12, `bande nulle à ${i}`)
     precedent = b.fin
   }
   // et le SENS n'est pas interchangeable : effacer la Terre RÉTRÉCIT la mer
   assert.ok(bordDeMer(1).fin < bordDeMer(0).fin)
 })
 
 test('⑪e une valeur non finie ne peut pas faire disparaître la mer', () => {
   // même contrat que `poserEstompage` : un NaN dans un uniforme éteint la
   // moitié d'un GPU sans un mot. Ici il retombe sur « la planète est entière ».
   for (const mauvais of [NaN, undefined, null, 'x', {}]) {
@@ -1164,28 +1196,30 @@ test('⑪g le nuanceur de la mer LIT vraiment le bord, et sur la mesure de la D
   assert.equal(sorties.length, 2, 'le fragment a exactement deux sorties')
   for (const s of sorties) assert.ok(/\bbord \*/.test(s), `sortie sans bord : ${s}`)
   // et le rejet anticipé : au-delà du bord, rien n'est calculé
   assert.ok(/if \(bord <= 0\.0\) discard;/.test(frag))
 })
 
 test('⑪h `poserMer` POSE le bord, et `poserEstompage` le RECALE', () => {
   const g = globeAvecCrop()
   return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
     const u = g._mer.material.uniforms.uMerBord.value
+    const attendu = bordDeMer(0, PORTEE_CROP)
     // sans estompage posé, la planète est ENTIÈRE : la mer va au bord
-    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `fin ${u.y}`)
+    assert.ok(Math.abs(u.y - attendu.fin) < 1e-9, `fin ${u.y}`)
     Globe.prototype.poserEstompage.call(g, 1)
-    assert.ok(Math.abs(u.y - RETRAIT_EAU_CROP) < 1e-9, `après estompage plein : ${u.y}`)
-    assert.equal(u.x, 0)
+    assert.ok(Math.abs(u.y + RETRAIT_EAU_CROP) < 1e-9, `après estompage plein : ${u.y}`)
+    assert.ok(u.y < 0, 'la mer doit RENTRER dans le crop, pas déborder — Tâche P4')
+    assert.ok(Math.abs(u.x + 2 * RETRAIT_EAU_CROP) < 1e-9, `debut ${u.x}`)
     // et le retour : `retirerEstompage` rend la planète entière, donc la mer
     Globe.prototype.retirerEstompage.call(g)
-    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `après retrait : ${u.y}`)
+    assert.ok(Math.abs(u.y - attendu.fin) < 1e-9, `après retrait : ${u.y}`)
   })
 })
 
 test('⑪i `poserMer` REFUSE un champ vide, et le refus N EFFACE PAS la mer en place', () => {
   const g = globeAvecCrop()
   const presqueVide = (emprise, n, sortie) => ({ remplis: Math.round(sortie.length * 0.007) })
   return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
     assert.equal(g.group.children.length, 1)
     // le champ mesuré à 0,7 % de couverture — celui de l'aplat gris
     return Globe.prototype.poserMer.call(g, { remplir: presqueVide, portee: PORTEE_CROP, couvertureMin: 0.99 })
@@ -1213,10 +1247,192 @@ test('⑪j `exigerBathy` attend la nappe, et un `remplir` MUET garde le défaut
   }).then((r) => {
     assert.equal(r.bathy, false)
     assert.equal(g.group.children.length, 1)
     // et un `remplir` MUET — tout appelant d'avant la Tâche J — garde `true`
     return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP, exigerBathy: true })
   }).then((r) => {
     assert.equal(r.refus, undefined, 'un remplir muet ne doit pas se mettre à refuser')
     assert.equal(r.bathy, true)
   })
 })
+
+// ══════════ ⑫ CE QUE `poserMer` ET `majReglagesMer` POSENT VRAIMENT ════════
+//
+// ⛔ **CES NEUF TESTS SONT NÉS D'UNE CAMPAGNE DE MUTATION, PAS D'UNE INTUITION.**
+// Premier tour de la Tâche P4 : **28 / 37**, et les NEUF survivantes visaient
+// toutes le même trou — le corps de `majReglagesMer` et les uniformes que
+// `poserMer` écrit n'étaient gardés que par des assertions de SOURCE. Une
+// assertion qui lit un fichier prouve qu'un texte est là ; elle ne prouve pas
+// qu'il pose la bonne valeur. **On EXÉCUTE.**
+//
+// ⚠️ Et aucune des neuf n'était du code mort : elles sont toutes sur le chemin
+// vivant de l'image (`main.js` appelle `majReglagesMer` à chaque image).
+
+function merPosee(arg = {}) {
+  const g = globeAvecCrop()
+  return Globe.prototype.poserMer
+    .call(g, { remplir: remplirBouchon, portee: PORTEE_CROP, ...arg })
+    .then((r) => ({ g, r, u: g._mer.material.uniforms }))
+}
+
+test('⑫a `majReglagesMer` pose les DEUX accalmies, le givre et le ciel', () => {
+  return merPosee().then(({ g, u }) => {
+    const ciel = { isColor: true }
+    const cible = { isColor: true, copy(c) { this.recu = c } }
+    u.uSky.value = cible
+    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 0.4039, surface: 0.08, givre: 0.56, ciel })
+    assert.equal(u.uMerCalmeVue.value, 0.4039)
+    assert.equal(u.uMerCalmeSurf.value, 0.08, 'la seconde accalmie doit être posée AUSSI')
+    assert.equal(u.uMerGivre.value, 0.56, 'le givre du socle de verre doit être posé')
+    assert.equal(cible.recu, ciel, 'le ciel doit être COPIÉ, pas remplacé')
+    assert.deepEqual(pose, { vue: 0.4039, surface: 0.08, givre: 0.56 })
+  })
+})
+
+test('⑫b un demi-couple retombe sur le NEUTRE — pas sur une moitié d accalmie', () => {
+  return merPosee().then(({ g, u }) => {
+    // ⚠️ **UN DEMI-COUPLE EST PIRE QUE PAS D ACCALMIE DU TOUT** : le ressac
+    // serait multiplié par 0,08 pendant que les moutons resteraient à 1.
+    for (const mauvais of [{ vue: 0.4, surface: NaN }, { vue: NaN, surface: 0.08 }, {}, null, undefined]) {
+      Globe.prototype.majReglagesMer.call(g, mauvais)
+      assert.equal(u.uMerCalmeVue.value, 1, `${JSON.stringify(mauvais)}`)
+      assert.equal(u.uMerCalmeSurf.value, 1, `${JSON.stringify(mauvais)}`)
+    }
+    // et un givre non fini ne passe pas dans l'uniforme
+    Globe.prototype.majReglagesMer.call(g, { vue: 0.4, surface: 0.08, givre: NaN })
+    assert.equal(u.uMerGivre.value, 0)
+  })
+})
+
+test('⑫c un NaN d accalmie ne peut pas atteindre l uniforme', () => {
+  // ⚠️ Même contrat que `poserEstompage` : un NaN dans un uniforme éteint la
+  // moitié d'un GPU sans un mot. `accalmieDuSocle` le filtre à la source.
+  return merPosee().then(({ g, u }) => {
+    const socle = { uViewCalm: { value: NaN }, uSurfCalm: { value: NaN } }
+    Globe.prototype.majReglagesMer.call(g, accalmieDuSocle(socle))
+    assert.ok(Number.isFinite(u.uMerCalmeVue.value) && Number.isFinite(u.uMerCalmeSurf.value))
+    assert.equal(u.uMerCalmeVue.value, 1)
+  })
+})
+
+test('⑫d sans mer posée, `majReglagesMer` rend `null` et n écrit nulle part', () => {
+  const g = globeAvecCrop()
+  assert.equal(Globe.prototype.majReglagesMer.call(g), null)
+})
+
+test('⑫e `uMerUnite` EST le facteur qui a normalisé le canal G', () => {
+  return merPosee().then(({ u }) => {
+    // recalculé ICI depuis les grandeurs du repère, pas repris de la méthode
+    const largeur = 2 * PORTEE_CROP * REPERE.demi * CIRCONFERENCE_M * (R_GLOBE / R_TERRE_M)
+    const attendu = largeur / (COTE_CROP_UNITES * PORTEE_CROP)
+    assert.ok(Math.abs(u.uMerUnite.value - attendu) < 1e-15, `${u.uMerUnite.value} contre ${attendu}`)
+    // ⚠️ **ET IL EST EN MÈTRES MERCATOR, PAS EN MÈTRES VRAIS** : `largeurCropM`
+    // porte un `cos φ` que `largeurUnites` n'a pas. À La Réunion l'écart vaut
+    // 6,8 %, et c'est exactement la sorte de conversion à moitié faite que ce
+    // chantier a payée quatre fois.
+    const vrai = (largeurCropM(REPERE) * (R_GLOBE / R_TERRE_M)) / COTE_CROP_UNITES
+    assert.ok(Math.abs(u.uMerUnite.value / vrai - 1) > 0.05,
+      'les deux conventions doivent différer, sinon le test ne distingue rien')
+  })
+})
+
+test('⑫f le rideau d eau descend au fond DES PAROIS, et le dit', () => {
+  const g = globeAvecCrop()
+  g._baseYCrop = -0.1337
+  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then((r) => {
+    const u = g._mer.material.uniforms
+    assert.equal(u.uMerBasY.value, -0.1337, 'l uniforme doit porter le fond des parois')
+    assert.ok(r.jupe, 'l état doit DIRE que le rideau est là')
+    assert.equal(r.jupe.basY, -0.1337)
+    assert.ok(r.jupe.anneau > 100 && r.jupe.sommets === 2 * r.jupe.anneau)
+    // le maillage porte vraiment l'attribut, et il vaut 1 sur la moitié basse
+    const aJupe = g._mer.geometry.getAttribute('aJupe')
+    assert.ok(aJupe, 'l attribut aJupe doit être posé sur la géométrie')
+    let uns = 0
+    for (let i = 0; i < aJupe.array.length; i++) if (aJupe.array[i] === 1) uns++
+    assert.equal(uns, r.jupe.anneau, 'exactement l anneau BAS doit valoir 1')
+    // ⚠️ **ET LES INDEX DU RIDEAU SONT DÉCALÉS** : sans le décalage ils
+    // pointeraient sur la calotte et replieraient la nappe sur elle-même.
+    const idx = g._mer.geometry.getIndex().array
+    let maxi = 0
+    for (let i = 0; i < idx.length; i++) if (idx[i] > maxi) maxi = idx[i]
+    assert.equal(maxi, g._mer.geometry.getAttribute('position').count - 1)
+    assert.ok(maxi >= r.compte.sommets, 'le rideau doit vivre APRÈS la calotte dans l index')
+  })
+})
+
+test('⑫g sans parois, PAS de rideau — et l état le dit plutôt que de le taire', () => {
+  const g = globeAvecCrop() // `_baseYCrop` absent : les parois ont refusé
+  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then((r) => {
+    assert.equal(r.jupe, null, 'l état doit DIRE qu il n y a pas de rideau')
+    assert.equal(g._mer.material.uniforms.uMerBasY.value, 0)
+    const aJupe = g._mer.geometry.getAttribute('aJupe')
+    assert.ok(aJupe, 'l attribut reste déclaré — le nuanceur le lit toujours')
+    for (let i = 0; i < aJupe.array.length; i++) assert.equal(aJupe.array[i], 0)
+    assert.equal(aJupe.count, r.compte.sommets, 'aucun sommet de rideau ne doit être bâti')
+  })
+})
+
+test('⑫h `construireParoisCrop` RETIENT le fond du bloc pour la mer', () => {
+  // ⚠️ `MAILLONS` met `parois` AVANT `mer` : c'est ce qui rend la valeur
+  // disponible. Un refus de couverture ne doit RIEN retenir.
+  const solide = construireSolideCrop({
+    repere: REPERE,
+    forme: { coin: 0, expo: 2 },
+    hauteur: () => 100,
+    rayon: R_GLOBE,
+    echelle: (R_GLOBE / R_TERRE_M) * EXAG_SOCLE_NOMINALE,
+  })
+  assert.ok(Number.isFinite(solide.baseY) && solide.baseY < 0, `baseY ${solide.baseY}`)
+  const src = readFileSync(SRC_GLOBE, 'utf8')
+  assert.match(src, /this\._baseYCrop = solide\.baseY/)
+  // et il n'est posé qu'APRÈS le refus : une paroi refusée n'écrit rien
+  const iRefus = src.indexOf('if (solide.refus) return { mesh: null, solide')
+  const iPose = src.indexOf('this._baseYCrop = solide.baseY')
+  assert.ok(iRefus > 0 && iPose > iRefus)
+})
+
+test('⑫i le champ de la mer REND son unité — un seul calcul, deux lecteurs', () => {
+  // ⚠️ La mutation « le champ ne rend plus son unité » survivait : rien
+  // n'exigeait que `_cuireChampMer` la publie, alors que c'est le seul moyen
+  // que l'uniforme et le canal G partagent le MÊME nombre.
+  const g = globeAvecCrop()
+  const champ = Globe.prototype._cuireChampMer.call(g, {
+    repere: REPERE,
+    portee: PORTEE_CROP,
+    remplir: remplirBouchon,
+    echelle: (R_GLOBE / R_TERRE_M) * EXAG_SOCLE_NOMINALE,
+  })
+  assert.ok(Number.isFinite(champ.unite) && champ.unite > 0, `unite ${champ.unite}`)
+  const largeur = 2 * PORTEE_CROP * REPERE.demi * CIRCONFERENCE_M * (R_GLOBE / R_TERRE_M)
+  assert.ok(Math.abs(champ.unite - largeur / (COTE_CROP_UNITES * PORTEE_CROP)) < 1e-15)
+  champ.texture.dispose?.()
+})
+
+test('⑫j `reglagesMer` d `ocean.js` LIT vraiment ses trois réglages — exécuté', async () => {
+  // ⚠️ **IMPORTATION DYNAMIQUE, ET C'EST OBLIGATOIRE** : une `import` statique
+  // est hissée AU-DESSUS de `registerHooks`, et `ocean-waves` n'est alors plus
+  // résolu. Le fichier tombe entier avec un `ERR_MODULE_NOT_FOUND` — vu.
+  const { RealWater } = await import('../src/ocean.js')
+  // ⛔ **DIXIÈME SURVIVANTE DE LA CAMPAGNE, ET ELLE A TROUVÉ UN VRAI TROU.**
+  // « le givre du socle ne traverse pas » restait verte : l'accesseur n'était
+  // gardé que par un `grep` de sa ligne de recherche du matériau, pas par un
+  // appel. On l'EXÉCUTE, sur un objet minimal qui porte exactement ce qu'il lit.
+  //
+  // ⚠️ **LE GIVRE VIT SUR LE SECOND MATÉRIAU** — celui de la jupe — et c'est
+  // tout le piège : `materials[0]` n'a pas d'`uFrost`, donc une recherche naïve
+  // rendrait 0 sans un mot. Le faux socle le reproduit exprès.
+  const d = Object.getOwnPropertyDescriptor(RealWater.prototype, 'reglagesMer')
+  assert.equal(typeof d?.get, 'function', 'reglagesMer doit être un accesseur')
+  const ciel = { isColor: true }
+  const socle = {
+    materials: [
+      { uniforms: { uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 }, uSky: { value: ciel } } },
+      { uniforms: { uFrost: { value: 0.56 } } },
+    ],
+  }
+  assert.deepEqual(d.get.call(socle), { vue: 0.4039, surface: 0.08, givre: 0.56, ciel })
+  // sans mer construite : le NEUTRE, c'est-à-dire la calotte d'avant P4
+  assert.deepEqual(d.get.call({ materials: [] }), { vue: 1, surface: 1, givre: 0, ciel: null })
+  // un givre non fini ne remonte pas
+  assert.equal(d.get.call({ materials: [{ uniforms: { uFrost: { value: NaN } } }] }).givre, 0)
+})
