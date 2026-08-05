// LA NUIT DESCEND-ELLE JUSQU'AUX VOISINES ? — le damier, exécuté.
//
// ═══════════════════════════════════════════════════════════════════════════
// LE DÉFAUT QUE CE FICHIER GARDE FERMÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Capture d'Adrien : la carte coupée en deux le long d'une jointure de dalles.
// Une moitié en plein jour, relief pâle ; l'autre presque noire, lumières de
// villes allumées, trace GPX orange par-dessus. La frontière suivait EXACTEMENT
// un bord de bloc.
//
// La grandeur qui divergeait n'est aucune des lumières de la scène (soleil,
// hémisphérique, environnement : elles éclairent tout le monde). C'est la
// COUCHE DES LUMIÈRES NOCTURNES, et surtout son premier geste — elle ÉTEINT le
// sol avant d'allumer les villes (`uNuitFond`, ce qui reste du sol, ≈ 0,22).
// Ses quatre uniformes ne partaient que sur le bloc central, et
// `tenteAllumageNuit` allume la couche TOUT SEUL au crépuscule : traîner la
// tirette de 24 h suffisait à fabriquer la coupure.
//
// ⚠️ ON EXÉCUTE, ON NE RELIT PAS. `BlockGrid` s'importe et s'instancie sous
// node (aucun contexte WebGL n'est nécessaire pour ce qu'on mesure : des
// appels de setter et des valeurs d'uniformes). Un test qui chercherait
// « setNuitIntensite » dans le texte de block-grid.js passerait au vert sur une
// boucle vide.
import test from 'node:test'
import assert from 'node:assert/strict'
import { BlockGrid } from '../src/block-grid.js'

// ── Le décor minimal ────────────────────────────────────────────────────────
// Une couleur qui sait se copier, comme THREE.Color, et un jeu d'uniformes qui
// porte exactement ce que `_applyLook` recopie.
const couleur = (v) => ({ v, copy(o) { this.v = o.v; return this } })
function uniformes({ contour = '#111', grille = '#222', poids = 0.7, interv = 100, opContour = 0.5, pasGrille = 10, opGrille = 0.2 } = {}) {
  return {
    uHeightRange: { value: couleur('plage') },
    uContourColor: { value: couleur(contour) },
    uGridColor: { value: couleur(grille) },
    uContourWeight: { value: poids },
    uContourInterval: { value: interv },
    uContourOpacity: { value: opContour },
    uGridStep: { value: pasGrille },
    uGridOpacity: { value: opGrille },
  }
}
// Un terrain bouchon qui NOTE ce qu'on lui pose : c'est la propagation qu'on
// mesure, pas le rendu.
function terrainBouchon(u = uniformes()) {
  return {
    mapUniforms: u,
    nuit: { intensite: [], fond: [], gain: [] },
    setNuitIntensite(v) { this.nuit.intensite.push(v) },
    setNuitFond(v) { this.nuit.fond.push(v) },
    setNuitGain(v) { this.nuit.gain.push(v) },
  }
}
function damier(centre = null) {
  return new BlockGrid({
    scene: { add() {}, remove() {} },
    params: {},
    getMainDem: () => null,
    getMainTerrain: () => centre,
    getPlinth: () => null,
  })
}
function pose(g, ...ij) {
  const faites = []
  for (const [i, j] of ij) {
    const cell = { i, j, terrain: terrainBouchon() }
    g.cells.set(`${i},${j}`, cell)
    faites.push(cell)
  }
  return faites
}

// ════════ 1. LES TROIS SCALAIRES ATTEIGNENT TOUTES LES DALLES ═══════════════

test('setNuitIntensite pousse la valeur sur chaque dalle du damier', () => {
  const g = damier()
  const [a, b, c] = pose(g, [1, 0], [0, 1], [-1, -1])
  g.setNuitIntensite(0.8)
  assert.deepEqual(a.terrain.nuit.intensite, [0.8])
  assert.deepEqual(b.terrain.nuit.intensite, [0.8])
  assert.deepEqual(c.terrain.nuit.intensite, [0.8])
})

test('setNuitFond et setNuitGain descendent eux aussi — les deux tirettes du panneau Couches', () => {
  const g = damier()
  const [a] = pose(g, [1, 0])
  g.setNuitFond(0.22)
  g.setNuitGain(3.4)
  assert.deepEqual(a.terrain.nuit.fond, [0.22])
  assert.deepEqual(a.terrain.nuit.gain, [3.4])
})

// ════════ 2. LE GARDE SUR CHANGEMENT RÉEL ═══════════════════════════════════
//
// `applyTimeOfDay` appelle `refreshNuitIntensite` à chaque dixième d'heure de
// la tirette de 24 h. Couche éteinte — le cas de très loin le plus fréquent —
// c'est la même valeur 0 réécrite indéfiniment sur 24 dalles.

test('la même valeur ne refait pas la tournée du damier', () => {
  const g = damier()
  const [a] = pose(g, [1, 0])
  g.setNuitIntensite(0)
  g.setNuitIntensite(0)
  g.setNuitIntensite(0)
  assert.deepEqual(a.terrain.nuit.intensite, [0], 'une seule écriture pour trois appels')
  g.setNuitIntensite(0.5)
  assert.deepEqual(a.terrain.nuit.intensite, [0, 0.5], 'et la valeur qui CHANGE passe')
})

