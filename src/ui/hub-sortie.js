// LA SORTIE AU POINTEUR DE L'ACCUEIL — la règle, pure, hors DOM (PF4, bug n° 5).
// Voir hub.js pour le câblage et test/voile-accueil.test.js pour la mesure.

// Ce qui se clique garde son propre écouteur : les portes du hub (les boutons
// de mode), la croix, « Échap — explorer librement », le champ de recherche.
export const INTERACTIFS = 'button, input, a, [role="button"], .ce-qb-core'

export function sortieAuPointeur({ ouvert = false, enAttente = false, interactif = false, bouton = 0 } = {}) {
  if (!(ouvert || enAttente)) return false
  if (interactif) return false
  return bouton === 0
}
