6063c5e tache P12 : deux chiffres retires des en-tetes, parce que je ne les avais pas rendus
b3f6c10 tache P12 : quatre survivantes, et chacune a trouve un vrai trou
16b0be7 tache P12 : le pas du gradient suit la SOURCE, et le fond marin rend son grain
e4d4ae4 tache P12 : l'accord d'exposition, et la sonde ne voyait qu'une moitie de sphere

 package.json                |   2 +-
 src/globe.js                |  59 ++++++-
 src/monde/atlas-normales.js | 243 +++++++++++++++++++++++++++++
 src/sonde-ambiante.js       | 170 +++++++++++++-------
 test/atlas-normales.test.js | 371 ++++++++++++++++++++++++++++++++++++++++++++
 test/crop-eclairage.test.js |  11 +-
 test/fond-crop.test.js      | 186 ++++++++++++++++++++--
 7 files changed, 960 insertions(+), 82 deletions(-)

diff --git a/package.json b/package.json
index 22ca495..fc541ba 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js test/maillage-tuile.test.js test/ecume-mer.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js test/maillage-tuile.test.js test/ecume-mer.test.js test/atlas-normales.test.js",
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
index c4e1108..019062a 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -1213,23 +1213,37 @@ ${GLSL_NORMALE_FINE}
 // en une seule fonction deplacerait ce test d'un cran, et la rampe changerait de
 // branche sur les fragments ou le grain fait passer h de negatif a positif.
 //
 // ⚠️ ET LA BORNE DU CHAMP N'EST PAS DECORATIVE : au-dela de uFondPortee
 // demi-cotes, une texture en ClampToEdge prolongerait sa derniere ligne sur
 // toute la planete estompee sans qu'aucune erreur ne soit levee.
 // ⚠️ LES DEUX PARAMETRES S'APPELLENT qCrop ET h, COMME AU POINT D'APPEL, ET
 // C'EST DELIBERE : test/fond-crop.test.js EXTRAIT ce bloc de la source pour
 // l'EXECUTER contre altitudeSonde. Les renommer ne casserait pas le nuanceur —
 // il casserait la seule chose qui LIT ce nuanceur.
