// Fetch the tiles of a tiled Overture layer (water, lakes, …) covering a
// patch, in parallel, and merge into one FeatureCollection. Mirrors
// loadLayer's cache+never-throw contract in geo-data.js: a missing tile
// (404, or any fetch failure) is treated as an empty tile, never an error.
// Features are deduped by `properties.id` because the build scripts
// (build-water-tiles.mjs, build-world-lake-tiles.mjs) duplicate a feature
// into every tile its bbox intersects rather than clipping geometry at tile
// borders.
//
// `makeTileSource(kind)` is the one implementation shared by every tiled
// layer — `kind` is the `public/data/<kind>/` folder name. Each kind gets its
// own cache (a `z/x/y` key from one tile-set says nothing about another's
// data at that same key), but otherwise they share every byte of
// fetch/cache/dedupe/manifest logic.
import { tilesForBBox } from './tile-index.js'

// ⚠️ PLAFOND DE REQUÊTES SIMULTANÉES — SANS LUI, TOUT ÉCHOUE D'UN COUP.
//
// `loadTiles` faisait `Promise.all` sur TOUTES les tuiles couvrant l'emprise,
// sans aucune borne. Le navigateur a une limite de connexions ; au-delà il rend
// `net::ERR_INSUFFICIENT_RESOURCES` — et il la rend pour la MAJORITÉ du lot, pas
// pour le surplus. Le chargeur traite un échec comme une tuile vide (contrat
// « ne lève jamais »), donc la carte se dessine SANS SON EAU, en silence.
//
// Mesuré le 2026-08-20 à Madagascar, tuiles z8 :
//
//     bloc z4 (7 117 km) → 2 548 tuiles d'un coup   ← ce que le navigateur refuse
//     bloc z5 (3 558 km) →   650
//     bloc z6 (1 779 km) →   169
//     bloc z8   (445 km) →    16
//
// Le défaut dormait : la plongée atterrissait sur z5 et 650 passait de justesse.
// La Tâche 1b l'a réveillé en rendant la plongée continue — elle atterrit
// désormais sur le niveau qui correspond à l'altitude, donc parfois z4.
//
// Le compteur est MODULE, pas par source : la limite du navigateur est globale,
// et l'eau, les lacs et les autres couches tuilées la partagent.
const MAX_SIMULTANE = 24
let enVol = 0
const enAttente = []

function prendCreneau() {
  if (enVol < MAX_SIMULTANE) {
    enVol++
    return Promise.resolve()
  }
  return new Promise((libere) => enAttente.push(libere))
}

// Le créneau passe au suivant SANS repasser par zéro : décrémenter puis
// réincrémenter laisserait une fenêtre où un troisième appelant s'insère.
function rendCreneau() {
  const suivant = enAttente.shift()
  if (suivant) suivant()
  else enVol--
}

// exposé pour les tests — le compteur en vol, jamais lu par la production
export const _enVol = () => enVol

function makeTileSource(kind) {
  const cache = new Map()
  let manifestPromise = null

  function fetchTile(z, x, y) {
    const key = `${z}/${x}/${y}`
    if (!cache.has(key)) {
      cache.set(
        key,
        prendCreneau()
          .then(() => fetch(`data/${kind}/${key}.json`))
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .finally(rendCreneau)
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

// PLUS de `road-tiles` : le calque Routes a quitté le site, sa source tuilée
// n'a plus d'appelant. Aucune tuile routière n'a jamais été versionnée ici, il
// n'y a donc rien à nettoyer côté données.

// World lake layer (task 19): lake-only, global coverage, no region gate —
// unlike water tiles this kind is fetched everywhere on Earth, not just
// inside WATER_REGION. Same fetch/cache/dedupe contract, own cache under
// public/data/lake-tiles/ so a z/x/y key never collides with water's tile at
// the same coordinates (different tileZoom scheme entirely, see
// LAKE_LOD_LEVELS in tile-index.js).
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
export const _clearCache = () => { _water.clearCache(); _lake.clearCache() }
