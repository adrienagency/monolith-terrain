// LE GRAIN FBM EST MÉMORISABLE, ET IL COÛTE 90 % DE L'ÉCHANTILLONNAGE.
//
// _makeDemSampler ajoute 5 octaves de simplex par sommet. Mesuré à res 1024 :
// 194 ms d'échantillonnage dont **175 ms de bruit**, pour une amplitude de
// 0,19 px CSS en moyenne au réglage par défaut (detail 0,02). Or ce bruit ne
// dépend NI du MNT, NI du zoom, NI de l'exagération, NI de la palette —
// seulement de seed, detailScale, résolution et taille du bloc.
//
// ⚠️ CE FICHIER NE SUPPOSE PAS L'INVARIANCE, IL LA PROUVE : le dernier test
// rejoue la formule exacte de _makeDemSampler sur plusieurs exagérations,
// plusieurs altitudes moyennes et plusieurs valeurs de `detail`, et vérifie
// que le MÊME champ mémorisé (même objet, identité stricte) donne à chaque
// fois un résultat BIT-IDENTIQUE au calcul direct.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Simplex2, mulberry32, fbm, smoothstep } from '../src/noise.js'
import { sampleDem } from '../src/dem.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detailField, clearDetailField, grainSamplesPerCycle, GRAIN_MIN_SAMPLES } from '../src/detail-noise.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// les deux octaves telles que _makeDemSampler les calcule, sans dosage
function reference(seed, detailScale, res, size = TERRAIN_SIZE) {
  const s = new Simplex2(mulberry32(seed))
  const n = res + 1
  const out = new Float64Array(n * n * 2)
  const half = size / 2
  const seg = size / res
  for (let iy = 0; iy < n; iy++) {
    const z = iy * seg - half
    for (let ix = 0; ix < n; ix++) {
      const x = ix * seg - half
      const k = (iy * n + ix) * 2
      out[k] = fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55)
      out[k + 1] = fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5)
    }
  }
  return out
}

for (const res of [16, 33]) {
  test(`detailField ${res} reproduit exactement les deux octaves de _makeDemSampler`, () => {
    clearDetailField()
    const got = detailField(1, 0.8, res, TERRAIN_SIZE)
    const want = reference(1, 0.8, res)
    assert.equal(got.length, want.length)
    for (let i = 0; i < want.length; i++) assert.equal(got[i], want[i], `valeur ${i}`)
  })
}

// ⚠️ Float64 et pas Float32 : le champ est relu en double dans
// `detail·a + detail·0,35·b`. Un cache en Float32 arrondirait a et b AVANT la
// somme et ferait bouger le résultat sur 100 % des sommets (mesuré) — deux fois
// moins de mémoire, mais plus d'identité bit à bit, donc plus de garantie.
test('le champ est en double précision — sinon l’identité bit à bit tombe', () => {
  clearDetailField()
  assert.equal(detailField(1, 0.8, 8, TERRAIN_SIZE).constructor, Float64Array)
})

test('un seed différent donne un champ différent', () => {
  clearDetailField()
  const a = Float64Array.from(detailField(1, 0.8, 16, TERRAIN_SIZE))
  const b = detailField(2, 0.8, 16, TERRAIN_SIZE)
  assert.notEqual(a[5], b[5])
})

test('la mémorisation rend le MÊME tableau pour la même clé', () => {
  clearDetailField()
  assert.equal(detailField(1, 0.8, 16, TERRAIN_SIZE), detailField(1, 0.8, 16, TERRAIN_SIZE))
})

test('changer detailScale invalide le cache', () => {
  clearDetailField()
  assert.notEqual(detailField(1, 0.8, 16, TERRAIN_SIZE), detailField(1, 3, 16, TERRAIN_SIZE))
})

test('changer la résolution invalide le cache', () => {
  clearDetailField()
  const a = detailField(1, 0.8, 16, TERRAIN_SIZE)
  const b = detailField(1, 0.8, 32, TERRAIN_SIZE)
  assert.notEqual(a, b)
  assert.equal(b.length, 33 * 33 * 2)
})

test('changer la taille du bloc invalide le cache', () => {
  clearDetailField()
  assert.notEqual(detailField(1, 0.8, 16, TERRAIN_SIZE), detailField(1, 0.8, 16, TERRAIN_SIZE * 2))
})

// ---------------------------------------------------------------------------
// LA PREUVE D'INVARIANCE
// ---------------------------------------------------------------------------
// Un MNT synthétique en dôme, qui traverse le niveau de la mer : le facteur
// côtier smoothstep(0, 90, raw) est donc réellement exercé (0, partiel, 1).
function demBidon(size) {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1
      const dy = (y / (size - 1)) * 2 - 1
      data[y * size + x] = 1800 * Math.max(0, 1 - Math.hypot(dx, dy)) - 40
    }
  }
  return { data, size, extentMeters: 32000, meanM: 610, minM: -40 }
}

