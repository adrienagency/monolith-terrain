// UN MATÉRIAU POUR TOUTES LES TUILES — PF4, levier n° 1 de PF1.
// Voir src/monde/materiau-tuile.js.
//
//   ① la fabrique rend LE MÊME matériau à toutes les tuiles ; en `amont` un
//      par tuile, comme avant ; jeter une tuile ne jette jamais le partagé
//   ② `avantDessinTuile` pose les six valeurs propres et demande le
//      téléversement ; un matériau emprunté (sans `uTex`) est laissé en paix
//   ③ la photo s'écrit sur le maillage (partagé) ou dans les uniformes (propre)
//   ④ `_buildMesh` — LA VRAIE MÉTHODE, empruntée comme dans globe-precision —
//      équipe la tuile et fige sa matrice : `matrixAutoUpdate = false`,
//      matrice = position, et rien ne bouge à l'échelle du globe (la matrice
//      composée vaut celle que three composerait)
//   ⑤ globe.js : le groupe est figé, la mer et les parois recomposent leur
//      matrice à la pose, les quatre dispose() passent par la fabrique

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { Globe } from '../src/globe.js'
import { latLonToTile, tileToLatLon, latLonToSphere } from '../src/geo.js'
import { creerFabriqueMateriau, avantDessinTuile, valeursTuile, habillerPhotoTuile, amontDemande, libererMateriauTuile } from '../src/monde/materiau-tuile.js'

const creer = (texture, tilePx, uv) => new THREE.ShaderMaterial({ uniforms: { uTex: { value: texture }, uTilePx: { value: tilePx }, uUvParMonde: { value: uv }, uPhoto: { value: null }, uPhotoOn: { value: 0 }, uPhotoUv: { value: new THREE.Vector4(0, 0, 1, 1) } } })

test('① un seul matériau pour toutes les tuiles — un par tuile en amont — jamais jeté', () => {
  const f = creerFabriqueMateriau({ creer })
  const a = f.pour(null, 256, 1)
  const b = f.pour(new THREE.Texture(), 512, 0.5)
  assert.equal(a, b, 'le matériau doit être partagé')
  assert.equal(f.partage, a)
  assert.equal(a.uniforms.uTilePx.value, 512, 'le partagé porte les dernières valeurs demandées (contrat de _materialFor)')
  assert.equal(a.uniforms.uUvParMonde.value, 0.5)
  let jete = 0
  a.dispose = () => { jete++ }
  f.liberer(new THREE.Mesh(new THREE.BufferGeometry(), a))
  assert.equal(jete, 0, 'jeter une tuile ne jette pas le partagé')
  const propre = new THREE.MeshBasicMaterial()
  propre.dispose = () => { jete++ }
  f.liberer(new THREE.Mesh(new THREE.BufferGeometry(), propre))
  assert.equal(jete, 1, 'un matériau propre est bien jeté')
  assert.doesNotThrow(() => f.liberer(null))
  // depuis une méthode empruntée sans fabrique : un dispose() ordinaire
  const nu = new THREE.MeshBasicMaterial(); nu.dispose = () => { jete++ }
  libererMateriauTuile({}, new THREE.Mesh(new THREE.BufferGeometry(), nu))
  assert.equal(jete, 2)
  libererMateriauTuile({ _fabriqueMateriau: f }, new THREE.Mesh(new THREE.BufferGeometry(), a))
  assert.equal(jete, 2, 'avec la fabrique : le partagé est épargné')
  const amont = creerFabriqueMateriau({ creer, amont: true })
  assert.notEqual(amont.pour(null), amont.pour(null), 'amont : un matériau par tuile')
  assert.equal(amont.partage, null)
  assert.equal(amontDemande('tuiles'), false, 'sans location (node), jamais amont')
})

test('② avantDessinTuile pose les valeurs propres et demande le téléversement', () => {
  const f = creerFabriqueMateriau({ creer })
  const m = f.pour(null)
  const tex = new THREE.Texture()
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m)
  assert.equal(f.equiper(mesh, tex, 128, 0.25), true)
  assert.equal(mesh.onBeforeRender, avantDessinTuile)
  mesh.userData.tuile.uPhotoOn = 1
  mesh.userData.tuile.uPhotoUv.set(0.1, 0.2, 0.3, 0.4)
  m.uniformsNeedUpdate = false
  avantDessinTuile.call(mesh, null, null, null, mesh.geometry, m)
  assert.equal(m.uniforms.uTex.value, tex)
  assert.equal(m.uniforms.uTilePx.value, 128)
  assert.equal(m.uniforms.uUvParMonde.value, 0.25)
  assert.equal(m.uniforms.uPhotoOn.value, 1)
  assert.deepEqual(m.uniforms.uPhotoUv.value.toArray(), [0.1, 0.2, 0.3, 0.4])
  assert.equal(m.uniformsNeedUpdate, true, 'sans ce drapeau three ne téléverse pas un matériau déjà vu')
  // matériau emprunté (sans uTex) : rien, et equiper refuse un matériau qui n'est pas le partagé
  const basic = new THREE.MeshBasicMaterial()
  const autre = new THREE.Mesh(new THREE.BufferGeometry(), basic)
  assert.equal(f.equiper(autre, null, 256, 1), false)
  autre.userData.tuile = valeursTuile(null)
  assert.doesNotThrow(() => avantDessinTuile.call(autre, null, null, null, autre.geometry, basic))
})

