import test from 'node:test'
import assert from 'node:assert/strict'
import { quantizeElevations, QUANT_LAND_MIN_M } from '../src/dem-quant.js'

// Les deux seuils que le dépôt utilise pour trancher terre/mer sur l'altitude.
// Ils sont ici en DUR, volontairement : si quelqu'un les déplace ailleurs, ces
// tests doivent tomber et forcer à revérifier la quantification.
const SEUIL_ZONE = 0.3 // region-mask.js LAND_MIN_ELEV_M
const SEUIL_MER = 0.5 // sea-mask.js seaLevelM

test('quantizeElevations rend un Int16Array de même longueur', () => {
  const out = quantizeElevations(Float32Array.from([1.2, -3.7, 0]))
  assert.ok(out instanceof Int16Array)
  assert.equal(out.length, 3)
})

test('arrondi au mètre le plus proche, demi vers le HAUT (vers la terre)', () => {
  const out = quantizeElevations(Float32Array.from([1.2, 1.8, -1.2, -1.8, 2.5, -2.5]))
  assert.deepEqual([...out], [1, 2, -1, -2, 3, -2])
})

test("l'écart au champ d'origine ne dépasse jamais 1 m", () => {
  const src = new Float32Array(20000)
  for (let i = 0; i < src.length; i++) src[i] = (Math.random() - 0.35) * 6000
  const out = quantizeElevations(src)
  for (let i = 0; i < src.length; i++) assert.ok(Math.abs(out[i] - src[i]) <= 1, `écart à l'index ${i}`)
})

// ── LA RÈGLE, celle de src/bathy.js : la terre ne bouge jamais ───────────────

test('un pixel de TERRE ne peut jamais redescendre en mer', () => {
  // toute la bande fatale : aucun ENTIER ne vit dans (0,3 ; 0,5]
  const src = Float32Array.from([0.301, 0.35, 0.4, 0.45, 0.499, 0.5, 0.7])
  const out = quantizeElevations(src)
  for (let i = 0; i < src.length; i++) {
    assert.ok(src[i] > SEUIL_ZONE, 'le cas de test doit être de la terre')
    assert.ok(out[i] > SEUIL_ZONE, `${src[i]} m est devenu ${out[i]} m — la côte a bougé`)
    assert.ok(out[i] >= SEUIL_MER, `${src[i]} m repasse sous le seuil de mer`)
  }
})

test('un pixel de MER ne peut jamais émerger', () => {
  // ⚠️ PAS de 0,3 pile dans ce jeu d'essai, et ce n'est pas un oubli : 0,3
  // n'est pas représentable en Float32, où il vaut 0,300000011… — donc
  // STRICTEMENT au-dessus du seuil. `region-mask.js` lit lui aussi un Float32
  // et le classe déjà TERRE aujourd'hui. Exiger l'inverse ici testerait une
  // règle que l'application n'applique pas.
  const src = Float32Array.from([0.29, 0.25, 0.1, 0, -0.05, -0.4, -0.5, -12])
  const out = quantizeElevations(src)
  for (let i = 0; i < src.length; i++) {
    assert.ok(src[i] <= SEUIL_ZONE, 'le cas de test doit être de la mer')
    assert.ok(out[i] <= SEUIL_ZONE, `${src[i]} m est devenu ${out[i]} m — la mer a émergé`)
  }
})

test('LA RÈGLE, sur un champ aléatoire : la classification terre/mer ne perd jamais de terre', () => {
  const src = new Float32Array(200000)
  // resserré autour de zéro : c'est là, et seulement là, que le camp se joue
  for (let i = 0; i < src.length; i++) src[i] = (Math.random() - 0.5) * 4
  const out = quantizeElevations(src)
  for (let i = 0; i < src.length; i++) {
    // seuil de zone (region-mask) : préservé DANS LES DEUX SENS
    assert.equal(src[i] > SEUIL_ZONE, out[i] > SEUIL_ZONE, `zone : ${src[i]} → ${out[i]}`)
    // seuil de mer (sea-mask) : la terre reste terre, sans exception
    if (src[i] >= SEUIL_MER) assert.ok(out[i] >= SEUIL_MER, `mer : ${src[i]} → ${out[i]}`)
    // …et la SEULE exception tolérée dans l'autre sens est la bande fatale,
    // que le garde-fou terrestrialise exprès. Nulle part ailleurs.
    if (src[i] < SEUIL_MER && out[i] >= SEUIL_MER) assert.ok(src[i] > SEUIL_ZONE, `hors bande : ${src[i]} → ${out[i]}`)
  }
})

test('le garde-fou ne coûte 1 m QU’À la bande fatale, jamais ailleurs', () => {
  const src = new Float32Array(50000)
  for (let i = 0; i < src.length; i++) src[i] = (Math.random() - 0.35) * 6000
  const out = quantizeElevations(src)
  for (let i = 0; i < src.length; i++) {
    const dansLaBande = src[i] > QUANT_LAND_MIN_M && src[i] < 0.5
    if (!dansLaBande) assert.ok(Math.abs(out[i] - src[i]) <= 0.5, `écart hors bande à ${src[i]}`)
    else assert.equal(out[i], 1)
  }
})

// ── les bords ────────────────────────────────────────────────────────────────

test('les altitudes hors de portée de l’Int16 sont bornées, pas repliées', () => {
  const out = quantizeElevations(Float32Array.from([1e9, -1e9, 40000, -40000]))
  assert.deepEqual([...out], [32767, -32768, 32767, -32768])
})

test('un NaN devient zéro — une absence de mesure, pas une fosse', () => {
  const out = quantizeElevations(Float32Array.from([NaN, Infinity, -Infinity]))
  assert.equal(out[0], 0)
  assert.equal(out[1], 32767)
  assert.equal(out[2], -32768)
})

test('un champ déjà Int16 ressort inchangé, sans nouvelle allocation inutile', () => {
  const src = Int16Array.from([3, -7, 0])
  const out = quantizeElevations(src)
  assert.deepEqual([...out], [3, -7, 0])
})

test('quantizeElevations est idempotente', () => {
  const src = new Float32Array(5000)
  for (let i = 0; i < src.length; i++) src[i] = (Math.random() - 0.35) * 6000
  const a = quantizeElevations(src)
  const b = quantizeElevations(Float32Array.from(a))
  assert.deepEqual([...a], [...b])
})

test('un champ nul ou vide ne fait pas tomber la fonction', () => {
  assert.equal(quantizeElevations(null), null)
  assert.equal(quantizeElevations(new Float32Array(0)).length, 0)
})
