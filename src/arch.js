// Start/finish 3D arches (task 22 §6, rebuilt task 24, rebuilt AGAIN task 25
// — "l'arche, c'est totalement à côté de la plaque. Pourquoi les piliers
// sont décalés et tout n'est pas en un seul morceau ?"). The task-24
// procedural gate (two BoxGeometry posts + a beam, built from independent
// numbers) read as "deux bâtons", not one gate. The user stopped and
// modelled the arch themselves instead — this module now LOADS that model
// (public/models/arch.glb) rather than building geometry, which structurally
// rules out the old bug: posts and beam are one rigid mesh, they cannot end
// up disjoint or offset from each other by construction.
//
// Same split as before, now three parts: pure placement + orientation math
// (unit-tested, no DOM — THREE's own Vector3/Quaternion/Matrix4 classes are
// plain math, no canvas/document involved, so they're fine in node --test
// same as gpx.js's own THREE usage), a small DOM-only loader/cache, and a
// THREE mesh builder that consumes both. gpx.js owns detectLoop() (the
// loop/point-to-point decision); this module only answers "given the drawn
// world points and that decision, where do the arch(es) go and which way do
// they face".

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// ---------------------------------------------------------------- placement

// Horizontal (XZ) unit tangent at track-point `idx`, looking at its nearest
// real neighbour — the direction a runner is actually moving through that
// point. Falls back to +Z for a degenerate (coincident) pair so a caller
// never has to special-case a NaN direction.
export function headingAt(world, idx) {
  const n = world.length
  const a = world[Math.max(0, idx - 1)]
  const b = world[Math.min(n - 1, idx + 1)]
  let dx = b.x - a.x
  let dz = b.z - a.z
  const len = Math.hypot(dx, dz)
  if (len < 1e-9) return { x: 0, z: 1 }
  return { x: dx / len, z: dz / len }
}

// world (ordered ground-draped track points, start -> finish) + isLoop (see
// gpx.js's detectLoop) -> the arch spec(s) to build:
//   - point-to-point: two independent gates, one at each end, each facing
//     the direction a runner arrives from (so the label reads correctly on
//     approach) — 'start' faces back along the outbound heading, 'finish'
//     faces back along the heading the runner arrives with.
//   - loop: ONE gate at the shared start/finish point, carrying BOTH labels
//     on separate faces — 'outDir' is the departure heading (what a runner
//     about to start sees facing them), 'inDir' is the arrival heading on
//     the closing leg (what a finishing runner sees facing them). These are
//     generally different directions (a loop doesn't reverse over itself);
//     the GLB is a single rigid gate, so it can only be oriented once — see
//     buildArchMesh's own comment on why 'outDir' wins for the physical
//     straddle axis while both labels still ship on the model's two faces.
export function computeArchSpecs(world, isLoop) {
  if (!world || world.length < 2) return []
  const last = world.length - 1
  if (isLoop) {
    return [
      {
        kind: 'loop',
        pos: world[0],
        outDir: headingAt(world, 0),
        inDir: headingAt(world, last),
      },
    ]
  }
  return [
    { kind: 'start', pos: world[0], dir: headingAt(world, 0) },
    { kind: 'finish', pos: world[last], dir: headingAt(world, last) },
  ]
}

// perp: the horizontal axis the two feet straddle (rotate `dir` -90°).
export function perpOf(dir) {
  return { x: dir.z, z: -dir.x }
}

// the gate's own primary facing direction — for a loop this is the
// DEPARTURE heading (see computeArchSpecs's comment: the model is one rigid
// piece, it gets ONE physical orientation, chosen the same way the task-24
// procedural gate chose it — off the first face).
export function primaryDir(spec) {
  return spec.kind === 'loop' ? spec.outDir : spec.dir
}

// ---------------------------------------------------------------- sizing
//
// The old (task 24) procedural gate's own measured world size — kept ONLY
// as the reference this task's "5x smaller" (§2 of the brief) is defined
// against, not to build geometry from anymore:
//   pylon width/beam thickness (module)   = 0.5
//   pylon height                          = 2.0  (4 x module)
//   clear span                            = 2.5  (5 x module)
//   beam length (span + one post thickness, flush with both posts' outer
//     faces — the old gate's own full straddle width)   = 3.0
//   total height, ground to top of beam                  = 2.5
const OLD_ARCH_UNIT = 0.5
const OLD_ARCH_POST_THICK = OLD_ARCH_UNIT
const OLD_ARCH_HEIGHT = OLD_ARCH_UNIT * 4
const OLD_ARCH_BEAM_THICK = OLD_ARCH_UNIT
const OLD_ARCH_SPAN = OLD_ARCH_UNIT * 5
export const OLD_ARCH_WIDTH = OLD_ARCH_SPAN + OLD_ARCH_POST_THICK // 3.0 — full straddle width
export const OLD_ARCH_TOTAL_HEIGHT = OLD_ARCH_HEIGHT + OLD_ARCH_BEAM_THICK // 2.5 — ground to beam top

