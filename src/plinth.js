// The relief sits on a solid slab — walls drop from the terrain's border down
// to a base, a bottom cap closes it, and a wide neutral table beneath catches
// the slab's shadow. Turns the floating map into a physical object the moment
// its edges come into view (see the museum-relief references).

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'

const HALF = TERRAIN_SIZE / 2
const EDGE_SAMPLES = 160 // per side — smooth silhouette without heavy geometry
const INTERIOR_STEPS = 12 // coarse grid to find the global min (basin guard)

// Pure: sample the border ring and pick a base level. baseY sits `depth` below
// the LOWEST point anywhere on the patch (not just the border) so a deep
// interior basin can never punch through the base plane. Exported for tests.
export function computeSlab(sample, depth) {
  let borderMin = Infinity
  let globalMin = Infinity
  const ring = [] // clockwise from the -x/-z corner
  const edge = (x, z) => {
    const y = sample(x, z)
    if (y < borderMin) borderMin = y
    if (y < globalMin) globalMin = y
    ring.push({ x, z, y })
  }
  for (let i = 0; i < EDGE_SAMPLES; i++) edge(-HALF + (TERRAIN_SIZE * i) / EDGE_SAMPLES, -HALF)
  for (let i = 0; i < EDGE_SAMPLES; i++) edge(HALF, -HALF + (TERRAIN_SIZE * i) / EDGE_SAMPLES)
  for (let i = 0; i < EDGE_SAMPLES; i++) edge(HALF - (TERRAIN_SIZE * i) / EDGE_SAMPLES, HALF)
  for (let i = 0; i < EDGE_SAMPLES; i++) edge(-HALF, HALF - (TERRAIN_SIZE * i) / EDGE_SAMPLES)
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

    // slab walls + bottom: a matte stone edge, lit by the scene sun so the
    // cut face reads as thickness
    this.wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.plinthColor ?? '#d8d4cc'),
      roughness: 0.95,
      metalness: 0,
    })
    this.walls = new THREE.Mesh(new THREE.BufferGeometry(), this.wallMat)
    this.walls.castShadow = true
    this.walls.receiveShadow = true
    this.group.add(this.walls)

    // the table: a wide neutral plane that only shows the slab's shadow
    this.baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.baseColor ?? '#c8c5be'),
      roughness: 1,
      metalness: 0,
    })
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

    const { ring, baseY } = computeSlab(sample, this.depth)
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

    // bottom cap (two triangles — a flat quad is plenty, it's never seen lit)
    const c00 = new THREE.Vector3(-HALF, baseY, -HALF)
    const c10 = new THREE.Vector3(HALF, baseY, -HALF)
    const c11 = new THREE.Vector3(HALF, baseY, HALF)
    const c01 = new THREE.Vector3(-HALF, baseY, HALF)
    pushTri(c00, c10, c11)
    pushTri(c00, c11, c01)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    geo.computeBoundingSphere()
    this.walls.geometry.dispose()
    this.walls.geometry = geo
  }

  setColors(params) {
    this.wallMat.color.set(params.plinthColor ?? '#d8d4cc')
    this.baseMat.color.set(params.baseColor ?? '#c8c5be')
  }

  setVisible(v) {
    this.group.visible = v
  }
}
