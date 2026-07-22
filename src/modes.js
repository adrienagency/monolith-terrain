// Mode state machine: SURFACE (the detailed terrain patch, full effects) ⇄
// ORBITAL (the whole planet, effects powered down). Camera altitude is the
// single driver, with hysteresis so the boundary never flaps:
//   surface → orbital  when the user keeps zooming past the orbit gate
//   orbital → surface  when altitude CROSSES a dive tier from above
// Three tiers mean a Madagascar-sized view lands on real terrain (z8 patch,
// ~470 km across) instead of a long dead zoom to the 8 000 m fine gate; once
// on a coarse patch, zooming against the near stop REFINES to the next scale.
// Transitions are announced FUI-style and masked by a paper whiteout.

import * as THREE from 'three'
import { R_GLOBE, ORBITAL_M_PER_UNIT, sphereToLatLon, latLonToSphere } from './geo.js'

// ordered fine → coarse; zoom null = the user's fine zoom (≥ 12).
// Nine tiers so every stop on the way down lands on a matching real-terrain
// block instead of the globe. The globe is glitchy above ~8 000 km, so we now
// dive onto continental-scale blocks from that altitude down (a z4 patch spans
// ~7 500 km, a z5 patch ~3 760 km): z4 @ 8 000 km, z5 @ 4 000 km, z6 @ 1 600 km,
// z7 @ 600 km, then the regional/local tiers. Corsica-sized views (~150 km)
// still get z8.
export const DIVE_TIERS = [
  { altM: 8000, zoom: null },
  { altM: 25000, zoom: 11 },
  { altM: 50000, zoom: 10 },
  { altM: 100000, zoom: 9 },
  { altM: 200000, zoom: 8 },
  { altM: 600000, zoom: 7 },
  { altM: 1600000, zoom: 6 },
  { altM: 4000000, zoom: 5 },
  { altM: 8000000, zoom: 4 }, // continental block (~7 500 km); above this the globe opens
]

// tier a settled zoom-in engages at `altM` meters — null above every tier
export function pickDiveTier(altM) {
  return DIVE_TIERS.find((t) => altM < t.altM) ?? null
}

// the surface staircase arithmetic: two zoom steps at a time, fine-capped
// going down; widening past the z5 continental block takes one final step to
// the z4 continental block (~7 500 km), then floors there — past that the
// orbit gate takes over
export function stepZoom(zoom, dir, fine = 12) {
  if (dir > 0) return Math.min(zoom + 2, Math.max(fine, 12))
  // widen 2 steps at a time down to z5, then a single step to the z4
  // continental block before the orbit gate; floored at z4
  if (zoom <= 5) return Math.max(zoom - 1, 4)
  return Math.max(zoom - 2, 5)
}
const DIVE_ALT_M = DIVE_TIERS[0].altM
const MAX_ALT_M = 16000000 // ~2.5 earth radii — whole planet in frame
const MSG_MS = 3600

// task 30 Fix A: the isometric-ish viewing angle every dive/refine arrival
// has always used (camera.position(0,18,19), looking at (0,-0.3,0)) — kept
// as a fixed DIRECTION so the new far-standoff arrival (_arrivalPose()
// below) still frames the block the same way, just from farther back.
const _ARRIVAL_DIR = new THREE.Vector3(0, 18, 19).normalize()

