import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines, fetchOverpassAreas } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock, blockOutline, clipPolygonToBlock } from './block-clip.js'
import { OSM_MIN_ZOOM } from './roads-layer.js'
import { riverWidthPx } from './river-width.js'
import { WATER_REGION, inRegion, lodForZoom, tileZoomForLod } from './tile-index.js'
import { loadWaterTiles, loadWaterTileManifest, hasTilesForLod } from './tile-loader.js'

// Lakes render above every other map layer, in a distinctly more saturated
// blue than the general water ink — an explicit user request ("je tiens
// vraiment à ce que les lacs apparaissent au dessus de tout le reste, en
// bleu assez visible"). renderOrder 26 clears roads (20) and the general
// water fill (17); depthTest is disabled on lake meshes/lines specifically
// (mirrors the always-on-top city-label sprites in places-layer.js) so a
// lake never gets hidden behind a draped road or another water body at
// nearly the same elevation.
const LAKE_RENDER_ORDER = 26

// Filled water-body mesh: clip the ring's XZ contour to the block footprint
// BEFORE triangulating (Sutherland-Hodgman against the slab outline), drape
// each vertex on the relief. Clipping before triangulation — rather than
// dropping triangles by centroid after — is required because
// THREE.ShapeUtils.triangulateShape emits triangles spanning the interior; a
// post-hoc centroid filter punches holes in lakes instead of trimming the
// ring to the boundary. `outline` is the convex slab polygon from
// blockOutline(fp), computed once per rebuild by the caller.
// Shared by the OSM water-area fill (rivers/lakes at OSM zoom) and the Natural
// Earth lakes fill (waterFill option) — one triangulate/drape implementation.
function _buildFilledRing(ringLatLon, dem, sample, outline, fp, insideBlock) {
  if (ringLatLon.length < 4) return null
  const pts = latlonToWorldPts(ringLatLon, dem, latLonToWorld)
  if (pts.length < 3) return null
  const clipped = clipPolygonToBlock(pts, outline)
  if (clipped.length < 3) return null
  const contour = clipped.map((p) => new THREE.Vector2(p.x, p.z))
  const tris = THREE.ShapeUtils.triangulateShape(contour, [])
  if (!tris.length) return null
  const positions = new Float32Array(clipped.length * 3)
  for (let i = 0; i < clipped.length; i++) {
    positions[i * 3] = clipped[i].x
    positions[i * 3 + 1] = sample(clipped[i].x, clipped[i].z) + 0.06
    positions[i * 3 + 2] = clipped[i].z
  }
  const index = []
  for (const [a, b, c] of tris) {
    // Slab containment is already guaranteed by the Sutherland-Hodgman clip
    // above (the outline is convex, so SH is exact). Region mode's mask is
    // arbitrary/concave, so SH doesn't apply to it — fall back to the old
    // per-triangle centroid test against insideBlock (slab+region) for that
    // part only; the region mask stays approximate, as it was before this fix.
    if (fp.regionOn) {
      const cx = (clipped[a].x + clipped[b].x + clipped[c].x) / 3
      const cz = (clipped[a].z + clipped[b].z + clipped[c].z) / 3
      if (!insideBlock(cx, cz)) continue
    }
    index.push(a, b, c)
  }
  if (!index.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

// Shared fill-material spec for draped water-body meshes (OSM areas + NE/tile
// lakes). `depthTest: false` is used for the lake-specific material so lakes
// stay visible above everything else (see LAKE_RENDER_ORDER above).
function _fillMaterial(ink, opacity, { depthTest = true } = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(ink),
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
}

function ringsOf(g) {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
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
  // Natural Earth line rings for a static layer (lakes/coastline)
  async _neRings(name, bounds, zoom) {
    const fc = await loadLayer(name)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const r of ringsOf(f.geometry)) if (r.length >= 2) out.push(r)
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
      for (const r of ringsOf(f.geometry)) if (r.length >= 2) out.push({ ring: r, strokeweight })
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
    let areaRings = null
    let osmOk = false
    if (useOsm) {
      this.loading = true
      const [feats, areas] = await Promise.all([
        fetchOverpassLines(bounds, 'water'),
        fetchOverpassAreas(bounds),
      ])
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { riverEntries = feats.map((f) => ({ ring: f.coords, strokeweight: undefined })); osmOk = true }
      // area fetch is best-effort: failure/throttle just means no filled polygons, lines still render
      if (areas) areaRings = areas.map((a) => a.ring)
    }
    if (!riverEntries) riverEntries = await this._neRiverRings(bounds, zoom)

    // Lakes + other water areas: tiled Overture data when the patch sits
    // inside the covered region AND tiles actually exist for this LOD;
    // otherwise fall back to Natural Earth exactly as before (the rest of
    // the world must keep working exactly as now — NE's `lakes` layer is a
    // coverage problem, not a precision one, but it's the only thing we
    // have outside the built region). Tile-sourced `lake` features get the
    // special "on top, vivid blue" treatment below; every other kept
    // subtype (river/water/canal/pond/reservoir) merges into `areaRings`,
    // the same bucket Overpass water AREAs already feed.
    let lakeRings
    let tileOk = false
    if (inRegion(bounds, WATER_REGION)) {
      const manifest = await loadWaterTileManifest()
      const lod = lodForZoom(zoom)
      if (hasTilesForLod(manifest, lod)) {
        const tileFC = await loadWaterTiles(bounds, tileZoomForLod(lod))
        if (id !== this._buildId || dem !== terrain.dem) return
        const tileFeats = clipToPatch(tileFC.features, bounds)
        const tileLakeRings = []
        const tileAreaRings = []
        for (const f of tileFeats) {
          const rings = ringsOf(f.geometry)
          if (f.properties?.subtype === 'lake') tileLakeRings.push(...rings)
          else tileAreaRings.push(...rings)
        }
        lakeRings = tileLakeRings
        if (tileAreaRings.length) areaRings = [...(areaRings || []), ...tileAreaRings]
        tileOk = true
      }
    }
    if (!tileOk) lakeRings = await this._neRings('lakes', bounds, zoom)

    const coastRings = await this._neRings('coastline', bounds, zoom)
    if (id !== this._buildId || dem !== terrain.dem) return
    // Overture's base/water theme is derived from OSM (ODbL) same as the
    // Overpass paths, so rendering tile-sourced water requires the same
    // "© OpenStreetMap contributors" credit — refreshOsmCredit() in main.js
    // reads this flag.
    this.usingOsm = osmOk || tileOk

    const fp = terrain.blockFootprint(); const insideBlock = makeInsideBlock(fp)
    // Computed once per rebuild (depends only on fp) and shared by every
    // filled-ring build below — see _buildFilledRing.
    const outline = blockOutline(fp)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#7fb2d6' : '#2b7fc4'
    // Lakes get a distinctly more saturated blue than the general water ink
    // in both themes — "en bleu assez visible" — while still respecting the
    // existing dark-mode ink flip.
    const lakeInk = params.darkMode ? '#63d1ff' : '#0f6fd6'
    const casing = params.darkMode ? 'rgba(15,17,20,0.5)' : 'rgba(252,250,246,0.6)'
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
      { runs: clipAll(lakeRings), widthPx: 1.4, color: lakeInk, order: LAKE_RENDER_ORDER },
      { runs: clipAll(coastRings), widthPx: 1.2, color: ink, order: 18 },
    ]
    for (const g of groups) {
      if (!g.runs.length) continue
      const obj = buildLineSegments(g.runs, sample, { color: g.color, casing, widthPx: g.widthPx, offset: 0.07, renderOrder: g.order, resolution })
      const onTop = g.order === LAKE_RENDER_ORDER
      obj.traverse((o) => { if (o.material) { o.material.opacity = params.waterOpacity ?? 0.9; if (onTop) o.material.depthTest = false } })
      this.group.add(obj)
    }

    // Lakes & seas fill option: filled draped polygons instead of outline-only.
    // Covers both the OSM water AREAs (riverbanks/lake bodies/seas at OSM zoom,
    // real varying width) and the Natural Earth `lakes` polygons (always
    // available, coarser). Outlines above still render either way, for
    // definition; when the option is off, water renders exactly as before
    // (outline-only).
    if (params.waterFill) {
      const fillOpacity = params.waterOpacity ?? 0.9
      if (areaRings && areaRings.length) {
        const areaMaterial = _fillMaterial(ink, fillOpacity)
        for (const ring of areaRings) {
          const geo = _buildFilledRing(ring, dem, sample, outline, fp, insideBlock)
          if (!geo) continue
          const mesh = new THREE.Mesh(geo, areaMaterial)
          mesh.renderOrder = 17
          this.group.add(mesh)
        }
      }
      if (lakeRings.length) {
        // Lakes above everything else, in a clearly-visible blue —
        // LAKE_RENDER_ORDER + depthTest:false (see the constant and
        // _fillMaterial above).
        const lakeMaterial = _fillMaterial(lakeInk, fillOpacity, { depthTest: false })
        for (const ring of lakeRings) {
          const geo = _buildFilledRing(ring, dem, sample, outline, fp, insideBlock)
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
