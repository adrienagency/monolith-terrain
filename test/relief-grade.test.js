import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeForDem, elevationHistogram, quantileFromHistogram, NEUTRAL_GRADE } from '../src/relief-grade.js'

// ---------------------------------------------------------------- fabriques
// Un faux DEM : `gen(i)` rend une altitude en mètres. On en tire min/max/mean
// et l'histogramme, exactement comme fetchAndBuildDem le fait sur le vrai.
function fakeDem(n, gen, extentM) {
  const data = new Float32Array(n)
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < n; i++) {
    const v = gen(i, n)
    data[i] = v
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const minM = min, maxM = max
  return { data, minM, maxM, meanM: sum / n, extentM, histogram: elevationHistogram(data, minM, maxM) }
}
const grade = (d) => gradeForDem({ minM: d.minM, maxM: d.maxM, meanM: d.meanM, histogram: d.histogram, extentM: d.extentM })

// Massif alpin : 400 → 4400 m, distribution large (beaucoup de versants)
const ALPES = fakeDem(20000, (i, n) => 400 + 4000 * Math.pow(i / n, 1.3), 22000)
// Delta plat : −2 → 28 m, l'écrasante majorité entre 0 et 4 m (quelques digues)
const DELTA = fakeDem(20000, (i, n) => (i / n < 0.94 ? -2 + 6 * (i / n) / 0.94 : 4 + 24 * ((i / n - 0.94) / 0.06)), 22000)
// Île volcanique dans un océan profond : −5000 → 4000, 70 % sous l'eau
const ILE = fakeDem(20000, (i, n) => (i / n < 0.7 ? -5000 + 5000 * (i / n) / 0.7 : 4000 * ((i / n - 0.7) / 0.3)), 40000)

// ---------------------------------------------------------- invariants durs
test('gradeForDem reste dans les plages des curseurs de l’UI', () => {
  for (const d of [ALPES, DELTA, ILE]) {
    const g = grade(d)
    assert.ok(g.mapTint >= 0 && g.mapTint <= 1, `mapTint ${g.mapTint}`)
    assert.ok(g.heightContrast >= 0.5 && g.heightContrast <= 20, `heightContrast ${g.heightContrast}`)
    assert.ok(g.heightPivot >= 0 && g.heightPivot <= 1, `heightPivot ${g.heightPivot}`)
    assert.ok(g.slopeTint >= 0 && g.slopeTint <= 1, `slopeTint ${g.slopeTint}`)
    for (const v of Object.values(g)) assert.ok(Number.isFinite(v))
  }
})

test('un DEM dégénéré (plat parfait / vide) retombe sur le repli neutre', () => {
  assert.deepEqual(gradeForDem({ minM: 12, maxM: 12, meanM: 12 }), { ...NEUTRAL_GRADE })
  assert.deepEqual(gradeForDem({}), { ...NEUTRAL_GRADE })
  assert.deepEqual(gradeForDem({ minM: NaN, maxM: 3, meanM: 1 }), { ...NEUTRAL_GRADE })
})

// ---------------------------------------------------------- la règle métier
test('relief plat = contraste PLUS FORT que la haute montagne', () => {
  // sinon le delta se peint en aplat uniforme et les Alpes saturent en deux tons
  assert.ok(
    grade(DELTA).heightContrast > grade(ALPES).heightContrast * 1.5,
    `delta ${grade(DELTA).heightContrast} vs alpes ${grade(ALPES).heightContrast}`
  )
})

test('le pivot se cale sur la médiane du relief ÉMERGÉ', () => {
  // Alpes : pas de mer, médiane ≈ 400 + 4000×0.5^1.3 = 2027 m → hNorm ≈ 0.41
  const g = grade(ALPES)
  assert.ok(Math.abs(g.heightPivot - 0.41) < 0.04, `pivot alpes ${g.heightPivot}`)
  // Île : les terres n'occupent que le haut de la plage (−5000..4000), le pivot
  // DOIT monter au-dessus du niveau de la mer normalisé (5000/9000 = 0.556)
  const gi = grade(ILE)
  assert.ok(gi.heightPivot > 0.556, `pivot île ${gi.heightPivot} sous le rivage`)
  // Delta : la matière est en bas de la plage → pivot bas
  assert.ok(grade(DELTA).heightPivot < 0.3, `pivot delta ${grade(DELTA).heightPivot}`)
})