test('le garde vaut aussi pour le fond et le gain', () => {
  const g = damier()
  const [a] = pose(g, [1, 0])
  g.setNuitFond(0.22); g.setNuitFond(0.22)
  g.setNuitGain(3.4); g.setNuitGain(3.4)
  assert.deepEqual(a.terrain.nuit.fond, [0.22])
  assert.deepEqual(a.terrain.nuit.gain, [3.4])
})

// ════════ 3. LA DALLE QUI NAÎT APRÈS LE CRÉPUSCULE ══════════════════════════
//
// Le même défaut, simplement décalé dans le temps : une voisine dont le MNT
// atterrit après que la nuit soit tombée resterait en plein jour au milieu d'un
// damier éteint. `_buildCell` passe par `_applyLook` — c'est là que la mémoire
// du damier rattrape la nouvelle venue.

test('une dalle née après la tombée de la nuit reçoit l\'état courant de la couche', () => {
  const g = damier()
  g.setNuitIntensite(0.8)
  g.setNuitFond(0.22)
  g.setNuitGain(3.4)
  const tardive = { i: 2, j: 0, terrain: terrainBouchon() }
  g.cells.set('2,0', tardive)
  g._applyLook(tardive, {}) // ce que `_buildCell` fait à la naissance d'une dalle
  assert.deepEqual(tardive.terrain.nuit.intensite, [0.8])
  assert.deepEqual(tardive.terrain.nuit.fond, [0.22])
  assert.deepEqual(tardive.terrain.nuit.gain, [3.4])
})

test('tant que main.js n\'a rien dit, une dalle garde les valeurs d\'usine de son Terrain', () => {
  const g = damier()
  const tardive = { i: 2, j: 0, terrain: terrainBouchon() }
  g.cells.set('2,0', tardive)
  g._applyLook(tardive, {})
  assert.deepEqual(tardive.terrain.nuit.intensite, [], 'aucune valeur imposée')
  assert.deepEqual(tardive.terrain.nuit.fond, [])
  assert.deepEqual(tardive.terrain.nuit.gain, [])
})

// ════════ 4. L'ENCRE DES COURBES SUIT LE MODE SOMBRE ════════════════════════
//
// Deuxième grandeur que l'heure fait diverger, plus discrète que la première :
// `applyTimeOfDay` → `setDarkMode` → `applyGridContour` retourne l'encre des
// courbes et de la grille quand la nuit tombe, et n'écrivait que sur le bloc
// central.
//
// ⚠️ ON COPIE L'UNIFORME DU CENTRE, ON NE REJOUE PAS LA RÈGLE : en mode sombre
// `uContourWeight` ne vaut PAS `params.contourWeight` (setDarkMode l'écrase à
// 0,5 APRÈS applyGridContour). Le test le vérifie avec un poids que `params`
// ne porte pas.

test('restyle recopie l\'encre des courbes et de la grille depuis le bloc central', () => {
  const centre = { mapUniforms: uniformes({ contour: '#f0f0f0', grille: '#e0e0e0', poids: 0.5, interv: 250, opContour: 0.9, pasGrille: 25, opGrille: 0.4 }) }
  const g = damier(centre)
  const [a, b] = pose(g, [1, 0], [0, -1])
  g.restyle({ contourColor: '#000', gridColor: '#000', contourWeight: 0.7 })
  for (const cell of [a, b]) {
    const u = cell.terrain.mapUniforms
    assert.equal(u.uContourColor.value.v, '#f0f0f0')
    assert.equal(u.uGridColor.value.v, '#e0e0e0')
    assert.equal(u.uContourWeight.value, 0.5, 'le poids vient du CENTRE, pas de params.contourWeight')
    assert.equal(u.uContourInterval.value, 250)
    assert.equal(u.uContourOpacity.value, 0.9)
    assert.equal(u.uGridStep.value, 25)
    assert.equal(u.uGridOpacity.value, 0.4)
  }
})

test('sans bloc central, restyle ne touche pas à l\'encre des voisines', () => {
  const g = damier(null)
  const [a] = pose(g, [1, 0])
  g.restyle({})
  assert.equal(a.terrain.mapUniforms.uContourColor.value.v, '#111', 'rien à copier : rien n\'est écrasé')
})

// ════════ 5. LA MOSAÏQUE DE LA DALLE MEURT AVEC ELLE ════════════════════════
//
// Chaque dalle a SON emprise, donc SA mosaïque nocturne et son propre
// `NuitLayer` (posé par main.js, comme `cell.aerial`). L'oublier au congé
// serait une fuite VRAM par dalle détruite — le damier churn à chaque zoom.

test('_disposeCell libère le NuitLayer de la dalle', () => {
  const g = damier()
  let libere = 0
  const cell = { i: 1, j: 0, nuit: { dispose() { libere++ } } }
  g._disposeCell(cell)
  assert.equal(libere, 1)
  assert.equal(cell.disposed, true)
})
