import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatePalette, generateStyle, generateGridContour, monochromeLook, expandToRampStops } from '../src/palette.js'
import { srgbToOklab, oklabToSrgb, oklabToLch, lchToOklab, mixOklch, buildRamp2D, sampleRampStops, RAMP2D_W, RAMP2D_H } from '../src/palette.js'
import { mulberry32 } from '../src/noise.js'

// hex → {h, s, l} (h in degrees, s/l in 0..1)
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h
  if (max === r) h = 60 * (((g - b) / d) % 6)
  else if (max === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  return { h: (h + 360) % 360, s, l }
}

const isWarm = (h) => h <= 65 || h >= 340
const isCoolOrNeutral = ({ h, s }) => s < 0.22 || (h >= 140 && h <= 270)

test('palettes obey the color-theory rules over many samples', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generatePalette(mulberry32(seed))

    // summits warm
    const high = hexToHsl(p.gradHigh)
    assert.ok(isWarm(high.h), `seed ${seed}: summit hue ${high.h.toFixed(0)}° not warm`)
    assert.ok(high.s > 0.25, `seed ${seed}: summit too grey`)

    // lowlands cool or paper-neutral
    const low = hexToHsl(p.gradLow)
    assert.ok(isCoolOrNeutral(low) || low.l > 0.85, `seed ${seed}: lowland hue ${low.h.toFixed(0)}° reads warm`)
    assert.ok(low.l > 0.7, `seed ${seed}: lowland too dark`)

    // deep sea darker than shallows, both sea-ish
    const shallow = hexToHsl(p.oceanShallow)
    const deep = hexToHsl(p.oceanDeep)
    assert.ok(deep.l < shallow.l - 0.25, `seed ${seed}: deep sea not darker (${deep.l} vs ${shallow.l})`)
    assert.ok(shallow.l > 0.75, `seed ${seed}: shallows not pale`)

    // gradient stop ordering
    assert.ok(p.gradMid1Pos > 0.05 && p.gradMid2Pos > p.gradMid1Pos && p.gradMid2Pos <= 0.9)
    assert.ok(typeof p.name === 'string' && p.name.length > 3)
  }
})

test('the 0 m zone is near-white most of the time, seas darken monotonically', () => {
  let nearWhite = 0
  for (let seed = 1; seed <= 300; seed++) {
    const p = generatePalette(mulberry32(seed))
    const low = hexToHsl(p.gradLow)
    if (low.l > 0.9 && low.s < 0.15) nearWhite++
    // three sea stops, strictly darker with depth
    const sh = hexToHsl(p.oceanShallow)
    const mid = hexToHsl(p.oceanMid)
    const dp = hexToHsl(p.oceanDeep)
    assert.ok(sh.l > mid.l && mid.l > dp.l, `seed ${seed}: sea not monotonic (${sh.l}/${mid.l}/${dp.l})`)
  }
  assert.ok(nearWhite >= 300 * 0.6, `near-white zero zone in ${nearWhite}/300 palettes — expected most`)
})

test('dark palettes: black/brown terrain, vivid fluo summits, abyssal seas, light ink', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const p = generatePalette(mulberry32(seed), 'dark')
    assert.equal(p.mode, 'dark')
    const low = hexToHsl(p.gradLow)
    assert.ok(low.l < 0.16, `seed ${seed}: dark low too bright (${low.l})`)
    const high = hexToHsl(p.gradHigh)
    assert.ok(high.s > 0.8, `seed ${seed}: summit not vivid (s=${high.s})`)
    assert.ok(high.l > 0.45 && high.l < 0.72, `seed ${seed}: summit lightness off`)
    assert.ok((high.h >= 50 && high.h <= 70) || (high.h >= 14 && high.h <= 36), `seed ${seed}: hue ${high.h} not fluo-yellow/hot-orange`)
    const dp = hexToHsl(p.oceanDeep)
    assert.ok(dp.l < 0.1, `seed ${seed}: abyss not near-black (${dp.l})`)
    const ink = hexToHsl(p.ink)
    assert.ok(ink.l > 0.7, `seed ${seed}: dark-mode ink not light`)
    const sh = hexToHsl(p.oceanShallow)
    const mid = hexToHsl(p.oceanMid)
    assert.ok(sh.l > mid.l && mid.l > dp.l, `seed ${seed}: dark sea not monotonic`)
  }
})

