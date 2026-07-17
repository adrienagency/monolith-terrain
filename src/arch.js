// Start/finish 3D arches (task 22 §6) — "une petite arche en 3D rectangulaire
// avec marqué start du côté où part la course, et finish du côté où elle se
// termine. Si ce n'est pas une boucle, alors on a deux arches."
//
// Two parts, same split as everywhere else in this codebase: pure placement
// math (unit-tested, no THREE/DOM) below, then a THREE mesh builder that
// consumes it. gpx.js owns detectLoop() (the loop/point-to-point decision);
// this module only answers "given the drawn world points and that decision,
// where do the arch(es) go and which way do they face".

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
//     generally different directions (a loop doesn't reverse over itself),
//     which is exactly why the two faces are tracked independently instead
//     of assuming they're opposite sides of one flat sign.
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

// ---------------------------------------------------------------- sizing

// Fixed world-unit scale, same order of magnitude as gpx.js's own
// VILLAGE_LINE_HEIGHT (2.4 world units) — the existing "a real vertical mark
// at this app's terrain scale" reference — rather than a function of route
// length: the terrain patch itself (TERRAIN_SIZE) is what sets the visual
// scale a track drapes onto, not the route's real-world km, so a fixed span
// reads sensibly whether the loaded race is 5km or 220km.
export const ARCH_SPAN = 2.0 // clear width a runner passes through
export const ARCH_HEIGHT = 2.6 // post height above the ground
export const ARCH_POST_THICK = 0.14
export const ARCH_BEAM_THICK = 0.18
export const ARCH_LABEL_GAP = 0.22 // label plane floats this far below the beam's underside

// ---------------------------------------------------------------- mesh (THREE)

// perp: the horizontal axis the two posts straddle (rotate `dir` -90°) —
// exported alongside the pure functions above since callers building a mesh
// need the exact same perpendicular the placement math implies.
export function perpOf(dir) {
  return { x: dir.z, z: -dir.x }
}

// Builds one arch (rectangular gate: two posts + a beam) with 1 or 2 label
// faces, terrain-anchored (each post samples its own ground height, so a
// gate straddling a cross-slope doesn't float). `THREE` and `sampleGround`
// are injected (same DI pattern as GpxLayer's own getDem/terrain) so this
// stays swappable in isolation; `makeLabel(text) -> {tex, aspect}` is
// text-label.js's makeLabelTexture, injected rather than imported so this
// module doesn't have to agree with gpx.js on which label renderer to use.
export function buildArchMesh(spec, { THREE, sampleGround, makeLabel, ink = '#17191b', renderOrder = 0 }) {
  const group = new THREE.Group()
  group.name = 'gpx-arch'

  const faces =
    spec.kind === 'loop'
      ? [
          { text: 'START', dir: spec.outDir },
          { text: 'FINISH', dir: spec.inDir },
        ]
      : [{ text: spec.kind === 'start' ? 'START' : 'FINISH', dir: spec.dir }]

  // posts + beam are shared by every face at this position — built once off
  // the FIRST face's perpendicular (all faces share the same `pos`; the
  // gate itself doesn't rotate per-label, only the label planes do)
  const perp = perpOf(faces[0].dir)
  const half = ARCH_SPAN / 2
  const postA = { x: spec.pos.x + perp.x * half, z: spec.pos.z + perp.z * half }
  const postB = { x: spec.pos.x - perp.x * half, z: spec.pos.z - perp.z * half }
  const groundA = sampleGround ? sampleGround(postA.x, postA.z) : spec.pos.y
  const groundB = sampleGround ? sampleGround(postB.x, postB.z) : spec.pos.y
  const postMat = new THREE.MeshStandardMaterial({ color: ink, roughness: 0.55, metalness: 0.05 })

  const mkPost = (p, ground) => {
    const h = ARCH_HEIGHT
    const m = new THREE.Mesh(new THREE.BoxGeometry(ARCH_POST_THICK, h, ARCH_POST_THICK), postMat)
    m.position.set(p.x, ground + h / 2, p.z)
    m.renderOrder = renderOrder
    return m
  }
  const postMeshA = mkPost(postA, groundA)
  const postMeshB = mkPost(postB, groundB)
  group.add(postMeshA, postMeshB)

  const beamY = Math.max(groundA, groundB) + ARCH_HEIGHT
  const beamLen = Math.hypot(postA.x - postB.x, postA.z - postB.z) + ARCH_POST_THICK
  const beam = new THREE.Mesh(new THREE.BoxGeometry(beamLen, ARCH_BEAM_THICK, ARCH_BEAM_THICK), postMat)
  beam.position.set(spec.pos.x, beamY, spec.pos.z)
  beam.rotation.y = Math.atan2(postA.x - postB.x, postA.z - postB.z)
  beam.renderOrder = renderOrder
  group.add(beam)

  // label plane(s) — one per face, oriented so its FRONT (the side you read
  // text on) points back along the direction the runner is arriving FROM,
  // i.e. it faces the runner as they approach the gate. A tiny along-dir
  // epsilon offset keeps two coincident loop faces from z-fighting.
  const labelY = beamY - ARCH_LABEL_GAP
  faces.forEach((f, i) => {
    const { tex, aspect } = makeLabel(f.text)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide, depthWrite: false })
    const planeH = ARCH_HEIGHT * 0.4
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeH * aspect, planeH), mat)
    const eps = (i === 0 ? 1 : -1) * 0.03
    mesh.position.set(spec.pos.x + f.dir.x * eps, labelY, spec.pos.z + f.dir.z * eps)
    // face AGAINST the arrival direction (normal = -dir) — a plane's default
    // normal is +Z, so yaw it to point -dir
    mesh.rotation.y = Math.atan2(-f.dir.x, -f.dir.z)
    mesh.renderOrder = renderOrder + 1
    group.add(mesh)
  })

  return group
}
