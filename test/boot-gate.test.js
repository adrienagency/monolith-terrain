import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateFor, looksInApp, looksSharedLink, detectWebGL2, GATE_PHONE, GATE_WEBGL } from '../src/boot-gate.js'

test('gateFor: a capable desktop browser is not gated', () => {
  assert.equal(gateFor({ isPhone: false, hasWebGL2: true }), null)
  assert.equal(gateFor(), null, 'the default assumption is "it works" — never gate on missing info')
})

test('gateFor: no WebGL2 is gated instead of left spinning', () => {
  // THE regression this module exists for: without a gate the app fetched the
  // whole bundle, failed to build a renderer, and span on the loader forever.
  const g = gateFor({ hasWebGL2: false })
  assert.equal(g.reason, GATE_WEBGL)
  assert.ok(g.body.length > 20, 'it has to actually explain itself')
})

test('gateFor: an in-app WebView is told the fix it can act on', () => {
  const inApp = gateFor({ hasWebGL2: false, inAppBrowser: true })
  const plain = gateFor({ hasWebGL2: false, inAppBrowser: false })
  assert.notEqual(inApp.body, plain.body, 'the same advice cannot serve both')
  assert.ok(/open in browser/i.test(inApp.body), 'a WebView user needs to leave the WebView')
  // "update your browser" is useless advice inside Instagram — their browser
  // is fine, they just are not in it.
  assert.ok(!/support|update/i.test(inApp.body))
})

test('gateFor: phone wins over WebGL — one dead end, not two', () => {
  // Sending a phone user to "a different browser" would land them on the
  // phone gate anyway. Screen size is the honest reason, so it goes first.
  const g = gateFor({ isPhone: true, hasWebGL2: false })
  assert.equal(g.reason, GATE_PHONE)
})

test('gateFor: a SHARED shibu boots on a phone — the viewer is the whole point of the link', () => {
  // Un lien de course reçu se consomme sur téléphone : le viewer lecture
  // seule (body.shibu-view) y fonctionne, donc pas de carte de refus.
  assert.equal(gateFor({ isPhone: true, sharedView: true }), null)
})

test('gateFor: the naked editor still gates phones, shared or not elsewhere', () => {
  // shibumap.com nu sur téléphone → la carte « room to breathe » reste.
  assert.equal(gateFor({ isPhone: true, sharedView: false }).reason, GATE_PHONE)
  assert.equal(gateFor({ isPhone: true }).reason, GATE_PHONE, 'defaults to the editor gate')
})

test('gateFor: a shared link without WebGL2 is still gated — a viewer needs a renderer', () => {
  const g = gateFor({ isPhone: true, sharedView: true, hasWebGL2: false, inAppBrowser: true })
  assert.equal(g.reason, GATE_WEBGL)
  // and the in-app advice still applies: share links land in WebViews first
  assert.ok(/open in browser/i.test(g.body))
})

test('looksSharedLink: exactly the two IS_SHIBU triggers, nothing else', () => {
  assert.ok(looksSharedLink('#s=eyJmb3JtYXQi'))
  assert.ok(looksSharedLink('#r=abc123'))
  assert.ok(!looksSharedLink(''))
  assert.ok(!looksSharedLink('#store'))
  assert.ok(!looksSharedLink('#share=x'), 'prefix must match exactly')
  assert.ok(!looksSharedLink(undefined))
})

test('looksInApp: catches the apps whose share traffic matters', () => {
  assert.ok(looksInApp('Mozilla/5.0 ... Instagram 275.0.0.27.98 Android'))
  assert.ok(looksInApp('Mozilla/5.0 ... [FBAN/FBIOS;FBAV/442.0.0]'))
  assert.ok(looksInApp('Mozilla/5.0 ... trill_320 TikTok'))
})

test('looksInApp: a normal browser is not mistaken for a WebView', () => {
  // A false positive tells a Chrome user to leave Chrome — worse than the
  // generic message, so unsure must mean no.
  assert.ok(!looksInApp('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36'))
  assert.ok(!looksInApp('Mozilla/5.0 (Macintosh) Version/17.0 Safari/605.1.15'))
  assert.ok(!looksInApp(''))
})

test('detectWebGL2: a browser that THROWS is treated as unsupported, not crashed', () => {
  // Some browsers with WebGL disabled throw from getContext instead of
  // returning null. An exception at boot produces exactly the blank screen
  // this module exists to prevent.
  const throwingDoc = { createElement: () => ({ getContext: () => { throw new Error('disabled') } }) }
  assert.equal(detectWebGL2(throwingDoc), false)
})

test('detectWebGL2: null context means unsupported', () => {
  assert.equal(detectWebGL2({ createElement: () => ({ getContext: () => null }) }), false)
  assert.equal(detectWebGL2({ createElement: () => ({ getContext: () => ({}) }) }), true)
})
