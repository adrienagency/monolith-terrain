import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { resamplePath, smoothPath, slewHeading, solvePitchForNdcY, ndcYForPitch, resolveOcclusion, DroneCam } from '../src/drone-cam.js'

const len = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y, p.z - pts[i - 1].z) : 0), 0)

test('resamplePath keeps endpoints and preserves direction', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 10 }]
  const r = resamplePath(pts, 1)
  assert.deepEqual(r[0], pts[0])
  assert.deepEqual(r[r.length - 1], pts[2])
  // direction preserved: x rises first, then z rises
  assert.ok(r[1].x >= r[0].x)
})

test('resamplePath spaces points ~evenly', () => {
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 9, y: 0, z: 0 }]
  const r = resamplePath(pts, 1)
  for (let i = 1; i < r.length; i++) {
    const d = Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z)
    assert.ok(d > 0.4 && d < 1.6, `spacing ${d}`)
  }
})

test('resamplePath handles degenerate inputs', () => {
  assert.deepEqual(resamplePath([], 1), [])
  assert.equal(resamplePath([{ x: 1, y: 2, z: 3 }], 1).length, 1)
})

test('smoothPath pins endpoints and reduces jitter', () => {
  const pts = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 5, z: 0 }, // spike
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 5, z: 0 }, // spike
    { x: 4, y: 0, z: 0 },
  ]
  const s = smoothPath(pts, 2, 2)
  assert.deepEqual(s[0], pts[0])
  assert.deepEqual(s[s.length - 1], pts[pts.length - 1])
  // the interior spikes are damped toward the mean
  assert.ok(s[1].y < 5 && s[3].y < 5)
  // total vertical variation drops
  const varRaw = pts.reduce((a, p) => a + Math.abs(p.y), 0)
  const varSm = s.reduce((a, p) => a + Math.abs(p.y), 0)
  assert.ok(varSm < varRaw)
})

// ---- camera-rig helpers: the anti-nausea guarantees, in isolation --------

test('slewHeading caps the turn to maxStep even for a 180° reversal', () => {
  const cur = { x: 0, z: 1 } // facing +Z
  const target = { x: 0, z: -1 } // dead reversal
  const maxStep = THREE_deg(5) // tiny cap
  const r = slewHeading(cur, target, maxStep)
  const turned = Math.acos(THREE_clampDot(cur.x * r.x + cur.z * r.z))
  assert.ok(turned <= maxStep + 1e-9, `turned ${turned} rad > cap ${maxStep}`)
})

test('slewHeading takes the short way around a wraparound angle', () => {
  // current heading just past +180°/-180°, target just on the other side —
  // the short way is a small step, not a near-full-circle one
  const cur = { x: Math.sin(3.05), z: Math.cos(3.05) }
  const target = { x: Math.sin(-3.05), z: Math.cos(-3.05) }
  const maxStep = THREE_deg(20)
  const r = slewHeading(cur, target, maxStep)
  const curAngle = Math.atan2(cur.x, cur.z)
  const newAngle = Math.atan2(r.x, r.z)
  let delta = newAngle - curAngle
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  assert.ok(Math.abs(delta) <= maxStep + 1e-9, `stepped ${delta} rad, cap ${maxStep}`)
})

test('slewHeading is a no-op once already at the target', () => {
  const dir = { x: 0.6, z: 0.8 }
  const r = slewHeading(dir, dir, THREE_deg(30))
  assert.ok(Math.abs(r.x - dir.x) < 1e-9 && Math.abs(r.z - dir.z) < 1e-9)
})

test('solvePitchForNdcY: zero pitch already gives the natural NDC of a level look', () => {
  // subject 20 ahead, 5 below camera height, camera facing +Z level
  const diff = { x: 0, y: -5, z: 20 }
  const forward0 = { x: 0, z: 1 }
  const vFov = THREE_deg(50)
  const k = Math.tan(vFov / 2)
  const naturalNdcY = diff.y / (diff.z * k) // ndc.y at pitch=0
  const pitch = solvePitchForNdcY(diff, forward0, naturalNdcY, vFov)
  assert.ok(Math.abs(pitch) < 1e-6, `expected ~0 pitch, got ${pitch}`)
})

