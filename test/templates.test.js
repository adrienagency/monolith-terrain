import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TEMPLATES } from '../src/templates.js'

const hexToHsl = (hex) => {
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
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c)

const ramp = (t) => t.palette.rampStops
const low = (t) => ramp(t)[0].c
const high = (t) => ramp(t)[ramp(t).length - 1].c

test('every template is a complete, well-formed bundle', () => {
  for (const [key, t] of Object.entries(TEMPLATES)) {
    for (const section of ['palette', 'style', 'grid', 'light', 'surface', 'look']) {
      assert.ok(t[section] && typeof t[section] === 'object', `${key}.${section} present`)
    }
    // an 8-stop land ramp, ordered low → high, valid hexes
    assert.equal(ramp(t).length, 8, `${key}: 8 tint stops`)
    for (let i = 0; i < ramp(t).length; i++) {
      assert.ok(isHex(ramp(t)[i].c), `${key}: "${ramp(t)[i].c}" is a valid hex`)
      if (i) assert.ok(ramp(t)[i].p > ramp(t)[i - 1].p, `${key}: stop ${i} rises`)
    }
    for (const c of [t.palette.oceanShallow, t.palette.oceanDeep, t.palette.ink]) {
      assert.ok(isHex(c), `${key}: "${c}" is a valid hex`)
    }
    // sea darkens with depth
    assert.ok(hexToHsl(t.palette.oceanShallow).l > hexToHsl(t.palette.oceanDeep).l, `${key}: sea darkens`)
  }
})

test('ICELAND uses the user-tuned blue plate base settings', () => {
  const t = TEMPLATES.iceland
  // bold electric-blue lowland climbing to a light-grey summit cap
  assert.ok(hexToHsl(low(t)).h > 195 && hexToHsl(low(t)).h < 220, 'electric-blue lowland')
  assert.ok(hexToHsl(high(t)).l > 0.8, 'light summit cap')
  const deep = hexToHsl(t.palette.oceanDeep)
  assert.ok(deep.h > 195 && deep.h < 240, `deep sea is blue (h=${deep.h.toFixed(0)})`)
  assert.ok(deep.l < 0.35, 'deep sea is dark navy')
  // the captured base settings: crisp indigo contours + a light survey grid + slope shading
  assert.equal(t.style.mapTint, 0.68)
  assert.equal(t.style.heightContrast, 3.4)
  assert.equal(t.style.heightPivot, 0.49)
  assert.equal(t.style.slopeTint, 0.48)
  assert.equal(t.grid.contourInterval, 0.29)
  assert.equal(t.grid.contourOpacity, 0.86)
  assert.equal(t.grid.contourColor, '#0c0b7a')
  assert.equal(t.grid.contourWeight, 0.55)
  assert.equal(t.grid.gridStep, 5)
  assert.equal(t.grid.gridOpacity, 0.54)
  assert.equal(t.grid.gridColor, '#242220')
  assert.equal(t.palette.oceanMid, '#6cb3fe')
  assert.equal(t.look.clouds, false)
  assert.notEqual(t.look.plinth, false, 'the 3D slab is shared — a template never hides it')
  assert.ok(t.light.sunElevation <= 35, 'low sun for crisp relief')
  assert.equal(t.darkMode, false)
})

test('FALLOUT WASTELANDS is a warm scorched-plate look', () => {
  const t = TEMPLATES['fallout-wastelands']
  assert.ok(t, 'preset exists')
  assert.ok(hexToHsl(high(t)).l > 0.92, 'white-hot peaks')
  // the darkest land tint is a dark sienna, well below the golden plains
  const ls = ramp(t).map((s) => hexToHsl(s.c).l)
  const darkest = Math.min(...ls)
  assert.ok(darkest < 0.3, 'a dark sienna band exists')
  assert.ok(hexToHsl(low(t)).l > darkest + 0.2, 'plains lighter than the flanks')
  // the low/mid land tints are warm (yellow-orange / ochre 15–55°)
  for (const s of ramp(t).slice(0, 5)) {
    const c = hexToHsl(s.c)
    assert.ok(c.h >= 15 && c.h <= 55, `land hue ${c.h.toFixed(0)} is warm`)
  }
  // sea in blue tones now, still fairly light
  const sea = hexToHsl(t.palette.oceanShallow)
  assert.ok(sea.h > 170 && sea.h < 240, `sea is blue (h=${sea.h.toFixed(0)})`)
  assert.ok(t.style.slopeTint > 0.3, 'warm slope shading on the flanks')
  assert.ok(t.style.mapTint >= 0.78, 'the warm ramp leads while the hillshade sculpts')
  assert.equal(t.look.clouds, false)
  assert.notEqual(t.look.plinth, false, 'the 3D slab is shared — a template never hides it')
})

test('DENALI is a full USGS hypsometric band system over blue water', () => {
  const t = TEMPLATES.denali
  assert.ok(t, 'preset exists')
  assert.equal(ramp(t).length, 8)
  // green tundra at the bottom, light-grey summit cap at the top
  const lowc = hexToHsl(low(t))
  assert.ok(lowc.h >= 60 && lowc.h <= 140, `lowland green (h=${lowc.h.toFixed(0)})`)
  assert.ok(hexToHsl(high(t)).l > 0.8, 'light summit cap')
  // blue water deepening
  const deep = hexToHsl(t.palette.oceanDeep)
  assert.ok(deep.h > 180 && deep.h < 240, `blue water (h=${deep.h.toFixed(0)})`)
  assert.ok(deep.l < hexToHsl(t.palette.oceanShallow).l, 'water darkens with depth')
  // the high-rock band reads red-brown, not orange sienna
  const rock = hexToHsl(ramp(t)[5].c)
  assert.ok(rock.h <= 20, `high rock is red-brown (h=${rock.h.toFixed(0)})`)
  // captured base settings: visible contours + a light survey grid
  assert.equal(t.grid.contourOpacity, 0.52)
  assert.equal(t.grid.gridStep, 3)
  assert.equal(t.grid.gridOpacity, 0.32)
  assert.equal(t.light.sunElevation, 11)
  assert.equal(t.light.sunAzimuth, 142)
  // pronounced vertical relief, mounted plate (slab kept)
  assert.ok(t.terrain.demExaggeration >= 1.7, 'pronounced relief')
  assert.equal(t.look.plinth, true, 'a mounted relief plate keeps the slab')
})
