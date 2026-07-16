import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayer } from './geo-data.js'
import { pickPlaces } from './place-pick.js'
import { makeLabelTexture, labelInk } from './text-label.js'
import { labelScale } from './place-scale.js'

const HALF = TERRAIN_SIZE / 2
const CLEARANCE = 1.5 // world units the label floats above the taller of local ground / patch summit
const GRID = 24 // coarse sample grid used to find the patch's max terrain height
const BASE_H = 0.09 // screen-space label height (sizeAttenuation:false) for scale 1; width follows the texture's own aspect

export class PlacesLayer {
  constructor(scene) {
    this.group = new THREE.Group()
    this.group.name = 'places'
    scene.add(this.group)
    this.meshes = []
    this._buildId = 0
  }
  _clear() {
    for (const m of this.meshes) {
      this.group.remove(m)
      if (m.isSprite) {
        m.material.map?.dispose()
      } else {
        m.geometry.dispose()
      }
      m.material.dispose()
    }
    this.meshes = []
  }
  // Coarse scan of the terrain over the visible patch to find its highest point,
  // so labels can float above every summit rather than just their own city's spot.
  _patchMaxY(terrain) {
    if (!terrain.sample) return 0
    let maxY = 0
    for (let i = 0; i <= GRID; i++) {
      const x = -HALF + (TERRAIN_SIZE * i) / GRID
      for (let j = 0; j <= GRID; j++) {
        const z = -HALF + (TERRAIN_SIZE * j) / GRID
        const h = terrain.sample(x, z)
        if (h > maxY) maxY = h
      }
    }
    return maxY
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
    const patchMaxY = this._patchMaxY(terrain)
    const dotGeo = new THREE.CircleGeometry(0.075, 12); dotGeo.rotateX(-Math.PI / 2)
    const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })
    const leaderMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.55, depthWrite: false, depthTest: false })

    for (const p of picks) {
      const groundY = terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0
      const labelY = Math.max(groundY, patchMaxY) + CLEARANCE
      const scale = labelScale(p.pop, p.cap)

      // ground dot, anchored at the city's real elevation
      const dot = new THREE.Mesh(dotGeo.clone(), dotMat.clone())
      dot.position.set(p.w.x, groundY + 0.05, p.w.z)
      dot.renderOrder = 29
      this.group.add(dot); this.meshes.push(dot)

      // thin leader line from the ground dot up to just below the floating label
      const leaderGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.w.x, groundY + 0.05, p.w.z),
        new THREE.Vector3(p.w.x, labelY - BASE_H * scale * 0.5, p.w.z),
      ])
      const leader = new THREE.Line(leaderGeo, leaderMat.clone())
      leader.renderOrder = 29
      this.group.add(leader); this.meshes.push(leader)

      // upright billboard sprite — never occluded (depthTest:false) and never
      // shrinks away when zoomed out (sizeAttenuation:false, screen-space scale)
      const { tex, aspect } = makeLabelTexture(p.name.toUpperCase(), { color: ink.color, halo: ink.halo, weight: p.cap ? 700 : 500 })
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
      sprite.material.sizeAttenuation = false
      sprite.scale.set(BASE_H * scale * aspect, BASE_H * scale, 1)
      sprite.position.set(p.w.x, labelY, p.w.z)
      sprite.renderOrder = 30
      this.group.add(sprite); this.meshes.push(sprite)
    }
    this.group.visible = true
  }
  setVisible(v) { this.group.visible = v }
  dispose() { this._clear() }
}
