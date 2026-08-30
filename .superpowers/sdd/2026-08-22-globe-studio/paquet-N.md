62c05fc tache N : au repos, le crop SEUL — on cesse de PARCOURIR le dehors

 package.json                  |   2 +-
 src/globe.js                  | 156 ++++++++-
 src/main.js                   |  37 +++
 src/monde/branchement-crop.js | 100 +++++-
 src/monde/estompage-terre.js  |  44 ++-
 src/monde/veille-repos.js     | 201 ++++++++++++
 test/veille-repos.test.js     | 737 ++++++++++++++++++++++++++++++++++++++++++
 7 files changed, 1256 insertions(+), 21 deletions(-)

diff --git a/package.json b/package.json
index ec900b8..8d07054 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js",
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
index e6ae80d..f1af141 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -11,21 +11,21 @@
 // (plan « globe continu », Tâche 4 alpha) — voir `planTuile` plus bas, et sa
 // borne `SEUIL_SOURCE_FINE`.
 
 import * as THREE from 'three'
 import { R_GLOBE, MERCATOR_MAX_LAT, EARTH_RADIUS_M, tileToLatLon, latLonToSphere } from './geo.js'
 import { rampColorStops } from './palette.js'
 import { GlobeClouds } from './globe-clouds.js'
 import { overzoomTile } from './bathy.js'
 // LA FORME DU CROP — Tâche A, « UNE SEULE TERRE ». Module PUR : il n'apporte ni
 // three ni DOM, et c'est lui qui lit `empriseSocle`, pas ce fichier.
