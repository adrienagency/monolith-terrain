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
  HueSaturationEffect,
  BrightnessContrastEffect,
  ToneMappingEffect,
  ToneMappingMode,
  Effect,
  BlendFunction,
} from 'postprocessing'
import { Terrain } from './terrain.js'
import { createCone } from './cone.js'
import { createLabels, disposeLabels } from './labels.js'
import { createHud3D, findPois } from './hud3d.js'
import { createHud2D } from './hud2d.js'
import { loadDem } from './dem.js'
import { Globe } from './globe.js'
import { Modes, stepZoom } from './modes.js'
import { createGoto } from './goto.js'
import { GpxLayer, parseGpx } from './gpx.js'
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
import { CityLabels } from './cities.js'
import { StudioLighting, sunFromHour, LIGHT_PRESETS } from './lighting.js'
import { Plinth } from './plinth.js'
import { makeDraggable, reclampDraggables } from './drag.js'
import { ScanController } from './scan.js'
import { fetchRegionMask } from './region-mask.js'
import { fetchCoastMask, COAST_ZOOM_MIN, COAST_ZOOM_MAX } from './coast-mask.js'
import { buildRegionPlate } from './region-plate.js'
import { buildRegionSkirt } from './region-skirt.js'
import { makeSocleEnvMap } from './socle-env.js'
import { GLASS_BY_ID, PBR_BY_ID } from './material-presets.js'
import { TEMPLATE_KEYS, captureLook, serializeTemplate, parseTemplate, loadUserTemplates, saveUserTemplates } from './templates-user.js'
import { DroneCam } from './drone-cam.js'
import { findRacesNear } from './race-info.js'
import { buildRacePanel } from './ui/race-panel.js'
import { refreshAll } from './ui/kit.js'
import { buildTopBar, buildBottomBar, buildIsoButton, buildCredits } from './ui/bars.js'
import { buildCreatePanel } from './ui/create-panel.js'
import { buildCameraPanel } from './ui/camera-panel.js'
import { buildExplorePanel } from './ui/explore-panel.js'
import { buildScanPanel } from './ui/scan-panel.js'
import { buildShadersPanel } from './ui/shaders-panel.js'
import { initTips } from './ui/tips.js'
import { createAdaptiveQuality } from './perf.js'
import { detailForZoom } from './zoom-detail.js'
import './ui/v28.css'
// the export stack (modal + Recorder + mediabunny encoder) is heavy and only
// needed on demand — it is dynamic-import()ed on the first Export click, so
// it lives in its own async chunk and never delays first paint

// ------------------------------------------------------------------ params

// the survey markers findPois always emits — shared by the Tour folder and
// the MOTION panel so their from/to lists can never drift apart
const POI_IDS = ['PK-01', 'PK-02', 'PK-03', 'PK-04', 'DEP-05']

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
  demExaggeration: 2.2, // vertical relief pushed for a more dramatic read

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

  // HUD (legacy FUI blocks — off by default in the v28 UI)
  hud: false,
  hudOpacity: 1,
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
  contrast: 0.07,
  saturation: -0.35,
  vignette: 0.6,
  grain: 0, // off by default — opt in via Look → grain
  fogNear: 35.5,
  fogFar: 50,
  fogColor: '#ffffff',
  surveyLines: true,

  // motion
  coneSpin: 0,
  coneTilt: 0,
  coneDrift: 0,
  bob: 0,
  ringSpeed: 1.0,
  flyDuration: 1.8,
  flyEasing: 'smooth',
  paused: false,

  // tour
  tourFrom: 'PK-01',
  tourTo: 'PK-02',
  tourDuration: 14,
  tourAltitude: 2.5,
  tourSmoothing: 0.7,
  tourLook: 0.1,
  tourBank: 0.8,

  // performance
  pixelRatio: Math.min(window.devicePixelRatio, 2),
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
  // relief into a material — '' | 'glass' | 'wood' | 'carbon'
  terrainSurfaceMat: '',
  terrainSurfaceBump: 1.3, // bump for the opaque terrain materials (wood/carbon)
  terrainMatScale: 1, // tiling scale for the opaque relief materials (repetition)
  terrainMatRoughness: 0.75, // seeded from the preset on select; live-tunable
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
  cloudsEnabled: true,
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
  // WATER SIMULATION (the glass sea/lakes are gone — this is the only water):
  // translucent sunlit shallows with bold caustics, darkening depths,
  // Beaufort sea state — GPU-heavy, so opt-in
  lakeColor: '#8fc6e8', // base water tint (shallow/deep derive from it)
  waterReal: false,
  waterWind: 2, // Beaufort force F1..F3 (capped at 3 — beyond stopped reading as a diorama)
  waterTransparency: 0.4, // 0 = milky veil, 1 = crystal — above and below the surface
  waterSunFx: 1, // sun on the water: glint above + caustic rays below (0..2)

  // principal cities draped on the map (Natural Earth) — off in one click
  cityLabels: true,

  // light
  sunIntensity: 7.6,
  sunAzimuth: 162,
  sunElevation: 16,
  hemiIntensity: 0.6,
  envLight: 0.16,
  shadowSoftness: 5,
  timeOfDay: 10, // 24 h sun-cycle slider (0..24) — drives sun az/el/intensity/colour
  lightPreset: 'map-default', // studio lighting preset (lighting.js)
}

