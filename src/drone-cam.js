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
//   · Arm/lift ("traveling", not chase) — standing well back is the primary
//     anti-nausea lever (a wiggle subtends a smaller screen angle from
//     farther away). Task 20 makes the distance CONTENT-AWARE rather than
//     constant (see buildDramaProfile()/dramaStandoffMul() below): it reads
//     no more than the spine already exposes — its own smoothed elevation
//     (grade) and its own heading (bend) — never the raw track, same rule as
//     everywhere else in this file. Bend is deliberately the thing that
//     widens the shot, not tightens it: a bend is exactly where the rig
//     would need to turn faster, so this is what pays for a materially
//     closer baseline without moving the yaw-rate cap.
//   · DEAD-ZONE framing, not continuous framing (task 13). A fixed NDC box
//     (this.deadzone) is the region the tracked point must stay inside —
//     like a helicopter pilot tailing a car: while the subject sits inside
//     the box, NEITHER yaw nor pitch corrects at all, the rig just keeps
//     flying its current bearing (arm/lift still travel behind the spine,
//     so it keeps moving). Only once the subject nears/exits the box
//     (this.deadzoneMargin inset, so correction starts a touch before the
//     true edge — no on/off flip-flop right at the boundary) does a
//     correction target engage — solved exactly the same way framing always
//     was (solvePitchForNdcY(), see below), then eased in through the SAME
//     yaw/pitch rate caps as everything else, never a snap.
//   · Horizontal (yaw) framing REUSES solvePitchForNdcY() rather than a
//     bespoke solver: NDC.x is the identical rotate-and-project problem as
//     NDC.y, just in the (forward,right) plane instead of (forward,up) — the
//     derivation never assumed which horizontal axis it rotates around, so
//     relabeling "up" as "right" and vFov as the horizontal FOV gets yaw for
//     free (see _applyPose()). ndcYForPitch() is the forward evaluator
//     (given diff/heading/pitch, what NDC.y results) used to measure whether
//     the subject is CURRENTLY inside the box before deciding to correct.
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

// ---- content-aware zoom drama (task 20, unit-tested) ------------------------

// From per-sample elevation + subject-wobble arrays (evenly spaced along the
// SPINE's own arc length — see start()), derive two [0..1] "drama" profiles
// the standoff multiplier below reads:
//   · climb — how hard the terrain is pitching (rise/run magnitude, either
//     direction), smoothed then given a forward MAX-lookahead so a col's
//     pull-in begins before the col, not at it (real operators anticipate).
//   · bend — how far the REAL (lightly-smoothed) subject path is currently
//     wandering sideways off the spine, i.e. `wobble` in start()'s caller.
//     This, not the spine's own heading, is the thing that actually drives
//     the dead-zone's x-correction (see _applyPose()): the spine is heavily
//     smoothed on purpose, so a switchback climb can read as almost straight
//     on the spine while the subject is still swinging hard side to side
//     underneath it — measuring the spine's tangent alone would miss
//     exactly the sections a tighter camera can least afford. bend gets its
//     OWN short forward lookahead too ("anticipating the spine's bends" —
//     widen a beat before a technical section, not mid-swing through it).
// Both are box-blurred first (same shape as smoothPath, just on a scalar
// array) so a single noisy sample can't spike the multiplier for one frame.
export function buildDramaProfile(elevs, wobble, sampleSpacingWorld, {
  gradeNorm = 0.1,
  bendNorm = 3,
  lookaheadFrac = 0.03,
  bendLookaheadFrac = 0.02,
  smoothPasses = 3,
  smoothWin = 3,
} = {}) {
  const n = elevs ? elevs.length : 0
  if (n < 3) return { climb: new Array(Math.max(n, 0)).fill(0), bend: new Array(Math.max(n, 0)).fill(0) }
  const spacing = Math.max(1e-6, sampleSpacingWorld)

  const grade = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1)
    const b = Math.min(n - 1, i + 1)
    grade[i] = Math.abs((elevs[b] - elevs[a]) / (spacing * (b - a || 1)))
  }
  const bendRaw = wobble.map((v) => Math.abs(v))

  const boxBlur = (arr) => {
    let cur = arr.slice()
    for (let pass = 0; pass < smoothPasses; pass++) {
      const next = new Array(n)
      for (let i = 0; i < n; i++) {
        let sum = 0, cnt = 0
        for (let j = Math.max(0, i - smoothWin); j <= Math.min(n - 1, i + smoothWin); j++) { sum += cur[j]; cnt++ }
        next[i] = sum / cnt
      }
      cur = next
    }
    return cur
  }
  const gradeSm = boxBlur(grade)
  const bendSm = boxBlur(bendRaw)

  const maxAhead = (arr, frac) => {
    const lookaheadSamples = Math.max(0, Math.round(frac * n))
    const out = new Array(n)
    for (let i = 0; i < n; i++) {
      let m = arr[i]
      for (let j = i + 1; j <= Math.min(n - 1, i + lookaheadSamples); j++) m = Math.max(m, arr[j])
      out[i] = m
    }
    return out
  }
  const climb = maxAhead(gradeSm, lookaheadFrac).map((v) => Math.min(1, v / gradeNorm))
  const bendOut = maxAhead(bendSm, bendLookaheadFrac).map((v) => Math.min(1, v / bendNorm))
  return { climb, bend: bendOut }
}

