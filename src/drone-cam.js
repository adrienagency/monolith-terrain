// GPX follow camera — REBUILT FROM SCRATCH as a PRECOMPUTED RAIL (2026-07-19).
//
// Six reactive rewrites all failed the same way in the field: oscillation,
// terrain burial, losing the head. The research verdict (Nesky "50 Game
// Camera Mistakes" GDC 2014; Cinemachine source; Galvane et al.
// "Camera-on-rails" MIG 2015; Oskam et al. SCA 2009) is that every one of
// those bugs is the price of GUESSING the future one frame at a time — and
// this app never has to guess. The whole GPX path and the whole terrain are
// known at load. Cinemachine's own manual documents switchbacks defeating
// reactive lookahead structurally; for a rail they are just samples.
//
// So the camera path is now SOLVED OFFLINE, the way a film crew lays dolly
// track after scouting the course:
//
//   BAKE (start/retarget, a few ms): sample the subject path; per sample,
//   build candidate camera states (azimuth around the smoothed travel
//   direction x standoff row, every row sharing a look-down ratio within the
//   pitch floor — Nesky: couple pitch and distance, never move one alone);
//   score each for subject VISIBILITY (now + a few seconds ahead), terrain
//   CLEARANCE and FRAMING; then a Viterbi pass extracts the single
//   minimum-cost chain through ALL samples at once (edge cost = continuity,
//   superlinear so jumps are punished hard). The discrete chain is smoothed,
//   then re-validated against the ground.
//
//   RUNTIME (updateAt): evaluate the rail at headT, one light critically-
//   damped approach (frame-rate independent — the runtime layer absorbs
//   scrubbing and speed changes, it must NOT redo the offline work), the
//   spring-bounce ground floor (explicit user ask), and a rate-capped aim
//   that always faces the head. resolveOcclusion stays as a safety net that
//   a well-baked rail never triggers — if it fires often, the RAIL is
//   mis-baked and that is the bug to fix, not the net to tune.
//
// The pure helpers below are pinned by test contracts and kept verbatim.

import * as THREE from 'three'

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
// small window damps GPS jitter without cutting corners hard; a large
// window/passes becomes a heavy low-pass that erases corners on purpose.
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

// Rotate a horizontal unit heading toward a target heading by at most maxStep
// radians — always the short way around. Whatever calls this gets a heading
// that CANNOT change faster than maxStep per call.
export function slewHeading(curDir, targetDir, maxStep) {
  const curAngle = Math.atan2(curDir.x, curDir.z)
  const targetAngle = Math.atan2(targetDir.x, targetDir.z)
  let delta = (targetAngle - curAngle) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  else if (delta < -Math.PI) delta += Math.PI * 2
  const clamped = Math.max(-maxStep, Math.min(maxStep, delta))
  const a = curAngle + clamped
  return { x: Math.sin(a), z: Math.cos(a) }
}

// Closed-form pitch (radians, +up from horizontal) that puts `diff`
// (subject-minus-camera, world space) at NDC.y = targetNdcY, for a camera
// whose horizontal facing is `forward0` (unit, y=0) and vertical fov vFovRad.
//
// Derivation: rotating forward0 by pitch a around the horizontal right axis
// gives forward(a) = forward0·cos(a) + up0·sin(a). Projecting `diff`:
//   A = diff·up0 = diff.y        (unaffected by a)
//   B = diff·forward0            (unaffected by a)
//   ndc.y(a) = (A·cos(a) − B·sin(a)) / ((B·cos(a) + A·sin(a))·tan(vFov/2))
// Setting ndc.y(a) = T and solving:
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

// Forward evaluator — the exact ndc.y(a) formula above at a given pitch:
// solvePitchForNdcY answers "what pitch puts it at T", this answers "given
// the current pitch, where IS it". Kept as its tested inverse.
export function ndcYForPitch(diff, forward0, pitch, vFovRad) {
  const A = diff.y
  const B = diff.x * forward0.x + diff.z * forward0.z
  const k = Math.tan(vFovRad / 2)
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  return (A * c - B * s) / ((B * c + A * s) * k)
}