// ------------------------------------------------------------------ renderer / scene

const container = document.getElementById('app')
const loadingEl = document.getElementById('loading')
// the loader is a branded card (name + baseline + plane) — status text lives
// in its own line so updating it never wipes the markup
const loadingStatus = loadingEl.querySelector('.ld-status') ?? loadingEl

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
scene.background = new THREE.Color(params.fogColor)
// linear fog: near/far give direct control over where the fade starts and
// where the terrain is fully swallowed, hiding the mesh edge
scene.fog = new THREE.Fog(new THREE.Color(params.fogColor), params.fogNear, params.fogFar)

const camera = new THREE.PerspectiveCamera(params.fov, window.innerWidth / window.innerHeight, 0.5, 220)
camera.position.set(0, 18, 19)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, -0.3, 0)
controls.zoomToCursor = true // dolly toward the exact point under the mouse
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.maxPolarAngle = Math.PI * 0.49
controls.minDistance = 6
controls.maxDistance = 150 // room to frame the whole slab before the orbit gate
controls.update()

// image-based lighting for believable PBR speculars
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = params.envLight
pmrem.dispose()

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

// studio lighting rig (8 presets + 24h cycle) is behind FLAGS.lightingPresets
// (v40, disabled in prod); null when off — the base sun/hemi rig stays active
const studio = FLAGS.lightingPresets ? new StudioLighting({ scene, sun, hemi }) : null
// apply the 24 h time-of-day slider: writes sun az/el/intensity/colour + hemi
function applyTimeOfDay(hour) {
  const s = sunFromHour(hour)
  params.sunAzimuth = s.azimuth
  params.sunElevation = s.elevation
  params.sunIntensity = s.intensity
  params.hemiIntensity = s.hemiIntensity
  params.envLight = s.envIntensity
  sun.color.copy(s.color)
  hemi.color.copy(s.hemiSky)
  hemi.groundColor.copy(s.hemiGround)
  scene.environmentIntensity = s.envIntensity
  placeSun()
}
// restore the scene background when a dark preset is cleared
function setStudioBackground(hex) {
  scene.background = hex ? new THREE.Color(hex) : new THREE.Color(params.fogColor)
}
function applyLightPreset(name) {
  if (!studio) return // presets disabled — base sun rig governs
  params.lightPreset = name
  if (name === 'map-default') sun.color.set(0xffffff) // hand colour back to the template
  studio.apply(name, { params, placeSun, setBackground: setStudioBackground })
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

const cone = createCone()
scene.add(cone.group)

clouds = new Clouds(scene, terrain, params)
clouds.setSunDir(sun.position)

// ambient airliners + SpaceX pad watcher (models fetched, see public/models)
const traffic = new Traffic(scene, terrain, params)

// the sea as a colour-tintable, environment-reflecting glass block
// water simulation is behind FLAGS.water (v37, disabled in prod); null when off
const realWater = FLAGS.water ? new RealWater(scene) : null
const cityLabels = new CityLabels(scene) // principal cities, populated per zone

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
  t: 0,
  p0: new THREE.Vector3(),
  p1: new THREE.Vector3(),
  t0: new THREE.Vector3(),
  t1: new THREE.Vector3(),
}
let selectedPoi = -1
let fps = 60
let scan = null // ScanController — instantiated once the terrain exists
let regionPlate = null // adaptive plate under the cut landform (region mode)
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

function flyTo(pos, target) {
  tween.p0.copy(camera.position)
  tween.t0.copy(controls.target)
  tween.p1.copy(pos)
  tween.t1.copy(target)
  tween.t = 0
  tween.active = true
}

// clicking a PK marker or a named summit orbits the camera just ABOVE the peak
// and frames it — a high, slightly-offset vantage looking down at the top
function focusOnPeak(x, h, z) {
  const v = peakVantage(x, h, z)
  flyTo(new THREE.Vector3(v.pos.x, v.pos.y, v.pos.z), new THREE.Vector3(v.target.x, v.target.y, v.target.z))
}

// pose to restore when a selection is closed: wherever the camera was pre-click
const returnPose = { saved: false, pos: new THREE.Vector3(), target: new THREE.Vector3() }

// ------------------------------------------------------------------ tour mode

// One continuous Catmull-Rom spline: current camera pose → above the FROM poi →
// arc across the terrain → standoff short of the TO poi. Sampled by ARC LENGTH
// (uniform speed), driven by a trapezoidal velocity profile, with all rotation
// going through a damped "gimbal" controller so snaps are impossible.

