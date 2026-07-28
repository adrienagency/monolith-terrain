// LA CARTE D'OMBRE PARESSEUSE — ce que ces tests protègent.
//
// Le gain (0,55 ms et 1 188 328 triangles par image, soit 26 % du temps GPU
// mesuré en production) vient d'une seule chose : ne pas redessiner la carte
// quand rien n'a bougé. Le risque, lui, est asymétrique — une image redessinée
// pour rien coûte une image ; une image PAS redessinée quand il fallait laisse
// une ombre fausse ou manquante à l'écran, et ça se lit comme une panne.
//
// Donc tout ce qui suit vérifie la même chose sous seize angles : la signature
// change dès que quoi que ce soit qui dessine la carte change.
import test from 'node:test'
import assert from 'node:assert/strict'
import { signatureCarteOmbre } from '../src/carte-ombre.js'

const IDENTITE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const caster = (o = {}) => ({ id: 7, geo: 3, pv: 0, count: 1200, visible: true, m: IDENTITE, ...o })
const etat = (o = {}) => ({ soleil: { x: 12, y: 20, z: -8 }, res: 2048, flou: 4, casters: [caster()], ...o })

test('même état, même signature — c’est ce qui permet de ne rien redessiner', () => {
  assert.equal(signatureCarteOmbre(etat()), signatureCarteOmbre(etat()))
})

// ---- le soleil ---------------------------------------------------------------

test('le soleil qui bouge change la signature — l’ombre doit suivre la tirette des 24 h', () => {
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ soleil: { x: 12.1, y: 20, z: -8 } })))
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ soleil: { x: 12, y: 20.5, z: -8 } })))
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ soleil: { x: 12, y: 20, z: -7.9 } })))
})

test('un frémissement sous 1e-4 ne redessine pas : le bruit de virgule flottante n’est pas un mouvement', () => {
  assert.equal(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ soleil: { x: 12.000001, y: 20, z: -8 } })))
})

// ---- les réglages de la carte ------------------------------------------------

test('changer la résolution d’ombre redessine (la carte est réallouée)', () => {
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ res: 1024 })))
})

test('changer l’adoucissement redessine — le flou VSM est cuit DANS la carte', () => {
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ flou: 8 })))
})

// ---- les projeteurs ----------------------------------------------------------

test('un projeteur qui apparaît redessine — une dalle voisine qui arrive doit poser son ombre', () => {
  const avant = signatureCarteOmbre(etat())
  const apres = signatureCarteOmbre(etat({ casters: [caster(), caster({ id: 9, geo: 4 })] }))
  assert.notEqual(avant, apres)
})

test('un projeteur qu’on cache redessine — son ombre doit partir avec lui', () => {
  const avant = signatureCarteOmbre(etat())
  const apres = signatureCarteOmbre(etat({ casters: [caster({ visible: false })] }))
  assert.notEqual(avant, apres)
})

test('un projeteur invisible ne pèse pas dans la signature : caché ou absent, c’est le même dessin', () => {
  const cache = signatureCarteOmbre(etat({ casters: [caster(), caster({ id: 9, visible: false })] }))
  const absent = signatureCarteOmbre(etat({ casters: [caster()] }))
  assert.equal(cache, absent)
})

test('un projeteur qui se déplace redessine', () => {
  const bouge = [...IDENTITE]; bouge[13] = 2.5 // translation en Y
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ m: bouge })] })))
})

test('un projeteur qui tourne ou change d’échelle redessine aussi — la position seule ne suffisait pas', () => {
  const tourne = [...IDENTITE]; tourne[0] = 0; tourne[2] = -1; tourne[8] = 1; tourne[10] = 0
  const grossit = [...IDENTITE]; grossit[0] = 2; grossit[5] = 2; grossit[10] = 2
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ m: tourne })] })))
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ m: grossit })] })))
})

test('une géométrie remplacée redessine — le relief reconstruit change d’identifiant', () => {
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ geo: 88 })] })))
})

test('des sommets réécrits EN PLACE redessinent — même géométrie, autre relief', () => {
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ pv: 1 })] })))
  assert.notEqual(signatureCarteOmbre(etat()), signatureCarteOmbre(etat({ casters: [caster({ count: 1201 })] })))
})

// ---- robustesse : la règle ne doit jamais jeter ni rendre une signature figée -

test('un état vide ou incomplet donne une signature, pas une exception', () => {
  assert.equal(signatureCarteOmbre(null), '')
  assert.equal(signatureCarteOmbre(undefined), '')
  assert.equal(typeof signatureCarteOmbre({}), 'string')
  assert.equal(typeof signatureCarteOmbre({ soleil: {}, casters: null }), 'string')
})

test('un soleil non fini ne se confond pas avec un soleil à l’origine', () => {
  const nan = signatureCarteOmbre(etat({ soleil: { x: NaN, y: NaN, z: NaN } }))
  const zero = signatureCarteOmbre(etat({ soleil: { x: 0, y: 0, z: 0 } }))
  assert.notEqual(nan, zero)
})

test('la signature accepte un tableau typé pour la matrice (matrixWorld.elements est un Float32Array)', () => {
  const typee = signatureCarteOmbre(etat({ casters: [caster({ m: Float32Array.from(IDENTITE) })] }))
  assert.equal(typee, signatureCarteOmbre(etat()))
})
