import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  DepthOfFieldEffect,
  VignetteEffect,
  NoiseEffect,
  SMAAEffect,
  BloomEffect,
  KernelSize,
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
import { loadDem } from './dem.js'
import { Globe } from './globe.js'
import { Modes, stepZoom } from './modes.js'
import { createGoto } from './goto.js'
import { frameTrack } from './gpx.js'
import { GpxLayerManager } from './gpx-layers.js'
import { SPORTS, DEFAULT_SPORT, sanitizeSvgMarkup, isValidIconDataUrl, rasterizeToCanvas } from './ui/sport-icons.js'
import { worldToLatLon } from './geo.js'
import { TERRAIN_SIZE } from './terrain.js'
import { FX_LIST, FX_META, defaultFxParams } from './fx-meta.js'
import { monochromeLook } from './palette.js'
import { peakVantage } from './camera-poses.js'
import { focusRayHit } from './autofocus.js'
import { GroundInfoLayer } from './ground-info-layer.js'
import { PeaksLayer } from './peaks.js'
import { Clouds } from './clouds.js'
import { Traffic } from './traffic.js'
import { RealWater } from './ocean.js'
import { FLAGS } from './flags.js'
import { MapLayers } from './map/layer-manager.js'
import { AerialLayer, blockBounds, aerialUnavailable, SUPERSEDED, providerFor as providerForAerial } from './map/aerial-layer.js'
import { lightingFor, darkModeFor } from './daycycle.js'
import { SunDisc } from './sun-disc.js'
import { Plinth } from './plinth.js'
import { makeDraggable, reclampDraggables } from './drag.js'
import { ScanController } from './scan.js'
import { fetchRegionMask } from './region-mask.js'
import { fetchCoastMask, COAST_ZOOM_MIN, COAST_ZOOM_MAX } from './coast-mask.js'
import { buildRegionSkirt } from './region-skirt.js'
import { makeSocleEnvMap } from './socle-env.js'
import { GLASS_BY_ID, PBR_BY_ID } from './material-presets.js'
import { TEMPLATE_KEYS, captureLook, serializeTemplate, parseTemplate, stripFromLook, loadUserTemplates, saveUserTemplates } from './templates-user.js'
import { captureShareState, parseShareState, encodeShareState, decodeShareState, trackToGpx, parseRacePayload, RACE_ENDPOINT } from './share-link.js'
import { DroneCam } from './drone-cam.js'
import { makeGradientTexture, deriveBgColors, BG_MODES, ENVIRONMENTS, ENV_BY_ID } from './background.js'
import { CameraAutomation, CAMERA_MOVES } from './camera-automation.js'
import { N8AOPostPass } from 'n8ao'
import { History } from './history.js'
import { bindShortcuts } from './shortcuts.js'
import { refreshAll } from './ui/kit.js'
import { showNotice } from './ui/toast.js'
import { showFollowPad, hideFollowPad } from './ui/follow-pad.js'
import { buildTopBar, buildBottomBar, buildIsoButton, buildCineButton, buildCredits, buildMapCorner } from './ui/bars.js'
import { TEMPLATES } from './templates.js'
import { buildShortcutsOverlay } from './ui/shortcuts-overlay.js'
import { buildChangelogOverlay } from './ui/changelog-overlay.js'
import { APP_STAGE } from './changelog.js'
import { BlockGrid } from './block-grid.js'
import { buildTemplatesPanel } from './ui/templates-panel.js'
import { buildCreatePanel } from './ui/create-panel.js'
import { buildCameraPanel } from './ui/camera-panel.js'
import { buildRoutePanel } from './ui/route-panel.js'
import { buildExplorePanel } from './ui/explore-panel.js'
import { buildScanPanel } from './ui/scan-panel.js'
import { buildShadersPanel } from './ui/shaders-panel.js'
import { buildMapPanel } from './ui/map-panel.js'
import { buildEffectsPanel } from './ui/effects-panel.js'
import { buildHourPill } from './ui/hour-pill.js'
import { buildZoomStepper } from './ui/zoom-stepper.js'
import { initTips } from './ui/tips.js'
import { createAdaptiveQuality } from './perf.js'
import { detailForZoom } from './zoom-detail.js'
import './ui/v28.css'
// the export stack (modal + Recorder + mediabunny encoder) is heavy and only
// needed on demand — it is dynamic-import()ed on the first Export click, so
// it lives in its own async chunk and never delays first paint

// ------------------------------------------------------------------ params

