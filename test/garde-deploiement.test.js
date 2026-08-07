import { test } from 'node:test'
import assert from 'node:assert/strict'
import { juger, PAQUET_ATTENDU, SITE_ATTENDU } from '../scripts/garde-deploiement.mjs'

// Le 2026-08-07, un déploiement lancé depuis le dépôt voisin a publié l'autre
// site, affiché « Deploy complete », et fait croire pendant une heure que le
// travail était en ligne. Ce garde ne peut pas empêcher ça — rien n'empêche de
// taper `netlify deploy` ailleurs — mais il refuse de partir quand la cible est
// fausse, et il annonce la cible AVANT de construire plutôt qu'après.

const bon = {
  paquet: PAQUET_ATTENDU,
  site: SITE_ATTENDU,
  url: 'https://shibumap.com',
  branche: 'regroupement',
  propre: true,
  enRetard: false,
}

test('la bonne paire dépôt/site passe sans un mot', () => {
  const v = juger(bon)
  assert.equal(v.ok, true)
  assert.deepEqual(v.refus, [])
  assert.deepEqual(v.alertes, [], 'un garde qui parle pour ne rien dire finit ignoré')
})

test('un autre dépôt est REFUSÉ', () => {
  const v = juger({ ...bon, paquet: 'shibumap-site' })
  assert.equal(v.ok, false)
  assert.match(v.refus.join(' '), /shibumap-site/)
})

test('un autre site est REFUSÉ — c’est l’erreur du 7 août', () => {
  const v = juger({ ...bon, site: 'shibumap-vitrine' })
  assert.equal(v.ok, false)
  assert.match(v.refus.join(' '), /shibumap-vitrine/)
})

test('sans réseau on avertit, mais on ne bloque pas', () => {
  // Refuser faute d'avoir pu vérifier rendrait tout déploiement hors ligne
  // impossible. On le dit, on ne l'interdit pas — et surtout on ne laisse pas
  // croire que la vérification a eu lieu.
  const v = juger({ ...bon, site: null })
  assert.equal(v.ok, true)
  assert.match(v.alertes.join(' '), /non vérifié/)
})

test('un arbre sale et des commits non poussés alertent sans bloquer', () => {
  const v = juger({ ...bon, propre: false, enRetard: true })
  assert.equal(v.ok, true, 'bloquer là-dessus ferait contourner le garde')
  assert.equal(v.alertes.length, 2)
  assert.match(v.alertes.join(' '), /commitées/)
  assert.match(v.alertes.join(' '), /poussés/)
})

test('deux fautes de cible se cumulent au lieu de se masquer', () => {
  const v = juger({ ...bon, paquet: 'autre-chose', site: 'autre-site' })
  assert.equal(v.refus.length, 2, 'ne rapporter que la première ferait deux allers-retours')
})
