// ═══════════════════════════════════════════════════════════════════════════
// LISS — LE LISSAGE DE L'ABYSSE, ET LES TROIS INTERDITS QUI LE BORNENT.
//
// B6 a mesuré et tranché : le peigne qu'Adrien filme sur la mer n'est PAS un
// bogue, c'est la lignéation propre de GEBCO (25 à 97 m de pic-à-pic dans le
// fichier BRUT, contre 1,00 m de pas d'encodage). Adrien a arbitré : lisser le
// relief sous-marin PROFOND, en laissant intacts le trait de côte et les
// hauts-fonds.
//
// CE FICHIER VERROUILLE LES DEUX MOITIÉS :
//   ① la règle MORD — un striage abyssal synthétique est effacé ;
//   ⛔ ② ELLE NE MORD NULLE PART AILLEURS — au-dessus de −500 m la sortie est
//     l'entrée AU BIT, aucun pixel ne remonte, aucun ne change de côté, et une
//     maille trop grossière éteint la règle entièrement.
//
// ⚠️ ET DEUX TESTS DE MUTATION, qui passeront au ROUGE le jour où l'on croira
// pouvoir simplifier :
//   · SANS le seuil de profondeur, le même filtre MANGE un lagon — c'est le
//     seuil, et lui seul, qui sépare « lisser l'abysse » d'« effacer le récif » ;
//   · un rayon de 2 px ne suffit PAS au critère, ce qui est la raison d'être du
//     plancher `RAYON_ABYSSE_MIN_PX` : à r < 3 on retire du relief sans rien
//     gagner.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ABYSSE_M,
  ABYSSE_FONDU_M,
  RAYON_ABYSSE_M,
  RAYON_ABYSSE_MIN_PX,
  lisseAbysse,
  rayonAbyssePx,
} from '../src/bathy.js'

const N = 64
// une plaine abyssale à −3 500 m, striée d'une bande sur deux à ±40 m — l'ordre
// de grandeur que B6 a mesuré dans GEBCO (25 à 97 m de pic-à-pic).
function plaineStriee(fond = -3500, amp = 40, n = N) {
  const d = new Float32Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    d[y * n + x] = fond + (x % 2 ? amp : -amp) + (y % 2 ? amp : -amp)
  }
  return d
}
// pic-à-pic BANDE À BANDE d'une projection : l'écart d'une bande à la moyenne
// de ses deux voisines. C'est la grandeur du critère (rapport-LISS §③).
function striage(m, n = N) {
  const col = new Float64Array(n), lig = new Float64Array(n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { col[x] += m[y * n + x] / n; lig[y] += m[y * n + x] / n }
  const pp = (a) => {
    let mn = Infinity, mx = -Infinity
    for (let i = 1; i < a.length - 1; i++) { const v = a[i] - (a[i - 1] + a[i + 1]) / 2; if (v < mn) mn = v; if (v > mx) mx = v }
    return mx - mn
  }
  return Math.max(pp(col), pp(lig))
}

// ─────────────────────────────────── ① LA RÈGLE MORD

test('LISS ① le striage abyssal tombe SOUS le critère de 5 m', () => {
  const d = plaineStriee()
  assert.ok(striage(d) > 100, `le banc doit striper franchement (${striage(d)})`)
  lisseAbysse(d, N, { radius: 5 })
  assert.ok(striage(d) <= 5, `striage résiduel ${striage(d)} m, attendu ≤ 5`)
})

test('LISS ① le fond MOYEN est conservé — on lisse, on ne creuse pas', () => {
  const d = plaineStriee()
  const avant = d.reduce((s, v) => s + v, 0) / d.length
  lisseAbysse(d, N, { radius: 5 })
  const apres = d.reduce((s, v) => s + v, 0) / d.length
  assert.ok(Math.abs(apres - avant) < 1, `fond moyen ${avant} → ${apres}`)
})

// ─────────────────────────── ⛔ ② LES TROIS INTERDITS

test('⛔ INTERDIT 1 — un pixel ÉMERGÉ sort AU BIT', () => {
  const d = plaineStriee()
  // une côte : la moitié gauche est de la terre, jusqu'à +900 m
  for (let y = 0; y < N; y++) for (let x = 0; x < N / 2; x++) d[y * N + x] = 5 + x * 30
  const avant = Float32Array.from(d)
  lisseAbysse(d, N, { radius: 5 })
  for (let y = 0; y < N; y++) for (let x = 0; x < N / 2; x++) {
    assert.equal(d[y * N + x], avant[y * N + x], `pixel de terre ${x},${y} déplacé`)
  }
})

test('⛔ INTERDIT 2 — TOUT pixel au-dessus de −500 m sort AU BIT (lagon, récif, plateau)', () => {
  const d = new Float32Array(N * N)
  // un lagon à −3 m, un récif à −0,5 m, un plateau continental à −180 m, et une
  // bordure d'abysse strié à −3 500 m
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x
    d[i] = x < 16 ? -3 - (x % 3) : x < 24 ? -0.5 : x < 40 ? -180 + (x % 5) : -3500 + (x % 2 ? 40 : -40)
  }
  const avant = Float32Array.from(d)
  lisseAbysse(d, N, { radius: 5 })
  let bouges = 0
  for (let i = 0; i < d.length; i++) if (avant[i] >= -ABYSSE_M && d[i] !== avant[i]) bouges++
  assert.equal(bouges, 0, 'un haut-fond a bougé')
  // et l'abysse, lui, a bien été lissé : la règle n'est pas éteinte par erreur
  let abysseBouge = 0
  for (let i = 0; i < d.length; i++) if (avant[i] < -ABYSSE_M && d[i] !== avant[i]) abysseBouge++
  assert.ok(abysseBouge > 0, "l'abysse doit être lissé")
})