test('la rampe déploie ses teintes là où il y a de la matière', () => {
  // la fenêtre utile du shader est [pivot − 0.5/C, pivot + 0.5/C] en hNorm ;
  // elle doit contenir la médiane et rester dans [0, 1] pour chaque relief
  for (const [name, d] of [['alpes', ALPES], ['delta', DELTA], ['ile', ILE]]) {
    const g = grade(d)
    const half = 0.5 / g.heightContrast
    assert.ok(g.heightPivot - half < g.heightPivot && half > 0.03, `${name}: fenêtre trop étroite`)
    assert.ok(half < 0.5, `${name}: fenêtre plus large que la plage entière`)
  }
})

test('ombrage des pentes et teinte hypsométrique suivent la pente moyenne', () => {
  const a = grade(ALPES), d = grade(DELTA)
  assert.ok(a.slopeTint > d.slopeTint, `pentes: alpes ${a.slopeTint} vs delta ${d.slopeTint}`)
  // sur un plat la rampe est SEULE à parler → teinte plus forte
  assert.ok(d.mapTint > a.mapTint, `teinte: delta ${d.mapTint} vs alpes ${a.mapTint}`)
})

// --------------------------------------------------- histogramme & quantiles
test('elevationHistogram compte tout le DEM et respecte les bornes', () => {
  const h = elevationHistogram(ALPES.data, ALPES.minM, ALPES.maxM, 64)
  assert.equal(h.length, 64)
  assert.equal(h.reduce((s, v) => s + v, 0), ALPES.data.length)
  assert.equal(elevationHistogram(new Float32Array(0), 0, 1).reduce((s, v) => s + v, 0), 0)
  assert.equal(elevationHistogram(ALPES.data, 5, 5).reduce((s, v) => s + v, 0), 0) // plage nulle
})

test('quantileFromHistogram ignore ce qui est sous le plancher', () => {
  // rampe uniforme −100..100 : la médiane globale ≈ 0, celle des « terres » ≈ 50
  const d = fakeDem(10000, (i, n) => -100 + 200 * (i / n), 1000)
  const all = quantileFromHistogram(d.histogram, d.minM, d.maxM, 0.5)
  const land = quantileFromHistogram(d.histogram, d.minM, d.maxM, 0.5, 0)
  assert.ok(Math.abs(all - 0) < 3, `médiane globale ${all}`)
  assert.ok(Math.abs(land - 50) < 3, `médiane émergée ${land}`)
  // aucun pixel au-dessus du plancher → null (l'appelant choisit son repli)
  assert.equal(quantileFromHistogram(d.histogram, d.minM, d.maxM, 0.5, 500), null)
})

// ------------------------------------------------------------- sans histogramme
test('sans histogramme, le repli en loi puissance reste cohérent', () => {
  for (const d of [ALPES, DELTA, ILE]) {
    const withH = grade(d)
    const without = gradeForDem({ minM: d.minM, maxM: d.maxM, meanM: d.meanM, extentM: d.extentM })
    for (const v of Object.values(without)) assert.ok(Number.isFinite(v))
    // même famille de réglage : le pivot ne doit pas partir à l'opposé
    assert.ok(Math.abs(without.heightPivot - withH.heightPivot) < 0.35, `pivot ${without.heightPivot} vs ${withH.heightPivot}`)
    // les deux réglages « matière » ne dépendent que de l'amplitude → identiques
    assert.equal(without.mapTint, withH.mapTint)
    assert.equal(without.slopeTint, withH.slopeTint)
  }
  // et l'ordre plat/montagne tient toujours
  const flat = gradeForDem({ minM: DELTA.minM, maxM: DELTA.maxM, meanM: DELTA.meanM, extentM: DELTA.extentM })
  const alps = gradeForDem({ minM: ALPES.minM, maxM: ALPES.maxM, meanM: ALPES.meanM, extentM: ALPES.extentM })
  assert.ok(flat.heightContrast > alps.heightContrast, `${flat.heightContrast} vs ${alps.heightContrast}`)
})

test('deux reliefs contrastés ne partagent JAMAIS le même réglage', () => {
  assert.notDeepEqual(grade(ALPES), grade(DELTA))
  assert.notDeepEqual(grade(ALPES), grade(ILE))
})
