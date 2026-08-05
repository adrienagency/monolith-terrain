import test from 'node:test'
import assert from 'node:assert/strict'
import { bordsExterieurs, masqueDepuisContour } from '../src/damier-bords.js'
import { computeSlab } from '../src/plinth.js'

// convention d'axes de computeSlab : z=-HALF est le NORD, z=+HALF le SUD,
// x=+HALF l'EST, x=-HALF l'OUEST. j croît vers le sud (z croissant).
//
// `cellules` = les cases VOISINES posees. Le bloc central "0,0" n'y figure
// jamais (block-grid.js:178 le saute) mais existe toujours : bordsExterieurs
// doit le savoir sans qu'on le lui passe.
const damier3x3 = new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1'])
const seul = new Set()

test('une case isolee a ses quatre bords exterieurs', () => {
  assert.deepEqual(bordsExterieurs(0, 0, seul),
    { nord: true, est: true, sud: true, ouest: true })
})

test('la case du milieu d\'un 3x3 n\'a AUCUN bord exterieur', () => {
  assert.deepEqual(bordsExterieurs(0, 0, damier3x3),
    { nord: false, est: false, sud: false, ouest: false })
})

test('le coin nord-ouest d\'un 3x3 garde ses deux bords exposes', () => {
  assert.deepEqual(bordsExterieurs(-1, -1, damier3x3),
    { nord: true, est: false, sud: false, ouest: true })
})

test('le bord nord milieu n\'expose que le nord', () => {
  assert.deepEqual(bordsExterieurs(0, -1, damier3x3),
    { nord: true, est: false, sud: false, ouest: false })
})

test('le coin sud-est expose sud et est', () => {
  assert.deepEqual(bordsExterieurs(1, 1, damier3x3),
    { nord: false, est: true, sud: true, ouest: false })
})

// LE BLOC CENTRAL EXISTE TOUJOURS, même absent de l'ensemble des voisines.
// L'oublier donnerait un arrondi au bord d'une case collée au héros — une
// rainure en plein milieu du damier, le défaut exact des captures d'Adrien.
test('une voisine collee au bloc central ne s\'arrondit pas de ce cote', () => {
  const b = bordsExterieurs(1, 0, new Set(['1,0']))
  assert.equal(b.ouest, false, 'a l\'ouest il y a le bloc central')
  assert.equal(b.est, true)
  assert.equal(b.nord, true)
  assert.equal(b.sud, true)
})

// ⚠️ LE CAS QUE LE CARRÉ NE SAVAIT PAS TRAITER. Une zone isolée peut poser
// une figure TROUÉE (deux ilots opposes, block-grid.js:151-153). Deduire les
// bords d'un carre supposé plein declarerait ici l'arete interieure, le socle
// n'aurait pas de mur, et on verrait le jour sous la carte.
test('un damier troue expose les aretes qui n\'ont pas de voisine', () => {
  const troue = new Set(['-1,-1', '1,1']) // deux ilots en diagonale, rien entre
  const b = bordsExterieurs(-1, -1, troue)
  assert.deepEqual(b, { nord: true, est: true, sud: true, ouest: true },
    'aucune voisine adjacente : les quatre aretes restent exposees')
})

// LE MASQUE — c'est lui que le socle consomme, sommet par sommet. On le teste
// sur un VRAI contour rendu par computeSlab, pas sur un contour inventé : le
// but du module est justement de ne pas dupliquer le découpage de plinth.js.
const TOUS = { nord: true, est: true, sud: true, ouest: true }
const AUCUN = { nord: false, est: false, sud: false, ouest: false }
const platA10 = () => 10

function contourCarre(n = 32) {
  const slab = computeSlab(platA10, 7, n)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  return { ring: slab.ring, demi }
}

test('le masque d\'une case isolee vaut 1 partout', () => {
  const { ring, demi } = contourCarre()
  const m = masqueDepuisContour(ring, demi, TOUS)
  assert.equal(m.length, ring.length, 'un reel par sommet du contour')
  for (const v of m) assert.equal(v, 1)
})

test('le masque de la case centrale vaut 0 partout', () => {
  const { ring, demi } = contourCarre()
  for (const v of masqueDepuisContour(ring, demi, AUCUN)) assert.equal(v, 0)
})

// L'ÉTIQUETAGE SE FAIT PAR POSITION, pas par index. Un sommet du bord nord
// est celui dont z vaut -demi ; c'est vrai quel que soit l'ordre dans lequel
// computeSlab a tracé son contour, et ça le restera s'il change.
test('seuls les sommets du cote expose sont marques', () => {
  const { ring, demi } = contourCarre()
  const m = masqueDepuisContour(ring, demi, { nord: true, est: false, sud: false, ouest: false })
  let marques = 0
  for (let k = 0; k < ring.length; k++) {
    if (m[k] === 1) {
      assert.ok(ring[k].z <= -demi + 1e-3, `sommet ${k} marque alors qu'il n'est pas au nord`)
      marques++
    }
  }
  assert.ok(marques > 0, 'le cote nord doit bien etre marque')
})

// UN COIN N'EST ARRONDI QUE SI SES DEUX CÔTÉS LE SONT. Un quart de rond qui
// se termine à plat contre une jointure est pire que pas d'arrondi du tout.
test('un coin entre deux bords exterieurs reste arrondi', () => {
  const slab = computeSlab(platA10, 7, 32, 2.5) // cornerR > 0 : de vrais arcs
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const m = masqueDepuisContour(slab.ring, demi, { nord: true, est: true, sud: false, ouest: false })
  // un sommet d'arc du coin nord-est : x > 0, z < 0, sur aucun des deux bords droits
  const k = slab.ring.findIndex((p) => p.x > 0 && p.z < 0 && p.x < demi - 1e-3 && p.z > -demi + 1e-3)
  assert.ok(k >= 0, 'preambule : il existe bien un sommet d\'arc au nord-est')
  assert.equal(m[k], 1, 'nord et est exposes : le coin garde son arrondi')
})

test('un coin entre un bord exterieur et un interieur ne l\'est pas', () => {
  const slab = computeSlab(platA10, 7, 32, 2.5)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const m = masqueDepuisContour(slab.ring, demi, { nord: true, est: false, sud: false, ouest: false })
  const k = slab.ring.findIndex((p) => p.x > 0 && p.z < 0 && p.x < demi - 1e-3 && p.z > -demi + 1e-3)
  assert.equal(m[k], 0, 'l\'est est interieur : le coin nord-est doit etre vif')
})
