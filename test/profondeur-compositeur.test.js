// LA PROFONDEUR DU COMPOSITEUR — PF4, bug n° 1 (`GL_INVALID_OPERATION` à
// chaque image composée). Voir l'en-tête de src/profondeur-compositeur.js.
//
//   ① SMAA en détection COULEUR ne réclame plus la profondeur : l'attribut
//      DEPTH tombe, CONVOLUTION reste.
//   ② La copie « stable » du compositeur est une texture à Source DISTINCTE
//      de la vivante — c'est la condition pour que le blit ne copie pas une
//      image sur elle-même. Vérifié sur le VRAI `EffectComposer` de
//      postprocessing, avec un renderer factice : c'est sa méthode privée
//      qu'on enveloppe, donc c'est elle qu'il faut exercer.
//   ③ Le branchement de `main.js`, vérifié sur le texte comme les autres
//      tâches : aucun test de ce dépôt ne charge `main.js`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EffectAttribute, EffectComposer, SMAAEffect, EffectPass, DepthOfFieldEffect } from 'postprocessing'
import { DepthTexture, FloatType, PerspectiveCamera } from 'three'
import { sansLectureDeProfondeur, copieStableDistincte } from '../src/profondeur-compositeur.js'

// un renderer juste assez vrai pour que EffectComposer se construise
function rendererFactice() {
  return {
    getSize: (v) => { v.set(320, 200); return v },
    getDrawingBufferSize: (v) => { v.set(320, 200); return v },
    getPixelRatio: () => 1,
    outputColorSpace: 'srgb',
    getContext: () => ({ getExtension: () => null, getContextAttributes: () => ({ alpha: false }) }),
    capabilities: { isWebGL2: true, maxTextureSize: 4096 },
    setSize() {},
  }
}

test('① SMAA : DEPTH déclaré par la bibliothèque, retiré ici, CONVOLUTION conservé', () => {
  const smaa = new SMAAEffect()
  assert.equal(smaa.getAttributes() & EffectAttribute.DEPTH, EffectAttribute.DEPTH, 'la bibliothèque déclare DEPTH — sinon ce correctif est devenu inutile, à retirer')
  sansLectureDeProfondeur(smaa, EffectAttribute.DEPTH)
  assert.equal(smaa.getAttributes() & EffectAttribute.DEPTH, 0)
  assert.equal(smaa.getAttributes() & EffectAttribute.CONVOLUTION, EffectAttribute.CONVOLUTION)
  // sans effet, sans méthode : on rend ce qu'on reçoit, jamais une levée
  assert.equal(sansLectureDeProfondeur(null), null)
  assert.deepEqual(sansLectureDeProfondeur({}), {})
})

test('① une passe d’effets SMAA-seul ne réclame plus de texture de profondeur', () => {
  const cam = new PerspectiveCamera()
  // `needsDepthTexture` se décide à `initialize()`, donc à `addPass` : on passe par le compositeur
  const avec = new EffectComposer(rendererFactice(), { frameBufferType: FloatType })
  avec.addPass(new EffectPass(cam, new SMAAEffect()))
  assert.ok(avec.depthTexture !== null && avec.depthRenderTarget !== null, 'témoin : sans le correctif, SMAA seul fait monter toute la machinerie de profondeur')
  const sans = new EffectComposer(rendererFactice(), { frameBufferType: FloatType })
  sans.addPass(new EffectPass(cam, sansLectureDeProfondeur(new SMAAEffect(), EffectAttribute.DEPTH)))
  assert.equal(sans.depthTexture, null)
  assert.equal(sans.depthRenderTarget, null)
})

test('② le compositeur nu clone (même Source) ; corrigé, la stable a sa propre Source', () => {
  const cam = new PerspectiveCamera()
  // témoin : la bibliothèque telle quelle
  const nu = new EffectComposer(rendererFactice(), { frameBufferType: FloatType })
  nu.addPass(new EffectPass(cam, new DepthOfFieldEffect(cam)))
  assert.ok(nu.depthTexture && nu.depthRenderTarget, 'le bokeh réclame la profondeur : la machinerie doit exister')
  assert.equal(nu.depthRenderTarget.depthTexture.source, nu.depthTexture.source, 'témoin : amont, la stable partage la Source de la vivante')

  const corrige = copieStableDistincte(new EffectComposer(rendererFactice(), { frameBufferType: FloatType }))
  const passe = new EffectPass(cam, new DepthOfFieldEffect(cam))
  corrige.addPass(passe)
  const stable = corrige.depthRenderTarget.depthTexture
  assert.ok(stable instanceof DepthTexture)
  assert.notEqual(stable.source, corrige.depthTexture.source, 'la stable doit être une image GL distincte')
  assert.notEqual(stable, corrige.depthTexture)
  assert.equal(stable.type, corrige.depthTexture.type, 'même type — le blit exige des formats identiques')
  assert.equal(stable.format, corrige.depthTexture.format)
  // c'est bien la stable qui est distribuée aux passes, comme le fait la bibliothèque
  assert.equal(passe.getDepthTexture(), stable)
  // idempotent : un second appel n'enveloppe pas deux fois
  const encore = copieStableDistincte(corrige)
  assert.equal(encore, corrige)
})

test('② sans profondeur réclamée, rien n’est créé — le correctif ne coûte rien à la composition par défaut', () => {
  const cam = new PerspectiveCamera()
  const c = copieStableDistincte(new EffectComposer(rendererFactice(), { frameBufferType: FloatType }))
  c.addPass(new EffectPass(cam, sansLectureDeProfondeur(new SMAAEffect(), EffectAttribute.DEPTH)))
  assert.equal(c.depthTexture, null)
  assert.equal(c.depthRenderTarget, null)
})

test('③ main.js branche les deux : SMAA sans DEPTH, compositeur à copie distincte', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(main, /copieStableDistincte\(\s*new EffectComposer\(/, 'le compositeur doit être enveloppé à sa création')
  assert.match(main, /sansLectureDeProfondeur\(\s*new SMAAEffect\(\)\s*,\s*EffectAttribute\.DEPTH\s*\)/, 'le SMAA doit perdre DEPTH à sa création')
  // l'échappatoire de mesure existe, et elle coupe LES DEUX correctifs
  assert.match(main, /get\('profondeur'\)\s*===\s*'amont'/)
  assert.match(main, /profondeurAmont\s*\?\s*new SMAAEffect\(\)/)
  assert.match(main, /profondeurAmont\s*\n?\s*\?\s*new EffectComposer\(/)
})
