import { test } from 'node:test'
import assert from 'node:assert/strict'
import { popToMinZoom } from '../src/map/place-tier.js'

test('capital always reveals at zoom 3 regardless of population', () => {
  assert.equal(popToMinZoom(500, true), 3)
})

test('population bands map to the expected min_zoom', () => {
  assert.equal(popToMinZoom(2_000_000, false), 4)
  assert.equal(popToMinZoom(500_000, false), 6)
  assert.equal(popToMinZoom(80_000, false), 8)
  assert.equal(popToMinZoom(20_000, false), 9)
  assert.equal(popToMinZoom(10_000, false), 10)
  assert.equal(popToMinZoom(5_000, false), 11)
  assert.equal(popToMinZoom(2_000, false), 12)
  assert.equal(popToMinZoom(500, false), 13)
})

// Regression: with cities5000 + a top-40k-by-population truncation, the
// shipped places.json had a population floor of ~11,900 — Annecy (49,232)
// fell under the old >=5e4 band (min_zoom 8) or the old >=1e4 band
// (min_zoom 10) depending on the exact cutoff, both of which hid it well
// past the ~180km view a viewer would expect a city this size to appear
// at. cities1000 plus the rebalanced bands fix this directly.
test('an Annecy-sized medium town (~49k) resolves to a zoom visible at a ~180 km view', () => {
  assert.equal(popToMinZoom(49_232, false), 9)
})

// Regression: cities5000 + the top-40k truncation meant no row in the
// shipped data ever had a population low enough to reach the two deepest
// bands (12, 13) — they were dead code. cities1000 (population > 1000)
// makes them reachable; a 1,000-pop hamlet must only reveal at the
// deepest zoom, once the camera is close.
test('a 1,000-pop village only reveals at the deepest zoom', () => {
  assert.equal(popToMinZoom(1_000, false), 13)
})
