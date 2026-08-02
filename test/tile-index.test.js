import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WATER_REGION, REGION, LOD_LEVELS, LAKE_LOD_LEVELS, lodForZoom, tileZoomForLod, tilesForBBox, inRegion, grilleTuiles } from '../src/map/tile-index.js'

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

// --- REGION alias / tables de LOD par calque ---------------------------
// L'alias REGION et le paramètre `levels` sont nés avec les tuiles routières
// (calque parti depuis) ; ils restent utiles, LAKE_LOD_LEVELS s'en sert.

test('REGION is the exact same object as WATER_REGION — one region, one source of truth', () => {
  assert.equal(REGION, WATER_REGION)
})

test('lodForZoom/tileZoomForLod: default `levels` param keeps every existing (water) call site unaffected', () => {
  assert.equal(lodForZoom(8), 0)
  assert.equal(lodForZoom(12), 2)
  assert.equal(tileZoomForLod(0), 8)
  assert.equal(tileZoomForLod(2), 11)
})

// --- world lake layer (task 19) ---

test('LAKE_LOD_LEVELS: two LODs — the close band deliberately reuses the mid tiles', () => {
  // There used to be a third LOD (z9, >= 0.5 km2). It measured 1.74 GB of the
  // layer's 1.91 GB total (91%) even after sub-pixel simplification — the same
  // standard that deferred the 887 MB road tiles says that does not ship. The
  // close band (demZoom >= 12) therefore serves the z7 tiles too; sub-5 km2
  // lakes outside the Alps rich-water region are the recorded v1 loss.
  assert.equal(LAKE_LOD_LEVELS.length, 2)
  assert.equal(LAKE_LOD_LEVELS[LAKE_LOD_LEVELS.length - 1].demZoomMax, Infinity)
})

test('lodForZoom/tileZoomForLod honor an explicit LAKE_LOD_LEVELS table', () => {
  assert.equal(lodForZoom(8, LAKE_LOD_LEVELS), 0)
  assert.equal(lodForZoom(9, LAKE_LOD_LEVELS), 1) // just past LOD0's boundary
  assert.equal(lodForZoom(11, LAKE_LOD_LEVELS), 1)
  assert.equal(lodForZoom(12, LAKE_LOD_LEVELS), 1) // close band reuses the z7 tiles
  assert.equal(lodForZoom(20, LAKE_LOD_LEVELS), 1)
  assert.equal(tileZoomForLod(0, LAKE_LOD_LEVELS), 5)
  assert.equal(tileZoomForLod(1, LAKE_LOD_LEVELS), 7)
})

test('lake tiles are COARSER than water tiles at every LOD — lakes are a far sparser layer, and this one covers the whole planet', () => {
  // The property worth pinning, beyond the literals: `lake` measured 2.4% of
  // the raw region water vertices / 23.5% of the shipped Alps water bytes, so
  // a lake tile can cover much more ground than a water tile (which carries
  // rivers) and still stay under the ~2 MB/tile ceiling. This layer is also
  // GLOBAL, so total tile COUNT is a real constraint — coarser tiles are how
  // that stays tractable, not an accident.
  for (let i = 0; i < LAKE_LOD_LEVELS.length; i++) {
    assert.ok(
      LAKE_LOD_LEVELS[i].tileZoom < LOD_LEVELS[i].tileZoom,
      `LOD${i}: world-lake tileZoom (${LAKE_LOD_LEVELS[i].tileZoom}) should be coarser than water's (${LOD_LEVELS[i].tileZoom})`
    )
  }
})

test('tilesForBBox at the world-lake LOD0 zoom covers a whole-planet bbox without exploding', () => {
  // A z5 world grid is 32x32 = 1024 tiles max — the ceiling on how many tiles
  // a fully-zoomed-out view could ever ask for at the coarsest lake LOD.
  const tiles = tilesForBBox({ minLon: -180, maxLon: 180, minLat: -85, maxLat: 85 }, tileZoomForLod(0, LAKE_LOD_LEVELS))
  assert.ok(tiles.length <= 1024, `expected <=1024 tiles at z5, got ${tiles.length}`)
  for (const t of tiles) assert.ok(Number.isInteger(t.x) && Number.isInteger(t.y))
})

