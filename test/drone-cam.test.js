import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { resamplePath, smoothPath, slewHeading, solvePitchForNdcY, ndcYForPitch, resolveOcclusion, amortisVisee, DroneCam } from '../src/drone-cam.js'

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

// ---- amortisVisee: la visee (aim) est desormais amortie, pas verrouillee --
//
// Adrien (2026-08-04) : « tu peux relacher un peu la pression sur la camera
// pour fluidifier ». _aim() visait pile la tete a chaque frame (zero lag) ;
// chaque petit changement de cap de la tete faisait donc pivoter la vue
// instantanement. amortisVisee applique la meme loi que `damp` (exponentielle
// image-independante) pour que la visee rattrape sa cible progressivement.

test('LA VISEE EST AMORTIE : elle ne saute pas sur la nouvelle direction', () => {
  const vise = { x: 0, y: 0, z: 0 }
  const cible = { x: 10, y: 0, z: 0 }
  amortisVisee(vise, cible, 0.4, 1 / 60)
  assert.ok(vise.x > 0 && vise.x < 10, `rattrapage partiel attendu, obtenu ${vise.x}`)
})

test('la visee amortie finit par rattraper une cible fixe', () => {
  const vise = { x: 0, y: 0, z: 0 }
  const cible = { x: 10, y: 0, z: 0 }
  for (let i = 0; i < 600; i++) amortisVisee(vise, cible, 0.4, 1 / 60)
  assert.ok(Math.abs(vise.x - 10) < 0.01)
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

// BORNE X RECALIBRÉE (task 4, 2026-08-04) : `meanAbsNdcX` passe de 0,35 à 0,40.
// Avant cette tâche, _aim() visait la tête à latence nulle ; le centrage
// mesuré ici ne dépendait donc que du damping de POSITION. Depuis qu'un
// aimHalfLife = 0,28 s amortit aussi la visée (voir drone-cam.js, _aim), la
// tête peut légèrement déborder du centre PENDANT les virages de cette
// fixture (elle enchaîne des épingles à 55°) avant de s'y recentrer — c'est
// exactement le compromis tranché par Adrien (« tu peux relâcher un peu la
// pression sur la caméra pour fluidifier »), pas une régression. Mesuré sur
// cette fixture : meanAbsNdcX ≈ 0,355 (contre ~0,34 avant l'amortissement de
// la visée) ; 0,40 laisse une marge sans rouvrir la porte à un vrai décentrage.
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
  assert.ok(m.peakYawDegS <= 120.5, `peak yaw ${m.peakYawDegS.toFixed(2)} deg/s exceeds the 120°/s cap (raised by explicit request: grosse liberté de rotation)`)
  assert.ok(m.peakPitchDegS <= 160.5, `peak pitch ${m.peakPitchDegS.toFixed(2)} deg/s exceeds the 160°/s cap`)
  // BOTH axes must track close to centre — this is the task-28 acceptance
  // bar, and the split-by-axis assertion is exactly what would have caught
  // the field-reported pitch-barely-moves bug (a combined-only metric could
  // pass with X perfect and Y terrible, averaging out to "fine").
  assert.ok(m.meanAbsNdcX < 0.4 /* recalibré task 4 : voir le commentaire au-dessus du test */, `mean |NDC.x| ${m.meanAbsNdcX.toFixed(3)} too far from centre`)
  assert.ok(m.meanAbsNdcY < 0.5 /* lower-third framing targets |NDC.y|~0.3 by design */, `mean |NDC.y| ${m.meanAbsNdcY.toFixed(3)} too far from centre`)
})