const DEM_PRESETS = {
  'Monument Valley': [36.998, -110.0984],
  'Grand Canyon': [36.0997, -112.1124],
  Chamonix: [45.9237, 6.8694],
  Matterhorn: [45.9766, 7.6585],
  'Mount Fuji': [35.3606, 138.7274],
  'Death Valley': [36.2679, -116.8253],
  'Everest Massif': [27.9881, 86.925],
  Landmannalaugar: [63.983, -19.056],
  Custom: null,
}

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
  resolution: 1024,

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
  autoFocus: true, // pointer→terrain autofocus (replaces the old cone autofocus)
  focusDistance: 13.2698,
  focusRange: 45, // wide in-focus band by default — most of the relief stays sharp
  // Depth of field is OFF by default and gated by an explicit flag, mirroring
  // fogEnabled. bokehScale alone can't serve as the gate: it doubles as the
  // strength slider, so "off" would mean losing the user's chosen strength.
  bokehEnabled: false,
  bokehScale: 3.7,

  // map overlay
  mapTint: 1.0,
  heightContrast: 5.1,
  heightPivot: 0.53,
  // 8-stop hypsometric land ramp (low → high). The single source of truth for
  // land color; templates and generated palettes fill all eight.
  rampStops: [
    { c: '#ffffff', p: 0.0 },
    { c: '#ffffff', p: 0.16 },
    { c: '#fbf6ee', p: 0.3 },
    { c: '#f7ecd8', p: 0.44 },
    { c: '#f3ddb6', p: 0.58 },
    { c: '#efc588', p: 0.72 },
    { c: '#f0ac66', p: 0.87 },
    { c: '#ffa861', p: 1.0 },
  ],
  slopeTint: 0.5,
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
  hudAccent: '#ff4d00',
  hudInk: '#17191b',
  sweepSpeed: 2.5,
  scanColor: '#ccd6ff',
  scanDuration: 4.6,
  scanWidth: 0.8,
  scanBlur: 0.86,
  scanDispHeight: 1.16,
  scanDispFalloff: 1.2,

  // look
  exposure: 0.96,
  // render upgrades (2026-07-20 plan): both ON by default — the adaptive
  // quality governor sheds them on machines that can't hold 60 fps, so a
  // forked "high mode" is deliberately NOT a thing (see the plan doc).
  ssaoEnabled: false,
  ssaoIntensity: 6, // nudged up: half-res AO reads ~16% softer than full-res (measured)
  bloomEnabled: false,
  bloomIntensity: 0.55,
  bloomThreshold: 0.85,
  contrast: 0.07,
  saturation: -0.35,
  vignette: 0.6,
  grain: 0, // off by default — opt in via Look → grain
  fogNear: 35.5,
  fogFar: 50,
  fogColor: '#ffffff',
  fogEnabled: false, // depth fog on/off (Effects)
  // background: solid (fogColor) or a gradient (linear/radial/mesh) of A/B/C.
  // The gradient's top colour is bgColorA — SEPARATE from the fog colour, so a
  // gradient never washes out the fog.
  bgMode: 'solid',
  bgEnv: '', // '' = none; otherwise an HDRI sky id (overrides the solid/gradient backdrop)
  bgColorA: '#e9eef4',
  bgColorB: '#dfe6ef',
  bgColorC: '#c7d2df',
  bgAngle: 135,
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

  // performance
  pixelRatio: 2, // render scale defaults to 2 by request (the perf governor may still step it down under sustained load)
  shadowMode: 'dynamic',
  shadowRes: 2048,

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
  // drone-follow during playback: ON by default (task 24 — "par défaut on
  // active le drone follow"), the playback IS the product so the cinematic
  // chase should be what an organiser sees without having to find the
  // toggle. 1x matches the default reveal pace (totalKm*1.5s, see gpx.js
  // tick()); 0.5x–3x covers "slow enough to read the terrain" to "quick preview"
  gpxFollow: true,
  gpxFollowSpeed: 1,

  // ocean (real-world bathymetry read)
  oceanShallow: '#dce8ec',
  oceanMid: '#7fa8b8',
  oceanDeep: '#31576b',

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
  cloudOpacity: 1.5, // density scale of the volumetric deck
  cloudAltitude: 4.5, // deck base height in world units — 0 puts the clouds at ground level
  cloudDrift: 3,
  cloudScale: 5, // noise tiling across the deck (higher = smaller cloud cells)
  cloudCoverage: 0.62, // 0 = continuous sheet, higher = broken cumulus with gaps
  cloudBillow: 0.4, // vertical billowing: 0 = flat slab, 1 = tall domed tops
  cloudBrightness: 2.9, // sunlight brightness inside the deck
  cloudAltSpread: 0.5, // per-cloud altitude variation: 0 = one flight level, 1 = staggered layers
  cloudDriftVar: 0.5, // per-cloud speed variation: 0 = uniform drift, 1 = very uneven
  cloudContrast: 1, // density contrast: <1 fluffier/softer, >1 harder-edged
  cloudSSS: 0.8, // cloud translucency: thin wisps light up as the sun shines through
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
  seaWaveH: 0.8, // wave height, in spectrum metres — visible resting sea (cool > realistic)
  seaChop: 0.7, // crest sharpening 0..1 — breaking whitecaps appear past ~0.6
  seaSpeed: 1, // time multiplier over the deep-water dispersion
  seaSeed: 0, // 0 = random sea each rebuild; a saved seed replays an exact sea
  seaBed: 'map', // fond sous la mer (vignettes) : map | sand | lagoon | abyss | seagrass | ink
  seaEdge: true, // jupe de verre au bord du socle (comble le vide surface/fond)
  seaEdgeFrost: 0.5, // 0 = verre clair, 1 = verre depoli
  seaRefract: 0.6, // intensite de la refraction (deformation du fond vu a travers)

  // SP1 map overlay layers (roads/water/places), draped on the relief
  roadsEnabled: false,
  roadsOpacity: 0.9,
  roadsDetail: 1,
  roadColor: '',
  waterEnabled: true, // lakes on by default — the world lake layer is cheap (fetch-on-view)
  waterOpacity: 0.9,
  waterFill: true,
  // Coastline outline — OFF. Natural Earth 1:10m is too coarse to trace a real
  // coast: its straight chords cut corners the terrain + bathymetry underneath
  // already draw correctly, so the map reads better bare than outlined. Kept as
  // an option rather than removed. See water-layer.js's coastRings.
  coastLine: false,
  // Aerial photo skin — OFF. First narrow test: IGN orthophotos, Annecy only.
  // The product's identity is the quiet editorial relief; photography is a tool
  // the organiser reaches for, never the default look. See map/aerial-layer.js.
  aerialEnabled: false,
  aerialOpacity: 1, // à l'activation, la photo couvre pleinement (retour Adrien)
  aerialCoastFade: 0.1, // v49 : la photo s'estompe sous l'eau au-delà du rivage (0 = off)
  placesEnabled: true,
  placesDensity: 1,
  placesSize: 1,
  // ON by default: the outline is what makes the names read cleanly over busy
  // relief ("mets un contour blanc autour des lettres"). It used to default off
  // because the old centred strokeText bled half its width INTO the glyph and
  // made type look mushy — text-label.js now stamps a ring of fills around the
  // letterform instead, so the ink glyph stays crisp and there's no reason to
  // ship it off.
  placesHalo: true,
  // Summit markers (Map panel "Markers" section): ON by default — the v1
  // experience always showed the top-N named peaks on a real-terrain patch;
  // this key simply never existed in params before (see peaksLayer.setEnabled
  // below, near its construction), so the toggle silently stayed off no
  // matter what map-panel.js's `?? false` fallback read.
  peaksEnabled: true,

  // light
  sunIntensity: 7.6,
  sunAzimuth: 162,
  sunElevation: 16,
  hemiIntensity: 0.6,
  envLight: 0.16,
  shadowSoftness: 5,
  timeOfDay: 10, // 24 h sun-cycle slider (0..24) — drives sun az/el/intensity/colour
  dayCycleSpeed: 1, // auto-cycle speed 1..100 : 1 = a full 24 h in 1 min
}

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
    }
  } catch (err) {
    console.warn('share link ignored:', err) // a garbled/old-format fragment just boots the default view
  }
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
if (location.hash.startsWith('#r=')) {
  const raceId = location.hash.slice(3)
  if (/^[A-Za-z0-9_-]{4,64}$/.test(raceId)) {
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
function hideLoading() {
  if (loadingDismissedOnce) {
    loadingEl.classList.add('hidden')
    return
  }
  const wait = Math.max(0, LOADING_MIN_MS - (performance.now() - loadingStart))
  setTimeout(() => {
    loadingDismissedOnce = true
    loadingEl.classList.add('hidden')
  }, wait)
}

const renderer = new THREE.WebGLRenderer({
  powerPreference: 'high-performance',
  antialias: false, // SMAA runs in the post chain
  stencil: false,
  depth: false,
})
renderer.setPixelRatio(params.pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
// VSM so the shadow blur radius is a real, adjustable softness control
renderer.shadowMap.type = THREE.VSMShadowMap
// tone mapping happens in the post chain (three skips renderer tone mapping
// when drawing into the composer's HDR buffer, which is why exposure felt dead)
renderer.toneMapping = THREE.NoToneMapping
container.appendChild(renderer.domElement)

const scene = new THREE.Scene()
// background can be a flat colour or a gradient texture (disposed on change)
let _bgTex = null
function applyBackground() {
  // an HDRI sky, when chosen, takes over the whole backdrop + lighting
  if (params.bgEnv) { applyEnvironment(); return }
  // no HDRI → make sure neutral IBL is back (a sky may have replaced it)
  if (scene.environment !== roomEnvTex) scene.environment = roomEnvTex
  _envBg = null
  if (_bgTex) { _bgTex.dispose(); _bgTex = null }
  if (!params.bgMode || params.bgMode === 'solid') {
    scene.background = new THREE.Color(params.fogColor) // solid backdrop = the fog colour
  } else {
    _bgTex = makeGradientTexture({ mode: params.bgMode, a: params.bgColorA, b: params.bgColorB, c: params.bgColorC, angle: params.bgAngle })
    scene.background = _bgTex
  }
}
// HDRI sky environment: the equirect drives both the backdrop and the image-based
// lighting (reflections). Textures are lazy-loaded + cached. Clearing bgEnv
// restores the neutral RoomEnvironment and the gradient/solid backdrop.
const _envCache = {} // id → { bg: equirect texture, env: PMREM texture }
let _envBg = null // currently applied equirect background (for restore bookkeeping)
function applyEnvironment() {
  const meta = ENV_BY_ID[params.bgEnv]
  if (!meta) { params.bgEnv = ''; scene.environment = roomEnvTex; applyBackground(); return }
  const cached = _envCache[meta.id]
  const use = (entry) => {
    if (_bgTex) { _bgTex.dispose(); _bgTex = null }
    _envBg = entry.bg
    scene.background = entry.bg
    scene.environment = entry.env
  }
  if (cached) { use(cached); return }
  new THREE.TextureLoader().load(meta.img, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    const env = pmrem.fromEquirectangular(tex).texture
    const entry = { bg: tex, env }
    _envCache[meta.id] = entry
    if (params.bgEnv === meta.id) use(entry) // still selected once it loads
  })
}
// pull a harmonious gradient out of the current map palette (colour theory)
function autoBgColours() {
  const { a, b, c } = deriveBgColors(params)
  params.bgColorA = a // gradient top (airy)
  params.bgColorB = b
  params.bgColorC = c
  // the fog fades the relief to a MID haze (b), distinct from the light top, so
  // depth fog stays clearly visible in front of the gradient
  params.fogColor = b
  fogRef?.color.set(b)
  applyBackground()
}
scene.background = new THREE.Color(params.fogColor)
// linear fog: near/far give direct control over where the fade starts and
// where the terrain is fully swallowed, hiding the mesh edge. The Fog object
// is always created (later code reads/writes its color/near/far regardless of
// whether fog is currently active) but only attached to the scene when the
// param is on, so fog off at startup means no fog is applied at all.
const fogRef = new THREE.Fog(new THREE.Color(params.fogColor), params.fogNear, params.fogFar)
scene.fog = params.fogEnabled ? fogRef : null

const camera = new THREE.PerspectiveCamera(params.fov, window.innerWidth / window.innerHeight, 0.5, 220)
camera.position.set(0, 18, 19)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, -0.3, 0)
controls.enableZoom = false // zoom is the mode machine's custom inertial dolly
controls.enableDamping = true
// élan sur le drag (retour Adrien) : le résidu de rotation décroît lentement,
// une rotation à la souris a de la lancée au lieu de s'arrêter net. τ ≈ 0.35 s
controls.dampingFactor = 0.03
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 6
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
sun.shadow.mapSize.set(2048, 2048)
// wide enough to catch the slab's cast shadow spilling onto the base
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
function applyTimeOfDay(hour) {
  const s = lightingFor(hour, params.demLat, params.demLon)
  params.sunAzimuth = s.azimuth
  params.sunElevation = s.elevation
  params.sunIntensity = s.sunIntensity
  params.hemiIntensity = s.hemiIntensity
  params.envLight = s.envIntensity
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
  sun.intensity = params.sunIntensity * Math.min(1, atten(el) / atten(THREE.MathUtils.degToRad(16)))
  hemi.intensity = params.hemiIntensity
  if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
  if (globe) globe.setSunDir(sun.position)
  if (clouds) clouds.setSunDir(sun.position)
  sunDisc.update(sun.position, skyState?.sunColor ?? '#fff4ea', skyState?.elevation ?? params.sunElevation)
}
placeSun()

function applyShadowMode() {
  sun.castShadow = params.shadowMode !== 'off'
  renderer.shadowMap.autoUpdate = params.shadowMode === 'dynamic'
  if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
}

// ------------------------------------------------------------------ world

const terrain = new Terrain(params)
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
plinth.rebuild = (t, p) => {
  _plinthRebuild(t, p)
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
    bump: params.plinthBump,
    fallbackColor: params.plinthColor,
  })
  // keep the engraved socle name readable whatever the material — re-render the
  // cartouche so its ink flips to contrast the new surface
  cartoucheRef?.rerender?.()
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
const groundInfo = new GroundInfoLayer({
  scene,
  getBaseY: () => plinth.baseY,
  getInk: () => (params.darkMode ? '#e8e4da' : params.hudInk),
  getWallInk: () => socleWallInk(), // engraved name flips to contrast the socle material
})
cartoucheRef = groundInfo

clouds = new Clouds(scene, terrain, params)
clouds.setSunDir(sun.position)

// ambient airliners + SpaceX pad watcher (models fetched, see public/models)
const traffic = new Traffic(scene, terrain, params)

// the sea as a colour-tintable, environment-reflecting glass block
// water simulation is behind FLAGS.water (v37, disabled in prod); null when off
const realWater = FLAGS.water ? new RealWater(scene) : null
const mapLayers = new MapLayers(scene, camera) // roads/water/places overlays, populated per zone

