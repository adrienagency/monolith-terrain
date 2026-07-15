import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'

export const OSM_MIN_ZOOM = 12 // at/above this demZoom, roads come from full-detail OSM

const STYLE = { motorway: { widthPx: 2.6 }, primary: { widthPx: 1.8 }, secondary: { widthPx: 1.1 } }
// OSM highway value → our 3 weight classes (keeps ALL roads, just styles them)
function roadClass(h = '') {
  if (/^(motorway|trunk)(_link)?$/.test(h)) return 'motorway'
  if (/^primary(_link)?$/.test(h)) return 'primary'
  return 'secondary'
}

export class RoadsLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'roads'; scene.add(this.group)
    this._buildId = 0; this.usingOsm = false; this.loading = false
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.roadsEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // gather rings as {coords:[lon,lat][], klass} from the chosen tier
    let rings = null
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'roads')
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) rings = feats.map((f) => ({ coords: f.coords, klass: roadClass(f.kind) }))
    }
    if (!rings) { // Natural Earth tier (or OSM failed → fallback)
      const fc = await loadLayer('roads')
      if (id !== this._buildId || dem !== terrain.dem || !fc) return
      rings = []
      for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
        const rs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
        for (const r of rs) rings.push({ coords: r, klass: f.properties.kind || 'secondary' })
      }
    }
    this.usingOsm = useOsm && rings != null

    const insideBlock = makeInsideBlock(terrain.blockFootprint())
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.darkMode ? '#d9c7b0' : '#3a3128'
    const casing = params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)'
    // clip every ring to the block, bucket runs by weight class
    const byClass = { motorway: [], primary: [], secondary: [] }
    for (const r of rings) {
      const pts = latlonToWorldPts(r.coords, dem, latLonToWorld)
      const runs = clipPolylineToBlock(pts, insideBlock)
      if (runs.length) (byClass[r.klass] || byClass.secondary).push(...runs)
    }
    for (const klass of Object.keys(byClass)) {
      if (!byClass[klass].length) continue
      const obj = buildLineSegments(byClass[klass], sample, { color: ink, casing, widthPx: STYLE[klass].widthPx, offset: 0.08, renderOrder: 20, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.roadsOpacity ?? 0.9 })
      this.group.add(obj)
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
