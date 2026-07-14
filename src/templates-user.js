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
// GPX, and per-zoom exaggeration, so a template never moves or reshapes the view.
export const TEMPLATE_KEYS = [
  // colours / ramp / oceans / theme
  'rampStops', 'oceanShallow', 'oceanMid', 'oceanDeep', 'darkMode',
  // map style
  'mapTint', 'heightContrast', 'heightPivot', 'slopeTint',
  // grid / contour / ink
  'contourInterval', 'contourOpacity', 'contourWeight', 'contourColor',
  'gridStep', 'gridOpacity', 'gridColor', 'hudInk', 'hudAccent', 'labels',
  // light
  'sunIntensity', 'sunAzimuth', 'sunElevation', 'hemiIntensity', 'envLight',
  'shadowSoftness', 'timeOfDay', 'shadowMode',
  // surface material scalars
  'color', 'roughness', 'roughnessVariation', 'roughnessScale', 'bumpScale', 'envMapIntensity',
  // post FX
  'exposure', 'contrast', 'saturation', 'vignette', 'grain', 'fogNear', 'fogFar', 'fogColor',
  // background (solid / gradient)
  'bgMode', 'bgColorB', 'bgColorC', 'bgAngle',
  // socle (block)
  'plinth', 'plinthDepth', 'plinthColor', 'plinthFinish', 'plinthPbr', 'plinthGlass',
  'plinthGlassDiffusion', 'plinthGlassProjection', 'plinthGlassBump', 'plinthBump',
  'slabCorner', 'slabCornerSmoothing', 'groundInfo',
  // relief material
  'terrainSurfaceMat', 'terrainSurfaceBump', 'terrainMatScale', 'terrainMatRoughness',
  'terrainGlassFrost', 'terrainGlassThickness', 'terrainGlassTint', 'terrainGlassClarity', 'terrainGlassReflection',
  // liquid metal
  'liquidMetal', 'lmMetalness', 'lmRoughness', 'lmReflection', 'lmSpeed',
  // surface shader
  'surfaceFx', 'fx',
  // clouds
  'cloudsEnabled', 'cloudOpacity', 'cloudAltitude', 'cloudDrift', 'cloudScale', 'cloudCoverage',
  'cloudBillow', 'cloudBrightness', 'cloudAltSpread', 'cloudDriftVar', 'cloudContrast', 'cloudSSS',
]

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

// deep-copy just the look keys out of the live params
export function captureLook(params) {
  const out = {}
  for (const k of TEMPLATE_KEYS) if (k in params) out[k] = clone(params[k])
  return out
}

// ---- file (export / import) ----
export function serializeTemplate(t) {
  return JSON.stringify({ format: FORMAT, version: VERSION, name: t.name, thumb: t.thumb, look: t.look }, null, 0)
}
// only accept a thumbnail that is a real base64 image data URL — an imported
// .json is untrusted, and the value is later used as an <img src>, so a crafted
// string could otherwise smuggle markup/handlers into the DOM.
const THUMB_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
export function parseTemplate(text) {
  let o
  try { o = JSON.parse(text) } catch { return null }
  if (!o || o.format !== FORMAT || !o.look || typeof o.look !== 'object') return null
  const thumb = typeof o.thumb === 'string' && THUMB_RE.test(o.thumb) ? o.thumb : null
  return { name: String(o.name || 'Imported').slice(0, 40), thumb, look: o.look }
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
