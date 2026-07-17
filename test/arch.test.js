import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from 'three'
import {
  headingAt,
  computeArchSpecs,
  perpOf,
  primaryDir,
  classifyArchSize,
  archTransform,
  textInkFor,
  OLD_ARCH_WIDTH,
  ARCH_TARGET_WIDTH,
} from '../src/arch.js'

test('headingAt points from the previous point to the next, normalized', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }]
  const h = headingAt(world, 1)
  assert.ok(Math.abs(h.x - 1) < 1e-9 && Math.abs(h.z) < 1e-9)
})

test('headingAt at the very start/end uses the single adjacent segment', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 5 }]
  assert.deepEqual(headingAt(world, 0), { x: 0, z: 1 })
  assert.deepEqual(headingAt(world, 1), { x: 0, z: 1 })
})

test('headingAt falls back to +Z for a degenerate (coincident) neighbourhood', () => {
  const world = [{ x: 3, y: 0, z: 3 }, { x: 3, y: 0, z: 3 }, { x: 3, y: 0, z: 3 }]
  assert.deepEqual(headingAt(world, 1), { x: 0, z: 1 })
})

test('computeArchSpecs: point-to-point yields two independent gates', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 10, y: 0, z: 2 }]
  const specs = computeArchSpecs(world, false)
  assert.equal(specs.length, 2)
  assert.equal(specs[0].kind, 'start')
  assert.equal(specs[1].kind, 'finish')
  assert.equal(specs[0].pos, world[0])
  assert.equal(specs[1].pos, world[world.length - 1])
})

test('computeArchSpecs: a loop yields ONE gate carrying both directions', () => {
  const world = [{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 5 }, { x: 0, y: 0, z: 0.2 }]
  const specs = computeArchSpecs(world, true)
  assert.equal(specs.length, 1)
  assert.equal(specs[0].kind, 'loop')
  assert.ok(specs[0].outDir && specs[0].inDir)
})

test('computeArchSpecs is empty for a degenerate (<2 point) track', () => {
  assert.deepEqual(computeArchSpecs([{ x: 0, y: 0, z: 0 }], false), [])
  assert.deepEqual(computeArchSpecs(null, false), [])
})

test('perpOf rotates a heading 90 degrees (unit length preserved)', () => {
  const p = perpOf({ x: 1, z: 0 })
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.z - (-1)) < 1e-9)
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 1) < 1e-9)
})

test('primaryDir: a loop gate is oriented off the DEPARTURE heading (outDir), not the arrival one', () => {
  const spec = { kind: 'loop', pos: { x: 0, y: 0, z: 0 }, outDir: { x: 1, z: 0 }, inDir: { x: 0, z: 1 } }
  assert.deepEqual(primaryDir(spec), spec.outDir)
})

test('primaryDir: a point-to-point gate is oriented off its own single dir', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: -1 } }
  assert.deepEqual(primaryDir(spec), spec.dir)
})

// task 25 §2: "5x smaller" than the task-24 procedural gate — pins the
// relationship, not a magic number, so retuning the old gate's own
// constants would correctly retune this target too.
test('ARCH_TARGET_WIDTH is exactly one fifth of the old procedural gate straddle width', () => {
  assert.ok(Math.abs(ARCH_TARGET_WIDTH - OLD_ARCH_WIDTH / 5) < 1e-9)
  assert.ok(ARCH_TARGET_WIDTH > 0 && ARCH_TARGET_WIDTH < OLD_ARCH_WIDTH)
})

// task 25 §3: "derive it from the loaded bbox — do not hardcode a guess" —
// classifyArchSize is the pure decision of which local horizontal axis is
// the model's own width (wider) vs depth (thinner), from a measured size.
test('classifyArchSize picks X as width when X is the larger horizontal extent', () => {
  const info = classifyArchSize({ x: 1200, y: 600, z: 200 })
  assert.equal(info.widthIsX, true)
  assert.ok(Math.abs(info.worldWidth - ARCH_TARGET_WIDTH) < 1e-9)
  assert.ok(info.worldDepth < info.worldWidth)
})

test('classifyArchSize picks Z as width when Z is the larger horizontal extent', () => {
  const info = classifyArchSize({ x: 200, y: 600, z: 1200 })
  assert.equal(info.widthIsX, false)
  assert.ok(Math.abs(info.worldWidth - ARCH_TARGET_WIDTH) < 1e-9)
})