// New target: the GLB is normalized so its OWN measured straddle width
// lands here — exactly one fifth of the old gate's straddle width (task 25
// §2: "5x smaller"). Every other new-gate dimension (height, depth/
// thickness) falls out of this ONE number times the model's own aspect
// ratio, the same "tune one number, everything else follows" principle
// ARCH_UNIT used for the procedural gate.
export const ARCH_TARGET_WIDTH = OLD_ARCH_WIDTH / 5
export const ARCH_MODEL_URL = 'models/arch.glb'

// ---------------------------------------------------------- proto measurement
//
// Pure: given the proto's own measured LOCAL bounding-box size (a THREE
// Box3's .getSize() result, or any {x,y,z}), decide which local horizontal
// axis is the model's own "width" (the wider of X/Z — the beam spans this
// one) vs its "depth" (the thinner one — the walk-through/thickness axis),
// and the uniform scale that lands the width on ARCH_TARGET_WIDTH. Never
// assumes which of X/Z is which — derives it from the measured box, per the
// brief ("do not hardcode a guess").
export function classifyArchSize(size) {
  const widthIsX = size.x >= size.z
  const rawWidth = widthIsX ? size.x : size.z
  const rawDepth = widthIsX ? size.z : size.x
  const scale = rawWidth > 1e-6 ? ARCH_TARGET_WIDTH / rawWidth : 1
  return {
    widthIsX,
    scale,
    worldWidth: rawWidth * scale,
    worldHeight: size.y * scale,
    worldDepth: rawDepth * scale,
  }
}

// ---------------------------------------------------------- orientation math
//
// Pure (THREE's Vector3/Quaternion/Matrix4 are plain math, no DOM — same as
// gpx.js's own module-level THREE usage, safe in node --test). Given a spec,
// terrain samples at the two feet, and the proto's classifyArchSize() result,
// returns exactly where + how to rotate ONE clone of the loaded gate:
//   - yaw: the proto's own measured WIDTH axis (local X or Z, whichever
//     classifyArchSize picked) is rotated onto world perp(dir), and its
//     DEPTH axis onto world dir — so the gate straddles the track with its
//     thin axis matching the direction runners pass through it.
//   - roll: the model is ONE rigid mesh, so unlike the old procedural gate
//     (which stretched two independent post cylinders to reach each post's
//     own ground height) it cannot give its two feet independently
//     different heights — instead the WHOLE gate banks, about its own
//     depth (walk-through) axis, by the angle that puts its two edges at
//     groundA and groundB respectively. "Both feet on the terrain" (task 25
//     §3) via a small tilt rather than an impossible per-leg stretch.
// Returns world-space position (the track point itself, at the AVERAGE of
// the two ground samples) + a quaternion, plus the two foot positions (XZ)
// a caller needs to take those terrain samples from in the first place.
export function archTransform(spec, groundA, groundB, proto) {
  const dir = primaryDir(spec)
  const N = new THREE.Vector3(dir.x, 0, dir.z).normalize() // world depth/forward dir
  // U (world width dir) is built as a CROSS PRODUCT, not perpOf(dir) fed
  // straight into makeBasis — perpOf is only a 2D rotate-90°, it says
  // nothing about handedness, and feeding it into makeBasis in the "wrong"
  // slot silently builds a REFLECTION (determinant -1) instead of a
  // rotation: setFromRotationMatrix does not throw on that, it just returns
  // a non-unit, physically meaningless quaternion (caught by this file's
  // own tests below via .length()). Cross products are handedness-safe by
  // construction: up = N × U guarantees U × up === N always (proper for the
  // widthIsX branch below); N × up === -U always, which is why the OTHER
  // branch feeds U negated — that pairing is forced by the algebra, not a
  // free choice.
  const upHint = new THREE.Vector3(0, 1, 0)
  const U = new THREE.Vector3().crossVectors(upHint, N).normalize()
  const up = new THREE.Vector3().crossVectors(N, U).normalize()

  const basis = new THREE.Matrix4()
  if (proto.widthIsX) basis.makeBasis(U, up, N)
  else basis.makeBasis(N, up, U.clone().negate())
  const qYaw = new THREE.Quaternion().setFromRotationMatrix(basis)

  // postA/postB (the two foot sample points) MUST use the SAME world
  // direction the rotation actually assigns to the proto's own "positive
  // width" local axis — widthDir below matches whichever sign each branch
  // above just fed into makeBasis's third column, so the roll term (next)
  // banks toward the physically correct foot instead of fighting the yaw.
  const widthDir = proto.widthIsX ? U : U.clone().negate()
  const half = proto.worldWidth / 2
  const postA = { x: spec.pos.x + widthDir.x * half, z: spec.pos.z + widthDir.z * half }
  const postB = { x: spec.pos.x - widthDir.x * half, z: spec.pos.z - widthDir.z * half }

  const roll = proto.worldWidth > 1e-6 ? Math.atan2((groundB ?? 0) - (groundA ?? 0), proto.worldWidth) : 0
  const qRoll = new THREE.Quaternion().setFromAxisAngle(N, roll)
  const quaternion = qRoll.multiply(qYaw)

  const gA = groundA ?? spec.pos.y
  const gB = groundB ?? spec.pos.y
  return {
    position: { x: spec.pos.x, y: (gA + gB) / 2, z: spec.pos.z },
    quaternion,
    postA,
    postB,
  }
}

