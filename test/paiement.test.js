// La caisse, dans ses deux endroits qui coûtent cher quand ils sont faux : le
// prix, et la signature du webhook.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  ARTICLES, article, prixEuros, PAYS_AUTORISES, PAYS_EXCLUS,
  PRIX_AFFICHE_PDF_CENTIMES, MENTION_GRATUITE, habillageAffichePdf,
} from '../netlify/functions/_paiement-catalogue.mjs'
import { signatureValide, commandeDepuisSession, texteConfirmation, sessionAboutie } from '../netlify/functions/paiement-webhook.mjs'
import caisse, { codeAtelierValide, commandeAtelier } from '../netlify/functions/paiement.mjs'
import { etatDepuisSources, SESSION_RE as SESSION_RE_SERVEUR } from '../netlify/functions/paiement-etat.mjs'
import { DPI_NOMINAL, DPI_PLANCHER } from '../src/export-dpi.js'
import {
  identifiantArticle, FORMATS_IMPRIMES, SESSION_RE, lireRetourPaiement, urlSansRetour,
  afficheSerialisable, afficheRestauree, poserPanier, lirePanier, viderPanier, CLE_PANIER,
  demanderCaisse, verifierPaiement, messageRetour, URL_CAISSE,
  retourAReprendre, armerReprise, livraisonEnSuspens, fichierJetable,
} from '../src/paiement.js'

test('le prix vient du SERVEUR : un article inconnu ne s’invente pas', () => {
  // La faille numéro un des paiements web : accepter `{ prix }` du navigateur.
  // ⚠️ ON COMPARE À LA CONSTANTE, PAS À 1900. Le chiffre du jour est
  // temporairement nul (gratuité de mise en service) ; ce que ce test tient,
  // c'est que le catalogue serveur fait foi, pas sa valeur.
  assert.equal(article('affiche-pdf').centimes, PRIX_AFFICHE_PDF_CENTIMES)
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
    // ⚠️ ZÉRO EST DÉSORMAIS PERMIS, LE NÉGATIF JAMAIS. Zéro est un chemin réel
    // chez Stripe (commande à coût zéro) ; un montant négatif n'en est pas un.
    assert.ok(a.centimes >= 0, `${id} : prix négatif`)
    // ⚠️ ET AUCUN MONTANT ENTRE ZÉRO ET LE MINIMUM STRIPE. Sous 0,50 € en
    // euros, Stripe refuse la transaction : une affiche à 30 centimes ferait
    // échouer la caisse en production sans qu'aucun test ne l'ait dit.
    assert.ok(a.centimes === 0 || a.centimes >= 50, `${id} : ${a.centimes} centimes tombe sous le minimum Stripe (50 centimes en EUR)`)
    assert.ok(a.libelle && a.livrable, `${id} : article incomplet`)
  }
  assert.equal(prixEuros('affiche-pdf'), PRIX_AFFICHE_PDF_CENTIMES / 100)
  assert.equal(prixEuros('rien'), null)
})

test('l’imprimé coûte plus cher que le fichier, à tous les formats', () => {
  const pdf = ARTICLES['affiche-pdf'].centimes
  for (const [id, a] of Object.entries(ARTICLES)) {
    if (a.livrable !== 'impression') continue
    assert.ok(a.centimes > pdf, `${id} ne peut pas coûter moins que le fichier seul`)
  }
})

// ══════════ LE LIBELLÉ VENDU NE PEUT PAS MENTIR SUR LE PRIX ═════════════════
//
// ⚠️ C'EST LA PROPRIÉTÉ QUI COMPTE, PAS LE CHIFFRE DU JOUR. Le libellé d'un
// article part sur la page Stripe ET sur une FACTURE NUMÉROTÉE — un document
// opposable. Un article à 0 € intitulé comme un article payant est trompeur ;
// un article à 19 € qui s'annonce encore « offert » l'est bien davantage, parce
// que c'est celui-là qu'on oublie en remontant le prix.

test('⚠️ PRIX NUL ⟺ GRATUITÉ ANNONCÉE, dans les deux sens', () => {
  const dit = (a) => new RegExp(MENTION_GRATUITE, 'i').test(`${a.libelle} ${a.detail || ''}`)
  for (const [id, a] of Object.entries(ARTICLES)) {
    assert.equal(
      a.centimes === 0, dit(a),
      a.centimes === 0
        ? `${id} coûte 0 € mais s’intitule comme un article payant : « ${a.libelle} »`
        : `${id} coûte ${a.centimes} c et s’annonce encore « ${MENTION_GRATUITE} » : « ${a.libelle} »`
    )
  }
})

test('⚠️ LE LIBELLÉ EST DÉRIVÉ DU PRIX, PAS RECOPIÉ À CÔTÉ', () => {
  // La construction qui rend la propriété ci-dessus INVIOLABLE : on ne PEUT pas
  // remonter le chiffre en oubliant la phrase, parce qu'il n'y a pas deux
  // endroits. Ce test échoue si quelqu'un remet un libellé en dur.
  const payant = habillageAffichePdf(1900)
  const gratuit = habillageAffichePdf(0)
  assert.ok(!new RegExp(MENTION_GRATUITE, 'i').test(`${payant.libelle} ${payant.detail}`),
    'à 19 €, le libellé ne doit plus annoncer la gratuité')
  assert.match(gratuit.libelle, new RegExp(MENTION_GRATUITE, 'i'))
  assert.match(gratuit.detail, new RegExp(MENTION_GRATUITE, 'i'))
  // La fourchette de densité survit à la bascule : c'est la même phrase de base
  // des deux côtés, corrigée cette nuit-là et qu'on ne veut pas voir se
  // dédoubler.
  assert.match(payant.detail, /150.+300 dpi/)
  assert.match(gratuit.detail, /150.+300 dpi/)
  // Et le catalogue utilise bien cette dérivation, pas une copie.
  assert.deepEqual(
    { libelle: ARTICLES['affiche-pdf'].libelle, detail: ARTICLES['affiche-pdf'].detail },
    habillageAffichePdf(PRIX_AFFICHE_PDF_CENTIMES)
  )
})