// ---- le standoff du RAIL (réécrit 2026-07-29) ------------------------------
//
// CE TEST A ÉTÉ RECALIBRÉ, et il faut dire pourquoi plutôt que de déplacer une
// borne en silence.
//
// Sa version précédente gardait `dramaStandoffMul`, un multiplicateur qui
// « respirait » autour de `this.arm` (4,5) — d'où ses bornes 5,0 et 18. Or ce
// mécanisme N'EXISTE PLUS : la réécriture en RAIL PRÉCALCULÉ (cf. l'en-tête de
// drone-cam.js) a déplacé la dramaturgie dans le CHEMIN lui-même, et le
// standoff est devenu une cible amortie, `this.dist = 22`. Le mot
// `dramaStandoffMul` ne subsistait que dans le commentaire de ce test.
//
// `_standoffMul` n'est d'ailleurs plus un réglage mais un RELEVÉ : drone-cam.js
// le calcule en fin d'update (`_pos.distanceTo(_headPt) / this.arm`). Le test
// mesurait donc bien la distance caméra→tête réelle, mais la comparait à une
// base tuée depuis. Mesuré sur cette fixture : 20,68 .. 23,23 (amplitude 2,55),
// soit ±6 % autour des 22 visés — l'échec à 22,72 > 18 était le symptôme.
//
// Ce que le rail promet VRAIMENT, et ce qu'on garde donc ici : la distance
// respire un peu, et ne s'éloigne jamais de la cible réglée. Bornes 15 et 30 =
// la même marge asymétrique que les anciennes gardaient autour de leur base.
test('DroneCam : le standoff respire autour de la cible réglée, sans jamais s en éloigner', () => {
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
    const standoff = drone.arm * drone._standoffMul // = distance caméra → tête
    minStandoff = Math.min(minStandoff, standoff)
    maxStandoff = Math.max(maxStandoff, standoff)
  }
  assert.ok(maxStandoff - minStandoff > 1, `le standoff doit respirer, amplitude ${(maxStandoff - minStandoff).toFixed(2)}`)
  assert.ok(minStandoff >= 15, `standoff trop proche : ${minStandoff.toFixed(2)} (cible ${drone.dist})`)
  assert.ok(maxStandoff <= 30, `standoff trop lointain : ${maxStandoff.toFixed(2)} (cible ${drone.dist})`)
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
  assert.ok(m.peakYawDegS <= 120.5, `peak yaw ${m.peakYawDegS.toFixed(2)} deg/s exceeds the 120°/s cap (raised by explicit request: grosse liberté de rotation)`)
  // même recalibrage task 4 que le test de centrage continu ci-dessus (voir
  // son commentaire) : l'amortissement de la visée (aimHalfLife = 0,28 s)
  // laisse la tête déborder un peu du centre pendant les virages, borne 0,40.
  assert.ok(m.meanAbsNdcX < 0.4, `mean |NDC.x| ${m.meanAbsNdcX.toFixed(3)} too far from centre (variation regressed it)`)
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
  assert.ok(peakYawDegS <= 120.5, `peak yaw ${peakYawDegS.toFixed(2)} deg/s exceeds the 120°/s cap across the handover`)
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

// RENOMMÉ ET RECALIBRÉ (task 4, 2026-08-04 — « tu peux relâcher un peu la
// pression sur la caméra pour fluidifier »). L'ancien nom du test
// ('the head stays locked near screen centre') et sa citation d'origine
// (« dans les 10% du centre de l'écran ») décrivaient un VERROUILLAGE strict.
// Ce n'est plus ce qui est vérifié ici — le nom mentait au lecteur, donc il
// change, pas seulement la borne.
//
// La citation d'origine demandait À LA FOIS un centrage à 10 % ET « une
// toute petite latence » — les deux sont en tension dès qu'une latence existe
// VRAIMENT : _aim() visait jusqu'ici la tête à latence nulle (0,15 de marge
// ne mesurait donc que le damping de POSITION). Le correctif (aimHalfLife =
// 0,28 s, voir drone-cam.js) amortit désormais aussi la visée EN POSITION
// MONDE, sur le même modèle que _headDisp dans gpx.js.
//
// RELECTURE (2026-08-04) : plutôt qu'une seule moyenne globale desserrée, il
// a été suggéré de séparer la mesure en deux bornes serrées — un régime
// ÉTABLI entre virages (qui devrait rester proche du centre) et un pic
// PENDANT un virage (qui a le droit d'être large). Tentative faite, mesures
// à l'appui, et REJETÉE : la séparation ne discrimine rien sur cette
// implémentation.
//
// Preuve : un tracé PARFAITEMENT DROIT (zéro virage, zéro courbure) produit
// déjà un écart NDC moyen non nul et qui CROÎT avec la vitesse de défilement
// — voir le test 'même sans aucun virage...' juste en dessous : ≈0,20 à 5
// u/s, ≈0,38 à 10 u/s, ≈0,65 à 20 u/s. Sur la fixture ci-dessous (zigzag
// 55°), classer chaque frame « en virage » ou « stable » via le taux de
// rotation réel du CAP DU TRACÉ (pas de la caméra) donne des moyennes quasi
// identiques (steady ≈0,61 / virage ≈0,64 sur un balayage de seuils 5 à
// 40°/s) : le régime « stable » n'a RIEN de serré. La raison géométrique :
// _viseDisp est un point en POSITION MONDE qui chasse la tête avec un
// filtre exponentiel ; vu depuis le CÔTÉ (la caméra est délibérément placée
// « sur le côté » du parcours, cf. _buildCurves), ce point traîne derrière
// la tête d'une distance ≈ vitesse × constante-de-temps, TOUJOURS, même en
// ligne droite — ce n'est pas un effet de virage, c'est le prix de tout
// mouvement. Forcer une borne serrée sur un "régime stable" qui n'existe pas
// séparément aurait juste échoué en permanence ou été aussi lâche que
// l'autre — dans les deux cas, deux bornes n'auraient rien apporté qu'une
// seule ne dise déjà. D'où le choix : UNE borne globale honnêtement nommée et
// documentée, complétée par le test de proportionnalité à la vitesse
// ci-dessous qui, lui, pinne précisément la mécanique réelle plutôt qu'une
// distinction stable/virage qui n'existe pas dans les faits.
//
// Sur cette fixture (épingles à 55° enchaînées sans répit, terrain
// accidenté, 40 s pour ~600 unités) : mean NDC ≈ 0,634 (mesuré, contre
// ≈0,10 à latence nulle). 0,75 borne cette torture fixture avec marge —
// vérifié par la relecture : repatcher aimHalfLife à 0,35/0,55/5,0 fait
// remonter la mesure à 0,80/0,92/70 respectivement, donc la borne attrape
// encore un mauvais dosage dès ~+20 %.
test('the head sits within a bounded (not locked) distance of centre — envelope loosened by aim damping, task 4', () => {
  // Citation d'origine (contrat AVANT task 4, désormais partiellement
  // dépassé — voir le commentaire au-dessus) : 'Calle un follow sur le point
  // d'avancée... toujours toujours focus sur lui, dans les 10% du centre de
  // l'écran, une toute petite latence.' Ce test vérifie maintenant un
  // PLAFOND large (0,75), pas un verrou à 10 % : voir le commentaire
  // au-dessus pour ce qui reste réellement garanti et pourquoi.
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: mountainGround })
  assert.ok(drone.start(buildZigzagClimb(), { duration: 40 }))
  const dt = 1 / 30
  const head = new THREE.Vector3()
  let sum = 0, n = 0
  for (let s = 0; s <= 1.0001; s += dt / 40) {
    const t = Math.min(s, 1)
    drone.updateAt(dt, t)
    camera.updateMatrixWorld(true)
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
    drone.curve.getPointAt(t, head)
    head.project(camera)
    sum += Math.hypot(head.x, head.y); n++
  }
  const mean = sum / n
  assert.ok(mean < 0.75 /* recalibré task 4 : voir le commentaire au-dessus du test */, `mean NDC distance ${mean.toFixed(3)} — the head is not locked to centre`)
})

