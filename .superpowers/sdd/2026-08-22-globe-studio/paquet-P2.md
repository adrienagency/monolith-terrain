06b2339 tache P2 : le peigne du relief passe sur la sphere

 package.json                  |   2 +-
 src/globe.js                  | 295 ++++++++++++++++++-
 src/main.js                   |  56 ++++
 src/monde/branchement-crop.js |  31 ++
 src/monde/naturel-crop.js     | 362 +++++++++++++++++++++++
 src/terrain.js                |  93 +++---
 test/crop-habillage.test.js   |  41 ++-
 test/crop-naturel.test.js     | 655 ++++++++++++++++++++++++++++++++++++++++++
 test/crop-rampe.test.js       |  56 +++-
 9 files changed, 1523 insertions(+), 68 deletions(-)

diff --git a/package.json b/package.json
index ad6718b..d55dcdb 100644
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
-    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js",
+    "test": "node --test test/paiement.test.js test/compte-session.test.js test/compte-panne-liste.test.js test/compte-config.test.js test/compte-connexion.test.js test/compte-app.test.js test/comptes-cohesion.test.js test/compte-suppression.test.js test/garde-deploiement.test.js test/paiement-compte.test.js test/print-page.test.js test/export-cadrage.test.js test/export-dpi.test.js test/sonde-materielle.test.js test/affiche-tirage.test.js test/affiche-nettete.test.js test/affiche-mots.test.js test/affiche-ecran.test.js test/plancher-ui.test.js test/export-effets.test.js test/export-traits.test.js test/export-plafond.test.js test/export-pavage.test.js test/compositeur-affiche.test.js test/pdf-affiche.test.js test/coffre-affiche.test.js test/plafond-unites-texture.test.js test/geo.test.js test/clouds-sim.test.js test/boot-gate.test.js test/background.test.js test/gpx.test.js test/palette.test.js test/modes.test.js test/landmarks.test.js test/landmark-frame.test.js test/drag.test.js test/plinth.test.js test/camera-poses.test.js test/autofocus.test.js test/templates.test.js test/accordion.test.js test/ground-info.test.js test/lake.test.js test/sea-mask.test.js test/mer-cuisson.test.js test/region-mask.test.js test/zoom-detail.test.js test/coast-mask.test.js test/geo-data.test.js test/draped-line.test.js test/place-pick.test.js test/block-clip.test.js test/overpass.test.js test/places-minzoom.test.js test/history.test.js test/shortcuts.test.js test/river-width.test.js test/place-scale.test.js test/tile-index.test.js test/tile-loader.test.js test/tuiles-plafond.test.js test/water-layer.test.js test/share-link.test.js test/race-edit.test.js test/race-regie.test.js test/race-proprietaire.test.js test/sea-vendor.test.js test/sea-options.test.js test/store-catalog.test.js test/race-model.test.js test/transports.test.js test/relief-grade.test.js test/shuffle-pool.test.js test/bathy.test.js test/bathy-sources.test.js test/terrain-analysis.test.js test/dem-source.test.js test/dem-load.test.js test/ui-theme.test.js test/aerial-layer.test.js test/arch.test.js test/daycycle.test.js test/gpx-layers.test.js test/share-page.test.js test/sun-disc.test.js test/text-label.test.js test/templates-user.test.js test/publish-map.test.js test/fleet.test.js test/goto-frame.test.js test/geo-fr.test.js test/peak-mask.test.js test/region-grid.test.js test/region-skirt-floor.test.js test/damier-reseau.test.js test/damier-memoire.test.js test/route-entry.test.js test/route-waypoints.test.js test/grid-template.test.js test/detail-noise.test.js test/terrain-jobs.test.js test/globe-reseau.test.js test/peak-labels.test.js test/globe-eviction.test.js test/globe-precision.test.js test/globe-profondeur.test.js test/globe-source.test.js test/viewport-aspect.test.js test/export-presets.test.js test/atelier-steps.test.js test/gestes.test.js test/light-gain.test.js test/light-switches.test.js test/warmup.test.js test/hub-sas.test.js test/perf-gouverneur.test.js test/palier-machine.test.js test/geo-cells.test.js test/export-credit-bathy.test.js test/carte-ombre.test.js test/camera-shots.test.js test/drone-cam.test.js test/accueil.test.js test/dem-quant.test.js test/dem-emprise.test.js test/fenetre-course.test.js test/fenetre-centrage.test.js test/fenetre-elan.test.js test/detail-emprise.test.js test/grid-normals.test.js test/mer-emprise.test.js test/fenetre-clip.test.js test/fenetre-coin-exposant.test.js test/atlas-champs.test.js test/hints.test.js test/fenetre-reglage.test.js test/fenetre-finesse.test.js test/aides.test.js test/boutons-camera.test.js test/pilote.test.js test/poursuite.test.js test/gardien.test.js test/nuit.test.js test/nuit-recalage.test.js test/escalier-surface.test.js test/escalier-zoom.test.js test/occupation-sol.test.js test/reglages-couches.test.js test/canopee.test.js test/canopee-cuisson.test.js test/bathy-cuisson.test.js test/garde-plans-eau.test.js test/cloud-volume.test.js test/templates-livres.test.js test/socle-matiere.test.js test/carnet-course.test.js test/ruban-trace.test.js test/logo-course.test.js test/lissage.test.js test/course-bar.test.js test/gpx-largeur.test.js test/suivi-relance.test.js test/casse-titre.test.js test/vue-ensemble.test.js test/animations.test.js test/clic-ruban.test.js test/damier-carre.test.js test/damier-palier.test.js test/damier-hauteur.test.js test/damier-bords.test.js test/damier-clip-surface.test.js test/damier-mer.test.js test/damier-mer-runtime.test.js test/damier-nuit.test.js test/race-lecture.test.js test/xss-course.test.js test/damier-uniformes.test.js test/damier-cadre.test.js test/damier-eau-reseau.test.js test/bibliotheque-origine.test.js test/comptes-defense.test.js test/camera-continue.test.js test/seuil-branche.test.js test/seuil-socle.test.js test/flux-terrain.test.js test/descente-bornee.test.js test/audit-solide.test.js test/fenetre-bornee.test.js test/fenetre-branchee.test.js test/voile-whiteout.test.js test/voile-loading.test.js test/frontiere-rendu.test.js test/crop-sphere.test.js test/crop-parois.test.js test/exageration-globe.test.js test/crop-habillage.test.js test/crop-rampe.test.js test/mer-sphere.test.js test/estompage-terre.test.js test/crop-branche.test.js test/fond-crop.test.js test/loi-texture-monde.test.js test/echelle-continue.test.js test/veille-repos.test.js test/zoom-continu.test.js test/crop-naturel.test.js",
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
index 2ebb39c..6bc7ae9 100644
--- a/src/globe.js
+++ b/src/globe.js
@@ -82,20 +82,27 @@ import { FOV_DEG } from './monde/seuil-socle.js'
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
+// ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
+//
+// ⚠️ **CE N'EST PAS UNE COPIE DU SOCLE, C'EST LE MÊME TEXTE.** `terrain.js`
+// injecte `GLSL_NATUREL` dans SON fragment et ce fichier dans LE SIEN : il n'y a
+// qu'une seule écriture du peigné, de l'humidité, du pivot et du voile aérien.
+// `test/crop-naturel.test.js` interdit qu'une de ces formules soit réécrite ici.
+import { GLSL_NATUREL, NATUREL_MONDE } from './monde/naturel-crop.js'
 import {
   DEM_SOURCES,
   DemSourceError,
   activeDemSource,
   fallbackToAws,
   peekRegionMaxZoom,
   regionKey,
   resolveRegionMaxZoom,
 } from './dem-source.js'
 
@@ -711,20 +718,67 @@ uniform float uContourWeight; // le poids de trait du socle (uContourWeight)
 // c'est aussi la moitie verte du marbrage.
 //
 // ⚠️ SIXIEME SAMPLER. Le bloc ci-dessus compte CINQ liens (uTex, uRamp,
 // uCoastMask, uSol, uSolLut) pour un plafond de seize : celui-ci fait six, et le
 // raisonnement de ce bloc-la tient tel quel.
 uniform sampler2D uFondChamp;  // R : altitude du fond du crop, en unites locales
 uniform float uFondOn;
 uniform float uFondPortee;     // en demi-cotes de crop — la demi-largeur du champ
 uniform float uFondMetres;     // metres par unite locale : l'inverse de l'echelle
 
+// ══════ LA COLORISATION NATURELLE DU SOCLE — Tache P2 ══════════════════════
+//
+// > Adrien, 2026-08-22 : « Plus aucune texture sur la terre. » · « Je voudrais
+// > qu'on arrive a retrouver la texture comme elle etait avant de faire la
+// > modification vers la sphere. Pour l'instant le detail est trop basique. »
+//
+// ⚠️ CE QUI MANQUAIT N'ETAIT PAS UN REGLAGE, C'ETAIT LE FIL. La Tache C avait
+// porte l'EMBALLAGE de l'habillage (courbes, grain, cote, occupation du sol) et
+// mesure qu'il ne deplace que 1,01 % des pixels ; son bilan nommait ce qui
+// restait : « ce qui fait la richesse de l'image du socle, c'est le TEXTURE
+// SHADING et la rampe locale ». Or terrain-analysis.js n'a AUCUNE importation :
+// la texture d'analyse EXISTE deja, cuite pour le bloc, et personne ne la
+// passait au globe. contexteCrop la transmet desormais, comme uCoastMask et
+// uSol — meme patron, meme loi d'UV, demontree en tete de habillage-crop.js.
+//
+// ⚠️ SEPTIEME ET HUITIEME SAMPLERS, ET LE COMPTE EST REFAIT. Le bloc du masque
+// de cote comptait CINQ liens (uTex, uRamp, uCoastMask, uSol, uSolLut) ; le fond
+// du crop a fait SIX. uAnalysis et uRampCrop font HUIT, pour un plafond de
+// seize. Le raisonnement de ce bloc-la (ShaderMaterial NU : ni materiau de
+// surface, ni environnement, ni carte d'ombre) tient tel quel, et
+// test/crop-naturel.test.js COMPTE les sampler2D de ce fragment plutot que de
+// croire ce commentaire.
+//
+// R = peigne des cretes (0,5 = plat)   G = ombrage classique
+// B = humidite topographique           A = exposition (1 = plein nord)
+uniform sampler2D uAnalysis;
+uniform float uAnalysisOn;
+uniform float uTexShade;   // intensite du peigne
+uniform float uWetK;       // poids de l'humidite sur l'axe Y du LUT
+uniform float uExpoK;      // poids de l'exposition (adret / ubac)
+uniform float uHemi;       // +1 hemisphere nord, -1 sud : l'ubac change de cote
+uniform float uTreeLine;   // en hNorm : au-dessus, plus de vegetation
+// ⚠️ LA TABLE DU SOCLE, PAS UNE SECONDE TABLE. uRamp (512 x 1) est la rampe du
+// globe ; uRampCrop est LE MEME OBJET THREE que terrain.mapUniforms.uRampTex,
+// c'est-a-dire le LUT 2D du socle (X = altitude, Y = humidite), cuit par
+// buildRamp2D avec rampDry / rampWet / rampOklab. En rebatir un jumeau ici
+// aurait redonne deux tables a garder d'accord — et c'est par ce lien que
+// rampDry, rampWet et rampOklab arrivent sur la sphere SANS un seul uniforme.
+uniform sampler2D uRampCrop;
+uniform float uRampCropOn;
+uniform float uHeightContrast; // le contraste de rampe du socle
+uniform float uHeightPivot;    // son pivot, en hNorm
+uniform float uHazeAmt;        // perspective aerienne (Imhof) — force globale
+uniform float uHazeAlt;
+uniform float uHazeDist;
+uniform vec3 uHazeColor;
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
@@ -760,20 +814,26 @@ float mnNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); ret
 // impose une LUMINANCE tiree de la rampe, ce qui laisse le relief, les courbes
 // et la rampe hypsometrique se lire a travers. C'est toute la difference entre
 // une carte et un aplat colorie.
 float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
 vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
   if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
   if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
   return clamp(c, 0.0, 1.0); }
 vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
 