test('③ la photo : sur le maillage quand le matériau est partagé, dans les uniformes sinon', () => {
  const f = creerFabriqueMateriau({ creer })
  const m = f.pour(null)
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m)
  f.equiper(mesh, null, 256, 1)
  const tex = new THREE.Texture()
  assert.equal(habillerPhotoTuile(mesh, { tex, ox: 1, oy: 2, sx: 3, sy: 4 }), true)
  assert.equal(mesh.userData.tuile.uPhoto, tex)
  assert.equal(mesh.userData.tuile.uPhotoOn, 1)
  assert.deepEqual(mesh.userData.tuile.uPhotoUv.toArray(), [1, 2, 3, 4])
  assert.equal(m.uniforms.uPhotoOn.value, 0, 'le partagé ne porte la photo qu’au moment du dessin de CETTE tuile')
  habillerPhotoTuile(mesh, null)
  assert.equal(mesh.userData.tuile.uPhotoOn, 0)
  assert.equal(mesh.userData.tuile.uPhoto, null)
  // matériau propre (amont) : dans les uniformes, comme avant
  const propre = new THREE.Mesh(new THREE.BufferGeometry(), creer(null, 256, 1))
  habillerPhotoTuile(propre, { tex, ox: 1, oy: 2, sx: 3, sy: 4 })
  assert.equal(propre.material.uniforms.uPhoto.value, tex)
  assert.equal(propre.material.uniforms.uPhotoOn.value, 1)
  habillerPhotoTuile(propre, null)
  assert.equal(propre.material.uniforms.uPhoto.value, null)
  // matériau emprunté : rien à habiller
  assert.equal(habillerPhotoTuile(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()), null), false)
})

// la même fixture que globe-precision : la VRAIE _buildMesh sur un objet minimal
function tuileDeTest(z, lat, lon) {
  const brut = latLonToTile(lat, lon, z)
  const x = Math.floor(brut.x), y = Math.floor(brut.y)
  const nw = tileToLatLon(x, y, z), se = tileToLatLon(x + 1, y + 1, z)
  return { key: `${z}/${x}/${y}`, z, x, y, state: 'ready', heights: new Float32Array(256 * 256).fill(1000), texture: new THREE.Texture(), size: 256, mesh: null, lastUsed: 0,
    center: latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2), chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)) }
}
function fauxGlobe(fab, matricesAuto = false) {
  return {
    exaggeration: 18, group: new THREE.Group(), _parois: null, _crop: null, _baseYCrop: null,
    _fabriqueMateriau: fab, _materialFor: fab.pour, _matricesAuto: matricesAuto,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
  }
}

test('④ _buildMesh équipe la tuile et fige sa matrice — la matrice composée est celle de three', () => {
  const fab = creerFabriqueMateriau({ creer })
  const g = fauxGlobe(fab)
  const t = tuileDeTest(6, 45.9, 6.13)
  Globe.prototype._buildMesh.call(g, t)
  const mesh = t.mesh
  assert.equal(mesh.material, fab.partage)
  assert.equal(mesh.userData.tuile.uTex, t.texture)
  assert.equal(mesh.userData.tuile.uTilePx, 256)
  assert.equal(mesh.userData.tuile.uUvParMonde, 2 ** -6)
  assert.equal(mesh.onBeforeRender, avantDessinTuile)
  assert.equal(mesh.matrixAutoUpdate, false)
  // DE LOIN : la matrice figée est EXACTEMENT celle que three composerait
  const attendu = new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale)
  assert.deepEqual(mesh.matrix.toArray(), attendu.toArray())
  assert.ok(mesh.position.length() > 90, 'la tuile est posée sur la sphère (rayon ~100), pas à l’origine')
  // et le monde : groupe figé + scène figée ⇒ matrixWorld = matrix après un updateMatrixWorld sans force
  const scene = new THREE.Scene(); scene.updateMatrix(); scene.matrixAutoUpdate = false
  g.group.updateMatrix(); g.group.matrixAutoUpdate = false
  scene.add(g.group)
  scene.updateMatrixWorld()
  assert.deepEqual(mesh.matrixWorld.toArray(), attendu.toArray())
  // amont : matrice automatique, comme avant
  const t2 = tuileDeTest(6, 45.9, 6.13)
  Globe.prototype._buildMesh.call(fauxGlobe(creerFabriqueMateriau({ creer, amont: true }), true), t2)
  assert.equal(t2.mesh.matrixAutoUpdate, true)
  assert.equal(t2.mesh.userData.tuile, undefined)
})

test('⑤ globe.js : groupe figé, mer et parois recomposées à la pose, dispose() par la fabrique', () => {
  const src = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  assert.match(src, /this\.group\.updateMatrix\(\); this\.group\.matrixAutoUpdate = false/)
  assert.equal([...src.matchAll(/M\.decompose\(mesh\.position, mesh\.quaternion, mesh\.scale\)\n\s*if \(!this\._matricesAuto\) \{ mesh\.updateMatrix\(\); mesh\.matrixAutoUpdate = false \}/g)].length, 2, 'la mer ET les parois')
  assert.equal((src.match(/t\.mesh\.material\.dispose\(\)/g) || []).length, 0, 'plus aucun dispose() direct sur un matériau de tuile')
  assert.equal((src.match(/libererMateriauTuile\(this, t\.mesh\)/g) || []).length, 4)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /sceneGlobe\.updateMatrix\(\); sceneGlobe\.matrixAutoUpdate = false/, 'la scène du globe doit être figée aussi, sinon three force la recomposition de toutes les tuiles')
})
