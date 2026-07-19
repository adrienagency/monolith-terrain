// Aerial photo skin for the terrain — a FIRST, DELIBERATELY NARROW TEST:
// IGN orthophotos, Annecy only, off by default.
//
// Why so narrow: the real open question isn't technical, it's whether
// photography belongs in a product whose identity is the quiet editorial
// relief (hypsometric palettes, fine contours, marble/sand materials). One
// area on real terrain answers that far better than a provider framework
// nobody has looked at yet. Widening = one more entry in PROVIDERS plus its
// verified licence; see docs/superpowers/plans/2026-07-17-aerial-imagery.md.
//
// Nothing is stored. Tiles are fetched per view straight from IGN's public
// WMTS — measured 1.1-3.4 MB for a view, 0 bytes deployed. The 887 MB
// road-tile lesson was about data we HOST; this hosts nothing.
//
// LICENCES — verified live, do not swap a source in without checking yours:
//   IGN BD ORTHO ....... Licence Ouverte Etalab 2.0, commercial OK, no API
//                        key, Access-Control-Allow-Origin: * (required — a
//                        tainted canvas can't become a WebGL texture).
//   EOX s2cloudless .... BANNED. Its own licence page states commercial use
//                        needs a paid EOX licence. (A claim that the 2016
//                        vintage is CC BY 4.0 could NOT be confirmed on that
//                        page — don't rely on it without written proof.)
//   Esri World Imagery . BANNED. Grants no rights outside three ArcGIS cases.
//   NASA Blue Marble ... public domain, cloud-free, ~500 m/px — the natural
//                        far-zoom tier when this grows past one city.
import * as THREE from 'three'
import { tilesForBBox } from './tile-index.js'

const TILE_PX = 256
// Cap on the composited texture. 2048 keeps a 24 km patch near 12 m/px on
// screen (~64 tiles, ~1.1 MB) and stays inside every WebGL2 device's
// guaranteed limit. Raising it multiplies fetches AND VRAM quadratically —
// re-measure both before touching it.
const MAX_TEXTURE_PX = 2048

// Attribution is a LEGAL obligation under Etalab 2.0, not a courtesy. It must
// be visible whenever the imagery is, and gone when it isn't.
export const IGN_ATTRIBUTION = 'Orthophotos © IGN'

// The test area. A patch counts as covered when its CENTRE is inside — a
// block half-overlapping the box shouldn't flip to photo because one corner
// clips it; the user is looking at whatever sits in the middle.
const ANNECY = { minLon: 5.85, maxLon: 6.45, minLat: 45.65, maxLat: 46.05 }

const IGN_MAX_ZOOM = 19
const ignTileUrl = (z, x, y) =>
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
  `&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`

// Exported for tests: is this patch inside the covered area?
export function aerialCovers(bbox) {
  if (!bbox) return false
  const lon = (bbox.minLon + bbox.maxLon) / 2
  const lat = (bbox.minLat + bbox.maxLat) / 2
  return lon >= ANNECY.minLon && lon <= ANNECY.maxLon && lat >= ANNECY.minLat && lat <= ANNECY.maxLat
}

// Pick the imagery zoom whose tile grid just fills MAX_TEXTURE_PX across the
// patch — enough resolution to look sharp, no more (every extra zoom level
// quadruples the fetch count for detail the screen can't show).
export function aerialZoomFor(bbox, maxZoom = IGN_MAX_ZOOM) {
  for (let z = 6; z <= maxZoom; z++) {
    const n = tilesForBBox(bbox, z).length
    if (n * TILE_PX * TILE_PX >= MAX_TEXTURE_PX * MAX_TEXTURE_PX) return z
  }
  return maxZoom
}

export class AerialLayer {
  constructor() {
    this._texture = null
    this._buildId = 0
  }

  // Returns { texture, attribution, tiles, bytes } or null when the patch
  // isn't covered. Never throws: a failed layer must leave the map usable.
  async build(bbox) {
    const id = ++this._buildId
    if (!aerialCovers(bbox)) return null

    const z = aerialZoomFor(bbox)
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
          const img = await loadImage(ignTileUrl(t.z, t.x, t.y))
          if (id !== this._buildId) return // a newer patch superseded us
          ctx.drawImage(img, (t.x - x0) * TILE_PX, (t.y - y0) * TILE_PX)
          ok++
        } catch {}
      })
    )
    if (id !== this._buildId || !ok) return null

    const uv = aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z))

    this.dispose()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    this._texture = texture

    return { texture, uv, attribution: IGN_ATTRIBUTION, tiles: tiles.length, zoom: z }
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
