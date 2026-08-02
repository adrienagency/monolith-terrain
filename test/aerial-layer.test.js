import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aerialCovers, aerialUnavailable, aerialUvTransform, aerialZoomFor, lonLatToMerc, tileGridMerc, SUPERSEDED, providerFor, pointInPolygon, PROVIDERS } from '../src/map/aerial-layer.js'
import { tilesForBBox, grilleTuiles } from '../src/map/tile-index.js'

test('aerialCovers: an Annecy patch is covered', () => {
  assert.equal(aerialCovers({ minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }), true)
})

test('aerialCovers: global now — the NASA floor covers land AND sea', () => {
  assert.equal(aerialCovers({ minLon: 7.7, maxLon: 7.9, minLat: 46.0, maxLat: 46.2 }), true) // Valais, CH
  assert.equal(aerialCovers({ minLon: 2.2, maxLon: 2.5, minLat: 48.8, maxLat: 48.9 }), true) // Paris, FR
  assert.equal(aerialCovers({ minLon: 4.9, maxLon: 5.1, minLat: 41.9, maxLat: 42.1 }), true) // open Mediterranean
  assert.equal(aerialCovers(null), false)
})

test('providerFor: judged on the CENTRE, not on overlap', () => {
  // a huge patch whose centre sits in un-served Germany must not borrow a
  // neighbour's national provider just because a corner clips it
  const p = providerFor({ minLon: 8.0, maxLon: 16.0, minLat: 51.0, maxLat: 55.0 }) // centre ~ Berlin area
  assert.equal(p.id, 'nasa')
})

test('lonLatToMerc: the origin and the equator land where Mercator says', () => {
  const o = lonLatToMerc(-180, 0)
  assert.ok(Math.abs(o.x - 0) < 1e-9)
  assert.ok(Math.abs(o.y - 0.5) < 1e-9, 'the equator is halfway down the world')
  const m = lonLatToMerc(0, 0)
  assert.ok(Math.abs(m.x - 0.5) < 1e-9)
})

