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
  // sampleGround(x, z) → terrain surface height at world XZ
  constructor({ camera, controls, sampleGround }) {
    this.camera = camera
    this.controls = controls
    this.sampleGround = sampleGround
    this.active = false
    this.t = 0
    this.onDone = null

    // ---- contract fields (read by main.js and/or the tests) ----
    this.arm = 4.5 // baseline standoff; _standoffMul reports the rail's REALIZED distance against it
    this.clearance = 2.6
    this.minPitchRad = -0.45 // directorial look-down floor...
    this.bottomKeepNdcY = -0.82 // ...pierced ONLY to keep the head above the frame bottom
    this._standoffMul = 1.3
    this._pos = new THREE.Vector3()
    this._headingDir = new THREE.Vector3(0, 0, 1)
    this._pitch = 0

    // ---- bake tuning ----
    this.railSamples = 240 // Viterbi columns over the whole track
    this.azimuths = [-0.9, -0.45, 0, 0.45, 0.9] // rad around directly-behind
    // (distance, lift) rows — every row keeps lift/distance ≈ 0.4, inside
    // tan(|minPitchRad|), so a centred head never demands a floor-piercing
    // pitch by construction (Nesky: pitch and distance move together)
    this.standoffs = [[5.5, 2.2], [8.2, 3.3], [11.5, 4.6]]
    this.visSteps = 7 // heightfield samples per bake sightline
    this.aheadCols = 4 // a candidate must also see the head this far ahead — the anticipation
    this.dollyPeriodCols = 80 // the preferred row breathes along the route: wide, closer, wide

    // ---- runtime tuning ----
    this.posHalfLife = 0.35 // s — XZ approach to the rail
    this.posHalfLifeY = 0.4 // s — light: the RAIL is already smooth; heavy runtime Y lag just dragged the camera under climbing terrain for the hard floor to catch (measured 1.5-unit floor snaps)
    this.maxYawRateDeg = 90
    this.maxPitchRateDeg = 85
    this.rotHalfLife = 0.09 // s — short: aim lag grows with orbit speed (measured)
    this.floorStiffness = 60 // ground BOUNCE spring (explicit ask), under-damped
    this.floorDamping = 7
    this._yVel = 0
    this._lastY = null

    this._q = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3(0, 1, 0)
  }

  // ---- bake ----------------------------------------------------------------

  _sight(tx, ty, tz, cx, cy, cz) {
    const g = this.sampleGround
    if (!g) return true
    for (let i = 1; i <= this.visSteps; i++) {
      const t = i / this.visSteps
      if (g(tx + (cx - tx) * t, tz + (cz - tz) * t) + 0.35 > ty + (cy - ty) * t) return false
    }
    return true
  }

  // Builds this.curve (subject) and this.rail (baked camera path). Touches
  // NOTHING about the current pose — that split is what lets retarget()
  // continue a flight. Returns false on degenerate input, leaving prior
  // curves untouched.
  _buildCurves(worldPts) {
    if (!worldPts || worldPts.length < 2) return false
    const span = worldPts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - worldPts[i - 1].x, p.z - worldPts[i - 1].z) : 0), 0)
    if (span < 1e-3) return false

    // Subject curve: light smoothing only — switchbacks intact, this IS the
    // head. Y gets a much heavier low-pass for everything the camera reads:
    // drape noise on a balcony trail is tens of metres of fake height.
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

    // ---- Viterbi over candidate camera states ----
    const N = Math.max(24, Math.min(this.railSamples, subjV.length * 2))
    const P = new Array(N)
    const T = new Float64Array(N) // smoothed travel bearing per column
    const pt = new THREE.Vector3(), tn = new THREE.Vector3()
    for (let i = 0; i < N; i++) {
      const s = i / (N - 1)
      curve.getPointAt(s, pt); P[i] = pt.clone()
      curve.getTangentAt(s, tn); T[i] = Math.atan2(tn.x, tn.z)
    }
    // unwrap then blur the bearings: raw tangents whip through switchbacks;
    // the rail should sweep one arc through a whole staircase of them
    for (let i = 1; i < N; i++) {
      let d = T[i] - T[i - 1]
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      T[i] = T[i - 1] + d
    }
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 1; i < N - 1; i++) T[i] = (T[i - 1] + T[i] * 2 + T[i + 1]) / 4
    }

    const A = this.azimuths.length, D = this.standoffs.length, K = A * D
    const posOf = (i, k, out) => {
      const az = T[i] + Math.PI + this.azimuths[k % A]
      const so = this.standoffs[(k / A) | 0]
      out[0] = P[i].x + Math.sin(az) * so[0]
      out[2] = P[i].z + Math.cos(az) * so[0]
      out[1] = P[i].y + so[1]
      if (this.sampleGround) out[1] = Math.max(out[1], this.sampleGround(out[0], out[2]) + this.clearance)
    }
    const tmp = [0, 0, 0]
    const nodeCost = new Float64Array(N * K)
    for (let i = 0; i < N; i++) {
      const ahead = P[Math.min(N - 1, i + this.aheadCols)]
      // the dolly breathes: the preferred standoff row wanders 0..2 along the
      // route so the shot varies (wide, closer, wide) even where visibility
      // alone would freeze one choice forever
      const preferRow = 1 + Math.sin((i / this.dollyPeriodCols) * 2 * Math.PI)
      for (let k = 0; k < K; k++) {
        posOf(i, k, tmp)
        let c = 0
        if (!this._sight(P[i].x, P[i].y + 0.3, P[i].z, tmp[0], tmp[1], tmp[2])) c += 30 // blind NOW — near-forbidden
        if (!this._sight(ahead.x, ahead.y + 0.3, ahead.z, tmp[0], tmp[1], tmp[2])) c += 8 // blind SOON — the anticipation
        c += Math.abs(this.azimuths[k % A]) * 1.1 // prefer behind-ish
        c += Math.abs(((k / A) | 0) - preferRow) * 2.2 // dolly preference
        nodeCost[i * K + k] = c
      }
    }
    let prev = new Float64Array(K), next = new Float64Array(K)
    const back = new Int16Array(N * K)
    const cA = new Float64Array(K * 3), cB = new Float64Array(K * 3)
    for (let k = 0; k < K; k++) {
      prev[k] = nodeCost[k]
      posOf(0, k, tmp); cA[k * 3] = tmp[0]; cA[k * 3 + 1] = tmp[1]; cA[k * 3 + 2] = tmp[2]
    }
    for (let i = 1; i < N; i++) {
      for (let k = 0; k < K; k++) { posOf(i, k, tmp); cB[k * 3] = tmp[0]; cB[k * 3 + 1] = tmp[1]; cB[k * 3 + 2] = tmp[2] }
      for (let k = 0; k < K; k++) {
        let bestC = Infinity, bestJ = 0
        for (let j = 0; j < K; j++) {
          const dx = cB[k * 3] - cA[j * 3], dy = cB[k * 3 + 1] - cA[j * 3 + 1], dz = cB[k * 3 + 2] - cA[j * 3 + 2]
          const cont = Math.sqrt(dx * dx + dy * dy + dz * dz)
          // superlinear continuity: gentle drift is nearly free, jumps are punished
          const c = prev[j] + cont * 0.9 + cont * cont * 0.05
          if (c < bestC) { bestC = c; bestJ = j }
        }
        next[k] = bestC + nodeCost[i * K + k]
        back[i * K + k] = bestJ
      }
      ;[prev, next] = [next, prev]
      cA.set(cB)
    }
    let kBest = 0
    for (let j = 1; j < K; j++) if (prev[j] < prev[kBest]) kBest = j
    const chain = new Array(N)
    for (let i = N - 1; i >= 0; i--) { chain[i] = kBest; kBest = back[i * K + kBest] }

    // discrete chain → smoothed rail → exact ground re-validation (smoothing
    // can dip a pinned corner back under a ridge; the floor is non-negotiable)
    let rail = chain.map((kk, i) => { posOf(i, kk, tmp); return { x: tmp[0], y: tmp[1], z: tmp[2] } })
    rail = smoothPath(rail, 3, 3)
    if (this.sampleGround) {
      for (const p of rail) {
        const floor = this.sampleGround(p.x, p.z) + this.clearance
        if (p.y < floor) p.y = floor
      }
      rail = smoothPath(rail, 1, 2)
      for (const p of rail) {
        const floor = this.sampleGround(p.x, p.z) + this.clearance
        if (p.y < floor) p.y = floor
      }
    }
    const railCurve = new THREE.CatmullRomCurve3(rail.map((p) => new THREE.Vector3(p.x, p.y, p.z)), false, 'centripetal', 0.5)
    railCurve.arcLengthDivisions = 600
    railCurve.updateArcLengths()

    this.curve = curve
    this.rail = railCurve
    return true
  }

  // ---- lifecycle -----------------------------------------------------------

  // worldPts: ordered GPX track points at ground level (direction = order).
  // seedAt: path fraction to seat the initial pose at (resume mid-track).
  start(worldPts, { duration = 30, seedAt = 0 } = {}) {
    this.active = false
    if (!this._buildCurves(worldPts)) return false
    this.duration = duration
    this.t = THREE.MathUtils.clamp(seedAt, 0, 1)
    this.rail.getPointAt(this.t, this._pos)
    this._yVel = 0
    this._lastY = null
    this.camera.position.copy(this._pos)
    this._aim(0, this.t, false) // dt=0 → snap, no slew-in lurch
    this.active = true
    return true
  }

  // Leg handover: swap onto a NEW track's curves WITHOUT re-seating
  // position/heading/pitch/t — the runtime damping then eases the camera onto
  // the new rail, one continuous shot. Degenerate input leaves the running
  // flight (curve identity included) untouched.
  retarget(worldPts) {
    return this._buildCurves(worldPts)
  }

  stop() { this.active = false }

  update(dt) {
    if (!this.active || !this.curve) return
    this.t = Math.min(1, this.t + dt / (this.duration || 30))
    this._applyPose(dt, trapezoid(this.t), this.t >= 1)
  }

  // Follow mode: the caller hands in its own progress every frame (the reveal
  // head and the camera read the same number — they cannot drift apart).
  updateAt(dt, s) {
    if (!this.active || !this.curve) return
    const clamped = THREE.MathUtils.clamp(s, 0, 1)
    this.t = clamped
    this._applyPose(dt, clamped, clamped >= 1)
  }

  // Suspend-mode helpers (user grabbing OrbitControls — see main.js): keep the
  // pivot on the advancing head; re-anchor the pose to wherever the user left
  // the camera so resume eases out instead of snapping.
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

  // ---- runtime -------------------------------------------------------------

  _applyPose(dt, s, arrived) {
    this.rail.getPointAt(s, _desired)
    this.curve.getPointAt(s, _subj)

    if (dt <= 0) this._pos.copy(_desired)
    else {
      this._pos.x = damp(this._pos.x, _desired.x, this.posHalfLife, dt)
      this._pos.z = damp(this._pos.z, _desired.z, this.posHalfLife, dt)
      this._pos.y = damp(this._pos.y, _desired.y, this.posHalfLifeY, dt)
    }

    // ground BOUNCE: spring floor, slightly under-damped (that IS the
    // rebound), hard emergency floor below — clipping into rock is a bug
    if (this.sampleGround) {
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

    // safety net only — see the module header. The pull shortens the whole 3D
    // offset, so Y can dip back under ground: the hard floor re-applies AFTER,
    // or the net itself becomes the clip-through it exists to prevent.
    const r = resolveOcclusion(_subj, this._pos, this.sampleGround, { steps: 10, skin: 0.35, minT: 0.35 })
    if (r.pulled) {
      this._pos.set(r.x, r.y, r.z)
      if (this.sampleGround) {
        const hard = this.sampleGround(this._pos.x, this._pos.z) + this.clearance * 0.7
        if (this._pos.y < hard) { this._pos.y = hard; this._yVel = Math.max(this._yVel, 0) }
      }
    }

    // vertical speed cap, the LAST stage: the spring floor and the safety net
    // are both allowed to ASK for big vertical moves, but the realized camera
    // spreads them over frames — a crane does not teleport. The hard floor
    // still outranks the cap: clipping into rock is worse than a fast climb.
    if (dt > 0) {
      if (this._lastY !== null) {
        const maxDy = 3.5 * Math.min(dt, 1 / 20)
        const dy = this._pos.y - this._lastY
        if (Math.abs(dy) > maxDy) this._pos.y = this._lastY + Math.sign(dy) * maxDy
        if (this.sampleGround) {
          const hard = this.sampleGround(this._pos.x, this._pos.z) + this.clearance * 0.7
          if (this._pos.y < hard) this._pos.y = hard
        }
      }
      this._lastY = this._pos.y
    } else this._lastY = this._pos.y

    this.camera.position.copy(this._pos)
    this._standoffMul = this._pos.distanceTo(_subj) / this.arm
    this._aim(dt, s, arrived)
  }

  _aim(dt, s, arrived) {
    this.curve.getPointAt(s, _subj)
    this.controls.target.copy(_subj) // grabbing OrbitControls pivots around the head
    _diff.subVectors(_subj, this._pos)

    // horizontal: face the head, rate-capped
    _tDir.set(_diff.x, 0, _diff.z)
    if (_tDir.lengthSq() < 1e-8) _tDir.copy(this._headingDir)
    _tDir.normalize()
    const maxYawStep = THREE.MathUtils.degToRad(this.maxYawRateDeg) * Math.max(dt, 0)
    if (dt <= 0) this._headingDir.copy(_tDir)
    else {
      const sl = slewHeading(this._headingDir, _tDir, maxYawStep)
      this._headingDir.set(sl.x, 0, sl.z)
    }

    // pitch: head in the lower third of frame (the summits fill the rest).
    // keep = the pitch that pins the head at the bottom edge; the floor may be
    // pierced only down to keep, never past it. keep >= desired always (a
    // higher on-screen placement needs MORE down-pitch), so one clamp chain
    // expresses the whole contract.
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    let target = solvePitchForNdcY(_diff, this._headingDir, -0.3, vFov)
    const keep = solvePitchForNdcY(_diff, this._headingDir, this.bottomKeepNdcY, vFov)
    target = Math.min(Math.max(target, this.minPitchRad), keep)
    target = THREE.MathUtils.clamp(target, -1.45, 1.1)
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
