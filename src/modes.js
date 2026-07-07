// Mode state machine: SURFACE (the detailed terrain patch, full effects) ⇄
// ORBITAL (the whole planet, effects powered down). Camera altitude is the
// single driver, with hysteresis so the boundary never flaps:
//   surface → orbital  when the user keeps zooming past the orbit gate
//   orbital → surface  when altitude drops under ~8 000 m (Everest-class)
// Transitions are announced FUI-style and masked by a paper whiteout.

import * as THREE from 'three'
import { R_GLOBE, ORBITAL_M_PER_UNIT, sphereToLatLon, latLonToSphere } from './geo.js'

const DIVE_ALT_M = 8000 // orbital → surface engagement
const ORBIT_ENTRY_ALT_M = 30000 // where the orbital camera starts after handoff
const MAX_ALT_M = 16000000 // ~2.5 earth radii — whole planet in frame
const MSG_MS = 3600

export class Modes {
  /**
   * hooks: {
   *   setSurfaceVisible(bool), setEffectsEnabled(bool),
   *   getSurfaceLatLon() → {lat, lon},
   *   surfaceCamAltMeters() → number,
   *   loadSurface(lat, lon) → Promise (resolves when terrain is rebuilt),
   *   surfaceMaxDistance() → number (controls.maxDistance in surface mode),
   * }
   */
  constructor({ camera, controls, globe, domElement, hooks }) {
    this.mode = 'surface'
    this.camera = camera
    this.controls = controls
    this.globe = globe
    this.hooks = hooks
    this.altM = 0 // displayed altitude (meters)
    this.orbAlt = 0 // orbital altitude in scene units (current)
    this.orbAltTarget = 0
    this.busy = false
    this.travel = null // great-circle glide tween
    this._surfCam = { near: camera.near, far: camera.far }

    this._buildDom()

    // orbital zoom is proportional to altitude (Google-Earth feel) — we take
    // over the wheel entirely while in orbit
    domElement.addEventListener(
      'wheel',
      (e) => {
        if (this.mode === 'surface') {
          // zooming out hard against the stop opens the orbit gate
          if (
            e.deltaY > 0 &&
            !this.busy &&
            this.controls.getDistance() >= this.hooks.surfaceMaxDistance() * 0.965
          ) {
            this.enterOrbit()
          }
          return
        }
        e.preventDefault()
        if (this.busy || this.travel) return
        const f = Math.exp(e.deltaY * 0.0011)
        this.orbAltTarget = THREE.MathUtils.clamp(
          this.orbAltTarget * f,
          (DIVE_ALT_M * 0.9) / ORBITAL_M_PER_UNIT,
          MAX_ALT_M / ORBITAL_M_PER_UNIT
        )
      },
      { passive: false }
    )

  }

  // ---------------------------------------------------------------- DOM

  _buildDom() {
    const alt = document.createElement('div')
    alt.className = 'altimeter'
    alt.innerHTML = '<span class="alt-mode">SURFACE</span><span class="alt-value">— m</span>'
    document.body.appendChild(alt)
    this.altEl = alt
    this.altModeEl = alt.querySelector('.alt-mode')
    this.altValueEl = alt.querySelector('.alt-value')

    const msg = document.createElement('div')
    msg.className = 'fui-msg hidden'
    document.body.appendChild(msg)
    this.msgEl = msg
    this._msgTimer = 0

    const white = document.createElement('div')
    white.className = 'whiteout'
    document.body.appendChild(white)
    this.whiteEl = white
  }

  announce(text) {
    this.msgEl.textContent = text
    this.msgEl.classList.remove('hidden')
    clearTimeout(this._msgTimer)
    this._msgTimer = setTimeout(() => this.msgEl.classList.add('hidden'), MSG_MS)
  }

  _whiteout(swap) {
    return new Promise((resolve) => {
      this.whiteEl.classList.add('on')
      setTimeout(async () => {
        await swap()
        this.whiteEl.classList.remove('on')
        setTimeout(resolve, 480)
      }, 480)
    })
  }

  // ---------------------------------------------------------------- surface → orbital

  async enterOrbit(entryAltM = ORBIT_ENTRY_ALT_M) {
    if (this.mode !== 'surface' || this.busy) return
    this.busy = true
    this.announce('FX OFFLINE — ENTERING ORBITAL VIEW')
    const { lat, lon } = this.hooks.getSurfaceLatLon()

    await this._whiteout(() => {
      this.hooks.setSurfaceVisible(false)
      this.hooks.setEffectsEnabled(false)
      this.globe.setVisible(true)

      this._surfCam.near = this.camera.near
      this._surfCam.far = this.camera.far
      this.camera.far = 1400
      this.camera.updateProjectionMatrix()

      this.orbAlt = this.orbAltTarget = entryAltM / ORBITAL_M_PER_UNIT
      latLonToSphere(lat, lon, R_GLOBE + this.orbAlt, this.camera.position)
      this.controls.target.set(0, 0, 0)
      this.controls.minDistance = R_GLOBE + (DIVE_ALT_M * 0.85) / ORBITAL_M_PER_UNIT
      this.controls.maxDistance = R_GLOBE + MAX_ALT_M / ORBITAL_M_PER_UNIT
      this.controls.maxPolarAngle = Math.PI
      this.controls.enableZoom = false // wheel handled by us
      this.controls.enablePan = false
      this.camera.up.set(0, 1, 0)
      this.camera.lookAt(0, 0, 0)
      this.controls.update()
      this.mode = 'orbital'
    })
    this.busy = false
  }

  // ---------------------------------------------------------------- orbital → surface

