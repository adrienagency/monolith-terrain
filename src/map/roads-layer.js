import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineObject } from './line-object.js'

// road class → ink colour + screen width (px). Motorways read boldest.
const STYLE = {
  motorway: { widthPx: 2.6 },
  primary: { widthPx: 1.8 },
  secondary: { widthPx: 1.1 },
}

export class RoadsLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'roads'
    scene.add(this.group)
    this._buildId = 0
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.roadsEnabled || !dem || params.source !== 'real') return
    const fc = await loadLayer('roads')
    if (id !== this._buildId || dem !== terrain.dem || !fc) return
    const bounds = patchBounds(dem)
    const feats = filterByZoom(clipToPatch(fc.features, bounds), params.demZoom ?? 8)
    const ink = params.darkMode ? '#d9c7b0' : '#3a3128'
    const casing = params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)'
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    for (const f of feats) {
      const style = STYLE[f.properties.kind] || STYLE.primary
      const rings = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
      for (const ring of rings) {
        const pts = latlonToWorldPts(ring, dem, latLonToWorld)
        const obj = buildLineObject(pts, sample, { color: ink, casing, widthPx: style.widthPx, offset: 0.08, renderOrder: 20, resolution })
        obj.traverse((o) => { if (o.material) o.material.opacity = (params.roadsOpacity ?? 0.9) })
        this.group.add(obj)
      }
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
