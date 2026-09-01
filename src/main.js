import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  EffectComposer,
  RenderPass,
  ClearPass, // la chaîne `?terre=deux` s'en sert encore — voir le bloc « UNE SEULE PASSE »
  EffectPass,
  DepthOfFieldEffect,
  VignetteEffect,
  NoiseEffect,
  SMAAEffect,
  HueSaturationEffect,
  BrightnessContrastEffect,
  ToneMappingEffect,
  ToneMappingMode,
  Effect,
  BlendFunction,
} from 'postprocessing'
import { Terrain } from './terrain.js'
import { createLabels, disposeLabels } from './labels.js'
import { createHud3D, findPois } from './hud3d.js'
import { loadDem, getDemMaxZoom, bathySourceIndex } from './dem.js'
// L'attribution des sources bathymétriques fines est une OBLIGATION DE
// LICENCE, et elle dépend de l'emprise exportée — voir export.js.
import { creditFor } from './export.js'
import { creditsForBounds } from './bathy-sources.js'
import { warmupPrograms } from './warmup.js'
import { activeDemSource, isFallbackActive } from './dem-source.js'
import { Globe } from './globe.js'
import { Modes, stepZoom } from './modes.js'
import { DISTANCE_MIN_SURFACE, altitudeSurfaceM, echelleBloc, empriseBlocM } from './loi-altitude.js'
import { intersectionGlobe, viseeArrivee, ZOOM_PALIER_MIN } from './escalier-zoom.js'
import { createGoto, geocode, mainParts } from './goto.js'
import { frameTrack, viseLeCanevas3D } from './gpx.js'
import { GpxLayerManager } from './gpx-layers.js'
import { peutEngagerLeSuivi, doitReamorcerSuivi } from './suivi-course.js'
import { doitReprendreLaLecture } from './clic-ruban.js'
import { buildRaceLabels } from './race-labels.js'
import { buildCourseBar } from './ui/course-bar.js'
import { snapToKm, ascentStats, parseRace } from './race-model.js'
import { carnetALaLigne, resumeParcours } from './carnet-course.js'
import { lisserChamps, decroissant } from './lissage.js'
import { worldToLatLon, latLonToWorld, parseLatLon, sphereToLatLon, R_GLOBE, EARTH_RADIUS_M, ORBITAL_M_PER_UNIT, empriseBlocMNT, latLonVersMondeEmprise, mondeVersLatLonEmprise } from './geo.js'
import { fetchTransports } from './transports.js'
import { TERRAIN_SIZE, RES_FENETRE_CONTINUE } from './terrain.js'
import { FX_LIST, FX_META, defaultFxParams } from './fx-meta.js'
import { monochromeLook, generateEarthPalette, NATURAL_COLOR_PRESET, rampColorStops } from './palette.js'
import { deriveUiTokens, UI_TOKEN_VARS } from './ui-theme.js'
import { gradeForDem, elevationHistogram } from './relief-grade.js'
import { buildPalettePool, pickShufflePalette } from './shuffle-pool.js'
import { peakVantage } from './camera-poses.js'
import { poseIsometrique, modeCameraDamier, doitVraimentDezoomer, poseDamier, cumuleDezoom } from './vue-ensemble.js'
import { focusRayHit, focusRayHitGlobe } from './autofocus.js'
import { doitRafraichirCartouche } from './ground-info.js'
import { GroundInfoLayer } from './ground-info-layer.js'
import { PeaksLayer } from './peaks.js'
import { Clouds2 } from './clouds2.js'
import { Traffic } from './traffic.js'
import { RealWater } from './ocean.js'
import { FLAGS, suiviHelicoActif, portionPoursuite, globeContinuActif, exagContinueActive, socleQuadtreeActif, frontiereRenduActive, seuilSocleActif, terreUniqueActive, planeteEclaireeActive, soleilHeureMondeActif } from './flags.js'
// LA FRONTIERE DE RENDU — Tache 1b bis. Toute la geometrie de la frontiere vit
// la-bas, et elle y est TESTEE sous node ; ici il ne reste que le branchement.
import { poseFond, plansFond, facteurEchelle, rayonAncre } from './monde/frontiere-rendu.js'
import { ancrageCartouche, baseCartoucheEnBloc } from './monde/cartouche-globe.js'
import { ancrageNuages, positionCameraEnBloc } from './monde/nuages-globe.js'
// LE SEUIL DU SOCLE — Tâche 3 branchée. L'automate qui tient l'hystérésis
// d'une image à l'autre ; la LOI (les deux seuils) vit dans `seuil-socle.js`.
import { creerVeilleSocle } from './monde/veille-socle.js'
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
// ══════ LES BOUTONS DU BAS — Tâche R1 ② ═══════════════════════════════
//
// > **Adrien, 2026-08-23 :** « Il me manque les boutons du bas en UI, ils ont
// > disparu (shuffle, affichage photographie aérienne...) »
//
// `poserVisibiliteSocle` bornait son entrée à faux sous le drapeau — ce qui est
// juste pour le MAILLAGE du bloc plat — puis passait ce même booléen borné aux
// trois boutons du bas, qui ne parlent pas du maillage mais de la vue. Deux
// questions, un seul booléen. La loi vit dans un module pour la raison écrite
// trois lignes plus haut : aucun test ne charge `main.js`.
import { visibiliteSurface } from './monde/visibilite-surface.js'
// ══════ LA CARTOGRAPHIE SUR LA SPHÈRE — Tâche D16-b ═══════════════════════
//
// > **Adrien :** « Je souhaite avoir la cartographie qui s'affiche sur la Terre
// > entière. »
//
// La brique commune de la tâche : l'échantillonneur de sol en espace GLOBE.
// ⚠️ **CE N'EST PAS UN SECOND ÉCHANTILLONNEUR DE RELIEF** — `globe.hauteurDessinee`
// existe depuis la Tâche P11 ; ce module est l'ADAPTATEUR bloc ↔ globe, et il
// porte les deux seules conversions d'espace de ce branchement.
import { poseurPourReconstruction } from './monde/sol-globe.js'
// ══════ LE CRÉDIT D'ORTHOPHOTO — Tâche R9, tour de correction ═════════
//
// ⛔ **LA GARDE PRÉCÉDENTE DISAIT « sous `terre unique`, l'orthophoto n'est
// JAMAIS à l'écran », ET R9 A RENDU CETTE PRÉMISSE FAUSSE.** Le crédit suit
// désormais la PHOTO, plus le drapeau. Même raison qu'au-dessus pour le module :
// aucun test ne charge `main.js`, et l'ancienne garde était tenue par une
// expression régulière qui rougissait sur sa propre correction.
import { creditOrthophoto, orthophotoPeinteSurLeCrop } from './monde/credit-orthophoto.js'
// ══════ LA GRANDEUR DU REPOS — Tâche R1, tour 2 ═══════════════════════
//
// ⛔ **ELLE VIVAIT ICI, EN CLAIR, ET C'ÉTAIT UN TROU DE MUTATION.** Remplacer le
// corps de `distanceCadrageM()` par `return altitudeCadrageM()` annulait le
// correctif R1 ① EN ENTIER — l'orbite réveillait de nouveau la planète autour du
// crop — et **passait les 4 131 tests**, parce qu'aucun test de ce dépôt ne
// charge `main.js` et que le seul garde-fou était une expression régulière sur
// le texte source. Le calcul vit donc dans un module pur, exercé par un banc qui
// pose de vraies orbites et de vrais zooms ; ici il n'y a plus qu'un câblage.
import { grandeurRepos } from './monde/grandeur-repos.js'
// ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3 ════════════════════════════════
//
// > **L'agent noteur, 2026-08-22 :** « Le socle est un matériau ÉCLAIRÉ. La
// > tuile du globe est une COULEUR NUE. »
//
// `irradianceAmbiante` est la LOI (module pur, vérifiable sous node) ;
// `coefAmbiante` est la MESURE (elle a besoin du renderer, donc elle vit à
// côté). ⚠️ **L'ambiante n'est pas une constante** : elle pèse 47 % de
// l'irradiance du socle et `applyBackground` peut remplacer
// `scene.environment` par un ciel HDRI — un nombre en dur serait devenu faux
// sans que rien ne le dise.
import { coefAmbiante } from './sonde-ambiante.js'
// ⛔ **ET LA PAROI N'EST PAS ÉCLAIRÉE PAR LE MÊME ENVIRONNEMENT QUE LE RELIEF —
// Tâche P8.** `environnementEffectif` est la règle de `three` (« un matériau qui
// porte son propre `envMap` ne voit ni `scene.environment` ni
// `scene.environmentIntensity` »), écrite une fois, vérifiable sous node. C'est
// elle qui dit LAQUELLE des deux textures sonder pour la paroi du crop.
import { environnementEffectif } from './monde/eclairage-crop.js'
// L'HEURE DE LA PLANÈTE — Tâche R7. La loi vit dans ce module PUR (et il
// n'en écrit pas une seconde : il appelle `directionSoleilLocale` de P3).
import { soleilMondeDeLHeure, poseurDuSoleilDuGlobe, plancherNuitMonde } from './monde/soleil-monde.js'
// LE REPOS DE LA VUE — Tâche N. ⚠️ **PUR, POUR LA MÊME RAISON QUE LES TROIS
// VEILLES CI-DESSUS** : c'est un SEUIL, et le seuil du socle a produit onze
// bascules là où il en fallait une. Ses deux nombres sont MESURÉS sur des traces
// par image relevées dans l'application vivante — voir le §3 du module.
import { creerVeilleRepos } from './monde/veille-repos.js'
import { deltaAzimut, decalagePivot, PIVOT_BLOC_X, PIVOT_BLOC_Z } from './monde/pivot-bloc.js'
import { decalageRecentrage } from './monde/pivot-terre.js'
import { polaireMaxSol, distanceMinSol, POLAIRE_MAX_DURE } from './monde/butee-sol.js'
// ⚠️ `landmarks.js` N'IMPORTE RIEN — c'est ce qui en fait « la seule source de
// la largeur du socle » (`seuil-socle.js`, §0), et ce qui rend cet import sans
// risque de cycle depuis `main.js`, qui est en bout de chaîne.
import { BLOCK_TILES } from './landmarks.js'
// ⚠️ `exageration-continue.js` N'IMPORTE RIEN — voir son en-tête : passer par
// `fenetre-bornee.js` fermerait le cycle terrain.js → fenetre-bornee.js →
// terrain.js, et AUCUN TEST NE CHARGE `main.js` pour l'attraper.
import { lireExageration, poserExageration, creerExagerationPartagee, majExagerationCran, surchargesStockees, courbeExageration, EXAG_BASE } from './monde/exageration-continue.js'
import { EXAGERATION_UNIQUE } from './monde/zoom-continu.js'
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
// ils ne tirent ni three.js ni le DOM, donc les importer ici n'ouvre aucun cycle.
// ⚠️ **`couleursFondDuSocle` EST PURE ELLE AUSSI — Tâche P5** : elle LIT trois
// uniformes et n'en écrit aucun. C'est `majReglagesMer` qui pose.
import { empriseCalotte, PORTEE_CROP, couleursFondDuSocle } from './monde/mer-sphere.js'
import { repereCrop } from './monde/crop-sphere.js'
// ⚠️ **UNE SEULE FONCTION, ET C'EST LA CONVERSION DE LA TIRETTE DES COURBES**
// (Tâche R19) : `params.contourInterval` est en unités de BLOC, `uContourInterval`
// du globe est en MÈTRES. La loi est écrite dans le module pur, jamais ici.
import { intervalleCourbesBloc } from './monde/habillage-crop.js'
// ⚠️ **UNE SEULE FONCTION, ET C'EST L'AUTRE CONVERSION DU MÊME GENRE** (Tâche
// R25) : la bande de fondu du niveau zéro est en unités de BLOC côté socle
// (0,05, sur un relief déjà exagéré) et en MÈTRES côté globe — 12,211 m à La
// Réunion à exagération 2. La loi et son facteur vivent dans le module.
import { bandeZeroMatiereM, BANDE_ZERO_BLOC } from './monde/matiere-crop.js'
// `fractionSurTrace` : le pont d'indices qui remet la tête de course sous
// l'objectif de la poursuite (voir son commentaire dans poursuite.js).
import { fractionSurTrace } from './poursuite.js'
import { ATLAS_COTE, EMPRISE_EN_VOL_MAX, enVolBorne, originesEmprise, recollerEmprise } from './dem-emprise.js'
import { COURSE_ELASTIQUE, avanceFenetre, rappelElastique, poseDansLaCourse, fenetreQuiCentre } from './fenetre-course.js'
import { dansFenetre } from './fenetre-clip.js'
import { vitesseAuLache, pasElan } from './fenetre-elan.js'
import { forceUrl, continuActif, etatInterrupteur } from './fenetre-reglage.js'
import { pasFinesse, finesseInitiale, resDeFinesse, resFinesses, REPOS_S } from './fenetre-finesse.js'
import { MapLayers } from './map/layer-manager.js'
import { AerialLayer, demBounds, aerialUnavailable, SUPERSEDED, providerFor as providerForAerial } from './map/aerial-layer.js'
import { lightingFor, darkModeFor, applyGains, fillDirection, fillLightIntensity, fillEnabledInLook, sunOn, sunShadowOn } from './daycycle.js'
import { signatureCarteOmbre } from './carte-ombre.js'
import { SunDisc } from './sun-disc.js'
import { Plinth, bandeContact } from './plinth.js'
// le cadrage de l'affiche : « tout le socle » se calcule, il ne se devine pas
import { cadrageValide, distanceCadrage, distanceAffiche } from './print-page.js'
import { composeDecalage } from './export-cadrage.js'
// l'épaisseur des traits larges : elle vit HORS de la matrice de projection,
// donc ni le cadrage ni le pavage ne la corrigent — voir export-traits.js
import { materiauxDeLigne, reglerTraits } from './export-traits.js'
import { makeDraggable, reclampDraggables } from './drag.js'
import { ScanController } from './scan.js'
import { fetchRegionMask, regionMaskFromParts, frameRegion, rasterizeMask } from './region-mask.js'
import { peakMask, findPeak } from './peak-mask.js'
import { fetchCoastMask, COAST_ZOOM_MIN, COAST_ZOOM_MAX, patchLatLonBBox } from './coast-mask.js'
import { buildRegionSkirt, traceSkirt, skirtFloor, regionBaseLevel } from './region-skirt.js'
import { makeSocleEnvMap } from './socle-env.js'
import { GLASS_BY_ID, PBR_BY_ID } from './material-presets.js'
import { TEMPLATE_KEYS, ORIGINE_MOI, captureLook, captureView, serializeTemplate, parseTemplate, stripFromLook, loadUserTemplates, saveUserTemplates } from './templates-user.js'
import { loadUserPalettes, saveUserPalettes, paletteFromParams } from './user-palettes.js'
import { captureShareState, parseShareState, encodeShareState, decodeShareState, trackToGpx, parseRacePayload, RACE_ENDPOINT, rememberRaceSecret, recallRaceSecret, updateRace } from './share-link.js'
import {
  identifiantArticle, identifiantPanier, afficheSerialisable,
  retourAReprendre, urlSansRetour, poserPanier, lirePanier, viderPanier,
  armerReprise, livraisonEnSuspens, fichierJetable,
  demanderCaisse, verifierPaiement, messageRetour,
} from './paiement.js'
import { Boats } from './boats.js'
import { DroneCam } from './drone-cam.js'
import { animationsActives, reglageInitial } from './animations.js'
import { makeGradientTexture, deriveBgModel, normalizeBgStops, normalizeBgPoints, bgLuminance, autoDarkTarget, derivePlinthColor, deriveMetalTints, deriveAoColor, deriveHazeColor, BG_MODES, ENVIRONMENTS, ENV_BY_ID } from './background.js'
import { CameraAutomation, CAMERA_MOVES } from './camera-automation.js'
import { CameraShotPlayer, TOP_DOWN_DIR } from './camera-shots.js'
// CAMÉRA PILOTE (bouton avion, en bas à droite). À ne confondre ni avec
// cameraAuto (oscillations du panneau Caméra) ni avec `shots` (plans de cinéma
// composés) : celle-ci VOLE. Elle cherche un couloir de vallée, prouve sa sortie
// avant de s'y engager, et le suit au ras du sol en s'inclinant dans les
// virages. Tout le calcul est dans src/pilote.js, qui est pur ; src/pilote-cam.js
// n'est que la prise three.js.
import { PiloteCam } from './pilote-cam.js'
import { History } from './history.js'
import { isTap } from './gestes.js'
import { bindShortcuts } from './shortcuts.js'
import { refreshAll } from './ui/kit.js'
import { showNotice, showLivraison } from './ui/toast.js'
import { showFollowPad, hideFollowPad } from './ui/follow-pad.js'
import { buildTopBar, buildBottomBar, buildIsoButton, buildCineButton, buildCredits, buildMapCorner, buildQuickCore, buildShibuChrome, initUiLevel, buildAdvToggle, focusSearch, isUiAdvanced } from './ui/bars.js'
import { routeEntryFor, incomingWaypoints, resolveWaypointKm } from './route-entry.js'
import { buildMiniRoute } from './ui/mini-route.js'
import { buildSettingsSearch } from './ui/settings-search.js'
import { perfSection } from './ui/camera-panel.js'
import { buildElemBar } from './ui/elembar.js'
import { initRails } from './ui/shell.js'
import { TEMPLATES } from './templates.js'
import { buildShortcutsOverlay } from './ui/shortcuts-overlay.js'
import { buildChangelogOverlay } from './ui/changelog-overlay.js'
import { APP_STAGE } from './changelog.js'
import { BlockGrid, GRID_R } from './block-grid.js'
// la signature d'un carre du damier : ce qui decide si la mer doit se rebatir
import { cleDuCarre } from './damier-carre.js'
import { buildTemplatesPanel } from './ui/templates-panel.js'
// L'interface du compte, et — depuis le 2026-08-08 — la vraie session derrière.
// `compteInerte` (le socle sans session, qui répondait « personne n'est
// connecté ») reste exporté par ui/compte.js : c'est le défaut de ses panneaux
// et le contrat de référence, mais il n'est plus ce que l'application branche.
// `creerCompteApp` compose src/compte.js et rend exactement ce contrat — voir
// l'en-tête de src/compte-app.js.
import { porteExport, buildMesCartesPanel } from './ui/compte.js'
import { creerCompteApp } from './compte-app.js'
import { buildFondsPanel, contributeTerrainSections, buildPaletteCreation } from './ui/create-panel.js'
import { buildStore } from './ui/store.js'
import { buildStudio } from './ui/studio.js'
import { buildAtelier } from './ui/atelier.js'
import { buildHub } from './ui/hub.js'
// Le template de la vue de départ, importé donc EMBARQUÉ dans le bundle : le
// look doit être posé avant le premier rendu, sans requête ni clignotement.
// Le même fichier reste servi en statique pour la bibliothèque (atelier.js).
import SHIBU_START from '../public/templates/defaults/shibustart.json'
import { buildCameraPanel } from './ui/camera-panel.js'
import { buildRoutePanel } from './ui/route-panel.js'
import { buildExplorePanel } from './ui/explore-panel.js'
import { buildShadersPanel } from './ui/shaders-panel.js'
import { buildMapPanel } from './ui/map-panel.js'
import { buildCouchesPanel } from './ui/couches-panel.js'
import { NuitLayer } from './map/nuit-layer.js'
import { intensiteNuit, facteurEchelleNuit, largeurDalleKm } from './nuit.js'
import { OccupationSolLayer } from './map/occupation-sol-layer.js'
import { normaliseIndexSol, zoneSolPour, SOL_LICENCE, SOL_URL_SOURCE } from './occupation-sol.js'
import { CanopeeLayer } from './map/canopee-layer.js'
import { normaliseIndexCanopee, zoneCanopeePour, CANOPEE_LICENCE, CANOPEE_URL_SOURCE } from './canopee.js'
// Les sous-options des couches : les conversions tirette → uniforme, et la
// règle d'allumage automatique de la couche nocturne. Module pur, testé.
import {
  SOL_FORCE_DEFAUT, SOL_FORCE_MAX,
  CANOPEE_FORCE_DEFAUT, CANOPEE_FORCE_MAX,
  NUIT_ASSOMBRISSEMENT_DEFAUT, NUIT_FORCE_DEFAUT, NUIT_FORCE_MAX,
  opaciteSol, opaciteCanopee, fondNuit, gainNuit,
  allumageAutoNuit, MOTIF_LECTURE,
} from './reglages-couches.js'
import { evaluerCouche } from './gardien.js'
import { buildEffectsPanel, BASE_GRADE } from './ui/effects-panel.js'
import { buildHourPill } from './ui/hour-pill.js'
import { buildZoomStepper } from './ui/zoom-stepper.js'
import { initTips } from './ui/tips.js'
import { initAides, evalue as evalueAide, aideSection } from './ui/aides.js'
import { boutonsSouris, versTroisJs } from './boutons-camera.js'
import { initLoadingHints } from './ui/loading-hints.js'
import { initIndicateurRetard } from './ui/indicateur-retard.js'
import { createAdaptiveQuality } from './perf.js'
import { detailForZoom } from './zoom-detail.js'
import { applyRenderSize, screenPixelRatio } from './viewport.js'
import { sonderMachine } from './palier-machine.js'
import { lanceCuissonVolume } from './cloud-volume.js'
import './ui/v28.css'
// the export stack (modal + Recorder + mediabunny encoder) is heavy and only
// needed on demand — it is dynamic-import()ed on the first Export click, so
// it lives in its own async chunk and never delays first paint

// ⚠️ LA TOUTE PREMIÈRE INSTRUCTION DU MODULE, ET C'EST VOLONTAIRE. Le volume de
// nuages coûtait 455 ms MESURÉES sur le fil principal, vers 1 000–1 750 ms du
// chargement — au moment précis où les tuiles d'altitude arrivent. Le Worker
// part donc ici, à l'évaluation du module, soit ~1 200 ms avant que
// `clouds.build()` ne réclame le volume : il a tout le temps de finir sur un
// autre cœur. S'il n'a pas fini, `bakeCloudVolume()` cuit comme avant — ce
// chemin ne peut pas être plus lent que l'ancien. Voir cloud-volume.js.
lanceCuissonVolume()

// ------------------------------------------------------------------ params

// LE PALIER DE LA MACHINE, DÉJÀ RENDU. boot.js a sondé la carte graphique, ses
// limites, l'écran et sa densité avant même de télécharger ce fichier ; ici on
// ne fait que RELIRE le verdict mémorisé (aucun second contexte WebGL n'est
// créé). Voir src/palier-machine.js pour le tableau croisé et ses raisons.
//
// ⚠️ CE QUI SUIT NE POSE QUE DES VALEURS DE DÉPART. Dès que le visiteur touche
// « Échelle de rendu », « Ombres » ou « Résolution des ombres » dans les
// Paramètres, les drapeaux `dirty` de perf.js relâchent définitivement le
// levier concerné : un réglage manuel gagne TOUJOURS contre la détection.
// Rien de tout ça n'est persisté ni ne voyage dans un gabarit — ce sont des
// valeurs propres à la machine (voir TEMPLATE_KEYS dans templates-user.js).
const MACHINE = sonderMachine()

const params = {
  // terrain source — boots directly over Annecy and its surroundings (the lake,
  // the Bauges and the Aravis in frame)
  source: 'real',
  demLocation: 'Custom',
  demLat: 45.9,
  demLon: 6.13,
  demZoom: 10,
  demExaggeration: 2.8, // vertical relief au chargement (Adrien) — voir BASE_EXAG

  // terrain generation
  seed: 1,
  scale: 0.045,
  octaves: 2,
  lacunarity: 1.6,
  gain: 0.31,
  amplitude: 1,
  warp: 1.3,
  detail: 0.02,
  detailScale: 0.8,
  // MAILLAGE DU BLOC CENTRAL. 768 depuis le 2026-07-27 (décision d'Adrien,
  // prise en connaissance du coût) : sur le Mont-Blanc, le pas 1024 → 768 écarte
  // la silhouette de 0,02 px CSS en moyenne et 1,67 px au pire — soit exactement
  // ce que 1024 perd DÉJÀ en n'étant pas 2048 (1,64 px). Rend 30 Mo de géométrie
  // et ~200 ms de gel par reconstruction.
  // ⚠️ EN DESCENDRE ENCORE ? Alors il faut faire descendre `detailScale` avec.
  // Mesuré (scratchpad/bloc/nyquist.mjs, grille de vérité 3072) : le maillage
  // perd 11,9 % du grain FBM à 1024, 18,3 % à 768, 30 % à 512 et 40 % à 384, où
  // la corrélation entre sommets voisins tombe à 0,53 — le grain n'est plus une
  // texture, c'est du poivre et sel, et il scintillera au moindre mouvement de
  // caméra. Le couplage n'est PAS automatique : il est verrouillé par un test
  // (test/detail-noise.test.js, grainSamplesPerCycle) qui casse si l'un des deux
  // bouge sans l'autre, et qui dit quoi corriger.
  resolution: 768,

  // surface material
  color: '#dddcd5',
  roughness: 0.88,
  roughnessVariation: 0.14,
  roughnessScale: 9.5,
  bumpScale: 0.9,
  envMapIntensity: 0.2,
  liquidMetal: false, // "Fancy" look — chrome the relief (Scan panel)
  lmMetalness: 1,
  lmRoughness: 0.16,
  lmReflection: 2.0,
  lmSpeed: 0.4, // liquid-metal molten-flow speed (0 = still mirror)
  surfaceFx: 0, // "Fancy" look — animated surface shader id, 0 = off (Scan panel)
  fx: defaultFxParams(), // per-effect saved params, keyed by shader id

  // camera & depth of field
  fov: 30,
  // ══════ LA PROFONDEUR DE CHAMP — règle D20 (Tâche R34) ═══════════════════
  // ⚠️ `focusDistance` est en MÈTRES RÉELS (caméra → point de focus), plus en
  // unités de bloc : la conversion vers l'espace de la caméra qui lit la
  // profondeur vit dans `poserMiseAuPoint`, et nulle part ailleurs.
  // `focusRatio` = k : la plage de netteté vaut k × focusDistance, ce qui rend
  // le flou APPARENT identique à tout zoom — 5 km comme 5 000 km (D20, rép. 3).
  // (`focusRange`, en unités de bloc, n'existe plus : un gabarit qui le porte
  // encore est ignoré sur ce point et garde le k par défaut.)
  autoFocus: true, // mise au point sous le pointeur, à TOUS les zooms (D20, rép. 1 et 2)
  focusDistance: 5000,
  focusRatio: 0.3,
  // Depth of field is OFF by default and gated by an explicit flag, mirroring
  // fogEnabled. bokehScale alone can't serve as the gate: it doubles as the
  // strength slider, so "off" would mean losing the user's chosen strength.
  bokehEnabled: false,
  bokehScale: 3.7,

  // map overlay
  // Ombrage AUTO (relief-grade.js) : les 4 réglages de la section « Ombrage »
  // sont recalculés à chaque chargement de terrain d'après le relief réel. Un
  // curseur repris à la main se fige (drapeaux shadeDirty) ; le toggle rend
  // la main à l'auto. Les valeurs ci-dessous ne servent plus que de repli
  // (terrain procédural, DEM illisible).
  shadeAuto: true,
  mapTint: 1.0,
  heightContrast: 5.1,
  heightPivot: 0.53,
  // 8-stop hypsometric land ramp (low → high). The single source of truth for
  // land color; templates and generated palettes fill all eight.
  rampStops: [
    // Adrien's default relief ramp : snow white → clay → grey rock → tan → ochre
    // → chocolate → ink → peak white (from his exported palette)
    { c: '#fafafa', p: 0.0 },
    { c: '#dbd3b8', p: 0.14 },
    { c: '#908e89', p: 0.28 },
    { c: '#d7c3a8', p: 0.42 },
    { c: '#dab38b', p: 0.56 },
    { c: '#6a4c3e', p: 0.7 },
    { c: '#271402', p: 0.84 },
    { c: '#fafaff', p: 1.0 },
  ],
  slopeTint: 0.5,
  // ------------------------------------------------ COLORISATION DU RELIEF
  // « Classique » = le rendu historique, au pixel près : rampe 1D indexée par
  // l'altitude. « Naturel » (src/terrain-analysis.js) ajoute le rendu peigné
  // des crêtes, un second axe d'humidité sur la rampe et la perspective
  // aérienne. VALEURS D'USINE VOLONTAIREMENT NEUTRES : mode classique et
  // amplitudes à 0, de sorte qu'un template ou une palette d'avant ce chantier
  // rend exactement ce qu'il rendait. C'est la tuile « Naturel » du picker qui
  // pose le préréglage (NATURAL_COLOR_PRESET dans palette.js).
  colorMode: 'classic',
  rampOklab: false, // interpolation perceptuelle des arrêts de rampe
  rampDry: 0, // amplitude de la ligne SÈCHE du LUT 2D
  rampWet: 0, // amplitude de la ligne HUMIDE
  texShade: 0, // intensité du peigné (texture shading)
  wetK: 0, // poids de l'humidité topographique
  expoK: 0, // poids de l'exposition (adret / ubac)
  treeLine: 0.62, // altitude normalisée où végétation et humidité s'éteignent
  hazeAmt: 0, // perspective aérienne — force globale
  hazeAlt: 0.5, // altitude où le voile d'altitude s'éteint
  hazeDist: 0.5, // part de la composante DISTANCE dans le voile
  contourInterval: 0.11,
  contourOpacity: 0.5, // finer, more discreet engraving by default
  contourWeight: 0.7,
  contourColor: '#000000',
  gridStep: 5,
  gridOpacity: 0.4,
  labels: true,

  // legacy FUI chrome vars — hud/hudOpacity drove the now-removed hud2d.js
  // screen-space overlay (unreachable: no UI ever set params.hud); uiBlur/
  // uiBgOpacity/hudAccent/hudInk stay — they drive live CSS custom properties
  // (--hud-blur/--hud-bg-alpha/--hud-accent/--hud-ink) used across the chrome.
  uiBlur: 9,
  uiBgOpacity: 0.4,
  // TEINTE DE L'INTERFACE (src/ui-theme.js) : les jetons de v28.css dérivés de
  // la PALETTE de la carte. Vrai par défaut — c'est la fonctionnalité elle-même,
  // et un interrupteur à faux par défaut ne se serait jamais vu ; la garantie de
  // contraste est vérifiée sur les 136 palettes du catalogue dans les deux
  // thèmes, donc l'allumer n'expose à aucune palette illisible. À faux,
  // syncUiTheme EFFACE ses valeurs en ligne et v28.css reprend la main, à
  // l'identique de ce que l'interface rendait avant ce chantier.
  uiTint: true,
  hudAccent: '#ff4d00',
  hudInk: '#17191b',
  sweepSpeed: 2.5,
  scanColor: '#ccd6ff',
  scanDuration: 4.6,
  scanWidth: 0.8,
  scanBlur: 0.86,
  scanDispHeight: 1.16,
  scanDispFalloff: 1.2,

  // look — exposition/contraste/saturation viennent de BASE_GRADE : ce trio
  // est FIXE (Adrien), il ne bouge ni au lancement ni au shuffle
  exposure: BASE_GRADE.exposure,
  // render upgrades (2026-07-20 plan): the adaptive quality governor sheds
  // them on machines that can't hold 60 fps, so a forked "high mode" is
  // deliberately NOT a thing (see the plan doc).
  //
  // L'OCCLUSION AMBIANTE VIENT DU PALIER, plus d'une constante. La ligne disait
  // `false` en dur alors que le tableau des paliers annonçait `ssao: true` aux
  // paliers 0 et 1 : le champ était MORT, personne ne le lisait, et le vrai
  // interrupteur de départ était ailleurs (le look d'ouverture shibustart.json,
  // qui l'allumait). Deux sources contradictoires pour un même réglage, dont
  // aucune n'était celle qu'on croyait lire. Une seule désormais — et elle vaut
  // false sur les quatre paliers depuis le 28/07 (demande d'Adrien).
  ssaoEnabled: MACHINE.ssao,
  ssaoIntensity: 6, // nudged up: half-res AO reads ~16% softer than full-res (measured)
  // DIFFUSION SOUS-SURFACIQUE du socle — éteinte par défaut : c'est un parti pris
  // de matière (albâtre, marbre, onyx), pas un réglage de qualité, et le socle
  // par défaut est une pierre mate qui ne diffuse pas. Voir Plinth._brancheSSS.
  sssEnabled: false,
  sssStrength: 0.6,
  sssColor: '#ff8a4c', // la teinte de ce qui ressort : le sang du marbre est chaud
  sssPower: 4, // netteté du halo — bas = diffusion large, haut = liseré serré
  // PLUS de bloomEnabled / bloomIntensity / bloomThreshold : la passe de bloom
  // a été retirée le 2026-08-02 (Adrien : « inutile, on retire »). Les trois
  // clés traînent dans les gabarits déjà enregistrés ; applyUserTemplate filtre
  // sur TEMPLATE_KEYS, elles sont ignorées.
  contrast: BASE_GRADE.contrast,
  saturation: BASE_GRADE.saturation,
  vignette: 0.6,
  grain: 0, // off by default — opt in via Look → grain
  // PLUS de fogNear / fogFar / fogEnabled : la brume a été retirée le
  // 2026-08-02 (Adrien : « ça ne fonctionne jamais, on retire »), contrôles ET
  // rendu. Les trois clés traînent dans les gabarits déjà enregistrés ;
  // applyUserTemplate filtre sur TEMPLATE_KEYS, elles sont ignorées.
  //
  // ⚠️ `fogColor` RESTE, et ce n'est PAS un oubli : malgré son nom c'est la
  // teinte de la FEUILLE DE FOND (scene.background, voile de transition du mode
  // sombre, applyLook). La retirer effacerait le fond de scène. Voir la note en
  // tête de la section Brume retirée dans src/ui/effects-panel.js.
  fogColor: '#ffffff',
  // background: solid (fogColor) or a gradient (linear/radial/mesh) of A/B/C.
  // The gradient's top colour is bgColorA — SEPARATE from the fog colour, so a
  // gradient never washes out the fog.
  bgMode: 'solid',
  bgEnv: '', // '' = none; otherwise an HDRI sky id (overrides the solid/gradient backdrop)
  bgColorA: '#e9eef4',
  bgColorB: '#dfe6ef',
  bgColorC: '#c7d2df',
  bgAngle: 135,
  // Fonds v2 : stops arbitraires [{p 0..100, c}] (linéaire/radial) et points
  // libres [{x,y,r,c} 0..1] (dégradé de points). null = dérivés de A/B/C.
  bgStops: null,
  bgPoints: null,
  // le fond (et la couleur du socle) SUIVENT la palette de la carte ; une
  // édition manuelle du fond coupe le suivi
  bgAuto: true,
  // camera automations (looping cinematic moves)
  camMove: 'orbit',
  camSpeed: 1,
  surveyLines: true,

  // motion — flyDuration/flyEasing drive the general camera-to-camera tween
  // (cameraPreset, dolly, click-to-focus…), not just the old Motion panel;
  // paused gates ambient animation in tick(). No dedicated UI exposes these
  // three any more (Camera → Motion was cut — dead controls, see commit
  // message), but all three stay live and load-bearing.
  ringSpeed: 1.0,
  flyDuration: 1.8,
  flyEasing: 'smooth',
  paused: false,

  // L'INTERRUPTEUR D'ANIMATIONS (panneau Effets) — DIFFÉRENT de `paused` ci-dessus :
  // `paused` est un reste mort (plus aucune UI ne le touche), celui-ci est câblé et
  // vivant. `prefers-reduced-motion` ne fixe que ce réglage de DÉPART — un choix fait
  // ICI prime pour toute la session (voir animations.js, animationsActives()).
  animations: reglageInitial(window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false),

  // performance
  // LA DENSITÉ DE L'ÉCRAN, LUE — et non plus un 2 en dur.
  //
  // Ce 2 était le déclencheur du « zoom à fond » du 28/07/2026 : sur une
  // machine dont MAX_TEXTURE_SIZE vaut 2048 ou 4096 (circuit graphique intégré
  // ancien), un écran large ×2 franchit la limite, et Chrome rabote le tampon
  // de dessin UNE DIMENSION À LA FOIS, sans un mot — l'image se déforme en
  // silence. Le plafond proportionnel vit maintenant dans applyRenderSize ;
  // ici on répare l'autre moitié du problème, la valeur elle-même.
  //
  // Lire la vraie densité corrige les DEUX sens : à 100 % on payait quatre fois
  // trop de pixels, et à 250 % on rendait PLUS FLOU que l'écran ne demande tout
  // en payant plein pot. Le plafond de 2 reste (au-delà, gain nul, coût
  // quadratique) — voir MAX_PIXEL_RATIO dans viewport.js.
  // Le gouverneur de performance peut encore faire descendre cette valeur sous
  // charge soutenue ; c'est la tirette « Échelle de rendu » qui la remonte.
  //
  // ⚠️ CE N'EST PLUS LA DENSITÉ DE L'ÉCRAN, C'EST CELLE QUE LA MACHINE TIENT.
  // Lire `devicePixelRatio` réparait le sens de la valeur ; ça ne réparait pas
  // son AMPLEUR. Sur l'iMac 27" 2015 (Retina 5K, Iris Pro), la densité honnête
  // est 2 — et 2 × 2560×1440 fait 14,7 millions de pixels par image sur un
  // circuit intégré de 2015. C'était le premier rendu, avant même que le
  // gouverneur n'ait vu une seule image. palier-machine.js borne donc cette
  // densité par un BUDGET DE PIXELS propre au palier : 0,93 sur cet iMac, soit
  // 4,6 fois moins de pixels — et exactement `screenPixelRatio(dpr)`, sans un
  // pixel de moins, sur toute machine que le budget ne serre pas (une carte
  // dédiée en 1080p, un MacBook Retina récent : rien ne change pour elles).
  pixelRatio: Math.min(screenPixelRatio(window.devicePixelRatio), MACHINE.densite),
  shadowMode: 'dynamic', // le MODE reste au gouverneur (perf.js tierShadows) — voir plus bas
  // La RÉSOLUTION de la carte d'ombres, elle, n'appartient à personne d'autre :
  // perf.js ne la gère pas, et c'est une texture 2048² (16 Mo en VSM) allouée
  // au tout premier rendu. Sur un palier bas elle tombe à 1024² une fois pour
  // toutes — un changement à chaud rebâtirait la carte d'ombres sous les yeux
  // du visiteur, et « la carte reste calme ».
  shadowRes: MACHINE.ombresRes,
  // Plafond du côté de l'analyse de relief (terrain.js → analyzeDem). 0 =
  // pleine taille du MNT. C'est ~390 ms de fil principal GELÉ en 1536², à
  // chaque reconstruction : sur une machine lente c'est une seconde de page
  // figée que le visiteur lit comme « ça a planté ».
  analysisMax: MACHINE.analyseMax,
  // Plafond du nombre de cellules VOISINES du damier (24 / 12 / 8 / 4 selon le
  // palier). Lu par `BlockGrid.cellsForTrack` (block-grid.js:360), qui rétrécit
  // le CÔTÉ du carré tant qu'il en demande plus — jamais des cases isolées, ce
  // qui rouvrirait le trou que damier-carre.js existe pour boucher.
  //
  // ⚠️ CETTE LIGNE MANQUAIT, ET LE MÉCANISME ENTIER NE S'EXÉCUTAIT PAS. La table
  // portait `damierMax`, `carreSousPlafond` savait le faire respecter,
  // `block-grid.js` le lisait — mais personne ne le posait ici : la lecture
  // rendait `undefined`, le plafond retombait sur `Infinity`, et une machine de
  // palier 3 chargeait exactement le même damier qu'une machine de palier 0.
  // Mesuré en Tâche 12 ; verrouillé par test/damier-palier.test.js, qui lit
  // cette ligne-ci parce qu'aucun test ne peut exécuter main.js.
  damierMax: MACHINE.damierMax,

  // globe (orbital view)
  globeExaggeration: 18,
  globeContourInterval: 500,
  globeContourOpacity: 0.55,
  globeGraticule: 0.16,

  // gpx
  gpxVisible: true,
  gpxAltitude: 2.2,
  gpxWidth: 3,
  gpxColor: '',
  // gradient defaults ON — "par défaut, sur la trace GPX, le gradient doit se
  // faire du vert foncé vers le rouge vif" only shows up if a loaded GPX
  // draws the ramp without the user having to flip a toggle first.
  // Default MODE is 'slope' (not 'elevation'): the reference video colours
  // its route by gradient (blue on the flat, red on the climb), not by
  // absolute altitude — colour what the athlete feels, not where they are.
  gpxGradient: false, // gradient is an OPTION — the default track is the accent orange (gpxColor '' falls back to hudAccent)
  gpxGradientMode: 'slope',
  gpxGlow: false,
  gpxMarkers: true, // single toggle for BOTH start + finish markers
  gpxArchColor: '', // task 25 §4 — '' = darkMode-driven default (see gpx.js _buildArches)
  gpxKm: true,
  gpxAltReadout: true,
  gpxSlopeReadout: false,
  gpxCartouches: true, // Race Studio : cartouches espace-écran (taille constante)
  gpxLabelAvoid: true, // anti-chevauchement des cartouches — débrayable (Adrien)
  // drone-follow during playback: ON by default (task 24 — "par défaut on
  // active le drone follow"), the playback IS the product so the cinematic
  // chase should be what an organiser sees without having to find the
  // toggle. 1x matches the default reveal pace (totalKm*1.5s, see gpx.js
  // tick()); 0.5x–3x covers "slow enough to read the terrain" to "quick preview"
  gpxFollow: true,
  // ⚠️ LA CAUSE, PAS SEULEMENT L'ÉTAT (task 2, CONSTAT 1 de relecture).
  // gpxFollow=false à lui seul ne dit rien sur le POURQUOI — et c'était le
  // trou : le FINALE (fin de parcours, tick()) coupe gpxFollow tout comme le
  // bouton « ✕ Quitter le suivi » (route-panel.js) ou la case à cocher
  // « Suivi » le font, mais SEUL le FINALE doit se voir réarmé tout seul à la
  // relance — une coupure explicite de l'utilisateur doit tenir, même après
  // un parcours qui va au bout tout seul (gpx.js tick() n'y remet PAS headT à
  // 0, contrairement à stop() : une relance après verrait quand même
  // `headT >= 1`, donc « repart du début », sans cette distinction). VRAI
  // uniquement entre le moment où le FINALE coupe et la prochaine fois que
  // gpxFollow change de valeur PAR N'IMPORTE QUELLE AUTRE VOIE (voir chaque
  // site qui écrit params.gpxFollow : ils remettent tous ce drapeau à false).
  gpxFollowCoupeParFinale: false,
  gpxFollowSpeed: 1,

  // ocean (real-world bathymetry read) — Adrien's Caribbean-lagoon ramp
  oceanShallow: '#c8f2e4',
  oceanMid: '#62cfc1',
  oceanDeep: '#136e7d',

  // look mode
  darkMode: false,
  gridColor: '#242220',

  // 3D slab the relief sits on (its table is a shadow-only ShadowMaterial)
  plinth: true,
  plinthDepth: 7,
  plinthColor: '#d8d4cc',
  // socle material (Block panel): 'solid' → a PBR preset, 'glass' → a physical
  // glass preset with frost (diffusion) + coloured ground projection
  plinthFinish: 'solid',
  plinthPbr: 'stone',
  plinthGlass: 'frosted', // grainy/diffuse by default
  plinthGlassDiffusion: 0.7,
  plinthGlassProjection: 0.5,
  plinthGlassBump: 0.6, // frost micro-facet strength (glass bump slider)
  plinthGlassRefract: 0.25, // déformation du verre (offset de réfraction, 0..1)
  plinthBump: 1.5, // textured-PBR relief strength (carbon/wood bump slider)
  // terrain MATERIAL mode (Shaders panel, next to Liquid metal): turns the whole
  // relief into a material — '' (topographic) or any id in the material catalog
  // (glass, grass, rock…, carbon). An unknown id falls back to topographic.
  terrainSurfaceMat: '',
  terrainSurfaceBump: 1.3, // bump for the opaque terrain materials (wood/carbon)
  terrainMatScale: 1, // tiling scale for the opaque relief materials (repetition)
  terrainMatRoughness: 0.75, // seeded from the preset on select; live-tunable
  terrainMatNoise: 0, // procedural noise: patchy 3D lift + transparent holes
  terrainMatAboveZero: false, // relief material paints only above sea level (uSeaY)
  terrainGlassFrost: 0.5, // glass roughness (frost) — blurry by default
  terrainGlassThickness: 8,
  terrainGlassTint: '#bfe4ff',
  terrainGlassClarity: 12, // attenuation distance — lower = deeper tint
  terrainGlassReflection: 1.4,
  slabCorner: 0.04, // fillet radius on the slab's vertical corners, as a fraction
  // of the block width (the terrain clips to the same rounded rectangle)
  slabCornerSmoothing: 0.6, // 0 = plain circular arc, →1 = squircle (iOS-style
  // continuous corner); drives a superellipse exponent shared by ring + clip
  groundInfo: true, // cartouche (compass rose, name, coords, blurb) around the slab
  regionMode: false, // cut the map to the admin boundary under the view (no square base)

  // clouds — thick and low, clinging to the summits
  // volumetric cloud deck — user-tuned base settings, active on every template
  cloudsEnabled: false,
  cloudOpacity: 2.25, // densité — réglages par défaut fournis par Adrien (captures)
  cloudAltitude: 1, // PLAFOND de la colonne de nuages, en unités monde
  cloudDrift: 1.6,
  cloudScale: 5, // finesse du grain interne
  cloudCoverage: 1.12, // trouées : 0.8 = masses pleines, 2.6 = dentelle
  cloudBillow: 3, // bourgeonnement en chou-fleur, à fond
  cloudBrightness: 2.8, // luminosité du soleil dans la masse
  cloudAltSpread: 1, // part de la colonne peuplée : 1 = jusqu'au sol
  cloudDriftVar: 1, // variation de vitesse d'un nuage à l'autre
  cloudContrast: 2.5, // contraste de densité
  cloudSSS: 2, // translucidité : les voiles s'allument à contre-jour
  cloudTexMix: 0.4, // 0 = bourgeons nets, 1 = coton
  // VENT — pousse les nuages ET les fait buter contre les versants au vent
  // (orographie, clouds-sim.js). Réglable dans Éléments.
  windDir: 45, // degrés, 0 = vers l'est
  windSpeed: 0.6, // unités monde/s
  // terrain glass: 0 = opaque rock. Keep 0 while the water glass is on — three
  // excludes transmissive objects from the refraction buffer, so a transmissive
  // terrain becomes invisible through the water.
  transmission: 0,
  // ANIMATED SEA (the glass sea/lakes are gone — this is the only water):
  // translucent sunlit shallows with bold caustics, darkening depths, and the
  // shared ocean-waves random spectrum (ocean-lab) — GPU-heavy, so opt-in
  lakeColor: '#8fc6e8', // base water tint (shallow/deep derive from it)
  waterReal: false,
  waterTransparency: 0.4, // 0 = milky veil, 1 = crystal — above and below the surface
  waterSunFx: 1, // sun on the water: glint above + caustic rays below (0..2)
  // La mer se débraye entièrement (Adrien, Studio → Météo). ALLUMÉE par défaut :
  // c'est l'état de toutes les cartes d'avant l'interrupteur, et une clé
  // absente doit continuer de vouloir dire « mer ». Voir setSeaEnabled().
  seaEnabled: true,
  seaWaveH: 0.8, // wave height, in spectrum metres — visible resting sea (cool > realistic)
  seaChop: 0.7, // crest sharpening 0..1 — breaking whitecaps appear past ~0.6
  seaSpeed: 1, // time multiplier over the deep-water dispersion
  seaSeed: 0, // 0 = random sea each rebuild; a saved seed replays an exact sea
  seaBed: 'map', // fond sous la mer (vignettes) : map | sand | lagoon | abyss | seagrass | ink
  seaEdge: true, // jupe de verre au bord du socle (comble le vide surface/fond)
  seaEdgeFrost: 0.5, // 0 = verre clair, 1 = verre depoli
  seaRefract: 0.6, // intensite de la refraction (deformation du fond vu a travers)

  // SP1 map overlay layers (water/places), draped on the relief
  // PLUS de roadsEnabled/roadsOpacity/roadsDetail/roadColor. Le calque Routes a
  // quitté le site (Adrien : « très lourd, très mauvais ») — 12,6 Mo de
  // Natural Earth versionnés pour un réseau qui, de toute façon, n'existait en
  // version tuilée que sur les Alpes. Ces quatre clés traînent encore dans de
  // vieux gabarits enregistrés : applyUserTemplate filtre sur TEMPLATE_KEYS,
  // elles sont donc simplement ignorées, aucune migration à écrire.
  waterEnabled: true, // lakes on by default — the world lake layer is cheap (fetch-on-view)
  waterOpacity: 0.9,
  // PLUS de waterFill. Adrien, 2026-08-02 : « pas besoin, ça doit toujours être
  // rempli » — le remplissage est inconditionnel dans water-layer.js. La clé
  // traîne dans les gabarits déjà enregistrés ; applyUserTemplate filtre sur
  // TEMPLATE_KEYS, elle est donc ignorée, aucune migration à écrire.
  // PLUS de coastLine. Le liseré Natural Earth 1:10m a été RETIRÉ du site
  // (Adrien) : gardé « en option » depuis des mois, il n'a jamais tracé une
  // vraie côte — ses cordes droites coupaient les caps que le relief et la
  // bathymétrie dessinaient déjà juste en dessous. Une option qui ment n'est
  // pas une option.
  // ⚠️ Le MASQUE terre-mer (coast-mask.js, uCoastMask, coastImage) n'a AUCUN
  // rapport et reste en place : c'est lui qui tient les polders sous le niveau
  // zéro et qui sert à la découpe de zone. Ne pas confondre non plus avec
  // aerialCoastFade, qui appartient à la photo aérienne.
  // Aerial photo skin — OFF. First narrow test: IGN orthophotos, Annecy only.
  // The product's identity is the quiet editorial relief; photography is a tool
  // the organiser reaches for, never the default look. See map/aerial-layer.js.
  aerialEnabled: false,
  aerialOpacity: 1, // à l'activation, la photo couvre pleinement (retour Adrien)
  aerialCoastFade: 0.1, // v49 : la photo s'estompe sous l'eau au-delà du rivage (0 = off)
  // ─── LES SOUS-OPTIONS DES COUCHES (onglet « Couches », dépliant sous la ligne)
  // Les tirettes des couches. ⚠️ Elles vivent dans `params` et pas
  // dans le panneau : `refreshAll()` et les gabarits lisent params, et une valeur
  // rangée dans une fermeture d'interface serait perdue au premier rebuild du
  // panneau. Les défauts sont les constantes de src/reglages-couches.js, parce
  // que le kit fait du double-clic un retour à la valeur de CONSTRUCTION : deux
  // littéraux recopiés finiraient par diverger et le double-clic mentirait.
  solForce: SOL_FORCE_DEFAUT,
  canopeeForce: CANOPEE_FORCE_DEFAUT,
  nuitAssombrissement: NUIT_ASSOMBRISSEMENT_DEFAUT,
  nuitForce: NUIT_FORCE_DEFAUT,
  placesEnabled: true,
  // PLUS de placesDensity / placesSize / placesHalo. Adrien, 2026-08-02 : pour
  // les deux tirettes « ça reste comme c'est au lancement par défaut » (elles
  // valaient 1 et 1, c'est maintenant le comportement de places-layer.js) ; pour
  // le halo, « on enlève, par défaut pas de halo » — il est retiré du rendu, pas
  // mis à false. Même sort que waterFill pour les gabarits déjà enregistrés :
  // les clés sont filtrées par applyUserTemplate, aucune migration à écrire.
  // Repères de sommet (panneau Carte → Repères) : ÉTEINTS par défaut
  // (Adrien). Ils étaient allumés depuis qu'on a réparé le fait que la clé
  // n'existait pas dans params ; la carte s'ouvrait donc sur cinq étiquettes
  // plantées dans le relief avant même qu'on ait regardé le relief. La
  // toponymie est une COUCHE, comme la photo aérienne ou le trait de côte :
  // on la demande.
  // La clé reste dans TEMPLATE_KEYS (templates-user.js) — un template ou un
  // lien de partage qui les allume les rallume bien au chargement, via le
  // setEnabled(params.peaksEnabled) posé plus bas.
  // Effet de bord assumé : un vieux lien #s= fabriqué quand le défaut était
  // « allumé » n'embarquait pas la clé (le diff ne garde que les écarts au
  // défaut) — il rouvrira donc sans les sommets.
  peaksEnabled: false,

  // light
  sunIntensity: 7.6,
  sunAzimuth: 162,
  sunElevation: 16,
  hemiIntensity: 0.6,
  envLight: 0.16,
  shadowSoftness: 5,
  timeOfDay: 10, // 24 h sun-cycle slider (0..24) — drives sun az/el/intensity/colour
  dayCycleSpeed: 1, // auto-cycle speed 1..100 : 1 = a full 24 h in 1 min

  // Les GAINS : ce que l'utilisateur possède, appliqué APRÈS le cycle horaire
  // (daycycle.applyGains). 1 = neutre, donc le cycle nu. Les trois clés
  // au-dessus (sunIntensity/hemiIntensity/envLight) sont désormais DÉRIVÉES —
  // heure × gain — et plus jamais réglées à la main : c'est ce partage-là qui
  // faisait perdre tout réglage au déplacement suivant.
  sunGain: 1,
  hemiGain: 1,
  envGain: 1,
  // L'interrupteur du SOLEIL. Allumé par défaut — c'est la lumière principale.
  // Éteint, il ne quitte PAS la scène (voir applySunSwitch) : il tombe à 0 et
  // rend sa carte d'ombre 2048×2048, qui est son vrai poste coûteux.
  sunEnabled: true,

  // L'APPOINT : une seconde directionnelle, sans ombre, que l'heure ne pilote
  // pas. Sa direction est RELATIVE au soleil (elle le suit sans être écrasée).
  // Éteinte par défaut : aucune carte existante ne change d'aspect.
  // L'interrupteur ne CRÉE ni ne RETIRE la lampe — elle existe depuis le boot à
  // intensité 0 — il ne fait que monter son intensité. Le pourquoi (une mesure
  // à 1 923 ms) est au-dessus de `const fillLight`.
  fillEnabled: false,
  fillIntensity: 0,
  fillAzimuthOffset: 150, // degrés PAR RAPPORT au soleil — contre-jour doux
  fillElevation: 20,
  fillColor: '#ffcf9a', // chaud : c'est la chaleur méditerranéenne qu'on cherchait
}

// ══════════ L'EXAGÉRATION VERTICALE : UN SEUL ÉCRIVAIN, DOUZE LECTEURS ══════
// Tâche 6 bis du plan « globe continu ».
//
// ⚠️ **LE PIÈGE QUE CECI FERME A DÉJÀ MORDU DEUX FOIS SUR CE DÉPÔT** : un
// réglage écrit d'un côté et jamais transmis à l'autre. `demExaggeration` était
// lu à DOUZE endroits (`terrain.js` ×5, `ocean.js` ×2, `gpx.js`, `main.js` ×4)
// — douze occasions de diverger dès que la valeur bouge. Les douze passent
// désormais par `lireExageration(params)`, et `test/fenetre-branchee.test.js`
// **échoue si un seul relit `params.demExaggeration` en direct**.
//
// ⚠️ **ET `params.demExaggeration` DEVIENT UN ACCESSEUR SUR LE PARTAGE, PAS UN
// CHAMP.** Ce n'est pas de l'élégance : c'est la seule façon MÉCANIQUE de
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
// ══════════ UNE SEULE TERRE — Tâche I, LE BRANCHEMENT ══════════════════════
//
// ⚠️ **LU ICI ET NULLE PART AILLEURS.** Le drapeau décide de cinq choses qui
// doivent s'accorder au caractère près, et un second appel à `terreUniqueActive()`
// ailleurs dans ce fichier pourrait diverger (l'adresse ne change pas, mais le
// patron, lui, se recopie) :
//   1. le bloc plat ne se rallume plus (`poserVisibiliteSocle`, `socleAffiche`) ;
//   2. l'état de départ de `veilleSocle` dit « pas de bloc », pour que la
//      première image sous le seuil APPLIQUE l'extinction ;
//   3. `majSeuilSocle` nourrit `veilleCrop` au lieu de `veilleSocle`, sur la
//      MÊME altitude et à la MÊME image ;
//   4. **le globe devient le quatorzième lecteur de l'exagération** ;
//   5. ⚡ **et cette exagération est une CONSTANTE — D10, Tâche M.** C'est elle,
//      et rien d'autre, qui supprime le rechargement de la planète entière.
//
// ⚠️ **IL EXIGE `?frontiere=1`, et `flags.js` le garde** : sans la passe de fond
// le globe n'est pas dessiné en mode surface, et creuser un crop dans une
// planète qu'on ne dessine pas ne montrerait rien.
//
// ⚠️ **IL EST DÉCLARÉ ICI, AVANT LE PARTAGE D'EXAGÉRATION ET AVANT LE GLOBE,
// PARCE QUE LES DEUX LE LISENT.**
const terreUniqueBranchee = terreUniqueActive()

// ══════════ LA PLANÈTE N'EST PLUS NUE — règle D15, Tâche R6 ════════════════
//
// > **Adrien, 2026-08-23** : « Non, la planète ne doit plus jamais être nue. »
//
// ⚠️ **LU ICI ET NULLE PART AILLEURS**, même discipline que la ligne
// au-dessus : un second appel ailleurs pourrait diverger. Le drapeau ne décide
// que d'une chose — l'ÉTAT DE REPOS de la tuile du globe — et `flags.js` le
// garde derrière le drapeau `terre unique`, parce que le pas du gradient de la
// normale fine a besoin de `uMppFacteur`, que seul `poserLoiMonde` pose.
//
// ⚠️ **ET CE COMMENTAIRE N'ÉCRIT PAS LE NOM DE L'AUTRE LECTEUR AVEC SES
// PARENTHÈSES**, délibérément : `test/crop-branche.test.js` (⑧ septies) COMPTE
// les occurrences de `terreUniqueActive` suivi de parenthèses dans ce fichier et
// en exige exactement deux — la lecture, et la phrase qui dit pourquoi il n'y en
// a qu'une. Une troisième, fût-elle dans un commentaire, le fait rougir.
const planeteEclaireeBranchee = planeteEclaireeActive()

// ⚠️ **`constante` EST TOUT LE GESTE DE D10, ET IL TIENT EN UN ARGUMENT.**
// `setExaggeration` (`globe.js`) rend au réseau TOUTES les tuiles prêtes ;
// `majExageration` ne l'appelle que si la valeur a BOUGÉ. Figer la valeur, c'est
// donc supprimer le rechargement — **12 s et 21 s mesurées, aller et retour, La
// Réunion z12** — sans porter le relief dans le nuanceur de sommets. Le portage
// reste utile un jour (l'exagération redeviendrait un réglage vivant) : il est
// **DIFFÉRÉ, pas abandonné.**
const exagPartage = creerExagerationPartagee({
  surcharges: surchargesStockees(),
  constante: terreUniqueBranchee ? EXAGERATION_UNIQUE : null,
})
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
  configurable: true,
})

// ------------------------------------------------------------------ share-link restore
// The reference every share link diffs against (see share-link.js) — captured
// BEFORE anything below mutates params, so it always matches the app's own
// hard-coded defaults, exactly like whatever the sender's boot computed.
const BASE_TEMPLATE_LOOK = Object.freeze(captureLook(params))

// A pasted share link carries #s=<payload> in the URL HASH — never the query
// string, since lat/lon is location data and a hash fragment is never sent
// over the network to any server (see share-link.js for the encoding). This
// has to be fully synchronous: it must land before anything below reads
// `params` for the first time, and nothing here can afford to await.
let pendingShareCam = null // applied once `camera`/`controls` exist, below
// La position DANS L'EMPRISE portée par le lien (share-link.js, champ `fen`).
// Posée une fois le relief chargé — avant, il n'y a pas d'emprise où se placer.
// Reste null pour tout lien d'avant ce champ : ceux-là rouvrent au centre du
// bloc, c'est-à-dire exactement la vue qu'ils ont toujours ouverte.
let pendingShareFen = null
if (location.hash.startsWith('#s=')) {
  try {
    const decoded = decodeShareState(location.hash.slice(3))
    const shared = decoded && parseShareState(decoded, BASE_TEMPLATE_LOOK)
    if (shared) {
      Object.assign(params, shared.look) // every key here is one of TEMPLATE_KEYS — see parseShareState
      params.demLat = shared.loc.lat
      params.demLon = shared.loc.lon
      params.demZoom = shared.loc.zoom
      params.demLocation = 'Custom'
      pendingShareCam = shared.cam
      pendingShareFen = shared.fen
    }
  } catch (err) {
    console.warn('share link ignored:', err) // a garbled/old-format fragment just boots the default view
  }
}

// ── LE RETOUR DE STRIPE ─────────────────────────────────────────────────────
//
// ⚠️ PARTIR PAYER EST UNE NAVIGATION, PAS UNE FENÊTRE MODALE. Stripe Checkout
// est une page hébergée chez Stripe : le navigateur QUITTE l'application, et il
// la RECHARGE au retour. Tout ce qui vivait en mémoire est perdu — le look, le
// lieu, la pose de caméra, et la composition de l'affiche. Sans ce bloc,
// l'acheteur qui renonce revient sur la vue d'ouverture de La Réunion et doit
// tout refaire : c'est un abandon de vente garanti, et aucun test unitaire ne
// l'aurait jamais montré.
//
// Ce qui survit VRAIMENT à l'aller-retour : le `sessionStorage` de l'onglet
// (même origine, même onglet, la navigation vers stripe.com ne l'efface pas).
// C'est donc là qu'on a déposé le panier au moment de partir — voir
// src/paiement.js. La carte y voyage encodée par share-link.js, la composition
// de l'affiche à côté.
//
// ⚠️ ET ON N'ÉCRIT PAS `#s=` DANS L'URL POUR ÇA. Ce serait plus court, mais un
// fragment `#s=` fait booter l'application en VISIONNEUSE (`IS_SHIBU`, juste
// en dessous) : l'acheteur reviendrait dans une shibu reçue en lecture seule,
// sans ses outils, incapable de relancer sa commande.
//
// ⚠️ LE PANIER SE LIT AVANT DE SAVOIR S'IL Y A UN RETOUR, et pas l'inverse.
// C'est lui qui porte la SECONDE source de retour : une livraison laissée en
// suspens au chargement précédent (fichier payé jamais pris, paiement encore en
// attente à la banque). L'URL, elle, est nettoyée dès ce bloc — elle ne survit
// donc jamais à un rechargement. Voir `retourAReprendre`, src/paiement.js.
const PANIER_EN_COURS = lirePanier()
const RETOUR_PAIEMENT = retourAReprendre(location.search, PANIER_EN_COURS)
// Une restauration compte comme un état venu d'ailleurs : le look d'ouverture
// ne doit pas l'écraser (voir `fromLink`, plus bas).
let PANIER_RESTAURE = null
if (RETOUR_PAIEMENT.cas && !location.hash.startsWith('#s=') && !location.hash.startsWith('#r=')) {
  try {
    PANIER_RESTAURE = PANIER_EN_COURS
    const decoded = PANIER_RESTAURE?.carte && decodeShareState(PANIER_RESTAURE.carte)
    const repris = decoded && parseShareState(decoded, BASE_TEMPLATE_LOOK)
    if (repris) {
      Object.assign(params, repris.look)
      params.demLat = repris.loc.lat
      params.demLon = repris.loc.lon
      params.demZoom = repris.loc.zoom
      params.demLocation = 'Custom'
      pendingShareCam = repris.cam
      pendingShareFen = repris.fen
    }
  } catch (err) {
    // Un panier illisible ne doit jamais empêcher le site de s'ouvrir : on perd
    // la composition, pas la session.
    console.warn('panier de paiement ignoré :', err)
  }
  // ⚠️ L'URL SE NETTOIE TOUT DE SUITE. `?paye=…` laissé dans la barre
  // d'adresse, c'est une confirmation qui se rejoue à chaque rechargement, qui
  // part dans un signet et dans l'historique partagé. Le paramètre a été lu, il
  // n'a plus rien à faire là. `replaceState` n'ajoute pas d'entrée d'historique :
  // le bouton « précédent » ne ramène pas chez Stripe.
  const propre = urlSansRetour(location.href)
  // ⚠️ `window.history`, PAS `history`. Ce fichier déclare plus bas un `const
  // history` (la pile d'annulation, src/history.js) : le nom global est donc
  // masqué ICI MÊME par sa zone morte temporelle, et un `history.replaceState`
  // nu lève un ReferenceError que le `catch` avalerait en silence — l'URL
  // resterait sale sans que rien ne le dise. Vu en vrai, dans le navigateur.
  if (propre) { try { window.history.replaceState(null, '', propre) } catch { /* pas grave */ } }
}

// EMBED (shibumap.com/templates) : la carte boote DIRECTEMENT sur la zone
// vitrine — une seule zone à charger, jamais Annecy d'abord. La page
// hôte pilote ensuite le look/la palette. Constante changeable en une ligne.
const IS_EMBED = new URLSearchParams(location.search).has('embed')
// une « shibu » reçue (lien partagé #s=/#r=) : on ouvre un VIEWER épuré, pas
// l'app d'édition — carto seule, contrôles de vue (iso/ciné/lecture), marque
// en bas + CTA « Toi aussi, crée ta ShibuMap ». Jamais en embed (la vitrine
// /templates a son propre chrome nu).
const IS_SHIBU = (location.hash.startsWith('#s=') || location.hash.startsWith('#r=')) && !IS_EMBED
if (IS_SHIBU) document.body.classList.add('shibu-view')
// /templates redirige ici : l'app s'ouvre directement en mode boutique
const IS_STORE_BOOT = new URLSearchParams(location.search).has('store')
// lien direct organisateurs : l'app s'ouvre dans le Race Studio
const IS_STUDIO_BOOT = new URLSearchParams(location.search).has('studio')
// Nā Pali (Kauai, Hawaï), z12 : falaises cannelées plongeant dans une vraie
// bathymétrie (-2300 m à Honopu) — choisi sur scoring DEM (falaises creusées
// + profondeur d'eau, Adrien). Le zoom z12 est le niveau « bord de côte ».
const EMBED_SHOWCASE = { lat: 22.19, lon: -159.66, zoom: 12, name: 'Nā Pali' }
if (IS_EMBED && !location.hash.startsWith('#s=') && !location.hash.startsWith('#r=')) {
  params.demLat = EMBED_SHOWCASE.lat
  params.demLon = EMBED_SHOWCASE.lon
  params.demZoom = EMBED_SHOWCASE.zoom
  params.demLocation = EMBED_SHOWCASE.name
}

// ---- VUE DE DÉPART « shibuStart » -----------------------------------------
// Le Grand Brûlé, à La Réunion : le Piton de la Fournaise culmine à 2 626 m et
// le fond de l'océan descend à −2 199 m DANS LE MÊME BLOC — près de 4 800 m
// d'amplitude sur 27 km, un tiers de mer. Cadrage choisi au relevé DEM parmi
// huit candidats de l'île : c'est le seul qui montre à la fois le relief fin
// (Mapterhorn) et la bathymétrie (GEBCO), donc tout ce que le produit sait faire.
//
// ⚠️ APPLIQUÉ ICI, PAS DANS LES VALEURS D'USINE. `BASE_TEMPLATE_LOOK` est capturé
// quelques lignes plus haut et sert de RÉFÉRENCE aux liens de partage, qui ne
// transportent que la différence : toucher aux défauts changerait l'apparence de
// tous les liens déjà émis. Même précaution que EMBED_SHOWCASE juste au-dessus.
const START_VIEW = { lat: -21.26, lon: 55.74, zoom: 12, name: 'La Réunion' }
if (!IS_EMBED && !IS_SHIBU && !IS_STORE_BOOT && !IS_STUDIO_BOOT) {
  params.demLat = START_VIEW.lat
  params.demLon = START_VIEW.lon
  params.demZoom = START_VIEW.zoom
  params.demLocation = START_VIEW.name
  // le look complet du template (158 clés) — toutes sont des TEMPLATE_KEYS,
  // exactement comme le chemin des liens de partage juste au-dessus
  Object.assign(params, SHIBU_START.look)
}

// #r=<id> — a PUBLISHED race link (Netlify Blobs, see netlify/functions/race.mjs
// and share-link.js). Unlike #s= this is unavoidably async (a network fetch), so
// it can't patch `params` before first read the way #s= does. Instead: fire the
// fetch NOW so it runs in parallel with the whole app boot, and let the boot
// kick at the bottom of this file await it — on success the payload's state is
// applied and its GPX loaded (loadGpxText re-frames and reloads the terrain
// itself); on any failure the app just boots the default view, never a blank
// screen. The payload is exactly as untrusted as a pasted #s= fragment — anyone
// can POST to the endpoint — so it goes through parseRacePayload (garbage → null).
let pendingRaceFetch = null
// L'id dont cette session est partie. Gardé au-delà du bloc parce que le
// bouton Partager s'en sert pour RÉÉCRIRE cette course-là (si ce navigateur
// détient son jeton) au lieu d'en publier une copie sous un nouvel
// identifiant — voir shareCurrentView.
let restoredRaceId = null
if (location.hash.startsWith('#r=')) {
  const raceId = location.hash.slice(3)
  if (/^[A-Za-z0-9_-]{4,64}$/.test(raceId)) {
    restoredRaceId = raceId
    pendingRaceFetch = fetch(`${RACE_ENDPOINT}?id=${encodeURIComponent(raceId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && j.ok && j.payload ? j.payload : null)) // GET returns { ok, payload }
      .catch(() => null)
  }
}

// ------------------------------------------------------------------ renderer / scene

const container = document.getElementById('app')
const loadingEl = document.getElementById('loading')
// the loader is a branded card (name + baseline + spinning planet) — status
// text lives in its own line so updating it never wipes the markup
const loadingStatus = loadingEl.querySelector('.ld-status') ?? loadingEl

// the loader paints inline (index.html) the instant the HTML parses, well
// before this module even finishes loading — window.__ldStart timestamps
// that exact moment. hideLoading() enforces "at least 2s on screen" against
// THAT clock (never a flash), but only for the very first dismissal: once the
// initial view is up, later fetches (search, zoom refine…) reuse the same
// card and should hide the instant they're done, not linger.
const LOADING_MIN_MS = 2000
const loadingStart = typeof window.__ldStart === 'number' ? window.__ldStart : performance.now()
let loadingDismissedOnce = false
// DEPUIS QUAND LE VOILE EST-IL À L'ÉCRAN ? `regenerateTerrain` s'accorde un
// délai pour le laisser se peindre AVANT de figer le fil principal — un délai
// qui n'a plus lieu d'être quand le voile est déjà peint depuis longtemps (voir
// là-bas). Part de `loadingStart`, l'instant où index.html a peint la carte en
// ligne, bien avant que ce module ne soit chargé : au démarrage aussi, le voile
// est là depuis des secondes.
let loadingVisibleDepuis = loadingStart
function showLoading() {
  if (loadingEl.classList.contains('hidden')) loadingVisibleDepuis = performance.now()
  loadingEl.classList.remove('hidden')
}
function hideLoading() {
  if (loadingDismissedOnce) {
    loadingEl.classList.add('hidden')
    return
  }
  const wait = Math.max(0, LOADING_MIN_MS - (performance.now() - loadingStart))
  setTimeout(() => {
    loadingDismissedOnce = true
    loadingEl.classList.add('hidden')
    // LA CARTE EST À L'ÉCRAN — le réseau est enfin libre pour ce qui n'est pas
    // elle. Les 16 tuiles racines du globe (1 401 Ko) partaient jusqu'ici du
    // constructeur de Globe, en tête de file, contre le MNT du bloc ; elles
    // partent maintenant d'ici. Voir le long commentaire dans globe.js pour la
    // mesure et pour le filet de `setVisible(true)`.
    // Enveloppé : le globe est construit après ce module, et une visite qui
    // échouerait à le bâtir ne doit pas perdre son voile de chargement.
    assureRacinesGlobe()
    // …et le catalogue de palettes de la boutique, qui n'alimente que le mode
    // aléatoire — inatteignable tant que le voile est là. Voir plus bas.
    try { chargeCataloguePalettes() } catch { /* la réserve procédurale suffit */ }
    // Le même drapeau sert la CSS : à partir d'ici on charge « à chaud », donc
    // le relief de fond ne doit plus jamais revenir — il effacerait la carte
    // que le visiteur regarde. `ld-warm` l'éteint et fait flouter la vue à la
    // place (voir style.css). Posée APRÈS `.hidden`, dans la même tâche : le
    // navigateur ne calcule qu'un seul style, donc aucun flou n'apparaît ici.
    document.body.classList.add('ld-warm')
    // La vue d'ouverture est enfin à l'écran : c'est ELLE le sol de
    // l'historique. Le boot enregistre plusieurs fois (gabarit, relief chargé,
    // lien partagé) et loadRealTerrain part sans être attendu — impossible de
    // poser ce sol depuis bootInitialView. Ici, c'est le seul instant qui dit
    // « ce que le visiteur regarde maintenant, il ne l'a pas fait ». Sans ça,
    // « Annuler » naissait allumé et son premier clic ne faisait rien de
    // visible. Ce qu'on aurait réglé PENDANT le chargement serait perdu — les
    // panneaux sont derrière le carton, on ne règle rien à ce moment-là.
    history.reset()
    // LE MÊME INSTANT SERT LA PREMIÈRE BULLE D'AIDE, et pour la même raison :
    // c'est ici, et pas avant, que le terrain est réellement visible. Un
    // visiteur arrivé par un lien `?f3=1` n'a jamais touché l'interrupteur du
    // mode continu — il n'y a donc aucune bascule à observer, alors qu'il a
    // sous les doigts un geste indevinable. Posée plus tôt, la bulle naîtrait
    // derrière le carton de chargement. Ce bloc ne s'exécute qu'UNE fois
    // (`loadingDismissedOnce` court-circuite les rechargements de zone) :
    // l'évaluation de démarrage est donc unique par visite.
    evalueAide('fenetre-3x3', fenetreContinueActive())
  }, wait)
}

const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false, // SMAA runs in the post chain
  stencil: false,
  depth: false,
})
// Le canevas est posé dans son conteneur AVANT d'être dimensionné : c'est ce
// conteneur qu'applyRenderSize mesure (en boutique / Studio, `#app` n'est qu'un
// cadre — la fenêtre mentirait), et c'est là que le tampon de dessin est borné
// à ce que la carte accepte. Le faire dès le premier dimensionnement compte :
// le rabotage muet de Chrome frappe d'abord au démarrage, sur le plein écran.
container.appendChild(renderer.domElement)
applyRenderSize({ renderer, pixelRatio: params.pixelRatio })
renderer.shadowMap.enabled = true
// VSM so the shadow blur radius is a real, adjustable softness control
renderer.shadowMap.type = THREE.VSMShadowMap
// tone mapping happens in the post chain (three skips renderer tone mapping
// when drawing into the composer's HDR buffer, which is why exposure felt dead)
renderer.toneMapping = THREE.NoToneMapping

const scene = new THREE.Scene()
// background can be a flat colour or a gradient texture (disposed on change)
let _bgTex = null
let _lastBgMul = -1 // last day/night multiplier baked into the backdrop
// Day/night FILTER on the backdrop (Adrien) : the background keeps its chosen
// colour but is dimmed by the solar day factor — dark at night, full by day. A
// plain multiply, the most legible "night filter". 0.12 floor so the hue still
// reads at midnight instead of going pure black.
function bgDayMul() {
  const dl = skyState?.dayLight ?? 1
  // deep nocturnal floor (Adrien : « vraiment plus assombrir la nuit ») — 0.04
  // at true night so the map pops against a near-black backdrop, full by day.
  return 0.04 + 0.96 * dl
}
// l'ombre du globe (terminateur jour/nuit, demande Adrien façon Google Earth)
// SUIT LE FOND : la face nuit s'éteint vers la couleur du décor courant,
// atténuée par le même facteur jour/nuit que lui. HDRI : bleu-noir neutre.
function syncGlobeShadow(mul) {
  const hex = params.bgEnv
    ? '#10131a'
    : (!params.bgMode || params.bgMode === 'solid' ? params.bgColorA : (params.bgColorB || params.bgColorA))
  globe?.setShadowColor(hex, mul)
}
// L'INTERFACE SUIT LA PALETTE (src/ui-theme.js). Même patron que syncAoColor /
// syncHazeColor : un module pur calcule, main.js pousse — ici sur des variables
// CSS, puisque toute la chrome de v28.css tourne déjà sur des jetons.
//
// ⚠️ SUR document.body, PAS sur documentElement, et ce n'est pas un détail :
// v28.css redéclare tous les jetons sous `body.dark`. Une valeur en ligne posée
// sur <html> n'est qu'HÉRITÉE par <body>, donc la déclaration du sélecteur
// `body.dark` la bat à plate couture — la teinte aurait marché de jour et
// disparu de nuit. Sur <body>, le style en ligne l'emporte dans les deux modes.
// (--lq-m1/--lq-m2 s'en moquent : personne ne les redéclare.)
//
// ⚠️ uiTint à faux ne pose PAS de valeurs neutres : il EFFACE. C'est v28.css qui
// redevient la source, à l'octet près — le repli sûr n'est pas une imitation.
let _uiThemeKey = ''
function syncUiTheme() {
  const stops = rampColorStops(params)
  // mémo façon _lastBgMul : applyBackground repasse ici à chaque palier du
  // cycle jour/nuit, et réécrire douze propriétés perso sur <body> force un
  // recalcul de style de tout l'arbre. Rien n'a bougé ⇒ on ne touche à rien.
  const key = params.uiTint === false ? 'off' : `${params.darkMode ? 'd' : 'l'}|${stops.map((s) => s.c).join()}`
  if (key === _uiThemeKey) return
  _uiThemeKey = key
  const st = document.body.style
  if (params.uiTint === false) {
    for (const v of Object.values(UI_TOKEN_VARS)) st.removeProperty(v)
    st.removeProperty('--ce-goo-shadow')
    return
  }
  const tokens = deriveUiTokens(stops, { dark: !!params.darkMode })
  for (const [k, v] of Object.entries(UI_TOKEN_VARS)) st.setProperty(v, tokens[k])
  // l'ombre du calque goo garde sa recette CLAIRE jour et nuit (v28.css) : on
  // la teinte donc toujours depuis la base claire, sinon la barre liquide
  // prendrait un noir à 50 % la nuit — un changement que personne n'a demandé.
  st.setProperty('--ce-goo-shadow', deriveUiTokens(stops, { dark: false }).shadowColor)
}
syncUiTheme() // au démarrage : la palette d'usine habille déjà l'interface

// ⚠️ `var`, et c'est délibéré : applyBackground peut tourner AVANT la création
// d'aoPass, et un const/let lèverait à la lecture (zone morte temporelle — le
// piège déjà vécu entre placeSun et terrain). Hoisté, il vaut undefined d'ici là.
var _aoReady = false
// même garde, pour la couleur de brume : `terrain` et `blockGrid` naissent bien
// après applyBackground, et les lire avant lèverait (TDZ)
var _colorReady = false
function applyBackground() {
  // le liseré métal de la barre liquide suit la PALETTE de la carte —
  // applyBackground passe sur tout changement de look, c'est le bon péage
  const mt = deriveMetalTints(params)
  document.documentElement.style.setProperty('--lq-m1', mt.bright)
  document.documentElement.style.setProperty('--lq-m2', mt.tint)
  // ...et les JETONS de l'interface avec lui : setDarkMode passe par ici, donc
  // la bascule clair/sombre recalcule les jetons dans le bon thème.
  syncUiTheme()
  // l'OMBRE AMBIANTE suit elle aussi la palette : les creux tombent dans la
  // teinte dominante assombrie, jamais dans un gris neutre (Adrien)
  syncAoColor()
  syncHazeColor()
  // v2 : normaliser stops/points D'ABORD et tenir le miroir A/B/C (premier /
  // médian / dernier stop) à jour — l'ombre du globe et la brume lisent A/B
  if (params.bgMode && params.bgMode !== 'solid') {
    const stops = normalizeBgStops(params)
    params.bgStops = stops
    params.bgColorA = stops[0].c
    params.bgColorB = stops[Math.floor((stops.length - 1) / 2)].c
    params.bgColorC = stops[stops.length - 1].c
    if (params.bgMode === 'mesh') params.bgPoints = normalizeBgPoints(params)
  }
  const mul = bgDayMul()
  _lastBgMul = mul
  syncGlobeShadow(mul)
  // an HDRI sky, when chosen, takes over the whole backdrop + lighting. Its
  // brightness follows the cycle via scene.backgroundIntensity, and an opaque
  // floor keeps a ground under the socle (the shadow base would show sky).
  if (params.bgEnv) { plinth.setGroundVisible(true); applyEnvironment(); scene.backgroundIntensity = mul; return } // ground colour = HDRI tone (set in applyEnvironment)
  plinth.setGroundVisible(false) // solid/gradient : the shadow base IS the ground
  scene.backgroundIntensity = 1
  // no HDRI → make sure neutral IBL is back (a sky may have replaced it)
  if (scene.environment !== roomEnvTex) scene.environment = roomEnvTex
  _envBg = null
  if (_bgTex) { _bgTex.dispose(); _bgTex = null }
  const dim = (hex) => '#' + new THREE.Color(hex).multiplyScalar(mul).getHexString()
  if (!params.bgMode || params.bgMode === 'solid') {
    // solid backdrop = the picked Colour A (bug : lisait fogColor — retour
    // Adrien), dimmed by the day factor so the ground (shadow base showing this
    // background through its transparency) darkens with it too.
    scene.background = new THREE.Color(dim(params.bgColorA))
  } else {
    _bgTex = params.bgMode === 'mesh'
      ? makeGradientTexture({ mode: 'mesh', points: params.bgPoints.map((p) => ({ ...p, c: dim(p.c) })) })
      : makeGradientTexture({ mode: params.bgMode, stops: params.bgStops.map((s) => ({ p: s.p, c: dim(s.c) })), angle: params.bgAngle })
    scene.background = _bgTex
  }
}
// HDRI sky environment: the equirect drives both the backdrop and the image-based
// lighting (reflections). Textures are lazy-loaded + cached. Clearing bgEnv
// restores the neutral RoomEnvironment and the gradient/solid backdrop.
const _envCache = {} // id → { bg: equirect texture, env: PMREM texture, avg: hex }
let _envBg = null // currently applied equirect background (for restore bookkeeping)
// average tone of the HDRI's LOWER hemisphere (the ground/horizon band) — the
// socle floor is coloured to it so it sits IN the panorama rather than clashing
// (Adrien : « le socle avec un HDRI doit se rapprocher de la couleur du HDRI »).
function hdriGroundColour(image) {
  try {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 16
    const ctx = c.getContext('2d')
    ctx.drawImage(image, 0, 0, 32, 16)
    const d = ctx.getImageData(0, 8, 32, 8).data // lower half = ground/horizon
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++ }
    const h = (v) => Math.round(v / n).toString(16).padStart(2, '0')
    return '#' + h(r) + h(g) + h(b)
  } catch {
    return null
  }
}
function applyEnvironment() {
  const meta = ENV_BY_ID[params.bgEnv]
  if (!meta) { params.bgEnv = ''; scene.environment = roomEnvTex; applyBackground(); return }
  const cached = _envCache[meta.id]
  const use = (entry) => {
    if (_bgTex) { _bgTex.dispose(); _bgTex = null }
    _envBg = entry.bg
    scene.background = entry.bg
    scene.environment = entry.env
    if (entry.avg) plinth.setGroundColor(entry.avg) // socle floor = HDRI tone
  }
  if (cached) { use(cached); return }
  new THREE.TextureLoader().load(meta.img, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    const env = pmrem.fromEquirectangular(tex).texture
    const entry = { bg: tex, env, avg: hdriGroundColour(tex.image) }
    _envCache[meta.id] = entry
    if (params.bgEnv === meta.id) use(entry) // still selected once it loads
  })
}
// pull a harmonious gradient out of the current map palette (colour theory)
function autoBgColours() {
  const m = deriveBgModel(params)
  params.bgColorA = m.a // gradient top (airy)
  params.bgColorB = m.b
  params.bgColorC = m.c
  params.bgStops = m.stops
  params.bgPoints = m.points
  // the fog fades the relief to a MID haze (b), distinct from the light top, so
  // depth fog stays clearly visible in front of the gradient
  params.fogColor = m.b
  applyBackground()
  autoDarkFromBg()
  // le socle suit aussi — COULEUR seulement, jamais la matière (Adrien) ;
  // après autoDarkFromBg : setDarkMode a pu écraser plinthColor avec la teinte
  // standard du mode, la dérivation harmonisée doit avoir le dernier mot
  params.plinthColor = derivePlinthColor(m, bgLuminance(params))
  plinth.setColors(params)
}
// bascule AUTO clair/sombre par contraste : un fond sombre rendait les textes
// du cartouche noir sur noir. Hystérésis dans autoDarkTarget (0.32..0.45 =
// zone morte) pour ne pas clignoter ; jamais sous un ciel HDRI (image, pas de
// luminance simple). setDarkMode rappelle applyBackground mais pas nous → pas
// de récursion.
function autoDarkFromBg() {
  if (params.bgEnv) return
  const target = autoDarkTarget(bgLuminance(params))
  if (target != null && target !== params.darkMode) {
    setDarkMode(target)
    refreshAll()
    topBar?.syncDark?.()
  }
}
// Changer une palette adapte AUSSI le fond de la carte (Adrien : « sinon c'est
// bizarre ») : on dérive des arrêts de fond harmonieux de la rampe, on garde le
// mode de fond courant (uni/dégradé), puis on applique. Utilisé par TOUTES les
// actions palette (Generate/Shuffle/cartes sauvées/message embed) — jamais par
// l'application d'un template complet, qui porte son propre fond.
function applyPaletteWithBg(p) {
  applyPalette(p)
  // suivi désactivé (toggle « Couleurs auto » OFF) : la palette ne touche
  // plus le fond ni le socle
  if (params.bgAuto === false) { bgRefreshFn?.(); return }
  autoBgColours()
  bgRefreshFn?.()
}
// ⚠️ `params.fogColor` N'EST PLUS LA COULEUR DE LA BRUME — c'est la TEINTE DE
// LA FEUILLE DE FOND, et c'est cette ligne-ci qui en est le premier
// consommateur. Le nom est resté après le retrait de la brume (2026-08-02,
// Adrien : « ça ne fonctionne jamais, on retire ») parce que le renommer
// obligerait à migrer treize fichiers de gabarits livrés — voir la note dans
// src/ui/effects-panel.js. Deux autres chemins la lisent : setDarkMode() et
// applyLook(), tous deux pour peindre le voile de transition.
scene.background = new THREE.Color(params.fogColor)
// PLUS DE `THREE.Fog` DU TOUT, et pas seulement plus de réglage. La passe est
// retirée : `scene.fog` n'est plus jamais posé, donc les matériaux ne compilent
// plus la variante brouillard et les deux renormalisations par image (celle du
// zoom, celle du recul) ont disparu avec. Cacher le contrôle en laissant la
// brume tourner aurait gardé tout le coût pour zéro bénéfice.

// far plane 290 (was 220) : the studio floor/base reach ~3.4× the block, whose
// far edge was clipped at full pull-back — « je vois le bout du socle qui coupe »
// (Adrien). 290 just covers it ; kept as low as possible so depth precision (and
// z-fighting on the thin water layer) stays close to the long-proven 220.
const camera = new THREE.PerspectiveCamera(params.fov, window.innerWidth / window.innerHeight, 0.5, 290)
camera.position.set(0, 18, 19)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, -0.3, 0)
controls.enableZoom = false // zoom is the mode machine's custom inertial dolly
controls.enableDamping = true
// élan sur le drag (retour Adrien) : le résidu de rotation décroît lentement,
// une rotation à la souris a de la lancée au lieu de s'arrêter net. τ ≈ 0.35 s
controls.dampingFactor = 0.03
// ⚠️ LE PLAFOND DUR, ET PLUS LA LOI — Tâche R23. `Math.PI × 0,49` vivait ici et
// dans `modes.js` ; le nombre est le même mais il ne se recopie plus, et la
// VRAIE butée est recalculée à chaque image par `polaireMaxSol` (boucle
// d'image, plus bas) parce qu'elle dépend de la distance et du relief.
controls.maxPolarAngle = POLAIRE_MAX_DURE
// ⚠️ QUATRIÈME ET DERNIER SITE DE `minDistance` — Tâche 1b, Étape 3. Les trois
// autres vivaient dans `modes.js` et sont devenus `Modes._poseButees()` ; celui-ci
// est la pose de DÉPART, avant qu'aucun mode n'ait parlé. La valeur ne se recopie
// plus : elle vient de `loi-altitude.js`, donc les tests la voient.
controls.minDistance = DISTANCE_MIN_SURFACE
controls.maxDistance = 150 // room to frame the whole slab before the orbit gate
controls.update()
// a share link's camera pose overrides the default HOME framing — world-space
// coordinates are already relative to whatever demLat/demLon just got applied
// above, so this is portable across locations with no further translation
if (pendingShareCam) {
  camera.position.set(pendingShareCam.px, pendingShareCam.py, pendingShareCam.pz)
  controls.target.set(pendingShareCam.tx, pendingShareCam.ty, pendingShareCam.tz)
  controls.update()
}

// image-based lighting for believable PBR speculars. Kept alive (not disposed)
// so an HDRI sky environment can be PMREM-processed on demand — see applyEnvironment.
const pmrem = new THREE.PMREMGenerator(renderer)
const roomEnvTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environment = roomEnvTex
scene.environmentIntensity = params.envLight

// ------------------------------------------------------------------ lights

let globe = null // assigned after the world exists (see orbital globe section)
let clouds = null // assigned in the world section

const sun = new THREE.DirectionalLight(0xffffff, params.sunIntensity)
sun.castShadow = true
// La taille vient de params, pas d'un 2048 en dur : sur un palier bas la carte
// d'ombres naît en 1024² au lieu d'être allouée en 2048² puis rebâtie. Une
// texture VSM 2048² coûte 16 Mo et son remplissage est le premier gel visible
// du démarrage. (Le SÉLECTEUR « Résolution des ombres » écrase cette valeur dès
// que le visiteur y touche — voir setShadowRes.)
sun.shadow.mapSize.set(params.shadowRes, params.shadowRes)
// wide enough to catch the slab's cast shadow spilling onto the base
//
// ⚠️ CE VOLUME EST CELUI D'UN SEUL BLOC, ET IL N'A JAMAIS SUIVI LE DAMIER. ±42
// couvre le bloc central (±28) et sa retombée sur le socle ; un 3×3 s'étend à
// ±84 et un 5×5 à ±140, donc les dalles voisines ne projettent rien et n'en
// reçoivent rien. Ce n'est pas nouveau — c'est l'état depuis le premier bloc
// voisin — mais le cadrage de tout le damier (voir `cadreLeDamier` plus bas)
// met désormais les huit voisines à l'écran d'un seul coup, et rend donc la
// coupure franchement visible au lieu de la laisser hors champ.
//
// L'ÉLARGIR N'EST PAS GRATUIT : la carte d'ombres garde sa résolution, donc
// tripler le côté divise par trois la finesse de CHAQUE ombre, y compris celles
// du bloc central qu'on regarde de près le reste du temps. Le vrai remède est
// une cascade (CSM) ou un volume qui suit `empriseVivante()` avec une carte
// agrandie d'autant — un chantier à lui seul, à mesurer avant de le promettre.
sun.shadow.camera.left = -42
sun.shadow.camera.right = 42
sun.shadow.camera.top = 42
sun.shadow.camera.bottom = -42
sun.shadow.camera.near = 2
sun.shadow.camera.far = 130
sun.shadow.bias = -0.0001
sun.shadow.normalBias = 0.02
sun.shadow.radius = params.shadowSoftness
sun.shadow.blurSamples = 16
scene.add(sun)

const hemi = new THREE.HemisphereLight(0xdadada, 0x5c5c5c, params.hemiIntensity)
scene.add(hemi)

// APPOINT DÉCOUPLÉ — la seule lumière que le cycle horaire ne pilote PAS.
//
// castShadow reste FALSE, et ce n'est pas une économie timide : une seconde
// lumière à ombres ferait retraverser toute la scène une fois de plus par
// frame. Sans ombre, le coût est d'une itération de boucle par fragment
// éclairé — mesuré sous le plancher de bruit (voir le rapport §4.3).
//
// ⚠️ CRÉÉE AU BOOT ET JAMAIS RETIRÉE, MÊME ÉTEINTE. C'est délibéré, ça a été
// remis en cause, MESURÉ, et la mesure a tranché — lis-la avant d'y toucher.
//
// three.js recompile TOUS les programmes de la scène quand le NOMBRE de
// lumières change : pas seulement les matériaux qu'éclaire la nouvelle lampe,
// tous. Une création à la demande (à la première activation de l'interrupteur)
// a donc été écrite et chronométrée sur cette page, La Réunion, bloc seul,
// damier vide : **1 923 ms** de gel sur le clic, pour 34 → 39 programmes.
// Presque deux secondes, et c'est le cas FAVORABLE — le damier peuplé ajoute
// 24 dalles à recompiler. Les bascules suivantes, elles, coûtaient 1,0-1,5 ms,
// soit le plancher de bruit d'une frame : c'est bien le CHANGEMENT DE NOMBRE
// de lumières qui coûte, une seule fois, et rien d'autre.
//
// Le gain qu'on achèterait avec ce gel : ne pas construire un objet JavaScript
// au démarrage. Quelques microsecondes. Le marché est mauvais dans les deux
// sens, donc la lampe naît ici, à intensité 0, et l'interrupteur ne fait que
// monter et descendre son intensité — le compte de lumières ne bouge JAMAIS.
//
// Corollaire à ne pas défaire : il ne doit apparaître ni `scene.remove(fillLight)`
// ni `new THREE.DirectionalLight` ailleurs que sur la ligne ci-dessous.
const fillLight = new THREE.DirectionalLight(new THREE.Color(params.fillColor), 0)
fillLight.castShadow = false
scene.add(fillLight)

function placeFill() {
  const d = fillDirection(params.sunAzimuth, params.fillAzimuthOffset ?? 150, params.fillElevation ?? 20)
  const az = THREE.MathUtils.degToRad(d.azimuth)
  const el = THREE.MathUtils.degToRad(d.elevation)
  const r = 34
  fillLight.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r)
  // l'interrupteur ne retire pas la lampe, il la met à 0 — voir ci-dessus
  fillLight.intensity = fillLightIntensity(params.fillEnabled === true, params.fillIntensity ?? 0)
  fillLight.color.set(params.fillColor ?? '#ffcf9a')
}

// the sun you can SEE — aimed by the same vector that aims the light, so the
// disc and the shading can never disagree (see sun-disc.js)
const sunDisc = new SunDisc(scene)

// The 24 h day/night cycle — the ONE control the lighting has now (the studio
// presets and the six manual sun sliders are gone by request: "retire le
// systeme d'eclairage et mets juste une tirette de 24h"). lightingFor computes
// the REAL sun for the block's own lat/lon (see daycycle.js), so this must
// re-run whenever the hour OR the location changes — loadRealTerrain calls it
// after every move.
let skyState = null // last lightingFor() result — see applyTimeOfDay
// La lecture temporelle tourne-t-elle ? Posé par la pastille d'heure (le bouton
// ▶), lu ici : c'est le PREMIER des deux déclencheurs de l'allumage automatique
// des lumières nocturnes. Un booléen et pas une lecture dans hour-pill, parce
// que `applyTimeOfDay` est aussi appelée par la pastille elle-même, à chaque
// image du cycle.
let cycleTemporelActif = false
function applyTimeOfDay(hour) {
  // ⚠️ Les GAINS s'appliquent ICI, entre le cycle et params, et c'est tout le
  // correctif. Les trois lignes marquées plus bas ÉCRASENT params.sunIntensity /
  // hemiIntensity / envLight ; les curseurs du panneau Lumière écrivaient dans
  // ces mêmes clés, et cette fonction est rappelée à chaque déplacement de carte
  // (loadRealTerrain) et à chaque dixième d'heure — le réglage manuel ne
  // survivait donc jamais au mouvement suivant. Les curseurs pilotent
  // maintenant params.*Gain, que rien ici ne réécrit : le cycle continue de
  // calculer la lumière physique de l'heure, l'utilisateur la décale.
  // Voir daycycle.applyGains pour le POURQUOI d'un gain plutôt qu'un verrou.
  const s = applyGains(lightingFor(hour, params.demLat, params.demLon), {
    sun: params.sunGain, hemi: params.hemiGain, env: params.envGain,
  })
  params.sunAzimuth = s.azimuth
  params.sunElevation = s.elevation
  // ⚠️ **LES DEUX MONNAIES SONT ICI, CÔTE À CÔTE, ET C'EST VOULU — Tâche R7.**
  // La ligne au-dessus porte la LAMPE (`s.elevation`, relevée à +40° la nuit
  // « so the moon shines from above ») : c'est la bonne pour MODELER le relief.
  // La ligne ci-dessous porte l'ASTRE (`s.sunElevation`, −26,12° à 03h22 au lieu
  // filmé) : c'est la seule qui dise de quel côté du terminateur la planète est.
  // ⛔ Échanger les deux rendrait le plein jour à 3 h du matin. C'est le défaut
  // « une grandeur juste dans la mauvaise monnaie », et il se referme ICI.
  soleilMonde = soleilMondeDeLHeure(s, { lat: params.demLat, lon: params.demLon })
  params.sunIntensity = s.sunIntensity // ← dérivée : heure × sunGain
  params.hemiIntensity = s.hemiIntensity // ← dérivée : heure × hemiGain
  params.envLight = s.envIntensity // ← dérivée : heure × envGain
  sun.color.set(s.sunColor)
  skyState = s // the disc and the lake surface both read the current hour from here
  hemi.color.set(s.hemiSky)
  hemi.groundColor.set(s.hemiGround)
  scene.environmentIntensity = s.envIntensity
  placeSun()
  // The lake's glint tracks the same sun. Pushed from HERE and not from
  // placeSun(): placeSun runs during module initialisation, before the
  // `const mapLayers` binding exists, and `mapLayers?.` does NOT save you from
  // a temporal dead zone — it throws, aborting the whole module.
  mapLayers.setSun({ dir: sun.position, color: s.sunColor, sky: s.hemiSky })
  // la mer suit le même cycle : corps d'eau éteint la nuit, ciel reflété teinté
  realWater?.setSunState({ dayLight: s.dayLight ?? 1, skyHex: s.hemiSky })

  // Night at this PLACE puts the whole UI in dark mode, and daylight brings it
  // back. Guarded on change: setDarkMode rebuilds the background, contours and
  // grid, and applyTimeOfDay fires on every drag of the 24 h slider. The
  // hysteresis lives in darkModeFor — see its comment for why a bare threshold
  // would flap here.
  // s.sunElevation, NOT s.elevation: the latter is where the LIGHT is placed
  // (lifted above ground at night so the moon shines from above), which would
  // read as broad daylight at midnight.
  const wantDark = darkModeFor(s.sunElevation, params.darkMode)
  if (wantDark !== params.darkMode) setDarkMode(wantDark)

  // the BACKDROP (and, through the transparent shadow base, the ground) follows
  // the cycle too — dark at night, bright by day. Re-dim only on a meaningful
  // change so the auto-cycle never re-bakes the gradient every single frame.
  if (Math.abs(bgDayMul() - _lastBgMul) > 0.015) applyBackground()

  // Les villes s'allument quand le soleil se couche. C'est un simple réglage
  // d'uniforme — pas de reconstruction, pas de texture : la tirette d'heure
  // peut donc être traînée sans que la couche coûte quoi que ce soit. On passe
  // `hour`, pas params : c'est l'heure que le soleil vient d'appliquer.
  refreshNuitIntensite(hour)

  // ET LA COUCHE S'ALLUME TOUTE SEULE QUAND LA NUIT SE LÈVE (demande d'Adrien).
  //
  // ⚠️ ON RÉUTILISE `wantDark`, C'EST-À-DIRE `darkModeFor` ET SON HYSTÉRÉSIS.
  // Écrire ici un second seuil sur `s.sunElevation` fabriquerait deux nuits
  // désaccordées : l'interface passerait en sombre à −3° et la couche
  // s'allumerait ailleurs. Pire, un seuil NU rebattrait à chaque image quand on
  // traîne la tirette d'heure — c'est exactement le défaut contre lequel
  // l'hystérésis de darkModeFor a été écrite.
  tenteAllumageNuit({ nuit: wantDark, lecture: !!cycleTemporelActif })
}

// ══════════ L'HEURE DE LA PLANÈTE — Tâche R7 ════════════════════════════════
//
// ⛔ **LA PLANÈTE NE LISAIT PAS L'HEURE : ELLE LISAIT LA CAMÉRA.** La boucle
// d'image reposait `globe.setSunDir(_orbSun)` à chaque tour, sur la position de
// la caméra tournée de 42°, dans les DEUX modes. **Mesuré au banc R7** (Chrome
// sans tête, caméra IMMOBILE, seule l'horloge bouge) : `uSunDir` vaut
// `(0,23049 · −0,36868 · 0,90053)` **au bit près aux huit heures essayées** —
// une élévation solaire de **+51,60° à minuit comme à midi** — pendant que le
// crop juste à côté suivait l'heure (+15,1° à 6 h, +57,2° à midi). Traces et
// captures dans `.banc/R7/`.
//
// ⚠️ **DEUX ÉCRITURES POUR UN SEUL UNIFORME, ET C'EST LA SECONDE QUI GAGNAIT.**
// `placeSun` poussait déjà `sun.position` vers le globe (ligne ci-dessous) ;
// la boucle d'image l'écrasait à l'image suivante. Le banc a attrapé l'instant
// exact où les deux se croisent : un relevé sur quarante-deux montre `uSunDir`
// égal au soleil de la scène, les quarante et un autres au vecteur caméra.
//
// ⚠️ **ET `sun.position` N'AURAIT PAS SUFFI NON PLUS** : c'est un vecteur du
// repère du SOCLE (est / haut / nord au lieu du bloc), porté à un rayon de 34.
// Le globe a son propre repère. La conversion est celle de la Tâche P3
// (`monde/eclairage-crop.js`), et `monde/soleil-monde.js` dit POURQUOI elle doit
// partir de l'élévation ASTRONOMIQUE (`s.sunElevation`, celle que `lightingFor`
// vient de rendre) et surtout pas de `params.sunElevation`, qui porte la lampe.
const soleilHeureMonde = soleilHeureMondeActif()
const _soleilMonde = new THREE.Vector3()

// ⛔ **LA DIRECTION EST CALCULÉE DANS `applyTimeOfDay`, PAS ICI, ET C'EST UNE
// MUTATION SURVIVANTE QUI L'A EXIGÉ.** Le tour 1 lisait `skyState` au moment de
// poser : il suffisait alors d'une ligne à 70 lignes de là —
// `skyState = { ...s, sunElevation: s.elevation }` — pour rendre le PLEIN JOUR À
// 3 h DU MATIN sans qu'un seul des 4 204 tests bouge. Le piège de la monnaie
// était NOMMÉ, il n'était pas FERMÉ. Il l'est maintenant par construction : la
// seule lecture de l'élévation astronomique se fait sur le `s` FRAIS que
// `lightingFor` vient de rendre, à deux lignes de `params.sunElevation = s.elevation`,
// là où les deux monnaies sont côte à côte et où un lecteur les compare.
let soleilMonde = null

/**
 * La direction à pousser dans `globe.setSunDir` — repli sur le comportement
 * d'avant dès qu'une donnée manque (démarrage : `applyTimeOfDay` n'a pas encore
 * tourné, `soleilMonde` est encore nul).
 */
function soleilDuGlobe() {
  if (poseurDuSoleilDuGlobe(soleilHeureMonde) === 'camera') return sun.position
  return soleilMonde ? _soleilMonde.fromArray(soleilMonde) : sun.position
}

function placeSun() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth)
  const el = THREE.MathUtils.degToRad(params.sunElevation)
  const r = 34
  sun.position.set(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r)
  // a grazing sun hits sun-facing slopes nearly head-on and used to blow the
  // whole scene past the ACES shoulder. Attenuate like the atmosphere does,
  // normalised so the default elevation (16°) keeps its exact tuned look and
  // higher suns are never brightened (min 1) — only LOW suns get dimmer.
  const atten = (e) => 0.35 + 0.65 * Math.pow(Math.max(Math.sin(e), 0), 0.7)
  // ⚠️ Le soleil ÉTEINT tombe à 0, il ne quitte pas la scène : le retirer
  // rejouerait le piège de recompilation décrit plus haut, et lui coûterait
  // bien plus cher (il porte le programme d'ombre de tous les matériaux).
  const on = sunOn(params.sunEnabled)
  sun.intensity = on ? params.sunIntensity * Math.min(1, atten(el) / atten(THREE.MathUtils.degToRad(16))) : 0
  hemi.intensity = params.hemiIntensity
  if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
  if (globe) globe.setSunDir(soleilDuGlobe()) // Tâche R7 — l'heure, pas la caméra
  if (clouds) clouds.setSunDir(sun.position)
  sunDisc.update(sun.position, skyState?.sunColor ?? '#fff4ea', skyState?.elevation ?? params.sunElevation)
  // le disque qu'on VOIT ne doit jamais contredire l'ombrage (voir sun-disc.js) :
  // soleil coupé, plus de disque dans le ciel.
  if (!on) sunDisc.setVisible(false)
  placeFill() // l'appoint est relatif au soleil : il se replace avec lui
}
placeSun()

// Le SEUL endroit qui décide si le soleil coule une ombre — et donc le seul qui
// libère sa carte. L'interrupteur du soleil passe volontairement par ici plutôt
// que d'inventer son propre chemin : params.shadowMode 'off' faisait déjà
// exactement ce travail, il suffisait de lui adjoindre un second motif de
// coupure (voir daycycle.sunShadowOn).
//
// ⚠️ CE QUE COÛTE LA PREMIÈRE COUPURE, et ce n'est pas nous : basculer
// castShadow change les defines du shader (NUM_DIR_LIGHT_SHADOWS), donc three
// recompile toute la scène. Chronométré sur cette page (La Réunion, z12) :
//   • code d'AVANT, `sun.castShadow = false` à la main : 1 893 ms ;
//   • cet interrupteur : 1 936 ms.
// Le même chiffre, au bruit près — c'est le comportement de three, pas un coût
// que l'interrupteur ajoute. Ensuite les deux variantes de programmes sont en
// cache et les bascules retombent à 1,3-2,0 ms, soit une frame. Si tu veux
// supprimer ce gel un jour, ce n'est PAS ici qu'il faut chercher : il faudrait
// précompiler les deux variantes au boot (renderer.compile), ce qui coûterait
// au démarrage exactement ce qu'on essaie d'y économiser.
function applyShadowMode() {
  const wantShadow = sunShadowOn(params.sunEnabled, params.shadowMode)
  sun.castShadow = wantShadow
  // ⚠️ autoUpdate reste FAUX dans les DEUX modes, et c'est le correctif du
  // 28/07/2026 : « dynamic » redessinait la carte 2048² à chaque image alors
  // qu'aucun projeteur ne bouge dans cette application (relief, murs du socle,
  // murs des dalles voisines, jupe de région — quatre décors immobiles ; les
  // bateaux ont castShadow = false, nuages et voitures n'en projettent aucune).
  // Mesuré en production : 0,55 ms et 1 188 328 triangles PAR IMAGE, soit 26 %
  // du temps GPU et 47 % des triangles, pour redessiner à l'identique. C'est
  // majCarteOmbre() qui décide maintenant, sur l'état réel de la scène — et
  // l'image rendue est rigoureusement la même (voir src/carte-ombre.js).
  renderer.shadowMap.autoUpdate = false
  if (wantShadow) { sigCarteOmbre = null; renderer.shadowMap.needsUpdate = true }
  // ⚠️ three ne rend PAS la carte d'ombre tout seul quand castShadow retombe à
  // false : la texture 2048×2048 reste allouée sur le GPU pour rien. C'est le
  // vrai poste coûteux du soleil, donc on la relâche à la main. La remettre à
  // null suffit à la rallumer : WebGLShadowMap réalloue à la première frame qui
  // en a besoin (c'est aussi pour ça qu'on ne dispose QUE sur le front
  // descendant — sinon on la relâcherait et la réallouerait à chaque frame).
  if (!wantShadow && sun.shadow.map) {
    sun.shadow.map.dispose()
    sun.shadow.map = null
  }
}

// LA CARTE D'OMBRE, REDESSINÉE SEULEMENT QUAND ELLE CHANGERAIT.
//
// Appelé juste avant chaque dessin. Le POURQUOI et les chiffres sont dans
// src/carte-ombre.js ; ici il n'y a que la lecture de l'état réel de la scène.
//
// ⚠️ On lit la visibilité EFFECTIVE (en remontant les parents) : cacher un
// groupe entier — le socle, une dalle voisine — doit emporter l'ombre de tout
// ce qu'il contient. `o.visible` seul aurait gardé l'ombre d'un objet éteint
// par son parent, et une ombre orpheline ne se lit pas comme un réglage.
//
// ⚠️ Les matrices lues ici datent de l'image PRÉCÉDENTE (three met le monde à
// jour à l'intérieur de son propre rendu). Un projeteur qui bougerait verrait
// donc son ombre suivre avec une image de retard — invisible, et de toute
// façon aucun projeteur ne bouge. Le soleil, lui, est écrit par placeSun avant
// le dessin : la tirette des 24 h n'a aucun retard.
let sigCarteOmbre = null
function majCarteOmbre() {
  if (!renderer.shadowMap.enabled || !sun.castShadow) return
  const casters = []
  scene.traverse((o) => {
    if (!o.castShadow) return
    let vu = o.visible
    for (let p = o.parent; vu && p; p = p.parent) vu = p.visible
    const g = o.geometry
    const pos = g?.attributes?.position
    casters.push({ id: o.id, geo: g?.id ?? 0, pv: pos?.version ?? 0, count: pos?.count ?? 0, visible: vu, m: o.matrixWorld.elements })
  })
  const sig = signatureCarteOmbre({ soleil: sun.position, res: params.shadowRes, flou: sun.shadow.radius, casters })
  if (sig === sigCarteOmbre) return
  sigCarteOmbre = sig
  renderer.shadowMap.needsUpdate = true
}

// L'interrupteur du soleil : l'intensité (placeSun) ET l'ombre (applyShadowMode)
// d'un seul geste, pour que l'UI n'ait pas à connaître les deux.
function applySunSwitch() {
  placeSun()
  applyShadowMode()
}

// Les DEUX interrupteurs, définis une seule fois : le panneau Lumière et
// window.__exp (sondes console / scripts de vérif) tirent sur les mêmes.
function setSunEnabled(v) {
  params.sunEnabled = v !== false
  applySunSwitch()
}
function setFillEnabled(v) {
  params.fillEnabled = v === true
  // fillIntensity vaut 0 par défaut — héritage de l'époque où le curseur
  // FAISAIT l'interrupteur. Allumer et ne rien voir passerait pour une panne :
  // on pose une valeur visible au premier allumage seulement.
  if (params.fillEnabled && !(params.fillIntensity > 0)) params.fillIntensity = 0.6
  placeFill()
}

// ------------------------------------------------------------------ world

// ══════════ LA FENÊTRE BORNÉE À LA PLACE DU BLOC — Tâche 6 ter ═════════════
//
// ⚠️ **LE SECOND ET DERNIER LECTEUR DE `FLAGS.globeContinu` EST ICI**, et c'est
// le même patron que le globe trois mille lignes plus bas : `terrain.js`
// n'importe PAS `flags.js`, il ne connaît qu'un booléen posé sur `params`.
// **Et il n'importe pas non plus `fenetre-bornee.js`** — ce serait le cycle
// `terrain.js → fenetre-bornee.js → terrain.js`, celui que la Tâche 6 bis A a
// déjà payé une fois et qui ne se serait vu qu'en production. C'est donc d'ICI
// que la fenêtre est fabriquée et posée.
//
// **Ce que ça change, et c'est tout le plan :** aujourd'hui chaque cran passe
// par `terrain.rebuild()`, qui alloue une géométrie NEUVE et quatre tampons
// neufs. Avec la fenêtre, les quatre tampons survivent au cran et `rebuild()`
// n'écrit plus que des `y`, des normales et des couleurs, **en place**.
params.globeContinu = globeContinuActif()

const terrain = new Terrain(params)
// ⚠️ **`rayonCoin = 0`, MESURÉ ET NON PRÉFÉRÉ** : la formule fermée de
// `gridNormals` suppose un pas régulier, et les coins en superellipse le
// cassent — 63,1° d'écart de normale au pire à n = 384 (`fenetre-bornee.test.js`
// ⑨d). À coins vifs la nappe est le gabarit de `gridTemplate` bit pour bit. La
// forme du coin reste celle de `plinth.js`, exactement comme aujourd'hui.
// ⚠️ `largeurM` vient du MNT, pas de l'emprise : c'est `dem.extentMeters` qui
// fait foi pour l'échelle verticale (32 m d'écart entre les deux conventions de
// circonférence, soit 8,0e-7 en relatif — assez pour diverger en silence).
// ══════════ L'EMPRISE QUE LA FENÊTRE REMPLIT — Tâche 6 quinquies ═══════════
//
// ⚠️ **ET CE N'EST PAS `empriseSocle`, C'EST MESURÉ.** Tant que les hauteurs
// venaient du MNT (Tâche 6 ter), l'emprise passée à `construireFenetre` était
// DÉCORATIVE : à `rayonCoin = 0` la nappe est le gabarit de `gridTemplate`, et
// seule `largeurM` — reprise de `dem.extentMeters` — portait quelque chose.
// Maintenant qu'elle décide QUELLES TUILES on lit, elle devient porteuse, et
// l'écart d'`empriseSocle` à l'empreinte du bloc se voit : **jusqu'à un sixième
// de socle** (−0,389 / +0,376 / −0,183 tuile mesurés sur trois lieux le
// 2026-08-21 — voir `empriseBlocMNT` dans `geo.js`). La nappe glisserait sous le
// masque de mer, le trait de côte, les étiquettes et le tracé GPX, qui sont tous
// cuits sur l'empreinte du MNT.
//
// ⚠️ **UNE SEULE LOI, DEUX CHEMINS, ET LE PREMIER FAIT AUTORITÉ** : quand le MNT
// est là, on lui demande son empreinte ; sinon `empriseBlocMNT` rend celle qu'il
// aurait — c'est le chemin qui permettra au socle de se peupler AVANT lui.
function empriseDuSocle() {
  // ⚠️ **L'EMPRISE 3×3 (`?f3=1`) EST HORS PÉRIMÈTRE, ET C'EST ÉCRIT.** Son champ
  // fait 168 unités quand la géométrie en fait 56 : la fenêtre n'a pas encore de
  // décalage à opposer à ça, et `tickFenetre` refuse déjà la combinaison. On
  // retombe sur le MNT plutôt que de peindre un relief au tiers de sa distance.
  if (dem?.empriseCote > 1) return null
  if (dem) {
    const b = patchLatLonBBox(dem)
    return { ouest: b.west, sud: b.south, est: b.east, nord: b.north }
  }
  const lat = Number(params.demLat)
  const lon = Number(params.demLon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return empriseBlocMNT({ lat, lon, zoom: params.demZoom })
}

// LES QUATRE RÉGLAGES QUI CADRENT LA FENÊTRE — un seul endroit qui les écrit.
// `construireFenetre` les prend à la naissance, `recadrerFenetre` les remet à
// chaque cran ; deux listes divergeraient au premier réglage ajouté.
function cadrageFenetre() {
  const emprise = empriseDuSocle()
  if (!emprise) return null
  return {
    emprise,
    // ⚠️ `dem.extentMeters` GARDE LA MAIN QUAND LE MNT EST LÀ, et c'est mesuré :
    // la largeur tirée de l'emprise prend le cosinus de la latitude de son
    // centre CALÉ SUR LA GRILLE DE TUILES, quand `dem.js` prend celui de la
    // latitude demandée. Écart relevé le 2026-08-21 sur cinq lieux : 6,9e-5 à
    // 4,8e-4 à z12–z14, et jusqu'à **3,5 % à z5**. Le repli sur l'emprise n'est
    // donc pas un équivalent, c'est ce qu'on a **avant** que le MNT arrive.
    largeurM: dem?.extentMeters || null,
    profondeurDalle: params.plinthDepth ?? 7,
    exageration: lireExageration(params),
  }
}

terrain.fabriqueFenetre = (n) => {
  const c = cadrageFenetre()
  if (!c) return null
  return construireFenetre({ ...c, n, rayonCoin: 0 })
}

// ══════════ LE RECADRAGE À CHAQUE CRAN — Tâche 6 septies ═══════════════════
//
// ⚠️ **IL ÉTAIT POSÉ DANS `hauteursDeFlux` SEULEMENT, DONC SOUS UN SEUL DES DEUX
// RÉGIMES — ET SOUS L'AUTRE L'EMPRISE GELAIT.** `_geometrieRebuild` garde la
// fenêtre tant que sa résolution est bonne : `fabriqueFenetre` n'est appelée
// qu'une fois, et c'est elle qui pose l'emprise. Rejeu du 2026-08-21, trois
// crans z12 → z13 → z14 sous `?globe=continu` seul : `fenetre.largeurM` restait
// à **20 451 m** quand le bloc en faisait 10 226 puis 5 113. Muet tant que
// personne ne s'y géoréférençait ; un facteur deux par cran dès que l'échelle
// verticale, l'altitude de cadrage et la visée s'y lisent.
terrain.recadreFenetre = (fenetre) => {
  const c = cadrageFenetre()
  if (c) recadrerFenetre(fenetre, c)
}
scene.add(terrain.mesh)

// the 3D slab the relief sits on (walls + shadow-catching base)
const plinth = new Plinth(scene, params)
plinth.rebuild(terrain, params)
// the Block panel's Thickness slider (create-panel.js) calls plinth.rebuild()
// directly on 'change' — a light rebuild that skips a full terrain regen. In
// region mode the plinth walls are hidden and the visible depth instead comes
// from the cut-edge skirt (region-skirt.js buildRegionSkirt), which reads the
// SAME params.plinthDepth (both compute baseY = lowestPoint - depth, so the
// two feel identical). Wrap the rebuild so the slider re-welds the skirt too —
// otherwise the skirt keeps its stale depth until the next full terrain rebuild.
const _plinthRebuild = plinth.rebuild.bind(plinth)
plinth.rebuild = (t, p, f = null) => {
  // ⚠️ Le TROISIÈME argument (`baseYFloor`) doit traverser : sans lui, la
  // fenêtre continue perdrait son plancher de socle à chaque appel qui passe
  // par cette enveloppe, et le socle se remettrait à respirer en défilant.
  _plinthRebuild(t, p, f)
  if (p.regionMode && regionMaskCanvas) rebuildRegionSkirt()
}
// give the socle its own punchy studio env so metals/glass/carbon reflect real
// highlights (the terrain keeps the neutral RoomEnvironment on scene.environment)
plinth.setEnvMap(makeSocleEnvMap(renderer))
let cartoucheRef = null // set once the ground cartouche exists (avoids TDZ at boot)
// push the chosen socle material (default = matte stone, i.e. the original look)
function applyPlinthMaterial() {
  const glass = params.plinthFinish === 'glass'
  plinth.setMaterial({
    finish: params.plinthFinish,
    id: glass ? params.plinthGlass : params.plinthPbr,
    diffusion: glass ? params.plinthGlassDiffusion : undefined,
    projection: params.plinthGlassProjection,
    glassBump: params.plinthGlassBump,
    refract: params.plinthGlassRefract,
    bump: params.plinthBump,
    fallbackColor: params.plinthColor,
  })
  // La diffusion sous-surfacique se repose APRÈS le matériau : setMaterial lève
  // needsUpdate, donc three relance onBeforeCompile — les uniformes sont
  // relogés, mais leurs valeurs doivent être à jour au moment où il le fait.
  applyPlinthSSS()
  // keep the engraved socle name readable whatever the material — re-render the
  // cartouche so its ink flips to contrast the new surface
  cartoucheRef?.rerender?.()
}
// DIFFUSION SOUS-SURFACIQUE DU SOCLE — voir Plinth._brancheSSS pour ce que ça
// coûte et pourquoi ce n'est pas `transmission`. Sur un socle de VERRE on
// n'allume pas : le verre a déjà sa vraie transmission, et empiler les deux
// laiterait le bloc au lieu de l'éclairer par l'intérieur.
function applyPlinthSSS() {
  plinth.setSSS({
    on: !!params.sssEnabled && params.plinthFinish !== 'glass',
    force: params.sssStrength ?? 0.6,
    teinte: params.sssColor ?? '#ff8a4c',
    nettete: params.sssPower ?? 4,
  })
}
// high-contrast ink for the name engraved on the socle face, chosen against the
// current material's base tone (dark carbon/glass → light ink, and vice versa)
function socleWallInk() {
  const glass = params.plinthFinish === 'glass'
  let hex = params.plinthColor
  if (glass) hex = (GLASS_BY_ID[params.plinthGlass] || {}).color || '#8899aa'
  else hex = (PBR_BY_ID[params.plinthPbr] || {}).color || params.plinthColor
  const c = new THREE.Color(hex)
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  // glass reads mid-to-dark against the sky behind it → bias toward light ink
  return lum < (glass ? 0.6 : 0.5) ? '#f4f1ea' : '#1a1c20'
}
applyPlinthMaterial()
plinth.setVisible(params.plinth)

// cartographic cartouche laid out on the ground around the slab
//
// ══════ LE CARTOUCHE NE VIT PLUS DANS LA SCÈNE DU BLOC — Tâche D16-c ═══════
//
// ⛔ **D16-a A SUPPRIMÉ LA PASSE DE SURFACE** (`passeSurface.enabled = false`) :
// la scène du bloc n'est plus dessinée du tout sous le mode sphère. Le cartouche
// y vivait ; le rallumer là n'aurait montré RIEN. Il pend donc d'un groupe
// d'ANCRAGE, que le branchement de la frontière de rendu fait adopter par
// `sceneGlobe` — et que `majCartoucheGlobe` pose à chaque image par la
// similitude (`monde/cartouche-globe.js`).
//
// ⚠️ **HORS MODE SPHÈRE, CE GROUPE EST L'IDENTITÉ DANS `scene`** : matrice
// unité, même parent qu'avant, comportement du dépôt au bit près.
const groupeCartouche = new THREE.Group()
groupeCartouche.name = 'ancrage-cartouche'
scene.add(groupeCartouche)
const groundInfo = new GroundInfoLayer({
  scene: groupeCartouche,
  // socle désactivé (Adrien) : la carte se POSE AU SOL — les textes du
  // cartouche remontent au pied du relief (baseY + profondeur du socle).
  // ZONE ISOLÉE : le zéro est le niveau de la mer, et les textes s'y calent —
  // c'est le plan unique que partagent la découpe, la dalle et le cartouche.
  // ⚡ **ET SOUS LE MODE SPHÈRE, LA BASE EST CELLE DU CROP, PAS CELLE DU BLOC
  // PLAT.** Mesuré à La Réunion : `plinth.baseY = −17,4074` contre `−15,6489`
  // pour le fond du crop ramené en unités de bloc — **1,76 unité d'écart, 11 %
  // de la profondeur**, soit un cartouche qui flotte sous le fond dès qu'on
  // baisse la caméra. `baseCartoucheEnBloc` porte la division par `k`, et son
  // sens (`monde/cartouche-globe.js` §2).
  getBaseY: () => {
    const bloc = params.regionMode ? regionBaseY() : params.plinth ? plinth.baseY : plinth.baseY + plinth.depth
    if (!terreUniqueBranchee || params.regionMode) return bloc
    return baseCartoucheEnBloc(globe?.baseYCrop, echelleCartouche(), bloc)
  },
  getInk: () => (params.darkMode ? '#e8e4da' : params.hudInk),
  getWallInk: () => socleWallInk(), // engraved name flips to contrast the socle material
  // sans socle il n'y a plus de flanc : les textes muraux (nom gravé, logo,
  // infos course) disparaissent
  // zone isolée : plus de flancs de bloc, donc plus de gravure murale à porter
  wallsVisible: () => !!params.plinth && !params.regionMode,
})
cartoucheRef = groundInfo

// Nuages : v2 (entités instanciées, clouds2.js) par défaut, ancien champ de
// bruit global en repli. Les deux exposent la MÊME interface
// (build/update/setVisible/setSunDir/reroll) — le reste du fichier ne sait pas
// lequel tourne.
//
// ══════ LE CIEL NE VIT PLUS DANS LA SCÈNE DU BLOC — Tâche R20 ═════════════
//
// ⛔ **IL Y AVAIT DEUX SYSTÈMES DE NUAGES, ET LES QUINZE CURSEURS PILOTAIENT
// CELUI QUI N'EST PAS SOUMIS AU GPU.** Mesuré, pas lu
// (`.banc/R20/diag-deux-systemes.json`) : une image du dépôt soumet quatre
// rendus — `sceneGlobe` avec `camGlobe`, puis trois quadrilatères plein écran
// du compositeur. **La scène du bloc plat n'y figure pas**
// (`passeSurface.enabled = false`, D16-a). `clouds2` y vivait, avec **16
// instances vivantes** : un système complet, allumé, correctement peuplé,
// dessiné dans un tampon que personne ne regarde. Forcé `visible = true`,
// l'écart à l'écran valait **0,000 / 0,000**.
//
// ⛔ **ET LA COQUILLE DU GLOBE NE LE REMPLAÇAIT PAS.** À 18 km comme à
// 1 200 km, `uFade = 0,0000` et écart **0,000 / 0,000** ; garde LEVÉE, `uFade`
// forcé à 1 en vue de surface, l'écart vaut **encore 0,000 / 0,000**, parce
// qu'elle est à **95 565 m** — hors champ d'une caméra qui regarde le sol — et
// que son texel vaut **78 184 m** (`.banc/R20/diag-voie1.json`).
//
// ⚡ Le ciel pend donc d'un groupe d'ANCRAGE, que le branchement de la
// frontière de rendu fait adopter par `sceneGlobe`, et que `majNuagesGlobe`
// pose à chaque image par la MÊME similitude que le cartouche.
//
// ⚠️ **HORS MODE SPHÈRE, CE GROUPE EST L'IDENTITÉ DANS `scene`** : matrice
// unité, même parent qu'avant, comportement du dépôt au bit près.
const groupeNuages = new THREE.Group()
groupeNuages.name = 'ancrage-nuages'
scene.add(groupeNuages)
clouds = new Clouds2(groupeNuages, terrain, params)
clouds.setSunDir(sun.position)

// ambient airliners + SpaceX pad watcher (models fetched, see public/models)
const traffic = new Traffic(scene, terrain, params)

// the sea as a colour-tintable, environment-reflecting glass block
// water simulation is behind FLAGS.water (v37, disabled in prod); null when off
const realWater = FLAGS.water ? new RealWater(scene) : null
// ÉVÉNEMENTS — les éléments 3D rapportés qui vivent sur la carte. Les bateaux
// sont le premier ; la catégorie est prévue pour en accueillir d'autres.
const boats = new Boats(scene)
// ⚠️ DAMIER : CONTRAINTE ASSUMÉE — les calques de carte ne sortent pas du bloc
// central. Lacs, rivières, toponymes : ce ne sont PAS des uniformes, c'est une
// GÉOMÉTRIE unique, bâtie pour l'emprise de `dem` (`mapLayers.rebuild({ dem,
// terrain, params })`). Les dalles voisines n'ont donc ni lac ni nom de village,
// par construction — les y étendre demanderait une géométrie par dalle, sa
// propre requête Overpass et son propre budget : un projet, pas une ligne.
// Rien dans test/damier-uniformes.test.js ne peut le surveiller (il ne voit que
// les uniformes et le matériau) ; ce commentaire EST la surveillance, et le
// test vérifie qu'il n'a pas disparu.
const mapLayers = new MapLayers(scene, camera) // water/places overlays, populated per zone

// ══════ LES COTES NE VIVENT PLUS DANS LA SCÈNE DU BLOC — Tâche R24 ═════════
//
// ⛔ **C'EST LE §5 DE `monde/visibilite-surface.js` UNE CINQUIÈME FOIS.** Le
// curseur « Points cotés » passait par `socleAffiche()`, borné à FAUX sous le
// mode sphère : le groupe était peuplé — **14 cotes mesurées à La Réunion,
// `groupeVisible: false` aux cinq altitudes** (`.banc/R24/avant.json`) — et
// dessiné dans une scène que D16-a ne rend plus (`passeSurface.enabled = false`).
// Le rendre `visible` n'aurait rien montré : c'est le défaut du cartouche et
// celui des nuages, mot pour mot.
//
// ⚡ Les cotes pendent donc d'un groupe d'ANCRAGE que le branchement de la
// frontière de rendu fait adopter par `sceneGlobe`. ⚠️ **Et contrairement au
// cartouche et au ciel, ce groupe ne reçoit AUCUNE similitude** : une cote est
// posée sur le RELIEF, pas sur un plan, et la tangente n'est bonne qu'au centre
// (`frontiere-rendu.js` : le bloc plat est au-dessus de la sphère de **2,1 km à
// z8**, 538 km à z4). Chaque cote porte donc sa propre pose, calculée par
// `poseur.placer` — la loi du dépôt, celle des rivières et des toponymes.
//
// ⚠️ **HORS MODE SPHÈRE, CE GROUPE EST L'IDENTITÉ DANS `scene`** : matrice
// unité, même parent qu'avant, comportement du dépôt au bit près.
const groupeCotes = new THREE.Group()
groupeCotes.name = 'ancrage-cotes'
scene.add(groupeCotes)

// ⚠️ **LA ZONE MORTE EST RÉELLE, PAS THÉORIQUE.** `poseurDesReperes` est une
// DÉCLARATION de fonction (donc hissée), mais son corps lit `poseurReperes` et
// `globe`, déclarés en `let` deux mille lignes plus bas : l'appeler à la
// première construction des cotes — qui a lieu ICI, avant le globe — lèverait
// une `ReferenceError` de zone morte temporelle, et `typeof` n'y échappe pas.
// La toute première pose est donc PLATE ; `regenerateLabels()`, appelée dès le
// premier relief, donne la vraie. Ce drapeau est le seul témoin de l'ordre du
// fichier, et il est plus honnête qu'un `try` qui avalerait autre chose.
let poseurCotesPret = false
const poseurDesCotes = () => (poseurCotesPret ? poseurDesReperes() : null)

const labelOpts = () => ({
  real: params.source === 'real',
  toFeet: (h) => terrain.heightToFeet(h),
  // dark mode: printed cartography flips to light ink or it vanishes on the
  // near-black terrain; light mode keeps the labels' own vintage browns
  ink: params.darkMode ? '#e8e2d2' : undefined,
  // ⚡ **LE MÊME POSEUR QUE LES SOMMETS ET QUE LA CARTO**, pas un second : il
  // porte les deux conversions (`monde/sol-globe.js`) et lit la hauteur que le
  // GLOBE dessine. `null` hors mode sphère ⇒ drapage du dépôt.
  poseur: poseurDesCotes(),
})
let labels = createLabels(terrain.sample, params.seed, labelOpts())
labels.visible = params.labels
groupeCotes.add(labels)

function regenerateLabels() {
  groupeCotes.remove(labels)
  disposeLabels(labels)
  const opts = labelOpts()
  // ⚠️ **`refus` COMPTE LES POINTS QUI SONT RETOMBÉS SUR LE BLOC PLAT** — c'est
  // `monde/sol-globe.js` qui le tient, et c'est le seul moyen de savoir si cette
  // construction-ci a vu les hauteurs du globe ou seulement son repli. La veille
  // ci-dessous s'arrête là-dessus au lieu de rebâtir indéfiniment.
  const refus0 = opts.poseur?.globe ? opts.poseur.refus : null
  labels = createLabels(terrain.sample, params.seed, opts)
  labels.userData.refusCotes = refus0 == null ? null : opts.poseur.refus - refus0
  // a rebuild can run while in orbit (dive preload, GUI) — stay hidden there
  // ⛔ **PAS `socleAffiche()` — Tâche R24.** Voir `poserCotesVisibles`.
  labels.visible = params.labels && cotesAffichees()
  f3AncreAuSol(labels) // mode continu : les cotes s'accrochent à leur point du sol
  groupeCotes.add(labels)
}

// ------------------------------------------------------------------ HUD + interactivity

const HOME = { pos: new THREE.Vector3(0, 18, 19), target: new THREE.Vector3(0, -0.3, 0) }
const EASINGS = {
  smooth: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), // cubic in-out
  glide: (t) => 1 - Math.pow(1 - t, 5), // quintic out
  linear: (t) => t,
}
const tween = {
  active: false,
  orbit: false, // true = rotation orbitale (slerp direction) plutôt qu'un lerp droit
  t: 0,
  p0: new THREE.Vector3(),
  p1: new THREE.Vector3(),
  t0: new THREE.Vector3(),
  t1: new THREE.Vector3(),
}
// slerp de deux directions unitaires (rotation d'orbite propre) → `out`
const _twTgt = new THREE.Vector3()
const _twD0 = new THREE.Vector3()
const _twD1 = new THREE.Vector3()
const _twDir = new THREE.Vector3()
function slerpDir(a, b, t, out) {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
  if (dot > 0.9995) return out.copy(b) // quasi colinéaires : lerp suffit
  const theta = Math.acos(dot) * t
  out.copy(b).addScaledVector(a, -dot).normalize() // composante de b ⟂ à a
  return out.multiplyScalar(Math.sin(theta)).addScaledVector(a, Math.cos(theta))
}
let scan = null // ScanController — instantiated once the terrain exists
let regionSkirt = null // vertical curtain welding the cut edge down to a base
let regionMaskCanvas = null // current zone mask, kept so the skirt can rebuild on terrain regen
let regionCellSkirts = [] // les mêmes rideaux, sur les dalles du damier
// Le PLANCHER de la zone découpée, en unités monde : le point le plus bas du
// relief SOUS le masque, toutes dalles du damier confondues. Recalculé par
// rebuildRegionSkirt, lu par regionBaseY. Voir region-skirt.js regionBaseLevel.
let regionFloorY = null

const poiFeet = (h) => terrain.heightToFeet(h)
// night-survey ink set — the single source for every dark-mode surface
const DARK = {
  sheet: '#0e0f11',
  ink: '#e8e4da',
  contour: '#ece6d6',
  grid: '#d8d2c2',
  paper: 'rgb(18 19 22 / var(--hud-bg-alpha))',
  plinth: '#26262a',
  base: '#151517',
}
const LIGHT_PLINTH = { plinth: '#d8d4cc', base: '#c8c5be' }
// 3D survey furniture reads in light ink on the dark sheet
const effInk = () => (params.darkMode ? DARK.ink : params.hudInk)
let pois = findPois(terrain.sample, params.seed, poiFeet)
let hud3 = createHud3D(params.seed, pois, { ink: effInk(), accent: params.hudAccent })
hud3.lines.visible = params.surveyLines
scene.add(hud3.group)

function flyTo(pos, target, opts = {}) {
  cameraAuto.stop() // any programmatic move cancels a looping automation
  shots.cancel() // …et interrompt le plan en cours (le cran reste sélectionné)
  pilote.cancel() // …et fait atterrir la caméra pilote
  tween.p0.copy(camera.position)
  tween.t0.copy(controls.target)
  tween.p1.copy(pos)
  tween.t1.copy(target)
  tween.t = 0
  tween.active = true
  tween.orbit = !!opts.orbit // rotation orbitale (iso) vs déplacement droit
}

// clicking a PK marker or a named summit orbits the camera just ABOVE the peak
// and frames it — a high, slightly-offset vantage looking down at the top
function focusOnPeak(x, h, z) {
  const v = peakVantage(x, h, z)
  flyTo(new THREE.Vector3(v.pos.x, v.pos.y, v.pos.z), new THREE.Vector3(v.target.x, v.target.y, v.target.z))
}

// ---- keyboard-shortcut camera presets (numpad) --------------------------
// World axes: +x east, +z south (see geo.js). Presets orbit the CURRENT
// controls.target at the CURRENT camera distance — only the angle changes,
// the same idea as Blender's numpad views — so a preset never yanks the
// framing away from wherever the user already is.
const CAM_PRESET_ELEV = THREE.MathUtils.degToRad(35) // cardinal + iso elevation
function normXZ(x, z) {
  const len = Math.hypot(x, z) || 1
  return { x: x / len, z: z / len }
}
const CAM_PRESET_DIR = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 },
  nw: normXZ(-1, -1),
  ne: normXZ(1, -1),
  sw: normXZ(-1, 1),
  se: normXZ(1, 1),
}
function orbitPresetPose(dir) {
  const target = controls.target.clone()
  const dist = THREE.MathUtils.clamp(camera.position.distanceTo(target) || 20, controls.minDistance, controls.maxDistance)
  const horiz = Math.cos(CAM_PRESET_ELEV) * dist
  const y = Math.sin(CAM_PRESET_ELEV) * dist
  return { pos: new THREE.Vector3(target.x + dir.x * horiz, target.y + y, target.z + dir.z * horiz), target }
}
const DOLLY_FACTOR = 0.82
function dollyCamera(factor) {
  const target = controls.target.clone()
  const off = camera.position.clone().sub(target)
  let dist = off.length()
  if (dist < 1e-4) return
  dist = THREE.MathUtils.clamp(dist * factor, controls.minDistance, controls.maxDistance)
  off.setLength(dist)
  flyTo(target.clone().add(off), target)
}
// name → 'top' | 'north' | 'south' | 'east' | 'west' | 'nw' | 'ne' | 'sw' | 'se'
// | 'home' | 'dollyIn' | 'dollyOut'. Null-safe: a bad name, or firing before
// the mode machine exists / mid-transition, is a silent no-op.
function cameraPreset(name) {
  if (!modes || modes.mode !== 'surface' || modes.busy) return
  if (name === 'home') {
    flyTo(HOME.pos, HOME.target)
    return
  }
  if (name === 'dollyIn') {
    dollyCamera(DOLLY_FACTOR)
    return
  }
  if (name === 'dollyOut') {
    dollyCamera(1 / DOLLY_FACTOR)
    return
  }
  if (name === 'top') {
    const target = controls.target.clone()
    const dist = THREE.MathUtils.clamp(camera.position.distanceTo(target) || 20, controls.minDistance, controls.maxDistance)
    // nudged a hair off the exact vertical so camera.lookAt's forward vector
    // is never perfectly parallel to the default up vector
    flyTo(new THREE.Vector3(target.x + 0.01, target.y + dist, target.z + 0.01), target)
    return
  }
  const dir = CAM_PRESET_DIR[name]
  if (!dir) return
  const pose = orbitPresetPose(dir)
  flyTo(pose.pos, pose.target)
}

// `tour.active` is read (and defensively reset to false) in several places
// shared with the GPX-follow / drone-cam wiring — kept as a minimal shell so
// those checks stay valid. What used to DRIVE it — startTour/tourGaze, a
// Catmull-Rom flight between two survey markers (tourFrom/tourTo) with a
// trapezoidal speed profile and a damped gimbal — was UI-orphaned back at
// v28 ("Tour folder POI fiction", see that commit) and never wired to
// anything since: startTour had zero call sites anywhere in the app. Removed
// here as part of the Camera → Motion cleanup rather than left as a
// live/dead twin (the trap this repo already has one instance of in
// region-skirt.js vs. the deleted region-plate.js).
const tour = { active: false }
const UP = new THREE.Vector3(0, 1, 0)

document.documentElement.style.setProperty('--hud-accent', params.hudAccent)
document.documentElement.style.setProperty('--hud-ink', params.hudInk)
document.documentElement.style.setProperty('--hud-blur', `${params.uiBlur}px`)
document.documentElement.style.setProperty('--hud-bg-alpha', params.uiBgOpacity)

// user grabbing the camera cancels any fly-to or tour, and pauses the idle
// planet spin for a moment (the spin must never compose with a held drag)
let lastUserInput = 0
let controlsHeld = false
// liberté caméra en lecture (Adrien) : dès que l'utilisateur a pivoté/zoomé
// pendant le suivi, le rail ne reprend PLUS la main — la caméra reste où il
// l'a mise et ne fait que VISER la tête. Réarmé à chaque nouveau Play.
let followManual = false
let followZoomVel = 0 // élan de zoom molette en suivi (log-échelle / s)
// vrai tant que la poursuite hélicoptère commande la tête de course : sert
// uniquement à savoir QUAND rendre la main (voir GpxLayer.releaseHead)
let teteCommandee = false
controls.addEventListener('start', () => {
  tween.active = false
  tour.active = false
  // task 30: grabbing the camera cancels the drone follow — EXCEPT mid GPX
  // playback with Follow on, where a drag nudges the camera without ending
  // the follow (see updateCameraMotion()'s controlsHeld branch below, which
  // suspends the drone's own aiming for as long as controlsHeld stays true
  // instead of calling drone.stop()/disengageGpxFollow() here).
  const gpxFollowing = params.gpxFollow && gpxLayer.isPlaying() && drone.active
  if (!gpxFollowing) drone.stop()
  cameraAuto.stop() // …and any looping camera automation
  // Attraper la caméra coupe le plan en cours — même règle que pour tout le
  // reste. Le cran reste sélectionné : le clic suivant enchaîne sur le plan
  // d'après au lieu de tout reprendre au début.
  shots.cancel()
  // Attraper la caméra arrête aussi le vol du pilote. Le `camera.up` remis
  // d'aplomb juste en dessous n'est pas décoratif : le pilote incline `up` pour
  // faire basculer l'horizon, et OrbitControls s'en sert comme pôle — un `up`
  // laissé incliné ferait tourner toute la carte au premier glissé.
  pilote.cancel()
  camera.up.set(0, 1, 0)
  controlsHeld = true
  if (drone.active && params.gpxFollow) followManual = true
  lastUserInput = performance.now()
})
controls.addEventListener('end', () => {
  controlsHeld = false
  lastUserInput = performance.now()
})
window.addEventListener('wheel', () => (lastUserInput = performance.now()), { passive: true })

let modes = null // assigned once the globe + mode machine exist (below)
let isoBtn = null // assigned once the bars exist — referenced by the mode hooks
let mapCorner = null // bottom-left cartography corner — assigned once bars exist
let cineBtn = null
// (`piloteBtn` vivait ici — bouton retiré le 2026-08-02, voir src/ui/bars.js)
let aq = null // adaptive quality controller (perf.js) — built after the panels
let recorder = null // Recorder instance, lazy-loaded with the export stack

// real-world mode strips the fiction: no dial platform
function applySourceMode() {
  const real = params.source === 'real'
  hud3.platform.visible = !real
}

function regenerateHud() {
  scene.remove(hud3.group)
  hud3.dispose()
  pois = findPois(terrain.sample, params.seed, poiFeet)
  hud3 = createHud3D(params.seed, pois, { ink: effInk(), accent: params.hudAccent })
  hud3.lines.visible = params.surveyLines
  hud3.platform.visible = params.source !== 'real' // FUI dial only on generated terrain
  // same orbital guard as labels — GUI color changes rebuild the HUD and the
  // fresh group must not appear over the globe
  hud3.group.visible = socleAffiche()
  f3AncreAuSol(hud3.pois) // mode continu : les repères restent plantés dans leur crête
  scene.add(hud3.group)
  applySourceMode()
}
applySourceMode()

// ------------------------------------------------------------------ post: real depth-based DOF

// Post-processing passes routinely build half/quarter-resolution internal
// targets. Handing them an ODD dimension yields FRACTIONAL texture sizes,
// which is how the black-rectangle bug happened — so the composer is only
// ever told even numbers. One CSS pixel of slack is invisible; a black
// rectangle is not.
// Store mode (boutique) recadre #app en vitrine : la box du CONTAINER est la
// vérité, pas la window (identiques hors boutique — #app est plein écran).
const evenSize = () => {
  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight
  return [w & ~1, h & ~1]
}

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
// ⚠️ LA RÉFÉRENCE EST GARDÉE — Tâche 1b bis (« la frontière de rendu »). La
// passe était anonyme ; la frontière a besoin de lui couper son effacement et
// son fond quand le globe passe DEVANT elle dans la chaîne. Sans drapeau, elle
// reste exactement ce qu'elle était : `clear` vrai, fond dessiné.
const passeSurface = new RenderPass(scene, camera)
composer.addPass(passeSurface)

// AMBIENT OCCLUSION — N8AO (screen-space GTAO, purpose-built library).
// postprocessing's own SSAOEffect never bit in this pipeline at ANY setting
// (A/B pixel probes showed zero difference at intensity 12) — replaced
// wholesale rather than tuned further. N8AOPostPass is postprocessing-
// compatible and self-contained: no NormalPass, it derives everything from
// the depth buffer. aoRadius is in WORLD units — the block is 56 across.
// ⚠️ LA BIBLIOTHÈQUE N'EST PLUS DANS LE BUNDLE PRINCIPAL, ET VOICI POURQUOI.
// `n8ao` pèse 154,3 Ko bruts — 8,5 % du bundle mesuré au sourcemap — et
// `ssao: false` dans LES QUATRE paliers de palier-machine.js. Aucun template ne
// l'allume non plus : `params.ssaoEnabled` naît de `MACHINE.ssao`, donc faux
// partout. La seule porte d'entrée est la bascule « Ombrage des creux » du
// panneau Effets. On payait donc 154 Ko sur le chemin critique de CHAQUE
// visiteur pour une option que personne n'a par défaut.
//
// La passe est maintenant bâtie à la PREMIÈRE demande (voir `assureAoPass`).
// Tout le reste — les réglages ci-dessous, leur raison, la place dans la
// chaîne — est inchangé au caractère près.
let aoPass = null
let aoEnAttente = null // la promesse en cours, pour ne pas importer deux fois

async function assureAoPass() {
  if (aoPass) return aoPass
  if (aoEnAttente) return aoEnAttente
  aoEnAttente = import('n8ao')
    .then(({ N8AOPostPass }) => {
      if (aoPass) return aoPass // une autre demande a gagné la course
      const p = new N8AOPostPass(sceneDeRendu(), cameraDeRendu(), ...evenSize())
      configureAoPass(p)
      // ⚠️ INDEX 1, ET PAS `addPass(p)` TOUT COURT. La passe doit rester juste
      // derrière le RenderPass et devant tout le reste — c'était sa place quand
      // elle était bâtie au démarrage. `addPass(p)` l'aurait posée en DERNIER,
      // après le rendu final : l'occlusion se serait appliquée par-dessus le
      // tone mapping et le grain, ce qui n'est pas la même image.
      // L'index 1 ne dépend d'AUCUNE des passes suivantes : il reste juste si
      // le bloom, la profondeur de champ ou une autre s'en vont.
      composer.addPass(p, 1)
      aoPass = p
      syncAoColor()
      // la taille courante : le composer ne redimensionne que ce qu'il connaît
      // AU MOMENT du resize, et on arrive après.
      p.setSize?.(...evenSize())
      return p
    })
    .catch((err) => {
      // Un échec de chargement ne doit pas emporter la carte : on retombe sur
      // « pas d'occlusion ambiante », c'est-à-dire l'état par défaut du site.
      console.warn('ShibuMap : occlusion ambiante indisponible', err)
      return null
    })
  return aoEnAttente
}

// ⚠️ Le paramètre s'appelle `aoPass` EXPRÈS : il masque la variable de module du
// même nom, et c'est ce qui permet de laisser le corps ci-dessous — les réglages
// et surtout leurs raisons, durement acquises — au caractère près tel qu'il
// était quand la passe était bâtie au démarrage. Ne pas « nettoyer » ce nom sans
// relire les quatre paragraphes qui suivent.
function configureAoPass(aoPass) {
aoPass.configuration.aoRadius = 2.2
aoPass.configuration.distanceFalloff = 1.2
aoPass.configuration.intensity = params.ssaoIntensity
// FULL RES on purpose. halfRes builds internal targets at width/2, and on an
// ODD window (1009 -> 504.5) those are FRACTIONAL: WebGL truncates the texture
// while the shader keeps sampling on the fractional scale, so the upsample
// reads outside the valid area, gets 0, and — since AO MULTIPLIES the colour —
// paints a hard-edged BLACK RECTANGLE. That is the reported 'carré noir', and
// the old SSAO had the same defect (resolutionScale 0.75 -> 756.75). The cost
// is real, which is exactly what the adaptive governor is for.
// HALF RESOLUTION + the two heaviest features off. Measured on the live app
// (3388x1820 buffer): 126 MB -> ~25 MB and 1.4 ms -> 0.1 ms per frame, while
// the AO still darkens the scene by 4.3 mean levels against 5.1 at full res —
// a 16% weaker bite for a 4x memory cut and a 14x speed-up.
//
// halfRes was previously FALSE because I suspected its fractional targets of
// causing the black rectangle. That is now disproven — the culprit was
// bloom's mipmap chain — and the composer is fed even dimensions anyway, so
// 2016/2 and 1820/2 are exact integers. It is safe again.
aoPass.configuration.halfRes = true
// the two transparency targets are FULL-RES (28 MB each here) and buy nothing:
// this scene's transparent layers (water fill, labels) are not AO receivers
aoPass.configuration.transparencyAware = false
// temporal accumulation holds another half-res buffer and mainly helps a
// static camera; the denoiser already carries the quality
aoPass.configuration.accumulate = false
// A shim that disposed the (unused) accumulation buffer was tried for a
// further 7 MB and REMOVED: N8AO allocates its targets lazily on first
// render, so the release did not hold at boot, and re-disposing every frame
// would fight the library for a rounding error. The floor below is what the
// library supports honestly.
aoPass.enabled = params.ssaoEnabled
}
// Si la machine ou un lien partagé demandent l'occlusion dès le départ, on la
// charge tout de suite — le comportement d'avant, pour ce cas-là seulement.
if (params.ssaoEnabled) assureAoPass()
// panel + templates talk to `ssao.intensity` — keep that surface stable
// ⚠️ LA SOURCE DE VÉRITÉ EST `params.ssaoIntensity`, PAS LA PASSE. Les templates
// lisent et écrivent `ssao.intensity` (main.js `applyLook`, effects-panel.js) et
// peuvent le faire AVANT que la passe n'existe — auparavant elle était toujours
// là, ce n'est plus le cas. On garde donc la valeur dans params et on la
// recopie dans la passe quand elle arrive (`configureAoPass` la relit).
const ssao = {
  get intensity() { return params.ssaoIntensity },
  set intensity(v) {
    params.ssaoIntensity = v
    if (aoPass) aoPass.configuration.intensity = v
  },
}
// L'OMBRE AMBIANTE PREND LA COULEUR DE LA CARTE (Adrien) : N8AO peint l'AO
// avec `configuration.color` (noir par défaut, d'où le gris sale universel).
// On y met la teinte dominante de la palette poussée dans ses ombres, donc
// des creux qui appartiennent à la carte au lieu de la salir.
function syncAoColor() {
  if (!_aoReady || !aoPass) return
  aoPass.configuration.color.set(deriveAoColor(params))
}
_aoReady = true
syncAoColor()

// ══════════ PLUS DE BLOOM — LA PASSE ENTIÈRE EST PARTIE ════════════════════
//
// Adrien, 2026-08-02 : « inutile, on retire ». C'était une `EffectPass`
// pre-tonemap sur le tampon HDR (reflets du soleil sur l'eau, chaleur du
// couchant, clair de lune). Elle n'est plus construite ni ajoutée au composer :
// une passe désactivée reste une passe à tenir à jour, et celle-ci avait déjà
// coûté un carré noir (voir plus bas) plus un garde-fou par image.
//
// ⚠️ CE QUI EN DÉPENDAIT, ET QUI A ÉTÉ TRAITÉ AVEC :
//  · `params._bloomTierOk` (perf.js) et la colonne `bloom` de la table des
//    paliers machine (palier-machine.js) : le palier 3 « lâchait le bloom ».
//    Sans passe, il n'y a plus rien à lâcher — les deux sont partis, et
//    test/palier-machine.test.js dit maintenant que la colonne n'existe plus.
//  · `src/sun-disc.js` et `src/map/lake-material.js` calaient leurs valeurs HDR
//    JUSTE SOUS le seuil de bloom (0,85) pour ne pas l'allumer par accident.
//    Ces valeurs restent : elles sont maintenant simplement des couleurs HDR
//    sans halo. Le reflet du soleil sur les lacs perd sa FLEUR — c'est la seule
//    perte visible du retrait, et elle est assumée.
//
// L'HISTOIRE DU CARRÉ NOIR, gardée parce qu'elle explique pourquoi on ne
// remettra pas cette passe à la légère : `mipmapBlur` divise l'image par deux
// huit fois, chaque niveau est ARRONDI, donc deux niveaux consécutifs ne sont
// jamais exactement dans un rapport de 2. La passe de remontée suppose ce
// rapport exact, lit hors des texels valides, et une lecture hors bornes sur
// une cible flottante rend NaN — qui s'affiche en NOIR, en rectangle à bord
// franc, apparaissant et disparaissant avec la taille de la fenêtre.

// DEPTH OF FIELD — built ON FIRST USE, not at boot.
//
// Measured (2026-07-20): a DISABLED pass costs 0 ms per frame (postprocessing
// skips it), so there is no wasted computation — but its render targets stay
// allocated, and DoF's six targets are 136 MB. Bokeh is OFF by default, so
// that was 136 MB of VRAM held permanently for an effect most sessions never
// switch on. Shrinking its resolutionScale only frees 18 MB (three of the six
// targets follow the composer's size, not the effect's), so the only real
// answer is to not build it until it is wanted.
//
// Everything reads params first and the live objects second, so the app
// behaves identically whether or not the pass exists yet.
// ⚡ **LA CAMÉRA QUI REND, POUR LES PASSES BÂTIES PLUS TARD — Tâche D16-a.**
//
// La profondeur du tampon est écrite par la caméra de la passe de fond. Un effet
// d'écran qui la linéarise avec les `near`/`far` d'une AUTRE caméra se trompe
// d'espace — c'est la classe de défaut `1/k` de ce chantier. Les passes déjà
// bâties sont recalées d'un coup par `composer.setMainCamera` ; celles qui
// naissent à la demande (profondeur de champ, occlusion ambiante) passent par ici.
//
// ⚠️ **LE `try` N'EST PAS UNE PARESSE.** `frontiereActive` et `camGlobe` sont
// déclarés en `const` **plus bas dans ce fichier** ; `setDofEnabled` est appelée
// une fois AVANT cette ligne-là (bokeh éteint par défaut, donc sans effet — mais
// un modèle ou un lien partagé peut l'allumer au démarrage). Lire une `const`
// avant son initialisation lève une `ReferenceError` : on retombe alors sur la
// caméra principale, c'est-à-dire le comportement du dépôt, et le bloc
// `frontiereActive` plus bas recale ce qui aurait été bâti trop tôt.
function cameraDeRendu() {
  try { return fusionDesPasses && camGlobe ? camGlobe : camera } catch { return camera }
}
function sceneDeRendu() {
  try { return fusionDesPasses && sceneGlobe ? sceneGlobe : scene } catch { return scene }
}

let dof = null
let dofPass = null
function ensureDof() {
  if (dofPass) return dofPass
  // ⚠️ **LA CAMÉRA PASSE PAR UNE VARIABLE, ET CE N'EST PAS UN STYLE.**
  // `test/export-effets.test.js` dérive la chaîne d'effets en lisant CE FICHIER
  // avec `new EffectPass\(([^)]*)\)` : un appel de fonction en premier argument
  // arrêterait la lecture à sa parenthèse fermante et l'effet disparaîtrait du
  // classement — en silence, avec un test vert. (Trouvé en rouge, pas relu.)
  const camEffets = cameraDeRendu()
  dof = new DepthOfFieldEffect(camEffets, {
    focusDistance: 0.02,
    focalLength: 0.06,
    bokehScale: params.bokehScale,
    height: 720,
  })
  // drive the circle-of-confusion in world units so focus params are intuitive
  poserMiseAuPoint() // ⚠️ la chaîne d'unités vit là-bas, et nulle part ailleurs
  dofPass = new EffectPass(camEffets, dof)
  // BEFORE the final colour/tonemap pass — DoF belongs in linear HDR
  composer.addPass(dofPass, composer.passes.length - 1)
  return dofPass
}

// The single door for turning bokeh on/off: it builds the pass on the first
// real enable and is a cheap no-op while it stays off.
function setDofEnabled(on) {
  if (!on) { if (dofPass) dofPass.enabled = false; return }
  ensureDof().enabled = true
}

// pre-tonemap exposure multiplier, operating on the HDR buffer
class ExposureEffect extends Effect {
  constructor(exposure) {
    super(
      'ExposureEffect',
      'uniform float exposure; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = vec4(inputColor.rgb * exposure, inputColor.a); }',
      { uniforms: new Map([['exposure', new THREE.Uniform(exposure)]]) }
    )
  }
}

const exposureFx = new ExposureEffect(params.exposure)
const toneMap = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
const contrastFx = new BrightnessContrastEffect({ brightness: 0, contrast: params.contrast })
const hueSat = new HueSaturationEffect({ saturation: params.saturation })
const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false })
grain.blendMode.opacity.value = params.grain
// ⚠️ UN SEUL ENDROIT POUR L'OFFSET DU VIGNETTAGE. Le compositeur d'affiche doit
// le RÉAPPLIQUER à l'identique sur le fichier imprimé — le pavage l'éteint,
// sinon chaque tuile reçoit son propre vignettage et l'affiche sort en damier.
// Un 0,28 recopié là-bas ne resterait juste que jusqu'au jour où celui-ci bouge.
const VIGNETTE_OFFSET = 0.28
const vignette = new VignetteEffect({ darkness: params.vignette, offset: VIGNETTE_OFFSET })
const smaa = new SMAAEffect()

// ═══════════ NEUTRALISER POUR PAVER, RÉAPPLIQUER POUR LIVRER ═══════════════
//
// `planPavage` (export-effets.js) range le vignettage et le grain dans
// `NEUTRALISER` : leur sortie dépend de la position dans la CIBLE, donc chaque
// tuile en recevrait un exemplaire entier. Les éteindre seulement livrerait UNE
// AUTRE AFFICHE — plus plate que celle validée à l'écran. Les deux gestes ne se
// séparent pas : c'est le compositeur (compositeur-affiche.js) qui les
// réapplique, une seule fois, en fractions de l'image entière.
//
// ⚠️ `darkness = 0` ÉTEINT VRAIMENT LE VIGNETTAGE, ce n'est pas un « presque ».
// Le facteur vaut `smoothstep(0.8, offset·0.799, d·(darkness + offset))` : avec
// darkness nul, l'argument plafonne à 0,707·0,28 = 0,198, sous la borne
// 0,28·0,799 = 0,224. Le lissage rend donc 1 partout, c'est-à-dire l'identité.
function neutraliserEffetsAffiche() {
  const dVignette = vignette.darkness
  const oGrain = grain.blendMode.opacity.value
  vignette.darkness = 0
  grain.blendMode.opacity.value = 0
  return function restaurer() {
    vignette.darkness = dVignette
    grain.blendMode.opacity.value = oGrain
  }
}

// ═══════════ LE FOND DE SCÈNE, TRANCHÉ COMME LE RESTE ══════════════════════
//
// ⚠️ TROUVÉ SUR LE PREMIER TIRAGE RÉEL, ET RIEN NE L'AVAIT ANNONCÉ. Le plan
// d'effets (export-effets.js) range le vignettage et le grain dans
// « neutraliser » parce qu'ils dépendent de la position dans la CIBLE. Le fond
// de scène en dépend exactement de la même façon, et il n'y figure pas : trois
// lignes en tête de background.js le disent pourtant — « three.js draws a plain
// (UV-mapped) background texture stretched to fill the viewport ». Le viewport,
// pendant un pavage, C'EST LA TUILE. Chaque tuile recevait donc le dégradé
// ENTIER, et l'affiche sortait en damier de 4 × 3 dégradés, avec deux coutures
// horizontales en travers de toute la feuille. Vu, pas déduit.
//
// ⚠️ ET ÇA NE SE NEUTRALISE PAS : le fond est DERRIÈRE le relief, le compositeur
// dessine PAR-DESSUS. L'éteindre livrerait une affiche au ciel noir. On ne
// l'éteint donc pas, ON LE TRANCHE : la texture reçoit la fraction d'elle-même
// qui revient à cette tuile-là, et le dégradé traverse l'affiche d'un bord à
// l'autre comme il traverse l'écran.
//
// La restauration est celle du cycle de `preparerTuile` : traverser, poser,
// rendre, remettre — fermé sur chaque tuile.
function cadrerFondPourTuile(fenetre) {
  const tex = scene.background
  // Une couleur unie (`Color`) n'a ni `repeat` ni `offset`, et n'a pas ce défaut :
  // elle est la même partout. Rien à faire, et surtout rien à casser.
  if (!tex?.isTexture || !tex.repeat || !tex.offset || !fenetre?.fullWidth) return null
  const { fullWidth: W, fullHeight: H, offsetX, offsetY, width, height } = fenetre
  const repeatAvant = tex.repeat.clone()
  const offsetAvant = tex.offset.clone()
  tex.repeat.set(width / W, height / H)
  // ⚠️ L'AXE VERTICAL EST INVERSÉ. L'origine d'une texture est en BAS à gauche,
  // celle du plan de tuiles en HAUT à gauche : prendre `offsetY / H` tel quel
  // retournerait le dégradé de haut en bas, ce qui ne se voit que sur un fond
  // asymétrique — c'est-à-dire tous sauf celui qu'on regarde en premier.
  tex.offset.set(offsetX / W, 1 - (offsetY + height) / H)
  return {
    restaurer() {
      tex.repeat.copy(repeatAvant)
      tex.offset.copy(offsetAvant)
    },
  }
}

// Le logo de l'acheteur, prêt à être dessiné sur un canevas 2D. `null` si rien
// n'a été importé, ou si l'image refuse de se décoder — un logo illisible ne
// doit pas faire perdre l'affiche.
async function chargerLogoAffiche(url) {
  if (!url) return null
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } catch {
    console.warn('[ShibuMap] compositeur : le logo importé ne se décode pas, l’affiche part sans lui.')
    return null
  }
}

composer.addPass(new EffectPass(camera, exposureFx, toneMap, hueSat, contrastFx, grain, vignette, smaa))
// only builds the pass if bokeh is actually on at boot (it is not, by default)
setDofEnabled(params.bokehEnabled && params.bokehScale > 0)

// ------------------------------------------------------------------ pointer

const mouse = new THREE.Vector2(0, 0)
const focusRay = new THREE.Raycaster() // reused for pointer autofocus
const _pickNdc = new THREE.Vector2() // scratch NDC for modes' pointUnder hook
// ⚡ **LE POINTEUR EST-IL SUR LA TOILE ?** — règle D20, réponse 2 : la mise au
// point suit le pointeur TANT QU'IL VISE LE RENDU ; sur un panneau, hors de la
// fenêtre ou onglet quitté, elle glisse vers le centre de l'écran (voir le
// tick, `viseeFocus`). Posé ici parce que c'est le seul écouteur qui voit la
// souris partout, panneaux compris.
let pointeurSurToile = false
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1
  const ny = -((e.clientY / window.innerHeight) * 2 - 1)
  mouse.set(nx, ny)
  pointeurSurToile = viseLeCanevas3D(e.target, renderer.domElement)
  // ⚠️ GARDE STRUCTURELLE (task 13, RÉGRESSION CORRIGÉE) — voir viseLeCanevas3D
  // dans gpx.js pour le pourquoi complet. Cet écouteur est posé sur `window`
  // (pas sur le canevas 3D) parce qu'il doit connaître la souris même hors du
  // rendu, pour l'autofocus du bokeh plus bas. Mais ça veut dire qu'il reçoit
  // AUSSI les mouvements qui bullent depuis un panneau DOM empilé par-dessus
  // le rendu (le profil du parcours, entre autres) — sans cette garde, le
  // picking 3D ci-dessous se relançait pour rien à chacun de ces mouvements,
  // ratait systématiquement (rien à toucher sous un panneau DOM) et écrasait
  // hoverIdx à -1 dans le MÊME tick que le survol légitime du profil (task
  // 12), avant tout repaint : le réticule, l'infobulle et le carnet ne
  // s'affichaient donc plus jamais hors lecture.
  if (modes && modes.mode === 'surface' && viseLeCanevas3D(e.target, renderer.domElement)) {
    gpxLayer.pointerMove(mouse, e.clientX, e.clientY)
    // ⚠️ SEULE AFFORDANCE DU CLIC-POUR-REPRENDRE (task 9) — hoverIdx vient
    // d'être tenu à jour ci-dessus par le picking 3D déjà en place
    // (GpxLayer.pointerMove) : rien n'annonçait que le ruban est cliquable,
    // d'où ce curseur, réinitialisé en dehors du survol pour ne pas rester
    // collé une fois la souris repartie.
    renderer.domElement.style.cursor = gpxLayer.activeLayer?.gpx?.hoverIdx >= 0 ? 'pointer' : ''
  } else if (renderer.domElement.style.cursor) {
    renderer.domElement.style.cursor = ''
  }
})

// le pointeur qui QUITTE la fenêtre (`relatedTarget` nul) ou l'onglet : la
// mise au point se replie au centre — en glissant, pas d'un coup
window.addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointeurSurToile = false })
window.addEventListener('blur', () => { pointeurSurToile = false })

// click-to-dive: a plain click on the map (NOT an orbit drag) plunges one level
// onto the point under the cursor — march the height field for the hit, convert
// to lat/lon, dive there keeping the view axis (see modes.diveTo). A drag past a
// few px, a long press, or a click on any DOM overlay (panels/markers, which sit
// above the canvas) never reaches here.
let _clickDownX = 0, _clickDownY = 0, _clickDownT = 0, _clickArmed = false, _clickMulti = false
const _clickNdc = new THREE.Vector2()
const _globeHit = new THREE.Vector3() // point du globe sous le doigt (sphereToLatLon veut un Vector3)
renderer.domElement.addEventListener('pointerdown', (e) => {
  // Un second doigt qui se pose DÉSARME l'appui en cours : c'est un pincement
  // ou un déplacement à deux doigts, pas une désignation. Sans ça, relâcher un
  // pincement faisait plonger la carte sur le point du premier doigt.
  if (!e.isPrimary) { _clickMulti = true; return }
  _clickArmed = e.button === 0
  _clickMulti = false
  _clickDownX = e.clientX
  _clickDownY = e.clientY
  _clickDownT = performance.now()
})
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!_clickArmed || e.button !== 0) return
  _clickArmed = false
  const moved = Math.hypot(e.clientX - _clickDownX, e.clientY - _clickDownY)
  // le seuil de dérive dépend de CE QUI a touché l'écran (voir gestes.js) :
  // 6 px pour une souris, 14 pour un doigt, qui roule en s'écrasant
  if (!isTap({ moved, elapsedMs: performance.now() - _clickDownT, pointerType: e.pointerType, multiTouch: _clickMulti })) return
  if (!modes || modes.busy || modes.travel) return
  _clickNdc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
  // ══════════ EN ORBITE : LE CLIC DÉSIGNE UN LIEU SUR LA PLANÈTE ════════════
  //
  // Adrien : « Quand je suis en orbite, cliquer me fait zoomer sur la zone sur
  // laquelle je clique, exactement à l'endroit où j'ai cliqué, qui sera au
  // centre. »
  //
  // ⚠️ ON COUPE LA SPHÈRE, ON NE RAYCASTE PAS LE MAILLAGE DU GLOBE. Le globe est
  // un objet à géométrie variable (dalles, nuages, orbe de chargement) dont
  // l'altitude de surface n'est pas R_GLOBE partout ; `sphereToLatLon` attend
  // justement un point de la sphère IDÉALE, la même que `latLonToSphere` a
  // servi à poser la caméra. Passer par le maillage rendrait un lat/lon décalé
  // du relief du globe, et un raycast d'un million de triangles pour rien.
  if (modes.mode === 'orbital') {
    focusRay.setFromCamera(_clickNdc, camera)
    const p = intersectionGlobe(focusRay.ray.origin, focusRay.ray.direction, R_GLOBE)
    if (!p) return // clic dans le noir, à côté du disque de la planète
    const { lat, lon } = sphereToLatLon(_globeHit.set(p.x, p.y, p.z))
    // en orbite le cadrage du damier est déjà rendu (la porte orbitale le rend
    // en partant) : ce rappel ne coûte rien et fait de la règle une règle SANS
    // exception — « toute porte rend d'abord », pas « toute porte sauf celles
    // dont on a vérifié qu'elles arrivent après une autre ».
    quitteCadrageDamier()
    modes.plongeDepuisGlobe(lat, lon)
    return
  }
  if (modes.mode !== 'surface') return
  // ⚠️ LE CLIC SUR LE RUBAN REPREND LA LECTURE, ET PASSE AVANT LA PLONGÉE
  // (task 9). hoverIdx est déjà tenu à jour en continu par le picking 3D du
  // survol (pointermove ci-dessus, GpxLayer.pointerMove) : pas de second
  // raycast ici, juste la MÊME conversion distance que partout ailleurs dans
  // l'affichage (cumKm[i]/totKm) — hoverIdx désigne déjà un sommet réel, pas
  // besoin d'indexALAbscisse qui va dans l'autre sens (fraction -> sommet).
  //
  // ⚠️ hoverIdx SEUL NE SUFFIT PLUS (relecture finale, 2026-08-04, BLOQUANT).
  // hoverIdx a DEUX écrivains — le picking souris ci-dessus ET la tête de
  // lecture, qui le réécrit CHAQUE IMAGE pendant qu'elle joue (gpx.js,
  // _updateHead). Un rAF s'intercale TOUJOURS entre le pointerdown et le
  // pointerup d'un clic : `hoverIdx >= 0` seul restait donc vrai en
  // PERMANENCE pendant la lecture, quel que soit ce qu'il y avait sous le
  // curseur — chaque clic (y compris loin du tracé, destiné à plonger sur le
  // terrain) relançait `seekAndResumeCourse`, qui réinitialise la poursuite
  // caméra via `engageGpxFollow` → `pilote.lancerPoursuite()`. `_survolSouris`
  // (posé par GpxLayer.setHover, voir gpx.js) distingue les deux écrivains ;
  // `doitReprendreLaLecture` (clic-ruban.js, testé) encode la garde complète —
  // voir ce fichier pour le détail, et test/clic-ruban.test.js pour le
  // scénario qui verrouille « en lecture, un clic hors du ruban plonge ».
  const traceGpx = gpxLayer.activeLayer?.gpx
  const traceHoverIdx = traceGpx?.hoverIdx ?? -1
  const traceCumKm = traceGpx?.track?.cumKm
  const traceTotKm = traceCumKm?.length ? traceCumKm[traceCumKm.length - 1] : 0
  if (doitReprendreLaLecture({ survolSouris: traceGpx?._survolSouris, hoverIdx: traceHoverIdx, totKm: traceTotKm })) {
    seekAndResumeCourse(traceCumKm[traceHoverIdx] / traceTotKm)
    return
  }
  if (params.source !== 'real' || !dem || params.demZoom >= userFineZoom) return // already at finest detail
  focusRay.setFromCamera(_clickNdc, camera)
  const hitDist = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, { halfExtent: TERRAIN_SIZE / 2 })
  if (hitDist == null) return // clicked the sky or off-map
  const px = focusRay.ray.origin.x + focusRay.ray.direction.x * hitDist
  const py = focusRay.ray.origin.y + focusRay.ray.direction.y * hitDist
  const pz = focusRay.ray.origin.z + focusRay.ray.direction.z * hitDist
  const { lat, lon } = worldToLatLon(dem, px, pz)
  // ⚠️ LE CLIC-PLONGÉE REND D'ABORD L'EMPRUNT DU CADRAGE. `_loadDive` (modes.js)
  // repose bien `maxDistance` en arrivant, mais PAS `near`/`far` — il ne les a
  // pas touchés. Plonger depuis le cadrage laissait donc un plan de coupe à
  // ≈ 122 unités sur une caméra revenue à ~145 : la carte arrivait tranchée.
  quitteCadrageDamier()
  // pass the clicked world point so the dive leans 30% toward it before loading
  modes.diveTo({ lat, lon, zoom: stepZoom(params.demZoom, 1, userFineZoom), point: new THREE.Vector3(px, py, pz) })
})

// ══════════════════════ LA FENÊTRE CONTINUE 3×3 — JALON 1 ═══════════════════
//
// Le plus petit drag qui marche. But unique : qu'on SENTE le déplacement. Ni
// champs, ni calques, ni finition — la question à trancher est celle du §7 de
// l'étude (le geste vaut-il le coup ?), et rien d'autre ne compte tant qu'elle
// n'a pas de réponse.
//
// Le geste est au CLIC DROIT, et c'est un choix contraint, pas une préférence :
// le clic gauche est DÉJÀ pris deux fois — rotation orbitale (OrbitControls) et
// plongée au point cliqué (juste au-dessus). Le clic droit, lui, ne sert qu'au
// pan d'OrbitControls, qu'on désactive ici puisque le mode continu le remplace.

// ══════════ QUI ALLUME LE MODE — l'adresse, la machine, l'interrupteur ══════
//
// La RÈGLE est dans `fenetre-reglage.js` (pure, testée) ; ici il n'y a que la
// plomberie : aller chercher les trois entrées et mémoriser le verdict.
//
// ⚠️ LE VERDICT EST CALCULÉ UNE FOIS, PAS PAR IMAGE. La version d'avant
// reconstruisait un `URLSearchParams` à CHAQUE appel — c'est-à-dire à chaque
// image (`f3Tick`) et à chaque `pointermove` d'un drag. Parser une chaîne
// d'adresse 60 fois par seconde pour relire une constante était un coût sans
// contrepartie ; `_f3Force` et `_f3Etat` le suppriment.
//
// ⚠️ `let`, ET IL EST REMIS À `null` À LA PREMIÈRE BASCULE. L'adresse pose
// l'état INITIAL, elle ne verrouille pas : Adrien ouvre le serveur par une URL
// qui porte `?f3=1` et se retrouvait ENFERMÉ dans le mode continu, l'interrupteur
// des Paramètres grisé. Un banc n'a besoin que de démarrer dans le bon mode ; il
// n'a jamais eu besoin d'interdire la sortie. L'oubli se fait dans `f3Applique`.
let _f3Force = forceUrl(new URLSearchParams(location.search).get('f3'))

// La préférence de l'utilisateur, ou `null` s'il n'a jamais touché
// l'interrupteur — auquel cas c'est `FLAGS.fenetreContinue` qui parle. Le
// `null` compte : « jamais touché » et « explicitement éteint » doivent se
// distinguer, sinon le jour où le défaut passera à `true`, il ne s'appliquerait
// à personne ayant déjà ouvert l'application.
const F3_PREF_KEY = 'shibumap.fenetre-continue'
function f3Preference() {
  try {
    const v = localStorage.getItem(F3_PREF_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

const f3Args = () => ({ force: _f3Force, prefere: f3Preference(), defaut: FLAGS.fenetreContinue, machine: MACHINE })

// Le verdict du démarrage. Il est FIGÉ pour la durée de la session parce que
// tout en dépend au chargement : l'emprise 3×3 (neuf MNT au lieu d'un), la
// découpe locale du renderer, l'épaisseur du socle. Changer d'avis en cours de
// route veut dire RECHARGER la zone — c'est ce que fait l'interrupteur, en
// réécrivant cette variable puis en rappelant `loadRealTerrain`.
let _f3Etat = continuActif(f3Args())

// Une fonction DÉCLARÉE (donc hissée) : `fetchAndBuildDem` l'appelle et se
// trouve plus haut dans le fichier.
function fenetreContinueActive() {
  return _f3Etat
}

// ══════════ LA DÉCOUPE LOCALE, ALLUMÉE AVEC LE MODE ═══════════════════════
//
// Les calques du sol (rivières, lacs, plans d'eau) sont construits sur
// l'emprise 3×3 entière et coupés à la fenêtre par huit plans de coupe
// (src/fenetre-clip.js). Ces plans sont posés MATÉRIAU PAR MATÉRIAU, donc il
// faut que three.js les regarde — c'est ce que dit cet interrupteur.
//
// ⚠️ Il n'a AUCUN effet sur un matériau sans `clippingPlanes` : three.js ne
// génère le code de coupe qu'à partir de NUM_CLIPPING_PLANES > 0. Le terrain,
// le socle, la mer et le ciel ne sont donc pas concernés. Il est quand même
// posé sous condition, pour que le mode ordinaire n'ait pas à faire confiance
// à cette phrase.
if (fenetreContinueActive()) renderer.localClippingEnabled = true

// ══════════ L'INTERRUPTEUR DES PARAMÈTRES ═══════════════════════════════════
//
// Adrien : « je veux pouvoir basculer sans URL ». Il vit dans la roue crantée,
// avec les réglages globaux de performance — c'est bien ce que c'est.
//
// ⚠️ BASCULER VEUT DIRE RECHARGER LA ZONE, et il n'y a pas de raccourci. Le
// mode continu ne se pose pas par-dessus le mode ordinaire : il charge NEUF
// MNT au lieu d'un, recolle une emprise, cuit un atlas de champs sur cette
// emprise et cale le socle sur le point bas des neuf. Rien de tout ça ne
// s'improvise sur un terrain déjà bâti. On repasse donc par `loadRealTerrain`,
// exactement comme un changement de zoom.
//
// ⚠️ ET LA DÉCOUPE LOCALE NE S'ÉTEINT PAS. `localClippingEnabled` fait
// recompiler tous les shaders quand il change ; l'allumer sur un mode ordinaire
// ne coûte rien (aucun matériau n'y porte de `clippingPlanes`, three.js ne
// génère alors aucun code de coupe), alors que l'éteindre puis le rallumer
// paierait deux recompilations complètes pour un aller-retour d'interrupteur.
// On l'allume donc pour de bon à la première activation, et on ne le reprend
// jamais.
function f3Applique(prefere) {
  try {
    localStorage.setItem(F3_PREF_KEY, prefere ? '1' : '0')
  } catch { /* navigation privée : le réglage ne survivra pas à l'onglet, tant pis */ }
  // ⚠️ L'ADRESSE EST OUBLIÉE ICI, ET C'EST TOUT LE CORRECTIF. Tant que
  // `_f3Force` vaut autre chose que `null`, `continuActif` lui obéit et la
  // préférence qu'on vient d'écrire ne changerait rien — l'interrupteur
  // cliquerait dans le vide. On la lâche au premier geste : le paramètre
  // décrivait un DÉPART, le visiteur vient de dire où il veut aller.
  _f3Force = null
  const avant = _f3Etat
  _f3Etat = continuActif(f3Args())
  if (_f3Etat === avant) return false
  if (_f3Etat) renderer.localClippingEnabled = true
  // ⚠️ `enablePan` N'EST PLUS JAMAIS ÉTEINT — ET C'EST LA CORRECTION.
  // L'ancien code le coupait pour reprendre le clic droit à OrbitControls, et
  // devait ensuite le rallumer ici à la main. Mais `enablePan` est un
  // interrupteur GLOBAL : couper le clic droit coupait du même coup le bouton
  // du milieu et le repli Maj+gauche, c'est-à-dire TOUT le déplacement de
  // caméra. C'est la perte qu'Adrien a signalée. Le clic droit se reprend
  // maintenant bouton par bouton (appliqueBoutonsSouris), il n'y a donc plus
  // rien à rallumer : le déplacement n'a jamais été éteint.
  // On force tout de même une passe immédiate — le remappage est fait par
  // image, mais l'utilisateur vient de cliquer et ne doit pas attendre.
  appliqueBoutonsSouris()
  // Le geste en cours n'a plus de sens sur un terrain qui va disparaître.
  _f3Glisse = false
  _f3V.x = _f3V.z = 0
  _f3Ech.length = 0
  _f3Brut.x = _f3Brut.z = 0
  terrain.fenetre.x = 0
  terrain.fenetre.z = 0
  if (params.source === 'real') loadRealTerrain()
  // La bascule vient de changer quelque chose que rien à l'écran n'explique :
  // le clic droit ne fait plus la même chose, et aucun libellé ne le dit. La
  // bulle se pose ici (ui/aides.js décide si elle a déjà été acquittée), et
  // s'efface d'elle-même quand on éteint — une consigne pour un mode éteint
  // serait une consigne fausse.
  evalueAide('fenetre-3x3', _f3Etat)
  return true
}

// Le décalage BRUT, celui qui mémorise le geste au-delà de la butée. L'affiché
// vit dans `terrain.fenetre` ; ces deux-là ne sont égaux que dans la course.
// ⚠️ Le brut est gardé à part exprès : c'est lui que lirait un futur
// recentrage de l'emprise pour savoir de combien on a voulu aller plus loin.
// La porte du rechargement reste ouverte, comme Adrien l'a demandé.
const _f3Brut = { x: 0, z: 0 }
let _f3Glisse = false // un bouton droit est-il enfoncé ?
let _f3Sale = true // la géométrie doit-elle être réécrite à la prochaine image ?
let _f3X = 0
let _f3Y = 0

// L'ÉLAN. `_f3V` est la vitesse restante en unités monde par seconde ; elle ne
// vit qu'entre le lâcher et l'extinction. `_f3Ech` est la trace des dernières
// positions AFFICHÉES, celle que `vitesseAuLache` lit au relâchement.
//
// ⚠️ ON ÉCHANTILLONNE L'AFFICHÉ, PAS LE BRUT. Au bord, le brut continue de filer
// avec le geste alors que l'image ne bouge plus (l'hyperbole la comprime) :
// mesurer le brut donnerait un lancer énorme là où l'œil vient de voir le
// terrain s'arrêter. Voir l'en-tête de fenetre-elan.js.
const _f3V = { x: 0, z: 0 }
const _f3Ech = []

// L'état de la finesse du maillage (fenetre-finesse.js). `?f3trace=1` fait dire
// à chaque bascule ce qu'elle a coûté — c'est la mesure d'Adrien, pas un débogage
// oublié : sans elle on ne saurait pas si le raffinement tient dans une image.
let _f3Fin = finesseInitiale()
const F3_TRACE = new URLSearchParams(location.search).get('f3trace') === '1'
// Trois images de trace suffisent à `vitesseAuLache` (fenêtre de 60 ms) ; on en
// garde huit pour couvrir un écran à 120 Hz sans jamais allouer.
const F3_ECH_MAX = 8

function f3Echantillonne(tMs) {
  _f3Ech.push({ t: tMs / 1000, x: terrain.fenetre.x, z: terrain.fenetre.z })
  if (_f3Ech.length > F3_ECH_MAX) _f3Ech.shift()
}

// Unités monde par pixel d'écran. Le socle fait TERRAIN_SIZE unités ; on veut
// qu'un glissement d'un bord à l'autre de la fenêtre déplace le terrain d'un
// socle. `innerHeight` plutôt que `innerWidth` : la vue est en trois quarts, la
// dimension verticale est celle qui cadre le bloc.
const f3ParPixel = () => TERRAIN_SIZE / Math.max(1, window.innerHeight)

// ══════════ QUI TIENT QUEL BOUTON — ET CE QU'ADRIEN AVAIT PERDU ═════════════
//
// « L'ancien déplacement par clic droit n'existe plus, je ne peux plus me
// déplacer de cette façon. » (Adrien, après essai du mode continu.)
//
// La cause n'était pas le partage du clic droit, c'était la MÉTHODE. Ce tick
// éteignait `controls.enablePan` à chaque image pour empêcher OrbitControls de
// voler le geste — mais `enablePan` est un interrupteur GLOBAL : il gouverne le
// clic droit, ET le bouton du milieu, ET le repli Maj+gauche. En le coupant, on
// ne retirait pas un bouton au déplacement, on retirait le déplacement.
//
// On ne coupe donc plus une capacité, on rend un seul BOUTON inerte (-1, la
// valeur qu'OrbitControls emploie lui-même pour « aucune action »). Le reste
// survit — voir boutons-camera.js pour les deux liaisons constantes et pour la
// preuve que le bouton du milieu était libre (enableZoom faux partout).
//
// Appliqué PAR IMAGE, comme l'ancien `enablePan` : `modes` retraverse ses
// réglages à chaque entrée en surface, et une bascule de mode ne notifie
// personne. L'assignation est gardée — trois comparaisons d'entiers.
let _boutonsDroit = null
function appliqueBoutonsSouris() {
  const m = versTroisJs(
    boutonsSouris({ continu: fenetreContinueActive(), surface: modes?.mode === 'surface' }),
    THREE.MOUSE
  )
  if (m.RIGHT === _boutonsDroit) return
  _boutonsDroit = m.RIGHT
  controls.mouseButtons = m
}
appliqueBoutonsSouris()

renderer.domElement.addEventListener('contextmenu', (e) => {
  if (fenetreContinueActive() && modes?.mode === 'surface') e.preventDefault()
})

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 2 || !fenetreContinueActive()) return
  if (!modes || modes.mode !== 'surface' || modes.busy || modes.travel) return
  _f3Glisse = true
  _f3X = e.clientX
  _f3Y = e.clientY
  // ⚠️ REPRENDRE LE TERRAIN ÉTEINT L'ÉLAN SUR-LE-CHAMP. Rattraper un terrain qui
  // glisse encore est le geste réflexe ; s'il continuait ne serait-ce qu'une
  // image sous le doigt, tout le geste suivant partirait décalé d'autant.
  _f3V.x = 0
  _f3V.z = 0
  // Et le brut se recale : l'élan a pu le laisser hors course, or le geste doit
  // repartir de ce que l'œil VOIT, pas d'une position mémorisée invisible.
  _f3Brut.x = terrain.fenetre.x
  _f3Brut.z = terrain.fenetre.z
  _f3Ech.length = 0
  f3Echantillonne(e.timeStamp)
  renderer.domElement.setPointerCapture?.(e.pointerId)
})

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!_f3Glisse) return
  const k = f3ParPixel()
  // ⚠️ LE SIGNE. On déplace le CONTENU, pas la caméra : tirer vers la droite
  // doit amener le terrain de GAUCHE, donc la fenêtre de lecture va vers la
  // gauche. Un signe inversé ici donne un geste qui « colle » à l'envers — le
  // défaut le plus immédiatement détestable d'une carte.
  //
  // ⚠️ ET LES AXES SONT CEUX DE LA CAMÉRA, PAS DU MONDE. La vue est orbitale :
  // à 180° d'azimut, un geste vers la droite devrait toujours amener le terrain
  // de gauche À L'ÉCRAN. On projette donc le geste sur les axes horizontaux de
  // la caméra.
  const dxPx = (e.clientX - _f3X) * k
  const dyPx = (e.clientY - _f3Y) * k
  _f3X = e.clientX
  _f3Y = e.clientY
  // droite de la caméra, aplatie au plan du sol et renormalisée
  const cx = camera.matrixWorld.elements[0]
  const cz = camera.matrixWorld.elements[2]
  const n = Math.hypot(cx, cz) || 1
  const rx = cx / n
  const rz = cz / n
  // « avant » au sol = la droite tournée d'un quart de tour
  const geste = { x: -(dxPx * rx - dyPx * rz), z: -(dxPx * rz + dyPx * rx) }
  const r = avanceFenetre(_f3Brut, geste, COURSE_ELASTIQUE)
  _f3Brut.x = r.brutX
  _f3Brut.z = r.brutZ
  terrain.fenetre.x = r.x
  terrain.fenetre.z = r.z
  _f3Sale = true
  f3Echantillonne(e.timeStamp)
})

// `lance` distingue le relâchement volontaire de l'annulation. Un
// `pointercancel` (geste capté par le système, fenêtre perdue) n'a pas de fin de
// geste à lire : lancer le terrain sur une trace tronquée le ferait partir tout
// seul sans que personne n'ait rien demandé.
const f3Lache = (e, lance) => {
  if (!_f3Glisse) return
  _f3Glisse = false
  const v = lance ? vitesseAuLache(_f3Ech, e.timeStamp / 1000) : { x: 0, z: 0 }
  _f3V.x = v.x
  _f3V.z = v.z
  _f3Ech.length = 0
  // Le brut se recale sur l'affiché : sans ça, on aurait poussé 400 unités au
  // bord, et le geste suivant devrait d'abord « rembobiner » ces 400 unités
  // avant que le terrain ne bouge — il paraîtrait bloqué. C'est aussi le point
  // de départ que l'élan doit intégrer : il continue ce que l'œil a vu.
  _f3Brut.x = terrain.fenetre.x
  _f3Brut.z = terrain.fenetre.z
}
renderer.domElement.addEventListener('pointerup', (e) => f3Lache(e, true))
renderer.domElement.addEventListener('pointercancel', (e) => f3Lache(e, false))

// Le pas par image : le rappel élastique, puis la réécriture du relief.
// Appelé depuis `tick`, après `updateCameraMotion`.
function f3Tick(dt) {
  if (!fenetreContinueActive() || !(dem?.empriseCote > 1)) return
  if (!_f3Glisse) {
    // ⚠️ L'ÉLAN ET LE RAPPEL NE TOURNENT JAMAIS ENSEMBLE — d'où le `else`. Les
    // faire cohabiter les mettrait en tir à la corde au bord : l'un pousse
    // dehors, l'autre tire dedans, et la fenêtre vibrerait entre les deux. La
    // passation est nette : l'absorption tue l'élan en ~0,15 s, le rappel prend
    // la main à l'image d'après, depuis la position exacte où l'élan l'a laissée.
    if (_f3V.x !== 0 || _f3V.z !== 0) {
      const r = pasElan({ x: _f3Brut.x, z: _f3Brut.z, vx: _f3V.x, vz: _f3V.z }, dt, COURSE_ELASTIQUE)
      _f3Brut.x = r.brutX
      _f3Brut.z = r.brutZ
      _f3V.x = r.vx
      _f3V.z = r.vz
      if (r.x !== terrain.fenetre.x || r.z !== terrain.fenetre.z) {
        terrain.fenetre.x = r.x
        terrain.fenetre.z = r.z
        _f3Sale = true
      }
      // L'élan éteint, le brut redevient l'affiché. Sans ce recalage, un lancer
      // absorbé aurait laissé le brut à des centaines d'unités hors course, et
      // `rappelElastique` — qui lit l'affiché — travaillerait sur une position
      // que plus personne ne met à jour.
      if (!r.actif) {
        _f3Brut.x = r.x
        _f3Brut.z = r.z
      }
    } else {
      const ax = rappelElastique(terrain.fenetre.x, COURSE_ELASTIQUE, dt)
      const az = rappelElastique(terrain.fenetre.z, COURSE_ELASTIQUE, dt)
      if (ax !== terrain.fenetre.x || az !== terrain.fenetre.z) {
        terrain.fenetre.x = ax
        terrain.fenetre.z = az
        _f3Brut.x = ax
        _f3Brut.z = az
        _f3Sale = true
      }
    }
  }
  // ══════════ LA FINESSE : 384 EN MOUVEMENT, 768 UNE FOIS POSÉ ═════════════
  //
  // ⚠️ LA DÉCISION SE PREND SUR L'AFFICHÉ, PAS SUR `_f3V`. `pasElan` annule la
  // vitesse sous V_ARRET et c'est `rappelElastique` qui finit le travail — or
  // celui-ci n'a AUCUNE variable de vitesse, il écrit la position. Passer
  // `_f3V` ici raffinerait en plein glissement. `pasFinesse` fait donc la
  // dérivée de `terrain.fenetre` lui-même, et couvre du même coup les trois
  // régimes (geste, élan, rappel). Voir l'en-tête de fenetre-finesse.js.
  //
  // ⚠️ ET C'EST PLACÉ APRÈS le déplacement de cette image, pas avant : décider
  // sur la position de l'image PRÉCÉDENTE ferait tomber la première image d'un
  // geste au grossier une image trop tard — celle-là même qu'on essaie de
  // sauver.
  _f3Fin = pasFinesse(_f3Fin, { glisse: _f3Glisse, x: terrain.fenetre.x, z: terrain.fenetre.z, dt })
  let refait = false
  if (_f3Fin.change) {
    terrain.resFenetre = resDeFinesse(_f3Fin.fin, params.resolution, RES_FENETRE_CONTINUE)
    const ms = terrain.majResFenetre(params)
    refait = true
    if (F3_TRACE) console.info(`[f3] maillage → res ${terrain.resFenetre} en ${ms.toFixed(1)} ms`)
  }
  // ⚠️ ON N'ÉCRIT PAS LE RELIEF DEUX FOIS DANS LA MÊME IMAGE. `majResFenetre`
  // vient de faire, sur la géométrie neuve, EXACTEMENT le travail de
  // `tickFenetre` (même `_ecrireRelief`, même `_pousseFenetre`, même `sample`).
  // Enchaîner les deux ajoutait 43 ms à res 768 et 15 ms à res 384 — et les
  // 15 ms tombaient sur l'image du PREMIER PAS du geste, celle qu'on descend en
  // résolution précisément pour la sauver. Le socle et les calques, eux, doivent
  // suivre dans les deux cas : ils repartent du `terrain.sample` tout neuf.
  // ══════════ LA LÉGENDE SE MET D'ACCORD AVEC LE RELIEF, APRÈS LUI ═══════════
  //
  // ⚠️ AVANT LA SORTIE ANTICIPÉE, et c'est tout l'inverse d'un détail : le
  // rafraîchissement se déclenche AU REPOS, or au repos `_f3Sale` est faux et
  // la fonction sort deux lignes plus bas. Placé après, il ne serait évalué
  // qu'aux images où le terrain bouge — c'est-à-dire jamais quand il le faut.
  //
  // La règle (ground-info.js) impose le repos pour deux raisons, et la première
  // suffirait : le cartouche interroge Nominatim et Wikipédia, on ne les
  // appelle pas pendant un geste. La seconde est de lisibilité — on voit le
  // relief se poser, PUIS la légende le rattraper ; l'ordre inverse ferait
  // clignoter un texte sous un terrain qui glisse.
  //
  // ⚠️ ET LE COMPARATEUR EST `lastFenetre`, PAS la position de chargement de la
  // zone. Le seuil est un quart de socle CUMULÉ depuis le dernier cartouche
  // posé, sans quoi trois glissements d'un cinquième de socle chacun — 12 km à
  // z12 — ne déclencheraient jamais rien.
  if (
    params.groundInfo &&
    doitRafraichirCartouche({
      derniere: groundInfo.lastFenetre,
      courante: terrain.fenetre,
      repos: _f3Fin.fin,
      tailleSocle: TERRAIN_SIZE,
    })
  ) {
    chargeCartouche()
  }
  if (!_f3Sale && !refait) return
  _f3Sale = false
  if (!refait) terrain.tickFenetre(params)
  // Le socle SUIT — il ne lit que `terrain.sample`, qui porte déjà le décalage.
  //
  // ⚠️ CE N'EST PAS 2,2 ms, C'EST LE POSTE LE PLUS CHER DE LA BOUCLE. Le chiffre
  // de 2,2 ms qui vivait ici (et dans fenetre-elan.js) n'a jamais été mesuré sur
  // ce chemin ; la campagne de la Tâche 12 chiffrait déjà le MÊME appel à 26,2 ms
  // sur le bloc central, et personne n'avait rapproché les deux. Balayage refait
  // le 2026-08-05 (Ryzen 9 5900X, node, `buildSlabWalls` réelle — voir
  // .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-socle-fenetre.mjs) :
  //
  //     res 128 → 5,5 ms │ 256 → 8,7 ms │ 384 → 14,6 ms │ 768 → 24,5 ms
  //
  // Le socle suit désormais la MÊME dégradation que le relief (`resMaillage`,
  // plinth.js) : 14,6 ms tant que l'image bouge au lieu de 24,5. Une image de
  // glissement vaut donc ~24 ms (9,9 de `tickFenetre` + 14,6), et non 12.
  //
  // Le refaire à chaque pas reste le bon choix — un socle qui ne suivrait pas le
  // relief se verrait immédiatement —, mais c'est un choix CHER, et le garde
  // au-dessus (`_f3Sale`) est ce qui l'empêche de coûter au repos.
  plinth.rebuild(terrain, params, socleEmprise())
  f3CalquesSuivent()
}

// ══════════ LES CALQUES ANCRÉS AU SOL SUIVENT LE TERRAIN ═══════════════════
//
// Adrien, après le jalon 1 : « il n'y a que le relief qui bouge, et tout le
// reste reste fixe ». Un nom de ville qui reste planté au milieu de l'écran
// pendant que sa vallée s'en va, c'est la carte qui ment.
//
// LA RÈGLE TIENT EN UNE LIGNE, et c'est ce qui la rend sûre : ces calques ont
// leur géométrie cuite en coordonnées de CHAMP (celles que rend
// `geo.latLonToWorld`), et la fenêtre est le décalage entre le champ et la
// géométrie. Translater le groupe de −fenêtre les remet donc EXACTEMENT sur
// leur point du sol. Aucune géométrie n'est refaite, aucun objet réalloué :
// deux écritures de `position` par image.
//
// ⚠️ ET SEULEMENT LES CALQUES DU SOL. Ce qui appartient à la FENÊTRE — le
// socle, les étiquettes de décor du socle, le HUD, le ciel — ne doit surtout
// pas bouger : ce sont les meubles, pas le paysage.
//
// ⚠️ LES NOMS HORS FENÊTRE SONT MASQUÉS PAR `_declutter`, pas ici. Les lieux
// sont choisis sur toute l'emprise, soit neuf fois la surface visible ; sans ce
// rejet, huit neuvièmes d'entre eux flotteraient au-delà du bord du socle,
// au-dessus du vide.
function f3CalquesSuivent() {
  const f = terrain.fenetre
  if (!f) return
  for (const c of [mapLayers?.places, mapLayers?.water]) {
    if (c?.group) c.group.position.set(-f.x, 0, -f.z)
  }
  mapLayers?.places?.refresh?.()
  // Les traces GPX : chacune porte sa propre translation (elles ont leur groupe)
  // et masque ses étiquettes hors socle. La LIGNE, elle, est écrêtée par les
  // plans de coupe posés à sa construction — le GPU la coupe au bord, pour rien.
  for (const l of gpxLayer?.layers ?? []) l.gpx?.setFenetre?.(f.x, f.z)
  // ══════════ CE QUI VOLE SUIT AUSSI, MAIS N'EST PAS ÉCRÊTÉ ═════════════════
  //
  // Adrien : « aucun problème si la montgolfière ou l'avion est en dehors du
  // socle, c'est le comportement attendu. » Leur groupe porte −fenêtre pour
  // qu'ils DÉRIVENT avec le paysage ; rien ne les enferme.
  traffic?.setFenetre?.(f.x, f.z)
  // ⚠️ LA FLOTTE, ELLE, NE TRANSLATE PAS SON GROUPE. La houle est lue dans le
  // shader du bateau à `instanceMatrix[3].xz` : un groupe translaté lui aurait
  // donné la vague d'un autre endroit que celle que la mer dessine sous lui.
  // C'est l'écriture des matrices qui ramène le champ dans la géométrie.
  boats?.setFenetre?.(f.x, f.z)
  // Les nuages appartiennent au CIEL — c'est la fenêtre, ils ne bougent pas.
  // Ce qui doit suivre, c'est le RELIEF qu'ils consultent pour savoir où ils
  // sont occlus et où est leur plancher : une écriture d'uniforme.
  clouds?.setFenetre?.(f.x, f.z)
  // Les cotes d'altitude (labels.js) et les repères de points d'intérêt
  // (hud3d.js) sont PLANTÉS DANS LE SOL : ils défilent, et ils se cachent hors
  // du socle. Voir f3AncreAuSol pour la conversion de leurs coordonnées.
  f3SuitAuSol(labels, f)
  f3SuitAuSol(hud3?.pois, f)
  // ══════════ LA MER, SA JUPE ET LES LACS ═══════════════════════════════════
  //
  // La mer NE SE TRANSLATE PAS : le plan d'eau EST la fenêtre, il reste en
  // place. Ce qui défile, c'est ce qu'il LIT sous lui — fond marin, distance au
  // rivage, trait de côte. Deux flottants d'uniforme par matériau, rien de plus,
  // parce que le champ a été cuit une fois pour toutes sur l'emprise entière
  // (src/mer-emprise.js porte la mesure d'avant/après).
  //
  // ⚠️ Les LACS, eux, se translatent : ce sont des plans d'eau posés sur le
  // terrain, pas des meubles du socle. `setFenetre` fait les deux à la fois.
  realWater?.setFenetre(f.x, f.z)
}

// ══════════ POSER LA FENÊTRE D'AUTORITÉ — liens partagés, et rien d'autre ═══
//
// Un lien porte désormais la position DANS l'emprise (share-link.js, champ
// `fen`). La poser n'est pas un geste : il n'y a ni élan à hériter, ni butée à
// franchir — c'est un point de vue restauré, et il doit être là DÈS la première
// image peinte, sinon le destinataire voit le terrain glisser tout seul en
// arrivant, ce qui est exactement l'inverse de « rouvrir la même vue ».
//
// D'où l'écriture SYNCHRONE du relief plutôt qu'un `_f3Sale = true` : une image
// de retard suffirait à montrer le centre du bloc avant de sauter.
//
// ⚠️ ET `_f3Fin` EST RECALÉ SUR LA NOUVELLE POSITION. `pasFinesse` fait la
// dérivée de l'affiché : sans ce recalage il verrait un bond de 40 unités en
// une image, jugerait « ça bouge », retomberait à res 384 et remonterait à 768
// une demi-seconde plus tard — un aller-retour de maillage à 70 ms, visible, et
// pour rien. On déplace le point de comparaison avec la fenêtre, sans toucher à
// `fin` : aucune bascule n'a lieu de se déclencher.
//
// Silencieux hors mode continu : un lien fabriqué en 3×3 et ouvert sur une
// machine qui le refuse doit donner la carte, pas une erreur.
function f3PoseFenetre(fen) {
  if (!fen || !fenetreContinueActive() || !(dem?.empriseCote > 1)) return false
  f3EcritFenetre(fen)
  terrain.tickFenetre(params)
  plinth.rebuild(terrain, params, socleEmprise())
  f3CalquesSuivent()
  return true
}

// Les NOMBRES d'une pose, sans le relief — le tronc commun de `f3PoseFenetre`
// (qui repeint dans la foulée) et du centrage de chargement (qui n'a rien à
// repeindre : la reconstruction complète arrive juste derrière).
function f3EcritFenetre(fen) {
  terrain.fenetre.x = poseDansLaCourse(fen.x, COURSE_ELASTIQUE)
  terrain.fenetre.z = poseDansLaCourse(fen.z, COURSE_ELASTIQUE)
  _f3Brut.x = terrain.fenetre.x
  _f3Brut.z = terrain.fenetre.z
  _f3V.x = _f3V.z = 0
  _f3Ech.length = 0
  _f3Fin = { ..._f3Fin, x: terrain.fenetre.x, z: terrain.fenetre.z, repos: 0 }
  _f3Sale = false
}

// ══════════ LE LIEU CHERCHÉ ARRIVE AU CENTRE ════════════════════════════════
//
// Adrien : « le point recherché doit se trouver au centre de la zone qui
// s'affiche, aussi bien en vertical qu'en horizontal. Ce n'est pas le cas. »
//
// LA CAUSE est dans `loadDem` et elle est structurelle : le bloc se cale sur la
// GRILLE DE TUILES (deux `Math.floor`, dem.js:238-241). Le lieu demandé tombe
// donc quelque part DANS la tuile centrale, jamais en son centre. MESURÉ, en
// unités monde sur un socle de 56 : mont St Helens z13 → 6,29 unités trop au
// nord (11,2 % du socle) ; Chamonix z12 → 6,25 unités trop à l'est ; La Réunion
// z13 → 7,28 unités. Le pire cas structurel est la demi-tuile, 9,33 unités,
// soit un sixième du socle dans chaque axe.
//
// LA SOLUTION EXISTAIT DÉJÀ, ET C'EST LA RAISON D'ÊTRE DU MODE CONTINU :
// l'emprise reste calée sur la grille, mais la fenêtre de LECTURE glisse
// dedans. On la pose donc au décalage qui centre le lieu, au lieu de la laisser
// à (0, 0). Aucun chargement de plus, aucun octet de plus : la donnée est déjà
// là, on la regarde simplement au bon endroit.
//
// ⚠️ ÉCRIT AVANT `regenerateTerrain`, ET C'EST LE POINT D'OPTIMISATION. Posé
// après, il faudrait réécrire le relief une seconde fois (`tickFenetre`, 15 à
// 70 ms selon la finesse) pour un résultat identique. Écrit avant, la
// reconstruction cuit d'emblée le bon relief : le centrage est GRATUIT. Seuls
// les groupes des calques du sol restent à translater, ce que fait
// `f3CalquesSuivent()` juste après la reconstruction.
//
// ⚠️ `latLonToWorld` ET PAS UN CALCUL À LA MAIN : c'est lui qui divise par
// `demSpan(dem)`, soit 168 unités sur l'emprise et non 56. L'erreur inverse a
// déjà été commise trois fois sur cette branche. Verrouillé par
// test/fenetre-centrage.test.js, sur un aller-retour lat/lon → fenêtre → lat/lon.
//
// Silencieux et gratuit hors mode continu — le mode ordinaire ne change rien.
function f3CentreSur(cible) {
  if (!cible || !fenetreContinueActive() || !(dem?.empriseCote > 1)) return false
  if (!Number.isFinite(cible.lat) || !Number.isFinite(cible.lon)) return false
  f3EcritFenetre(fenetreQuiCentre(latLonToWorld(dem, cible.lat, cible.lon), COURSE_ELASTIQUE))
  return true
}

// ══════════ LE CARTOUCHE PARLE DE CE QU'ON REGARDE, PAS DE CE QU'ON A CHARGÉ ═
//
// Trouvé à l'audit du jalon 3 : `ground-info` reste dans le socle — c'est du
// mobilier, il ne doit pas défiler, et il ne défile pas. Mais son CONTENU ment
// après un long défilement : nom du lieu, coordonnées et plage d'altitude sont
// ceux du CHARGEMENT. À z12, un socle de course fait 21 km : on peut afficher
// « CHAMONIX » au-dessus d'Annecy.
//
// La correction est de le charger depuis la position dans l'emprise, et pas
// depuis `params.demLat/demLon` qui désignent le centre du bloc. `fenetre`
// EST la coordonnée monde du centre de la dalle visible dans l'emprise (la
// géométrie ne bouge pas, c'est la lecture qui se décale), donc
// `worldToLatLon(dem, fen.x, fen.z)` la convertit sans autre calcul.
function chargeCartouche() {
  if (!dem) return
  const fen = fenetreContinueActive() && dem.empriseCote > 1 ? terrain.fenetre : null
  const p = fen ? worldToLatLon(dem, fen.x, fen.z) : { lat: params.demLat, lon: params.demLon }
  groundInfo.load(p.lat, p.lon, dem, fen)
}

// Le lat/lon SOUS LA VISÉE DE LA CAMÉRA, décalage de fenêtre compris.
//
// `controls.target` est une coordonnée de GÉOMÉTRIE ; le champ se lit à
// `géométrie + fenêtre`. Rendre l'un pour l'autre est l'erreur qui ramenait
// l'escalier de zoom au centre du bloc après un défilement. Hors mode continu
// la fenêtre est (0, 0) : la valeur rendue est celle d'avant, au bit près.
//
// ══════════ ET ELLE NON PLUS N'A PLUS BESOIN DU MNT — Tâche 6 septies ══════
//
// ⚠️ **LE PLAN NE LA LISTAIT PAS, ET SANS ELLE LE RESTE NE SERT À RIEN.**
// `getRefineTarget` / `getCoarsenTarget` l'appellent pour savoir OÙ recharger :
// laissée sur `worldToLatLon(dem, …)`, l'escalier de zoom rend `null` dès que
// `dem` manque, c'est-à-dire exactement pendant le vol qu'on cherche à rendre
// vivant — la molette ne ferait alors plus rien, en silence. C'est le miroir
// exact de `viseeDuLieu`, et `mondeVersLatLonEmprise` est la réciproque de
// `latLonVersMondeEmprise` (`geo.js`), vérifiée contre `worldToLatLon`.
function viseeAuSol() {
  const f = terrain.fenetreBornee
  if (f?.emprise) {
    return mondeVersLatLonEmprise(f.emprise, controls.target.x, controls.target.z, TERRAIN_SIZE)
  }
  const fen = fenetreContinueActive() && dem?.empriseCote > 1 ? terrain.fenetre : null
  const x = controls.target.x + (fen?.x ?? 0)
  const z = controls.target.z + (fen?.z ?? 0)
  return worldToLatLon(dem, x, z)
}

// ══════════ FIGER LE DÉFILEMENT AVANT UNE CAPTURE ═══════════════════════════
//
// Un fichier n'a pas de trame suivante pour se corriger. Trois choses doivent
// donc être vraies AVANT qu'une image parte dans un PNG ou dans un MP4 :
//
//  1. PLUS D'ÉLAN. Une capture 4K prise pendant un lancer sort d'un terrain qui
//     glisse — et si l'export est hors ligne (usine à vidéos), l'élan gèle à sa
//     valeur de la première image et le clip entier hérite d'un décalage que
//     personne n'a choisi.
//  2. PLUS DE DÉBORDEMENT. La butée élastique montre jusqu'à 7 unités de bord
//     où `sampleDem` clampe : une bande de relief étiré qui vit 0,3 s à
//     l'écran, et POUR TOUJOURS dans le fichier. `poseDansLaCourse` est le
//     point fixe du rappel — la fenêtre atterrit où l'élastique l'aurait mise,
//     pas ailleurs, donc la reprise après export ne bouge rien (verrouillé par
//     test/fenetre-course.test.js, sur la dérivée et pas sur la position).
//  3. LE MAILLAGE FIN. Sortir un 4K du maillage de drag (res 384) serait rendre
//     à la moitié de la finesse le tirage qu'on a demandé en pleine taille.
//
// ⚠️ L'USINE À VIDÉOS, ELLE, EST DÉJÀ FIGÉE PAR CONSTRUCTION : elle tue la
// boucle rAF et fournit son propre `step`, or `f3Tick` n'est appelé QUE depuis
// `tick()`. Ni l'élan ni la butée ne peuvent s'y inviter — ce qu'il lui manquait
// n'était pas un gel, c'était de partir d'un état posé. D'où l'exposition sur
// `window.__exp.figeFenetre` : le pilote de tournage l'appelle avant de couper
// la boucle, et il n'a rien d'autre à savoir.
//
// Silencieux et gratuit hors mode continu.
function f3Fige() {
  if (!fenetreContinueActive() || !(dem?.empriseCote > 1)) return false
  _f3Glisse = false
  _f3V.x = _f3V.z = 0
  _f3Ech.length = 0
  const x = poseDansLaCourse(terrain.fenetre.x, COURSE_ELASTIQUE)
  const z = poseDansLaCourse(terrain.fenetre.z, COURSE_ELASTIQUE)
  const bouge = x !== terrain.fenetre.x || z !== terrain.fenetre.z
  terrain.fenetre.x = x
  terrain.fenetre.z = z
  _f3Brut.x = x
  _f3Brut.z = z
  // Le maillage du REPOS, tout de suite — sans attendre les 0,4 s de
  // `pasFinesse` : l'export part maintenant, pas dans une demi-seconde.
  const resVoulue = resDeFinesse(true, params.resolution, RES_FENETRE_CONTINUE)
  const changeRes = terrain.resFenetre !== resVoulue
  terrain.resFenetre = resVoulue
  // Et `_f3Fin` est mis d'accord avec ce qu'on vient de faire, sinon la boucle
  // reprendrait en croyant devoir rebasculer.
  _f3Fin = { ..._f3Fin, fin: true, repos: REPOS_S, x, z, amorce: true }
  _f3Sale = false
  if (changeRes) terrain.majResFenetre(params)
  else if (bouge) terrain.tickFenetre(params)
  else return true
  plinth.rebuild(terrain, params, socleEmprise())
  f3CalquesSuivent()
  return true
}

// ══════════ LES DEUX CALQUES QU'ON CONSTRUIT EN COORDONNÉES D'ÉCRAN ════════
//
// `labels.js` (les cotes d'altitude) et `hud3d.js` (les repères de points
// d'intérêt) ne connaissent ni le MNT ni la géographie : ils tirent des points
// AU HASARD autour de l'origine et demandent leur altitude à `terrain.sample`.
// Leurs positions sont donc en coordonnées de GÉOMÉTRIE, pas de champ.
//
// Deux défauts en découlent en mode continu, et le second est le pire :
//  · le repère reste collé à l'écran pendant que sa crête s'en va ;
//  · sa COTE devient fausse — « 2 750 m » posé sur une vallée à 900.
//
// La conversion tient en une addition : on ajoute le décalage COURANT à chaque
// enfant (leur position devient une coordonnée de champ) et le groupe portera
// −fenêtre. À l'instant de la conversion, rien ne bouge à l'écran ; à partir de
// là, ils sont accrochés à leur point du sol pour de bon.
//
// ⚠️ Appelé APRÈS chaque (re)construction de ces groupes, jamais deux fois sur
// le même — une double addition les enverrait à deux fenêtres de là.
// ⛔ **UN GROUPE MARQUÉ `espaceGlobe` NE SUIT PAS LA FENÊTRE — Tâche R24.** Ses
// enfants ne sont plus en coordonnées de bloc mais en points de SPHÈRE, à une
// centaine d'unités de l'origine : leur ajouter le décalage de fenêtre les
// enverrait à des centaines de kilomètres, et le test d'octogone ci-dessous
// (`|x| > demi`) les masquerait tous — le défaut exact que `places-layer.js`
// documente pour son désencombrement (« le comparer à HALF = 28 rejetterait
// TOUS les noms, à tous les zooms »). C'est `labels.js` qui pose la marque.
function f3AncreAuSol(group) {
  if (!group || group.userData?.espaceGlobe || !(dem?.empriseCote > 1)) return
  const f = terrain.fenetre
  for (const o of group.children) {
    o.position.x += f.x
    o.position.z += f.z
  }
  f3SuitAuSol(group, f)
}

// Le pas de fenêtre : une écriture de position, et un test d'octogone par
// enfant. Ils sont semés dans un rayon de 24 unités autour du point de
// construction ; passé un demi-socle de défilement, la moitié d'entre eux
// flotterait au-delà du bord, au-dessus du vide.
function f3SuitAuSol(group, f) {
  if (!group || group.userData?.espaceGlobe || !(dem?.empriseCote > 1)) return
  group.position.set(-f.x, 0, -f.z)
  const bloc = terrain.blockFootprint()
  for (const o of group.children) {
    o.visible = dansFenetre(o.position.x - f.x, o.position.z - f.z, bloc.half, bloc.corner)
  }
}

// ══════════ LE POINT BAS DU SOCLE, SUR L'EMPRISE ENTIÈRE ═══════════════════
//
// Décision d'Adrien : « `baseY` se cale sur le point bas de l'emprise 3×3
// entière, pas de la vue. C'est le prix de la stabilité — un socle qui garde
// son épaisseur pendant qu'on défile. »
//
// ⚠️ SANS ÇA, LE SOCLE RESPIRE. `computeSlab` cherche le point bas en balayant
// ce que `terrain.sample` lui rend — c'est-à-dire la FENÊTRE COURANTE. On
// glisse vers une vallée, le point bas descend, le socle s'épaissit ; on
// remonte, il maigrit. Un socle qui pulse pendant qu'on défile, c'est exactement
// « une dégradation qui se voit comme une panne ».
//
// La valeur ne dépend d'aucun décalage : c'est `dem.minM`, l'extremum de
// l'emprise que `recollerEmprise` a déjà calculé, converti en unités monde par
// la même échelle que le relief. Rendu `null` hors mode continu, ce qui rend à
// `plinth.rebuild` son comportement d'origine au caractère près.
function socleEmprise() {
  if (!(dem?.empriseCote > 1)) return null
  const scale = (TERRAIN_SIZE * dem.empriseCote / dem.extentMeters) * lireExageration(params)
  return (dem.minM - dem.meanM) * scale - (params.plinthDepth ?? 7)
}

// ------------------------------------------------------------------ regeneration helpers

// ------------------------------------------------------------------ real-world DEM loading

let dem = null
let demBusy = false

// Les petites phrases d'info du chargement. UN SEUL point d'accroche : le
// module observe lui-même la classe `.hidden` du loader, donc les six endroits
// qui le montrent ou le cachent n'ont rien à savoir de lui.
// On relit `dem` À CHAQUE TIRAGE, jamais une copie : pendant un rechargement,
// demLat/demLon pointent déjà la nouvelle zone alors que `dem` tient encore
// l'ancienne — c'est ce que hints.js compare pour refuser de citer l'altitude
// du bloc précédent. Posé ICI, après la déclaration de `dem`, pour que le tout
// premier tirage (le boot, loader déjà à l'écran) ne tombe pas dans sa TDZ.
initLoadingHints(loadingEl, () => ({ lat: params.demLat, lon: params.demLon, dem }))

// ══════════ L'INDICATEUR DISCRET — Tâche 2, et le §9 l'attendait ════════════
//
// ⚠️ **CE QUI PART, IL FAUT QUE QUELQUE CHOSE LE DISE — MAIS PAS UN VOILE.**
// Adrien, le 2026-08-20 : « quand le réseau ne suit pas, l'utilisateur voit UN
// INDICATEUR DISCRET ». Son ÉTAT était fabriqué et testé depuis la Tâche 4 ter
// (`etatIndicateur`, `src/monde/descente-bornee.js`) ; son DESSIN n'existait
// nulle part. Il est ici, et il n'a que deux lecteurs pour l'instant, tous deux
// documentés à leur point d'appel : la panne réseau de `loadRealTerrain`, et la
// couverture du socle sous `?socle=quadtree`.
//
// ⚠️ Posé APRÈS les indices de chargement, dans la même région du fichier : les
// deux sont le même sujet — ce que l'écran raconte pendant qu'on attend.
const indicateurRetard = initIndicateurRetard()

// patch key → Promise<{maskTexture}|null>. Memoises the in-flight fetch (dedupes
// A→B→A within one fetch) and is LRU-bounded (Map keeps insertion order; a hit
// re-inserts to mark it most-recently-used). Evicted masks are disposed unless
// still the active one — the cache is the sole owner of coast-mask lifecycles.
const COAST_CACHE_MAX = 16
const coastMaskCache = new Map()
// ImageData du masque côtier ACTIF (une seule à la fois) — la vérité terre/mer
// côté CPU pour la simulation d'eau, le garde-fou sea-mask et le clip de zone.
// null tant que le fetch du patch n'a pas abouti (ou hors bande z4–z15).
let coastMaskImage = null
// the finest zoom the USER chose — dives and the staircase overwrite
// params.demZoom freely, but refining always climbs back to this. Default to the
// finest tiles available (z15) so zooming all the way in actually reaches full
// detail; picking a coarser "Detail (zoom)" lowers it again.
//
// PLAFOND z17 depuis Mapterhorn : la Suisse (swissALTI3D) sert du z17, la France
// (IGN RGE ALTI) du z16. Le DÉFAUT reste z15 — le zoom fixe l'EMPRISE du bloc
// (3 tuiles de large : ~4,6 km à z15, 2,3 km à z16, 1,1 km à z17), pas seulement
// la finesse, et z15 en tuiles 512 px porte déjà deux fois plus de détail que
// z15 en 256 px. Monter DEFAULT_FINE_ZOOM change la taille du bloc, pas sa netteté.
const MAX_FINE_ZOOM = 17
const DEFAULT_FINE_ZOOM = 15
let userFineZoom = Math.min(MAX_FINE_ZOOM, Math.max(params.demZoom, DEFAULT_FINE_ZOOM))
// ⚠️ LE PLAFOND DOIT SUIVRE LA ZONE, pas rester sur une constante.
// Retour d'Adrien : « z16 et z17 ne sont pas accessibles en Suisse, ni au zoom
// ni au clic ». Le chargement, lui, marchait déjà — vérifié à Zermatt, z17 rend
// 0,41 m/px. Ce qui bloquait, c'est que la plongée au clic s'arrête à
// `userFineZoom` (voir stepZoom plus haut), figé à 15 au démarrage.
//
// On ne fait que MONTER le plafond : quelqu'un qui a demandé du fin garde son
// choix en survolant une zone moins couverte, et redescendre sous son dos serait
// une surprise désagréable.
function liftFineZoomToRegion() {
  const max = getDemMaxZoom()
  if (!max) return
  const cible = Math.min(MAX_FINE_ZOOM, Math.max(max, DEFAULT_FINE_ZOOM))
  if (cible > userFineZoom) userFineZoom = cible
}

// --- per-zoom vertical exaggeration ------------------------------------------
// ONE elevation model shared by every look (templates never touch it). Each zoom
// tier carries its own exaggeration that you tune with the slider and it PERSISTS
// (localStorage) — so continental blocks (z5/6/7) can stand tall while close-ups
// stay subtle, entirely to your taste. Coarse blocks default high because their
// relief is tiny next to the huge footprint.
const BASE_EXAG = 2.8 // échelle verticale par défaut au chargement (Adrien)
// per-zoom vertical exaggeration. Coarse continental views (z5-7) were far too
// tall — the relief read like spikes (user feedback v40). Halved+ so a country
// sits as a gentle raised-relief plate; the ocean mask now keeps the low ground
// clean so it can stay subtle without phantom lakes appearing.
// ⚠️ z3 MANQUAIT ICI AUSSI, et l'effet était le symétrique du précédent : sans
// entrée, z3 retombait sur BASE_EXAG (2,8), c'est-à-dire PLUS HAUT que z4 (2,5).
// Le niveau le plus large de tous était donc le seul à remonter, en pleine
// courbe descendante — exactement le relief « en pics » que cette table existe
// pour aplatir. On prolonge la descente : 2,5, comme z4.
const ZOOM_EXAG_DEFAULTS = { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 }
const ZOOM_EXAG_KEY = 'monolith.zoomExag'
let zoomExagStore = (() => {
  try {
    return JSON.parse(localStorage.getItem(ZOOM_EXAG_KEY) || '{}') || {}
  } catch {
    return {}
  }
})()
const exagForZoom = (z) => zoomExagStore[z] ?? ZOOM_EXAG_DEFAULTS[z] ?? BASE_EXAG
function saveZoomExag(z, v) {
  zoomExagStore[z] = v
  try {
    localStorage.setItem(ZOOM_EXAG_KEY, JSON.stringify(zoomExagStore))
  } catch {}
  // ⚠️ **LA COURBE CONTINUE DOIT SUIVRE LA SURCHARGE, SINON ELLE LA PERD.**
  // La décision 14 dit « mêmes valeurs aux mêmes altitudes » : ces valeurs-là
  // SONT les surcharges d'Adrien. Rebâtir la courbe coûte seize évaluations, et
  // ça n'arrive qu'au relâchement d'un curseur.
  exagPartage.courbe = courbeExageration({ surcharges: zoomExagStore })
}

// LE CRAN ET SA FRACTION — la grandeur qui pilote la courbe continue.
//
// ⚠️ **C'EST LE TROISIÈME PILOTE, ET LES DEUX PREMIERS ONT ÉTÉ MESURÉS
// DÉFAILLANTS.** Piloté par `altitudeCadrageM()` il DIVERGE — cette fonction
// divise par `echelleBloc()`, qui CONTIENT l'exagération, gain mesuré **1,44**
// entre z4 et z5. Piloté par `zoomCadrage` (la largeur de sol visible) il GÈLE
// à **×2,8 sur toute la descente Z12 → Z4** : la signature est propre, mais la
// boucle repasse par la CAMÉRA, que `poseCranContinu` repose à
// `camY × facteurEchelle` — et `facteurEchelle` porte le rapport des
// exagérations. **Aucune grandeur tirée de la pose d'après-cran n'est propre.**
//
// ⚠️ **`_levelZoom` L'EST, LUI, ET C'EST STRUCTUREL** : `_rescale` l'écrase à
// zéro (`_resetZoom`) AVANT de reposer la caméra, et `_applyZoom` ne lui ajoute
// que `log(newDist / dist)`, le rapport du glissé de molette. Il est déjà borné
// à `[-ln2, +ln2]`, donc `zc = demZoom + f` vit dans `[z-1, z+1]` **par
// construction**, sans garde-fou ajouté.
//
// ⚠️ **DEUX LIMITES MESURÉES, ÉCRITES ICI PARCE QU'ELLES VIVENT ICI.**
//   (1) Quand ce code s'exécute, `_levelZoom` vaut **toujours zéro** :
//       `_rescale` appelle `_resetZoom()` AVANT `loadSurface`, donc avant
//       `fetchAndBuildDem`, donc avant nous. **`f` est structurellement nul au
//       cran** — la courbe est juste, mais elle est ÉCHANTILLONNÉE aux crans et
//       rend donc exactement la table en escalier d'Adrien. Le glissement de la
//       décision 14 n'est pas encore visible à l'écran.
//   (2) Le cran a **trois** voies de déclenchement (`atInLimit`, `modes.js`) et
//       la continuité n'est acquise que sur celle du budget ; sur `nearGround()`
//       et `minDistance` le saut atteint **100 % au cran z4 → z5**.
// Les deux sont gardées par `test/exageration-globe.test.js` (②a ter et ①e).
//
// Voir le §4 bis de `monde/exageration-continue.js`.
//
// Rend `null` hors relief réel : l'appelant retombe alors sur le palier.
function cranCourant() {
  if (params.source !== 'real') return null
  return {
    demZoom: params.demZoom,
    // ⚠️ **ZÉRO HORS MODE SURFACE, ET CE N'EST PAS UN TROU** : en orbite le
    // budget de niveau n'a pas de sens, et `f = 0` rend exactement
    // `courbe(demZoom)`, c'est-à-dire le palier d'aujourd'hui.
    zoomNiveau: modes?.mode === 'surface' ? (modes.zoomNiveau?.() ?? 0) : 0,
  }
}

// pull the current zoom's exaggeration into params + refresh the UI controls
//
// ⚠️ **C'EST L'UNIQUE ÉCRIVAIN DE L'EXAGÉRATION DE ZOOM, ET IL A DEUX RÉGIMES.**
// Drapeau éteint (production) : le palier d'aujourd'hui, au bit près — c'est
// `exagForZoom`, inchangé. Drapeau `?exag=continu` : la courbe de la décision
// 14, lue au cran que l'escalier occupe et à la fraction de niveau dépensée. Au
// repos (`_levelZoom = 0`) les deux rendent **la même valeur, surcharges
// comprises** — c'est le test ②b de `exageration-globe.test.js`, et c'est ce qui
// fait que le réglage d'Adrien survit au pivot.
//
// ⚠️ **ET LE GLOBE LIT ICI, PAS AILLEURS** (Tâche E). Il est le quatorzième
// lecteur du partage ; sans drapeau `majExageration` rend la main sans rien
// faire et le globe reste à 18.
function syncExagToZoom() {
  const cran = exagContinueActive() ? cranCourant() : null
  if (cran) majExagerationCran(exagPartage, cran)
  else params.demExaggeration = exagForZoom(params.demZoom)
  globe?.majExageration(params)
  refreshAll()
}

// --- per-zoom fine detail -----------------------------------------------------
// At continental scale (z4-6) the procedural FBM "fine detail" reads as fake
// stippling on the plains, so it's force-zeroed by default there; z7+ keeps the
// base value. A user override in localStorage always wins, mirroring exaggeration.
const DETAIL_KEY = 'monolith.zoomDetail'
const BASE_DETAIL = 0.02
let zoomDetailStore = (() => {
  try {
    return JSON.parse(localStorage.getItem(DETAIL_KEY) || '{}') || {}
  } catch {
    return {}
  }
})()
function saveZoomDetail(z, v) {
  zoomDetailStore[z] = v
  try {
    localStorage.setItem(DETAIL_KEY, JSON.stringify(zoomDetailStore))
  } catch {}
}
// pull the current zoom's fine-detail (0 at continental scale) into params
function syncDetailToZoom() {
  params.detail = detailForZoom(params.demZoom, zoomDetailStore, BASE_DETAIL)
}

// fetch tiles + rebuild; throws on failure so programmatic callers (orbital
// dive) can hold orbit — loadRealTerrain wraps it with the GUI's error UX
//
// `centreSur` : le lieu qu'on est allé chercher, à poser AU CENTRE du socle en
// mode continu (voir `f3CentreSur`). Absent, la fenêtre est laissée telle
// quelle — et c'est voulu : un simple rechargement de zone (changement
// d'exagération, retour de palette) ne doit pas ramener le visiteur au centre
// du bloc alors qu'il a défilé pour aller ailleurs.
async function fetchAndBuildDem({ centreSur = null, enVol = false } = {}) {
  syncExagToZoom() // this zoom's saved (or default) vertical exaggeration
  syncDetailToZoom() // fine-detail off at continental scale (z<=6)
  loadingStatus.textContent = 'fetching elevation tiles…'
  // ⚠️ **EN VOL, PAS DE RIDEAU — ET C'EST LA TÂCHE 2 QUI DEVENAIT BLOQUANTE
  // ICI.** Ce chargement-là court DERRIÈRE une application vivante : lever le
  // voile reviendrait à remettre le pop-up d'Adrien par-dessus une carte qui
  // répond déjà au doigt. La carte `#loading` n'est pas supprimée pour autant
  // (c'est bien la Tâche 2, et elle reste à faire) : elle garde le PREMIER
  // chargement, celui où il n'y a encore rien à regarder.
  if (!enVol) showLoading()
  // le numéro du vol courant, capturé AVANT le premier `await`
  const gen = _generationMNT
  const perime = () => enVol && gen !== _generationMNT
  // `memo` : le bloc central est le seul à revenir (aller-retour de zoom), donc
  // le seul à mémoriser — voir dem-memo.js pour la facture et pour la raison
  // d'en tenir le damier à l'écart.
  const arrive = await loadDem({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, memo: true })
  // ══════════ LA SUPERSESSION — Tâche 6 septies ═════════════════════════════
  //
  // ⚠️ **SANS ELLE, DEUX CRANS RAPIDES ÉCRIVENT `dem` DANS LE DÉSORDRE.** Depuis
  // que `loadSurface` rend la main tout de suite, `demBusy` ne sérialise plus
  // rien : un second cran part pendant que le premier MNT est encore en vol, et
  // le plus LENT des deux gagne. Le bloc afficherait alors le relief d'un palier
  // sous les repères d'un autre — précisément la carte fausse que le §5 de
  // `/threejs-optimisation` décrit. Un compteur, incrémenté par `entrerEnVol`,
  // et le retardataire se retire sans rien toucher.
  if (perime()) return
  dem = arrive
  // Le réseau a répondu : ce que l'indicateur annonçait est arrivé. Il s'éteint
  // ICI et pas à la fin — c'est l'arrivée du MNT qui est le fait, pas la fin de
  // la reconstruction. (Le socle le rallumera quelques lignes plus loin s'il est
  // encore couvert plus grossièrement que son emprise ne le demande.)
  indicateurRetard.eteint()
  // ══════════ MODE CONTINU : ON ÉLARGIT À L'EMPRISE 3×3 ═════════════════════
  // Le bloc central vient d'arriver ; on lui adjoint ses huit voisins et on
  // recolle le tout en UN champ. `terrain` ne voit ensuite qu'un `dem` de forme
  // ordinaire, trois fois plus grand — il n'a pas à savoir d'où il vient.
  //
  // ⚠️ NEUF APPELS À `tilesAcross: 3`, PAS UN À `tilesAcross: 9`. Le second
  // peindrait un canevas 4608², en lirait l'ImageData et la décoderait : un pic
  // transitoire de ~255 Mo qui tuerait l'iMac 2015 (étude §3.3).
  //
  // ⚠️ MAIS PAS LES NEUF EN MÊME TEMPS — `enVolBorne`, PAS `Promise.all`. Neuf
  // petits appels ne coûtent « le même total sans le pic » QUE s'ils ne sont pas
  // tous en vol à la fois : chacun tient au passage son ImageData (9,4 Mo), son
  // Float32Array (9,4 Mo) et son champ fusionné pour ne rendre que 4,7 Mo
  // d'Int16. Lancés d'un seul `Promise.all`, ils portaient le tas de 160 à
  // 386 Mo pendant le chargement — le pic écarté par la porte rentrait par la
  // fenêtre. Mesure et chiffres : dem-emprise.js, EMPRISE_EN_VOL_MAX.
  //
  // ⚠️ `memo: false` sur les voisins : le mémo est fait pour le bloc central,
  // le seul qui revienne sur un aller-retour de zoom. Y verser huit champs de
  // 4,7 Mo chasserait précisément ce qu'il sert à garder (dem-memo.js).
  if (fenetreContinueActive()) {
    try {
      const t0 = performance.now()
      loadingStatus.textContent = 'fetching the 3×3 window…'
      const origines = originesEmprise(dem, dem.size / dem.tilePx)
      const blocs = await enVolBorne(origines, EMPRISE_EN_VOL_MAX, (o, k) =>
        // le rang 4 est le centre : il est déjà là, on ne le retélécharge pas
        k === 4 ? dem : loadDem({ zoom: params.demZoom, originTile: o, memo: false })
      )
      dem = recollerEmprise(blocs)
      console.info(`[f3] emprise 3×3 recollée : ${dem.size}² en ${Math.round(performance.now() - t0)} ms`)
    } catch (err) {
      // Une emprise incomplète se lirait comme une plaine au milieu des Alpes.
      // On retombe sur le bloc unique : le mode continu ne s'active pas, et
      // l'application reste EXACTEMENT celle d'aujourd'hui.
      console.warn('[f3] emprise 3×3 abandonnée, retour au bloc unique :', err?.message || err)
    }
  }
  // le sondage de couverture vient d'aboutir pour cette zone : si elle est
  // servie plus finement que le défaut, la plongée au clic doit pouvoir y aller
  liftFineZoomToRegion()
  terrain.setDem(dem)
  // LE LIEU CHERCHÉ SE POSE ICI, avant la reconstruction : elle cuira d'emblée
  // le bon relief, sans une seconde écriture (voir `f3CentreSur`).
  const aCentre = f3CentreSur(centreSur)
  // LE TRAIT DE CÔTE DE LA ZONE PRÉCÉDENTE EST LÂCHÉ ICI, AVANT la
  // reconstruction — il l'était après, et ça coûtait un travail de travailleur
  // entier par zoom. Il ne décrit plus le bon endroit : le garder faisait
  // calculer le masque de mer du nouveau bloc avec le raster côtier de
  // l'ANCIEN, puis le refaire sans trait de côte une fois la carte affichée,
  // puis une TROISIÈME fois à l'arrivée du bon. Trois travaux à 9 Mo de MNT
  // recopiés, pour un résultat que seul le dernier décide. Lâché ici, le
  // masque de mer que `rebuild` va lancer est d'emblée le bon état d'attente
  // (aucun trait de côte) et il n'en reste que DEUX : celui-là, et l'arrivée.
  // ⚠️ `rebuildFields: false` : c'est `regenerateTerrain` qui lance les champs
  // quelques lignes plus bas, inutile d'en poster un pour rien (voir
  // terrain.js). Les `setCoastMask(null)` restés plus bas deviennent, eux, de
  // simples non-événements — le masque est déjà nul.
  terrain.setCoastMask(null, null, { rebuildFields: false })
  params.source = 'real'
  try {
    clouds?.reroll() // a new view level deserves a fresh cloud layout
  } catch {} // a cosmetic cloud hiccup must never abort a terrain build
  refreshAll()
  loadingStatus.textContent = 'generating terrain…'
  applyTimeOfDay(params.timeOfDay ?? 10) // the sun is location-true — re-aim it for the new place
  // ══════════ LA SECONDE LEVÉE DU RIDEAU — Tâche 2 ══════════════════════════
  //
  // ⚠️ **IL Y AVAIT DEUX LEVÉES SUR CE CHEMIN, ET LE PLAN N'EN NOMMAIT QU'UNE.**
  // `if (!enVol) showLoading()` en tête de cette fonction est la première ;
  // celle-ci en est une seconde, à travers `regenerateTerrain`, et elle
  // ignorait complètement le vol. Retirer l'une sans l'autre n'aurait rien
  // retiré du tout.
  //
  // **MESURÉ à l'écran le 2026-08-21** (port 5503, `?globe=continu&socle=quadtree&f3=0`,
  // La Réunion, cran z12 → z13, observateur de mutations sur la classe de
  // `#loading`) : `loadSurface` rend la main en **468 ms**, et la carte de
  // chargement remonte **326 ms PLUS TARD** — par-dessus une application déjà
  // libre, déjà en train de répondre au doigt — pour n'être encore toujours pas
  // redescendue **9,7 s** après. C'est le pop-up d'Adrien posé exactement sur le
  // trou qu'il ne cache plus.
  //
  // ⚠️ **ET HORS VOL, LE RIDEAU RESTE — C'EST DÉLIBÉRÉ, PAS UN OUBLI.** Le
  // drapeau `socleQuadtree` est ÉTEINT en production : `volPossible()` y rend
  // faux, `loadSurface` y attend encore le MNT entier (992 à 5 817 ms mesurés à
  // la Tâche 6 septies), et l'attente n'a donc PAS disparu de ce côté-là. Le §10
  // du plan l'écrit mot pour mot : « ôter un rideau avant que l'attente ait
  // disparu ne supprime pas le pop-up, il montre le trou qu'il cachait ».
  // Le rideau tombera en production le jour où le drapeau s'allumera, et pas
  // avant — c'est la même ligne de code qui décidera.
  await regenerateTerrain({ sansRideau: enVol })
  // ⚠️ **SECOND POINT DE SUPERSESSION, ET IL EN FAUT DEUX** : `regenerateTerrain`
  // attend les champs déportés (~470 ms sur un MNT 1536²), et un cran peut très
  // bien tomber pendant. Tout ce qui suit — cartouche, trait de côte, damier,
  // flotte — est cuit sur `params.demZoom` : le laisser courir poserait les
  // repères d'un palier qu'on vient de quitter.
  if (perime()) return
  // Les calques du sol sont reconstruits en coordonnées de CHAMP ; leur groupe
  // porte −fenêtre. La reconstruction ne le sait pas — elle rebâtit la
  // géométrie, pas la translation. Sans cette ligne, un lieu centré affichait
  // son relief au bon endroit et ses NOMS à l'ancien.
  if (aCentre) f3CalquesSuivent()
  // pull the cartouche info for the new zone (async, non-blocking)
  // ⚠️ **ET IL SE RALLUME ICI** — `entrerEnVol` l'avait éteint le temps du vol
  // (voir la note là-bas). La condition est celle de `setSurfaceVisible`, mot
  // pour mot : le cartouche n'existe qu'en mode surface.
  groundInfo.setVisible(!!params.groundInfo && cartoucheAffiche())
  if (params.groundInfo) chargeCartouche()
  // real coastline (Natural Earth) at coarse zoom — async, non-blocking; the
  // shader falls back to the elevation isoline until it arrives / if it fails.
  // ══════════ LE TRAIT DE CÔTE SUR L'EMPRISE — JALON 2 ══════════════════════
  //
  // Le jalon 1 s'en passait : `fetchCoastMask` cuit son masque sur le
  // FOOTPRINT DU MNT qu'on lui donne, et à ce jalon on lui donnait un bloc,
  // donc une côte au tiers de sa taille plaquée au mauvais endroit. Rien à
  // réécrire pour le réparer — il suffit de lui donner le MNT RECOLLÉ :
  // `patchLatLonBBox` et `projectPatchPx` se déduisent de `dem.size`, de
  // `originTileX/Y` et de `tilePx`, tous justes sur l'emprise.
  //
  // ⚠️ LA TAILLE, ELLE, DOIT SUIVRE — c'est le seul vrai réglage de ce poste.
  // Le masque d'un bloc fait 2 048 sur 56 unités (36,6 texels/unité). Le même
  // 2 048 étalé sur les 168 unités de l'emprise n'en ferait plus que 12,2, et
  // le socle occupe ~800 pixels d'écran pour ces 56 unités : un texel vaudrait
  // alors 1,17 pixel d'écran, au-delà du pixel.
  //
  // ATLAS_COTE = 2 304 tient 13,7 texels/unité. Le raisonnement s'arrête là ;
  // le CHOIX, lui, a été tranché par comparaison d'images côte à côte, et les
  // chiffres sont au-dessus de la constante (dem-emprise.js) — avec la mesure
  // du plancher de bruit du banc, sans laquelle ils ne voudraient rien dire.
  const coteMasque = dem?.empriseCote > 1 ? ATLAS_COTE : undefined
  if (params.demZoom >= COAST_ZOOM_MIN && params.demZoom <= COAST_ZOOM_MAX) {
    // ⚠️ LA TAILLE ENTRE DANS LA CLÉ DU CACHE. Sans elle, un aller-retour entre
    // le mode ordinaire et le mode continu sur la MÊME zone au MÊME zoom
    // reposerait le masque de l'autre mode : le bon contenu, la mauvaise
    // emprise — une côte au tiers de sa taille, et aucune erreur levée.
    const key = `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}:${coteMasque ?? 0}`
    let job = coastMaskCache.get(key)
    if (job) coastMaskCache.delete(key) // re-insert below to mark most-recently-used
    else job = fetchCoastMask({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, dem, size: coteMasque })
    coastMaskCache.set(key, job)
    // LRU eviction: drop the oldest entries, disposing their masks (never the active one)
    while (coastMaskCache.size > COAST_CACHE_MAX) {
      const lru = coastMaskCache.keys().next().value
      const evicted = coastMaskCache.get(lru)
      coastMaskCache.delete(lru)
      evicted
        ?.then((res) => {
          const tex = res?.maskTexture
          if (tex && tex !== terrain.mapUniforms.uCoastMask.value) tex.dispose()
        })
        .catch(() => {})
    }
    terrain.setCoastMask(null) // fallback until this patch's mask resolves
    realWater?.setCoastMask(null, false)
    coastMaskImage = null
    job
      .then((res) => {
        if (!res) return
        // only apply if we're still on the same patch
        // ⚠️ LA MÊME EXPRESSION QUE LA CLÉ, suffixe de taille compris — sinon un
        // masque d'emprise arrivé après un retour au mode ordinaire (ou
        // l'inverse) se croirait toujours d'actualité et se poserait.
        const coteActuelle = dem?.empriseCote > 1 ? ATLAS_COTE : undefined
        const stillHere =
          `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}:${coteActuelle ?? 0}` === key
        // the SEA reads the SAME OSM mask so its waves stop at the real shore,
        // not the elevation contour (flat polders below sea level are land)
        if (stillHere) {
          // Le champ R8 du masque, partagé par tous les consommateurs CPU
          // (champ de simulation mer, garde-fou sea-mask du terrain, clip de
          // zone) — ET par la DataTexture du GPU : c'est LE MÊME Uint8Array.
          // ⚠️ Il remplace l'ImageData que ces lignes extrayaient du canevas :
          // 16,78 Mo à 2048², pour quatre octets par texel dont un seul portait
          // de l'information. Sa foulée est 1, pas 4 (voir coast-mask.js).
          const img = res.maskField || null
          coastMaskImage = img
          terrain.setCoastMask(res.maskTexture, img)
          realWater?.setCoastMask(res.maskTexture, true, img)
          // la découpe de zone a pu être rasterisée AVANT l'arrivée du masque
          // (fetchs concurrents) : la refaire pour rendre leurs polders aux
          // Pays-Bas — Nominatim est caché, seul le raster est recalculé
          if (params.regionMode) applyRegionMode()
        }
      })
      .catch(() => {})
  } else {
    terrain.setCoastMask(null)
    realWater?.setCoastMask(null, false)
    coastMaskImage = null
  }
  traffic.setZone(dem) // SpaceX pad watcher (Starbase / LC-39A in view?)
  traffic.setSpan(trafficSpan()) // en mode continu le damier est vide : l'emprise commande
  terrain.refreshMatTiling(params) // relief material tiling tracks the new zoom
  if (params.regionMode) applyRegionMode() // re-cut to the new zone's boundary
  // Adrien's saved look becomes the opening view — applied ONCE, after the very
  // first terrain build (so rampStops/material have a mesh to land on), then
  // never again so the user's own edits are never stomped.
  // ⚠️ UN RETOUR DE PAIEMENT COMPTE COMME UN LIEN. Le look restauré du panier
  // vient d'être posé sur `params` au démarrage ; sans ce terme, le look
  // d'ouverture d'Adrien l'écraserait ici même, et l'acheteur qui a renoncé
  // retrouverait son LIEU mais pas ses COULEURS — le pire des deux mondes,
  // parce qu'on croirait l'état sauvegardé.
  const fromLink = location.hash.startsWith('#s=') || location.hash.startsWith('#r=') || !!PANIER_RESTAURE
  if (!_startupLookApplied && !fromLink && !IS_EMBED) {
    _startupLookApplied = true
    // `view` du fichier s'il en porte une ; sinon la VUE ISOMÉTRIQUE 1, qui
    // est le cadrage d'ouverture voulu (Adrien). applyIsoView refuse tant que
    // la scène n'est pas en mode surface au repos, d'où le rendez-vous après
    // la construction du relief plutôt qu'au tout début du démarrage.
    applyUserTemplate({ look: STARTUP_LOOK, view: SHIBU_START.view || null })
    if (!SHIBU_START.view) applyIsoView(0)
  }
  // OMBRAGE AUTO — en DERNIER : le look d'ouverture (ou celui d'un lien
  // partagé) vient d'écrire ses constantes d'ombrage, or elles ont été
  // réglées sur un AUTRE relief. On les recalcule pour celui qu'on vient de
  // charger, sauf les curseurs que l'utilisateur a repris à la main.
  applyAutoShade()
  // LE RENDEZ-VOUS DU PALIER AVEC LE LOOK D'OUVERTURE. Le look qui vient
  // d'être posé porte `shadowMode` et `grain` : sur une machine estimée faible,
  // il vient de réinstaller des ombres dynamiques par-dessus le palier, et le
  // gouverneur s'apprête à croire que c'est l'utilisateur qui a fait ça (il
  // relâcherait alors le levier pour toujours). `rebase` recapture la
  // référence et ré-applique le palier — une fois, au premier relief, et plus
  // jamais ensuite. Voir le commentaire de rebase() dans perf.js.
  aq?.rebase()
  // FLOTTE — après le relief ET la mer : elle a besoin de l'un pour savoir où
  // est l'eau, de l'autre pour partager les uniformes de houle.
  syncBoats()
}

// ══════════════════════════════════════════════════════════════════════════
// LE VOL DU MNT — Tâche 6 septies
// ══════════════════════════════════════════════════════════════════════════
//
// ⚠️ **C'EST CE QUI RETIRE L'ATTENTE, ET IL FALLAIT TOUT LE RESTE DE CE FICHIER
// AVANT.** Jusqu'ici, `loadSurface` n'avait le droit de rendre la main qu'une
// fois le MNT téléchargé, décodé et cuit — 0,87 à 5,3 s par cran, mesuré — parce
// que TOUT le bloc était géoréférencé par lui. Désormais l'échelle verticale,
// l'altitude de cadrage, la visée et sa réciproque se lisent sur la fenêtre
// bornée, qui connaît son emprise sans rien charger.
//
// **Ce que fait `entrerEnVol` :** poser le palier d'arrivée, LÂCHER le MNT du
// palier qu'on quitte, et repeindre le bloc à ce que le quadtree sait déjà.
//
// ⚠️ **LÂCHER LE MNT N'EST PAS UNE PROPRETÉ, C'EST LA CORRECTION ELLE-MÊME.**
// Un `dem` périmé d'un seul palier place un point à **2,37 unités du centre au
// lieu de 0, et jusqu'à 9,62 unités** sur un bloc qui en fait 56 — mesuré au
// rejeu (`.banc/rejeu-6septies.mjs`, Q5), soit **jusqu'à un sixième du socle**.
// Le garder pendant le vol donnerait un relief au bon palier sous des
// étiquettes, des lacs, une mer et un tracé restés au précédent : une carte
// FAUSSE, pas une carte fluide. `dem = null` fait tomber d'un coup les ~soixante
// gardes `if (!dem) return` de ce fichier, et chaque calque se REBÂTIT vide au
// lieu de mentir. Ils reviennent tous à l'atterrissage.
//
// ⚠️ **CE QUE ÇA COÛTE, ET IL FAUT LE DIRE** : pendant le vol le socle n'a ni
// masque de mer, ni trait de côte, ni étiquettes, ni cartouche, ni tracé drapé.
// C'est la décision 13 appliquée aux calques — grossier d'abord, net ensuite —
// et c'est ce qu'Adrien doit regarder avant qu'on ouvre le drapeau.
let _generationMNT = 0
function entrerEnVol() {
  _generationMNT++
  // le palier d'arrivée AVANT le recadrage : `cadrageFenetre()` lit
  // l'exagération de CE zoom, et `syncExagToZoom` est ce qui la pose.
  syncExagToZoom()
  syncDetailToZoom()
  dem = null
  terrain.setDem(null)
  terrain.setCoastMask(null, null, { rebuildFields: false })
  realWater?.setCoastMask(null, false)
  coastMaskImage = null
  traffic.setZone(null)
  // ⚠️ **LE CARTOUCHE SE CACHE, IL NE SE RECHARGE PAS.** `groundInfo.load`
  // interroge un géocodeur : l'appeler sans lat/lon partirait chercher le nom de
  // « NaN, NaN ». Et le laisser tel quel graverait sur le socle le nom et la
  // plage d'altitude du palier qu'on vient de quitter — juste sur un cran (le
  // lieu ne bouge pas), FAUX sur une plongée vers un autre continent.
  // `fetchAndBuildDem` le rallume à l'atterrissage, à côté de `chargeCartouche`.
  groundInfo.setVisible(false)
  // ══════════ ET LE DAMIER PART AVEC LE MNT ═════════════════════════════════
  //
  // ⚠️ **`test/damier-uniformes.test.js` A ATTRAPÉ CETTE LIGNE MANQUANTE À LA
  // PREMIÈRE EXÉCUTION, ET IL AVAIT RAISON.** Les dalles voisines portent le
  // relief RÉEL du palier qu'on vient de quitter : laissées autour d'un centre
  // qui vient de changer d'échelle, elles donnent une carte coupée en deux à la
  // jointure — plage hypsométrique, mer et masques d'un côté, l'autre palier de
  // l'autre. C'est exactement ce que `loadRealTerrain` fait déjà quand le réseau
  // lâche (`blockGrid?.clear()`), et pour la même raison. `sync` avec `dem` nul
  // rend un besoin vide, donc il NETTOIE ; le prochain atterrissage les fait
  // renaître.
  blockGrid?.sync(allGpxPoints())
  // ⚠️ **`sansRideau`, ET C'EST LA MOITIÉ DE LA TÂCHE 2 QUI DEVENAIT BLOQUANTE**
  // — voir `regenerateTerrain`. C'est la MÊME liste de calques qu'à
  // l'atterrissage : une seconde liste aurait divergé au premier calque ajouté,
  // et ce fichier raconte déjà cinq fois cet accident-là.
  return regenerateTerrain({ sansRideau: true })
}

// Le vol est-il possible ? ⚠️ **IL EXIGE LE SOCLE QUADTREE, ET CE N'EST PAS UNE
// PRUDENCE** : sans lui `_remplirDepuisFlux` rend `null`, donc un bloc sans MNT
// se peindrait au relief PROCÉDURAL — du bruit qui n'a rien à voir avec le lieu
// (c'est le témoin ⑩a). Le drapeau `?socle=quadtree` reste éteint tant que la
// bathymétrie n'est pas dans le flux (Tâche 6 sexies) ; ce vol part donc avec
// lui, pas sous `?globe=continu` seul.
const VOL_SANS_ATTENTE = socleQuadtreeActif()
function volPossible() {
  return VOL_SANS_ATTENTE && params.source === 'real' && !!terrain.fenetreBornee && !fenetreContinueActive()
}

async function loadRealTerrain(opts = {}) {
  if (demBusy) return
  demBusy = true
  try {
    await fetchAndBuildDem(opts)
  } catch (err) {
    console.error('DEM load failed:', err)
    loadingStatus.textContent = 'elevation fetch failed — check connection'
    // ⚠️ ON REBÂTIT LE RELIEF PROCÉDURAL À PLEINE RÉSOLUTION AVANT DE MONTRER.
    // Le maillage en place est celui du constructeur, désormais un BROUILLON de
    // res 64 (voir `_resAmorce` dans terrain.js) : il n'était jamais destiné à
    // être vu, parce que `loadRealTerrain` le remplace toujours. Ici, justement,
    // il ne le remplace pas. Sans cette ligne, un visiteur dont le réseau lâche
    // verrait un relief grossier là où il voyait un relief procédural fin — ça
    // se lit comme une carte cassée, et ce serait une régression apportée par
    // une optimisation. `_amorce` est retombé à faux, donc ce rebuild est plein.
    // Il coûte ~370 ms, sur un chemin où le chargement a DÉJÀ échoué.
    try { terrain.rebuild(params) } catch (e) { console.error('repli procédural impossible:', e) }
    // ⚠️ ET LE DAMIER PART AVEC. Les dalles voisines portent le relief RÉEL du
    // chargement précédent : les laisser autour d'un centre redevenu procédural
    // donne une carte coupée en deux à la jointure — plage hypsométrique, mer
    // et masques d'un côté, bruit de l'autre. `clear()` est écrite pour ça (les
    // chargements encore en vol atterrissent sans bâtir personne), et le
    // prochain chargement réussi les fait renaître par `sync()`.
    blockGrid?.clear()
    // ══════════ 2,6 s DE VOILE SUR UNE APPLICATION LIBRE — Tâche 2 ══════════
    //
    // ⚠️ **CE `setTimeout(…, 2600)` GARDAIT LA CARTE `#loading` DEUX SECONDES ET
    // DEMIE DE PLUS ALORS QUE `demBusy` EST RELÂCHÉ JUSTE EN DESSOUS**, dans un
    // `finally` qui s'exécute tout de suite. L'application était rendue, et
    // l'écran ne le disait pas — il disait le contraire. Le §9 du plan désigne
    // précisément cet endroit comme la place de l'indicateur discret.
    //
    // Ce qui change : le voile tombe MAINTENANT, et l'indicateur prend le relais
    // — non bloquant, sans flou, sans centre d'écran. Le message d'erreur qui
    // vivait dans `.ld-status` part avec lui, donc c'est l'indicateur qui le
    // porte : sans ça, une panne réseau redeviendrait silencieuse.
    //
    // ⚠️ **`niveaux` N'EST PAS RENSEIGNÉ ICI, ET C'EST EXACT** : on ne sait pas
    // de combien de niveaux on est en retard, on sait que le détail n'est pas
    // arrivé du tout. Inventer un chiffre serait la faute que le §0 interdit.
    hideLoading()
    loadingStatus.textContent = 'generating terrain…'
    indicateurRetard.maj({ enRetard: true, texte: 'relief de détail indisponible — vérifiez la connexion' })
  } finally {
    demBusy = false
  }
}

let rebuildPending = false
// ══════════ `sansRideau` — Tâche 6 septies ═════════════════════════════════
//
// ⚠️ **C'EST LA MÊME LISTE DE CALQUES, ET C'EST TOUT L'INTÉRÊT.** Le vol du MNT
// (`entrerEnVol`) et son atterrissage repassent tous les deux par ICI : une
// seconde fonction « qui rafraîchit les calques » aurait divergé de celle-ci au
// premier calque ajouté — et ce fichier porte déjà, écrit noir sur blanc, le
// récit de **cinq** couches drapées oubliées une par une dans exactement cette
// situation (voir `refreshAerial` / `refreshSol` / `refreshCanopee` /
// `refreshNuit` plus bas). Le seul écart est le RIDEAU : le lever sur une
// application vivante remettrait le pop-up qu'Adrien demande de retirer.
function regenerateTerrain({ sansRideau = false } = {}) {
  if (rebuildPending) return Promise.resolve()
  rebuildPending = true
  if (!sansRideau) showLoading()
  // LE DÉLAI NE SERT QU'À LAISSER LE VOILE SE PEINDRE, et il ne se paie donc
  // qu'une fois. Sur le chemin d'un ZOOM, le voile est levé par
  // fetchAndBuildDem et peint depuis ~170 ms quand on arrive ici : les 50 ms
  // fixes étaient 50 ms de carte d'attente offertes à personne, à chaque zoom
  // (mesuré à La Réunion, séquence z13→z14→z13). On ne garde donc que ce qui
  // MANQUE au voile pour être sûr d'être peint — 50 ms depuis un panneau qui
  // vient de le lever, 0 depuis un zoom.
  // ⚠️ setTimeout et PAS requestAnimationFrame : rAF ne se déclenche JAMAIS
  // dans un onglet caché et la reconstruction resterait en plan. Piège déjà
  // payé trois fois sur ce projet — même à 0 ms, ça reste un setTimeout.
  const delai = Math.max(0, 50 - (performance.now() - loadingVisibleDepuis))
  return new Promise((resolve) =>
    setTimeout(() => {
      terrain.rebuild(params)
      // ══════════ LE GRAIN DES DEUX FINESSES, CUIT SOUS LE VOILE ═════════════
      //
      // ⚠️ MESURÉ, PAS DÉDUIT : sans ce préchauffage la première bascule de
      // finesse gèle **1 516 ms** (vers 768) et la première reprise du doigt
      // **373 ms** (vers 384) — La Réunion z12, chronométré autour de
      // `majResFenetre` sur l'instance vivante. Le gel arrivait 0,4 s après que
      // la carte se soit posée, sans que l'utilisateur ait rien touché : la
      // définition même de « une dégradation qui se voit comme une panne ».
      //
      // `rebuild` juste au-dessus n'a cuit que le grain de la finesse COURANTE ;
      // l'autre reste à découvert. On les demande donc toutes les deux ici,
      // pendant que le voile de chargement est levé et que l'attente est
      // annoncée. Quand rien n'a changé (la plupart des appels : un curseur
      // d'exagération, une palette), c'est une recherche dans une Map.
      //
      // ⚠️ ET C'EST GRATUIT HORS MODE CONTINU : `prechauffeFinesse` sort à sa
      // première ligne si l'emprise n'est pas 3×3.
      if (fenetreContinueActive()) {
        const msChauffe = terrain.prechauffeFinesse(params, resFinesses(params.resolution, RES_FENETRE_CONTINUE))
        if (F3_TRACE && msChauffe > 1) console.info(`[f3] grain préchauffé en ${msChauffe.toFixed(0)} ms`)
      }
      terrain.rebuildRoughness(params)
      plinth.rebuild(terrain, params, socleEmprise()) // walls hug the new relief border (also re-welds the region skirt in region mode — see the plinth.rebuild wrapper)
      terrain.refreshMatTiling(params) // re-tile the relief material to the new zoom scale
      realWater?.rebuild(optionsDeMer()) // water simulation follows the new relief
      const _mlp = mapLayers.rebuild({ dem: terrain.dem, terrain, params }) // water/places re-drape on the new relief
      // The aerial skin has to re-derive here too. This calls mapLayers.rebuild
      // DIRECTLY rather than through the rebuildMapLayers wrapper, and that
      // wrapper was the only thing refreshing the photo — so a zoom change
      // re-drew the vectors but left the OLD mosaic stretched across the new
      // block: imagery that visibly ignored the terrain scale.
      refreshAerial()
      // ⚠️ ET L'OCCUPATION DU SOL AUSSI, POUR EXACTEMENT LA MÊME RAISON — le
      // défaut a été VU avant d'être écrit : parti de Nice en Z12, arrivé à
      // Tokyo en Z16, la mosaïque de Nice restait tendue sur le bloc japonais,
      // avec l'attribution ESA toujours affichée sous une donnée qui n'était
      // plus la bonne. C'est le même piège que le commentaire ci-dessus décrit
      // pour la photo, et il se rejoue à l'identique pour chaque nouvelle
      // couche drapée qu'on ajoute ailleurs qu'ici.
      refreshSol()
      // ⚠️ ET LA CANOPÉE, QUATRIÈME REJEU DU MÊME PIÈGE — branchée ICI ET PAS
      // SEULEMENT dans `rebuildMapLayers`. C'est le trou exact que les deux
      // paragraphes ci-dessus racontent : cette fonction appelle
      // `mapLayers.rebuild` en direct et contourne le wrapper, donc une couche
      // drapée qui ne serait branchée que sur le wrapper garderait, après un
      // changement de zoom, la mosaïque du bloc PRÉCÉDENT tendue sur le nouveau.
      // Des forêts de 40 m posées sur un désert, avec le crédit ETH sous une
      // donnée qui n'est plus la bonne — et rien en console.
      refreshCanopee()
      // ⚠️ ET LES LUMIÈRES NOCTURNES, CINQUIÈME REJEU DU MÊME PIÈGE. Adrien :
      // « pour l'éclairage nocturne, il ne se recalcule pas correctement quand
      // on change d'échelle ». La cause est exactement celle décrite deux
      // paragraphes plus haut : `refreshNuit` n'était appelé que par le
      // wrapper `rebuildMapLayers`, que cette fonction contourne au profit de
      // `mapLayers.rebuild` direct. La mosaïque Black Marble du bloc précédent
      // restait donc tendue sur le nouveau — des villes qui brillent là où il
      // n'y a personne, et rien là où il y a une ville.
      //
      // TROIS couches drapées, TROIS fois le même oubli : la règle à retenir
      // est qu'une couche drapée se rafraîchit ICI **et** dans
      // `rebuildMapLayers`, jamais dans l'un seulement.
      refreshNuit()
      refreshOsmCredit(); _mlp.then(() => refreshOsmCredit())
      regenerateLabels()
      regenerateHud()
      gpxLayer.rebuildAll() // re-drape every loaded track on the new relief
      // The follow camera's rail is BAKED against the terrain at start() time.
      // A terrain rebuild (zoom change, GPX frameTrack reload, exaggeration)
      // moves the ground under a baked rail — the old reactive rigs read the
      // ground live and self-corrected, the rail cannot. Re-bake it here, on
      // the freshly re-draped track, or the camera flies in a stale world —
      // the exact "ca part dans tous les sens" field bug (HUD showed perfect
      // FPA sync yet garbage on screen: right branch, wrong world).
      if (drone.active) {
        const w = gpxLayer.track?.world
        if (w && w.length >= 2) drone.retarget(w)
      }
      if (clouds) clouds.build(params) // deck re-floats above the new relief
      if (peaksLayer.enabled) peaksLayer.refresh()
      if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
      // LE VOILE ATTEND LES CHAMPS DÉPORTÉS (masque de mer + analyse de relief,
      // ~470 ms sur MNT 1536², voir terrain-jobs.js). On ne gagne donc RIEN sur
      // la durée d'attente au premier chargement — on gagne que l'onglet reste
      // VIVANT pendant ce temps : la caméra tourne, l'interface répond.
      // ⚠️ Retirer le voile plus tôt ferait apparaître le peigné des crêtes d'un
      // coup sur une vue déjà affichée. C'est un claquement, et la carte doit
      // rester calme. Si on veut un jour le gain perçu, c'est un fondu de
      // uAnalysisOn — un fondu de peinture, pas de géométrie.
      // ⚠️ `catch` obligatoire : une promesse perdue laisserait `rebuildPending`
      // à true pour toujours et l'application voilée — pire que le gel supprimé.
      ;(terrain.fieldsReady || Promise.resolve()).catch(() => null).then(() => {
        rebuildPending = false
        if (!sansRideau) hideLoading()
        resolve()
      })
    }, delai)
  )
}

// ------------------------------------------------------------------ orbital globe + modes

// ══════════ LA LARGEUR AU SOL DU BLOC — Tâche 6 septies ════════════════════
//
// ⚠️ **C'EST LA SEULE GRANDEUR QUI GÉORÉFÉRENCE VERTICALEMENT LE BLOC, ET ELLE
// N'A PLUS QU'UN LECTEUR DE `dem` : CELUI-CI.** L'échelle verticale, l'altitude
// de cadrage et — par elles — la porte orbitale, le niveau de plongée et la pose
// d'arrivée en descendent toutes. Tant qu'elle venait de `dem.extentMeters`,
// `modes.js` devait ATTENDRE `loadSurface` avant de pouvoir bouger la caméra.
//
// ⚠️ **LA FENÊTRE PASSE EN PREMIER, ET LES DEUX RENDENT LE MÊME CHIFFRE QUAND
// LE MNT EST LÀ** : `recadrerFenetre` pose `largeurM = dem.extentMeters` (voir
// `recadreLaFenetre` plus bas), donc le passage est EXACT — test ⑪c, égalité
// stricte sur trois crans. Ce que la fenêtre ajoute, c'est le cas où le MNT
// n'est PAS encore là : sa `largeurM` vient alors de l'emprise du bloc, qu'on
// connaît sans rien charger (`empriseBlocMNT`).
//
// ⚠️ **ET L'ÉCART DE CE REPLI EST MESURÉ, PAS SUPPOSÉ** (rejeu du 2026-08-21,
// cinq lieux) : la largeur tirée de l'emprise et `dem.extentMeters` diffèrent de
// **6,9e-5 à 4,8e-4 en relatif à z12–z14**, parce que `dem.js` prend le cosinus
// de la latitude DEMANDÉE quand l'emprise prend celle de son centre calé sur la
// grille de tuiles. **À z5 l'écart monte à 3,5 %** — c'est-à-dire aux échelles
// continentales, où le socle n'existe pas (`ZOOM_SOCLE = 13`). Le rapport d'un
// cran, lui, vaut **2,000 ± 0,0014** sur cinq lieux : c'est ce que `_rescale`
// lit, et c'est ce qui compte.
function largeurBlocM() {
  const f = terrain.fenetreBornee
  if (f?.largeurM > 0) return f.largeurM
  return dem?.extentMeters || 0
}

// ══════════ L'ALTITUDE DU PLAN `y = 0` DU BLOC — Tâche R15 ══════════════════
//
// ⚠️ **C'EST L'AUTRE MOITIÉ DE `largeurBlocM()`, ET ELLE PREND LE MÊME CHEMIN
// EXPRÈS.** La similitude bloc → globe a besoin des deux ensemble : la largeur
// dit l'échelle, celle-ci dit à quelle ALTITUDE poser le plan `y = 0`. Les
// prendre à deux sources différentes, c'est décrire un bloc qui n'existe pas.
//
// **Le zéro du bloc n'est pas la mer**, et les deux écrivains le disent avec les
// mêmes mots : `monde/fenetre-bornee.js` (« `y = (hauteur − moyenne) × 56 /
// largeur × exagération` ») et `terrain.js` `_makeDemSampler`
// (`(altitude − dem.meanM) × echelle`). D'où la paire, dans cet ordre.
//
// ⛔ **ET C'EST LE REPLI QUI COMPTE, PAS LA VALEUR — MESURÉ.** `dem` passe à
// `null` pendant TOUT le rechargement d'un cran (relevé image par image,
// `.banc/R15/saut-APRES.json` : `dem true→false` sur huit à seize images à
// chaque cran, `dem.zoom` nul avec). Lire `dem.meanM` seul faisait retomber
// l'ancre à la mer le temps du chargement, **et la caméra de fond plongeait puis
// remontait : ×2,3245 puis ×3,0876 d'altitude en une image**, contre 1,0313 au
// dépôt. La fenêtre bornée, elle, ne disparaît pas — c'est déjà pour ça que
// `largeurBlocM()` la met en premier, et c'est pour ça qu'`altitudeCadrageM()`
// ne bougeait pas d'un mètre pendant ces mêmes images (8 705 → 8 668 m).
//
// ⚠️ **CE QUI RESTE, ET QUI EST LÉGITIME** : au VRAI changement de bloc la
// moyenne change (441 → 367 → 605 → 657 → 939 → 1 149 m sur la descente de
// référence). Ce pas-là est celui du bloc lui-même — le plan `y = 0` se déplace
// vraiment — et il vaut **×1,025 d'une image de bloc à la suivante**, dans le
// bruit du dépôt.
function altitudeAncreBlocM() {
  const f = terrain.fenetreBornee
  if (f?.largeurM > 0 && Number.isFinite(f.moyenneM)) return f.moyenneM
  return params.source === 'real' && Number.isFinite(dem?.meanM) ? dem.meanM : 0
}

// L'ALTITUDE GÉOMÉTRIQUE DE LA CAMÉRA SUR LE BLOC, EN MÈTRES — sans `dem.meanM`.
// C'est la grandeur de cadrage de la règle R1 (voir le hook
// `surfaceCamAltCadrageM` plus bas, qui explique pourquoi il y en a deux).
function altitudeCadrageM() {
  const largeur = largeurBlocM()
  if (params.source === 'real' && largeur > 0) {
    return altitudeSurfaceM({
      camY: camera.position.y,
      extentMeters: largeur,
      span: TERRAIN_SIZE,
      exageration: lireExageration(params),
    })
  }
  return terrain.heightToFeet(camera.position.y) / 3.28084
}

// LA DISTANCE DE LA CAMÉRA À SA CIBLE — la grandeur du REPOS, Tâche R1.
//
// ⚠️ **UN CÂBLAGE, ET RIEN D'AUTRE.** Le calcul, ce qu'il répond, ce qu'il ne
// répond pas, pourquoi son unité est indifférente et pourquoi il ne faut PAS le
// convertir : `monde/grandeur-repos.js`, qui porte aussi la mutation M9 dont il
// est né. ⛔ **Ne remets pas le calcul ici** — il y a vécu une journée, et une
// mutation d'une ligne y a annulé le correctif ① en entier sans faire rougir un
// seul des 4 131 tests.
//
// ⚠️ **CE N'EST PAS UNE SECONDE ALTITUDE**, et les deux lectures partent
// ensemble d'une seule image (voir `majSeuilSocle`) : elles répondent à deux
// questions, pas à la même — §1 de `veille-repos.js`.
function distanceCadrageM() {
  return grandeurRepos({ camera: camera.position, cible: controls.target })
}

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
// ⚠️ **`terreUniqueBranchee` EST DÉCLARÉ PLUS HAUT, AU PARTAGE D'EXAGÉRATION**
// (Tâche M, D10 : la constante ×2 se pose à la CONSTRUCTION du partage, sinon le
// démarrage coûte un rechargement complet de la planète). Le drapeau reste **lu
// une seule fois dans ce fichier** ; la liste de ce qu'il décide, et pourquoi une
// seconde lecture divergerait, est écrite à sa déclaration.
//
// ⚠️ **UN `const` DÉCLARÉ ICI SERAIT DANS LA ZONE MORTE** au moment de
// `creerExagerationPartagee` : une `ReferenceError` au démarrage, que ni un test
// ni `node --check` ne voient.

// ⚠️ **`terre unique` ENTRAÎNE `exagSuivie`, ET C'EST UNE MESURE À L'ÉCRAN QUI
// L'A EXIGÉ, PAS UN GOÛT DE SYMÉTRIE.** La Tâche E fait du globe « le
// quatorzième lecteur » de l'exagération partagée — mais derrière SON drapeau.
// Le crop branché sans elle garde l'exagération du globe, **18**, contre les
// **2,8** du socle qu'il remplace : facteur **6,4**. Relevé à La Réunion z12 le
// 2026-08-21, deux captures au même cadrage (`.banc/vues-I/`) : sans elle un
// champ d'aiguilles où l'île n'est plus reconnaissable, avec elle le bloc
// qu'Adrien attend. **Un crop qui remplace le socle doit avoir sa loi de
// relief** — sinon on ne branche pas le chantier, on le montre cassé.
//
// ⚠️ **CE QUE ÇA NE FAIT PAS :** `exagContinueActive()` a un SECOND lecteur, la
// courbe continue de `syncExagToZoom` — celui-là n'est pas touché. Sous
// `?terre=unique` seul, le globe lit la valeur du socle, **table d'Adrien
// comprise** ; c'est exactement ce que « quatorzième lecteur » veut dire.
// ⚠️ Conséquence à connaître : `?terre=unique&exag=paliers` NE rend PAS son
// exagération 18 au globe. Pour la revoir, il faut baisser `?terre`.
// ⚠️ **`cropAttendu` EST LE QUINZIÈME PASSAGER, ET IL DIT UNE PROMESSE — Tâche
// R3.** Sous `?terre=unique`, ce globe ne servira JAMAIS qu'un crop : la veille
// finira par appeler `poserCrop`, et rien d'autre ne sera montré. Le lui dire
// à la naissance est la seule façon de couvrir la **dizaine de premières
// images** (dernière demande sans crop relevée aux images 3 à 12 selon le
// tirage), pendant lesquelles `majSeuilSocle` attend encore le MNT
// (`largeurBlocM() > 0`) et où le quadtree, laissé libre, descend sur la
// planète entière : **114 demandes de tuiles par chargement**, soit **59,7 %
// des 191 avec `?globe=continu`** et **71,7 % des 159 sans**. Voir `_cropAttendu` dans
// `globe.js` pour le relevé et pour ce que ça coûte quand le MNT ne vient pas.
globe = new Globe({ ...params, globeContinu: globeContinuActif(), exagContinue: exagContinueActive() || terreUniqueBranchee, cropAttendu: terreUniqueBranchee, planeteEclairee: planeteEclaireeBranchee })

// ══════════ LES COULEURS DU BLOC SUR TOUTE LA SPHÈRE — Tâche R11 ═══════════
//
// > **Adrien :** « Les couleurs et le style du bloc devraient s'appliquer à tout
// > le mode sphère. »
//
// ⚠️ **UN SEUL BRANCHEMENT, ET C'EST LE PORTEUR D'UNIFORME, PAS SA VALEUR.**
// `terrain.rebuildRamp` recuit le LUT depuis QUATRE endroits et libère à chaque
// fois la texture d'avant ; passer `.value` ici aurait fait pointer le globe sur
// une texture morte au premier changement de palette. Le globe relit le porteur
// par image (`_majRampeMonde`) : il n'y a rien à re-brancher ailleurs.
//
// ⛔ **ET IL N'EST PAS SOUS `terreUniqueBranchee`.** Ce n'est pas un morceau de
// crop : c'est l'état de repos du MONDE, celui qui vaut précisément quand AUCUN
// crop ne vit. Le mettre sous le drapeau du crop l'aurait éteint là où il est le
// seul à parler.
globe.poserRampeMonde(terrain.mapUniforms.uRampTex)

// ══════════ LA FENÊTRE LIT LE QUADTREE — Tâche 6 quinquies ═════════════════
//
// ⚠️ **C'EST CE CROCHET QUI TUE L'ATTENTE.** Jusqu'ici le socle attendait qu'un
// bloc de MNT soit téléchargé et décodé POUR LUI SEUL (`loadSurface` →
// `fetchAndBuildDem` → `loadDem`) ; ici il lit le cache du quadtree, qui est
// déjà là, déjà rempli par la descente, et qui se raffine tout seul.
//
// ⚠️ **IL EST POSÉ ICI ET PAS DANS `terrain.js`, POUR LA MÊME RAISON QUE
// `fabriqueFenetre`** : `flux-terrain.js` importe `globe.js`, qui importe
// `terrain.js`. L'import inverse fermerait le cycle et jetterait un
// `ReferenceError` **en production seulement** — le piège que la Tâche 6 bis A a
// déjà payé une fois, invisible aux tests comme à `node --check`.
//
// ⚠️ **UN SEUL FLUX PAR GLOBE**, et `flux-terrain.js` l'écrit : `gardeHauteurs`
// est REMPLACÉE à chaque `demanderEmprise`, donc deux flux se reprendraient
// leurs réservations et chacun verrait ses hauteurs disparaître.
let fluxSocle = null
function fluxDuSocle() {
  if (!fluxSocle && globe) fluxSocle = creerFlux({ globe })
  return fluxSocle
}

// Ce que le socle peut dessiner MAINTENANT : les tuiles RÉCLAMÉES qui portent
// des hauteurs lisibles, **et les nappes bathymétriques atterries**. ⚠️ **C'est
// le seul signal de raffinement qui ne coûte rien** : une boucle sur les ~16
// entrées de `flux.reclamees`, contre un parcours de tout le cache du globe
// (des centaines d'entrées) pour `zoomEffectif`.
//
// ⚠️ **IL PORTE LA MER DEPUIS LA TÂCHE 6 sexies**, et la loi vit dans
// `flux-terrain.js` (`revisionFlux`) parce que c'est lui qui sait quand une
// nappe atterrit. Sur le seul compte de tuiles d'ALTITUDE, une bathymétrie
// arrivée APRÈS la dernière tuile ne déclenchait rien : le fond marin était
// chargé, fusionnable, et **jamais affiché**. Un défaut parfaitement muet, que
// seul l'écran aurait rattrapé — le banc le garde désormais.
const tuilesLisiblesDuSocle = (flux) => revisionFlux(flux)

// ══════════ LE RAFFINEMENT — Tâche 6 quinquies, Étape 4 ═══════════════════
//
// ⚠️ **C'EST LA DÉCISION 13 APPLIQUÉE AU SOCLE.** Le socle se dessine à la
// résolution disponible — grossier au premier instant, et c'est attendu — puis
// il s'affine **sans reconstruire quoi que ce soit** dès que les tuiles fines
// atterrissent. Ni géométrie, ni tampon, ni champ, ni masque : seulement des
// `y`, des normales et des couleurs réécrits en place.
//
// ⚠️ **LE SOCLE SUIT, ET SANS LUI ON VERRAIT LE JOUR SOUS LA CARTE.**
// `plinth.js` tire ses parois de `terrain.sample`, qui lit la nappe : raffiner
// l'une sans l'autre laisserait le haut des murs à l'ancienne altitude.
// ⚠️ `null` ET NON `-1` DEPUIS LA TÂCHE 6 sexies : le signal est désormais une
// SIGNATURE (`revisionFlux`), pas un compte. Un sentinelle numérique à côté
// d'une chaîne se lit comme un bogue au premier coup d'œil suivant.
let _socleLisibles = null
function socleRaffine() {
  if (!params.globeContinu || !fluxSocle || !terrain.fenetreBornee) return
  const lisibles = tuilesLisiblesDuSocle(fluxSocle)
  if (lisibles === _socleLisibles) return
  _socleLisibles = lisibles
  if (!terrain.rafraichirFenetre(params)) return
  plinth.rebuild(terrain, params)
}

// ⚠️ **LE CROCHET NE SE POSE QUE SI LE DRAPEAU EST OUVERT, ET C'EST LA GARDE
// LA PLUS SÛRE QU'ON PUISSE ÉCRIRE** : sans lui `_remplirDepuisFlux` rend `null`
// à sa deuxième ligne, et `?globe=continu` garde EXACTEMENT l'image de la
// Tâche 6 ter — le MNT, bathymétrie comprise. Voir `socleQuadtreeActif()`.
if (socleQuadtreeActif()) terrain.hauteursDeFlux = (fenetre, p) => {
  if (!p?.globeContinu) return null
  const flux = fluxDuSocle()
  if (!flux) return null
  const emprise = empriseDuSocle()
  if (!emprise) return null
  // ⚠️ **LE RECADRAGE PASSE AVANT LE REMPLISSAGE, ET SANS LUI LE SOCLE RESTE
  // COLLÉ AU PREMIER LIEU CHARGÉ.** Mesuré à l'écran (Étape 7) : Réunion,
  // Chamonix, Nice et Everest chargés à la suite rendaient les mêmes `minM`,
  // `maxM` et `moyenneM` au mètre près — `_geometrieRebuild` garde la fenêtre
  // tant que sa résolution est bonne, et son emprise était figée à la
  // construction. C'est la décision 3 (« le socle suit le cadrage en continu »),
  // et elle ne coûte pas un sommet : voir `recadrerFenetre`.
  //
  // ⚠️ **DEPUIS LA TÂCHE 6 septies, `_geometrieRebuild` L'APPELLE DÉJÀ** (voir
  // `terrain.recadreFenetre`) : le garder ici n'est pas un doublon inutile, car
  // `rafraichirFenetre` — le raffinement par image — ne passe PAS par
  // `_geometrieRebuild`. Les deux appellent le même écrivain, `cadrageFenetre`,
  // et c'est ce qui interdit aux deux listes de réglages de diverger.
  recadrerFenetre(fenetre, cadrageFenetre() ?? { emprise })
  // ══════════ POURQUOI PAS `remplirBorne` ICI — ET C'EST MESURÉ ═════════════
  //
  // ⚠️ **LA TÂCHE 6 quinquies PRESCRIVAIT `remplirBorne` (règle R3). L'ÉCRAN A
  // DIT NON, ET LE CHIFFRE EST SANS APPEL.** Relevé le 2026-08-21 à Chamonix,
  // `?globe=continu`, MNT chargé, socle posé :
  //
  //   · `debitObserve(flux)` = **0,787 Mb/s** ;
  //   · `zoomSoutenable({ debitObserveMbs: 0,787, zoomDemande: 12 })` = **z5** ;
  //   · le socle réservait donc **UNE tuile, `5/16/11`**, au lieu des **neuf
  //     tuiles z12** que son emprise demande — c'est-à-dire qu'il lisait deux
  //     texels d'une tuile continentale sur toute la largeur du bloc.
  //
  // **Écart mesuré au MNT sur la même grille, avant ce correctif :** 64 à 70 m
  // de moyenne sur la TERRE à Chamonix, et **572 m (Nice) à 961 m (La Réunion)
  // en MER** — le fond marin lu à zéro. Et il ne se corrigeait jamais : rien ne
  // redemandait plus fin tant que la caméra ne bougeait pas.
  //
  // ⚠️ **LA CAUSE N'EST PAS UN RÉSEAU LENT, C'EST UN RÉSEAU OISIF.**
  // `debitObserve` divise des octets par du TEMPS MURAL : sur un lien au repos,
  // quelques petites tuiles étalées sur cinq secondes rendent un débit
  // minuscule. C'est exactement la distinction que `flux-terrain.js` fait déjà
  // pour un flux NEUF (« le manque de mesure et la mesure d'un manque sont deux
  // choses ») — elle vaut aussi pour un flux au repos, et personne ne l'avait
  // écrite.
  //
  // ⚠️ **ET R3 N'A RIEN À ÉCONOMISER ICI :** ces neuf tuiles sont EXACTEMENT
  // celles que `loadDem` télécharge pour le même bloc. Les demander au quadtree
  // ne coûte pas une requête de plus — c'est la MÊME charge, prise à l'autre
  // bout. Rogner ce chiffre ne rend pas le socle moins cher, il le rend faux.
  //
  // R3 garde donc sa moitié « descente » (Tâche 4 ter, `zoomSoutenable` sur les
  // paliers de caméra) ; ici on demande le zoom DU BLOC, et c'est
  // `remplirHauteurs` — du plus grossier au plus fin — qui porte la décision 13.
  // ⚠️ **`aussi` : LES DEUX APPELANTS DOIVENT PASSER LE MÊME, ET C'EST UNE
  // OBLIGATION, PAS UNE SYMÉTRIE.** `demanderEmprise` ANNULE les tuiles qui
  // sortent de `flux.reclamees` : celui des deux qui oublierait la mer
  // annulerait, à chaque image, les tuiles que l'autre vient de demander. Hors
  // `?terre=unique`, `empriseZoomMer()` rend `null` et l'appel est celui du
  // dépôt, au bit près.
  demanderEmprise(flux, { emprise, zoom: params.demZoom, aussi: empriseZoomMer() })
  const borne = { zoom: params.demZoom, zoomDemande: params.demZoom, debitObserveMbs: debitObserve(flux) }
  // ⚠️ **`majHauteurs` NE RECONSTRUIT RIEN** : une passe par TUILE (jamais par
  // pixel — l'interface par pixel coûtait +3,5 ms par reconstruction), puis les
  // `y` et les normales réécrits EN PLACE. 3,5 ms à n = 384, mesuré in situ.
  majHauteurs(fenetre, flux)
  // ⚠️ **LE COMPTEUR SE RECALE ICI, ET PAS AILLEURS.** Un cran change d'emprise
  // donc de tuiles réclamées : laissé sur la valeur d'avant, le raffinement
  // pourrait retomber sur le même compte et ne jamais repartir — un socle qui
  // resterait grossier pour toujours, sans une erreur.
  _socleLisibles = tuilesLisiblesDuSocle(flux)
  // ══════════ L'INDICATEUR DISCRET, NOURRI PAR UNE COUVERTURE OBSERVÉE ══════
  //
  // ⚠️ **ON NE PASSE PAS `etatIndicateur` ICI, ET C'EST LA MÊME MESURE QUI
  // L'INTERDIT que celle du long avertissement ci-dessus.** `etatIndicateur`
  // PRÉDIT le retard depuis `debitObserve` ; sur un lien OISIF ce débit valait
  // **0,787 Mb/s** et `zoomSoutenable` en tirait **z5** pour une demande de z12.
  // L'indicateur serait donc resté ALLUMÉ en permanence sur une connexion
  // parfaite — précisément le « ça rame » mensonger que le §5 de
  // `descente-bornee.js` interdit d'afficher.
  //
  // Ce qu'on lui donne à la place est un FAIT : `zoomEffectif` rend le pire
  // niveau réellement disponible sur l'emprise (ou `null` s'il reste un trou).
  // La différence avec le zoom demandé est le retard, EN NIVEAUX — l'unité
  // qu'Adrien a tranchée, jamais un pourcentage.
  //
  // ⚠️ **`null` ÉTEINT L'INDICATEUR, IL NE L'ALLUME PAS.** Une couverture qu'on
  // ne sait pas encore lire est un manque de mesure, pas la mesure d'un manque.
  const zoomCouvert = zoomEffectif(flux, emprise)
  indicateurRetard.maj(
    Number.isFinite(zoomCouvert)
      ? { enRetard: zoomCouvert < borne.zoomDemande, niveaux: Math.max(0, borne.zoomDemande - zoomCouvert) }
      : { enRetard: false }
  )
  return {
    remplis: fenetre.remplis,
    manquants: fenetre.manquants,
    zoom: borne.zoom,
    zoomDemande: borne.zoomDemande,
    debitObserveMbs: borne.debitObserveMbs,
    zoomCouvert,
  }
}

// ══════ LE CONTEXTE WebGL PERDU, PUIS RENDU (plan « globe continu », 4 sexies)
//
// ⚠️ CE BRANCHEMENT EST LA CONTREPARTIE D'UNE ÉCONOMIE DE 105 Mo, PAS UN
// CONFORT. Les textures du globe relâchent leur canevas dès que le GPU les a
// reçues (`fetchTile`, src/globe.js) : three n'a alors plus de copie CPU à
// réenvoyer et, après une réinitialisation de pilote, il avertirait « Texture
// marked for update but no image data found » en laissant les tuiles vides.
// `rechargeApresContexte()` les redemande — c'est le seul chemin qui les
// repeuple. **Supprimer ces lignes rend le globe vide après une perte de
// contexte, sans qu'aucun test ne rougisse.**
renderer.domElement.addEventListener('webglcontextrestored', () => {
  // enveloppé : une perte de contexte ne doit pas emporter le reste de la scène
  try { globe?.rechargeApresContexte() } catch (e) { console.warn('globe : rechargement après contexte', e) }
})

// ══════════ LES SEIZE TUILES RACINES — LE TROISIÈME APPELANT ════════════════
//
// ⚠️ PIÈGE SILENCIEUX, ET IL SE REFERME SUR DEUX TÂCHES À LA FOIS (plan
// « globe continu », Tâche 1b Étape 2). `globe.chargeRacines()` n'avait QUE
// DEUX appelants, et les deux sont condamnés :
//   1. `hideLoading` ci-dessus — **que la Tâche 2 supprime** ;
//   2. `globe.setVisible(true)` — **que la frontière globe/terrain dissout**.
// Les deux partis, les seize tuiles racines ne seraient plus jamais demandées :
// pas d'erreur, pas de test rouge, pas de sphère nue à l'écran non plus —
// simplement un globe qui ne se peuple jamais. Le troisième appelant est donc
// posé AVANT que l'un des deux ne parte, comme le plan l'exige.
//
// ⚠️ IL NE DOIT PAS DÉFAIRE LA MESURE QUI A CRÉÉ LE DIFFÉRÉ. A/B mesuré
// (dist de production, Chrome, cache vidé, 3 runs, 3 Mb/s) : partir du
// constructeur coûtait 3 730 ms sur l'affichage de la carte. Ce troisième
// appelant est donc un FILET DE SÉCURITÉ à retardement — 20 s après le
// démarrage, bien après que la carte soit à l'écran dans tous les cas mesurés
// (16,2 s dans le pire) — et il ne tire jamais le premier en usage normal.
let racinesGlobeDemandees = false
function assureRacinesGlobe() {
  if (racinesGlobeDemandees) return
  racinesGlobeDemandees = true
  // Enveloppé : une visite qui échouerait à bâtir le globe ne doit rien casser
  // ici — ni le voile de chargement, ni le filet de `setVisible`.
  try { globe?.chargeRacines() } catch { /* le filet de setVisible reste */ }
}
const DELAI_FILET_RACINES_MS = 20000
setTimeout(assureRacinesGlobe, DELAI_FILET_RACINES_MS)

syncGlobeShadow(bgDayMul()) // l'ombre du terminateur part accordée au fond
globe.setVisible(false)
globe.setSunDir(soleilDuGlobe()) // Tâche R7 — même aiguillage qu'en vol
// LE PLANCHER DE NUIT DE LA PLANÈTE — Tâche R7, tour de correction. Drapeau
// baissé, `plancherNuitMonde(false)` est l'IDENTITÉ : la production ne bouge
// pas. Levé, la face nuit reste une CARTE, sombre et froide, au lieu de fondre
// vers le fond crème du décor. Le pourquoi et les mesures : `soleil-monde.js`.
globe.setNuitPlanete(plancherNuitMonde(soleilHeureMonde))
// soleil orbital lié à la caméra (voir tick) — scratch vectors hors boucle
const _orbSun = new THREE.Vector3()
const _upY = new THREE.Vector3(0, 1, 0)

// ══════════ LA FRONTIÈRE DE RENDU — Tâche 1b bis ═══════════════════════════
//
// ⚠️ **CE BLOC EST LE SEUL DU CHANTIER QU'AUCUN TEST NE PEUT CHARGER** (§0 :
// « aucun test ne charge `src/main.js` »). Toute la géométrie a donc été sortie
// dans `src/monde/frontiere-rendu.js`, qui est testé sous node ; ce qui reste
// ici est le BRANCHEMENT, et il s'est prouvé au navigateur — `composer.render()`
// forcé puis `readPixels`, comme les Tâches 4 sexies et 6 ter.
//
// ── CE QUE ÇA CHANGE, ET POURQUOI CE N'EST PAS UNE SCÈNE COMMUNE ────────────
//
// Le globe est une sphère de rayon 100 à l'origine, le bloc une dalle de 56 à la
// MÊME origine : **la dalle est dans la sphère.** Les allumer ensemble montre
// une planète opaque avec la carte enterrée dedans, et les remettre à la même
// échelle demande un rayon de 139 600 unités à z15 — float32 mort. **Donc deux
// passes, et le globe garde son espace.**
//
// ── L'ORDRE, ET CE QU'IL PRÉSERVE ──────────────────────────────────────────
//
//   ① `passeFond`  — rend `sceneGlobe` et **PEINT LE FOND** (le ciel d'Adrien) ;
//   ② `effaceProfondeur` — efface la PROFONDEUR seule, pas la couleur ;
//   ③ le `RenderPass` d'origine — `clear` coupé et `ignoreBackground` posé, donc
//      il dessine le bloc PAR-DESSUS sans repeindre le ciel ni écraser le globe.
//
// ⚠️ **LE CIEL D'ADRIEN NE BOUGE PAS D'UN PIXEL, ET C'EST DÉLIBÉRÉ :**
// `sceneGlobe.background` est **le même objet** que `scene.background`, et
// three dessine un fond de type `Texture` en quad plein écran — donc
// indépendant de la caméra. Le ciel est peint par ① au lieu de ③, à l'identique.
//
// ── CE QUE DEVIENNENT LES EFFETS (Étape 4 de la tâche) ─────────────────────
//
//   · **BROUILLARD — IL N'Y EN A PLUS DU TOUT, et il faut le dire :** `THREE.Fog`
//     a été retiré du dépôt le 2026-08-02 (voir plus haut, « PLUS DE `THREE.Fog`
//     DU TOUT »), `scene.fog` n'est plus jamais posé, et `params.fogColor` n'est
//     malgré son nom que la teinte du FOND. **Il n'y a donc rien à répartir
//     entre les deux passes**, et l'inquiétude du plan est sans objet ici.
//   · **DOF et occlusion ambiante — INCHANGÉS, et c'est arithmétique :** ils
//     lisent le tampon de profondeur. ② l'efface, donc les pixels du globe y
//     valent 1,0 — **exactement la valeur qu'y avait le CIEL avant**, un fond
//     n'écrivant pas de profondeur. Le globe prend la place du ciel, à la même
//     profondeur : les deux passes d'écran le traitent donc à l'identique.
//   · **ATMOSPHÈRE ET NUAGES DU GLOBE — ils vivent DANS `globe.group`**
//     (`globe.js` : « lives inside group so globe.setVisible rules it »), donc ils
//     suivent le globe dans sa passe sans une ligne de plus.
//   · **NUAGES VOLUMÉTRIQUES DE SURFACE — ils restent dans `scene`**, passe ③,
//     intouchés.
//   · **`camera.far` — IL NE FUSIONNE PAS, ET IL N'Y A PLUS RIEN À FUSIONNER.**
//     Le plan disait « ici ou nulle part » ; la réponse est nulle part : avec
//     deux caméras, chacune porte ses plans. Le bloc garde 290, le fond prend de
//     quoi contenir la sphère (`plansFond`).
//
// ── LES DEUX RÉGIMES DE LA CAMÉRA DE FOND ──────────────────────────────────
//
//   · **surface** — `poseFond()` : la similitude bloc → globe. C'est le régime
//     neuf, celui qui fait coexister les deux mondes.
//   · **orbital** — la caméra de fond RECOPIE la principale. La passe ① redevient
//     alors mot pour mot le rendu orbital d'aujourd'hui, et ③ ne dessine rien
//     (tout le décor de surface est masqué). **C'est ce qui rend le drapeau
//     réversible sans brancher de second chemin.**
const frontiereActive = frontiereRenduActive()
const sceneGlobe = frontiereActive ? new THREE.Scene() : null
const camGlobe = frontiereActive ? new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.01, 1400) : null
if (frontiereActive) {
  sceneGlobe.add(globe.group)
  globe.frontiereFond = true // `setVisible` cesse d'éteindre — voir globe.js
  globe.setVisible(false) // rejoué : `enabled` retombe, `group.visible` non
  // ⚠️ **LE FOND EST LE MÊME OBJET, PAS UNE COPIE.** `applyBackground()` réécrit
  // `scene.background` à chaque changement de palette : un clone se serait
  // désynchronisé en silence. On relit donc la référence à chaque image (voir
  // `majCameraFond`), et rien ici ne la fige.
  // ⚠️ **ET LES RACINES SONT DEMANDÉES TOUT DE SUITE, contrairement au régime de
  // production.** Sous ce drapeau le globe est le FOND dès la première image :
  // le filet à 20 s laisserait vingt secondes de sphère nue. **Le prix est
  // connu et mesuré — l'A/B qui a créé le chargement différé compte 3 730 ms
  // sur l'affichage de la carte à 3 Mb/s** ; c'est un coût du drapeau, pas une
  // régression de production, et c'est écrit pour qu'on ne le découvre pas.
  assureRacinesGlobe()
} else {
  scene.add(globe.group)
}

// ⚠️ **LE PIÈGE DE LA CARTE D'OMBRE, ET IL EST SILENCIEUX.** L'application pose
// `renderer.shadowMap.autoUpdate = false` et redessine la carte d'ombre en
// levant `needsUpdate` (voir `majCarteOmbre` et `setEffectsEnabled`). Or
// `WebGLRenderer.render` CONSOMME ce drapeau : la passe de fond, qui rend une
// scène SANS aucun projeteur d'ombre, l'aurait avalé et le bloc n'aurait plus
// jamais reçu sa carte — sans erreur, sans test rouge, juste des ombres figées.
// `skipShadowMapUpdate` de `RenderPass` ne suffit pas : il ne touche
// qu'`autoUpdate`. On sauve et on repose `needsUpdate` autour de la passe.
class PasseFond extends RenderPass {
  render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) {
    const enAttente = renderer.shadowMap.needsUpdate
    super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
    renderer.shadowMap.needsUpdate = enAttente
  }
}

// ══════ UNE SEULE PASSE, UNE SEULE CAMÉRA — TÂCHE D16-a ═════════════════
//
// ⛔ **CE QUI ÉTAIT ICI, ET POURQUOI ÇA N'Y EST PLUS. À LIRE AVANT DE LE
// REMETTRE « par prudence ».**
//
// Le dépôt enchaînait TROIS passes : ① le fond (`sceneGlobe`, `camGlobe`),
// ② `new ClearPass(false, true, false)` — **qui remet la profondeur à 1,0
// partout** — et ③ la surface (`scene`, `camera`), qui n'effaçait plus rien.
// La ② existait parce que le bloc et le globe vivaient dans deux espaces dont
// les profondeurs ne sont pas comparables.
//
// ⚡ **MESURÉ : SOUS `?terre=unique`, LA PASSE ③ DESSINE UN SPRITE DE SOLEIL, ET
// RIEN D'AUTRE.**
//
//   · 969 images de surface, appels de dessin comptés sur `renderer.info.render`
//     autour de chaque passe (`.banc/D16/passes1.json`) :
//       – **60,4 % des images : 0 appel, 0 triangle** ;
//       – les 39,6 % restantes : **168 triangles au pire** ;
//       – la passe de fond, en face : **129 122 triangles en médiane, 286 246 au MAX**.
//     Soit **0,059 % des triangles**, au pire.
//   · Inventaire de la scène du bloc (`.banc/D16/scene2.json`) : **un seul objet
//     visible porteur de géométrie**, un `Sprite`/`SpriteMaterial` en
//     `depthWrite: false` — `SunDisc`. Le maillage du bloc, le socle, les
//     toponymes, les nuages, le trafic, la mer, l'eau et les lieux sont **tous
//     éteints**, à toutes les altitudes (`monde/visibilite-surface.js` l'écrit
//     déjà : « sous le drapeau, la réponse est NON »).
//
// ⛔ **ET CE QUE ÇA COÛTAIT : LE FLOU D'ARRIÈRE-PLAN, ENTIÈREMENT.** La ② mettait
// la profondeur à 1,0 et la ③ n'écrivait plus aucune profondeur (le sprite est
// en `depthWrite: false`) : **le tampon valait 1,0 sur toute l'image.** Mesuré au
// pixel, mise au point balayée de 0,5 à 400 (`scripts/sonde-flou-focus.mjs`,
// `.banc/D16/flou-avant.json`) :
//
//   | configuration | pixels changés sur 1 024 000 |
//   |---|---|
//   | `production` (une passe) | jusqu'à **248 229** (24,24 %) |
//   | `?frontiere=1&terre=deux` (le bloc est encore dessiné) | jusqu'à **220 422** (21,53 %) |
//   | **`?terre=unique`** | **0**, aux sept réglages |
//
//   Témoin (deux rendus au même réglage) : **0 pixel** dans les trois cas.
//
// ⚠️ **L'ARGUMENT ÉCRIT QUI JUSTIFIAIT TOUT ÇA VAUT 0,173 %.** L'en-tête de
// `monde/frontiere-rendu.js` disait qu'un `far` unique reviendrait à « dégrader
// [le] tampon de profondeur [du bloc] pour rien ». La résolution de profondeur à
// la distance `z` vaut `z²(f−n) / (n·f·(2ᵇ−1))` : dès que `f ≫ n` elle ne
// dépend plus de `f` du tout. **Desserrer `far` ×1 448 coûte +0,173 % ; diviser
// `near` par deux coûte +99,7 %.** Les deux chiffres sont dans
// `test/frontiere-rendu.test.js` ⑪, avec le relevé image par image du rapport
// `far/near` niveau par niveau.
//
// ➡️ **Le sprite part donc dans la scène du globe, et les deux passes n'en font
// plus qu'une.**
//
// ⛔ **ET LA FUSION NE VAUT QUE SOUS `?terre=unique` — TROUVÉ EN MESURANT, PAS
// EN RELISANT.** Sous `?frontiere=1&terre=deux`, le maillage du bloc est ENCORE
// DESSINÉ par la passe de surface : la supprimer là aussi faisait disparaître le
// bloc. Mesuré au PSNR entre la même vue avant et après, bokeh éteint :
//
//   | configuration | PSNR avant/après |
//   |---|---|
//   | `production` (témoin : code inchangé) | **44,88 dB** — le plancher de bruit de session |
//   | `?terre=unique` | **45,71 dB** — au niveau du témoin : rien n'a bougé |
//   | `?terre=deux` avec la fusion appliquée à tort | **17,80 dB** — le bloc avait disparu |
//
// **Le critère n'est donc pas « y a-t-il deux passes » mais « la seconde
// dessine-t-elle quelque chose »**, et la réponse ne dépend que de `terre=unique`.
const fusionDesPasses = frontiereActive && terreUniqueBranchee
if (frontiereActive) {
  const passeFond = new PasseFond(sceneGlobe, camGlobe)
  passeFond.skipShadowMapUpdate = true
  composer.addPass(passeFond, 0)
  if (!fusionDesPasses) {
    // `?terre=deux` : le bloc est encore là, on garde la chaîne du dépôt —
    // effacement de PROFONDEUR entre les deux passes, surface sans effacement
    // ni fond. Le flou y répond déjà (mesuré : jusqu'à 220 422 pixels).
    composer.addPass(new ClearPass(false, true, false), 1)
    passeSurface.clearPass.enabled = false
    passeSurface.ignoreBackground = true
  }
}
if (fusionDesPasses) {
  // ⚠️ **`enabled = false` ET PAS `removePass`** : la chaîne est indexée à la
  // main ailleurs dans ce fichier (`composer.addPass(p, 1)` pour l'occlusion
  // ambiante, `composer.passes.length - 1` pour la profondeur de champ). Retirer
  // une passe décalerait ces index en silence. Une passe désactivée est sautée
  // par `postprocessing` : elle ne coûte rien et ne dérange personne.
  passeSurface.enabled = false
  // le seul client réel de la passe supprimée (voir le bloc ci-dessus)
  sceneGlobe.add(sunDisc.sprite)
  // ⚡ **ET LE CARTOUCHE AVEC LUI — Tâche D16-c.** `THREE.Object3D.add` le
  // retire de `scene` au passage : il n'y a jamais deux parents, donc jamais
  // deux cartouches. `majCartoucheGlobe` lui donne sa pose à chaque image.
  sceneGlobe.add(groupeCartouche)
  // ⚡ **ET LE CIEL AVEC LUI — Tâche R20.** Même geste, même raison : le volume
  // de nuages était dessiné dans une scène qui ne l'est plus, et `add` le
  // retire de `scene` au passage — jamais deux parents, jamais deux ciels.
  // `majNuagesGlobe` lui donne sa pose et sa caméra à chaque image.
  sceneGlobe.add(groupeNuages)
  // ⚡ **ET LES COTES D'ALTITUDE AVEC EUX — Tâche R24.** Même geste, même
  // raison : le groupe portait ses 14 plans et était dessiné dans une scène que
  // plus personne ne rend. ⚠️ **Mais celui-ci ne reçoit AUCUNE pose par
  // image** : chaque cote porte déjà sa position de sphère, calculée par
  // `poseur.placer` à la construction, parce qu'une similitude de groupe
  // poserait le relief sur le plan tangent — 2,1 km d'écart à z8.
  sceneGlobe.add(groupeCotes)
  // ⚡ **ET LES EFFETS LISENT MAINTENANT LA BONNE CAMÉRA.** La profondeur du
  // tampon est celle de `camGlobe` ; un effet qui la linéariserait avec les
  // `near`/`far` de la caméra du bloc se tromperait d'espace — c'est exactement
  // la classe de défaut `1/k` que cette tâche existe pour supprimer.
  composer.setMainCamera(camGlobe)
  if (dof) dof.mainCamera = camGlobe
  // ══════ LA CARTOGRAPHIE PASSE DANS LA SCÈNE DU GLOBE — Tâche D16-b ══════
  //
  // > **Adrien :** « Je souhaite avoir la cartographie qui s'affiche sur la
  // > Terre entière. Pour l'instant elle ne s'affiche que sur certains lieux et
  // > avec un zoom important. »
  //
  // ⛔ **LES DEUX CAUSES, ET AUCUNE DES DEUX N'EST LE PLANCHER DE ZOOM.**
  //
  //   ① `water-layer.js` et `places-layer.js` faisaient `scene.add(this.group)`
  //      — la scène du BLOC PLAT, celle dont le bloc juste au-dessus vient de
  //      supprimer la passe. Ils n'étaient pas cachés : ils étaient dessinés
  //      dans un tampon que plus personne ne regarde.
  //   ② `mapLayers.setSurfaceVisible(vue.socle)` les éteignait par-dessus le
  //      marché, `socle` étant borné à faux sous le drapeau.
  //
  // ⚠️ **ET LE PLANCHER `OSM_MIN_ZOOM = 12` N'EN EST PAS UNE — MESURÉ.** Il
  // choisit une SOURCE, pas une présence : sous lui, `water-layer` retombe sur
  // Natural Earth, qui couvre le monde entier (10 771 rivières, 1 345 lacs) et
  // qui est DÉJÀ EMBARQUÉ dans `public/data/map/`. Relevé à l'écran avant toute
  // correction (`.banc/D16b/avant.json`) : les groupes étaient peuplés à z6, z8
  // et z10 comme à z12, et invisibles partout.
  //
  // ⚠️ **LA CAMÉRA DU DÉSENCOMBREMENT SUIT LA SCÈNE.** `places._declutter`
  // projette les noms pour savoir lesquels se chevauchent : projeter des points
  // de sphère avec la caméra du bloc calculerait sur un autre monde.
  mapLayers.poserScene(sceneGlobe)
  mapLayers.setCamera(camGlobe)
  // ⚠️ **LE FABRICANT DE POSEUR — UNE FOIS PAR RECONSTRUCTION, PAS PAR SOMMET.**
  // C'est lui qui capture la liste des tuiles portant encore leurs hauteurs
  // (`tuilesAvecHauteurs`) : sans elle, chacun des milliers de sommets d'un
  // calque reparcourrait `globe.tiles`.
  //
  // ⚠️ **`echelleBloc` EST CELLE DE `terrain._makeDemSampler`, AU CARACTÈRE
  // PRÈS** (`main.js:3433` l'écrit déjà ainsi) : c'est elle qui convertit les
  // mètres du globe en unités de bloc, et une seconde écriture divergerait en
  // silence le jour où l'exagération bougerait.
  mapLayers.poserFabricantDePoseur(({ dem, terrain, params, sample }) =>
    poseurPourReconstruction({
      globe,
      dem,
      sample,
      echelleBloc: (TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1) / dem.extentMeters) * lireExageration(params),
      actif: true,
    }),
  )
}

// LE LAT/LON QUI EST À L'ORIGINE DU BLOC — le miroir de `viseeAuSol()`, pris en
// (0 · 0) au lieu de la cible. **C'est l'ancre de la similitude**, et ce n'est
// PAS le lieu demandé : voir la mesure citée dans `majCameraFond`.
// ⚠️ **GÉNÉRALISÉE À UN POINT QUELCONQUE DU BLOC — Tâche D16, étape 2.** Sans
// argument elle rend exactement ce qu'elle rendait : le lat/lon du CENTRE du
// bloc. Avec `(x · z)` elle rend celui du point `(x · z)` — c'est ce qui permet
// d'ancrer la similitude ailleurs qu'au centre (voir `poseFond`, et la mesure
// des trois ancres candidates qui y est reportée).
function latLonDuBloc(x = 0, z = 0) {
  const f = terrain.fenetreBornee
  if (f?.emprise) return mondeVersLatLonEmprise(f.emprise, x, z, TERRAIN_SIZE)
  if (!dem) return null
  const fen = fenetreContinueActive() && dem?.empriseCote > 1 ? terrain.fenetre : null
  return worldToLatLon(dem, (fen?.x ?? 0) + x, (fen?.z ?? 0) + z)
}
function latLonOrigineBloc() {
  return latLonDuBloc(0, 0)
}

// La caméra de fond, remise à jour AVANT chaque dessin. Deux régimes, décrits
// en tête du bloc ci-dessus.
const _qBloc = new THREE.Quaternion()
function majCameraFond() {
  if (!frontiereActive) return
  // le fond suit la palette : même OBJET que la scène principale, relu à chaque
  // image parce qu'`applyBackground()` le remplace
  sceneGlobe.background = scene.background
  sceneGlobe.environment = scene.environment
  camGlobe.fov = camera.fov
  camGlobe.aspect = camera.aspect
  // ⚠️ **LE DÉCALAGE DE VUE DE L'EXPORT SE PROPAGE, ET SANS ÇA L'AFFICHE SORT
  // FAUSSE.** Le tirage pavé découpe l'image en tuiles avec
  // `camera.setViewOffset` (`composeDecalage`, export-cadrage.js) — qui ne
  // connaît QUE la caméra principale. Sans cette recopie, la passe de fond
  // dessinerait la vue ENTIÈRE dans chaque tuile : la planète se répéterait au
  // complet derrière chaque morceau du bloc. Trouvé par
  // `test/export-effets.test.js`, qui exige qu'une passe nouvelle soit classée.
  // ⚠️ **APRÈS `aspect`, jamais avant** : `setViewOffset` REPOSE `aspect` à
  // `fullWidth / fullHeight` (voir la note de `composeDecalage` dans ce fichier).
  const vueP = camera.view
  if (vueP?.enabled) camGlobe.setViewOffset(vueP.fullWidth, vueP.fullHeight, vueP.offsetX, vueP.offsetY, vueP.width, vueP.height)
  else camGlobe.clearViewOffset()
  if (modes?.mode === 'orbital') {
    // RÉGIME ORBITAL — recopie. La passe ① redevient le rendu d'aujourd'hui.
    // ⚠️ Les deux espaces coïncident : le sprite garde sa pose de bloc telle quelle.
    if (fusionDesPasses) {
      sunDisc.sprite.position.copy(sunDisc.positionBloc)
      sunDisc.sprite.scale.setScalar(sunDisc.echelleBloc)
    }
    camGlobe.position.copy(camera.position)
    camGlobe.quaternion.copy(camera.quaternion)
    camGlobe.near = camera.near
    camGlobe.far = camera.far
    camGlobe.updateProjectionMatrix()
    camGlobe.updateMatrixWorld()
    return
  }
  // RÉGIME SURFACE — la similitude. `largeurBlocM()` est l'emprise RÉELLE du
  // bloc affiché (fenêtre bornée comprise), pas une constante de zoom : R1.
  const largeur = largeurBlocM()
  if (!(largeur > 0)) return
  // ⚠️ **`params.demLat/demLon` SERAIT FAUX, ET LA SONDE À PIXELS L'A ATTRAPÉ.**
  // Le point demandé n'est PAS à l'origine du bloc : le MNT est un carré de trois
  // tuiles, et le centre de ces tuiles tombe où il tombe. **Mesuré à La Réunion,
  // z12 : `latLonToWorld(dem, dem.lat, dem.lon)` rend (−5,65 · 2,64) et non
  // (0 · 0) — soit 1 289 m au nord et 2 760 m à l'est**, ce qui décalait la
  // planète de fond de **28 pixels sur 562**, constants sur tout l'écran. Un
  // décalage CONSTANT est la signature d'une mauvaise ANCRE, pas d'une mauvaise
  // échelle : c'est ça qui l'a fait trouver.
  //
  // ⚡ **ET L'ANCRE N'EST PLUS LE CENTRE DU BLOC, C'EST L'APLOMB DE LA CIBLE —
  // Tâche D16, étape 2.** Le centre du bloc est calé sur la grille de tuiles :
  // il SAUTE de 15,2215° d'arc en une image au cran z3 → z4, ce qui faisait
  // pivoter la caméra de fond de **11,863°** pendant que celle du bloc ne
  // bougeait pas d'un millième. L'aplomb de la cible, lui, traverse : **0,2138°
  // au même cran, 0,000159° en médiane**. Le tableau des trois candidates et
  // leurs chiffres sont dans `poseFond` (`monde/frontiere-rendu.js`).
  //
  // ⚠️ **`origineBloc` NE PORTE QUE x ET z, PAS y.** Le plan du bloc `y = 0` est
  // ce qui se pose sur la sphère de rayon `R_GLOBE` ; la cible, elle, vit à
  // `Y_CIBLE = −0,3`. Lui retrancher son `y` enfoncerait la planète de 0,3 unité
  // de bloc sous la caméra — soit 1 340 m à z12, et 75 km à z3.
  //
  // ⚡ **ET LE PLAN `y = 0` N'EST PAS À LA MER : IL EST À LA MOYENNE DU BLOC —
  // R15.** `monde/fenetre-bornee.js` et `terrain.js` (`_makeDemSampler`) rendent
  // tous deux `(altitude − moyenne) × echelle`. Sans `altitudeAncreM`, `poseFond`
  // posait ce plan sur la sphère nue et enfonçait `camGlobe` de cette moyenne :
  // **1 174 m au-dessus de la mer au Mont-Blanc pour un bloc dont le point le
  // plus bas est à 3 779 m**, donc 2 605 m SOUS lui. Le sol du globe étant
  // dessiné en `FrontSide`, il ne dessinait plus rien — c'est ça, l'« écran vide
  // en montagne » (mesuré aux sept lieux, `.banc/R15/AVANT.json` ; le tableau et
  // le seuil exact sont dans `poseFond`).
  // ⛔ **Ce n'est pas une butée qu'on ajoute** : la hauteur au-dessus du sol
  // redevient `altitudeCadrageM()` exactement, à toute altitude.
  //
  // ⚠️ **LA VALEUR VIENT D'`altitudeAncreBlocM()`, ET SON REPLI EST LE POINT
  // DÉLICAT** — `dem` disparaît pendant chaque rechargement de cran. Le chiffre
  // du dégât est là-bas, avec la mesure.
  // ⚠️ **ET L'EXAGÉRATION EST CELLE DU GLOBE, PAS UNE SEIZIÈME LECTURE DE
  // `lireExageration`.** L'ancre nomme un RAYON sur le globe : lui seul sait où
  // il dessine une altitude, et il le sait dès sa naissance (`globe.js` lit
  // l'exagération au constructeur ET dans `majExageration` — les deux lignes que
  // le recensement de `test/fenetre-branchee.test.js` ①b compte). Sous « une
  // seule terre » elle vaut celle du bloc : **les deux relevées à 2 aux sept
  // lieux du banc.**
  // ⛔ **ET IL N'Y A PAS DE REPLI INVENTÉ** : sans exagération du globe, l'ancre
  // reste à `R_GLOBE` — c'est-à-dire le comportement du dépôt d'avant R15, et
  // pas une valeur devinée qui poserait la planète ailleurs que là où le GPU la
  // dessine.
  const altitudeAncreM = altitudeAncreBlocM()
  const exagAncre = globe?.exaggeration > 0 ? globe.exaggeration : 0
  const ancreXZ = controls.target
  const ancre = latLonDuBloc(ancreXZ.x, ancreXZ.z)
  if (!ancre) return
  const pose = poseFond({
    lat: ancre.lat,
    lon: ancre.lon,
    origineBloc: [ancreXZ.x, 0, ancreXZ.z],
    altitudeAncreM,
    exageration: exagAncre,
    positionBloc: [camera.position.x, camera.position.y, camera.position.z],
    quaternionBloc: camera.getWorldQuaternion(_qBloc).toArray(),
    extentMeters: largeur,
    // ⚠️ `TERRAIN_SIZE` ET PAS `terrain._span()` : c'est le couple qu'emploie
    // déjà `altitudeCadrageM()` vingt lignes plus haut (`largeurBlocM()` avec
    // `TERRAIN_SIZE`). Deux conventions d'échelle dans le même fichier
    // divergeraient en silence — on suit celle qui existe.
    span: TERRAIN_SIZE,
  })
  camGlobe.position.set(pose.position[0], pose.position[1], pose.position[2])
  camGlobe.quaternion.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3])
  // ⚠️ **`rayonDuSol` OU `near` TRANCHE LE TERRAIN — R15.** `near` vaut un
  // cinquième de la hauteur AU-DESSUS DU SOL ; depuis que l'ancre est relevée à
  // l'altitude du bloc, `d − R_GLOBE` ne la donne plus. Le chiffre du dégât est
  // dans `plansFond`. C'est le MÊME rayon que celui de la pose : on ne le
  // recalcule pas, on le redemande à la même loi avec les mêmes arguments.
  const plans = plansFond({ position: pose.position, rayonDuSol: rayonAncre({ altitudeAncreM, exageration: exagAncre }) })
  camGlobe.near = plans.near
  camGlobe.far = plans.far
  camGlobe.updateProjectionMatrix()
  camGlobe.updateMatrixWorld()
  // ⚡ **LE DISQUE SOLAIRE TRAVERSE PAR LA MÊME SIMILITUDE QUE LA CAMÉRA —
  // Tâche D16-a, et c'est ce qui rend le déplacement NEUTRE À L'IMAGE.**
  //
  // Une similitude conserve les angles : si l'on transporte la caméra ET le
  // sprite par la MÊME transformation, la direction apparente et la taille
  // apparente sont **inchangées par construction**. Ce n'est donc pas un
  // réglage à trouver ; c'est une identité, et le banc de pixels la vérifie.
  //
  // ⚠️ **UNE SEULE CHOSE CHANGE, ET ELLE VA DANS LE BON SENS** : le sprite est
  // en `depthTest: true`. Avant, le `ClearPass` avait remis la profondeur à 1,0
  // juste avant lui — **rien ne pouvait donc l'occulter**. Maintenant il est
  // testé contre la profondeur de la planète, dans le MÊME espace : un soleil
  // passé derrière le limbe se cache, au lieu de flotter par-dessus.
  if (!fusionDesPasses) { _kFond = pose.k; return } // `?terre=deux` : le sprite reste dans la scène du bloc
  const poseSoleil = poseFond({
    lat: ancre.lat,
    lon: ancre.lon,
    origineBloc: [ancreXZ.x, 0, ancreXZ.z],
    // ⚠️ **LES MÊMES QUE LA CAMÉRA, ET C'EST OBLIGATOIRE — R15.** `altitudeAncreM`
    // translate l'image de la similitude ; deux valeurs différentes ici et
    // au-dessus déplaceraient le soleil PAR RAPPORT à la caméra, c'est-à-dire
    // exactement ce que la Tâche D16-a a rendu neutre. Le test R15 ④ vérifie que
    // la correction est une translation, donc que le couple traverse ensemble.
    altitudeAncreM,
    exageration: exagAncre,
    positionBloc: [sunDisc.positionBloc.x, sunDisc.positionBloc.y, sunDisc.positionBloc.z],
    quaternionBloc: _IDENTITE, // un sprite fait toujours face à la caméra
    extentMeters: largeur,
    span: TERRAIN_SIZE,
  })
  sunDisc.sprite.position.set(poseSoleil.position[0], poseSoleil.position[1], poseSoleil.position[2])
  sunDisc.sprite.scale.setScalar(sunDisc.echelleBloc * pose.k)
  _kFond = pose.k
}
const _IDENTITE = [0, 0, 0, 1]

// ══════ LE CARTOUCHE PASSE DANS L'ESPACE DU GLOBE — Tâche D16-c ═══════════
//
// **Adrien :** « Répare l'apparition de la data autour du socle — données
// Wikipédia et tout le reste, elles n'apparaissent plus. »
//
// ⚡ **DEUX CHOSES MANQUAIENT, PAS UNE.** ① le drapeau : `groundInfo` était resté
// branché sur `vue.socle` quand les boutons du bas passaient sur `vue.boutons`
// (`monde/visibilite-surface.js` §4) ; ② la SCÈNE : D16-a a supprimé la passe de
// surface, donc `visible = true` seul ne dessinait rien.
//
// ⚠️ **UNE SEULE HOMOTHÉTIE PORTE TOUTES LES LONGUEURS DU CARTOUCHE**, et c'est
// délibéré : tailles de texte, distances au bord, anneau de sécurité, rose des
// vents et gravure murale sont TOUS écrits en unités de bloc dans
// `ground-info-layer.js`. Les convertir un par un, c'est sept occasions de se
// tromper d'un facteur `1/k` (≈ 130 ici, ≈ 3 700 à z16) ; les porter par
// `group.scale`, c'en est zéro.
//
// ⚠️ **L'ANCRE EST L'ORIGINE DU BLOC, PAS LA CIBLE DE LA CAMÉRA.** La caméra de
// fond s'ancre sur l'aplomb de la cible (voir `majCameraFond`, et le tableau des
// trois candidates) parce que ce qu'elle cherche est la CONTINUITÉ au
// franchissement. Le cartouche, lui, doit coller au CROP — et le crop est posé
// sur le centre du bloc (`repereCrop`). Mesuré : la similitude ancrée sur
// l'origine du bloc rend le repère de `crop-parois` à l'epsilon du double,
// position ET quaternion (le relevé est dans `monde/cartouche-globe.js` §1).
function echelleCartouche() {
  const largeur = largeurBlocM()
  return largeur > 0 ? facteurEchelle({ extentMeters: largeur, span: TERRAIN_SIZE }) : 0
}
//
// ══════ ET LA VISIBILITÉ SE DÉCIDE ICI, SOUS LE MODE SPHÈRE ════════════════
//
// ⚠️ **LES QUATRE SITES D'ÉVÉNEMENT NE SUFFISENT PAS, ET C'EST STRUCTUREL.**
// `entrerEnVol` cache, `fetchAndBuildDem` rallume, le relais de mode et
// l'interrupteur d'interface font le reste : quatre ÉVÉNEMENTS. Mais sous le
// mode sphère le bloc naît et meurt sur une ALTITUDE (`veilleCrop`, seuil de
// mort), c'est-à-dire sans qu'aucun de ces quatre ne se produise. Le cartouche
// serait resté posé sur une base retirée.
//
// ⚠️ **ET CE N'EST PAS UN SECOND INTERRUPTEUR** : on n'écrit QUE sur changement
// — une comparaison de booléens par image, le patron d'`orthophotoPeinteDerniere`
// vingt lignes plus haut. Hors mode sphère la fonction rend la main tout de
// suite et les quatre sites gardent la main, seuls.
function majCartoucheGlobe() {
  if (!fusionDesPasses) return // hors mode sphère le groupe est l'identité dans `scene`
  // ⚠️ **`dem` EST DANS LE PRÉDICAT, ET IL PORTE LE VOL.** `entrerEnVol` le met
  // à `null` : sans lui, le cartouche du palier qu'on quitte resterait gravé
  // pendant toute la descente, ce que la note d'`entrerEnVol` interdit.
  const voulu = !!params.groundInfo && !!dem && cartoucheAffiche()
  if (voulu !== groundInfo.group.visible) groundInfo.setVisible(voulu)
  // ⚠️ **SORTIE SÈCHE QUAND LE CARTOUCHE EST CACHÉ.** Ce dépôt a déjà eu un
  // indicateur qui tournait 38 secondes à cause de reconstructions empilées :
  // celui-ci n'est qu'arithmétique, mais il n'a aucune raison de tourner en
  // orbite, et la garde est ce qui l'empêche d'y revenir par inadvertance.
  if (!voulu) return
  const ancre = latLonOrigineBloc()
  if (!ancre) return
  const largeur = largeurBlocM()
  if (!(largeur > 0)) return
  const a = ancrageCartouche({ lat: ancre.lat, lon: ancre.lon, extentMeters: largeur, span: TERRAIN_SIZE })
  groupeCartouche.position.set(a.position[0], a.position[1], a.position[2])
  groupeCartouche.quaternion.set(a.quaternion[0], a.quaternion[1], a.quaternion[2], a.quaternion[3])
  groupeCartouche.scale.setScalar(a.echelle)
}

// ══════ LE CIEL SUIT LA MÊME SIMILITUDE QUE LE CARTOUCHE — Tâche R20 ═══════
//
// ⚡ **UNE SEULE HOMOTHÉTIE PORTE TOUTES LES LONGUEURS DU CIEL** : altitude,
// rayon des nuages, étalement, taille des pas de marche, portée du vent. Le
// volume continue de vivre, de se peupler, de dériver et de se dessiner **en
// unités de bloc**, dans le repère de son groupe. Il n'y a donc PAS quinze
// conversions à écrire, pas de constante à recopier dans le nuanceur, et aucun
// réglage sauvegardé à ré-échelonner.
//
// ⛔ **ET SANS ELLE, LA COUCHE DE NUAGES EST EN ORBITE BASSE.** Le curseur
// « Altitude » vaut 13,5 unités de bloc au démarrage ; portées telles quelles
// en unités de globe elles font **860 085 m** — deux fois l'altitude de la
// station spatiale, et le ciel quitte l'écran par le haut. Multipliées par
// `k`, elles font **6 594 m**, un plafond de cumulus. `1/k` vaut 130,43 à
// La Réunion et dépasse 3 700 aux zooms continentaux
// (`monde/nuages-globe.js` §2, et le test tue la mutation qui met 1).
let _ancreNuages = null
function majNuagesGlobe() {
  if (!fusionDesPasses) return // hors mode sphère le groupe est l'identité dans `scene`
  // ⚠️ **MÊME PRÉDICAT QUE LE CARTOUCHE, ET `dem` Y EST POUR LA MÊME RAISON** :
  // `entrerEnVol` le met à `null`, et un ciel resté accroché au palier qu'on
  // quitte dériverait pendant toute la descente.
  const voulu = !!params.cloudsEnabled && !!dem && cartoucheAffiche()
  if (voulu !== clouds.group.visible) clouds.setVisible(voulu)
  // ⚠️ **SORTIE SÈCHE QUAND LE CIEL EST CACHÉ**, comme pour le cartouche : ce
  // n'est qu'arithmétique, mais ça n'a aucune raison de tourner en orbite —
  // et c'est CE bornage qui rend la voie 3 gratuite (`nuages-globe.js` §0 ter).
  if (!voulu) { _ancreNuages = null; return }
  const ancre = latLonOrigineBloc()
  if (!ancre) { _ancreNuages = null; return }
  const largeur = largeurBlocM()
  if (!(largeur > 0)) { _ancreNuages = null; return }
  const a = ancrageNuages({ lat: ancre.lat, lon: ancre.lon, extentMeters: largeur, span: TERRAIN_SIZE })
  groupeNuages.position.set(a.position[0], a.position[1], a.position[2])
  groupeNuages.quaternion.set(a.quaternion[0], a.quaternion[1], a.quaternion[2], a.quaternion[3])
  groupeNuages.scale.setScalar(a.echelle)
  _ancreNuages = a
}

// LA CAMÉRA DU CIEL, EN UNITÉS DE BLOC — la SEULE grandeur qui traverse la
// frontière dans le sens globe → bloc, et le nuanceur ne peut pas s'en passer :
// il lance son rayon depuis l'œil.
//
// ⛔ **LE SENS DE LA DIVISION EST LE PIÈGE.** `k` vaut 0,0077 : la caméra du
// globe est à ~100 unités de l'origine du monde, mais à ~0,77 unité-globe du
// crop, soit **~75,6 unités de BLOC** — et le relevé du bloc PLAT en vue posée
// donne `y = 72,72` (`monde/visibilite-surface.js` §3). **Deux chemins, 4 %
// d'écart.** Multiplier au lieu de diviser mettrait la caméra à 0,0059 unité de
// bloc du ciel : DANS le nuage à tous les coups, et la marche s'éteindrait sur
// son garde-fou de remplissage (6 pas).
//
// ⚠️ **Hors mode sphère on rend `null`, et `clouds.update` sert alors
// `camera.position` — le comportement du dépôt, au bit près.**
const _camNuages = new THREE.Vector3()
function camNuagesBloc() {
  if (!fusionDesPasses || !_ancreNuages) return null
  const p = positionCameraEnBloc(
    [camGlobe.position.x, camGlobe.position.y, camGlobe.position.z],
    _ancreNuages
  )
  return _camNuages.set(p[0], p[1], p[2])
}

// ══════ LA CHAÎNE D'UNITÉS DE LA MISE AU POINT — Tâche R34, règle D20 ═══════
//
// ⛔ **TROIS ESPACES, ET LE FLOU N'EN LIT QU'UN.** Le bloc (`TERRAIN_SIZE = 56`
// unités pour `largeurBlocM()` mètres), le globe (`R_GLOBE = 100` unités pour
// 6 371 km, soit `ORBITAL_M_PER_UNIT = 63 710 m` l'unité), et la caméra des
// effets, `cameraDeRendu()` — `camGlobe` sous la fusion des passes, c'est-à-dire
// TOUJOURS l'espace globe, en orbite comme en surface, puisque la similitude
// `poseFond` y transporte la caméra du bloc avec `k = largeurBlocM / 56 / 63 710`
// (0,003 83 à z13, 0,007 67 au lieu de démarrage — le `1/k = 130,4` de D16-a).
//
// ⚠️ **`DepthOfFieldEffect` (postprocessing 6.36) COMPARE DES LONGUEURS DE MONDE,
// pas une profondeur normalisée** : `circle-of-confusion.frag` reconstruit
// `length(viewPosition)` depuis le tampon de profondeur et rend
// `smoothstep(0, focusRange, |distance − focusDistance|)`. Le brief supposait un
// `[0, 1]` entre `near` et `far` — vrai des versions < 6.30, plus maintenant ;
// la sonde l'a vérifié (`profondeurMire / d = 1,000` à 5 km comme à 2 000 km).
//
// LA CHAÎNE, chaque facteur chiffré :
//   point de focus (mètres réels, `params.focusDistance`)
//     ÷ `metresParUniteEffets()` — 63 710 m/unité (camGlobe, ou l'orbite) ;
//                                   `largeurBlocM() / 56` hors fusion en surface
//                                   (27 354 / 56 = 488 m/unité à z12 ;
//                                    13 677 / 56 = 244 m/unité à z13)
//     = `cocMaterial.focusDistance`, en unités de la caméra qui lit la profondeur
//   plage de netteté = `params.focusRatio` (k, sans unité) × cette distance
//     = `cocMaterial.focusRange` — donc `k × distance` en mètres aussi, et le
//       cercle de confusion à ±20 % de la distance vaut smoothstep(0,2 / k) quel
//       que soit le zoom : c'est ce qui rend le flou apparent constant (D20, 3).
//
// ⛔ **ET LES PLANS `near`/`far` NE SUIVENT PAS TOUT SEULS.** `copyCameraSettings`
// (postprocessing) copie `camera.near` et `camera.far` PAR VALEUR, une seule
// fois, à la construction ; seules les matrices passent par référence. Or
// `camGlobe.near` vaut 0,025 à 5 km et 0,5 dès 130 km (`planProche`). Mesuré
// (`traces-R34/flou-avant.json`) : le bokeh allumé à 5 km linéarisait encore la
// profondeur avec `near = 0,0246` à 130 km — une mire posée EXACTEMENT à la
// distance de mise au point y sortait à CoC = 1,00 (32 px de flou) alors que sa
// profondeur relue valait 1,000 × f. C'est cela qui « semblait mal fonctionner » :
// la distance écrite était juste (écrit/réel = 0,999 sur 20 images), c'est la
// LECTURE de la profondeur qui était dans l'espace d'une autre altitude. On
// resynchronise donc les plans à chaque écriture — deux comparaisons, pas plus.
//
// `_kFond` : le k de la similitude, mémorisé par `majCameraFond` (sondes).
let _kFond = 1
function metresParUniteEffets() {
  // ⚠️ même `try` que `cameraDeRendu` : `setDofEnabled` est appelée une fois
  // AVANT la déclaration de `modes` (bokeh éteint par défaut, donc sans effet)
  try {
    if (cameraDeRendu() === camGlobe || modes?.mode === 'orbital') return ORBITAL_M_PER_UNIT
    const l = largeurBlocM()
    return l > 0 ? l / TERRAIN_SIZE : 1
  } catch { return ORBITAL_M_PER_UNIT }
}
// une longueur du BLOC (unités) → mètres réels : 56 unités = `largeurBlocM()`
function blocVersMetres(d) {
  const l = largeurBlocM()
  return l > 0 ? (d * l) / TERRAIN_SIZE : d
}
// La mise au point, convertie à UN SEUL endroit. Tous les sites passent par ici,
// sans quoi le prochain qui s'ajoute oublierait la conversion.
function poserMiseAuPoint(distanceM = params.focusDistance, ratio = params.focusRatio) {
  if (!dof) return
  const cam = cameraDeRendu()
  const coc = dof.cocMaterial
  if (coc.uniforms.cameraNear.value !== cam.near || coc.uniforms.cameraFar.value !== cam.far) coc.copyCameraSettings(cam)
  if (distanceM != null) coc.focusDistance = distanceM / metresParUniteEffets()
  if (ratio != null) coc.focusRange = Math.max(0.01, ratio) * coc.focusDistance
}

// ══════ LA MISE AU POINT SOUS LE POINTEUR, À TOUS LES ZOOMS — D20 ═══════════
//
// ⚡ **LE FLOU EST L'EXCEPTION À « LES EFFETS SEULEMENT EN CROP »** (Adrien,
// réponse 1) : la mise au point suit donc le pointeur en orbite, en surface et
// au crop — le tick ne teste plus le mode. Le rayon caméra → pointeur est lancé
// **contre la Terre affichée** : sous la fusion c'est le globe — sphère
// `R_GLOBE` + relief dessiné (`globe.hauteurDessinee`, en mètres, ×
// `uUnitesParMetre`, exagération comprise) — et non le bloc plat : à z4 le
// bloc mesure 7 000 km et la flèche de la sphère à son bord vaut ~960 km. Hors
// fusion en surface, le bloc plat est ce qui est dessiné, et la marche du dépôt
// (`terrain.sample`) reste la bonne.
//
// ⚡ **LE REPLI AU CENTRE GLISSE** (réponse 2) : quand le pointeur quitte la
// toile ou passe sur un panneau, la VISÉE (en NDC) glisse vers le centre de
// l'écran avec une constante de temps de 250 ms, puis la distance suit avec la
// sienne (125 ms, `dt × 8`). Un saut de mise au point se voit comme une
// pulsation du flou ; un glissement ne se voit pas. Le temps mesuré est dans
// `rapport-R34.md` (`repli`).
const CENTRE_ECRAN = new THREE.Vector2(0, 0)
const viseeFocus = new THREE.Vector2(0, 0) // la visée qui GLISSE, en NDC
const TAU_VISEE_FOCUS = 0.25 // s — 63 % du chemin en 250 ms, 95 % en 750 ms
const _pFocus = new THREE.Vector3()
function unitesParMetreGlobe() {
  // la valeur que le NUANCEUR utilise (exagération comprise) ; avant que le globe
  // n'existe, la sphère nue — il n'y a alors rien de dessiné à viser
  return globe?.uniforms?.uUnitesParMetre?.value ?? R_GLOBE / EARTH_RADIUS_M
}
// le rayon DESSINÉ dans la direction de `p` : la sphère + la hauteur que le GPU
// dessine. `candidats` : la liste des tuiles à hauteurs, bâtie UNE fois par
// marche — sans elle `hauteurDessinee` la refait à chaque appel (filtre + tri
// de 100 à 200 tuiles), et c'est là que passaient 0,2 ms par image, mesuré.
let _candidatsFocus = null
function rayonAffiche(p) {
  const { lat, lon } = sphereToLatLon(_pFocus.set(p.x, p.y, p.z))
  const h = globe?.hauteurDessinee?.(lat, lon, _candidatsFocus)
  return R_GLOBE + (h ?? 0) * unitesParMetreGlobe()
}
// distance caméra → Terre affichée sous une visée NDC, en MÈTRES RÉELS ; null = ciel
//
// ⚠️ **MÉMOÏSÉE SUR LA POSE** : la marche coûte 0,10 à 0,17 ms (21 à 29 lectures
// du relief, mesuré) ; tant que ni la visée ni la caméra n'ont bougé, le résultat
// de l'image précédente est le même — et une carte posée, pointeur immobile,
// c'est l'état le plus fréquent. Une tuile qui arrive entre-temps change la
// hauteur dessinée sans bouger la caméra : l'écart se résorbe au premier geste.
const _memoVisee = { x: NaN, y: NaN, cam: null, m: new Float64Array(16), d: null }
function distanceSousLaVisee(ndc) {
  const cam = cameraDeRendu()
  if (cam === camGlobe || modes.mode === 'orbital') {
    const el = cam.matrixWorld.elements
    let meme = _memoVisee.cam === cam && _memoVisee.x === ndc.x && _memoVisee.y === ndc.y
    for (let i = 0; meme && i < 16; i++) if (_memoVisee.m[i] !== el[i]) meme = false
    if (meme) return _memoVisee.d
    focusRay.setFromCamera(ndc, cam)
    _candidatsFocus = globe?.tuilesAvecHauteurs?.() ?? null
    const d = focusRayHitGlobe(focusRay.ray.origin, focusRay.ray.direction, rayonAffiche, {
      rayon: R_GLOBE,
      coque: 9000 * unitesParMetreGlobe() * 1.5 + 0.02, // l'Everest exagéré, et de la marge
    })
    _candidatsFocus = null
    _memoVisee.cam = cam; _memoVisee.x = ndc.x; _memoVisee.y = ndc.y; _memoVisee.m.set(el)
    _memoVisee.d = d == null ? null : d * ORBITAL_M_PER_UNIT
    return _memoVisee.d
  }
  focusRay.setFromCamera(ndc, camera)
  const d = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, { halfExtent: TERRAIN_SIZE / 2 })
  return d == null ? null : blocVersMetres(d)
}

// ══════════ LE SEUIL DU SOCLE — Tâche 3 du plan, BRANCHÉE ══════════════════
//
// ⚠️ **ADRIEN L'A VU AVANT NOUS, CAPTURE À L'APPUI (2026-08-21) :** à Z5 — la
// pose d'arrivée y vaut **920 km** d'altitude de cadrage à 45° (rejeu), et **847
// à 1 024 km** relevés au navigateur à La Réunion — un socle posé devant la Terre
// entière. « J'ai l'impression que tu calcules 2 fois la map, l'une avec la
// terre complète en arrière-plan et l'autre avec le socle. » **Il avait raison,
// et la cause était un oubli de BRANCHEMENT, pas le rendu** : `socleVisible`
// existait, testé et muté depuis la Tâche 3, et `grep -rn 'socleVisible'
// src/main.js` ne rendait rien.
//
// ── LA LISTE DES CALQUES EST SORTIE DU HOOK, ET C'EST TOUT LE GESTE ────────
//
// ⚠️ **UNE SEULE LISTE, JAMAIS DEUX.** Ce fichier raconte cinq fois l'accident
// de la liste dupliquée (voir `entrerEnVol` : « une seconde liste aurait divergé
// au premier calque ajouté »). Le seuil ne fabrique donc pas la sienne : il
// rappelle celle-ci, au caractère près, et un test COMPTE dans ce fichier les
// écritures de visibilité du maillage de surface — il doit y en avoir UNE.
//
// ── CE QUI DISPARAÎT AVEC LE SOCLE, ET CE QUI N'Y EST PAS ─────────────────
//
// Tout ce que la liste touche part ensemble : le maillage, les **étiquettes**,
// le HUD, les **tracés GPX** (ils dessinent avec `depthTest:false` — restés
// seuls, ils flotteraient SUR la planète), les nuages, le **socle et son
// liner** (`plinth`), la jupe de région, le **cartouche** (`groundInfo`), le
// trafic, la **mer** (`realWater`), les calques de carte, et les trois boutons
// de surface — dont le **coin cartographie** (`mapCorner`).
//
// ⚠️ **CE QUI N'EST PAS DANS LA LISTE, ET NE L'ÉTAIT PAS DAVANTAGE AVANT :
// LE DAMIER.** `block-grid.js` ajoute ses dalles voisines directement à
// `scene`, sans groupe ni interrupteur. Elles ne naissent que sous un tracé GPX
// qui déborde du bloc, et `entrerEnVol` les efface à chaque changement de
// palier (`blockGrid?.sync(...)` avec `dem` nul NETTOIE). **Le seuil ne change
// donc rien à leur sort — ni en bien ni en mal —, et l'orbite d'aujourd'hui a
// exactement le même angle mort.** Il est écrit ici pour qu'on ne le
// redécouvre pas.
//
// ⚠️ **SOUS `terre unique`, `v` EST BORNÉ À FAUX, ET C'EST TOUT LE GESTE DE LA
// TÂCHE I.** Le bloc plat ne revient jamais : c'est un CROP dans la planète qui
// prend sa place. **On ne fabrique PAS une seconde liste** — ce fichier raconte
// cinq fois l'accident de la liste dupliquée —, on borne l'ENTRÉE de celle-ci,
// et `socleAffiche()` dit la même chose aux dix-sept sites qui la ré-affirment.
// Sans ça il y aurait encore DEUX Terres : le bloc plat est opaque et se dessine
// dans la passe de surface, donc APRÈS la passe de fond — il recouvrirait le
// crop en entier, et l'écran serait rigoureusement celui d'avant le chantier.
// ⚠️ **ET LE BORNAGE NE DÉBORDE PAS SUR L'INTERFACE — Tâche R1 ②.** Adrien :
// « Il me manque les boutons du bas en UI, ils ont disparu (shuffle, affichage
// photographie aérienne...) ». Cette fonction confondait DEUX questions sous un
// seul booléen : `v` répond à « le maillage du bloc plat est-il dessiné » — non,
// sous le drapeau, à toutes les altitudes — mais les trois boutons du bas
// répondent à « sommes-nous en vue de surface, devant un bloc », et là la
// réponse est OUI : c'est simplement un autre bloc. Le commentaire qui vivait
// sur la ligne d'`isoBtn` le disait lui-même — *« only makes sense over the
// block »*. Il y a un bloc. La loi vit dans `monde/visibilite-surface.js`,
// parce qu'aucun test de ce dépôt ne charge `main.js`.
function poserVisibiliteSocle(v) {
  const vue = visibiliteSurface({ terreUnique: terreUniqueBranchee, surface: v })
  terrain.mesh.visible = vue.socle
  // ⛔ **PLUS `vue.socle` — Tâche R24, et c'est le §6 la seconde moitié.**
  // `socle` est borné à FAUX sous le mode sphère : accroché à lui, le groupe des
  // cotes était éteint à toutes les altitudes alors qu'il portait ses 14 plans
  // (`.banc/R24/avant.json`). Une cote se pose sur le relief qu'on REGARDE, et
  // le relief qu'on regarde est le crop — la question des repères, pas celle du
  // maillage plat.
  labels.visible = vue.reperes && params.labels
  hud3.group.visible = vue.socle
  // GPX sprites draw with depthTest:false — hidden with the surface or
  // they'd float on top of the planet
  gpxLayer.setVisible(vue.socle && params.gpxVisible)
  // ⚡ **`vue.nuages` ET PLUS `vue.socle` — Tâche R20**, et c'est le §5 de
  // `visibilite-surface.js` une QUATRIÈME fois. `socle` est borné à faux sous
  // le drapeau : accroché à lui, le ciel était éteint à toutes les altitudes et
  // à tous les zooms, alors que sa simulation tournait et que ses 16 instances
  // étaient écrites. Les nuages répondent à la question des BOUTONS.
  clouds.setVisible(vue.nuages)
  plinth.setVisible(vue.socle && params.plinth && !params.regionMode)
  // ⚠️ **ET LES PAROIS DE LA DÉCOUPE SUIVENT LE MÊME RÉGLAGE — Tâche R22,
  // option 48.** ⛔ **SANS `vue.socle` DANS LE PRODUIT, ET C'EST LA DIFFÉRENCE
  // DE FOND** : la ligne du dessus éteint le socle du bloc PLAT, dont
  // `vue.socle` dit s'il est dessiné ; les parois du crop, elles, vivent dans la
  // scène du globe, qui est dessinée précisément quand `vue.socle` est faux.
  // Les accrocher à `vue.socle` les aurait éteintes exactement là où on veut
  // les voir.
  globe?.setParoisVisibles?.(!!params.plinth && !params.regionMode)
  if (regionSkirt) regionSkirt.mesh.visible = vue.socle
  groundInfo.setVisible(vue.cartouche && params.groundInfo)
  traffic.setVisible(vue.socle)
  realWater?.setVisible(vue.socle && params.seaEnabled !== false) // cf. setSeaEnabled
  // ⚡ **`vue.carto` ET PLUS `vue.socle` — Tâche D16-b, et c'est LA cause du
  // défaut d'Adrien.** `socle` est borné à faux sous le drapeau : accroché à
  // lui, le calque d'eau et les toponymes étaient éteints à toutes les
  // altitudes et à tous les zooms, alors que leurs groupes étaient peuplés.
  // Depuis D16-b ils vivent dans la scène du globe, posés sur la sphère : leur
  // question est celle des boutons, pas celle du maillage plat.
  mapLayers.setSurfaceVisible(vue.carto)
  isoBtn?.setVisible(vue.boutons) // le raccourci isométrique n'a besoin que d'un bloc, pas du bloc PLAT
  // ⛔ **LE CINÉ SUIT SA PROPRE RÉPONSE, ET IL EST ÉTEINT SOUS LE DRAPEAU** —
  // §3 de `monde/visibilite-surface.js`, qui porte la mesure : ni `shots.stop()`
  // ni le huitième clic ne rendent la vue, la caméra reste dans la mer du crop.
  cineBtn?.setVisible(vue.cine)
  mapCorner?.setVisible(vue.boutons) // coin cartographie : de la surface, pas du maillage
  // ⚠️ **ET `refreshOsmCredit` NE PREND PAS D'ARGUMENT, DONC RIEN À LUI FAIRE
  // SUIVRE.** Elle relit l'état, dont `socleAffiche()`, qui rend faux sous le
  // drapeau — et c'est JUSTE : le crédit GeoNames ne s'affiche que si les
  // toponymes sont à l'écran, or `labels` suit `vue.socle` et reste éteint.
  refreshOsmCredit() // GeoNames credit only applies in surface mode — resync on mode change
}

// L'AUTOMATE, ET SA MÉMOIRE. ⚠️ `appliquer` n'est rappelé QUE sur changement :
// sans cette garde, quatorze calques seraient repassés à chaque image. L'état
// de départ décrit l'application au chargement — socle posé, mode surface —,
// donc **rien n'est appliqué tant que rien ne bouge** et un drapeau éteint
// laisse la production intacte.
//
// ⚠️ **SOUS `terre unique`, L'ÉTAT DE DÉPART DIT « PAS DE BLOC PLAT », ET C'EST
// LA SEULE FAÇON D'EN OBTENIR UNE APPLICATION.** L'automate n'appelle
// `appliquer` que sur CHANGEMENT : en partant de « posé », la première image
// sous le seuil ne changerait rien et le bloc plat resterait à l'écran pour
// toujours, par-dessus le crop. En partant de « absent », cette première image
// applique — et `poserVisibiliteSocle` borne son `v` à faux, de sorte que la
// seule chose qu'elle puisse poser est l'extinction.
const veilleSocle = creerVeilleSocle({
  appliquer: poserVisibiliteSocle,
  socleAuDepart: !terreUniqueBranchee,
})

// LE SOCLE EST-IL À L'ÉCRAN ? — LA RÉPONSE UNIQUE, POUR TOUS LES CALQUES.
//
// ⚠️ **IL EN FALLAIT UNE, ET C'EST L'ÉCRAN QUI L'A DIT.** `poserVisibiliteSocle`
// n'est PAS le seul écrivain de la visibilité des calques : **dix-sept sites de
// ce fichier la ré-affirment avec leur propre condition**, toujours la même —
// `modes.mode === 'surface'` — qui ne connaît que le MODE. Le pire est
// `fetchAndBuildDem` : il rallume le cartouche à CHAQUE palier. Mesuré au
// navigateur (`?globe=crans&frontiere=1&seuil=1`, La Réunion dézoomée à z5,
// altitude de cadrage 1 172 km) : socle retiré, **le cartouche `ground-info` et
// ses huit mailles restaient dessinés SUR la planète**. Un orphelin, et le seul.
//
// ⚠️ **SANS DRAPEAU, CETTE FONCTION EST L'EXPRESSION D'AVANT, AU CARACTÈRE
// PRÈS.** Il n'y a que deux modes (`modes.js` : `'surface'` et `'orbital'`),
// donc `modes?.mode !== 'orbital'` est le même prédicat que le
// `modes.mode === 'surface'` des dix-sept sites, et le `?.` couvre le
// `!modes ||` que `regenerateLabels` et `regenerateHud` écrivaient en plus.
//
// ⚠️ **ET SOUS `terre unique`, LA RÉPONSE EST NON, TOUJOURS.** Le bloc plat a
// cédé la place au crop : laisser l'un des dix-sept sites le rallumer remettrait
// une seconde Terre par-dessus la première. La ligne d'après est celle d'avant,
// au caractère près, pour les deux autres régimes.
function socleAffiche() {
  if (terreUniqueBranchee) return false
  return seuilSocleBranche ? veilleSocle.visible : modes?.mode !== 'orbital'
}

// LE CARTOUCHE EST-IL À L'ÉCRAN ? — LA MÊME QUESTION QUE LES BOUTONS DU BAS.
//
// ⛔ **CE N'EST PAS `socleAffiche()`, ET C'EST TOUT LE DÉFAUT D16-c.** Celle-ci
// répond à « le maillage du bloc PLAT est-il dessiné » — non, sous le drapeau, à
// toutes les altitudes. Le cartouche, comme les trois boutons du bas, répond à
// « sommes-nous devant un bloc » : oui, c'est un crop, et il a une base.
// (`monde/visibilite-surface.js` §4, et le §0 pour la première moitié du même
// défaut, réparée en août.)
//
// ⚠️ **ET CE N'EST PAS UNE SECONDE LISTE** — ce fichier raconte cinq fois cet
// accident. Ce qui se répète ici est le seul PRÉDICAT DE SURFACE, que
// `socleAffiche` borne ensuite à faux ; on ne peut pas l'appeler, puisque son
// bornage est exactement ce qu'on ne veut pas. **La LOI, elle, n'est écrite
// qu'une fois**, dans `visibiliteSurface`.
//
// ⛔ **ET ON NE PEUT PAS LIRE `veilleSocle` SOUS LE MODE SPHÈRE — MESURÉ, PAS
// DÉDUIT.** `majSeuilSocle` passe la main à `veilleCrop` dès la ligne
// `if (terreUniqueBranchee)` et le dit en toutes lettres (« c'est le crop qui
// décide ») : **`veilleSocle` n'est jamais mise à jour**, son état reste celui du
// départ — `socleAuDepart: !terreUniqueBranchee`, c'est-à-dire FAUX pour
// toujours. Une première version de cette fonction lisait `veilleSocle.visible`
// et reproduisait donc le défaut d'Adrien sous un autre nom : cartouche éteint à
// toutes les altitudes, indéfiniment. Vu au navigateur avant d'être compris.
//
// ⚡ **LE PRÉDICAT JUSTE EST CELUI DE LA BASE, ET IL SE LIT TOUT SEUL** : le
// cartouche est posé SUR la base du crop ; s'il y a une base, il y a un bloc.
// `globe.baseYCrop` rend `null` tant que les parois ne sont pas posées, et
// `retirerCrop` l'y remet — au-dessus du seuil de mort comme à la sortie du mode
// surface. C'est la MÊME veille que celle qui décide du crop, lue par son
// résultat plutôt que recopiée.
function cartoucheAffiche() {
  const surface = terreUniqueBranchee
    ? modes?.mode !== 'orbital' && globe?.baseYCrop != null
    : seuilSocleBranche
      ? veilleSocle.visible
      : modes?.mode !== 'orbital'
  return visibiliteSurface({ terreUnique: terreUniqueBranchee, surface }).cartouche
}

// LES REPÈRES SONT-ILS À L'ÉCRAN ? — Tâche R18, et c'est la MÊME question que
// le cartouche et que les trois boutons du bas : « sommes-nous devant un
// bloc ». Un sommet nommé se pose sur le relief qu'on REGARDE.
//
// ⛔ **CE N'EST PAS `socleAffiche()`**, qui répond à « le maillage du bloc PLAT
// est-il dessiné » — non, sous la sphère, à toutes les altitudes. Mesuré aux
// deux bouts de l'interrupteur « Sommets », mouvement ambiant coupé
// (`.banc/R18/fige-defaut`, plancher de bruit 0,0000 sur six relevés) : écart
// moyen **0,000**, gradient **0,000**.
//
// ⛔ **ET ON NE PEUT PAS LIRE `veilleSocle` SOUS LA SPHÈRE** — elle n'est jamais
// nourrie, son état reste FAUX pour toujours. Le prédicat de la base est le
// même que celui du cartouche, pour la même raison, et il est écrit UNE fois.
function reperesAffiches() {
  const surface = terreUniqueBranchee
    ? modes?.mode !== 'orbital' && globe?.baseYCrop != null
    : seuilSocleBranche
      ? veilleSocle.visible
      : modes?.mode !== 'orbital'
  return visibiliteSurface({ terreUnique: terreUniqueBranchee, surface }).reperes
}

// LES COTES D'ALTITUDE SONT-ELLES À L'ÉCRAN ? — Tâche R24, et c'est le §6 la
// SECONDE moitié. R18 a rebranché les SOMMETS sur `reperes` et laissé les COTES
// sur `socleAffiche()` : exactement le partage à moitié fait que le §4 raconte
// pour le cartouche. Les deux interrupteurs sont côte à côte dans le panneau,
// sous le même titre « Repères », et ils répondent à la même question.
//
// ⛔ **MESURÉ, PAS DÉDUIT** (`.banc/R24/avant.json`, La Réunion, mode sphère par
// défaut, cinq altitudes de 18 km à 730 m) : `cotes.total = 14` — le groupe est
// PEUPLÉ — et `groupeVisible = false` **aux cinq**, y compris devant le crop.
const cotesAffichees = () => reperesAffiches()

// ⚠️ **UN SEUL CORPS POUR LES DEUX PANNEAUX.** `setLabelsVisible` était écrit
// DEUX fois — panneau Studio et panneau Carte — avec le même corps recopié.
// Deux écritures d'une même loi divergent en silence, et celle-ci portait
// justement le prédicat à corriger.
function poserCotesVisibles(v) {
  labels.visible = !!v && cotesAffichees()
  return labels.visible
}

// ══════════ LE POSEUR DES SOMMETS — Tâche R18 ═══════════════════════════════
//
// ⚠️ **MÉMORISÉ, ET LA RAISON EST CHIFFRÉE PAR LE MODULE LUI-MÊME** :
// `poseurPourReconstruction` prend la liste des tuiles portant leurs hauteurs
// (`globe.tuilesAvecHauteurs()`), et son propre commentaire dit pourquoi elle
// n'est prise qu'UNE fois par reconstruction — « sans elle, chacun des milliers
// de sommets d'un calque reparcourrait `globe.tiles` ». Ici c'est par IMAGE que
// la question se poserait : les marqueurs sont projetés à chaque tour.
//
// ⚠️ **500 ms, ET C'EST UN CHOIX DE FRAÎCHEUR, PAS DE PERFORMANCE PURE.** Les
// tuiles arrivent du réseau ; un poseur construit une fois pour toutes ne
// verrait jamais celles qui manquaient au démarrage, et les sommets resteraient
// posés sur le repli (le sol du bloc). Un demi-tour de seconde est invisible à
// l'œil sur un marqueur qui suit déjà sa crête.
let poseurReperes = null
let poseurReperesT = 0
function poseurDesReperes() {
  if (!terreUniqueBranchee) return null
  const t = performance.now()
  if (poseurReperes && t - poseurReperesT < 500) return poseurReperes
  poseurReperesT = t
  poseurReperes = poseurPourReconstruction({
    globe,
    dem,
    sample: terrain.sample,
    // ⚠️ **LA MÊME ÉCHELLE QUE LA CARTO, AU CARACTÈRE PRÈS** — recopiée d'une
    // ligne au-dessus (`mapLayers.poserFabricantDePoseur`) et non réinventée :
    // deux écritures de cette conversion divergeraient en silence le jour où
    // l'exagération bougerait.
    echelleBloc: dem ? (TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1) / dem.extentMeters) * lireExageration(params) : 0,
    actif: true,
  })
  return poseurReperes
}

// ⚡ **LA SORTIE DE LA ZONE MORTE — Tâche R24.** À partir d'ici, `globe` ET les
// deux mémoires ci-dessus existent : les cotes peuvent demander le poseur sans
// lever. Voir `poseurDesCotes`, tout en haut, pour pourquoi ce drapeau existe.
poseurCotesPret = true

// ══════════ LES COTES ATTENDENT LES HAUTEURS DU GLOBE — Tâche R24 ══════════
//
// ⛔ **UNE COTE EST DE LA GÉOMÉTRIE : ELLE EST POSÉE UNE FOIS, ET ELLE Y RESTE.**
// C'est ce qui la sépare des sommets, qui sont du DOM reprojeté à chaque image
// et que `PeaksLayer.update` ré-ancre tout seul toutes les 30 images. Les
// hauteurs du globe arrivent du RÉSEAU : les cotes construites avant elles sont
// posées sur le repli — le sol du bloc plat — et rien ne les reprendrait jamais,
// puisque `regenerateLabels()` n'est rappelé qu'à la reconstruction suivante.
//
// ⚡ **LA REPRISE EST BORNÉE, ET C'EST LE POINT.** Au plus `COTES_REPRISES`
// reconstructions par MNT, une par seconde, et elle s'arrête dès que le poseur
// ne refuse plus aucun point (`poseur.refus`). ⛔ Une reprise non bornée, sur un
// endroit que les tuiles ne couvriront jamais, rebâtirait 14 canevas par seconde
// pour toujours — le genre de gaspillage silencieux que ce chantier collectionne.
const COTES_REPRISES = 5
const COTES_PERIODE_MS = 1000
let cotesDem = null
let cotesEssais = 0
let cotesT = 0
function majCotesGlobe() {
  if (!terreUniqueBranchee) return
  if (cotesDem !== dem) { cotesDem = dem; cotesEssais = 0; cotesT = 0 }
  if (cotesEssais >= COTES_REPRISES) return
  const t = performance.now()
  if (t - cotesT < COTES_PERIODE_MS) return
  const p = poseurDesCotes()
  // `poseurPourReconstruction` rend le poseur PLAT tant qu'aucune tuile ne porte
  // ses hauteurs : tant qu'il est plat, il n'y a rien de neuf à poser.
  if (!p?.globe) return
  // rien à reprendre si la dernière construction n'a essuyé aucun refus
  if (labels?.userData?.refusCotes === 0) { cotesEssais = COTES_REPRISES; return }
  cotesT = t
  cotesEssais++
  regenerateLabels()
}

// ⚠️ **L'ENTRÉE EST UNE ALTITUDE GÉOMÉTRIQUE, PAS UNE FRACTION D'ÉCRAN — RÈGLE
// R1**, et c'est la seule ligne de ce branchement qui ne se rattrape pas.
// `altitudeCadrageM()` est l'instrument que la Tâche 1b a purgé de `dem.meanM`
// exprès (voir le hook `surfaceCamAltCadrageM` juste dessous, qui explique
// pourquoi il y a DEUX altitudes dans ce fichier). Une fraction d'écran
// dépendrait de la distance au sol, donc du terrain chargé, donc de `meanM`,
// qui est lissé : gain plus retard font un oscillateur, et le précédent Cesium
// est exact.
//
// ⚠️ **SANS DRAPEAU, CETTE FONCTION REND LA MAIN TOUT DE SUITE**, et le socle
// reste à tous les zooms — le comportement d'aujourd'hui, celui de la
// production. Le drapeau exige `?frontiere=1` : voir `seuilSocleActif()`.
// ⚠️ **`terre unique` L'ENTRAÎNE, ET CE N'EST PAS UN RACCOURCI.** Sous ce
// drapeau, `socleAffiche()` doit lire `veilleSocle.visible` et non le mode : le
// bloc plat n'a plus à exister du tout, et la branche « mode » le rallumerait à
// chaque retour en surface. Les deux drapeaux décrivent la même bascule, l'un en
// retirant le bloc plat, l'autre en le remplaçant.
const seuilSocleBranche = seuilSocleActif() || terreUniqueBranchee
// ⚠️ **CE QU'ON A DIT AU CRÉDIT LA DERNIÈRE FOIS — Tâche R9, tour de
// correction.** `null` au départ, donc la première image tranche toujours. Voir
// le pavé dans `majSeuilSocle` : sans cette mémoire, `refreshOsmCredit`
// tournerait à chaque image et toucherait le DOM soixante fois par seconde.
let orthophotoPeinteDerniere = null
function majSeuilSocle() {
  if (!seuilSocleBranche) return
  // ══════ ⚠️ ON NE DÉCIDE PAS PENDANT UN CRAN, ET C'EST MESURÉ ══════════════
  //
  // ⚠️ **LE CRAN EST UN OSCILLATEUR, ET IL S'EST VU À L'ÉCRAN AVANT DE SE
  // COMPRENDRE.** Relevé le 2026-08-21 (`?globe=crans&frontiere=1&seuil=1`, La
  // Réunion, sept crans z5 → z12) : **onze bascules** au lieu d'une. Le journal
  // par image dit pourquoi, et ce n'est pas le seuil qui est en cause :
  //
  //   | alt lue | socle | zoom | busy | largeur | camY  |
  //   | 40 751  |   1   |  9   |  0   | 219 km  | 29,19 |  ← avant le cran
  //   | 20 375  |   0   |  10  |  1   | 109 km  | 29,19 |  ← largeur ÷2, camY PAS ENCORE
  //   | 40 751  |   1   |  10  |  0   | 109 km  | 58,38 |  ← camY ×2, l'altitude revient
  //
  // **`largeurBlocM()` est divisée par deux UNE IMAGE AVANT que `_rescale` ne
  // double `camera.position.y`.** Entre les deux, `altitudeCadrageM()` rend
  // exactement LA MOITIÉ de la vraie altitude — et la moitié de 40 751 tombe de
  // l'autre côté des deux seuils. Le socle naissait et mourait à chaque cran.
  //
  // ⚠️ **CE N'EST PAS UNE VIOLATION DE R1, C'EST SA CONFIRMATION.** R1 interdit
  // de décider sur une grandeur dérivée du chargé ; `largeurBlocM()` est
  // l'emprise du bloc CHARGÉ, et pendant un cran elle est désaccordée de la
  // caméra. Le remède n'est pas de changer d'instrument — `altitudeCadrageM()`
  // reste le seul sans `meanM` — c'est de **ne pas décider pendant que les deux
  // moitiés sont désaccordées**. `modes.busy` marque exactement cet intervalle :
  // il est vrai sur TOUTES les images du transitoire, mesuré.
  //
  // ⚠️ **ET LA SECONDE GARDE VAUT LA PREMIÈRE.** Sans MNT ni fenêtre bornée,
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
  if (terreUniqueBranchee) {
    // ⚠️ **UNE SEULE LECTURE D'ALTITUDE, DEUX CONSOMMATEURS — Tâche K bis.** La
    // veille du crop et l'échelle de couleur continue doivent décider sur la
    // MÊME altitude à la MÊME image. Deux appels à `altitudeCadrageM()` seraient
    // deux valeurs (la caméra bouge entre les deux dans la boucle de rendu ? non
    // — mais le patron se recopie, et c'est ainsi que naissent les désaccords
    // que ce chantier a payés trois fois). Une variable, deux lecteurs.
    const alt = altitudeCadrageM()
    // ⚠️ **ET LA DISTANCE À CÔTÉ, LUE À LA MÊME IMAGE — Tâche R1.** Ce ne sont
    // PAS deux lectures de la même grandeur : la naissance du crop et
    // l'estompage demandent « à quelle distance du sol suis-je » (l'altitude),
    // la veille du repos demande « l'utilisateur change-t-il d'échelle » (la
    // distance). Deux questions, deux grandeurs — le §1 de `veille-repos.js`
    // porte la mesure qui a réfuté le principe inverse. Ce qu'elles doivent
    // partager, c'est l'IMAGE, et c'est pour cela qu'elles partent d'ici
    // ensemble, en un seul appel.
    const dist = distanceCadrageM()
    veilleCrop.maj(alt, dist)
    // ══════ LE CRÉDIT SUIT LA PHOTO, ET IL FAUT LE LUI DIRE — Tâche R9 ═══
    //
    // ⛔ **SANS CETTE RESYNCHRONISATION, LA CORRECTION DU CRÉDIT NE S'AFFICHE
    // JAMAIS.** `refreshOsmCredit` est appelée sur ÉVÉNEMENT — au clic, à la fin
    // de `refreshAerialCore`, au changement de mode. Or à l'instant où
    // `refreshAerialCore` pose la mosaïque sur le socle et appelle le crédit, le
    // globe ne l'a PAS encore : c'est `veilleCrop` qui la lui donne, **à l'image
    // suivante** (`CHAMPS_HABILLAGE`, la course de la Tâche K ter). Le crédit
    // serait donc calculé sur un crop encore vierge, et plus rien ne le
    // redemanderait — la mention resterait absente pendant que la photo est à
    // l'écran, c'est-à-dire exactement le défaut qu'on répare.
    //
    // ⚠️ **ET ELLE NE COÛTE QU'UNE COMPARAISON DE BOOLÉENS PAR IMAGE** : la
    // même garde que `veilleEstompage` et que `rafraichirHabillage` — on
    // n'appelle QUE lorsque l'état posé change. `refreshOsmCredit` reconstruit
    // une chaîne et touche le DOM ; l'appeler soixante fois par seconde serait
    // la faute que `CHAMPS_HABILLAGE` évite deux lignes plus loin.
    const peinte = orthophotoPeinteSurLeCrop(globe?.uniforms)
    if (peinte !== orthophotoPeinteDerniere) {
      orthophotoPeinteDerniere = peinte
      refreshOsmCredit()
    }
    // ⚠️ **L'ÉCHELLE GLISSE ICI, ET NULLE PART AILLEURS.** `poserRampe` ANCRE
    // (à l'arrêt, `pas²` points) ; cet appel-ci ÉVALUE la courbe (quatre
    // cubiques) et pose les uniformes. Sans ancre il ne fait rien, donc rien
    // tant que la chaîne du crop n'a pas pris.
    globe?.majEchelleRampe(alt)
    // ══════ L'HORLOGE DE LA COUCHE APPARENCE — Tâche P3 ═══════════════════
    //
    // ⚠️ **ELLE NE PASSE PAS PAR `CHAMPS_HABILLAGE`, ET C'EST UNE OBLIGATION** :
    // `uFxTime` avance à chaque image (`terrain.js` : `uFxTime.value += dt ×
    // speed`). Dans la liste surveillée, il mettrait `habillageDifferent` à vrai
    // soixante fois par seconde et reposerait l'habillage ENTIER — textures
    // comprises — à chaque image.
    //
    // ⚠️ **ET ON RECOPIE L'HORLOGE DU SOCLE PLUTÔT QUE D'EN AVANCER UNE
    // SECONDE** : deux compteurs sur deux `dt` finiraient déphasés, et le motif
    // du crop ne serait plus celui du bloc à la même seconde.
    globe?.poserTempsApparence(terrain.mapUniforms.uFxTime.value)
    return
  }
  veilleSocle.maj(altitudeCadrageM())
}

// ══════════ L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, décision 3 ═══════════
//
// « La planète autour du crop se fond progressivement vers le fond à mesure
// qu'on descend, pour que le bloc se détache. »
//
// ⚠️ **C'EST LA TÂCHE QUI REND L'IMAGE JUGEABLE.** Avant elle, poser le crop ne
// creusait pas un trou dans la planète : il effaçait la planète et gardait le
// trou (Tâche A, vérifié par la Tâche D à `y = 900`), pendant que l'atmosphère —
// un matériau SÉPARÉ, que le `discard` ne touche pas — continuait de remplir le
// cadre. D'où « une grosse boule laiteuse avec un timbre-poste dessus ».
//
// ⚠️ **DERRIÈRE `frontiere=1`, ET C'EST LE BON DRAPEAU.** L'estompage n'a de
// sens que là où le globe EST le fond, c'est-à-dire dans la passe de fond de la
// Tâche 1b bis. Sans le drapeau, `poserEstompage` n'est jamais appelée et
// `uEstompageOn` reste à 0 : les trois nuanceurs du globe rendent ce qu'ils
// rendaient avant, au bit près.
//
// ⚠️ **LA VEILLE VIT DANS UN MODULE**, comme celle du socle et pour la même
// raison : aucun test ne charge ce fichier, et l'état inter-images est
// précisément ce qui se casse en silence.
const veilleEstompage = creerVeilleEstompage({ appliquer: (f) => globe?.poserEstompage(f) })

// ══════════ LE REPOS DE LA VUE — Tâche N, « LE STUDIO SUR LE GLOBE » ═══════
//
// **Adrien, 2026-08-22** : « Tout ce qui est en dehors du crop ne doit pas
// s'afficher. Ça ne s'affiche que si on dézoome, puis ça recrop quand la vue est
// stabilisée. On ne calcule donc pas les éléments hors crop sauf si dézoom ou
// zoom pour faire la transition. »
//
// ⚠️ **ELLE N'EST NOURRIE QUE PAR `veilleCrop`, ET C'EST LA MÊME RÈGLE QUE
// L'ESTOMPAGE** : trois automates qui décident à la même image doivent décider
// sur la MÊME lecture d'altitude. Un second `altitudeCadrageM()` ici serait le
// troisième chemin d'un geste qui n'en a qu'un — l'argument est écrit trois fois
// dans ce fichier, et il a été payé trois fois.
//
// ⚠️ **AUCUN RÉGLAGE PASSÉ ICI.** Les deux nombres (`SEUIL_BOUGE_LOG`,
// `IMAGES_CALME`) sont mesurés et vivent dans le module avec leur source ; les
// dupliquer ici en ferait deux jeux qui divergent d'une version.
const veilleRepos = creerVeilleRepos()

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
// contrediraient à l'écran, et c'est mot pour mot l'argument écrit trois lignes
// plus haut pour l'ordre des deux appels dans `tick()`.
function majEstompage() {
  if (!frontiereActive) return
  if (terreUniqueBranchee) return
  if (modes?.busy || !(largeurBlocM() > 0)) return
  veilleEstompage.maj(altitudeCadrageM())
}

// ══════════ LA LOI DE TEXTURE ANCRÉE AU MONDE — Tâche K ════════════════════
//
// ⚠️ **LUE ICI ET NULLE PART AILLEURS, ET LE `fov` EST LU EN DIRECT.** Le §0 du
// plan a payé deux fautes critiques là-dessus : le code dit `FOV_DEG = 30`
// (`main.js:289`) mais l'application vivante tourne à **33** parce qu'un
// template repose `params.fov`. Un seuil dérivé d'un fov écrit en dur serait
// faux de 10 % sur toute la session, en silence.
//
// ⚠️ **ET LA HAUTEUR EST CELLE DU TAMPON DE DESSIN, PAS CELLE DU CSS.** Sur un
// écran Retina le tampon fait deux fois la hauteur en points ; prendre
// `clientHeight` doublerait les mètres par pixel et ferait disparaître les
// courbes de niveau sur les seules machines à forte densité — un défaut que
// personne ne reproduirait sur son poste.
//
// ⚠️ **SOUS DRAPEAU, ET LE DÉFAUT EST L'ANCIEN.** Hors `?terre=unique`, la loi
// est RETIRÉE : `uMppFacteur` retombe à 0 et le nuanceur reprend `fwidth(vUv) ×
// uTilePx`, au bit près. La vue orbitale en production ne bouge pas.
const _tailleDessin = new THREE.Vector2()
function majLoiTextureMonde() {
  if (!globe) return
  if (!terreUniqueBranchee) { globe.retirerLoiMonde(); return }
  renderer.getDrawingBufferSize(_tailleDessin)
  const cam = frontiereActive ? camGlobe : camera
  const ancre = latLonOrigineBloc()
  globe.poserLoiMonde({
    fovDeg: cam?.fov ?? camera.fov,
    hauteurPx: _tailleDessin.y,
    lat: Number.isFinite(ancre?.lat) ? ancre.lat : 0,
  })
}

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
// `zoom` de `repereCrop` ne sert qu'à `demi = tuilesParBloc / 2 / 2^zoom` : ce
// qu'on veut, c'est que `demi` vaille exactement la demi-largeur du bloc en
// mercator. La déduire de l'emprise RÉELLE rend ça vrai par construction, y
// compris pendant l'image où `params.demZoom` a déjà changé et où l'emprise
// n'a pas suivi — le désaccord d'une image qui a valu onze bascules au seuil.
//
// ⚠️ **CE QUE CE CONTEXTE NE PORTE PAS, ET IL FAUT LE DIRE :**
//   · ~~**`remplir` pour la mer, donc PAS DE BATHYMÉTRIE.**~~ ✅ **RÉPARÉ PAR LA
//     TÂCHE J**, et il faut dire comment, parce que l'obstacle écrit ici était
//     réel : `demanderEmprise` REMPLACE `gardeHauteurs` à chaque appel (« un seul
//     flux par globe »), donc un SECOND appel pour la mer aurait repris au bloc
//     ses réservations. La sortie n'est pas un second appel, c'est **une seule
//     réservation qui connaît les deux emprises** — `demanderEmprise` a été
//     ÉLARGIE d'un `aussi` dont le défaut (`null`) reproduit le dépôt au bit
//     près. Et la portée de la calotte n'est plus l'horizon (256 demi-largeurs)
//     mais `PORTEE_CROP = 3`, l'emprise 3×3 du mode plat : c'est ce qui rend
//     l'emprise de la mer réservable.
//   · **le grain** reste à zéro — ⚡ **ET LA MESURE QUI MANQUAIT EXISTE
//     MAINTENANT (Tâche P9), ELLE DIT QUE ÇA NE VAUT PAS LA CONVERSION.**
//     `_makeDemSampler` ajoute `detail × fbm` en UNITÉS DE SCÈNE sur
//     `scale = (span / dem.extentMeters) × exagération` : à la valeur vivante
//     (`detail = 0,02`, `scale = 0,004 090`) cela fait **6,60 m de relief**, de
//     longueur d'onde **611 m**. Posé sur le crop à sa conversion exacte
//     (`grainForceM = detail × largeurCropM / COTE_CROP_UNITES / exagération`
//     = **4,89 m** ; `grainEchelle = detailScale × COTE_CROP_UNITES / 2` =
//     **22,4**, parce que `qCrop` couvre ±1 là où le socle indexe des unités de
//     scène), il déplace l'énergie de détail de **10,972 à 10,972 — 0,000 %**,
//     et la luminance moyenne de **0,002 octet**. Il faut **×50** (244 m de
//     relief inventé) pour gagner 4,4 %, et le curseur, lui, est plafonné à
//     `NATURAL_DETAIL_MAX = 0,15`, soit **36,7 m**. ⛔ **Une cinquième monnaie à
//     convertir pour un zéro mesuré : non porté, et c'est une décision, pas un
//     oubli.** La recette est ci-dessus pour qui la voudra.
//     (`.banc/P9/S5-relief-P9.json`, aller-retour à 0 canal.)
// Le LIEU et la LARGEUR du crop, seuls — extraits de `contexteCrop` par la
// Tâche J. ⚠️ **PARCE QUE DEUX APPELANTS EN ONT BESOIN, ET QU'UNE SECONDE
// ÉCRITURE DIVERGERAIT** : `contexteCrop` (ce que la chaîne reçoit) et
// `empriseZoomMer` (ce que la réservation doit couvrir) doivent tomber sur
// EXACTEMENT le même repère, sinon la mer se remplirait à côté du bloc.
function assietteCrop() {
  const centre = latLonOrigineBloc()
  if (!Number.isFinite(centre?.lat) || !Number.isFinite(centre?.lon)) return null
  const emprise = terrain.fenetreBornee?.emprise || empriseDuSocle()
  if (!emprise) return null
  let large = emprise.est - emprise.ouest
  if (large <= 0) large += 360 // franchissement de l'antiméridien — convention de `seuil-socle.js`
  if (!(large > 0)) return null
  const zoom = Math.log2((360 * BLOCK_TILES) / large)
  if (!Number.isFinite(zoom)) return null
  return { centre, zoom }
}

// ══════════ LA MER DEMANDE SON PROPRE ZOOM — Tâche J, trou n° 2 ════════════
//
// ⚠️ **VINGT-CINQ, ET C'EST LA MESURE DE LA TÂCHE F QUI LE DIT** : sur un champ
// de mer de 164 km, « z12 ne couvre que 19,3 % des nœuds ; **z10 en couvre
// 100 % pour 25 tuiles** ». Le budget est donc celui-là, et le zoom s'en déduit
// (`zoomPourEmprise`) au lieu d'être posé.
const TUILES_MER_MAX = 25

// ⚠️ **LE SEUIL DE REFUS DE LA MER, ET IL N'EST PAS À 1 COMME CELUI DES PAROIS.**
// Les parois et la rampe échantillonnent la FRONTIÈRE du crop, où un point
// manquant fait une encoche visible ; le champ de la mer est une texture de 385²
// lue en interpolation linéaire, où quelques nœuds de bord manquants ne se lisent
// pas. Ce qu'il faut interdire est le champ VIDE — celui qui a été mesuré à
// **0,7 %** de couverture et qui rendait un aplat gris.
const COUVERTURE_MER_MIN = 0.99

/**
 * L'emprise que la MER doit couvrir, et le zoom auquel la demander.
 *
 * `null` hors `?terre=unique` : la réservation retombe alors exactement sur
 * celle du dépôt, et `demanderEmprise` reçoit `aussi: null`.
 */
// Le flux est-il là pour nourrir la mer ? ⚠️ **`fluxDuSocle()` FABRIQUE LE FLUX
// AU PREMIER APPEL** et rend `null` tant que `globe` n'existe pas : sans cette
// garde, `remplir` serait posé sur un `null` et `_cuireChampMer` compterait sa
// couverture à **1** par son repli (`r && Number.isFinite(...) ? … : 1`),
// c'est-à-dire un champ vide déclaré plein.
const fluxMerPret = () => terreUniqueBranchee && !!fluxDuSocle()

function empriseZoomMer() {
  if (!terreUniqueBranchee) return null
  const a = assietteCrop()
  if (!a) return null
  const rep = repereCrop({ centre: a.centre, zoom: a.zoom, tuilesParBloc: BLOCK_TILES })
  const emprise = empriseCalotte(rep, PORTEE_CROP)
  return { emprise, zoom: zoomPourEmprise(emprise, { zoomMax: params.demZoom, tuilesMax: TUILES_MER_MAX }) }
}

// ══════════ LA MATIÈRE DU RELIEF, LUE SUR LE MATÉRIAU — Tâche R25 ══════════
//
// ⚠️ **UN BLOC À PART PLUTÔT QUE DIX LIGNES DANS `contexteCrop`, POUR UNE RAISON
// PRÉCISE** : il a **un refus** (le verre) et **une conversion d'unité**, et les
// deux méritent d'être lisibles sans dérouler cinq cents lignes de contexte.
//
// ⛔ **LE VERRE SORT PAR LE HAUT, ET CE N'EST PAS UNE PRUDENCE.**
// `setMaterialMode('glass')` REMPLACE `mesh.material` et **ne touche ni
// `material.map` ni `uTint`** : sans ce refus, choisir « Verre » après « Roche
// brute » aurait laissé le globe peindre de la roche — un défaut qui ressemble
// à « la vignette ne réagit pas » alors que c'est l'inverse.
function matiereDuCrop() {
  const m = terrain.material
  if (terrain.materialMode === 'glass' || !terrain.materialMode || !m?.map) return {}
  // ⚠️ `repeat.x` EST DÉJÀ LE PRODUIT COMPLET (`preset.repeat × scale ×
  // zoomRepeat(demZoom)`), et `normalScale.x` déjà `bump × preset.normalScale`.
  // Les redériver depuis `params` serait une seconde écriture des deux lois.
  return {
    matMap: m.map,
    matNormal: m.normalMap || null,
    matRepeat: m.map.repeat?.x ?? null,
    matBump: m.normalScale?.x ?? null,
    // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`** : `setMatNoise` porte
    // les trois dérivations (`×1,0`, `×0,55`, `0,12 + ×0,16`) que
    // `params.terrainMatNoise` ne porte pas.
    matNoiseOn: terrain.mapUniforms.uMatNoiseOn.value > 0.5,
    matNoiseCut: terrain.mapUniforms.uMatNoiseCut.value,
    matNoiseSoft: terrain.mapUniforms.uMatNoiseSoft.value,
    matNoiseScale: terrain.mapUniforms.uMatNoiseScale.value,
    matAboveZero: terrain.mapUniforms.uMatAboveZero.value > 0.5,
    // ⚠️ **LA CONVERSION EST FAITE ICI, comme `contourIntervalM`, et pour la
    // même raison** : elle a besoin de `dem.extentMeters` et de l'exagération
    // VIVANTE, que le globe n'a pas. Et **le `span` est celui du bloc VIVANT**
    // (`TERRAIN_SIZE × empriseCote`), la même expression que les deux voisins :
    // en mode continu le bloc couvre plusieurs emprises.
    matBandeM: bandeZeroMatiereM({
      bandeBloc: BANDE_ZERO_BLOC,
      extentMeters: dem?.extentMeters,
      exageration: lireExageration(params),
      span: TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1),
    }),
  }
}

function contexteCrop() {
  const a = assietteCrop()
  if (!a) return null
  const { centre, zoom } = a

  // ⚠️ **LES UNIFORMES SE LISENT UN PAR UN, JAMAIS EN BLOC.** `terrain.mapUniforms`
  // cédé à une variable est une poignée sur le bloc central, et
  // `test/damier-uniformes.test.js` (③) l'exige déclarée : ce qu'un porteur de
  // poignée écrit n'atteint jamais les dalles voisines. Ici on ne fait que LIRE,
  // et le plus simple est de ne pas prendre la poignée du tout.
  const cote = terrain.mapUniforms.uCoastMaskOn.value > 0.5 ? terrain.mapUniforms.uCoastMask.value : null
  const sol = terrain.mapUniforms.uSolOn.value > 0.5 ? terrain.mapUniforms.uSol.value : null
  // ══════════ LA PHOTO AÉRIENNE — Tâche R9 ═══════════════════════════════════
  //
  // ⛔ **LE BOUTON ÉTAIT VISIBLE ET INERTE.** `mapCorner.toggleAerial`
  // (`ui/bars.js`) → `ctx.toggleAerial` → `refreshAerial` → `refreshAerialCore`
  // → `aerialLayer.build(bounds)` → `terrain.setAerial(built)`. La chaîne
  // entière tournait — elle allait au réseau, composait la mosaïque, posait le
  // crédit — et **s'arrêtait sur le maillage plat**, invisible sous
  // `?terre=unique`. Rien ne manquait au socle : c'est le dernier maillon,
  // `contexteCrop → poserHabillage`, qui n'existait pas.
  //
  // ⚠️ **MÊME PATRON QUE `cote` ET `sol` JUSTE AU-DESSUS** : l'interrupteur du
  // socle décide, la texture suit. `uAerialOn` porte déjà les quatre refus de
  // `refreshAerialCore` (couche éteinte, pas de MNT, zone sans couverture,
  // plancher NASA trop grossier) — le lire ici, c'est en hériter sans en écrire
  // un cinquième.
  //
  // ⚠️ **ET `uAerial.value` N'EST PAS `null` QUAND LA COUCHE EST ÉTEINTE** :
  // `terrain.setAerial(null)` ne touche QUE `uAerialOn`, la texture noire 1×1
  // (ou la mosaïque périmée) reste liée. Sans la garde sur l'interrupteur, le
  // globe recevrait donc une texture toujours vraie et **la photo ne
  // s'éteindrait jamais**.
  const aerien = terrain.mapUniforms.uAerialOn.value > 0.5 ? terrain.mapUniforms.uAerial.value : null
  // ══════════ LA COLORISATION NATURELLE — Tâche P2 ═══════════════════════════
  //
  // ⛔ **LE TROU QUI FAISAIT DIRE À ADRIEN « PLUS AUCUNE TEXTURE SUR LA TERRE ».**
  // Ce contexte ne transmettait AUCUNE texture d'analyse. Or `terrain-analysis.js`
  // en cuit une, empaquetée en RGBA (R peigné, G ombrage, B humidité,
  // A exposition), et le gabarit d'ouverture (`shibustart.json`) la demande à
  // fond : `colorMode: "natural"`, `texShade: 1`, `wetK: 0,96`. **Elle existait,
  // elle était payée, et personne ne la passait au globe.**
  //
  // ⚠️ **MÊME PATRON QUE `cote` ET `sol` JUSTE AU-DESSUS, ET CE N'EST PAS UN
  // STYLE** : l'interrupteur du socle décide, la texture suit. `uAnalysisOn` vaut
  // déjà 0 hors du mode Naturel (`terrain.js`, `setColorMode`) et tant que le
  // travailleur n'a pas rendu son champ — le lire ici, c'est hériter des deux
  // gardes sans en écrire une troisième.
  const analyse = terrain.mapUniforms.uAnalysisOn.value > 0.5 ? terrain.mapUniforms.uAnalysis.value : null
  // ⚠️ **LE LUT 2D PASSE TOUJOURS, MODE NATUREL OU PAS.** En Classique
  // `rebuildRamp` le cuit constant en Y, et sa ligne médiane EST la rampe
  // historique (`terrain.js` : « aucune palette du catalogue n'a besoin d'être
  // ré-éditée ») ; ce qui compte alors, ce sont `heightContrast` et
  // `heightPivot`, qui valent dans les DEUX modes et que le gabarit « realistic »
  // pousse à 5,1. Le conditionner au mode Naturel les aurait laissés morts.
  const rampe2D = terrain.mapUniforms.uRampTex.value || null
  // l'amplitude du relief du crop : elle CALE l'intervalle des courbes de niveau
  // (le globe posait 500 m en dur, ce qui ne trace qu'une courbe à l'île Maurice)
  const f = terrain.fenetreBornee
  const amplitudeM = Number.isFinite(f?.maxM) && Number.isFinite(f?.minM)
    ? f.maxM - f.minM
    : (Number.isFinite(dem?.maxM) && Number.isFinite(dem?.minM) ? dem.maxM - dem.minM : null)

  // ⛔ **L'ENVIRONNEMENT DE LA PAROI N'EST PAS CELUI DU RELIEF — Tâche P8.** La
  // règle est celle de `three` et elle est écrite dans `environnementEffectif` ;
  // ici on ne fait que l'appliquer au matériau de paroi VIVANT. `?.` parce que
  // `contexteCrop` tourne aussi avant que la plinthe existe.
  const envParoi = environnementEffectif(
    plinth?.wallMat?.envMap ?? null,
    plinth?.wallMat?.envMapIntensity,
    scene.environment,
    scene.environmentIntensity
  )

  const ctx = {
    centre,
    zoom,
    tuilesParBloc: BLOCK_TILES,
    // ══════════ LA FORME DU BLOC — Tâche P6 ═══════════════════════════════════
    //
    // ⛔ **`poserCrop` PORTE `half`, `corner` ET `expo` DEPUIS LA TÂCHE A ET
    // PERSONNE NE LES A JAMAIS PASSÉS.** Le bloc du crop était donc un CARRÉ À
    // ANGLES VIFS pendant que celui du socle est un squircle : relevé le
    // 2026-08-22 au même instant dans la même page, `uCropCoin = 0` et
    // `uCropCoinN = 2` contre `uSlabCorner = 2,24`, `uSlabCornerN = 4,4`,
    // `uSlabHalf = 28`. **C'est la silhouette du bloc, et elle se voit sur les
    // quatre coins.** La Tâche P4 avait même relevé le zéro en passant, sans y
    // voir un branchement absent.
    //
    // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params` — MÊME RÈGLE QUE POUR
    // LES DIX CURSEURS D'ATLAS ET POUR LES LAMPES.** `terrain.js` porte deux
    // règles que `params` ne porte pas : l'écrêtage du rayon
    // (`min(TERRAIN_SIZE/2 − 0,05, max(0,05, slabCorner × TERRAIN_SIZE))`, donc
    // un plancher NON NUL même à tirette zéro) et `exposantCoin`, qui traduit la
    // douceur en exposant de superellipse. Passer par `params` aurait redérivé
    // les deux.
    //
    // ⚠️ **ET `uSlabHalf` VIVANT, PAS 28 EN DUR** : c'est lui qui NORMALISE le
    // rayon, et la fenêtre continue le déplace. C'est déjà l'argument que
    // `fxDemiBloc` porte quelques lignes plus bas.
    forme: {
      half: terrain.mapUniforms.uSlabHalf?.value ?? 28,
      corner: terrain.mapUniforms.uSlabCorner?.value ?? 0,
      expo: terrain.mapUniforms.uSlabCornerN?.value ?? 2,
    },
    // ══════════ LA PROFONDEUR DU BLOC — Tâche P6 ══════════════════════════════
    //
    // ⛔ **`construireParoisCrop` PORTE `profondeur` DEPUIS LA TÂCHE B, ET
    // PERSONNE NE L'A JAMAIS PASSÉE.** Le crop vivait donc sur
    // `FRACTION_PROFONDEUR = 7 / 56`, c'est-à-dire `params.plinthDepth` et
    // `TERRAIN_SIZE` **à leur valeur d'usine**. Relevé le 2026-08-22 :
    // `plinth.depth = 7` — donc **concordant par coïncidence**, exactement comme
    // les deux couleurs de la lame d'eau. La tirette « profondeur » creusait le
    // bloc plat et laissait celui du crop où il était.
    //
    // ⚠️ **`plinth.depth`, PAS `params.plinthDepth`** : c'est `rebuild` qui
    // écrit `this.depth = params.plinthDepth ?? this.depth`, donc le MATÉRIEL
    // qui dit la vérité — la règle de `plinth.wallMat.color` (manque n° 2 du
    // noteur), appliquée à la géométrie.
    //
    // ⚠️ **EN FRACTION DE LA LARGEUR, PAS EN UNITÉS** : le §4 de
    // `parois-crop.js` l'écrit — « recopier 7 dans un crop qui fait 0,163 unité
    // de large aurait donné un puits de quarante fois sa largeur ». Le
    // dénominateur est la LARGEUR du socle, donc `2 × uSlabHalf`.
    parois: {
      fractionProfondeur: plinth.depth / (2 * (terrain.mapUniforms.uSlabHalf?.value || 28)),
    },
    habillage: {
      coastMask: cote,
      sol,
      solLut: sol ? terrain.mapUniforms.uSolLut.value : null,
      solOpacite: terrain.mapUniforms.uSolOpacite.value,
      solOffset: terrain.mapUniforms.uSolOffset.value,
      solScale: terrain.mapUniforms.uSolScale.value,
      solTexel: terrain.mapUniforms.uSolTexel.value,
      // ══════ LA PHOTO AÉRIENNE — Tâche R9 ═══════════════════════════════════
      //
      // ⚠️ **L'AFFINE PASSE TOUJOURS, MOSAÏQUE OU PAS**, comme `solOffset` /
      // `solScale` : ce sont des `Vector2` **MUTÉS EN PLACE** par
      // `terrain.setAerial`, donc leur identité ne bouge jamais et
      // `poserHabillage` les recopie composante par composante. Les conditionner
      // à `aerien` n'aurait rien économisé et aurait ajouté une branche.
      aerial: aerien,
      aerialOpacite: terrain.mapUniforms.uAerialOpacity.value,
      aerialOffset: terrain.mapUniforms.uAerialOffset.value,
      aerialScale: terrain.mapUniforms.uAerialScale.value,
      // ⚠️ **LE FONDU CÔTIER — TOUR DE CORRECTION DE R9.** La tirette « Fondu à
      // la côte » du panneau de carte (`ui/map-panel.js`) appelle
      // `terrain.setAerialCoastFade` : sans cette ligne, elle bougeait le socle et
      // laissait le crop couvrir la mer en plaques. Relevé par la relecture sur le
      // socle, La Réunion z9, fondu 0,1 contre 0 : **72,7 % des pixels, écart
      // moyen 93,6/255**.
      aerialCoastFade: terrain.mapUniforms.uAerialCoastFade.value,
      amplitudeM: amplitudeM > 0 ? amplitudeM : null,
      // ══════ L'INTERVALLE DES COURBES — Tâche R19 ═════════════════════════
      //
      // ⚠️ **LA TIRETTE EST EN UNITÉS DE BLOC, LE GLOBE EST EN MÈTRES**, et
      // c'est la classe de défaut n° 1 de ce chantier. `poserHabillage` porte
      // déjà la préférence (`contourIntervalM > 0` d'abord, l'amplitude
      // ensuite) : il ne lui manquait QUE cette valeur.
      //
      // ⚠️ **LE `span` EST CELUI DU BLOC VIVANT** — `TERRAIN_SIZE × empriseCote`,
      // la même expression que `mapLayers.poserFabricantDePoseur` et que
      // `poseurDesReperes` : en mode continu le bloc couvre plusieurs emprises,
      // et un `span` figé à 56 diviserait l'intervalle par cette même emprise.
      //
      // ⚠️ **`null` SI LE MNT N'EST PAS LÀ**, et alors la calibration
      // automatique sur l'amplitude reprend la main — c'est le repli, pas une
      // panne.
      contourIntervalM: intervalleCourbesBloc({
        valeurBloc: terrain.mapUniforms.uContourInterval.value,
        extentMeters: dem?.extentMeters,
        exageration: lireExageration(params),
        span: TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1),
      }),
      contourOpacity: terrain.mapUniforms.uContourOpacity.value,
      contourWeight: terrain.mapUniforms.uContourWeight.value,
      // ══════ LA GRILLE DE RELEVÉ — Tâche R22, options 19 et 20 ════════════
      //
      // ⛔ **CES DEUX CURSEURS N'AVAIENT AUCUN RECEVEUR : LE NUANCEUR DU CROP
      // N'AVAIT PAS UNE LIGNE DE GRILLE.** Ce n'était donc pas un
      // rebranchement mais une écriture (`globe.js`, bloc « LA GRILLE DE
      // RELEVE DU BLOC »). Mesuré avant, fenêtre 1:1 512 × 320 : **0,0000**
      // pour l'opacité comme pour la taille.
      //
      // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`** — même règle que
      // pour les dix curseurs d'Atlas et pour l'intervalle des courbes
      // au-dessus : `ui/map-panel.js` écrit `terrain.mapUniforms.uGridStep`
      // EN DIRECT, sans repasser par `params` à tous les coups.
      //
      // ⚠️ **LA VALEUR PART EN UNITÉS DE BLOC, ET C'EST VOULU** : la
      // conversion en mètres a besoin de la largeur au sol du crop
      // (`largeurCropM`), que seul le globe possède. Elle est donc faite dans
      // `poserHabillage`, avec sa formule écrite dans `pasGrilleBloc`.
      // ⛔ Ne PAS la faire ici avec `dem.extentMeters` : les deux largeurs
      // diffèrent de **0,0079 %** (27 354,3 m contre 27 356,4 m à La Réunion,
      // relevé), et le compte de cellules cesserait d'être celui du socle.
      gridStepBloc: terrain.mapUniforms.uGridStep.value,
      gridOpacite: terrain.mapUniforms.uGridOpacity.value,
      gridCouleur: `#${terrain.mapUniforms.uGridColor.value.getHexString()}`,
      // le span du bloc VIVANT — même expression que `contourIntervalM`
      gridSpanBloc: TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1),
      // ══════ LA NORMALE PAR FRAGMENT — Tâche P9 ═══════════════════════════
      //
      // ⚠️ **VRAI DÈS QU'IL Y A UN CROP, ET PAS UN RÉGLAGE.** Ce n'est pas une
      // option d'utilisateur : c'est la réparation d'un désaccord de MAILLAGE
      // entre les deux Terres — 5 625 sommets sur le bloc côté globe contre
      // 594 434 côté socle. Le §6 de `monde/eclairage-crop.js` porte la mesure
      // qui l'a nommé et celle de ce qu'il rend.
      normaleFine: true,
      // ══════ LA COLORISATION NATURELLE — Tâche P2 ═════════════════════════
      //
      // ⚠️ **LES SEPT SOUS-RÉGLAGES D'ATLAS PASSENT ICI, ET LES DEUX CURSEURS DE
      // RAMPE AVEC EUX.** L'inventaire les comptait morts : `texShade`, `wetK`,
      // `expoK`, `treeLine`, `hazeAmt` **ne traversaient pas** ; `rampDry`,
      // `rampWet` et `rampOklab` non plus. Les cinq premiers sont des uniformes ;
      // les trois derniers arrivent **cuits dans `rampe2D`**, ce qui est
      // précisément pourquoi on partage la table du socle au lieu d'en rebâtir
      // une. `heightContrast` et `heightPivot` ferment les deux derniers.
      //
      // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`.** `applyColorParams`
      // est la seule écriture de ces valeurs, et elle porte deux règles que
      // `params` ne porte pas : les défauts (`?? 0`, `?? 0.62`) et surtout
      // `uHemi`, que le socle dérive de la LATITUDE du MNT et non d'un réglage.
      // Passer par `params` aurait fait diverger le globe du bloc le jour où
      // l'une de ces règles change — le défaut que la Tâche K ter a payé.
      analyse,
      rampe2D,
      texShade: terrain.mapUniforms.uTexShade.value,
      wetK: terrain.mapUniforms.uWetK.value,
      expoK: terrain.mapUniforms.uExpoK.value,
      hemi: terrain.mapUniforms.uHemi.value,
      treeLine: terrain.mapUniforms.uTreeLine.value,
      heightContrast: terrain.mapUniforms.uHeightContrast.value,
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
      // ══════ L'ÉCLAIRAGE DU BLOC — Tâche P3, manque n° 1 du noteur ═════════
      //
      // ⛔ **LE CROP N'AVAIT PAS L'ÉCLAIRAGE DU SOCLE : IL AVAIT CELUI DE LA
      // PLANÈTE, ET LA PLANÈTE EST ÉCLAIRÉE PAR SA CAMÉRA.** La boucle d'image
      // repose `globe.setSunDir(_orbSun)` à chaque tour, sur
      // `camGlobe.position` tournée de 42°, pour qu'aucune face visible du
      // globe ne soit dans la nuit. Bon pour une planète, faux pour un bloc :
      // l'ombrage du crop suivait le point de vue, pas l'heure.
      //
      // ⚠️ **ON LIT LES LAMPES, PAS `params` — MÊME RÈGLE QUE POUR LES DIX
      // CURSEURS D'ATLAS JUSTE AU-DESSUS.** `placeSun` porte deux règles que
      // `params` ne porte pas : l'atténuation d'un soleil rasant
      // (`0,35 + 0,65 · sin(el)^0,7`, normalisée sur 16°) et l'interrupteur
      // `sunOn`, qui met l'intensité à zéro SANS retirer la lampe. Passer par
      // `params.sunIntensity` aurait donné un bloc encore éclairé la nuit,
      // soleil coupé.
      //
      // ⚠️ **L'AZIMUT ET L'ÉLÉVATION, EUX, VIENNENT DE `params`, ET C'EST LE BON
      // CHOIX** : `sun.position` porte en plus le rayon 34, et `applyTimeOfDay`
      // est le SEUL écrivain de ces deux angles (il les dérive de l'heure et du
      // lieu, `daycycle.js`). Une grandeur, une source.
      centreLat: centre.lat,
      centreLon: centre.lon,
      soleilAzimut: params.sunAzimuth,
      soleilElevation: params.sunElevation,
      soleilCouleur: `#${sun.color.getHexString()}`,
      soleilIntensite: sun.intensity,
      hemiCiel: `#${hemi.color.getHexString()}`,
      hemiSol: `#${hemi.groundColor.getHexString()}`,
      hemiIntensite: hemi.intensity,
      // ⚠️ **LES DEUX INTENSITÉS MULTIPLIENT, ET three LES APPLIQUE TOUTES LES
      // DEUX** : `scene.environmentIntensity` (le cycle horaire la réécrit à
      // chaque heure) et `material.envMapIntensity` (0,15 relevé sur le
      // matériau du relief). En oublier une donnait un facteur 6,7.
      // ⛔ **UNE SEULE INTENSITÉ, ET LA PREMIÈRE VERSION EN METTAIT DEUX.**
      // `material.envMapIntensity` (0,15 sur le relief) est du CODE MORT ici :
      // `three` l'écrase par `scene.environmentIntensity` quand le matériau n'a
      // pas d'`envMap` à lui (`WebGLRenderer.js`, r172), et
      // `terrain.material.envMap === null`. Le facteur 6,7 que ça donnait a été
      // attrapé par la mesure du socle, pas par la lecture du code.
      //
      // ⚠️ **`coefAmbiante` REND UN OBJET GELÉ MIS EN CACHE PAR TEXTURE** : son
      // identité ne bouge pas, donc `Object.is` le voit égal et l'habillage ne
      // se repose pas à chaque image. C'est la contrainte que
      // `CHAMPS_HABILLAGE` impose à tout ce qui n'est ni scalaire ni chaîne.
      ambianteCoef: coefAmbiante(renderer, scene.environment),
      ambianteIntensite: scene.environmentIntensity,
      // ══════ L'APPOINT — Tâche R21, options 69 à 73 de l'inventaire ════════
      //
      // ⛔ **CINQ CURSEURS VISIBLES ET INERTES.** L'appoint est une seconde
      // `THREE.DirectionalLight` de la scène du BLOC PLAT (`fillLight`), et le
      // crop ne reçoit pas des lampes mais des IRRADIANCES. Mesuré aux deux
      // bouts des cinq, mouvement ambiant coupé, plancher de bruit **0,0000** :
      // écart moyen **0,000** et gradient **0,000**.
      //
      // ⚠️ **ON LIT LA LAMPE, PAS `params` — MÊME RÈGLE QUE POUR LE SOLEIL
      // TRENTE LIGNES PLUS HAUT, ET POUR LA MÊME RAISON, CHIFFRÉE.**
      // `fillLightIntensity` (`daycycle.js`) porte deux choses que `params` ne
      // porte pas : l'interrupteur — elle rend **0 exactement** quand
      // `fillEnabled` est faux, sans retirer la lampe — et l'écrêtage à
      // **[0 ; 4]**. Passer `params.fillIntensity` aurait éclairé le crop avec
      // un appoint éteint, et l'aurait laissé monter à 12 sur un gabarit à 12.
      //
      // ⚠️ **L'AZIMUT PASSE EN ÉCART, PAS EN ABSOLU** : `fillDirection` fait la
      // somme `sunAzimuth + offset` et l'écrêtage d'élévation, et
      // `directionAppointMonde` (`monde/lumiere-sphere.js`) l'appelle. Envoyer
      // l'azimut déjà sommé aurait été une seconde écriture de cette somme.
      appointAzimut: params.fillAzimuthOffset ?? 150,
      appointElevation: params.fillElevation ?? 20,
      appointCouleur: `#${fillLight.color.getHexString()}`,
      appointIntensite: fillLight.intensity,
      // ══════ L'OMBRAGE DES PENTES — Tâche R21, option 30 ═══════════════════
      //
      // ⛔ **« AUCUN CÔTÉ GLOBE »**, disait l'inventaire, et `naturel-crop.js`
      // avait DÉCLARÉ ce poste laissé, à raison pour son époque : *« les tuiles
      // du globe ne portent que `vNormalW`, la normale de la SPHÈRE »*. La
      // Tâche P9 a créé `nMonde`, la normale par fragment, et D15 l'allume
      // partout : la pente existe, la transcription est littérale.
      //
      // ⚠️ **ZÉRO EN MODE ATLAS, ET C'EST `uColorMode` QUI LE DIT, PAS
      // `params.colorMode`.** Le socle range ce brunissage dans le `else` de
      // `uColorMode == 1` ; la ligne de l'interface est déjà cachée en Atlas
      // (`visibleWhen(slopeRow, () => !isNatural())`). ⛔ **Et le gater sur
      // `uAnalysisOn` du globe aurait fait CLIGNOTER le brun** : en mode Atlas
      // `uAnalysisOn` reste à 0 pendant les ~464 ms où le travailleur cuit
      // l'analyse, alors qu'`uColorMode`, lui, vaut 1 dès le premier instant.
      slopeTint: terrain.mapUniforms.uColorMode.value === 1 ? 0 : terrain.mapUniforms.uSlopeTint.value,
      // ══════ ET L'AMBIANTE DE LA PAROI, QUI N'EST PAS CELLE-LÀ — Tâche P8 ═══
      //
      // ⛔ **LE COMMENTAIRE JUSTE AU-DESSUS NE TIRE QUE LA MOITIÉ DE SA PROPRE
      // LIGNE DE `three`.** Il conclut, à raison, qu'`envMapIntensity` est du
      // code MORT sur le relief parce que `terrain.material.envMap === null`.
      // **La paroi du socle, elle, a son propre `envMap`** — `plinth.setEnvMap`
      // lui pose `makeSocleEnvMap(renderer)`, et son commentaire l'annonce :
      // *« give the socle walls their own studio env map (overrides
      // scene.environment for this material only… while the terrain keeps the
      // neutral room env) »*. La règle de `three` s'inverse alors : c'est
      // `wallMat.envMapIntensity` qui compte, et `scene.environmentIntensity`
      // qui est morte.
      //
      // ⚡ **MESURÉ AU MÊME INSTANT DANS LA MÊME PAGE** (La Réunion z12,
      // `.banc/P8/S3-ambiante-P8.json`), irradiance à plat sur un mur vertical :
      // relief **(1,526 · 1,526 · 1,526)** contre paroi **(0,989 · 0,947 ·
      // 0,931)**. La paroi du crop prenait la première : **1,68 fois trop
      // claire** (26,63 contre 15,88), contraste **1,52 fois trop faible**.
      //
      // ⚠️ **ON LIT LE MATÉRIAU, PAS `params` — la même règle que `paroiCouleur`
      // vingt lignes plus bas** : un préréglage PBR repose `envMapIntensity`
      // (`plinth.setMaterial`), et `params.envMapIntensity` ne le sait pas.
      paroiAmbianteCoef: coefAmbiante(renderer, envParoi.texture),
      paroiAmbianteIntensite: envParoi.intensite,
      // le fond contre lequel `mapTint` dose la peinture — `terrain.js:1137`
      albedoBase: `#${terrain.material.color.getHexString()}`,
      albedoTeinte: terrain.mapUniforms.uTint.value,
      // ══════ LA MATIÈRE DU RELIEF — Tâche R25, option 38 ═══════════════════
      //
      // ⛔ **QUINZE VIGNETTES SUR DIX-SEPT RENDAIENT LA MÊME IMAGE.** Mesuré le
      // 2026-09-01 en cliquant les dix-sept une par une, La Réunion, pleine
      // résolution (`scripts/sonde-r25.mjs`) : chaque matière opaque s'écarte de
      // « Aucune » de **3,29 à 3,57**, et des quatorze autres de **0,025 à
      // 0,338** — pour un plancher de bruit du banc à **0,231**. La seule chose
      // qui traversait était `setMaterialMode` posant `material.color` à BLANC
      // et `uTint` à ZÉRO : la peinture hypsométrique retirée, rien mis à la
      // place. Les deux lignes juste au-dessus transmettaient donc fidèlement
      // une PERTE.
      //
      // ⚠️ **ON LIT LE MATÉRIAU, PAS `params` — même règle que `paroiCouleur`,
      // que les dix curseurs d'Atlas et que les lampes, et ici elle porte TROIS
      // choses que `params` ne porte pas** : (1) `map.repeat.x` contient déjà
      // `preset.repeat × terrainMatScale × zoomRepeat(demZoom)`, (2)
      // `normalScale.x` contient déjà `terrainSurfaceBump × preset.normalScale`,
      // (3) le chargement des JPEG est PARESSEUX — `params.terrainSurfaceMat`
      // est vrai bien avant que la texture existe, et `material.map` est le seul
      // à dire quand elle est là.
      //
      // ⚠️ **ET `materialMode === 'glass'` DOIT SORTIR ICI.** Le verre remplace
      // le matériau du maillage (`mesh.material = glassMaterial`) au lieu de le
      // muter : `terrain.material.map` garderait alors la texture de la matière
      // opaque PRÉCÉDENTE, et le globe peindrait de la roche sous une vignette
      // « Verre ». Le verre est de toute façon sans objet sur la sphère — sa
      // transmission coûte ×3,87 (crop) à ×4,78 (orbite) du temps d'image,
      // mesuré (`matiere-crop.js`, `COUT_TRANSMISSION`).
      ...matiereDuCrop(),
      // ══════ LA COULEUR DES PAROIS — Tâche P3, manque n° 2 ═══════════════
      //
      // ⛔ **`params.plinthColor` EST LE MAUVAIS NOMBRE, ET LE NOTEUR L'A MESURÉ
      // AU MÊME INSTANT DANS LA MÊME PAGE** : `params.plinthColor = #d8d4cc`,
      // `plinth.wallMat.color = c06a44`. `setColors` ne retient
      // `params.plinthColor` que si le socle n'est ni en verre ni sur un
      // préréglage PBR ; c'est donc le MATÉRIAU qui dit la vérité, jamais
      // `params`. Même règle que pour les curseurs d'Atlas.
      paroiCouleur: `#${plinth.wallMat.color.getHexString()}`,
      // ══════ LA COUCHE APPARENCE — Tâche P3 ══════════════════════════
      //
      // ⛔ **LE GABARIT D'OUVERTURE L'ALLUME** (`shibustart.json` :
      // `look.surfaceFx = 9`), et elle multiplie l'albédo du socle par **0,59**
      // — mesuré, socle albédo BLANC sous hémisphère blanc d'irradiance 1 :
      // **0,591** couche allumée contre **0,997** couche éteinte. Aucune tâche
      // de ce chantier ne l'avait nommée, et sans elle le crop éclairé sortait
      // 1,7 fois trop clair.
      //
      // ⚠️ **ON LIT LES UNIFORMES DU SOCLE, PAS `params`** — même règle que
      // pour les dix curseurs d'Atlas : `applyFxParams` porte les défauts par
      // effet (`fx-meta.js`) que `params.fx[id]` ne porte pas toujours.
      surfaceFx: terrain.mapUniforms.uSurfaceFx.value,
      fxBlend: terrain.mapUniforms.uFxBlend.value,
      fxOpacity: terrain.mapUniforms.uFxOpacity.value,
      fxScale: terrain.mapUniforms.uFxScale.value,
      fxColA: `#${terrain.mapUniforms.uFxColA.value.getHexString()}`,
      fxColB: `#${terrain.mapUniforms.uFxColB.value.getHexString()}`,
      fxColC: `#${terrain.mapUniforms.uFxColC.value.getHexString()}`,
      fxP1: terrain.mapUniforms.uFxP1.value,
      fxP2: terrain.mapUniforms.uFxP2.value,
      fxP3: terrain.mapUniforms.uFxP3.value,
      // ⚠️ **`uSlabHalf` VIVANT, PAS 28 EN DUR** : c'est lui qui convertit
      // `qCrop` en la coordonnée de sol que `champXZ()` donne à `terrain.js`,
      // et la fenêtre continue le déplace. Un 28 recopié aurait fait glisser le
      // motif du crop par rapport à celui du bloc dès le premier déplacement.
      fxDemiBloc: terrain.mapUniforms.uSlabHalf?.value ?? 28,
      fxFenetreX: terrain.mapUniforms.uFenetre?.value?.x ?? 0,
      fxFenetreY: terrain.mapUniforms.uFenetre?.value?.y ?? 0,
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
      // fois, ce qui est la raison d'être de cette fonction.
      remplir: fluxMerPret()
        ? (empriseMer, n, sortie) => remplirHauteurs(fluxDuSocle(), { emprise: empriseMer, n, sortie })
        : null,
      // ⚠️ **BORNÉE SUR L'EMPRISE DU CROP, PLUS SUR L'HORIZON** — trou n° 3.
      portee: PORTEE_CROP,
      couvertureMin: COUVERTURE_MER_MIN,
      // ⚠️ **TANT QUE LA NAPPE N'A PAS ATTERRI, ON REFUSE — ET PAS AU-DELÀ.**
      // `demanderBathy` est ASYNCHRONE : la première cuisson tombe avant elle, et
      // sans ce refus elle serait aussi la dernière (rien ne redemande une mer
      // posée). ⚠️ **Mais une nappe VIDE est le cas NORMAL** — `flux-terrain.js`
      // l'écrit : « on ne cuit pas de tuile là où il n'y a pas de mer ». Exiger la
      // fusion une fois la nappe RÉGLÉE ferait boucler la reprise pour toujours
      // à Chamonix, en recuisant un champ de 385² toutes les trente images.
      exigerBathy: fluxMerPret() && !fluxDuSocle()?.bathy?.prete,
      // ⚠️ **LE FOV VIVANT, PAS LE DÉFAUT DU MODULE — ET C'EST UN RELEVÉ, PAS
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

  // ══════════ LE FOND DU CROP — Tâche J bis ═══════════════════════════════════
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
  // ══════════ L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis ═══════════════════
  //
  // ⚠️ **DÉRIVÉE DE `ctx.mer`, PAS RECOPIÉE**, exactement comme `ctx.fond` juste
  // dessous et pour la même raison : la rampe, le fond et la mer doivent ancrer
  // sous le MÊME cran d'altitude. Deux `altitudeCadrageM()` écrits côte à côte
  // finiraient par diverger, et une échelle ancrée à un cran pendant que le
  // budget du fond l'est à un autre rouvrirait le désaccord que la Tâche J bis
  // a fermé.
  //
  // ⚠️ **`zeroSousEau: true` EST LE SEUL SITE QUI ALLUME `uMerZeroSousEau`.**
  // Hors `?terre=unique` ce contexte n'existe pas, donc l'uniforme reste à 0 et
  // la vue orbitale en production rend son plan de mer comme avant, au bit près.
  ctx.rampe = { altitudeM: ctx.mer.altitudeM, zeroSousEau: true }
  ctx.fond = {
    remplir: ctx.mer.remplir,
    portee: ctx.mer.portee,
    couvertureMin: ctx.mer.couvertureMin,
    exigerBathy: ctx.mer.exigerBathy,
  }
  return ctx
}

// ⚠️ **`globe` EST DONNÉ PAR UNE FONCTION, PAS PAR SA VALEUR.** Il est assigné
// plus haut dans ce fichier mais réassigné à la perte de contexte WebGL ; une
// référence figée survivrait à la réassignation et poserait le crop sur un globe
// mort, sans une erreur.
//
// ⚠️ **`masquerSocle` EST CE QUI FAIT QU'IL N'Y A PLUS QU'UNE TERRE — ET SANS
// LUI IL Y EN AVAIT ENCORE DEUX, RELEVÉ À L'ÉCRAN.** Première image du drapeau
// levé, La Réunion z12 : `uCropOn = 1`, `uHabOn = 1`, la mer posée… et
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
  // ⚠️ **LE REPOS ENTRE PAR LA MÊME PORTE QUE L'ESTOMPAGE — Tâche N.** Il
  // commande deux choses qui doivent être vraies ensemble : l'estompage plein
  // (les alentours ne s'affichent plus) et `globe.poserCropSeul` (le quadtree
  // cesse de les parcourir, donc de les demander et de les mailler). Le
  // relais est dans `branchement-crop.js`, pas ici : c'est lui qui sait si la
  // chaîne est posée, et forcer l'estompage sans crop viderait l'écran.
  repos: veilleRepos,
  // ⚠️ **IL PASSE `true`, ET CE N'EST PAS UNE FAUTE DE FRAPPE — Tâche R1 ②.**
  // L'argument de `poserVisibiliteSocle` ne dit PAS « allume le bloc plat », il
  // dit **« sommes-nous en vue de surface, devant un bloc »** — et ici la
  // réponse est oui, c'est simplement un crop. Le maillage plat, lui, est
  // éteint par le BORNAGE du drapeau (`monde/visibilite-surface.js`), pas par
  // cet argument : sous `terre unique`, `vue.socle` vaut faux quoi qu'on passe.
  //
  // ⛔ **IL PASSAIT `false`, ET C'EST CE QUI A EFFACÉ LES BOUTONS DU BAS.**
  // Adrien : « Il me manque les boutons du bas en UI, ils ont disparu (shuffle,
  // affichage photographie aérienne...) ». Sous ce drapeau, `veilleSocle`
  // n'applique JAMAIS — son seuil n'est pas nourri (`majSeuilSocle` sort avant
  // `veilleSocle.maj`), donc son `auSeuil` reste au `socleAuDepart` faux et son
  // `pose` ne change jamais. **Ce hook était donc le SEUL appelant de
  // `poserVisibiliteSocle`, et il n'appelait qu'avec faux** : les trois boutons
  // partaient à la première image de surface et rien ne les rallumait jamais.
  masquerSocle: () => poserVisibiliteSocle(true),
  // ⚠️ **SANS CETTE RÉSERVATION, LES PAROIS ET LA RAMPE REFUSENT POUR TOUJOURS,
  // ET C'EST MESURÉ À L'ÉCRAN.** La Réunion z12, drapeau levé, **600 tuiles** de
  // globe en cache : `globe.tuilesAvecHauteurs().length` rendait **0**, donc
  // `couverture = 0`, donc `refus: 'couverture'` à chaque tentative. Ce n'est pas
  // le réseau : `_buildMesh` RELÂCHE `t.heights` dès le maillage bâti (Tâche
  // 4 sexies), **sauf pour les clés de `gardeHauteurs`** — et personne ne
  // réservait l'emprise du crop. Les Tâches B, D et F ont toutes été vérifiées
  // sur des hauteurs posées à la main : le manque ne pouvait se voir qu'ici.
  //
  // ⚠️ **MÊME APPEL, MÊMES ARGUMENTS QUE `hauteursDeFlux`**, et c'est ce qui les
  // rend compatibles : `demanderEmprise` REMPLACE `gardeHauteurs` à chaque appel
  // (« un seul flux par globe »), donc deux réservations différentes se
  // reprendraient leurs tuiles. Le crop et le bloc ont la MÊME emprise et le
  // MÊME zoom — c'est toute l'idée du chantier —, donc la même réservation.
  //
  // ⚠️ **ET ON RÉSERVE UNE TUILE DE PLUS TOUT AUTOUR, POUR UNE RAISON QUI N'EST
  // PAS UN CONFORT.** Avec la réservation exacte du bloc, `couverture` des
  // parois plafonnait à **0,552** — mesuré — et le refus ne partait jamais. La
  // cause tient en une ligne d'échantillonnage : **le contour des parois court
  // sur la FRONTIÈRE du crop**, et la frontière est la borne EXCLUE des neuf
  // tuiles. Sondé à la main sur les treize points du repère, à La Réunion z12 :
  // `u = −1` rend 1 220 m, `u = +1` rend **null** ; `v = −1` rend 134 m,
  // `v = +1` rend **null**. Les arêtes est et sud tombent sur la première
  // colonne et la première ligne de la tuile SUIVANTE.
  //
  // ⚠️ **ET LE REPLI QUE `parois-crop.js` §7 ① PROMET N'EXISTE PAS ICI.** Il dit
  // « `globe.js` ne purge jamais ses seize racines z2 », donc un point non
  // couvert retombe sur un ancêtre grossier. C'est vrai des TUILES et faux de
  // leurs HAUTEURS : `_buildMesh` les relâche pour tout ce que `gardeHauteurs`
  // ne retient pas, et `gardeHauteurs` ne retient que l'emprise réservée. Le
  // repli n'a donc rien à quoi retomber. **Abaisser `couvertureMin` n'est pas la
  // sortie** — le même §7 prévient qu'on achèterait des encoches au niveau de la
  // mer, tout le long des deux arêtes.
  //
  // ⚠️ **CE QUE ÇA COÛTE, DIT EN ENTIER :** 25 tuiles réservées au lieu de 9,
  // donc **16 tuiles de plus** par position de bloc. Et sous
  // `?globe=continu&socle=quadtree`, `hauteursDeFlux` réserve les 9 de son côté :
  // les deux réservations ALTERNENT tant que les parois refusent. C'est borné —
  // la reprise s'arrête dès que le refus part, et une géométrie bâtie ne se
  // défait pas — mais ce n'est pas gratuit, et ça n'a pas été chronométré.
  reserverHauteurs: () => {
    const flux = fluxDuSocle()
    const emprise = terrain.fenetreBornee?.emprise || empriseDuSocle()
    if (!flux || !emprise) return
    // ⚠️ **LES DEUX CONVERSIONS SONT CELLES DE `geo.js`, PAS UNE TROISIÈME.**
    // `mondeVersLatLonEmprise` interpole la longitude linéairement et la latitude
    // en MERCATOR — c'est exactement la grille de tuiles. Une marge calculée en
    // degrés de latitude serait fausse dès qu'on quitte l'équateur.
    const D = 5 / 6 // une tuile de marge sur un bloc de trois : (1,5 + 1) / 3
    const n = mondeVersLatLonEmprise(emprise, 0, -D, 1).lat
    const s = mondeVersLatLonEmprise(emprise, 0, D, 1).lat
    const o = mondeVersLatLonEmprise(emprise, -D, 0, 1).lon
    const e = mondeVersLatLonEmprise(emprise, D, 0, 1).lon
    // ⚠️ **LE MÊME `aussi` QUE `hauteursDeFlux`** — voir là-bas : deux
    // réservations qui ne s'accordent pas s'annulent l'une l'autre par image.
    demanderEmprise(flux, { emprise: { ouest: o, sud: s, est: e, nord: n }, zoom: params.demZoom, aussi: empriseZoomMer() })
  },
})

modes = new Modes({
  camera,
  controls,
  globe,
  domElement: renderer.domElement,
  hooks: {
    setSurfaceVisible(v) {
      if (!v) {
        // entering orbit: kill any surface camera drivers — a live tour/tween
        // would keep yanking the camera along a surface-space path and fight
        // the orbital rig for control every frame
        tour.active = false
        tween.active = false
        camera.up.set(0, 1, 0)
      }
      // ══════ LE MODE ATTEINT ENFIN LA VEILLE DU CROP — Tâche K ter ═════════
      //
      // ⛔ **`veilleCrop.poserMode` N'ÉTAIT APPELÉE DE NULLE PART** : le crop
      // restait posé en orbite, et la planète entière portait la rampe et le
      // masque de côte du dernier bloc visité. Le relevé, le pourquoi ce n'est
      // pas un seuil de plus, et pourquoi l'estompage n'a qu'UN écrivain sous ce
      // drapeau : `src/monde/branchement-crop.js`, § « L'ORBITE RETIRE LE CROP ».
      if (terreUniqueBranchee) {
        // ⚠️ **ET LES BOUTONS DE SURFACE SUIVENT LE MODE ICI, PARCE QUE SOUS CE
        // DRAPEAU PERSONNE D'AUTRE NE LE LEUR DIT — Tâche R1 ②.** `veilleSocle`
        // n'applique jamais (son seuil n'est pas nourri), donc l'unique appelant
        // de `poserVisibiliteSocle` est `masquerSocle`, et il ne parle qu'à
        // l'ENTRÉE en surface. Sans cette ligne, les trois boutons du bas
        // survivraient à l'orbite, où il n'y a plus de bloc du tout.
        //
        // ⚠️ **ET C'EST ICI, PAS DANS `poserVisibiliteSocle`, PARCE QUE
        // `modes.mode` MENT ENCORE À CET INSTANT.** `modes.js` appelle ce hook
        // AVANT d'écrire `this.mode` (`setSurfaceVisible(false)` puis
        // `this.mode = 'orbital'`, et symétriquement au retour) : lire le mode
        // depuis la fonction rendrait exactement l'état d'avant, dans les deux
        // sens. `v`, lui, porte la transition qui est en train d'avoir lieu.
        poserVisibiliteSocle(v)
        veilleCrop.poserMode(v)
        return
      }
      // ⚠️ **LE MODE PRIME SUR LE SEUIL** : en orbite le socle n'existe pas,
      // quelle que soit l'altitude. Et c'est la veille qui applique, pour que
      // les deux chemins (le mode et le seuil) ne puissent pas se contredire.
      veilleSocle.poserMode(v)
      // ⚠️ **ET LE MODE PRIME AUSSI SUR L'ESTOMPAGE, MAIS DANS L'AUTRE SENS.**
      // La veille du socle GÈLE en orbite ; celle de l'estompage FORCE ZÉRO.
      // Geler y laisserait la valeur de la dernière image de surface — donc une
      // planète effacée au moment précis où elle redevient le sujet, c'est-à-dire
      // un écran vide. Voir le §6 de `monde/estompage-terre.js`.
      veilleEstompage.poserMode(v)
    },
    setEffectsEnabled(v) {
      setDofEnabled(v && params.bokehEnabled && params.bokehScale > 0)
      grain.blendMode.opacity.value = v ? params.grain : 0
      // le globe éteint les effets ; l'interrupteur du soleil est un SECOND
      // motif de coupure, il ne doit pas être perdu au retour sur le bloc
      sun.castShadow = v && sunShadowOn(params.sunEnabled, params.shadowMode)
      // même règle qu'applyShadowMode : jamais de redessin à chaque image, un
      // redessin quand l'état change (ici, le retour du globe vers le bloc)
      renderer.shadowMap.autoUpdate = false
      if (sun.castShadow) { sigCarteOmbre = null; renderer.shadowMap.needsUpdate = true }
      // the restore above reads raw params — re-assert the active quality
      // tier on top so a globe round-trip can't silently undo degraded mode
      if (v) aq?.reassert()
    },
    getSurfaceLatLon: () => ({ lat: params.demLat, lon: params.demLon }),
    // ══════ DEUX ALTITUDES, ET LA RÈGLE R1 EST TOUTE LA DIFFÉRENCE ═════════
    //
    // Il n'y en avait qu'UNE, et elle servait aux deux usages — c'est cela, la
    // violation. `surfaceCamAltMeters()` ajoutait `dem.meanM`, une quantité
    // **dérivée du terrain chargé** et lissée, et elle **pilotait `enterOrbit`**
    // (`modes.js`). Le gain de l'oscillateur que R1 décrit était déjà câblé ;
    // la Phase 3 n'aurait eu qu'à y ajouter le retard. Tâche 1b, R1.
    //
    //   · `surfaceCamAltCadrageM()` — ce qui DÉCIDE : porte orbitale, niveau de
    //     plongée, pose d'arrivée. GÉOMÉTRIQUE PURE, **sans `meanM`**.
    //   · `surfaceCamAltMeters()` — ce qui S'AFFICHE : l'altimètre, qui doit
    //     rester une altitude au-dessus du niveau de la mer et garde donc
    //     `meanM`. Un afficheur n'est pas une décision de cadrage : R1 ne parle
    //     pas de lui, et l'en priver aurait fait lire 418 m à une caméra qui est
    //     à 2 918 m au-dessus de la mer.
    //
    // ⚠️ L'EXAGÉRATION VERTICALE, ELLE, RESTE DANS LES DEUX, et ce n'est pas un
    // oubli : c'est la grandeur que la Tâche 1a a nommée et mesurée, celle que
    // `_dive` et `_rescale` conservent de part et d'autre d'une traversée. La
    // sortir d'ici seule rendrait l'aller-retour surface → orbite → surface
    // asymétrique d'un facteur `exagération(z)`. Ce qu'elle laisse encore
    // sauter — le CHAMP visuel — est mesuré et écrit dans le plan.
    surfaceCamAltCadrageM: altitudeCadrageM,
    surfaceCamAltMeters() {
      return altitudeCadrageM() + (params.source === 'real' && dem ? dem.meanM : 0)
    },
    // L'ÉCHELLE VERTICALE DU BLOC — unités de scène par mètre réel. C'est le
    // facteur qui sépare la hauteur de caméra de l'altitude en mètres, et il
    // change à CHAQUE cran de zoom pour deux raisons cumulées : l'emprise du
    // bloc est divisée par deux, ET l'exagération verticale change de palier
    // (`exagForZoom`). `_rescale` (modes.js) le lit AVANT et APRÈS le
    // rechargement pour reposer la caméra à la même altitude métrique —
    // l'escalier continu de la Tâche 2 bis.
    //
    // ⚠️ Rendu `null` hors source réelle : `modes.js` retombe alors sur la pose
    // d'arrivée plutôt que sur une distance inventée.
    //
    // ══════════ ET IL NE LIT PLUS `dem` — Tâche 6 septies ═══════════════════
    //
    // ⚠️ **LE PLAN PRESCRIVAIT `terrain.fenetreBornee.echelleVerticale`. LE
    // REJEU A DIT NON, ET C'EST CHIFFRÉ.** Ce champ n'a qu'un écrivain,
    // `appliquerHauteurs`, qui ne tourne que sur le chemin du quadtree : sous
    // `?globe=continu` seul il reste à la valeur du PREMIER cran pour toujours
    // (0,00766707 sur trois crans, pendant que la nappe, elle, quadruplait —
    // mesuré, test ⑪a). Le lire ici aurait rendu `echelleApres / echelleAvant`
    // = 1 à `_rescale`, c'est-à-dire une caméra reposée à la moitié puis au
    // quart de la bonne distance à chaque cran : la régression exacte que le §5
    // de `/threejs-optimisation` décrit.
    //
    // La grandeur portée par la fenêtre est **`largeurM`**, et l'échelle s'en
    // dérive par `echelleBloc` avec l'exagération LUE VIVANTE — mot pour mot la
    // formule d'`appliquerHauteurs` et de `_makeDemSampler`. **Une seule loi,
    // et le test ⑪c exige que les deux régimes tombent dessus.**
    echelleVerticaleBloc() {
      const largeur = largeurBlocM()
      if (params.source !== 'real' || !(largeur > 0)) return null
      return echelleBloc({ extentMeters: largeur, span: TERRAIN_SIZE, exageration: lireExageration(params) })
    },
    // L'ÉCHELLE VERTICALE D'UN NIVEAU **QU'ON N'A PAS ENCORE CHARGÉ**.
    //
    // ⚠️ LA PLONGÉE A UN PROBLÈME DE POULE ET D'ŒUF que le cran n'a pas :
    // `_rescale` connaît son niveau d'arrivée (c'est le cran suivant) et peut
    // donc lire l'échelle APRÈS le chargement ; `_dive`, lui, doit CHOISIR le
    // niveau, donc connaître l'échelle de chacun AVANT. Elle se calcule sans
    // charger quoi que ce soit : l'emprise vient de la formule de `dem.js`
    // (recopiée dans `loi-altitude.js` et gardée par un test de texte source) et
    // l'exagération de `exagForZoom`, qui vit ici.
    //
    // ⚠️ C'EST UNE ESTIMATION, ET `_dive` LE SAIT : le bloc réel est calé sur la
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
    // ══════════ LES TROIS CROCHETS DU ZOOM CONTINU — Tâche M ════════════════
    //
    // ⚠️ **`modes.js` NE PEUT PAS LES CALCULER.** L'emprise du bloc vit dans la
    // fenêtre bornée (`largeurBlocM`), pas dans la machine à modes, et le côté du
    // bloc est une constante de `terrain.js`. Ce sont les MÊMES grandeurs que
    // `majCameraFond()` passe à la similitude vingt lignes plus haut : la caméra
    // de fond et la caméra du bloc décident donc sur le même couple, sans quoi la
    // conversion d'unités et la pose du fond diraient deux choses différentes.
    empriseBlocM: () => (params.source === 'real' ? largeurBlocM() : 0),
    // L'emprise d'un niveau **qu'on n'a pas encore chargé** — même rôle
    // qu'`echelleVerticaleAuZoom` pour la plongée, mais SANS l'exagération :
    // c'est l'emprise horizontale, celle que la similitude emploie.
    empriseBlocMAuZoom: (zoom, lat = params.demLat) => empriseBlocM({ zoom, lat }),
    // ⚠️ **`TERRAIN_SIZE` ET PAS `terrain._span()`** : c'est le couple qu'emploient
    // déjà `altitudeCadrageM()` et `majCameraFond()`. Deux conventions d'échelle
    // dans le même fichier divergeraient en silence.
    coteBloc: () => TERRAIN_SIZE,
    // ⚡ **« ARRIVER AU BLOC » — D16 ter, étape 5.** `veilleCrop.repos` vaut
    // `crop posé ET vue au repos` : le LIEU et le MOMENT dans un seul booléen,
    // alimenté par le point unique de `branchement-crop.js`, à la même image que
    // le seuil du socle et l'estompage. **Aucun nombre nouveau n'entre dans le
    // dépôt** : le seuil de repos et son hystérésis sont ceux de la Tâche N,
    // mesurés, et la naissance du crop est celle du seuil.
    arriveeSurLeBloc: () => !!veilleCrop?.repos,
    // ⚡ **ET LE MIROIR : est-on SUR le bloc ?** `veilleCrop.pose` seul — un
    // signal de LIEU. Son front descendant rend la vue au nadir, pour que la
    // sortie d'orbite n'ait plus rien à faire claquer. Voir `_armerRetourNadir`.
    surLeBloc: () => !!veilleCrop?.pose,
    // ⚡ **ET LE PRÉDICAT DU PIVOT — R27.** *« Il doit toujours viser le centre
    // de la Terre. Il change uniquement quand on passe en mode bloc croppé. »*
    //
    // ⛔ **CE N'EST PAS `!surLeBloc()`, ET LA DIFFÉRENCE EST UN RÉGIME ENTIER.**
    // Sans `terre unique` il n'y a pas de crop du tout : `veilleCrop` est nulle,
    // donc `surLeBloc()` rend faux POUR TOUJOURS, et viser l'axe deviendrait la
    // loi du mode plat hérité — où viser un point EST le produit. Le terme
    // `terreUniqueBranchee` est donc la moitié de la question, pas une prudence.
    // `?terre=deux` rend le dépôt d'avant, au bit près.
    horsDuCrop: () => terreUniqueBranchee && !veilleCrop?.pose,
    // ⚡ **L'ALTITUDE DE LA CAMÉRA QUI REND — LA VRAIE, PAS SA JAMBE VERTICALE.**
    // Tâche D16, étape ①. `_altitudeFondM()` (modes.js) vaut `camY × emprise / span` :
    // c'est le côté VERTICAL du triangle. La caméra de fond, elle, est à
    // `√((R + k·camY)² + k²·r²)` du centre — le déport horizontal `r` de la vue de
    // trois quarts la POUSSE VERS LE HAUT.
    //
    // ⛔ **MESURÉ, À LA SORTIE D'ORBITE : 33 105 716 m contre 23 879 470 m rendus
    // par `_altitudeFondM()` — +38,6 %, soit 9 226 246 m.** `enterOrbit` sortait
    // donc à une altitude qu'il croyait « exacte » (son commentaire dit
    // expressément avoir supprimé un recul de 15 % parce qu'« un 15 % de recul
    // serait un saut ») en se trompant de **deux fois et demie ce recul-là**.
    //
    // ⚠️ **UNE SEULE SOURCE DE VÉRITÉ, ET C'EST LA CAMÉRA ELLE-MÊME.** On ne
    // réécrit pas la formule ici — ce serait une septième conversion à tenir
    // d'accord avec `poseFond`. On lit la position que `majCameraFond` vient de
    // poser. Hors frontière, il n'y a pas de caméra de fond : on rend `null` et
    // `enterOrbit` retombe sur son chemin d'avant, au bit près.
    altitudeFondRenduM: () =>
      frontiereActive && camGlobe ? (camGlobe.position.length() - R_GLOBE) * ORBITAL_M_PER_UNIT : null,
    // ⚡ **LE RÉGIME CONTINU — LU UNE FOIS, PASSÉ PAR UNE FONCTION.** `modes.js`
    // n'importe pas `flags.js` ; sans cette ligne, tout le travail de la Tâche M
    // serait du code qui ne s'exécute jamais, et c'est **la faiblesse récurrente
    // de ce chantier** (quatre tâches d'affilée ont vu leurs mutations de
    // branchement survivre).
    zoomContinu: () => terreUniqueBranchee,
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
    // la fenêtre est posée, donc un second cran peut partir pendant que le
    // premier MNT est encore en vol. C'est `_generationMNT` (voir `entrerEnVol`)
    // qui garantit que le retardataire ne pose rien.
    async loadSurface(lat, lon, zoom) {
      if (demBusy) throw new Error('terrain busy')
      demBusy = true
      try {
        params.demLat = lat
        params.demLon = lon
        if (zoom) params.demZoom = zoom
        params.demLocation = 'Custom'
        // ⚠️ `centreSur` : c'est LE point d'entrée de « on va quelque part ».
        // Les trois appelants de `loadSurface` portent tous un lieu VOULU — la
        // plongée depuis l'orbite (une recherche), l'escalier de zoom, et le
        // clic pour plonger. Dans les trois cas, ce lieu doit atterrir au
        // centre du socle et pas à un sixième de côté (voir `f3CentreSur`).
        if (volPossible()) {
          // le socle prend le palier d'arrivée à la résolution DISPONIBLE —
          // 1 à 2 ms, mesuré (Tâche 6 quinquies) — puis le MNT le rejoint.
          await entrerEnVol()
          // ⚠️ **PAS D'`await` ICI, ET C'EST TOUT L'OBJET DE LA TÂCHE.** Le MNT
          // continue en tâche de fond et enrichit un bloc qui est DÉJÀ à
          // l'écran. Le `catch` n'est pas décoratif : une promesse rejetée sans
          // preneur remonterait en `unhandledrejection`.
          fetchAndBuildDem({ centreSur: { lat, lon }, enVol: true }).catch((err) => {
            console.warn('[vol MNT] le relief de détail n\'est pas arrivé :', err?.message || err)
          })
          return
        }
        await fetchAndBuildDem({ centreSur: { lat, lon } })
      } catch (err) {
        hideLoading()
        throw err
      } finally {
        demBusy = false
      }
    },
    // pull back far enough to frame the whole slab (and the ground info added
    // around it) before the zoom-out staircase / orbit gate engages
    surfaceMaxDistance: () => 150,
    getFineZoom: () => userFineZoom,
    // zoom max SERVI par la source sur la zone courante (informatif — le zoom
    // fixe l'emprise du bloc, on ne bride donc pas la navigation dessus)
    getDemMaxZoom,
    // OÙ LA CAMÉRA DOIT VISER POUR QUE LE LIEU DEMANDÉ SOIT AU CENTRE.
    //
    // La règle (et les mesures qui l'ont imposée) vit dans escalier-zoom.js sous
    // `viseeArrivee` ; ici il n'y a que les deux conversions qu'elle ne peut pas
    // faire toute seule, parce qu'elles ont besoin du DEM chargé :
    //
    //  1. `latLonToWorld` ET PAS UN CALCUL À LA MAIN — c'est lui qui divise par
    //     `demSpan(dem)`, soit 168 unités en emprise 3×3 et non 56. L'erreur
    //     inverse a déjà été commise trois fois sur cette branche.
    //  2. LA FENÊTRE EST RETRANCHÉE, et c'est le miroir exact de `viseeAuSol`
    //     qui l'ajoute. `controls.target` vit dans la GÉOMÉTRIE ; le champ se lit
    //     à `géométrie + fenêtre`. Confondre les deux est la famille d'erreur qui
    //     ramenait déjà l'escalier de zoom au centre du bloc après un défilement.
    //     En mode continu `f3CentreSur` vient de poser la fenêtre SUR le lieu :
    //     la soustraction rend (0, 0), et la visée reste au milieu du socle —
    //     l'ancien comportement, au bit près, puisque ce mode-là centrait déjà.
    //
    // ══════════ ET ELLE PEUT SE PASSER DU MNT — Tâche 6 septies ═════════════
    //
    // ⚠️ **LA FENÊTRE D'ABORD, ET CE N'EST PAS UNE SECONDE LOI.**
    // `latLonVersMondeEmprise` (`geo.js`) est `latLonToWorld` lue sur l'emprise
    // au lieu du bloc — vérifiée contre elle sur une grille 9 × 9 couvrant toute
    // l'empreinte, cinq lieux dont l'antiméridien : **écart maximal 8,5e-12
    // unité de scène**, l'arrondi float64 (test ⑪d). L'emprise, elle, est connue
    // sans rien charger (`empriseBlocMNT`), et le test ⑩e la verrouille bit à
    // bit contre `patchLatLonBBox(dem)`.
    //
    // ⚠️ **L'EMPRISE 3×3 (`?f3=1`) RESTE SUR LE MNT, ET C'EST VOULU** : là son
    // champ fait 168 unités quand la géométrie en fait 56, `demSpan` porte ce
    // facteur trois, et `empriseDuSocle` refuse déjà de fabriquer une fenêtre.
    // Sans `terrain.fenetreBornee`, cette branche est celle d'avant, au bit près.
    viseeDuLieu(lat, lon) {
      if (params.source !== 'real' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
      const f = terrain.fenetreBornee
      if (f?.emprise) {
        const w = latLonVersMondeEmprise(f.emprise, lat, lon, TERRAIN_SIZE)
        return viseeArrivee(w, TERRAIN_SIZE / 2, 2)
      }
      if (!dem) return null
      const w = latLonToWorld(dem, lat, lon)
      const fen = fenetreContinueActive() && dem.empriseCote > 1 ? terrain.fenetre : null
      return viseeArrivee({ x: w.x - (fen?.x ?? 0), z: w.z - (fen?.z ?? 0) }, TERRAIN_SIZE / 2, 2)
    },
    // task 30 Fix A: terrain-clearance guard for the dive/refine arrival pose
    // (see modes.js's _arrivalPose()) — the local relief height right under
    // the landing target, so the arrival camera can never come to rest below
    // the ground it just loaded.
    sampleGroundY: (x, z) => terrain.sample?.(x, z) ?? 0,
    // molette pendant le suivi de tête GPX : zoome/dézoome le standoff du
    // drone (consommé → l'escalier de zoom ne voit pas l'événement)
    followWheel: (deltaY) => {
      if (!(drone.active && params.gpxFollow && gpxLayer.isPlaying())) return false
      // zoom INERTIEL (Adrien) : chaque cran ajoute de l'élan, le glissé se
      // fait au frame dans updateCameraMotion — aucun à-coup, ~20 crans de
      // course avec décélération douce, comme la molette de la carte
      followZoomVel = Math.min(2.4, Math.max(-2.4, followZoomVel + Math.sign(deltaY) * 0.32))
      return true
    },
    // molette pendant le cadrage du damier : un cran mou est AVALÉ (le bouton
    // vient de cadrer, la main est encore sur la molette), l'insistance rend la
    // caméra et laisse l'escalier de zoom dézoomer pour de bon. Le seuil est
    // dans vue-ensemble.js, avec sa justification.
    cadrageWheel: (deltaY) => molettePendantCadrageDamier(deltaY),
    // world point under a screen NDC (for zoom-toward-cursor) — marches the
    // height field like the autofocus ray; null on a sky/off-map miss
    pointUnder: (nx, ny) => {
      _pickNdc.set(nx, ny)
      focusRay.setFromCamera(_pickNdc, camera)
      const d = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, { halfExtent: TERRAIN_SIZE / 2 })
      if (d == null) return null
      return {
        x: focusRay.ray.origin.x + focusRay.ray.direction.x * d,
        y: focusRay.ray.origin.y + focusRay.ray.direction.y * d,
        z: focusRay.ray.origin.z + focusRay.ray.direction.z * d,
      }
    },
    // next finer scale under the current view — the staircase down from a
    // coarse (z8/z10) dive; null once the patch is already fine
    //
    // ⚠️ CE QUE VISE LA CAMÉRA EST EN COORDONNÉES DE GÉOMÉTRIE, PAS DE CHAMP —
    // et c'est la même famille d'erreur que le défaut du centrage. `controls
    // .target` vit dans la géométrie, qui NE BOUGE PAS en mode continu : c'est
    // la lecture qui se décale de `terrain.fenetre`. Sans l'ajouter, un cran de
    // zoom après un défilement rechargeait la zone du CENTRE DU BLOC — le
    // visiteur avait glissé de 20 km et le zoom le ramenait d'où il venait,
    // silencieusement. `chargeCartouche` fait déjà exactement cette addition
    // (voir plus haut) ; l'escalier de zoom l'avait oubliée.
    // Hors mode continu, `fenetre` est (0, 0) et l'expression est inchangée.
    //
    // ⚠️ **`!dem` A ÉTÉ REMPLACÉ PAR « NI MNT NI FENÊTRE » — Tâche 6 septies.**
    // Pendant qu'un MNT est EN VOL, `dem` vaut `null` (voir `entrerEnVol`) : la
    // condition d'avant aurait rendu `null` ici, donc la molette n'aurait plus
    // rien fait pendant toute la durée du vol — le gel qu'on retire, déplacé
    // d'un cran. La fenêtre bornée, elle, porte l'emprise du palier COURANT.
    getRefineTarget() {
      if (params.source !== 'real' || (!dem && !terrain.fenetreBornee) || params.demZoom >= userFineZoom) return null
      const { lat, lon } = viseeAuSol()
      return { lat, lon, zoom: stepZoom(params.demZoom, 1, userFineZoom) }
    },
    getCoarsenTarget() {
      // on s'élargit jusqu'au bloc régional z6 ; au-delà c'est la porte orbitale
      // qui s'ouvre — les deux paliers plus larges n'existent plus (Adrien,
      // « Z1 et Z2 ne doivent pas exister », cf. escalier-zoom.js)
      // ⚠️ même correction que `getRefineTarget` : voir la note au-dessus.
      if (params.source !== 'real' || (!dem && !terrain.fenetreBornee) || params.demZoom <= ZOOM_PALIER_MIN) return null
      const { lat, lon } = viseeAuSol()
      return { lat, lon, zoom: stepZoom(params.demZoom, -1) }
    },
    // true when the camera is skimming the relief — refine can then fire on a
    // zoom-in even though the orbit target is far ahead (so getDistance() never
    // reaches the near stop). Fixes "won't reach z15 with the camera at ground
    // level". The scene-space y is a few units at ground; the default frame is y≈18.
    nearGround: () => params.source === 'real' && !!dem && camera.position.y < 6,
  },
})

const gotoCtl = createGoto({
  modes,
  announce: (m) => modes.announce(m),
  getFineZoom: () => userFineZoom,
  onTarget: (t) => setRegionTarget(t),
})

// vertical zoom stepper (left edge) — discrete alternative to the wheel; reads
// live staircase/orbit state each frame, only triggers modes.stepFiner/Wider
// ⛔ **ET SOUS `?terre=unique` IL N'EXISTE PAS — Tâche M.** Adrien : *« on
// supprime toutes les zones »*, *« vire absolument ton système de saut de
// niveau »*. `ORB` et `Z{n}` sont les DEUX étiquettes de l'escalier de paliers ;
// les garder au-dessus d'un zoom devenu continu afficherait un niveau qui ne
// décrit plus rien — la caméra passe désormais entre les niveaux sans s'y poser.
//
// ⚠️ **CE QUI EST PERDU EST NOMMÉ ICI, ET C'EST LE PRIX** : les deux boutons
// `+` / `−` partent avec l'étiquette, donc il n'y a plus de zoom discret au
// doigt sous ce drapeau. `modes.cranZoom(±1)` existe et applique la loi mesurée
// (×√2) — **il n'a plus d'appelant d'IHM sur ce chemin, et c'est une réserve du
// rapport, pas un oubli.**
const zoomStepper = terreUniqueBranchee ? null : buildZoomStepper({
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

// ------------------------------------------------------------------ map overlay panel + peaks

const peaksLayer = new PeaksLayer({
  terrain,
  getDem: () => dem,
  announce: (m) => modes.announce(m),
  onFocus: (world, name) => {
    modes.announce(`FOCUS — ${name.toUpperCase()}`)
    focusOnPeak(world.x, world.y, world.z)
  },
  // ⚡ **LE POSEUR À LA CONSTRUCTION, PAS SEULEMENT À LA PROJECTION — Tâche
  // R24.** `update()` l'avait depuis R18 ; `refresh()` ne l'avait pas, et c'est
  // là que l'altitude d'ancrage se décide. Voir `ancrageSommet` (`peaks.js`) :
  // le sol du bloc plat est SOUS le sol dessiné sur 25 % des points relevés.
  getPoseur: () => poseurDesReperes(),
  // ⚡ **ET LE ZOOM, POUR LE SEUIL D'IMPORTANCE (D18, règle 2).** C'est le
  // patron de `filterByZoom` / `min_zoom` déjà en service sur les rivières,
  // transposé à l'altitude d'un sommet — et l'entrée est CONTINUE.
  getZoom: () => params.demZoom,
})
// Le défaut est désormais « éteint » (params.peaksEnabled, plus haut), mais
// cette ligne compte toujours : `params` a déjà pu être écrasé par la
// restauration d'un lien de partage ou d'un template au-dessus. C'est le
// SEUL endroit du démarrage qui met la couche en cohérence avec params ;
// sans elle, un lien qui allume les sommets s'ouvrait sans eux.
// Appel sûr avant qu'un DEM existe (refresh() sort sur !dem) : le
// peuplement réel a lieu au premier regenerateTerrain(), qui rappelle
// refresh() de lui-même si la couche est active.
peaksLayer.setEnabled(params.peaksEnabled)

// LE look d'ouverture, appliqué UNE fois après le premier relief : c'est le
// template « shibuStart » d'Adrien, la même source que le pré-remplissage de
// `params` à la ligne ~531. Ces deux chemins portaient AUTREFOIS deux looks
// différents — shibuStart posé au démarrage puis écrasé ici par un ancien look
// codé en dur — si bien que le template de départ n'était jamais celui qui
// s'affichait (Adrien : « reprends ce qui est en cours »). Une seule source
// désormais : public/templates/defaults/shibustart.json.
const STARTUP_LOOK = SHIBU_START.look
let _startupLookApplied = false

// the shipped survey look — what ⟲ RESET LOOK restores. Templates can now
// change light/surface/post/toggles too, so the reset snapshots ALL of it.
const DEFAULT_LOOK = Object.freeze({
  rampStops: params.rampStops.map((s) => ({ ...s })),
  oceanShallow: params.oceanShallow,
  oceanMid: params.oceanMid,
  oceanDeep: params.oceanDeep,
  mapTint: params.mapTint,
  heightContrast: params.heightContrast,
  heightPivot: params.heightPivot,
  slopeTint: params.slopeTint,
  contourInterval: params.contourInterval,
  contourOpacity: params.contourOpacity,
  contourColor: params.contourColor,
  contourWeight: params.contourWeight,
  gridStep: params.gridStep,
  gridOpacity: params.gridOpacity,
  gridColor: params.gridColor,
})
// Le NEUTRE de ce que l'utilisateur possède sur la lumière : gains à 1 (le
// cycle nu) et appoint éteint. Sert deux fois — au RESET LOOK, et surtout à
// applyUserTemplate, où un gabarit enregistré AVANT ces réglages doit rendre le
// cycle nu et non hériter de ceux de la session : sans ça, réimporter un vieux
// look ne redonnerait pas l'image qu'on avait exportée.
const NEUTRAL_LIGHT_USER = Object.freeze({
  sunGain: 1, hemiGain: 1, envGain: 1,
  fillIntensity: 0, fillAzimuthOffset: 150, fillElevation: 20, fillColor: '#ffcf9a',
  // Les deux interrupteurs entrent ICI, et c'est ce qui rend un gabarit d'HIER
  // pixel-identique : sans ces deux lignes, un vieux look importé hériterait de
  // l'appoint allumé ou du soleil coupé de la session en cours.
  sunEnabled: true, fillEnabled: false,
})
// the rest of the shipped scene, so a template never leaves a stuck light /
// material / post-FX / toggle behind after RESET LOOK
const DEFAULT_LIGHT = Object.freeze({
  sunIntensity: params.sunIntensity,
  sunAzimuth: params.sunAzimuth,
  sunElevation: params.sunElevation,
  hemiIntensity: params.hemiIntensity,
  envLight: params.envLight,
  shadowSoftness: params.shadowSoftness,
  ...NEUTRAL_LIGHT_USER,
})
const DEFAULT_SURFACE = Object.freeze({
  color: params.color,
  roughness: params.roughness,
  roughnessVariation: params.roughnessVariation,
  roughnessScale: params.roughnessScale,
  bumpScale: params.bumpScale,
  envMapIntensity: params.envMapIntensity,
})
const DEFAULT_FX = Object.freeze({
  fogColor: '#ffffff',
  exposure: params.exposure,
  contrast: params.contrast,
  saturation: params.saturation,
  vignette: params.vignette,
  grain: params.grain,
  clouds: params.cloudsEnabled,
  plinth: params.plinth,
})
// snapshots for RESET MAP (Templates panel) — background, socle material and
// the map overlay layers, none of which RESET LOOK touches
const DEFAULT_BG = Object.freeze({
  bgMode: params.bgMode,
  bgEnv: params.bgEnv,
  bgColorA: params.bgColorA,
  bgColorB: params.bgColorB,
  bgColorC: params.bgColorC,
  bgAngle: params.bgAngle,
  bgStops: params.bgStops ? JSON.parse(JSON.stringify(params.bgStops)) : null,
  bgPoints: params.bgPoints ? JSON.parse(JSON.stringify(params.bgPoints)) : null,
  bgAuto: params.bgAuto,
})
const DEFAULT_PLINTH = Object.freeze({
  plinthDepth: params.plinthDepth,
  plinthColor: params.plinthColor,
  plinthFinish: params.plinthFinish,
  plinthPbr: params.plinthPbr,
  plinthGlass: params.plinthGlass,
  plinthGlassDiffusion: params.plinthGlassDiffusion,
  plinthGlassProjection: params.plinthGlassProjection,
  plinthGlassBump: params.plinthGlassBump,
  plinthGlassRefract: params.plinthGlassRefract,
  plinthBump: params.plinthBump,
})
// PLUS de waterFill / placesDensity / placesSize / placesHalo : ces quatre
// réglages ont été retirés le 2026-08-02 (ménage d'interface d'Adrien). Leur
// comportement est FIGÉ dans le rendu — remplissage inconditionnel dans
// water-layer.js, densité et taille au défaut dans places-layer.js, halo
// supprimé — donc `resetAll()` n'a plus rien à remettre en place pour eux.
const DEFAULT_MAPLAYERS = Object.freeze({
  waterEnabled: params.waterEnabled,
  waterOpacity: params.waterOpacity,
  placesEnabled: params.placesEnabled,
})

function applyPalette(p) {
  // land ramp: a fixed 8-stop system. Overwrite the existing stop objects in
  // place (the GUI pickers are bound to these references) and NEVER resize the
  // array, so a stray-length source can't desync the pickers from the data. A
  // shorter source repeats its last stop; an empty one is ignored.
  if (Array.isArray(p.rampStops) && p.rampStops.length) {
    const src = p.rampStops
    params.rampStops.forEach((stop, i) => Object.assign(stop, src[Math.min(i, src.length - 1)]))
  }
  params.oceanShallow = p.oceanShallow ?? params.oceanShallow
  params.oceanMid = p.oceanMid ?? params.oceanMid
  params.oceanDeep = p.oceanDeep ?? params.oceanDeep
  terrain.rebuildRamp(params)
  globe.rebuildRamp(params)
  terrain.mapUniforms.uOceanShallow.value.set(params.oceanShallow)
  terrain.mapUniforms.uOceanMid.value.set(params.oceanMid)
  terrain.mapUniforms.uOceanDeep.value.set(params.oceanDeep)
  if (p.ink) {
    params.contourColor = p.ink
    terrain.mapUniforms.uContourColor.value.set(p.ink)
    globe.setInk(p.ink)
  }
  // c'est ICI que la teinte dominante change : l'ombre ambiante doit suivre.
  // applyBackground ne passe pas sur ce chemin (le dé change la palette sans
  // toucher au fond), d'où le rappel explicite.
  syncAoColor()
  // ...et l'INTERFACE aussi, pour la même raison. applyPalette est le péage
  // unique de toutes les routes qui changent la palette : template, template
  // utilisateur, shuffle, monochrome, reset, lien de partage et message embed
  // y passent tous. Une seule ligne couvre donc les six.
  syncUiTheme()
  // ⚠️ ET LES DALLES VOISINES. La rampe TERRESTRE suit toute seule (texture
  // partagée : `rebuildRamp` repointe ses emprunteuses), mais pas les trois
  // couleurs de la MER ni l'encre des courbes — sur une carte côtière, un
  // changement de palette accordait la terre entre les dalles et laissait le
  // désaccord de la mer pile sur la jointure.
  blockGrid?.diffuseDuCentre()
  refreshAll()
}

// La BRUME de la perspective aérienne suit le FOND : le lointain doit tendre
// vers la couleur de la scène pour s'y fondre au lieu de flotter devant.
// Même patron que syncAoColor — hoistée et gardée, parce qu'applyBackground
// peut tourner avant que le terrain existe (zone morte temporelle).
function syncHazeColor() {
  params.hazeColor = deriveHazeColor(params)
  // ⚠️ `terrain` et `blockGrid` sont des const déclarés plus bas : les LIRE
  // avant leur ligne lève (zone morte temporelle — `typeof` n'y échappe pas non
  // plus). D'où le drapeau `var` hoisté, exactement comme _aoReady au-dessus.
  if (!_colorReady) return
  terrain.mapUniforms.uHazeColor.value.set(params.hazeColor)
  blockGrid?.restyle(params)
}

function applyStyle(s) {
  Object.assign(params, s)
  terrain.mapUniforms.uTint.value = s.mapTint
  terrain.mapUniforms.uHeightContrast.value = s.heightContrast
  terrain.mapUniforms.uHeightPivot.value = s.heightPivot
  terrain.mapUniforms.uSlopeTint.value = s.slopeTint
  // ⚠️ ET LES DALLES VOISINES — sournois, celui-là : `applyAutoShade` (juste en
  // dessous) recalcule ces quatre valeurs à CHAQUE chargement de relief, donc
  // le désaccord apparaissait et disparaissait selon l'ordre d'arrivée des
  // dalles. Une voisine née avant le recalcul gardait l'ancien contraste.
  blockGrid?.diffuseDuCentre()
  refreshAll()
}

// ---------------------------------------------------------- OMBRAGE AUTO
// Les 4 réglages de la section « Ombrage » sont DÉRIVÉS du relief chargé
// (src/relief-grade.js) : une carte des Alpes et un delta plat ne peuvent pas
// partager le même contraste ni le même pivot. Pattern des drapeaux « dirty »
// de perf.js : un réglage que l'utilisateur a repris à la main n'est PLUS
// jamais réécrit par l'auto ; le toggle « Ombrage auto » rend la main.
const SHADE_KEYS = ['mapTint', 'heightContrast', 'heightPivot', 'slopeTint']
const shadeDirty = { mapTint: false, heightContrast: false, heightPivot: false, slopeTint: false }

// note de l'ombrage courant, pour la meta de section et les sondes navigateur
let shadeGrade = null

function currentReliefGrade() {
  if (params.source !== 'real' || !dem) return null
  // l'histogramme coûte une passe sur ~590 k pixels : calculé UNE fois par DEM
  if (!dem._elevHist) dem._elevHist = elevationHistogram(dem.data, dem.minM, dem.maxM)
  return gradeForDem({ minM: dem.minM, maxM: dem.maxM, meanM: dem.meanM, histogram: dem._elevHist, extentM: dem.extentMeters })
}

// `force` : le toggle qu'on rallume — tout redevient auto, y compris les
// curseurs que l'utilisateur avait figés.
function applyAutoShade({ force = false } = {}) {
  if (force) for (const k of SHADE_KEYS) shadeDirty[k] = false
  if (!params.shadeAuto) return null
  const g = currentReliefGrade()
  if (!g) return null
  shadeGrade = g
  const next = {}
  for (const k of SHADE_KEYS) next[k] = shadeDirty[k] ? params[k] : g[k]
  applyStyle(next)
  return g
}

// un curseur d'Ombrage bougé à la main gèle CE réglage-là (les trois autres
// continuent de suivre le relief) — appelé par les setters du panneau Terrain
function markShadeDirty(key) {
  if (params.shadeAuto && SHADE_KEYS.includes(key)) shadeDirty[key] = true
}

function applyGridContour(g) {
  Object.assign(params, g)
  terrain.mapUniforms.uContourInterval.value = g.contourInterval
  terrain.mapUniforms.uContourOpacity.value = g.contourOpacity
  terrain.mapUniforms.uContourColor.value.set(g.contourColor)
  terrain.mapUniforms.uGridStep.value = g.gridStep
  terrain.mapUniforms.uGridOpacity.value = g.gridOpacity
  if (g.gridColor) terrain.mapUniforms.uGridColor.value.set(g.gridColor)
  if (g.contourWeight != null && !params.darkMode) terrain.mapUniforms.uContourWeight.value = g.contourWeight
  globe.setInk(g.contourColor)
  // ⚠️ ET LES DALLES VOISINES. `_applyLook` recopie déjà l'encre du centre,
  // mais il ne tourne qu'à la naissance d'une dalle et sur `restyle()` : sans
  // cette ligne, traîner le curseur d'intervalle des courbes laissait le damier
  // en arrière jusqu'au prochain changement de palette ou de fond.
  // ⚠️ `diffuseDuCentre`, PAS `restyle` : celui-ci rejoue setColorMode /
  // setMaterialMode / setLiquidMetal sur 24 dalles, ce qu'un curseur traîné ne
  // peut pas payer. La diffusion, elle, ne fait que recopier : 8,0 µs pour 24 dalles, mesuré.
  blockGrid?.diffuseDuCentre()
  refreshAll()
}

// night survey: dark sheet, light ink, palettes flip to blacks/browns with
// vivid summit accents — the whole look follows one switch
function setDarkMode(v) {
  params.darkMode = v
  document.body.classList.toggle('dark', v) // drives the FUI + lil-gui theme
  const sheet = v ? DARK.sheet : '#ffffff'
  params.fogColor = sheet
  applyBackground() // params.fogColor already = sheet; rebuilds solid/gradient bg
  modes.whiteEl.style.background = sheet // transition flash follows the sheet
  document.documentElement.style.setProperty('--hud-ink', effInk())
  document.documentElement.style.setProperty(
    '--hud-paper',
    v ? DARK.paper : 'rgb(248 247 244 / var(--hud-bg-alpha))'
  )
  // panels need to be more opaque at night to stay readable over the dark 3D
  document.documentElement.style.setProperty('--hud-bg-alpha', v ? 0.9 : params.uiBgOpacity)
  applyGridContour({
    contourInterval: params.contourInterval,
    contourOpacity: params.contourOpacity,
    contourColor: v ? DARK.contour : DEFAULT_LOOK.contourColor,
    gridStep: params.gridStep,
    gridOpacity: params.gridOpacity,
    gridColor: v ? DARK.grid : DEFAULT_LOOK.gridColor,
  })
  // light ink reads bolder on dark terrain — thin the contour strokes further
  // so the sheet keeps its engraved fineness at night
  terrain.mapUniforms.uContourWeight.value = v ? 0.5 : params.contourWeight
  // ⚠️ ET UNE SECONDE DIFFUSION, APRÈS CETTE LIGNE-LÀ. `applyGridContour`
  // ci-dessus en a déjà fait une, mais elle a recopié l'épaisseur d'AVANT :
  // cette écriture-ci arrive après elle, exprès (voir le commentaire de
  // `_copieDuCentre` — le centre fait foi, on ne rejoue pas la règle). Sans ce
  // rappel, les voisines gardaient l'épaisseur du jour toute la nuit.
  blockGrid?.diffuseDuCentre()
  // the slab and its table follow the sheet, so the object reads as one piece
  params.plinthColor = v ? DARK.plinth : LIGHT_PLINTH.plinth
  plinth.setColors(params) // wall follows the mode; the table is shadow-only
  // draped place/elevation labels re-render with the mode's ink (labelOpts
  // reads params.darkMode), the 3D survey furniture (POI stems, circles)
  // regenerates in light ink, and the GPX profile canvas repaints with the
  // flipped --hud-ink — all would otherwise keep dark strokes on dark paper
  regenerateLabels()
  regenerateHud()
  gpxLayer.setHoverClear()
  groundInfo.rerender() // the cartouche re-inks to match the sheet
}

// full-white / full-dark museum look: relief shaded by light alone, applied
// in one shot (mode + palette + style + grid + slab)
function applyMonochrome(kind) {
  const L = monochromeLook(kind)
  setDarkMode(L.darkMode) // flips sheet/paper/plinth/ink first
  applyPalette(L)
  applyStyle(L)
  applyGridContour(L)
  history?.record() // committed look change — one undo step
}

// a look template: a full bundle that reproduces a reference image's style —
// palette + oceans + grid/contour + hillshade light + surface + background +
// post-look + scene toggles. Camera/navigation are never touched.
function applyLight(l) {
  Object.assign(params, l)
  // The day cycle owns the sun now: whatever legacy sun keys a template
  // carries (old saves have manual azimuth/elevation), the light that actually
  // lands is derived from timeOfDay for the current place. The legacy keys
  // still load harmlessly — they're simply re-derived over.
  applyTimeOfDay(params.timeOfDay ?? 10)
  sun.shadow.radius = params.shadowSoftness
  // applyTimeOfDay a déjà repassé par placeSun (l'intensité suit donc
  // l'interrupteur), mais l'OMBRE ne se décide qu'ici : sans cette ligne, un
  // gabarit « soleil éteint » importé garderait la carte 2048² allouée, et un
  // RESET LOOK ne rallumerait jamais l'ombre.
  applyShadowMode()
}
function applySurface(s) {
  Object.assign(params, s)
  terrain.updateMaterial(params)
  terrain.rebuildRoughness(params)
  if (params.liquidMetal) terrain.setLiquidMetal(true, params) // keep the chrome over template swaps
  // ⚠️ ET LES DALLES VOISINES. Les CARTES (rugosité, bump) leur arrivent toutes
  // seules — elles les empruntent au centre, et `rebuildRoughness` repointe ses
  // emprunteuses. Les SCALAIRES du matériau (bumpScale, envMapIntensity,
  // transmission, et le métal liquide) ne sont partagés par rien : sans cette
  // ligne, un template changeait le fini du centre et pas celui du damier.
  blockGrid?.diffuseDuCentre()
}
// Repose le développement maison. Seul resetLook s'en sert — les templates et
// le dé n'ont pas le droit d'y toucher (voir applyLook).
function applyGrade(g = BASE_GRADE) {
  exposureFx.uniforms.get('exposure').value = params.exposure = g.exposure
  contrastFx.uniforms.get('contrast').value = params.contrast = g.contrast
  hueSat.saturation = params.saturation = g.saturation
}
function applyLook(k) {
  if (k.fogColor != null) {
    params.fogColor = k.fogColor
    applyBackground()
    modes.whiteEl.style.background = k.fogColor
  }
  // ⚠️ exposition / contraste / saturation VOLONTAIREMENT IGNORÉS ici : ce trio
  // est le développement maison (BASE_GRADE), et applyLook est le chemin des
  // TEMPLATES et du dé. Seules les chips Développement et leurs tirettes y
  // touchent, via applyGrade ou directement depuis le panneau.
  if (k.vignette != null) vignette.darkness = params.vignette = k.vignette
  if (k.grain != null) grain.blendMode.opacity.value = params.grain = k.grain
  // render upgrades (2026-07-20): a template may carry the AO look.
  // Les trois clés de bloom d'un vieux gabarit ne sont plus lues : la passe a
  // été retirée le 2026-08-02. Elles sont ignorées en silence, comme les clés
  // de routes et de trait de côte avant elles.
  if (k.ssaoEnabled != null) params.ssaoEnabled = k.ssaoEnabled
  if (k.ssaoIntensity != null) ssao.intensity = params.ssaoIntensity = k.ssaoIntensity
  if (k.clouds != null) {
    params.cloudsEnabled = k.clouds
    if (k.clouds) clouds.build(params) // no point rebuilding just to hide them
    clouds.setVisible(k.clouds && socleAffiche())
  }
  if (k.plinth != null) {
    params.plinth = k.plinth
    // region-isolate drops the slab — a template must never re-show it under the cut
    plinth.setVisible(k.plinth && socleAffiche() && !params.regionMode)
  }
}
function applyTemplate(t) {
  setDarkMode(t.darkMode ?? false) // base theme first, template values override
  if (t.palette) applyPalette(t.palette)
  if (t.style) applyStyle(t.style)
  if (t.grid) applyGridContour(t.grid)
  if (t.light) applyLight(t.light)
  if (t.surface) applySurface(t.surface)
  if (t.look) applyLook(t.look)
  // elevation is NOT part of a look — the per-zoom exaggeration model owns it,
  // so switching templates never changes the relief (or recolours it via slope)
  refreshAll()
  history?.record() // committed look change — one undo step
}

// ---- user templates: save the current look, restyle the current view with a
// saved one (never moving the camera/location), export/import as .json ----
let userTemplates = loadUserTemplates()
// palettes VALIDÉES (Create › Save palette) — rangée défilable du panneau Templates
let userPalettes = loadUserPalettes()

// ---- réserve de palettes du mode aléatoire (shuffle-pool.js) --------------
// Le catalogue de la boutique (136 palettes) est le gros de la réserve : il
// est chargé UNE fois, en tâche de fond, dès que le moteur est posé. Un échec
// réseau laisse simplement la réserve sans la boutique (procédural + palettes
// utilisateur + templates installés) — jamais d'erreur visible, jamais de
// shuffle bloqué. Le catalogue est le MÊME fichier que la boutique in-app.
let shopPalettes = []
let shuffleLastPalette = null // dernière palette tirée (meta + sondes)
// ⚠️ PLUS AU DÉMARRAGE. Ce fichier de 11,7 Ko partait pendant le chargement,
// mesuré demandé à 3 706 ms et reçu à 3 847 ms sur le chemin critique, pour
// alimenter la réserve du mode ALÉATOIRE — que personne n'a encore pu déclencher
// à cet instant, puisque les panneaux sont derrière le voile. Il part maintenant
// une fois la carte à l'écran (voir hideLoading). Une requête et 12 Ko de moins
// devant le premier affichage ; le comportement du tirage est inchangé, et un
// tirage qui arriverait avant la réponse retombe sur la réserve procédurale +
// utilisateur, exactement comme quand le réseau échoue (le `.catch` d'origine).
let catalogueDemande = false
function chargeCataloguePalettes() {
  if (catalogueDemande) return
  catalogueDemande = true
  fetch('/templates/data.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (Array.isArray(j?.palettes)) shopPalettes = j.palettes })
    .catch(() => {})
}
// rebâtie à chaque tirage : l'utilisateur a pu valider une palette ou
// installer un style entre deux clics (le coût est de l'ordre de 150 rampes)
const currentPalettePool = () => {
  // LE FILET DU CHARGEMENT DIFFÉRÉ DU CATALOGUE (même patron que les racines du
  // globe) : toute demande de réserve s'assure que le catalogue a été réclamé.
  // Idempotent. Le tirage en cours n'attend PAS la réponse — il tire dans ce
  // qu'il a, comme il l'aurait fait sur un réseau lent ; c'est le suivant qui
  // profitera des 136 palettes de la boutique.
  chargeCataloguePalettes()
  return buildPalettePool({ shop: shopPalettes, userPalettes, userTemplates, builtins: Object.values(TEMPLATES) })
}
let paletteRefreshFn = () => {}
let userTplRefreshFn = () => {} // re-rend la rangée des templates user (boutique → intégration)

// push a captured look onto the live scene. Assign every look key onto params
// first, then run the same scene pushers a built-in template uses.
function applyUserTemplate(tmpl) {
  const L = tmpl.look || {}
  for (const k of TEMPLATE_KEYS) if (k in L) params[k] = L[k] == null ? L[k] : JSON.parse(JSON.stringify(L[k]))
  // L'EXAGÉRATION est un cas à part : syncExagToZoom() la relit du magasin
  // par zoom à chaque chargement de relief, donc la poser dans params seul
  // la ferait écraser au prochain DEM — le template semblerait la sauver sans
  // la sauver. On l'écrit dans le magasin du zoom courant, exactement ce que
  // fait la tirette de l'utilisateur (saveZoomExag).
  if (Number.isFinite(L.demExaggeration)) saveZoomExag(params.demZoom, L.demExaggeration)
  // un template d'avant Fonds v2 (sans stops/points) ne doit pas hériter de
  // ceux de la session : retomber sur SES bgColorA/B/C
  if (!('bgStops' in L)) params.bgStops = null
  if (!('bgPoints' in L)) params.bgPoints = null
  // même règle pour les gains de lumière et l'appoint : un gabarit d'AVANT eux
  // (Interlaken, UnderIce…) doit retrouver le cycle nu, pas le réglage que la
  // session traînait — sinon l'aller-retour export/import ne rend plus la même
  // image. Voir NEUTRAL_LIGHT_USER.
  for (const k of Object.keys(NEUTRAL_LIGHT_USER)) if (!(k in L)) params[k] = NEUTRAL_LIGHT_USER[k]
  // ⚠️ EXCEPTION à la règle du dessus, et elle est indispensable. Avant les
  // interrupteurs, c'est le CURSEUR d'intensité qui faisait l'interrupteur :
  // fillIntensity > 0 signifiait « appoint allumé ». Un gabarit d'hier qui
  // porte fillIntensity: 1.2 a donc été exporté AVEC son appoint ; le remettre
  // au neutre (éteint) lui ferait rendre une autre image que celle qu'on a
  // enregistrée. L'interrupteur absent se DÉDUIT donc de l'intensité, et non du
  // neutre. (Le soleil n'a pas ce problème : absent = allumé = ce qu'il était.)
  params.fillEnabled = fillEnabledInLook(L, params.fillIntensity)
  setDarkMode(params.darkMode ?? false)
  applyPalette({ rampStops: params.rampStops, oceanShallow: params.oceanShallow, oceanMid: params.oceanMid, oceanDeep: params.oceanDeep, ink: params.contourColor })
  applyStyle({ mapTint: params.mapTint, heightContrast: params.heightContrast, heightPivot: params.heightPivot, slopeTint: params.slopeTint })
  applyGridContour({ contourInterval: params.contourInterval, contourOpacity: params.contourOpacity, contourColor: params.contourColor, contourWeight: params.contourWeight, gridStep: params.gridStep, gridOpacity: params.gridOpacity, gridColor: params.gridColor })
  applyLight({ sunIntensity: params.sunIntensity, sunAzimuth: params.sunAzimuth, sunElevation: params.sunElevation, hemiIntensity: params.hemiIntensity, envLight: params.envLight, shadowSoftness: params.shadowSoftness, timeOfDay: params.timeOfDay })
  applySurface({ roughness: params.roughness, roughnessVariation: params.roughnessVariation, roughnessScale: params.roughnessScale, bumpScale: params.bumpScale, envMapIntensity: params.envMapIntensity })
  applyLook({ fogColor: params.fogColor, exposure: params.exposure, contrast: params.contrast, saturation: params.saturation, vignette: params.vignette, grain: params.grain, clouds: params.cloudsEnabled, plinth: params.plinth, ssaoEnabled: params.ssaoEnabled, ssaoIntensity: params.ssaoIntensity })
  applyBackground() // solid/gradient background from the captured look
  // camera lens / depth-of-field / shadow look
  if (params.fov != null) { camera.fov = params.fov; camera.updateProjectionMatrix() }
  if (params.bokehScale != null) { if (dof) dof.bokehScale = params.bokehScale; setDofEnabled(params.bokehEnabled && params.bokehScale > 0) }
  if (params.focusRatio != null && dof) poserMiseAuPoint(null, params.focusRatio)
  if (params.shadowMode) applyShadowMode()
  applyPlinthMaterial()
  terrain.setMaterialMode(params.terrainSurfaceMat || '', params)
  if (params.terrainSurfaceMat && params.terrainSurfaceMat !== 'glass' && params.terrainMatRoughness != null) {
    terrain.setTerrainMatRoughness(params.terrainMatRoughness) // honour the saved finish
  }
  terrain.setLiquidMetal(!!params.liquidMetal, params)
  terrain.setSurfaceFx(params.surfaceFx | 0)
  if ((params.surfaceFx | 0) > 0 && params.fx?.[params.surfaceFx]) terrain.applyFxParams(params.fx[params.surfaceFx])
  // COLORISATION DU RELIEF — un template d'avant ce chantier n'a pas la clé :
  // params garde alors sa valeur d'usine ('classic'), donc le rendu d'avant.
  // Le mode borne aussi le bruit de détail (géométrie) : régénérer s'il change.
  params.hazeColor = deriveHazeColor(params)
  if (terrain.setColorMode(params.colorMode || 'classic', params) && params.source === 'real') regenerateTerrain()
  if (clouds) {
    if (params.cloudsEnabled) clouds.build(params)
    clouds.setVisible(params.cloudsEnabled && socleAffiche())
  }
  shadersRefreshFn() // rebuild the relief-material sub-controls (Scale/Bump/Roughness/Noise) for the applied look
  bgRefreshFn() // resync the Background HDRI-sky highlight to the applied look
  refreshAll()
  setSeaEnabled(params.seaEnabled) // un template peut livrer une carte SANS mer
  rebuildMapLayers() // re-derive water/places for the current location under the restored look
  blockGrid?.restyle(params) // les dalles voisines du damier suivent la principale
  gpxLayer.rebuildAll() // re-drape every loaded track with the restored line width/colour/casing
  // LA POSE DE CAMÉRA, si le fichier en porte une. Direction normalisée +
  // facteur relatif à maxDistance : le cadrage se reproduit à l'identique sur
  // un bloc de n'importe quelle échelle (même arithmétique que applyIsoView).
  // Un template d'avant ce chantier n'a pas de bloc `view` — la caméra ne
  // bouge donc pas, exactement comme avant.
  const V = tmpl.view
  if (V && modes.mode === 'surface' && !modes.busy) {
    const target = new THREE.Vector3(...V.target)
    const dir = new THREE.Vector3(...V.dir).normalize()
    flyTo(target.clone().addScaledVector(dir, controls.maxDistance * V.k), target, { orbit: true })
  }
  // A history.record() taken right here re-captures EXACTLY what was just
  // applied (captureLook(params) after the assignment above), so it dedups
  // cleanly against the snapshot undo()/redo() just pushed through this same
  // function — no feedback loop, see history.js's record() dedup.
  history?.record()
}

// undo/redo apply target: pushes a captured "look" snapshot (see
// templates-user.js's TEMPLATE_KEYS / captureLook) back onto the live scene
// through the exact same pipeline a saved user template uses.
function applyAllParams(snap) {
  applyUserTemplate({ look: snap })
}

// bounded undo/redo stack over the look surface (palette/style/grid/light/
// surface/look/background/plinth/material/liquid-metal/surfaceFx/map layers)
// Qui écoute les bascules « annulable / rétablissable ». La barre du haut, qui
// grise ses deux boutons avec, ne naît que ~1700 lignes plus bas : ce relais
// évite de déplacer l'historique, dont applyAllParams dépend ici.
let onHistoryChange = null
const history = new History(() => captureLook(params), (snap) => applyAllParams(snap), {
  onChange: (s) => onHistoryChange?.(s),
})

// UNE seule porte pour annuler / rétablir, partagée par le clavier ET les deux
// boutons de la barre. Le flush n'est pas décoratif : un réglage fait il y a
// moins de 400 ms n'est pas encore dans la pile, et sans lui annuler saute le
// pas d'AVANT — ce qui se lit comme « l'annulation est cassée ».
const undoNow = () => { recordHistoryDebounced.flush?.(); return history.undo() }
const redoNow = () => { recordHistoryDebounced.flush?.(); return history.redo() }

// grab a small thumbnail of the live render for the template card
function captureThumbnail(w = 200, h = 120) {
  try {
    const src = renderer.domElement
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const sr = src.width / src.height
    const tr = w / h
    let sw = src.width, sh = src.height, sx = 0, sy = 0
    if (sr > tr) { sw = src.height * tr; sx = (src.width - sw) / 2 } else { sh = src.width / tr; sy = (src.height - sh) / 2 }
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.75)
  } catch { return null }
}

function persistUserTemplates() {
  if (!saveUserTemplates(userTemplates)) {
    // storage full — drop the just-added entry and tell the user
    userTemplates.pop()
    saveUserTemplates(userTemplates)
    alert('Template storage is full — delete a saved look (or export it to a file) and try again.')
    return false
  }
  return true
}
function saveCurrentTemplate(name) {
  majCarteOmbre() // la vignette doit porter l'ombre du look qu'on enregistre
  composer.render() // fresh frame so the thumbnail matches the screen
  const clean = String(name || '').trim().slice(0, 40) || 'My look'
  const look = captureLook(params)
  const { strip, shaders } = stripFromLook(look)
  // origine 'moi' : ce gabarit-ci sort des mains de l'utilisateur, il se range
  // dans « Mes créations » (voir src/bibliotheque-origine.js)
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: clean, origine: ORIGINE_MOI, thumb: captureThumbnail(), strip, shaders, view: captureView(camera, controls), look }
  userTemplates.push(t)
  persistUserTemplates()
  return t
}
function deleteUserTemplate(id) {
  userTemplates = userTemplates.filter((t) => t.id !== id)
  persistUserTemplates()
}
function telechargeGabarit(t) {
  const blob = new Blob([serializeTemplate(t)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(t.name || 'look').replace(/[^a-z0-9-_]+/gi, '-')}.shibumap-template.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
function exportUserTemplate(id) {
  const t = userTemplates.find((x) => x.id === id)
  if (!t) return
  telechargeGabarit(t)
}
// « Enregistrer mon gabarit », le bouton de l'avis « Continuer sans compte ».
// ⚠️ IL NE RANGE RIEN DANS LA BIBLIOTHÈQUE. On a promis un fichier sur SA
// machine, pas une entrée de plus dans « Mes créations » qu'il n'a pas
// demandée : sans compte, le fichier EST la sauvegarde, et c'est tout ce qu'on
// a dit qu'on ferait. Même contenu qu'un export de gabarit ordinaire.
function telechargerGabaritCourant() {
  majCarteOmbre()
  composer.render() // frame fraîche : la vignette doit montrer l'écran
  const look = captureLook(params)
  const { strip, shaders } = stripFromLook(look)
  const nom = String(params.demLocation || '').trim() || 'Mon gabarit'
  telechargeGabarit({
    id: `ut_${Date.now().toString(36)}`,
    name: nom,
    origine: ORIGINE_MOI,
    thumb: captureThumbnail(),
    strip,
    shaders,
    view: captureView(camera, controls),
    look,
  })
}
function importTemplateText(text) {
  const parsed = parseTemplate(text)
  if (!parsed) return null
  // On ne FORCE pas l'origine à l'import : un fichier de la boutique se déclare
  // 'shibumap', un export de l'utilisateur 'moi', et un fichier d'avant ce champ
  // n'en porte pas — provenance inconnue, tranchée par le contenu au moment de
  // l'affichage (src/bibliotheque-origine.js). Se déclarer de la maison n'ouvre
  // aucun droit, ça ne fait que ranger la carte dans un accordéon.
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: parsed.name, origine: parsed.origine || undefined, thumb: parsed.thumb, strip: parsed.strip, shaders: parsed.shaders, view: parsed.view, look: parsed.look }
  userTemplates.push(t)
  persistUserTemplates()
  // un gabarit passe par LA MÊME porte que les autres imports : c'est le
  // contenu qui décide. Aujourd'hui aucun n'embarque de trace (TEMPLATE_KEYS
  // exclut la trace, seul son STYLE voyage) — donc rien ne bascule, et c'est
  // le comportement attendu. Le jour où un fichier en portera une, il sera
  // traité comme un GPX sans qu'on ait à y repenser.
  enterRouteSpace(parsed)
  return t
}

// RESET LOOK restores the whole shipped scene — palette + style + grid AND the
// light / surface / post-FX / scene toggles a template may have changed
function resetLook() {
  setDarkMode(false)
  applyPalette({ ...DEFAULT_LOOK, ink: DEFAULT_LOOK.contourColor })
  applyStyle({
    mapTint: DEFAULT_LOOK.mapTint,
    heightContrast: DEFAULT_LOOK.heightContrast,
    heightPivot: DEFAULT_LOOK.heightPivot,
    slopeTint: DEFAULT_LOOK.slopeTint,
  })
  applyGridContour({
    contourInterval: DEFAULT_LOOK.contourInterval,
    contourOpacity: DEFAULT_LOOK.contourOpacity,
    contourColor: DEFAULT_LOOK.contourColor,
    contourWeight: DEFAULT_LOOK.contourWeight,
    gridStep: DEFAULT_LOOK.gridStep,
    gridOpacity: DEFAULT_LOOK.gridOpacity,
    gridColor: DEFAULT_LOOK.gridColor,
  })
  applyLight({ ...DEFAULT_LIGHT })
  applySurface({ ...DEFAULT_SURFACE })
  applyLook({ ...DEFAULT_FX })
  applyGrade() // le développement maison fait partie du « neutre »
  // elevation is per-zoom (persisted), not part of the look — left untouched
}

// RESET MAP (Templates panel) — extends RESET LOOK to also clear everything
// else a template or a panel can leave dangling: background, socle material,
// the whole-relief material / liquid metal / surface shader, clouds, fog and
// the map overlay layers (water/places). Location/zoom are never
// touched — this is a look reset, not a "start over" — and any function it
// calls is declared further down in this file; that's fine, resetAll is only
// ever invoked from a UI click, long after the whole module has finished
// initialising.
function resetAll() {
  resetLook()
  // background — clear the HDRI sky / gradient and fall back to the shipped
  // solid backdrop, then resync the Background panel's sky picker highlight
  Object.assign(params, DEFAULT_BG)
  applyBackground()
  bgRefreshFn()
  // socle (Block panel) material
  Object.assign(params, DEFAULT_PLINTH)
  applyPlinthMaterial()
  plinth.rebuild(terrain, params)
  // whole-relief material / liquid metal / surface shader (Shaders panel) —
  // mutually exclusive, so clearing all three in turn is always safe
  params.terrainSurfaceMat = ''
  terrain.setMaterialMode('', params)
  params.liquidMetal = false
  terrain.setLiquidMetal(false, params)
  params.surfaceFx = 0
  terrain.setSurfaceFx(0)
  shadersRefreshFn()
  // clouds off
  params.cloudsEnabled = false
  clouds.setVisible(false)
  // (plus rien à éteindre pour la brume : elle a été retirée le 2026-08-02)
  // depth of field off
  params.bokehEnabled = false
  setDofEnabled(false)
  // map overlay layers (water/places)
  Object.assign(params, DEFAULT_MAPLAYERS)
  rebuildMapLayers()
  blockGrid?.restyle(params) // les dalles voisines retombent aussi sur la base
  history?.record() // committed look change — one undo step
}

// Palette de fond + socle du shuffle, ACCORDÉE À LA CARTE (Adrien) : on lit la
// teinte signature de la carte (un arrêt haut-médian de la rampe hypso, sinon
// l'océan) et on construit le fond PAR RAPPORT à elle selon une stratégie —
//   · match      : analogue à la carte (même famille chromatique, il se marie)
//   · opposition : complémentaire / split-complémentaire (contraste franc mais juste)
//   · light      : très clair, quasi-blanc à peine teinté (socle sombre en regard)
//   · dark       : très foncé, quasi-noir teinté (socle clair en regard)
// Contraste des arrêts tiré BAS ou FORT à chaque fois.
function elegantColorScheme() {
  const rnd = (a, b) => a + Math.random() * (b - a)
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const clamp01 = (x) => Math.max(0, Math.min(1, x))
  const clampL = (l) => Math.max(5, Math.min(97, l))
  const hsl = (h, s, l) => '#' + new THREE.Color().setHSL(((((h % 360) + 360) % 360) / 360), clamp01(s / 100), clamp01(l / 100)).getHexString()

  // teinte signature de la carte (fraîche : applyPalette a déjà réécrit rampStops)
  const stops = Array.isArray(params.rampStops) ? params.rampStops.map((s) => s?.c).filter(Boolean) : []
  const sigHex = stops.length ? stops[Math.min(stops.length - 1, Math.round(stops.length * 0.6))] : (params.oceanMid || params.oceanDeep || '#6b7a8f')
  const sh = {}; new THREE.Color(sigHex).getHSL(sh)
  const Hmap = sh.h * 360, Smap = sh.s * 100

  const strategy = pick(['match', 'match', 'opposition', 'opposition', 'light', 'dark'])
  const highContrast = Math.random() < 0.5
  let hues, s, lMid, spread, plinthL, plinthS
  if (strategy === 'match') {
    hues = [Hmap, Hmap + 24, Hmap - 24] // analogue : même famille que la carte
    s = Math.max(12, Math.min(52, Smap * rnd(0.55, 1.0)))
    lMid = rnd(42, 78) // un fond aéré qui laisse le relief ressortir
    spread = highContrast ? rnd(22, 42) : rnd(6, 14)
    plinthL = Math.random() < 0.5 ? rnd(16, 30) : rnd(80, 92); plinthS = rnd(4, 12)
  } else if (strategy === 'opposition') {
    hues = [Hmap + 180, Hmap + 156, Hmap + 204] // complémentaire + split
    s = rnd(24, 56)
    lMid = rnd(36, 72)
    spread = highContrast ? rnd(24, 44) : rnd(8, 16)
    plinthL = Math.random() < 0.5 ? rnd(14, 28) : rnd(82, 92); plinthS = rnd(4, 12)
  } else if (strategy === 'light') {
    hues = [Hmap, Hmap + 14, Hmap - 14] // quasi-blanc à peine teinté de la carte
    s = rnd(4, 16)
    lMid = rnd(88, 95)
    spread = highContrast ? rnd(6, 12) : rnd(2, 5)
    plinthL = rnd(14, 26); plinthS = rnd(3, 10) // socle sombre en regard
  } else {
    hues = [Hmap, Hmap + 14, Hmap - 14] // quasi-noir teinté de la carte
    s = rnd(8, 26)
    lMid = rnd(7, 15)
    spread = highContrast ? rnd(5, 11) : rnd(2, 5)
    plinthL = rnd(78, 92); plinthS = rnd(3, 10) // socle clair en regard
  }
  const a = hsl(hues[0], s * 0.92, clampL(lMid + spread * 0.5))
  const b = hsl(hues[1], s, clampL(lMid))
  const c = hsl(hues[2], s * 1.05, clampL(lMid - spread * 0.5))
  const mode = strategy === 'light' || strategy === 'dark'
    ? pick(['solid', 'solid', 'linear', 'radial'])
    : pick(['solid', 'linear', 'linear', 'radial', 'mesh'])
  const angle = Math.floor(rnd(0, 360))
  const plinth = hsl(Hmap, plinthS, plinthL) // proche-neutre teinté du schéma
  return { mode, a, b, c, angle, plinth, strategy, highContrast }
}

// SHUFFLE (Adrien) — rebats every look option at once: a coherent built-in
// template as a base, then a fresh sea (new seed → different sea), a random
// surface shader, a random hour, and a few layer toggles on top. Location and
// camera are never touched. One history step, so Ctrl+Z / the base button both
// undo the whole thing in one move.
function shuffleLook() {
  const rnd = (a, b) => a + Math.random() * (b - a)
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const chance = (p) => Math.random() < p

  // 1) base cohérente — un look intégré au hasard, appliqué EN LIGNE (pas de
  //    history.record() intermédiaire comme applyTemplate : le shuffle reste
  //    UNE étape). Il ne donne plus que la STRUCTURE (lumière, matière,
  //    grille, post-look) : la couleur, elle, vient de la vraie réserve.
  const tpl = pick(Object.values(TEMPLATES))
  setDarkMode(tpl.darkMode ?? false)
  if (tpl.grid) applyGridContour(tpl.grid)
  if (tpl.light) applyLight(tpl.light)
  if (tpl.surface) applySurface(tpl.surface)
  if (tpl.look) applyLook(tpl.look)

  // 1b) PALETTE — la VRAIE réserve (Adrien : « des centaines de palettes en
  //     réserve dans l'appli ») : catalogue boutique, palettes validées,
  //     templates installés, générateurs procéduraux de palette.js. Le filtre
  //     d'élégance de shuffle-pool.js écarte les aplats et les mers qui
  //     s'éclaircissent en profondeur — jamais de tirage moche.
  //     applyPalette APRÈS applyGridContour : l'encre de la palette gagne.
  const palette = pickShufflePalette(Math.random, currentPalettePool())
  applyPalette(palette)
  shuffleLastPalette = palette

  // 2) random hour of day (daylight-ish band so it rarely lands pitch black)
  params.timeOfDay = +rnd(5.5, 19.5).toFixed(1)
  applyTimeOfDay(params.timeOfDay)
  hourPill?.refresh?.()

  // 3) surface shader — 45% a random FX, but DISCREET (Adrien) : an elegant
  //    blend MASK + low opacity so it textures the map instead of replacing it.
  const fxIds = FX_LIST.map((f) => f.id).filter((id) => id > 0)
  params.surfaceFx = chance(0.45) ? pick(fxIds) : 0
  terrain.setSurfaceFx(params.surfaceFx | 0)
  if (params.surfaceFx > 0 && params.fx?.[params.surfaceFx]) {
    const fp = params.fx[params.surfaceFx]
    // BLEND_MODES indices (fx-meta.js) — les modes qui restent élégants : 10 Soft
    // light · 9 Overlay · 2 Multiply · 6 Screen · 16 Colour · 17 Luminosity.
    // Soft light / Overlay pondérés (les plus sûrs sur une carte claire) ; on
    // évite Normal (remplacement) et les modes durs (burn/dodge/difference…).
    fp.blend = pick([10, 10, 10, 9, 9, 2, 6, 16, 17])
    fp.opacity = +rnd(0.18, 0.5).toFixed(2) // discret : une texture, pas un aplat
    terrain.applyFxParams(fp)
  }

  // 4) animated sea — usually on, with a NEW seed so the swell differs each
  //    time. ⚠️ plages bornées à l'état « Agitée » des chips Mer (plafond F3,
  //    règle Adrien) — l'aléatoire ne doit pas dépasser ce que l'UI permet
  params.waterReal = chance(0.75)
  params.seaSeed = Math.floor(rnd(1, 9999))
  params.seaWaveH = +rnd(0.3, 1.5).toFixed(2)
  params.seaChop = +rnd(0.3, 0.95).toFixed(2)
  params.seaSpeed = +rnd(0.6, 1.35).toFixed(2)
  params.seaBed = pick(['map', 'sand', 'lagoon', 'abyss', 'seagrass', 'ink'])
  waterRebuild()
  realWater?.setWaves?.({ height: params.seaWaveH, choppiness: params.seaChop, speed: params.seaSpeed })
  realWater?.setLook?.(params)

  // 5) layers — a few random toggles. Contours/grid dialled, clouds on/off,
  //    aerial optimistically tried (refreshAerial re-disables it where there's
  //    no imagery, so this can never leave a lying green tick)
  params.contourOpacity = chance(0.5) ? +rnd(0.15, 0.6).toFixed(2) : 0
  params.gridOpacity = chance(0.3) ? +rnd(0.1, 0.4).toFixed(2) : 0
  applyGridContour({ contourInterval: params.contourInterval, contourOpacity: params.contourOpacity, contourColor: params.contourColor, contourWeight: params.contourWeight, gridStep: params.gridStep, gridOpacity: params.gridOpacity, gridColor: params.gridColor })
  // CIEL — on REDESSINE tous les réglages de nuages au lieu de garder ceux
  // que le template vient de poser. Les templates ont été écrits à l'époque
  // de l'ancien moteur : leurs valeurs vivaient sur d'autres échelles
  // (couverture 0–0.8, gonflement 0–1) et un shuffle « régressait » sur une
  // vieille tête de nuages. Un tirage neuf, dans les plages ACTUELLES, ferme
  // le sujet — et le vent change aussi, sinon toutes les cartes ont le même.
  params.cloudsEnabled = chance(0.4)
  Object.assign(params, {
    cloudCoverage: +rnd(0.85, 2.2).toFixed(2),
    cloudBillow: +rnd(0.4, 2.6).toFixed(2),
    cloudTexMix: +rnd(0.15, 0.7).toFixed(2),
    cloudOpacity: +rnd(0.8, 1.8).toFixed(2),
    cloudContrast: +rnd(0.7, 1.6).toFixed(2),
    cloudAltitude: +rnd(3.5, 7).toFixed(1),
    cloudAltSpread: +rnd(0.6, 1).toFixed(2),
    cloudScale: +rnd(3, 5).toFixed(1),
    windDir: Math.round(rnd(0, 359)),
    windSpeed: +rnd(0.3, 1.6).toFixed(2),
  })
  if (clouds) { if (params.cloudsEnabled) clouds.build(params); clouds.setVisible(params.cloudsEnabled && socleAffiche()) }
  params.aerialEnabled = chance(0.3)
  refreshAerial()

  // 5b) BOKEH — profondeur de champ, parfois, pour un rendu maquette (Adrien).
  //     Autofocus sur le relief + bande de netteté resserrée → l'avant/arrière
  //     fond en flou. Échelle modérée (jamais le max 32, pour rester élégant).
  params.bokehEnabled = chance(0.4)
  if (params.bokehEnabled) {
    params.autoFocus = true
    params.bokehScale = +rnd(5, 18).toFixed(1)
    params.focusRatio = +rnd(0.12, 0.45).toFixed(2) // k : la plage vaut k × la distance de focus (D20)
  }
  setDofEnabled(params.bokehEnabled && params.bokehScale > 0)
  if (dof) { dof.bokehScale = params.bokehScale; poserMiseAuPoint(null, params.focusRatio) }

  // 6) FOND + SOCLE par théorie des couleurs (Adrien) : un schéma élégant
  //    (complémentaire / split / analogue / triadique / mono), contraste bas ou
  //    fort au hasard. Le fond prend un uni ou un dégradé harmonieux ; le socle
  //    prend une couleur unie proche-neutre teintée du même schéma.
  const sch = elegantColorScheme()
  params.bgEnv = '' // le shuffle reste procédural (pas de ciel HDRI)
  params.bgMode = sch.mode
  params.bgColorA = sch.a
  params.bgColorB = sch.b
  params.bgColorC = sch.c
  params.bgAngle = sch.angle
  params.bgStops = null // re-dérivés des nouveaux A/B/C par applyBackground
  params.bgPoints = null
  applyBackground()
  // un schéma sombre doit basculer le dark mode (sinon cartouche noir sur
  // noir — même garde-fou que l'édition manuelle du fond)
  autoDarkFromBg()
  bgRefreshFn() // resync des sélecteurs du panneau Background
  // socle : finition unie (stone → plinthColor visible) dans la couleur du schéma
  params.plinthFinish = 'solid'
  params.plinthPbr = 'stone'
  params.plinthColor = sch.plinth
  applyPlinthMaterial()
  plinth.setColors(params)

  // 7) OMBRAGE accordé au relief RÉELLEMENT chargé (relief-grade.js). Le look
  //    de base a posé en 1) des constantes réglées sur une AUTRE carte ; on
  //    les remplace par le calcul sur le DEM courant. Un shuffle est un
  //    tirage complet, donc il rend la main à l'auto (force) même si des
  //    curseurs avaient été figés à la main.
  params.shadeAuto = true
  applyAutoShade({ force: true })

  refreshAll()
  history?.record() // one undo step for the whole shuffle
  modes?.announce?.('SHUFFLE')
}

// ------------------------------------------------------------------ GPX layer(s)
// task 22: gpxLayer is now a GpxLayerManager — a stack of up to MAX_LAYERS
// GpxLayer instances (gpx-layers.js). It exposes the same track/headT/
// play()/pause()/setColor()-etc. surface a single GpxLayer always did (see
// its own file header for why: a drop-in replacement, zero-touch for every
// call site below that predates multi-layer support), plus addLayer/
// removeLayer/reorder/focus for the Route panel's layer list.

// damier de blocs voisins (block-grid.js) : quand un tracé GPX déborde du bloc
// central aux zooms fins, des blocs de même taille/apparence portent la suite
// du tracé ; ils disparaissent au dézoom. Fondation du futur système 5×5.
const blockGrid = new BlockGrid({ scene, params, getMainDem: () => dem, getMainTerrain: () => terrain, getPlinth: () => plinth })
// à partir d'ici terrain ET blockGrid existent : la couleur de brume peut être
// poussée (voir syncHazeColor et le drapeau _colorReady)
_colorReady = true
syncHazeColor()

// ═══════ UNE SEULE MER, UNE SEULE JUPE, POUR TOUT LE CARRÉ DU DAMIER ════════
//
// Trois choses descendent d'ici vers `realWater.rebuild` : le CARRÉ (largeur,
// résolution du champ, centre), un ÉCHANTILLONNEUR qui sait répondre au-delà du
// bloc central, et le PLANCHER commun où la jupe s'arrête.

/**
 * Le carré que la mer doit couvrir.
 *
 * ⚠️ `empriseVivante()`, JAMAIS `carreCourant()`. La première dit ce qui est
 * POSÉ — jusqu'à 5×5 quand une zone isolée est active ; la seconde dit ce que
 * le TRACÉ a réclamé et se plafonne à 3×3 (block-grid.js).
 *
 * ⚠️ ET LE SYMPTÔME N'EST PAS « UNE MER TROP PETITE » — corrigé le 2026-08-05,
 * la règle était juste, sa justification fausse. Les deux carrés ne diffèrent
 * QUE sous zone isolée (le chemin GPX pose exactement le carré qu'il vient de
 * calculer, `_poseCarre`), et la zone isolée allume `params.regionMode` — qui
 * fait sauter à `ocean.js` TOUTE la mer ouverte ET sa jupe : elles sont sous le
 * seul `if (seaY > -9000 && !params.regionMode)` de `rebuild`. Ce qu'on
 * casserait en lisant l'autre, c'est le CHAMP CUIT (`_bakeField`, en amont de ce
 * `if`) et les LACS, qui lisent tous deux `_span`/`uCentre` : leur échelle et
 * leur centre seraient ceux d'un carré plus petit que la carte posée. Un défaut
 * plus discret que « la mer s'arrête trop tôt », donc pire à trouver.
 */
function carreDeMer() {
  return blockGrid.empriseVivante()
}

/**
 * La FABRIQUE d'échantillonneur de sol du carré, pour la cuisson du champ.
 *
 * ⚠️ `terrain.sample` NE SUFFIT PAS, et son échec est muet : il ne connaît que
 * le MNT du bloc central, et `sampleDem` clampe hors de ses bornes (dem.js).
 * Cuit avec lui sur les 168 unités d'un 3×3, le champ aurait recopié la rangée
 * de bord du bloc central sur toute la bande voisine — donc de la TERRE partout
 * où ce bord touche la terre, donc pas de mer sur les huit cases : l'inverse
 * exact de ce que la mer étendue existe pour faire.
 *
 * ⚠️ ET `heightAt` NON PLUS, POUR LA RAISON INVERSE : il passe par
 * `cell.terrain.sample`, donc cinq octaves de simplex par point. Le chiffre est
 * dans `blockGrid.echantillonSansGrain` — 285 ms de fil principal gelé contre
 * 53 sur un 3×3. `terrain.js:2083` documente déjà ce refus pour la fenêtre
 * continue, et pour la même raison : le grain est éteint sous 90 m par
 * `landFactor`, donc NUL à la ligne d'eau — la seule chose que ce champ sert à
 * trouver. On paierait un quart de seconde pour un déplacement nul là où on
 * regarde.
 * `blockGrid.echantillonSansGrain` prend le même chemin que `sampleChamp`, pour
 * le centre comme pour les voisines — tout ou rien, et la raison est là-bas (ce
 * n'est PAS une marche de fond à la jointure : le grain est nul partout où il y
 * a de la mer, mesuré à zéro exact sur 1 327 104 texels).
 *
 * Une FABRIQUE et non un échantillonneur : le champ est recuit après coup
 * (`merRecuitDiffere`), et le damier a pu gagner des cases entre-temps.
 */
function fabriqueSolDuDamier() {
  return blockGrid.echantillonSansGrain(params, terrain.sampleChamp(params))
}

// L'état de départ EST un bloc seul : rien à reconstruire tant que le damier
// reste vide. (`cleDuCarre` vit dans damier-carre.js — le nombre de
// reconstructions qu'elle produit sur une rafale d'arrivées est mesuré là-bas.)
let _merCarrePose = cleDuCarre({ i0: 0, j0: 0, cote: 1 })

function optionsDeMer() {
  const carre = carreDeMer()
  // toute reconstruction fait foi, d'où qu'elle vienne (zoom, template, zone) :
  // sans cette ligne la mémoire ci-dessous se périmerait en silence et la mer
  // resterait taillée sur un carré qu'elle ne porte plus.
  _merCarrePose = cleDuCarre(carre)
  return {
    terrain,
    params,
    carre,
    // ⚠️ SEULEMENT QUAND LE DAMIER S'ÉTEND. Sur un bloc seul, le champ garde le
    // chemin d'avant (`terrain.sample`, grain compris) : le rendre lisse là
    // aussi changerait la mer du bloc principal, qui n'est pas le sujet.
    fabriqueSol: carre.cote > 1 ? fabriqueSolDuDamier : null,
    // ⚠️ MÊME RÈGLE POUR LA JUPE. Lui imposer le `baseY` du socle sur un bloc
    // seul l'allongerait sans raison et changerait l'aspect du bloc principal.
    planchier: carre.cote > 1 ? blockGrid.planchierCommun() : null,
  }
}

/**
 * Le damier a gagné ou perdu une case — la mer suit, mais PAS À CHAQUE FOIS.
 *
 * ⚠️ NE PAS REBÂTIR À CHAQUE ARRIVÉE DE CELLULE. `onGridChanged` part à chaque
 * dalle reçue (jusqu'à 24 sur un damier plein) et une reconstruction recuit le
 * champ. Le seul motif légitime de RECONSTRUIRE est un changement de FORME du
 * carré — son côté ou son centre —, et `cleDuCarre` porte exactement ces deux-là.
 *
 * ⚠️ MAIS LE CHAMP, LUI, DOIT RATTRAPER LE DAMIER. Le carré s'ouvre dès la
 * PREMIÈRE voisine ; les six ou sept suivantes ne changent plus sa forme, donc
 * ne reconstruisent rien — et leur relief resterait absent du champ, c'est-à-dire
 * PAS DE MER là où le bord du bloc central est de la terre. C'est le scénario
 * NOMINAL, pas un cas limite. D'où le recuit différé ci-dessous : ni par dalle
 * (huit cuissons d'affilée gèlent la page), ni jamais.
 */
function merSuitLeDamier() {
  const carre = carreDeMer() // lu UNE fois : il traverse les deux décisions
  const cle = cleDuCarre(carre)
  if (cle !== _merCarrePose) {
    // ⚠️ NOTÉ ICI AUSSI, pas seulement dans `optionsDeMer` : quand la mer est
    // débrayée (FLAGS.water, ou l'interrupteur), `realWater?.rebuild(...)`
    // court-circuite l'évaluation de ses arguments et la mémoire ne serait
    // jamais rafraîchie — le garde ne convergerait plus et rappellerait
    // waterRebuild à chaque arrivée de dalle, pour rien.
    _merCarrePose = cle
    waterRebuild()
  }
  merRecuitDiffere(carre)
}

// ⏱️ LE RECUIT DIFFÉRÉ DU CHAMP — un seul, après la dernière arrivée.
//
// La mécanique (l'amortissement, et surtout l'annulation quand le damier se
// referme) vit dans `RealWater.recuireChampDiffere` : la mer possède son champ,
// donc la décision de le recuire, et ce fichier-ci n'est exécutable par aucun
// test alors qu'`ocean.js` l'est. Ce n'est PAS une reconstruction : ni
// géométrie, ni matériau, ni lacs — seulement la texture du champ, repointée
// partout.
function merRecuitDiffere(carre) {
  realWater?.recuireChampDiffere?.(carre.cote)
}

// ═══════ LE CARTOUCHE GRAVÉ S'ÉCARTE AVEC LE DAMIER ═════════════════════════
//
// « Lorsqu'on a plusieurs cases, les blocs se construisent SUR les textes. Il
// faut que les textes s'éloignent tout en restant à la même distance du bloc le
// plus proche qu'ils le sont actuellement — vers le sud, l'est et l'ouest en
// fonction de la grille produite. Et se rapprocher si j'ai moins de blocs
// affichés. » (Adrien)
//
// ⚠️ MÊME LECTURE QUE LA MER : `empriseVivante()`, jamais `carreCourant()` — la
// raison est écrite en toutes lettres sur `carreDeMer` ci-dessus.
//
// ⚠️ QUATRIÈME MOTIF DE RECONSTRUCTION DE LA BOUCLE `onGridChanged`, mais le
// moins cher des quatre : le garde vit dans `GroundInfoLayer.setCarre` et ne
// laisse passer qu'un changement de FORME du carré (côté ou coin), soit trois
// ou quatre fois sur une rafale de 24 arrivées — comptés par
// test/damier-cadre.test.js, qui rougit si ce nombre remonte.
function cartoucheSuitLeDamier() {
  groundInfo.setCarre(blockGrid.empriseVivante())
}

const gpxLayer = new GpxLayerManager({ scene, camera, terrain, params, getDem: () => dem, getGrid: () => blockGrid })

// ---- Race Studio : état de la course + cartouches espace-écran ------------
// raceState est rempli par le studio (src/ui/studio.js) ; les cartouches se
// projettent chaque frame (taille constante, anti-chevauchement débrayable).
const raceState = { name: '', logo: null, waypoints: [], transports: { cats: [], removed: [], pois: [] } }
let _wasPlaying = false // détection de FIN de lecture (finale iso)
const _headSpeed = { km: 0, t: 0, v: 0 } // vitesse tête lissée (km/s) — fenêtre d'apparition
const raceLabels = buildRaceLabels({
  container,
  camera,
  params,
  // `track.world` est en coordonnées de CHAMP : les cartouches doivent
  // retrancher le décalage de fenêtre avant de projeter, sinon ils restent
  // collés à l'écran pendant que leur ravitaillement s'en va.
  getFenetre: () => terrain.fenetre,
  getItems: () => {
    const items = []
    const lay = gpxLayer.activeLayer
    const track = lay?.gpx?.track
    // « quand je quitte la course, les étiquettes disparaissent » — pas de
    // trace = rien ; œil fermé ou infos course désactivées = rien non plus
    if (!track?.world || lay.visible === false || lay.showRaceInfo === false) return items
    // en lecture, un cartouche n'apparaît que ~1,5 s AVANT le passage de la
    // tête et s'efface ~4 s après (Adrien) — fenêtre en km via la vitesse
    // estimée de la tête ; hors lecture, tout est visible
    const totKm = track.cumKm[track.cumKm.length - 1]
    const playing = gpxLayer.isPlaying?.()
    const headKm = playing ? (gpxLayer.headT ?? 1) * totKm : Infinity
    // fenêtre (Adrien) : apparaît AVANT le passage de la tête QUOI QU'IL
    // ARRIVE — 2 km mini, élargie à 4 s de course si la lecture va vite
    // (le fondu de 1,8 s est toujours terminé avant l'arrivée de la tête)
    const nowMs = performance.now()
    if (playing) {
      const dts = Math.max(1e-3, (nowMs - (_headSpeed.t || nowMs)) / 1000)
      if (_headSpeed.t) _headSpeed.v = _headSpeed.v * 0.85 + (Math.max(0, headKm - _headSpeed.km) / dts) * 0.15
      _headSpeed.km = headKm
      _headSpeed.t = nowMs
    } else { _headSpeed.t = 0; _headSpeed.v = 0 }
    const kmLead = Math.max(2, _headSpeed.v * 4)
    const kmTail = 10
    // règle du damier (Adrien) : ce qui sort des blocs chargés (5×5 max) est
    // COUPÉ — un point au-delà de l'emprise réelle ne s'affiche pas
    //
    // ⚠️ EN MODE CONTINU LE DAMIER N'EXISTE PAS et la règle change de nature :
    // `p` est en coordonnées de CHAMP, la fenêtre est le socle, et ce qui compte
    // est « ce point est-il DANS le socle affiché en ce moment ». Sans cette
    // branche, `Math.round(p.x / 56)` renvoyait la cellule d'un damier vide et
    // tous les cartouches au-delà du bloc central disparaissaient — alors même
    // que leur relief, lui, est bien là.
    const fenCourse = terrain.fenetre ?? { x: 0, z: 0 }
    const blocCourse = dem?.empriseCote > 1 ? terrain.blockFootprint() : null
    const covered = (p) => {
      if (blocCourse) return dansFenetre(p.x - fenCourse.x, p.z - fenCourse.z, blocCourse.half, blocCourse.corner)
      const i = Math.round(p.x / TERRAIN_SIZE)
      const j = Math.round(p.z / TERRAIN_SIZE)
      return (i === 0 && j === 0) || !!blockGrid?.cells?.has(`${i},${j}`)
    }
    // étiquette DÉPART — la plus importante : gros logo + km totaux (+ les
    // pictos du point de départ, 8 max) ; TOUJOURS visible, jamais fenêtrée
    if ((raceState.name || raceState.logo) && track.world[0] && covered(track.world[0])) {
      const startWp = raceState.waypoints.find((w) => w.km < 0.5)
      const last = track.world[track.world.length - 1]
      const isLoop = track.world[0].distanceTo(last) < TERRAIN_SIZE * 0.02 // ~boucle : départ ≈ arrivée
      items.push({
        id: 'race_start',
        kind: 'start',
        world: track.world[0],
        word: isLoop ? 'START / FINISH' : 'START',
        name: raceState.name,
        logo: raceState.logo,
        totalKm: Math.round(totKm),
        pictos: (startWp?.pictos || []).slice(0, 8),
        faded: false,
      })
      if (!isLoop && covered(last)) {
        const endWp = raceState.waypoints.find((w) => w.km > totKm - 0.5)
        items.push({
          id: 'race_finish',
          kind: 'start',
          world: last,
          word: 'FINISH',
          name: raceState.name,
          logo: raceState.logo,
          totalKm: Math.round(totKm),
          pictos: (endWp?.pictos || []).slice(0, 8),
          faded: false,
        })
      }
    }
    {
      for (const w of raceState.waypoints) {
        if (w.idx == null || !track.world[w.idx]) continue
        if (!covered(track.world[w.idx])) continue
        // fenêtre de lecture : hors [−2 km, +10 km] l'étiquette reste montée
        // mais FONDUE (opacité 0 en 1,8 s) — voir .rl-faded
        const faded = playing && (w.km > headKm + kmLead || w.km < headKm - kmTail)
        items.push({
          id: `wp_${w.idx}`,
          kind: 'waypoint',
          world: track.world[w.idx],
          km: w.km,
          name: w.name,
          alt: w.alt ?? track.points?.[w.idx]?.ele ?? null,
          pictos: w.pictos,
          cutoff: w.cutoff,
          faded,
        })
      }
    }
    for (const p of raceState.transports.pois) {
      if (!p.world || raceState.transports.removed.includes(p.id) || !covered(p.world)) continue
      items.push({ id: p.id, kind: 'transport', world: p.world, name: p.name, pictos: [p.cat] })
    }
    return items
  },
  onRemove: (id) => {
    raceState.transports.removed.push(id)
    raceLabels.setDirty()
  },
})

// ---- La barre course : plein écran, hauteur fixe, seule survivante à
// l'écran pendant la lecture d'un tracé — voir syncCourseBarMode() plus bas
// pour l'entrée/sortie de mode (déclenchée par gpxLayer.isPlaying(), pas par
// les call sites d'engage/disengageGpxFollow, pour couvrir aussi la fin de
// lecture automatique et le bouton ✕ du profil). Le Carnet (droite) et le
// profil de gpx.js (gauche, RÉUTILISÉ tel quel — voir syncCourseBarMode)
// vivent tous les deux dedans, plus de carte flottante séparée.
const courseBar = buildCourseBar({
  // ⚠️ DANS body, PAS DANS #app — et c'est structurel, pas cosmétique.
  // `#app` porte la règle `#app, #app canvas { width: 100vw; height: 100vh }`
  // (style.css) pour la scène 3D. Or la barre ACCUEILLE le profil GPX, qui
  // est un <canvas> : posée dans #app, ce canvas héritait de 100vw/100vh par
  // un sélecteur d'ID imbattable en spécificité, et débordait sa zone
  // (constaté le 2026-08-04 : canvas à 1014 px dans un panneau de 344 px).
  // La barre est du chrome d'interface : sa place est à côté de la scène.
  container: document.body,
  onTogglePlay: () => togglePlay(),
  onQuit: () => quitterModeCourse(),
  // Stop ≠ Pause ≠ Quitter : Pause suspend la tête où elle est, Quitter
  // referme toute la barre. Stop ramène le tracé au départ (gpx.stop()
  // restaure la ligne entière, voir gpx.js) et coupe le suivi caméra — même
  // paire d'appels que stopFollow passée aux autres panneaux (routePanel,
  // miniRoute) — SANS sortir du mode course : la barre reste posée, prête à
  // relancer une lecture depuis le début.
  onStop: () => { gpxLayer.stop(); disengageGpxFollow(); syncCourseBarMode() },
  getSpeed: () => params.gpxFollowSpeed,
  setSpeed: (v) => { params.gpxFollowSpeed = v },
  getCameraRig: () => (drone.active ? drone : null),
  isPlaying: () => gpxLayer.isPlaying?.() ?? false,
})
// Les chiffres de lecture sont LISSÉS avant d'atteindre le Carnet — une
// valeur qui saute à 60 im/s ne se lit pas (demande Adrien, « moyennée pour
// être lisible »). État de lissage tenu ici (pas dans carnet-course.js, qui
// reste un pur formateur sans notion de temps).
let _carnetLisse = {}
let _carnetHorloge = 0
// le D+ restant ET le D− restant ne remontent pas tant qu'on avance : on
// garde le dernier vu de CHACUN, mais un seul index de référence (`_restIdx`)
// suffit aux deux — les deux planchers dépendent de la MÊME tête de lecture,
// donc du même « est-ce qu'on a reculé ? », pas de deux horloges séparées qui
// pourraient dériver l'une de l'autre. Une tête qui RECULE (relance, saut
// dans le profil) doit pouvoir faire remonter les deux : voir plus bas.
let _dplusVu = null
let _dMoinsVu = null
let _restIdx = -1
params.onHoverIndex = (i) => {
  const lay = gpxLayer.activeLayer
  const track = lay?.gpx?.track
  if (i < 0 || !track?.world || lay?.visible === false || lay?.showRaceInfo === false) {
    courseBar.carnet.update(null)
    _carnetLisse = {}
    _dplusVu = null
    _dMoinsVu = null
    _restIdx = -1
    return
  }
  // ⚠️ LES ALTITUDES DU RELIEF, PAS CELLES DU FICHIER. `p.ele` est null sur
  // tout GPX sans balise <ele> (tracés dessinés à la main, exports d'éditeurs
  // de parcours) : un `p.ele || 0` mettait 0 m partout, donc pente +0,0 %,
  // D+ 0 m et bande toute verte À VIE — pendant que le profil altimétrique,
  // dans la même barre, affichait le vrai relief tiré du DEM. Deux vérités
  // contradictoires côte à côte. _elevations() est CE que dessine le profil.
  // ⚠️ ET IL RESTE UN « 0 » DANS _elevations() — assumé, pas oublié. Sa
  // dernière ligne rend 0 quand il n'y a NI p.ele NI DEM. Ce carnet ne peut
  // pas l'atteindre : `track.world` n'est écrit que par rebuild(), qui sort
  // avant s'il n'y a pas de DEM, et la garde ci-dessus exige `track.world`.
  // Autrement dit, si on est ici, un DEM a drapé la trace. Faire rendre NaN à
  // _elevations() serait plus honnête dans l'absolu, mais ce tableau alimente
  // aussi _trackColors() (Math.min sur NaN → rampe entière NaN), _drawProfile()
  // (eMin/eMax NaN → plus rien de dessiné) et buildFlightCurve() : on ne change
  // pas la valeur de repli de quatre consommateurs pour une fenêtre que le
  // cinquième ne peut pas voir. Ce qui EST corrigé, c'est l'aval : entier() et
  // signe1() (carnet-course.js) rendent un tiret cadratin sur une valeur non
  // finie, au lieu d'écrire « 0 m » avec l'aplomb d'une mesure.
  const eles = lay.gpx._elevations()
  const brut = carnetALaLigne(
    // trkPoints : le tableau BRUT, passé par référence — le carnet n'y lit que
    // l'horodatage de chaque point (durée restante d'après la trace).
    { cumKm: track.cumKm, eles, waypoints: raceState.waypoints, trkPoints: track.points },
    i,
  )
  if (!brut) { courseBar.carnet.update(null); return }
  const maintenant = performance.now() / 1000
  const dt = _carnetHorloge ? maintenant - _carnetHorloge : 0
  _carnetHorloge = maintenant
  // ⚠️ ON NE LISSE QUE LA PENTE, et c'est tout l'inverse d'une économie.
  // Le lissage est une moyenne mobile : il n'a de sens que sur une grandeur
  // CONTINUE et bruitée. La pente l'est (elle tremble d'une image à l'autre).
  // Les autres ne le sont pas, et les lisser produisait des mensonges :
  //   · `dplusProchain` repart de haut à chaque point franchi → l'affichage
  //     RAMPERAIT vers la nouvelle valeur pendant que le nom du point, lui, a
  //     déjà basculé. (Le commentaire d'avant nommait ici un champ `dplus` qui
  //     n'existe dans aucun objet rendu par carnetALaLigne : c'était le nom de
  //     l'ancien D+ accumulé, supprimé depuis. Un commentaire faux coûte plus
  //     cher qu'un bug — celui-là justifiait une décision par un champ mort.)
  //   · `kmAvantSuivant` saute à l'écart suivant → le NOM du point basculait
  //     instantanément pendant que la distance montait depuis 0 : « Refuge,
  //     dans 0,4 km » affiché alors qu'il est à 5 km.
  //   · `km` et `restant` sont un odomètre : lissés, ils retardent sur la
  //     tête de lecture et contredisent l'étiquette dessinée dans le profil.
  // ⚠️ ET ON REND CE QUE lisserChamps REND, sans refusionner sur `brut` : sa
  // sortie part déjà de {...cible}, donc un champ redevenu null (plus de
  // point suivant) le RESTE — un merge ressuscitait la dernière distance.
  _carnetLisse = lisserChamps(_carnetLisse, brut, dt, 0.4, ['pente'])
  // ⚠️ LES DEUX AUTRES NOMBRES VISIBLES QUI TREMBLENT : le D+ RESTANT ET le
  // D− RESTANT. Aucun des deux n'est monotone en `i` — les DEUX sortent du
  // MÊME appel `ascentStats(eles, { debut: idx })` (carnet-course.js,
  // deniveleRestant), et c'est cet appel dont l'hystérésis fait dépendre le
  // résultat du point de DÉPART (race-model.js le dit explicitement) : dplus
  // ET dminus peuvent donc chacun osciller de quelques mètres d'une image à
  // l'autre, sur des chiffres de 17 px qu'on lit en courant. Corriger le D+
  // sans étendre la MÊME protection au D− aurait laissé filer exactement le
  // mensonge que le renommage « Sommet restant » → « D− restant » visait à
  // éliminer (une valeur présentée comme un cumul qui ne redescend jamais,
  // mais qui remonte quand même de temps en temps). Le lissage mentirait
  // aussi (une moyenne mobile LAISSE remonter la valeur) ; on force donc la
  // décroissance sur les deux, qui est la vérité physique : ce qui reste à
  // monter — ou à descendre — ne remonte pas tant qu'on avance. La demande
  // d'Adrien (« la valeur est moyennée pour être lisible ») portait sur ce
  // qu'on VOIT — et la pente, seule lissée jusqu'ici, n'est plus affichée
  // nulle part.
  // Une tête qui RECULE (relance, clic dans le profil) doit pouvoir faire
  // remonter les deux : les deux planchers se réarment dès que l'index
  // n'avance plus (même horloge, `_restIdx`, voir sa déclaration plus haut).
  if (i <= _restIdx) { _dplusVu = null; _dMoinsVu = null }
  _restIdx = i
  _dplusVu = decroissant(_dplusVu, _carnetLisse.dplusRestant)
  _carnetLisse.dplusRestant = _dplusVu
  // dMoinsRestant vaut `null` tant qu'il y a un prochain point (voir
  // deniveleRestant()) : decroissant(x, null) rend `null` (sa première garde,
  // « cible non finie »), ce qui RÉARME le plancher tout seul, sans avoir
  // besoin d'un `if` de plus ici — le jour où la valeur redevient un nombre
  // (plus de prochain point), `_dMoinsVu` est déjà retombé à `null` et
  // repart d'accueil, comme à la première image.
  _dMoinsVu = decroissant(_dMoinsVu, _carnetLisse.dMoinsRestant)
  _carnetLisse.dMoinsRestant = _dMoinsVu
  courseBar.carnet.update(_carnetLisse)
}

// Entrée/sortie du mode course : décidée sur gpxLayer.isPlaying() (pas les
// call sites d'engage/disengage — ceux-ci ne couvrent pas la fin de lecture
// automatique ni le ✕ du profil), et resynchronisée à CHAQUE image tant
// qu'on lit : un parcours en plusieurs étapes change de calque actif EN
// PLEINE LECTURE (onTrackTransition ci-dessus), donc le profil à embarquer
// peut changer sans jamais repasser par « lecture arrêtée puis relancée ».
// ⚠️ LE MODE COURSE N'EST PAS « EN TRAIN DE LIRE ». Première version : le
// mode suivait gpxLayer.isPlaying(), donc METTRE EN PAUSE repliait toute la
// barre, rendait les panneaux, débrayait la caméra — le bouton lecture était
// un second bouton Quitter, et l'arrivée (auto-pause, gpx.js) éjectait le
// coureur au moment précis où il veut lire son bilan. Le mode est donc une
// INTENTION, posée par Lecture et retirée par Quitter (ou par la disparition
// de la trace) ; isPlaying() ne décide plus que de l'icône du bouton.
let _courseDemandee = false
let _enModeCourse = false
let _profilEmbarque = null
// ce qui avait le focus AVANT que le mode course ne fasse disparaître toute
// l'interface (display:none) : sans mémoire, en sortant on rend la main à un
// bouton devenu invisible ou à <body>, et la tabulation repart du début du
// document
let _focusAvantCourse = null
// mémo du dernier titre/résumé posés : setResume fait un innerHTML, le
// rappeler à chaque image le referait soixante fois par seconde
let _cbTitreVu = null
let _cbResumeVu = null
let _cbResumeHorloge = 0
function quitterModeCourse() {
  _courseDemandee = false
  gpxLayer.pause()
  disengageGpxFollow()
  syncCourseBarMode()
}
function syncCourseBarMode() {
  const profileEl = gpxLayer.activeLayer?.gpx?.profileEl
  // ⚠️ L'ENTRÉE SE DÉDUIT DE LA LECTURE, ELLE NE SE POSE PAS À LA MAIN.
  // Première version : `_courseDemandee = true` écrit dans togglePlay(). Mais
  // la lecture se lance aussi depuis le panneau Parcours et la mini-barre
  // (route-panel.js / mini-route.js appellent gpx.play() en direct) — par ces
  // chemins-là, la barre n'apparaissait jamais. Toute lecture qui démarre
  // ENTRE en course, quel que soit le bouton ; seule la sortie est explicite.
  if (gpxLayer.isPlaying?.()) _courseDemandee = true
  // plus de trace = plus de course, quel qu'ait été le souhait
  if (!gpxLayer.activeLayer?.gpx?.track) _courseDemandee = false
  const jouable = _courseDemandee

  if (jouable) {
    // le calque a changé (entrée en mode course, OU étape suivante d'un
    // parcours en plusieurs tronçons) : le profil suit
    if (profileEl !== _profilEmbarque) {
      if (_profilEmbarque) { _profilEmbarque.classList.remove('cb-embedded'); document.body.appendChild(_profilEmbarque) }
      if (profileEl) { profileEl.classList.add('cb-embedded'); courseBar.profileZone.appendChild(profileEl) }
      _profilEmbarque = profileEl || null
    }
    // ⚠️ TITRE ET CHIFFRES NE SONT PAS ACCROCHÉS AU PROFIL. Ils l'étaient
    // (rafraîchis seulement quand profileEl changeait de référence), et
    // raceState.name arrive APRÈS le GPX sur un lien /r/<id> — le payload de
    // course est poussé par bootInitialView, donc après l'entrée en mode
    // course. La barre restait sur le nom de calque, ou sur « Parcours »,
    // jusqu'à un changement d'étape : la demande n°7 d'Adrien servie par un
    // titre faux. On les resynchronise à chaque image, avec une garde
    // d'égalité bon marché — setResume fait un innerHTML.
    const t = gpxLayer.activeLayer?.gpx?.track
    const titre = raceState.name || t?.name || ''
    if (titre !== _cbTitreVu) { _cbTitreVu = titre; courseBar.setTitle(titre) }
    // ⚠️ LES ALTITUDES DU RELIEF, PAS CELLES DU FICHIER — même piège que le
    // carnet, reproduit ici pendant soixante lignes. `t.points.map(p => p.ele
    // || 0)` mettait 0 partout sur un GPX sans balise <ele> : la zone « le
    // parcours » annonçait « D+ 0 m » et « Altitude 0–0 m » COLLÉS au profil
    // altimétrique qui, lui, est dessiné depuis _elevations() (le DEM) et
    // montre un vrai relief. Deux vérités contradictoires côte à côte, à
    // vingt pixels l'une de l'autre.
    // ⚠️ ET PAS À CHAQUE IMAGE — mais plus pour la raison qui était écrite ici.
    // Le commentaire d'avant justifiait la garde par le coût de _elevations()
    // et comptait « déjà appelé une fois par le profil et une fois par le
    // carnet » : il y en avait QUATRE par image de lecture (setHover,
    // _drawProfile appelé depuis setHover, ce carnet, _updateHead), donc le
    // raisonnement était bon et la mesure fausse — et la conclusion « on garde
    // deux appels » ne protégeait rien. _elevations() est désormais mémoïsé sur
    // la couche (gpx.js) : les quatre appels sont gratuits.
    // La garde reste, pour la SEULE raison qui vaut encore : setResume() fait
    // un innerHTML, et ces chiffres sont FIGÉS (ils ne changent qu'à l'arrivée
    // du DEM ou au changement de trace). Deux fois par seconde suffit à les
    // rattraper, et la signature évite l'innerHTML quand rien n'a bougé.
    const now = performance.now()
    if (now - _cbResumeHorloge > 500) {
      _cbResumeHorloge = now
      const eles = gpxLayer.activeLayer?.gpx?._elevations?.()
      const r = t && eles?.length ? resumeParcours(t.cumKm, eles) : null
      const cle = r ? `${r.km}|${r.dplus}|${r.dminus}|${r.altMin}|${r.altMax}` : ''
      if (cle !== _cbResumeVu) {
        _cbResumeVu = cle
        courseBar.setResume(r)
      }
    }
    if (!_enModeCourse) {
      _enModeCourse = true
      _focusAvantCourse = document.activeElement
      document.body.classList.add('ce-course-mode')
      courseBar.show()
    }
    courseBar.tick()
  } else if (_enModeCourse) {
    _enModeCourse = false
    courseBar.hide()
    document.body.classList.remove('ce-course-mode')
    if (_profilEmbarque) { _profilEmbarque.classList.remove('cb-embedded'); document.body.appendChild(_profilEmbarque); _profilEmbarque = null }
    _cbTitreVu = null
    _cbResumeVu = null
    _cbResumeHorloge = 0
    // rendre le focus là où on l'avait pris — la barre vient d'être rendue
    // inerte, l'utilisateur clavier tabulerait sinon dans le vide
    if (_focusAvantCourse?.isConnected) _focusAvantCourse.focus?.({ preventScroll: true })
    else document.body.focus?.()
    _focusAvantCourse = null
  }
}
// Échap quitte le mode course — le reste de l'application en a l'habitude
// (réglages, panneaux). Actif UNIQUEMENT en mode course : sans cette garde on
// volerait la touche à tous les autres écrans.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !_enModeCourse) return
  e.preventDefault()
  quitterModeCourse()
})
// ⚠️ DEUX VOIES D'APPEL, ET C'EST VOULU. Les COMMANDES (bouton lecture,
// Quitter) appellent syncCourseBarMode() directement pour une réponse
// immédiate : une boucle de rendu ralentie (onglet en arrière-plan,
// gouverneur de perf, machine chargée) ferait sinon apparaître la barre
// avec un retard visible sur un simple clic. tick() la rappelle par image
// pour tout ce qui change SANS clic — fin de lecture automatique, passage
// à l'étape suivante d'un parcours en plusieurs tronçons.

// grave l'identité de la course sur les flancs du bloc (logo centré + infos
// haut-droite, disposition « Hawaii ») — appelé à chaque mutation du studio
// pousse une course (brouillon studio OU payload d'un lien partagé) dans
// raceState : km → index de trace, altitudes résolues, cartouches + flancs
// du bloc rafraîchis. Partagé entre deps.syncRace (studio) et bootInitialView
// (lien /r/ — sans quoi une shibu reçue n'a AUCUN cartouche).
function syncRaceState(race) {
  const t = gpxLayer.activeLayer?.gpx?.track
  raceState.name = race.name
  raceState.logo = race.logo
  // ⚠️ TRIÉS PAR KM, ICI ET UNE SEULE FOIS. Le studio pousse les points de
  // passage dans l'ordre de SAISIE (studio.js : `waypoints.push`), et ni lui
  // ni parseRace() ne trient. Un organisateur qui saisit « km 20 » puis
  // « km 5 » cassait tout ce qui lit cette liste en la supposant ordonnée :
  // point actuel faux, point suivant faux, distance restante négative.
  raceState.waypoints = (race.waypoints || []).map((w) => {
    const idx = t ? snapToKm(t.cumKm, w.km) : null
    const ele = t?.points?.[idx]?.ele
    return { ...w, idx, alt: w.alt ?? (Number.isFinite(ele) ? Math.round(ele) : null) }
  }).sort((a, b) => (a.km ?? 0) - (b.km ?? 0))
  raceState.transports.removed = [...(race.transports?.removed || [])]
  // traits verticaux des points de passage sur le profil (gpx.js)
  const g = gpxLayer.activeLayer?.gpx
  if (g) { g.raceTicks = raceState.waypoints.map((w) => ({ km: w.km })); g._drawProfile?.() }
  raceLabels.setDirty()
  applyRaceToBlock()
}

// Une trace neuve arrive : elle prend SES points de passage (les <wpt> du GPX,
// les lignes d'un projet), et à défaut aucun. Voir le gros commentaire au point
// d'appel dans loadGpxText() — c'est le seul endroit où ça se joue.
// Les POI transports partent aussi : leurs positions MONDE ont été calculées
// contre le bloc précédent, elles ne veulent plus rien dire ici. Le studio les
// re-cherche (setTransportCats) à l'étape ④.
// Posé plus bas, une fois `studio` construit — même raison et même forme que
// enterRouteSpace : loadGpxText est déclaré bien avant lui.
let adoptRaceDraft = null

function adoptRaceWaypoints(text, track) {
  raceState.transports.pois = []
  const race = {
    name: '',
    logo: null,
    waypoints: resolveWaypointKm(incomingWaypoints(text) || [], track),
    transports: { cats: [], removed: [] },
  }
  // On passe par le BROUILLON du studio, pas par raceState seul : c'est lui qui
  // fait foi dès que le studio s'ouvre, et lui seul écrit dans les deux. Sinon
  // entrer dans le studio repousse l'ancien brouillon par-dessus les repères que
  // le fichier vient d'apporter — mesuré, c'est ce qui arrivait.
  if (adoptRaceDraft) adoptRaceDraft(race)
  else syncRaceState(race)
}

function applyRaceToBlock() {
  if (!raceState.name && !raceState.logo) { groundInfo.setRace(null); return }
  const track = gpxLayer.activeLayer?.gpx?.track
  const stats = track ? ascentStats(track.points.map((p) => p.ele || 0)) : {}
  const wps = raceState.waypoints
  groundInfo.setRace({
    logo: raceState.logo,
    name: raceState.name,
    dplus: stats.dplus,
    dminus: stats.dminus,
    start: wps[0]?.name || '',
    finish: wps[wps.length - 1]?.name || '',
  })
}

// active les catégories de transport (studio étape ③) : fetch Overpass sur le
// bloc courant, résout les positions monde, alimente les chips des cartouches
async function setTransportCats(cats) {
  raceState.transports.cats = [...cats]
  if (!cats.length || !dem) { raceState.transports.pois = []; raceLabels.setDirty(); return }
  const h = TERRAIN_SIZE / 2
  const bounds = {
    n: worldToLatLon(dem, 0, -h).lat,
    s: worldToLatLon(dem, 0, h).lat,
    w: worldToLatLon(dem, -h, 0).lon,
    e: worldToLatLon(dem, h, 0).lon,
  }
  try {
    const pois = await fetchTransports(bounds, cats)
    // zone utile (Adrien) : un transport n'est gardé qu'à moins de 2 km d'un
    // POINT DE PASSAGE (c'est là que les coureurs/accompagnants en ont
    // besoin) — aéroports à 15 km. Sans points de passage, repli sur la
    // proximité de la trace (2,5 km).
    const track = gpxLayer.activeLayer?.gpx?.track
    const wpPts = raceState.waypoints
      .map((w) => (w.idx != null ? track?.points?.[w.idx] : null))
      .filter(Boolean)
    const nearKm = (p, pts, maxKm, step = 1) => {
      const cosLat = Math.cos((p.lat * Math.PI) / 180)
      for (let i = 0; i < pts.length; i += step) {
        const t = pts[i]
        const dx = (p.lon - t.lon) * 111.32 * cosLat
        const dy = (p.lat - t.lat) * 110.57
        if (dx * dx + dy * dy < maxKm * maxKm) return true
      }
      return false
    }
    const nearTrack = (p) => {
      const maxKm = p.cat === 'aeroport' ? 15 : 2
      if (wpPts.length) return nearKm(p, wpPts, maxKm)
      if (!track?.points?.length) return true
      return nearKm(p, track.points, p.cat === 'aeroport' ? 15 : 2.5, Math.max(1, Math.floor(track.points.length / 400)))
    }
    raceState.transports.pois = pois
      .filter((p) => cats.includes(p.cat) && nearTrack(p))
      .map((p) => {
        const w = latLonToWorld(dem, p.lat, p.lon)
        // ⚠️ `w` est en coordonnées de CHAMP, `terrain.sample` répond en
        // coordonnées de GÉOMÉTRIE : sans la soustraction, la gare ou le
        // téléphérique prenait l'altitude d'un point situé une fenêtre plus
        // loin — le cartouche flottait en l'air ou s'enterrait. Le XZ, lui, est
        // bien du champ : c'est race-labels.js qui en retranche le décalage.
        const fenT = terrain.fenetre ?? { x: 0, z: 0 }
        const world = new THREE.Vector3(w.x, (terrain.sample?.(w.x - fenT.x, w.z - fenT.z) ?? 0) + 0.4, w.z)
        return { ...p, world }
      })
  } catch (err) {
    console.warn('transports overpass:', err.message)
    raceState.transports.pois = []
  }
  raceLabels.setDirty()
}

const allGpxPoints = () => gpxLayer.layers.flatMap((l) => l.gpx.track?.points ?? [])
// un voisin vient de finir de charger → re-draper les traces + peindre sa photo
// aérienne si la couche est active (même finition que le bloc central)
// Une dalle arrive TOUJOURS en retard (son DEM se télécharge) : au moment où
// applyRegionMode a peint le damier, elle n'existait pas. Elle réclame donc sa
// part du masque en naissant, sinon elle s'afficherait en carré plein à côté
// d'une découpe.
//
// ⚠️ LA JUPE, ELLE, ATTEND. Le plancher de la zone est COMMUN à toutes les
// dalles : une nouvelle venue oblige à retracer tout le damier. Le faire à
// chaque arrivée coûte le carré du nombre de dalles — sur un damier plein
// (24 voisines), 300 marching-squares de 300×300, mesuré comme l'étranglement
// du chargement. On coalesce donc les arrivées en un seul retracé.
blockGrid.onReady = (cell) => {
  gpxLayer.rebuildAll()
  paintCellAerial(cell)
  // … et sa MOSAÏQUE de lumières nocturnes, si la couche est allumée. Les trois
  // scalaires de la couche, eux, lui ont déjà été posés par `_applyLook` à sa
  // naissance (block-grid.js) : une dalle arrivée après le crépuscule ne doit
  // pas rester en plein jour au milieu d'un damier éteint.
  peintCelluleNuit(cell)
  // … et ses deux mosaïques de couches de sol, au même titre et pour la même
  // raison : occupation du sol (ESA WorldCover) et hauteur de canopée (ETH).
  // Les deux OPACITÉS, elles, lui ont déjà été posées par `_applyLook`.
  peintCelluleSol(cell)
  peintCelluleCanopee(cell)
  if (params.regionMode && blockGrid.regionParts) {
    paintCellRegion(cell)
    rebuildRegionSkirtSoon()
  }
}
// son trait de côte arrive plus tard encore : on refait SA découpe (et elle
// seule) pour lui rendre ses polders, comme le bloc central le fait déjà
blockGrid.onCoastReady = (cell) => {
  if (!params.regionMode || !blockGrid.regionParts) return
  paintCellRegion(cell)
}
// le damier a gagné/perdu une dalle → le trafic aérien étend sa zone de vol
// pour qu'un avion passe d'une dalle à la suivante sans coupure
// ⚠️ EN MODE CONTINU C'EST L'EMPRISE QUI COMMANDE, PAS LE DAMIER. Le damier n'a
// aucune cellule (le 3×3 est un seul champ), donc `spanRadius()` rendrait 0 et
// l'aéronef mourrait au bord du bloc central — juste au moment où le relief
// derrière lui, lui, continue. L'emprise fait 84 unités de demi-côté.
// Déclaration de fonction (et non `const`) : elle est appelée depuis
// `regenerateTerrain`, plus haut dans le fichier — une flèche en `const` y
// serait dans sa zone morte si un chargement partait pendant l'évaluation.
function trafficSpan() {
  return dem?.empriseCote > 1 ? (TERRAIN_SIZE * dem.empriseCote) / 2 : blockGrid.spanRadius()
}
// ═══════ LE SOCLE DU HÉROS SUIT LE DAMIER, LUI AUSSI ════════════════════════
//
// Le damier retire le congé et le chanfrein des arêtes qui touchent une autre
// case (block-grid.js, damier-bords.js) — mais le bloc CENTRAL ne passe pas par
// là : son socle est bâti par plinth.rebuild(). Sans ce recalage il gardait ses
// quatre arrondis AU MILIEU du damier, et chaque jointure avec une voisine
// creusait sa rainure : le défaut que montre la première capture d'Adrien.
//
// ⚠️ ON NE RE-COULE QUE SI LES BORDS ONT VRAIMENT CHANGÉ. onGridChanged part à
// CHAQUE arrivée de dalle (jusqu'à 24 sur un damier plein) et plinth.rebuild
// coûte ~2,2 ms au maillage du héros (voir fenetre-elan.js) : rebâtir à chaque
// fois paierait 24 fois un travail utile 4 fois au plus.
// état de départ : bloc isolé, les quatre côtés au vide — c'est déjà ce que le
// socle porte au démarrage, donc rien à re-couler tant que le damier est vide
let bordsHeroPoses = '1111'
function majBordsHero() {
  const b = blockGrid.bordsHero()
  const cle = `${+b.nord}${+b.est}${+b.sud}${+b.ouest}`
  if (cle === bordsHeroPoses) return
  bordsHeroPoses = cle
  // 1111 = quatre côtés au vide : on rend null, donc la géométrie d'origine
  plinth.bordsHero = cle === '1111' ? null : b
  plinth.rebuild(terrain, params, socleEmprise())
  // ⚠️ ET LA SURFACE DE CARTE, QUI EST UN SECOND ARRONDI. Le socle ci-dessus est
  // de la géométrie ; le carré arrondi de la carte est découpé dans le fragment
  // shader (terrain.js). Ne traiter que le premier laissait le relief du héros
  // s'arrêter court près des jointures : une rainure sombre entre deux dalles,
  // et un trou en étoile là où quatre se rejoignent. Même règle, même source
  // (damier-bords.js), un seul appel — les voisines, elles, passent par
  // blockGrid.majCoinsSurface().
  terrain.setBordsDamier(cle === '1111' ? null : b)
}
blockGrid.onGridChanged = () => {
  traffic.setSpan(trafficSpan())
  majBordsHero()
  // ⚠️ TROISIÈME MOTIF DE RECONSTRUCTION DANS CETTE MÊME BOUCLE, et il faut le
  // dire : `majBordsHero` (Tâche 5) re-coule déjà le socle du héros quand ses
  // arêtes changent, et `egaliseHauteurs` re-coule les murs des cases sur DEUX
  // motifs (plancher + bords, N + E = 60 sur un 5×5). `merSuitLeDamier` ajoute
  // le sien. Les trois sont gardés — chacun sort tout de suite quand rien n'a
  // changé — mais leurs pires cas se CUMULENT sur une même arrivée de dalle, et
  // c'est ce cumul, pas un garde manquant, que la Tâche 12 doit mesurer.
  merSuitLeDamier()
  cartoucheSuitLeDamier()
  // LE CADRAGE SUIT LE DAMIER QUI GRANDIT. On clique sur le bouton dès qu'on
  // voit plusieurs cases — c'est-à-dire presque toujours AVANT la fin du
  // chargement. Sans ce rappel, le cadrage resterait celui du 2×2 d'alors et le
  // 3×3 arrivé ensuite déborderait de l'écran. Gardé par la clé du carré : les
  // vingt dalles qui arrivent sans changer la FORME ne rejouent aucun vol.
  if (cadrageDamier) {
    // …et il se referme tout seul si le damier retombe à une seule case (une
    // recherche ailleurs, un tracé fermé) : plus rien à cadrer, la caméra doit
    // rendre sa butée avant que l'escalier de zoom ne la relise.
    if (modeBoutonCamera() !== 'ensemble') quitteCadrageDamier()
    else if (cleDuCarre(carrePourCamera()) !== cleCadrageDamier) cadreLeDamier()
  }
}
// le damier se resynchronise à CHAQUE re-drapage global (zone, zoom, ajout de
// calque) — idempotent, borné 5×5, cellules en cache LRU
const _rebuildAllRaw = gpxLayer.rebuildAll.bind(gpxLayer)
gpxLayer.rebuildAll = () => {
  blockGrid.sync(allGpxPoints())
  _rebuildAllRaw()
}
// ✕ du profil (le parcours se ferme) → les blocs devenus inutiles s'en vont
gpxLayer.onTrackCleared = () => blockGrid.sync(allGpxPoints())

// every layer gets its own bottom-centre profile strip (only the focused
// one is ever visible at once — see GpxLayerManager._syncProfileVisibility)
// — wire each newly-added one draggable exactly once.
const _draggedProfiles = new WeakSet()
gpxLayer.onChange = (layers) => {
  for (const l of layers) {
    if (_draggedProfiles.has(l.gpx.profileEl)) continue
    _draggedProfiles.add(l.gpx.profileEl)
    makeDraggable(l.gpx.profileEl, l.gpx.profileEl.querySelector('.gpx-profile-head'))
  }
}

// ---- « ce contenu porte un parcours » → l'espace qui va bien --------------
// LE point de bascule, un seul pour toutes les portes d'entrée (import GPX du
// cartouche du bas, glisser-déposer, projet .shibumap-race, gabarit, démo).
// Six appels dispersés auraient divergé ; la règle elle-même est PURE et vit
// dans route-entry.js — elle lit le CONTENU, jamais l'extension du fichier ni
// le bouton cliqué. Posé plus bas (une fois `studio` et `hub` construits) :
// loadGpxText est défini bien avant eux, un `let` évite la zone morte.
let enterRouteSpace = () => {}

async function loadGpxText(text) {
  // mode GPX : les noms de sommets sont coupés par défaut (Adrien) — la
  // course est le sujet, pas la toponymie ; réactivables dans le panneau
  if (params.peaksEnabled) { params.peaksEnabled = false; peaksLayer.setEnabled(false) }
  try {
    const entry = gpxLayer.addLayer(text)
    if (!entry) {
      modes.announce('LAYER LIMIT — 10 GPX TRACKS MAX')
      return
    }
    const track = entry.gpx.track
    // LE point de remise à zéro des points de passage — un seul, ici, sur
    // l'entonnoir que traversent toutes les portes d'entrée (import, glisser-
    // déposer, projet .shibumap-race, démo, lien #r=). Les nettoyer porte par
    // porte garantissait d'en oublier une : les repères de la course
    // précédente restaient accrochés à la trace suivante, et ça ne se voyait
    // qu'au DEUXIÈME chargement. Un gabarit, lui, ne passe jamais par ici : il
    // ne porte pas de trace, donc changer de palette n'efface rien.
    // Le nom et le logo partent avec : ils habillent les mêmes cartouches
    // (départ/arrivée) et les flancs du bloc. Les porteurs d'une VRAIE course
    // (studio, payload d'un lien) rappellent syncRaceState juste après, avec
    // la leur — voir importRace() et bootInitialView().
    adoptRaceWaypoints(text, track)
    const f = frameTrack(track.points)
    params.demLat = f.lat
    params.demLon = f.lon
    params.demZoom = f.zoom
    params.demLocation = 'Custom'
    refreshAll()
    modes.announce(`TRACK LOADED — ${track.name.toUpperCase().slice(0, 24)}`)
    // the post-rebuild hook drapes the line once the new terrain exists;
    // pin the framed zoom or the dive would land on the fine (≥12) scale
    // and clip long tracks framed at z10/z11
    // ⚠️ LE MÊME GESTE VAUT POUR UN GPX, ET IL VAUT MÊME PLUS. `frameTrack`
    // choisit un zoom pour que la trace tienne dans UN bloc avec 35 % de marge
    // — c'est-à-dire tout juste. Un décalage d'un sixième de socle (le calage
    // sur la grille de tuiles, voir `f3CentreSur`) mange donc la moitié de
    // cette marge et peut sortir un bout de trace du socle affiché. Le centre
    // de la boîte englobante est exactement ce que `frameTrack` a calculé.
    //
    // La branche orbitale l'obtient gratuitement : `flyTo` finit par
    // `loadSurface(lat, lon, zoom)`, qui centre déjà.
    //
    // ⚠️ `modes.flyTo` DEPUIS LA SURFACE REPASSE PAR L'ORBITE (modes.js), donc
    // par le même `_surfCam` que le bouton globe : on rend d'abord ce que le
    // cadrage du damier avait emprunté, sinon le retour de plongée reposerait
    // un plan de coupe à ≈ 122 unités sur une caméra qui n'est plus qu'à 145.
    quitteCadrageDamier()
    if (modes.mode === 'orbital') await modes.flyTo(f.lat, f.lon, f.zoom)
    else await loadRealTerrain({ centreSur: { lat: f.lat, lon: f.lon } })
    // au chargement d'un GPX, on démarre en vue isométrique (Adrien) — comme un
    // clic sur le bouton iso ; la vue est cadrée sur le bloc + son socle
    applyIsoView(0)
    // …et on arrive dans l'espace du parcours. À la FIN, pas au début : le Race
    // Studio photographie la carte en entrant et lit la trace pour ses récaps
    // (km, D+/D−) — ouvert trop tôt, il s'ouvrirait sur du vide.
    // On passe la trace ANALYSÉE, pas le texte : c'est elle qui fait foi, et un
    // fichier de deux repères sans tracé n'aurait rien fait basculer.
    enterRouteSpace(track)
  } catch (err) {
    modes.announce(`GPX ERROR — ${String(err.message).toUpperCase()}`)
  }
}

// the altimeter chip stays repositionable (GPX profile strips are wired
// draggable per-layer as they're added — see gpxLayer.onChange above)
makeDraggable(modes.altEl)

// drag & drop a .gpx anywhere on the page
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  e.preventDefault()
  const f = [...(e.dataTransfer?.files || [])].find((f) => /\.(gpx|json)$/i.test(f.name))
  if (f) openTrackFile(f)
})

const gpxFileInput = document.createElement('input')
gpxFileInput.type = 'file'
// accepte aussi les projets .shibumap-race.json exportés par le Race Studio
// (Adrien : « Load GPX doit accepter les json qu'on exporte depuis shibumap »)
gpxFileInput.accept = '.gpx,.json,application/json'
gpxFileInput.style.display = 'none'
document.body.appendChild(gpxFileInput)
async function openTrackFile(f) {
  const text = await f.text()
  if (/\.json$/i.test(f.name) || text.trimStart().startsWith('{')) {
    const bundle = parseRace(text)
    if (bundle) { studio.importProject(bundle); return }
    alert(`« ${f.name} » n'est ni un GPX ni un projet ShibuMap.`)
    return
  }
  loadGpxText(text)
}
gpxFileInput.addEventListener('change', () => {
  const f = gpxFileInput.files?.[0]
  if (f) openTrackFile(f)
  gpxFileInput.value = ''
})

// la course de DÉMO (La Grande Traversée) — même bundle et même chemin
// d'import que la porte démo du Race Studio (étape Trace) : une seule
// mécanique, deux portes. `studio` est déclaré plus bas mais lu au CLIC.
async function loadDemoRace() {
  const bundle = parseRace(await (await fetch('/demo/grande-traversee.shibumap-race.json')).text())
  if (bundle) await studio.importProject(bundle)
}

// hand the flight to the existing tour controller
// cinematic drone follow-cam for the GPX track (terrain-aware chase camera)
const drone = new DroneCam({ camera, controls, sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0 })
// looping cinematic camera moves (orbit / fly-over / crane…) for the Camera panel
const cameraAuto = new CameraAutomation({ camera, controls })
// PLANS DE CAMÉRA du bouton cinéma (voir camera-shots.js). À ne pas confondre
// avec cameraAuto ci-dessus, qui reste au service du panneau Caméra : celui-là
// fait osciller la caméra autour d'un point, celui-ci COMPOSE UN PLAN sur le
// relief réel (couloir de vallée, sommet comme sujet, accélération, fin tenable).
const shots = new CameraShotPlayer({
  camera,
  controls,
  sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0,
  half: TERRAIN_SIZE / 2,
  baseFov: params.fov,
  onState: () => {
    cineBtn?.setActive(shots.active)
    cineBtn?.setBadge(shots.badge)
  },
})

// LA CAMÉRA PILOTE. Elle partage l'échantillonneur de relief des autres
// automatismes ; tout le reste lui est propre.
const pilote = new PiloteCam({
  camera,
  controls,
  sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0,
  half: TERRAIN_SIZE / 2,
  // Le cran 3 (poursuite de la tête de course) n'existe que s'il y a une course :
  // c'est ce getter qui le fait apparaître et disparaître tout seul.
  getTrace: () => gpxLayer?.track?.world ?? null,
  // L'échelle du bloc : la poursuite en a besoin pour convertir les km/h de
  // l'allure et les 50-150 m de hauteur du métier en unités monde. Sans elle,
  // l'hélicoptère volerait à 120 unités du sol au lieu de 120 mètres.
  getEchelle: () => ({
    metresParUnite: dem ? dem.extentMeters / TERRAIN_SIZE : 1,
    exagerationV: lireExageration(params) || 1,
  }),
  // Le tronçon couvert — 'reine' par défaut, `?troncon=tout` pour tout voir.
  // Le pourquoi (202 °/s de balayage sur 47 km comprimés) est dans flags.js.
  getPortion: () => portionPoursuite(),
  // ⚠️ `onState` N'A PLUS D'ABONNÉ, ET LE RAPPEL EST GARDÉ QUAND MÊME. Il
  // servait au bouton de la caméra pilote (accent « en vol » + badge du cran),
  // retiré le 2026-08-02. Le laisser vide plutôt que le supprimer garde le
  // contrat de PiloteCam intact : le jour où le bouton revient — ou qu'un autre
  // témoin d'état arrive — il n'y a qu'ici à brancher, et pilote-cam.js n'a pas
  // à changer. Voir le mode d'emploi du réveil en tête de src/ui/bars.js.
  onState: () => {},
})

function flyTrack() {
  const w = gpxLayer.track?.world
  if (!w || w.length < 2 || modes.mode !== 'surface') return
  const km = gpxLayer.track.cumKm[gpxLayer.track.cumKm.length - 1]
  const duration = THREE.MathUtils.clamp(km * 2.2, 14, 95)
  tour.active = false
  tween.active = false
  cameraAuto.stop()
  // ⚠️ ET LE CADRAGE DU DAMIER REND SON EMPRUNT — le survol vole au ras du sol,
  // le `near` desserré (≈ 122 sur un 3×3) découperait tout le décor devant la
  // caméra pendant tout le vol. Voir `quitteCadrageDamier`.
  quitteCadrageDamier()
  // ESSAI 2026-08-01 — même bascule que le suivi juste dessous : le survol du
  // tracé passe à la poursuite hélicoptère. L'ancien reste sous le `if`.
  if (suiviHelicoActif() && pilote.lancerPoursuite()) return
  drone.start(w, { duration })
}

// ---- GPX drone-follow (Route panel "Follow" toggle) ------------------------
// Engaged explicitly (Play pressed while Follow is on, or Follow flipped on
// mid-playback) and disengaged explicitly (pause/stop, Esc, the Route
// panel's exit-follow (✕) button, or the user grabbing the camera for every
// OTHER automation — see the controls 'start' handler above). Task 30: a
// drag/zoom DURING GPX follow no longer disengages it — the 'start' handler
// leaves drone.active/params.gpxFollow untouched in that one case, and
// updateCameraMotion()'s controlsHeld branch suspends the drone's per-frame
// aiming (without stopping it) for as long as the user holds the controls,
// resuming smoothly on release. It never re-engages itself on its own, so
// grabbing OrbitControls for anything else can't be "fought" by a follow
// that keeps trying to resume — same rule tour/cameraAuto follow.
// The per-frame drive itself (drone.updateAt, fed gpxLayer.headT) lives in
// updateCameraMotion() below, reusing DroneCam wholesale — no new camera rig.
function engageGpxFollow() {
  // ⚠️ RÉARMEMENT AVANT LA GARDE, ET C'EST DÉLIBÉRÉ — voir task-2 report pour
  // la mesure qui a établi la cause. Les trois verrous nommés dans le brief
  // (gpxFollow / isPlaying / mode) ne sont PAS individuellement en tort :
  // isPlaying() redevient bien true et mode reste 'surface' après un clic
  // Lecture. C'est params.gpxFollow qui reste bloqué à false pour le reste de
  // la session — le FINALE de fin de parcours (plus bas dans tick(), recul
  // isométrique) l'éteint délibérément et rien ne le rallumait derrière — MAIS
  // (CONSTAT 1 de relecture) une coupure EXPLICITE (« ✕ Quitter le suivi »,
  // case à cocher) ne doit JAMAIS être défaite par une relance : d'où
  // `gpxFollowCoupeParFinale`, vrai seulement si c'est le FINALE — et lui
  // seul — qui a fait passer gpxFollow à false (posé/effacé à chaque site qui
  // écrit params.gpxFollow, voir leurs commentaires respectifs).
  // gpxLayer.consommerRelanceDepuisLeDebut() (posé par GpxLayerManager.play(),
  // appelé par TOUS les boutons Lecture — barre de course, panneau Parcours,
  // mini-barre — avant d'atterrir ici ; CONSOMMÉ, pas relu, voir CONSTAT 2 /
  // creerDrapeauConsommable dans gpx-layers.js) dit si CETTE lecture repart du
  // tout début. Doit tourner AVANT peutEngagerLeSuivi, sinon la garde
  // sortirait sur l'ancien gpxFollow=false avant qu'on ait pu le relever.
  if (doitReamorcerSuivi({
    relanceDepuisLeDebut: gpxLayer.consommerRelanceDepuisLeDebut(),
    gpxFollow: params.gpxFollow,
    coupeParFinale: params.gpxFollowCoupeParFinale,
  })) {
    params.gpxFollow = true
    params.gpxFollowCoupeParFinale = false // consommé : la raison ne vaut plus une fois réarmée
  }
  // Garde extraite dans suivi-course.js (testable).
  if (!peutEngagerLeSuivi({ suiviDemande: params.gpxFollow, enLecture: gpxLayer.isPlaying(), mode: modes.mode })) return
  followManual = false // nouveau Play → le rail reprend (jusqu'au 1er geste)
  followZoomVel = 0
  const w = gpxLayer.track?.world
  if (!w || w.length < 2) return
  tour.active = false
  tween.active = false
  cameraAuto.stop()
  // ⚠️ ET LE CADRAGE DU DAMIER REND SON EMPRUNT — même raison que `flyTrack`
  // juste au-dessus : le suivi de tête colle au sol.
  quitteCadrageDamier()
  // ⚠️ ESSAI DU 2026-08-01 — LE SUIVI LANCE LA POURSUITE HÉLICOPTÈRE.
  // Adrien : « lance la vue d'hélico, remplace celle actuelle de suivi tout en
  // la laissant de côté ». L'ancien rail DroneCam est intact, juste en dessous :
  // il reprend seul si la poursuite refuse (tracé trop court, aucun couloir).
  // RETOUR EN ARRIÈRE EN UNE LIGNE : `suiviHelico: false` dans src/flags.js.
  if (suiviHelicoActif() && pilote.lancerPoursuite()) return
  if (drone.start(w, { seedAt: gpxLayer.headT })) showFollowPad(drone) // resume-in-place, not a snap back to the start
}
function disengageGpxFollow() {
  hideFollowPad()
  if (drone.active) drone.stop()
  // la poursuite s'arrête avec le suivi, et la tête de course revient à
  // l'horloge de lecture (ou la ligne entière se restaure — voir releaseHead)
  if (pilote.poursuite) pilote.cancel()
  teteCommandee = false
  gpxLayer.releaseHead?.()
}
// Sequenced-playback handover (task 22 §5) — GpxLayerManager.tick() auto-
// advances focus + play() to the next layer on its own, so this is the ONLY
// call site for a mid-sequence leg change (fresh plays still go through
// engageGpxFollow() above, from the Play button). If follow is engaged,
// retarget() (not start()) keeps the SAME flight running onto the new
// track's world spine — the whole point being that a leg change reads as
// one continuous shot, never a cut (see drone-cam.js's own retarget() note).
gpxLayer.onTrackTransition = (fromLayer, toLayer, idx) => {
  if (!params.gpxFollow || !drone.active) return
  const w = toLayer?.gpx?.track?.world
  if (w && w.length >= 2) drone.retarget(w)
}

// ---- Space/Esc playback (keyboard shortcuts) -----------------------------
// Bridges to whatever playback mechanism is live: a loaded GPX track's
// progressive-reveal (Parcours) playback takes priority — Space play/pauses
// the head travelling along the route, Esc stops and restores the full
// line. With no track loaded, Space falls back to the Camera panel's
// looping automation (the drone fly-along is still reachable from the
// Camera panel's "Fly the GPX track" button, just no longer tied to Space).
function togglePlay() {
  if (!modes || modes.mode !== 'surface' || modes.busy) return
  if (gpxLayer?.track) {
    if (gpxLayer.isPlaying()) {
      gpxLayer.pause()
      disengageGpxFollow()
    } else {
      // Le réarmement du suivi (si la relance repart du tout début, voir
      // engageGpxFollow) se joue APRÈS gpxLayer.play() : c'est ce play()-là
      // qui pose gpxLayer.lastPlayRestarted, lu juste en dessous.
      gpxLayer.play()
      engageGpxFollow()
      _courseDemandee = true // lancer une lecture, c'est entrer en course
    }
    syncCourseBarMode() // réponse immédiate au clic — voir la note sur les deux voies
    return
  }
  if (cameraAuto.active) cameraAuto.stop()
  else {
    tour.active = false
    drone.stop()
    quitteCadrageDamier() // une automation prend la caméra : elle ne joue pas avec les plans de coupe du cadrage
    cameraAuto.start(params.camMove, params.camSpeed)
  }
}
function stopPlay() {
  tour.active = false
  tween.active = false
  drone.stop()
  cameraAuto.stop()
  gpxLayer?.stop()
  camera.up.set(0, 1, 0)
  // Stop (bouton du panneau, Échap) ≠ Pause : on QUITTE la course, on ne la
  // suspend pas. Sans ça la barre resterait posée sur une lecture remise à
  // zéro, et le panneau Parcours — d'où vient le bouton — resterait masqué.
  _courseDemandee = false
  syncCourseBarMode()
}

// ---- Clic-pour-reprendre (task 9) : profil GPX ET ruban 3D partagent CE
// point d'entrée UNIQUE — gpx.js (clic profil, params.onSeekRequest) et le
// pointerup ci-dessus (clic ruban) se contentent de trouver `f`, une
// fraction de DISTANCE (jamais un rang de sommet — voir indexALAbscisse en
// tête de gpx.js). Ce qui suit REJOUE le bouton Lecture (gpxLayer.play() +
// engageGpxFollow(), mêmes gardes que togglePlay() ci-dessus), positionné
// plutôt que reparti de zéro.
//
// ⚠️ L'ORDRE COMPTE — position AVANT play(). gpx.js play()/GpxLayerManager
// play() ne remettent headT à 0 QUE s'il valait déjà 1 (fin de parcours) :
// en posant `f` d'abord (toujours < 1 pour un clic réel), on empêche play()
// d'écraser l'endroit choisi. Poser `f` APRÈS aurait le même effet visuel
// dans le cas courant, mais réintroduirait le cas où le clic tombe pile en
// fin de tracé — play() verrait alors encore l'ancien headT >= 1 et
// repartirait du début au lieu de rester où l'utilisateur a cliqué.
//
// ⚠️ NE RÉIMPOSE PAS LE SUIVI CAMÉRA SUR UN REFUS EXPLICITE. engageGpxFollow
// relit params.gpxFollow tel quel : si l'utilisateur a cliqué « ✕ Quitter le
// suivi », gpxFollow vaut false et peutEngagerLeSuivi (suivi-course.js) ne
// laisse rien passer — la lecture reprend seule, sans caméra imposée.
function seekAndResumeCourse(f) {
  if (!modes || modes.mode !== 'surface' || modes.busy) return
  if (!gpxLayer?.track) return
  gpxLayer.setHeadAt(f)
  gpxLayer.play()
  engageGpxFollow()
  // ⚠️ PAS `_courseDemandee = true` À LA MAIN ICI — voir le commentaire de
  // syncCourseBarMode() : l'entrée en mode course SE DÉDUIT de la lecture
  // (gpxLayer.isPlaying()), elle ne se pose plus à la main depuis la
  // régression qu'un `_courseDemandee` écrit à la main avait causée ailleurs.
  syncCourseBarMode()
}
params.onSeekRequest = (f) => seekAndResumeCourse(f)

// ------------------------------------------------------------------ GUI

// ⚠️ DAMIER : CONTRAINTE ASSUMÉE — le balayage s'arrête au bord du bloc central.
// `ScanController` reçoit les uniformes du SEUL bloc central et son rayon est
// `TERRAIN_SIZE / 2` : l'effet est CALIBRÉ SUR UN BLOC. L'étendre au damier
// n'est pas un essaimage de plus, c'est un changement de géométrie de l'effet
// (rayon, origine, durée) — donc un travail, pas une ligne. En attendant, le
// radar s'arrête net à la jointure, et c'est voulu.
// ⚠️ ET C'EST UNE POIGNÉE CÉDÉE : ce module écrit dans `terrain.mapUniforms`
// quand il veut, hors de tout péage. test/damier-uniformes.test.js le sait (il
// est nommé dans `POIGNEES_CEDEES`) et refusera la PROCHAINE cession non
// déclarée — c'est le seul garde-fou possible ici.
scan = new ScanController(terrain.mapUniforms, TERRAIN_SIZE / 2)

const waterRebuild = () => {
  realWater?.rebuild(optionsDeMer())
  // caustiques AU FOND (shader terrain) : on/off avec la mer animée
  terrain.mapUniforms.uSeaCausK.value = params.waterReal ? 1 : 0
  setSeaEnabled(params.seaEnabled) // rebuild repose group.visible : on rappelle la règle
}

// ⑪ LA MER SE DÉBRAYE (Adrien). Un seul endroit sait répondre à « la mer
// est-elle visible ? » : elle l'est si la scène est en surface ET si
// l'interrupteur est allumé. Tout le reste (modes.setSurfaceVisible,
// waterRebuild, application d'un template) repasse par ici plutôt que
// d'écrire realWater.setVisible en direct — c'est ce qui empêche un rebuild
// de rallumer une mer qu'on venait d'éteindre.
// On masque au lieu de disposer : rallumer ne doit rien reconstruire.
// `!== false` et non `=== true` : les looks d'avant l'interrupteur n'ont pas
// la clé, et ils avaient bien une mer.
function setSeaEnabled(v) {
  params.seaEnabled = v !== false
  realWater?.setVisible(params.seaEnabled && socleAffiche())
}

// OSM attribution + loading status for the Map layers (ODbL requires the credit).
// Places (villages/towns) now come from GeoNames, which requires its own CC-BY
// credit — merged into the single bottom-left credit line (bars.js buildCredits)
// rather than a second corner, so nothing overlaps the isometric-view button
// and there's one line/one corner/one size instead of two.
function refreshOsmCredit() {
  const loading = mapLayers.isLoading()
  const parts = []
  if (loading) parts.push('OSM · chargement…')
  if (params.placesEnabled && params.source === 'real' && socleAffiche()) parts.push('© GeoNames (CC BY 4.0)')
  // IGN's Licence Ouverte requires visible attribution while its imagery is on
  // screen — and only while it is: aerialAttribution is null the moment the
  // layer is off OR the patch leaves the covered area.
  //
  // ⛔ **LE CRÉDIT SUIT LA PHOTO, PAS LE DRAPEAU — Tâche R9, tour de
  // correction.** La Tâche R1 ② avait écrit ici `&& !terreUniqueBranchee` sur
  // l'argument « sous `terre unique`, l'orthophoto n'est JAMAIS à l'écran ».
  // **R9 a rendu cette prémisse fausse** : la photo est désormais peinte sur la
  // découpe. Mesuré à l'écran sous `?terre=unique&frontiere=1`, photo allumée :
  // l'imagerie IGN était peinte sur la sphère et **son attribution était
  // absente**. Une garde bâtie sur « il n'y a pas de photo » devient un défaut
  // le jour où il y en a une — et c'est une obligation de licence, pas une
  // coquetterie : les trois lignes au-dessus la posent, mot pour mot.
  //
  // ⚠️ **ET LE CAS DE LA PRODUCTION RESTE INTACT** — le défaut d'orbite mesuré
  // le 2026-08-23 (`.banc/R1-tour2/credit-prod.json`) n'est PAS corrigé en
  // passant : il est laissé à l'arbitrage d'Adrien. La loi le dit en toutes
  // lettres, et un test l'exige.
  //
  // ⚠️ **LA DÉCISION VIT DANS `monde/credit-orthophoto.js`, ET C'EST LE POINT
  // DU TOUR** : la garde précédente n'était tenue que par une expression
  // régulière sur ce texte-ci (`test/visibilite-surface.test.js` ③), laquelle
  // **rougissait sur sa propre correction**. Une loi exportée s'exécute.
  const creditAerien = creditOrthophoto({
    terreUnique: terreUniqueBranchee,
    attribution: aerialAttribution,
    peinte: orthophotoPeinteSurLeCrop(globe?.uniforms),
  })
  if (creditAerien) parts.push(creditAerien)
  // CC-BY 4.0 impose la mention tant que la donnée est à l'écran, et seulement
  // tant qu'elle y est — même contrat que la Licence Ouverte de l'IGN juste
  // au-dessus. `solAttribution` retombe à null dès que la couche s'éteint ou
  // que l'emprise quitte une zone cuite.
  // ⚠️ `SOL_LICENCE`, PAS UNE CHAÎNE RECOPIÉE. La constante existait et personne
  // ne la lisait : la ligne affichait « CC BY 4.0 » à la main pendant que le
  // module déclarait « CC-BY 4.0 ». Deux écritures d'une obligation de licence,
  // dont une seule peut suivre un changement de source.
  if (solAttribution) parts.push(`${solAttribution} (${SOL_LICENCE})`)
  // Même obligation, même source de vérité : `canopeeAttribution` ne vaut
  // quelque chose que si des tuiles ont VRAIMENT été vues. Afficher le crédit
  // ETH au-dessus d'une mosaïque vide serait au choix une mention gratuite ou un
  // mensonge sur ce qu'on regarde.
  if (canopeeAttribution) parts.push(`${canopeeAttribution} (${CANOPEE_LICENCE})`)
  // L'ADRESSE DE LA SOURCE, AU SURVOL. `SOL_URL_SOURCE` et `CANOPEE_URL_SOURCE`
  // étaient déclarées et n'étaient AFFICHÉES NULLE PART, alors que l'en-tête de
  // src/canopee.js écrit que « l'attribution est une OBLIGATION de licence ».
  // Une mention sans moyen de remonter à la source n'est pas une attribution
  // complète ; la supprimer aurait été le mauvais sens de la correction.
  const sources = []
  if (solAttribution) sources.push(`${solAttribution} — ${SOL_URL_SOURCE}`)
  if (canopeeAttribution) sources.push(`${canopeeAttribution} — ${CANOPEE_URL_SOURCE}`)
  credits.setExtra(parts.join(' · '), sources.join('\n'))
}

// rebuild all map layers (water/places) for the current zone — used by
// the Map panel toggles (Task 12)
// Aerial photo skin — a narrow first test: IGN orthophotos, Annecy only, off by
// default (see src/map/aerial-layer.js for why it's scoped to one area, and for
// the licence notes). Nothing is hosted; tiles come per view from IGN's public
// WMTS. Rides rebuildMapLayers so it follows every location change on its own.
const aerialLayer = new AerialLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
let aerialAttribution = null
// public entry: run the refresh, then reflect the TRUE final state on the
// bottom-left aerial button (refreshAerial self-disables where imagery is
// missing, so the green tick must follow params, not the click)
async function refreshAerial() {
  await refreshAerialCore()
  // ══════ LA PHOTO SUR LA SURFACE DU GLOBE — Tâche R16 ═══════════════════════
  //
  // ⛔ **LE CROP NE POUVAIT PAS PORTER LA VUE AÉRIENNE MONDE, ET C'ÉTAIT DE
  // L'ARITHMÉTIQUE** (rapport R12, §2) : le crop naît sous 32,3 km et meurt
  // au-dessus de 40,3 km, où son emprise fait déjà 1,4 × la hauteur de l'écran
  // à z13 et 1 475 × à z3. `refreshAerialCore`, juste au-dessus, ne parle QU'À
  // lui (`terrain.setAerial`). Cette ligne-ci parle à la SURFACE du globe —
  // une texture par tuile de quadtree, chargée par le parcours qui charge déjà
  // l'altitude, évincée par la même purge. Voir `monde/photo-monde.js`.
  //
  // ⚠️ **APRÈS LE CŒUR, PAS AVANT, POUR QUE LES DEUX DISENT LA MÊME CHOSE.**
  // `refreshAerialCore` peut éteindre `params.aerialEnabled` lui-même (zone sans
  // couverture pour le BLOC, panne réseau) ; lue après, la valeur est celle que
  // le bouton vert affiche à la ligne suivante. Un globe qui peindrait pendant
  // que le bouton dit « éteint » serait le défaut d'origine, retourné.
  globe.setPhotoMonde(params.aerialEnabled && params.source === 'real')
  mapCorner?.setAerialActive(params.aerialEnabled && params.source === 'real')
}

// ═══════════════════════════════════════════════════════════════════════════
// COUCHES — l'état, et les couches elles-mêmes
// ═══════════════════════════════════════════════════════════════════════════
//
// Un simple jeu d'identifiants. C'est le panneau qui interroge le Gardien ;
// ici on ne fait qu'allumer et éteindre ce qui a été autorisé.
const couchesActives = new Set()

const nuitLayer = new NuitLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })

// L'intensité porte DEUX facteurs : l'heure (les villes ne brillent pas à
// midi) et l'allumage de la couche. On les multiplie ici plutôt que dans le
// shader pour que `intensiteNuit` reste pure et testable sous node.
// ⚠️ L'HEURE EST UN ARGUMENT, PAS UNE LECTURE DE `params`. `applyTimeOfDay`
// reçoit son heure ; elle vaut presque toujours `params.timeOfDay`, mais pas
// toujours — et quand elle en diffère, lire params fait briller les villes en
// plein midi pendant que le soleil, lui, obéit à l'argument. Le défaut est
// apparu au premier essai : forcer 12 h laissait la couche à pleine intensité.
// L'intensité part au bloc central ET au damier. Le garde « changement réel »
// — indispensable, `applyTimeOfDay` passe ici à chaque dixième d'heure de la
// tirette de 24 h — vit dans `BlockGrid.setNuitIntensite`, avec la boucle qu'il
// protège et la mémoire dont les dalles à naître ont besoin.
function poseNuitIntensite(v) {
  terrain.setNuitIntensite(v)
  blockGrid.setNuitIntensite(v) // les voisines suivent la principale
}
function refreshNuitIntensite(hour = params.timeOfDay ?? 10) {
  const on = couchesActives.has('lumieres-nocturnes')
  if (!on) { poseNuitIntensite(0); return }
  // DEUX facteurs, et le second n'est pas cosmétique : sous 20 km, la DALLE
  // couvre trois pixels de Black Marble et la couche devient un voile gris
  // uniforme — constaté à Tokyo z16. `facteurEchelleNuit` l'éteint alors.
  //
  // ⚠️ LA DALLE, PAS L'EMPRISE — voir `largeurDalleKm`. `demBounds` décrit les
  // NEUF dalles en mode continu, et le garde, lui, est calibré sur UNE. Mesuré :
  // Paris z12 en 3×3 rendait 0,949 au lieu de 0, c'est-à-dire le voile gris à
  // pleine intensité sous un garde qui croyait l'avoir éteint.
  const echelle = facteurEchelleNuit(largeurDalleKm(dem ? demBounds(dem) : null, dem?.empriseCote))
  // ⚠️ UNE SEULE VALEUR POUR TOUT LE DAMIER, et c'est juste : `echelle` se
  // mesure sur la largeur d'UNE dalle, et toutes les dalles partagent le zoom
  // du bloc central. Recalculer par dalle rendrait le même nombre.
  poseNuitIntensite(intensiteNuit(hour) * echelle)
}

// LES SOUS-OPTIONS, POUSSÉES DANS LES UNIFORMES.
//
// ⚠️ UNE SEULE FONCTION POUR TOUTES, ET ELLE EST IDEMPOTENTE. Les tirettes
// écrivent dans `params` puis appellent ceci ; le boot l'appelle aussi, et c'est
// ce qui garantit qu'un gabarit chargé (qui repose params en bloc, puis
// refreshAll) rende la même image qu'un réglage fait à la main. Quelques appels
// de setter sur des uniformes : le coût est nul, on peut la rappeler sans
// compter — et TOUTE tirette de couche ajoutée plus tard doit passer par ici,
// sinon elle rendra une valeur qui disparaît au premier gabarit chargé.
function appliqueReglagesCouches() {
  const forceSol = opaciteSol(params.solForce)
  const forceCanopee = opaciteCanopee(params.canopeeForce)
  terrain.setSolOpacite(forceSol)
  terrain.setCanopeeOpacite(forceCanopee)
  // … et les voisines avec elle, au même titre que les deux tirettes de la nuit
  // plus bas : une force de lavis qui ne s'applique qu'au bloc central rejoue
  // la coupure à la jointure, en plus discret.
  blockGrid.setSolOpacite(forceSol)
  blockGrid.setCanopeeOpacite(forceCanopee)
  const fond = fondNuit(params.nuitAssombrissement)
  const gain = gainNuit(params.nuitForce)
  terrain.setNuitFond(fond)
  terrain.setNuitGain(gain)
  // … et les voisines avec elle : les deux tirettes dosent l'extinction du sol
  // et la force de la lueur, donc un damier qui ne les reçoit pas rejoue la
  // coupure à la jointure, en plus discret.
  blockGrid.setNuitFond(fond)
  blockGrid.setNuitGain(gain)
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ALLUMAGE AUTOMATIQUE DE LA COUCHE NOCTURNE
// ═══════════════════════════════════════════════════════════════════════════
//
// La RÈGLE est pure et testée (`allumageAutoNuit`, src/reglages-couches.js) ;
// ici il n'y a que les trois choses qu'un module pur ne peut pas porter : la
// mémoire du veto, la consultation du Gardien, et la parole.
//
// ⚠️ LE VETO, ET QUAND IL TOMBE. `nuitEteinteAlaMain` se pose quand
// l'utilisateur éteint la couche lui-même, et ne se lève QUE lorsqu'il la
// rallume lui-même. Le lever au retour du jour serait tentant et faux : en
// lecture temporelle, le crépuscule suivant arrive quelques secondes plus tard
// et la couche se rallumerait sous son doigt — exactement ce qu'on interdit.
let nuitEteinteAlaMain = false
// Pour ne dire le refus du Gardien QU'UNE FOIS par épisode. Un automatisme qui
// renonce en silence se lit comme une couche cassée ; un automatisme qui le
// répète à chaque image de la lecture temporelle est pire.
let refusNuitDit = false

function tenteAllumageNuit({ lecture = false, nuit = false } = {}) {
  const actives = [...couchesActives]
  const active = couchesActives.has('lumieres-nocturnes')
  // Le Gardien décide, comme pour un clic. On ne l'interroge que lorsqu'un
  // déclencheur est armé : `evaluerCouche` est pur mais pas gratuit, et
  // `applyTimeOfDay` passe ici à chaque dixième d'heure de la tirette.
  if (active || (!lecture && !nuit)) {
    if (!lecture && !nuit) refusNuitDit = false // le jour revient : on pourra reparler
    return
  }
  const verdict = evaluerCouche({
    id: 'lumieres-nocturnes',
    actives,
    machine: MACHINE,
    gouverneur: aq,
  }).verdict
  const r = allumageAutoNuit({ active, eteinteAlaMain: nuitEteinteAlaMain, nuit, lecture, verdict })
  if (r.refus && !refusNuitDit) {
    refusNuitDit = true
    // ON LE DIT. « Si le budget refuse, on n'allume pas — et ce n'est pas grave,
    // mais ça ne doit pas être silencieux. »
    showNotice(
      r.motif === MOTIF_LECTURE
        ? 'Lumières nocturnes non allumées : le budget du Gardien est plein. Onglet Couches pour échanger.'
        : 'La nuit tombe, mais le budget du Gardien est plein — les lumières nocturnes restent éteintes.',
      { duration: 4200 },
    )
    return
  }
  if (!r.allumer) return
  setCouche('lumieres-nocturnes', true, { parMachine: true }) // ⚠️ parMachine : ceci ne doit PAS lever le veto de l'utilisateur
  refreshAll() // l'interrupteur du panneau doit bouger, sinon il ment
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LA COUCHE QUI SE RALLUME TOUTE SEULE — LE GARDE D'APRÈS-ATTENTE
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT, et il était bloquant. Les trois `refresh*` testent
// `couchesActives.has(...)` À L'ENTRÉE, puis attendent le réseau — des SECONDES.
// Si l'utilisateur éteint la couche pendant ce temps, le `build` en vol atterrit
// quand même et repose `uSolOn = 1` plus l'attribution : la couche se rallume
// toute seule, sous un interrupteur affiché éteint.
//
// `SUPERSEDED` ne protège pas de ce cas-là, et c'est le point subtil. Il ne
// parle que d'une construction CHASSÉE PAR UNE AUTRE : `_buildId` n'a été
// incrémenté qu'une fois, parce que le second appel — celui de l'extinction —
// sort par la branche « couche éteinte » AVANT d'atteindre `build`. Rien ne le
// signale donc à la construction en vol.
//
// LE COÛT RÉEL : le bouton « Éteindre X pour allumer Y » du Gardien fait tourner
// LES DEUX couches, et le budget qu'il défend est franchi en silence.
//
// On revérifie aussi que le CHAMP n'a pas changé : une mosaïque bâtie sur
// l'emprise d'avant un déplacement se peindrait sur le nouveau bloc, décalée.
// ⚠️ ET LE GEL DE TIRAGE EST UNE TROISIÈME RAISON DE NE PAS POSER. Une mosaïque
// qui atterrit entre deux bandes d'une affiche met dans la moitié basse une
// donnée que la moitié haute n'a pas — voir `figerPourTirage`. Le rattacher ici
// plutôt que de le recopier dans les trois `refresh*` : c'est déjà le point où
// l'on décide de ne pas poser ce qui revient du réseau.
function couchePartieEnVol(id, demAuDepart) {
  return carteGelee() || !couchesActives.has(id) || dem !== demAuDepart || params.source !== 'real'
}

// LA MOSAÏQUE NOCTURNE D'UNE DALLE DU DAMIER — même patron que
// `paintCellAerial`, et pour les mêmes raisons : chaque dalle a SON emprise,
// donc sa propre mosaïque, et son propre `NuitLayer` (dont le `_buildId` ne
// collisionne avec celui de personne).
//
// ⚠️ CE N'EST PAS SUR LE CHEMIN DE L'HEURE, et ça doit le rester. Cette
// fonction touche le réseau et cuit un canevas ; `applyTimeOfDay` passe à
// chaque dixième d'heure. Elle n'est appelée que sur un changement RÉEL :
// naissance d'une dalle, bascule de la couche, déplacement de carte. Le cycle
// horaire, lui, ne pousse que l'intensité (`poseNuitIntensite`, un flottant).
//
// ⚠️ ET LE BUDGET EST BEAUCOUP PLUS PETIT QU'IL N'Y PARAÎT : Black Marble est
// plafonné à z8 et la mosaïque à 1024 px (voir map/nuit-layer.js), là où la
// photo aérienne — déjà bâtie par dalle, elle — monte à 4096. Une dalle de
// 30 km tient dans une ou deux tuiles z8, les mêmes que ses voisines : le
// cache HTTP du navigateur sert tout le damier avec les téléchargements du
// bloc central.
//
// Silencieux comme la photo : pas de notice par dalle, le bloc central porte
// déjà l'attribution légale.
async function peintCelluleNuit(cell) {
  if (!cell?.terrain) return
  if (!couchesActives.has('lumieres-nocturnes') || !cell.dem || params.source !== 'real') {
    cell.terrain.setNuit(null)
    return
  }
  cell.nuit ??= new NuitLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
  const built = await cell.nuit.build(demBounds(cell.dem))
  if (built === SUPERSEDED || !built?.texture) return
  // MÊME GARDE D'APRÈS-ATTENTE que le bloc central (voir `couchePartieEnVol`) :
  // la couche a pu être éteinte, ou la dalle retirée, pendant le téléchargement.
  if (cell.disposed || !couchesActives.has('lumieres-nocturnes')) return
  cell.terrain.setNuit(built)
}

async function refreshNuit() {
  // le damier suit la principale, allumage comme extinction
  for (const cell of blockGrid.cells.values()) peintCelluleNuit(cell)
  if (!couchesActives.has('lumieres-nocturnes') || !dem || params.source !== 'real') {
    terrain.setNuit(null)
    refreshNuitIntensite()
    return
  }
  // L'emprise VRAIE du champ chargé — un bloc, ou les neuf dalles du mode
  // continu. Jamais `patchBounds` : voir `demBounds`.
  const demAuDepart = dem
  const built = await nuitLayer.build(demBounds(dem))
  if (built === SUPERSEDED) return // une construction plus récente a pris la main
  // ⚠️ ON RETESTE L'ÉTAT APRÈS L'ATTENTE — voir `couchePartieEnVol`. La nuit y
  // échappait par ACCIDENT (son `refreshNuitIntensite` final remet l'intensité à
  // zéro quand la couche est éteinte), pas par garde. Un accident n'est pas une
  // protection : la mosaïque restait posée, et la moindre réécriture de ces deux
  // lignes rallumait la couche.
  if (couchePartieEnVol('lumieres-nocturnes', demAuDepart)) return
  terrain.setNuit(built)
  refreshNuitIntensite()
}

// ═══════════════════════════════════════════════════════════════════════════
// L'OCCUPATION DU SOL — ESA WorldCover 2021, cuite en tuiles de CLASSES
// ═══════════════════════════════════════════════════════════════════════════
//
// La règle vit dans src/occupation-sol.js (pur, testé), la mosaïque dans
// src/map/occupation-sol-layer.js. Ici il n'y a que l'enchaînement.
const solLayer = new OccupationSolLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
let solAttribution = null
// Le manifeste des zones cuites, chargé une seule fois. Le site est statique :
// personne ne peut répondre « as-tu de l'occupation du sol ici ? », donc on lit
// un fichier qui le dit — même motif que public/data/bathy/index.json.
let solIndex = null
const chargeIndexSol = () => {
  if (solIndex) return solIndex
  solIndex = fetch('data/sol/index.json')
    .then((r) => (r.ok ? r.json() : null))
    .then(normaliseIndexSol)
    .catch(() => normaliseIndexSol(null))
  return solIndex
}

// LA MOSAÏQUE D'OCCUPATION DU SOL D'UNE DALLE DU DAMIER — même patron que
// `peintCelluleNuit` et `paintCellAerial`, et pour la même raison : chaque
// dalle a SON emprise, donc sa propre mosaïque et son propre layer (dont le
// `_buildId` ne collisionne avec celui de personne).
//
// ⚠️ SANS ELLE, UN LAVIS D'UN CÔTÉ DE LA JOINTURE ET RIEN DE L'AUTRE. C'est
// exactement le défaut de la couche nocturne, en moins violent parce que celle
// -ci n'éteint pas le sol — mais la coupure est de la même nature, et elle est
// franche : la forêt s'arrête au bord du bloc central.
//
// ⚠️ ALLUMER LA COUCHE PASSE PAR `_gateCouche`, DONC PAR UN `#define`. On a
// vérifié ce que ça coûte vraiment sur 24 dalles, plutôt que de le supposer :
// three met ses programmes en CACHE PAR CLÉ (three.module.js, `acquireProgram`
// ~l.7328, clé bâtie par `getProgramCacheKey` ~l.7114 à partir des `defines` et
// de `customProgramCacheKey`, que terrain.js ne redéfinit pas). Les 25 matériaux
// de terrain portent donc la MÊME clé et se partagent UN SEUL programme :
// allumer la couche en compile un, pas vingt-quatre. Ce qui reste est une
// réinitialisation de matériau par dalle (`needsUpdate`) et, surtout, la
// mosaïque elle-même — le vrai budget, le même que celui déjà accepté pour la
// photo aérienne et les lumières nocturnes.
//
// ⚠️ LE PLAFOND ET LE PLANCHER VIENNENT DE LA ZONE DE **CETTE** DALLE, pas de
// celle du bloc central : le socle mondial n'est cuit qu'en z8-z9 et les zones
// fines montent à z14. Une dalle qui déborde d'une zone fine réclamerait sinon
// du z14 jamais écrit, tomberait en 404 et resterait vide sous une couche
// allumée — le « pire des deux mondes » déjà écrit pour le bloc central.
async function peintCelluleSol(cell) {
  if (!cell?.terrain) return
  if (!couchesActives.has('occupation-sol') || !cell.dem || params.source !== 'real') {
    cell.terrain.setSol(null)
    return
  }
  const bounds = demBounds(cell.dem)
  const zone = zoneSolPour(await chargeIndexSol(), bounds)
  // hors zone cuite, la dalle reste nue — SANS éteindre la couche ni parler :
  // l'avertissement et l'extinction appartiennent au bloc central (refreshSol),
  // sinon une seule dalle de bord éteindrait la couche de tout le monde
  if (!zone || cell.disposed) { cell.terrain.setSol(null); return }
  cell.sol ??= new OccupationSolLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
  const built = await cell.sol.build(bounds, { zmax: zone.zmax, zmin: zone.zmin })
  if (built === SUPERSEDED || !built?.texture) return
  // MÊME GARDE D'APRÈS-ATTENTE que le bloc central (voir `couchePartieEnVol`) :
  // la couche a pu être éteinte, ou la dalle retirée, pendant le téléchargement.
  if (cell.disposed || !couchesActives.has('occupation-sol')) return
  cell.terrain.setSol(built)
}

async function refreshSol() {
  // le damier suit la principale, allumage comme extinction (même première
  // ligne que `refreshNuit` — et elle est AVANT les sorties anticipées, sinon
  // éteindre la couche laisserait le lavis posé sur les voisines)
  for (const cell of blockGrid.cells.values()) peintCelluleSol(cell)
  if (!couchesActives.has('occupation-sol') || !dem || params.source !== 'real') {
    terrain.setSol(null)
    solAttribution = null
    refreshOsmCredit()
    return
  }
  // L'emprise VRAIE du champ chargé — un bloc, ou les neuf dalles du mode
  // continu. Jamais `patchBounds` : voir `demBounds`.
  const bounds = demBounds(dem)

  // ⚠️ HORS ZONE CUITE, ON LE DIT ET ON ÉTEINT. Une mosaïque vide rend une carte
  // strictement inchangée, et l'interrupteur, lui, resterait allumé : on lirait
  // « la donnée dit qu'il n'y a rien ici », ce qui est faux. C'est le contrat
  // déjà écrit pour la photo aérienne — « leaving the toggle on while nothing
  // renders is the worst of both ».
  const index = await chargeIndexSol()
  const zone = zoneSolPour(index, bounds)
  if (!zone) {
    couchesActives.delete('occupation-sol')
    terrain.setSol(null)
    solAttribution = null
    refreshOsmCredit()
    showNotice("Pas encore d'occupation du sol sur cette zone — la donnée n'y a pas été cuite.", { duration: 3600 })
    refreshAll() // l'interrupteur doit bouger aussi, sinon le panneau ment
    return
  }

  // ⚠️ LE PLAFOND DE LA ZONE, PAS CELUI DE LA COUCHE. Le socle mondial n'est
  // cuit qu'en z8-z9 ; sans ce passage de témoin, une vue rapprochée sur le
  // Kansas demanderait du z14 jamais écrit et n'afficherait rien, interrupteur
  // allumé. Les zones fines (Mont-Blanc, Nice, Paris) gardent leur z14.
  //
  // ⚠️ ET LE PLANCHER AVEC — voir `zmin` dans occupation-sol-layer. Le manifeste
  // le déclare depuis toujours et personne ne le lisait : à demZoom 5-6 on
  // réclamait du z6/z7 jamais cuit, tout tombait en 404, et l'interrupteur
  // restait allumé sur une carte strictement inchangée.
  //
  // ⚠️ ON EFFACE L'ANCIENNE MOSAÏQUE AVANT DE BÂTIR, comme `refreshAerialCore`.
  // Sans ça, la mosaïque du bloc précédent reste tendue sur le nouveau bloc
  // pendant les secondes du réseau — une forêt posée sur la mauvaise vallée.
  const demAuDepart = dem
  terrain.setSol(null)
  const built = await solLayer.build(bounds, { zmax: zone.zmax, zmin: zone.zmin })
  if (built === SUPERSEDED) return // une construction plus récente a pris la main
  // ⚠️ L'ÉTAT A PU CHANGER PENDANT L'ATTENTE — voir `couchePartieEnVol`. Sans ce
  // test, éteindre la couche pendant son chargement la rallumait toute seule.
  if (couchePartieEnVol('occupation-sol', demAuDepart)) return

  // ⚠️ RIEN N'A ÉTÉ PEINT ⇒ ON ÉTEINT ET ON LE DIT. `tuilesVues === 0` (ou un
  // refus net de la couche) veut dire la même chose que « hors zone cuite » :
  // la carte est inchangée sous un interrupteur allumé, ce qui se lit comme
  // « la donnée dit qu'il n'y a rien ici ». C'est faux, et c'est le pire des
  // deux mondes. Le témoin existait déjà, il ne servait qu'à l'attribution.
  if (!built?.tuilesVues) {
    couchesActives.delete('occupation-sol')
    terrain.setSol(null)
    solAttribution = null
    refreshOsmCredit()
    showNotice("Pas d'occupation du sol à cette échelle — la donnée n'y a pas été cuite.", { duration: 3600 })
    refreshAll() // l'interrupteur doit bouger aussi, sinon le panneau ment
    return
  }
  terrain.setSol(built)
  solAttribution = built.attribution
  refreshOsmCredit()
}

// ═══════════════════════════════════════════════════════════════════════════
// LA HAUTEUR DE CANOPÉE — ETH Global Canopy Height 2020, cuite en tuiles de MÈTRES
// ═══════════════════════════════════════════════════════════════════════════
//
// La règle vit dans src/canopee.js (pur, testé), la mosaïque dans
// src/map/canopee-layer.js. Ici il n'y a que l'enchaînement — et il est le
// jumeau exact de celui de l'occupation du sol juste au-dessus, y compris pour
// l'extinction hors zone cuite.
const canopeeLayer = new CanopeeLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
let canopeeAttribution = null
let canopeeIndex = null
const chargeIndexCanopee = () => {
  if (canopeeIndex) return canopeeIndex
  canopeeIndex = fetch('data/canopee/index.json')
    .then((r) => (r.ok ? r.json() : null))
    .then(normaliseIndexCanopee)
    .catch(() => normaliseIndexCanopee(null))
  return canopeeIndex
}

// LA MOSAÏQUE DE CANOPÉE D'UNE DALLE DU DAMIER — jumelle exacte de
// `peintCelluleSol` juste au-dessus, y compris pour le silence hors zone cuite
// et pour la garde d'après-attente. Voir son en-tête pour le raisonnement (et
// pour ce que coûte vraiment le `_gateCouche` sur 24 dalles : un programme, pas
// vingt-quatre).
async function peintCelluleCanopee(cell) {
  if (!cell?.terrain) return
  if (!couchesActives.has('canopee') || !cell.dem || params.source !== 'real') {
    cell.terrain.setCanopee(null)
    return
  }
  const bounds = demBounds(cell.dem)
  const zone = zoneCanopeePour(await chargeIndexCanopee(), bounds)
  if (!zone || cell.disposed) { cell.terrain.setCanopee(null); return }
  cell.canopee ??= new CanopeeLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
  const built = await cell.canopee.build(bounds, { zmax: zone.zmax, zmin: zone.zmin })
  if (built === SUPERSEDED || !built?.texture) return
  if (cell.disposed || !couchesActives.has('canopee')) return
  cell.terrain.setCanopee(built)
}

async function refreshCanopee() {
  // le damier suit la principale, allumage comme extinction — voir refreshSol
  for (const cell of blockGrid.cells.values()) peintCelluleCanopee(cell)
  if (!couchesActives.has('canopee') || !dem || params.source !== 'real') {
    terrain.setCanopee(null)
    canopeeAttribution = null
    refreshOsmCredit()
    return
  }
  // L'emprise VRAIE du champ chargé — un bloc, ou les neuf dalles du mode
  // continu. Jamais `patchBounds` : voir `demBounds`.
  const bounds = demBounds(dem)

  // ⚠️ HORS ZONE CUITE, ON LE DIT ET ON ÉTEINT. Une mosaïque vide rend une carte
  // strictement inchangée, et l'interrupteur, lui, resterait allumé : on lirait
  // « la donnée dit qu'il n'y a pas d'arbres ici », ce qui est faux. C'est le
  // contrat déjà écrit pour la photo aérienne et pour l'occupation du sol.
  const index = await chargeIndexCanopee()
  const zone = zoneCanopeePour(index, bounds)
  if (!zone) {
    couchesActives.delete('canopee')
    terrain.setCanopee(null)
    canopeeAttribution = null
    refreshOsmCredit()
    showNotice("Pas encore de hauteur de canopée sur cette zone — la donnée n'y a pas été cuite.", { duration: 3600 })
    refreshAll() // l'interrupteur doit bouger aussi, sinon le panneau ment
    return
  }

  // ⚠️ LE PLAFOND DE LA ZONE, PAS CELUI DE LA COUCHE — même passage de témoin
  // que pour l'occupation du sol : une zone cuite en z9 à qui l'on réclame du
  // z14 rend une mosaïque vide sous un interrupteur allumé. Et le PLANCHER avec
  // (`zmin`), pour la raison symétrique : sous z8 rien n'a jamais été cuit.
  //
  // ⚠️ ON EFFACE L'ANCIENNE MOSAÏQUE AVANT DE BÂTIR, comme `refreshAerialCore` :
  // sinon celle du bloc précédent reste tendue sur le nouveau pendant les
  // secondes du réseau.
  const demAuDepart = dem
  terrain.setCanopee(null)
  const built = await canopeeLayer.build(bounds, { zmax: zone.zmax, zmin: zone.zmin })
  if (built === SUPERSEDED) return // une construction plus récente a pris la main
  // ⚠️ L'ÉTAT A PU CHANGER PENDANT L'ATTENTE — voir `couchePartieEnVol`.
  if (couchePartieEnVol('canopee', demAuDepart)) return

  // ⚠️ RIEN N'A ÉTÉ PEINT ⇒ ON ÉTEINT ET ON LE DIT — même contrat que la branche
  // « hors zone cuite » ci-dessus, et pour exactement la même raison.
  if (!built?.tuilesVues) {
    couchesActives.delete('canopee')
    terrain.setCanopee(null)
    canopeeAttribution = null
    refreshOsmCredit()
    showNotice("Pas de hauteur de canopée à cette échelle — la donnée n'y a pas été cuite.", { duration: 3600 })
    refreshAll() // l'interrupteur doit bouger aussi, sinon le panneau ment
    return
  }
  terrain.setCanopee(built)
  canopeeAttribution = built.attribution
  refreshOsmCredit()
}

// `parMachine` distingue le clic de l'utilisateur de l'allumage automatique, et
// c'est TOUT le mécanisme du veto : seul un geste humain pose ou lève
// `nuitEteinteAlaMain`. Le défaut est `false` parce que l'immense majorité des
// appels viennent du panneau, c'est-à-dire d'un doigt.
function setCouche(id, on, { parMachine = false } = {}) {
  if (on) couchesActives.add(id)
  else couchesActives.delete(id)
  if (id === 'lumieres-nocturnes') {
    // Éteinte à la main → veto. Rallumée à la main → veto levé, et on redonne
    // au Gardien le droit de reparler s'il refuse plus tard.
    if (!parMachine) { nuitEteinteAlaMain = !on; refusNuitDit = false }
    refreshNuit()
  }
  if (id === 'occupation-sol') refreshSol()
  if (id === 'canopee') refreshCanopee()
}
async function refreshAerialCore() {
  if (!params.aerialEnabled || !dem || params.source !== 'real') {
    terrain.setAerial(null)
    aerialAttribution = null
    refreshOsmCredit()
    return
  }
  // L'emprise VRAIE du champ chargé — un bloc, ou les neuf dalles du mode
  // continu. Jamais `patchBounds` : voir `demBounds`.
  const bounds = demBounds(dem)

  // Can't deliver here? Say so in the middle of the screen and switch the layer
  // back off. Leaving the toggle on while nothing renders is the worst of both:
  // the user believes photography is active and reads the plain relief AS the
  // photo. Turning it off makes the UI tell the truth, and makes coming back
  // into a covered area a deliberate re-enable rather than a surprise.
  const why = aerialUnavailable(bounds)
  if (why) {
    params.aerialEnabled = false
    terrain.setAerial(null)
    aerialAttribution = null
    refreshOsmCredit()
    showNotice(why)
    refreshAll() // the toggle has to move too, or the panel is lying
    return
  }

  // The NASA global floor stops being honest close up: at ~600 m/px a small
  // block is a smear, not a photo. When the only provider is the global one
  // and the terrain zoom is finer than its z8 cap can serve, say so briefly
  // and switch off — same contract as the old no-coverage path ('en dessous
  // de z8, tu désactives NASA').
  {
    const p = providerForAerial(bounds)
    if (p?.global && params.demZoom > 8) {
      params.aerialEnabled = false
      terrain.setAerial(null)
      aerialAttribution = null
      refreshOsmCredit()
      showNotice('No detailed imagery for this area — satellite covers it at wider zooms only.', { duration: 3200 })
      refreshAll()
      return
    }
  }

  // Clear the PREVIOUS block's photo before the new build starts: the old
  // texture is registered to the old block, and leaving it stretched over the
  // new one shows Vienna's streets on Mount Fuji (observed) plus a stale
  // credit line — legally wrong, not just visually.
  terrain.setAerial(null)
  aerialAttribution = null
  refreshOsmCredit()
  const built = await aerialLayer.build(bounds)

  // A newer build owns the layer now — touch NOTHING. Treating this as failure
  // is what made the layer switch itself off whenever two refreshes overlapped,
  // which is the ordinary case every time the user changes scale.
  if (built === SUPERSEDED) return

  // ⚠️ UNE AFFICHE EST EN COURS DE TIRAGE : ON NE POSE PAS. C'est le cas nommé
  // par la réserve de la tâche 6 — la photo aérienne qui arrive du réseau au
  // milieu du pavage. On le redemandera au dégel (voir `figerPourTirage`).
  if (carteGelee()) { _gelDemande = true; return }

  terrain.setAerial(built)
  if (!built) {
    // Covered on paper but every tile failed — a network/provider problem, NOT
    // a coverage one, so it gets its own words. Same disable: a dead layer
    // shouldn't sit there looking enabled.
    params.aerialEnabled = false
    aerialAttribution = null
    refreshOsmCredit()
    showNotice('Aerial photography couldn’t be loaded just now. Check your connection and try again.')
    refreshAll()
    return
  }
  aerialAttribution = built.attribution
  terrain.setAerialCoastFade(params.aerialCoastFade ?? 0.1) // v49 : couper au large
  refreshOsmCredit()
  // même finition sur les blocs voisins : leur peindre la photo aussi
  for (const cell of blockGrid.cells.values()) paintCellAerial(cell)
}

// Photo aérienne sur UNE cellule du damier — même provider/registre que le bloc
// central. AerialLayer dédié par cellule (son _buildId ne collisionne pas avec
// les autres). Silencieux : une cellule sans couverture garde sa carte peinte
// (contexte), aucune notice — le bloc central porte déjà l'attribution légale.
async function paintCellAerial(cell) {
  if (!cell?.terrain || !cell.dem) return
  const on = params.aerialEnabled && params.source === 'real'
  if (!on) { cell.terrain.setAerial(null); return }
  const bounds = demBounds(cell.dem)
  if (aerialUnavailable(bounds)) { cell.terrain.setAerial(null); return }
  const prov = providerForAerial(bounds)
  if (prov?.global && params.demZoom > 8) { cell.terrain.setAerial(null); return }
  cell.aerial ??= new AerialLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
  const built = await cell.aerial.build(bounds)
  if (built === SUPERSEDED || !built?.texture) return
  // Même gel que le bloc central : une dalle voisine qui s'habille au milieu
  // d'un tirage change l'affiche entre deux bandes.
  if (carteGelee()) { _gelDemande = true; return }
  cell.terrain.setAerial(built)
  cell.terrain.setAerialOpacity(params.aerialOpacity)
  cell.terrain.setAerialCoastFade(params.aerialCoastFade ?? 0.1)
}
// ═══════════ GELER LA CARTE PENDANT UN TIRAGE ══════════════════════════════
//
// ⚠️ LA MOITIÉ QUE LA TÂCHE 6 N'A PAS PU FERMER. Elle a fermé le cycle des
// MATÉRIAUX sur chaque tuile — traverser, régler, rendre, remettre — donc un
// matériau né en route est repris au tour suivant. Ce qu'elle a laissé ouvert,
// c'est le CONTENU : entre deux bandes il y a un `await`, et une mosaïque
// aérienne qui arrive du réseau à cet instant-là met dans la moitié basse de
// l'affiche une photo que la moitié haute n'a pas. Ça ne se voit pas à l'écran,
// ça se voit sur le papier, et ça ne se reproduit pas.
//
// LE GEL APPARTIENT ICI, pas à export.js : c'est ici que vivent les six entrées
// du pipeline de données, et l'orchestrateur de pavage n'a aucune raison de les
// connaître (c'est l'argument même de la tâche 6 contre le gel côté export).
//
// Trois gestes, et le troisième est celui qu'on oublie :
//   ① on refuse les reconstructions NOUVELLES (ci-dessous) ;
//   ② on refuse la POSE de ce qui revenait du réseau (`couchePartieEnVol` et
//      les deux atterrissages de la photo aérienne) ;
//   ③ on arrête la BOUCLE D'IMAGES. Sans ça, une image de rAF se glisse entre
//      deux bandes, avance les nuages, la mer et la faune, et rend au passage la
//      scène à la taille de la tuile précédente : le contenu change d'une bande
//      à l'autre alors même qu'aucune donnée n'est arrivée.
//
// Rien n'est perdu : ce qui a été refusé est REDEMANDÉ au dégel.
let _gelTirage = 0
let _gelDemande = false
const carteGelee = () => _gelTirage > 0

function figerPourTirage() {
  _gelTirage++
  if (_gelTirage === 1) {
    // même mise au repos que l'export vidéo : élan éteint, débordement résorbé,
    // maillage de repos — l'affiche part de maintenant, pas dans une demi-seconde
    f3Fige()
    loopPaused = true
    cancelAnimationFrame(rafId)
    clearTimeout(tickTimer)
  }
  let rendu = false
  return function degeler() {
    if (rendu) return // un dégel appelé deux fois libérerait le gel d'un autre
    rendu = true
    _gelTirage--
    if (_gelTirage > 0) return
    loopPaused = false
    clock.getDelta() // on avale la durée du tirage, sinon dt saute d'un bond
    tick()
    if (_gelDemande) { _gelDemande = false; rebuildMapLayers() }
  }
}

// ⚠️ LA PROMESSE COUVRE MAINTENANT LES QUATRE CALQUES DE TEXTURE, PAS LE SEUL
// `mapLayers.rebuild`. Elle ne le faisait pas, et c'est précisément ce qui
// rendait la « mise au repos avant la première tuile » incomplète : on attendait
// les routes et les rivières pendant que la photo aérienne, la nuit,
// l'occupation du sol et la canopée étaient encore en vol. Chacune est mise à
// l'abri de sa propre erreur : un calque qui échoue ne doit pas faire échouer
// l'attente des autres — c'était déjà le cas quand personne n'attendait.
const calmement = (p) => Promise.resolve(p).catch((e) => { console.warn('[ShibuMap] calque :', e); return null })
const rebuildMapLayers = () => {
  if (carteGelee()) { _gelDemande = true; return Promise.resolve() }
  const p = mapLayers.rebuild({ dem, terrain, params })
  refreshOsmCredit()
  return Promise.all([p, refreshAerial(), refreshNuit(), refreshSol(), refreshCanopee()].map(calmement))
    .then(() => refreshOsmCredit())
}

// "individualiser la zone" — clip the map to the administrative boundary under
// the view (continent/country/region/departement by zoom). The landform sits
// straight on the ground: no plinth, no square ocean slab.
let regionBusy = false
function disposeRegionSkirt() {
  // material is shared with the plinth — do NOT dispose it here
  if (regionSkirt) {
    scene.remove(regionSkirt.mesh)
    regionSkirt.mesh.geometry.dispose()
    regionSkirt = null
  }
  for (const mesh of regionCellSkirts) {
    scene.remove(mesh)
    mesh.geometry.dispose()
  }
  regionCellSkirts = []
}
// LE ZÉRO de la zone isolée : l'altitude 0 m du relief chargé, en unités monde
// (uSeaY, posé par terrain.js d'après l'échelle du DEM). Un seul plan pour trois
// choses qui doivent coïncider — le pied de la découpe, les textes du cartouche
// et la dalle qui reçoit l'ombre. Sur un terrain procédural uSeaY vaut -9999
// (pas de mer) : on retombe alors sur le pied du socle.
// Le demi-côté de la zone isolée, en unités monde, rapporté au demi-bloc : le
// facteur dont le cartouche doit se resserrer pour venir épouser l'île au lieu
// de rester plaqué aux bords d'un bloc devenu invisible (Adrien). On prend le
// PLUS GRAND des deux demi-côtés : les textes épousent le long axe et gardent
// un peu d'air sur l'autre, plutôt que de mordre sur la côte.
function regionFrameScale(parts) {
  if (!parts?.length || !dem) return 1
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const rings of parts) {
    for (const [lon, lat] of rings?.[0] || []) {
      const p = latLonToWorld(dem, Math.min(85.05, Math.max(-85.05, lat)), lon)
      if (p.x < x0) x0 = p.x
      if (p.x > x1) x1 = p.x
      if (p.z < z0) z0 = p.z
      if (p.z > z1) z1 = p.z
    }
  }
  if (!(x1 > x0) || !(z1 > z0)) return 1
  // Le DEMI-CÔTÉ de l'emprise, pas la distance au centre du bloc : mesurée
  // depuis l'origine, un îlot excentré gonflait le rayon et le cartouche ne se
  // resserrait presque pas (0,88 au lieu de 0,58 sur La Réunion).
  const half = Math.max((x1 - x0) / 2, (z1 - z0) / 2)
  return Math.min(1, half / (TERRAIN_SIZE / 2))
}

// FLOTTE — (re)sème les bateaux pour le bloc courant. Appelée après chaque
// construction de relief : le zoom, l'emprise et le trait d'eau changent, donc
// la densité et l'échelle des bateaux aussi.
//
// Le rendu ayant été validé, la règle du 1 SUR 10 est rétablie : `force` n'a
// servi que le temps de juger l'échelle et le mouvement. Croiser un bateau doit
// rester un événement, pas un décor.
function syncBoats() {
  if (params.source !== 'real' || !dem || !realWater) { boats.boats = []; return }
  const seaMat = realWater.materials?.find((m) => m.uniforms?.uWaveA)
  if (!seaMat) { boats.boats = []; return }
  boats.setSea(seaMat)
  const seaY = realWater.seaY
  const coteFlotte = dem.empriseCote > 1 ? dem.empriseCote : 1
  boats.build({
    zoom: params.demZoom,
    half: TERRAIN_SIZE / 2,
    // ⚠️ `cote` sème sur TOUTE l'emprise, `half` reste le demi-BLOC : c'est
    // l'échelle du bateau (sa vitesse, sa veille), pas l'étendue de sa mer.
    cote: coteFlotte,
    // la graine suit le LIEU : revenir au même endroit rend la même flotte
    seed: Math.round((params.demLat + 90) * 1000) * 100003 + Math.round((params.demLon + 180) * 1000),
    // Navigable = sous le niveau de la mer. Ce test sert DEUX fois : au semis,
    // et à chaque image pour la veille devant l'étrave (fleet.js) — sans le
    // second, le bateau traverse la côte au lieu de la longer.
    //
    // ⚠️ ET IL DOIT LIRE L'EMPRISE, PAS LE BLOC CENTRAL. Les positions des
    // bateaux sont en coordonnées de CHAMP ; `terrain.sample` parle en
    // coordonnées de GÉOMÉTRIE et ajoute lui-même le décalage de fenêtre. Sans
    // la soustraction, la veille consultait le relief d'un autre endroit : un
    // bateau aurait traversé une falaise hors du bloc du milieu, ce que la
    // règle d'Adrien (« les bateaux ne rentrent jamais en collision avec la
    // terre ») interdit — et le semis aurait posé des coques sur la montagne.
    isSea: (x, z) => {
      if (!Number.isFinite(seaY)) return false
      const f = terrain.fenetre ?? { x: 0, z: 0 }
      return (terrain.sample?.(x - f.x, z - f.z) ?? 0) < seaY - 0.05
    },
    extentMeters: dem.extentMeters,
    terrainSize: TERRAIN_SIZE,
  })
}

// Un point du monde est-il DANS la zone découpée ? Le masque est déjà rasterisé
// sur l'emprise exacte du bloc (region-mask.js), donc la lecture est un simple
// changement d'échelle — même correspondance que le shader du relief.
let regionMaskData = null
function insideRegion(x, z) {
  if (!regionMaskData) return true
  const { data, size } = regionMaskData
  const px = Math.round((x / TERRAIN_SIZE + 0.5) * size - 0.5)
  const py = Math.round((z / TERRAIN_SIZE + 0.5) * size - 0.5)
  if (px < 0 || py < 0 || px >= size || py >= size) return false
  return data[(py * size + px) * 4] >= 127
}
// (re)lit le masque courant et pousse le filtre sur la couche des lieux
function syncRegionPlaceFilter() {
  regionMaskData = null
  if (params.regionMode && regionMaskCanvas) {
    try {
      const size = regionMaskCanvas.width
      const data = regionMaskCanvas.getContext('2d').getImageData(0, 0, size, size).data
      regionMaskData = { data, size }
    } catch {}
  }
  mapLayers?.places?.setRegionTest(regionMaskData ? insideRegion : null)
  rebuildMapLayers()
}

// LE PLAN SUR LEQUEL LA ZONE ISOLÉE SE POSE — pied de la découpe, dalle qui
// reçoit son ombre et textes du cartouche doivent coïncider, d'où ce point
// unique. La règle elle-même vit dans region-skirt.js (regionBaseLevel) : le
// niveau de la mer pour une île, le plancher de la zone quand elle est en
// altitude. `regionFloorY` est null tant que rebuildRegionSkirt n'a pas mesuré
// ce plancher — on retombe alors sur le zéro absolu, l'ancien comportement.
function regionBaseY() {
  const y = regionBaseLevel(terrain.mapUniforms?.uSeaY?.value, regionFloorY)
  return Number.isFinite(y) ? y : plinth.baseY + plinth.depth
}

const SKIRT_GRID = 300

// (re)build the vertical curtain around the isolated zone from the current mask
// + terrain heightfield. Shares the plinth wall material so the socle finish
// (PBR / glass) carries onto the cut.
//
// TRACER D'ABORD, CONSTRUIRE ENSUITE — l'ordre n'est pas cosmétique. Le pied de
// la coupe est COMMUN à toutes les dalles du damier : il faut donc les avoir
// toutes tracées pour connaître le plancher avant d'en bâtir une seule. Un
// plancher par dalle marquerait une marche à chaque jointure.
function rebuildRegionSkirt() {
  disposeRegionSkirt()
  regionFloorY = null
  if (!params.regionMode || !regionMaskCanvas || !terrain.sample) return
  const dalles = [{ canvas: regionMaskCanvas, sample: terrain.sample, x: 0, z: 0, centre: true }]
  for (const cell of blockGrid.cells.values()) {
    // une dalle PLEINE n'a pas de canevas (son masque était un seul bit) : elle
    // reste de la partie par `uniform`, et il le faut — son minimum intérieur
    // entre dans le plancher COMMUN de la découpe, et ses quatre bords doivent
    // être murés comme le faisait son masque tout blanc
    if ((cell.regionCanvas || cell.regionUniform) && cell.terrain?.sample) {
      dalles.push({
        canvas: cell.regionCanvas,
        uniform: cell.regionUniform || null,
        sample: cell.terrain.sample,
        x: cell.i * TERRAIN_SIZE,
        z: cell.j * TERRAIN_SIZE,
      })
    }
  }
  let plancher = Infinity
  for (const d of dalles) {
    d.traced = traceSkirt({ maskCanvas: d.canvas, uniform: d.uniform, sample: d.sample, grid: SKIRT_GRID })
    const f = skirtFloor(d.traced, d.sample)
    if (Number.isFinite(f) && f < plancher) plancher = f
  }
  regionFloorY = Number.isFinite(plancher) ? plancher : null
  const baseY = regionBaseY()
  // LA BANDE D'OCCLUSION EST COMMUNE, comme le pied. Elle se mesure ici parce
  // qu'ici seulement on connaît TOUTES les dalles : le point le plus haut de la
  // découpe entière calibre l'assombrissement de pied de chacune. Mesurée dalle
  // par dalle, elle donnait à chaque jupe une hauteur de pied sombre différente
  // — le « les socles semblent tous différents » d'Adrien. Voir bandeContact.
  let sommet = -Infinity
  for (const d of dalles) {
    for (const s of d.traced?.segs || []) {
      if (s.ya > sommet) sommet = s.ya
      if (s.yb > sommet) sommet = s.yb
    }
  }
  const aoBande = Number.isFinite(sommet) ? bandeContact(sommet, baseY) : null
  for (const d of dalles) {
    const s = buildRegionSkirt({
      maskCanvas: d.canvas,
      uniform: d.uniform,
      sample: d.sample,
      material: plinth.wallMat,
      grid: SKIRT_GRID,
      traced: d.traced, // déjà tracée ci-dessus, hauteurs comprises
      baseY,
      aoBande,
    })
    if (!s) continue
    s.mesh.position.set(d.x, 0, d.z)
    s.mesh.visible = socleAffiche()
    scene.add(s.mesh)
    if (d.centre) regionSkirt = s
    else regionCellSkirts.push(s.mesh)
  }
}

// ---------------------------------------------------------------- damier isolé
// LE DÉCOUPAGE NE S'ARRÊTE PLUS AU BLOC CENTRAL (demande Adrien) : « si j'isole
// un lieu que j'ai nommé, ex : Le Var, quand je zoom, des tuiles nouvelles se
// créent pour contenir tout le Var, dans la limite de 5×5 ». Ce sont exactement
// les règles du damier GPX (block-grid.js) — même grille, même plafond, mêmes
// dalles de contexte — appliquées à un contour au lieu d'une trace.
//
// Rien de nouveau à calculer : rasterizeMask prend DÉJÀ le DEM en argument, il
// suffit de lui donner celui de la cellule au lieu de celui du bloc central.
//
// Moitié de la définition du bloc central : ce sont des dalles de CONTEXTE,
// maillées à 256 (block-grid.js NEIGHBOUR_RES). Un masque de 2048 par dalle
// coûterait 16 Mo chacune pour un liseré que personne ne regarde de près.
const CELL_MASK_SIZE = 1024
function paintCellRegion(cell) {
  const t = cell?.terrain
  if (!t) return
  const parts = blockGrid.regionParts
  const isolée = !!(params.regionMode && parts?.length)
  // les flancs du damier disparaissent avec ceux du bloc central
  // (plinth.setSlabOnly) — sinon la découpe flotterait entre des carrés pleins
  if (cell.walls) cell.walls.visible = !isolée
  if (!isolée || !cell.dem) {
    t.setRegionMask(null)
    cell.regionCanvas = null
    cell.regionUniform = null
    return
  }
  try {
    // le trait de côte de LA cellule, s'il est déjà arrivé : sans lui les
    // polders sous le niveau 0 seraient retirés de la découpe (caveat v1)
    //
    // uniformShortcut : une dalle qui tombe au MILIEU de la zone a un masque
    // uniformément blanc — 4 sur 23 sur le Var à z12. Elle n'en garde alors
    // RIEN : ni texture, ni canevas, ni ImageData, soit douze mégaoctets pour
    // un seul bit. `cell.regionUniform` prend le relais partout où le canevas
    // servait (la jupe — voir rebuildRegionSkirt).
    const raster = rasterizeMask(parts, cell.dem, CELL_MASK_SIZE, cell.coastImage || null, { uniformShortcut: true })
    cell.regionUniform = raster.uniform || null
    cell.regionCanvas = raster.canvas
    if (raster.uniform) t.setRegionUniform(raster.uniform === 'full')
    else t.setRegionMask(raster.texture)
  } catch (err) {
    console.warn('découpe de zone sur une dalle du damier :', err)
  }
}

// Le retracé DIFFÉRÉ de la jupe, quand les dalles arrivent en rafale (voir
// blockGrid.onReady). La dalle se recale dans la foulée : le plancher a pu
// descendre en même temps que le damier s'est étendu.
let regionSkirtTimer = null
function rebuildRegionSkirtSoon() {
  clearTimeout(regionSkirtTimer)
  regionSkirtTimer = setTimeout(() => {
    regionSkirtTimer = null
    if (!params.regionMode || !regionMaskCanvas) return
    rebuildRegionSkirt()
    plinth.setSlabOnly(true, regionBaseY())
  }, 400)
}

// Le damier suit la zone : on lui donne le contour, il fait naître les dalles
// qui le portent (ou les retire toutes quand on passe null), puis chacune
// rasterise SA part du masque.
function syncRegionGrid(parts) {
  blockGrid.setRegionParts(parts || null)
  blockGrid.sync(allGpxPoints())
  for (const cell of blockGrid.cells.values()) paintCellRegion(cell)
}
// La vue d'AVANT l'isolation, pour la rendre intacte au décochage (Adrien :
// « le bloc doit revenir à son format d'origine »). Le recadrage change
// demLat/demLon/demZoom ; sans cette mémoire, décocher laisserait l'utilisateur
// sur le cadrage de la zone au lieu de celui qu'il avait choisi.
let regionReturn = null
// une seule tentative de recadrage par activation : après le rechargement,
// applyRegionMode se rappelle (fetchAndBuildDem le fait quand regionMode est
// vrai), et recalculer le cadre à chaque passage pourrait osciller
let regionFramed = false
// Le NIVEAU administratif demandé au premier passage. Le recadrage dézoome, et
// sans cette mémoire le second passage relit un niveau plus grossier : la
// Savoie devenait une région, l'Inde devenait l'Asie, le Brésil n'avait plus
// aucune frontière du tout.
let regionLevel = null

// CE QUE L'UTILISATEUR A DEMANDÉ — `{ name, parts? }`.
//
// C'est la correction de fond du mode isolé. Il ne savait pas ce qu'on lui
// demandait : il géocodait à l'envers le CENTRE du bloc, à un niveau
// administratif déduit du ZOOM (LEVEL_TABLE, region-mask.js). Chercher Toulon
// et recevoir le Var n'était donc pas un accident, c'était le fonctionnement —
// aucune quantité de données n'aurait pu le corriger.
let regionTarget = null
function setRegionTarget(t) {
  regionTarget = t && t.name ? { name: t.name, parts: t.parts || null, peak: t.peak || null } : null
  // La cible change : le niveau retenu au passage précédent ne la concerne plus.
  regionLevel = null
}

// La géométrie de la cible prime toujours sur la déduction. Quatre cas, du plus
// sûr au plus flou :
//   1. l'entité a été cherchée, sa géométrie est déjà là → on découpe celle-là
//   2. on n'a que son nom (clic sur un lieu remarquable, recherche sans
//      polygone) → on la géocode UNE fois, ICI et pas plus tôt : rien de tout
//      ça ne doit peser sur le chemin d'une recherche ordinaire
//   3. le nom ne désigne aucune surface → c'est peut-être un sommet, on le
//      cherche et sa forme se taillera dans le relief
//   4. rien de demandé (arrivée par coordonnées, panoramique libre) → repli sur
//      l'ancien comportement, deviner d'après le centre et le zoom
async function resolveRegionMask() {
  if (regionTarget && !regionTarget.parts && !regionTarget.peak) {
    try {
      // Les entrées d'Explorer portent une précision entre parenthèses —
      // « Tenerife (Teide) », « Corsica (whole island) ». Elle aide à LIRE la
      // liste, mais aucun géocodeur ne la connaît : envoyée telle quelle, elle
      // ne rend rien et le lieu retombe silencieusement sur la déduction.
      const propre = regionTarget.name.replace(/\s*\([^)]*\)/g, '').trim()
      const hit = await geocode(propre)
      const parts = hit && mainParts(hit.geojson, hit.lat, hit.lon)
      if (parts?.length) regionTarget.parts = parts
      // Aucune surface derrière ce nom. Un sommet, très probablement : ils sont
      // des POINTS dans OSM, jamais des contours. Identifier le bon coûte une
      // requête Overpass lente (mesuré : plusieurs dizaines de secondes, d'où
      // sa place ici et nulle part ailleurs), mais elle n'est payée qu'une fois
      // et seulement par qui demande à isoler une montagne.
      else regionTarget.peak = await findPeak(propre).catch(() => null)
    } catch (err) {
      console.warn('cible isolée : identification impossible', err)
    }
  }

  // UN SOMMET N'A PAS DE CONTOUR — nulle part. Sa forme se taille dans le
  // relief : on trace la courbe de niveau qui l'entoure et on ne garde que la
  // boucle qui le contient.
  //
  // Volontairement RECALCULÉE à chaque passage, jamais mémorisée : la découpe
  // dépend de la dalle chargée, et le recadrage en charge justement une autre.
  // La figer donnerait la calotte de l'ancienne dalle sur le nouveau cadre.
  if (regionTarget?.peak && dem) {
    const m = peakMask(dem, regionTarget.peak)
    if (m?.parts?.length) {
      return regionMaskFromParts({
        parts: m.parts,
        dem,
        coastImage: coastMaskImage,
        name: regionTarget.name,
      })
    }
  }
  if (regionTarget?.parts?.length) {
    const r = regionMaskFromParts({
      parts: regionTarget.parts,
      dem,
      coastImage: coastMaskImage,
      name: regionTarget.name,
    })
    if (r) return r
    // Plus rien de la cible ne touche le bloc : l'utilisateur a navigué
    // ailleurs depuis. On l'oublie plutôt que de découper dans le vide.
    regionTarget = null
  }
  return fetchRegionMask({
    lat: params.demLat,
    lon: params.demLon,
    zoom: params.demZoom,
    dem,
    coastImage: coastMaskImage,
    level: regionLevel,
  })
}

async function applyRegionMode() {
  if (!params.regionMode || params.source !== 'real' || !dem) {
    terrain.setRegionMask(null)
    disposeRegionSkirt()
    regionMaskCanvas = null
    regionFloorY = null
    // le damier lâche la zone AVANT le retour de vue : les dalles nées pour la
    // porter s'en vont, celles d'un tracé GPX restent, et celles qui restent
    // reperdent leur masque (sinon elles garderaient la découpe précédente)
    syncRegionGrid(null)
    plinth.setSlabOnly(false) // le bloc carré revient
    plinth.rebuild(terrain, params) // et la dalle redescend : setSlabOnly l'avait remontée au zéro
    groundInfo.setFrameScale(1) // et le cartouche retrouve les bords du bloc
    syncRegionPlaceFilter() // toutes les villes reviennent
    plinth.setVisible(params.plinth && socleAffiche())
    waterRebuild() // restore the open-sea surface once the region clip is gone
    // RETOUR À LA VUE D'ORIGINE — recharge le relief là où l'utilisateur était
    // avant d'isoler, pour que décocher revienne exactement sur ses pas.
    const back = regionReturn
    regionReturn = null
    regionFramed = false
    if (back && (params.demLat !== back.lat || params.demLon !== back.lon || params.demZoom !== back.zoom)) {
      params.demLat = back.lat
      params.demLon = back.lon
      params.demZoom = back.zoom
      params.demLocation = back.location
      await loadRealTerrain()
    }
    return
  }
  if (regionBusy) return
  regionBusy = true
  try {
    // coastMaskImage : les polders sous 0 restent dans la découpe (le clip
    // altitude seul les prenait pour la mer) ; null → comportement v1
    const r = await resolveRegionMask()
    regionLevel ??= r?.levelRow ?? null // le niveau du PREMIER passage fait foi
    if (!params.regionMode) return // user toggled off while fetching

    // RECADRAGE SUR LA ZONE — « une île perdue au milieu de rien, ça fait
    // bizarre » (Adrien). On centre le bloc sur la zone et on descend au zoom
    // le plus SERRÉ qui la contienne encore, sur son plus grand côté : c'est
    // exactement le schéma d'Adrien — nord/sud aux bords si la zone est plus
    // haute que large, est/ouest sinon.
    //
    // ⚠️ Le zoom des tuiles est ENTIER. La zone remplit donc le bloc entre 50 %
    // et 100 % selon qu'on tombe juste ou non après l'arrondi ; elle ne peut
    // pas TOUCHER les bords au pixel près. Aller plus loin demanderait une
    // mise à l'échelle d'affichage par-dessus, qui entraînerait avec elle les
    // étiquettes, l'échelle graphique et les ombres — un autre chantier.
    // frameTrack n'est pas réutilisé ici : sa marge de 35 %, faite pour qu'une
    // trace GPX respire dans le bloc, laisserait justement la zone flotter.
    if (r?.parts?.length && !regionFramed) {
      regionFramed = true
      // LE CADRE VISE LE DAMIER, PLUS UN SEUL BLOC (demande Adrien). Cinq dalles
      // de côté valent 2,32 crans de zoom : la zone est vue 4 à 5 fois plus
      // grande qu'avant, sans qu'un pouce en dépasse.
      //
      // ⚠️ SAUF POUR UN SOMMET. Sa forme n'a pas de contour au monde : elle se
      // taille dans le MNT de la dalle chargée (peak-mask.js), et seulement de
      // celle-là. Zoomer de trois crans sur un sommet ne ferait pas grandir sa
      // découpe, elle serait tranchée net au bord du bloc central.
      const dalles = regionTarget?.peak ? 1 : GRID_R * 2 + 1
      const f = frameRegion(r.parts, { spanBlocks: dalles })
      if (f && (Math.abs(f.lat - params.demLat) > 1e-4 || Math.abs(f.lon - params.demLon) > 1e-4 || f.zoom !== params.demZoom)) {
        regionReturn ??= { lat: params.demLat, lon: params.demLon, zoom: params.demZoom, location: params.demLocation }
        params.demLat = f.lat
        params.demLon = f.lon
        params.demZoom = f.zoom
        params.demLocation = r.name || params.demLocation
        regionBusy = false // le rechargement rappellera applyRegionMode
        await loadRealTerrain()
        return
      }
    }
    terrain.setRegionMask(r ? r.maskTexture : null)
    // Isolate-the-zone drops the flat slab, but a vertical curtain still closes
    // the cut so a boundary over a summit or a trench never shows the map's
    // underside. It welds to the terrain height and shares the socle material.
    regionMaskCanvas = r ? r.maskCanvas : null
    // LE DAMIER PORTE LA SUITE DU DÉCOUPAGE, comme il porte déjà la suite d'un
    // tracé GPX — sauf pour un sommet, dont la forme ne vient que du MNT de la
    // dalle centrale (voir le recadrage plus haut).
    syncRegionGrid(regionTarget?.peak ? null : r?.parts)
    // ⚠️ LA JUPE AVANT LA DALLE : c'est elle qui mesure le plancher de la zone
    // (regionFloorY), et c'est ce plancher que la dalle doit venir toucher —
    // sans quoi elle resterait au niveau de la mer sous une zone d'altitude.
    rebuildRegionSkirt()
    // les flancs disparaissent, la DALLE reste — et remonte au plan de pose de
    // la découpe pour recevoir son ombre portée
    plinth.setSlabOnly(true, regionBaseY())
    waterRebuild() // regionMode is on — the sim drops its sea (it would spill past the boundary) but keeps the lakes
    // le cartouche vient épouser l'île au lieu de rester aux bords du bloc
    groundInfo.setFrameScale(regionFrameScale(r?.parts))
    syncRegionPlaceFilter() // les villes hors du territoire disparaissent
    if (r) modes.announce(`ZONE — ${String(r.name).toUpperCase()}`)
    else modes.announce('ZONE — NO BOUNDARY AT THIS SCALE')
  } catch (err) {
    // Ce catch était MUET. Il a avalé un frameRegion non importé : la zone
    // isolée ne faisait plus rien du tout, sans un mot dans la console, et le
    // symptôme (rien ne se passe) ne désignait aucune cause. Un échec réseau
    // reste tolérable — c'est pour ça qu'on ne relance pas — mais il doit se
    // dire, sinon la prochaine faute de frappe coûtera la même demi-heure.
    console.warn('isoler la zone : échec', err)
    terrain.setRegionMask(null)
    disposeRegionSkirt()
    regionMaskCanvas = null
    regionFloorY = null
    syncRegionGrid(null) // le damier ne garde pas une découpe orpheline
  } finally {
    regionBusy = false
  }
}

// ---- keyboard-shortcut layer toggles -------------------------------------
// contours/grid opacity is flipped between 0 and the last non-zero value
// (falling back to the shipped default) so re-pressing the key restores
// whatever the user had dialled in, not just the frozen default.
let storedContourOpacity = null
let storedGridOpacity = null
function toggleLayer(id) {
  if (!terrain?.mapUniforms) return
  // PLUS de case 'roads' : le calque a quitté le site, et son raccourci R avec
  // lui (shortcuts.js). Le `default: return` plus bas absorbe silencieusement
  // un identifiant inconnu, donc rien ne casse si un vieil appel traîne.
  switch (id) {
    case 'water':
      params.waterEnabled = !params.waterEnabled
      rebuildMapLayers()
      break
    case 'places':
      params.placesEnabled = !params.placesEnabled
      rebuildMapLayers()
      break
    case 'contours':
      if (params.contourOpacity > 0) {
        storedContourOpacity = params.contourOpacity
        params.contourOpacity = 0
      } else {
        params.contourOpacity = storedContourOpacity ?? DEFAULT_LOOK.contourOpacity
        storedContourOpacity = null
      }
      terrain.mapUniforms.uContourOpacity.value = params.contourOpacity
      break
    case 'grid':
      if (params.gridOpacity > 0) {
        storedGridOpacity = params.gridOpacity
        params.gridOpacity = 0
      } else {
        params.gridOpacity = storedGridOpacity ?? DEFAULT_LOOK.gridOpacity
        storedGridOpacity = null
      }
      terrain.mapUniforms.uGridOpacity.value = params.gridOpacity
      break
    default:
      return
  }
  refreshAll()
  // water/places/contourOpacity/gridOpacity are all TEMPLATE_KEYS —
  // a keyboard toggle never touches a `.ce-dock` control, so it would be
  // invisible to the debounced dock listener below without this explicit
  // record (history?. — this can fire before `history` exists only if a key
  // is somehow pressed mid-boot, which bindShortcuts is wired late enough
  // to avoid, but the guard costs nothing)
  history?.record()
}
function toggleRegion() {
  params.regionMode = !params.regionMode
  applyRegionMode()
  refreshAll()
}

// export renders offline: the RAF chain pauses and the scene advances at a
// fixed timestep so the video is deterministic whatever the encode speed
let loopPaused = false
function stepScene(t, dt) {
  if (pilote.active || shots.active || cameraAuto.active || drone.active || tour.active || tween.active || (params.gpxFollow && gpxLayer.isPlaying())) updateCameraMotion(dt)
  if (!params.paused) {
    clouds.update(dt, params, camera, camNuagesBloc())
    traffic.update(dt)
  }
  camera.updateMatrixWorld()
  raceLabels.update() // cartouches Race Studio — projection écran chaque frame
}

initTips()

// first click pulls the export stack in (modal + Recorder + mediabunny) —
// bars.js shows a busy state on the button while the chunk downloads. Named
// so both the top-bar Export pill AND the "E" keyboard shortcut can open it.
// ═══════════ L'AFFICHE — VOIR AVANT DE PAYER ════════════════════════════════
//
// Adrien : « avant tout rendu, il faut une passe pour que l'utilisateur voie le
// poster qu'il va avoir ». L'écran vit dans ui/affiche.js ; ce qui suit lui
// fournit les deux seules choses qu'il ne peut pas connaître seul — un rendu au
// bon format, et le lieu qu'on regarde.
// ═══════ CADRER LE SOCLE ENTIER, PUIS OBÉIR AU RÉGLAGE ══════════════════════
//
// Adrien : « par défaut, la totalité du socle est visible sur l'affiche ». On
// ne réutilise donc PAS le cadrage de l'écran — on recule jusqu'à faire tenir la
// boîte du bloc, dans le ratio de l'affiche, en gardant la DIRECTION choisie par
// l'utilisateur. Ce qu'il a composé (l'angle, la hauteur de vue) est respecté ;
// seule la distance change.
//
// Rend un objet qui sait tout remettre en place : la caméra de la scène ne doit
// pas garder une trace de l'aperçu.
//
// `tuile` est le cadrage d'une tuile de tirage (`cadrageTuile`, print-page.js),
// ou `null` pour un rendu plein cadre — l'aperçu à l'écran. Il entre ICI, et
// nulle part ailleurs : c'est la seule façon de garantir qu'il se COMPOSE avec
// le cadrage de l'acheteur au lieu de l'écraser.
function cadrerAffiche(aspect, cadrage, pointNet = null, tuile = null) {
  const c = cadrageValide(cadrage || {})
  const sauve = {
    pos: camera.position.clone(),
    aspect: camera.aspect,
    zoom: camera.zoom,
    view: camera.view ? { ...camera.view } : null,
    autoFocus: params.autoFocus,
    focusDistance: params.focusDistance,
  }
  const restaurer = () => {
    camera.position.copy(sauve.pos)
    camera.aspect = sauve.aspect
    camera.zoom = sauve.zoom
    params.autoFocus = sauve.autoFocus
    params.focusDistance = sauve.focusDistance
    if (dof) poserMiseAuPoint(sauve.focusDistance, null)
    if (sauve.view?.enabled) {
      const v = sauve.view
      camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height)
    } else camera.clearViewOffset()
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true) // symétrique du cadrage — voir plus bas
  }

  const boite = new THREE.Box3()
  // Le SOCLE, c'est-à-dire les murs du bloc : leur boîte englobe déjà le relief,
  // qui vit dans la même emprise et sous le même sommet.
  if (plinth?.walls?.geometry) {
    plinth.walls.geometry.computeBoundingBox()
    boite.copy(plinth.walls.geometry.boundingBox).applyMatrix4(plinth.walls.matrixWorld)
  }
  if (boite.isEmpty()) return { restaurer }

  const centre = boite.getCenter(new THREE.Vector3())
  const cible = controls?.target ? controls.target.clone() : centre
  // La DIRECTION d'où l'on regarde est celle de l'utilisateur ; seule la
  // distance est recalculée.
  const dir = camera.position.clone().sub(cible).normalize()
  if (!Number.isFinite(dir.x) || dir.lengthSq() < 1e-9) dir.set(0.6, 0.5, 0.8).normalize()

  // Les huit coins, exprimés dans le repère de la caméra visant le centre : x à
  // droite, y en haut, z vers l'arrière. C'est ce que distanceCadrage attend.
  const avant = dir.clone().negate() // la caméra regarde vers -z
  const haut = new THREE.Vector3(0, 1, 0)
  const droite = new THREE.Vector3().crossVectors(avant, haut).normalize()
  if (droite.lengthSq() < 1e-9) droite.set(1, 0, 0)
  const vraiHaut = new THREE.Vector3().crossVectors(droite, avant).normalize()
  const coins = []
  const v = new THREE.Vector3()
  for (const x of [boite.min.x, boite.max.x]) {
    for (const y of [boite.min.y, boite.max.y]) {
      for (const z of [boite.min.z, boite.max.z]) {
        v.set(x, y, z).sub(centre)
        coins.push({ x: v.dot(droite), y: v.dot(vraiHaut), z: -v.dot(avant) })
      }
    }
  }

  camera.aspect = aspect
  // ⚠️ ON NE RECULE PAS TOUJOURS. Adrien, après la première version : « si
  // l'utilisateur n'a pas zoomé outre mesure, le socle doit être totalement
  // compris dans la proposition » — mais un gros plan délibéré doit être
  // respecté. distanceAffiche arbitre : au-delà de la moitié de la distance de
  // cadrage on se cale sur le socle entier, en deçà on garde sa composition.
  const dComplete = distanceCadrage(coins, (camera.fov * Math.PI) / 180, aspect)
  const dActuelle = camera.position.distanceTo(cible)
  const d = distanceAffiche(dActuelle, dComplete)
  camera.position.copy(centre).addScaledVector(dir, Math.max(1, d))
  camera.lookAt(centre)
  // ⚠️ LE ZOOM PASSE PAR camera.zoom, PAS PAR LA DISTANCE. Avancer la caméra
  // changerait la PERSPECTIVE — le bloc s'écraserait ou s'exagérerait selon le
  // réglage, et l'aperçu ne dirait plus la même chose que la vue d'origine.
  // `zoom` ne fait que resserrer le champ, ce que fait un objectif.
  camera.zoom = c.zoom
  // ⚠️ UN SEUL setViewOffset, JAMAIS DEUX. Le décalage de l'acheteur et celui
  // du pavage visent le même setteur, qui n'est pas cumulatif : appelés à la
  // suite, le second efface le premier et l'affiche part au tirage recentrée,
  // sans une ligne en console. On les compose donc AVANT (export-cadrage.js),
  // et on ne pose qu'un seul jeu d'arguments.
  //
  // ⚠️ Et setViewOffset REPOSE `camera.aspect` à fullWidth/fullHeight. Le cadre
  // que rend le module vaut donc exactement l'aspect demandé — c'est pour ça
  // qu'il n'arrondit plus sa hauteur (voir export-cadrage.js).
  const vue = composeDecalage({ x: c.x, y: c.y, aspect }, tuile)
  if (vue) {
    camera.setViewOffset(vue.fullWidth, vue.fullHeight, vue.offsetX, vue.offsetY, vue.width, vue.height)
  } else camera.clearViewOffset()
  camera.updateProjectionMatrix()
  // ⚠️ ET LES MATRICES DE MONDE AVEC, SINON LE CLIC DE VISÉE MENT. `lookAt` et
  // `position` n'écrivent QUE la position et le quaternion : `matrixWorld` — et
  // donc `matrixWorldInverse` — restent celles de la dernière image rendue,
  // c'est-à-dire celles de la caméra de la CARTE. Or c'est exactement ce que
  // lisent `Raycaster.setFromCamera` (origine du rayon) et `Vector3.project`.
  // Sans cette ligne, `viserPointNet` tire son rayon depuis la caméra d'écran
  // avec la projection de l'affiche : le point tombe à côté de ce qu'on a
  // désigné, d'autant plus loin que l'affiche a reculé pour cadrer le socle.
  // Vérifié dans le navigateur : déplacer `camera.position` ne bouge pas d'un
  // millimètre les trois derniers termes de `matrixWorld`.
  // Le rendu, lui, n'en avait pas besoin — `renderer.render` rafraîchit ces
  // matrices lui-même — ce qui est précisément pourquoi le défaut a pu vivre
  // jusqu'ici sans se voir sur une image.
  camera.updateMatrixWorld(true)

  // ═══ LE POINT DE NETTETÉ EST UN POINT DU MONDE, PAS UNE DISTANCE ═══════════
  //
  // ⚠️ ET C'EST TOUT LE PIÈGE DU BOKEH SUR L'AFFICHE. `params.focusDistance`
  // est une distance depuis la caméra ; or l'affiche DÉPLACE la caméra (elle
  // recule pour cadrer le socle). La distance mesurée à l'écran désignerait
  // donc un tout autre plan une fois l'affiche cadrée — le sommet net à
  // l'écran ressortirait flou sur le tirage.
  //
  // On mémorise donc le POINT visé, et on recalcule sa distance depuis la
  // caméra de l'affiche. Au passage, on coupe l'autofocus : il suit le
  // curseur, et sur cet écran le curseur est sur le rail.
  if (pointNet) {
    params.autoFocus = false
    // ⚠️ `pointNet` est un point du BLOC : sa distance est en unités de bloc, et
    // `params.focusDistance` se donne en MÈTRES (règle D20) — d'où `blocVersMetres`.
    params.focusDistance = blocVersMetres(camera.position.distanceTo(
      new THREE.Vector3(pointNet.x, pointNet.y, pointNet.z)
    ))
    if (dof) poserMiseAuPoint(params.focusDistance, null)
  }
  return { restaurer }
}

// ═══════════ L'ÉPAISSEUR DES TRAITS, LE TEMPS D'UN RENDU D'AFFICHE ══════════
//
// `cadrerAffiche` juste au-dessus règle tout ce qui passe par la matrice de
// projection. Les traits larges (`LineMaterial` : les fleuves, les contours de
// lac, le halo du tracé) n'y passent PAS — ils s'élargissent en espace clip,
// après la projection, à partir d'une `resolution` figée à la taille du tampon
// d'écran. Le décalage de tuile ne les corrige donc pas, et sans le geste
// ci-dessous une affiche sort en peigne : les segments horizontaux d'une
// épaisseur, les verticaux d'une autre. Le raisonnement complet, la formule de
// l'anisotropie et le plancher de 0,25 pt sont dans export-traits.js.
//
// ⚠️ ON TRAVERSE LA SCÈNE plutôt que d'énumérer trois matériaux connus : un
// quatrième calque à traits larges doit être pris en charge le jour où il
// arrive, pas le jour où quelqu'un remarque le peigne sur un tirage payé.
//
// ⚠️ RENDRE L'ÉTAT EST LA MOITIÉ DU TRAVAIL. L'appelant DOIT appeler
// `restaurer()` dans un `finally` : l'export dure une seconde, la carte que
// l'utilisateur regarde reste.
//
// @param {{w:number, h:number}} tuile - la taille RÉELLEMENT rendue (plafond
//   matériel compris : passer par `tailleSousPlafond` avant, pas la demande)
// @param {number} hauteurTotalePx - la hauteur de l'affiche ENTIÈRE ; pour un
//   aperçu plein cadre c'est celle de la tuile, pour un tirage pavé c'est celle
//   de l'image finie
// @param {number} [hauteurMm] - la hauteur physique du tirage, qui donne la
//   densité réelle et donc le plancher d'encre
function reglerTraitsAffiche({ tuile, hauteurTotalePx, hauteurMm = 0, dpi = 0 }) {
  return reglerTraits(materiauxDeLigne(scene), { tuile, hauteurTotalePx, hauteurMm, dpi })
}

/**
 * Où le relief est-il touché par un clic sur la feuille ?
 *
 * `u` et `v` sont les coordonnées normalisées de three (−1 à +1, y vers le
 * haut) DANS LE CADRE DE L'AFFICHE — pas dans la fenêtre. On cadre donc
 * l'affiche pour de vrai, on tire le rayon, puis on remet tout en place.
 */
function viserPointNet({ u, v, aspect, cadrage }) {
  const r = cadrerAffiche(aspect, cadrage)
  try {
    focusRay.setFromCamera(new THREE.Vector2(u, v), camera)
    const d = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, {
      halfExtent: TERRAIN_SIZE / 2,
    })
    if (d == null) return null // le ciel, ou hors du bloc : on garde l'ancien point
    const p = focusRay.ray.origin.clone().addScaledVector(focusRay.ray.direction, d)
    return { x: p.x, y: p.y, z: p.z }
  } finally {
    r.restaurer()
  }
}

/**
 * Le chemin INVERSE : où tombe un point de netteté déjà mémorisé, dans le cadre
 * de l'affiche telle qu'elle est composée maintenant ?
 *
 * ⚠️ C'EST LA QUESTION QUI MANQUAIT, ET TOUT LE DÉFAUT TIENT DEDANS. Le point
 * est un point du MONDE : il ne bouge pas quand on passe en portrait, alors que
 * le cadre, lui, est entièrement refait (`distanceCadrage` dépend de l'aspect,
 * la caméra recule, le décalage recoupe). Sa profondeur restait donc
 * parfaitement recalculée pendant qu'il sortait de la feuille — mise au point
 * juste, sur un sujet qu'on ne voit plus, et l'affiche entière floue.
 *
 * On passe par `cadrerAffiche`, LE MÊME cadrage que `viserPointNet` et que le
 * rendu : deux façons de cadrer finiraient par répondre deux choses.
 *
 * @returns {{u:number, v:number, devant:boolean}|null} - coordonnées
 *   normalisées de three dans le cadre de l'affiche, et de quel côté de
 *   l'objectif se trouve le point.
 */
function projeterPointNet({ point, aspect, cadrage }) {
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return null
  const r = cadrerAffiche(aspect, cadrage)
  try {
    const p = new THREE.Vector3(point.x, point.y, point.z)
    // ⚠️ LE CÔTÉ DE L'OBJECTIF SE MESURE AVANT DE PROJETER. Un point passé
    // DERRIÈRE la caméra se projette quand même, en miroir, avec des
    // coordonnées parfaitement plausibles : sans ce produit scalaire on le
    // croirait cadré. Le cas arrive pour de vrai — un gros plan délibéré peut
    // laisser la caméra en avant du point visé auparavant.
    const axe = camera.getWorldDirection(new THREE.Vector3())
    const devant = p.clone().sub(camera.position).dot(axe) > 0
    p.project(camera)
    return { u: p.x, v: p.y, devant }
  } finally {
    r.restaurer()
  }
}

// L'ÉTAT DE LA CARTE, ENCODÉ — le même que celui d'un lien de partage, et
// volontairement le même : c'est le seul format de ce projet qui sache
// reconstituer un lieu, un look et une pose de caméra, et il est déjà validé à
// la relecture (parseShareState). En fabriquer un second pour le paiement, ce
// serait deux formats à maintenir et un seul testé.
function etatCarteEncode() {
  const cam = {
    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
    tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
  }
  return encodeShareState(
    captureShareState(params, cam, BASE_TEMPLATE_LOOK, fenetreContinueActive() ? terrain.fenetre : null)
  )
}

async function openAfficheUI(etatInitial = null) {
  const { ouvrirAffiche } = await import('./ui/affiche.js')
  // `tailleSousPlafond` avec lui : l'épaisseur des traits se règle sur ce qui
  // est VRAIMENT peint, et le plafond matériel peut avoir raboté la demande.
  const { exportImage, tailleSousPlafond, supportNavigateur } = await import('./export.js')
  const {
    planComposition, supportAffiche, mentionsAffiche, attendrePolices,
    tailleValidation, composerValidation,
  } = await import('./compositeur-affiche.js')
  // L'EMBALLAGE. Il ne dessine rien : il dit à l'imprimeur ce que l'image EST
  // (les trois boîtes, l'intention de sortie, les métadonnées). Voir
  // src/pdf-affiche.js — et c'est lui qui impose le JPEG, pour la raison
  // mesurée rappelée dans `rendreTirage`.
  const {
    construirePdfAffiche, nomFichierAffiche, FORMAT_RECOMMANDE, QUALITE_JPEG_TIRAGE,
  } = await import('./pdf-affiche.js')
  const { sonderMateriel } = await import('./sonde-materielle.js')
  // Ce qu'on devra rendre en sortant : l'affiche emprunte des réglages de carte,
  // elle ne se les approprie pas.
  const lieuxAvant = params.placesEnabled
  // ⚠️ MÊME GEL QUE L'EXPORT, ET POUR LA MÊME RAISON : ce que l'aperçu montre
  // doit être ce qui partira au tirage. Élan éteint, débordement résorbé.
  f3Fige()

  // Le MÊME nom que celui gravé sur le flanc du bloc (groundInfo.info) : deux
  // sources donneraient deux noms pour un seul lieu.
  const lieuCourant = () => ({
    nom: groundInfo?.info?.name || '',
    lat: dem?.lat ?? NaN,
    lon: dem?.lon ?? NaN,
    altMax: Number.isFinite(dem?.maxM) ? dem.maxM : null,
  })

  // ═══════ LA LIGNE D'ATTRIBUTION DE CETTE AFFICHE-CI ════════════════════════
  //
  // ⚠️ OBLIGATION DE LICENCE, ET LE SEUL ENDROIT OÙ ELLE SE BRANCHE POUR
  // L'AFFICHE. `creditFor` existait depuis la bathymétrie côtière et personne
  // ne l'appelait sur ce chemin : export.js portait l'avertissement en rouge.
  // Vendre une image dont le fond marin vient d'une source à attribution
  // imposée, sans cette mention mot pour mot, est une violation — pas un oubli
  // d'ornement. `demBounds` et jamais `patchBounds` : l'emprise VRAIE du champ
  // exporté, donc jamais moins de sources que de données.
  const attributionAffiche = () => {
    try {
      return mentionsAffiche({
        bathyIndex: bathySourceIndex(),
        bounds: demBounds(terrain.dem),
        creditsForBounds,
      })
    } catch {
      // `mentionsAffiche` retombe déjà sur la ligne de base : ici on rattrape
      // seulement l'emprise illisible, et on ne rend JAMAIS `null` — une
      // affiche sans attribution ne doit pas pouvoir sortir d'ici.
      return mentionsAffiche({})
    }
  }

  // Tout ce que le compositeur doit dessiner, pour une surface donnée. Le MÊME
  // plan sert l'écran de validation et le fichier imprimé : c'est là que « ce
  // qu'il voit » et « ce qu'il reçoit » cessent de pouvoir diverger.
  //
  // Le ratio du logo vient de l'IMAGE décodée, pas de l'état : `height: auto`
  // du CSS ne se devine pas, il se mesure.
  const planAffiche = ({ largeur, hauteur, fondPerduPx, largeurMm, etat, logoImg }) =>
    planComposition({
      largeur,
      hauteur,
      fondPerduPx,
      largeurMm,
      cartouche: {
        actif: etat?.cartouche !== false,
        sombre: !!etat?.cartoucheSombre,
        titre: etat?.titre || '',
        lieu: lieuCourant(),
      },
      logo: etat?.logo && logoImg
        ? {
            taille: etat.logo.taille,
            coin: etat.logo.coin,
            ratio: (logoImg.naturalWidth || logoImg.width || 1) / (logoImg.naturalHeight || logoImg.height || 1),
          }
        : null,
      vignette: params.vignette,
      vignetteOffset: VIGNETTE_OFFSET,
      grain: params.grain,
      attribution: attributionAffiche(),
    })

  ouvrirAffiche({
    // La composition retrouvée après un aller-retour chez Stripe, s'il y en a
    // une. `null` le reste du temps : l'écran s'ouvre sur ses valeurs propres.
    etatInitial,
    // ═══════ LA SONDE — CE QUE CETTE MACHINE-CI PEUT VRAIMENT IMPRIMER ══════
    //
    // ⚠️ ON ALLOUE, ON NE CROIT PAS. `MAX_RENDERBUFFER_SIZE` est une promesse ;
    // un canevas 2D de 12 Mpx est refusé EN SILENCE sur iOS. Les deux défauts se
    // ressemblent : on obtient une image, et elle est fausse. La sonde alloue
    // donc pour de vrai une cible de tuile et un canevas de bande, et relit un
    // pixel de chacun — une image de retard à l'ouverture, contre un tirage
    // raté. Le raisonnement complet est dans src/sonde-materielle.js ; ici il
    // n'y a que le branchement sur le vrai renderer et le vrai document.
    sonder: () => sonderMateriel({
      gl: renderer.getContext(),
      memoireGo: navigator.deviceMemory,
      essaiCible: (cote) => {
        // Une cible de la taille d'une tuile, peinte puis RELUE. Le pilote qui
        // refuse ne lève rien : c'est le pixel qui le dit.
        const cible = new THREE.WebGLRenderTarget(cote, cote)
        const avant = renderer.getRenderTarget()
        // ⚠️ LA SONDE NE DOIT RIEN LAISSER DERRIÈRE ELLE. La couleur d'effacement
        // est un état global du renderer : la remettre à 0 « par défaut »
        // repeindrait le ciel de la scène en noir transparent au prochain rendu.
        const couleurAvant = new THREE.Color()
        renderer.getClearColor(couleurAvant)
        const alphaAvant = renderer.getClearAlpha()
        try {
          renderer.setRenderTarget(cible)
          renderer.setClearColor(0x336699, 1)
          renderer.clear(true, true, false)
          const px = new Uint8Array(4)
          renderer.readRenderTargetPixels(cible, cote - 1, cote - 1, 1, 1, px)
          // On ne compare pas à l'octet près : l'espace colorimétrique de la
          // cible n'est pas garanti. Ce qu'on exige, c'est qu'il se soit passé
          // QUELQUE CHOSE — un tampon incomplet rend du noir ou du vide.
          return px[0] + px[1] + px[2] > 0
        } finally {
          renderer.setRenderTarget(avant)
          renderer.setClearColor(couleurAvant, alphaAvant)
          cible.dispose()
        }
      },
      essaiToile: (largeur, hauteur) => {
        // Le canevas de bande, à la largeur qu'un vrai tirage demanderait. C'est
        // LUI que les appareils à mémoire courte refusent en silence.
        const c = document.createElement('canvas')
        c.width = largeur
        c.height = hauteur
        try {
          const g = c.getContext('2d', { alpha: false })
          if (!g) return false
          g.fillStyle = '#336699'
          g.fillRect(largeur - 2, hauteur - 2, 2, 2)
          const d = g.getImageData(largeur - 1, hauteur - 1, 1, 1).data
          return d[0] + d[1] + d[2] > 0
        } catch {
          return false
        } finally {
          // ⚠️ RAMENER À 1 × 1 LIBÈRE VRAIMENT LE TAMPON — même piège que la
          // toile de composition (export.js) : lâcher la référence ne suffit
          // pas, et une sonde qui laisse 65 Mo derrière elle est une sonde qui
          // fait échouer le tirage qu'elle vient d'autoriser.
          c.width = 1
          c.height = 1
        }
      },
    }),
    // Un VRAI rendu au ratio demandé, pas un recadrage de l'écran — c'est tout
    // l'intérêt de la passe. Sans crédit incrusté : la ligne d'attribution a sa
    // place sur l'affiche finale, pas en travers d'une vignette de choix.
    rendreApercu: async ({ largeur, hauteur, hauteurMm, cadrage, pointNet }) => {
      const rendu = cadrerAffiche(largeur / hauteur, cadrage, pointNet)
      // ⚠️ L'APERÇU MENTAIT DÉJÀ, ET C'EST LUI QU'ON REGARDE POUR DÉCIDER.
      // Sa `resolution` valait la taille de la FENÊTRE alors qu'il rend au
      // ratio de l'affiche : les fleuves y sortaient déjà anisotropes, et
      // toujours à leur épaisseur d'écran, jamais à celle du tirage. Le corriger
      // ici n'est pas une politesse : sans ça l'écran et le fichier
      // divergeraient, ce que tout ce chantier existe pour empêcher.
      //
      // La tuile de l'aperçu, c'est l'aperçu tout entier — d'où
      // `hauteurTotalePx = h`. `hauteurMm` vient de la géométrie de la page
      // (ui/affiche.js) : c'est elle qui donne la densité RÉELLE de cette
      // vignette, et donc le bon plancher d'encre.
      const [w, h] = tailleSousPlafond(renderer, largeur, hauteur)
      const traits = reglerTraitsAffiche({ tuile: { w, h }, hauteurTotalePx: h, hauteurMm })
      try {
        const blob = await exportImage({
          renderer, composer, camera,
          width: largeur, height: hauteur,
          format: 'image/jpeg', quality: 0.9,
          credit: null,
        })
        return URL.createObjectURL(blob)
      } finally {
        traits.restaurer()
        rendu.restaurer()
      }
    },
    // ═══════ LE TIRAGE : LA MÊME SCÈNE, MAIS PAVÉE ═════════════════════════
    //
    // L'aperçu au-dessus rend l'affiche EN UNE PASSE, à 1 100 px : c'est ce
    // qu'on regarde pour décider. Celui-ci rend la MÊME composition à sa taille
    // d'impression — jusqu'à 35,7 Mpx — en tuiles recollées bande par bande.
    // Tout ce qui les distingue est la taille et le pavage ; le cadrage, le
    // point de netteté et l'épaisseur des traits passent par exactement les
    // mêmes fonctions, ce qui est la seule façon que l'écran et le fichier ne
    // divergent pas.
    //
    // ═══ ET IL REND UN PDF, PAS UNE IMAGE JETÉE ════════════════════════════
    //
    // C'est le dernier maillon, et il a failli manquer : `src/pdf-affiche.js`
    // était du code mort — les bandes étaient encodées puis lâchées, et rien
    // n'emballait quoi que ce soit. Exactement la situation de `planTuiles`,
    // « qui a dormi trois mois dans son propre test ».
    //
    // ⚠️ ET LES BANDES SONT EN JPEG, PAS EN PNG. Ce n'est pas un arbitrage de
    // goût entre qualité et poids, c'est MESURÉ (tâche 9) : `pdf-lib` DÉCODE un
    // PNG et le recompresse SANS prédicteur de ligne — 3,30 Mo de PNG grainé
    // deviennent 4,25 Mo de PDF, et l'affiche entière est allouée en mémoire au
    // passage, juste après un pavage qui vient de passer onze secondes à ne
    // JAMAIS l'allouer. Un JPEG, lui, est RECOPIÉ TEL QUEL dans un flux
    // `DCTDecode` : le PDF pèse la somme des bandes plus ~6,4 ko.
    //
    // @param {[number,number]} totalPx - la taille à produire, fond perdu compris
    // @param {number} hauteurFiniePx - la hauteur APRÈS coupe
    // @param {number} hauteurMm - la même hauteur, en millimètres
    // @param {number} largeurMm - la largeur FINIE, en millimètres (densité du grain)
    // @param {number} fondPerduPx - le fond perdu, en pixels (repère du cartouche)
    // @param {object} etat - la composition : cartouche, titre, encre, logo
    rendreTirage: async ({
      totalPx, hauteurFiniePx, hauteurMm, largeurMm, fondPerduPx = 0, dpi,
      cadrage, pointNet, etat, surBande, onProgress, annule,
    }) => {
      const { exporteAffichePavee } = await import('./export.js')
      const aspect = totalPx[0] / totalPx[1]
      // ═══ CE QUI N'EST PAS LA CARTE — NEUTRALISÉ ICI, RÉAPPLIQUÉ LÀ-BAS ═══
      //
      // Le pavage rend la carte NUE : le cartouche et le logo sont du DOM
      // empilé sur l'aperçu, et `exportImage` ne lit que le canevas WebGL.
      // C'est le compositeur qui les incruste, en même temps qu'il remet le
      // vignettage et le grain qu'on éteint juste en dessous — et qu'il pose
      // l'attribution, sans laquelle l'affiche ne peut pas être vendue.
      const logoImg = await chargerLogoAffiche(etat?.logo?.url)
      const plan = planAffiche({
        largeur: totalPx[0], hauteur: totalPx[1], fondPerduPx, largeurMm, etat, logoImg,
      })
      // ⚠️ AVANT LA PREMIÈRE BANDE, PAS À CHAQUE LIGNE. Un canevas ne rerend
      // pas quand une fonte arrive : il a déjà peint. Sans cette attente, les
      // premières bandes sortiraient en police de repli et les dernières non.
      await attendrePolices(plan)
      const restaurerEffets = neutraliserEffetsAffiche()
      let degeler = null
      // ⚠️ LES OCTETS DES BANDES SONT GARDÉS, ET C'EST UN CHANGEMENT ASSUMÉ.
      // Jusqu'ici l'écran d'affiche fournissait `surBande` uniquement pour dire
      // à l'orchestrateur de LÂCHER les blobs — douze bandes d'A2 en PNG, c'est
      // l'image pleine sous une autre forme. Mais un PDF ne s'écrit pas au fil :
      // `pdf-lib` a besoin de toutes ses images avant `save()`. On garde donc,
      // et ce qu'on garde a changé de nature : ce ne sont plus 89 Mo de PNG mais
      // la somme des JPEG, c'est-à-dire le poids du PDF lui-même. Les blobs,
      // eux, sont toujours lâchés par l'orchestrateur (on lui fournit bien un
      // `surBande`), et les tableaux d'octets sont libérés dès l'emballage fait.
      const bandesPdf = []
      let pave = null
      try {
        pave = await exporteAffichePavee({
          renderer, composer, camera,
          totalPx, dpi,
          // ⚠️ LE FORMAT DES BANDES EST CELUI QUE LE PDF SAIT RECOPIER. Voir
          // l'encadré ⑥ de pdf-affiche.js : un PNG serait décodé puis
          // recompressé sans prédicteur, donc plus lourd que le PNG d'origine.
          format: FORMAT_RECOMMANDE,
          quality: QUALITE_JPEG_TIRAGE,
          // Le classement des effets a besoin de savoir ce qui est ALLUMÉ : la
          // marge de recouvrement dépend du bokeh, et la liste à neutraliser du
          // vignettage et du grain. Voir export-effets.js.
          effets: {
            smaaActif: true,
            bokehActif: !!(params.bokehEnabled && params.bokehScale > 0),
            bokehScale: params.bokehScale,
            // ⚠️ L'ÉTAT VIVANT DES EFFETS, PAS `params` — ET C'EST UN TIRAGE RÉEL
            // QUI L'A MONTRÉ. En lisant `params`, le plan d'effets voyait le
            // vignettage allumé alors qu'il venait d'être éteint deux lignes plus
            // haut, et criait « l'affiche sortira en damier » sur une affiche
            // parfaitement recollée. Un avertissement qui se déclenche à tort est
            // un avertissement qu'on apprend à ignorer — c'est-à-dire un
            // avertissement perdu. Lu ici, il redevient la bonne question :
            // « au moment de paver, reste-t-il un effet allumé qui dépende de la
            // position dans la cible ? » Il rougira le jour où quelqu'un retirera
            // `neutraliserEffetsAffiche`. Ce que le COMPOSITEUR réapplique vient,
            // lui, de `params`, lu AVANT la neutralisation (voir planAffiche).
            vignette: vignette.darkness,
            grain: grain.blendMode.opacity.value,
            occlusionActive: !!params.ssaoEnabled,
          },
          // ⚠️ UN SEUL INSTANT DE CARTE, PAS DOUZE. Entre deux tuiles il y a des
          // `await` ; une reconstruction de calque qui y atterrirait mettrait
          // dans la moitié basse de l'affiche des rivières que la moitié haute
          // n'a pas. On pose donc la fenêtre et on laisse les calques en cours
          // se terminer AVANT la première tuile.
          // ⚠️ ET LE GEL SE POSE APRÈS LA MISE AU REPOS, JAMAIS AVANT : posé
          // avant, il refuserait la reconstruction qui EST la mise au repos, et
          // on tirerait la carte telle qu'elle était au clic. `rebuildMapLayers`
          // attend désormais les quatre calques de texture, pas seulement les
          // routes : c'est ce qui rend cette attente vraie.
          avantTirage: async () => {
            f3Fige()
            await rebuildMapLayers()
            degeler = figerPourTirage()
          },
          // ⚠️ RAPPELÉ À CHAQUE TUILE, ET RESTAURÉ À CHAQUE TUILE. C'est
          // l'arbitrage de la réserve nº 2 de la tâche 5 : plutôt que de geler
          // les reconstructions — ce qui demanderait à export.js de connaître six
          // entrées du pipeline de données et laisserait quand même passer ce qui
          // est déjà en vol — on referme le cycle sur chaque tuile. Un matériau
          // né en route est repris au tour suivant, avec sa référence d'écran
          // intacte ; un matériau déjà réglé n'est jamais réglé deux fois.
          preparerTuile: ({ cadrage: fenetre, largeur: w, hauteur: h }) => {
            const rendu = cadrerAffiche(aspect, cadrage, pointNet, fenetre)
            // Le fond de scène est tranché comme la caméra l'est : sans ça,
            // chaque tuile reçoit le dégradé entier. Voir `cadrerFondPourTuile`.
            const fond = cadrerFondPourTuile(fenetre)
            // ⚠️ LA HAUTEUR DE RÉFÉRENCE EST CELLE DU FORMAT FINI, pas celle du
            // rendu avec fond perdu : c'est la convention d'appel de
            // `reglerTraits` (export-traits.js), et c'est à elle seule que
            // l'aperçu et le tirage donnent la même épaisseur sur le papier. Les
            // apparier autrement décale tout de 0,86 % sur un 50 × 70.
            const traits = reglerTraitsAffiche({ tuile: { w, h }, hauteurTotalePx: hauteurFiniePx, hauteurMm, dpi })
            return { restaurer() { fond?.restaurer(); traits.restaurer(); rendu.restaurer() } }
          },
          // ⚠️ LE COMPOSITEUR ENTRE PAR LA TOILE, PAS PAR L'ORCHESTRATEUR. Le
          // pavage a une preuve pixel par pixel à tenir : on ne lui ajoute pas un
          // « et dessine aussi le cartouche ». Son support est injectable — c'est
          // ce qui rend sa preuve rejouable — et on lui donne donc la même toile,
          // augmentée d'un passage avant l'encodage de chaque bande.
          support: supportAffiche({ plan, logo: logoImg, base: supportNavigateur() }),
          // ⚠️ ON PREND LA BANDE POUR LA CONVERTIR TOUT DE SUITE, ET POUR QUE
          // L'ORCHESTRATEUR LA LÂCHE. `arrayBuffer()` copie les octets encodés
          // (quelques mégaoctets par bande en JPEG) ; le blob, lui, est
          // relâché — c'est la raison d'être de ce rappel côté export.js.
          surBande: async (b) => {
            if (b?.blob) {
              bandesPdf.push({
                octets: new Uint8Array(await b.blob.arrayBuffer()),
                type: b.blob.type || FORMAT_RECOMMANDE,
                hauteurPx: b.hauteur,
              })
            }
            await surBande?.(b)
          },
          onProgress, annule,
        })
      } finally {
        // ⚠️ DANS CET ORDRE. Le dégel relance la boucle d'images ; si les effets
        // n'étaient pas encore remis, la première image d'après montrerait une
        // carte sans vignettage ni grain — un clignotement à chaque tirage.
        restaurerEffets()
        degeler?.()
      }

      // ═══ L'EMBALLAGE — HORS DU GEL, ET C'EST VOLONTAIRE ══════════════════
      //
      // La carte est peinte : l'emballage ne la regarde plus. Le faire dans le
      // `try` ci-dessus tiendrait la scène figée et les effets éteints pendant
      // la seconde que coûte l'écriture du PDF, pour rien — et un échec de
      // `pdf-lib` laisserait la carte gelée si le `finally` avait été mal écrit.
      if (annule?.()) throw new Error('Rendu annulé')
      const emballage = await construirePdfAffiche({
        // ⚠️ LE FORMAT FINI, PAS L'IMAGE. `largeurMm`/`hauteurMm` sont les
        // dimensions APRÈS coupe ; le fond perdu que les bandes portent en plus
        // est posé par `placerBandes` dans le BleedBox. Passer ici la taille
        // avec fond perdu vendrait un 51,2 × 71,2 sans que personne ne le voie.
        //
        // ⚠️ NI `reperes` NI `margeMediaMm` NE SONT PASSÉS, ET C'EST VOULU. Les
        // traits de coupe sont le DÉFAUT de `pdf-affiche.js` : le fichier est
        // téléchargé, nous ne savons pas s'il finira chez un prestataire qui
        // travaille aux boîtes ou chez un imprimeur qui cale sa lame à la main,
        // et l'asymétrie des deux erreurs tranche (encadré ② du module). La
        // boîte support s'en déduit — 520 × 720 mm sur un 50 × 70, et chacun de
        // ces dix millimètres porte un repère. L'acheteur n'a rien à décider :
        // une case à cocher qu'il ne peut pas juger serait pire que le défaut.
        largeurMm, hauteurMm,
        bandes: bandesPdf,
        titre: `${(etat?.titre || lieuCourant().nom || 'Affiche').trim()} — ShibuMap`,
        auteur: 'ShibuMap',
        producteur: 'ShibuMap',
        outil: 'ShibuMap — affiche d’impression',
      })
      // Les octets des bandes ont été recopiés dans le document : les garder une
      // seconde fois doublerait le pic mémoire de l'emballage pour rien.
      bandesPdf.length = 0
      const blob = new Blob([emballage.octets], { type: 'application/pdf' })
      return {
        ...pave,
        pdf: {
          blob,
          octets: blob.size,
          nom: nomFichierAffiche({
            titre: etat?.titre || lieuCourant().nom,
            format: etat?.format,
            orientation: etat?.orientation,
            dpi,
          }),
          boites: emballage.boites,
          conformite: emballage.conformite,
        },
      }
    },
    // ═══════ L'ÉCRAN DE VALIDATION — CELUI QUI DÉCIDE DE TOUT ══════════════
    //
    // ⚠️ CET ÉCRAN-LÀ N'EST PAS PRODUIT PAR LE DOM, ET C'EST LA DÉCISION
    // D'ARCHITECTURE LA PLUS IMPORTANTE DU CHANTIER.
    //
    // `rendreApercu` ci-dessus sert l'ÉDITION : on y tire l'image au pouce, on
    // change de format, on tape un titre — trente rendus par minute, où la
    // fluidité du DOM est exactement ce qu'il faut. Mais devant le bouton de
    // paiement, la question change : l'acheteur ne choisit plus, il VALIDE.
    //
    // S'il valide une maquette DOM, l'écart avec le fichier se combat sans fin
    // — une police qui ne tombe pas pareil, un interlettrage qu'un canevas
    // n'applique pas, un dégradé aux mauvais arrêts — et chaque écart restant
    // se découvre après un tirage payé. S'il valide une image produite PAR LE
    // COMPOSITEUR, il valide le fichier : même code, mêmes fractions, même
    // dégradé, à un facteur d'échelle près. L'écart ne se minimise pas, IL
    // CESSE D'EXISTER PAR CONSTRUCTION.
    //
    // D'où le contrat, symétrique de celui du tirage : on rend la carte NUE
    // (vignettage et grain éteints, comme pour le pavage), et le compositeur
    // remet tout — sinon l'acheteur validerait une affiche deux fois vignettée
    // et recevrait un fichier qui ne l'est qu'une fois, c'est-à-dire très
    // exactement l'écart qu'on prétend supprimer.
    //
    // ⚠️ IL MONTRE LE FORMAT FINI, PAS LE FICHIER : le fond perdu part au
    // massicot, le lui montrer serait lui faire valider 6 mm qu'il ne verra
    // jamais.
    //
    // Rien ne l'appelle encore : c'est la tâche 8 qui possède le moment
    // « rendre avant d'encaisser ». Le chemin de production, lui, existe.
    rendreValidation: async ({ finiPx, largeurMm, hauteurMm, cadrage, pointNet, etat }) => {
      const t = tailleValidation(finiPx)
      const rendu = cadrerAffiche(t.largeur / t.hauteur, cadrage, pointNet)
      const [w, h] = tailleSousPlafond(renderer, t.largeur, t.hauteur)
      const traits = reglerTraitsAffiche({ tuile: { w, h }, hauteurTotalePx: h, hauteurMm })
      const restaurerEffets = neutraliserEffetsAffiche()
      // Le même gel que le tirage, et pour la même raison en plus petit : ce que
      // l'acheteur valide doit être l'instant du tirage, pas l'instant d'après.
      const degeler = figerPourTirage()
      let bmp = null
      try {
        const carte = await exportImage({
          renderer, composer, camera,
          width: t.largeur, height: t.hauteur,
          format: 'image/png',
          // pas de crédit ici : c'est le compositeur qui pose l'attribution,
          // au même endroit et de la même encre que sur le fichier imprimé
          credit: null,
        })
        bmp = await createImageBitmap(carte)
        const logoImg = await chargerLogoAffiche(etat?.logo?.url)
        // fond perdu nul : l'écran de validation EST le format fini
        const plan = planAffiche({
          largeur: t.largeur, hauteur: t.hauteur, fondPerduPx: 0, largeurMm, etat, logoImg,
        })
        const toile = document.createElement('canvas')
        toile.width = t.largeur
        toile.height = t.hauteur
        await composerValidation({ image: bmp, toile, plan, logo: logoImg })
        const blob = await new Promise((res, rej) =>
          toile.toBlob((b) => (b ? res(b) : rej(new Error('Canvas capture failed'))), 'image/png')
        )
        return URL.createObjectURL(blob)
      } finally {
        bmp?.close?.()
        traits.restaurer()
        rendu.restaurer()
        restaurerEffets()
        degeler()
      }
    },
    lieu: lieuCourant,
    // ── L'ALLER : on quitte l'application pour la page de paiement Stripe ──
    //
    // ⚠️ AUCUN PRIX NE PART D'ICI. On n'envoie qu'un IDENTIFIANT d'article ; le
    // prix, le libellé et la TVA vivent dans le catalogue serveur, hors de
    // portée du navigateur. Voir netlify/functions/_paiement-catalogue.mjs.
    onCommander: async (commande) => {
      const article = identifiantArticle(commande)
      if (!article) {
        // Ne JAMAIS ouvrir une session pour un article qu'on ne sait pas
        // nommer : la caisse la refuserait, mais l'acheteur aurait déjà vu la
        // page de paiement s'ouvrir puis échouer.
        showNotice('Ce format ne se commande pas encore. Écris à adrien@adrienagency.com.')
        return
      }

      // ── Le contournement d'atelier (Alt + clic) ────────────────────────
      // ⚠️ LE CODE N'EST NI DANS CE FICHIER, NI DANS LE BUNDLE, NI DANS LE
      // STOCKAGE DU NAVIGATEUR. Il est SAISI à la demande et vérifié côté
      // serveur contre `SHIBU_CODE_ATELIER` — voir netlify/functions/
      // paiement.mjs. Ce qui suit ne sait pas si le code est bon, et c'est
      // exactement ce qu'on veut : un contournement que le client peut
      // trancher n'en est pas un.
      let code = ''
      if (commande.atelier) {
        code = String(window.prompt('Code d’atelier (vérifié côté serveur) :') || '').trim()
        if (!code) return // demi-tour : on ne lance rien
      }

      // ⚠️ LE PANIER SE DÉPOSE AVANT DE PARTIR, PAS APRÈS. Une fois
      // `location.assign` appelé, plus une ligne de ce fichier ne s'exécute :
      // le document est en train d'être remplacé. Écrire le panier après,
      // c'est ne jamais l'écrire.
      //
      // ⚠️ LIMITE CONNUE, ÉCRITE ICI PLUTÔT QUE REDÉCOUVERTE : LE PANIER EST UN
      // EMPLACEMENT UNIQUE. Commander une SECONDE affiche avant d'avoir cliqué
      // « Télécharger » sur la première écrase la clé de celle-ci — le fichier
      // payé reste au coffre mais plus rien ne l'y retrouve, et il part à la
      // purge des 24 h. Le courriel de confirmation rattrape ce cas (c'est
      // exactement ce pour quoi il existe). Le vrai remède n'est pas une garde
      // de plus ici : c'est que la livraison due cesse de dépendre d'une clé de
      // session. Voir « le corollaire » dans critiques-rapport.md — la piste
      // retenue est de marquer la FICHE du coffre comme due, ce qui la rend
      // retrouvable sans clé, et même après fermeture de l'onglet.
      const id = identifiantPanier()
      poserPanier({ id, article, carte: etatCarteEncode(), affiche: afficheSerialisable(commande) })

      // ═══ ET LE FICHIER SE MET AU COFFRE, POUR LA MÊME RAISON ═════════════
      //
      // ⚠️ C'EST LA RÉSERVE Nº 1 DE LA TÂCHE 8, ET ELLE SE RÈGLE ICI. Partir
      // chez Stripe est une NAVIGATION : le document est détruit, et le PDF
      // qu'on vient de mettre onze secondes à produire meurt avec lui. Rendre
      // avant d'encaisser prouvait que cette machine SAIT le produire ; ce
      // dépôt-là est ce qui met le fichier EN SÉCURITÉ.
      //
      // L'arbitrage entre les trois voies possibles (nouvel onglet, refaire au
      // retour, persister) est écrit en tête de src/coffre-affiche.js. En deux
      // mots : le nouvel onglet est bloqué parce que l'activation de
      // l'utilisateur est consommée depuis onze secondes, et refaire au retour
      // livrerait une AUTRE affiche — le logo importé ne traverse pas la
      // navigation.
      //
      // ⚠️ ATTENDU, PAS LANCÉ. Une transaction IndexedDB non validée est
      // abandonnée avec le document : ne pas attendre ce dépôt, c'est ne pas le
      // faire. Et il ne peut pas échouer bruyamment — un stockage refusé fait
      // perdre le fichier, jamais la vente.
      if (commande.pdf?.blob) {
        const { deposer } = await import('./coffre-affiche.js')
        await deposer({
          id,
          blob: commande.pdf.blob,
          nom: commande.pdf.nom,
          octets: commande.pdf.octets,
          format: commande.format,
          orientation: commande.orientation,
          dpi: commande.geo?.dpi,
        })
      }

      const r = await demanderCaisse({ article, retour: id, code })
      if (!r.ok) {
        // On reste à l'écran : le panier n'a plus de raison d'être, la
        // composition est toujours sous les yeux de l'utilisateur. Et le PDF
        // déposé quelques lignes plus haut s'en va avec lui — sans cela, une
        // caisse en panne laisserait plusieurs mégaoctets dans le navigateur
        // pour vingt-quatre heures, sans plus aucune clé pour les ressortir.
        await jeterDuCoffre(id)
        viderPanier()
        console.warn('[affiche] caisse :', r.erreur)
        showNotice(
          r.erreur === 'code refusé'
            ? 'Code d’atelier refusé.'
            : 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant — rien n’a été débité.'
        )
        return
      }
      location.assign(r.url)
      // « parti » : l'écran d'affiche laisse son bouton désactivé plutôt que de
      // le réarmer pendant que le navigateur quitte la page (un second clic
      // ouvrirait une seconde session de paiement).
      return 'parti'
    },
    // Les noms de villes : l'affiche peut les couper sans couper la carte
    // qu'Adrien avait composée. On mémorise l'état d'avant et on le rend en
    // sortant — l'écran d'affiche propose une VARIANTE, il ne mute pas le look.
    // Le bokeh : actif ou non, et où l'on vise. Voir viserPointNet.
    bokehActif: () => !!(params.bokehEnabled && params.bokehScale > 0),
    viserPointNet,
    // Et où tombe le point qu'on a déjà : c'est ce qui permet à l'écran de
    // s'apercevoir qu'un changement de sens vient de le mettre hors cadre.
    projeterPointNet,
    lieuxAffiches: () => params.placesEnabled,
    setLieuxAffiches: (v) => {
      params.placesEnabled = !!v
      rebuildMapLayers()
    },
    onFermer: () => {
      if (params.placesEnabled !== lieuxAvant) {
        params.placesEnabled = lieuxAvant
        rebuildMapLayers()
      }
      refreshAll()
    },
  })
}

// ── LE RETOUR : ce qu'on montre à quelqu'un qui revient de chez Stripe ──────
//
// ⚠️ ON NE CROIT PAS `?paye=`. C'est un paramètre d'URL : il se tape à la main,
// se copie, se partage, se recharge. Il dit seulement QUOI DEMANDER au serveur.
// La réponse vient de netlify/functions/paiement-etat.mjs, qui a la clé secrète
// et interroge Stripe — et qui, en cas de panne, rend « indisponible » plutôt
// que « payé » : une coupure réseau ne doit jamais fabriquer une confirmation.
//
// ⚠️ ET AUCUN MESSAGE NE PROMET UN TÉLÉCHARGEMENT. La chaîne PDF n'existe pas
// encore. C'était déjà la doctrine du code qu'on remplace ici (« on le DIT
// plutôt que d'afficher une fausse confirmation ») ; elle vaut d'autant plus
// maintenant que l'argent est réellement encaissé. Voir messageRetour().
// ── LE COFFRE : SORTIR CE QU'ON Y AVAIT MIS ────────────────────────────────
//
// ⚠️ AUCUNE DE CES DEUX FONCTIONS NE DOIT POUVOIR CASSER LE RETOUR. Quelqu'un
// qui revient d'un paiement réussi doit voir sa confirmation même si le stockage
// de son navigateur est en vrac : on perd alors le téléchargement immédiat, pas
// la confirmation — et le message de retour dit déjà qu'Adrien envoie le fichier
// par mail.
async function sortirDuCoffre(id) {
  if (!id) return null
  try {
    const { retirer } = await import('./coffre-affiche.js')
    return await retirer(id)
  } catch (err) {
    console.warn('[ShibuMap] coffre : indisponible au retour —', err?.message || err)
    return null
  }
}

/**
 * Jette une entrée du coffre, sans jamais se plaindre.
 *
 * ⚠️ APPELÉ SUR LES ABANDONS, ET C'EST UNE CORRECTION. Un demi-tour chez Stripe
 * — ou une caisse qui refuse de s'ouvrir — laissait le PDF déposé juste avant
 * dormir vingt-quatre heures dans le navigateur : plusieurs mégaoctets, et un
 * lieu, pour une vente qui n'a pas eu lieu.
 *
 * ⚠️ ET JAMAIS SUR UN DOUTE. On ne l'appelle pas quand le serveur a dit « payé » :
 * un coffre qui refuse une lecture rend `null` exactement comme un coffre vide,
 * et un fichier payé ne s'efface pas sur une ambiguïté.
 */
async function jeterDuCoffre(id) {
  if (!id) return
  try {
    const { jeter } = await import('./coffre-affiche.js')
    await jeter(id)
  } catch { /* une entrée qui survit sera purgée par sa date */ }
}

/**
 * Met le fichier à portée de clic, et ne l'efface qu'une fois pris.
 *
 * ⚠️ UN CLIC, PAS UN TÉLÉCHARGEMENT AUTOMATIQUE. Une écriture de fichier
 * déclenchée sans geste, au retour d'une navigation externe, est exactement ce
 * que les navigateurs bloquent — et quand ils ne la bloquent pas, elle passe
 * inaperçue : le fichier atterrit dans un dossier sans que l'acheteur sache
 * qu'il l'a. La carte reste à l'écran tant qu'il n'a pas cliqué.
 *
 * ⚠️ ET L'EFFACEMENT VIENT APRÈS LE CLIC. Jeter l'entrée en la sortant, ce
 * serait la jeter avant de savoir si le téléchargement a abouti.
 */
function proposerLeFichier(garde) {
  const url = URL.createObjectURL(garde.blob)
  showLivraison({
    texte: 'Ton fichier d’impression est prêt.',
    detail: [garde.nom, garde.octets ? `${(garde.octets / 1e6).toFixed(1).replace('.', ',')} Mo` : '']
      .filter(Boolean).join(' · '),
    nom: garde.nom,
    url,
    onPris: async () => {
      await jeterDuCoffre(garde.id)
      // ⚠️ ET C'EST ICI, PAS À L'ENTRÉE DU RETOUR, QUE LE PANIER S'EN VA. Il se
      // vidait avant même de savoir ce que le serveur répondrait : la clé qui
      // ramène au fichier était détruite AVANT que le fichier soit pris. Un
      // rechargement, un onglet fermé une seconde, un clic manqué, et le PDF
      // payé devenait inatteignable jusqu'à la purge des 24 h. Le fichier est
      // pris : il n'y a plus rien à rejouer, la clé peut partir.
      viderPanier()
      // L'URL d'objet survit au document : sans ceci, les octets du PDF restent
      // vivants jusqu'au rechargement de la page.
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    },
  })
}

async function reprendreApresPaiement() {
  const { cas, session } = RETOUR_PAIEMENT
  if (!cas) return
  const panier = PANIER_RESTAURE
  // ⚠️ LE PANIER NE SE VIDE PLUS ICI. Il se vidait à l'entrée de cette
  // fonction, AVANT de connaître l'issue : la seule clé qui ramène au fichier
  // payé était donc détruite avant qu'on sache s'il restait quelque chose à
  // livrer. Chaque sortie ci-dessous décide elle-même — soit elle arme une
  // reprise (`armerReprise`), soit elle vide.

  if (cas === 'annule') {
    // Demi-tour chez Stripe : rien n'est dû, et le PDF déposé avant de partir
    // n'a plus aucune raison d'occuper le navigateur pendant vingt-quatre heures.
    //
    // ⚠️ SAUF SI UNE REPRISE EST ARMÉE. L'URL a la priorité sur le panier (voir
    // `retourAReprendre`), donc un retour arrière dans l'historique vers cette
    // adresse-ci peut très bien arriver APRÈS un paiement confirmé. Jeter ici
    // sans regarder, c'est effacer la marchandise de quelqu'un qui a payé sur
    // un simple paramètre d'URL. `fichierJetable` porte la règle.
    if (fichierJetable(panier)) await jeterDuCoffre(panier.id)
    viderPanier()
    showNotice('Paiement annulé — rien n’a été débité. Ta composition est intacte.')
    await openAfficheUI(panier?.affiche || null)
    return
  }

  // `invalide` : un `?paye=` qui ne ressemble même pas à un identifiant Stripe.
  // On n'interroge personne, et on ne confirme rien.
  const { etat } = cas === 'paye' ? await verifierPaiement(session) : { etat: 'inconnue' }
  // ═══ LE FICHIER QU'ON AVAIT MIS DE CÔTÉ AVANT DE PARTIR ═══════════════════
  //
  // ⚠️ ON NE LE SORT QUE SI LE SERVEUR A DIT « PAYÉ ». Le coffre contient un
  // fichier produit AVANT le paiement : le lire sans avoir vérifié l'état
  // reviendrait à livrer une affiche à qui a fait demi-tour chez Stripe.
  // `verifierPaiement` est la seule source qui fasse foi (elle a la clé
  // secrète) ; `?paye=` ne sert qu'à savoir quoi lui demander.
  const paye = etat === 'paye' || etat === 'livree'
  const garde = paye ? await sortirDuCoffre(panier?.id) : null

  // ═══ CE QUI RESTE DÛ SURVIT AU RECHARGEMENT ═══════════════════════════════
  //
  // ⚠️ LA LIVRAISON N'AVAIT QU'UN SEUL COUP, et c'est ce qui se répare ici. Le
  // fichier est à l'écran mais pas encore pris ? La banque n'a pas tranché
  // (virement, prélèvement) ? Le serveur est injoignable ? Alors la clé du
  // panier reste, avec la session à revérifier : le prochain chargement de cet
  // onglet rejoue exactement ce retour-ci, sans `?paye=` dans la barre
  // d'adresse — et en redemandant au serveur, jamais en croyant le stockage.
  //
  // ⚠️ ET ON NE JETTE LE FICHIER QUE QUAND RIEN N'A ÉTÉ PAYÉ — deux fois plutôt
  // qu'une. Sur `paye` sans fichier en main, le coffre a pu simplement refuser
  // une lecture : on vide la clé (il n'y a rien à rejouer, c'est le mail qui
  // prend le relais) mais on ne détruit pas un fichier payé sur un doute. Et
  // `fichierJetable` ajoute la garde que le seul `!paye` ne donnait pas : un
  // `?paye=` malformé rend `invalide`, donc `etat = 'inconnue'`, donc `!paye` —
  // alors qu'une reprise armée sur ce panier prouve un paiement déjà confirmé.
  if (livraisonEnSuspens(etat, { fichierPret: !!garde })) {
    armerReprise(session)
  } else {
    if (!paye && fichierJetable(panier)) await jeterDuCoffre(panier.id)
    viderPanier()
  }

  showNotice(messageRetour(etat, { fichierPret: !!garde }), { duration: 9000 })
  if (garde) proposerLeFichier(garde)
  // Un paiement abouti ne rouvre PAS l'écran d'affiche : son bouton inviterait
  // à payer une seconde fois la même affiche. La carte, elle, est restaurée —
  // c'est ce qu'on veut retrouver. Dans tous les autres cas (en attente,
  // expirée, injoignable), l'écran se rouvre pour pouvoir relancer.
  if (etat !== 'paye' && etat !== 'livree' && panier?.affiche) await openAfficheUI(panier.affiche)
}

// ═══════════════════════════════════════════════════════════════════════════
// LE COMPTE — et la porte à l'export
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ SHIBUMAP RESTE ENTIÈREMENT UTILISABLE SANS COMPTE. `race.mjs` l'écrit en
// tête (« public and unauthenticated by design ») ; ici cela veut dire que la
// porte ci-dessous n'a AUCUN pouvoir de retenue : `onSuite` — l'export réel —
// part dans les deux branches, et si `porteExport` disparaissait, les trois
// exports fonctionneraient exactement comme avant.
//
// ⚠️ CETTE LIGNE NE COÛTE RIEN AU DÉMARRAGE. `creerCompteApp` relit une session
// éventuelle dans `localStorage` (une lecture synchrone, sous try/catch) et
// n'émet AUCUNE requête : la configuration des comptes ne part que si quelqu'un
// ouvre la connexion (voir `configuration()` dans src/compte.js). Pour un
// visiteur qui n'a pas de compte — l'immense majorité — rien ne change, pas une
// requête de plus, pas un pixel de différent.
const compte = creerCompteApp()

// L'ÉTAT DE LA SESSION, LISIBLE DEPUIS LA FEUILLE DE STYLE.
// ⚠️ AUCUNE RÈGLE NE S'EN SERT PLUS AUJOURD'HUI, et c'est une bonne nouvelle :
// elle armait la reprise du rail droit dans compte.css, du temps où « Mes
// cartes » n'existait que pour une session ouverte. Le panneau — devenu « Mes
// créations » — est là dans les deux états, la reprise n'a donc plus de
// condition à vérifier. La classe reste posée parce qu'elle ne coûte rien et
// qu'elle est la seule trace de la session dans le document : c'est par elle
// qu'on stylera le jour où un écran devra se distinguer connecté.
const majCorpsCompte = () => {
  document.body.classList.toggle('ce-connecte', !!compte.estConnecte?.())
}
majCorpsCompte()
compte.surChangement?.(majCorpsCompte)

// ⚠️ LA PORTE SE POSE SUR L'EXPORT, PAS SUR LA BOÎTE QUI LE PRÉPARE.
// Elle enveloppait `openExportUI` — c'est-à-dire l'OUVERTURE de la boîte de
// dialogue. Vu à l'écran : on répondait « Continuer sans compte », la boîte
// s'ouvrait ENSUITE en demandant encore le format, le ratio et la taille, et
// « Ton export est en route » s'affichait par-dessus. Trois conséquences, toutes
// constatées : le message mentait ; on demandait un compte avant même de savoir
// ce que la personne voulait exporter ; et une boîte annulée après coup avait
// CONSOMMÉ la question (`porteRepondue`), qui n'était donc jamais reposée au
// vrai moment.
// Elle est désormais posée par `export-modal.js` à l'instant où l'export part
// pour de bon — image téléchargée, ou enregistrement démarré — et la boîte est
// alors refermée : l'avis ne recouvre plus rien, et il dit vrai.
// `onSuite` n'a plus rien à déclencher : le fichier est déjà parti. La porte
// informe, elle n'a jamais rien retenu — c'est toujours la même règle.
function porteApresExport() {
  porteExport(compte, {
    onEnregistrerGabarit: telechargerGabaritCourant,
  })
}

async function openExportUI() {
  const [{ openExportModal }, { Recorder }] = await Promise.all([
    import('./ui/export-modal.js'),
    import('./export-recorder.js'),
  ])
  // composer + camera : l'enregistreur en a besoin pour la taille forcée (2K,
  // 4K…), qui redimensionne la chaîne de rendu le temps de la capture
  if (!recorder) recorder = new Recorder({ renderer, composer, camera })
  // ⚠️ LE DÉFILEMENT SE FIGE À L'OUVERTURE, pas au déclenchement. Le voile du
  // panneau interdit déjà tout geste sur le terrain : à partir d'ici, rien ne
  // peut plus bouger, donc ce qu'on voit derrière le panneau est EXACTEMENT ce
  // qui partira dans le fichier — élan éteint, débordement résorbé, maillage
  // fin. Le faire au clic sur « Export » aurait fait bouger l'image entre le
  // moment où l'utilisateur la juge et celui où on la capture.
  f3Fige()
  openExportModal({
    renderer,
    composer,
    camera,
    recorder,
    // LA PORTE, AU MOMENT OÙ L'EXPORT PART VRAIMENT — voir `porteApresExport`.
    apresExport: porteApresExport,
    // LA LIGNE DE CRÉDITS DE CET EXPORT-CI. Elle dépend de l'emprise, parce que
    // les sources bathymétriques fines imposent leur attribution mot pour mot
    // là où elles ont creusé, et nulle part ailleurs. Voir export.js.
    creditLine: () => {
      try {
        // demBounds, jamais patchBounds : c'est l'emprise VRAIE du champ
        // exporté (voir son commentaire dans map/aerial-layer.js). En mode
        // continu elle couvre les neuf dalles — c'est ce qui est chargé, donc
        // ce qui doit être crédité : jamais moins de sources que de données.
        return creditFor(bathySourceIndex(), demBounds(terrain.dem), creditsForBounds)
      } catch {
        return null // jamais bloquer un export sur un crédit : export.js a sa ligne de repli
      }
    },
    pauseLoop: () => {
      // Rendu HORS LIGNE : `f3Tick` ne tourne plus (il n'est appelé que depuis
      // `tick()`), donc l'élan et la butée gèleraient tels quels pour tout le
      // clip. On part d'un état posé plutôt que d'un instantané de geste.
      f3Fige()
      loopPaused = true
      // kill the already-scheduled frame too, or a synchronous export
      // failure would leave two rAF chains running after resume
      cancelAnimationFrame(rafId)
      clearTimeout(tickTimer)
    },
    resumeLoop: () => {
      loopPaused = false
      clock.getDelta() // swallow the paused span so dt doesn't jump
      tick()
    },
    step: stepScene,
  })
}

// keyboard-shortcuts help overlay — built once, toggled by the top-bar
// keyboard icon, the "?" shortcut, and (closing only) Escape/backdrop-click.
// Reads the SHORTCUTS registry live, so a future entry there needs no
// changes here.
const shortcutsOverlay = buildShortcutsOverlay()

// "What's new" changelog — opened from the ALPHA chip in the top bar
const changelogOverlay = buildChangelogOverlay()

// ------------------------------------------------------------------ share link
// Builds a URL that reproduces the current look + location + camera pose
// (encoding lives in share-link.js). GPX is deliberately never included — a
// track can be megabytes and would blow any URL budget, so a link made while
// one is loaded says so explicitly (see the toast in bars.js) rather than
// silently dropping it.
// Le serveur (race.mjs) n'accepte que png/jpeg/webp/gif ≤ 2 M chars — un logo
// SVG (le cas classique pour une marque) faisait 422 et coulait TOUTE la
// publication (« la course n'a pas pu être publiée »). Ici : formats valides
// passent tels quels, tout le reste est rastérisé en PNG 512 px ; en échec on
// rend null — la course part SANS logo plutôt que pas du tout.
async function logoForPublish(src) {
  if (!src || typeof src !== 'string') return null
  if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(src) && src.length <= 2_000_000) return src
  try {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src })
    const w = img.naturalWidth || 512
    const h = img.naturalHeight || 512
    const sc = Math.min(1, 512 / Math.max(w, h))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * sc))
    c.height = Math.max(1, Math.round(h * sc))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const out = c.toDataURL('image/png')
    return out.length <= 2_000_000 ? out : null
  } catch { return null }
}

async function shareCurrentView() {
  const cam = {
    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
    tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
  }
  // ⚠️ LA POSITION DANS L'EMPRISE VOYAGE AVEC. En mode continu, `loc` ne dit
  // que quel BLOC est chargé : la fenêtre se promène de ±56 unités dedans, soit
  // ±21 km à z12. Sans ce quatrième argument, on envoyait le destinataire au
  // centre du bloc — jusqu'à 30 km à côté de ce qu'on avait sous les yeux.
  // Hors mode continu on passe `null` et le payload sort inchangé.
  const state = captureShareState(params, cam, BASE_TEMPLATE_LOOK, fenetreContinueActive() ? terrain.fenetre : null)
  const hasTrack = !!gpxLayer.track

  // On PUBLIE TOUJOURS (Netlify Blobs via netlify/functions/race.mjs) pour
  // rendre un lien /r/<id> court — avec ou sans course.
  //
  // Seule une carte AVEC trace publiait ; les autres tombaient sur le lien
  // #s=, qui encode tout l'état dans le fragment et pèse ~2 900 caractères.
  // Un tel lien se fait couper par la plupart des messageries, se casse quand
  // un client mail le replie sur deux lignes, donne un QR code illisible, et
  // — parce qu'un fragment n'est JAMAIS envoyé au serveur — n'affiche aucun
  // aperçu là où on le colle. D'où « je n'ai aucun moyen de la partager »
  // (Adrien) alors que l'entrée de menu existait : elle rendait un lien
  // techniquement valide et pratiquement inutilisable.
  //
  // Un échec de publication dégrade HONNÊTEMENT vers #s= : long, mais il
  // marche. Avec une course chargée en revanche, l'échec reste dur (plus bas)
  // — un lien qui perdrait le parcours serait pire que pas de lien.
  let url = null
  let published = false
  let failDetail = ''
  {
    // Tentative 1 : course complète (logo rastérisé si besoin). Tentative 2 :
    // SANS logo — si c'est lui que le serveur refuse (422), la course part
    // quand même ; un échec transitoire (réseau, cold start) est absorbé au
    // passage. L'ancien repli silencieux vers #s= donnait « la carte aux
    // bonnes couleurs mais sans le parcours » — le pire des partages.
    const safeLogo = await logoForPublish(raceState.logo)
    const race = raceState.name || raceState.waypoints.length
      ? {
          name: raceState.name,
          logo: null, // le logo voyage dans SON champ validé, jamais ici
          waypoints: raceState.waypoints.map(({ km, name, alt, pictos, cutoff }) => ({ km, name, alt, pictos, cutoff })),
          transports: { removed: [...raceState.transports.removed] },
        }
      : null
    // Le corps est le même qu'on crée ou qu'on corrige — d'où cette forme
    // partagée, montée une fois puis passée aux deux chemins.
    const corps = (logo) => ({
      // null quand il n'y a pas de course : le serveur accepte une
      // carte nue, il n'exige un GPX valide que s'il y en a un
      gpx: hasTrack ? trackToGpx(gpxLayer.track) : null,
      state,
      // sans course, c'est le LIEU qui nomme l'aperçu du lien
      raceName: raceState.name || gpxLayer.raceName || (hasTrack ? '' : params.demLocation || ''),
      race,
      logo,
    })

    // CORRIGER PLUTÔT QUE RECOPIER. Si cette session vient d'un lien /r/<id>
    // et que ce navigateur détient le jeton de cet id, on réécrit CE blob :
    // le lien déjà diffusé aux inscrits montre la nouvelle version, au lieu
    // qu'un second identifiant naisse et laisse les porteurs du premier sur
    // l'ancien parcours (les tracés de trail bougent — le GPX de référence du
    // projet porte « Due to Path Damage Beatenberg »).
    //
    // Un échec ici n'est PAS fatal : on retombe sur une publication normale,
    // qui rend au moins un lien qui marche. L'ancien reste alors périmé, ce
    // qui est exactement la situation d'avant.
    const jeton = restoredRaceId ? recallRaceSecret(restoredRaceId) : null
    if (jeton) {
      const maj = await updateRace(restoredRaceId, jeton, corps(safeLogo))
      if (maj.ok) {
        url = `${location.origin}/r/${restoredRaceId}`
        published = true
      } else {
        failDetail = maj.error
        console.warn(`race update failed (${failDetail}), publishing a new id instead`)
      }
    }

    for (const withLogo of [true, false]) {
      if (published) break
      try {
        const res = await fetch(RACE_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // raceName rides along so the link can carry a real preview card —
          // a fragment (#r=) never reaches a crawler, so the /r/<id> route is
          // the only thing that can name the course on WhatsApp or Instagram.
          // `race` + `logo` : la COURSE COMPLÈTE (points de passage,
          // transports retirés, logo) — sans eux la shibu reçue n'avait que
          // la ligne nue, aucun cartouche (« le parcours ne s'affiche pas »).
          body: JSON.stringify(corps(withLogo ? safeLogo : null)),
        })
        const j = res.ok ? await res.json() : null
        if (j?.ok && typeof j.id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(j.id)) {
          // LE JETON D'ÉDITION N'EST RENDU QU'ICI, une seule fois : le serveur
          // n'en garde qu'un sha256 et ne peut plus le redire. Non conservé,
          // il est perdu — et avec lui la seule façon de corriger ce lien
          // sans compte. Un stockage en panne rend false : le partage
          // continue, seule la correction ultérieure est perdue.
          rememberRaceSecret(j.id, j.secret)
          // ce lien devient celui que cette session corrigera la prochaine fois
          restoredRaceId = j.id
          // The PATH form, not #r= — see netlify/functions/share.mjs. It serves
          // the preview tags and then forwards to the app's own #r= link, so
          // nothing downstream changes except that pasted links now unfurl.
          url = `${location.origin}/r/${j.id}`
          published = true
        } else if (!res.ok) {
          let msg = ''
          try { msg = JSON.parse(await res.text())?.error || '' } catch {}
          failDetail = `HTTP ${res.status}${msg ? ` — ${msg}` : ''}`
          console.warn(`race publish failed (${failDetail}), withLogo=${withLogo}`)
        }
      } catch (err) {
        failDetail = err?.message || 'réseau'
        console.warn(`race publish failed (${failDetail}), withLogo=${withLogo}`)
      }
    }
  }
  // ⚠️ ET LA LISTE « MES CARTES » SE RECHARGE ICI, SUR LE SUCCÈS.
  // C'est le seul endroit du produit où une carte NAÎT côté serveur. Sans cette
  // ligne, le panneau ne se rechargeait qu'au changement de session : un
  // organisateur qui publiait puis ouvrait « Mes créations » y lisait toujours
  // « Tu n'as pas encore publié de carte ». On ne l'attend pas — le partage ne
  // doit pas dépendre d'une liste, et un refus de liste se lit déjà comme une
  // liste vide (voir ui/compte.js).
  if (published) rechargerMesCartes?.()

  // ÉCHEC DUR (Adrien) : une course chargée + publication impossible ⇒ ON NE
  // COPIE RIEN. Le détail (statut HTTP/erreur serveur) remonte dans le toast
  // pour qu'un échec persistant soit diagnosticable, pas juste « réessayez ».
  if (hasTrack && !published) return { ok: false, publishFailed: true, failDetail }
  if (!url) url = `${location.origin}${location.pathname}#s=${encodeShareState(state)}`
  const note = hasTrack && !published ? ' — your GPX track isn’t included' : ''

  // Feuille de partage OS : MOBILE UNIQUEMENT. Sur desktop Windows/macOS,
  // navigator.share existe aussi — le bouton « Copier le lien » ouvrait la
  // feuille Windows au lieu de copier, et la fermer ne copiait RIEN (bug
  // Adrien « ça ne copie rien »). Desktop = presse-papier direct.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile && navigator.share) {
    try {
      await navigator.share({ title: 'ShibuMap', text: `Ma carte ShibuMap${note}`, url })
      return { ok: true, shared: true, hasTrack, published }
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, cancelled: true } // user dismissed the OS share sheet
      // any other share-sheet failure falls through to the clipboard below
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return { ok: true, copied: true, hasTrack, published }
  } catch {
    // presse-papier refusé (document plus focus, permission…) — on REND le
    // lien : bars.js ouvre alors une petite boîte avec le lien sélectionnable
    return { ok: false, url, hasTrack, published }
  }
}

// Ouvrir « Mes créations » — posé plus bas, avec le panneau lui-même (la barre
// naît avant lui). Déclaré ici pour qu'on le voie depuis la closure qui le lit.
let ouvrirMesCreations = null

const topBar = buildTopBar({
  params,
  setDarkMode: (v) => {
    setDarkMode(v)
    refreshAll()
  },
  // the Globe button always shows the WHOLE planet, spinning slowly
  //
  // ⚠️ ET IL REND D'ABORD CE QUE LE CADRAGE DU DAMIER AVAIT EMPRUNTÉ. C'est la
  // porte par laquelle le défaut est arrivé : `modes.enterOrbit` SAUVE
  // `camera.near` dans `_surfCam` (modes.js) et le REPOSE au retour de plongée,
  // pendant que `maxDistance` retombe, lui, à 150. Parti avec le near desserré
  // du cadrage (≈ 122 sur un 3×3), on revient donc avec une caméra à ~145
  // unités derrière un plan de coupe à 122 : toute la moitié proche de la carte
  // est tranchée, et rien dans la vue orbitale ne laisse deviner pourquoi.
  enterOrbit: () => { quitteCadrageDamier(); cameraAuto.stop(); modes.enterOrbit(16000000) },
  // the "?" button replays the guided tour (lazy-loaded, tiny)
  startTutorial: async () => {
    const { startTutorial } = await import('./ui/tutorial.js')
    startTutorial()
  },
  // ⚠️ PLUS DE PORTE ICI : elle est posée sur le déclenchement RÉEL de
  // l'export (voir `porteApresExport`), pas sur l'ouverture de la boîte.
  openExport: () => openExportUI(),
  // ⚠️ ET L'AFFICHE N'EN A PLUS DU TOUT — C'EST UNE DÉCISION, PAS UN OUBLI.
  // Son « export » réel, c'est un ACHAT : on rend le fichier, on le met au
  // coffre, on quitte la page pour Stripe, on revient, et le PDF se prend dans
  // une carte de livraison posée sur le MÊME plancher que l'avis du compte.
  // Poser la porte avant la caisse interromprait un paiement ; la poser après
  // empilerait deux cartes au même endroit. On ne met pas de porte dans une
  // caisse : l'affiche reste sans compte, comme le reste du produit.
  openAffiche: () => openAfficheUI(),
  // "?" keyboard-shortcuts help — self-updating overlay, reads SHORTCUTS live
  toggleShortcuts: () => shortcutsOverlay.toggle(),
  // ALPHA chip → "What's new" changelog
  appStage: APP_STAGE,
  toggleChangelog: () => changelogOverlay.toggle(),
  share: shareCurrentView,
  // menu Publier (P4) — closures paresseuses : studio/gpxLayer lus au clic
  hasCourse: () => !!gpxLayer.activeLayer?.gpx?.track,
  openStudioExport: () => studio.enterExport(),
  openSettings: () => panelCtx.openSettings?.(), // roue crantée (paramètres globaux)
  // LA PASTILLE DU COMPTE, dans la pill de droite. Elle a besoin de la session
  // (pour son anneau et sa coche) et d'une destination une fois connecté :
  // « Mes créations », qui héberge désormais les actions du compte.
  // ⚠️ CLOSURE PARESSEUSE POUR LA DESTINATION : le panneau se construit bien
  // plus bas dans ce module, la barre bien plus haut. Lue au clic, la fonction
  // est là ; copiée ici, elle vaudrait `undefined` pour toujours.
  compte,
  ouvrirMesCreations: () => ouvrirMesCreations?.(),
  // annuler / rétablir au clic — mêmes portes que Ctrl+Z, flush compris
  undo: undoNow,
  redo: redoNow,
})

// les deux boutons d'historique suivent la pile. On les cale AUSSI tout de
// suite : History a déjà notifié son état de naissance quand la barre n'existait
// pas encore, et sans ce rattrapage ils resteraient éteints jusqu'à la première
// bascule — donc allumés trop tard après un lien partagé qui a déjà tout posé.
onHistoryChange = (s) => topBar.setHistoryState(s)
onHistoryChange({ canUndo: history.canUndo(), canRedo: history.canRedo() })

const bottomBar = buildBottomBar({
  goto: gotoCtl,
  openGpx: () => gpxFileInput.click(),
})

// mode simple par défaut (UX P3) : docks masqués, quickbar bottom-center.
// Jamais en embed — la vitrine reste nue quoi qu'il arrive. (IS_EMBED, pas
// EMBED : ce dernier n'est déclaré que plus bas — TDZ.)
if (!IS_EMBED) {
  initUiLevel()
  initRails() // chevrons de repli par rail (mode avancé), état persisté
}
// viewer shibu (lien partagé) : marque en bas + CTA — le reste du chrome
// est masqué en CSS (body.shibu-view, voir v28.css)
if (IS_SHIBU) buildShibuChrome()
// cœur du mode simple — monté dans la rangée liquide de l'elembar plus bas
// (buildElemBar simpleCore) pour le morph de fond au switch Avancé
const quickCore = IS_EMBED ? null : buildQuickCore({
  openAtelier: () => panelCtx.openAtelier?.(),
  openStudio: () => panelCtx.openStudio?.(),
  // « Explorer » du mode simple choisit AUSSI le mode de travail : sans cela,
  // une session quittée en Studio laissait le panneau Explorer éteint
  // (wm-off) — le dock s'ouvrait sur du vide. elemBar est construit
  // plus bas ; l'appel, lui, n'a lieu qu'au clic.
  setWorkMode: (id) => elemBar?.setMode(id),
})

// the GPX profile strip docks at the same bottom-centre spot as the search
// bar — measure the bar's REAL rendered rect (its height changes across the
// pointer:coarse/touch breakpoint, see v28.css) and push the profile's
// `bottom` up above it with a fixed gap, so the two can never overlap
// (a z-index bump alone would leave them stacked, not "remonté")
// ⚠️ la mesure est RÉANCRÉE sur la rangée liquide (.ce-lqrow) depuis la fusion
// des deux barres : elle englobe la capsule des modes ET le cartouche du bas.
// Mesurer la seule barre de recherche poserait le profil sur la capsule.
// La rangée n'existe pas encore au premier appel (elembar se construit plus
// bas) — repli sur la barre seule, puis rappel après la construction.
function syncGpxProfilePosition() {
  const host = document.querySelector('.ce-lqrow') || bottomBar.root
  const r = host.getBoundingClientRect()
  // barre masquée (viewer shibu, noui, boutique…) : son rect est tout à zéro
  // — publier ces mesures donnerait un profil de largeur 0 « posé » au-dessus
  // de l'écran. On efface plutôt les variables : les fallbacks CSS de
  // .gpx-profile (bottom 82px, width min(520px, 100vw − 32px)) reprennent la
  // main, et le viewer shibu mobile les ajuste lui-même (v28.css).
  if (!r.width) {
    document.documentElement.style.removeProperty('--gpx-profile-bottom')
    document.documentElement.style.removeProperty('--gpx-profile-width')
    return
  }
  const gap = 14
  const bottomPx = Math.round(window.innerHeight - r.top + gap)
  document.documentElement.style.setProperty('--gpx-profile-bottom', `${bottomPx}px`)
  // le profil GPX s'adapte à la largeur RENDUE de la barre de recherche
  // (retour Adrien) — mesure runtime, robuste aux breakpoints/paddings
  document.documentElement.style.setProperty('--gpx-profile-width', `${Math.round(r.width)}px`)
}
syncGpxProfilePosition()

// bottom-left: studio credit + every required attribution (OSM/GeoNames), one
// line/one corner/one size. refreshOsmCredit() (above) appends GeoNames +
// loading status live via credits.setExtra().
const credits = buildCredits()

// bottom-right: one click to the isometric museum view — whole block, plate
// and cartouche in frame (45° azimuth, museum-shelf elevation)
// distance ×2 vs the first guess: at fov 30 the block's corner-on diagonal
// (~79 units) needs ~107 units of camera range for plate + cartouche to fit
// Vues cycliques du bouton iso (Adrien) : quatre angles isométriques (rotation
// 90° entre chacun), puis un top-down orienté nord, puis une vue au raz du sol,
// puis retour au premier. Un petit numéro sur l'icône indique la vue courante.
const ISO_TARGET = new THREE.Vector3(0, -1.5, 0)
const ISO_VIEWS = [
  { name: '1', dir: new THREE.Vector3(62, 52, 62), k: 0.97, target: ISO_TARGET },
  { name: '2', dir: new THREE.Vector3(-62, 52, 62), k: 0.97, target: ISO_TARGET },
  { name: '3', dir: new THREE.Vector3(-62, 52, -62), k: 0.97, target: ISO_TARGET },
  { name: '4', dir: new THREE.Vector3(62, 52, -62), k: 0.97, target: ISO_TARGET },
  // Vue du dessus TOUJOURS ORIENTÉE NORD (nouvelle règle d'Adrien). Le biais
  // porté par TOP_DOWN_DIR est la règle elle-même : mesuré, l'ancien (0,100,-0.6)
  // cadrait le SUD en haut — 180° d'erreur, malgré le commentaire d'origine.
  // Voir camera-shots.js pour le pourquoi du signe et pourquoi on ne touche pas
  // à `up`. Le cadrage ne dépend que de la pose d'arrivée, donc il est le même
  // depuis les six autres vues.
  { name: '5', dir: new THREE.Vector3(TOP_DOWN_DIR.x, TOP_DOWN_DIR.y, TOP_DOWN_DIR.z), k: 0.92, target: ISO_TARGET },
  { name: '6', dir: new THREE.Vector3(0.28, 0.17, 1), k: 0.52, target: new THREE.Vector3(0, 1.4, 0) }, // au raz du sol
]
let isoIndex = -1
// vole (rotation orbitale) vers la vue iso i ; met à jour le badge de l'icône
function applyIsoView(i) {
  if (modes.mode !== 'surface' || modes.busy) return
  // toute vue iso classique rend d'abord la butée empruntée par le cadrage du
  // damier — sinon `dist` resterait mesurée contre un `maxDistance` desserré et
  // la porte orbitale ne s'ouvrirait plus jamais (voir quitteCadrageDamier).
  quitteCadrageDamier()
  tour.active = false
  isoIndex = ((i % ISO_VIEWS.length) + ISO_VIEWS.length) % ISO_VIEWS.length
  const v = ISO_VIEWS[isoIndex]
  const dist = controls.maxDistance * v.k
  const pos = v.target.clone().addScaledVector(v.dir.clone().normalize(), dist)
  flyTo(pos, v.target.clone(), { orbit: true })
  isoBtn?.setBadge(v.name)
}

// ═══════════════════════════════════════════════════════════════════════════
// LE BOUTON CAMÉRA CADRE TOUT LE DAMIER — sans changer de zoom géographique
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien : « Le bouton caméra en vue multi-cases permettra de voir toutes les
// cases à la fois en isométrique sans passer au zoom inférieur. Et on reviendra
// au mode précédent si une seule case est affichée. Si dans ce mode de vue,
// l'utilisateur continue de dézoomer, alors on dézoome vraiment. »
//
// Les trois RÈGLES vivent dans `src/vue-ensemble.js` (pur, testé) ; ici il n'y a
// que la plomberie three.js qu'un module pur ne peut pas faire.
//
// ⚠️ AUCUNE LIGNE DE CE BLOC NE TOUCHE À `params.demZoom`, ni n'appelle
// `loadRealTerrain`, `stepZoom` ou `pasEscalier` : c'est ÇA, « sans passer au
// zoom inférieur ». Un cran d'escalier rechargerait les neuf dalles à une autre
// résolution — le relief perdrait sa finesse et tout le chargement déjà payé
// partirait à la poubelle.
const MARGE_CADRAGE_DAMIER = 1.1 // le damier respire un peu dans le cadre
// Ce qu'on doit rendre à la caméra en sortant. `null` = pas de cadrage en cours.
let cadrageDamier = null
let cumulDezoomDamier = 0
let dernierCranDamier = 0
let cleCadrageDamier = ''

// ⚠️ `empriseVivante()`, JAMAIS `carreCourant()` — même règle que la mer et le
// cartouche : la première dit ce qui est POSÉ (jusqu'à 5×5 en zone isolée), la
// seconde ce que le tracé a RÉCLAMÉ (plafonné à 3×3).
function carrePourCamera() {
  return blockGrid?.empriseVivante?.() ?? { i0: 0, j0: 0, cote: 1 }
}

function modeBoutonCamera() {
  return modeCameraDamier(carrePourCamera(), { continu: fenetreContinueActive() && dem?.empriseCote > 1 })
}

// Recule la caméra jusqu'à voir les N×N cases, en isométrie vraie.
function cadreLeDamier() {
  if (modes.mode !== 'surface' || modes.busy) return false
  const carre = carrePourCamera()
  const pose = poseDamier(
    { zoom: params.demZoom, cote: carre.cote, i0: carre.i0, j0: carre.j0, taille: TERRAIN_SIZE },
    { fovDeg: camera.fov, marge: MARGE_CADRAGE_DAMIER }
  )
  if (!pose) return false
  // ⚠️ IL FAUT DESSERRER `maxDistance` ET LE COUPLE near/far, SINON RIEN NE SE
  // VOIT. Un 3×3 de 56 unités demande ~490 unités de recul à fov 30 ; le socle
  // de la vue iso s'arrête à 150 (`controls.update()` re-clampe à chaque image)
  // et la caméra porte far = 290 (le damier serait purement et simplement
  // découpé). On relève AUSSI `near` : à 490 unités avec near = 0,5, la
  // précision du tampon de profondeur tombe à ~0,03 unité, du même ordre que
  // les 0,06 qui séparent les plans gravés du flanc — les textes se mettraient
  // à clignoter. `near = distance/4` la ramène à ~1e-4, et rien n'est jamais
  // plus près que ça (le coin le plus proche du damier est à distance − rayon).
  cadrageDamier ??= { maxDistance: controls.maxDistance, near: camera.near, far: camera.far }
  controls.maxDistance = Math.max(cadrageDamier.maxDistance, pose.distance / 0.97)
  camera.near = Math.max(cadrageDamier.near, pose.distance * 0.25)
  camera.far = Math.max(cadrageDamier.far, pose.distance * 2)
  camera.updateProjectionMatrix()
  cumulDezoomDamier = 0
  dernierCranDamier = performance.now()
  cleCadrageDamier = cleDuCarre(carre)
  flyTo(
    new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z),
    new THREE.Vector3(pose.cible.x, pose.cible.y, pose.cible.z),
    { orbit: true }
  )
  isoBtn?.setBadge(`${carre.cote}×${carre.cote}`)
  return true
}

// Rend à la caméra ce qu'on lui avait emprunté. Appelée AVANT de laisser
// l'escalier de zoom (ou la porte orbitale) reprendre la main : `modes.js` lit
// `controls.maxDistance` pour savoir s'il est en butée, et il doit lire la
// vraie, pas celle du cadrage.
function quitteCadrageDamier() {
  if (!cadrageDamier) return false
  controls.maxDistance = cadrageDamier.maxDistance
  camera.near = cadrageDamier.near
  camera.far = cadrageDamier.far
  camera.updateProjectionMatrix()
  cadrageDamier = null
  cumulDezoomDamier = 0
  cleCadrageDamier = ''
  isoBtn?.setBadge(isoIndex >= 0 ? ISO_VIEWS[isoIndex].name : '')
  return true
}

// LA MOLETTE PENDANT LE CADRAGE. Rendre `true` avale le cran.
//
// ⚠️ UN CRAN VERS L'INTÉRIEUR SORT TOUT DE SUITE, sans seuil : vouloir
// s'approcher, c'est avoir fini de regarder l'ensemble — et surtout, le glissé
// inertiel de modes.js passerait sinon sous le `near` desserré ci-dessus et
// ferait disparaître le décor.
function molettePendantCadrageDamier(deltaY) {
  if (!cadrageDamier) return false
  if (!(deltaY > 0)) {
    quitteCadrageDamier()
    return false // le cran d'approche suit son chemin normal
  }
  const now = performance.now()
  cumulDezoomDamier = cumuleDezoom(cumulDezoomDamier, deltaY, now - dernierCranDamier)
  dernierCranDamier = now
  if (!doitVraimentDezoomer({ mode: 'ensemble', cumul: cumulDezoomDamier })) return true // cran mou : avalé
  quitteCadrageDamier()
  return false // l'utilisateur insiste : on dézoome VRAIMENT (escalier / orbite)
}
// Bouton cinéma — MÊME MÉCANIQUE QUE LE BOUTON ISO (Adrien) : chaque clic passe
// au plan suivant, et un petit numéro apparaît au-dessus.
//
// Il remplace l'ancien interrupteur, qui tirait un mouvement au hasard parmi les
// six oscillations de camera-automation.js et le relançait toutes les 18 s.
// Adrien : « je veux de VRAIS mouvements de caméra […] pas des mouvements
// basiques comme on a jusqu'à présent ». Les sept crans (poursuite au ras du
// sol, travelling, dolly zoom, survol, contre-plongée, orbite sur sommet, série
// aléatoire) vivent dans camera-shots.js ; le huitième clic arrête tout.
// ⛔ **SOUS `?terre=unique`, CE BOUTON EST ÉTEINT — Tâche R1 ②, tour 2.** Il
// plonge la caméra sous le sol du crop et **aucune des deux sorties ne rend la
// vue** : la mesure, les captures et la cause sont au §3 de
// `monde/visibilite-surface.js`, qui décide de sa visibilité. Ne le rallume pas
// sans avoir d'abord donné aux plans un `sampleGround` de GLOBE — c'est
// `terrain.sample`, le champ de hauteurs du bloc PLAT, qui les envoie là.
//
// ⛔ **ET NE RÉÉCRIS PAS QU'IL EST « RÉVERSIBLE »** : le premier tour de cette
// tâche l'a écrit sur la foi d'un relevé qui ne s'est pas reproduit. Deux
// exécutions, deux sorties, aucune ne rendant la vue.
cineBtn = buildCineButton({
  next: () => {
    if (modes.mode !== 'surface' || modes.busy) return
    // ⚠️ MÊME GESTE QU'`applyIsoView` : un plan de cinéma passe au ras du sol
    // (poursuite, travelling, contre-plongée) et partirait avec le `near`
    // desserré du cadrage du damier — ≈ 122 unités, c'est-à-dire tout le décor
    // découpé devant la caméra pendant toute la durée du plan.
    quitteCadrageDamier()
    shots.next()
  },
})

// 💤 LE BOUTON DE LA CAMÉRA PILOTE VIVAIT ICI — retiré le 2026-08-02 (Adrien :
// « mode avion et hélicoptère, ça ne marche pas bien. On retire le bouton. On
// garde le code de côté ! »). Le mode d'emploi complet du réveil est en tête de
// la place laissée vacante dans src/ui/bars.js.
//
// ⚠️ `pilote` (PiloteCam) EST TOUJOURS CONSTRUIT ET MIS À JOUR PAR IMAGE, juste
// au-dessus : il porte `lancerPoursuite`, `cancel`, `update`, `poursuite` et
// `posePoursuite`, tous consommés ailleurs (flyTrack, suivi GPX, reprise en main
// des contrôles, changement de terrain). Ce n'est pas du code mort, c'est du
// code dont une seule porte d'entrée a été fermée. Il reste joignable par
// `__exp.pilote.next()` dans la console et par les scripts de tournage.

isoBtn = buildIsoButton({
  // DEUX COMPORTEMENTS, ET C'EST LE DAMIER QUI TRANCHE (Adrien) :
  //  — plusieurs cases posées → le bouton cadre L'ENSEMBLE en isométrie, sans
  //    toucher au zoom géographique ;
  //  — une seule case → il retrouve son comportement d'avant, au bit près :
  //    chaque clic passe à la vue suivante (rotation orbitale).
  flyIso: () => {
    if (modeBoutonCamera() === 'ensemble' && cadreLeDamier()) return
    applyIsoView(isoIndex + 1) // …qui rend d'abord la butée empruntée par le cadrage
  },
})

// bottom-left cartography corner (Adrien) : aerial toggle · base · shuffle
//
// ⚠️ **SOUS `?terre=unique`, CE COIN N'AGIT QU'À MOITIÉ, ET C'EST MESURÉ —
// Tâche R1 ②.** La Tâche R1 a rendu ces boutons visibles (ils avaient disparu),
// mais visible n'est pas branché. Relevé à l'écran le 2026-08-23, drapeau levé
// (`.banc/R1/boutons-R1.json`) :
//
//   · **shuffle MARCHE, et se voit** : l'encre du globe est passée de `000000` à
//     `101d12` et la texture de rampe a changé d'`uuid` — le crop se repeint
//     entièrement. ⚠️ **Mais c'est un agrégat** : `shuffleLook` repose aussi la
//     mer (`waterRebuild`, `realWater`), la matière et les effets de surface,
//     qui écrivent dans `terrain` et `realWater` — invisibles sous le drapeau.
//     Le tirage a bien changé `seaSeed` 9 879 → 7 943 et `surfaceFx` 9 → 6 :
//     cette moitié-là tourne dans le vide.
//   · **l'aérien est INERTE, et pire que muet** : le clic coche le bouton et
//     pose `terrain.mapUniforms.uAerialOn = 1` — c'est-à-dire sur le bloc plat,
//     qui n'est pas dessiné. Le globe n'a AUCUN uniforme d'aérien (recherche sur
//     ses 88 uniformes : zéro), et `refreshAerialCore` n'écrit que dans
//     `terrain.setAerial`. ⛔ **Et le crédit de licence, lui, S'AFFICHE** :
//     « Orthophotos © IGN · NASA GIBS » apparaît sous une image qui n'est pas à
//     l'écran, alors que `refreshOsmCredit` documente l'obligation inverse deux
//     fois (« only while it is »). **À trancher avec Adrien** : brancher
//     l'aérien sur le globe, ou masquer ce bouton-là sous le drapeau.
mapCorner = buildMapCorner({
  toggleAerial: () => { params.aerialEnabled = !params.aerialEnabled; refreshAerial(); refreshAll() },
  resetBase: () => resetAll(),
  shuffle: () => shuffleLook(),
})
mapCorner.setAerialActive(params.aerialEnabled && params.source === 'real')

let bgRefreshFn = () => {} // re-renders the Background HDRI picker highlight after a template/reset (declared before the panel build so registerBgRefresh isn't a TDZ access)
// shared by the Templates panel AND the Create panel — Templates needs the
// same template/reset/dark-mode methods Create used to hold before its
// Templates section was split out into its own panel (Task 5)
const panelCtx = {
  registerBgRefresh: (fn) => { bgRefreshFn = fn },
  // --- palettes validées (Create › Save palette → rangée Palettes de Templates)
  userPalettes: () => userPalettes,
  registerPaletteRefresh: (fn) => { paletteRefreshFn = fn },
  registerUserTplRefresh: (fn) => { userTplRefreshFn = fn },
  saveCurrentPalette: (name) => {
    const rec = paletteFromParams(params, name || `PALETTE ${userPalettes.length + 1}`)
    userPalettes.unshift(rec)
    saveUserPalettes(userPalettes)
    paletteRefreshFn()
    modes.announce(`PALETTE SAVED — ${rec.name}`)
  },
  deleteUserPalette: (id) => {
    userPalettes = userPalettes.filter((p) => p.id !== id)
    saveUserPalettes(userPalettes)
  },
  params,
  terrain,
  globe,
  clouds,
  plinth,
  modes,
  camera,
  controls,
  renderer,
  composer,
  // DoF is built on first use (see ensureDof) — hand out ACCESSORS, never the
  // objects: a by-value capture at ctx-build time would freeze `null` forever.
  setDofEnabled,
  getDof: () => dof,
  isDofEnabled: () => !!dofPass?.enabled,
  exposureFx,
  contrastFx,
  hueSat,
  vignette,
  grain,
  scene,
  sun,
  placeSun,
  applyShadowMode,
  regenerateTerrain,
  loadRealTerrain,
  applyTemplate,
  // user templates (save/apply/export/import saved looks)
  getUserTemplates: () => userTemplates,
  applyUserTemplate,
  saveCurrentTemplate,
  deleteUserTemplate,
  exportUserTemplate,
  importTemplateText,
  applyPalette: applyPaletteWithBg, // changer une palette adapte aussi le fond (Adrien)
  applyStyle,
  // --- Colorisation du relief (picker Classique / Naturel, section Ombrage)
  getColorMode: () => params.colorMode || 'classic',
  setColorMode: (mode) => {
    // la tuile « Naturel » POSE son préréglage tant que les curseurs sont
    // restés à leur valeur d'usine (toutes nulles, pour que le rendu d'avant ce
    // chantier soit reproduit à l'identique) : sans ça le mode s'allumerait
    // sans rien changer à l'écran et passerait pour cassé. Test SANS ÉTAT : dès
    // que l'utilisateur (ou un template) a réglé quoi que ce soit, on ne
    // réécrit plus rien — un aller-retour Classique ↔ Naturel garde ses réglages.
    const vierge = !params.texShade && !params.wetK && !params.expoK && !params.rampDry && !params.rampWet && !params.hazeAmt
    if (mode === 'natural' && vierge) Object.assign(params, NATURAL_COLOR_PRESET)
    params.colorMode = mode
    params.hazeColor = deriveHazeColor(params)
    // le mode borne le bruit de détail (géométrie) → régénération obligatoire ;
    // setColorMode le dit en renvoyant true quand le mode a bougé
    const changed = terrain.setColorMode(mode, params)
    blockGrid?.restyle(params)
    if (changed && params.source === 'real') regenerateTerrain()
    refreshAll()
  },
  // un curseur du mode Naturel : uniformes seulement, aucun recalcul de DEM
  setColorParam: (k, v) => {
    params[k] = v
    terrain.applyColorParams(params)
    // les deux amplitudes du LUT recuisent la rampe, les autres non
    if (k === 'rampDry' || k === 'rampWet') terrain.rebuildRamp(params)
    blockGrid?.restyle(params)
  },
  getColorParam: (k) => params[k],
  // --- Ombrage auto (section Ombrage du panneau Terrain)
  markShadeDirty, // un curseur repris à la main → ce réglage ne suivra plus
  setShadeAuto: (v) => { params.shadeAuto = v; if (v) applyAutoShade({ force: true }) },
  shadeFrozenCount: () => SHADE_KEYS.filter((k) => shadeDirty[k]).length,
  applyGridContour,
  applyMonochrome,
  resetLook,
  setDarkMode,
  waterRebuild,
  realWater,
  mapLayers,
  rebuildMapLayers,
  refreshAerial,
  applyTimeOfDay,
  rebuildRamp: () => {
    terrain.rebuildRamp(params)
    globe.rebuildRamp(params)
    // le nuancier du panneau Créer écrit dans params.rampStops SANS passer par
    // applyPalette : la teinte de l'interface doit suivre le pinceau, sinon
    // l'accord se défait dès qu'Adrien retouche un arrêt à la main.
    syncUiTheme()
  },
  peaksLayer,
  setLabelsVisible: (v) => poserCotesVisibles(v),
  saveZoomExag,
  saveZoomDetail,
  resetZoomExag: () => {
    delete zoomExagStore[params.demZoom]
    try {
      localStorage.setItem(ZOOM_EXAG_KEY, JSON.stringify(zoomExagStore))
    } catch {}
    syncExagToZoom()
    if (params.source === 'real') regenerateTerrain()
  },
  onZoomPicked: (v) => {
    if (v >= 12) userFineZoom = Math.min(v, MAX_FINE_ZOOM) // remember the user's chosen fine scale
    if (params.source === 'real') loadRealTerrain()
  },
  getFineZoom: () => userFineZoom, // finest scale reached — gates the 2048/4096 mesh tiers
  maxFineZoom: MAX_FINE_ZOOM, // plafond du sélecteur « Détail (zoom) »
  // Zoom le plus fin que la SOURCE sert réellement sur la zone courante (z16 en
  // France, z17 en Suisse, z12 sur l'Everest). Au-delà, le bloc garde son emprise
  // mais la donnée est surzoomée : c'est ce qu'il faut dire à l'écran
  // (« zoom maximum atteint »), pas interdire.
  getDemMaxZoom,
  getDemSource: () => ({ ...activeDemSource(), fallback: isFallbackActive() }),
  applyBackground, // solid / gradient scene background
  autoBgColours, // derive gradient stops from the map palette
  autoDarkFromBg, // bascule clair/sombre par contraste après une édition du fond
  bgModes: BG_MODES,
  environments: ENVIRONMENTS, // HDRI sky list for the Background picker
  getBgEnv: () => params.bgEnv || '',
  setBgEnv: (id) => { params.bgEnv = id || ''; applyBackground() },
  applyPlinthMaterial, // socle PBR / glass material picker (Block panel)
  setGroundInfo: (v) => {
    groundInfo.enabled = v
    groundInfo.setVisible(v && cartoucheAffiche())
    if (v && dem && !groundInfo.lastInfo) chargeCartouche()
    else if (v) groundInfo.rerender()
  },
  setShadowRes: (v) => {
    sun.shadow.mapSize.set(v, v)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
    if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
  },
  flyTrack,
  stopTour: () => {
    tour.active = false
    drone.stop()
    camera.up.set(0, 1, 0)
  },
  setRegionMode: () => applyRegionMode(),
  syncDark: () => topBar.syncDark(),
  resetAll, // Templates panel's "Reset map" button
  // toggle du socle : recale le cartouche au sol + fait (dis)paraître les
  // gravures murales (nom, logo, infos course) — voir wallsVisible/getBaseY
  onPlinthToggled: () => {
    groundInfo.rerender?.()
    applyRaceToBlock()
    // ══════ ET LES PAROIS DE LA DÉCOUPE — Tâche R22, option 48 ═════════════
    //
    // ⛔ **LE CURSEUR NE PARLAIT QU'AU SOCLE DU BLOC PLAT, QUI N'EST PLUS
    // RENDU.** `plinth.setVisible` pilote un objet de la scène de surface, et
    // cette scène est éteinte sous la sphère ; ce qu'on voit à l'écran, ce sont
    // les parois de `parois-crop.js`. Mesuré avant : l'interrupteur déplaçait
    // **0,0004** de pixel sur une fenêtre 1:1 de 512 × 320 (plancher 0,0000).
    //
    // ⚠️ **UN SEUL SITE, ET C'EST CELUI-CI.** Le `set:` du panneau appelle déjà
    // ce rappel ; `poserVisibiliteSocle` le rejoue au changement de mode, et
    // `construireParoisCrop` réapplique l'état retenu à chaque mesh neuf. Un
    // quatrième site aurait été une quatrième chance de diverger.
    globe?.setParoisVisibles?.(!!params.plinth && !params.regionMode)
  },
}

// Réorg Adrien (mode Studio) : rail DROIT = Bibliothèque seule ; rail GAUCHE
// = Terrain → Fonds → Éléments → Effets. Le panneau Terrain (shaders-panel)
// est construit d'abord — create-panel y apporte Relief & détail / Ombrage /
// Socle — puis Fonds, puis la Bibliothèque (qui reçoit « Créer une palette »
// via panelCtx.paletteCreation). Ordre visuel des docks fixé plus bas.
let shadersRefreshFn = () => {} // re-renders the Terrain panel controls on exclusivity changes
const shadersPanel = buildShadersPanel({
  registerRefresh: (fn) => { shadersRefreshFn = fn },
  getLiquidMetal: () => params.liquidMetal,
  setLiquidMetal: (v) => {
    params.liquidMetal = v
    // Liquid metal, a relief material and the topographic map all own the terrain
    // material — they're mutually exclusive. Turning LM on clears a relief material.
    if (v && params.terrainSurfaceMat) { params.terrainSurfaceMat = ''; terrain.setMaterialMode('', params) }
    terrain.setLiquidMetal(v, params)
    blockGrid?.restyle(params) // les dalles voisines suivent la principale
    shadersRefreshFn()
    refreshAll()
  },
  lmControls: [
    { k: 'lmMetalness', label: 'Métal', min: 0, max: 1 },
    { k: 'lmRoughness', label: 'Poli', min: 0.02, max: 0.6 },
    { k: 'lmReflection', label: 'Reflet', min: 0, max: 3 },
    { k: 'lmSpeed', label: 'Vitesse du flux', min: 0, max: 1.5 },
  ],
  getLmParam: (k) => params[k],
  setLmParam: (k, v) => {
    params[k] = v
    if (params.liquidMetal) terrain.setLiquidMetal(true, params)
    blockGrid?.diffuseDuCentre() // métal, poli, reflet : le damier miroite pareil
  },
  surfaceFxList: FX_LIST.map(({ id, label }) => ({ value: String(id), label })),
  fxMeta: FX_META,
  getSurfaceFx: () => params.surfaceFx,
  setSurfaceFx: (id) => {
    params.surfaceFx = id | 0
    terrain.setSurfaceFx(params.surfaceFx)
    if (params.surfaceFx > 0) terrain.applyFxParams(params.fx[params.surfaceFx])
    blockGrid?.restyle(params) // les dalles voisines suivent la principale
  },
  getFxParam: (id, key) => params.fx[id]?.[key],
  setFxParam: (id, key, val) => {
    if (!params.fx[id]) return
    params.fx[id][key] = val
    if (params.surfaceFx === id) { terrain.applyFxParams(params.fx[id]); blockGrid?.restyle(params) } // speed/opacity/blend re-pushed + voisins
  },
  // terrain MATERIAL — turns the WHOLE relief into a material (sibling of Liquid
  // metal): the Shaders-panel picker builds its list straight from the shared
  // material catalog (src/material-catalog.js), grouped into vignette categories.
  getSurfaceMat: () => params.terrainSurfaceMat,
  setSurfaceMat: (id) => {
    params.terrainSurfaceMat = id || ''
    // exclusive with Liquid metal — picking a relief material turns LM off
    if (id && params.liquidMetal) { params.liquidMetal = false; terrain.setLiquidMetal(false, params) }
    terrain.setMaterialMode(params.terrainSurfaceMat, params)
    // seed the roughness slider from the material's own default so it reads right
    if (id && id !== 'glass') params.terrainMatRoughness = terrain.material.roughness
    blockGrid?.restyle(params) // les dalles voisines portent le même matériau
    shadersRefreshFn()
    refreshAll()
  },
  getSurfaceMatBump: () => params.terrainSurfaceBump,
  setSurfaceMatBump: (v) => {
    params.terrainSurfaceBump = v
    terrain.setSurfaceMaterialBump(v)
    blockGrid?.restyle(params)
  },
  // live tiling + finish knobs for the opaque relief materials
  getMatScale: () => params.terrainMatScale,
  setMatScale: (v) => {
    params.terrainMatScale = v
    terrain.setTerrainMatScale(v, params.demZoom)
  },
  getMatRoughness: () => params.terrainMatRoughness,
  setMatRoughness: (v) => {
    params.terrainMatRoughness = v
    terrain.setTerrainMatRoughness(v)
    // ⚠️ `setMaterialMode` repose la rugosité du PRÉRÉGLAGE, pas celle de ce
    // curseur : sans cette ligne le damier restait au fini par défaut du
    // matériau pendant que le bloc central portait le fini choisi.
    blockGrid?.diffuseDuCentre()
  },
  getMatNoise: () => params.terrainMatNoise,
  setMatNoise: (v) => {
    params.terrainMatNoise = v
    terrain.setMatNoise(v)
    blockGrid?.diffuseDuCentre()
  },
  getMatAboveZero: () => params.terrainMatAboveZero,
  setMatAboveZero: (v) => {
    params.terrainMatAboveZero = v
    terrain.setMatAboveZero(v)
    blockGrid?.diffuseDuCentre()
  },
  // live glass knobs (only shown when the relief material is Glass)
  // ⚠️ **LE MÊME PRÉDICAT QUE LE PANNEAU DE LUMIÈRE (R21), ET C'EST VOULU** :
  // `terreUniqueBranchee` est ce qui dit qu'on est sur la sphère. Deux panneaux
  // qui répondraient chacun à leur façon divergeraient le jour où ce drapeau
  // change de nom — et ce jour-là un curseur inerte réapparaîtrait sans bruit.
  surSphere: () => terreUniqueBranchee,
  glassControls: [
    { k: 'terrainGlassFrost', label: 'Givre', min: 0, max: 1 },
    { k: 'terrainGlassThickness', label: 'Épaisseur', min: 1, max: 20 },
    { k: 'terrainGlassClarity', label: 'Clarté', min: 2, max: 60 },
    { k: 'terrainGlassReflection', label: 'Reflet', min: 0, max: 3 },
  ],
  getGlassParam: (k) => params[k],
  setGlassParam: (k, v) => {
    params[k] = v
    terrain.applyTerrainGlass(params)
  },
  getGlassTint: () => params.terrainGlassTint,
  setGlassTint: (v) => {
    params.terrainGlassTint = v
    terrain.applyTerrainGlass(params)
  },
})
panelCtx.materialsPanel = shadersPanel // Relief & détail / Ombrage / Socle y emménagent
contributeTerrainSections(panelCtx)

// Fonds — le décor derrière le bloc (rail gauche, mode Studio)
const fondsPanel = buildFondsPanel(panelCtx)

// Bibliothèque — seule habitante du rail droit ; « Créer une palette » lui
// est fourni par create-panel via cette closure
panelCtx.paletteCreation = (host, opts) => buildPaletteCreation(panelCtx, host, opts)
const templatesPanel = buildTemplatesPanel(panelCtx)

// « Mes créations » — sous la Bibliothèque dans le rail droit. Le panneau
// N'EXISTE PAS tant que personne n'est connecté (il se pose `hidden` lui-même),
// donc pour un visiteur anonyme le rail droit est rigoureusement celui d'hier.
panelCtx.compte = compte
// ⚠️ LE RECHARGEMENT DOIT ÊTRE BRANCHÉ AVANT LA CONSTRUCTION.
// `buildMesCartesPanel` appelle `ctx.registerCartesRefresh?.(recharger)` à la
// fin de son propre corps : posé après, le rappel n'existe pas encore et la
// liste ne se recharge plus qu'au changement de session. Vu à l'écran : on
// publie une carte, on ouvre le panneau, il dit toujours « Tu n'as pas encore
// publié de carte » — jusqu'au prochain rechargement de page.
let rechargerMesCartes = null
panelCtx.registerCartesRefresh = (fn) => { rechargerMesCartes = fn }
// ⚠️ « COMPOSER MA PREMIÈRE CARTE » EMMÈNE QUELQUE PART, MAINTENANT.
// Le rappel n'était fourni par personne : le seul bouton de l'écran que TOUT
// LE MONDE voit le premier jour repliait le panneau où il se trouve, et rien
// d'autre. Il ouvre le Studio — l'endroit où l'on habille sa carte, c'est-à-dire
// où l'on en compose une. Closure paresseuse : `panelCtx.openAtelier` est posé
// plus bas dans le module, il est lu AU CLIC.
panelCtx.composerPremiereCarte = () => panelCtx.openAtelier?.()
const mesCartes = buildMesCartesPanel(panelCtx)
// LA DESTINATION DE LA PASTILLE DE COMPTE (barre du haut). Elle est déclarée
// ici, à côté du panneau, et lue AU CLIC par la closure posée dans buildTopBar
// — la barre naît un millier de lignes plus haut que ce panneau.
ouvrirMesCreations = () => mesCartes.ouvrir()

const { elementsPanel, imagePanel } = buildEffectsPanel({
  params,
  exposureFx, contrastFx, hueSat, vignette, grain,
  applyBackground,
  clouds,
  // la chip « Épars/Couvert/… » doit aussi rétablir la visibilité : resetLook
  // masque le groupe au chargement d'une carte, build() seul ne le remontre pas
  syncCloudsVisible: () => clouds.setVisible(params.cloudsEnabled && socleAffiche()),
  // `aoPass` en accesseur : il naît à la première demande d'occlusion, donc une
  // copie prise ici au démarrage vaudrait `null` pour toujours.
  // (plus de `bloom` ni `bloomPass` : la passe a été retirée le 2026-08-02)
  ssao, get aoPass() { return aoPass },
  applyPlinthSSS, // diffusion sous-surfacique du socle (section Rendu)
  realWater, waterRebuild,
  terrain, globe,
  // le Scanner (effet d'image) vit dans Effets ; la Lumière ouvre Éléments
  scanCtx: { runScan: (typeId) => scan.trigger(typeId, { x: controls.target.x, z: controls.target.z }, params.scanDuration) },
  lightCtx: {
    params,
    applyTimeOfDay,
    placeSun,
    syncHour: () => hourPill?.refresh?.(),
    // PLUS de setEnvLight : écrire scene.environmentIntensity à la main était
    // précisément le piège — applyTimeOfDay le réécrit au déplacement suivant.
    // L'éclairage d'environnement passe par params.envGain.
    setShadowSoftness: (v) => {
      sun.shadow.radius = v
      if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
    },
    // ══════ CE QUI EST DESSINÉ, ET DONC CE QUI PEUT AGIR — Tâche R21 ════════
    //
    // ⚠️ **LE PANNEAU DEMANDE « LE BLOC PLAT EST-IL DESSINÉ », PAS « QUEL EST LE
    // MODE ».** C'est la même question que `visibiliteSurface` tranche déjà pour
    // le maillage, et sa réponse sous le drapeau est `socle = false` — relevé à
    // l'écran, `terrain.mesh.visible = false`. Un curseur qui ne pilote QUE ce
    // maillage n'a donc plus de receveur, et c'est `monde/lumiere-sphere.js` qui
    // dit lesquels : la table y est, exécutée par le test, pas relue dans le DOM.
    surSphere: () => terreUniqueBranchee,
    // Les deux interrupteurs. Le panneau n'a pas à savoir que l'un libère au
    // passage une carte d'ombre de 16 Mo : il dit ON/OFF.
    setSunEnabled,
    setFillEnabled,
  },
})

// the 24h slider lives top-right as a pill now — the Create panel's Light
// section is gone entirely (this was its only control)
const hourPill = buildHourPill({
  params,
  applyTimeOfDay,
  // Le premier des deux déclencheurs de l'allumage automatique. On tente TOUT DE
  // SUITE plutôt que d'attendre la première image du cycle : le geste doit
  // répondre au clic, et non une fraction de seconde plus tard. ⚠️ Et on tente
  // même en plein jour — la lecture atteindra le crépuscule dans quelques
  // secondes, et `intensiteNuit` garde la couche invisible d'ici là. C'est ce
  // qui fait que la mosaïque est PRÊTE quand la nuit arrive.
  onLecture: (on) => {
    cycleTemporelActif = on
    if (on) tenteAllumageNuit({ lecture: true, nuit: !!params.darkMode })
  },
})

const explorePanel = buildExplorePanel({
  // `nom` : le lieu remarquable cliqué dans Explorer désigne une ENTITÉ, tout
  // comme une recherche. On le retient pour que l'isolement le découpe lui,
  // sans le géocoder tant que personne ne demande à isoler.
  flyTo: (lat, lon, zoom, nom = null) => {
    setRegionTarget(nom ? { name: nom } : null)
    quitteCadrageDamier() // `modes.flyTo` repasse par l'orbite : voir le bouton globe
    return modes.flyTo(lat, lon, zoom)
  },
})

// Panneau Carte — rail GAUCHE, en TÊTE du mode Studio (au-dessus de Terrain).
// Il porte les calques cartographiques (routes, eau, lieux) et les réglages
// courbes / grille / repères : de l'habillage, pas de la navigation — d'où le
// Studio et non Explorer. L'ordre de construction ne décide de rien ici, c'est
// le ré-append explicite du dock plus bas qui pose la pile.
const mapPanel = buildMapPanel({
  params,
  u: () => terrain.mapUniforms,
  mapLayers,
  rebuildMapLayers,
  blockGrid, // le slider d'opacité aérien propage aux blocs voisins
  // the aerial controls need both — this panel gets its OWN ctx, so adding
  // them to panelCtx above does nothing for it
  terrain,
  refreshAerial,
  peaksLayer,
  setLabelsVisible: (v) => poserCotesVisibles(v),
})

// L'onglet « Couches » — la vitrine du Gardien. Il ne calcule rien : il
// affiche ce que `etatCouches()` lui rend et exécute les échanges proposés.
const couchesPanel = buildCouchesPanel({
  couchesActives: () => [...couchesActives],
  setCouche,
  // LES SOUS-OPTIONS, DÉCLARÉES ICI ET PAS DANS LE PANNEAU. Le panneau sait
  // fabriquer une tirette ; il n'a aucune raison de savoir ce que règle celle
  // des lumières nocturnes, ni quelle est sa course. Même partage que le reste
  // du fichier : la vue rend, main.js branche.
  //
  // ⚠️ Chaque `set` écrit dans `params` PUIS pousse dans les uniformes, et
  // jamais l'inverse : `params` est ce que lisent `refreshAll`, les gabarits et
  // l'export. Écrire directement dans l'uniforme rendrait un réglage qui
  // disparaît au premier chargement de gabarit, sans trace.
  reglagesCouche: (id) => {
    if (id === 'occupation-sol') {
      return [{
        label: 'Force',
        min: 0,
        max: SOL_FORCE_MAX,
        step: 0.05,
        get: () => params.solForce ?? SOL_FORCE_DEFAUT,
        set: (v) => { params.solForce = v; appliqueReglagesCouches() },
      }]
    }
    if (id === 'canopee') {
      // Même libellé et même course que l'occupation du sol, délibérément —
      // deux lavis drapés qui se règlent pareil doivent se graduer pareil (le
      // raisonnement est dans src/reglages-couches.js).
      return [{
        label: 'Force',
        min: 0,
        max: CANOPEE_FORCE_MAX,
        step: 0.05,
        get: () => params.canopeeForce ?? CANOPEE_FORCE_DEFAUT,
        set: (v) => { params.canopeeForce = v; appliqueReglagesCouches() },
      }]
    }
    if (id === 'lumieres-nocturnes') {
      return [
        {
          // « L'opacité de l'assombrissement » — mot pour mot la demande. À 0
          // la couche n'éteint plus rien et ne fait qu'ajouter de la lueur ; à
          // 1 tout ce qui n'est pas éclairé devient noir.
          label: 'Assombrissement',
          min: 0,
          max: 1,
          step: 0.02,
          get: () => params.nuitAssombrissement ?? NUIT_ASSOMBRISSEMENT_DEFAUT,
          set: (v) => { params.nuitAssombrissement = v; appliqueReglagesCouches() },
        },
        {
          // « La force de l'éclairage ». 1 = le gain calibré sur la dynamique
          // de Black Marble (voir NUIT_GAIN_BASE), 2 = deux fois plus.
          label: 'Éclairage',
          min: 0,
          max: NUIT_FORCE_MAX,
          step: 0.05,
          get: () => params.nuitForce ?? NUIT_FORCE_DEFAUT,
          set: (v) => { params.nuitForce = v; appliqueReglagesCouches() },
        },
      ]
    }
    return null
  },
  machine: MACHINE,
  // ⚠️ Une FONCTION, pas l'objet : `aq` est créé bien plus bas dans ce fichier
  // (le gouverneur a besoin du composer). Passer `aq` ici capturerait `undefined`
  // pour toute la session, et le Gardien croirait la machine intacte à jamais.
  get gouverneur() { return aq },
})

// (panneau Scanner supprimé — sa section vit dans Image, voir buildEffectsPanel)

// Camera panel — il ne vit PLUS dans le dock de gauche mais dans le menu
// « objectif » de la topbar (voir mountCamera plus bas).
const cameraPanel = buildCameraPanel({
  params,
  camera,
  controls,
  renderer,
  composer,
  setDofEnabled,
  getDof: () => dof,
  isDofEnabled: () => !!dofPass?.enabled,
  // camera automations
  cameraMoves: CAMERA_MOVES.map(({ id, label }) => ({ value: id, label })),
  isCameraAuto: () => cameraAuto.active,
  playCamera: (move, speed) => {
    if (modes.mode !== 'surface') return
    tour.active = false
    drone.stop()
    quitteCadrageDamier() // même raison que `togglePlay` : l'automation reprend la caméra
    cameraAuto.start(move, speed)
  },
  stopCamera: () => cameraAuto.stop(),
  setCameraSpeed: (s) => cameraAuto.setSpeed(s),
  applyShadowMode,
  setShadowRes: (v) => {
    sun.shadow.mapSize.set(v, v)
    if (sun.shadow.map) {
      sun.shadow.map.dispose()
      sun.shadow.map = null
    }
    if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
  },
  flyTrack,
  stopTour: () => {
    tour.active = false
    drone.stop()
    camera.up.set(0, 1, 0)
  },
})
// il vit dans le menu « objectif » de la topbar, jamais dans un dock
topBar.mountCamera(cameraPanel.root)

// Route panel — left dock, docked directly below Camera (Explore, Scan,
// Camera, Route). Exposes the loaded GPX track: load button + line styling.
const routePanel = buildRoutePanel({
  params,
  gpx: gpxLayer,
  loadGpx: () => gpxFileInput.click(),
  loadDemo: () => loadDemoRace(),
  startFollow: engageGpxFollow,
  stopFollow: disengageGpxFollow,
  // Race Studio — closures paresseuses : `studio`/`raceLabels` sont définis
  // plus bas dans le module, mais lus au CLIC, jamais au build du panneau
  openStudio: () => studio.enter(),
  refreshRaceLabels: () => raceLabels.setDirty(),
})

// palette « K » — recherche de réglages + actions (table lumineuse, lot 4).
// L'index scanne le DOM des panneaux à l'ouverture ; jamais en embed/shibu.
if (!IS_EMBED) {
  buildSettingsSearch({
    actions: [
      { label: 'Ouvrir le Studio (habiller ma carte)', run: () => panelCtx.openAtelier?.() },
      { label: 'Ouvrir le Race Studio (ma course)', run: () => panelCtx.openStudio?.() },
      { label: 'Boutique de templates', run: () => panelCtx.openStore?.() },
      { label: 'Exporter une image ou une vidéo', run: () => openExportUI() },
      { label: 'Réinitialiser la carte', run: () => { resetAll(); refreshAll() } },
    ],
  })
}

// barre de travail flottante (réorg Adrien) : SEULEMENT le sélecteur des
// 3 MODES — Explorer / Studio / Parcours, icône + nom. Choisir un mode
// charge ses panneaux et fait disparaître les autres ; les outils
// contextuels ont été retirés (« ça n'est pas logique pour l'instant »).
// la rangée liquide, remontée hors du bloc : c'est elle qui porte l'ACCUEIL
// (son état « grand », au centre de l'écran) — voir buildHub plus bas.
let elemBar = null
if (!IS_EMBED) {
  const WORKMODE_KEY = 'shibumap-workmode'
  const WORKMODE_PANELS = {
    // la Caméra n'est plus listée ici : elle a quitté le dock pour le menu de
    // la topbar, et wm-off (display:none) l'aurait éteinte hors mode Explorer —
    // le menu se serait ouvert VIDE
    // Carte appartient au STUDIO, pas à Explorer (retour d'usage Adrien) : ses
    // calques — routes, eau, lieux, contours, repères — servent à HABILLER la
    // carte, jamais à se déplacer dedans. Explorer garde son seul panneau.
    explorer: () => [explorePanel],
    studio: () => [mapPanel, templatesPanel, shadersPanel, fondsPanel, elementsPanel, imagePanel],
    parcours: () => [routePanel],
  }
  const allWorkPanels = () => Object.values(WORKMODE_PANELS).flatMap((f) => f())
  function applyWorkMode(id) {
    const keep = new Set(WORKMODE_PANELS[id]().map((p) => p.root))
    for (const p of allWorkPanels()) p.root.classList.toggle('wm-off', !keep.has(p.root))
    // Parcours = un seul panneau, LA porte du mode : arriver sur un pill
    // replié casserait l'évidence — il s'ouvre tout seul (portes ou Lecture)
    if (id === 'parcours') routePanel.setCollapsed(false)
    try { localStorage.setItem(WORKMODE_KEY, id) } catch {}
  }
  // ordre visuel du rail gauche en mode Studio : Carte → Terrain → Fonds →
  // Éléments → Effets. Carte passe DEVANT tout le monde (demande Adrien : au
  // dessus de Terrain) ; l'ordre du DOM est le seul ordre — le rail ne trie
  // rien et le repli d'un panneau ne le rebat pas (shell.js). Explorer et
  // Parcours suivent, masqués hors de leur mode. append DÉPLACE les nœuds.
  {
    const dock = explorePanel.root.parentElement
    for (const p of [mapPanel, shadersPanel, fondsPanel, elementsPanel, imagePanel, explorePanel, routePanel]) dock.append(p.root)
  }
  const initialMode = (() => { try { return localStorage.getItem(WORKMODE_KEY) } catch { return null } })() || 'explorer'
  elemBar = buildElemBar({
    modes: [
      { id: 'explorer', icon: 'explore', label: 'Explorer' },
      { id: 'studio', icon: 'studio', label: 'Studio' },
      { id: 'parcours', icon: 'parcours', label: 'Parcours' },
    ],
    initial: initialMode,
    onMode: applyWorkMode,
    toolsByMode: { explorer: {}, studio: {}, parcours: {} },
    simpleCore: quickCore,
    // le cartouche du bas est ADOPTÉ par la rangée liquide : les deux barres
    // deviennent un seul objet, relié par un pont de goo
    bottomBar,
  })
  applyWorkMode(initialMode)
  // « Avancé » vit dans les barres de modes (sorti de la topbar) : ici sa
  // version elembar — détachée à droite du cœur liquide (advSlot), décentrée
  elemBar.advSlot?.append(buildAdvToggle('ce-elembar-btn'))
  // la barre du bas vient de changer d'ancrage : le profil GPX se mesure
  // maintenant sur la rangée entière (voir syncGpxProfilePosition)
  syncGpxProfilePosition()
}

// roue crantée — PARAMÈTRES GLOBAUX (réorg Adrien) : toujours visible dans
// la topbar, ouvre un panneau par-dessus la carte. Pour l'instant :
// Performance (échelle de rendu, ombres) — sortie du panneau Effets.
if (!IS_EMBED) {
  const veil = document.createElement('div')
  veil.className = 'ce-settings-veil'
  const box = document.createElement('div')
  box.className = 'ce-settings ce-glassbox'
  box.innerHTML = '<div class="ce-settings-head"><b>Paramètres</b><button class="ce-settings-x" type="button">✕</button></div>'
  const perf = perfSection({
    params,
    renderer,
    composer,
    applyShadowMode,
    setShadowRes: panelCtx.setShadowRes,
    // la résolution du maillage a quitté le panneau Terrain (demande d'Adrien) :
    // c'est un arbitrage qualité/vitesse, sa place est ici
    regenerateTerrain,
    // le mode continu 3×3 : son état affichable, et comment le basculer
    fenetreEtat: () => etatInterrupteur(f3Args()),
    setFenetre: f3Applique,
  })
  perf.root.classList.add('open')
  const aide = aideSection()
  aide.root.classList.add('open')
  // ⚠️ « MON COMPTE » N'EST PLUS ICI — c'est le point de départ de la reprise
  // du 2026-08-08. Une roue crantée abrite des réglages d'application (la
  // performance, la fenêtre continue, l'aide) ; une identité n'est pas un
  // réglage, et l'y ranger obligeait à ouvrir une modale de réglages pour se
  // déconnecter. Le compte a maintenant sa pastille dans la barre du haut, et
  // ses actions vivent au bas du panneau « Mes créations ».
  box.append(perf.root, aide.root)
  veil.append(box)
  document.body.append(veil)
  const closeSettings = () => veil.classList.remove('open')
  box.querySelector('.ce-settings-x').addEventListener('click', closeSettings)
  veil.addEventListener('click', (e) => { if (e.target === veil) closeSettings() })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings() })
  panelCtx.openSettings = () => veil.classList.toggle('open')
  // ⚠️ LA BULLE VIT DANS `#app`, PAS DANS LE BODY — même raison que les
  // étiquettes de course (race-labels.js) : en boutique et en Studio, `#app`
  // n'est qu'un cadre de la page, et une bulle collée au body en sortirait.
  // `degage` ferme CETTE modale avant l'apparition : l'interrupteur du mode
  // continu est dedans, et son voile plein écran (z-index 235) enterrerait la
  // bulle sous lui tout en assombrissant le terrain qu'elle désigne.
  // `pret` : DEUX voiles plein écran peuvent couvrir le terrain, et une bulle
  // qui le désigne n'a rien à dire tant que l'un des deux est là.
  //   · l'écran d'accueil (`body.ce-hub`) monte APRÈS le chargement ;
  //   · le carton de chargement revient à chaque bascule, puisque allumer le
  //     mode continu recharge la zone — la bulle naissait pile derrière le
  //     carton qu'elle venait de déclencher.
  // Ni l'un ni l'autre n'émet d'événement (cf. v28.css pour l'accueil) : leur
  // seule trace est une classe, d'où les deux nœuds passés à `surveille`.
  initAides({
    conteneur: container,
    degage: closeSettings,
    pret: () =>
      !document.body.classList.contains('ce-hub') && !!loadingEl?.classList.contains('hidden'),
    surveille: [document.body, loadingEl],
  })
}

// mini panneau Parcours du mode simple (gestion des blocs + Lecture) —
// construit APRÈS le panneau complet pour chaîner ses hooks onChange
const miniRoute = buildMiniRoute({
  gpx: gpxLayer,
  startFollow: engageGpxFollow,
  stopFollow: disengageGpxFollow,
})
void miniRoute

// the exclusive per-column accordion now lives in the Panel shell (setCollapsed
// folds dock neighbours), so expanding any panel collapses the others in its
// column. Start with only Create/Explore open (Templates docks above Create
// but stays collapsed until clicked, same as Shaders/Map).
shadersPanel.setCollapsed(true)
fondsPanel.setCollapsed(true)
elementsPanel.setCollapsed(true)
imagePanel.setCollapsed(true)
cameraPanel.setCollapsed(true)
mapPanel.setCollapsed(true)
// Parcours reste OUVERT si on boote déjà dans ce mode (applyWorkMode l'a
// déplié : c'est la porte du mode, un pill replié casserait l'évidence)
if ((() => { try { return localStorage.getItem('shibumap-workmode') } catch { return null } })() !== 'parcours') routePanel.setCollapsed(true)

// adaptive quality — built once the composer, panels and mode machine exist
// so tier changes can announce, re-sync the Camera panel and stay quiet in
// orbital view / during a live recording (a pixelRatio change would resize
// the canvas mid-encode and abort the MP4)
aq = createAdaptiveQuality({
  params,
  renderer,
  composer,
  setDofEnabled,
  isDofEnabled: () => !!dofPass?.enabled,
  // vaut `null` ici depuis que la passe est chargée à la demande — sans effet :
  // perf.js ne lit jamais cet argument, il agit sur l'occlusion par
  // `params._aoTierOk`, que le tick de main.js consulte (comme pour le bloom).
  aoPass,
  grain,
  applyShadowMode,
  announce: (m) => modes.announce(m),
  refreshAll,
  // ⚠️ `!demBusy` — LE RELIEF EN CONSTRUCTION N'EST PAS UNE MESURE DE MACHINE.
  //
  // Signalé par Adrien le 28/07/2026 : « ça ne laggait pas du tout hier ».
  // Bissecté jusqu'à 2613877, le commit qui a réparé la surdité du gouverneur.
  // En lui donnant enfin le delta RÉEL, on lui a aussi donné les images de
  // `fetchAndBuildDem` — décompression des tuiles, fabrication de la géométrie.
  // Elles sont longues ET consécutives, donc `echantillonRetenu` les garde (à
  // raison : c'est ce qui sauve une machine réellement lente). Le gouverneur
  // lit « 6,7 images/s » et `palierVise` l'envoie de T0 à T3 d'un seul bond.
  //
  // Le palier 3 est le SEUL qui coupe les ombres, donc le seul qui fasse
  // basculer `sun.castShadow` : three recompile alors TOUS les programmes de la
  // scène — 1 936 ms chronométrées sur cette page (voir applyShadowMode). Puis
  // la machine, chargée et redevenue fluide, remonte et repasse la frontière en
  // sens inverse. Mesuré sur le vrai contrôleur, machine JAMAIS lente :
  //   hier (02ebd89 et 31ea718) : 0 changement de palier,  0 recompilation
  //   2613877 → main            : 4 changements de palier, 2 RECOMPILATIONS
  //     8,9 s → T3   28,9 s → T2   48,9 s → T1   68,9 s → T0 (retour au départ)
  // Deux gels de ~2 s pour revenir exactement au palier de départ : c'est ça,
  // le lag. Le guichet fermé pendant la construction les supprime tous les deux.
  //
  // Ça ne re-casse PAS l'iMac 2015 : une machine vraiment à 3 fps l'est ENCORE
  // une fois le relief chargé — elle atteint le palier plancher à 14,3 s au lieu
  // de 9,0 s, toujours sous les 15 s qu'exige test/perf-gouverneur.test.js.
  canStep: () => modes.mode === 'surface' && !modes.busy && !recorder?.recording && !demBusy,
  // LE GOUVERNEUR NE PART PLUS DU MAXIMUM. Il part de ce que la sonde a estimé
  // avant le premier rendu, et ne fait plus qu'AFFINER : il descend si la
  // machine souffre quand même, il regagne au plus un cran si elle tient.
  // C'est le correctif des 47 secondes mesurées le 28/07/2026.
  palierMachine: MACHINE.palier,
})

// LE VERDICT, LISIBLE DEPUIS LA CONSOLE — et une ligne au démarrage quand la
// machine n'est PAS en pleine qualité. Un système qui dégrade en silence est
// indébogable à distance : c'est précisément le silence qui a laissé le mode
// dégradé dormir pendant des mois (voir l'en-tête de perf.js).
window.__palierMachine = MACHINE
if (MACHINE.palier > 0) {
  // eslint-disable-next-line no-console
  console.info(
    `[ShibuMap] palier ${MACHINE.palier} — ${MACHINE.nom} (sonde en ${MACHINE.ms} ms)\n  `
    + MACHINE.raisons.join('\n  ')
  )
}

// ------------------------------------------------------------------ keyboard shortcuts + undo/redo

const shortcutsCtx = {
  cameraPreset,
  togglePlay,
  stopPlay,
  // flush any pending debounced snapshot FIRST, so an edit made <400ms ago is
  // committed before we step back — otherwise a quick Ctrl+Z after a change
  // reverts the WRONG step (or no-ops), which read as "undo is broken" (Adrien)
  undo: undoNow,
  redo: redoNow,
  toggleUI: () => document.body.classList.toggle('ce-noui'),
  toggleDark: () => {
    setDarkMode(!params.darkMode)
    refreshAll()
    topBar.syncDark()
    history?.record() // keyboard toggle should be one undoable step, like the UI switch
  },
  reframe: () => cameraPreset('home'),
  toggleShortcuts: () => shortcutsOverlay.toggle(),
  // un SEUL câblage pour les trois entrées (« / », hub, palette) : bars.js
  // détient le champ et sait le rouvrir quand il est replié (mode Parcours)
  focusSearch,
  openExport: () => openExportUI(),
  toggleLayer,
  toggleRegion,
}
bindShortcuts(shortcutsCtx)

// debounced "committed change" hook for undo/redo: a slider drag / colour
// pick / toggle / select anywhere inside a dock panel collapses into ONE
// history entry ~400ms after the user stops interacting — 'change' fires
// once per commit for toggles/selects/colour inputs, 'pointerup' catches the
// end of a slider drag. History.record() dedups no-ops on its own.
function debounce(fn, ms) {
  let t = null
  let pending = null
  const wrapped = (...args) => {
    clearTimeout(t)
    pending = args
    t = setTimeout(() => { pending = null; fn(...args) }, ms)
  }
  // run the queued call NOW (used by undo/redo to commit a just-made edit)
  wrapped.flush = () => {
    if (t == null) return
    clearTimeout(t); t = null
    const args = pending; pending = null
    if (args) fn(...args)
  }
  return wrapped
}
const recordHistoryDebounced = debounce(() => history.record(), 400)
// .ce-cammenu autant que .ce-dock : le panneau Caméra a quitté le rail pour un
// menu de la topbar, et fov/bokeh font partie du look annulable
const UNDOABLE_UI = '.ce-dock, .ce-cammenu'
document.addEventListener('change', (e) => { if (e.target?.closest?.(UNDOABLE_UI)) recordHistoryDebounced() }, true)
document.addEventListener('pointerup', (e) => { if (e.target?.closest?.(UNDOABLE_UI)) recordHistoryDebounced() }, true)

// Le look d'ouverture est le SOL de l'historique, pas un pas qu'on peut
// défaire. reset() plutôt que record() parce que le boot a déjà enregistré
// (le gabarit d'ouverture) : le dédoublonnage de record() ne rattrapait rien,
// le soleil ayant tourné de quelques millièmes entre les deux prises. Résultat
// mesuré avant correction : « Annuler » s'allumait tout seul au chargement et
// le premier clic reculait le soleil de 0,4° — un clic dans le vide.
history.reset()

// ------------------------------------------------------------------ loop

// console access for debugging/scripting
window.__exp = { boats, raceLabels, raceState, courseBar, syncCourseBarMode, scene, camera, controls, params, terrain, loadRealTerrain, applyTimeOfDay, globe, modes, gotoCtl, gpxLayer, loadGpxText, flyTrack, tour, drone, cameraAuto, shots, applyBackground, autoBgColours, clouds, plinth, peaksLayer, blockGrid, refreshAerial, paintCellAerial, applyIsoView, flyTo, cadreLeDamier, quitteCadrageDamier, modeBoutonCamera, get tween() { return tween }, get isoIndex() { return isoIndex }, applyPalette, applyStyle, applyGridContour, applyMonochrome, applyTemplate, setDarkMode, groundInfo, pilote,
  // ⚠️ **LA BIBLIOTHÈQUE ELLE-MÊME, pour les sondes (R34).** Une sonde qui doit
  // injecter une mire dans la scène ou relire le tampon de profondeur a besoin
  // des MÊMES classes que le rendu — une seconde copie de three importée par la
  // page ne partagerait ni ses caches ni ses `instanceof`.
  THREE,
  // LA MISE AU POINT — Tâche R34 : ce que la sonde relit pour prouver la chaîne
  // d'unités (mètres → unités de la caméra des effets) et la Terre affichée.
  distanceSousLaVisee, metresParUniteEffets, get pointeurSurToile() { return pointeurSurToile }, get viseeFocus() { return viseeFocus },
  // INTERRUPTEUR de la teinte d'interface : __exp.setUiTint(false) rend
  // l'interface neutre de v28.css, true la raccorde à la palette.
  setUiTint: (v) => { params.uiTint = v !== false; syncUiTheme() }, renderer, composer, realWater, waterRebuild, traffic, mapLayers, rebuildMapLayers, get scan() { return scan }, get labels() { return labels }, get aq() { return aq }, get recorder() { return recorder }, history,
  // LA FRONTIÈRE DE RENDU — Tâche 1b bis. Exposée pour la même raison que le
  // reste de `__exp` : c'est le SEUL moyen de vérifier cette tâche, `main.js`
  // n'étant chargé par aucun test. `majCameraFond` est appelable à la main pour
  // forcer une image hors de la boucle rAF — c'est ainsi que la tâche a prouvé
  // ce qu'elle dessine (`composer.render()` puis `readPixels`).
  frontiereActive, sceneGlobe, camGlobe, majCameraFond,
  // LE SEUIL DU SOCLE — Tâche 3 branchée, même raison : `main.js` n'est chargé
  // par aucun test, et `veilleSocle.auSeuil` / `.bascules` sont ce qui se lit à
  // l'écran pour vérifier qu'une descente ne fait QU'UNE bascule.
  veilleSocle, seuilSocleBranche, altitudeCadrageM, distanceCadrageM,
  // L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G, exposé pour la même raison que
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
  // LES REPÈRES ET LES COTES — Tâche R24, exposés pour la MÊME raison que les
  // blocs ci-dessus : `main.js` n'est chargé par aucun test, et le poseur des
  // repères est **le seul moyen de lire la hauteur d'un sommet en mètres** pour
  // la confronter à `globe.hauteurDessinee` — c'est-à-dire de PROUVER qu'un
  // repère n'est pas sous le sol au lieu de le supposer.
  poseurDesReperes, reperesAffiches,
  // ⚠️ **LE MÊME CHEMIN QUE LE CURSEUR DU STUDIO**, pas une recopie : la sonde
  // doit actionner ce qu'actionne un doigt, sinon elle mesure autre chose.
  setLabelsVisible: (v) => poserCotesVisibles(v),
  // LE REPOS DE LA VUE — Tâche N, exposé pour la même raison que les quatre
  // blocs ci-dessus : `main.js` n'est chargé par aucun test, et
  // `veilleRepos.auRepos` / `.bascules` sont **la seule façon de vérifier à
  // l'écran qu'un dézoom rallume les alentours UNE fois et que la vue posée les
  // éteint UNE fois** — c'est-à-dire de compter le battement au lieu de
  // l'espérer.
  veilleRepos,
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
  // le repli AWS s'est-il déclenché ?
  getDemMaxZoom,
  get demSource() { return { ...activeDemSource(), fallback: isFallbackActive() } },
  get shufflePool() { return currentPalettePool() },
  get lastShufflePalette() { return shuffleLastPalette },
  get reliefGrade() { return currentReliefGrade() },
  get shadeDirty() { return { ...shadeDirty } },
  applyAutoShade,
  // pousser un look complet depuis la console ou un script de vérif : c'est le
  // seul moyen de rejouer l'aller-retour export/import d'un gabarit sans passer
  // par le sélecteur de fichier (l'appoint et les gains de lumière ont un
  // NEUTRE quand le gabarit est plus vieux qu'eux — voir NEUTRAL_LIGHT_USER)
  applyUserTemplate,
  // les deux interrupteurs de lumière, et de quoi vérifier ce qu'ils NE font
  // pas : renderer.info.programs.length doit rester rigoureusement constant
  // d'une bascule à l'autre (le compte de lumières ne bouge jamais — voir le
  // commentaire au-dessus de `const fillLight`).
  setSunEnabled,
  setFillEnabled,
  sun,
  fillLight,
}

applyTimeOfDay(params.timeOfDay ?? 10) // seed the sun/disc/lake for the opening view
// Les sous-options des couches partent des mêmes valeurs que les uniformes du
// nuanceur, mais on les pousse quand même : le jour où un défaut change d'un
// seul côté, c'est params qui doit gagner — c'est lui que la tirette montre.
appliqueReglagesCouches()

// real world is the default source — fetch its tiles on startup. A published
// race link (#r=, fetch fired at module scope so it ran during boot) takes
// over the initial view instead: its GPX load re-frames and fetches the right
// terrain itself, so booting the default view first would just load a terrain
// we immediately throw away. Any failure — 404, storage down, garbage payload —
// falls back to the normal default boot, never a blank screen.
async function bootInitialView() {
  const payload = pendingRaceFetch ? await pendingRaceFetch : null
  const race = payload ? parseRacePayload(payload, BASE_TEMPLATE_LOOK) : null
  if (!race) {
    if (pendingRaceFetch) loadingStatus.textContent = 'race link unavailable — loading the default view…'
    // ⚠️ ATTENDU, alors qu'il ne l'était pas : c'est ce chargement-là qui crée
    // l'emprise 3×3 dans laquelle la fenêtre d'un lien #s= doit se poser. Rien
    // d'autre ne change — la valeur de retour n'était pas lue, et personne
    // n'attendait `bootInitialView` non plus.
    if (params.source === 'real') await loadRealTerrain()
    f3PoseFenetre(pendingShareFen)
    pendingShareFen = null
    return
  }
  if (race.state) {
    Object.assign(params, race.state.look)
    params.demLat = race.state.loc.lat
    params.demLon = race.state.loc.lon
    params.demZoom = race.state.loc.zoom
    params.demLocation = 'Custom'
    if (race.state.cam) pendingShareCam = race.state.cam
    pendingShareFen = race.state.fen
  }
  // loadGpxText frames the track, loads terrain, and applies the pending
  // camera once the view exists. SANS course (une carte nue publiée), il n'y
  // a rien à cadrer : on charge simplement le relief du lieu restauré.
  if (race.gpx) await loadGpxText(race.gpx)
  else if (params.source === 'real') await loadRealTerrain()
  // Le relief existe : l'emprise aussi, donc la fenêtre a où se poser.
  f3PoseFenetre(pendingShareFen)
  pendingShareFen = null
  // la course complète du payload → cartouches, flancs du bloc, ticks du
  // profil, nom du calque (mini panneau) — la shibu reçue est ENTIÈRE
  if (race.race) {
    if (race.race.name && gpxLayer.activeLayer) gpxLayer.setName(gpxLayer.activeLayer.id, race.race.name)
    syncRaceState({ ...race.race, logo: race.race.logo ?? race.logo })
  }
  if (pendingShareCam) {
    camera.position.set(pendingShareCam.px, pendingShareCam.py, pendingShareCam.pz)
    controls.target.set(pendingShareCam.tx, pendingShareCam.ty, pendingShareCam.tz)
    controls.update()
    pendingShareCam = null
  }
}
bootInitialView()

const clock = new THREE.Clock()
let placesRefreshAcc = 0 // throttles the places-layer screen-space declutter refresh (see tick())

// camera motion for one frame — shared by the live loop and offline export
function updateCameraMotion(dt) {
  // LA POURSUITE A RENDU LA MAIN (fin du clip, geste sur la caméra, autre plan,
  // clic sur la pastille) → la tête de course repasse à l'horloge de lecture, et
  // la ligne entière se restaure si rien ne lit. UN SEUL point de sortie, ici,
  // plutôt qu'un à chaque `pilote.cancel()` du fichier : ils sont cinq, et il en
  // manquerait un.
  if (teteCommandee && !pilote.poursuite) {
    teteCommandee = false
    gpxLayer.releaseHead?.()
  }
  // VOL DU PILOTE en cours (bouton avion) — en tête : c'est le seul automatisme
  // qui pilote AUSSI le roulis, donc le seul qu'un autre écraserait à coup sûr.
  if (pilote.active) {
    pilote.update(dt)
    // ⚠️ LA TÊTE DE COURSE SUIT LE SUJET DE LA POURSUITE, PAS L'HORLOGE DE
    // LECTURE. Une poursuite dont le sujet est ailleurs à l'écran n'a aucun sens
    // à l'œil — c'est LE point du mode. Les deux horloges n'ont aucune raison de
    // coïncider (la lecture parcourt les 47 km en 71 s, la poursuite ne couvre
    // que le tronçon retenu, à l'allure de Tobler) : celle de la poursuite
    // gagne, et tick() se tait pour l'image (voir GpxLayer.setHeadAt).
    if (pilote.poursuite && pilote.posePoursuite) {
      gpxLayer.setHeadAt(fractionSurTrace(pilote.poursuite, pilote.posePoursuite.idx), dt)
      teteCommandee = true
    }
    return
  }
  // PLAN DE CAMÉRA en cours (bouton cinéma) — en tête, car un plan composé prime
  // sur toute autre automation ; les deux ne tournent jamais ensemble.
  if (shots.active) {
    shots.update(dt)
    return
  }
  // looping cinematic camera automation (Camera panel) — checked here so BOTH
  // the live tick() and the offline export step drive it
  if (cameraAuto.active) {
    cameraAuto.update(dt)
    return
  }
  // GPX playback drone-follow: driven by the reveal head's OWN progress
  // (gpxLayer.headT), not DroneCam's internal timer — see updateAt(). Must
  // be checked before the generic drone.active branch below, which still
  // owns the separate "Fly the GPX track" cinematic (Camera panel).
  if (params.gpxFollow && gpxLayer.isPlaying() && drone.active) {
    // task 30: the user is holding OrbitControls (dragging/zooming) — let
    // THEM drive the camera this frame instead of the drone overwriting it
    // right back. followPivot() keeps the orbit pivot on the moving head
    // (so a drag orbits/zooms around the advancing runner, "un peu de
    // recul" per the brief) and syncToCamera() re-anchors the rig's
    // internal pose to wherever the user leaves it, so the moment they let
    // go, the very next updateAt() call eases FROM that pose back toward
    // the drone's own framing under its existing rate caps/damping — never
    // a snap. drone.active/gpxFollow are never touched here, so this is a
    // suspend, not a stop (see the controls 'start' handler above).
    // élan de zoom molette : appliqué au frame, décéléré exponentiellement
    if (followZoomVel) {
      const f = Math.exp(followZoomVel * dt * 1.35)
      if (controlsHeld || followManual) {
        camera.position.sub(controls.target).multiplyScalar(f).add(controls.target)
      } else {
        drone.dist = Math.min(60, Math.max(3, drone.dist * f))
      }
      followZoomVel *= Math.exp(-dt * 2.1)
      if (Math.abs(followZoomVel) < 0.01) followZoomVel = 0
    }
    if (controlsHeld || followManual) {
      // mode LIBRE : position caméra = l'utilisateur ; cible = la tête
      drone.followPivot(gpxLayer.headT)
      controls.update()
      drone.syncToCamera()
    } else {
      // passe la VRAIE position monde de la tête → visée verrouillée au centre
      drone.updateAt(dt, gpxLayer.headT, gpxLayer.headWorld)
    }
    return
  }
  // drone follow-cam for the GPX track — chase the route from behind/above
  if (drone.active) {
    drone.update(dt)
    return
  }
  // tour.active can never actually be true any more (see the `tour` shell's
  // comment above) — the general fly-to tween below is what's left to drive
  if (tween.active) {
    tween.t = Math.min(1, tween.t + dt / params.flyDuration)
    const e = EASINGS[params.flyEasing](tween.t)
    if (tween.orbit) {
      // rotation orbitale (iso) : slerp de la direction autour de la cible +
      // lerp du rayon → une vraie rotation, jamais une corde qui plonge vers le centre
      _twTgt.lerpVectors(tween.t0, tween.t1, e)
      _twD0.subVectors(tween.p0, tween.t0)
      _twD1.subVectors(tween.p1, tween.t1)
      const r = THREE.MathUtils.lerp(_twD0.length(), _twD1.length(), e)
      slerpDir(_twD0.normalize(), _twD1.normalize(), e, _twDir)
      camera.position.copy(_twTgt).addScaledVector(_twDir, r)
      controls.target.copy(_twTgt)
    } else {
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.t0, tween.t1, e)
    }
    camera.lookAt(controls.target)
    if (tween.t >= 1) tween.active = false
  } else if (modes.mode === 'surface') {
    // ══════ TOURNER AUTOUR DU BLOC, PAS AUTOUR DU POINT VISÉ — Tâche R13 ════
    //
    // > **Adrien :** *« Le comportement de la rotation de la vue autour de la
    // > Terre est parfait en mode orbital. Peut-on appliquer celui-là jusqu'au
    // > mode crop ? »*
    //
    // ⛔ **CE N'ÉTAIT PAS LA VITESSE, ET C'EST MESURÉ.** L'orbite haute et le
    // bloc rendent le MÊME `0,447079 °/px` d'azimut (`.banc/R13/avant.json`) :
    // même `OrbitControls`, même `rotateSpeed = 1`, même loi. Ce qui diffère est
    // la CIBLE — le centre de la Terre en orbite, un point du sol sur le bloc.
    // Le bloc dérivait donc de **68,324 px** à l'écran pour 100 px de souris,
    // là où la Terre ne bouge jamais.
    //
    // ══════ ET LA BUTÉE POLAIRE SUIT LE SOL — Tâche R23 ═══════════════════
    //
    // ⛔ **`maxPolarAngle = Math.PI × 0,49` LAISSAIT LA CAMÉRA PASSER SOUS LE
    // TERRAIN.** Mesuré au navigateur (`scripts/sonde-vitesse-r23.mjs`, glissé
    // poussé à la butée puis 360° d'azimut À la butée, bloc z12) :
    // **−11,7616 unités** au Mont-Blanc sur **450 images de 505**, −11,8422 à
    // l'Everest, −8,6115 au Cervin. Le nombre qui manquait à `0,49π` n'est pas
    // un facteur, ce sont la DISTANCE et le RELIEF — voir `monde/butee-sol.js`.
    //
    // ⚠️ **RECALCULÉE À CHAQUE IMAGE, ET AVANT `update()`** : c'est `update()`
    // qui applique le clamp de `φ`, donc une butée posée après serait celle de
    // l'image d'avant — la « sonde lue APRÈS la fonction », dans l'autre sens.
    // Elle varie continûment avec la distance, donc `φ` est ramené en douceur
    // quand on se rapproche ; le pas par image est relevé dans le rapport.
    //
    // ⚠️ **AUCUNE ÉCRITURE SUR `controls.target` NI SUR LA DISTANCE** : une
    // butée d'angle ne touche ni l'un ni l'autre, donc `veille-repos` ne voit
    // rigoureusement rien et D16 ter n'est pas dépensé.
    // ⚠️ **ET LE PLANCHER DE DISTANCE SUIT LE SOL LUI AUSSI — R23, tour 2.**
    // La butée d'angle ne peut rien quand la CIBLE est enterrée : `_cibleVisee`
    // pose `y = Y_CIBLE = −0,3` alors que le sol y monte à 14 unités sur un bloc
    // de montagne, si bien qu'à `d = 6` la caméra est sous le terrain à TOUS les
    // angles (mesuré : −5,0982 u sur 504 images de 504 au Mont-Blanc).
    //
    // ⚠️ **SECOND SITE D'ÉCRITURE DE `minDistance`, ET IL EST ASSUMÉ.** La
    // Tâche 1b avait rassemblé les quatre recopies littérales dans
    // `Modes._poseButees` ; ce site-ci n'est pas une recopie mais une LOI, elle
    // vit dans un module pur et testé, et elle doit courir par image parce que
    // le relief sous la cible change quand la fenêtre glisse. `_poseButees`
    // reste le seul endroit qui pose la VALEUR DE BASE, et c'est elle qu'on
    // passe en `plancher`.
    if (terrain?.sample) {
      controls.minDistance = distanceMinSol({
        cibleX: controls.target.x,
        cibleY: controls.target.y,
        cibleZ: controls.target.z,
        sol: terrain.sample,
        plancher: DISTANCE_MIN_SURFACE,
        plafond: controls.maxDistance,
        pivotX: PIVOT_BLOC_X,
        pivotZ: PIVOT_BLOC_Z,
      })
    }
    controls.maxPolarAngle = terrain?.sample
      ? polaireMaxSol({
        distance: controls.getDistance(),
        cibleX: controls.target.x,
        cibleY: controls.target.y,
        cibleZ: controls.target.z,
        azimut: controls.getAzimuthalAngle(),
        sol: terrain.sample,
      })
      : POLAIRE_MAX_DURE
    // ⚠️ **L'AZIMUT EST LU AVANT `update()`** : c'est lui qui applique la
    // rotation du glissé, et le delta ne se lit qu'en encadrant l'appel.
    const _azAvantUpdate = controls.getAzimuthalAngle()
    controls.update() // orbital-mode camera is driven by the mode machine
    pivoterAutourDuBloc(_azAvantUpdate)
    recentrerSurLaTerre()
  }
  // ⚠️ **HORS DES BRANCHES, ET C'EST UNE MESURE QUI L'A DÉPLACÉ ICI.** Posé dans
  // la seule branche `surface`, le redressement sautait les images où une AUTRE
  // écriture tient la caméra — le tween de vol, et surtout le balayage de pose
  // de D16 ter (`_avancerFonduPose`, `modes.js`), qui écrit la position ET
  // appelle `controls.update()` lui-même. Le banc voyait alors **une image** par
  // geste passer sous le sol, jusqu'à −3,5735 u, pendant que les ~503 autres
  // étaient dégagées. Ici, il court sur toutes les images du mode surface.
  if (modes.mode === 'surface') redresserSurLeSol()
}

// ══════════ ET ON REDRESSE APRÈS LE PIVOT — Tâche R23, tour de correction ═══
//
// ⛔ **LA BUTÉE SEULE NE SUFFIT PAS, ET C'EST MESURÉ.** Premier jet : butée
// posée avant `update()`, et le banc rendait encore **−7,3730 unités** au
// Mont-Blanc sur 276 images de 504 — mieux que les −11,76 d'avant, mais pas
// « jamais ».
//
// ⚡ **LA CAUSE EST LA ROTATION RIGIDE DE R13.** `pivoterAutourDuBloc` ajoute le
// MÊME vecteur à la caméra et à la cible (`δ = (I − Ry(d))·(P − T)`, voir
// `monde/pivot-bloc.js`) : la butée avait été calculée pour une rotation autour
// de la CIBLE, mais la caméra tourne autour de l'AXE DU BLOC et survole donc un
// tout autre sol. Avec une cible à 20 unités de l'axe et 10,7° d'azimut par pas
// de souris, la translation vaut ~3,7 unités PAR IMAGE — la caméra change de
// montagne entre deux images.
//
// ➡️ **ON RECALCULE APRÈS LE PIVOT, ET ON REDRESSE À DISTANCE CONSTANTE.**
// Réduire `φ` autour de la cible ne change ni la cible ni le rayon : la
// distance caméra → cible est invariante **par construction**, donc
// `veille-repos` (`SEUIL_BOUGE_LOG = 1e-4`) ne voit rigoureusement rien et
// D16 ter n'est pas dépensé. C'est la même garantie, et pour la même raison,
// que celle de la rotation rigide elle-même.
function redresserSurLeSol() {
  if (!terrain?.sample) return
  const d = controls.getDistance()
  if (!(d > 0)) return
  const phi = controls.getPolarAngle()
  const az = controls.getAzimuthalAngle()
  const max = polaireMaxSol({
    distance: d,
    cibleX: controls.target.x,
    cibleY: controls.target.y,
    cibleZ: controls.target.z,
    azimut: az,
    sol: terrain.sample,
  })
  if (!(phi > max)) return
  const s = Math.sin(max)
  camera.position.set(
    controls.target.x + d * s * Math.sin(az),
    controls.target.y + d * Math.cos(max),
    controls.target.z + d * s * Math.cos(az)
  )
}

// ══════════ LA CORRECTION DE PIVOT, ET LES TROIS GARDES QUI LA BORNENT ═════
//
// ⛔ **ON N'ÉCRIT PAS `controls.target` SUR LE CENTRE DU BLOC.** `veille-repos`
// surveille `|Δ ln(distance caméra→cible)|` au seuil `1e-4`, et c'est ce signal
// qui arme la bascule de trois quarts de D16 ter. Un ré-ancrage de la cible
// produit **6,608e-3 — 66 fois le seuil** (mesuré, `.banc/R13/cibles.json`).
//
// ➡️ La caméra **et** la cible reçoivent donc le MÊME décalage : une translation
// rigide, dont l'invariance de la distance est une propriété algébrique et non
// un réglage (voir `monde/pivot-bloc.js`). D16 ter ne voit rien passer.
function pivoterAutourDuBloc(azAvant) {
  // ⚠️ Hors surface il n'y a pas de bloc — en orbite la cible EST déjà le centre
  // de l'objet regardé, et c'est précisément le geste qu'on copie ici.
  if (!modes || modes.mode !== 'surface') return
  // ⛔ Pendant un chargement, un balayage de pose ou un tween de plongée, la
  // machine pose elle-même caméra ET cible : une correction de pivot les
  // combattrait, et c'est la classe de défaut que R4 a payée.
  if (modes.busy || modes.travel || modes._fonduPose || modes._diveTween) return
  const d = deltaAzimut(azAvant, controls.getAzimuthalAngle())
  if (d === 0) return
  const dec = decalagePivot({ cibleX: controls.target.x, cibleZ: controls.target.z, angle: d })
  if (dec.x === 0 && dec.z === 0) return
  controls.target.x += dec.x
  controls.target.z += dec.z
  camera.position.x += dec.x
  camera.position.z += dec.z
  camera.lookAt(controls.target)
}

// ══════════ LE PIVOT RESTE LE CENTRE DE LA TERRE JUSQU'AU CROP — R27 ═══════
//
// > **Adrien :** *« Il doit toujours viser le centre de la Terre. Il change
// > uniquement quand on passe en mode bloc croppé. Si on dézoome depuis le mode
// > croppé, la caméra revient automatiquement avec une orbite autour du centre
// > de la Terre. »*
//
// ⛔ **R13 bis A CONCLU « RIEN À FAIRE », ET LA MESURE LE DÉMENT.** Sa preuve ne
// portait que sur l'AZIMUT, où le `y` du pivot ne compte pas ; elle laissait
// ouvert le terme qui manque vraiment — **`controls.target` n'est pas sur
// l'axe**. Relevé DANS la boucle (`scripts/sonde-pivot-r27.mjs`) : jusqu'à
// **12,898 unités** d'écart pendant la descente, et le centre du bloc à
// **188,7 px** du centre de l'écran à la naissance du crop.
//
// ➡️ **LE PAS EST RIGIDE ET BORNÉ EN ANGLE VU** — la loi, ses deux nombres et
// leur mesure vivent dans `monde/pivot-terre.js`. Caméra ET cible reçoivent le
// MÊME décalage : la distance caméra → cible est invariante **par
// construction** — `(P + δ) − (T + δ) = P − T` —, donc `veille-repos`
// (`SEUIL_BOUGE_LOG = 1e-4`) ne voit rigoureusement rien et D16 ter n'est pas
// dépensé. C'est la garantie de la rotation rigide de R13, prise par l'autre
// bout.
//
// ⚠️ **LE PRÉDICAT EST `hooks.horsDuCrop`, ET IL EST ÉNONCÉ UNE SEULE FOIS** —
// là où le hook est écrit, à côté de `surLeBloc`. Il vaut `terre unique
// branchée ET crop non posé` : `veilleCrop.pose` est le point unique
// d'alimentation (`branchement-crop.js`), et `veilleSocle` n'est jamais mise à
// jour sous le mode sphère — elle resterait fausse pour toujours.
//
// ⚠️ **ET RIEN NE BOUGE HORS DU RÉGIME DU CROP.** Sans `terre unique` il n'y a
// pas de crop du tout : le recentrage forcerait alors la cible sur l'axe dans le
// mode plat hérité, où la visée d'un point EST le produit. `?terre=deux` reste
// donc le dépôt d'avant, au bit près — c'est le second terme du hook.
//
// ⚠️ **ET IL COURT PENDANT LE BALAYAGE DE POSE, CONTRAIREMENT À LA CORRECTION
// DE PIVOT — MESURÉ.** Le balayage de retour au nadir est armé exactement sur le
// front descendant du crop : sans ce terme, le recentrage restait **bloqué
// 138 images** (relevé au navigateur, premier jet de R27) et n'aboutissait que
// par accident, au cran suivant. Le retour d'Adrien commençait donc deux
// secondes trop tard.
//
// ⛔ **CE N'EST PAS UNE BAGARRE, ET C'EST CE QUI LE REND SÛR.** On ne réécrit
// pas la caméra que le balayage vient de poser : on **translate le balayage
// lui-même**, sa cible comprise. `poseFonduArrivee` rend
// `cible.xz + direction_h × r` à `camY` constant ; translater `cible` en x/z
// translate sa sortie du même vecteur, sans toucher ni `camY`, ni `direction`,
// ni l'avancement. **L'inclinaison balayée est donc identique au bit**, et
// D16 ter ne voit rien — c'est vérifié sur la remontée complète, pas supposé.
// Le tween de plongée et les chargements, eux, restent exclus : ils
// INTERPOLENT deux poses absolues, qu'une translation ferait dériver.
function recentrerSurLaTerre() {
  if (!modes || modes.mode !== 'surface') return
  // ⛔ Mêmes gardes que la correction de pivot, MOINS le balayage de pose —
  // voir juste au-dessus.
  if (modes.busy || modes.travel || modes._diveTween) return
  // ⚠️ **LE MÊME PRÉDICAT QUE `_cibleVisee`, ET LA MÊME DÉFINITION** : sur le
  // crop, le pivot appartient au bloc — c'est l'exception qu'Adrien nomme. Deux
  // écritures de la même question finiraient par diverger d'une version ; le
  // hook est le seul énoncé.
  if (!modes.hooks?.horsDuCrop?.()) return
  const dec = decalageRecentrage({
    cibleX: controls.target.x,
    cibleZ: controls.target.z,
    distance: controls.getDistance(),
  })
  if (dec.x === 0 && dec.z === 0) return
  controls.target.x += dec.x
  controls.target.z += dec.z
  camera.position.x += dec.x
  camera.position.z += dec.z
  // ⚠️ **ET LA CIBLE DU BALAYAGE AVEC**, sinon `_avancerFonduPose` reposerait la
  // caméra sur l'ancienne à l'image même : le décalage cesserait d'être rigide,
  // la distance changerait, et `veille-repos` verrait passer exactement ce que
  // tout ce module est fait pour lui cacher.
  const balayage = modes._fonduPose
  if (balayage?.cible) { balayage.cible.x += dec.x; balayage.cible.z += dec.z }
  camera.lookAt(controls.target)
}

let rafId = 0
let tickTimer = 0
// Les programmes GLSL sont-ils compilés ? Déclaré ICI, avant `tick`, et pas à
// côté de son appel : le repli `visibilitychange` ci-dessous peut appeler tick()
// et une variable encore dans sa zone morte lèverait une ReferenceError au pire
// endroit possible. Voir le rendez-vous de préchauffage en bas du fichier.
let programmesPrets = false
// Horloge du mouvement AMBIANT — figée quand l'interrupteur Animations est
// coupé, jamais remise à zéro (voir dtAmb dans tick()) : les décorations qui
// lisent un temps absolu (le clignotement du cadran HUD, par exemple) doivent
// se figer là où elles en étaient, pas sauter à t=0.
let tAmb = 0
// a pending rAF never fires once the tab goes hidden — swap the chain onto
// the timeout fallback at that exact moment so rendering never stalls
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !loopPaused) {
    cancelAnimationFrame(rafId)
    clearTimeout(tickTimer)
    tick()
  }
})
function tick() {
  if (loopPaused) return // offline export owns the frame clock while it runs
  // rAF normally; timeout fallback keeps rendering when the tab is hidden
  if (document.hidden) tickTimer = setTimeout(tick, 40)
  else rafId = requestAnimationFrame(tick)
  // DEUX DELTAS, ET C'EST DÉLIBÉRÉ.
  // `dtBrut` est le temps réellement écoulé. `dt` est celui de la SIMULATION,
  // borné à 0,05 s parce qu'une image à 2 s téléporterait les bateaux, ferait
  // sauter la houle et avancerait les caustiques d'un bloc.
  // ⚠️ Le gouverneur de performance (perf.js) doit recevoir le BRUT. Il a reçu
  // le borné pendant des mois : sa moyenne ne pouvait alors pas descendre sous
  // 20 fps, donc une machine à 3 fps et une machine à 20 fps lui rendaient le
  // même chiffre et la même décision — un seul palier, quand la première en
  // réclamait trois. C'est la moitié du « l'ordi souffle à fond, 3 images par
  // seconde » de l'iMac 2015 du 28/07/2026. Voir l'en-tête de perf.js.
  const dtBrut = clock.getDelta()
  const dt = Math.min(dtBrut, 0.05)
  const t = clock.elapsedTime

  // L'INTERRUPTEUR D'ANIMATIONS — dtAmb est le SEUL delta que reçoivent les
  // consommateurs AMBIANTS (nuages, mer, faune, HUD, grain…). FIGER, PAS
  // CACHER : on continue d'appeler leur update() chaque image (sinon un
  // rendu qui dépend de la caméra courante — billboards, projections —
  // deviendrait faux dès que la caméra bouge), on leur coupe seulement
  // l'avancée du temps. La lecture GPX et les mouvements de caméra ne
  // passent JAMAIS par dtAmb : ce ne sont pas des agréments, voir animations.js.
  const animsOn = animationsActives({ reglage: params.animations })
  const dtAmb = animsOn ? dt : 0
  tAmb += dtAmb

  syncCourseBarMode()
  updateCameraMotion(dt)
  // La fenêtre continue, juste après la caméra : le geste se projette sur les
  // axes de la caméra, donc il lui faut la caméra de CETTE image.
  // ⚠️ Le remappage des boutons est HORS de f3Tick : celui-ci sort à sa garde
  // quand le mode continu est éteint, et c'est justement l'instant où le clic
  // droit doit redevenir un déplacement de caméra.
  appliqueBoutonsSouris()
  f3Tick(dt)
  // Le raffinement du socle, juste après la fenêtre continue : les deux écrivent
  // le relief, et écrire deux fois dans la même image serait payer deux fois.
  socleRaffine()
  // ⚠️ **LA MER DU CROP EST LA SEULE CHOSE DE LA CHAÎNE QUI SE PAIE PAR IMAGE**,
  // et elle est CINQ lignes de plus : `poserMer` construit une calotte figée, et
  // sans cette avance du temps ses vagues de Gerstner ne bougent pas d'un pouce.
  // Le globe sort tout de suite s'il n'y a pas de mer posée.
  if (terreUniqueBranchee) globe?.animerMer(dtAmb)

  // PLUS DE RENORMALISATION DE BRUME PAR IMAGE. Elle existait parce que Début
  // et Fin étaient exprimés pour un cadrage de référence (~40 unités) alors que
  // la caméra bouge — en absolu, zoomé de près tout passait sous « Début » et
  // reculé au-delà de « Fin » la carte disparaissait dans le blanc. C'est
  // précisément le « ça ne fonctionne jamais » qui a fait retirer la brume le
  // 2026-08-02 : le correctif n'a jamais convaincu, et l'effet est parti.

  // Post passes are OWNED here, one place, every frame. The AO pass reads the
  // normal+depth of the CURRENT camera state — during dives/orbital/terrain
  // swaps that state is mid-flight and a broken AO multiplies the whole frame
  // toward black (the reported intermittent black screen). Surface-and-settled
  // only.
  // ⚠️ La passe d'occlusion est chargée à la demande (voir `assureAoPass`) : elle
  // peut ne pas exister. Deux cas, et il faut les deux — si on l'a, on lui pose
  // son état exactement comme avant ; si on ne l'a pas et que quelqu'un vient
  // d'allumer la bascule, on la demande. `assureAoPass` est idempotent et ne
  // relance rien tant que l'import est en vol, donc l'appeler à chaque image
  // pendant les ~100 ms du chargement ne coûte qu'un test.
  if (aoPass) aoPass.enabled = params.ssaoEnabled && params._aoTierOk !== false && modes.mode === 'surface' && !modes.busy
  else if (params.ssaoEnabled) assureAoPass()
  // (la ligne jumelle du bloom vivait ici — passe retirée le 2026-08-02)

  // idle planet spin: in orbital view the Earth slowly turns under the camera
  // until the user takes the controls back
  // ⚠️ dtAmb, PAS dt : cette rotation part TOUTE SEULE après 3 s d'inactivité,
  // personne ne l'a déclenchée — c'est la décoration ambiante, pas le "mouvement
  // de caméra déclenché par l'utilisateur" qu'exclut l'interrupteur (celui-là
  // parle d'un geste, pas d'un écran laissé sans y toucher).
  if (modes.mode === 'orbital' && !modes.busy && !controlsHeld && performance.now() - lastUserInput > 3000) {
    camera.position.applyAxisAngle(UP, dtAmb * 0.035)
    camera.lookAt(0, 0, 0)
  }

  // mode machine: altitude thresholds, glides, altimeter; globe LOD streaming.
  // SUSPENDED during GPX follow: the rail legitimately flies low over the
  // relief, and the mode machine read that as "zooming against the near
  // stop" and fired REFINE transitions mid-playback — whiteout, terrain
  // reload, arrival re-pose. That is the "elle switch d'une vue à l'autre,
  // décroche totalement" field bug, and it clobbered EVERY camera rig alike,
  // which is why six rewrites changed nothing on screen.
  if (!(drone.active && params.gpxFollow && gpxLayer.isPlaying())) modes.update(dt)
  // ══════ ET ON REDRESSE *APRÈS* LE ZOOM AUSSI — Tâche R29 bis ═══════════
  //
  // ⛔ **LA RÉSERVE N° 1 DE R23, FERMÉE, ET C'ÉTAIT UN ORDRE D'APPEL.** Elle
  // écrivait : *« la piste non close : une écriture de caméra qui appelle
  // `controls.update()` elle-même et se fait relever avant le redressement de
  // l'image suivante »*. C'est exactement ça, et ça se lit dans `tick()` :
  // `updateCameraMotion(dt)` — qui porte `distanceMinSol`, `polaireMaxSol` et
  // `redresserSurLeSol` — court **cinquante-sept lignes plus haut** que
  // `modes.update(dt)`, qui porte `_applyZoom`. Le DERNIER à poser la caméra
  // chaque image est donc le glissé de zoom, et plus rien ne regarde le sol
  // après lui : la butée d'angle corrige l'image d'avant pendant que le glissé
  // replonge sur celle-ci, image après image.
  //
  // ⚡ **LE GESTE QUI LE RÉVÈLE EST NEUF, ET C'EST L'ATTAQUANT QUI L'A TROUVÉ**
  // (`.banc/R30/sol.json`) : **tourner PENDANT que l'élan de zoom court** — ce
  // que fait une main qui ne lâche pas la souris entre deux gestes. R23 tournait
  // à distance figée, donc son banc ne pouvait pas le voir. Mesuré avant :
  // **57 images sous le sol sur 16 767 (0,34 %)**, jusqu'à **−7,9906 u** au
  // Svalbard, **8 configurations** hors de la borne de −0,9577 u qu'elle publie.
  //
  // ⚠️ **CE SECOND APPEL NE COÛTE NI `veille-repos` NI D16 ter**, et ce n'est pas
  // un espoir : `redresserSurLeSol` repose la caméra **au même rayon `d`**
  // (`target + d·(sin φ·sin az, cos φ, sin φ·cos az)`), donc `|Δ ln d| = 0` par
  // construction — la même garantie que R23 a établie pour le premier appel. Et
  // il sort en une comparaison (`if (!(phi > max)) return`) sur toute image où
  // la caméra est déjà dégagée, c'est-à-dire presque toutes.
  if (modes.mode === 'surface') redresserSurLeSol()
  zoomStepper?.update()
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
  // ⚠️ **ENTRE LES DEUX, ET LES DEUX BORNES COMPTENT.** Après `majSeuilSocle`,
  // parce que les deux lisent la MÊME altitude à la même image et qu'un socle
  // qui naîtrait sur une altitude et une planète qui s'effacerait sur une autre
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
  majCartoucheGlobe() // D16-c : le cartouche suit la même similitude que la caméra
  majNuagesGlobe() // R20 : le ciel suit la MÊME similitude que le cartouche
  majLoiTextureMonde()
  if (frontiereActive && modes.mode === 'surface') {
    // ⚠️ **LE GLOBE STREAME MAINTENANT EN MODE SURFACE, ET C'EST UN COÛT
    // RÉEL, PAS UN EFFET DE BORD GRATUIT.** Il est le fond : sans cet appel il
    // reste à ses seize racines et le raccord montre une planète floue. Le
    // trafic que ça ouvre n'a PAS été mesuré sur un vol complet — c'est écrit
    // dans le compte rendu de la tâche, et c'est l'une des raisons du drapeau.
    globe.update(camGlobe, dtAmb)
    // ══════ L'HEURE DE LA PLANÈTE — Tâche R7 ═══════════════════════════════
    //
    // Le soleil du fond suivait la même loi qu'en orbite (voir juste dessous) :
    // « un soleil de scène laisserait la moitié du fond dans la nuit ».
    //
    // ⛔ **ET C'EST ICI QUE LE SEUIL SE VOYAIT LE PLUS**, parce que le fond et le
    // crop sont à l'écran EN MÊME TEMPS : le crop est éclairé par l'heure depuis
    // la Tâche P3, la planète dans laquelle il est creusé l'était par la caméra.
    // Mesuré au banc R7, La Réunion, caméra immobile, huit heures : la planète
    // voyait le soleil à **+51,60° aux huit heures** pendant que le crop le
    // voyait de +12,3° à +57,2°.
    //
    // ⚠️ **SOUS LE DRAPEAU, ON NE REPOSE PLUS RIEN ICI** : `placeSun` a déjà
    // poussé le soleil de l'heure, et il ne bouge que quand l'heure ou le lieu
    // bougent. Une pose par image serait un troisième écrivain pour un uniforme
    // qui en avait déjà deux de trop.
    if (poseurDuSoleilDuGlobe(soleilHeureMonde) === 'camera') {
      _orbSun.copy(camGlobe.position).normalize().applyAxisAngle(_upY, -0.73)
      globe.setSunDir(_orbSun)
    }
  }
  if (modes.mode === 'orbital') {
    // dtAmb : seule la coquille de nuages qui orbite la planète (globe-clouds.js)
    // lit ce delta — le reste de globe.update() suit la caméra, pas l'horloge.
    globe.update(frontiereActive ? camGlobe : camera, dtAmb)
    // En orbite le soleil SUIT LA CAMÉRA (validé avec Adrien : un soleil fixe
    // à la scène n'éclairait qu'un hémisphère — la moitié des continents
    // restait à jamais dans la nuit). Décalé de ~42° pour que la face visible
    // soit éclairée MAIS garde son terminateur et l'anneau crépusculaire au
    // limbe — le drame de Google Earth sans sa frustration.
    //
    // ⚠️ **LE DRAPEAU DE LA TÂCHE R7 REVIENT SUR CE CHOIX, ET C'EST DÉLIBÉRÉ.**
    // Corriger le seul fond de la vue surface aurait laissé le saut EXACTEMENT
    // là où Adrien l'a filmé : au franchissement. Levé, la vue orbitale rend
    // l'heure elle aussi — à 03h22 elle devient nocturne. Ce que ça coûte est
    // écrit au drapeau (`flags.js`) : c'est un arbitrage produit, pas une
    // correction silencieuse.
    if (poseurDuSoleilDuGlobe(soleilHeureMonde) === 'camera') {
      _orbSun.copy(camera.position).normalize().applyAxisAngle(_upY, -0.73)
      globe.setSunDir(_orbSun)
    }
  }

  // (Ici vivait le second rattrapage de brume — celui qui repoussait Début/Fin
  // quand la caméra reculait pour cadrer la dalle entière, afin que le relief ne
  // blanchisse pas près de la porte orbitale. Parti avec la brume le 2026-08-02.)

  // refresh camera matrices NOW so DOM projections match this frame's render
  // (otherwise labels are projected with last frame's matrices and lag behind)
  camera.updateMatrixWorld()
  raceLabels.update() // cartouches Race Studio — même règle de fraîcheur
  // FINALE (Adrien) : quand la lecture atteint la fin, la caméra prend du
  // recul en vue isométrique 1 — parcours entier, tous les cartouches, et
  // les flancs du bloc (nom, logo, D+/D-, distance) face caméra
  {
    const playingNow = gpxLayer.isPlaying?.()
    if (playingNow) _wasPlaying = true
    else if (_wasPlaying) {
      _wasPlaying = false
      // Le recul final vaut pour TOUTE course arrivée au bout — Adrien l'a
      // demandé sans condition ; un GPX simple (sans point de passage) y a
      // autant droit qu'une course balisée, d'où l'absence de garde ici.
      if ((gpxLayer.headT ?? 0) >= 0.999) {
        // ⚠️ LA CAUSE SE POSE ICI, PAS PLUS BAS — task 2, CONSTAT 1. Le drapeau
        // ne doit passer à true QUE si c'est CE bloc-ci qui fait le passage
        // true→false : si gpxFollow était déjà à false (l'utilisateur avait
        // cliqué « ✕ Quitter le suivi » avant que le parcours ne finisse tout
        // seul), ce n'est PAS le FINALE qui a coupé le suivi, et le drapeau ne
        // doit pas prétendre le contraire — sinon la relance réarmerait un
        // suivi que l'utilisateur venait justement de refuser.
        if (params.gpxFollow) params.gpxFollowCoupeParFinale = true
        params.gpxFollow = false
        followManual = false
        followZoomVel = 0
        drone.stop()
        // cadrage FINAL : toute la course visible, toutes les étapes, vue
        // depuis la vraie direction isométrique (45° en plan, 35,264° en
        // site) — calcul délégué à un module pur pour rester testable sans
        // three.js (voir test/vue-ensemble.test.js)
        const track = gpxLayer.activeLayer?.gpx?.track
        const pose = track?.world?.length ? poseIsometrique(track.world, { fovDeg: camera.fov }) : null
        if (pose) {
          flyTo(pose.position, pose.cible)
        } else {
          applyIsoView(0)
        }
      }
    }
  }

  if (!params.paused && modes.mode === 'surface') {
    // dtAmb/tAmb partout ici SAUF gpxLayer.tick : nuages, mer, faune, cadran HUD
    // sont le mouvement AMBIANT que l'interrupteur Animations coupe. gpx.js, lui,
    // reçoit le VRAI dt et tranche seul en interne — sa tête de course (lecture
    // GPX) n'est PAS une décoration, seul son scintillement de sillage l'est
    // (voir le commentaire au-dessus de _tempsSillage dans gpx.js).
    hud3.update(dtAmb, tAmb, params)
    // le peuplement du ciel suit la puissance de la machine (Adrien) : le
    // palier du gouverneur de perf pilote le nombre de nuages instanciés
    clouds.setTier?.(aq?.tier ?? 0)
    clouds.update(dtAmb, params, camera, camNuagesBloc())
    traffic.update(dtAmb)
    terrain.tickSurfaceFx(dtAmb, params.fx[params.surfaceFx]?.speed ?? 0) // animate at the effect's speed
    terrain.tickLiquidMetal(dtAmb, params.lmSpeed) // molten flow when liquid metal is on
    terrain.tickSurfaceMaterial(dtAmb) // drifting sand (relief material flow)
    gpxLayer.tick?.(dt) // shimmer: flowing dashOffset highlight along the route line
  }
  // ⚠️ **LA CAMÉRA SUIT LA SCÈNE, comme pour le désencombrement des toponymes**
  // (`mapLayers.setCamera(camGlobe)`) : projeter des points de sphère avec la
  // caméra du bloc calculerait sur un autre monde.
  peaksLayer.update(
    terreUniqueBranchee ? camGlobe : camera,
    window.innerWidth,
    window.innerHeight,
    reperesAffiches(),
    poseurDesReperes(),
  )
  majCotesGlobe()

  // city-label declutter is screen-space (depends on camera projection), so it
  // goes stale as soon as the camera moves — re-run the visibility-only pass
  // at ~5Hz rather than every frame (rebuild() already ran it once synchronously)
  placesRefreshAcc += dt
  if (placesRefreshAcc >= 0.2) {
    placesRefreshAcc = 0
    mapLayers.places.refresh?.()
  }

  // terrain scan progress (uScanT 0→1, auto-idle)
  scan?.update()

  // la mise au point sous le pointeur — à TOUS les zooms (D20), voir
  // `distanceSousLaVisee` ; `null` (ciel, hors carte) : on vise le centre
  if (params.autoFocus) {
    const headW = modes.mode === 'surface' && gpxLayer.isPlaying?.() ? gpxLayer.headWorld : null
    let cibleM = null
    if (headW) {
      // lecture GPX : le bokeh se focalise EN PERMANENCE sur la tête de course
      cibleM = blocVersMetres(camera.position.distanceTo(headW))
    } else {
      viseeFocus.lerp(pointeurSurToile ? mouse : CENTRE_ECRAN, 1 - Math.exp(-dt / TAU_VISEE_FOCUS))
      cibleM = distanceSousLaVisee(viseeFocus)
      if (cibleM == null && pointeurSurToile) cibleM = distanceSousLaVisee(CENTRE_ECRAN)
    }
    if (cibleM != null) params.focusDistance += (cibleM - params.focusDistance) * Math.min(1, dt * 8)
  }
  // `dof` est nul tant que le bokeh n'a pas été allumé (construction paresseuse,
  // voir ensureDof) ; `params.focusDistance` suit quand même, et ensureDof()
  // ensemence le matériau avec — rien n'est perdu tant qu'il n'existe pas.
  if (dof) poserMiseAuPoint(params.focusDistance, params.focusRatio)

  // `half` = le demi-BLOC (l'échelle du bateau), `bord` = où l'eau s'arrête :
  // le bloc, ou l'emprise 3×3 entière en mode continu. Les confondre aurait
  // triplé la vitesse au sol du vapeur — voir l'en-tête de stepBoat.
  // dtAmb : la flotte (bateaux, baleine…) est du mouvement ambiant — figée,
  // elle reste À FLOT là où elle est, elle ne disparaît pas (voir stepBoat).
  boats.update(dtAmb, TERRAIN_SIZE / 2, (TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1)) / 2)
  realWater?.update(dtAmb, sun) // water simulation: waves, caustics, sun glint — figée par dtAmb, jamais cachée
  // temps des caustiques de fond (terrain + blocs voisins du damier) — dtAmb :
  // décoration ambiante, la nappe de caustiques reste visible, juste immobile
  terrain.mapUniforms.uCausT.value += dtAmb
  for (const cell of blockGrid.cells.values()) {
    cell.terrain.mapUniforms.uCausT.value = terrain.mapUniforms.uCausT.value
    cell.terrain.mapUniforms.uSeaCausK.value = terrain.mapUniforms.uSeaCausK.value
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
  // ══════════ LES DEUX ACCALMIES PASSENT AU CROP — Tâche P4 ═══════════════════
  //
  // ⚠️ **JUSTE APRÈS `setView`, ET C'EST TOUT LE POINT** : `setView` est le SEUL
  // écrivain des deux facteurs, et le crop les LIT à la même image. Les
  // recalculer côté globe aurait fait deux lois pour une seule grandeur — la
  // faute que D13 §③ nomme et que ce chantier a déjà payée sur `hNorm` (P2 §3).
  //
  // ⚠️ **SANS MER DE SOCLE, `accalmie` REND LE NEUTRE (1, 1)**, c'est-à-dire la
  // calotte d'avant cette tâche au bit près. Un crop continental ne s'en plaint
  // pas : il n'a pas de mer à calmer.
  // ══════════ ET LE FOND MARIN AVEC — Tâche P5 ═══════════════════════════════
  //
  // ⛔ **LES TROIS COULEURS DE LA RAMPE NAUTIQUE NE VENAIENT DE NULLE PART.**
  // `poserMer` portait un paramètre `couleursFond` que **personne n'a jamais
  // passé** : la calotte gelait donc le défaut de `terrain.js` (`#dce8ec` /
  // `#7fa8b8` / `#31576b`) pendant que le socle vit sur la palette ET sur le
  // fond de `SEABEDS` choisi dans le panneau « Sea » — relevé le 2026-08-22 à
  // `#c8f2e4` / `#62cfc1` / `#136e7d`. Même faute que la couleur des parois
  // (manque n° 2 du noteur) et que `uSky` (P4).
  //
  // ⚠️ **ICI ET PAS DANS `contexteCrop`, ET C'EST UNE QUESTION DE FRAÎCHEUR** :
  // une palette ou un fond de mer changent SANS déplacer le crop, donc sans
  // rejouer `poserMer`. Passer par le contexte aurait laissé la mer sur
  // l'ancienne palette jusqu'au prochain déplacement — c'est exactement ce que
  // `rampe2D` a coûté à la Tâche P2. Par image, c'est trois `Color.copy`.
  //
  // ⚠️ **LES TROIS UNIFORMES SE LISENT UN PAR UN, JAMAIS EN BLOC**, et ce n'est
  // pas un goût : `test/damier-uniformes.test.js` ③ interdit de céder
  // `terrain.mapUniforms` à qui que ce soit. Il a attrapé la première écriture
  // de cette tâche, qui passait la poignée entière.
  if (terreUniqueBranchee) {
    globe?.majReglagesMer({
      ...realWater?.reglagesMer,
      fond: couleursFondDuSocle(
        terrain.mapUniforms.uOceanShallow.value,
        terrain.mapUniforms.uOceanMid.value,
        terrain.mapUniforms.uOceanDeep.value,
      ),
    })
  }
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
  // fantaisiste et ferait grimper le palier de qualité sur des images vides.
  if (!programmesPrets) return
  aq.update(dtBrut) // adaptive quality : le temps RÉEL, jamais le dt de simulation (voir plus haut)
  majCarteOmbre() // la carte d'ombre n'est redessinée que si elle changerait
  // dtAmb, PAS dt : c'est CE delta que le composer transmet à ses passes, et
  // c'est lui qui fait vivre le grain (NoiseEffect anime son bruit sur un
  // uniforme `time` alimenté par ce paramètre — voir node_modules/postprocessing
  // src/effects/NoiseEffect.js). Le reste de la chaîne (SSAO, DoF, tons, SMAA)
  // ne lit pas ce delta ; seul le grain scintillait tout seul.
  composer.render(dtAmb)
  if (recorder?.recording) recorder.captureFrame() // null until first export
}

// LE RENDEZ-VOUS AVEC LE PILOTE GRAPHIQUE — pourquoi il existe, en une phrase :
// MESURÉ (cache froid, build de prod, RTX 3080) le tout premier dessin bloquait
// le fil principal 1 845 ms d'affilée — pas UNE image produite pendant ce
// temps, la planète de l'écran de chargement à l'arrêt. Ce n'était ni le
// réseau ni le JavaScript : c'était le pilote qui compilait les shaders, que
// three réclame au pire moment (getUniforms → getProgramInfoLog, qui attend).
// Le préchauffage laisse le pilote compiler sur ses propres fils pendant que le
// fil principal reste libre — les tuiles d'altitude arrivent et le relief se
// construit pendant ce temps. La toile est cachée sous l'écran de chargement :
// il n'y a rigoureusement rien à voir à repousser de quelques images.
// ⚠️ Pas de `.catch` ici, et c'est voulu : warmupPrograms ne rejette JAMAIS et
// s'abandonne d'elle-même au bout de 6 s. C'est ce contrat — et ses tests — qui
// rend cette ligne sûre. Ne pas l'affaiblir sans les relire.
// `target` = le tampon HDR dans lequel la chaine de post-traitement rend
// vraiment. Compiler contre le canevas a la place produisait NEUF programmes
// inutilises (les cles de programme de three portent l espace colorimetrique
// de sortie). Avec la cible : trois. Meme fluidite, cinq fois moins de gachis.
warmupPrograms({ renderer, scene, camera, target: composer.inputBuffer }).then(() => { programmesPrets = true })
tick()

// ---- mode EMBED (shibumap.com/templates) ------------------------------------
// ?embed=1 : aucune UI, et la page hôte pilote la carte en live par postMessage.
// Protocole : l'app poste {type:'shibumap:ready'} à son parent ; le parent envoie
//   {type:'shibumap:apply', look}   → applique un look (partiel ou complet, mêmes
//                                     clés que le champ "look" des templates JSON)
//   {type:'shibumap:palette', palette} → applique juste une palette
//   {type:'shibumap:goto', lat, lon, zoom} → vole vers une zone
// Contrat STABLE : les clés de look inconnues sont ignorées (applyUserTemplate ne
// pose que les TEMPLATE_KEYS présents), donc les mises à jour ne cassent pas le site.
const EMBED = IS_EMBED
if (EMBED) {
  // vitrine shibumap.com/templates : AUCUNE UI (pas même l'œil), et la zone est
  // VERROUILLÉE (molette neutralisée → on ne charge que le bloc de test). Seule
  // la rotation orbitale reste. La page hôte pilote look/palette/goto.
  document.body.classList.add('ce-noui', 'ce-embed')
  modes.locked = true // molette off : pas de changement de zoom/zone (voir modes.js)
  window.addEventListener('message', (ev) => {
    const d = ev.data || {}
    try {
      if (d.type === 'shibumap:apply' && d.look) applyUserTemplate({ look: d.look })
      else if (d.type === 'shibumap:palette' && d.palette) { applyPaletteWithBg(d.palette); refreshAll() }
      // quitteCadrageDamier avant modes.flyTo : il repasse par l'orbite, voir le bouton globe
      else if (d.type === 'shibumap:goto' && Number.isFinite(d.lat) && Number.isFinite(d.lon)) { quitteCadrageDamier(); modes.flyTo(d.lat, d.lon, d.zoom ?? 10) }
    } catch {}
  })
  try { window.parent?.postMessage({ type: 'shibumap:ready' }, '*') } catch {}
}

// ---- boutique in-app (« View templates ») --------------------------------
// Voir src/ui/store.js. Réutilise EMBED_SHOWCASE + modes.locked : la zone de
// test (EMBED_SHOWCASE) limite le chargement, comme l'embed. Le snapshot capture
// look + zone + caméra et les restaure à la sortie — on reprend le travail
// exactement où on l'avait laissé.
const store = buildStore({
  captureState: () => ({
    look: captureLook(params),
    lat: params.demLat, lon: params.demLon, zoom: params.demZoom, loc: params.demLocation,
    cam: { pos: camera.position.clone(), target: controls.target.clone() },
  }),
  restoreState: async (s) => {
    if (!s) return
    applyUserTemplate({ look: s.look })
    if (s.lat !== params.demLat || s.lon !== params.demLon || s.zoom !== params.demZoom) {
      params.demLat = s.lat
      params.demLon = s.lon
      params.demZoom = s.zoom
      params.demLocation = s.loc
      await loadRealTerrain()
    }
    camera.position.copy(s.cam.pos)
    controls.target.copy(s.cam.target)
    controls.update()
    refreshAll()
  },
  gotoShowcase: async () => {
    if (!(params.demLat === EMBED_SHOWCASE.lat && params.demLon === EMBED_SHOWCASE.lon && params.demZoom === EMBED_SHOWCASE.zoom)) {
      params.demLat = EMBED_SHOWCASE.lat
      params.demLon = EMBED_SHOWCASE.lon
      params.demZoom = EMBED_SHOWCASE.zoom
      params.demLocation = EMBED_SHOWCASE.name
      await loadRealTerrain()
    }
    applyIsoView(0) // on arrive sur la vue isométrique 1, cadrée large (Adrien)
  },
  setLocked: (v) => { modes.locked = v },
  applyLook: (look) => { applyUserTemplate({ look }); refreshAll() },
  applyPalette: (p) => { applyPaletteWithBg(p); refreshAll() },
  getUserPalettes: () => userPalettes,
  saveShopPalettes: (list) => { userPalettes = list; saveUserPalettes(userPalettes) },
  refreshPaletteRow: () => paletteRefreshFn(),
  getUserTemplates: () => userTemplates,
  importTemplateText,
  refreshTemplateRow: () => userTplRefreshFn(),
})
panelCtx.openStore = () => store.enter() // le bouton lit ctx.openStore au clic, pas au build

// ---- Race Studio (wizard organisateurs — voir src/ui/studio.js) ----------
const studio = buildStudio({
  params,
  refreshAll,
  captureState: () => ({
    look: captureLook(params),
    cam: { pos: camera.position.clone(), target: controls.target.clone() },
  }),
  restoreState: async (s) => {
    if (!s) return
    applyUserTemplate({ look: s.look })
    camera.position.copy(s.cam.pos)
    controls.target.copy(s.cam.target)
    controls.update()
    refreshAll()
  },
  hasTrack: () => !!gpxLayer.activeLayer?.gpx?.track,
  // gpxFileInput DIRECT : panelCtx.loadGpx n'existe pas (loadGpx ne vit que
  // dans le ctx du panneau Parcours) — le ?. rendait le bouton muet
  loadGpx: () => gpxFileInput.click(),
  // glisser-déposer de l'étape « Trace » : openTrackFile trie déjà GPX vs
  // projet .shibumap-race, donc le drop accepte exactement ce que le
  // sélecteur de fichiers accepte — une seule règle, pas deux
  openTrackFile: (f) => openTrackFile(f),
  trackStats: () => {
    const t = gpxLayer.activeLayer?.gpx?.track
    if (!t) return null
    const eles = t.points.map((p) => p.ele || 0)
    return { km: t.cumKm[t.cumKm.length - 1], ...ascentStats(eles) }
  },
  altAtKm: (km) => {
    const t = gpxLayer.activeLayer?.gpx?.track
    if (!t) return null
    return Math.round(t.points[snapToKm(t.cumKm, km)]?.ele ?? 0)
  },
  // brouillon studio → raceState (helper partagé avec bootInitialView)
  syncRace: syncRaceState,
  setTransportCats,
  setGpxStyle: (kv) => { applyUserTemplate({ look: kv }); refreshAll() },
  captureLook: () => captureLook(params),
  currentGpxText: () => gpxLayer.activeLayer?.sourceText || '',
  importRace: async (bundle) => {
    // loadGpxText (et pas addLayer nu) : recadre le terrain sur la trace,
    // reconstruit le monde, drape — sinon altitudes/ancres restent vides
    if (bundle.gpxText) await loadGpxText(bundle.gpxText)
    // le calque porte le NOM DE LA COURSE, pas le <name> brut du GPX —
    // c'est ce que listent le mini panneau Parcours et « Mes courses »,
    // et la clé du brouillon (draftKey) suit le même nom
    if (bundle.race?.name && gpxLayer.activeLayer) gpxLayer.setName(gpxLayer.activeLayer.id, bundle.race.name)
    if (bundle.look && Object.keys(bundle.look).length) applyUserTemplate({ look: bundle.look })
    refreshAll()
  },
  share: () => shareCurrentView(),
  // sélecteur de courses (plusieurs GPX chargés) + brouillon par course
  activeRaceName: () => gpxLayer.activeLayer?.name || null,
  listRaces: () => gpxLayer.layers.map((l) => ({ id: l.id, name: l.name, active: l === gpxLayer.activeLayer })),
  focusRace: (id) => gpxLayer.focus(id),
})
panelCtx.openStudio = () => studio.enter()
adoptRaceDraft = (race) => studio.adoptRace(race)

// ---- Studio unifié (UX P2 — src/ui/atelier.js) ---------------------------
// L'assistant du MODE SIMPLE : ① Template ② Palette ③ Ciel ④ Calques ⑤ Météo.
// Il tient un SNAPSHOT du look d'arrivée — c'est ce qui donne un sens à son
// bouton « Terminer » (Annuler repose le look, Terminer le garde ; sans
// snapshot les deux boutons auraient fait la même chose, d'où l'absence
// historique de validation). Un LOOK suffit, pas l'état complet de la
// boutique : habiller ne déplace jamais la carte, il n'y a rien d'autre à
// reposer. La boutique reste l'espace d'achat séparé.
const atelier = buildAtelier({
  params,
  captureLook: () => captureLook(params),
  applyLook: (snap) => applyAllParams(snap),
  applyPalette: (p) => { applyPaletteWithBg(p); refreshAll() },
  generatePalette: generateEarthPalette,
  saveCurrentPalette: (name) => panelCtx.saveCurrentPalette(name),
  userPalettes: () => userPalettes,
  getUserTemplates: () => userTemplates,
  applyUserTemplate: (t) => { applyUserTemplate(t); refreshAll() },
  environments: ENVIRONMENTS,
  getBgEnv: () => params.bgEnv || '',
  setBgEnv: (id) => { params.bgEnv = id || ''; applyBackground() },
  // ④ Calques — exactement les leviers du panneau Carte (mode avancé), qui est
  // devenu inatteignable en simple quand il a rejoint le Studio avancé
  rebuildMapLayers,
  refreshAerial,
  refreshAll,
  // ⑤ Météo — exactement les leviers du panneau Éléments
  rebuildClouds: () => { clouds.build(params); clouds.setVisible(params.cloudsEnabled && socleAffiche()) },
  setWaves: (w) => realWater?.setWaves?.(w),
  setSeaEnabled: (v) => setSeaEnabled(v),
  openStore: () => store.enter(),
  // ---- ⓪ Zone + verrou de zoom --------------------------------------------
  // La zone ne fait PAS partie du look (un template ne porte pas la
  // localisation, cf. templates-user.js) : elle a donc ses propres deps, et
  // « Annuler » ne la repose pas — il n'a jamais promis de le faire.
  getZone: () => ({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, name: params.demLocation }),
  // « A-t-il déjà navigué ? » : START_VIEW est la carte sur laquelle
  // l'application s'ouvre, personne ne l'a choisie. Dès qu'on cherche un lieu
  // ou qu'on vole quelque part, demLocation cesse de valoir son nom. Pas de
  // clé de stockage à inventer : l'état courant dit déjà la vérité.
  hasZone: () => params.demLocation !== START_VIEW.name,
  searchZone: (q) => (parseLatLon(q) ? gotoCtl.go(q) : gotoCtl.search(q)),
  flyTo: (lat, lon, zoom, name = null) => { setRegionTarget(name ? { name } : null); quitteCadrageDamier(); return modes.flyTo(lat, lon, zoom) }, // quitteCadrageDamier : `modes.flyTo` repasse par l'orbite, voir le bouton globe
  // ⑧ Le zoom se fige pendant l'habillage — même levier que la boutique
  // (store.js). modes.locked neutralise la molette et l'escalier de niveaux ;
  // flyTo passe toujours, sinon l'étape ⓪ ne pourrait plus déménager la carte.
  setLocked: (v) => { modes.locked = v },
})
panelCtx.openAtelier = () => atelier.enter() // quickbar (lit au clic, pas au build)

// ---- ACCUEIL (UX P1) — LA barre, en grand, au centre -----------------------
// Plus de popup à trois portes : les trois portes déclenchaient EXACTEMENT les
// trois actions du cœur simple de la barre. C'est donc le même objet, dessiné
// une seule fois : buildHub ne pose que le voile et les mots autour, la barre
// fait le reste (elembar.setHome).
const hub = buildHub({ bar: elemBar, bottomBar, onExplore: () => {} })
// le logo de la topbar fait remonter la barre au centre (et la repose)
{
  const mark = document.querySelector('.ce-wordmark')
  if (mark) { mark.style.cursor = 'pointer'; mark.addEventListener('click', () => hub.toggle()) }
}
panelCtx.refreshRaceLabels = () => raceLabels.setDirty() // toggle infos course par calque

// ---- la BASCULE « on vient de charger un parcours » -----------------------
// Déclarée en haut (`let enterRouteSpace`), posée ICI : elle a besoin de la
// barre, du Race Studio et de l'accueil, tous construits plus haut.
// Ce qu'elle ne fait PAS : changer le niveau Simple/Avancé. Le niveau est le
// choix de l'utilisateur — on l'oriente vers le bon espace DANS son niveau.
enterRouteSpace = (content) => {
  // le viewer d'une shibu reçue (#s=/#r=) et la vitrine embarquée n'ont ni
  // barre de modes ni Race Studio : il n'y a nulle part où envoyer qui que ce
  // soit, et forcer un espace y casserait le chrome nu.
  if (IS_EMBED || IS_SHIBU) return
  // le NIVEAU se lit dans la préférence, pas dans body.ce-simple : l'accueil
  // force le cœur simple à l'écran sans que le choix ait bougé.
  const target = routeEntryFor(content, { advanced: isUiAdvanced() })
  if (!target) return
  hub.hide() // l'accueil et son voile resteraient par-dessus l'espace ouvert
  document.body.classList.remove('ce-explore') // idem pour le dock Explorer du mode simple
  // Le mode de travail est posé dans les DEUX niveaux, même quand c'est le Race
  // Studio qui s'ouvre : sinon un passage ultérieur en Avancé rouvrait le dock
  // sur le mode d'avant — panneaux éteints (wm-off), dock vide. Déjà vu.
  elemBar?.setMode('parcours')
  for (const b of quickCore?.querySelectorAll('.ce-wm-btn') || []) b.classList.toggle('on', b.dataset.mode === 'parcours')
  elemBar?.refresh?.() // la coche liquide et le pont voyagent sous le mode actif
  if (target === 'race-studio') studio.enter()
}

// first visit only: the guided tour introduces the UI once the boot view has
// had a moment to settle (replayable anytime from the "?" in the top bar).
// Jamais en mode embed — la vitrine /templates doit rester nue.
setTimeout(() => {
  if (EMBED) return
  if (IS_SHIBU) return // une shibu reçue : viewer épuré, jamais d'onboarding
  // ⚠️ EN TÊTE, ET SUR LE MÊME RENDEZ-VOUS QUE LA VISITE GUIDÉE. Quelqu'un qui
  // revient de chez Stripe n'a pas besoin qu'on lui présente l'interface : il
  // attend une réponse sur son paiement. Et le relief doit être là — l'écran
  // d'affiche refait un rendu, il lui faut une scène.
  // ⚠️ LE BALAI PASSE À CHAQUE VISITE, PAS SEULEMENT AU RETOUR DE LA CAISSE. Un
  // achat abandonné laisse un PDF de plusieurs mégaoctets dans le navigateur ;
  // sans ce passage, il y dormirait jusqu'au prochain paiement — c'est-à-dire
  // peut-être jamais. Une affiche dit où quelqu'un est allé : ce n'est pas une
  // donnée à laisser traîner. Voir DUREE_VIE_MS (src/coffre-affiche.js).
  import('./coffre-affiche.js').then((m) => m.purger()).catch(() => {})
  if (RETOUR_PAIEMENT.cas) { reprendreApresPaiement(); return }
  if (IS_STORE_BOOT) { store.enter(); return } // /templates → boutique directe
  if (IS_STUDIO_BOOT) { studio.enter(); return } // ?studio=1 → Race Studio direct
}, 2500)

// l'ACCUEIL, lui, arrive VITE : la barre est déjà à l'écran, elle ne fait que
// s'élever au centre. Attendre 2,5 s laisserait le temps de la lire en bas et
// le mouvement perdrait son sens — on verrait deux objets au lieu d'un.
// Mêmes gardes que ci-dessus (à 900 ms, store-mode/studio-mode ne sont pas
// encore posées : c'est le drapeau de boot qu'il faut interroger, pas la classe).
setTimeout(() => {
  if (EMBED || IS_SHIBU || IS_STORE_BOOT || IS_STUDIO_BOOT) return
  // L'accueil s'élèverait par-dessus la réponse au paiement, et l'écran
  // d'affiche s'ouvrirait derrière lui.
  if (RETOUR_PAIEMENT.cas) return
  hub.show()
}, 900)

window.addEventListener('resize', () => {
  if (loopPaused) return // an offline export owns the renderer size right now
  // TOUT passe par applyRenderSize, et rien d'autre. Cette fonction mesure le
  // conteneur (en boutique / Studio, `#app` n'est qu'un cadre — la fenêtre
  // mentirait), arrondit à l'entier pair (carré noir), pose l'aspect de la
  // caméra, et depuis le 28/07/2026 borne le tampon de dessin à ce que la carte
  // graphique accepte — proportionnellement, sinon c'est Chrome qui rabote une
  // seule dimension, en silence.
  // Elle renvoie null quand le conteneur fait 0×0 (onglet caché, panneau
  // replié, iframe pas encore posée) : on ne touche alors à RIEN, surtout pas à
  // l'aspect — un `0 / 0` y poserait un NaN que même un retour à 1280×720 ne
  // répare pas, et toutes les projections écran en x seraient perdues sans une
  // ligne en console. Voir viewport.js.
  const taille = applyRenderSize({ renderer, composer, camera, pixelRatio: params.pixelRatio })
  if (!taille) return
  const [rw, rh] = taille
  gpxLayer.onResize(rw, rh)
  mapLayers.onResize(rw, rh)
  syncGpxProfilePosition()
  reclampDraggables()
})
