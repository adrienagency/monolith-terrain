import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'
import { OSM_MIN_ZOOM } from './roads-layer.js'
import { riverWidthPx } from './river-width.js'

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
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
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
    let osmOk = false
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'water')
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { riverEntries = feats.map((f) => ({ ring: f.coords, strokeweight: undefined })); osmOk = true }
    }
    if (!riverEntries) riverEntries = await this._neRiverRings(bounds, zoom)
    // lakes + coastline: always Natural Earth
    const lakeRings = await this._neRings('lakes', bounds, zoom)
    const coastRings = await this._neRings('coastline', bounds, zoom)
    if (id !== this._buildId || dem !== terrain.dem) return
    this.usingOsm = osmOk

    const fp = terrain.blockFootprint(); const insideBlock = makeInsideBlock(fp)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#7fb2d6' : '#2b7fc4'
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
      ...[...riverBuckets.entries()].map(([widthPx, rings]) => ({ runs: clipAll(rings), widthPx })),
      { runs: clipAll(lakeRings), widthPx: 1.2 },
      { runs: clipAll(coastRings), widthPx: 1.2 },
    ]
    for (const g of groups) {
      if (!g.runs.length) continue
      const obj = buildLineSegments(g.runs, sample, { color: ink, casing, widthPx: g.widthPx, offset: 0.07, renderOrder: 18, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.waterOpacity ?? 0.9 })
      this.group.add(obj)
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
