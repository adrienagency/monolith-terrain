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
  demSpan,
  surfaceMetersPerUnit,
} from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

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

// Mapterhorn sert des tuiles de 512 px : un DEM de 3 tuiles fait 1536 px pour
// la MÊME emprise au sol. Le géoréférencement doit être identique au pixel de
// tuile près — sinon les tracés GPX, les sommets et le damier de blocs voisins
// se décalent (la couture visible entre blocs).
test('world round-trip sur un DEM en tuiles 512 px', () => {
  const t = latLonToTile(45.9766, 7.6585, 12)
  const dem = {
    zoom: 12,
    size: 1536,
    tilePx: 512,
    originTileX: Math.floor(t.x) - 1,
    originTileY: Math.floor(t.y) - 1,
  }
  const w = latLonToWorld(dem, 45.9766, 7.6585)
  assert.ok(Math.abs(w.x) < 28 && Math.abs(w.z) < 28, 'inside patch')
  const back = worldToLatLon(dem, w.x, w.z)
  close(back.lat, 45.9766, 1e-9)
  close(back.lon, 7.6585, 1e-9)
})

test('256 px et 512 px placent un même point au MÊME endroit du monde', () => {
  const t = latLonToTile(45.9766, 7.6585, 12)
  const base = { zoom: 12, originTileX: Math.floor(t.x) - 1, originTileY: Math.floor(t.y) - 1 }
  for (const [lat, lon] of [[45.99, 7.62], [45.95, 7.70], [46.01, 7.68]]) {
    const a = latLonToWorld({ ...base, size: 768 }, lat, lon) // AWS, 3×256
    const b = latLonToWorld({ ...base, size: 1536, tilePx: 512 }, lat, lon) // Mapterhorn, 3×512
    close(a.x, b.x, 1e-9)
    close(a.z, b.z, 1e-9)
  }
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

// ── L'EMPRISE 3×3 : LE CHAMP FAIT 168 UNITÉS, PAS 56 ─────────────────────────
//
// ⚠️ LE DÉFAUT QUE CES TESTS VERROUILLENT. `latLonToWorld` et `worldToLatLon`
// écrivaient `TERRAIN_SIZE` en dur. Sur une emprise 3×3 — un champ trois fois
// plus large qui couvre trois fois plus de sol — cela écrasait les neuf blocs
// dans la largeur d'un seul : chaque lieu se retrouvait à un TIERS de sa
// distance au centre. Ça ne se lit pas comme un décalage, ça se lit comme des
// données fausses.

test('demSpan : un bloc ordinaire fait 56 unités, une emprise 3×3 en fait 168', () => {
  assert.equal(demSpan({ }), TERRAIN_SIZE)
  assert.equal(demSpan({ empriseCote: 1 }), TERRAIN_SIZE)
  assert.equal(demSpan({ empriseCote: 3 }), TERRAIN_SIZE * 3)
  assert.equal(demSpan(null), TERRAIN_SIZE)
})

test('sur une emprise 3×3, un point est à sa VRAIE distance du centre', () => {
  // Même sol, deux descriptions : un bloc 1536² et l'emprise 4608² qui le
  // contient au centre. Le même point du monde doit sortir à la MÊME distance
  // en unités — c'est ce qui garantit qu'un lieu ne glisse pas vers le milieu.
  const bloc = { zoom: 12, originTileX: 2100, originTileY: 1450, size: 1536, tilePx: 512 }
  const emprise = { zoom: 12, originTileX: 2097, originTileY: 1447, size: 4608, tilePx: 512, empriseCote: 3 }
  const { lat, lon } = tileToLatLon(2100.7, 1450.4, 12)
  const a = latLonToWorld(bloc, lat, lon)
  const b = latLonToWorld(emprise, lat, lon)
  assert.ok(Math.abs(a.x - b.x) < 1e-9, `x : ${a.x} contre ${b.x}`)
  assert.ok(Math.abs(a.z - b.z) < 1e-9, `z : ${a.z} contre ${b.z}`)
})

test('la conversion aller-retour tient sur une emprise 3×3', () => {
  const emprise = { zoom: 12, originTileX: 2097, originTileY: 1447, size: 4608, tilePx: 512, empriseCote: 3 }
  // un point loin du centre : c'est là que le facteur 3 se voyait
  for (const [x, z] of [[0, 0], [70, -60], [-80, 80]]) {
    const ll = worldToLatLon(emprise, x, z)
    const w = latLonToWorld(emprise, ll.lat, ll.lon)
    assert.ok(Math.abs(w.x - x) < 1e-6, `x ${x} → ${w.x}`)
    assert.ok(Math.abs(w.z - z) < 1e-6, `z ${z} → ${w.z}`)
  }
})

test('les mètres par unité ne changent PAS sur une emprise', () => {
  // Un champ trois fois plus large couvre trois fois plus de sol : l'échelle est
  // la même. Divisé par 56, `extentMeters` triplé rendrait trois fois trop de
  // mètres par unité — distances, échelles de carte et largeurs de rivière
  // toutes fausses d'un facteur 3, sans que rien ne paraisse cassé.
  const bloc = { extentMeters: 30000 }
  const emprise = { extentMeters: 90000, empriseCote: 3 }
  assert.equal(surfaceMetersPerUnit(emprise), surfaceMetersPerUnit(bloc))
})
