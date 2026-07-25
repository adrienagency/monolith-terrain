// Volume de bruit des nuages — Perlin-Worley tuilable, cuit UNE fois sur le CPU
// et partagé par toutes les entités du ciel. Canal R = billows (un Worley
// inversé qui dilate un FBM de Perlin, d'où des choux-fleurs connectés),
// canal G = un Worley 2D basse fréquence qui sert de champ de couverture.
//
// Ce module est né de l'ancien moteur de nuages (src/clouds.js, SUPPRIMÉ) :
// c'était la seule chose qui méritait d'en être gardée. Le reste — une boîte
// unique raymarchée couvrant toute la carte, seuillée pour sculpter des bancs —
// est remplacé par les ENTITÉS de clouds2.js, et n'a plus à traîner en repli.

import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

const VOL = 64
let sharedVolume = null // { tex, data } — cuit une fois, réutilisé par tous les rebuilds

export function bakeCloudVolume() {
  if (sharedVolume) return sharedVolume
  const perlin = new ImprovedNoise()
  const hash = (x, y, z) => {
    let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0
    h = (h ^ (h >>> 13)) * 1274126177
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }
  // nearest-feature distance on a wrapped grid of freq³ cells → tileable Worley
  const worley = (px, py, pz, freq) => {
    const cx = Math.floor(px * freq)
    const cy = Math.floor(py * freq)
    const cz = Math.floor(pz * freq)
    let minD = 1e9
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ax = cx + dx,
            ay = cy + dy,
            az = cz + dz
          const wx = ((ax % freq) + freq) % freq,
            wy = ((ay % freq) + freq) % freq,
            wz = ((az % freq) + freq) % freq
          const fx = ax + hash(wx, wy, wz),
            fy = ay + hash(wy, wz, wx),
            fz = az + hash(wz, wx, wy)
          const ex = fx / freq - px,
            ey = fy / freq - py,
            ez = fz / freq - pz
          const d = ex * ex + ey * ey + ez * ez
          if (d < minD) minD = d
        }
    return Math.min(1, Math.sqrt(minD) * freq)
  }
  const invWorleyFbm = (x, y, z) =>
    (1 - worley(x, y, z, 4)) * 0.625 + (1 - worley(x, y, z, 8)) * 0.25 + (1 - worley(x, y, z, 16)) * 0.125
  // true 2D tileable Worley for the coverage field — a slice of 3D Worley only
  // grazes a couple of feature points, which starved the deck down to one bank
  const worley2 = (px, py, freq) => {
    const cx = Math.floor(px * freq)
    const cy = Math.floor(py * freq)
    let minD = 1e9
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ax = cx + dx,
          ay = cy + dy
        const wx = ((ax % freq) + freq) % freq,
          wy = ((ay % freq) + freq) % freq
        const fx = ax + hash(wx, wy, 17),
          fy = ay + hash(wy, wx, 43)
        const ex = fx / freq - px,
          ey = fy / freq - py
        const d = ex * ex + ey * ey
        if (d < minD) minD = d
      }
    return Math.min(1, Math.sqrt(minD) * freq)
  }
  const clamp01 = (v) => Math.min(1, Math.max(0, v))

  const data = new Uint8Array(VOL * VOL * VOL * 2) // RG
  let i = 0
  for (let z = 0; z < VOL; z++)
    for (let y = 0; y < VOL; y++)
      for (let x = 0; x < VOL; x++) {
        const nx = x / VOL,
          ny = y / VOL,
          nz = z / VOL
        let pf = 0,
          amp = 0.5,
          fr = 4
        for (let o = 0; o < 3; o++) {
          pf += amp * perlin.noise(nx * fr, ny * fr, nz * fr)
          fr *= 2
          amp *= 0.5
        }
        pf = pf * 0.5 + 0.5
        // remap the Perlin into [billows, 1] — a HIGH-mean field, so subtracting
        // (1 − profile) leaves real cloud bodies instead of starved wisps
        const w = clamp01(invWorleyFbm(nx, ny, nz) * 1.5)
        const pw = clamp01(w + pf * (1 - w))
        // coverage: two low frequencies of inverted 2D Worley (constant over z —
        // the shader reads one slice) → broad cloud banks with real gaps
        const coverage = clamp01((1 - worley2(nx, ny, 3)) * 0.55 + (1 - worley2(nx, ny, 5)) * 0.45)
        data[i++] = Math.round(pw * 255)
        data[i++] = Math.round(clamp01(coverage) * 255)
      }
  const tex = new THREE.Data3DTexture(data, VOL, VOL, VOL)
  tex.format = THREE.RGFormat
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.needsUpdate = true
  sharedVolume = { tex, data }
  return sharedVolume
}