test('classifyArchSize scales height by the same factor as width (uniform scale, no stretching)', () => {
  const size = { x: 1200, y: 600, z: 200 }
  const info = classifyArchSize(size)
  const expectedHeight = size.y * (ARCH_TARGET_WIDTH / size.x)
  assert.ok(Math.abs(info.worldHeight - expectedHeight) < 1e-9)
})

test('classifyArchSize degrades to scale 1 rather than dividing by ~zero on a degenerate size', () => {
  const info = classifyArchSize({ x: 0, y: 5, z: 0 })
  assert.equal(info.scale, 1)
})

// task 25 §3: the gate must straddle the track (feet either side of the
// track point) and stay perpendicular to the direction of travel. Uses
// kind:'finish' — the one kind archFeet does NOT 180°-flip (see its own
// comment) — so postA/postB line up with the plain perpOf(dir) formula;
// the flip itself is covered separately below.
test('archTransform: the two feet straddle spec.pos symmetrically along perp(dir)', () => {
  const spec = { kind: 'finish', pos: { x: 10, y: 0, z: 20 }, dir: { x: 1, z: 0 } }
  const proto = { widthIsX: true, worldWidth: 2, worldHeight: 1, worldDepth: 0.3 }
  const { postA, postB } = archTransform(spec, 0, 0, proto)
  // perpOf({x:1,z:0}) = {x:0, z:-1}
  assert.ok(Math.abs(postA.x - 10) < 1e-9 && Math.abs(postA.z - 19) < 1e-9)
  assert.ok(Math.abs(postB.x - 10) < 1e-9 && Math.abs(postB.z - 21) < 1e-9)
})

test('archTransform: gate position sits at the AVERAGE of the two ground samples (not either one alone)', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 1, z: 0 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { position } = archTransform(spec, 2, 6, proto)
  assert.ok(Math.abs(position.y - 4) < 1e-9)
})

test('archTransform: level ground (equal foot heights) yields zero roll', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: 1 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { quaternion } = archTransform(spec, 3, 3, proto)
  // pure yaw, no roll: the local width axis (local +X, since widthIsX) should
  // map onto world perp(dir) = perpOf({x:0,z:1}) = {x:1, z:0} with no y component
  const v = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  assert.ok(Math.abs(v.y) < 1e-9)
  assert.ok(Math.abs(v.x - 1) < 1e-6 && Math.abs(v.z) < 1e-6)
})

test('archTransform: uneven feet produce a nonzero roll banking toward the lower foot', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: 1 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const level = archTransform(spec, 0, 0, proto)
  const tilted = archTransform(spec, 0, 1, proto)
  const vLevel = new Vector3(1, 0, 0).applyQuaternion(level.quaternion)
  const vTilted = new Vector3(1, 0, 0).applyQuaternion(tilted.quaternion)
  assert.ok(Math.abs(vLevel.y) < 1e-9)
  assert.ok(Math.abs(vTilted.y) > 1e-6) // the width axis is no longer perfectly horizontal
})

// Regression test for a real bug caught during task 25's own verification:
// makeBasis(xAxis, yAxis, zAxis) silently builds a REFLECTION (determinant
// -1), not a rotation, unless xAxis × yAxis === zAxis exactly. The
// widthIsX=false branch (the ACTUAL shipped arch.glb's own case — see the
// task report) got this wrong; THREE.Quaternion.setFromRotationMatrix does
// not throw on a reflection, it just returns a non-unit, meaningless
// quaternion — which then LOOKED plausible in a live render (a near-degenerate
// quaternion can still be close to identity) until checked rigorously. Every
// quaternion archTransform returns must be a genuine unit rotation, for
// BOTH widthIsX branches, at an arbitrary (non-axis-aligned) heading.
test('archTransform returns a unit (proper-rotation) quaternion for widthIsX=true', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { quaternion } = archTransform(spec, 0.1, -0.2, proto)
  assert.ok(Math.abs(quaternion.length() - 1) < 1e-6)
})

test('archTransform returns a unit (proper-rotation) quaternion for widthIsX=false', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: false, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { quaternion } = archTransform(spec, 0.1, -0.2, proto)
  assert.ok(Math.abs(quaternion.length() - 1) < 1e-6)
})

// Beyond "unit length", the rotation must actually DO what the module doc
// comment promises: proto's own width axis (local X when widthIsX, else
// local Z) lands on world perp(dir), and its depth axis (the other one)
// lands on world dir — for BOTH branches, not just the one the old tests
// above happened to exercise.
test('archTransform (widthIsX=true): local +X (width) maps onto world perp(dir)', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { quaternion } = archTransform(spec, 0, 0, proto)
  const v = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  const perp = perpOf(spec.dir)
  assert.ok(Math.abs(v.x - perp.x) < 1e-6 && Math.abs(v.y) < 1e-6 && Math.abs(v.z - perp.z) < 1e-6)
})

