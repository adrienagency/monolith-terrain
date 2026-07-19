// User templates — snapshot the current LOOK, save it (localStorage), export it
// to a .json file, and feed templates back in. A template captures only the
// look, never the location or camera, so applying it restyles the CURRENT view
// without flying anywhere. Each carries a thumbnail (data URL) for its card.
//
// This module is pure/DOM-free (capture, (de)serialize, localStorage). The scene
// wiring (thumbnail grab + pushing the look onto the live scene) lives in main.js.

const LS_KEY = 'shibumap-user-templates'
const FORMAT = 'shibumap-template'
const VERSION = 1

// The look whitelist — every param a template restores. Deliberately EXCLUDES
// demLat/demLon/demZoom/demLocation/source (location), camera pose, regionMode,
// the loaded GPX track itself (path/visibility/altitude), and per-zoom
// exaggeration, so a template never moves or reshapes the view. GPX *styling*
// (width/colour/casing/gradient/glow/…) is a look param like roadColor and
// IS included, so a template restyles whatever track happens to be loaded.
export const TEMPLATE_KEYS = [
  // colours / ramp / oceans / theme
  'rampStops', 'oceanShallow', 'oceanMid', 'oceanDeep', 'darkMode',
  // map style
  'mapTint', 'heightContrast', 'heightPivot', 'slopeTint',
  'roadsEnabled', 'roadsOpacity', 'roadsDetail', 'roadColor', 'waterEnabled', 'waterOpacity', 'waterFill', 'coastLine', 'placesEnabled', 'placesDensity', 'placesSize', 'placesHalo',
  // grid / contour / ink
  'contourInterval', 'contourOpacity', 'contourWeight', 'contourColor',
  'gridStep', 'gridOpacity', 'gridColor', 'hudInk', 'hudAccent', 'labels',
  // light
  'sunIntensity', 'sunAzimuth', 'sunElevation', 'hemiIntensity', 'envLight',
  'shadowSoftness', 'timeOfDay', 'shadowMode',
  // surface material scalars
  'color', 'roughness', 'roughnessVariation', 'roughnessScale', 'bumpScale', 'envMapIntensity',
  // post FX + fog
  'exposure', 'contrast', 'saturation', 'vignette', 'grain', 'fogNear', 'fogFar', 'fogColor', 'fogEnabled',
  // background (solid / gradient / HDRI sky)
  'bgMode', 'bgColorA', 'bgColorB', 'bgColorC', 'bgAngle', 'bgEnv',
  // camera lens / depth-of-field (NOT position/location) — shadowMode lives in
  // the light group above; listed once there, not duplicated here
  'fov', 'autoFocus', 'focusDistance', 'focusRange', 'bokehEnabled', 'bokehScale',
  // socle (block)
  'plinth', 'plinthDepth', 'plinthColor', 'plinthFinish', 'plinthPbr', 'plinthGlass',
  'plinthGlassDiffusion', 'plinthGlassProjection', 'plinthGlassBump', 'plinthBump',
  'slabCorner', 'slabCornerSmoothing', 'groundInfo',
  // relief material
  'terrainSurfaceMat', 'terrainSurfaceBump', 'terrainMatScale', 'terrainMatRoughness', 'terrainMatNoise', 'terrainMatAboveZero',
  'terrainGlassFrost', 'terrainGlassThickness', 'terrainGlassTint', 'terrainGlassClarity', 'terrainGlassReflection',
  // liquid metal
  'liquidMetal', 'lmMetalness', 'lmRoughness', 'lmReflection', 'lmSpeed',
  // surface shader
  'surfaceFx', 'fx',
  // clouds
  'cloudsEnabled', 'cloudOpacity', 'cloudAltitude', 'cloudDrift', 'cloudScale', 'cloudCoverage',
  'cloudBillow', 'cloudBrightness', 'cloudAltSpread', 'cloudDriftVar', 'cloudContrast', 'cloudSSS',
  // Route (GPX) styling — not the track itself, see note above. A template
  // saved before the start/finish markers became one toggle may still carry
  // the old 'gpxStart'/'gpxEnd' keys; they're simply not in this list any
  // more so they're ignored on load (harmless) rather than breaking.
  'gpxWidth', 'gpxColor', 'gpxGradient', 'gpxGradientMode', 'gpxGlow',
  'gpxMarkers', 'gpxKm', 'gpxAltReadout', 'gpxSlopeReadout',
]

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

// deep-copy just the look keys out of the live params
export function captureLook(params) {
  const out = {}
  for (const k of TEMPLATE_KEYS) if (k in params) out[k] = clone(params[k])
  return out
}

// ---- file (export / import) ----
// A template carries a colour STRIP (vignette) — an array of hex swatches from
// its palette — instead of a screenshot thumbnail. `shaders` flags whether it
// uses a surface shader / liquid metal, which sorts it into a category.
export function serializeTemplate(t) {
  return JSON.stringify({ format: FORMAT, version: VERSION, name: t.name, thumb: t.thumb, strip: t.strip, shaders: t.shaders, look: t.look }, null, 0)
}
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/
// only accept an image data URL for the thumbnail — an imported .json is
// untrusted and the value is used as an <img src>
const THUMB_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
export function parseTemplate(text) {
  let o
  try { o = JSON.parse(text) } catch { return null }
  if (!o || o.format !== FORMAT || !o.look || typeof o.look !== 'object') return null
  const thumb = typeof o.thumb === 'string' && THUMB_RE.test(o.thumb) ? o.thumb : null
  // re-derive strip + category from the actual look rather than trusting the
  // file's flags (a hand-edited/older export could mis-sort itself)
  const derived = stripFromLook(o.look)
  const strip = Array.isArray(o.strip) ? o.strip.filter((c) => typeof c === 'string' && HEX_RE.test(c)).slice(0, 8) : []
  return { name: String(o.name || 'Imported').slice(0, 40), thumb, strip: strip.length ? strip : derived.strip, shaders: derived.shaders, look: o.look }
}

// derive the vignette strip + shader category from a captured look
export function stripFromLook(look = {}) {
  const stops = Array.isArray(look.rampStops) ? look.rampStops : []
  const strip = stops.map((s) => s && s.c).filter((c) => typeof c === 'string' && HEX_RE.test(c))
  const shaders = !!((look.surfaceFx | 0) > 0 || look.liquidMetal || (look.terrainSurfaceMat && look.terrainSurfaceMat !== ''))
  return { strip: strip.length ? strip : ['#cbd5e1'], shaders }
}

// ---- localStorage list ----
export function loadUserTemplates() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    return Array.isArray(arr) ? arr.filter((t) => t && t.look) : []
  } catch { return [] }
}
// returns false if storage is full (thumbnails are data URLs and add up) so the
// caller can tell the user instead of silently losing the save
export function saveUserTemplates(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true } catch { return false }
}