// "Spring arm" camera collision: march a ray from the SUBJECT outward to the
// camera's desired position against sampleGround(x,z); where the ground first
// pokes through the line, pull the camera straight back in along that SAME
// ray to just before it (one step of buffer plus a skin margin). minT floors
// the collapse as a fraction of the original distance so a subject against a
// wall can't zero the camera onto themselves. Returns {x,y,z,pulled}.
export function resolveOcclusion(subjPt, camPos, sampleGround, { steps = 14, skin = 0.35, minT = 0.2 } = {}) {
  if (!sampleGround) return { x: camPos.x, y: camPos.y, z: camPos.z, pulled: false }
  const dx = camPos.x - subjPt.x
  const dy = camPos.y - subjPt.y
  const dz = camPos.z - subjPt.z
  let blockT = -1
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const gh = sampleGround(subjPt.x + dx * t, subjPt.z + dz * t)
    const lineY = subjPt.y + dy * t
    if (gh + skin > lineY) { blockT = t; break }
  }
  if (blockT < 0) return { x: camPos.x, y: camPos.y, z: camPos.z, pulled: false }
  const safeT = Math.max(minT, blockT - 1 / steps)
  return { x: subjPt.x + dx * safeT, y: subjPt.y + dy * safeT, z: subjPt.z + dz * safeT, pulled: true }
}

// trapezoid ease so a timed flight accelerates in and decelerates out
function trapezoid(t, ramp = 0.16) {
  if (t < ramp) return (t * t) / (2 * ramp) / (1 - ramp)
  if (t > 1 - ramp) { const u = 1 - t; return 1 - (u * u) / (2 * ramp) / (1 - ramp) }
  return (t - ramp / 2) / (1 - ramp)
}

// frame-rate-independent exponential approach (Lowe, Game Programming Gems 4)
const damp = (cur, target, halfLife, dt) => cur + (target - cur) * (1 - Math.pow(2, -dt / halfLife))

export class DroneCam {
  // sampleGround(x, z) -> terrain surface height at world XZ
  constructor({ camera, controls, sampleGround }) {
    this.camera = camera
    this.controls = controls
    this.sampleGround = sampleGround
    this.active = false
    this.t = 0
    this.onDone = null

    // ---- contract fields (read by main.js and/or the tests) ----
    this.arm = 4.5
    this.clearance = 2.6
    this.minPitchRad = -0.45 // kept for API compat; the user's tilt owns pitch now
    this.bottomKeepNdcY = -0.82
    this._standoffMul = 1.3
    this._pos = new THREE.Vector3()
    this._headingDir = new THREE.Vector3(0, 0, 1)
    this._pitch = 0

    // ---- THE VIEW — user-owned, never auto-changed -----------------------
    // FINAL DESIGN (field decision after every automatic system failed the
    // eye test): the camera holds ONE fixed relative view around the head and
    // simply translates with it. The user picks the view on a numpad-style
    // 3x3 (1..9, 5 = top-down), zooms with +/- and tilts with the arrows —
    // see setView()/zoomBy()/tiltBy() and src/ui/follow-pad.js.
    this.viewBearingDeg = 90 // compass deg the camera sits AT from the head (90 = east of it)
    this.topDown = false // view 5
    this.dist = 11 // standoff, world units ('elle suit de loin')
    this.tiltDeg = 24 // camera height angle above the head ('toujours un angle')

    // ---- runtime tuning ----
    this.posHalfLife = 0.3 // s — the small follow latency (anti-nausea)
    this.posHalfLifeY = 0.4
    this.maxYawRateDeg = 120
    this.maxPitchRateDeg = 160
    this.rotHalfLife = 0.09
    this.floorStiffness = 60 // ground BOUNCE spring, under-damped on purpose
    this.floorDamping = 7
    this._yVel = 0
    this._lastY = null
    this._occT = 0
    this._occW = 0

    this._q = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3(0, 1, 0)
  }

  // ---- user view controls (keyboard 1..9, +/-, arrows; clickable pad) ----

  // Numpad mapping, map north-up: 8=N 9=NE 6=E 3=SE 2=S 1=SW 4=W 7=NW around
  // the head; 5 = top-down. The bearing is WORLD-anchored — the camera never
  // rotates on its own ('la caméra ne change pas d'angle de vue').
  setView(n) {
    const compass = { 8: 0, 9: 45, 6: 90, 3: 135, 2: 180, 1: 225, 4: 270, 7: 315 }
    if (n === 5) { this.topDown = true; return }
    if (compass[n] === undefined) return
    this.topDown = false
    this.viewBearingDeg = compass[n]
  }

