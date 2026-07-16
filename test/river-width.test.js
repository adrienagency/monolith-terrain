import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riverWidthPx, SW_MIN, SW_MAX } from '../src/map/river-width.js'

// The shipped ne_10m_rivers strokeweights measure 0.1 → 2.0 (median 0.2), so the
// mapping is tuned to that real range, not the nominal 0-9 of NE's docs.

test('riverWidthPx: the smallest rill gets the floor width', () => {
  assert.equal(riverWidthPx(SW_MIN), 0.9)
})

test('riverWidthPx: the biggest trunk river gets the ceiling width', () => {
  assert.equal(riverWidthPx(SW_MAX), 3.5)
})

test('riverWidthPx: strictly increases with strokeweight', () => {
  const ws = [0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1, 1.5, 2].map(riverWidthPx)
  for (let i = 1; i < ws.length; i++) assert.ok(ws[i] > ws[i - 1], `${ws[i]} > ${ws[i - 1]}`)
})

test('riverWidthPx: the dense low end is spread, not flattened to the floor', () => {
  // median (0.2) must sit clearly above the floor, else ~95% of rivers look identical
  assert.ok(riverWidthPx(0.2) > 1.3, `median width ${riverWidthPx(0.2)} should exceed 1.3`)
  // and a trunk river must be visibly wider than the median
  assert.ok(riverWidthPx(1) - riverWidthPx(0.2) > 1, 'trunk vs median gap too small')
})

test('riverWidthPx: missing strokeweight falls back to the median weight', () => {
  assert.equal(riverWidthPx(undefined), riverWidthPx(0.2))
  assert.equal(riverWidthPx(null), riverWidthPx(0.2))
})

test('riverWidthPx: clamps out-of-range values', () => {
  assert.equal(riverWidthPx(-5), 0.9)
  assert.equal(riverWidthPx(20), 3.5)
})
