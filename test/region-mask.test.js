import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterFarParts, levelForDemZoom, frameRegion, LEVEL_TABLE } from '../src/region-mask.js'
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

// LE SEUIL DES 300 KM. Il ne se teste que sur un morceau HORS du bloc : dès
// qu'un morceau est à l'écran il est gardé quoi qu'il arrive, et c'est voulu —
// on n'efface pas ce qu'on a sous les yeux. Le seuil se mesure en KILOMÈTRES au
// territoire visible, pas en unités monde au centre de la vue : la Corse tient
// au dessin de la France, la Réunion non, et cela ne doit pas dépendre du zoom.
test('islands within the km threshold of the visible territory are kept', () => {
  const dem = makeDem(46.5, 2.5, 10) // petit bloc, ~27 km
  const territoire = square(2.5, 46.5, 0.3) // à l'écran → graine
  const proche = square(4.0, 46.5, 0.05) // ~90 km à l'est, hors du bloc
  const lointaine = square(8.0, 46.5, 0.05) // ~400 km, hors du bloc

  const out = filterFarParts([territoire, proche, lointaine], dem)
  assert.ok(out.includes(territoire), 'le territoire visible reste')
  assert.ok(out.includes(proche), 'l’île à ~90 km reste')
  assert.ok(!out.includes(lointaine), 'celle à ~400 km tombe')

  // seuil resserré : même l'île proche sort
  const serre = filterFarParts([territoire, proche, lointaine], dem, 50)
  assert.deepEqual(serre, [territoire])
})

test('the km threshold is measured from what is ON SCREEN, not from the biggest part', () => {
  // vue sur une petite île ; un continent énorme existe à 5 000 km. Mesuré au
  // plus GRAND morceau, il aurait servi de référence et tout aurait basculé.
  const dem = makeDem(-21.1, 55.5, 10)
  const ile = square(55.5, -21.1, 0.3) // à l'écran
  const continent = square(2.5, 46.5, 6) // énorme, à l'autre bout du monde
  const out = filterFarParts([ile, continent], dem)
  assert.deepEqual(out, [ile], 'le continent lointain ne doit pas entrer')
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

// ---- cadrage automatique de la zone isolée --------------------------------
// « Une île perdue au milieu de rien, ça fait bizarre » (Adrien) : le bloc se
// recentre sur la zone et descend au zoom le plus serré qui la contienne.
const boite = (lonMin, latMin, lonMax, latMax) => [[[
  [lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax], [lonMin, latMin],
]]]

test('frameRegion centres on the zone', () => {
  const f = frameRegion(boite(55.216, -21.39, 55.837, -20.872))
  assert.ok(Math.abs(f.lon - 55.5265) < 1e-3, `lon ${f.lon}`)
  assert.ok(Math.abs(f.lat - -21.131) < 1e-3, `lat ${f.lat}`)
})

test('the tighter the zone, the deeper the zoom', () => {
  const grande = frameRegion(boite(0, 45, 4, 49)) // ~440 km
  const moyenne = frameRegion(boite(0, 45, 0.5, 45.5)) // ~55 km
  const petite = frameRegion(boite(0, 45, 0.05, 45.05)) // ~5,5 km
  assert.ok(petite.zoom > moyenne.zoom, `${petite.zoom} doit dépasser ${moyenne.zoom}`)
  assert.ok(moyenne.zoom > grande.zoom, `${moyenne.zoom} doit dépasser ${grande.zoom}`)
})

// LE contrat du schéma d'Adrien : c'est le PLUS GRAND côté qui décide, donc
// allonger l'un OU l'autre doit reculer le zoom. Une égalité stricte entre une
// zone large et une zone haute serait un mauvais test : un degré de longitude à
// 45° ne vaut pas un degré de latitude, et l'arrondi du zoom tomberait d'un
// côté ou de l'autre selon la troisième décimale du jeu d'essai.
test('the LARGEST side decides the zoom — either axis can be the one', () => {
  const carre = frameRegion(boite(0, 45, 0.1, 45.1))
  const etiree_est_ouest = frameRegion(boite(0, 45, 2, 45.1))
  const etiree_nord_sud = frameRegion(boite(0, 45, 0.1, 47))
  assert.ok(etiree_est_ouest.zoom < carre.zoom, 'étirer en longitude doit reculer le zoom')
  assert.ok(etiree_nord_sud.zoom < carre.zoom, 'étirer en latitude aussi')
})

test('frameRegion never asks for a zoom the app cannot serve', () => {
  const minuscule = frameRegion(boite(0, 45, 0.00001, 45.00001))
  assert.ok(minuscule.zoom <= 15, `plafond dépassé : ${minuscule.zoom}`)
  const enorme = frameRegion(boite(-170, -80, 170, 80))
  assert.ok(enorme.zoom >= 4, `plancher franchi : ${enorme.zoom}`)
})

test('frameRegion returns null on degenerate input instead of NaN', () => {
  assert.equal(frameRegion([]), null)
  assert.equal(frameRegion(null), null)
  assert.equal(frameRegion([[[]]]), null)
  const f = frameRegion([[[[NaN, 45], [1, 46], [2, 47]]]])
  assert.ok(Number.isFinite(f.lat) && Number.isFinite(f.lon) && Number.isFinite(f.zoom))
})
