// La caisse, dans ses deux endroits qui coûtent cher quand ils sont faux : le
// prix, et la signature du webhook.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ARTICLES, article, prixEuros, PAYS_AUTORISES, PAYS_EXCLUS } from '../netlify/functions/_paiement-catalogue.mjs'
import { signatureValide, commandeDepuisSession } from '../netlify/functions/paiement-webhook.mjs'
import caisse from '../netlify/functions/paiement.mjs'

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

// ── Ce qu'on garde d'une vente ──────────────────────────────────────────────
//
// Un champ oublié ici ne casse RIEN : la commande s'écrit, l'email part, les
// tests passent. On s'en aperçoit des mois plus tard, quand on cherche à quel
// client rattacher un achat et qu'il ne reste qu'une adresse email.

const sessionPayee = (extra = {}) => ({
  id: 'cs_test_1',
  amount_total: 1900,
  currency: 'eur',
  customer_details: { email: 'club@example.org', address: { country: 'FR' } },
  metadata: { article: 'affiche-pdf', livrable: 'fichier', format: '', retour: 'r-42' },
  ...extra,
})

test('l’identifiant de la fiche client Stripe est CONSERVÉ, pas jeté', () => {
  // Le seul fil qui reliera un jour un achat à un compte : un email se change,
  // un `cus_…` ne bouge pas.
  const c = commandeDepuisSession(sessionPayee({ customer: 'cus_ABC123' }))
  assert.equal(c.client, 'cus_ABC123')
  assert.equal(c.email, 'club@example.org', 'l’email reste, il ne le remplace pas')
})

test('client et facture acceptent la forme développée comme la forme chaîne', () => {
  // Une requête avec `expand` renvoie l'objet entier : sans ce garde on
  // stockerait « [object Object] » dans le journal des ventes.
  const c = commandeDepuisSession(sessionPayee({ customer: { id: 'cus_X' }, invoice: { id: 'in_Y' } }))
  assert.equal(c.client, 'cus_X')
  assert.equal(c.facture, 'in_Y')
})

test('un champ absent vaut la chaîne vide, jamais undefined ni "[object Object]"', () => {
  const c = commandeDepuisSession(sessionPayee())
  assert.equal(c.client, '')
  assert.equal(c.compte, '')
  // ⚠️ Une facture VIDE n'est pas une anomalie : Stripe ne l'établit qu'après
  // encaissement, donc pas encore sur un moyen de paiement différé.
  assert.equal(c.facture, '')
  for (const [k, v] of Object.entries(c)) assert.notEqual(v, undefined, `${k} est undefined`)
})

test('le compte ShibuMap est lu AVANT d’exister — c’est tout l’intérêt', () => {
  // Il n'y a pas de système de comptes. Le jour où il y en aura un, les
  // commandes porteront la clé sans reprise de données.
  const c = commandeDepuisSession(sessionPayee({ metadata: { compte: 'u_77' } }))
  assert.equal(c.compte, 'u_77')
})

test('les champs d’origine survivent à l’ajout : rien n’a été perdu en route', () => {
  const c = commandeDepuisSession(sessionPayee({ customer: 'cus_1' }), new Date('2026-08-05T10:00:00.000Z'))
  assert.deepEqual(Object.keys(c).sort(), [
    'article', 'bloque', 'centimes', 'client', 'compte', 'devise', 'email',
    'facture', 'format', 'livrable', 'livree', 'payeLe', 'pays', 'retour', 'session',
  ])
  assert.equal(c.session, 'cs_test_1')
  assert.equal(c.centimes, 1900)
  assert.equal(c.devise, 'eur')
  assert.equal(c.article, 'affiche-pdf')
  assert.equal(c.retour, 'r-42')
  assert.equal(c.livree, false)
  assert.equal(c.payeLe, '2026-08-05T10:00:00.000Z')
})

test('le blocage par pays exclu n’a pas bougé', () => {
  assert.equal(commandeDepuisSession(sessionPayee()).bloque, false)
  const gb = commandeDepuisSession(sessionPayee({
    customer_details: { email: 'a@b.uk', address: { country: 'GB' } },
  }))
  assert.equal(gb.bloque, true)
  assert.equal(gb.pays, 'GB')
})

// ── La facture, à la création de la session ─────────────────────────────────