test('aerialUvTransform: a patch filling the grid exactly maps to the full texture', () => {
  const patch = { minLon: -10, maxLon: 10, minLat: -5, maxLat: 5 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const t = aerialUvTransform(patch, { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y })
  assert.ok(Math.abs(t.offset[0]) < 1e-9 && Math.abs(t.offset[1]) < 1e-9)
  assert.ok(Math.abs(t.scale[0] - 1) < 1e-9 && Math.abs(t.scale[1] - 1) < 1e-9)
})

test('aerialUvTransform: a patch inside a bigger grid gets a real inset', () => {
  // The regression that matters: the tile grid ALWAYS overhangs the patch, and
  // stretching the whole mosaic across the block would slide the photo off the
  // terrain by up to a tile — roads landing in fields.
  const patch = { minLon: 6.0, maxLon: 6.2, minLat: 45.8, maxLat: 45.95 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const pad = (b.x - a.x) * 0.5
  const grid = { minX: a.x - pad, maxX: b.x + pad, minY: a.y - pad, maxY: b.y + pad }
  const t = aerialUvTransform(patch, grid)
  assert.ok(t.offset[0] > 0 && t.offset[0] < 1, `offset.x ${t.offset[0]} must be a real inset`)
  assert.ok(t.scale[0] > 0 && t.scale[0] < 1, `scale.x ${t.scale[0]} must shrink into the grid`)
  // and the patch must land wholly inside the texture, not run off its edge
  assert.ok(t.offset[0] + t.scale[0] <= 1 + 1e-9)
  assert.ok(t.offset[1] + t.scale[1] <= 1 + 1e-9)
})

test('aerialUvTransform: latitude is handled in mercator, not linearly', () => {
  // A tall patch far from the equator: doing this in raw lat/lon would give a
  // different (skewed) vertical scale. Guard that we did NOT do that.
  const patch = { minLon: 0, maxLon: 1, minLat: 60, maxLat: 62 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat)
  const b = lonLatToMerc(patch.maxLon, patch.minLat)
  const grid = { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y }
  const t = aerialUvTransform(patch, grid)
  const naiveRatio = (patch.maxLat - patch.minLat) / (patch.maxLon - patch.minLon)
  const mercRatio = (b.y - a.y) / (b.x - a.x)
  assert.ok(Math.abs(mercRatio - naiveRatio) > 0.5, 'mercator and linear must differ here, else the test proves nothing')
  assert.ok(Math.abs(t.scale[1] - 1) < 1e-9, 'the mercator-derived transform still fills its own grid exactly')
})

// --- honest failure ---------------------------------------------------------
// Until now, asking for imagery outside the covered area did NOTHING: the
// toggle stayed on, no photo appeared, and nobody was told why. These pin the
// behaviour that replaced it — say what happened, in words, or say nothing.

test('aerialUnavailable: a covered patch reports no problem', () => {
  assert.equal(aerialUnavailable({ minLon: 6.05, maxLon: 6.25, minLat: 45.82, maxLat: 45.96 }), null)
})

test('aerialUnavailable: null everywhere now that the floor is global', () => {
  assert.equal(aerialUnavailable({ minLon: 11.5, maxLon: 11.7, minLat: 48.1, maxLat: 48.2 }), null)
  assert.equal(aerialUnavailable({ minLon: -40.1, maxLon: -39.9, minLat: 29.9, maxLat: 30.1 }), null) // mid-Atlantic
  assert.equal(aerialUnavailable(null), null)
})



test('aerialUnavailable: no patch at all is not a coverage complaint', () => {
  // Nothing loaded yet is not the same as "your area has no photos" — saying
  // the latter during boot would be a lie.
  assert.equal(aerialUnavailable(null), null)
})

// --- the texture budget is a BOUND, not a suggestion --------------------------

test('aerialZoomFor: the mosaic never exceeds the budget', () => {
  // The regression: the old version returned the first zoom to REACH the budget
  // by tile-area, which is the first zoom to overshoot it in pixels. At the
  // finest terrain scale that built a 3072 px canvas against a 2048 px cap.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 } // ~2.5 km, z15-sized
  for (const budget of [1024, 2048, 4096]) {
    const z = aerialZoomFor(patch, { budgetPx: budget })
    const tiles = tilesForBBox(patch, z)
    const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y)
    const px = Math.max(Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1) * 256
    assert.ok(px <= budget, `budget ${budget} → z${z} builds a ${px}px canvas`)
  }
})

test('aerialZoomFor: a bigger budget buys more detail, never less', () => {
  // Guards the bound from being satisfied trivially by always returning z6.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 }
  const small = aerialZoomFor(patch, { budgetPx: 1024 })
  const large = aerialZoomFor(patch, { budgetPx: 4096 })
  assert.ok(large > small, `4096 (z${large}) must beat 1024 (z${small})`)
})

test('aerialZoomFor: a device that only guarantees 2048 is respected', () => {
  // WebGL2 GUARANTEES only 2048. Asking a phone for the desktop's 4096 does not
  // render slowly — it fails outright.
  const patch = { minLon: 6.16, maxLon: 6.19, minLat: 45.84, maxLat: 45.87 }
  const z = aerialZoomFor(patch, { budgetPx: 2048 })
  const tiles = tilesForBBox(patch, z)
  const xs = tiles.map((t) => t.x)
  assert.ok((Math.max(...xs) - Math.min(...xs) + 1) * 256 <= 2048)
})

// --- superseded is not failure ------------------------------------------------

test('SUPERSEDED is a distinct sentinel, not a falsy value', () => {
  // The bug: build() returned null BOTH when every tile failed and when a
  // newer build took over. A caller that reacts to failure by warning the user
  // and switching the layer off then fired on every ordinary race — and a race
  // is the NORMAL case, because changing scale triggers two refreshes.
  assert.ok(SUPERSEDED, 'must be truthy, or `if (!built)` swallows it again')
  assert.notEqual(SUPERSEDED, null)
  assert.equal(SUPERSEDED.superseded, true)
})

test('SUPERSEDED is frozen — callers compare identity, not shape', () => {
  assert.ok(Object.isFrozen(SUPERSEDED))
})

// --- two countries, one border ------------------------------------------------
// The reason this is not a pair of rectangles: any bbox around Switzerland also
// contains Chamonix, and any bbox around France also contains the Valais.
// Zermatt and Chamonix sit 40 km apart on opposite sides of that border and are
// both prime trail-race country.

const at = (lon, lat) => ({ minLon: lon - 0.05, maxLon: lon + 0.05, minLat: lat - 0.04, maxLat: lat + 0.04 })

test('providerFor: French places get IGN', () => {
  for (const [name, lon, lat] of [['Annecy', 6.17, 45.9], ['Chamonix', 6.87, 45.92], ['Brest', -4.49, 48.39], ['Nice', 7.27, 43.7], ['Corsica', 9.15, 42.3]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'ign', name)
  }
})

// v48: southern Brittany coast was cut off by a coarse diagonal — regression pin
test('providerFor: southern Brittany coast gets IGN', () => {
  for (const [name, lon, lat] of [['Vannes/Morbihan', -2.76, 47.63], ['Lorient', -3.37, 47.75], ['Quiberon', -3.12, 47.48], ['Concarneau', -3.92, 47.87], ['Quimper', -4.1, 47.99]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'ign', name)
  }
})

test('providerFor: Swiss places get swisstopo', () => {
  for (const [name, lon, lat] of [['Zermatt', 7.75, 46.02], ['Zurich', 8.54, 47.37], ['Geneva', 6.14, 46.2], ['Verbier', 7.23, 46.1], ['Lugano', 8.95, 46.0]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'swisstopo', name)
  }
})

test('providerFor: Chamonix and Zermatt do NOT share a provider', () => {
  // The single test that a rectangle scheme cannot pass.
  assert.notEqual(providerFor(at(6.87, 45.92)).id, providerFor(at(7.75, 46.02)).id)
})

test('providerFor: un-served places fall to the NASA global floor', () => {
  for (const [name, lon, lat] of [['Milan', 9.19, 45.46], ['London', -0.13, 51.51], ['open Atlantic', -40, 30]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'nasa', name)
  }
  assert.equal(providerFor(at(11.58, 48.14))?.id, 'bayern', 'Munich is served by Bavaria now')
  assert.equal(providerFor(at(2.17, 41.39))?.id, 'pnoa', 'Barcelona is served by PNOA now')
})

test('positive-test-only providers are never reached by elimination', () => {
  // swisstopo, PDOK, PNOA, Bavaria, NRW, Luxembourg and NLSC all answer
  // 200-with-placeholder OUTSIDE their coverage (curl-verified) — reaching
  // any of them by elimination silently renders blank tiles. Everything
  // un-served must land on the global floor instead.
  for (const [lon, lat] of [[9.19, 45.46], [-0.13, 51.51], [13.4, 52.52], [126.98, 37.57]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'nasa', `${lon},${lat}`)
  }
})

test('providerFor: the new national providers route their capitals home', () => {
  for (const [id, lon, lat] of [
    ['basemap-at', 16.37, 48.21], ['pdok', 4.9, 52.37], ['lu-act', 6.13, 49.61],
    ['vlaanderen', 3.72, 51.05], ['pnoa', -3.7, 40.42], ['cuzk', 14.44, 50.08],
    ['gugik', 21.01, 52.23], ['maaamet', 24.75, 59.44], ['zbgis', 17.11, 48.15],
    ['nrw', 6.96, 50.94], ['bayern', 11.58, 48.14],
    ['usgs', -77.04, 38.91], ['gsi', 139.69, 35.69], ['nlsc', 121.56, 25.03],
  ]) {
    assert.equal(providerFor(at(lon, lat))?.id, id, `${id} capital`)
  }
})

test('providerFor: alpine + Tatra borders route to the right side', () => {
  assert.equal(providerFor(at(11.4, 47.27))?.id, 'basemap-at', 'Innsbruck -> Austria, not Bavaria')
  assert.equal(providerFor(at(13.04, 47.81))?.id, 'basemap-at', 'Salzburg -> Austria')
  assert.equal(providerFor(at(19.95, 49.3))?.id, 'gugik', 'Zakopane -> Poland')
  assert.equal(providerFor(at(20.3, 49.06))?.id, 'zbgis', 'Poprad -> Slovakia')
  assert.equal(providerFor(at(129.07, 35.18))?.id, 'nasa', 'Busan is NOT Japan')
  assert.equal(providerFor(at(131.9, 43.12))?.id, 'nasa', 'Vladivostok is NOT Japan')
  assert.equal(providerFor(at(-79.38, 43.65))?.id, 'nasa', 'Toronto is NOT the USA')
})

test('pointInPolygon: a square behaves', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]]
  assert.equal(pointInPolygon(5, 5, sq), true)
  assert.equal(pointInPolygon(15, 5, sq), false)
  assert.equal(pointInPolygon(5, 15, sq), false)
  assert.equal(pointInPolygon(-5, 5, sq), false)
})