-import { repereCrop, coinNormalise, zoomCropPrescrit, mercX, mercY } from './monde/crop-sphere.js'
+import { repereCrop, coinNormalise, zoomCropPrescrit, tuileDansCrop, mercX, mercY } from './monde/crop-sphere.js'
 // LES PAROIS ET LA BASE — Tâche B. Pur lui aussi : il ne rend que des nombres,
 // c'est ce fichier-ci qui en fait une géométrie three.
 import { construireSolideCrop } from './monde/parois-crop.js'
 import { margeCoteDuCrop, intervalleCourbes, HABILLAGE_MONDE, CIRCONFERENCE_M } from './monde/habillage-crop.js'
 import {
   RAMPE_MONDE,
   PAS_MESURE,
   mesurerRelief,
   echelleRampe,
   plancherRampeDuCrop,
@@ -1595,20 +1595,32 @@ export class Globe {
     this.continu = params.globeContinu ?? false
     // LA FRONTIÈRE DE RENDU — Tâche 1b bis. Posé par `main.js` quand le globe
     // passe dans sa propre scène de fond ; voir `setVisible`, qui cesse alors
     // d'être l'interrupteur. Déclaré ici pour qu'il ne naisse pas `undefined`
     // au détour d'une lecture.
     this.frontiereFond = false
     // LE CROP — Tâche A. `null` = pas de découpe, et c'est l'état de production.
     // Écrit par `poserCrop`, lu par `_traverse` (le raffinement uniforme) ; la
     // découpe elle-même se fait au fragment, par les uniformes `uCrop*`.
     this._crop = null
+    // LE CROP SEUL — Tâche N, « LE STUDIO SUR LE GLOBE ». `false` = le parcours
+    // d'avant, au bit près, et c'est l'état de production. Écrit par
+    // `poserCropSeul`, lu par `_traverse` et par lui seul.
+    //
+    // ⚠️ **CE N'EST PAS UN DOUBLON DE `uEstompage = 1`, ET C'EST TOUTE LA
+    // TÂCHE.** L'estompage plein fait mourir le FRAGMENT hors crop ; la tuile,
+    // elle, est quand même chargée, maillée et soumise au GPU. Mesuré dans
+    // l'application vivante le 2026-08-22 (La Réunion, `?terre=unique`, altitude
+    // de bloc 12 686 m, `uEstompage = 1`) : **351 tuiles dessinées, dont 315
+    // entièrement hors du crop** — 89,7 % des appels de dessin ne montrent pas
+    // un pixel. Données brutes : `.banc/vues-N/AV-repos-bloc.json`.
+    this._cropSeul = false
     // LES PAROIS — Tâche B. `null` = le crop est une peau flottante, et c'est
     // l'état d'après la Tâche A. Écrit par `construireParoisCrop`.
     this._parois = null
     // LA MER — Tâche F. `null` = pas de calotte, et c'est l'état de production :
     // sans `poserMer`, le globe est celui d'avant, au bit près. Même garde que
     // `uCropOn = 0` (Tâche A), `uHabOn = 0` (Tâche C) et `RAMPE_MONDE` (Tâche D).
     this._mer = null
     this._merEtat = null
     // le budget de cache SUIT le chemin : voir CACHE_MAX_CONTINU
     this.cacheMax = this.continu ? CACHE_MAX_CONTINU : CACHE_MAX
@@ -1903,20 +1915,75 @@ export class Globe {
     u.uCropCentre.value.set(rep.cx, rep.cy)
     u.uCropDemi.value = rep.demi
     u.uCropCoin.value = coinNormalise(corner, half)
     u.uCropCoinN.value = Math.max(2, expo)
     u.uCropOn.value = 1
     // la couverture douce du bord ne veut rien dire sans mélange — Tâche B
     this._melangeCrop(true)
     return rep
   }
 
+  // ═══════════ LE CROP SEUL — Tâche N, « ON NE CALCULE PAS LE DEHORS » ══════
+  //
+  // **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
+  // s'afficher. […] On ne calcule donc pas les éléments hors crop sauf si dézoom
+  // ou zoom pour faire la transition. »
+  //
+  // ⚠️ **« NE PAS CALCULER » EST L'EXIGENCE DURE, ET LE `discard` DE LA TÂCHE A
+  // NE LA TIENT PAS.** Le nuanceur jette le fragment ; la tuile a déjà été
+  // demandée, décodée, maillée, et son appel de dessin est déjà parti. Le pixel
+  // meurt, le coût est payé. Ce drapeau-ci coupe en AMONT, dans `_traverse` :
+  // une tuile hors de la boîte du crop n'est ni parcourue, ni demandée, ni
+  // dessinée.
+  //
+  // ⚠️ **LE CRITÈRE EST LA BOÎTE, PAS LA FORME** — `tuileDansCrop`, la même que
+  // `zoomCropPrescrit` emploie déjà pour prescrire `ZOOM_SOCLE`. Une tuile qui
+  // ne touche le crop que par un coin arrondi reste donc parcourue : la forme se
+  // joue au fragment, le parcours se joue à la tuile. Un test de forme ici
+  // ouvrirait un trou d'une tuile dans chaque coin.
+  //
+  // ⚠️ **CE N'EST PAS UN ÉTAT PERMANENT — C'EST L'ÉTAT DE REPOS.** La loi de
+  // l'estompage (Tâche G) n'est pas touchée : elle reste
+  // `estompageTerre(altitude)` et c'est elle qui dessine les alentours PENDANT
+  // un zoom. Ce que la Tâche N change, c'est QUAND elle s'applique — la veille
+  // du repos (`src/monde/veille-repos.js`) décide, `branchement-crop.js`
+  // relaie.
+
+  /**
+   * Le globe ne parcourt-il QUE le crop ?
+   *
+   * ⚠️ **SANS CROP POSÉ, LE DRAPEAU NE COUPE RIEN**, et c'est délibéré : couper
+   * sur un repère absent ferait disparaître la planète entière. `_horsCropSeul`
+   * teste `this._crop` avant tout.
+   *
+   * @param {boolean} actif
+   * @returns {boolean} l'état posé
+   */
+  poserCropSeul(actif) {
+    this._cropSeul = !!actif
+    return this._cropSeul
+  }
+
+  /**
+   * Cette tuile est-elle hors du crop alors qu'on ne parcourt que le crop ?
+   *
+   * ⚠️ **LES RACINES z2 NE SONT PAS EXEMPTÉES ICI, CONTRAIREMENT AUX DEUX TRIS
+   * SPATIAUX.** Elles le sont là-bas parce qu'elles portent la couverture tant
+   * que leurs enfants ne sont pas au complet — un trou au bord de l'écran. Ici
+   * il n'y a pas de trou à ouvrir : hors du crop, il n'y a RIEN à montrer. Et
+   * elles ne se purgent jamais (`_purgerFile`, `_evict`), donc la transition les
+   * retrouve en cache sans un octet de réseau.
+   */
+  _horsCropSeul(z, x, y) {
+    return this._cropSeul && !!this._crop && !tuileDansCrop(z, x, y, this._crop)
+  }
+
   /** Retire le crop — le globe redevient entier, parois comprises. */
   retirerCrop() {
     this._crop = null
     this.uniforms.uCropOn.value = 0
     this._melangeCrop(false)
     this.retirerParoisCrop()
     this.retirerHabillage()
     this.retirerRampe()
     this.retirerMer()
     this.retirerEstompage()
@@ -3945,20 +4012,35 @@ export class Globe {
 
   // La sphère englobante de la tuile, relief et jupe compris. Réutilise un seul
   // objet : `_traverse` tourne des centaines de fois par image.
   _sphereDe(t) {
     this._sphereTuile.center.copy(t.center).multiplyScalar(this._rayonCentre)
     this._sphereTuile.radius = t.rayon * this._rayonCentre + this._demiEpaisseur
     return this._sphereTuile
   }
 
   _traverse(t, camPos, camDir) {
+    // ══════ LE CROP SEUL — Tâche N ═════════════════════════════════════════
+    //
+    // ⚠️ **AVANT `_visites++`, ET CE N'EST PAS UN DÉTAIL DE COMPTAGE.**
+    // `_visites` est l'instrument par lequel ce dépôt mesure l'emprise
+    // parcourue (Tâche 4, « il ne se juge pas au zoom atteint mais au nombre de
+    // tuiles PARCOURUES »). Compter une tuile qu'on refuse de parcourir
+    // rendrait la mesure aveugle à la seule chose que cette tâche change.
+    //
+    // ⚠️ **ET C'EST UN `return` SEC, SANS `lastUsed`.** La tuile n'est donc plus
+    // porteuse : elle redevient évinçable. Ce n'est pas un oubli, mais ce n'est
+    // pas non plus une éviction — au repos le cache ne DÉBORDE pas (mesuré :
+    // 712 tuiles pour `cacheMax = 1 700`), donc `_evict` ne passe jamais et rien
+    // n'est rendu au réseau. **C'est ce qui rend la transition gratuite** :
+    // dézoomer retrouve en cache tout ce qui y était.
+    if (this._horsCropSeul(t.z, t.x, t.y)) return
     this._visites++
     // ⚠️ LES RACINES z2 SONT EXEMPTÉES DES DEUX TRIS, et ce n'est pas une
     // faveur : elles portent la couverture de toute la planète, ce sont elles
     // qui dessinent tant que leurs enfants ne sont pas au complet. Les écarter
     // du parcours ouvrirait un trou à chaque bord d'écran.
     if (t.z > ROOT_Z) {
       // `t.center` est SUR la sphère de rayon `this.radius` (voir `_ensureTile`),
       // donc ce quotient est exactement le cosinus cherché — sans allocation.
       const dot = t.center.dot(camDir) / this.radius
       if (this.continu) {
@@ -4043,20 +4125,42 @@ export class Globe {
     }
 
     if (wantSplit) {
       const kids = this._children(t)
       for (const k of kids) {
         k.lastUsed = this.frame // protect loading/fresh children from LRU
         if (k.state === 'empty') this._request(k, ratio)
       }
       // hole-free rule: descend only when all four children can draw —
       // any error keeps the parent covering the whole quad
+      //
+      // ⚠️ **AU REPOS, `kids` NE CONTIENT QUE LES ENFANTS DU CROP — Tâche N**,
+      // et la règle sans-trou tient toujours : ce qui manque à la couverture est
+      // ce qu'on a décidé de ne pas montrer. Sans ce filtrage, un quart de
+      // z11 chevauchant le bord du crop attendrait quatre enfants dont deux ne
+      // seront JAMAIS demandés — le crop resterait grossier pour toujours.
+      //
+      // ⛔ **IL Y AVAIT ICI UN `kids.length > 0 &&`, ET C'ÉTAIT DU CODE MORT —
+      // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Le
+      // raisonnement écrit à côté était plausible (« une liste vide passerait
+      // `every` et on descendrait dans le vide, donc une encoche »), et il est
+      // sans objet : **`tuileDansCrop` est un test d'INTERSECTION D'EMPRISES
+      // sur les deux axes** — en latitude par `y1 <= cy − demi || y0 >= cy +
+      // demi`, en longitude par `|dx| < demi + demiTuile` sur le CENTRE, ce qui
+      // est la même chose. Les quatre enfants PAVENT exactement leur parent :
+      // si le parent recoupe l'emprise du crop, au moins un enfant la recoupe.
+      // Un parent qui atteint cette ligne a forcément passé `_horsCropSeul`,
+      // donc `kids` n'est jamais vide. Une mutation qui retirait la garde
+      // SURVIVAIT. **Retirée plutôt que testée à vide** — sixième code mort de
+      // ce chantier. Ce qui garde réellement l'absence de trou est l'assertion
+      // d'ensemble de `test/veille-repos.test.js` ⑦ : le crop doit être dessiné
+      // par EXACTEMENT les mêmes tuiles avec et sans le drapeau.
       if (kids.every((k) => k.state === 'ready' && k.mesh)) {
         t.refined = true
         for (const k of kids) this._traverse(k, camPos, camDir)
         return
       }
     }
 
     t.refined = false
     if (t.state === 'ready' && t.mesh) {
       t.mesh.visible = true
@@ -4064,34 +4168,64 @@ export class Globe {
     }
   }
 
   // les quatre enfants sont-ils DÉJÀ dans le cache ? (sans les créer — c'est
   // toute la différence avec `_children`, qui les fait naître)
   _enfantsPresents(t) {
     const z = t.z + 1
     const x = t.x * 2
     const y = t.y * 2
     return (
-      this.tiles.has(tileKey(z, x, y)) &&
-      this.tiles.has(tileKey(z, x + 1, y)) &&
-      this.tiles.has(tileKey(z, x, y + 1)) &&
-      this.tiles.has(tileKey(z, x + 1, y + 1))
+      this._enfantAcquis(z, x, y) &&
+      this._enfantAcquis(z, x + 1, y) &&
+      this._enfantAcquis(z, x, y + 1) &&
+      this._enfantAcquis(z, x + 1, y + 1)
     )
   }
 
+  /**
+   * Cet enfant est-il DÉJÀ dans le cache — ou hors sujet ?
+   *
+   * ⚠️ **HORS CROP AU REPOS, IL NE COÛTERA RIEN, DONC IL NE SE PAIE PAS —
+   * Tâche N.** `_children` ne le fera pas naître ; le compter dans l'admission
+   * ferait débiter quatre crédits pour deux tuiles à chaque quart qui chevauche
+   * le bord du crop, à chaque image. Le drapeau éteint, cette fonction est
+   * exactement `this.tiles.has(...)`.
+   */
+  _enfantAcquis(z, x, y) {
+    return this._horsCropSeul(z, x, y) || this.tiles.has(tileKey(z, x, y))
+  }
+
+  /**
+   * Les enfants à faire naître.
+   *
+   * ⚠️ **AU REPOS SOUS `_cropSeul`, CEUX QUI SONT HORS DU CROP NE NAISSENT
+   * MÊME PAS — Tâche N.** `_ensureTile` crée l'entrée de cache et `_request`
+   * part derrière : filtrer plus bas (dans `_traverse`) aurait laissé le
+   * réseau et le maillage se payer quand même, c'est-à-dire exactement le
+   * défaut que cette tâche répare. Le drapeau éteint, la liste est celle
+   * d'avant, dans le même ordre, au bit près.
+   */
   _children(t) {
-    return [
-      this._ensureTile(t.z + 1, t.x * 2, t.y * 2),
-      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2),
-      this._ensureTile(t.z + 1, t.x * 2, t.y * 2 + 1),
-      this._ensureTile(t.z + 1, t.x * 2 + 1, t.y * 2 + 1),
-    ]
+    const z = t.z + 1
+    const x = t.x * 2
+    const y = t.y * 2
+    // ⚠️ **DÉROULÉ, PAS UNE BOUCLE SUR UN TABLEAU DE PAIRES** : `_traverse`
+    // tourne des centaines de fois par image, et le fichier le dit déjà pour
+    // `_sphereDe` (« réutilise un seul objet »). Une allocation de quatre paires
+    // par appel serait un ramasse-miettes de plus par seconde.
+    const out = []
+    if (!this._horsCropSeul(z, x, y)) out.push(this._ensureTile(z, x, y))
+    if (!this._horsCropSeul(z, x + 1, y)) out.push(this._ensureTile(z, x + 1, y))
+    if (!this._horsCropSeul(z, x, y + 1)) out.push(this._ensureTile(z, x, y + 1))
+    if (!this._horsCropSeul(z, x + 1, y + 1)) out.push(this._ensureTile(z, x + 1, y + 1))
+    return out
   }
 
   _evict() {
     this._evictJusqua(this.cacheMax)
   }
 
   // Budget DUR, mais des victimes CHOISIES. Le tri d'origine était le seul
   // `a.lastUsed - b.lastUsed`, et il se retournait contre le globe : `_traverse`
   // marque toutes les tuiles qu'il parcourt, ancêtres raffinés compris, or ces
   // ancêtres ont `mesh.visible === false` (seules les feuilles sont allumées).
diff --git a/src/main.js b/src/main.js
index 4e0dfca..04ffdf5 100644
--- a/src/main.js
+++ b/src/main.js
@@ -68,20 +68,25 @@ import { creerVeilleSocle } from './monde/veille-socle.js'
 // L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G. ⚠️ **PUR, ET C'EST LA CONDITION DE
 // SA VÉRIFICATION** : la loi ne peut pas vivre ici, aucun test ne charge
 // `main.js`. Voir `majEstompage` plus bas.
 import { creerVeilleEstompage } from './monde/estompage-terre.js'
 // UNE SEULE TERRE — Tâche I, LE BRANCHEMENT. ⚠️ **C'EST LE TROU DU PLAN**, et
 // c'est Adrien qui l'a trouvé : les Tâches A à G posaient six méthodes sur le
 // globe que PERSONNE n'appelait. La chaîne et son automate vivent dans un module
 // pour la même raison que les deux veilles ci-dessus — aucun test ne charge
 // `main.js`, et l'état inter-images est ce qui se casse en silence.
 import { creerVeilleCrop } from './monde/branchement-crop.js'
+// LE REPOS DE LA VUE — Tâche N. ⚠️ **PUR, POUR LA MÊME RAISON QUE LES TROIS
+// VEILLES CI-DESSUS** : c'est un SEUIL, et le seuil du socle a produit onze
+// bascules là où il en fallait une. Ses deux nombres sont MESURÉS sur des traces
+// par image relevées dans l'application vivante — voir le §3 du module.
+import { creerVeilleRepos } from './monde/veille-repos.js'
 // ⚠️ `landmarks.js` N'IMPORTE RIEN — c'est ce qui en fait « la seule source de
 // la largeur du socle » (`seuil-socle.js`, §0), et ce qui rend cet import sans
 // risque de cycle depuis `main.js`, qui est en bout de chaîne.
 import { BLOCK_TILES } from './landmarks.js'
 // ⚠️ `exageration-continue.js` N'IMPORTE RIEN — voir son en-tête : passer par
 // `fenetre-bornee.js` fermerait le cycle terrain.js → fenetre-bornee.js →
 // terrain.js, et AUCUN TEST NE CHARGE `main.js` pour l'attraper.
 import { lireExageration, poserExageration, creerExagerationPartagee, majExagerationCran, surchargesStockees, courbeExageration, EXAG_BASE } from './monde/exageration-continue.js'
 // LA FENÊTRE BORNÉE — Tâche 6 ter. ⚠️ Importée ICI et pas dans `terrain.js` :
 // `fenetre-bornee.js` importe `TERRAIN_SIZE` de `terrain.js`, donc l'import
@@ -4668,20 +4673,38 @@ function majSeuilSocle() {
 // sens que là où le globe EST le fond, c'est-à-dire dans la passe de fond de la
 // Tâche 1b bis. Sans le drapeau, `poserEstompage` n'est jamais appelée et
 // `uEstompageOn` reste à 0 : les trois nuanceurs du globe rendent ce qu'ils
 // rendaient avant, au bit près.
 //
 // ⚠️ **LA VEILLE VIT DANS UN MODULE**, comme celle du socle et pour la même
 // raison : aucun test ne charge ce fichier, et l'état inter-images est
 // précisément ce qui se casse en silence.
 const veilleEstompage = creerVeilleEstompage({ appliquer: (f) => globe?.poserEstompage(f) })
 
+// ══════════ LE REPOS DE LA VUE — Tâche N, « LE STUDIO SUR LE GLOBE » ═══════
+//
+// **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
+// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
+// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
+// zoom pour faire la transition. »
+//
+// ⚠️ **ELLE N'EST NOURRIE QUE PAR `veilleCrop`, ET C'EST LA MÊME RÈGLE QUE
+// L'ESTOMPAGE** : trois automates qui décident à la même image doivent décider
+// sur la MÊME lecture d'altitude. Un second `altitudeCadrageM()` ici serait le
+// troisième chemin d'un geste qui n'en a qu'un — l'argument est écrit trois fois
+// dans ce fichier, et il a été payé trois fois.
+//
+// ⚠️ **AUCUN RÉGLAGE PASSÉ ICI.** Les deux nombres (`SEUIL_BOUGE_LOG`,
+// `IMAGES_CALME`) sont mesurés et vivent dans le module avec leur source ; les
+// dupliquer ici en ferait deux jeux qui divergent d'une version.
+const veilleRepos = creerVeilleRepos()
+
 // ⚠️ **LES DEUX GARDES SONT CELLES DE `majSeuilSocle`, MOT POUR MOT, ET ELLES
 // VALENT ICI POUR LA MÊME RAISON MESURÉE.** Pendant un cran, `largeurBlocM()`
 // est divisée par deux UNE IMAGE avant que `_rescale` ne double
 // `camera.position.y` : `altitudeCadrageM()` rend alors exactement la MOITIÉ de
 // la vraie altitude. Sur le seuil du socle cela faisait onze bascules au lieu
 // d'une ; ici cela ferait clignoter la planète entière à chaque cran.
 //
 // ⚠️ **ET SOUS `terre unique`, ELLE REND LA MAIN : C'EST `veilleCrop` QUI
 // NOURRIT L'ESTOMPAGE.** Un seul point d'alimentation, sinon deux lois — un crop
 // qui naîtrait sur une altitude et une planète qui s'effacerait sur une autre se
@@ -4926,20 +4949,27 @@ function contexteCrop() {
 // `terrain.mesh.visible = true`. Le bloc plat est opaque et se dessine dans la
 // passe de SURFACE, donc après la passe de fond : il recouvrait le crop en
 // entier, et l'écran était exactement celui d'avant le chantier. **C'est la même
 // classe d'erreur que celle qui a créé cette tâche** — du code qui tourne,
 // personne qui le voit. ⚠️ **Il rappelle LA LISTE, il n'en fabrique pas une
 // seconde**, et il ne tourne qu'une fois par entrée en surface.
 const veilleCrop = creerVeilleCrop({
   globe: () => globe,
   contexte: contexteCrop,
   estompage: veilleEstompage,
+  // ⚠️ **LE REPOS ENTRE PAR LA MÊME PORTE QUE L'ESTOMPAGE — Tâche N.** Il
+  // commande deux choses qui doivent être vraies ensemble : l'estompage plein
+  // (les alentours ne s'affichent plus) et `globe.poserCropSeul` (le quadtree
+  // cesse de les parcourir, donc de les demander et de les mailler). Le
+  // relais est dans `branchement-crop.js`, pas ici : c'est lui qui sait si la
+  // chaîne est posée, et forcer l'estompage sans crop viderait l'écran.
+  repos: veilleRepos,
   masquerSocle: () => poserVisibiliteSocle(false),
   // ⚠️ **SANS CETTE RÉSERVATION, LES PAROIS ET LA RAMPE REFUSENT POUR TOUJOURS,
   // ET C'EST MESURÉ À L'ÉCRAN.** La Réunion z12, drapeau levé, **600 tuiles** de
   // globe en cache : `globe.tuilesAvecHauteurs().length` rendait **0**, donc
   // `couverture = 0`, donc `refus: 'couverture'` à chaque tentative. Ce n'est pas
   // le réseau : `_buildMesh` RELÂCHE `t.heights` dès le maillage bâti (Tâche
   // 4 sexies), **sauf pour les clés de `gardeHauteurs`** — et personne ne
   // réservait l'emprise du crop. Les Tâches B, D et F ont toutes été vérifiées
   // sur des hauteurs posées à la main : le manque ne pouvait se voir qu'ici.
   //
@@ -11160,20 +11190,27 @@ window.__exp = { boats, raceLabels, raceState, courseBar, syncCourseBarMode, sce
   // les deux lignes ci-dessus : `main.js` n'est chargé par aucun test, et
   // `veilleEstompage.valeur` est ce qui se lit à l'écran pour vérifier qu'une
   // descente estompe la planète au lieu de la faire clignoter.
   veilleEstompage,
   // UNE SEULE TERRE — Tâche I, exposée pour la même raison que les trois blocs
   // ci-dessus : `main.js` n'est chargé par aucun test, et `veilleCrop.pose`,
   // `.refus`, `.bascules` et `.signature` sont **la seule façon de vérifier à
   // l'écran que la chaîne est réellement appelée** — et, quand le bloc ne
   // ressemble pas au socle, de dire QUEL maillon a refusé plutôt que de deviner.
   veilleCrop, terreUniqueBranchee, contexteCrop,
+  // LE REPOS DE LA VUE — Tâche N, exposé pour la même raison que les quatre
+  // blocs ci-dessus : `main.js` n'est chargé par aucun test, et
+  // `veilleRepos.auRepos` / `.bascules` sont **la seule façon de vérifier à
+  // l'écran qu'un dézoom rallume les alentours UNE fois et que la vue posée les
+  // éteint UNE fois** — c'est-à-dire de compter le battement au lieu de
+  // l'espérer.
+  veilleRepos,
   // mode aléatoire + ombrage auto : de quoi sonder l'état depuis la console
   shuffleLook,
   // ⚠️ À APPELER AVANT DE COUPER LA BOUCLE rAF pour un tournage hors ligne
   // (skill shibumap-shots, usine à vidéos). Le rendu hors ligne est déjà figé
   // par construction — `f3Tick` n'existe que dans `tick()` — mais il fige AUSSI
   // le débordement élastique et le maillage de drag s'il en trouve un. Un
   // appel, aucun argument, sans effet hors mode continu.
   figeFenetre: f3Fige,
   get dem() { return dem },
   // source d'altimétrie : quelle source sert le bloc, jusqu'à quel zoom, et
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index de86153..541a524 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -346,28 +346,35 @@ export function poserChaineCrop(arg = {}) {
  *   clés réservées par `gardeHauteurs`**. Quelqu'un doit donc réserver l'emprise
  *   du crop — `demanderEmprise` du flux —, et ce quelqu'un n'est pas ce module,
  *   qui est pur. Appelé à la pose et à chaque reprise, jamais par image.
  * @param {(() => void)|null} [arg.masquerSocle] ⚠️ **CE QUI FAIT QU'IL N'Y A PLUS
  *   QU'UNE TERRE, ET SANS LUI IL Y EN A DEUX.** Le bloc plat est opaque et se
  *   dessine APRÈS la passe de fond : laissé allumé, il recouvre le crop en
  *   entier et l'écran est exactement celui d'avant le chantier — c'est ce que
  *   l'Étape 6 a vu à la première image, `terrain.mesh.visible === true` avec
  *   `uCropOn === 1`. Appelé **une fois par entrée en surface**, jamais par
  *   image : la liste des calques qu'il touche en compte quatorze.
+ * @param {{maj:Function, oublier:Function}|null} [arg.repos] la veille du repos
+ *   (Tâche N, `veille-repos.js`). ⚠️ **ELLE EST NOURRIE ICI ET NULLE PART
+ *   AILLEURS, POUR LA MÊME RAISON QUE L'ESTOMPAGE** : trois automates qui
+ *   décident à la même image doivent décider sur la MÊME altitude. Absente, le
+ *   comportement est celui d'avant la Tâche N, au bit près — les alentours
+ *   restent dessinés au repos.
  * @param {number} [arg.periodeReprise] en IMAGES — voir le §3
  * @param {boolean} [arg.cropAuDepart] l'état de l'application au chargement
  * @param {boolean} [arg.modeSurfaceAuDepart]
  */
 export function creerVeilleCrop({
   globe,
   contexte,
   estompage = null,
+  repos = null,
   masquerSocle = null,
   reserverHauteurs = null,
   periodeReprise = 30,
   cropAuDepart = false,
   modeSurfaceAuDepart = true,
 } = {}) {
   if (!globe) {
     throw new TypeError('creerVeilleCrop : il faut un `globe` (ou une fonction qui le rend)')
   }
   if (typeof contexte !== 'function') {
@@ -387,20 +394,62 @@ export function creerVeilleCrop({
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
+  // ══════════ LE REPOS RELAYÉ — Tâche N ══════════════════════════════════════
+  //
+  // ⚠️ **DEUX DESTINATAIRES, UN SEUL ÉCRIVAIN.** Le repos commande deux choses
+  // qui doivent être vraies ENSEMBLE ou fausses ensemble : l'estompage plein
+  // (`poserRepos`, qui efface les alentours à l'écran) et le parcours réduit du
+  // quadtree (`globe.poserCropSeul`, qui cesse de les calculer). Séparés, on
+  // aurait un dessin sans coût ou un coût sans dessin — les deux moitiés du
+  // défaut que cette tâche répare.
+  //
+  // ⚠️ **ET LE `ET` AVEC `pose` N'EST PAS UNE PRUDENCE, C'EST LA LOI.** Sans
+  // crop, l'estompage plein efface la planète et ne met rien à la place : un
+  // écran vide. C'est ce qui interdit à `estompage-terre.js` de porter cette
+  // règle lui-même — il ne sait pas s'il y a une découpe.
+  let auRepos = false
+  let reposApplique = false
+  let basculesRepos = 0
+
+  function appliquerRepos(g) {
+    // ⛔ **IL Y AVAIT ICI UN `modeSurface &&`, ET C'ÉTAIT DU CODE MORT —
+    // TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** Le
+    // raisonnement écrit à côté était plausible (« l'orbite prime, comme pour
+    // l'estompage »), et il était sans effet : **hors surface, `pose` est
+    // TOUJOURS faux**. `poserMode(false)` appelle `retirer`, qui le remet à
+    // faux ; et `decider` sort sur `if (!modeSurface) return pose` sans jamais
+    // le lever. Aucun chemin n'atteint donc ce relais avec `modeSurface` faux
+    // et `pose` vrai — une mutation qui retirait le terme SURVIVAIT. C'est la
+    // définition du code mort que ce chantier a déjà trouvé cinq fois.
+    // **Retiré plutôt que testé à vide**, exactement comme la garde
+    // `if (nom === 'crop') continue` de `reprendre` et le `habillagePose = null`
+    // de `retirer`. ⚠️ **L'INVARIANT QUI LE REMPLACE EST ÉCRIT ICI** : hors
+    // surface, il n'y a pas de crop, donc rien à relayer.
+    const voulu = !!(pose && auRepos)
+    if (voulu === reposApplique) return reposApplique
+    reposApplique = voulu
+    basculesRepos++
+    estompage?.poserRepos(voulu)
+    // ⚠️ **UN GLOBE SANS `poserCropSeul` N'EST PAS UNE PANNE** — même contrat
+    // que `poserFondCrop` (Tâche J bis) : ce module se vérifie sous node contre
+    // un globe de papier, qui ne porte que les méthodes qu'il exerce.
+    g?.poserCropSeul?.(voulu)
+    return reposApplique
+  }
 
   function suivreMer(promesse, monJeton) {
     enVol = promesse.then((r) => {
       if (monJeton !== jeton) return // une pose plus récente a pris la main
       const echoue = !r || !!r.refus
       const dedans = refus.includes('mer')
       if (echoue && !dedans) refus = [...refus, 'mer']
       else if (!echoue && dedans) refus = refus.filter((n) => n !== 'mer')
     }, () => {})
     return enVol
@@ -482,35 +531,40 @@ export function creerVeilleCrop({
     // la première image qui repose passe forcément par `poserTout`**, lequel
     // écrit l'instantané avant que `rafraichirHabillage` ne puisse le lire.
     // Aucun chemin n'atteint le rafraîchissement avec un instantané périmé. Une
     // mutation qui retirait la ligne SURVIVAIT — c'est la définition du code
     // mort que ce chantier a déjà trouvé quatre fois. **Retirée plutôt que
     // testée à vide**, exactement comme la garde `if (nom === 'crop') continue`
     // de `reprendre`, dix lignes plus bas.
     bascules++
   }
 
-  return {
-    /**
-     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
-     * au-dessus de l'ellipsoïde — règle R1, celle que `loi-altitude.js` porte
-     * SANS `meanM`. Une altitude non finie conserve l'état, même contrat que
-     * `socleVisible`.
-     */
-    maj(altitudeEllipsoideM) {
+  // ⚠️ **LE CORPS DE `maj` VIT ICI POUR QU'IL N'Y AIT QU'UN SEUL POINT DE
+  // SORTIE — Tâche N.** Il en compte six (orbite, globe absent, seuil, contexte
+  // absent, pose, régime établi), et le repos doit être relayé sur TOUS : un
+  // `appliquerRepos` recopié six fois serait six branchements à tenir d'accord,
+  // c'est-à-dire la classe d'erreur que ce fichier existe pour fermer.
+  function decider(altitudeEllipsoideM) {
       // ⚠️ **L'ESTOMPAGE EST NOURRI MÊME EN ORBITE**, et le §6 de
       // `estompage-terre.js` dit pourquoi : sa veille FORCE zéro hors surface,
       // là où celle du socle GÈLE. La priver de l'image la laisserait sur la
       // dernière valeur de surface — une planète effacée au moment précis où
       // elle redevient le sujet.
       estompage?.maj(altitudeEllipsoideM)
       if (!modeSurface) return pose
+      // ⚠️ **LA VEILLE DU REPOS N'EST NOURRIE QU'EN SURFACE, ET C'EST MESURÉ.**
+      // En orbite, `altitudeCadrageM()` divise un `camera.position.y` orbital
+      // par l'échelle du DERNIER bloc chargé : ce n'est pas une altitude, c'est
+      // un résidu (`veille-socle.js`, §2). Lui donner cette image ferait un
+      // écart énorme entre deux régimes, donc un « mouvement » à chaque
+      // aller-retour d'orbite. `poserMode` lui fait oublier sa référence.
+      auRepos = repos ? repos.maj(altitudeEllipsoideM) : false
       // ⚠️ **LE BLOC PLAT PART AVANT TOUTE DÉCISION D'ALTITUDE, ET C'EST VOULU.**
       // Sous ce drapeau il n'a plus lieu d'exister à aucune altitude : le
       // laisser vivre au-dessus du seuil remettrait un socle devant la planète
       // entière — la capture d'Adrien à Z5, remise au goût du jour.
       if (!socleMasque) { socleMasque = true; masquerSocle?.() }
       const g = lireGlobe()
       if (!g) return pose
       const voulu = socleVisible({ altitudeEllipsoideM, visibleAvant: pose })
       if (!voulu) {
         if (pose) retirer(g)
@@ -530,38 +584,68 @@ export function creerVeilleCrop({
         return true
       }
       depuisPose++
       if (refus.length && depuisPose >= periodeReprise) reprendre(g, ctx)
       // ⚠️ **APRÈS LA REPRISE, ET PAS AVANT.** La reprise peut reposer
       // l'habillage elle-même (s'il figurait dans les refus, ce qui n'arrive
       // pas aujourd'hui mais reste ouvert) ; le rafraîchissement doit juger sur
       // l'état FINAL de l'image, sinon il reposerait deux fois.
       rafraichirHabillage(g, ctx)
       return true
+  }
+
+  return {
+    /**
+     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
+     * au-dessus de l'ellipsoïde — règle R1, celle que `loi-altitude.js` porte
+     * SANS `meanM`. Une altitude non finie conserve l'état, même contrat que
+     * `socleVisible`.
+     */
+    maj(altitudeEllipsoideM) {
+      const r = decider(altitudeEllipsoideM)
+      // ⚠️ **APRÈS LA DÉCISION, JAMAIS AVANT.** `appliquerRepos` lit `pose` :
+      // évalué en tête, il jugerait sur l'image d'avant et le crop naîtrait
+      // toujours avec une image d'alentours dessinés.
+      appliquerRepos(lireGlobe())
+      return r
     },
 
     /**
      * Le mode de `modes.js`. ⚠️ Il PRIME : en orbite la planète est le sujet,
      * et une découpe dedans n'a plus aucun sens.
      */
     poserMode(surface) {
       modeSurface = !!surface
       estompage?.poserMode(surface)
       // ⚠️ **L'ORBITE REND SES CALQUES AU SOCLE**, et `modes.js` les rallume en
       // revenant : le masquage se redemande donc à chaque entrée en surface.
       if (!modeSurface) socleMasque = false
       if (!modeSurface && pose) retirer(lireGlobe())
+      // ⚠️ **TOUT CHANGEMENT DE MODE FAIT OUBLIER L'ALTITUDE DE RÉFÉRENCE —
+      // Tâche N, ET DANS LES DEUX SENS.** En orbite, `altitudeCadrageM()`
+      // divise un `camera.position.y` orbital par l'échelle du DERNIER bloc
+      // chargé : ce n'est pas une altitude, c'est un résidu
+      // (`veille-socle.js`, §2). Comparer une altitude de surface à un résidu —
+      // ou l'inverse — déclarerait un mouvement là où la caméra est posée. Ne
+      // l'oublier qu'à l'aller laisserait le retour se faire sur la dernière
+      // valeur d'orbite : c'est la MÊME faute, prise par l'autre bout.
+      repos?.oublier?.()
+      appliquerRepos(lireGlobe())
       return pose
     },
 
     /** Le crop est-il posé ? */
     get pose() { return pose },
+    /** Le repos est-il RELAYÉ (donc : crop posé, en surface) — Tâche N. */
+    get repos() { return reposApplique },
+    /** Combien de fois le repos relayé a basculé : le compteur de battement. */
+    get basculesRepos() { return basculesRepos },
     /** Les maillons qui ont refusé et que la reprise redemande. */
     get refus() { return [...refus] },
     /** Combien de fois le crop est né ou mort depuis le chargement. */
     get bascules() { return bascules },
     /** Combien de fois l'habillage a été RAFRAÎCHI hors pose — Tâche K ter. */
     get rafraichissements() { return rafraichissements },
     /** Le lieu sur lequel la chaîne est posée — pour les sondes et les bancs. */
     get signature() { return signature },
     /** La dernière mer partie, pour qui doit l'attendre (les tests, les bancs). */
     enVol() { return enVol },
diff --git a/src/monde/estompage-terre.js b/src/monde/estompage-terre.js
index 2642a11..f3c40d9 100644
--- a/src/monde/estompage-terre.js
+++ b/src/monde/estompage-terre.js
@@ -187,48 +187,90 @@ export function estompageTerre({ altitudeEllipsoideM, estompageAvant = 0 } = {})
  *
  * @param {{ appliquer: (estompage:number) => void }} arg
  */
 export function creerVeilleEstompage({ appliquer } = {}) {
   if (typeof appliquer !== 'function') {
     throw new TypeError('creerVeilleEstompage : `appliquer` est obligatoire — un branchement muet est un branchement absent')
   }
   // ce que l'ALTITUDE dit, indépendamment du mode
   let auSeuil = 0
   let modeSurface = true
+  // ══════════ 7. LE REPOS FORCE UN — Tâche N, « LE STUDIO SUR LE GLOBE » ═════
+  //
+  // **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
+  // s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue
+  // est stabilisée. »
+  //
+  // ⚠️ **LA LOI N'EST PAS TOUCHÉE, ET C'EST LE POINT.** `estompageTerre` est
+  // mesurée, relue et validée (Tâche G) : ses deux bornes se dérivent toujours
+  // de `seuil-socle.js`, sa rampe court toujours sur le logarithme de
+  // l'altitude, elle n'a toujours pas d'hystérésis. **Ce qui change est QUAND
+  // elle s'applique** — l'estompage devient un état de TRANSITION, plus un état
+  // de repos. Au repos la valeur posée est 1, « le crop seul » : c'est le
+  // comportement que la Tâche A porte depuis toujours, et `uEstompage = 1` le
+  // rend au bit près.
+  //
+  // ⚠️ **L'ORDRE DES TROIS PRIORITÉS N'EST PAS ARBITRAIRE** : l'orbite d'abord
+  // (là-haut la Terre est le sujet, elle est ENTIÈRE — §6), le repos ensuite, la
+  // loi en dernier. Un repos qui primerait sur l'orbite effacerait la planète au
+  // moment précis où elle redevient le sujet — le défaut que le §6 décrit déjà.
+  //
+  // ⚠️ **ET CE N'EST PAS À CETTE VEILLE DE SAVOIR S'IL Y A UN CROP.** Sans crop
+  // posé, forcer 1 laisserait un écran vide : la planète effacée, et rien à la
+  // place. C'est `branchement-crop.js` qui ne relaie le repos que lorsque la
+  // chaîne est posée — un seul point d'alimentation, comme pour `maj` et
+  // `poserMode`.
+  let auRepos = false
   // ce qui est réellement POSÉ à l'écran
   let pose = 0
   let applications = 0
 
   function poser() {
-    const voulu = modeSurface ? auSeuil : 0
+    const voulu = !modeSurface ? 0 : auRepos ? 1 : auSeuil
     if (voulu === pose) return pose
     pose = voulu
     applications++
     appliquer(voulu)
     return pose
   }
 
   return {
     /** Le mode de `modes.js`. ⚠️ Il PRIME : en orbite la Terre est entière. */
     poserMode(surface) {
       modeSurface = !!surface
       return poser()
     },
 
+    /**
+     * La vue est-elle au repos ? ⚠️ Au repos, le crop SEUL — voir le §7.
+     *
+     * ⚠️ **MÊME GARDE QUE LES DEUX AUTRES ENTRÉES** : `appliquer` n'est rappelé
+     * que lorsque la valeur posée change, sinon un uniforme serait réécrit à
+     * chaque image pour rien.
+     *
+     * @param {boolean} repos
+     */
+    poserRepos(repos) {
+      auRepos = !!repos
+      return poser()
+    },
+
     /**
      * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
      * au-dessus de l'ellipsoïde — voir le §1.
      */
     maj(altitudeEllipsoideM) {
       if (!modeSurface) return pose
       auSeuil = estompageTerre({ altitudeEllipsoideM, estompageAvant: auSeuil })
       return poser()
     },
 
     /** Ce qui est posé à l'écran. */
     get valeur() { return pose },
     /** Ce que l'altitude dit, mode mis à part — pour les sondes et les bancs. */
     get auSeuil() { return auSeuil },
+    /** Le repos est-il relayé ? — pour les sondes et les bancs (Tâche N). */
+    get auRepos() { return auRepos },
     /** Combien de fois l'estompage a été réellement réécrit. */
     get applications() { return applications },
   }
 }
diff --git a/src/monde/veille-repos.js b/src/monde/veille-repos.js
new file mode 100644
index 0000000..f566ff2
--- /dev/null
+++ b/src/monde/veille-repos.js
@@ -0,0 +1,201 @@
+// LE REPOS DE LA VUE — Tâche N du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// Module PUR : ni DOM, ni three.js, ni fetch, et il n'importe RIEN. Tout se
+// vérifie sous node (`test/veille-repos.test.js`).
+//
+// ══════════ 0. LA CONSIGNE, ET CE QU'ELLE DEMANDE DE NEUF ═══════════════════
+//
+// **Adrien, 2026-08-22 :** « Tout ce qui est en dehors du crop ne doit pas
+// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
+// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
+// zoom pour faire la transition. »
+//
+// Trois mots portent tout le poids : **« quand la vue est stabilisée »**. Il
+// faut donc un critère de repos — et un critère de repos est un SEUIL, ce qui
+// est exactement la classe d'objet que ce chantier a déjà payée : le seuil du
+// socle a produit **onze bascules là où il en fallait une** (`main.js`,
+// « ON NE DÉCIDE PAS PENDANT UN CRAN »). Ce fichier ne devine donc aucun de ses
+// deux nombres : ils sortent de traces par image relevées dans l'application
+// vivante, et les traces sont sur le disque.
+//
+// ══════════ 1. LA GRANDEUR SURVEILLÉE — L'ALTITUDE, ET ELLE SEULE ═══════════
+//
+// ⚠️ **PAS LA POSITION DE LA CAMÉRA, PAS SON ORIENTATION.** La consigne nomme
+// le geste : « sauf si dézoom ou zoom ». Un panoramique et une orbite ne
+// demandent RIEN de plus que le crop — le bloc reste le sujet, et ce qui est
+// autour reste hors sujet. Seul un changement d'ÉCHELLE fait entrer les
+// alentours dans le cadre. Surveiller la position ferait réapparaître la Terre
+// autour à chaque glissement de souris, c'est-à-dire le battement que l'Étape 4
+// de la tâche interdit.
+//
+// ⚠️ **ET C'EST LA MÊME ALTITUDE QUE LES DEUX AUTRES VEILLES** — l'altitude
+// géométrique de la caméra au-dessus de l'ellipsoïde, règle R1 : dans `main.js`
+// c'est `altitudeCadrageM()`, l'instrument que la Tâche 1b a purgé de
+// `dem.meanM` exprès. Trois automates qui décident sur la même image doivent
+// décider sur le même nombre.
+//
+// ══════════ 2. L'ÉCART EST LOGARITHMIQUE ═══════════════════════════════════
+//
+// ⚠️ **`|Δ ln altitude|`, PAS `|Δ altitude|`.** Toute la descente de ce dépôt
+// est GÉOMÉTRIQUE (`echelonsGeometriques`, `loi-altitude.js`), et l'estompage
+// lui-même court sur le logarithme de l'altitude (`estompage-terre.js`, §3). Un
+// seuil en mètres serait franchi par un frémissement à 3 000 km et jamais par un
+// vrai zoom à 12 km : **un seuil par altitude, c'est-à-dire aucun seuil.**
+//
+// ══════════ 3. LES DEUX NOMBRES, ET D'OÙ ILS VIENNENT ══════════════════════
+//
+// **Relevés le 2026-08-22 dans l'application vivante** (La Réunion,
+// `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1`, 60 Hz,
+// `fov = 33` lu en direct). Données brutes : `.banc/vues-N/AV-trace-*.json`,
+// dépouillement : `.banc/hysterese-N.mjs` → `.banc/vues-N/hysterese-brut.json`.
+//
+//   · **AU REPOS STRICT, L'ÉCART VAUT EXACTEMENT ZÉRO** : 3 216 images de suite
+//     (53 s), `altitudeCadrageM()` bit pour bit identique, caméra immobile au
+//     bit près. **Mais « non nul » n'est PAS un critère utilisable**, et c'est
+//     la mesure qui le dit : après un geste d'orbite, la traîne d'amortissement
+//     est ASYMPTOTIQUE — encore `7,7 × 10⁻¹¹` par image **603 images (10 s)
+//     après la fin du geste**, en décroissance géométrique de rapport ≈ 0,970.
+//     Un seuil « strictement positif » laisserait donc les alentours allumés
+//     pour toujours après le moindre geste.
+//   · **LE GESTE DÉLIBÉRÉ LE PLUS DOUX MESURÉ** est une molette : son écart
+//     culmine à `4,67 × 10⁻⁴` par image (et `4,70 × 10⁻⁴` sur la trace
+//     saccadée). ⚠️ **C'est un PLAFOND, pas un plancher** : tout seuil au-dessus
+//     de `4,67 × 10⁻⁴` manque un vrai zoom en entier — vérifié, à `S = 10⁻³` la
+//     trace de molette ne compte **aucune** image au-dessus du seuil.
+//
+// **`SEUIL_BOUGE_LOG = 10⁻⁴`** est donc pris **4,7 fois sous le pic du geste le
+// plus doux**, et il capte ce geste EN ENTIER : 48 images au-dessus du seuil,
+// exactement le même compte qu'à `10⁻⁵`, `10⁻⁶` ou `10⁻⁸` — la molette s'arrête
+// NET, sa traîne n'est pas asymptotique. Descendre plus bas n'achète donc rien
+// sur le geste et coûte sur la traîne d'orbite : à `10⁻⁴` elle repasse sous le
+// seuil 140 images (2,3 s) après le geste, à `10⁻⁵` il faut 216 images (3,6 s).
+//
+// **`IMAGES_CALME = 30`** — le nombre d'images consécutives sous le seuil avant
+// de redéclarer le repos. ⚠️ **C'EST LUI, L'HYSTÉRÉSIS**, et elle est
+// ASYMÉTRIQUE À DESSEIN : on quitte le repos en UNE image (les alentours doivent
+// être là dès la première image du geste, sinon la transition commence par un
+// trou), on y revient en trente. Ce que la mesure dit :
+//
+//   · sur un geste CONTINU — molette d'un trait, orbite d'un trait — le plus
+//     long palier calme À L'INTÉRIEUR du geste vaut **0 image** : aucun risque
+//     de retomber au repos en plein geste, quel que soit `IMAGES_CALME` ;
+//   · sur un geste SACCADÉ, les deux seuls trous mesurés valent **1 900 ms et
+//     1 666 ms**. ⚠️ **CE SONT MES PROPRES ALLERS-RETOURS D'OUTIL, PAS DES
+//     PAUSES HUMAINES** — trois salves de cinq crans séparées par un
+//     aller-retour de pilotage. Les couvrir demanderait `IMAGES_CALME ≈ 115`,
+//     donc **deux secondes de retard sur CHAQUE recrop**, ce que la consigne ne
+//     demande pas. Trente images valent **0,5 s à 60 Hz** : cela couvre la pause
+//     ordinaire entre deux crans de molette d'une même main.
+//
+// ⚠️ **RÉSERVE ASSUMÉE, ÉCRITE ICI PLUTÔT QUE DÉCOUVERTE À L'ÉCRAN** : une pause
+// de plus d'une demi-seconde entre deux salves fait recropper puis rouvrir. **Ce
+// n'est pas un battement, c'est un aller-retour** — le compteur `bascules` le
+// distingue, et le banc de l'Étape 4 le compte au lieu de l'espérer.
+//
+// ⚠️ **EN IMAGES, PAS EN MILLISECONDES**, exactement comme `periodeReprise` de
+// `branchement-crop.js` : le module est pur, il n'a pas d'horloge. À 30 Hz le
+// délai vaut donc une seconde, et c'est le bon sens — une machine qui rame a
+// besoin de plus de repos, pas de moins.
+
+/**
+ * L'écart minimal, par image, sur `|Δ ln altitude|`, au-dessus duquel on
+ * déclare que la vue BOUGE. Voir le §3 : mesuré, pas posé.
+ */
+export const SEUIL_BOUGE_LOG = 1e-4
+
+/**
+ * Le nombre d'images consécutives sous le seuil avant de redéclarer le repos.
+ * ⚠️ C'est l'hystérésis, et elle n'a qu'un sens — voir le §3.
+ */
+export const IMAGES_CALME = 30
+
+/**
+ * L'automate du repos, avec sa mémoire.
+ *
+ * ⚠️ **IL DÉMARRE AU REPOS, ET CE N'EST PAS UN DÉTAIL.** Au chargement,
+ * personne n'a encore rien bougé : démarrer « en mouvement » ferait dessiner la
+ * planète entière autour du crop pendant la demi-seconde qui suit l'arrivée,
+ * c'est-à-dire exactement l'image qu'Adrien refuse, au moment où elle se voit le
+ * plus.
+ *
+ * @param {object} [arg]
+ * @param {number} [arg.seuilBougeLog] voir `SEUIL_BOUGE_LOG`
+ * @param {number} [arg.imagesCalme] voir `IMAGES_CALME`
+ */
+export function creerVeilleRepos({
+  seuilBougeLog = SEUIL_BOUGE_LOG,
+  imagesCalme = IMAGES_CALME,
+} = {}) {
+  let altPrecedente = null
+  let calme = 0
+  let auRepos = true
+  let bascules = 0
+  let dernierEcart = 0
+
+  return {
+    /**
+     * Une image. `altitudeEllipsoideM` est l'altitude géométrique de la caméra
+     * au-dessus de l'ellipsoïde — règle R1, voir le §1.
+     *
+     * ⚠️ **UNE ALTITUDE NON FINIE, NULLE OU NÉGATIVE CONSERVE L'ÉTAT**, même
+     * contrat que `socleVisible` et `estompageTerre` : elle ne peut pas être une
+     * raison de rallumer la Terre autour. Et un logarithme de zéro ferait
+     * `−Infinity`, donc un écart `Infinity`, donc un mouvement permanent —
+     * l'exact contraire de ce que la panne devrait produire.
+     *
+     * @returns {boolean} la vue est-elle au repos ?
+     */
+    maj(altitudeEllipsoideM) {
+      if (typeof altitudeEllipsoideM !== 'number' || !Number.isFinite(altitudeEllipsoideM) || altitudeEllipsoideM <= 0) {
+        return auRepos
+      }
+      if (altPrecedente === null) {
+        // ⚠️ **LA PREMIÈRE IMAGE N'A PAS D'ÉCART, ET ON NE LUI EN INVENTE PAS
+        // UN.** Prendre `0` pour altitude précédente ferait un écart infini à
+        // l'arrivée, donc un réveil garanti à chaque retour de l'orbite.
+        altPrecedente = altitudeEllipsoideM
+        return auRepos
+      }
+      const ecart = Math.abs(Math.log(altitudeEllipsoideM / altPrecedente))
+      altPrecedente = altitudeEllipsoideM
+      dernierEcart = ecart
+      if (ecart > seuilBougeLog) {
+        calme = 0
+        if (auRepos) { auRepos = false; bascules++ }
+        return auRepos
+      }
+      calme++
+      if (!auRepos && calme >= imagesCalme) { auRepos = true; bascules++ }
+      return auRepos
+    },
+
+    /**
+     * Oublier l'altitude de référence.
+     *
+     * ⚠️ **APPELÉ QUAND ON QUITTE LA SURFACE, ET C'EST INDISPENSABLE.** En
+     * orbite, `altitudeCadrageM()` divise un `camera.position.y` orbital par
+     * l'échelle du DERNIER bloc chargé : le nombre qui en sort n'est pas une
+     * altitude, c'est un résidu (`veille-socle.js`, §2). Sans oubli, la première
+     * image du retour en surface comparerait une altitude à ce résidu et
+     * déclarerait un mouvement énorme — les alentours s'allumeraient à chaque
+     * retour d'orbite, pour rien.
+     *
+     * ⚠️ **IL N'OUBLIE PAS L'ÉTAT `auRepos`**, seulement la référence : le
+     * retour en surface se fait sur une caméra posée, donc au repos.
+     */
+    oublier() {
+      altPrecedente = null
+      calme = 0
+    },
+
+    /** La vue est-elle au repos ? */
+    get auRepos() { return auRepos },
+    /** Combien d'images calmes de suite — pour les sondes et les bancs. */
+    get calme() { return calme },
+    /** Combien de fois le repos a basculé : c'est le compteur de battement. */
+    get bascules() { return bascules },
+    /** Le dernier `|Δ ln altitude|` mesuré — pour les sondes et les bancs. */
+    get dernierEcart() { return dernierEcart },
+  }
+}
diff --git a/test/veille-repos.test.js b/test/veille-repos.test.js
new file mode 100644
index 0000000..f91feaa
--- /dev/null
+++ b/test/veille-repos.test.js
@@ -0,0 +1,737 @@
+// LE CROP SEUL AU REPOS — Tâche N du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
+// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
+// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
+// zoom pour faire la transition. »
+//
+// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
+//
+//   ① LA LOI DU REPOS — l'écart est LOGARITHMIQUE (une échelle, pas des
+//      mètres), une altitude non finie ou non positive CONSERVE l'état, et
+//      l'automate démarre AU REPOS.
+//   ② L'HYSTÉRÉSIS EST ASYMÉTRIQUE — une image pour réveiller, `IMAGES_CALME`
+//      pour rendormir. C'est le seul paramètre qui décide du battement, et le
+//      seuil du socle a déjà produit **onze bascules là où il en fallait une**.
+//   ③ LES DEUX NOMBRES TIENNENT LA MESURE — rejeu d'une traîne d'amortissement
+//      calée sur la trace de l'application vivante (pic `2,22 × 10⁻²`, rapport
+//      0,970 par image, encore `7,7 × 10⁻¹¹` après 603 images) : **DEUX
+//      bascules, pas quatre**. Et le geste de molette le plus doux mesuré
+//      (`4,67 × 10⁻⁴`) RÉVEILLE — un seuil qui le manquerait serait un seuil qui
+//      ne sert à rien.
+//   ④ `oublier` — l'orbite ne laisse pas de référence derrière elle.
+//   ⑤ L'ESTOMPAGE — `poserRepos` force 1, l'ORBITE PRIME, et **la loi n'est pas
+//      touchée** : `estompageTerre` rend exactement ce qu'elle rendait.
+//   ⑥ LE BRANCHEMENT — le repos atteint SES DEUX destinataires (l'estompage ET
+//      `globe.poserCropSeul`), jamais sans crop posé, jamais hors surface.
+//   ⑦ LE GLOBE — sur un VRAI quadtree, avec un vrai réseau bouché : hors crop,
+//      une tuile n'est ni parcourue, ni demandée, ni maillée, ni dessinée. Et le
+//      drapeau éteint rend le parcours d'avant, tuile pour tuile.
+//   ⑧ LE BRANCHEMENT DE `main.js` — vérifié sur le TEXTE, comme les Tâches G et
+//      I le font déjà : **aucun test de ce dépôt ne charge `main.js`**.
+//
+// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que l'image qui en
+// sort soit belle, et que la transition ne se voie pas comme un à-coup. Seul
+// l'écran le dit — l'Étape 6 de la tâche est là pour ça, et son compte rendu
+// aussi.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+import * as THREE from 'three'
+import { encodeTerrarium } from '../src/bathy.js'
+
+import {
+  IMAGES_CALME,
+  SEUIL_BOUGE_LOG,
+  creerVeilleRepos,
+} from '../src/monde/veille-repos.js'
+import { creerVeilleEstompage, estompageTerre } from '../src/monde/estompage-terre.js'
+import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
+import { ALT_ESTOMPAGE_FIN_M } from '../src/monde/estompage-terre.js'
+import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'
+
+const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+
+// ⚠️ **L'ALTITUDE DE TEST DOIT SATISFAIRE DEUX CONDITIONS À LA FOIS, ET ELLES
+// NE SONT PAS LA MÊME.** Le crop n'existe que SOUS `SEUIL_NAISSANCE_M`
+// (32 274 m), et l'estompage n'est strictement entre 0 et 1 qu'AU-DESSUS de
+// `ALT_ESTOMPAGE_FIN_M` (19 365 m). C'est l'intersection des deux qui montre le
+// défaut : un crop posé, et des alentours dessinés AUTOUR, au repos.
+const ALT_BLOC = (ALT_ESTOMPAGE_FIN_M + SEUIL_NAISSANCE_M) / 2
+
+// ══════════════════════════════════════════════════════════════════ ① la loi
+
+test('① l’écart est LOGARITHMIQUE : le même rapport réveille à toute altitude', () => {
+  // ⚠️ **UN SEUIL EN MÈTRES SERAIT UN SEUIL PAR ALTITUDE.** Le même facteur
+  // multiplicatif doit compter pareil à 12 km et à 3 000 km — sinon le même
+  // geste de molette réveille en haut et pas en bas.
+  const facteur = Math.exp(SEUIL_BOUGE_LOG * 4)
+  for (const base of [12_000, 40_000, 3_000_000]) {
+    const v = creerVeilleRepos()
+    v.maj(base)
+    for (let i = 0; i < IMAGES_CALME + 5; i++) v.maj(base)
+    assert.equal(v.auRepos, true, `${base} m : la veille ne se pose pas`)
+    v.maj(base * facteur)
+    assert.equal(v.auRepos, false, `${base} m : le même rapport ne réveille pas`)
+  }
+})
+
+test('① un écart SOUS le seuil ne réveille pas, si grand soit-il en mètres', () => {
+  // 3 000 km × (e^(S/2) − 1) ≈ 150 m d'écart absolu : énorme en mètres, nul en
+  // échelle. C'est exactement l'inverse à 12 km, et c'est le point.
+  const v = creerVeilleRepos()
+  const base = 3_000_000
+  v.maj(base)
+  v.maj(base * Math.exp(SEUIL_BOUGE_LOG / 2))
+  assert.equal(v.auRepos, true, 'un demi-seuil réveille')
+})
+
+test('① une altitude non finie, nulle ou négative CONSERVE l’état', () => {
+  // ⚠️ Même contrat que `socleVisible` et `estompageTerre` : une panne de
+  // mesure ne peut pas être une raison de rallumer la Terre autour. Et un
+  // `log(0)` ferait `−Infinity`, donc un écart infini, donc un mouvement
+  // PERMANENT — l'exact contraire de ce que la panne devrait produire.
+  for (const mauvais of [NaN, Infinity, -Infinity, undefined, null, '12000', 0, -1]) {
+    const v = creerVeilleRepos()
+    v.maj(ALT_BLOC)
+    assert.equal(v.maj(mauvais), true, `${String(mauvais)} : l’état n’est pas conservé`)
+    assert.equal(v.auRepos, true)
+  }
+  // et depuis l'état « en mouvement », il reste en mouvement
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  v.maj(ALT_BLOC * 2)
+  assert.equal(v.auRepos, false)
+  assert.equal(v.maj(NaN), false, 'un NaN rendort la vue')
+})
+
+test('① l’automate DÉMARRE au repos, et la première image n’a pas d’écart', () => {
+  // ⚠️ Démarrer « en mouvement » ferait dessiner la planète entière autour du
+  // crop pendant la demi-seconde qui suit l'arrivée — l'image qu'Adrien refuse,
+  // au moment où elle se voit le plus.
+  const v = creerVeilleRepos()
+  assert.equal(v.auRepos, true, 'la veille démarre en mouvement')
+  assert.equal(v.maj(ALT_BLOC), true, 'la première altitude réveille')
+  assert.equal(v.bascules, 0, 'l’arrivée compte comme une bascule')
+})
+
+// ═══════════════════════════════════════════════════════ ② l'hystérésis
+
+test('② UNE image au-dessus du seuil suffit à réveiller', () => {
+  // ⚠️ **LA SORTIE DU REPOS EST INSTANTANÉE, ET C'EST LA MOITIÉ QUI COMPTE À
+  // L'ŒIL** : les alentours doivent être là dès la première image du geste,
+  // sinon la transition commence par un trou.
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  assert.equal(v.maj(ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 2)), false)
+  assert.equal(v.bascules, 1)
+})
+
+test('② il faut EXACTEMENT `IMAGES_CALME` images calmes pour se rendormir', () => {
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  const alt = ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 2)
+  v.maj(alt)
+  assert.equal(v.auRepos, false)
+  for (let i = 1; i < IMAGES_CALME; i++) {
+    assert.equal(v.maj(alt), false, `rendormi à la ${i}ᵉ image calme, il en faut ${IMAGES_CALME}`)
+  }
+  assert.equal(v.maj(alt), true, `pas rendormi à la ${IMAGES_CALME}ᵉ image calme`)
+  assert.equal(v.bascules, 2, 'un aller-retour doit compter DEUX bascules')
+})
+
+test('② une image agitée au milieu du calme REMET le compteur à zéro', () => {
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  let alt = ALT_BLOC
+  const bouge = () => { alt *= Math.exp(SEUIL_BOUGE_LOG * 2); return v.maj(alt) }
+  bouge()
+  for (let i = 0; i < IMAGES_CALME - 1; i++) v.maj(alt)
+  bouge() // une secousse à la dernière image avant le repos
+  for (let i = 0; i < IMAGES_CALME - 1; i++) {
+    assert.equal(v.maj(alt), false, 'le compteur de calme n’a pas été remis à zéro')
+  }
+  assert.equal(v.maj(alt), true)
+})
+
+test('② les deux nombres sont RÉGLABLES, et l’automate les respecte', () => {
+  // ⚠️ Sans ce test, un `imagesCalme` ignoré (recopié depuis la constante du
+  // module) survivrait à une campagne de mutation.
+  const v = creerVeilleRepos({ seuilBougeLog: 1e-2, imagesCalme: 3 })
+  v.maj(1000)
+  // un écart de 5e-3 : au-dessus du seuil du module, SOUS celui qu'on passe
+  assert.equal(v.maj(1000 * Math.exp(5e-3)), true, 'le seuil passé n’est pas lu')
+  v.maj(1000 * Math.exp(0.05))
+  assert.equal(v.auRepos, false)
+  v.maj(1000 * Math.exp(0.05))
+  v.maj(1000 * Math.exp(0.05))
+  assert.equal(v.auRepos, false, 'rendormi avant les trois images demandées')
+  assert.equal(v.maj(1000 * Math.exp(0.05)), true, 'le nombre d’images calmes passé n’est pas lu')
+})
+
+// ═══════════════════════════════════════════ ③ les nombres tiennent la mesure
+
+// La traîne d'amortissement d'OrbitControls, telle qu'elle a été RELEVÉE dans
+// l'application vivante le 2026-08-22 (`.banc/vues-N/AV-trace-orbite.json`) :
+// géométrique, de rapport ≈ 0,970 par image, et **elle n'atteint jamais zéro** —
+// encore `7,7 × 10⁻¹¹` par image 603 images (10 s) après la fin du geste.
+const PIC_ORBITE = 2.2214692928630937e-2
+const RAPPORT_TRAINE = 0.9704
+// Le pic du geste DÉLIBÉRÉ le plus doux mesuré — une molette
+// (`.banc/vues-N/AV-trace-molette.json`). ⚠️ C'est un PLAFOND pour le seuil.
+const PIC_MOLETTE = 4.673510453424828e-4
+
+function rejouerTraine(v, { alt0 = ALT_BLOC, pic, rapport, images }) {
+  let alt = alt0
+  let e = pic
+  const journal = []
+  for (let i = 0; i < images; i++) {
+    alt *= Math.exp(e)
+    journal.push(v.maj(alt))
+    e *= rapport
+  }
+  return journal
+}
+
+test('③ une traîne d’amortissement ne fait que DEUX bascules, pas quatre', () => {
+  // ⚠️ **C'EST LE TEST DU BATTEMENT, ET C'EST CELUI QUI COMPTE.** Le seuil du
+  // socle a produit onze bascules là où il en fallait une ; ici la traîne est
+  // MONOTONE, donc elle ne peut traverser le seuil qu'une fois — mais seulement
+  // si l'hystérésis existe. Un `IMAGES_CALME` à zéro rendrait la vue « au repos »
+  // à chaque image où la décroissance passe sous le seuil.
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  rejouerTraine(v, { pic: PIC_ORBITE, rapport: RAPPORT_TRAINE, images: 900 })
+  assert.equal(v.auRepos, true, 'la traîne asymptotique laisse la vue éveillée pour toujours')
+  assert.equal(v.bascules, 2, 'un geste doit faire un réveil et un endormissement, pas plus')
+})
+
+test('③ la traîne se calme en moins de six secondes à 60 Hz', () => {
+  // ⚠️ **UNE BORNE, PAS UN CHIFFRE EXACT** : la mesure donne 140 images de
+  // traîne au-dessus du seuil, plus `IMAGES_CALME`, soit 170. On garde 360 (six
+  // secondes) pour que le test dise « ça se pose » et non « ça se pose à
+  // l'image près », ce qui rendrait un réglage impossible à bouger.
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  const journal = rejouerTraine(v, { pic: PIC_ORBITE, rapport: RAPPORT_TRAINE, images: 600 })
+  const posee = journal.indexOf(true)
+  assert.ok(posee > 0, 'la vue ne se pose jamais')
+  assert.ok(posee <= 360, `la vue met ${posee} images à se poser`)
+})
+
+test('③ le geste de molette le plus DOUX mesuré réveille bien la vue', () => {
+  // ⚠️ **C'EST LA CONTRAINTE QUI FIXE LE PLAFOND DU SEUIL.** Vérifié sur la
+  // trace : à `S = 10⁻³` la molette ne compte AUCUNE image au-dessus du seuil —
+  // un vrai zoom passerait pour un repos, et les alentours n'apparaîtraient
+  // jamais.
+  assert.ok(SEUIL_BOUGE_LOG < PIC_MOLETTE, 'le seuil manque le geste le plus doux mesuré')
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  v.maj(ALT_BLOC * Math.exp(PIC_MOLETTE))
+  assert.equal(v.auRepos, false, 'une molette ne réveille pas la vue')
+})
+
+test('③ au repos STRICT, l’écart mesuré vaut zéro et la vue ne bouge pas', () => {
+  // Relevé : 3 216 images de suite, `altitudeCadrageM()` bit pour bit identique.
+  const v = creerVeilleRepos()
+  for (let i = 0; i < 3216; i++) v.maj(ALT_BLOC)
+  assert.equal(v.dernierEcart, 0)
+  assert.equal(v.bascules, 0)
+  assert.equal(v.auRepos, true)
+})
+
+// ═══════════════════════════════════════════════════════════════ ④ l'oubli
+
+test('④ `oublier` empêche le résidu orbital de passer pour un mouvement', () => {
+  const v = creerVeilleRepos()
+  v.maj(ALT_BLOC)
+  v.oublier()
+  // le résidu orbital est d'un TOUT AUTRE ordre de grandeur (`veille-socle.js`,
+  // §2) : sans l'oubli, cette image ferait un écart énorme
+  assert.equal(v.maj(ALT_BLOC * 1000), true, 'le retour d’orbite réveille la vue')
+  assert.equal(v.bascules, 0)
+})
+
+// ═════════════════════════════════════════════════════════════ ⑤ l'estompage
+
+test('⑤ `poserRepos(true)` force UN — le crop seul', () => {
+  const vus = []
+  const v = creerVeilleEstompage({ appliquer: (f) => vus.push(f) })
+  v.maj(ALT_BLOC)
+  const loi = v.valeur
+  assert.ok(loi > 0 && loi < 1, `l’altitude de test doit être DANS la bande (${loi})`)
+  v.poserRepos(true)
+  assert.equal(v.valeur, 1, 'le repos ne force pas le crop seul')
+  v.poserRepos(false)
+  assert.equal(v.valeur, loi, 'la sortie du repos ne rend pas la main à la loi')
+  assert.deepEqual(vus, [loi, 1, loi])
+})
+
+test('⑤ l’ORBITE prime sur le repos — la Terre y est le sujet', () => {
+  // ⚠️ Un repos qui primerait effacerait la planète au moment précis où elle
+  // redevient le sujet : un écran vide. C'est le §6 du module, et il ne se
+  // rediscute pas.
+  const v = creerVeilleEstompage({ appliquer: () => {} })
+  v.maj(ALT_BLOC)
+  v.poserRepos(true)
+  assert.equal(v.valeur, 1)
+  v.poserMode(false)
+  assert.equal(v.valeur, 0, 'le repos survit à l’orbite')
+  v.poserMode(true)
+  assert.equal(v.valeur, 1, 'le repos ne revient pas avec la surface')
+})
+
+test('⑤ `appliquer` n’est rappelé que sur CHANGEMENT, repos compris', () => {
+  let n = 0
+  const v = creerVeilleEstompage({ appliquer: () => { n++ } })
+  v.maj(ALT_BLOC)
+  const apresLoi = n
+  for (let i = 0; i < 50; i++) v.poserRepos(true)
+  assert.equal(n, apresLoi + 1, 'le repos réécrit l’uniforme à chaque image')
+})
+
+test('⑤ LA LOI N’EST PAS TOUCHÉE — `estompageTerre` rend ce qu’elle rendait', () => {
+  // ⚠️ **C'EST LA GARDE DE LA TÂCHE G, ET ELLE EST EXPLICITE DANS LE CAHIER DES
+  // CHARGES DE LA TÂCHE N** : « tu changes QUAND il s'applique, jamais sa loi ».
+  // La loi est une fonction PURE de l'altitude : elle ne peut pas connaître le
+  // repos, et ce test le dit en toutes lettres.
+  assert.equal(estompageTerre({ altitudeEllipsoideM: SEUIL_MORT_M }), 0)
+  assert.equal(estompageTerre({ altitudeEllipsoideM: SEUIL_MORT_M * 2 }), 0)
+  const dedans = estompageTerre({ altitudeEllipsoideM: ALT_BLOC })
+  assert.ok(dedans > 0 && dedans < 1)
+  // et `auSeuil` — ce que l'altitude dit — ignore le repos, il n'y a qu'un
+  // seul endroit où les deux se rencontrent, et c'est `poser()`
+  const v = creerVeilleEstompage({ appliquer: () => {} })
+  v.maj(ALT_BLOC)
+  v.poserRepos(true)
+  assert.equal(v.auSeuil, dedans, 'le repos a contaminé la loi')
+})
+
+// ═══════════════════════════════════════════════════════════ ⑥ le branchement
+
+function globeDePapier() {
+  const g = {
+    cropSeul: null,
+    posesCropSeul: 0,
+    poserCrop: () => ({ cx: 0.5, cy: 0.5, demi: 0.01 }),
+    construireParoisCrop: () => ({ refus: null }),
+    poserHabillage: () => {},
+    poserRampe: () => ({ refus: null }),
+    poserMer: async () => ({ refus: null }),
+    retirerCrop: () => {},
+    poserCropSeul(v) { g.cropSeul = v; g.posesCropSeul++; return v },
+  }
+  return g
+}
+
+const ctxFactice = () => ({ centre: { lat: -21, lon: 55 }, zoom: 12, tuilesParBloc: 3, habillage: {} })
+
+function veilleEstompageFactice() {
+  const etat = { repos: null, poses: 0, modes: [] }
+  return {
+    etat,
+    maj() {},
+    poserMode(v) { etat.modes.push(!!v) },
+    poserRepos(v) { etat.repos = v; etat.poses++ },
+  }
+}
+
+test('⑥ le repos atteint SES DEUX destinataires, et sur la même image', () => {
+  // ⚠️ Séparés, on aurait un dessin sans coût ou un coût sans dessin — les deux
+  // moitiés du défaut que la tâche répare.
+  const g = globeDePapier()
+  const est = veilleEstompageFactice()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  veille.maj(ALT_BLOC)
+  assert.equal(veille.pose, true, 'le crop n’est pas posé à l’altitude de test')
+  assert.equal(veille.repos, true, 'le repos n’est pas relayé')
+  assert.equal(g.cropSeul, true, '`poserCropSeul` n’a pas été appelée')
+  assert.equal(est.etat.repos, true, '`poserRepos` n’a pas été appelée')
+})
+
+test('⑥ SANS CROP POSÉ, le repos n’est relayé à personne', () => {
+  // ⚠️ **CE N'EST PAS UNE PRUDENCE, C'EST LA LOI** : sans découpe, l'estompage
+  // plein efface la planète et ne met rien à la place — un écran vide.
+  const g = globeDePapier()
+  const est = veilleEstompageFactice()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  // très au-dessus du seuil de mort : le socle, donc le crop, n'existe pas
+  veille.maj(SEUIL_MORT_M * 4)
+  assert.equal(veille.pose, false)
+  assert.equal(veille.repos, false, 'le repos est relayé sans crop')
+  assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans crop')
+  assert.equal(est.etat.repos, null, '`poserRepos` appelée sans crop')
+})
+
+test('⑥ un mouvement RETIRE le crop seul, et le retour au calme le remet', () => {
+  const g = globeDePapier()
+  const est = veilleEstompageFactice()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est, repos: creerVeilleRepos() })
+  veille.maj(ALT_BLOC)
+  assert.equal(g.cropSeul, true)
+  // un geste : une seule image suffit
+  veille.maj(ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 3))
+  assert.equal(g.cropSeul, false, 'le geste ne rallume pas les alentours')
+  assert.equal(veille.basculesRepos, 2)
+  const alt = ALT_BLOC * Math.exp(SEUIL_BOUGE_LOG * 3)
+  for (let i = 0; i < IMAGES_CALME; i++) veille.maj(alt)
+  assert.equal(g.cropSeul, true, 'la vue posée ne recroppe pas')
+  assert.equal(veille.basculesRepos, 3)
+})
+
+test('⑥ le relais ne réécrit RIEN tant que l’état ne change pas', () => {
+  const g = globeDePapier()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: creerVeilleRepos() })
+  for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC)
+  assert.equal(g.posesCropSeul, 1, `${g.posesCropSeul} appels de \`poserCropSeul\` pour un seul état`)
+})
+
+test('⑥ l’ORBITE éteint le crop seul et fait OUBLIER l’altitude de référence', () => {
+  const g = globeDePapier()
+  const oublis = []
+  const repos = creerVeilleRepos()
+  const espion = { maj: (a) => repos.maj(a), oublier: () => { oublis.push(1); repos.oublier() } }
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: espion })
+  veille.maj(ALT_BLOC)
+  assert.equal(g.cropSeul, true)
+  veille.poserMode(false)
+  assert.equal(g.cropSeul, false, 'le crop seul survit à l’orbite')
+  assert.equal(oublis.length, 1, 'l’orbite ne fait pas oublier la référence')
+  // ⚠️ **DANS LES DEUX SENS** : ne l'oublier qu'à l'aller laisserait le retour
+  // comparer une altitude de surface au dernier résidu orbital.
+  veille.poserMode(true)
+  assert.equal(oublis.length, 2, 'le retour en surface ne fait pas oublier la référence')
+})
+
+test('⑥ l’ORBITE ne POLLUE PAS les compteurs de la veille du repos', () => {
+  // ⚠️ **CE N'EST PAS UN DÉTAIL DE COMPTABILITÉ.** `veilleRepos.bascules` est
+  // l'instrument par lequel on compte le BATTEMENT à l'écran ; nourri du résidu
+  // orbital, il compterait des réveils qui n'existent pas et le banc mentirait
+  // — la classe d'erreur que le §0 du plan énumère huit fois.
+  const g = globeDePapier()
+  const repos = creerVeilleRepos()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos })
+  veille.maj(ALT_BLOC)
+  const avant = repos.bascules
+  veille.poserMode(false)
+  // le résidu orbital : `altitudeCadrageM()` y rend n'importe quoi, et il varie
+  for (let i = 0; i < 200; i++) veille.maj(ALT_BLOC * (100 + i))
+  assert.equal(repos.bascules, avant, `la veille du repos a compté ${repos.bascules - avant} bascules en orbite`)
+  assert.equal(repos.dernierEcart, 0, 'la veille du repos a mesuré un écart sur un résidu orbital')
+})
+
+test('⑥ SANS veille de repos, le comportement est celui d’AVANT la tâche', () => {
+  // ⚠️ Le patron « on élargit, on ne change pas le défaut » — il existe six fois
+  // dans ce dépôt, et c'est la consigne D5 (le mode plat ne bouge pas).
+  const g = globeDePapier()
+  const est = veilleEstompageFactice()
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, estompage: est })
+  for (let i = 0; i < 100; i++) veille.maj(ALT_BLOC)
+  assert.equal(veille.repos, false)
+  assert.equal(g.cropSeul, null, '`poserCropSeul` appelée sans veille de repos')
+  assert.equal(est.etat.poses, 0, '`poserRepos` appelée sans veille de repos')
+})
+
+test('⑥ le globe est LU à chaque image, jamais figé à la construction', () => {
+  // ⚠️ **C'EST LA FORME QUE `main.js` EMPLOIE, ET ELLE A UNE RAISON MESURÉE** :
+  // « `globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR. Il est réassigné à
+  // la perte de contexte WebGL ; une référence figée survivrait à la
+  // réassignation et poserait le crop sur un globe mort, sans une erreur. » Le
+  // relais du repos doit suivre la MÊME règle — sinon il parlerait au globe
+  // d'avant, ou (si `globe` est la fonction elle-même) à personne.
+  //
+  // ⚠️ **CETTE MUTATION A SURVÉCU AU PREMIER TOUR DE CAMPAGNE**, et pour une
+  // raison instructive : tous les autres tests passent le globe PAR SA VALEUR,
+  // où `lireGlobe()` et `globe` sont le même objet. La faute était invisible
+  // sous la seule forme que la production n'emploie pas.
+  let vivant = globeDePapier()
+  const veille = creerVeilleCrop({ globe: () => vivant, contexte: ctxFactice, repos: creerVeilleRepos() })
+  veille.maj(ALT_BLOC)
+  assert.equal(vivant.cropSeul, true, 'le relais ne lit pas le globe à travers sa fonction')
+  // la perte de contexte : le globe est remplacé, et c'est le NOUVEAU qui doit
+  // recevoir la suite
+  const mort = vivant
+  vivant = globeDePapier()
+  veille.poserMode(false)
+  veille.poserMode(true)
+  veille.maj(ALT_BLOC)
+  assert.equal(vivant.cropSeul, true, 'le relais parle encore au globe d’avant')
+  assert.equal(mort.posesCropSeul, 1, 'le globe mort a reçu un ordre après sa mort')
+})
+
+test('⑥ un globe SANS `poserCropSeul` n’est pas une panne', () => {
+  // Même contrat que `poserFondCrop` (Tâche J bis) : ce module se vérifie sous
+  // node contre un globe de papier, qui ne porte que ce qu'il exerce.
+  const g = globeDePapier()
+  delete g.poserCropSeul
+  const veille = creerVeilleCrop({ globe: g, contexte: ctxFactice, repos: creerVeilleRepos() })
+  assert.doesNotThrow(() => veille.maj(ALT_BLOC))
+  assert.equal(veille.repos, true)
+})
+
+// ═══════════════════════════════════════════════════════════════ ⑦ le globe
+//
+// ⚠️ **SUR UN VRAI QUADTREE, PAS SUR UNE MAQUETTE.** Le harnais est celui de
+// `test/globe-eviction.test.js` : un DOM bouché, un réseau qui COMPTE, et une
+// caméra complète (sans `projectionMatrix`, le tri spatial n'a rien à trier et
+// le parcours mesuré serait l'ancien).
+
+const ELEV = 812
+const [ER, EG, EB] = encodeTerrarium(ELEV)
+const dalles = new Map()
+function dalleDe(cote) {
+  let d = dalles.get(cote)
+  if (!d) {
+    d = new Uint8ClampedArray(cote * cote * 4)
+    for (let i = 0; i < cote * cote; i++) {
+      d[i * 4] = ER; d[i * 4 + 1] = EG; d[i * 4 + 2] = EB; d[i * 4 + 3] = 255
+    }
+    dalles.set(cote, d)
+  }
+  return d
+}
+class FauxCtx {
+  createLinearGradient() { return { addColorStop() {} } }
+  fillRect() {}
+  drawImage() {}
+  getImageData(x, y, w) { return { data: dalleDe(w) } }
+}
+globalThis.document = {
+  createElement() {
+    const c = { width: 0, height: 0 }
+    c.getContext = () => (c._ctx ??= new FauxCtx())
+    return c
+  },
+}
+globalThis.createImageBitmap = async (blob) => blob
+
+const urls = new Set()
+function servir() {
+  urls.clear()
+  globalThis.fetch = async (url) => {
+    urls.add(url)
+    await new Promise((r) => setTimeout(r, 0))
+    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
+  }
+}
+
+const { Globe, _resetTileMemo } = await import('../src/globe.js')
+const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
+const { _resetDemSource } = await import('../src/dem-source.js')
+const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')
+
+const LAT = -21.115
+const LON = 55.53
+// ⚠️ **LE `fov` EST UNE ENTRÉE, ET LE DÉPÔT L'A PAYÉ DEUX FOIS.** Le code dit
+// 30, l'application vivante tourne à 33 (relevé à la console le 2026-08-22 :
+// `camera.fov = 33`, `camGlobe.fov = 33`). Ici c'est un harnais, pas une loi :
+// on prend le défaut, et rien dans la tâche n'en dérive un seuil.
+const FOV = 30
+
+function poserCamera(camera, rayon) {
+  latLonToSphere(LAT, LON, rayon, camera.position)
+  camera.near = Math.min(Math.max((rayon - R_GLOBE) * 0.2, 0.01), 0.5)
+  camera.up.set(0, 1, 0)
+  camera.lookAt(0, 0, 0)
+  camera.updateMatrixWorld(true)
+  camera.updateProjectionMatrix()
+  return camera
+}
+
+async function calme(globe, max = 4000) {
+  for (let i = 0; i < max; i++) {
+    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
+    await new Promise((r) => setTimeout(r, 0))
+  }
+  throw new Error('le globe ne se calme pas')
+}
+
+// ⚠️ **LE GLOBE EST AMENÉ À L'ALTITUDE DU BLOC AVANT TOUTE MESURE**, sinon on
+// comparerait deux quadtrees qui n'ont pas eu le temps de descendre.
+async function globeAuBloc({ cropSeulDesLeDepart = false } = {}) {
+  servir()
+  _resetTileMemo()
+  _resetDemSource()
+  const globe = new Globe({ globeContinu: true })
+  globe.setVisible(true)
+  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
+  // ⚠️ **`cropSeulDesLeDepart` N'EST PAS UN CONFORT DE TEST.** Poser le drapeau
+  // APRÈS la descente laisse en cache tout ce que la descente a chargé — ce qui
+  // est exactement ce qu'on veut vérifier ailleurs (la transition est gratuite),
+  // et ce qui MASQUE ici la question posée : un quart au bord du crop
+  // attend-il des enfants qui ne naîtront jamais ? Avec le drapeau levé dès la
+  // première image, ils ne sont jamais nés.
+  if (cropSeulDesLeDepart) {
+    globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
+    globe.poserCropSeul(true)
+  }
+  for (const r of [140, 120, 108, 103, 101.5, 100.6, 100.3, 100.2]) {
+    poserCamera(camera, r)
+    for (let k = 0; k < 6; k++) { globe.update(camera, 0.016); await calme(globe) }
+  }
+  if (!cropSeulDesLeDepart) globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
+  for (let k = 0; k < 8; k++) { globe.update(camera, 0.016); await calme(globe) }
+  return { globe, camera }
+}
+
+function bilan(globe) {
+  let dessinees = 0
+  let dessineesHors = 0
+  let maillees = 0
+  let horsCrop = 0
+  const dedansDessinees = new Set()
+  for (const [cle, t] of globe.tiles) {
+    const dehors = globe._crop ? !tuileDansCrop(t.z, t.x, t.y, globe._crop) : false
+    if (dehors) horsCrop++
+    if (t.mesh) maillees++
+    if (t.mesh?.visible) {
+      dessinees++
+      if (dehors) dessineesHors++
+      else dedansDessinees.add(cle)
+    }
+  }
+  return { dessinees, dessineesHors, maillees, horsCrop, dedansDessinees, visites: globe._visites, cache: globe.tiles.size }
+}
+
+test('⑦ AVANT : le `discard` laisse dessiner des tuiles entièrement hors crop', async () => {
+  // ⚠️ **C'EST LE DÉFAUT, ÉCRIT COMME UN TEST.** Le nuanceur jette le fragment,
+  // mais l'appel de dessin est déjà parti. Mesuré dans l'application vivante
+  // (La Réunion, altitude de bloc, `uEstompage = 1`) : **351 tuiles dessinées,
+  // dont 315 entièrement hors crop**.
+  const { globe, camera } = await globeAuBloc()
+  globe.update(camera, 0.016)
+  const av = bilan(globe)
+  assert.ok(av.dessineesHors > 0, 'le harnais ne reproduit pas le défaut : rien n’est dessiné hors crop')
+  assert.ok(av.dessinees > av.dessinees - av.dessineesHors, 'le crop dessinerait tout à lui seul')
+})
+
+test('⑦ APRÈS : hors crop, plus rien n’est parcouru ni dessiné', async () => {
+  const { globe, camera } = await globeAuBloc()
+  globe.update(camera, 0.016)
+  const av = bilan(globe)
+  globe.poserCropSeul(true)
+  globe.update(camera, 0.016)
+  await calme(globe)
+  globe.update(camera, 0.016)
+  const ap = bilan(globe)
+  assert.equal(ap.dessineesHors, 0, `${ap.dessineesHors} tuiles hors crop sont encore dessinées`)
+  assert.ok(ap.visites < av.visites, `le parcours n’a pas diminué (${av.visites} → ${ap.visites})`)
+  assert.ok(ap.dessinees > 0, 'le crop lui-même a disparu')
+  // ⚠️ **AUCUN TROU, ET C'EST LA MOITIÉ DU CONTRAT.** Le crop doit être dessiné
+  // par EXACTEMENT les mêmes tuiles qu'avant — pas une de moins. Un quart de
+  // quadtree dont les quatre enfants tombent hors du crop alors que lui-même y
+  // touche descendrait dans le vide et ouvrirait une encoche d'une tuile ;
+  // c'est ce que garde le `kids.length > 0` de la règle sans-trou.
+  assert.deepEqual(
+    [...ap.dedansDessinees].sort(),
+    [...av.dedansDessinees].sort(),
+    'le crop n’est plus dessiné par les mêmes tuiles : il s’est ouvert un trou',
+  )
+})
+
+test('⑦ un quart au BORD n’attend pas les enfants qu’il ne créera jamais', async () => {
+  // ⚠️ **SANS CETTE RÈGLE, L'ADMISSION PAIE DES TUILES FANTÔMES.** Un quart qui
+  // chevauche la frontière du crop n'aura jamais que deux enfants sur quatre ;
+  // les compter dans `_enfantsPresents` ferait débiter quatre crédits pour deux
+  // tuiles, à chaque image, pour toujours.
+  const { globe } = await globeAuBloc({ cropSeulDesLeDepart: true })
+  let bord = null
+  for (const t of globe.tiles.values()) {
+    if (globe._horsCropSeul(t.z, t.x, t.y)) continue
+    const enfants = globe._children(t)
+    if (enfants.length > 0 && enfants.length < 4) { bord = { t, enfants } ; break }
+  }
+  assert.ok(bord, 'le harnais ne produit aucun quart à cheval sur le bord du crop')
+  assert.equal(globe._enfantsPresents(bord.t), true, 'le quart attend des enfants qui ne naîtront pas')
+})
+
+test('⑦ APRÈS : plus une seule URL hors crop n’est demandée', async () => {
+  // ⚠️ **C'EST L'EXIGENCE DURE — « pas dessinés, pas maillés, pas chargés ».**
+  // Sans le filtrage dans `_children`, la règle sans-trou continuerait de
+  // demander les enfants hors crop de chaque quart qui chevauche le bord.
+  //
+  // ⚠️ **CE QUI EST DÉJÀ EN CACHE Y RESTE, ET C'EST VOULU** — c'est ce qui rend
+  // la transition gratuite (test suivant). Ce qu'on garde ici, c'est qu'il n'en
+  // NAÎT plus une seule.
+  const { globe, camera } = await globeAuBloc()
+  globe.poserCropSeul(true)
+  for (let k = 0; k < 4; k++) { globe.update(camera, 0.016); await calme(globe) }
+  const connues = new Set(globe.tiles.keys())
+  urls.clear()
+  for (let k = 0; k < 8; k++) { globe.update(camera, 0.016); await calme(globe) }
+  const neuves = [...globe.tiles.keys()].filter((k) => !connues.has(k))
+  for (const cle of neuves) {
+    const t = globe.tiles.get(cle)
+    assert.ok(
+      !globe._horsCropSeul(t.z, t.x, t.y),
+      `la tuile z${t.z}/${t.x}/${t.y}, hors crop, a été créée après la bascule`,
+    )
+  }
+  assert.equal(urls.size, 0, `${urls.size} tuiles demandées au réseau au repos`)
+})
+
+test('⑦ le drapeau ÉTEINT rend le parcours d’avant, tuile pour tuile', async () => {
+  // ⚠️ La garde de `uCropOn`, `uHabOn`, `uMerRampeOn` — et la consigne D5 : la
+  // production ne bouge pas d'un bit tant que personne ne lève l'interrupteur.
+  const { globe, camera } = await globeAuBloc()
+  globe.update(camera, 0.016)
+  const a = bilan(globe)
+  assert.equal(globe._cropSeul, false, 'le globe naît avec le crop seul allumé')
+  globe.poserCropSeul(false)
+  globe.update(camera, 0.016)
+  const b = bilan(globe)
+  assert.deepEqual(b, a, 'un `poserCropSeul(false)` change le parcours')
+})
+
+test('⑦ SANS CROP POSÉ, le drapeau ne coupe RIEN', async () => {
+  // ⚠️ Couper sur un repère absent ferait disparaître la planète entière.
+  const { globe, camera } = await globeAuBloc()
+  globe.retirerCrop()
+  globe.poserCropSeul(true)
+  globe.update(camera, 0.016)
+  const b = bilan(globe)
+  assert.ok(b.dessinees > 0, 'la planète a disparu faute de crop')
+  assert.equal(globe._horsCropSeul(2, 0, 0), false)
+})
+
+test('⑦ le crop RETROUVÉ ne repasse pas par le réseau — la transition est gratuite', async () => {
+  // ⚠️ **LE CAHIER DES CHARGES LE DEMANDE EXPLICITEMENT** : « le cache ne doit
+  // pas évincer ce qu'il faudra pour la transition — sinon chaque dézoom
+  // redéclenchera un chargement, ce qu'Adrien refuse ». Ici c'est
+  // arithmétique : au repos le cache ne DÉBORDE pas, donc `_evict` ne passe
+  // jamais, donc rien n'est rendu au réseau.
+  const { globe, camera } = await globeAuBloc()
+  const cache = globe.tiles.size
+  assert.ok(cache < globe.cacheMax, `le cache déborde déjà (${cache} / ${globe.cacheMax})`)
+  globe.poserCropSeul(true)
+  for (let k = 0; k < 30; k++) { globe.update(camera, 0.016); await calme(globe) }
+  const restant = globe.tiles.size
+  urls.clear()
+  // la transition : on rend la main aux alentours
+  globe.poserCropSeul(false)
+  globe.update(camera, 0.016)
+  assert.equal(urls.size, 0, `${urls.size} tuiles redemandées au réseau à la première image du dézoom`)
+  assert.ok(restant >= cache * 0.9, `le repos a rendu ${cache - restant} tuiles sur ${cache}`)
+})
+
+// ══════════════════════════════════════════════════════ ⑧ le texte de main.js
+
+test('⑧ la veille du repos est CONSTRUITE et BRANCHÉE dans `main.js`', () => {
+  // ⚠️ **AUCUN TEST DE CE DÉPÔT NE CHARGE `main.js`** (§0 du plan), et c'est
+  // exactement ce qui a laissé la Tâche I passer six méthodes sans appelant.
+  assert.ok(/import \{ creerVeilleRepos \} from '\.\/monde\/veille-repos\.js'/.test(MAIN), 'le module n’est pas importé')
+  assert.ok(/const veilleRepos = creerVeilleRepos\(\)/.test(MAIN), 'la veille n’est pas construite')
+  assert.ok(/\n  repos: veilleRepos,/.test(MAIN), 'la veille n’atteint pas `creerVeilleCrop`')
+})
+
+test('⑧ la veille du repos est EXPOSÉE, comme les trois autres', () => {
+  assert.ok(/\n  veilleRepos,/.test(MAIN), '`veilleRepos` n’est pas dans `__exp` : rien ne se vérifie à l’écran')
+})
+
+test('⑧ `main.js` ne lit PAS l’altitude une seconde fois pour le repos', () => {
+  // ⚠️ **UNE SEULE LECTURE D'ALTITUDE, TROIS CONSOMMATEURS** — l'argument est
+  // déjà écrit deux fois dans `main.js`, et le chantier l'a payé trois fois.
+  assert.ok(!/veilleRepos\.maj\(/.test(MAIN), '`main.js` nourrit la veille du repos en direct : deux chemins pour un geste')
+})
