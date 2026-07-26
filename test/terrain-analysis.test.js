import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  boxBlur,
  textureShade,
  robustScale,
  encodeTextureShade,
  wetness,
  aspectSmooth,
  hillshade,
  packAnalysis,
  analyzeDem,
} from '../src/terrain-analysis.js'

// ---------------------------------------------------------------- fabriques
// Des DEM ANALYTIQUES : on connaît le signe attendu de la courbure en chaque
// point, donc les tests portent sur la PHYSIQUE du champ (crête convexe, talweg
// concave, plan nul) et pas sur des nombres magiques relevés d'une exécution.
const S = 64
function field(gen, size = S) {
  const a = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) a[y * size + x] = gen(x, y)
  return a
}
const at = (a, x, y, size = S) => a[y * size + x]

const PLAT = field(() => 700)
// plan incliné : altitude linéaire, croissante vers l'est ET vers le sud
const PLAN = field((x, y) => 100 + 3 * x + 5 * y)
// CRÊTE : un toit dont le faîte court en x = 32 (convexe au sommet)
const CRETE = field((x) => 1200 - 18 * Math.abs(x - 32))
// TALWEG : la même forme retournée (concave au fond)
const TALWEG = field((x) => 200 + 18 * Math.abs(x - 32))

// ------------------------------------------------------------------ boxBlur
test('boxBlur conserve une constante et reste fini', () => {
  const dst = boxBlur(PLAT, new Float32Array(PLAT.length), S, 5)
  for (let i = 0; i < dst.length; i++) assert.ok(Math.abs(dst[i] - 700) < 1e-3, `pixel ${i} = ${dst[i]}`)
})

test('boxBlur laisse un plan incliné inchangé À L’INTÉRIEUR (les bords clampent)', () => {
  const r = 3
  const dst = boxBlur(PLAN, new Float32Array(PLAN.length), S, r)
  for (let y = r + 1; y < S - r - 1; y++)
    for (let x = r + 1; x < S - r - 1; x++)
      assert.ok(Math.abs(at(dst, x, y) - at(PLAN, x, y)) < 1e-2, `(${x},${y}) ${at(dst, x, y)}`)
})

test('boxBlur à rayon 0 est une copie', () => {
  const dst = boxBlur(CRETE, new Float32Array(CRETE.length), S, 0)
  assert.deepEqual(Array.from(dst), Array.from(CRETE))
})

test('boxBlur égale un flou naïf (sommes glissantes = référence)', () => {
  const r = 2
  const fast = boxBlur(CRETE, new Float32Array(CRETE.length), S, r)
  const cl = (v) => Math.min(S - 1, Math.max(0, v))
  for (let y = 0; y < S; y += 7) {
    for (let x = 0; x < S; x += 7) {
      let s = 0
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) s += at(CRETE, cl(x + dx), cl(y + dy))
      assert.ok(Math.abs(fast[y * S + x] - s / ((2 * r + 1) ** 2)) < 1e-2, `(${x},${y})`)
    }
  }
})

test('boxBlur accepte dst === src (blanchiment en place)', () => {
  const buf = Float32Array.from(CRETE)
  boxBlur(buf, buf, S, 2)
  assert.ok(buf.every(Number.isFinite))
  assert.notDeepEqual(Array.from(buf), Array.from(CRETE))
})

// ------------------------------------------------------------ textureShade
test('textureShade : POSITIF sur une crête, NÉGATIF dans un talweg', () => {
  // c'est LA propriété recherchée : une dérivée première (la pente) est
  // identique sur les deux formes, la dérivée fractionnaire les sépare
  const tc = textureShade(CRETE, S)
  const tt = textureShade(TALWEG, S)
  assert.ok(at(tc, 32, 32) > 0, `crête ${at(tc, 32, 32)}`)
  assert.ok(at(tt, 32, 32) < 0, `talweg ${at(tt, 32, 32)}`)
  // et de façon symétrique : la crête et son inverse donnent des signes opposés
  assert.ok(Math.abs(at(tc, 32, 32) + at(tt, 32, 32)) < 1e-3 * Math.abs(at(tc, 32, 32)) + 1e-6)
})

