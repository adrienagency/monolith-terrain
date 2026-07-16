import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { densifyWorld, drapeWorld } from './draped-line.js'

// world-unit spacing to densify to before draping (≈ 1 terrain unit)
const STEP = 1.0

function line(positions, color, widthPx, renderOrder, resolution) {
  const geo = new LineGeometry()
  geo.setPositions(positions)
  const mat = new LineMaterial({ color: new THREE.Color(color), linewidth: widthPx, transparent: true, depthTest: true, depthWrite: false, worldUnits: false })
  mat.resolution.copy(resolution)
  const l = new Line2(geo, mat)
  l.computeLineDistances()
  l.renderOrder = renderOrder
  return l
}

// No casing pass — see buildLineSegments; casing was removed site-wide.
export function buildLineObject(worldPts, sample, { color, widthPx, offset, renderOrder, resolution }) {
  const dense = densifyWorld(worldPts, STEP)
  const positions = [...drapeWorld(dense, sample, offset)]
  const g = new THREE.Group()
  g.add(line(positions, color, widthPx, renderOrder + 1, resolution))
  return g
}
