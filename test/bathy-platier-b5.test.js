// ═══════════════════════════════════════════════════════════════════════════
// B5 — LE PLATIER N'EST PAS DE LA TERRE : quand la référence est MUETTE, la
// source fine parle ENTIÈRE, même à −1 m.
//
// Mesuré (îles d'Hyères, Marseille, damier z12/z13, `scripts/sonde-b5.mjs`) :
// 77 000 à 300 000 pixels par bloc EXACTEMENT à 0 après fusion — tous issus
// d'un terrarium muet (0) et d'un platier EMODnet à −1…−4 m. Le fondu
// `t = smooth(|deep| / 25)` pondérait la source fine à 0,5 % à −1 m : out ≈
// −0,005 m, arrondi Int16 → 0 → classé TERRE par le nuanceur (`h < 0` faux).
// À l'écran : des plateaux couleur terre, en escalier de pixels EMODnet (115 m),
// qui débordent le vrai trait de côte. L'erreur en mètres est minuscule ; le
// défaut visuel est une île entourée d'un socle.
// ═══════════════════════════════════════════════════════════════════════════
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fuseBathymetry } from '../src/bathy.js'

const f32 = (a) => Float32Array.from(a)

test('B5 · référence muette (0 exact) : un platier à −1 m sort à −1 m, pas à −0,005', () => {
  const land = f32([0, 0, 0, 0])
  const sea = f32([-1, -2, -4, -8])
  const out = fuseBathymetry(land, sea)
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(out[i] - sea[i]) < 0.01,
      `platier ${sea[i]} m rendu ${out[i]} m — la source fine est muselée par le fondu`)
  }
})

test('B5 · référence muette : aucun pixel de mer fine ne ressort à |h| < 0,5 m (il serait arrondi à 0 = terre)', () => {
  const n = 200
  const land = new Float32Array(n) // 0 partout : muet
  const sea = new Float32Array(n)
  for (let i = 0; i < n; i++) sea[i] = -0.5 - (i * 30) / n // de −0,5 à −30,5 m
  const out = fuseBathymetry(land, sea)
  let ras = 0
  for (let i = 0; i < n; i++) if (out[i] > -0.5) ras++
  assert.equal(ras, 0, `${ras} pixels de mer ramenés au-dessus de −0,5 m — ils deviendront de la terre à l'arrondi`)
})

test('B5 · le remplissage détecté (Mapterhorn −0,344 m) suit la même règle : la source fine entière', () => {
  // une dalle dont 100 % de la mer est un aplat à −0,344 m (Nice, mesuré)
  const n = 2000
  const land = new Float32Array(n).fill(-0.344)
  const sea = new Float32Array(n)
  for (let i = 0; i < n; i++) sea[i] = -1 - (i % 5) // platier −1…−5 m
  const out = fuseBathymetry(land, sea)
  let faux = 0
  for (let i = 0; i < n; i++) if (Math.abs(out[i] - sea[i]) > 0.01) faux++
  assert.equal(faux, 0, `${faux} pixels de platier muselés par le fondu sur un remplissage`)
})

test('B5 · ce qui NE bouge PAS : la terre (l ≥ 0 hors absence) et la référence bavarde', () => {
  // terre à 1 mm : intouchable (contrat existant)
  assert.equal(fuseBathymetry(f32([0.004]), f32([-3]))[0], f32([0.004])[0])
  // référence BAVARDE à −2 m avec source fine à −10 m : le fondu d'origine, au bit
  const avant = -2 + (-10 - -2) * (() => { const x = 2 / 25; return x * x * (3 - 2 * x) })()
  assert.ok(Math.abs(fuseBathymetry(f32([-2]), f32([-10]))[0] - avant) < 1e-4, 'le chemin bavard a bougé')
  // polder négatif, source fine muette (0) : intact
  assert.equal(fuseBathymetry(f32([-6]), f32([0]))[0], -6)
})

