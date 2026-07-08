import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIVE_TIERS, pickDiveTier, stepZoom } from '../src/modes.js'

test('tiers are ordered fine → coarse with strictly rising altitudes', () => {
  assert.equal(DIVE_TIERS[0].zoom, null, 'first tier is the fine (user) zoom')
  for (let i = 1; i < DIVE_TIERS.length; i++) {
    assert.ok(DIVE_TIERS[i].altM > DIVE_TIERS[i - 1].altM)
    assert.ok(DIVE_TIERS[i].zoom < 12, 'coarse tiers use regional zooms')
  }
})

test('pickDiveTier lands each altitude on the matching scale', () => {
  assert.equal(pickDiveTier(6000), DIVE_TIERS[0]) // Everest-class → fine
  assert.equal(pickDiveTier(7999), DIVE_TIERS[0])
  assert.equal(pickDiveTier(8000).zoom, 11) // boundary goes one step coarse
  assert.equal(pickDiveTier(30000).zoom, 10)
  assert.equal(pickDiveTier(70000).zoom, 9)
  assert.equal(pickDiveTier(150000).zoom, 8) // Corsica / Madagascar-sized
  assert.equal(pickDiveTier(199999).zoom, 8)
  assert.equal(pickDiveTier(200000), null) // still orbital territory
  assert.equal(pickDiveTier(16000000), null)
})

test('the surface staircase walks z8 ⇄ z12 two steps at a time', () => {
  // widening (zoom-out against the stop): 12 → 10 → 8, floored at 8
  assert.equal(stepZoom(12, -1), 10)
  assert.equal(stepZoom(10, -1), 8)
  assert.equal(stepZoom(9, -1), 8)
  assert.equal(stepZoom(8, -1), 8)
  // refining (zoom-in against the stop): 8 → 10 → 12, capped at fine
  assert.equal(stepZoom(8, 1), 10)
  assert.equal(stepZoom(10, 1), 12)
  assert.equal(stepZoom(11, 1), 12)
  assert.equal(stepZoom(12, 1, 14), 14) // user picked a finer detail zoom
})

test('the staircase climbs to a z15 fine cap (deeper zoom)', () => {
  // a user on detail z15 who widened to z8 can refine all the way back
  assert.equal(stepZoom(8, 1, 15), 10)
  assert.equal(stepZoom(10, 1, 15), 12)
  assert.equal(stepZoom(12, 1, 15), 14)
  assert.equal(stepZoom(14, 1, 15), 15) // last step is capped at the fine scale
  assert.equal(stepZoom(15, -1), 13) // and widening steps back down normally
})
