import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines, fetchOverpassAreas } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock, blockOutline, triangulateAndClip } from './block-clip.js'
import { OSM_MIN_ZOOM } from './roads-layer.js'
import { riverWidthPx } from './river-width.js'
import { WATER_REGION, LAKE_LOD_LEVELS, inRegion, lodForZoom, tileZoomForLod } from './tile-index.js'
import { loadWaterTiles, loadWaterTileManifest, loadLakeTiles, loadLakeTileManifest, hasTilesForLod } from './tile-loader.js'

// Client-side waterway-kind filter for the zoomed Overpass waterway LINES
// (fetchOverpassLines(bounds, 'water') below). The Overpass query itself
// stays the bare `way["waterway"]` tag test on purpose — DO NOT turn this
// into a `["waterway"~"^(river|riverbank)$"]` regex predicate. Regex
// predicates make Overpass scan every way in the bbox instead of hitting the
// tag index (the exact failure mode documented for roads in overpass.js's
// comment on roadHighwayFilter: a filtered predicate measured a 504 against
// the live public API on a dense bbox, while the bare tag returned in <1s).
// So filtering happens here instead, client-side, after parseOverpass has
// already run — cheap, and it can't take the whole layer down with a 504.
//
// Product requirement (Adrien, verbatim): "on retire les torrents, et les
// cours d'eau, on ne garde que points d'eau, les lacs, les mares, les
// fleuves et les rivières." Alpine torrents are almost always tagged
// waterway=stream in OSM (occasionally a nonstandard waterway=torrent);
// keeping only `river` and `riverbank` drops those along with every other
// minor/artificial watercourse tag (brook/ditch/drain/canal/pressurised/…),
// leaving just the named rivers the requirement asks for. Lakes/ponds are a
// separate code path entirely (the AREA fetch below + the tiled/NE lake
// layers), unaffected by this filter.
const RIVER_WATERWAY_KINDS = new Set(['river', 'riverbank'])
export function filterRiverwayLines(feats) {
  return feats.filter((f) => RIVER_WATERWAY_KINDS.has(f.kind))
}

// Lakes render above every other DRAPED MAP LAYER (roads, rivers, contours,
// the general water fill), in a distinctly more saturated blue than the
// general water ink — an explicit user request ("je tiens vraiment à ce que
// les lacs apparaissent au dessus de tout le reste, en bleu assez visible").
// renderOrder 26 clears roads (20) and the general water fill (17), and
// polygonOffset (in _fillMaterial / line-segments.js) breaks ties among
// draped layers sitting at nearly the same world height. depthTest stays ON
// (true) for lakes exactly like every other layer, though: the terrain mesh
// itself must still occlude a lake behind a mountain, or the mountain reads
// as transparent. The two are not in tension — renderOrder+polygonOffset
// settle ordering AMONG draped layers, while depthTest keeps the terrain
// (a separate, non-draped surface) opaque against all of them.
const LAKE_RENDER_ORDER = 26

