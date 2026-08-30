bf03bfe tache P11 : une survivante a demasque une assertion de NOM, sous ma tache
bd03cc6 tache P11 : trois survivantes du second tour, dont une mutation NEUTRE demasquee
6d535be tache P11 : dix survivantes du premier tour, et chacune a trouve un vrai trou
6890c78 tache P11 : la paroi se posait sur la donnee, le GPU dessine le maillage
a2ad723 tache P11 : le relief du crop etait normalise sur un sous-sol de six kilometres

 package.json                  |   2 +-
 src/globe.js                  | 151 +++++++++--
 src/monde/echelle-continue.js |  25 +-
 src/monde/maillage-tuile.js   | 132 ++++++++++
 src/monde/rampe-crop.js       |  38 ++-
 test/crop-naturel.test.js     |  70 ++++-
 test/crop-parois.test.js      |   9 +-
 test/crop-rampe.test.js       | 128 ++++++++-
 test/echelle-continue.test.js |  43 ++-
 test/fond-crop.test.js        |  12 +-
 test/maillage-tuile.test.js   | 594 ++++++++++++++++++++++++++++++++++++++++++
 11 files changed, 1158 insertions(+), 46 deletions(-)

diff --git a/package.json b/package.json
index 22b48a6..22ca495 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js test/ecume-mer.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js test/maillage-tuile.test.js test/ecume-mer.test.js",
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
index ba5d2c2..c4e1108 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -91,20 +91,25 @@ import { FOV_DEG } from './monde/seuil-socle.js'
 // L'EXAGÉRATION PARTAGÉE — Tâche E. ⚠️ **UN ÉCRIVAIN, N LECTEURS, ET LE GLOBE
 // EST LE QUATORZIÈME** (`terrain.js` ×5, `ocean.js` ×2, `gpx.js` ×1,
 // `main.js` ×5). ⚠️ Ce module n'importe RIEN — c'est sa seule règle, et elle est
 // gardée par un test —, donc aucun cycle n'est ouvert ici.
 import { lireExageration } from './monde/exageration-continue.js'
 import { loiTextureMonde, GRAIN_PAR_PIXEL, METRES_PAR_DEGRE } from './monde/loi-texture-monde.js'
 // LE FOND DU CROP — Tâche J bis. Pur lui aussi (il n'importe que
 // `crop-sphere.js`, pur) : il ne rend que des nombres, et c'est ce fichier-ci
 // qui décide QUAND les lire. Son en-tête porte les mesures qui le fondent.
 import { altitudeMaillage, altitudeSonde, echantillonnerFond, cleFond } from './monde/fond-crop.js'
+// LE MAILLAGE D'UNE TUILE — Tâche P11. Pur lui aussi. ⚠️ **IL PORTE LA TABLE DES
+// SEGMENTS**, qui vivait ici sous le nom `gridFor` : elle a désormais DEUX
+// lecteurs (`_buildMesh` qui pose les sommets, `hauteurDessinee` qui les relit),
+// et une table recopiée diverge en silence.
+import { segmentsTuile, interpolerMaille } from './monde/maillage-tuile.js'
 // ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
 //
 // ⚠️ **CE N'EST PAS UNE COPIE DU SOCLE, C'EST LE MÊME TEXTE.** `terrain.js`
 // injecte `GLSL_NATUREL` dans SON fragment et ce fichier dans LE SIEN : il n'y a
 // qu'une seule écriture du peigné, de l'humidité, du pivot et du voile aérien.
 // `test/crop-naturel.test.js` interdit qu'une de ces formules soit réécrite ici.
 import { GLSL_NATUREL, NATUREL_MONDE } from './monde/naturel-crop.js'
 // ══════ LA COUCHE APPARENCE — Tâche P3 ══════════════════════════════
 // `FX_GLSL` était déjà partagé entre `terrain.js` et les vignettes du panneau ;
 // le crop en est le troisième lecteur. `GLSL_MELANGE` ferme une dette plus
@@ -705,30 +710,26 @@ const IMAGES_BLOQUEE = 600
 // ⚠️ ET LA QUARANTAINE EST TEMPORAIRE, JAMAIS DÉFINITIVE. Rendre une tuile en
 // erreur évinçable ouvre une boucle : évincée, elle est recréée `empty` au
 // parcours suivant, redemandée, échoue, et le réseau repart pour un tour. La
 // quarantaine ferme cette boucle — mais une quarantaine PERPÉTUELLE perdrait la
 // tuile pour toute la session sur une coupure réseau de trois secondes, et
 // `test/globe-reseau.test.js` tient ce contrat noir sur blanc : « la mémoire ne
 // garde aucun souvenir de l'échec qui l'en empêcherait ». Dix secondes, donc :
 // assez pour tuer la boucle, assez peu pour qu'un réseau revenu soit réessayé.
 const IMAGES_QUARANTAINE = 600
 
-// segments per patch edge — low zooms form the planet silhouette in the full
-// view, so they get denser grids: a z3 tile spans 45 degrees of longitude and
-// 24 segments there leaves visibly flat facets (and jagged exaggerated relief)
-// on the limb
-function gridFor(z) {
-  if (z <= 2) return 64
-  if (z <= 3) return 48
-  if (z <= 5) return 32
-  return 24
-}
+// ⚠️ **`gridFor` A DÉMÉNAGÉ DANS `src/monde/maillage-tuile.js` SOUS LE NOM
+// `segmentsTuile` — Tâche P11.** Elle a un SECOND lecteur depuis que la paroi du
+// crop suit la surface DESSINÉE et non la texture : `hauteurDessinee` doit
+// connaître la grille exacte sur laquelle `_buildMesh` a posé ses sommets. La
+// recopier là-bas aurait fait « deux écritures jumelles qui divergent », et la
+// paroi se serait posée sur une grille que le maillage n'a pas.
 
 // ---------------------------------------------------------------- shader
 
 // ══════════ LES DEUX CONVERSIONS DE LA NORMALE FINE — Tâche P10 ════════════
 //
 // ⚠️ **ELLES SONT INJECTÉES DANS LE TEXTE GLSL, PAS RECOPIÉES À LA MAIN**, et
 // elles DÉRIVENT toutes les deux de `R_GLOBE` et `EARTH_RADIUS_M` — les deux
 // constantes de `geo.js` sur lesquelles `_buildMesh` pose déjà ses sommets
 // (`dispScale = (R_GLOBE / EARTH_RADIUS_M) * exagération`). Un chiffre écrit en
 // dur ici serait la CINQUIÈME faute de monnaie de ce chantier.
@@ -869,20 +870,38 @@ uniform float uLandMax;
 // LA MECANIQUE DE « les alentours la suivent » : ils vivent dans this.uniforms,
 // que _materialFor etale dans CHAQUE materiau de tuile. Une tuile a l'autre bout
 // de la planete peint donc avec l'echelle du crop. Il n'y a pas de seconde
 // rampe a raccorder, donc pas de couture a dessiner : la couture ne peut pas
 // naitre.
 //
 // ⚠️ ET LEURS VALEURS PAR DEFAUT SONT L'ECHELLE MONDIALE (RAMPE_MONDE) : sans
 // poserRampe, le globe peint au bit pres comme avant la Tache D. Meme garde que
 // uCropOn (Tache A) et uHabOn (Tache C).
 uniform float uLandBas; // l ancre BASSE de la rampe terre, en metres
+// ══════════ L'ANCRE BASSE DU RELIEF — Tache P11 ═══════════════════════════
+//
+// ⛔ ELLE N'EST PAS -uOceanDepth, ET LA NOTATION 03 A CHIFFRE CE QUE CA COUTE.
+// L'ecriture d'avant justifiait l'egalite par « le minimum du relief du crop EST
+// -uOceanDepth ». Elle ne tient que si le crop A DE LA MER : sans un seul point
+// sous le niveau de la mer, echelleRampe rend le PLANCHER DE DIVISION,
+// echelle-continue refuse (a raison) d'ancrer un budget de profondeur muet, et
+// l'uniforme garde la valeur MONDIALE de 6 000 m. Releve le 2026-08-23, La
+// Reunion cadrage interieur, page vivante, socle rallume dans la MEME page
+// (.banc/P11/) : uOceanDepth = 6 000 pour un crop dont le point le plus bas est
+// a 107 m. Le pivot de rampe montait donc a 0,685 au lieu de 0,41 et la rampe
+// n'atteignait JAMAIS sa moitie basse — l'olive et l'ocre du socle, x3,51 et
+// x2,82, que le crop remplacait par du rose.
+//
+// ⚠️ SA VALEUR NEUTRE EST -RAMPE_MONDE.profondeur, donc la production rend
+// EXACTEMENT ce qu'elle rendait : (h - (-6000)) / (5600 - (-6000)) EST
+// (h + 6000) / (5600 + 6000), au bit pres. Meme garde que uCropOn et uHabOn.
+uniform float uReliefBas; // le minimum du RELIEF du crop, en metres (signe)
 // ══════════ LA RAMPE NAUTIQUE — Tache F ═══════════════════════════════════
 //
 // ⚠️ C'EST LA PIECE QUE LA TACHE D A NOMMEE SANS LA PRENDRE. Son bilan ecrit :
 // le globe peint la mer avec le BAS de sa propre table (uRamp dans [0 ; 0,35])
 // pendant que le socle emploie « une rampe nautique a TROIS couleurs
 // (uOceanShallow/Mid/Deep) » — et il conclut : « la reconcilier suppose de
 // toucher a la mer, c'est-a-dire la Tache F ».
 //
 // ⚠️ ET C'EST ELLE QU'ON VOIT. Regarde cote a cote (.banc/vues/W-socle-bloc.jpg
 // contre V-crop-mer-bloc.jpg) : le socle rend une mer NOIRE au large avec une
