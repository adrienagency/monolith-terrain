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
//
// Task 24 rebuild: the old arch (POST_THICK 0.14 against a 2.6-tall post —
// an 18.6:1 height:width sliver) read as "deux bâtons" with text floating
// between them, not a gate. The user's own reference photo + literal ask —
// "deux pylônes de 400x100px et une traverse de 600x100px" — gives a real
// truss gantry's proportions: a shared 100px module sizes BOTH the pylon's
// own width and the beam's own thickness (both "100" in the reference),
// while the pylon reads 400:100 = 4:1 (height:width) and the beam 600:100 =
// 6:1 (length:thickness). ARCH_UNIT below IS that module — every other
// constant is derived from it so the ratios stay exact by construction
// rather than by eyeballing four independent numbers:
//   pylon width  (ARCH_POST_THICK)          = 1 × unit
//   pylon height (ARCH_HEIGHT)              = 4 × unit   (the 4:1 ratio)
//   beam thickness (ARCH_BEAM_THICK)        = 1 × unit   (same module as the pylon's width)
//   beam length = span + one post thickness = 6 × unit   (the 6:1 ratio) →
//     solving for the span that makes that true: span = 5 × unit
export const ARCH_UNIT = 0.5 // the shared "100px" module — tune ONE number to rescale the whole gate
export const ARCH_POST_THICK = ARCH_UNIT // pylon width — "100"
export const ARCH_HEIGHT = ARCH_UNIT * 4 // pylon height — "400" (4:1 height:width per pylon)
export const ARCH_BEAM_THICK = ARCH_UNIT // beam thickness — the OTHER "100"
export const ARCH_SPAN = ARCH_UNIT * 5 // clear width a runner passes through — chosen so beamLen (span + one post thickness) lands exactly on 6×unit below
export const ARCH_BANNER_GAP = 0.03 // banner plane floats this far in FRONT of the beam's face (avoids z-fighting; reads as flush-mounted, not floating)

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

  // banner plane(s) — one per face, MOUNTED ON THE BEAM (task 24): "une
  // traverse... avec marqué start/finish", "comme le panneau de la photo" —
  // a flat wordmark carried BY the crossbar, not floating text between two
  // posts. So this is now sized from the SPAN (wide, banner-shaped — close
  // to the beam's own length) rather than from the post height, and sits at
  // the beam's own Y, flush against its front face instead of dangling
  // below it. Oriented so its FRONT (the readable side) points back along
  // the direction the runner is arriving FROM, i.e. it faces the runner as
  // they approach the gate.
  const beamHalf = beamLen / 2
  faces.forEach((f, i) => {
    const { tex, aspect } = makeLabel(f.text)
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide, depthWrite: false })
    // width-driven: read close to the beam's own length (a banner spanning
    // the gate), height follows the label texture's own aspect — capped so
    // a very short word (e.g. a 2-letter placeholder) can't blow up taller
    // than the beam can sensibly carry.
    const bannerW = Math.min(ARCH_SPAN * 0.86, beamHalf * 1.72)
    const bannerH = Math.min(bannerW / aspect, ARCH_BEAM_THICK * 3.2)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), mat)
    // flush-mounted on the beam's FRONT face: offset along the face normal
    // (-dir, same axis the rotation below points it) by half the beam's own
    // thickness plus a hairline gap — reads as attached to the crossbar,
    // never floating clear of it. A tiny extra offset along perp(dir) (the
    // beam's own length axis) keeps two coincident loop faces (same pos,
    // near-identical dir) from z-fighting each other.
    const nx = -f.dir.x
    const nz = -f.dir.z
    const faceOff = ARCH_BEAM_THICK / 2 + ARCH_BANNER_GAP
    const p = perpOf(f.dir)
    const sideEps = (i === 0 ? 1 : -1) * 0.02
    mesh.position.set(
      spec.pos.x + nx * faceOff + p.x * sideEps,
      beamY,
      spec.pos.z + nz * faceOff + p.z * sideEps
    )
    // face AGAINST the arrival direction (normal = -dir) — a plane's default
    // normal is +Z, so yaw it to point -dir
    mesh.rotation.y = Math.atan2(-f.dir.x, -f.dir.z)
    mesh.renderOrder = renderOrder + 1
    group.add(mesh)
  })

  return group
}
