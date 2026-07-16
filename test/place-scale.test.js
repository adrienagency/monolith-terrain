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
  assert.ok(labelScale(0, false) > 0.8 && labelScale(0, false) < 1.0)
  assert.ok(labelScale(undefined, false) > 0.8 && labelScale(undefined, false) < 1.0)
  assert.ok(labelScale(-50, false) === labelScale(0, false), 'negative pop clamps to 0')
})

test('scale is bounded even for huge populations', () => {
  const cap = labelScale(2_000_000_000, true)
  const nonCap = labelScale(2_000_000_000, false)
  assert.ok(nonCap <= 2.3 + 1e-9)
  assert.ok(cap <= 2.3 * 1.25 + 1e-9)
  // saturates well before 2e7, so 2e7 already sits at (near) the ceiling
  assert.ok(Math.abs(labelScale(20_000_000, false) - nonCap) < 1e-6)
})
