import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

// pack every segment of every run into one flat [x,y,z, x,y,z, …] segment list,
// draped (y = sol+offset). One LineSegments2 = one draw call for the layer.
//
// ══════════ ⚠️ `poseur` ET PLUS `sample` — Tâche D16-b ══════════════════════
//
// Le calque raisonne en coordonnées de BLOC : `runs` porte des `(x · z)` de
// bloc, `offset` est une marge en unités de BLOC. Ce qui change, c'est le
// dernier geste — OÙ le point atterrit :
//
//   · sur le bloc plat  : `placer(x, z, y)` rend `(x · y · z)`, l'identité ;
//   · sur le globe      : il rend un point de la sphère de relief.
//
// ⛔ **AUCUNE LONGUEUR N'EST CONVERTIE ICI, ET C'EST VOULU.** `offset` reste en
// unités de bloc jusqu'au bout ; la seule conversion vit dans
// `monde/sol-globe.js`, écrite une fois. La convertir aussi ici la ferait DEUX
// fois — le facteur au carré, et c'est la classe de défaut que cette tâche
// existe pour ne pas rejouer.
function segPositions(runs, poseur, offset) {
  const pos = []
  const pousse = (x, z) => {
    const v = poseur.placer(x, z, poseur.hauteur(x, z) + offset)
    pos.push(v.x, v.y, v.z)
  }
  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      pousse(run[i].x, run[i].z)
      pousse(run[i + 1].x, run[i + 1].z)
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
export function buildLineSegments(runs, poseur, { color, widthPx, offset, renderOrder, resolution }) {
  const g = new THREE.Group()
  const pos = segPositions(runs, poseur, offset)
  if (!pos.length) return g
  g.add(seg(pos, color, widthPx, renderOrder + 1, resolution))
  return g
}
