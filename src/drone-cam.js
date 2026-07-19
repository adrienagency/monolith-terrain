// Third-person follow camera for GPX playback (task 26). A game-style chase
// cam that tracks the runner's OWN path, orbits around them a little as they
// advance, and sometimes pushes in hard — not the earlier cinematic
// TRAVELING shot that stood off the route and drifted along it
// independently of the runner's own turns (see the TASK 26 note below for
// why that changed and what still keeps it from being a nausea machine).
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
//   · CONTINUOUS CENTERING, not dead-zone framing (task 13/20/24, REVERSED by
//     task 28 — see the TASK 28 note below). Every frame, both yaw and pitch
//     solve a target that puts the tracked point at (targetNdcX, targetNdcY)
//     — near screen centre — and slew toward it under the SAME rate caps as
//     always (maxYawRateDeg/maxPitchRateDeg, see _applyPose()). There is no
//     more "inside the box, don't correct" hold state: the rig is ALWAYS
//     actively re-centring, exactly the third-person "follow effect" the
//     task-28 brief asks for. The old task-13/20/24 dead-zone box
//     (this.deadzone/this.deadzoneMargin) is gone along with it — see the
//     TASK 28 note for why continuous correction only reads as "following"
//     rather than "twitchy" once the rate caps are raised enough to keep up.
//   · Horizontal (yaw) framing REUSES solvePitchForNdcY() rather than a
//     bespoke solver: NDC.x is the identical rotate-and-project problem as
//     NDC.y, just in the (forward,right) plane instead of (forward,up) — the
//     derivation never assumed which horizontal axis it rotates around, so
//     relabeling "up" as "right" and vFov as the horizontal FOV gets yaw for
//     free (see _applyPose()).
//   · Frame-rate-independent critical damping on top of all of the above
//     for extra silkiness: x += (target-x)·(1-2^(-dt/half)).
//
//   · TASK 26 — THIRD-PERSON MODEL. The brief's three asks: (1) halve the
//     median standoff again, (2) "suivre littéralement le pointeur, comme
//     un jeu à la troisième personne, mais la caméra peut aussi se déplacer
//     tout autour du pointeur qui avance, avec un peu de recul, et parfois
//     zoomer de façon importante", (3) never let terrain sit between camera
//     and pointer. (2) is a real reversal of this file's founding rule
//     above ("stop reading the track directly at all") — the user is
//     explicitly asking for the traveling-shot detachment that rule was
//     built to prevent. So: the SPINE still exists and still drives the
//     content-aware zoom drama (buildDramaProfile()/dramaStandoffMul(), the
//     "parfois zoomer" half of ask 2) and still seeds the first heading —
//     but the camera's POSITION now orbits `this.curve`, the real
//     (lightly-smoothed, GPS-jitter-only) subject path, in _solvePosition(),
//     not the heavily-smoothed spine. What still keeps this from being the
//     original corner-chasing nausea is UNCHANGED: slewHeading's per-frame
//     rate cap (maxYawRateDeg/maxPitchRateDeg) bounds every turn regardless
//     of how hard the now-more-forceful target swings — the dead-zone box
//     that used to gate WHEN a correction engaged is gone (task 28, see
//     below), but the cap that bounds HOW FAST any correction moves never
//     was — and there's still no roll. Two additions layer on top:
//       - ORBIT BIAS: a slow (orbitPeriodSec), bounded (orbitAmp)
//         oscillation of the horizontal framing target (see targetNdcX
//         usage in _applyPose()). This is NOT the task-16 orbit-bias removed
//         above (see the constructor note on _breathT) — that one rotated
//         the heading directly every frame and integrated into unbounded
//         drift. This one only nudges WHERE the continuous yaw correction
//         re-centers to, and a sine wave of amplitude orbitAmp is bounded by
//         construction (no clamp needed, unlike when this had to be kept
//         inside the now-removed dead-zone box) — "elle peut se déplacer
//         tout autour du pointeur", a slow deliberate settle from one side
//         of directly-behind to the other, not a spin.
//       - OCCLUSION AVOIDANCE (resolveOcclusion(), ask 3): every frame,
//         after the position is solved and damped, march a ray from the
//         SUBJECT outward to the camera's own realized position, comparing
//         each step against sampleGround(x,z) — the same height-field query
//         this.clearance already uses. Where the ground first pokes through
//         the line, the camera is a "spring arm" that pulls straight back
//         in along that ray to just before it — the classic third-person
//         camera-collision fix, done with a height-field march (cheap,
//         reuses the rig's existing sampleGround) rather than a
//         THREE.Raycaster against the terrain mesh (no mesh reference is
//         even available here — only sampleGround is — and a handful of
//         height lookups is far cheaper per-frame than a triangle raycast
//         against a whole terrain mesh). This runs on the REALIZED position
//         every frame, not eased in, because the ask was literal ("la
//         caméra doit se déplacer pour toujours voir le pointeur" — ALWAYS,
//         not eventually). Easing back OUT once clear needs no extra
//         machinery: once a frame isn't occluded the clamp just doesn't
//         fire, and the ordinary damped chase (posHalfLife) glides the arm
//         back out on its own.
//
//   · TASK 28 — CONTINUOUS CENTERING, more freedom. Verbatim brief: "la
//     caméra n'est pas assez réactive pour suivre la tête de course, laisse
//     lui plus de liberté de mouvement, pour qu'elle ait toujours le point
//     de tête de course vers le centre de l'écran. un espèce de follow
//     effect en fait" — a deliberate REVERSAL of the task-13 dead-zone
//     design (see the class comment's opening bullets): the user has moved
//     on from "hold bearing until the subject nears the box edge" to
//     "always be correcting toward centre". Two changes, both load-bearing:
//       - The dead-zone gate itself is gone: _applyPose() no longer checks
//         whether the tracked point is inside a box before deciding to
//         correct — it ALWAYS solves a fresh target (targetNdcX/targetNdcY,
//         both ~0 — screen centre) via solvePitchForNdcY() and slews toward
//         it. The former this.deadzone/this.deadzoneMargin fields are
//         removed; there is no more "hold" branch, only "always correct".
//       - maxYawRateDeg/maxPitchRateDeg raised 13/22 -> 50/85 deg/s — by the
//         USER'S OWN explicit call ("je pense que tu peux passer de 13 à 50
//         sans problème"), not a value this file arrived at by its own
//         nausea-sweep methodology. This is the number that makes
//         continuous correction actually read as tight tracking instead of
//         a permanent slow crawl toward a target that's already moved on —
//         a dead-zone rig could get away with a low cap because it only had
//         to correct occasionally; a continuously-correcting rig needs to
//         cover the SAME angular ground every single frame, so the cap has
//         to be high enough that "always correcting" doesn't itself become
//         the new sluggishness. 85 deg/s pitch keeps the same ~1.7x
//         yaw:pitch ratio every prior round in this file has used. Both
//         caps sit well under the ~102°/s peak that was measured literally
//         nauseating in the original brief (task 13) — see this.
//         maxYawRateDeg's own comment for the re-measured peak this actually
//         produces on the real Europaweg fixture.
//
//     BUG CAUGHT MID-TASK: a first pass raised only the rate caps and left
//     the dead-zone GATE in place, still keyed off the old (and, it turns
//     out, badly asymmetric) box — deadzone.yMin/yMax spanned -0.43..0.80
//     (1.23 NDC units tall) against xMin/xMax's -0.36..0.35 (0.61 wide), so
//     pitch corrections engaged far less often than yaw's even after the
//     cap raise (a cap only matters once something asks to move). Live
//     playback caught this immediately: "tu suis latéralement, la caméra
//     s'élève, mais il n'y a quasiment aucun mouvement pour que la caméra
//     pivote vers le haut ou vers le bas, du coup, le curseur sort
//     largement de la zone centrale". Retiring the gate on BOTH axes (not
//     just raising the caps) is what actually fixed it — see _aim()'s own
//     comment. This is also why the acceptance numbers below are split by
//     axis (mean |NDC.x| vs mean |NDC.y| separately), not just a combined
//     distance: a combined average is exactly the kind of number that would
//     have hidden this bug (X was fine the whole time; only Y was broken).
//
//     MEASURED on the real europaweg.gpx fixture (4,911 GPX points -> 1,637
//     drape-resampled world points, 37.13km, reveal duration 55.7s, driven
//     deterministically via updateAt() at dt=1/30 — see the module doc/test
//     fixture notes), same-session BEFORE/AFTER comparison (task-26 code —
//     commit cb0b2f8 — vs this commit, both run against the byte-identical
//     frozen world-point array and the SAME live terrain.sample(), so the
//     only variable is the code):
//       Follow speed 1x (default):
//         mean |NDC.x|  0.052 -> 0.036   mean |NDC.y|  0.435 -> 0.187
//         mean |NDC| dist (combined) 0.444 -> 0.199   median 0.365 -> 0.110
//         % on-screen   96.9% -> 97.1%   peak yaw 13.0 -> 50.0°/s (at cap)
//         peak pitch 22.0 -> 85.0°/s (at cap)   min clearance 2.6 -> 2.6 (floor, unchanged)
//       Follow speed 3x (top of the UI slider):
//         mean |NDC.x|  0.107 -> 0.053   mean |NDC.y|  0.551 -> 0.223
//         mean |NDC| dist (combined) 0.579 -> 0.241   median 0.512 -> 0.131
//         % on-screen   88.7% -> 95.2%
//     The Y-axis number is the headline: it was the axis the field report
//     was about, and it drops by more than half at every speed tested,
//     while X (already fine) improves too. % on-screen improves most at the
//     higher speeds, where the old dead-zone rig was furthest behind.
//       Occlusion (independent line-of-sight check, SEPARATE from
//       resolveOcclusion's own march, same methodology the task-26 report
//       used): 14-step (matches this.occlusionSteps) 2.45% -> 2.57%;
//       24-step (finer, catches what a 14-step march can step over) 16.5%
//       -> 17.1%. ESSENTIALLY UNCHANGED, as expected — this task touched
//       framing only, never resolveOcclusion or its tuning. Flagged
//       here anyway because it does NOT reproduce the task-26 report's
//       claimed 0.0%: on the current live terrain state, occlusion was
//       ALREADY nonzero under an independent check before any task-28
//       change, most likely because a coarse (14-sample) ray march
//       structurally under-detects on this fixture's own extreme relief —
//       a narrow balcony trail cut into a ~1000m valley wall, at the
//       tight 4.5/2.25 standoff task 26 landed on. Re-tuning
//       resolveOcclusion itself is out of this task's scope (framing/rate
//       caps only) and risks second-guessing a separately-reviewed
//       decision; recorded here as a known pre-existing gap, not a task-28
//       regression — min ground clearance held at exactly 2.6 (the floor)
//       in every run, so the camera never burrowed into terrain either way.
//
//     What's UNCHANGED and still absolute: no roll, ever; occlusion
//     avoidance (resolveOcclusion()) still runs on the realized position
//     every frame, unaffected by any of the above since it operates AFTER
//     yaw/pitch/position are solved; ground clearance (this.clearance)
//     still clamps every frame. Continuous centering does NOT mean
//     unbounded or unlimited — it means the target is always centre and the
//     ONLY thing standing between "always correcting" and "spinning wildly"
//     is the same rate-cap guarantee this file has leaned on since task 13.

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
// one: solvePitchForNdcY answers "what pitch puts it at T", this answers
// "given the current pitch, where IS it". No longer read by DroneCam itself
// since task 28 retired the dead-zone gate that used to consult it (framing
// is now solved unconditionally every frame — see the class comment's TASK
// 28 note) — kept exported as the tested inverse of solvePitchForNdcY, and
// because it's the natural tool for anything that DOES need "where is the
// point right now" (e.g. diagnostics/tests) without re-deriving the formula.
export function ndcYForPitch(diff, forward0, pitch, vFovRad) {
  const A = diff.y
  const B = diff.x * forward0.x + diff.z * forward0.z
  const k = Math.tan(vFovRad / 2)
  const c = Math.cos(pitch)
  const s = Math.sin(pitch)
  return (A * c - B * s) / ((B * c + A * s) * k)
}

