import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelInk, labelPlate } from '../src/map/text-label.js'

// ---- task 27 §2: background plate/cartouche ---------------------------
// "si il faut mettre un cartouche derrière le texte, on le fait" — the plate
// must stay theme-aware (same tone family as the halo it replaces) AND rank
// by tier so it can never flatten the importance ordering labelScale/
// labelInk already encode (a plate is a much bigger, bolder shape than the
// old thin halo ring — equal opacity everywhere would make every place read
// as equally important).

test('labelPlate is theme-aware: light-mode plate is light, dark-mode plate is dark', () => {
  const light = labelPlate(false, 0)
  const dark = labelPlate(true, 0)
  assert.match(light, /^rgba\(255,255,255,/, `expected a light plate in light mode, got ${light}`)
  assert.match(dark, /^rgba\(15,17,20,/, `expected a dark plate in dark mode, got ${dark}`)
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

test('labelPlate stays the same opaque tone family as labelInk halo (same contrast pairing)', () => {
  // labelInk's halo is a fixed opacity per theme; labelPlate is the same
  // base RGB, just tier-ranked and usually more opaque (a real background,
  // not a thin ring) — pin the shared RGB triplet so the two can't drift
  // into mismatched tones
  const inkHaloLight = labelInk(false, 0).halo
  const plateLight = labelPlate(false, 0)
  assert.equal(inkHaloLight.match(/rgba\((\d+,\d+,\d+),/)[1], plateLight.match(/rgba\((\d+,\d+,\d+),/)[1])
  const inkHaloDark = labelInk(true, 0).halo
  const plateDark = labelPlate(true, 0)
  assert.equal(inkHaloDark.match(/rgba\((\d+,\d+,\d+),/)[1], plateDark.match(/rgba\((\d+,\d+,\d+),/)[1])
})