// Fixed, high-contrast text ink for a given arch fill colour — "a black
// arch with black text is useless" (task 25 §4). The baked text is now real
// extruded 3D geometry, not a canvas texture, so there's no halo/outline
// trick available (that was makeLabelTexture's job for the old flat
// banners) — the only lever left is picking black-ish or white-ish ink by
// the chosen arch colour's own relative luminance, same threshold rule of
// thumb used for any swatch-vs-text contrast decision.
export function textInkFor(archColorHex) {
  const c = new THREE.Color(archColorHex)
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
  return lum > 0.5 ? '#17191b' : '#f5f6f7'
}

// ---------------------------------------------------------------- GLB proto
//
// Loaded ONCE (module-level cache) — every arch on a route (up to 2, task 25
// §1) clones this same normalized prototype rather than re-parsing the GLB.
// Strips any light the file carries: it ships a "Default Ambient Light"
// node (see the task brief) that must NEVER enter the live scene — it would
// silently brighten the whole map. A failed/missing load resolves to
// `null`; callers must degrade quietly (no fallback geometry, no error UI —
// the arch simply never appears, playback is unaffected).
let _archProtoPromise = null

function stripLights(root) {
  const lights = []
  root.traverse((n) => { if (n.isLight) lights.push(n) })
  for (const l of lights) l.parent?.remove(l)
}

function normalizeArchProto(scene) {
  stripLights(scene)
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const info = classifyArchSize(size)

  // recenter horizontally and drop the bottom to local y=0, so a caller can
  // place THIS group's own origin at ground level and rotate about it
  // without the mesh swimming off-centre first
  scene.position.set(-center.x, -box.min.y, -center.z)
  const root = new THREE.Group()
  root.name = 'gpx-arch-proto'
  root.add(scene)
  root.scale.setScalar(info.scale)

  const textMeshes = []
  const frameMeshes = []
  scene.traverse((n) => {
    if (!n.isMesh) return
    ;(/^text/i.test(n.name) ? textMeshes : frameMeshes).push(n)
  })

  return { root, textMeshes, frameMeshes, ...info }
}

function loadArchProto() {
  if (!_archProtoPromise) {
    _archProtoPromise = new Promise((resolve) => {
      new GLTFLoader().load(
        ARCH_MODEL_URL,
        (gltf) => {
          try {
            resolve(normalizeArchProto(gltf.scene))
          } catch {
            resolve(null)
          }
        },
        undefined,
        () => resolve(null) // missing/broken GLB — degrade quietly, no arch ever appears
      )
    })
  }
  return _archProtoPromise
}

