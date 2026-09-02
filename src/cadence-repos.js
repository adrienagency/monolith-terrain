// LA CADENCE AU REPOS — PF4, bug n° 2 : « le globe tourne tout seul, donc il
// n'y a jamais d'image au repos, donc jamais de rendu à la demande ».
//
// ⚠️ **LA ROTATION PROPRE EST UN CHOIX PRODUIT, PAS UN OUBLI** : elle date de
// v29 (`7777e08`, « orbiting planet clouds »), elle est gardée par
// l'interrupteur Animations (`dtAmb`), et Adrien ne l'a jamais remise en cause.
// On ne la coupe donc pas ; on cesse de la DESSINER soixante fois par seconde.
//
// Ce qu'on a mesuré (PF4, `scripts/profil-pf4.mjs --scenario repos`, orbite à
// 60 000 km, RTX 3080 sans vsync) : au repos, la boucle dessine à chaque image
// une planète qui a tourné de 0,033° — 283 images/s sans vsync, 60 avec. La
// rotation est DÉTERMINISTE et lente (2 °/s) : à 30 images/s le globe tourne
// de 0,067° entre deux dessins, invisible à toute altitude d'orbite.
//
// LA RÈGLE : quand la seule chose qui bouge est la rotation propre — orbite,
// aucun geste depuis `DELAI_REPOS_MS`, aucun vol, aucun enregistrement — on
// dessine une image sur `DIVISEUR`. La LOGIQUE de l'image (streaming du globe,
// caméra, nuages) tourne à chaque image ; seul le DESSIN est sauté. Le premier
// geste rend la pleine cadence à l'image même (le compteur repart).
//
// ⚠️ Pas de « rendu à la demande » complet : avec les animations allumées, la
// mer, les nuages et la faune changent VRAIMENT à chaque image en surface.
// L'image au repos n'existe qu'en orbite, et c'est là qu'on la sert.

export const DELAI_REPOS_MS = 3000 // le même délai que la rotation propre (main.js)
export const DIVISEUR = 2 // une image dessinée sur deux : 60 → 30 i/s

// Pur, sans état : l'appelant tient le compteur. Rend `true` si CETTE image
// doit être dessinée.
export function dessinerCetteImage({
  mode = 'surface',
  occupe = false, // modes.busy : une plongée ou une sortie est en cours
  vol = false, // modes.travel / tween : la caméra est en vol
  tenu = false, // controlsHeld : la souris tient la caméra
  msDepuisGeste = Infinity,
  enregistrement = false,
  animations = true,
  compteur = 0,
  diviseur = DIVISEUR, // 1 = pleine cadence (l'échappatoire `?cadence=pleine`)
} = {}) {
  // hors orbite, ou dès qu'un geste, un vol ou un enregistrement est en cours :
  // pleine cadence, sans discussion
  if (mode !== 'orbital' || occupe || vol || tenu || enregistrement) return true
  if (!(msDepuisGeste > DELAI_REPOS_MS)) return true
  // animations coupées : la planète est FIGÉE au repos, rien ne change d'une
  // image à l'autre — on dessine une image sur `diviseur` quand même (une tuile
  // qui arrive doit se voir vite), jamais moins
  return !(diviseur > 1) || compteur % diviseur === 0
}
