import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

// pack every segment of every run into one flat [x,y,z, x,y,z, …] segment list,
// draped (y = sample+offset). One LineSegments2 = one draw call for the layer.
function segPositions(runs, sample, offset) {
  const pos = []
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i], b = run[i + 1]
      pos.push(a.x, sample(a.x, a.z) + offset, a.z, b.x, sample(b.x, b.z) + offset, b.z)
    }
  }
  return pos
}
function seg(pos, color, widthPx, renderOrder, resolution) {
  const geo = new LineSegmentsGeometry()
  geo.setPositions(pos)
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: widthPx, transparent: true, depthTest: true, depthWrite: false, worldUnits: false })
  mat.resolution.copy(resolution)
  const l = new LineSegments2(geo, mat)
  l.computeLineDistances()
  l.renderOrder = renderOrder
  return l
}
// No casing pass: the halo/outline under map lines was removed site-wide —
// "tu peux retirer tous les casing du site, l'effet ne va pas". Don't add it
// back as an option; the ink lines carry their own contrast.
export function buildLineSegments(runs, sample, { color, widthPx, offset, renderOrder, resolution }) {
  const g = new THREE.Group()
  const pos = segPositions(runs, sample, offset)
  if (!pos.length) return g
  g.add(seg(pos, color, widthPx, renderOrder + 1, resolution))
  return g
}