test('solvePitchForNdcY: a lower (more negative) target NDC.y requires pitching up', () => {
  const diff = { x: 0, y: -5, z: 20 }
  const forward0 = { x: 0, z: 1 }
  const vFov = THREE_deg(50)
  const pitchShallow = solvePitchForNdcY(diff, forward0, -0.3, vFov)
  const pitchDeep = solvePitchForNdcY(diff, forward0, -0.7, vFov)
  assert.ok(pitchDeep > pitchShallow, `deeper framing (${pitchDeep}) should pitch up more than shallow (${pitchShallow})`)
})

test('solvePitchForNdcY handles a degenerate zero-diff without NaN', () => {
  const pitch = solvePitchForNdcY({ x: 0, y: 0, z: 0 }, { x: 0, z: 1 }, -0.375, THREE_deg(50))
  assert.equal(pitch, 0)
})

// ---- ndcYForPitch: the forward evaluator dead-zone gating relies on --------

test('ndcYForPitch is the forward evaluator inverse of solvePitchForNdcY', () => {
  const diff = { x: 3, y: -5, z: 20 }
  const forward0 = { x: 0, z: 1 }
  const vFov = THREE_deg(50)
  const target = -0.42
  const pitch = solvePitchForNdcY(diff, forward0, target, vFov)
  const back = ndcYForPitch(diff, forward0, pitch, vFov)
  assert.ok(Math.abs(back - target) < 1e-9, `expected ${target}, got ${back}`)
})

test('ndcYForPitch at pitch 0 matches the natural (unrotated) projection', () => {
  const diff = { x: 0, y: -5, z: 20 }
  const forward0 = { x: 0, z: 1 }
  const vFov = THREE_deg(50)
  const k = Math.tan(vFov / 2)
  const expected = diff.y / (diff.z * k)
  const got = ndcYForPitch(diff, forward0, 0, vFov)
  assert.ok(Math.abs(got - expected) < 1e-9)
})

// ---- resolveOcclusion: the "spring arm" camera-collision guarantee (task 26 §3) --

test('resolveOcclusion: flat/clear ground never pulls the camera in', () => {
  const subj = { x: 0, y: 0, z: 0 }
  const cam = { x: 0, y: 5, z: -10 }
  const flat = () => -5 // well below the whole sight-line
  const r = resolveOcclusion(subj, cam, flat)
  assert.equal(r.pulled, false)
  assert.equal(r.x, cam.x)
  assert.equal(r.y, cam.y)
  assert.equal(r.z, cam.z)
})

test('resolveOcclusion: a wall between subject and camera pulls the camera in along the same ray', () => {
  const subj = { x: 0, y: 0, z: 0 }
  const cam = { x: 0, y: 2, z: -10 } // camera 10 units behind, slightly above
  // a ridge that only pokes above the line of sight in the FAR half (near the
  // camera) — close to the subject the ground stays low and clear.
  const wall = (x, z) => (Math.abs(z) > 5 ? 100 : -10)
  const r = resolveOcclusion(subj, cam, wall, { steps: 20, skin: 0.1, minT: 0.1 })
  assert.equal(r.pulled, true)
  // pulled STRICTLY closer to the subject than the original camera position
  const distBefore = Math.hypot(cam.x - subj.x, cam.y - subj.y, cam.z - subj.z)
  const distAfter = Math.hypot(r.x - subj.x, r.y - subj.y, r.z - subj.z)
  assert.ok(distAfter < distBefore, `expected a pull-in, got ${distAfter} >= ${distBefore}`)
  // still along the SAME ray (direction preserved, only magnitude shrunk) —
  // the "spring arm" contract: a game-style collision shortens the arm, it
  // doesn't sidestep it.
  const dirBefore = { x: (cam.x - subj.x) / distBefore, y: (cam.y - subj.y) / distBefore, z: (cam.z - subj.z) / distBefore }
  const dirAfter = { x: (r.x - subj.x) / distAfter, y: (r.y - subj.y) / distAfter, z: (r.z - subj.z) / distAfter }
  assert.ok(Math.abs(dirBefore.x - dirAfter.x) < 1e-6 && Math.abs(dirBefore.y - dirAfter.y) < 1e-6 && Math.abs(dirBefore.z - dirAfter.z) < 1e-6)
})

