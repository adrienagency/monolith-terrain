import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatePalette, generateStyle, generateGridContour, monochromeLook, expandToRampStops } from '../src/palette.js'
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
