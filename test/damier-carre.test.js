import test from 'node:test'
import assert from 'node:assert/strict'
import { carreCouvrant, cellulesDuCarre, carreSousPlafond } from '../src/damier-carre.js'

// LE CARRÉ CONTIENT TOUJOURS LE BLOC CENTRAL. C'est le héros : il porte le
// cartouche, la rampe hypso partagée et le zéro vertical de tout le damier.
// Un carré qui l'exclurait laisserait un bloc orphelin hors grille.
test('une entrée vide rend le carré 1x1 centré sur le bloc principal', () => {
  assert.deepEqual(carreCouvrant([]), { i0: 0, j0: 0, cote: 1 })
  assert.deepEqual(carreCouvrant(null), { i0: 0, j0: 0, cote: 1 })
})

test('une seule cellule voisine impose un carré 2x2 contenant le centre', () => {
  const c = carreCouvrant(['1,0'])
  assert.equal(c.cote, 2)
  const cl = cellulesDuCarre(c)
  assert.ok(cl.has('1,0'), 'la cellule demandée est dedans')
  // le centre est dans le carré mais PAS dans la liste des voisines
  assert.ok(!cl.has('0,0'), 'le bloc central ne fait pas partie du damier')
  assert.equal(cl.size, 3, 'un carré 2x2 = 4 cases, moins le centre')
})

test('deux coins opposés donnent le carré 3x3 complet, trous bouchés', () => {
  const c = carreCouvrant(['-1,-1', '1,1'])
  assert.deepEqual(c, { i0: -1, j0: -1, cote: 3 })
  const cl = cellulesDuCarre(c)
  assert.equal(cl.size, 8, '9 cases moins le centre')
  // LE COEUR DE LA DEMANDE : une case que le tracé ne traverse pas est
  // quand même chargée, sinon le damier est troué.
  assert.ok(cl.has('0,1'), 'la case non traversée est bouchée')
  assert.ok(cl.has('-1,0'), 'idem')
})

test('un tracé en L ne reste pas en L : le carré le remplit', () => {
  const cl = cellulesDuCarre(carreCouvrant(['0,1', '1,1']))
  assert.ok(cl.has('1,0'), "le creux du L est bouché")
})

// LE PLAFOND EST UN CÔTÉ, PAS UN COMPTE. Rejeter case par case au-delà de
// GRID_R (le code d'avant) rendait des formes trouées ; plafonner le CÔTÉ
// garde la forme carrée quoi qu'il arrive.
test('un tracé qui déborde est ramené à 3x3 sans trou', () => {
  const c = carreCouvrant(['-2,-2', '2,2'])
  assert.equal(c.cote, 3, 'plafonné à 3')
  const cl = cellulesDuCarre(c)
  assert.equal(cl.size, 8)
  for (const k of cl) {
    const [i, j] = k.split(',').map(Number)
    assert.ok(Math.abs(i) <= 1 && Math.abs(j) <= 1, `${k} hors 3x3`)
  }
})

// RÉGRESSION — bug trouvé en implémentant ce module : ancre() appliquait la
// correction « rester au plus près de la boîte demandée » (a<=min puis
// a+côté-1>=max) sans jamais vérifier que la boîte TIENT dans le côté. Sur
// un débordement (boîte 5x5 plafonnée à 3), les deux corrections se
// contredisent l'une l'autre et la dernière (a+côté-1>=max) l'emportait sans
// raison : elle ramenait l'ancre à 0 au lieu de -1, un carré [0,2] qui
// contient bien le zéro mais PAS symétriquement — la case '2,0' sort du
// 3x3 attendu et le test précédent échouait déjà dessus avant correction.
test('un tracé qui déborde est recentré sur le zéro, pas collé au bord max', () => {
  assert.deepEqual(carreCouvrant(['-2,-2', '2,2']), { i0: -1, j0: -1, cote: 3 })
})

test('le carré est déterministe : même entrée, même sortie', () => {
  const a = carreCouvrant(['1,0', '0,1'])
  const b = carreCouvrant(['0,1', '1,0'])
  assert.deepEqual(a, b, "l'ordre d'itération ne doit rien changer")
})

// LE PALIER MACHINE DEVIENT EFFECTIF. Avant ce plan, damierMax était calculé
// puis ignoré : une machine de palier 3 pouvait charger 24 voisines.
test('le plafond machine rétrécit le carré au lieu de le trouer', () => {
  const plein = carreCouvrant(['-1,-1', '1,1']) // 8 voisines
  const bride = carreSousPlafond(plein, 4)
  assert.equal(bride.cote, 2, '8 voisines > 4 : on descend à 2x2 (3 voisines)')
  assert.ok(cellulesDuCarre(bride).size <= 4)
})

test('un plafond large laisse le carré intact', () => {
  const plein = carreCouvrant(['-1,-1', '1,1'])
  assert.deepEqual(carreSousPlafond(plein, 24), plein)
})

test('le carré rétréci contient toujours le bloc central', () => {
  const bride = carreSousPlafond(carreCouvrant(['-1,-1', '1,1']), 0)
  assert.equal(bride.cote, 1)
  assert.equal(cellulesDuCarre(bride).size, 0, 'plus aucune voisine')
})