test('⛔ INTERDIT 3 — aucun pixel ne remonte au-dessus du seuil, ni ne change de côté', () => {
  // le pire cas : un pixel à peine sous le seuil, entouré de 4 500 m de fond
  const d = new Float32Array(N * N).fill(-4500)
  d[32 * N + 32] = -ABYSSE_M - 0.01
  for (let y = 28; y < 36; y++) for (let x = 28; x < 36; x++) d[y * N + x] = -ABYSSE_M - 0.01
  lisseAbysse(d, N, { radius: 5 })
  for (let i = 0; i < d.length; i++) {
    assert.ok(d[i] < -ABYSSE_M, `pixel ${i} remonté à ${d[i]} m`)
    assert.ok(d[i] < 0, `pixel ${i} passé du côté de la terre`)
  }
})

// ────────────────────────── ⛔ LES GARDES DE L'APPELANT

test('⛔ une maille trop GROSSIÈRE éteint la règle — sortie AU BIT', () => {
  // z4 à l'équateur : 9 784 m de maille, le rayon au sol n'y fait même pas 1 px
  assert.equal(rayonAbyssePx(9784), 0)
  const d = plaineStriee()
  const avant = Float32Array.from(d)
  lisseAbysse(d, N, { mailleM: 9784 })
  assert.deepEqual(d, avant, 'une tuile de plancher a été lissée')
})

test('⛔ un rayon SOUS le plancher de 3 px éteint la règle — c’est un refus, pas un arrondi', () => {
  // 2 900 / 1 200 = 2 px : au-dessus de zéro, mais sous le plancher
  assert.equal(Math.floor(RAYON_ABYSSE_M / 1200), 2)
  assert.equal(rayonAbyssePx(1200), 0)
  const d = plaineStriee()
  const avant = Float32Array.from(d)
  lisseAbysse(d, N, { mailleM: 1200 })
  assert.deepEqual(d, avant)
})

test('⛔ maille absente, nulle ou non finie ⇒ comportement d’avant, AU BIT', () => {
  for (const maille of [undefined, null, 0, -5, NaN, Infinity, 'oui']) {
    const d = plaineStriee()
    const avant = Float32Array.from(d)
    lisseAbysse(d, N, { mailleM: maille })
    assert.deepEqual(d, avant, `maille ${String(maille)}`)
  }
})

test('⛔ une grille non carrée ou trop petite sort AU BIT', () => {
  const d = plaineStriee()
  const avant = Float32Array.from(d)
  lisseAbysse(d, N + 1, { radius: 5 }) // taille annoncée ≠ N², on refuse
  assert.deepEqual(d, avant)
  const p = new Float32Array(4).fill(-3000)
  assert.deepEqual(Array.from(lisseAbysse(p, 2, { radius: 5 })), [-3000, -3000, -3000, -3000])
})

