a5b188e tache J bis : LE FOND DU CROP — la surface porte enfin le relief sous-marin

 docs/superpowers/plans/2026-08-22-globe-studio.md |  53 +-
 package.json                                      |   2 +-
 src/globe.js                                      | 264 +++++++-
 src/main.js                                       |  21 +-
 src/monde/branchement-crop.js                     |  57 +-
 src/monde/fond-crop.js                            | 196 ++++++
 src/monde/parois-crop.js                          |  21 +-
 test/crop-branche.test.js                         | 141 ++++-
 test/crop-habillage.test.js                       |   6 +-
 test/fond-crop.test.js                            | 733 ++++++++++++++++++++++
 test/mer-sphere.test.js                           |  30 +-
 11 files changed, 1493 insertions(+), 31 deletions(-)

diff --git a/docs/superpowers/plans/2026-08-22-globe-studio.md b/docs/superpowers/plans/2026-08-22-globe-studio.md
index 97dbf61..05d020e 100644
--- a/docs/superpowers/plans/2026-08-22-globe-studio.md
+++ b/docs/superpowers/plans/2026-08-22-globe-studio.md
@@ -119,20 +119,71 @@ Trois trous mesurés, **un seul défaut** :
    des nœuds ; **z10 en couvre 100 %** pour 25 tuiles. **Choisir le zoom depuis l'emprise.**
 3. ⛔ **La mer déborde de 400 km sur un bloc de 10 km**, et **l'estompage ne la touche pas**.
    Borner la portée de la calotte sur l'emprise du crop, et **la faire suivre l'estompage**.
 
 - [ ] Test → rouge → implémenter → mutation → **REGARDER L'ÉCRAN** → clôture.
 - [ ] **Critère : plus aucun aplat gris. La mer a un fond, et elle s'arrête où il faut.**
 - [ ] ⚠️ **Vérifier aussi la couverture des HAUTEURS** : `reserverHauteurs` a une marge d'une
       tuile ; **sans elle la couverture plafonne à 0,552**. Le défaut est corrigé, **le
       vérifier non régressé** fait partie de la tâche.
 
+### Tâche J bis — LA BATHYMÉTRIE DANS LA SURFACE DU CROP ⚠️ AVANT K
+
+**Fichiers :** `src/globe.js` (`_buildMesh`/`posAt`, le nuanceur), `src/main.js`
+(`contexteCrop`), `src/monde/*`, tests.
+⛔ **Interdit : `terrain.js`, `plinth.js`, `ocean.js`.**
+
+**Le défaut, établi par élimination par la Tâche J et non supposé :**
+
+> Au-dessus de ~20 km la mer se lit en **taches bleues et vertes**. Mer cachée → le fond du
+> crop est **un plateau vert uniforme**. Houle et clapot à zéro → **le marbrage disparaît
+> entièrement**. Les creux de houle (**73 m mesurés**) passent **derrière** un fond marin
+> rendu **à l'altitude ZÉRO**.
+>
+> ➡️ **LE CHAMP DE LA MER A UN FOND ; LA SURFACE DU CROP N'EN A PAS.** C'est ce désaccord
+> qu'on voit.
+
+**Trois sorties nommées par la Tâche J, aucune mesurée :**
+
+1. **La bathymétrie dans les tuiles du crop** — la surface porte le relief sous-marin, donc
+   les deux surfaces s'accordent. ⭐ **C'est la seule qui répare la CAUSE ; les deux autres
+   masquent le symptôme.** ⚠️ Prix à établir : les tuiles terrarium portent-elles des valeurs
+   négatives exploitables, ou faut-il fusionner `bathy.js` dans les hauteurs du quadtree ?
+   **`bathy.js` opère en lat/lon, il est donc portable — c'est le point d'entrée qui manque.**
+2. **La houle coupée** au-dessus d'une altitude — supprime le marbrage sans donner de fond.
+   ⚠️ **Attention : la Tâche F a mesuré `ΔE = 0` à 6,4 km et `0,10` à 12,7 km entre la mer
+   riche et la mer plate — la houle ne se lit PAS aux altitudes du bloc.** Donc la couper
+   haut coûterait peu. **Mais ça ne répare rien.**
+3. **`depthTest: false`** sur la nappe — ⛔ **le plus dangereux** : la mer passerait devant
+   tout, y compris devant la terre qui devrait la cacher.
+
+**Ce qu'on attend :** **choisir la sortie 1 si elle est atteignable, et le DIRE si elle ne
+l'est pas.** Une tâche qui rend « la cause est hors de portée pour telle raison mesurée, voici
+le palliatif et son prix » vaut mieux qu'une tâche qui maquille.
+
+- [ ] **Étape 1 — la mesure.** Les tuiles portent-elles la bathymétrie ? À quelle profondeur,
+      à quel zoom, avec quelle couverture ? **Chiffres avec source, données brutes sur disque.**
+- [ ] **Étape 2** — test rouge.
+- [ ] **Étape 3** — implémenter.
+- [ ] **Étape 4** — mutation sémantique, worktree à part.
+- [ ] **Étape 5 — REGARDER L'ÉCRAN.** ⚠️ **Le témoin est la capture
+      `.banc/vues-J/J-final-17-apres-commit.png` : les taches bleues et vertes doivent
+      disparaître.** Captures dans `.banc/vues-Jbis/`.
+- [ ] **Étape 6** — clôture, page chargée drapeau levé ET baissé.
+
+⚠️ **Deux constats de la Tâche J à reprendre au passage, tous deux à deux pas de ton chemin :**
+- **`uCoastMaskOn` du globe vaut 0 alors que `contexteCrop` porte un masque** — constaté, pas
+  creusé. Si c'est un branchement manquant, c'est peut-être une part du plateau vert uniforme.
+- **`uCropCoin`/`uCropCoinN` étaient déclarés dans `MER_FRAG` et lus par PERSONNE** depuis la
+  Tâche F — **cinquième constante morte du chantier.** La Tâche J vient de les réveiller ;
+  vérifie qu'ils servent vraiment.
+
 #### Tâche K — LA CONTINUITÉ DE TEXTURE ⚠️ CE QUI FERME LES ARÊTES DROITES
 
 **Fichiers :** `src/globe.js` (nuanceur de fragment), tests.
 
 - [ ] **Étape 1 — la mesure AVANT.** Reprendre le protocole d'élimination de la Tâche G en
       **gelant `minFade` puis le terme `vUv` du grain tour à tour**, pour savoir **laquelle
       des deux sources domine**. ⚠️ **Cette mesure n'a jamais été faite : ne pas la sauter.**
 - [ ] **Étape 2 — désindexer.** `minFade` : remplacer la mesure locale
       `fwidth(vUv) * uTilePx` par une grandeur **continue** (dérivée de `vLatLon` ou d'une
       distance-caméra), **indépendante du zoom de la tuile**. Le grain de papier : l'indexer
@@ -250,21 +301,21 @@ plat au lieu de raycaster**.
 
 #### Tâche Q — LES DERNIERS MENSONGES
 Les paliers inertes (`resolution`, `demZoom`) · **les templates qui capturent des clés mortes
 sans un mot à l'utilisateur** · `veilleCrop.poserMode()` **jamais appelé** ·
 **une seule source de vérité pour le fov** (un second `FOV_DEG` dort dans
 `exageration-continue.js`) · les **jupes qui pendent sous le bloc** · **les citations
 `main.js:263` fausses**.
 
 ## §4 — Ordre imposé
 