const labelOpts = () => ({
  real: params.source === 'real',
  toFeet: (h) => terrain.heightToFeet(h),
  // dark mode: printed cartography flips to light ink or it vanishes on the
  // near-black terrain; light mode keeps the labels' own vintage browns
  ink: params.darkMode ? '#e8e2d2' : undefined,
})
let labels = createLabels(terrain.sample, params.seed, labelOpts())
labels.visible = params.labels
scene.add(labels)

function regenerateLabels() {
  scene.remove(labels)
  disposeLabels(labels)
  labels = createLabels(terrain.sample, params.seed, labelOpts())
  // a rebuild can run while in orbit (dive preload, GUI) — stay hidden there
  labels.visible = params.labels && (!modes || modes.mode === 'surface')
  scene.add(labels)
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
  camera.up.set(0, 1, 0)
  controlsHeld = true
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
  hud3.group.visible = !modes || modes.mode === 'surface'
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
const evenSize = () => [window.innerWidth & ~1, window.innerHeight & ~1]

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))

// AMBIENT OCCLUSION — N8AO (screen-space GTAO, purpose-built library).
// postprocessing's own SSAOEffect never bit in this pipeline at ANY setting
// (A/B pixel probes showed zero difference at intensity 12) — replaced
// wholesale rather than tuned further. N8AOPostPass is postprocessing-
// compatible and self-contained: no NormalPass, it derives everything from
// the depth buffer. aoRadius is in WORLD units — the block is 56 across.
const aoPass = new N8AOPostPass(scene, camera, ...evenSize())
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
composer.addPass(aoPass)
aoPass.enabled = params.ssaoEnabled
// panel + templates talk to `ssao.intensity` — keep that surface stable
const ssao = {
  get intensity() { return aoPass.configuration.intensity },
  set intensity(v) { aoPass.configuration.intensity = v },
}

// BLOOM — pre-tonemap, on the HDR buffer: sun glints on water, dusk warmth,
// moonlight at night. mipmapBlur is the modern soft falloff, cheap.
// mipmapBlur is OFF, and that is the black-rectangle fix (user-bisected: the
// square disappears when bloom is off).
//
// The mipmap chain halves the frame 8 times. On this window that reads
// 1009 -> 505 -> 253 -> 127 -> 64 -> 32 -> 16 -> 8: every level is ROUNDED,
// so consecutive levels are never exactly 2x apart (up to 6% off by the tiny
// levels). The upsample pass assumes an exact 2x ratio, so it samples outside
// the valid texels, and out-of-range reads on a float target yield NaN. NaN
// added into the frame renders BLACK, in a hard-edged rectangle — exactly the
// reported artefact, and exactly why it came and went with the window size.
//
// The classic (non-mipmap) blur runs at ONE resolution: no chain, no ratio
// error, no NaN. The falloff is slightly tighter than the mipmap version —
// a fair trade for a bloom that cannot black out the screen.
const bloom = new BloomEffect({
  intensity: params.bloomIntensity,
  luminanceThreshold: params.bloomThreshold,
  luminanceSmoothing: 0.2,
  mipmapBlur: false,
  kernelSize: KernelSize.LARGE,
})
const bloomPass = new EffectPass(camera, bloom)
composer.addPass(bloomPass)
bloomPass.enabled = params.bloomEnabled

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
let dof = null
let dofPass = null
function ensureDof() {
  if (dofPass) return dofPass
  dof = new DepthOfFieldEffect(camera, {
    focusDistance: 0.02,
    focalLength: 0.06,
    bokehScale: params.bokehScale,
    height: 720,
  })
  // drive the circle-of-confusion in world units so focus params are intuitive
  dof.cocMaterial.worldFocusDistance = params.focusDistance
  dof.cocMaterial.worldFocusRange = params.focusRange
  dofPass = new EffectPass(camera, dof)
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
const vignette = new VignetteEffect({ darkness: params.vignette, offset: 0.28 })
const smaa = new SMAAEffect()

composer.addPass(new EffectPass(camera, exposureFx, toneMap, hueSat, contrastFx, grain, vignette, smaa))
// only builds the pass if bokeh is actually on at boot (it is not, by default)
setDofEnabled(params.bokehEnabled && params.bokehScale > 0)

// ------------------------------------------------------------------ pointer

const mouse = new THREE.Vector2(0, 0)
const focusRay = new THREE.Raycaster() // reused for pointer autofocus
const _pickNdc = new THREE.Vector2() // scratch NDC for modes' pointUnder hook
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1
  const ny = -((e.clientY / window.innerHeight) * 2 - 1)
  mouse.set(nx, ny)
  if (modes && modes.mode === 'surface') gpxLayer.pointerMove(mouse, e.clientX, e.clientY)
})

// click-to-dive: a plain click on the map (NOT an orbit drag) plunges one level
// onto the point under the cursor — march the height field for the hit, convert
// to lat/lon, dive there keeping the view axis (see modes.diveTo). A drag past a
// few px, a long press, or a click on any DOM overlay (panels/markers, which sit
// above the canvas) never reaches here.
let _clickDownX = 0, _clickDownY = 0, _clickDownT = 0, _clickArmed = false
const _clickNdc = new THREE.Vector2()
renderer.domElement.addEventListener('pointerdown', (e) => {
  _clickArmed = e.button === 0 && e.isPrimary
  _clickDownX = e.clientX
  _clickDownY = e.clientY
  _clickDownT = performance.now()
})
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!_clickArmed || e.button !== 0) return
  _clickArmed = false
  const moved = Math.hypot(e.clientX - _clickDownX, e.clientY - _clickDownY)
  if (moved > 6 || performance.now() - _clickDownT > 400) return // it was an orbit drag / long press
  if (!modes || modes.mode !== 'surface' || modes.busy || modes.travel) return
  if (params.source !== 'real' || !dem || params.demZoom >= userFineZoom) return // already at finest detail
  _clickNdc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
  focusRay.setFromCamera(_clickNdc, camera)
  const hitDist = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, { halfExtent: TERRAIN_SIZE / 2 })
  if (hitDist == null) return // clicked the sky or off-map
  const px = focusRay.ray.origin.x + focusRay.ray.direction.x * hitDist
  const py = focusRay.ray.origin.y + focusRay.ray.direction.y * hitDist
  const pz = focusRay.ray.origin.z + focusRay.ray.direction.z * hitDist
  const { lat, lon } = worldToLatLon(dem, px, pz)
  // pass the clicked world point so the dive leans 30% toward it before loading
  modes.diveTo({ lat, lon, zoom: stepZoom(params.demZoom, 1, userFineZoom), point: new THREE.Vector3(px, py, pz) })
})

// ------------------------------------------------------------------ regeneration helpers

// ------------------------------------------------------------------ real-world DEM loading

