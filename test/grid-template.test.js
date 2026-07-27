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