// ══════════ LA GRILLE D'UNE MOSAÏQUE, ENROULEMENT COMPRIS ═══════════════════
//
// MESURÉ aux Fidji (179,97 / −16,85) avant `grilleTuiles` : les quatre couches
// drapées calculaient `x0 = Math.min(...xs)` et `cols = max − x0 + 1`, ce qui
// suppose une plage de colonnes CONTIGUË. Sur une emprise à cheval sur ±180°,
// `tilesForBBox` rend légitimement des x tout en haut (255) ET tout en bas (0)
// de la plage : la soustraction rendait alors `cols = 256` pour 16 tuiles, un
// canevas de 65 536 px de large, et un `scale.x` NÉGATIF — les quatre couches
// retournées en MIROIR à l'écran.
test('grilleTuiles recolle une plage de colonnes enroulée autour de ±180°', () => {
  // Les colonnes réellement rendues aux Fidji à z8 : 255, 0 (et rien entre).
  const tuiles = [
    { z: 8, x: 255, y: 140 }, { z: 8, x: 255, y: 141 },
    { z: 8, x: 0, y: 140 }, { z: 8, x: 0, y: 141 },
  ]
  const g = grilleTuiles(tuiles, 8)
  assert.equal(g.cols, 2, 'deux colonnes voisines, pas 256')
  assert.equal(g.rows, 2)
  assert.equal(g.x0, 255, "l'origine est la colonne OUEST, celle d'où l'on avance vers l'est")
  assert.equal(g.y0, 140)
  // La position d'une tuile dans le canevas : 255 est la première, 0 la seconde.
  assert.equal(g.colonne(tuiles[0]), 0)
  assert.equal(g.colonne(tuiles[2]), 1)
  assert.equal(g.ligne(tuiles[0]), 0)
  assert.equal(g.ligne(tuiles[1]), 1)
})

test('grilleTuiles laisse intacte une plage ordinaire (aucun enroulement)', () => {
  const tuiles = []
  for (let x = 12; x <= 15; x++) for (let y = 30; y <= 32; y++) tuiles.push({ z: 6, x, y })
  const g = grilleTuiles(tuiles, 6)
  assert.equal(g.x0, 12)
  assert.equal(g.y0, 30)
  assert.equal(g.cols, 4)
  assert.equal(g.rows, 3)
  assert.equal(g.colonne({ x: 12 }), 0)
  assert.equal(g.colonne({ x: 15 }), 3)
})

test("grilleTuiles n'invente pas de grille sur une liste vide", () => {
  assert.equal(grilleTuiles([], 8), null)
  assert.equal(grilleTuiles(null, 8), null)
})

test('grilleTuiles : cols ne dépasse jamais le tour du monde', () => {
  // Une emprise qui fait le tour complet ne doit pas rendre n+1 colonnes : le
  // canevas boucherait la mémoire pour redessiner deux fois le même méridien.
  const tuiles = tilesForBBox({ minLon: -180, maxLon: 180, minLat: -60, maxLat: 60 }, 4)
  const g = grilleTuiles(tuiles, 4)
  assert.ok(g.cols <= 2 ** 4, `cols=${g.cols} dépasse les 16 colonnes du monde à z4`)
})

test("grilleTuiles rend, pour toute emprise enroulée, autant de colonnes que de x distincts quand ils sont contigus modulo n", () => {
  // La propriété qui compte, au-delà des littéraux : la grille recollée doit
  // être aussi SERRÉE que la liste de tuiles. Un `cols` plus grand que le
  // nombre de colonnes distinctes est exactement le défaut mesuré aux Fidji.
  for (const [lon, z] of [[179.97, 8], [-179.9, 6], [179.99, 12], [0, 8]]) {
    const demi = (360 / 2 ** z) * 4.5 // une emprise 3×3 fait 9 tuiles de large
    const bbox = {
      minLon: ((((lon - demi + 180) % 360) + 360) % 360) - 180,
      maxLon: ((((lon + demi + 180) % 360) + 360) % 360) - 180,
      minLat: -17.5, maxLat: -16.2,
    }
    const tuiles = tilesForBBox(bbox, z)
    const g = grilleTuiles(tuiles, z)
    const distincts = new Set(tuiles.map((t) => t.x)).size
    assert.equal(g.cols, distincts, `lon=${lon} z=${z} : cols=${g.cols} pour ${distincts} colonnes distinctes`)
  }
})
