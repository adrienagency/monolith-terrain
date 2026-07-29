// LES RÈGLES DE L'ACCUEIL — ce que la page dit, ce qu'elle montre, ce que son
// bouton d'action fait. Aucune référence au DOM ici : la règle est pure, donc
// testable (test/accueil.test.js). Le câblage vit dans hub.js et bars.js, la
// mise en forme dans v28.css.
//
// POURQUOI CE FICHIER EXISTE. La refonte du 29/07 (Adrien, réf. landing Framer)
// a inversé la hiérarchie du centre : la marque descend au rang de pastille, la
// PROMESSE devient le titre, et une des trois portes disparaît. Trois décisions
// de produit qui étaient jusque-là éparpillées entre un innerHTML (hub.js), un
// libellé (bars.js) et une règle CSS. Elles vivent maintenant en un seul
// endroit, et un test les tient.

// Le message d'accueil du site. Adrien l'a dicté « Votre carte, votre designée,
// en 2 minutes » — coquille corrigée, et surtout remis au TUTOIEMENT, qui est la
// règle qu'il a lui-même posée (une passe entière vouvoiement→tutoiement a été
// faite sur tout le site). Se change ICI, en un mot.
export const TITRE_ACCUEIL = 'Ta carte, ton design, en 2 minutes.'

// Les portes que l'accueil propose. « Explorer » n'y est PLUS : « il y a déjà la
// barre de recherche juste en dessous » (Adrien) — poser la question deux fois
// dans le même écran, une fois en bouton et une fois en champ, c'est demander à
// choisir entre deux formulations de la même chose. Explorer n'est pas supprimé
// pour autant : il reste le mode au repos de la barre du bas, et l'accueil
// garde sa sortie « Échap — explorer librement ».
// ⚠️ L'ORDRE COMPTE : c'est celui des portes à l'écran, de gauche à droite.
export const PORTES_ACCUEIL = ['studio', 'parcours']

export const porteEnAccueil = (mode) => PORTES_ACCUEIL.includes(mode)

// Le bouton à droite du champ de recherche. C'est le MÊME bouton dans les deux
// états de la barre — un seul objet, donc une seule géométrie pour la rangée
// liquide (elembar.js calcule la largeur du cartouche du bas à partir de lui).
// Il change de visage, jamais d'existence :
//   'gpx'   — la recherche dort : importer une trace et la draper sur le relief
//   'aller' — un lieu est tapé : partir vers lui
//   'focus' — la recherche est éveillée mais vide. « Quand le champ est vide, il
//             ne doit pas rester actif à ne rien faire » (Adrien). Plutôt que
//             de l'éteindre — un bouton mort n'explique rien — il RENVOIE au
//             champ : le geste naturel devient le geste utile.
//
// ⚠️ POURQUOI `accueil` NE SUFFIT PAS, et c'est un piège mesuré au navigateur.
// Entrer dans le champ FAIT REDESCENDRE l'accueil (hub.js : « le champ de
// recherche est le VRAI champ »). Un bouton qui ne lisait que `body.ce-hub`
// redevenait donc « GPX » à la seconde où le visiteur cliquait dans le champ
// pour taper son lieu — il tapait « Annecy », cliquait le bouton, et recevait
// un SÉLECTEUR DE FICHIERS. Le bouton doit suivre la RECHERCHE, pas l'accueil :
// l'accueil n'est plus qu'une des trois raisons de la croire éveillée.
export function actionBouton({ accueil = false, saisie = '', champActif = false } = {}) {
  if (String(saisie).trim()) return 'aller'
  return accueil || champActif ? 'focus' : 'gpx'
}

// 'aller' et 'focus' portent le MÊME mot : le bouton ne doit pas changer de
// libellé sous le doigt au fil de la frappe — il changerait de largeur, et la
// rangée liquide reposerait ses bulles à chaque lettre tapée.
export const LIBELLE_ACTION = { gpx: 'GPX', aller: 'Aller', focus: 'Aller' }
