import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSlabWalls, computeSlab } from '../src/plinth.js'

// relief plat à l'altitude `y`
const plat = (y) => () => y

// LA DEMANDE : « la hauteur des blocs sera toujours égale à la hauteur du bloc
// dont la base va le plus bas ». Donc un plancher COMMUN, et le plus bas.
test('deux socles de reliefs differents partagent le meme fond', () => {
  const profond = computeSlab(plat(-40), 7, 32)
  const hautPerche = computeSlab(plat(120), 7, 32)
  assert.ok(profond.baseY < hautPerche.baseY, 'preambule : les fonds different')

  const plancher = Math.min(profond.baseY, hautPerche.baseY)
  const a = buildSlabWalls(plat(-40), { resolution: 32, baseYFloor: plancher })
  const b = buildSlabWalls(plat(120), { resolution: 32, baseYFloor: plancher })
  assert.equal(fondDe(a), fondDe(b), 'les deux socles doivent finir a la meme altitude')
  assert.equal(fondDe(a), plancher)
})

// le point le plus bas de la géométrie rendue
//
// ⚠️ DIVERGENCE AVEC LE BRIEF : celui-ci lisait `res.geometry`. buildSlabWalls
// rend `{ geo, baseY, bande }` (src/plinth.js:408, et tout le reste du dépôt —
// test/socle-matiere.test.js — le lit déjà en `.geo`) : `res.geometry` est
// `undefined`, et `undefined.getAttribute(...)` fait échouer les DEUX premiers
// tests (TypeError), pas les caractériser comme « déjà verts ». Corrigé en
// `res.geo` pour que ces deux tests jouent réellement le rôle que le brief leur
// donne : caractériser le mécanisme baseYFloor existant.
function fondDe(res) {
  const pos = res.geo.getAttribute('position')
  let min = Infinity
  for (let i = 0; i < pos.count; i++) min = Math.min(min, pos.getY(i))
  return Math.round(min * 1e6) / 1e6
}

// ⚠️ LE PIÈGE : baseYFloor prend un MINIMUM (plinth.js:215), il ne peut donc
// que faire DESCENDRE un socle, jamais remonter. Passer le baseY du bloc
// CENTRAL (le code d'avant) ne suffit pas : une voisine plus profonde le
// dépasse et sort plus bas que tout le monde.
test('le plancher du bloc central ne suffit pas a egaliser', () => {
  const centre = computeSlab(plat(0), 7, 32).baseY
  const a = buildSlabWalls(plat(0), { resolution: 32, baseYFloor: centre })
  const b = buildSlabWalls(plat(-40), { resolution: 32, baseYFloor: centre })
  assert.notEqual(fondDe(a), fondDe(b), 'c\'est bien le defaut qu\'on corrige')
})

// ══════ LE TEST QUI ÉCHOUE, ET QUI PORTE LE TRAVAIL DE CETTE TÂCHE ══════
// Les deux tests ci-dessus caractérisent le mécanisme existant ; celui-ci
// exige ce qui n'existe pas encore : que le damier CALCULE le bon plancher.
import { BlockGrid } from '../src/block-grid.js'

function damierBouchon(basesY) {
  const g = new BlockGrid({
    scene: null,
    params: {},
    getMainDem: () => null,
    getMainTerrain: () => null,
    getPlinth: () => ({ baseY: basesY.centre }),
  })
  let k = 0
  for (const b of basesY.voisines) {
    k++
    g.cells.set(`${k},0`, { i: k, j: 0, baseYPropre: b, planchierPose: null })
  }
  return g
}

test('le plancher commun est le plus bas de TOUTES les cases, centre inclus', () => {
  const g = damierBouchon({ centre: -10, voisines: [-4, -37, -12] })
  assert.equal(g.planchierCommun(), -37, 'la voisine la plus profonde impose le fond')
})

test('sans voisine, le plancher commun est celui du bloc principal', () => {
  const g = damierBouchon({ centre: -10, voisines: [] })
  assert.equal(g.planchierCommun(), -10)
})

test('une case sans base connue ne fausse pas le plancher', () => {
  const g = damierBouchon({ centre: -10, voisines: [-4] })
  g.cells.set('9,0', { i: 9, j: 0, baseYPropre: undefined, planchierPose: null })
  assert.equal(g.planchierCommun(), -10, 'undefined ignore, pas propage en NaN')
})
