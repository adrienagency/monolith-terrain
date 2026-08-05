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

// Huit lettres, pour l'étiquette de suivi Stripe (integration_identifier).
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
function suffixeAleatoire() {
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return s
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
    // ═════════════════════════════════════════════════════════════════════════
    // LA FACTURE NUMÉROTÉE (ajoutée le 2026-08-05)
    // ═════════════════════════════════════════════════════════════════════════
    //
    // Un club ou une collectivité qui achète une affiche demandera une facture,
    // pas un reçu. `invoice_creation` la fait établir, numéroter et rendre en
    // PDF par Stripe après le paiement.
    //
    // ⚠️ IL N'EXISTE QU'EN `mode: 'payment'` — vérifié dans la référence API
    // (Create a Checkout Session) : ni `subscription` (qui facture tout seul),
    // ni `setup`. C'est notre mode, donc rien ne bloque ici.
    //
    // ⚠️ ET LES DEUX PRÉALABLES SONT DÉJÀ RÉUNIS DEUX LIGNES PLUS HAUT, c'est
    // ce qui rend l'activation sûre : une facture a besoin d'une FICHE CLIENT
    // (`customer_creation: 'always'`) et d'une ADRESSE DE FACTURATION
    // (`billing_address_collection: 'required'`). Rien de nouveau n'est demandé
    // à l'acheteur : le tunnel collecte déjà tout ce que la facture exige, donc
    // aucun paiement qui aboutit aujourd'hui ne peut échouer à cause de ceci.
    //
    // ⚠️ CE N'EST PAS GRATUIT. Les factures post-paiement de Checkout ne font
    // PAS partie de Stripe Invoicing et se facturent à part : 0,4 % du total,
    // plafonné à 2 € par facture. Soit ~8 centimes sur l'affiche à 19 €, ~36
    // centimes sur celle à 89 €. C'est le prix de la facture, à assumer sur
    // chaque vente — pas une option qu'on active en passant.
    //
    // ⚠️ ET L'ENVOI DÉPEND DU DASHBOARD, PAS DU CODE. Sans « Paiements réussis »
    // coché dans Paramètres > Entreprise > E-mails aux clients, la facture est
    // bien créée et numérotée mais AUCUN MAIL NE PART — et rien ici ne le dira.
    // À cocher côté RÉEL, pas seulement en test (les deux modes ont leurs
    // propres réglages).
    //
    // ⚠️ PAS DE `footer` NI DE `account_tax_ids` ICI, ET C'EST DÉLIBÉRÉ. La
    // mention de TVA qu'une facture française doit porter dépend du régime, et
    // le catalogue le dit noir sur blanc : la franchise transfrontalière est
    // « le point que le SIE doit confirmer ». Écrire un article du CGI dans du
    // code avant cette confirmation, c'est imprimer une affirmation fiscale
    // fausse sur un document opposable. Ce texte se pose dans le Dashboard
    // (Paramètres > Facturation), là où Adrien peut le corriger sans
    // redéploiement, le jour où le régime est tranché.
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: art.libelle,
        // Les mêmes clés que la session : sans elles, une facture retrouvée
        // dans le Dashboard ne dit ni QUOI a été vendu, ni à quelle commande
        // ShibuMap elle se rattache.
        metadata: {
          article: corps.article,
          livrable: art.livrable,
          format: art.format || '',
        },
      },
    },
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
    // ⚠️ PAS DE `payment_method_types`, ET C'EST UNE RÈGLE GÉNÉRALE, PAS
    // SEULEMENT LIÉE AU BLOCAGE CI-DESSUS. Le guide Stripe est catégorique :
    // ne JAMAIS l'inclure (sauf Terminal, paiement en personne). Le forcer
    // désactive les moyens de paiement dynamiques — Stripe ne peut plus choisir
    // ce qui convertit le mieux pour chaque acheteur, ni suivre les réglages du
    // Dashboard. « Cartes uniquement au lancement » (le plan de monétisation
    // d'Adrien) se règle donc côté Dashboard (Settings > Payment methods),
    // pas ici : Adrien peut l'ajuster sans redéploiement, et ça coexiste avec
    // Stripe qui choisit dynamiquement PARMI ce qui est activé.
    //
    // Un vrai besoin de restriction dans le CODE passerait par
    // `payment_method_configurations`, pas par ce paramètre.
    //
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
    // Étiquette de suivi (guide Stripe, API ≥ 2026-03-25) : distingue ce
    // parcours des autres dans le Dashboard, pour comparer les taux de
    // conversion entre le Pass, l'affiche, les dons, etc.
    integration_identifier: `shibumap-${suffixeAleatoire()}`,
  }

  // `shipping_address_collection` a une forme imbriquée : on la repasse
  // proprement plutôt que par la clé plate ci-dessus.
  delete params['shipping_address_collection[allowed_countries]']
  if (art.livrable === 'impression') {
    params.shipping_address_collection = { allowed_countries: PAYS_AUTORISES }
  }

  const creerSession = (p, marque = '') => fetch(`${STRIPE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cle}`,
      'content-type': 'application/x-www-form-urlencoded',
      // ⚠️ CLÉ D'IDEMPOTENCE : un double-clic, un réseau qui bégaie, et sans
      // elle on crée deux sessions pour un seul achat.
      'idempotency-key': `${corps.article}:${corps.retour || ''}:${Math.floor(Date.now() / 6000)}${marque}`,
    },
    body: encode(p),
  })

  let r = await creerSession(params)
  let s = await r.json()

  // ⚠️ LE REPLI SANS FACTURE — parce qu'ici, une erreur ne coûte pas un rapport
  // de bug, elle coûte une VENTE : l'acheteur verrait un message d'erreur au
  // lieu de la page de paiement. Tout ce que la documentation exige est réuni
  // plus haut, mais la disponibilité réelle d'une option se juge sur le COMPTE,
  // et ce compte encaisse pour de vrai. Si Stripe refuse la facture, on refait
  // donc la session SANS elle plutôt que de renvoyer une 502 : la vente passe,
  // la facture manque, et le journal le crie.
  //
  // LE FILET EST ÉTROIT À DESSEIN : on ne rejoue que si Stripe désigne
  // explicitement `invoice_creation`. Toute autre erreur remonte telle quelle,
  // exactement comme avant.
  //
  // La seconde tentative porte une clé d'idempotence DISTINCTE : la première
  // est brûlée par la requête refusée.
  if (!r.ok && /invoice_creation/.test(`${s?.error?.param || ''} ${s?.error?.message || ''}`)) {
    console.error('[paiement] ⚠️ facture refusée par Stripe, session refaite SANS facture :', s?.error?.message)
    const { invoice_creation: _sansFacture, ...reste } = params
    r = await creerSession(reste, ':sf')
    s = await r.json()
  }

  if (!r.ok) {
    console.error('[paiement] Stripe a refusé :', s?.error?.message)
    return json({ ok: false, erreur: s?.error?.message || 'Stripe' }, 502)
  }
  return json({ ok: true, url: s.url, id: s.id })
}
