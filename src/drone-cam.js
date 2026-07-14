// Drone follow camera for GPX playback. A cinematic chase cam that trails the
// runner/rider along the route from behind and above, looking ahead down the
// trail — never flying INTO the relief, never too high or too low.
//
// Technique (from deep-research + standard game-camera practice):
//   · subject path = the GPX track, resampled to even spacing and lightly
//     smoothed, as a CENTRIPETAL Catmull-Rom (alpha 0.5) — the parameterisation
//     that avoids cusps/loops on noisy, unevenly-spaced GPX points. Point order
//     is preserved, so the camera always travels in the GPX direction.
//   · chase offset = behind the travel tangent + above, the arm lengthening on
//     descents (look down) and tucking in on climbs (look up).
//   · terrain-aware altitude: the camera is lifted to keep a minimum clearance
//     over the ground beneath it AND over any ridge on the sight-line to the
//     subject, so relief never clips the view or swallows the camera.
//   · frame-rate-independent critical damping: x += (target-x)·(1-2^(-dt/half))
//     — a half-life is intuitive and stable at any timestep.
//   · roll banks into turns from path curvature.

import * as THREE from 'three'

// ---- pure path helpers (unit-tested) ----------------------------------------

// Resample a polyline to roughly even arc-length spacing. Keeps the first and
// last points; direction (order) preserved.
export function resamplePath(pts, spacing) {
  if (!pts || pts.length < 2) return pts ? pts.slice() : []
  const out = [pts[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    let segLen = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    if (segLen < 1e-9) continue
    let d = spacing - carry
    while (d < segLen) {
      const t = d / segLen
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
      d += spacing
    }
    carry = segLen - (d - spacing)
  }
  const last = pts[pts.length - 1]
  const tail = out[out.length - 1]
  if (Math.hypot(last.x - tail.x, last.y - tail.y, last.z - tail.z) > spacing * 0.25) out.push(last)
  return out
}

// Box-blur a polyline in place-safe fashion (endpoints pinned). `passes` × a
// small window damps GPS jitter without cutting corners hard.
export function smoothPath(pts, passes = 2, win = 2) {
  if (!pts || pts.length < 3) return pts ? pts.slice() : []
  let cur = pts.map((p) => ({ x: p.x, y: p.y, z: p.z }))
  for (let pass = 0; pass < passes; pass++) {
    const next = cur.map((p) => ({ ...p }))
    for (let i = 1; i < cur.length - 1; i++) {
      let sx = 0, sy = 0, sz = 0, n = 0
      for (let j = Math.max(0, i - win); j <= Math.min(cur.length - 1, i + win); j++) {
        sx += cur[j].x; sy += cur[j].y; sz += cur[j].z; n++
      }
      next[i] = { x: sx / n, y: sy / n, z: sz / n }
    }
    cur = next
  }
  return cur
}

// trapezoid ease so the flight accelerates in and decelerates out
function trapezoid(t, ramp = 0.16) {
  if (t < ramp) return (t * t) / (2 * ramp) / (1 - ramp)
  if (t > 1 - ramp) { const u = 1 - t; return 1 - (u * u) / (2 * ramp) / (1 - ramp) }
  return (t - ramp / 2) / (1 - ramp)
}

// ---- controller -------------------------------------------------------------

export class DroneCam {
  // sampleGround(x, z) → terrain surface height at world XZ (for clearance)
  constructor({ camera, controls, sampleGround }) {
    this.camera = camera
    this.controls = controls
    this.sampleGround = sampleGround
    this.active = false
    this.t = 0
    this.onDone = null
    // tuned to the ~56-unit terrain footprint; heights are exaggerated metres
    this.arm = 5.5 // base chase distance behind the subject
    this.lift = 3.4 // base height above the subject
    this.clearance = 2.2 // minimum gap kept over the ground / ridges
    this.lookAhead = 0.035 // fraction of the path length to aim ahead
    this.posHalfLife = 0.35 // s — position damping
    this.rotHalfLife = 0.3 // s — orientation damping
    this._pos = new THREE.Vector3()
    this._look = new THREE.Vector3()
    this._bank = 0
    this._q = new THREE.Quaternion()
    this._qr = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3(0, 1, 0)
    this._z = new THREE.Vector3(0, 0, 1)
  }

  // worldPts: ordered GPX track points {x,y,z} at ground level (direction = order)
  start(worldPts, { duration = 30 } = {}) {
    if (!worldPts || worldPts.length < 2) return false
    const span = worldPts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - worldPts[i - 1].x, p.z - worldPts[i - 1].z) : 0), 0)
    const spacing = Math.max(0.4, span / 260)
    const path = smoothPath(resamplePath(worldPts, spacing), 2, 2)
    // a stationary / near-single-point track collapses the resample to one point;
    // CatmullRomCurve3 of <2 points yields NaN poses. Bail cleanly instead.
    const v = path.map((p) => new THREE.Vector3(p.x, p.y, p.z))
    if (v.length < 2 || span < 1e-3) return false
    this.curve = new THREE.CatmullRomCurve3(v, false, 'centripetal', 0.5)
    this.curve.arcLengthDivisions = 800
    this.curve.updateArcLengths()
    this.duration = duration
    this.t = 0
    // seat the camera at the initial chase pose so it doesn't lurch from wherever
    this._solve(0, this._pos, this._look)
    this.camera.position.copy(this._pos)
    this.controls.target.copy(this._look)
    this._bank = 0
    this.active = true
    return true
  }

  stop() {
    this.active = false
  }

  // solve the desired camera position + look target at path fraction s
  _solve(s, outPos, outLook) {
    const c = this.curve
    const subj = c.getPointAt(s, _v1)
    const tan = c.getTangentAt(s, _v2) // unit, direction of travel
    const slope = THREE.MathUtils.clamp(tan.y, -1, 1)
    // horizontal travel direction
    _v3.set(tan.x, 0, tan.z)
    if (_v3.lengthSq() < 1e-8) _v3.set(0, 0, 1)
    _v3.normalize()
    // arm lengthens on descent (camera looks down the slope), tucks on climb
    const arm = this.arm * (1 + Math.max(0, -slope) * 0.7 - Math.max(0, slope) * 0.2)
    const lift = this.lift * (1 + Math.max(0, -slope) * 0.5)
    outPos.set(subj.x - _v3.x * arm, subj.y + lift, subj.z - _v3.z * arm)
    // clearance over the ground directly beneath the camera
    if (this.sampleGround) {
      const gc = this.sampleGround(outPos.x, outPos.z)
      if (outPos.y < gc + this.clearance) outPos.y = gc + this.clearance
      // lift over any ridge on the sight-line to the subject
      for (let k = 0.2; k < 0.99; k += 0.2) {
        const px = outPos.x + (subj.x - outPos.x) * k
        const pz = outPos.z + (subj.z - outPos.z) * k
        const gh = this.sampleGround(px, pz) + this.clearance * 0.7
        // camY such that the line camY→subj.y clears gh at fraction k
        const need = (gh - subj.y * k) / (1 - k)
        if (need > outPos.y) outPos.y = need
      }
    }
    // look target: ahead down the trail, a touch above ground so the gaze isn't
    // buried in the slope right in front
    const la = Math.min(s + this.lookAhead, 1)
    c.getPointAt(la, outLook)
    outLook.y += 0.4
    return { slope }
  }

  update(dt) {
    if (!this.active || !this.curve) return
    this.t = Math.min(1, this.t + dt / (this.duration || 30))
    const s = trapezoid(this.t)
    this._solve(s, _dPos, _dLook)

    // frame-rate-independent critical damping toward the desired pose
    const fp = 1 - Math.pow(2, -dt / this.posHalfLife)
    const fr = 1 - Math.pow(2, -dt / this.rotHalfLife)
    this._pos.lerp(_dPos, fp)
    this._look.lerp(_dLook, fr)
    this.camera.position.copy(this._pos)
    this.controls.target.copy(this._look)

    // orientation: look at target, rolled into the turn by path curvature
    this._m.lookAt(this._pos, this._look, this._up)
    this._q.setFromRotationMatrix(this._m)
    this.curve.getTangentAt(s, _v1)
    this.curve.getTangentAt(Math.min(s + 0.02, 1), _v2)
    const curl = _v1.x * _v2.z - _v1.z * _v2.x
    const arrived = this.t >= 1
    const bankTarget = arrived ? 0 : THREE.MathUtils.clamp(curl * 12, -0.45, 0.45)
    this._bank += (bankTarget - this._bank) * (1 - Math.pow(2, -dt / 0.45))
    this._q.multiply(this._qr.setFromAxisAngle(this._z, this._bank))

    const angle = this.camera.quaternion.angleTo(this._q)
    if (angle > 1e-5) this.camera.quaternion.slerp(this._q, Math.min(1 - Math.exp(-3.5 * dt), (1.6 * dt) / angle))

    if (arrived && angle < 0.001) { this.active = false; this.onDone?.() }
  }
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _v3 = new THREE.Vector3()
const _dPos = new THREE.Vector3()
const _dLook = new THREE.Vector3()
