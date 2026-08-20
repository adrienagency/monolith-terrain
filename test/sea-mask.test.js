import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSeaMask,
  blurMask,
  landMaskFromField,
  coteMondialeDepuisChamp,
  rayonIncertitude,
  MER,
  TERRE,
  INDECIS,
} from '../src/sea-mask.js'

// DEM synthétique : size×size, hauteur constante `fill`, retouches via set()
function makeDem(size, fill = 10) {
  const data = new Float32Array(size * size).fill(fill)
  return { data, size }
}
const idx = (size, x, y) => y * size + x

// Champ côtier R8 ({data,width,height}) pour landMaskFromField : UN octet par
// texel, pas quatre. C'est le tableau que coast-mask.js partage entre sa
// DataTexture et les lecteurs CPU — un lecteur resté à la foulée 4 verrait une
// côte au quart de sa taille, sans jamais lever d'erreur.
function makeField(width, height, r) {
  const data = new Uint8Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[y * width + x] = r(x, y)
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

test('landMaskFromField : rééchantillonnage plus-proche-voisin + seuil 127', () => {
  // image 4×4 : moitié ouest terre franche (255), un pixel gris (100, sous le
  // seuil), reste mer (0)
  const img = makeField(4, 4, (x, y) => (x < 2 ? 255 : x === 2 && y === 0 ? 100 : 0))
  const out = landMaskFromField(img, 8) // upsample ×2
  assert.equal(out.length, 64)
  assert.equal(out[idx(8, 0, 0)], 255) // ouest → terre
  assert.equal(out[idx(8, 3, 5)], 255) // x=3 → px=1 → terre
  assert.equal(out[idx(8, 4, 0)], 0) // px=2, gris 100 ≤ 127 → mer
  assert.equal(out[idx(8, 7, 7)], 0) // est → mer
  // downsample : image 8×8 → grille 4 (px = x*8/4)
  const img2 = makeField(8, 8, (x) => (x >= 4 ? 255 : 0))
  const down = landMaskFromField(img2, 4)
  assert.equal(down[idx(4, 1, 2)], 0)
  assert.equal(down[idx(4, 2, 2)], 255)
})

test('chaîne complète : image → landMask → buildSeaMask', () => {
  const size = 8
  const dem = makeDem(size, -2) // tout sous le niveau 0 : sans masque, tout est mer
  assert.equal(buildSeaMask(dem).mask[idx(size, 6, 4)], 255)
  const img = makeField(16, 16, (x) => (x >= 8 ? 255 : 0)) // moitié est = terre
  const { mask } = buildSeaMask(dem, { landMask: landMaskFromField(img, size) })
  assert.equal(mask[idx(size, 1, 4)], 255) // ouest : mer (bord)
  assert.equal(mask[idx(size, 6, 4)], 0) // est : polder → terre
  // le blur ne réintroduit pas de mer au cœur du polder
  const blurred = blurMask({ mask, size }, 1)
  assert.equal(blurred.mask[idx(size, 7, 4)] < 128, true)
})

// ══════════ LA CÔTE MONDIALE DEVIENT L'AUTORITÉ, DANS LES DEUX SENS ═════════
//
// Trois états au lieu de deux : la côte vectorielle tranche MER et TERRE, la
// diffusion depuis les bords ne décide plus que d'INDECIS.

test('cuvette intérieure : TERRE selon la côte ⇒ terre, qu\'elle touche le bord ou non', () => {
  const size = 32
  const dem = makeDem(size)
  // cuvette sous le niveau de la mer QUI TOUCHE LE BORD OUEST : la diffusion
  // seule la déclare mer. La côte, elle, dit qu'on est à l'intérieur des terres.
  for (let y = 10; y < 20; y++) for (let x = 0; x < 12; x++) dem.data[idx(size, x, y)] = -4
  const cote = new Uint8Array(size * size).fill(TERRE)
  assert.equal(buildSeaMask(dem).mask[idx(size, 2, 15)], 255) // sans la côte : mer (bord)
  assert.equal(buildSeaMask(dem, { coteMondiale: cote }).mask[idx(size, 2, 15)], 0)
  // et le verdict ne dépend PAS du cadre : la même cuvette LOIN du bord
  const dem2 = makeDem(size)
  for (let y = 10; y < 20; y++) for (let x = 14; x < 26; x++) dem2.data[idx(size, x, y)] = -4
  assert.equal(buildSeaMask(dem2, { coteMondiale: cote }).mask[idx(size, 20, 15)], 0)
})

test('bras de mer que la diffusion n\'atteint pas : MER selon la côte ⇒ mer', () => {
  const size = 32
  const dem = makeDem(size)
  // poche basse enclavée de 6×6 = 36 cellules : ni au bord, ni ≥ 2 % (minBasin
  // vaut 64 ici) — la diffusion la rate, et c'est ce qui la peignait en vert.
  for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) dem.data[idx(size, x, y)] = -3
  const cote = new Uint8Array(size * size).fill(TERRE)
  for (let y = 12; y < 18; y++) for (let x = 12; x < 18; x++) cote[idx(size, x, y)] = MER
  assert.equal(buildSeaMask(dem).mask[idx(size, 15, 15)], 0) // sans la côte : terre (le défaut)
  assert.equal(buildSeaMask(dem, { coteMondiale: cote }).mask[idx(size, 15, 15)], 255)
})

test('INDECIS : la diffusion garde la main, exactement comme avant', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 8; x++) dem.data[idx(size, x, y)] = -5 // bande au bord
  for (let y = 15; y < 18; y++) for (let x = 20; x < 23; x++) dem.data[idx(size, x, y)] = -2 // poche 9 cellules
  const cote = new Uint8Array(size * size) // tout INDECIS (0)
  const nu = buildSeaMask(dem).mask
  assert.deepEqual(buildSeaMask(dem, { coteMondiale: cote }).mask, nu)
  assert.equal(nu[idx(size, 3, 16)], 255)
  assert.equal(nu[idx(size, 21, 16)], 0)
})

