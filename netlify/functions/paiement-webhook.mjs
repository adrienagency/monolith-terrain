// LE WEBHOOK — la SEULE source de vérité sur « c'est payé ».
//
//   POST /.netlify/functions/paiement-webhook   (appelé par Stripe, pas par nous)
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI LA PAGE DE RETOUR NE SUFFIT PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// Après paiement, Stripe renvoie le client sur `/?paye=<session>`. Il serait
// tentant de livrer là. Ce serait faux pour deux raisons :
//   · cette URL est REJOUABLE — on la copie, on la partage, on la recharge ;
//   · le client peut fermer l'onglet avant d'y arriver, et il aura payé quand
//     même. C'est le cas le plus injuste, et le plus fréquent sur mobile.
// Le webhook, lui, part de Stripe vers nous, quoi que fasse le navigateur.
//
// ⚠️ ET ON VÉRIFIE `payment_status === 'paid'`, PAS L'EXISTENCE DE LA SESSION.
// Une session existe dès qu'on l'a créée, avant tout paiement.
//
// ═══════════════════════════════════════════════════════════════════════════
// VARIABLES D'ENVIRONNEMENT
// ═══════════════════════════════════════════════════════════════════════════
//
//   STRIPE_WEBHOOK_SECRET   whsec_…   (donné par Stripe à la création du point
//                                      de terminaison — PAS la clé secrète)
//   RESEND_API_KEY          re_…      (facultatif : sans lui, la commande est
//                                      journalisée et l'email est sauté)
//   SHIBU_MAIL_EXPEDITEUR   ex. affiche@shibumap.com

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { PAYS_EXCLUS } from './_paiement-catalogue.mjs'

/**
 * Vérifie la signature Stripe. Pure, donc testable.
 *
 * ⚠️ ELLE SE CALCULE SUR LE CORPS BRUT, OCTET POUR OCTET. Passer par
 * `JSON.parse` puis `JSON.stringify` réordonne les clés et change les
 * espaces : la signature ne correspond plus, et on passe une journée à
 * chercher une erreur de clé qui n'existe pas.
 *
 * ⚠️ ET LA COMPARAISON EST À TEMPS CONSTANT. Un `===` sur une signature fuit,
 * caractère par caractère, de quoi la reconstruire.
 */
export function signatureValide(brut, entete, secret, toleranceS = 300, maintenantS = Math.floor(Date.now() / 1000)) {
  if (!brut || !entete || !secret) return false
  const parts = Object.fromEntries(
    String(entete).split(',').map((p) => p.split('=').map((s) => s.trim())).filter((p) => p.length === 2)
  )
  const t = Number(parts.t)
  if (!Number.isFinite(t)) return false
  // Le horodatage borne le REJEU : une requête interceptée hier ne doit pas
  // pouvoir être renvoyée aujourd'hui.
  if (Math.abs(maintenantS - t) > toleranceS) return false
  const attendu = createHmac('sha256', secret).update(`${t}.${brut}`, 'utf8').digest('hex')
  const recu = parts.v1
  if (typeof recu !== 'string' || recu.length !== attendu.length) return false
  return timingSafeEqual(Buffer.from(attendu, 'hex'), Buffer.from(recu, 'hex'))
}

