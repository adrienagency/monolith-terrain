// LE GABARIT DE GRILLE EST BIT-IDENTIQUE À PlaneGeometry.
//
// `new THREE.PlaneGeometry(56, 56, 1024, 1024)` met 284 ms et jette 280 Mo de
// tas JS (tableaux JS ordinaires + push, convertis en tableaux typés à la fin)
// pour produire un plan PLAT que Terrain.rebuild réécrit intégralement à la
// ligne suivante. Seuls `uv` et `index` survivent, et X/Z ne dépendent que de
// la résolution. Le gabarit les mémorise. Ce test verrouille l'identité : si
// elle se perd, la silhouette du héros bouge.
//
// ⚠️ On compare à `assert.equal` et non à un epsilon : l'exigence EST le bit à
// bit. Les formules de three.js sont reproductibles exactement, un seul
// flottant qui diffère veut dire que le gabarit est faux.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { gridTemplate, clearGridTemplates } from '../src/grid-template.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

function reference(res, size = TERRAIN_SIZE) {
  const g = new THREE.PlaneGeometry(size, size, res, res)
  g.rotateX(-Math.PI / 2)
  return g
}

// 4 : le cas trivial qu'on peut vérifier à la main.
// 17 : impair, segment 56/17 non représentable en binaire — le cas qui piège
//      une réécriture « équivalente » de x = ix·seg − half.
// 256 : la résolution des voisins du damier.
// 768 : la résolution du bloc central.
for (const res of [4, 17, 256, 768]) {
  test(`gabarit ${res} : positions identiques à PlaneGeometry`, () => {
    const g = reference(res)
    const t = gridTemplate(res, TERRAIN_SIZE)
    const ref = g.attributes.position.array
    assert.equal(t.count, g.attributes.position.count)
    for (let i = 0; i < t.count; i++) {
      assert.equal(t.position[i * 3], ref[i * 3], `X du sommet ${i}`)
      assert.equal(t.position[i * 3 + 1], 0, `Y du sommet ${i} doit partir à 0`)
      assert.equal(t.position[i * 3 + 2], ref[i * 3 + 2], `Z du sommet ${i}`)
    }
  })

  test(`gabarit ${res} : uv identiques à PlaneGeometry`, () => {
    const ref = reference(res).attributes.uv.array
    const t = gridTemplate(res, TERRAIN_SIZE)
    for (let i = 0; i < t.count * 2; i++) assert.equal(t.uv[i], ref[i], `uv[${i}]`)
  })

  test(`gabarit ${res} : index identiques à PlaneGeometry`, () => {
    const ref = reference(res).index.array
    const t = gridTemplate(res, TERRAIN_SIZE)
    assert.equal(t.index.length, ref.length)
    for (let i = 0; i < ref.length; i++) assert.equal(t.index[i], ref[i], `index[${i}]`)
  })
}

// Le socle (plinth.js) et le damier appellent la même géométrie sur d'autres
// tailles : l'identité ne doit pas tenir qu'à TERRAIN_SIZE.
test('gabarit : l’identité tient aussi pour une autre taille de bloc', () => {
  const size = 37.5
  const g = reference(12, size)
  const t = gridTemplate(12, size)
  const ref = g.attributes.position.array
  for (let i = 0; i < t.count; i++) {
    assert.equal(t.position[i * 3], ref[i * 3], `X du sommet ${i}`)
    assert.equal(t.position[i * 3 + 2], ref[i * 3 + 2], `Z du sommet ${i}`)
  }
})

test('le gabarit est mémorisé : deux appels rendent le MÊME objet', () => {
  clearGridTemplates()
  const a = gridTemplate(8, TERRAIN_SIZE)
  const b = gridTemplate(8, TERRAIN_SIZE)
  assert.equal(a, b)
  assert.equal(a.position, b.position)
})

test('une taille différente ne réutilise pas le gabarit', () => {
  clearGridTemplates()
  assert.notEqual(gridTemplate(8, TERRAIN_SIZE), gridTemplate(8, TERRAIN_SIZE * 2))
})

