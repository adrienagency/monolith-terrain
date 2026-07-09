// The relief sits on a solid slab — walls drop from the terrain's border down
// to a base, a bottom cap closes it, and a wide neutral table beneath catches
// the slab's shadow. Turns the floating map into a physical object the moment
// its edges come into view (see the museum-relief references).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

const HALF = TERRAIN_SIZE / 2
const INTERIOR_STEPS = 12 // coarse grid to find the global min (basin guard)

// Pure: sample the border ring and pick a base level. `samples` per side should
// match the terrain mesh resolution so the wall top sits EXACTLY on the relief
// border — a coarser ring leaves gaps you can see the underside through. baseY
// sits `depth` below the LOWEST point anywhere on the patch (not just the
// border) so a deep interior basin can never pierce the base plane. Tested.
export function computeSlab(sample, depth, samples = 256, cornerRadius = 0, cornerExp = 2) {
  const n = Math.max(8, Math.round(samples))
  const r = Math.max(0, Math.min(cornerRadius, HALF - 1))
  const expo = Math.max(2, cornerExp) // superellipse exponent (2 = circle)
  let borderMin = Infinity
  let globalMin = Infinity
  const ring = [] // clockwise from the -x/-z corner
  const edge = (x, z) => {
    const y = sample(x, z)
    if (y < borderMin) borderMin = y
    if (y < globalMin) globalMin = y
    ring.push({ x, z, y })
  }
  if (r === 0) {
    // square footprint (default): 4 sides × n samples, exactly on the mesh grid
    for (let i = 0; i < n; i++) edge(-HALF + (TERRAIN_SIZE * i) / n, -HALF)
    for (let i = 0; i < n; i++) edge(HALF, -HALF + (TERRAIN_SIZE * i) / n)
    for (let i = 0; i < n; i++) edge(HALF - (TERRAIN_SIZE * i) / n, HALF)
    for (let i = 0; i < n; i++) edge(-HALF, HALF - (TERRAIN_SIZE * i) / n)
  } else {
    // rounded-rectangle footprint: straight runs on the mesh grid spacing, with
    // a quarter-circle arc filleting each of the four salient vertical corners.
    // Traces the same clockwise perimeter so the wall builder is unchanged.
    const inner = HALF - r
    const step = TERRAIN_SIZE / n
    const straightN = Math.max(1, Math.round((inner * 2) / step))
    const arcN = Math.max(3, Math.round(n / 48))
    const line = (x0, z0, x1, z1) => {
      for (let i = 0; i < straightN; i++) {
        const t = i / straightN
        edge(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)
      }
    }
    // superellipse corner: point = center + r·(sgn·|cos|^(2/n), sgn·|sin|^(2/n)).
    // n=2 reduces to a circular arc; higher n bulges toward a squircle. Matches
    // the terrain shader's p-norm clip so the map edge and wall stay aligned.
    const arc = (cx, cz, a0, a1) => {
      for (let i = 0; i < arcN; i++) {
        const a = a0 + ((a1 - a0) * i) / arcN
        const ca = Math.cos(a)
        const sa = Math.sin(a)
        const ex = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / expo) * r
        const ez = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / expo) * r
        edge(cx + ex, cz + ez)
      }
    }
    line(-inner, -HALF, inner, -HALF) //  top edge   (z=-HALF)
    arc(inner, -inner, -Math.PI / 2, 0) //  corner +x −z
    line(HALF, -inner, HALF, inner) //  right edge  (x=+HALF)
    arc(inner, inner, 0, Math.PI / 2) //  corner +x +z
    line(inner, HALF, -inner, HALF) //  bottom edge (z=+HALF)
    arc(-inner, inner, Math.PI / 2, Math.PI) //  corner −x +z
    line(-HALF, inner, -HALF, -inner) //  left edge   (x=−HALF)
    arc(-inner, -inner, Math.PI, Math.PI * 1.5) //  corner −x −z
  }
  // coarse interior sweep for the global minimum
  for (let j = 1; j < INTERIOR_STEPS; j++) {
    for (let i = 1; i < INTERIOR_STEPS; i++) {
      const y = sample(-HALF + (TERRAIN_SIZE * i) / INTERIOR_STEPS, -HALF + (TERRAIN_SIZE * j) / INTERIOR_STEPS)
      if (y < globalMin) globalMin = y
    }
  }
  return { ring, borderMin, globalMin, baseY: globalMin - depth }
}

