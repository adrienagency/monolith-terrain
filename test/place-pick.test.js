import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickPlaces } from '../src/map/place-pick.js'

// rows: [name, lat, lon, pop, cap, min_zoom]; toWorld maps lon→x, lat→z here
const toWorld = (lat, lon) => ({ x: lon, z: lat })

test('gates by zoom and picks biggest first, decluttered', () => {
  const rows = [
    ['Big', 0, 0, 900, 1, 2],
    ['Near', 0, 0.5, 800, 0, 2], // within minDist of Big → dropped
    ['Far', 0, 5, 700, 0, 2],
    ['Hidden', 0, 8, 600, 0, 9], // min_zoom 9 > zoom 6 → gated out
  ]
  const picks = pickPlaces(rows, { zoom: 6, toWorld, halfLimit: 100, maxN: 10, minDist: 1 })
  assert.deepEqual(picks.map((p) => p.name), ['Big', 'Far'])
})

test('respects maxN and halfLimit', () => {
  const rows = [['A', 0, 0, 9, 0, 0], ['B', 0, 50, 8, 0, 0], ['C', 0, 999, 7, 0, 0]]
  const picks = pickPlaces(rows, { zoom: 5, toWorld, halfLimit: 100, maxN: 1, minDist: 1 })
  assert.deepEqual(picks.map((p) => p.name), ['A'])
})