test('resolveOcclusion: pulled-in position actually clears the ground it was blocked by', () => {
  const subj = { x: 0, y: 0, z: 0 }
  const cam = { x: 0, y: 1, z: -20 }
  const wall = (x, z) => (Math.abs(z) > 8 ? 50 : -10)
  const r = resolveOcclusion(subj, cam, wall, { steps: 30, skin: 0.2, minT: 0.05 })
  assert.equal(r.pulled, true)
  assert.ok(Math.abs(r.z) <= 8 + 1e-9, `pulled-in position ${r.z} should sit at/before the wall at z=±8`)
})

test('resolveOcclusion: minT floors how far the arm can collapse, even against a wall right at the subject', () => {
  const subj = { x: 0, y: 0, z: 0 }
  const cam = { x: 0, y: 0, z: -10 }
  const wallEverywhere = () => 1000 // blocks at every sampled step, including the first
  const r = resolveOcclusion(subj, cam, wallEverywhere, { steps: 10, skin: 0.1, minT: 0.3 })
  assert.equal(r.pulled, true)
  const dist = Math.hypot(r.x - subj.x, r.y - subj.y, r.z - subj.z)
  const original = Math.hypot(cam.x - subj.x, cam.y - subj.y, cam.z - subj.z)
  assert.ok(dist >= original * 0.3 - 1e-6, `expected the minT floor (30% of ${original}) to hold, got ${dist}`)
})

test('resolveOcclusion: no sampleGround means no-op (degenerate caller, e.g. tests without terrain)', () => {
  const subj = { x: 0, y: 0, z: 0 }
  const cam = { x: 1, y: 2, z: 3 }
  const r = resolveOcclusion(subj, cam, null)
  assert.equal(r.pulled, false)
  assert.deepEqual({ x: r.x, y: r.y, z: r.z }, cam)
})

// ---- DroneCam integration: the dead-zone box + anti-nausea guarantees -----

// A switchback "climb": legs alternate ~75° turns while gaining elevation,
// over ~290 world units total — real hairpins (so a naive rig WOULD spin
// hard through them), heavily smoothed away on the spine per the class's
// whole design. Elevation rises monotonically leg to leg, standing in for
// terrain that genuinely climbs (see the task-13 brief's warning that a
// synthetic track must actually gain height to test anything meaningful).
// legs are deliberately small relative to the ~600-unit total span so the
// spine (14 control points + a wide box-blur, see start()) has enough route
// to average several hairpins together into one gentle arc, same as a real
// multi-switchback mountain climb — a short zigzag (few legs) would make
// individual corners comparable in scale to the spine's own control spacing
// and never get properly smoothed, which isn't representative of the rig's
// actual target scenario.
function buildZigzagClimb() {
  const pts = []
  let x = 0, y = 0, z = 0
  let heading = 0
  const legLen = 15
  const legs = 40
  const turn = THREE_deg(55)
  const step = 2
  pts.push({ x, y, z })
  for (let leg = 0; leg < legs; leg++) {
    const dx = Math.sin(heading)
    const dz = Math.cos(heading)
    const n = Math.round(legLen / step)
    for (let i = 1; i <= n; i++) {
      x += dx * step
      z += dz * step
      y += 3 / n // climbs monotonically — a genuinely rising "terrain", not flat
      pts.push({ x, y, z })
    }
    heading += (leg % 2 === 0 ? 1 : -1) * turn
  }
  return pts
}