test('une valeur NON FINIE (case non peinte) ne contamine pas ses voisines', () => {
  const d = plaineStriee()
  d[10 * N + 10] = NaN
  lisseAbysse(d, N, { radius: 5 })
  assert.ok(Number.isNaN(d[10 * N + 10]), 'la case non peinte doit rester non peinte')
  for (let i = 0; i < d.length; i++) {
    if (i === 10 * N + 10) continue
    assert.ok(Number.isFinite(d[i]), `NaN propagé en ${i}`)
  }
})

// ────────────────────────── ⚠️ LA DÉRIVATION, GELÉE

test('la dérivation du seuil est celle du tuileur : |SHELF| = 500 m', () => {
  assert.equal(ABYSSE_M, 500)
  assert.equal(ABYSSE_FONDU_M, 500)
})

test('la TRANSITION est étalée en ESPACE, pas seulement en profondeur', () => {
  // ⚡ C'EST LE CORRECTIF ③ DE L'ENCART 🟣 LISS, ET IL EST TESTABLE.
  // Le même pixel, à la même profondeur (−600 m, juste sous le seuil), une fois
  // au bord d'un TALUS (voisinage à −100 m, hors lissage) et une fois au milieu
  // de l'abysse. Avec `k` seul il bougerait pareil dans les deux cas — c'est ce
  // qui dessinait le liseré en escalier autour du plateau de Rodrigues. Avec
  // `k · wB`, le voisinage éteint la correction au talus.
  const f = (voisin) => {
    const d = new Float32Array(N * N)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) d[y * N + x] = x < N / 2 ? voisin : -4000
    for (let y = 0; y < N; y++) d[y * N + N / 2 - 1] = -600
    const avant = Float32Array.from(d)
    lisseAbysse(d, N, { radius: 5 })
    return Math.abs(d[32 * N + N / 2 - 1] - avant[32 * N + N / 2 - 1])
  }
  const auTalus = f(-100)   // voisinage de plateau : hors lissage
  const enAbysse = f(-4000) // voisinage entièrement abyssal
  assert.ok(
    auTalus < enAbysse / 3,
    `au talus ${auTalus.toFixed(1)} m, en abysse ${enAbysse.toFixed(1)} m — la porte spatiale ne mord plus`,
  )
})

test('le rayon est une LONGUEUR AU SOL — il suit la maille, pas le zoom', () => {
  // z8 à l'équateur (611 m) et à 60°N (306 m) : même longueur au sol, pas le
  // même nombre de pixels. C'est ce qui rend le lissage identique partout.
  assert.equal(rayonAbyssePx(611), 4)
  assert.equal(rayonAbyssePx(306), 9)
  assert.ok(RAYON_ABYSSE_MIN_PX === 3)
})

// ────────────────────────── ⚠️ LES DEUX MUTATIONS

test('MUTATION — SANS le seuil de profondeur, le lissage MANGE le lagon', () => {
  // ⚡ CE TEST GÈLE L'INTERDIT 2. Le même champ, le même rayon, le même filtre —
  // seul le seuil change. Il est le seul rempart entre « lisser l'abysse » et
  // « effacer le récif », et il doit se voir.
  const d = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // un lagon dentelé : des patates à −2 m au milieu d'un platier à −25 m
    d[y * N + x] = (x + y) % 5 === 0 ? -2 : -25
  }
  const bon = Float32Array.from(d)
  lisseAbysse(bon, N, { radius: 5 })
  assert.deepEqual(bon, d, 'avec le seuil, le lagon sort AU BIT')

  const mange = Float32Array.from(d)
  lisseAbysse(mange, N, { radius: 5, seuilM: 1, fonduM: 1 })
  let bouges = 0
  for (let i = 0; i < d.length; i++) if (mange[i] !== d[i]) bouges++
  assert.ok(bouges > d.length / 2, `sans le seuil, ${bouges} pixels de lagon devraient bouger`)
  // et le relief du lagon serait ÉCRASÉ : l'écart type s'effondre
  const sd = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) }
  assert.ok(sd(mange) < sd(d) / 5, `relief du lagon ${sd(d).toFixed(2)} → ${sd(mange).toFixed(2)} m`)
})

test('MUTATION — un rayon de 2 px ne suffit PAS au critère de 5 m', () => {
  // C'est pour ça que le plancher de rayon est un REFUS et pas un arrondi : à
  // r=2 on retire déjà du relief, et on est encore au-dessus du critère.
  const d = plaineStriee()
  lisseAbysse(d, N, { radius: 2 })
  assert.ok(striage(d) > 5, `r=2 rendrait ${striage(d)} m — si ce test passe au vert, le plancher n'a plus de raison d'être`)
})
