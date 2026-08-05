// L'INTERRUPTEUR D'ANIMATIONS — un seul, pour tout le mouvement ambiant.
//
// ⚠️ LE CHOIX EXPLICITE PRIME TOUJOURS SUR LE SYSTÈME. `prefers-reduced-motion`
// décide de l'état de DÉPART, jamais de la suite : quelqu'un qui a demandé le
// mouvement réduit à son système d'exploitation et qui rallume ici a dit ce
// qu'il voulait, et le contredire à chaque visite serait une réponse absurde à
// un réglage d'accessibilité.
export function animationsActives(etat) {
  if (!etat || etat.reglage === undefined) return true
  return !!etat.reglage
}

// L'état de départ, la toute première fois. C'est le SEUL endroit où le système
// a voix au chapitre.
export function reglageInitial(reduitParSysteme) {
  return !reduitParSysteme
}