+// ⚠️ LA CONDITION EST NOMMEE, ET ELLE L'EST PARCE QU'ELLE A DEUX LECTEURS
+// DEPUIS LA TACHE P12 : la hauteur (juste dessous) et le PAS du gradient de la
+// normale fine, qui ne peut pas avoir la meme largeur de bande selon que le
+// fragment lit le MNT ou le champ cuit. La recopier aurait fait « deux
+// ecritures jumelles qui divergent », la cicatrice que terrain.js documente.
+//
+// ⚡ ET ELLE EST STABLE PAR LA COMPOSITION, CE QUI PERMET DE L'APPELER APRES :
+// quand elle est vraie, hauteurFond rend min(champ, 0), donc h <= 0, donc elle
+// reste vraie ; quand elle est fausse parce que h > 0, hauteurFond ne touche
+// pas h, donc elle reste fausse. test/fond-crop.test.js le rejoue EN
+// L'EXECUTANT sur le bloc extrait de cette source.
+bool surLeFond(vec2 qCrop, float h) {
+  return uFondOn > 0.5 && uCropOn > 0.5
+      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0;
+}
 float hauteurFond(vec2 qCrop, float h) {
-  if (uFondOn > 0.5 && uCropOn > 0.5
-      && max(abs(qCrop.x), abs(qCrop.y)) <= uFondPortee && h <= 0.0) {
+  if (surLeFond(qCrop, h)) {
     h = min(texture2D(uFondChamp, qCrop / (2.0 * uFondPortee) + 0.5).r * uFondMetres, 0.0);
   }
   return h;
 }
 // ⚠️ INDEXE SUR LE CROP, JAMAIS SUR vUv NI SUR L'ECRAN, et il ne mord que sur
 // la TERRE (h > 0) comme le landFactor du socle : les raisons sont ecrites au
 // point d'appel, dans main().
 float hauteurGrain(vec2 qCrop, float h) {
   if (uGrainForceM > 0.0 && h > 0.0) {
     vec2 gp = qCrop * uGrainEchelle;
@@ -1419,20 +1433,25 @@ void main() {
     // ⚠️ LE discard RESTE, ET IL RESTE ICI. A estompage plein il economise tout
     // le corps du nuanceur sur les tuiles du dehors, exactement comme avant. En
     // cours de fondu il ne coupe plus rien : c'est le prix de dessiner la Terre
     // autour, et c'est le sujet meme de la tache.
     if (couvertureCrop <= 0.0) discard;
   }
 
   // ⚠️ L'APPEL EST hauteurFond, PAS LE CORPS : la MEME loi sert au gradient de
   // la normale fine, quatre fragments plus bas (Tache P10).
   float h = hauteurFond(qCrop, decodeMetersAA(vUv));
+  // ⚠️ RELEVE ICI, ET PAS PLUS BAS : le grain (quelques lignes plus loin) ajoute
+  // un bruit SIGNE a la hauteur, donc une butte de terre a un metre au-dessus de
+  // l'eau peut en ressortir NEGATIVE. Le pas du gradient basculerait alors sur
+  // la loi du fond marin en pleine terre, une tuile sur deux et sans rien dire.
+  bool fondMarin = surLeFond(qCrop, h);
 
   // ══════ LE FOND DU CROP — Tache J bis ══════════════════════════════════════
   //
   // ⚠️ AVANT L'HABILLAGE, ET POUR LA MEME RAISON QUE LE GRAIN EST AVANT LA RAMPE
   // (voir le bloc suivant) : ce qui change h doit passer avant tout ce qui LIT h
   // — la rampe, les courbes de niveau, et le test sousEau qui les commande.
   //
   // ⚠️ C'EST LA TRANSCRIPTION DE altitudeSonde (src/monde/fond-crop.js), PAS UNE
   // SECONDE LOI : la mer prend min(fond, 0), la terre garde la tuile. Le CPU
   // (posAt, hauteurSurface) et le GPU lisent le meme tableau par la meme
@@ -1718,21 +1737,55 @@ void main() {
     float metresParUv = ${TOUR_SPHERE_M} * uUvParMonde * cosLat;
     float uniteParUv = metresParUv * ${UNITES_PAR_METRE_SOL};
 
     // ⚠️ LE PAS NE VIENT D'AUCUNE DERIVEE D'ECRAN, SINON LA PARITE RENTRERAIT
     // PAR LA FENETRE. mppEcran = vProfCam x uMppFacteur est la grandeur de la
     // Tache K : les metres de sol par pixel, fonction de la seule DISTANCE.
     // Sans elle (uMppFacteur = 0, la production), le pas retombe au texel.
     float pasEmpreinte = uMppFacteur > 0.0
       ? vProfCam * uMppFacteur / metresParUv
       : 0.0;
-    float pas = max(1.0 / uTilePx, pasEmpreinte);
+
+    // ══════ ⛔ ET L'EMPREINTE NE S'APPLIQUE PAS AU FOND MARIN — Tache P12 ═══
+    //
+    // L'ARGUMENT DE P10 EST UN ARGUMENT SUR LE MNT, ET RIEN D'AUTRE : « la
+    // texture de hauteur est MINIFIEE au cadrage de la notation, une difference
+    // centree a un texel echantillonnerait plus fin que ce que l'ecran peut
+    // porter ». Vrai — pour une hauteur lue dans le MNT.
+    //
+    // ⛔ SOUS L'EAU, LA HAUTEUR NE VIENT PAS DU MNT. hauteurFond l'ECRASE par le
+    // champ cuit, qui porte 385 noeuds sur 2 x uFondPortee demi-cotes de crop :
+    // a La Reunion z12, une maille de 213 m, soit SIX texels de MNT. Ce champ-la
+    // est MAGNIFIE, pas minifie : il n'a aucun detail sous le pixel, donc il n'y
+    // a rien a filtrer, et l'empreinte ne fait que perdre de la pente.
+    //
+    // ⚡ MESURE, EN BOUGEANT LE PAS DANS LES DEUX SENS (.banc/P12/e1-pas-mer.js
+    // et e2-pas-mer-pavage.js, aller-retour a 0 canal, temoin a 218 000 -
+    // 295 000 canaux), grain du fond marin en % du socle au cadrage cote :
+    //   pas x2      66,5 %   pas livre  72,5 %   pas x0,5  77,7 %   un texel  85,1 %
+    // et la frange cotiere en marches, part des suites de 4 px et plus :
+    //   pas livre  13,61 %   un texel  9,22 %   (socle 7,00 %)
+    //
+    // ⚠️ ET LE PRIX EST DECLARE : le pavage rectangulaire de la nappe, que le
+    // noteur mesure pour la premiere fois, DOUBLE (pic normalise 0,0685 ->
+    // 0,1345 ; socle 0,0339). Ce que le pas resserre rend n'est pas du relief :
+    // c'est la FACETTE de la bilineaire du champ. Le vrai correctif de ce
+    // poste-la est la RESOLUTION du champ (CHAMP_FOND), et il coute neuf fois
+    // remplirHauteurs — le rapport P12 le chiffre et ne le paie pas.
+    //
+    // ⚠️ LE RELIEF, LUI, NE BOUGE PAS D'UN PIXEL : la bascule ne prend que sur
+    // les fragments dont la hauteur vient du champ. Et le scintillement que P10
+    // a ferme ne revient a AUCUN pas — mesure au balayage complet, residu a
+    // dx = 1 entre 0,793 et 0,841 pour un pas de x0 a x2 (socle 0,030), aucune
+    // signature de parite : la loi de P10 est invariante par construction, ce
+    // n'est pas son pas qui la tenait.
+    float pas = fondMarin ? (1.0 / uTilePx) : max(1.0 / uTilePx, pasEmpreinte);
 
     // ⚠️ ET qCrop SUIT L'UV, PARCE QUE hauteurEchant LIT LES DEUX. uv.x va vers
     // l'EST (mercator x croissant) ; uv.y va vers le NORD, donc vers un mercator
     // y DECROISSANT — c'est le « 1 - v » de _buildMesh. Le signe moins est ce
     // retournement, et lui seul.
     float qParUv = uUvParMonde / max(uCropDemi, 1e-9);
     vec2 dqU = vec2(qParUv * pas, 0.0);
     vec2 dqV = vec2(0.0, -qParUv * pas);
     float dhU = hauteurEchant(vUv + vec2(pas, 0.0), qCrop + dqU)
               - hauteurEchant(vUv - vec2(pas, 0.0), qCrop - dqU);
diff --git a/src/monde/atlas-normales.js b/src/monde/atlas-normales.js
new file mode 100644
index 0000000..7f176b3
--- /dev/null
+++ b/src/monde/atlas-normales.js
@@ -0,0 +1,243 @@
+// L'ATLAS DE NORMALES — Tâche P12 du plan « LE STUDIO SUR LE GLOBE ».
+//
+// Module PUR : ni DOM, ni three.js, ni fetch. Tout se vérifie sous node
+// (`test/atlas-normales.test.js`). Le rendu, lui, vit dans
+// `src/sonde-ambiante.js`, qui n'écrit aucune de ces lois deux fois.
+//
+// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
+//
+// > **L'agent noteur, `notation-04.md` §7-1️⃣ :** *« TOUT LE DÉPASSEMENT
+// > RESTANT EST DANS L'IRRADIANCE, uniforme sur les trois canaux
+// > (×1,0848 / ×1,0818 / ×1,0842). C'est un terme de gain. »*
+//
+// ⚡ **IL EST DANS UN SEUL DES TROIS TERMES, ET C'EST MESURÉ.** Un atlas de
+// normales posé dans la page vivante (`.banc/P12/d1-irradiance.js`) rend, sur
+// les 1 600 normales de la sphère, La Réunion z12, socle rallumé dans la même
+// page :
+//
+// | terme | formule du crop | mesure du socle | rapport |
+// |---|---|---|---|
+// | soleil directionnel | 0,9388 | 0,9385 | ⚡ **×1,0003** |
+// | lampe hémisphérique | 0,1231 | 0,1231 | ⚡ **exact** |
+// | **environnement** | **1,5307** | **1,1985** | ⛔ **×1,2772** |
+//
+// **Les deux lampes sont justes ; l'environnement dépasse de 27,7 %.**
+//
+// ══════════ 1. LA CAUSE : LA SONDE NE VOYAIT QU'UNE MOITIÉ DE SPHÈRE ═══════
+//
+// La sonde d'origine (Tâche P3) posait une BILLE regardée de côté par une
+// caméra orthographique, et régressait l'irradiance sur la coordonnée écran
+// `sy`. Son argument était juste — pour une sphère unité vue ainsi, `N·haut`
+// **est** `sy` — mais il ne dit rien du reste : **les normales visibles sont
+// toutes celles du demi-espace `Nz > 0`**, et elles sont pondérées par l'aire
+// d'ÉCRAN, qui n'est pas la mesure de la sphère.
+//
+// ⛔ **ET L'ENVIRONNEMENT N'EST PAS INVARIANT PAR ROTATION AUTOUR DE LA
+// VERTICALE — MESURÉ, PAS SUPPOSÉ** (`.banc/P12/d3-hemisphere.js`,
+// `D3-hemisphere-P12.json`). À `ndu = 0,3` l'irradiance varie de **0,7225 à
+// 2,6446 selon l'azimut**, soit **146 % d'amplitude**. Les deux moitiés de
+// sphère rendent donc deux droites différentes :
+//
+// | régression, même algèbre, même grille | ciel | sol |
+// |---|---|---|
+// | demi-sphère AVANT (celle que la sonde voyait) | **6,827** | 1,048 |
+// | demi-sphère ARRIÈRE | ⛔ **3,133** | 1,255 |
+// | *(la sonde livrée)* | *6,683* | *1,045* |
+//
+// ⚡ **×2,18 SUR LE TERME DE CIEL SELON LE CÔTÉ D'OÙ ON REGARDE.** La sonde
+// livrée retombe à 2,2 % de la moitié AVANT : son rendu était juste, c'est son
+// ÉCHANTILLONNAGE qui était faux.
+//
+// ══════════ 2. ET LA SECONDE FAUTE EST UNE FAUTE DE MONNAIE — LA CINQUIÈME ═
+//
+// ⚠️ **`ciel` ET `sol` NE SONT PAS LES COEFFICIENTS D'UN AJUSTEMENT : CE SONT
+// DEUX IRRADIANCES AUX PÔLES.** L'appelant les ADDITIONNE à `hemi.color` et
+// `hemi.groundColor` (`globe.js`, `poserEclairage`), et le nuanceur évalue
+// `mix(sol, ciel, 0.5·ndu + 0.5)` — la loi de `getHemisphereLightIrradiance` de
+// three, où `skyColor` est **par définition** l'irradiance à `ndu = +1`.
+// Y verser l'extrapolation d'une droite des moindres carrés, c'est mettre une
+// valeur juste dans la mauvaise monnaie : ce chantier l'a payé quatre fois.
+//
+// ➡️ **ON MESURE DONC EXACTEMENT LES DEUX GRANDEURS QUE LE NUANCEUR CONSOMME**,
+// et rien d'autre : l'irradiance sur `(0, +1, 0)` et sur `(0, −1, 0)`.
+// Deux faces, deux normales, aucun échantillonnage à biaiser.
+//
+// ⚡ **CE QUE ÇA VAUT, MESURÉ SUR LES NORMALES DU RELIEF** (`ndu ≥ 0,7`, là où
+// vit la surface du crop) — irradiance totale, formule du crop contre mesure du
+// socle, atlas RENDU dans la page avant et après : **×1,1429 → ×0,9954** sur
+// l'irradiance pure, et **×1,0035** sur le diffus RÉEL que le relief reçoit.
+// ⚠️ **Et ×0,9618 si l'on avait pris la droite des moindres carrés de la sphère
+// entière — ce chiffre-là est CALCULÉ sur l'atlas mesuré, jamais rendu.**
+// **Les pôles ne sont pas le choix commode : c'est le seul des trois qui
+// retombe sur le socle.**
+//
+// ⚠️ **CE QUE ÇA NE RÈGLE PAS, ET JE LE DIS ICI :** entre les deux pôles, le
+// modèle reste une DROITE, et l'irradiance vraie ne l'est pas — elle a un genou
+// vers `ndu = 0` (mesurée : 0,807 à `ndu = −0,5`, 1,025 à `ndu = 0`, 1,959 à
+// `ndu = +0,9`). Sur une paroi VERTICALE (`ndu ≈ 0`) la droite des pôles
+// dépasse la vérité de **+40 %** là où celle des moindres carrés dépasse de
+// **+17 %**. C'est la limite du modèle du NUANCEUR, pas de la sonde — la
+// réserve que P8 a nommée (« `mix(sol, ciel, 0.5·ndu+0.5)` ne sait dire que
+// `N·haut` ») et que le noteur a reprise. Elle est mesurée au §4 du rapport
+// P12, elle n'est pas fermée.
+
+/** Le zénith : `ndu = +1`, l'irradiance que le nuanceur appelle `ciel`. */
+export const ZENITH = Object.freeze([0, 1, 0])
+/** Le nadir : `ndu = −1`, l'irradiance que le nuanceur appelle `sol`. */
+export const NADIR = Object.freeze([0, -1, 0])
+
+/**
+ * Les normales de l'atlas, DANS L'ORDRE DES LIGNES DU TAMPON.
+ *
+ * ⚠️ **`readRenderTargetPixels` REND LA LIGNE 0 EN BAS** (convention OpenGL) :
+ * la bande du BAS est donc la première, et c'est celle du NADIR. Inverser les
+ * deux échangerait le ciel et le sol sans qu'aucune erreur ne soit levée — le
+ * bloc s'éclairerait par en dessous. `test/atlas-normales.test.js` ①c le tue.
+ */
+export const NORMALES_ATLAS = Object.freeze([NADIR, ZENITH])
+
+/** Le débord des faces hors du cadre : aucun pixel n'est à couverture partielle. */
+export const DEBORD = 0.2
+/** Le demi-écart entre deux faces, en coordonnées de cadre. */
+export const ECART = 0.05
+/** Le nombre minimal de lignes écartées de part et d'autre d'une couture. */
+export const MARGE_MIN = 1
+
+/**
+ * La géométrie de l'atlas : une bande horizontale par normale, empilées du bas
+ * vers le haut, dans le cadre `[-1, 1]²` d'une caméra orthographique unité.
+ *
+ * ⚠️ **LES FACES DÉBORDENT ET SE SÉPARENT, ET LES DEUX SONT NÉCESSAIRES.** Le
+ * débord met la bordure du cadre à l'INTÉRIEUR d'une face : aucun pixel lu n'a
+ * une couverture partielle, donc aucun ne mélange une face avec le fond. L'écart
+ * laisse entre deux faces une bande vide de `2 × ECART`, que `bandesLecture`
+ * écarte : aucun pixel lu ne mélange deux normales.
+ *
+ * ⚠️ **L'ENROULEMENT EST DIRECT (sens trigonométrique vu de +Z)** : les faces
+ * regardent la caméra, donc `gl_FrontFacing` vaut vrai et three n'inverse pas
+ * la normale — ce qu'il ne ferait de toute façon qu'en `DoubleSide`, mais un
+ * jour où quelqu'un poserait `side` autrement, l'atlas ne se retournerait pas.
+ *
+ * @param {ReadonlyArray<ReadonlyArray<number>>} normales une par bande, du bas vers le haut
+ * @returns {{positions: Float32Array, normales: Float32Array, index: Uint16Array}}
+ */
+export function facesAtlas(normales) {
+  const n = normales.length
+  const pos = new Float32Array(n * 4 * 3)
+  const nor = new Float32Array(n * 4 * 3)
+  const idx = new Uint16Array(n * 6)
+  const x0 = -1 - DEBORD
+  const x1 = 1 + DEBORD
+  for (let i = 0; i < n; i++) {
+    const y0 = i === 0 ? -1 - DEBORD : -1 + (2 * i) / n + ECART
+    const y1 = i === n - 1 ? 1 + DEBORD : -1 + (2 * (i + 1)) / n - ECART
+    const q = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
+    for (let s = 0; s < 4; s++) {
+      const b = (i * 4 + s) * 3
+      pos[b] = q[s][0]
+      pos[b + 1] = q[s][1]
+      pos[b + 2] = 0
+      nor[b] = normales[i][0]
+      nor[b + 1] = normales[i][1]
+      nor[b + 2] = normales[i][2]
+    }
+    const base = i * 4
+    idx.set([base, base + 1, base + 2, base, base + 2, base + 3], i * 6)
+  }
+  return { positions: pos, normales: nor, index: idx }
+}
+
+/**
+ * Les lignes du tampon qu'on a le droit de lire, une plage par bande.
+ *
+ * ⚠️ **LA MARGE N'EST PAS UNE PRÉCAUTION DE STYLE, ET ELLE N'EST PAS UNE
+ * CONSTANTE** : la couture entre deux faces est une bande VIDE de `2 × ECART`
+ * en coordonnées de cadre, c'est-à-dire de `ECART × cote` LIGNES. Poser un
+ * nombre de lignes en dur marcherait à `cote = 64` et laisserait entrer le vide
+ * à `cote = 256` — la même faute de monnaie que le reste de ce chantier, en
+ * plus petit. `test/atlas-normales.test.js` ②b la tue sur cinq tailles.
+ *
+ * ⚠️ **ET LES BORDS EXTÉRIEURS N'EN PRENNENT PAS**, parce qu'il n'y a rien à en
+ * écarter : `facesAtlas` fait DÉBORDER la première et la dernière face hors du
+ * cadre. Les deux fonctions portent donc la même distinction `i === 0` /
+ * `i === n - 1`, et c'est ce qui les APPARIE.
+ *
+ * @param {number} bandes le nombre de faces
+ * @param {number} cote le côté du tampon, en pixels
+ * @param {number} ecart le demi-écart entre faces, en coordonnées de cadre
+ * @returns {Array<{debut:number, fin:number}>} lignes INCLUSES, du bas vers le haut
+ */
+export function bandesLecture(bandes, cote, ecart = ECART) {
+  const marge = Math.ceil((cote * Math.max(0, ecart)) / 2) + MARGE_MIN
+  const out = []
+  for (let i = 0; i < bandes; i++) {
+    out.push({
+      debut: i === 0 ? 0 : Math.ceil((cote * i) / bandes) + marge,
+      fin: i === bandes - 1 ? cote - 1 : Math.floor((cote * (i + 1)) / bandes) - 1 - marge,
+    })
+  }
+  return out
+}
+
+/**
+ * L'irradiance d'une bande : `E = π · (blanc − noir)`, moyennée sur la plage.
+ *
+ * ⚠️ **`albédo × E / π` EST LA SORTIE, DONC `E = π × SORTIE` À ALBÉDO 1** —
+ * `BRDF_Lambert` de three. Et la soustraction du rendu à albédo NOIR retire le
+ * spéculaire, qui ne s'annule pas à `roughness = 1` : `F0 = 0,04` en renvoie
+ * **4,0 %** sur le socle (mesure de P3).
+ *
+ * ⚡ **ET ELLE RETIENT AUSSI, SANS LE CHERCHER, LE FACTEUR QUI COMPTE VRAIMENT :**
+ * three atténue le diffus INDIRECT par `1 − max(totalScattering)`
+ * (`RE_IndirectSpecular_Physical`), soit **0,9835** à `F0 = 0,04`. Ce facteur est
+ * dans le blanc ET absent du noir, donc il SURVIT à la soustraction — et c'est
+ * exactement ce qu'il faut, puisque le relief du socle le subit lui aussi.
+ * ⚠️ **Poser `specularIntensity = 0` sur la sonde aurait rendu l'irradiance
+ * « pure » et le crop serait ressorti 1,7 % trop clair.**
+ *
+ * @param {Float32Array|number[]} blanc RGB linéaire, 3 par pixel, ligne 0 en bas
+ * @param {Float32Array|number[]} noir le même rendu, albédo noir
+ * @param {number} cote côté du tampon
+ * @param {{debut:number, fin:number}} bande
+ * @returns {number[]} l'irradiance linéaire, trois canaux
+ */
+export function irradianceBande(blanc, noir, cote, bande) {
+  const s = [0, 0, 0]
+  let n = 0
+  for (let ligne = bande.debut; ligne <= bande.fin; ligne++) {
+    for (let col = 0; col < cote; col++) {
+      const i = (ligne * cote + col) * 3
+      for (let k = 0; k < 3; k++) s[k] += Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
+      n++
+    }
+  }
+  if (n === 0) return [0, 0, 0]
+  return [s[0] / n, s[1] / n, s[2] / n]
+}
+
+/**
+ * L'écart maximal, en relatif, entre les pixels d'une bande.
+ *
+ * ⚠️ **C'EST LE TÉMOIN DE LA MESURE, ET IL N'EST PAS DÉCORATIF.** Tous les
+ * pixels d'une bande portent la MÊME normale : ils doivent rendre le MÊME
+ * nombre. Un écart non nul dit qu'un pixel de couture, de bord ou de fond est
+ * entré dans la moyenne — c'est-à-dire que la sonde ne mesure pas ce qu'elle
+ * croit. `coefAmbiante` le publie, et `test/atlas-normales.test.js` ③b le tue
+ * en glissant un pixel étranger dans la plage.
+ */
+export function dispersionBande(blanc, noir, cote, bande) {
+  let mn = Infinity
+  let mx = -Infinity
+  for (let ligne = bande.debut; ligne <= bande.fin; ligne++) {
+    for (let col = 0; col < cote; col++) {
+      const i = (ligne * cote + col) * 3
+      let v = 0
+      for (let k = 0; k < 3; k++) v += Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
+      v /= 3
+      if (v < mn) mn = v
+      if (v > mx) mx = v
+    }
+  }
+  if (!(mx > 0)) return 0
+  return (mx - mn) / mx
+}
diff --git a/src/sonde-ambiante.js b/src/sonde-ambiante.js
index 686188c..dd529dc 100644
--- a/src/sonde-ambiante.js
+++ b/src/sonde-ambiante.js
@@ -29,32 +29,65 @@
 // est donc du code MORT sur le relief**, et la seule intensité qui compte est
 // `scene.environmentIntensity`. Le facteur 6,7 que ça donnait a été attrapé par
 // la mesure du socle, pas par la lecture du code.
 //
 // ══════════ CE QU'ELLE REND : UN CIEL ET UN SOL, PAS UN NOMBRE ══════════════
 //
 // ⚠️ **L'IRRADIANCE D'UN ENVIRONNEMENT DÉPEND DE LA NORMALE** — sur le socle,
 // son écart-type vaut **17,7 %** de sa moyenne, et un ciel HDRI est bleu en
 // haut et brun en bas. Rendre une moyenne unique aurait jeté cette variation.
 //
-// On rend donc **deux irradiances, zénith et nadir**, obtenues par une
-// RÉGRESSION LINÉAIRE de l'irradiance sur `N·haut` — et l'appelant les ajoute
-// aux deux couleurs de la lampe hémisphérique. Le nuanceur n'a alors rien de
-// plus à faire : `mix(sol, ciel, 0.5 · ndu + 0.5)` est déjà exactement la loi
-// que three écrit pour une `HemisphereLight`, et c'est aussi la meilleure
-// approximation du premier ordre d'un environnement.
-//
-// **La sonde est une SPHÈRE regardée de côté par une caméra ORTHOGRAPHIQUE.**
-// Pour une sphère unité vue ainsi, la normale du point qui tombe en `(sx, sy)`
-// de l'écran vaut `(sx, sy, √(1 − sx² − sy²))` : **`N·haut` EST la coordonnée
-// écran `sy`**, sans aucun calcul. Le haut du disque donne le zénith, le bas le
-// nadir, et tout l'entre-deux nourrit la régression.
+// On rend donc **deux irradiances, zénith et nadir**, que l'appelant ajoute aux
+// deux couleurs de la lampe hémisphérique. Le nuanceur n'a alors rien de plus à
+// faire : `mix(sol, ciel, 0.5 · ndu + 0.5)` est déjà exactement la loi que three
+// écrit pour une `HemisphereLight`.
+//
+// ══════════ ⛔ ET LA PREMIÈRE VERSION LES OBTENAIT MAL — Tâche P12 ══════════
+//
+// La sonde de P3 était une **BILLE regardée de côté par une caméra
+// orthographique**, et elle régressait l'irradiance sur la coordonnée d'écran
+// `sy`. Son argument était juste — pour une sphère unité vue ainsi, `N·haut`
+// **est** `sy` — mais il ne dit rien du reste : **les normales visibles sont
+// toutes celles du demi-espace `Nz > 0`**, pondérées par l'aire d'écran.
+//
+// ⛔ **ET L'ENVIRONNEMENT N'EST PAS INVARIANT PAR ROTATION AUTOUR DE LA
+// VERTICALE.** Mesuré dans la page vivante le 2026-08-23 (La Réunion z12,
+// `.banc/P12/d3-hemisphere.js`) : à `ndu = 0,3`, l'irradiance va de **0,7225 à
+// 2,6446 selon l'azimut** — **146 % d'amplitude**. Les deux moitiés de sphère
+// rendent donc deux droites différentes, **×2,18 sur le terme de ciel**, et la
+// sonde livrée retombait à 2,2 % de la moitié qu'elle voyait : **son rendu
+// était juste, son échantillonnage était faux.**
+//
+// ⚡ **CE QUE ÇA COÛTAIT, MESURÉ TERME PAR TERME** (`.banc/P12/d1-irradiance.js`,
+// atlas de 1 600 normales, socle rallumé dans la même page) : le soleil du crop
+// est juste à **×1,0003**, sa lampe hémisphérique est **exacte**, et son
+// environnement dépasse de **×1,2772**. **Tout le dépassement du noteur vit
+// là.**
+//
+// ⚠️ **ET LA SECONDE FAUTE ÉTAIT UNE FAUTE DE MONNAIE, LA CINQUIÈME DE CE
+// CHANTIER** : `ciel` et `sol` ne sont pas les coefficients d'un ajustement, ce
+// sont **deux irradiances AUX PÔLES** — l'appelant les additionne à
+// `hemi.color` et `hemi.groundColor`, où `skyColor` est par définition
+// l'irradiance à `ndu = +1`. Y verser l'extrapolation d'une droite des moindres
+// carrés met une valeur juste dans la mauvaise monnaie.
+//
+// ➡️ **LA SONDE MESURE DONC EXACTEMENT LES DEUX GRANDEURS QUE LE NUANCEUR
+// CONSOMME, ET RIEN D'AUTRE** : deux faces, deux normales, `(0, +1, 0)` et
+// `(0, −1, 0)`. Il n'y a plus d'échantillonnage à biaiser. La géométrie, les
+// plages de lecture et la réduction vivent dans `src/monde/atlas-normales.js`,
+// **module pur, vérifiable sous node** — c'est là que la mesure du 2026-08-23
+// est écrite en entier.
+//
+// ⚡ **CE QUE ÇA VAUT, SUR LES NORMALES DU RELIEF** (`ndu ≥ 0,7`) : irradiance
+// totale du crop contre celle du socle, atlas RENDU dans la page avant et
+// après — **×1,1429 → ×0,9954** sur l'irradiance pure, **×1,0035** sur le
+// diffus RÉEL que le relief reçoit (`.banc/P12/D4-verif-irradiance-P12.json`).
 //
 // ══════════ LE SPÉCULAIRE EST RETIRÉ, ET IL EST RETIRÉ PAR SOUSTRACTION ═════
 //
 // ⚠️ **UNE SONDE D'ALBÉDO 1 MESURE LE DIFFUS *PLUS* LE SPÉCULAIRE.** Même à
 // `roughness = 1` et `metalness = 0`, `F0 = 0,04` renvoie de la lumière — relevé
 // sur le socle : **0,0089 sur 0,2237**, soit 4,0 %. On rend donc DEUX fois, la
 // seconde avec un albédo NOIR (le diffus s'annule, le spéculaire reste), et on
 // soustrait. C'est exact, et ça ne coûte qu'un second rendu de 64 × 64.
 //
 // ══════════ CE QUE LA SONDE NE DOIT PAS CASSER ═════════════════════════════
@@ -65,53 +98,90 @@
 // sans test rouge, juste des ombres figées »). On le sauve et on le repose,
 // comme la cible de rendu, la couleur d'effacement et `autoClear`.
 //
 // ⚠️ **ET ELLE NE TOURNE QU'UNE FOIS PAR TEXTURE.** Le résultat est mis en
 // cache dans une `WeakMap` et **rendu comme un objet GELÉ dont l'identité ne
 // bouge pas** : c'est ce qui permet à `habillageDifferent` de le comparer par
 // `Object.is` sans reposer l'habillage entier à chaque image.
 
 import * as THREE from 'three'
 
-const COTE = 64 // pixels de côté — ~3 200 normales pour la régression
+import {
+  NORMALES_ATLAS,
+  facesAtlas,
+  bandesLecture,
+  irradianceBande,
+  dispersionBande,
+} from './monde/atlas-normales.js'
+
+const COTE = 64 // pixels de côté — deux bandes de 29 lignes utiles après marge
+// ⚠️ **UNE SEULE ÉCRITURE DES PLAGES, ET C'EST UNE SURVIVANTE QUI L'A EXIGÉE.**
+// Elles étaient calculées DEUX fois — dans `coefAmbiante` et dans
+// `_sondeInterne` — et la campagne a pu changer la première sans que le test,
+// qui cherchait la chaîne, s'en aperçoive : il la retrouvait dans la seconde.
+const BANDES = bandesLecture(NORMALES_ATLAS.length, COTE)
 const CACHE = new WeakMap() // texture d'environnement → { ciel, sol } gelé
 
 export const AMBIANTE_NULLE = Object.freeze({
   ciel: Object.freeze([0, 0, 0]),
   sol: Object.freeze([0, 0, 0]),
 })
 
 let _scene = null
 let _cam = null
-let _bille = null
+let _atlas = null
 let _cible = null
 let _lecture = null
 
 function demiFlottantVersFlottant(h) {
   const s = (h & 0x8000) >> 15
   const e = (h & 0x7c00) >> 10
   const f = h & 0x03ff
   if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
   if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity)
   return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024)
 }
 
 function bati() {
   if (_scene) return
   _scene = new THREE.Scene()
-  _bille = new THREE.Mesh(
-    new THREE.SphereGeometry(1, 48, 32),
+  // ⚠️ **LA GÉOMÉTRIE VIENT DU MODULE PUR, ELLE N'EST PAS ÉCRITE ICI.** Le
+  // débord, l'écart entre bandes et l'ordre bas→haut sont les trois choses qui
+  // décident de ce que la sonde mesure, et ce sont les trois que
+  // `test/atlas-normales.test.js` peut exercer sous node.
+  const f = facesAtlas(NORMALES_ATLAS)
+  const geo = new THREE.BufferGeometry()
+  geo.setAttribute('position', new THREE.BufferAttribute(f.positions, 3))
+  geo.setAttribute('normal', new THREE.BufferAttribute(f.normales, 3))
+  geo.setIndex(new THREE.BufferAttribute(f.index, 1))
+  // ⚠️ **LE MATÉRIAU EST CELUI DU RELIEF DU SOCLE** — `MeshPhysicalMaterial`,
+  // `roughness = 1`, `metalness = 0`, `specularIntensity` à son défaut de 1 :
+  // c'est ce qui fait que la soustraction blanc − noir retient le facteur
+  // d'énergie `1 − max(totalScattering)` que le relief subit lui aussi.
+  _atlas = new THREE.Mesh(
+    geo,
     new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 1 })
   )
-  _scene.add(_bille)
-  // orthographique, cadrée exactement sur le disque unité, regardant −Z : la
-  // coordonnée écran `sy` EST alors `N·haut` (voir l'en-tête)
+  // ⚠️ **AUCUNE OMBRE** : la sonde ne mesure QUE l'environnement, et une carte
+  // d'ombres la ferait dépendre de ce que la scène d'accueil contient.
+  //
+  // ⚠️ **ET PAS DE `frustumCulled = false`, PARCE QU'IL SERAIT MORT.** Une
+  // mutation de la campagne P12 l'a remis à `true` et A SURVÉCU ; la recherche
+  // du code mort donne la raison : la sphère englobante de l'atlas est centrée
+  // sur l'origine, que le tronc de la caméra contient — l'objet n'est jamais
+  // écrêté, quelle que soit la valeur. Une ligne qu'aucun test ne peut défendre
+  // est une ligne qui ment sur ce qui protège la mesure.
+  _atlas.castShadow = false
+  _atlas.receiveShadow = false
+  _scene.add(_atlas)
+  // orthographique, cadrée exactement sur `[-1, 1]²`, regardant −Z : les faces
+  // sont posées en z = 0 et remplissent le cadre, débord compris
   _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
   _cam.position.set(0, 0, 4)
   _cam.lookAt(0, 0, 0)
   _cible = new THREE.WebGLRenderTarget(COTE, COTE, {
     type: THREE.HalfFloatType,
     depthBuffer: true,
     colorSpace: THREE.LinearSRGBColorSpace,
   })
   _lecture = new Uint16Array(COTE * COTE * 4)
 }
@@ -148,68 +218,48 @@ export function coefAmbiante(renderer, envTexture) {
   bati()
   const cibleAvant = renderer.getRenderTarget()
   const autoAvant = renderer.autoClear
   const ombreAvant = renderer.shadowMap.needsUpdate
   const clearAvant = renderer.getClearColor(new THREE.Color())
   const alphaAvant = renderer.getClearAlpha()
   _scene.environment = envTexture
   _scene.environmentIntensity = 1
   renderer.autoClear = true
   renderer.setClearColor(0x000000, 1)
-  _bille.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
+  _atlas.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
   const blanc = rendreEtLire(renderer)
-  _bille.material.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace)
+  _atlas.material.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace)
   const noir = rendreEtLire(renderer)
