import { test } from 'node:test'
import assert from 'node:assert/strict'
import { labelScale } from '../src/map/place-scale.js'

test('bigger population gives a strictly bigger scale', () => {
  const small = labelScale(500, false)
  const mid = labelScale(50_000, false)
  const big = labelScale(2_000_000, false)
  assert.ok(small < mid, `${small} < ${mid}`)
  assert.ok(mid < big, `${mid} < ${big}`)
})

test('a capital outscales a non-capital at the same population', () => {
  const pop = 100_000
  assert.ok(labelScale(pop, true) > labelScale(pop, false))
})

test('zero / missing population still yields a legible floor scale', () => {
  // The floor must be the SMALLEST tier and still readable — not a specific
  // magic number. (This used to assert 0.8..1.0, which only described the old
  // log curve's value for pop 0 rather than any property worth keeping.)
  const floor = labelScale(0, false)
  assert.equal(floor, labelScale(undefined, false))
  assert.equal(floor, labelScale(null, false))
  assert.equal(labelScale(-50, false), floor, 'negative pop clamps to 0')
  assert.ok(floor < labelScale(1e4, false), 'a village must read under a town')
  assert.ok(floor > 1.0, `floor ${floor} must stay legible`)
})

test('scale is bounded even for huge populations', () => {
  const nonCap = labelScale(2_000_000_000, false)
  assert.ok(nonCap <= 3.0, `${nonCap} must stay bounded`)
  assert.equal(labelScale(20_000_000, false), nonCap, 'top tier saturates')
  assert.ok(labelScale(2e9, true) <= 3.4, 'capital nudge stays bounded too')
})

test('scale never inverts: a bigger city always reads at least as big', () => {
  // Regression guard. The old curve clamped population at 10M but applied the
  // capital bonus AFTER the clamp, so Shanghai (24.9M, non-capital, 2.300)
  // rendered SMALLER than Paris (2.1M, capital, 2.684). Population alone picks
  // the tier now, and the capital nudge is too small to leapfrog one.
  assert.ok(labelScale(24_874_500, false) > labelScale(2_148_000, true), 'Shanghai > Paris')
  const pops = [0, 1e3, 1e4, 3e4, 2e5, 1e6, 5e6, 5e7]
  for (let i = 1; i < pops.length; i++) {
    assert.ok(labelScale(pops[i], false) >= labelScale(pops[i - 1], false), `${pops[i]} >= ${pops[i - 1]}`)
  }
})

test('the tiers actually rank: the spread is wide enough to read as a hierarchy', () => {
  // The old log curve squeezed four orders of magnitude into 1.94x, so a 12k
  // town sat within 46% of a regional capital — names sprinkled, they did not
  // rank. Discrete tiers must keep a visibly wider spread than that.
  const spread = labelScale(2e7, false) / labelScale(500, false)
  assert.ok(spread > 2.2, `village->megacity spread ${spread.toFixed(2)}x is too flat to rank`)
  const townVsCity = labelScale(2e5, true) / labelScale(12_000, false)
  assert.ok(townVsCity > 1.6, `town vs regional capital ${townVsCity.toFixed(2)}x is too flat`)
})