export class Plinth {
  constructor(scene, params) {
    this.group = new THREE.Group()
    this.group.name = 'plinth'
    scene.add(this.group)

    // slab walls + bottom: a matte stone edge, lit by the scene sun so the cut
    // face reads as thickness. DoubleSide so no viewing angle ever sees through
    // the slab into a culled back face (the "underside" bug).
    this.wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.plinthColor ?? '#d8d4cc'),
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    this.walls = new THREE.Mesh(new THREE.BufferGeometry(), this.wallMat)
    this.walls.castShadow = true
    this.walls.receiveShadow = true
    this.group.add(this.walls)

    // the table: a wide plane that shows ONLY the slab's cast shadow. A
    // ShadowMaterial is transparent everywhere else, so the ground reads as the
    // exact scene background color — no grey mismatch, just the shadow.
    this.baseMat = new THREE.ShadowMaterial({ opacity: 0.26 })
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE * 3.4, TERRAIN_SIZE * 3.4), this.baseMat)
    this.base.rotation.x = -Math.PI / 2
    this.base.receiveShadow = true
    this.group.add(this.base)

    this.depth = params.plinthDepth ?? 7
  }

  // rebuild the walls to hug the current relief border; call after every
  // terrain rebuild (the heightfield changed)
  rebuild(terrain, params) {
    const sample = terrain.sample
    if (!sample) return
    this.depth = params.plinthDepth ?? this.depth

    // match the wall ring to the terrain mesh edge resolution so the top of the
    // walls lands exactly on the relief border (no gaps → no visible underside).
    // The corner radius rounds the four salient vertical edges; the terrain
    // shader clips to the SAME rounded rectangle so nothing overhangs the walls.
    const cornerR = (params.slabCorner ?? 0) * TERRAIN_SIZE
    const cornerExp = 2 + (params.slabCornerSmoothing ?? 0) * 4
    const { ring, baseY } = computeSlab(sample, this.depth, params.resolution ?? 256, cornerR, cornerExp)
    this.baseY = baseY
    this.base.position.y = baseY

    const n = ring.length
    const positions = []
    const normals = []
    const pushTri = (a, b, c) => {
      const ab = new THREE.Vector3().subVectors(b, a)
      const ac = new THREE.Vector3().subVectors(c, a)
      const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
      for (const v of [a, b, c]) {
        positions.push(v.x, v.y, v.z)
        normals.push(nm.x, nm.y, nm.z)
      }
    }

    // side walls: each border segment → quad down to baseY
    for (let i = 0; i < n; i++) {
      const p = ring[i]
      const q = ring[(i + 1) % n]
      const pTop = new THREE.Vector3(p.x, p.y, p.z)
      const qTop = new THREE.Vector3(q.x, q.y, q.z)
      const pBot = new THREE.Vector3(p.x, baseY, p.z)
      const qBot = new THREE.Vector3(q.x, baseY, q.z)
      pushTri(pTop, pBot, qTop)
      pushTri(qTop, pBot, qBot)
    }

    // bottom cap: a triangle fan from the centre out to every ring point, so the
    // cap follows the exact (possibly rounded) footprint — no square overhang
    // poking past the rounded wall bottoms. It's never seen lit; winding is moot.
    const cen = new THREE.Vector3(0, baseY, 0)
    for (let i = 0; i < n; i++) {
      const p = ring[i]
      const q = ring[(i + 1) % n]
      pushTri(cen, new THREE.Vector3(q.x, baseY, q.z), new THREE.Vector3(p.x, baseY, p.z))
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.computeBoundingSphere()
    this.walls.geometry.dispose()
    this.walls.geometry = geo
  }

  setColors(params) {
    this.wallMat.color.set(params.plinthColor ?? '#d8d4cc')
    // the table is a ShadowMaterial (no color — it only darkens the background
    // where the shadow lands); the dark sheet reads a touch stronger
    this.baseMat.opacity = params.darkMode ? 0.34 : 0.24
  }

  setVisible(v) {
    this.group.visible = v
  }
}
