import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelInk, labelPlate, labelPlateInk } from '../src/map/text-label.js'

// ---- task 27 §2 / task 29: background plate/cartouche ------------------
// "fais ces cadres en couleur opposée au fond" — the plate must contrast
// the MAP, not just be a fixed tone: dark plate in light mode (light map),
// light plate in dark mode (dark map) — the OPPOSITE of the theme, not the
// same tone family as labelInk's halo. It must also still rank by tier so
// it can never flatten the importance ordering labelScale/labelInk already
// encode (a plate is a much bigger, bolder shape than the old thin halo
// ring — equal opacity everywhere would make every place read as equally
// important).

test('labelPlate is theme-OPPOSITE: light-mode plate is dark, dark-mode plate is light', () => {
  const light = labelPlate(false, 0)
  const dark = labelPlate(true, 0)
  assert.match(light, /^rgba\(15,17,20,/, `expected a dark plate in light mode (opposite the light map), got ${light}`)
  assert.match(dark, /^rgba\(255,255,255,/, `expected a light plate in dark mode (opposite the dark map), got ${dark}`)
})

test('labelPlate opacity strictly decreases from tier 0 (most important) to the least', () => {
  const alphaOf = (rgba) => parseFloat(rgba.match(/,([\d.]+)\)$/)[1])
  for (const darkMode of [false, true]) {
    let prev = Infinity
    for (let tier = 0; tier <= 5; tier++) {
      const a = alphaOf(labelPlate(darkMode, tier))
      assert.ok(a < prev, `tier ${tier} alpha ${a} should be < tier ${tier - 1} alpha ${prev} (darkMode=${darkMode})`)
      prev = a
    }
  }
})

test('labelPlate clamps out-of-range tiers instead of returning undefined/NaN', () => {
  const belowRange = labelPlate(false, -3)
  const aboveRange = labelPlate(false, 99)
  assert.equal(belowRange, labelPlate(false, 0))
  assert.equal(aboveRange, labelPlate(false, 5))
})

test('labelPlate runs the OPPOSITE RGB triplet from labelInk halo (contrasts the map, not the theme)', () => {
  // labelInk's halo stays theme-toned (a thin ring lifting a glyph off the
  // map texture directly under it); labelPlate is a big solid shape that
  // must instead oppose the map background, so its base RGB is the OTHER
  // one from the halo's, at each theme.
  const inkHaloLight = labelInk(false, 0).halo
  const plateLight = labelPlate(false, 0)
  assert.notEqual(inkHaloLight.match(/rgba\((\d+,\d+,\d+),/)[1], plateLight.match(/rgba\((\d+,\d+,\d+),/)[1])
  const inkHaloDark = labelInk(true, 0).halo
  const plateDark = labelPlate(true, 0)
  assert.notEqual(inkHaloDark.match(/rgba\((\d+,\d+,\d+),/)[1], plateDark.match(/rgba\((\d+,\d+,\d+),/)[1])
})

test('labelPlateInk is the opposite tone from labelInk at the same theme (readable on the opposed plate)', () => {
  for (const tier of [0, 3, 5]) {
    assert.equal(labelPlateInk(false, tier), labelInk(true, tier).color)
    assert.equal(labelPlateInk(true, tier), labelInk(false, tier).color)
  }
})
