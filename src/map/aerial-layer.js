// Aerial photo skin for the terrain — France and Switzerland.
//
// Nothing is stored. Tiles are fetched per view straight from each country's
// public WMTS — measured 1.1-3.4 MB for a view, 0 bytes deployed. The 887 MB
// road-tile lesson was about data we HOST; this hosts nothing.
//
// Off by default: photography is a mode, not the identity. The product's own
// register is the quiet editorial relief (hypsometric palettes, fine contours,
// marble and sand), and the photo skin is there when a course needs to be read
// against real ground.
//
// Widening further = one more entry in PROVIDERS plus its VERIFIED licence and
// a coverage test that does not rely on the server 404ing (see the note there).
// Plan: docs/superpowers/plans/2026-07-17-aerial-imagery.md.

import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'
import { worldToLatLon } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'

// The block's EXACT lon/lat footprint, from its own two corners.
//
// This is NOT patchBounds(): that one pads by 5% + 0.01deg on purpose, to widen
// the net when SEARCHING for features near the patch. Using it to describe the
// block itself measured 12% oversize and a ~5 km north-west shift of the
// imagery — a lake climbing a hillside. A photo has to be registered to the
// ground it's painted on, so it gets the true extent, nothing padded.
export function blockBounds(dem) {
  const HALF = TERRAIN_SIZE / 2
  const nw = worldToLatLon(dem, -HALF, -HALF)
  const se = worldToLatLon(dem, HALF, HALF)
  return {
    minLon: Math.min(nw.lon, se.lon), maxLon: Math.max(nw.lon, se.lon),
    minLat: Math.min(nw.lat, se.lat), maxLat: Math.max(nw.lat, se.lat),
  }
}

const TILE_PX = 256
// What we'd LIKE the composited texture to be. At the finest terrain scale
// (z15, a ~2.5 km block) 4096 buys 0.83 m/texel — measured, and sharp enough
// that the photo holds up against the relief instead of smearing.
//
// It is a wish, not a guarantee: the real ceiling is whatever the device
// reports (WebGL2 only GUARANTEES 2048; a desktop GPU offers 16384). Pass the
// device's own limit in — see AerialLayer's constructor.
//
// Cost is quadratic in both directions, and it is not small: 4096 at z15 is
// 144 tile fetches and ~15 s on a fast connection, against ~36 fetches and ~4 s
// at 2048. Re-measure both before moving this.
const TARGET_TEXTURE_PX = 4096

// PROVIDERS ------------------------------------------------------------------
// Attribution is a LEGAL obligation under both licences below, not a courtesy.
// It must be visible whenever the imagery is, and gone when it isn't.
//
// LICENCES — verified live 2026-07, do not add a source without checking yours:
//   IGN BD ORTHO ....... Licence Ouverte Etalab 2.0. Commercial use OK, no API
//                        key. Serves a clean 404 outside France (verified at
//                        Zermatt), so a mis-routed block fails visibly.
//   swisstopo SWISSIMAGE  Swiss OGD terms: free use "in particular also for
//                        commercial purposes", source reference MANDATORY.
//                        WARNING, verified: it answers 200 OUTSIDE Switzerland
//                        (tried at Annecy) rather than 404ing. It cannot be
//                        used as its own coverage test — hence the border
//                        polygon below, and hence Switzerland is tested FIRST.
//   EOX s2cloudless .... BANNED, commercial use needs a paid EOX licence.
//   Esri World Imagery . BANNED, grants no rights outside three ArcGIS cases.

export const IGN_ATTRIBUTION = 'Orthophotos © IGN'
export const SWISSTOPO_ATTRIBUTION = '© swisstopo'

// Coarse outline of Switzerland, lon/lat, ~20 vertices.
//
// A RECTANGLE CANNOT WORK HERE, and that is the whole reason this exists: any
// bbox around Switzerland also contains Chamonix and Haute-Savoie, while any
// bbox around France contains the Valais. Zermatt and Chamonix are 40 km apart
// on opposite sides of a border and are both prime trail-race country, so
// getting them the wrong national provider is not an edge case.
//
// Deliberately coarse: at block scale (2-80 km) a few km of border slop is
// invisible, and a precise boundary would be a data file to host and maintain.
const CH_OUTLINE = [
  [7.59, 47.59], [8.62, 47.76], [9.65, 47.55], [9.60, 47.06], [10.49, 46.87],
  [10.45, 46.53], [10.15, 46.23], [9.05, 45.82], [8.80, 46.10], [8.44, 46.46],
  [7.85, 45.92], [7.05, 45.87], [6.80, 46.05], [6.13, 46.14], [5.96, 46.13],
  [6.06, 46.42], [6.44, 46.77], [6.87, 47.00], [7.00, 47.50],
]

// Standard ray casting. Exported for tests.
export function pointInPolygon(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]