const TOUR_N = 240
const tour = {
  active: false,
  t: 0,
  bank: 0,
  uA: 0.2, // arc-length fraction where the path passes over the FROM poi
  curve: null,
  aTop: new THREE.Vector3(),
  bTop: new THREE.Vector3(),
}
const _tp = new THREE.Vector3()
const _tg = new THREE.Vector3()
const _tt0 = new THREE.Vector3()
const _tt1 = new THREE.Vector3()
const _tm = new THREE.Matrix4()
const _tq = new THREE.Quaternion()
const _tqr = new THREE.Quaternion()
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const UP = new THREE.Vector3(0, 1, 0)

function boxBlur(arr, radius, passes = 1) {
  let a = arr
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(a.length)
    for (let i = 0; i < a.length; i++) {
      let s = 0
      let c = 0
      for (let j = Math.max(0, i - radius); j <= Math.min(a.length - 1, i + radius); j++) {
        s += a[j]
        c++
      }
      out[i] = s / c
    }
    a = out
  }
  return a
}

// trapezoidal velocity: accelerate → cruise at constant speed → decelerate
function trapezoid(t, r) {
  t = THREE.MathUtils.clamp(t, 0, 1)
  if (t < r) return (t * t) / (2 * r * (1 - r))
  if (t > 1 - r) {
    const u = 1 - t
    return 1 - (u * u) / (2 * r * (1 - r))
  }
  return (t - r / 2) / (1 - r)
}

function startTour() {
  if (modes && modes.mode !== 'surface') return // tours fly surface-space paths
  const A = pois.find((p) => p.id === params.tourFrom)
  const B = pois.find((p) => p.id === params.tourTo)
  if (!A || !B || A === B) return

  // ground path A → standoff short of B (ending on B itself would degenerate
  // to a vertical view), arced sideways for a more interesting line
  const a = new THREE.Vector3(A.x, 0, A.z)
  const bFull = new THREE.Vector3(B.x, 0, B.z)
  const dist = a.distanceTo(bFull)
  const dirAB = bFull.clone().sub(a).normalize()
  const b = bFull.clone().addScaledVector(dirAB, -Math.min(7, dist * 0.4))
  const mid = a.clone().add(b).multiplyScalar(0.5)
  mid.addScaledVector(new THREE.Vector3(-dirAB.z, 0, dirAB.x), dist * 0.22)

  const px = new Float32Array(TOUR_N)
  const pz = new Float32Array(TOUR_N)
  const ground = new Float32Array(TOUR_N)
  for (let i = 0; i < TOUR_N; i++) {
    const t = i / (TOUR_N - 1)
    const u = 1 - t
    px[i] = u * u * a.x + 2 * u * t * mid.x + t * t * b.x
    pz[i] = u * u * a.z + 2 * u * t * mid.z + t * t * b.z
    ground[i] = terrain.sample(px[i], pz[i])
  }

  // altitude: clearance envelope (rolling max) blurred hard — rises over
  // mountains as one long swell, never tracks bumps
  const radius = Math.round(4 + params.tourSmoothing * 30)
  const envelope = new Float32Array(TOUR_N)
  for (let i = 0; i < TOUR_N; i++) {
    let m = -Infinity
    for (let j = Math.max(0, i - radius); j <= Math.min(TOUR_N - 1, i + radius); j++) m = Math.max(m, ground[j])
    envelope[i] = m
  }
  const smoothY = boxBlur(envelope, radius, 3)

  // one continuous spline starting at the CURRENT camera position — the
  // approach is just the first leg of the same flight, no phase transition
  const pts = [camera.position.clone()]
  for (let i = 0; i < TOUR_N; i += 20) pts.push(new THREE.Vector3(px[i], smoothY[i] + params.tourAltitude, pz[i]))
  pts.push(new THREE.Vector3(px[TOUR_N - 1], smoothY[TOUR_N - 1] + params.tourAltitude, pz[TOUR_N - 1]))
  tour.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
  tour.curve.arcLengthDivisions = 400
  tour.curve.updateArcLengths()

  // arc-length fraction where we pass over the FROM poi (gaze switches there)
  let bestD = Infinity
  for (let i = 0; i <= 200; i++) {
    const s = i / 200
    tour.curve.getPointAt(s, _tp)
    const d = Math.hypot(_tp.x - A.x, _tp.z - A.z)
    if (d < bestD) {
      bestD = d
      tour.uA = s
    }
  }

  tour.aTop.set(A.x, A.h + 0.6, A.z)
  tour.bTop.set(B.x, B.h + 0.6, B.z)
  tour.duration = params.tourDuration
  tour.bank = 0
  tour.t = 0
  tour.active = true
  tween.active = false
}

