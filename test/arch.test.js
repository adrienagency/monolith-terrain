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
// track point) and stay perpendicular to the direction of travel.
test('archTransform: the two feet straddle spec.pos symmetrically along perp(dir)', () => {
  const spec = { kind: 'start', pos: { x: 10, y: 0, z: 20 }, dir: { x: 1, z: 0 } }
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
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: 1 } }
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

// task 25 §4: "a black arch with black text is useless" — textInkFor must
// pick the OPPOSITE end of the lightness scale from whatever colour it's
// handed, never the same one.
test('textInkFor picks light ink for a dark arch colour', () => {
  assert.equal(textInkFor('#111111'), '#f5f6f7')
})

test('textInkFor picks dark ink for a light arch colour', () => {
  assert.equal(textInkFor('#f0f0f0'), '#17191b')
})
