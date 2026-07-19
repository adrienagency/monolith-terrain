import { RoadsLayer } from './roads-layer.js'
import { WaterLayer } from './water-layer.js'
import { PlacesLayer } from './places-layer.js'

// Orchestrates the SP1 layers. Every layer builds from the same {dem,terrain,params}
// so a new zone/zoom (or a dark-mode/opacity change) is a single rebuild call.
// SP2 will inject an OSM DataProvider here without touching layer code.
export class MapLayers {
  constructor(scene, camera = null) {
    this.roads = new RoadsLayer(scene)
    this.water = new WaterLayer(scene)
    this.places = new PlacesLayer(scene, camera)
    this._layers = { roads: this.roads, water: this.water, places: this.places }
    this._surfaceVisible = true
  }
  // null-safe: places.refresh()/declutter fall back to "show everything" until
  // a camera is set
  setCamera(camera) { this.places.setCamera?.(camera) }
  async rebuild(ctx) {
    await Promise.all(Object.values(this._layers).map((l) => l.rebuild(ctx)))
    this.setSurfaceVisible(this._surfaceVisible)
  }
  setLayerVisible(id, v) { this._layers[id]?.setVisible(v && this._surfaceVisible) }
  setOpacity(id, v) { this._layers[id]?.setOpacity?.(v) }
  // the day cycle's sun, forwarded to whichever layers respond to light
  setSun(s) { this.water.setSun?.(s) }
  // SP2: OSM attribution (ODbL) + loading state, derived from the live layers
  isOsmActive() { return Object.values(this._layers).some((l) => l.usingOsm) }
  isLoading() { return Object.values(this._layers).some((l) => l.loading) }
  // keep fat-line screen-space widths correct after a viewport resize
  onResize(w, h) {
    for (const l of [this.roads, this.water]) l.group.traverse((o) => { if (o.material && o.material.isLineMaterial) o.material.resolution.set(w, h) })
  }
  // hide the whole set outside surface mode (globe/export)
  setSurfaceVisible(v) {
    this._surfaceVisible = v
    for (const l of Object.values(this._layers)) l.group.visible = v && l.group.children.length > 0
  }
  dispose() { for (const l of Object.values(this._layers)) l.dispose() }
}
