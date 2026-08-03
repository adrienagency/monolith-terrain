// LE CATALOGUE DES CHOSES QU'ON VEND — côté SERVEUR, et c'est tout l'enjeu.
//
// ⚠️ LE PRIX NE VIENT JAMAIS DU NAVIGATEUR. C'est la faille numéro un des
// paiements web : on laisse le client poster `{ prix: 19 }`, quelqu'un poste
// `{ prix: 1 }`, et la commande part à un euro. Le navigateur n'envoie donc
// qu'un IDENTIFIANT d'article ; le prix, le libellé et la TVA vivent ici, dans
// un fichier qu'il ne peut pas atteindre.
//
// Ce module est PUR : ni réseau, ni Stripe, ni variables d'environnement. Il se
// teste sous node, et les deux fonctions le partagent.

// Les prix sont en CENTIMES : Stripe ne travaille qu'en entiers, et un prix en
// euros flottants finit toujours par produire un 18,999999999999998.
export const ARTICLES = {
  // ── Le fichier seul ───────────────────────────────────────────────────────
  'affiche-pdf': {
    libelle: 'Affiche ShibuMap — fichier d’impression',
    detail: 'PDF 300 dpi, prêt pour l’imprimeur',
    centimes: 1900,
    livrable: 'fichier',
  },
  // ── L'affiche imprimée et livrée (dropshipping) ───────────────────────────
  // Un article PAR FORMAT : le coût de production et le port n'ont rien à voir
  // entre un A4 et un 61 × 91.
  'affiche-print-30x40': { libelle: 'Affiche imprimée 30 × 40 cm', detail: 'Papier mat 200 g, livrée', centimes: 4900, livrable: 'impression', format: '30x40' },
  'affiche-print-40x50': { libelle: 'Affiche imprimée 40 × 50 cm', detail: 'Papier mat 200 g, livrée', centimes: 5900, livrable: 'impression', format: '40x50' },
  'affiche-print-50x70': { libelle: 'Affiche imprimée 50 × 70 cm', detail: 'Papier mat 200 g, livrée', centimes: 6900, livrable: 'impression', format: '50x70' },
  'affiche-print-61x91': { libelle: 'Affiche imprimée 61 × 91 cm', detail: 'Papier mat 200 g, livrée', centimes: 8900, livrable: 'impression', format: '61x91' },
}

/** Un article, ou null. Jamais d'article inventé à partir d'une entrée client. */
export function article(id) {
  return (typeof id === 'string' && Object.hasOwn(ARTICLES, id) && ARTICLES[id]) || null
}

// ══════════ LES PAYS OÙ L'ON REFUSE DE VENDRE, ET POURQUOI ══════════════════
//
// ⚠️ LE ROYAUME-UNI RÉCLAME LA TVA DÈS LA PREMIÈRE VENTE à un particulier
// britannique — pas de seuil, pas de franchise. Tant que ShibuMap n'y est pas
// immatriculé, chaque vente au RU serait une infraction. On l'exclut donc du
// paiement lui-même plutôt que de compter sur une phrase de conditions
// générales que personne ne lit.
//
// (Le reste de l'Union relève de la franchise transfrontalière — c'est le point
// que le SIE doit confirmer AVANT d'ouvrir le drapeau de commerce.)
export const PAYS_EXCLUS = ['GB']

/**
 * Les pays de facturation que Stripe doit accepter.
 * Liste blanche courte au lancement : on ouvre au fur et à mesure, il est plus
 * facile d'ajouter un pays que de rattraper une TVA non déclarée.
 */
export const PAYS_AUTORISES = [
  'FR', 'BE', 'CH', 'LU', 'DE', 'ES', 'IT', 'NL', 'PT', 'AT', 'IE',
  'DK', 'SE', 'FI', 'PL', 'CZ', 'CA', 'US',
].filter((p) => !PAYS_EXCLUS.includes(p))

/** Le prix affiché, pour que l'interface et la caisse ne se contredisent pas. */
export function prixEuros(id) {
  const a = article(id)
  return a ? a.centimes / 100 : null
}