  async _dive() {
    if (this.mode !== 'orbital' || this.busy) return
    this.busy = true
    const { lat, lon } = sphereToLatLon(this.camera.position)
    this.announce(`ACQUIRING SURFACE DATA — ${lat.toFixed(4)}, ${lon.toFixed(4)}`)
    this.controls.enabled = false
    try {
      await this.hooks.loadSurface(lat, lon)
    } catch {
      this.announce('SURFACE DATA UNAVAILABLE — HOLDING ORBIT')
      this.orbAltTarget = 60000 / ORBITAL_M_PER_UNIT
      // snap back above the dive gate NOW — the damped climb takes several
      // frames, during which altM < DIVE_ALT_M would re-trigger _dive() every
      // frame and hammer the tile server with doomed requests
      this.orbAlt = Math.max(this.orbAlt, (DIVE_ALT_M * 1.1) / ORBITAL_M_PER_UNIT)
      this.controls.enabled = true
      this.busy = false
      return
    }

    await this._whiteout(() => {
      this.globe.setVisible(false)
      this.hooks.setSurfaceVisible(true)
      this.hooks.setEffectsEnabled(true)

      this.camera.near = this._surfCam.near
      this.camera.far = this._surfCam.far
      this.camera.updateProjectionMatrix()
      this.camera.up.set(0, 1, 0)
      this.camera.position.set(0, 18, 19)
      this.controls.target.set(0, -0.3, 0)
      this.controls.minDistance = 6
      this.controls.maxDistance = this.hooks.surfaceMaxDistance()
      this.controls.maxPolarAngle = Math.PI * 0.49
      this.controls.rotateSpeed = 1 // orbital update scales it down to ~0.015
      this.controls.enableZoom = true
      this.controls.enablePan = true
      this.controls.enabled = true
      this.controls.update()
      this.mode = 'surface'
    })
    this.announce('FX ONLINE — SURFACE MODE ENGAGED')
    this.busy = false
  }

  // ---------------------------------------------------------------- travel

  // Great-circle glide to lat/lon, ending below the dive threshold so the
  // normal engagement takes over. One code path for paste, search and GPX.
  // Returns false when navigation is already busy (dive/transition running).
  async flyTo(lat, lon) {
    if (this.busy) return false
    if (this.mode === 'surface') {
      await this.enterOrbit(1200000) // pop out high enough to see the arc
    }
    const fromDir = this.camera.position.clone().normalize()
    const toDir = latLonToSphere(lat, lon, 1)
    const angle = fromDir.angleTo(toDir)
    const cruise = Math.max(this.orbAlt, Math.min((angle / Math.PI) * 14000000, 12000000) / ORBITAL_M_PER_UNIT)
    this.travel = {
      t: 0,
      duration: THREE.MathUtils.clamp(2.5 + (angle / Math.PI) * 7, 2.5, 9),
      fromDir,
      toDir,
      fromAlt: this.orbAlt,
      cruise,
      endAlt: (DIVE_ALT_M * 0.92) / ORBITAL_M_PER_UNIT,
    }
    this.controls.enabled = false
    return true
  }

  _updateTravel(dt) {
    const tr = this.travel
    tr.t = Math.min(1, tr.t + dt / tr.duration)
    const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - (-2 * tr.t + 2) ** 3 / 2
    const dir = tr.fromDir.clone().lerp(tr.toDir, e).normalize() // fine for < π arcs
    const up = THREE.MathUtils.smoothstep(tr.t, 0, 0.35)
    const down = THREE.MathUtils.smoothstep(tr.t, 0.55, 1)
    const alt = THREE.MathUtils.lerp(THREE.MathUtils.lerp(tr.fromAlt, tr.cruise, up), tr.endAlt, down)
    this.orbAlt = this.orbAltTarget = alt
    this.camera.position.copy(dir).multiplyScalar(R_GLOBE + alt)
    this.camera.lookAt(0, 0, 0)
    if (tr.t >= 1) {
      this.travel = null
      this.controls.enabled = true
      this.controls.update()
    }
  }

  // ---------------------------------------------------------------- per-frame

  update(dt) {
    if (this.mode === 'orbital') {
      if (this.travel) {
        this._updateTravel(dt)
      } else if (!this.busy) {
        // damped proportional zoom + altitude-scaled rotation
        this.orbAlt = THREE.MathUtils.damp(this.orbAlt, this.orbAltTarget, 6, dt)
        const dir = this.camera.position.clone().normalize()
        this.camera.position.copy(dir).multiplyScalar(R_GLOBE + this.orbAlt)
        this.controls.rotateSpeed = THREE.MathUtils.clamp((this.orbAlt / R_GLOBE) * 1.4, 0.015, 1)
        this.controls.update()
      }

      // keep the near plane tight to the ground so low passes don't clip
      const near = THREE.MathUtils.clamp(this.orbAlt * 0.2, 0.01, 0.5)
      if (Math.abs(near - this.camera.near) > near * 0.2) {
        this.camera.near = near
        this.camera.updateProjectionMatrix()
      }

      this.altM = this.orbAlt * ORBITAL_M_PER_UNIT
      if (!this.busy && !this.travel && this.altM < DIVE_ALT_M) this._dive()
    } else {
      this.altM = this.hooks.surfaceCamAltMeters()
    }

    this.altModeEl.textContent = this.mode === 'orbital' ? 'ORBITAL' : 'SURFACE'
    this.altValueEl.textContent =
      this.altM >= 100000
        ? `${(this.altM / 1000).toFixed(0)} km`
        : this.altM >= 10000
          ? `${(this.altM / 1000).toFixed(1)} km`
          : `${Math.max(0, Math.round(this.altM))} m`
  }
}
