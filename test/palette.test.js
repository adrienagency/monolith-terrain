import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generatePalette, generateStyle, generateGridContour } from '../src/palette.js'
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