// gaze target along the flight: frame the FROM poi on approach, then look
// ahead down the path, converging onto the TO poi at the end
function tourGaze(s, camPos, out) {
  const ahead = Math.min(s + params.tourLook, 1)
  tour.curve.getPointAt(ahead, out)
  out.y -= params.tourAltitude * 0.7 // gaze slightly below the flight line
  // hand the gaze off BEFORE we're overhead the FROM poi — looking straight
  // down while passing over it flips the heading violently
  const fromBlend = THREE.MathUtils.smoothstep(s, tour.uA * 0.15, tour.uA * 0.75)
  out.lerp(tour.aTop, 1 - fromBlend)
  out.lerp(tour.bTop, THREE.MathUtils.smoothstep(s, 0.85, 1))

  // pitch clamp: never look down steeper than ~72°, pushing the gaze point
  // forward instead — guards against gimbal flips in every configuration
  const dx = out.x - camPos.x
  const dz = out.z - camPos.z
  const horiz = Math.hypot(dx, dz)
  const drop = camPos.y - out.y
  const minHoriz = drop * 0.33
  if (drop > 0 && horiz < minHoriz) {
    if (horiz > 1e-4) {
      const k = minHoriz / horiz
      out.x = camPos.x + dx * k
      out.z = camPos.z + dz * k
    } else {
      tour.curve.getTangentAt(s, _tt0)
      out.x = camPos.x + _tt0.x * minHoriz
      out.z = camPos.z + _tt0.z * minHoriz
    }
  }
  return out
}

const hud2 = createHud2D({
  onSelectPoi(i) {
    if (selectedPoi === -1) {
      returnPose.pos.copy(camera.position)
      returnPose.target.copy(controls.target)
      returnPose.saved = true
    }
    selectedPoi = i
    const p = pois[i]
    hud2.setSelected(i, p)
    focusOnPeak(p.x, p.h, p.z)
  },
  onDeselect() {
    selectedPoi = -1
    hud2.setSelected(-1, null)
    flyTo(returnPose.saved ? returnPose.pos : HOME.pos, returnPose.saved ? returnPose.target : HOME.target)
    returnPose.saved = false
  },
  onScan() {
    scan?.trigger(0, { x: controls.target.x, z: controls.target.z }, params.scanDuration)
    cone.kick(3)
  },
})
hud2.setPois(pois)
hud2.setStatic(params)
hud2.setVisible(params.hud)
hud2.setOpacity(params.hudOpacity)
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
  drone.stop() // grabbing the camera cancels the drone follow
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
let aq = null // adaptive quality controller (perf.js) — built after the panels
let recorder = null // Recorder instance, lazy-loaded with the export stack

// real-world mode strips the fiction: no cone/reticle, no dial platform
function applySourceMode() {
  const real = params.source === 'real'
  const surface = !modes || modes.mode === 'surface'
  cone.group.visible = !real && surface
  hud3.platform.visible = !real
  hud2.setReticleVisible(!real)
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
  hud2.setPois(pois)
  hud2.setStatic(params)
  selectedPoi = -1
  hud2.setSelected(-1, null)
  applySourceMode()
}
applySourceMode()

// ------------------------------------------------------------------ post: real depth-based DOF

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType })
composer.addPass(new RenderPass(scene, camera))

const dof = new DepthOfFieldEffect(camera, {
  focusDistance: 0.02,
  focalLength: 0.06,
  bokehScale: params.bokehScale,
  height: 720,
})
// drive the circle-of-confusion in world units so focus params are intuitive
dof.cocMaterial.worldFocusDistance = params.focusDistance
dof.cocMaterial.worldFocusRange = params.focusRange

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

const dofPass = new EffectPass(camera, dof)
composer.addPass(dofPass)
composer.addPass(new EffectPass(camera, exposureFx, toneMap, hueSat, contrastFx, grain, vignette, smaa))
// skip the whole DOF pass when bokeh is zero — it's pure cost with no visual effect
dofPass.enabled = params.bokehScale > 0

// ------------------------------------------------------------------ pointer

const mouse = new THREE.Vector2(0, 0)
const focusRay = new THREE.Raycaster() // reused for pointer autofocus
let lastPointer = null
window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1
  const ny = -((e.clientY / window.innerHeight) * 2 - 1)
  if (lastPointer) {
    const speed = Math.hypot(nx - lastPointer.x, ny - lastPointer.y)
    cone.kick(speed * 6)
  }
  lastPointer = { x: nx, y: ny }
  mouse.set(nx, ny)
  if (modes && modes.mode === 'surface') gpxLayer.pointerMove(mouse, e.clientX, e.clientY)
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
const BASE_EXAG = 2.2
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
      loadingEl.classList.add('hidden')
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
      plinth.rebuild(terrain, params) // walls hug the new relief border
      terrain.refreshMatTiling(params) // re-tile the relief material to the new zoom scale
      if (params.regionMode && regionMaskCanvas) rebuildRegionSkirt() // re-weld the cut curtain to the new heights
      realWater?.rebuild({ terrain, params }) // water simulation follows the new relief
      cityLabels.rebuild({ dem: terrain.dem, terrain, params }) // city names re-drape on the new relief
      regenerateLabels()
      regenerateHud()
      gpxLayer.rebuild() // re-drape the track on the new relief
      if (clouds) clouds.build(params) // deck re-floats above the new relief
      if (peaksLayer.enabled) peaksLayer.refresh()
      if (params.shadowMode === 'static') renderer.shadowMap.needsUpdate = true
      rebuildPending = false
      loadingEl.classList.add('hidden')
      resolve()
    }, 50)
  )
}