test('textureShade : nul sur un plan incliné (loin des bords)', () => {
  // 3 octaves ⇒ rayon max 8 px : sur une grille d'essai de 64 px, les 6 octaves
  // de production (rayon 64) reprendraient TOUTE la grille en effet de bord.
  // Sur le vrai DEM (768 px) ces bords ne mordent que la marge du socle.
  const t = textureShade(PLAN, S, { octaves: 3 })
  const amp = Math.max(...Array.from(t).map(Math.abs))
  for (let y = 24; y < 40; y++)
    for (let x = 24; x < 40; x++)
      assert.ok(Math.abs(at(t, x, y)) < 1e-3 * (amp + 1), `(${x},${y}) = ${at(t, x, y)}`)
})

test('textureShade : nul et fini sur un DEM constant', () => {
  const t = textureShade(PLAT, S)
  for (const v of t) {
    assert.ok(Number.isFinite(v))
    assert.ok(Math.abs(v) < 1e-6)
  }
})

test('textureShade : MONOTONE en amplitude — un relief deux fois plus creusé répond deux fois plus', () => {
  const doux = field((x) => 1200 - 9 * Math.abs(x - 32))
  const t1 = textureShade(doux, S)
  const t2 = textureShade(CRETE, S) // même forme, pente doublée
  assert.ok(at(t2, 32, 32) > at(t1, 32, 32) * 1.8, `${at(t2, 32, 32)} vs ${at(t1, 32, 32)}`)
})

test('textureShade : aucun NaN sur un DEM troué (NaN en entrée) ou dégénéré', () => {
  const troue = Float32Array.from(CRETE)
  for (let i = 0; i < troue.length; i += 37) troue[i] = NaN
  for (const v of textureShade(troue, S)) assert.ok(Number.isFinite(v))
  // grilles dégénérées : on rend un champ neutre plutôt que de planter
  for (const size of [0, 1, 2]) {
    const t = textureShade(new Float32Array(size * size), size)
    assert.equal(t.length, size * size)
    for (const v of t) assert.ok(Number.isFinite(v))
  }
})

// ------------------------------------------------------------- robustScale
test('robustScale suit l’amplitude du champ, pas sa taille', () => {
  const petit = new Float32Array(1000).map((_, i) => Math.sin(i) * 0.001)
  const grand = new Float32Array(1000).map((_, i) => Math.sin(i) * 1000)
  const s1 = robustScale(petit)
  const s2 = robustScale(grand)
  assert.ok(s2 > s1 * 1e5, `${s1} / ${s2}`)
  assert.ok(Number.isFinite(s1) && s1 > 0)
})

test('robustScale ignore une poignée d’aberrations (p95, pas le max)', () => {
  const a = new Float32Array(4000).fill(1)
  for (let i = 0; i < 40; i++) a[i * 100] = 1e6 // 1 % d'aberrations
  assert.ok(robustScale(a) < 10, `${robustScale(a)}`)
})

test('robustScale : repli neutre sur un champ nul ou vide', () => {
  assert.equal(robustScale(new Float32Array(100)), 1)
  assert.equal(robustScale(new Float32Array(0)), 1)
  assert.equal(robustScale(null), 1)
})

// -------------------------------------------------------- encodeTextureShade
test('encodeTextureShade : 0,5 pour un champ plat, monotone, borné dans 0..1', () => {
  const T = Float32Array.from([-1e9, -10, -1, 0, 1, 10, 1e9])
  const e = encodeTextureShade(T, 1)
  assert.equal(e[3], 0.5)
  for (let i = 1; i < e.length; i++) assert.ok(e[i] > e[i - 1], `non monotone en ${i}`)
  for (const v of e) assert.ok(v >= 0 && v <= 1)
})