test('every provider carries an attribution — it is a licence obligation', () => {
  for (const p of PROVIDERS) {
    assert.ok(typeof p.attribution === 'string' && p.attribution.length > 3, p.id)
    assert.equal(typeof p.url(14, 100, 100), 'string')
    assert.ok(p.url(14, 100, 100).startsWith('https://'), `${p.id} must be https`)
  }
})

test('providerFor: national envelopes still exclude their neighbours', () => {
  // the FR bulge must not reach Italy; nobody else may claim these either —
  // they belong to the global floor
  for (const [name, lon, lat] of [['Milan', 9.19, 45.46], ['Turin', 7.69, 45.07], ['Stuttgart', 9.18, 48.78]]) {
    assert.equal(providerFor(at(lon, lat))?.id, 'nasa', name)
  }
})

// ══════════ LA PHOTO COUVRE CE QU'ON PEUT VOIR, PAS UN NEUVIÈME ═════════════
//
// Adrien, en mode continu 3×3 : « la map aérienne qu'on active ne se charge que
// sur 1 carreau sur 9 ».
//
// LA CAUSE tenait en un caractère : `blockBounds` (devenu `demBounds`) posait
// `HALF = TERRAIN_SIZE / 2`, soit 28 unités, alors que `worldToLatLon` divise
// par `demSpan(dem)` — 168 sur une emprise. La photo décrivait donc le TIERS
// central de la largeur, un NEUVIÈME de la surface. C'est exactement l'erreur
// qui s'est déjà glissée trois fois sur cette branche : une longueur qui oublie
// que l'emprise triple le bloc.
//
// ⚠️ ET CE N'EST PAS PLUS CHER, C'EST MOINS CHER. Le budget de texture est une
// BORNE en pixels (`aerialZoomFor`), pas un nombre de tuiles : demander une
// bbox trois fois plus large au même budget fait simplement descendre de deux
// crans d'imagerie. MESURÉ sur les trois zones de référence (mont St Helens
// z13, Chamonix z12, La Réunion z13), budget 4096 :
//
//   un bloc aujourd'hui        z15  144 tuiles  canevas 3072²  36,0 Mo
//   neuf blocs au même cran    z15 1296 tuiles  9 × 3072²     324,0 Mo  (dérivé)
//   L'EMPRISE, même budget     z13   81 tuiles  canevas 2304²  20,3 Mo
//
// 0,56× les tuiles d'UN bloc, et 15,7 Mo de MOINS qu'aujourd'hui. Le « niveau
// grossier qui couvre les neuf dalles tout de suite » qu'Adrien a tranché ne se
// paie pas : il s'obtient en cessant de mentir sur l'emprise.
//
// (Le chiffre « 604 Mo » du dossier était faux dans les deux sens : dérivé, et
// calculé sur un mauvais octet par texel. 1 296 tuiles font 324 Mo en RGBA.)