// ------------------------------------------------------------------ orbital globe + modes

globe = new Globe(params)
globe.setVisible(false)
scene.add(globe.group)
globe.setSunDir(sun.position)

const fogRef = scene.fog

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
      hud2.setVisible(v && params.hud)
      cone.group.visible = v && params.source !== 'real'
      // GPX sprites draw with depthTest:false — hidden with the surface or
      // they'd float on top of the planet
      gpxLayer.setVisible(v && params.gpxVisible)
      clouds.setVisible(v)
      plinth.setVisible(v && params.plinth && !params.regionMode)
      if (regionPlate) regionPlate.mesh.visible = v
      if (regionSkirt) regionSkirt.mesh.visible = v
      groundInfo.setVisible(v && params.groundInfo)
      traffic.setVisible(v)
      realWater?.setVisible(v)
      cityLabels.setVisible(v && params.cityLabels)
      isoBtn?.setVisible(v) // the isometric shortcut only makes sense over the block
      scene.fog = v ? fogRef : null
    },
    setEffectsEnabled(v) {
      dofPass.enabled = v && params.bokehScale > 0
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
        loadingEl.classList.add('hidden')
        throw err
      } finally {
        demBusy = false
      }
    },
    // pull back far enough to frame the whole slab (and the ground info added
    // around it) before the zoom-out staircase / orbit gate engages
    surfaceMaxDistance: () => 150,
    getFineZoom: () => userFineZoom,
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

const gotoCtl = createGoto({ modes, announce: (m) => modes.announce(m) })

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
  scene.background.set(sheet)
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
  gpxLayer.setHover(-1)
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
}

// a look template: a full bundle that reproduces a reference image's style —
// palette + oceans + grid/contour + hillshade light + surface + background +
// post-look + scene toggles. Camera/navigation are never touched.
function applyLight(l) {
  Object.assign(params, l)
  placeSun()
  scene.environmentIntensity = params.envLight
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
    scene.background.set(k.fogColor)
    modes.whiteEl.style.background = k.fogColor
  }
  if (k.exposure != null) exposureFx.uniforms.get('exposure').value = params.exposure = k.exposure
  if (k.contrast != null) contrastFx.uniforms.get('contrast').value = params.contrast = k.contrast
  if (k.saturation != null) hueSat.saturation = params.saturation = k.saturation
  if (k.vignette != null) vignette.darkness = params.vignette = k.vignette
  if (k.grain != null) grain.blendMode.opacity.value = params.grain = k.grain
  if (k.clouds != null) {
    params.cloudsEnabled = k.clouds
    if (k.clouds) clouds.build(params) // no point rebuilding just to hide them
    clouds.setVisible(k.clouds && modes.mode === 'surface')
  }
  if (k.plinth != null) {
    params.plinth = k.plinth
    plinth.setVisible(k.plinth && modes.mode === 'surface')
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
  applyLook({ fogColor: params.fogColor, exposure: params.exposure, contrast: params.contrast, saturation: params.saturation, vignette: params.vignette, grain: params.grain, clouds: params.cloudsEnabled, plinth: params.plinth })
  fogRef.near = params.fogNear
  fogRef.far = params.fogFar
  applyPlinthMaterial()
  terrain.setMaterialMode(params.terrainSurfaceMat || '', params)
  terrain.setLiquidMetal(!!params.liquidMetal, params)
  terrain.setSurfaceFx(params.surfaceFx | 0)
  if ((params.surfaceFx | 0) > 0 && params.fx?.[params.surfaceFx]) terrain.applyFxParams(params.fx[params.surfaceFx])
  if (clouds) {
    if (params.cloudsEnabled) clouds.build(params)
    clouds.setVisible(params.cloudsEnabled && modes.mode === 'surface')
  }
  refreshAll()
}

// grab a small thumbnail of the live render (avoids me taking screenshots).
// Draw the WebGL canvas into a downscaled 2D canvas → JPEG data URL.
function captureThumbnail(w = 160, h = 90) {
  try {
    const src = renderer.domElement
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    // cover-fit the (wide) canvas into the thumb
    const sr = src.width / src.height
    const tr = w / h
    let sw = src.width, sh = src.height, sx = 0, sy = 0
    if (sr > tr) { sw = src.height * tr; sx = (src.width - sw) / 2 } else { sh = src.width / tr; sy = (src.height - sh) / 2 }
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.72)
  } catch { return null }
}

function persistUserTemplates() {
  saveUserTemplates(userTemplates)
}
function saveCurrentTemplate(name) {
  // force a fresh frame so the thumbnail matches what's on screen
  composer.render()
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: String(name || 'My look').slice(0, 40), thumb: captureThumbnail(), look: captureLook(params) }
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
  const t = { id: `ut_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`, name: parsed.name, thumb: parsed.thumb, look: parsed.look }
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

// ------------------------------------------------------------------ GPX layer

const gpxLayer = new GpxLayer({ scene, camera, terrain, params, getDem: () => dem })

