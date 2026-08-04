// Lissage — moyenne mobile exponentielle générique. Les chiffres d'un HUD
// qui avancent à 60 im/s sautent d'une valeur à l'autre à chaque image ;
// personne ne peut LIRE un nombre qui change 60 fois par seconde. Un seul
// petit outil, réutilisé partout où une donnée en temps réel doit se poser
// pour l'œil (carnet de course, futur HUD météo, etc.).
//
// tau : constante de temps en secondes — le temps pour parcourir ~63 % de
// l'écart vers la nouvelle valeur. Petit = réactif mais tremblant, grand =
// stable mais en retard. 0 ou dt manquant = pas de lissage (valeur brute).
export function lisser(precedent, cible, dt, tau) {
  if (!Number.isFinite(precedent)) return cible
  if (!Number.isFinite(cible)) return precedent
  if (!(tau > 0) || !(dt > 0)) return cible
  const k = 1 - Math.exp(-dt / tau)
  return precedent + (cible - precedent) * k
}

// Le lissage n'est PAS la seule façon de poser un nombre pour l'œil, et sur
// certaines grandeurs c'en est la mauvaise.
//
// ⚠️ CAS VÉCU : le D+ RESTANT. ascentStats() applique une hystérésis dont le
// résultat DÉPEND du point de départ (race-model.js le dit explicitement) : il
// n'est donc pas monotone en `idx` et peut osciller de quelques mètres d'une
// image à l'autre. Le lisser mentirait à l'autre bout (une moyenne mobile
// LAISSE remonter la valeur), alors que la vérité physique est plus simple :
// ce qu'il reste à monter ne remonte jamais tant qu'on avance. On force donc
// la décroissance au lieu de moyenner — pas de retard, pas de tremblement, et
// aucune constante de temps à régler.
// `precedent` non fini (première image, changement de trace) = on accepte.
export function decroissant(precedent, cible) {
  if (!Number.isFinite(cible)) return cible
  if (!Number.isFinite(precedent)) return cible
  return Math.min(precedent, cible)
}

// Lisse chaque champ numérique d'un objet plat vers ses valeurs cibles,
// en gardant l'état précédent par clé (pour ne pas fabriquer un nouvel
// objet de moyennes à chaque appelant). `champs` liste les clés à lisser ;
// les autres passent inchangées (ex. les noms/pictos ne se moyennent pas).
export function lisserChamps(etat, cible, dt, tau, champs) {
  const out = { ...cible }
  for (const k of champs) {
    if (typeof cible[k] === 'number') out[k] = lisser(etat[k], cible[k], dt, tau)
  }
  return out
}