let dem = null
let demBusy = false
// patch key → Promise<{maskTexture}|null>. Memoises the in-flight fetch (dedupes
// A→B→A within one fetch) and is LRU-bounded (Map keeps insertion order; a hit
// re-inserts to mark it most-recently-used). Evicted masks are disposed unless
// still the active one — the cache is the sole owner of coast-mask lifecycles.
const COAST_CACHE_MAX = 16
const coastMaskCache = new Map()
// the finest zoom the USER chose — dives and the staircase overwrite
// params.demZoom freely, but refining always climbs back to this. Default to the
// finest tiles available (z15) so zooming all the way in actually reaches full
// detail; picking a coarser "Detail (zoom)" lowers it again.
let userFineZoom = Math.max(params.demZoom, 15)

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
const ZOOM_EXAG_DEFAULTS = { 4: 2.5, 5: 5, 6: 4, 7: 3.2 }
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
}
// pull the current zoom's exaggeration into params + refresh the UI controls
function syncExagToZoom() {
  params.demExaggeration = exagForZoom(params.demZoom)
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
async function fetchAndBuildDem() {
  syncExagToZoom() // this zoom's saved (or default) vertical exaggeration
  syncDetailToZoom() // fine-detail off at continental scale (z<=6)
  loadingStatus.textContent = 'fetching elevation tiles…'
  loadingEl.classList.remove('hidden')
  dem = await loadDem({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom })
  terrain.setDem(dem)
  params.source = 'real'
  try {
    clouds?.reroll() // a new view level deserves a fresh cloud layout
  } catch {} // a cosmetic cloud hiccup must never abort a terrain build
  refreshAll()
  loadingStatus.textContent = 'generating terrain…'
  applyTimeOfDay(params.timeOfDay ?? 10) // the sun is location-true — re-aim it for the new place
  await regenerateTerrain()
  // pull the cartouche info for the new zone (async, non-blocking)
  if (params.groundInfo) groundInfo.load(params.demLat, params.demLon, dem)
  // real coastline (Natural Earth) at coarse zoom — async, non-blocking; the
  // shader falls back to the elevation isoline until it arrives / if it fails.
  if (params.demZoom >= COAST_ZOOM_MIN && params.demZoom <= COAST_ZOOM_MAX) {
    const key = `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}`
    let job = coastMaskCache.get(key)
    if (job) coastMaskCache.delete(key) // re-insert below to mark most-recently-used
    else job = fetchCoastMask({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, dem })
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
    job
      .then((res) => {
        if (!res) return
        // only apply if we're still on the same patch
        const stillHere = `${params.demZoom}:${params.demLat.toFixed(3)},${params.demLon.toFixed(3)}` === key
        if (stillHere) terrain.setCoastMask(res.maskTexture)
      })
      .catch(() => {})
  } else {
    terrain.setCoastMask(null)
  }
  traffic.setZone(dem) // SpaceX pad watcher (Starbase / LC-39A in view?)
  terrain.refreshMatTiling(params) // relief material tiling tracks the new zoom
  if (params.regionMode) applyRegionMode() // re-cut to the new zone's boundary
}

async function loadRealTerrain() {
  if (demBusy) return
  demBusy = true
  try {
    await fetchAndBuildDem()
  } catch (err) {
    console.error('DEM load failed:', err)
    loadingStatus.textContent = 'elevation fetch failed — check connection'
    setTimeout(() => {
      hideLoading()
      loadingStatus.textContent = 'generating terrain…'
    }, 2600)
  } finally {
    demBusy = false
  }
}

let rebuildPending = false
function regenerateTerrain() {
  if (rebuildPending) return Promise.resolve()
  rebuildPending = true
  loadingEl.classList.remove('hidden')
  // plain timeout (not rAF — rAF never fires in a hidden tab and would stall
  // the rebuild); 50ms still lets the indicator paint first
  return new Promise((resolve) =>
    setTimeout(() => {
      terrain.rebuild(params)
      terrain.rebuildRoughness(params)
      plinth.rebuild(terrain, params) // walls hug the new relief border (also re-welds the region skirt in region mode — see the plinth.rebuild wrapper)
      terrain.refreshMatTiling(params) // re-tile the relief material to the new zoom scale
      realWater?.rebuild({ terrain, params }) // water simulation follows the new relief
      const _mlp = mapLayers.rebuild({ dem: terrain.dem, terrain, params }) // roads/water/places re-drape on the new relief
      // The aerial skin has to re-derive here too. This calls mapLayers.rebuild
      // DIRECTLY rather than through the rebuildMapLayers wrapper, and that
      // wrapper was the only thing refreshing the photo — so a zoom change
      // re-drew the vectors but left the OLD mosaic stretched across the new
      // block: imagery that visibly ignored the terrain scale.
      refreshAerial()
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
      rebuildPending = false
      hideLoading()
      resolve()
    }, 50)
  )
}

// ------------------------------------------------------------------ orbital globe + modes

globe = new Globe(params)
globe.setVisible(false)
scene.add(globe.group)
globe.setSunDir(sun.position)

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
      terrain.mesh.visible = v
      labels.visible = v && params.labels
      hud3.group.visible = v
      // GPX sprites draw with depthTest:false — hidden with the surface or
      // they'd float on top of the planet
      gpxLayer.setVisible(v && params.gpxVisible)
      clouds.setVisible(v)
      plinth.setVisible(v && params.plinth && !params.regionMode)
      if (regionSkirt) regionSkirt.mesh.visible = v
      groundInfo.setVisible(v && params.groundInfo)
      traffic.setVisible(v)
      realWater?.setVisible(v)
      mapLayers.setSurfaceVisible(v)
      isoBtn?.setVisible(v) // the isometric shortcut only makes sense over the block
      cineBtn?.setVisible(v)
      mapCorner?.setVisible(v) // cartography corner is surface-only too
      scene.fog = v && params.fogEnabled ? fogRef : null
      refreshOsmCredit() // GeoNames credit only applies in surface mode — resync on mode change
    },
    setEffectsEnabled(v) {
      setDofEnabled(v && params.bokehEnabled && params.bokehScale > 0)
      grain.blendMode.opacity.value = v ? params.grain : 0
      sun.castShadow = v && params.shadowMode !== 'off'
      renderer.shadowMap.autoUpdate = v && params.shadowMode === 'dynamic'
      if (v && params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
      // the restore above reads raw params — re-assert the active quality
      // tier on top so a globe round-trip can't silently undo degraded mode
      if (v) aq?.reassert()
    },
    getSurfaceLatLon: () => ({ lat: params.demLat, lon: params.demLon }),
    surfaceCamAltMeters() {
      if (params.source === 'real' && dem) {
        const scale = (TERRAIN_SIZE / dem.extentMeters) * params.demExaggeration
        return camera.position.y / scale + dem.meanM
      }
      return terrain.heightToFeet(camera.position.y) / 3.28084
    },
    async loadSurface(lat, lon, zoom) {
      if (demBusy) throw new Error('terrain busy')
      demBusy = true
      try {
        params.demLat = lat
        params.demLon = lon
        if (zoom) params.demZoom = zoom
        params.demLocation = 'Custom'
        await fetchAndBuildDem()
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
    // task 30 Fix A: terrain-clearance guard for the dive/refine arrival pose
    // (see modes.js's _arrivalPose()) — the local relief height right under
    // the landing target, so the arrival camera can never come to rest below
    // the ground it just loaded.
    sampleGroundY: (x, z) => terrain.sample?.(x, z) ?? 0,
    // molette pendant le suivi de tête GPX : zoome/dézoome le standoff du
    // drone (consommé → l'escalier de zoom ne voit pas l'événement)
    followWheel: (deltaY) => {
      if (!(drone.active && params.gpxFollow && gpxLayer.isPlaying())) return false
      drone.zoomBy(deltaY > 0 ? 1.13 : 1 / 1.13)
      return true
    },
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
    getRefineTarget() {
      if (params.source !== 'real' || !dem || params.demZoom >= userFineZoom) return null
      const { lat, lon } = worldToLatLon(dem, controls.target.x, controls.target.z)
      return { lat, lon, zoom: stepZoom(params.demZoom, 1, userFineZoom) }
    },
    getCoarsenTarget() {
      // widen down to the z4 continental block; past that the orbit gate opens
      if (params.source !== 'real' || !dem || params.demZoom <= 4) return null
      const { lat, lon } = worldToLatLon(dem, controls.target.x, controls.target.z)
      return { lat, lon, zoom: stepZoom(params.demZoom, -1) }
    },
    // true when the camera is skimming the relief — refine can then fire on a
    // zoom-in even though the orbit target is far ahead (so getDistance() never
    // reaches the near stop). Fixes "won't reach z15 with the camera at ground
    // level". The scene-space y is a few units at ground; the default frame is y≈18.
    nearGround: () => params.source === 'real' && !!dem && camera.position.y < 6,
  },
})

const gotoCtl = createGoto({ modes, announce: (m) => modes.announce(m), getFineZoom: () => userFineZoom })