// ═══ LE VRAI DÉFAUT DE PORQUEROLLES — mesuré au transect (tuile z13/4237/3010) ═══
//
// Le terrarium Mapterhorn ne remplit pas sa mer à ZÉRO PILE : il la remplit à
// zéro ± un bruit de compression (.webp). Relevé nord → sud, colonne 159 :
// terre 0,9…56 m, puis **+0,5 +0,2 +0,3 +0,4 +0,4 … +0,3 sur ~1 km de mer**,
// puis 0 exact. Sur les +0,2…+0,5 la fusion garde le terrarium (« un aplat
// POSITIF est de la terre ») → h > 0 → TERRE pour le nuanceur : c'est le
// plateau couleur terre, en rectangle (l'emprise du remplissage), qui déborde
// la côte, avec la mer sombre qui commence là où le remplissage retombe à 0.
// Les remplissages NÉGATIFS déjà mesurés (−0,094 / −0,344 / −0,406 m) sont le
// même bruit de l'autre côté du zéro ; étalés sur plusieurs valeurs, aucun ne
// tient 10 % du champ à lui seul, et `detectFillLevels` ne les voit pas non plus.
test('B5 · un remplissage POSITIF bruité (+0,2…+0,5 m) sur une mer que la source fine dit profonde est une ABSENCE', () => {
  const n = 4096
  const land = new Float32Array(n), sea = new Float32Array(n)
  const bruit = [0.2, 0.3, 0.4, 0.5, 0.3, 0.4] // le relevé, en boucle
  for (let i = 0; i < n; i++) {
    if (i < 1200) { land[i] = 30 + (i % 50); sea[i] = 0 } // l'île : terre, la source fine muette
    else { land[i] = bruit[i % bruit.length]; sea[i] = -80 - (i % 7) } // la mer : bruit positif, EMODnet à −80
  }
  const out = fuseBathymetry(land, sea)
  let terre = 0, faux = 0
  for (let i = 1200; i < n; i++) { if (out[i] >= 0) terre++; if (Math.abs(out[i] - sea[i]) > 0.5) faux++ }
  assert.equal(terre, 0, `${terre} pixels de mer rendus émergés (le plateau de Porquerolles)`)
  assert.equal(faux, 0, `${faux} pixels de mer qui ne portent pas la source fine`)
  for (let i = 0; i < 1200; i++) assert.equal(out[i], land[i], `l'île a bougé au pixel ${i}`)
})

test('B5 · le même bruit, NÉGATIF et étalé (−0,09 / −0,34 / −0,41), est aussi une absence', () => {
  const n = 4096
  const land = new Float32Array(n), sea = new Float32Array(n)
  const bruit = [-0.094, -0.344, -0.406, -0.2, -0.344]
  for (let i = 0; i < n; i++) { land[i] = bruit[i % bruit.length]; sea[i] = -25.2 } // Nice : la source dit −25,2 m
  const out = fuseBathymetry(land, sea)
  let muselés = 0
  for (let i = 0; i < n; i++) if (out[i] > -20) muselés++
  assert.equal(muselés, 0, `${muselés} pixels muselés par le fondu sur un remplissage bruité (les plateaux de Nice)`)
})

test('B5 · mais une VRAIE bande côtière à +0,3 m — un trait, pas un champ — reste de la terre', () => {
  const n = 4096
  const land = new Float32Array(n), sea = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (i < 2000) { land[i] = 5 + (i % 40); sea[i] = 0 } // terre
    else if (i < 2040) { land[i] = 0.3; sea[i] = -2 } // 40 pixels de plage à +0,3 m que la source fine dit à −2 (cellule à cheval)
    else { land[i] = -3 - (i % 30); sea[i] = -10 - (i % 30) } // la mer, bavarde
  }
  const out = fuseBathymetry(land, sea)
  for (let i = 2000; i < 2040; i++) assert.ok(out[i] > 0, `la plage a été creusée au pixel ${i} : ${out[i]}`)
})

test('B5 · les polders (−4 / −6 m) restent hors de la bande de bruit : intacts', () => {
  const n = 4096
  const land = new Float32Array(n).fill(-6), sea = new Float32Array(n).fill(-2) // IJsselmeer à −2 côté source fine
  for (let i = 0; i < n; i += 3) land[i] = -4
  const out = fuseBathymetry(land, sea)
  // ⚠️ GEL du comportement d'AVANT la règle de bande : −6 et −4 tiennent chacun
  // ≥ 10 % du champ, `detectFillLevels` les déclare remplissages, et la source
  // fine (−2) parle entière. Un polder n'est pas dans la bande de bruit ; la
  // règle nouvelle ne doit RIEN y changer — c'est ce que ce test tient.
  for (let i = 0; i < n; i++) assert.ok(Math.abs(out[i] - -2) < 1e-3, `polder déplacé au pixel ${i} : ${out[i]}`)
})