import { demBounds } from '../src/map/aerial-layer.js'
import { demSpan } from '../src/geo.js'

// Un MNT de la forme que rend loadDem (cote 1) ou recollerEmprise (cote 3).
function demFictif(lat, lon, zoom, cote = 1, tilePx = 512) {
  const n = 2 ** zoom
  const r = (lat * Math.PI) / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  const debord = cote > 1 ? 3 : 0
  return {
    size: 3 * tilePx * cote, tilePx, zoom,
    originTileX: cx - 1 - debord, originTileY: cy - 1 - debord,
    ...(cote > 1 ? { empriseCote: cote } : {}),
  }
}

test('demBounds : sur une emprise 3×3, la photo couvre les NEUF dalles', () => {
  for (const [lat, lon, z] of [[46.2, -122.19, 13], [45.92, 6.87, 12], [-21.13, 55.53, 13]]) {
    const bloc = demFictif(lat, lon, z, 1)
    const emprise = demFictif(lat, lon, z, 3)
    const bb = demBounds(bloc), be = demBounds(emprise)
    // La longitude est LINÉAIRE en mercator : le rapport se lit en degrés.
    const largeurBloc = bb.maxLon - bb.minLon
    const largeurEmprise = be.maxLon - be.minLon
    assert.ok(Math.abs(largeurEmprise / largeurBloc - 3) < 1e-9, `largeur ×${largeurEmprise / largeurBloc}`)
    // ⚠️ LA LATITUDE, ELLE, NE SE COMPARE QU'EN MERCATOR. En degrés le rapport
    // n'est pas 3 (la projection s'étire vers les pôles) et un test naïf
    // échouerait à Chamonix tout en passant à l'équateur — le pire des tests.
    const hb = lonLatToMerc(0, bb.minLat).y - lonLatToMerc(0, bb.maxLat).y
    const he = lonLatToMerc(0, be.minLat).y - lonLatToMerc(0, be.maxLat).y
    assert.ok(Math.abs(he / hb - 3) < 1e-9, `hauteur mercator ×${he / hb}`)
    // et l'emprise est CENTRÉE sur le bloc, pas décalée
    assert.ok(Math.abs((be.minLon + be.maxLon) / 2 - (bb.minLon + bb.maxLon) / 2) < 1e-9)
  }
})

