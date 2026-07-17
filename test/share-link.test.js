import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS, captureLook } from '../src/templates-user.js'
import { captureShareState, parseShareState, encodeShareState, decodeShareState } from '../src/share-link.js'

// a tiny stand-in for `params` — only the keys share-link.js actually reads
function fakeParams(overrides = {}) {
  const p = {
    demLat: 45.9, demLon: 6.13, demZoom: 10,
    rampStops: [{ c: '#ffffff', p: 0 }, { c: '#ffa861', p: 1 }],
    oceanShallow: '#dce8ec', oceanMid: '#7fa8b8', oceanDeep: '#31576b', darkMode: false,
    mapTint: 1, heightContrast: 5.1, heightPivot: 0.53, slopeTint: 0.5,
    roadsEnabled: true, roadsOpacity: 1, roadsDetail: 1, roadColor: '', waterEnabled: true, waterOpacity: 1, waterFill: false,
    placesEnabled: true, placesDensity: 1, placesSize: 1, placesHalo: true,
    contourInterval: 0.11, contourOpacity: 0.5, contourWeight: 0.7, contourColor: '#000000',
    gridStep: 5, gridOpacity: 0.4, gridColor: '#242220', hudInk: '#17191b', hudAccent: '#ff4d00', labels: true,
    sunIntensity: 1, sunAzimuth: 0, sunElevation: 45, hemiIntensity: 1, envLight: 0.16, shadowSoftness: 5, timeOfDay: 10, shadowMode: 'dynamic',
    color: '#dddcd5', roughness: 0.88, roughnessVariation: 0.14, roughnessScale: 9.5, bumpScale: 0.9, envMapIntensity: 0.2,
    exposure: 0.96, contrast: 0.07, saturation: -0.35, vignette: 0.6, grain: 0, fogNear: 35.5, fogFar: 50, fogColor: '#ffffff', fogEnabled: false,
    bgMode: 'solid', bgColorA: '#e9eef4', bgColorB: '#dfe6ef', bgColorC: '#c7d2df', bgAngle: 135, bgEnv: '',
    fov: 30, autoFocus: true, focusDistance: 20, focusRange: 10, bokehEnabled: false, bokehScale: 2,
    plinth: true, plinthDepth: 7, plinthColor: '#d8d4cc', plinthFinish: 'solid', plinthPbr: 'stone', plinthGlass: 'frosted',
    plinthGlassDiffusion: 0.7, plinthGlassProjection: 0.5, plinthGlassBump: 0.6, plinthBump: 1.5,
    slabCorner: 0.04, slabCornerSmoothing: 0.6, groundInfo: true,
    terrainSurfaceMat: '', terrainSurfaceBump: 1.3, terrainMatScale: 1, terrainMatRoughness: 0.75, terrainMatNoise: 0, terrainMatAboveZero: false,
    terrainGlassFrost: 0.5, terrainGlassThickness: 8, terrainGlassTint: '#bfe4ff', terrainGlassClarity: 12, terrainGlassReflection: 1.4,
    liquidMetal: false, lmMetalness: 0.5, lmRoughness: 0.1, lmReflection: 1, lmSpeed: 0.3,
    surfaceFx: 0, fx: { 1: { colA: '#ffffff', colB: '#808080', colC: '#000000', speed: 0.15, scale: 1 } },
    cloudsEnabled: false, cloudOpacity: 1.5, cloudAltitude: 4.5, cloudDrift: 3, cloudScale: 1, cloudCoverage: 0.5,
    cloudBillow: 0.5, cloudBrightness: 1, cloudAltSpread: 1, cloudDriftVar: 0.5, cloudContrast: 1, cloudSSS: 0.5,
    gpxWidth: 3, gpxColor: '', gpxGradient: true, gpxGradientMode: 'elevation', gpxGlow: false,
    gpxMarkers: true, gpxKm: true, gpxAltReadout: true, gpxSlopeReadout: false,
  }
  return { ...p, ...overrides }
}

test('captureShareState + parseShareState round-trips an unmodified look losslessly', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams()
  const cam = { px: 1, py: 18, pz: 19, tx: 0, ty: -0.3, tz: 0 }
  const state = captureShareState(params, cam, base)
  // nothing changed from base → diff should be empty (no fxActive since surfaceFx is 0)
  assert.deepEqual(state.look, {})

  const encoded = encodeShareState(state)
  const decoded = decodeShareState(encoded)
  const parsed = parseShareState(decoded, base)
  assert.ok(parsed)
  assert.equal(parsed.loc.lat, 45.9)
  assert.equal(parsed.loc.lon, 6.13)
  assert.equal(parsed.loc.zoom, 10)
  assert.deepEqual(parsed.cam, cam)
  for (const k of TEMPLATE_KEYS) assert.deepEqual(parsed.look[k], base[k], `key ${k} matches base`)
})