// Triangulate a polygon "part" (one outer ring + its holes, in GeoJSON
// lon/lat) and drape it onto the terrain, clipped to the block footprint.
//
// Order matters here: triangulate the ORIGINAL outer+holes shape first (see
// triangulateAndClip in block-clip.js for why), THEN clip each resulting
// triangle to the block outline and fan-triangulate what's left. Clipping
// per-triangle instead of clipping the whole ring up front is what keeps a
// concave river polygon that leaves and re-enters the block from growing a
// bogus filled bridge across the gap (see block-clip.js's doc comment on
// triangulateAndClip). Holes (islands) are passed straight to earcut so
// they're never filled in as water in the first place.
//
// `part` is `{ outer, holes }`, both GeoJSON lon/lat rings (holes may be
// empty/omitted). `outline` is blockOutline(fp), computed once per rebuild
// by the caller. Shared by the OSM water-area fill (rivers/lakes at OSM
// zoom) and the Natural Earth / Overture-tile lakes fill (waterFill option)
// — one triangulate/clip/drape implementation.
// The single height a lake surface sits at: the MEDIAN of the terrain samples
// under its vertices. Median, not mean or min: most vertices sample the water
// surface itself (the DEM sees lake level there), while a handful land on the
// shore slope where the polygon and the DEM disagree about the waterline —
// those outliers must not drag the level up the hill (mean) or down into a
// DEM pit (min). Exported for tests.
export function waterLevelOf(heights) {
  if (!heights.length) return 0
  const s = [...heights].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// `flat`: lakes pass true — a lake is a LEVEL PLANE, so every vertex gets the
// part's single water level. Draping each vertex at terrain height (the old
// behaviour, still right for rivers, which genuinely follow the ground) made
// any shoreline overlap CLIMB the hillside: blue paint running up a mountain,
// reported as "on voit les lacs a travers les montagnes". Flat, the same
// overlap disappears INTO the slope and the terrain occludes it — which is
// what a real shore does.
function _buildFilledRing(part, dem, sample, outline, fp, insideBlock, flat = false) {
  if (!part?.outer || part.outer.length < 4) return null
  const outerPts = latlonToWorldPts(part.outer, dem, latLonToWorld)
  if (outerPts.length < 3) return null
  const holePts = (part.holes || [])
    .filter((h) => h.length >= 4)
    .map((h) => latlonToWorldPts(h, dem, latLonToWorld))
    .filter((h) => h.length >= 3)

  const clippedTris = triangulateAndClip(outerPts, holePts, outline)
  if (!clippedTris.length) return null

  const positions = []
  const index = []
  for (const poly of clippedTris) {
    // clipPolygonToBlock (used inside triangulateAndClip) returns a closed
    // ring; drop the duplicate closing vertex before fan-triangulating.
    const open =
      poly.length > 1 && poly[0].x === poly[poly.length - 1].x && poly[0].z === poly[poly.length - 1].z
        ? poly.slice(0, -1)
        : poly
    if (open.length < 3) continue
    // Region mode's mask is arbitrary/concave, so Sutherland-Hodgman doesn't
    // apply to it — fall back to a centroid test against insideBlock (which
    // composes slab + region), same approximation as before this fix, just
    // applied per output triangle-polygon instead of per whole ring. Slab
    // containment itself is already guaranteed by the per-triangle clip
    // above, so this check only matters when a region cutout is active.
    if (fp.regionOn) {
      let cx = 0, cz = 0
      for (const p of open) { cx += p.x; cz += p.z }
      cx /= open.length; cz /= open.length
      if (!insideBlock(cx, cz)) continue
    }
    const base = positions.length / 3
    for (const p of open) positions.push(p.x, sample(p.x, p.z) + 0.06, p.z)
    for (let k = 1; k < open.length - 1; k++) index.push(base, base + k, base + k + 1)
  }
  if (!index.length) return null
  if (flat) {
    // one level for the whole part — collected from the heights already draped
    const heights = []
    for (let i = 1; i < positions.length; i += 3) heights.push(positions[i])
    const level = waterLevelOf(heights)
    for (let i = 1; i < positions.length; i += 3) positions[i] = level
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

// Shared fill-material spec for draped water-body meshes (OSM areas + NE/tile
// lakes). depthTest is always ON: the terrain must occlude water like any
// other geometry (see LAKE_RENDER_ORDER above for how lakes still win
// against other draped layers without it).
function _fillMaterial(ink, opacity) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(ink),
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
}

// Flat list of every ring in a geometry — outer rings AND holes alike — for
// LINE/outline rendering, where each boundary (including an island's
// shoreline inside a lake) is legitimately its own line loop.
//
// Do NOT use this for fill (see polygonPartsOf below): a GeoJSON `Polygon`'s
// coordinates are `[outer, hole1, hole2, …]`, and treating every hole as
// though it were its own outer ring — which is what this function
// necessarily does — is exactly the "water is drawn where there is none"
// bug: every island inside a lake/river got filled in solid.
function flatRingsOf(g) {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

// Polygon "parts" — `{ outer, holes }` — for FILL rendering, preserving
// GeoJSON polygon structure so holes can be excluded correctly (see
// _buildFilledRing / triangulateAndClip). A `Polygon` is one part; a
// `MultiPolygon` is several independent parts, each with its own holes.
// Non-polygon geometry (lines) can't be filled and yields nothing.
function polygonPartsOf(g) {
  if (!g) return []
  if (g.type === 'Polygon') return g.coordinates.length ? [{ outer: g.coordinates[0], holes: g.coordinates.slice(1) }] : []
  if (g.type === 'MultiPolygon') return g.coordinates.filter((p) => p.length).map((p) => ({ outer: p[0], holes: p.slice(1) }))
  return []
}

export class WaterLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'water'; scene.add(this.group)
    this._buildId = 0; this.usingOsm = false; this.loading = false
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2 || o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  // Natural Earth line rings for a static layer (lakes/coastline) — flat,
  // outline-only (see flatRingsOf).
  async _neRings(name, bounds, zoom) {
    const fc = await loadLayer(name)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const r of flatRingsOf(f.geometry)) if (r.length >= 2) out.push(r)
    return out
  }
  // Natural Earth polygon parts for a static layer, preserving holes — for
  // fill rendering only (see polygonPartsOf).
  async _neParts(name, bounds, zoom) {
    const fc = await loadLayer(name)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const part of polygonPartsOf(f.geometry)) out.push(part)
    return out
  }
  // Natural Earth river rings, each tagged with its source feature's
  // strokeweight so the caller can bucket runs by on-screen width.
  async _neRiverRings(bounds, zoom) {
    const fc = await loadLayer('rivers')
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
      const strokeweight = f.properties?.strokeweight
      for (const r of flatRingsOf(f.geometry)) if (r.length >= 2) out.push({ ring: r, strokeweight })
    }
    return out
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // rivers: OSM waterways when zoomed in, else NE river centerlines. Each
    // entry carries its source strokeweight (OSM ways have none, so they
    // fall back to riverWidthPx's default) so widths can vary per feature.
    let riverEntries = null
    let areaParts = null
    let osmOk = false
    if (useOsm) {
      this.loading = true
      const [feats, areas] = await Promise.all([
        fetchOverpassLines(bounds, 'water'),
        fetchOverpassAreas(bounds),
      ])
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { riverEntries = filterRiverwayLines(feats).map((f) => ({ ring: f.coords, strokeweight: undefined })); osmOk = true }
      // area fetch is best-effort: failure/throttle just means no filled polygons, lines still render.
      // Overpass areas never carry holes (parseOverpassAreas ignores inner members for v1).
      if (areas) areaParts = areas.map((a) => ({ outer: a.ring, holes: [] }))
    }
    if (!riverEntries) riverEntries = await this._neRiverRings(bounds, zoom)

    // Lakes + other water areas: tiled Overture data when the patch sits
    // inside the covered region AND tiles actually exist for this LOD;
    // otherwise fall back to Natural Earth exactly as before (the rest of
    // the world must keep working exactly as now — NE's `lakes` layer is a
    // coverage problem, not a precision one, but it's the only thing we
    // have outside the built region). Tile-sourced `lake` features get the
    // special "on top, vivid blue" treatment below; every other kept
    // subtype (river/water/canal/pond/reservoir) merges into `areaParts`,
    // the same bucket Overpass water AREAs already feed. `lakeLines` is the
    // flat (holes-as-loops) ring list used for outline drawing; `lakeParts`
    // preserves outer+hole structure for fill (islands must not be filled).
    let lakeLines
    let lakeParts
    let tileOk = false
    if (inRegion(bounds, WATER_REGION)) {
      const manifest = await loadWaterTileManifest()
      const lod = lodForZoom(zoom)
      if (hasTilesForLod(manifest, lod)) {
        const tileFC = await loadWaterTiles(bounds, tileZoomForLod(lod))
        if (id !== this._buildId || dem !== terrain.dem) return
        const tileFeats = clipToPatch(tileFC.features, bounds)
        const tileLakeLines = []
        const tileLakeParts = []
        const tileAreaParts = []
        for (const f of tileFeats) {
          if (f.properties?.subtype === 'lake') {
            tileLakeLines.push(...flatRingsOf(f.geometry))
            tileLakeParts.push(...polygonPartsOf(f.geometry))
          } else {
            tileAreaParts.push(...polygonPartsOf(f.geometry))
          }
        }
        lakeLines = tileLakeLines
        lakeParts = tileLakeParts
        if (tileAreaParts.length) areaParts = [...(areaParts || []), ...tileAreaParts]
        tileOk = true
      }
    }
    // World lake layer (task 19): OUTSIDE the rich-water Alps region (or, on
    // the rare edge where inRegion is true but that LOD's Alps tiles are
    // missing), fall back to the WORLD lake-only tile set instead of jumping
    // straight to Natural Earth. This is what actually fixes the coverage
    // gap NE has everywhere outside the Alps box (1345 lakes worldwide, 3 in
    // all of France) — composition is: in-region = rich water (river/canal/
    // pond/reservoir/water) + lakes from the Alps tiles; out-of-region =
    // lakes ONLY (no river/canal/etc — the world tile set never carries
    // those subtypes) + Natural Earth for coastline (unchanged, below). No
    // region gate here on purpose: LAKE_LOD_LEVELS tiles are written GLOBALLY,
    // so every patch on Earth is eligible, not just ones near the built area.
    let worldLakeOk = false
    if (!tileOk) {
      const lakeManifest = await loadLakeTileManifest()
      const lakeLod = lodForZoom(zoom, LAKE_LOD_LEVELS)
      if (hasTilesForLod(lakeManifest, lakeLod)) {
        const lakeFC = await loadLakeTiles(bounds, tileZoomForLod(lakeLod, LAKE_LOD_LEVELS))
        if (id !== this._buildId || dem !== terrain.dem) return
        const lakeFeats = clipToPatch(lakeFC.features, bounds)
        const worldLakeLines = []
        const worldLakeParts = []
        for (const f of lakeFeats) {
          worldLakeLines.push(...flatRingsOf(f.geometry))
          worldLakeParts.push(...polygonPartsOf(f.geometry))
        }
        lakeLines = worldLakeLines
        lakeParts = worldLakeParts
        worldLakeOk = true
      }
    }
    // Last-resort fallback: neither the Alps tile set nor the world lake
    // tile set had anything for this LOD/patch (e.g. world lake tiles not
    // yet built) — degrade to Natural Earth exactly as before this task.
    if (!tileOk && !worldLakeOk) {
      lakeLines = await this._neRings('lakes', bounds, zoom)
      lakeParts = await this._neParts('lakes', bounds, zoom)
    }

    // Coastline OUTLINE — off by default (params.coastLine). It comes from the
    // same Natural Earth 1:10m source whose coarseness got the NE lakes layer
    // replaced: drawn over a coast, its straight chords visibly cut corners the
    // terrain and bathymetry underneath already render correctly, so the map
    // reads better with no outline at all than with a wrong one. Kept behind
    // the flag rather than deleted — the rings are still fetched only when it's
    // on, so leaving it off costs nothing.
    const coastRings = params.coastLine ? await this._neRings('coastline', bounds, zoom) : []
    if (id !== this._buildId || dem !== terrain.dem) return
    // Overture's base/water theme is derived from OSM (ODbL) same as the
    // Overpass paths, so rendering tile-sourced water — Alps rich-water tiles
    // OR world lake-only tiles, same theme/license — requires the same
    // "© OpenStreetMap contributors" credit — refreshOsmCredit() in main.js
    // reads this flag.
    this.usingOsm = osmOk || tileOk || worldLakeOk

    const fp = terrain.blockFootprint(); const insideBlock = makeInsideBlock(fp)
    // Computed once per rebuild (depends only on fp) and shared by every
    // filled-ring build below — see _buildFilledRing / triangulateAndClip.
    const outline = blockOutline(fp)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#7fb2d6' : '#2b7fc4'
    // Lakes get a distinctly more saturated blue than the general water ink
    // in both themes — "en bleu assez visible" — while still respecting the
    // existing dark-mode ink flip.
    const lakeInk = params.darkMode ? '#63d1ff' : '#0f6fd6'
    const clipAll = (ringList) => { const runs = []; for (const r of ringList) { const pts = latlonToWorldPts(r, dem, latLonToWorld); runs.push(...clipPolylineToBlock(pts, insideBlock, fp.regionOn ? 0.3 : 0.6)) } return runs }

    // LineSegments2 batches one width per draw call, so per-feature width
    // variation means bucketing river rings by rounded on-screen width (1
    // decimal) and building one batch per bucket — a handful of draw calls
    // instead of one, but rivers actually render thick-to-thin.
    const riverBuckets = new Map()
    for (const { ring, strokeweight } of riverEntries) {
      const w = Math.round(riverWidthPx(strokeweight) * 10) / 10
      if (!riverBuckets.has(w)) riverBuckets.set(w, [])
      riverBuckets.get(w).push(ring)
    }

    const groups = [
      ...[...riverBuckets.entries()].map(([widthPx, rings]) => ({ runs: clipAll(rings), widthPx, color: ink, order: 18 })),
      // lake outline: on top of everything, vivid blue — matches the lake fill below
      { runs: clipAll(lakeLines), widthPx: 1.4, color: lakeInk, order: LAKE_RENDER_ORDER },
      { runs: clipAll(coastRings), widthPx: 1.2, color: ink, order: 18 },
    ]
    for (const g of groups) {
      if (!g.runs.length) continue
      const obj = buildLineSegments(g.runs, sample, { color: g.color, widthPx: g.widthPx, offset: 0.07, renderOrder: g.order, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.waterOpacity ?? 0.9 })
      this.group.add(obj)
    }

    // Lakes & seas fill option: filled draped polygons instead of outline-only.
    // Covers both the OSM water AREAs (riverbanks/lake bodies/seas at OSM zoom,
    // real varying width) and the Natural Earth `lakes` / Overture-tile
    // polygons (always available, coarser off-region). Outlines above still
    // render either way, for definition; when the option is off, water
    // renders exactly as before (outline-only).
    if (params.waterFill) {
      const fillOpacity = params.waterOpacity ?? 0.9
      if (areaParts && areaParts.length) {
        const areaMaterial = _fillMaterial(ink, fillOpacity)
        for (const part of areaParts) {
          const geo = _buildFilledRing(part, dem, sample, outline, fp, insideBlock)
          if (!geo) continue
          const mesh = new THREE.Mesh(geo, areaMaterial)
          mesh.renderOrder = 17
          this.group.add(mesh)
        }
      }
      if (lakeParts.length) {
        // Lakes above everything else, in a clearly-visible blue —
        // LAKE_RENDER_ORDER + polygonOffset (see the constant and
        // _fillMaterial above). depthTest stays on: the terrain still
        // occludes the lake behind a mountain.
        const lakeMaterial = _fillMaterial(lakeInk, fillOpacity)
        for (const part of lakeParts) {
          const geo = _buildFilledRing(part, dem, sample, outline, fp, insideBlock, true)
          if (!geo) continue
          const mesh = new THREE.Mesh(geo, lakeMaterial)
          mesh.renderOrder = LAKE_RENDER_ORDER
          this.group.add(mesh)
        }
      }
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
