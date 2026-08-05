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

// ═══════════════ RONDE DE RELECTURE 1 : LE MUR RÉEL, PAS SEULEMENT LE CALCUL
// ═══════════════════════════════════════════════════════════════════════════
// planchierCommun() est une fonction pure, facile à tester par la valeur
// qu'elle rend. _rebuildCellWalls()/egaliseHauteurs(), eux, manipulent de
// VRAIS THREE.Mesh et de VRAIES THREE.BufferGeometry — le brief avertissait
// justement du matériau PARTAGÉ (wallMat, plinth.js:423-438), et rien ne le
// vérifiait avant cette ronde. Ces tests poussent le damier bouchon jusqu'à
// la géométrie, au lieu de s'arrêter à baseYPropre comme damierBouchon().

// scène bouchon : compte les add()/remove(), ne fait rien d'autre — suffisant
// pour _rebuildCellWalls, qui n'appelle que ces deux méthodes sur la scène.
function sceneBouchon() {
  const s = { addCalls: 0, removeCalls: 0, present: new Set() }
  s.scene = {
    add: (o) => { s.addCalls++; s.present.add(o) },
    remove: (o) => { s.removeCalls++; s.present.delete(o) },
  }
  return s
}

// damier bouchon complet : jusqu'à egaliseHauteurs()/_rebuildCellWalls(), pas
// seulement planchierCommun(). wallMat espionne ses appels à dispose() — le
// point que le brief souligne : le disposer casserait TOUS les socles du
// damier (et la jupe de zone isolée) d'un coup.
function damierMursBouchon(centre) {
  const sc = sceneBouchon()
  let wallMatDisposes = 0
  const wallMat = { dispose: () => { wallMatDisposes++ } }
  const g = new BlockGrid({
    scene: sc.scene,
    params: {},
    getMainDem: () => null,
    getMainTerrain: () => null,
    getPlinth: () => ({ baseY: centre, depth: 7, wallMat }),
  })
  return { g, sc, wallMatDisposes: () => wallMatDisposes }
}

// une cellule bouchon dont le relief est PLAT à l'altitude `y` : baseYPropre
// s'en déduit directement (globalMin = y sur un relief constant, baseY =
// globalMin − depth, ici depth = 7 comme le socle bouchon ci-dessus) — évite
// de dupliquer computeSlab ici, ce n'est pas ce que ces tests vérifient.
function celluleBouchon(i, y) {
  const cell = { i, j: 0, terrain: { sample: () => y } }
  cell.baseYPropre = y - 7
  cell.planchierPose = null
  return cell
}

test('egaliseHauteurs dispose l\'ancienne geometrie de mur remplacee, jamais wallMat', () => {
  const { g, wallMatDisposes } = damierMursBouchon(-10)

  const a = celluleBouchon(1, -5) // peu profonde : premiers murs du damier
  g.cells.set('1,0', a)
  g.egaliseHauteurs()
  assert.ok(a.walls, 'la premiere egalisation batit les murs de a')
  const ancienneGeo = a.walls.geometry
  let ancienneDisposee = false
  const disposeOrigine = ancienneGeo.dispose.bind(ancienneGeo)
  ancienneGeo.dispose = () => { ancienneDisposee = true; disposeOrigine() }

  const b = celluleBouchon(2, -40) // bat le record : force le re-coulage de a
  g.cells.set('2,0', b)
  const refaites = g.egaliseHauteurs()

  assert.equal(refaites, 2, 'a ET b doivent etre refaites : le plancher commun a bouge')
  assert.ok(ancienneDisposee, 'l ancienne geometrie de a doit etre disposee')
  assert.notEqual(a.walls.geometry, ancienneGeo, 'a porte desormais une NOUVELLE geometrie')
  assert.equal(wallMatDisposes(), 0, 'wallMat ne doit JAMAIS etre dispose : il est PARTAGE (plinth.js:423-438)')
})

test('une reconstruction ne duplique pas le maillage : un seul ajout a la scene par cellule', () => {
  const { g, sc } = damierMursBouchon(-10)
  const a = celluleBouchon(1, -5)
  g.cells.set('1,0', a)
  g.egaliseHauteurs()
  assert.equal(sc.addCalls, 1, 'la premiere pose ajoute un seul maillage')
  const meshDeA = a.walls

  const b = celluleBouchon(2, -40) // force une deuxieme egalisation de a
  g.cells.set('2,0', b)
  g.egaliseHauteurs()

  assert.equal(sc.addCalls, 2, 'un ajout pour a (deja compte), un pour b — PAS un deuxieme pour a')
  assert.equal(a.walls, meshDeA, 'a garde le MEME Mesh : seule sa geometrie a change, jamais l objet')
  assert.equal(sc.removeCalls, 0, 'une reconstruction ne retire jamais le maillage de la scene')
  assert.ok(sc.present.has(meshDeA), 'le maillage de a est toujours dans la scene, pas retire puis rajoute en double')
})

test('apres egalisation, toutes les cellules partagent le meme fond, et c est le plus bas', () => {
  const { g } = damierMursBouchon(-10)
  const profondeurs = [-5, -40, -12, -8]
  let k = 0
  for (const y of profondeurs) {
    k++
    const cell = celluleBouchon(k, y)
    g.cells.set(`${k},0`, cell)
    g.egaliseHauteurs()
  }
  const plancher = g.planchierCommun()
  assert.equal(plancher, -40 - 7, 'le plancher suit la voisine la plus profonde')
  for (const cell of g.cells.values()) {
    assert.equal(fondDe({ geo: cell.walls.geometry }), plancher, `la cellule ${cell.i} doit finir au plancher commun`)
  }
})

// ═══════════ RONDE DE RELECTURE 1 : LE SEUIL DU BRIEF, VERROUILLÉ ═══════════
// En relecture, cinq ordres d'arrivée TIRÉS AU HASARD (pas pathologiques) ont
// déjà donné des totaux allant jusqu'à 24 sur 8 cellules — le seuil du brief
// est donc atteignable par un ordre d'arrivée ORDINAIRE, pas seulement par un
// cas construit pour nuire. Le pire cas explicite (chaque arrivée bat le
// record de profondeur) est verrouillé ici à une marge de 40 (mesuré : 36
// aujourd'hui). Ce test NE CONTRAINT PAS l'algorithme — il reste sciemment
// O(n²) dans ce cas, cf. le commentaire de egaliseHauteurs() pour l'analyse
// complète et la raison de ne pas le corriger ici — il empêche seulement
// qu'une boucle imbriquée ajoutée sans y penser fasse dériver ce chiffre en
// silence.
test('egaliseHauteurs : le pire cas (profondeur strictement decroissante) reste dans une marge connue', () => {
  const { g } = damierMursBouchon(-10)
  const profondeurs = [-2, -8, -12, -15, -20, -30, -37, -60] // chaque arrivee bat le record
  let total = 0
  let k = 0
  for (const y of profondeurs) {
    k++
    const cell = celluleBouchon(k, y)
    g.cells.set(`${k},0`, cell)
    total += g.egaliseHauteurs()
  }
  assert.ok(total <= 40, `pire cas hors de la marge attendue : ${total} reconstructions pour 8 cellules`)
})
