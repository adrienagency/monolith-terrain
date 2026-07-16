// Drone follow camera for GPX playback. A cinematic TRAVELING shot that
// stands well off the route and drifts along it — never a corner-chasing
// pursuit cam.
//
// The nausea this replaces came from one root cause: the old rig was a
// function of the track's own local shape — every hairpin, every GPS
// jitter sample, propagated straight into camera yaw. The fix is not a
// smarter chase algorithm, it's to stop reading the track directly at all:
//
//   · SPINE, not path. The camera's position/heading/elevation are solved
//     against a heavily decimated + box-blurred "spine" curve (see
//     start()) — a fixed ~14 control points over the whole track, however
//     long, then several wide smoothing passes. A staircase of hairpins
//     collapses into one gentle arc; a 12-switchback climb reads as one
//     slow rise. The real (lightly-smoothed) path is only consulted for
//     where the rider actually is right now (framing target + OrbitControls
//     handoff target), never for where the camera goes or points.
//   · Yaw/pitch are RATE-LIMITED, not solved-and-snapped. Every frame we
//     compute a target heading/pitch from the spine, then slew the current
//     heading/pitch toward it by at most maxYawRateDeg / maxPitchRateDeg
//     degrees per second (slewHeading below). This is the actual anti-
//     nausea guarantee — no matter how sharply the spine still bends, the
//     camera physically cannot turn faster than the cap.
//   · No roll, ever. Roll is rotation too, and the brief asks for almost
//     none — this rig only ever yaws (slowly) and pitches (to frame), so
//     lookAt is always built with a fixed world up vector.
//   · Fixed arm/lift ("traveling", not chase). Distance behind + height
//     above the spine are constant, not slope-reactive — standing well
//     back is itself the primary anti-nausea lever (a wiggle subtends a
//     smaller screen angle from farther away), and the spine's own smoothed
//     elevation already delivers "climb progressively" without a separate
//     dial.
//   · Lower-third framing is SOLVED, not eyeballed. solvePitchForNdcY()
//     inverts the perspective projection to find the exact pitch that
//     places the rider's point at a target NDC.y (~-0.375, mid of the
//     -0.3..-0.45 lower-third band) — and because that means looking a bit
//     ABOVE the rider, "keep the point low on screen" and "look up the
//     mountain when climbing" fall out of the SAME formula.
//   · Frame-rate-independent critical damping on top of all of the above
//     for extra silkiness: x += (target-x)·(1-2^(-dt/half)).

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
// small window damps GPS jitter without cutting corners hard. With a large
// window/passes (see start()'s spine build) this becomes a heavy low-pass
// that erases corners on purpose, not just jitter.
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

// ---- pure camera-rig helpers (unit-tested) ----------------------------------

// Rotate a horizontal unit heading toward a target heading by at most
// maxStep radians — always the short way around. This is the literal "cap
// degrees/second, slew toward the target, never snap" rule from the brief:
// whatever calls this gets a heading that CANNOT change faster than
// maxStep per call, no matter how sharply the underlying curve bends.
// curDir/targetDir are {x,z} (or any {x,z}-bearing object, y ignored).
export function slewHeading(curDir, targetDir, maxStep) {
  const curAngle = Math.atan2(curDir.x, curDir.z)
  const targetAngle = Math.atan2(targetDir.x, targetDir.z)
  // wrap the delta into (-PI, PI] so we always take the short way around
  let delta = (targetAngle - curAngle) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  else if (delta < -Math.PI) delta += Math.PI * 2
  const clamped = Math.max(-maxStep, Math.min(maxStep, delta))
  const a = curAngle + clamped
  return { x: Math.sin(a), z: Math.cos(a) }
}

