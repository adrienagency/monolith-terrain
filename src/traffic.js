// Ambient traffic over the map — two citizens of the diorama:
//  · small airliners, tinted with the current template's dominant colour, that
//    occasionally cross the scene through the cloud deck (1-in-5 roll every
//    few seconds, one plane at a time — discreet, the map stays the hero);
//  · a SpaceX pad watcher: when the loaded zone contains Starbase (Boca Chica)
//    or Kennedy LC-39A, a user-supplied Starship + launch-tower model appears
//    on the pad and lifts off from time to time.
//
// Models are fetched, not rebuilt:
//  · public/models/plane.glb — "Cesium_Air" from CesiumGS/cesium (Apache-2.0),
//    downloaded into the repo (see public/models/MODELS.md).
//  · public/models/starship.glb + tower.glb — OPTIONAL, user-supplied (free
//    Starship/Mechazilla models exist on Sketchfab et al. but sit behind
//    account walls, so we don't hotlink them). The watcher stays dormant
//    until the files exist.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld } from './geo.js'

const HALF = TERRAIN_SIZE / 2
const SPAWN_CHECK_S = 7 // roll the dice this often
const SPAWN_CHANCE = 1 / 5

// famous pads the watcher recognises (lat, lon)
const SPACEX_PADS = [
  { name: 'STARBASE — BOCA CHICA', lat: 25.9968, lon: -97.1554 },
  { name: 'KENNEDY LC-39A', lat: 28.6084, lon: -80.6043 },
]

export class Traffic {
  constructor(scene, terrain, params) {
    this.terrain = terrain
    this.params = params
    this.group = new THREE.Group()
    this.group.name = 'traffic'
    scene.add(this.group)
    this.loader = new GLTFLoader()

    this.planeProto = null
    this.plane = null // { obj, dir, speed, life }
    this.sinceRoll = 0

    this.pad = null // { obj, rocket, baseY, state, t }
    this.starshipProto = null
    this.towerProto = null

    // the airliner (Apache-2.0 Cesium sample model), normalised to ~1.7 units
    this.loader.load(
      'models/plane.glb',
      (gltf) => {
        const obj = gltf.scene
        const box = new THREE.Box3().setFromObject(obj)
        const size = box.getSize(new THREE.Vector3())
        const s = 1.7 / Math.max(size.x, size.y, size.z)
        obj.scale.setScalar(s)
        this.planeProto = obj
      },
      undefined,
      () => {} // missing model — planes simply never spawn
    )
    // optional user-supplied Starship + tower
    this.loader.load('models/starship.glb', (g) => (this.starshipProto = g.scene), undefined, () => {})
    this.loader.load('models/tower.glb', (g) => (this.towerProto = g.scene), undefined, () => {})
  }

  // dominant template colour: a strong mid-high ramp tint (falls back to ink)
  _dominantColor() {
    const stops = this.params.rampStops
    const hex = (stops && (stops[5]?.c || stops[4]?.c)) || this.params.contourColor || '#666666'
    return new THREE.Color(hex)
  }

  _spawnPlane() {
    if (!this.planeProto) return
    const obj = this.planeProto.clone(true)
    // tint every mesh with the template's dominant colour (cloned materials)
    const tint = this._dominantColor()
    obj.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone()
        if (n.material.color) n.material.color.copy(tint)
        n.material.map = null
      }
    })
    // cross the whole map on a random heading, inside the cloud band
    const ang = Math.random() * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang))
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const offset = (Math.random() * 2 - 1) * HALF * 0.6
    const start = dir
      .clone()
      .multiplyScalar(-(HALF + 8))
      .addScaledVector(side, offset)
    start.y = (this.params.cloudAltitude ?? 4.5) + 2 + Math.random() * 4
    obj.position.copy(start)
    obj.lookAt(start.clone().add(dir))
    this.group.add(obj)
    this.plane = { obj, dir, speed: 3.5 + Math.random() * 2.5, life: 0 }
  }

  // called after a DEM zone loads: shows the pad when a famous site is in view
  setZone(dem) {
    if (this.pad) {
      this.group.remove(this.pad.obj)
      this.pad = null
    }
    if (!dem || !this.starshipProto) return
    for (const pad of SPACEX_PADS) {
      const w = latLonToWorld(dem, pad.lat, pad.lon)
      if (Math.abs(w.x) > HALF * 0.95 || Math.abs(w.z) > HALF * 0.95) continue
      const root = new THREE.Group()
      // launch tower (Mechazilla) if supplied — normalised to ~3.2 units tall
      if (this.towerProto) {
        const tower = this.towerProto.clone(true)
        const tb = new THREE.Box3().setFromObject(tower)
        tower.scale.setScalar(3.2 / Math.max(tb.getSize(new THREE.Vector3()).y, 1e-3))
        tower.position.set(0.9, 0, 0)
        root.add(tower)
      }
      const rocket = this.starshipProto.clone(true)
      const rb = new THREE.Box3().setFromObject(rocket)
      rocket.scale.setScalar(2.8 / Math.max(rb.getSize(new THREE.Vector3()).y, 1e-3))
      root.add(rocket)
      const groundY = this.terrain.sample ? this.terrain.sample(w.x, w.z) : 0
      root.position.set(w.x, groundY, w.z)
      this.group.add(root)
      this.pad = { obj: root, rocket, baseY: groundY, state: 'idle', t: 0, wait: 15 + Math.random() * 25 }
      break
    }
  }

  update(dt) {
    // ---- airliners
    this.sinceRoll += dt
    if (!this.plane && this.planeProto && this.sinceRoll >= SPAWN_CHECK_S) {
      this.sinceRoll = 0
      if (Math.random() < SPAWN_CHANCE) this._spawnPlane()
    }
    if (this.plane) {
      const p = this.plane
      p.obj.position.addScaledVector(p.dir, p.speed * dt)
      p.life += dt
      const { x, z } = p.obj.position
      if (Math.abs(x) > HALF + 10 || Math.abs(z) > HALF + 10 || p.life > 60) {
        this.group.remove(p.obj)
        this.plane = null
      }
    }

    // ---- Starship launches
    if (this.pad) {
      const s = this.pad
      s.t += dt
      if (s.state === 'idle' && s.t > s.wait) {
        s.state = 'launch'
        s.t = 0
      } else if (s.state === 'launch') {
        // gentle quadratic ascent, slight downrange lean, gone past the deck
        const h = 2.2 * s.t * s.t
        s.rocket.position.y = h
        s.rocket.rotation.z = Math.min(0.12, s.t * 0.02)
        if (h > 26) {
          s.state = 'cooldown'
          s.t = 0
        }
      } else if (s.state === 'cooldown' && s.t > 10) {
        s.rocket.position.y = 0
        s.rocket.rotation.z = 0
        s.state = 'idle'
        s.t = 0
        s.wait = 20 + Math.random() * 30
      }
    }
  }

  setVisible(v) {
    this.group.visible = v
  }
}
