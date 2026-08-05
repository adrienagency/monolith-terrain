// REJOUABLE : node .superpowers/sdd/2026-08-05-damier-multi-blocs/mesure-cuisson.mjs
// Mesure du coût de _bakeField (ocean.js) selon l'échantillonneur de sol.
// Reproduction fidèle : même boucle, même conversion demi-flottante, même
// distance de chanfrein en deux passes. Seul l'échantillonneur change.
//
// AVEC GRAIN   = ce que faisait `heightAt` → `cell.terrain.sample` → _makeDemSampler
// SANS GRAIN   = ce que fait `echantillonSansGrain` → Terrain.sampleChamp
import { Simplex2, mulberry32, fbm, smoothstep } from '../../../src/noise.js'

const TERRAIN_SIZE = 56
const CHAMP_RES = 384

// --- MNT bouchon, même forme qu'un vrai : 1536² flottants (tuiles 512 px)
const SIZE = 1536
const data = new Float32Array(SIZE * SIZE)
for (let j = 0; j < SIZE; j++) {
  for (let i = 0; i < SIZE; i++) {
    data[j * SIZE + i] = 400 * Math.sin(i / 90) * Math.cos(j / 70) + 300
  }
}
const dem = { data, size: SIZE, extentMeters: 20000, meanM: 300 }

function sampleDem(d, px, py) {
  const { data, size } = d
  const x = Math.min(Math.max(px, 0), size - 1.001)
  const y = Math.min(Math.max(py, 0), size - 1.001)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const i = y0 * size + x0
  const a = data[i]
  const b = data[i + 1]
  const c = data[i + size]
  const e = data[i + size + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy
}

const scale = (TERRAIN_SIZE / dem.extentMeters) * 1
const detail = 0.5
const detailScale = 0.08

// terrain.js _makeDemSampler (grain FBM : 3 + 2 octaves = 5)
function samplerAvecGrain() {
  const sDetail = new Simplex2(mulberry32(1))
  return (x, z) => {
    const px = (x / TERRAIN_SIZE + 0.5) * (SIZE - 1)
    const py = (z / TERRAIN_SIZE + 0.5) * (SIZE - 1)
    const raw = sampleDem(dem, px, py)
    const h = (raw - dem.meanM) * scale
    const landFactor = smoothstep(0, 90, raw)
    const fine =
      landFactor *
      (detail * fbm(sDetail, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
        detail * 0.35 * fbm(sDetail, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5))
    return h + fine
  }
}

// terrain.js sampleChamp (bilinéaire seul)
function samplerSansGrain() {
  return (x, z) =>
    (sampleDem(dem, (x / TERRAIN_SIZE + 0.5) * (SIZE - 1), (z / TERRAIN_SIZE + 0.5) * (SIZE - 1)) - dem.meanM) * scale
}

// --- ocean.js _bakeField, à l'identique (hors DataTexture, qui exige three)
function toHalf(v) {
  // conversion équivalente à THREE.DataUtils.toHalfFloat, même coût d'ordre
  const f = Math.fround(v)
  return f === 0 ? 0 : (Math.round(f * 1024) & 0xffff)
}
function cuire(ech, cote) {
  const n = CHAMP_RES * cote
  const span = TERRAIN_SIZE * cote
  const water = new Uint8Array(n * n)
  const half = new Uint16Array(n * n * 2)
  const seaY = 0
  for (let j = 0; j < n; j++) {
    const z = (j / (n - 1) - 0.5) * span
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * span
      const h = ech(x, z)
      half[(j * n + i) * 2] = toHalf(h)
      water[j * n + i] = h < seaY ? 1 : 0
    }
  }
  const cell = span / (n - 1)
  const INF = 1e9
  const dist = new Float32Array(n * n)
  for (let k = 0; k < n * n; k++) dist[k] = water[k] ? INF : 0
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + cell)
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - n] + cell)
      if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - n - 1] + cell * 1.414)
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i
      if (i < n - 1) dist[k] = Math.min(dist[k], dist[k + 1] + cell)
      if (j < n - 1) dist[k] = Math.min(dist[k], dist[k + n] + cell)
      if (i < n - 1 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n + 1] + cell * 1.414)
    }
  for (let k = 0; k < n * n; k++) half[k * 2 + 1] = toHalf(Math.min(1, dist[k] / 15))
  return half.length
}

const mesure = (nom, ech, cote) => {
  cuire(ech, 1) // chauffe le JIT
  const t = []
  for (let r = 0; r < 3; r++) {
    const t0 = performance.now()
    cuire(ech, cote)
    t.push(performance.now() - t0)
  }
  t.sort((a, b) => a - b)
  console.log(`${nom.padEnd(26)} cote ${cote}  champ ${CHAMP_RES * cote}²  ${t[1].toFixed(0)} ms (médiane de 3 : ${t.map((v) => v.toFixed(0)).join('/')})`)
  return t[1]
}

for (const cote of [1, 3, 5]) {
  const a = mesure('AVEC grain (heightAt)', samplerAvecGrain(), cote)
  const b = mesure('SANS grain (sampleChamp)', samplerSansGrain(), cote)
  console.log(`  → gain ×${(a / b).toFixed(1)}, ${(a - b).toFixed(0)} ms de fil principal rendus\n`)
}