/**
 * Ce qu'on GARDE d'une session payée. Pure, donc testable — comme
 * `signatureValide` au-dessus, et pour la même raison : c'est le contenu de cet
 * objet qui décide de ce qu'on saura encore d'une vente dans six mois.
 *
 * ⚠️ `s.customer` EST L'IDENTIFIANT DE LA FICHE CLIENT que Stripe vient de
 * créer (`customer_creation: 'always'`, côté caisse). Il était JETÉ : on ne
 * gardait que l'email. Or c'est le seul fil qui reliera un jour un achat à un
 * compte ShibuMap — un email se change, un `cus_…` ne bouge pas. Le perdre à
 * chaque vente, c'est rendre le rattachement impossible rétroactivement.
 *
 * ⚠️ `s.metadata.compte` N'EXISTE PAS ENCORE, et on le lit quand même. Il n'y a
 * pas de système de comptes dans ShibuMap ; le jour où il y en aura un, la
 * caisse posera cette clé et les commandes la porteront SANS reprise de
 * données. Lire une clé absente coûte une chaîne vide ; l'ajouter après coup
 * coûte toutes les ventes déjà faites.
 *
 * ⚠️ `s.invoice` PEUT ÊTRE VIDE SANS QUE RIEN N'AILLE MAL. Stripe n'établit la
 * facture qu'APRÈS encaissement, pas à la fin de la session : sur un moyen de
 * paiement différé (SEPA, virement, Bacs…), la commande est écrite avant que la
 * facture existe. Une chaîne vide ici ne veut donc pas dire « pas de facture »,
 * elle veut dire « pas encore » — c'est l'événement `invoice.paid` qui la
 * porterait, si on l'écoutait un jour.
 *
 * Les trois champs acceptent la forme CHAÎNE comme la forme DÉVELOPPÉE (`{ id }`) :
 * une requête avec `expand` renvoie l'objet entier, et on ne veut pas stocker
 * `[object Object]` dans le journal des ventes.
 */
export function commandeDepuisSession(s, maintenant = new Date()) {
  const pays = s.customer_details?.address?.country || ''
  // ⚠️ Stripe Checkout n'offre AUCUN moyen de restreindre le PAYS DE
  // FACTURATION par la config (seule l'adresse de LIVRAISON l'accepte, via
  // shipping_address_collection). Un client depuis un pays exclu peut donc
  // toujours payer. On ne bloque pas le paiement — l'argent est déjà pris —
  // mais on bloque la LIVRAISON et on alerte Adrien : la conformité TVA/
  // légale de ce pays n'est pas résolue, une régularisation manuelle
  // (remboursement ou traitement à part) doit être décidée au cas par cas.
  const bloque = PAYS_EXCLUS.includes(pays)

  const ident = (v) => (typeof v === 'string' ? v : v?.id || '')

  return {
    session: s.id,
    payeLe: maintenant.toISOString(),
    centimes: s.amount_total,
    devise: s.currency,
    email: s.customer_details?.email || '',
    client: ident(s.customer),
    compte: s.metadata?.compte || '',
    facture: ident(s.invoice),
    pays,
    article: s.metadata?.article || '',
    livrable: s.metadata?.livrable || '',
    format: s.metadata?.format || '',
    retour: s.metadata?.retour || '',
    livree: false,
    bloque,
  }
}

/**
 * Le corps du courriel de confirmation. Pur, donc testable — comme
 * `commandeDepuisSession` au-dessus, et pour une raison plus dure encore : ces
 * quelques phrases sont LE SEUL CANAL de tout acheteur dont le coffre local a
 * échoué (navigation privée, quota, autre machine, onglet fermé).
 *
 * ⚠️ IL NE PROMET PLUS DE LIEN, PARCE QU'IL N'Y EN A PAS. La phrase précédente
 * annonçait « le lien de téléchargement suit dans ce message » — aucun lien n'y
 * a jamais été ajouté, et la livraison distante n'existe pas encore (le fichier
 * est dans le navigateur DE L'ACHETEUR, voir src/coffre-affiche.js). Le mail
 * disait donc le contraire de l'écran, qui, lui, a été rendu honnête.
 *
 * ⚠️ ET IL NE SUPPOSE PAS QUE LE COFFRE A MARCHÉ. Ce module ne sait rien du
 * navigateur d'en face : il indique où le fichier se trouve QUAND tout s'est
 * bien passé, et il dit quoi faire quand ce n'est pas le cas. C'est la
 * différence entre une consigne et une promesse.
 */