// Drives a flight and returns the per-axis + combined centering/rate
// measurements every DroneCam integration test below needs — shared so the
// "before/after task 28" numbers in each test are directly comparable.
// Split by axis (mean/median |NDC.x|, |NDC.y| separately) is deliberate: a
// single combined |NDC| distance can hide an axis-specific bug (task 28's
// own field report — pitch barely moving while yaw tracked fine — is
// exactly the kind of asymmetry a combined-only metric would have missed).
function driveFollow(drone, { dt = 1 / 30, duration = 60 } = {}) {
  const prevHeading = new THREE.Vector3()
  let prevPitch = drone._pitch
  let peakYawDegS = 0
  let peakPitchDegS = 0
  let totalFrames = 0
  const absX = []
  const absY = []
  const vSub = new THREE.Vector3()
  const vNdc = new THREE.Vector3()
  const camera = drone.camera
  let s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    prevHeading.copy(drone._headingDir)
    prevPitch = drone._pitch
    s = Math.min(1, s + dt / duration)
    drone.updateAt(dt, s)
    totalFrames++
    const cosA = Math.max(-1, Math.min(1, prevHeading.dot(drone._headingDir)))
    peakYawDegS = Math.max(peakYawDegS, ((Math.acos(cosA) * 180) / Math.PI) / dt)
    peakPitchDegS = Math.max(peakPitchDegS, (Math.abs(drone._pitch - prevPitch) * 180 / Math.PI) / dt)

    // measure against the ACTUAL rendered pose (post-slerp camera.quaternion),
    // not the internal correction target — that's what a viewer really sees.
    camera.updateMatrixWorld(true)
    drone.curve.getPointAt(s, vSub)
    vNdc.copy(vSub).project(camera)
    absX.push(Math.abs(vNdc.x))
    absY.push(Math.abs(vNdc.y))
  }
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const median = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  return {
    totalFrames, peakYawDegS, peakPitchDegS,
    meanAbsNdcX: mean(absX), meanAbsNdcY: mean(absY),
    medianAbsNdcX: median(absX), medianAbsNdcY: median(absY),
  }
}

test('DroneCam continuous centering: peak yaw/pitch stay capped and the tracked point sits close to screen centre on BOTH axes', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const worldPts = buildZigzagClimb()
  const ok = drone.start(worldPts, { duration: 60 })
  assert.ok(ok, 'drone.start should succeed on a valid climbing zigzag')

  // Deterministic simulated-time loop (see the task-13 brief: real-time
  // sampling in a throttled/hidden tab is useless) — drive updateAt with a
  // fixed dt and an explicit progress fraction rather than wall-clock time,
  // exactly like main.js's GPX playback follow does via gpxLayer.headT.
  const m = driveFollow(drone, { dt: 1 / 30, duration: 60 })
  assert.ok(m.totalFrames > 100, `flight should run many frames, got ${m.totalFrames}`)
  // task 28: caps raised 13/22 -> 50/85 deg/s BY THE USER'S OWN CALL (see
  // drone-cam.js's this.maxYawRateDeg comment) — continuous centering
  // (every frame, not just near a dead-zone edge) saturates these on this
  // torture fixture, same relationship as every prior round in this file.
  assert.ok(m.peakYawDegS <= 90.5, `peak yaw ${m.peakYawDegS.toFixed(2)} deg/s exceeds the 90°/s cap (raised by explicit request: grosse liberté de rotation)`)
  assert.ok(m.peakPitchDegS <= 85.5, `peak pitch ${m.peakPitchDegS.toFixed(2)} deg/s exceeds the 85°/s cap`)
  // BOTH axes must track close to centre — this is the task-28 acceptance
  // bar, and the split-by-axis assertion is exactly what would have caught
  // the field-reported pitch-barely-moves bug (a combined-only metric could
  // pass with X perfect and Y terrible, averaging out to "fine").
  assert.ok(m.meanAbsNdcX < 0.35, `mean |NDC.x| ${m.meanAbsNdcX.toFixed(3)} too far from centre`)
  assert.ok(m.meanAbsNdcY < 0.5 /* lower-third framing targets |NDC.y|~0.3 by design */, `mean |NDC.y| ${m.meanAbsNdcY.toFixed(3)} too far from centre`)
})

