// La caisse, dans ses deux endroits qui coûtent cher quand ils sont faux : le
// prix, et la signature du webhook.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { ARTICLES, article, prixEuros, PAYS_AUTORISES, PAYS_EXCLUS } from '../netlify/functions/_paiement-catalogue.mjs'
import { signatureValide } from '../netlify/functions/paiement-webhook.mjs'

test('le prix vient du SERVEUR : un article inconnu ne s’invente pas', () => {
  // La faille numéro un des paiements web : accepter `{ prix }` du navigateur.
  assert.equal(article('affiche-pdf').centimes, 1900)
  assert.equal(article('affiche-inexistante'), null)
  assert.equal(article(''), null)
  assert.equal(article(null), null)
  // et surtout : pas d'accès aux clés héritées d'Object
  assert.equal(article('toString'), null)
  assert.equal(article('constructor'), null)
})

test('tous les prix sont des ENTIERS de centimes', () => {
  // Stripe n'accepte que des entiers, et un prix en euros flottants finit
  // toujours par produire un 18,999999999999998.
  for (const [id, a] of Object.entries(ARTICLES)) {
    assert.ok(Number.isInteger(a.centimes), `${id} : ${a.centimes} n’est pas un entier`)
    assert.ok(a.centimes > 0, `${id} : prix nul ou négatif`)
    assert.ok(a.libelle && a.livrable, `${id} : article incomplet`)
  }
  assert.equal(prixEuros('affiche-pdf'), 19)
  assert.equal(prixEuros('rien'), null)
})

test('l’imprimé coûte plus cher que le fichier, à tous les formats', () => {
  const pdf = ARTICLES['affiche-pdf'].centimes
  for (const [id, a] of Object.entries(ARTICLES)) {
    if (a.livrable !== 'impression') continue
    assert.ok(a.centimes > pdf, `${id} ne peut pas coûter moins que le fichier seul`)
  }
})

test('le Royaume-Uni est exclu du paiement, pas d’une phrase de CGV', () => {
  // TVA britannique due dès la PREMIÈRE vente à un particulier : pas de seuil.
  assert.ok(PAYS_EXCLUS.includes('GB'))
  assert.ok(!PAYS_AUTORISES.includes('GB'), 'GB ne doit jamais atteindre la liste blanche')
  assert.ok(PAYS_AUTORISES.includes('FR'))
})

// ── La signature du webhook ─────────────────────────────────────────────────

const signer = (corps, secret, t) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${corps}`, 'utf8').digest('hex')}`

test('une signature juste passe, une signature fausse ne passe pas', () => {
  const corps = '{"type":"checkout.session.completed"}'
  const t = 1_700_000_000
  assert.equal(signatureValide(corps, signer(corps, 'whsec_x', t), 'whsec_x', 300, t), true)
  assert.equal(signatureValide(corps, signer(corps, 'AUTRE', t), 'whsec_x', 300, t), false)
})

test('le corps est vérifié OCTET POUR OCTET', () => {
  // ⚠️ Le piège coûteux : re-sérialiser le JSON réordonne les clés et change
  // les espaces. La signature ne correspond plus, et on cherche une erreur de
  // clé qui n'existe pas.
  const corps = '{"a":1,"b":2}'
  const t = 1_700_000_000
  const sig = signer(corps, 'whsec_x', t)
  assert.equal(signatureValide(corps, sig, 'whsec_x', 300, t), true)
  assert.equal(signatureValide(JSON.stringify(JSON.parse(corps)), sig, 'whsec_x', 300, t), true)
  assert.equal(signatureValide('{"b":2,"a":1}', sig, 'whsec_x', 300, t), false, 'un corps différent doit échouer')
})

test('une signature d’hier est refusée : le rejeu a une date de péremption', () => {
  const corps = '{}'
  const t = 1_700_000_000
  const sig = signer(corps, 'whsec_x', t)
  assert.equal(signatureValide(corps, sig, 'whsec_x', 300, t + 60), true)
  assert.equal(signatureValide(corps, sig, 'whsec_x', 300, t + 86400), false)
  assert.equal(signatureValide(corps, sig, 'whsec_x', 300, t - 86400), false)
})

test('une entrée malformée est refusée sans lever', () => {
  assert.equal(signatureValide('{}', '', 'whsec_x'), false)
  assert.equal(signatureValide('{}', 'nimportequoi', 'whsec_x'), false)
  assert.equal(signatureValide('{}', 't=abc,v1=def', 'whsec_x'), false)
  assert.equal(signatureValide('{}', 't=1700000000,v1=trop-court', 'whsec_x', 300, 1700000000), false)
  assert.equal(signatureValide(null, null, null), false)
  assert.equal(signatureValide('{}', 't=1700000000,v1=aa', ''), false)
})