/** Fait tourner la caisse contre un Stripe bouchonné. Rend les corps envoyés. */
async function caisseAvecStripe(reponses, articleDemande = 'affiche-pdf') {
  const fetchOriginel = globalThis.fetch
  const cleOriginelle = process.env.STRIPE_SECRET_KEY
  const corps = []
  // Valeur ostensiblement fausse : rien de réel ne doit traîner dans un test.
  process.env.STRIPE_SECRET_KEY = 'sk_test_bouchon_pas_une_vraie_cle'
  globalThis.fetch = async (_url, init) => {
    corps.push(String(init.body))
    const r = reponses[corps.length - 1]
    return { ok: r.ok, json: async () => r.corps }
  }
  try {
    const rep = await caisse(new Request('https://shibumap.com/.netlify/functions/paiement', {
      method: 'POST',
      body: JSON.stringify({ article: articleDemande }),
    }))
    return { corps, rep, json: await rep.json() }
  } finally {
    globalThis.fetch = fetchOriginel
    if (cleOriginelle === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = cleOriginelle
  }
}

test('la session demande une FACTURE, et les deux préalables sont là', async () => {
  const { corps, json } = await caisseAvecStripe([{ ok: true, corps: { url: 'https://stripe/x', id: 'cs_1' } }])
  assert.equal(json.ok, true)
  const envoye = decodeURIComponent(corps[0])
  assert.match(envoye, /invoice_creation\[enabled\]=true/)
  // ⚠️ `invoice_creation` n'existe qu'en mode `payment` : si ce mode changeait,
  // Stripe refuserait la session entière.
  assert.match(envoye, /mode=payment/)
  // Une facture exige une fiche client ET une adresse de facturation. Les
  // retirer ferait échouer des paiements qui aboutissent aujourd'hui.
  assert.match(envoye, /customer_creation=always/)
  assert.match(envoye, /billing_address_collection=required/)
  // La facture doit dire QUOI a été vendu, sinon elle est introuvable après coup.
  assert.match(envoye, /invoice_creation\[invoice_data\]\[metadata\]\[article\]=affiche-pdf/)
})

test('aucune mention fiscale n’est écrite en dur sur la facture', () => {
  // Le régime (franchise transfrontalière) attend la confirmation du SIE — voir
  // _paiement-catalogue.mjs. Imprimer un article du CGI avant, c'est mettre une
  // affirmation fiscale fausse sur un document opposable. Ça se pose dans le
  // Dashboard, pas ici.
  const src = readFileSync(new URL('../netlify/functions/paiement.mjs', import.meta.url), 'utf8')
  const params = src.slice(src.indexOf('invoice_data'), src.indexOf('const creerSession'))
  assert.ok(!/footer\s*:/.test(params), 'pas de footer de facture en dur')
  assert.ok(!/account_tax_ids/.test(params), 'pas de numéro de TVA en dur')
})

test('si Stripe refuse la facture, la VENTE passe quand même', async () => {
  // Une option indisponible sur le compte ne doit pas coûter une vente :
  // l'acheteur verrait une erreur au lieu de la page de paiement.
  const { corps, json } = await caisseAvecStripe([
    { ok: false, corps: { error: { param: 'invoice_creation[enabled]', message: 'Unknown parameter.' } } },
    { ok: true, corps: { url: 'https://stripe/x', id: 'cs_2' } },
  ])
  assert.equal(json.ok, true)
  assert.equal(json.url, 'https://stripe/x')
  assert.equal(corps.length, 2, 'la session doit être refaite')
  assert.ok(!corps[1].includes('invoice_creation'), 'la reprise part SANS la facture')
  // Le reste de la commande est intact : on n'a pas dégradé autre chose.
  assert.match(decodeURIComponent(corps[1]), /customer_creation=always/)
})

test('le repli est ÉTROIT : toute autre erreur Stripe remonte comme avant', async () => {
  const { corps, rep, json } = await caisseAvecStripe([
    { ok: false, corps: { error: { param: 'line_items', message: 'Invalid amount.' } } },
  ])
  assert.equal(corps.length, 1, 'pas de seconde tentative')
  assert.equal(rep.status, 502)
  assert.equal(json.ok, false)
  assert.equal(json.erreur, 'Invalid amount.')
})
