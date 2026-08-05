// L'ÉTAT D'UNE SESSION — la seule chose qui a le droit de dire « c'est payé »
// à la page de retour.
//
//   GET /.netlify/functions/paiement-etat?session=cs_…  -> { ok, etat, … }
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI CETTE FONCTION EXISTE ALORS QUE LE WEBHOOK FAIT DÉJÀ FOI
// ═══════════════════════════════════════════════════════════════════════════
//
// Elle ne LIVRE rien et ne décide rien : le webhook reste la source de vérité,
// et lui seul écrit dans le journal des ventes. Celle-ci répond à une question
// que le navigateur ne peut pas trancher tout seul : « ce `?paye=…` que je
// viens de recevoir dans mon URL, il vaut quelque chose ? »
//
// Sans elle, la page de retour n'a d'autre choix que de croire un paramètre
// d'URL — c'est-à-dire d'afficher « paiement reçu » à quiconque tape
// `?paye=cs_nimportequoi` dans sa barre d'adresse.
//
// ⚠️ ELLE INTERROGE STRIPE, PAS SEULEMENT LE JOURNAL. Stripe redirige
// l'acheteur AVANT (souvent) d'avoir livré son webhook : chercher uniquement
// dans le journal ferait dire « inconnue » à un paiement parfaitement valide,
// une fois sur deux, dans les premières secondes. Le journal d'abord (il porte
// le contournement d'atelier et l'état de livraison), Stripe ensuite.
//
// ⚠️ ELLE NE REND AUCUNE DONNÉE PERSONNELLE. Un `?paye=…` se recopie et se
// partage ; le premier qui l'ouvre ne doit pas y trouver l'email, l'adresse ou
// le montant de l'acheteur. Cette fonction rend l'ÉTAT et l'article, rien de
// plus — c'est tout ce que la page de retour a besoin de savoir.
//
// Variables d'environnement : STRIPE_SECRET_KEY (la même que la caisse).

const STRIPE = 'https://api.stripe.com/v1'

/** La même forme que côté client (src/paiement.js) — un test vérifie qu'elles
 *  acceptent et refusent exactement les mêmes identifiants. */
export const SESSION_RE = /^(cs_[A-Za-z0-9_]{8,120}|atelier_[a-z0-9]{8,40})$/

const json = (corps, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    // Une réponse d'état ne se met jamais en cache : elle change à la seconde
    // près pendant que la banque confirme.
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

/**
 * L'état à annoncer, à partir des deux sources. PUR, donc testable sans
 * réseau — et c'est la fonction qui décide de ce qu'un inconnu peut lire.
 *
 * @param {object|null} commande - la commande du journal (écrite par le webhook,
 *   ou par le contournement d'atelier de la caisse)
 * @param {object|null} session - la session telle que Stripe la décrit
 */
export function etatDepuisSources(commande, session) {
  if (commande) {
    return {
      etat: commande.livree ? 'livree' : 'paye',
      article: commande.article || '',
      livrable: commande.livrable || '',
      livree: !!commande.livree,
      atelier: !!commande.atelier,
    }
  }
  if (session) {
    // `no_payment_required` = total à zéro (un jour : un code promo à 100 %).
    // C'est un paiement abouti du point de vue de Stripe, donc du nôtre.
    const paye = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    const etat = paye ? 'paye' : session.status === 'expired' ? 'expiree' : 'en-attente'
    return {
      etat,
      article: session.metadata?.article || '',
      livrable: session.metadata?.livrable || '',
      livree: false,
      atelier: false,
    }
  }
  return { etat: 'inconnue', article: '', livrable: '', livree: false, atelier: false }
}

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') return json({ ok: false, erreur: 'méthode' }, 405)

  const id = new URL(req.url).searchParams.get('session') || ''
  // Première barrière : la forme. Un identifiant qui n'en est pas un n'a pas à
  // faire un aller-retour chez Stripe — et le gabarit `{CHECKOUT_SESSION_ID}`
  // non remplacé tombe ici.
  if (!SESSION_RE.test(id)) return json({ ok: false, erreur: 'session illisible' }, 400)

  // ── Le journal d'abord ────────────────────────────────────────────────────
  // Import dynamique : une simple vérification de forme ratée ne doit pas payer
  // le chargement du client Blobs, et les tests n'ont pas à le fournir.
  let commande = null
  try {
    const { getStore } = await import('@netlify/blobs')
    commande = await getStore('paiements').get(`session/${id}`, { type: 'json' })
  } catch (err) {
    // Un journal indisponible n'empêche pas de répondre : Stripe sait aussi.
    console.error('[paiement-etat] journal illisible :', err?.message)
  }

  // ── Stripe ensuite, et seulement si le journal n'a rien ───────────────────
  let session = null
  if (!commande && id.startsWith('cs_')) {
    const cle = process.env.STRIPE_SECRET_KEY
    if (!cle) return json({ ok: false, erreur: 'STRIPE_SECRET_KEY absente de l’environnement' }, 503)
    try {
      const r = await fetch(`${STRIPE}/checkout/sessions/${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${cle}` },
      })
      // Un 404 de Stripe = session inventée. Ce n'est PAS une erreur de notre
      // côté : on répond « inconnue », ce qui est exactement la vérité.
      if (r.ok) session = await r.json()
    } catch (err) {
      console.error('[paiement-etat] Stripe injoignable :', err?.message)
      return json({ ok: false, erreur: 'stripe injoignable' }, 502)
    }
  }

  return json({ ok: true, ...etatDepuisSources(commande, session) })
}
