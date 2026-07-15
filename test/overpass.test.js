import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, parseOverpass, bboxKey } from '../src/map/overpass.js'

const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

test('buildQuery: roads uses highway + south,west,north,east bbox', () => {
  const q = buildQuery(bbox, 'roads')
  assert.match(q, /way\["highway"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

test('buildQuery: water uses waterway', () => {
  assert.match(buildQuery(bbox, 'water'), /way\["waterway"\]/)
})

test('parseOverpass keeps ALL vertices, maps tags', () => {
  const json = { elements: [
    { type: 'way', tags: { highway: 'primary', name: 'D1' }, geometry: [ { lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 } ] },
    { type: 'way', tags: { highway: 'residential' }, geometry: [ { lat: 0, lon: 0 } ] }, // <2 pts dropped
    { type: 'node', lat: 9, lon: 9 }, // non-way ignored
  ] }
  const feats = parseOverpass(json, 'roads')
  assert.equal(feats.length, 1)
  assert.deepEqual(feats[0].coords, [ [2, 1], [4, 3], [6, 5] ]) // [lon,lat], all 3 kept
  assert.equal(feats[0].kind, 'primary')
  assert.equal(feats[0].name, 'D1')
})

test('bboxKey rounds to 3 decimals', () => {
  assert.equal(bboxKey({ minLat: 45.80001, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }, 'roads'), 'roads:45.8,6.1,45.95,6.3')
})
