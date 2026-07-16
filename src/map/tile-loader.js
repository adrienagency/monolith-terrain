// Fetch the Overture water tiles covering a patch, in parallel, and merge
// into one FeatureCollection. Mirrors loadLayer's cache+never-throw contract
// in geo-data.js: a missing tile (404, or any fetch failure) is treated as
// an empty tile, never an error. Features are deduped by `properties.id`
// because build-water-tiles.mjs duplicates a feature into every tile its
// bbox intersects (see that script) rather than clipping geometry at tile
// borders.
import { tilesForBBox } from './tile-index.js'

const _cache = new Map()

function fetchTile(z, x, y) {
  const key = `${z}/${x}/${y}`
  if (!_cache.has(key)) {
    _cache.set(
      key,
      fetch(`data/water-tiles/${key}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  }
  return _cache.get(key)
}

// Fetch every tile covering `bbox` at `tileZoom`, merge, dedupe by feature id.
// Never throws — a totally-empty region (all tiles 404) resolves to an empty
// FeatureCollection.
export async function loadWaterTiles(bbox, tileZoom) {
  const tiles = tilesForBBox(bbox, tileZoom)
  const fcs = await Promise.all(tiles.map((t) => fetchTile(t.z, t.x, t.y)))
  const seen = new Set()
  const features = []
  for (const fc of fcs) {
    if (!fc || !Array.isArray(fc.features)) continue
    for (const f of fc.features) {
      const id = f.properties?.id
      if (id != null) {
        if (seen.has(id)) continue
        seen.add(id)
      }
      features.push(f)
    }
  }
  return { type: 'FeatureCollection', features }
}

// Manifest (public/data/water-tiles/index.json): region bbox, release, the
// LOD->tilezoom map, and per-LOD tile count + bytes. Fetched once and
// cached — the client uses it to know what exists rather than guessing (and
// to skip fetching tiles for a LOD that has none, e.g. before the region is
// built at all). Never throws: a missing manifest just means "no tiles".
let _manifestPromise = null
export function loadWaterTileManifest() {
  if (!_manifestPromise) {
    _manifestPromise = fetch('data/water-tiles/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  return _manifestPromise
}

// Whether the manifest actually has any tiles written for this LOD (a bare
// `tiles: 0` entry, e.g. from a future LOD not yet built, counts as none).
export function hasTilesForLod(manifest, lod) {
  if (!manifest || !Array.isArray(manifest.lods)) return false
  const entry = manifest.lods.find((l) => l.lod === lod)
  return !!entry && entry.tiles > 0
}

// exposed for tests
export const _clearCache = () => { _cache.clear(); _manifestPromise = null }