test('dark grid/contour ink is light enough to read on the dark sheet', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const g = generateGridContour(mulberry32(seed), 'dark')
    assert.ok(hexToHsl(g.contourColor).l > 0.6, `seed ${seed}: dark contour too dark`)
    assert.ok(hexToHsl(g.gridColor).l > 0.6, `seed ${seed}: dark grid too dark`)
  }
})

test('monochrome looks are near-greyscale with the relief carried by light', () => {
  const white = monochromeLook('white')
  assert.equal(white.darkMode, false)
  assert.ok(white.mapTint <= 0.3, 'white look leans on lighting')
  for (const s of white.rampStops) {
    const c = hexToHsl(s.c)
    assert.ok(c.s < 0.08, `stop nearly desaturated`)
    assert.ok(c.l > 0.9, `stop near-white`)
  }
  const dark = monochromeLook('dark')
  assert.equal(dark.darkMode, true)
  assert.ok(dark.mapTint <= 0.3, 'dark look leans on lighting')
  for (const s of dark.rampStops) {
    const c = hexToHsl(s.c)
    assert.ok(c.s < 0.12, `stop nearly desaturated`)
    assert.ok(c.l < 0.35, `stop dark`)
  }
  assert.ok(hexToHsl(dark.ink).l > 0.7, 'dark ink light enough to read')
})

test('expandToRampStops interpolates a legacy 4-stop into 8 ordered stops', () => {
  const stops = expandToRampStops('#000000', '#404040', '#808080', '#ffffff', 0.33, 0.66, 8)
  assert.equal(stops.length, 8)
  assert.equal(stops[0].c, '#000000')
  assert.equal(stops[7].c, '#ffffff')
  for (let i = 1; i < stops.length; i++) {
    assert.ok(stops[i].p > stops[i - 1].p, 'positions rise')
    assert.ok(hexToHsl(stops[i].c).l >= hexToHsl(stops[i - 1].c).l - 1e-6, 'lightness climbs on a mono ramp')
  }
})

test('generatePalette now yields an 8-stop rampStops', () => {
  const p = generatePalette(mulberry32(3))
  assert.ok(Array.isArray(p.rampStops) && p.rampStops.length === 8, 'eight land stops')
  assert.ok(/^#[0-9a-f]{6}$/i.test(p.rampStops[0].c))
})

test('style + grid/contour stay inside their GUI ranges', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = generateStyle(mulberry32(seed))
    assert.ok(s.mapTint >= 0.7 && s.mapTint <= 1)
    assert.ok(s.heightContrast >= 0.5 && s.heightContrast <= 20)
    assert.ok(s.heightPivot >= 0 && s.heightPivot <= 1)
    assert.ok(s.slopeTint >= 0 && s.slopeTint <= 1)

    const g = generateGridContour(mulberry32(seed + 1000))
    assert.ok(g.contourInterval >= 0.04 && g.contourInterval <= 0.6)
    assert.ok(g.contourOpacity >= 0 && g.contourOpacity <= 1)
    assert.ok(g.gridStep >= 2 && g.gridStep <= 14)
    assert.ok(g.gridOpacity >= 0 && g.gridOpacity <= 1)
    assert.match(g.contourColor, /^#[0-9a-f]{6}$/)
    const ink = hexToHsl(g.contourColor)
    assert.ok(ink.l < 0.5, `seed ${seed}: contour ink too light to read`)
  }
})