test('demBounds : hors mode continu, l’emprise est celle d’aujourd’hui au bit près', () => {
  // Le mode ordinaire ne doit RIEN changer : demSpan rend 56 sans empriseCote.
  const bloc = demFictif(45.92, 6.87, 12, 1)
  assert.equal(demSpan(bloc), 56)
  const b = demBounds(bloc)
  // trois tuiles de MNT de large, exactement — la définition d'un bloc
  const n = 2 ** 12
  assert.ok(Math.abs((b.maxLon - b.minLon) - (3 / n) * 360) < 1e-9)
})

test('le niveau grossier de l’emprise coûte MOINS qu’un bloc d’aujourd’hui', () => {
  // Le témoin chiffré de l'en-tête. S'il tombe, c'est que le budget de texture
  // a bougé et qu'il faut refaire la mesure avant de croire au reste.
  const bloc = demBounds(demFictif(45.92, 6.87, 12, 1))
  const emprise = demBounds(demFictif(45.92, 6.87, 12, 3))
  const zb = aerialZoomFor(bloc, { budgetPx: 4096 })
  const ze = aerialZoomFor(emprise, { budgetPx: 4096 })
  assert.ok(ze < zb, `l’emprise doit descendre d’au moins un cran (${ze} contre ${zb})`)
  const nb = tilesForBBox(bloc, zb).length
  const ne = tilesForBBox(emprise, ze).length
  assert.ok(ne < nb, `${ne} tuiles pour l’emprise contre ${nb} pour un bloc — ce doit être MOINS`)
})

// ══════════ L'ANTIMÉRIDIEN — LE MIROIR, ET LE CANEVAS QUI EXPLOSE ═══════════

