import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PALIERS } from '../src/palier-machine.js'
import { BlockGrid, CARRE_COTE_MAX } from '../src/block-grid.js'
import { carreCouvrant, carreSousPlafond, cellulesDuCarre } from '../src/damier-carre.js'
import { worldToLatLon } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

// ══════════ LE PALIER MACHINE MORD-IL VRAIMENT ? (Tâche 12, étape 4) ═════════
//
// La table de `palier-machine.js` promet un `damierMax` par palier — 24, 12, 8,
// 4 cellules voisines selon la puissance de la carte graphique. `damier-carre.js`
// sait le faire respecter (`carreSousPlafond`), et `block-grid.js:360` le lit
// sur `this.params.damierMax`.
//
// ⚠️ ET C'EST LÀ QUE LA CHAÎNE ÉTAIT ROMPUE. `src/main.js` recopiait dans
// `params` quatre réglages de la table (`ssao`, `densite`, `ombresRes`,
// `analyseMax`) et PAS `damierMax` : `this.params.damierMax` valait `undefined`,
// `carreSousPlafond` recevait `undefined`, retombait sur `Infinity` et ne
// plafonnait RIEN. Le mécanisme entier existait, était testé unité par unité, et
// ne s'exécutait jamais en production — une machine de palier 3 chargeait le même
// damier qu'une machine de palier 0.
//
// Le commentaire de test/damier-carre.test.js disait déjà, du plan précédent :
// « Avant ce plan, damierMax était calculé puis ignoré ». Il l'était encore. Un
// test sur la fonction pure ne pouvait pas le voir : c'est le CÂBLAGE qui
// manquait, et c'est donc lui qu'on verrouille ici, en plus du comportement.
//
// LES QUATRE PALIERS, ET LE CÔTÉ QU'ILS DOIVENT DONNER (brief) :
//   damierMax 24 → 3×3   (8 voisines, très en dessous du plafond)
//   damierMax 12 → 3×3   (8 ≤ 12)
//   damierMax  8 → 3×3   (8 ≤ 8, PILE — le palier 2 est taillé pour le 3×3)
//   damierMax  4 → 2×2   (8 > 4 : on rétrécit le CÔTÉ, on ne troue pas le carré)
const ATTENDU = { 24: 3, 12: 3, 8: 3, 4: 2 }

// Un MNT bouchon : `latLonToWorld`/`worldToLatLon` n'ont besoin que de ces
// quatre nombres (geo.js:47-63 et 85-95). Aucun octet d'altitude, aucun réseau.
const demBouchon = () => ({ zoom: 12, size: 1536, tilePx: 512, originTileX: 2115, originTileY: 1500 })

// un tracé qui réclame franchement les neuf cases d'un 3×3 : la diagonale
// complète, un point par case
function traceDiagonal(dem) {
  const pts = []
  for (const [i, j] of [[-1, -1], [0, 0], [1, 1], [-1, 1], [1, -1]]) {
    const { lat, lon } = worldToLatLon(dem, i * TERRAIN_SIZE, j * TERRAIN_SIZE)
    pts.push({ lat, lon })
  }
  return pts
}

function damierAvecPlafond(damierMax) {
  const dem = demBouchon()
  const g = new BlockGrid({
    scene: { add() {}, remove() {} },
    params: { damierMax },
    getMainDem: () => dem,
    getMainTerrain: () => null,
    getPlinth: () => null,
  })
  const cellules = g.cellsForTrack(traceDiagonal(dem))
  return { cote: g.carreCourant().cote, cellules }
}

test('preambule : le trace de reference reclame bien un 3x3 entier sans plafond', () => {
  const { cote, cellules } = damierAvecPlafond(undefined)
  assert.equal(cote, CARRE_COTE_MAX, 'sans plafond le trace doit ouvrir le carre maximal')
  assert.equal(cellules.size, 8, '3x3 moins le bloc central')
})

test('chaque palier de la table rend le cote annonce, et le damier tient dans son plafond', () => {
  for (const p of PALIERS) {
    const max = p.damierMax
    assert.ok(max in ATTENDU, `palier inconnu de ce test : damierMax ${max} — la table a bouge`)
    const { cote, cellules } = damierAvecPlafond(max)
    assert.equal(cote, ATTENDU[max], `damierMax ${max} : cote attendu ${ATTENDU[max]}, obtenu ${cote}`)
    assert.ok(cellules.size <= max,
      `damierMax ${max} : ${cellules.size} voisines chargees, le plafond ne mord pas`)
  }
})

test('les quatre paliers de la table sont bien 24 / 12 / 8 / 4', () => {
  assert.deepEqual(PALIERS.map((p) => p.damierMax), [24, 12, 8, 4],
    'la table a change : les cotes attendus de ce fichier sont a remesurer')
})

// ⚠️ CE TEST-CI EST LE SEUL QUI AURAIT ATTRAPÉ LE DÉFAUT. Les autres passent
// tous, avec ou sans le câblage : ils passent `damierMax` à la main. Celui-ci
// vérifie que `main.js` le prend DANS LA TABLE et le met DANS `params` — le
// maillon qui manquait. `main.js` n'est exécutable par aucun test (three.js, le
// DOM, des workers, le réseau) : on lit sa source, comme le fait déjà
// test/damier-uniformes.test.js.
test('main.js recopie damierMax de la table de palier dans params', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /damierMax:\s*MACHINE\.damierMax/,
    'params.damierMax ne vient pas de la table : le plafond machine ne peut pas mordre')
})

test('block-grid lit ce plafond et le passe a carreSousPlafond', () => {
  const grid = readFileSync(new URL('../src/block-grid.js', import.meta.url), 'utf8')
  assert.match(grid, /const plafond = this\.params\?\.damierMax/)
  assert.match(grid, /carreSousPlafond\(carreCouvrant\(touchees, \{ cotemax: CARRE_COTE_MAX \}\), plafond\)/)
})

// Le rétrécissement garde un CARRÉ PLEIN : c'est la propriété qui distingue le
// plafond machine d'un simple « on arrête de charger », et c'est elle qui évite
// de rouvrir le trou que tout damier-carre.js existe pour boucher.
test('sous plafond, le damier reste un carre plein — jamais une figure trouee', () => {
  for (const max of [24, 12, 8, 4]) {
    const { cote, cellules } = damierAvecPlafond(max)
    const attendues = cellulesDuCarre(carreSousPlafond(carreCouvrant([...cellules], { cotemax: CARRE_COTE_MAX }), max))
    assert.equal(cellules.size, cote * cote - 1, `damierMax ${max} : ${cellules.size} cases pour un carre de cote ${cote}`)
    assert.deepEqual([...cellules].sort(), [...attendues].sort())
  }
})
