// Region skirt — when the zone is isolated the relief is a bare cutout with no
// slab, so at the boundary you'd see straight under the (paper-thin) surface.
// This closes that: a vertical curtain that follows the mask silhouette, its top
// welded to the terrain surface height at every point along the cut and its foot
// dropped to a common base. A boundary running over a summit or through a trench
// therefore reads as a solid wall, never a see-through edge.
//
// Built by marching-squares tracing the mask's 0.5 iso-line in world space (the
// same iso the terrain shader discards on), so wall tops line up with the cut.
// Each iso-segment becomes one independent quad — no loop stitching needed. The
// mesh shares the plinth's wall material, so the socle PBR/glass finish applies
// to the isolated zone too.

import * as THREE from 'three'
import { TERRAIN_SIZE } from './terrain.js'
import { contactAO, SOCLE_AO_BANDE } from './plinth.js'

const HALF = TERRAIN_SIZE / 2

// Sample the mask's red channel at world XZ. Mirrors the terrain shader mapping
// rmUv = worldXZ / TERRAIN_SIZE + 0.5, with the mask CanvasTexture's flipY=false
// (region-mask.js) — a straight affine world→pixel map, no vertical flip.
function maskSampler(maskCanvas) {
  const size = maskCanvas.width
  const data = maskCanvas.getContext('2d').getImageData(0, 0, size, size).data
  const at = (px, py) => {
    if (px < 0 || py < 0 || px >= size || py >= size) return 0
    return data[(py * size + px) * 4]
  }
  // bilinear — a smooth iso-line (no stair-stepped, sliver-prone contour)
  return (x, z) => {
    const fx = (x / TERRAIN_SIZE + 0.5) * size - 0.5
    const fy = (z / TERRAIN_SIZE + 0.5) * size - 0.5
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const tx = fx - x0
    const ty = fy - y0
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty
  }
}

// Marching-squares iso-segments at `threshold` over a `grid`×`grid` world cell
// lattice spanning the DEM footprint. Returns [{ax,az,bx,bz}]. Winding is moot —
// each segment is extruded into a DoubleSide quad. Also returns the interior
// min terrain height so the caller can seat the base below every point.
// `uniform` ('full' | 'empty') remplace le masque quand il n'y a plus de masque
// à lire : une dalle du damier entièrement DANS la zone n'en garde pas (voir
// maskUniformity dans region-mask.js — douze mégaoctets pour un seul bit). Le
// tracé rend alors exactement ce que rendait le canevas tout blanc : aucune
// ligne de coupe à l'intérieur, les quatre bords murés — sans quoi la dalle
// s'ouvrirait en tranche de papier au bord du damier — et son minimum
// intérieur, qui entre dans le pied COMMUN de la découpe.
export function traceSkirt({ maskCanvas, sample, grid = 300, threshold = 127, uniform = null }) {
  const mask = uniform ? () => (uniform === 'full' ? 255 : 0) : maskSampler(maskCanvas)
  const step = TERRAIN_SIZE / grid
  const segs = []
  const lerp = (a, b, va, vb) => a + (b - a) * ((threshold - va) / (vb - va || 1))
  let interiorMin = Infinity
  for (let j = 0; j < grid; j++) {
    const z0 = -HALF + j * step
    const z1 = z0 + step
    for (let i = 0; i < grid; i++) {
      const x0 = -HALF + i * step
      const x1 = x0 + step
      const tl = mask(x0, z0)
      const tr = mask(x1, z0)
      const br = mask(x1, z1)
      const bl = mask(x0, z1)
      let c = 0
      if (tl >= threshold) c |= 8
      if (tr >= threshold) c |= 4
      if (br >= threshold) c |= 2
      if (bl >= threshold) c |= 1
      if (c === 0) continue
      if (c === 15) {
        // fully inside — track the lowest interior terrain point, sampled on a
        // coarse 1-in-16 stride (terrain.sample is the costly call here)
        if ((i & 3) === 0 && (j & 3) === 0) {
          const y = sample((x0 + x1) / 2, (z0 + z1) / 2)
          if (y < interiorMin) interiorMin = y
        }
        continue
      }
      const top = () => ({ x: lerp(x0, x1, tl, tr), z: z0 })
      const right = () => ({ x: x1, z: lerp(z0, z1, tr, br) })
      const bottom = () => ({ x: lerp(x0, x1, bl, br), z: z1 })
      const left = () => ({ x: x0, z: lerp(z0, z1, tl, bl) })
      const push = (a, b) => segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z })
      switch (c) {
        case 1: case 14: push(left(), bottom()); break
        case 2: case 13: push(bottom(), right()); break
        case 3: case 12: push(left(), right()); break
        case 4: case 11: push(top(), right()); break
        case 6: case 9: push(top(), bottom()); break
        case 7: case 8: push(left(), top()); break
        case 5: push(left(), top()); push(bottom(), right()); break // saddle
        case 10: push(top(), right()); push(left(), bottom()); break // saddle
      }
    }
  }
  // Close the SQUARE PATCH EDGE too: where the region fills to ±HALF the mask has
  // no iso-crossing (it's white to the edge), so the terrain would be cut open at
  // the block boundary. Emit a wall segment along each patch-edge interval whose
  // midpoint lies inside the region — the extruder walls it like any iso segment.
  const insideAt = (x, z) => mask(x, z) >= threshold
  for (let k = 0; k < grid; k++) {
    const a = -HALF + k * step
    const b = a + step
    const mid = (a + b) / 2
    if (insideAt(HALF - 1e-3, mid)) segs.push({ ax: HALF, az: a, bx: HALF, bz: b })
    if (insideAt(-HALF + 1e-3, mid)) segs.push({ ax: -HALF, az: a, bx: -HALF, bz: b })
    if (insideAt(mid, HALF - 1e-3)) segs.push({ ax: a, az: HALF, bx: b, bz: HALF })
    if (insideAt(mid, -HALF + 1e-3)) segs.push({ ax: a, az: -HALF, bx: b, bz: -HALF })
  }

  // interiorMin reste Infinity quand rien d'intérieur n'a été échantillonné
  // (zone plus fine que le pas de 1 sur 16) : c'est une ABSENCE de mesure, pas
  // un zéro. La rendre à 0 mentait — et depuis que le pied de la coupe se cale
  // sur le point le plus bas de la zone (skirtFloor), ce zéro-là rouvrait le
  // grand bloc jusqu'au niveau de la mer qu'on cherche justement à supprimer.
  return { segs, interiorMin }
}

