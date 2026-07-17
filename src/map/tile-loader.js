// Fetch the tiles of a tiled Overture layer (water, roads, …) covering a
// patch, in parallel, and merge into one FeatureCollection. Mirrors
// loadLayer's cache+never-throw contract in geo-data.js: a missing tile
// (404, or any fetch failure) is treated as an empty tile, never an error.
// Features are deduped by `properties.id` because the build scripts
// (build-water-tiles.mjs, build-road-tiles.mjs) duplicate a feature into
// every tile its bbox intersects rather than clipping geometry at tile
// borders.
//
// `makeTileSource(kind)` is the one implementation shared by every tiled
// layer — `kind` is the `public/data/<kind>/` folder name. Water and roads
// each get their own cache (a `z/x/y` key from one tile-set says nothing
// about the other's data at that same key), but otherwise share every byte
// of fetch/cache/dedupe/manifest logic.
import { tilesForBBox } from './tile-index.js'

function makeTileSource(kind) {
  const cache = new Map()
  let manifestPromise = null

  function fetchTile(z, x, y) {
    const key = `${z}/${x}/${y}`
    if (!cache.has(key)) {
      cache.set(
        key,
        fetch(`data/${kind}/${key}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    }
    return cache.get(key)
  }

  // Fetch every tile covering `bbox` at `tileZoom`, merge, dedupe by feature
  // id. Never throws — a totally-empty region (all tiles 404) resolves to an
  // empty FeatureCollection.
  async function loadTiles(bbox, tileZoom) {
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

  // Manifest (public/data/<kind>/index.json): region bbox, release, the
  // LOD->tilezoom map, and per-LOD tile count + bytes. Fetched once and
  // cached — the client uses it to know what exists rather than guessing
  // (and to skip fetching tiles for a LOD that has none, e.g. before the
  // region is built at all). Never throws: a missing manifest just means "no
  // tiles".
  function loadManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(`data/${kind}/index.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    }
    return manifestPromise
  }

  function clearCache() { cache.clear(); manifestPromise = null }

  return { loadTiles, loadManifest, clearCache }
}

const _water = makeTileSource('water-tiles')
export const loadWaterTiles = _water.loadTiles
export const loadWaterTileManifest = _water.loadManifest

const _road = makeTileSource('road-tiles')
export const loadRoadTiles = _road.loadTiles
export const loadRoadTileManifest = _road.loadManifest

// World lake layer (task 19): lake-only, global coverage, no region gate —
// unlike water/road tiles this kind is fetched everywhere on Earth, not just
// inside WATER_REGION. Same fetch/cache/dedupe contract, own cache under
// public/data/lake-tiles/ so a z/x/y key never collides with water's or
// road's tile at the same coordinates (different tileZoom scheme entirely,
// see LAKE_LOD_LEVELS in tile-index.js).
const _lake = makeTileSource('lake-tiles')
export const loadLakeTiles = _lake.loadTiles
export const loadLakeTileManifest = _lake.loadManifest

// Whether the manifest actually has any tiles written for this LOD (a bare
// `tiles: 0` entry, e.g. from a future LOD not yet built, counts as none).
// Shared by every tiled layer's manifest — the shape is the same regardless
// of `kind`.
export function hasTilesForLod(manifest, lod) {
  if (!manifest || !Array.isArray(manifest.lods)) return false
  const entry = manifest.lods.find((l) => l.lod === lod)
  return !!entry && entry.tiles > 0
}

// exposed for tests
export const _clearCache = () => { _water.clearCache(); _road.clearCache(); _lake.clearCache() }
