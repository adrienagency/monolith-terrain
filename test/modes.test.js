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
  // continental blocks now load from 4 000 km down (was orbital-only)
  assert.equal(pickDiveTier(300000).zoom, 7)
  assert.equal(pickDiveTier(1000000).zoom, 6)
  assert.equal(pickDiveTier(3000000).zoom, 5) // ~z5 block, ~3 760 km across
  assert.equal(pickDiveTier(5000000).zoom, 4) // ~z4 continental block, ~7 500 km
  assert.equal(pickDiveTier(9000000), null) // above z4 -> orbit gate (globe)
  assert.equal(pickDiveTier(3999999).zoom, 5)
  assert.equal(pickDiveTier(4000000).zoom, 4) // z5 boundary rolls into the z4 continental block
  assert.equal(pickDiveTier(16000000), null) // globe territory above the z4 block
})

test('the surface staircase widens through z5 to the z4 continental block', () => {
  assert.equal(stepZoom(12, -1), 10)
  assert.equal(stepZoom(10, -1), 8)
  assert.equal(stepZoom(8, -1), 6)
  assert.equal(stepZoom(6, -1), 5)
  assert.equal(stepZoom(5, -1), 4) // z5 -> z4 (one final step to the continental block)
  assert.equal(stepZoom(4, -1), 4) // continental floor
  // refining (zoom-in against the stop) unchanged: 2 steps at a time
  assert.equal(stepZoom(5, 1), 7)
  assert.equal(stepZoom(8, 1), 10)
  assert.equal(stepZoom(10, 1), 12)
})

test('the staircase climbs to a z15 fine cap (deeper zoom)', () => {
  // a user on detail z15 who widened to z8 can refine all the way back
  assert.equal(stepZoom(8, 1, 15), 10)
  assert.equal(stepZoom(10, 1, 15), 12)
  assert.equal(stepZoom(12, 1, 15), 14)
  assert.equal(stepZoom(14, 1, 15), 15) // last step is capped at the fine scale
  assert.equal(stepZoom(15, -1), 13) // and widening steps back down normally
})
