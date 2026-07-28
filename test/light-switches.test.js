// Les DEUX INTERRUPTEURS de lumière : soleil (allumé par défaut) et appoint
// (éteint par défaut).
//
// ⚠️ Ce que ces tests protègent, c'est que « éteindre » veut dire INTENSITÉ 0,
// jamais « retirer la lampe de la scène ». three.js recompile tous les
// programmes quand le NOMBRE de lumières change ; la variante paresseuse
// (créer l'appoint au premier clic) a été chronométrée à 1 923 ms de gel, bloc
// seul, damier vide, contre 1,0-1,5 ms pour une bascule à compte constant.
// Si quelqu'un réintroduit un scene.add/remove derrière ces interrupteurs, ce
// sont ces fonctions-là qui n'auront plus de sens.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fillLightIntensity, fillEnabledInLook, sunOn, sunShadowOn } from '../src/daycycle.js'
import { TEMPLATE_KEYS } from '../src/templates-user.js'

// ---- appoint : intensité effective ------------------------------------------

test('appoint éteint = 0 exactement, quelle que soit l’intensité réglée', () => {
  assert.equal(fillLightIntensity(false, 2.5), 0)
  assert.equal(fillLightIntensity(undefined, 2.5), 0)
})

test('appoint allumé rend son intensité, bornée à [0, 4] comme avant', () => {
  assert.equal(fillLightIntensity(true, 1.4), 1.4)
  assert.equal(fillLightIntensity(true, 99), 4)
  assert.equal(fillLightIntensity(true, -3), 0)
  assert.equal(fillLightIntensity(true, undefined), 0)
  assert.equal(fillLightIntensity(true, NaN), 0)
})

// ---- soleil : absent = allumé ------------------------------------------------
//
// Ce défaut-là n'est pas un goût, c'est la compatibilité : un gabarit
// enregistré AVANT ces interrupteurs ne porte pas la clé, et il doit rendre
// exactement l'image d'avant — donc soleil allumé.

test('soleil : la clé absente vaut ALLUMÉ, un vieux gabarit ne doit pas éteindre le soleil', () => {
  assert.equal(sunOn(undefined), true)
  assert.equal(sunOn(null), true)
  assert.equal(sunOn(true), true)
})

test('soleil : seul false éteint', () => {
  assert.equal(sunOn(false), false)
})

// ---- soleil : l’ombre suit l’interrupteur -----------------------------------
//
// La carte d'ombre fait 2048×2048 : c'est le vrai poste coûteux du soleil.
// L'interrupteur passe par le MÊME chemin que params.shadowMode ('off') pour
// que main.js n'ait qu'un seul endroit à libérer.

test('soleil éteint : aucune ombre, quel que soit le mode d’ombre', () => {
  assert.equal(sunShadowOn(false, 'dynamic'), false)
  assert.equal(sunShadowOn(false, 'static'), false)
  assert.equal(sunShadowOn(false, 'off'), false)
})

test('soleil allumé : c’est shadowMode qui décide, comme avant', () => {
  assert.equal(sunShadowOn(true, 'dynamic'), true)
  assert.equal(sunShadowOn(true, 'static'), true)
  assert.equal(sunShadowOn(true, 'off'), false)
  // et le gabarit d'hier, sans la clé, retrouve exactement son comportement
  assert.equal(sunShadowOn(undefined, 'dynamic'), true)
  assert.equal(sunShadowOn(undefined, 'off'), false)
})

// ---- l’aller-retour d’un gabarit d’HIER --------------------------------------
//
// La règle générale (NEUTRAL_LIGHT_USER) dit : clé absente → neutre. L'appoint
// y fait exception, et ces tests sont là pour que personne ne « simplifie »
// l'exception en la supprimant.

test('gabarit d’hier SANS appoint : l’interrupteur reste éteint', () => {
  assert.equal(fillEnabledInLook({ sunGain: 1 }, 0), false)
  assert.equal(fillEnabledInLook({}, undefined), false)
})

test('gabarit d’hier AVEC un appoint réglé : il l’avait allumé, on le rallume', () => {
  // sans ça, réimporter ce gabarit rendrait une image plus fermée que celle
  // qu'on avait exportée — la lumière d'appoint aurait disparu en silence
  assert.equal(fillEnabledInLook({ fillIntensity: 1.2 }, 1.2), true)
})

test('gabarit d’AUJOURD’HUI : l’interrupteur qu’il porte fait foi, même contre l’intensité', () => {
  // appoint réglé mais coupé : on respecte le coupé
  assert.equal(fillEnabledInLook({ fillEnabled: false, fillIntensity: 1.2 }, 1.2), false)
  assert.equal(fillEnabledInLook({ fillEnabled: true, fillIntensity: 0.6 }, 0.6), true)
})

// ---- les deux interrupteurs sont des RÉGLAGES -------------------------------

test('les deux interrupteurs voyagent dans les gabarits', () => {
  for (const k of ['sunEnabled', 'fillEnabled']) {
    assert.ok(TEMPLATE_KEYS.includes(k), `${k} manque à TEMPLATE_KEYS — l’interrupteur ne survivrait pas à un export/import`)
  }
})