// vertical zoom stepper (left edge) — discrete alternative to the wheel; reads
// live staircase/orbit state each frame, only triggers modes.stepFiner/Wider
const zoomStepper = buildZoomStepper({
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
})
// boot-time default (params.peaksEnabled, above): setEnabled(true) here is a
// safe no-op until a real DEM exists (refresh() bails on !dem) — the actual
// population happens the first time regenerateTerrain() runs after dem loads
// (see its own `if (peaksLayer.enabled) peaksLayer.refresh()` call). Without
// this line the layer was NEVER enabled anywhere at boot — the Map panel
// toggle was the only thing that ever called setEnabled — so summits stayed
// invisible until a user found and flipped that switch by hand.
peaksLayer.setEnabled(params.peaksEnabled)

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
// the rest of the shipped scene, so a template never leaves a stuck light /
// material / post-FX / toggle behind after RESET LOOK
const DEFAULT_LIGHT = Object.freeze({
  sunIntensity: params.sunIntensity,
  sunAzimuth: params.sunAzimuth,
  sunElevation: params.sunElevation,
  hemiIntensity: params.hemiIntensity,
  envLight: params.envLight,
  shadowSoftness: params.shadowSoftness,
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
  plinthBump: params.plinthBump,
})
const DEFAULT_MAPLAYERS = Object.freeze({
  roadsEnabled: params.roadsEnabled,
  roadsOpacity: params.roadsOpacity,
  roadsDetail: params.roadsDetail,
  roadColor: '',
  waterEnabled: params.waterEnabled,
  waterOpacity: params.waterOpacity,
  waterFill: params.waterFill,
  coastLine: false, // stays off through a Reset map — see the param's own note
  placesEnabled: params.placesEnabled,
  placesDensity: params.placesDensity,
  placesSize: params.placesSize,
  placesHalo: params.placesHalo,
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
  refreshAll()
}

function applyStyle(s) {
  Object.assign(params, s)
  terrain.mapUniforms.uTint.value = s.mapTint
  terrain.mapUniforms.uHeightContrast.value = s.heightContrast
  terrain.mapUniforms.uHeightPivot.value = s.heightPivot
  terrain.mapUniforms.uSlopeTint.value = s.slopeTint
  refreshAll()
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
  refreshAll()
}

// night survey: dark sheet, light ink, palettes flip to blacks/browns with
// vivid summit accents — the whole look follows one switch
function setDarkMode(v) {
  params.darkMode = v
  document.body.classList.toggle('dark', v) // drives the FUI + lil-gui theme
  const sheet = v ? DARK.sheet : '#ffffff'
  params.fogColor = sheet
  fogRef.color.set(sheet)
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
}
function applySurface(s) {
  Object.assign(params, s)
  terrain.updateMaterial(params)
  terrain.rebuildRoughness(params)
  if (params.liquidMetal) terrain.setLiquidMetal(true, params) // keep the chrome over template swaps
}
function applyLook(k) {
  if (k.fogColor != null) {
    params.fogColor = k.fogColor
    fogRef.color.set(k.fogColor)
    applyBackground()
    modes.whiteEl.style.background = k.fogColor
  }
  if (k.exposure != null) exposureFx.uniforms.get('exposure').value = params.exposure = k.exposure
  if (k.contrast != null) contrastFx.uniforms.get('contrast').value = params.contrast = k.contrast
  if (k.saturation != null) hueSat.saturation = params.saturation = k.saturation
  if (k.vignette != null) vignette.darkness = params.vignette = k.vignette
  if (k.grain != null) grain.blendMode.opacity.value = params.grain = k.grain
  // render upgrades (2026-07-20): a template may carry the AO/bloom look
  if (k.ssaoEnabled != null) params.ssaoEnabled = k.ssaoEnabled
  if (k.ssaoIntensity != null) ssao.intensity = params.ssaoIntensity = k.ssaoIntensity
  if (k.bloomEnabled != null) params.bloomEnabled = k.bloomEnabled
  if (k.bloomIntensity != null) bloom.intensity = params.bloomIntensity = k.bloomIntensity
  if (k.bloomThreshold != null) bloom.luminanceMaterial.threshold = params.bloomThreshold = k.bloomThreshold
  if (k.clouds != null) {
    params.cloudsEnabled = k.clouds
    if (k.clouds) clouds.build(params) // no point rebuilding just to hide them
    clouds.setVisible(k.clouds && modes.mode === 'surface')
  }
  if (k.plinth != null) {
    params.plinth = k.plinth
    // region-isolate drops the slab — a template must never re-show it under the cut
    plinth.setVisible(k.plinth && modes.mode === 'surface' && !params.regionMode)
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

// push a captured look onto the live scene. Assign every look key onto params
// first, then run the same scene pushers a built-in template uses.
function applyUserTemplate(tmpl) {
  const L = tmpl.look || {}
  for (const k of TEMPLATE_KEYS) if (k in L) params[k] = L[k] == null ? L[k] : JSON.parse(JSON.stringify(L[k]))
  setDarkMode(params.darkMode ?? false)
  applyPalette({ rampStops: params.rampStops, oceanShallow: params.oceanShallow, oceanMid: params.oceanMid, oceanDeep: params.oceanDeep, ink: params.contourColor })
  applyStyle({ mapTint: params.mapTint, heightContrast: params.heightContrast, heightPivot: params.heightPivot, slopeTint: params.slopeTint })
  applyGridContour({ contourInterval: params.contourInterval, contourOpacity: params.contourOpacity, contourColor: params.contourColor, contourWeight: params.contourWeight, gridStep: params.gridStep, gridOpacity: params.gridOpacity, gridColor: params.gridColor })
  applyLight({ sunIntensity: params.sunIntensity, sunAzimuth: params.sunAzimuth, sunElevation: params.sunElevation, hemiIntensity: params.hemiIntensity, envLight: params.envLight, shadowSoftness: params.shadowSoftness, timeOfDay: params.timeOfDay })
  applySurface({ roughness: params.roughness, roughnessVariation: params.roughnessVariation, roughnessScale: params.roughnessScale, bumpScale: params.bumpScale, envMapIntensity: params.envMapIntensity })
  applyLook({ fogColor: params.fogColor, exposure: params.exposure, contrast: params.contrast, saturation: params.saturation, vignette: params.vignette, grain: params.grain, clouds: params.cloudsEnabled, plinth: params.plinth, ssaoEnabled: params.ssaoEnabled, ssaoIntensity: params.ssaoIntensity, bloomEnabled: params.bloomEnabled, bloomIntensity: params.bloomIntensity, bloomThreshold: params.bloomThreshold })
  fogRef.near = params.fogNear
  fogRef.far = params.fogFar
  scene.fog = params.fogEnabled && modes.mode === 'surface' ? fogRef : null
  applyBackground() // solid/gradient background from the captured look
  // camera lens / depth-of-field / shadow look
  if (params.fov != null) { camera.fov = params.fov; camera.updateProjectionMatrix() }
  if (params.bokehScale != null) { if (dof) dof.bokehScale = params.bokehScale; setDofEnabled(params.bokehEnabled && params.bokehScale > 0) }
  if (params.focusRange != null && dof) dof.cocMaterial.worldFocusRange = params.focusRange
  if (params.shadowMode) applyShadowMode()
  applyPlinthMaterial()
  terrain.setMaterialMode(params.terrainSurfaceMat || '', params)
  if (params.terrainSurfaceMat && params.terrainSurfaceMat !== 'glass' && params.terrainMatRoughness != null) {
    terrain.setTerrainMatRoughness(params.terrainMatRoughness) // honour the saved finish
  }
  terrain.setLiquidMetal(!!params.liquidMetal, params)
  terrain.setSurfaceFx(params.surfaceFx | 0)
  if ((params.surfaceFx | 0) > 0 && params.fx?.[params.surfaceFx]) terrain.applyFxParams(params.fx[params.surfaceFx])
  if (clouds) {
    if (params.cloudsEnabled) clouds.build(params)
    clouds.setVisible(params.cloudsEnabled && modes.mode === 'surface')
  }
  shadersRefreshFn() // rebuild the relief-material sub-controls (Scale/Bump/Roughness/Noise) for the applied look
  bgRefreshFn() // resync the Background HDRI-sky highlight to the applied look
  refreshAll()
  rebuildMapLayers() // re-derive roads/water/places for the current location under the restored look
  blockGrid?.restyle(params) // les dalles voisines du damier suivent la principale
  gpxLayer.rebuildAll() // re-drape every loaded track with the restored line width/colour/casing
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
const history = new History(() => captureLook(params), (snap) => applyAllParams(snap))

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
  composer.render() // fresh frame so the thumbnail matches the screen
  const clean = String(name || '').trim().slice(0, 40) || 'My look'
  const look = captureLook(params)
  const { strip, shaders } = stripFromLook(look)
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: clean, thumb: captureThumbnail(), strip, shaders, look }
  userTemplates.push(t)
  persistUserTemplates()
  return t
}
function deleteUserTemplate(id) {
  userTemplates = userTemplates.filter((t) => t.id !== id)
  persistUserTemplates()
}
function exportUserTemplate(id) {
  const t = userTemplates.find((x) => x.id === id)
  if (!t) return
  const blob = new Blob([serializeTemplate(t)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${t.name.replace(/[^a-z0-9-_]+/gi, '-')}.shibumap-template.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
function importTemplateText(text) {
  const parsed = parseTemplate(text)
  if (!parsed) return null
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: parsed.name, thumb: parsed.thumb, strip: parsed.strip, shaders: parsed.shaders, look: parsed.look }
  userTemplates.push(t)
  persistUserTemplates()
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
  // elevation is per-zoom (persisted), not part of the look — left untouched
}

// RESET MAP (Templates panel) — extends RESET LOOK to also clear everything
// else a template or a panel can leave dangling: background, socle material,
// the whole-relief material / liquid metal / surface shader, clouds, fog and
// the map overlay layers (roads/water/places). Location/zoom are never
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
  // fog off
  params.fogEnabled = false
  scene.fog = null
  // depth of field off
  params.bokehEnabled = false
  setDofEnabled(false)
  // map overlay layers (roads/water/places)
  Object.assign(params, DEFAULT_MAPLAYERS)
  rebuildMapLayers()
  blockGrid?.restyle(params) // les dalles voisines retombent aussi sur la base
  history?.record() // committed look change — one undo step
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

  // 1) coherent base — a random built-in template, applied inline (no interim
  //    history.record(), unlike applyTemplate, so the shuffle stays ONE step)
  const tpl = pick(Object.values(TEMPLATES))
  setDarkMode(tpl.darkMode ?? false)
  if (tpl.palette) applyPalette(tpl.palette)
  if (tpl.style) applyStyle(tpl.style)
  if (tpl.grid) applyGridContour(tpl.grid)
  if (tpl.light) applyLight(tpl.light)
  if (tpl.surface) applySurface(tpl.surface)
  if (tpl.look) applyLook(tpl.look)

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

  // 4) animated sea — usually on, with a NEW seed so the swell differs each time
  params.waterReal = chance(0.75)
  params.seaSeed = Math.floor(rnd(1, 9999))
  params.seaWaveH = +rnd(0.3, 1.6).toFixed(2)
  params.seaChop = +rnd(0.3, 0.95).toFixed(2)
  params.seaSpeed = +rnd(0.6, 1.6).toFixed(2)
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
  params.cloudsEnabled = chance(0.4)
  if (clouds) { if (params.cloudsEnabled) clouds.build(params); clouds.setVisible(params.cloudsEnabled && modes.mode === 'surface') }
  params.aerialEnabled = chance(0.3)
  refreshAerial()

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

const gpxLayer = new GpxLayerManager({ scene, camera, terrain, params, getDem: () => dem, getGrid: () => blockGrid })

const allGpxPoints = () => gpxLayer.layers.flatMap((l) => l.gpx.track?.points ?? [])
// un voisin vient de finir de charger → re-draper les traces + peindre sa photo
// aérienne si la couche est active (même finition que le bloc central)
blockGrid.onReady = (cell) => { gpxLayer.rebuildAll(); paintCellAerial(cell) }
// le damier a gagné/perdu une dalle → le trafic aérien étend sa zone de vol
// pour qu'un avion passe d'une dalle à la suivante sans coupure
blockGrid.onGridChanged = () => traffic.setSpan(blockGrid.spanRadius())
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

async function loadGpxText(text) {
  try {
    const entry = gpxLayer.addLayer(text)
    if (!entry) {
      modes.announce('LAYER LIMIT — 10 GPX TRACKS MAX')
      return
    }
    const track = entry.gpx.track
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
    if (modes.mode === 'orbital') await modes.flyTo(f.lat, f.lon, f.zoom)
    else await loadRealTerrain()
    // au chargement d'un GPX, on démarre en vue isométrique (Adrien) — comme un
    // clic sur le bouton iso ; la vue est cadrée sur le bloc + son socle
    applyIsoView(0)
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
  const f = [...(e.dataTransfer?.files || [])].find((f) => /\.gpx$/i.test(f.name))
  if (f) f.text().then(loadGpxText)
})

const gpxFileInput = document.createElement('input')
gpxFileInput.type = 'file'
gpxFileInput.accept = '.gpx'
gpxFileInput.style.display = 'none'
document.body.appendChild(gpxFileInput)
gpxFileInput.addEventListener('change', () => {
  const f = gpxFileInput.files?.[0]
  if (f) f.text().then(loadGpxText)
  gpxFileInput.value = ''
})

// ---- GPX sport-icon head billboard (task 22 §3/4) --------------------------
// One CanvasTexture per built-in sport, rasterized once from sport-icons.js's
// inline SVG table (rasterizeToCanvas is async — an Image decode — so build
// the whole small set up front rather than resolving per-frame/per-layer).
// GpxLayerManager.setDefaultIconResolver expects a SYNCHRONOUS (sportKey) =>
// texture lookup, hence the cache instead of resolving on demand.
const _sportIconTex = new Map()
Promise.all(
  SPORTS.map((s) =>
    rasterizeToCanvas(s.svg, { size: 128, color: '#232019' }).then((canvas) => {
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      _sportIconTex.set(s.key, tex)
    })
  )
).then(() => gpxLayer.setDefaultIconResolver((sportKey) => _sportIconTex.get(sportKey) || _sportIconTex.get(DEFAULT_SPORT)))

// custom per-layer icon upload (task 22 §3) — one hidden file input shared
// by every layer row's "Upload…" button (see route-panel.js); the row that
// triggered it is remembered in a closure var since the <input> itself only
// knows "a file changed", not which layer asked.
let _iconUploadTargetId = null
const iconFileInput = document.createElement('input')
iconFileInput.type = 'file'
iconFileInput.accept = 'image/*,.svg'
iconFileInput.style.display = 'none'
document.body.appendChild(iconFileInput)
iconFileInput.addEventListener('change', async () => {
  const f = iconFileInput.files?.[0]
  const targetId = _iconUploadTargetId
  iconFileInput.value = ''
  _iconUploadTargetId = null
  if (!f || !targetId) return
  try {
    const isSvg = /\.svg$/i.test(f.name) || f.type === 'image/svg+xml'
    let canvas
    if (isSvg) {
      const clean = sanitizeSvgMarkup(await f.text())
      if (!clean) { modes.announce('ICON REJECTED — INVALID SVG'); return }
      canvas = await rasterizeToCanvas(clean, { size: 128, color: '#232019' })
    } else {
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => reject(new Error('read failed'))
        r.readAsDataURL(f)
      })
      if (!isValidIconDataUrl(dataUrl)) { modes.announce('ICON REJECTED — TOO LARGE OR UNSUPPORTED TYPE'); return }
      canvas = await rasterizeToCanvas(dataUrl, { size: 128 })
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    gpxLayer.setCustomIcon(targetId, tex)
  } catch (err) {
    modes.announce(`ICON ERROR — ${String(err.message).toUpperCase()}`)
  }
})
function requestIconUpload(layerId) {
  _iconUploadTargetId = layerId
  iconFileInput.click()
}

// hand the flight to the existing tour controller
// cinematic drone follow-cam for the GPX track (terrain-aware chase camera)
const drone = new DroneCam({ camera, controls, sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0 })
// looping cinematic camera moves (orbit / fly-over / crane…) for the Camera panel
const cameraAuto = new CameraAutomation({ camera, controls })

function flyTrack() {
  const w = gpxLayer.track?.world
  if (!w || w.length < 2 || modes.mode !== 'surface') return
  const km = gpxLayer.track.cumKm[gpxLayer.track.cumKm.length - 1]
  const duration = THREE.MathUtils.clamp(km * 2.2, 14, 95)
  tour.active = false
  tween.active = false
  cameraAuto.stop()
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
  if (!params.gpxFollow || !gpxLayer.isPlaying() || modes.mode !== 'surface') return
  const w = gpxLayer.track?.world
  if (!w || w.length < 2) return
  tour.active = false
  tween.active = false
  cameraAuto.stop()
  if (drone.start(w, { seedAt: gpxLayer.headT })) showFollowPad(drone) // resume-in-place, not a snap back to the start
}
function disengageGpxFollow() {
  hideFollowPad()
  if (drone.active) drone.stop()
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
      gpxLayer.play()
      engageGpxFollow()
    }
    return
  }
  if (cameraAuto.active) cameraAuto.stop()
  else {
    tour.active = false
    drone.stop()
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
}

// ------------------------------------------------------------------ GUI

scan = new ScanController(terrain.mapUniforms, TERRAIN_SIZE / 2)

const waterRebuild = () => {
  realWater?.rebuild({ terrain, params })
  // caustiques AU FOND (shader terrain) : on/off avec la mer animée
  terrain.mapUniforms.uSeaCausK.value = params.waterReal ? 1 : 0
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
  if (params.placesEnabled && params.source === 'real' && modes.mode === 'surface') parts.push('© GeoNames (CC BY 4.0)')
  // IGN's Licence Ouverte requires visible attribution while its imagery is on
  // screen — and only while it is: aerialAttribution is null the moment the
  // layer is off OR the patch leaves the covered area.
  if (aerialAttribution) parts.push(aerialAttribution)
  credits.setExtra(parts.join(' · '))
}

// rebuild all map layers (roads/water/places) for the current zone — used by
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
  mapCorner?.setAerialActive(params.aerialEnabled && params.source === 'real')
}
async function refreshAerialCore() {
  if (!params.aerialEnabled || !dem || params.source !== 'real') {
    terrain.setAerial(null)
    aerialAttribution = null
    refreshOsmCredit()
    return
  }
  const bounds = blockBounds(dem) // the TRUE block extent, never patchBounds — see blockBounds()

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
  const bounds = blockBounds(cell.dem)
  if (aerialUnavailable(bounds)) { cell.terrain.setAerial(null); return }
  const prov = providerForAerial(bounds)
  if (prov?.global && params.demZoom > 8) { cell.terrain.setAerial(null); return }
  cell.aerial ??= new AerialLayer({ maxTexturePx: renderer.capabilities.maxTextureSize })
  const built = await cell.aerial.build(bounds)
  if (built === SUPERSEDED || !built?.texture) return
  cell.terrain.setAerial(built)
  cell.terrain.setAerialOpacity(params.aerialOpacity)
  cell.terrain.setAerialCoastFade(params.aerialCoastFade ?? 0.1)
}
const rebuildMapLayers = () => { const p = mapLayers.rebuild({ dem, terrain, params }); refreshOsmCredit(); refreshAerial(); return p.then(() => refreshOsmCredit()) }

// "individualiser la zone" — clip the map to the administrative boundary under
// the view (continent/country/region/departement by zoom). The landform sits
// straight on the ground: no plinth, no square ocean slab.
let regionBusy = false
function disposeRegionSkirt() {
  if (!regionSkirt) return
  scene.remove(regionSkirt.mesh)
  regionSkirt.mesh.geometry.dispose()
  // material is shared with the plinth — do NOT dispose it here
  regionSkirt = null
}
// (re)build the vertical curtain around the isolated zone from the current mask
// + terrain heightfield. Shares the plinth wall material so the socle finish
// (PBR / glass) carries onto the cut.
function rebuildRegionSkirt() {
  disposeRegionSkirt()
  if (!params.regionMode || !regionMaskCanvas || !terrain.sample) return
  const s = buildRegionSkirt({
    maskCanvas: regionMaskCanvas,
    sample: terrain.sample,
    material: plinth.wallMat,
    depth: params.plinthDepth ?? 6,
  })
  if (s) {
    regionSkirt = s
    s.mesh.visible = modes.mode === 'surface'
    scene.add(s.mesh)
  }
}
async function applyRegionMode() {
  if (!params.regionMode || params.source !== 'real' || !dem) {
    terrain.setRegionMask(null)
    disposeRegionSkirt()
    regionMaskCanvas = null
    plinth.setVisible(params.plinth && modes.mode === 'surface')
    waterRebuild() // restore the open-sea surface once the region clip is gone
    return
  }
  if (regionBusy) return
  regionBusy = true
  try {
    const r = await fetchRegionMask({ lat: params.demLat, lon: params.demLon, zoom: params.demZoom, dem })
    if (!params.regionMode) return // user toggled off while fetching
    terrain.setRegionMask(r ? r.maskTexture : null)
    plinth.setVisible(false)
    waterRebuild() // regionMode is on — the sim drops its sea (it would spill past the boundary) but keeps the lakes
    // Isolate-the-zone drops the flat slab, but a vertical curtain still closes
    // the cut so a boundary over a summit or a trench never shows the map's
    // underside. It welds to the terrain height and shares the socle material.
    regionMaskCanvas = r ? r.maskCanvas : null
    rebuildRegionSkirt()
    if (r) modes.announce(`ZONE — ${String(r.name).toUpperCase()}`)
    else modes.announce('ZONE — NO BOUNDARY AT THIS SCALE')
  } catch {
    terrain.setRegionMask(null)
    disposeRegionSkirt()
    regionMaskCanvas = null
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
  switch (id) {
    case 'roads':
      params.roadsEnabled = !params.roadsEnabled
      rebuildMapLayers()
      break
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
  // roads/water/places/contourOpacity/gridOpacity are all TEMPLATE_KEYS —
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
  if (cameraAuto.active || drone.active || tour.active || tween.active || (params.gpxFollow && gpxLayer.isPlaying())) updateCameraMotion(dt)
  if (!params.paused) {
    clouds.update(dt, params, camera)
    traffic.update(dt)
  }
  camera.updateMatrixWorld()
}

initTips()

// first click pulls the export stack in (modal + Recorder + mediabunny) —
// bars.js shows a busy state on the button while the chunk downloads. Named
// so both the top-bar Export pill AND the "E" keyboard shortcut can open it.
async function openExportUI() {
  const [{ openExportModal }, { Recorder }] = await Promise.all([
    import('./ui/export-modal.js'),
    import('./export-recorder.js'),
  ])
  if (!recorder) recorder = new Recorder({ renderer })
  openExportModal({
    renderer,
    composer,
    camera,
    recorder,
    pauseLoop: () => {
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
async function shareCurrentView() {
  const cam = {
    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
    tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
  }
  const state = captureShareState(params, cam, BASE_TEMPLATE_LOOK)
  const hasTrack = !!gpxLayer.track

  // With a track loaded, publish it (Netlify Blobs via netlify/functions/race.mjs)
  // and hand out the short #r= link — the whole point of sharing a race is that
  // the recipient sees the course. Publish failure degrades HONESTLY to the
  // inline #s= link with `published: false`, so the toast can say the track
  // didn't make it — a link that silently drops the course would be worse.
  let url = null
  let published = false
  if (hasTrack) {
    try {
      const res = await fetch(RACE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // raceName rides along so the link can carry a real preview card —
        // a fragment (#r=) never reaches a crawler, so the /r/<id> route is
        // the only thing that can name the course on WhatsApp or Instagram.
        body: JSON.stringify({ gpx: trackToGpx(gpxLayer.track), state, raceName: gpxLayer.raceName || '' }),
      })
      const j = res.ok ? await res.json() : null
      if (j?.ok && typeof j.id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(j.id)) {
        // The PATH form, not #r= — see netlify/functions/share.mjs. It serves
        // the preview tags and then forwards to the app's own #r= link, so
        // nothing downstream changes except that pasted links now unfurl.
        url = `${location.origin}/r/${j.id}`
        published = true
      }
    } catch {} // network/function down — fall through to the inline link
  }
  if (!url) url = `${location.origin}${location.pathname}#s=${encodeShareState(state)}`
  const note = hasTrack && !published ? ' — your GPX track isn’t included' : ''

  if (navigator.share) {
    try {
      await navigator.share({ title: 'ShibuMap', text: `A view I made with ShibuMap${note}`, url })
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
    return { ok: false, url, hasTrack, published } // clipboard blocked — nothing more we can do automatically
  }
}

const topBar = buildTopBar({
  params,
  setDarkMode: (v) => {
    setDarkMode(v)
    refreshAll()
  },
  // the Globe button always shows the WHOLE planet, spinning slowly
  enterOrbit: () => { cameraAuto.stop(); modes.enterOrbit(16000000) },
  // the "?" button replays the guided tour (lazy-loaded, tiny)
  startTutorial: async () => {
    const { startTutorial } = await import('./ui/tutorial.js')
    startTutorial()
  },
  openExport: openExportUI,
  // "?" keyboard-shortcuts help — self-updating overlay, reads SHORTCUTS live
  toggleShortcuts: () => shortcutsOverlay.toggle(),
  // ALPHA chip → "What's new" changelog
  appStage: APP_STAGE,
  toggleChangelog: () => changelogOverlay.toggle(),
  share: shareCurrentView,
})

const bottomBar = buildBottomBar({
  goto: gotoCtl,
  openGpx: () => gpxFileInput.click(),
})

// the GPX profile strip docks at the same bottom-centre spot as the search
// bar — measure the bar's REAL rendered rect (its height changes across the
// pointer:coarse/touch breakpoint, see v28.css) and push the profile's
// `bottom` up above it with a fixed gap, so the two can never overlap
// (a z-index bump alone would leave them stacked, not "remonté")
function syncGpxProfilePosition() {
  const r = bottomBar.root.getBoundingClientRect()
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
  { name: '5', dir: new THREE.Vector3(0, 100, -0.6), k: 0.92, target: ISO_TARGET }, // top-down, nord en haut
  { name: '6', dir: new THREE.Vector3(0.28, 0.17, 1), k: 0.52, target: new THREE.Vector3(0, 1.4, 0) }, // au raz du sol
]
let isoIndex = -1
// vole (rotation orbitale) vers la vue iso i ; met à jour le badge de l'icône
function applyIsoView(i) {
  if (modes.mode !== 'surface' || modes.busy) return
  tour.active = false
  isoIndex = ((i % ISO_VIEWS.length) + ISO_VIEWS.length) % ISO_VIEWS.length
  const v = ISO_VIEWS[isoIndex]
  const dist = controls.maxDistance * v.k
  const pos = v.target.clone().addScaledVector(v.dir.clone().normalize(), dist)
  flyTo(pos, v.target.clone(), { orbit: true })
  isoBtn?.setBadge(v.name)
}
// cinematic button — same family as the iso shortcut, one step to its left:
// each press starts a RANDOM looping camera move around the socle (the
// existing Camera-panel automations), and while it runs the move re-rolls
// every ~18 s so the show never settles. Press again to stop.
let cineTimer = 0
cineBtn = buildCineButton({
  toggle: () => {
    if (cameraAuto.active) {
      cameraAuto.stop()
      clearInterval(cineTimer)
      return false
    }
    const roll = () => {
      const m = CAMERA_MOVES[Math.floor(Math.random() * CAMERA_MOVES.length)]
      cameraAuto.start(m.id, 0.7 + Math.random() * 0.9)
    }
    roll()
    clearInterval(cineTimer)
    cineTimer = setInterval(() => { if (cameraAuto.active) roll(); else clearInterval(cineTimer) }, 18000)
    return true
  },
})

isoBtn = buildIsoButton({
  // chaque clic passe à la vue suivante (rotation orbitale)
  flyIso: () => applyIsoView(isoIndex + 1),
})

// bottom-left cartography corner (Adrien) : aerial toggle · base · shuffle
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
  fogRef,
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
  applyPalette,
  applyStyle,
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
  },
  peaksLayer,
  setLabelsVisible: (v) => (labels.visible = v && modes.mode === 'surface'),
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
    if (v >= 12) userFineZoom = v // remember the user's chosen fine scale
    if (params.source === 'real') loadRealTerrain()
  },
  getFineZoom: () => userFineZoom, // finest scale reached — gates the 2048/4096 mesh tiers
  applyBackground, // solid / gradient scene background
  autoBgColours, // derive gradient stops from the map palette
  bgModes: BG_MODES,
  environments: ENVIRONMENTS, // HDRI sky list for the Background picker
  getBgEnv: () => params.bgEnv || '',
  setBgEnv: (id) => { params.bgEnv = id || ''; applyBackground() },
  setFogEnabled: (v) => { scene.fog = v && modes.mode === 'surface' ? fogRef : null },
  applyPlinthMaterial, // socle PBR / glass material picker (Block panel)
  setGroundInfo: (v) => {
    groundInfo.enabled = v
    groundInfo.setVisible(v && modes.mode === 'surface')
    if (v && dem && !groundInfo.lastInfo) groundInfo.load(params.demLat, params.demLon, dem)
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
}

// Templates panel docks ABOVE Create in the right dock — built first so it
// lands first in the DOM (dock columns stack panels in append order).
const templatesPanel = buildTemplatesPanel(panelCtx)
const createPanel = buildCreatePanel(panelCtx)

// Shaders panel — right dock, between Create and Map (created here so it
// docks between them). Holds the surface-shader treatments split out of Scan.
let shadersRefreshFn = () => {} // re-renders the Shaders panel controls on exclusivity changes
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
    { k: 'lmMetalness', label: 'Metalness', min: 0, max: 1 },
    { k: 'lmRoughness', label: 'Polish', min: 0.02, max: 0.6 },
    { k: 'lmReflection', label: 'Reflection', min: 0, max: 3 },
    { k: 'lmSpeed', label: 'Flow speed', min: 0, max: 1.5 },
  ],
  getLmParam: (k) => params[k],
  setLmParam: (k, v) => {
    params[k] = v
    if (params.liquidMetal) terrain.setLiquidMetal(true, params)
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
  },
  getMatNoise: () => params.terrainMatNoise,
  setMatNoise: (v) => {
    params.terrainMatNoise = v
    terrain.setMatNoise(v)
  },
  getMatAboveZero: () => params.terrainMatAboveZero,
  setMatAboveZero: (v) => {
    params.terrainMatAboveZero = v
    terrain.setMatAboveZero(v)
  },
  // live glass knobs (only shown when the relief material is Glass)
  glassControls: [
    { k: 'terrainGlassFrost', label: 'Frost', min: 0, max: 1 },
    { k: 'terrainGlassThickness', label: 'Thickness', min: 1, max: 20 },
    { k: 'terrainGlassClarity', label: 'Clarity', min: 2, max: 60 },
    { k: 'terrainGlassReflection', label: 'Reflection', min: 0, max: 3 },
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

const effectsPanel = buildEffectsPanel({
  params,
  exposureFx, contrastFx, hueSat, vignette, grain,
  fogRef, setFogEnabled: panelCtx.setFogEnabled, applyBackground,
  clouds,
  ssao, bloom, aoPass, bloomPass,
  realWater, waterRebuild,
  terrain, globe,
})

// the 24h slider lives top-right as a pill now — the Create panel's Light
// section is gone entirely (this was its only control)
const hourPill = buildHourPill({ params, applyTimeOfDay })

const explorePanel = buildExplorePanel({
  flyTo: (lat, lon, zoom) => modes.flyTo(lat, lon, zoom),
})

// Map panel — LEFT dock, wedged between Explore and Scan (Explore, Map, Scan,
// Camera, Route) per Adrien. Built HERE, after Explore and before Scan, because
// panels dock in construction order within a column (see shell.js Panel).
// Holds the cartographic layers (roads/water/places) plus the contour/grid/
// marker controls relocated out of Create's old "Map style" section.
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
  setLabelsVisible: (v) => (labels.visible = v && modes.mode === 'surface'),
})

const scanPanel = buildScanPanel({
  runScan: (typeId) => scan.trigger(typeId, { x: controls.target.x, z: controls.target.z }, params.scanDuration),
})

// Camera panel — left dock, docked directly below Scan (Explore, Scan, Camera).
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

// Route panel — left dock, docked directly below Camera (Explore, Scan,
// Camera, Route). Exposes the loaded GPX track: load button + line styling.
const routePanel = buildRoutePanel({
  params,
  gpx: gpxLayer,
  loadGpx: () => gpxFileInput.click(),
  startFollow: engageGpxFollow,
  stopFollow: disengageGpxFollow,
  uploadIcon: requestIconUpload,
})

// the exclusive per-column accordion now lives in the Panel shell (setCollapsed
// folds dock neighbours), so expanding any panel collapses the others in its
// column. Start with only Create/Explore open (Templates docks above Create
// but stays collapsed until clicked, same as Shaders/Map).
templatesPanel.setCollapsed(true)
shadersPanel.setCollapsed(true)
cameraPanel.setCollapsed(true)
mapPanel.setCollapsed(true)
scanPanel.setCollapsed(true)
routePanel.setCollapsed(true)

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
  aoPass,
  bloomPass,
  grain,
  applyShadowMode,
  announce: (m) => modes.announce(m),
  refreshAll,
  canStep: () => modes.mode === 'surface' && !modes.busy && !recorder?.recording,
})

// ------------------------------------------------------------------ keyboard shortcuts + undo/redo

const shortcutsCtx = {
  cameraPreset,
  togglePlay,
  stopPlay,
  // flush any pending debounced snapshot FIRST, so an edit made <400ms ago is
  // committed before we step back — otherwise a quick Ctrl+Z after a change
  // reverts the WRONG step (or no-ops), which read as "undo is broken" (Adrien)
  undo: () => { recordHistoryDebounced.flush?.(); return history.undo() },
  redo: () => { recordHistoryDebounced.flush?.(); return history.redo() },
  toggleUI: () => document.body.classList.toggle('ce-noui'),
  toggleDark: () => {
    setDarkMode(!params.darkMode)
    refreshAll()
    topBar.syncDark()
    history?.record() // keyboard toggle should be one undoable step, like the UI switch
  },
  reframe: () => cameraPreset('home'),
  toggleShortcuts: () => shortcutsOverlay.toggle(),
  focusSearch: () => bottomBar.input?.focus(),
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
document.addEventListener('change', (e) => { if (e.target?.closest?.('.ce-dock')) recordHistoryDebounced() }, true)
document.addEventListener('pointerup', (e) => { if (e.target?.closest?.('.ce-dock')) recordHistoryDebounced() }, true)

// seed the first undo step so the FIRST committed edit has a state to undo
// back to (record() dedups, so this is free even if nothing changes first)
history.record()

// ------------------------------------------------------------------ loop

// console access for debugging/scripting
window.__exp = { scene, camera, controls, params, terrain, loadRealTerrain, applyTimeOfDay, globe, modes, gotoCtl, gpxLayer, loadGpxText, flyTrack, tour, drone, cameraAuto, applyBackground, autoBgColours, clouds, plinth, peaksLayer, blockGrid, refreshAerial, paintCellAerial, applyIsoView, flyTo, get tween() { return tween }, get isoIndex() { return isoIndex }, applyPalette, applyStyle, applyGridContour, applyMonochrome, applyTemplate, setDarkMode, groundInfo, renderer, composer, realWater, waterRebuild, traffic, mapLayers, rebuildMapLayers, get scan() { return scan }, get labels() { return labels }, get aq() { return aq }, get recorder() { return recorder }, history }

applyTimeOfDay(params.timeOfDay ?? 10) // seed the sun/disc/lake for the opening view

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
    if (params.source === 'real') loadRealTerrain()
    return
  }
  if (race.state) {
    Object.assign(params, race.state.look)
    params.demLat = race.state.loc.lat
    params.demLon = race.state.loc.lon
    params.demZoom = race.state.loc.zoom
    params.demLocation = 'Custom'
    if (race.state.cam) pendingShareCam = race.state.cam
  }
  // race.logo is stored/validated but not consumed yet — the race-info panel
  // (layers lot) will surface it. loadGpxText frames the track, loads terrain,
  // and applies the pending camera once the view exists.
  await loadGpxText(race.gpx)
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
    if (controlsHeld) {
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
    controls.update() // orbital-mode camera is driven by the mode machine
  }
}

