import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIVE_TIERS, pickDiveTier } from '../src/modes.js'

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
  assert.equal(pickDiveTier(8000), DIVE_TIERS[1]) // boundary goes coarse
  assert.equal(pickDiveTier(20000), DIVE_TIERS[1]) // z10 regional
  assert.equal(pickDiveTier(100000), DIVE_TIERS[2]) // Madagascar-sized → z8
  assert.equal(pickDiveTier(179999), DIVE_TIERS[2])
  assert.equal(pickDiveTier(180000), null) // still orbital territory
  assert.equal(pickDiveTier(16000000), null)
})