test('encodeTextureShade : l’échelle robuste rend le résultat indépendant du terrain', () => {
  const alpes = Float32Array.from([-3, -1, 0, 1, 3]).map((v) => v * 500)
  const delta = Float32Array.from([-3, -1, 0, 1, 3]).map((v) => v * 0.2)
  const ea = encodeTextureShade(alpes, robustScale(alpes))
  const ed = encodeTextureShade(delta, robustScale(delta))
  for (let i = 0; i < ea.length; i++) assert.ok(Math.abs(ea[i] - ed[i]) < 1e-6, `i=${i} ${ea[i]} ${ed[i]}`)
})

test('encodeTextureShade : échelle nulle ou absurde → jamais de NaN', () => {
  for (const s of [0, -1, NaN, undefined]) for (const v of encodeTextureShade(Float32Array.from([1, -1, 0]), s)) assert.ok(Number.isFinite(v))
})

// ------------------------------------------------------------------ wetness
test('wetness : creux > 0,5 > bosse, et 0,5 pile sur un terrain plat', () => {
  const w = wetness(TALWEG, S, { radius: 8 })
  assert.ok(at(w, 32, 32) > 0.55, `fond de talweg ${at(w, 32, 32)}`)
  const wc = wetness(CRETE, S, { radius: 8 })
  assert.ok(at(wc, 32, 32) < 0.45, `crête ${at(wc, 32, 32)}`)
  for (const v of wetness(PLAT, S, { radius: 8 })) assert.equal(v, 0.5)
})

test('wetness : un plan incliné n’est ni humide ni sec (loin des bords)', () => {
  const w = wetness(PLAN, S, { radius: 4 })
  for (let y = 12; y < S - 12; y++)
    for (let x = 12; x < S - 12; x++) assert.ok(Math.abs(at(w, x, y) - 0.5) < 0.02, `(${x},${y}) ${at(w, x, y)}`)
})

test('wetness : le rayon se déduit de metersPerPixel, borné, sans NaN', () => {
  for (const mpp of [4, 30, 1700, 0, -1, NaN, null]) {
    const w = wetness(TALWEG, S, { metersPerPixel: mpp })
    for (const v of w) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1)
  }
})

// -------------------------------------------------------------- aspectSmooth
test('aspectSmooth : un versant qui regarde le nord dépasse 0,5, le sud passe dessous', () => {
  // y croît vers le SUD : l'altitude qui MONTE vers le sud décrit un versant
  // exposé au nord
  const versantNord = field((x, y) => 100 + 6 * y)
  const versantSud = field((x, y) => 100 - 6 * y)
  const an = aspectSmooth(versantNord, S, { metersPerPixel: 30 })
  const as = aspectSmooth(versantSud, S, { metersPerPixel: 30 })
  assert.ok(at(an, 32, 32) > 0.75, `nord ${at(an, 32, 32)}`)
  assert.ok(at(as, 32, 32) < 0.25, `sud ${at(as, 32, 32)}`)
})

test('aspectSmooth : un versant est/ouest et un terrain plat restent neutres', () => {
  const versantEst = field((x) => 100 + 6 * x)
  const ae = aspectSmooth(versantEst, S, { metersPerPixel: 30 })
  assert.ok(Math.abs(at(ae, 32, 32) - 0.5) < 0.02, `est ${at(ae, 32, 32)}`)
  for (const v of aspectSmooth(PLAT, S, { metersPerPixel: 30 })) assert.equal(v, 0.5)
})

test('aspectSmooth : le flou tue le mouchetage — un bruit fin ne renverse pas l’exposition du massif', () => {
  // le versant nord PLUS un bruit haute fréquence de même ordre de grandeur :
  // sans flou, un pixel sur deux basculerait ; avec, le massif tient
  const bruite = field((x, y) => 100 + 6 * y + 9 * Math.sin(x * 2.7) * Math.cos(y * 3.1))
  const a = aspectSmooth(bruite, S, { radius: 6, metersPerPixel: 30 })
  let nord = 0
  for (let y = 12; y < S - 12; y++) for (let x = 12; x < S - 12; x++) if (at(a, x, y) > 0.5) nord++
  const total = (S - 24) * (S - 24)
  assert.ok(nord > total * 0.95, `${nord}/${total} pixels orientés nord`)
})

