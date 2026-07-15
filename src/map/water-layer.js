import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'
import { OSM_MIN_ZOOM } from './roads-layer.js'

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
  // Natural Earth line rings for a static layer (lakes/coastline, and rivers when NE)
  async _neRings(name, bounds, zoom) {
    const fc = await loadLayer(name)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const r of ringsOf(f.geometry)) if (r.length >= 2) out.push(r)
    return out
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // rivers: OSM waterways when zoomed in, else NE river centerlines
    let riverRings = null
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'water')
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) riverRings = feats.map((f) => f.coords)
    }
    if (!riverRings) riverRings = await this._neRings('rivers', bounds, zoom)
    // lakes + coastline: always Natural Earth
    const lakeRings = await this._neRings('lakes', bounds, zoom)
    const coastRings = await this._neRings('coastline', bounds, zoom)
    if (id !== this._buildId || dem !== terrain.dem) return
    this.usingOsm = useOsm && riverRings != null

    const insideBlock = makeInsideBlock(terrain.blockFootprint())
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#8fb7cf' : '#4d7fa6'
    const casing = params.darkMode ? 'rgba(15,17,20,0.5)' : 'rgba(252,250,246,0.6)'
    const clipAll = (ringList) => { const runs = []; for (const r of ringList) { const pts = latlonToWorldPts(r, dem, latLonToWorld); runs.push(...clipPolylineToBlock(pts, insideBlock)) } return runs }

    const groups = [
      { runs: clipAll(riverRings), widthPx: 1.4 },
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
