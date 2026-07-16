import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, parseOverpass, bboxKey, roadHighwayFilter, buildAreaQuery, parseOverpassAreas } from '../src/map/overpass.js'

const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

test('buildQuery: roads uses highway + south,west,north,east bbox', () => {
  const q = buildQuery(bbox, 'roads', 3)
  assert.match(q, /way\["highway"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

test('roadHighwayFilter: 1 and 2 share the same generous drivable filter, 3 is unrestricted', () => {
  // detail 1 and 2 must fetch the SAME broad set — relative tiering (road-tier.js)
  // decides client-side which classes actually render at each notch, so an
  // absolute server-side filter (the old bug) would starve it of data.
  assert.equal(roadHighwayFilter(1), roadHighwayFilter(2))
  assert.match(roadHighwayFilter(1), /motorway\|trunk\|primary/)
  assert.match(roadHighwayFilter(1), /residential/)
  assert.equal(/footway|path/.test(roadHighwayFilter(1)), false)
  assert.equal(roadHighwayFilter(3), '["highway"]') // all
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

test('bboxKey: roads cache key derives from the filter variant, so detail 1/2 (same filter) collide and detail 3 (different filter) does not', () => {
  const keyFor = (detail) => bboxKey(bbox, 'roads', roadHighwayFilter(detail))
  assert.equal(keyFor(1), keyFor(2))
  assert.notEqual(keyFor(1), keyFor(3))
})

test('buildAreaQuery: well-formed water-area query with south,west,north,east bbox', () => {
  const q = buildAreaQuery(bbox)
  assert.match(q, /way\["natural"="water"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /way\["waterway"="riverbank"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /relation\["natural"="water"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

test('parseOverpassAreas: closed way -> one ring', () => {
  const json = { elements: [
    { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 }, { lat: 0, lon: 0 } ] },
  ] }
  const areas = parseOverpassAreas(json)
  assert.equal(areas.length, 1)
  assert.deepEqual(areas[0].ring, [ [0, 0], [1, 0], [1, 1], [0, 1], [0, 0] ])
})

test('parseOverpassAreas: relation contributes one ring per outer member', () => {
  const json = { elements: [
    { type: 'relation', members: [
      { role: 'outer', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 } ] },
      { role: 'outer', geometry: [ { lat: 10, lon: 10 }, { lat: 10, lon: 11 }, { lat: 11, lon: 11 }, { lat: 11, lon: 10 } ] },
      { role: 'inner', geometry: [ { lat: 5, lon: 5 }, { lat: 5, lon: 6 }, { lat: 6, lon: 6 }, { lat: 6, lon: 5 } ] },
    ] },
  ] }
  const areas = parseOverpassAreas(json)
  assert.equal(areas.length, 2)
})

test('parseOverpassAreas: skips a 3-point or open way', () => {
  const openWay = { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0.5 } ] }
  const shortWay = { type: 'way', geometry: [ { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 } ] }
  assert.equal(parseOverpassAreas({ elements: [ openWay ] }).length, 0)
  assert.equal(parseOverpassAreas({ elements: [ shortWay ] }).length, 0)
})
