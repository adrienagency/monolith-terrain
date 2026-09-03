// MÉMO PAR EMPREINTE — PF4, levier n° 3 de PF1 (contexteCrop reconstruit par image).
// Voir src/memo-empreinte.js.
//
//   ① la loi : même empreinte → même objet, aucune reconstruction ; une valeur
//      qui bouge → reconstruction ; NaN vaut NaN ; une longueur qui change compte
//   ② `empiler` : couleur → 3, vecteurs → composantes, texture → identité
//   ③ main.js : l'empreinte de `contexteCrop` couvre CHAQUE uniforme du socle
//      (énumérés depuis le texte du constructeur, au chargement) et CHAQUE
//      paramètre lus par le constructeur — vérifié sur le texte
//   ④ la chaîne du crop reçoit le mémo ; `?crop=amont` reconstruit à chaque appel

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { creerMemoEmpreinte, memeEmpreinte, empiler } from '../src/memo-empreinte.js'

test('① la loi du mémo', () => {
  let x = 1, y = NaN
  let constructions = 0
  const memo = creerMemoEmpreinte(() => [x, y], () => ({ n: ++constructions }))
  const a = memo()
  assert.equal(memo(), a, 'même empreinte : même objet')
  assert.equal(constructions, 1)
  y = NaN
  assert.equal(memo(), a, 'NaN vaut NaN : pas de reconstruction par image')
  x = 2
  const b = memo()
  assert.notEqual(b, a)
  assert.equal(constructions, 2)
  assert.equal(memeEmpreinte([1, 2], [1, 2, 3]), false)
  assert.equal(memeEmpreinte(null, [1]), false)
  const tex = {}
  assert.equal(memeEmpreinte([tex, 'a'], [tex, 'a']), true)
  assert.equal(memeEmpreinte([tex], [{}]), false, 'une texture se compare par identité')
  // le tableau d'empreinte peut être RÉUTILISÉ par le lecteur : le mémo en garde une copie
  const partage = []
  let v = 1
  const memo2 = creerMemoEmpreinte(() => { partage.length = 0; partage.push(v); return partage }, () => ({ v }))
  const p = memo2()
  v = 2
  assert.notEqual(memo2(), p, 'une valeur qui bouge dans le tableau réutilisé est vue')
})

test('② empiler', () => {
  const e = []
  empiler(e, new THREE.Color(0.5, 0.25, 1))
  empiler(e, new THREE.Vector2(1, 2))
  empiler(e, new THREE.Vector3(3, 4, 5))
  empiler(e, new THREE.Vector4(6, 7, 8, 9))
  const tex = new THREE.Texture()
  empiler(e, tex)
  empiler(e, null)
  empiler(e, 'x')
  empiler(e, 42)
  assert.deepEqual(e, [0.5, 0.25, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, tex, null, 'x', 42])
})

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const entre = (debut, fin) => {
  const i = main.indexOf(debut)
  assert.ok(i > 0, debut + ' introuvable')
  const j = main.indexOf(fin, i)
  assert.ok(j > i, fin + ' introuvable')
  return main.slice(i, j)
}

test('③ l’empreinte couvre chaque uniforme du socle et chaque paramètre lus par le constructeur', () => {
  const constructeur = entre('function contexteCrop()', '\n  return ctx\n}')
  const empreinte = entre('function empreinteContexteCrop()', '\nconst memoContexteCrop')
  const matiere = entre('function matiereDuCrop()', '\nfunction ')
  const assiette = entre('function assietteCrop()', '\nfunction ')
  const source = constructeur + matiere + assiette
  // les uniformes : CHACUN relu un par un, `terrain.mapUniforms.uX?.value` — jamais en bloc
  const uniformes = new Set([...source.matchAll(/mapUniforms\.(u\w+)/g)].map((m) => m[1]))
  assert.ok(uniformes.size > 40, 'le constructeur lit des dizaines d’uniformes : ' + uniformes.size)
  for (const u of uniformes) assert.ok(empreinte.includes('terrain.mapUniforms.' + u + '?.value'), 'uniforme lu par le constructeur mais absent de l’empreinte : ' + u)
  assert.equal(/=\s*terrain\.mapUniforms\s*$/m.test(empreinte), false, 'pas de poignée sur le bloc d’uniformes')
  // les paramètres : nommés un par un
  const parametres = new Set([...source.matchAll(/\bparams\.(\w+)/g)].map((m) => m[1]))
  assert.ok(parametres.size >= 4, 'le constructeur lit des paramètres : ' + [...parametres].join(', '))
  for (const p of parametres) assert.ok(new RegExp('\\bparams\\.' + p + '\\b').test(empreinte), 'paramètre lu mais absent de l’empreinte : params.' + p)
  // l'exagération : le constructeur passe par lireExageration(params) ; l'empreinte relit ses DEUX
  // sources (exagPartage.valeur, demExaggeration) sans rappeler la fonction — test/exageration-globe
  // compte les appels de lireExageration dans main.js, et le compte est celui du plan
  assert.match(constructeur, /lireExageration\(params\)/)
  // exagPartage est le SEUL stockage de l'exagération (creerExagerationPartagee) ; test/exageration-globe
  // interdit l'ancien `params.demExaggeration` à tout lecteur
  assert.match(empreinte, /params\.exagPartage\?\.valeur/)
  assert.equal(/demExaggeration/.test(empreinte), false)
  assert.equal(/lireExageration\(/.test(empreinte), false)
  // les autres sources vivantes, nommées une par une
  for (const s of ['assietteCrop()', 'sun.color', 'sun.intensity', 'hemi.color', 'hemi.groundColor', 'hemi.intensity', 'fillLight.color', 'fillLight.intensity',
    'scene.environment', 'scene.environmentIntensity', 'plinth?.depth', 'plinth?.wallMat?.envMap', 'plinth?.wallMat?.color', 'terrain.material', 'terrain.materialMode',
    'terrain.fenetreBornee', 'dem?.extentMeters', 'dem?.empriseCote', 'dem?.maxM', 'altitudeCadrageM()', 'fluxMerPret()', 'bathy?.prete', 'camGlobe?.fov', 'renderer.domElement?.clientHeight']) {
    assert.ok(empreinte.includes(s), 'source vivante absente de l’empreinte : ' + s)
  }
})

test('④ la chaîne du crop reçoit le mémo, et ?crop=amont reconstruit à chaque appel', () => {
  const f = entre('function contexteCropMemo()', '\n}')
  assert.match(f, /amontDemande\('crop'\)\s*\?\s*contexteCrop\(\)\s*:\s*memoContexteCrop\(\)/)
  assert.match(main, /contexte:\s*contexteCropMemo,/, 'veilleCrop doit recevoir le mémo, pas le constructeur')
})
