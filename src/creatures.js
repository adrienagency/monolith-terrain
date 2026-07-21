// Underwater life — fish that wander the sea and a whale that surfaces now and
// then. Appears only when the animated sea is on AND there is real sea in the
// block (a dry alpine valley gets nothing; a coastline gets a small
// population).
//
// COST, measured and deliberate: the two skinned models are lazy-loaded on the
// FIRST time the sea is enabled — a visitor who never turns the sea on
// downloads zero bytes of them. Optimised from studio assets (whale 109 MB ->
// 2.5 MB, fish 14 MB -> 2.7 MB: 256px webp textures, Draco geometry) so the
// pair is ~5 MB, the weight of one HDRI. Geometry is ~10k triangles each, and
// the population is tiny (a handful of fish, one whale), so per-frame cost is
// an AnimationMixer update and a few steering vectors — negligible.
//
// WHY A SYNTHETIC DEPTH: the DEM (AWS terrarium) has no bathymetry — it floors
// the seabed at sea level, so the sea is a flat LID with zero real volume
// underneath. Measured live at Nice: 53% of the block is under the sea sheet,
// but the deepest point is 3 cm below the surface. So we cannot read a depth
// to swim in; we INVENT one (SYNTH_DEPTH below the surface) and only place
// creatures where the sea sheet actually covers the ground (`_isWet`). The
// wetness test is queried live, so a zoom or a sea-level change never strands
// a fish on dry land.
//
// The fish move FREELY in 3D (the brief: "ils peuvent aller dans la direction
// qui leur convient"), wandering the synthetic water column with the wet
// footprint as their only horizontal fence. The whale cruises deep and
// occasionally rises to break the surface (its own Jump/breach animation)
// before diving back. Nothing is on a rail — it is boids-lite steering.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { TERRAIN_SIZE } from './terrain.js'

const HALF = TERRAIN_SIZE / 2
const CLEAR = 0.5 // keep this far under the surface
const SYNTH_DEPTH = 7 // invented water column below the sea sheet (world units)

export class Creatures {
  // sampleGround(x,z) → terrain height; getSeaY() → sea surface Y or null
  constructor(scene, { sampleGround, getSeaY }) {
    this.scene = scene
    this.sampleGround = sampleGround
    this.getSeaY = getSeaY

    this.group = new THREE.Group()
    this.group.name = 'creatures'
    this.group.visible = false
    scene.add(this.group)

    this.enabled = false
    this._loaded = false
    this._loading = false
    this.fish = [] // { obj, mixer, vel(Vector3), turnT, size }
    this.whale = null // { obj, mixer, state, t, vel, size, actions }
  }

  // Turned by main.js when the animated sea toggles. Loads on first real
  // enable, then just shows/hides — a cheap no-op while off.
  setEnabled(on) {
    this.enabled = on
    this.group.visible = on
    if (on && !this._loaded && !this._loading) this._load()
  }

  _load() {
    this._loading = true
    const loader = new GLTFLoader()
    // Draco: the assets were compressed with it; the decoder is the same CDN
    // three ships with. If it fails to fetch, the creatures simply never
    // appear — the map is never held hostage to a fish.
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    loader.setDRACOLoader(draco)

    const normalise = (obj, target) => {
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      obj.scale.setScalar(target / Math.max(size.x, size.y, size.z))
    }

    loader.load('models/fish.glb', (g) => {
      this._fishProto = g.scene
      this._fishAnims = g.animations
      normalise(this._fishProto, 1.1)
      if (this.enabled) this._spawnFish(5)
    }, undefined, () => {})

    loader.load('models/whale.glb', (g) => {
      this._whaleProto = g.scene
      this._whaleAnims = g.animations
      normalise(this._whaleProto, 7.0)
      this._loaded = true
      this._loading = false
      if (this.enabled) this._spawnWhale()
    }, undefined, () => { this._loading = false })
  }

  // Is the sea sheet over this point? (terrain at or below the surface.)
  _isWet(x, z) {
    const seaY = this.getSeaY?.()
    if (seaY == null) return false
    return (this.sampleGround?.(x, z) ?? 1e9) <= seaY + 0.08
  }

  // A random wet spot inside the block, or null. `area` demands a ring of
  // neighbours also be wet — a whale needs open water, not a puddle.
  _findWaterSpot(area = 0, tries = 40) {
    const seaY = this.getSeaY?.()
    if (seaY == null) return null
    for (let i = 0; i < tries; i++) {
      const x = (Math.random() * 2 - 1) * HALF * 0.8
      const z = (Math.random() * 2 - 1) * HALF * 0.8
      if (!this._isWet(x, z)) continue
      if (area > 0) {
        let ok = true
        for (const [dx, dz] of [[area, 0], [-area, 0], [0, area], [0, -area]]) if (!this._isWet(x + dx, z + dz)) { ok = false; break }
        if (!ok) continue
      }
      return { x, z, seaY }
    }
    return null
  }

  _spawnFish(n) {
    for (let i = 0; i < n; i++) {
      const spot = this._findWaterSpot()
      if (!spot) continue
      const obj = cloneSkinned(this._fishProto)
      const mixer = new THREE.AnimationMixer(obj)
      const clip = this._fishAnims.find((a) => /swim_B\d/.test(a.name)) ?? this._fishAnims[0]
      if (clip) mixer.clipAction(clip).play()
      mixer.timeScale = 0.8 + Math.random() * 0.6
      obj.position.set(spot.x, spot.seaY - CLEAR - Math.random() * (SYNTH_DEPTH - CLEAR), spot.z)
      const dir = new THREE.Vector3(Math.random() * 2 - 1, (Math.random() - 0.5) * 0.3, Math.random() * 2 - 1).normalize()
      this.group.add(obj)
      this.fish.push({ obj, mixer, vel: dir.multiplyScalar(1.6 + Math.random()), turnT: 0, size: 1.1 })
    }
  }