const racePanel = buildRacePanel()

async function loadGpxText(text) {
  try {
    const { points, name } = parseGpx(text)
    gpxLayer.setTrack(points, name)
    const f = gpxLayer.frame(points)
    params.demLat = f.lat
    params.demLon = f.lon
    params.demZoom = f.zoom
    params.demLocation = 'Custom'
    refreshAll()
    modes.announce(`TRACK LOADED — ${name.toUpperCase().slice(0, 24)}`)
    // is there a known race at this location? (live Wikipedia, non-blocking) —
    // the user can open its info card or ignore the badge
    findRacesNear(f.lat, f.lon).then((cands) => racePanel.offer(cands)).catch(() => {})
    // the post-rebuild hook drapes the line once the new terrain exists;
    // pin the framed zoom or the dive would land on the fine (≥12) scale
    // and clip long tracks framed at z10/z11
    if (modes.mode === 'orbital') await modes.flyTo(f.lat, f.lon, f.zoom)
    else await loadRealTerrain()
  } catch (err) {
    modes.announce(`GPX ERROR — ${String(err.message).toUpperCase()}`)
  }
}

// the altimeter chip and the GPX profile strip stay repositionable
makeDraggable(modes.altEl)
makeDraggable(gpxLayer.profileEl, gpxLayer.profileEl.querySelector('.gpx-profile-head'))

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

// hand the flight to the existing tour controller
// cinematic drone follow-cam for the GPX track (terrain-aware chase camera)
const drone = new DroneCam({ camera, controls, sampleGround: (x, z) => terrain.sample?.(x, z) ?? 0 })

function flyTrack() {
  const w = gpxLayer.track?.world
  if (!w || w.length < 2 || modes.mode !== 'surface') return
  const km = gpxLayer.track.cumKm[gpxLayer.track.cumKm.length - 1]
  const duration = THREE.MathUtils.clamp(km * 2.2, 14, 95)
  tour.active = false
  tween.active = false
  drone.start(w, { duration })
}

// ------------------------------------------------------------------ GUI

scan = new ScanController(terrain.mapUniforms, TERRAIN_SIZE / 2)

const waterRebuild = () => realWater?.rebuild({ terrain, params })

// "individualiser la zone" — clip the map to the administrative boundary under
// the view (continent/country/region/departement by zoom). The landform sits
// straight on the ground: no plinth, no square ocean slab.
let regionBusy = false
function disposeRegionPlate() {
  if (!regionPlate) return
  scene.remove(regionPlate.mesh)
  regionPlate.mesh.geometry.dispose()
  regionPlate.mesh.material.dispose()
  regionPlate = null
}
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
    disposeRegionPlate()
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
    disposeRegionPlate()
    regionMaskCanvas = r ? r.maskCanvas : null
    rebuildRegionSkirt()
    if (r) modes.announce(`ZONE — ${String(r.name).toUpperCase()}`)
    else modes.announce('ZONE — NO BOUNDARY AT THIS SCALE')
  } catch {
    terrain.setRegionMask(null)
    disposeRegionPlate()
    disposeRegionSkirt()
    regionMaskCanvas = null
  } finally {
    regionBusy = false
  }
}

// export renders offline: the RAF chain pauses and the scene advances at a
// fixed timestep so the video is deterministic whatever the encode speed
let loopPaused = false
function stepScene(t, dt) {
  if (drone.active || tour.active || tween.active) updateCameraMotion(dt)
  if (!params.paused) {
    clouds.update(dt, params, camera)
    traffic.update(dt)
  }
  camera.updateMatrixWorld()
}

initTips()

const topBar = buildTopBar({
  params,
  setDarkMode: (v) => {
    setDarkMode(v)
    refreshAll()
  },
  // the Globe button always shows the WHOLE planet, spinning slowly
  enterOrbit: () => modes.enterOrbit(16000000),
  // the "?" button replays the guided tour (lazy-loaded, tiny)
  startTutorial: async () => {
    const { startTutorial } = await import('./ui/tutorial.js')
    startTutorial()
  },
  // first click pulls the export stack in (modal + Recorder + mediabunny) —
  // bars.js shows a busy state on the button while the chunk downloads
  openExport: async () => {
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
  },
})

buildBottomBar({
  goto: gotoCtl,
  openGpx: () => gpxFileInput.click(),
})

// bottom-left: quiet credit to the studio + a curated "inspiration" list of
// other beautiful 3D-map makers (opens a small popup)
buildCredits()

// bottom-right: one click to the isometric museum view — whole block, plate
// and cartouche in frame (45° azimuth, museum-shelf elevation)
// distance ×2 vs the first guess: at fov 30 the block's corner-on diagonal
// (~79 units) needs ~107 units of camera range for plate + cartouche to fit
// isometric shortcut: keep the museum-shelf angle but pull the camera as far
// back as the current view allows, so the WHOLE zone fits (no zoom-level change)
const ISO_DIR = new THREE.Vector3(62, 52, 62).normalize()
const ISO_TARGET = new THREE.Vector3(0, -1.5, 0)
isoBtn = buildIsoButton({
  flyIso: () => {
    if (modes.mode !== 'surface' || modes.busy) return
    tour.active = false
    const dist = controls.maxDistance * 0.97 // the farthest the surface stop permits
    flyTo(ISO_DIR.clone().multiplyScalar(dist), ISO_TARGET.clone())
  },
})

