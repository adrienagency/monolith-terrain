// LE SAS DE L'ACCUEIL — qui a le droit d'occuper le centre de l'écran.
//
// LE CONFLIT QU'IL ARBITRE (capture Adrien, vieux portable). L'accueil et la
// carte de chargement visent EXACTEMENT le même point : le milieu de la
// fenêtre. Or ils sont pilotés par deux horloges qui n'ont jamais été mises
// d'accord :
//   • l'accueil monte 900 ms après que main.js a fini de s'évaluer ;
//   • la carte de chargement s'efface quand le relief est prêt (2 s au plus
//     tôt, bien davantage si les tuiles ou le calcul traînent).
// Sans arbitre, sur une machine lente, le visiteur recevait les DEUX
// superposés : deux « ShibuMap », la baseline anglaise du chargement collée
// sous « Que veux-tu faire ? », la phrase d'info en fantôme derrière les
// trois portes. C'est le tout premier écran du site.
//
// ⚠️ LA PRIORITÉ A ÉTÉ INVERSÉE LE JOUR MÊME (28/07, décision Adrien). La
// première version de ce sas faisait ATTENDRE l'accueil : il demandait le
// centre et ne l'obtenait qu'une fois la carte partie, fondu compris. Adrien a
// retourné la règle une heure plus tard : « dès que la barre de menu commence
// à monter, le loader disparaît en fondu très rapide ». C'est un meilleur
// choix produit — le visiteur voit l'interface arriver au lieu d'attendre un
// chargement qui ne le concerne plus. Si tu lis l'ancienne règle dans
// l'historique (commit « L accueil attend que la carte de chargement ait
// quitte le centre ») : elle n'a pas été empilée, elle a été REMPLACÉE. Deux
// arbitres du même conflit, c'est le retour du bug sous une autre forme.
//
// LA RÈGLE, donc : l'accueil PRIME. Quand il monte alors que la carte occupe
// le centre, la carte CÈDE (fondu rapide, en CSS — `#loading.cede`). Le fond
// de relief, lui, reste : à froid il n'y a encore rien d'autre à montrer
// derrière. Et si l'accueil repart (Échap) alors que le chargement court
// toujours, la carte REPREND le centre — sans elle le visiteur fixerait une
// image figée sans un mot d'explication.
//
// ⚠️ POURQUOI ON N'ÉCOUTE JAMAIS `transitionend` (piège payé deux fois) : dans
// un onglet non composité (arrière-plan, machine à genoux) le navigateur gèle
// les transitions et l'événement n'arrive JAMAIS — tout nettoyage qui l'attend
// reste en plan. Ici plus personne n'attend personne : la montée est
// immédiate, l'effacement est un ORDRE (une classe posée par hub.js), et le
// fondu n'est qu'un habillage CSS dont rien ne dépend.
//
// Aucune référence au DOM dans ce fichier : la règle est pure, donc testable
// (test/hub-sas.test.js). Le câblage vit dans hub.js.

// `montrer`  : la montée de l'accueil — toujours immédiate désormais.
// `effacer`  : ordonne à la carte de chargement de céder le centre.
// `retablir` : lui rend le centre (l'accueil est reparti, le chargement court).
// `ouvert`   : l'accueil est-il actuellement au centre ? (isOpen dans hub.js)
// `occupe`   : la carte est-elle DÉJÀ à l'écran à la construction ?
export function creerSas({ montrer, effacer = () => {}, retablir = () => {}, ouvert = () => false, occupe = false } = {}) {
  let prise = !!occupe // la carte de chargement occupe le centre
  let cede = false // ... mais s'est effacée pour laisser passer l'accueil

  // la carte cède — une seule fois par chargement : le réveil automatique et
  // un clic sur le logo peuvent tomber pendant la même occupation.
  function ecarter() {
    if (!prise || cede) return
    cede = true
    effacer()
  }

  return {
    // l'accueil veut le centre : il l'obtient TOUT DE SUITE, et c'est la
    // carte de chargement qui s'écarte s'il y en a une.
    demander() {
      ecarter()
      montrer()
    },
    // la carte de chargement vient d'apparaître. Si l'accueil est déjà au
    // centre (chargement à chaud sous l'accueil ouvert), elle cède aussitôt :
    // la laisser monter remettrait deux titres l'un sur l'autre — le bug
    // d'origine, dans l'autre sens.
    occuper() {
      prise = true
      if (ouvert()) ecarter()
    },
    // la carte vient de recevoir `.hidden` : le chargement est fini, elle est
    // partie d'elle-même. Plus rien à céder ni à rétablir pour ce cycle.
    liberer() {
      prise = false
      cede = false
    },
    // Échap, focus dans la recherche, ouverture d'un espace… : l'accueil
    // quitte le centre. Si la carte avait cédé et que son chargement court
    // toujours, elle le reprend.
    annuler() {
      if (!cede) return
      cede = false
      if (prise) retablir()
    },
    placePrise: () => prise,
    aCede: () => cede,
  }
}