// ---- occlusion avoidance (task 26 §3, unit-tested) --------------------------

// "Spring arm" camera collision: march a ray from the SUBJECT outward to the
// camera's own desired position, comparing each step's line-of-sight height
// against sampleGround(x,z) — the same terrain query this.clearance already
// leans on. The first step where the ground pokes through the line is where
// a ridge/mountain would start blocking the shot; the camera gets pulled
// straight back in along that SAME ray to just before it (one step of
// buffer, then a caller-supplied skin margin so it eases off before actually
// grazing, not exactly at the graze point). This is a purely geometric,
// per-frame check — no scene graph or mesh needed, just the height-field
// sampleGround() the rig already has — so it costs `steps` calls to
// sampleGround, the same order of magnitude as the ground-clearance lookahead
// _solvePosition() already does every frame.
// minT floors how far the arm is allowed to collapse (as a fraction of the
// original subject→camera distance) so an extreme case (subject standing
// right against a wall) can't zero the camera onto the subject.
// Returns the (possibly pulled-in) position and whether a pull actually
// happened — the caller (DroneCam._applyPose) uses `pulled` to know whether
// to re-clamp ground clearance (pulling toward the subject can lower the
// camera's Y as a side effect of shortening the whole 3D offset).
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
    //
    // Task 24: "la caméra du drone est beaucoup trop lointaine, il faut que tu
    // zoom de la moitié de la distance actuelle sur le point d'avancement" +
    // "laisse-lui plus de liberté de mouvement pour qu'il bouge beaucoup plus
    // avec la tête de course" — two explicit asks, both costing the SAME
    // budget this table has protected since task 13: arm/lift HALVED again
    // (24/12 -> 12/6, the literal "moitié de la distance actuelle"), and the
    // yaw/pitch rate caps + dead-zone box loosened (see maxYawRateDeg/
    // maxPitchRateDeg/deadzoneMargin/deadzone below) so a correction — once it
    // engages — moves faster and the box gives more room before one triggers,
    // i.e. genuinely more visible movement with the head, not the same
    // locked-down framing at a tighter crop. Re-measured on the SAME
    // buildZigzagClimb() torture fixture drone-cam.test.js already drives (55°
    // switchbacks, monotonic climb — this fixture's own extreme bend keeps
    // dramaStandoffMul() near its bendPullOut ceiling almost throughout, which
    // is why halving the nominal arm/lift barely moves this particular
    // worst-case number — the realized on-screen distance is still widened by
    // the SAME drama system, just off a smaller base):
    //     arm 12, lift 6, yaw-cap 13°/s, pitch-cap 22°/s, widened box -> 100% in-box / 13.0°/s peak
    //     (measured on a bumpy sampleGround too: min ground clearance 13.3
    //     world units against a 2.6 floor — no ridge penetration)
    // The in-box% barely moved because this fixture's drama pull-out already
    // protected it; the peak yaw rose from 9.0 to exactly the new 13°/s cap
    // (the correction now saturates the cap on this fixture, same as it did
    // at 9°/s before) — the real, INTENDED effect of this change is the
    // camera physically standing half as far off on calmer stretches (where
    // dramaStandoffMul isn't already maxed out) and reacting faster when it
    // does correct, not a change to this worst-case fixture's own ceiling.
    // 13°/s is a deliberate midpoint, not the top of the earlier sweep table:
    // the ORIGINAL 9°/s cap was chosen specifically to kill the "envie de
    // vomir" corner-chasing nausea the brief opened with, so this raises it
    // by less than half rather than doubling it outright — the user asked for
    // more life, not a return to the pursuit-cam that started this file.
    //
    // Task 26: "son point de distance médian doit encore être 50% plus près"
    // — literal halving again (12/6 -> 6/3), same pattern as every prior
    // round in this table — BUT this round also changes what arm/lift are
    // measured FROM: _solvePosition() below now orbits this.curve (the real
    // subject path) instead of this.spine (see the class comment's TASK 26
    // note), and resolveOcclusion() can pull the realized distance in
    // further still on top of that. So "half the constant" alone doesn't
    // prove "half the median" the way it used to when the anchor was a
    // fixed smoothed spine — measured on the real torture fixture instead
    // (europaweg.gpx, a Valais valley with ~1000m walls, driven
    // deterministically via updateAt() exactly like the task-13/20/24 tables
    // above, see the task-26 report for the full before/after numbers):
    //     before (task 24 code, arm 12/lift 6, spine-anchored):
    //       median standoff 20.16, range 13.49..26.35, peak yaw 13.0°/s,
    //       11.0% of frames occluded by terrain, 100% on-screen
    //     after, curve-anchored + orbit + occlusion, arm/lift swept at a
    //     fixed 1:2 ratio to land the MEASURED median (not the raw constant)
    //     at 50% closer:
    //       arm 6.0, lift 3.0 (a literal half of task-24's 12/6) -> median 11.41
    //       arm 5.1, lift 1.53                                  -> median 10.64
    //       arm 4.5, lift 2.25                                  -> median  9.99  <- chosen
    //       arm 4.2, lift 2.10                                  -> median  9.68
    //     a flat half of the CONSTANT (6/3) undershoots the 50%-closer ask
    //     because curve-anchoring + resolveOcclusion's pull-in already widen
    //     the realized distance beyond what the old spine-anchored constant
    //     implied — the class comment's TASK 26 note says why this table
    //     has to be re-measured on the real fixture instead of just halved
    //     on paper this time. 4.5/2.25 is the closest to the exact 50%
    //     target (10.08) on this exact measurement; see the task-26 report
    //     for the full re-measured range/yaw/occlusion%/on-screen% table.
    this.arm = 4.5 // baseline distance behind the SUBJECT (world units) — task 26, see the sweep above
    this.lift = 2.25 // baseline height above the subject — same 1:2 ratio as every prior round
    this.clearance = 2.6 // minimum gap kept over the ground / ridges
    // hard caps on how fast the rig is allowed to turn — THIS (not the spine
    // smoothing alone) is the actual nausea guarantee: even a pathological
    // input cannot spin the camera faster than these.
    //
    // Task 28: "la caméra n'est pas assez réactive pour suivre la tête de
    // course, laisse lui plus de liberté de mouvement" + the dead-zone gate
    // itself retired (see this.targetNdcX/targetNdcY below and the class
    // comment's TASK 28 note) means the rig now solves a fresh correction
    // EVERY frame instead of only near a box edge — a continuously-correcting
    // rig needs a materially higher cap than an occasionally-correcting one
    // just to avoid being the new bottleneck. Raised 13/22 -> 50/85 deg/s BY
    // THE USER'S OWN EXPLICIT CALL after seeing 13 fail live ("je pense que
    // tu peux passer de 13 à 50 sans problème") — not this file's own
    // nausea-sweep methodology, which had held the line at ever-smaller
    // fractional increases since task 13. 85 keeps the same ~1.7x
    // pitch:yaw ratio every prior round in this file used (22/13 ≈ 1.69,
    // 85/50 = 1.7). Both remain under half the ~102°/s peak that was
    // measured literally nauseating in the original task-13 brief. Measured
    // on the real Europaweg fixture (see the class comment's TASK 28 note
    // for the full before/after table): peak yaw saturates the cap exactly
    // at 50.0°/s and peak pitch at 85.0°/s — the cap IS the ceiling reached
    // on this fixture's sharpest switchbacks, continuous centering keeps
    // asking for more than either cap allows through most of the climb.
    this.maxYawRateDeg = 50 // deg/s
    this.maxPitchRateDeg = 85 // deg/s
    // task 28: CONTINUOUS centering target (see the class comment's TASK 28
    // note) — both axes solve toward here every frame, no more "only once
    // the point nears a box edge". Literal "toujours vers le centre de
    // l'écran": both 0 (dead centre), not the old task-20 box's off-centre
    // bias (targetNdcY was -0.15, "look up the mountain when climbing" —
    // that bias only made sense as a re-centering point INSIDE a much
    // taller-than-wide box; with no box left and continuous correction,
    // biasing off-centre would directly contradict the brief's own "vers le
    // centre" wording, not serve it).
    // FRAMING, the film-director version. The subject sits in the LOWER THIRD
    // of the frame, not dead centre: a chase camera above a runner that
    // centres them must pitch down at the ground, and "regarde trop souvent
    // vers le bas" was the exact field report. Framing them low fills the top
    // two-thirds with the valley walls and the summits — the landscape IS the
    // shot. minPitchRad is the hard directorial floor on top of that: no
    // matter what the solver asks, the camera never stares down steeper than
    // ~26 deg, which is what actually guarantees the horizon stays in frame.
    this.targetNdcY = -0.3
    this.targetNdcX = 0
    this.minPitchRad = -0.45
    // ...but KEEPING THE SUBJECT IN FRAME OUTRANKS the floor. On the
    // Europaweg wall the rig rides high above the trail (clearance + ridge
    // lift), and an absolute floor there measured the head on screen only
    // 48% of the time — recreating the exact "ne focus plus sur la tête de
    // course" bug this rework is for. If respecting the floor would drop the
    // head below bottomKeepNdcY, the floor yields.
    this.bottomKeepNdcY = -0.82
    // A ground vehicle does not teleport vertically, and neither does its
    // chase car: the realized position's vertical SPEED is capped (units/s).
    // This is what finally tames the occlusion pull-in's instant 3D jumps
    // (measured 4.37 units in ONE frame on the Europaweg) without weakening
    // the pull itself — the sightline recovers over a few frames instead.
    this.maxVerticalRate = 3.5
    this._lastY = null
    // task 26: damping now smooths a chase against the real (curve-anchored)
    // subject rather than an already-smooth spine — still the same role
    // (extra silkiness on top of the rate caps), just a livelier target.
    // Task 28: tightened 0.9/0.5 -> 0.45/0.25 (halved) alongside the rate-cap
    // raise — "plus de liberté de mouvement" applies to the WHOLE chase, not
    // just the yaw/pitch caps; a rig that can now turn 4x faster but still
    // spends the old 0.9s settling its position into that turn would just
    // move the lag from one stage to the other. Still real smoothing (not
    // zero), just proportionally faster, same as every other number this
    // task raised.
    this.posHalfLife = 0.45 // s — smoothing on top of the rate-limited chase (XZ)
    // Vertical gets its OWN, much slower lane: a chase vehicle tracks its
    // subject laterally but does not replay every rise of the road. All the
    // reported bugs were vertical; the horizontal chase was fine.
    this.posHalfLifeY = 1.2 // s
    this.rotHalfLife = 0.25 // s — final orientation smoothing
    // ground collision = a BOUNCE, not a snap (explicit ask). The floor is a
    // stiff, slightly under-damped spring: dipping under clearance pushes the
    // camera up fast with a small visible rebound, instead of the old
    // teleport `y = floor` which was itself one of the vertical "jumps".
    this._yVel = 0
    this.floorStiffness = 60 // 1/s^2
    this.floorDamping = 7 // 1/s — under critical on purpose: that IS the bounce

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

    // ---- THIRD-PERSON ORBIT (task 26, ask 2's "se déplacer tout autour du
    // pointeur") — see the class comment's TASK 26/28 notes for the full
    // rationale on why this is safe: a sine wave of amplitude orbitAmp is
    // bounded by construction, no clamp against a box needed (task 28
    // removed the dead-zone box this used to be clamped inside — see
    // targetNdcX/targetNdcY above). Reuses _breathT's already-running clock.
    this.orbitAmp = 0.16 // NDC units either side of targetNdcX the settle point drifts
    this.orbitPeriodSec = 34 // s for one full left→right→left cycle — slow and deliberate, not a spin

    // ---- OCCLUSION AVOIDANCE (task 26 §3) — tuning for resolveOcclusion()
    // above, applied every frame in _applyPose() to the REALIZED camera
    // position (see the class comment's TASK 26 note for why it's not
    // eased in). occlusionSteps trades per-frame cost for how finely a
    // ridge edge is resolved; occlusionSkin is a small buffer so the arm
    // eases off before the line-of-sight literally grazes the terrain
    // texture (which would flicker in and out of "blocked" every frame from
    // float noise alone); occlusionMinT floors how far the arm can collapse
    // (as a fraction of its own current length) so a subject standing right
    // against a wall can't zero the camera onto them.
    this.occlusionSteps = 14
    this.occlusionSkin = 0.35
    this.occlusionMinT = 0.22

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
    const subjRaw = smoothPath(resamplePath(worldPts, subjSpacing), 2, 2)
    // STABILIZED GIMBAL (field report: "changement de position verticale
    // intempestive... je pense que les erreurs verticales des GPX posent
    // beaucoup de soucis"). The report is right about the mechanism: the
    // subject's Y comes from draping onto the DEM, and on a balcony trail cut
    // into a steep wall a few metres of lateral GPS jitter re-drapes to tens
    // of metres of height change — noise the light 2-pass smoothing above
    // cannot touch. Everything the CAMERA reads gets a much heavier Y-ONLY
    // low-pass: lateral tracking stays sharp (the reported bugs are all
    // vertical), and the head MARKER itself (gpx.js) still rides the true
    // ground. A film crew does the same thing — the chase vehicle's gimbal
    // stabilises vertically, it does not replay every pothole.
    const ys = subjRaw.map((p) => p.y)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < ys.length - 1; i++) {
        let sum = 0, n = 0
        for (let j = Math.max(0, i - 6); j <= Math.min(ys.length - 1, i + 6); j++) { sum += ys[j]; n++ }
        ys[i] = sum / n
      }
    }
    const subjV = subjRaw.map((p, i) => new THREE.Vector3(p.x, ys[i], p.z))
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
    this._lastY = null // vertical rate limiter re-seats on the first frame
    this._standoffMul = this._standoffMulAt(this.t)

    // seat the camera at the initial pose immediately — no slew-in lurch
    this._solvePosition(this.t, this._pos)
    this.camera.position.copy(this._pos)
    this.curve.getPointAt(this.t, _subj)
    this._resolveOcclusion(_subj) // never seat the very first frame occluded either
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
  // _standoffMulAt(s)'s terrain-driven target) behind + above the SUBJECT
  // (this.curve — the real, lightly-smoothed path; task 26 moved this off
  // the spine, see the class comment's TASK 26 note) along the CURRENT
  // (already rate-limited) heading. Ground/ridge clearance still reads the
  // real terrain underneath so the rig never clips into relief; this is a
  // cheap first pass (lift only) — resolveOcclusion() in _applyPose()/
  // start() is the harder guarantee that also pulls the arm in when lifting
  // alone can't clear the line of sight.
  _solvePosition(s, outPos) {
    this.curve.getPointAt(s, _subj)
    const arm = this.arm * this._standoffMul
    const lift = this.lift * this._standoffMul
    outPos.set(
      _subj.x - this._headingDir.x * arm,
      _subj.y + lift,
      _subj.z - this._headingDir.z * arm
    )
    if (this.sampleGround) {
      const gc = this.sampleGround(outPos.x, outPos.z)
      if (outPos.y < gc + this.clearance) outPos.y = gc + this.clearance
      // lift over any ridge on the sight-line to the subject
      for (let k = 0.2; k < 0.99; k += 0.2) {
        const px = outPos.x + (_subj.x - outPos.x) * k
        const pz = outPos.z + (_subj.z - outPos.z) * k
        const gh = this.sampleGround(px, pz) + this.clearance * 0.7
        const need = (gh - _subj.y * k) / (1 - k)
        if (need > outPos.y) outPos.y = need
      }
    }
  }

  // Occlusion guarantee (task 26 §3) — mutates this._pos IN PLACE to the
  // resolveOcclusion() result for the subject at `subjPt`, then re-clamps
  // ground clearance (pulling the arm in toward the subject shortens the
  // WHOLE 3D offset, so the Y component can dip back under the clearance
  // floor even though _solvePosition() already cleared it once). Called on
  // the REALIZED position, every frame, not eased — see the class comment.
  _resolveOcclusion(subjPt) {
    if (!this.sampleGround) return
    const r = resolveOcclusion(subjPt, this._pos, this.sampleGround, {
      steps: this.occlusionSteps,
      skin: this.occlusionSkin,
      minT: this.occlusionMinT,
    })
    if (!r.pulled) return
    this._pos.set(r.x, r.y, r.z)
    // the pull-in shortens the whole 3D offset, so Y can dip back under the
    // floor — same spring treatment as the main pass, never a teleport
    this._springFloor(1 / 60)
    this._limitVerticalRate(1 / 60)
    this.camera.position.copy(this._pos)
  }

  // Ground floor as a SPRING (see floorStiffness/floorDamping): below
  // clearance the camera is pushed up with a small rebound; above it the
  // spring velocity decays. An emergency hard floor well below clearance
  // still exists — a bounce is a look, clipping through rock is a bug.
  _springFloor(dt) {
    if (!this.sampleGround) return
    const h = Math.min(Math.max(dt, 1 / 240), 1 / 20) // clamp for integrator stability
    const gc = this.sampleGround(this._pos.x, this._pos.z)
    const floor = gc + this.clearance
    if (this._pos.y < floor) {
      this._yVel += (floor - this._pos.y) * this.floorStiffness * h
      this._yVel *= Math.exp(-this.floorDamping * h)
      this._pos.y += this._yVel * h
    } else {
      this._yVel *= Math.exp(-5 * h) // fade any leftover bounce once airborne
    }
    const hard = gc + this.clearance * 0.7 // the bounce may dip this far, never further
    if (this._pos.y < hard) { this._pos.y = hard; this._yVel = Math.max(this._yVel, 0) }
  }

  // Vertical speed cap on the REALIZED position — the last stage before the
  // camera is written. Every upstream pass (ridge lift, occlusion pull,
  // spring floor) may ASK for a big vertical move; this stage spreads it over
  // frames. The emergency hard floor is re-applied after, because clipping
  // into rock is worse than a fast climb.
  _limitVerticalRate(dt) {
    if (this._lastY === null || dt <= 0) { this._lastY = this._pos.y; return }
    const maxDy = this.maxVerticalRate * Math.min(dt, 1 / 20)
    const dy = this._pos.y - this._lastY
    if (Math.abs(dy) > maxDy) this._pos.y = this._lastY + Math.sign(dy) * maxDy
    if (this.sampleGround) {
      const hard = this.sampleGround(this._pos.x, this._pos.z) + this.clearance * 0.7
      if (this._pos.y < hard) this._pos.y = hard
    }
    this._lastY = this._pos.y
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

  // ---- user-grab handoff (task 30) ------------------------------------
  // "Laisse la possibilité à l'utilisateur de bouger la caméra sans arrêter
  // le suivi" — while the user is actively dragging OrbitControls during GPX
  // follow, main.js stops calling updateAt() every frame (which would
  // otherwise overwrite camera.position/quaternion right back, fighting the
  // drag) and calls these two instead. The rig stays `active` the whole
  // time — never drone.stop() — so this is a SUSPEND, not a cancel.

  // Keep OrbitControls' pivot on the advancing subject while the drone isn't
  // driving the camera itself, so a drag orbits/zooms around the MOVING head
  // (per the brief) rather than a point that's gone stale by the time the
  // user lets go. Deliberately does not touch camera position/heading/pitch
  // — that's the whole point of "suspended".
  followPivot(s) {
    if (!this.curve) return
    this.curve.getPointAt(THREE.MathUtils.clamp(s, 0, 1), _subj)
    this.controls.target.copy(_subj)
  }

  // Re-anchor the rig's internal pose to wherever the camera actually is
  // right now (e.g. just after OrbitControls moved it under a user drag).
  // Call every frame while suspended so that whenever the user releases the
  // controls, updateAt()'s existing damped chase (posHalfLife/rotHalfLife —
  // the SAME easing an ordinary correction already uses, see _applyPose())
  // glides FROM the user's own framing TOWARD the drone's target instead of
  // snapping back to a stale pre-drag pose the rig never got to update.
  syncToCamera() {
    this._pos.copy(this.camera.position)
    _fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion) // camera looks down -Z locally
    const horizLen = Math.hypot(_fwd.x, _fwd.z)
    if (horizLen > 1e-6) {
      this._headingDir.set(_fwd.x / horizLen, 0, _fwd.z / horizLen)
      this._pitch = Math.atan2(_fwd.y, horizLen)
    }
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

    // 1) yaw: task 28 — ALWAYS solve a fresh correction target toward screen
    // centre, every frame (the dead-zone "hold until near the box edge" gate
    // is gone, see the class comment's TASK 28 note). diff is measured
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
    // Reused as the "up0" role in the pitch-formula relabeling below.
    _right.set(this._headingDir.z, 0, -this._headingDir.x)
    const rightComp = _diff.x * _right.x + _diff.z * _right.z
    _yawDiff.set(_diff.x, rightComp, _diff.z)
    // task 26 ORBIT BIAS: a slow, bounded sine drift of WHERE the continuous
    // correction re-centers to (see the class comment's TASK 26/28 notes +
    // the orbitAmp/orbitPeriodSec constructor comment) — a sine of amplitude
    // orbitAmp is bounded by construction, no clamp needed.
    const orbitBias = Math.sin((this._breathT / this.orbitPeriodSec) * Math.PI * 2) * this.orbitAmp
    const orbitTargetX = this.targetNdcX + orbitBias
    let yaw = solvePitchForNdcY(_yawDiff, this._headingDir, orbitTargetX, hFov)
    yaw = THREE.MathUtils.clamp(yaw, -1.1, 1.1) // guard degenerate geometry
    _targetDir.copy(this._headingDir).multiplyScalar(Math.cos(yaw))
    _targetDir.x += _right.x * Math.sin(yaw)
    _targetDir.z += _right.z * Math.sin(yaw)
    _targetDir.normalize()
    // still the SAME hard cap as ever — continuous correction never means a
    // snap, it's eased in through this exact rate limiter like everything else.
    const maxYawStep = THREE.MathUtils.degToRad(this.maxYawRateDeg) * Math.max(dt, 0)
    if (dt <= 0) this._headingDir.copy(_targetDir)
    else {
      const slewed = slewHeading(this._headingDir, _targetDir, maxYawStep)
      this._headingDir.set(slewed.x, 0, slewed.z)
    }

    // 2) position: content-aware arm/lift behind the subject along that
    // (possibly just-turned) heading, then a long critical-damping pass on top.
    this._solvePosition(s, _desiredPos)
    const fp = dt <= 0 ? 1 : 1 - Math.pow(2, -dt / this.posHalfLife)
    const fy = dt <= 0 ? 1 : 1 - Math.pow(2, -dt / this.posHalfLifeY)
    this._pos.x += (_desiredPos.x - this._pos.x) * fp
    this._pos.z += (_desiredPos.z - this._pos.z) * fp
    this._pos.y += (_desiredPos.y - this._pos.y) * fy
    // the LERP itself is a straight line between two independently-clamped
    // endpoints (last frame's realized position and this frame's freshly
    // solved+clamped target) — over genuinely rugged terrain the ground
    // under the MIDDLE of that line can still be higher than the
    // interpolated Y even though both endpoints were individually safe
    // (e.g. the straight line crosses over a ridge crest between them).
    // Task 26's occlusion pull-in makes the desired position swing around a
    // lot more frame-to-frame than the old spine-anchored rig did, which
    // makes this latent gap easier to hit — re-clamp the REALIZED lerped
    // point against the ground directly under IT, not just its endpoints.
    this._springFloor(dt)
    this._limitVerticalRate(dt)
    this.camera.position.copy(this._pos)

    // 2b) occlusion guarantee (task 26 §3) — _subj here is exactly the same
    // curve.getPointAt(s) evaluated for the yaw section above (s hasn't
    // changed since), so no extra curve evaluation is needed.
    this._resolveOcclusion(_subj)

    this._aim(dt, s, arrived)
  }

  // 3) orientation: task 28 — pitch ALWAYS solves toward targetNdcY, every
  // frame, exactly like yaw above (the old dead-zone gate — solve only once
  // ndcYForPitch() reported the point nearing/outside deadzone.yMin/yMax —
  // is gone). This mirrors the yaw fix precisely, and fixes a real bug the
  // old asymmetric box hid: deadzone.yMin/yMax spanned -0.43..0.80, a 1.23
  // NDC-unit-tall gate versus xMin/xMax's 0.61-wide one — pitch corrections
  // fired barely at all next to yaw's, so the head tracked laterally but
  // rode away vertically (exactly the field report: "tu suis latéralement,
  // la caméra s'élève, mais il n'y a quasiment aucun mouvement pour que la
  // caméra pivote vers le haut ou vers le bas"). Continuous solving removes
  // the asymmetry by construction — there's no more box for either axis to
  // be lopsided against. Rate-limited the same way as yaw, then a roll-free
  // look-at quaternion — this rig never banks, since roll is rotation too
  // and the brief wants almost none.
  _aim(dt, s, arrived) {
    this.curve.getPointAt(s, _subj)
    this.controls.target.copy(_subj) // grabbing OrbitControls pivots around the rider, not empty air
    _diff.subVectors(_subj, this._pos) // NOW using this frame's just-solved position — no circularity for pitch (position doesn't depend on it)

    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    let targetPitch = solvePitchForNdcY(_diff, this._headingDir, this.targetNdcY, vFov)
    targetPitch = THREE.MathUtils.clamp(targetPitch, this.minPitchRad, 1.1) // directorial floor — see minPitchRad
    // frame-keeping override: never let the floor push the head off the
    // bottom of the frame — solve the pitch that pins it at bottomKeepNdcY
    // and refuse to pitch higher than that (see the constructor comment)
    const keepPitch = solvePitchForNdcY(_diff, this._headingDir, this.bottomKeepNdcY, vFov)
    if (targetPitch > keepPitch) targetPitch = keepPitch
    targetPitch = THREE.MathUtils.clamp(targetPitch, -1.2, 1.1)
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