// Closed-form pitch (radians, +up from horizontal) that puts `diff`
// (subject-minus-camera, world space) at NDC.y = targetNdcY, for a camera
// whose horizontal facing is `forward0` (unit, y=0) and vertical field of
// view is `vFovRad`. This is the "project the head into NDC and solve the
// aim" step the brief asks for, done algebraically rather than by
// iteration or eyeballed offset.
//
// Derivation: rotating forward0 by pitch angle a around the horizontal
// right axis gives forward(a) = forward0·cos(a) + up0·sin(a). Projecting
// `diff` through the resulting camera basis:
//   A = diff·up0 = diff.y        (unaffected by a)
//   B = diff·forward0            (unaffected by a)
//   ndc.y(a) = (A·cos(a) − B·sin(a)) / ((B·cos(a) + A·sin(a))·tan(vFov/2))
// Setting ndc.y(a) = T and solving for a gives a closed form:
//   tan(a) = (A − T·k·B) / (B + T·k·A),  k = tan(vFov/2)
export function solvePitchForNdcY(diff, forward0, targetNdcY, vFovRad) {
  const A = diff.y
  const B = diff.x * forward0.x + diff.z * forward0.z
  const k = Math.tan(vFovRad / 2)
  const c = B + targetNdcY * k * A
  const s = A - targetNdcY * k * B
  if (Math.abs(c) < 1e-9 && Math.abs(s) < 1e-9) return 0
  return Math.atan2(s, c)
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

    // ---- rig tuning -------------------------------------------------------
    // tuned to the ~56-unit terrain footprint; heights are exaggerated
    // metres. arm/lift are roughly 2x the old chase-cam's, per the brief's
    // explicit "plus loin" ask — standing farther back is itself the primary
    // anti-nausea lever (a wiggle subtends a smaller screen angle).
    this.arm = 12 // fixed traveling distance behind the spine (world units)
    this.lift = 7 // fixed height above the spine's own (already-smoothed) elevation
    this.clearance = 2.6 // minimum gap kept over the ground / ridges
    // hard caps on how fast the rig is allowed to turn — THIS (not the spine
    // smoothing alone) is the actual nausea guarantee: even a pathological
    // input cannot spin the camera faster than these.
    this.maxYawRateDeg = 9 // deg/s — "ne quasiment pas tourner, ou très lentement"
    this.maxPitchRateDeg = 16 // deg/s — vertical aim may move a bit more freely than yaw
    // where the tracked point should sit vertically on screen: NDC y, 0 =
    // center, -1 = bottom. Mid of the requested -0.30..-0.45 lower-third band.
    this.targetNdcY = -0.375
    this.posHalfLife = 0.9 // s — heavy extra smoothing on top of the already-smooth spine
    this.rotHalfLife = 0.5 // s — final orientation smoothing

    this._pos = new THREE.Vector3()
    this._headingDir = new THREE.Vector3(0, 0, 1) // current, rate-limited facing (horizontal, unit)
    this._pitch = 0 // current, rate-limited vertical aim angle (rad, +up)
    this._q = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3(0, 1, 0)
  }

  // worldPts: ordered GPX track points {x,y,z} at ground level (direction = order)
  // seedAt: path fraction (0..1) to seat the initial pose at — lets a caller
  // that resumes mid-track (e.g. GPX playback follow, unpaused partway
  // through) start the flight from where the subject already is instead of
  // snapping back to the beginning.
  start(worldPts, { duration = 30, seedAt = 0 } = {}) {
    this.active = false // a bail below leaves no stale flight running
    if (!worldPts || worldPts.length < 2) return false
    const span = worldPts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - worldPts[i - 1].x, p.z - worldPts[i - 1].z) : 0), 0)
    if (span < 1e-3) return false

    // subject path: fine resample + light smoothing only — just enough to
    // kill GPS jitter. This IS "the point of advancement", so switchbacks
    // stay switchbacks here on purpose; the framing math below (not this
    // curve) is what keeps them from reading as nausea.
    const subjSpacing = Math.max(0.4, span / 260)
    const subjV = smoothPath(resamplePath(worldPts, subjSpacing), 2, 2).map((p) => new THREE.Vector3(p.x, p.y, p.z))
    // a stationary / near-single-point track collapses the resample to one point;
    // CatmullRomCurve3 of <2 points yields NaN poses. Bail cleanly instead.
    if (subjV.length < 2) return false
    this.curve = new THREE.CatmullRomCurve3(subjV, false, 'centripetal', 0.5)
    this.curve.arcLengthDivisions = 800
    this.curve.updateArcLengths()

    // spine: the heavily low-passed curve the camera itself actually flies.
    // ~14 control points over the WHOLE track (however long) plus a wide,
    // multi-pass box blur — a staircase of hairpins collapses into one
    // gentle arc. Every position/heading/elevation decision below reads
    // this curve, never the real path.
    const spineSpacing = Math.max(3, span / 14)
    let spineV = smoothPath(resamplePath(worldPts, spineSpacing), 6, 4).map((p) => new THREE.Vector3(p.x, p.y, p.z))
    if (spineV.length < 2) spineV = subjV.slice() // very short/degenerate track: fall back to the subject curve
    this.spine = new THREE.CatmullRomCurve3(spineV, false, 'centripetal', 0.5)
    this.spine.arcLengthDivisions = 400
    this.spine.updateArcLengths()

    this.duration = duration
    this.t = THREE.MathUtils.clamp(seedAt, 0, 1)

    // seed the heading from the spine's own tangent at the start fraction so
    // the first frame doesn't slew in from a stale default direction
    this.spine.getTangentAt(this.t, _stan)
    this._headingDir.set(_stan.x, 0, _stan.z)
    if (this._headingDir.lengthSq() < 1e-8) this._headingDir.set(0, 0, 1)
    this._headingDir.normalize()
    this._pitch = 0

    // seat the camera at the initial pose immediately — no slew-in lurch
    this._solvePosition(this.t, this._pos)
    this.camera.position.copy(this._pos)
    this._aim(0, this.t, false) // dt=0 → snaps orientation instead of slewing in
    this.active = true
    return true
  }

  stop() {
    this.active = false
  }

  // camera position at path fraction s: fixed arm/lift behind + above the
  // SPINE (never the raw path) along the CURRENT (already rate-limited)
  // heading. Ground/ridge clearance still reads the real terrain underneath
  // so the rig never clips into relief.
  _solvePosition(s, outPos) {
    this.spine.getPointAt(s, _spinePt)
    outPos.set(
      _spinePt.x - this._headingDir.x * this.arm,
      _spinePt.y + this.lift,
      _spinePt.z - this._headingDir.z * this.arm
    )
    if (this.sampleGround) {
      const gc = this.sampleGround(outPos.x, outPos.z)
      if (outPos.y < gc + this.clearance) outPos.y = gc + this.clearance
      // lift over any ridge on the sight-line to the spine point
      for (let k = 0.2; k < 0.99; k += 0.2) {
        const px = outPos.x + (_spinePt.x - outPos.x) * k
        const pz = outPos.z + (_spinePt.z - outPos.z) * k
        const gh = this.sampleGround(px, pz) + this.clearance * 0.7
        const need = (gh - _spinePt.y * k) / (1 - k)
        if (need > outPos.y) outPos.y = need
      }
    }
  }

  update(dt) {
    if (!this.active || !this.curve) return
    this.t = Math.min(1, this.t + dt / (this.duration || 30))
    this._applyPose(dt, trapezoid(this.t), this.t >= 1)
  }

  // Follow mode: drive the pose from an explicit path fraction instead of
  // the internal timer/trapezoid. A caller (GPX playback follow) hands in
  // its OWN progress value every frame — since the reveal head and the
  // camera then both read that exact same number, they can never drift
  // apart the way two independently-timed animations could.
  updateAt(dt, s) {
    if (!this.active || !this.curve) return
    const clamped = THREE.MathUtils.clamp(s, 0, 1)
    this.t = clamped
    this._applyPose(dt, clamped, clamped >= 1)
  }

  // shared by update()/updateAt(): slew the heading, damp the position onto
  // the spine, then solve+slew the framing pitch.
  _applyPose(dt, s, arrived) {
    // 1) slew the heading toward the spine's tangent at s — the hard cap on
    // angular velocity that makes hairpins physically unable to spin the
    // camera fast, however sharp they are.
    this.spine.getTangentAt(s, _stan)
    _targetDir.set(_stan.x, 0, _stan.z)
    if (_targetDir.lengthSq() < 1e-8) _targetDir.copy(this._headingDir)
    else _targetDir.normalize()
    const maxYawStep = THREE.MathUtils.degToRad(this.maxYawRateDeg) * Math.max(dt, 0)
    const slewed = slewHeading(this._headingDir, _targetDir, maxYawStep)
    this._headingDir.set(slewed.x, 0, slewed.z)

    // 2) position: fixed arm/lift behind the spine along that same slewed
    // heading, then a long critical-damping pass on top ("lisser énormément").
    this._solvePosition(s, _desiredPos)
    const fp = dt <= 0 ? 1 : 1 - Math.pow(2, -dt / this.posHalfLife)
    this._pos.lerp(_desiredPos, fp)
    this.camera.position.copy(this._pos)

    this._aim(dt, s, arrived)
  }

  // 3) orientation: solve the pitch that puts the real subject (the "point
  // d'avancée") at targetNdcY, rate-limit that pitch the same way as yaw,
  // then build a roll-free look-at quaternion — this rig never banks, since
  // roll is rotation too and the brief wants almost none.
  _aim(dt, s, arrived) {
    this.curve.getPointAt(s, _subj)
    this.controls.target.copy(_subj) // grabbing OrbitControls pivots around the rider, not empty air
    _diff.subVectors(_subj, this._pos)

    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    let targetPitch = solvePitchForNdcY(_diff, this._headingDir, this.targetNdcY, vFov)
    targetPitch = THREE.MathUtils.clamp(targetPitch, -1.1, 1.1) // guard degenerate geometry (~63°)
    if (dt <= 0) {
      this._pitch = targetPitch
    } else {
      const maxPitchStep = THREE.MathUtils.degToRad(this.maxPitchRateDeg) * dt
      this._pitch += THREE.MathUtils.clamp(targetPitch - this._pitch, -maxPitchStep, maxPitchStep)
    }

    _fwd.copy(this._headingDir).multiplyScalar(Math.cos(this._pitch))
    _fwd.y = Math.sin(this._pitch)
    _fwd.normalize()
    _lookAt.copy(this._pos).add(_fwd)
    this._m.lookAt(this._pos, _lookAt, this._up)
    this._q.setFromRotationMatrix(this._m)

    const angle = this.camera.quaternion.angleTo(this._q)
    if (dt <= 0 || angle < 1e-5) {
      this.camera.quaternion.copy(this._q)
    } else {
      const fr = 1 - Math.pow(2, -dt / this.rotHalfLife)
      this.camera.quaternion.slerp(this._q, fr)
    }

    if (arrived && angle < 0.001) { this.active = false; this.onDone?.() }
  }
}

const _stan = new THREE.Vector3()
const _spinePt = new THREE.Vector3()
const _subj = new THREE.Vector3()
const _diff = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _lookAt = new THREE.Vector3()
const _targetDir = new THREE.Vector3()
const _desiredPos = new THREE.Vector3()