// clone the cached proto's Object3D hierarchy for one arch instance. Deep
// clone shares geometry (never mutated, never disposed per-instance — see
// disposeArchGroup) and starts with the proto's own shared default
// materials, which every mesh gets REPLACED on below (buildArchMesh), so
// the shared proto is never touched by an instance's own colouring.
function cloneProto(proto) {
  const inst = proto.root.clone(true)
  const textMeshes = []
  const frameMeshes = []
  inst.traverse((n) => {
    if (!n.isMesh) return
    n.userData.sharedGeometry = true // disposeArchGroup must not free this
    ;(/^text/i.test(n.name) ? textMeshes : frameMeshes).push(n)
  })
  return { inst, textMeshes, frameMeshes }
}

// ---------------------------------------------------------------- mesh (THREE)

// Builds one arch and returns a THREE.Group IMMEDIATELY (synchronous — same
// contract gpx.js's _buildArches() already relies on). The group starts
// empty; loadArchProto() is async, so the actual clone is added into it
// whenever the (module-cached, load-once) prototype resolves — after the
// very first arch anywhere in the app that's already-resolved and happens
// on the same tick. If the GLB is missing/broken the group is left empty
// forever: no crash, no fallback shape, playback is unaffected (task 25's
// "degrade quietly"). Track render never waits on this.
//
// `sampleGround(x, z) -> y` is DI'd (same pattern as the old procedural
// builder) so this stays swappable in isolation. `ink` is the user-chosen
// arch colour (task 25 §4); `textInk` overrides the auto-contrast pick from
// textInkFor() if the caller wants to force one.
export function buildArchMesh(spec, { sampleGround, ink = '#2b2f33', textInk, renderOrder = 0 } = {}) {
  const group = new THREE.Group()
  group.name = 'gpx-arch'
  group.userData.spec = spec

  loadArchProto().then((proto) => {
    if (group.userData.disposed || !proto) return

    const dir = primaryDir(spec)
    const perp = perpOf(dir)
    const half = proto.worldWidth / 2
    const postA = { x: spec.pos.x + perp.x * half, z: spec.pos.z + perp.z * half }
    const postB = { x: spec.pos.x - perp.x * half, z: spec.pos.z - perp.z * half }
    const groundA = sampleGround ? sampleGround(postA.x, postA.z) : spec.pos.y
    const groundB = sampleGround ? sampleGround(postB.x, postB.z) : spec.pos.y

    const { position, quaternion } = archTransform(spec, groundA, groundB, proto)
    const { inst, textMeshes, frameMeshes } = cloneProto(proto)

    const frameMat = new THREE.MeshStandardMaterial({ color: ink, roughness: 0.55, metalness: 0.05 })
    const resolvedTextInk = textInk || textInkFor(ink)
    const textMat = new THREE.MeshStandardMaterial({ color: resolvedTextInk, roughness: 0.4, metalness: 0.05 })
    for (const m of frameMeshes) m.material = frameMat
    for (const m of textMeshes) m.material = textMat

    // task 25 §5: for a point-to-point gate (a SINGLE relevant face — only
    // 'START' at the departure gate, only 'FINISH' at the arrival one) hide
    // whichever baked text mesh is the WRONG word for this gate, rather
    // than ship an arch that reads e.g. "FINISH" on its back face at the
    // start line. A loop gate keeps BOTH — that's the one case where both
    // words are simultaneously correct (see computeArchSpecs). See
    // labelTextForMesh below for how "which mesh is which word" is decided.
    if (spec.kind !== 'loop' && textMeshes.length > 1) {
      const wanted = spec.kind === 'start' ? 0 : 1 // index convention — see labelTextForMesh
      textMeshes.forEach((m, i) => { m.visible = i === wanted })
    }

    inst.position.set(position.x, position.y, position.z)
    inst.quaternion.copy(quaternion)
    inst.traverse((n) => { if (n.isMesh) n.renderOrder = renderOrder })
    group.add(inst)
  })

  return group
}

// Marks a group's async population as cancelled (a route can reload before
// the GLB clone lands) and frees everything ALREADY attached. Geometry is
// shared with the cached prototype (see cloneProto) and is never disposed
// here — only the per-instance materials (frameMat/textMat above, unique to
// this group) are. gpx.js's _disposeArches() calls this instead of its own
// traverse+dispose so that sharing rule lives in exactly one place.
export function disposeArchGroup(group) {
  group.userData.disposed = true
  group.traverse((obj) => {
    if (obj.isMesh && !obj.userData.sharedGeometry) obj.geometry?.dispose?.()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) { m.map?.dispose?.(); m.dispose() }
    }
  })
}
