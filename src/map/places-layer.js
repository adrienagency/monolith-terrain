import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayer } from './geo-data.js'
import { pickPlaces } from './place-pick.js'
import { makeLabelTexture, labelInk } from './text-label.js'

const HALF = TERRAIN_SIZE / 2

export class PlacesLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'places'
    scene.add(this.group)
    this.meshes = []
    this._buildId = 0
  }
  _clear() {
    for (const m of this.meshes) { m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); this.group.remove(m) }
    this.meshes = []
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.placesEnabled || !dem || params.source !== 'real') return
    const rows = await loadLayer('places')
    if (id !== this._buildId || dem !== terrain.dem || !Array.isArray(rows)) return

    const zoom = params.demZoom ?? 8
    const density = params.placesDensity ?? 1
    const maxN = Math.round((zoom >= 13 ? 60 : zoom >= 11 ? 40 : zoom >= 9 ? 26 : zoom >= 7 ? 16 : 10) * density)
    const minDist = TERRAIN_SIZE * (zoom >= 12 ? 0.035 : zoom >= 10 ? 0.05 : 0.085)
    const picks = pickPlaces(rows, { zoom, toWorld: (lat, lon) => latLonToWorld(dem, lat, lon), halfLimit: HALF * 0.96, maxN, minDist })
    if (!picks.length) return

    const ink = labelInk(params.darkMode)
    const dotGeo = new THREE.CircleGeometry(0.075, 12); dotGeo.rotateX(-Math.PI / 2)
    for (const p of picks) {
      const y = (terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0) + 0.06
      const dot = new THREE.Mesh(dotGeo.clone(), new THREE.MeshBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.85, depthWrite: false, depthTest: true }))
      dot.position.set(p.w.x, y, p.w.z); dot.renderOrder = 22
      this.group.add(dot); this.meshes.push(dot)

      const { tex, aspect } = makeLabelTexture(p.name.toUpperCase(), { color: ink.color, halo: ink.halo, weight: p.cap ? 700 : 500 })
      const w = Math.min(6, (p.cap ? 0.34 : 0.3) * p.name.length + 0.9)
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / aspect), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false, depthTest: true }))
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(p.w.x, y + 0.02, p.w.z - 0.28 - (w / aspect) * 0.5)
      mesh.renderOrder = 22
      this.group.add(mesh); this.meshes.push(mesh)
    }
    this.group.visible = true
  }
  setVisible(v) { this.group.visible = v }
  dispose() { this._clear() }
}