// Metropolitan France, coarse outline. A bbox was tried first and rejected by
// its own test: a rectangle reaching far enough east for Alsace and the Alps
// swallows Milan, Turin and Luxembourg, so the layer would promise imagery
// where IGN has none.
// The eastern edge deliberately bulges OVER Switzerland rather than tracing
// the real, deeply concave Franco-Swiss border. It can: Switzerland is matched
// first, so no Swiss block ever reaches this test. Trying to trace that border
// coarsely is what put Chamonix on the wrong side — the Mont Blanc massif is
// French and juts east past Geneva, and a 3-vertex approximation cut it off.
// The envelope still excludes Milan and Turin, which is what actually matters
// here (both verified by test).
const FR_OUTLINE = [
  [2.37, 51.03], [4.23, 50.28], [6.36, 49.46], [8.23, 48.97], [7.59, 47.59],
  [8.40, 47.00], [9.60, 46.30], [7.90, 45.85], [7.19, 44.12], [7.53, 43.78],
  [5.00, 43.00], [3.04, 42.47], [0.66, 42.69], [-1.79, 43.35], [-1.25, 44.50],
  [-1.15, 46.20], [-2.50, 47.50], [-4.79, 48.40], [-1.85, 49.72], [1.58, 50.95],
]

// Corsica and the overseas departments IGN also serves (Martinique verified
// live). Islands are simple enough that boxes are honest here.
// [minLon, minLat, maxLon, maxLat]
const FR_BOXES = [
  [8.5, 41.3, 9.6, 43.1], // Corsica
  [-61.9, 14.3, -60.7, 16.6], // Guadeloupe + Martinique
  [-54.7, 2.0, -51.5, 6.0], // Guyane
  [55.1, -21.5, 55.9, -20.8], // La Reunion
  [45.0, -13.1, 45.4, -12.6], // Mayotte
]

// Order matters: Switzerland is tested FIRST because swisstopo does not 404
// outside its own country (see the licence note above), so it must never be
// reached by elimination — only by a positive border test.
export const PROVIDERS = [
  {
    id: 'swisstopo',
    attribution: SWISSTOPO_ATTRIBUTION,
    maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, CH_OUTLINE),
    url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`,
  },
  {
    id: 'ign',
    attribution: IGN_ATTRIBUTION,
    maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, FR_OUTLINE) || FR_BOXES.some((b) => inBox(lon, lat, b)),
    url: (z, x, y) =>
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
      `&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  },
]

// Which provider serves this patch, or null. Judged on the patch CENTRE — a
// block half-overlapping a border shouldn't flip provider because one corner
// clips it; the user is looking at whatever sits in the middle.
export function providerFor(bbox) {
  if (!bbox) return null
  const lon = (bbox.minLon + bbox.maxLon) / 2
  const lat = (bbox.minLat + bbox.maxLat) / 2
  return PROVIDERS.find((p) => p.covers(lon, lat)) ?? null
}

// Exported for tests: is this patch inside covered territory?
export function aerialCovers(bbox) {
  return !!providerFor(bbox)
}

// Why the view can't have imagery, in words the user reads — or null when
// nothing is wrong.
//
// This exists because the old behaviour was to fail SILENTLY: the toggle stayed
// on, no photo appeared, and the user was left to guess whether the layer was
// broken, still loading, or simply absent here. A feature that can't deliver
// has to say so.
//
// A missing bbox returns null, not a complaint: nothing has loaded yet is not
// the same as "your area has no photos", and saying the latter during boot
// would be a lie.
export function aerialUnavailable(bbox) {
  if (!bbox) return null
  if (!aerialCovers(bbox)) {
    return 'No aerial photography here yet — it currently covers France and Switzerland.'
  }
  return null
}

// Widest side of the tile mosaic, in pixels, at a given zoom. This is what
// actually becomes the canvas, so it — not the tile COUNT — is what has to fit
// the texture budget.
function mosaicPx(bbox, z) {
  const tiles = tilesForBBox(bbox, z)
  if (!tiles.length) return 0
  const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y)
  const cols = Math.max(...xs) - Math.min(...xs) + 1
  const rows = Math.max(...ys) - Math.min(...ys) + 1
  return Math.max(cols, rows) * TILE_PX
}

// The FINEST imagery zoom whose mosaic still fits the texture budget.
//
// It used to return the first zoom that reached the budget by tile-area, which
// meant it returned the first zoom to BLOW PAST it: at the finest terrain scale
// that produced a 3072 px canvas against a documented 2048 cap. A cap you step
// over is not a cap. This walks up while it still fits and stops before it
// doesn't, so the budget is a real bound in the only unit that matters.
export function aerialZoomFor(bbox, { maxZoom = 19, budgetPx = TARGET_TEXTURE_PX } = {}) {
  let best = 6
  for (let z = 6; z <= maxZoom; z++) {
    const px = mosaicPx(bbox, z)
    if (px > budgetPx) break // every finer zoom is bigger still
    best = z
  }
  return best
}

// Returned by build() when a newer build has taken over. Distinct from null
// (genuine failure) and from a built layer: the caller must leave everything
// exactly as it is, because someone else is already producing the real answer.
export const SUPERSEDED = Object.freeze({ superseded: true })

