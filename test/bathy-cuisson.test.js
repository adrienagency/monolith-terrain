import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openSources } from '../scripts/build-bathy-tiles.mjs'

// LE MOYENNAGE DOIT SURVIVRE À LA CASCADE. openOne().sample() sait moyenner sur
// la surface d'un pixel de sortie (halfLon/halfLat) ; openSources() empile
// plusieurs pivots et RELAIE cet appel. Un wrapper qui n'accepte que (lon, lat)
// avale silencieusement la taille du pixel : rx/ry tombent à 0, le sampler
// retombe sur le plus proche voisin, et tout l'anti-aliasing disparaît sans
// qu'aucune erreur ne soit levée. C'est arrivé, ça a coûté du poids de tuile
// sur z4-z8 ; ces tests sont le verrou.

// ------------------------------------------------------------------ fixtures
// Un pivot minuscule en damier : 1 cellule = 1 degré, alternance -100 / -200.
// Choisi exprès pour que la MOYENNE et le PLUS PROCHE VOISIN ne puissent pas
// coïncider par accident (ce qu'un champ linéaire ferait).
const N = 8
const profondeur = (i, j) => ((i + j) % 2 === 0 ? -100 : -200)

function pivotDamier() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bathy-pivot-'))
  const buf = Buffer.alloc(N * N * 2)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) buf.writeInt16LE(profondeur(i, j), (j * N + i) * 2)
  }
  fs.writeFileSync(path.join(dir, 'grid.bin'), buf)
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify({
      width: N, height: N,
      west: 0, east: N, south: 0, north: N,
      dtype: 'int16', noData: -32768,
    })
  )
  return dir
}

// Un second pivot, constant, qui ne couvre QUE le quart nord-ouest : il sert à
// vérifier que la priorité au premier pivot ne se paie pas en perte du cadrage.
function pivotConstant(valeur) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bathy-pivot-'))
  const buf = Buffer.alloc(N * N * 2)
  for (let k = 0; k < N * N; k++) buf.writeInt16LE(valeur, k * 2)
  fs.writeFileSync(path.join(dir, 'grid.bin'), buf)
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify({
      width: N, height: N,
      west: 0, east: N, south: 0, north: N,
      dtype: 'int16', noData: -32768,
    })
  )
  return dir
}

// centre d'une fenêtre 3×3 (i,j = 3..5) : demi-pixel de 1,5 degré, sx = sy = 1
const LON = 4.5
const LAT = 3.5
const DEMI = 1.5
// damier sur i,j ∈ [3,5] : 5 cases à -100, 4 à -200
const MOYENNE_ATTENDUE = (5 * -100 + 4 * -200) / 9

test('la cascade RELAIE la taille du pixel : moyenne, pas plus proche voisin', () => {
  const src = openSources(pivotDamier())
  try {
    const moyenne = src.sample(LON, LAT, DEMI, DEMI)
    assert.ok(
      Math.abs(moyenne - MOYENNE_ATTENDUE) < 1e-9,
      `attendu ${MOYENNE_ATTENDUE}, obtenu ${moyenne} — halfLon/halfLat perdus par le wrapper ?`
    )
    // et surtout : ce n'est PAS la valeur du plus proche voisin
    assert.notEqual(moyenne, src.sample(LON, LAT))
  } finally {
    src.close()
  }
})

test('sans taille de pixel, la cascade rend bien le plus proche voisin', () => {
  // le comportement historique reste disponible — c'est ce dont se sert la
  // pré-passe probeWorthIt(), qui n'a que faire d'une moyenne
  const src = openSources(pivotDamier())
  try {
    assert.equal(src.sample(LON, LAT), profondeur(4, 4))
  } finally {
    src.close()
  }
})

test('DEUX pivots : le premier qui couvre gagne, ET il moyenne quand même', () => {
  const fin = pivotDamier()
  const socle = pivotConstant(-4000)
  const src = openSources(`${fin},${socle}`)
  try {
    const v = src.sample(LON, LAT, DEMI, DEMI)
    assert.ok(Math.abs(v - MOYENNE_ATTENDUE) < 1e-9, `le pivot prioritaire doit moyenner (obtenu ${v})`)
  } finally {
    src.close()
  }
})

test('hors de tout pivot, la cascade rend null plutôt qu une valeur inventée', () => {
  const src = openSources(pivotDamier())
  try {
    assert.equal(src.sample(100, 100, DEMI, DEMI), null)
  } finally {
    src.close()
  }
})
