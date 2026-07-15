import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineObject } from './line-object.js'

// flatten any GeoJSON line/polygon geometry to a list of coordinate rings ([[lon,lat],...])
function ringsOf(g) {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

export class WaterLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'water'
    scene.add(this.group)
    this._buildId = 0
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async _addLayer(name, { dem, params, ink, casing, widthPx, resolution, sample }) {
    const fc = await loadLayer(name)
    if (!fc) return null
    const feats = filterByZoom(clipToPatch(fc.features, patchBounds(dem)), params.demZoom ?? 8)
    const objs = []
    for (const f of feats) {
      for (const ring of ringsOf(f.geometry)) {
        if (!ring || ring.length < 2) continue
        const pts = latlonToWorldPts(ring, dem, latLonToWorld)
        objs.push(buildLineObject(pts, sample, { color: ink, casing, widthPx, offset: 0.07, renderOrder: 18, resolution }))
      }
    }
    return objs
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') return
    const ink = params.darkMode ? '#8fb7cf' : '#4d7fa6'
    const casing = params.darkMode ? 'rgba(15,17,20,0.5)' : 'rgba(252,250,246,0.6)'
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const base = { dem, terrain, params, ink, casing, resolution, sample }
    const groups = await Promise.all([
      this._addLayer('rivers', { ...base, widthPx: 1.4 }),
      this._addLayer('lakes', { ...base, widthPx: 1.2 }),
      this._addLayer('coastline', { ...base, widthPx: 1.2 }),
    ])
    if (id !== this._buildId || dem !== terrain.dem) {
      for (const objs of groups) if (objs) for (const o of objs) o.traverse((m) => { if (m.isLine2) { m.geometry.dispose(); m.material.dispose() } })
      return
    }
    for (const objs of groups) if (objs) for (const o of objs) { o.traverse((m) => { if (m.material) m.material.opacity = params.waterOpacity ?? 0.9 }); this.group.add(o) }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
