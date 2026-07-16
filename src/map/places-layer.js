import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayer } from './geo-data.js'
import { pickPlaces } from './place-pick.js'
import { makeLabelTexture, labelInk, labelFontReady } from './text-label.js'
import { labelScale, placeTier } from './place-scale.js'

const HALF = TERRAIN_SIZE / 2
// World units the label floats above the city's OWN ground point. Anchored to
// the city's own GPS/terrain height so the name stays visually attached to
// its city instead of hovering absurdly high over a distant peak.
// NOTE: sprite/dot/leader are depthTest:true (relief must occlude a name
// sitting behind a ridge — see the Map task on hiding city names behind
// mountains), so a label whose anchor sits just behind a summit at this
// clearance WILL be cut by the terrain. That is intentional: only labels for
// cities actually visible from the current camera should read.
const CLEARANCE = 0.9
// Screen-space label height for scale 1, in CLIP units (sizeAttenuation:false),
// NOT world units. Careful: the on-screen size is NOT scale/2*viewport — Three's
// sprite shader multiplies scale by -mvPosition.z to cancel the perspective
// divide, so the real NDC size is projectionMatrix[0]*scale.x by
// projectionMatrix[5]*scale.y. At this app's 30° fov that factor is 1/tan(15°)
// ≈ 3.7, i.e. labels render ~3.7x bigger than the naive formula suggests — the
// trap that made earlier passes ship names far larger than intended.
// 0.007 puts a small town near 8.5 px cap-height and a capital near 14 px.
const BASE_H = 0.007
// Real screen size of a sprite quad, in CSS px — see the BASE_H note above.
function spriteScreenSize(sprite, camera, vw, vh) {
  const P = camera.projectionMatrix.elements
  return { w: Math.abs(P[0] * sprite.scale.x) / 2 * vw, h: Math.abs(P[5] * sprite.scale.y) / 2 * vh }
}
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
    const [rows] = await Promise.all([loadLayer('places'), labelFontReady()])
    if (id !== this._buildId || dem !== terrain.dem || !Array.isArray(rows)) return

    const zoom = params.demZoom ?? 8
    const density = params.placesDensity ?? 1
    // These caps are a coarse world-space PRE-filter that runs before the
    // precise screen-space declutter below (_declutter() / spriteScreenSize()).
    // They used to be tuned against cities5000 truncated to the top 40k by
    // population (~12k-pop floor, sparse). Now that places.json is the full,
    // untruncated cities1000 set (~1k-pop floor), a real patch has far more
    // zoom-eligible rows — measured ~150-200 eligible rows in dense metros
    // (Paris, the Ruhr) at zoom 9 vs. ~20-70 before. With the old caps
    // (maxN 26, minDist 0.085*TERRAIN_SIZE ≈ 14km real-world at z9) minDist
    // alone discarded ~75% of eligible rows before declutter ever saw them —
    // e.g. Paris z9 kept only 7 of 26 zoom+maxN-eligible picks, silently
    // dropping real, distinct suburb towns (Boulogne-Billancourt, Nanterre,
    // Versailles, Saint-Denis...) because they sat within 14km of central
    // Paris, not because they visually overlapped its label on screen.
    // minDist is tightened (~0.02-0.06, ≈2-7km real-world depending on zoom)
    // so it only catches near-duplicate rows (e.g. GeoNames listing several
    // Paris arrondissements a couple km apart as separate PPL rows), and
    // maxN is raised so dense-metro patches have enough headroom to fill
    // out the picks — the actual "is this label visually too close to
    // another" decision is left entirely to the screen-space declutter pass,
    // which already measures real projected pixel rects and is unaffected
    // by this change.
    const maxN = Math.round((zoom >= 13 ? 90 : zoom >= 11 ? 60 : zoom >= 9 ? 40 : zoom >= 7 ? 24 : 12) * density)
    const minDist = TERRAIN_SIZE * (zoom >= 12 ? 0.02 : zoom >= 10 ? 0.03 : zoom >= 9 ? 0.04 : 0.06)
    const picks = pickPlaces(rows, { zoom, toWorld: (lat, lon) => latLonToWorld(dem, lat, lon), halfLimit: HALF * 0.96, maxN, minDist })
    if (!picks.length) return

    const sizeMul = params.placesSize ?? 1
    const dotGeo = new THREE.CircleGeometry(0.075, 12); dotGeo.rotateX(-Math.PI / 2)

    for (const p of picks) {
      const groundY = terrain.sample ? terrain.sample(p.w.x, p.w.z) : 0
      const labelY = groundY + CLEARANCE
      const scale = labelScale(p.pop, p.cap) * sizeMul
      // shared with labelScale's tier so a place's colour darkness always
      // tracks the same importance ranking that picks its size
      const ink = labelInk(params.darkMode, placeTier(p.pop))
      const halo = params.placesHalo ? ink.halo : null

      // ground dot, anchored at the city's real elevation. depthTest:true so
      // relief occludes it exactly like the label above it — a dot behind a
      // ridge must disappear along with its name, not float free of it.
      const dot = new THREE.Mesh(dotGeo.clone(), new THREE.MeshBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.85, depthWrite: false, depthTest: true }))
      dot.position.set(p.w.x, groundY + 0.05, p.w.z)
      dot.renderOrder = 29
      this.group.add(dot); this.meshes.push(dot)

      // thin leader line from the ground dot up to just below the floating label
      const leaderGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p.w.x, groundY + 0.05, p.w.z),
        new THREE.Vector3(p.w.x, labelY - BASE_H * scale * 0.5, p.w.z),
      ])
      const leader = new THREE.Line(leaderGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(ink.color), transparent: true, opacity: 0.55, depthWrite: false, depthTest: true }))
      leader.renderOrder = 29
      this.group.add(leader); this.meshes.push(leader)

      // upright billboard sprite. depthTest:true so a name behind a ridge is
      // genuinely hidden by the relief — previously depthTest:false let city
      // names read straight through mountains, which is the bug this fixes.
      // Still never shrinks away when zoomed out (sizeAttenuation:false,
      // screen-space scale).
      // 800/700, the top of Bricolage's real 200..800 axis — the names read too
      // thin at 600/700 and the ask was to bolden them, NOT to enlarge them.
      const { tex, aspect } = makeLabelTexture(p.name.toUpperCase(), { color: ink.color, halo, weight: p.cap ? 800 : 700 })
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false }))
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
      const s = spriteScreenSize(e.sprite, camera, vw, vh)
      const w = s.w / 2 + DECLUTTER_PAD_PX
      const h = s.h / 2 + DECLUTTER_PAD_PX
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
