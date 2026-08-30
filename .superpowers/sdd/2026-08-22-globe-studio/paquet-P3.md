0700848 tache P3 : le bloc du globe devient un materiau eclaire

 package.json                  |   2 +-
 src/globe.js                  | 479 +++++++++++++++++++++++++-
 src/main.js                   | 112 +++++++
 src/monde/branchement-crop.js |  66 ++++
 src/monde/eclairage-crop.js   | 361 ++++++++++++++++++++
 src/monde/melange-crop.js     | 104 ++++++
 src/sonde-ambiante.js         | 215 ++++++++++++
 src/terrain.js                |  60 ++--
 test/crop-eclairage.test.js   | 759 ++++++++++++++++++++++++++++++++++++++++++
 test/crop-habillage.test.js   |  55 ++-
 test/crop-naturel.test.js     |  29 +-
 test/fenetre-branchee.test.js |  18 +-
 12 files changed, 2203 insertions(+), 57 deletions(-)

diff --git a/package.json b/package.json
index d55dcdb..163f278 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js test/crop-eclairage.test.js",
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
index 6bc7ae9..5810a8c 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -89,20 +89,42 @@ import { loiTextureMonde, GRAIN_PAR_PIXEL, METRES_PAR_DEGRE } from './monde/loi-
 // `crop-sphere.js`, pur) : il ne rend que des nombres, et c'est ce fichier-ci
 // qui décide QUAND les lire. Son en-tête porte les mesures qui le fondent.
 import { altitudeMaillage, altitudeSonde, echantillonnerFond, cleFond } from './monde/fond-crop.js'
 // ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
 //
 // ⚠️ **CE N'EST PAS UNE COPIE DU SOCLE, C'EST LE MÊME TEXTE.** `terrain.js`
 // injecte `GLSL_NATUREL` dans SON fragment et ce fichier dans LE SIEN : il n'y a
 // qu'une seule écriture du peigné, de l'humidité, du pivot et du voile aérien.
 // `test/crop-naturel.test.js` interdit qu'une de ces formules soit réécrite ici.
 import { GLSL_NATUREL, NATUREL_MONDE } from './monde/naturel-crop.js'
+// ══════ LA COUCHE APPARENCE — Tâche P3 ══════════════════════════════
+// `FX_GLSL` était déjà partagé entre `terrain.js` et les vignettes du panneau ;
+// le crop en est le troisième lecteur. `GLSL_MELANGE` ferme une dette plus
+// ancienne : `blLum`/`blClip`/`blSetLum` étaient écrits DEUX fois, ici et dans
+// `terrain.js`, chacun avec un commentaire annonçant la divergence.
+import { FX_GLSL } from './fx-glsl.js'
+import { GLSL_MELANGE, APPARENCE_MONDE } from './monde/melange-crop.js'
+// ══════════ L'ÉCLAIRAGE DU CROP — Tâche P3 ═════════════════════════════════
+//
+// > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
+// > tuile du globe est une COULEUR NUE. »
+//
+// Même patron que `naturel-crop.js` juste au-dessus : la loi vit dans un module
+// PUR qui porte son propre texte GLSL, et ce fichier l'INJECTE. Il n'y a donc
+// pas deux écritures de l'éclairage à garder d'accord.
+import {
+  GLSL_ECLAIRAGE,
+  ECLAIRAGE_MONDE,
+  directionSoleilLocale,
+  hautLocal,
+  irradianceAmbiante,
+} from './monde/eclairage-crop.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -765,20 +787,72 @@ uniform float uTreeLine;   // en hNorm : au-dessus, plus de vegetation
 // rampDry, rampWet et rampOklab arrivent sur la sphere SANS un seul uniforme.
 uniform sampler2D uRampCrop;
 uniform float uRampCropOn;
 uniform float uHeightContrast; // le contraste de rampe du socle
 uniform float uHeightPivot;    // son pivot, en hNorm
 uniform float uHazeAmt;        // perspective aerienne (Imhof) — force globale
 uniform float uHazeAlt;
 uniform float uHazeDist;
 uniform vec3 uHazeColor;
 
+// ══════ L'ECLAIRAGE DU CROP — Tache P3 ═════════════════════════════════════
+//
+// ⚠️ uEclairageOn VAUT ZERO PAR DEFAUT, comme uCropOn, uHabOn, uMerRampeOn,
+// uMerZeroSousEau et uMppFacteur : sans poserEclairage, la vue orbitale en
+// production rend exactement ce qu'elle rendait, AU BIT PRES. Le bloc qui les
+// lit est garde par un uniforme, donc par un branchement uniforme, donc les
+// derivees d'ecran du reste du nuanceur restent definies.
+//
+// ⚠️ CE SONT DES IRRADIANCES, PAS DES COULEURS. three multiplie deja la couleur
+// d'une lampe par son intensite avant de la pousser (WebGLLights) ; l'appelant
+// fait le meme produit une seule fois, et le nuanceur n'a pas a savoir qu'une
+// intensite existe. Toutes sont LINEAIRES.
+uniform float uEclairageOn;
+uniform vec3 uSoleilDir;   // le soleil de la SCENE, replace dans le repere du crop
+uniform vec3 uSoleilIrr;   // sun.color x sun.intensity
+uniform vec3 uHemiHaut;    // la verticale locale du crop, dans le repere du globe
+// ⚠️ ET LES DEUX PORTENT AUSSI L'ENVIRONNEMENT. L'irradiance de
+// scene.environment est MESUREE (src/sonde-ambiante.js) puis ramenee a un ciel
+// et un sol, parce qu'elle depend de la normale — ecart-type 17,7 % releve sur
+// le socle. mix(sol, ciel, 0.5 ndu + 0.5) est deja la loi de three pour une
+// lampe hemispherique, et c'est l'approximation du premier ordre d'un
+// environnement : les additionner evite un troisieme terme ET garde une loi.
+uniform vec3 uCielIrr;     // hemi.color x hemi.intensity + ambiante zenith
+uniform vec3 uSolIrr;      // hemi.groundColor x hemi.intensity + ambiante nadir
+uniform vec3 uAlbedoBase;  // params.color du socle, en lineaire
+uniform float uAlbedoTeinte; // mapTint — il retrouve un sens des qu'il y a une lumiere
+
+// ══════ LA COUCHE APPARENCE — Tache P3 ═════════════════════════════
+// ⚠️ uSurfaceFx VAUT ZERO PAR DEFAUT, comme uCropOn / uHabOn / uEclairageOn.
+// Ces noms sont ceux que FX_GLSL LIT : les renommer casserait le module
+// partage, et test/crop-eclairage.test.js compte ce qu'il exige.
+uniform int uSurfaceFx;
+uniform int uFxBlend;
+uniform float uFxOpacite;
+uniform float uFxScale;
+uniform float uFxTime;
+uniform vec3 uFxColA;
+uniform vec3 uFxColB;
+uniform vec3 uFxColC;
+uniform float uFxP1;
+uniform float uFxP2;
+uniform float uFxP3;
+// ⚠️ LE MOTIF EST PEINT SUR LE SOL, PAS SUR L'ECRAN NI SUR LA TUILE. terrain.js
+// l'indexe sur champXZ() = vWorldPos.xz + uFenetre, et son commentaire dit
+// pourquoi : indexe sur la geometrie il resterait colle a l'ecran pendant que
+// le relief defile — le moirage qu'Adrien a attrape a l'oeil. Ici la meme
+// grandeur est qCrop x uFxDemiBloc + uFxFenetre : l'en-tete de
+// habillage-crop.js DEMONTRE x = 28 u avec uSlabHalf = 28, donc les deux
+// nuanceurs echantillonnent le meme point du sol.
+uniform float uFxDemiBloc;
+uniform vec2 uFxFenetre;
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
@@ -802,38 +876,53 @@ float hash12(vec2 p) {
 //
 // ⚠️ MOT POUR MOT DEPUIS terrain.js. Une seconde ecriture de ces formules
 // finirait par diverger de la premiere — terrain.js porte deja cette cicatrice
 // (« Deux ecritures jumelles finiraient par diverger »), et le crop et le socle
 // doivent rendre LA MEME IMAGE, pas une image ressemblante.
 
 // mnHash / mnNoise — terrain.js:459. Le bruit de valeur du grain.
 float mnHash(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
 float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(mnHash(i), mnHash(i+vec2(1.0,0.0)), f.x), mix(mnHash(i+vec2(0.0,1.0)), mnHash(i+vec2(1.0,1.0)), f.x), f.y); }
 
-// blLum / blClip / blSetLum — terrain.js:886. L'occupation du sol MODULE la
-// couleur, elle n'en pose pas une : blSetLum prend la TEINTE de la classe et lui
-// impose une LUMINANCE tiree de la rampe, ce qui laisse le relief, les courbes
-// et la rampe hypsometrique se lire a travers. C'est toute la difference entre
-// une carte et un aplat colorie.
-float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
-vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
-  if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
-  if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
-  return clamp(c, 0.0, 1.0); }
-vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
 
 // ⚠️ INJECTE, PAS RECOPIE — Tache P2. Ce meme texte entre dans le fragment de
 // terrain.js. C'est la seule ecriture du peigne, de l'humidite, du pivot et du
 // voile aerien ; les recopier ici aurait fait exactement les « deux ecritures
 // jumelles » dont terrain.js porte la cicatrice.
 ${GLSL_NATUREL}
 