export class Modes {
  /**
   * hooks: {
   *   setSurfaceVisible(bool), setEffectsEnabled(bool),
   *   getSurfaceLatLon() → {lat, lon},
   *   surfaceCamAltMeters() → number,
   *   loadSurface(lat, lon, zoom?) → Promise (resolves when terrain is rebuilt),
   *   surfaceMaxDistance() → number (controls.maxDistance in surface mode),
   *   getFineZoom() → number (user's detail zoom, ≥ 12),
   *   getRefineTarget() → {lat, lon, zoom} | null (next finer scale under the
   *     current view, null when already at fine scale),
   *   getCoarsenTarget() → {lat, lon, zoom} | null (next wider scale, null
   *     once the patch is z8 — then zooming out opens the orbit gate),
   *   sampleGroundY(x, z) → number (optional; terrain height at a world XZ —
   *     used by _arrivalPose()'s clearance guard, see its own comment),
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
          // The wheel dollies smoothly (OrbitControls damping = the "élan").
          // The staircase steps at 70% of THIS level's travel, not against the
          // wall (Adrien: "pas besoin d'avoir la tête contre la paroi"): out
          // past 70% coarsens (z12→z10→z8, real maps each step, then the orbit
          // gate); in past 70% refines. t = 0 at the near stop, 1 at the far.
          const range = this.controls.maxDistance - this.controls.minDistance
          const t = range > 1e-3 ? (this.controls.getDistance() - this.controls.minDistance) / range : 0
          if (e.deltaY > 0 && !this.busy && !this._diveTween && t >= 0.7) {
            if (this.hooks.getCoarsenTarget()) this._coarsen()
            else this.enterOrbit()
          } else if (e.deltaY < 0 && !this.busy && !this._diveTween && (t <= 0.3 || this.hooks.nearGround?.())) {
            this._refine()
          }
          return
        }
        e.preventDefault()
        if (this.busy || this.travel) return
        if (e.deltaY < 0) this._diveArmed = true // inward intent arms the dive
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

  async enterOrbit(entryAltM = null) {
    if (this.mode !== 'surface' || this.busy) return
    // continuity: pop out at the altitude the surface view actually had, so a
    // z8 patch hands over at ~500 km and a z12 patch at ~30 km
    if (entryAltM == null) {
      // pop out just above the block's own altitude; a coarse z4 continental
      // block (~7 500 km up) hands over above the 8 000 km globe gate
      entryAltM = THREE.MathUtils.clamp(this.hooks.surfaceCamAltMeters() * 1.15, 15000, 9000000)
    }
    // an explicit altitude must respect the orbit ceiling too, or the camera
    // would sit above controls.maxDistance and snap every frame
    entryAltM = Math.min(entryAltM, MAX_ALT_M)
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
      this._diveArmed = false // require an inward zoom before re-diving
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

  // task 30 Fix A: "on se retrouve très souvent le nez dans la paroi quand on
  // passe au zoom inférieur" — every dive/refine arrival used to land the
  // camera at a FIXED close standoff (~26 world units: position(0,18,19)
  // against target(0,-0.3,0)) regardless of how tall the just-loaded patch's
  // OWN relief is, so a steep peak near the block centre could easily sit
  // taller than that fixed height. Land at the FAR end of
  // hooks.surfaceMaxDistance() instead — the same distance the "frame the
  // whole slab" comment on that hook already documents as safe: the block's
  // own world footprint (TERRAIN_SIZE) never changes size across zoom tiers,
  // only what it REPRESENTS does, so "farthest for this zoom" and "farthest,
  // full stop" are the same number. Same viewing angle as the old fixed
  // pose (_ARRIVAL_DIR), just farther back along it, so the framing doesn't
  // look different — only safer. A cheap terrain-clearance guard on top:
  // sample the ground height directly under the landing target and refuse
  // to land below it (+ margin) — a formality at ~94% of
  // surfaceMaxDistance() (that standoff already clears anything this app's
  // relief produces) but a real guarantee rather than an assumption.
  _arrivalPose() {
    const dist = this.hooks.surfaceMaxDistance() * 0.94 // stay under the hard cap so controls.update() below doesn't immediately re-clamp it
    const target = new THREE.Vector3(0, -0.3, 0)
    const pos = _ARRIVAL_DIR.clone().multiplyScalar(dist)
    const groundY = this.hooks.sampleGroundY ? this.hooks.sampleGroundY(target.x, target.z) : -Infinity
    const minY = groundY + 3 // clearance margin, world units
    if (pos.y < minY) pos.y = minY
    return { pos, target }
  }

  async _dive(tier = DIVE_TIERS[0]) {
    if (this.mode !== 'orbital' || this.busy) return
    this.busy = true
    const zoom = tier.zoom ?? this.hooks.getFineZoom()
    const { lat, lon } = sphereToLatLon(this.camera.position)
    this.announce(`ACQUIRING SURFACE DATA — ${lat.toFixed(4)}, ${lon.toFixed(4)} · Z${zoom}`)
    this.controls.enabled = false
    try {
      await this.hooks.loadSurface(lat, lon, zoom)
    } catch {
      this.announce('SURFACE DATA UNAVAILABLE — HOLDING ORBIT')
      this.orbAltTarget = Math.max(tier.altM * 1.6, 60000) / ORBITAL_M_PER_UNIT
      // snap back above the dive gate NOW — the damped climb takes several
      // frames, during which a lingering sub-tier altitude would re-trigger
      // _dive() every frame and hammer the tile server with doomed requests
      this.orbAlt = Math.max(this.orbAlt, (tier.altM * 1.1) / ORBITAL_M_PER_UNIT)
      this._diveArmed = false // a fresh inward zoom is needed to retry
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
      const arrival = this._arrivalPose()
      this.camera.position.copy(arrival.pos)
      this.controls.target.copy(arrival.target)
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

  // surface → surface: reload the patch two zoom steps finer, centered on
  // what the camera is looking at — the staircase down from a z8 dive
  async _refine() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getRefineTarget()
    if (!next) return // already at fine scale
    await this._rescale(next, 'REFINING')
  }

  // surface → surface the other way: widen the map two zoom steps before
  // handing over to orbit — every stop of the zoom-out shows a real map
  async _coarsen() {
    if (this.mode !== 'surface' || this.busy) return
    const next = this.hooks.getCoarsenTarget()
    if (!next) return
    await this._rescale(next, 'WIDENING')
  }

  async _rescale(next, verb) {
    this.busy = true
    // v42: CONTINUITE D'ALTITUDE REELLE — avant, l'arrivee etait un cadrage
    // fixe en unites scene : traverser un etage teleportait l'altitude reelle
    // (10 km -> 149 km -> 143 km, retour Adrien). On memorise l'altitude en
    // metres et la direction de vue, et on les retablit dans le nouvel etage
    // (clampees a ses bornes) : l'escalier de zoom se lit comme un zoom continu.
    const prevAltM = this.hooks.surfaceCamAltMeters?.() ?? 0
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    this.announce(`${verb} — ${next.lat.toFixed(4)}, ${next.lon.toFixed(4)} · Z${next.zoom}`)
    try {
      await this.hooks.loadSurface(next.lat, next.lon, next.zoom)
    } catch {
      this.announce(`${verb} FAILED — HOLDING SCALE`)
      this.busy = false
      return
    }
    await this._whiteout(() => {
      const arrival = this._arrivalPose()
      this.camera.position.copy(arrival.pos)
      this.controls.target.copy(arrival.target)
      if (prevAltM > 1 && prevDir.lengthSq() > 1e-6) {
        // meme direction de vue qu'avant, distance recalculee pour retrouver
        // l'altitude reelle precedente dans la nouvelle echelle
        const nowAlt = this.hooks.surfaceCamAltMeters?.() ?? 0
        if (nowAlt > 1) {
          const off = prevDir.clone().normalize().multiplyScalar(arrival.pos.distanceTo(arrival.target) * (prevAltM / nowAlt))
          const lo = this.controls.minDistance * 1.05
          const hi = (this.hooks.surfaceMaxDistance?.() ?? 150) * 0.95
          const len = Math.min(hi, Math.max(lo, off.length()))
          off.multiplyScalar(len / Math.max(off.length(), 1e-6))
          this.camera.position.copy(this.controls.target).add(off)
        }
      }
      this.controls.update()
    })
    this.busy = false
  }

  // ---------------------------------------------------------------- travel

  // Great-circle glide to lat/lon, ending below the dive threshold so the
  // normal engagement takes over. One code path for paste, search and GPX.
  // `zoom` pins the landing scale (GPX framing); null lands on the fine zoom.
  // Returns false when navigation is already busy (dive/transition running).
  async flyTo(lat, lon, zoom = null) {
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
      zoom,
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
      // a glide lands on its pinned zoom (GPX framing) or the FINE scale,
      // explicitly (dive arming is for manual zooms only)
      this._dive(tr.zoom ? { altM: DIVE_ALT_M, zoom: tr.zoom } : DIVE_TIERS[0])
    }
  }

  // ---------------------------------------------------------------- public nav
  // Explicit navigation the UI drives (vertical zoom stepper + click-to-dive).
  // All reuse the tuned staircase internals — no new zoom behaviour, just new
  // triggers besides the wheel.

  // one level FINER (toward more detail). Surface: refine centred on the view.
  // Orbital: nudge the altitude target inward and arm the dive (the settle→dive
  // logic then lands at the matching scale — same path as a wheel-in notch).
  stepFiner() {
    if (this.busy || this.travel || this._diveTween) return
    if (this.mode === 'surface') this._refine()
    else this._orbitNotch(1)
  }

  // one level WIDER. Surface: coarsen, or open the orbit gate once past z4.
  // Orbital: nudge the altitude target outward (toward the planet).
  stepWider() {
    if (this.busy || this.travel || this._diveTween) return
    if (this.mode === 'surface') {
      if (this.hooks.getCoarsenTarget()) this._coarsen()
      else this.enterOrbit()
    } else this._orbitNotch(-1)
  }

  _orbitNotch(dir) {
    if (dir > 0) this._diveArmed = true // inward intent arms the dive, like the wheel
    const f = dir > 0 ? 1 / 1.7 : 1.7
    this.orbAltTarget = THREE.MathUtils.clamp(
      this.orbAltTarget * f,
      (DIVE_ALT_M * 0.9) / ORBITAL_M_PER_UNIT,
      MAX_ALT_M / ORBITAL_M_PER_UNIT
    )
  }

  // Click-to-dive, two beats (Adrien): first EASE IN toward the clicked point
  // by 30% of the remaining zoom distance (a "lean toward it"), THEN load the
  // finer level centred there. `target.point` is the clicked world position.
  diveTo(target) {
    if (this.busy || this.travel || this._diveTween || this.mode !== 'surface' || !target) return
    const from = this.camera.position.clone()
    const fromT = this.controls.target.clone()
    const dist = from.distanceTo(fromT)
    const lean = 0.3 * Math.max(0, dist - this.controls.minDistance)
    const dir = from.clone().sub(fromT).normalize()
    const toT = target.point ? target.point.clone() : fromT.clone()
    const toPos = toT.clone().addScaledVector(dir, Math.max(this.controls.minDistance, dist - lean))
    this.controls.enabled = false // the tween owns the camera until it loads
    this._diveTween = { t: 0, dur: 0.42, from, fromT, toPos, toT, target }
  }

  // second beat: load the finer level, centred on the clicked point, landing
  // near the far end of the new level (whole block in frame) while KEEPING the
  // current view axis — "dézoomé quasiment au max de ce niveau, même axe de vue".
  async _loadDive(target) {
    if (this.busy || this.mode !== 'surface' || !target) return
    this.busy = true
    const prevDir = this.camera.position.clone().sub(this.controls.target)
    this.announce(`DIVING — ${target.lat.toFixed(4)}, ${target.lon.toFixed(4)} · Z${target.zoom}`)
    try {
      await this.hooks.loadSurface(target.lat, target.lon, target.zoom)
    } catch {
      this.announce('DIVE FAILED — HOLDING SCALE')
      this.busy = false
      return
    }
    await this._whiteout(() => {
      const tgt = new THREE.Vector3(0, -0.3, 0) // the clicked point is the new block centre
      const dist = this.hooks.surfaceMaxDistance() * 0.94 // far standoff = whole block in frame
      const dir = prevDir.lengthSq() > 1e-6 ? prevDir.normalize() : _ARRIVAL_DIR.clone()
      const pos = dir.multiplyScalar(dist)
      const groundY = this.hooks.sampleGroundY ? this.hooks.sampleGroundY(tgt.x, tgt.z) : -Infinity
      if (pos.y < groundY + 3) pos.y = groundY + 3 // same clearance guard as _arrivalPose
      this.camera.position.copy(pos)
      this.controls.target.copy(tgt)
      this.controls.minDistance = 6
      this.controls.maxDistance = this.hooks.surfaceMaxDistance()
      this.controls.update()
    })
    this.busy = false
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
      if (!this.busy && !this.travel && this._diveArmed) {
        // dive when an inward zoom SETTLES under a tier — never intercept a
        // fast zoom mid-flight; the landing scale matches where you stopped
        const settled = Math.abs(this.orbAlt - this.orbAltTarget) < this.orbAltTarget * 0.06
        if (settled) {
          // pick the tier from the TARGET altitude (where the user chose to
          // stop), not the still-damping orbAlt — settle fires up to 6% away,
          // enough to cross a tier boundary and land one scale too coarse
          // (e.g. wheel stop at 7 700 m read as 8 160 m → z11 instead of FINE)
          const tier = pickDiveTier(this.orbAltTarget * ORBITAL_M_PER_UNIT)
          if (tier) {
            this._diveArmed = false
            this._dive(tier)
          }
        }
      }
    } else {
      // click-to-dive lean-in tween (first beat): ease 30% toward the point,
      // then load the finer level (see diveTo). ease-in-out quad.
      if (this._diveTween && !this.busy) {
        const dv = this._diveTween
        dv.t = Math.min(1, dv.t + dt / dv.dur)
        const e = dv.t < 0.5 ? 2 * dv.t * dv.t : 1 - ((-2 * dv.t + 2) ** 2) / 2
        this.camera.position.lerpVectors(dv.from, dv.toPos, e)
        this.controls.target.lerpVectors(dv.fromT, dv.toT, e)
        this.controls.update()
        if (dv.t >= 1) {
          this._diveTween = null
          this.controls.enabled = true
          this._loadDive(dv.target)
        }
      }
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
