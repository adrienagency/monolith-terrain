import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayer } from './geo-data.js'
import { pickPlaces } from './place-pick.js'
import { makeLabelTexture, labelInk } from './text-label.js'
import { labelScale } from './place-scale.js'

const HALF = TERRAIN_SIZE / 2
// World units the label floats above the city's OWN ground point. It does NOT
// need to clear the patch's highest summit: the sprite is depthTest:false, so it
// is always drawn over the relief and can never sink into rock. Anchoring to the
// city's own GPS/terrain height keeps the name visually attached to its city
// instead of hovering absurdly high over a distant peak.
const CLEARANCE = 0.9
// Screen-space label height for scale 1. With sizeAttenuation:false the sprite
// scale is in CLIP units, not world units — 2.0 spans the whole viewport height —
// so a readable ~16 px name on a ~900 px viewport needs a small value here.
// (0.09 rendered names at roughly a sixth of the screen.)
const BASE_H = 0.013
// padding added around a label's projected screen rect before the overlap test —
// keeps names from touching even when their boxes just barely clear each other
const DECLUTTER_PAD_PX = 3

export class PlacesLayer {
  constructor(scene, camera = null) {
    this.group = new THREE.Group()
    this.group.name = 'places'
    scene.add(this.group)
    this.meshes = []
    this._buildId = 0
    this.camera = camera
    // per-entry bookkeeping kept across rebuilds so refresh() can re-run just
    // the screen-space visibility pass without touching geometry
    this._entries = []
  }
  setCamera(camera) { this.camera = camera }
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
    this._entries = []
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
    const sizeMul = params.placesSize ?? 1
    const halo = params.placesHalo ? ink.halo : null
    const dotGeo = new THREE.CircleGeometry(0.075, 12); dotGeo.rotateX(-Math.PI / 2)
    const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.85, depthWrite: false, depthTest: false })
    const leaderMat = new THREE.LineBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.55, depthWrite: false, depthTest: false })

    for (const p of picks) {
      const groundY = terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0
      const labelY = groundY + CLEARANCE
      const scale = labelScale(p.pop, p.cap) * sizeMul

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
      const { tex, aspect } = makeLabelTexture(p.name.toUpperCase(), { color: ink.color, halo, weight: p.cap ? 700 : 500 })
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }))
      sprite.material.sizeAttenuation = false
      sprite.scale.set(BASE_H * scale * aspect, BASE_H * scale, 1)
      sprite.position.set(p.w.x, labelY, p.w.z)
      sprite.renderOrder = 30
      this.group.add(sprite); this.meshes.push(sprite)

      // keep pop-desc order (picks order) — the declutter pass below is greedy
      // biggest-first, and refresh() re-walks this same array every tick
      this._entries.push({ dot, leader, sprite })
    }
    this.group.visible = true
    this._declutter()
  }
  // Screen-space declutter: project each label's world anchor with the current
  // camera and reject (hide) any whose padded screen rect overlaps a label
  // already accepted, walking `this._entries` in pop-desc order (biggest
  // cities win). Falls back to "show everything" when there's no camera yet —
  // the world-space minDist spacing in pickPlaces already thinned things out.
  _declutter() {
    const camera = this.camera
    if (!this._entries.length) return
    if (!camera) {
      for (const e of this._entries) { e.sprite.visible = true; e.dot.visible = true; e.leader.visible = true }
      return
    }
    const vw = window.innerWidth, vh = window.innerHeight
    const accepted = []
    const ndc = new THREE.Vector3()
    for (const e of this._entries) {
      ndc.copy(e.sprite.position).project(camera)
      if (ndc.z > 1) { e.sprite.visible = false; e.dot.visible = false; e.leader.visible = false; continue }
      const cx = (ndc.x * 0.5 + 0.5) * vw
      const cy = (1 - (ndc.y * 0.5 + 0.5)) * vh
      const w = (e.sprite.scale.x / 2) * vw + DECLUTTER_PAD_PX
      const h = (e.sprite.scale.y / 2) * vh + DECLUTTER_PAD_PX
      const rect = { left: cx - w, right: cx + w, top: cy - h, bottom: cy + h }
      const overlaps = accepted.some((r) => rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top)
      const visible = !overlaps
      e.sprite.visible = visible
      e.dot.visible = visible
      e.leader.visible = visible
      if (visible) accepted.push(rect)
    }
  }
  // Re-runs ONLY the visibility pass (no geometry rebuild) — call this from the
  // render loop, throttled, so the declutter stays correct as the camera moves.
  refresh() {
    if (!this.group.visible || !this._entries.length) return
    this._declutter()
  }
  setVisible(v) { this.group.visible = v }
  dispose() { this._clear() }
}