test('clearGridTemplates repart de zéro', () => {
  clearGridTemplates()
  const a = gridTemplate(8, TERRAIN_SIZE)
  clearGridTemplates()
  assert.notEqual(gridTemplate(8, TERRAIN_SIZE), a)
})

// ⚠️ Le gabarit est PARTAGÉ : deux blocs du damier à la même résolution
// reçoivent le même objet. Si `rebuild` écrivait ses Y dedans au lieu d'en
// prendre une copie, le second bloc hériterait du relief du premier.
test('un Y écrit dans une COPIE ne salit pas le gabarit partagé', () => {
  clearGridTemplates()
  const t = gridTemplate(8, TERRAIN_SIZE)
  const copie = new Float32Array(t.position)
  copie[1] = 12.5
  assert.equal(t.position[1], 0, 'le gabarit doit rester plat')
  assert.equal(gridTemplate(8, TERRAIN_SIZE).position[1], 0)
})

// --------------------------------------------------------------- la BORNE
//
// Le cache n'en avait aucune. Le sélecteur « Résolution du maillage » offre
// 256 / 384 / 512 / 768 / 1024 / 2048 : le balayer une fois retenait 264,9 Mo
// à vie. Ces deux tests verrouillent les deux moitiés du compromis — le cache
// oublie, ET il n'oublie pas ce dont le damier a besoin.

// ⚠️ Les résolutions du VRAI sélecteur, en une seule passe : c'est le geste que
// le test doit décrire. (2048 alloue 176 Mo à lui seul — d'où la passe unique.)
test('le cache OUBLIE : balayer le sélecteur ne retient pas six gabarits', () => {
  clearGridTemplates()
  const SELECTEUR = [256, 384, 512, 768, 1024, 2048]
  const premier = gridTemplate(SELECTEUR[0], TERRAIN_SIZE)
  for (const r of SELECTEUR.slice(1)) gridTemplate(r, TERRAIN_SIZE)
  assert.notEqual(gridTemplate(SELECTEUR[0], TERRAIN_SIZE), premier, 'res 256 aurait dû être évincée par le balayage')
  clearGridTemplates() // ne pas laisser 176 Mo derrière soi pour les tests suivants
})

// ⚠️ LE TEST QUI FIXE LA BORNE À 2 ET PAS À 1. Le damier a besoin de DEUX
// gabarits vivants en permanence : celui du bloc central et celui des voisines
// (res 256, block-grid.js). Avec une seule entrée, chaque dalle bâtie chasserait
// le héros et le héros chasserait les dalles — le gabarit serait recuit à chaque
// construction, ce qui annulerait exactement ce que le module est venu faire.
test('le damier garde héros ET voisines vivants : alterner deux résolutions ne recuit rien', () => {
  clearGridTemplates()
  const heros = gridTemplate(768, TERRAIN_SIZE)
  const voisine = gridTemplate(256, TERRAIN_SIZE)
  // vingt-quatre dalles bâties entre deux reconstructions du bloc central
  for (let i = 0; i < 24; i++) {
    assert.equal(gridTemplate(256, TERRAIN_SIZE), voisine, `dalle ${i} : gabarit voisin recuit`)
    assert.equal(gridTemplate(768, TERRAIN_SIZE), heros, `dalle ${i} : gabarit du héros recuit`)
  }
})

// La contrepartie honnête de la borne : une TROISIÈME résolution évince, et
// c'est le comportement voulu — le plus ANCIENNEMENT SERVI part, pas le plus
// anciennement cuit. Sans le rafraîchissement à la lecture, le héros (cuit en
// premier, relu sans cesse) serait le premier évincé.
test('la victime est la moins récemment SERVIE, pas la plus vieille', () => {
  clearGridTemplates()
  const a = gridTemplate(8, TERRAIN_SIZE)
  gridTemplate(16, TERRAIN_SIZE)
  assert.equal(gridTemplate(8, TERRAIN_SIZE), a, 'a doit encore être là')
  gridTemplate(32, TERRAIN_SIZE) // évince 16, le moins récemment servi
  assert.equal(gridTemplate(8, TERRAIN_SIZE), a, 'a vient d’être servi : il reste')
})
