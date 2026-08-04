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

// Task 3 relecture (2026-08-04) : verifie ce que le rendu REEL ferait des deux
// pieds — pas juste l'angle du quaternion — a partir des SEULES valeurs
// publiques que renvoie archTransform (position, quaternion) + le proto
// utilise. C'est exactement la geometrie que buildArchMesh applique a
// l'instance clonee (voir archFeet : le pied A est toujours au niveau du
// vertex local (demi-largeur, 0, 0) si widthIsX, sinon (0, 0, demi-largeur)),
// donc une boite noire fidele au rendu plutot qu'un recalcul independant qui
// pourrait diverger de l'implementation sans que le test s'en apercoive.
function piedsRendus(position, quaternion, proto) {
  const demi = proto.worldWidth / 2
  const local = proto.widthIsX ? new Vector3(demi, 0, 0) : new Vector3(0, 0, demi)
  const offset = local.clone().applyQuaternion(quaternion)
  return { A: position.y + offset.y, B: position.y - offset.y }
}

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

// Task 3 relecture : l'ancien exemple (groundA=2, groundB=6, worldWidth=1)
// demandait un denivele de 4 unites a une porte large de 1 seule — DEJA hors
// de portee d'une inclinaison pure (voir plus bas, "au-dela de portee"), donc
// la moyenne n'y est plus la bonne reponse depuis le correctif "jamais
// enterrer un pied". Repris avec un denivele ATTEIGNABLE (0,6 sur une largeur
// de 1) : la ou une inclinaison peut poser les deux pieds pile sur leur sol,
// le centre retombe EXACTEMENT sur la moyenne, comme avant.
test('archTransform: gate position sits at the AVERAGE of the two ground samples when the slope is within reach', () => {
  const spec = { kind: 'start', pos: { x: 0, y: 0, z: 0 }, dir: { x: 1, z: 0 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const { position } = archTransform(spec, 2, 2.6, proto)
  assert.ok(Math.abs(position.y - 2.3) < 1e-9)
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

// Task 3, relecture (2026-08-04). Premiere version de ce correctif : butee
// fixe de 30° sur l'ANGLE de roll, sans jamais verifier son effet sur la
// POSITION reelle des pieds. Demontage par la relecture, chiffres a l'appui
// (sur le cas de reference ci-dessous, worldWidth=0,6, denivele=0,871) :
// borner l'angle a 30° reduit le roll (bien) mais laisse `position.y` a
// l'ancienne moyenne NON corrigee — l'ecart pied/sol calcule PASSAIT de
// ~0,19 a ~0,29 (+50 %) avec la butee, parce que rien ne relevait le centre
// pour compenser un roll desormais insuffisant. Et le vrai probleme n'etait
// pas seulement "l'angle est trop grand" : `atan2(denivele, largeur)` n'est
// de toute facon PAS la bonne formule (elle ne pose exactement les deux
// pieds au sol dans AUCUN cas, meme sur une pente douce — voir le test
// "AVERAGE" plus haut, qui ne tombait juste pas sur ce defaut par hasard) ;
// et rien ne decidait ce qui doit arriver quand le denivele DEPASSE la
// largeur de la porte (0,871 > 0,6 ici) — aucune inclinaison pure ne peut
// alors poser les deux pieds (asin d'un rapport superieur a 1 est indefini),
// et l'ancien code laissait ce cas au hasard (un pied pouvait finir enterre
// dans le relief).
//
// Le correctif refait le calcul en entier :
//   1. roll = asin(clamp((gA-gB) / largeur, -1, 1)) — la VRAIE geometrie
//      (pas une approximation) : quand c'est ATTEIGNABLE, les deux pieds
//      tombent PILE sur leur sol (zero residu). Le clamp a ±1 n'est pas un
//      choix arbitraire : au-dela, aucune inclinaison ne fait mieux que 90°
//      (incliner davantage REDUIRAIT le denivele rattrape, ce serait pire).
//   2. `position.y` n'est plus TOUJOURS la moyenne : JAMAIS enterrer un pied
//      (une porte qui mord la roche est aussi fausse qu'une porte qui vole,
//      relecture task 3) — si le denivele depasse ce que l'inclinaison peut
//      rattraper, le centre se souleve juste assez pour que les DEUX pieds
//      restent au-dessus de leur sol ; un seul flotte alors, du minimum
//      necessaire (denivele - largeur), jamais plus.
//
// Ces trois tests couvrent : le cas ATTEIGNABLE (zero residu, mieux que
// l'ancienne formule), le cas HORS DE PORTEE mesure en vrai (aucun pied
// enterre, le flottement mesure au plus juste), et la preuve que 90° n'est
// pas une valeur choisie mais la limite mathematique de sin().

test('archTransform: on a slope WITHIN reach, both feet land EXACTLY on their own ground sample (zero residual)', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: 1 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  // denivele 0,6 pour une largeur de 1 : atteignable (0,6 <= 1)
  const groundA = 2, groundB = 2.6
  const r = archTransform(spec, groundA, groundB, proto)
  const { A, B } = piedsRendus(r.position, r.quaternion, proto)
  assert.ok(Math.abs(A - groundA) < 1e-9, `pied A a ${A}, sol reel ${groundA}`)
  assert.ok(Math.abs(B - groundB) < 1e-9, `pied B a ${B}, sol reel ${groundB}`)
})

test('archTransform: the SAME within-reach check holds for widthIsX=false (the branch the shipped GLB actually uses)', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.6, z: 0.8 } }
  const proto = { widthIsX: false, worldWidth: 0.8, worldHeight: 1, worldDepth: 0.2 }
  const groundA = -1.1, groundB = -0.7 // denivele 0,4 <= largeur 0,8
  const r = archTransform(spec, groundA, groundB, proto)
  const { A, B } = piedsRendus(r.position, r.quaternion, proto)
  assert.ok(Math.abs(A - groundA) < 1e-9, `pied A a ${A}, sol reel ${groundA}`)
  assert.ok(Math.abs(B - groundB) < 1e-9, `pied B a ${B}, sol reel ${groundB}`)
})

