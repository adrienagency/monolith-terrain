import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATE_KEYS, captureLook } from '../src/templates-user.js'
import { captureShareState, parseShareState, encodeShareState, decodeShareState, FEN_MAX } from '../src/share-link.js'
import { COURSE_ELASTIQUE } from '../src/fenetre-course.js'

// a tiny stand-in for `params` — only the keys share-link.js actually reads
function fakeParams(overrides = {}) {
  const p = {
    demLat: 45.9, demLon: 6.13, demZoom: 10,
    rampStops: [{ c: '#ffffff', p: 0 }, { c: '#ffa861', p: 1 }],
    oceanShallow: '#dce8ec', oceanMid: '#7fa8b8', oceanDeep: '#31576b', darkMode: false,
    mapTint: 1, heightContrast: 5.1, heightPivot: 0.53, slopeTint: 0.5,
    waterEnabled: true, waterOpacity: 1, waterFill: false, lakeColor: '#5b8fb0',
    placesEnabled: true, placesDensity: 1, placesSize: 1, placesHalo: true,
    contourInterval: 0.11, contourOpacity: 0.5, contourWeight: 0.7, contourColor: '#000000',
    gridStep: 5, gridOpacity: 0.4, gridColor: '#242220', hudInk: '#17191b', hudAccent: '#ff4d00', labels: true,
    sunIntensity: 1, sunAzimuth: 0, sunElevation: 45, hemiIntensity: 1, envLight: 0.16, shadowSoftness: 5, timeOfDay: 10, shadowMode: 'dynamic',
    color: '#dddcd5', roughness: 0.88, roughnessVariation: 0.14, roughnessScale: 9.5, bumpScale: 0.9, envMapIntensity: 0.2,
    exposure: 0.96, contrast: 0.07, saturation: -0.35, vignette: 0.6, grain: 0, fogNear: 35.5, fogFar: 50, fogColor: '#ffffff', fogEnabled: false,
    bgMode: 'solid', bgColorA: '#e9eef4', bgColorB: '#dfe6ef', bgColorC: '#c7d2df', bgAngle: 135, bgEnv: '',
    fov: 30, autoFocus: true, focusDistance: 5000, focusRatio: 0.3, bokehEnabled: false, bokehScale: 2,
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
    mapTint: 1.2, heightContrast: 6, lakeColor: '#ff0000', hudAccent: '#00ff00',
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

// ══════════ LA POSITION DANS L'EMPRISE 3×3 ══════════════════════════════════
//
// ⚠️ LE VERROU DE COMPATIBILITÉ EST LE PREMIER TEST DU LOT, et il n'est pas
// décoratif : les cartes déjà publiées sur /r/<id> sont des payloads figés dans
// Netlify Blobs, écrits AVANT ce champ. Elles doivent rouvrir exactement la
// même vue — ce que `VERSION` inchangée + un champ facultatif garantissent par
// construction, mais qu'on ne suppose pas.

test('un payload SANS `fen` (toutes les cartes déjà publiées) ouvre la même vue', () => {
  const base = captureLook(fakeParams())
  const cam = { px: 1, py: 18, pz: 19, tx: 0, ty: -0.3, tz: 0 }
  // Écrit à la main dans la forme EXACTE que produisait le code d'avant :
  // pas de clé `fen`, v: 1. C'est ce qu'un blob de production contient.
  const ancien = {
    format: 'shibumap-share',
    v: 1,
    loc: { lat: 45.9231, lon: 6.8697, zoom: 12 },
    cam,
    look: { darkMode: true, gridStep: 8 },
  }
  const out = parseShareState(ancien, base)
  assert.ok(out, 'un ancien payload ne doit JAMAIS être rejeté')
  assert.deepEqual(out.loc, { lat: 45.9231, lon: 6.8697, zoom: 12 })
  assert.deepEqual(out.cam, cam)
  assert.deepEqual(out.fen, { x: 0, z: 0 }, 'sans décalage, on rouvre au centre du bloc — la vue d’avant')
  assert.equal(out.look.darkMode, true)
  assert.equal(out.look.gridStep, 8)
})

test('captureShareState n’écrit PAS `fen` hors mode continu ni au centre', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams()
  // hors mode continu, main.js passe null : l'objet doit sortir tel qu'avant
  assert.equal('fen' in captureShareState(params, null, base, null), false)
  assert.equal('fen' in captureShareState(params, null, base), false)
  // au centre de l'emprise il n'y a rien à dire — un lien plus court vaut mieux
  assert.equal('fen' in captureShareState(params, null, base, { x: 0, z: 0 }), false)
})

test('la position dans l’emprise fait l’aller-retour au bit près', () => {
  const base = captureLook(fakeParams())
  const params = fakeParams()
  const state = captureShareState(params, null, base, { x: -37.25, z: 12.5 })
  const out = parseShareState(JSON.parse(JSON.stringify(state)), base)
  assert.deepEqual(out.fen, { x: -37.25, z: 12.5 })
})

test('la position dans l’emprise survit à l’encodage base64url', () => {
  const base = captureLook(fakeParams())
  const state = captureShareState(fakeParams(), null, base, { x: 55.9, z: -0.125 })
  const out = parseShareState(decodeShareState(encodeShareState(state)), base)
  assert.deepEqual(out.fen, { x: 55.9, z: -0.125 })
})

test('un `fen` hors course est RAMENÉ dans la course, pas rejeté', () => {
  // Une URL bricolée ne doit pas pouvoir demander une fenêtre que le mode
  // continu refuserait d'atteindre : on lirait le champ hors emprise, là où
  // `sampleDem` clampe — le relief s'étirerait en traînées au bord.
  const base = captureLook(fakeParams())
  const out = parseShareState({ ...captureShareState(fakeParams(), null, base), fen: { x: 9999, z: -1e9 } }, base)
  assert.deepEqual(out.fen, { x: FEN_MAX, z: -FEN_MAX })
  assert.equal(FEN_MAX, COURSE_ELASTIQUE, 'un second plafond à côté de la course finirait par diverger')
})

test('un `fen` malformé retombe sur le centre au lieu de fabriquer un NaN', () => {
  const base = captureLook(fakeParams())
  const bidons = [{ x: 'a', z: 0 }, { x: 1 }, { z: 1 }, {}, null, 3, [1, 2], { x: NaN, z: 0 }, { x: 1, z: Infinity }]
  for (const fen of bidons) {
    const out = parseShareState({ ...captureShareState(fakeParams(), null, base), fen }, base)
    assert.deepEqual(out.fen, { x: 0, z: 0 }, `fen=${JSON.stringify(fen)}`)
  }
})

test('le décalage coûte moins de 40 caractères d’URL', () => {
  const base = captureLook(fakeParams())
  const sans = encodeShareState(captureShareState(fakeParams(), null, base)).length
  const avec = encodeShareState(captureShareState(fakeParams(), null, base, { x: -21.5, z: 43.25 })).length
  assert.ok(avec - sans < 40, `le décalage ajoute ${avec - sans} caractères`)
})