let rafId = 0
let tickTimer = 0
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
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime

  updateCameraMotion(dt)

  // Post passes are OWNED here, one place, every frame. The AO pass reads the
  // normal+depth of the CURRENT camera state — during dives/orbital/terrain
  // swaps that state is mid-flight and a broken AO multiplies the whole frame
  // toward black (the reported intermittent black screen). Surface-and-settled
  // only. Bloom has no depth dependency and only follows its toggle + tier.
  aoPass.enabled = params.ssaoEnabled && params._aoTierOk !== false && modes.mode === 'surface' && !modes.busy
  // Bloom too: its mipmap chain SPREADS any NaN pixel to the whole frame —
  // one bad texel during a transition (885 km orbital states, terrain swaps)
  // and the entire image goes black. Surface-and-settled, same as AO.
  bloomPass.enabled = params.bloomEnabled && params._bloomTierOk !== false && modes.mode === 'surface' && !modes.busy

  // idle planet spin: in orbital view the Earth slowly turns under the camera
  // until the user takes the controls back
  if (modes.mode === 'orbital' && !modes.busy && !controlsHeld && performance.now() - lastUserInput > 3000) {
    camera.position.applyAxisAngle(UP, dt * 0.035)
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
  zoomStepper.update()
  if (modes.mode === 'orbital') globe.update(camera, dt)

  // fog respects the Effects sliders at normal viewing (so it actually shows —
  // the old code scaled near*9/far*10.4 at every distance and hid it), and only
  // lifts outward when the camera is pulled far back to frame the whole slab, so
  // the relief never whites out near the orbit gate.
  if (modes.mode === 'surface' && scene.fog) {
    const dist = controls.getDistance()
    const lift = THREE.MathUtils.smoothstep(dist, 55, 115)
    fogRef.near = THREE.MathUtils.lerp(params.fogNear, dist + 45, lift)
    fogRef.far = THREE.MathUtils.lerp(params.fogFar, dist + 130, lift)
  }

  // refresh camera matrices NOW so DOM projections match this frame's render
  // (otherwise labels are projected with last frame's matrices and lag behind)
  camera.updateMatrixWorld()

  if (!params.paused && modes.mode === 'surface') {
    hud3.update(dt, t, params)
    clouds.update(dt, params, camera)
    traffic.update(dt)
    terrain.tickSurfaceFx(dt, params.fx[params.surfaceFx]?.speed ?? 0) // animate at the effect's speed
    terrain.tickLiquidMetal(dt, params.lmSpeed) // molten flow when liquid metal is on
    terrain.tickSurfaceMaterial(dt) // drifting sand (relief material flow)
    gpxLayer.tick?.(dt) // shimmer: flowing dashOffset highlight along the route line
  }
  peaksLayer.update(camera, window.innerWidth, window.innerHeight, modes.mode === 'surface')

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

  // pointer autofocus: focus where the ray from the camera through the cursor
  // meets the terrain; on a miss (sky / off-map) hold the last valid focus
  if (params.autoFocus && modes.mode === 'surface') {
    focusRay.setFromCamera(mouse, camera)
    const hit = focusRayHit(focusRay.ray.origin, focusRay.ray.direction, terrain.sample, {
      halfExtent: TERRAIN_SIZE / 2,
    })
    if (hit != null) params.focusDistance += (hit - params.focusDistance) * Math.min(1, dt * 8)
  }
  // `dof` is null until bokeh is first switched on (lazy build — see
  // ensureDof). params.focusDistance keeps tracking either way, and
  // ensureDof() seeds the material from it, so nothing is lost while it
  // does not exist.
  if (dof) dof.cocMaterial.worldFocusDistance = params.focusDistance

  realWater?.update(dt, sun) // water simulation: waves, caustics, sun glint
  // temps des caustiques de fond (terrain + blocs voisins du damier)
  terrain.mapUniforms.uCausT.value += dt
  for (const cell of blockGrid.cells.values()) {
    cell.terrain.mapUniforms.uCausT.value = terrain.mapUniforms.uCausT.value
    cell.terrain.mapUniforms.uSeaCausK.value = terrain.mapUniforms.uSeaCausK.value
    // shader de surface : les voisins suivent le temps de la dalle principale
    // (un composant : ils n'avancent pas leur propre horloge) — animation synchrone
    cell.terrain.mapUniforms.uFxTime.value = terrain.mapUniforms.uFxTime.value
  }
  realWater?.setView(camera.position.y, controls.getDistance?.() ?? camera.position.distanceTo(controls.target)) // accalmie altitude + taille des remous de côte selon la distance d'affichage
  aq.update(dt) // adaptive quality: sample FPS, step tiers when sustained
  composer.render(dt)
  if (recorder?.recording) recorder.captureFrame() // null until first export
}
tick()

// first visit only: the guided tour introduces the UI once the boot view has
// had a moment to settle (replayable anytime from the "?" in the top bar)
setTimeout(async () => {
  try {
    const { maybeStartTutorial } = await import('./ui/tutorial.js')
    maybeStartTutorial()
  } catch {}
}, 4500)

window.addEventListener('resize', () => {
  if (loopPaused) return // an offline export owns the renderer size right now
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(...evenSize()) // same even dimensions as the composer — see evenSize()
  composer.setSize(...evenSize())
  gpxLayer.onResize(window.innerWidth, window.innerHeight)
  mapLayers.onResize(window.innerWidth, window.innerHeight)
  syncGpxProfilePosition()
  reclampDraggables()
})
