import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuery, parseOverpass, bboxKey, WAY_TAG, buildAreaQuery, parseOverpassAreas, assertSaneSize, OVERPASS_MAXSIZE } from '../src/map/overpass.js'

const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

test('buildQuery: water uses waterway + south,west,north,east bbox', () => {
  const q = buildQuery(bbox, 'water')
  assert.match(q, /way\["waterway"\]\(45\.8,6\.1,45\.95,6\.3\);/)
  assert.match(q, /out geom;/)
})

// ---- le calque ROUTES a quitté le site -------------------------------------
// Il était le seul autre client de ce module. Sa disparition emporte
// `roadHighwayFilter()` et le cran de « détail » qui lui servait de variante de
// cache. Ce qui RESTE vrai, et qui vaut désormais pour l'eau : jamais de
// prédicat regex (mesuré sur les routes : 6,5 s et un 504, contre 927 ms pour
// le test de tag nu).

test('plus aucun `kind` routier dans ce module', () => {
  assert.equal(WAY_TAG.roads, undefined)
  assert.deepEqual(Object.keys(WAY_TAG), ['water'])
})

test('la requête reste un test de TAG NU — un prédicat regex 504 sur Overpass', () => {
  const q = buildQuery(bbox, 'water')
  assert.equal(/~/.test(q), false, 'aucun prédicat regex dans la requête')
  assert.match(q, /way\["waterway"\]/)
})

test('parseOverpass keeps ALL vertices, maps tags', () => {
  const json = { elements: [
    { type: 'way', tags: { waterway: 'river', name: 'L’Arve' }, geometry: [ { lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 } ] },
    { type: 'way', tags: { waterway: 'stream' }, geometry: [ { lat: 0, lon: 0 } ] }, // <2 pts dropped
    { type: 'node', lat: 9, lon: 9 }, // non-way ignored
  ] }
  const feats = parseOverpass(json, 'water')
  assert.equal(feats.length, 1)
  assert.deepEqual(feats[0].coords, [ [2, 1], [4, 3], [6, 5] ]) // [lon,lat], all 3 kept
  assert.equal(feats[0].kind, 'river')
  assert.equal(feats[0].name, 'L’Arve')
})

test('bboxKey rounds to 3 decimals', () => {
  assert.equal(bboxKey({ minLat: 45.80001, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }, 'water'), 'water:45.8,6.1,45.95,6.3')
})

test('bboxKey : une entrée de cache par zone+kind, sans troisième argument', () => {
  // La « variante » n'existait que pour distinguer les crans de détail des
  // routes. Un appel qui en traîne encore un ne doit pas fabriquer une clé
  // différente — sinon un même patch se refetcherait pour rien.
  assert.equal(bboxKey(bbox, 'water', 'residu'), bboxKey(bbox, 'water'))
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

// --- payload guard -----------------------------------------------------------
// Regression guard for a measured hang risk: a z12 (24km) bbox over central
// Paris returned 351,414 ways / 238 MB with a 200 OK. Because it SUCCEEDS, the
// "null → Natural Earth" fallback never fires and the tab tries to parse 238 MB.

test('buildQuery: every query carries the maxsize memory ceiling', () => {
  // Plain substring, deliberately not a RegExp: `\[` inside a template literal
  // collapses to `[`, which builds a character CLASS — that assertion matches
  // almost any string and silently tests nothing.
  const needle = `[maxsize:${OVERPASS_MAXSIZE}]`
  for (const kind of Object.keys(WAY_TAG)) {
    assert.ok(buildQuery(bbox, kind).includes(needle), `${kind} query missing ${needle}`)
  }
  assert.ok(buildAreaQuery(bbox).includes(needle), `area query missing ${needle}`)
})

test('assertSaneSize: rejects an oversized body before it is parsed', () => {
  const res = (len) => ({ headers: { get: () => len } })
  assert.throws(() => assertSaneSize(res(String(OVERPASS_MAXSIZE + 1))), /overpass payload/)
  // the real measured Paris case
  assert.throws(() => assertSaneSize(res(String(238 * 1024 * 1024))), /overpass payload/)
})

test('assertSaneSize: lets sane and unmeasurable bodies through', () => {
  const res = (len) => ({ headers: { get: () => len } })
  assert.doesNotThrow(() => assertSaneSize(res(String(15 * 1024 * 1024)))) // Chamonix z12, measured sane
  assert.doesNotThrow(() => assertSaneSize(res(null))) // chunked: no Content-Length → maxsize is the guard
})
