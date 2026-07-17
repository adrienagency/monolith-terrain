import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { resamplePath, smoothPath, slewHeading, solvePitchForNdcY, ndcYForPitch, DroneCam } from '../src/drone-cam.js'

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

test('DroneCam dead-zone: peak yaw stays capped and the tracked point mostly stays in the box', () => {
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
  const dt = 1 / 30
  const duration = 60
  const prevHeading = new THREE.Vector3()
  let peakYawDegS = 0
  let framesInBox = 0
  let totalFrames = 0
  const vSub = new THREE.Vector3()
  const vNdc = new THREE.Vector3()
  let s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    prevHeading.copy(drone._headingDir)
    s = Math.min(1, s + dt / duration)
    drone.updateAt(dt, s)
    totalFrames++
    const cosA = Math.max(-1, Math.min(1, prevHeading.dot(drone._headingDir)))
    const yawRateDeg = ((Math.acos(cosA) * 180) / Math.PI) / dt
    peakYawDegS = Math.max(peakYawDegS, yawRateDeg)

    // measure against the ACTUAL rendered pose (post-slerp camera.quaternion),
    // not the internal correction target — that's what a viewer really sees.
    // Sample the subject at the SAME `s` just fed to updateAt (not drone.t —
    // update()'s OWN internal timer would need trapezoid(t) instead, which
    // is why this test uses updateAt with an explicit s, matching the real
    // GPX-follow call site in main.js exactly).
    camera.updateMatrixWorld(true)
    drone.curve.getPointAt(s, vSub)
    vNdc.copy(vSub).project(camera)
    if (
      vNdc.x >= drone.deadzone.xMin && vNdc.x <= drone.deadzone.xMax &&
      vNdc.y >= drone.deadzone.yMin && vNdc.y <= drone.deadzone.yMax
    ) framesInBox++
  }
  const pctInBox = (framesInBox / totalFrames) * 100
  assert.ok(totalFrames > 100, `flight should run many frames, got ${totalFrames}`)
  // task 24: cap raised 9 -> 13 deg/s (see drone-cam.js's this.maxYawRateDeg
  // comment) — "plus de liberté de mouvement", so peak yaw on this same
  // torture fixture now saturates the new cap (measured 13.00) instead of 9.
  assert.ok(peakYawDegS <= 13.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the ~13°/s anti-nausea cap`)
  assert.ok(pctInBox >= 85, `only ${pctInBox.toFixed(1)}% of frames kept the tracked point inside the dead-zone box`)
})

// ---- task 16 §4: cinematic standoff-breathing variation (orbit-bias removed — it integrated into drift) -----
// Layered ON TOP of the same rig above — these tests prove the addition (a)
// actually varies the standoff and (b) doesn't blow the exact same measured
// contract the test above guards (peak yaw capped, % frames in box), using
// the identical zigzag-climb fixture and duration so the numbers are
// directly comparable to the baseline test's own 85%/9.5 thresholds.
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
  assert.ok(maxStandoff - minStandoff > 4, `expected real zoom drama, got range ${minStandoff.toFixed(2)}..${maxStandoff.toFixed(2)}`)
  // "jamais vraiment très loin" — bounded in ABSOLUTE world units, not relative
  // to `arm`. A relative bound silently tightens whenever the baseline changes:
  // this assertion originally allowed arm*1.35 with arm=36 (=48.6 absolute), and
  // task-20's 50%-closer baseline (arm 24) turned the same expression into 32.4
  // absolute — stricter than anyone intended, purely by accident. Task 26 halved
  // the baseline again (arm 12 -> 6, see this.arm's comment in drone-cam.js) —
  // measured on this exact fixture that moves the range to ~7.33..11.70, so the
  // fences below are rescaled by the same ~1/2 factor as the baseline itself
  // (14 -> 6.5, 50 -> 25), same margin either side of the measured range as the
  // task-24 fences kept around theirs.
  assert.ok(minStandoff >= 6.5, `standoff dipped too close: ${minStandoff.toFixed(2)}`)
  assert.ok(maxStandoff <= 25, `standoff strayed too far: ${maxStandoff.toFixed(2)}`)
})

test('DroneCam breathing variation does not regress the dead-zone contract', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
  const worldPts = buildZigzagClimb()
  const duration = 60 // same duration as the baseline "dead-zone" test above
  assert.ok(drone.start(worldPts, { duration }))

  const dt = 1 / 30
  const prevHeading = new THREE.Vector3()
  const vSub = new THREE.Vector3()
  const vNdc = new THREE.Vector3()
  let peakYawDegS = 0
  let framesInBox = 0
  let totalFrames = 0
  let s = 0
  let guard = 0
  while (s < 1 && guard++ < 5000) {
    prevHeading.copy(drone._headingDir)
    s = Math.min(1, s + dt / duration)
    drone.updateAt(dt, s)
    totalFrames++
    const cosA = Math.max(-1, Math.min(1, prevHeading.dot(drone._headingDir)))
    peakYawDegS = Math.max(peakYawDegS, ((Math.acos(cosA) * 180) / Math.PI) / dt)
    camera.updateMatrixWorld(true)
    drone.curve.getPointAt(s, vSub)
    vNdc.copy(vSub).project(camera)
    if (
      vNdc.x >= drone.deadzone.xMin && vNdc.x <= drone.deadzone.xMax &&
      vNdc.y >= drone.deadzone.yMin && vNdc.y <= drone.deadzone.yMax
    ) framesInBox++
  }
  const pctInBox = (framesInBox / totalFrames) * 100
  // the hard rate cap is architectural (slewHeading clamps every frame
  // regardless of what target the breathing/bias feeds it) — this can never
  // regress, but assert it anyway as a tripwire against a future change to
  // the cap-application itself. Cap raised 9 -> 13 deg/s, task 24 (see above).
  assert.ok(peakYawDegS <= 13.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the ~13°/s anti-nausea cap`)
  assert.ok(pctInBox >= 85, `only ${pctInBox.toFixed(1)}% of frames kept the tracked point inside the dead-zone box (variation regressed it)`)
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
  // cap raised 9 -> 13 deg/s, task 24 (see drone-cam.js's this.maxYawRateDeg comment)
  assert.ok(peakYawDegS <= 13.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the ~13°/s anti-nausea cap across the handover`)
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

test('DroneCam never dips below ground clearance over rugged terrain (task 24 closer standoff)', () => {
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
  // must never go below the configured clearance (2.6) minus a tiny float
  // slop — a smaller absolute margin here would mean the rig is clipping in.
  assert.ok(
    minClearanceGap >= drone.clearance - 0.05,
    `camera dipped to ${minClearanceGap.toFixed(3)} world units above ground, below the ${drone.clearance} clearance floor`
  )
})

function THREE_deg(d) { return (d * Math.PI) / 180 }
function THREE_clampDot(d) { return Math.max(-1, Math.min(1, d)) }