test('aerialUvTransform : une emprise à cheval sur ±180° ne rend PAS un scale négatif', () => {
  // LE DÉFAUT MESURÉ aux Fidji : `b.x` (bord est, lon −177,9) tombe à 0,006 en
  // mercator normalisé alors que `a.x` (bord ouest, lon +177,9) vaut 0,994.
  // `b.x - a.x` sortait donc à −0,99 : un scale NÉGATIF, c'est-à-dire la
  // mosaïque retournée en miroir sur le terrain.
  const patch = { minLon: 177.861, maxLon: -177.921, minLat: -17.5, maxLat: -16.2 }
  const tuiles = tilesForBBox(patch, 8)
  const g = grilleTuiles(tuiles, 8)
  const t = aerialUvTransform(patch, tileGridMerc(g.x0, g.y0, g.cols, g.rows, 8))
  assert.ok(t.scale[0] > 0, `scale.x = ${t.scale[0]} : une mosaïque en miroir`)
  assert.ok(t.scale[1] > 0, `scale.y = ${t.scale[1]}`)
  // Et le bloc doit tenir DANS la mosaïque : la grille de tuiles déborde
  // toujours un peu l'emprise, jamais l'inverse.
  assert.ok(t.offset[0] >= -1e-9 && t.offset[0] + t.scale[0] <= 1 + 1e-9,
    `u sort de la mosaïque : offset=${t.offset[0]} scale=${t.scale[0]}`)
  assert.ok(t.offset[1] >= -1e-9 && t.offset[1] + t.scale[1] <= 1 + 1e-9,
    `v sort de la mosaïque : offset=${t.offset[1]} scale=${t.scale[1]}`)
})

test('aerialUvTransform : le témoin sans enroulement garde exactement le même résultat', () => {
  // La correction de l'enroulement ne doit RIEN changer au cas ordinaire.
  const patch = { minLon: 6.0, maxLon: 6.5, minLat: 45.7, maxLat: 46.0 }
  const tuiles = tilesForBBox(patch, 10)
  const g = grilleTuiles(tuiles, 10)
  const t = aerialUvTransform(patch, tileGridMerc(g.x0, g.y0, g.cols, g.rows, 10))
  assert.ok(t.scale[0] > 0 && t.scale[1] > 0)
  assert.ok(t.offset[0] >= 0 && t.offset[0] + t.scale[0] <= 1)
})

test('aerialZoomFor : au plancher z3, la borne est une VRAIE borne', () => {
  // MESURÉ avant correction : une emprise 3×3 à z3 fait 405° de large (neuf
  // tuiles de 45°). `aerialZoomFor` partait de `best = 6` et rendait 6 quoi
  // qu'il arrive — canevas 16 384 × 15 104, soit 990 Mo, contre un budget de
  // 4 096 px. « A cap you step over is not a cap » : la borne était redevenue
  // décorative depuis que le plancher est passé à z3.
  const large = { minLon: -180, maxLon: 180, minLat: -60, maxLat: 60 }
  assert.equal(aerialZoomFor(large, { budgetPx: 4096, maxZoom: 19 }), null,
    "aucun zoom ne tient dans le budget : il faut le DIRE, pas rendre 6")
  // Et là où quelque chose tient, on rend le plus fin qui tient — inchangé.
  const annecy = { minLon: 6.0, maxLon: 6.5, minLat: 45.7, maxLat: 46.0 }
  const z = aerialZoomFor(annecy, { budgetPx: 4096, maxZoom: 19 })
  assert.ok(Number.isInteger(z) && z >= 6, `zoom retenu ${z}`)
})

test('aerialZoomFor : le zoom rendu tient TOUJOURS dans le budget, sur un balayage d emprises', () => {
  // La propriété, plutôt que les littéraux : quel que soit le cadrage, soit on
  // rend null, soit la mosaïque du zoom rendu tient dans le budget. C'est ce
  // que « borne » veut dire, et c'est ce qui n'était pas vrai.
  const budgetPx = 4096
  for (const demi of [0.05, 0.5, 5, 22.5, 45, 101.25, 135, 202.5]) {
    for (const lat of [0, 46, -16.85]) {
      const bbox = { minLon: -demi, maxLon: demi, minLat: lat - demi / 2, maxLat: lat + demi / 2 }
      const z = aerialZoomFor(bbox, { budgetPx, maxZoom: 19 })
      if (z === null) continue
      const g = grilleTuiles(tilesForBBox(bbox, z), z)
      assert.ok(Math.max(g.cols, g.rows) * 256 <= budgetPx,
        `demi=${demi} lat=${lat} : z=${z} rend ${g.cols}x${g.rows} tuiles = ${Math.max(g.cols, g.rows) * 256} px > ${budgetPx}`)
    }
  }
})