  zoomBy(factor) { this.dist = THREE.MathUtils.clamp(this.dist * factor, 3, 40) }
  tiltBy(deltaDeg) { this.tiltDeg = THREE.MathUtils.clamp(this.tiltDeg + deltaDeg, 6, 80) }

  // ---- bake: just the subject curve (Y heavily low-passed) ---------------
  _buildCurves(worldPts) {
    if (!worldPts || worldPts.length < 2) return false
    const span = worldPts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - worldPts[i - 1].x, p.z - worldPts[i - 1].z) : 0), 0)
    if (span < 1e-3) return false
    const subjSpacing = Math.max(0.4, span / 260)
    const raw = smoothPath(resamplePath(worldPts, subjSpacing), 2, 2)
    if (raw.length < 2) return false
    const ys = raw.map((p) => p.y)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < ys.length - 1; i++) {
        let sum = 0, n = 0
        for (let j = Math.max(0, i - 6); j <= Math.min(ys.length - 1, i + 6); j++) { sum += ys[j]; n++ }
        ys[i] = sum / n
      }
    }
    const subjV = raw.map((p, i) => new THREE.Vector3(p.x, ys[i], p.z))
    if (subjV.length < 2) return false
    const curve = new THREE.CatmullRomCurve3(subjV, false, 'centripetal', 0.5)
    curve.arcLengthDivisions = 800
    curve.updateArcLengths()
    this.curve = curve
    // default view: SIDE-ON to the route's overall direction ('place la
    // caméra sur le côté'), computed once — never re-aimed mid-flight
    const a = subjV[0], b = subjV[subjV.length - 1]
    const routeBearing = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
    this.viewBearingDeg = ((routeBearing + 90) % 360 + 360) % 360
    return true
  }

  _desiredFor(s, out) {
    this.curve.getPointAt(s, _subj)
    if (this.topDown) {
      out.set(_subj.x, _subj.y + this.dist * 1.4, _subj.z + 0.001)
      return
    }
    const az = (this.viewBearingDeg * Math.PI) / 180
    const tilt = (this.tiltDeg * Math.PI) / 180
    const horiz = this.dist * Math.cos(tilt)
    out.set(
      _subj.x + Math.sin(az) * horiz,
      _subj.y + this.dist * Math.sin(tilt),
      _subj.z + Math.cos(az) * horiz
    )
  }

  // ---- lifecycle ----------------------------------------------------------

  start(worldPts, { duration = 30, seedAt = 0 } = {}) {
    this.active = false
    if (!this._buildCurves(worldPts)) return false
    this.duration = duration
    this.t = THREE.MathUtils.clamp(seedAt, 0, 1)
    this._desiredFor(this.t, this._pos)
    this._yVel = 0
    this._lastY = null
    this.camera.position.copy(this._pos)
    this._aim(0, this.t, false)
    this.active = true
    return true
  }

  // Leg handover: new curve, pose untouched — the damping eases over.
  // Degenerate input leaves the running flight (curve identity) untouched.
  retarget(worldPts) {
    const keepBearing = this.viewBearingDeg // a handover must not re-aim the user's view
    const ok = this._buildCurves(worldPts)
    if (ok) this.viewBearingDeg = keepBearing
    return ok
  }

  stop() { this.active = false }

  update(dt) {
    if (!this.active || !this.curve) return
    this.t = Math.min(1, this.t + dt / (this.duration || 30))
    this._applyPose(dt, trapezoid(this.t), this.t >= 1)
  }

  updateAt(dt, s) {
    if (!this.active || !this.curve) return
    const clamped = THREE.MathUtils.clamp(s, 0, 1)
    this.t = clamped
    this._applyPose(dt, clamped, clamped >= 1)
  }

  followPivot(s) {
    if (!this.curve) return
    this.curve.getPointAt(THREE.MathUtils.clamp(s, 0, 1), _subj)
    this.controls.target.copy(_subj)
  }

  syncToCamera() {
    this._pos.copy(this.camera.position)
    _fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion)
    const h = Math.hypot(_fwd.x, _fwd.z)
    if (h > 1e-6) {
      this._headingDir.set(_fwd.x / h, 0, _fwd.z / h)
      this._pitch = Math.atan2(_fwd.y, h)
    }
  }

  // ---- runtime ------------------------------------------------------------

  _applyPose(dt, s, arrived) {
    this._desiredFor(s, _desired)
    this.curve.getPointAt(s, _subj)

    if (dt <= 0) this._pos.copy(_desired)
    else {
      this._pos.x = damp(this._pos.x, _desired.x, this.posHalfLife, dt)
      this._pos.z = damp(this._pos.z, _desired.z, this.posHalfLife, dt)
      this._pos.y = damp(this._pos.y, _desired.y, this.posHalfLifeY, dt)
    }

    // ground BOUNCE: soft spring under clearance, hard floor below
    if (this.sampleGround && !this.topDown) {
      const h = Math.min(Math.max(dt, 1 / 240), 1 / 20)
      const gc = this.sampleGround(this._pos.x, this._pos.z)
      const floor = gc + this.clearance
      if (this._pos.y < floor) {
        this._yVel += (floor - this._pos.y) * this.floorStiffness * h
        this._yVel *= Math.exp(-this.floorDamping * h)
        this._pos.y += this._yVel * h
      } else this._yVel *= Math.exp(-5 * h)
      const hard = gc + this.clearance * 0.7
      if (this._pos.y < hard) { this._pos.y = hard; this._yVel = Math.max(this._yVel, 0) }
    }

    // de-occlusion net, gated + damped (Cinemachine pattern) — the user's
    // distant side views rarely need it, but a ridge can still slide between
    const r = resolveOcclusion(_subj, this._pos, this.sampleGround, { steps: 10, skin: 0.35, minT: 0.35 })
    this._occT = r.pulled ? (this._occT || 0) + Math.max(dt, 0) : 0
    const occWant = r.pulled && this._occT > 0.15 ? 1 : 0
    this._occW = damp(this._occW || 0, occWant, occWant ? 0.15 : 0.6, Math.max(dt, 1 / 240))
    if (r.pulled && this._occW > 0.01) {
      const w = Math.min(this._occW, 1)
      this._pos.x += (r.x - this._pos.x) * w
      this._pos.y += (r.y - this._pos.y) * w
      this._pos.z += (r.z - this._pos.z) * w
      if (this.sampleGround) {
        const hard = this.sampleGround(this._pos.x, this._pos.z) + this.clearance * 0.7
        if (this._pos.y < hard) { this._pos.y = hard; this._yVel = Math.max(this._yVel, 0) }
      }
    }

    this.camera.position.copy(this._pos)
    this._standoffMul = this._pos.distanceTo(_subj) / this.arm
    this._aim(dt, s, arrived)
  }

  _aim(dt, s, arrived) {
    this.curve.getPointAt(s, _subj)
    this.controls.target.copy(_subj)
    _diff.subVectors(_subj, this._pos)

    _tDir.set(_diff.x, 0, _diff.z)
    if (_tDir.lengthSq() < 1e-8) _tDir.copy(this._headingDir)
    _tDir.normalize()
    const maxYawStep = THREE.MathUtils.degToRad(this.maxYawRateDeg) * Math.max(dt, 0)
    if (dt <= 0) this._headingDir.copy(_tDir)
    else {
      const sl = slewHeading(this._headingDir, _tDir, maxYawStep)
      this._headingDir.set(sl.x, 0, sl.z)
    }

    // pitch: LOCKED on the head, dead centre — the only softness is latency
    const horiz = Math.hypot(_diff.x, _diff.z)
    const target = THREE.MathUtils.clamp(Math.atan2(_diff.y, Math.max(horiz, 1e-6)), -1.5, 1.2)
    if (dt <= 0) this._pitch = target
    else {
      const maxPitchStep = THREE.MathUtils.degToRad(this.maxPitchRateDeg) * dt
      this._pitch += THREE.MathUtils.clamp(target - this._pitch, -maxPitchStep, maxPitchStep)
    }

    _fwd.copy(this._headingDir).multiplyScalar(Math.cos(this._pitch))
    _fwd.y = Math.sin(this._pitch)
    _fwd.normalize()
    _look.copy(this._pos).add(_fwd)
    this._m.lookAt(this._pos, _look, this._up)
    this._q.setFromRotationMatrix(this._m)
    const angle = this.camera.quaternion.angleTo(this._q)
    if (dt <= 0 || angle < 1e-5) this.camera.quaternion.copy(this._q)
    else this.camera.quaternion.slerp(this._q, 1 - Math.pow(2, -dt / this.rotHalfLife))

    if (arrived && angle < 0.001) { this.active = false; this.onDone?.() }
  }
}

const _subj = new THREE.Vector3()
const _desired = new THREE.Vector3()
const _diff = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _look = new THREE.Vector3()
const _tDir = new THREE.Vector3()