// ---- task 16 §4: cinematic standoff-breathing variation (orbit-bias removed — it integrated into drift) -----
// Layered ON TOP of the same rig above — these tests prove the addition (a)
// actually varies the standoff and (b) doesn't blow the exact same measured
// contract the test above guards (peak yaw/pitch capped, both axes close to
// centre), using the identical zigzag-climb fixture and duration so the
// numbers are directly comparable to the baseline test's own thresholds.
test('DroneCam standoff breathes (closer/further) but never strays far from the tuned base', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const worldPts = buildZigzagClimb()
  const duration = 60
  assert.ok(drone.start(worldPts, { duration }))

  const dt = 1 / 30
  let minStandoff = Infinity
  let maxStandoff = -Infinity
  let s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    s = Math.min(1, s + dt / duration)
    drone.updateAt(dt, s)
    const standoff = drone.arm * drone._standoffMul
    minStandoff = Math.min(minStandoff, standoff)
    maxStandoff = Math.max(maxStandoff, standoff)
  }
  // "varier beaucoup plus le zoom" — the drama system must produce a genuinely
  // wide excursion, not a timid wobble (dramaStandoffMul spans ~0.72..1.95 by
  // design: push in on a col, pull out on flats and bends).
  // Task 26 landed arm/lift at 4.5/2.25 (not a flat half of task-24's 12/6) to
  // hit the MEASURED 50%-closer median on the real europaweg.gpx fixture — see
  // this.arm's comment in drone-cam.js for the sweep. On THIS fixture that
  // moves the range to ~5.50..8.78 (range 3.28), so the thresholds below are
  // rescaled to match: the range floor drops from 4 to 3 (same ~8% margin
  // below the measured 3.28 as the old floor kept below its own 4.37), and the
  // absolute fences keep the same asymmetric margin the task-24 fences did
  // (floor a little under the measured min, ceiling generously over the
  // measured max to leave room for a more dramatic fixture later): 5.0 and 18.
  assert.ok(maxStandoff - minStandoff > 3, `expected real zoom drama, got range ${minStandoff.toFixed(2)}..${maxStandoff.toFixed(2)}`)
  assert.ok(minStandoff >= 5.0, `standoff dipped too close: ${minStandoff.toFixed(2)}`)
  assert.ok(maxStandoff <= 18, `standoff strayed too far: ${maxStandoff.toFixed(2)}`)
})

test('DroneCam breathing variation does not regress the continuous-centering contract', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const worldPts = buildZigzagClimb()
  const duration = 60 // same duration as the baseline centering test above
  assert.ok(drone.start(worldPts, { duration }))

  const m = driveFollow(drone, { dt: 1 / 30, duration })
  // the hard rate cap is architectural (slewHeading clamps every frame
  // regardless of what target the breathing/bias feeds it) — this can never
  // regress, but assert it anyway as a tripwire against a future change to
  // the cap-application itself. Cap raised 13 -> 50 deg/s, task 28 (see above).
  assert.ok(m.peakYawDegS <= 90.5, `peak yaw ${m.peakYawDegS.toFixed(2)} deg/s exceeds the 90°/s cap (raised by explicit request: grosse liberté de rotation)`)
  assert.ok(m.meanAbsNdcX < 0.35, `mean |NDC.x| ${m.meanAbsNdcX.toFixed(3)} too far from centre (variation regressed it)`)
  assert.ok(m.meanAbsNdcY < 0.5 /* lower-third framing targets |NDC.y|~0.3 by design */, `mean |NDC.y| ${m.meanAbsNdcY.toFixed(3)} too far from centre (variation regressed it)`)
})