test('le champ mémorisé survit à l’exagération, au zoom et au curseur de détail — bit à bit', () => {
  clearDetailField()
  const res = 24
  const n = res + 1
  const seg = TERRAIN_SIZE / res
  const half = TERRAIN_SIZE / 2
  const seed = 1
  const detailScale = 0.8
  const dem = demBidon(96)

  // un seul champ pour TOUTES les combinaisons ci-dessous : c'est ça, l'invariance
  const champ = detailField(seed, detailScale, res, TERRAIN_SIZE)
  const s = new Simplex2(mulberry32(seed))

  // exagération (curseur relief), extentMeters (changement de zoom), detail
  // (curseur de finesse + bridage du mode Naturel)
  const cas = [
    { exag: 2.8, extent: 32000, detail: 0.02 },
    { exag: 1.0, extent: 32000, detail: 0.02 },
    { exag: 5.5, extent: 32000, detail: 0.02 },
    { exag: 2.8, extent: 8000, detail: 0.02 }, // zoom plus fin
    { exag: 2.8, extent: 32000, detail: 0.55 }, // préréglage « Fin »
    { exag: 2.8, extent: 32000, detail: 0.15 }, // plafond du mode Naturel
  ]

  for (const c of cas) {
    assert.equal(detailField(seed, detailScale, res, TERRAIN_SIZE), champ, 'le champ doit être RÉUTILISÉ, pas recuit')
    const scale = (TERRAIN_SIZE / c.extent) * c.exag
    const { size, meanM } = dem
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iy * n + ix
        const x = ix * seg - half
        const z = iy * seg - half
        const px = (x / TERRAIN_SIZE + 0.5) * (size - 1)
        const py = (z / TERRAIN_SIZE + 0.5) * (size - 1)
        const raw = sampleDem(dem, px, py)
        const h = (raw - meanM) * scale
        const landFactor = smoothstep(0, 90, raw)
        // la formule EXACTE de _makeDemSampler (terrain.js) — ne pas la
        // « simplifier » : detail·(a + 0,35·b) n'est PAS bit-identique à
        // detail·a + detail·0,35·b (mesuré : 48 % des sommets diffèrent)
        const direct =
          h +
          landFactor *
            (c.detail * fbm(s, x * detailScale, z * detailScale, 3, 2.3, 0.55) +
              c.detail * 0.35 * fbm(s, x * detailScale * 4.1 + 31, z * detailScale * 4.1 - 17, 2, 2.2, 0.5))
        const cuit = h + landFactor * (c.detail * champ[i * 2] + c.detail * 0.35 * champ[i * 2 + 1])
        assert.equal(cuit, direct, `sommet (${ix},${iy}) — exag ${c.exag}, extent ${c.extent}, detail ${c.detail}`)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// LE COUPLAGE RÉSOLUTION ↔ FINESSE DU GRAIN, VERROUILLÉ
// ---------------------------------------------------------------------------
// Ce test lit les valeurs RÉELLES de main.js. Il casse le jour où quelqu'un
// baisse la résolution du bloc central sans baisser `detailScale` — c'est
// exactement ce qu'on veut savoir, parce que le grain devient alors sous-
// échantillonné et scintille au moindre mouvement de caméra, sans qu'aucun
// autre test ne s'en aperçoive.
test('main.js : la résolution du bloc central ne descend pas sous le grain', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const res = Number(/^\s*resolution:\s*(\d+),/m.exec(src)?.[1])
  const ds = Number(/^\s*detailScale:\s*([\d.]+),/m.exec(src)?.[1])
  assert.ok(Number.isFinite(res) && Number.isFinite(ds), 'resolution / detailScale introuvables dans main.js')
  const pas = grainSamplesPerCycle(res, ds, TERRAIN_SIZE)
  assert.ok(
    pas >= GRAIN_MIN_SAMPLES,
    `res ${res} + detailScale ${ds} ne laissent que ${pas.toFixed(2)} mailles par longueur d'onde ` +
      `de l'octave la plus fine (plancher mesuré ${GRAIN_MIN_SAMPLES}). Le grain sera aliasé. ` +
      `Correctif : diviser detailScale dans le même rapport que la résolution — ` +
      `detailScale ≈ ${(ds * (res / 768)).toFixed(3)} pour res ${res}.`,
  )
})

test('grainSamplesPerCycle : le critère suit bien res / detailScale', () => {
  // moitié moins de mailles ET grain deux fois plus gros = même finesse relative
  assert.equal(
    grainSamplesPerCycle(768, 0.8, TERRAIN_SIZE).toFixed(6),
    grainSamplesPerCycle(384, 0.4, TERRAIN_SIZE).toFixed(6),
  )
  // les valeurs mesurées de l'entête du module
  assert.equal(grainSamplesPerCycle(1024, 0.8, TERRAIN_SIZE).toFixed(2), '2.53')
  assert.equal(grainSamplesPerCycle(768, 0.8, TERRAIN_SIZE).toFixed(2), '1.90')
  assert.equal(grainSamplesPerCycle(512, 0.8, TERRAIN_SIZE).toFixed(2), '1.27')
})