@@ -1537,40 +1556,40 @@ void main() {
   // vivantes), natRampT rendait ZERO pour TOUT ce qui est sous 1 163 m — un aplat
   // olive sur toute l'ile — la ou le socle etale deja 0 a 0,78 sur la meme
   // tranche. La limite des arbres tombait a 2 378 m au lieu de 2 247 m.
   //
   // ➡️ LA CONVERSION EST EXACTE, ET ELLE NE DEMANDE AUCUNE MESURE NEUVE : le
   // minimum du relief du crop EST -uOceanDepth (rampe-crop.js : profondeur =
   // -min(0, minM)) et son maximum uLandMax. Releve le meme jour : -2 106,8 et
   // 2 584,4 contre -2 116 et 2 626 cote socle, soit un ecart de 0,0029 sur le
   // hNorm du niveau de la mer. C'est la MEME grandeur, mesuree par deux
   // balayages de finesse differente.
-  float hNormRelief = clamp((h + uOceanDepth) / max(uLandMax + uOceanDepth, uPlancherRampeM), 0.0, 1.0);
+  float hNormRelief = clamp((h - uReliefBas) / max(uLandMax - uReliefBas, uPlancherRampeM), 0.0, 1.0);
 
   vec4 anl = vec4(0.5);
   if (uAnalysisOn > 0.5) {
     // ⛔ LA BORNE N'EST PAS DECORATIVE, ET C'EST LE MEME PIEGE QUE uFondChamp.
     // La texture d'analyse est cuite pour le CROP ; en ClampToEdge, sa derniere
     // ligne se prolongerait sur toute la planete estompee et peignerait les
     // Andes avec le peigne de La Reunion, sans qu'aucune erreur ne soit levee.
     // On fond donc vers le NEUTRE (0,5) hors du crop, ce qui est exactement
     // « pas d'analyse ici » — et sans branche dependante de la donnee, dont les
     // derivees de mipmap seraient indefinies.
     float dansCrop = step(max(abs(qCrop.x), abs(qCrop.y)), 1.0);
     anl = mix(vec4(0.5), texture2D(uAnalysis, qCrop * 0.5 + 0.5), dansCrop);
   }
   if (uRampCropOn > 0.5 && !sousEau) {
     // ⚠️ hNormRelief PARTOUT DANS CE BLOC, ET JAMAIS hNorm : uHeightPivot,
     // uTreeLine et uHazeAlt sont des reglages POSES PAR L'UTILISATEUR dans
     // l'echelle du socle, et l'echelle du socle porte le fond marin. Voir la
     // demonstration chiffree juste au-dessus.
-    float pivot = max(uHeightPivot, natPlancherPivot(uOceanDepth / max(uLandMax + uOceanDepth, uPlancherRampeM)));
+    float pivot = max(uHeightPivot, natPlancherPivot((0.0 - uReliefBas) / max(uLandMax - uReliefBas, uPlancherRampeM)));
     float rampT = natRampT(hNormRelief, pivot, uHeightContrast);
     float wetY = natHumiditeY(anl.b, anl.a, hNormRelief, uWetK, uExpoK, uHemi, uTreeLine);
     col = texture2D(uRampCrop, vec2(rampT, wetY)).rgb;
   }
 
   // ══════ LE PEIGNE DES CRETES — LA DEMANDE D'ADRIEN, ET RIEN D'AUTRE ════════
   //
   // « Plus aucune texture sur la terre. » C'est CE bloc qui manquait. Le socle le
   // pose depuis terrain.js ; il vit desormais dans naturel-crop.js et les deux
   // nuanceurs l'appellent. uTexShade vaut 1 dans le gabarit d'ouverture.
@@ -1654,21 +1673,21 @@ void main() {
   vec3 nMonde = normalize(vNormalW);
   // ══════ LA NORMALE PAR FRAGMENT — Tache P9 ═══════════════════════════════
   //
   // ⛔ CE QUI MANQUAIT N'ETAIT PAS DU DETAIL DE PEINTURE, C'ETAIT DE L'OMBRAGE.
   // Mesure, cadrage interieur, masques apparies a -0,155 % : lumiere coupee des
   // deux cotes, le crop rend 10,250 d'energie de detail contre 8,723 au socle —
   // sa COULEUR est deja PLUS riche. Allumes, il rend 10,972 contre 16,086 : la
   // lumiere fabrique 45,8 % du modele du socle et 6,6 % du sien.
   //
   // ⚠️ ET LA CAUSE EST ARITHMETIQUE, PAS ESTHETIQUE : vNormalW vient de
-  // _buildMesh, qui pose gridFor(z) = 24 quads par tuile — 5 625 sommets sur un
+  // _buildMesh, qui pose segmentsTuile(z) = 24 quads par tuile — 5 625 sommets sur un
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
@@ -2464,20 +2483,25 @@ export class Globe {
       // aurait fait une seconde copie, et une constante dupliquée diverge en
       // silence (§1 de `/threejs-optimisation`, question 2).
       //
       // ⚠️ **ET CES QUATRE-LÀ SONT PARTAGÉS**, comme les cinq du crop et les
       // quatorze de l'habillage : ils vivent dans `this.uniforms`, que
       // `_materialFor` étale dans chaque matériau. C'est LA mécanique de « les
       // alentours la suivent » — il n'y a qu'une rampe, donc pas de couture.
       uOceanDepth: { value: RAMPE_MONDE.profondeur },
       uLandMax: { value: RAMPE_MONDE.terreHaut },
       uLandBas: { value: RAMPE_MONDE.terreBas },
+      // ⚠️ **DÉRIVÉ DE `RAMPE_MONDE`, JAMAIS ÉCRIT EN DUR** — Tâche P11. C'est
+      // la même discipline que les quatre du dessus : « une constante dupliquée
+      // diverge en silence ». `terreBas − creux` vaut `−6 000`, c'est-à-dire
+      // `−profondeur`, c'est-à-dire l'ancre que le nuanceur portait avant.
+      uReliefBas: { value: RAMPE_MONDE.terreBas - RAMPE_MONDE.creux },
       uPlancherRampeM: { value: RAMPE_MONDE.plancherM },
       uRamp: { value: null },
       // LA RAMPE NAUTIQUE — Tâche F. ⚠️ `uMerRampeOn: 0` : sans `poserMer`, RIEN
       // NE CHANGE — même garde et même raison que `uCropOn` et `uHabOn`. Les
       // trois couleurs sont celles de `terrain.js:376-378`, au caractère près.
       uMerRampeOn: { value: 0 },
       uMerFondBudgetM: { value: RAMPE_MONDE.profondeur },
       // LE ZÉRO DE LA MER — Tâche K bis. ⚠️ **`uMerZeroSousEau: 0` : sans
       // `poserRampe({ zeroSousEau: true })`, RIEN NE CHANGE** — même garde et
       // même raison que `uCropOn`, `uHabOn`, `uMerRampeOn` et `uMppFacteur`.
@@ -3668,20 +3692,27 @@ export class Globe {
    *
    * ⚠️ **`fondBudget` EST BORNÉ À 1 m COMME AVANT** (`Math.max(profMaxM, 1)`,
    * ligne d'origine de `poserMer`) : ce n'est pas un plancher neuf, c'est celui
    * du dépôt, déplacé ici pour qu'il n'y en ait qu'un.
    */
   _poserUniformesRampe(e) {
     const u = this.uniforms
     u.uLandBas.value = e.terreBas
     u.uLandMax.value = e.terreHaut
     u.uOceanDepth.value = e.profondeur
+    // ⚠️ **`e.creux` SE LIT SANS GARDE, ET C'EST UN CONTRAT, PAS UN OUBLI** —
+    // Tâche P11. `echelleRampe` et `majEchelle` le rendent TOUS LES DEUX, sur
+    // toutes leurs branches (`test/crop-rampe.test.js` ①j). Un repli ici serait
+    // un repli qu'aucun appelant réel ne peut déclencher — la faute que la Tâche
+    // D a retirée d'`echelleRampe`, et il masquerait un `NaN` dans un uniforme,
+    // c'est-à-dire une comparaison FAUSSE dans le nuanceur.
+    u.uReliefBas.value = e.terreBas - e.creux
     u.uPlancherRampeM.value = e.plancherM
     // ⚠️ **LE BUDGET DU FOND NE S'ÉCRIT QUE SI LA RAMPE NAUTIQUE EST ALLUMÉE.**
     // Éteinte, `uMerFondBudgetM` ne peint rien (le nuanceur le garde derrière
     // `uMerRampeOn > 0.5`) et `retirerMer` est le seul à devoir le rendre à
     // `RAMPE_MONDE`. L'écrire ici de toute façon ferait deux écrivains pour un
     // uniforme éteint — le genre de code mort que ce chantier a trouvé quatre
     // fois.
     if (u.uMerRampeOn.value > 0.5 && Number.isFinite(e.fondBudget)) {
       u.uMerFondBudgetM.value = Math.max(e.fondBudget, 1)
     }
@@ -3710,20 +3741,21 @@ export class Globe {
 
   /** L'échelle que le nuanceur porte en ce moment — pour les sondes et les bancs. */
   echelleRampePosee() {
     return lireEchelle(this._echelleContinue)
   }
 
   /** Rend la rampe MONDIALE — le globe reprend ses couleurs d'avant, au bit près. */
   retirerRampe() {
     const u = this.uniforms
     u.uLandBas.value = RAMPE_MONDE.terreBas
+    u.uReliefBas.value = RAMPE_MONDE.terreBas - RAMPE_MONDE.creux
     u.uLandMax.value = RAMPE_MONDE.terreHaut
     u.uOceanDepth.value = RAMPE_MONDE.profondeur
     u.uPlancherRampeM.value = RAMPE_MONDE.plancherM
     // ⚠️ **LE ZÉRO DE LA MER S'ÉTEINT AVEC LA RAMPE, ET C'EST LE DÉFAUT C-3 DE
     // LA TÂCHE C APPLIQUÉ D'AVANCE** : là-bas `retirerHabillage` ne rendait que
     // quatre uniformes sur seize et la planète entière gardait l'intervalle du
     // crop. Ici l'uniforme est PARTAGÉ par toutes les tuiles.
     u.uMerZeroSousEau.value = 0
     // ⚠️ **LES ANCRES TOMBENT AUSSI.** Sans cela, `majEchelleRampe` les
     // reposerait à l'image suivante et `retirerRampe` ne retirerait rien — une
@@ -4591,20 +4623,88 @@ export class Globe {
    * que le flux (`demanderEmprise`) pose précisément sur l'emprise du socle.
    * Sans flux, cette méthode rend `null` et les parois le disent (`couverture`).
    *
    * @param {number} lat
    * @param {number} lon
    * @param {Array} [candidates] la liste pré-filtrée, pour ne pas reparcourir
    *   `this.tiles` à chacun des mille points de l'anneau
    * @returns {number|null}
    */
   hauteurSurface(lat, lon, candidates = null) {
+    const best = this._tuileLaPlusFine(lat, lon, candidates)
+    // ⚠️ **`null`, JAMAIS `0`** : zéro est le NIVEAU DE LA MER, et le confondre
+    // avec « je ne sais pas » creuse une encoche dans la paroi (§7 de
+    // `parois-crop.js`). C'est l'appelant qui décide, pas cette méthode.
+    // ⚠️ **ET LE FOND DU CROP PASSE PAR ICI AUSSI — Tâche J bis.** Sans fond
+    // posé, `altitudeSonde` rend la valeur BRUTE — le dépôt au bit près,
+    // négatifs du terrarium compris.
+    const brut = best ? sampleHeights(best.t.heights, best.tx, best.ty, best.t.size) : null
+    const fond = this._fondCrop ?? null
+    return altitudeSonde(brut, fond ? echantillonnerFond(fond, lat, lon) : null)
+  }
+
+  /**
+   * LA HAUTEUR QUE LE GPU DESSINE — Tâche P11.
+   *
+   * ⛔ **CE N'EST PAS `hauteurSurface`, ET LA DIFFÉRENCE EST LE MANQUE N° 2 DE LA
+   * NOTATION 03.** `hauteurSurface` rend la DONNÉE : la texture terrarium,
+   * interpolée bilinéairement à ses 256 (ou 512) texels par tuile. Le GPU, lui,
+   * dessine le MAILLAGE : `segmentsTuile(z)` quads, soit **vingt-cinq sommets
+   * par côté à z12**. La paroi du crop se posait sur la première et se raccordait
+   * à la seconde — d'où, mesuré sur les 1 020 points de l'anneau dans la page
+   * vivante (`.banc/P11/M1-bord-avant.json`), un écart de **18,94 m en moyenne
+   * absolue**, **±(54 ; 47) m aux percentiles 5 et 95**, **−270,6 / +202,4 m aux
+   * extrêmes**, soit **|0,65| px à l'écran en moyenne et 9,8 px au pire**. Là où
+   * l'anneau passe SOUS le maillage, la surface pend par-dessus l'arête haute :
+   * c'est le drapé. Là où il passe AU-DESSUS, on voit du mur là où le socle
+   * montre du terrain.
+   *
+   * ⚠️ **ELLE REPRODUIT LA LOI DE NŒUD DE `_buildMesh`, PAS UNE LOI VOISINE** :
+   * `altitudeMaillage(sampleHeights(...), echantillonnerFond(...))`, aux MÊMES
+   * `(u, v)` et avec le MÊME `lat/lon` par nœud. `altitudeSonde` y écrêterait
+   * autrement la mer (`test/fond-crop.test.js` porte l'écart), et une paroi qui
+   * suivrait `altitudeSonde` repasserait sous sa propre surface.
+   *
+   * ⚠️ **`null` TRAVERSE, COMME POUR `hauteurSurface`** : c'est ce qui garde le
+   * refus de couverture des parois (§7 de `parois-crop.js`) exactement aussi
+   * mordant qu'avant.
+   */
+  hauteurDessinee(lat, lon, candidates = null) {
+    const best = this._tuileLaPlusFine(lat, lon, candidates)
+    if (!best) return null
+    const t = best.t
+    const G = segmentsTuile(t.z)
+    const fond = this._fondCrop ?? null
+    return interpolerMaille(best.tx, best.ty, G, (i, j) => {
+      const u = i / G
+      const v = j / G
+      // ⚠️ **LE `lat/lon` DU NŒUD, PAS CELUI DU POINT DEMANDÉ** : `_buildMesh`
+      // lit le champ du fond à la position de CHAQUE sommet. Prendre le lat/lon
+      // du point rendrait un fond constant sur toute la cellule — une seconde
+      // loi, et elle divergerait de la première dès que le fond a du relief.
+      const p = tileToLatLon(t.x + u, t.y + v, t.z)
+      return altitudeMaillage(
+        sampleHeights(t.heights, u, v, t.size),
+        fond ? echantillonnerFond(fond, p.lat, p.lon) : null,
+      )
+    })
+  }
+
+  /**
+   * La tuile la plus FINE qui couvre un point — **une seule écriture**.
+   *
+   * ⚠️ **ELLE ÉTAIT DANS `hauteurSurface`, ET LA TÂCHE P11 L'EN SORT PARCE QU'UN
+   * SECOND LECTEUR EST APPARU.** Le repli d'antiméridien au modulo (ci-dessous)
+   * a coûté un banc entier à la Tâche B ; le recopier dans `hauteurDessinee`
+   * aurait fait deux replis à garder d'accord.
+   */
+  _tuileLaPlusFine(lat, lon, candidates = null) {
     const liste = candidates || this.tuilesAvecHauteurs()
     const mx = mercX(lon)
     const my = mercY(lat)
     let best = null
     for (const t of liste) {
       const n = 2 ** t.z
       // ⚠️ **LE REPLI D'ANTIMÉRIDIEN SE FAIT AU MODULO, PAS AU `round`, ET LA
       // DIFFÉRENCE EST MESURÉE** (`.banc/repli-B.mjs`, huit cas). Le mercator x
       // est de période 1, donc de période `n` en coordonnées de tuile. La forme
       // `tx -= round(tx / n) * n` replie dans `(−n/2, n/2]`, ce qui est FAUX dès
@@ -4612,31 +4712,21 @@ export class Globe {
       // de mx = 0,5, c'est-à-dire la moitié de la planète. `ROOT_Z = 2` fait qu'on
       // ne rencontre pas ce cas aujourd'hui — raison de plus pour le corriger
       // avant qu'il ne devienne un défaut vivant. Le modulo replie dans `[0, n)`,
       // l'intervalle où la question « suis-je dans cette tuile ? » se pose, et il
       // est juste pour tout `n` **et pour un `t.x` hors bornes**.
       const tx = (((mx * n - t.x) % n) + n) % n
       const ty = my * n - t.y
       if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue
       if (!best || t.z > best.t.z) best = { t, tx, ty }
     }
-    // ⚠️ **`null`, JAMAIS `0`** : zéro est le NIVEAU DE LA MER, et le confondre
-    // avec « je ne sais pas » creuse une encoche dans la paroi (§7 de
-    // `parois-crop.js`). C'est l'appelant qui décide, pas cette méthode.
-    // ⚠️ **ET LE FOND DU CROP PASSE PAR ICI AUSSI — Tâche J bis.** Les parois et
-    // la rampe se posent sur CETTE sonde ; si le maillage descendait au fond
-    // marin sans elles, le bloc aurait un flanc qui commence deux kilomètres
-    // au-dessus de sa propre surface. Sans fond posé, `altitudeSonde` rend la
-    // valeur BRUTE — le dépôt au bit près, négatifs du terrarium compris.
-    const brut = best ? sampleHeights(best.t.heights, best.tx, best.ty, best.t.size) : null
-    const fond = this._fondCrop ?? null
-    return altitudeSonde(brut, fond ? echantillonnerFond(fond, lat, lon) : null)
+    return best
   }
 
   /** Les tuiles dont les hauteurs sont encore là, du plus fin au plus grossier. */
   tuilesAvecHauteurs() {
     const out = []
     for (const t of this.tiles.values()) if (t.heights) out.push(t)
     out.sort((a, b) => b.z - a.z)
     return out
   }
 
@@ -4673,21 +4763,28 @@ export class Globe {
       couvertureMin,
       repere: this._crop,
       forme: {
         coin: this.uniforms.uCropCoin.value,
         expo: this.uniforms.uCropCoinN.value,
       },
       // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE, ET C'EST VOULU** : une
       // valeur écrite ici en serait une seconde, et deux défauts jumeaux
       // divergent (le `uContourInterval` de la Tâche C, réparé au tour 1).
       fractionProfondeur,
-      hauteur: (lat, lon) => this.hauteurSurface(lat, lon, liste),
+      // ⛔ **`hauteurDessinee`, PAS `hauteurSurface` — Tâche P11, ET C'EST LE
+      // MANQUE N° 2 DU NOTEUR.** L'anneau haut doit se poser sur la surface que
+      // le GPU DESSINE (le maillage de la tuile), pas sur la donnée qu'il n'a
+      // pas (la texture, dix fois plus fine). Le §0 de `monde/maillage-tuile.js`
+      // porte la mesure : 18,94 m d'écart moyen absolu le long de l'anneau, ±10
+      // pixels à l'écran, dans les DEUX SENS — la paroi dépassait la surface
+      // ici, la surface pendait par-dessus l'arête là.
+      hauteur: (lat, lon) => this.hauteurDessinee(lat, lon, liste),
       rayon: R_GLOBE,
       echelle: (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration,
       profondeur,
       baseYFloor,
       // ⚠️ **LE PLANCHER SUIT LA SURFACE — Tâche J bis, ET SANS LUI LE BLOC EST
       // FAUX.** Le §4 de `parois-crop.js` écrit pourquoi il valait zéro : « le
       // globe pose ses sommets à `Math.max(sampleHeights(...), 0)`, une paroi
       // qui suivrait la bathymétrie brute passerait SOUS la surface dessinée ».
       // C'est exactement l'inverse depuis qu'un fond est posé : c'est un
       // plancher à zéro qui ferait passer la paroi AU-DESSUS de sa propre
@@ -5428,21 +5525,21 @@ export class Globe {
   // la représentation s'épuisait exactement là où la donnée s'arrête (deck.gl
   // #7527 décrit la même casse à z17). En relatif, la magnitude tombe à la
   // taille d'une TUILE — 0,3 unité à z11 — et le pas à ~1 mm.
   //
   // ⚠️ Écrire un double dans un Float32Array l'arrondit sur-le-champ : il faut
   // donc soustraire l'origine AVANT l'écriture. D'où `positions` en DOUBLES,
   // et pas de `pos2.set(positions)` — un tampon absolu recopié n'aurait rien
   // gagné. C'est aussi pour ça que `positions` reste ABSOLU : la jupe s'y
   // appuie pour descendre vers le centre de la PLANÈTE, pas de la tuile.
   _buildMesh(t) {
-    const G = gridFor(t.z)
+    const G = segmentsTuile(t.z)
     const nV = (G + 1) * (G + 1)
     const positions = new Float64Array(nV * 3) // absolues, en doubles : voir ci-dessus
     const normals = new Float32Array(nV * 3)
     const uvs = new Float32Array(nV * 2)
     const latlons = new Float32Array(nV * 2)
     const dispScale = (R_GLOBE / EARTH_RADIUS_M) * this.exaggeration
     const v3 = new THREE.Vector3()
 
     // every vertex is projected EXACTLY onto the sphere (+ displaced along the
     // radius) — never interpolated across a flat quad
@@ -5502,21 +5599,21 @@ export class Globe {
       const pS = new THREE.Vector3()
       // ⚠️ LA FENÊTRE DOIT ÊTRE LA MÊME POUR LA POSITION ET POUR LA HAUTEUR
       // (plan « globe continu », Tâche 4 sexies, Étape 3). `posAt` mélangeait
       // deux conventions au BORD de la tuile : `tileToLatLon(t.x + u, …)` suit
       // `u` hors de [0,1] et rend la position du voisin, tandis que
       // `sampleHeights` l'ÉCRÊTE (`clamp(u × size − 0,5 ; 0 ; size − 1)`) et rend
       // la hauteur du pixel de bord. La différence centrée portait donc un
       // dénivelé lu sur une fenêtre deux fois trop courte.
       //
       // ⚠️ ET LE CHIFFRE SE DÉRIVE DU DÉPÔT, il n'a pas eu besoin d'un banc :
-      // `G = gridFor(z) = 24`, tuile de 256 px, donc la fenêtre vaut
+      // `G = segmentsTuile(z) = 24`, tuile de 256 px, donc la fenêtre vaut
       // `x(u+ε) − x(u−ε)` = **21,333 px au centre contre 10,167 px au bord**,
       // soit **47,7 %** — 407 m de pente lus sur 853 m de pente vraie. D'où un
       // liseré d'éclairage : chaque tuile s'aplatit sur son pourtour.
       //
       // Le correctif garde la fenêtre DANS la tuile pour les deux grandeurs :
       // au centre, la différence reste centrée et rien ne change ; au bord, elle
       // devient unilatérale, mais position et hauteur parcourent enfin le même
       // terrain. ⚠️ **On n'extrapole pas au-delà du bord** : la donnée du voisin
       // n'est pas là, et l'inventer ferait un relief qui n'existe nulle part.
       const dansLaTuile = (x) => Math.min(Math.max(x, 0), 1)
diff --git a/src/monde/echelle-continue.js b/src/monde/echelle-continue.js
index 05e3b33..79ff602 100644
--- a/src/monde/echelle-continue.js
+++ b/src/monde/echelle-continue.js
@@ -135,21 +135,29 @@ import { pentesMonotones } from './exageration-continue.js'
  * Les quatre nombres qui décident de la couleur d'une hauteur.
  *
  * ⚠️ **`fondBudget` EST DE LA PARTIE, ET LE CONFONDRE AVEC `profondeur` SE VOIT.**
  * `globe.js` le dit déjà (§ « LE BUDGET DU FOND N'EST PAS uOceanDepth ») :
  * `uOceanDepth` indexe la table `uRamp`, `uMerFondBudgetM` indexe la rampe
  * NAUTIQUE à trois couleurs — et c'est la NAUTIQUE qui peint le fond dès que
  * `poserMer` a pris (`uMerRampeOn = 1`). Le relevé du §0 mesure les deux, et le
  * `dMer01` de la seconde bouge de **0,248** sur la descente : la laisser hors de
  * la courbe aurait laissé l'essentiel de la couleur de mer dehors.
  */
-export const CHAMPS = Object.freeze(['terreBas', 'terreHaut', 'profondeur', 'fondBudget'])
+/**
+ * ⚠️ **`creux` EST LE CINQUIÈME, ET IL N'EST PAS UNE ÉCHELLE DE MER — Tâche P11.**
+ * Les quatre autres pilotent la COULEUR D'UNE HAUTEUR ; celui-ci porte l'ANCRE
+ * BASSE DU RELIEF (`terreBas − creux` EST `minM`, voir `rampe-crop.js`), c'est-à-
+ * dire le jumeau d'`uHeightRange.x` du socle. Il entre dans la courbe pour la
+ * même raison que les autres — sans quoi il sauterait d'un cran à l'autre
+ * pendant que ses voisins glissent, et la rampe se contredirait elle-même.
+ */
+export const CHAMPS = Object.freeze(['terreBas', 'terreHaut', 'profondeur', 'creux', 'fondBudget'])
 
 // ══════════ ② LE CRAN ══════════════════════════════════════════════════════
 
 /**
  * Le cran RÉEL d'une altitude — `log2(mètres)`. Non arrondi : c'est l'abscisse
  * de la courbe. `NaN` sur une altitude inutilisable, et l'appelant garde alors
  * ce qu'il avait (même contrat que `socleVisible`).
  */
 export function cranReel(altitudeM) {
   const a = Number(altitudeM)
@@ -175,20 +183,33 @@ export function champsUtiles(e) {
   const p = Number.isFinite(e?.plancherM) && e.plancherM > 0 ? e.plancherM : 0
   const fini = (v) => Number.isFinite(v)
   // ⚠️ **LE PLANCHER EST LA FRONTIÈRE, ET IL EST STRICT.** `echelleRampe` rend
   // EXACTEMENT `plancherM` quand elle n'a rien vu ; une mesure qui vaut le
   // plancher est donc muette, pas plate.
   const terre = fini(e?.terreBas) && fini(e?.terreHaut) && e.terreHaut > e.terreBas + p
   return {
     terreBas: terre,
     terreHaut: terre,
     profondeur: fini(e?.profondeur) && e.profondeur > p,
+    // ⛔ **`creux` NE PASSE PAS PAR LE TEST DU PLANCHER, ET C'EST TOUT LE POINT
+    // DE LA TÂCHE P11.** Le plancher distingue « la mer est plate » de « je ne
+    // sais pas à quelle profondeur elle descend » — une distinction qui n'a de
+    // sens que pour un BUDGET. `creux = 0` veut dire « aucun point de ce crop ne
+    // descend sous sa terre la plus basse », et c'est une mesure prise sur les
+    // mêmes `pas²` points que `terreBas`. Le rendre muet aurait laissé l'ancre
+    // basse du relief au défaut MONDIAL (−6 000 m) sur tout crop intérieur.
+    //
+    // ⚠️ **IL SUIT LA TERRE, ET LA RAISON EST ARITHMÉTIQUE** : l'ancre basse est
+    // `terreBas − creux`. Ancrer l'un sans l'autre ferait une soustraction entre
+    // une mesure et un défaut mondial — un désaccord de monnaie, la faute que ce
+    // chantier a payée quatre fois.
+    creux: terre && fini(e?.creux),
     fondBudget: fini(e?.fondBudget) && e.fondBudget > p,
   }
 }
 
 // ══════════ ④ LE PARTAGE — UN ÉCRIVAIN, N LECTEURS ═════════════════════════
 
 /**
  * ⚠️ **LA RAMPE, LA MER ET LE FOND DOIVENT LIRE LA MÊME ÉCHELLE AU MÊME
  * INSTANT**, exactement comme l'exagération de la Tâche E. C'est la famille de
  * défauts déjà payée trois fois ici : une valeur écrite d'un côté, jamais
@@ -199,20 +220,21 @@ export function champsUtiles(e) {
  *   l'échelle de repli — `RAMPE_MONDE`. ⚠️ **PASSÉE, PAS RECOPIÉE** : elle est
  *   nommée une seule fois dans ce dépôt (`rampe-crop.js`), et ce module n'a pas
  *   à en faire une seconde copie.
  */
 export function creerEchelleContinue(monde) {
   const m = monde || {}
   const repli = {
     terreBas: Number.isFinite(m.terreBas) ? m.terreBas : 0,
     terreHaut: Number.isFinite(m.terreHaut) ? m.terreHaut : 0,
     profondeur: Number.isFinite(m.profondeur) ? m.profondeur : 0,
+    creux: Number.isFinite(m.creux) ? m.creux : 0,
     fondBudget: Number.isFinite(m.fondBudget) ? m.fondBudget : (Number.isFinite(m.profondeur) ? m.profondeur : 0),
     plancherM: Number.isFinite(m.plancherM) ? m.plancherM : 0,
   }
   return {
     monde: repli,
     /** `Map<cranEntier, {champ: valeur}>` — les mesures retenues. */
     ancres: new Map(),
     /** Le plancher de division de la DERNIÈRE mesure ancrée. */
     plancherM: repli.plancherM,
     /** La valeur courante — ce que les lecteurs prennent. */
@@ -328,20 +350,21 @@ export function valeurChamp(partage, champ, cranX) {
  * s'inverse. Le nuanceur, lui, borne déjà par `max(…, uPlancherRampeM)` ; on
  * borne ici aussi pour que la loi JS et le nuanceur disent la même chose.
  */
 export function majEchelle(partage, altitudeM) {
   const x = cranReel(altitudeM)
   if (!Number.isFinite(x)) return partage.valeur
   const v = {
     terreBas: valeurChamp(partage, 'terreBas', x),
     terreHaut: valeurChamp(partage, 'terreHaut', x),
     profondeur: valeurChamp(partage, 'profondeur', x),
+    creux: valeurChamp(partage, 'creux', x),
     fondBudget: valeurChamp(partage, 'fondBudget', x),
     plancherM: partage.plancherM,
   }
   const p = v.plancherM > 0 ? v.plancherM : 0
   v.terreHaut = Math.max(v.terreHaut, v.terreBas + p)
   partage.valeur = v
   partage.altitudeM = Number(altitudeM)
   partage.cran = x
   return v
 }
diff --git a/src/monde/maillage-tuile.js b/src/monde/maillage-tuile.js
new file mode 100644
index 0000000..b7f8216
--- /dev/null
+++ b/src/monde/maillage-tuile.js
@@ -0,0 +1,132 @@
+// LE MAILLAGE D'UNE TUILE — Tâche P11 du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// Module PUR : ni DOM, ni three.js, ni état. Tout se vérifie sous node
+// (`test/maillage-tuile.test.js`).
+//
+// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
+//
+// > **L'agent noteur, notation-03 §6.2 :** « AU CADRAGE INTÉRIEUR, C'EST LE
+// > TERRAIN QUI DRAPE LA PAROI : 54 379 px de tuiles dans la bande verticale du
+// > mur, contre 2 722 au socle — ×20. On le voit en une seconde : une jupe brune
+// > continue pend par-dessus l'arête ouest et sud. »
+//
+// ⚠️ **CE N'EST PAS LA JUPE DES TUILES, ET C'EST MESURÉ.** La Tâche P7 les avait
+// déjà divisées par 2 186 ; le banc de P11 (`.banc/P11/d3-paroi.js`) les ÉTEINT
+// en retirant leurs triangles du tampon d'indices, dans la page vivante, avec
+// aller-retour à **0 canal** : `dansLaBande` passe de **54 430 à 54 356**, soit
+// **0,14 %**. La jupe est hors de cause.
+//
+// ⛔ **CE QUI RESTE EST UN DÉSACCORD ENTRE DEUX SURFACES QUI DEVRAIENT ÊTRE LA
+// MÊME.** La paroi du crop pose son anneau haut sur `globe.hauteurSurface`,
+// c'est-à-dire sur la TEXTURE de hauteur, interpolée bilinéairement à sa pleine
+// résolution (256 ou 512 texels par tuile). Le GPU, lui, dessine le MAILLAGE de
+// la tuile : `segmentsTuile(z)` quads, soit **24 × 24 à z12** — vingt-cinq
+// sommets là où la donnée en a deux cent cinquante-six. Les deux ne peuvent pas
+// coïncider, et l'écart se lit dans les DEUX SENS :
+//
+//   · l'anneau AU-DESSUS du maillage → la paroi dépasse la surface qu'elle
+//     porte, et on voit du mur là où le socle montre du terrain ;
+//   · l'anneau AU-DESSOUS → la surface pend par-dessus l'arête haute — le
+//     « drapé » que le noteur nomme.
+//
+// **Mesuré sur les 1 020 points de l'anneau, La Réunion z12, page vivante**
+// (`.banc/P11/M1-bord-avant.json`) : écart moyen **−1,86 m**, moyenne des
+// valeurs absolues **18,94 m**, p05 **−54,1 m**, p95 **+46,7 m**, extrêmes
+// **−270,6 / +202,4 m** — soit, projeté à l'écran au cadrage du noteur,
+// **|0,65| px en moyenne, 9,8 px au pire**.
+//
+// ➡️ **LA PAROI DOIT SUIVRE LA SURFACE QUE LE GPU DESSINE, PAS LA DONNÉE QUE LE
+// GPU N'A PAS.** Ce module porte la loi d'interpolation du maillage, et
+// `globe.hauteurDessinee` la nourrit avec la MÊME loi de nœud que `_buildMesh`.
+//
+// ⚠️ **ET LA COULEUR, ELLE, RESTE SUR LA TEXTURE.** Le nuanceur de fragment
+// calcule `h` par `decodeMetersAA(vUv)` : il colore à la résolution de la
+// donnée, et c'est ce qui fait la richesse du crop. `poserRampe` continue donc
+// de mesurer le relief avec `hauteurSurface`. **La géométrie lit le maillage,
+// la couleur lit la texture** — ce sont deux questions différentes, et les
+// confondre est exactement ce qui a produit le drapé.
+//
+// ══════════ 1. CE QUE CE MODULE NE PROMET PAS ═══════════════════════════════
+//
+// ⚠️ **IL NE FERME PAS L'ÉCART DE RÉSOLUTION.** Le socle porte **594 434
+// sommets** sur son bloc ; le crop en porte **5 625** (9 tuiles × 25², relevé).
+// La silhouette du bloc reste donc dix fois plus grossière que celle du socle.
+// Ce module fait coïncider la paroi et la surface ; il ne rend pas la surface
+// plus fine.
+//
+// ⚠️ **ET L'INTERPOLATION EST CELLE DES HAUTEURS, PAS CELLE DES POSITIONS.** Le
+// GPU interpole des points 3D : à l'intérieur d'un triangle, le rayon dessiné
+// est légèrement INFÉRIEUR à l'interpolation linéaire des rayons — c'est la
+// flèche de la corde. Elle vaut `d² / (8 R)` : à z12 la cellule fait 380 m sur
+// une sphère de 6 371 km, soit **2,8 millimètres**. `test/maillage-tuile.test.js`
+// ④ la MESURE contre `latLonToSphere` du dépôt au lieu de la supposer.
+
+// ══════════ 2. LA DENSITÉ DU MAILLAGE ══════════════════════════════════════
+
+/**
+ * Segments par côté de tuile — **l'unique écriture de cette table**.
+ *
+ * ⚠️ **ELLE VIVAIT DANS `globe.js` SOUS LE NOM `gridFor`, ET ELLE EN SORT PARCE
+ * QU'UN SECOND LECTEUR EST APPARU.** `hauteurDessinee` doit connaître la grille
+ * EXACTE sur laquelle `_buildMesh` a posé ses sommets ; la relire depuis le
+ * maillage (`geometry.userData`) aurait marché tant qu'un maillage existe, et
+ * aurait menti le jour où il n'existe pas encore. La recopier aurait fait « deux
+ * écritures jumelles qui divergent » — la cicatrice que `terrain.js` documente.
+ *
+ * Le commentaire d'origine, gardé mot pour mot parce qu'il porte le POURQUOI :
+ * les bas zooms forment la silhouette de la planète en vue complète, donc ils
+ * reçoivent des grilles plus denses — une tuile z3 couvre 45 degrés de longitude
+ * et 24 segments y laissent des facettes visibles sur le limbe.
+ */
+export function segmentsTuile(z) {
+  if (z <= 2) return 64
+  if (z <= 3) return 48
+  if (z <= 5) return 32
+  return 24
+}
+
+// ══════════ 3. LA LOI D'INTERPOLATION — CELLE DU TAMPON D'INDICES ══════════
+
+/**
+ * La hauteur que le maillage DESSINE en un point d'une tuile.
+ *
+ * ⚠️ **LA DIAGONALE N'EST PAS UN DÉTAIL DE STYLE : ELLE EST DANS LE TAMPON
+ * D'INDICES.** `_buildMesh` écrit, pour la cellule `(i, j)` :
+ *
+ *     a = j (G+1) + i    b = a + 1    c = a + (G+1)    d = c + 1
+ *     indices.push(a, c, b,  b, c, d)
+ *
+ * Les deux triangles partagent donc l'arête `b–c`, c'est-à-dire
+ * l'ANTI-DIAGONALE `su + sv = 1`. Prendre l'autre diagonale rendrait une
+ * surface DIFFÉRENTE à l'intérieur de chaque cellule — et une paroi qui suivrait
+ * cette autre surface rouvrirait le drapé à moitié.
+ *
+ * ⚠️ **`hauteurNoeud` EST FOURNIE PAR L'APPELANT, ET C'EST CE QUI GARDE CE
+ * MODULE PUR.** C'est lui qui sait lire la texture terrarium et le champ du fond
+ * marin ; ici on ne connaît que la grille.
+ *
+ * @param {number} tu abscisse dans la tuile, dans [0, 1], vers l'EST
+ * @param {number} tv ordonnée dans la tuile, dans [0, 1], vers le SUD
+ * @param {number} G segments par côté — `segmentsTuile(z)`
+ * @param {(i:number, j:number) => number} hauteurNoeud la hauteur au nœud `(i, j)`
+ * @returns {number}
+ */
+export function interpolerMaille(tu, tv, G, hauteurNoeud) {
+  const n = Math.max(1, Math.round(G))
+  // ⚠️ **L'ÉCRÊTAGE EST CELUI DE LA CELLULE, PAS CELUI DU POINT.** Un `tu` de 1
+  // exactement tomberait sur la cellule `n`, qui n'existe pas ; on le range dans
+  // la dernière, où `su` vaut alors 1 — le nœud de bord, exactement.
+  const fu = Math.min(Math.max(tu, 0), 1) * n
+  const fv = Math.min(Math.max(tv, 0), 1) * n
+  const i = Math.min(n - 1, Math.floor(fu))
+  const j = Math.min(n - 1, Math.floor(fv))
+  const su = fu - i
+  const sv = fv - j
+  const ha = hauteurNoeud(i, j)
+  const hb = hauteurNoeud(i + 1, j)
+  const hc = hauteurNoeud(i, j + 1)
+  if (su + sv <= 1) return ha + su * (hb - ha) + sv * (hc - ha)
+  const hd = hauteurNoeud(i + 1, j + 1)
+  return hd + (1 - su) * (hc - hd) + (1 - sv) * (hb - hd)
+}
diff --git a/src/monde/rampe-crop.js b/src/monde/rampe-crop.js
index 93fbe49..7500546 100644
--- a/src/monde/rampe-crop.js
+++ b/src/monde/rampe-crop.js
@@ -257,21 +257,21 @@ export function mesurerRelief({
  * repère cartographique, pas une valeur comme une autre.**
  *
  * ⚠️ **ET LA MER GARDE SON SEGMENT.** Le globe partage la rampe en deux : la
  * bathymétrie occupe `[0 ; 0,35]`, la terre `[0,35 ; 1]`. Ce partage NE BOUGE
  * PAS — c'est lui qui garantit qu'un littoral reste un littoral d'un crop à
  * l'autre, et c'est le garde-fou D8 du banc de rejeu (vert contre le dépôt,
  * ROUGE contre la loi « naïve » à rampe unique).
  *
  * @param {{minM:number, maxM:number, minTerreM:number, maxTerreM:number}} mesure
  * @param {{plancherM?:number}} [opts]
- * @returns {{terreBas:number, terreHaut:number, profondeur:number, plancherM:number}}
+ * @returns {{terreBas:number, terreHaut:number, profondeur:number, creux:number, plancherM:number}}
  */
 export function echelleRampe(mesure, { plancherM = 0 } = {}) {
   if (!mesure || !Number.isFinite(mesure.maxM)) {
     throw new TypeError('echelleRampe : il faut une mesure (mesurerRelief)')
   }
   const p = Number.isFinite(plancherM) && plancherM > 0 ? plancherM : 0
   // ⚠️ **PAS DE REPLI ICI — TOUR DE CORRECTION 1, D-2.** `minTerreM`/`maxTerreM`
   // portaient chacun un repli (`: 0`, `: terreBas`) qui SEMBLAIT défensif mais
   // ne l'était pas : le seul appelant du dépôt (`poserRampe` → `mesurerRelief`)
   // NORMALISE DÉJÀ ces deux champs à une valeur finie avant de les rendre
@@ -279,21 +279,49 @@ export function echelleRampe(mesure, { plancherM = 0 } = {}) {
   // comme `mesure.minM` ci-dessous, qui n'a JAMAIS eu de repli. Les replis
   // étaient donc inatteignables dans la chaîne réelle — la campagne de
   // mutation l'a prouvé (S3, S9 : survivantes) — sans défendre un appelant qui
   // existe. Un repli qu'aucun appelant réel ne peut déclencher ment sur ses
   // garanties (§2 de `/threejs-optimisation`) ; il est retiré, pas maquillé en
   // « couvert » par un test qui violerait le contrat documenté ci-dessus pour
   // le seul plaisir d'exercer la ligne.
   const terreBas = mesure.minTerreM
   const terreHaut = Math.max(mesure.maxTerreM, terreBas + p)
   const profondeur = Math.max(-Math.min(0, mesure.minM), p)
-  return { terreBas, terreHaut, profondeur, plancherM: p }
+  // ══════════ LE CREUX — L'ANCRE BASSE DU RELIEF, Tâche P11 ════════════════
+  //
+  // ⛔ **`profondeur` NE PEUT PAS SERVIR D'ANCRE BASSE AU RELIEF, ET LA
+  // NOTATION 03 A PAYÉ CE GLISSEMENT.** Le nuanceur écrivait
+  // `hNormRelief = (h + uOceanDepth) / (uLandMax + uOceanDepth)` en justifiant
+  // que « le minimum du relief du crop EST −uOceanDepth ». **C'est vrai d'un
+  // crop qui a de la mer, et faux de tous les autres** : sans un seul point sous
+  // le niveau de la mer, `profondeur` retombe sur `p`, le PLANCHER DE DIVISION,
+  // c'est-à-dire sur un aveu — et `echelle-continue.js` §4 refuse (à raison) de
+  // l'ancrer, si bien que l'uniforme garde la valeur MONDIALE de 6 000 m. Le
+  // relief était alors normalisé sur un sous-sol de six kilomètres qui n'existe
+  // pas. Mesuré le 2026-08-23 à La Réunion, cadrage intérieur (`.banc/P11/`) :
+  // `uOceanDepth = 6 000` pour un crop dont le point le plus bas est à **107 m**,
+  // donc un pivot de rampe à **0,685** au lieu de 0,41 et une rampe qui
+  // n'atteignait JAMAIS sa moitié basse — l'olive du socle, ×3,51.
+  //
+  // ⚠️ **DEUX PROPRIÉTÉS OBLIGATOIRES, ET AUCUNE N'EST DE CONFORT.**
+  //   ① **POSITIF** : la courbe d'ancrage mélange en `log1p(max(0, v))`
+  //      (`echelle-continue.js` §6) — un champ négatif y serait écrasé à zéro
+  //      sans qu'aucune erreur ne soit levée.
+  //   ② **RELATIF À `terreBas`** : `terreBas − creux` rend `minM` au bit près, et
+  //      il le rend ENCORE après interpolation, parce que les deux champs
+  //      glissent ensemble. Ancrer `minM` directement aurait demandé un signe.
+  //
+  // ⚠️ **ET IL N'A PAS DE CAS DÉGÉNÉRÉ** : `creux = 0` n'est pas « je ne sais
+  // pas », c'est « aucun point de ce crop ne descend sous sa terre la plus
+  // basse » — un FAIT, mesuré sur les mêmes `pas²` points que le reste.
+  const creux = Math.max(0, terreBas - mesure.minM)
+  return { terreBas, terreHaut, profondeur, creux, plancherM: p }
 }
 
 // ══════════ ④ LA LOI — LA TRANSCRIPTION QUE LE NUANCEUR PORTE ══════════════
 
 /**
  * L'indice de rampe, dans [0, 1] — la loi du nuanceur, en JS.
  *
  * ⚠️ **CE N'EST PAS UNE SECONDE LOI, C'EST LA MÊME.** `test/crop-rampe.test.js`
  * EXTRAIT l'expression `float t = sousEau ? … ;` du nuanceur, la traduit
  * mécaniquement en JS et la confronte à cette fonction sur un balayage de
@@ -371,20 +399,26 @@ export function saturation(hauteursM, e) {
  * ⚠️ **ET CE N'EST PAS UNE VALEUR PAR DÉFAUT ANODINE : C'EST LA GARDE DE
  * PRODUCTION.** Tant que personne n'appelle `poserRampe`, le globe peint avec
  * cette échelle — donc au bit près comme avant la Tâche D. Même discipline que
  * `uCropOn: 0` (Tâche A) et `uHabOn: 0` (Tâche C), et ②e le prouve sur 2 001
  * hauteurs par un `Object.is`.
  */
 export const RAMPE_MONDE = Object.freeze({
   terreBas: 0,
   terreHaut: 5600,
   profondeur: 6000,
+  // ⚠️ **6 000 ET PAS 0, ET C'EST LA GARDE DE PRODUCTION DE LA TÂCHE P11.**
+  // L'ancre basse du relief est `terreBas − creux` ; à ces valeurs elle vaut
+  // `−6 000`, c'est-à-dire `−profondeur`, c'est-à-dire EXACTEMENT ce que le
+  // nuanceur portait avant que `uReliefBas` existe. Tant que personne n'appelle
+  // `poserRampe`, le globe peint au bit près comme avant.
+  creux: 6000,
   plancherM: 0,
 })
 
 /**
  * Le plancher d'amplitude d'un crop donné, en mètres — jumeau de
  * `margeCoteDuCrop` (`habillage-crop.js`), et il tire son échelle du même
  * endroit : la largeur au sol du crop, divisée par le côté du bloc.
  */
 export function plancherRampeDuCrop(repere, exageration = EXAG_SOCLE_NOMINALE) {
   return plancherAmplitudeM(largeurCropM(repere) / COTE_CROP_UNITES, exageration)
diff --git a/test/crop-naturel.test.js b/test/crop-naturel.test.js
index 30c8185..4768b9d 100644
--- a/test/crop-naturel.test.js
+++ b/test/crop-naturel.test.js
@@ -597,48 +597,110 @@ test('⑤d le pivot, la limite des arbres et le voile lisent hNormRelief — l
   // MARIN COMPRIS : relevé dans l'application vivante (La Réunion z12), il couvre
   // −2 116 → 2 626 m, donc le niveau de la mer y tombe à **hNorm = 0,4462**, pas
   // à zéro. `uHeightPivot` (0,65) et `uTreeLine` (0,92) sont des réglages POSÉS
   // DANS CETTE ÉCHELLE. Les appliquer au `hNorm` de la Tâche D — qui part du
   // minimum de la TERRE, donc met la mer à zéro — rendait `natRampT = 0` pour
   // TOUT ce qui est sous **1 163 m** (un aplat olive sur toute l'île) là où le
   // socle étale déjà 0 → 0,78 sur la même tranche.
   const i = FRAG_GLOBE.indexOf('float hNormRelief = ')
   assert.ok(i > 0, 'hNormRelief est introuvable dans le nuanceur du globe')
   const expr = FRAG_GLOBE.slice(i + 'float hNormRelief = '.length, FRAG_GLOBE.indexOf(';', i))
-  assert.match(expr, /clamp\(\(h \+ uOceanDepth\) \/ max\(uLandMax \+ uOceanDepth, uPlancherRampeM\), 0\.0, 1\.0\)/)
+  // ⛔ **ET L'ANCRE BASSE N'EST PLUS `-uOceanDepth` — Tâche P11.** Voir ⑤d bis :
+  // cette écriture-là n'était juste que sur un crop AVEC MER.
+  assert.match(expr, /clamp\(\(h - uReliefBas\) \/ max\(uLandMax - uReliefBas, uPlancherRampeM\), 0\.0, 1\.0\)/)
   // ⚠️ **ET IL EST EXÉCUTÉ, PAS SEULEMENT LU.** On rejoue les DEUX conventions
   // sur les valeurs relevées et on exige que celle du nuanceur suive le socle.
   const SOCLE = { min: -2116, max: 2626 } // uHeightRange, relevé le 2026-08-22
   const G = { landBas: 0, landMax: 2584.3525390625, oceanDepth: 2106.7706909179688 }
   const cl = (v) => Math.min(Math.max(v, 0), 1)
   const hSocle = (m) => cl((m - SOCLE.min) / (SOCLE.max - SOCLE.min))
   const hTerre = (m) => cl((m - G.landBas) / (G.landMax - G.landBas))
-  const hRelief = (m) => cl((m + G.oceanDepth) / (G.landMax + G.oceanDepth))
+  // ⚡ **CE CROP-LÀ A DE LA MER** : son `minM` vaut −2 106,8, donc `terreBas −
+  // creux` et `−profondeur` désignent le MÊME nombre. C'est la raison pour
+  // laquelle l'écriture d'avant passait ici — et ⑤d bis dit où elle ne passe pas.
+  const reliefBas = G.landBas - G.oceanDepth
+  const hRelief = (m) => cl((m - reliefBas) / (G.landMax - reliefBas))
   for (const m of [0, 200, 500, 1000, 1500, 2000]) {
     const cible = rampeT(hSocle(m), 0.65, 2.5)
     const bon = rampeT(hRelief(m), 0.65, 2.5)
     const faux = rampeT(hTerre(m), 0.65, 2.5)
     assert.ok(Math.abs(bon - cible) < 0.02, `${m} m : hNormRelief donne ${bon}, le socle ${cible}`)
     if (m > 0 && m < 2000) assert.ok(Math.abs(faux - cible) > 0.05, `${m} m : les deux conventions ne se distinguent pas — le test ne prouve rien`)
   }
   // le plancher du pivot suit la MÊME conversion : la mer est à h = 0
-  assert.match(FRAG_GLOBE, /natPlancherPivot\(uOceanDepth \/ max\(uLandMax \+ uOceanDepth, uPlancherRampeM\)\)/)
-  assert.ok(Math.abs(plancherPivot(G.oceanDepth / (G.landMax + G.oceanDepth)) - plancherPivot(hSocle(0))) < 0.01)
+  // ⚠️ **LE `max(uHeightPivot, …)` FAIT PARTIE DE L'ASSERTION, ET UNE SURVIVANTE
+  // L'A EXIGÉ** : sans lui, le plancher ÉCRASE le réglage de l'utilisateur, et
+  // `heightPivot` cesse d'être une tirette. Le socle écrit exactement la même
+  // ligne (`float pivot = max(uHeightPivot, pivotFloor);`).
+  assert.match(FRAG_GLOBE, /float pivot = max\(uHeightPivot, natPlancherPivot\(\(0\.0 - uReliefBas\) \/ max\(uLandMax - uReliefBas, uPlancherRampeM\)\)\);/)
+  assert.match(TERRAIN_SRC, /float pivot = max\(uHeightPivot, pivotFloor\);/)
+  assert.ok(Math.abs(plancherPivot((0 - reliefBas) / (G.landMax - reliefBas)) - plancherPivot(hSocle(0))) < 0.01)
   // et un pivot d'utilisateur plus haut que le plancher gagne — c'est un réglage
   assert.equal(Math.max(0.65, plancherPivot(hSocle(0))), 0.65)
   assert.equal(plancherPivot(0), MARGE_PIVOT)
   // les trois lecteurs de l'échelle du socle emploient hNormRelief, aucun hNorm
   for (const appel of ['natRampT(hNormRelief,', 'natHumiditeY(anl.b, anl.a, hNormRelief,', 'natVoile(hNormRelief,']) {
     assert.ok(FRAG_GLOBE.includes(appel), `${appel} : un lecteur est resté sur l’échelle de la Tâche D`)
   }
 })
 
+test('⑤d bis SUR UN CROP SANS MER, `-uOceanDepth` N’EST PAS LE MINIMUM DU RELIEF — Tâche P11', () => {
+  // ⛔ **⑤d ÉTAIT VERT PARCE QU'IL NE TESTAIT QU'UNE BRANCHE.** Son crop de
+  // référence a de la mer (`minM = −2 106,8`), et là `−profondeur` EST le
+  // minimum du relief. Sur un crop ENTIÈREMENT TERRESTRE, `echelleRampe` rend
+  // `profondeur = plancherM` (un aveu), `echelle-continue.js` §4 refuse de
+  // l'ancrer, et l'uniforme garde la valeur MONDIALE de 6 000 m.
+  //
+  // ⚡ **CE N'EST PAS UNE HYPOTHÈSE : C'EST LE RELEVÉ DU 2026-08-23**, La Réunion
+  // cadrage intérieur (lat −21,115 · lon 55,536, z12), page vivante, socle
+  // rallumé dans la même page (`.banc/P11/D2-ancre-basse-P11.json`) :
+  //   · posé      : uLandBas 130 · uLandMax 3 026 · uOceanDepth **6 000**
+  //   · mesuré    : terreBas 107,46 · terreHaut 3 009,64 · profondeur **0,0175**
+  //   · socle     : uHeightRange [−4,945 ; 7,161] unités, uSeaY −5,409 —
+  //                 c'est-à-dire un MNT dont le minimum est AU-DESSUS de la mer.
+  const SOCLE = { min: 111, max: 3010 } // dem.minM / dem.maxM, dérivés d'uHeightRange et d'uSeaY
+  const CROP = { landBas: 130, landMax: 3026, oceanDepth: 6000, creux: 0 }
+  const cl = (v) => Math.min(Math.max(v, 0), 1)
+  const hSocle = (m) => cl((m - SOCLE.min) / (SOCLE.max - SOCLE.min))
+  const avant = (m) => cl((m + CROP.oceanDepth) / (CROP.landMax + CROP.oceanDepth))
+  const bas = CROP.landBas - CROP.creux
+  // ⚡ **`apres` N'EST PAS RÉÉCRITE ICI : ELLE EST EXTRAITE DU NUANCEUR ET
+  // EXÉCUTÉE.** Une assertion de texte serait verte le jour où quelqu'un écrit
+  // l'expression dans un commentaire ; celle-ci meurt si le GPU calcule autre
+  // chose. (Le protocole est celui de `test/crop-rampe.test.js` ②b.)
+  const i2 = FRAG_GLOBE.indexOf('float hNormRelief = ')
+  const brut = FRAG_GLOBE.slice(i2 + 'float hNormRelief = '.length, FRAG_GLOBE.indexOf(';', i2))
+  const js = brut.replace(/\bclamp\s*\(/g, 'CL3(').replace(/\bmax\s*\(/g, 'Math.max(')
+  // eslint-disable-next-line no-new-func
+  const duNuanceur = new Function('h', 'uReliefBas', 'uLandMax', 'uPlancherRampeM', 'CL3', `return (${js});`)
+  const apres = (m) => duNuanceur(m, bas, CROP.landMax, 0.0175, (v, a, b) => Math.min(Math.max(v, a), b))
+  assert.ok(Math.abs(apres(1000) - cl((1000 - bas) / (CROP.landMax - bas))) < 1e-12, "l'expression extraite ne dit pas la loi")
+  // les deux pivots-planchers, dans les deux conventions
+  const pivotAvant = Math.max(0.41, plancherPivot(CROP.oceanDepth / (CROP.landMax + CROP.oceanDepth)))
+  const pivotApres = Math.max(0.41, plancherPivot((0 - bas) / (CROP.landMax - bas)))
+  const pivotSocle = Math.max(0.41, plancherPivot(hSocle(0)))
+  assert.ok(Math.abs(pivotAvant - pivotSocle) > 0.25, `le pivot d'avant valait ${pivotAvant}, celui du socle ${pivotSocle}`)
+  assert.ok(Math.abs(pivotApres - pivotSocle) < 1e-9, `le pivot d'après vaut ${pivotApres}`)
+  // ⚡ ET LA RAMPE ELLE-MÊME : l'écriture d'avant ne descend JAMAIS sous 0,45,
+  // celle d'après suit le socle à deux centièmes sur toute l'île.
+  let minAvant = 1
+  for (const m of [0, 200, 500, 800, 1200, 1800, 2400, 3000]) {
+    const cible = rampeT(hSocle(m), pivotSocle, 2.2)
+    const bon = rampeT(apres(m), pivotApres, 2.2)
+    const faux = rampeT(avant(m), pivotAvant, 2.2)
+    if (faux < minAvant) minAvant = faux
+    assert.ok(Math.abs(bon - cible) < 0.02, `${m} m : la loi P11 donne ${bon}, le socle ${cible}`)
+  }
+  assert.ok(minAvant > 0.44, `⛔ l'écriture d'avant descendait jusqu'à ${minAvant} — elle atteignait la moitié basse`)
+  assert.equal(rampeT(hSocle(0), pivotSocle, 2.2), 0, 'le socle, lui, part bien du bas de sa table')
+})
+
 // --- le stub, en fin de fichier : il n'est utile qu'aux tests ④
 
 const val = (v) => ({ value: v })
 const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this }, copy() { return this } })
 const couleurStub = () => ({ set() {}, setStyle() {} })
 function globeStub() {
   return {
     _crop: null,
     uniforms: {
       uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
diff --git a/test/crop-parois.test.js b/test/crop-parois.test.js
index 856e121..057adf7 100644
--- a/test/crop-parois.test.js
+++ b/test/crop-parois.test.js
@@ -621,22 +621,29 @@ test('un coin VIF (rayon nul) reste un carré, et le solide reste sain', () => {
 function tuile(z, x, y, size, f) {
   const heights = new Float32Array(size * size)
   for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) heights[j * size + i] = f(i, j)
   return { z, x, y, size, heights, key: `${z}/${x}/${y}` }
 }
 
 /** (mercator normalisé) → (lat, lon). Le repère unité rend `latLonDeLocal` direct. */
 const UNITE = { cx: 0, cy: 0, demi: 1 }
 const deMerc = (mx, my) => latLonDeLocal(mx, my, UNITE)
 
+// ⚠️ **`_tuileLaPlusFine` FAIT PARTIE DU `this` MINIMAL DEPUIS LA TÂCHE P11** :
+// la recherche de tuile est sortie de `hauteurSurface` le jour où
+// `hauteurDessinee` en a eu besoin, pour qu'il n'y ait qu'UN repli
+// d'antiméridien — celui que ce fichier teste juste en dessous.
 const lisSurface = (liste, lat, lon) =>
-  Globe.prototype.hauteurSurface.call({ tuilesAvecHauteurs: () => liste }, lat, lon)
+  Globe.prototype.hauteurSurface.call(
+    { tuilesAvecHauteurs: () => liste, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine },
+    lat, lon,
+  )
 
 test('hauteurSurface INTERPOLE — elle ne s accroche pas au nœud le plus proche', () => {
   // une rampe franche sur 4 texels : le nœud voisin vaut 300 m de plus
   const t = tuile(13, 4300, 4600, 4, (i) => 100 * i)
   const n = 2 ** 13
   // un point choisi ENTRE deux nœuds : (u, v) = (0,3125 ; 0,5625)
   const u = 0.3125
   const v = 0.5625
   const { lat, lon } = deMerc((4300 + u) / n, (4600 + v) / n)
   const vu = lisSurface([t], lat, lon)
diff --git a/test/crop-rampe.test.js b/test/crop-rampe.test.js
index 9ac1893..c6645f5 100644
--- a/test/crop-rampe.test.js
+++ b/test/crop-rampe.test.js
@@ -222,20 +222,95 @@ test("①h l'ancre basse est le minimum de la TERRE, pas du relief", () => {
   // niveau de la mer à 0,44 et ferait quitter au littoral le bas de la rampe.
   assert.equal(eMaurice.terreBas, 0)
   assert.equal(eMaurice.profondeur, 140)
   // et sur un crop intérieur, l'ancre basse est bien la vallée
   assert.equal(eAlpin.terreBas, 402)
   // ⚠️ ... dont la profondeur retombe alors sur le PLANCHER, et c'est la
   // conséquence acceptée : un crop sans mer aplatit toute la mer du monde.
   assert.equal(eAlpin.profondeur, PLANCHER)
 })
 
+test("①i le CREUX dit de combien le relief descend SOUS SA TERRE — Tâche P11", () => {
+  // ⛔ **CE QUE `profondeur` NE SAIT PAS DIRE, ET LA NOTATION 03 LE PAIE.**
+  // `profondeur` est un BUDGET DE PROFONDEUR : sur un crop sans mer elle retombe
+  // au PLANCHER DE DIVISION, c'est-à-dire sur un aveu (« je ne sais pas à quelle
+  // profondeur descend la mer »), et `echelle-continue` a raison de refuser de
+  // l'ancrer. Mais `hNormRelief` s'en servait comme ANCRE BASSE DU RELIEF, où
+  // « je ne sais pas » n'a aucun sens : le relief, lui, a toujours un minimum.
+  //
+  // `creux` est ce minimum, exprimé POSITIVEMENT et RELATIVEMENT à `terreBas` —
+  // deux propriétés obligatoires : positif parce que la courbe d'ancrage mélange
+  // en `log1p` (`echelle-continue.js` §6, `log1p(max(0, v))` écraserait un
+  // négatif), relatif parce que `terreBas - creux` doit rendre `minM` AU BIT PRÈS
+  // quelle que soit l'interpolation des deux champs.
+  assert.equal(eMaurice.creux, 140)      // terreBas 0, minM -140
+  assert.equal(eAlpin.creux, 0)          // ⚡ AUCUNE MER : le creux est NUL, et c'est un FAIT
+  assert.equal(ePlat.creux, 0)
+  // ⚡ ET C'EST L'IDENTITÉ QUI COMPTE : `terreBas - creux` EST `minM`.
+  for (const [m, e] of [[MAURICE, eMaurice], [ALPIN, eAlpin], [PLAT, ePlat]]) {
+    assert.ok(Object.is(e.terreBas - e.creux, m.minM), `${e.terreBas} - ${e.creux} != ${m.minM}`)
+  }
+  // ⛔ ET LE CREUX N'EST PAS `profondeur` : sur un crop sans mer, l'un vaut ZÉRO
+  // et l'autre le PLANCHER, et l'ancre basse qu'ils désignent diffère de 402 m.
+  assert.notEqual(eAlpin.creux, eAlpin.profondeur)
+  assert.equal(eAlpin.terreBas - eAlpin.creux, 402)
+  assert.ok(Math.abs(-eAlpin.profondeur - 402) > 400)
+})
+
+test("①i bis le creux ne peut JAMAIS être négatif — et l’algèbre dit pourquoi", () => {
+  // ⚠️ **UNE SURVIVANTE A DEMANDÉ CE TEST.** La mutation qui retire le `max(0, …)`
+  // survivait, et la première réaction — « donc c'est du code mort » — n'est
+  // vraie que d'un côté, et il faut dire lequel.
+  //
+  // ⚡ **CÔTÉ `mesurerRelief`, LA BRANCHE EST INATTEIGNABLE PAR L'ALGÈBRE** :
+  // `minTerreM` est le minimum sur le sous-ensemble `h >= 0`, `minM` le minimum
+  // sur TOUS les points, donc `minM <= minTerreM = terreBas`. On le REJOUE au
+  // lieu de le supposer, sur un relief qui plonge et un relief qui ne plonge pas.
+  for (const zone of [(u, v) => u < 0, (u, v) => false]) {
+    const m = mesurerRelief({
+      repere: REPERE, forme: FORME, pas: 24,
+      hauteur: (lat, lon) => { const q = localCrop(lat, lon, REPERE); return zone(q.u, q.v) ? -700 : 300 },
+    })
+    assert.ok(m.minM <= m.minTerreM, `${m.minM} > ${m.minTerreM}`)
+    assert.ok(echelleRampe(m, { plancherM: PLANCHER }).creux >= 0)
+  }
+  // ⛔ **MAIS `echelleRampe` EST EXPORTÉE, ET SON ENTRÉE N'EST PAS TOUJOURS UNE
+  // MESURE DU DÉPÔT** — ce fichier lui en passe trois écrites à la main, et
+  // `poserRampe({ echelle })` est le point d'entrée des bancs. La garde n'est
+  // donc PAS morte : elle défend un appelant qui existe, et voici ce qu'elle
+  // empêche — un creux négatif, que `log1p(max(0, v))` écraserait à zéro sans
+  // un mot, et qui remonterait l'ancre basse AU-DESSUS de la terre.
+  const incoherente = { minM: 900, maxM: 2000, minTerreM: 100, maxTerreM: 2000 }
+  const e = echelleRampe(incoherente, { plancherM: PLANCHER })
+  assert.equal(e.creux, 0, 'une mesure incohérente doit rendre un creux NUL, pas négatif')
+  assert.ok(e.terreBas - e.creux <= e.terreHaut, "l'ancre basse ne peut pas dépasser le sommet")
+})
+
+test("①j `echelleRampe` rend TOUJOURS un creux fini — il n'y a pas de repli à écrire", () => {
+  // ⚠️ **C'EST CE QUI AUTORISE `_poserUniformesRampe` À LE LIRE SANS GARDE.** Un
+  // `undefined` y poserait un `NaN` dans un uniforme, c'est-à-dire une
+  // comparaison FAUSSE dans le nuanceur (§ « écrêtage de Mercator » de
+  // `globe.js`). On exige donc la totalité, on n'écrit pas un repli qui la
+  // supposerait absente.
+  for (const m of [MAURICE, ALPIN, PLAT,
+    { minM: -6000, maxM: 0, minTerreM: 0, maxTerreM: 0 },   // tout en mer
+    { minM: 0, maxM: 0, minTerreM: 0, maxTerreM: 0 }]) {
+    const e = echelleRampe(m, { plancherM: PLANCHER })
+    assert.ok(Number.isFinite(e.creux) && e.creux >= 0, JSON.stringify(e))
+  }
+  assert.ok(Number.isFinite(RAMPE_MONDE.creux))
+  // ⚡ **ET LE DÉFAUT MONDIAL REND L'ANCRE D'AVANT LA TÂCHE P11, AU BIT PRÈS** :
+  // `terreBas - creux` vaut `-profondeur`, donc `hNormRelief` retombe sur
+  // `(h + uOceanDepth) / (uLandMax + uOceanDepth)`. La production est intouchée.
+  assert.ok(Object.is(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux, -RAMPE_MONDE.profondeur))
+})
+
 // ══════════ ② LE NUANCEUR — LA TRANSCRIPTION, EXÉCUTÉE ═════════════════════
 
 test("②a l'expression du nuanceur porte les QUATRE uniformes de la rampe", () => {
   // ⚠️ **CE N'EST PAS UN TEST DE PRÉSENCE DE NOM** : `noms` est extrait de
   // l'EXPRESSION `float t = …`, pas du fichier. Un `uLandBas` écrit dans un
   // commentaire, ou déclaré et jamais employé, ne passe pas ici.
   const { noms } = loiDuNuanceur(globeSrc)
   assert.deepEqual(
     [...noms].sort(),
     ['uLandBas', 'uLandMax', 'uOceanDepth', 'uPlancherRampeM'],
@@ -316,20 +391,68 @@ function blocUniformes() {
 }
 
 /** uniforme du nuanceur -> champ de `RAMPE_MONDE`. */
 const CHAMPS = [
   ['uLandBas', 'terreBas'],
   ['uLandMax', 'terreHaut'],
   ['uOceanDepth', 'profondeur'],
   ['uPlancherRampeM', 'plancherM'],
 ]
 
+// ⚠️ **`uReliefBas` EST LE CINQUIÈME, ET IL EST DÉRIVÉ, PAS RECOPIÉ — Tâche
+// P11.** Il ne correspond à aucun champ de `RAMPE_MONDE` pris seul : il vaut
+// `terreBas − creux`. Il est donc vérifié à part, ci-dessous, avec la même
+// exigence — lu depuis `RAMPE_MONDE`, jamais écrit en dur.
+const EXPR_RELIEF_BAS = 'RAMPE_MONDE.terreBas - RAMPE_MONDE.creux'
+
+test('②d ter TOUT uniforme LU par le fragment y est DÉCLARÉ — le nuanceur compile', () => {
+  // ⛔ **UNE SURVIVANTE A DEMANDÉ CE TEST, ET IL EST GÉNÉRIQUE.** Retirer la
+  // ligne `uniform float uReliefBas;` du nuanceur ne faisait rougir personne :
+  // aucun test ne LISAIT le texte du fragment pour y chercher ses déclarations,
+  // et le défaut ne se serait vu qu'au chargement de la page — « un agent a
+  // livré du code qui plantait au démarrage AVEC 3 098 tests verts » (§0 du
+  // plan). L'assertion vaut pour TOUS les uniformes, pas seulement le mien.
+  const i = globeSrc.indexOf('const FRAG =')
+  const frag = globeSrc.slice(i, globeSrc.indexOf('\nconst ', i + 10))
+  const declares = new Set([...frag.matchAll(/^uniform\s+\w+\s+(u[A-Za-z0-9]+)\s*;/gm)].map((m) => m[1]))
+  // le corps SEUL — on retire les lignes de déclaration et les commentaires
+  const corps = frag
+    .split('\n')
+    .filter((l) => !/^uniform\s/.test(l.trim()) && !/^\s*\/\//.test(l))
+    .join('\n')
+  const lus = new Set([...corps.matchAll(/\bu[A-Z][A-Za-z0-9]*/g)].map((m) => m[0]))
+  const orphelins = [...lus].filter((n) => !declares.has(n))
+  assert.deepEqual(orphelins, [], 'uniformes lus mais jamais déclarés : ' + orphelins.join(', '))
+  // ⚠️ **ET LE TÉMOIN : LE TEST DOIT VOIR QUELQUE CHOSE.** Sans lui, un jour où
+  // l'extraction rendrait une chaîne vide, ce test serait vert pour rien.
+  assert.ok(declares.size > 40, 'seulement ' + declares.size + ' uniformes déclarés')
+  assert.ok(lus.has('uReliefBas') && declares.has('uReliefBas'))
+})
+
+test('②d bis `uReliefBas` naît de `RAMPE_MONDE` et `retirerRampe` l’y ramène — Tâche P11', () => {
+  assert.ok(blocUniformes().includes(`uReliefBas: { value: ${EXPR_RELIEF_BAS} }`),
+    'uReliefBas ne dérive pas de RAMPE_MONDE dans this.uniforms')
+  const retirer = globeSrc.slice(globeSrc.indexOf('  retirerRampe() {'))
+  assert.ok(retirer.slice(0, 900).includes(`u.uReliefBas.value = ${EXPR_RELIEF_BAS}`),
+    'retirerRampe ne rend pas uReliefBas')
+  // ⚡ ET LA VALEUR NEUTRE EST CELLE D'AVANT LA TÂCHE P11, AU BIT PRÈS.
+  assert.ok(Object.is(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux, -RAMPE_MONDE.profondeur))
+  // ⚠️ **ET IL EST POSÉ PAR L'ÉCRIVAIN UNIQUE**, `_poserUniformesRampe`, pas
+  // ailleurs : deux écritures d'un uniforme de rampe, c'est le défaut que ce
+  // module documente déjà (« il y en avait DEUX, plus un troisième »).
+  const ecritures = globeSrc.split('uReliefBas.value =').length - 1
+  assert.equal(ecritures, 2, 'uReliefBas doit s’écrire exactement dans _poserUniformesRampe et retirerRampe')
+  const poseur = globeSrc.slice(globeSrc.indexOf('  _poserUniformesRampe(e) {'))
+  assert.ok(poseur.slice(0, 1400).includes('u.uReliefBas.value = e.terreBas - e.creux'),
+    '_poserUniformesRampe ne pose pas l’ancre basse du relief')
+})
+
 test('②d les quatre uniformes sont PARTAGÉS — donc les alentours les portent', () => {
   // ⚠️ C'est la mécanique exacte de « les alentours la suivent » : les quatre
   // vivent dans `this.uniforms`, que `_materialFor` étale dans CHAQUE matériau
   // de tuile. Une tuile de l'autre côté de la planète peint avec l'échelle du
   // crop, et c'est le but — il n'y a qu'UNE rampe, donc pas de couture.
   //
   // ⚠️ **ET ILS LISENT `RAMPE_MONDE`, ILS NE RECOPIENT PAS SES NOMBRES.**
   // `5600` et `6000` étaient des littéraux ici ; `retirerRampe` en aurait fait
   // une seconde copie, et une constante dupliquée diverge en silence (§1 de
   // /threejs-optimisation, question 2).
@@ -349,21 +472,21 @@ test('②d les quatre uniformes sont PARTAGÉS — donc les alentours les porten
 
 test("②e SANS `poserRampe`, LE GLOBE EST CELUI D'AVANT — au bit près", () => {
   // ⚠️ **LA MÊME GARDE QUE `uCropOn` ET `uHabOn`, ET LA MÊME PREUVE.** Les
   // valeurs par défaut du dépôt sont rejouées dans l'expression d'AUJOURD'HUI et
   // confrontées à la rampe HISTORIQUE, réécrite ici mot pour mot depuis
   // `git show 82e8b87:src/globe.js`. Un `Object.is` : pas d'epsilon, pas de
   // tolérance — le bit.
   const loi = loiDuNuanceur(globeSrc)
   // ⚠️ Les valeurs par défaut sont celles de `RAMPE_MONDE`, et ②d vient de
   // vérifier que `this.uniforms` les LIT au lieu de les recopier.
-  assert.deepEqual({ ...RAMPE_MONDE }, { terreBas: 0, terreHaut: 5600, profondeur: 6000, plancherM: 0 })
+  assert.deepEqual({ ...RAMPE_MONDE }, { terreBas: 0, terreHaut: 5600, profondeur: 6000, creux: 6000, plancherM: 0 })
   const defauts = uniformesDe(RAMPE_MONDE)
   const historique = (h, se) =>
     se ? 0.35 * (1 - CLAMP(-h / 6000, 0, 1)) : 0.35 + 0.65 * CLAMP(h / 5600, 0, 1)
   for (let i = 0; i <= 2000; i++) {
     const h = -12000 + (i * 24000) / 2000
     for (const se of [false, true]) {
       assert.ok(
         Object.is(loi.t(h, se, defauts), historique(h, se)),
         `h=${h} sousEau=${se} : ${loi.t(h, se, defauts)} vs ${historique(h, se)}`,
       )
@@ -390,20 +513,21 @@ test('②f `poserRampe` et `retirerRampe` existent, et `retirerCrop` retire la r
 // qu'elle lit réellement — `uniforms`, `_crop`, `tuilesAvecHauteurs`.
 
 function faussGlobe(crop, hauteur) {
   const val = (v) => ({ value: v })
   return {
     _crop: crop,
     uniforms: {
       uLandBas: val(RAMPE_MONDE.terreBas),
       uLandMax: val(RAMPE_MONDE.terreHaut),
       uOceanDepth: val(RAMPE_MONDE.profondeur),
+      uReliefBas: val(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux),
       uPlancherRampeM: val(RAMPE_MONDE.plancherM),
       uCropCoin: val(FORME.coin),
       uCropCoinN: val(FORME.expo),
       // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis, ET CE SONT DES MÉTHODES QU'IL EXERCE.**
       // Ce faux globe porte exactement ce que `poserRampe` lit et écrit ; la
       // tâche lui a donné un uniforme de plus (le zéro de la mer), un poseur
       // d'uniformes unique et le partage de l'échelle continue. Les emprunter
       // au VRAI prototype plutôt que les bricoler est ce qui rend ce banc utile
       // — un bouchon de `_poserUniformesRampe` laisserait passer une pose qui
       // n'écrit rien.
@@ -719,21 +843,21 @@ test('⑤c `unitesEnMetres` ne change PAS `margeCoteM` — au bit près', () =>
 // ══════════ ⑥ R1 — LA BOUCLE EST COUPÉE, ET C'EST VÉRIFIÉ ══════════════════
 
 test('⑥a aucune décision de CADRAGE ne lit l’échelle de la rampe', () => {
   // ⚠️ **R1 A DÉJÀ MORDU TROIS FOIS SUR CE CHANTIER** — dont un pilote
   // d'exagération de gain mesuré 1,44, donc divergent, et un autre qui gelait.
   // La rampe a le droit de LIRE le relief ; ce qui est interdit, c'est qu'une
   // décision de cadrage relise la rampe. Ce test tient la porte fermée.
   for (const f of ['seuil-socle.js', 'descente-bornee.js', 'exageration-continue.js', 'veille-socle.js', 'flux-terrain.js']) {
     const src = readFileSync(new URL(`../src/monde/${f}`, import.meta.url), 'utf8')
     assert.ok(
-      !/uLandBas|uLandMax|uOceanDepth|uPlancherRampeM|rampe-crop/.test(src),
+      !/uLandBas|uLandMax|uOceanDepth|uReliefBas|uPlancherRampeM|rampe-crop/.test(src),
       `${f} lit l'échelle de la rampe — R1 est rompue`,
     )
   }
 })
 
 test('⑥b `rampe-crop.js` n’importe rien qui décide d’un cadrage', () => {
   const src = readFileSync(new URL('../src/monde/rampe-crop.js', import.meta.url), 'utf8')
     const imports = [...src.matchAll(/\bfrom '([^']+)'/g)].map((m) => m[1])
   assert.deepEqual(imports.sort(), ['./crop-sphere.js', './habillage-crop.js'])
 })
diff --git a/test/echelle-continue.test.js b/test/echelle-continue.test.js
index 9244fa1..ec4b810 100644
--- a/test/echelle-continue.test.js
+++ b/test/echelle-continue.test.js
@@ -101,39 +101,71 @@ test('①b une mesure au PLANCHER est MUETTE, pas plate — le 0,009 m de Z13',
   assert.equal(u.fondBudget, true)
   // et une VRAIE profondeur est bien retenue
   assert.equal(champsUtiles({ ...DESCENTE[3], plancherM: 0.14 }).profondeur, true)
   // un crop rigoureusement plat ne dit rien de sa terre non plus
   const plat = echelleRampe({ minM: 12, maxM: 12, minTerreM: 12, maxTerreM: 12 }, { plancherM: 0.0066 })
   assert.equal(champsUtiles(plat).terreHaut, false)
 })
 
 test('①c une ancre s’écrit UNE FOIS par cran — la re-mesure ne repasse pas', () => {
   const p = creerEchelleContinue(RAMPE_MONDE)
-  const poses = ancrerMesure(p, 8192, { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000, plancherM: 0.01 })
+  const poses = ancrerMesure(p, 8192, { terreBas: 0, terreHaut: 2000, profondeur: 1500, creux: 1500, fondBudget: 4000, plancherM: 0.01 })
   assert.deepEqual(poses.sort(), [...CHAMPS].sort())
   // une seconde mesure au MÊME cran ne change RIEN — c'est la propriété qui
   // remplace « re-mesurée par saut à chaque pose »
-  const rien = ancrerMesure(p, 9564, { terreBas: 400, terreHaut: 3057, profondeur: 900, fondBudget: 4415, plancherM: 0.01 })
+  const rien = ancrerMesure(p, 9564, { terreBas: 400, terreHaut: 3057, profondeur: 900, creux: 900, fondBudget: 4415, plancherM: 0.01 })
   assert.deepEqual(rien, [])
-  assert.deepEqual(p.ancres.get(13), { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000 })
+  assert.deepEqual(p.ancres.get(13), { terreBas: 0, terreHaut: 2000, profondeur: 1500, creux: 1500, fondBudget: 4000 })
   // ... mais un cran VOISIN, lui, s'écrit
-  const autre = ancrerMesure(p, 26720, { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, fondBudget: 6228, plancherM: 1.13 })
+  const autre = ancrerMesure(p, 26720, { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, creux: 5639.5, fondBudget: 6228, plancherM: 1.13 })
   assert.deepEqual(autre.sort(), [...CHAMPS].sort())
   assert.equal(p.ancres.size, 2)
 })
 
+test("①b bis LE CREUX EST ANCRÉ AVEC LA TERRE, ET ZÉRO EST UNE MESURE — Tâche P11", () => {
+  // ⛔ **LA RÈGLE DU §4 NE S'APPLIQUE PAS AU CREUX, ET LA CONFONDRE COÛTE LA
+  // PALETTE.** « Une mesure au plancher est muette » vaut pour `profondeur`,
+  // dont le plancher EST le repli de division. `creux`, lui, vaut ZÉRO quand
+  // aucun point du crop ne descend sous sa terre la plus basse — ce n'est pas un
+  // aveu, c'est un relevé. Le soumettre au test `> plancherM` l'aurait laissé au
+  // défaut MONDIAL de 6 000 m sur tout crop intérieur, c'est-à-dire exactement
+  // le défaut que la Tâche P11 répare.
+  const z13 = { ...DESCENTE[5], creux: 0, plancherM: PLANCHER_Z13 }
+  const u = champsUtiles(z13)
+  assert.equal(u.profondeur, false, 'la profondeur au plancher reste muette')
+  assert.equal(u.creux, true, '⛔ un creux NUL est une mesure, pas un aveu')
+  // ⚠️ ... et il suit la TERRE, parce que l'ancre basse du relief est
+  // `terreBas − creux` : ancrer l'un sans l'autre mélangerait une mesure et un
+  // défaut mondial dans la MÊME soustraction.
+  const plat = echelleRampe({ minM: 12, maxM: 12, minTerreM: 12, maxTerreM: 12 }, { plancherM: 0.0066 })
+  assert.equal(champsUtiles(plat).terreHaut, false)
+  assert.equal(champsUtiles(plat).creux, false, 'sans terre exploitable, le creux ne dit rien non plus')
+  // ⚡ ET LA COURBE LE PORTE : un cran ancré à creux = 0 rend 0, pas 6 000.
+  const p = creerEchelleContinue(RAMPE_MONDE)
+  ancrerMesure(p, 8192, { terreBas: 107, terreHaut: 3010, profondeur: PLANCHER_Z13, creux: 0, fondBudget: 4415, plancherM: PLANCHER_Z13 })
+  const v = majEchelle(p, 8192)
+  assert.equal(v.creux, 0)
+  assert.equal(v.terreBas - v.creux, 107, "l'ancre basse du relief est le minimum mesuré")
+  assert.equal(v.profondeur, RAMPE_MONDE.profondeur, 'la profondeur, elle, garde le monde — et c’est juste')
+})
+
 test('①d sans ancre, l’échelle est EXACTEMENT `RAMPE_MONDE` — la garde de production', () => {
   const p = creerEchelleContinue(RAMPE_MONDE)
   const v = majEchelle(p, 12345)
-  for (const c of ['terreBas', 'terreHaut', 'profondeur']) {
+  // ⚠️ **`creux` EN FAIT PARTIE DEPUIS LA TÂCHE P11**, et l'omettre laissait
+  // survivre une mutation qui vidait son repli : l'ancre basse du relief
+  // retombait à zéro sur toute la planète, sans qu'aucun test ne rougisse.
+  for (const c of ['terreBas', 'terreHaut', 'profondeur', 'creux']) {
     assert.ok(Object.is(v[c], RAMPE_MONDE[c]), c + ' = ' + v[c])
   }
+  assert.ok(Object.is(v.terreBas - v.creux, -RAMPE_MONDE.profondeur),
+    "l'ancre basse mondiale n'est plus celle d'avant la Tâche P11")
   assert.ok(Object.is(v.fondBudget, RAMPE_MONDE.profondeur))
   assert.ok(Object.is(v.plancherM, RAMPE_MONDE.plancherM))
   // et sur 2 001 hauteurs, la rampe rend le bit près de la rampe mondiale
   for (let i = 0; i <= 2000; i++) {
     const h = -6000 + i * 6
     assert.ok(Object.is(rampeT(h, v), rampeT(h, RAMPE_MONDE)), 'h=' + h)
   }
 })
 
 test('①e UNE SEULE ancre ⇒ la MÊME couleur à TOUTES les altitudes — le critère d’Adrien, exact', () => {
@@ -351,20 +383,21 @@ test('②c le GAIN LOCAL est conservé — on ne revient PAS à l’échelle mon
 const REPERE = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
 
 function faussGlobe(crop = REPERE, hauteur = () => 400) {
   const val = (v) => ({ value: v })
   return {
     _crop: crop,
     uniforms: {
       uLandBas: val(RAMPE_MONDE.terreBas),
       uLandMax: val(RAMPE_MONDE.terreHaut),
       uOceanDepth: val(RAMPE_MONDE.profondeur),
+      uReliefBas: val(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux),
       uPlancherRampeM: val(RAMPE_MONDE.plancherM),
       uMerFondBudgetM: val(RAMPE_MONDE.profondeur),
       uMerRampeOn: val(0),
       uMerZeroSousEau: val(0),
       uCropOn: val(1),
       uCropCentre: { value: { set() {} } },
       uCropDemi: val(1),
       uCropCoin: val(0),
       uCropCoinN: val(2),
     },
diff --git a/test/fond-crop.test.js b/test/fond-crop.test.js
index 3b8d5b7..156aa69 100644
--- a/test/fond-crop.test.js
+++ b/test/fond-crop.test.js
@@ -274,39 +274,45 @@ test('④ ter la TERRE ne bouge pas d’un bit quand un fond est posé', () => {
 // ══════════ ⑤ LA SONDE — parois, rampe, champ de repli ══════════════════════
 
 test('⑤ `hauteurSurface` rend le FOND en mer quand il est posé', () => {
   const t = tuileDeTest(12, -21.248422235627014, 55.7666015625, HAUTEURS_MER)
   const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
   const cote = 5
   const fond = {
     valeurs: new Float32Array(cote * cote).fill(-1500),
     cote, repere, portee: 3, bathy: true, profMaxM: 1500,
   }
-  const nu = { tuilesAvecHauteurs: () => [t], _fondCrop: null }
-  const garni = { tuilesAvecHauteurs: () => [t], _fondCrop: fond }
+  const nu = { tuilesAvecHauteurs: () => [t], _fondCrop: null, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
+  const garni = { tuilesAvecHauteurs: () => [t], _fondCrop: fond, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
   const lat = -21.248422235627014
   const lon = 55.7666015625
   assert.equal(Globe.prototype.hauteurSurface.call(nu, lat, lon), 0,
     'sans fond, la sonde lit la tuile — zéro, et c’est le défaut mesuré')
   assert.ok(Math.abs(Globe.prototype.hauteurSurface.call(garni, lat, lon) + 1500) < 1e-6,
     'avec le fond, les parois et la rampe voient la même surface que le maillage')
 })
 
 test('⑤ bis hors couverture, la sonde rend TOUJOURS `null`, fond ou pas', () => {
   const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
   const fond = {
     valeurs: new Float32Array(25).fill(-1500),
     cote: 5, repere, portee: 3, bathy: true, profMaxM: 1500,
   }
-  const garni = { tuilesAvecHauteurs: () => [], _fondCrop: fond }
+  const garni = { tuilesAvecHauteurs: () => [], _fondCrop: fond, _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine }
   assert.equal(Globe.prototype.hauteurSurface.call(garni, -21.25, 55.77), null,
     'un fond posé ne remplace pas une tuile absente : `null`, jamais zéro')
+  // ⚡ **ET LA SECONDE SONDE A LE MÊME CONTRAT — Tâche P11.** `hauteurDessinee`
+  // sert la PAROI ; si elle rendait zéro là où la tuile manque, le refus de
+  // couverture du §7 de `parois-crop.js` cesserait de mordre et le bloc
+  // reprendrait ses encoches au niveau de la mer.
+  assert.equal(Globe.prototype.hauteurDessinee.call(garni, -21.25, 55.77), null,
+    'la sonde du maillage doit rendre `null` elle aussi')
 })
 
 // ══════════ ⑥ LE REPÈRE DU CHAMP EST CELUI DE LA CALOTTE ════════════════════
 
 test('⑥ la grille du champ est régulière en MERCATOR, comme `remplirHauteurs`', () => {
   // `uvFond` suppose que le nœud (i, j) du champ tombe à la coordonnée locale
   // `-portee + 2·portee·i/(cote-1)`. C'est vrai si et seulement si la grille de
   // `remplirHauteurs` (régulière en mercator sur `boiteMerc(empriseCalotte)`)
   // coïncide avec le repère local du crop, qui est mercator lui aussi.
   const repere = repereCrop({ centre: { lat: -21.248422235627014, lon: 55.7666015625 }, zoom: 12 })
diff --git a/test/maillage-tuile.test.js b/test/maillage-tuile.test.js
new file mode 100644
index 0000000..064ca04
--- /dev/null
+++ b/test/maillage-tuile.test.js
@@ -0,0 +1,594 @@
+// LE MAILLAGE D'UNE TUILE — Tâche P11 du plan « LE STUDIO SUR LE GLOBE ».
+//
+// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
+//
+// Même partage que `crop-sphere`, `crop-parois`, `crop-rampe` et `fond-crop` :
+//   ① LA LOI vit dans un module PUR et se vérifie sous node ;
+//   ② LE DÉPÔT est confronté à cette loi en EXÉCUTANT son code, pas en
+//      cherchant un nom dedans — `_buildMesh` est appelé pour de vrai, sur une
+//      tuile factice, et l'on compare la surface qu'il POSE à celle que
+//      `interpolerMaille` PRÉDIT.
+//
+// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que la paroi et la surface coïncident À
+// L'ÉCRAN. Seul le banc le dit (`.banc/P11/m1-bord.js`), et son chiffre est dans
+// le compte rendu.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import { segmentsTuile, interpolerMaille } from '../src/monde/maillage-tuile.js'
+import { Globe, sampleHeights } from '../src/globe.js'
+import { altitudeMaillage } from '../src/monde/fond-crop.js'
+import { tileToLatLon, latLonToSphere, R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'
+import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
+import { contourCrop, PAS_CONTOUR, construireSolideCrop } from '../src/monde/parois-crop.js'
+import { echantillonnerFond } from '../src/monde/fond-crop.js'
+import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
+import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
+
+const SRC_GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+
+// ══════════ ① LA TABLE DES SEGMENTS — UNE SEULE ÉCRITURE ═══════════════════
+
+test('①a `segmentsTuile` rend la table du dépôt, cran par cran', () => {
+  // ⚠️ Les quatre paliers viennent de `gridFor`, DÉPLACÉE et non recopiée. Le
+  // commentaire d'origine explique le pourquoi des bas zooms : une tuile z3
+  // couvre 45 degrés et 24 segments y laissent des facettes sur le limbe.
+  for (const z of [0, 1, 2]) assert.equal(segmentsTuile(z), 64, 'z' + z)
+  assert.equal(segmentsTuile(3), 48)
+  for (const z of [4, 5]) assert.equal(segmentsTuile(z), 32, 'z' + z)
+  for (const z of [6, 11, 12, 22]) assert.equal(segmentsTuile(z), 24, 'z' + z)
+})
+
+test('①b `globe.js` NE RÉÉCRIT PAS la table — il l’importe', () => {
+  // ⛔ **C'EST LE TEST QUI EMPÊCHE LA DEUXIÈME ÉCRITURE.** Deux tables jumelles
+  // divergeraient en silence, et la paroi se poserait alors sur une grille que
+  // le maillage n'a pas — c'est-à-dire exactement le défaut que la Tâche P11
+  // répare. Un `grep` du nom ne suffirait pas : on exige l'IMPORT **et**
+  // l'absence des quatre paliers dans le fichier.
+  assert.match(SRC_GLOBE, /import \{[^}]*segmentsTuile[^}]*\} from '\.\/monde\/maillage-tuile\.js'/s)
+  assert.ok(!/function gridFor/.test(SRC_GLOBE), 'gridFor est resté dans globe.js')
+  assert.ok(!/z <= 3\) return 48/.test(SRC_GLOBE), 'la table des segments est réécrite dans globe.js')
+})
+
+// ══════════ ② L'INTERPOLATION — LES NŒUDS, PUIS LA DIAGONALE ═══════════════
+
+/** Une grille de hauteurs quelconque mais reproductible. */
+const grille = (G) => (i, j) => Math.sin(i * 0.7 + 1) * 100 + Math.cos(j * 1.1) * 60 + i * j * 0.3 + (i === 3 && j === 5 ? -900 : 0)
+
+test('②a aux QUATRE NŒUDS d’une cellule, l’interpolation rend la valeur du nœud', () => {
+  const G = 24
+  const h = grille(G)
+  for (const [i, j] of [[0, 0], [3, 5], [4, 6], [G - 1, G - 1], [G, G]]) {
+    const v = interpolerMaille(i / G, j / G, G, h)
+    assert.ok(Math.abs(v - h(i, j)) < 1e-9, `nœud (${i},${j}) : ${v} contre ${h(i, j)}`)
+  }
+})
+
+test('②b la surface est CONTINUE en travers de la diagonale du tampon d’indices', () => {
+  // ⛔ **LA DIAGONALE EST `b–c`, C'EST-À-DIRE `su + sv = 1`.** `_buildMesh`
+  // écrit `indices.push(a, c, b, b, c, d)`. Si l'on prenait l'autre diagonale,
+  // les deux formules ne se rejoindraient PAS sur cette droite — et le test
+  // ci-dessous le montre en la prenant vraiment.
+  const G = 24
+  const h = grille(G)
+  const eps = 1e-7
+  for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
+    const i = 3, j = 5
+    const av = interpolerMaille((i + s) / G, (j + 1 - s - eps) / G, G, h)
+    const ap = interpolerMaille((i + s) / G, (j + 1 - s + eps) / G, G, h)
+    assert.ok(Math.abs(av - ap) < 1e-3, `saut de ${Math.abs(av - ap)} sur la diagonale à s=${s}`)
+  }
+  // ⚠️ **ET LE TÉMOIN : L'AUTRE DIAGONALE, ELLE, SAUTE.** Sans lui ce test
+  // serait vert sur n'importe quelle interpolation lisse, et ne prouverait rien.
+  const autre = (tu, tv) => {
+    const fu = tu * G, fv = tv * G
+    const i = Math.floor(fu), j = Math.floor(fv)
+    const su = fu - i, sv = fv - j
+    const A = h(i, j), B = h(i + 1, j), C = h(i, j + 1), D = h(i + 1, j + 1)
+    return su >= sv ? B + (1 - su) * (A - B) + sv * (D - B) : C + su * (D - C) + (1 - sv) * (A - C)
+  }
+  const s = 0.5, i = 3, j = 5
+  const saut = Math.abs(autre((i + s) / G, (j + 1 - s - eps) / G) - interpolerMaille((i + s) / G, (j + 1 - s - eps) / G, G, h))
+  assert.ok(saut > 100, `les deux diagonales ne se distinguent pas (${saut} m) — le test ne prouve rien`)
+})
+
+test('②c elle LISSE ce que la donnée porte entre deux nœuds — c’est le sujet', () => {
+  // ⚡ **C'EST LA PROPRIÉTÉ QU'ON VEUT, PAS UN DÉFAUT QU'ON TOLÈRE.** Une ravine
+  // qui tombe ENTRE deux nœuds n'est pas dessinée : le GPU tend une corde
+  // par-dessus. La paroi doit suivre CETTE corde, sinon la surface pend
+  // par-dessus son arête haute.
+  const G = 24
+  const plat = () => 1000
+  const ravine = (i, j) => (i === 4 && j === 5 ? 100 : 1000)
+  // au milieu de la cellule (3,5) : le nœud creux est un COIN de la cellule
+  // voisine, donc la corde le voit ; au milieu de (1,1) il n'existe pas.
+  assert.equal(interpolerMaille(1.5 / G, 1.5 / G, G, ravine), plat())
+  const auCoin = interpolerMaille(4 / G, 5 / G, G, ravine)
+  assert.equal(auCoin, 100, 'le nœud creux lui-même doit être rendu exactement')
+})
+
+test('②d un `G` non entier ou nul ne fabrique pas de NaN', () => {
+  // ⚠️ Un `NaN` dans une position de sommet ne lève RIEN — il fabrique une
+  // géométrie invisible et une boîte englobante vide. Même doctrine que le
+  // plancher de division de `rampe-crop.js`.
+  const h = grille(24)
+  for (const G of [1, 0, -3, 24.4, 23.6]) {
+    const v = interpolerMaille(0.37, 0.62, G, h)
+    assert.ok(Number.isFinite(v), `G=${G} rend ${v}`)
+  }
+  for (const q of [-1, 0, 1, 2]) {
+    assert.ok(Number.isFinite(interpolerMaille(q, q, 24, h)), 'q=' + q)
+  }
+  // ⛔ **ET LE PLANCHER `Math.max(1, …)` A UN EFFET, UNE SURVIVANTE L'A DIT.**
+  // Sans lui, `G = 0` rend `i = -1` : la loi lit un nœud QUI N'EXISTE PAS, à
+  // l'extérieur de la tuile. Le rendu reste fini — donc « pas de NaN » ne
+  // prouvait rien — mais ce n'est plus la surface. Avec le plancher, un `G`
+  // dégénéré rend la MÊME chose qu'une grille à une seule cellule.
+  for (const G of [0, -3, 0.4]) {
+    assert.equal(interpolerMaille(0.37, 0.62, G, h), interpolerMaille(0.37, 0.62, 1, h), 'G=' + G)
+  }
+  assert.notEqual(interpolerMaille(0.37, 0.62, 1, h), h(-1, -1), 'le témoin est vide')
+})
+
+// ══════════ ③ LE DÉPÔT, EXÉCUTÉ — `_buildMesh` CONTRE LA LOI ═══════════════
+
+/** Une tuile terrarium factice : un relief à haute fréquence, encodé exactement. */
+function tuileFactice(size = 256, f = (u, v) => 1200 + 900 * Math.sin(u * 37) * Math.cos(v * 41)) {
+  const heights = new Float32Array(size * size)
+  for (let y = 0; y < size; y++) {
+    for (let x = 0; x < size; x++) heights[y * size + x] = f((x + 0.5) / size, (y + 0.5) / size)
+  }
+  return { heights, size }
+}
+
+test('③a `interpolerMaille` REND LA SURFACE QUE `_buildMesh` POSE — flèche mesurée, pas supposée', () => {
+  // ⚠️ **ON APPELLE `_buildMesh` POUR DE VRAI**, avec le `this` minimal qu'il
+  // lit — le patron de la Tâche B (« `hauteurSurface` n'était testée que par un
+  // `grep` de son nom »).
+  const z = 12, tx = 2094, ty = 2270
+  const { heights, size } = tuileFactice()
+  const t = { z, x: tx, y: ty, heights, size, texture: null, chord: 0.15 }
+  const faux = {
+    exaggeration: 2,
+    _fondCrop: null,
+    group: { add() {} },
+    _materialFor: () => ({}),
+    _retaillerJupe: () => false,
+    tiles: new Map(),
+  }
+  Globe.prototype._buildMesh.call(faux, t)
+  const geo = t.mesh.geometry
+  const pos = geo.attributes.position.array
+  const G = segmentsTuile(z)
+  const dispScale = (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration
+  const noeud = (i, j) => altitudeMaillage(sampleHeights(heights, i / G, j / G, size), null)
+
+  // ⚡ **LA COMPARAISON EST FAITE SUR LA GÉOMÉTRIE, PAS SUR UNE FORMULE.** On
+  // prend le milieu d'une cellule, on interpole les POSITIONS 3D comme le GPU,
+  // et on confronte le rayon obtenu à celui que la loi prédit.
+  const P = (s) => [pos[s * 3] + t.mesh.position.x, pos[s * 3 + 1] + t.mesh.position.y, pos[s * 3 + 2] + t.mesh.position.z]
+  let pire = 0
+  for (const [i, j] of [[0, 0], [5, 7], [11, 3], [G - 1, G - 1], [17, 20]]) {
+    for (const [su, sv] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.1], [0.1, 0.75], [0.9, 0.9]]) {
+      const a = P(j * (G + 1) + i)
+      const b = P(j * (G + 1) + i + 1)
+      const c = P((j + 1) * (G + 1) + i)
+      const d = P((j + 1) * (G + 1) + i + 1)
+      const gpu = su + sv <= 1
+        ? [0, 1, 2].map((k) => a[k] + su * (b[k] - a[k]) + sv * (c[k] - a[k]))
+        : [0, 1, 2].map((k) => d[k] + (1 - su) * (c[k] - d[k]) + (1 - sv) * (b[k] - d[k]))
+      const rayonGpu = Math.hypot(gpu[0], gpu[1], gpu[2])
+      const hGpu = (rayonGpu - R_GLOBE) / dispScale
+      const hLoi = interpolerMaille((i + su) / G, (j + sv) / G, G, noeud)
+      pire = Math.max(pire, Math.abs(hGpu - hLoi))
+    }
+  }
+  // ⚠️ **LA BORNE EST LA FLÈCHE DE LA CORDE, ET ELLE EST DÉRIVÉE, PAS CHOISIE** :
+  // `d² / (8 R)` avec `d` le côté de la cellule (une tuile z12 fait 9 780 m à
+  // l'équateur, divisée par 24 : 407 m) et `R = 6 371 km` — soit **3,3 mm**.
+  // Un centimètre laisse la place à l'arrondi float32 des positions.
+  const cote = (40075016.686 / 2 ** z) / G
+  const fleche = (cote * cote) / (8 * EARTH_RADIUS_M)
+  assert.ok(fleche < 0.01, 'la flèche théorique vaut ' + fleche + ' m')
+  assert.ok(pire < 0.01, `la loi s’écarte de la géométrie de ${pire} m (flèche théorique ${fleche} m)`)
+  // ⚡ **ET LE TÉMOIN : LA TEXTURE, ELLE, S'EN ÉCARTE DE PLUSIEURS CENTAINES DE
+  // MÈTRES.** Sans lui, ③a serait vert sur n'importe quelle loi assez lisse.
+  let ecartTexture = 0
+  for (const [i, j] of [[5, 7], [11, 3], [17, 20]]) {
+    const u = (i + 0.5) / G, v = (j + 0.5) / G
+    ecartTexture = Math.max(ecartTexture, Math.abs(
+      sampleHeights(heights, u, v, size) - interpolerMaille(u, v, G, noeud),
+    ))
+  }
+  assert.ok(ecartTexture > 100, `la texture et le maillage ne se distinguent pas (${ecartTexture} m) — le témoin est vide`)
+})
+
+test('③b `latLonToSphere` du dépôt confirme la flèche — la corde passe SOUS l’arc', () => {
+  // ⚠️ **LE SIGNE COMPTE** : la corde d'un arc passe toujours SOUS lui. C'est ce
+  // qui borne l'écart PAR EN DESSOUS et interdit à la paroi de dépasser la
+  // surface pour cette raison-là.
+  const z = 12, G = segmentsTuile(z)
+  const a = tileToLatLon(2094, 2270, z)
+  const b = tileToLatLon(2094 + 1 / G, 2270, z)
+  const pa = latLonToSphere(a.lat, a.lon, R_GLOBE)
+  const pb = latLonToSphere(b.lat, b.lon, R_GLOBE)
+  const milieu = [(pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2]
+  const r = Math.hypot(milieu[0], milieu[1], milieu[2])
+  assert.ok(r < R_GLOBE, 'la corde devrait passer sous la sphère')
+  const enMetres = (R_GLOBE - r) * (EARTH_RADIUS_M / R_GLOBE)
+  assert.ok(enMetres > 0 && enMetres < 0.02, 'flèche mesurée : ' + enMetres + ' m')
+})
+
+// ══════════ ④ `hauteurDessinee` — LA SURFACE, PAS LA DONNÉE ════════════════
+
+/** Le globe minimal que les deux sondes lisent. */
+function globePourSondes({ z = 12, tx = 2094, ty = 2270, f } = {}) {
+  const { heights, size } = tuileFactice(256, f)
+  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
+  return {
+    _fondCrop: null,
+    tiles: new Map([[t.key, t]]),
+    tuilesAvecHauteurs: () => [t],
+    hauteurSurface: Globe.prototype.hauteurSurface,
+    hauteurDessinee: Globe.prototype.hauteurDessinee,
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+    tuile: t,
+  }
+}
+
+test('④a `hauteurDessinee` rend la CORDE du maillage là où `hauteurSurface` rend la DONNÉE', () => {
+  // ⛔ **C'EST TOUT LE DÉFAUT DU NOTEUR, RÉDUIT À DEUX APPELS.** On fabrique une
+  // tuile PLATE percée d'une ravine d'un seul texel : le maillage (24 quads pour
+  // 256 texels) ne peut pas la voir, la texture la voit en entier.
+  const size = 256
+  // ⚠️ **AU MILIEU D'UNE CELLULE, PAS SUR UN NŒUD** : `0,5` tombe EXACTEMENT sur
+  // le nœud 12 d'une grille de 24, où le maillage LIT la texture. Le centre de
+  // la cellule (12, 12) est à `12,5 / 24`, et c'est là que la corde passe.
+  const CIBLE = 12.5 / 24
+  const creux = (u, v) => (Math.abs(u - CIBLE) < 1.5 / size && Math.abs(v - CIBLE) < 1.5 / size ? 100 : 1000)
+  const g = globePourSondes({ f: creux })
+  const t = g.tuile
+  const { lat, lon } = tileToLatLon(t.x + CIBLE, t.y + CIBLE, t.z)
+  const liste = g.tuilesAvecHauteurs()
+  const texture = g.hauteurSurface(lat, lon, liste)
+  const dessinee = g.hauteurDessinee(lat, lon, liste)
+  assert.ok(texture < 400, 'la texture doit voir la ravine, elle rend ' + texture)
+  assert.ok(dessinee > 990, 'le maillage ne peut PAS la voir, il rend ' + dessinee)
+  assert.ok(Math.abs(texture - dessinee) > 500, 'les deux sondes ne se distinguent pas')
+})
+
+test('④b sur un NŒUD du maillage, les deux sondes se rejoignent', () => {
+  // ⚠️ **LE TÉMOIN INVERSE, ET IL EST OBLIGATOIRE** : sans lui, ④a serait vert
+  // sur une sonde qui rendrait n'importe quoi. Au nœud, le maillage LIT la
+  // texture par `sampleHeights`, donc les deux valent le même nombre.
+  const g = globePourSondes()
+  const t = g.tuile
+  const G = segmentsTuile(t.z)
+  const liste = g.tuilesAvecHauteurs()
+  for (const [i, j] of [[6, 9], [12, 12], [23, 4]]) {
+    const { lat, lon } = tileToLatLon(t.x + i / G, t.y + j / G, t.z)
+    const a = g.hauteurSurface(lat, lon, liste)
+    const b = g.hauteurDessinee(lat, lon, liste)
+    assert.ok(Math.abs(a - b) < 1e-6, `nœud (${i},${j}) : ${a} contre ${b}`)
+  }
+})
+
+test('④c hors de toute tuile, elle rend `null` — JAMAIS zéro', () => {
+  // ⚠️ **LE §7 DE `parois-crop.js`, APPLIQUÉ À LA SECONDE SONDE** : « zéro est le
+  // NIVEAU DE LA MER, et le confondre avec je ne sais pas creuse une encoche
+  // dans la paroi ». La nouvelle sonde a exactement le même contrat que
+  // l'ancienne, sinon la garde de couverture ne mordrait plus.
+  const g = globePourSondes()
+  assert.equal(g.hauteurDessinee(0, 0, g.tuilesAvecHauteurs()), null)
+  assert.equal(g.hauteurSurface(0, 0, g.tuilesAvecHauteurs()), null)
+})
+
+// ══════════ ⑤ LE BRANCHEMENT — EXÉCUTÉ, PAS CHERCHÉ ═══════════════════════
+
+test('⑤a `construireParoisCrop` POSE SON ANNEAU SUR `hauteurDessinee` — et pas une fois sur `hauteurSurface`', () => {
+  // ⚠️ **UNE ASSERTION DE TEXTE SERAIT VERTE LE JOUR OÙ QUELQU'UN ÉCRIT LE NOM
+  // DANS UN COMMENTAIRE.** On appelle donc la méthode et on COMPTE les appels.
+  const { heights, size } = tuileFactice()
+  const z = 12, tx = 2094, ty = 2270
+  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
+  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
+  const repere = repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 })
+  let nDessinee = 0
+  let nSurface = 0
+  const faux = {
+    _crop: repere,
+    _fondCrop: null,
+    _parois: null,
+    _baseYCrop: null,
+    exaggeration: 2,
+    tiles: new Map([[t.key, t]]),
+    tuilesAvecHauteurs: () => [t],
+    uniforms: {
+      uCropCoin: { value: 0.08 },
+      uCropCoinN: { value: 4.4 },
+    },
+    group: { add() {}, remove() {} },
+    hauteurSurface(...a) { nSurface++; return Globe.prototype.hauteurSurface.apply(this, a) },
+    hauteurDessinee(...a) { nDessinee++; return Globe.prototype.hauteurDessinee.apply(this, a) },
+    _retaillerJupes: () => 0,
+    _materiauParois: () => null,
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+  }
+  let sorti = null
+  try {
+    sorti = Globe.prototype.construireParoisCrop.call(faux, {})
+  } catch (e) {
+    // la géométrie three peut ne pas se monter dans ce stub ; ce qui compte est
+    // ce qui a été APPELÉ avant, et l'anneau est bâti en tout premier
+    sorti = 'levee: ' + e.message
+  }
+  assert.ok(nDessinee > 500, `l'anneau n'a lu la surface DESSINÉE que ${nDessinee} fois`)
+  assert.equal(nSurface, 0, `⛔ la paroi lit encore la texture : ${nSurface} appels`)
+  assert.ok(sorti !== null)
+})
+
+test('⑤b `poserRampe`, LUI, RESTE SUR `hauteurSurface` — la couleur lit la DONNÉE', () => {
+  // ⚡ **LES DEUX QUESTIONS SONT DIFFÉRENTES, ET LES CONFONDRE EST CE QUI A
+  // PRODUIT LE DRAPÉ.** Le nuanceur colore par `decodeMetersAA(vUv)`, c'est-à-dire
+  // à la résolution de la TEXTURE ; la rampe doit donc mesurer le relief à cette
+  // résolution-là. La paroi, elle, est de la GÉOMÉTRIE. Une mutation qui
+  // basculerait les deux d'un coup meurt ici.
+  const { heights, size } = tuileFactice()
+  const z = 12, tx = 2094, ty = 2270
+  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
+  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
+  let nSurface = 0
+  let nDessinee = 0
+  let nListe = 0
+  const faux = {
+    _crop: repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 }),
+    _fondCrop: null,
+    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
+    _rampe: null,
+    tiles: new Map([[t.key, t]]),
+    tuilesAvecHauteurs: () => { nListe++; return [t] },
+    uniforms: {
+      uCropCoin: { value: 0.08 },
+      uCropCoinN: { value: 4.4 },
+      uLandBas: { value: 0 }, uLandMax: { value: 5600 },
+      uOceanDepth: { value: 6000 }, uReliefBas: { value: -6000 },
+      uPlancherRampeM: { value: 0 }, uMerZeroSousEau: { value: 0 },
+      uMerRampeOn: { value: 0 }, uMerFondBudgetM: { value: 6000 },
+    },
+    hauteurSurface(...a) { nSurface++; return Globe.prototype.hauteurSurface.apply(this, a) },
+    hauteurDessinee(...a) { nDessinee++; return Globe.prototype.hauteurDessinee.apply(this, a) },
+    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+  }
+  const r = Globe.prototype.poserRampe.call(faux, {})
+  assert.equal(r.refus, null, JSON.stringify(r))
+  assert.ok(nSurface > 500, `la rampe n'a lu la texture que ${nSurface} fois`)
+  assert.equal(nDessinee, 0, `⛔ la rampe a basculé sur le maillage : ${nDessinee} appels`)
+  // ⚠️ **ET LA LISTE EST PRÉ-FILTRÉE UNE FOIS ICI AUSSI** — une survivante l’a
+  // demandé : `hauteurSurface` qui jette le `candidates` qu’on lui passe reste
+  // correcte et reparcourt `this.tiles` à chacun des `pas²` points.
+  assert.equal(nListe, 1, 'la liste de tuiles a été rebâtie ' + nListe + ' fois')
+})
+
+// ══════════ ⑥ CE QUE CINQ SURVIVANTES ONT DEMANDÉ ══════════════════════════
+
+test('⑥a la sonde du maillage ÉCRÊTE la mer comme le maillage, pas comme la sonde', () => {
+  // ⛔ **UNE SURVIVANTE A TROUVÉ CE TROU.** `altitudeMaillage` rend
+  // `Math.max(h, 0)` quand aucun fond n'est posé (« oceans stay on the sphere »),
+  // `altitudeSonde` rend la valeur BRUTE, négatifs du terrarium compris. Une
+  // paroi posée sur la seconde passerait SOUS sa propre surface tout le long
+  // d'un littoral — c'est le §4 de `parois-crop.js`, dans l'autre sens.
+  const g = globePourSondes({ f: () => -500 })
+  const t = g.tuile
+  const { lat, lon } = tileToLatLon(t.x + 0.4, t.y + 0.6, t.z)
+  const liste = g.tuilesAvecHauteurs()
+  assert.equal(g.hauteurDessinee(lat, lon, liste), 0, 'le maillage écrête la mer à zéro')
+  assert.ok(g.hauteurSurface(lat, lon, liste) < -400, 'la sonde, elle, rend le brut')
+})
+
+test('⑥b le FOND MARIN est lu AU NŒUD, pas au point demandé', () => {
+  // ⛔ **UNE SURVIVANTE ENCORE.** `_buildMesh` interroge le champ du fond à la
+  // position de CHAQUE SOMMET ; lire le fond au point demandé rendrait un fond
+  // CONSTANT sur toute la cellule — une seconde loi, qui diverge de la première
+  // dès que le fond a du relief. La tuile est toute en mer, donc c'est le champ
+  // qui décide, et lui seul.
+  // ⚠️ **LE CHAMP DOIT ÊTRE PLUS FIN QUE LE MAILLAGE, SINON LES DEUX LOIS SONT
+  // LA MÊME.** `echantillonnerFond` est bilinéaire : sur une cellule de maillage
+  // qui tient DANS une cellule de champ, l'interpolation des nœuds rend le point
+  // exactement (mesuré : 2·10⁻⁹ d'écart). Le champ fait donc 129 nœuds pour les
+  // 24 quads de la tuile, et il ondule.
+  const cote = 129
+  const g = globePourSondes({ f: () => -1 })
+  const t = g.tuile
+  const centre = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
+  const repere = repereCrop({ centre, zoom: t.z, tuilesParBloc: 1 })
+  const valeurs = new Float32Array(cote * cote)
+  for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) valeurs[j * cote + i] = -900 - 800 * Math.sin(i * 1.9) * Math.cos(j * 2.3)
+  g._fondCrop = { valeurs, cote, repere, portee: 0.5, bathy: true, profMaxM: 3400 }
+  const G = segmentsTuile(t.z)
+  const liste = g.tuilesAvecHauteurs()
+  // un point au MILIEU d'une cellule : la loi doit rendre l'interpolation des
+  // NŒUDS, jamais le fond du point lui-même.
+  const { lat, lon } = tileToLatLon(t.x + 6.5 / G, t.y + 6.5 / G, t.z)
+  const rendu = g.hauteurDessinee(lat, lon, liste)
+  const auNoeud = (i, j) => {
+    const p = tileToLatLon(t.x + i / G, t.y + j / G, t.z)
+    return g.hauteurDessinee(p.lat, p.lon, liste)
+  }
+  const attendu = interpolerMaille(6.5 / G, 6.5 / G, G, auNoeud)
+  assert.ok(Math.abs(rendu - attendu) < 1e-6, rendu + ' contre ' + attendu)
+  // ⚠️ **ET LE TÉMOIN : LE FOND DU POINT LUI-MÊME EST DIFFÉRENT.** Sans lui, ce
+  // test serait vert sur les deux lois.
+  const auPoint = Math.min(echantillonnerFond(g._fondCrop, lat, lon), 0)
+  assert.ok(Math.abs(auPoint - rendu) > 5, 'les deux lois ne se distinguent pas (' + auPoint + ' contre ' + rendu + ')')
+})
+
+test('⑥c la surface que `_buildMesh` POSE est EXACTEMENT celle que `hauteurDessinee` REND', () => {
+  // ⚡ **C'EST L'INVARIANT SUR LEQUEL TOUTE LA TÂCHE REPOSE, ET IL APPARIE LES
+  // DEUX CÔTÉS.** ③a comparait la géométrie à `interpolerMaille` avec un `G`
+  // choisi par le TEST : une mutation qui changeait la grille d'UN SEUL des deux
+  // côtés y survivait. Ici les deux lectures viennent du dépôt, et la moindre
+  // divergence de grille, de loi de nœud ou de diagonale tue.
+  const z = 12, tx = 2094, ty = 2270
+  const { heights, size } = tuileFactice()
+  const t = { z, x: tx, y: ty, heights, size, texture: null, chord: 0.15, key: z + '/' + tx + '/' + ty }
+  const faux = {
+    exaggeration: 2,
+    _fondCrop: null,
+    group: { add() {} },
+    _materialFor: () => ({}),
+    _retaillerJupe: () => false,
+    tiles: new Map([[t.key, t]]),
+    // ⚠️ **UNE COPIE, PARCE QUE `_buildMesh` RELÂCHE `t.heights`** (256 Kio par
+    // tuile, 105 Mo à 420 tuiles en cache — son commentaire le dit). La sonde,
+    // elle, les relit : dans l'application elle tourne AVANT la libération.
+    tuilesAvecHauteurs: () => [{ ...t, heights }],
+    hauteurDessinee: Globe.prototype.hauteurDessinee,
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+  }
+  Globe.prototype._buildMesh.call(faux, t)
+  const pos = t.mesh.geometry.attributes.position.array
+  const G = segmentsTuile(z)
+  const dispScale = (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration
+  const liste = faux.tuilesAvecHauteurs()
+  const P = (s) => [pos[s * 3] + t.mesh.position.x, pos[s * 3 + 1] + t.mesh.position.y, pos[s * 3 + 2] + t.mesh.position.z]
+  let pire = 0
+  // ⚠️ **LES NŒUDS DE BORD `i = G` OU `j = G` NE SONT PAS TESTÉS, ET C'EST UNE
+  // CONVENTION DU DÉPÔT, PAS UN OUBLI** : ils tombent exactement sur `tx + 1`,
+  // c'est-à-dire dans la tuile VOISINE, et `_tuileLaPlusFine` la leur attribue
+  // (l'intervalle est semi-ouvert, `tx < 1`). Les deux tuiles y lisent leur
+  // propre texel de bord — la couture de niveau que la Tâche K documente déjà.
+  for (const [i, j] of [[0, 0], [5, 7], [11, 3], [G - 1, G - 1], [17, 20], [G - 1, 0]]) {
+    const { lat, lon } = tileToLatLon(tx + i / G, ty + j / G, z)
+    const a = P(j * (G + 1) + i)
+    const hGpu = (Math.hypot(a[0], a[1], a[2]) - R_GLOBE) / dispScale
+    pire = Math.max(pire, Math.abs(hGpu - faux.hauteurDessinee(lat, lon, liste)))
+  }
+  assert.ok(pire < 0.02, "la sonde s'écarte des SOMMETS de " + pire + ' m')
+  // et au MILIEU des cellules, où l'interpolation travaille
+  for (const [i, j] of [[5, 7], [11, 3], [17, 20]]) {
+    for (const [su, sv] of [[0.25, 0.25], [0.5, 0.5], [0.9, 0.9]]) {
+      const { lat, lon } = tileToLatLon(tx + (i + su) / G, ty + (j + sv) / G, z)
+      const a = P(j * (G + 1) + i), b = P(j * (G + 1) + i + 1)
+      const c = P((j + 1) * (G + 1) + i), d = P((j + 1) * (G + 1) + i + 1)
+      const gpu = su + sv <= 1
+        ? [0, 1, 2].map((k) => a[k] + su * (b[k] - a[k]) + sv * (c[k] - a[k]))
+        : [0, 1, 2].map((k) => d[k] + (1 - su) * (c[k] - d[k]) + (1 - sv) * (b[k] - d[k]))
+      const hGpu = (Math.hypot(gpu[0], gpu[1], gpu[2]) - R_GLOBE) / dispScale
+      pire = Math.max(pire, Math.abs(hGpu - faux.hauteurDessinee(lat, lon, liste)))
+    }
+  }
+  assert.ok(pire < 0.02, "la sonde s'écarte de la SURFACE de " + pire + ' m')
+})
+
+test('⑤c la paroi appelle la sonde AVEC LA LATITUDE EN PREMIER, et ne refait pas la liste', () => {
+  // ⛔ **DEUX SURVIVANTES DANS UN SEUL TEST.** ⑤a comptait les appels ; il ne
+  // regardait ni leurs ARGUMENTS (lat et lon échangés survivaient) ni le nombre
+  // de fois que la LISTE de tuiles était rebâtie (l'anneau fait plus de mille
+  // points, et `this.tiles` peut porter 1 700 entrées : deux millions
+  // d'itérations pour une géométrie bâtie à l'arrêt).
+  const { heights, size } = tuileFactice()
+  const z = 12, tx = 2094, ty = 2270
+  const t = { z, x: tx, y: ty, heights, size, key: z + '/' + tx + '/' + ty }
+  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
+  const repere = repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 })
+  const vus = []
+  let nListe = 0
+  const faux = {
+    _crop: repere,
+    _fondCrop: null,
+    _parois: null,
+    _baseYCrop: null,
+    exaggeration: 2,
+    tiles: new Map([[t.key, t]]),
+    tuilesAvecHauteurs: () => { nListe++; return [t] },
+    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
+    group: { add() {}, remove() {} },
+    hauteurDessinee(la, lo, liste) { vus.push([la, lo]); return Globe.prototype.hauteurDessinee.call(this, la, lo, liste) },
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+    _retaillerJupes: () => 0,
+  }
+  try {
+    Globe.prototype.construireParoisCrop.call(faux, {})
+  } catch {
+    // la géométrie three peut ne pas se monter dans ce stub ; ce qui compte est
+    // ce qui a été APPELÉ avant, et l'anneau est bâti en tout premier
+  }
+  assert.ok(vus.length > 500, 'la sonde a été appelée ' + vus.length + ' fois')
+  // ⚡ **L'ORDRE DES ARGUMENTS, PROUVÉ CONTRE `latLonDeLocal` DU DÉPÔT.**
+  const anneau = contourCrop(0.08, 4.4, PAS_CONTOUR)
+  const attendu = latLonDeLocal(anneau[0].u, anneau[0].v, repere)
+  assert.ok(Math.abs(vus[0][0] - attendu.lat) < 1e-9, 'premier argument ' + vus[0][0] + ', latitude attendue ' + attendu.lat)
+  assert.ok(Math.abs(vus[0][1] - attendu.lon) < 1e-9, 'second argument ' + vus[0][1] + ', longitude attendue ' + attendu.lon)
+  // ⚠️ **ET LE TÉMOIN : LES DEUX NE SONT PAS INTERCHANGEABLES ICI.**
+  assert.ok(Math.abs(attendu.lat - attendu.lon) > 1, 'lat et lon trop proches — le test ne prouverait rien')
+  // ⚠️ **LA LISTE EST PRÉ-FILTRÉE UNE FOIS, ET C'EST ÉCRIT DANS LE DÉPÔT.**
+  assert.equal(nListe, 1, 'la liste de tuiles a été rebâtie ' + nListe + ' fois')
+})
+
+test('⑥d le FOND MARIN entre bien dans la sonde du maillage — la mer, pas la sphère', () => {
+  // ⛔ **UNE SURVIVANTE ENCORE, ET ⑥b NE POUVAIT PAS LA VOIR** : il comparait la
+  // sonde À ELLE-MÊME (l'attendu était construit avec `hauteurDessinee` aux
+  // nœuds), donc débrancher le fond des DEUX côtés le laissait vert. Ici
+  // l'attendu est un NOMBRE, et il vient du champ.
+  const cote = 5
+  const g = globePourSondes({ f: () => -1 })
+  const t = g.tuile
+  const centre = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
+  const repere = repereCrop({ centre, zoom: t.z, tuilesParBloc: 1 })
+  const liste = g.tuilesAvecHauteurs()
+  const { lat, lon } = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
+  // sans fond, la tuile dit « mer » et `altitudeMaillage` la pose SUR la sphère
+  assert.equal(g.hauteurDessinee(lat, lon, liste), 0)
+  g._fondCrop = { valeurs: new Float32Array(cote * cote).fill(-1500), cote, repere, portee: 0.5, bathy: true, profMaxM: 1500 }
+  assert.ok(Math.abs(g.hauteurDessinee(lat, lon, liste) + 1500) < 1e-6,
+    'avec un fond posé, la paroi doit descendre AVEC la surface : ' + g.hauteurDessinee(lat, lon, liste))
+})
+
+test('⑤d le fond du bloc retenu EST celui du solide — exécuté, pas cherché', () => {
+  // ⛔ **UNE SURVIVANTE A DÉMASQUÉ UNE ASSERTION DE NOM.** `test/mer-sphere.test.js`
+  // ⑫h exigeait `/this\._baseYCrop = solide\.baseY/` : la mutation
+  // `solide.baseY * 2` passait à travers, et avec elle le fond du rideau d'eau
+  // (Tâche P4) ET le plancher des jupes (Tâche P7), qui le lisent tous les deux.
+  // Ce chemin-ci n'est pas de la Tâche P11 — il est SOUS elle, et c'est
+  // précisément pour ça qu'il fallait le tenir.
+  const { heights, size } = tuileFactice()
+  const z = 12, tx = 2094, ty = 2270
+  const t = { z, x: tx, y: ty, heights, size, key: z + '/' + tx + '/' + ty }
+  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
+  const repere = repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 })
+  const faux = {
+    _crop: repere,
+    _fondCrop: null,
+    _parois: null,
+    _baseYCrop: null,
+    exaggeration: 2,
+    tiles: new Map([[t.key, t]]),
+    tuilesAvecHauteurs: () => [t],
+    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
+    group: { add() {}, remove() {} },
+    hauteurDessinee: Globe.prototype.hauteurDessinee,
+    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
+    _retaillerJupes: () => 0,
+    retirerParoisCrop() { this._parois = null },
+    _materiauParois: () => null,
+  }
+  let leve = null
+  try { Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0 }) } catch (e) { leve = e }
+  // le même solide, bâti à part : c'est LUI l'oracle, pas une expression recopiée
+  const attendu = construireSolideCrop({
+    repere,
+    forme: { coin: 0.08, expo: 4.4 },
+    hauteur: (la, lo) => faux.hauteurDessinee(la, lo, [t]),
+    rayon: R_GLOBE,
+    echelle: (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration,
+    plancherMer: 0,
+    couvertureMin: 0,
+  })
+  assert.equal(attendu.refus, null, JSON.stringify(attendu.refus))
+  assert.ok(Number.isFinite(attendu.baseY) && attendu.baseY < 0, 'baseY ' + attendu.baseY)
+  assert.ok(Object.is(faux._baseYCrop, attendu.baseY),
+    'le fond retenu vaut ' + faux._baseYCrop + ', le solide dit ' + attendu.baseY + (leve ? ' (levée : ' + leve.message + ')' : ''))
+})
