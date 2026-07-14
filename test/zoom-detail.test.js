import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DETAIL_DEFAULTS, detailForZoom } from '../src/zoom-detail.js'

test('coarse continental zooms force fine-detail to zero', () => {
  assert.equal(detailForZoom(6, {}, 0.02), 0)
  assert.equal(detailForZoom(5, {}, 0.02), 0)
  assert.equal(detailForZoom(4, {}, 0.02), 0)
})

test('z7 and finer keep the base detail', () => {
  assert.equal(detailForZoom(7, {}, 0.02), 0.02)
  assert.equal(detailForZoom(12, {}, 0.02), 0.02)
})

test('a user override in the store wins at any zoom', () => {
  assert.equal(detailForZoom(6, { 6: 0.15 }, 0.02), 0.15)
  assert.equal(detailForZoom(12, { 12: 0.3 }, 0.02), 0.3)
})

test('DETAIL_DEFAULTS zeroes the coarse tiers only', () => {
  assert.equal(DETAIL_DEFAULTS[6], 0)
  assert.equal(DETAIL_DEFAULTS[5], 0)
  assert.equal(DETAIL_DEFAULTS[7], undefined)
})
