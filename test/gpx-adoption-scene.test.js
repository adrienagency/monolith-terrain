// L'ADOPTION DE SCÈNE DU CALQUE GPX — le contrat, EXÉCUTÉ.
//
// ⛔ ROUGE À L'ÉCRITURE. Le compagnon `test/gpx-scene-globe.test.js` LIT
// `main.js` (aucun test de ce dépôt ne le charge) ; celui-ci EXÉCUTE le code du
// calque. Les deux sont nécessaires : ce chantier a déjà vu une mutation
// survivre à 4 082 tests derrière une garde qui ne faisait que lire du texte.
//
// LE CONTRAT, en une phrase : **un calque GPX doit pouvoir changer de scène
// après sa construction**, et le gestionnaire doit faire suivre TOUS ses
// calques — comme il le fait déjà pour la couleur, la largeur, le halo, les
// repères kilométriques et la visibilité. Sans ça, un tracé chargé AVANT la
// bascule de régime resterait dans la scène qu'on ne dessine plus, et un tracé
// ajouté après serait le seul visible : le défaut ne se verrait qu'au deuxième
// chargement, exactement comme les points de passage de la tâche 22.
//
// Mesure qui l'exige (banc `scripts/banc-gx1-position.mjs`, 2026-09-04,
// Marathon du Mont-Blanc 90 km, mode sphère de production) :
//   · pixels posés par le tracé au repos : **0 0 0 0 0 0**, témoin de bruit 0 ;
//   · attendus par la géométrie du ruban : **2 019** ;
//   · les mêmes gestes sous `?terre=deux` : **1 053**.

import test from 'node:test'
import assert from 'node:assert/strict'

// ⚠️ `GpxLayerManager` construit un élément d'annonce de transition à la
// construction : un DOM minimal suffit, et il est retiré derrière nous.
const poserDom = () => {
  if (globalThis.document) return () => { }
  const el = () => ({
    className: '', innerHTML: '', style: {}, children: [],
    classList: { add() { }, remove() { }, toggle() { } },
    appendChild(c) { this.children.push(c); return c },
    querySelector: () => el(),
    addEventListener() { }, removeEventListener() { },
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  })
  globalThis.document = { createElement: () => el(), body: el(), addEventListener() { } }
  return () => { delete globalThis.document }
}

const rendre = poserDom()
const { GpxLayerManager } = await import('../src/gpx-layers.js')
rendre()

const faux = () => ({ add() { }, remove() { } })

function manager() {
  const rendre = poserDom()
  const m = new GpxLayerManager({ scene: faux(), camera: {}, terrain: {}, params: {}, getDem: () => null })
  rendre()
  return m
}

test('le gestionnaire de calques sait poser une nouvelle scène', () => {
  const m = manager()
  assert.equal(typeof m.poserScene, 'function',
    '`GpxLayerManager.poserScene()` n’existe pas : rien ne peut faire passer le tracé ' +
    'dans la scène du globe quand la passe de surface est éteinte')
})

test('poserScene fait suivre TOUS les calques, pas seulement celui qui a le focus', () => {
  const m = manager()
  const vus = []
  const calque = (id) => ({ id, name: id, visible: true, gpx: { poserScene: (s) => vus.push([id, s]) } })
  m.layers = [calque('a'), calque('b'), calque('c')]
  const cible = faux()
  m.poserScene(cible)
  assert.deepEqual(vus.map((v) => v[0]), ['a', 'b', 'c'],
    'poserScene n’a pas fait suivre les trois calques — un tracé chargé avant la bascule ' +
    'resterait dans la scène qu’on ne dessine plus')
  for (const [, s] of vus) assert.equal(s, cible, 'un calque a reçu une autre scène que celle demandée')
})

test('la scène posée est retenue : un calque AJOUTÉ ENSUITE la reçoit aussi', () => {
  // ⚠️ Le piège vécu tâche 22 : un défaut qui ne se voit qu'au DEUXIÈME
  // chargement. `addLayer` construit un `GpxLayer` neuf ; s'il repart de la
  // scène du constructeur, le deuxième tracé sera invisible alors que le
  // premier ne l'est plus.
  const m = manager()
  const cible = faux()
  m.poserScene(cible)
  assert.equal(m.sceneCourante ?? m.scene, cible,
    'le gestionnaire n’a pas retenu la scène posée : les calques suivants repartiront ' +
    'de la scène du bloc plat')
})