// widthIsX=false pairs local X (depth) with N, which forces local Z (width)
// onto -perp(dir), not +perp(dir) — proper-rotation handedness (N × up ===
// -U always, see archTransform's own comment) leaves no other choice. Not
// a bug: postA/postB (below) are built from that SAME -perp direction, so
// "which physical foot is postA" just swaps with "which physical foot is
// postB" for this branch — harmless, since the two feet are otherwise
// interchangeable.
test('archTransform (widthIsX=false): local +Z (width) maps onto world -perp(dir)', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: false, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { quaternion } = archTransform(spec, 0, 0, proto)
  const v = new Vector3(0, 0, 1).applyQuaternion(quaternion)
  const perp = perpOf(spec.dir)
  assert.ok(Math.abs(v.x + perp.x) < 1e-6 && Math.abs(v.y) < 1e-6 && Math.abs(v.z + perp.z) < 1e-6)
})

test('archTransform (widthIsX=false): postA/postB stay consistent with the actual rotated width axis', () => {
  const spec = { kind: 'start', pos: { x: 5, y: 0, z: -3 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: false, worldWidth: 2, worldHeight: 1, worldDepth: 0.2 }
  const { postA, postB, quaternion } = archTransform(spec, 0, 0, proto)
  const v = new Vector3(0, 0, 1).applyQuaternion(quaternion) // the actual world width direction
  const half = proto.worldWidth / 2
  assert.ok(Math.abs(postA.x - (spec.pos.x + v.x * half)) < 1e-6)
  assert.ok(Math.abs(postA.z - (spec.pos.z + v.z * half)) < 1e-6)
  assert.ok(Math.abs(postB.x - (spec.pos.x - v.x * half)) < 1e-6)
  assert.ok(Math.abs(postB.z - (spec.pos.z - v.z * half)) < 1e-6)
})

// task 25 §5: which physical face reads which baked word is fixed by the
// GLB (verified live: "Text_2" always reads FINISH from -N, "Text" always
// reads START from -N — see buildArchMesh's own comment). A 'start' or
// 'loop' gate must therefore face 180° opposite of a 'finish' gate built
// from the SAME numeric dir, or the wrong word ends up facing the runner
// at one of the two ends (the exact bug this task caught and fixed).
test('archTransform: a start gate faces 180° opposite of a finish gate given the identical dir', () => {
  const dir = { x: 0.6, z: 0.8 }
  const proto = { widthIsX: false, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const start = archTransform({ kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir }, 0, 0, proto)
  const finish = archTransform({ kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir }, 0, 0, proto)
  // local +X is the depth/forward axis for widthIsX=false (see archFeet) —
  // it should point in exactly opposite world directions for the two kinds
  const vStart = new Vector3(1, 0, 0).applyQuaternion(start.quaternion)
  const vFinish = new Vector3(1, 0, 0).applyQuaternion(finish.quaternion)
  assert.ok(Math.abs(vStart.x + vFinish.x) < 1e-6 && Math.abs(vStart.z + vFinish.z) < 1e-6)
})

test('archTransform: a loop gate (outDir) faces the same way a start gate with dir=outDir would', () => {
  const outDir = { x: 0.6, z: 0.8 }
  const proto = { widthIsX: false, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const loop = archTransform({ kind: 'loop', pos: { x: 0, y: 0, z: 0 }, outDir, inDir: { x: -1, z: 0 } }, 0, 0, proto)
  const start = archTransform({ kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: outDir }, 0, 0, proto)
  const vLoop = new Vector3(1, 0, 0).applyQuaternion(loop.quaternion)
  const vStart = new Vector3(1, 0, 0).applyQuaternion(start.quaternion)
  assert.ok(Math.abs(vLoop.x - vStart.x) < 1e-6 && Math.abs(vLoop.z - vStart.z) < 1e-6)
})

// task 25 §4: "a black arch with black text is useless" — textInkFor must
// pick the OPPOSITE end of the lightness scale from whatever colour it's
// handed, never the same one.
test('textInkFor picks light ink for a dark arch colour', () => {
  assert.equal(textInkFor('#111111'), '#f5f6f7')
})

test('textInkFor picks dark ink for a light arch colour', () => {
  assert.equal(textInkFor('#f0f0f0'), '#17191b')
})
