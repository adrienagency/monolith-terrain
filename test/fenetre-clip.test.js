import test from 'node:test'
import assert from 'node:assert/strict'
import { plansFenetre, debordementCoin, dansFenetre } from '../src/fenetre-clip.js'
import { slabInside } from '../src/map/block-clip.js'

const HALF = 28

test('huit plans, et tous orientés vers l intérieur', () => {
  const ps = plansFenetre(HALF, 0.05)
  assert.equal(ps.length, 8)
  // le centre du socle est du bon côté des huit
  for (const p of ps) assert.ok(p.normal[0] * 0 + p.normal[2] * 0 + p.constant > 0)
  // et les normales sont unitaires (three.js l'exige : la distance signée en dépend)
  for (const p of ps) {
    const n = Math.hypot(p.normal[0], p.normal[1], p.normal[2])
    assert.ok(Math.abs(n - 1) < 1e-12, `normale non unitaire : ${n}`)
  }
})

test('les quatre côtés coupent EXACTEMENT au bord du socle', () => {
  assert.equal(dansFenetre(HALF, 0, HALF, 0.05), true)
  assert.equal(dansFenetre(HALF + 1e-6, 0, HALF, 0.05), false)
  assert.equal(dansFenetre(0, -HALF, HALF, 0.05), true)
  assert.equal(dansFenetre(0, -HALF - 1e-6, HALF, 0.05), false)
})

test('l octogone CONTIENT l arrondi : jamais coupé trop tôt', () => {
  // le critère qui compte : tout ce que le terrain montre doit passer les plans.
  // Une rivière coupée AVANT le bord du socle se lirait comme un morceau
  // manquant ; un cheveu qui dépasse au coin, non.
  for (const corner of [0.05, 2, 8, 14]) {
    for (let k = 0; k < 4000; k++) {
      const x = (Math.random() * 2 - 1) * HALF
      const z = (Math.random() * 2 - 1) * HALF
      if (slabInside(x, z, HALF, corner, 2) && !dansFenetre(x, z, HALF, corner)) {
        assert.fail(`coupé trop tôt en (${x.toFixed(3)}, ${z.toFixed(3)}), corner ${corner}`)
      }
    }
  }
})

test('et il ne déborde que du coin, d une quantité qu on peut nommer', () => {
  // au réglage par défaut (slabCorner = 0 → rayon plancher 0,05) le débordement
  // est de l'ordre du centième d'unité sur 56 : invisible.
  assert.ok(debordementCoin(0.05) < 0.021)
  // et il croît linéairement avec l'arrondi, sans surprise
  assert.ok(Math.abs(debordementCoin(14) - (Math.SQRT2 - 1) * 14) < 1e-12)
  // vérification par échantillonnage : le seul endroit où l'octogone déborde
  // l'arrondi est la zone des coins
  const corner = 8
  let debordeHorsCoin = 0
  for (let k = 0; k < 8000; k++) {
    const x = (Math.random() * 2 - 1) * HALF
    const z = (Math.random() * 2 - 1) * HALF
    if (dansFenetre(x, z, HALF, corner) && !slabInside(x, z, HALF, corner, 2)) {
      const coin = Math.abs(x) > HALF - corner && Math.abs(z) > HALF - corner
      if (!coin) debordeHorsCoin++
    }
  }
  assert.equal(debordeHorsCoin, 0)
})

test('un rayon nul donne le carré, un rayon plein donne l octogone régulier', () => {
  assert.equal(plansFenetre(HALF, 0)[4].constant, HALF * Math.SQRT2)
  assert.equal(plansFenetre(HALF, HALF)[4].constant, HALF)
  // et un rayon absurde est ramené dans les bornes plutôt que de rendre du NaN
  assert.equal(plansFenetre(HALF, 1e6)[4].constant, HALF)
  assert.equal(plansFenetre(HALF, -3)[4].constant, HALF * Math.SQRT2)
})

test('les plans ne dépendent PAS de la fenêtre — ils sont constants', () => {
  // C'est le point qui rend la découpe gratuite : en mode continu le socle reste
  // centré sur l'origine du monde et c'est la géométrie qui défile dessous.
  // La signature le dit : un seul paramètre requis, le demi-côté du socle. Pas
  // de décalage à passer, donc pas de décalage à oublier de mettre à jour.
  assert.equal(plansFenetre.length, 1)
  assert.deepEqual(plansFenetre(HALF, 3), plansFenetre(HALF, 3))
})
