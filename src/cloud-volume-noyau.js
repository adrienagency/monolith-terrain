// LE NOYAU DU VOLUME DE NUAGES — le calcul, et RIEN d'autre.
//
// Pourquoi ce fichier existe, alors que tout tenait dans cloud-volume.js :
// la cuisson coûte 455 ms MESURÉES sur le fil principal, en plein chargement
// (profil V8, tranches 1000–1750 ms, build de production servi). Pendant ces
// 455 ms le navigateur ne décode pas une tuile d'altitude, ne bâtit pas le
// relief et ne produit pas une image. Ce calcul part donc dans un Worker
// (cloud-volume-worker.js), et un Worker ne peut pas importer three.js sans
// se traîner 600 Ko pour rien.
//
// La séparation est donc STRICTE : ici, aucune dépendance à three sauf
// `ImprovedNoise`, qui n'en est pas une — ce fichier des exemples de three
// n'importe rien du tout (vérifié : zéro ligne `import`). Ce qui reste dans
// cloud-volume.js, c'est l'emballage en `Data3DTexture`, qui EXIGE three et
// n'existe de toute façon pas dans un Worker.
//
// ⚠️ L'IDENTITÉ AU BIT PRÈS EST LA CONTRAINTE, pas un souhait — les nuages sont
// l'identité de la scène. Elle est obtenue par CONSTRUCTION et non par
// surveillance : le Worker et le fil principal appellent LA MÊME fonction de CE
// fichier. Il n'y a pas deux versions de l'algorithme à garder d'accord. Le
// corps ci-dessous a été déplacé sans modifier un caractère du calcul.
// (test/cloud-volume.test.js le vérifie quand même, parce qu'un jour quelqu'un
// « optimisera » une boucle ici.)

import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

export const VOL = 64

/**
 * Cuit les données brutes du volume : Uint8Array(64·64·64·2), deux canaux RG.
 * Fonction PURE et déterministe — pas d'aléa, pas d'horloge, pas de DOM.
 * @returns {Uint8Array}
 */
export function cuireDonneesVolume() {
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
  return data
}