+  _atlas.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
   _scene.environment = null
   renderer.setRenderTarget(cibleAvant)
   renderer.autoClear = autoAvant
   renderer.setClearColor(clearAvant, alphaAvant)
   renderer.shadowMap.needsUpdate = ombreAvant
 
-  // Régression de E sur ndu = sy. `readRenderTargetPixels` rend la ligne 0 EN
-  // BAS (convention OpenGL), donc sy croît avec l'indice de ligne.
-  let n = 0
-  let sX = 0
-  let sXX = 0
-  const sY = [0, 0, 0]
-  const sXY = [0, 0, 0]
-  for (let ligne = 0; ligne < COTE; ligne++) {
-    const sy = ((ligne + 0.5) / COTE) * 2 - 1
-    for (let col = 0; col < COTE; col++) {
-      const i = (ligne * COTE + col) * 3
-      const sx = ((col + 0.5) / COTE) * 2 - 1
-      // hors du disque il n'y a pas de bille : la régression n'a rien à y lire
-      if (sx * sx + sy * sy > 0.98) continue
-      n++
-      sX += sy
-      sXX += sy * sy
-      for (let k = 0; k < 3; k++) {
-        // sortie = albédo · E / PI, albédo vaut 1 → E = PI · (blanc − noir)
-        const e = Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
-        sY[k] += e
-        sXY[k] += e * sy
-      }
-    }
-  }
+  // ⚠️ **LA BANDE DU BAS EST LE NADIR** (`readRenderTargetPixels` rend la ligne
+  // 0 en bas), et `NORMALES_ATLAS` est écrit dans cet ordre-là.
+  const sol = irradianceBande(blanc, noir, COTE, BANDES[0])
+  const ciel = irradianceBande(blanc, noir, COTE, BANDES[1])
   let res = AMBIANTE_NULLE