test('⚠️ L’ÉTIQUETTE DU BOUTON ET LE PRIX DU SERVEUR NE PEUVENT PAS DIVERGER', () => {
  // `src/ui/affiche.js` ne se charge pas sous node (il importe une feuille de
  // style) : on relit sa source, comme test/affiche-tirage.test.js.
  //
  // Ce chiffre-là ne facture rien — c'est ce que l'acheteur LIT avant de
  // cliquer. Le laisser à 19 pendant que la caisse encaisse 0 (ou l'inverse le
  // jour de la remontée) est la faute la plus facile à commettre et la plus
  // pénible à voir : elle ne casse rien, elle ment.
  const src = readFileSync(new URL('../src/ui/affiche.js', import.meta.url), 'utf8')
  const m = src.match(/export const PRIX_AFFICHE_EUR = (\d+)/)
  assert.ok(m, 'PRIX_AFFICHE_EUR doit exister dans src/ui/affiche.js')
  assert.equal(
    Number(m[1]), prixEuros('affiche-pdf'),
    `l’étiquette du bouton annonce ${m[1]} € et le catalogue serveur facture ${prixEuros('affiche-pdf')} €`
  )
  // Et le bouton n'écrit pas « 0 € » : à zéro, l'étiquette et la phrase de
  // réassurance sont dérivées, pas interpolées en dur.
  assert.match(src, /export function etiquettePrix/)
  assert.ok(!/`\$\{PRIX_AFFICHE_EUR\} €`/.test(src), 'le prix ne doit plus s’interpoler directement dans le bouton')
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

// ── Le garde du webhook : « plus rien n'est dû » ────────────────────────────

test('⚠️ LE WEBHOOK ACCEPTE LA COMMANDE À COÛT ZÉRO, ET RIEN D’AUTRE EN PLUS', () => {
  // Sans ce cas, l'affiche à 0 € traverserait tout le tunnel Stripe pour être
  // silencieusement jetée ici : pas de commande au journal, pas de courriel —
  // c'est-à-dire le maillon qu'on veut éprouver, non éprouvé.
  assert.equal(sessionAboutie({ payment_status: 'paid', amount_total: 1900 }), true)
  assert.equal(sessionAboutie({ payment_status: 'no_payment_required', amount_total: 0 }), true)

  // ⚠️ ET LE GARDE RESTE UN GARDE. Une session non payée n'entre pas, quel que
  // soit son montant — c'est ce qui rend le retour à 19 € sûr sans y retoucher.
  assert.equal(sessionAboutie({ payment_status: 'unpaid', amount_total: 1900 }), false)
  assert.equal(sessionAboutie({ payment_status: 'unpaid', amount_total: 0 }), false)
  // Le cas qui coûterait cher : « aucun paiement requis » annoncé sur un total
  // NON NUL. Ça ne devrait pas exister ; si ça arrive, on ne livre pas.
  assert.equal(sessionAboutie({ payment_status: 'no_payment_required', amount_total: 1900 }), false)
  assert.equal(sessionAboutie({ payment_status: 'no_payment_required' }), false, 'total absent ≠ total nul')
  assert.equal(sessionAboutie({ payment_status: 'no_payment_required', amount_total: null }), false)
  assert.equal(sessionAboutie({}), false)
  assert.equal(sessionAboutie(), false)

  // Et c'est bien CE garde-là que le gestionnaire consulte, pas un `=== 'paid'`
  // resté en place à côté.
  const src = readFileSync(new URL('../netlify/functions/paiement-webhook.mjs', import.meta.url), 'utf8')
  assert.match(src, /if \(!sessionAboutie\(s\)\) return new Response\('non payé'/)
})

test('une commande à coût zéro s’écrit au journal comme une vraie', () => {
  // ⚠️ ELLE N'EST PAS MARQUÉE `atelier`, ET C'EST LA DIFFÉRENCE QUI COMPTE : le
  // contournement d'atelier ne passe pas par Stripe, celle-ci si. Elle porte
  // donc un vrai `cs_…`, un vrai email, un vrai pays — tout, sauf un montant.
  const c = commandeDepuisSession(sessionPayee({ amount_total: 0, customer: 'cus_Z' }))
  assert.equal(c.centimes, 0)
  assert.equal(c.atelier, undefined, 'ce n’est PAS un essai d’atelier : la chaîne réelle a tourné')
  assert.equal(c.email, 'club@example.org', 'sans email, aucun courriel de confirmation ne partirait')
  assert.equal(c.session, 'cs_test_1')
  assert.equal(c.bloque, false)
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

test('⚠️ LE MONTANT ENVOYÉ À STRIPE EST CELUI DU CATALOGUE, ET IL VIENT DU SERVEUR', async () => {
  // Le navigateur n'a envoyé qu'un identifiant d'article ; c'est la caisse qui
  // pose le montant. Ce test le vérifie sur la requête réellement construite —
  // y compris quand ce montant vaut zéro (commande à coût zéro).
  const { corps } = await caisseAvecStripe([{ ok: true, corps: { url: 'https://stripe/x', id: 'cs_1' } }])
  const p = new URLSearchParams(corps[0])
  assert.equal(p.get('line_items[0][price_data][unit_amount]'), String(PRIX_AFFICHE_PDF_CENTIMES))
  assert.equal(p.get('line_items[0][price_data][currency]'), 'eur')
  // Et le libellé qui part chez Stripe est celui du catalogue, donc dérivé du
  // prix : à zéro, la page de paiement dit elle-même que l'article est offert.
  assert.equal(p.get('line_items[0][price_data][product_data][name]'), ARTICLES['affiche-pdf'].libelle)
  assert.equal(p.get('invoice_creation[invoice_data][description]'), ARTICLES['affiche-pdf'].libelle)
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

// ═══════════════════════════════════════════════════════════════════════════
// LE TUNNEL, CÔTÉ NAVIGATEUR — l'aller, le retour, et ce qui survit entre
// ═══════════════════════════════════════════════════════════════════════════

// ── L'article : ce que le client a le droit de demander ─────────────────────

test('tout identifiant que le CLIENT sait produire existe dans le catalogue SERVEUR', () => {
  // Le garde qui empêche les deux fichiers de diverger en silence : le jour où
  // un format d'impression est ajouté d'un seul côté, cette ligne le dit.
  for (const format of FORMATS_IMPRIMES) {
    const id = identifiantArticle({ livrable: 'impression', format })
    assert.ok(article(id), `${id} n’est pas au catalogue serveur`)
  }
  assert.equal(identifiantArticle({}), 'affiche-pdf')
  assert.ok(article(identifiantArticle({})))
})

test('un article que l’écran ne sait pas nommer vaut null, jamais un identifiant inventé', () => {
  assert.equal(identifiantArticle({ livrable: 'impression', format: '12x12' }), null)
  assert.equal(identifiantArticle({ livrable: 'impression', format: '' }), null)
  assert.equal(identifiantArticle({ livrable: 'tatouage' }), null)
  // et pas d'accès aux clés héritées d'Object, comme côté serveur
  assert.equal(identifiantArticle({ livrable: 'impression', format: 'constructor' }), null)
})

// ── Le retour d'URL, à qui l'on ne fait pas confiance ───────────────────────

test('le retour de Stripe se lit, mais un « ?paye= » illisible ne confirme rien', () => {
  assert.deepEqual(lireRetourPaiement('?paye=cs_test_a1b2c3d4e5'), { cas: 'paye', session: 'cs_test_a1b2c3d4e5' })
  assert.deepEqual(lireRetourPaiement('?paiement=annule'), { cas: 'annule', session: '' })
  assert.deepEqual(lireRetourPaiement(''), { cas: null, session: '' })
  assert.deepEqual(lireRetourPaiement('?embed=1'), { cas: null, session: '' })
  // ⚠️ Le gabarit non remplacé : quelqu'un recopie la success_url du code
  // source. Il ne doit pas partir chez Stripe, et surtout rien confirmer.
  assert.equal(lireRetourPaiement('?paye={CHECKOUT_SESSION_ID}').cas, 'invalide')
  assert.equal(lireRetourPaiement('?paye=oui').cas, 'invalide')
  assert.equal(lireRetourPaiement('?paye=').cas, 'invalide')
  assert.equal(lireRetourPaiement('?paye=cs_' + 'x'.repeat(200)).cas, 'invalide')
  // une session invalide ne repart JAMAIS dans l'objet rendu
  assert.equal(lireRetourPaiement('?paye=<script>').session, '')
})

test('le client et le serveur ont EXACTEMENT la même idée d’un identifiant de session', () => {
  // Deux expressions régulières dans deux fichiers, c'est deux occasions de
  // diverger. Celle-ci n'en laisse pas l'occasion.
  const echantillons = [
    'cs_test_a1b2c3d4e5', 'cs_live_' + 'a'.repeat(60), 'atelier_0123456789abcdef',
    'cs_court', 'atelier_MAJUSCULES', 'atelier_', '', 'nimportequoi',
    'cs_test_a1b2c3d4e5 ', ' cs_test_a1b2c3d4e5', 'cs_test_a1b2c3d4e5\n',
  ]
  for (const s of echantillons) {
    assert.equal(SESSION_RE.test(s), SESSION_RE_SERVEUR.test(s), `désaccord sur « ${s} »`)
  }
})

test('l’URL se débarrasse des paramètres de retour, et de rien d’autre', () => {
  // Laisser « ?paye= » dans la barre d'adresse, c'est une confirmation qui se
  // rejoue à chaque rechargement — et qui part dans un signet.
  assert.equal(urlSansRetour('https://shibumap.com/?paye=cs_test_a1b2c3d4e5'), '/')
  assert.equal(urlSansRetour('https://shibumap.com/?paiement=annule&studio=1'), '/?studio=1')
  assert.equal(urlSansRetour('https://shibumap.com/?paye=x#s=abc'), '/#s=abc')
  assert.equal(urlSansRetour('pas une url'), null)
})

// ── Le panier : ce qui survit à l'aller-retour ──────────────────────────────

/** Un `sessionStorage` de test. `casse` simule une navigation privée. */
function stockage(casse = false) {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (casse) throw new Error('quota'); m.set(k, String(v)) },
    removeItem: (k) => m.delete(k),
  }
}

const etatAffiche = {
  format: '40x50', orientation: 'portrait', cartouche: false, cartoucheSombre: true,
  titre: 'Nā Pali', cadrage: { zoom: 1.7, x: -0.2, y: 0.1 }, pointNet: { x: 1, y: 2, z: 3 },
}

test('la composition de l’affiche traverse l’aller-retour vers Stripe', () => {
  // ⚠️ LE PIÈGE DU TUNNEL HÉBERGÉ : partir payer est une NAVIGATION, pas une
  // fenêtre modale. L'application est déchargée puis rechargée au retour ; sans
  // ce panier, l'acheteur qui renonce doit TOUT recomposer.
  const s = stockage()
  poserPanier({ id: 'p-1', article: 'affiche-pdf', carte: 'AAA', affiche: afficheSerialisable(etatAffiche) }, s)
  const relu = lirePanier(s)
  assert.equal(relu.article, 'affiche-pdf')
  assert.equal(relu.carte, 'AAA')
  assert.deepEqual(relu.affiche, {
    format: '40x50', orientation: 'portrait', cartouche: false, cartoucheSombre: true,
    titre: 'Nā Pali', cadrage: { zoom: 1.7, x: -0.2, y: 0.1 }, pointNet: { x: 1, y: 2, z: 3 },
  })
})

test('le LOGO importé ne traverse pas, et on ne fait pas semblant', () => {
  // C'est une URL d'objet (« blob: ») : elle meurt avec le document. La copier
  // dans le stockage produirait un cadre vide à l'arrivée — pire qu'un logo
  // manquant, parce qu'on croirait l'avoir sauvegardé.
  const serialise = afficheSerialisable({ ...etatAffiche, logo: { url: 'blob:https://x/y', coin: 'br', taille: 0.2 } })
  assert.ok(!('logo' in serialise))
  assert.equal(JSON.stringify(serialise).includes('blob:'), false)
})

test('un stockage qui refuse d’écrire ne fait pas échouer l’achat', () => {
  // Navigation privée, quota plein : on perd le retour, pas la vente.
  assert.equal(poserPanier({ id: 'p-1', affiche: {} }, stockage(true)), false)
  assert.doesNotThrow(() => viderPanier(stockage(true)))
})

test('un panier abîmé rend null, il ne casse pas le démarrage du site', () => {
  const s = stockage()
  s.setItem(CLE_PANIER, 'pas du json')
  assert.equal(lirePanier(s), null)
  s.setItem(CLE_PANIER, '"une chaîne"')
  assert.equal(lirePanier(s), null)
  assert.equal(lirePanier(stockage()), null)
})

test('une composition relue est REVALIDÉE : un format inconnu retombe sur le défaut', () => {
  // Le stockage est de même origine, donc sans attaquant distant — mais une
  // version PRÉCÉDENTE de ce code a pu y écrire une autre forme.
  assert.equal(afficheRestauree({ format: 'A0' }).format, '50x70')
  assert.equal(afficheRestauree({ format: '30x40' }).format, '30x40')
  assert.equal(afficheRestauree(null), null)
  // un cadrage absurde ne traverse pas jusqu'à la caméra
  const c = afficheRestauree({ cadrage: { zoom: NaN, x: 'gauche' } }).cadrage
  assert.ok(Number.isFinite(c.zoom) && Number.isFinite(c.x) && Number.isFinite(c.y))
  // un point net incomplet vaut « pas de point net », jamais un NaN
  assert.equal(afficheRestauree({ pointNet: { x: 1, y: 2 } }).pointNet, null)
  assert.equal(afficheRestauree({ pointNet: { x: 1, y: 2, z: NaN } }).pointNet, null)
})

// ── L'aller : ce que le navigateur poste, et ce qu'il ne poste pas ──────────

test('AUCUN PRIX ne part du navigateur', () => {
  // La faille numéro un des paiements web, vue depuis l'autre bout du fil.
  // Les commentaires ont le droit de PARLER de prix — c'est même leur travail
  // ici. C'est le CODE qui ne doit pas en manipuler.
  const code = readFileSync(new URL('../src/paiement.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '')
  assert.ok(!/\bprix\b/.test(code), 'src/paiement.js ne doit jamais manipuler de prix')
  assert.ok(!/\bcentimes\b/.test(code), 'ni de centimes')
})

test('la demande de caisse poste un identifiant d’article, et rien de plus', async () => {
  let vu = null
  const r = await demanderCaisse({ article: 'affiche-pdf', retour: 'p-42' }, async (url, init) => {
    vu = { url, corps: JSON.parse(init.body) }
    return { ok: true, status: 200, json: async () => ({ ok: true, url: 'https://checkout.stripe.com/x', id: 'cs_1' }) }
  })
  assert.equal(vu.url, URL_CAISSE)
  assert.deepEqual(vu.corps, { article: 'affiche-pdf', retour: 'p-42' })
  assert.equal(r.ok, true)
  assert.equal(r.url, 'https://checkout.stripe.com/x')
})

test('le code d’atelier ne part QUE s’il y en a un', async () => {
  let corps = null
  const faux = async (_u, init) => {
    corps = JSON.parse(init.body)
    return { ok: true, status: 200, json: async () => ({ ok: true, url: 'u' }) }
  }
  await demanderCaisse({ article: 'affiche-pdf' }, faux)
  assert.ok(!('code' in corps), 'une commande ordinaire ne porte aucune trace du contournement')
  await demanderCaisse({ article: 'affiche-pdf', code: 'phrase-secrete' }, faux)
  assert.equal(corps.code, 'phrase-secrete')
})

test('une caisse en panne rend une erreur lisible, jamais une exception', async () => {
  // ⚠️ Une fonction non déployée rend la page 404 de Netlify, en HTML :
  // `res.json()` lèverait, et l'acheteur verrait un bouton mort.
  const html = await demanderCaisse({ article: 'affiche-pdf' }, async () => ({
    ok: false, status: 404, json: async () => { throw new SyntaxError('Unexpected token <') },
  }))
  assert.equal(html.ok, false)
  assert.match(html.erreur, /caisse indisponible/)

  const reseau = await demanderCaisse({ article: 'affiche-pdf' }, async () => { throw new TypeError('Failed to fetch') })
  assert.deepEqual(reseau, { ok: false, erreur: 'réseau' })

  const refus = await demanderCaisse({ article: 'affiche-pdf' }, async () => ({
    ok: false, status: 403, json: async () => ({ ok: false, erreur: 'code refusé' }),
  }))
  assert.equal(refus.erreur, 'code refusé')

  // sans article, on ne dérange même pas le serveur
  let appele = false
  await demanderCaisse({ article: null }, async () => { appele = true })
  assert.equal(appele, false)
})

// ── Le retour : le serveur tranche, pas l'URL ───────────────────────────────

test('une panne réseau ne fabrique JAMAIS une confirmation de paiement', async () => {
  const r = await verifierPaiement('cs_test_a1b2c3d4e5', async () => { throw new TypeError('offline') })
  assert.equal(r.etat, 'indisponible')
})

test('un identifiant de forme douteuse ne part même pas au serveur', async () => {
  let appele = false
  const r = await verifierPaiement('{CHECKOUT_SESSION_ID}', async () => { appele = true })
  assert.equal(appele, false)
  assert.equal(r.etat, 'inconnue')
})

test('aucun message de retour ne promet un téléchargement', () => {
  // La doctrine du projet : la chaîne PDF n'existe pas encore, on le DIT.
  // Promettre un fichier qui n'arrive pas coûte plus cher qu'assumer un chantier.
  for (const etat of ['paye', 'en-attente', 'expiree', 'livree', 'indisponible', 'inconnue', 'nimportequoi']) {
    const m = messageRetour(etat)
    assert.ok(m.length > 20, `${etat} : message trop court pour être honnête`)
    assert.ok(!/télécharg|download/i.test(m), `${etat} promet un téléchargement`)
  }
  assert.match(messageRetour('paye'), /pas encore produit/)
  assert.match(messageRetour('inconnue'), /ne correspond à aucun paiement/)
})

// ── L'état d'une session, vu du serveur ─────────────────────────────────────

test('le journal fait foi ; Stripe ne sert que tant qu’il n’a rien écrit', () => {
  // Stripe redirige l'acheteur AVANT d'avoir livré son webhook : sans le
  // recours à Stripe, un paiement valide s'annoncerait « inconnu » pendant les
  // premières secondes.
  assert.equal(etatDepuisSources({ article: 'affiche-pdf', livrable: 'fichier' }, null).etat, 'paye')
  assert.equal(etatDepuisSources(null, { payment_status: 'paid' }).etat, 'paye')
  assert.equal(etatDepuisSources(null, { payment_status: 'unpaid', status: 'open' }).etat, 'en-attente')
  assert.equal(etatDepuisSources(null, { payment_status: 'unpaid', status: 'expired' }).etat, 'expiree')
  assert.equal(etatDepuisSources(null, { payment_status: 'no_payment_required' }).etat, 'paye')
  // une session inventée : personne ne la connaît, on ne confirme rien
  assert.equal(etatDepuisSources(null, null).etat, 'inconnue')
  // une commande déjà livrée le dit — c'est ça, « déjà consommée »
  assert.equal(etatDepuisSources({ livree: true }, null).etat, 'livree')
})

test('l’état d’une session ne rend AUCUNE donnée personnelle', () => {
  // ⚠️ Un « ?paye=… » se recopie et se partage. Le premier venu qui l'ouvre ne
  // doit y trouver ni l'email, ni l'adresse, ni le montant de l'acheteur.
  const e = etatDepuisSources({
    article: 'affiche-pdf', livrable: 'fichier', email: 'club@example.org',
    pays: 'FR', centimes: 1900, client: 'cus_ABC', facture: 'in_X',
  }, null)
  assert.deepEqual(Object.keys(e).sort(), ['article', 'atelier', 'etat', 'livrable', 'livree'])
  assert.equal(JSON.stringify(e).includes('example.org'), false)
  assert.equal(JSON.stringify(e).includes('1900'), false)
})

// ── LE CONTOURNEMENT D'ATELIER ──────────────────────────────────────────────

test('sans SHIBU_CODE_ATELIER, le contournement n’existe pas', () => {
  assert.equal(codeAtelierValide('nimporte quoi', undefined), false)
  assert.equal(codeAtelierValide('', ''), false)
  assert.equal(codeAtelierValide('', undefined), false)
})

test('un secret COURT est refusé comme s’il était absent', () => {
  // Sans ce plancher, un « SHIBU_CODE_ATELIER=test » posé pour voir ouvrirait
  // une caisse que l'on force en quelques milliers d'essais.
  assert.equal(codeAtelierValide('test', 'test'), false)
  assert.equal(codeAtelierValide('a'.repeat(23), 'a'.repeat(23)), false)
  assert.equal(codeAtelierValide('a'.repeat(24), 'a'.repeat(24)), true)
})

test('un code faux est refusé, quelle que soit sa forme', () => {
  const bon = 'un-secret-assez-long-pour-passer'
  assert.equal(codeAtelierValide(bon, bon), true)
  assert.equal(codeAtelierValide(bon + 'x', bon), false)
  assert.equal(codeAtelierValide(bon.slice(0, -1), bon), false)
  assert.equal(codeAtelierValide(bon.toUpperCase(), bon), false)
  // rien de tout ça ne doit lever (timingSafeEqual jette sur deux tailles différentes)
  for (const v of [null, undefined, 0, {}, [], Buffer.from(bon)]) {
    assert.equal(codeAtelierValide(v, bon), false)
  }
})

test('la commande d’atelier a la forme d’une vraie, à 0 € et marquée', () => {
  const c = commandeAtelier(commandeDepuisSession, {
    id: 'atelier_0123456789abcdef',
    art: ARTICLES['affiche-pdf'],
    corps: { article: 'affiche-pdf', retour: 'p-7' },
  })
  assert.equal(c.atelier, true, 'sans ce marqueur, un essai passe pour une vente')
  // ⚠️ ZÉRO, et pas 1900 : rien n'a été encaissé. Le jour où l'on additionnera
  // ce journal, personne ne se souviendra de retrancher les essais.
  assert.equal(c.centimes, 0)
  assert.equal(c.email, '', 'pas d’acheteur, donc pas d’email — donc aucun mail ne part')
  assert.equal(c.session, 'atelier_0123456789abcdef')
  assert.equal(c.article, 'affiche-pdf')
  assert.equal(c.livrable, 'fichier')
  assert.equal(c.retour, 'p-7')
  assert.equal(c.livree, false)
  assert.equal(c.bloque, false)
})

/** Fait tourner la caisse en enregistrant les URL appelées, pas seulement les corps. */
async function caisseAvecCode(corpsRequete, codeEnv) {
  const fetchOriginel = globalThis.fetch
  const cleOriginelle = process.env.STRIPE_SECRET_KEY
  const codeOriginel = process.env.SHIBU_CODE_ATELIER
  const appels = []
  process.env.STRIPE_SECRET_KEY = 'sk_test_bouchon_pas_une_vraie_cle'
  if (codeEnv === undefined) delete process.env.SHIBU_CODE_ATELIER
  else process.env.SHIBU_CODE_ATELIER = codeEnv
  globalThis.fetch = async (url) => {
    appels.push(String(url))
    return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/x', id: 'cs_1' }) }
  }
  try {
    const rep = await caisse(new Request('https://shibumap.com/.netlify/functions/paiement', {
      method: 'POST', body: JSON.stringify(corpsRequete),
    }))
    return { appels, rep, json: await rep.json() }
  } finally {
    globalThis.fetch = fetchOriginel
    if (cleOriginelle === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = cleOriginelle
    if (codeOriginel === undefined) delete process.env.SHIBU_CODE_ATELIER
    else process.env.SHIBU_CODE_ATELIER = codeOriginel
  }
}

test('un code d’atelier faux : 403, et AUCUNE session Stripe n’est créée', async () => {
  const { appels, rep, json } = await caisseAvecCode(
    { article: 'affiche-pdf', code: 'devine' }, 'un-secret-assez-long-pour-passer'
  )
  assert.equal(rep.status, 403)
  assert.equal(json.erreur, 'code refusé')
  assert.deepEqual(appels, [], 'un code refusé ne doit rien ouvrir du tout')
})

test('un code envoyé alors que l’environnement n’en a aucun est refusé', async () => {
  // Le cas qui compte le plus : le contournement ne s'active pas tout seul.
  const { rep, json } = await caisseAvecCode({ article: 'affiche-pdf', code: 'x' }, undefined)
  assert.equal(rep.status, 403)
  assert.equal(json.erreur, 'code refusé')
})

test('le bon code ne passe JAMAIS par api.stripe.com', async () => {
  // Tout l'intérêt : Adrien éprouve la chaîne sans qu'un centime bouge. Le
  // journal (Netlify Blobs) est absent sous node, donc la réponse est un 502
  // « journal indisponible » — ce qu'on vérifie ici, c'est qu'aucune session de
  // paiement n'a été ouverte en chemin.
  const { appels, rep } = await caisseAvecCode(
    { article: 'affiche-pdf', code: 'un-secret-assez-long-pour-passer' }, 'un-secret-assez-long-pour-passer'
  )
  assert.equal(appels.filter((u) => u.includes('api.stripe.com')).length, 0)
  assert.ok(rep.status === 200 || rep.status === 502, `statut inattendu : ${rep.status}`)
})

test('une commande ORDINAIRE ne regarde même pas le code d’atelier', async () => {
  // Le contournement ne doit rien coûter ni rien changer au chemin des ventes.
  const { appels, json } = await caisseAvecCode({ article: 'affiche-pdf' }, 'un-secret-assez-long-pour-passer')
  assert.equal(json.ok, true)
  assert.equal(appels.length, 1)
  assert.match(appels[0], /api\.stripe\.com/)
})

// ── LE MESSAGE DE RETOUR QUAND LE FICHIER EST VRAIMENT LÀ ───────────────────

test('⚠️ LE TÉLÉCHARGEMENT NE SE PROMET QUE SI LE FICHIER EST EN MAIN', () => {
  // La doctrine n'a pas changé : sans fichier, aucune phrase ne promet de
  // téléchargement. Ce qui a changé, c'est qu'il peut maintenant y en avoir un
  // — sorti du coffre, à l'écran, au moment où ce message s'affiche.
  assert.match(messageRetour('paye'), /pas encore produit/)
  assert.match(messageRetour('paye', { fichierPret: true }), /téléchargement/)
  assert.ok(!/pas encore produit/.test(messageRetour('paye', { fichierPret: true })))
  assert.match(messageRetour('livree', { fichierPret: true }), /téléchargement/)
  // et un état qui n'est pas un paiement abouti ne promet rien, fichier ou pas :
  // le coffre contient un fichier produit AVANT le paiement.
  for (const etat of ['en-attente', 'expiree', 'indisponible', 'inconnue']) {
    assert.ok(!/télécharg/i.test(messageRetour(etat, { fichierPret: true })), etat)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// LE CHEMIN DE L'ARGENT, RELU EN DERNIER — les trois défauts de la revue finale
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ LE MAIL DE CONFIRMATION NE PROMET PLUS UN LIEN QUI N’EXISTE PAS', () => {
  // Le webhook n'avait été touché par AUCUN des dix commits du chantier :
  // l'écran a été rendu honnête, le mail a continué d'annoncer « Le lien de
  // téléchargement suit dans ce message » — et rien ne l'a jamais ajouté. C'est
  // le seul canal de tout acheteur dont le coffre local échoue.
  const t = texteConfirmation({ livrable: 'fichier', session: 'cs_test_a1b2c3d4e5' })
  assert.ok(!/lien de téléchargement/i.test(t), 'le mail promet toujours un lien')
  assert.ok(!/https?:\/\//.test(t), 'aucune URL : la livraison distante n’existe pas encore')
  // Ce qu'il doit dire à la place : OÙ est le fichier…
  assert.match(t, /onglet/i)
  assert.match(t, /Télécharger le PDF/)
  // …et QUOI FAIRE quand il n'y est pas (onglet fermé, navigation privée, autre
  // machine) — c'est-à-dire le cas même qui rend ce message nécessaire.
  assert.match(t, /réponds/i)
  assert.match(t, /cs_test_a1b2c3d4e5/, 'la référence de commande manque au support')
  // L'imprimé, lui, ne parle ni d'onglet ni de téléchargement : il part par la poste.
  const imprime = texteConfirmation({ livrable: 'impression' })
  assert.ok(!/télécharg|onglet/i.test(imprime))
  assert.match(imprime, /impression/)
  // Et c'est bien CE texte-là que le webhook envoie.
  const source = readFileSync(new URL('../netlify/functions/paiement-webhook.mjs', import.meta.url), 'utf8')
  assert.match(source, /text: texteConfirmation\(commande\),/)
  assert.ok(!/'Merci — ton fichier[^']*lien de téléchargement/.test(source))
})

test('⚠️ LE CATALOGUE N’ANNONCE AUCUNE DENSITÉ QUE LA CHAÎNE NE SAIT PAS RENDRE', () => {
  // Le libellé part sur la page Stripe ET sur la facture numérotée. Il disait
  // « PDF 300 dpi » alors que la table nominale plafonne déjà le 50 × 70 à 250
  // et le 61 × 91 à 200, et que la sonde dégrade légitimement jusqu'au plancher
  // sur une machine bridée (mesuré à 4 096 px : A2 à 170 dpi). Un remboursement
  // écrit d'avance, sur un document opposable.
  const { detail } = ARTICLES['affiche-pdf']
  assert.match(detail, /dpi/, 'le libellé ne dit plus rien de la densité')
  const annonces = (detail.match(/\d+/g) || []).map(Number)
  assert.ok(annonces.length >= 2, `« ${detail} » annonce une densité UNIQUE, alors qu'elle varie`)
  const bas = Math.min(...annonces)
  const haut = Math.max(...annonces)
  // La fourchette annoncée est EXACTEMENT celle que la chaîne peut produire :
  // du plancher de dégradation à la plus haute densité nominale. Trop haute,
  // c'est la promesse d'aujourd'hui ; trop basse, c'est se dévendre.
  assert.equal(bas, DPI_PLANCHER, `la borne basse annoncée (${bas}) n'est pas le plancher réel (${DPI_PLANCHER})`)
  assert.equal(haut, Math.max(...Object.values(DPI_NOMINAL)), 'la borne haute annoncée ne colle pas à la table nominale')
  // Et aucune densité atteignable ne tombe hors de la fourchette, format par format.
  for (const [id, nominal] of Object.entries(DPI_NOMINAL)) {
    assert.ok(nominal <= haut, `${id} : ${nominal} dpi dépasse la fourchette annoncée`)
    assert.ok(DPI_PLANCHER >= bas, `${id} : le plancher tombe sous la fourchette annoncée`)
  }
})

test('⚠️ RIEN N’EST DÛ ? ALORS SEULEMENT LE PANIER PEUT PARTIR', () => {
  // La question qui décide de la survie de la SEULE clé qui ramène au fichier
  // payé dans le coffre.
  assert.equal(livraisonEnSuspens('paye', { fichierPret: true }), true)
  assert.equal(livraisonEnSuspens('livree', { fichierPret: true }), true)
  // payé mais rien à l'écran : il n'y a rien à rejouer, c'est le mail qui prend
  // le relais — et on ne détruit pas le fichier pour autant (voir main.js).
  assert.equal(livraisonEnSuspens('paye'), false)
  // virement, prélèvement : la banque n'a pas tranché. Jeter la clé ici, c'est
  // perdre le fichier AVANT que le paiement ne se confirme.
  assert.equal(livraisonEnSuspens('en-attente'), true)
  assert.equal(livraisonEnSuspens('en-attente', { fichierPret: true }), true)
  // panne réseau : on n'a pas pu demander, donc on ne conclut pas.
  assert.equal(livraisonEnSuspens('indisponible'), true)
  for (const etat of ['expiree', 'inconnue', 'invalide', null, undefined]) {
    assert.equal(livraisonEnSuspens(etat, { fichierPret: true }), false, String(etat))
  }
})

test('⚠️ LA LIVRAISON SE REJOUE AU RECHARGEMENT, SANS « ?paye= » DANS L’URL', () => {
  // L'URL de retour est nettoyée dès le chargement du module — et elle doit
  // l'être. Il ne restait donc AUCUN chemin vers le fichier payé après un
  // rechargement, un onglet fermé une seconde, ou un clic manqué : le PDF
  // dormait dans le coffre jusqu'à la purge des 24 h, orphelin.
  const s = stockage()
  poserPanier({ id: 'p-1', article: 'affiche-pdf', carte: 'AAA', affiche: afficheSerialisable(etatAffiche) }, s)
  // Un panier frais ne rejoue RIEN : on ne relance pas une vérification pour
  // quelqu'un qui n'est jamais parti payer.
  assert.equal(retourAReprendre('', lirePanier(s)).cas, null)
  assert.equal(lirePanier(s).session, '')

  // La livraison reste en suspens : on note la session à revérifier.
  assert.equal(armerReprise('cs_test_a1b2c3d4e5', s), true)
  const relu = lirePanier(s)
  assert.equal(relu.session, 'cs_test_a1b2c3d4e5')
  assert.equal(relu.id, 'p-1', 'la clé du coffre a été perdue en route')
  assert.equal(relu.affiche.format, '40x50', 'la composition a été perdue en route')

  // Rechargement : plus de query string, et pourtant le retour se rejoue.
  const r = retourAReprendre('', relu)
  assert.equal(r.cas, 'paye')
  assert.equal(r.session, 'cs_test_a1b2c3d4e5')
  assert.equal(r.reprise, true)
  // …et l'URL garde la priorité : une annulation fraîche clôt une reprise.
  assert.equal(retourAReprendre('?paiement=annule', relu).cas, 'annule')
  assert.equal(retourAReprendre('?paye=cs_test_zzzzzzzzzz', relu).session, 'cs_test_zzzzzzzzzz')

  // Une session illisible relue du stockage ne part JAMAIS au serveur : même
  // garde que pour « ?paye= », et pour la même raison.
  poserPanier({ ...relu, session: 'javascript:alert(1)' }, s)
  assert.equal(lirePanier(s).session, '')
  assert.equal(retourAReprendre('', lirePanier(s)).cas, null)

  // Le fichier pris, le panier s'en va — et plus rien ne se rejoue.
  viderPanier(s)
  assert.equal(armerReprise('cs_test_a1b2c3d4e5', s), false)
  assert.equal(retourAReprendre('', lirePanier(s)).cas, null)
})

test('⚠️ UN FICHIER PAYÉ NE SE JETTE JAMAIS, QUOI QUE DISE L’URL', () => {
  // La doctrine était appliquée à moitié : on ne jetait pas sur un coffre muet,
  // mais on jetait encore sur un paramètre d'URL. Or `retourAReprendre` donne
  // volontairement la priorité à l'URL — un retour arrière dans l'historique
  // vers l'adresse d'annulation, ou un identifiant tronqué au copier-coller,
  // suffisait donc à détruire la marchandise de quelqu'un qui avait payé.
  assert.equal(fichierJetable({ id: 'p-1' }), true)
  assert.equal(fichierJetable({ id: 'p-1', session: '' }), true)
  assert.equal(fichierJetable({ id: 'p-1', session: 'cs_test_a1b2c3d4e5' }), false)
  assert.equal(fichierJetable({ id: 'p-1', session: 'atelier_abcd1234' }), false, 'l’atelier paie 0 € mais reçoit un vrai fichier')
  // pas de clé, rien à jeter — et surtout pas `jeter('')`
  assert.equal(fichierJetable(null), false)
  assert.equal(fichierJetable({ session: 'cs_test_a1b2c3d4e5' }), false)
  assert.equal(fichierJetable({}), false)

  // Le scénario, joué de bout en bout : livraison confirmée et armée, puis les
  // deux URL qui la contredisent.
  const s = stockage()
  poserPanier({ id: 'p-1', article: 'affiche-pdf', carte: 'AAA', affiche: afficheSerialisable(etatAffiche) }, s)
  assert.equal(armerReprise('cs_test_a1b2c3d4e5', s), true)
  const paye = lirePanier(s)

  // ① l'URL d'annulation gagne la lecture du retour…
  assert.equal(retourAReprendre('?paiement=annule', paye).cas, 'annule')
  // …mais elle ne peut pas révoquer une réponse du serveur.
  assert.equal(fichierJetable(paye), false)

  // ② un « ?paye= » malformé rend `invalide`, donc un état `inconnue`, donc
  // `!paye` — la garde `!paye` seule laissait donc passer la destruction.
  assert.equal(retourAReprendre('?paye=zzz', paye).cas, 'invalide')
  assert.equal(fichierJetable(paye), false)

  // ③ et le panier d'un achat jamais confirmé, lui, se jette bien : la garde
  // ne doit pas transformer chaque abandon en sept mégaoctets immortels.
  viderPanier(s)
  poserPanier({ id: 'p-2', article: 'affiche-pdf', carte: 'AAA', affiche: afficheSerialisable(etatAffiche) }, s)
  assert.equal(fichierJetable(lirePanier(s)), true)
})
