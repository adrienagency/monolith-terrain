import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'
import { roadRank, relativeTiers, tierDepth } from './road-tier.js'

export const OSM_MIN_ZOOM = 12 // at/above this demZoom, roads come from full-detail OSM

const STYLE = { motorway: { widthPx: 2.6 }, primary: { widthPx: 1.8 }, secondary: { widthPx: 1.1 } }
// Relative tier (0 = most important class PRESENT in the patch) → weight class.
function tierClass(tier) {
  return tier === 0 ? 'motorway' : tier === 1 ? 'primary' : 'secondary'
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
    // the detail notch pulls full-OSM roads from further out: crank detail → OSM
    // kicks in at a lower zoom, so more road detail is visible when zoomed back.
    const osmThreshold = params.roadsDetail >= 3 ? 10 : params.roadsDetail >= 2 ? 11 : 12
    const useOsm = zoom >= osmThreshold

    // gather rings as {coords:[lon,lat][], rank} from the chosen tier
    let rings = null
    let osmOk = false
    if (useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'roads', { detail: params.roadsDetail })
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { rings = feats.map((f) => ({ coords: f.coords, rank: roadRank(f.kind) })); osmOk = true }
    }
    if (!rings) { // Natural Earth tier (or OSM failed → fallback)
      const fc = await loadLayer('roads')
      if (id !== this._buildId || dem !== terrain.dem || !fc) return
      rings = []
      for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
        const rs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
        for (const r of rs) rings.push({ coords: r, rank: f.properties.scalerank ?? 9 })
      }
    }
    this.usingOsm = osmOk

    // Tiers are RELATIVE to whatever ranks are actually present in this patch:
    // whatever the most important class present is becomes tier 0, so a valley
    // with no motorway still renders its nationals at the heaviest weight
    // instead of the patch coming back empty.
    const tiers = relativeTiers(rings.map((r) => r.rank))
    const depth = tierDepth(params.roadsDetail)
    rings = rings.filter((r) => tiers.get(r.rank) < depth)

    const fp = terrain.blockFootprint(); const insideBlock = makeInsideBlock(fp)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    const ink = params.roadColor || (params.darkMode ? '#d9c7b0' : '#3a3128')
    const casing = params.roadsCasing === false ? null : (params.darkMode ? 'rgba(15,17,20,0.6)' : 'rgba(252,250,246,0.7)')
    // clip every ring to the block, bucket runs by weight class
    const byClass = { motorway: [], primary: [], secondary: [] }
    for (const r of rings) {
      const pts = latlonToWorldPts(r.coords, dem, latLonToWorld)
      const runs = clipPolylineToBlock(pts, insideBlock, fp.regionOn ? 0.3 : 0.6)
      if (runs.length) byClass[tierClass(tiers.get(r.rank))].push(...runs)
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