-  const det = n * sXX - sX * sX
-  if (n > 16 && Math.abs(det) > 1e-9) {
-    const ciel = [0, 0, 0]
-    const sol = [0, 0, 0]
-    for (let k = 0; k < 3; k++) {
-      const b = (n * sXY[k] - sX * sY[k]) / det // la pente : (ciel − sol) / 2
-      const a = (sY[k] - b * sX) / n // l'ordonnée : (ciel + sol) / 2
-      ciel[k] = Math.max(0, a + b)
-      sol[k] = Math.max(0, a - b)
-    }
-    if (ciel.every(Number.isFinite) && sol.every(Number.isFinite)) {
-      res = Object.freeze({ ciel: Object.freeze(ciel), sol: Object.freeze(sol), pixels: n })
-    }
+  if (ciel.every(Number.isFinite) && sol.every(Number.isFinite)) {
+    res = Object.freeze({
+      ciel: Object.freeze(ciel.map((v) => Math.max(0, v))),
+      sol: Object.freeze(sol.map((v) => Math.max(0, v))),
+      // ⚠️ **LE TÉMOIN DE LA MESURE** : tous les pixels d'une bande portent la
+      // même normale, donc le même nombre. Un écart non nul dit qu'un pixel de
+      // couture ou de fond est entré dans la moyenne.
+      dispersion: Math.max(
+        dispersionBande(blanc, noir, COTE, BANDES[0]),
+        dispersionBande(blanc, noir, COTE, BANDES[1])
+      ),
+      pixels: (BANDES[0].fin - BANDES[0].debut + 1 + BANDES[1].fin - BANDES[1].debut + 1) * COTE,
+    })
   }
   CACHE.set(envTexture, res)
   return res
 }
 
 /** Pour les bancs : l'intérieur de la sonde, sans le cache. */
 export function _sondeInterne() {
-  return { COTE, scene: _scene, bille: _bille, cible: _cible }
+  return { COTE, scene: _scene, atlas: _atlas, cible: _cible, bandes: BANDES }
 }