test('les polders tiennent avec la côte mondiale (TERRE bloque aussi le flood)', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 16; x++) dem.data[idx(size, x, y)] = -3
  const cote = new Uint8Array(size * size).fill(MER)
  for (let y = 0; y < size; y++) for (let x = 8; x < 32; x++) cote[idx(size, x, y)] = TERRE
  const { mask } = buildSeaMask(dem, { coteMondiale: cote })
  assert.equal(mask[idx(size, 3, 16)], 255) // la mer du Nord reste mer
  assert.equal(mask[idx(size, 12, 16)], 0) // le polder est terre
})

test('la règle du grand bassin à 2 % survit sous INDECIS', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) dem.data[idx(size, x, y)] = -4 // 100 ≥ 64
  const cote = new Uint8Array(size * size) // INDECIS partout : la côte se tait
  assert.equal(buildSeaMask(dem, { coteMondiale: cote }).mask[idx(size, 15, 15)], 255)
})

test('non-régression : sans coteMondiale, résultat bit-à-bit identique', () => {
  const size = 32
  const dem = makeDem(size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 10; x++) dem.data[idx(size, x, y)] = -3
  for (let y = 5; y < 20; y++) for (let x = 18; x < 28; x++) dem.data[idx(size, x, y)] = -1
  const base = buildSeaMask(dem).mask
  assert.deepEqual(buildSeaMask(dem, { coteMondiale: null }).mask, base)
  const land = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < 4; x++) land[idx(size, x, y)] = 255
  assert.deepEqual(buildSeaMask(dem, { landMask: land, coteMondiale: null }).mask, buildSeaMask(dem, { landMask: land }).mask)
})

test('coteMondialeDepuisChamp : trois états, et la bande d\'incertitude', () => {
  // champ 16×16 : moitié ouest terre (255), moitié est mer (0)
  const img = makeField(16, 16, (x) => (x < 8 ? 255 : 0))
  const sans = coteMondialeDepuisChamp(img, 16)
  assert.equal(sans[idx(16, 0, 0)], TERRE)
  assert.equal(sans[idx(16, 7, 0)], TERRE)
  assert.equal(sans[idx(16, 8, 0)], MER) // sans rayon : complément strict, aucun INDECIS
  assert.equal(sans.includes(INDECIS), false)
  // avec un rayon de 2 cellules : les 2 cellules de part et d'autre du trait
  // deviennent INDECIS, le large et l'intérieur restent tranchés
  const avec = coteMondialeDepuisChamp(img, 16, { rayonIncertain: 2 })
  assert.equal(avec[idx(16, 7, 5)], INDECIS)
  assert.equal(avec[idx(16, 8, 5)], INDECIS)
  assert.equal(avec[idx(16, 5, 5)], TERRE)
  assert.equal(avec[idx(16, 10, 5)], MER)
})

test('rayonIncertitude : la tolérance de la côte, convertie en cellules', () => {
  assert.equal(rayonIncertitude(17.8), 2) // z12 : 30 m ≈ 2 cellules
  assert.equal(rayonIncertitude(0.79), 38) // z16 : 30 m ≈ 38 cellules
  assert.equal(rayonIncertitude(300), 0) // z6 : la cellule est plus grosse que la tolérance
  assert.equal(rayonIncertitude(0), 0) // pas de mètres par cellule : pas de bande
  assert.equal(rayonIncertitude(0.001), 64) // plafonné
})

// ⚠️ LE SITE D'APPEL, LU SUR LA SOURCE — la faille de famille de ce dépôt : une
// règle pure, testée, juste, et une production qui ne la lui demande jamais
// (cf. test/fenetre-coin-exposant.test.js, le même piège en 2026-08-07). Les
// tests ci-dessus fournissent EUX-MÊMES la côte à buildSeaMask : aucun ne peut
// voir terrain.js cesser de la passer. `terrain.js` tire three.js et n'est pas
// importable sous node — on lit donc la source, avec les mêmes limites que
// test/damier-uniformes.test.js.
test('site d\'appel : terrain.js cuit la côte mondiale et la passe au calcul', () => {
  const src = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  assert.match(src, /_coteMondialeFor\(dem\)\s*{/, 'la fabrique de côte a disparu')
  assert.match(src, /const cote = this\._coteMondialeFor\(dem\)/, '_buildFields ne cuit plus la côte')
  assert.match(src, /coteMondiale: cote,/, 'le travail posté ne porte plus la côte')
  // et le rayon d'incertitude vient bien des mètres par cellule DU MASQUE
  assert.match(src, /rayonIncertitude\(metresParCellule\)/, 'le rayon ne vient plus de la grille du masque')
  // la côte fait partie des clés de péremption : sans elle, un masque de mer
  // calculé sans trait de côte se poserait par-dessus celui qui l'a
  assert.match(src, /const cleMer = \{ dem, cote, seaMax \}/, 'la côte est sortie de la clé du masque de mer')
})

test('site d\'appel : la péremption des travaux compare bien le champ `cote`', () => {
  const src = readFileSync(new URL('../src/terrain-jobs.js', import.meta.url), 'utf8')
  const listes = src.match(/\['dem', 'landMask', 'cote', 'maxSize', 'seaMax'\]/g) || []
  assert.equal(listes.length, 2, 'jobStillValid et jobCouvertParEnVol doivent comparer `cote`')
  assert.match(src, /\{ landMask, coteMondiale, minBasinFrac \}/, 'la côte n\'arrive plus à buildSeaMask')
})
