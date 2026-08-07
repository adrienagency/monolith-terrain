import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { identifiantCompte, compteVerifie } from '../netlify/functions/paiement.mjs'
import { commandeDepuisSession } from '../netlify/functions/paiement-webhook.mjs'

// LE FIL ENTRE UN ACHAT ET UN COMPTE.
//
// Stripe crée une fiche client à chaque vente (`customer_creation: 'always'`)
// et on jetait son identifiant. C'est le seul fil qui relie un achat à un
// compte : un courriel se change, un `cus_…` ne bouge pas. L'ajouter coûte une
// ligne ; l'ajouter APRÈS coûte toutes les ventes déjà faites, qui n'auront
// jamais eu ce champ.
//
// ⚠️ Et le cas qui compte le plus ici est celui SANS compte — le seul qui
// existe aujourd'hui, en production, avec de l'argent réel.

const sessionType = (extra = {}) => ({
  id: 'cs_test_ABC',
  amount_total: 1900,
  currency: 'eur',
  customer_details: { email: 'coureur@example.com', address: { country: 'FR' } },
  customer: 'cus_QQQ',
  metadata: { article: 'affiche-pdf', livrable: 'pdf', format: '50x70' },
  ...extra,
})

test('un achat SANS compte garde exactement la forme qu’il avait', () => {
  const c = commandeDepuisSession(sessionType(), new Date('2026-08-06T10:00:00Z'))
  assert.equal(c.compte, '', 'un achat anonyme ne doit porter aucun compte')
  assert.equal(c.client, 'cus_QQQ', 'la fiche client Stripe reste le fil de rattachement')
  assert.equal(c.email, 'coureur@example.com')
  assert.equal(c.centimes, 1900)
})

test('un achat AVEC compte porte l’identifiant, et le garde tel quel', () => {
  const s = sessionType({ metadata: { article: 'affiche-pdf', compte: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' } })
  const c = commandeDepuisSession(s, new Date('2026-08-06T10:00:00Z'))
  assert.equal(c.compte, 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d')
})

test('la fiche client survit à la forme développée comme à la forme chaîne', () => {
  // Une requête avec `expand` rend l'objet entier ; sans garde, le journal
  // stockerait « [object Object] » à la place d'un identifiant.
  const c = commandeDepuisSession(sessionType({ customer: { id: 'cus_DEV' } }))
  assert.equal(c.client, 'cus_DEV')
})

test('la caisse ne lit JAMAIS le compte dans le corps de la requête', () => {
  // ⚠️ LE GARDE-FOU LE PLUS IMPORTANT DE CE FICHIER.
  //
  // Écrire `compte: corps.compte` est la chose évidente à faire, et elle est
  // grave : cette caisse n'a ni authentification ni seau de débit, et l'affiche
  // est à 0 € — la session aboutit donc sans carte. N'importe qui pourrait
  // écrire, gratuitement et sans limite, dans l'historique d'achat du compte
  // d'un autre, et y attacher SA fiche client Stripe.
  //
  // On lit la source parce qu'aucun test de comportement ne peut attraper ça :
  // le jour où quelqu'un rebranche la ligne, tous les autres tests restent
  // verts.
  const source = readFileSync(new URL('../netlify/functions/paiement.mjs', import.meta.url), 'utf8')
  const code = source.replace(/^\s*(\/\/.*|\*.*|\/\*.*)$/gm, '') // hors commentaires
  assert.equal(
    /corps[?.\]['"\s]*\.?\s*compte/.test(code),
    false,
    'la caisse lit le compte dans le corps de la requête — il doit venir de compteVerifie(req)',
  )
})

test('sans authentification, aucun achat n’est rattaché à un compte', async () => {
  // Le comportement correct tant que la Phase 1 n'existe pas : mieux vaut une
  // facture à rattacher plus tard qu'une facture rangée chez un inconnu.
  const req = new Request('https://shibumap.com/.netlify/functions/paiement', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ article: 'affiche-pdf', compte: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d' }),
  })
  assert.equal(await compteVerifie(req), '')
})

test('l’identifiant de compte est filtré : il finira dans une clé de magasin', () => {
  // Il ne sert qu'à RETROUVER un achat, jamais à autoriser quoi que ce soit —
  // mais il finit dans une clé de magasin, donc il ne doit contenir ni « / »
  // ni « _ », qui sont l'espace de noms du magasin.
  assert.equal(identifiantCompte('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'), 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d')
  assert.equal(identifiantCompte('client/../../session/cs_test_ABC'), '', 'une traversée de chemin doit être refusée')
  assert.equal(identifiantCompte('rl_203.0.113.7'), '', 'un underscore ouvrirait les clés réservées du magasin')
  assert.equal(identifiantCompte('court'), '', 'trop court')
  assert.equal(identifiantCompte('x'.repeat(65)), '', 'trop long')
  assert.equal(identifiantCompte(undefined), '')
  assert.equal(identifiantCompte(null), '')
  assert.equal(identifiantCompte({ toString: () => 'abcdefgh' }), '', 'un objet ne doit pas passer par sa conversion')
})