diff --git a/test/atlas-normales.test.js b/test/atlas-normales.test.js
new file mode 100644
index 0000000..dac7c02
--- /dev/null
+++ b/test/atlas-normales.test.js
@@ -0,0 +1,371 @@
+// L'ATLAS DE NORMALES — Tâche P12.
+//
+// ⛔ CE QUE CES TESTS EXISTENT POUR EMPÊCHER, ET CE N'EST PAS UNE HYPOTHÈSE :
+// la sonde d'ambiante de P3 a rendu pendant onze tâches un coefficient de ciel
+// **27,7 % trop grand**, parce qu'elle échantillonnait UNE MOITIÉ de sphère de
+// normales et régressait dessus comme si l'irradiance ne dépendait que de
+// `N·haut`. Rien ne l'a signalé : le nombre était plausible, le rendu juste, et
+// l'erreur ne se voyait qu'en comparant le bloc au socle dans la même page.
+//
+// La parade est de ne plus rien échantillonner : on mesure exactement les DEUX
+// grandeurs que le nuanceur consomme, l'irradiance au zénith et au nadir. Ce
+// fichier vérifie que la géométrie, les plages de lecture et la réduction
+// disent bien ça — et **il APPARIE les deux conversions**, comme la Tâche P10
+// l'a fait pour la monnaie du gradient : une face et sa plage de lecture ne
+// peuvent pas dériver l'une de l'autre sans qu'un test rougisse.
+
+import { test } from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import {
+  ZENITH,
+  NADIR,
+  NORMALES_ATLAS,
+  DEBORD,
+  ECART,
+  MARGE_MIN,
+  facesAtlas,
+  bandesLecture,
+  irradianceBande,
+  dispersionBande,
+} from '../src/monde/atlas-normales.js'
+
+const SONDE = readFileSync(new URL('../src/sonde-ambiante.js', import.meta.url), 'utf8')
+const SRC = readFileSync(new URL('../src/monde/atlas-normales.js', import.meta.url), 'utf8')
+
+// le coin `s` de la face `i`, tel que `facesAtlas` l'écrit
+const sommet = (f, i, s) => [f.positions[(i * 4 + s) * 3], f.positions[(i * 4 + s) * 3 + 1], f.positions[(i * 4 + s) * 3 + 2]]
+const sommetIndexe = (f, v) => [f.positions[v * 3], f.positions[v * 3 + 1], f.positions[v * 3 + 2]]
+const normale = (f, i, s) => [f.normales[(i * 4 + s) * 3], f.normales[(i * 4 + s) * 3 + 1], f.normales[(i * 4 + s) * 3 + 2]]
+const bornesY = (f, i) => {
+  let lo = Infinity
+  let hi = -Infinity
+  for (let s = 0; s < 4; s++) {
+    const y = sommet(f, i, s)[1]
+    if (y < lo) lo = y
+    if (y > hi) hi = y
+  }
+  return [lo, hi]
+}
+
+// ══════════ ① LA GÉOMÉTRIE ══════════════════════════════════════════════════
+
+test('①a les deux normales sont les DEUX PÔLES, et rien d’autre', () => {
+  // ⚠️ Le nuanceur évalue `mix(sol, ciel, 0.5·ndu + 0.5)` : il vaut `ciel` à
+  // `ndu = +1` et `sol` à `ndu = −1`. Ce sont ces deux grandeurs-là qu'on
+  // mesure, donc ces deux normales-là et pas des voisines.
+  assert.deepEqual([...ZENITH], [0, 1, 0])
+  assert.deepEqual([...NADIR], [0, -1, 0])
+  assert.equal(NORMALES_ATLAS.length, 2)
+  for (const n of NORMALES_ATLAS) {
+    const l = Math.hypot(n[0], n[1], n[2])
+    assert.ok(Math.abs(l - 1) < 1e-15, `normale non unitaire : ${l}`)
+  }
+})
+
+test('①b ⛔ LA BANDE DU BAS EST LE NADIR — la ligne 0 est en bas', () => {
+  // ⛔ `readRenderTargetPixels` rend la ligne 0 EN BAS (convention OpenGL).
+  // Échanger les deux normales éclairerait le bloc par en dessous, et AUCUNE
+  // erreur ne serait levée : le ciel et le sol sont deux triplets du même type.
+  assert.equal(NORMALES_ATLAS[0], NADIR)
+  assert.equal(NORMALES_ATLAS[1], ZENITH)
+  const f = facesAtlas(NORMALES_ATLAS)
+  // la face 0 est la BASSE, et elle porte `ndu = −1`
+  assert.ok(bornesY(f, 0)[1] < bornesY(f, 1)[0], 'la face 0 doit être sous la face 1')
+  assert.equal(normale(f, 0, 0)[1], -1)
+  assert.equal(normale(f, 1, 0)[1], 1)
+})
+
+test('①c chaque face porte SA normale sur ses quatre sommets', () => {
+  const f = facesAtlas(NORMALES_ATLAS)
+  for (let i = 0; i < NORMALES_ATLAS.length; i++) {
+    for (let s = 0; s < 4; s++) assert.deepEqual(normale(f, i, s), [...NORMALES_ATLAS[i]])
+  }
+})
+
+test('①d les faces DÉBORDENT du cadre : aucun pixel lu n’est à couverture partielle', () => {
+  // ⚠️ Si une face s'arrêtait exactement sur le bord du cadre, le pixel du bord
+  // mélangerait la face et le fond — et le fond vaut ZÉRO, donc l'irradiance
+  // lue serait trop basse d'une fraction inconnue.
+  const f = facesAtlas(NORMALES_ATLAS)
+  const n = NORMALES_ATLAS.length
+  for (let i = 0; i < n; i++) {
+    let xlo = Infinity
+    let xhi = -Infinity
+    for (let s = 0; s < 4; s++) {
+      const x = sommet(f, i, s)[0]
+      if (x < xlo) xlo = x
+      if (x > xhi) xhi = x
+    }
+    assert.ok(xlo <= -1 - DEBORD + 1e-12, `face ${i} : bord gauche à ${xlo}`)
+    assert.ok(xhi >= 1 + DEBORD - 1e-12, `face ${i} : bord droit à ${xhi}`)
+  }
+  assert.ok(bornesY(f, 0)[0] <= -1 - DEBORD + 1e-12, 'la face du bas doit déborder par le bas')
+  assert.ok(bornesY(f, n - 1)[1] >= 1 + DEBORD - 1e-12, 'la face du haut doit déborder par le haut')
+  assert.ok(DEBORD > 0)
+})
+
+test('①e les faces sont SÉPARÉES d’un écart non nul, et posées en z = 0', () => {
+  const f = facesAtlas(NORMALES_ATLAS)
+  const trou = bornesY(f, 1)[0] - bornesY(f, 0)[1]
+  // ⚠️ tolérance de FLOTTANT SIMPLE : `facesAtlas` rend un `Float32Array`, donc
+  // 0,05 y vaut 0,050 000 000 745. Exiger 1e−12 sur une valeur passée par un
+  // float32 est une faute de précision, pas une exigence.
+  assert.ok(Math.abs(trou - 2 * ECART) < 1e-6, `écart mesuré ${trou}, attendu ${2 * ECART}`)
+  assert.ok(ECART > 0)
+  for (let i = 0; i < 2; i++) for (let s = 0; s < 4; s++) assert.equal(sommet(f, i, s)[2], 0)
+})
+
+test('①f l’enroulement est DIRECT : les faces regardent la caméra', () => {
+  // ⚠️ La caméra de la sonde est en +Z et regarde −Z. Une face à l'enroulement
+  // inverse serait vue de dos : `gl_FrontFacing` faux, et un jour où quelqu'un
+  // poserait `side: DoubleSide`, three retournerait la normale — donc le ciel
+  // et le sol s'échangeraient, en silence.
+  // ⚠️ **ON LIT L'INDEX, PAS L'ORDRE DES COINS — une survivante l'a exigé.**
+  // La campagne a retourné les DEUX triangles dans `idx.set(...)` et le test
+  // n'a pas rougi : il supposait `[0,1,2]` et `[0,2,3]`. Or c'est l'INDEX que
+  // le GPU parcourt, et c'est lui qui décide de `gl_FrontFacing`.
+  const f = facesAtlas(NORMALES_ATLAS)
+  assert.equal(f.index.length, 12)
+  for (let t = 0; t < f.index.length / 3; t++) {
+    const a = sommetIndexe(f, f.index[t * 3])
+    const b = sommetIndexe(f, f.index[t * 3 + 1])
+    const c = sommetIndexe(f, f.index[t * 3 + 2])
+    const z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
+    assert.ok(z > 0, `triangle ${t} (${f.index[t * 3]},${f.index[t * 3 + 1]},${f.index[t * 3 + 2]}) : normale géométrique en ${z}`)
+  }
+})
+
+test('①g l’index décrit deux triangles par face, sur les sommets de CETTE face', () => {
+  const f = facesAtlas(NORMALES_ATLAS)
+  assert.equal(f.index.length, 2 * 6)
+  assert.equal(f.positions.length, 2 * 4 * 3)
+  for (let i = 0; i < 2; i++) {
+    for (let k = 0; k < 6; k++) {
+      const v = f.index[i * 6 + k]
+      assert.ok(v >= i * 4 && v < (i + 1) * 4, `la face ${i} référence le sommet ${v}`)
+    }
+  }
+})
+
+test('①h la loi vaut pour un nombre QUELCONQUE de faces', () => {
+  // ⚠️ La géométrie ne doit pas être écrite « pour deux » : le jour où la sonde
+  // voudra un troisième point, elle ne doit pas redécouvrir le débord.
+  for (const n of [1, 3, 5]) {
+    const normales = Array.from({ length: n }, (_, i) => [0, -1 + (2 * i) / Math.max(1, n - 1) || 0, 0])
+    const f = facesAtlas(normales)
+    assert.equal(f.positions.length, n * 4 * 3)
+    for (let i = 0; i + 1 < n; i++) {
+      assert.ok(bornesY(f, i)[1] < bornesY(f, i + 1)[0], `faces ${i} et ${i + 1} non ordonnées`)
+    }
+    assert.ok(bornesY(f, 0)[0] <= -1 - DEBORD + 1e-12)
+    assert.ok(bornesY(f, n - 1)[1] >= 1 + DEBORD - 1e-12)
+  }
+})
+
+// ══════════ ② LES PLAGES DE LECTURE, APPARIÉES À LA GÉOMÉTRIE ═══════════════
+
+test('②a les plages ne se chevauchent pas et tiennent dans le tampon', () => {
+  for (const cote of [16, 32, 64, 128]) {
+    const b = bandesLecture(2, cote)
+    assert.ok(b[0].debut >= 0, `cote ${cote}`)
+    assert.ok(b[1].fin <= cote - 1, `cote ${cote}`)
+    assert.ok(b[0].fin < b[1].debut, `cote ${cote}`)
+    for (const p of b) assert.ok(p.fin >= p.debut, `plage vide à cote ${cote}`)
+  }
+})
+
+test('②b ⚡ L’INVARIANT QUI APPARIE LES DEUX CONVERSIONS', () => {
+  // ⚡ C'est la parade de la Tâche P10 (`TOUR × UNITE = 2πR`), appliquée ici :
+  // `facesAtlas` dit OÙ chaque normale est dessinée, `bandesLecture` dit OÙ on
+  // la lit. Ce sont DEUX conversions du même découpage, et rien ne les tenait
+  // ensemble. On l'écrit une fois : **le centre de chaque ligne lue doit tomber
+  // STRICTEMENT à l'intérieur de la face de sa bande.**
+  for (const cote of [16, 32, 64, 128, 256]) {
+    const f = facesAtlas(NORMALES_ATLAS)
+    const b = bandesLecture(NORMALES_ATLAS.length, cote)
+    for (let i = 0; i < 2; i++) {
+      const [lo, hi] = bornesY(f, i)
+      for (let ligne = b[i].debut; ligne <= b[i].fin; ligne++) {
+        const y = ((ligne + 0.5) / cote) * 2 - 1
+        assert.ok(y > lo && y < hi, `cote ${cote}, bande ${i}, ligne ${ligne} : y = ${y} hors de [${lo} ; ${hi}]`)
+      }
+    }
+  }
+})
+
+test('②c la marge écarte bien la couture, et sans elle l’invariant TOMBE', () => {
+  // ⚠️ La preuve que `MARGE` porte quelque chose : à marge nulle, une ligne lue
+  // tombe dans l'écart entre les deux faces, là où il n'y a RIEN à lire.
+  const f = facesAtlas(NORMALES_ATLAS)
+  const cote = 64
+  // ⚠️ `ecart = 0` retire la couture DU CALCUL sans la retirer de la géométrie :
+  // c'est exactement la mutation qu'on veut voir mourir.
+  const sansMarge = bandesLecture(2, cote, 0).map((p, i) => (i === 0 ? { debut: p.debut, fin: cote / 2 - 1 } : { debut: cote / 2, fin: p.fin }))
+  let fautes = 0
+  for (let i = 0; i < 2; i++) {
+    const [lo, hi] = bornesY(f, i)
+    for (let ligne = sansMarge[i].debut; ligne <= sansMarge[i].fin; ligne++) {
+      const y = ((ligne + 0.5) / cote) * 2 - 1
+      if (!(y > lo && y < hi)) fautes++
+    }
+  }
+  assert.ok(fautes > 0, 'à marge nulle, au moins une ligne doit tomber dans la couture')
+  assert.ok(MARGE_MIN >= 1)
+})
+
+test('②d les plages de la sonde livrée, à COTE = 64', () => {
+  assert.deepEqual(bandesLecture(2, 64), [{ debut: 0, fin: 28 }, { debut: 35, fin: 63 }])
+  // ⚠️ et la marge SUIT la taille : à 256, trois lignes n'auraient pas suffi
+  assert.deepEqual(bandesLecture(2, 256), [{ debut: 0, fin: 119 }, { debut: 136, fin: 255 }])
+})
+
+// ══════════ ③ LA RÉDUCTION ══════════════════════════════════════════════════
+
+function tampon(cote, valeur) {
+  const t = new Float32Array(cote * cote * 3)
+  for (let ligne = 0; ligne < cote; ligne++) {
+    for (let col = 0; col < cote; col++) {
+      const v = valeur(ligne, col)
+      const i = (ligne * cote + col) * 3
+      t[i] = v[0]
+      t[i + 1] = v[1]
+      t[i + 2] = v[2]
+    }
+  }
+  return t
+}
+
+test('③a E = π × (blanc − noir) : le facteur est celui de BRDF_Lambert', () => {
+  // ⚠️ La sortie d'une surface d'albédo 1 vaut `E / π` (`BRDF_Lambert` de
+  // three) : sans le π, l'irradiance rendue serait 3,14 fois trop petite et le
+  // bloc trois fois trop sombre. Un test qui compare deux moyennes entre elles
+  // ne le verrait pas — celui-ci compare à une valeur POSÉE.
+  const cote = 64
+  const blanc = tampon(cote, () => [0.5, 0.25, 0.125])
+  const noir = tampon(cote, () => [0.1, 0.05, 0.025])
+  const b = bandesLecture(2, cote)
+  const E = irradianceBande(blanc, noir, cote, b[1])
+  assert.ok(Math.abs(E[0] - 0.4 * Math.PI) < 1e-6, `${E[0]}`)
+  assert.ok(Math.abs(E[1] - 0.2 * Math.PI) < 1e-6)
+  assert.ok(Math.abs(E[2] - 0.1 * Math.PI) < 1e-6)
+})
+
+test('③b la soustraction du spéculaire est une SOUSTRACTION, et elle est bornée à 0', () => {
+  const cote = 32
+  const b = bandesLecture(2, cote)
+  // un noir plus clair que le blanc n'a pas de sens physique : on borne
+  const E = irradianceBande(tampon(cote, () => [0.1, 0.1, 0.1]), tampon(cote, () => [0.4, 0.4, 0.4]), cote, b[0])
+  assert.deepEqual(E, [0, 0, 0])
+  // et le spéculaire, lui, est bien retiré
+  const F = irradianceBande(tampon(cote, () => [1, 1, 1]), tampon(cote, () => [0.04, 0.04, 0.04]), cote, b[0])
+  assert.ok(Math.abs(F[0] - 0.96 * Math.PI) < 1e-6)
+})
+
+test('③c les deux bandes lisent DEUX endroits différents du tampon', () => {
+  // ⛔ Si les deux plages tombaient au même endroit, `ciel` et `sol` seraient
+  // égaux et le bloc s'éclairerait à plat — sans qu'aucune erreur ne soit levée.
+  const cote = 64
+  const b = bandesLecture(2, cote)
+  const blanc = tampon(cote, (ligne) => (ligne < cote / 2 ? [0.2, 0.2, 0.2] : [0.9, 0.9, 0.9]))
+  const noir = tampon(cote, () => [0, 0, 0])
+  const bas = irradianceBande(blanc, noir, cote, b[0])
+  const haut = irradianceBande(blanc, noir, cote, b[1])
+  assert.ok(Math.abs(bas[0] - 0.2 * Math.PI) < 1e-6, `bas = ${bas[0]}`)
+  assert.ok(Math.abs(haut[0] - 0.9 * Math.PI) < 1e-6, `haut = ${haut[0]}`)
+})
+
+test('③d la dispersion vaut ZÉRO sur une bande propre, et DÉNONCE un intrus', () => {
+  // ⚡ C'est le témoin de la mesure : tous les pixels d'une bande portent la
+  // MÊME normale, donc le même nombre. `coefAmbiante` le publie.
+  const cote = 64
+  const b = bandesLecture(2, cote)
+  const noir = tampon(cote, () => [0, 0, 0])
+  assert.equal(dispersionBande(tampon(cote, () => [0.5, 0.5, 0.5]), noir, cote, b[1]), 0)
+  // un pixel étranger DANS la plage : la dispersion le voit
+  const sale = tampon(cote, (ligne, col) => (ligne === b[1].debut + 3 && col === 7 ? [0.1, 0.1, 0.1] : [0.5, 0.5, 0.5]))
+  assert.ok(dispersionBande(sale, noir, cote, b[1]) > 0.7)
+  // le même pixel HORS de la plage : la marge fait son travail, elle ne le voit pas
+  const propre = tampon(cote, (ligne, col) => (ligne === b[1].debut - 1 && col === 7 ? [0.1, 0.1, 0.1] : [0.5, 0.5, 0.5]))
+  assert.equal(dispersionBande(propre, noir, cote, b[1]), 0)
+})
+
+test('③e une bande vide rend zéro plutôt que NaN', () => {
+  // ⚠️ Une division par zéro poserait NaN dans `uCielIrr`, et un NaN dans une
+  // irradiance peint un trou noir.
+  const E = irradianceBande(new Float32Array(48), new Float32Array(48), 4, { debut: 3, fin: 1 })
+  assert.deepEqual(E, [0, 0, 0])
+  assert.equal(dispersionBande(new Float32Array(48), new Float32Array(48), 4, { debut: 3, fin: 1 }), 0)
+})
+
+// ══════════ ④ LE BRANCHEMENT DANS LA SONDE ══════════════════════════════════
+
+test('④a la sonde IMPORTE le module et n’écrit plus sa géométrie', () => {
+  assert.match(SONDE, /from '\.\/monde\/atlas-normales\.js'/)
+  assert.match(SONDE, /facesAtlas\(NORMALES_ATLAS\)/)
+  // ⚠️ **UNE SEULE FOIS — UNE SURVIVANTE L'A EXIGÉ.** Les plages étaient
+  // calculées dans `coefAmbiante` ET dans `_sondeInterne` : la campagne a changé
+  // la première, et ce test a retrouvé la chaîne dans la seconde.
+  assert.equal((SONDE.match(/bandesLecture\(/g) || []).length, 1,
+    'les plages de lecture sont calculées DEUX fois : une mutation de l une passerait inaperçue')
+  assert.match(SONDE, /const BANDES = bandesLecture\(NORMALES_ATLAS\.length, COTE\)/)
+  // ⛔ la bille de P3 a disparu AVEC la loi qu'elle servait : plus de sphère,
+  // plus de disque à rejeter, plus de régression sur une demi-sphère
+  assert.doesNotMatch(SONDE, /SphereGeometry/)
+  assert.doesNotMatch(SONDE, /sx \* sx \+ sy \* sy/)
+})
+
+test('④b ⛔ LE SOL VIENT DE LA BANDE 0 ET LE CIEL DE LA BANDE 1', () => {
+  // ⛔ L'échange est invisible : deux triplets du même type, aucune erreur. Il
+  // retournerait l'éclairage indirect du bloc de haut en bas.
+  assert.match(SONDE, /const sol = irradianceBande\(blanc, noir, COTE, BANDES\[0\]\)/)
+  assert.match(SONDE, /const ciel = irradianceBande\(blanc, noir, COTE, BANDES\[1\]\)/)
+})
+
+test('④c le spéculaire n’est PAS coupé sur la sonde, et c’est délibéré', () => {
+  // ⚠️ three atténue le diffus indirect par `1 − max(totalScattering)` — mesuré
+  // **0,991** dans la page vivante (`.banc/P12/D4-verif-irradiance-P12.json`).
+  // Ce facteur, le relief du socle le subit ; la soustraction blanc − noir le
+  // retient. Poser `specularIntensity: 0` rendrait l'irradiance « pure » et le
+  // crop ressortirait presque 1 % trop clair.
+  assert.doesNotMatch(SONDE, /specularIntensity: 0/)
+  assert.match(SONDE, /roughness: 1, metalness: 0/)
+  // les deux rendus, et l'ordre : blanc puis noir
+  assert.ok(SONDE.indexOf('const blanc = rendreEtLire') < SONDE.indexOf('const noir = rendreEtLire'))
+})
+
+test('④d les gardes de P3 tiennent : cache, état du renderer, intensité 1', () => {
+  // ⛔ **LA GARDE QUI TIENT LA PRODUCTION INTOUCHÉE** : sans environnement, la
+  // sonde ne rend RIEN et l'appelant reçoit une ambiante nulle. Une sonde qui
+  // tenterait de rendre avec `envTexture` à `null` peindrait un coefficient de
+  // zéro — ou lancerait, sur le chemin du démarrage.
+  assert.match(SONDE, /if \(!renderer \|\| !envTexture\) return AMBIANTE_NULLE/)
+  assert.match(SONDE, /const CACHE = new WeakMap\(\)/)
+  assert.match(SONDE, /const memo = CACHE\.get\(envTexture\)/)
+  assert.match(SONDE, /_scene\.environment = envTexture/)
+  assert.match(SONDE, /_scene\.environmentIntensity = 1/)
+  // ⛔ **ET TOUT CE QUE LA SONDE EMPRUNTE AU RENDERER, ELLE LE REND.** Le §0 du
+  // plan liste `autoClear === false` comme la première façon dont un banc a menti
+  // sur ce chantier, et `PasseFond` a déjà avaleé `shadowMap.needsUpdate` une
+  // fois. Une sonde qui laisse l'un des quatre derrière elle casse la page qui
+  // l'appelle, pas elle-même.
+  assert.match(SONDE, /renderer\.autoClear = autoAvant/)
+  assert.match(SONDE, /renderer\.setClearColor\(clearAvant, alphaAvant\)/)
+  assert.match(SONDE, /shadowMap\.needsUpdate = ombreAvant/)
+  assert.match(SONDE, /renderer\.setRenderTarget\(cibleAvant\)/)
+  assert.match(SONDE, /_scene\.environment = null/)
+  assert.match(SONDE, /Object\.freeze/)
+})
+
+test('④e le module reste PUR : ni three, ni DOM, ni fetch', () => {
+  // ⚠️ **ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER.** L'en-tête DIT que le
+  // module est pur — le mot « fetch » y figure — et un test qui lit le fichier
+  // entier rougirait sur sa propre documentation. La tautologie inverse, et
+  // elle s'écrit sans qu'on la voie.
+  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
+  assert.doesNotMatch(code, /\bimport\b/)
+  assert.doesNotMatch(code, /THREE|document|window|fetch|require\(/)
+  // et le témoin, sans lequel le retrait des commentaires ne prouverait rien
+  assert.match(SRC, /fetch/)
+})
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
index 87f8d3e..3c3655c 100644
--- a/test/crop-eclairage.test.js
+++ b/test/crop-eclairage.test.js
@@ -1297,21 +1297,30 @@ test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, monnaie, pas, et
   // rendrait des pentes fausses d'un facteur `exagération²`, en silence.
   assert.match(bloc, /float cosLat = max\(cos\(radians\(vLatLon\.x\)\), 1e-4\);/)
   assert.match(bloc, /float metresParUv = [\d.]+ \* uUvParMonde \* cosLat;/)
   assert.match(bloc, /float uniteParUv = metresParUv \* [\d.e-]+;/)
   assert.match(bloc, /float k = uUnitesParMetre \/ \(2\.0 \* pas \* uniteParUv\);/)
   assert.match(bloc, /normaleParGradientSol\(dhU \* k, dhV \* k, est, nord, haut\)/)
   // ⑤ le PAS : le texel est un PLANCHER, l'empreinte l'emporte quand elle est
   // plus grande, et sans `uMppFacteur` on retombe sur le texel — jamais sur
   // `fwidth`, qui ramènerait la parité par la fenêtre.
   assert.match(bloc, /float pasEmpreinte = uMppFacteur > 0\.0 \? vProfCam \* uMppFacteur \/ metresParUv : 0\.0;/)
-  assert.match(bloc, /float pas = max\(1\.0 \/ uTilePx, pasEmpreinte\);/)
+  // ⛔ **ET L'EMPREINTE NE S'APPLIQUE PAS AU FOND MARIN — Tâche P12.** Sous
+  // l'eau la hauteur ne vient pas du MNT mais du champ cuit, six fois plus
+  // grossier : il n'y a rien à filtrer, et l'empreinte ne fait que perdre de la
+  // pente (grain du fond marin 72,5 % du socle au pas livré, 85,1 % à un texel,
+  // `.banc/P12/e1-pas-mer.js`). Le plancher d'un texel, lui, reste des DEUX
+  // côtés — c'est le seul qui protège d'une différence prise plus fin que la
+  // donnée. ⚠️ La loi elle-même est EXÉCUTÉE par `test/fond-crop.test.js` ⑩d.
+  assert.match(bloc, /float pas = fondMarin \? \(1\.0 \/ uTilePx\) : max\(1\.0 \/ uTilePx, pasEmpreinte\);/)
+  assert.equal((bloc.match(/1\.0 \/ uTilePx/g) || []).length, 2,
+    'le plancher du texel doit rester sur les DEUX branches')
   // ⑥ ⛔ LE DÉCALAGE DE `qCrop` SUIT L'UV, ET LE SIGNE DU NORD EST RETOURNÉ.
   // `uv.y` croît vers le NORD (`1 - v` dans `_buildMesh`) quand le `y` de
   // Mercator croît vers le SUD. Le signe perdu, le fond marin serait lu de
   // l'autre côté du bloc — invisible sur un fond plat, faux sur un talus.
   // ⛔ **LE NORD DU FRAGMENT — UNE MUTATION SURVIVANTE.** `cross(est, haut)`
   // rendrait le SUD, et l'éclairage des versants nord-sud s'inverserait. ⑧d
   // prouve que le trièdre est direct ; ici on vérifie que le nuanceur s'en sert
   // dans le bon ordre.
   assert.match(bloc, /vec3 nord = cross\(haut, est\);/)
   // ⛔ **ET LE DEMI-CÔTÉ DU CROP DIVISE, IL NE MULTIPLIE PAS — deuxième
diff --git a/test/fond-crop.test.js b/test/fond-crop.test.js
index 156aa69..c685866 100644
--- a/test/fond-crop.test.js
+++ b/test/fond-crop.test.js
@@ -594,42 +594,53 @@ test('⑧ septies la texture du fond relit EXACTEMENT ce que le champ portait',
 // ce bloc. Le précédent est `test/mer-sphere.test.js`, qui « EXTRAIT cette
 // expression pour la confronter à elle » : on translittère mécaniquement le
 // GLSL en JavaScript et on l'oppose à `altitudeSonde`, la loi qu'il transcrit.
 //
 // ⚠️ **LA TRANSLITTÉRATION EST MÉCANIQUE, ET C'EST TOUT SON INTÉRÊT** : elle ne
 // réécrit pas la loi, elle remplace `min`/`max`/`abs` par leurs jumeaux de
 // `Math`, `&&` reste `&&`, et le `texture2D(...).r * uFondMetres` devient un
 // échantillonneur de papier. Ce qui change dans la source change donc dans la
 // fonction, et le test rougit sur le COMPORTEMENT.
 
+// ⚠️ **LE BLOC EXTRAIT COMMENCE À `surLeFond` DEPUIS LA TÂCHE P12** : la
+// condition qui décidait de la hauteur a un SECOND lecteur — le PAS du gradient
+// de la normale fine — et elle est donc nommée. Extraire `hauteurFond` seule
+// laisserait la condition, c'est-à-dire toute la loi, hors du test.
 const BLOC_FOND_GLSL = (() => {
-  const debut = FRAG_GLOBE.indexOf('  if (uFondOn > 0.5')
+  const debut = FRAG_GLOBE.indexOf('bool surLeFond(vec2 qCrop, float h)')
   if (debut < 0) throw new Error('le bloc du fond a disparu du nuanceur')
-  const fin = FRAG_GLOBE.indexOf('\n  }', debut)
-  return FRAG_GLOBE.slice(debut, fin + 4)
+  const ancre = FRAG_GLOBE.indexOf('float hauteurFond(vec2 qCrop, float h)', debut)
+  if (ancre < 0) throw new Error('hauteurFond a disparu du nuanceur')
+  const fin = FRAG_GLOBE.indexOf('\n}', ancre)
+  return FRAG_GLOBE.slice(debut, fin + 2)
 })()
 
 // GLSL → JS, mécaniquement.
-const fondDuNuanceur = (() => {
-  const js = BLOC_FOND_GLSL
-    .replace(/\bfloat\s+/g, 'let ')
-    .replace(/\bmin\(/g, 'Math.min(')
-    .replace(/\bmax\(/g, 'Math.max(')
-    .replace(/\babs\(/g, 'Math.abs(')
-    // ⚠️ **NON GOURMAND, ET LA PARENTHÈSE INTERNE EST LA RAISON** : l'argument
-    // porte `(2.0 * uFondPortee)`, donc un `[^)]*` s'arrêterait au MAUVAIS `)`.
-    .replace(/texture2D\(uFondChamp,[\s\S]*?\)\.r/g, 'echantillon')
-    .replace(/0\.5;/g, '0.5;')
-  // eslint-disable-next-line no-new-func
-  return new Function('uFondOn', 'uCropOn', 'uFondPortee', 'uFondMetres', 'qCrop', 'h', 'echantillon',
-    js + '\n  return h;')
-})()
+const traduire = (glsl) => glsl
+  .replace(/\bbool surLeFond\(vec2 qCrop, float h\)/, 'function surLeFond(qCrop, h)')
+  .replace(/\bfloat hauteurFond\(vec2 qCrop, float h\)/, 'function hauteurFond(qCrop, h)')
+  .replace(/\bfloat\s+/g, 'let ')
+  .replace(/\bmin\(/g, 'Math.min(')
+  .replace(/\bmax\(/g, 'Math.max(')
+  .replace(/\babs\(/g, 'Math.abs(')
+  // ⚠️ **NON GOURMAND, ET LA PARENTHÈSE INTERNE EST LA RAISON** : l'argument
+  // porte `(2.0 * uFondPortee)`, donc un `[^)]*` s'arrêterait au MAUVAIS `)`.
+  .replace(/texture2D\(uFondChamp,[\s\S]*?\)\.r/g, 'echantillon')
+
+const ARGS_FOND = ['uFondOn', 'uCropOn', 'uFondPortee', 'uFondMetres', 'qCrop', 'h', 'echantillon']
+// eslint-disable-next-line no-new-func
+const fondDuNuanceur = new Function(...ARGS_FOND, traduire(BLOC_FOND_GLSL) + '\n  return hauteurFond(qCrop, h);')
+// ⚡ **ET LA CONDITION ELLE-MÊME, EXÉCUTABLE** : c'est elle que le pas du
+// gradient relit dans `main()`, et son contrat — être STABLE par la composition
+// avec `hauteurFond` — n'est vérifiable qu'en la faisant tourner.
+// eslint-disable-next-line no-new-func
+const surLeFondDuNuanceur = new Function(...ARGS_FOND, traduire(BLOC_FOND_GLSL) + '\n  return surLeFond(qCrop, h);')
 
 test('⑨ le bloc du nuanceur EST `altitudeSonde` — translittéré, puis exécuté', () => {
   const portee = 3
   const echelleInverse = 22753.57142857143 // 1 / echelle, relevé dans l'application
   for (const h of [-288.36, -0.7, 0, 12.5, 2975.25]) {
     for (const fondM of [-2116.3, -920.7, -0.5, 0, 37.5]) {
       for (const q of [{ x: 0, y: 0 }, { x: 2.9, y: -1 }, { x: -3, y: 3 }]) {
         const echantillon = fondM / echelleInverse // ce que la texture porte : des unités locales
         const rendu = fondDuNuanceur(1, 1, portee, echelleInverse, q, h, echantillon)
         const attendu = altitudeSonde(h, fondM)
@@ -757,10 +768,151 @@ test('⑪ bis `retirerCrop` retire AUSSI le fond — sinon la mer reste creusée
   Globe.prototype.retirerCrop.call(g)
 
   assert.ok(journal.includes('retirerFondCrop'), '`retirerCrop` doit appeler `retirerFondCrop`')
   assert.equal(g._crop, null)
   assert.equal(g._fondCrop, null)
   assert.equal(g.uniforms.uFondOn.value, 0)
   assert.equal(g.uniforms.uFondChamp.value, null)
   assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4,
     'le crop retiré, la surface doit être revenue SUR la sphère')
 })
+
+// ══════════ ⑩ LE PAS DU GRADIENT SUIT LA SOURCE — Tâche P12 ═════════════════
+//
+// ⛔ CE QUE CES TESTS EXISTENT POUR EMPÊCHER. `hauteurFond` ÉCRASE la hauteur du
+// MNT par le champ cuit dès qu'on est sous l'eau. Le pas du gradient de la
+// normale fine, lui, était borné par l'EMPREINTE DU PIXEL — une borne dont
+// l'argument (P10 §2.4) porte sur la MINIFICATION du MNT, et qui ne veut rien
+// dire pour un champ six fois plus grossier que le MNT. Le prix mesuré :
+// **24,6 % du grain du fond marin** (notation 04 §5-④), et **+22 % sur la
+// frange côtière en marches**.
+//
+// La condition est donc NOMMÉE (`surLeFond`) et LUE DEUX FOIS. Ce qui suit
+// vérifie qu'elle ne peut pas diverger d'un lecteur à l'autre.
+
+test('⑩a ⚡ `surLeFond` est STABLE PAR LA COMPOSITION — c’est ce qui permet de la relire APRÈS `hauteurFond`', () => {
+  // ⛔ `main()` appelle `surLeFond(qCrop, h)` sur un `h` qui a DÉJÀ traversé
+  // `hauteurFond`. Si la condition changeait de valeur au passage, le pas
+  // basculerait sur la mauvaise loi une bande de fragments sur deux — sans
+  // qu'aucune erreur ne soit levée.
+  const echelleInverse = 22753.57142857143
+  let vus = { vrai: 0, faux: 0 }
+  for (const uFondOn of [0, 1]) {
+    for (const uCropOn of [0, 1]) {
+      for (const h of [-2000, -288.36, -0.7, 0, 1e-7, 12.5, 2975.25]) {
+        for (const fondM of [-2116.3, -920.7, -0.5, 0, 37.5]) {
+          for (const q of [{ x: 0, y: 0 }, { x: 2.9, y: -1 }, { x: 3, y: 0 }, { x: -3.01, y: 3 }, { x: 5, y: 5 }]) {
+            const ech = fondM / echelleInverse
+            const avant = surLeFondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, h, ech)
+            const hh = fondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, h, ech)
+            const apres = surLeFondDuNuanceur(uFondOn, uCropOn, 3, echelleInverse, q, hh, ech)
+            assert.equal(apres, avant,
+              `surLeFond change de valeur au passage de hauteurFond : uFondOn=${uFondOn} uCropOn=${uCropOn} h=${h} fond=${fondM} q=(${q.x},${q.y})`)
+            vus[avant ? 'vrai' : 'faux']++
+          }
+        }
+      }
+    }
+  }
+  // ⚠️ **ET LE BALAYAGE VOIT LES DEUX CÔTÉS** : un test qui ne rencontrerait
+  // jamais `vrai` passerait aussi sur un `surLeFond` qui rend toujours faux.
+  assert.ok(vus.vrai > 50, `la condition n'est jamais vraie dans ce balayage (${vus.vrai})`)
+  assert.ok(vus.faux > 50, `la condition n'est jamais fausse dans ce balayage (${vus.faux})`)
+})
+
+test('⑩b `surLeFond` EST la condition qui décide de la hauteur — exécutée, pas lue', () => {
+  // ⛔ Une mutation qui relâche la condition d'un seul côté (par exemple
+  // `h < 0.0` ici et `h <= 0.0` là) ferait basculer le pas sur des fragments
+  // dont la hauteur vient encore du MNT. On l'oppose au COMPORTEMENT de
+  // `hauteurFond` : quand la condition est fausse, la hauteur ne bouge PAS ;
+  // quand elle est vraie, elle vaut `min(champ, 0)`.
+  const echelleInverse = 22753.57142857143
+  for (const h of [-288.36, -0.7, 0, 12.5, 2975.25]) {
+    for (const fondM of [-2116.3, -0.5, 0, 37.5]) {
+      for (const q of [{ x: 0, y: 0 }, { x: 3, y: 3 }, { x: 3.0001, y: 0 }]) {
+        const ech = fondM / echelleInverse
+        const cond = surLeFondDuNuanceur(1, 1, 3, echelleInverse, q, h, ech)
+        const rendu = fondDuNuanceur(1, 1, 3, echelleInverse, q, h, ech)
+        if (cond) assert.ok(Math.abs(rendu - Math.min(fondM, 0)) < 1e-6, `h=${h} fond=${fondM} q=(${q.x},${q.y})`)
+        else assert.equal(rendu, h, `h=${h} fond=${fondM} q=(${q.x},${q.y}) : la hauteur a bougé hors condition`)
+      }
+    }
+  }
+  // ⛔ **ET LES DEUX GARDES DE PRODUCTION SONT DES ET, PAS DES OU.** `uFondOn`
+  // et `uCropOn` valent ZÉRO drapeau baissé (relevé dans la page) : si l'un
+  // d'eux cessait de couper, la vue orbitale de production lirait un champ
+  // qu'elle n'a pas — et un `&&` changé en `||` ne se voit sur aucune capture
+  // du crop, où les deux valent 1.
+  for (const [uFondOn, uCropOn] of [[0, 1], [1, 0], [0, 0]]) {
+    const ech = -2116.3 / 22753.57142857143
+    assert.equal(surLeFondDuNuanceur(uFondOn, uCropOn, 3, 22753.57142857143, { x: 0, y: 0 }, -50, ech), false,
+      `uFondOn=${uFondOn} uCropOn=${uCropOn} : la condition doit être FAUSSE`)
+    assert.equal(fondDuNuanceur(uFondOn, uCropOn, 3, 22753.57142857143, { x: 0, y: 0 }, -50, ech), -50,
+      `uFondOn=${uFondOn} uCropOn=${uCropOn} : la hauteur du MNT doit passer intacte`)
+  }
+  // et le témoin : les deux à 1, la même entrée bascule bien
+  assert.equal(surLeFondDuNuanceur(1, 1, 3, 22753.57142857143, { x: 0, y: 0 }, -50, -2116.3 / 22753.57142857143), true)
+})
+
+test('⑩c la condition n’est écrite QU’UNE FOIS, et `hauteurFond` la lit', () => {
+  // ⚠️ « Deux écritures jumelles finiraient par diverger » (`terrain.js`). La
+  // condition a deux lecteurs depuis P12 : elle doit avoir UN seul auteur.
+  assert.equal((FRAG_GLOBE.match(/uFondOn > 0\.5 && uCropOn > 0\.5/g) || []).length, 1,
+    'la condition du fond marin est écrite deux fois dans le nuanceur')
+  const nu = FRAG_GLOBE.replace(/\s+/g, ' ')
+  assert.match(nu, /float hauteurFond\(vec2 qCrop, float h\) \{ if \(surLeFond\(qCrop, h\)\) \{/)
+  assert.match(nu, /bool fondMarin = surLeFond\(qCrop, h\);/)
+})
+
+test('⑩d ⛔ `fondMarin` EST RELEVÉ AVANT LE GRAIN — le grain change le SIGNE de h', () => {
+  // ⛔ `hauteurGrain` ajoute un bruit SIGNÉ (`(g1 − 0,5) × 2 + (g2 − 0,5) × 0,7`)
+  // multiplié par `uGrainForceM`. Une butte de terre à un mètre au-dessus de
+  // l'eau peut donc en ressortir NÉGATIVE — et le pas basculerait sur la loi du
+  // fond marin en pleine terre. Relever `fondMarin` après le grain est une
+  // mutation qui ne se voit sur AUCUNE capture sans grain (`uGrainForceM = 0`
+  // au cadrage de la notation) : on la tue par l'ordre.
+  const nu = FRAG_GLOBE.replace(/\s+/g, ' ')
+  const iFond = nu.indexOf('bool fondMarin = surLeFond(qCrop, h);')
+  const iHauteur = nu.indexOf('float h = hauteurFond(qCrop, decodeMetersAA(vUv));')
+  const iGrain = nu.indexOf('h = hauteurGrain(qCrop, h);')
+  assert.ok(iHauteur > 0 && iFond > iHauteur, '`fondMarin` doit être relevé APRÈS la composition de la hauteur')
+  assert.ok(iGrain > iFond, '`fondMarin` doit être relevé AVANT le grain')
+  // ⛔ **ET IL N'EST ÉCRIT QU'UNE FOIS — UNE SURVIVANTE L'A EXIGÉ.** La campagne
+  // a AJOUTÉ un second `fondMarin = surLeFond(qCrop, h)` après le grain, et le
+  // test n'a pas rougi : le premier était toujours là, et l'ordre tenait. Ce
+  // qu'il faut interdire n'est pas « une lecture après le grain », c'est
+  // « plus d'une lecture ».
+  assert.equal((nu.match(/fondMarin = surLeFond/g) || []).length, 1,
+    '`fondMarin` est affecté plusieurs fois : la dernière affectation gagne, et elle peut être après le grain')
+  assert.equal((nu.match(/\bfondMarin\b/g) || []).length, 2,
+    '`fondMarin` doit avoir exactement UN auteur et UN lecteur')
+  // et le grain PEUT bien retourner le signe : ce n'est pas une précaution
+  // théorique — on l'exécute sur la loi du dépôt
+  const g = (a, b) => a + 12 * ((b - 0.5) * 2 + (0.3 - 0.5) * 0.7)
+  assert.ok(g(1, 0) < 0, 'le grain doit pouvoir faire passer une hauteur positive sous zéro')
+})
+
+test('⑩e le PAS du gradient, EXÉCUTÉ : la mer prend le texel, la terre l’empreinte', () => {
+  // ⚡ **PAS UNE ASSERTION DE CHAÎNE : ON ÉVALUE LA LOI.** On extrait la ligne du
+  // nuanceur et on la fait tourner — c'est la seule façon de tuer une mutation
+  // qui échangerait les deux branches, ou qui retirerait le plancher du texel de
+  // l'une des deux.
+  const ligne = FRAG_GLOBE.match(/float pas = (.+);/)
+  assert.ok(ligne, 'la ligne du pas a disparu du nuanceur')
+  const js = ligne[1].replace(/\bmax\(/g, 'Math.max(')
+  // eslint-disable-next-line no-new-func
+  const pas = new Function('fondMarin', 'uTilePx', 'pasEmpreinte', `return ${js};`)
+  for (const uTilePx of [256, 512]) {
+    const texel = 1 / uTilePx
+    // ⛔ sous l'eau : le texel, quelle que soit l'empreinte
+    for (const e of [0, texel / 2, texel, 4 * texel, 40 * texel]) {
+      assert.equal(pas(true, uTilePx, e), texel, `mer, uTilePx=${uTilePx}, empreinte=${e}`)
+    }
+    // ⛔ sur terre : le PLUS GRAND des deux, jamais moins que le texel
+    assert.equal(pas(false, uTilePx, 0), texel, 'sans uMppFacteur, la terre retombe sur le texel')
+    assert.equal(pas(false, uTilePx, texel / 2), texel, 'le texel est un PLANCHER')
+    assert.equal(pas(false, uTilePx, 4 * texel), 4 * texel, 'l’empreinte l’emporte quand elle est plus grande')
+    // ⚡ et les deux branches DIFFÈRENT là où ça compte — sinon la loi serait morte
+    assert.ok(pas(true, uTilePx, 4 * texel) < pas(false, uTilePx, 4 * texel),
+      'les deux branches rendent le même pas : la bascule ne sert à rien')
+  }
+})
