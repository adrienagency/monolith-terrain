import { test } from 'node:test'
import assert from 'node:assert/strict'
import { discOpacityFor } from '../src/sun-disc.js'
import { lakeGradient } from '../src/map/lake-material.js'

// --- the sun disc at the horizon ---------------------------------------------

test('discOpacityFor: nothing renders below ground level', () => {
  // "on ne le voit plus sous le niveau du sol" — not dim, GONE.
  assert.equal(discOpacityFor(0), 0)
  assert.equal(discOpacityFor(-0.5), 0)
  assert.equal(discOpacityFor(-30), 0)
})

test('discOpacityFor: it drowns INTO the horizon rather than winking out', () => {
  // A hard on/off at the horizon is the bug this ramp exists to avoid.
  const low = discOpacityFor(1)
  assert.ok(low > 0 && low < 0.2, `just above the horizon should be faint, got ${low}`)
  assert.ok(discOpacityFor(4) > low, 'it must keep brightening as it climbs')
})

test('discOpacityFor: full strength once properly up, and never over 1', () => {
  assert.equal(discOpacityFor(8), 1)
  assert.equal(discOpacityFor(67), 1, 'a summer noon must not overshoot')
})

test('discOpacityFor: monotonic — no flicker while the slider is dragged', () => {
  let prev = -1
  for (let e = -5; e <= 90; e += 0.25) {
    const o = discOpacityFor(e)
    assert.ok(o >= prev - 1e-9, `opacity dropped at ${e}°`)
    prev = o
  }
})

test('discOpacityFor: garbage in does not become a visible sun', () => {
  assert.equal(discOpacityFor(NaN), 0)
  assert.equal(discOpacityFor(undefined), 0)
})

// --- the lake gradient --------------------------------------------------------

test('lakeGradient: deep is darker than the ink, shallow is lighter', () => {
  const g = lakeGradient('#0f6fd6')
  const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16)
  assert.ok(lum(g.deep) < lum('#0f6fd6'), `deep ${g.deep} should sit below the ink`)
  assert.ok(lum(g.shallow) > lum('#0f6fd6'), `shallow ${g.shallow} should sit above it`)
})

test('lakeGradient: it is a TONAL spread, not a hue change', () => {
  // The two ends must stay the same colour of water — a gradient that drifts
  // in hue stops reading as one body and starts reading as two puddles.
  const g = lakeGradient('#0f6fd6')
  const dominant = (h) => {
    const [r, gg, b] = [h.slice(1, 3), h.slice(3, 5), h.slice(5, 7)].map((x) => parseInt(x, 16))
    return b > r && b > gg
  }
  assert.ok(dominant(g.deep) && dominant(g.shallow), 'both ends must stay blue-dominant')
})

test('lakeGradient: a bright ink cannot push a channel past white', () => {
  const g = lakeGradient('#63d1ff') // the dark-mode lake ink, already light
  assert.match(g.shallow, /^#[0-9a-f]{6}$/)
  for (const c of [g.shallow.slice(1, 3), g.shallow.slice(3, 5), g.shallow.slice(5, 7)]) {
    assert.ok(parseInt(c, 16) <= 255)
  }
})

test('lakeGradient: derives from whatever ink it is given', () => {
  assert.notDeepEqual(lakeGradient('#0f6fd6'), lakeGradient('#63d1ff'))
})
