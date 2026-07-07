import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  latLonToTile,
  tileToLatLon,
  latLonToWorld,
  worldToLatLon,
  latLonToSphere,
  sphereToLatLon,
  parseLatLon,
} from '../src/geo.js'

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`)

test('tile round-trip at known anchors', () => {
  for (const [lat, lon] of [
    [0, 0],
    [27.9881, 86.925], // Everest
    [45.8326, 6.8652], // Mont Blanc
    [84.9, -179.9],
    [-84.9, 179.9],
  ]) {
    const t = latLonToTile(lat, lon, 12)
    const back = tileToLatLon(t.x, t.y, 12)
    close(back.lat, lat, 1e-9)
    close(back.lon, lon, 1e-9)
  }
})

test('equator zoom0 midpoint is tile center', () => {
  const t = latLonToTile(0, 0, 0)
  close(t.x, 0.5)
  close(t.y, 0.5)
})

test('world round-trip on a synthetic dem', () => {
  const t = latLonToTile(45.9766, 7.6585, 12) // Matterhorn
  const dem = {
    zoom: 12,
    size: 768,
    originTileX: Math.floor(t.x) - 1,
    originTileY: Math.floor(t.y) - 1,
  }
  const w = latLonToWorld(dem, 45.9766, 7.6585)
  assert.ok(Math.abs(w.x) < 28 && Math.abs(w.z) < 28, 'inside patch')
  const back = worldToLatLon(dem, w.x, w.z)
  close(back.lat, 45.9766, 1e-9)
  close(back.lon, 7.6585, 1e-9)
})

test('sphere round-trip', () => {
  for (const [lat, lon] of [
    [0, 0],
    [45, 90],
    [-33.9, 18.4],
    [84, -179],
  ]) {
    const v = latLonToSphere(lat, lon)
    const back = sphereToLatLon(v)
    close(back.lat, lat, 1e-9)
    close(back.lon, lon, 1e-9)
    close(v.length(), 100, 1e-9)
  }
})

test('world round-trip on a dem straddling the antimeridian', () => {
  // patch centered at lon 179.99 (z12): its tile window crosses x = n
  const t = latLonToTile(52.0, 179.99, 12)
  const dem = {
    zoom: 12,
    size: 768,
    originTileX: Math.floor(t.x) - 1,
    originTileY: Math.floor(t.y) - 1,
  }
  // a point just across the seam, at lon -179.98, must land INSIDE the patch
  const w = latLonToWorld(dem, 52.001, -179.98)
  assert.ok(Math.abs(w.x) < 28 && Math.abs(w.z) < 28, `inside patch, got x=${w.x}`)
  const back = worldToLatLon(dem, w.x, w.z)
  close(back.lat, 52.001, 1e-9)
  close(back.lon, -179.98, 1e-9)
})

test('parseLatLon accepts DMS pastes (Wikipedia / GPS)', () => {
  const a = parseLatLon(`45°49'57"N 6°51'52"E`)
  close(a.lat, 45 + 49 / 60 + 57 / 3600, 1e-9)
  close(a.lon, 6 + 51 / 60 + 52 / 3600, 1e-9)
  const b = parseLatLon('33°55′12″S, 18°25′26.5″E') // unicode primes + decimal seconds
  close(b.lat, -(33 + 55 / 60 + 12 / 3600), 1e-9)
  close(b.lon, 18 + 25 / 60 + 26.5 / 3600, 1e-9)
  const c = parseLatLon(`45°49'N 6°51'W`) // no seconds
  close(c.lat, 45 + 49 / 60, 1e-9)
  close(c.lon, -(6 + 51 / 60), 1e-9)
  assert.equal(parseLatLon(`91°00'00"N 6°51'52"E`), null)
})

test('parseLatLon accepts common paste formats', () => {
  assert.deepEqual(parseLatLon('45.8326, 6.8652'), { lat: 45.8326, lon: 6.8652 })
  assert.deepEqual(parseLatLon('  45.8326   6.8652 '), { lat: 45.8326, lon: 6.8652 })
  assert.deepEqual(parseLatLon('45.83°N, 6.86°E'), { lat: 45.83, lon: 6.86 })
  assert.deepEqual(parseLatLon('33.9°S; 18.4°W'), { lat: -33.9, lon: -18.4 })
  assert.equal(parseLatLon('hello'), null)
  assert.equal(parseLatLon('99, 6'), null)
  assert.equal(parseLatLon(''), null)
})