// ------------------------------------------------------------------- Oklab
const SAMPLE_HEXES = [
  '#000000', '#ffffff', '#808080', '#fafafa', '#dbd3b8', '#908e89', '#d7c3a8',
  '#dab38b', '#6a4c3e', '#271402', '#ff0000', '#00ff00', '#0000ff', '#136e7d',
]

test('Oklab : aller-retour sRGB → Oklab → sRGB, exact à l’arrondi 8 bits près', () => {
  for (const hex of SAMPLE_HEXES) assert.equal(oklabToSrgb(srgbToOklab(hex)), hex)
  // et sur un balayage plus large, pour ne pas tester que des couleurs choisies
  for (let i = 0; i < 256; i += 7) {
    const hex = `#${i.toString(16).padStart(2, '0')}${((i * 3) % 256).toString(16).padStart(2, '0')}${((i * 7) % 256).toString(16).padStart(2, '0')}`
    assert.equal(oklabToSrgb(srgbToOklab(hex)), hex, hex)
  }
})

test('Oklab : aller-retour Lab ↔ LCh', () => {
  for (const hex of SAMPLE_HEXES) {
    const lab = srgbToOklab(hex)
    const back = lchToOklab(oklabToLch(lab))
    for (const k of ['L', 'a', 'b']) assert.ok(Math.abs(lab[k] - back[k]) < 1e-9, `${hex} ${k}`)
  }
})

