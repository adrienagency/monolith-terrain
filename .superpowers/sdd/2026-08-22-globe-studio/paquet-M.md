a0e0499 tache M : la mort des paliers, un cran vaut racine de deux

 package.json                      |   2 +-
 src/globe.js                      |  38 +-
 src/main.js                       | 101 ++++--
 src/modes.js                      | 363 +++++++++++++++++--
 src/monde/exageration-continue.js |  43 ++-
 src/monde/zoom-continu.js         | 341 ++++++++++++++++++
 test/camera-continue.test.js      |  10 +-
 test/escalier-surface.test.js     |  32 +-
 test/exageration-globe.test.js    |  11 +-
 test/zoom-continu.test.js         | 736 ++++++++++++++++++++++++++++++++++++++
 10 files changed, 1603 insertions(+), 74 deletions(-)

diff --git a/package.json b/package.json
index 8d07054..ad6718b 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js",
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
index f1af141..2ebb39c 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -1967,21 +1967,57 @@ export class Globe {
    * Cette tuile est-elle hors du crop alors qu'on ne parcourt que le crop ?
    *
    * ⚠️ **LES RACINES z2 NE SONT PAS EXEMPTÉES ICI, CONTRAIREMENT AUX DEUX TRIS
    * SPATIAUX.** Elles le sont là-bas parce qu'elles portent la couverture tant
    * que leurs enfants ne sont pas au complet — un trou au bord de l'écran. Ici
    * il n'y a pas de trou à ouvrir : hors du crop, il n'y a RIEN à montrer. Et
    * elles ne se purgent jamais (`_purgerFile`, `_evict`), donc la transition les
    * retrouve en cache sans un octet de réseau.
    */
   _horsCropSeul(z, x, y) {
-    return this._cropSeul && !!this._crop && !tuileDansCrop(z, x, y, this._crop)
+    if (!this._crop) return false
+    if (!this._cropSeul && !this.estompePlein()) return false
+    return !tuileDansCrop(z, x, y, this._crop)
+  }
+
+  /**
+   * L'ESTOMPAGE EST-IL PLEIN ? — Tâche M, volet ④ (« n'améliorer que la zone
+   * visée »).
+   *
+   * ⚠️ **CE N'EST PAS UN SECOND DRAPEAU, C'EST UNE LECTURE.** À `uEstompage = 1`
+   * le nuanceur de fragment rend `couvertureTuile = mix(1.0, dedans, 1.0)`,
+   * c'est-à-dire `dedans` — lequel vaut **exactement 0** hors du crop, donc
+   * `discard`. **Tout ce qui est dehors est déjà invisible** ; le parcourir,
+   * le demander au réseau, le décoder et le mailler est du travail dont pas un
+   * pixel ne sort.
+   *
+   * ⚠️ **CE QUE ÇA AJOUTE À LA TÂCHE N, ET POURQUOI CE N'EST PAS UN DOUBLON.**
+   * `poserCropSeul` coupe **au REPOS** — c'est la consigne d'Adrien du même jour
+   * (« ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
+   * stabilisée »). Mais **pendant** un zoom la vue n'est pas au repos, et
+   * l'estompage, lui, peut être plein depuis longtemps : c'est exactement le cas
+   * d'une DESCENTE. Mesuré dans l'application vivante, descente 1 600 km → 3 km :
+   * **9 456 tuiles demandées, dont 5 081 hors crop — 53,7 %**, presque toutes
+   * sous estompage plein.
+   *
+   * ⚠️ **ET LA GARDE EST L'INVERSE DE CELLE DE LA TÂCHE N** : elle coupe MOINS
+   * souvent qu'elle en altitude (l'estompage n'est plein que sous la bande) et
+   * PLUS souvent en régime (elle ne demande pas le repos). Les deux se cumulent
+   * par un OU, aucune ne remplace l'autre.
+   *
+   * ⚠️ **`uEstompageOn` D'ABORD.** Sans lui, `uEstompage` vaut **1 par défaut**
+   * (voir sa déclaration) : lire la valeur seule couperait le dehors sur une
+   * planète où l'estompage n'a jamais été posé — c'est-à-dire en production.
+   */
+  estompePlein() {
+    const u = this.uniforms
+    return u.uEstompageOn.value > 0.5 && u.uEstompage.value >= 1
   }
 
   /** Retire le crop — le globe redevient entier, parois comprises. */
   retirerCrop() {
     this._crop = null
     this.uniforms.uCropOn.value = 0
     this._melangeCrop(false)
     this.retirerParoisCrop()
     this.retirerHabillage()
     this.retirerRampe()
diff --git a/src/main.js b/src/main.js
index 04ffdf5..b92b1fc 100644
--- a/src/main.js
+++ b/src/main.js
@@ -81,20 +81,21 @@ import { creerVeilleCrop } from './monde/branchement-crop.js'
 // par image relevées dans l'application vivante — voir le §3 du module.
 import { creerVeilleRepos } from './monde/veille-repos.js'
 // ⚠️ `landmarks.js` N'IMPORTE RIEN — c'est ce qui en fait « la seule source de
 // la largeur du socle » (`seuil-socle.js`, §0), et ce qui rend cet import sans
 // risque de cycle depuis `main.js`, qui est en bout de chaîne.
 import { BLOCK_TILES } from './landmarks.js'
 // ⚠️ `exageration-continue.js` N'IMPORTE RIEN — voir son en-tête : passer par
 // `fenetre-bornee.js` fermerait le cycle terrain.js → fenetre-bornee.js →
 // terrain.js, et AUCUN TEST NE CHARGE `main.js` pour l'attraper.
 import { lireExageration, poserExageration, creerExagerationPartagee, majExagerationCran, surchargesStockees, courbeExageration, EXAG_BASE } from './monde/exageration-continue.js'
+import { EXAGERATION_UNIQUE } from './monde/zoom-continu.js'
 // LA FENÊTRE BORNÉE — Tâche 6 ter. ⚠️ Importée ICI et pas dans `terrain.js` :
 // `fenetre-bornee.js` importe `TERRAIN_SIZE` de `terrain.js`, donc l'import
 // inverse fermerait le cycle. `main.js` est en bout de chaîne, il n'en ouvre
 // aucun. Voir `terrain.adopterFenetre`.
 import { construireFenetre, majHauteurs, recadrerFenetre } from './monde/fenetre-bornee.js'
 // ⚠️ **LE FLUX EST LE CACHE DU QUADTREE, PAS UN SECOND CHARGEUR** (Tâche 6
 // quinquies) : `creerFlux` ne demande RIEN à sa naissance, et `remplirBorne`
 // borne le remplissage au débit RÉELLEMENT observé (règle R3, Tâche 4 ter).
 import { creerFlux, zoomEffectif, demanderEmprise, debitObserve, revisionFlux, remplirHauteurs, zoomPourEmprise } from './monde/flux-terrain.js'
 // LA MER DU CROP — Tâche J. ⚠️ **`empriseCalotte` ET `repereCrop` SONT PURS** :
@@ -769,21 +770,54 @@ const params = {
 // garantir qu'aucun écrivain n'est oublié. Il y en a au moins cinq, dispersés —
 // `syncExagToZoom` ici, le curseur de `ui/create-panel.js:419`, les
 // `Object.assign(params, look)` des gabarits, la restauration de lien partagé,
 // et `SHIBU_START`. Une fonction de synchronisation à appeler « partout où il
 // faut » aurait redonné exactement la classe de défaut qu'on ferme. Il n'y a
 // donc **qu'un seul emplacement de stockage** : `exagPartage.valeur`.
 //
 // ⚠️ `exagPartage` est ÉNUMÉRABLE, et c'est voulu : `block-grid.js:1133`
 // fabrique ses voisins par `{ ...params }`, et un damier qui perdrait le
 // partage lirait une valeur figée à l'instant de la copie.
-const exagPartage = creerExagerationPartagee({ surcharges: surchargesStockees() })
+// ══════════ UNE SEULE TERRE — Tâche I, LE BRANCHEMENT ══════════════════════
+//
+// ⚠️ **LU ICI ET NULLE PART AILLEURS.** Le drapeau décide de cinq choses qui
+// doivent s'accorder au caractère près, et un second appel à `terreUniqueActive()`
+// ailleurs dans ce fichier pourrait diverger (l'adresse ne change pas, mais le
+// patron, lui, se recopie) :
+//   1. le bloc plat ne se rallume plus (`poserVisibiliteSocle`, `socleAffiche`) ;
+//   2. l'état de départ de `veilleSocle` dit « pas de bloc », pour que la
+//      première image sous le seuil APPLIQUE l'extinction ;
+//   3. `majSeuilSocle` nourrit `veilleCrop` au lieu de `veilleSocle`, sur la
+//      MÊME altitude et à la MÊME image ;
+//   4. **le globe devient le quatorzième lecteur de l'exagération** ;
+//   5. ⚡ **et cette exagération est une CONSTANTE — D10, Tâche M.** C'est elle,
+//      et rien d'autre, qui supprime le rechargement de la planète entière.
+//
+// ⚠️ **IL EXIGE `?frontiere=1`, et `flags.js` le garde** : sans la passe de fond
+// le globe n'est pas dessiné en mode surface, et creuser un crop dans une
+// planète qu'on ne dessine pas ne montrerait rien.
+//
+// ⚠️ **IL EST DÉCLARÉ ICI, AVANT LE PARTAGE D'EXAGÉRATION ET AVANT LE GLOBE,
+// PARCE QUE LES DEUX LE LISENT.**
+const terreUniqueBranchee = terreUniqueActive()
+
+// ⚠️ **`constante` EST TOUT LE GESTE DE D10, ET IL TIENT EN UN ARGUMENT.**
+// `setExaggeration` (`globe.js`) rend au réseau TOUTES les tuiles prêtes ;
+// `majExageration` ne l'appelle que si la valeur a BOUGÉ. Figer la valeur, c'est
+// donc supprimer le rechargement — **12 s et 21 s mesurées, aller et retour, La
+// Réunion z12** — sans porter le relief dans le nuanceur de sommets. Le portage
+// reste utile un jour (l'exagération redeviendrait un réglage vivant) : il est
+// **DIFFÉRÉ, pas abandonné.**
+const exagPartage = creerExagerationPartagee({
+  surcharges: surchargesStockees(),
+  constante: terreUniqueBranchee ? EXAGERATION_UNIQUE : null,
+})
 params.exagPartage = exagPartage
 // ⚠️ `EXAG_BASE` ET NON `params.demExaggeration` : ce serait un TREIZIÈME
 // lecteur direct, et le test ①a le compterait comme tel — à juste titre, parce
 // qu'il n'y a pas de « lecture innocente » de cette valeur. L'accord entre les
 // deux (2,8 de part et d'autre) est vérifié par `test/fenetre-branchee.test.js`.
 poserExageration(exagPartage, EXAG_BASE)
 Object.defineProperty(params, 'demExaggeration', {
   get: () => exagPartage.valeur,
   set: (v) => { poserExageration(exagPartage, v) },
   enumerable: true,
@@ -4022,40 +4056,29 @@ function altitudeCadrageM() {
 // ⚠️ LE SEUL LECTEUR DE `FLAGS.globeContinu` EST ICI (plan « globe continu »,
 // Tâche 4 Étape 0). `src/globe.js` n'importe pas `flags.js` : il ne connaît
 // qu'un booléen, passé par le constructeur. Sans cette ligne, le drapeau ne
 // protégerait rien et le tri spatial atterrirait sur le globe de production.
 // ⚠️ **MÊME CÂBLAGE POUR `exagContinue` (Tâche E)** : `globe.js` n'importe pas
 // `flags.js` non plus, et sans cette ligne le globe garderait son exagération 18
 // pour toujours — le facteur 6,4 contre le socle, et le bloc DEBOUT que la
 // Tâche B a relevé à l'écran.
 // ══════════ UNE SEULE TERRE — Tâche I, LE BRANCHEMENT ══════════════════════
 //
-// ⚠️ **LU ICI ET NULLE PART AILLEURS.** Le drapeau décide de quatre choses qui
-// doivent s'accorder au caractère près, et un second appel à `terreUniqueActive()`
-// ailleurs dans ce fichier pourrait diverger (l'adresse ne change pas, mais le
-// patron, lui, se recopie) :
-//   1. le bloc plat ne se rallume plus (`poserVisibiliteSocle`, `socleAffiche`) ;
-//   2. l'état de départ de `veilleSocle` dit « pas de bloc », pour que la
-//      première image sous le seuil APPLIQUE l'extinction ;
-//   3. `majSeuilSocle` nourrit `veilleCrop` au lieu de `veilleSocle`, sur la
-//      MÊME altitude et à la MÊME image ;
-//   4. **le globe devient le quatorzième lecteur de l'exagération** — la ligne
-//      juste dessous, et le §ci-après dit pourquoi ce n'est pas un raccourci.
-//
-// ⚠️ **IL EXIGE `?frontiere=1`, et `flags.js` le garde** : sans la passe de fond
-// le globe n'est pas dessiné en mode surface, et creuser un crop dans une
-// planète qu'on ne dessine pas ne montrerait rien.
+// ⚠️ **`terreUniqueBranchee` EST DÉCLARÉ PLUS HAUT, AU PARTAGE D'EXAGÉRATION**
+// (Tâche M, D10 : la constante ×2 se pose à la CONSTRUCTION du partage, sinon le
+// démarrage coûte un rechargement complet de la planète). Le drapeau reste **lu
+// une seule fois dans ce fichier** ; la liste de ce qu'il décide, et pourquoi une
+// seconde lecture divergerait, est écrite à sa déclaration.
 //
-// ⚠️ **IL EST DÉCLARÉ ICI, AVANT LE GLOBE, PARCE QUE LE GLOBE LE LIT.** Un `const`
-// déclaré plus bas serait dans sa zone morte au moment de cette ligne : une
-// `ReferenceError` au démarrage, que ni un test ni `node --check` ne voient.
-const terreUniqueBranchee = terreUniqueActive()
+// ⚠️ **UN `const` DÉCLARÉ ICI SERAIT DANS LA ZONE MORTE** au moment de
+// `creerExagerationPartagee` : une `ReferenceError` au démarrage, que ni un test
+// ni `node --check` ne voient.
 
 // ⚠️ **`terre unique` ENTRAÎNE `exagSuivie`, ET C'EST UNE MESURE À L'ÉCRAN QUI
 // L'A EXIGÉ, PAS UN GOÛT DE SYMÉTRIE.** La Tâche E fait du globe « le
 // quatorzième lecteur » de l'exagération partagée — mais derrière SON drapeau.
 // Le crop branché sans elle garde l'exagération du globe, **18**, contre les
 // **2,8** du socle qu'il remplace : facteur **6,4**. Relevé à La Réunion z12 le
 // 2026-08-21, deux captures au même cadrage (`.banc/vues-I/`) : sans elle un
 // champ d'aiguilles où l'île n'est plus reconnaissable, avec elle le bloc
 // qu'Adrien attend. **Un crop qui remplace le socle doit avoir sa loi de
 // relief** — sinon on ne branche pas le chantier, on le montre cassé.
@@ -5147,20 +5170,43 @@ modes = new Modes({
     // grille de tuiles, donc son emprise diffère de quelques pour cent. Elle
     // sert à CHOISIR le niveau ; la distance, elle, se recalcule ensuite sur
     // `echelleVerticaleBloc()`, l'échelle vraie.
     echelleVerticaleAuZoom(zoom, lat = params.demLat) {
       return echelleBloc({
         extentMeters: empriseBlocM({ zoom, lat }),
         span: TERRAIN_SIZE,
         exageration: exagForZoom(zoom),
       })
     },
+    // ══════════ LES TROIS CROCHETS DU ZOOM CONTINU — Tâche M ════════════════
+    //
+    // ⚠️ **`modes.js` NE PEUT PAS LES CALCULER.** L'emprise du bloc vit dans la
+    // fenêtre bornée (`largeurBlocM`), pas dans la machine à modes, et le côté du
+    // bloc est une constante de `terrain.js`. Ce sont les MÊMES grandeurs que
+    // `majCameraFond()` passe à la similitude vingt lignes plus haut : la caméra
+    // de fond et la caméra du bloc décident donc sur le même couple, sans quoi la
+    // conversion d'unités et la pose du fond diraient deux choses différentes.
+    empriseBlocM: () => (params.source === 'real' ? largeurBlocM() : 0),
+    // L'emprise d'un niveau **qu'on n'a pas encore chargé** — même rôle
+    // qu'`echelleVerticaleAuZoom` pour la plongée, mais SANS l'exagération :
+    // c'est l'emprise horizontale, celle que la similitude emploie.
+    empriseBlocMAuZoom: (zoom, lat = params.demLat) => empriseBlocM({ zoom, lat }),
+    // ⚠️ **`TERRAIN_SIZE` ET PAS `terrain._span()`** : c'est le couple qu'emploient
+    // déjà `altitudeCadrageM()` et `majCameraFond()`. Deux conventions d'échelle
+    // dans le même fichier divergeraient en silence.
+    coteBloc: () => TERRAIN_SIZE,
+    // ⚡ **LE RÉGIME CONTINU — LU UNE FOIS, PASSÉ PAR UNE FONCTION.** `modes.js`
+    // n'importe pas `flags.js` ; sans cette ligne, tout le travail de la Tâche M
+    // serait du code qui ne s'exécute jamais, et c'est **la faiblesse récurrente
+    // de ce chantier** (quatre tâches d'affilée ont vu leurs mutations de
+    // branchement survivre).
+    zoomContinu: () => terreUniqueBranchee,
     // ══════════ ELLE REND LA MAIN DÈS QUE LA FENÊTRE EST POSÉE ══════════════
     //
     // ⚠️ **C'EST LA DERNIÈRE MARCHE DU PIVOT, ET ELLE ARRIVE EN DERNIER POUR UNE
     // RAISON** : le §5 de `/threejs-optimisation` — un correctif juste appliqué
     // dans le mauvais ordre se mesure comme une régression. Tant que l'échelle
     // verticale, l'altitude de cadrage, la visée et sa réciproque lisaient
     // `dem`, rendre la main tôt aurait donné un relief au bon palier sous des
     // repères restés au précédent. Elles lisent toutes la fenêtre maintenant.
     //
     // ⚠️ **`demBusy` NE SÉRIALISE PLUS RIEN, ET C'EST VOULU.** Il retombe dès que
@@ -5326,21 +5372,32 @@ modes = new Modes({
 
 const gotoCtl = createGoto({
   modes,
   announce: (m) => modes.announce(m),
   getFineZoom: () => userFineZoom,
   onTarget: (t) => setRegionTarget(t),
 })
 
 // vertical zoom stepper (left edge) — discrete alternative to the wheel; reads
 // live staircase/orbit state each frame, only triggers modes.stepFiner/Wider
-const zoomStepper = buildZoomStepper({
+// ⛔ **ET SOUS `?terre=unique` IL N'EXISTE PAS — Tâche M.** Adrien : *« on
+// supprime toutes les zones »*, *« vire absolument ton système de saut de
+// niveau »*. `ORB` et `Z{n}` sont les DEUX étiquettes de l'escalier de paliers ;
+// les garder au-dessus d'un zoom devenu continu afficherait un niveau qui ne
+// décrit plus rien — la caméra passe désormais entre les niveaux sans s'y poser.
+//
+// ⚠️ **CE QUI EST PERDU EST NOMMÉ ICI, ET C'EST LE PRIX** : les deux boutons
+// `+` / `−` partent avec l'étiquette, donc il n'y a plus de zoom discret au
+// doigt sous ce drapeau. `modes.cranZoom(±1)` existe et applique la loi mesurée
+// (×√2) — **il n'a plus d'appelant d'IHM sur ce chemin, et c'est une réserve du
+// rapport, pas un oubli.**
+const zoomStepper = terreUniqueBranchee ? null : buildZoomStepper({
   modes,
   getState: () => modes.mode === 'orbital'
     ? { label: 'ORB', canFiner: true, canWider: true, busy: modes.busy || !!modes.travel }
     : {
         label: `Z${params.demZoom}`,
         canFiner: params.source === 'real' && !!dem && params.demZoom < userFineZoom,
         canWider: true, // surface always widens (coarsen, then the orbit gate)
         busy: modes.busy,
       },
 })
@@ -11508,21 +11565,21 @@ function tick() {
   }
 
   // mode machine: altitude thresholds, glides, altimeter; globe LOD streaming.
   // SUSPENDED during GPX follow: the rail legitimately flies low over the
   // relief, and the mode machine read that as "zooming against the near
   // stop" and fired REFINE transitions mid-playback — whiteout, terrain
   // reload, arrival re-pose. That is the "elle switch d'une vue à l'autre,
   // décroche totalement" field bug, and it clobbered EVERY camera rig alike,
   // which is why six rewrites changed nothing on screen.
   if (!(drone.active && params.gpxFollow && gpxLayer.isPlaying())) modes.update(dt)
-  zoomStepper.update()
+  zoomStepper?.update()
   // ══════ LE SEUIL DU SOCLE — Tâche 3, branchée ══════════════════════
   //
   // ⚠️ **APRÈS `modes.update(dt)`, ET AVANT `majCameraFond()`.** Après, parce
   // que c'est `modes` qui vient de poser la caméra de cette image et le mode ;
   // avant, parce que la caméra de fond se pose sur la MÊME emprise que le bloc
   // — c'est elle qui fait que la Terre apparaît exactement là où le socle
   // était, sans saut, quand le seuil le retire.
   majSeuilSocle()
   // ══════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G ════════════════════
   //
diff --git a/src/modes.js b/src/modes.js
index 5f9bcbe..e989654 100644
--- a/src/modes.js
+++ b/src/modes.js
@@ -26,20 +26,35 @@ import {
   altitudeOrbitaleM,
   altitudeSortieOrbiteM,
   distanceArrivee,
   distanceMinOrbitale,
   distancePourAltitude,
   distancePresentation,
   niveauDePlongee,
   planProche,
   poseCranContinu,
 } from './loi-altitude.js'
+// LE ZOOM CONTINU — Tâche M, « la mort des paliers ». Module PUR lui aussi ; il
+// porte la loi mesurée par Adrien (un cran = ×√2), le franchissement de niveau
+// sans table, et le changement d'unités qui rend ce franchissement invisible.
+// ⚠️ **`modes.js` N'IMPORTE PAS `flags.js`** : il ne connaît le régime que par le
+// crochet `hooks.zoomContinu()`, comme `globe.js` ne connaît `globeContinu` que
+// par son constructeur.
+import {
+  PAS_CRAN,
+  PAS_NIVEAU,
+  facteurCran,
+  franchissement,
+  poseApresNiveau,
+  distancePourAltitudeFond,
+  niveauDArrivee,
+} from './monde/zoom-continu.js'
 
 // Le pincement fabrique un faux événement de molette. _zoomGesture appelle
 // preventDefault() sur plusieurs branches ; côté tactile, le vrai événement a
 // déjà été traité au-dessus (c'est le pincement reconnu qui décide), donc ces
 // branches n'ont plus rien à annuler.
 const NOOP = () => {}
 
 // ordered fine → coarse; zoom null = the user's fine zoom (≥ 12).
 // Every stop on the way down lands on a matching real-terrain block instead of
 // the globe: z7 @ 600 km, then the regional/local tiers. Corsica-sized views
@@ -161,30 +176,57 @@ const WHEEL_GAP_MS = 220 // a wheel event this long after the last starts a FRES
 //     plancher, l'altitude est continue, et l'arrivée à z15 tombe à 418 m —
 //     contre 487 m par l'ancien escalier téléporté.
 //
 // ⚠️ ET L'ENTRÉE ET LA SORTIE DOIVENT ÊTRE ÉGALES, sinon l'aller-retour
 // CLIQUETTE. Mesuré : avec 1,2 en entrée et 0,55 en sortie, un cran de zoom
 // suivi d'un cran de dézoom rend 14 326 m là où on était parti de 27 696 m —
 // on revient DEUX FOIS PLUS BAS qu'avant d'avoir zoomé. À budgets égaux, le
 // même aller-retour rend 26 876 m (×0,970, le résidu venant du `y = −0,3` de la
 // cible). L'ancien escalier ne cliquettait pas parce que la téléportation
 // remettait les deux directions au même point de présentation.
-export const STEP_IN = Math.LN2 // max zoom-IN per level (= UN cran, ×2) before the in-limit
-export const STEP_OUT = Math.LN2 // idem en dézoom — l'aller-retour doit revenir au point de départ
+// ⛔ **ET CES DEUX-LÀ CONFONDAIENT DEUX GRANDEURS — Tâche M, D9.** Le paragraphe
+// ci-dessus est juste sur UN point (le budget d'un NIVEAU DE MNT vaut `ln 2`,
+// parce qu'un cran de zoom slippy divise l'emprise de la tuile par deux) et faux
+// sur l'autre : il en concluait que le CRAN valait `ln 2` aussi.
+//
+// **Dix-neuf altitudes relevées par Adrien dans Google Earth**, 63 170 km →
+// 126 km, 18 intervalles : **moyenne géométrique ×1,41256**, soit **√2 à 0,12 %
+// près**. ➡️ **Un cran vaut ×√2, pas ×2.** La justification complète, l'écart-type
+// et le piège de la « loi de moins en moins forte » vivent dans
+// `monde/zoom-continu.js`.
+//
+// ⚠️ **LES DEUX NOMBRES RESTENT, MAIS SÉPARÉS** : `STEP_IN`/`STEP_OUT` sont LE
+// CRAN (le geste de l'utilisateur, libre, mesuré) ; `BUDGET_NIVEAU` est le
+// NIVEAU DE MNT (la grille de tuiles, pas un réglage). C'est leur confusion qui
+// valait « deux fois trop ».
+export const STEP_IN = PAS_CRAN // UN CRAN, ×√2 — la loi mesurée (D9)
+export const STEP_OUT = PAS_CRAN // idem en dézoom — l'aller-retour doit revenir au point de départ
+
+// LE BUDGET D'UN NIVEAU DE MNT. ⚠️ **Il n'est pas libre** : un niveau divise
+// l'emprise du bloc par deux, donc `ln 2` de distance et rien d'autre. C'est lui
+// que le glissé de l'ESCALIER borne (chemin plat) et lui que le franchissement
+// automatique compte (chemin continu).
+export const BUDGET_NIVEAU = PAS_NIVEAU
 
 // ⚠️ « AU MOINS 20 CRANS » EST UNE CONTRAINTE D'ADRIEN, PAS UN EFFET DE BORD.
 // Un défilement continu délivre `N × ZOOM_IMPULSE × ZOOM_TAU` de distance
 // logarithmique : le niveau valait 1,2 / (0,05 × 1,2) = 20 crans de molette.
 // Le budget ayant changé, l'impulsion est désormais DÉRIVÉE de lui pour que ce
 // 20 ne bouge pas — la valeur littérale (0,05) l'aurait fait tomber à 11,5.
+// ⚠️ **ET C'EST LE NIVEAU QUI LE DÉRIVE, PAS LE CRAN — Tâche M.** Le cahier des
+// charges le dit : *« Le réglage porte sur le CRAN, pas sur le tour de molette :
+// le nombre de crans par tour dépend de la souris. »* Dériver l'impulsion du
+// cran aurait divisé la molette par deux au passage, ce que personne n'a
+// demandé ; la dériver du niveau laisse la molette **au bit près** ce qu'elle
+// était.
 const CRANS_PAR_NIVEAU = 20
-const ZOOM_IMPULSE = STEP_IN / (CRANS_PAR_NIVEAU * ZOOM_TAU) // ≈ 0,0289 log-dist/s par cran
+const ZOOM_IMPULSE = BUDGET_NIVEAU / (CRANS_PAR_NIVEAU * ZOOM_TAU) // ≈ 0,0289 log-dist/s par cran
 
 // task 30 Fix A: the isometric-ish viewing angle every dive/refine arrival
 // has always used (camera.position(0,18,19), looking at (0,-0.3,0)) — kept
 // as a fixed DIRECTION so the new far-standoff arrival (_arrivalPose()
 // below) still frames the block the same way, just from farther back.
 const _ARRIVAL_DIR = new THREE.Vector3(0, PENTE_ARRIVEE.y, PENTE_ARRIVEE.z).normalize()
 
 export class Modes {
   /**
    * hooks: {
@@ -212,21 +254,22 @@ export class Modes {
     this.orbAlt = 0 // orbital altitude in scene units (current)
     this.orbAltTarget = 0
     this.busy = false
     this.locked = false // embed « zone de test » : molette neutralisée (voir wheel)
     this.travel = null // great-circle glide tween
     this._surfCam = { near: camera.near, far: camera.far }
     this._zoomVel = 0 // surface inertial dolly velocity (log-dist units/s)
     this._zoomNdc = new THREE.Vector2() // cursor NDC of the last wheel notch
     this._zoomPivot = null // world point the coast zooms toward (last valid)
     this._lastWheelT = 0 // ms of the last wheel event — a big gap means a fresh gesture
-    this._levelZoom = 0 // log-distance zoomed within the level; clamped to [-STEP_IN, STEP_OUT]
+    this._levelZoom = 0 // log-distance dépensée dans le niveau ; COMPTEUR sous le drapeau, butée sinon
+    this._empriseVue = null // l'emprise du bloc à l'image précédente — voir _suivreEmprise
 
     this._buildDom()
 
     // orbital zoom is proportional to altitude (Google-Earth feel) — we take
     // over the wheel entirely while in orbit
     domElement.addEventListener('wheel', (e) => this._zoomGesture(e), { passive: false })
 
     // LE DOIGT emprunte le MÊME escalier que la molette. Un pincement n'est pas
     // traduit en dolly : gestes.js le convertit en crans de molette, et ils entrent
     // par _zoomGesture — donc mêmes paliers de relief, mêmes butées, même élan.
@@ -247,20 +290,182 @@ export class Modes {
         if (e.cancelable) e.preventDefault()
         this._zoomGesture({ deltaY: m.deltaY, clientX: m.clientX, clientY: m.clientY, preventDefault: NOOP })
       },
       { passive: false }
     )
     const finDuGeste = (e) => { if (e.touches.length < 2) this._pinch.end() }
     domElement.addEventListener('touchend', finDuGeste, { passive: true })
     domElement.addEventListener('touchcancel', finDuGeste, { passive: true })
   }
 
+  // ══════════ LE RÉGIME CONTINU — Tâche M ═══════════════════════════════════
+  //
+  // ⚠️ **UN CROCHET, RAPPELÉ À CHAQUE LECTURE — PAS UN BOOLÉEN FIGÉ À LA
+  // CONSTRUCTION.** Une tâche de ce chantier a trouvé un test faible qui passait
+  // le globe PAR SA VALEUR alors que la production le passe PAR UNE FONCTION :
+  // la faute était invisible sous la seule forme que la production n'emploie
+  // pas. Ici la production passe une fonction, et les bancs aussi.
+  _continu() {
+    return this.hooks.zoomContinu?.() === true
+  }
+
+  // L'ALTITUDE QUE LA CAMÉRA DE FOND OCCUPE, EN MÈTRES — `camY × emprise / span`.
+  //
+  // ⚠️ **C'EST LA SEULE GRANDEUR DONT UN SAUT SE VOIT À L'ÉCRAN** sous
+  // `?terre=unique` : la caméra visible est celle que la similitude de
+  // `monde/frontiere-rendu.js` produit, et son facteur est HORIZONTAL. Les deux
+  // autres altitudes de ce fichier (`this.altM`, `_altitudeCadrageM()`) portent
+  // l'exagération verticale, donc elles ne la voient pas.
+  _altitudeFondM() {
+    const emprise = this.hooks.empriseBlocM?.()
+    const span = this.hooks.coteBloc?.()
+    if (!(emprise > 0) || !(span > 0)) return null
+    return (this.camera.position.y * emprise) / span
+  }
+
+  // ══════════ LA CAMÉRA SUIT L'UNITÉ DU BLOC, IMAGE PAR IMAGE ══════════════
+  //
+  // ⚠️ **C'EST ICI ET PAS DANS `_rescale`, ET LA RAISON EST MESURÉE.** Le dépôt
+  // reposait la caméra APRÈS le chargement ; or `main.js` documente, journal par
+  // image à l'appui, que **`largeurBlocM()` est divisée par deux UNE IMAGE AVANT
+  // que `_rescale` ne double `camera.position.y`**. Entre les deux, l'altitude
+  // lue vaut exactement LA MOITIÉ de la vraie — c'est ce qui a produit **onze
+  // bascules du seuil du socle au lieu d'une**, et sous `?terre=unique` cela
+  // ferait clignoter la planète entière à chaque cran.
+  //
+  // En suivant l'emprise image par image, la conversion tombe sur la MÊME image
+  // que le changement, **quel qu'en soit l'auteur** : cran, plongée, vol,
+  // template, ou l'arrivée du MNT derrière la fenêtre (écart mesuré 6,9·10⁻⁵ à
+  // z12, 3,5 % à z5 — un vrai changement d'unité, pas du bruit).
+  //
+  // ⚠️ **ET C'EST UNE CONVERSION D'UNITÉS, PAS UNE REPOSITION.** L'invariant est
+  // `camY × emprise`, c'est-à-dire l'altitude que la caméra de FOND occupe. La
+  // pente traverse inchangée : l'angle de vue de l'utilisateur est gardé.
+  _suivreEmprise() {
+    const emprise = this.hooks.empriseBlocM?.()
+    const avant = this._empriseVue
+    if (!(emprise > 0)) { this._empriseVue = null; return }
+    this._empriseVue = emprise
+    if (!this._continu() || this.mode !== 'surface' || !(avant > 0) || avant === emprise) return
+    const c = this.controls
+    const cible = c.target
+    _zoomDir.copy(this.camera.position).sub(cible)
+    const norme = _zoomDir.length()
+    if (!(norme > 1e-6)) return
+    _zoomDir.multiplyScalar(1 / norme)
+    if (Math.abs(_zoomDir.y) < 1e-3) return // vue rasante : la pente ne porte plus rien
+    const pose = poseApresNiveau({
+      camY: this.camera.position.y,
+      pente: _zoomDir.y,
+      empriseAvant: avant,
+      empriseApres: emprise,
+      yCible: cible.y,
+    })
+    const borne = THREE.MathUtils.clamp(pose.distanceCible, c.minDistance, c.maxDistance)
+    this.camera.position.copy(cible).addScaledVector(_zoomDir, borne)
+    c.update()
+  }
+
+  // Le niveau d'arrivée, DÉDUIT de l'altitude de fond — sans table de paliers.
+  _niveauDArrivee(altM) {
+    const empriseAuZoom = this.hooks.empriseBlocMAuZoom
+    const span = this.hooks.coteBloc?.()
+    if (typeof empriseAuZoom !== 'function' || !(span > 0)) return null
+    return niveauDArrivee({
+      altM,
+      empriseAuZoom,
+      span,
+      zoomMax: this.hooks.getFineZoom(),
+      pente: _ARRIVAL_DIR.y,
+      yCible: Y_CIBLE,
+      distanceMin: DISTANCE_MIN_SURFACE,
+      // ⚠️ **LA MOITIÉ DU PLAFOND, ET CE N'EST PAS UNE MARGE DE CONFORT.**
+      // Un niveau s'explore de `d₀/2` (on affine) à `2 d₀` (on élargit) : sans
+      // ce demi, `2 d₀` dépasserait `maxDistance` et le glissé se ferait CLIPPER
+      // avant d'avoir dépensé son niveau — la butée reviendrait par la fenêtre,
+      // en haut cette fois. Le 0,94 est celui de `distanceArrivee` et pour la
+      // même raison écrite là-bas : rester sous la butée dure pour que
+      // `controls.update()` ne re-clampe pas immédiatement.
+      distanceMax: distanceArrivee(this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE) / 2,
+    })
+  }
+
+  // ══════════ LE FRANCHISSEMENT AUTOMATIQUE — CE QUI TUE LE CRAN ════════════
+  //
+  // ⛔ **C'EST LE GESTE QUE LE DÉPÔT DEMANDAIT À L'UTILISATEUR DE FAIRE.** Le
+  // glissé butait sur le budget du niveau, rendait la main, et il fallait
+  // **re-défiler** pour franchir (`atInLimit` → `_refine`). Adrien : *« vire
+  // absolument ton système de saut de niveau !!! »*
+  //
+  // Ici le budget n'est plus une butée mais un COMPTEUR : dès qu'il vaut un
+  // niveau plein, on franchit, et le compteur repart de son reste. L'hystérésis
+  // est celle de la troncature (`franchissement`), donc symétrique et sans
+  // seuil à régler.
+  _franchirSiBesoin() {
+    if (!this._continu() || this.busy || this.travel || this._diveTween) return
+    const { niveaux, reste } = franchissement(this._levelZoom, BUDGET_NIVEAU)
+    if (niveaux === 0) return
+    if (niveaux > 0) {
+      // ⚠️ **ON NE DÉPENSE LE BUDGET QUE SI LE NIVEAU EXISTE.** Au zoom fin il
+      // n'y a plus rien à affiner : laisser le compteur courir est CORRECT — il
+      // faudra le remonter d'autant pour élargir, et l'aller-retour reste
+      // symétrique. Le retrancher rendrait le retour asymétrique.
+      if (!this.hooks.getRefineTarget()) return
+      this._levelZoom = reste
+      this._refine()
+      return
+    }
+    if (this.hooks.getCoarsenTarget()) {
+      this._levelZoom = reste
+      this._coarsen()
+      return
+    }
+    // plus de niveau plus large : la porte orbitale, et elle est SANS RIDEAU
+    this._levelZoom = reste
+    this.enterOrbit()
+  }
+
+  // ══════════ UN CRAN, ET UN SEUL GESTE POUR LES DEUX MONDES ════════════════
+  //
+  // ⛔ **`_orbitNotch` EST MORT AVEC SON 1,7.** Ce facteur n'avait aucune source :
+  // il était choisi. Le cran vaut ×√2 — mesuré par Adrien sur Google Earth — et
+  // c'est la MÊME loi en orbite et en surface, ce qui est la moitié de « une
+  // seule caméra, de l'orbite au sol ».
+  cranZoom(dir) {
+    if (this.busy || this.travel || this._diveTween) return
+    const f = facteurCran(dir)
+    if (this.mode === 'orbital') {
+      if (dir > 0) this._diveArmed = true // inward intent arms the dive, like the wheel
+      this.orbAltTarget = THREE.MathUtils.clamp(
+        this.orbAltTarget * f,
+        ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
+        MAX_ALT_M / ORBITAL_M_PER_UNIT
+      )
+      return
+    }
+    if (!this._continu()) {
+      // chemin plat (sauvegarde gelée) : le bouton garde l'escalier de paliers
+      if (dir > 0) this._refine()
+      else if (this.hooks.getCoarsenTarget()) this._coarsen()
+      else this.enterOrbit()
+      return
+    }
+    const c = this.controls
+    const dist = c.getDistance()
+    const nouvelle = THREE.MathUtils.clamp(dist * f, c.minDistance, c.maxDistance)
+    this._levelZoom += Math.log(Math.max(nouvelle, 1e-6) / Math.max(dist, 1e-6))
+    _zoomDir.copy(this.camera.position).sub(c.target).normalize()
+    this.camera.position.copy(c.target).addScaledVector(_zoomDir, nouvelle)
+    c.update()
+    this._franchirSiBesoin()
+  }
+
   // UN cran de zoom, d'où qu'il vienne — molette ou pincement. `e` doit porter
   // deltaY, clientX, clientY et preventDefault().
   _zoomGesture(e) {
     // boutique/embed « zone de test » (Adrien) : le visiteur zoome et
     // dézoome LIBREMENT dans 100 % du budget de zoom du niveau (le glissé
     // inertiel se clampe tout seul, voir _applyZoom) — mais ne peut JAMAIS
     // franchir un niveau ni changer de zone : les branches refine/coarsen/
     // orbit sont neutralisées plus bas. flyTo n'est pas bridé (c'est lui
     // qui pose la zone et les vues iso).
     if (this.locked && this.mode !== 'surface') { e.preventDefault(); return }
@@ -278,22 +483,28 @@ export class Modes {
       if (this.hooks.cadrageWheel?.(e.deltaY)) { e.preventDefault(); return }
       if (this._diveTween || this.busy) return
       e.preventDefault()
       const now = performance.now()
       const fresh = now - this._lastWheelT > WHEEL_GAP_MS // a new gesture, not a continuous scroll
       this._lastWheelT = now
       const dist = this.controls.getDistance()
       const inward = e.deltaY < 0
       // "at the zone limit" = the level's zoom budget is spent (or the
       // physical near stop / far stop is reached anyway)
-      const atInLimit = this._levelZoom <= -STEP_IN + 0.03 || dist <= this.controls.minDistance * 1.02 || this.hooks.nearGround?.()
-      const atOutLimit = this._levelZoom >= STEP_OUT - 0.03 || dist >= this.controls.maxDistance * 0.98
+      // ⛔ **SOUS LE DRAPEAU, LES DEUX BUTÉES N'EXISTENT PLUS — Tâche M.** Elles
+      // SONT le cran qu'Adrien décrit : le glissé s'arrêtait au bout du niveau
+      // et il fallait re-défiler pour franchir. Le franchissement est désormais
+      // automatique (`_franchirSiBesoin`, appelé par `_applyZoom`), donc ces deux
+      // branches n'ont plus rien à déclencher.
+      const continu = this._continu()
+      const atInLimit = !continu && (this._levelZoom <= -BUDGET_NIVEAU + 0.03 || dist <= this.controls.minDistance * 1.02 || this.hooks.nearGround?.())
+      const atOutLimit = !continu && (this._levelZoom >= BUDGET_NIVEAU - 0.03 || dist >= this.controls.maxDistance * 0.98)
       // GUARD-RAIL (Adrien): the glide stops at the zone limit; a FRESH
       // re-scroll while already pinned there is what steps to the next level.
       if (fresh && inward && atInLimit) {
         if (this.locked) return // zone de test : on butte au plancher, pas de plongée
         this._resetZoom()
         this._refine()
         return
       }
       if (fresh && !inward && atOutLimit) {
         if (this.locked) return // zone de test : on butte au plafond, ni recul ni orbite
@@ -348,38 +559,50 @@ export class Modes {
     this.whiteEl = white
   }
 
   announce(text) {
     this.msgEl.textContent = text
     this.msgEl.classList.remove('hidden')
     clearTimeout(this._msgTimer)
     this._msgTimer = setTimeout(() => this.msgEl.classList.add('hidden'), MSG_MS)
   }
 
+  // ⛔ **LE RIDEAU EST LE SAUT LE PLUS VISIBLE DE TOUS — 480 ms d'aller, 480 ms
+  // de retour, à chaque traversée.** Il n'était pas l'ornement du saut, il était
+  // là parce que le saut était invisible autrement (`_rescale` le dit déjà de son
+  // côté). Sous `?terre=unique` il n'y a plus qu'une Terre des deux côtés de la
+  // traversée : il n'a plus rien à masquer, et Adrien : « je ne veux aucun saut ».
   _whiteout(swap) {
+    if (this._continu()) return Promise.resolve().then(swap)
     return new Promise((resolve) => {
       this.whiteEl.classList.add('on')
       setTimeout(async () => {
         await swap()
         this.whiteEl.classList.remove('on')
         setTimeout(resolve, 480)
       }, 480)
     })
   }
 
   // ---------------------------------------------------------------- surface → orbital
 
   async enterOrbit(entryAltM = null) {
     if (this.mode !== 'surface' || this.busy) return
     this._resetZoom()
     // continuity: pop out at the altitude the surface view actually had, so a
     // z8 patch hands over at ~500 km and a z12 patch at ~30 km
+    // ⚠️ **SOUS LE DRAPEAU, ON SORT À L'ALTITUDE EXACTE — pas 15 % au-dessus.**
+    // Le `× 1,15` d'`altitudeSortieOrbiteM` existait pour repasser la porte de
+    // plongée sans y retomber ; la porte est maintenant géométrique et
+    // `_diveArmed` suffit à ne pas replonger. Un 15 % de recul serait un saut,
+    // et c'est exactement ce qu'Adrien refuse.
+    if (entryAltM == null && this._continu()) entryAltM = this._altitudeFondM()
     if (entryAltM == null) {
       // pop out just above the block's own altitude; a coarse z4 continental
       // block (~7 500 km up) hands over above the 8 000 km globe gate
       // ⚠️ RÈGLE R1 : c'est une décision de CADRAGE, elle lit donc l'altitude
       // GÉOMÉTRIQUE — celle qui ne contient ni `dem.meanM` ni l'exagération
       // verticale. `surfaceCamAltMeters()` (l'altimètre) porte les deux ; le
       // hook de cadrage, lui, n'en porte aucun. Voir main.js et le §2 du plan.
       entryAltM = altitudeSortieOrbiteM(this._altitudeCadrageM())
     }
     // an explicit altitude must respect the orbit ceiling too, or the camera
@@ -403,20 +626,21 @@ export class Modes {
       this._diveArmed = false // require an inward zoom before re-diving
       latLonToSphere(lat, lon, R_GLOBE + this.orbAlt, this.camera.position)
       this.controls.target.set(0, 0, 0)
       this._poseButees('orbital') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
       this.controls.maxPolarAngle = Math.PI
       this.controls.enableZoom = false // wheel handled by us
       this.controls.enablePan = false
       this.camera.up.set(0, 1, 0)
       this.camera.lookAt(0, 0, 0)
       this.controls.update()
+      this._empriseVue = null // on quitte l'espace du bloc : plus d'unité à suivre
       this.mode = 'orbital'
     })
     this.busy = false
   }
 
   // ---------------------------------------------------------------- orbital → surface
 
   // task 30 Fix A: "on se retrouve très souvent le nez dans la paroi quand on
   // passe au zoom inférieur" — every dive/refine arrival used to land the
   // camera at a FIXED close standoff (~26 world units: position(0,18,19)
@@ -482,26 +706,41 @@ export class Modes {
   // DEUX inconnues (le niveau et la distance), `niveauDePlongee` les résout
   // ensemble — le niveau le plus fin dont la distance tient sous le plafond.
   //
   // `zoomImpose` : un zoom DÉSIGNÉ par l'utilisateur (clic sur le globe, cadrage
   // GPX de `flyTo`) reste imposé. Le geste choisit un cadrage, il ne le déduit
   // pas — et sa distance est alors bornée, donc le saut peut subsister. C'est
   // assumé et écrit dans le plan.
   _niveauDePlongee(altM, zoomImpose = null) {
     const echelleAuZoom = this.hooks.echelleVerticaleAuZoom
     const zoomFin = this.hooks.getFineZoom()
+    // Le geste qui DÉSIGNE garde son niveau — clic sur le globe, cadrage GPX.
+    if (zoomImpose != null) return { zoom: zoomImpose, distanceCible: null }
+    // ⛔ **PLUS DE TABLE SOUS LE DRAPEAU.** `DIVE_TIERS` posait NEUF paliers
+    // d'altitude à la main ; ici le niveau se déduit de l'emprise, et la porte
+    // orbitale devient géométrique.
+    //
+    // ⚠️ **ET IL PASSE AVANT LA GARDE D'`echelleVerticaleAuZoom` — TROUVÉ PAR LE
+    // BANC, PAS PAR LA RELECTURE.** Cette branche-ci ne lit PAS l'échelle
+    // verticale (c'est tout son objet : l'exagération n'entre plus dans la
+    // traversée). La laisser sous une garde qui exige un crochet qu'elle
+    // n'emploie pas la rendait muette dès qu'il manquait — et le repli était le
+    // ZOOM FIN, c'est-à-dire une plongée à z15 depuis 1 600 km.
+    if (this._continu()) {
+      const n = this._niveauDArrivee(altM)
+      if (n) return { zoom: n.zoom, distanceCible: n.distanceCible }
+    }
     if (typeof echelleAuZoom !== 'function' || !(altM > 0)) {
       // pas d'échelle à lire : on retombe sur la pose d'arrivée d'avant, jamais
       // sur une distance inventée (même garde que `_rescale`).
-      return { zoom: zoomImpose ?? zoomFin, distanceCible: null }
+      return { zoom: zoomFin, distanceCible: null }
     }
-    if (zoomImpose != null) return { zoom: zoomImpose, distanceCible: null }
     return niveauDePlongee({
       altM,
       echelleAuZoom,
       zoomMax: zoomFin,
       distanceMin: DISTANCE_MIN_SURFACE,
       distanceMax: this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE,
     })
   }
 
   // relief produces) but a real guarantee rather than an assumption.
@@ -519,20 +758,47 @@ export class Modes {
   // ⚠️ L'ÉCHELLE SE LIT APRÈS LE CHARGEMENT, exactement comme `_rescale` le
   // fait depuis la Tâche 2 bis. `_niveauDePlongee` a choisi le niveau sur une
   // ESTIMATION (l'emprise théorique du zoom au lat/lon demandé) ; le bloc réel
   // est calé sur la grille de tuiles et son emprise en diffère un peu. La
   // distance, elle, se calcule sur l'échelle VRAIE — sinon on rendrait un saut
   // de quelques pour cent au lieu d'un saut de ×1,765.
   //
   // Sans le hook (banc de test, source procédurale) : la pose fixe d'avant,
   // jamais une distance inventée.
   _posePlongee(arrival, altDepartM) {
+    // ⛔ **LE DÉPÔT CONSERVAIT L'AUTRE ALTITUDE, ET `loi-altitude.js` LE SAVAIT** :
+    // *« le CHAMP VISUEL, lui, saute encore d'un facteur exagération(z) […] C'est
+    // une question, pas un oubli. »* Sous `?terre=unique` la question a une
+    // réponse, parce qu'il n'y a plus deux mondes à raccorder mais un seul : de
+    // l'autre côté de la traversée c'est la MÊME planète, donc c'est l'altitude
+    // de FOND qui doit être continue. **Le saut valait ×2,5 à ×5 selon le palier
+    // d'exagération, et il vaudrait encore ×2 sous D10.**
+    if (this._continu()) {
+      const d = distancePourAltitudeFond({
+        altM: altDepartM,
+        extentMeters: this.hooks.empriseBlocM?.(),
+        span: this.hooks.coteBloc?.(),
+        pente: _ARRIVAL_DIR.y,
+        yCible: arrival.target.y,
+      })
+      if (d != null) {
+        const dist = THREE.MathUtils.clamp(
+          d,
+          this.controls.minDistance,
+          this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
+        )
+        const p = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
+        const seuil = this._solSous(arrival.target) + 3 // même garde de dégagement
+        if (p.y < seuil) p.y = seuil
+        return p
+      }
+    }
     const echelleV = this.hooks.echelleVerticaleBloc?.() ?? null
     if (!(echelleV > 0) || !(altDepartM > 0)) return arrival.pos
     const brute = distancePourAltitude({ altM: altDepartM, echelleV, yCible: arrival.target.y })
     const dist = THREE.MathUtils.clamp(
       brute,
       this.controls.minDistance,
       this.hooks.surfaceMaxDistance?.() ?? DISTANCE_MAX_SURFACE
     )
     const pos = arrival.target.clone().addScaledVector(_ARRIVAL_DIR, dist)
     const minY = this._solSous(arrival.target) + 3 // même garde de dégagement qu'`_arrivalPose`
@@ -598,20 +864,25 @@ export class Modes {
       this.camera.far = this._surfCam.far
       // ⚠️ `camera.up` NE BASCULE PAS, ET LE PLAN SE TROMPAIT. Rejoué contre le
       // dépôt : `enterOrbit` écrit `camera.up.set(0, 1, 0)` lui aussi. Les deux
       // modes ont toujours eu le MÊME repère vertical — la ligne était un
       // no-op, elle disparaît. (Le repère de POSITION, lui, change bel et bien ;
       // c'est l'Étape 2, la frontière globe/terrain, et elle n'est pas faite.)
       const arrival = this._arrivalPose({ lat, lon })
       this.controls.target.copy(arrival.target)
       this._poseButees('surface') // ⚠️ UN SEUL SITE écrit minDistance — Tâche 1b
       this.camera.position.copy(this._posePlongee(arrival, altDepartM))
+      // ⚠️ **L'EMPRISE D'ARRIVÉE EST MÉMORISÉE ICI, ET SANS ÇA LA PLONGÉE SE
+      // FERAIT CONVERTIR DEUX FOIS** : `_suivreEmprise` verrait passer l'emprise
+      // du bloc quitté à celle du bloc d'arrivée et rejouerait un changement
+      // d'unités que `_posePlongee` vient déjà d'appliquer.
+      this._empriseVue = this.hooks.empriseBlocM?.() ?? null
       // `near` DÉRIVÉ, plus restauré : c'est la même loi qu'en orbite
       // (`planProche`), appliquée à la hauteur au-dessus du sol du bloc. Elle
       // sature à NEAR_MAX = 0,5 dès 2,5 unités de dégagement — c'est-à-dire
       // toujours, à la distance d'arrivée — donc la valeur est celle que
       // `_surfCam.near` reposait, mais elle est maintenant DÉDUITE.
       this.camera.near = planProche(this.camera.position.y - this._solSous(arrival.target))
       this.camera.updateProjectionMatrix()
       this.controls.maxPolarAngle = Math.PI * 0.49
       this.controls.rotateSpeed = 1 // orbital update scales it down to ~0.015
       this.controls.enableZoom = false // surface zoom is our inertial dolly
@@ -659,36 +930,49 @@ export class Modes {
   // DEUX raisons à chaque cran — l'emprise du bloc est divisée par deux ET
   // l'exagération verticale change de palier (5 à z5, 4 à z6, 3,2 à z7, 2,8
   // ensuite). ⚠️ **Ne compenser que l'emprise laisserait trois crans
   // discontinus.** On lit donc l'échelle RÉELLE du bloc des deux côtés du
   // rechargement (`hooks.echelleVerticaleBloc`) : aucune constante recopiée,
   // aucun palier à tenir à jour ici.
   //
   // ⚠️ ET IL N'Y A PLUS DE FONDU AU BLANC. Le rideau n'était pas l'ornement du
   // saut, il était là parce que le saut était invisible autrement.
   async _rescale(next, verb) {
+    const continu = this._continu()
     this.busy = true
-    this._resetZoom() // the new level starts its own scroll budget
+    // ⛔ **`_resetZoom()` TUAIT L'ÉLAN À CHAQUE CRAN, ET C'EST LA MOITIÉ DE LA
+    // SENSATION D'ACCROCHAGE.** Le glissé repartait de zéro de l'autre côté :
+    // l'utilisateur relançait la molette à chaque niveau. Sous le drapeau,
+    // l'élan et le compteur de budget TRAVERSENT — c'est `_franchirSiBesoin` qui
+    // a déjà retranché le niveau franchi du compteur.
+    if (!continu) this._resetZoom() // the new level starts its own scroll budget
     const prevDir = this.camera.position.clone().sub(this.controls.target)
     const camYAvant = this.camera.position.y
     const echelleAvant = this.hooks.echelleVerticaleBloc?.() ?? null
     this.announce(`${verb} — ${next.lat.toFixed(4)}, ${next.lon.toFixed(4)} · Z${next.zoom}`)
     try {
       await this.hooks.loadSurface(next.lat, next.lon, next.zoom)
     } catch {
       this.announce(`${verb} FAILED — HOLDING SCALE`)
       this.busy = false
       return
     }
     const echelleApres = this.hooks.echelleVerticaleBloc?.() ?? null
     const arrival = this._arrivalPose(next)
     this.controls.target.copy(arrival.target)
+    // ⚠️ **SOUS LE DRAPEAU, LA CONVERSION D'UNITÉS EST DÉJÀ FAITE (ou le sera à
+    // cette ligne), ET ELLE NE PASSE PAS PAR `poseCranContinu`.** Voir
+    // `_suivreEmprise` : l'invariant y est l'altitude de FOND, donc le rapport
+    // des EMPRISES, alors que `poseCranContinu` prend le rapport des échelles
+    // VERTICALES — lequel porte l'exagération, et c'est LUI l'accrochage (jusqu'à
+    // ×2 au cran z4 → z5 avec la table de paliers du dépôt).
+    if (continu) { this._suivreEmprise(); this.busy = false; return }
     const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
     // Sans le hook (banc de test, source procédurale), il n'y a pas d'échelle à
     // comparer : on retombe sur la pose d'arrivée, qui est le comportement
     // d'avant l'escalier continu — jamais sur une distance inventée.
     const facteur = echelleAvant > 0 && echelleApres > 0 ? echelleApres / echelleAvant : null
     const dist =
       facteur && Math.abs(dir.y) > 1e-3
         ? poseCranContinu({ camY: camYAvant, pente: dir.y, facteurEchelle: facteur, yCible: arrival.target.y })
             .distanceCible
         : arrival.pos.distanceTo(arrival.target)
@@ -754,43 +1038,27 @@ export class Modes {
 
   // ---------------------------------------------------------------- public nav
   // Explicit navigation the UI drives (vertical zoom stepper + click-to-dive).
   // All reuse the tuned staircase internals — no new zoom behaviour, just new
   // triggers besides the wheel.
 
   // one level FINER (toward more detail). Surface: refine centred on the view.
   // Orbital: nudge the altitude target inward and arm the dive (the settle→dive
   // logic then lands at the matching scale — same path as a wheel-in notch).
   stepFiner() {
-    if (this.busy || this.travel || this._diveTween) return
-    if (this.mode === 'surface') this._refine()
-    else this._orbitNotch(1)
+    this.cranZoom(1)
   }
 
   // one level WIDER. Surface: coarsen, or open the orbit gate once past z4.
   // Orbital: nudge the altitude target outward (toward the planet).
   stepWider() {
-    if (this.busy || this.travel || this._diveTween) return
-    if (this.mode === 'surface') {
-      if (this.hooks.getCoarsenTarget()) this._coarsen()
-      else this.enterOrbit()
-    } else this._orbitNotch(-1)
-  }
-
-  _orbitNotch(dir) {
-    if (dir > 0) this._diveArmed = true // inward intent arms the dive, like the wheel
-    const f = dir > 0 ? 1 / 1.7 : 1.7
-    this.orbAltTarget = THREE.MathUtils.clamp(
-      this.orbAltTarget * f,
-      ORB_ALT_MIN, // le plancher orbital est parti — voir ORB_ALT_MIN
-      MAX_ALT_M / ORBITAL_M_PER_UNIT
-    )
+    this.cranZoom(-1)
   }
 
   // ══════════ CLIQUER SUR LE GLOBE ══════════════════════════════════════════
   //
   // Adrien : « Quand je suis en orbite, cliquer me fait zoomer sur la zone sur
   // laquelle je clique, exactement à l'endroit où j'ai cliqué, qui sera au
   // centre. J'arrive en Z3. »
   //
   // ⚠️ CE N'EST PAS LA PLONGÉE DE LA MOLETTE AVEC UN AUTRE DÉCLENCHEUR. Celle-ci
   // vise `sphereToLatLon(camera.position)` — le point sous la CAMÉRA, c'est-à-dire
@@ -889,45 +1157,61 @@ export class Modes {
     const c = this.controls
     const cam = this.camera
     const min = c.minDistance
     const max = c.maxDistance
     const dist = c.getDistance()
     let factor = Math.exp(-this._zoomVel * dt) // vel > 0 (zoom in) → factor < 1
     let newDist = THREE.MathUtils.clamp(dist * factor, min, max)
     // clamp to the level's own zoom budget: the glide stops at the zone limit
     // (Adrien) instead of running to the physical near/far stop
     let dLog = Math.log(Math.max(newDist, 1e-6) / Math.max(dist, 1e-6))
-    if (this._levelZoom + dLog < -STEP_IN) { dLog = -STEP_IN - this._levelZoom; this._zoomVel = 0 }
-    else if (this._levelZoom + dLog > STEP_OUT) { dLog = STEP_OUT - this._levelZoom; this._zoomVel = 0 }
+    // ⚠️ **SOUS LE DRAPEAU LE BUDGET EST UN COMPTEUR, PAS UNE BUTÉE — Tâche M.**
+    // Le glissé n'est plus borné : il court, et c'est `_franchirSiBesoin` (au bas
+    // de cette fonction) qui change de niveau quand le compteur vaut un niveau
+    // plein. Sans le drapeau, les deux lignes d'avant, au bit près.
+    if (!this._continu()) {
+      if (this._levelZoom + dLog < -BUDGET_NIVEAU) { dLog = -BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
+      else if (this._levelZoom + dLog > BUDGET_NIVEAU) { dLog = BUDGET_NIVEAU - this._levelZoom; this._zoomVel = 0 }
+    }
     this._levelZoom += dLog
     newDist = dist * Math.exp(dLog)
     factor = newDist / dist
     const P = this._zoomPivot
     if (P && Math.abs(factor - 1) > 1e-6) {
       // scale the scene about the pivot so that point stays put on screen
       cam.position.set(P.x + (cam.position.x - P.x) * factor, P.y + (cam.position.y - P.y) * factor, P.z + (cam.position.z - P.z) * factor)
       c.target.set(P.x + (c.target.x - P.x) * factor, P.y + (c.target.y - P.y) * factor, P.z + (c.target.z - P.z) * factor)
     } else {
       _zoomDir.copy(cam.position).sub(c.target).normalize()
       cam.position.copy(c.target).addScaledVector(_zoomDir, newDist)
     }
     c.update()
     this._zoomVel *= Math.exp(-dt / ZOOM_TAU) // the coast
     // clamp at the zone limit and spend the momentum there — the glide never
     // crosses a level; a fresh re-scroll at the limit does (see the wheel handler)
     if (newDist <= min + 1e-3 || newDist >= max - 1e-3) this._zoomVel = 0
     if (Math.abs(this._zoomVel) < ZOOM_STOP) this._zoomVel = 0 // coast spent
+    // ⚠️ **APRÈS LE DÉPLACEMENT, PAS AVANT.** Le franchissement lit le compteur
+    // que cette image vient d'incrémenter ; le placer plus haut le ferait décider
+    // sur l'image précédente — c'est la « sonde lue APRÈS la fonction » du §0,
+    // dans l'autre sens.
+    this._franchirSiBesoin()
   }
 
   // ---------------------------------------------------------------- per-frame
 
   update(dt) {
+    // ⚠️ **EN TÊTE, ET `main.js` LE JUSTIFIE** : `modes.update(dt)` court AVANT
+    // `majSeuilSocle()` et `majCameraFond()`. Convertir ici, c'est convertir
+    // avant que quiconque ne lise l'altitude de cette image — donc jamais l'image
+    // à moitié d'altitude qui a produit onze bascules du seuil.
+    this._suivreEmprise()
     if (this.mode === 'orbital') {
       if (this.travel) {
         this._updateTravel(dt)
       } else if (!this.busy) {
         // damped proportional zoom + altitude-scaled rotation
         this.orbAlt = THREE.MathUtils.damp(this.orbAlt, this.orbAltTarget, 6, dt)
         const dir = this.camera.position.clone().normalize()
         this.camera.position.copy(dir).multiplyScalar(R_GLOBE + this.orbAlt)
         this.controls.rotateSpeed = THREE.MathUtils.clamp((this.orbAlt / R_GLOBE) * 1.4, 0.015, 1)
         this.controls.update()
@@ -937,39 +1221,56 @@ export class Modes {
       // ⚠️ MÊME LOI QU'EN SURFACE depuis la Tâche 1b : `planProche` vit dans
       // `loi-altitude.js` et les deux modes l'appellent. Elle sature à 0,5,
       // c'est-à-dire exactement la valeur que le mode surface posait en dur.
       const near = planProche(this.orbAlt)
       if (Math.abs(near - this.camera.near) > near * 0.2) {
         this.camera.near = near
         this.camera.updateProjectionMatrix()
       }
 
       this.altM = altitudeOrbitaleM(this.orbAlt, ORBITAL_M_PER_UNIT)
-      if (!this.busy && !this.travel && this._diveArmed) {
+      if (!this.busy && !this.travel && this._diveArmed && this._continu()) {
+        // ⛔ **PLUS DE TABLE, PLUS D'ATTENTE DE STABILISATION.** Le dépôt
+        // attendait que le zoom se POSE (`settled`, à 6 % près) puis lisait le
+        // palier dans `DIVE_TIERS` : deux paliers pour un seul geste. Ici la
+        // porte est GÉOMÉTRIQUE — on traverse dès qu'un niveau de bloc peut
+        // accueillir l'altitude sous le plafond de la caméra — et la traversée
+        // conserve l'altitude de fond, donc elle ne se voit pas.
+        const n = this._niveauDArrivee(this.altM)
+        if (n && n.borne !== 'haut') {
+          this._diveArmed = false
+          this._dive({ altM: DIVE_ALT_M, zoom: n.zoom })
+        }
+      } else if (!this.busy && !this.travel && this._diveArmed) {
         // dive when an inward zoom SETTLES under a tier — never intercept a
         // fast zoom mid-flight; the landing scale matches where you stopped
         const settled = Math.abs(this.orbAlt - this.orbAltTarget) < this.orbAltTarget * 0.06
         if (settled) {
           // pick the tier from the TARGET altitude (where the user chose to
           // stop), not the still-damping orbAlt — settle fires up to 6% away,
           // enough to cross a tier boundary and land one scale too coarse
           // (e.g. wheel stop at 7 700 m read as 8 160 m → z11 instead of FINE)
           const tier = pickDiveTier(this.orbAltTarget * ORBITAL_M_PER_UNIT)
           if (tier) {
             this._diveArmed = false
             this._dive(tier)
           }
         }
       }
     } else {
       // surface inertial dolly — the long élan (see the wheel handler)
-      if (!this._diveTween && !this.busy && Math.abs(this._zoomVel) > ZOOM_STOP) this._applyZoom(dt)
+      // ⚠️ **SOUS LE DRAPEAU, LE GLISSÉ SURVIT AU CHARGEMENT — ET C'EST LA
+      // TROISIÈME MOITIÉ DU CRAN.** `busy` gèle le zoom pendant tout le
+      // `loadSurface` du franchissement : la molette ne répond plus, puis la vue
+      // repart. C'est une PAUSE, et Adrien n'en veut pas. `_franchirSiBesoin` se
+      // garde lui-même contre un second franchissement pendant celui-ci.
+      if (!this._diveTween && (!this.busy || this._continu()) && Math.abs(this._zoomVel) > ZOOM_STOP) this._applyZoom(dt)
       // click-to-dive lean-in tween (first beat): ease 30% toward the point,
       // then load the finer level (see diveTo). ease-in-out quad.
       if (this._diveTween && !this.busy) {
         const dv = this._diveTween
         dv.t = Math.min(1, dv.t + dt / dv.dur)
         const e = dv.t < 0.5 ? 2 * dv.t * dv.t : 1 - ((-2 * dv.t + 2) ** 2) / 2
         this.camera.position.lerpVectors(dv.from, dv.toPos, e)
         this.controls.target.lerpVectors(dv.fromT, dv.toT, e)
         this.controls.update()
         if (dv.t >= 1) {
diff --git a/src/monde/exageration-continue.js b/src/monde/exageration-continue.js
index def2240..409801e 100644
--- a/src/monde/exageration-continue.js
+++ b/src/monde/exageration-continue.js
@@ -370,38 +370,70 @@ export function zoomCran ({ demZoom, zoomNiveau = 0, pasNiveau = PAS_NIVEAU } =
  * `params.demExaggeration` est lu à DOUZE endroits (`terrain.js` ×5,
  * `ocean.js` ×2, `gpx.js`, `main.js` ×4) — douze occasions de diverger dès que
  * la valeur bouge.
  *
  * D'où cet objet : **un seul écrivain** (`majExageration`), **N lecteurs**
  * (`lireExageration`). Un lecteur ne peut pas calculer sa propre valeur : il
  * n'a pas la courbe.
  *
  * @param {{surcharges?:object, lat?:number, fovDeg?:number, fraction?:number}} [arg]
  */
-export function creerExagerationPartagee ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE } = {}) {
+export function creerExagerationPartagee ({ surcharges = null, ancres = EXAG_ANCRES, base = EXAG_BASE, lat = 45, fovDeg = FOV_DEG, fraction = FRACTION_REFERENCE, constante = null } = {}) {
   const courbe = surcharges ? courbeExageration({ surcharges, ancres, base }) : COURBE_DEFAUT
   return {
     courbe,
     lat,
     fovDeg,
     fraction,
+    // ══════════ D10 — L'EXAGÉRATION UNIQUE, ET CE QU'ELLE SUPPRIME ══════════
+    //
+    // **Adrien, 2026-08-22 :** *« On va faire une exagération d'altitude unique
+    // à ×2 sur toute la map, ça évitera les sauts et les rechargements. »*
+    //
+    // ⚠️ **CE CHAMP N'EST PAS UN RÉGLAGE DE PLUS, C'EST UN INTERRUPTEUR
+    // D'ÉCRITURE.** Posé, les trois écrivains (`majExageration` et ses deux
+    // dérivés) rendent la main sans rien changer : la valeur ne bouge JAMAIS.
+    // Or `globe.majExageration` n'appelle `setExaggeration` — donc
+    // `_rechargeTuiles`, donc **la planète entière rendue au réseau** — que si
+    // la valeur a bougé. **Une constante ne bouge pas : le rechargement
+    // disparaît sans qu'on ait à porter le relief dans le nuanceur de sommets**
+    // (12 s et 21 s mesurées, aller et retour, La Réunion z12).
+    //
+    // ⚠️ **LE MODULE N'EST PAS SUPPRIMÉ, ET IL NE DOIT PAS L'ÊTRE** : la courbe,
+    // ses ancres et ses quatorze lecteurs servent encore au chemin plat, et des
+    // tests les gardent. Ici, **il rend la constante sur ce chemin-là, et rien
+    // d'autre.**
+    constante: constante > 0 ? Number(constante) : null,
     // ⚠️ La valeur de DÉPART est celle du zoom du socle, pas `base` : une
     // fenêtre construite avant la première image ne doit pas naître à la
     // mauvaise échelle puis sauter.
-    valeur: courbe(zoomDepuisAltitude(altitudeDepuisZoom(13, { lat, fovDeg, fraction }), { lat, fovDeg, fraction })),
+    // ⚠️ **ET SOUS D10 C'EST LA CONSTANTE, DÈS LA CONSTRUCTION.** Naître à 2,8
+    // pour être posé à 2 à la première image coûterait UN rechargement complet
+    // de la planète — le seul qu'on ne verrait pas passer, et le plus cher.
+    valeur: constante > 0
+      ? Number(constante)
+      : courbe(zoomDepuisAltitude(altitudeDepuisZoom(13, { lat, fovDeg, fraction }), { lat, fovDeg, fraction })),
     zoom: 13,
     altitudeM: null,
   }
 }
 
-/** L'unique écrivain « continu ». Appelé au rééchantillonnage, depuis l'altitude. */
+/**
+ * L'unique écrivain « continu ». Appelé au rééchantillonnage, depuis l'altitude.
+ *
+ * ⚠️ **SOUS D10 IL REND LA MAIN SANS ÉCRIRE.** Les deux autres écrivains
+ * (`majExagerationCadrage`, `majExagerationCran`) passent par ici — c'est la
+ * règle « un seul chemin d'écriture » du module —, donc **cette seule ligne
+ * gèle les trois.**
+ */
 export function majExageration (partage, altitudeM) {
+  if (partage?.constante > 0) return partage.valeur
   const z = zoomDepuisAltitude(altitudeM, partage)
   partage.zoom = z
   partage.altitudeM = Number(altitudeM)
   partage.valeur = partage.courbe(z)
   return partage.valeur
 }
 
 /**
  * L'écrivain « cadrage » : le même, piloté par la géométrie horizontale.
  * ⚠️ **Il passe par `majExageration`** — un seul chemin d'écriture, jamais deux.
@@ -429,20 +461,25 @@ export function majExagerationCran (partage, { demZoom, zoomNiveau = 0, pasNivea
 
 /**
  * L'écrivain « palier » — celui de la PRODUCTION, et il ne change rien.
  *
  * ⚠️ **C'est lui qui garde le chemin du bloc intact au bit près.** Drapeau
  * `globeContinu` éteint, `main.js` pose ici la valeur que `exagForZoom` rendait
  * déjà ; les douze lecteurs lisent donc exactement la même chose qu'avant, et
  * la seule différence est qu'ils la lisent **au même endroit**.
  */
 export function poserExageration (partage, valeur) {
+  // ⚠️ **LUI AUSSI — ET C'EST L'ÉCRIVAIN DU CHEMIN PLAT.** `syncExagToZoom` le
+  // rappelle à chaque chargement de bloc ; sans cette ligne, le palier
+  // `exagForZoom(demZoom)` reviendrait écraser la constante à chaque cran, et le
+  // rechargement de la planète avec lui.
+  if (partage?.constante > 0) return partage.valeur
   const v = Number(valeur)
   if (!Number.isFinite(v)) return partage.valeur
   partage.valeur = v
   partage.altitudeM = null
   return v
 }
 
 /**
  * **LE SEUL LECTEUR AUTORISÉ.** Les douze sites de `terrain.js`, `ocean.js`,
  * `gpx.js` et `main.js` passent par ici, et un test échoue si l'un d'eux relit
diff --git a/src/monde/zoom-continu.js b/src/monde/zoom-continu.js
new file mode 100644
index 0000000..5702121
--- /dev/null
+++ b/src/monde/zoom-continu.js
@@ -0,0 +1,341 @@
+// LE ZOOM CONTINU — LA LOI MESURÉE, LE FRANCHISSEMENT DE NIVEAU, ET LE
+// CHANGEMENT D'UNITÉS QUI LE REND INVISIBLE.
+//
+// Module PUR : ni DOM, ni three.js, ni globe. Tout se vérifie sous node
+// (`test/zoom-continu.test.js`). Même patron qu'`escalier-zoom.js`,
+// `loi-altitude.js` et `echelle-continue.js` : la RÈGLE vit ici, la plomberie
+// reste dans `modes.js` et `main.js`.
+//
+// ══════════ POURQUOI CE MODULE EXISTE ═══════════════════════════════════════
+//
+// **Adrien, 2026-08-22 :** *« Le mouvement de caméra du ciel à la terre comme
+// évoqué, on supprime toutes les zones […] Je ne veux aucun saut, aucun
+// rechargement de la terre. […] vire absolument ton système de saut de
+// niveau !!! »*
+//
+// Le dépôt fait descendre la caméra par PALIERS : un budget de zoom par niveau,
+// une butée au bout, un re-défilement pour franchir, et une REPOSE de caméra à
+// chaque franchissement. Ce module porte les trois lois qui remplacent tout ça,
+// et rien d'autre.
+
+import { empriseBlocM } from '../loi-altitude.js'
+
+// ══════════ 1. LA LOI DE ZOOM — MESURÉE, PAS CHOISIE (D9) ═══════════════════
+//
+// ⚠️ **DIX-NEUF ALTITUDES RELEVÉES PAR ADRIEN DANS GOOGLE EARTH**, de
+// **63 170 km à 126 km**, soit **18 intervalles** :
+//
+//   | rapport global          | 501,35                                       |
+//   | moyenne géométrique     | **×1,41256** = 0,49832 octave (`ln = 0,34541`)|
+//   | écart-type des rapports | 0,0126 (min 1,4032 · max 1,4600)             |
+//   | racine de 2             | 0,5 octave exactement (`ln = 0,34657`)       |
+//   | écart                   | **0,12 %**                                   |
+//
+// ➡️ **UN CRAN VAUT ×√2, ET LE RAPPORT EST CONSTANT SUR TOUTE LA DESCENTE.**
+//
+// ⚠️ **CE N'EST PAS UNE LOI « DE MOINS EN MOINS FORTE ».** Ce qui rétrécit le
+// long de la descente est l'écart en KILOMÈTRES (18 153 km au premier cran,
+// **51 km au dernier**), pas le rapport. **C'est la constance qui produit la
+// stabilité qu'Adrien admire** — une loi décroissante la casserait.
+export const PAS_CRAN = Math.LN2 / 2
+
+// ══════════ 1 bis. ET CE N'EST PAS LE PAS DU NIVEAU DE MNT ══════════════════
+//
+// ⛔ **LE DÉPÔT CONFONDAIT LES DEUX SOUS UN SEUL NOM.** `STEP_IN` de `modes.js`
+// servait à la fois de budget de niveau (« jusqu'où le glissé descend avant la
+// butée ») et de pas de cran. Or ce sont DEUX grandeurs différentes, et une
+// seule des deux est libre :
+//
+//   · **le NIVEAU de MNT est ×2 par construction** — un cran de zoom slippy
+//     divise l'emprise de la tuile par deux, donc `ln 2` de distance et rien
+//     d'autre. Ce nombre-là n'est pas un réglage, c'est la grille de tuiles.
+//   · **le CRAN est ×√2** — c'est la mesure d'Adrien ci-dessus, et elle est
+//     libre.
+//
+// ⚠️ **Le réglage porte donc sur le CRAN, pas sur le tour de molette** : le
+// nombre de crans par tour dépend de la souris, et la molette garde son
+// impulsion dérivée du NIVEAU (vingt crans de molette par niveau, contrainte
+// d'Adrien inchangée).
+export const PAS_NIVEAU = Math.LN2
+
+// ══════════ 1 ter. L'EXAGÉRATION UNIQUE (D10) ═══════════════════════════════
+//
+// **Adrien, 2026-08-22 :** *« On va faire une exagération d'altitude unique à
+// ×2 sur toute la map, ça évitera les sauts et les rechargements. »*
+//
+// ⚠️ **C'EST CETTE CONSTANTE QUI SUPPRIME LE RECHARGEMENT DE LA PLANÈTE**, et
+// non un portage du relief au GPU. `setExaggeration` (`globe.js`) rend au réseau
+// TOUTES les tuiles prêtes ; tant que l'exagération changeait de palier à chaque
+// cran, la descente jetait la planète entière et la retéléchargeait — **12 s et
+// 21 s mesurées, aller et retour, La Réunion z12** (`paquet-E-tour1.md:47`).
+// Une constante ne change jamais, donc `majExageration` ne recharge jamais.
+//
+// ⚠️ **LE PORTAGE GPU EST DIFFÉRÉ, PAS ABANDONNÉ.** Il redeviendrait nécessaire
+// le jour où l'exagération redeviendrait un réglage vivant.
+export const EXAGERATION_UNIQUE = 2
+
+// ══════════ 2. LE FACTEUR D'UN CRAN ═════════════════════════════════════════
+//
+// `dir > 0` = on se rapproche (zoom avant) : la distance est DIVISÉE par √2.
+// `dir < 0` = on s'éloigne : elle est multipliée par √2. Symétrique par
+// construction — un aller-retour rend exactement le point de départ, ce que
+// l'escalier de paliers ne savait pas faire (mesuré : 14 326 m rendus pour
+// 27 696 m de départ, `modes.js`).
+export function facteurCran(dir, pas = PAS_CRAN) {
+  if (!Number.isFinite(pas)) return 1
+  return Math.exp(-Math.sign(dir) * pas)
+}
+
+// ══════════ 3. LE FRANCHISSEMENT DE NIVEAU — UNE DIVISION, PAS UNE TABLE ════
+//
+// ⛔ **CE QUI DISPARAÎT ICI, ET C'EST LE CŒUR DE LA CONSIGNE.** `DIVE_TIERS`
+// posait NEUF paliers d'altitude à la main (8 km, 25, 50, 100, 200, 600,
+// 1 600, 4 000, 8 000, 16 000 km) et `pickDiveTier` y lisait le niveau. Il n'y a
+// plus de table : le niveau se DÉDUIT du budget de zoom dépensé, par une
+// division.
+//
+// `budget` est le zoom logarithmique dépensé DANS le niveau courant — négatif en
+// zoom avant, comme `_levelZoom` de `modes.js`. On rend :
+//   · `niveaux` : combien de niveaux de MNT franchir, **positif pour AFFINER**,
+//     négatif pour élargir ;
+//   · `reste` : ce qui reste au compteur APRÈS le franchissement.
+//
+// ⚠️ **L'HYSTÉRÉSIS EST GRATUITE ET SYMÉTRIQUE**, et c'est la troncature qui la
+// donne : on affine à `−ln 2` et on élargit à `+ln 2`, donc il faut un facteur 2
+// d'altitude pour repasser la frontière dans l'autre sens. Aucun battement
+// possible, aucun seuil à régler.
+export function franchissement(budget, pas = PAS_NIVEAU) {
+  if (!Number.isFinite(budget) || !(pas > 0)) return { niveaux: 0, reste: Number.isFinite(budget) ? budget : 0 }
+  const n = Math.trunc(budget / pas)
+  return { niveaux: n === 0 ? 0 : -n, reste: budget - n * pas }
+}
+
+// ══════════ 4. LE CHANGEMENT D'UNITÉS — ET CE N'EST PAS UNE REPOSITION ══════
+//
+// ⚠️ **CE PARAGRAPHE EST LA TÂCHE ENTIÈRE, ALORS IL EST ÉCRIT EN ENTIER.**
+//
+// Sous `?terre=unique` la caméra visible n'est PAS celle qui vit dans l'espace
+// du bloc : c'est la caméra de FOND (`camGlobe`), posée par une SIMILITUDE
+// (`monde/frontiere-rendu.js`, `poseFond`) dont le facteur est
+// `extentMeters / span`. L'altitude qu'elle occupe réellement est donc
+//
+//     altitudeFondM = camY × extentMeters / span            (`altitudeFondM`)
+//
+// et **c'est la SEULE grandeur dont un saut se voit à l'écran.**
+//
+// ⛔ **`poseCranContinu` (`loi-altitude.js:181`) CONSERVE L'AUTRE.** Il repose la
+// caméra à `camY × (échelleAprès / échelleAvant)`, où l'échelle est
+// **VERTICALE** : `(span / extentMeters) × exagération`. Le rapport vaut donc
+//
+//     2 × (exagération après / exagération avant)
+//
+// et l'altitude de fond, elle, est multipliée par `exagération après /
+// exagération avant`. Avec la table de paliers du dépôt (2,5 à z4, **5 à z5**,
+// 4 à z6, 3,2 à z7, 2,8 ensuite) cela fait, sur une seule descente :
+//   · z4 → z5 : **×2** — la vue recule de moitié d'un coup ;
+//   · z5 → z6 : ×0,8 · z6 → z7 : ×0,8 · z7 → z8 : ×0,875.
+// **C'est ÇA, l'accrochage.** Il ne vient pas du fait qu'on repose la caméra —
+// il faut bien la reposer, l'unité du monde vient de changer — il vient du fait
+// qu'on la repose sur la MAUVAISE grandeur.
+//
+// ➡️ **ICI, L'INVARIANT EST `altitudeFondM`.** Le facteur ne dépend plus que des
+// EMPRISES, donc plus du tout de l'exagération : la continuité survivrait même
+// si D10 était un jour rapportée.
+export function camYApresNiveau({ camY, empriseAvant, empriseApres }) {
+  if (!Number.isFinite(camY) || !(empriseAvant > 0) || !(empriseApres > 0)) return camY
+  return (camY * empriseAvant) / empriseApres
+}
+
+// La pose complète : la même chose, plus la distance à la cible qui va avec.
+// `pente` est le `y` normalisé de la direction cible → caméra ; elle TRAVERSE le
+// franchissement inchangée (l'angle de vue de l'utilisateur est gardé, c'était
+// la bonne moitié de v48).
+export function poseApresNiveau({ camY, pente, empriseAvant, empriseApres, yCible = 0 }) {
+  const y = camYApresNiveau({ camY, empriseAvant, empriseApres })
+  return { camY: y, distanceCible: (y - yCible) / pente, pente }
+}
+
+// ══════════ 5. LA PLONGÉE QUI NE SAUTE PAS ══════════════════════════════════
+//
+// ⚠️ **`_posePlongee` CONSERVAIT, LUI AUSSI, LA MAUVAISE ALTITUDE**, et
+// `loi-altitude.js` le savait : *« le CHAMP VISUEL, lui, saute encore d'un
+// facteur `exagération(z)` […] C'est une question, pas un oubli. »* Sous
+// `?terre=unique` la question a une réponse, parce qu'il n'y a plus deux mondes
+// à raccorder mais un seul : **l'altitude de fond est CONTINUE à la traversée**,
+// puisque de l'autre côté c'est la même planète.
+//
+// `camY` qui rend exactement `altM` d'altitude de fond sur un bloc d'emprise
+// `extentMeters` et de côté `span`. C'est l'inverse exact d'`altitudeFondM`.
+export function camYPourAltitudeFond({ altM, extentMeters, span }) {
+  if (!(altM > 0) || !(extentMeters > 0) || !(span > 0)) return null
+  return (altM * span) / extentMeters
+}
+
+// La distance à la cible qui pose la caméra à cette hauteur, le long d'une
+// direction de pente `pente`.
+export function distancePourAltitudeFond({ altM, extentMeters, span, pente, yCible = 0 }) {
+  const y = camYPourAltitudeFond({ altM, extentMeters, span })
+  if (y == null || !(Math.abs(pente) > 1e-6)) return null
+  return (y - yCible) / pente
+}
+
+// ══════════ 6. LE NIVEAU D'ARRIVÉE — DÉDUIT, SANS TABLE ═════════════════════
+//
+// Le niveau le plus FIN dont la distance tient encore sous le plafond
+// d'arrivée. Même forme que `niveauDePlongee` (`loi-altitude.js`), mais sur
+// l'altitude de FOND et sur l'emprise HORIZONTALE — donc sans exagération, donc
+// sans les paliers qui faisaient sauter la traversée.
+//
+// ⚠️ **LA PORTE ORBITALE DEVIENT GÉOMÉTRIQUE.** Elle n'est plus « 16 000 km,
+// écrit à la main » : c'est l'altitude au-dessus de laquelle même le bloc le
+// plus large ne tient plus sous le plafond de la caméra.
+// ⚠️ **`empriseAuZoom` EST INJECTÉE**, comme `choisirPalier` et `echelleAuZoom`
+// l'étaient avant elle : c'est le seul terme que ce module ne peut pas calculer
+// seul, parce que la latitude du bloc vit dans `main.js`. Le défaut sert aux
+// bancs, jamais à la production.
+export function niveauDArrivee({
+  altM,
+  empriseAuZoom = null,
+  lat = 45,
+  span,
+  tuilesParBloc = 3,
+  zoomMin = 3,
+  zoomMax = 15,
+  pente,
+  yCible = 0,
+  distanceMin,
+  distanceMax,
+} = {}) {
+  if (!(altM > 0) || !(span > 0) || !(Math.abs(pente) > 1e-6)) return null
+  const emprise = typeof empriseAuZoom === 'function'
+    ? empriseAuZoom
+    : (z) => empriseBlocM({ zoom: z, lat, tuilesParBloc })
+  let choisi = null
+  for (let z = zoomMin; z <= zoomMax; z++) {
+    const extentMeters = emprise(z)
+    if (!(extentMeters > 0)) continue
+    const distanceCible = distancePourAltitudeFond({ altM, extentMeters, span, pente, yCible })
+    if (distanceCible == null) continue
+    if (distanceCible <= distanceMax) choisi = { zoom: z, distanceCible, extentMeters, borne: null }
+  }
+  if (!choisi) {
+    return { zoom: zoomMin, distanceCible: distanceMax, extentMeters: emprise(zoomMin), borne: 'haut' }
+  }
+  if (choisi.distanceCible < distanceMin) return { ...choisi, distanceCible: distanceMin, borne: 'bas' }
+  return choisi
+}
+
+// ══════════ 7. LE PROFIL DE DESCENTE — L'INSTRUMENT ═════════════════════════
+//
+// ⚠️ **IL NE MESURE PAS LA MÊME GRANDEUR QUE `profilDescente`
+// (`loi-altitude.js`), ET C'EST TOUT L'INTÉRÊT.** Celui-là rejoue
+// `altitudeSurfaceM`, que le cran CONSERVE PAR CONSTRUCTION depuis la Tâche 2
+// bis : il ne peut donc plus rien voir. Celui-ci rejoue **`altitudeFondM`**,
+// c'est-à-dire ce que l'écran montre — et il voit tout ce que l'autre cache.
+//
+// `regime: 'paliers'` rejoue le dépôt (budget de niveau borné, repose sur
+// l'échelle VERTICALE avec les paliers d'exagération, plongée sur
+// `altitudeSurfaceM`). `regime: 'continu'` rejoue ce que cette tâche pose.
+// ⚠️ **Les deux passent par le MÊME code de parcours** : ce qui diffère est la
+// loi, pas l'instrument.
+export function profilDescenteFond({
+  regime = 'continu',
+  altDepartM = 1600000,
+  lat = 45.8326,
+  span = 56,
+  tuilesParBloc = 3,
+  zoomMin = 3,
+  zoomFin = 15,
+  pente,
+  yCible = 0,
+  distanceMin = 6,
+  distanceMax = 150,
+  budgetNiveau = PAS_NIVEAU,
+  exag = () => EXAGERATION_UNIQUE,
+  ratioMax = 1.02,
+} = {}) {
+  const continu = regime === 'continu'
+  const emprise = (z) => empriseBlocM({ zoom: z, lat, tuilesParBloc })
+  const altFond = (camY, z) => (camY * emprise(z)) / span
+  const pts = []
+
+  // ── 1. le glissé orbital : l'altitude EST la variable d'état, continu par
+  // construction. Il court jusqu'à LA PORTE, c'est-à-dire l'altitude sous
+  // laquelle le bloc le plus large tient enfin sous le plafond de la caméra.
+  // ⚠️ **La porte est GÉOMÉTRIQUE des deux côtés** : le régime « paliers »
+  // traverse au même endroit, sinon on comparerait deux trajets.
+  const altPorte = (altDepartM * span) / emprise(zoomMin) > distanceMax * pente
+    ? (distanceMax * pente * emprise(zoomMin)) / span
+    : altDepartM
+  const plongee = Math.min(altDepartM, altPorte)
+  for (const a of echelons(altDepartM, plongee, ratioMax)) {
+    pts.push({ mode: 'orbital', zoom: null, altM: a, transition: null })
+  }
+
+  // ── 2. LA TRAVERSÉE. Continu : le niveau et la distance se déduisent de
+  // l'altitude de FOND. Paliers : le dépôt conserve `altitudeSurfaceM`, donc
+  // l'altitude de fond est multipliée par l'exagération du niveau d'arrivée.
+  let zoom
+  let camY
+  if (continu) {
+    const n = niveauDArrivee({
+      altM: plongee, lat, span, tuilesParBloc, zoomMin, zoomMax: zoomFin,
+      pente, yCible, distanceMin, distanceMax,
+    })
+    zoom = n.zoom
+    camY = yCible + n.distanceCible * pente
+  } else {
+    // le dépôt : `distancePourAltitude({ altM, echelleV })` avec
+    // `echelleV = (span / emprise) × exagération`
+    let choisi = null
+    for (let z = zoomMin; z <= zoomFin; z++) {
+      const echelleV = (span / emprise(z)) * exag(z)
+      const d = (plongee * echelleV - yCible) / pente
+      if (d <= distanceMax * 0.94) choisi = { zoom: z, d }
+    }
+    zoom = choisi?.zoom ?? zoomMin
+    const d = Math.min(Math.max(choisi?.d ?? distanceMax * 0.94, distanceMin), distanceMax)
+    camY = yCible + d * pente
+  }
+  pts.push({ mode: 'surface', zoom, altM: altFond(camY, zoom), transition: 'plongee' })
+
+  // ── 3. la descente en surface
+  let distanceCible = (camY - yCible) / pente
+  for (;;) {
+    const dFin = Math.max(distanceCible * Math.exp(-budgetNiveau), distanceMin)
+    for (const d of echelons(distanceCible, dFin, ratioMax).slice(1)) {
+      pts.push({ mode: 'surface', zoom, altM: altFond(yCible + d * pente, zoom), transition: null })
+    }
+    distanceCible = dFin
+    camY = yCible + dFin * pente
+    if (zoom >= zoomFin) break
+    if (continu) {
+      const pose = poseApresNiveau({ camY, pente, empriseAvant: emprise(zoom), empriseApres: emprise(zoom + 1), yCible })
+      zoom += 1
+      distanceCible = Math.min(Math.max(pose.distanceCible, distanceMin), distanceMax)
+    } else {
+      // `poseCranContinu` : le rapport des échelles VERTICALES
+      const facteur = ((span / emprise(zoom + 1)) * exag(zoom + 1)) / ((span / emprise(zoom)) * exag(zoom))
+      const y = camY * facteur
+      zoom += 1
+      distanceCible = Math.min(Math.max((y - yCible) / pente, distanceMin), distanceMax)
+    }
+    camY = yCible + distanceCible * pente
+    pts.push({ mode: 'surface', zoom, altM: altFond(camY, zoom), transition: 'cran' })
+  }
+  return pts
+}
+
+// Échantillonnage géométrique de `a` vers `b`, bornes comprises, sans jamais
+// dépasser `ratioMax` d'un point au suivant. (Recopie assumée d'un helper de
+// `loi-altitude.js` — quatre lignes, et l'importer ferait dépendre ce module de
+// la table de paliers qu'il remplace.)
+function echelons(a, b, ratioMax = 1.02) {
+  if (!(a > 0) || !(b > 0)) return [a]
+  if (a === b) return [a]
+  const total = Math.abs(Math.log(b / a))
+  const n = Math.max(1, Math.ceil(total / Math.log(ratioMax)))
+  const pts = []
+  for (let i = 0; i <= n; i++) pts.push(a * Math.exp((Math.log(b / a) * i) / n))
+  return pts
+}
diff --git a/test/camera-continue.test.js b/test/camera-continue.test.js
index 611f323..05951e9 100644
--- a/test/camera-continue.test.js
+++ b/test/camera-continue.test.js
@@ -57,40 +57,46 @@ import {
   echelonsGeometriques,
   empriseBlocM,
   exagPourZoom,
   niveauDePlongee,
   planProche,
   poseArrivee,
   posePresentation,
   profilDescente,
   sautsDuProfil,
 } from '../src/loi-altitude.js'
-import { DIVE_TIERS, pickDiveTier, STEP_IN } from '../src/modes.js'
+// ⚠️ **`BUDGET_NIVEAU` ET NON `STEP_IN` — Tâche M.** Les deux étaient LE MÊME
+// NOMBRE et le même nom jusqu'à la loi de zoom mesurée (D9) : `STEP_IN` est
+// désormais **le CRAN** (×√2, la mesure d'Adrien sur Google Earth) et
+// `BUDGET_NIVEAU` **le niveau de MNT** (×2, la grille de tuiles). Ce banc rejoue
+// l'ESCALIER, donc c'est le niveau qui le pilote — la valeur qu'il lit n'a pas
+// bougé d'un bit, seul son nom l'a fait.
+import { DIVE_TIERS, pickDiveTier, BUDGET_NIVEAU } from '../src/modes.js'
 import { ORBITAL_M_PER_UNIT, R_GLOBE } from '../src/geo.js'
 import { TERRAIN_SIZE } from '../src/terrain.js'
 
 const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
 // ⚠️ FINS DE LIGNE NORMALISÉES — ce dépôt vit sous Windows avec `autocrlf` et un
 // fichier fraîchement extrait arrive en CRLF (voir test/escalier-surface.test.js).
 const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
 const SRC_MAIN = lis('src/main.js')
 const SRC_MODES = lis('src/modes.js')
 const SRC_DEM = lis('src/dem.js')
 const SRC_GLOBE = lis('src/globe.js')
 const SRC_LOI = lis('src/loi-altitude.js')
 
 const LAT_REF = 45.8326 // Mont-Blanc — le vol de référence du §0 du plan
 const VOL = {
   choisirPalier: pickDiveTier,
   metresParUnite: ORBITAL_M_PER_UNIT,
   span: TERRAIN_SIZE,
-  budgetNiveau: STEP_IN,
+  budgetNiveau: BUDGET_NIVEAU,
   lat: LAT_REF,
 }
 
 // LA LOI D'AVANT LES TÂCHES 2 bis ET 1b, rejouable telle quelle : c'est elle
 // qui porte les onze sauts relevés à la Tâche 1a, et c'est elle qui rend les
 // assertions de continuité non tautologiques.
 const AVANT = { ...VOL, budgetNiveau: 1.2, cranContinu: false, plongeeContinue: false }
 
 const echelleRef = (z) =>
   echelleBloc({ extentMeters: empriseBlocM({ zoom: z, lat: LAT_REF }), span: TERRAIN_SIZE, exageration: exagPourZoom(z) })
diff --git a/test/escalier-surface.test.js b/test/escalier-surface.test.js
index cc18d3f..da132ee 100644
--- a/test/escalier-surface.test.js
+++ b/test/escalier-surface.test.js
@@ -38,40 +38,46 @@ import {
   DISTANCE_MIN_SURFACE,
   Y_CIBLE,
   echelleBloc,
   empriseBlocM,
   exagPourZoom,
   poseArrivee,
   poseCranContinu,
   profilDescente,
   sautsDuProfil,
 } from '../src/loi-altitude.js'
-import { pickDiveTier, STEP_IN, STEP_OUT } from '../src/modes.js'
+// ⚠️ **`BUDGET_NIVEAU` ET NON `STEP_IN` — Tâche M.** Les deux étaient LE MÊME
+// NOMBRE et le même nom jusqu'à la loi de zoom mesurée (D9) : `STEP_IN` est
+// désormais **le CRAN** (×√2, la mesure d'Adrien sur Google Earth) et
+// `BUDGET_NIVEAU` **le niveau de MNT** (×2, la grille de tuiles). Ce banc rejoue
+// l'ESCALIER, donc c'est le niveau qui le pilote — la valeur qu'il lit n'a pas
+// bougé d'un bit, seul son nom l'a fait.
+import { pickDiveTier, BUDGET_NIVEAU, STEP_IN, STEP_OUT } from '../src/modes.js'
 import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
 import { TERRAIN_SIZE } from '../src/terrain.js'
 
 const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
 // ⚠️ LES FINS DE LIGNE SONT NORMALISÉES, ET CE N'EST PAS UNE COQUETTERIE : ce
 // dépôt vit sous Windows avec `autocrlf`, si bien qu'un fichier fraîchement
 // extrait par git arrive en CRLF alors que l'arbre de travail est en LF. Sans
 // cette normalisation, le découpage de méthode ci-dessous échoue selon qui a
 // touché le fichier en dernier — c'est arrivé pendant l'écriture de ce test.
 const lis = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\r\n/g, '\n')
 const SRC_MODES = lis('src/modes.js')
 const SRC_MAIN = lis('src/main.js')
 
 const LAT_REF = 45.8326 // Mont-Blanc — le vol de référence du §0 du plan
 const VOL = {
   choisirPalier: pickDiveTier,
   metresParUnite: ORBITAL_M_PER_UNIT,
   span: TERRAIN_SIZE,
-  budgetNiveau: STEP_IN,
+  budgetNiveau: BUDGET_NIVEAU,
   lat: LAT_REF,
 }
 
 // Le corps d'une méthode de classe : de son en-tête jusqu'à l'accolade fermante
 // à deux espaces d'indentation. Assez pour dire « ce que CETTE méthode fait »
 // sans confondre avec ses voisines — c'est tout ce qu'on lui demande.
 function corpsDe(src, entete) {
   const i = src.indexOf(entete)
   assert.ok(i > 0, `méthode introuvable : ${entete}`)
   const j = src.indexOf('\n  }\n', i)
@@ -199,28 +205,34 @@ test('MUTATION — remettre la téléportation v48 ramène les sauts', () => {
 // ══════════ ④ LE GARDE-FOU v42 — LE BUDGET DU NIVEAU VAUT UN CRAN ═══════════
 //
 // ⚠️ LA PARTIE QUI N'ÉTAIT ÉCRITE NULLE PART, ET QUI EST PROBABLEMENT LA RAISON
 // DU RETRAIT DE v42. Conserver l'altitude au cran ne suffit pas : encore
 // faut-il que le niveau ne descende pas PLUS qu'un cran ne rend. Un cran divise
 // l'emprise du bloc par deux — ×2 de distance, soit `ln 2`. Le budget valait
 // 1,2 (×3,32) : la caméra perdait ×1,66 de recul à chaque étage et venait se
 // coller au plancher `minDistance`.
 
 test('le budget du niveau vaut exactement un cran, dans les deux sens', () => {
-  assert.equal(STEP_IN, Math.LN2)
-  assert.equal(STEP_OUT, Math.LN2, "sinon l'aller-retour cliquette — voir le test ⑥")
-  assert.match(SRC_MODES, /export const STEP_IN = Math\.LN2/)
-  assert.match(SRC_MODES, /export const STEP_OUT = Math\.LN2/)
-  // « au moins 20 crans » (Adrien) est désormais DÉRIVÉ du budget, pas posé à
-  // côté de lui : un défilement continu délivre N × IMPULSE × TAU.
+  // ⚠️ **LE NOMBRE N'A PAS BOUGÉ, LE NOM SI — Tâche M.** Le budget du niveau
+  // vaut toujours `ln 2`, parce qu'un niveau divise l'emprise du bloc par deux.
+  // Ce qui a changé est qu'il ne s'appelle plus `STEP_IN` : `STEP_IN` est
+  // maintenant LE CRAN (×√2, D9), et confondre les deux valait « deux fois
+  // trop ».
+  assert.equal(BUDGET_NIVEAU, Math.LN2)
+  assert.match(SRC_MODES, /export const BUDGET_NIVEAU = PAS_NIVEAU/)
+  assert.equal(STEP_IN, Math.LN2 / 2)
+  assert.equal(STEP_OUT, STEP_IN, "sinon l'aller-retour cliquette — voir le test ⑥")
+  // « au moins 20 crans » (Adrien) est DÉRIVÉ du budget du NIVEAU, pas du cran :
+  // le cahier des charges de la Tâche M le dit — « le réglage porte sur le CRAN,
+  // pas sur le tour de molette ». La molette est donc inchangée au bit près.
   assert.match(SRC_MODES, /const CRANS_PAR_NIVEAU = 20/)
-  assert.match(SRC_MODES, /const ZOOM_IMPULSE = STEP_IN \/ \(CRANS_PAR_NIVEAU \* ZOOM_TAU\)/)
+  assert.match(SRC_MODES, /const ZOOM_IMPULSE = BUDGET_NIVEAU \/ \(CRANS_PAR_NIVEAU \* ZOOM_TAU\)/)
 })
 
 test('la caméra ne vient JAMAIS se coller au plancher de distance', () => {
   // Mesuré le 2026-08-20 : la distance de scène reste dans [31,32 ; 123,99]
   // unités, plancher `minDistance` = 6. Le rapport au plancher ne descend pas
   // sous ×5.
   //
   // ⚠️ DEUX CHIFFRES ONT CHANGÉ AVEC LA TÂCHE 1b, ET CE N'EST PAS UN RÉGLAGE DE
   // TOLÉRANCE. La plongée entre maintenant dans z4 à 62,6 unités (l'altitude
   // qu'elle avait en orbite) au lieu de z5 à 141 : le premier glissé descend
@@ -288,21 +300,21 @@ function allerRetour(z, d0, budgetIn, budgetOut) {
   const alt = (d) => (Y_CIBLE + d * pente) / echelle(z)
   const alt0 = alt(d0)
   let d = Math.max(d0 * Math.exp(-budgetIn), DISTANCE_MIN_SURFACE)
   d = poseCranContinu({ camY: Y_CIBLE + d * pente, pente, facteurEchelle: echelle(z + 1) / echelle(z) }).distanceCible
   d = Math.min(d * Math.exp(budgetOut), DISTANCE_MAX_SURFACE)
   d = poseCranContinu({ camY: Y_CIBLE + d * pente, pente, facteurEchelle: echelle(z) / echelle(z + 1) }).distanceCible
   return alt(d) / alt0
 }
 
 test('un cran de zoom puis un cran de dézoom ramènent où on était', () => {
-  const r = allerRetour(10, 77.5, STEP_IN, STEP_OUT)
+  const r = allerRetour(10, 77.5, BUDGET_NIVEAU, BUDGET_NIVEAU)
   assert.ok(Math.abs(r - 1) < 0.05, `l'aller-retour rend ×${r.toFixed(3)}`)
   assert.ok(Math.abs(r - 0.97) < 0.005, `mesuré ×0,970 — le résidu vient du y = ${Y_CIBLE} de la cible`)
 })
 
 test('MUTATION — un STEP_OUT plus court que STEP_IN fait CLIQUETER l’aller-retour', () => {
   // ⚠️ Mesuré : avec les anciens 1,2 / 0,55, un cran in + un cran out rendent
   // 14 326 m là où on était parti de 27 696 m. On revient DEUX FOIS PLUS BAS
   // qu'avant d'avoir zoomé, et rien ne le signale — l'ancien escalier n'en
   // souffrait pas parce que la téléportation remettait les deux directions au
   // même point de présentation.
diff --git a/test/exageration-globe.test.js b/test/exageration-globe.test.js
index 803179b..5b59c20 100644
--- a/test/exageration-globe.test.js
+++ b/test/exageration-globe.test.js
@@ -94,21 +94,21 @@ test('①b SUR LA VOIE DU BUDGET, et sur elle seule, la butée rend le cran vois
   // (superellipse contre octogone, écart NUL à 45°) — donc il ne prouve QUE
   // l'invariant restreint, et ①e existe pour couvrir le reste.
   //
   // L'invariant restreint : à la butée exacte `_levelZoom = ∓ln2`, `zc = z ± 1`
   // des deux côtés du cran, parce que `_resetZoom()` remet `_levelZoom` à zéro
   // pendant que `demZoom` avance de 1.
   for (let z = 3; z <= 14; z++) {
     assert.equal(zoomCran({ demZoom: z, zoomNiveau: -PAS_NIVEAU }), z + 1, `butée IN z=${z}`)
     assert.equal(zoomCran({ demZoom: z, zoomNiveau: +PAS_NIVEAU }), z - 1, `butée OUT z=${z}`)
   }
-  assert.equal(PAS_NIVEAU, Math.LN2, '`STEP_IN` de `modes.js` vaut `Math.LN2`')
+  assert.equal(PAS_NIVEAU, Math.LN2, '`BUDGET_NIVEAU` de `modes.js` vaut `Math.LN2`')
 })
 
 test('①c BORNÉ PAR CONSTRUCTION — même nourri d\'absurdités', () => {
   for (const l of [-100, -1e9, 100, 1e9, 1e-300]) {
     const zc = zoomCran({ demZoom: 9, zoomNiveau: l })
     assert.ok(zc >= 8 && zc <= 10, `_levelZoom=${l} → zc=${zc}, hors de [z-1, z+1]`)
   }
   // …et il ne rend jamais NaN sur une entrée illisible : il retombe sur le cran.
   for (const l of [NaN, undefined, null, 'x']) {
     assert.equal(zoomCran({ demZoom: 9, zoomNiveau: l }), 9, `_levelZoom=${l}`)
@@ -131,22 +131,25 @@ test('①d `_levelZoom` est bien remis à zéro à CHAQUE cran — sinon la born
   // TOUT `modes.js`, `/_levelZoom = 0/` tombait sur la ligne 222 — la
   // DÉCLARATION du champ dans le constructeur — et **vider entièrement
   // `_resetZoom()` la laissait verte**, alors que c'est exactement la propriété
   // dont dépend toute la borne. On la borne donc au CORPS de `_resetZoom`.
   const rz = src.indexOf('_resetZoom() {')
   assert.ok(rz > 0, '`_resetZoom` a disparu de `modes.js`')
   const corpsRz = src.slice(rz, src.indexOf('\n  }', rz))
   assert.ok(/this\._levelZoom\s*=\s*0/.test(corpsRz),
     '`_resetZoom` n\'écrase plus `_levelZoom` — la borne du pilote tombe en silence')
   // …et la butée du niveau est bien celle qu'on recopie.
-  assert.ok(/export const STEP_IN = Math\.LN2/.test(src), '`STEP_IN` a changé de valeur')
-  assert.ok(/export const STEP_OUT = Math\.LN2/.test(src), '`STEP_OUT` a changé de valeur')
+  // ⚠️ **C'EST `BUDGET_NIVEAU` QU'ON RECOPIE, PAS `STEP_IN` — Tâche M.** Les
+  // deux ne font plus qu'un nombre chacun : `STEP_IN` est le CRAN (×√2),
+  // `BUDGET_NIVEAU` le niveau de MNT (×2). Le pilote d'exagération borne son
+  // `_levelZoom` sur le NIVEAU.
+  assert.ok(/export const BUDGET_NIVEAU = PAS_NIVEAU/.test(src), '`BUDGET_NIVEAU` a changé de valeur')
 })
 
 test('①e LÀ OÙ L\'INVARIANT NE TIENT PAS — le saut est MESURÉ, pas nié', () => {
   const val = (z, f) => courbe(zoomCran({ demZoom: z, zoomNiveau: -f * PAS_NIVEAU }))
   const saut = (z, f) => Math.abs(val(z + 1, 0) - val(z, f)) / val(z, f)
 
   // (a) LA VOIE DU BUDGET, à la butée EXACTE : écart NUL, à tous les zooms.
   let pireExact = 0
   for (let z = 3; z <= 14; z++) pireExact = Math.max(pireExact, saut(z, 1))
   assert.equal(pireExact, 0, `la butée exacte devrait être continue : ${pireExact}`)
@@ -169,21 +172,21 @@ test('①e LÀ OÙ L\'INVARIANT NE TIENT PAS — le saut est MESURÉ, pas nié',
 
   // (d) LA GARDE DE SOURCE — les trois voies sont bien celles de `modes.js`. Si
   //     l'une disparaît ou s'ajoute, cet invariant doit être relu.
   const src = sansCommentaires(lire('src/modes.js'))
   const ligne = /const atInLimit = ([^\n]+)/.exec(src)
   assert.ok(ligne, '`atInLimit` a disparu — les voies de déclenchement ont changé')
   assert.equal((ligne[1].match(/\|\|/g) || []).length, 2,
     `\`atInLimit\` n'a plus trois voies : ${ligne[1]}`)
   assert.ok(/minDistance/.test(ligne[1]), '`atInLimit` ne lit plus `minDistance`')
   assert.ok(/nearGround/.test(ligne[1]), '`atInLimit` ne lit plus `nearGround`')
-  assert.ok(/STEP_IN\s*\+\s*0\.03/.test(ligne[1]), 'la tolérance de 0,03 a changé — (b) est à refaire')
+  assert.ok(/BUDGET_NIVEAU\s*\+\s*0\.03/.test(ligne[1]), 'la tolérance de 0,03 a changé — (b) est à refaire')
 })
 
 // ══════════ ② IL NE REFERME AUCUNE BOUCLE — ET C'EST MESURÉ ═════════════════
 
 test('② le nouveau pilote ne voit ni exagération, ni échelle, ni distance', () => {
   const src = sansCommentaires(lire('src/monde/exageration-continue.js'))
   const debut = src.indexOf('export function zoomCran')
   assert.ok(debut > 0, '`zoomCran` a disparu')
   const corps = src.slice(debut, src.indexOf('\n}', debut))
   for (const interdit of [/exag/i, /echelle/i, /distance/i, /camY/]) {
diff --git a/test/zoom-continu.test.js b/test/zoom-continu.test.js
new file mode 100644
index 0000000..edda86a
--- /dev/null
+++ b/test/zoom-continu.test.js
@@ -0,0 +1,736 @@
+// ══════════════════════════════════════════════════════════════════════════
+// LA MORT DES PALIERS — Tâche M du plan « LE STUDIO SUR LE GLOBE »
+//
+// **Adrien, 2026-08-22 :** *« Le mouvement de caméra du ciel à la terre comme
+// évoqué, on supprime toutes les zones, ultra important, fais-le. […] Je ne veux
+// aucun saut, aucun rechargement de la terre. […] vire absolument ton système de
+// saut de niveau !!! »*
+//
+// ⚠️ **CE FICHIER MESURE `altitudeFondM`, PAS `altitudeSurfaceM`, ET C'EST TOUT
+// L'INTÉRÊT.** `test/camera-continue.test.js` et `test/escalier-surface.test.js`
+// rejouent `altitudeSurfaceM`, que le cran CONSERVE PAR CONSTRUCTION depuis la
+// Tâche 2 bis : ces bancs-là ne peuvent structurellement plus voir un saut.
+// Sous `?terre=unique`, ce que l'écran montre est la caméra de FOND, dont
+// l'altitude est `camY × emprise / span` (`monde/frontiere-rendu.js`).
+// ══════════════════════════════════════════════════════════════════════════
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import fs from 'node:fs'
+import path from 'node:path'
+import { fileURLToPath } from 'node:url'
+
+import {
+  PAS_CRAN,
+  PAS_NIVEAU,
+  EXAGERATION_UNIQUE,
+  facteurCran,
+  franchissement,
+  camYApresNiveau,
+  poseApresNiveau,
+  camYPourAltitudeFond,
+  distancePourAltitudeFond,
+  niveauDArrivee,
+  profilDescenteFond,
+} from '../src/monde/zoom-continu.js'
+import { sautsDuProfil, empriseBlocM, distanceArrivee, PENTE_ARRIVEE_Y, Y_CIBLE } from '../src/loi-altitude.js'
+import { altitudeFondM } from '../src/monde/frontiere-rendu.js'
+import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
+import { STEP_IN, STEP_OUT } from '../src/modes.js'
+
+// ⚠️ **UN CANEVAS DE PACOTILLE, ET RIEN DE PLUS.** Le constructeur de `Globe`
+// appelle `rebuildRamp`, qui demande un canevas 512×1 pour cuire la rampe
+// hypsométrique. Ce fichier n'a besoin d'aucun pixel : il ne mesure que la
+// décision de parcours (`_horsCropSeul`). Même stub que
+// `test/globe-eviction.test.js`, réduit à ce que `rebuildRamp` touche.
+globalThis.document = globalThis.document ?? {
+  createElement() {
+    const c = { width: 0, height: 0, style: {} }
+    c.getContext = () => ({
+      createLinearGradient: () => ({ addColorStop() {} }),
+      fillRect() {}, drawImage() {},
+      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
+      set fillStyle(v) {}, get fillStyle() { return '#000' },
+    })
+    return c
+  },
+}
+
+const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
+const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
+const SRC_MODES = lire('src/modes.js')
+const SRC_MAIN = lire('src/main.js')
+const SRC_GLOBE = lire('src/globe.js')
+const SRC_EXAG = lire('src/monde/exageration-continue.js')
+
+// La table de paliers d'exagération du dépôt — celle qui faisait sauter la vue.
+const EXAG_PALIERS = (z) => ({ 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 })[z] ?? 2.8
+
+const VOL = {
+  altDepartM: 1600000,
+  lat: 45.8326, // Mont-Blanc — le vol de référence du §0 du plan
+  span: 56,
+  pente: PENTE_ARRIVEE_Y,
+  yCible: Y_CIBLE,
+  zoomFin: 15,
+}
+
+// ══════════ ① LA LOI DE ZOOM — MESURÉE, PAS CHOISIE ═════════════════════════
+
+test('① la moyenne géométrique des 18 intervalles d’Adrien est √2 à 0,12 % près', () => {
+  // Les DEUX bornes publiées de son relevé Google Earth, et le nombre
+  // d'intervalles. Rien d'autre n'est recopié : la moyenne se RECALCULE.
+  const haut = 63170e3
+  const bas = 126e3
+  const intervalles = 18
+  const rapportGlobal = haut / bas
+  assert.equal(Math.round(rapportGlobal * 100) / 100, 501.35, 'le rapport global publié')
+  const moyenneGeo = rapportGlobal ** (1 / intervalles)
+  assert.equal(Math.round(moyenneGeo * 1e5) / 1e5, 1.41256, 'la moyenne géométrique publiée')
+  // ⚠️ **L'ÉCART SE MESURE SUR LE RAPPORT, PAS SUR SON LOGARITHME** — 0,12 % sur
+  // le rapport, 0,34 % sur le log. Le dénominateur est le rapport mesuré.
+  const ecart = Math.abs(Math.SQRT2 - moyenneGeo) / moyenneGeo
+  assert.ok(ecart < 0.0013, `√2 est à ${(ecart * 100).toFixed(3)} % de la mesure`)
+  // et c'est CE nombre-là que le module pose
+  assert.equal(PAS_CRAN, Math.LN2 / 2)
+  assert.ok(Math.abs(Math.exp(PAS_CRAN) - Math.SQRT2) < 1e-15)
+})
+
+test('① le rapport est CONSTANT — ce qui rétrécit est l’écart en kilomètres', () => {
+  // ⚠️ **LE PIÈGE NOMMÉ DANS LE CAHIER DES CHARGES** : une loi « de moins en
+  // moins forte » casserait la stabilité qu'Adrien admire. On rejoue sa
+  // descente à rapport constant et on vérifie les DEUX faits ensemble.
+  let alt = 63170e3
+  const ecarts = []
+  const rapports = []
+  for (let i = 0; i < 18; i++) {
+    const suivant = alt / Math.SQRT2
+    ecarts.push(alt - suivant)
+    rapports.push(alt / suivant)
+    alt = suivant
+  }
+  // le rapport ne bouge pas d'un bit
+  assert.equal(new Set(rapports.map((r) => r.toFixed(12))).size, 1)
+  // l'écart, lui, fond. ⚠️ **CE MODÈLE EST LE √2 PUR, PAS LE RELEVÉ** : Adrien
+  // a compté 18 153 km au premier cran et 51 km au dernier ; le √2 pur en rend
+  // 18 502 et 51. Le premier diffère de 1,9 % (les 0,12 % du rapport, cumulés
+  // sur le premier intervalle du relevé, qui vaut 1,4600 et non 1,41256) — et
+  // c'est exactement pourquoi le chiffre du relevé n'est PAS recopié ici.
+  assert.equal(Math.round(ecarts[0] / 1000), 18502)
+  assert.equal(Math.round(ecarts[17] / 1000), 51)
+  assert.ok(ecarts[0] / ecarts[17] > 300, 'l’écart en km est divisé par plus de 300')
+})
+
+test('① le CRAN et le NIVEAU DE MNT sont deux grandeurs, pas une', () => {
+  // ⛔ Le dépôt les confondait sous `STEP_IN`. Le niveau de MNT vaut ×2 par
+  // construction (la grille de tuiles) ; le cran vaut ×√2 (la mesure d'Adrien).
+  assert.equal(PAS_NIVEAU, Math.LN2)
+  assert.equal(PAS_CRAN, PAS_NIVEAU / 2)
+  assert.equal(STEP_IN, Math.LN2 / 2, 'le dépôt posait Math.LN2 — deux fois trop')
+  assert.equal(STEP_OUT, STEP_IN, 'sinon l’aller-retour cliquette')
+  assert.match(SRC_MODES, /export const STEP_IN = PAS_CRAN/)
+  assert.match(SRC_MODES, /export const STEP_OUT = PAS_CRAN/)
+})
+
+test('① un cran et son retour rendent EXACTEMENT le point de départ', () => {
+  const d0 = 77.5
+  const d = d0 * facteurCran(1) * facteurCran(-1)
+  assert.ok(Math.abs(d - d0) < 1e-12, `${d} ≠ ${d0}`)
+  assert.equal(Math.round(facteurCran(1) * 1e6) / 1e6, Math.round((1 / Math.SQRT2) * 1e6) / 1e6)
+  assert.equal(Math.round(facteurCran(-1) * 1e6) / 1e6, Math.round(Math.SQRT2 * 1e6) / 1e6)
+})
+
+// ══════════ ② LE FRANCHISSEMENT — UNE DIVISION, PLUS UNE TABLE ══════════════
+
+test('② le niveau se DÉDUIT du budget dépensé : aucune table consultée', () => {
+  assert.deepEqual(franchissement(0), { niveaux: 0, reste: 0 })
+  // pas encore un niveau plein : on ne franchit pas
+  assert.equal(franchissement(-PAS_NIVEAU * 0.99).niveaux, 0)
+  // un niveau plein en zoom AVANT → on affine d'un cran, le compteur repart à 0
+  const f = franchissement(-PAS_NIVEAU)
+  assert.equal(f.niveaux, 1)
+  assert.ok(Math.abs(f.reste) < 1e-12)
+  // deux niveaux d'un coup (un glissé rapide) → deux crans, pas un
+  assert.equal(franchissement(-2 * PAS_NIVEAU - 0.01).niveaux, 2)
+  // et l'autre sens
+  assert.equal(franchissement(PAS_NIVEAU).niveaux, -1)
+  assert.equal(franchissement(PAS_NIVEAU * 0.99).niveaux, 0)
+})
+
+test('② l’hystérésis est SYMÉTRIQUE et vaut un facteur 2 — sans seuil à régler', () => {
+  // affiner à −ln2, élargir à +ln2 : après un affinage le compteur repart à
+  // zéro, il faut donc remonter d'un facteur 2 complet pour élargir. Aucun
+  // battement possible.
+  let budget = -PAS_NIVEAU
+  let zoom = 12
+  let f = franchissement(budget)
+  zoom += f.niveaux
+  budget = f.reste
+  assert.equal(zoom, 13)
+  // on remonte de 0,99 niveau : rien
+  budget += PAS_NIVEAU * 0.99
+  assert.equal(franchissement(budget).niveaux, 0, 'pas de battement à la frontière')
+  // on insiste jusqu'au niveau plein : on élargit, et on revient à z12
+  budget += PAS_NIVEAU * 0.01
+  f = franchissement(budget)
+  zoom += f.niveaux
+  assert.equal(zoom, 12)
+})
+
+// ══════════ ③ LE CHANGEMENT D'UNITÉS — L'INVARIANT EST L'ALTITUDE DE FOND ═══
+
+test('③ franchir un niveau ne bouge PAS l’altitude de fond', () => {
+  const span = 56
+  const empriseAvant = empriseBlocM({ zoom: 10, lat: 45.8326 })
+  const empriseApres = empriseBlocM({ zoom: 11, lat: 45.8326 })
+  const camY = 38.5
+  const avant = altitudeFondM({ camY, extentMeters: empriseAvant, span })
+  const apres = altitudeFondM({
+    camY: camYApresNiveau({ camY, empriseAvant, empriseApres }),
+    extentMeters: empriseApres,
+    span,
+  })
+  assert.ok(Math.abs(apres / avant - 1) < 1e-12, `${apres} ≠ ${avant}`)
+})
+
+test('③ MUTATION — reposer sur l’échelle VERTICALE rouvre l’accrochage', () => {
+  // ⚠️ **C'EST LE DÉFAUT QUE LA TÂCHE RÉPARE, REJOUÉ.** `poseCranContinu`
+  // multiplie `camY` par `échelleAprès / échelleAvant`, où l'échelle porte
+  // l'exagération. Avec la table de paliers du dépôt, l'altitude de fond est
+  // multipliée par le RAPPORT DES EXAGÉRATIONS — jusqu'à ×2 au cran z4 → z5.
+  const span = 56
+  const lat = 45.8326
+  const cas = [
+    [4, 5, 2], // 5 / 2,5
+    [5, 6, 0.8], // 4 / 5
+    [6, 7, 0.8], // 3,2 / 4
+    [7, 8, 0.875], // 2,8 / 3,2
+  ]
+  for (const [za, zb, attendu] of cas) {
+    const ea = empriseBlocM({ zoom: za, lat })
+    const eb = empriseBlocM({ zoom: zb, lat })
+    const echelleA = (span / ea) * EXAG_PALIERS(za)
+    const echelleB = (span / eb) * EXAG_PALIERS(zb)
+    const camY = 40
+    const altA = altitudeFondM({ camY, extentMeters: ea, span })
+    const altB = altitudeFondM({ camY: camY * (echelleB / echelleA), extentMeters: eb, span })
+    assert.ok(Math.abs(altB / altA - attendu) < 1e-9, `z${za}→z${zb} : ${(altB / altA).toFixed(4)}`)
+  }
+  // … et la loi de cette tâche ne dépend PAS de l'exagération : mêmes crans,
+  // rapport 1 partout.
+  for (const [za, zb] of cas) {
+    const ea = empriseBlocM({ zoom: za, lat })
+    const eb = empriseBlocM({ zoom: zb, lat })
+    const altA = altitudeFondM({ camY: 40, extentMeters: ea, span })
+    const altB = altitudeFondM({
+      camY: camYApresNiveau({ camY: 40, empriseAvant: ea, empriseApres: eb }),
+      extentMeters: eb,
+      span,
+    })
+    assert.ok(Math.abs(altB / altA - 1) < 1e-12)
+  }
+})
+
+test('③ la pose garde la pente, donc l’angle de vue de l’utilisateur', () => {
+  const p = poseApresNiveau({
+    camY: 40,
+    pente: 0.5,
+    empriseAvant: 1000,
+    empriseApres: 500,
+    yCible: -0.3,
+  })
+  assert.equal(p.pente, 0.5)
+  assert.equal(p.camY, 80)
+  assert.equal(p.distanceCible, (80 + 0.3) / 0.5)
+})
+
+// ══════════ ④ LA PLONGÉE — L'AUTRE MOITIÉ DU SAUT ═══════════════════════════
+
+test('④ la traversée orbite → surface conserve l’altitude de fond', () => {
+  const span = 56
+  const extentMeters = empriseBlocM({ zoom: 8, lat: 45.8326 })
+  const altM = 260000
+  const camY = camYPourAltitudeFond({ altM, extentMeters, span })
+  assert.ok(Math.abs(altitudeFondM({ camY, extentMeters, span }) / altM - 1) < 1e-12)
+  const d = distancePourAltitudeFond({ altM, extentMeters, span, pente: PENTE_ARRIVEE_Y, yCible: Y_CIBLE })
+  assert.ok(Math.abs(Y_CIBLE + d * PENTE_ARRIVEE_Y - camY) < 1e-9)
+})
+
+test('④ MUTATION — conserver l’altitude de SURFACE fait sauter la traversée ×exag', () => {
+  // ⛔ Le dépôt pose `camY = altM × echelleV` avec `echelleV` VERTICALE : le
+  // champ visuel saute alors d'un facteur `exagération(z)`, ce que
+  // `loi-altitude.js` nommait « une question, pas un oubli ». Sous D10 il vaut
+  // toujours ×2 — un saut, même avec l'exagération figée.
+  const span = 56
+  const extentMeters = empriseBlocM({ zoom: 8, lat: 45.8326 })
+  const altM = 260000
+  for (const exag of [2, 2.8, 5]) {
+    const camY = altM * (span / extentMeters) * exag
+    const rendu = altitudeFondM({ camY, extentMeters, span })
+    assert.ok(Math.abs(rendu / altM - exag) < 1e-9, `exag ${exag} → saut ×${(rendu / altM).toFixed(3)}`)
+  }
+})
+
+test('④ la porte orbitale est GÉOMÉTRIQUE — plus une altitude écrite à la main', () => {
+  const n = niveauDArrivee({
+    altM: 1600000, ...VOL, zoomMin: 3, zoomMax: 15, distanceMin: 6, distanceMax: 150,
+  })
+  assert.equal(n.borne, null)
+  assert.ok(n.zoom >= 3 && n.zoom <= 15)
+  // au-dessus, plus aucun niveau ne tient : c'est la porte, et elle se déduit
+  const trop = niveauDArrivee({
+    altM: 5e7, ...VOL, zoomMin: 3, zoomMax: 15, distanceMin: 6, distanceMax: 150,
+  })
+  assert.equal(trop.borne, 'haut')
+  // et l'altitude de fond de l'arrivée est bien celle qu'on quittait
+  const e = empriseBlocM({ zoom: n.zoom, lat: VOL.lat })
+  const camY = Y_CIBLE + n.distanceCible * PENTE_ARRIVEE_Y
+  assert.ok(Math.abs(altitudeFondM({ camY, extentMeters: e, span: 56 }) / 1600000 - 1) < 1e-9)
+})
+
+// ══════════ ⑤ LE COMPTAGE DES SAUTS — LE CRITÈRE D'ADRIEN ═══════════════════
+
+test('⑤ LE CRITÈRE — la descente par paliers saute, la descente continue non', () => {
+  // ⚠️ **LE SEUIL EST CELUI DE LA TÂCHE 1a** (`facteurMin = 1,15`) et le profil
+  // est le MÊME code des deux côtés : seule la LOI change.
+  const paliers = profilDescenteFond({ ...VOL, regime: 'paliers', exag: EXAG_PALIERS })
+  const continu = profilDescenteFond({ ...VOL, regime: 'continu' })
+  const sautsPaliers = sautsDuProfil(paliers)
+  const sautsContinu = sautsDuProfil(continu)
+  assert.ok(sautsPaliers.length >= 4, `paliers : ${sautsPaliers.length} sauts`)
+  assert.equal(sautsContinu.length, 0, `continu : ${JSON.stringify(sautsContinu.slice(0, 3))}`)
+  // et le plus gros saut du dépôt est bien la traversée, pas un cran
+  const pire = sautsPaliers.reduce((a, b) => (b.facteur > a.facteur ? b : a))
+  assert.equal(pire.cause, 'plongee')
+})
+
+test('⑤ MÊME AU SEUIL LE PLUS FIN, la descente continue ne saute pas', () => {
+  // ⚠️ **UN SEUIL DE 1,15 EST GÉNÉREUX** : un banc qui ne rendrait rien
+  // passerait aussi. On resserre à 1,001 — 0,1 % d'une image à l'autre — et on
+  // vérifie que le profil n'est PAS vide, sans quoi « zéro saut » ne prouverait
+  // rien (règle du §0 : « un témoin nul est soit une preuve, soit un banc qui ne
+  // rend rien — dire lequel »).
+  // ⚠️ **LE DÉNOMINATEUR DE CE SEUIL EST LE PAS D'ÉCHANTILLONNAGE.** Le profil
+  // échantillonne les segments continus à ×1,002 d'un point au suivant : un
+  // seuil sous 1,002 compterait l'échantillonnage lui-même comme un saut (essayé
+  // à 1,001 : 360 « sauts », tous faux). 1,003 est donc le plus fin que cet
+  // instrument résolve, et il vaut 0,3 % d'une image à l'autre.
+  const continu = profilDescenteFond({ ...VOL, regime: 'continu', ratioMax: 1.002 })
+  assert.ok(continu.length > 3000, `le profil compte ${continu.length} points`)
+  assert.ok(continu.filter((p) => p.transition === 'cran').length >= 6, 'il y a bien des crans')
+  assert.equal(continu.filter((p) => p.transition === 'plongee').length, 1)
+  assert.equal(sautsDuProfil(continu, { facteurMin: 1.003 }).length, 0)
+  // le même seuil sur le dépôt en compte quatre — les mêmes qu'à 1,15
+  const paliers = profilDescenteFond({ ...VOL, regime: 'paliers', exag: EXAG_PALIERS, ratioMax: 1.002 })
+  assert.ok(sautsDuProfil(paliers, { facteurMin: 1.003 }).length >= 4)
+})
+
+test('⑤ la descente continue va de l’orbite au SOL, et l’altitude ne remonte jamais', () => {
+  const continu = profilDescenteFond({ ...VOL, regime: 'continu' })
+  const alts = continu.map((p) => p.altM)
+  assert.equal(alts[0], VOL.altDepartM)
+  assert.ok(alts[alts.length - 1] < 1500, `arrivée à ${Math.round(alts[alts.length - 1])} m`)
+  // ⚠️ **AUCUN RECUL** : le dépôt en avait, « 685 623 m rendus à l'envers sur
+  // une descente de 1 600 km » (modes.js). Ici l'altitude est monotone.
+  const reculs = alts.filter((a, i) => i > 0 && a > alts[i - 1] * (1 + 1e-9)).length
+  assert.equal(reculs, 0)
+})
+
+// ══════════ ⑥ LE BRANCHEMENT — LÀ OÙ QUATRE TÂCHES D'AFFILÉE ONT ÉCHOUÉ ═════
+//
+// ⚠️ **LA FAIBLESSE RÉCURRENTE DE CE CHANTIER EST LE BRANCHEMENT** : du code
+// juste, jamais appelé. Ces assertions-ci mordent sur la SOURCE des trois
+// fichiers de plomberie, parce qu'aucun test ne peut charger `main.js`.
+
+test('⑥ le drapeau du zoom continu est lu UNE fois et passé par un crochet', () => {
+  // un seul lecteur, comme `terreUniqueBranchee` lui-même
+  assert.match(SRC_MAIN, /zoomContinu: \(\) => terreUniqueBranchee/)
+  // et `modes.js` ne connaît QUE le crochet : il n'importe pas `flags.js`
+  assert.doesNotMatch(SRC_MODES, /from '\.\/flags\.js'/)
+  assert.match(SRC_MODES, /_continu\(\) \{\s*\n\s*return this\.hooks\.zoomContinu\?\.\(\) === true/)
+})
+
+test('⑥ le glissé ne se fait plus BORNER par le budget du niveau', () => {
+  // ⛔ C'est ÇA, « le cran » qu'Adrien sent : le glissé s'arrêtait à la butée du
+  // niveau et il fallait re-défiler pour franchir. Sous le drapeau, la garde est
+  // débranchée et le franchissement devient automatique.
+  assert.match(SRC_MODES, /_franchirSiBesoin\(\) \{/)
+  // la butée du glissé est conditionnée au régime…
+  assert.match(SRC_MODES, /if \(!this\._continu\(\)\) \{\n\s*if \(this\._levelZoom \+ dLog < -BUDGET_NIVEAU\)/)
+  // … et le franchissement est appelé APRÈS le déplacement de cette image
+  const app = SRC_MODES.slice(SRC_MODES.indexOf('  _applyZoom(dt) {'))
+  const corpsApply = app.slice(0, app.indexOf('\n  }\n'))
+  assert.ok(corpsApply.lastIndexOf('this._franchirSiBesoin()') > corpsApply.indexOf('c.update()'))
+  // les deux branches de la molette qui franchissaient « à la fraîche » sont
+  // neutralisées sous le drapeau — c'est le « re-scroll pour passer » qui meurt
+  assert.match(SRC_MODES, /const atInLimit = !continu &&/)
+  assert.match(SRC_MODES, /const atOutLimit = !continu &&/)
+})
+
+test('⑥ la conversion d’unités tombe sur la MÊME image que le changement', () => {
+  // ⚠️ **LE DÉFAUT MESURÉ QUE ÇA FERME** : `largeurBlocM()` est divisée par deux
+  // UNE IMAGE avant que la caméra ne suive — onze bascules du seuil du socle au
+  // lieu d'une. Le suiveur est donc appelé EN TÊTE d'`update`, avant que
+  // `majSeuilSocle()` et `majCameraFond()` ne lisent quoi que ce soit.
+  assert.match(SRC_MODES, /_suivreEmprise\(\) \{/)
+  assert.match(SRC_MODES, /update\(dt\) \{[\s\S]{0,700}?this\._suivreEmprise\(\)/)
+  const suiv = SRC_MODES.slice(SRC_MODES.indexOf('  _suivreEmprise() {'))
+  assert.match(suiv.slice(0, suiv.indexOf('\n  }\n')), /poseApresNiveau/)
+  // et `main.js` appelle bien `modes.update` avant les deux lecteurs d'altitude
+  const iUpdate = SRC_MAIN.indexOf('modes.update(dt)')
+  assert.ok(iUpdate > 0 && iUpdate < SRC_MAIN.indexOf('  majSeuilSocle()'))
+  assert.ok(iUpdate < SRC_MAIN.indexOf('  majCameraFond()'))
+})
+
+test('⑥ le franchissement ne remet PAS l’élan à zéro sous le drapeau', () => {
+  // `_resetZoom()` tuait l'inertie à chaque cran : le glissé repartait de zéro,
+  // et c'est la moitié de la sensation d'accrochage.
+  const bloc = SRC_MODES.slice(SRC_MODES.indexOf('  async _rescale(next, verb'))
+  const corps = bloc.slice(0, bloc.indexOf('\n  }\n'))
+  assert.match(corps, /if \(!continu\) this\._resetZoom\(\)/)
+  // ⚠️ et le cran ne repose PAS la caméra lui-même : il rend la main au suiveur
+  // d'unités, seul écrivain de la conversion.
+  assert.match(corps, /if \(continu\) \{ this\._suivreEmprise\(\); this\.busy = false; return \}/)
+  // ⚠️ **LA FORME D'APPEL, PAS LA MENTION** : le commentaire au-dessus nomme
+  // `poseCranContinu` pour dire pourquoi on ne l'emploie plus. L'APPEL, lui, est
+  // après le retour anticipé — donc hors du chemin continu.
+  assert.ok(corps.indexOf('poseCranContinu({') > corps.indexOf('if (continu) {'))
+  // et le glissé n'est plus gelé pendant le chargement
+  assert.match(SRC_MODES, /\(!this\.busy \|\| this\._continu\(\)\) && Math\.abs\(this\._zoomVel\)/)
+})
+
+test('⑥ l’exagération est FIXE sous le drapeau, donc la planète ne se recharge plus', () => {
+  // ⚠️ **C'EST LA RÉPONSE EXACTE À LA QUESTION D'ADRIEN** (« pourquoi toute la
+  // terre se recharge »). `setExaggeration` → `_rechargeTuiles` rend au réseau
+  // TOUTES les tuiles prêtes ; `majExageration` ne l'appelle que si la valeur a
+  // bougé. Une constante ne bouge jamais.
+  assert.match(SRC_MAIN, /creerExagerationPartagee\(\{[\s\S]*?constante: terreUniqueBranchee \? EXAGERATION_UNIQUE : null/)
+  assert.match(SRC_EXAG, /if \(partage\?\.constante > 0\) return partage\.valeur/)
+  // ⚠️ **LES TROIS ÉCRIVAINS SONT GELÉS, PAS UN SEUL** : `majExagerationCadrage`
+  // et `majExagerationCran` passent par `majExageration`, et `poserExageration`
+  // (l'écrivain du chemin plat, rappelé à CHAQUE chargement de bloc) a sa propre
+  // garde. En oublier un ramènerait le rechargement au premier cran.
+  assert.equal((SRC_EXAG.match(/if \(partage\?\.constante > 0\) return partage\.valeur/g) ?? []).length, 2)
+  // et le seul autre appelant de `_rechargeTuiles` reste intact
+  assert.match(SRC_GLOBE, /rechargeApresContexte\(\) \{\n\s*this\._rechargeTuiles\(\)/)
+})
+
+test('⑥ l’exagération unique est posée à la construction, pas au premier cran', () => {
+  // une valeur de départ différente de la constante ferait UN rechargement au
+  // démarrage — le seul qu'on ne verrait pas passer, et il coûterait la planète.
+  assert.match(SRC_EXAG, /valeur: constante > 0\n\s*\? Number\(constante\)/)
+  // ⚠️ **ET LE GLOBE LA LIT À SA CONSTRUCTION** : `this.exaggeration =
+  // lireExageration(params)` — donc il naît déjà à 2 et ne se recharge pas.
+  assert.match(SRC_GLOBE, /this\.exaggeration = this\.exagSuivie\n\s*\? lireExageration\(params\)/)
+  const iPartage = SRC_MAIN.indexOf('const exagPartage = creerExagerationPartagee({')
+  assert.ok(iPartage > 0 && iPartage < SRC_MAIN.indexOf('globe = new Globe({'))
+})
+
+test('⑥ l’indicateur ORB / Z{n} ne se construit plus sous le drapeau', () => {
+  assert.match(SRC_MAIN, /const zoomStepper = terreUniqueBranchee \? null : buildZoomStepper\(\{/)
+  assert.match(SRC_MAIN, /zoomStepper\?\.update\(\)/)
+  // ⚠️ le chemin plat garde le sien — c'est une SAUVEGARDE, pas un chemin mort
+  assert.match(SRC_MAIN, /label: 'ORB'/)
+})
+
+test('⑥ `_orbitNotch` et son 1,7 inventé ont disparu au profit de la loi mesurée', () => {
+  // ⚠️ **LA MÉTHODE, PAS SA MENTION** : deux commentaires la nomment encore, et
+  // c'est de la documentation — le §0 exige qu'on retire le CODE mort, pas la
+  // trace de ce qu'il faisait.
+  assert.doesNotMatch(SRC_MODES, /_orbitNotch\(dir\) \{/)
+  assert.doesNotMatch(SRC_MODES, /this\._orbitNotch\(/)
+  assert.doesNotMatch(SRC_MODES, /1 \/ 1\.7/)
+  assert.match(SRC_MODES, /cranZoom\(dir\) \{/)
+  assert.match(SRC_MODES, /facteurCran\(dir\)/)
+  // les deux boutons de l'IHM passent par le cran, dans les deux modes
+  assert.match(SRC_MODES, /stepFiner\(\) \{\n\s*this\.cranZoom\(1\)/)
+  assert.match(SRC_MODES, /stepWider\(\) \{\n\s*this\.cranZoom\(-1\)/)
+})
+
+test('⑥ la traversée ne passe plus par le fondu au blanc sous le drapeau', () => {
+  // 480 ms d'aller + 480 ms de retour de rideau : c'est le saut le plus visible
+  // de tous, et il n'a plus rien à masquer.
+  assert.match(SRC_MODES, /_whiteout\(swap\) \{\s*\n\s*if \(this\._continu\(\)\) return Promise\.resolve\(\)\.then\(swap\)/)
+})
+
+// ══════════ ⑦ LA FORME RÉELLE, PAS CELLE QUI ARRANGE ════════════════════════
+
+test('⑦ le crochet est appelé comme la production l’appelle : par FONCTION', () => {
+  // ⚠️ **LE TEST FAIBLE QU'UNE TÂCHE PRÉCÉDENTE A TROUVÉ** : tous ses tests
+  // passaient le globe PAR SA VALEUR alors que la production le passe PAR UNE
+  // FONCTION — la faute était invisible sous la seule forme que la production
+  // n'emploie pas. Ici on vérifie que `zoomContinu` est bien un CROCHET
+  // (rappelé à chaque lecture), pas un booléen figé à la construction.
+  assert.doesNotMatch(SRC_MODES, /this\._zoomContinu = /)
+  assert.match(SRC_MODES, /this\.hooks\.zoomContinu\?\.\(\)/)
+  // et il est lu à plus d'un endroit — donc figer sa valeur se verrait
+  assert.ok((SRC_MODES.match(/this\._continu\(\)/g) ?? []).length >= 4)
+})
+
+// ══════════ ⑧ N'AFFINER QUE LA ZONE VISÉE — volet ④ ═════════════════════════
+//
+// **Adrien, 2026-08-22 :** *« Il n'y a qu'à améliorer la zone sur laquelle on
+// zoome et pas le reste, limite les zones à améliorer. »*
+//
+// ⚠️ **MESURÉ AVANT D'ÊTRE CODÉ**, dans l'application vivante, descente
+// 1 600 km → 3 km, `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1` :
+// **9 456 tuiles demandées, dont 5 081 HORS du crop — 53,7 %** (et 901 demandées
+// alors qu'aucun crop n'était posé, donc légitimes). Données brutes :
+// `.banc/vues-M/AV4-trafic.json`. ⚠️ **Le dénominateur est le nombre d'APPELS À
+// `_request`, pas des octets** : une tuile redemandée après éviction compte deux
+// fois, et « hors crop » est le test de BOÎTE `tuileDansCrop`, le même que
+// `zoomCropPrescrit`.
+
+test('⑧ à estompage PLEIN, le dehors n’est plus parcouru — il est déjà invisible', async () => {
+  const { Globe } = await import('../src/globe.js')
+  const g = new Globe({ globeContinu: true })
+  g.poserCrop({ centre: { lat: -21.1, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
+  // ⚠️ **LA TUILE TÉMOIN EST UNE RACINE z2 AUX ANTIPODES DU CROP** : elle est
+  // hors de la boîte quel que soit l'arrondi de la grille, donc l'assertion ne
+  // dépend d'aucun indice calculé à la main.
+  assert.equal(g.estompePlein(), false, 'sans `poserEstompage`, la production n’est pas touchée')
+  assert.equal(g._horsCropSeul(2, 0, 0), false)
+  g.poserEstompage(1)
+  assert.equal(g.estompePlein(), true)
+  assert.equal(g._horsCropSeul(2, 0, 0), true, 'une racine aux antipodes reste parcourue à estompage plein')
+  // … et en cours de fondu, rien n'est coupé : c'est le prix de dessiner la
+  // Terre autour, et c'est le sujet même de la Tâche G.
+  g.poserEstompage(0.999)
+  assert.equal(g.estompePlein(), false)
+  assert.equal(g._horsCropSeul(2, 0, 0), false)
+  g.dispose()
+})
+
+test('⑧ MUTATION — lire `uEstompage` sans `uEstompageOn` couperait la PRODUCTION', () => {
+  // ⚠️ **`uEstompage` VAUT 1 PAR DÉFAUT** (`globe.js`, « ET `uEstompage` PART À
+  // 1, PAS À 0 »). Un `estompePlein()` qui ne lirait que la valeur rendrait donc
+  // `true` sur une planète où l'estompage n'a JAMAIS été posé — c'est-à-dire la
+  // vue orbitale de `shibumap.com`, dont le dehors disparaîtrait.
+  assert.match(SRC_GLOBE, /uEstompageOn: \{ value: 0 \}/)
+  assert.match(SRC_GLOBE, /uEstompage: \{ value: 1 \}/)
+  assert.match(SRC_GLOBE, /return u\.uEstompageOn\.value > 0\.5 && u\.uEstompage\.value >= 1/)
+})
+
+test('⑧ la coupe de la Tâche N et celle-ci se CUMULENT, aucune ne remplace l’autre', async () => {
+  const { Globe } = await import('../src/globe.js')
+  const g = new Globe({ globeContinu: true })
+  g.poserCrop({ centre: { lat: -21.1, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
+  // repos SANS estompage plein (au-dessus de la bande) : la Tâche N coupe
+  g.poserCropSeul(true)
+  assert.equal(g._horsCropSeul(2, 0, 0), true)
+  // en mouvement AVEC estompage plein (une descente) : cette tâche-ci coupe
+  g.poserCropSeul(false)
+  g.poserEstompage(1)
+  assert.equal(g._horsCropSeul(2, 0, 0), true)
+  // ni l'un ni l'autre : la planète entière, comme avant les deux tâches
+  g.poserEstompage(0)
+  assert.equal(g._horsCropSeul(2, 0, 0), false)
+  // ⚠️ et SANS CROP, aucune des deux ne coupe : couper sur un repère absent
+  // ferait disparaître la planète.
+  g.retirerCrop()
+  g.poserCropSeul(true)
+  g.poserEstompage(1)
+  assert.equal(g._horsCropSeul(2, 0, 0), false)
+  g.dispose()
+})
+
+// ══════════ ⑨ LA MACHINE À MODES, POUR DE VRAI ══════════════════════════════
+//
+// ⚠️ **CINQ MUTATIONS ONT SURVÉCU À LA PREMIÈRE CAMPAGNE, ET TOUTES LES CINQ
+// VIVAIENT DANS `Modes`** — `_altitudeFondM`, `_suivreEmprise`, la branche
+// continue de `_niveauDePlongee` et de `_posePlongee`, et la mémoire d'emprise
+// de `_dive`. Aucun test de ce dépôt ne construisait la classe, parce qu'elle
+// appelle `document.createElement` et que le dépôt n'a pas de jsdom.
+//
+// ➡️ **On lui donne un DOM de pacotille et on l'instancie.** Ce n'est pas du
+// confort : c'est la seule façon de mordre sur le BRANCHEMENT plutôt que sur son
+// texte, et c'est la faiblesse récurrente nommée par le §0.
+
+function domDePacotille() {
+  const el = () => {
+    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
+    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
+    e.appendChild = (c) => { e.enfants.push(c); return c }
+    e.remove = () => {}
+    e.setAttribute = () => {}
+    e.addEventListener = () => {}
+    e.querySelector = () => el()
+    return e
+  }
+  const corps = el()
+  globalThis.document = { createElement: () => el(), body: corps, addEventListener() {} }
+  return corps
+}
+
+async function machine({ continu = true, emprise = 1e6, span = 56, lat = 45.8326 } = {}) {
+  domDePacotille()
+  const THREE = await import('three')
+  const { Modes } = await import('../src/modes.js')
+  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
+  const etat = { emprise, zoomCharge: [], loadSurface: 0 }
+  const controls = {
+    target: new THREE.Vector3(0, Y_CIBLE, 0),
+    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
+    rotateSpeed: 1, enableZoom: false, enablePan: true,
+    getDistance() { return camera.position.distanceTo(this.target) },
+    update() {},
+  }
+  const globe = { setVisible() {} }
+  const domElement = { addEventListener() {} }
+  const hooks = {
+    zoomContinu: () => continu,
+    empriseBlocM: () => etat.emprise,
+    empriseBlocMAuZoom: (z) => empriseBlocM({ zoom: z, lat }),
+    coteBloc: () => span,
+    getFineZoom: () => 15,
+    surfaceMaxDistance: () => 150,
+    surfaceCamAltMeters: () => 0,
+    getSurfaceLatLon: () => ({ lat, lon: 6.86 }),
+    setSurfaceVisible() {}, setEffectsEnabled() {},
+    getRefineTarget: () => ({ lat, lon: 6.86, zoom: 12 }),
+    getCoarsenTarget: () => ({ lat, lon: 6.86, zoom: 10 }),
+    async loadSurface(_lat, _lon, zoom) { etat.loadSurface++; etat.zoomCharge.push(zoom); etat.emprise /= 2 },
+  }
+  const m = new Modes({ camera, controls, globe, domElement, hooks })
+  m.mode = 'surface'
+  return { m, camera, controls, etat, THREE }
+}
+
+test('⑨ `_altitudeFondM` est `camY × emprise / span`, et rien d’autre', async () => {
+  const { m, camera } = await machine({ emprise: 1e6, span: 56 })
+  camera.position.set(0, 40, 0)
+  assert.equal(m._altitudeFondM(), (40 * 1e6) / 56)
+  // ⚠️ inverser les deux rendrait une altitude 3,2 × 10⁸ fois trop petite ici :
+  // le rapport `emprise / span` vaut 17 857, pas 1.
+  assert.ok(Math.abs(m._altitudeFondM() - (40 * 56) / 1e6) > 1)
+})
+
+test('⑨ `_suivreEmprise` convertit la caméra le jour où l’emprise change — et JAMAIS sinon', async () => {
+  const { m, camera, controls, etat } = await machine({ emprise: 1e6 })
+  camera.position.set(0, 40, 20)
+  m._suivreEmprise() // première lecture : elle mémorise, elle ne convertit pas
+  const y0 = camera.position.y
+  const alt0 = m._altitudeFondM()
+  m._suivreEmprise() // emprise inchangée : rien ne bouge
+  assert.equal(camera.position.y, y0)
+  // l'emprise est divisée par deux (un niveau de MNT)
+  etat.emprise /= 2
+  m._suivreEmprise()
+  assert.ok(Math.abs(m._altitudeFondM() / alt0 - 1) < 1e-9, `l’altitude de fond a bougé de ${(m._altitudeFondM() / alt0).toFixed(4)}`)
+  assert.ok(camera.position.y > y0 * 1.9, 'la caméra n’a pas suivi le changement d’unités')
+  // et la pente traverse : l'angle de vue de l'utilisateur est gardé
+  const p = camera.position.clone().sub(controls.target)
+  assert.ok(Math.abs(p.y / p.length() - 0.8944) < 0.01)
+})
+
+test('⑨ `_suivreEmprise` NE FAIT RIEN hors du régime continu — la production ne bouge pas', async () => {
+  const { m, camera, etat } = await machine({ continu: false, emprise: 1e6 })
+  camera.position.set(0, 40, 20)
+  m._suivreEmprise()
+  etat.emprise /= 2
+  m._suivreEmprise()
+  assert.equal(camera.position.y, 40)
+})
+
+test('⑨ le niveau de plongée se déduit de l’emprise, pas d’une table de paliers', async () => {
+  const { m } = await machine({ emprise: 1e6 })
+  // 1 600 km : `DIVE_TIERS` dirait z5 ou z6 selon la borne ; ici c'est la
+  // géométrie qui répond, et la distance qui va avec tient sous le demi-plafond.
+  const n = m._niveauDePlongee(1600000)
+  assert.ok(Number.isFinite(n.zoom) && n.zoom >= 3 && n.zoom <= 15)
+  assert.ok(n.distanceCible > 0 && n.distanceCible <= distanceArrivee(150) / 2 + 1e-9)
+  // ⚠️ **ET LE ZOOM IMPOSÉ RESTE IMPOSÉ** : un clic sur le globe DÉSIGNE.
+  assert.equal(m._niveauDePlongee(1600000, 9).zoom, 9)
+})
+
+test('⑨ la pose de plongée conserve l’altitude de FOND, pas celle de surface', async () => {
+  const { m, THREE } = await machine({ emprise: 1e6, span: 56 })
+  const arrival = { pos: new THREE.Vector3(0, 100, 0), target: new THREE.Vector3(0, Y_CIBLE, 0) }
+  const pos = m._posePlongee(arrival, 500000)
+  const altRendue = (pos.y * 1e6) / 56
+  assert.ok(Math.abs(altRendue / 500000 - 1) < 1e-6, `rendu ${Math.round(altRendue)} m pour 500 000 demandés`)
+})
+
+test('⑨ le franchissement suit le compteur, et il se garde d’un second pendant le premier', async () => {
+  const { m, etat } = await machine({ emprise: 1e6 })
+  m._levelZoom = -PAS_NIVEAU * 0.99
+  m._franchirSiBesoin()
+  assert.equal(etat.loadSurface, 0, 'un niveau incomplet a déclenché un chargement')
+  m._levelZoom = -PAS_NIVEAU
+  m._franchirSiBesoin()
+  assert.equal(etat.loadSurface, 1)
+  assert.ok(Math.abs(m._levelZoom) < 1e-12, 'le compteur ne repart pas de son reste')
+  // ⚠️ pendant le chargement, `busy` interdit un second franchissement
+  m.busy = true
+  m._levelZoom = -PAS_NIVEAU * 3
+  m._franchirSiBesoin()
+  assert.equal(etat.loadSurface, 1)
+})
+
+test('⑨ un cran vaut ×√2 sur la distance, et l’aller-retour revient au point de départ', async () => {
+  const { m, camera, controls } = await machine({ emprise: 1e6 })
+  camera.position.set(0, 40, 20)
+  const d0 = controls.getDistance()
+  m.cranZoom(1)
+  const d1 = controls.getDistance()
+  assert.ok(Math.abs(d1 / d0 - 1 / Math.SQRT2) < 1e-9, `un cran rend ×${(d1 / d0).toFixed(4)}`)
+  m.cranZoom(-1)
+  assert.ok(Math.abs(controls.getDistance() / d0 - 1) < 1e-9)
+})
+
+test('⑨ la plongée MÉMORISE l’emprise d’arrivée — sinon elle est convertie deux fois', async () => {
+  // ⚠️ **CE CHAMP EST LE SEUL LIEN ENTRE `_dive` ET `_suivreEmprise`.** Sans lui,
+  // le suiveur verrait passer l'emprise du bloc quitté à celle du bloc d'arrivée
+  // et rejouerait un changement d'unités que la plongée vient d'appliquer — la
+  // caméra atterrirait deux fois trop haut.
+  const { m, camera, etat } = await machine({ emprise: 1e6 })
+  m.mode = 'orbital'
+  m.altM = 500000
+  m._empriseVue = 4e6 // l'emprise que le suiveur croit connaître
+  await m._dive({ altM: 8000, zoom: null })
+  assert.equal(m.mode, 'surface')
+  const yApres = camera.position.y
+  m._suivreEmprise()
+  assert.equal(camera.position.y, yApres, 'le suiveur a reconverti ce que la plongée venait de poser')
+  assert.equal(m._empriseVue, etat.emprise)
+})
+
+
+test('⑩ la sortie d’orbite se fait a l’altitude EXACTE, sans les 15 % de recul', async () => {
+  // ⚠️ **LE × 1,15 D’`altitudeSortieOrbiteM` EXISTAIT POUR REPASSER LA PORTE DE
+  // PLONGÉE SANS Y RETOMBER.** La porte est désormais géométrique et `_diveArmed`
+  // suffit à ne pas replonger : 15 % de recul seraient un saut, et c’est
+  // exactement ce qu’Adrien refuse.
+  const { m, camera } = await machine({ emprise: 1e6, span: 56 })
+  camera.position.set(0, 40, 20)
+  const altFond = m._altitudeFondM()
+  await m.enterOrbit()
+  assert.equal(m.mode, 'orbital')
+  // ⚠️ `this.altM` n'est écrit qu'à l'image suivante (`update`) : on lit l'état
+  // POSÉ, pas l'affichage. Lire l'affichage rendrait 0 et ferait passer le test
+  // pour une raison qui n'a rien à voir.
+  const altOrbite = m.orbAlt * ORBITAL_M_PER_UNIT
+  assert.ok(Math.abs(altOrbite / altFond - 1) < 1e-6, 'sortie a ' + Math.round(altOrbite) + ' m pour ' + Math.round(altFond) + ' m')
+  // le repère du bloc est quitté : plus rien à suivre
+  assert.equal(m._empriseVue, null)
+})
+
+test('⑩ D10 — l’exagération unique vaut DEUX, et c’est une décision, pas un réglage', () => {
+  // **Adrien, 2026-08-22 :** « On va faire une exagération d’altitude unique à
+  // ×2 sur toute la map, ça évitera les sauts et les rechargements. »
+  // ⚠️ Elle n’est pas dérivable : c’est un choix, il se garde comme tel.
+  assert.equal(EXAGERATION_UNIQUE, 2)
+})
+
+test('⑩ les trois crochets d’emprise lisent le MÊME couple que la caméra de fond', () => {
+  // ⚠️ **SINON LA CONVERSION D’UNITÉS ET LA POSE DU FOND DIRAIENT DEUX CHOSES.**
+  // `majCameraFond()` passe `extentMeters: largeurBlocM()` et `span: TERRAIN_SIZE`
+  // à la similitude ; les crochets doivent lire exactement ce couple-là.
+  assert.match(SRC_MAIN, /empriseBlocM: \(\) => \(params\.source === 'real' \? largeurBlocM\(\) : 0\)/)
+  assert.match(SRC_MAIN, /coteBloc: \(\) => TERRAIN_SIZE/)
+  assert.match(SRC_MAIN, /empriseBlocMAuZoom: \(zoom, lat = params\.demLat\) => empriseBlocM\(\{ zoom, lat \}\)/)
+  const fond = SRC_MAIN.slice(SRC_MAIN.indexOf('const pose = poseFond({'))
+  const corps = fond.slice(0, fond.indexOf('})'))
+  assert.match(corps, /extentMeters: largeur/)
+  assert.match(corps, /span: TERRAIN_SIZE/)
+})
