// OCEAN MASK — which sea-level cells are REALLY the sea.
//
// At coarse zoom the resampled DEM drops scattered cells a hair below 0 m
// inland (coastal averaging, tile artefacts). Painted purely by "height <
// sea level" they read as phantom lakes and inlets that don't exist. The fix
// is topological, not a threshold tweak: the true ocean is the below-sea
// region CONNECTED to the map border. A flood fill from the edges marks it;
// every other below-sea pocket is land (a small valley), UNLESS it's a
// genuinely large basin (Caspian, Dead Sea) that deserves its blue — those
// are kept by an area test.
//
// Output: a size×size Uint8 mask (255 = real sea) the terrain shader ANDs
// with its height test. Pure over the DEM, unit-testable.
//
// landMask (optionnel) : Uint8Array(size²) alignée sur dem.data, 255 = TERRE
// d'après le trait de côte vectoriel (coast-mask.js). Une cellule déclarée
// terre ne peut être ni mer ni chemin du flood fill — c'est ce qui sauve les
// polders : sous 0 m ET connectés au bord (Pays-Bas) ou en bassin ≥2 %
// (Flevoland), la topologie seule les prenait pour la mer. CONTRAT : sans
// landMask, résultat bit-à-bit identique à avant.

export function buildSeaMask(dem, { seaLevelM = 0.5, minBasinFrac = 0.02, landMask = null } = {}) {
  const { data, size } = dem
  const n = size * size
  const isLow = new Uint8Array(n) // 1 = at/below sea level (et pas terre du masque)
  for (let i = 0; i < n; i++) isLow[i] = data[i] <= seaLevelM && !(landMask && landMask[i]) ? 1 : 0

  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const areas = [] // per-component cell count
  const touchesBorder = [] // per-component: reachable from an edge
  let comp = 0

  for (let start = 0; start < n; start++) {
    if (!isLow[start] || label[start] !== -1) continue
    let top = 0
    stack[top++] = start
    label[start] = comp
    let area = 0
    let border = false
    while (top > 0) {
      const i = stack[--top]
      area++
      const x = i % size
      const y = (i / size) | 0
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) border = true
      // 4-neighbourhood flood over connected low cells
      if (x > 0 && isLow[i - 1] && label[i - 1] === -1) (label[i - 1] = comp), (stack[top++] = i - 1)
      if (x < size - 1 && isLow[i + 1] && label[i + 1] === -1) (label[i + 1] = comp), (stack[top++] = i + 1)
      if (y > 0 && isLow[i - size] && label[i - size] === -1) (label[i - size] = comp), (stack[top++] = i - size)
      if (y < size - 1 && isLow[i + size] && label[i + size] === -1) (label[i + size] = comp), (stack[top++] = i + size)
    }
    areas.push(area)
    touchesBorder.push(border)
    comp++
  }

  // a component is "real sea" if it reaches the border, or it's a big basin
  const minBasin = Math.max(64, Math.round(n * minBasinFrac))
  const seaComp = new Uint8Array(comp)
  for (let c = 0; c < comp; c++) seaComp[c] = touchesBorder[c] || areas[c] >= minBasin ? 1 : 0

  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = isLow[i] && seaComp[label[i]] ? 255 : 0
  return { mask, size }
}

// Rééchantillonne le masque côtier rasterisé (ImageData-like {data,width,
// height}, canal R : >127 = terre) à la grille du DEM → la landMask que
// buildSeaMask attend. Plus-proche-voisin : le masque source (2048²) est plus
// fin que tout DEM de l'app, et la ligne 0 du canvas (nord) correspond à la
// ligne 0 du DEM — même convention que le sampler GPU (flipY off). Pure,
// testable en node (aucun DOM requis).
export function landMaskFromImage(img, size) {
  const { data, width, height } = img
  const out = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const py = Math.min(height - 1, ((y * height) / size) | 0)
    const row = py * width
    for (let x = 0; x < size; x++) {
      const px = Math.min(width - 1, ((x * width) / size) | 0)
      out[y * size + x] = data[(row + px) * 4] > 127 ? 255 : 0
    }
  }
  return out
}

// small separable box blur (radius r) so the coastline reads smooth under the
// shader's 0.5 threshold instead of a stair-stepped DEM edge
export function blurMask({ mask, size }, r = 1) {
  const n = size * size
  const tmp = new Float32Array(n)
  const out = new Uint8Array(n)
  const w = 2 * r + 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(size - 1, Math.max(0, x + dx))
        s += mask[y * size + xx]
      }
      tmp[y * size + x] = s / w
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let s = 0
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(size - 1, Math.max(0, y + dy))
        s += tmp[yy * size + x]
      }
      out[y * size + x] = Math.round(s / w)
    }
  }
  return { mask: out, size }
}