// ---------------------------------------------------------------- hillshade
test('hillshade : le versant tourné vers le soleil est plus clair que celui à l’ombre', () => {
  // soleil au nord-ouest par défaut : le versant NORD-OUEST reçoit, le SUD-EST subit
  const versNo = field((x, y) => 100 + 6 * x + 6 * y) // monte vers le SE ⇒ face NO
  const versSe = field((x, y) => 100 - 6 * x - 6 * y)
  const hno = hillshade(versNo, S, { metersPerPixel: 30 })
  const hse = hillshade(versSe, S, { metersPerPixel: 30 })
  assert.ok(at(hno, 32, 32) > at(hse, 32, 32), `${at(hno, 32, 32)} vs ${at(hse, 32, 32)}`)
})

test('hillshade : plat = sin(hauteur du soleil), borné, sans NaN', () => {
  const h = hillshade(PLAT, S, { metersPerPixel: 30, altitudeDeg: 45 })
  for (const v of h) {
    assert.ok(Math.abs(v - Math.sin(Math.PI / 4)) < 1e-5)
    assert.ok(v >= 0 && v <= 1)
  }
})

// -------------------------------------------------------------- packAnalysis
test('packAnalysis : aller-retour à la quantification 8 bits près', () => {
  const n = S * S
  const mk = (f) => Float32Array.from({ length: n }, (_, i) => f(i))
  const ch = {
    texShade: mk((i) => (i % 256) / 255),
    hillshade: mk((i) => ((i * 3) % 256) / 255),
    wetness: mk((i) => ((i * 7) % 256) / 255),
    aspect: mk((i) => ((i * 11) % 256) / 255),
  }
  const rgba = packAnalysis(ch, S)
  assert.equal(rgba.length, n * 4)
  const keys = ['texShade', 'hillshade', 'wetness', 'aspect']
  for (let i = 0; i < n; i++)
    for (let c = 0; c < 4; c++)
      assert.ok(Math.abs(rgba[i * 4 + c] / 255 - ch[keys[c]][i]) <= 1 / 255 + 1e-9, `pixel ${i} canal ${c}`)
})

test('packAnalysis : canal absent = neutre 0,5 (128), valeurs hors bornes clampées', () => {
  const rgba = packAnalysis({ texShade: Float32Array.from([2, -5, NaN, 0.5]) }, 2)
  assert.equal(rgba[0], 255)
  assert.equal(rgba[4], 0)
  assert.equal(rgba[8], 128) // NaN → neutre
  assert.equal(rgba[12], 128)
  for (let i = 0; i < 4; i++) for (const c of [1, 2, 3]) assert.equal(rgba[i * 4 + c], 128)
})

// ------------------------------------------------------------------ pipeline
test('analyzeDem : RGBA complète, finie, et neutre partout sur un DEM plat', () => {
  const { rgba, size } = analyzeDem({ data: PLAT, size: S, metersPerPixel: 30 })
  assert.equal(size, S)
  assert.equal(rgba.length, S * S * 4)
  for (let i = 0; i < S * S; i++) {
    assert.equal(rgba[i * 4], 128) // texture shading : plat
    assert.equal(rgba[i * 4 + 2], 128) // humidité : ni creux ni bosse
    assert.equal(rgba[i * 4 + 3], 128) // exposition : aucune
  }
})

test('analyzeDem : sur un vrai relief, le canal peigné s’écarte du neutre sans jamais déborder', () => {
  const relief = field((x, y) => 800 + 300 * Math.sin(x / 5) * Math.cos(y / 7) + 40 * Math.sin(x / 1.5))
  const { rgba } = analyzeDem({ data: relief, size: S, metersPerPixel: 30 })
  let ecart = 0
  for (let i = 0; i < S * S; i++) ecart += Math.abs(rgba[i * 4] - 128)
  assert.ok(ecart / (S * S) > 10, `écart moyen ${ecart / (S * S)}`)
  for (const v of rgba) assert.ok(v >= 0 && v <= 255 && Number.isInteger(v))
})
