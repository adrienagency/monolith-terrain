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

// Le rayon ne peut se tester que sur un morceau HORS de l'emprise du bloc :
// dès qu'un morceau recouvre le bloc il est gardé quoi qu'il arrive, et c'est
// voulu — on n'efface pas un morceau qu'on a sous les yeux. Ce test utilisait
// la Corse, qui à ce zoom tombe À L'INTÉRIEUR du bloc ; il vérifiait donc le
// rayon sur un cas où le rayon n'a pas le dernier mot.
test('custom max distance is honoured for parts outside the patch', () => {
  const dem = makeDem(46.5, 2.5, 6) // le bloc s'arrête vers lon 11,4°
  const mainland = square(2.5, 46.5, 4) // recouvre le bloc → gardé quel que soit le rayon
  const voisine = square(14, 46.5, 0.3) // hors emprise, à ~37 unités monde du centre

  const large = filterFarParts([mainland, voisine], dem)
  assert.equal(large.length, 2, 'au rayon par défaut (42) la voisine passe')

  const serre = filterFarParts([mainland, voisine], dem, FAR_PART_MAX_DIST * 0.2)
  assert.deepEqual(serre, [mainland], 'au rayon resserré elle tombe, le recouvrant reste')
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

// RÉGRESSION — « isoler la zone » ne montrait plus rien sur une île.
//
// Le tri se faisait au CENTROÏDE seul. Il a été écrit pour le cas inverse
// (vue France métropolitaine, écarter la Guyane), et il se retourne dès que le
// bloc est PLUS PETIT que la région : à La Réunion en z12 le bloc couvre 27 km
// pour une île de 64, le centroïde de l'île tombe hors du rayon, et seuls
// trois cailloux périphériques survivaient — le repli « jamais vide » ne
// jouait pas puisque la liste n'était pas vide. Résultat : masque entièrement
// noir, relief effacé, alors que la frontière était correctement récupérée.
//
// Un morceau qui RECOUVRE le bloc est pertinent par construction, où que soit
// son centroïde.
test('a part that covers the patch is kept even when its centroid is far outside', () => {
  const dem = makeDem(-21.26, 55.74, 12) // vue serrée dans une grande île
  const ile = square(55.53, -21.13, 0.31) // recouvre largement le bloc
  const caillou = square(55.745, -21.255, 0.004) // un îlot pile sous la vue
  const out = filterFarParts([ile, caillou], dem)
  assert.ok(out.includes(ile), 'l’île qui recouvre le bloc doit être gardée')
  assert.equal(out.length, 2, 'et l’îlot proche reste, lui aussi')
})

test('a part that merely surrounds the patch without touching it is still dropped', () => {
  const dem = makeDem(46.5, 2.5, 12)
  const loin = square(-53.0, 4.0, 1.5) // Guyane : ni proche, ni recouvrante
  const proche = square(2.5, 46.5, 0.05)
  const out = filterFarParts([loin, proche], dem)
  assert.deepEqual(out, [proche])
})