export function texteConfirmation(commande = {}) {
  if (commande.livrable === 'impression') {
    return 'Merci — ton affiche part à l’impression. Tu recevras le suivi dès qu’elle est expédiée.'
  }
  return [
    'Merci — ton fichier d’impression est prêt.',
    '',
    'Il se télécharge depuis la page ShibuMap où tu l’as composé : reviens sur',
    'l’onglet d’où tu es parti payer, le bouton « Télécharger le PDF » s’y trouve',
    'en bas de l’écran. Le fichier a été préparé sur ta machine avant le paiement,',
    'il n’a donc jamais quitté ton navigateur.',
    '',
    'Si ce bouton n’y est pas — onglet fermé, navigation privée, autre appareil —',
    'réponds simplement à ce message : Adrien te renvoie le fichier à la main.',
    commande.session ? `\nRéférence de commande : ${commande.session}` : '',
  ].join('\n').trimEnd()
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('méthode', { status: 405 })

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('STRIPE_WEBHOOK_SECRET absente', { status: 503 })

  // Le corps BRUT d'abord — voir signatureValide.
  const brut = await req.text()
  if (!signatureValide(brut, req.headers.get('stripe-signature'), secret)) {
    // Pas de détail dans la réponse : on ne renseigne pas qui sonde.
    console.warn('[paiement] signature refusée')
    return new Response('signature', { status: 400 })
  }

  let evt
  try { evt = JSON.parse(brut) } catch { return new Response('corps', { status: 400 }) }
  if (evt.type !== 'checkout.session.completed') return new Response('ignoré', { status: 200 })

  const s = evt.data?.object || {}
  if (s.payment_status !== 'paid') return new Response('non payé', { status: 200 })

  const journal = getStore('paiements')
  // ⚠️ IDEMPOTENCE : Stripe REJOUE ses webhooks jusqu'à obtenir un 2xx, et il
  // arrive qu'il en envoie deux pour un seul événement. Sans ce garde, on
  // enverrait deux fois le fichier — ou on commanderait deux affiches.
  const cle = `session/${s.id}`
  if (await journal.get(cle)) return new Response('déjà traité', { status: 200 })

  const commande = commandeDepuisSession(s)
  const { pays, bloque } = commande
  // On écrit AVANT d'envoyer quoi que ce soit : si l'email échoue, la commande
  // existe et se rattrape à la main. L'inverse perdrait la trace d'un paiement.
  await journal.setJSON(cle, commande)

  const resend = process.env.RESEND_API_KEY
  if (resend && bloque) {
    // Pas de mail client ici : la commande attend un arbitrage humain.
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.SHIBU_MAIL_EXPEDITEUR || 'ShibuMap <affiche@shibumap.com>',
          to: ['adrien@adrienagency.com'],
          subject: `ShibuMap — commande bloquée (pays exclu : ${pays})`,
          text: `Une commande vient d'être payée depuis un pays actuellement exclu (${pays}) — livraison suspendue en attendant ta décision (remboursement ou régularisation).\n\nSession : ${s.id}\nMontant : ${(commande.centimes / 100).toFixed(2)} ${commande.devise?.toUpperCase()}\nEmail client : ${commande.email}\nArticle : ${commande.article}`,
        }),
      })
    } catch (err) {
      console.error('[paiement] alerte pays exclu non envoyée :', err?.message)
    }
  } else if (resend && commande.email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.SHIBU_MAIL_EXPEDITEUR || 'ShibuMap <affiche@shibumap.com>',
          to: [commande.email],
          subject: 'Ton affiche ShibuMap',
          text: texteConfirmation(commande),
        }),
      })
    } catch (err) {
      // Un email raté ne doit PAS renvoyer une erreur à Stripe : il rejouerait
      // l'événement, et on se retrouverait à traiter deux fois une commande
      // dont le seul défaut est un mail non parti.
      console.error('[paiement] email non envoyé :', err?.message)
    }
  }

  return new Response('ok', { status: 200 })
}

// ⚠️ Netlify parse le corps par défaut, ce qui DÉTRUIRAIT la signature. Cette
// configuration lui dit de nous laisser le flux brut.
export const config = { path: '/.netlify/functions/paiement-webhook' }