// LE PLANCHER DE LA ZONE — le point le plus bas du relief SOUS le masque, bord
// de coupe compris. C'est lui qui vient toucher la dalle quand la zone est en
// altitude (Adrien : « si les zones découpées sont en altitude, le point le plus
// bas de la zone découpée sera utilisé pour être le niveau zéro qui touchera la
// dalle du sol »).
//
// ⚠️ Le minimum se prend DANS le masque, jamais sur la dalle entière : une
// vallée voisine restée hors zone ramènerait le pied de coupe trop bas et on
// n'aurait rien réglé. Avec le damier, il se prend aussi sur TOUTES les
// cellules — un plancher par dalle marquerait une marche aux jointures.
//
// Effet de bord assumé : les hauteurs des extrémités de segment sont mémorisées
// dans `traced` (s.ya / s.yb), et buildRegionSkirt les réutilise telles quelles.
// terrain.sample est l'appel coûteux du lot, il ne doit être payé qu'une fois.
export function skirtFloor(traced, sample) {
  if (!traced?.segs?.length || !sample) return null
  let min = Number.isFinite(traced.interiorMin) ? traced.interiorMin : Infinity
  for (const s of traced.segs) {
    if (!Number.isFinite(s.ya)) s.ya = sample(s.ax, s.az)
    if (!Number.isFinite(s.yb)) s.yb = sample(s.bx, s.bz)
    if (s.ya < min) min = s.ya
    if (s.yb < min) min = s.yb
  }
  return Number.isFinite(min) ? min : null
}

// LA BASE DE LA DÉCOUPE, en une expression qui réconcilie deux règles opposées.
//
// Le pied de la coupe était d'abord le minimum local, puis on l'a fixé au ZÉRO
// ABSOLU (niveau de la mer) parce que le minimum faisait flotter la découpe à
// une hauteur qui changeait d'une région à l'autre, désalignée de la dalle et
// des textes du cartouche.
//
// Ce zéro absolu reste JUSTE POUR UNE ÎLE — son plancher vaut déjà le niveau de
// la mer, et c'est ce rendu-là qu'Adrien a validé. Il n'est faux qu'en
// ALTITUDE : aux Deux Alpes, la découpe flottait au-dessus d'une jupe qui
// descendait jusqu'à la mer alors que le fond de vallée est à 1 000 m, et
// l'objet perdait toute crédibilité.
//   île        → plancher ≈ 0 ≈ mer → inchangé
//   Deux Alpes → plancher ≈ 1 000 m → c'est lui qui touche la dalle
export function regionBaseLevel(seaY, floorY) {
  const mer = Number.isFinite(seaY) && seaY > -9000 ? seaY : null
  const sol = Number.isFinite(floorY) ? floorY : null
  if (mer === null) return sol
  if (sol === null) return mer
  return Math.max(mer, sol)
}

