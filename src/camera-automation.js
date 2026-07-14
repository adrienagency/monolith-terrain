// Camera automations — a small library of cinematic camera moves that play on a
// loop over the current view, the kind of shots used in drone/architectural
// fly-throughs. They drive camera position + look target each frame relative to
// the pose the move STARTED from, so engaging one never jumps the view. A user
// grabbing the camera cancels the move.
//
// Moves (curated from standard cinematography — orbit, dolly, crane, boom, truck,
// plus a bounded fly-over so the camera stays over the zone and loops cleanly):
//   orbit      drone rotation around the map centre
//   reveal     orbit while slowly craning up and down
//   flyover    a slow Lissajous drift over the zone, looking down the travel
//   pushpull   dolly in and out (breathing zoom)
//   crane      boom straight up and back down, looking at the centre
//   pan        gentle lateral sweep left↔right around the centre

import * as THREE from 'three'

export const CAMERA_MOVES = [
  { id: 'orbit', label: 'Drone orbit' },
  { id: 'reveal', label: 'Orbit + rise (reveal)' },
  { id: 'flyover', label: 'Slow fly-over' },
  { id: 'pushpull', label: 'Push in / pull out' },
  { id: 'crane', label: 'Crane up' },
  { id: 'pan', label: 'Lateral pan' },
]

const clamp = THREE.MathUtils.clamp

export class CameraAutomation {
  constructor({ camera, controls }) {
    this.camera = camera
    this.controls = controls
    this.active = false
    this.move = 'orbit'
    this.speed = 1
    this.t = 0
    this._off = new THREE.Vector3()
    this._pos = new THREE.Vector3()
    this._tgt = new THREE.Vector3()
  }

  // capture the current pose as the base so the move eases out of where we are
  start(move = this.move, speed = this.speed) {
    this.move = move
    this.speed = speed
    this.t = 0
    this.target0 = this.controls.target.clone()
    const off = this.camera.position.clone().sub(this.controls.target)
    this.R = Math.max(off.length(), 1e-3)
    this.theta0 = Math.atan2(off.x, off.z) // azimuth around +y
    this.phi0 = Math.acos(clamp(off.y / this.R, -1, 1)) // polar from +y (small = top-down)
    this.active = true
  }

  stop() {
    this.active = false
  }

  setSpeed(s) {
    this.speed = s
  }

  // spherical offset → absolute position around `target`
  _place(target, R, phi, theta, outPos) {
    const sinp = Math.sin(phi)
    this._off.set(R * sinp * Math.sin(theta), R * Math.cos(phi), R * sinp * Math.cos(theta))
    outPos.copy(target).add(this._off)
  }

  update(dt) {
    if (!this.active) return
    this.t += dt * this.speed
    const t = this.t
    const T = this._tgt.copy(this.target0)
    const pos = this._pos

    switch (this.move) {
      case 'orbit': {
        // ~one revolution per 40s at speed 1
        this._place(T, this.R, this.phi0, this.theta0 + t * 0.157, pos)
        break
      }
      case 'reveal': {
        const phi = clamp(this.phi0 + Math.sin(t * 0.22) * 0.28, 0.12, 1.4)
        this._place(T, this.R * (1 + Math.sin(t * 0.16) * 0.06), phi, this.theta0 + t * 0.12, pos)
        break
      }
      case 'pushpull': {
        const R = this.R * (1 + Math.sin(t * 0.3) * 0.32)
        this._place(T, R, this.phi0, this.theta0, pos)
        break
      }
      case 'crane': {
        const phi = clamp(this.phi0 - (Math.sin(t * 0.3) * 0.5 + 0.5) * 0.45, 0.08, 1.5)
        this._place(T, this.R, phi, this.theta0, pos)
        break
      }
      case 'pan': {
        this._place(T, this.R, this.phi0, this.theta0 + Math.sin(t * 0.25) * 0.6, pos)
        break
      }
      case 'flyover': {
        // a slow Lissajous over the zone at a steady height, target trailing
        // ahead along the travel so it reads as flying over the terrain
        const A = this.R * 0.4
        const H = Math.max(this.R * Math.cos(this.phi0), 6)
        const px = Math.sin(t * 0.18) * A
        const pz = Math.cos(t * 0.11) * A
        pos.set(this.target0.x + px, this.target0.y + H, this.target0.z + pz)
        // look a bit ahead along the path, down onto the relief
        const ax = Math.cos(t * 0.18) * A * 0.18
        const az = -Math.sin(t * 0.11) * A * 0.18
        T.set(this.target0.x + px * 0.3 + ax, this.target0.y, this.target0.z + pz * 0.3 + az)
        break
      }
      default:
        return
    }

    this.camera.position.copy(pos)
    this.controls.target.copy(T)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(T)
  }
}
