import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSeaMask, blurMask, landMaskFromImage } from '../src/sea-mask.js'

// DEM synthétique : size×size, hauteur constante `fill`, retouches via set()
function makeDem(size, fill = 10) {
  const data = new Float32Array(size * size).fill(fill)
  return { data, size }
}
const idx = (size, x, y) => y * size + x

// ImageData-like (RGBA) pour landMaskFromImage — r(x,y) pilote le canal R
function makeImage(width, height, r) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[(y * width + x) * 4] = r(x, y)
  return { data, width, height }
}

test('mer = zone basse connectée au bord ; poche basse enclavée = terre', () => {
  const size = 32
  const dem = makeDem(size)
  // bande côtière ouest sous le niveau de la mer, collée au bord
  for (let y = 0; y < size; y++) for (let x = 0; x < 8; x++) dem.data[idx(size, x, y)] = -5
  // petite poche basse enclavée (3×3 = 9 cellules < minBasin 64)
  for (let y = 15; y < 18; y++) for (let x = 20; x < 23; x++) dem.data[idx(size, x, y)] = -2
  const { mask } = buildSeaMask(dem)
  assert.equal(mask[idx(size, 3, 16)], 255) // bande côtière → mer
  assert.equal(mask[idx(size, 21, 16)], 0) // poche enclavée → terre (vallée)
  assert.equal(mask[idx(size, 28, 16)], 0) // plateau à +10 m → terre
})

test('non-régression : sans landMask, résultat bit-à-bit identique', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 10; x++) dem.data[idx(size, x, y)] = -3
  for (let y = 5; y < 20; y++) for (let x = 18; x < 28; x++) dem.data[idx(size, x, y)] = -1 // bassin 150 ≥ 2 %
  const base = buildSeaMask(dem)
  assert.deepEqual(buildSeaMask(dem, {}).mask, base.mask) // options vides
  assert.deepEqual(buildSeaMask(dem, { landMask: null }).mask, base.mask) // landMask null explicite
})

test('polder côtier sous 0 masqué terre ⇒ pas mer (et le flood ne le traverse pas)', () => {
  const size = 32
  const dem = makeDem(size)
  // toute la moitié ouest sous le niveau de la mer, connectée au bord :
  // sans masque, TOUT serait mer (topologie pure — le bug Pays-Bas)
  for (let y = 0; y < size; y++) for (let x = 0; x < 16; x++) dem.data[idx(size, x, y)] = -3
  const land = new Uint8Array(size * size)
  // le trait de côte vectoriel : colonnes 8..15 = polders (TERRE)
  for (let y = 0; y < size; y++) for (let x = 8; x < 16; x++) land[idx(size, x, y)] = 255
  const noMask = buildSeaMask(dem)
  assert.equal(noMask.mask[idx(size, 12, 16)], 255) // sans masque : inondé (le bug)
  const { mask } = buildSeaMask(dem, { landMask: land })
  assert.equal(mask[idx(size, 3, 16)], 255) // la mer du Nord reste mer
  assert.equal(mask[idx(size, 12, 16)], 0) // le polder est terre
})

test('poche basse derrière une digue masquée terre ⇒ pas mer (flood bloqué)', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 6; x++) dem.data[idx(size, x, y)] = -3 // mer ouverte
  for (let y = 10; y < 16; y++) for (let x = 6; x < 12; x++) dem.data[idx(size, x, y)] = -2 // digue + arrière-pays bas (36 < 64)
  const land = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 6; x < 8; x++) land[idx(size, x, y)] = 255 // digue = terre
  const noMask = buildSeaMask(dem)
  assert.equal(noMask.mask[idx(size, 10, 12)], 255) // sans masque : la mer coule derrière la digue
  const { mask } = buildSeaMask(dem, { landMask: land })
  assert.equal(mask[idx(size, 2, 12)], 255) // la mer ouverte reste mer
  assert.equal(mask[idx(size, 10, 12)], 0) // derrière la digue : déconnecté + < minBasin ⇒ terre
})

test('bassin ≥ 2 % masqué terre ⇒ pas mer (le piège Flevoland)', () => {
  const size = 32
  const dem = makeDem(size)
  // bassin enclavé 10×10 = 100 cellules ≥ minBasin 64 : la règle « grand
  // bassin » (Caspienne) l'attraperait comme mer
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) dem.data[idx(size, x, y)] = -4
  assert.equal(buildSeaMask(dem).mask[idx(size, 15, 15)], 255) // sans masque : mer (règle bassin)
  const land = new Uint8Array(size * size)
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) land[idx(size, x, y)] = 255
  assert.equal(buildSeaMask(dem, { landMask: land }).mask[idx(size, 15, 15)], 0) // masqué terre : polder
})

test('landMaskFromImage : rééchantillonnage plus-proche-voisin + seuil 127', () => {
  // image 4×4 : moitié ouest terre franche (255), un pixel gris (100, sous le
  // seuil), reste mer (0)
  const img = makeImage(4, 4, (x, y) => (x < 2 ? 255 : x === 2 && y === 0 ? 100 : 0))
  const out = landMaskFromImage(img, 8) // upsample ×2
  assert.equal(out.length, 64)
  assert.equal(out[idx(8, 0, 0)], 255) // ouest → terre
  assert.equal(out[idx(8, 3, 5)], 255) // x=3 → px=1 → terre
  assert.equal(out[idx(8, 4, 0)], 0) // px=2, gris 100 ≤ 127 → mer
  assert.equal(out[idx(8, 7, 7)], 0) // est → mer
  // downsample : image 8×8 → grille 4 (px = x*8/4)
  const img2 = makeImage(8, 8, (x) => (x >= 4 ? 255 : 0))
  const down = landMaskFromImage(img2, 4)
  assert.equal(down[idx(4, 1, 2)], 0)
  assert.equal(down[idx(4, 2, 2)], 255)
})

test('chaîne complète : image → landMask → buildSeaMask', () => {
  const size = 8
  const dem = makeDem(size, -2) // tout sous le niveau 0 : sans masque, tout est mer
  assert.equal(buildSeaMask(dem).mask[idx(size, 6, 4)], 255)
  const img = makeImage(16, 16, (x) => (x >= 8 ? 255 : 0)) // moitié est = terre
  const { mask } = buildSeaMask(dem, { landMask: landMaskFromImage(img, size) })
  assert.equal(mask[idx(size, 1, 4)], 255) // ouest : mer (bord)
  assert.equal(mask[idx(size, 6, 4)], 0) // est : polder → terre
  // le blur ne réintroduit pas de mer au cœur du polder
  const blurred = blurMask({ mask, size }, 1)
  assert.equal(blurred.mask[idx(size, 7, 4)] < 128, true)
})