+// ⚠️ INJECTE, PAS RECOPIE — Tache P3, et il vient APRES GLSL_NATUREL parce
+// qu'il APPELLE natLuminance. La loi d'eclairage n'est pas maison : c'est celle
+// de three.js (BRDF_Lambert, getHemisphereLightIrradiance) et de terrain.js
+// (fxShade, la valeur par sommet). test/crop-eclairage.test.js va la relire
+// dans node_modules/three plutot que de croire ce commentaire.
+${GLSL_ECLAIRAGE}
+
+// ══════ LA COUCHE APPARENCE — Tache P3, et le gabarit d'ouverture l'ALLUME ══
+//
+// ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
+// public/templates/defaults/shibustart.json pose look.surfaceFx = 9. Releve
+// dans l'application vivante : uSurfaceFx = 9, uFxOpacity = 0,44,
+// uFxBlend = 2 (Multiply), uFxColA = #14161d. Mesure : socle rendu avec un
+// albedo force a BLANC sous un hemisphere blanc d'irradiance 1 (le pixel
+// devrait valoir 1/PI) — couche allumee 0,591 / 0,575 / 0,571, couche eteinte
+// 0,997 / 0,997 / 0,997. ELLE MULTIPLIE L'ALBEDO DU SOCLE PAR 0,59.
+//
+// ⚠️ FX_GLSL EST DEJA UN MODULE PARTAGE (src/fx-glsl.js), et son en-tete dit
+// pourquoi : fx-thumbs.js en avait fait une copie a la main, et « une copie est
+// un menteur silencieux ». Le troisieme lecteur passe donc par la meme porte.
+// Il ne declare aucun uniforme : il LIT uFxScale, uFxTime, uFxColA/B/C,
+// uFxP1/P2/P3, que son hote doit declarer.
+${FX_GLSL}
+// ⚠️ APRES GLSL_NATUREL, parce que fxBlend mode 10 appelle natSoftLight.
+${GLSL_MELANGE}
+
 // solEn / lavisSol — terrain.js. ⚠️ uSol NE TRANSPORTE PAS UNE IMAGE : chaque
 // octet EST un code de classe ESA WorldCover (10 arbres, 30 prairie, 80 eau).
 // Entre 10 et 80 il n'y a pas 45, il n'y a RIEN — et tout, dans une chaine
 // graphique, est fait pour interpoler. Les trois precautions du socle sont donc
 // portees telles quelles : le +0,5 avant le floor (un octet valant 40 peut
 // ressortir a 39,997 en precision moyenne), la visee du CENTRE du texel de la
 // table, et la conversion sRVB vers lineaire a la main (la table est choisie a
 // l'oeil donc ecrite en sRVB, et elle doit rester en NoColorSpace sous peine que
 // ce soit le CODE, dans l'autre texture, qui se fasse convertir).
 vec4 solEn(vec2 p) {
@@ -864,20 +953,36 @@ void main() {
   float couvertureCrop = 1.0;
 
   // ⚠️ qCrop EST HISSE HORS DU BLOC DE DECOUPE, ET C'EST OBLIGATOIRE : tout
   // l'habillage se lit en coordonnees LOCALES DU CROP (masque de cote,
   // occupation du sol, grain), et ces coordonnees sont calculees par la decoupe.
   // Les recalculer plus bas aurait pose une seconde ecriture de la projection de
   // Mercator, avec son ecretage et son repli d'antimeridien — deux ecritures qui
   // divergent, la cicatrice que terrain.js documente deja.
   vec2 qCrop = vec2(0.0);
 
+  // ⚠️ HISSE POUR LA MEME RAISON QUE qCrop, ET C'EST L'ECLAIRAGE QUI L'EXIGE
+  // (Tache P3). dedans est la couverture douce de la SUPERELLIPSE du crop — la
+  // silhouette du bloc, au pixel pres, celle que les parois suivent. C'est
+  // exactement la frontiere ou l'eclairage doit passer de la loi de PLANETE
+  // (un terminateur jour/nuit, un soleil qui suit la camera) a la loi du SOCLE
+  // (un vrai soleil, un hemisphere, une ambiante).
+  //
+  // ⛔ ET CE N'EST PAS LE CARRE dansCrop QUE L'ANALYSE EMPLOIE. Le carre est la
+  // borne de la TEXTURE d'analyse ; la silhouette du bloc est la superellipse.
+  // Les confondre poserait une arete d'eclairage droite dans les coins arrondis
+  // du bloc, la ou il n'y a deja plus de bloc.
+  //
+  // ⚠️ ZERO PAR DEFAUT : hors decoupe (uCropOn = 0) il n'y a pas de bloc, donc
+  // pas de socle a imiter, donc la planete garde sa loi.
+  float dedansCrop = 0.0;
+
   // ══════ LA DÉCOUPE, AVANT TOUT LE RESTE ══════════════════════════════════
   //
   // ⚠️ EN PREMIER, ET C'EST UNE ÉCONOMIE, PAS UN STYLE : un fragment coupé ne
   // paie ni les cinq décodages de decodeMetersAA, ni la rampe, ni les contours.
   // Le discard posé en fin de main les aurait tous payés d'avance.
   //
   // ⚠️ ET LE TEST SE FAIT EN LAT/LON, PAS EN COORDONNÉES DE SCÈNE. Les sommets
   // du globe sont en RTC (_buildMesh : positions relatives au centre de LEUR
   // tuile) — une tuile chevauche la frontière, donc position n'a pas le même
   // sens d'une tuile à l'autre. vLatLon est absolu, et il était déjà là pour le
@@ -936,20 +1041,21 @@ void main() {
     // main.js:263, qui parle du maillage du bloc central ; c est de plus un
     // DEFAUT, un template peut poser 33). Soit un facteur SEIZE sur la même
     // frontière, sans compter les crops continentaux du §8.
     //
     // ⚠️ ET LE discard RESTE AU-DELÀ D UN PIXEL. Sans lui, chaque fragment de la
     // tuile paierait le mélange : on veut le fondu SUR LE BORD, pas sur tout le
     // reste de la tuile.
     float d = pn + dInterieur - uCropCoin; // > 0 = dehors, < 0 DEDANS
     float w = max(fwidth(d), 1e-12); // un pixel, en unites de crop
     float dedans = 1.0 - smoothstep(-0.5 * w, 0.5 * w, d);
+    dedansCrop = dedans; // Tache P3 — la frontiere de l'eclairage, voir la declaration
 
     // ══════ L'ESTOMPAGE — Tache G ══════════════════════════════════════════
     //
     // ⚠️ ETEINT, CETTE LIGNE REND 1.0, DONC couvertureCrop VAUT dedans : c'est
     // la Tache A au bit pres, et smoothstep sature EXACTEMENT a 0 des que
     // d >= 0.5 w, donc le discard ci-dessous coupe le meme ensemble de
     // fragments que le « if (d > 0.5 * w) discard » qu'il remplace. Le seul
     // ecart est le fragment ou d vaut exactement 0.5 w : il etait garde avec
     // une couverture nulle, il est desormais coupe. Invisible, et moins cher.
     float estompeTuile = uEstompageOn > 0.5 ? uEstompage : 1.0;
@@ -1197,20 +1303,77 @@ void main() {
     vec4 lavis = lavisSol(sUv);
     // ⚠️ LE PLAFOND A 1 N'EST PAS DECORATIF : la tirette « Force » monte a 2, et
     // mix() au-dela de 1 EXTRAPOLE — il fabriquerait des verts fluorescents sur
     // les forets denses, exactement l'atlas scolaire qu'on refuse.
     float k = min(1.0, lavis.a * uSolOpacite);
     if (k > 0.001) {
       col = mix(col, blSetLum(lavis.rgb, mix(blLum(col), blLum(lavis.rgb), 0.55)), k);
     }
   }
 
+  // ══════ LE BLOC DEVIENT UN ALBEDO — Tache P3 ══════════════════════
+  //
+  // > L'agent noteur, 2026-08-22 : « Le socle est un materiau ECLAIRE. La tuile
+  // > du globe est une COULEUR NUE. »
+  //
+  // ⛔ ET LA CONVERSION SE FAIT ICI, PAS A LA FIN, PARCE QUE C'EST ICI QUE
+  // terrain.js LA FAIT. Sa ligne 1146 melange la peinture dans diffuseColor
+  // AVANT l'apparence, le trait de cote, les courbes et le graticule : tous ces
+  // postes peignent donc sur un ALBEDO. Poser le melange APRES eux — ce que la
+  // premiere version de cette tache faisait — fait passer le motif de
+  // l'apparence une seconde fois dans mix(fond, x, teinte), et le motif ressort
+  // delave. MESURE : l'apparence assombrit l'albedo du socle a 0,58 et celui du
+  // crop a 0,73 seulement, pour un motif pourtant CALE au meme endroit du sol
+  // (vues P3-MOTIF-SOCLE.png et P3-MOTIF-CROP.png : memes points, meme phase).
+  //
+  // ⚠️ partBloc VAUT ZERO SANS ECLAIRAGE, et alors rien de tout ce qui suit ne
+  // s'applique : la production est intouchee au bit pres.
+  vec3 nMonde = normalize(vNormalW);
+  float nduCrop = dot(nMonde, uHemiHaut);
+  float partBloc = uEclairageOn > 0.5 ? dedansCrop : 0.0;
+  vec3 fondCrop = uAlbedoBase * natGris(hNormRelief, max(nduCrop, 0.0));
+  if (partBloc > 0.0) {
+    col = mix(col, albedoCrop(col, uAlbedoBase, natGris(hNormRelief, max(nduCrop, 0.0)), uAlbedoTeinte), partBloc);
+  }
+
+  // ══════ LA COUCHE APPARENCE — Tache P3, le gabarit d'ouverture l'ALLUME ════
+  //
+  // ⛔ PERSONNE NE L'AVAIT NOMMEE, ET ELLE PESE PLUS QUE mapTint.
+  // public/templates/defaults/shibustart.json pose look.surfaceFx = 9.
+  //
+  // ⚠️ ICI ET PAS AILLEURS, ET L'ORDRE EST UN ARGUMENT. terrain.js la pose
+  // APRES la peinture hypsometrique et l'occupation du sol, et AVANT le trait de
+  // cote, les courbes et le graticule : « Materials sit BELOW the shaders, so a
+  // shader shows on top of whatever the relief is wearing », et les traits de la
+  // carte passent par-dessus tout. La poser apres les courbes les repeindrait ;
+  // la poser avant le sol la ferait recouvrir par la foret.
+  //
+  // ⚠️ ET ELLE OPERE SUR L'ALBEDO, DONC AVANT L'ECLAIRAGE. C'est ce qui la rend
+  // mesurable : socle albedo force a BLANC sous un hemisphere blanc d'irradiance
+  // 1 — le pixel devrait valoir 1/PI ; couche allumee il vaut 0,591 / 0,575 /
+  // 0,571, couche eteinte 0,997 / 0,997 / 0,997.
+  //
+  // ⚠️ fxShade EST LE MEME natOmbrePeinture QUE LA PEINTURE, ET SUR LA MEME
+  // ENTREE : terrain.js multiplie surfaceFx par clamp(luma x 2,4 ; 0,2 ; 1,4) de
+  // la luminance du FOND (params.color x la valeur par sommet). Lui donner autre
+  // chose aurait fabrique une seconde loi.
+  //
+  // ⚠️ ELLE NE PEINT QUE LE BLOC (partBloc), ET C'EST LE MEME BORD QUE
+  // L'ECLAIRAGE : la superellipse du crop. Etaler le motif du socle sur la
+  // planete entiere autour aurait fait d'une matiere de bloc une matiere de
+  // monde — et le socle, lui, s'arrete a son propre carre.
+  if (uSurfaceFx > 0 && uFxOpacite > 0.001 && partBloc > 0.0) {
+    vec2 champFx = qCrop * uFxDemiBloc + uFxFenetre;
+    vec3 fxc = surfaceFx(uSurfaceFx, champFx * 0.15, uFxTime) * natOmbrePeinture(natLuminance(fondCrop));
+    col = mix(col, fxBlend(col, fxc, uFxBlend), uFxOpacite * partBloc);
+  }
+
   // ══════ POSTE ② (suite) — LE TRAIT DE COTE ═════════════════════════════════
   //
   // ⚠️ POSE AVANT LES COURBES, COMME DANS LE SOCLE. L'ordre est un argument :
   // une courbe de niveau doit passer PAR-DESSUS le trait de cote, sinon la
   // courbe zero disparait sous lui sur toute la longueur du littoral.
   //
   // ⚠️ fwidth(landness) EST LEGAL ICI parce que la garde est un UNIFORME : tous
   // les fragments d'un quad prennent la meme branche. Sous une garde qui
   // dependrait de la donnee, la derivee serait indefinie.
   if (uHabOn > 0.5 && uCoastMaskOn > 0.5) {
@@ -1283,30 +1446,76 @@ void main() {
   vec2 g = vLatLon / 10.0;
   vec2 dg = fwidth(g);
   vec2 dist = abs(fract(g + 0.5) - 0.5);
   float gl = max(
     1.0 - smoothstep(0.0, dg.x * 1.4, dist.x),
     1.0 - smoothstep(0.0, dg.y * 1.4, dist.y)
   );
   col = mix(col, uInk, gl * uGraticuleOpacity);
 
   // soft sun shading — the map stays readable, light only models the sphere
-  float diff = max(dot(normalize(vNormalW), uSunDir), 0.0);
-  col *= 0.74 + 0.30 * diff;
+  float diff = max(dot(nMonde, uSunDir), 0.0);
+  vec3 colPlanete = col * (0.74 + 0.30 * diff);
 
   // terminateur jour/nuit (demande Adrien, façon Google Earth) : la face à
   // l'ombre FOND VERS LA COULEUR DU FOND (uShadowColor — poussée par
   // applyBackground, elle suit donc le fond ET le cycle jour/nuit) — la
   // planète s'éteint dans son propre décor, pas dans un noir générique.
   // Bande de crépuscule douce, 10 % de carte résiduelle en pleine nuit.
-  float day = smoothstep(-0.22, 0.16, dot(normalize(vNormalW), uSunDir));
-  col = mix(uShadowColor, col, 0.10 + 0.90 * day);
+  float day = smoothstep(-0.22, 0.16, dot(nMonde, uSunDir));
+  colPlanete = mix(uShadowColor, colPlanete, 0.10 + 0.90 * day);
+
+  // ══════ LE BLOC EST UN MATERIAU ECLAIRE, PLUS UNE COULEUR NUE — Tache P3 ══
+  //
+  // > L'agent noteur, 2026-08-22 : « Le socle est un materiau ECLAIRE. La tuile
+  // > du globe est une COULEUR NUE. »
+  //
+  // ⛔ ET LES DEUX LIGNES AU-DESSUS NE SONT PAS UN ECLAIRAGE, C'EST MESURE.
+  // uSunDir n'est pas le soleil de la scene : en mode surface, main.js le repose
+  // A CHAQUE IMAGE sur camGlobe.position tournee de 42 degres, « pour que la
+  // face visible ne soit pas dans la nuit ». Releve le 2026-08-22, La Reunion :
+  // uSunDir = (0,2282 -0,3679 0,9014) pendant que le soleil de la scene pointait
+  // (0,4392 0,5631 -0,7002). L'ombrage du bloc suivait donc la CAMERA, pas
+  // l'heure. Et son amplitude, 0,74 a 1,04, est de toute facon un rapport de
+  // 1,4:1 la ou un vrai Lambert va de 0 a 1.
+  //
+  // ⚠️ LA FRONTIERE EST LA SILHOUETTE DU BLOC, PAS UN CARRE. dedansCrop est la
+  // couverture douce de la superellipse — celle que les parois suivent au bit
+  // pres. A estompage plein (la vue du bloc) rien n'est dessine dehors, donc il
+  // n'y a aucune couture a voir ; en cours de fondu, la loi change exactement la
+  // ou le bloc commence, ce qui est la definition d'un bloc decoupe.
+  //
+  // ⚠️ ET LE TERMINATEUR NE FRANCHIT PAS CETTE FRONTIERE. Le socle n'a pas de
+  // nuit : il est un objet de studio, eclaire par trois sources. Laisser le
+  // fondu vers uShadowColor mordre sur le bloc l'aurait eteint vers la couleur
+  // du fond selon l'angle de la CAMERA — le defaut d'au-dessus, en pire.
+  //
+  // ⚠️ uAlbedoTeinte EST mapTint, ET LA TACHE P2 AVAIT RAISON DE LE LAISSER.
+  // Elle ecrivait « il n'y a rien contre quoi doser » : c'etait vrai d'un
+  // nuanceur sans lumiere. Des qu'il y en a une, col DEVIENT un albedo, et
+  // mapTint retrouve mot pour mot le sens qu'il a dans terrain.js:1137 —
+  // verifie dans l'application vivante a 7,5e-5 pres sur 182 997 pixels.
+  // ⚠️ ndu N'EST PAS BORNE, ET C'EST TOUT L'INTERET D'UNE LAMPE HEMISPHERIQUE :
+  // sa face basse recoit la couleur du SOL. La borne ne vit que dans natGris,
+  // ou un exposant fractionnaire rendrait NaN sur un negatif.
+  //
+  // ⚠️ col EST DEJA UN ALBEDO ICI quand partBloc > 0 (voir le bloc « LE BLOC
+  // DEVIENT UN ALBEDO » plus haut) : il ne reste qu'a le multiplier par
+  // l'irradiance et par 1/PI, ce que fait BRDF_Lambert dans three.
+  //
+  // ⚠️ ET AU PIXEL DE FRONTIERE, partBloc VAUT ENTRE 0 ET 1 : colPlanete y est
+  // donc calculee sur une couleur a demi convertie. C'est UN pixel, sur une
+  // silhouette de bloc, et le prix de l'alternative serait de porter DEUX
+  // couleurs dans tout le nuanceur — donc de peindre deux fois l'apparence, le
+  // trait de cote, les courbes et le graticule.
+  vec3 colBloc = col * irradianceCrop(dot(nMonde, uSoleilDir), nduCrop, uSoleilIrr, uCielIrr, uSolIrr) * 0.3183098861837907;
+  col = mix(colPlanete, colBloc, partBloc);
 
   // faint paper grain
   // ⛔ LE GRAIN ETAIT INDEXE SUR vUv, DONC SUR LA TUILE. vUv va de 0 a 1 quelle
   // que soit l'etendue au sol : 941,7 cellules par tuile, donc une frequence
   // inversement proportionnelle a la taille de la tuile, donc un grain qui
   // DOUBLE de taille a chaque frontiere de niveaux. vLatLon ne compensait pas —
   // le terme 941,7 x vUv domine de plusieurs ordres de grandeur.
   //
   // ⚠️ C'EST LA MEME DISCIPLINE QUE L'HABILLAGE, QUI INDEXE DEJA SON GRAIN SUR
   // qCrop « sinon le grain se repeterait a chaque tuile ». Ici la coordonnee
@@ -1328,20 +1537,38 @@ void main() {
   gl_FragColor = vec4(col, couvertureCrop);
 }
 `
 
 // ---------------------------------------------------------------- tile math
 
 function tileKey(z, x, y) {
   return `${z}/${x}/${y}`
 }
 
+// ══════════ L'IRRADIANCE D'UNE LAMPE — Tâche P3 ════════════════════════════
+//
+// ⚠️ **`WebGLLights` FAIT EXACTEMENT CE PRODUIT, ET IL LE FAIT UNE FOIS** :
+// `uniforms.color.copy(light.color).multiplyScalar(light.intensity)` pour une
+// directionnelle, `skyColor`/`groundColor` de même pour une hémisphérique. Le
+// nuanceur des tuiles reçoit donc une IRRADIANCE, jamais un couple
+// couleur × intensité — sans quoi il y aurait deux endroits où l'oublier.
+//
+// ⚠️ **ET LA CONVERSION sRVB → LINÉAIRE EST CELLE DE three, PAS UNE FORMULE
+// ÉCRITE ICI.** `setStyle` la fait (ColorManagement est actif par défaut depuis
+// r152), exactement comme `sun.color.set(s.sunColor)` la fait côté socle.
+const _couleurTampon = /* @__PURE__ */ new THREE.Color()
+function poserIrradiance(cible, couleurHex, intensite) {
+  if (couleurHex == null || !Number.isFinite(intensite)) return
+  _couleurTampon.setStyle(couleurHex, THREE.SRGBColorSpace)
+  cible.set(_couleurTampon.r * intensite, _couleurTampon.g * intensite, _couleurTampon.b * intensite)
+}
+
 // LE GLOBE REDEMANDAIT AU RÉSEAU LA TUILE QU'IL VENAIT DE JETER.
 //
 // Mesuré pendant une recherche « Le Var » (vol z3→z9) : 647 requêtes AWS pour
 // 245 URL uniques, terrarium/3/4/3.png demandée 19 fois. La concurrence n'y est
 // pour rien — `_request` refuse déjà une tuile qui n'est pas `empty`. La
 // redondance est TEMPORELLE : `_evict` supprime la tuile de `this.tiles` dès
 // 420 tuiles, la caméra la retraverse deux images plus tard, `_ensureTile` la
 // recrée `empty` et tout repart. Les coupables sont les ANCÊTRES BAS ZOOM :
 // retraversés à chaque image (ils portent la descente jusqu'à ce que leurs
 // quatre enfants sachent dessiner), mais jamais visibles une fois refendus,
@@ -1964,20 +2191,66 @@ export class Globe {
       uHemi: { value: NATUREL_MONDE.hemi },
       uTreeLine: { value: NATUREL_MONDE.treeLine },
       uRampCrop: { value: null },
       uRampCropOn: { value: 0 },
       uHeightContrast: { value: NATUREL_MONDE.heightContrast },
       uHeightPivot: { value: NATUREL_MONDE.heightPivot },
       uHazeAmt: { value: NATUREL_MONDE.hazeAmt },
       uHazeAlt: { value: NATUREL_MONDE.hazeAlt },
       uHazeDist: { value: NATUREL_MONDE.hazeDist },
       uHazeColor: { value: new THREE.Color(NATUREL_MONDE.hazeColor) },
+      // ══════ L'ÉCLAIRAGE DU CROP — Tâche P3 ═══════════════════════════════
+      //
+      // ⚠️ **LES DÉFAUTS SONT CEUX DU MODULE, PAS DES NOMBRES RECOPIÉS ICI** —
+      // même discipline que `NATUREL_MONDE` et `HABILLAGE_MONDE` : deux jeux de
+      // défauts qui divergeraient, c'est un aller-retour bit-à-bit qui ment.
+      uEclairageOn: { value: 0 },
+      uSoleilDir: { value: new THREE.Vector3(0, 1, 0) },
+      uSoleilIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.soleilIrr) },
+      uHemiHaut: { value: new THREE.Vector3(0, 1, 0) },
+      uCielIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.cielIrr) },
+      uSolIrr: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.solIrr) },
+      uAlbedoBase: { value: new THREE.Vector3().fromArray(ECLAIRAGE_MONDE.albedoBase) },
+      uAlbedoTeinte: { value: ECLAIRAGE_MONDE.albedoTeinte },
+      // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════
+      uSurfaceFx: { value: APPARENCE_MONDE.surfaceFx },
+      uFxBlend: { value: APPARENCE_MONDE.fxBlend },
+      uFxOpacite: { value: APPARENCE_MONDE.fxOpacity },
+      uFxScale: { value: APPARENCE_MONDE.fxScale },
+      uFxTime: { value: APPARENCE_MONDE.fxTime },
+      uFxColA: { value: new THREE.Color(APPARENCE_MONDE.fxColA) },
+      uFxColB: { value: new THREE.Color(APPARENCE_MONDE.fxColB) },
+      uFxColC: { value: new THREE.Color(APPARENCE_MONDE.fxColC) },
+      uFxP1: { value: APPARENCE_MONDE.fxP1 },
+      uFxP2: { value: APPARENCE_MONDE.fxP2 },
+      uFxP3: { value: APPARENCE_MONDE.fxP3 },
+      uFxDemiBloc: { value: APPARENCE_MONDE.fxDemiBloc },
+      uFxFenetre: { value: new THREE.Vector2(APPARENCE_MONDE.fxFenetreX, APPARENCE_MONDE.fxFenetreY) },
+      // ══════ LA COULEUR DES PAROIS DU BLOC — Tâche P3, manque n° 2 ═════════
+      //
+      // ⛔ **ELLE ÉTAIT CODÉE EN DUR DANS `_materiauParois`, ET C'ÉTAIT FAUX PAR
+      // CONSTRUCTION.** `#d8d4cc` est le DÉFAUT de `params.plinthColor` ; la
+      // paroi vivante du socle, elle, vaut ce que `plinth.setColors` a posé —
+      // et `setColors` ne prend `params.plinthColor` QUE si le socle n'est ni en
+      // verre ni sur un préréglage PBR. Relevé le 2026-08-22 **au même instant,
+      // dans la même page** (c'est le protocole du noteur, et il compte : deux
+      // chargements n'ont pas la même palette) : `params.plinthColor = #d8d4cc`,
+      // `plinth.wallMat.color = c06a44` — un terracotta. Écart RGB (24, 106,
+      // 136). **Le crop peignait une couleur que le socle n'utilise plus.**
+      //
+      // ⚠️ **ET ELLE VIT DANS `this.uniforms`, PAS DANS LE MATÉRIAU DES PAROIS,
+      // POUR DEUX RAISONS QUI SE CUMULENT** : le matériau est REFAIT à chaque
+      // reconstruction des parois (donc une couleur posée dessus se perdrait au
+      // prochain déplacement), et la palette change sans que les parois soient
+      // rebâties (`applyPalette` → `plinth.setColors`). C'est le patron de
+      // `rampe2D`, qui change d'identité à chaque palette.
+      uParoiCouleur: { value: new THREE.Color('#d8d4cc') },
     }
     // ⚠️ **LE FOND VIT À CÔTÉ DES UNIFORMES, PAS DEDANS** : c'est un
     // `Float32Array` de 148 225 valeurs (593 Kio) que le CPU lit — `posAt` et
     // `hauteurSurface` —, pas une texture. `null` = pas de fond, et toute la
     // chaîne le sait (voir `src/monde/fond-crop.js`).
     this._fondCrop = null
     // L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis. ⚠️ **UN ÉCRIVAIN, N
     // LECTEURS**, et le repli est `RAMPE_MONDE` : tant que personne n'ancre de
     // mesure, `lireEchelle` rend l'échelle mondiale et les quatre uniformes
     // valent ce qu'ils valaient. `poserRampe` et `poserMer` ANCRENT ;
@@ -2468,20 +2741,71 @@ export class Globe {
     wetK = NATUREL_MONDE.wetK,
     expoK = NATUREL_MONDE.expoK,
     hemi = NATUREL_MONDE.hemi,
     treeLine = NATUREL_MONDE.treeLine,
     heightContrast = NATUREL_MONDE.heightContrast,
     heightPivot = NATUREL_MONDE.heightPivot,
     hazeAmt = NATUREL_MONDE.hazeAmt,
     hazeAlt = NATUREL_MONDE.hazeAlt,
     hazeDist = NATUREL_MONDE.hazeDist,
     hazeColor = null,
+    // ══════ L'ÉCLAIRAGE ET LA PAROI — Tâche P3 ═══════════════════════════════
+    //
+    // ⚠️ **ILS ENTRENT PAR L'HABILLAGE, ET C'EST LE SEUL ENDROIT QUI MARCHE.**
+    // `construireParoisCrop` ne tourne qu'à l'arrêt (elle balaie plus de mille
+    // points du contour) et `poserCrop` qu'au changement de lieu ; or le soleil
+    // bouge à chaque dixième d'heure de la tirette, et la couleur des parois à
+    // chaque palette. `poserHabillage`, elle, est rejouée dès qu'un des champs
+    // de `CHAMPS_HABILLAGE` change — c'est la seule veille par image de la
+    // chaîne. Un soleil posé à la naissance du crop serait figé sur l'heure de
+    // ce moment-là, et personne ne le verrait bouger.
+    //
+    // ⚠️ **DOUZE CHAMPS PLATS, ET PAS UN OBJET `eclairage`.** `habillageDifferent`
+    // compare par `Object.is` les champs de `CHAMPS_HABILLAGE` : un objet
+    // reconstruit à chaque image différerait TOUJOURS de lui-même, et la veille
+    // reposerait l'habillage entier soixante fois par seconde. C'est la remarque
+    // que `CHAMPS_HABILLAGE` porte déjà pour `solOffset`/`solScale` et pour
+    // `hazeColor`, appliquée AVANT de payer le défaut.
+    centreLat = null,
+    centreLon = null,
+    soleilAzimut = null,
+    soleilElevation = null,
+    soleilCouleur = null,
+    soleilIntensite = null,
+    hemiCiel = null,
+    hemiSol = null,
+    hemiIntensite = null,
+    ambianteCoef = null,
+    ambianteIntensite = null,
+    albedoBase = null,
+    albedoTeinte = null,
+    // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
+    //
+    // ⚠️ **`fxTime` N'EST PAS DANS CETTE LISTE, ET C'EST DÉLIBÉRÉ** : il avance
+    // À CHAQUE IMAGE (`terrain.js` : `uFxTime.value += dt * speed`). Le faire
+    // entrer par ici mettrait `habillageDifferent` à vrai soixante fois par
+    // seconde, donc reposerait l'habillage ENTIER — textures comprises — à
+    // chaque image. Il passe par `poserTempsApparence`.
+    surfaceFx = null,
+    fxBlend = null,
+    fxOpacity = null,
+    fxScale = null,
+    fxColA = null,
+    fxColB = null,
+    fxColC = null,
+    fxP1 = null,
+    fxP2 = null,
+    fxP3 = null,
+    fxDemiBloc = null,
+    fxFenetreX = null,
+    fxFenetreY = null,
+    paroiCouleur = null,
   } = {}) {
     const u = this.uniforms
     u.uHabOn.value = 1
 
     u.uCoastMask.value = coastMask
     u.uCoastMaskOn.value = coastMask ? 1 : 0
     // ⚠️ **LA MARGE EST CONVERTIE, PAS RECOPIÉE.** Le socle écrit
     // `vWorldPos.y < uSeaY + 0.02` en UNITÉS DE SCÈNE, sur un relief déjà
     // exagéré ; le globe tient sa hauteur en MÈTRES BRUTS. Recopier « 0.02 »
     // aurait donné deux centimètres — cinquante fois trop court, donc un liseré
@@ -2527,20 +2851,92 @@ export class Globe {
     u.uHemi.value = hemi
     u.uTreeLine.value = treeLine
     u.uRampCrop.value = rampe2D
     u.uRampCropOn.value = rampe2D ? 1 : 0
     u.uHeightContrast.value = heightContrast
     u.uHeightPivot.value = heightPivot
     u.uHazeAmt.value = hazeAmt
     u.uHazeAlt.value = hazeAlt
     u.uHazeDist.value = hazeDist
     if (hazeColor != null) u.uHazeColor.value.set(hazeColor)
+
+    // ══════ L'ÉCLAIRAGE — Tâche P3 ═══════════════════════════════════════════
+    //
+    // ⚠️ **UN SEUL INTERRUPTEUR, ET IL EST L'ABSENCE DE DONNÉE.** Pas de second
+    // booléen à tenir d'accord : l'appelant qui n'a pas de lumière à donner n'en
+    // donne pas, et le bloc reprend la loi de planète. C'est le patron de
+    // `coastMask` et de `sol`, plus haut.
+    //
+    // ⛔ **ET LE LIEU EN FAIT PARTIE, PARCE QUE SANS LUI IL N'Y A PAS DE
+    // REPÈRE.** L'azimut et l'élévation sont exprimés dans le repère du SOCLE
+    // (est / haut / nord) ; les replacer dans celui du globe demande la
+    // latitude et la longitude du centre du crop. Éclairer sans elles
+    // reviendrait à poser le soleil du golfe de Guinée sur La Réunion.
+    const aLumiere = soleilCouleur != null && hemiCiel != null && hemiSol != null
+      && Number.isFinite(centreLat) && Number.isFinite(centreLon)
+      && Number.isFinite(soleilAzimut) && Number.isFinite(soleilElevation)
+    u.uEclairageOn.value = aLumiere ? 1 : 0
+    if (aLumiere) {
+      u.uSoleilDir.value.fromArray(directionSoleilLocale(soleilAzimut, soleilElevation, centreLat, centreLon))
+      u.uHemiHaut.value.fromArray(hautLocal(centreLat, centreLon))
+      poserIrradiance(u.uSoleilIrr.value, soleilCouleur, soleilIntensite)
+      poserIrradiance(u.uCielIrr.value, hemiCiel, hemiIntensite)
+      poserIrradiance(u.uSolIrr.value, hemiSol, hemiIntensite)
+      // ⚠️ **L'ENVIRONNEMENT S'AJOUTE À L'HÉMISPHÈRE, IL NE S'ÉCRIT PAS À
+      // CÔTÉ.** Les deux sont des irradiances INDIRECTES que le socle accumule
+      // dans le même `irradiance` avant de le passer au même `BRDF_Lambert`
+      // (`lights_fragment_begin`). Les séparer en deux termes du nuanceur
+      // aurait fabriqué une troisième loi pour un total identique.
+      const amb = irradianceAmbiante(ambianteCoef, ambianteIntensite)
+      u.uCielIrr.value.set(
+        u.uCielIrr.value.x + amb.ciel[0],
+        u.uCielIrr.value.y + amb.ciel[1],
+        u.uCielIrr.value.z + amb.ciel[2]
+      )
+      u.uSolIrr.value.set(
+        u.uSolIrr.value.x + amb.sol[0],
+        u.uSolIrr.value.y + amb.sol[1],
+        u.uSolIrr.value.z + amb.sol[2]
+      )
+      if (albedoBase != null) {
+        // ⚠️ **`setStyle`, PAS `set`** : `set` accepte aussi un nombre, et une
+        // chaîne '#rrggbb' est ce que le contexte transporte (une chaîne se
+        // compare par `Object.is`, un `THREE.Color` muté en place ne se compare
+        // pas — la remarque que `CHAMPS_HABILLAGE` porte déjà pour `hazeColor`).
+        // Le passage sRVB → linéaire est celui de three, pas une formule écrite ici.
+        _couleurTampon.setStyle(albedoBase, THREE.SRGBColorSpace)
+        u.uAlbedoBase.value.set(_couleurTampon.r, _couleurTampon.g, _couleurTampon.b)
+      }
+      if (Number.isFinite(albedoTeinte)) u.uAlbedoTeinte.value = albedoTeinte
+    }
+
+    // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
+    //
+    // ⚠️ **`| 0` SUR LES DEUX ENTIERS, ET CE N'EST PAS DE LA COQUETTERIE** :
+    // `uSurfaceFx` et `uFxBlend` sont des `int` GLSL. Un flottant y arrive
+    // tronqué ou pas du tout selon le pilote, sans qu'aucune erreur soit levée
+    // — et `terrain.js` fait déjà `this.mapUniforms.uSurfaceFx.value = id | 0`.
+    u.uSurfaceFx.value = Number.isFinite(surfaceFx) ? surfaceFx | 0 : APPARENCE_MONDE.surfaceFx
+    u.uFxBlend.value = Number.isFinite(fxBlend) ? fxBlend | 0 : APPARENCE_MONDE.fxBlend
+    u.uFxOpacite.value = Number.isFinite(fxOpacity) ? fxOpacity : APPARENCE_MONDE.fxOpacity
+    if (Number.isFinite(fxScale)) u.uFxScale.value = fxScale
+    if (fxColA != null) u.uFxColA.value.setStyle(fxColA, THREE.SRGBColorSpace)
+    if (fxColB != null) u.uFxColB.value.setStyle(fxColB, THREE.SRGBColorSpace)
+    if (fxColC != null) u.uFxColC.value.setStyle(fxColC, THREE.SRGBColorSpace)
+    if (Number.isFinite(fxP1)) u.uFxP1.value = fxP1
+    if (Number.isFinite(fxP2)) u.uFxP2.value = fxP2
+    if (Number.isFinite(fxP3)) u.uFxP3.value = fxP3
+    if (Number.isFinite(fxDemiBloc) && fxDemiBloc > 0) u.uFxDemiBloc.value = fxDemiBloc
+    if (Number.isFinite(fxFenetreX) && Number.isFinite(fxFenetreY)) u.uFxFenetre.value.set(fxFenetreX, fxFenetreY)
+
+    // ══════ LA COULEUR DES PAROIS — Tâche P3, manque n° 2 ════════════════════
+    if (paroiCouleur != null) u.uParoiCouleur.value.setStyle(paroiCouleur, THREE.SRGBColorSpace)
     return u
   }
 
   /**
    * Retire l'habillage — le globe reprend son propre rendu, au bit près.
    *
    * ⚠️ **CETTE PROMESSE ÉTAIT FAUSSE, ET LE TOUR 1 L'A CORRIGÉE.** La version
    * livrée ne rendait que quatre uniformes sur seize. Or `uContourInterval` et
    * `uContourOpacity` sont **PARTAGÉS par toutes les tuiles** et le bloc des
    * courbes les lit **SANS GARDE** — `uHabOn` à 0 ne les neutralise pas. Après
@@ -2594,20 +2990,67 @@ export class Globe {
     u.uHemi.value = NATUREL_MONDE.hemi
     u.uTreeLine.value = NATUREL_MONDE.treeLine
     u.uRampCrop.value = null
     u.uRampCropOn.value = 0
     u.uHeightContrast.value = NATUREL_MONDE.heightContrast
     u.uHeightPivot.value = NATUREL_MONDE.heightPivot
     u.uHazeAmt.value = NATUREL_MONDE.hazeAmt
     u.uHazeAlt.value = NATUREL_MONDE.hazeAlt
     u.uHazeDist.value = NATUREL_MONDE.hazeDist
     u.uHazeColor.value.set(NATUREL_MONDE.hazeColor)
+    // ══════ L'ÉCLAIRAGE ET LA PAROI — Tâche P3 ═══════════════════════════════
+    //
+    // ⚠️ **RENDUS AUSSI, POUR LA RAISON QUE CE BLOC PORTE DÉJÀ POUR LES DIX
+    // CURSEURS DU NATUREL** : l'aller-retour bit-à-bit que
+    // `test/crop-habillage.test.js` exige porte sur les VALEURS, pas sur leur
+    // effet. Un uniforme resté sur le soleil d'un crop mort est un état qui
+    // traîne, et ce fichier en a déjà payé un (`uContourInterval`, la planète
+    // entière à 250 m).
+    u.uEclairageOn.value = 0
+    u.uSoleilDir.value.set(0, 1, 0)
+    u.uHemiHaut.value.set(0, 1, 0)
+    u.uSoleilIrr.value.fromArray(ECLAIRAGE_MONDE.soleilIrr)
+    u.uCielIrr.value.fromArray(ECLAIRAGE_MONDE.cielIrr)
+    u.uSolIrr.value.fromArray(ECLAIRAGE_MONDE.solIrr)
+    u.uAlbedoBase.value.fromArray(ECLAIRAGE_MONDE.albedoBase)
+    u.uAlbedoTeinte.value = ECLAIRAGE_MONDE.albedoTeinte
+    u.uParoiCouleur.value.set('#d8d4cc')
+    u.uSurfaceFx.value = APPARENCE_MONDE.surfaceFx
+    u.uFxBlend.value = APPARENCE_MONDE.fxBlend
+    u.uFxOpacite.value = APPARENCE_MONDE.fxOpacity
+    u.uFxScale.value = APPARENCE_MONDE.fxScale
+    u.uFxTime.value = APPARENCE_MONDE.fxTime
+    u.uFxColA.value.set(APPARENCE_MONDE.fxColA)
+    u.uFxColB.value.set(APPARENCE_MONDE.fxColB)
+    u.uFxColC.value.set(APPARENCE_MONDE.fxColC)
+    u.uFxP1.value = APPARENCE_MONDE.fxP1
+    u.uFxP2.value = APPARENCE_MONDE.fxP2
+    u.uFxP3.value = APPARENCE_MONDE.fxP3
+    u.uFxDemiBloc.value = APPARENCE_MONDE.fxDemiBloc
+    u.uFxFenetre.value.set(APPARENCE_MONDE.fxFenetreX, APPARENCE_MONDE.fxFenetreY)
+  }
+
+  /**
+   * L'horloge de la couche Apparence — Tâche P3.
+   *
+   * ⚠️ **ELLE EST À PART DE `poserHabillage`, ET C'EST UNE OBLIGATION, PAS UN
+   * RANGEMENT.** `uFxTime` avance à chaque image (`terrain.js` :
+   * `uFxTime.value += dt * speed`) ; passé par `CHAMPS_HABILLAGE`, il mettrait
+   * `habillageDifferent` à vrai soixante fois par seconde et reposerait
+   * l'habillage entier — textures comprises — à chaque image.
+   *
+   * ⚠️ **ET ON RECOPIE L'HORLOGE DU SOCLE PLUTÔT QUE D'EN AVANCER UNE
+   * SECONDE** : deux compteurs sur deux `dt` finiraient déphasés, et le motif du
+   * crop ne serait plus celui du bloc à la même seconde.
+   */
+  poserTempsApparence(t) {
+    if (Number.isFinite(t)) this.uniforms.uFxTime.value = t
   }
 
   // ═══════════ LA RAMPE — Tâche D, « calculée sur le crop, suivie par les
   //             alentours » ══════════════════════════════════════════════════
   //
   // **Décision 4 d'Adrien, mot pour mot :** « La rampe se calcule SUR LE CROP,
   // et les alentours la suivent. » Couleurs stables et reproductibles pour
   // l'affiche, **aucune couture au bord**.
   //
   // ⚠️ **C'EST LE DÉFAUT QUE SES CAPTURES MONTRENT, ET IL EST CHIFFRÉ** : à
@@ -3510,21 +3953,25 @@ export class Globe {
   //     solide retourné n'est pas un audit.** Ā est nulle sur un solide retourné
   //     — c'est le §1 d'`audit-solide.js` — et le volume signé est la seule chose
   //     qui l'attrape. Le désarmer parce que « ça se voit pareil aujourd'hui »
   //     reviendrait à retirer le seul instrument qui le voit.
   _materiauParois() {
     return new THREE.ShaderMaterial({
       side: THREE.DoubleSide,
       uniforms: {
         uSunDir: this.uniforms.uSunDir,
         uShadowColor: this.uniforms.uShadowColor,
-        uCol: { value: new THREE.Color('#d8d4cc') }, // `params.plinthColor` par défaut
+        // ⚠️ **PARTAGÉ, PAS PROPRE AU MATÉRIAU — Tâche P3.** Il valait
+        // `new THREE.Color('#d8d4cc')`, le DÉFAUT de `params.plinthColor`,
+        // pendant que la paroi vivante du socle rendait `c06a44`. Le pourquoi
+        // du partage est écrit à la déclaration de `uParoiCouleur`.
+        uCol: this.uniforms.uParoiCouleur,
       },
       vertexShader: /* glsl */ `
         attribute vec3 aoCrop;
         varying vec3 vN;
         varying float vAo;
         void main() {
           vN = normalize(mat3(modelMatrix) * normal);
           vAo = aoCrop.r;
           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
         }`,
diff --git a/src/main.js b/src/main.js
index ab8e3b4..50e5fc9 100644
--- a/src/main.js
+++ b/src/main.js
@@ -68,20 +68,32 @@ import { creerVeilleSocle } from './monde/veille-socle.js'
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
+// ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3 ════════════════════════════════
+//
+// > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
+// > tuile du globe est une COULEUR NUE. »
+//
+// `irradianceAmbiante` est la LOI (module pur, vérifiable sous node) ;
+// `coefAmbiante` est la MESURE (elle a besoin du renderer, donc elle vit à
+// côté). ⚠️ **L'ambiante n'est pas une constante** : elle pèse 47 % de
+// l'irradiance du socle et `applyBackground` peut remplacer
+// `scene.environment` par un ciel HDRI — un nombre en dur serait devenu faux
+// sans que rien ne le dise.
+import { coefAmbiante } from './sonde-ambiante.js'
 // LE REPOS DE LA VUE — Tâche N. ⚠️ **PUR, POUR LA MÊME RAISON QUE LES TROIS
 // VEILLES CI-DESSUS** : c'est un SEUIL, et le seuil du socle a produit onze
 // bascules là où il en fallait une. Ses deux nombres sont MESURÉS sur des traces
 // par image relevées dans l'application vivante — voir le §3 du module.
 import { creerVeilleRepos } from './monde/veille-repos.js'
 // ⚠️ `landmarks.js` N'IMPORTE RIEN — c'est ce qui en fait « la seule source de
 // la largeur du socle » (`seuil-socle.js`, §0), et ce qui rend cet import sans
 // risque de cycle depuis `main.js`, qui est en bout de chaîne.
 import { BLOCK_TILES } from './landmarks.js'
 // ⚠️ `exageration-continue.js` N'IMPORTE RIEN — voir son en-tête : passer par
@@ -4669,20 +4681,32 @@ function majSeuilSocle() {
     // deux valeurs (la caméra bouge entre les deux dans la boucle de rendu ? non
     // — mais le patron se recopie, et c'est ainsi que naissent les désaccords
     // que ce chantier a payés trois fois). Une variable, deux lecteurs.
     const alt = altitudeCadrageM()
     veilleCrop.maj(alt)
     // ⚠️ **L'ÉCHELLE GLISSE ICI, ET NULLE PART AILLEURS.** `poserRampe` ANCRE
     // (à l'arrêt, `pas²` points) ; cet appel-ci ÉVALUE la courbe (quatre
     // cubiques) et pose les uniformes. Sans ancre il ne fait rien, donc rien
     // tant que la chaîne du crop n'a pas pris.
     globe?.majEchelleRampe(alt)
+    // ══════ L'HORLOGE DE LA COUCHE APPARENCE — Tâche P3 ═══════════════════
+    //
+    // ⚠️ **ELLE NE PASSE PAS PAR `CHAMPS_HABILLAGE`, ET C'EST UNE OBLIGATION** :
+    // `uFxTime` avance à chaque image (`terrain.js` : `uFxTime.value += dt ×
+    // speed`). Dans la liste surveillée, il mettrait `habillageDifferent` à vrai
+    // soixante fois par seconde et reposerait l'habillage ENTIER — textures
+    // comprises — à chaque image.
+    //
+    // ⚠️ **ET ON RECOPIE L'HORLOGE DU SOCLE PLUTÔT QUE D'EN AVANCER UNE
+    // SECONDE** : deux compteurs sur deux `dt` finiraient déphasés, et le motif
+    // du crop ne serait plus celui du bloc à la même seconde.
+    globe?.poserTempsApparence(terrain.mapUniforms.uFxTime.value)
     return
   }
   veilleSocle.maj(altitudeCadrageM())
 }
 
 // ══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3 ═══════════
 //
 // « La planète autour du crop se fond progressivement vers le fond à mesure
 // qu'on descend, pour que le bloc se détache. »
 //
@@ -4940,20 +4964,108 @@ function contexteCrop() {
       heightPivot: terrain.mapUniforms.uHeightPivot.value,
       hazeAmt: terrain.mapUniforms.uHazeAmt.value,
       hazeAlt: terrain.mapUniforms.uHazeAlt.value,
       hazeDist: terrain.mapUniforms.uHazeDist.value,
       // ⚠️ **UNE VALEUR, PAS L'OBJET.** `uHazeColor` est un `THREE.Color` que le
       // socle MUTE en place : partagé, son identité ne bougerait jamais et
       // `habillageDifferent` ne verrait pas la couleur changer — exactement la
       // remarque que `CHAMPS_HABILLAGE` porte déjà pour `solOffset`/`solScale`,
       // sauf qu'ici la parade est possible (une chaîne se compare).
       hazeColor: `#${terrain.mapUniforms.uHazeColor.value.getHexString()}`,
+      // ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3, manque n° 1 du noteur ═════════
+      //
+      // ⛔ **LE CROP N'AVAIT PAS L'ÉCLAIRAGE DU SOCLE : IL AVAIT CELUI DE LA
+      // PLANÈTE, ET LA PLANÈTE EST ÉCLAIRÉE PAR SA CAMÉRA.** La boucle d'image
+      // repose `globe.setSunDir(_orbSun)` à chaque tour, sur
+      // `camGlobe.position` tournée de 42°, pour qu'aucune face visible du
+      // globe ne soit dans la nuit. Bon pour une planète, faux pour un bloc :
+      // l'ombrage du crop suivait le point de vue, pas l'heure.
+      //
+      // ⚠️ **ON LIT LES LAMPES, PAS `params` — MÊME RÈGLE QUE POUR LES DIX
+      // CURSEURS D'ATLAS JUSTE AU-DESSUS.** `placeSun` porte deux règles que
+      // `params` ne porte pas : l'atténuation d'un soleil rasant
+      // (`0,35 + 0,65 · sin(el)^0,7`, normalisée sur 16°) et l'interrupteur
+      // `sunOn`, qui met l'intensité à zéro SANS retirer la lampe. Passer par
+      // `params.sunIntensity` aurait donné un bloc encore éclairé la nuit,
+      // soleil coupé.
+      //
+      // ⚠️ **L'AZIMUT ET L'ÉLÉVATION, EUX, VIENNENT DE `params`, ET C'EST LE BON
+      // CHOIX** : `sun.position` porte en plus le rayon 34, et `applyTimeOfDay`
+      // est le SEUL écrivain de ces deux angles (il les dérive de l'heure et du
+      // lieu, `daycycle.js`). Une grandeur, une source.
+      centreLat: centre.lat,
+      centreLon: centre.lon,
+      soleilAzimut: params.sunAzimuth,
+      soleilElevation: params.sunElevation,
+      soleilCouleur: `#${sun.color.getHexString()}`,
+      soleilIntensite: sun.intensity,
+      hemiCiel: `#${hemi.color.getHexString()}`,
+      hemiSol: `#${hemi.groundColor.getHexString()}`,
+      hemiIntensite: hemi.intensity,
+      // ⚠️ **LES DEUX INTENSITÉS MULTIPLIENT, ET three LES APPLIQUE TOUTES LES
+      // DEUX** : `scene.environmentIntensity` (le cycle horaire la réécrit à
+      // chaque heure) et `material.envMapIntensity` (0,15 relevé sur le
+      // matériau du relief). En oublier une donnait un facteur 6,7.
+      // ⛔ **UNE SEULE INTENSITÉ, ET LA PREMIÈRE VERSION EN METTAIT DEUX.**
+      // `material.envMapIntensity` (0,15 sur le relief) est du CODE MORT ici :
+      // `three` l'écrase par `scene.environmentIntensity` quand le matériau n'a
+      // pas d'`envMap` à lui (`WebGLRenderer.js`, r172), et
+      // `terrain.material.envMap === null`. Le facteur 6,7 que ça donnait a été
+      // attrapé par la mesure du socle, pas par la lecture du code.
+      //
+      // ⚠️ **`coefAmbiante` REND UN OBJET GELÉ MIS EN CACHE PAR TEXTURE** : son
+      // identité ne bouge pas, donc `Object.is` le voit égal et l'habillage ne
+      // se repose pas à chaque image. C'est la contrainte que
+      // `CHAMPS_HABILLAGE` impose à tout ce qui n'est ni scalaire ni chaîne.
+      ambianteCoef: coefAmbiante(renderer, scene.environment),
+      ambianteIntensite: scene.environmentIntensity,
+      // le fond contre lequel `mapTint` dose la peinture — `terrain.js:1137`
+      albedoBase: `#${terrain.material.color.getHexString()}`,
+      albedoTeinte: terrain.mapUniforms.uTint.value,
+      // ══════ LA COULEUR DES PAROIS — Tâche P3, manque n° 2 ═══════════════
+      //
+      // ⛔ **`params.plinthColor` EST LE MAUVAIS NOMBRE, ET LE NOTEUR L'A MESURÉ
+      // AU MÊME INSTANT DANS LA MÊME PAGE** : `params.plinthColor = #d8d4cc`,
+      // `plinth.wallMat.color = c06a44`. `setColors` ne retient
+      // `params.plinthColor` que si le socle n'est ni en verre ni sur un
+      // préréglage PBR ; c'est donc le MATÉRIAU qui dit la vérité, jamais
+      // `params`. Même règle que pour les curseurs d'Atlas.
+      paroiCouleur: `#${plinth.wallMat.color.getHexString()}`,
+      // ══════ LA COUCHE APPARENCE — Tâche P3 ══════════════════════════
+      //
+      // ⛔ **LE GABARIT D'OUVERTURE L'ALLUME** (`shibustart.json` :
+      // `look.surfaceFx = 9`), et elle multiplie l'albédo du socle par **0,59**
+      // — mesuré, socle albédo BLANC sous hémisphère blanc d'irradiance 1 :
+      // **0,591** couche allumée contre **0,997** couche éteinte. Aucune tâche
+      // de ce chantier ne l'avait nommée, et sans elle le crop éclairé sortait
+      // 1,7 fois trop clair.
+      //
+      // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`** — même règle que
+      // pour les dix curseurs d'Atlas : `applyFxParams` porte les défauts par
+      // effet (`fx-meta.js`) que `params.fx[id]` ne porte pas toujours.
+      surfaceFx: terrain.mapUniforms.uSurfaceFx.value,
+      fxBlend: terrain.mapUniforms.uFxBlend.value,
+      fxOpacity: terrain.mapUniforms.uFxOpacity.value,
+      fxScale: terrain.mapUniforms.uFxScale.value,
+      fxColA: `#${terrain.mapUniforms.uFxColA.value.getHexString()}`,
+      fxColB: `#${terrain.mapUniforms.uFxColB.value.getHexString()}`,
+      fxColC: `#${terrain.mapUniforms.uFxColC.value.getHexString()}`,
+      fxP1: terrain.mapUniforms.uFxP1.value,
+      fxP2: terrain.mapUniforms.uFxP2.value,
+      fxP3: terrain.mapUniforms.uFxP3.value,
+      // ⚠️ **`uSlabHalf` VIVANT, PAS 28 EN DUR** : c'est lui qui convertit
+      // `qCrop` en la coordonnée de sol que `champXZ()` donne à `terrain.js`,
+      // et la fenêtre continue le déplace. Un 28 recopié aurait fait glisser le
+      // motif du crop par rapport à celui du bloc dès le premier déplacement.
+      fxDemiBloc: terrain.mapUniforms.uSlabHalf?.value ?? 28,
+      fxFenetreX: terrain.mapUniforms.uFenetre?.value?.x ?? 0,
+      fxFenetreY: terrain.mapUniforms.uFenetre?.value?.y ?? 0,
     },
     mer: {
       altitudeM: altitudeCadrageM(),
       // ══════════ LA BATHYMÉTRIE — Tâche J, trou n° 1 ═══════════════════════
       //
       // ⚠️ **C'EST LA PORTE D'ENTRÉE, ET ELLE ÉTAIT MURÉE.** Sans `remplir`,
       // `_cuireChampMer` retombe sur `hauteurSurface`, qui lit les tuiles du
       // globe — lesquelles n'ont AUCUN fond marin : **zéro partout en mer**,
       // donc un aplat. Mesuré : champ couvert à **0,7 %**, `bathy: false`.
       // `remplirHauteurs` appelle `fuseBathymetry` sur l'emprise ENTIÈRE en une
diff --git a/src/monde/branchement-crop.js b/src/monde/branchement-crop.js
index eefdab4..36d65a6 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -188,20 +188,86 @@ export const CHAMPS_HABILLAGE = Object.freeze([
   'heightContrast',
   'heightPivot',
   'hazeAmt',
   'hazeAlt',
   'hazeDist',
   // ⚠️ **UNE CHAÎNE, ET C'EST CE QUI LA REND SURVEILLABLE.** `uHazeColor` est un
   // `THREE.Color` MUTÉ EN PLACE par le socle, comme `solOffset`/`solScale` : son
   // identité ne bouge jamais. `contexteCrop` en transmet donc la valeur
   // hexadécimale, qui, elle, se compare par `Object.is`.
   'hazeColor',
+  // ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3 ════════════════════════════
+  //
+  // ⚠️ **C'EST LA SEULE VEILLE PAR IMAGE DE LA CHAÎNE, ET LE SOLEIL BOUGE À
+  // CHAQUE DIXIÈME D'HEURE.** `poserCrop` ne tourne qu'au changement de lieu et
+  // `construireParoisCrop` qu'à l'arrêt (elle balaie plus de mille points du
+  // contour) : un soleil posé par l'une des deux resterait figé sur l'heure de
+  // sa naissance, et la tirette de 24 h n'aurait plus aucun effet sur le bloc.
+  //
+  // ⚠️ **ET TOUS SONT DES SCALAIRES OU DES CHAÎNES**, parce que `Object.is` est
+  // la seule comparaison de ce module : un objet `eclairage` reconstruit à
+  // chaque image différerait toujours de lui-même et reposerait l'habillage
+  // entier soixante fois par seconde.
+  'centreLat',
+  'centreLon',
+  'soleilAzimut',
+  'soleilElevation',
+  'soleilCouleur',
+  'soleilIntensite',
+  'hemiCiel',
+  'hemiSol',
+  'hemiIntensite',
+  // ⚠️ **L'AMBIANTE EST UN NOMBRE MESURÉ, PAS UNE CONSTANTE** : c'est
+  // l'irradiance que `scene.environment` verse sur une surface diffuse
+  // (`src/sonde-ambiante.js`), multipliée par les deux intensités vivantes. Elle
+  // pèse **47 %** de l'irradiance totale du socle et suit le cycle horaire —
+  // absente d'ici, le bloc s'éclairerait à l'ambiante de son premier instant.
+  'ambianteCoef',
+  'ambianteIntensite',
+  'albedoBase',
+  'albedoTeinte',
+  // ⚠️ **`paroiCouleur` N'EST PAS `params.plinthColor`, ET C'EST TOUT LE
+  // DÉFAUT** : `plinth.setColors` ne retient `params.plinthColor` que si le socle
+  // n'est ni en verre ni sur un préréglage PBR. Relevé au même instant dans la
+  // même page : `params.plinthColor = #d8d4cc`, paroi vivante `c06a44`. La
+  // valeur qui compte est celle du matériau, et elle change avec la palette
+  // sans que les parois du crop soient rebâties — d'où sa place ICI.
+  'paroiCouleur',
+  // ══════ LA COUCHE APPARENCE — Tâche P3 ════════════════════════════
+  //
+  // ⛔ **LE GABARIT D'OUVERTURE L'ALLUME, ET PERSONNE NE L'AVAIT VUE.**
+  // `public/templates/defaults/shibustart.json` pose `look.surfaceFx = 9`.
+  // Mesuré le 2026-08-22 : elle multiplie l'albédo du socle par **0,59** (socle
+  // rendu albédo BLANC sous un hémisphère blanc d'irradiance 1 : 0,591 couche
+  // allumée contre 0,997 couche éteinte). Sans elle, le crop éclairé sortait
+  // **1,7 fois trop clair**.
+  //
+  // ⚠️ **`fxTime` N'Y EST PAS**, et c'est une obligation : il avance à chaque
+  // image, donc il mettrait cette liste à « différent » soixante fois par
+  // seconde. Il passe par `globe.poserTempsApparence`, hors de cette veille.
+  'surfaceFx',
+  'fxBlend',
+  'fxOpacity',
+  'fxScale',
+  'fxColA',
+  'fxColB',
+  'fxColC',
+  'fxP1',
+  'fxP2',
+  'fxP3',
+  'fxDemiBloc',
+  // ⚠️ **DEUX NOMBRES ET NON UN `Vector2`** : `uFenetre` est muté EN PLACE par
+  // le socle, donc son identité ne bouge jamais et `Object.is` ne verrait
+  // jamais la fenêtre bouger — la remarque que cette liste porte déjà pour
+  // `solOffset` / `solScale`, sauf qu'ici la parade est possible.
+  'fxFenetreX',
+  'fxFenetreY',
 ])
 
 /**
  * L'habillage à poser diffère-t-il de celui qui est posé ?
  *
  * ⚠️ **`Object.is`, PAS `==`** : `null` et `undefined` sont deux réponses
  * différentes (« pas de masque » contre « champ absent du contexte »), et un
  * `NaN` d'amplitude ne doit pas se comparer égal à lui-même autrement que par
  * `Object.is` — sans quoi une amplitude devenue `NaN` gèlerait l'intervalle.
  *
diff --git a/src/monde/eclairage-crop.js b/src/monde/eclairage-crop.js
new file mode 100644
index 0000000..ecade60
--- /dev/null
+++ b/src/monde/eclairage-crop.js
@@ -0,0 +1,361 @@
+// L'ÉCLAIRAGE DU CROP — Tâche P3 du plan « LE STUDIO SUR LE GLOBE ».
+//
+// Module PUR : ni DOM, ni three.js, ni fetch. Il n'importe que `LUMA_709` de
+// `naturel-crop.js`, pour ne pas écrire une seconde fois les poids de luminance
+// que ce dépôt porte déjà. Tout se vérifie sous node (`test/crop-eclairage.test.js`).
+//
+// (Pas d'accent GRAVE dans les blocs `/* glsl */` plus bas : ils vivent dans des
+// template literals JS et le termineraient — le piège que `terrain.js`,
+// `ocean.js` et `naturel-crop.js` documentent tous les trois.)
+//
+// ══════════ 0. POURQUOI CE FICHIER EXISTE ═══════════════════════════════════
+//
+// > **L'agent noteur, 2026-08-22 (`notation-01.md`, §5.1) :** « Le socle est un
+// > matériau ÉCLAIRÉ. La tuile du globe est une COULEUR NUE. »
+//
+// Sa mesure, sur des cadrages appariés à **0,0032 %** : couper l'hémisphère du
+// socle lui retire **53,7 %** de sa richesse de teinte et **58,7 %** de ses
+// neutres ; couper le soleil lui retire **43,3 %** de son énergie de détail.
+// « L'hémisphère fabrique la couleur ; le soleil fabrique le relief. Le crop
+// n'a ni l'un ni l'autre. »
+//
+// ⚠️ **ET LE CROP EN AVAIT UN TROISIÈME QUI MANQUAIT, QUE PERSONNE N'AVAIT
+// NOMMÉ : L'ENVIRONNEMENT.** Relevé le 2026-08-22 dans l'application vivante,
+// La Réunion z12, socle rallumé dans la même page, rendu sans compositeur dans
+// une cible **demi-flottante** (donc en linéaire, sans écrêtage) :
+//
+//   · socle éclairé par un hémisphère BLANC d'irradiance 1 et rien d'autre
+//     → le pixel vaut exactement `albedo / PI` (l'irradiance d'un hémisphère
+//       blanc ne dépend pas de la normale : `mix(1, 1, w)` vaut 1) ;
+//   · socle éclairé par le SEUL `scene.environment`, à son intensité vivante,
+//     **moins** le spéculaire mesuré à part (albédo forcé à noir) ;
+//   · le rapport des deux, par pixel, sur **133 786 pixels** :
+//     **E_env = (2,0155 · 2,0153 · 2,0152)**, écart-type 0,3575 (17,7 %).
+//
+// ⚡ **L'environnement pèse donc plus que le soleil et l'hémisphère réunis dans
+// l'ambiante, et il est RIGOUREUSEMENT NEUTRE** — c'est lui, la source des
+// « neutres » que le noteur trouve 5,7 fois trop rares sur le crop. Un portage
+// qui n'aurait pris que les deux lampes nommées aurait rendu un crop trop
+// sombre et trop coloré, et la mesure l'aurait dit.
+//
+// ⚠️ **TÉMOIN NUL DE CETTE MESURE, ET IL EST UNE PREUVE, PAS UN BANC VIDE** :
+// toutes lampes éteintes et environnement débranché, le rendu vaut **0 sur les
+// 3 072 000 canaux** ; deux rendus consécutifs du même état diffèrent de **0
+// canal** ; et le même état allumé porte **184 229 pixels** non nuls. Les
+// relevés bruts sont dans `.banc/vues-P3/`.
+//
+// ══════════ 1. LA LOI N'EST PAS INVENTÉE : ELLE EST CELLE DE three.js ═══════
+//
+// ⛔ **POSER UNE SECONDE LOI D'ÉCLAIRAGE SERAIT LA FAUTE QUE D13 §③ INTERDIT.**
+// Ce que le socle applique n'est pas une recette maison : c'est le chemin
+// Lambert de `MeshPhysicalMaterial`, écrit dans `three/src/renderers/shaders/` :
+//
+//   · `bsdfs.glsl.js`            — `BRDF_Lambert(d) = RECIPROCAL_PI * d`
+//   · `lights_pars_begin.glsl.js`— `getHemisphereLightIrradiance` :
+//                                  `mix(groundColor, skyColor, 0.5 * dotNL + 0.5)`
+//   · `lights_fragment_begin`    — direct : `irradiance = dotNL * directLight.color`
+//
+// **`test/crop-eclairage.test.js` LIT CES FICHIERS DANS `node_modules` et exige
+// que les fonctions ci-dessous les suivent terme à terme.** Ce n'est pas une
+// transcription qu'on promet d'entretenir : c'est une transcription qui rougit
+// le jour où three change d'avis.
+//
+// ⚠️ **`light.color` PORTE DÉJÀ L'INTENSITÉ** (`WebGLLights` :
+// `color.copy(light.color).multiplyScalar(light.intensity)`). Les uniformes de
+// ce module sont donc des IRRADIANCES, pas des couleurs : c'est l'appelant qui
+// multiplie, une seule fois, et le nuanceur n'a pas à savoir qu'il existe une
+// intensité.
+//
+// ══════════ 2. L'ALBÉDO — ET IL N'EST PAS `col` ═════════════════════════════
+//
+// ⛔ **LA TÂCHE P2 A LAISSÉ `mapTint` EN ÉCRIVANT « il n'y a rien contre quoi
+// doser ». C'ÉTAIT VRAI, ET ÇA NE L'EST PLUS.** Son argument était que la tuile
+// du globe est un `ShaderMaterial` nu : « ni albédo, ni matière de surface ».
+// Dès qu'on lui donne une lumière, la couleur de rampe DEVIENT un albédo, et
+// `mapTint` retrouve exactement le sens qu'il a dans `terrain.js` :
+//
+//     diffuseColor.rgb = mix(diffuseColor.rgb, mapCol * paintShade, effTint)
+//                                                        (terrain.js:1137)
+//
+// **Vérifié dans l'application vivante, pas déduit** : trois rendus du socle au
+// même instant, `uTint` posé à 0, à 1, puis à sa valeur vivante (0,68), et
+// `mix(albédo₀, albédo₁, 0,68)` reproduit l'albédo vivant à **7,5 × 10⁻⁵** de
+// moyenne sur **182 997 pixels**. La loi est donc celle-là, et pas une autre.
+//
+// Le fond contre lequel la peinture est dosée est `params.color` × la **valeur
+// par sommet** que `terrain.js` cuit (« vertex tint: height-graded value +
+// slope darkening + grain jitter »). ⚠️ **Ce fond n'est pas décoratif : c'est
+// 32 % de l'albédo du socle, il est presque neutre, et il monte avec
+// l'altitude.** C'est lui, avec l'environnement, qui fabrique les neutres.
+//
+// ⚠️ **CE QUI N'EST PAS PORTÉ, ET JE LE DIS PLUTÔT QUE DE LE TAIRE :** le
+// `tint[i] * 0.05` de `terrain.js` (deux octaves de simplex PRÉ-CUITES sur la
+// grille du bloc, `detail-noise.js`). Il vaut ±0,05 sur un terme qui pèse 0,32
+// de l'albédo, soit **±1,6 %** — et le nuanceur du globe porte déjà son propre
+// grain de papier au même endroit de la chaîne. Le porter demanderait de cuire
+// le champ de bruit du bloc pour le crop ; ce n'est pas le poste n° 1.
+
+import { LUMA_709 } from './naturel-crop.js'
+
+// ══════════ LES CONSTANTES, ET CHACUNE REMONTE À UNE LIGNE DU DÉPÔT ═════════
+
+/** `BRDF_Lambert` — `three/src/renderers/shaders/ShaderChunk/bsdfs.glsl.js`. */
+export const RECIPROQUE_PI = 0.3183098861837907
+
+// `terrain.js`, « vertex tint » : `lerp(0.62, 0.95, max(0, hn) ** 0.85)`.
+export const GRIS_BAS = 0.62
+export const GRIS_HAUT = 0.95
+export const GRIS_EXPO = 0.85
+// `terrain.js`, même ligne : `*= lerp(0.78, 1.0, max(0, ny) ** 0.6)`.
+export const PENTE_BAS = 0.78
+export const PENTE_HAUT = 1.0
+export const PENTE_EXPO = 0.6
+// `terrain.js` : `float fxShade = clamp(luma * 2.4, 0.2, 1.4);`
+export const OMBRE_GAIN = 2.4
+export const OMBRE_MIN = 0.2
+export const OMBRE_MAX = 1.4
+
+const D2R = Math.PI / 180
+
+/**
+ * Les défauts MONDE : l'éclairage éteint, et des valeurs qui ne peuvent rien
+ * peindre si quelqu'un les lisait quand même.
+ *
+ * ⚠️ **MÊME GARDE ET MÊME RAISON QUE `uCropOn`, `uHabOn`, `uMerRampeOn` ET
+ * `uMppFacteur`** : le nuanceur des tuiles est PARTAGÉ par toutes les tuiles du
+ * globe, y compris celles qui ne verront jamais de crop. Sans `poserEclairage`,
+ * la vue orbitale en production rend exactement ce qu'elle rendait, au bit près.
+ */
+export const ECLAIRAGE_MONDE = Object.freeze({
+  soleilIrr: Object.freeze([0, 0, 0]),
+  cielIrr: Object.freeze([0, 0, 0]),
+  solIrr: Object.freeze([0, 0, 0]),
+  albedoBase: Object.freeze([1, 1, 1]),
+  albedoTeinte: 1,
+})
+
+const lerp = (a, b, t) => a + (b - a) * t
+const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
+
+/**
+ * La valeur par sommet du socle, en fonction de l'altitude normalisée et de
+ * l'inclinaison — `terrain.js`, boucle « vertex tint ».
+ *
+ * ⚠️ **`Math.max(0, …)` AUX DEUX ENDROITS, ET CE N'EST PAS UNE PRÉCAUTION DE
+ * STYLE** : `Math.pow(x, 0.85)` rend **NaN** pour `x < 0`, et `terrain.js`
+ * documente en douze lignes le sommet qui passe sous `minH` sur un champ alpin
+ * (421 à 433 sommets sur 4 225 mesurés). Le globe lit `hNormRelief`, déjà borné
+ * — la borne est donc redondante ICI et indispensable dans le jumeau, ce qui
+ * est exactement la raison de la porter dans la loi et pas au point d'usage.
+ *
+ * @param {number} hn altitude normalisée sur l'amplitude COMPLÈTE du champ
+ * @param {number} ny cosinus entre la normale et la verticale locale
+ */
+export function natGris(hn, ny) {
+  const v = lerp(GRIS_BAS, GRIS_HAUT, Math.pow(Math.max(0, hn), GRIS_EXPO))
+  return v * lerp(PENTE_BAS, PENTE_HAUT, Math.pow(Math.max(0, ny), PENTE_EXPO))
+}
+
+/**
+ * Le dosage de la peinture contre la matière — `terrain.js`, `fxShade`.
+ * @param {number} lum luminance 709 du fond
+ */
+export function natOmbrePeinture(lum) {
+  return clamp(lum * OMBRE_GAIN, OMBRE_MIN, OMBRE_MAX)
+}
+
+/** La luminance 709 d'un triplet — les mêmes poids que `natLuminance` (GLSL). */
+export function natLum(c) {
+  return c[0] * LUMA_709[0] + c[1] * LUMA_709[1] + c[2] * LUMA_709[2]
+}
+
+/**
+ * L'albédo du crop : le fond du socle, et la peinture dosée dessus.
+ * Transcription de `terrain.js:1137` — `mix(diffuseColor, mapCol * paintShade, effTint)`.
+ *
+ * @param {number[]} mapCol la couleur de rampe, LINÉAIRE (la table est en sRGB,
+ *   le GPU la décode) — c'est `col` dans le nuanceur des tuiles
+ * @param {number[]} base `params.color`, linéaire
+ * @param {number} gris la valeur par sommet (`natGris`)
+ * @param {number} teinte `mapTint`
+ */
+export function albedoCrop(mapCol, base, gris, teinte) {
+  const fond = [base[0] * gris, base[1] * gris, base[2] * gris]
+  const ombre = natOmbrePeinture(natLum(fond))
+  return [
+    lerp(fond[0], mapCol[0] * ombre, teinte),
+    lerp(fond[1], mapCol[1] * ombre, teinte),
+    lerp(fond[2], mapCol[2] * ombre, teinte),
+  ]
+}
+
+/**
+ * L'irradiance qui tombe sur une normale : soleil + hémisphère + ambiante.
+ *
+ * ⚠️ **LES TROIS TERMES SONT ADDITIFS ET DANS CET ORDRE, PARCE QUE C'EST CE QUE
+ * FAIT `lights_fragment_begin`** : l'indirecte (hémisphère + sonde) est
+ * accumulée dans `irradiance`, la directe est ajoutée par `RE_Direct`, et les
+ * deux passent par le MÊME `BRDF_Lambert`. Les séparer en deux lois — l'une
+ * multiplicative, l'autre additive — serait la faute de D13 §③.
+ *
+ * @param {number} ndl `max(dot(N, L), 0)` — `dotNL` de three
+ * @param {number} ndu `dot(N, haut)` — `dotNL` de l'hémisphère, NON borné :
+ *   c'est tout l'intérêt d'une lampe hémisphérique que sa face basse reçoive la
+ *   couleur du sol
+ */
+export function irradianceCrop(ndl, ndu, soleil, ciel, sol) {
+  const w = 0.5 * ndu + 0.5
+  const d = Math.max(ndl, 0)
+  return [
+    soleil[0] * d + lerp(sol[0], ciel[0], w),
+    soleil[1] * d + lerp(sol[1], ciel[1], w),
+    soleil[2] * d + lerp(sol[2], ciel[2], w),
+  ]
+}
+
+/**
+ * La chaîne entière — le jumeau JS de ce que le nuanceur évalue.
+ * @returns {number[]} la couleur LINÉAIRE de sortie
+ */
+export function eclairerCrop({ mapCol, base, teinte, hn, ndu, ndl, soleil, ciel, sol }) {
+  const albedo = albedoCrop(mapCol, base, natGris(hn, Math.max(0, ndu)), teinte)
+  const irr = irradianceCrop(ndl, ndu, soleil, ciel, sol)
+  return [albedo[0] * irr[0] * RECIPROQUE_PI, albedo[1] * irr[1] * RECIPROQUE_PI, albedo[2] * irr[2] * RECIPROQUE_PI]
+}
+
+// ══════════ 3. LE REPÈRE — ET C'EST LE VRAI BRANCHEMENT DE CETTE TÂCHE ══════
+//
+// ⛔ **LE SOLEIL DU GLOBE N'EST PAS LE SOLEIL DE LA SCÈNE, ET IL NE L'EST
+// JAMAIS EN MODE SURFACE.** Relevé dans `main.js` (boucle d'image) :
+//
+//     _orbSun.copy(camGlobe.position).normalize().applyAxisAngle(_upY, -0.73)
+//     globe.setSunDir(_orbSun)
+//
+// C'est-à-dire : **le soleil du globe SUIT LA CAMÉRA**, décalé de 42°, pour que
+// la face visible de la planète ne soit jamais dans la nuit. Le commentaire du
+// dépôt le dit en toutes lettres (« un soleil de scène laisserait la moitié du
+// fond dans la nuit »), et c'est un bon choix — **pour une planète**.
+//
+// ⚠️ **POUR UN BLOC, C'EST LE CONTRAIRE DE CE QU'IL FAUT** : l'ombrage du crop
+// ne dépendait donc pas de l'heure, mais de l'endroit d'où on regarde. Relevé
+// le 2026-08-22, La Réunion, drapeau levé : `uSunDir = (0,2282 · −0,3679 ·
+// 0,9014)` pendant que le soleil de la scène pointait `(0,4392 · 0,5631 ·
+// −0,7002)`. **Deux directions sans rapport, dont une seule est le soleil.**
+//
+// ➡️ Le crop reçoit donc SA PROPRE direction, dérivée de l'azimut et de
+// l'élévation du cycle horaire, replacée dans le repère local du crop.
+//
+// **La correspondance des deux repères se lit dans le dépôt, elle ne se devine
+// pas :**
+//
+//   · socle — `latLonToWorld` (`geo.js`) : `x` croît avec la LONGITUDE (est) et
+//     `z` croît avec la coordonnée de tuile `y`, c'est-à-dire vers le SUD. Le
+//     nord est donc `−z`, le haut `+y`.
+//   · globe — `latLonToSphere` (`geo.js`) :
+//     `p = R (cos φ sin λ, sin φ, cos φ cos λ)`, d'où par dérivation
+//     `est = (cos λ, 0, −sin λ)` et `nord = (−sin φ sin λ, cos φ, −sin φ cos λ)`.
+//   · le soleil, `placeSun` (`main.js`) :
+//     `(cos az cos el, sin el, sin az cos el)` — sa composante `z` est donc
+//     dirigée vers le SUD, et sa composante nord vaut `−sin az cos el`.
+
+/** La verticale locale du crop, dans le repère du globe. */
+export function hautLocal(latDeg, lonDeg) {
+  const la = latDeg * D2R
+  const lo = lonDeg * D2R
+  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
+}
+
+/**
+ * La direction du soleil de la SCÈNE, replacée dans le repère local du crop.
+ *
+ * ⚠️ **`azDeg`/`elDeg` SONT CEUX DE `params`, ET `params` EST LE SEUL À LES
+ * PORTER** : `applyTimeOfDay` les DÉRIVE de l'heure et du lieu (`daycycle.js`)
+ * puis les écrit là. Lire `sun.position` à la place aurait marché aussi, mais
+ * `sun.position` porte en plus le rayon 34 et l'atténuation rasante appliquée à
+ * l'INTENSITÉ, pas à la direction : deux grandeurs pour une, et un jour où
+ * `placeSun` change, deux lectures à corriger.
+ *
+ * @returns {number[]} un vecteur UNITAIRE dans le repère du globe
+ */
+export function directionSoleilLocale(azDeg, elDeg, latDeg, lonDeg) {
+  const az = azDeg * D2R
+  const el = elDeg * D2R
+  const la = latDeg * D2R
+  const lo = lonDeg * D2R
+  const cEst = Math.cos(az) * Math.cos(el)
+  const cHaut = Math.sin(el)
+  const cNord = -Math.sin(az) * Math.cos(el)
+  const est = [Math.cos(lo), 0, -Math.sin(lo)]
+  const haut = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
+  const nord = [-Math.sin(la) * Math.sin(lo), Math.cos(la), -Math.sin(la) * Math.cos(lo)]
+  const v = [
+    est[0] * cEst + haut[0] * cHaut + nord[0] * cNord,
+    est[1] * cEst + haut[1] * cHaut + nord[1] * cNord,
+    est[2] * cEst + haut[2] * cHaut + nord[2] * cNord,
+  ]
+  const n = Math.hypot(v[0], v[1], v[2]) || 1
+  return [v[0] / n, v[1] / n, v[2] / n]
+}
+
+/**
+ * L'irradiance de l'environnement, à partir du coefficient MESURÉ pour la
+ * texture courante (`src/sonde-ambiante.js`) et de l'intensité vivante.
+ *
+ * ⛔ **UNE SEULE INTENSITÉ, ET LA PREMIÈRE VERSION EN METTAIT DEUX.** Elle
+ * multipliait aussi par `material.envMapIntensity` (0,15 sur le relief). Or
+ * `three` (`WebGLRenderer.js`, r172) ÉCRASE cet uniforme quand le matériau n'a
+ * pas d'`envMap` à lui et que la scène en a une — et
+ * `terrain.material.envMap === null`, relevé dans l'application. **`envMapIntensity`
+ * est du code MORT sur le relief**, et le facteur 6,7 que ça donnait a été
+ * attrapé par la mesure du socle, pas par la lecture du code.
+ *
+ * ⚠️ **ELLE REND UN CIEL ET UN SOL, ET L'APPELANT LES AJOUTE À LA LAMPE
+ * HÉMISPHÉRIQUE.** Ce n'est pas un raccourci : l'irradiance d'un environnement
+ * varie avec la normale (écart-type **17,7 %** mesuré sur le socle), et
+ * `mix(sol, ciel, 0.5 · ndu + 0.5)` — la loi que three écrit déjà pour une
+ * `HemisphereLight` — en est l'approximation du premier ordre. Les additionner
+ * évite un troisième terme dans le nuanceur ET garde la loi unique.
+ *
+ * @param {{ciel:number[], sol:number[]}|null} coef ce que la sonde a mesuré
+ * @param {number} envIntensite `scene.environmentIntensity`
+ * @returns {{ciel:number[], sol:number[]}} deux irradiances linéaires
+ */
+export function irradianceAmbiante(coef, envIntensite) {
+  const k = Number.isFinite(envIntensite) ? Math.max(0, envIntensite) : 0
+  const c = coef && Array.isArray(coef.ciel) && Array.isArray(coef.sol) ? coef : null
+  if (!c || k === 0) return { ciel: [0, 0, 0], sol: [0, 0, 0] }
+  return {
+    ciel: [c.ciel[0] * k, c.ciel[1] * k, c.ciel[2] * k],
+    sol: [c.sol[0] * k, c.sol[1] * k, c.sol[2] * k],
+  }
+}
+
+export const GLSL_OMBRE_PEINTURE = /* glsl */ `
+float natOmbrePeinture(float lum) {
+  return clamp(lum * ${OMBRE_GAIN}, ${OMBRE_MIN}, ${OMBRE_MAX});
+}
+`
+
+export const GLSL_ECLAIRAGE = /* glsl */ `
+// ═══ L'ECLAIRAGE DU CROP — src/monde/eclairage-crop.js, Tache P3 ═══════════
+// Le texte ci-dessous est INJECTE depuis le module : il n'y a pas deux
+// ecritures de cette loi a garder d'accord, il y en a une.
+// ⚠️ natLuminance vient de GLSL_NATUREL, injecte AVANT celui-ci.
+float natGris(float hn, float ny) {
+  float v = mix(${GRIS_BAS}, ${GRIS_HAUT}, pow(max(hn, 0.0), ${GRIS_EXPO}));
+  return v * mix(${PENTE_BAS}, ${PENTE_HAUT.toFixed(1)}, pow(max(ny, 0.0), ${PENTE_EXPO}));
+}
+${GLSL_OMBRE_PEINTURE}
+vec3 albedoCrop(vec3 mapCol, vec3 base, float gris, float teinte) {
+  vec3 fond = base * gris;
+  return mix(fond, mapCol * natOmbrePeinture(natLuminance(fond)), teinte);
+}
+vec3 irradianceCrop(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol) {
+  return soleil * max(ndl, 0.0) + mix(sol, ciel, 0.5 * ndu + 0.5);
+}
+vec3 eclairerCrop(vec3 mapCol, vec3 base, float teinte, float hn, float ndu, float ndl,
+                  vec3 soleil, vec3 ciel, vec3 sol) {
+  vec3 albedo = albedoCrop(mapCol, base, natGris(hn, ndu), teinte);
+  return albedo * irradianceCrop(ndl, ndu, soleil, ciel, sol) * ${RECIPROQUE_PI};
+}
+`
diff --git a/src/monde/melange-crop.js b/src/monde/melange-crop.js
new file mode 100644
index 0000000..0f757ec
--- /dev/null
+++ b/src/monde/melange-crop.js
@@ -0,0 +1,104 @@
+// LES MODES DE MÉLANGE — une seule écriture, deux nuanceurs. Tâche P3.
+//
+// Module PUR : ni DOM, ni three.js, ni fetch. Il ne porte QUE du texte GLSL, et
+// `test/crop-eclairage.test.js` vérifie que ni `terrain.js` ni `globe.js` n'en
+// gardent une seconde copie.
+//
+// (Pas d'accent GRAVE dans le bloc `/* glsl */` : il vit dans un template
+// literal JS et le terminerait.)
+//
+// ══════════ POURQUOI CE FICHIER EXISTE ═════════════════════════════════════
+//
+// ⚠️ **`blLum` / `blClip` / `blSetLum` ÉTAIENT DÉJÀ ÉCRITS DEUX FOIS** — une
+// fois dans `terrain.js` (« Appearance blend modes »), une fois dans `globe.js`
+// (« blLum / blClip / blSetLum — terrain.js:886 »), avec le commentaire « une
+// seconde écriture de ces formules finirait par diverger de la première ». La
+// Tâche P2 a fermé cette dette pour le peigné ; celle-ci la ferme pour le
+// mélange, et pour la raison qui l'oblige : **le crop doit porter la couche
+// « Apparence », et cette couche EST un mode de mélange.**
+//
+// ⚡ **ET LA COUCHE APPARENCE N'EST PAS UNE OPTION EXOTIQUE — LE GABARIT
+// D'OUVERTURE L'ALLUME.** `public/templates/defaults/shibustart.json` pose
+// `look.surfaceFx = 9`. Relevé dans l'application vivante le 2026-08-22 :
+// `uSurfaceFx = 9`, `uFxOpacity = 0,44`, `uFxBlend = 2` (Multiply),
+// `uFxColA = #14161d`.
+//
+// ⛔ **CE QUE ÇA PÈSE, MESURÉ, ET PERSONNE NE L'AVAIT NOMMÉ** : socle rendu avec
+// un albédo forcé à BLANC (`material.color` = 1, `vertexColors` coupé,
+// `uTint = 0`) sous un hémisphère blanc d'irradiance 1, donc un pixel qui devrait
+// valoir exactement `1 / PI` :
+//
+//   · couche Apparence ALLUMÉE  → **0,591 · 0,575 · 0,571**
+//   · couche Apparence ÉTEINTE  → **0,997 · 0,997 · 0,997**
+//
+// **Elle multiplie l'albédo du socle par 0,59 et le teinte.** Un portage de
+// l'éclairage qui l'aurait ignorée rendait un crop **1,7 fois trop clair** —
+// c'est ce que la première version de la Tâche P3 a mis à l'écran, et c'est la
+// mesure qui l'a dit, pas la lecture du code.
+//
+// ⚠️ **`natSoftLight` VIENT DE `naturel-crop.js`** (mode 10), qui doit donc être
+// injecté AVANT ce texte-ci dans les deux nuanceurs.
+
+export const GLSL_MELANGE = /* glsl */ `
+// --- Appearance blend modes (Figma / W3C compositing set) — b = backdrop map,
+// s = the shader colour. Separable ops are channel-wise; the last four are the
+// non-separable HSL modes. ---
+float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
+vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
+  if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
+  if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
+  return clamp(c, 0.0, 1.0); }
+vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
+float blSat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
+vec3 blSetSat(vec3 c, float s) { float mn = min(min(c.r, c.g), c.b), mx = max(max(c.r, c.g), c.b);
+  return mx > mn ? (c - mn) / (mx - mn) * s : vec3(0.0); }
+vec3 blHard(vec3 b, vec3 s) { return mix(b + s - b * s - (1.0 - 2.0 * s) * b, b * 2.0 * s, step(s, vec3(0.5))); }
+vec3 fxBlend(vec3 b, vec3 s, int m) {
+  if (m == 1) return min(b, s);                                  // Darken
+  if (m == 2) return b * s;                                      // Multiply
+  if (m == 3) return max(vec3(0.0), b + s - 1.0);                // Plus darker (linear burn)
+  if (m == 4) return 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-4)); // Colour burn
+  if (m == 5) return max(b, s);                                  // Lighten
+  if (m == 6) return b + s - b * s;                              // Screen
+  if (m == 7) return min(vec3(1.0), b + s);                      // Plus lighter (linear dodge)
+  if (m == 8) return min(vec3(1.0), b / max(1.0 - s, 1e-4));     // Colour dodge
+  if (m == 9) return blHard(s, b);                               // Overlay (hard-light swapped)
+  if (m == 10) return natSoftLight(b, s);                        // Soft light — voir naturel-crop.js
+  if (m == 11) return blHard(b, s);                              // Hard light
+  if (m == 12) return abs(b - s);                                // Difference
+  if (m == 13) return b + s - 2.0 * b * s;                       // Exclusion
+  if (m == 14) return blSetLum(blSetSat(s, blSat(b)), blLum(b)); // Hue
+  if (m == 15) return blSetLum(blSetSat(b, blSat(s)), blLum(b)); // Saturation
+  if (m == 16) return blSetLum(s, blLum(b));                     // Colour
+  if (m == 17) return blSetLum(b, blLum(s));                     // Luminosity
+  return s;                                                      // Normal
+}
+`
+
+/**
+ * Les défauts MONDE de la couche Apparence : ÉTEINTE.
+ *
+ * ⚠️ **MÊME GARDE ET MÊME RAISON QUE `uCropOn`, `uHabOn` ET `uEclairageOn`** :
+ * le nuanceur des tuiles est partagé par toutes les tuiles du globe. Sans
+ * `poserHabillage`, `uSurfaceFx` vaut 0 et le bloc n'est pas exécuté — la vue
+ * orbitale en production rend au bit près ce qu'elle rendait.
+ */
+export const APPARENCE_MONDE = Object.freeze({
+  surfaceFx: 0,
+  fxBlend: 0,
+  fxOpacity: 0,
+  fxScale: 1,
+  fxTime: 0,
+  fxColA: '#000000',
+  fxColB: '#000000',
+  fxColC: '#000000',
+  fxP1: 0,
+  fxP2: 0,
+  fxP3: 0,
+  // le demi-côté du bloc, en unités de scène — `uSlabHalf` du socle. C'est lui
+  // qui convertit `qCrop` (±1) en la coordonnée de sol que `champXZ()` donne à
+  // `terrain.js`, et l'en-tête de `habillage-crop.js` en porte la démonstration.
+  fxDemiBloc: 28,
+  fxFenetreX: 0,
+  fxFenetreY: 0,
+})
diff --git a/src/sonde-ambiante.js b/src/sonde-ambiante.js
new file mode 100644
index 0000000..686188c
--- /dev/null
+++ b/src/sonde-ambiante.js
@@ -0,0 +1,215 @@
+// LA SONDE D'AMBIANTE — Tâche P3 du plan « LE STUDIO SUR LE GLOBE ».
+//
+// Elle répond à UNE question, et le crop ne peut pas s'éclairer comme le socle
+// sans la réponse : **combien d'irradiance `scene.environment` verse-t-il sur
+// une surface diffuse, et comment cette irradiance varie-t-elle avec la
+// normale ?**
+//
+// ══════════ POURQUOI UNE MESURE ET PAS UNE CONSTANTE ════════════════════════
+//
+// ⚠️ **PARCE QUE L'AMBIANTE PÈSE PRESQUE LA MOITIÉ DE L'IRRADIANCE DU SOCLE, ET
+// QUE LA TEXTURE CHANGE.** Relevé le 2026-08-22 sur l'application vivante (La
+// Réunion, z12, socle rallumé dans la même page, rendu sans compositeur dans une
+// cible demi-flottante, donc en linéaire et sans écrêtage) : soleil ≈ (2,09 ·
+// 1,95 · 1,65), hémisphère ≈ (0,16 · 0,33 · 0,51), **environnement = (2,0155 ·
+// 2,0153 · 2,0152)** sur **133 786 pixels**. Écrire 2,0155 en dur aurait tenu
+// jusqu'au premier ciel HDRI — `applyBackground` remplace `scene.environment`,
+// et rien n'aurait signalé que le nombre est devenu faux.
+//
+// ⛔ **ET UNE CONSTANTE AURAIT ÉTÉ FAUSSE DE 570 % DÈS LE PREMIER ESSAI.** La
+// première version de ce fichier multipliait le coefficient par
+// `material.envMapIntensity` — 0,15 sur le matériau du relief. Or `three`
+// (`WebGLRenderer.js`, r172) ÉCRASE cet uniforme quand le matériau n'a pas
+// d'`envMap` à lui et que la scène en a une :
+//
+//     if ( material.isMeshStandardMaterial && material.envMap === null && scene.environment !== null )
+//         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
+//
+// Relevé dans l'application : `terrain.material.envMap === null`. **`params.envMapIntensity`
+// est donc du code MORT sur le relief**, et la seule intensité qui compte est
+// `scene.environmentIntensity`. Le facteur 6,7 que ça donnait a été attrapé par
+// la mesure du socle, pas par la lecture du code.
+//
+// ══════════ CE QU'ELLE REND : UN CIEL ET UN SOL, PAS UN NOMBRE ══════════════
+//
+// ⚠️ **L'IRRADIANCE D'UN ENVIRONNEMENT DÉPEND DE LA NORMALE** — sur le socle,
+// son écart-type vaut **17,7 %** de sa moyenne, et un ciel HDRI est bleu en
+// haut et brun en bas. Rendre une moyenne unique aurait jeté cette variation.
+//
+// On rend donc **deux irradiances, zénith et nadir**, obtenues par une
+// RÉGRESSION LINÉAIRE de l'irradiance sur `N·haut` — et l'appelant les ajoute
+// aux deux couleurs de la lampe hémisphérique. Le nuanceur n'a alors rien de
+// plus à faire : `mix(sol, ciel, 0.5 · ndu + 0.5)` est déjà exactement la loi
+// que three écrit pour une `HemisphereLight`, et c'est aussi la meilleure
+// approximation du premier ordre d'un environnement.
+//
+// **La sonde est une SPHÈRE regardée de côté par une caméra ORTHOGRAPHIQUE.**
+// Pour une sphère unité vue ainsi, la normale du point qui tombe en `(sx, sy)`
+// de l'écran vaut `(sx, sy, √(1 − sx² − sy²))` : **`N·haut` EST la coordonnée
+// écran `sy`**, sans aucun calcul. Le haut du disque donne le zénith, le bas le
+// nadir, et tout l'entre-deux nourrit la régression.
+//
+// ══════════ LE SPÉCULAIRE EST RETIRÉ, ET IL EST RETIRÉ PAR SOUSTRACTION ═════
+//
+// ⚠️ **UNE SONDE D'ALBÉDO 1 MESURE LE DIFFUS *PLUS* LE SPÉCULAIRE.** Même à
+// `roughness = 1` et `metalness = 0`, `F0 = 0,04` renvoie de la lumière — relevé
+// sur le socle : **0,0089 sur 0,2237**, soit 4,0 %. On rend donc DEUX fois, la
+// seconde avec un albédo NOIR (le diffus s'annule, le spéculaire reste), et on
+// soustrait. C'est exact, et ça ne coûte qu'un second rendu de 64 × 64.
+//
+// ══════════ CE QUE LA SONDE NE DOIT PAS CASSER ═════════════════════════════
+//
+// ⚠️ **`WebGLRenderer.render` CONSOMME `shadowMap.needsUpdate`** — le dépôt a
+// déjà payé ce défaut une fois (`PasseFond`, `main.js` : « la passe de fond
+// l'aurait avalé et le bloc n'aurait plus jamais reçu sa carte, sans erreur,
+// sans test rouge, juste des ombres figées »). On le sauve et on le repose,
+// comme la cible de rendu, la couleur d'effacement et `autoClear`.
+//
+// ⚠️ **ET ELLE NE TOURNE QU'UNE FOIS PAR TEXTURE.** Le résultat est mis en
+// cache dans une `WeakMap` et **rendu comme un objet GELÉ dont l'identité ne
+// bouge pas** : c'est ce qui permet à `habillageDifferent` de le comparer par
+// `Object.is` sans reposer l'habillage entier à chaque image.
+
+import * as THREE from 'three'
+
+const COTE = 64 // pixels de côté — ~3 200 normales pour la régression
+const CACHE = new WeakMap() // texture d'environnement → { ciel, sol } gelé
+
+export const AMBIANTE_NULLE = Object.freeze({
+  ciel: Object.freeze([0, 0, 0]),
+  sol: Object.freeze([0, 0, 0]),
+})
+
+let _scene = null
+let _cam = null
+let _bille = null
+let _cible = null
+let _lecture = null
+
+function demiFlottantVersFlottant(h) {
+  const s = (h & 0x8000) >> 15
+  const e = (h & 0x7c00) >> 10
+  const f = h & 0x03ff
+  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024)
+  if (e === 0x1f) return f ? NaN : (s ? -Infinity : Infinity)
+  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024)
+}
+
+function bati() {
+  if (_scene) return
+  _scene = new THREE.Scene()
+  _bille = new THREE.Mesh(
+    new THREE.SphereGeometry(1, 48, 32),
+    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 1 })
+  )
+  _scene.add(_bille)
+  // orthographique, cadrée exactement sur le disque unité, regardant −Z : la
+  // coordonnée écran `sy` EST alors `N·haut` (voir l'en-tête)
+  _cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
+  _cam.position.set(0, 0, 4)
+  _cam.lookAt(0, 0, 0)
+  _cible = new THREE.WebGLRenderTarget(COTE, COTE, {
+    type: THREE.HalfFloatType,
+    depthBuffer: true,
+    colorSpace: THREE.LinearSRGBColorSpace,
+  })
+  _lecture = new Uint16Array(COTE * COTE * 4)
+}
+
+function rendreEtLire(renderer) {
+  renderer.setRenderTarget(_cible)
+  renderer.clear(true, true, true)
+  renderer.render(_scene, _cam)
+  renderer.readRenderTargetPixels(_cible, 0, 0, COTE, COTE, _lecture)
+  const out = new Float32Array(COTE * COTE * 3)
+  for (let i = 0, j = 0; i < COTE * COTE; i++, j += 3) {
+    out[j] = demiFlottantVersFlottant(_lecture[i * 4])
+    out[j + 1] = demiFlottantVersFlottant(_lecture[i * 4 + 1])
+    out[j + 2] = demiFlottantVersFlottant(_lecture[i * 4 + 2])
+  }
+  return out
+}
+
+/**
+ * L'irradiance de `envTexture` sur une surface diffuse, POUR
+ * `scene.environmentIntensity = 1` : `{ ciel, sol }`, deux triplets linéaires.
+ *
+ * ⚠️ **LE RÉSULTAT EST GELÉ ET MIS EN CACHE PAR TEXTURE.** Deux appels avec la
+ * même texture rendent le MÊME objet — `Object.is` le voit, et l'habillage ne
+ * se repose pas.
+ *
+ * @param {THREE.WebGLRenderer} renderer
+ * @param {THREE.Texture|null} envTexture `scene.environment`
+ */
+export function coefAmbiante(renderer, envTexture) {
+  if (!renderer || !envTexture) return AMBIANTE_NULLE
+  const memo = CACHE.get(envTexture)
+  if (memo !== undefined) return memo
+  bati()
+  const cibleAvant = renderer.getRenderTarget()
+  const autoAvant = renderer.autoClear
+  const ombreAvant = renderer.shadowMap.needsUpdate
+  const clearAvant = renderer.getClearColor(new THREE.Color())
+  const alphaAvant = renderer.getClearAlpha()
+  _scene.environment = envTexture
+  _scene.environmentIntensity = 1
+  renderer.autoClear = true
+  renderer.setClearColor(0x000000, 1)
+  _bille.material.color.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace)
+  const blanc = rendreEtLire(renderer)
+  _bille.material.color.setRGB(0, 0, 0, THREE.LinearSRGBColorSpace)
+  const noir = rendreEtLire(renderer)
+  _scene.environment = null
+  renderer.setRenderTarget(cibleAvant)
+  renderer.autoClear = autoAvant
+  renderer.setClearColor(clearAvant, alphaAvant)
+  renderer.shadowMap.needsUpdate = ombreAvant
+
+  // Régression de E sur ndu = sy. `readRenderTargetPixels` rend la ligne 0 EN
+  // BAS (convention OpenGL), donc sy croît avec l'indice de ligne.
+  let n = 0
+  let sX = 0
+  let sXX = 0
+  const sY = [0, 0, 0]
+  const sXY = [0, 0, 0]
+  for (let ligne = 0; ligne < COTE; ligne++) {
+    const sy = ((ligne + 0.5) / COTE) * 2 - 1
+    for (let col = 0; col < COTE; col++) {
+      const i = (ligne * COTE + col) * 3
+      const sx = ((col + 0.5) / COTE) * 2 - 1
+      // hors du disque il n'y a pas de bille : la régression n'a rien à y lire
+      if (sx * sx + sy * sy > 0.98) continue
+      n++
+      sX += sy
+      sXX += sy * sy
+      for (let k = 0; k < 3; k++) {
+        // sortie = albédo · E / PI, albédo vaut 1 → E = PI · (blanc − noir)
+        const e = Math.max(0, (blanc[i + k] - noir[i + k]) * Math.PI)
+        sY[k] += e
+        sXY[k] += e * sy
+      }
+    }
+  }
+  let res = AMBIANTE_NULLE
+  const det = n * sXX - sX * sX
+  if (n > 16 && Math.abs(det) > 1e-9) {
+    const ciel = [0, 0, 0]
+    const sol = [0, 0, 0]
+    for (let k = 0; k < 3; k++) {
+      const b = (n * sXY[k] - sX * sY[k]) / det // la pente : (ciel − sol) / 2
+      const a = (sY[k] - b * sX) / n // l'ordonnée : (ciel + sol) / 2
+      ciel[k] = Math.max(0, a + b)
+      sol[k] = Math.max(0, a - b)
+    }
+    if (ciel.every(Number.isFinite) && sol.every(Number.isFinite)) {
+      res = Object.freeze({ ciel: Object.freeze(ciel), sol: Object.freeze(sol), pixels: n })
+    }
+  }
+  CACHE.set(envTexture, res)
+  return res
+}
+
+/** Pour les bancs : l'intérieur de la sonde, sans le cache. */
+export function _sondeInterne() {
+  return { COTE, scene: _scene, bille: _bille, cible: _cible }
+}
diff --git a/src/terrain.js b/src/terrain.js
index 05c9b4d..cca4fe0 100644
--- a/src/terrain.js
+++ b/src/terrain.js
@@ -20,20 +20,35 @@ import { facteursCoins } from './damier-bords.js' // module pur, aucune importat
 import { lireExageration } from './monde/exageration-continue.js'
 // ⚠️ **LA COLORISATION NATURELLE N'EST PLUS ÉCRITE ICI — Tâche P2.** Ses
 // formules vivaient dans le corps du fragment ci-dessous, hors d'atteinte du
 // nuanceur du globe : c'est LA raison pour laquelle le crop rendait « une rampe
 // lisse » là où le socle rend un relief peigné. Elles sont désormais dans un
 // module PUR (`monde/naturel-crop.js`, aucune importation) que les DEUX
 // nuanceurs INJECTENT. Ce n'est pas un rangement : c'est ce qui fait qu'il n'y a
 // **qu'une seule écriture** de la loi, et `test/crop-naturel.test.js` interdit
 // qu'une seule de ces formules réapparaisse ici.
 import { GLSL_NATUREL } from './monde/naturel-crop.js'
+// ⚠️ **MÊME GESTE, DEUX LOIS DE PLUS — Tâche P3.** `natGris` (la valeur par
+// sommet : dégradé d'altitude × assombrissement de pente) et `natOmbrePeinture`
+// (le `fxShade` qui dose la peinture contre la matière) vivaient ICI, et le
+// crop en a besoin dès qu'il est éclairé : ce fond presque neutre pèse **32 %**
+// de l'albédo du socle, et c'est lui, avec l'environnement, qui fabrique les
+// neutres que le noteur trouve **5,7 fois** trop rares sur le crop.
+// `test/crop-eclairage.test.js` interdit que l'une des deux réapparaisse ici.
+import { natGris, GLSL_OMBRE_PEINTURE } from './monde/eclairage-crop.js'
+// ⚠️ **ET LES MODES DE MÉLANGE AUSSI — Tâche P3.** `blLum`/`blClip`/`blSetLum`
+// étaient écrits ICI **et** dans `globe.js`, chacun avec un commentaire disant
+// que deux écritures finiraient par diverger. Le crop doit porter la couche
+// Apparence (le gabarit d'ouverture l'allume : `surfaceFx = 9`), donc il lui
+// faut `fxBlend` : c'était l'occasion de fermer la dette au lieu d'en créer une
+// troisième. Le texte est identique au bit près à celui qui vivait ici.
+import { GLSL_MELANGE } from './monde/melange-crop.js'
 // L'analyse de relief et le masque de mer ne sont plus calcules ici : ils
 // partent dans un Worker (terrain-jobs.js). ~470 ms de fil principal fige par
 // reconstruction, sur MNT 1536². Le calcul est identique octet pour octet.
 import { scheduleTerrainJob, jobStillValid, jobCouvertParEnVol } from './terrain-jobs.js'
 import { TEXTURE_BUILDERS } from './material-textures.js'
 import { MATERIALS } from './material-catalog.js'
 import { FX_GLSL } from './fx-glsl.js' // shared with src/ui/fx-thumbs.js — see that file's header
 import { MeshTransmissionMaterial } from './vendor/MeshTransmissionMaterial.js'
 
 // full-relief opaque material modes (glass is handled separately). Derived from
@@ -883,53 +898,22 @@ float ombreLisiere(vec2 p) {
   //
   // Le commentaire d'origine affirmait l'inverse (v croissant vers le sud) et
   // le code le suivait fidelement. C'est le commentaire qui etait faux.
   //
   // Nord-ouest, donc : -u pour l'ouest, +v pour le nord.
   float hNO = texture2D(uCanopee, p + vec2(-uCanopeeTexel.x, uCanopeeTexel.y)).r;
   return clamp((hNO - h) * 3.2, 0.0, 1.0);
 }
 #endif // SHIBU_CANOPEE
 ${GLSL_NATUREL}
-// --- Appearance blend modes (Figma / W3C compositing set) — b = backdrop map,
-// s = the shader colour. Separable ops are channel-wise; the last four are the
-// non-separable HSL modes. ---
-float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
-vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
-  if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
-  if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
-  return clamp(c, 0.0, 1.0); }
-vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
-float blSat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
-vec3 blSetSat(vec3 c, float s) { float mn = min(min(c.r, c.g), c.b), mx = max(max(c.r, c.g), c.b);
-  return mx > mn ? (c - mn) / (mx - mn) * s : vec3(0.0); }
-vec3 blHard(vec3 b, vec3 s) { return mix(b + s - b * s - (1.0 - 2.0 * s) * b, b * 2.0 * s, step(s, vec3(0.5))); }
-vec3 fxBlend(vec3 b, vec3 s, int m) {
-  if (m == 1) return min(b, s);                                  // Darken
-  if (m == 2) return b * s;                                      // Multiply
-  if (m == 3) return max(vec3(0.0), b + s - 1.0);                // Plus darker (linear burn)
-  if (m == 4) return 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-4)); // Colour burn
-  if (m == 5) return max(b, s);                                  // Lighten
-  if (m == 6) return b + s - b * s;                              // Screen
-  if (m == 7) return min(vec3(1.0), b + s);                      // Plus lighter (linear dodge)
-  if (m == 8) return min(vec3(1.0), b / max(1.0 - s, 1e-4));     // Colour dodge
-  if (m == 9) return blHard(s, b);                               // Overlay (hard-light swapped)
-  if (m == 10) return natSoftLight(b, s);                        // Soft light — voir naturel-crop.js
-  if (m == 11) return blHard(b, s);                              // Hard light
-  if (m == 12) return abs(b - s);                                // Difference
-  if (m == 13) return b + s - 2.0 * b * s;                       // Exclusion
-  if (m == 14) return blSetLum(blSetSat(s, blSat(b)), blLum(b)); // Hue
-  if (m == 15) return blSetLum(blSetSat(b, blSat(s)), blLum(b)); // Saturation
-  if (m == 16) return blSetLum(s, blLum(b));                     // Colour
-  if (m == 17) return blSetLum(b, blLum(s));                     // Luminosity
-  return s;                                                      // Normal
-}`
+${GLSL_OMBRE_PEINTURE}
+${GLSL_MELANGE}`
         )
         .replace(
           '#include <color_fragment>',
           `#include <color_fragment>
 {
   // --- material noise reveal is applied further down at the paint mix (it fades
   // the relief material toward the map/shader underneath — see uMatNoiseOn there)
   // --- region cutout: clip the relief to the admin-boundary mask (white
   // inside / black outside, rendered over the DEM footprint in world XZ by
   // region-mask.js) so the landform stands alone like a country cutout. The
@@ -1105,21 +1089,21 @@ vec3 fxBlend(vec3 b, vec3 s, int m) {
         // nomme length(qCrop) : l'en-tête de habillage-crop.js démontre
         // x = 28 · u avec uSlabHalf = 28. Même nombre, deux chemins.
         float fd = clamp(length(vWorldPos.xz - uBlockOffset) / max(uSlabHalf, 1e-3), 0.0, 1.0);
         float veil = natVoile(hNorm, fd, uHazeAmt, uHazeAlt, uHazeDist);
         mapCol = natBrume(mapCol, natLuminance(mapCol), veil, uHazeColor, uHazeAmt);
       }
     } else {
       mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
     }
   }
-  float fxShade = clamp(luma * 2.4, 0.2, 1.4);
+  float fxShade = natOmbrePeinture(luma);
   // material noise reveal: where the noise is below the (soft) cut, push the tint
   // back toward 1 so the map paint shows through the relief material — a diffuse,
   // holeless dissolve that lets you see the layer underneath. The revealed map is
   // lifted back toward its natural brightness (not shaded by the material albedo)
   // so it reads as the real map/shader colour, never a muddy hole.
   float effTint = uTint;
   float paintShade = fxShade;
   if (uMatNoiseOn > 0.5) {
     float mn = mnNoise(champXZ() * uMatNoiseScale); // la dissolution est une matière du SOL
     float reveal = 1.0 - smoothstep(uMatNoiseCut - uMatNoiseSoft, uMatNoiseCut + uMatNoiseSoft, mn);
@@ -2563,22 +2547,26 @@ if (uLmOn > 0.5 && uLmFlowAmt > 0.0) {
       // ⚠️ **SUR UN CHAMP ALPIN, IL Y DESCEND — MESURÉ LE 2026-08-21.** Aucun
       // point sous 90 m (toute emprise de montagne), donc `landFactor = 1`
       // PARTOUT, grain compris au minimum du champ : **421 à 433 sommets sur
       // 4 225 passent sous `minH`**, `hn` minimal −2,9·10⁻⁴, sur les DEUX
       // chemins et pour cinq graines. Sans cette borne, autant de sommets NaN.
       // Le banc est `test/fenetre-branchee.test.js`, ⑫h — et il MORD : la borne
       // retirée, il rougit sur la couleur, pas sur une lecture de la source.
       //
       // Elle reste l'identité BIT À BIT partout où `hn ≥ 0`.
       const hn = (h - minH) / span
-      let v = lerp(0.62, 0.95, Math.pow(Math.max(0, hn), 0.85))
-      v *= lerp(0.78, 1.0, Math.pow(Math.max(0, ny), 0.6))
+      // ⚠️ **LA LOI EST DANS `monde/eclairage-crop.js`, ET LE CROP L'ÉVALUE EN
+      // GLSL** — même patron que `natRampT` et le peigné : une écriture, deux
+      // lecteurs. Le `tint[i] * 0.05` reste ici parce qu'il lit un champ de
+      // bruit PRÉ-CUIT sur la grille du bloc (`detail-noise.js`), que le crop
+      // n'a pas ; c'est ±0,05 sur un terme qui pèse 0,32 de l'albédo.
+      let v = natGris(hn, ny)
       v += tint[i] * 0.05
       colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
     }
     if (cAtt) cAtt.needsUpdate = true
     else geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
 
     return { minH, maxH }
   }
 
   // ══════════ UN PAS DE FENÊTRE — le travail par image du mode continu ══════
diff --git a/test/crop-eclairage.test.js b/test/crop-eclairage.test.js
new file mode 100644
index 0000000..e2bfa1c
--- /dev/null
+++ b/test/crop-eclairage.test.js
@@ -0,0 +1,759 @@
+// L'ÉCLAIRAGE DU CROP — Tâche P3 du plan « LE STUDIO SUR LE GLOBE »
+// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
+//
+// Même partage que `crop-naturel`, dont il reprend le protocole :
+//   ① LA LOI vit dans des modules PURS (`monde/eclairage-crop.js`,
+//      `monde/melange-crop.js`) et se vérifie sous node, point par point ;
+//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom —
+//      la Tâche K ter a trouvé une assertion verte parce qu'elle lisait une
+//      formule DANS UN COMMENTAIRE ;
+//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
+//   ④ le BRANCHEMENT, qui est la faiblesse récurrente de ce chantier ;
+//   ⑤ les gardes du nuanceur, ÉVALUÉES ;
+//   ⑥ ⚡ **ET LA RÉFÉRENCE EST LUE DANS `node_modules/three`** : la loi
+//      d'éclairage n'est pas maison, c'est celle de `MeshPhysicalMaterial`.
+//      Ce fichier ouvre les chunks de three et exige que le module les suive.
+//      Le jour où three change d'avis, ce test rougit.
+//
+// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
+// l'image obtenue ressemble à celle du socle. Seul l'écran le dit — c'est le
+// compte rendu de la tâche (`.superpowers/sdd/2026-08-22-globe-studio/rapport-P3.md`)
+// et les relevés de `.banc/vues-P3/`, pas ce fichier.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import {
+  RECIPROQUE_PI,
+  GRIS_BAS,
+  GRIS_HAUT,
+  GRIS_EXPO,
+  PENTE_BAS,
+  PENTE_HAUT,
+  PENTE_EXPO,
+  OMBRE_GAIN,
+  OMBRE_MIN,
+  OMBRE_MAX,
+  ECLAIRAGE_MONDE,
+  natGris,
+  natOmbrePeinture,
+  natLum,
+  albedoCrop,
+  irradianceCrop,
+  eclairerCrop,
+  hautLocal,
+  directionSoleilLocale,
+  irradianceAmbiante,
+  GLSL_ECLAIRAGE,
+  GLSL_OMBRE_PEINTURE,
+} from '../src/monde/eclairage-crop.js'
+import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
+import { LUMA_709 } from '../src/monde/naturel-crop.js'
+import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
+
+// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
+// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
+// `test/loi-texture-monde.test.js` et de `test/damier-cadre.test.js`.
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
+
+const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
+const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+const FRAG_GLOBE = GLOBE_SRC.slice(
+  GLOBE_SRC.indexOf('const FRAG ='),
+  GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10)
+)
+/** Le même fragment, SANS SES COMMENTAIRES — un commentaire n'est pas du code. */
+const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
+const TERRAIN_NU = TERRAIN_SRC.replace(/\/\/[^\n]*/g, '')
+const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')
+
+// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════
+
+const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
+const MIX = (a, b, t) => a + (b - a) * t
+
+/**
+ * Le TEXTE de `GLSL_ECLAIRAGE`, rendu exécutable en JS — canal par canal.
+ *
+ * ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI** : seuls les MOTS du langage sont
+ * remplacés. Si une constante du nuanceur change, la traduction la porte, et la
+ * comparaison au jumeau JS tombe.
+ *
+ * ⚠️ **`natLuminance` MÉLANGE LES CANAUX, DONC IL EST FOURNI DE L'EXTÉRIEUR** —
+ * et le fournisseur VÉRIFIE l'argument qu'on lui passe (voir ②c). C'est ce qui
+ * empêche la traduction de « réussir » sur une fonction qui luminancerait autre
+ * chose que son fond.
+ */
+function traduire(glsl) {
+  return glsl
+    .replace(/\/\/[^\n]*/g, '')
+    .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
+      const noms = args
+        .split(',')
+        .map((a) => a.trim().split(/\s+/).pop())
+        .filter(Boolean)
+      return `function ${nom}(${noms.join(', ')}) {`
+    })
+    .replace(/\bvec3\s*\(/g, '(')
+    .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*=/g, 'let $1 =')
+    .replace(/\bclamp\s*\(/g, 'CLAMP(')
+    .replace(/\bmix\s*\(/g, 'MIX(')
+    .replace(/\bmax\s*\(/g, 'Math.max(')
+    .replace(/\bmin\s*\(/g, 'Math.min(')
+    .replace(/\bpow\s*\(/g, 'Math.pow(')
+}
+
+/** Le nuanceur exécutable, pour UN canal, avec sa luminance fournie. */
+function nuanceur(natLuminance) {
+  // eslint-disable-next-line no-new-func
+  return new Function(
+    'CLAMP',
+    'MIX',
+    'natLuminance',
+    `${traduire(GLSL_ECLAIRAGE)}
+     return { natGris, natOmbrePeinture, albedoCrop, irradianceCrop, eclairerCrop }`
+  )(CLAMP, MIX, natLuminance)
+}
+
+/** Un balayage reproductible — pas de hasard, donc pas de test qui clignote. */
+function* balayage(n = 37) {
+  for (let i = 0; i <= n; i++) yield i / n
+}
+
+// ══════════ ① LA LOI PURE — LES CONSTANTES ONT UNE SOURCE ══════════════════
+
+test('①a chaque constante remonte à une ligne de terrain.js ou de three', () => {
+  // `terrain.js`, boucle « vertex tint »
+  assert.equal(GRIS_BAS, 0.62)
+  assert.equal(GRIS_HAUT, 0.95)
+  assert.equal(GRIS_EXPO, 0.85)
+  assert.equal(PENTE_BAS, 0.78)
+  assert.equal(PENTE_HAUT, 1)
+  assert.equal(PENTE_EXPO, 0.6)
+  // `terrain.js` : `float fxShade = clamp(luma * 2.4, 0.2, 1.4);`
+  assert.equal(OMBRE_GAIN, 2.4)
+  assert.equal(OMBRE_MIN, 0.2)
+  assert.equal(OMBRE_MAX, 1.4)
+  // et `1 / PI` est bien `1 / PI`, pas un 0,318 arrondi à la main
+  assert.ok(Math.abs(RECIPROQUE_PI - 1 / Math.PI) < 1e-15)
+})
+
+test('①b ⚡ LA LOI D’ÉCLAIRAGE EST CELLE DE three — lue dans node_modules', () => {
+  // ⚠️ **ON OUVRE LES CHUNKS, ON NE CITE PAS UN SOUVENIR.** Trois faits sont
+  // exigés du dépôt de three, et chacun est une brique de `irradianceCrop`.
+  const commun = readFileSync(
+    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/common.glsl.js', import.meta.url),
+    'utf8'
+  )
+  const lights = readFileSync(
+    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js', import.meta.url),
+    'utf8'
+  )
+  // ① BRDF_Lambert est bien RECIPROCAL_PI × diffuseColor, et RECIPROCAL_PI est 1/PI
+  const corpsCommun = commun.replace(/\s+/g, ' ')
+  assert.match(corpsCommun, /vec3 BRDF_Lambert\( const in vec3 diffuseColor \) \{ return RECIPROCAL_PI \* diffuseColor; \}/)
+  const mPi = corpsCommun.match(/#define RECIPROCAL_PI ([0-9.]+)/)
+  assert.ok(mPi, 'RECIPROCAL_PI est défini dans common.glsl.js')
+  assert.ok(Math.abs(Number(mPi[1]) - RECIPROQUE_PI) < 1e-9, `${mPi[1]} contre ${RECIPROQUE_PI}`)
+  // ② l'hémisphère est bien mix(sol, ciel, 0,5·dotNL + 0,5)
+  const corpsHemi = lights.replace(/\s+/g, ' ')
+  assert.match(corpsHemi, /float dotNL = dot\( normal, hemiLight\.direction \);/)
+  assert.match(corpsHemi, /float hemiDiffuseWeight = 0\.5 \* dotNL \+ 0\.5;/)
+  assert.match(corpsHemi, /vec3 irradiance = mix\( hemiLight\.groundColor, hemiLight\.skyColor, hemiDiffuseWeight \);/)
+  // ③ et la même loi, évaluée par NOTRE module, sur les mêmes entrées
+  for (const t of balayage(19)) {
+    const ndu = t * 2 - 1
+    const attendu = MIX(0.3, 0.8, 0.5 * ndu + 0.5)
+    const [r] = irradianceCrop(0, ndu, [0, 0, 0], [0.8, 0.8, 0.8], [0.3, 0.3, 0.3])
+    assert.ok(Math.abs(r - attendu) < 1e-12, `ndu=${ndu}`)
+  }
+})
+
+test('①c natGris borne SES DEUX entrées — sinon Math.pow rend NaN', () => {
+  // ⚠️ `terrain.js` documente en douze lignes le sommet qui passe sous `minH`
+  // sur un champ alpin (421 à 433 sommets sur 4 225 mesurés). Un NaN dans
+  // l'attribut `color` ne lève RIEN : il peint un sommet noir ou transparent
+  // selon le pilote.
+  assert.ok(Number.isFinite(natGris(-0.3, 0.5)))
+  assert.ok(Number.isFinite(natGris(0.5, -0.9)))
+  assert.equal(natGris(-1, -1), GRIS_BAS * PENTE_BAS)
+  // et le domaine utile est monotone croissant en hn ET en ny
+  let precedent = -1
+  for (const t of balayage()) {
+    const v = natGris(t, 1)
+    assert.ok(v >= precedent, `hn=${t}`)
+    precedent = v
+  }
+  assert.equal(natGris(0, 1), GRIS_BAS)
+  assert.equal(natGris(1, 1), GRIS_HAUT)
+})
+
+test('①d natOmbrePeinture est bornée aux DEUX bouts, et le plafond MORD', () => {
+  // ⚠️ **CE N'EST PAS DÉCORATIF** : relevé dans l'application vivante, le fond
+  // du socle (params.color × la valeur par sommet) a une luminance moyenne de
+  // **0,68** — donc `0,68 × 2,4 = 1,63`, donc le PLAFOND. Une borne qu'on croit
+  // inutile et qui décide de tout, c'est la classe de défaut que ce chantier a
+  // trouvée quatre fois.
+  assert.equal(natOmbrePeinture(0), OMBRE_MIN)
+  assert.equal(natOmbrePeinture(10), OMBRE_MAX)
+  assert.equal(natOmbrePeinture(0.68), OMBRE_MAX)
+  assert.ok(Math.abs(natOmbrePeinture(0.4) - 0.96) < 1e-12)
+})
+
+test('①e albedoCrop EST le mix de terrain.js:1146, et la teinte le pilote', () => {
+  const base = [0.855, 0.8963, 0.9387]
+  const carte = [0.3, 0.4, 0.32]
+  // teinte 0 → le fond seul ; teinte 1 → la peinture dosée seule
+  const t0 = albedoCrop(carte, base, 0.8, 0)
+  assert.deepEqual(t0, [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8])
+  const ombre = natOmbrePeinture(natLum([base[0] * 0.8, base[1] * 0.8, base[2] * 0.8]))
+  const t1 = albedoCrop(carte, base, 0.8, 1)
+  for (let k = 0; k < 3; k++) assert.ok(Math.abs(t1[k] - carte[k] * ombre) < 1e-12)
+  // et le vivant est bien l'interpolation des deux
+  const tv = albedoCrop(carte, base, 0.8, 0.68)
+  for (let k = 0; k < 3; k++) assert.ok(Math.abs(tv[k] - MIX(t0[k], t1[k], 0.68)) < 1e-12)
+})
+
+test('①f natLum porte les MÊMES poids que natLuminance du GLSL partagé', () => {
+  assert.deepEqual([...LUMA_709], [0.2126, 0.7152, 0.0722])
+  assert.ok(Math.abs(natLum([1, 1, 1]) - 1) < 1e-12)
+  assert.ok(Math.abs(natLum([1, 0, 0]) - LUMA_709[0]) < 1e-15)
+})
+
+test('①g le soleil direct est BORNÉ À ZÉRO, l’hémisphère NON', () => {
+  // ⚠️ C'est `saturate(dot(N, L))` chez three pour la directe, et un `dotNL`
+  // NON borné pour l'hémisphère : sa face basse DOIT recevoir la couleur du sol.
+  const [r] = irradianceCrop(-1, 0, [2, 2, 2], [0, 0, 0], [0, 0, 0])
+  assert.equal(r, 0)
+  const [bas] = irradianceCrop(0, -1, [0, 0, 0], [1, 1, 1], [0.25, 0.25, 0.25])
+  assert.equal(bas, 0.25) // plein sol
+  const [haut] = irradianceCrop(0, 1, [0, 0, 0], [1, 1, 1], [0.25, 0.25, 0.25])
+  assert.equal(haut, 1) // plein ciel
+})
+
+// ══════════ ② LE TEXTE GLSL, TRADUIT ET EXÉCUTÉ ════════════════════════════
+
+test('②a natGris : le GLSL et le jumeau JS rendent le même nombre', () => {
+  const N = nuanceur(() => 0)
+  let n = 0
+  for (const hn of balayage(23)) {
+    for (const ny of balayage(23)) {
+      const a = N.natGris(hn * 1.4 - 0.2, ny * 1.4 - 0.2)
+      const b = natGris(hn * 1.4 - 0.2, ny * 1.4 - 0.2)
+      assert.ok(Math.abs(a - b) < 1e-12, `hn=${hn} ny=${ny} ${a} ${b}`)
+      n++
+    }
+  }
+  assert.equal(n, 24 * 24) // le dénominateur est COMPTÉ, pas annoncé
+})
+
+test('②b natOmbrePeinture : le GLSL et le jumeau JS rendent le même nombre', () => {
+  const N = nuanceur(() => 0)
+  let n = 0
+  for (const t of balayage(101)) {
+    const lum = t * 2
+    assert.equal(N.natOmbrePeinture(lum), natOmbrePeinture(lum))
+    n++
+  }
+  assert.equal(n, 102)
+})
+
+test('②c albedoCrop : le GLSL exécuté canal par canal, avec SA luminance vérifiée', () => {
+  // ⚠️ **LE FOURNISSEUR DE `natLuminance` VÉRIFIE SON ARGUMENT.** Sans cela, un
+  // nuanceur qui luminancerait la carte au lieu du fond passerait le test.
+  const base = [0.855, 0.8963, 0.9387]
+  const carte = [0.31, 0.42, 0.28]
+  let appels = 0
+  let n = 0
+  for (const t of balayage(11)) {
+    for (const u of balayage(11)) {
+      const gris = natGris(t, u)
+      const fond = base.map((b) => b * gris)
+      const lum = natLum(fond)
+      const attendu = albedoCrop(carte, base, gris, 0.68)
+      for (let k = 0; k < 3; k++) {
+        const N = nuanceur((arg) => {
+          appels++
+          assert.ok(Math.abs(arg - fond[k]) < 1e-12, 'natLuminance reçoit le FOND du canal courant')
+          return lum
+        })
+        const got = N.albedoCrop(carte[k], base[k], gris, 0.68)
+        assert.ok(Math.abs(got - attendu[k]) < 1e-12)
+      }
+      n++
+    }
+  }
+  assert.equal(n, 144)
+  assert.equal(appels, 144 * 3)
+})
+
+test('②d irradianceCrop et eclairerCrop : le GLSL contre les jumeaux', () => {
+  const base = [0.855, 0.8963, 0.9387]
+  const carte = [0.31, 0.42, 0.28]
+  const soleil = [3.74, 3.48, 2.96]
+  const ciel = [2.83, 3.07, 3.31]
+  const sol = [0.47, 0.45, 0.43]
+  let n = 0
+  for (const t of balayage(9)) {
+    for (const u of balayage(9)) {
+      const hn = t
+      const ndu = u * 2 - 1
+      const ndl = 1 - 2 * t
+      const gris = natGris(hn, Math.max(0, ndu))
+      const fond = base.map((b) => b * gris)
+      const lum = natLum(fond)
+      const attIrr = irradianceCrop(ndl, ndu, soleil, ciel, sol)
+      const attCol = eclairerCrop({ mapCol: carte, base, teinte: 0.68, hn, ndu, ndl, soleil, ciel, sol })
+      for (let k = 0; k < 3; k++) {
+        const N = nuanceur(() => lum)
+        const irr = N.irradianceCrop(ndl, ndu, soleil[k], ciel[k], sol[k])
+        assert.ok(Math.abs(irr - attIrr[k]) < 1e-12)
+        const col = N.eclairerCrop(carte[k], base[k], 0.68, hn, ndu, ndl, soleil[k], ciel[k], sol[k])
+        assert.ok(Math.abs(col - attCol[k]) < 1e-12, `k=${k} ${col} ${attCol[k]}`)
+      }
+      n++
+    }
+  }
+  assert.equal(n, 100)
+})
+
+test('②e GLSL_ECLAIRAGE CONTIENT GLSL_OMBRE_PEINTURE — une écriture, deux lecteurs', () => {
+  // `terrain.js` n'injecte que la petite part ; `globe.js` prend le tout. Si les
+  // deux textes divergeaient, `fxShade` ne serait plus le même des deux côtés.
+  assert.ok(GLSL_ECLAIRAGE.includes(GLSL_OMBRE_PEINTURE.trim()))
+  assert.match(GLSL_OMBRE_PEINTURE, /clamp\(lum \* 2\.4, 0\.2, 1\.4\)/)
+})
+
+// ══════════ ③ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════
+
+test('③a terrain.js DÉLÈGUE la valeur par sommet et fxShade, il ne les réécrit pas', () => {
+  assert.match(TERRAIN_SRC, /import \{ natGris, GLSL_OMBRE_PEINTURE \} from '\.\/monde\/eclairage-crop\.js'/)
+  assert.match(TERRAIN_NU, /\$\{GLSL_OMBRE_PEINTURE\}/)
+  assert.match(TERRAIN_NU, /let v = natGris\(hn, ny\)/)
+  assert.match(TERRAIN_NU, /float fxShade = natOmbrePeinture\(luma\);/)
+  // ⛔ et AUCUNE des deux formules ne reparaît, commentaires retirés
+  assert.equal(/clamp\(\s*luma\s*\*\s*2\.4/.test(TERRAIN_NU), false)
+  assert.equal(/lerp\(0\.62,\s*0\.95/.test(TERRAIN_NU), false)
+  assert.equal(/lerp\(0\.78,\s*1\.0/.test(TERRAIN_NU), false)
+})
+
+test('③b les modes de mélange ne sont plus écrits deux fois', () => {
+  // ⚠️ `blLum` / `blClip` / `blSetLum` vivaient dans les DEUX fichiers, chacun
+  // avec un commentaire annonçant que deux écritures finiraient par diverger.
+  assert.match(TERRAIN_NU, /\$\{GLSL_MELANGE\}/)
+  assert.match(GLOBE_NU, /\$\{GLSL_MELANGE\}/)
+  for (const src of [TERRAIN_NU, GLOBE_NU]) {
+    assert.equal(/vec3 blSetLum\(vec3 c, float l\) \{ return blClip/.test(src), false)
+    assert.equal(/vec3 fxBlend\(vec3 b, vec3 s, int m\) \{/.test(src), false)
+  }
+  assert.match(GLSL_MELANGE, /vec3 fxBlend\(vec3 b, vec3 s, int m\) \{/)
+  assert.match(GLSL_MELANGE, /if \(m == 10\) return natSoftLight\(b, s\);/)
+})
+
+test('③c la couche Apparence PASSE PAR fx-glsl.js, elle n’est pas recopiée', () => {
+  assert.match(GLOBE_SRC, /import \{ FX_GLSL \} from '\.\/fx-glsl\.js'/)
+  assert.match(FRAG_NU, /\$\{FX_GLSL\}/)
+  // et le corps de `surfaceFx` n'est nulle part dans `globe.js`
+  assert.equal(/vec3 surfaceFx\(int id, vec2 p, float t\)/.test(GLOBE_NU), false)
+})
+
+test('③d globe.js n’écrit pas sa propre loi d’éclairage', () => {
+  assert.match(GLOBE_SRC, /from '\.\/monde\/eclairage-crop\.js'/)
+  assert.match(FRAG_NU, /\$\{GLSL_ECLAIRAGE\}/)
+  // aucune seconde écriture des formules, commentaires retirés
+  assert.equal(/0\.5 \* ndu \+ 0\.5/.test(FRAG_NU.replace('${GLSL_ECLAIRAGE}', '')), false)
+  assert.equal(/clamp\(\s*\w+\s*\* 2\.4, 0\.2, 1\.4\)/.test(FRAG_NU), false)
+})
+
+// ══════════ ④ LE BRANCHEMENT — la faiblesse récurrente de ce chantier ══════
+
+const CHAMPS_P3 = [
+  'centreLat',
+  'centreLon',
+  'soleilAzimut',
+  'soleilElevation',
+  'soleilCouleur',
+  'soleilIntensite',
+  'hemiCiel',
+  'hemiSol',
+  'hemiIntensite',
+  'ambianteCoef',
+  'ambianteIntensite',
+  'albedoBase',
+  'albedoTeinte',
+  'paroiCouleur',
+  'surfaceFx',
+  'fxBlend',
+  'fxOpacity',
+  'fxScale',
+  'fxColA',
+  'fxColB',
+  'fxColC',
+  'fxP1',
+  'fxP2',
+  'fxP3',
+  'fxDemiBloc',
+  'fxFenetreX',
+  'fxFenetreY',
+]
+
+test('④a les vingt-sept champs sont SURVEILLÉS, un par un', () => {
+  for (const champ of CHAMPS_P3) assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} absent`)
+  // ⚠️ et chacun fait vraiment BASCULER la comparaison — une liste qu'on lit
+  // sans l'exercer est une liste qu'on croit
+  const pose = Object.fromEntries(CHAMPS_HABILLAGE.map((c) => [c, 1]))
+  assert.equal(habillageDifferent(pose, { ...pose }), false)
+  for (const champ of CHAMPS_P3) {
+    assert.equal(habillageDifferent(pose, { ...pose, [champ]: 2 }), true, `${champ} n'est pas surveillé`)
+  }
+})
+
+test('④b ⛔ fxTime N’EST PAS surveillé, et main.js le pousse par l’autre porte', () => {
+  // ⚠️ Il avance à CHAQUE image : dans la liste, il reposerait l'habillage
+  // entier — textures comprises — soixante fois par seconde.
+  assert.equal(CHAMPS_HABILLAGE.includes('fxTime'), false)
+  assert.match(MAIN_SRC, /globe\?\.poserTempsApparence\(terrain\.mapUniforms\.uFxTime\.value\)/)
+})
+
+test('④c contexteCrop lit les LAMPES et le MATÉRIAU, jamais params', () => {
+  // ⚠️ **COMMENTAIRES RETIRÉS AVANT DE CHERCHER** : la Tâche K ter a trouvé une
+  // assertion verte parce qu'elle lisait une formule DANS UN PAVÉ DE PROSE.
+  const ctx = MAIN_SRC.slice(
+    MAIN_SRC.indexOf('function contexteCrop()'),
+    MAIN_SRC.indexOf('\nconst veilleCrop')
+  ).replace(/\/\/[^\n]*/g, '')
+  // le soleil : l'INTENSITÉ vient de la lampe (elle porte l'atténuation rasante
+  // et l'interrupteur `sunOn`), les ANGLES viennent de params (seul écrivain)
+  assert.match(ctx, /soleilIntensite: sun\.intensity/)
+  assert.match(ctx, /soleilCouleur: `#\$\{sun\.color\.getHexString\(\)\}`/)
+  assert.match(ctx, /soleilAzimut: params\.sunAzimuth/)
+  assert.match(ctx, /soleilElevation: params\.sunElevation/)
+  assert.match(ctx, /hemiCiel: `#\$\{hemi\.color\.getHexString\(\)\}`/)
+  assert.match(ctx, /hemiSol: `#\$\{hemi\.groundColor\.getHexString\(\)\}`/)
+  assert.match(ctx, /hemiIntensite: hemi\.intensity/)
+  // ⛔ la paroi vient du MATÉRIAU, pas de `params.plinthColor` — relevé au même
+  // instant : `params.plinthColor = #d8d4cc` et la paroi vivante `c06a44`
+  assert.match(ctx, /paroiCouleur: `#\$\{plinth\.wallMat\.color\.getHexString\(\)\}`/)
+  assert.equal(/paroiCouleur:\s*params\.plinthColor/.test(ctx), false)
+  // l'ambiante est MESURÉE, et sur la seule intensité que three applique
+  assert.match(ctx, /ambianteCoef: coefAmbiante\(renderer, scene\.environment\)/)
+  assert.match(ctx, /ambianteIntensite: scene\.environmentIntensity/)
+  assert.equal(/envMapIntensity/.test(ctx), false)
+  // la couche Apparence vient des uniformes du socle
+  for (const u of ['uSurfaceFx', 'uFxBlend', 'uFxOpacity', 'uFxScale', 'uFxP1', 'uFxP2', 'uFxP3']) {
+    assert.match(ctx, new RegExp(`terrain\\.mapUniforms\\.${u}\\.value`))
+  }
+  assert.match(ctx, /fxDemiBloc: terrain\.mapUniforms\.uSlabHalf/)
+  // le lieu du crop, l'albédo et sa teinte — les trois que la campagne de
+  // mutation a trouvés NON COUVERTS au premier tour (voir ④j)
+  assert.match(ctx, /centreLat: centre\.lat/)
+  assert.match(ctx, /centreLon: centre\.lon/)
+  assert.match(ctx, /albedoBase: `#\$\{terrain\.material\.color\.getHexString\(\)\}`/)
+  assert.match(ctx, /albedoTeinte: terrain\.mapUniforms\.uTint\.value/)
+})
+
+test('④j ⛔ CHAQUE champ surveillé lit une SOURCE VIVANTE — aucun ne peut être figé', () => {
+  // ⛔ **CETTE ASSERTION EXISTE PARCE QUE LA CAMPAGNE DE MUTATION A TROUVÉ UN
+  // TROU RÉEL.** Premier tour : **33 / 36**, et les trois survivantes étaient
+  // `centreLat`, `albedoBase` et `albedoTeinte` figés à une constante dans
+  // `contexteCrop`. Le ④c d'alors nommait quinze champs sur vingt-sept, et les
+  // douze autres pouvaient être remplacés par un littéral sans qu'un test bouge.
+  //
+  // ⚠️ **ON N'ÉNUMÈRE PLUS À LA MAIN** : la liste vient de `CHAMPS_HABILLAGE`,
+  // donc un champ ajouté demain est couvert dès son ajout — c'est la leçon que
+  // `uHemi` a coûtée à la Tâche P2, dont le ④c ne vérifiait que trois curseurs
+  // sur dix.
+  const ctx = MAIN_SRC.slice(
+    MAIN_SRC.indexOf('function contexteCrop()'),
+    MAIN_SRC.indexOf('\nconst veilleCrop')
+  ).replace(/\/\/[^\n]*/g, '')
+  // une source vivante : un uniforme du socle, une lampe, la scène, le
+  // matériau, le socle-plinthe, le centre du crop, ou la sonde d'ambiante.
+  const VIVANT = /^\s*(terrain\.|sun\.|hemi\.|scene\.|plinth\.|centre\.|coefAmbiante\(|params\.sun|`#\$\{)/
+  let n = 0
+  for (const champ of CHAMPS_P3) {
+    const m = ctx.match(new RegExp(`\\n\\s*${champ}:([^\\n]*)`))
+    assert.ok(m, `${champ} n'est pas rempli par contexteCrop`)
+    assert.match(m[1], VIVANT, `${champ} est figé : « ${m[1].trim()} »`)
+    n++
+  }
+  assert.equal(n, CHAMPS_P3.length)
+  assert.equal(n, 27) // le dénominateur est COMPTÉ, pas annoncé par le titre
+})
+
+test('④d poserHabillage POSE les uniformes, et retirerHabillage les REND', () => {
+  const g = new Globe({ radius: 100 })
+  const u = g.uniforms
+  const depart = {
+    eclairage: u.uEclairageOn.value,
+    soleil: u.uSoleilIrr.value.toArray(),
+    ciel: u.uCielIrr.value.toArray(),
+    sol: u.uSolIrr.value.toArray(),
+    base: u.uAlbedoBase.value.toArray(),
+    teinte: u.uAlbedoTeinte.value,
+    paroi: u.uParoiCouleur.value.getHexString(),
+    fx: u.uSurfaceFx.value,
+    fxOp: u.uFxOpacite.value,
+  }
+  assert.equal(depart.eclairage, 0) // ⚠️ la garde MONDE, comme uCropOn et uHabOn
+  assert.equal(depart.fx, APPARENCE_MONDE.surfaceFx)
+
+  g.poserHabillage({
+    centreLat: -21.26,
+    centreLon: 55.74,
+    soleilAzimut: 302.1,
+    soleilElevation: 34.26,
+    soleilCouleur: '#fff7e6',
+    soleilIntensite: 3.74,
+    hemiCiel: '#85c2eb',
+    hemiSol: '#4a3a2a',
+    hemiIntensite: 0.81,
+    ambianteCoef: { ciel: [2, 2, 2], sol: [0.4, 0.4, 0.4] },
+    ambianteIntensite: 0.5,
+    albedoBase: '#eef3f8',
+    albedoTeinte: 0.68,
+    paroiCouleur: '#c06a44',
+    surfaceFx: 9,
+    fxBlend: 2,
+    fxOpacity: 0.44,
+    fxScale: 1.5,
+    fxColA: '#14161d',
+    fxColB: '#c9885a',
+    fxColC: '#000000',
+    fxP1: 0.35,
+    fxP2: 0.4,
+    fxP3: 0.5,
+    fxDemiBloc: 28,
+    fxFenetreX: 3,
+    fxFenetreY: -4,
+  })
+  assert.equal(u.uEclairageOn.value, 1)
+  assert.equal(u.uParoiCouleur.value.getHexString(), 'c06a44')
+  assert.equal(u.uSurfaceFx.value, 9)
+  assert.equal(u.uFxBlend.value, 2)
+  assert.equal(u.uFxOpacite.value, 0.44)
+  assert.equal(u.uFxScale.value, 1.5)
+  assert.equal(u.uFxColB.value.getHexString(), 'c9885a')
+  assert.deepEqual(u.uFxFenetre.value.toArray(), [3, -4])
+  assert.equal(u.uAlbedoTeinte.value, 0.68)
+  // ⚠️ **L'IRRADIANCE PORTE L'INTENSITÉ**, comme `WebGLLights` la porte
+  assert.ok(u.uSoleilIrr.value.x > 3.7 && u.uSoleilIrr.value.x <= 3.74)
+  // ⚠️ **ET L'AMBIANTE S'AJOUTE À L'HÉMISPHÈRE, ELLE NE VIT PAS À CÔTÉ**
+  assert.ok(u.uCielIrr.value.x > 1, 'le ciel porte l’ambiante mesurée')
+  assert.ok(u.uSolIrr.value.x > 0.19, 'le sol porte l’ambiante mesurée')
+  // la verticale locale et le soleil sont des vecteurs UNITAIRES
+  assert.ok(Math.abs(u.uHemiHaut.value.length() - 1) < 1e-9)
+  assert.ok(Math.abs(u.uSoleilDir.value.length() - 1) < 1e-9)
+
+  g.retirerHabillage()
+  assert.equal(u.uEclairageOn.value, depart.eclairage)
+  assert.deepEqual(u.uSoleilIrr.value.toArray(), depart.soleil)
+  assert.deepEqual(u.uCielIrr.value.toArray(), depart.ciel)
+  assert.deepEqual(u.uSolIrr.value.toArray(), depart.sol)
+  assert.deepEqual(u.uAlbedoBase.value.toArray(), depart.base)
+  assert.equal(u.uAlbedoTeinte.value, depart.teinte)
+  assert.equal(u.uParoiCouleur.value.getHexString(), depart.paroi)
+  assert.equal(u.uSurfaceFx.value, depart.fx)
+  assert.equal(u.uFxOpacite.value, depart.fxOp)
+})
+
+test('④e SANS LIEU, PAS D’ÉCLAIRAGE — le repère est une dépendance', () => {
+  // ⛔ L'azimut et l'élévation sont exprimés dans le repère du SOCLE. Sans la
+  // latitude et la longitude du centre du crop, les replacer dans celui du
+  // globe reviendrait à poser le soleil du golfe de Guinée sur La Réunion.
+  const g = new Globe({ radius: 100 })
+  g.poserHabillage({
+    soleilAzimut: 302.1,
+    soleilElevation: 34.26,
+    soleilCouleur: '#fff7e6',
+    soleilIntensite: 3.74,
+    hemiCiel: '#85c2eb',
+    hemiSol: '#4a3a2a',
+    hemiIntensite: 0.81,
+  })
+  assert.equal(g.uniforms.uEclairageOn.value, 0)
+})
+
+test('④f poserTempsApparence pousse l’horloge, et refuse ce qui n’est pas un nombre', () => {
+  const g = new Globe({ radius: 100 })
+  g.poserTempsApparence(12.5)
+  assert.equal(g.uniforms.uFxTime.value, 12.5)
+  g.poserTempsApparence(undefined)
+  assert.equal(g.uniforms.uFxTime.value, 12.5)
+  g.poserTempsApparence(NaN)
+  assert.equal(g.uniforms.uFxTime.value, 12.5)
+})
+
+test('④g la couleur des parois est PARTAGÉE avec le matériau, pas recopiée', () => {
+  // ⚠️ Le matériau des parois est REFAIT à chaque reconstruction du solide ; une
+  // couleur posée dessus se perdrait au prochain déplacement. Et la palette
+  // change sans que les parois soient rebâties.
+  const g = new Globe({ radius: 100 })
+  const mat = g._materiauParois()
+  assert.equal(mat.uniforms.uCol, g.uniforms.uParoiCouleur)
+  g.poserHabillage({ paroiCouleur: '#123456' })
+  assert.equal(mat.uniforms.uCol.value.getHexString(), '123456')
+  assert.equal(/new THREE\.Color\('#d8d4cc'\) \}, \/\/ `params\.plinthColor`/.test(GLOBE_SRC), false)
+})
+
+test('④h le repère local : est / haut / nord, et les trois se vérifient', () => {
+  // ⚠️ La correspondance se LIT dans le dépôt : `latLonToWorld` (x = est,
+  // z = sud) et `latLonToSphere` (p = R·(cos φ sin λ, sin φ, cos φ cos λ)).
+  const lat = -21.26
+  const lon = 55.74
+  const haut = hautLocal(lat, lon)
+  assert.ok(Math.abs(Math.hypot(...haut) - 1) < 1e-12)
+  // à l'équateur / méridien zéro, le haut est +Z
+  assert.deepEqual(hautLocal(0, 0).map((v) => +v.toFixed(12)), [0, 0, 1])
+  // un soleil au ZÉNITH pointe exactement vers le haut local, où qu'on soit
+  for (const [la, lo] of [[0, 0], [45, 90], [-21.26, 55.74], [60, -120]]) {
+    const s = directionSoleilLocale(0, 90, la, lo)
+    const h = hautLocal(la, lo)
+    for (let k = 0; k < 3; k++) assert.ok(Math.abs(s[k] - h[k]) < 1e-12, `${la},${lo}`)
+  }
+  // un soleil à l'HORIZON est perpendiculaire au haut local, à tout azimut
+  for (const az of [0, 45, 90, 180, 302.1]) {
+    const s = directionSoleilLocale(az, 0, lat, lon)
+    const h = hautLocal(lat, lon)
+    assert.ok(Math.abs(s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) < 1e-12, `az=${az}`)
+  }
+  // et l'élévation est bien l'angle au plan horizontal
+  for (const el of [10, 34.26, 70]) {
+    const s = directionSoleilLocale(123, el, lat, lon)
+    const h = hautLocal(lat, lon)
+    const cos = s[0] * h[0] + s[1] * h[1] + s[2] * h[2]
+    assert.ok(Math.abs(cos - Math.sin((el * Math.PI) / 180)) < 1e-12, `el=${el}`)
+  }
+})
+
+test('④i irradianceAmbiante : UNE intensité, et zéro sans environnement', () => {
+  // ⛔ La première version multipliait AUSSI par `material.envMapIntensity`
+  // (0,15). `three` (`WebGLRenderer.js`) ÉCRASE cet uniforme par
+  // `scene.environmentIntensity` quand le matériau n'a pas d'`envMap` à lui —
+  // et `terrain.material.envMap === null`. C'était un facteur 6,7.
+  const coef = { ciel: [2, 3, 4], sol: [0.2, 0.3, 0.4] }
+  assert.deepEqual(irradianceAmbiante(coef, 0.5), { ciel: [1, 1.5, 2], sol: [0.1, 0.15, 0.2] })
+  assert.deepEqual(irradianceAmbiante(null, 0.5), { ciel: [0, 0, 0], sol: [0, 0, 0] })
+  assert.deepEqual(irradianceAmbiante(coef, 0), { ciel: [0, 0, 0], sol: [0, 0, 0] })
+  assert.deepEqual(irradianceAmbiante(coef, NaN), { ciel: [0, 0, 0], sol: [0, 0, 0] })
+  // ⚠️ et la source du coefficient est bien une MESURE, pas une constante
+  const sonde = readFileSync(new URL('../src/sonde-ambiante.js', import.meta.url), 'utf8')
+  assert.match(sonde, /readRenderTargetPixels/)
+  assert.match(sonde, /shadowMap\.needsUpdate/) // sauvé et reposé
+  assert.match(MAIN_SRC, /import \{ coefAmbiante \} from '\.\/sonde-ambiante\.js'/)
+})
+
+// ══════════ ⑤ LES GARDES DU NUANCEUR, ÉVALUÉES ═════════════════════════════
+
+test('⑤a les uniformes que FX_GLSL LIT sont tous déclarés dans le fragment', () => {
+  // ⚠️ Le module ne déclare AUCUN uniforme : son en-tête dit que l'hôte doit le
+  // faire. Un oubli ne se voit qu'à la compilation du nuanceur, sur le GPU.
+  for (const u of ['uFxScale', 'uFxTime', 'uFxColA', 'uFxColB', 'uFxColC', 'uFxP1', 'uFxP2', 'uFxP3']) {
+    assert.match(FRAG_NU, new RegExp(`uniform (?:float|vec3) ${u};`), `${u} non déclaré`)
+  }
+  for (const u of ['uSurfaceFx', 'uFxBlend']) assert.match(FRAG_NU, new RegExp(`uniform int ${u};`))
+  for (const u of ['uEclairageOn', 'uFxOpacite', 'uFxDemiBloc', 'uAlbedoTeinte']) {
+    assert.match(FRAG_NU, new RegExp(`uniform float ${u};`))
+  }
+  for (const u of ['uSoleilDir', 'uSoleilIrr', 'uHemiHaut', 'uCielIrr', 'uSolIrr', 'uAlbedoBase']) {
+    assert.match(FRAG_NU, new RegExp(`uniform vec3 ${u};`))
+  }
+  assert.match(FRAG_NU, /uniform vec2 uFxFenetre;/)
+})
+
+test('⑤b l’ordre d’injection est celui que les dépendances imposent', () => {
+  // `natSoftLight` (GLSL_NATUREL) est appelé par `fxBlend` (GLSL_MELANGE) ;
+  // `natLuminance` (GLSL_NATUREL) par `albedoCrop` (GLSL_ECLAIRAGE) ;
+  // et FX_GLSL lit des uniformes qui doivent être déclarés avant lui.
+  const iNat = FRAG_NU.indexOf('${GLSL_NATUREL}')
+  const iEcl = FRAG_NU.indexOf('${GLSL_ECLAIRAGE}')
+  const iFx = FRAG_NU.indexOf('${FX_GLSL}')
+  const iMel = FRAG_NU.indexOf('${GLSL_MELANGE}')
+  const iUni = FRAG_NU.indexOf('uniform float uFxScale;')
+  assert.ok(iNat > 0 && iEcl > iNat, 'GLSL_ECLAIRAGE après GLSL_NATUREL')
+  assert.ok(iMel > iNat, 'GLSL_MELANGE après GLSL_NATUREL')
+  assert.ok(iFx > iUni && iUni > 0, 'FX_GLSL après ses uniformes')
+  // côté socle, la même contrainte
+  assert.ok(TERRAIN_NU.indexOf('${GLSL_MELANGE}') > TERRAIN_NU.indexOf('${GLSL_NATUREL}'))
+})
+
+test('⑤c la garde est un UNIFORME, et à zéro le bloc n’existe pas', () => {
+  // ⚠️ `partBloc` est le SEUL chemin vers l'éclairage, l'albédo et l'apparence.
+  // Sa définition doit le rendre nul quand `uEclairageOn` vaut 0 — c'est ce qui
+  // garantit la production intouchée au bit près.
+  assert.match(FRAG_NU, /float partBloc = uEclairageOn > 0\.5 \? dedansCrop : 0\.0;/)
+  assert.match(FRAG_NU, /if \(partBloc > 0\.0\) \{/)
+  assert.match(FRAG_NU, /uFxOpacite > 0\.001 && partBloc > 0\.0/)
+  assert.match(FRAG_NU, /col = mix\(colPlanete, colBloc, partBloc\);/)
+  // et la loi de PLANÈTE est intacte, dans son ordre d'origine
+  assert.match(FRAG_NU, /vec3 colPlanete = col \* \(0\.74 \+ 0\.30 \* diff\);/)
+  assert.match(FRAG_NU, /colPlanete = mix\(uShadowColor, colPlanete, 0\.10 \+ 0\.90 \* day\);/)
+})
+
+test('⑤d dedansCrop est la SUPERELLIPSE, pas le carré de l’analyse', () => {
+  // ⛔ Le carré `dansCrop` borne la TEXTURE d'analyse ; la silhouette du bloc
+  // est la superellipse `dedans`, celle que les parois suivent au bit près.
+  assert.match(FRAG_NU, /float dedansCrop = 0\.0;/)
+  assert.match(FRAG_NU, /dedansCrop = dedans;/)
+  const iDedans = FRAG_NU.indexOf('float dedans = 1.0 - smoothstep')
+  const iPose = FRAG_NU.indexOf('dedansCrop = dedans;')
+  assert.ok(iDedans > 0 && iPose > iDedans)
+})
+
+test('⑤e l’albédo est fabriqué AVANT l’apparence et les traits de carte', () => {
+  // ⚠️ `terrain.js` mélange la peinture dans `diffuseColor` AVANT l'apparence,
+  // le trait de côte, les courbes et le graticule. Poser le mélange après eux
+  // fait repasser le motif dans `mix(fond, x, teinte)` : mesuré, l'apparence
+  // n'assombrissait plus le crop qu'à 0,73 contre 0,58 pour le socle.
+  const iAlbedo = FRAG_NU.indexOf('albedoCrop(col, uAlbedoBase')
+  const iFx = FRAG_NU.indexOf('fxBlend(col, fxc, uFxBlend)')
+  const iCote = FRAG_NU.indexOf('col = mix(col, uInk, cote * 0.55);')
+  const iContour = FRAG_NU.indexOf('col = mix(col, uInk, contour);')
+  const iLumiere = FRAG_NU.indexOf('vec3 colBloc = col * irradianceCrop(')
+  assert.ok(iAlbedo > 0 && iFx > iAlbedo, 'l’apparence peint sur l’albédo')
+  assert.ok(iCote > iFx, 'le trait de côte passe APRÈS l’apparence')
+  assert.ok(iContour > iCote, 'les courbes passent après le trait de côte')
+  assert.ok(iLumiere > iContour, 'la lumière multiplie en DERNIER')
+})
+
+test('⑤f le compte de samplers ne bouge pas — huit, pour un plafond de seize', () => {
+  // ⚠️ Cette tâche n'ajoute AUCUNE texture : que des uniformes scalaires et
+  // vectoriels. Le pavé de `globe.js` qui annonce huit doit rester vrai, et
+  // c'est la boucle qui compte, pas le commentaire.
+  const n = (FRAG_NU.match(/uniform sampler2D /g) || []).length
+  assert.equal(n, 8)
+})
+
+test('⑤g les défauts MONDE sont ceux des modules, pas des nombres recopiés', () => {
+  const g = new Globe({ radius: 100 })
+  const u = g.uniforms
+  assert.deepEqual(u.uSoleilIrr.value.toArray(), [...ECLAIRAGE_MONDE.soleilIrr])
+  assert.deepEqual(u.uCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
+  assert.deepEqual(u.uSolIrr.value.toArray(), [...ECLAIRAGE_MONDE.solIrr])
+  assert.deepEqual(u.uAlbedoBase.value.toArray(), [...ECLAIRAGE_MONDE.albedoBase])
+  assert.equal(u.uAlbedoTeinte.value, ECLAIRAGE_MONDE.albedoTeinte)
+  assert.equal(u.uSurfaceFx.value, APPARENCE_MONDE.surfaceFx)
+  assert.equal(u.uFxOpacite.value, APPARENCE_MONDE.fxOpacity)
+  assert.equal(u.uFxDemiBloc.value, APPARENCE_MONDE.fxDemiBloc)
+  // ⚠️ et le défaut de l'apparence est ÉTEINT : sans lui, toutes les tuiles du
+  // globe — y compris celles qui ne verront jamais de crop — porteraient un
+  // motif de bloc.
+  assert.equal(APPARENCE_MONDE.surfaceFx, 0)
+  assert.equal(APPARENCE_MONDE.fxOpacity, 0)
+  assert.equal(ECLAIRAGE_MONDE.albedoTeinte, 1)
+})
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index 193cd12..c6a57a9 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -547,34 +547,51 @@ test('⑧ le décodage de classe garde les trois précautions du socle', () => {
 //     et là-bas, poser de vrais tests avait révélé un vrai défaut. **Ici aussi :
 //     `retirerHabillage` ne remettait pas `uContourInterval`.**
 //   ⑩ le nuanceur est EXTRAIT PUIS EXÉCUTÉ, pas décrit. C'est le patron de la
 //     Tâche D (`test/crop-rampe.test.js`) : on prend le TEXTE du GLSL, on le
 //     traduit en JS et on l'appelle. Une garde retirée du nuanceur change alors
 //     une VALEUR, et l'assertion tombe.
 
 import { Globe } from '../src/globe.js'
 import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
 import { NATUREL_MONDE } from '../src/monde/naturel-crop.js'
+import { ECLAIRAGE_MONDE } from '../src/monde/eclairage-crop.js'
+import { APPARENCE_MONDE } from '../src/monde/melange-crop.js'
 
 // ══════════ ⑨ poserHabillage / retirerHabillage, EXERCÉES ══════════════════
 //
 // ⚠️ LA VERSION LIVRÉE NE LES COUVRAIT QUE PAR UN GREP DE NOM — quarante lignes
 // derrière `assert.ok(/poserHabillage/)`. C'est mot pour mot ce que la relecture
 // de la Tâche B avait déjà remonté sur `hauteurSurface`.
 
 const val = (v) => ({ value: v })
 const vec2 = (x, y) => ({ x, y, set(a, b) { this.x = a; this.y = b } })
 // ⚠️ **UNE COULEUR SE MUTE, ELLE NE SE REMPLACE PAS** — c'est le contrat de
 // `THREE.Color` que `poserHabillage` emploie (`u.uHazeColor.value.set(...)`), et
 // c'est aussi ce qui rend la couleur de brume INSURVEILLABLE par identité : le
 // contexte en transmet donc la valeur hexadécimale (voir `CHAMPS_HABILLAGE`).
-const couleurStub = (hex) => ({ hex, set(v) { this.hex = v } })
+const couleurStub = (hex) => ({
+  hex,
+  set(v) { this.hex = v },
+  // ⚠️ **`setStyle` EST L'AUTRE MUTATEUR, ET la Tâche P3 L'EMPLOIE** : c'est
+  // lui qui fait le passage sRVB → linéaire de three sur une chaîne '#rrggbb'.
+  setStyle(v) { this.hex = v },
+})
+// ⚠️ **UN VECTEUR À TROIS COMPOSANTES POUR LES IRRADIANCES — Tâche P3.** Elles
+// ne sont ni des couleurs (elles dépassent 1) ni des `vec2` : les poster dans
+// un stub à deux composantes aurait laissé le canal bleu invisible à ⑨h.
+const vec3 = (x, y, z) => ({
+  x, y, z,
+  set(a, b, c) { this.x = a; this.y = b; this.z = c; return this },
+  fromArray(t) { this.x = t[0]; this.y = t[1]; this.z = t[2]; return this },
+  normalize() { const n = Math.hypot(this.x, this.y, this.z) || 1; this.x /= n; this.y /= n; this.z /= n; return this },
+})
 
 /** Un globe minimal : rien que les uniformes et le repère du crop. */
 function globeStub(crop = REPERE) {
   return {
     _crop: crop,
     uniforms: {
       uHabOn: val(0),
       uCoastMask: val(null),
       uCoastMaskOn: val(0),
       uMargeCoteM: val(HABILLAGE_MONDE.margeCoteM),
@@ -604,29 +621,63 @@ function globeStub(crop = REPERE) {
       uHemi: val(NATUREL_MONDE.hemi),
       uTreeLine: val(NATUREL_MONDE.treeLine),
       uRampCrop: val(null),
       uRampCropOn: val(0),
       uHeightContrast: val(NATUREL_MONDE.heightContrast),
       uHeightPivot: val(NATUREL_MONDE.heightPivot),
       uHazeAmt: val(NATUREL_MONDE.hazeAmt),
       uHazeAlt: val(NATUREL_MONDE.hazeAlt),
       uHazeDist: val(NATUREL_MONDE.hazeDist),
       uHazeColor: val(couleurStub(NATUREL_MONDE.hazeColor)),
+      // ══════ L'ÉCLAIRAGE ET LA COUCHE APPARENCE — Tâche P3 ═══════════════
+      //
+      // ⚠️ **AUX MÊMES VALEURS QUE LE CONSTRUCTEUR**, pour la raison écrite
+      // dix lignes plus haut : c'est ce qui rend ⑨h capable de voir un
+      // uniforme que `retirerHabillage` oublierait de rendre.
+      uEclairageOn: val(0),
+      uSoleilDir: val(vec3(0, 1, 0)),
+      uSoleilIrr: val(vec3(...ECLAIRAGE_MONDE.soleilIrr)),
+      uHemiHaut: val(vec3(0, 1, 0)),
+      uCielIrr: val(vec3(...ECLAIRAGE_MONDE.cielIrr)),
+      uSolIrr: val(vec3(...ECLAIRAGE_MONDE.solIrr)),
+      uAlbedoBase: val(vec3(...ECLAIRAGE_MONDE.albedoBase)),
+      uAlbedoTeinte: val(ECLAIRAGE_MONDE.albedoTeinte),
+      uParoiCouleur: val(couleurStub('#d8d4cc')),
+      uSurfaceFx: val(APPARENCE_MONDE.surfaceFx),
+      uFxBlend: val(APPARENCE_MONDE.fxBlend),
+      uFxOpacite: val(APPARENCE_MONDE.fxOpacity),
+      uFxScale: val(APPARENCE_MONDE.fxScale),
+      uFxTime: val(APPARENCE_MONDE.fxTime),
+      uFxColA: val(couleurStub(APPARENCE_MONDE.fxColA)),
+      uFxColB: val(couleurStub(APPARENCE_MONDE.fxColB)),
+      uFxColC: val(couleurStub(APPARENCE_MONDE.fxColC)),
+      uFxP1: val(APPARENCE_MONDE.fxP1),
+      uFxP2: val(APPARENCE_MONDE.fxP2),
+      uFxP3: val(APPARENCE_MONDE.fxP3),
+      uFxDemiBloc: val(APPARENCE_MONDE.fxDemiBloc),
+      uFxFenetre: val(vec2(APPARENCE_MONDE.fxFenetreX, APPARENCE_MONDE.fxFenetreY)),
     },
   }
 }
 const poserHab = (g, arg) => Globe.prototype.poserHabillage.call(g, arg)
 const retirerHab = (g) => Globe.prototype.retirerHabillage.call(g)
 const lireHab = (g) => {
   const o = {}
   for (const [k, u] of Object.entries(g.uniforms)) {
-    o[k] = u.value && typeof u.value === 'object' && 'x' in u.value ? [u.value.x, u.value.y] : u.value
+    if (!u.value || typeof u.value !== 'object') { o[k] = u.value; continue }
+    // ⚠️ **LE TROISIÈME CANAL COMPTE — Tâche P3.** La lecture ne prenait que
+    // `x` et `y` : une irradiance dont seul le BLEU serait mal rendu par
+    // `retirerHabillage` serait passée inaperçue à ⑨h.
+    if ('z' in u.value) { o[k] = [u.value.x, u.value.y, u.value.z]; continue }
+    if ('x' in u.value) { o[k] = [u.value.x, u.value.y]; continue }
+    if ('hex' in u.value) { o[k] = `couleur:${u.value.hex}`; continue }
+    o[k] = u.value
   }
   return o
 }
 const TEX = { nom: 'une texture, peu importe laquelle' }
 
 test('⑨a poserHabillage ALLUME l’habillage — sinon elle ne fait rien du tout', () => {
   // ⚠️ MUTATION QUI SURVIVAIT : `poserHabillage` qui n'allume rien. Aucune
   // assertion ne tombait, et pourtant plus un seul poste ne s'exécutait.
   const g = globeStub()
   assert.equal(g.uniforms.uHabOn.value, 0)
diff --git a/test/crop-naturel.test.js b/test/crop-naturel.test.js
index ef28761..dec9738 100644
--- a/test/crop-naturel.test.js
+++ b/test/crop-naturel.test.js
@@ -402,28 +402,40 @@ test('③b AUCUNE des formules ne reparaît dans terrain.js ni dans globe.js', (
     { quoi: 'le plancher de pivot', interdit: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/, present: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/ },
     { quoi: 'le gain du peigné', interdit: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/, present: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/ },
   ]
   for (const src of [sansCommentaires(TERRAIN_SRC), sansCommentaires(GLOBE_SRC)]) {
     for (const f of FORMULES) assert.ok(!f.interdit.test(src), `formule réécrite : ${f.quoi}`)
   }
   // ... et chacune existe bien UNE fois dans le module, sinon on ne garde rien
   for (const f of FORMULES) assert.ok(f.present.test(GLSL_NATUREL), `formule absente du module : ${f.quoi}`)
 })
 
+/** Le texte d'un fichier, commentaires de ligne retires. */
+const sansComm = (t) => t.replace(/\/\/[^\n]*/g, ' ')
+
 test('③c le socle APPELLE les fonctions partagées — il ne les a pas juste importées', () => {
   const sansCommentaires = TERRAIN_SRC.replace(/\/\/[^\n]*/g, ' ')
   for (const appel of ['natPlancherPivot(', 'natRampT(', 'natHumiditeY(', 'natPeigne(', 'natVoile(', 'natBrume(', 'natLuminance(']) {
     assert.ok(sansCommentaires.includes(appel), `terrain.js n'appelle pas ${appel}`)
   }
   // ⚠️ ET `fxBlend` mode 10 DÉLÈGUE au soft light partagé plutôt que de le
   // réécrire : c'était la SEULE autre écriture du soft light du dépôt.
-  assert.match(sansCommentaires, /if \(m == 10\) return natSoftLight\(b, s\);/)
+  //
+  // ⚠️ **`fxBlend` A DÉMÉNAGÉ — Tâche P3, et l'assertion le suit.** Les modes de
+  // mélange vivent désormais dans `src/monde/melange-crop.js`, que `terrain.js`
+  // ET `globe.js` injectent : le crop porte la couche Apparence, et cette couche
+  // EST un mode de mélange. On exige les DEUX faits — la délégation dans le
+  // module, et l'injection dans le socle — sans quoi une seconde écriture sur
+  // place laisserait cette ligne verte.
+  const melange = sansComm(readFileSync(new URL('../src/monde/melange-crop.js', import.meta.url), 'utf8'))
+  assert.match(melange, /if \(m == 10\) return natSoftLight\(b, s\);/)
+  assert.match(sansCommentaires, /\$\{GLSL_MELANGE\}/)
 })
 
 // ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════
 
 test('④a `contexteCrop` transmet l’analyse ET la table du socle', () => {
   // ⛔ **C'ÉTAIT LE TROU.** `contexteCrop` ne portait AUCUNE texture d'analyse :
   // la richesse du socle était calculée, payée, et jetée à la porte du globe.
   const i = MAIN_SRC.indexOf('function contexteCrop()')
   assert.ok(i > 0, '`contexteCrop` introuvable')
   const bloc = MAIN_SRC.slice(i, MAIN_SRC.indexOf('\n}\n', i)).replace(/\/\/[^\n]*/g, ' ')
@@ -616,38 +628,53 @@ test('⑤d le pivot, la limite des arbres et le voile lisent hNormRelief — l
   assert.equal(plancherPivot(0), MARGE_PIVOT)
   // les trois lecteurs de l'échelle du socle emploient hNormRelief, aucun hNorm
   for (const appel of ['natRampT(hNormRelief,', 'natHumiditeY(anl.b, anl.a, hNormRelief,', 'natVoile(hNormRelief,']) {
     assert.ok(FRAG_GLOBE.includes(appel), `${appel} : un lecteur est resté sur l’échelle de la Tâche D`)
   }
 })
 
 // --- le stub, en fin de fichier : il n'est utile qu'aux tests ④
 
 const val = (v) => ({ value: v })
+const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this } })
+const couleurStub = () => ({ set() {}, setStyle() {} })
 function globeStub() {
   return {
     _crop: null,
     uniforms: {
       uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
       uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
       uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
       uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
       uGrainForceM: val(0), uGrainEchelle: val(96),
       uAnalysis: val(null), uAnalysisOn: val(0),
       uTexShade: val(NATUREL_MONDE.texShade), uWetK: val(NATUREL_MONDE.wetK),
       uExpoK: val(NATUREL_MONDE.expoK), uHemi: val(NATUREL_MONDE.hemi),
       uTreeLine: val(NATUREL_MONDE.treeLine),
       uRampCrop: val(null), uRampCropOn: val(0),
       uHeightContrast: val(NATUREL_MONDE.heightContrast), uHeightPivot: val(NATUREL_MONDE.heightPivot),
       uHazeAmt: val(NATUREL_MONDE.hazeAmt), uHazeAlt: val(NATUREL_MONDE.hazeAlt),
       uHazeDist: val(NATUREL_MONDE.hazeDist),
       uHazeColor: val({ hex: NATUREL_MONDE.hazeColor, set(v) { this.hex = v } }),
+      // ══════ L'ÉCLAIRAGE ET LA COUCHE APPARENCE — Tâche P3 ═══════════════
+      // Ce stub n'exerce que ④ : il lui suffit de PORTER les uniformes que
+      // `poserHabillage` écrit. Leur aller-retour bit à bit est vérifié par
+      // `crop-habillage` ⑨h et par `crop-eclairage` ④d.
+      uEclairageOn: val(0),
+      uSoleilDir: val(vecStub()), uSoleilIrr: val(vecStub()),
+      uHemiHaut: val(vecStub()), uCielIrr: val(vecStub()), uSolIrr: val(vecStub()),
+      uAlbedoBase: val(vecStub()), uAlbedoTeinte: val(1),
+      uParoiCouleur: val(couleurStub()),
+      uSurfaceFx: val(0), uFxBlend: val(0), uFxOpacite: val(0), uFxScale: val(1), uFxTime: val(0),
+      uFxColA: val(couleurStub()), uFxColB: val(couleurStub()), uFxColC: val(couleurStub()),
+      uFxP1: val(0), uFxP2: val(0), uFxP3: val(0),
+      uFxDemiBloc: val(28), uFxFenetre: val({ set() {} }),
     },
   }
 }
 
 test('⑤e sans crop, `smoothstep` du module et celui du GLSL parlent la même langue', () => {
   // ⚠️ **LE JUMEAU JS DOIT ÊTRE LE MÊME `smoothstep` QUE LE GPU**, sinon toute la
   // section ② compare deux erreurs. On confronte donc l'implémentation du module
   // à celle du transpileur, qui est écrite séparément.
   for (const x of balayage(200)) {
     assert.ok(Math.abs(smoothstep(0.2, 0.8, x * 1.4 - 0.2) - SMOOTHSTEP(0.2, 0.8, x * 1.4 - 0.2)) < 1e-15, `x=${x}`)
diff --git a/test/fenetre-branchee.test.js b/test/fenetre-branchee.test.js
index ed7ada6..aeab0cc 100644
--- a/test/fenetre-branchee.test.js
+++ b/test/fenetre-branchee.test.js
@@ -1378,22 +1378,38 @@ test('⑫g AUCUNE COMPOSANTE DE COULEUR N\'EST NaN — sur les DEUX chemins et s
   // la quantification de `dem.js`, et un plancher DÉLIBÉRÉMENT relevé d'un mètre
   // au-dessus du vrai minimum : c'est exactement l'état que produit un grain FBM
   // qui descend sous des extrema arrondis.
   d.minM = Math.round((d.minM + 1) * 2) / 2
   d.maxM = Math.round(d.maxM * 2) / 2
   const t3 = new Terrain(p3)
   t3.setDem(d)
   t3.rebuild(p3)
   assert.equal(nbNaN(t3), 0, 'emprise 3x3 a extrema quantifies : des couleurs NaN')
   // et la borne est bien dans le code, pas seulement dans le résultat
+  //
+  // ⚠️ **LA LOI A DÉMÉNAGÉ — Tâche P3, et l'assertion la suit.** La valeur par
+  // sommet vit désormais dans `src/monde/eclairage-crop.js` (`natGris`), que le
+  // crop du globe INJECTE en GLSL et que `terrain.js` APPELLE : une écriture,
+  // deux lecteurs. On exige donc les DEUX faits — la borne dans le module, et la
+  // délégation dans `terrain.js` — sans quoi il suffirait de réécrire la formule
+  // sur place pour que cette ligne reste verte.
   const src = sansCommentaires(lire('src/terrain.js'))
-  assert.ok(/Math\.pow\(Math\.max\(0, hn\), 0\.85\)/.test(src), 'la borne de `hn` a disparu de `_ecrireRelief`')
+  assert.ok(/let v = natGris\(hn, ny\)/.test(src), '`_ecrireRelief` ne délègue plus à `natGris`')
+  const loi = sansCommentaires(lire('src/monde/eclairage-crop.js'))
+  assert.ok(
+    /Math\.pow\(Math\.max\(0, hn\), GRIS_EXPO\)/.test(loi),
+    'la borne de `hn` a disparu de `natGris`'
+  )
+  assert.ok(
+    /pow\(max\(hn, 0\.0\), \$\{GRIS_EXPO\}\)/.test(loi),
+    'la borne de `hn` a disparu du GLSL de `natGris`'
+  )
 })
 
 // ══════════ ⑫h — LE BANC QUI MORD ══════════════════════════════════════════
 //
 // ⚠️ **⑫g NE MORDAIT PAS, ET C'EST MESURÉ.** Le 2026-08-21 la borne
 // `Math.max(0, hn)` a été retirée de `_ecrireRelief` et ⑫g relancé : ses DEUX
 // bancs sont restés VERTS, et seule sa dernière ligne — une lecture de la
 // source — rougissait. Un test qui ne tient plus que par un `grep` ne garde
 // rien : il s'éteint au premier renommage, et il annonce une couverture qu'il
 // n'a pas.