// Build the skirt mesh. `material` is shared (the plinth wall material) so the
// socle finish carries over.
//
// `baseY` FIXE le pied du mur à une altitude donnée — voir regionBaseLevel
// ci-dessus : le niveau de la mer pour une île, le plancher de la zone quand
// elle est en altitude. Sans lui, le pied suivait le point le plus bas de la
// DALLE, hors zone comprise, et la découpe flottait à une hauteur qui changeait
// d'une région à l'autre. `depth` n'est plus qu'un repli quand aucune base
// n'est imposée.
//
// `traced` — la sortie de traceSkirt, quand l'appelant l'a déjà calculée pour
// en tirer le plancher (skirtFloor). Le damier en a besoin : le pied de coupe
// est COMMUN à toutes les dalles, il faut donc les tracer toutes avant d'en
// construire une seule. Sans ce passe-plat, chaque dalle paierait deux fois son
// marching-squares et ses appels à terrain.sample.
//   buildRegionSkirt({ maskCanvas, sample, material, baseY, traced? }) → { mesh } | null
export function buildRegionSkirt({ maskCanvas, sample, material, depth = 5, grid = 300, baseY: forcedBaseY = null, traced = null, uniform = null }) {
  // `uniform` tient lieu de masque pour une dalle sans canevas (voir traceSkirt)
  if ((!maskCanvas && !uniform) || !sample) return null
  const { segs, interiorMin } = traced || traceSkirt({ maskCanvas, sample, grid, uniform })
  if (!segs.length) return null

  // top height at each boundary point = the terrain surface there
  let minTop = Number.isFinite(interiorMin) ? interiorMin : Infinity
  for (const s of segs) {
    if (!Number.isFinite(s.ya)) s.ya = sample(s.ax, s.az)
    if (!Number.isFinite(s.yb)) s.yb = sample(s.bx, s.bz)
    if (s.ya < minTop) minTop = s.ya
    if (s.yb < minTop) minTop = s.yb
  }
  if (!Number.isFinite(minTop)) minTop = 0
  // Une base imposée est SUIVIE À LA LETTRE.
  //
  // Elle était d'abord bornée par Math.min(base, minTop) « pour que le relief
  // ne perce pas sous le mur ». Ce garde-fou se retournait contre nous : il
  // suffisait d'UN point intérieur profond — un fond sous-marin resté dans le
  // masque sur une petite île — pour tirer toute la base vers le bas et
  // rependre l'épaisseur qu'on venait de retirer (Port-Cros, capture Adrien).
  // Ce qui passe sous le zéro est sous l'eau : il n'y a rien à montrer, et le
  // cacher vaut mieux que suspendre l'île au-dessus du vide.
  const baseY = Number.isFinite(forcedBaseY) ? forcedBaseY : minTop - depth

  const positions = []
  const normals = []
  const uvs = [] // so textured/frosted socle materials grain the skirt too
  const couleurs = [] // occlusion de contact — voir plus bas
  const UVSCALE = 6
  // ⚠️ OBLIGATOIRE, pas décoratif. La jupe porte le matériau du socle, et ce
  // matériau est passé en `vertexColors` (l'occlusion de contact y voyage,
  // `aoMap` étant hors d'atteinte faute d'`uv1`). Une géométrie sans attribut
  // `color` recevrait la valeur générique WebGL (0,0,0,1) : la découpe entière
  // deviendrait NOIRE. On cuit donc la même rampe qu'au pied du bloc.
  let hautMax = -Infinity
  for (const s of segs) {
    if (s.ya > hautMax) hautMax = s.ya
    if (s.yb > hautMax) hautMax = s.yb
  }
  const aoBande = SOCLE_AO_BANDE * Math.max(0, hautMax - baseY)
  const pushTri = (a, b, cc, ua, ub, uc) => {
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(cc, a)
    const nm = new THREE.Vector3().crossVectors(ab, ac).normalize()
    const tri = [[a, ua], [b, ub], [cc, uc]]
    for (const [v, uv] of tri) {
      positions.push(v.x, v.y, v.z)
      normals.push(nm.x, nm.y, nm.z)
      uvs.push(uv[0], uv[1])
      const ao = Math.round(255 * contactAO(v.y, baseY, aoBande))
      couleurs.push(ao, ao, ao)
    }
  }
  const EPS = 0.05 // lift the wall top a hair so it overlaps the surface (no seam)
  for (const s of segs) {
    // skip degenerate slivers — near-zero-length segments render as icicle spikes
    const segLen = Math.hypot(s.bx - s.ax, s.bz - s.az)
    if (segLen < 1e-3) continue
    const aTop = new THREE.Vector3(s.ax, s.ya + EPS, s.az)
    const bTop = new THREE.Vector3(s.bx, s.yb + EPS, s.bz)
    const aBot = new THREE.Vector3(s.ax, baseY, s.az)
    const bBot = new THREE.Vector3(s.bx, baseY, s.bz)
    const u1 = segLen / UVSCALE
    const vaT = (s.ya - baseY) / UVSCALE
    const vbT = (s.yb - baseY) / UVSCALE
    pushTri(aTop, aBot, bTop, [0, vaT], [0, 0], [u1, vbT])
    pushTri(bTop, aBot, bBot, [u1, vbT], [0, 0], [u1, 0])
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Uint8BufferAttribute(couleurs, 3, true))
  geo.computeBoundingSphere()
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'region-skirt'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, baseY }
}