test('a changed look key survives the round trip; unchanged keys stay default-sized in the diff', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams({ darkMode: true, contourColor: '#112233', gridStep: 8 })
  const state = captureShareState(params, null, base)
  assert.deepEqual(Object.keys(state.look).sort(), ['contourColor', 'darkMode', 'gridStep'])

  const roundTrip = parseShareState(decodeShareState(encodeShareState(state)), base)
  assert.equal(roundTrip.look.darkMode, true)
  assert.equal(roundTrip.look.contourColor, '#112233')
  assert.equal(roundTrip.look.gridStep, 8)
  // everything else still matches base
  assert.equal(roundTrip.look.mapTint, base.mapTint)
})

test('only the ACTIVE surface effect travels, not the whole fx store', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams({ surfaceFx: 1, fx: { 1: { colA: '#ff0000', colB: '#808080', colC: '#000000', speed: 0.5, scale: 2 } } })
  const state = captureShareState(params, null, base)
  assert.ok(state.look.fxActive)
  assert.equal(state.look.fxActive.id, 1)
  assert.equal(state.look.fxActive.p.colA, '#ff0000')

  const roundTrip = parseShareState(decodeShareState(encodeShareState(state)), base)
  assert.equal(roundTrip.look.surfaceFx, 1)
  assert.equal(roundTrip.look.fx[1].colA, '#ff0000')
})

test('rejects garbage / wrong format / bad version', () => {
  const base = captureLook(fakeParams())
  assert.equal(parseShareState(null, base), null)
  assert.equal(parseShareState({}, base), null)
  assert.equal(parseShareState({ format: 'shibumap-share', v: 99, loc: { lat: 0, lon: 0, zoom: 10 } }, base), null)
  assert.equal(decodeShareState('%%%not-base64%%%'), null)
  assert.equal(decodeShareState(''), null)
  assert.equal(decodeShareState(null), null)
})

test('clamps out-of-range / non-finite location fields instead of crashing', () => {
  const base = captureLook(fakeParams())
  const parsed = parseShareState({ format: 'shibumap-share', v: 1, loc: { lat: 999, lon: 999999, zoom: NaN } }, base)
  assert.equal(parsed, null) // zoom is NaN → whole loc invalid, reject
  const parsed2 = parseShareState({ format: 'shibumap-share', v: 1, loc: { lat: 999, lon: -999, zoom: 999 } }, base)
  assert.ok(parsed2)
  assert.equal(parsed2.loc.lat, 85) // clamped
  assert.ok(parsed2.loc.lon >= -180 && parsed2.loc.lon <= 180) // wrapped
  assert.equal(parsed2.loc.zoom, 18) // clamped
})

test('a camera pose with a non-finite component is dropped entirely rather than half-applied', () => {
  const base = captureLook(fakeParams())
  const raw = { format: 'shibumap-share', v: 1, loc: { lat: 0, lon: 0, zoom: 10 }, cam: { px: 1, py: 2, pz: Infinity, tx: 0, ty: 0, tz: 0 } }
  const parsed = parseShareState(raw, base)
  assert.equal(parsed.cam, null)
})

test('unknown / prototype-polluting keys in the look are ignored, never copied', () => {
  const base = captureLook(fakeParams())
  const raw = {
    format: 'shibumap-share', v: 1, loc: { lat: 0, lon: 0, zoom: 10 },
    look: { __proto__: { polluted: true }, notARealKey: 'x', darkMode: true },
  }
  const parsed = parseShareState(raw, base)
  assert.ok(parsed)
  assert.equal(parsed.look.darkMode, true)
  assert.equal(parsed.look.notARealKey, undefined)
  assert.equal({}.polluted, undefined) // Object.prototype was never touched
})

test('a bogus rampStops array is rejected key-by-key, falling back to base', () => {
  const base = captureLook(fakeParams())
  const raw = {
    format: 'shibumap-share', v: 1, loc: { lat: 0, lon: 0, zoom: 10 },
    look: { rampStops: [{ c: 'javascript:alert(1)', p: 0 }, { c: '#ffffff', p: NaN }] },
  }
  const parsed = parseShareState(raw, base)
  // no valid stop in the array → falls back to base wholesale
  assert.deepEqual(parsed.look.rampStops, base.rampStops)
})

test('encoded URL length for a realistic customized state stays well under 2000 chars', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams({
    darkMode: true, contourColor: '#112233', gridColor: '#334455', gridStep: 8,
    mapTint: 1.2, heightContrast: 6, roadColor: '#ff0000', hudAccent: '#00ff00',
    plinthColor: '#123456', fogColor: '#abcdef', bgColorA: '#111111', bgColorB: '#222222', bgColorC: '#333333',
    rampStops: [
      { c: '#000000', p: 0 }, { c: '#111111', p: 0.14 }, { c: '#222222', p: 0.28 }, { c: '#333333', p: 0.42 },
      { c: '#444444', p: 0.56 }, { c: '#555555', p: 0.7 }, { c: '#666666', p: 0.84 }, { c: '#777777', p: 1 },
    ],
  })
  const cam = { px: 12.3, py: 8.4, pz: -19.2, tx: 0.1, ty: -0.2, tz: 3.4 }
  const state = captureShareState(params, cam, base)
  const encoded = encodeShareState(state)
  assert.ok(encoded.length < 1500, `encoded payload is ${encoded.length} chars`)
})