+// ⚠️ INJECTE, PAS RECOPIE — Tache P2. Ce meme texte entre dans le fragment de
+// terrain.js. C'est la seule ecriture du peigne, de l'humidite, du pivot et du
+// voile aerien ; les recopier ici aurait fait exactement les « deux ecritures
+// jumelles » dont terrain.js porte la cicatrice.
+${GLSL_NATUREL}
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
@@ -995,25 +1055,122 @@ void main() {
   // lieu de 0. Le socle pose bien les deux (uHeightRange, terrain.js:2084).
   //
   // ⚠️ ET LE PARTAGE MER / TERRE A 0,35 NE BOUGE PAS : c'est lui qui garantit
   // qu'un littoral reste un littoral d'un crop a l'autre.
   //
   // ⚠️ AUX VALEURS PAR DEFAUT (uLandBas = 0, uPlancherRampeM = 0), ces deux
   // lignes rendent EXACTEMENT h / uLandMax et -h / uOceanDepth : max(5600-0, 0)
   // vaut 5600, max(6000, 0) vaut 6000, et h - 0.0 vaut h. La production est
   // intouchee au bit pres, et test/crop-rampe.test.js le prouve par un Object.is
   // sur 2 001 hauteurs.
+  // ⚠️ hNorm EST NOMME, PAS DUPLIQUE — Tache P2. Il etait deja calcule, en
+  // toutes lettres, dans la branche TERRE de float t ; la colorisation naturelle
+  // en a besoin quatre fois de plus (pivot, limite des arbres, voile aerien).
+  // L'ecrire une seconde fois plus bas aurait donne deux amplitudes locales a
+  // garder d'accord. La branche terre le REUTILISE : 0.35 + 0.65 * hNorm est
+  // l'expression du depot au bit pres, et test/crop-rampe.test.js l'evalue.
+  float hNorm = clamp((h - uLandBas) / max(uLandMax - uLandBas, uPlancherRampeM), 0.0, 1.0);
   float t = sousEau
     ? 0.35 * (1.0 - clamp(-h / max(uOceanDepth, uPlancherRampeM), 0.0, 1.0))
-    : 0.35 + 0.65 * clamp((h - uLandBas) / max(uLandMax - uLandBas, uPlancherRampeM), 0.0, 1.0);
+    : 0.35 + 0.65 * hNorm;
   vec3 col = texture2D(uRamp, vec2(t, 0.5)).rgb;
 
+  // ══════ LA TERRE PREND LA TABLE ET LA LOI DE RAMPE DU SOCLE — Tache P2 ═════
+  //
+  // ⚠️ CE N'EST PAS UNE SECONDE PALETTE : uRampCrop EST l'objet uRampTex du
+  // socle. La table 2D porte deja rampDry, rampWet et l'interpolation Oklab du
+  // mode Naturel — trois reglages qui arrivent donc sur la sphere sans un seul
+  // uniforme de plus, et sans qu'aucune couleur ne soit recalculee ici.
+  //
+  // ⚠️ ET LES DEUX CURSEURS QUE rampe-crop.js NE LISAIT PAS SONT ICI :
+  // uHeightContrast et uHeightPivot. Le gabarit d'ouverture pose 1,5 et 0,6 ;
+  // « realistic » pose 5,1 et 0,53. Aux defauts (1 et 0,5) natRampT rend hNorm
+  // AU BIT PRES, donc uRampCropOn a 0 n'est pas la seule garde : la loi elle-meme
+  // est neutre. Le pivot ne peut jamais descendre sous le niveau de la mer, qui
+  // sur le globe est h = 0, donc hNorm = (0 - uLandBas) / amplitude.
+  //
+  // ⚠️ LES ALENTOURS SUIVENT, exactement comme uLandBas / uLandMax (decision 4
+  // d'Adrien) : ces uniformes vivent dans this.uniforms, que _materialFor etale
+  // dans chaque materiau de tuile. Hors du crop l'analyse rend son neutre (voir
+  // plus bas), donc la ligne mediane du LUT, donc la rampe historique.
+  // ⛔ ET hNorm N'EST PAS LE MEME DES DEUX COTES — MESURE, PAS SUPPOSE.
+  //
+  // Le socle normalise sur uHeightRange, qui est l'amplitude COMPLETE de son
+  // MNT, FOND MARIN COMPRIS (dem.minM / dem.maxM). Releve dans l'application
+  // vivante, La Reunion z12 : uHeightRange couvre -2 116 a 2 626 m, donc le
+  // NIVEAU DE LA MER y tombe a hNorm = 0,4466 — pas a zero. Le hNorm de la
+  // Tache D, lui, part de uLandBas (le minimum de la TERRE), donc la mer y est a
+  // zero : c'est le bon choix pour float t, ou la mer a son propre segment
+  // [0 ; 0,35], et le MAUVAIS pour uHeightPivot et uTreeLine, qui sont des
+  // reglages d'utilisateur exprimes dans l'echelle du socle.
+  //
+  // ⛔ CE QUE CA DONNAIT, CHIFFRE : avec pivot 0,65 et contraste 2,5 (les valeurs
+  // vivantes), natRampT rendait ZERO pour TOUT ce qui est sous 1 163 m — un aplat
+  // olive sur toute l'ile — la ou le socle etale deja 0 a 0,78 sur la meme
+  // tranche. La limite des arbres tombait a 2 378 m au lieu de 2 247 m.
+  //
+  // ➡️ LA CONVERSION EST EXACTE, ET ELLE NE DEMANDE AUCUNE MESURE NEUVE : le
+  // minimum du relief du crop EST -uOceanDepth (rampe-crop.js : profondeur =
+  // -min(0, minM)) et son maximum uLandMax. Releve le meme jour : -2 106,8 et
+  // 2 584,4 contre -2 116 et 2 626 cote socle, soit un ecart de 0,0029 sur le
+  // hNorm du niveau de la mer. C'est la MEME grandeur, mesuree par deux
+  // balayages de finesse differente.
+  float hNormRelief = clamp((h + uOceanDepth) / max(uLandMax + uOceanDepth, uPlancherRampeM), 0.0, 1.0);
+
+  vec4 anl = vec4(0.5);
+  if (uAnalysisOn > 0.5) {
+    // ⛔ LA BORNE N'EST PAS DECORATIVE, ET C'EST LE MEME PIEGE QUE uFondChamp.
+    // La texture d'analyse est cuite pour le CROP ; en ClampToEdge, sa derniere
+    // ligne se prolongerait sur toute la planete estompee et peignerait les
+    // Andes avec le peigne de La Reunion, sans qu'aucune erreur ne soit levee.
+    // On fond donc vers le NEUTRE (0,5) hors du crop, ce qui est exactement
+    // « pas d'analyse ici » — et sans branche dependante de la donnee, dont les
+    // derivees de mipmap seraient indefinies.
+    float dansCrop = step(max(abs(qCrop.x), abs(qCrop.y)), 1.0);
+    anl = mix(vec4(0.5), texture2D(uAnalysis, qCrop * 0.5 + 0.5), dansCrop);
+  }
+  if (uRampCropOn > 0.5 && !sousEau) {
+    // ⚠️ hNormRelief PARTOUT DANS CE BLOC, ET JAMAIS hNorm : uHeightPivot,
+    // uTreeLine et uHazeAlt sont des reglages POSES PAR L'UTILISATEUR dans
+    // l'echelle du socle, et l'echelle du socle porte le fond marin. Voir la
+    // demonstration chiffree juste au-dessus.
+    float pivot = max(uHeightPivot, natPlancherPivot(uOceanDepth / max(uLandMax + uOceanDepth, uPlancherRampeM)));
+    float rampT = natRampT(hNormRelief, pivot, uHeightContrast);
+    float wetY = natHumiditeY(anl.b, anl.a, hNormRelief, uWetK, uExpoK, uHemi, uTreeLine);
+    col = texture2D(uRampCrop, vec2(rampT, wetY)).rgb;
+  }
+
+  // ══════ LE PEIGNE DES CRETES — LA DEMANDE D'ADRIEN, ET RIEN D'AUTRE ════════
+  //
+  // « Plus aucune texture sur la terre. » C'est CE bloc qui manquait. Le socle le
+  // pose depuis terrain.js ; il vit desormais dans naturel-crop.js et les deux
+  // nuanceurs l'appellent. uTexShade vaut 1 dans le gabarit d'ouverture.
+  //
+  // ⚠️ TERRE SEULE, comme dans le socle : la branche sous-marine de terrain.js
+  // ne voit jamais ce bloc. Le poser sur le fond marin peignerait des cretes
+  // dans une bathymetrie qui n'en porte pas.
+  if (uAnalysisOn > 0.5 && uTexShade > 0.001 && !sousEau) {
+    col = natPeigne(col, anl.r, anl.g, uTexShade);
+  }
+
+  // ══════ LA PERSPECTIVE AERIENNE (Imhof) — Tache P2 ═════════════════════════
+  //
+  // ⚠️ fd EST length(qCrop), ET C'EST LA MEME GRANDEUR QUE CELLE DU SOCLE, PAS
+  // UNE APPROXIMATION : terrain.js divise par uSlabHalf = 28 une distance en
+  // unites de scene, et l'en-tete de habillage-crop.js DEMONTRE x = 28 * u. Le
+  // quotient est donc qCrop, terme a terme.
+  if (uRampCropOn > 0.5 && uHazeAmt > 0.001 && !sousEau) {
+    float fd = clamp(length(qCrop), 0.0, 1.0);
+    float veil = natVoile(hNormRelief, fd, uHazeAmt, uHazeAlt, uHazeDist);
+    col = natBrume(col, natLuminance(col), veil, uHazeColor, uHazeAmt);
+  }
+
   // ══════ LE FOND MARIN PREND LA RAMPE NAUTIQUE DU SOCLE ════════════════════
   //
   // Transcription EXACTE de terrain.js:1019-1023 — meme exposant 0,55, meme
   // coude a 0,45, memes trois couleurs. La seule difference est l'unite : le
   // socle mesure sa profondeur en unites de scene (uSeaY - y sur uSeaRange), le
   // globe en METRES BRUTS (-h sur uOceanDepth, que poserRampe cale deja sur la
   // profondeur mesuree du crop). Le rapport est le meme, donc la couleur aussi.
   //
   // ⚠️ ET LE PLANCHER EST CELUI DE LA TACHE D, PAS UN NOUVEAU : uPlancherRampeM.
   // En poser un second aurait donne deux gardes de division qui divergent.
@@ -1774,20 +1931,53 @@ export class Globe {
       // aussi : le fond est une propriété du CROP, pas de la tuile.
       //
       // ⚠️ **`uFondMetres` PART À 1 ET NON À 0** : c'est un DIVISEUR déguisé (le
       // champ est cuit en unités locales, `brut × echelle`), et un zéro par
       // défaut rendrait un fond marin plat au niveau de la mer le jour où
       // quelqu'un allumerait `uFondOn` sans poser l'échelle.
       uFondChamp: { value: null },
       uFondOn: { value: 0 },
       uFondPortee: { value: PORTEE_CROP },
       uFondMetres: { value: 1 },
+
+      // LA COLORISATION NATURELLE — Tâche P2.
+      //
+      // ⚠️ **`uAnalysisOn: 0` ET `uRampCropOn: 0` : sans `poserHabillage`, RIEN
+      // NE CHANGE** — même garde et même raison que `uCropOn`, `uHabOn`,
+      // `uMerRampeOn` et `uFondOn`. Le nuanceur est PARTAGÉ par toutes les
+      // tuiles de la planète, y compris celles qui ne verront jamais de crop.
+      //
+      // ⚠️ **ET LES CURSEURS LISENT `NATUREL_MONDE`, ILS NE RECOPIENT PAS SES
+      // NOMBRES.** C'est la discipline de `HABILLAGE_MONDE` et de `RAMPE_MONDE` :
+      // une seule écriture, lue par le constructeur ET par `retirerHabillage`.
+      // Deux littéraux jumeaux avaient déjà divergé en silence une fois sur ce
+      // chantier (`uContourInterval`, réparé par la Tâche C au tour 1).
+      //
+      // ⚠️ **`heightContrast: 1` ET `heightPivot: 0,5` NE SONT PAS UN GOÛT** :
+      // `natRampT(hNorm, 0.5, 1.0)` rend `hNorm` **au bit près**, donc la loi
+      // elle-même est neutre au repos — la garde `uRampCropOn` n'est pas le seul
+      // filet, et `test/crop-naturel.test.js` le prouve sur un balayage.
+      uAnalysis: { value: null },
+      uAnalysisOn: { value: 0 },
+      uTexShade: { value: NATUREL_MONDE.texShade },
+      uWetK: { value: NATUREL_MONDE.wetK },
+      uExpoK: { value: NATUREL_MONDE.expoK },
+      uHemi: { value: NATUREL_MONDE.hemi },
+      uTreeLine: { value: NATUREL_MONDE.treeLine },
+      uRampCrop: { value: null },
+      uRampCropOn: { value: 0 },
+      uHeightContrast: { value: NATUREL_MONDE.heightContrast },
+      uHeightPivot: { value: NATUREL_MONDE.heightPivot },
+      uHazeAmt: { value: NATUREL_MONDE.hazeAmt },
+      uHazeAlt: { value: NATUREL_MONDE.hazeAlt },
+      uHazeDist: { value: NATUREL_MONDE.hazeDist },
+      uHazeColor: { value: new THREE.Color(NATUREL_MONDE.hazeColor) },
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
@@ -2216,35 +2406,82 @@ export class Globe {
    * @param {number} arg.solOpacite
    * @param {{x:number,y:number}|null} arg.solOffset
    * @param {{x:number,y:number}|null} arg.solScale
    * @param {{x:number,y:number}|null} arg.solTexel
    * @param {number|null} arg.amplitudeM - amplitude du relief du crop, en mètres
    * @param {number|null} arg.contourIntervalM - impose l'intervalle (sinon calé)
    * @param {number} arg.contourOpacity
    * @param {number} arg.contourWeight
    * @param {number} arg.grainForceM - amplitude du grain, en MÈTRES de relief
    * @param {number} arg.grainEchelle
+   *
+   * ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
+   *
+   * ⚠️ **ELLE ENTRE PAR L'HABILLAGE, ET PAS PAR `poserRampe` — C'EST UNE
+   * DÉCISION.** `poserRampe` REFUSE quand la couverture du crop est incomplète
+   * (`refus: 'couverture'`), et un refus « ne touche pas à ce qui est en place ».
+   * L'analyse, elle, n'est jamais mesurée : c'est une texture déjà cuite par le
+   * socle. La faire dépendre d'une mesure l'aurait rendue absente exactement
+   * quand la Tâche K ter a montré qu'elle manque — pendant la course de
+   * chargement. Et l'habillage est le SEUL maillon que la veille rafraîchit par
+   * image dès qu'un champ change (`CHAMPS_HABILLAGE`), ce dont l'analyse a
+   * besoin : elle arrive du travailleur, longtemps après la naissance du crop.
+   *
+   * @param {THREE.Texture|null} arg.analyse - `terrain.mapUniforms.uAnalysis`,
+   *   la RGBA de `terrain-analysis.js` (R peigné, G ombrage, B humidité,
+   *   A exposition). `null` = pas d'analyse, l'uniforme s'éteint.
+   * @param {THREE.Texture|null} arg.rampe2D - `terrain.mapUniforms.uRampTex`,
+   *   le LUT 2D du socle. ⚠️ **C'EST LE MÊME OBJET, PAS UNE COPIE** : c'est par
+   *   lui que `rampDry`, `rampWet` et `rampOklab` arrivent sur la sphère.
+   * @param {number} arg.texShade
+   * @param {number} arg.wetK
+   * @param {number} arg.expoK
+   * @param {number} arg.hemi
+   * @param {number} arg.treeLine
+   * @param {number} arg.heightContrast
+   * @param {number} arg.heightPivot
+   * @param {number} arg.hazeAmt
+   * @param {number} arg.hazeAlt
+   * @param {number} arg.hazeDist
+   * @param {string|number|null} arg.hazeColor - ⚠️ **UNE VALEUR, PAS L'OBJET
+   *   `THREE.Color` DU SOCLE.** Le socle le MUTE en place (`.set(...)`), donc son
+   *   identité ne bouge jamais : partagé, il aurait fait de `this.uniforms` un
+   *   porteur de poignée sur l'état du bloc, et `habillageDifferent` n'aurait
+   *   jamais vu la couleur changer.
    */
   poserHabillage({
     coastMask = null,
     sol = null,
     solLut = null,
     solOpacite = 1,
     solOffset = null,
     solScale = null,
     solTexel = null,
     amplitudeM = null,
     contourIntervalM = null,
     contourOpacity = null,
     contourWeight = 0.7,
     grainForceM = 0,
     grainEchelle = 96,
+    analyse = null,
+    rampe2D = null,
+    texShade = NATUREL_MONDE.texShade,
+    wetK = NATUREL_MONDE.wetK,
+    expoK = NATUREL_MONDE.expoK,
+    hemi = NATUREL_MONDE.hemi,
+    treeLine = NATUREL_MONDE.treeLine,
+    heightContrast = NATUREL_MONDE.heightContrast,
+    heightPivot = NATUREL_MONDE.heightPivot,
+    hazeAmt = NATUREL_MONDE.hazeAmt,
+    hazeAlt = NATUREL_MONDE.hazeAlt,
+    hazeDist = NATUREL_MONDE.hazeDist,
+    hazeColor = null,
   } = {}) {
     const u = this.uniforms
     u.uHabOn.value = 1
 
     u.uCoastMask.value = coastMask
     u.uCoastMaskOn.value = coastMask ? 1 : 0
     // ⚠️ **LA MARGE EST CONVERTIE, PAS RECOPIÉE.** Le socle écrit
     // `vWorldPos.y < uSeaY + 0.02` en UNITÉS DE SCÈNE, sur un relief déjà
     // exagéré ; le globe tient sa hauteur en MÈTRES BRUTS. Recopier « 0.02 »
     // aurait donné deux centimètres — cinquante fois trop court, donc un liseré
@@ -2264,20 +2501,46 @@ export class Globe {
     // en dur, valables pour le monde entier : à l'île Maurice, qui culmine à
     // 800 m, cela ne trace qu'UNE courbe. C'est la ligne « échelle » du §3 du
     // plan, appliquée aux lignes au lieu du dégradé.
     if (contourIntervalM > 0) u.uContourInterval.value = contourIntervalM
     else if (amplitudeM > 0) u.uContourInterval.value = intervalleCourbes(amplitudeM)
     if (contourOpacity != null) u.uContourOpacity.value = contourOpacity
     u.uContourWeight.value = contourWeight
 
     u.uGrainForceM.value = grainForceM
     u.uGrainEchelle.value = grainEchelle
+
+    // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
+    //
+    // ⚠️ **DEUX INTERRUPTEURS ET NON UN, PARCE QUE LES DEUX ARRIVENT SÉPARÉMENT
+    // ET QUE LEUR ABSENCE NE VEUT PAS LA MÊME CHOSE.** Le LUT 2D existe TOUJOURS
+    // (le socle le cuit dès la première palette, en Classique comme en Naturel :
+    // en Classique il est constant en Y et sa ligne médiane EST la rampe
+    // historique) ; l'analyse, elle, n'existe qu'en mode Naturel et seulement une
+    // fois le travailleur revenu. Un seul interrupteur aurait donc éteint le
+    // pivot et le contraste de rampe — qui, eux, valent dans les DEUX modes —
+    // pendant toute l'attente de l'analyse.
+    u.uAnalysis.value = analyse
+    u.uAnalysisOn.value = analyse ? 1 : 0
+    u.uTexShade.value = texShade
+    u.uWetK.value = wetK
+    u.uExpoK.value = expoK
+    u.uHemi.value = hemi
+    u.uTreeLine.value = treeLine
+    u.uRampCrop.value = rampe2D
+    u.uRampCropOn.value = rampe2D ? 1 : 0
+    u.uHeightContrast.value = heightContrast
+    u.uHeightPivot.value = heightPivot
+    u.uHazeAmt.value = hazeAmt
+    u.uHazeAlt.value = hazeAlt
+    u.uHazeDist.value = hazeDist
+    if (hazeColor != null) u.uHazeColor.value.set(hazeColor)
     return u
   }
 
   /**
    * Retire l'habillage — le globe reprend son propre rendu, au bit près.
    *
    * ⚠️ **CETTE PROMESSE ÉTAIT FAUSSE, ET LE TOUR 1 L'A CORRIGÉE.** La version
    * livrée ne rendait que quatre uniformes sur seize. Or `uContourInterval` et
    * `uContourOpacity` sont **PARTAGÉS par toutes les tuiles** et le bloc des
    * courbes les lit **SANS GARDE** — `uHabOn` à 0 ne les neutralise pas. Après
@@ -2301,20 +2564,50 @@ export class Globe {
     u.uSolOn.value = 0
     u.uSolOpacite.value = HABILLAGE_MONDE.solOpacite
     u.uSolOffset.value.set(0, 0)
     u.uSolScale.value.set(1, 1)
     u.uSolTexel.value.set(1 / 2048, 1 / 2048)
     u.uContourInterval.value = HABILLAGE_MONDE.contourIntervalM
     u.uContourOpacity.value = HABILLAGE_MONDE.contourOpacite
     u.uContourWeight.value = HABILLAGE_MONDE.contourPoids
     u.uGrainForceM.value = HABILLAGE_MONDE.grainForceM
     u.uGrainEchelle.value = HABILLAGE_MONDE.grainEchelle
+    // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════════
+    //
+    // ⚠️ **LES DEUX TEXTURES SONT LÂCHÉES, PAS SEULEMENT DÉBRANCHÉES** — même
+    // raison que le masque de côte deux lignes plus haut : gardées dans un
+    // uniforme PARTAGÉ, l'analyse et le LUT du crop précédent restaient
+    // joignables par le ramasse-miettes, et l'analyse d'un MNT 1536² pèse 12 Mo
+    // mipmaps comprises (`terrain.js`, `_analysisMax`).
+    //
+    // ⚠️ **ET LES CURSEURS SONT RENDUS AUSSI, ALORS QU'ILS SONT DÉJÀ GARDÉS.**
+    // Ce n'est pas du code mort : `uHeightContrast` et `uHeightPivot` entrent
+    // dans `natRampT` **sous la seule garde `uRampCropOn`**, et l'aller-retour
+    // bit-à-bit que `test/crop-habillage.test.js` (⑨) exige des seize uniformes
+    // de l'habillage porte sur les VALEURS, pas sur leur effet — un uniforme
+    // resté au réglage d'un crop mort est un état qui traîne, et ce fichier en a
+    // déjà payé un (`uContourInterval`, la planète entière à 250 m).
+    u.uAnalysis.value = null
+    u.uAnalysisOn.value = 0
+    u.uTexShade.value = NATUREL_MONDE.texShade
+    u.uWetK.value = NATUREL_MONDE.wetK
+    u.uExpoK.value = NATUREL_MONDE.expoK
+    u.uHemi.value = NATUREL_MONDE.hemi
+    u.uTreeLine.value = NATUREL_MONDE.treeLine
+    u.uRampCrop.value = null
+    u.uRampCropOn.value = 0
+    u.uHeightContrast.value = NATUREL_MONDE.heightContrast
+    u.uHeightPivot.value = NATUREL_MONDE.heightPivot
+    u.uHazeAmt.value = NATUREL_MONDE.hazeAmt
+    u.uHazeAlt.value = NATUREL_MONDE.hazeAlt
+    u.uHazeDist.value = NATUREL_MONDE.hazeDist
+    u.uHazeColor.value.set(NATUREL_MONDE.hazeColor)
   }
 
   // ═══════════ LA RAMPE — Tâche D, « calculée sur le crop, suivie par les
   //             alentours » ══════════════════════════════════════════════════
   //
   // **Décision 4 d'Adrien, mot pour mot :** « La rampe se calcule SUR LE CROP,
   // et les alentours la suivent. » Couleurs stables et reproductibles pour
   // l'affiche, **aucune couture au bord**.
   //
   // ⚠️ **C'EST LE DÉFAUT QUE SES CAPTURES MONTRENT, ET IL EST CHIFFRÉ** : à
diff --git a/src/main.js b/src/main.js
index b92b1fc..ab8e3b4 100644
--- a/src/main.js
+++ b/src/main.js
@@ -4862,20 +4862,42 @@ function contexteCrop() {
   if (!a) return null
   const { centre, zoom } = a
 
   // ⚠️ **LES UNIFORMES SE LISENT UN PAR UN, JAMAIS EN BLOC.** `terrain.mapUniforms`
   // cédé à une variable est une poignée sur le bloc central, et
   // `test/damier-uniformes.test.js` (③) l'exige déclarée : ce qu'un porteur de
   // poignée écrit n'atteint jamais les dalles voisines. Ici on ne fait que LIRE,
   // et le plus simple est de ne pas prendre la poignée du tout.
   const cote = terrain.mapUniforms.uCoastMaskOn.value > 0.5 ? terrain.mapUniforms.uCoastMask.value : null
   const sol = terrain.mapUniforms.uSolOn.value > 0.5 ? terrain.mapUniforms.uSol.value : null
+  // ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
+  //
+  // ⛔ **LE TROU QUI FAISAIT DIRE À ADRIEN « PLUS AUCUNE TEXTURE SUR LA TERRE ».**
+  // Ce contexte ne transmettait AUCUNE texture d'analyse. Or `terrain-analysis.js`
+  // en cuit une, empaquetée en RGBA (R peigné, G ombrage, B humidité,
+  // A exposition), et le gabarit d'ouverture (`shibustart.json`) la demande à
+  // fond : `colorMode: "natural"`, `texShade: 1`, `wetK: 0,96`. **Elle existait,
+  // elle était payée, et personne ne la passait au globe.**
+  //
+  // ⚠️ **MÊME PATRON QUE `cote` ET `sol` JUSTE AU-DESSUS, ET CE N'EST PAS UN
+  // STYLE** : l'interrupteur du socle décide, la texture suit. `uAnalysisOn` vaut
+  // déjà 0 hors du mode Naturel (`terrain.js`, `setColorMode`) et tant que le
+  // travailleur n'a pas rendu son champ — le lire ici, c'est hériter des deux
+  // gardes sans en écrire une troisième.
+  const analyse = terrain.mapUniforms.uAnalysisOn.value > 0.5 ? terrain.mapUniforms.uAnalysis.value : null
+  // ⚠️ **LE LUT 2D PASSE TOUJOURS, MODE NATUREL OU PAS.** En Classique
+  // `rebuildRamp` le cuit constant en Y, et sa ligne médiane EST la rampe
+  // historique (`terrain.js` : « aucune palette du catalogue n'a besoin d'être
+  // ré-éditée ») ; ce qui compte alors, ce sont `heightContrast` et
+  // `heightPivot`, qui valent dans les DEUX modes et que le gabarit « realistic »
+  // pousse à 5,1. Le conditionner au mode Naturel les aurait laissés morts.
+  const rampe2D = terrain.mapUniforms.uRampTex.value || null
   // l'amplitude du relief du crop : elle CALE l'intervalle des courbes de niveau
   // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
   const f = terrain.fenetreBornee
   const amplitudeM = Number.isFinite(f?.maxM) && Number.isFinite(f?.minM)
     ? f.maxM - f.minM
     : (Number.isFinite(dem?.maxM) && Number.isFinite(dem?.minM) ? dem.maxM - dem.minM : null)
 
   const ctx = {
     centre,
     zoom,
@@ -4884,20 +4906,54 @@ function contexteCrop() {
       coastMask: cote,
       sol,
       solLut: sol ? terrain.mapUniforms.uSolLut.value : null,
       solOpacite: terrain.mapUniforms.uSolOpacite.value,
       solOffset: terrain.mapUniforms.uSolOffset.value,
       solScale: terrain.mapUniforms.uSolScale.value,
       solTexel: terrain.mapUniforms.uSolTexel.value,
       amplitudeM: amplitudeM > 0 ? amplitudeM : null,
       contourOpacity: terrain.mapUniforms.uContourOpacity.value,
       contourWeight: terrain.mapUniforms.uContourWeight.value,
+      // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════
+      //
+      // ⚠️ **LES SEPT SOUS-RÉGLAGES D'ATLAS PASSENT ICI, ET LES DEUX CURSEURS DE
+      // RAMPE AVEC EUX.** L'inventaire les comptait morts : `texShade`, `wetK`,
+      // `expoK`, `treeLine`, `hazeAmt` **ne traversaient pas** ; `rampDry`,
+      // `rampWet` et `rampOklab` non plus. Les cinq premiers sont des uniformes ;
+      // les trois derniers arrivent **cuits dans `rampe2D`**, ce qui est
+      // précisément pourquoi on partage la table du socle au lieu d'en rebâtir
+      // une. `heightContrast` et `heightPivot` ferment les deux derniers.
+      //
+      // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`.** `applyColorParams`
+      // est la seule écriture de ces valeurs, et elle porte deux règles que
+      // `params` ne porte pas : les défauts (`?? 0`, `?? 0.62`) et surtout
+      // `uHemi`, que le socle dérive de la LATITUDE du MNT et non d'un réglage.
+      // Passer par `params` aurait fait diverger le globe du bloc le jour où
+      // l'une de ces règles change — le défaut que la Tâche K ter a payé.
+      analyse,
+      rampe2D,
+      texShade: terrain.mapUniforms.uTexShade.value,
+      wetK: terrain.mapUniforms.uWetK.value,
+      expoK: terrain.mapUniforms.uExpoK.value,
+      hemi: terrain.mapUniforms.uHemi.value,
+      treeLine: terrain.mapUniforms.uTreeLine.value,
+      heightContrast: terrain.mapUniforms.uHeightContrast.value,
+      heightPivot: terrain.mapUniforms.uHeightPivot.value,
+      hazeAmt: terrain.mapUniforms.uHazeAmt.value,
+      hazeAlt: terrain.mapUniforms.uHazeAlt.value,
+      hazeDist: terrain.mapUniforms.uHazeDist.value,
+      // ⚠️ **UNE VALEUR, PAS L'OBJET.** `uHazeColor` est un `THREE.Color` que le
+      // socle MUTE en place : partagé, son identité ne bougerait jamais et
+      // `habillageDifferent` ne verrait pas la couleur changer — exactement la
+      // remarque que `CHAMPS_HABILLAGE` porte déjà pour `solOffset`/`solScale`,
+      // sauf qu'ici la parade est possible (une chaîne se compare).
+      hazeColor: `#${terrain.mapUniforms.uHazeColor.value.getHexString()}`,
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
index 541a524..eefdab4 100644
--- a/src/monde/branchement-crop.js
+++ b/src/monde/branchement-crop.js
@@ -157,20 +157,51 @@ export const CHAMPS_HABILLAGE = Object.freeze([
   'coastMask',
   'sol',
   'solLut',
   'solOpacite',
   'amplitudeM',
   'contourIntervalM',
   'contourOpacity',
   'contourWeight',
   'grainForceM',
   'grainEchelle',
+  // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════════
+  //
+  // ⚠️ **`analyse` EST LE CHAMP LE PLUS EN RETARD DE TOUTE LA LISTE, ET C'EST
+  // POURQUOI IL DOIT Y ÊTRE.** Le masque de côte arrive du réseau ; l'analyse,
+  // elle, arrive d'un TRAVAILLEUR après une dizaine de flous sur le MNT entier —
+  // `terrain.js` mesure **464 ms** rien que pour La Réunion sur un retour de
+  // zoom. Elle ne peut donc pas être là quand le crop naît. Sans cette ligne, le
+  // peigné n'apparaîtrait qu'au prochain changement de LIEU : c'est la course
+  // que la Tâche K ter a nommée, aggravée d'un demi-seconde de retard garanti.
+  //
+  // ⚠️ **ET `rampe2D` CHANGE D'IDENTITÉ À CHAQUE PALETTE** : `rebuildRamp`
+  // DISPOSE l'ancienne texture et en fabrique une neuve. Absent d'ici, le globe
+  // aurait gardé un `THREE.Texture` disposé — une table morte, et le rendu qui
+  // va avec, jusqu'au prochain déplacement.
+  'analyse',
+  'rampe2D',
+  'texShade',
+  'wetK',
+  'expoK',
+  'hemi',
+  'treeLine',
+  'heightContrast',
+  'heightPivot',
+  'hazeAmt',
+  'hazeAlt',
+  'hazeDist',
+  // ⚠️ **UNE CHAÎNE, ET C'EST CE QUI LA REND SURVEILLABLE.** `uHazeColor` est un
+  // `THREE.Color` MUTÉ EN PLACE par le socle, comme `solOffset`/`solScale` : son
+  // identité ne bouge jamais. `contexteCrop` en transmet donc la valeur
+  // hexadécimale, qui, elle, se compare par `Object.is`.
+  'hazeColor',
 ])
 
 /**
  * L'habillage à poser diffère-t-il de celui qui est posé ?
  *
  * ⚠️ **`Object.is`, PAS `==`** : `null` et `undefined` sont deux réponses
  * différentes (« pas de masque » contre « champ absent du contexte »), et un
  * `NaN` d'amplitude ne doit pas se comparer égal à lui-même autrement que par
  * `Object.is` — sans quoi une amplitude devenue `NaN` gèlerait l'intervalle.
  *
diff --git a/src/monde/naturel-crop.js b/src/monde/naturel-crop.js
new file mode 100644
index 0000000..adb3046
--- /dev/null
+++ b/src/monde/naturel-crop.js
@@ -0,0 +1,362 @@
+// LA COLORISATION NATURELLE, PARTAGÉE — Tâche P2 du plan « LE STUDIO SUR LE
+// GLOBE » (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// ══════════ CE QUE CETTE TÂCHE RÉPARE, ET C'EST LA DEMANDE D'ADRIEN ═════════
+//
+// > **Adrien, 2026-08-22 :** « Plus aucune texture sur la terre. » ·
+// > « Je voudrais qu'on arrive à retrouver la texture comme elle était avant de
+// > faire la modification vers la sphère. Pour l'instant le détail est trop
+// > basique. »
+//
+// La Tâche C avait porté sur le globe **l'emballage** de l'habillage (courbes,
+// grain, masque de côte, occupation du sol) et mesuré qu'il ne déplace que
+// **1,01 %** des pixels. Son bilan nommait ce qui restait :
+//
+// > « Ce qui fait la richesse de l'image du socle, c'est le TEXTURE SHADING et
+// > la rampe locale. »
+//
+// ⚠️ **ET LE RÉGLAGE D'OUVERTURE DE L'APPLICATION L'EMPLOIE À FOND.** Le gabarit
+// de départ (`public/templates/defaults/shibustart.json`, chargé par `main.js`
+// via `STARTUP_LOOK`) pose `colorMode: "natural"`, `texShade: 1`, `wetK: 0,96`,
+// `rampDry: 0,84`, `rampWet: 1`, `heightContrast: 1,5`, `heightPivot: 0,6`.
+// **Le socle qu'Adrien compare est donc en mode Naturel à l'intensité maximale,
+// et le globe n'en portait RIEN.**
+//
+// ══════════ POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'EST PAS UNE COPIE ══
+//
+// Règle D13, §③ : « ① ADAPTER en place · ② EXTRAIRE en module pur partagé dans
+// `src/monde/` · ③ COPIER en dernier recours ». Ce fichier est le ②.
+//
+// ⚠️ **CE N'EST PAS UNE TRANSCRIPTION, C'EST UNE EXTRACTION — ET LA DIFFÉRENCE
+// EST TOUT L'ENJEU.** Une transcription laisse DEUX écritures de la même loi, et
+// `terrain.js` porte déjà la cicatrice de ce choix (« Deux écritures jumelles
+// finiraient par diverger »). Ici, `terrain.js` ET `globe.js` **injectent le
+// MÊME texte GLSL** — celui de `GLSL_NATUREL` ci-dessous. Il n'y a donc qu'une
+// seule écriture de la loi, et `test/crop-naturel.test.js` exige qu'aucun des
+// deux nuanceurs ne réécrive une seule des formules.
+//
+// Module PUR : ni DOM, ni three.js, ni état. Les jumeaux JS des fonctions GLSL
+// vivent ici aussi, et le test EXTRAIT le texte GLSL puis l'EXÉCUTE contre eux —
+// pas une recherche de nom, une exécution (protocole de `test/crop-rampe.js`).
+//
+// ══════════ LES UNITÉS, CÔTÉ SOCLE ET CÔTÉ GLOBE ═══════════════════════════
+//
+// Les fonctions ci-dessous ne prennent QUE des grandeurs normalisées : `hNorm`
+// dans [0, 1], les quatre canaux de l'analyse dans [0, 1], une distance au
+// centre du bloc dans [0, 1]. **C'est ce qui les rend partageables** — le socle
+// tient son relief en unités de scène exagérées, le globe en mètres bruts, et
+// aucune des deux unités n'entre ici.
+//
+//   · `hNorm` — socle : `(vWorldPos.y − uHeightRange.x) / max(uHeightRange.y −
+//     uHeightRange.x, 1e-4)`. Globe : `(h − uLandBas) / max(uLandMax − uLandBas,
+//     uPlancherRampeM)`, c'est-à-dire **l'expression que la Tâche D avait déjà
+//     posée dans `float t`** — on ne l'invente pas, on la nomme.
+//   · `fd` (la distance du voile) — socle : `length(vWorldPos.xz − uBlockOffset)
+//     / max(uSlabHalf, 1e-3)`. Globe : `length(qCrop)`, **et c'est la même
+//     grandeur, pas une approximation** : l'en-tête de `habillage-crop.js`
+//     démontre `x = 28 · u` avec `uSlabHalf = 28`, donc
+//     `qCrop = (vWorldPos.xz − uBlockOffset) / uSlabHalf` exactement.
+//
+// ══════════ CE QUE CE MODULE NE PORTE PAS, ET POURQUOI ═════════════════════
+//
+//   · ⛔ **`mapTint`.** Le socle l'emploie pour `diffuseColor.rgb = mix(
+//     diffuseColor.rgb, mapCol · paintShade, effTint)` : il dose la peinture
+//     hypsométrique CONTRE l'albédo d'un `MeshStandardMaterial` et contre les
+//     matières de relief. Le nuanceur des tuiles du globe est un `ShaderMaterial`
+//     NU : il n'a ni albédo, ni matière de surface, ni bruit de révélation. Il
+//     n'y a **rien contre quoi doser** — lui donner un sens ici serait inventer
+//     une seconde loi, pas en porter une.
+//   · ⛔ **`slopeTint`.** C'est la branche `else` du mode Classique
+//     (`mix(mapCol, brun, smoothstep(0.3, 0.8, slope) · uSlopeTint)`) et elle
+//     lit `slope`, tiré de la NORMALE DU RELIEF (`vNormal` du maillage du bloc).
+//     Les tuiles du globe ne portent que `vNormalW`, la normale de la SPHÈRE :
+//     la pente du terrain n'existe pas dans ce nuanceur. La fabriquer par
+//     dérivées d'écran de `h` serait une seconde loi de pente, mesurée dans une
+//     autre unité, pour un poste que le gabarit d'ouverture n'emploie pas
+//     (`colorMode: "natural"`, où cette branche est morte).
+//
+// **Les deux sont donc DÉCLARÉS LAISSÉS, pas oubliés** — c'est l'Étape 4 de la
+// tâche, qui demande « rends-les vivants, ou dis lesquels tu laisses et
+// pourquoi ». Les deux autres, `heightContrast` et `heightPivot`, sont vivants.
+
+// ══════════ ① LES CONSTANTES — CHACUNE VIENT DU DÉPÔT, AUCUNE N'EST CHOISIE ═
+
+/**
+ * Le gain de l'axe humidité du LUT.
+ *
+ * ⚠️ **IL N'EST PAS DE MOI : IL EST REPRIS DE `terrain.js`, QUI EN PORTE LA
+ * JUSTIFICATION EN DOUZE LIGNES.** 1,62 compense le soft-clip
+ * d'`encodeTextureShade` (le 95e centile sort à 0,808, soit 0,616 une fois ramené
+ * en ±1) ; le ×3 est une demande d'Adrien par-dessus cette compensation. 4,86 est
+ * leur produit, écrit tel quel dans le dépôt.
+ */
+export const GAIN_HUMIDITE = 4.86
+
+/**
+ * Le gain de contraste du peigné et de l'ombrage, AVANT le soft light.
+ *
+ * ⚠️ **ON NE PEUT PAS MONTER LE `mix` AU-DELÀ DE 1** : on écarte donc le signal
+ * de son neutre avant le mélange. C'est le contraste qui triple, pas le dosage —
+ * `terrain.js` l'écrit, et c'est aussi une demande d'Adrien.
+ */
+export const GAIN_PEIGNE = 3
+
+/**
+ * La part de l'ombrage classique, rapportée au peigné.
+ *
+ * ⚠️ **AU DÉZOOM LES BANDES FINES DU PEIGNÉ TOMBENT SOUS LA TAILLE DU PIXEL** et
+ * se moyennent en gris : c'est l'ombrage qui garde alors le massif lisible.
+ * C'est écrit dans l'en-tête de `terrain-analysis.js` (`hillshade`), et le
+ * facteur vient de `terrain.js`.
+ */
+export const PART_OMBRAGE = 0.35
+
+/** La largeur de l'extinction de la végétation au-dessus de la limite des arbres. */
+export const BANDE_VEGETATION = 0.18
+
+/** La marge que le plancher de pivot ajoute au niveau de la mer. */
+export const MARGE_PIVOT = 0.02
+
+/** Le plafond du plancher de pivot — au-delà, la terre perdrait ses teintes basses. */
+export const PLAFOND_PIVOT = 0.95
+
+/** Les coefficients de luminance Rec. 709 du voile aérien. */
+export const LUMA_709 = Object.freeze([0.2126, 0.7152, 0.0722])
+
+/**
+ * Les réglages du mode Naturel ÉTEINTS — ce que le globe porte sans habillage.
+ *
+ * ⚠️ **MÊME DISCIPLINE QUE `HABILLAGE_MONDE` ET `RAMPE_MONDE`** : une seule
+ * écriture, lue par le constructeur du globe ET par `retirerHabillage`. Deux
+ * littéraux jumeaux auraient divergé en silence — c'est exactement le défaut que
+ * la Tâche C a réparé sur `uContourInterval`.
+ *
+ * ⚠️ **ET CES VALEURS NE SONT PAS UN GOÛT : ELLES SONT LES DÉFAUTS DE
+ * `main.js`** (`params.texShade = 0`, `wetK = 0`, `expoK = 0`, `treeLine = 0,62`,
+ * `hazeAmt = 0`, `hazeAlt = 0,5`, `hazeDist = 0,5`) et de `terrain.js`
+ * (`uHemi = 1`, `uHeightContrast`/`uHeightPivot` neutres à 1 et 0,5 — voir
+ * `natRampT`, qui rend alors `hNorm` au bit près).
+ */
+export const NATUREL_MONDE = Object.freeze({
+  texShade: 0,
+  wetK: 0,
+  expoK: 0,
+  hemi: 1,
+  treeLine: 0.62,
+  hazeAmt: 0,
+  hazeAlt: 0.5,
+  hazeDist: 0.5,
+  hazeColor: '#b9c6d6',
+  heightContrast: 1,
+  heightPivot: 0.5,
+})
+
+// ══════════ ② LES JUMEAUX JS — la loi, vérifiable sous node ═════════════════
+
+const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
+
+/**
+ * `smoothstep` du GLSL, mot pour mot.
+ *
+ * ⚠️ **PAS DE GARDE SUR `bord1 − bord0`, ET C'EST DÉLIBÉRÉ.** Les deux seuls
+ * appels de ce module écartent leurs bornes par construction
+ * (`treeLine + 0,18` et `max(hazeAlt, 1e-3)`) : une garde ici serait une
+ * promesse qu'aucun appelant réel ne peut déclencher, donc un repli qui ment sur
+ * ses garanties — le défaut que la Tâche D a retiré d'`echelleRampe`.
+ */
+export function smoothstep(bord0, bord1, x) {
+  const t = clamp01((x - bord0) / (bord1 - bord0))
+  return t * t * (3 - 2 * t)
+}
+
+/**
+ * Le plancher du pivot : le pivot ne peut JAMAIS descendre sous le niveau de la
+ * mer.
+ *
+ * ⚠️ **`terrain.js` LE DIT EN ANGLAIS ET C'EST UN DÉFAUT VU** : « with a low
+ * pivot the whole coastal band rides the top of the ramp and land loses its low
+ * tints ». `hNormMer` est l'altitude NORMALISÉE de la surface de la mer — côté
+ * socle `(uSeaY − uHeightRange.x) / amplitude`, côté globe
+ * `(0 − uLandBas) / amplitude`, puisque le zéro du globe EST le niveau de la mer.
+ */
+export function plancherPivot(hNormMer) {
+  return Math.min(Math.max(hNormMer, 0), PLAFOND_PIVOT) + MARGE_PIVOT
+}
+
+/**
+ * L'indice de rampe du socle — l'axe X du LUT.
+ *
+ * ⚠️ **AUX DÉFAUTS (`contraste = 1`, `pivot = 0,5`) IL REND `hNorm` AU BIT
+ * PRÈS** : `0,5 + (hNorm − 0,5) · 1 = hNorm`. C'est ce qui permet au globe de
+ * garder son image d'avant tant que personne ne pose de crop, et c'est la garde
+ * que le test vérifie sur un balayage.
+ */
+export function rampeT(hNorm, pivot, contraste) {
+  return clamp01(0.5 + (hNorm - pivot) * contraste)
+}
+
+/**
+ * L'axe Y du LUT — l'humidité topographique et l'exposition.
+ *
+ * ⚠️ **C'EST LE SECOND AXE QUI CASSE LA COLORATION PAR COUCHE** : deux points à
+ * la même altitude, l'un au fond d'un vallon, l'autre sur une croupe, cessent de
+ * recevoir la même couleur. Sans lui, une rampe 1D donne NÉCESSAIREMENT une
+ * teinte constante le long de chaque courbe de niveau (`terrain-analysis.js`).
+ *
+ * `canalB` et `canalA` sont les canaux **bleu** (humidité) et **alpha**
+ * (exposition) de l'analyse empaquetée par `packAnalysis` — 0,5 = neutre.
+ */
+export function humiditeY({ canalB, canalA, hNorm, wetK, expoK, hemi, treeLine }) {
+  const veg = 1 - smoothstep(treeLine, treeLine + BANDE_VEGETATION, hNorm)
+  const wet = (canalB - 0.5) * 2
+  const expo = (canalA - 0.5) * 2
+  return clamp01(0.5 + GAIN_HUMIDITE * veg * (wet * wetK + expo * hemi * expoK))
+}
+
+/** Un canal d'analyse, écarté de son neutre du gain du peigné. */
+export function ecartPeigne(canal) {
+  return clamp01(0.5 + (canal - 0.5) * GAIN_PEIGNE)
+}
+
+/**
+ * Le SOFT LIGHT du W3C — la branche `m == 10` de `fxBlend` (`terrain.js`).
+ *
+ * ⚠️ **JAMAIS UNE MULTIPLICATION, ET C'EST UN ARGUMENT, PAS UN GOÛT** :
+ * multiplier (ou mixer vers le blanc) tire la couleur vers le gris et DÉSATURE —
+ * on gagnerait du modelé et on perdrait la palette. Le soft light éclaircit et
+ * assombrit en gardant la chroma.
+ *
+ * Scalaire ici parce que l'opération est **rigoureusement composante par
+ * composante** : c'est ce qui permet au test d'exécuter le texte GLSL canal par
+ * canal, sans interpréteur de vecteurs.
+ *
+ * ⚠️ **`mix` ET `step`, PAS UN TERNAIRE — ET L'ÉCART SE MESURE.** Un ternaire
+ * dit la même chose mathématiquement et **pas la même chose en virgule
+ * flottante** : `mix(a, b, 1.0)` vaut `a + (b − a) · 1`, qui n'est pas `b` au
+ * bit près. Écrit en ternaire, ce jumeau divergeait du texte GLSL d'**un ULP**
+ * (relevé : 0,665622577482985**5** contre …8**6**, à `b = 0,65`, `s = 0,55`), et
+ * le test ② n'aurait plus pu comparer par égalité stricte. Le jumeau suit donc
+ * la forme du GPU, pas la forme la plus lisible.
+ */
+export function softLight(b, s) {
+  const mix = (x, y, t) => x + (y - x) * t
+  const step = (bord, x) => (x < bord ? 0 : 1)
+  const d = mix(((16 * b - 12) * b + 4) * b, Math.sqrt(b), step(0.25, b))
+  return mix(b - (1 - 2 * s) * b * (1 - b), b + (2 * s - 1) * (d - b), step(0.5, s))
+}
+
+/**
+ * Le peigné puis l'ombrage, posés sur une couleur — un canal à la fois.
+ *
+ * ⚠️ **L'OMBRAGE SE POSE SUR LE RÉSULTAT DU PEIGNÉ, PAS SUR LA COULEUR
+ * D'ORIGINE.** `terrain.js` écrit deux `mapCol = mix(mapCol, …)` successifs :
+ * la seconde ligne lit le `mapCol` que la première vient d'écrire. Repartir de
+ * la couleur d'origine donnerait deux modelés indépendants moyennés, c'est-à-dire
+ * un modelé plus plat — et rien ne le signalerait.
+ */
+export function peigne(col, canalR, canalG, k) {
+  const c = col + (softLight(col, ecartPeigne(canalR)) - col) * k
+  return c + (softLight(c, ecartPeigne(canalG)) - c) * (k * PART_OMBRAGE)
+}
+
+/** La luminance Rec. 709 d'une couleur `[r, g, b]`. */
+export function luminance(rgb) {
+  return rgb[0] * LUMA_709[0] + rgb[1] * LUMA_709[1] + rgb[2] * LUMA_709[2]
+}
+
+/**
+ * Le voile de la perspective aérienne (Imhof) — DEUX composantes, pas une.
+ *
+ * ⚠️ **C'EST L'ALTITUDE, PAS LA DISTANCE, QUI DONNE LE BLEU-GRIS DES PLAINES**
+ * sur les planches de référence : l'air épais du fond de vallée est devant elles
+ * quelle que soit la distance. `terrain.js` le nomme *Hoehenmodulation*.
+ */
+export function voile({ hNorm, fd, hazeAmt, hazeAlt, hazeDist }) {
+  const fa = 1 - smoothstep(0, Math.max(hazeAlt, 1e-3), hNorm)
+  return Math.min(Math.max(hazeAmt * (0.6 * fa + hazeDist * fd), 0), 0.9)
+}
+
+/**
+ * Le voile appliqué — un canal à la fois, la luminance étant donnée.
+ *
+ * ⚠️ **DÉSATURER D'ABORD, VIRER VERS LA BRUME ENSUITE** : l'air diffuse la
+ * lumière, il ne repeint pas le sol en bleu. Un mix direct vers la couleur de
+ * brume donne une carte teintée, pas une carte lointaine.
+ *
+ * ⚠️ **ET LE REHAUSSEMENT EST INDISSOCIABLE** : sans lui le voile aplatit toute
+ * la carte. On remonte le contraste là où le voile est nul — donc sur les
+ * sommets, qui reprennent le mordant que les plaines viennent de perdre.
+ *
+ * ⚠️ **`lum` EST UN ARGUMENT ET NON UN CALCUL INTERNE**, et ce n'est pas un
+ * confort d'écriture : c'est ce qui garde la fonction **composante par
+ * composante**, donc exécutable canal par canal par le test à partir du TEXTE
+ * GLSL. Une `dot` à l'intérieur aurait exigé un interpréteur de vecteurs, et un
+ * interpréteur de vecteurs est une troisième écriture de la loi.
+ */
+export function brume({ col, lum, veil, couleur, hazeAmt }) {
+  let c = col + (lum - col) * (veil * 0.65)
+  c = c + (couleur - c) * veil
+  const lift = (1 - veil) * hazeAmt * PART_OMBRAGE
+  return Math.min(Math.max((c - 0.5) * (1 + lift) + 0.5, 0), 1)
+}
+
+// ══════════ ③ LE TEXTE GLSL — LA SEULE ÉCRITURE, INJECTÉE DES DEUX CÔTÉS ═══
+
+/**
+ * Les fonctions GLSL de la colorisation naturelle.
+ *
+ * ⚠️ **`terrain.js` ET `globe.js` INJECTENT CETTE CHAÎNE, ILS NE LA RECOPIENT
+ * PAS.** C'est le point entier du fichier, et `test/crop-naturel.test.js` exige
+ * qu'aucune des formules ci-dessous ne réapparaisse ailleurs dans `src/`.
+ *
+ * ⚠️ **AUCUN ACCENT GRAVE ICI.** Ce texte est interpolé dans les gabarits de
+ * chaîne des deux nuanceurs : un accent grave les fermerait et casserait les deux
+ * modules d'un coup. `terrain.js` et `ocean.js` documentent tous les deux ce
+ * piège ; il est ici DOUBLÉ, puisque le texte voyage.
+ *
+ * ⚠️ **ET LES NOMS SONT PRÉFIXÉS `nat`** : ces fonctions entrent dans un
+ * nuanceur de `MeshStandardMaterial` (le socle) dont three.js écrit lui-même la
+ * moitié. Un `wetY` ou un `veil` nu y aurait un jour rencontré un homonyme de
+ * la bibliothèque, et l'erreur de compilation serait tombée sur une mise à jour
+ * de three, pas sur ce commit.
+ */
+export const GLSL_NATUREL = /* glsl */ `
+// LA COLORISATION NATURELLE — src/monde/naturel-crop.js, injecte tel quel.
+// Ne pas reecrire ces formules ailleurs : test/crop-naturel.test.js l interdit.
+float natPlancherPivot(float hNormMer) {
+  return clamp(hNormMer, 0.0, ${PLAFOND_PIVOT.toFixed(2)}) + ${MARGE_PIVOT.toFixed(2)};
+}
+float natRampT(float hNorm, float pivot, float contraste) {
+  return clamp(0.5 + (hNorm - pivot) * contraste, 0.0, 1.0);
+}
+float natHumiditeY(float canalB, float canalA, float hNorm, float wetK, float expoK, float hemi, float treeLine) {
+  float veg = 1.0 - smoothstep(treeLine, treeLine + ${BANDE_VEGETATION.toFixed(2)}, hNorm);
+  float wet = (canalB - 0.5) * 2.0;
+  float expo = (canalA - 0.5) * 2.0;
+  return clamp(0.5 + ${GAIN_HUMIDITE.toFixed(2)} * veg * (wet * wetK + expo * hemi * expoK), 0.0, 1.0);
+}
+float natEcartPeigne(float canal) {
+  return clamp(0.5 + (canal - 0.5) * ${GAIN_PEIGNE.toFixed(1)}, 0.0, 1.0);
+}
+vec3 natSoftLight(vec3 b, vec3 s) {
+  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3(0.25), b));
+  return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(vec3(0.5), s));
+}
+vec3 natPeigne(vec3 col, float canalR, float canalG, float k) {
+  vec3 c = mix(col, natSoftLight(col, vec3(natEcartPeigne(canalR))), k);
+  return mix(c, natSoftLight(c, vec3(natEcartPeigne(canalG))), k * ${PART_OMBRAGE.toFixed(2)});
+}
+float natLuminance(vec3 c) {
+  return dot(c, vec3(${LUMA_709[0]}, ${LUMA_709[1]}, ${LUMA_709[2]}));
+}
+float natVoile(float hNorm, float fd, float hazeAmt, float hazeAlt, float hazeDist) {
+  float fa = 1.0 - smoothstep(0.0, max(hazeAlt, 1e-3), hNorm);
+  return clamp(hazeAmt * (0.6 * fa + hazeDist * fd), 0.0, 0.9);
+}
+vec3 natBrume(vec3 col, float lum, float veil, vec3 couleur, float hazeAmt) {
+  vec3 c = mix(col, vec3(lum), veil * 0.65);
+  c = mix(c, couleur, veil);
+  float lift = (1.0 - veil) * hazeAmt * ${PART_OMBRAGE.toFixed(2)};
+  return clamp((c - 0.5) * (1.0 + lift) + 0.5, 0.0, 1.0);
+}
+`
diff --git a/src/terrain.js b/src/terrain.js
index 4585b87..05c9b4d 100644
--- a/src/terrain.js
+++ b/src/terrain.js
@@ -11,20 +11,29 @@ import { ATLAS_ANALYSE, ATLAS_MER, fracBassinEmprise } from './dem-emprise.js'
 // les huit demi-plans de la fenêtre, purs et testés — voir src/fenetre-clip.js
 // ⚠️ ALIASÉ : la méthode `Terrain.plansFenetre()` rend des `THREE.Plane`, la
 // fonction pure rend des descriptions. Le même nom pour les deux se lit comme
 // une récursion qui n'existe pas.
 import { plansFenetre as demiPlansFenetre, exposantCoin } from './fenetre-clip.js'
 import { facteursCoins } from './damier-bords.js' // module pur, aucune importation
 // ⚠️ `exageration-continue.js` N'IMPORTE RIEN, et c'est ce qui rend cette ligne
 // possible : passer par `fenetre-bornee.js` fermerait le cycle terrain.js →
 // fenetre-bornee.js → terrain.js et jetterait un ReferenceError EN PRODUCTION.
 import { lireExageration } from './monde/exageration-continue.js'
+// ⚠️ **LA COLORISATION NATURELLE N'EST PLUS ÉCRITE ICI — Tâche P2.** Ses
+// formules vivaient dans le corps du fragment ci-dessous, hors d'atteinte du
+// nuanceur du globe : c'est LA raison pour laquelle le crop rendait « une rampe
+// lisse » là où le socle rend un relief peigné. Elles sont désormais dans un
+// module PUR (`monde/naturel-crop.js`, aucune importation) que les DEUX
+// nuanceurs INJECTENT. Ce n'est pas un rangement : c'est ce qui fait qu'il n'y a
+// **qu'une seule écriture** de la loi, et `test/crop-naturel.test.js` interdit
+// qu'une seule de ces formules réapparaisse ici.
+import { GLSL_NATUREL } from './monde/naturel-crop.js'
 // L'analyse de relief et le masque de mer ne sont plus calcules ici : ils
 // partent dans un Worker (terrain-jobs.js). ~470 ms de fil principal fige par
 // reconstruction, sur MNT 1536². Le calcul est identique octet pour octet.
 import { scheduleTerrainJob, jobStillValid, jobCouvertParEnVol } from './terrain-jobs.js'
 import { TEXTURE_BUILDERS } from './material-textures.js'
 import { MATERIALS } from './material-catalog.js'
 import { FX_GLSL } from './fx-glsl.js' // shared with src/ui/fx-thumbs.js — see that file's header
 import { MeshTransmissionMaterial } from './vendor/MeshTransmissionMaterial.js'
 
 // full-relief opaque material modes (glass is handled separately). Derived from
@@ -873,20 +882,21 @@ float ombreLisiere(vec2 p) {
   // de la lumiere du nord-ouest que toute la carte suppose.
   //
   // Le commentaire d'origine affirmait l'inverse (v croissant vers le sud) et
   // le code le suivait fidelement. C'est le commentaire qui etait faux.
   //
   // Nord-ouest, donc : -u pour l'ouest, +v pour le nord.
   float hNO = texture2D(uCanopee, p + vec2(-uCanopeeTexel.x, uCanopeeTexel.y)).r;
   return clamp((hNO - h) * 3.2, 0.0, 1.0);
 }
 #endif // SHIBU_CANOPEE
+${GLSL_NATUREL}
 // --- Appearance blend modes (Figma / W3C compositing set) — b = backdrop map,
 // s = the shader colour. Separable ops are channel-wise; the last four are the
 // non-separable HSL modes. ---
 float blLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
 vec3 blClip(vec3 c) { float l = blLum(c); float mn = min(min(c.r, c.g), c.b); float mx = max(max(c.r, c.g), c.b);
   if (mn < 0.0) c = l + (c - l) * l / (l - mn + 1e-5);
   if (mx > 1.0) c = l + (c - l) * (1.0 - l) / (mx - l + 1e-5);
   return clamp(c, 0.0, 1.0); }
 vec3 blSetLum(vec3 c, float l) { return blClip(c + (l - blLum(c))); }
 float blSat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
@@ -896,22 +906,21 @@ vec3 blHard(vec3 b, vec3 s) { return mix(b + s - b * s - (1.0 - 2.0 * s) * b, b
 vec3 fxBlend(vec3 b, vec3 s, int m) {
   if (m == 1) return min(b, s);                                  // Darken
   if (m == 2) return b * s;                                      // Multiply
   if (m == 3) return max(vec3(0.0), b + s - 1.0);                // Plus darker (linear burn)
   if (m == 4) return 1.0 - min(vec3(1.0), (1.0 - b) / max(s, 1e-4)); // Colour burn
   if (m == 5) return max(b, s);                                  // Lighten
   if (m == 6) return b + s - b * s;                              // Screen
   if (m == 7) return min(vec3(1.0), b + s);                      // Plus lighter (linear dodge)
   if (m == 8) return min(vec3(1.0), b / max(1.0 - s, 1e-4));     // Colour dodge
   if (m == 9) return blHard(s, b);                               // Overlay (hard-light swapped)
-  if (m == 10) { vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(vec3(0.25), b));
-    return mix(b - (1.0 - 2.0 * s) * b * (1.0 - b), b + (2.0 * s - 1.0) * (d - b), step(vec3(0.5), s)); } // Soft light
+  if (m == 10) return natSoftLight(b, s);                        // Soft light — voir naturel-crop.js
   if (m == 11) return blHard(b, s);                              // Hard light
   if (m == 12) return abs(b - s);                                // Difference
   if (m == 13) return b + s - 2.0 * b * s;                       // Exclusion
   if (m == 14) return blSetLum(blSetSat(s, blSat(b)), blLum(b)); // Hue
   if (m == 15) return blSetLum(blSetSat(b, blSat(s)), blLum(b)); // Saturation
   if (m == 16) return blSetLum(s, blLum(b));                     // Colour
   if (m == 17) return blSetLum(b, blLum(s));                     // Luminosity
   return s;                                                      // Normal
 }`
         )
@@ -1040,101 +1049,71 @@ vec3 fxBlend(vec3 b, vec3 s, int m) {
       // ressemblaient à de faux bancs de sable (retour Adrien). Les vagues, elles,
       // gardent exactement la même hauteur.
       float creach = smoothstep(0.0, 0.5, 1.0 - d01);
       float cglow = clamp(cfil * crays * creach * uSeaCausK, 0.0, 1.0);
       mapCol *= 1.0 - 0.2 * creach * uSeaCausK * (1.0 - cnet); // creux des mailles éteints
       mapCol = 1.0 - (1.0 - clamp(mapCol, 0.0, 1.0)) * (1.0 - cglow * 0.55); // filaments en screen
     }
   } else {
     // the pivot can never sink below sea level: with a low pivot the whole
     // coastal band rides the top of the ramp and land loses its low tints
+    // ⚠️ LA LOI EST DANS src/monde/naturel-crop.js, PAS ICI — Tâche P2. Le
+    // nuanceur du globe injecte le MÊME texte : deux écritures de ce pivot
+    // auraient donné deux rampes de terre à faire coïncider, ce qui est
+    // exactement le désaccord que le chantier « une seule Terre » ferme.
     float pivotFloor = uSeaY > -9000.0
-      ? clamp((uSeaY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4), 0.0, 0.95) + 0.02
+      ? natPlancherPivot((uSeaY - uHeightRange.x) / max(uHeightRange.y - uHeightRange.x, 1e-4))
       : 0.0;
     float pivot = max(uHeightPivot, pivotFloor);
-    float rampT = clamp(0.5 + (hNorm - pivot) * uHeightContrast, 0.0, 1.0);
+    float rampT = natRampT(hNorm, pivot, uHeightContrast);
     // --- SECOND AXE DU LUT : l'humidité. X reste l'altitude, Y devient
     // l'humidité topographique — deux points à la MÊME altitude, l'un au fond
     // d'un vallon, l'autre sur une croupe, cessent de recevoir la même couleur.
     // En Classique, wetY reste à 0.5 : le LUT y est constant en Y et rend
     // exactement la rampe historique.
     float wetY = 0.5;
     vec4 anl = vec4(0.5);
     if (uColorMode == 1) {
       if (uAnalysisOn > 0.5) {
         // même UV d'atlas que uSeaMask : rien à inventer côté échantillonnage
         vec2 anUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5;
         anl = texture2D(uAnalysis, anUv);
       }
       // au-dessus de la limite des arbres il n'y a plus de végétation à
       // différencier : humidité et exposition s'éteignent, sinon les pierriers
-      // et les névés prendraient des verts de prairie
-      float veg = 1.0 - smoothstep(uTreeLine, uTreeLine + 0.18, hNorm);
-      float wet = (anl.b - 0.5) * 2.0;  // > 0 = creux qui collecte l'eau
-      float expo = (anl.a - 0.5) * 2.0; // > 0 = versant tourné au nord
-      // uHemi : au NORD de l'équateur l'ubac (face nord) est la face à l'ombre,
-      // donc la fraîche et l'humide. Au sud tout s'inverse.
-      // GAIN 1.62, et ce n'est pas une constante de confort. Les canaux B et A
-      // sortent d'encodeTextureShade, dont le soft-clip place le 95e centile à
-      // 0.808 — soit 0.616 une fois ramené en ±1. Le facteur 0.5 qui se trouvait
-      // ici rabotait encore de moitié : au réglage 1 on ne balayait que 31 % du
-      // LUT. Mesuré sur une carte réelle, la couleur ne bougeait alors que de
-      // 3 unités de RVB sur 255 — les tirettes semblaient mortes. 1/0.616 fait
-      // qu'au réglage 1 une anomalie au 95e centile atteint le bord de la rampe.
-      // ×3 SUR DEMANDE D'ADRIEN, par-dessus la compensation de 1.62 : à 1.62 le
-      // réglage 1 amenait tout juste le 95e centile au bord du LUT, ce qui est
-      // « juste » au sens statistique mais trop sage à l'écran. 4.86 fait mordre
-      // les tirettes dès le milieu de leur course ; les extrêmes saturent, et
-      // c'est assumé — un fond de vallon doit être franchement plus vert.
-      wetY = clamp(0.5 + 4.86 * veg * (wet * uWetK + expo * uHemi * uExpoK), 0.0, 1.0);
+      // et les névés prendraient des verts de prairie. uHemi : au NORD de
+      // l'équateur l'ubac (face nord) est la face à l'ombre, donc la fraîche et
+      // l'humide ; au sud tout s'inverse.
+      // ⚠️ LE GAIN 4,86 ET SA JUSTIFICATION SONT DANS naturel-crop.js
+      // (GAIN_HUMIDITE) — Tâche P2. Ils y sont écrits UNE fois, et le nuanceur du
+      // globe lit le même nombre par le même texte.
+      wetY = natHumiditeY(anl.b, anl.a, hNorm, uWetK, uExpoK, uHemi, uTreeLine);
     }
     mapCol = texture2D(uRampTex, vec2(rampT, wetY)).rgb;
     if (uColorMode == 1) {
+      // ⚠️ LE PEIGNÉ ET L'OMBRAGE VIVENT DANS naturel-crop.js (natPeigne) —
+      // Tâche P2, et c'est CE bloc-là qu'Adrien voyait manquer sur la sphère :
+      // « plus aucune texture sur la terre ». Le SOFT LIGHT et le ×3 sur le
+      // contraste y sont justifiés ; le globe injecte la même fonction.
       if (uAnalysisOn > 0.5 && uTexShade > 0.001) {
-        // SOFT LIGHT, jamais une multiplication : multiplier (ou mixer vers le
-        // blanc) tire la couleur vers le gris et DÉSATURE — on gagne du modelé
-        // et on perd la palette. Le soft light du W3C éclaircit/assombrit en
-        // gardant la chroma. fxBlend(b, s, 10) EST ce soft light, déjà défini
-        // plus haut pour les shaders de surface : on le réutilise tel quel.
-        // ×3 sur le PEIGNÉ, lui aussi (demande d'Adrien). On ne peut pas monter
-        // le mix au-delà de 1 : on écarte donc le signal de son neutre AVANT le
-        // soft light. C'est le contraste du peigné qui triple, pas son dosage —
-        // la palette reste intacte, seule l'amplitude du modelé change.
-        float comb = clamp(0.5 + (anl.r - 0.5) * 3.0, 0.0, 1.0);
-        mapCol = mix(mapCol, fxBlend(mapCol, vec3(comb), 10), uTexShade);
-        // l'ombrage classique par-dessus, au tiers : au dézoom les bandes fines
-        // du peigné tombent sous la taille du pixel et se moyennent en gris,
-        // c'est lui qui garde alors le massif lisible
-        float hs = clamp(0.5 + (anl.g - 0.5) * 3.0, 0.0, 1.0);
-        mapCol = mix(mapCol, fxBlend(mapCol, vec3(hs), 10), uTexShade * 0.35);
+        mapCol = natPeigne(mapCol, anl.r, anl.g, uTexShade);
       }
       // --- PERSPECTIVE AÉRIENNE (Imhof) — entièrement en fragment, zéro tap.
+      // La loi (deux composantes, désaturation puis virage, et le rehaussement
+      // indissociable) est dans naturel-crop.js : natVoile + natBrume.
       if (uHazeAmt > 0.001) {
-        // 1. DISTANCE : le lointain se voile.
+        // ⚠️ fd EST EN DEMI-CÔTÉS DE BLOC, et c'est la grandeur que le globe
+        // nomme length(qCrop) : l'en-tête de habillage-crop.js démontre
+        // x = 28 · u avec uSlabHalf = 28. Même nombre, deux chemins.
         float fd = clamp(length(vWorldPos.xz - uBlockOffset) / max(uSlabHalf, 1e-3), 0.0, 1.0);
-        // 2. ALTITUDE (Hoehenmodulation) : les basses terres se voilent MÊME
-        // proches. C'est cette composante-là, pas la distance, qui donne le
-        // bleu-gris des plaines sur les planches de référence — l'air épais du
-        // fond de vallée est devant elles quelle que soit la distance.
-        float fa = 1.0 - smoothstep(0.0, max(uHazeAlt, 1e-3), hNorm);
-        float veil = clamp(uHazeAmt * (0.6 * fa + uHazeDist * fd), 0.0, 0.9);
-        // DÉSATURER D'ABORD, virer vers la brume ensuite : l'air diffuse la
-        // lumière, il ne repeint pas le sol en bleu. Un mix direct vers
-        // uHazeColor donne une carte teintée, pas une carte lointaine.
-        float lum = dot(mapCol, vec3(0.2126, 0.7152, 0.0722));
-        mapCol = mix(mapCol, vec3(lum), veil * 0.65);
-        mapCol = mix(mapCol, uHazeColor, veil);
-        // CONTREPARTIE INDISSOCIABLE : sans elle le voile aplatit toute la
-        // carte. On remonte le contraste là où le voile est nul — donc sur les
-        // sommets, qui reprennent le mordant que les plaines viennent de perdre.
-        float lift = (1.0 - veil) * uHazeAmt * 0.35;
-        mapCol = clamp((mapCol - 0.5) * (1.0 + lift) + 0.5, 0.0, 1.0);
+        float veil = natVoile(hNorm, fd, uHazeAmt, uHazeAlt, uHazeDist);
+        mapCol = natBrume(mapCol, natLuminance(mapCol), veil, uHazeColor, uHazeAmt);
       }
     } else {
       mapCol = mix(mapCol, vec3(0.42, 0.31, 0.21), smoothstep(0.3, 0.8, slope) * uSlopeTint);
     }
   }
   float fxShade = clamp(luma * 2.4, 0.2, 1.4);
   // material noise reveal: where the noise is below the (soft) cut, push the tint
   // back toward 1 so the map paint shows through the relief material — a diffuse,
   // holeless dissolve that lets you see the layer underneath. The revealed map is
   // lifted back toward its natural brightness (not shaded by the material albedo)
diff --git a/test/crop-habillage.test.js b/test/crop-habillage.test.js
index 255629f..193cd12 100644
--- a/test/crop-habillage.test.js
+++ b/test/crop-habillage.test.js
@@ -125,23 +125,35 @@ test('① retirerCrop retire aussi l’habillage — sinon il survivrait au crop
 test('① le compte de samplers du nuanceur du globe reste sous le plafond de 16', () => {
   // ⚠️ CE N'EST PAS UNE ASSERTION QUI DISTINGUE, C'EST UN PLAFOND — et il a déjà
   // été crevé une fois : le 2026-08-03 le terrain a purement disparu de l'écran,
   // « FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS
   // (16) », 18 samplers pour 16 (voir `test/plafond-unites-texture.test.js`).
   // Sa mutation nommée est M9 (`.banc/mutations-habC.mjs`).
   // ⚠️ **SIX DEPUIS LA TÂCHE J bis** : `uFondChamp` porte le fond du crop, que la
   // rampe lit pour savoir qu'elle peint une mer et non un pré. Le compte reste
   // très en dessous du plafond, mais il est ÉCRIT — un sampler ajouté sans que
   // ce chiffre bouge, c'est un chiffre qui ne garde plus rien.
+  // ⚠️ **HUIT DEPUIS LA TÂCHE P2** : `uAnalysis` porte le peigné des crêtes
+  // (`terrain-analysis.js`) et `uRampCrop` EST le LUT 2D du socle
+  // (`terrain.mapUniforms.uRampTex`) — c'est par ce second lien que `rampDry`,
+  // `rampWet` et `rampOklab` atteignent la sphère sans une seule couleur
+  // recalculée. Le chiffre est REFAIT, pas cru : le commentaire de `globe.js`
+  // qui l'annonce est vérifié juste en dessous.
   const n = (FRAG.match(/uniform\s+sampler2D\s+\w+\s*;/g) || []).length
   assert.ok(n <= 16, `le nuanceur du globe déclare ${n} samplers`)
-  assert.equal(n, 6, `le compte attendu est 6 (uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp), pas ${n}`)
+  assert.equal(n, 8, `le compte attendu est 8 (uTex, uRamp, uCoastMask, uSol, uSolLut, uFondChamp, uAnalysis, uRampCrop), pas ${n}`)
+  // ⚠️ **ET LE COMMENTAIRE QUI ANNONCE LE COMPTE DOIT DIRE LE MÊME NOMBRE.** Le
+  // brief de la Tâche P2 le demandait nommément (« `globe.js:714` compte les
+  // samplers — vérifie où en est ce compte avant d'ajouter ») : un pavé qui
+  // annonce six pendant que le nuanceur en déclare huit est précisément le genre
+  // de prose que le tour de mutation de la Tâche K ter a trouvée verte à tort.
+  assert.match(GLOBE_SRC, /uAnalysis et uRampCrop font HUIT/)
 })
 
 // ══════════ ② LES DEUX FAMILLES D'UV NE SE CONFONDENT PAS ══════════════════
 
 test("② les champs CUITS ne se retournent pas, les couches DRAPÉES si — et l'écart vaut exactement 1", () => {
   // ⚠️ C'EST LE PIÈGE LE PLUS SILENCIEUX DE CETTE TÂCHE. `terrain.js` lit
   // uCoastMask / uSeaMask / uAnalysis en `vWorldPos.xz` DIRECT, et `uvSolDrape`
   // — et lui seul — retourne y. Confondre les deux pose la forêt à l'envers et
   // la mer sur les crêtes, sans qu'aucune erreur ne se lève.
   for (const [u, v] of [[-1, -1], [-0.3, 0.7], [0, 0], [0.9, -0.4], [1, 1]]) {
@@ -534,29 +546,35 @@ test('⑧ le décodage de classe garde les trois précautions du socle', () => {
 //     le patron de la Tâche B (`Globe.prototype.X.call` sur un objet minimal) —
 //     et là-bas, poser de vrais tests avait révélé un vrai défaut. **Ici aussi :
 //     `retirerHabillage` ne remettait pas `uContourInterval`.**
 //   ⑩ le nuanceur est EXTRAIT PUIS EXÉCUTÉ, pas décrit. C'est le patron de la
 //     Tâche D (`test/crop-rampe.test.js`) : on prend le TEXTE du GLSL, on le
 //     traduit en JS et on l'appelle. Une garde retirée du nuanceur change alors
 //     une VALEUR, et l'assertion tombe.
 
 import { Globe } from '../src/globe.js'
 import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
+import { NATUREL_MONDE } from '../src/monde/naturel-crop.js'
 
 // ══════════ ⑨ poserHabillage / retirerHabillage, EXERCÉES ══════════════════
 //
 // ⚠️ LA VERSION LIVRÉE NE LES COUVRAIT QUE PAR UN GREP DE NOM — quarante lignes
 // derrière `assert.ok(/poserHabillage/)`. C'est mot pour mot ce que la relecture
 // de la Tâche B avait déjà remonté sur `hauteurSurface`.
 
 const val = (v) => ({ value: v })
 const vec2 = (x, y) => ({ x, y, set(a, b) { this.x = a; this.y = b } })
+// ⚠️ **UNE COULEUR SE MUTE, ELLE NE SE REMPLACE PAS** — c'est le contrat de
+// `THREE.Color` que `poserHabillage` emploie (`u.uHazeColor.value.set(...)`), et
+// c'est aussi ce qui rend la couleur de brume INSURVEILLABLE par identité : le
+// contexte en transmet donc la valeur hexadécimale (voir `CHAMPS_HABILLAGE`).
+const couleurStub = (hex) => ({ hex, set(v) { this.hex = v } })
 
 /** Un globe minimal : rien que les uniformes et le repère du crop. */
 function globeStub(crop = REPERE) {
   return {
     _crop: crop,
     uniforms: {
       uHabOn: val(0),
       uCoastMask: val(null),
       uCoastMaskOn: val(0),
       uMargeCoteM: val(HABILLAGE_MONDE.margeCoteM),
@@ -565,20 +583,41 @@ function globeStub(crop = REPERE) {
       uSolOn: val(0),
       uSolOpacite: val(HABILLAGE_MONDE.solOpacite),
       uSolOffset: val(vec2(0, 0)),
       uSolScale: val(vec2(1, 1)),
       uSolTexel: val(vec2(1 / 2048, 1 / 2048)),
       uContourInterval: val(HABILLAGE_MONDE.contourIntervalM),
       uContourOpacity: val(HABILLAGE_MONDE.contourOpacite),
       uContourWeight: val(HABILLAGE_MONDE.contourPoids),
       uGrainForceM: val(HABILLAGE_MONDE.grainForceM),
       uGrainEchelle: val(HABILLAGE_MONDE.grainEchelle),
+      // ══════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
+      //
+      // ⚠️ **LE STUB PORTE LES SEIZE UNIFORMES DE L'HABILLAGE PLUS LES QUATORZE
+      // DE LA COLORISATION**, et il les part aux MÊMES valeurs que le
+      // constructeur : c'est ce qui rend ⑨h (l'aller-retour bit à bit) capable de
+      // voir un uniforme que `retirerHabillage` oublierait de rendre.
+      uAnalysis: val(null),
+      uAnalysisOn: val(0),
+      uTexShade: val(NATUREL_MONDE.texShade),
+      uWetK: val(NATUREL_MONDE.wetK),
+      uExpoK: val(NATUREL_MONDE.expoK),
+      uHemi: val(NATUREL_MONDE.hemi),
+      uTreeLine: val(NATUREL_MONDE.treeLine),
+      uRampCrop: val(null),
+      uRampCropOn: val(0),
+      uHeightContrast: val(NATUREL_MONDE.heightContrast),
+      uHeightPivot: val(NATUREL_MONDE.heightPivot),
+      uHazeAmt: val(NATUREL_MONDE.hazeAmt),
+      uHazeAlt: val(NATUREL_MONDE.hazeAlt),
+      uHazeDist: val(NATUREL_MONDE.hazeDist),
+      uHazeColor: val(couleurStub(NATUREL_MONDE.hazeColor)),
     },
   }
 }
 const poserHab = (g, arg) => Globe.prototype.poserHabillage.call(g, arg)
 const retirerHab = (g) => Globe.prototype.retirerHabillage.call(g)
 const lireHab = (g) => {
   const o = {}
   for (const [k, u] of Object.entries(g.uniforms)) {
     o[k] = u.value && typeof u.value === 'object' && 'x' in u.value ? [u.value.x, u.value.y] : u.value
   }
diff --git a/test/crop-naturel.test.js b/test/crop-naturel.test.js
new file mode 100644
index 0000000..ef28761
--- /dev/null
+++ b/test/crop-naturel.test.js
@@ -0,0 +1,655 @@
+// LA COLORISATION NATURELLE, PARTAGÉE — Tâche P2 du plan « LE STUDIO SUR LE
+// GLOBE » (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
+//
+// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
+//
+// Même partage que `crop-sphere`, `crop-parois`, `crop-habillage` et
+// `crop-rampe` :
+//   ① LA LOI vit dans un module PUR (`src/monde/naturel-crop.js`) et se vérifie
+//      sous node, point par point ;
+//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom. Le
+//      piège que ce chantier a payé huit fois, c'est l'assertion verte parce
+//      qu'un mot figure quelque part — la Tâche K ter en a trouvé une qui lisait
+//      la formule DANS UN COMMENTAIRE.
+//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion : aucune des
+//      formules ne doit reparaître dans `terrain.js` ni dans `globe.js`.
+//
+// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
+// l'image obtenue ressemble à celle du socle. Seul l'écran le dit — c'est
+// l'Étape 7 de la tâche et son compte rendu, pas ce fichier.
+//
+// ══════════ POURQUOI LE TRANSPILEUR EST CANAL PAR CANAL ════════════════════
+//
+// Les quatre fonctions vectorielles du module (`natSoftLight`, `natPeigne`,
+// `natBrume`, et le `mix` de `natRampT`… qui est scalaire) sont **rigoureusement
+// composante par composante**. On peut donc exécuter leur texte GLSL avec des
+// SCALAIRES, un canal à la fois, et obtenir le résultat exact — sans écrire un
+// interpréteur de vecteurs, qui serait une TROISIÈME écriture de la loi.
+//
+// ⚠️ **`natLuminance` EST LA SEULE EXCEPTION**, parce que `dot` mélange les
+// canaux. C'est aussi pourquoi `natBrume` prend `lum` en ARGUMENT au lieu de le
+// calculer : sans cela, la fonction la plus riche du module aurait été la seule
+// non exécutable par ce protocole. `natLuminance` est vérifiée autrement — on
+// EXTRAIT ses trois coefficients du texte et on les confronte à `LUMA_709`.
+
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+
+import {
+  GAIN_HUMIDITE,
+  GAIN_PEIGNE,
+  PART_OMBRAGE,
+  BANDE_VEGETATION,
+  MARGE_PIVOT,
+  PLAFOND_PIVOT,
+  LUMA_709,
+  NATUREL_MONDE,
+  GLSL_NATUREL,
+  smoothstep,
+  plancherPivot,
+  rampeT,
+  humiditeY,
+  ecartPeigne,
+  softLight,
+  peigne,
+  luminance,
+  voile,
+  brume,
+} from '../src/monde/naturel-crop.js'
+import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
+import { Globe } from '../src/globe.js'
+
+const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
+const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
+const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
+const FRAG_GLOBE = GLOBE_SRC.slice(GLOBE_SRC.indexOf('const FRAG ='), GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10))
+/** Le même fragment, SANS SES COMMENTAIRES — voir ⑤b pour ce qu'ils coûtent. */
+const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
+
+// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════
+
+const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
+const MIX = (a, b, t) => a + (b - a) * t
+const STEP = (bord, x) => (x < bord ? 0 : 1)
+const SMOOTHSTEP = (b0, b1, x) => {
+  const t = CLAMP((x - b0) / (b1 - b0), 0, 1)
+  return t * t * (3 - 2 * t)
+}
+
+/**
+ * Le TEXTE de `GLSL_NATUREL`, rendu exécutable en JS — canal par canal.
+ *
+ * ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI** : seuls les MOTS du langage sont
+ * remplacés (`float`/`vec3` → `let`, `clamp` → `CLAMP`, …). Si une constante du
+ * nuanceur change, la traduction la porte, et la comparaison au jumeau JS tombe.
+ */
+function traduire(glsl) {
+  return (
+    glsl
+      // les commentaires d'abord : ils portent des mots du langage
+      .replace(/\/\/[^\n]*/g, '')
+      // `natLuminance` mélange les canaux (dot) : hors protocole, vérifiée à part
+      .replace(/float natLuminance\(vec3 c\) \{[^}]*\}/, '')
+      // signatures : `float f(float a, vec3 b)` → `function f(a, b)`
+      .replace(/\b(?:float|vec3|vec4)\s+(nat\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
+        const noms = args
+          .split(',')
+          .map((a) => a.trim().split(/\s+/).pop())
+          .filter(Boolean)
+        return `function ${nom}(${noms.join(', ')}) {`
+      })
+      // constructeurs à UN argument : la diffusion d'un scalaire sur trois canaux
+      .replace(/\bvec3\s*\(/g, '(')
+      // déclarations locales
+      .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*=/g, 'let $1 =')
+      // fonctions intrinsèques
+      .replace(/\bsmoothstep\s*\(/g, 'SMOOTHSTEP(')
+      .replace(/\bclamp\s*\(/g, 'CLAMP(')
+      .replace(/\bstep\s*\(/g, 'STEP(')
+      .replace(/\bmix\s*\(/g, 'MIX(')
+      .replace(/\bmax\s*\(/g, 'Math.max(')
+      .replace(/\bmin\s*\(/g, 'Math.min(')
+      .replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
+  )
+}
+
+const JS_NATUREL = traduire(GLSL_NATUREL)
+// eslint-disable-next-line no-new-func
+const NUANCEUR = new Function(
+  'CLAMP',
+  'MIX',
+  'STEP',
+  'SMOOTHSTEP',
+  `${JS_NATUREL}
+   return { natPlancherPivot, natRampT, natHumiditeY, natEcartPeigne, natSoftLight, natPeigne, natVoile, natBrume }`
+)(CLAMP, MIX, STEP, SMOOTHSTEP)
+
+/** Un balayage reproductible — pas de hasard, donc pas de test qui clignote. */
+function* balayage(n = 41) {
+  for (let i = 0; i <= n; i++) yield i / n
+}
+
+// ══════════ ① LA LOI PURE — LES CONSTANTES ONT UNE SOURCE ══════════════════
+
+test('①a les constantes sont celles du dépôt, pas des nombres choisis', () => {
+  // ⚠️ CHAQUE CHIFFRE A SA JUSTIFICATION DANS `terrain.js` : 4,86 = 1,62 (la
+  // compensation du soft-clip d'`encodeTextureShade`) × 3 (demande d'Adrien).
+  assert.equal(GAIN_HUMIDITE, 4.86)
+  assert.equal(GAIN_PEIGNE, 3)
+  assert.equal(PART_OMBRAGE, 0.35)
+  assert.equal(BANDE_VEGETATION, 0.18)
+  assert.equal(MARGE_PIVOT, 0.02)
+  assert.equal(PLAFOND_PIVOT, 0.95)
+  assert.deepEqual([...LUMA_709], [0.2126, 0.7152, 0.0722])
+  // et la luminance Rec. 709 somme à 1 — sinon elle éclaircirait ou assombrirait
+  assert.ok(Math.abs(LUMA_709.reduce((a, b) => a + b, 0) - 1) < 1e-12)
+})
+
+test('①b AUX DÉFAUTS, natRampT rend hNorm — et l’écart est MESURÉ, pas déclaré nul', () => {
+  // ⚠️ **PREMIÈRE RÉDACTION : « AU BIT PRÈS ». ELLE ÉTAIT FAUSSE, ET LE TEST L'A
+  // DIT.** `0,5 + (hNorm − 0,5) · 1` n'est PAS `hNorm` en virgule flottante :
+  // sur 100 001 valeurs, l'écart maximal vaut **2,78 × 10⁻¹⁷** en float64
+  // (à `hNorm = 0,00136`) et **1,49 × 10⁻⁸** en float32, la précision du GPU
+  // (à `hNorm ≈ 0,00203`). Le relevé est reproductible :
+  // `node -e "…rampeT(h, 0.5, 1) − h…"`.
+  //
+  // ⚠️ **CE QUE ÇA CHANGE, ET RIEN DE PLUS** : le LUT fait 512 texels de large,
+  // donc **un texel vaut 1,95 × 10⁻³** — l'écart du GPU est **131 000 fois plus
+  // petit qu'un texel**. La loi est donc neutre À L'ÉCRAN, et elle ne l'est pas
+  // au bit. **Le filet bit-à-bit de la production, lui, reste `uRampCropOn = 0`**,
+  // qui laisse `texture2D(uRamp, vec2(t, 0.5))` intouché — c'est ④e qui le tient.
+  const ECART_MAX = 1e-16
+  let pire = 0
+  for (const h of balayage(100000)) {
+    const v = rampeT(h, NATUREL_MONDE.heightPivot, NATUREL_MONDE.heightContrast)
+    pire = Math.max(pire, Math.abs(v - h))
+  }
+  assert.ok(pire < ECART_MAX, `écart maximal ${pire}, au-dessus de ${ECART_MAX}`)
+  assert.ok(pire > 0, 'écart RIGOUREUSEMENT nul : le balayage ne balaie plus rien')
+  assert.ok(pire * 512 < 1e-13, 'l’écart n’est plus négligeable devant un texel de LUT')
+})
+
+test('①c le pivot ne descend JAMAIS sous le niveau de la mer', () => {
+  // le défaut vu et corrigé côté socle : « with a low pivot the whole coastal
+  // band rides the top of the ramp and land loses its low tints »
+  assert.equal(plancherPivot(0), MARGE_PIVOT)
+  assert.equal(plancherPivot(-5), MARGE_PIVOT) // un crop entièrement au-dessus de la mer
+  assert.equal(plancherPivot(0.5), 0.52)
+  assert.equal(plancherPivot(2), PLAFOND_PIVOT + MARGE_PIVOT) // écrêté, jamais 2,02
+  // un pivot d'utilisateur plus HAUT que le plancher gagne : c'est un réglage
+  assert.equal(Math.max(0.6, plancherPivot(0)), 0.6)
+})
+
+test('①d le second axe du LUT est NEUTRE sans réglage, et il MORD avec', () => {
+  const base = { canalB: 0.5, canalA: 0.5, hNorm: 0.3, wetK: 0.96, expoK: 0.35, hemi: 1, treeLine: 0.62 }
+  // analyse neutre → ligne médiane du LUT, donc la rampe historique
+  assert.equal(humiditeY(base), 0.5)
+  // réglages nuls → ligne médiane quelle que soit l'analyse
+  for (const b of balayage()) {
+    assert.equal(humiditeY({ ...base, canalB: b, wetK: 0, expoK: 0 }), 0.5)
+  }
+  // ⚠️ LE 95e CENTILE DOIT ATTEINDRE LE BORD DU LUT AU RÉGLAGE 1 — c'est toute
+  // la justification du gain, et elle est VÉRIFIÉE, pas citée : `encodeTexture
+  // Shade` place ce centile à 0,808, soit 0,616 une fois ramené en ±1.
+  const y = humiditeY({ ...base, canalB: 0.808, wetK: 1, expoK: 0 })
+  assert.ok(y > 0.99, `le 95e centile ne monte qu'à ${y} — le gain ne mord plus`)
+  // au-dessus de la limite des arbres, humidité et exposition s'éteignent
+  assert.equal(humiditeY({ ...base, canalB: 1, hNorm: 0.62 + BANDE_VEGETATION }), 0.5)
+  // l'hémisphère sud renverse l'exposition, et lui seul
+  const nord = humiditeY({ ...base, canalA: 0.9, wetK: 0, expoK: 0.35, hemi: 1 })
+  const sud = humiditeY({ ...base, canalA: 0.9, wetK: 0, expoK: 0.35, hemi: -1 })
+  assert.ok(Math.abs(nord + sud - 1) < 1e-12, `${nord} et ${sud} ne sont pas symétriques`)
+})
+
+test('①e le SOFT LIGHT ne bouge pas une couleur quand le signal est neutre', () => {
+  // ⚠️ **CE POINT FIXE EST LA GARANTIE DE LA PALETTE.** À s = 0,5 le soft light
+  // du W3C rend b : une analyse plate ne peut donc pas désaturer la carte, quel
+  // que soit `texShade`. Une mutation qui remplacerait le soft light par une
+  // multiplication (le défaut nommé dans `terrain.js`) tombe ici.
+  for (const b of balayage(200)) assert.ok(Math.abs(softLight(b, 0.5) - b) < 1e-15, `b=${b}`)
+  // et il éclaircit au-dessus de 0,5, assombrit en dessous — sans sortir de [0,1]
+  for (const b of balayage(50)) {
+    for (const s of balayage(50)) {
+      const v = softLight(b, s)
+      assert.ok(v >= -1e-12 && v <= 1 + 1e-12, `b=${b} s=${s} → ${v}`)
+      if (b > 0 && b < 1) {
+        if (s > 0.5) assert.ok(v >= b - 1e-12, `b=${b} s=${s} n'éclaircit pas`)
+        if (s < 0.5) assert.ok(v <= b + 1e-12, `b=${b} s=${s} n'assombrit pas`)
+      }
+    }
+  }
+})
+
+test('①f le peigné À DOSE NULLE laisse la couleur intacte, et l’ombrage suit le peigné', () => {
+  for (const c of balayage(50)) assert.ok(Object.is(peigne(c, 0.9, 0.1, 0), c), `c=${c}`)
+  // ⚠️ **L'OMBRAGE LIT LE RÉSULTAT DU PEIGNÉ, PAS LA COULEUR D'ORIGINE.** Deux
+  // modelés indépendants moyennés seraient PLUS PLATS, et rien ne le signalerait.
+  const col = 0.42
+  const k = 0.6
+  const apresPeigne = MIX(col, softLight(col, ecartPeigne(0.85)), k)
+  const attendu = MIX(apresPeigne, softLight(apresPeigne, ecartPeigne(0.2)), k * PART_OMBRAGE)
+  assert.ok(Math.abs(peigne(col, 0.85, 0.2, k) - attendu) < 1e-15)
+  const naif = MIX(apresPeigne, softLight(col, ecartPeigne(0.2)), k * PART_OMBRAGE)
+  assert.notEqual(attendu, naif) // la version « repart de l'origine » diverge bien
+})
+
+test('①g le voile a DEUX composantes, et l’altitude seule suffit à le lever', () => {
+  const base = { hNorm: 0, fd: 0, hazeAmt: 0.45, hazeAlt: 0.5, hazeDist: 0.5 }
+  // à distance nulle, une plaine se voile quand même — c'est la Hoehenmodulation
+  assert.ok(voile(base) > 0, 'le voile d’altitude ne mord pas')
+  // un sommet à distance nulle n'est pas voilé du tout
+  assert.equal(voile({ ...base, hNorm: 1 }), 0)
+  // le plafond à 0,9 tient, même à force démente
+  assert.equal(voile({ ...base, hazeAmt: 10, fd: 1 }), 0.9)
+  // et à force nulle, rien
+  assert.equal(voile({ ...base, hazeAmt: 0, fd: 1 }), 0)
+})
+
+test('①h la brume DÉSATURE avant de virer, et le rehaussement est indissociable', () => {
+  // à voile nul, la couleur ressort intacte SAUF le rehaussement, qui est alors
+  // maximal — c'est exactement le sommet qui reprend le mordant de la plaine
+  const col = 0.3
+  const sansVoile = brume({ col, lum: 0.5, veil: 0, couleur: 0.7, hazeAmt: 0.45 })
+  assert.ok(sansVoile < col, 'le rehaussement ne mord pas sur les valeurs basses')
+  // ⚠️ **À FORCE NULLE LA BRUME EST L'IDENTITÉ — MAIS PAS AU BIT PRÈS, ET IL
+  // FAUT LE DIRE.** `(c − 0,5) · 1 + 0,5` ne rend pas `c` en virgule flottante
+  // (0,02 ressort à 0,020000000000000018). Ce n'est pas un défaut : le nuanceur
+  // ne franchit ce bloc que sous `uHazeAmt > 0.001`, donc l'identité n'est jamais
+  // exercée. On l'affirme à l'ULP près plutôt que de la déclarer exacte — un
+  // `Object.is` ici aurait été une promesse fausse.
+  for (const c of balayage(50)) {
+    const v = brume({ col: c, lum: 0.5, veil: 0, couleur: 0.7, hazeAmt: 0 })
+    assert.ok(Math.abs(v - c) < 1e-15, `c=${c} → ${v}`)
+  }
+  assert.match(FRAG_GLOBE, /uHazeAmt > 0\.001/) // la garde qui rend l'identité inatteignable
+  // et la luminance est celle de Rec. 709
+  assert.ok(Math.abs(luminance([1, 1, 1]) - 1) < 1e-12)
+  assert.ok(Math.abs(luminance([0, 1, 0]) - LUMA_709[1]) < 1e-15)
+})
+
+// ══════════ ② LE TEXTE GLSL, TRADUIT PUIS EXÉCUTÉ ══════════════════════════
+
+test('②a le traducteur a bien produit les huit fonctions — sinon ② ne prouve rien', () => {
+  // ⚠️ **UN TRADUCTEUR QUI RATE SA CIBLE REND UN TEST VERT ET VIDE.** C'est la
+  // neuvième façon de mentir du §0 : un banc qui ne rend rien ressemble à un
+  // banc qui rend juste. On exige donc les fonctions AVANT de les comparer.
+  for (const nom of ['natPlancherPivot', 'natRampT', 'natHumiditeY', 'natEcartPeigne', 'natSoftLight', 'natPeigne', 'natVoile', 'natBrume']) {
+    assert.equal(typeof NUANCEUR[nom], 'function', `${nom} n'a pas été traduite`)
+  }
+  // et le texte traduit ne doit plus porter un seul type GLSL
+  assert.ok(!/\b(?:float|vec3|vec4)\b/.test(JS_NATUREL), JS_NATUREL.slice(0, 400))
+})
+
+test('②b natPlancherPivot / natRampT / natEcartPeigne : le TEXTE égale la loi', () => {
+  for (const x of balayage(200)) {
+    assert.equal(NUANCEUR.natPlancherPivot(x), plancherPivot(x), `x=${x}`)
+    assert.equal(NUANCEUR.natEcartPeigne(x), ecartPeigne(x), `x=${x}`)
+  }
+  assert.equal(NUANCEUR.natPlancherPivot(-3), plancherPivot(-3))
+  assert.equal(NUANCEUR.natPlancherPivot(4), plancherPivot(4))
+  for (const h of balayage(30)) {
+    for (const p of [0, 0.47, 0.5, 0.6, 1]) {
+      for (const c of [0.4, 1, 1.5, 5.1]) {
+        assert.equal(NUANCEUR.natRampT(h, p, c), rampeT(h, p, c), `h=${h} p=${p} c=${c}`)
+      }
+    }
+  }
+})
+
+test('②c natHumiditeY : le TEXTE égale la loi — sur 3 528 combinaisons', () => {
+  let n = 0
+  for (const b of balayage(6)) {
+    for (const a of balayage(6)) {
+      for (const h of balayage(5)) {
+        for (const wk of [0, 0.55, 0.96]) {
+          for (const ek of [0, 0.35]) {
+            for (const hemi of [1, -1]) {
+              n++
+              assert.equal(
+                NUANCEUR.natHumiditeY(b, a, h, wk, ek, hemi, 0.62),
+                humiditeY({ canalB: b, canalA: a, hNorm: h, wetK: wk, expoK: ek, hemi, treeLine: 0.62 }),
+                `b=${b} a=${a} h=${h}`
+              )
+            }
+          }
+        }
+      }
+    }
+  }
+  // ⚠️ LE DÉNOMINATEUR EST ÉCRIT PAR LA BOUCLE, PAS PAR LE TITRE — un titre qui
+  // annonce un compte que la boucle ne fait pas est un chiffre faux.
+  assert.equal(n, 3528, `le balayage a fait ${n} combinaisons, pas 3 528`)
+})
+
+test('②d natSoftLight et natPeigne : le TEXTE égale la loi, canal par canal', () => {
+  for (const b of balayage(40)) {
+    for (const s of balayage(40)) {
+      assert.equal(NUANCEUR.natSoftLight(b, s), softLight(b, s), `b=${b} s=${s}`)
+    }
+  }
+  for (const c of balayage(20)) {
+    for (const r of balayage(10)) {
+      for (const g of balayage(10)) {
+        for (const k of [0, 0.35, 0.6, 1]) {
+          assert.equal(NUANCEUR.natPeigne(c, r, g, k), peigne(c, r, g, k), `c=${c} r=${r} g=${g} k=${k}`)
+        }
+      }
+    }
+  }
+})
+
+test('②e natVoile et natBrume : le TEXTE égale la loi', () => {
+  for (const h of balayage(20)) {
+    for (const fd of balayage(10)) {
+      for (const amt of [0, 0.32, 0.45, 1]) {
+        const v = NUANCEUR.natVoile(h, fd, amt, 0.5, 0.5)
+        assert.equal(v, voile({ hNorm: h, fd, hazeAmt: amt, hazeAlt: 0.5, hazeDist: 0.5 }), `h=${h} fd=${fd}`)
+        for (const c of balayage(8)) {
+          assert.equal(
+            NUANCEUR.natBrume(c, 0.42, v, 0.73, amt),
+            brume({ col: c, lum: 0.42, veil: v, couleur: 0.73, hazeAmt: amt }),
+            `c=${c} v=${v}`
+          )
+        }
+      }
+    }
+  }
+})
+
+test('②f natLuminance porte EXACTEMENT les coefficients Rec. 709 du module', () => {
+  // hors protocole canal-par-canal (dot mélange les canaux) : on EXTRAIT les
+  // trois nombres du texte et on les confronte à la constante partagée.
+  const m = GLSL_NATUREL.match(/float natLuminance\(vec3 c\) \{\s*return dot\(c, vec3\(([^)]*)\)\);/)
+  assert.ok(m, 'natLuminance introuvable dans GLSL_NATUREL')
+  assert.deepEqual(m[1].split(',').map((s) => Number(s.trim())), [...LUMA_709])
+})
+
+// ══════════ ③ UNE SEULE ÉCRITURE — L'ASSERTION QUI TIENT TOUT LE FICHIER ═══
+
+test('③a les deux nuanceurs INJECTENT le module, ils ne le recopient pas', () => {
+  assert.match(TERRAIN_SRC, /import \{ GLSL_NATUREL \} from '\.\/monde\/naturel-crop\.js'/)
+  assert.match(GLOBE_SRC, /import \{ GLSL_NATUREL, NATUREL_MONDE \} from '\.\/monde\/naturel-crop\.js'/)
+  assert.match(TERRAIN_SRC, /\$\{GLSL_NATUREL\}/)
+  assert.match(GLOBE_SRC, /\$\{GLSL_NATUREL\}/)
+})
+
+test('③b AUCUNE des formules ne reparaît dans terrain.js ni dans globe.js', () => {
+  // ⚠️ **C'EST L'ASSERTION QUI DISTINGUE UNE EXTRACTION D'UNE TRANSCRIPTION.**
+  // Une transcription laisse deux écritures, et `terrain.js` porte déjà la
+  // cicatrice de ce choix (« deux écritures jumelles finiraient par diverger »).
+  // Ici les deux nuanceurs partagent le TEXTE : les formules ne doivent donc
+  // exister qu'une fois, dans `naturel-crop.js`.
+  //
+  // ⚠️ Les commentaires sont RETIRÉS avant de chercher — c'est la leçon de la
+  // Tâche K ter, dont une assertion trouvait la formule dans un pavé de prose.
+  const sansCommentaires = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
+  // ⚠️ **DEUX MOTIFS PAR FORMULE, ET CE N'EST PAS UN DOUBLON.** Le module écrit
+  // ses formules sur des PARAMÈTRES (`treeLine`, `c`) là où les nuanceurs les
+  // écrivaient sur des UNIFORMES (`uTreeLine`, `mapCol`). Un motif unique aurait
+  // donc été soit trop lâche côté interdiction, soit introuvable côté module —
+  // et « introuvable côté module » est le cas où le test ne garde plus rien.
+  const FORMULES = [
+    { quoi: 'le gain d’humidité', interdit: /4\.86\s*\*\s*veg/, present: /4\.86\s*\*\s*veg/ },
+    { quoi: 'le polynôme du soft light', interdit: /\(16\.0\s*\*\s*b\s*-\s*12\.0\)/, present: /\(16\.0\s*\*\s*b\s*-\s*12\.0\)/ },
+    { quoi: 'la bande de végétation', interdit: /uTreeLine\s*\+\s*0\.18/, present: /\btreeLine\s*\+\s*0\.18/ },
+    // ⚠️ **LA CIBLE EST LA LUMINANCE DU VOILE, PAS TOUTE LUMINANCE Rec. 709.**
+    // `terrain.js` en porte une autre, sans rapport (le `luma` de `fxShade`,
+    // l. 977), et l'interdire globalement aurait fait crier ce test sur un poste
+    // qui n'est pas le sien — un dénominateur qui déborde de sa question.
+    { quoi: 'la luminance du voile', interdit: /dot\((?:mapCol|col),\s*vec3\(0\.2126/, present: /dot\(c,\s*vec3\(0\.2126/ },
+    { quoi: 'le mélange du voile', interdit: /0\.6\s*\*\s*fa\s*\+/, present: /0\.6\s*\*\s*fa\s*\+/ },
+    { quoi: 'le plancher de pivot', interdit: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/, present: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/ },
+    { quoi: 'le gain du peigné', interdit: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/, present: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/ },
+  ]
+  for (const src of [sansCommentaires(TERRAIN_SRC), sansCommentaires(GLOBE_SRC)]) {
+    for (const f of FORMULES) assert.ok(!f.interdit.test(src), `formule réécrite : ${f.quoi}`)
+  }
+  // ... et chacune existe bien UNE fois dans le module, sinon on ne garde rien
+  for (const f of FORMULES) assert.ok(f.present.test(GLSL_NATUREL), `formule absente du module : ${f.quoi}`)
+})
+
+test('③c le socle APPELLE les fonctions partagées — il ne les a pas juste importées', () => {
+  const sansCommentaires = TERRAIN_SRC.replace(/\/\/[^\n]*/g, ' ')
+  for (const appel of ['natPlancherPivot(', 'natRampT(', 'natHumiditeY(', 'natPeigne(', 'natVoile(', 'natBrume(', 'natLuminance(']) {
+    assert.ok(sansCommentaires.includes(appel), `terrain.js n'appelle pas ${appel}`)
+  }
+  // ⚠️ ET `fxBlend` mode 10 DÉLÈGUE au soft light partagé plutôt que de le
+  // réécrire : c'était la SEULE autre écriture du soft light du dépôt.
+  assert.match(sansCommentaires, /if \(m == 10\) return natSoftLight\(b, s\);/)
+})
+
+// ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════
+
+test('④a `contexteCrop` transmet l’analyse ET la table du socle', () => {
+  // ⛔ **C'ÉTAIT LE TROU.** `contexteCrop` ne portait AUCUNE texture d'analyse :
+  // la richesse du socle était calculée, payée, et jetée à la porte du globe.
+  const i = MAIN_SRC.indexOf('function contexteCrop()')
+  assert.ok(i > 0, '`contexteCrop` introuvable')
+  const bloc = MAIN_SRC.slice(i, MAIN_SRC.indexOf('\n}\n', i)).replace(/\/\/[^\n]*/g, ' ')
+  assert.match(bloc, /terrain\.mapUniforms\.uAnalysisOn\.value > 0\.5 \? terrain\.mapUniforms\.uAnalysis\.value : null/)
+  assert.match(bloc, /terrain\.mapUniforms\.uRampTex\.value \|\| null/)
+  for (const champ of ['texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist']) {
+    assert.ok(bloc.includes(`${champ}: terrain.mapUniforms.u`), `${champ} ne traverse pas contexteCrop`)
+  }
+  // ⚠️ **LA COULEUR DE BRUME PASSE EN VALEUR, PAS EN OBJET** : `THREE.Color` est
+  // muté en place par le socle, donc son identité ne changerait jamais.
+  assert.match(bloc, /hazeColor: `#\$\{terrain\.mapUniforms\.uHazeColor\.value\.getHexString\(\)\}`/)
+})
+
+test('④b la veille SURVEILLE les treize champs neufs — sinon ils arrivent trop tard', () => {
+  // ⚠️ **L'ANALYSE EST LE CHAMP LE PLUS EN RETARD DE LA LISTE** : elle sort d'un
+  // travailleur, ~464 ms après la naissance du crop (mesure de `terrain.js`).
+  // Sans surveillance, le peigné n'apparaîtrait qu'au prochain changement de
+  // LIEU — la course que la Tâche K ter a nommée, en pire.
+  for (const champ of ['analyse', 'rampe2D', 'texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist', 'hazeColor']) {
+    assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} n'est pas surveillé`)
+  }
+  // et chacun, SEUL, déclenche une repose — le défaut « deux champs bougés
+  // ensemble » que le second tour de la Tâche K ter a trouvé
+  const pose = {}
+  for (const c of CHAMPS_HABILLAGE) pose[c] = null
+  assert.equal(habillageDifferent(pose, { ...pose }), false, 'un contexte identique repose quand même')
+  for (const champ of CHAMPS_HABILLAGE) {
+    assert.equal(habillageDifferent(pose, { ...pose, [champ]: 'autre' }), true, `${champ} bougé SEUL ne repose pas`)
+  }
+})
+
+test('④c `poserHabillage` allume les deux interrupteurs — et SEULEMENT s’il y a de quoi', () => {
+  const g = globeStub()
+  Globe.prototype.poserHabillage.call(g, {})
+  assert.equal(g.uniforms.uAnalysisOn.value, 0, 'allumé sans analyse')
+  assert.equal(g.uniforms.uRampCropOn.value, 0, 'allumé sans table')
+  const TEX = { nom: 'analyse' }
+  const LUT = { nom: 'lut 2D' }
+  // ⚠️ **CHAQUE CURSEUR EST POSÉ AVEC UNE VALEUR DISTINCTE DE SON DÉFAUT, ET
+  // AUCUN N'EST OMIS.** La première rédaction n'en vérifiait que trois, et une
+  // mutation qui figeait `uHemi` à 1 — donc qui renversait l'adret et l'ubac de
+  // tout l'hémisphère SUD, où se trouve le lieu de référence du chantier —
+  // SURVIVAIT. C'est exactement la faiblesse que ce chantier paie depuis cinq
+  // tâches : le branchement testé à moitié.
+  const REGLAGES = {
+    texShade: 1, wetK: 0.96, expoK: 0.02, hemi: -1, treeLine: 0.92,
+    heightContrast: 2.5, heightPivot: 0.65, hazeAmt: 0.32, hazeAlt: 0.4, hazeDist: 0.6,
+  }
+  Globe.prototype.poserHabillage.call(g, { analyse: TEX, rampe2D: LUT, ...REGLAGES, hazeColor: '#0a0b0c' })
+  assert.equal(g.uniforms.uAnalysis.value, TEX)
+  assert.equal(g.uniforms.uAnalysisOn.value, 1)
+  assert.equal(g.uniforms.uRampCrop.value, LUT)
+  assert.equal(g.uniforms.uRampCropOn.value, 1)
+  for (const [cle, attendu] of Object.entries(REGLAGES)) {
+    const nom = `u${cle[0].toUpperCase()}${cle.slice(1)}`
+    assert.notEqual(attendu, NATUREL_MONDE[cle], `${cle} est posé à sa valeur par défaut : la mutation ne se verrait pas`)
+    assert.equal(g.uniforms[nom].value, attendu, `${nom} n’est pas posé depuis l’argument ${cle}`)
+  }
+  assert.equal(g.uniforms.uHazeColor.value.hex, '#0a0b0c')
+  // ⚠️ **LES DEUX INTERRUPTEURS SONT INDÉPENDANTS**, et ce n'est pas un luxe :
+  // la table existe TOUJOURS (elle porte le pivot et le contraste, qui valent
+  // dans les deux modes de couleur), l'analyse seulement en mode Naturel et
+  // seulement une fois le travailleur revenu.
+  Globe.prototype.poserHabillage.call(g, { rampe2D: LUT })
+  assert.equal(g.uniforms.uAnalysisOn.value, 0)
+  assert.equal(g.uniforms.uRampCropOn.value, 1)
+})
+
+test('④d `retirerHabillage` LÂCHE les deux textures et rend les curseurs', () => {
+  const g = globeStub()
+  Globe.prototype.poserHabillage.call(g, {
+    analyse: { n: 1 }, rampe2D: { n: 2 }, texShade: 1, wetK: 0.96, expoK: 0.35,
+    hemi: -1, treeLine: 0.9, heightContrast: 5.1, heightPivot: 0.53,
+    hazeAmt: 0.32, hazeAlt: 0.4, hazeDist: 0.6, hazeColor: '#010203',
+  })
+  Globe.prototype.retirerHabillage.call(g)
+  // ⚠️ LÂCHÉES, pas seulement débranchées : l'analyse d'un MNT 1536² pèse 12 Mo
+  // mipmaps comprises, et un uniforme PARTAGÉ la garderait joignable.
+  assert.equal(g.uniforms.uAnalysis.value, null)
+  assert.equal(g.uniforms.uRampCrop.value, null)
+  assert.equal(g.uniforms.uAnalysisOn.value, 0)
+  assert.equal(g.uniforms.uRampCropOn.value, 0)
+  for (const [nom, cle] of [
+    ['uTexShade', 'texShade'], ['uWetK', 'wetK'], ['uExpoK', 'expoK'], ['uHemi', 'hemi'],
+    ['uTreeLine', 'treeLine'], ['uHeightContrast', 'heightContrast'], ['uHeightPivot', 'heightPivot'],
+    ['uHazeAmt', 'hazeAmt'], ['uHazeAlt', 'hazeAlt'], ['uHazeDist', 'hazeDist'],
+  ]) {
+    assert.ok(Object.is(g.uniforms[nom].value, NATUREL_MONDE[cle]), `${nom} non rendu`)
+  }
+  assert.equal(g.uniforms.uHazeColor.value.hex, NATUREL_MONDE.hazeColor)
+})
+
+test('④e le constructeur PREND ses valeurs dans NATUREL_MONDE — une seule écriture', () => {
+  // ⚠️ MÊME DÉFAUT QUE `uContourInterval` AU TOUR 1 DE LA TÂCHE C : deux
+  // littéraux jumeaux (le constructeur et `retirerHabillage`) divergent en
+  // silence, et la planète entière garde le réglage d'un crop mort.
+  const bloc = GLOBE_SRC.slice(GLOBE_SRC.indexOf('uAnalysis: { value: null }'), GLOBE_SRC.indexOf('uHazeColor: { value: new THREE.Color') + 200)
+  for (const cle of ['texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist', 'hazeColor']) {
+    assert.ok(bloc.includes(`NATUREL_MONDE.${cle}`), `le constructeur recopie ${cle} au lieu de le lire`)
+  }
+  assert.match(GLOBE_SRC, /uAnalysisOn: \{ value: 0 \}/)
+  assert.match(GLOBE_SRC, /uRampCropOn: \{ value: 0 \}/)
+})
+
+// ══════════ ⑤ LE NUANCEUR DU GLOBE — LES GARDES, EXÉCUTÉES ═════════════════
+
+test('⑤a l’analyse est BORNÉE au crop — sinon La Réunion peigne les Andes', () => {
+  // ⛔ **LE MÊME PIÈGE QUE `uFondChamp`, ET IL A DÉJÀ ÉTÉ VU À L'ÉCRAN** : la
+  // Tâche K ter a relevé le masque de côte de La Réunion décidant de la terre et
+  // de la mer SUR TOUTE LA SPHÈRE, par ClampToEdge. La texture d'analyse a
+  // exactement la même forme.
+  const i = FRAG_GLOBE.indexOf('anl = mix(')
+  assert.ok(i > 0, 'la lecture de l’analyse est introuvable')
+  const ligne = FRAG_GLOBE.slice(FRAG_GLOBE.lastIndexOf('\n', i), FRAG_GLOBE.indexOf(';', i))
+  assert.match(ligne, /texture2D\(uAnalysis, qCrop \* 0\.5 \+ 0\.5\)/)
+  assert.match(ligne, /dansCrop/)
+  // et la borne est EXÉCUTÉE : hors du crop, le fondu rend le neutre
+  const iB = FRAG_GLOBE.indexOf('float dansCrop = ')
+  const exprBorne = FRAG_GLOBE.slice(iB + 'float dansCrop = '.length, FRAG_GLOBE.indexOf(';', iB))
+  // eslint-disable-next-line no-new-func
+  const borne = new Function('qCrop', 'STEP', `return (${exprBorne.replace(/\bstep\s*\(/g, 'STEP(').replace(/\bmax\s*\(/g, 'Math.max(').replace(/\babs\s*\(/g, 'Math.abs(')});`)
+  for (const [x, y, attendu] of [[0, 0, 1], [0.99, -0.99, 1], [1, 1, 1], [1.01, 0, 0], [0, -1.5, 0], [40, 40, 0]]) {
+    assert.equal(borne({ x, y }, STEP), attendu, `qCrop=(${x}, ${y})`)
+  }
+})
+
+test('⑤b le peigné et le voile ne mordent QUE sur la terre, et sous garde d’uniforme', () => {
+  // ⚠️ **TERRE SEULE, COMME DANS LE SOCLE** : la branche sous-marine de
+  // `terrain.js` ne voit jamais ce bloc. Peigner le fond marin y graverait des
+  // crêtes que la bathymétrie ne porte pas.
+  //
+  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER, ET CE N'EST PAS UNE
+  // COQUETTERIE** : la première rédaction de ce test découpait une fenêtre de
+  // 300 caractères avant l'appel, et le pavé qui EXPLIQUE la garde est tombé
+  // dedans. C'est mot pour mot la survivante que la Tâche K ter a trouvée — une
+  // assertion verte parce qu'elle lisait de la prose.
+  const gardeDe = (appel) => {
+    const i = FRAG_NU.indexOf(appel)
+    assert.ok(i > 0, `${appel} introuvable dans le nuanceur`)
+    const j = FRAG_NU.lastIndexOf('if (', i)
+    return FRAG_NU.slice(j, FRAG_NU.indexOf(')', FRAG_NU.indexOf('{', j) - 2) + 1)
+  }
+  assert.match(gardeDe('col = natPeigne('), /if \(uAnalysisOn > 0\.5 && uTexShade > 0\.001 && !sousEau\)/)
+  assert.match(gardeDe('float veil = natVoile('), /if \(uRampCropOn > 0\.5 && uHazeAmt > 0\.001 && !sousEau\)/)
+  assert.match(gardeDe('float rampT = natRampT('), /if \(uRampCropOn > 0\.5 && !sousEau\)/)
+})
+
+test('⑤c la distance du voile est length(qCrop) — la MÊME grandeur que celle du socle', () => {
+  // ⚠️ **CE N'EST PAS UNE APPROXIMATION** : `terrain.js` divise par `uSlabHalf`
+  // (28) une distance en unités de scène, et l'en-tête de `habillage-crop.js`
+  // DÉMONTRE `x = 28 · u`. Le quotient EST `qCrop`, terme à terme.
+  assert.match(FRAG_GLOBE, /float fd = clamp\(length\(qCrop\), 0\.0, 1\.0\);/)
+  assert.match(TERRAIN_SRC, /float fd = clamp\(length\(vWorldPos\.xz - uBlockOffset\) \/ max\(uSlabHalf, 1e-3\), 0\.0, 1\.0\);/)
+})
+
+test('⑤d le pivot, la limite des arbres et le voile lisent hNormRelief — l’échelle DU SOCLE', () => {
+  // ⛔ **LA FAUTE QUE LA COMPARAISON APPARIÉE A RÉVÉLÉE, ET ELLE EST CHIFFRÉE.**
+  // Le socle normalise sur `uHeightRange`, l'amplitude COMPLÈTE de son MNT, FOND
+  // MARIN COMPRIS : relevé dans l'application vivante (La Réunion z12), il couvre
+  // −2 116 → 2 626 m, donc le niveau de la mer y tombe à **hNorm = 0,4462**, pas
+  // à zéro. `uHeightPivot` (0,65) et `uTreeLine` (0,92) sont des réglages POSÉS
+  // DANS CETTE ÉCHELLE. Les appliquer au `hNorm` de la Tâche D — qui part du
+  // minimum de la TERRE, donc met la mer à zéro — rendait `natRampT = 0` pour
+  // TOUT ce qui est sous **1 163 m** (un aplat olive sur toute l'île) là où le
+  // socle étale déjà 0 → 0,78 sur la même tranche.
+  const i = FRAG_GLOBE.indexOf('float hNormRelief = ')
+  assert.ok(i > 0, 'hNormRelief est introuvable dans le nuanceur du globe')
+  const expr = FRAG_GLOBE.slice(i + 'float hNormRelief = '.length, FRAG_GLOBE.indexOf(';', i))
+  assert.match(expr, /clamp\(\(h \+ uOceanDepth\) \/ max\(uLandMax \+ uOceanDepth, uPlancherRampeM\), 0\.0, 1\.0\)/)
+  // ⚠️ **ET IL EST EXÉCUTÉ, PAS SEULEMENT LU.** On rejoue les DEUX conventions
+  // sur les valeurs relevées et on exige que celle du nuanceur suive le socle.
+  const SOCLE = { min: -2116, max: 2626 } // uHeightRange, relevé le 2026-08-22
+  const G = { landBas: 0, landMax: 2584.3525390625, oceanDepth: 2106.7706909179688 }
+  const cl = (v) => Math.min(Math.max(v, 0), 1)
+  const hSocle = (m) => cl((m - SOCLE.min) / (SOCLE.max - SOCLE.min))
+  const hTerre = (m) => cl((m - G.landBas) / (G.landMax - G.landBas))
+  const hRelief = (m) => cl((m + G.oceanDepth) / (G.landMax + G.oceanDepth))
+  for (const m of [0, 200, 500, 1000, 1500, 2000]) {
+    const cible = rampeT(hSocle(m), 0.65, 2.5)
+    const bon = rampeT(hRelief(m), 0.65, 2.5)
+    const faux = rampeT(hTerre(m), 0.65, 2.5)
+    assert.ok(Math.abs(bon - cible) < 0.02, `${m} m : hNormRelief donne ${bon}, le socle ${cible}`)
+    if (m > 0 && m < 2000) assert.ok(Math.abs(faux - cible) > 0.05, `${m} m : les deux conventions ne se distinguent pas — le test ne prouve rien`)
+  }
+  // le plancher du pivot suit la MÊME conversion : la mer est à h = 0
+  assert.match(FRAG_GLOBE, /natPlancherPivot\(uOceanDepth \/ max\(uLandMax \+ uOceanDepth, uPlancherRampeM\)\)/)
+  assert.ok(Math.abs(plancherPivot(G.oceanDepth / (G.landMax + G.oceanDepth)) - plancherPivot(hSocle(0))) < 0.01)
+  // et un pivot d'utilisateur plus haut que le plancher gagne — c'est un réglage
+  assert.equal(Math.max(0.65, plancherPivot(hSocle(0))), 0.65)
+  assert.equal(plancherPivot(0), MARGE_PIVOT)
+  // les trois lecteurs de l'échelle du socle emploient hNormRelief, aucun hNorm
+  for (const appel of ['natRampT(hNormRelief,', 'natHumiditeY(anl.b, anl.a, hNormRelief,', 'natVoile(hNormRelief,']) {
+    assert.ok(FRAG_GLOBE.includes(appel), `${appel} : un lecteur est resté sur l’échelle de la Tâche D`)
+  }
+})
+
+// --- le stub, en fin de fichier : il n'est utile qu'aux tests ④
+
+const val = (v) => ({ value: v })
+function globeStub() {
+  return {
+    _crop: null,
+    uniforms: {
+      uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
+      uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
+      uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
+      uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
+      uGrainForceM: val(0), uGrainEchelle: val(96),
+      uAnalysis: val(null), uAnalysisOn: val(0),
+      uTexShade: val(NATUREL_MONDE.texShade), uWetK: val(NATUREL_MONDE.wetK),
+      uExpoK: val(NATUREL_MONDE.expoK), uHemi: val(NATUREL_MONDE.hemi),
+      uTreeLine: val(NATUREL_MONDE.treeLine),
+      uRampCrop: val(null), uRampCropOn: val(0),
+      uHeightContrast: val(NATUREL_MONDE.heightContrast), uHeightPivot: val(NATUREL_MONDE.heightPivot),
+      uHazeAmt: val(NATUREL_MONDE.hazeAmt), uHazeAlt: val(NATUREL_MONDE.hazeAlt),
+      uHazeDist: val(NATUREL_MONDE.hazeDist),
+      uHazeColor: val({ hex: NATUREL_MONDE.hazeColor, set(v) { this.hex = v } }),
+    },
+  }
+}
+
+test('⑤e sans crop, `smoothstep` du module et celui du GLSL parlent la même langue', () => {
+  // ⚠️ **LE JUMEAU JS DOIT ÊTRE LE MÊME `smoothstep` QUE LE GPU**, sinon toute la
+  // section ② compare deux erreurs. On confronte donc l'implémentation du module
+  // à celle du transpileur, qui est écrite séparément.
+  for (const x of balayage(200)) {
+    assert.ok(Math.abs(smoothstep(0.2, 0.8, x * 1.4 - 0.2) - SMOOTHSTEP(0.2, 0.8, x * 1.4 - 0.2)) < 1e-15, `x=${x}`)
+  }
+})
diff --git a/test/crop-rampe.test.js b/test/crop-rampe.test.js
index 542a868..9ac1893 100644
--- a/test/crop-rampe.test.js
+++ b/test/crop-rampe.test.js
@@ -73,34 +73,61 @@ function expressionRampe(src) {
   const i = src.indexOf('float t = sousEau')
   assert.ok(i >= 0, 'le nuanceur doit porter « float t = sousEau »')
   const j = src.indexOf(';', i)
   return src
     .slice(i + 'float t = '.length, j)
     .replace(/\/\/[^\n]*/g, ' ')
     .replace(/\s+/g, ' ')
     .trim()
 }
 
+// ⚠️ **`hNorm` EST DÉSORMAIS UNE LIGNE À PART — Tâche P2, ET LE TEST LA SUIT.**
+// La branche TERRE de `float t` s'écrivait en toutes lettres ; la colorisation
+// naturelle a besoin de la MÊME amplitude locale quatre fois de plus (pivot,
+// limite des arbres, voile aérien), et l'écrire deux fois aurait donné deux
+// amplitudes à garder d'accord. La loi n'a pas bougé d'un bit — c'est pourquoi
+// on l'EXTRAIT ELLE AUSSI et qu'on l'exécute, au lieu de la supposer.
+function expressionHNorm(src) {
+  const i = src.indexOf('float hNorm = clamp(')
+  assert.ok(i >= 0, 'le nuanceur doit porter « float hNorm = clamp( »')
+  const j = src.indexOf(';', i)
+  return src
+    .slice(i + 'float hNorm = '.length, j)
+    .replace(/\/\/[^\n]*/g, ' ')
+    .replace(/\s+/g, ' ')
+    .trim()
+}
+
 function CLAMP(x, a, b) {
   return Math.min(Math.max(x, a), b)
 }
 
-/** Le TEXTE du nuanceur, rendu exécutable. */
-function loiDuNuanceur(src) {
-  const js = expressionRampe(src)
+const enJs = (glsl) =>
+  glsl
     .replace(/\bclamp\s*\(/g, 'CLAMP(')
     .replace(/\bmax\s*\(/g, 'Math.max(')
     .replace(/\bmin\s*\(/g, 'Math.min(')
-  const noms = [...new Set(js.match(/\bu[A-Z][A-Za-z0-9]*/g) || [])]
+
+/** Le TEXTE du nuanceur, rendu exécutable. */
+function loiDuNuanceur(src) {
+  const hn = enJs(expressionHNorm(src))
+  const js = enJs(expressionRampe(src))
+  const noms = [...new Set(`${hn} ${js}`.match(/\bu[A-Z][A-Za-z0-9]*/g) || [])]
   // eslint-disable-next-line no-new-func
-  const f = new Function('h', 'sousEau', 'u', 'CLAMP', `const {${noms.join(',')}} = u; return (${js});`)
-  return { js, noms, t: (h, sousEau, u) => f(h, sousEau, u, CLAMP) }
+  const f = new Function(
+    'h',
+    'sousEau',
+    'u',
+    'CLAMP',
+    `const {${noms.join(',')}} = u; const hNorm = (${hn}); return (${js});`
+  )
+  return { js, hNorm: hn, noms, t: (h, sousEau, u) => f(h, sousEau, u, CLAMP) }
 }
 
 /** Les uniformes de rampe que `poserRampe` posera, pour une échelle donnée. */
 function uniformesDe(e) {
   return {
     uLandBas: e.terreBas,
     uLandMax: e.terreHaut,
     uOceanDepth: e.profondeur,
     uPlancherRampeM: e.plancherM,
   }
@@ -245,24 +272,37 @@ test('②b le nuanceur et la loi JS rendent le MÊME t, sur tout le balayage', (
 
 test("②c la rampe est calculée UNE SEULE FOIS, hors de toute branche", () => {
   // ⚠️ **C'EST L'ASSERTION QUI TUE LA LOI BRIDÉE.** Pour appliquer une échelle
   // au crop et une autre au monde, il faudrait un SECOND calcul de `t` sous une
   // garde par fragment : les uniformes, eux, sont posés par appel de dessin et
   // ne savent rien de l'appartenance au crop. Une seule occurrence de
   // « float t = » et une seule lecture de la rampe : la couture ne peut pas
   // naître.
   const frag = globeSrc.slice(globeSrc.indexOf('const FRAG'))
   assert.equal((frag.match(/\bfloat t = /g) || []).length, 1)
-  assert.equal((frag.match(/texture2D\(uRamp/g) || []).length, 1)
-  // ... et l'expression ne consulte NI le crop NI la couverture
+  assert.equal((frag.match(/texture2D\(uRamp,/g) || []).length, 1)
+  // ⚠️ **LA TABLE DU SOCLE EST UNE SECONDE LECTURE, ET ELLE NE ROUVRE PAS LA
+  // COUTURE — Tâche P2.** `uRampCrop` EST le LUT 2D du bloc, lu une seule fois,
+  // sous une garde qui est un UNIFORME (`uRampCropOn`) : les uniformes sont
+  // posés par appel de dessin et valent la même chose pour TOUTES les tuiles de
+  // la planète. La loi bridée que ce test tue demanderait au contraire une garde
+  // par FRAGMENT — l'appartenance au crop —, et c'est exactement ce que
+  // l'assertion suivante interdit dans les deux expressions de rampe.
+  assert.equal((frag.match(/texture2D\(uRampCrop,/g) || []).length, 1)
+  // ... et NI L'UNE NI L'AUTRE ne consulte le crop ou la couverture
   const expr = expressionRampe(globeSrc)
   assert.ok(!/uCrop|couvertureCrop|qCrop|dedans/.test(expr), expr)
+  assert.ok(!/uCrop|couvertureCrop|qCrop|dedans/.test(expressionHNorm(globeSrc)), expressionHNorm(globeSrc))
+  const iRampT = frag.indexOf('float rampT = natRampT(')
+  assert.ok(iRampT > 0, 'le nuanceur doit dériver rampT de natRampT (module partagé)')
+  const exprRampT = frag.slice(iRampT, frag.indexOf(';', iRampT))
+  assert.ok(!/couvertureCrop|qCrop|dedans/.test(exprRampT), exprRampT)
 })
 
 /**
  * Le bloc `this.uniforms = { ... }` de `globe.js`, borné sur la FERMETURE de
  * l'objet.
  *
  * ⚠️ **LA PREMIÈRE VERSION LE BORNAIT SUR `_materialFor`, ET C'ÉTAIT FAUX** :
  * le nom est CITÉ dans le commentaire du bloc lui-même (« que `_materialFor`
  * étale dans chaque matériau »), donc la tranche s'arrêtait AVANT `uLandBas` et
  * l'assertion échouait pour la mauvaise raison.
