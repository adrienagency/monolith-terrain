import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPORTS, DEFAULT_SPORT, getSport, sanitizeSvgMarkup, isValidIconDataUrl, MAX_ICON_BYTES } from '../src/ui/sport-icons.js'

test('SPORTS covers the outdoor disciplines named in the brief, each with a usable svg', () => {
  const keys = SPORTS.map((s) => s.key)
  for (const k of ['trail', 'swim', 'road-bike', 'mtb', 'cx', 'hike', 'ski', 'kayak']) {
    assert.ok(keys.includes(k), `missing sport: ${k}`)
  }
  for (const s of SPORTS) {
    assert.ok(s.svg.startsWith('<svg'), `${s.key} svg should start with <svg`)
    assert.ok(s.svg.includes('viewBox="0 0 24 24"'), `${s.key} should share the app's 24x24 icon grammar`)
  }
})

test('getSport falls back to the default for an unknown/missing key', () => {
  assert.equal(getSport('unknown-sport').key, DEFAULT_SPORT)
  assert.equal(getSport(undefined).key, DEFAULT_SPORT)
  assert.equal(getSport('swim').key, 'swim')
})

test('sanitizeSvgMarkup strips script tags', () => {
  const dirty = '<svg viewBox="0 0 24 24"><script>alert(1)</script><circle r="1"/></svg>'
  const clean = sanitizeSvgMarkup(dirty)
  assert.ok(clean && !clean.includes('script'))
  assert.ok(clean.includes('circle'))
})

test('sanitizeSvgMarkup strips inline event-handler attributes', () => {
  const dirty = '<svg viewBox="0 0 24 24"><rect onload="alert(1)" onclick=\'evil()\' width="1" height="1"/></svg>'
  const clean = sanitizeSvgMarkup(dirty)
  assert.ok(clean && !/on[a-z]+\s*=/i.test(clean))
})

test('sanitizeSvgMarkup strips javascript: hrefs and foreignObject', () => {
  const dirty = '<svg viewBox="0 0 24 24"><a href="javascript:alert(1)"><circle r="1"/></a><foreignObject><body onload="x()"/></foreignObject></svg>'
  const clean = sanitizeSvgMarkup(dirty)
  assert.ok(clean && !clean.includes('javascript:'))
  assert.ok(clean && !clean.includes('foreignObject'))
})

test('sanitizeSvgMarkup rejects non-svg / empty / oversized input', () => {
  assert.equal(sanitizeSvgMarkup(''), null)
  assert.equal(sanitizeSvgMarkup('<div>not svg</div>'), null)
  assert.equal(sanitizeSvgMarkup('x'.repeat(MAX_ICON_BYTES + 1)), null)
})

test('sanitizeSvgMarkup keeps a same-document xlink:href (e.g. <use href="#id">)', () => {
  const ok = '<svg viewBox="0 0 24 24"><defs><circle id="c" r="1"/></defs><use xlink:href="#c"/></svg>'
  const clean = sanitizeSvgMarkup(ok)
  assert.ok(clean && clean.includes('#c'))
})

test('isValidIconDataUrl only accepts an allow-listed image mime, within the size cap', () => {
  assert.equal(isValidIconDataUrl('data:image/png;base64,AAAA'), true)
  assert.equal(isValidIconDataUrl('data:image/svg+xml;base64,AAAA'), false, 'svg data URLs go through sanitizeSvgMarkup, not this path')
  assert.equal(isValidIconDataUrl('data:text/html;base64,AAAA'), false)
  assert.equal(isValidIconDataUrl('data:image/png;base64,' + 'A'.repeat(MAX_ICON_BYTES)), false)
})
