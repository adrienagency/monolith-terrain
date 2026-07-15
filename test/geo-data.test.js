import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featureBBox, bboxOverlap, clipToPatch, filterByZoom } from '../src/map/geo-data.js'

const line = (coords, props = {}) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })

test('featureBBox spans a LineString', () => {
  assert.deepEqual(featureBBox(line([[0, 0], [2, 3], [-1, 1]])), [-1, 0, 2, 3])
})

test('bboxOverlap detects overlap and separation', () => {
  const bounds = { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 }
  assert.equal(bboxOverlap([1, 1, 2, 2], bounds), true)
  assert.equal(bboxOverlap([6, 6, 7, 7], bounds), false)
})

test('clipToPatch keeps overlapping features only', () => {
  const inside = line([[1, 1], [2, 2]])
  const outside = line([[10, 10], [11, 11]])
  const kept = clipToPatch([inside, outside], { minLon: 0, maxLon: 5, minLat: 0, maxLat: 5 })
  assert.equal(kept.length, 1)
  assert.equal(kept[0], inside)
})

test('filterByZoom respects min_zoom', () => {
  const a = line([[0, 0]], { min_zoom: 4 })
  const b = line([[0, 0]], { min_zoom: 9 })
  assert.deepEqual(filterByZoom([a, b], 6), [a])
})
