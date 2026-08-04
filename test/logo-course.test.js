import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verifieLogo, FORMATS_LOGO } from '../src/logo-course.js'
import { RACE_LOGO_MAX_CHARS } from '../src/share-link.js'

const png = (charge = 'AAAA') => `data:image/png;base64,${charge}`

test('un PNG bien formé passe', () => {
  const v = verifieLogo(png())
  assert.equal(v.ok, true)
  assert.equal(v.raison, undefined)
})

test('les quatre formats du serveur passent, et EUX SEULS', () => {
  for (const f of FORMATS_LOGO) {
    assert.equal(verifieLogo(`data:image/${f};base64,AAAA`).ok, true, `${f} devrait passer`)
  }
  // le SVG est refusé À L'IMPORT et pas seulement à la publication : c'est tout
  // l'intérêt de ce contrôle, dire non tout de suite plutôt qu'après coup
  const v = verifieLogo('data:image/svg+xml;base64,AAAA')
  assert.equal(v.ok, false)
  assert.match(v.raison, /format/i)
})

test('LE LOGO TROP LOURD EST REFUSÉ AU CHOIX, pas à la publication', () => {
  const trop = png('A'.repeat(RACE_LOGO_MAX_CHARS))
  const v = verifieLogo(trop)
  assert.equal(v.ok, false)
  assert.match(v.raison, /lourd|Mo|taille/i)
})

test('la limite est EXACTEMENT celle du partage, pas une copie qui dérivera', () => {
  // pile sur la limite : accepté
  const bourre = 'A'.repeat(RACE_LOGO_MAX_CHARS - 'data:image/png;base64,'.length)
  const pile = `data:image/png;base64,${bourre}`
  assert.equal(pile.length, RACE_LOGO_MAX_CHARS)
  assert.equal(verifieLogo(pile).ok, true, 'la limite elle-même doit passer')
  // un caractère de plus : refusé
  assert.equal(verifieLogo(pile + 'A').ok, false)
})

test('ce qui n’est pas un data URL d’image est refusé', () => {
  for (const mauvais of ['bonjour', 'http://exemple.fr/logo.png', 'data:text/html;base64,AAAA', 'data:image/png,pasdebase64']) {
    const v = verifieLogo(mauvais)
    assert.equal(v.ok, false, `${mauvais} ne devrait pas passer`)
    assert.ok(v.raison, 'un refus doit toujours porter une raison affichable')
  }
})

test('cas dégénérés : jamais de plantage, toujours une raison', () => {
  for (const rien of [null, undefined, '', 0, {}, []]) {
    const v = verifieLogo(rien)
    assert.equal(v.ok, false)
    assert.equal(typeof v.raison, 'string')
    assert.ok(v.raison.length > 0)
  }
})