// Standoff multiplier (applied to this.arm/this.lift) from the drama pair at
// one sample: push IN on calm+dramatic terrain, push OUT hard on any bend
// (regardless of terrain — this is the "payment" for a closer baseline, see
// the this.arm constructor comment), and pull out generally on calm+boring
// (flat) terrain. `calm` gates BOTH the tightening and the flat-pullout terms
// so a bend never gets tightened into, only ever widened out of.
export function dramaStandoffMul(climb, bend, { pushIn = 0.28, flatPullOut = 0.55, bendPullOut = 0.95 } = {}) {
  const calm = 1 - bend
  return 1 - pushIn * climb * calm + flatPullOut * (1 - climb) * calm + bendPullOut * bend
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

// Forward evaluator — the exact ndc.y(a) formula from solvePitchForNdcY's own
// derivation comment above, evaluated at a given pitch rather than solved for
// one. Used to measure whether the tracked point is CURRENTLY inside the
// dead-zone box before deciding a correction is even needed (see
// _applyPose()/_aim() below) — solvePitchForNdcY answers "what pitch puts it
// at T", this answers "given the current pitch, where IS it".
export function ndcYForPitch(diff, forward0, pitch, vFovRad) {
  const A = diff.y
  const B = diff.x * forward0.x + diff.z * forward0.z
  const k = Math.tan(vFovRad / 2)
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  return (A * c - B * s) / ((B * c + A * s) * k)
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
    // Tuned to the ~56-unit terrain footprint; heights are exaggerated metres.
    //
    // Standoff is the single most load-bearing number in this file, because it
    // resolves what looks like a contradiction in the brief — "ne quasiment pas
    // tourner" AND "on doit toujours voir le point d'avancement". A rate-limited
    // camera cannot do both up close: capped at a few deg/s it simply can't
    // catch a subject that swings fast, so the point overshoots the frame.
    // Standing farther back shrinks the angle the same world movement subtends,
    // which fixes BOTH at once. Measured on a 12-hairpin climb (% of frames with
    // the head inside the dead-zone box / peak yaw):
    //     arm 12, lift  7 -> 64.0% / 8.3 deg/s   (too close: drifts out constantly)
    //     arm 18, lift 10 -> 83.8% / 7.9
    //     arm 26, lift 14 -> 93.9% / 6.7
    //     arm 36, lift 18 -> 96.3% / 3.2         <- chosen (task 13)
    //     arm 48, lift 24 -> 94.7% / 0.4         (starts regressing again)
    // Hence the user's own instinct — "la caméra doit être plus loin" — was the
    // fix, not a preference. Retune these two together, and re-measure both
    // numbers: pushing one without the other trades one requirement for the other.
    //
    // Task 20: "augmente de 50% le zoom de suivi live" reads as "closer", i.e.
    // the STANDOFF itself, not the FOV — so this.arm/this.lift below are now
    // 36/1.5=24 and 18/1.5=12, the literal 50%-closer baseline the user asked
    // for. Taken alone (a flat closer standoff, the arm-18 row above) that
    // regresses BOTH numbers this table exists to protect: ~84% in-box and
    // ~7.9deg/s peak yaw, against a narrower new box (see this.deadzone below)
    // that makes staying in-box strictly harder still. dramaStandoffMul() below
    // is what pays for it back: it multiplies this baseline UP well past 36
    // (toward the arm-48 row, i.e. the *safest* end of this table) whenever the
    // spine is bending, and only lets it run tighter than 24 on stretches the
    // spine itself is calm AND climbing/descending hard — a real col push-in,
    // not a blind close-in. See the buildDramaProfile()/dramaStandoffMul()
    // comment and the task-20 report for the re-measured in-box% / peak-yaw
    // numbers under this scheme.
    this.arm = 24 // baseline traveling distance behind the spine (world units) — see task-20 note above
    this.lift = 12 // baseline height above the spine's own (already-smoothed) elevation
    this.clearance = 2.6 // minimum gap kept over the ground / ridges
    // hard caps on how fast the rig is allowed to turn — THIS (not the spine
    // smoothing alone) is the actual nausea guarantee: even a pathological
    // input cannot spin the camera faster than these.
    this.maxYawRateDeg = 9 // deg/s — "ne quasiment pas tourner, ou très lentement"
    this.maxPitchRateDeg = 16 // deg/s — vertical aim may move a bit more freely than yaw
    // where a correction re-centers the tracked point once triggered: NDC y,
    // 0 = center, -1 = bottom. Recomputed for task 20's new box (below) —
    // biased toward yMin, same "look up the mountain when climbing" intent
    // as the old -0.375 had for the old box, just re-anchored: the new box's
    // own vertical middle is (-0.43+0.74)/2 = +0.155 (this box sits much
    // higher on screen than the old one), so re-centering to the box's own
    // middle would already point mostly at sky/summit with no headroom left
    // to correct further upward on a real climb. -0.15 keeps a comfortable
    // gap above deadzoneMargin's -0.37 trigger line (no flip-flop risk) while
    // still sitting in the box's own lower third, not its middle.
    this.targetNdcY = -0.15
    // NDC dead-zone box (task 20) — REPLACES the task-13 box above. Measured
    // by the user off a fresh screenshot of their own "blue frame" (image
    // 1130x604, box px x 390..735 / y 79..433 -> NDC), so — same as the
    // box it replaces — this is a literal constant tied to that screenshot,
    // not derived from any panel geometry, and NOT meant to be "tidied" back
    // to something symmetric: the user's own box is narrower in x and sits
    // noticeably higher (taller above center than below) than a centered box
    // would be. Pixel measurement has ~±0.03 slop; treat these as "tall,
    // fairly narrow, slightly high-of-centre", not as exact to 3 decimals.
    this.deadzone = { xMin: -0.31, xMax: 0.30, yMin: -0.43, yMax: 0.74 }
    // Soft inset: a correction engages this far inside the box, before the
    // point actually reaches the true edge. Without it, sitting right at the
    // boundary would flip correction on/off every frame as normal per-frame
    // noise straddles the line. Combined with re-centering to a point WELL
    // inside the box (targetNdcY/targetNdcX, not just past the margin), once
    // triggered a correction moves the point solidly back inside — it has to
    // drift all the way back out to re-trigger, so there's no flip-flop.
    this.deadzoneMargin = 0.06
    // where a horizontal correction re-centers to — the box's own midpoint,
    // since (unlike targetNdcY) there's no other established "where the
    // point belongs" convention for X yet.
    this.targetNdcX = (this.deadzone.xMin + this.deadzone.xMax) / 2
    this.posHalfLife = 0.9 // s — heavy extra smoothing on top of the already-smooth spine
    this.rotHalfLife = 0.5 // s — final orientation smoothing

    // ---- cinematic VARIATION — layered ON TOP of the arm/lift rig above,
    // not a replacement for it.
    //
    // NOTE: there used to be a decorative "orbit bias" heading wobble here
    // ("parfois elle tourne", task 16). It was removed — twice a bug:
    //   1. It was applied relative to the CURRENT heading every frame
    //      (_targetDir = heading rotated by bias), so instead of a bounded
    //      ±amp offset it INTEGRATED — the heading drifted continuously until
    //      the dead-zone correction yanked it back, a permanent limit cycle.
    //      Measured: amp 4° and amp 1.5° both produced the same one-sided
    //      drift (median NDC.x +0.15, every post-settle miss to the right,
    //      75.5% in-box); amp 0 gave 95.2% and median +0.06. Amplitude only
    //      set the drift SPEED, not its extent.
    //   2. Re-reading the brief, the turning was never decorative: "parfois
    //      elle tourne POUR BIEN GARDER LE POINT dans le suivi" — turning in
    //      service of framing, which is exactly what the dead-zone correction
    //      already does. A wobble that fights the framing box is the opposite
    //      of what was asked.
    this._breathT = 0

    // ---- CONTENT-AWARE ZOOM DRAMA (task 20) — REPLACES task 16's blind
    // sine "breathing" standoff (a fixed clock, oblivious to the route) with
    // one driven by the track's own terrain: "elle zoom beaucoup [au] passage
    // de col... et dézoome [sur les] zones à plat longues". Two signals are
    // read off the SPINE (never the raw path — same rule as everywhere else
    // in this file) once in start() and baked into a per-sample lookup table
    // (buildDramaProfile()) so _applyPose() is a cheap interpolated read, not
    // per-frame recomputation:
    //   · climb[s] — the spine's own (already-smoothed) elevation gradient,
    //     normalized by zoomGradeNorm, MAX-ahead over zoomLookaheadFrac of
    //     the route so the push-in starts BEFORE the col, the way an
    //     operator anticipates rather than reacts.
    //   · bend[s] — how far the REAL subject path wanders sideways off the
    //     spine (see start()'s `wobble` array — NOT the spine's own heading,
    //     which is too smoothed to see a switchback coming), normalized by
    //     zoomBendNorm. This is what pays for the 50%-closer baseline (see
    //     the this.arm comment above): heavy subject-vs-spine wobble is
    //     precisely where the dead-zone x-correction fires most, so
    //     dramaStandoffMul() below treats it as its OWN reason to pull the
    //     standoff wide — independent of, and overriding, whatever the
    //     terrain is doing — while only allowing the tight, close-in push on
    //     stretches that are climbing/descending hard AND calm.
    // dramaStandoffMul(climb, bend) turns the pair into a standoff
    // multiplier on this.arm/this.lift; _applyPose() eases the REALIZED
    // multiplier toward that target over zoomHalfLife seconds (a dolly move,
    // not a snap-zoom) — combined with the spatial lookahead above, the move
    // is largely complete by the time the camera reaches the feature.
    this.zoomGradeNorm = 0.1 // rise/run that reads as "full" climb drama (~10% grade)
    this.zoomBendNorm = 3 // world units of subject-vs-spine lateral wobble that reads as "full" bend
    this.zoomLookaheadFrac = 0.03 // anticipate: climb drama starts ~3% of the route early
    this.zoomBendLookaheadFrac = 0.02 // anticipate: widen ~2% of the route before a wobbly section
    this.zoomPushIn = 0.28 // max tightening (of this.arm/lift) on calm, dramatic terrain
    this.zoomFlatPullOut = 0.55 // pull-out on calm, boring (flat) terrain
    this.zoomBendPullOut = 0.95 // pull-out specifically where the spine bends — the "payment" above
    this.zoomHalfLife = 2.2 // s — how long the dolly itself takes to reach a new target (slower than posHalfLife: this is a deliberate creative move, not damping noise)
    this._dramaClimb = null // per-sample lookup tables built in start(), see buildDramaProfile()
    this._dramaBend = null
    this._standoffMul = 1

    this._pos = new THREE.Vector3()
    this._headingDir = new THREE.Vector3(0, 0, 1) // current, rate-limited facing (horizontal, unit)
    this._pitch = 0 // current, rate-limited vertical aim angle (rad, +up)
    this._q = new THREE.Quaternion()
    this._m = new THREE.Matrix4()
    this._up = new THREE.Vector3(0, 1, 0)
  }

  // Shared by start()/retarget(): builds this.curve (subject) + this.spine
  // (heavily smoothed camera path) + the baked drama profile from a fresh
  // worldPts array. Deliberately touches NOTHING about the rig's current
  // pose (position/heading/pitch/t) — that split is exactly what lets
  // retarget() continue a flight instead of re-seating it. Returns false
  // (leaving prior state untouched) on a degenerate/too-short input.
  _buildCurves(worldPts) {
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
    const curve = new THREE.CatmullRomCurve3(subjV, false, 'centripetal', 0.5)
    curve.arcLengthDivisions = 800
    curve.updateArcLengths()

    // spine: the heavily low-passed curve the camera itself actually flies.
    // ~14 control points over the WHOLE track (however long) plus a wide,
    // multi-pass box blur — a staircase of hairpins collapses into one
    // gentle arc. Every position/heading/elevation decision below reads
    // this curve, never the real path.
    const spineSpacing = Math.max(3, span / 14)
    let spineV = smoothPath(resamplePath(worldPts, spineSpacing), 6, 4).map((p) => new THREE.Vector3(p.x, p.y, p.z))
    if (spineV.length < 2) spineV = subjV.slice() // very short/degenerate track: fall back to the subject curve
    const spine = new THREE.CatmullRomCurve3(spineV, false, 'centripetal', 0.5)
    spine.arcLengthDivisions = 400
    spine.updateArcLengths()

    // content-aware zoom-drama profile (task 20) — sampled once per flight
    // into a lookup table _standoffMulAt() interpolates every frame. Two
    // signals, both read at the SAME s so they line up sample-for-sample:
    //   · elevs[i] — the spine's own (already-smoothed) elevation.
    //   · wobble[i] — how far the REAL subject curve (curve, the
    //     lightly-smoothed path — switchbacks intact) sits sideways off the
    //     spine at that s, measured in the spine's own local right axis.
    //     This is deliberately NOT the spine's own heading (see
    //     buildDramaProfile()'s comment): the spine erases switchbacks by
    //     design, so its tangent alone reads "calm" through exactly the
    //     technical sections that most need a wider camera. wobble instead
    //     measures the thing that actually fires the dead-zone x-correction.
    // Sample count scales with the spine's own arc length so a long race
    // gets proportionally finer resolution than a short loop, same idea as
    // subjSpacing/spineSpacing above.
    const spineLen = spine.getLength()
    const dramaN = THREE.MathUtils.clamp(Math.round(spineLen / 1.2), 48, 420)
    const elevs = new Array(dramaN)
    const wobble = new Array(dramaN)
    for (let i = 0; i < dramaN; i++) {
      const s = i / (dramaN - 1)
      spine.getPointAt(s, _spinePt)
      elevs[i] = _spinePt.y
      spine.getTangentAt(s, _stan)
      curve.getPointAt(s, _subj)
      const rx = _stan.z, rz = -_stan.x // spine's local right (unit, since getTangentAt is unit)
      wobble[i] = (_subj.x - _spinePt.x) * rx + (_subj.z - _spinePt.z) * rz
    }
    const sampleSpacingWorld = spineLen / Math.max(1, dramaN - 1)
    const drama = buildDramaProfile(elevs, wobble, sampleSpacingWorld, {
      gradeNorm: this.zoomGradeNorm,
      bendNorm: this.zoomBendNorm,
      lookaheadFrac: this.zoomLookaheadFrac,
      bendLookaheadFrac: this.zoomBendLookaheadFrac,
    })
    this.curve = curve
    this.spine = spine
    this._dramaClimb = drama.climb
    this._dramaBend = drama.bend
    return true
  }

  // worldPts: ordered GPX track points {x,y,z} at ground level (direction = order)
  // seedAt: path fraction (0..1) to seat the initial pose at — lets a caller
  // that resumes mid-track (e.g. GPX playback follow, unpaused partway
  // through) start the flight from where the subject already is instead of
  // snapping back to the beginning.
  start(worldPts, { duration = 30, seedAt = 0 } = {}) {
    this.active = false // a bail below leaves no stale flight running
    if (!this._buildCurves(worldPts)) return false

    this.duration = duration
    this.t = THREE.MathUtils.clamp(seedAt, 0, 1)

    // seed the heading from the spine's own tangent at the start fraction so
    // the first frame doesn't slew in from a stale default direction
    this.spine.getTangentAt(this.t, _stan)
    this._headingDir.set(_stan.x, 0, _stan.z)
    if (this._headingDir.lengthSq() < 1e-8) this._headingDir.set(0, 0, 1)
    this._headingDir.normalize()
    this._pitch = 0
    // reset the cinematic-variation clock so a fresh flight always begins at
    // zero orbit-bias, never mid-swing from a previous flight — but seed the
    // standoff multiplier from the CONTENT at the seed point itself (not a
    // neutral 1) so a resume mid-climb doesn't visibly pop as it eases in
    this._breathT = 0
    this._standoffMul = this._standoffMulAt(this.t)

    // seat the camera at the initial pose immediately — no slew-in lurch
    this._solvePosition(this.t, this._pos)
    this.camera.position.copy(this._pos)
    this._aim(0, this.t, false) // dt=0 → snaps orientation instead of slewing in
    this.active = true
    return true
  }

  // Sequenced-playback handover (task 22 §5) — swap the flight onto a NEW
  // track's curve/spine WITHOUT re-seating position/heading/pitch/t the way
  // start() does. The existing per-frame rate limiter (maxYawRateDeg/
  // maxPitchRateDeg, same cap as any other frame) then eases the camera from
  // wherever it already is onto the new spine, so a leg transition reads as
  // one continuous shot rather than a cut. Leaves the current flight running
  // untouched (including this.active) on a degenerate input — a bad handover
  // should never kill an otherwise-fine flight.
  retarget(worldPts) {
    return this._buildCurves(worldPts)
  }

  stop() {
    this.active = false
  }

  // camera position at path fraction s: arm/lift (content-aware — see
  // this._standoffMul, eased each frame in _applyPose toward
  // _standoffMulAt(s)'s terrain-driven target) behind + above the SPINE
  // (never the raw path) along the CURRENT (already rate-limited) heading.
  // Ground/ridge clearance still reads the real terrain underneath so the
  // rig never clips into relief.
  _solvePosition(s, outPos) {
    this.spine.getPointAt(s, _spinePt)
    const arm = this.arm * this._standoffMul
    const lift = this.lift * this._standoffMul
    outPos.set(
      _spinePt.x - this._headingDir.x * arm,
      _spinePt.y + lift,
      _spinePt.z - this._headingDir.z * arm
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

  // interpolated read of the baked drama profile at path fraction s — see
  // the "CONTENT-AWARE ZOOM DRAMA" constructor comment and
  // buildDramaProfile()/dramaStandoffMul() above.
  _standoffMulAt(s) {
    const climb = this._dramaClimb, bend = this._dramaBend
    if (!climb || !climb.length) return 1
    const n = climb.length
    const f = THREE.MathUtils.clamp(s, 0, 1) * (n - 1)
    const i0 = Math.floor(f)
    const i1 = Math.min(n - 1, i0 + 1)
    const frac = f - i0
    const c = THREE.MathUtils.lerp(climb[i0], climb[i1], frac)
    const b = THREE.MathUtils.lerp(bend[i0], bend[i1], frac)
    return dramaStandoffMul(c, b, { pushIn: this.zoomPushIn, flatPullOut: this.zoomFlatPullOut, bendPullOut: this.zoomBendPullOut })
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

  // shared by update()/updateAt(): dead-zone yaw (task 13 — see the class
  // comment), damp the position onto the spine, then dead-zone pitch.
  _applyPose(dt, s, arrived) {
    // advance the slow cinematic-variation clock and ease this frame's
    // standoff multiplier (arm/lift, read by
    // _solvePosition below) toward the content-aware target from
    // _standoffMulAt(s) — see the "CONTENT-AWARE ZOOM DRAMA" constructor
    // comment. Eased, not snapped: zoomHalfLife is the dolly's own pace,
    // layered on top of the spatial lookahead baked into the profile itself.
    this._breathT += Math.max(dt, 0)
    const targetStandoffMul = this._standoffMulAt(s)
    if (dt <= 0) this._standoffMul = targetStandoffMul
    else {
      const zf = 1 - Math.pow(2, -dt / this.zoomHalfLife)
      this._standoffMul += (targetStandoffMul - this._standoffMul) * zf
    }

    // 1) yaw: ONLY correct when the subject is nearing/outside the box's
    // horizontal range — otherwise hold the current heading exactly (the
    // "does not correct at all" dead-zone behaviour). diff is measured
    // against THIS._POS/THIS._HEADINGDIR AS THEY STAND FROM LAST FRAME
    // (position hasn't been re-solved for this frame yet) — using the
    // not-yet-updated position is unavoidable here (position itself is
    // computed FROM the heading below, so using the not-yet-computed new
    // position would be circular) and is a one-frame-lagged approximation;
    // harmless given how heavily damped this whole rig already is.
    this.curve.getPointAt(s, _subj)
    _diff.subVectors(_subj, this._pos)
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const aspect = this.camera.aspect || 1
    // horizontal FOV from vertical FOV + aspect — the "hFovRad" the yaw-as-
    // pitch relabeling trick below needs (see the class comment).
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)

    // right0: this._headingDir rotated -90° about world up (cross(up,fwd)).
    // Reused as the "up0" role in the pitch-formula relabeling: the SAME
    // right0 must be used both to measure the current NDC.x below and to
    // reconstruct the corrected direction after solving — the solve+
    // reconstruct pair is self-consistent regardless of right0's chirality,
    // AS LONG AS both steps agree on it, which they do here.
    _right.set(this._headingDir.z, 0, -this._headingDir.x)
    const rightComp = _diff.x * _right.x + _diff.z * _right.z
    _yawDiff.set(_diff.x, rightComp, _diff.z)
    // "what NDC.x is it at RIGHT NOW" — pitch argument 0 means "no additional
    // rotation beyond the current heading" (a small approximation: it treats
    // the camera as level for this purpose, ignoring the true camera pitch's
    // second-order effect on horizontal framing — negligible at this rig's
    // modest pitch range).
    const actualNdcX = ndcYForPitch(_yawDiff, this._headingDir, 0, hFov)
    const xOut = actualNdcX < this.deadzone.xMin + this.deadzoneMargin || actualNdcX > this.deadzone.xMax - this.deadzoneMargin
    _targetDir.copy(this._headingDir)
    if (dt <= 0 || xOut) {
      let yaw = solvePitchForNdcY(_yawDiff, this._headingDir, this.targetNdcX, hFov)
      yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1) // guard degenerate geometry
      _targetDir.copy(this._headingDir).multiplyScalar(Math.cos(yaw))
      _targetDir.x += _right.x * Math.sin(yaw)
      _targetDir.z += _right.z * Math.sin(yaw)
      _targetDir.normalize()
    }
    // HOLD case (point inside the box): _targetDir stays the current heading —
    // the rig just keeps travelling. No decorative wobble here: see the
    // removed-orbit-bias note in the constructor for why (it integrated into
    // unbounded drift and fought the framing box).
    // still the SAME hard cap as ever — a correction engaging never means a
    // snap, it's eased in through this exact rate limiter like everything else.
    const maxYawStep = THREE.MathUtils.degToRad(this.maxYawRateDeg) * Math.max(dt, 0)
    if (dt <= 0) this._headingDir.copy(_targetDir)
    else {
      const slewed = slewHeading(this._headingDir, _targetDir, maxYawStep)
      this._headingDir.set(slewed.x, 0, slewed.z)
    }

    // 2) position: content-aware arm/lift behind the spine along that
    // (possibly just-turned) heading, then a long critical-damping pass on top.
    this._solvePosition(s, _desiredPos)
    const fp = dt <= 0 ? 1 : 1 - Math.pow(2, -dt / this.posHalfLife)
    this._pos.lerp(_desiredPos, fp)
    this.camera.position.copy(this._pos)

    this._aim(dt, s, arrived)
  }

  // 3) orientation: dead-zone pitch (mirrors the yaw gate above, using the
  // real solvePitchForNdcY this time — no relabeling needed), rate-limited
  // the same way as yaw, then a roll-free look-at quaternion — this rig
  // never banks, since roll is rotation too and the brief wants almost none.
  _aim(dt, s, arrived) {
    this.curve.getPointAt(s, _subj)
    this.controls.target.copy(_subj) // grabbing OrbitControls pivots around the rider, not empty air
    _diff.subVectors(_subj, this._pos) // NOW using this frame's just-solved position — no circularity for pitch (position doesn't depend on it)

    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const actualNdcY = ndcYForPitch(_diff, this._headingDir, this._pitch, vFov)
    const yOut = actualNdcY < this.deadzone.yMin + this.deadzoneMargin || actualNdcY > this.deadzone.yMax - this.deadzoneMargin
    let targetPitch = this._pitch
    if (dt <= 0 || yOut) {
      targetPitch = solvePitchForNdcY(_diff, this._headingDir, this.targetNdcY, vFov)
      targetPitch = THREE.MathUtils.clamp(targetPitch, -1.1, 1.1) // guard degenerate geometry (~63°)
    }
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
const _right = new THREE.Vector3()
const _yawDiff = new THREE.Vector3()
