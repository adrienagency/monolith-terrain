import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WATER_REGION, REGION, LOD_LEVELS, ROAD_LOD_LEVELS, lodForZoom, tileZoomForLod, tilesForBBox, inRegion } from '../src/map/tile-index.js'

test('lodForZoom: far/mid/close bands match the demZoomMax boundaries', () => {
  assert.equal(lodForZoom(1), 0)
  assert.equal(lodForZoom(8), 0) // boundary — still LOD0
  assert.equal(lodForZoom(9), 1) // just past the boundary — LOD1
  assert.equal(lodForZoom(11), 1) // boundary — still LOD1
  assert.equal(lodForZoom(12), 2) // just past — LOD2
  assert.equal(lodForZoom(20), 2) // arbitrarily close — still LOD2
})

test('tileZoomForLod maps each LOD to its slippy tile zoom', () => {
  assert.equal(tileZoomForLod(0), 8)
  assert.equal(tileZoomForLod(1), 9)
  assert.equal(tileZoomForLod(2), 11)
})

test('tileZoomForLod and lodForZoom agree with LOD_LEVELS for every entry', () => {
  for (const l of LOD_LEVELS) assert.equal(tileZoomForLod(l.lod), l.tileZoom)
})

test('tilesForBBox: a bbox straddling a tile boundary returns tiles on both sides', () => {
  // z1: tile x=0 covers lon [-180,0), tile x=1 covers [0,180). A bbox
  // spanning -10..10 straddles that boundary and must return both.
  const tiles = tilesForBBox({ minLon: -10, maxLon: 10, minLat: 10, maxLat: 20 }, 1)
  const xs = new Set(tiles.map((t) => t.x))
  assert.ok(xs.has(0) && xs.has(1), `expected tiles on both sides of the x boundary, got ${JSON.stringify(tiles)}`)
})

test('tilesForBBox: a bbox smaller than one tile returns exactly one tile', () => {
  // z2: tile x=2 covers lon [0,90); a 10..20 bbox sits fully inside it, and
  // 10..20 lat sits fully inside tile y=1 (which spans roughly lat 66.5..0).
  const tiles = tilesForBBox({ minLon: 10, maxLon: 20, minLat: 10, maxLat: 20 }, 2)
  assert.equal(tiles.length, 1)
  assert.deepEqual(tiles[0], { z: 2, x: 2, y: 1 })
})

test('tilesForBBox: antimeridian-straddling bbox splits into two spans without throwing', () => {
  // minLon > maxLon signals a bbox that wraps through +/-180.
  const tiles = tilesForBBox({ minLon: 179, maxLon: -179, minLat: -5, maxLat: 5 }, 4)
  assert.ok(tiles.length > 0)
  const xs = new Set(tiles.map((t) => t.x))
  const n = 2 ** 4
  assert.ok(xs.has(n - 1), 'should include the tile touching +180')
  assert.ok(xs.has(0), 'should include the tile touching -180')
})

test('tilesForBBox: poles do not throw or produce NaN tiles', () => {
  const tiles = tilesForBBox({ minLon: 0, maxLon: 10, minLat: 80, maxLat: 89.9 }, 3)
  assert.ok(tiles.length > 0)
  for (const t of tiles) {
    assert.ok(Number.isInteger(t.x) && Number.isInteger(t.y), `non-integer tile coords: ${JSON.stringify(t)}`)
  }
})

test('inRegion: a patch overlapping the water region is in-region', () => {
  assert.equal(inRegion({ minLon: 6.0, maxLon: 6.5, minLat: 45.7, maxLat: 46.0 }, WATER_REGION), true)
})

test('inRegion: a patch far outside the water region is not in-region', () => {
  assert.equal(inRegion({ minLon: -74.1, maxLon: -73.9, minLat: 40.6, maxLat: 40.8 }, WATER_REGION), false) // NYC
})

test('inRegion: a patch just touching the region edge counts as overlapping', () => {
  assert.equal(inRegion({ minLon: 4.5, maxLon: 5.0, minLat: 45.0, maxLat: 45.5 }, WATER_REGION), true)
})

// --- REGION alias / per-layer LOD tables (task 18: tiled Overture roads) ---

test('REGION is the exact same object as WATER_REGION — one region, one source of truth', () => {
  assert.equal(REGION, WATER_REGION)
})

test('lodForZoom/tileZoomForLod: default `levels` param keeps every existing (water) call site unaffected', () => {
  assert.equal(lodForZoom(8), 0)
  assert.equal(lodForZoom(12), 2)
  assert.equal(tileZoomForLod(0), 8)
  assert.equal(tileZoomForLod(2), 11)
})

test('lodForZoom/tileZoomForLod: an explicit `levels` table (ROAD_LOD_LEVELS) is honored instead of the default', () => {
  assert.equal(lodForZoom(8, ROAD_LOD_LEVELS), 0)
  assert.equal(lodForZoom(9, ROAD_LOD_LEVELS), 1) // just past LOD0's boundary
  assert.equal(lodForZoom(11, ROAD_LOD_LEVELS), 1) // boundary — still LOD1
  assert.equal(lodForZoom(12, ROAD_LOD_LEVELS), 2) // just past — LOD2
  assert.equal(tileZoomForLod(0, ROAD_LOD_LEVELS), 8)
  assert.equal(tileZoomForLod(1, ROAD_LOD_LEVELS), 11)
  assert.equal(tileZoomForLod(2, ROAD_LOD_LEVELS), 14)
})

test('ROAD_LOD_LEVELS and LOD_LEVELS share the same demZoom band SCHEME (far<=8, mid 9-11, close>=12), only tileZoom differs', () => {
  assert.deepEqual(LOD_LEVELS.map((l) => l.demZoomMax), ROAD_LOD_LEVELS.map((l) => l.demZoomMax))
  // road tiles need finer (higher) zooms than water at every LOD — denser data, smaller tiles
  for (let i = 0; i < LOD_LEVELS.length; i++) {
    assert.ok(ROAD_LOD_LEVELS[i].tileZoom >= LOD_LEVELS[i].tileZoom, `LOD${i}: road tileZoom should be >= water's`)
  }
})
