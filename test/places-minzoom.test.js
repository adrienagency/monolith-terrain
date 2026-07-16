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
  assert.equal(popToMinZoom(20_000, false), 10)
  assert.equal(popToMinZoom(5_000, false), 12)
  assert.equal(popToMinZoom(500, false), 13)
})