  _spawnWhale() {
    const spot = this._findWaterSpot(6) // wants open water around it
    if (!spot) return
    const obj = cloneSkinned(this._whaleProto)
    const mixer = new THREE.AnimationMixer(obj)
    const byName = (re) => this._whaleAnims.find((a) => re.test(a.name))
    const clip = (re) => { const c = byName(re); return c && mixer.clipAction(c) }
    const actions = { swim: clip(/Swim1/i), jump: clip(/Jump1/i), breathe: clip(/Breathe/i) }
    ;(actions.swim ?? actions.breathe)?.play()
    obj.position.set(spot.x, spot.seaY - SYNTH_DEPTH * 0.6, spot.z)
    this.group.add(obj)
    this.whale = { obj, mixer, actions, state: 'cruise', t: 6 + Math.random() * 8,
      vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(0.9), size: 7 }
  }

  // Steer a swimmer: wander a little, fence it into the synthetic water column
  // and keep it over wet ground. `lift` biases the vertical target (a breach
  // passes positive; a dive passes negative).
  _steer(c, dt, lift = 0) {
    const p = c.obj.position
    const seaY = this.getSeaY?.()
    if (seaY == null) return
    const floor = seaY - SYNTH_DEPTH, ceil = seaY - CLEAR

    // gentle wander: nudge heading around Y and pitch, occasionally
    c.turnT -= dt
    if (c.turnT <= 0) {
      c.turnT = 1.5 + Math.random() * 3
      const yaw = (Math.random() - 0.5) * 0.9
      const s = Math.sin(yaw), co = Math.cos(yaw)
      const vx = c.vel.x * co - c.vel.z * s, vz = c.vel.x * s + c.vel.z * co
      c.vel.set(vx, c.vel.y + (Math.random() - 0.5) * 0.35, vz)
    }
    // vertical fences (unless a breach is lifting past the surface)
    if (lift <= 0 && p.y > ceil - 0.5) c.vel.y -= (p.y - (ceil - 0.5)) * dt * 2
    if (p.y < floor + 0.5) c.vel.y += (floor + 0.5 - p.y) * dt * 2
    c.vel.y += lift * dt

    // horizontal fence: turn back toward the block centre when nearing the
    // edge OR when the water runs out ahead (about to swim onto land)
    const edge = HALF * 0.88
    if (Math.abs(p.x) > edge) c.vel.x -= Math.sign(p.x) * dt * 3
    if (Math.abs(p.z) > edge) c.vel.z -= Math.sign(p.z) * dt * 3
    const ahead = 2.5
    if (!this._isWet(p.x + Math.sign(c.vel.x) * ahead, p.z + Math.sign(c.vel.z) * ahead)) {
      c.vel.x -= p.x * dt * 0.6
      c.vel.z -= p.z * dt * 0.6
    }

    // clamp speed, advance, hard-clamp Y into the column (breach excepted)
    const maxS = c.size > 3 ? 2.2 : 3.0
    const speed = c.vel.length()
    if (speed > maxS) c.vel.multiplyScalar(maxS / speed)
    p.addScaledVector(c.vel, dt)
    if (lift <= 0) p.y = THREE.MathUtils.clamp(p.y, floor, ceil)
    else p.y = Math.max(p.y, floor)

    // face travel — the models look down +Z, so aim there
    if (c.vel.lengthSq() > 1e-4) { _look.copy(p).add(c.vel); c.obj.lookAt(_look) }
  }

  update(dt) {
    if (!this.enabled || !this._loaded) return
    const d = Math.min(dt, 0.05)
    for (const f of this.fish) { f.mixer.update(d); this._steer(f, d) }

    if (this.whale) {
      const w = this.whale
      w.mixer.update(d)
      w.t -= dt
      const seaY = this.getSeaY?.() ?? 0
      if (w.state === 'cruise') {
        this._steer(w, d)
        if (w.t <= 0) { w.state = 'rise'; w.t = 6; w.actions.jump?.reset().setLoop(THREE.LoopOnce).play(); if (w.actions.jump) w.actions.jump.clampWhenFinished = true }
      } else if (w.state === 'rise') {
        this._steer(w, d, 2.6) // lift toward + through the surface
        if (w.obj.position.y > seaY + w.size * 0.12 || w.t <= 0) { w.state = 'dive'; w.t = 8 }
      } else {
        this._steer(w, d, -1.6) // sink back into the column
        if (w.obj.position.y < seaY - SYNTH_DEPTH * 0.5 || w.t <= 0) { w.state = 'cruise'; w.t = 16 + Math.random() * 16; w.actions.swim?.reset().play() }
      }
    }
  }

  // A rebuild (zoom/pan/sea-level change) invalidates every spawn point —
  // clear and, if still enabled + loaded, re-seat everyone in the new sea.
  rebuild() {
    for (const f of this.fish) this.group.remove(f.obj)
    if (this.whale) this.group.remove(this.whale.obj)
    this.fish = []; this.whale = null
    if (this.enabled && this._loaded) { this._spawnFish(5); this._spawnWhale() }
  }

  dispose() { this.group.clear(); this.fish = []; this.whale = null }
}

const _look = new THREE.Vector3()