const createPanel = buildCreatePanel({
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
  dof,
  dofPass,
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
  cityRebuild: () => cityLabels.rebuild({ dem: terrain.dem, terrain, params }),
  applyTimeOfDay,
  applyLightPreset,
  lightPresets: Object.entries(LIGHT_PRESETS).map(([value, p]) => ({ value, label: p.label })),
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
})

// Shaders panel — right dock, between Create and Camera (created here so it
// docks between them). Holds the surface-shader treatments split out of Scan.
const shadersPanel = buildShadersPanel({
  getLiquidMetal: () => params.liquidMetal,
  setLiquidMetal: (v) => {
    params.liquidMetal = v
    terrain.setLiquidMetal(v, params)
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
  },
  getFxParam: (id, key) => params.fx[id]?.[key],
  setFxParam: (id, key, val) => {
    if (!params.fx[id]) return
    params.fx[id][key] = val
    if (params.surfaceFx === id) terrain.applyFxParams(params.fx[id]) // speed/opacity/blend re-pushed
  },
  // terrain MATERIAL — turns the WHOLE relief into a material (sibling of Liquid
  // metal): premium transmission glass, or an opaque wood/carbon swap
  surfaceMatList: [
    { value: 'glass', label: 'Glass (premium)' },
    { value: 'wood', label: 'Wood (CC0)' },
    { value: 'fabric', label: 'Fabric — denim' },
    { value: 'carbon', label: 'Carbon fibre' },
  ],
  getSurfaceMat: () => params.terrainSurfaceMat,
  setSurfaceMat: (id) => {
    params.terrainSurfaceMat = id || ''
    terrain.setMaterialMode(params.terrainSurfaceMat, params)
    // seed the roughness slider from the material's own default so it reads right
    if (id && id !== 'glass') params.terrainMatRoughness = terrain.material.roughness
  },
  getSurfaceMatBump: () => params.terrainSurfaceBump,
  setSurfaceMatBump: (v) => {
    params.terrainSurfaceBump = v
    terrain.setSurfaceMaterialBump(v)
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

const cameraPanel = buildCameraPanel({
  params,
  camera,
  controls,
  renderer,
  composer,
  dof,
  dofPass,
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

const explorePanel = buildExplorePanel({
  flyTo: (lat, lon, zoom) => modes.flyTo(lat, lon, zoom),
})

const scanPanel = buildScanPanel({
  runScan: (typeId) => scan.trigger(typeId, { x: controls.target.x, z: controls.target.z }, params.scanDuration),
})

// auto-fold: expanding a section in one panel folds its dock neighbour so a
// column never grows past the screen
const foldPairs = [
  [createPanel, cameraPanel], [createPanel, shadersPanel],
  [cameraPanel, createPanel], [cameraPanel, shadersPanel],
  [shadersPanel, createPanel], [shadersPanel, cameraPanel],
  [explorePanel, scanPanel],
  [scanPanel, explorePanel],
]
for (const [a, b] of foldPairs)
  for (const s of a.sections)
    s.head.addEventListener('click', () => {
      if (s.open) {
        b.setCollapsed(true)
        for (const t of b.sections) t.setOpen(false)
      }
    })
cameraPanel.setCollapsed(true)
scanPanel.setCollapsed(true)

// adaptive quality — built once the composer, panels and mode machine exist
// so tier changes can announce, re-sync the Camera panel and stay quiet in
// orbital view / during a live recording (a pixelRatio change would resize
// the canvas mid-encode and abort the MP4)
aq = createAdaptiveQuality({
  params,
  renderer,
  composer,
  dof,
  dofPass,
  grain,
  applyShadowMode,
  announce: (m) => modes.announce(m),
  refreshAll,
  canStep: () => modes.mode === 'surface' && !modes.busy && !recorder?.recording,
})


// ------------------------------------------------------------------ loop

// console access for debugging/scripting
window.__exp = { scene, camera, controls, params, terrain, loadRealTerrain, globe, modes, gotoCtl, gpxLayer, loadGpxText, flyTrack, tour, drone, clouds, plinth, peaksLayer, applyPalette, applyStyle, applyGridContour, applyMonochrome, applyTemplate, setDarkMode, groundInfo, renderer, composer, realWater, waterRebuild, traffic, get scan() { return scan }, get labels() { return labels }, get aq() { return aq }, get recorder() { return recorder } }

// real world is the default source — fetch its tiles on startup
if (params.source === 'real') loadRealTerrain()

const clock = new THREE.Clock()

// camera motion for one frame — shared by the live loop and offline export
function updateCameraMotion(dt) {
  // drone follow-cam for the GPX track — chase the route from behind/above
  if (drone.active) {
    drone.update(dt)
    return
  }
  // cinematic tour: arc-length uniform speed + trapezoid profile + damped gimbal
  if (tour.active) {
    tour.t = Math.min(1, tour.t + dt / (tour.duration || params.tourDuration))
    const s = trapezoid(tour.t, 0.18)

    // position: exact on the spline, constant speed thanks to getPointAt
    tour.curve.getPointAt(s, _tp)
    camera.position.copy(_tp)

    // desired orientation: look at the gaze target, rolled into the turn
    tourGaze(s, _tp, _tg)
    controls.target.copy(_tg)
    _tm.lookAt(camera.position, _tg, UP)
    _tq.setFromRotationMatrix(_tm)
    tour.curve.getTangentAt(s, _tt0)
    tour.curve.getTangentAt(Math.min(s + 0.02, 1), _tt1)
    const curl = _tt0.x * _tt1.z - _tt0.z * _tt1.x // signed xz turn over the window
    const arrived = tour.t >= 1
    // after arrival: settle — unwind the bank and let the gimbal fully converge
    // before handing off, so OrbitControls has nothing to snap to
    const bankTarget = arrived ? 0 : THREE.MathUtils.clamp(curl * 15 * params.tourBank, -0.5, 0.5)
    tour.bank = THREE.MathUtils.damp(tour.bank, bankTarget, 2.5, dt)
    _tq.multiply(_tqr.setFromAxisAngle(Z_AXIS, tour.bank))

    // gimbal: rotation chases the desired orientation with a max slew rate,
    // so it can never jump — 80°/s hard ceiling
    const angle = camera.quaternion.angleTo(_tq)
    if (angle > 1e-5) {
      const f = Math.min(1 - Math.exp(-3.2 * dt), (1.4 * dt) / angle)
      camera.quaternion.slerp(_tq, f)
    }

    if (arrived && angle < 0.001 && Math.abs(tour.bank) < 0.001) tour.active = false
  } else if (tween.active) {
    tween.t = Math.min(1, tween.t + dt / params.flyDuration)
    const e = EASINGS[params.flyEasing](tween.t)
    camera.position.lerpVectors(tween.p0, tween.p1, e)
    controls.target.lerpVectors(tween.t0, tween.t1, e)
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

  // idle planet spin: in orbital view the Earth slowly turns under the camera
  // until the user takes the controls back
  if (modes.mode === 'orbital' && !modes.busy && !controlsHeld && performance.now() - lastUserInput > 3000) {
    camera.position.applyAxisAngle(UP, dt * 0.035)
    camera.lookAt(0, 0, 0)
  }

  // mode machine: altitude thresholds, glides, altimeter; globe LOD streaming
  modes.update(dt)
  if (modes.mode === 'orbital') globe.update(camera, dt)

  // fog carries the close-up read only: it dissipates as soon as the camera
  // pulls one step back from max zoom, so mid-zoom never whites out
  if (modes.mode === 'surface' && scene.fog) {
    const dist = controls.getDistance()
    const lift = THREE.MathUtils.smoothstep(dist, controls.minDistance * 1.15, controls.minDistance * 2.5)
    // scaled from the GUI values (not constants) so the Look → fog sliders
    // keep their meaning at every distance
    fogRef.near = THREE.MathUtils.lerp(params.fogNear, params.fogNear * 9, lift)
    fogRef.far = THREE.MathUtils.lerp(params.fogFar, params.fogFar * 10.4, lift)
  }

  // refresh camera matrices NOW so DOM projections match this frame's render
  // (otherwise labels are projected with last frame's matrices and lag behind)
  camera.updateMatrixWorld()

  if (!params.paused && modes.mode === 'surface') {
    hud3.update(dt, t, params)
    cone.update(dt, t, mouse, params)
    clouds.update(dt, params, camera)
    traffic.update(dt)
    terrain.tickSurfaceFx(dt, params.fx[params.surfaceFx]?.speed ?? 0) // animate at the effect's speed
    terrain.tickLiquidMetal(dt, params.lmSpeed) // molten flow when liquid metal is on
  }
  peaksLayer.update(camera, window.innerWidth, window.innerHeight, modes.mode === 'surface')

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
  dof.cocMaterial.worldFocusDistance = params.focusDistance

  if (params.hud && modes.mode === 'surface') {
    fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05
    const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    const secs = Math.floor(t)
    hud2.update(dt, camera, window.innerWidth, window.innerHeight, {
      conePoint: cone.getFocusPoint(),
      pois,
      az: THREE.MathUtils.radToDeg(sph.theta),
      el: 90 - THREE.MathUtils.radToDeg(sph.phi),
      focus: params.focusDistance,
      fps,
      clock: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
      coneAlt: cone.group.position.y,
      spin: params.coneSpin,
    })
  }

  realWater?.update(dt, sun) // water simulation: waves, caustics, sun glint
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
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  gpxLayer.onResize(window.innerWidth, window.innerHeight)
  reclampDraggables()
})