export class AerialLayer {
  // `maxTexturePx` is the DEVICE's limit (THREE.WebGLRenderer exposes it as
  // renderer.capabilities.maxTextureSize). We never ask for more than it or
  // more than we want: a texture over the limit is not slow, it FAILS, and on
  // a phone that limit can be 4x lower than on the desktop this was built on.
  constructor({ maxTexturePx = TARGET_TEXTURE_PX } = {}) {
    this._budgetPx = Math.min(TARGET_TEXTURE_PX, maxTexturePx)
    this._texture = null
    this._buildId = 0
  }

  // `bbox` is the TRUE block extent — see blockBounds(). Do NOT pass
  // patchBounds(): it pads by 5% + 0.01deg to widen a data SEARCH, which
  // measured 12% oversize and ~5 km of NW shift when used as the block's own
  // footprint. Returns { texture, uv, attribution, tiles, zoom } or null when
  // the patch isn't covered. Never throws: a failed layer leaves the map usable.
  async build(bbox) {
    const id = ++this._buildId
    const provider = providerFor(bbox)
    if (!provider) return null

    const z = aerialZoomFor(bbox, { budgetPx: this._budgetPx, maxZoom: provider.maxZoom })
    const tiles = tilesForBBox(bbox, z)
    if (!tiles.length) return null

    const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y)
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    const cols = Math.max(...xs) - x0 + 1, rows = Math.max(...ys) - y0 + 1

    const canvas = document.createElement('canvas')
    canvas.width = cols * TILE_PX
    canvas.height = rows * TILE_PX
    const ctx = canvas.getContext('2d')

    // One failed tile must not fail the patch — a hole in the mosaic beats no
    // imagery at all, and providers do 404 on edge tiles.
    let ok = 0
    await Promise.all(
      tiles.map(async (t) => {
        try {
          const img = await loadImage(provider.url(t.z, t.x, t.y))
          if (id !== this._buildId) return // a newer patch superseded us
          ctx.drawImage(img, (t.x - x0) * TILE_PX, (t.y - y0) * TILE_PX)
          ok++
        } catch {}
      })
    )
    // Being superseded is NORMAL — the user moved or rezoomed while tiles were
    // in flight — and it must be reported as its own thing. It used to share
    // `null` with real failure, so a caller that reacts to failure (by warning
    // the user and switching the layer off) fired on every ordinary race.
    if (id !== this._buildId) return SUPERSEDED
    if (!ok) return null

    const uv = aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z))

    this.dispose()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    this._texture = texture

    return { texture, uv, attribution: provider.attribution, tiles: tiles.length, zoom: z, provider: provider.id }
  }

  dispose() {
    this._texture?.dispose()
    this._texture = null
  }
}

// --- placing the mosaic on the block -----------------------------------------
// The composited canvas covers the TILE GRID, which always overhangs the patch
// (tiles are a fixed grid; the patch lands wherever it lands). Stretching the
// whole mosaic across the block would misregister the photo against the terrain
// by up to a tile — roads landing in fields. So the shader gets an explicit
// offset/scale instead.
//
// The maths is done in NORMALISED MERCATOR (0..1 over the whole world), not in
// lat/lon: slippy tiles are exactly mercator squares, and the DEM patch maps
// linearly to mercator too, so in that space the transform is a plain
// offset+scale. In lat/lon it would not be — mercator latitude is non-linear,
// and doing it there would skew the imagery north-south.

// lon/lat -> normalised mercator (0..1, y growing southward like tile rows)
export function lonLatToMerc(lon, lat) {
  const r = (lat * Math.PI) / 180
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2,
  }
}

// Slippy tile grid -> its normalised-mercator bounds. Tile x/y ARE those
// coordinates scaled by 2^z, so this is just a division — no projection.
function tileGridMerc(x0, y0, cols, rows, z) {
  const n = 2 ** z
  return { minX: x0 / n, maxX: (x0 + cols) / n, minY: y0 / n, maxY: (y0 + rows) / n }
}

// UV transform mapping the block's own 0..1 surface coords onto the mosaic.
// Exported and pure so it can be unit-tested without a GPU or a network.
export function aerialUvTransform(patchBBox, gridMerc) {
  const a = lonLatToMerc(patchBBox.minLon, patchBBox.maxLat) // patch top-left
  const b = lonLatToMerc(patchBBox.maxLon, patchBBox.minLat) // patch bottom-right
  const gw = gridMerc.maxX - gridMerc.minX
  const gh = gridMerc.maxY - gridMerc.minY
  return {
    offset: [(a.x - gridMerc.minX) / gw, (a.y - gridMerc.minY) / gh],
    scale: [(b.x - a.x) / gw, (b.y - a.y) / gh],
  }
}

// crossOrigin is mandatory: IGN sends Access-Control-Allow-Origin: * (verified
// live), and without the flag the canvas is tainted and WebGL refuses it.
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