// Cas de reference MESURE EN VRAI dans l'app (task-3-report.md) sur l'arche
// d'arrivee de la Diagonale des Fous, zoom fin : deux pieds a 0,6 unite
// d'ecart (ARCH_TARGET_WIDTH), solA/solB mesures a -3,321/-2,45, soit un
// denivele reel de 0,871 — au-dela des 0,6 que la porte peut rattraper par
// inclinaison seule. Avant ce correctif, `atan2` rendait un roll mesure a
// 65,5° et `position.y` restait la moyenne non corrigee (aucun garde-fou sur
// l'enfoncement). Ici : AUCUN pied ne doit passer sous son sol, et le
// flottement du pied qui ne touche pas doit etre EXACTEMENT le denivele
// impossible a rattraper (0,871 - 0,6 = 0,271), ni plus ni moins.
test('archTransform: on the measured real cliff (0.871 over 0.6 of width), no foot is ever buried and the unavoidable hover is minimal', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.034, z: 0.999 } }
  const proto = { widthIsX: true, worldWidth: 0.6, worldHeight: 0.5, worldDepth: 0.1 }
  const groundA = -3.321, groundB = -2.45
  const r = archTransform(spec, groundA, groundB, proto)
  const { A, B } = piedsRendus(r.position, r.quaternion, proto)
  const EPS = 1e-6
  // jamais enterre : chaque pied rendu est AU MOINS a son sol reel
  assert.ok(A >= groundA - EPS, `pied A enterre : ${A} < sol ${groundA}`)
  assert.ok(B >= groundB - EPS, `pied B enterre : ${B} < sol ${groundB}`)
  // le flottement total (somme des deux ecarts) est le denivele impossible a
  // rattraper — pas plus : la porte ne s'envole pas, elle mord juste ce
  // qu'elle ne peut pas suivre.
  const flottementTotal = (A - groundA) + (B - groundB)
  const shortfall = Math.abs(groundB - groundA) - proto.worldWidth // 0.871 - 0.6 = 0.271
  assert.ok(Math.abs(flottementTotal - shortfall) < 1e-6, `flottement total ${flottementTotal}, attendu ${shortfall}`)
})

test('archTransform: the roll on that same real cliff saturates at exactly 90° — the mathematical limit of sin(), not a tuned constant', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0.034, z: 0.999 } }
  const proto = { widthIsX: true, worldWidth: 0.6, worldHeight: 0.5, worldDepth: 0.1 }
  const { quaternion } = archTransform(spec, -3.321, -2.45, proto)
  const v = new Vector3(1, 0, 0).applyQuaternion(quaternion)
  const rollFromVertical = Math.abs(Math.asin(Math.max(-1, Math.min(1, v.y))))
  assert.ok(Math.abs(rollFromVertical - Math.PI / 2) < 1e-6, `roll ${(rollFromVertical * 180 / Math.PI).toFixed(1)}°, attendu 90°`)
})

test('archTransform: a MODEST slope (well within reach) still banks toward the lower foot — the fix does not flatten normal terrain', () => {
  const spec = { kind: 'finish', pos: { x: 0, y: 0, z: 0 }, dir: { x: 0, z: 1 } }
  const proto = { widthIsX: true, worldWidth: 1, worldHeight: 1, worldDepth: 0.2 }
  const level = archTransform(spec, 0, 0, proto)
  const tilted = archTransform(spec, 0, 0.05, proto)
  const vLevel = new Vector3(1, 0, 0).applyQuaternion(level.quaternion)
  const vTilted = new Vector3(1, 0, 0).applyQuaternion(tilted.quaternion)
  assert.ok(Math.abs(vLevel.y) < 1e-9)
  assert.ok(Math.abs(vTilted.y) > 1e-6)
  // et sur cette pente modeste, toujours zero residu (le point precedent)
  const { A, B } = piedsRendus(tilted.position, tilted.quaternion, proto)
  assert.ok(Math.abs(A - 0) < 1e-9 && Math.abs(B - 0.05) < 1e-9)
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
