// LA CAISSE — création d'une session Stripe Checkout.
//
//   POST /.netlify/functions/paiement   { article, retour? }  -> { ok, url }
//
// Générique par construction : elle ne sait rien de l'affiche. On lui donne un
// identifiant d'article, elle rend une URL de paiement. Le Pass, les dons et la
// boutique passeront par la même porte.
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QUI NE TOUCHE JAMAIS CE SERVEUR
// ═══════════════════════════════════════════════════════════════════════════
//
// Aucune donnée de carte. Stripe Checkout est une page HÉBERGÉE CHEZ STRIPE :
// le client y va, saisit sa carte chez eux, revient. ShibuMap ne voit ni numéro,
// ni CVC, ni même le nom du porteur — ce qui met tout le PCI-DSS hors de portée.
// C'est la seule raison pour laquelle un site sans compte peut encaisser.
//
// ⚠️ ET LE PRIX NE VIENT PAS DU NAVIGATEUR : voir _paiement-catalogue.mjs.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES VARIABLES D'ENVIRONNEMENT (à poser dans Netlify, jamais dans le dépôt)
// ═══════════════════════════════════════════════════════════════════════════
//
//   STRIPE_SECRET_KEY      sk_test_… puis sk_live_…
//   SHIBU_URL_SITE         https://shibumap.com  (pour les retours)
//
// Pas de SDK Stripe : l'API REST suffit pour une session, et une dépendance de
// moins, c'est une dépendance de moins à tenir à jour dans une fonction qui
// manipule de l'argent.

import { article, PAYS_AUTORISES } from './_paiement-catalogue.mjs'

const STRIPE = 'https://api.stripe.com/v1'

// Stripe attend de l'`application/x-www-form-urlencoded` avec des clés en
// crochets. Un petit encodeur vaut mieux qu'un SDK de 2 Mo.
function encode(obj, prefixe = '', sortie = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    const cle = prefixe ? `${prefixe}[${k}]` : k
    if (Array.isArray(v)) v.forEach((e, i) => (typeof e === 'object' ? encode(e, `${cle}[${i}]`, sortie) : sortie.append(`${cle}[${i}]`, String(e))))
    else if (typeof v === 'object') encode(v, cle, sortie)
    else sortie.append(cle, String(v))
  }
  return sortie
}

const json = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, erreur: 'méthode' }, 405)

  const cle = process.env.STRIPE_SECRET_KEY
  if (!cle) {
    // On le DIT au lieu de rendre une 500 muette : c'est l'erreur qu'on aura
    // le jour du branchement, et elle doit se diagnostiquer en une seconde.
    return json({ ok: false, erreur: 'STRIPE_SECRET_KEY absente de l’environnement' }, 503)
  }

  let corps
  try { corps = await req.json() } catch { return json({ ok: false, erreur: 'corps illisible' }, 400) }

  const art = article(corps?.article)
  if (!art) return json({ ok: false, erreur: 'article inconnu' }, 400)

  const site = (process.env.SHIBU_URL_SITE || new URL(req.url).origin).replace(/\/$/, '')

  const params = {
    mode: 'payment',
    // ⚠️ `{CHECKOUT_SESSION_ID}` est un GABARIT REMPLI PAR STRIPE, pas une
    // variable JS. C'est lui qui permet à la page de retour de savoir quelle
    // commande vient d'être payée sans qu'on ait posé de cookie.
    success_url: `${site}/?paye={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/?paiement=annule`,
    // La facture part par mail : c'est notre seul lien avec un acheteur qui n'a
    // pas de compte.
    customer_creation: 'always',
    billing_address_collection: 'required',
    // ⚠️ MANAGED PAYMENTS EST DÉSACTIVÉ VOLONTAIREMENT, ET C'EST UNE DÉCISION,
    // PAS QU'UN CONTOURNEMENT. Découvert en production le 2026-08-04 : le compte
    // Stripe l'a actif par défaut (Stripe devient marchand officiel — il gère
    // taxe, fraude et litiges à la place de ShibuMap). Séduisant sur le papier,
    // mais il exige un `tax_code` PAR PRODUIT dans le registre fiscal de Stripe,
    // et se tromper de code y facture la MAUVAISE TVA à un vrai client. Choisir
    // le bon code demande une vraie recherche, pas une supposition d'agent.
    //
    // Le désactiver remet le système sur le modèle que le plan de monétisation
    // d'Adrien avait déjà résolu (franchise transfrontalière, RU exclu au
    // niveau du catalogue) — voir _paiement-catalogue.mjs. Managed Payments
    // reste une PISTE À ÉTUDIER PLUS TARD, à tête reposée, pas à activer par un
    // paramètre technique glissé en urgence.
    'managed_payments[enabled]': false,
    payment_method_types: ['card'],
    // La liste blanche des pays — le Royaume-Uni en est exclu tant que la TVA
    // britannique n'est pas réglée (voir le catalogue).
    'shipping_address_collection[allowed_countries]': art.livrable === 'impression' ? PAYS_AUTORISES : undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: art.centimes,
        product_data: { name: art.libelle, description: art.detail },
      },
    }],
    // Ce qu'on retrouvera dans le webhook pour savoir QUOI livrer. Stripe borne
    // les métadonnées à 500 caractères par valeur : on n'y met que des clés,
    // jamais le rendu.
    metadata: {
      article: corps.article,
      livrable: art.livrable,
      format: art.format || '',
      // l'identifiant de la commande côté ShibuMap, s'il y en a un
      retour: String(corps.retour || '').slice(0, 200),
    },
  }

  // `shipping_address_collection` a une forme imbriquée : on la repasse
  // proprement plutôt que par la clé plate ci-dessus.
  delete params['shipping_address_collection[allowed_countries]']
  if (art.livrable === 'impression') {
    params.shipping_address_collection = { allowed_countries: PAYS_AUTORISES }
  }

  const r = await fetch(`${STRIPE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cle}`,
      'content-type': 'application/x-www-form-urlencoded',
      // ⚠️ CLÉ D'IDEMPOTENCE : un double-clic, un réseau qui bégaie, et sans
      // elle on crée deux sessions pour un seul achat.
      'idempotency-key': `${corps.article}:${corps.retour || ''}:${Math.floor(Date.now() / 6000)}`,
    },
    body: encode(params),
  })
  const s = await r.json()
  if (!r.ok) {
    console.error('[paiement] Stripe a refusé :', s?.error?.message)
    return json({ ok: false, erreur: s?.error?.message || 'Stripe' }, 502)
  }
  return json({ ok: true, url: s.url, id: s.id })
}
