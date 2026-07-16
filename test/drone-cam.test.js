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
  assert.ok(peakYawDegS <= 9.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the ~9°/s anti-nausea cap`)
  assert.ok(pctInBox >= 85, `only ${pctInBox.toFixed(1)}% of frames kept the tracked point inside the dead-zone box`)
})

function THREE_deg(d) { return (d * Math.PI) / 180 }
function THREE_clampDot(d) { return Math.max(-1, Math.min(1, d)) }
