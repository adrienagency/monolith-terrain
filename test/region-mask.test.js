import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterFarParts, levelForDemZoom, FAR_PART_MAX_DIST, LEVEL_TABLE } from '../src/region-mask.js'
import { latLonToTile } from '../src/geo.js'

// synthetic DEM patch centered on lat/lon, mirroring dem.js georeferencing
// (3×3 tile window, center tile in the middle)
function makeDem(lat, lon, zoom) {
  const t = latLonToTile(lat, lon, zoom)
  return {
    zoom,
    size: 768,
    originTileX: Math.floor(t.x) - 1,
    originTileY: Math.floor(t.y) - 1,
    lat,
    lon,
  }
}

// small square polygon part centered at lon/lat (GeoJSON ring, closed)
const square = (lon, lat, d = 0.5) => [
  [
    [lon - d, lat - d],
    [lon + d, lat - d],
    [lon + d, lat + d],
    [lon - d, lat + d],
    [lon - d, lat - d],
  ],
]

test('zoom → admin level table', () => {
  assert.equal(levelForDemZoom(4), null) // whole earth: no clip
  assert.equal(levelForDemZoom(5).level, 'continent')
  assert.equal(levelForDemZoom(6).level, 'country')
  assert.equal(levelForDemZoom(7).level, 'country')
  assert.equal(levelForDemZoom(8).level, 'region')
  assert.equal(levelForDemZoom(9).level, 'region')
  assert.equal(levelForDemZoom(10).level, 'departement')
  assert.equal(levelForDemZoom(15).level, 'departement')
  // table stays sorted coarse→fine so the first match wins
  for (let i = 1; i < LEVEL_TABLE.length; i++) {
    assert.ok(LEVEL_TABLE[i].minDemZoom < LEVEL_TABLE[i - 1].minDemZoom)
  }
})

test('mainland and nearby island are kept, DOM-TOM dropped', () => {
  // z6 patch over France: extent ≈ 1900 km, 1.5× radius ≈ 1400 km
  const dem = makeDem(46.5, 2.5, 6)
  const mainland = square(2.5, 46.5, 4)
  const corsica = square(9.1, 42.2, 0.4) // ~750 km away → kept
  const guiana = square(-53.0, 4.0, 1.5) // ~7000 km away → dropped
  const reunion = square(55.5, -21.1, 0.3) // ~9000 km away → dropped
  const out = filterFarParts([guiana, mainland, corsica, reunion], dem)
  assert.equal(out.length, 2)
  assert.ok(out.includes(mainland))
  assert.ok(out.includes(corsica))
})

test('never returns empty: nearest part survives even when all are far', () => {
  const dem = makeDem(46.5, 2.5, 10) // small departement-scale patch
  const far = square(-53.0, 4.0, 1.5)
  const lessFar = square(9.1, 42.2, 0.4)
  const out = filterFarParts([far, lessFar], dem)
  assert.equal(out.length, 1)
  assert.equal(out[0], lessFar)
})

test('custom max distance is honoured', () => {
  const dem = makeDem(46.5, 2.5, 6)
  const mainland = square(2.5, 46.5, 4)
  const corsica = square(9.1, 42.2, 0.4)
  // shrink the radius until Corsica falls out but the mainland stays
  const out = filterFarParts([mainland, corsica], dem, FAR_PART_MAX_DIST * 0.2)
  assert.equal(out.length, 1)
  assert.equal(out[0], mainland)
})

test('polar rings (Antarctica-style, lat -90) do not blow up the projection', () => {
  const dem = makeDem(-77, 167, 6)
  const polar = [
    [
      [160, -70],
      [175, -70],
      [175, -90],
      [160, -90],
      [160, -70],
    ],
  ]
  const out = filterFarParts([polar], dem)
  assert.equal(out.length, 1) // clamped to mercator range, kept as nearest
})