// ---- task 22 §5: sequenced-playback handover between GPX layers -----------
// A second leg, offset far from the first AND facing a different direction —
// exactly the "different track" scenario retarget() exists for. Reusing
// start()'s zigzag-climb shape (same turn/step tuning) but translated well
// clear of leg A and walked in the opposite compass direction, so a NAIVE
// re-seat (start() again) would visibly snap: a fresh start() at s=0 on this
// track points ~180° from wherever leg A's camera was heading when it ended.
function buildOffsetZigzagClimb() {
  const pts = buildZigzagClimb()
  return pts.map((p) => ({ x: -p.x + 400, y: p.y, z: -p.z + 250 }))
}

test('DroneCam.retarget() hands over to a new track without exceeding the yaw-rate cap (no snap)', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const legA = buildZigzagClimb()
  const legB = buildOffsetZigzagClimb()
  const duration = 60
  assert.ok(drone.start(legA, { duration }))

  const dt = 1 / 30
  const prevHeading = new THREE.Vector3()
  let peakYawDegS = 0
  const drive = (s) => {
    prevHeading.copy(drone._headingDir)
    drone.updateAt(dt, s)
    const cosA = Math.max(-1, Math.min(1, prevHeading.dot(drone._headingDir)))
    peakYawDegS = Math.max(peakYawDegS, ((Math.acos(cosA) * 180) / Math.PI) / dt)
  }

  // fly most of leg A, same as a real playback approaching the end of a track
  let s = 0
  while (s < 1) {
    s = Math.min(1, s + dt / duration)
    drive(s)
  }
  const headingBeforeHandover = drone._headingDir.clone()
  const posBeforeHandover = drone._pos.clone()

  // the handover itself — GpxLayerManager.tick()'s onTrackTransition moment
  const ok = drone.retarget(legB)
  assert.ok(ok, 'retarget should succeed on a valid second track')
  // retarget must NOT re-seat position/heading — that's the whole point
  assert.ok(drone._pos.distanceTo(posBeforeHandover) < 1e-6, 'retarget moved the camera instantly — that is a snap')
  assert.ok(drone._headingDir.distanceTo(headingBeforeHandover) < 1e-6, 'retarget re-seated heading instantly — that is a snap')

  // fly leg B from its own start; the rig should EASE onto the new spine
  // (heading, standoff, framing) under the exact same rate cap as any other
  // frame — never a discontinuous jump, no matter how differently leg B is
  // oriented from where leg A left off.
  s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    s = Math.min(1, s + dt / duration)
    drive(s)
  }
  // cap raised 13 -> 50 deg/s, task 28 (see drone-cam.js's this.maxYawRateDeg comment)
  assert.ok(peakYawDegS <= 90.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the 90°/s cap across the handover`)
})

test('DroneCam.retarget() leaves the current flight untouched on a degenerate track', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  assert.ok(drone.start(buildZigzagClimb(), { duration: 60 }))
  const curveBefore = drone.curve
  assert.equal(drone.retarget([{ x: 0, y: 0, z: 0 }]), false)
  assert.equal(drone.curve, curveBefore, 'a degenerate retarget must not touch the live curve')
  assert.ok(drone.active, 'a degenerate retarget must not kill the running flight')
})

// ---- task 24: closer standoff (arm 24->12) must still clear real relief ----
// A bumpy "mountain" ground function (real elevation variation, not flat 0
// like every fixture above) — the closer/looser task-24 tuning is only safe
// if _solvePosition()'s clearance clamp (this.clearance, plus its own
// look-ahead ridge lift) still holds against genuine terrain, not just flat
// ground where a clearance bug would never show up.
function mountainGround(x, z) {
  return 8 + 6 * Math.sin(x * 0.04) * Math.cos(z * 0.05) + 3 * Math.sin(x * 0.11 + z * 0.07)
}

test('DroneCam ground contact is a bounded bounce, never a clip-through', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: mountainGround })
  const worldPts = buildZigzagClimb()
  const duration = 60
  assert.ok(drone.start(worldPts, { duration }))

  const dt = 1 / 30
  let minClearanceGap = Infinity
  let s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    s = Math.min(1, s + dt / duration)
    drone.updateAt(dt, s)
    const groundHere = mountainGround(camera.position.x, camera.position.z)
    minClearanceGap = Math.min(minClearanceGap, camera.position.y - groundHere)
  }
  // CONTRACT CHANGED by explicit request ("éviter les collisions de la caméra
  // avec le sol > faire un rebond"): the floor is now a slightly under-damped
  // SPRING, so a transient dip below the 2.6 clearance is the intended
  // rebound — the old hard `y = floor` teleport was itself one of the
  // reported vertical jumps. What must still never happen is passing the hard
  // floor (70% of clearance): a bounce is a look, clipping into rock is a bug.
  assert.ok(
    minClearanceGap >= drone.clearance * 0.7 - 0.05,
    `camera dipped to ${minClearanceGap.toFixed(3)} world units above ground — past the hard floor`
  )
})

function THREE_deg(d) { return (d * Math.PI) / 180 }
function THREE_clampDot(d) { return Math.max(-1, Math.min(1, d)) }

test('a vertically-noisy GPX cannot pump the camera (stabilized gimbal)', () => {
  // Field report: "les erreurs verticales des GPX posent beaucoup de soucis à
  // la caméra". Feed a track whose Y alternates ±2.5 every point — far worse
  // than real drape noise — and require the realized camera Y to move gently.
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const pts = []
  for (let i = 0; i < 120; i++) pts.push({ x: i * 0.8, y: 6 + (i % 2 ? 2.5 : -2.5), z: Math.sin(i * 0.1) * 4 })
  assert.ok(drone.start(pts, { duration: 30 }))
  const dt = 1 / 30
  let prevY = camera.position.y
  let maxStep = 0
  for (let s = 0; s <= 1.0001; s += dt / 30) {
    drone.updateAt(dt, Math.min(s, 1))
    maxStep = Math.max(maxStep, Math.abs(camera.position.y - prevY))
    prevY = camera.position.y
  }
  // raw noise is 5.0 units point-to-point; the camera must never see it
  assert.ok(maxStep < 0.35, `camera Y stepped ${maxStep.toFixed(3)} in one frame — the noise got through`)
})

test('the camera never stares at the ground (directorial pitch floor)', () => {
  // Field report: "regarde trop souvent vers le bas". Whatever the framing
  // solver asks, realized pitch must respect minPitchRad.
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: mountainGround })
  assert.ok(drone.start(buildZigzagClimb(), { duration: 40 }))
  const dt = 1 / 30
  const fwd = new THREE.Vector3()
  let minPitch = Infinity
  let floorViolationsWithHeadSafe = 0
  const head = new THREE.Vector3()
  for (let s = 0; s <= 1.0001; s += dt / 40) {
    const t = Math.min(s, 1)
    drone.updateAt(dt, t)
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
    const pitch = Math.atan2(fwd.y, Math.hypot(fwd.x, fwd.z))
    minPitch = Math.min(minPitch, pitch)
    // The floor may ONLY be pierced in service of keeping the head framed
    // (the frame-keeping override): if pitch is below floor while the head
    // is comfortably high in frame, the floor just failed for no reason.
    if (pitch < drone.minPitchRad - 0.06) {
      drone.curve.getPointAt(t, head)
      head.project(camera)
      if (head.y > drone.bottomKeepNdcY + 0.25) floorViolationsWithHeadSafe++
    }
  }
  assert.ok(minPitch >= -1.45 - 1e-6, `pitch reached ${minPitch.toFixed(3)} rad — past even the frame-keeping bound`)
  assert.equal(floorViolationsWithHeadSafe, 0, 'floor pierced while the head did not need it')
})