// Ce test pinne le VRAI mécanisme derrière la borne desserrée ci-dessus, à la
// place d'un découpage stable/virage qui n'existe pas (voir le long
// commentaire au-dessus) : sur un tracé PARFAITEMENT DROIT — zéro virage,
// zéro courbure — l'écart NDC moyen n'est PAS nul et croît avec la vitesse de
// défilement. _viseDisp (position monde) traîne derrière la tête d'une
// distance ≈ vitesse × constante de temps de aimHalfLife ; vu depuis le côté
// (la caméra encadre delibérément le parcours de profil), ce retard se lit à
// l'écran même sans le moindre changement de cap. C'est la vraie nature du
// compromis accepté par Adrien : « relâcher la pression » coûte un peu de
// centrage EN PERMANENCE, proportionnellement à l'allure, pas seulement dans
// les virages.
test('même sans aucun virage, la visée amortie dérive du centre proportionnellement à la vitesse', () => {
  function buildStraight(length, n) {
    const pts = []
    for (let i = 0; i <= n; i++) pts.push({ x: 0, y: 2, z: (length * i) / n })
    return pts
  }
  function meanNdcAtSpeed(duration, length = 600) {
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 4000)
    const controls = { target: new THREE.Vector3() }
    const drone = new DroneCam({ camera, controls, sampleGround: () => 0 })
    assert.ok(drone.start(buildStraight(length, 400), { duration }))
    const dt = 1 / 30
    const head = new THREE.Vector3()
    let sum = 0, n = 0
    // s in [0.3, 0.9] : loin du seedAt de start() et de l'arrivée, le régime
    // est établi (ni le transitoire de démarrage ni le ralenti de fin).
    for (let s = 0.3; s <= 0.9; s += dt / duration) {
      drone.updateAt(dt, s)
      camera.updateMatrixWorld(true)
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
      drone.curve.getPointAt(s, head)
      head.project(camera)
      sum += Math.hypot(head.x, head.y); n++
    }
    return sum / n
  }
  const slow = meanNdcAtSpeed(120) // ~5 u/s
  const mid = meanNdcAtSpeed(60) // ~10 u/s
  const fast = meanNdcAtSpeed(30) // ~20 u/s
  // pas de virage nulle part ici : si l'écart était uniquement le prix des
  // virages, ces trois mesures seraient toutes ~0. Elles ne le sont pas, et
  // elles montent avec la vitesse — c'est la preuve du mécanisme, pas un
  // artefact de fixture.
  assert.ok(slow > 0.05, `même lent, l'écart doit être mesurable (obtenu ${slow.toFixed(3)})`)
  assert.ok(mid > slow, `l'écart doit croître avec la vitesse (lent ${slow.toFixed(3)} >= moyen ${mid.toFixed(3)})`)
  assert.ok(fast > mid, `l'écart doit croître avec la vitesse (moyen ${mid.toFixed(3)} >= rapide ${fast.toFixed(3)})`)
})

