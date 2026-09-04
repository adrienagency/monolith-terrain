// LA TEINTE PAR SOMMET, DÉPORTÉE — Tâche FLU, poste ④.
//
// Le contrat est l'IDENTITÉ BIT À BIT avec la boucle que `_ecrireRelief`
// exécutait en ligne : `v = natGris(hn, ny) + tint[i]·0,05`. Le test rejoue cette
// boucle telle qu'elle était écrite et compare octet pour octet.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { couleursRelief, extraireYNy } from '../src/monde/teinte-relief.js'
import { natGris } from '../src/monde/eclairage-crop.js'
import { tintField } from '../src/detail-noise.js'
import { computeTeinteJob } from '../src/terrain-jobs.js'

function reliefFactice(res, seed = 7) {
  const n = res + 1
  const count = n * n
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  let s = seed
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < count; i++) {
    position[i * 3] = (i % n) - res / 2
    position[i * 3 + 1] = rnd() * 12 - 3 // des altitudes SOUS minH aussi (grain négatif)
    position[i * 3 + 2] = ((i / n) | 0) - res / 2
    const nx = rnd() - 0.5
    const nz = rnd() - 0.5
    const ny = Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz))
    normal[i * 3] = nx; normal[i * 3 + 1] = ny; normal[i * 3 + 2] = nz
  }
  return { position, normal, count }
}

/** LA BOUCLE D ORIGINE, recopiée telle quelle depuis `_ecrireRelief` (terrain.js). */
function boucleOrigine(arr, normals, count, minH, maxH, seedTeinte, res, size) {
  const tint = tintField(seedTeinte, res, size)
  const colors = new Float32Array(count * 3)
  const span = Math.max(1e-5, maxH - minH)
  for (let i = 0; i < count; i++) {
    const h = arr[i * 3 + 1]
    const ny = normals[i * 3 + 1]
    const hn = (h - minH) / span
    let v = natGris(hn, ny)
    v += tint[i] * 0.05
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
  }
  return colors
}

test('couleursRelief rend OCTET POUR OCTET ce que la boucle de _ecrireRelief écrivait', () => {
  for (const res of [8, 33]) {
    const { position, normal, count } = reliefFactice(res)
    const minH = -1 // sous le minimum réel : hn ∈ [0, 1]
    const maxH = 9.5
    const attendu = boucleOrigine(position, normal, count, minH, maxH, 7 + 101, res, 56)
    const { y, ny } = extraireYNy(position, normal, count)
    const vu = couleursRelief({ y, ny, count, minH, maxH, seedTeinte: 7 + 101, res, size: 56 })
    assert.equal(vu.length, attendu.length)
    assert.ok(Buffer.from(vu.buffer).equals(Buffer.from(attendu.buffer)), `res ${res} : les octets diffèrent`)
    // et les altitudes SOUS minH (hn < 0) ne rendent jamais NaN — la borne de natGris
    const vu2 = couleursRelief({ y, ny, count, minH: 2, maxH, seedTeinte: 108, res, size: 56 })
    assert.ok(vu2.every(Number.isFinite), 'un hn négatif ne doit pas rendre NaN')
  }
})

test('le travail de Worker (`computeTeinteJob`) rend la même chose et écrit dans le tampon fourni', () => {
  const res = 12
  const { position, normal, count } = reliefFactice(res, 3)
  const attendu = boucleOrigine(position, normal, count, -2, 10, 3 + 101, res, 56)
  const { y, ny } = extraireYNy(position, normal, count)
  const r = computeTeinteJob({ y, ny, count, minH: -2, maxH: 10, seedTeinte: 3 + 101, res, size: 56 })
  assert.ok(Buffer.from(r.colors.buffer).equals(Buffer.from(attendu.buffer)))
  assert.deepEqual(r.transfert, [r.colors.buffer], 'le résultat est TRANSFÉRÉ, pas copié')
})