test('Oklab : L est monotone sur un gris qui s’éclaircit, et cadré 0..1', () => {
  let prev = -1
  for (let v = 0; v <= 255; v += 5) {
    const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`
    const { L } = srgbToOklab(hex)
    assert.ok(L > prev, `L non monotone en ${hex}`)
    assert.ok(L >= -1e-6 && L <= 1.0001, `L hors bornes : ${L}`)
    prev = L
  }
  assert.ok(Math.abs(srgbToOklab('#000000').L) < 1e-6)
  assert.ok(Math.abs(srgbToOklab('#ffffff').L - 1) < 1e-3)
})

test('mixOklch : extrémités exactes, luminance monotone, jamais de détour par le gris', () => {
  const A = '#556b2f' // vert olive
  const B = '#d2b48c' // tan
  assert.equal(mixOklch(A, B, 0), A)
  assert.equal(mixOklch(A, B, 1), B)
  const cs = [0, 0.25, 0.5, 0.75, 1].map((t) => oklabToLch(srgbToOklab(mixOklch(A, B, t))))
  for (let i = 1; i < cs.length; i++) assert.ok(cs[i].L > cs[i - 1].L, `L non monotone en ${i}`)
  // le milieu garde de la chroma : c'est précisément ce que l'interpolation
  // sRGB perdait (le « kaki mort »)
  const minEnds = Math.min(cs[0].C, cs[4].C)
  assert.ok(cs[2].C > minEnds * 0.8, `chroma effondrée au milieu : ${cs[2].C} vs ${minEnds}`)
})

test('mixOklch : la teinte prend l’arc COURT (rouge → magenta ne traverse pas le vert)', () => {
  const mid = oklabToLch(srgbToOklab(mixOklch('#ff0000', '#ff00ff', 0.5)))
  // l'arc court passe par les roses (teintes proches de 0/360), jamais par
  // les verts (~140°) ni les bleus (~260°)
  assert.ok(mid.h > 300 || mid.h < 40, `teinte intermédiaire ${mid.h}°`)
})

// ------------------------------------------------------------- LUT 2D rampe
const STOPS = {
  rampStops: [
    { c: '#fafafa', p: 0.0 }, { c: '#dbd3b8', p: 0.14 }, { c: '#908e89', p: 0.28 },
    { c: '#d7c3a8', p: 0.42 }, { c: '#dab38b', p: 0.56 }, { c: '#6a4c3e', p: 0.7 },
    { c: '#271402', p: 0.84 }, { c: '#fafaff', p: 1.0 },
  ],
}
const rowHex = (lut, x, y) => {
  const i = (y * lut.width + x) * 4
  return `#${[0, 1, 2].map((c) => lut.data[i + c].toString(16).padStart(2, '0')).join('')}`
}

test('buildRamp2D : à dry = wet = 0, TOUTES les lignes valent la médiane', () => {
  const lut = buildRamp2D(STOPS)
  assert.equal(lut.width, RAMP2D_W)
  assert.equal(lut.height, RAMP2D_H)
  const mid = lut.height >> 1
  for (let y = 0; y < lut.height; y++)
    for (let x = 0; x < lut.width; x += 37)
      assert.equal(rowHex(lut, x, y), rowHex(lut, x, mid), `ligne ${y}, x=${x}`)
})

test('buildRamp2D : la ligne médiane reproduit la rampe actuelle (interpolation sRGB des arrêts)', () => {
  const lut = buildRamp2D(STOPS, { dry: 0.8, wet: 0.9 })
  const mid = lut.height >> 1
  for (let x = 0; x < lut.width; x += 13) {
    const attendu = sampleRampStops(STOPS.rampStops, (x + 0.5) / lut.width, false)
    assert.equal(rowHex(lut, x, mid), attendu, `x=${x}`)
  }
})

test('buildRamp2D : ligne humide plus verte et plus sombre, ligne sèche plus claire et plus ambrée', () => {
  const lut = buildRamp2D(STOPS, { dry: 1, wet: 1 })
  const x = 300 // une zone franchement colorée de la rampe (ocre/chocolat)
  const sec = oklabToLch(srgbToOklab(rowHex(lut, x, 0)))
  const med = oklabToLch(srgbToOklab(rowHex(lut, x, lut.height >> 1)))
  const hum = oklabToLch(srgbToOklab(rowHex(lut, x, lut.height - 1)))
  assert.ok(sec.L > med.L, `sec ${sec.L} vs médian ${med.L}`)
  assert.ok(hum.L < med.L, `humide ${hum.L} vs médian ${med.L}`)
  assert.ok(sec.C < med.C, 'la ligne sèche doit être moins chromatique')
  assert.ok(hum.C > med.C, 'la ligne humide doit être plus chromatique')
  // teinte : le sec monte vers l'ambre, l'humide descend vers le vert
  const d = (a, b) => ((b - a + 540) % 360) - 180
  assert.ok(d(med.h, sec.h) > 0, `sec devrait virer ambre : ${med.h} → ${sec.h}`)
  assert.ok(d(med.h, hum.h) < 0, `humide devrait virer vert : ${med.h} → ${hum.h}`)
})

test('buildRamp2D : RGBA opaque, valeurs entières, aucune NaN, même sur une palette dégénérée', () => {
  for (const p of [STOPS, { rampStops: [{ c: '#123456', p: 0 }, { c: '#123456', p: 1 }] }, { gradLow: '#000000', gradMid1: '#444444', gradMid2: '#888888', gradHigh: '#ffffff' }]) {
    const lut = buildRamp2D(p, { dry: 1, wet: 1, oklab: true, width: 32, height: 8 })
    assert.equal(lut.data.length, 32 * 8 * 4)
    for (let i = 0; i < lut.data.length; i++) {
      assert.ok(Number.isInteger(lut.data[i]) && lut.data[i] >= 0 && lut.data[i] <= 255)
      if (i % 4 === 3) assert.equal(lut.data[i], 255)
    }
  }
})

test('sampleRampStops : bornes, ordre, et mode Oklab qui reste dans le gamut', () => {
  assert.equal(sampleRampStops(STOPS.rampStops, -1), '#fafafa')
  assert.equal(sampleRampStops(STOPS.rampStops, 2), '#fafaff')
  for (let i = 0; i <= 20; i++) {
    for (const ok of [false, true]) assert.match(sampleRampStops(STOPS.rampStops, i / 20, ok), /^#[0-9a-f]{6}$/)
  }
})