-**J** (la surface) → **K** (la texture) → **L** (l'exagération) → **M** (les paliers) →
+**J** (la surface) → **J bis** (la bathymetrie dans la surface) → **K** (la texture) → **L** (l'exagération) → **M** (les paliers) →
 **N** (le bloc continu) → **O** (le morphing) → **P1…P8** (le studio) → **Q** (le nettoyage).
 
 ⚠️ **K AVANT O** — l'étude le démontre : le morphing seul laisserait le symptôme visible intact.
 ⚠️ **J EN PREMIER** — consigne d'Adrien, et une belle rampe sur une surface vide ne vaut rien.
 ⚠️ **L AVANT P3** — le chanfrein perdu attend une exagération raisonnable.
 ⚠️ **P6 tôt si une régression visible est trouvée** — les dalles à travers la sphère sont un
 défaut d'affichage, pas une option manquante.
 
 ## §5 — Auto-revue
 
diff --git a/package.json b/package.json
index 499320f..fa3146c 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js",
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
index 4616fdc..0cdc7e7 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -65,20 +65,24 @@ import {
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
+// LE FOND DU CROP — Tâche J bis. Pur lui aussi (il n'importe que
+// `crop-sphere.js`, pur) : il ne rend que des nombres, et c'est ce fichier-ci
+// qui décide QUAND les lire. Son en-tête porte les mesures qui le fondent.
+import { altitudeMaillage, altitudeSonde, echantillonnerFond, cleFond } from './monde/fond-crop.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -304,20 +308,34 @@ void main() {
 }
 `
 
 // La circonférence équatoriale Web-Mercator, en mètres — la MÊME que celle de
 // `monde/habillage-crop.js` (`CIRCONFERENCE_M`), redite ici parce que ce
 // fichier convertit des demi-côtés de crop en unités de scène. ⚠️ Elle est
 // IMPORTÉE, pas recopiée : une constante dupliquée diverge en silence (§1 de
 // /threejs-optimisation, question 2).
 const CIRCONFERENCE_MERCATOR = CIRCONFERENCE_M
 
+// LA RÉSOLUTION DU CHAMP — celui de la mer (Tâche F) et celui du fond du crop
+// (Tâche J bis), qui est le MÊME champ lu deux fois.
+//
+// ⚠️ **384, ET CE N'EST PAS UN CHOIX DE CONFORT** : `SHORE_SURF_GLSL` porte
+// `1.0 / 384.0` EN DUR pour son pas de gradient (voir `_cuireChampMer`). Une
+// autre résolution déformerait la houle de côte sans que rien ne le signale.
+//
+// ⚠️ **ET C'EST DÉJÀ PLUS FIN QUE LA SOURCE.** 385 nœuds sur `PORTEE_CROP = 3`
+// largeurs de crop font 128 nœuds en travers du bloc, quand la bathymétrie
+// plafonne à `BATHY_BASE_ZMAX = 8` — soit, pour trois tuiles z12, **48 pixels de
+// donnée vraie** en travers. Monter plus haut ne peindrait que de
+// l'interpolation, pour quatre fois la mémoire.
+const CHAMP_FOND = 384
+
 const ROOT_Z = 2
 // ⚠️ EXPORTÉ POUR QUE LE TEST LE CONFRONTE À LA SOURCE, ET NON À UN LITTÉRAL
 // RECOPIÉ (`test/globe-profondeur.test.js`) : un chiffre recopié dans un test
 // ne rougit pas quand la source change sous lui.
 export const MAX_Z = 15
 const MAX_CONCURRENT = 6
 // ⚠️ 600, ET C'EST L'ENSEMBLE DE TRAVAIL MESURÉ QUI LE DIT (plan « globe
 // continu », Tâche 4 sexies, Étape 2 — balayage rejoué sur ce dépôt, protocole
 // A, lat 45°, 12 images jetées puis 20 relevées, stabilité exigée) :
 //
@@ -618,20 +636,37 @@ uniform sampler2D uSol;
 uniform sampler2D uSolLut;
 uniform float uSolOn;
 uniform float uSolOpacite;
 uniform vec2 uSolOffset;
 uniform vec2 uSolScale;
 uniform vec2 uSolTexel;
 uniform float uGrainForceM; // amplitude du grain, en METRES de relief
 uniform float uGrainEchelle;
 uniform float uContourWeight; // le poids de trait du socle (uContourWeight)
 
+// ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
+//
+// ⚠️ LA COULEUR AUSSI LIT LE FOND, ET SANS CA LA GEOMETRIE SEULE NE SUFFIT PAS.
+// La rampe se calcule sur h = decodeMetersAA(vUv), c'est-a-dire sur le
+// TERRARIUM, qui rend zero sur 51,1 % des echantillons du bloc (mesure). Or
+// sousEau vaut h < 0.0 : a h == 0 exactement, la rampe prend la branche TERRE
+// et sort son vert le plus bas. C'est le plateau vert uniforme de la Tache J, et
+// c'est aussi la moitie verte du marbrage.
+//
+// ⚠️ SIXIEME SAMPLER. Le bloc ci-dessus compte CINQ liens (uTex, uRamp,
+// uCoastMask, uSol, uSolLut) pour un plafond de seize : celui-ci fait six, et le
+// raisonnement de ce bloc-la tient tel quel.
+uniform sampler2D uFondChamp;  // R : altitude du fond du crop, en unites locales
+uniform float uFondOn;
+uniform float uFondPortee;     // en demi-cotes de crop — la demi-largeur du champ
+uniform float uFondMetres;     // metres par unite locale : l'inverse de l'echelle
+
 float decodeMeters(vec2 uv) {
   vec3 t = texture2D(uTex, uv).rgb * 255.0;
   return t.r * 256.0 + t.g + t.b / 256.0 - 32768.0;
 }
 // SUPERSAMPLED decode (Adrien : scintillement du monde en orbite). The height
 // texture carries no mipmaps (mip-averaging corrupts the packed metres), so a
 // single minified sample jumps frame to frame as the camera moves — the whole
 // map crawls. We DECODE five taps (each exact) across the pixel's footprint and
 // average the METRES : smooth height → smooth colour AND contours, no shimmer.
 // When the tile is not minified (fwidth tiny) the taps collapse to one, so
@@ -794,20 +829,42 @@ void main() {
 
     // ⚠️ LE discard RESTE, ET IL RESTE ICI. A estompage plein il economise tout
     // le corps du nuanceur sur les tuiles du dehors, exactement comme avant. En
     // cours de fondu il ne coupe plus rien : c'est le prix de dessiner la Terre
     // autour, et c'est le sujet meme de la tache.
     if (couvertureCrop <= 0.0) discard;
   }
 
   float h = decodeMetersAA(vUv);
 
+  // ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
+  //
+  // ⚠️ AVANT L'HABILLAGE, ET POUR LA MEME RAISON QUE LE GRAIN EST AVANT LA RAMPE
+  // (voir le bloc suivant) : ce qui change h doit passer avant tout ce qui LIT h
+  // — la rampe, les courbes de niveau, et le test sousEau qui les commande.
+  //
+  // ⚠️ C'EST LA TRANSCRIPTION DE altitudeSonde (src/monde/fond-crop.js), PAS UNE
+  // SECONDE LOI : la mer prend min(fond, 0), la terre garde la tuile. Le CPU
+  // (posAt, hauteurSurface) et le GPU lisent le meme tableau par la meme
+  // formule d'uv, et test/fond-crop.test.js confronte les deux ecritures.
+  //
+  // ⚠️ ET LA BORNE N'EST PAS DECORATIVE. Le champ ne couvre que uFondPortee
+  // demi-cotes ; au-dela, une texture en ClampToEdge prolongerait sa derniere
+  // ligne sur toute la planete estompee, sans qu'aucune erreur ne soit levee.
+  // C'est le meme garde que echantillonnerFond, ecrit deux fois parce que le
+  // GPU ne sait pas rendre null.
+  if (uFondOn > 0.5 && uCropOn > 0.5
+      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0) {
+    float hFond = texture2D(uFondChamp, qCrop / (2.0 * uFondPortee) + 0.5).r * uFondMetres;
+    h = min(hFond, 0.0);
+  }
+
   // ══════ L'HABILLAGE, POSTES ③ ET ② — Tache C ═══════════════════════════════
   //
   // ⚠️ AVANT LA RAMPE ET AVANT LES COURBES, ET CE N'EST PAS UN RANGEMENT : le
   // grain modifie h, donc la rampe ET les courbes doivent le voir. C'est ce que
   // fait le socle, qui cuit son grain dans la GEOMETRIE : sa couleur et ses
   // courbes le portent parce qu'elles lisent vWorldPos.y. Pose apres, le grain
   // ne serait qu'un bruit de teinte, et les courbes resteraient lisses.
   float landness = 1.0;
   bool sousEau = h < 0.0;
   if (uHabOn > 0.5) {
@@ -1545,21 +1602,42 @@ export class Globe {
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
+
+      // LE FOND DU CROP — Tâche J bis.
+      //
+      // ⚠️ `uFondOn: 0` : sans `poserFondCrop`, RIEN NE CHANGE — même garde et
+      // même raison que `uCropOn`, `uEstompageOn` et `uHabOn`. Partagés eux
+      // aussi : le fond est une propriété du CROP, pas de la tuile.
+      //
+      // ⚠️ **`uFondMetres` PART À 1 ET NON À 0** : c'est un DIVISEUR déguisé (le
+      // champ est cuit en unités locales, `brut × echelle`), et un zéro par
+      // défaut rendrait un fond marin plat au niveau de la mer le jour où
+      // quelqu'un allumerait `uFondOn` sans poser l'échelle.
+      uFondChamp: { value: null },
+      uFondOn: { value: 0 },
+      uFondPortee: { value: PORTEE_CROP },
+      uFondMetres: { value: 1 },
     }
+    // ⚠️ **LE FOND VIT À CÔTÉ DES UNIFORMES, PAS DEDANS** : c'est un
+    // `Float32Array` de 148 225 valeurs (593 Kio) que le CPU lit — `posAt` et
+    // `hauteurSurface` —, pas une texture. `null` = pas de fond, et toute la
+    // chaîne le sait (voir `src/monde/fond-crop.js`).
+    this._fondCrop = null
+    this._cleFondPosee = ''
     this.rebuildRamp(params)
 
     // ⚠️ `uTilePx` EST PROPRE À LA TUILE, comme `uTex` : deux tuiles voisines
     // peuvent venir de deux sources de tailles différentes (voir `planTuile`).
     // Le mettre dans `this.uniforms`, partagé, aurait fait juger la minification
     // de toutes les tuiles sur la taille de la dernière chargée.
     this._materialFor = (texture, tilePx = 256) =>
       new THREE.ShaderMaterial({
         vertexShader: VERT,
         fragmentShader: FRAG,
@@ -1668,20 +1746,24 @@ export class Globe {
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
+    // ⚠️ **APRÈS `_crop = null`, ET C'EST L'ORDRE QUI COMPTE** : `retirerFondCrop`
+    // rebâtit les maillages, et un fond encore posé les rebâtirait AVEC le fond
+    // marin — la mer resterait creusée sur un globe qui n'a plus de crop.
+    this.retirerFondCrop()
   }
 
   // ═══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3 ══════════
   //
   // ⚠️ **CETTE MÉTHODE EST LE SEUL INTERRUPTEUR**, comme `poserCrop` l'est pour
   // la découpe. Tant que personne ne l'appelle, `uEstompageOn` vaut 0 et les
   // trois nuanceurs rendent ce qu'ils rendaient avant la Tâche G, au bit près.
   //
   // ⚠️ **LA LOI N'EST PAS ICI.** Elle vit dans `src/monde/estompage-terre.js`,
   // qui la dérive des seuils du socle et ne lit qu'une ALTITUDE (règle R1). Le
@@ -2277,21 +2359,21 @@ export class Globe {
    * `1.0 / 384.0` EN DUR pour son pas de gradient. Une autre résolution
    * déformerait la houle de côte sans que rien ne le signale.
    *
    * ⚠️ **LE CHANFREIN COMPLET, PAS CELUI DU SOCLE** : `distanceRivage` par
    * défaut reproduit le demi-masque incomplet d'`ocean.js`, qui sur-estime de
    * **41,4 %** dans deux quadrants sur quatre (mesuré, `test/mer-sphere.test.js`
    * ⑤a). La calotte prend `completes: true`. Le socle garde le sien AU BIT PRÈS
    * — on élargit, on ne remplace pas.
    */
   _cuireChampMer({ repere, portee, remplir, echelle }) {
-    const N = 384
+    const N = CHAMP_FOND
     const emprise = empriseCalotte(repere, portee)
     const brut = new Float32Array((N + 1) * (N + 1))
     let couverture = 0
     let bathy = false
     if (typeof remplir === 'function') {
       const r = remplir(emprise, N, brut)
       couverture = r && Number.isFinite(r.remplis) ? r.remplis / brut.length : 1
       // ⚠️ **ON CROIT `remplir` QUAND IL RÉPOND, ET ON LE SUPPOSE SINON.**
       // `remplirHauteurs` rend désormais un `bathy` qui dit si la fusion a
       // RÉELLEMENT eu lieu (la nappe arrive de façon asynchrone) ; un `remplir`
@@ -2346,20 +2428,163 @@ export class Globe {
     tex.needsUpdate = true
     return {
       texture: tex,
       couverture,
       bathy,
       profMaxUnites: Math.max(profMaxM * echelle, 1e-6),
       profMaxM,
     }
   }
 
+  // ═══════════ LE FOND DU CROP — Tâche J bis ════════════════════════════════
+  //
+  // **Ce que ce maillon ferme, et il a été établi PAR ÉLIMINATION, pas supposé**
+  // (Tâche J, §6) : « le champ de la mer a un fond ; la SURFACE du crop n'en a
+  // pas ». Les chiffres sont dans l'en-tête de `src/monde/fond-crop.js` et leurs
+  // relevés bruts sur le disque (`.banc/vues-Jbis/Jbis-releves-bruts.json`) :
+  // **920,7 m d'écart moyen**, **2 116,27 m au maximum**, contre **73 m** de
+  // houle. Ce n'était donc pas la mer qui débordait, c'était le sol qui manquait.
+  //
+  // ⚠️ **CE MAILLON PASSE AVANT LES PAROIS ET LA RAMPE, ET C'EST STRUCTUREL.**
+  // Les deux se posent sur `hauteurSurface` : posé après elles, le fond aurait
+  // donné un bloc dont le flanc commence deux kilomètres au-dessus de sa propre
+  // surface, et une rampe calée sur 130,36 m là où il y en a 2 116,3 (les deux
+  // relevés). C'est pour ça que `MAILLONS` en compte SIX (`branchement-crop.js`).
+  //
+  // ⚠️ **ET IL CUIT SON PROPRE CHAMP, IL N'EMPRUNTE PAS CELUI DE LA MER.** La
+  // mer est le DERNIER maillon et son `poserMer` est asynchrone : lui prendre
+  // son champ obligerait à mémoïser un tableau dont la fraîcheur dépend de
+  // l'arrivée — asynchrone, elle aussi — de la nappe bathymétrique. Deux
+  // cuissons de 385² valent mieux qu'un cache dont personne ne sait dire s'il
+  // est à jour. ⚠️ **Le prix est mesuré, pas supposé** : voir le §« ce que ça
+  // coûte » du rapport de la tâche.
+
+  /**
+   * Cuit le fond du crop et le pose : la surface du globe porte le relief
+   * sous-marin sur l'emprise de la calotte.
+   *
+   * ⚠️ **`remplir` EST OBLIGATOIRE ICI, ET IL N'Y A PAS DE REPLI.** Le repli de
+   * `_cuireChampMer` (lire `hauteurSurface`) serait CIRCULAIRE : la sonde rend
+   * déjà le fond posé. Sans `remplir`, ce maillon refuse — et refuser laisse la
+   * surface du dépôt, ce qui est exactement le comportement d'avant.
+   *
+   * @param {object} arg
+   * @param {(emprise:object, n:number, sortie:Float32Array) => object} arg.remplir
+   * @param {number} [arg.portee] en demi-côtés de crop
+   * @param {number} [arg.couvertureMin] au-dessous, on refuse (0 = jamais)
+   * @param {boolean} [arg.exigerBathy] refuse tant que la nappe n'a pas fusionné
+   * @returns {{refus:string|null, couverture:number, bathy:boolean, profMaxM:number, rebati:number}}
+   */
+  poserFondCrop({ remplir = null, portee = PORTEE_CROP, couvertureMin = 0, exigerBathy = false } = {}) {
+    const vide = { refus: null, couverture: 0, bathy: false, profMaxM: 0, rebati: 0 }
+    if (!this._crop) return { ...vide, refus: 'crop' }
+    if (typeof remplir !== 'function') return { ...vide, refus: 'remplir' }
+    const p = Number.isFinite(portee) && portee > 0 ? portee : PORTEE_CROP
+    const N = CHAMP_FOND // 384, comme le champ de la mer — voir la constante
+    const cote = N + 1
+    const emprise = empriseCalotte(this._crop, p)
+    const valeurs = new Float32Array(cote * cote)
+    const r = remplir(emprise, N, valeurs)
+    const couverture = r && Number.isFinite(r.remplis) ? r.remplis / valeurs.length : 1
+    const bathy = r && typeof r.bathy === 'boolean' ? r.bathy : true
+    let profMaxM = 0
+    for (let k = 0; k < valeurs.length; k++) if (-valeurs[k] > profMaxM) profMaxM = -valeurs[k]
+    // ⚠️ **LE MÊME REFUS QUE LA MER, ET AVEC LES MÊMES SEUILS.** Poser un fond
+    // à moitié rempli creuserait des marches là où la donnée manque, et poser un
+    // fond SANS bathymétrie ne ferait que recopier le zéro du terrarium — du
+    // travail pour rien, et une reconstruction de cinquante maillages avec.
+    if (couverture < couvertureMin || (exigerBathy && !bathy)) {
+      return { refus: 'champ', couverture, bathy, profMaxM, rebati: 0 }
+    }
+    const fond = { valeurs, cote, repere: this._crop, portee: p, emprise, bathy, profMaxM }
+    const cle = cleFond(fond)
+    this._fondCrop = fond
+    this._poserTextureFond(fond)
+    // ⚠️ **ON NE REBÂTIT QUE SI LA SURFACE A CHANGÉ.** `poserFondCrop` est
+    // rappelé à chaque cran ET à chaque reprise ; reconstruire cinquante
+    // maillages pour un champ identique coûterait une planète par reprise.
+    let rebati = 0
+    if (cle !== this._cleFondPosee) {
+      this._cleFondPosee = cle
+      rebati = this._refaireMaillagesDuFond()
+    }
+    return { refus: null, couverture, bathy, profMaxM, rebati }
+  }
+
+  /** Rend au globe sa surface d'avant : la mer remonte sur la sphère. */
+  retirerFondCrop() {
+    if (!this._fondCrop) return 0
+    this._fondCrop = null
+    this._cleFondPosee = ''
+    const u = this.uniforms
+    u.uFondChamp.value?.dispose()
+    u.uFondChamp.value = null
+    u.uFondOn.value = 0
+    u.uFondMetres.value = 1
+    return this._refaireMaillagesDuFond()
+  }
+
+  /**
+   * La texture que le FRAGMENT lit — la couleur, pas la géométrie.
+   *
+   * ⚠️ **UN SEUL CANAL, ET EN UNITÉS LOCALES COMME LA MER.** `_cuireChampMer`
+   * écrit `brut × echelle` dans son canal R ; on écrit exactement la même chose,
+   * pour que `uFondMetres` (l'inverse de l'échelle) soit la seule conversion du
+   * chemin et que les deux nuanceurs lisent la même grandeur.
+   *
+   * ⚠️ **LA PRÉCISION EST MESURÉE, PAS SUPPOSÉE** : un demi-flottant vaut ici
+   * 2^-15 près de 0,218 unité (la profondeur maximale relevée × l'échelle), soit
+   * **2,8 m au sol**. La houle qui traversait le fond en faisait 73.
+   */
+  _poserTextureFond(fond) {
+    const u = this.uniforms
+    const echelle = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
+    const n = fond.cote * fond.cote
+    const demi = new Uint16Array(n)
+    for (let k = 0; k < n; k++) demi[k] = THREE.DataUtils.toHalfFloat(fond.valeurs[k] * echelle)
+    const tex = new THREE.DataTexture(demi, fond.cote, fond.cote, THREE.RedFormat, THREE.HalfFloatType)
+    tex.magFilter = THREE.LinearFilter
+    tex.minFilter = THREE.LinearFilter
+    tex.needsUpdate = true
+    u.uFondChamp.value?.dispose()
+    u.uFondChamp.value = tex
+    u.uFondOn.value = 1
+    u.uFondPortee.value = fond.portee
+    u.uFondMetres.value = 1 / echelle
+  }
+
+  /**
+   * Rebâtit les maillages dont la surface dépend du fond.
+   *
+   * ⚠️ **SEULEMENT CEUX QUI ONT ENCORE LEURS HAUTEURS, ET C'EST UNE LIMITE
+   * ASSUMÉE.** `_buildMesh` relâche `t.heights` sauf pour les clés de
+   * `gardeHauteurs` — c'est-à-dire l'emprise que le flux réserve, bloc et mer
+   * comprises (Tâche J, `aussi`). Une tuile hors réservation ne peut pas être
+   * rebâtie sur place : il faudrait la redemander au réseau, ce que
+   * `_rechargeTuiles` fait pour TOUTE la planète. Le fond ne couvre que la
+   * calotte, et la calotte est réservée : le cas ne se pose pas aujourd'hui,
+   * mais **il se posera si la portée du champ dépasse un jour la réservation**.
+   */
+  _refaireMaillagesDuFond() {
+    let n = 0
+    for (const t of this.tiles.values()) {
+      if (t.state !== 'ready' || !t.heights || !t.mesh) continue
+      this.group.remove(t.mesh)
+      t.mesh.geometry.dispose()
+      t.mesh.material.dispose()
+      t.mesh = null
+      this._buildMesh(t)
+      n++
+    }
+    return n
+  }
+
   /** Avance le temps de la mer — l'appelant décide de la cadence. */
   animerMer(dt) {
     if (!this._mer) return
     this._mer.material.uniforms.uMerTemps.value += dt
   }
 
   /** Retire la mer — le globe redevient une planète sans eau animée. */
   retirerMer() {
     // ⚠️ LA RAMPE NAUTIQUE S'ÉTEINT MÊME SANS MAILLAGE, et c'est le défaut C-3
     // de la Tâche C appliqué d'avance : là-bas `retirerHabillage` ne rendait
@@ -2428,21 +2653,28 @@ export class Globe {
       // l'intervalle où la question « suis-je dans cette tuile ? » se pose, et il
       // est juste pour tout `n` **et pour un `t.x` hors bornes**.
       const tx = (((mx * n - t.x) % n) + n) % n
       const ty = my * n - t.y
       if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue
       if (!best || t.z > best.t.z) best = { t, tx, ty }
     }
     // ⚠️ **`null`, JAMAIS `0`** : zéro est le NIVEAU DE LA MER, et le confondre
     // avec « je ne sais pas » creuse une encoche dans la paroi (§7 de
     // `parois-crop.js`). C'est l'appelant qui décide, pas cette méthode.
-    return best ? sampleHeights(best.t.heights, best.tx, best.ty, best.t.size) : null
+    // ⚠️ **ET LE FOND DU CROP PASSE PAR ICI AUSSI — Tâche J bis.** Les parois et
+    // la rampe se posent sur CETTE sonde ; si le maillage descendait au fond
+    // marin sans elles, le bloc aurait un flanc qui commence deux kilomètres
+    // au-dessus de sa propre surface. Sans fond posé, `altitudeSonde` rend la
+    // valeur BRUTE — le dépôt au bit près, négatifs du terrarium compris.
+    const brut = best ? sampleHeights(best.t.heights, best.tx, best.ty, best.t.size) : null
+    const fond = this._fondCrop ?? null
+    return altitudeSonde(brut, fond ? echantillonnerFond(fond, lat, lon) : null)
   }
 
   /** Les tuiles dont les hauteurs sont encore là, du plus fin au plus grossier. */
   tuilesAvecHauteurs() {
     const out = []
     for (const t of this.tiles.values()) if (t.heights) out.push(t)
     out.sort((a, b) => b.z - a.z)
     return out
   }
 
@@ -2473,20 +2705,33 @@ export class Globe {
       repere: this._crop,
       forme: {
         coin: this.uniforms.uCropCoin.value,
         expo: this.uniforms.uCropCoinN.value,
       },
       hauteur: (lat, lon) => this.hauteurSurface(lat, lon, liste),
       rayon: R_GLOBE,
       echelle: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration,
       profondeur,
       baseYFloor,
+      // ⚠️ **LE PLANCHER SUIT LA SURFACE — Tâche J bis, ET SANS LUI LE BLOC EST
+      // FAUX.** Le §4 de `parois-crop.js` écrit pourquoi il valait zéro : « le
+      // globe pose ses sommets à `Math.max(sampleHeights(...), 0)`, une paroi
+      // qui suivrait la bathymétrie brute passerait SOUS la surface dessinée ».
+      // C'est exactement l'inverse depuis qu'un fond est posé : c'est un
+      // plancher à zéro qui ferait passer la paroi AU-DESSUS de sa propre
+      // surface. Relevé à l'écran avant ce correctif : `baseY` identique au
+      // millionième avec et sans fond (−0,054 132 4 unité), pour une surface
+      // descendue de **2 116,3 m**. Avec, il vaut −0,147 117 — **2,718 fois plus
+      // profond**, et c'est le bloc entier qui change de silhouette.
+      // ⚠️ **ET IL EST FINI, PAS `-Infinity`** : `construireSolideCrop` s'en sert
+      // aussi de repli, et un infini y produirait des sommets `NaN`.
+      plancherMer: this._fondCrop ? -Math.max(this._fondCrop.profMaxM, 0) : 0,
     })
 
     // ⚠️ **LE REFUS NE TOUCHE PAS AUX PAROIS DÉJÀ POSÉES.** C'est ce qui le rend
     // acceptable : le bloc précédent reste à l'écran jusqu'à ce que la donnée
     // arrive, et l'appelant n'a rien à défaire.
     if (solide.refus) return { mesh: null, solide, couverture: solide.couverture, refus: solide.refus }
 
     const geo = new THREE.BufferGeometry()
     geo.setAttribute('position', new THREE.BufferAttribute(solide.positions, 3))
     // l'occlusion de contact, cuite par sommet. ⚠️ NOM PROPRE, pas `color` : le
@@ -3062,23 +3307,36 @@ export class Globe {
     const nV = (G + 1) * (G + 1)
     const positions = new Float64Array(nV * 3) // absolues, en doubles : voir ci-dessus
     const normals = new Float32Array(nV * 3)
     const uvs = new Float32Array(nV * 2)
     const latlons = new Float32Array(nV * 2)
     const dispScale = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
     const v3 = new THREE.Vector3()
 
     // every vertex is projected EXACTLY onto the sphere (+ displaced along the
     // radius) — never interpolated across a flat quad
+    // ⚠️ **LE FOND DU CROP — Tâche J bis.** Sans fond posé (`this._fondCrop`
+    // nul), `altitudeMaillage` EST `Math.max(h, 0)` : « oceans stay on the
+    // sphere », le dépôt AU BIT PRÈS, et c'est le cas de toute la planète hors
+    // crop comme de `?globe=continu` tout entier. Avec un fond, la MER prend la
+    // profondeur du CHAMP — celui-là même que la mer lit —, et le désaccord de
+    // **920,7 m en moyenne** se ferme (il retombe à 2,85 m, mesuré).
+    // ⚠️ `?.`/`??` DEVANT `_fondCrop` : `test/globe-precision.test.js` emprunte
+    // cette méthode avec un `this` qui n'est pas un globe — même raison que le
+    // `?.` de `gardeHauteurs`, en bas de cette fonction.
+    const fond = this._fondCrop ?? null
     const posAt = (u, v, out) => {
       const { lat, lon } = tileToLatLon(t.x + u, t.y + v, t.z)
-      const h = Math.max(sampleHeights(t.heights, u, v, t.size), 0) // oceans stay on the sphere
+      const h = altitudeMaillage(
+        sampleHeights(t.heights, u, v, t.size),
+        fond ? echantillonnerFond(fond, lat, lon) : null,
+      )
       return latLonToSphere(lat, lon, R_GLOBE + h * dispScale, out)
     }
 
     // L'ORIGINE DU REPÈRE : le centre de la tuile, pris SUR LA SURFACE DÉPLACÉE
     // et non sur la sphère nue. `t.center` ferait presque l'affaire, mais il
     // ignore le relief : à l'exagération 18 des vues orbitales, un sommet à
     // 8 848 m est à 2,5 unités du centre non déplacé, ce qui remonterait le pas
     // à 1,5 cm. Passer par `posAt` coûte une ligne et supprime le terme.
     const origine = posAt(0.5, 0.5, new THREE.Vector3())
 
diff --git a/src/main.js b/src/main.js
index 5ffd70c..04587cd 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4777,21 +4777,21 @@ function contexteCrop() {
   // et le plus simple est de ne pas prendre la poignée du tout.
   const cote = terrain.mapUniforms.uCoastMaskOn.value > 0.5 ? terrain.mapUniforms.uCoastMask.value : null
   const sol = terrain.mapUniforms.uSolOn.value > 0.5 ? terrain.mapUniforms.uSol.value : null
   // l'amplitude du relief du crop : elle CALE l'intervalle des courbes de niveau
   // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
   const f = terrain.fenetreBornee
   const amplitudeM = Number.isFinite(f?.maxM) && Number.isFinite(f?.minM)
     ? f.maxM - f.minM
     : (Number.isFinite(dem?.maxM) && Number.isFinite(dem?.minM) ? dem.maxM - dem.minM : null)
 
-  return {
+  const ctx = {
     centre,
     zoom,
     tuilesParBloc: BLOCK_TILES,
     habillage: {
       coastMask: cote,
       sol,
       solLut: sol ? terrain.mapUniforms.uSolLut.value : null,
       solOpacite: terrain.mapUniforms.uSolOpacite.value,
       solOffset: terrain.mapUniforms.uSolOffset.value,
       solScale: terrain.mapUniforms.uSolScale.value,
@@ -4828,20 +4828,39 @@ function contexteCrop() {
       // UNE PRÉCAUTION.** Le 2026-08-21 sur l'application qui tourne :
       // `params.fov = 33`, `camera.fov = 33`, `camGlobe.fov = 33`, alors que le
       // défaut du code est 30 et que `FOV_DEG` vaut 30. L'écart vient des
       // TEMPLATES — `templates-user.js` sauvegarde `'fov'`, et un template
       // appliqué au démarrage repose `params.fov`. « 33 n'existe nulle part dans
       // le dépôt » était vrai de la SOURCE et faux de l'application.
       fovDeg: camGlobe?.fov ?? camera.fov,
       hauteurPx: renderer.domElement?.clientHeight || undefined,
     },
   }
+
+  // ══════════ LE FOND DU CROP — Tâche J bis ═══════════════════════════════════
+  //
+  // ⚠️ **IL LIT LE MÊME CHAMP QUE LA MER, ET IL LE LIT PAR LES MÊMES ARGUMENTS.**
+  // Ce n'est pas une économie de frappe : la Tâche J a fermé le désaccord entre
+  // la mer et le fond du crop, et deux jeux d'arguments qui divergeraient — une
+  // portée ici, une autre là — le rouvriraient exactement. On DÉRIVE donc de
+  // `ctx.mer` au lieu de recopier, et une mutation qui les désaccorde rougit.
+  //
+  // ⚠️ **PAS DE `fovDeg` NI D'`altitudeM` ICI** : le fond ne décide d'aucune
+  // bascule, il ne fait que cuire un champ sur une emprise. Les lui passer
+  // laisserait croire qu'il en dépend.
+  ctx.fond = {
+    remplir: ctx.mer.remplir,
+    portee: ctx.mer.portee,
+    couvertureMin: ctx.mer.couvertureMin,
+    exigerBathy: ctx.mer.exigerBathy,
+  }
+  return ctx
 }
 
 // ⚠️ **`globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR.** Il est assigné
 // plus haut dans ce fichier mais réassigné à la perte de contexte WebGL ; une
 // référence figée survivrait à la réassignation et poserait le crop sur un globe
 // mort, sans une erreur.
 //
 // ⚠️ **`masquerSocle` EST CE QUI FAIT QU'IL N'Y A PLUS QU'UNE TERRE — ET SANS
 // LUI IL Y EN AVAIT ENCORE DEUX, RELEVÉ À L'ÉCRAN.** Première image du drapeau
 // levé, La Réunion z12 : `uCropOn = 1`, `uHabOn = 1`, la mer posée… et
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index e4f53a6..a5a8ac9 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -72,31 +72,71 @@
 //     (`modes.busy`, la largeur du bloc désaccordée d'une image) vit dans
 //     `main.js`, à côté de celle du seuil du socle, parce que c'est là que ces
 //     grandeurs existent ;
 //   · **il n'anime pas la mer** — `animerMer(dt)` est une cadence, donc une
 //     affaire de boucle d'image.
 
 import { socleVisible } from './seuil-socle.js'
 
 /**
  * Les maillons de la chaîne, dans l'ordre où ils doivent être posés.
- * ⚠️ `crop` en tête : les quatre autres refusent sans lui (voir le §2).
+ * ⚠️ `crop` en tête : les cinq autres refusent sans lui (voir le §2).
+ *
+ * ⚠️ **`fond` EST EN DEUXIÈME, ET CE N'EST PAS UN RANGEMENT — Tâche J bis.** Il
+ * donne au globe le relief SOUS-MARIN du crop, et les deux maillons qui le
+ * suivent le LISENT : `parois` pose la base du bloc sous le point le plus bas de
+ * la surface (le « basin guard » de `parois-crop.js`), `rampe` cale ses couleurs
+ * sur la profondeur mesurée. Posé après eux, le fond aurait donné un bloc dont
+ * le flanc commence deux kilomètres au-dessus de sa propre surface et une rampe
+ * calée sur 130,36 m là où il y en a 2 116,3 (les deux chiffres sont relevés dans
+ * l'application vivante — `.banc/vues-Jbis/Jbis-releves-bruts.json`).
  */
-export const MAILLONS = Object.freeze(['crop', 'parois', 'habillage', 'rampe', 'mer'])
+export const MAILLONS = Object.freeze(['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
+
+/**
+ * Les maillons qui LISENT le fond, dans l'ordre de `MAILLONS`.
+ *
+ * ⚠️ **SANS CETTE LISTE, LA REPRISE LAISSE UN BLOC INCOHÉRENT, ET ÇA A ÉTÉ VU À
+ * L'ÉCRAN.** La nappe bathymétrique est ASYNCHRONE : au premier passage le fond
+ * REFUSE (couverture ou bathymétrie absente) pendant que `parois` et `rampe`,
+ * eux, PRENNENT — sur une surface encore plate. `reprendre` ne rejoue que ce qui
+ * a refusé : quand le fond finit par prendre, la rampe garde sa profondeur d'une
+ * surface qui n'existe plus. Relevé dans l'application, La Réunion z12 :
+ * `uOceanDepth = 130,36 m` avec un fond de **2 116,3 m** sous les pieds.
+ *
+ * ⚠️ **ET L'HABILLAGE N'EN EST PAS**, ce n'est pas un oubli : il recopie quatre
+ * postes du socle et ne mesure aucune hauteur. La mer non plus — elle cuit son
+ * propre champ.
+ */
+export const LECTEURS_DU_FOND = Object.freeze(['parois', 'rampe'])
 
 // Un maillon rend `{ refus }` — `null` s'il a pris, une chaîne sinon — et,
 // pour la mer seule, une `promesse` dont le refus n'arrive que plus tard.
 const POSEURS = {
   crop({ globe, centre, zoom, tuilesParBloc }) {
     const rep = globe.poserCrop({ centre, zoom, tuilesParBloc })
     return { refus: rep ? null : 'crop' }
   },
+  fond({ globe, fond }) {
+    // ⚠️ **UN GLOBE SANS `poserFondCrop` N'EST PAS UNE PANNE.** Ce module est
+    // vérifiable sous node contre un globe de papier (`test/crop-branche.test.js`), et
+    // il a toujours accepté les faux globes qui portent les méthodes qu'ils
+    // exercent. Un fond absent laisse la surface du dépôt — c'est exactement le
+    // comportement d'avant la Tâche J bis, et il ne se signale pas par un refus
+    // qui bloquerait la reprise pour toujours.
+    if (typeof globe.poserFondCrop !== 'function') return { refus: null }
+    const r = globe.poserFondCrop(fond || {})
+    // ⚠️ **`neuf` DIT QUE LA SURFACE A CHANGÉ, ET LA REPRISE EN A BESOIN** — voir
+    // `LECTEURS_DU_FOND`. `rebati` compte les maillages reconstruits : zéro veut
+    // dire « le même fond qu'avant », donc rien à rejouer derrière.
+    return { refus: r ? (r.refus ?? null) : 'crop', neuf: !!(r && r.rebati > 0) }
+  },
   parois({ globe, parois }) {
     const r = globe.construireParoisCrop(parois || undefined)
     // ⚠️ `null` SIGNIFIE « PAS DE CROP », et c'est un refus comme un autre —
     // `construireParoisCrop` sort à sa première ligne quand `_crop` est nul.
     return { refus: r ? (r.refus ?? null) : 'crop' }
   },
   habillage({ globe, habillage }) {
     globe.poserHabillage(habillage || {})
     // ⚠️ **L'HABILLAGE NE REFUSE JAMAIS**, et ce n'est pas un oubli : il ne
     // mesure rien, il recopie quatre postes du socle. Ce qui manque (une texture
@@ -259,25 +299,38 @@ export function creerVeilleCrop({
     reserverHauteurs?.(ctx)
     // ⚠️ **IL Y AVAIT ICI UNE GARDE `if (nom === 'crop') continue`, ET C'ÉTAIT DU
     // CODE MORT — TROUVÉ PAR LA CAMPAGNE DE MUTATION, PAS PAR LA RELECTURE.** La
     // muter ne faisait rougir aucun test, et pour cause : `refus` ne peut PAS
     // contenir `'crop'`. `poserCrop` rend toujours son repère, et les trois
     // maillons qui refusent faute de découpe sont poussés sous LEUR nom, pas sous
     // le sien. Une garde qu'aucun chemin n'atteint est une garde qui ment sur ce
     // qu'elle protège ; retirée plutôt que testée à vide. **Si la découpe venait
     // un jour à refuser, la rejouer serait de toute façon le bon geste.**
     const restant = []
+    // ⚠️ **LE FOND ENTRAÎNE SES LECTEURS — Tâche J bis, voir `LECTEURS_DU_FOND`.**
+    let fondNeuf = false
     for (const nom of refus) {
       const r = POSEURS[nom]({ globe: g, ...ctx })
+      if (nom === 'fond' && !r.refus && r.neuf) fondNeuf = true
       if (nom === 'mer') { const j = ++jeton; suivreMer(r.promesse, j); continue }
       if (r.refus) restant.push(nom)
     }
+    if (fondNeuf) {
+      for (const nom of LECTEURS_DU_FOND) {
+        // ⚠️ **CELUI QUI VIENT D'ÊTRE REJOUÉ NE L'EST PAS DEUX FOIS** : le
+        // balayage de la rampe fait `pas²` points et le contour des parois plus
+        // de mille — les rejouer pour rien serait payer deux fois la reprise.
+        if (refus.includes(nom)) continue
+        const r = POSEURS[nom]({ globe: g, ...ctx })
+        if (r.refus) restant.push(nom)
+      }
+    }
     refus = restant
   }
 
   function retirer(g) {
     jeton++
     g?.retirerCrop()
     pose = false
     signature = null
     refus = []
     bascules++
diff --git a/src/monde/fond-crop.js b/src/monde/fond-crop.js
new file mode 100644
index 0000000..6d666e2
--- /dev/null
+++ b/src/monde/fond-crop.js
@@ -0,0 +1,196 @@
+// LE FOND DU CROP — Tâche J bis du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// Module PUR : ni DOM, ni three.js, ni état. Testable sous node
+// (`test/fond-crop.test.js`).
+//
+// ══════════ POURQUOI CE MODULE EXISTE ══════════════════════════════════════
+//
+// La Tâche J a établi PAR ÉLIMINATION — mer cachée, puis houle éteinte, puis
+// rallumée — que ce qu'on lit à l'écran au-dessus de ~20 km n'est pas un défaut
+// de la MER mais un DÉSACCORD :
+//
+//   **le champ de la mer a un fond ; la surface du crop n'en a pas.**
+//
+// Les deux moitiés du désaccord sont mesurées, dans l'application vivante, sur
+// l'emprise du crop lui-même (La Réunion, z12, `.banc/vues-Jbis/Jbis-releves-bruts.json`) :
+//
+//   · le CHAMP (`remplirHauteurs` + `fuseBathymetry`) descend à **−2 116,3 m**,
+//     et **32,54 %** de ses 148 225 nœuds sont sous le niveau de la mer ;
+//   · la SURFACE, elle, est à **zéro exact sur 90,4 %** des 3 105 sondes en eau
+//     (profondeur moyenne : **0,22 m**), parce que `_buildMesh` écrête
+//     (`Math.max(h, 0)`, « oceans stay on the sphere ») ;
+//   · l'écart MOYEN vaut donc **920,7 m**, le maximum **2 116,27 m**, quand la
+//     houle que la Tâche J accusait ne fait que **73 m**. Le désaccord est
+//     **12,6 fois** l'amplitude de la houle — deux grandeurs en MÈTRES, la même
+//     monnaie des deux côtés.
+//
+// ⚠️ **ET LES TUILES NE PORTENT PAS CE FOND** : relevées dans l'application, les
+// **9 tuiles z12 du bloc** (2 359 296 échantillons) descendent à **−288,36 m**
+// au plus bas — **2,95 %** de négatifs, **29,5 %** de zéros EXACTS —, soit
+// **13,6 % de la profondeur** que la bathymétrie fusionnée donne SUR LA MÊME
+// EMPRISE (288,36 / 2 116,3). ⚠️ **Le dénominateur est l'emprise du CROP, pas
+// celle de la calotte** : sur la calotte le champ descend à 3 510,5 m, et
+// rapporter 288 m à celle-là aurait donné 8,2 %, un autre chiffre pour une autre
+// question. Le terrarium sert la frange côtière, pas le fond marin. C'est la
+// réponse mesurée à la question de la tâche (« les tuiles terrarium portent-elles
+// des valeurs négatives exploitables ? ») : **quelques-unes, et loin de suffire**.
+//
+// ══════════ LA SORTIE RETENUE, ET POURQUOI ELLE NE COÛTE RIEN ══════════════
+//
+// ⚠️ **ON NE REFUSIONNE RIEN, ON LIT LE CHAMP QUI EXISTE DÉJÀ.** `poserMer` cuit
+// un champ de 385² sur l'emprise de la calotte, et ce champ EST le résultat de
+// `fuseBathymetry` sur l'emprise entière (Tâche J). Fabriquer une seconde
+// fusion « pour les tuiles » aurait donné deux lois à faire coïncider — le §1 de
+// `/threejs-optimisation`, et le §4 de `flux-terrain.js` explique déjà pourquoi
+// une fusion par TUILE serait fausse (les aplats de remplissage se constatent
+// sur l'emprise entière, jamais sur un neuvième d'histogramme).
+//
+// ⚠️ **ET LE CHAMP EST PLUS FIN QUE LA SOURCE.** 385 nœuds sur `portee = 3`
+// largeurs de crop font **128 nœuds en travers du bloc**, quand la bathymétrie
+// plafonne à `BATHY_BASE_ZMAX = 8` (`bathy-sources.js`) — soit, pour un crop de
+// 3 tuiles z12, `3 × 256 / 2^(12−8)` = **48 pixels de donnée vraie** en travers.
+// Cuire un champ « à la résolution des tuiles » n'aurait peint que de
+// l'interpolation, pour 4 fois la mémoire.
+//
+// ══════════ DEUX LOIS, ET ELLES DIFFÈRENT PARCE QUE LE DÉPÔT DIFFÈRE ═══════
+//
+// ⚠️ **`altitudeMaillage` ET `altitudeSonde` NE SE CONFONDENT PAS.** Sans fond,
+// `_buildMesh` écrête à zéro (`Math.max(h, 0)`) tandis que `hauteurSurface` rend
+// la valeur BRUTE, négatifs compris — c'est l'état du dépôt, et les parois
+// suivent aujourd'hui la frange à −288 m pendant que la surface reste à zéro.
+// Une loi unique aurait donc changé le comportement de l'un des deux côtés sans
+// fond posé, et **le défaut par défaut doit reproduire le dépôt au bit près**
+// (le patron de `distanceRivage`, Tâche F, et d'`aussi`, Tâche J).
+// ➡️ **AVEC un fond, les deux rendent la MÊME valeur** : c'est exactement le
+// désaccord qu'on est venu fermer.
+
+import { localCrop } from './crop-sphere.js'
+
+/**
+ * L'altitude que `_buildMesh` pose sur la surface du globe, en mètres.
+ *
+ * ⚠️ **SANS FOND, C'EST `Math.max(h, 0)` — LE DÉPÔT AU BIT PRÈS.** Le
+ * commentaire d'origine de `posAt` (« oceans stay on the sphere ») reste vrai
+ * partout où aucun fond n'est posé, c'est-à-dire sur toute la planète hors crop
+ * et dans `?globe=continu` tout entier.
+ *
+ * @param {number} hTuile la hauteur lue dans la tuile, en mètres
+ * @param {number|null} hFond le fond du champ au même point, en mètres
+ * @returns {number}
+ */
+export function altitudeMaillage(hTuile, hFond) {
+  const h = Number.isFinite(hTuile) ? hTuile : 0
+  if (!Number.isFinite(hFond)) return Math.max(h, 0)
+  // ⚠️ LA TERRE GARDE LA TUILE, ET CE N'EST PAS UN DÉTAIL : le champ fait 385
+  // nœuds sur trois largeurs de crop, la tuile 256 pixels sur une seule. Prendre
+  // le champ au-dessus de zéro rendrait le relief SIX FOIS plus grossier — on ne
+  // corrige que ce qui est faux, la mer.
+  if (h > 0) return h
+  // ⚠️ `min(hFond, 0)` ET NON `hFond` : là où la tuile dit « mer » et le champ
+  // dit « terre » (un nœud de champ tombé sur la côte voisine), on ne fait pas
+  // sortir une butte de l'eau — on reste au niveau de la mer, c'est-à-dire au
+  // comportement du dépôt.
+  return Math.min(hFond, 0)
+}
+
+/**
+ * L'altitude que `globe.hauteurSurface` rend — parois, rampe, champ de repli.
+ *
+ * ⚠️ **`null` TRAVERSE, ET C'EST LE §7 DE `parois-crop.js`** : « `null`, jamais
+ * `0` — zéro est le NIVEAU DE LA MER, et le confondre avec je ne sais pas creuse
+ * une encoche dans la paroi ». Un fond posé ne rend pas la couverture meilleure.
+ *
+ * @param {number|null} hTuile
+ * @param {number|null} hFond
+ * @returns {number|null}
+ */
+export function altitudeSonde(hTuile, hFond) {
+  if (hTuile == null || !Number.isFinite(hTuile)) return null
+  if (!Number.isFinite(hFond)) return hTuile // le dépôt : la valeur brute, négatifs compris
+  if (hTuile > 0) return hTuile
+  return Math.min(hFond, 0)
+}
+
+/**
+ * Les coordonnées de lecture du champ, pour un point LOCAL du crop.
+ *
+ * ⚠️ **C'EST LA FORMULE DU NUANCEUR DE LA MER, MOT POUR MOT** : `MER_VERT` lit
+ * `uvF = aCrop / (2.0 * uMerPortee) + 0.5`, où `aCrop` est en demi-côtés de crop
+ * comme `localCrop`. Une seconde convention ici, et le fond du CROP et le fond
+ * de la MER se liraient à deux endroits différents du même tableau — le
+ * désaccord reviendrait par la porte de derrière.
+ *
+ * ⚠️ **AUCUN RETOURNEMENT EN Y.** Le champ est écrit ligne-major depuis le coin
+ * NORD-OUEST (`remplirHauteurs`), la `DataTexture` a `flipY` à faux, et `v`
+ * croît vers le SUD (`crop-sphere.js`, « le mercator y croît vers le SUD »). Les
+ * trois conventions coïncident ; en retourner une seule mettrait le fond marin
+ * en miroir nord-sud, et c'est le genre de défaut qui ne se voit qu'à côté d'une
+ * côte connue.
+ *
+ * @param {{u:number, v:number}} q coordonnées locales du crop (±1 = sa frontière)
+ * @param {number} portee en demi-côtés de crop — la demi-largeur du champ
+ * @returns {{u:number, v:number}} dans [0, 1] quand le point est dans le champ
+ */
+export function uvFond(q, portee) {
+  const p = 2 * portee
+  return { u: q.u / p + 0.5, v: q.v / p + 0.5 }
+}
+
+/**
+ * Le fond, en mètres, au point (lat, lon) — `null` hors du champ.
+ *
+ * Interpolation BILINÉAIRE, comme `sampleHeights` et comme `remplirHauteurs` :
+ * s'accrocher au nœud le plus proche rendrait un fond marin en marches, et la
+ * Tâche B a déjà mesuré ce défaut-là sur les parois (plus de 20 m de liseré).
+ *
+ * @param {{valeurs:Float32Array, cote:number, repere:object, portee:number}|null} fond
+ * @param {number} lat
+ * @param {number} lon
+ * @returns {number|null}
+ */
+export function echantillonnerFond(fond, lat, lon) {
+  if (!fond || !fond.valeurs || !(fond.cote > 1) || !(fond.portee > 0)) return null
+  const q = localCrop(lat, lon, fond.repere)
+  // ⚠️ **LA BORNE EST STRICTE, ET SANS ELLE LE CHAMP DÉBORDE.** Une texture en
+  // `ClampToEdge` — et un `Math.min` sur les indices — prolongent la dernière
+  // ligne jusqu'à l'infini : le fond marin du bord de calotte se répandrait sur
+  // toute la planète estompée, sans qu'aucune erreur ne soit levée.
+  if (!(Math.abs(q.u) <= fond.portee) || !(Math.abs(q.v) <= fond.portee)) return null
+  const { u, v } = uvFond(q, fond.portee)
+  const n = fond.cote - 1
+  const fx = Math.min(Math.max(u * n, 0), n)
+  const fy = Math.min(Math.max(v * n, 0), n)
+  const i0 = Math.min(Math.floor(fx), n - 1)
+  const j0 = Math.min(Math.floor(fy), n - 1)
+  const tx = fx - i0
+  const ty = fy - j0
+  const c = fond.cote
+  const a = fond.valeurs[j0 * c + i0]
+  const b = fond.valeurs[j0 * c + i0 + 1]
+  const d = fond.valeurs[(j0 + 1) * c + i0]
+  const e = fond.valeurs[(j0 + 1) * c + i0 + 1]
+  const haut = a + (b - a) * tx
+  const bas = d + (e - d) * tx
+  const h = haut + (bas - haut) * ty
+  return Number.isFinite(h) ? h : null
+}
+
+/**
+ * La clé d'identité d'un fond : deux fonds de même clé posent la même surface.
+ *
+ * ⚠️ **ELLE PORTE LA BATHYMÉTRIE ET LA PROFONDEUR MAXIMALE, PAS SEULEMENT
+ * L'EMPRISE.** La nappe bathymétrique arrive de façon ASYNCHRONE (Tâche J) : un
+ * champ cuit avant elle et un champ cuit après ont exactement la même emprise et
+ * un contenu qui diffère de deux kilomètres. Une clé sur la seule emprise
+ * laisserait donc la surface plate pour toujours, en se croyant à jour — c'est
+ * la classe d'erreur que `revisionFlux` a déjà corrigée une fois.
+ *
+ * @param {{repere:object, portee:number, bathy:boolean, profMaxM:number}} fond
+ * @returns {string}
+ */
+export function cleFond(fond) {
+  if (!fond) return ''
+  const r = fond.repere || {}
+  return [r.cx, r.cy, r.demi, fond.portee, fond.bathy ? 1 : 0, Math.round(fond.profMaxM || 0)].join('|')
+}
diff --git a/src/monde/parois-crop.js b/src/monde/parois-crop.js
index 87a04b4..c8b1458 100644
--- a/src/monde/parois-crop.js
+++ b/src/monde/parois-crop.js
@@ -88,20 +88,28 @@
 // proche d'une tuile z13 à 512 px déplace le sommet de **29,96 m au pire** —
 // quatre texels et demi de socle, et le liseré est là.
 //
 // ⚠️ **ET LE PLANCHER DE MER EST CELUI DU GLOBE, PAS UN CHOIX D'ICI.**
 // `globe.js` (`_buildMesh`, `posAt`) pose ses sommets à
 // `Math.max(sampleHeights(...), 0)` — « oceans stay on the sphere ». Une paroi
 // qui suivrait la bathymétrie brute passerait SOUS la surface dessinée : encore
 // un liseré, et celui-là ferait le tour de chaque côte. `plancherMer` porte donc
 // la valeur 0 par défaut, et le test la verrouille.
 //
+// ⚠️ **ET DEPUIS LA TÂCHE J bis, LA PHRASE CI-DESSUS N'EST VRAIE QUE DU DÉFAUT.**
+// Le globe pose désormais un FOND sur le crop (`src/monde/fond-crop.js`) : sa
+// surface descend à −2 116,3 m à La Réunion, et c'est alors un plancher à zéro
+// qui ferait passer la paroi AU-DESSUS de sa propre surface. `globe.js` descend
+// donc `plancherMer` à la profondeur du champ quand un fond est posé, et le
+// laisse à zéro sinon. **Le raisonnement du dessus n'a pas changé : la paroi
+// suit la surface DESSINÉE. C'est la surface dessinée qui a changé.**
+//
 // ══════════ 5. CE QU'ON A PORTÉ DE `buildSlabWalls`, ET CE QUI SE PERD ══════
 //
 // `buildSlabWalls` (`plinth.js:232`) offre **douze options**. L'Étape 4 de la
 // tâche demande de dire, pour chacune, ce qui passe et ce qui se perd.
 //
 // **PORTÉES — sept :**
 //   ① `depth` → `profondeur`. ⚠️ **EN FRACTION DE LA LARGEUR, PAS EN UNITÉS.**
 //      Le socle fait 7 unités de profondeur pour 56 de large ; recopier « 7 »
 //      dans un crop qui fait 0,163 unité de large aurait donné un puits de
 //      quarante fois sa largeur. `FRACTION_PROFONDEUR = 7 / 56` porte la
@@ -422,25 +430,34 @@ export function construireSolideCrop({
   const lire = (lat, lon) => {
     const h = hauteur(lat, lon)
     if (h == null || !Number.isFinite(h)) { manquants++; return null }
     vus++
     return Math.max(h, plancherMer) // le plancher du globe, §4
   }
 
   /**
    * Un point de la surface DÉPLACÉE, en coordonnées locales (doubles).
    * Rend `null` si la hauteur manque ET que l'appelant tolère les trous ; sinon
-   * le point se pose au plancher de mer et le compteur s'en souvient.
+   * le point se pose au NIVEAU DE LA MER et le compteur s'en souvient.
+   *
+   * ⚠️ **LE REPLI D'UN POINT INCONNU EST ZÉRO, PAS `plancherMer` — ET DEPUIS LA
+   * TÂCHE J bis CE N'EST PLUS LA MÊME CHOSE.** `plancherMer` valait 0 tant que
+   * le globe écrêtait sa mer sur la sphère : les deux écritures rendaient donc
+   * le même nombre, au bit près. Maintenant que le crop porte son fond marin,
+   * l'appelant descend `plancherMer` à la profondeur du champ (−2 116,3 m relevés
+   * à La Réunion) — et poser là un point INCONNU l'enverrait au fond de la
+   * fosse. `couvertureMin = 1` refuse avant que ça n'atteigne la géométrie, mais
+   * un repli qui ne tient que par la garde du dessus n'est pas un repli.
    */
   const surface = (u, v) => {
     const { lat, lon } = latLonDeLocal(u, v, repere)
-    const h = lire(lat, lon) ?? plancherMer
+    const h = lire(lat, lon) ?? 0
     const P = surSphere(lat, lon, rayon + h * echelle)
     const d = [P[0] - O[0], P[1] - O[1], P[2] - O[2]]
     return [
       d[0] * est[0] + d[1] * est[1] + d[2] * est[2],
       d[0] * haut[0] + d[1] * haut[1] + d[2] * haut[2],
       d[0] * sud[0] + d[1] * sud[1] + d[2] * sud[2],
     ]
   }
 
   // ─── ② L'ANNEAU HAUT, ET LES EXTRÊMES ────────────────────────────────────
diff --git a/test/crop-branche.test.js b/test/crop-branche.test.js
index 4acd4bb..8fe8bd3 100644
--- a/test/crop-branche.test.js
+++ b/test/crop-branche.test.js
@@ -39,34 +39,44 @@ import { fileURLToPath } from 'node:url'
 import { creerVeilleCrop, poserChaineCrop, MAILLONS } from '../src/monde/branchement-crop.js'
 import { SEUIL_NAISSANCE_M, SEUIL_MORT_M } from '../src/monde/seuil-socle.js'
 
 const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
 const SRC_MAIN = fs.readFileSync(path.join(RACINE, 'src/main.js'), 'utf8')
 const SRC_FLAGS = fs.readFileSync(path.join(RACINE, 'src/flags.js'), 'utf8')
 
 // ══════════ LE GLOBE FACTICE — IL REFUSE, IL NE FAIT PAS SEMBLANT ═══════════
 //
 // Il porte exactement ce que la chaîne lit et écrit, et **il se comporte comme
-// le vrai sur le seul point qui compte pour l'ordre** : les quatre maillons qui
+// le vrai sur le seul point qui compte pour l'ordre** : les cinq maillons qui
 // suivent la découpe rendent `null` ou un refus tant que `_crop` est nul, comme
-// `construireParoisCrop`, `poserRampe` et `poserMer` le font en tête de corps.
+// `poserFondCrop`, `construireParoisCrop`, `poserRampe` et `poserMer` le font en
+// tête de corps.
 function globeFactice({ refuse = {} } = {}) {
   const j = []
   const g = {
     _crop: null,
     journal: j,
-    refuse: { parois: false, rampe: false, mer: false, ...refuse },
+    refuse: { fond: false, parois: false, rampe: false, mer: false, ...refuse },
     poserCrop(a) {
       j.push({ quoi: 'crop', centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
       g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }
       return g._crop
     },
+    // LE FOND DU CROP — Tâche J bis. ⚠️ **IL REFUSE SANS CROP, comme le vrai** :
+    // `poserFondCrop` sort à sa première ligne quand `_crop` est nul.
+    poserFondCrop(a) {
+      j.push({ quoi: 'fond', arg: a })
+      if (!g._crop) return { refus: 'crop', couverture: 0, bathy: false }
+      return g.refuse.fond
+        ? { refus: 'champ', couverture: 0.3, bathy: false }
+        : { refus: null, couverture: 1, bathy: true, profMaxM: 2116.3, rebati: 50 }
+    },
     construireParoisCrop(a) {
       j.push({ quoi: 'parois', arg: a })
       if (!g._crop) return null
       return g.refuse.parois ? { mesh: null, refus: 'couverture' } : { mesh: {}, refus: null, couverture: 1 }
     },
     poserHabillage(a) {
       j.push({ quoi: 'habillage', arg: a, avecCrop: !!g._crop })
       return a
     },
     poserRampe(a) {
@@ -89,68 +99,73 @@ function globeFactice({ refuse = {} } = {}) {
 
 const quoi = (g) => g.journal.map((e) => e.quoi)
 
 // Un contexte de branchement minimal — celui que `main.js` fabrique.
 function contexteFactice(centre = { lat: 45.9, lon: 6.87 }, zoom = 12) {
   return () => ({
     centre,
     zoom,
     tuilesParBloc: 3,
     habillage: { coastMask: 'masque', amplitudeM: 2400 },
+    fond: { portee: 3, couvertureMin: 0.99 },
     mer: { altitudeM: 12_000, fovDeg: 33, hauteurPx: 900 },
   })
 }
 
 // Un mouchard d'estompage : il note ce que la veille du crop lui relaie.
 function estompageFactice() {
   const alt = []
   const modes = []
   return { alt, modes, maj: (a) => alt.push(a), poserMode: (v) => modes.push(v) }
 }
 
 // ══════════ ① LA CHAÎNE ENTIÈRE, APPELÉE — ET DANS UN ORDRE QUI TIENT ═══════
 
-test('① `poserChaineCrop` appelle les CINQ maillons, la découpe en premier', async () => {
+test('① `poserChaineCrop` appelle les SIX maillons, la découpe en premier', async () => {
   const g = globeFactice()
   const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
-  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'],
-    'les cinq maillons doivent être appelés, et la découpe AVANT les quatre autres')
+  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'],
+    'les six maillons doivent être appelés, et la découpe AVANT les cinq autres')
   // ⚠️ et le comportement le prouve : aucun des quatre suivants n'a refusé
   assert.deepEqual(r.refus, [], 'un maillon appelé avant la découpe aurait refusé')
-  assert.ok(g.journal[2].avecCrop, 'l’habillage doit trouver le crop posé — il en tire `uMargeCoteM`')
+  assert.ok(g.journal[3].avecCrop, 'l’habillage doit trouver le crop posé — il en tire `uMargeCoteM`')
   await r.mer
 })
 
 test('① bis la liste des maillons est celle que le globe expose', () => {
-  assert.deepEqual(MAILLONS, ['crop', 'parois', 'habillage', 'rampe', 'mer'])
+  assert.deepEqual(MAILLONS, ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
 })
 
 test('① ter les bornes du crop sont CELLES DU CONTEXTE, pas des constantes locales', () => {
   // ⚠️ **C'EST LE POINT QUI FAIT COÏNCIDER LE CROP ET LE BLOC.** Si la chaîne
   // posait son propre centre ou son propre zoom, la découpe tomberait à côté du
   // bloc que la similitude de la passe de fond aligne — et ce serait invisible
   // partout sauf à l'écran.
   const g = globeFactice()
   poserChaineCrop({ globe: g, centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3 })
   assert.deepEqual(g.journal[0], {
     quoi: 'crop', centre: { lat: -21.1, lon: 55.5 }, zoom: 13.25, tuilesParBloc: 3,
   })
 })
 
 test('① quater ce que chaque maillon reçoit vient du contexte, pas d’un défaut', () => {
   const g = globeFactice()
   const ctx = contexteFactice()()
   poserChaineCrop({ globe: g, ...ctx })
-  assert.equal(g.journal[2].arg.coastMask, 'masque', 'l’habillage doit recevoir le masque de côte du socle')
-  assert.equal(g.journal[2].arg.amplitudeM, 2400)
-  assert.equal(g.journal[4].arg.fovDeg, 33, 'la mer doit recevoir le fov VIVANT, pas le défaut du module')
-  assert.equal(g.journal[4].arg.altitudeM, 12_000)
+  assert.equal(g.journal[3].arg.coastMask, 'masque', 'l’habillage doit recevoir le masque de côte du socle')
+  assert.equal(g.journal[3].arg.amplitudeM, 2400)
+  assert.equal(g.journal[5].arg.fovDeg, 33, 'la mer doit recevoir le fov VIVANT, pas le défaut du module')
+  assert.equal(g.journal[5].arg.altitudeM, 12_000)
+  // ⚠️ **LE FOND ET LA MER DOIVENT LIRE LA MÊME PORTÉE — Tâche J bis.** Deux
+  // portées qui divergent rouvriraient exactement le désaccord que cette tâche
+  // ferme : la mer s'arrêterait où le fond ne va pas, ou l'inverse.
+  assert.equal(g.journal[1].arg.portee, 3, 'le fond doit recevoir la portée du contexte')
 })
 
 test('① quinquies un refus est RENDU, jamais avalé', () => {
   const g = globeFactice({ refuse: { parois: true, rampe: true } })
   const r = poserChaineCrop({ globe: g, ...contexteFactice()() })
   assert.deepEqual(r.refus.sort(), ['parois', 'rampe'])
 })
 
 test('① sexies `poserChaineCrop` EXIGE un globe — une chaîne muette est une chaîne absente', () => {
   // ⚠️ **C'EST LE MESSAGE QUI EST GARDÉ, ET C'EST DÉLIBÉRÉ.** Sans la garde, la
@@ -180,25 +195,25 @@ test('② de l’orbite au sol : rien au-dessus du seuil, la chaîne entière en
   }
   const g = globeFactice()
   const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
 
   for (const z of [4, 5, 6, 7, 8, 9, 10]) {
     assert.equal(veille.maj(ALT_ARRIVEE_M[z]), false, `pas de crop à z${z}`)
   }
   assert.deepEqual(quoi(g), [], 'de z4 à z10 on regarde la planète : rien ne doit être posé')
 
   assert.equal(veille.maj(ALT_ARRIVEE_M[11]), true, 'le crop doit naître à z11')
-  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'])
+  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
 
   // et il ne se repose pas à chaque palier plus fin
   for (const z of [12, 13, 14, 15]) assert.equal(veille.maj(ALT_ARRIVEE_M[z]), true)
-  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'],
+  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'],
     'la chaîne ne doit pas être rejouée tant que le lieu ne bouge pas')
   assert.equal(veille.bascules, 1)
   await veille.enVol()
 })
 
 test('② bis la remontée retire le crop, et à L’AUTRE seuil — l’hystérésis', async () => {
   const g = globeFactice()
   const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
   veille.maj(2_000)
   assert.equal(veille.pose, true)
@@ -224,21 +239,21 @@ test('② ter cent oscillations au seuil ne posent la chaîne qu’UNE fois', as
   assert.equal(veille.bascules, 1)
   assert.equal(g.journal.filter((e) => e.quoi === 'crop').length, 1)
   assert.equal(g.journal.filter((e) => e.quoi === 'mer').length, 1)
   await veille.enVol()
 })
 
 test('② quater mille images stables : la chaîne est posée UNE fois, et plus rien', async () => {
   const g = globeFactice()
   const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
   for (let i = 0; i < 1000; i++) veille.maj(2_200) // le Mont-Blanc du vol de référence
-  assert.deepEqual(quoi(g), ['crop', 'parois', 'habillage', 'rampe', 'mer'])
+  assert.deepEqual(quoi(g), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
   await veille.enVol()
 })
 
 test('② quinquies une altitude non finie ne décide rien', async () => {
   const g = globeFactice()
   const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
   for (const mauvaise of [NaN, Infinity, -Infinity, undefined, null, '2000']) {
     assert.equal(veille.maj(mauvaise), false, `${String(mauvaise)} ne doit pas faire naître le crop`)
   }
   assert.deepEqual(quoi(g), [])
@@ -407,20 +422,102 @@ test('⑥ un maillon qui REFUSE est repris plus tard, et la découpe n’est pas
   g.refuse.parois = false
   g.refuse.rampe = false
   for (let i = 0; i < 5; i++) veille.maj(2_000)
   assert.deepEqual(veille.refus, [])
   const n = g.journal.filter((e) => e.quoi === 'parois').length
   for (let i = 0; i < 50; i++) veille.maj(2_000)
   assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, n, 'plus rien à reprendre, plus rien à faire')
   await veille.enVol()
 })
 
+test('⑥ ter QUAND LE FOND FINIT PAR PRENDRE, SES LECTEURS SONT REJOUÉS — Tâche J bis', async () => {
+  // ⚠️ **CE TEST N'EXISTE QUE PARCE QU'ON A REGARDÉ, ET C'EST UN CHIFFRE.** La
+  // nappe bathymétrique est ASYNCHRONE : au premier passage le fond REFUSE
+  // pendant que `parois` et `rampe` PRENNENT, sur une surface encore plate.
+  // `reprendre` ne rejoue que ce qui a refusé — donc, quand le fond prenait
+  // enfin, la rampe gardait la profondeur de la surface d'avant. Relevé dans
+  // l'application, La Réunion z12 : **`uOceanDepth = 130,36 m`** avec un fond de
+  // **2 116 m** sous les pieds.
+  const g = globeFactice({ refuse: { fond: true } })
+  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
+  veille.maj(2_000)
+  assert.deepEqual(veille.refus, ['fond'], 'le fond refuse seul : les autres ont pris')
+  const paroisAvant = g.journal.filter((e) => e.quoi === 'parois').length
+  const rampeAvant = g.journal.filter((e) => e.quoi === 'rampe').length
+
+  // la nappe atterrit : la reprise suivante pose le fond, ET rejoue ses lecteurs
+  g.refuse.fond = false
+  veille.maj(2_000); veille.maj(2_000)
+  assert.deepEqual(veille.refus, [])
+  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, paroisAvant + 1,
+    'les parois se posent sur `hauteurSurface` : sans rejeu, leur base reste au niveau de la mer')
+  assert.equal(g.journal.filter((e) => e.quoi === 'rampe').length, rampeAvant + 1,
+    'la rampe mesure la profondeur : sans rejeu, elle garde celle d’une surface qui n’existe plus')
+  assert.equal(g.journal.filter((e) => e.quoi === 'habillage').length, 1,
+    'l’habillage ne lit AUCUNE hauteur — le rejouer serait du travail pour rien')
+
+  // et un fond INCHANGÉ ne rejoue rien : `rebati` vaut alors zéro
+  await veille.enVol()
+})
+
+test('⑥ ter bis un fond qui PREND sans RIEN changer ne rejoue pas ses lecteurs', async () => {
+  // ⚠️ **CE TEST A ÉTÉ RÉÉCRIT PARCE QU'IL NE PROUVAIT RIEN.** Sa première
+  // version faisait prendre le fond DÈS LA POSE : `refus` ne contenait donc
+  // jamais `'fond'`, la reprise ne rappelait jamais le maillon, et une mutation
+  // qui rendait `neuf: true` à chaque fois survivait tranquillement. Il faut que
+  // le fond REFUSE d'abord, PUIS prenne sans rien rebâtir.
+  //
+  // ⚠️ L'enjeu : `poserFondCrop` est rappelé à chaque reprise ; s'il se disait
+  // `neuf` à chaque fois, le contour des parois (plus de mille points) et le
+  // balayage de la rampe (`pas²`) repartiraient toutes les deux images.
+  const g = globeFactice({ refuse: { fond: true, mer: true } })
+  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
+  veille.maj(2_000)
+  await veille.enVol()
+  assert.ok(veille.refus.includes('fond'), 'le fond doit AVOIR refusé, sinon la reprise ne le rappelle pas')
+  const paroisAvant = g.journal.filter((e) => e.quoi === 'parois').length
+  const rampeAvant = g.journal.filter((e) => e.quoi === 'rampe').length
+
+  // le fond prend à la reprise suivante, mais le champ est IDENTIQUE : rien à rebâtir
+  g.poserFondCrop = (a) => {
+    g.journal.push({ quoi: 'fond', arg: a })
+    return { refus: null, couverture: 1, bathy: true, profMaxM: 2116.3, rebati: 0 }
+  }
+  veille.maj(2_000); veille.maj(2_000)
+  await veille.enVol()
+  assert.ok(!veille.refus.includes('fond'), 'le fond a bien pris')
+  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, paroisAvant,
+    'un fond identique ne doit entraîner personne')
+  assert.equal(g.journal.filter((e) => e.quoi === 'rampe').length, rampeAvant)
+})
+
+test('⑥ ter ter un lecteur DÉJÀ rejoué ne l’est pas DEUX FOIS dans la même reprise', async () => {
+  // ⚠️ Quand `fond` ET `parois` ont refusé, la reprise rejoue `parois` parce
+  // qu'il est dans `refus` — et le fond, en prenant, voudrait le rejouer AUSSI.
+  // Le balayage du contour fait plus de mille points : le payer deux fois par
+  // reprise est exactement ce que la garde de `reprendre` évite.
+  const g = globeFactice({ refuse: { fond: true, parois: true, mer: true } })
+  const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
+  veille.maj(2_000)
+  await veille.enVol()
+  assert.deepEqual(veille.refus.slice().sort(), ['fond', 'mer', 'parois'])
+  const avant = g.journal.filter((e) => e.quoi === 'parois').length
+
+  // tout arrive d'un coup : le fond prend ET rebâtit, les parois prennent aussi
+  g.refuse.fond = false
+  g.refuse.parois = false
+  veille.maj(2_000); veille.maj(2_000)
+  await veille.enVol()
+  assert.equal(g.journal.filter((e) => e.quoi === 'parois').length, avant + 1,
+    'les parois doivent être rejouées UNE fois, pas deux')
+})
+
 test('⑥ bis la mer qui refuse est reprise elle aussi — son refus arrive PLUS TARD', async () => {
   // ⚠️ `poserMer` est la seule asynchrone de la chaîne : son refus n'existe pas
   // encore quand `poserChaineCrop` rend la main. Une reprise qui ne lirait que
   // le retour synchrone laisserait une mer absente pour toujours.
   const g = globeFactice({ refuse: { mer: true } })
   const veille = creerVeilleCrop({ globe: g, contexte: contexteFactice(), periodeReprise: 2 })
   veille.maj(2_000)
   assert.deepEqual(veille.refus, [], 'à l’instant de la pose, la promesse n’est pas encore tenue')
   await veille.enVol()
   assert.deepEqual(veille.refus, ['mer'], 'et quand elle l’est, le refus est là')
@@ -557,20 +654,34 @@ test('⑧ quinquies l’estompage n’a QU’UN nourrisseur, drapeau levé ou ba
   // `majEstompage` doit donc rendre la main, sinon la même image l'applique deux
   // fois et les deux compteurs de bascules divergent.
   const i = SRC_MAIN.indexOf('function majEstompage()')
   assert.ok(i > 0)
   const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}', i))
   assert.match(corps, /terreUniqueBranchee/)
   assert.ok(corps.indexOf('terreUniqueBranchee') < corps.indexOf('veilleEstompage.maj('))
   assert.match(SRC_MAIN, /creerVeilleCrop\(\{[\s\S]{0,900}?estompage: veilleEstompage/)
 })
 
+test('⑧ nonies le FOND et la MER lisent le MÊME champ, par les MÊMES arguments — Tâche J bis', () => {
+  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE COMME TELLE** : `main.js` n'est chargé par
+  // aucun test (three.js, le DOM, WebGL). Ce qu'elle garde n'est pas une chaîne
+  // décorative : deux jeux d'arguments qui divergeraient — une portée ici, une
+  // autre là — rouvriraient EXACTEMENT le désaccord que la Tâche J bis ferme,
+  // et l'écran montrerait une mer qui s'arrête où le fond ne va pas.
+  const bloc = SRC_MAIN.slice(SRC_MAIN.indexOf('ctx.fond = {'), SRC_MAIN.indexOf('ctx.fond = {') + 400)
+  assert.ok(bloc.length > 20, '`contexteCrop` ne construit pas de section `fond`')
+  for (const champ of ['remplir', 'portee', 'couvertureMin', 'exigerBathy']) {
+    assert.match(bloc, new RegExp(champ + ':\\s*ctx\\.mer\\.' + champ),
+      `fond.${champ} doit être DÉRIVÉ de mer.${champ}, pas recopié`)
+  }
+})
+
 test('⑧ sexies la mer reçoit le fov VIVANT, pas le défaut du module', () => {
   // ⚠️ **RELEVÉ SUR L'APPLICATION VIVANTE le 2026-08-21** : `params.fov = 33`,
   // `camera.fov = 33`, `camGlobe.fov = 33` — alors que le défaut du code est 30
   // (`main.js`, `fov: 30`) et que `FOV_DEG` vaut 30. L'écart vient des
   // templates : `templates-user.js` sauvegarde `'fov'`, et un template appliqué
   // au démarrage repose `params.fov`. « 33 n'existe nulle part dans le dépôt »
   // était vrai de la SOURCE et faux de l'application qui tourne.
   const i = SRC_MAIN.indexOf('function contexteCrop()')
   assert.ok(i > 0, '`main.js` doit fabriquer le contexte du crop dans une fonction nommée')
   const corps = SRC_MAIN.slice(i, SRC_MAIN.indexOf('\n}\n', i))
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index 52bb1aa..d76ea6e 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -121,23 +121,27 @@ test('① retirerCrop retire aussi l’habillage — sinon il survivrait au crop
   const bloc = GLOBE_SRC.slice(GLOBE_SRC.indexOf('  retirerCrop() {'), GLOBE_SRC.indexOf('  retirerCrop() {') + 400)
   assert.match(bloc, /this\.retirerHabillage\(\)/, '`retirerCrop` ne retire pas l’habillage')
 })
 
 test('① le compte de samplers du nuanceur du globe reste sous le plafond de 16', () => {
   // ⚠️ CE N'EST PAS UNE ASSERTION QUI DISTINGUE, C'EST UN PLAFOND — et il a déjà
   // été crevé une fois : le 2026-08-03 le terrain a purement disparu de l'écran,
   // « FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS
   // (16) », 18 samplers pour 16 (voir `test/plafond-unites-texture.test.js`).
   // Sa mutation nommée est M9 (`.banc/mutations-habC.mjs`).
+  // ⚠️ **SIX DEPUIS LA TÂCHE J bis** : `uFondChamp` porte le fond du crop, que la
+  // rampe lit pour savoir qu'elle peint une mer et non un pré. Le compte reste
+  // très en dessous du plafond, mais il est ÉCRIT — un sampler ajouté sans que
+  // ce chiffre bouge, c'est un chiffre qui ne garde plus rien.
   const n = (FRAG.match(/uniform\s+sampler2D\s+\w+\s*;/g) || []).length
   assert.ok(n <= 16, `le nuanceur du globe déclare ${n} samplers`)
-  assert.equal(n, 5, `le compte attendu est 5 (uTex, uRamp, uCoastMask, uSol, uSolLut), pas ${n}`)
+  assert.equal(n, 6, `le compte attendu est 6 (uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp), pas ${n}`)
 })
 
 // ══════════ ② LES DEUX FAMILLES D'UV NE SE CONFONDENT PAS ══════════════════
 
 test("② les champs CUITS ne se retournent pas, les couches DRAPÉES si — et l'écart vaut exactement 1", () => {
   // ⚠️ C'EST LE PIÈGE LE PLUS SILENCIEUX DE CETTE TÂCHE. `terrain.js` lit
   // uCoastMask / uSeaMask / uAnalysis en `vWorldPos.xz` DIRECT, et `uvSolDrape`
   // — et lui seul — retourne y. Confondre les deux pose la forêt à l'envers et
   // la mer sur les crêtes, sans qu'aucune erreur ne se lève.
   for (const [u, v] of [[-1, -1], [-0.3, 0.7], [0, 0], [0.9, -0.4], [1, 1]]) {
diff --git a/test/fond-crop.test.js b/test/fond-crop.test.js
new file mode 100644
index 0000000..5f7743b
--- /dev/null
+++ b/test/fond-crop.test.js
@@ -0,0 +1,733 @@
+// LE FOND DU CROP — Tâche J bis.
+//
+// Ce que ces tests verrouillent, et pourquoi ils existent : la Tâche J a montré
+// PAR ÉLIMINATION que « le champ de la mer a un fond, la surface du crop n'en a
+// pas ». Les chiffres du désaccord sont relevés dans l'application vivante et
+// déposés sur le disque (`.banc/vues-Jbis/Jbis-releves-bruts.json`) ; ce fichier-ci
+// verrouille la LOI qui le ferme, et surtout **son défaut** : sans fond posé,
+// la surface est celle du dépôt au bit près.
+//
+// ⚠️ **DEUX LOIS, ET C'EST VOULU** — voir l'en-tête de `src/monde/fond-crop.js` :
+// `_buildMesh` écrête à zéro et `hauteurSurface` ne l'a JAMAIS fait. Une loi
+// unique aurait changé un des deux côtés sans fond posé.
+
+import { test } from 'node:test'
+import assert from 'node:assert/strict'
+import fs from 'node:fs'
+import path from 'node:path'
+import { fileURLToPath } from 'node:url'
+import * as THREE from 'three'
+import {
+  altitudeMaillage,
+  altitudeSonde,
+  uvFond,
+  echantillonnerFond,
+  cleFond,
+} from '../src/monde/fond-crop.js'
+import { repereCrop, localCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
+import { construireSolideCrop } from '../src/monde/parois-crop.js'
+import { Globe } from '../src/globe.js'
+import { R_GLOBE, EARTH_RADIUS_M, latLonToTile, tileToLatLon, latLonToSphere } from '../src/geo.js'
+
+const ICI = path.dirname(fileURLToPath(import.meta.url))
+const SOURCE_GLOBE = fs.readFileSync(path.join(ICI, '..', 'src', 'globe.js'), 'utf8')
+// Le nuanceur de FRAGMENT du globe, extrait de la source — meme procede que
+// test/crop-habillage.test.js : on lit ce que le GPU recevra, pas une copie.
+const FRAG_GLOBE = (() => {
+  const i = SOURCE_GLOBE.indexOf('const FRAG = /* glsl */ `')
+  return SOURCE_GLOBE.slice(i, SOURCE_GLOBE.indexOf('\n`\n', i))
+})()
+
+// ══════════ ① LES DEUX LOIS, ET LEUR DÉFAUT ═════════════════════════════════
+
+test('① sans fond, `altitudeMaillage` EST `Math.max(h, 0)` — le dépôt au bit près', () => {
+  for (const h of [-4297, -288.36328125, -0.7, 0, 1e-7, 12.5, 2975.25, 8848]) {
+    assert.ok(Object.is(altitudeMaillage(h, null), Math.max(h, 0)),
+      `${h} : la surface sans fond doit rester celle d'« oceans stay on the sphere »`)
+    assert.ok(Object.is(altitudeMaillage(h, undefined), Math.max(h, 0)))
+    assert.ok(Object.is(altitudeMaillage(h, NaN), Math.max(h, 0)),
+      'un champ non fini est une ABSENCE de mesure, pas un zéro')
+  }
+})
+
+test('① bis sans fond, `altitudeSonde` rend la valeur BRUTE — négatifs compris', () => {
+  for (const h of [-288.36328125, -0.7, 0, 12.5, 2975.25]) {
+    assert.ok(Object.is(altitudeSonde(h, null), h),
+      'les parois suivent aujourd’hui la frange négative du terrarium ; on ne la leur retire pas')
+  }
+})
+
+test('① ter `null` traverse `altitudeSonde` — le §7 de `parois-crop.js`', () => {
+  assert.equal(altitudeSonde(null, -1200), null, 'un fond posé ne rend pas la couverture meilleure')
+  assert.equal(altitudeSonde(undefined, -1200), null)
+})
+
+test('② avec fond, la MER prend le fond et la TERRE garde la tuile', () => {
+  // la terre : le champ est six fois plus grossier que la tuile, il ne doit pas
+  // la remplacer au-dessus de zéro
+  assert.equal(altitudeMaillage(1234.5, -900), 1234.5)
+  assert.equal(altitudeSonde(1234.5, -900), 1234.5)
+  // la mer : la tuile dit zéro (51,1 % de ses échantillons le disent), le champ
+  // dit −920,7 m — c'est le champ qui gagne
+  assert.equal(altitudeMaillage(0, -920.7), -920.7)
+  assert.equal(altitudeSonde(0, -920.7), -920.7)
+  // la frange du terrarium n'échappe pas non plus au champ : UNE autorité
+  assert.equal(altitudeMaillage(-288.36328125, -1500), -1500)
+})
+
+test('② bis un champ qui dit « terre » là où la tuile dit « mer » ne fait pas sortir de butte', () => {
+  assert.equal(altitudeMaillage(0, 37.5), 0, 'min(hFond, 0) : on reste au niveau de la mer')
+  assert.equal(altitudeSonde(-2, 37.5), 0)
+})
+
+// ══════════ ③ LA LECTURE DU CHAMP ═══════════════════════════════════════════
+
+test('③ `uvFond` EST la formule du nuanceur de la mer, mot pour mot', () => {
+  // la ligne du dépôt : `vec2 uvF = aCrop / (2.0 * uMerPortee) + 0.5;`
+  assert.match(SOURCE_GLOBE, /uvF\s*=\s*aCrop\s*\/\s*\(2\.0\s*\*\s*uMerPortee\)\s*\+\s*0\.5/,
+    'si cette ligne change, `uvFond` doit changer avec elle — sinon les deux fonds divergent')
+  for (const portee of [1, 3, 7.25]) {
+    for (const q of [{ u: 0, v: 0 }, { u: portee, v: -portee }, { u: -portee, v: portee }]) {
+      const r = uvFond(q, portee)
+      assert.equal(r.u, q.u / (2 * portee) + 0.5)
+      assert.equal(r.v, q.v / (2 * portee) + 0.5)
+    }
+  }
+  assert.deepEqual(uvFond({ u: 0, v: 0 }, 3), { u: 0.5, v: 0.5 }, 'le centre du crop est le centre du champ')
+  assert.deepEqual(uvFond({ u: -3, v: -3 }, 3), { u: 0, v: 0 }, 'le coin nord-ouest est l’origine du tableau')
+})
+
+test('③ bis le nuanceur du GLOBE lit le fond avec EXACTEMENT la même formule', () => {
+  assert.match(SOURCE_GLOBE, /qCrop\s*\/\s*\(2\.0\s*\*\s*uFondPortee\)\s*\+\s*0\.5/,
+    'la transcription GPU du fond doit être celle de `uvFond`')
+})
+
+// un champ jouet : une pente en u, pour que la bilinéaire se lise
+function fondJouet({ portee = 3, cote = 5, valeurs = null } = {}) {
+  const repere = repereCrop({ centre: { lat: -21.25, lon: 55.7666015625 }, zoom: 12 })
+  const v = valeurs ?? new Float32Array(cote * cote)
+  if (!valeurs) {
+    for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) v[j * cote + i] = -100 * i - 1000 * j
+  }
+  return { valeurs: v, cote, repere, portee, bathy: true, profMaxM: 4000 }
+}
+
+test('③ ter `echantillonnerFond` interpole — elle ne s’accroche pas au nœud', () => {
+  const f = fondJouet()
+  const centre = latLonDeLocal(0, 0, f.repere)
+  // le centre du crop tombe pile au centre du champ (nœud 2,2 d'une grille 5×5)
+  assert.equal(echantillonnerFond(f, centre.lat, centre.lon), -100 * 2 - 1000 * 2)
+  // un demi-pas plus à l'est : la moitié du chemin vers le nœud suivant
+  const demiPas = latLonDeLocal(f.portee / (f.cote - 1), 0, f.repere)
+  const attendu = -100 * 2.5 - 1000 * 2
+  assert.ok(Math.abs(echantillonnerFond(f, demiPas.lat, demiPas.lon) - attendu) < 1e-6,
+    'un fond marin en marches est le défaut que la Tâche B a déjà mesuré sur les parois')
+})
+
+test('③ ter bis le champ n’est pas lu TRANSPOSÉ — et il faut sortir de la diagonale pour le voir', () => {
+  // ⚠️ **CE TEST EXISTE PARCE QU'UNE MUTATION A SURVÉCU.** La campagne a
+  // transposé la lecture (`valeurs[i0 * c + j0]` au lieu de `valeurs[j0 * c + i0]`)
+  // et AUCUN test n'a rougî : tous mes points de sonde tombaient sur la DIAGONALE
+  // du champ, où une transposition ne change rien par construction. C'est
+  // exactement le piège du §0 (« une mutation change le COMPORTEMENT, pas la
+  // chaîne ») retourné contre moi : la mutation changeait bien le comportement,
+  // c'est ma SONDE qui était aveugle.
+  //
+  // Un fond marin lu transposé, c'est le relief sous-marin en miroir diagonal.
+  const f = fondJouet()
+  // ⚠️ **UN PAS DE CHAMP FAIT `2 × portee / (cote − 1)`, PAS `portee / (cote − 1)`** :
+  // le champ s'étend sur `[−portee, +portee]`, donc sur DEUX portées.
+  const pas = (2 * f.portee) / (f.cote - 1)
+  // DEUX pas à l'est, UN pas au sud : hors diagonale, donc la transposition mord
+  const p = latLonDeLocal(2 * pas, 1 * pas, f.repere)
+  const attendu = -100 * (2 + 2) - 1000 * (2 + 1) // nœud (i = 4, j = 3)
+  const lu = echantillonnerFond(f, p.lat, p.lon)
+  assert.ok(Math.abs(lu - attendu) < 1e-6, `lu ${lu}, attendu ${attendu}`)
+  // et le témoin : la valeur TRANSPOSÉE est un autre nombre, donc la sonde mord
+  const transposee = -100 * (2 + 1) - 1000 * (2 + 2)
+  assert.notEqual(attendu, transposee, 'la sonde doit être HORS de la diagonale, sinon elle ne prouve rien')
+})
+
+test('③ quater HORS du champ, `echantillonnerFond` rend `null` — jamais le bord prolongé', () => {
+  const f = fondJouet()
+  const dehors = latLonDeLocal(f.portee * 1.001, 0, f.repere)
+  assert.equal(echantillonnerFond(f, dehors.lat, dehors.lon), null)
+  const dedans = latLonDeLocal(f.portee * 0.999, 0, f.repere)
+  assert.ok(Number.isFinite(echantillonnerFond(f, dedans.lat, dedans.lon)))
+  assert.equal(echantillonnerFond(null, 0, 0), null)
+})
+
+test('③ quinquies la clé du fond change quand la BATHYMÉTRIE arrive', () => {
+  const a = fondJouet()
+  const b = { ...fondJouet(), bathy: false, profMaxM: 12 }
+  assert.notEqual(cleFond(a), cleFond(b),
+    'la nappe est asynchrone : une clé sur la seule emprise laisserait la surface plate pour toujours')
+  assert.equal(cleFond(a), cleFond(fondJouet()))
+})
+
+// ══════════ ④ LA SURFACE DESSINÉE — LA VRAIE MÉTHODE ════════════════════════
+
+const EXAGERATION = 2.8 // la valeur relevée dans l'application vivante
+const HAUTEURS_MER = new Float32Array(256 * 256) // zéro partout : la mer du terrarium
+
+function tuileDeTest(z, lat, lon, heights) {
+  const brut = latLonToTile(lat, lon, z)
+  const x = Math.floor(brut.x)
+  const y = Math.floor(brut.y)
+  const nw = tileToLatLon(x, y, z)
+  const se = tileToLatLon(x + 1, y + 1, z)
+  return {
+    key: `${z}/${x}/${y}`, z, x, y, state: 'ready', heights, size: 256,
+    texture: null, mesh: null, lastUsed: 0,
+    center: latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2),
+    chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)),
+  }
+}
+
+function construis(t, fond) {
+  const faux = {
+    exaggeration: EXAGERATION,
+    group: new THREE.Group(),
+    _materialFor: () => new THREE.MeshBasicMaterial(),
+    _fondCrop: fond ?? null,
+  }
+  Globe.prototype._buildMesh.call(faux, t)
+  return t.mesh
+}
+
+// le rayon MONDIAL d'un sommet : `_buildMesh` écrit du relatif, la position
+// mondiale vit dans `mesh.position` (RTC — `test/globe-precision.test.js`)
+function rayonDuSommet(mesh, s) {
+  const p = mesh.geometry.attributes.position
+  return new THREE.Vector3(p.getX(s), p.getY(s), p.getZ(s)).add(mesh.position).length()
+}
+
+test('④ SANS fond, la mer reste sur la sphère — le dépôt au bit près', () => {
+  const t = tuileDeTest(12, -21.25, 55.9, HAUTEURS_MER)
+  const mesh = construis(t, null)
+  for (const s of [0, 12, 300, 624]) {
+    assert.ok(Math.abs(rayonDuSommet(mesh, s) - R_GLOBE) < 1e-4,
+      'sans fond posé, `posAt` doit rendre exactement `R_GLOBE`')
+  }
+})
+
+test('④ bis AVEC un fond, la surface DESCEND — c’est le désaccord que la Tâche J a mesuré', () => {
+  const PROFONDEUR_M = -1500
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const cote = 5
+  const fond = {
+    valeurs: new Float32Array(cote * cote).fill(PROFONDEUR_M),
+    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
+  }
+  // une tuile au CENTRE du crop, donc entièrement dans le champ
+  const t = tuileDeTest(12, -21.248422235627014, 55.7666015625, HAUTEURS_MER)
+  const mesh = construis(t, fond)
+  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
+  const attendu = R_GLOBE + PROFONDEUR_M * echelle
+  const r = rayonDuSommet(mesh, 312) // un sommet du milieu de la nappe
+  assert.ok(Math.abs(r - attendu) < 1e-4,
+    `la surface doit descendre à ${attendu}, elle est à ${r}`)
+  assert.ok(r < R_GLOBE - 1e-3, 'un fond marin au-dessus de la sphère n’est pas un fond marin')
+})
+
+test('④ ter la TERRE ne bouge pas d’un bit quand un fond est posé', () => {
+  const hautes = new Float32Array(256 * 256).fill(1200)
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const cote = 5
+  const fond = {
+    valeurs: new Float32Array(cote * cote).fill(-1500),
+    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
+  }
+  const sans = construis(tuileDeTest(12, -21.248422235627014, 55.7666015625, hautes), null)
+  const avec = construis(tuileDeTest(12, -21.248422235627014, 55.7666015625, hautes), fond)
+  const a = sans.geometry.attributes.position.array
+  const b = avec.geometry.attributes.position.array
+  assert.equal(a.length, b.length)
+  for (let k = 0; k < a.length; k++) {
+    assert.ok(Object.is(a[k], b[k]), `sommet ${k} : la terre garde la finesse de la tuile`)
+  }
+})
+
+// ══════════ ⑤ LA SONDE — parois, rampe, champ de repli ══════════════════════
+
+test('⑤ `hauteurSurface` rend le FOND en mer quand il est posé', () => {
+  const t = tuileDeTest(12, -21.248422235627014, 55.7666015625, HAUTEURS_MER)
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const cote = 5
+  const fond = {
+    valeurs: new Float32Array(cote * cote).fill(-1500),
+    cote, repere, portee: 3, bathy: true, profMaxM: 1500,
+  }
+  const nu = { tuilesAvecHauteurs: () => [t], _fondCrop: null }
+  const garni = { tuilesAvecHauteurs: () => [t], _fondCrop: fond }
+  const lat = -21.248422235627014
+  const lon = 55.7666015625
+  assert.equal(Globe.prototype.hauteurSurface.call(nu, lat, lon), 0,
+    'sans fond, la sonde lit la tuile — zéro, et c’est le défaut mesuré')
+  assert.ok(Math.abs(Globe.prototype.hauteurSurface.call(garni, lat, lon) + 1500) < 1e-6,
+    'avec le fond, les parois et la rampe voient la même surface que le maillage')
+})
+
+test('⑤ bis hors couverture, la sonde rend TOUJOURS `null`, fond ou pas', () => {
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const fond = {
+    valeurs: new Float32Array(25).fill(-1500),
+    cote: 5, repere, portee: 3, bathy: true, profMaxM: 1500,
+  }
+  const garni = { tuilesAvecHauteurs: () => [], _fondCrop: fond }
+  assert.equal(Globe.prototype.hauteurSurface.call(garni, -21.25, 55.77), null,
+    'un fond posé ne remplace pas une tuile absente : `null`, jamais zéro')
+})
+
+// ══════════ ⑥ LE REPÈRE DU CHAMP EST CELUI DE LA CALOTTE ════════════════════
+
+test('⑥ la grille du champ est régulière en MERCATOR, comme `remplirHauteurs`', () => {
+  // `uvFond` suppose que le nœud (i, j) du champ tombe à la coordonnée locale
+  // `-portee + 2·portee·i/(cote-1)`. C'est vrai si et seulement si la grille de
+  // `remplirHauteurs` (régulière en mercator sur `boiteMerc(empriseCalotte)`)
+  // coïncide avec le repère local du crop, qui est mercator lui aussi.
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const portee = 3
+  const cote = 385
+  for (const i of [0, 1, 192, 383, 384]) {
+    const uLocal = -portee + (2 * portee * i) / (cote - 1)
+    const p = latLonDeLocal(uLocal, 0, repere)
+    const q = localCrop(p.lat, p.lon, repere)
+    assert.ok(Math.abs(q.u - uLocal) < 1e-9, 'aller-retour local → lat/lon → local')
+    const uv = uvFond(q, portee)
+    assert.ok(Math.abs(uv.u * (cote - 1) - i) < 1e-6, `le nœud ${i} doit se relire en ${i}`)
+  }
+})
+
+// ══════════ ⑦ LES PAROIS SUIVENT LA SURFACE ═════════════════════════════════
+
+test('⑦ `plancherMer` décide si la base du bloc voit le fond marin', () => {
+  // ⚠️ **RELEVÉ À L'ÉCRAN AVANT CE CORRECTIF, ET C'EST CE QUI L'A FAIT ÉCRIRE** :
+  // `baseY` valait **−0,054 132 359 8 unité** avec ET sans fond, au millionième
+  // près, pour une surface descendue de **2 116,3 m**. Le §4 de `parois-crop.js`
+  // posait `plancherMer = 0` parce que le globe écrêtait sa mer sur la sphère ;
+  // depuis que le crop porte son fond, c'est ce zéro-là qui fait passer la paroi
+  // AU-DESSUS de sa propre surface.
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const commun = {
+    repere,
+    forme: { coin: 0, expo: 2 },
+    hauteur: () => -1500,
+    rayon: R_GLOBE,
+    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
+    pas: 32,
+  }
+  const ecrete = construireSolideCrop({ ...commun, plancherMer: 0 })
+  const libre = construireSolideCrop({ ...commun, plancherMer: -1500 })
+  assert.equal(ecrete.refus, null)
+  assert.equal(libre.refus, null)
+  // ⚠️ **ON COMPARE L'ÉCART DES DEUX, PAS LEUR VALEUR ABSOLUE.** Le point le
+  // plus bas d'un crop plat n'est pas à zéro mais à la FLÈCHE de son arc — la
+  // sphère s'éloigne du plan tangent —, soit 4,6·10⁻⁴ unité ici, environ 29 m.
+  // L'inclure dans l'oracle en ferait une constante recopiée ; l'écart, lui,
+  // ne dépend que du plancher, et c'est ce que cette tâche change.
+  const chute = 1500 * commun.echelle
+  // ⚠️ **TOLÉRANCE RELATIVE, ET ELLE EST MOTIVÉE** : descendre la surface change
+  // aussi, d'un cheveu, sa projection dans le repère local du crop (la flèche
+  // se mesure sur un rayon plus court). L'écart résiduel vaut 3,6·10⁻⁵ unité,
+  // soit **0,054 % de la chute** — la loi est la bonne, pas la géométrie plate.
+  assert.ok(Math.abs((ecrete.baseY - libre.baseY) / chute - 1) < 1e-3,
+    `l'écart vaut ${ecrete.baseY - libre.baseY}, attendu ${chute}`)
+  // la profondeur est une FRACTION DE LA LARGEUR : elle ne suit pas le fond
+  // (l'anneau se resserre d'un cheveu sur un rayon plus court — 0,03 %)
+  assert.ok(Math.abs(ecrete.profondeur / libre.profondeur - 1) < 1e-3,
+    `profondeurs ${ecrete.profondeur} et ${libre.profondeur}`)
+  assert.ok(libre.baseY < ecrete.baseY - 1e-6, 'un fond marin doit faire descendre la base')
+})
+
+test('⑦ bis `plancherMer` vaut ZÉRO par défaut — le dépôt au bit près', () => {
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  const commun = {
+    repere,
+    forme: { coin: 0, expo: 2 },
+    hauteur: () => -1500,
+    rayon: R_GLOBE,
+    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
+    pas: 32,
+  }
+  const defaut = construireSolideCrop({ ...commun })
+  const zero = construireSolideCrop({ ...commun, plancherMer: 0 })
+  assert.ok(Object.is(defaut.baseY, zero.baseY), 'sans argument, la paroi doit rester celle du dépôt')
+})
+
+test('⑦ ter le globe DÉRIVE son plancher du fond posé, il ne le recopie pas', () => {
+  // assertion de SOURCE, déclarée comme telle : le comportement est mesuré dans
+  // l'application (`.banc/vues-Jbis/Jbis-releves-bruts.json`), pas ici — `construireParoisCrop`
+  // demande three, un globe monté et des tuiles.
+  assert.match(SOURCE_GLOBE, /plancherMer:\s*this\._fondCrop\s*\?\s*-Math\.max\(this\._fondCrop\.profMaxM,\s*0\)\s*:\s*0/,
+    'le plancher des parois doit suivre le fond, et valoir zéro sans lui')
+})
+
+test('⑦ quater un point INCONNU retombe au niveau de la mer, jamais au plancher', () => {
+  // ⚠️ Sans ça, un fond posé enverrait un point non couvert au fond de la fosse
+  // — et `couvertureMin` ne le rattrape que parce qu'il vaut 1 par défaut.
+  const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
+  let n = 0
+  const r = construireSolideCrop({
+    repere,
+    forme: { coin: 0, expo: 2 },
+    hauteur: () => (++n % 7 === 0 ? null : -1500),
+    rayon: R_GLOBE,
+    echelle: (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION,
+    pas: 32,
+    plancherMer: -1500,
+    couvertureMin: 0, // on TOLÈRE les trous, pour voir où ils tombent
+  })
+  assert.equal(r.refus, null)
+  assert.ok(Number.isFinite(r.baseY), 'un repli au plancher aurait donné un baseY de la fosse')
+  const y = []
+  for (let k = 0; k < r.positions.length; k += 3) y.push(r.positions[k + 1])
+  assert.ok(Math.max(...y) >= -1e-9, 'les points inconnus doivent se poser au niveau de la mer, c’est-à-dire à zéro')
+})
+
+// ══════════ ⑧ `poserFondCrop` — LA VRAIE MÉTHODE, EMPRUNTÉE ═════════════════
+//
+// ⚠️ **CES TESTS N'EXISTENT QUE PARCE QUE DOUZE MUTATIONS ONT SURVÉCU.** Le
+// premier tour de campagne a tué 19 mutations sur 35 : tout ce qui vivait dans
+// les MÉTHODES du globe passait à travers, parce qu'aucun test ne les appelait.
+// `Globe.prototype.X.call(faux, …)` est le précédent de
+// `test/globe-precision.test.js` — monter un `Globe` entier réclamerait le DOM.
+
+function globeNu({ crop = null, fond = null, exageration = EXAGERATION } = {}) {
+  const u = {
+    uCropOn: { value: crop ? 1 : 0 },
+    uFondChamp: { value: null },
+    uFondOn: { value: 0 },
+    uFondPortee: { value: 3 },
+    uFondMetres: { value: 1 },
+  }
+  return {
+    uniforms: u,
+    exaggeration: exageration,
+    _crop: crop,
+    _fondCrop: fond,
+    _cleFondPosee: '',
+    tiles: new Map(),
+    group: new THREE.Group(),
+    gardeHauteurs: new Set(),
+    _materialFor: () => new THREE.MeshBasicMaterial(),
+    _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
+    _refaireMaillagesDuFond() { return Globe.prototype._refaireMaillagesDuFond.call(this) },
+    _poserTextureFond(f) { return Globe.prototype._poserTextureFond.call(this, f) },
+  }
+}
+
+const CENTRE_REUNION = { lat: -21.248422235627014, lon: 55.7666015625 }
+const REPERE_REUNION = repereCrop({ centre: CENTRE_REUNION, zoom: 12 })
+
+// un `remplir` de papier : il remplit `sortie` d'une profondeur constante et dit
+// ce qu'on lui demande de dire
+function remplirFactice({ profondeur = -1500, remplis = null, bathy = true } = {}) {
+  return (emprise, n, sortie) => {
+    sortie.fill(profondeur)
+    return { remplis: remplis ?? sortie.length, manquants: 0, bathy, sortie }
+  }
+}
+
+const pose = (g, arg) => Globe.prototype.poserFondCrop.call(g, arg)
+
+test('⑧ `poserFondCrop` REFUSE sans crop, et sans `remplir`', () => {
+  // ⚠️ Un fond posé sans découpe n'a pas de repère : il creuserait la planète
+  // entière. Et sans `remplir` il n'y a PAS de repli — celui de `_cuireChampMer`
+  // (lire `hauteurSurface`) serait CIRCULAIRE, la sonde rendant déjà le fond posé.
+  const sansCrop = pose(globeNu(), { remplir: remplirFactice() })
+  assert.equal(sansCrop.refus, 'crop')
+  const sansRemplir = pose(globeNu({ crop: REPERE_REUNION }), {})
+  assert.equal(sansRemplir.refus, 'remplir')
+  assert.equal(sansRemplir.rebati, 0, 'un refus ne touche à rien')
+})
+
+test('⑧ bis `poserFondCrop` REFUSE une couverture insuffisante', () => {
+  // ⚠️ Poser un fond à moitié rempli creuserait des marches là où la donnée
+  // manque — et rebâtirait cinquante maillages pour les dessiner.
+  const g = globeNu({ crop: REPERE_REUNION })
+  const r = pose(g, { remplir: remplirFactice({ remplis: 100 }), couvertureMin: 0.99 })
+  assert.equal(r.refus, 'champ')
+  assert.ok(r.couverture < 0.99)
+  assert.equal(g.uniforms.uFondOn.value, 0, 'un refus ne doit rien allumer')
+  assert.equal(g._fondCrop, null)
+  // le même champ passe quand le seuil est celui du dépôt (0)
+  const passant = pose(globeNu({ crop: REPERE_REUNION }), { remplir: remplirFactice({ remplis: 100 }) })
+  assert.equal(passant.refus, null)
+})
+
+test('⑧ ter `poserFondCrop` REFUSE tant que la bathymétrie n a pas fusionné', () => {
+  // ⚠️ La nappe est ASYNCHRONE : sans ce refus, la première cuisson serait la
+  // dernière et la surface resterait plate en se croyant remplie.
+  const g = globeNu({ crop: REPERE_REUNION })
+  const r = pose(g, { remplir: remplirFactice({ bathy: false }), exigerBathy: true })
+  assert.equal(r.refus, 'champ')
+  assert.equal(r.bathy, false)
+  assert.equal(g.uniforms.uFondOn.value, 0)
+  // et il prend dès que la fusion a eu lieu
+  const g2 = globeNu({ crop: REPERE_REUNION })
+  assert.equal(pose(g2, { remplir: remplirFactice({ bathy: true }), exigerBathy: true }).refus, null)
+  assert.equal(g2.uniforms.uFondOn.value, 1)
+  // ⚠️ et `exigerBathy` faux LAISSE PASSER une nappe absente — c'est le cas
+  // NORMAL d'un crop continental, pas une panne
+  const g3 = globeNu({ crop: REPERE_REUNION })
+  assert.equal(pose(g3, { remplir: remplirFactice({ bathy: false }) }).refus, null)
+})
+
+test('⑧ quater il ne rebâtit QUE si la surface a changé', () => {
+  // ⚠️ `poserFondCrop` est rappelé à chaque cran ET à chaque reprise :
+  // reconstruire les maillages pour un champ identique coûterait une planète par
+  // reprise. Et l'inverse — ne jamais rebâtir — laisserait la surface plate.
+  const g = globeNu({ crop: REPERE_REUNION })
+  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
+  g.tiles.set(t.key, t)
+  g.gardeHauteurs.add(t.key) // sous réservation : ses hauteurs survivent au maillage
+  Globe.prototype._buildMesh.call(g, t)
+  assert.ok(t.mesh, 'la tuile doit avoir un maillage avant qu on parle de le rebâtir')
+
+  const premier = pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
+  assert.equal(premier.refus, null)
+  assert.equal(premier.rebati, 1, 'le premier fond doit rebâtir la tuile')
+
+  const identique = pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
+  assert.equal(identique.rebati, 0, 'un champ identique ne doit rebâtir personne')
+
+  // ⚠️ la nappe s approfondit (elle arrive par morceaux) : la clé change
+  const plusProfond = pose(g, { remplir: remplirFactice({ profondeur: -2116 }) })
+  assert.equal(plusProfond.rebati, 1, 'une profondeur nouvelle DOIT rebâtir')
+})
+
+test('⑧ quinquies le maillage rebâti PORTE le fond, et `retirerFondCrop` le rend', () => {
+  const g = globeNu({ crop: REPERE_REUNION })
+  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
+  g.tiles.set(t.key, t)
+  g.gardeHauteurs.add(t.key)
+  Globe.prototype._buildMesh.call(g, t)
+  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4)
+
+  pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
+  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
+  const creuse = rayonDuSommet(t.mesh, 312)
+  assert.ok(Math.abs(creuse - (R_GLOBE - 1500 * echelle)) < 1e-4,
+    `la surface rebâtie doit porter le fond ; elle est à ${creuse}`)
+
+  const rendus = Globe.prototype.retirerFondCrop.call(g)
+  assert.equal(rendus, 1, '`retirerFondCrop` doit rebâtir ce qu il a creusé')
+  assert.equal(g._fondCrop, null)
+  assert.equal(g.uniforms.uFondOn.value, 0)
+  assert.equal(g.uniforms.uFondChamp.value, null)
+  assert.equal(g.uniforms.uFondMetres.value, 1, '`uFondMetres` est un DIVISEUR : il revient à 1, pas à 0')
+  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4,
+    'le fond retiré, la mer doit remonter sur la sphère')
+})
+
+test('⑧ sexies les uniformes du fond portent l ÉCHELLE INVERSE et la PORTÉE du champ', () => {
+  // ⚠️ **`uFondMetres` EST L INVERSE DE L ÉCHELLE, ET UNE CONFUSION NE SE VOIT
+  // PAS** : le champ est cuit en unités locales (`brut × echelle`), le nuanceur
+  // le relit en mètres. Porter l échelle au lieu de son inverse rendrait un fond
+  // marin de deux milliardièmes de mètre — c est-à-dire zéro, c est-à-dire le
+  // défaut d avant la tâche, en silence.
+  for (const exageration of [1, 2.8, 18]) {
+    const g = globeNu({ crop: REPERE_REUNION, exageration })
+    const r = pose(g, { remplir: remplirFactice(), portee: 5 })
+    assert.equal(r.refus, null)
+    const echelle = (R_GLOBE / EARTH_RADIUS_M) * exageration
+    assert.ok(Math.abs(g.uniforms.uFondMetres.value - 1 / echelle) < 1e-9,
+      `exagération ${exageration} : uFondMetres = ${g.uniforms.uFondMetres.value}, attendu ${1 / echelle}`)
+    assert.equal(g.uniforms.uFondPortee.value, 5,
+      'la portée de l uniforme est celle du CHAMP POSÉ, pas le défaut du module')
+    assert.equal(g.uniforms.uFondOn.value, 1)
+    assert.ok(g.uniforms.uFondChamp.value?.isTexture)
+  }
+})
+
+test('⑧ septies la texture du fond relit EXACTEMENT ce que le champ portait', () => {
+  // l aller-retour complet : mètres → unités locales → demi-flottant → mètres.
+  // ⚠️ La tolérance n est pas choisie, elle est MESURÉE : un demi-flottant vaut
+  // 2^-15 près de 0,218 unité, soit 2,8 m au sol à l exagération 2,8.
+  const g = globeNu({ crop: REPERE_REUNION })
+  pose(g, { remplir: remplirFactice({ profondeur: -2116.3 }) })
+  const tex = g.uniforms.uFondChamp.value
+  const relu = THREE.DataUtils.fromHalfFloat(tex.image.data[0]) * g.uniforms.uFondMetres.value
+  assert.ok(Math.abs(relu - -2116.3) < 3,
+    `relu ${relu} m, attendu −2 116,3 m — au demi-flottant près (2,8 m mesurés)`)
+})
+
+// ══════════ ⑨ LE NUANCEUR — EXTRAIT DE LA SOURCE ET CONFRONTÉ À LA LOI ══════
+//
+// ⚠️ **PAS UNE ASSERTION DE CHAÎNE : ON EXÉCUTE LE BLOC GLSL.** Trois mutations
+// du premier tour ont survécu ici (nuanceur qui ignore le fond, qui le laisse
+// déborder du champ, qui fait sortir une butte de l'eau) parce que RIEN ne lisait
+// ce bloc. Le précédent est `test/mer-sphere.test.js`, qui « EXTRAIT cette
+// expression pour la confronter à elle » : on translittère mécaniquement le
+// GLSL en JavaScript et on l'oppose à `altitudeSonde`, la loi qu'il transcrit.
+//
+// ⚠️ **LA TRANSLITTÉRATION EST MÉCANIQUE, ET C'EST TOUT SON INTÉRÊT** : elle ne
+// réécrit pas la loi, elle remplace `min`/`max`/`abs` par leurs jumeaux de
+// `Math`, `&&` reste `&&`, et le `texture2D(...).r * uFondMetres` devient un
+// échantillonneur de papier. Ce qui change dans la source change donc dans la
+// fonction, et le test rougit sur le COMPORTEMENT.
+
+const BLOC_FOND_GLSL = (() => {
+  const debut = FRAG_GLOBE.indexOf('  if (uFondOn > 0.5')
+  if (debut < 0) throw new Error('le bloc du fond a disparu du nuanceur')
+  const fin = FRAG_GLOBE.indexOf('\n  }', debut)
+  return FRAG_GLOBE.slice(debut, fin + 4)
+})()
+
+// GLSL → JS, mécaniquement.
+const fondDuNuanceur = (() => {
+  const js = BLOC_FOND_GLSL
+    .replace(/\bfloat\s+/g, 'let ')
+    .replace(/\bmin\(/g, 'Math.min(')
+    .replace(/\bmax\(/g, 'Math.max(')
+    .replace(/\babs\(/g, 'Math.abs(')
+    // ⚠️ **NON GOURMAND, ET LA PARENTHÈSE INTERNE EST LA RAISON** : l'argument
+    // porte `(2.0 * uFondPortee)`, donc un `[^)]*` s'arrêterait au MAUVAIS `)`.
+    .replace(/texture2D\(uFondChamp,[\s\S]*?\)\.r/g, 'echantillon')
+    .replace(/0\.5;/g, '0.5;')
+  // eslint-disable-next-line no-new-func
+  return new Function('uFondOn', 'uCropOn', 'uFondPortee', 'uFondMetres', 'qCrop', 'h', 'echantillon',
+    js + '\n  return h;')
+})()
+
+test('⑨ le bloc du nuanceur EST `altitudeSonde` — translittéré, puis exécuté', () => {
+  const portee = 3
+  const echelleInverse = 22753.57142857143 // 1 / echelle, relevé dans l'application
+  for (const h of [-288.36, -0.7, 0, 12.5, 2975.25]) {
+    for (const fondM of [-2116.3, -920.7, -0.5, 0, 37.5]) {
+      for (const q of [{ x: 0, y: 0 }, { x: 2.9, y: -1 }, { x: -3, y: 3 }]) {
+        const echantillon = fondM / echelleInverse // ce que la texture porte : des unités locales
+        const rendu = fondDuNuanceur(1, 1, portee, echelleInverse, q, h, echantillon)
+        const attendu = altitudeSonde(h, fondM)
+        assert.ok(Math.abs(rendu - attendu) < 1e-6,
+          `h=${h} fond=${fondM} q=(${q.x},${q.y}) : le nuanceur rend ${rendu}, la loi ${attendu}`)
+      }
+    }
+  }
+})
+
+test('⑨ bis le nuanceur ÉTEINT (uFondOn ou uCropOn à zéro) rend la hauteur du dépôt', () => {
+  const echantillon = -2116.3 / 22753.57142857143
+  for (const [on, crop] of [[0, 1], [1, 0], [0, 0]]) {
+    for (const h of [-288.36, 0, 1200]) {
+      assert.equal(fondDuNuanceur(on, crop, 3, 22753.57142857143, { x: 0, y: 0 }, h, echantillon), h,
+        'sans crop ou sans fond, la production est intouchée AU BIT PRÈS')
+    }
+  }
+})
+
+test('⑨ ter HORS du champ, le nuanceur ne prolonge PAS le bord', () => {
+  // ⚠️ Le champ ne couvre que `uFondPortee` demi-côtés. Au-delà, la texture est
+  // en `ClampToEdge` : sans cette borne, le fond marin du bord de calotte se
+  // répandrait sur toute la planète estompée, sans qu'aucune erreur ne se lève.
+  const echelleInverse = 22753.57142857143
+  const echantillon = -2116.3 / echelleInverse
+  const portee = 3
+  // dedans : le fond mord
+  assert.ok(fondDuNuanceur(1, 1, portee, echelleInverse, { x: 2.99, y: 0 }, 0, echantillon) < -2000)
+  assert.ok(fondDuNuanceur(1, 1, portee, echelleInverse, { x: 0, y: -3 }, 0, echantillon) < -2000)
+  // dehors : rien ne bouge, sur les DEUX axes et dans les DEUX sens
+  for (const q of [{ x: 3.01, y: 0 }, { x: -3.01, y: 0 }, { x: 0, y: 3.01 }, { x: 0, y: -3.01 }, { x: 2.9, y: 4 }]) {
+    assert.equal(fondDuNuanceur(1, 1, portee, echelleInverse, q, 0, echantillon), 0,
+      `hors du champ en (${q.x}, ${q.y}), la hauteur ne doit pas bouger`)
+  }
+})
+
+test('⑨ quater le nuanceur ne fait pas sortir de butte de l eau', () => {
+  // le champ dit « terre » là où la tuile dit « mer » : on reste au niveau de la
+  // mer, comme `altitudeSonde` — jamais au-dessus.
+  const echelleInverse = 22753.57142857143
+  const rendu = fondDuNuanceur(1, 1, 3, echelleInverse, { x: 0, y: 0 }, 0, 37.5 / echelleInverse)
+  assert.equal(rendu, 0, 'min(hFond, 0.0) : un champ positif ne soulève pas la mer')
+})
+
+// ══════════ ⑩ LA FORMULE D UV EST LA MÊME DES DEUX CÔTÉS ════════════════════
+
+test('⑩ le nuanceur et `uvFond` lisent le champ AU MÊME TEXEL', () => {
+  // ⚠️ Deux conventions d uv, et le fond du CROP et le fond de la MER se
+  // liraient à deux endroits différents du même tableau — le désaccord
+  // reviendrait par la porte de derrière.
+  const m = BLOC_FOND_GLSL.match(/texture2D\(uFondChamp,\s*([\s\S]*?\+ 0\.5)\)\.r/)
+  assert.ok(m, 'la lecture de `uFondChamp` a changé de forme')
+  const expression = m[1].replace(/\s+/g, ' ').trim()
+  assert.equal(expression, 'qCrop / (2.0 * uFondPortee) + 0.5')
+  // et le comportement : la transcription JS de cette expression EST `uvFond`
+  for (const portee of [1, 3, 7.25]) {
+    for (const q of [{ u: 0, v: 0 }, { u: portee, v: -portee }, { u: -portee, v: portee / 3 }]) {
+      const glsl = { u: q.u / (2.0 * portee) + 0.5, v: q.v / (2.0 * portee) + 0.5 }
+      assert.deepEqual(uvFond(q, portee), glsl)
+    }
+  }
+})
+
+// ══════════ ⑪ LES DEUX DERNIERS SURVIVANTS DE LA CAMPAGNE ═══════════════════
+
+test('⑪ le champ n est pas lu TRANSPOSÉ — et il faut sortir de la diagonale ET du bord', () => {
+  // ⚠️ **DEUXIÈME ÉCRITURE DE CE TEST, ET LA PREMIÈRE NE MORDAIT PAS.** La
+  // mutation « lire `valeurs[i0 * c + j0]` au lieu de `valeurs[j0 * c + i0]` » a
+  // survécu DEUX fois :
+  //   ① d'abord parce que toutes mes sondes tombaient sur la DIAGONALE du champ,
+  //      où une transposition ne change rien par construction ;
+  //   ② puis parce que la sonde « hors diagonale » tombait sur le BORD, où
+  //      l'écrêtage de `i0` (`min(floor(fx), cote − 2)`) la ramenait sur la
+  //      diagonale sans que ça se voie.
+  // C'est le §0 retourné contre moi : la mutation changeait bien le
+  // COMPORTEMENT ; c'est la sonde qui était aveugle, deux fois.
+  //
+  // Un fond marin lu transposé, c'est le relief sous-marin en miroir diagonal :
+  // le talus se retrouve du mauvais côté de l'île.
+  const cote = 9
+  const f = fondJouet({ cote })
+  const n = cote - 1
+  // on VISE le carré (i0 = 5, j0 = 2), au milieu du champ et loin de la diagonale
+  const uLocal = ((5.5 / n) - 0.5) * 2 * f.portee
+  const vLocal = ((2.5 / n) - 0.5) * 2 * f.portee
+  const p = latLonDeLocal(uLocal, vLocal, f.repere)
+  const val = (i, j) => -100 * i - 1000 * j
+  const bilin = (i0, j0) => {
+    const haut = (val(i0, j0) + val(i0 + 1, j0)) / 2
+    const bas = (val(i0, j0 + 1) + val(i0 + 1, j0 + 1)) / 2
+    return (haut + bas) / 2
+  }
+  const attendu = bilin(5, 2)
+  const transposee = bilin(2, 5)
+  assert.notEqual(attendu, transposee, 'la sonde doit distinguer les deux lectures, sinon elle ne prouve rien')
+  const lu = echantillonnerFond(f, p.lat, p.lon)
+  assert.ok(Math.abs(lu - attendu) < 1e-6,
+    `lu ${lu}, attendu ${attendu} (la lecture transposée aurait donné ${transposee})`)
+})
+
+test('⑪ bis `retirerCrop` retire AUSSI le fond — sinon la mer reste creusée sans crop', () => {
+  // ⚠️ **UNE MUTATION A SURVÉCU ICI** : retirer l'appel à `retirerFondCrop` dans
+  // `retirerCrop` ne faisait rougir personne. Le globe redevenait entier avec un
+  // fond marin posé sur une découpe qui n'existe plus — donc des tuiles bâties
+  // AVEC le fond, et une mer creusée au milieu de l'océan Indien.
+  //
+  // ⚠️ **ET L'ORDRE COMPTE** : `retirerFondCrop` rebâtit les maillages, donc il
+  // doit passer APRÈS `_crop = null`. On le vérifie par le comportement, pas par
+  // la lecture : la tuile rebâtie doit être revenue SUR la sphère.
+  const g = globeNu({ crop: REPERE_REUNION })
+  const journal = []
+  // les cinq autres retraits sont hors sujet ici : ils ont leurs propres tests
+  for (const nom of ['_melangeCrop', 'retirerParoisCrop', 'retirerHabillage', 'retirerRampe', 'retirerMer', 'retirerEstompage']) {
+    g[nom] = () => journal.push(nom)
+  }
+  g.retirerFondCrop = function () { journal.push('retirerFondCrop'); return Globe.prototype.retirerFondCrop.call(this) }
+  const t = tuileDeTest(12, CENTRE_REUNION.lat, CENTRE_REUNION.lon, HAUTEURS_MER)
+  g.tiles.set(t.key, t)
+  g.gardeHauteurs.add(t.key)
+  Globe.prototype._buildMesh.call(g, t)
+  pose(g, { remplir: remplirFactice({ profondeur: -1500 }) })
+  assert.ok(rayonDuSommet(t.mesh, 312) < R_GLOBE - 1e-3, 'le fond est bien posé avant qu on le retire')
+
+  Globe.prototype.retirerCrop.call(g)
+
+  assert.ok(journal.includes('retirerFondCrop'), '`retirerCrop` doit appeler `retirerFondCrop`')
+  assert.equal(g._crop, null)
+  assert.equal(g._fondCrop, null)
+  assert.equal(g.uniforms.uFondOn.value, 0)
+  assert.equal(g.uniforms.uFondChamp.value, null)
+  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4,
+    'le crop retiré, la surface doit être revenue SUR la sphère')
+})
diff --git a/test/mer-sphere.test.js b/test/mer-sphere.test.js
index f98c935..0feb558 100644
--- a/test/mer-sphere.test.js
+++ b/test/mer-sphere.test.js
@@ -71,20 +71,22 @@ import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
 registerHooks({
   resolve(spec, ctx, suivant) {
     if (spec === 'ocean-waves') {
       return { url: new URL('../src/vendor/ocean-waves/index.js', import.meta.url).href, shortCircuit: true }
     }
     return suivant(spec, ctx)
   },
 })
 import { Globe } from '../src/globe.js'
 import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
+// LA LOI DE SURFACE — Tache J bis : l'epsilon de coplanarite depend de son DEFAUT.
+import { altitudeMaillage } from '../src/monde/fond-crop.js'
 import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
 import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
 import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
 
 const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
 const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
 
 // La Réunion — le crop de toutes les tâches de ce chantier.
 const CENTRE = { lat: -21.115, lon: 55.536 }
 const REPERE = repereCrop({ centre: CENTRE })
@@ -161,26 +163,44 @@ test('②b l epsilon suit la LARGEUR du crop : un crop deux fois plus large le d
 test('②c le 0,003 vient bien d `ocean.js` — garde-fou de SOURCE, déclaré', () => {
   // ⚠️ ASSERTION DE SOURCE, ET ELLE EST DÉCLARÉE COMME TELLE : elle ne prouve
   // aucun comportement, elle garde la TRAÇABILITÉ du nombre. Si `ocean.js`
   // change son epsilon, celui du globe doit suivre — sinon les deux mers ne se
   // poseront plus au même endroit.
   const src = readFileSync(SRC_OCEAN, 'utf8')
   assert.match(src, /_seaBase\s*=\s*seaY\s*\+\s*0\.003/)
   assert.equal(EPS_COPLANARITE_UNITES, 0.003)
 })
 
-test('②d le fond marin du globe est SUR la sphère — c est ce qui rend l epsilon obligatoire', () => {
-  // ⚠️ LE MOTIF DE L'EPSILON EST DANS `globe.js`, ET ON LE VÉRIFIE. Si un jour
-  // `_buildMesh` cessait d'écrêter à zéro, le fond descendrait sous la sphère et
-  // l'epsilon perdrait sa raison d'être — ce test rougirait, et c'est voulu.
+test('②d le fond marin du globe est SUR la sphère TANT QU AUCUN FOND N EST POSÉ', () => {
+  // ⚠️ LE MOTIF DE L'EPSILON EST DANS `globe.js`, ET ON LE VÉRIFIE — mais il a
+  // CHANGÉ DE PORTÉE à la Tâche J bis, et ce test dit lequel.
+  //
+  // Avant : `posAt` écrêtait à zéro EN TOUTES CIRCONSTANCES, donc le fond marin
+  // était partout coplanaire à la calotte, et l'epsilon était obligatoire PARTOUT.
+  // Depuis : la surface porte le relief sous-marin **là où un fond est posé**
+  // (`altitudeMaillage`, `src/monde/fond-crop.js`) — l'écart mesuré y vaut 920,7 m
+  // en moyenne, donc l'epsilon n'y décide plus rien. **Il reste obligatoire
+  // partout ailleurs** : hors du champ, sur toute la planète estompée, dans
+  // `?globe=continu`, et sur les lagons que le champ laisse à zéro.
+  //
+  // Ce qui se garde ici est donc le DÉFAUT : sans fond, `altitudeMaillage` EST
+  // `Math.max(h, 0)`. Si quelqu'un retirait cet écrêtage-là, l'epsilon perdrait
+  // sa raison d'être — ce test rougirait, et c'est voulu.
   const src = readFileSync(SRC_GLOBE, 'utf8')
-  assert.match(src, /Math\.max\(sampleHeights\(t\.heights, u, v, t\.size\), 0\)/)
+  assert.match(src, /altitudeMaillage\([\s\S]{0,12}sampleHeights\(t\.heights, u, v, t\.size\)/,
+    '`posAt` doit passer par la loi partagée, pas par un écrêtage à lui')
+  const srcFond = readFileSync(new URL('../src/monde/fond-crop.js', import.meta.url), 'utf8')
+  assert.match(srcFond, /if \(!Number\.isFinite\(hFond\)\) return Math\.max\(h, 0\)/,
+    'sans fond, la surface doit rester celle d’« oceans stay on the sphere »')
+  // et le comportement, pas seulement la chaîne
+  assert.equal(altitudeMaillage(-4297, null), 0)
+  assert.equal(altitudeMaillage(-4297, -4297), -4297)
 })
 
 // ══════════ ③ LA CALOTTE ═══════════════════════════════════════════════════
 
 const calotte = (portee, pas, hauteur = 0) =>
   construireCalotte({ repere: REPERE, rayon: R_GLOBE, portee, pas, hauteur })
 
 test('③a le centre de la calotte est EXACTEMENT au niveau de la mer', () => {
   const c = calotte(1, 4)
   const centre = (2 * 5 + 2) * 3 + 1 // (i=2, j=2) sur une grille 4×4