// ─────────────── LA TÊTE NE PASSE JAMAIS DERRIÈRE LA CAMÉRA (GX6 ②)
//
// ⛔ Mesuré au banc de lecture du noteur (Mont-Blanc, clic sur « ▶ Lecture »,
// 40 relevés) : 2 à 3 images sur 40 avec la tête projetée DERRIÈRE la caméra
// (par exemple (−8 288, −10 381)) et **zéro pixel de tracé** à l'écran. Le
// témoin `banc-gx5-vol --sansRedrapage` rend les mêmes images : ce n'est ni le
// re-drapage ni le `retarget`, c'est la visée AMORTIE (aimHalfLife) contre un
// saut de POSITION — la dé-occlusion rentre la caméra devant une crête, la
// butée au sol la relève, et l'interpolation ne rattrape pas un demi-tour.
//
// La garde EXÉCUTE le cas : caméra posée au-delà de la tête, visée périmée
// derrière elle, une image de `updateAt`. Sans le recalage, le produit scalaire
// (tête − caméra) · (avant de la caméra) reste négatif — la tête est derrière.
test('DroneCam : la tête ne reste jamais derrière la caméra, même après un saut de pose', () => {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400)
  const controls = { target: new THREE.Vector3() }
  const drone = new DroneCam({ camera, controls, sampleGround: () => -1000 })
  const pts = []
  for (let i = 0; i <= 40; i++) pts.push({ x: i * 2, y: 0, z: 0 })
  assert.ok(drone.start(pts, { duration: 30 }), 'start refusé sur un chemin droit')

  const s = 0.5
  const tete = new THREE.Vector3()
  drone.curve.getPointAt(s, tete)
  // LE SAUT : la caméra a été rentrée au-delà de la tête, la visée est restée
  // 40 unités en arrière — la tête est franchement derrière le plan de visée.
  drone._pos.set(tete.x - 20, tete.y + 1, tete.z)
  drone._viseDisp.set(tete.x - 60, tete.y + 1, tete.z)
  camera.position.copy(drone._pos)

  drone.updateAt(1 / 60, s, tete)
  camera.updateMatrixWorld(true)

  const avant = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const vers = tete.clone().sub(camera.position)
  assert.ok(vers.dot(avant) > 0,
    `la tête est DERRIÈRE la caméra (produit scalaire ${vers.dot(avant).toFixed(2)}) : l’image de lecture n’a pas un pixel de tracé`)
  // et elle est bien dans le champ, pas seulement du bon côté
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  const q = tete.clone().project(camera)
  assert.ok(q.z > -1 && q.z < 1, `la tête est hors du tronc de vue (z = ${q.z.toFixed(3)})`)
  assert.ok(Math.hypot(q.x, q.y) < 0.2, `la tête n’est pas revenue au centre (ndc ${q.x.toFixed(2)}, ${q.y.toFixed(2)})`)
})
