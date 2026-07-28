// LE SAS DE L'ACCUEIL — qui a le droit d'occuper le centre de l'écran.
//
// LE BUG QU'IL CORRIGE (capture Adrien, vieux portable). L'accueil et la carte
// de chargement visent EXACTEMENT le même point : le milieu de la fenêtre. Or
// ils sont pilotés par deux horloges qui n'ont jamais été mises d'accord :
//   • l'accueil monte 900 ms après que main.js a fini de s'évaluer ;
//   • la carte de chargement s'efface quand le relief est prêt (2 s au plus
//     tôt, bien davantage si les tuiles ou le calcul traînent).
// Sur un poste rapide les deux tombent à ~2,4 s et personne ne voit rien. Sur
// une machine lente, l'écart s'ouvre : la carte de chargement reste 6 s pendant
// que l'accueil, lui, est monté à 4,5 s. Résultat mesuré ici en le rejouant
// processeur saturé : DEUX « ShibuMap » à l'écran, la baseline anglaise du
// chargement collée sous « Que veux-tu faire ? », et la phrase d'info en
// fantôme derrière la carte des trois portes. C'est le tout premier écran d'un
// visiteur, et c'est ce qu'il voit d'autant plus longtemps que sa machine est
// modeste.
//
// LE PRINCIPE. On n'accélère rien et on ne retarde rien arbitrairement : on
// pose une règle d'occupation. L'accueil DEMANDE le centre ; il ne l'obtient
// que lorsque la carte de chargement l'a rendu, fondu compris.
//
// ⚠️ POURQUOI PAS `transitionend`. Le piège maison, déjà payé deux fois : dans
// un onglet non composité (arrière-plan, machine à genoux) le navigateur gèle
// les transitions et l'événement n'arrive JAMAIS — le nettoyage qui l'attend
// reste en plan. Ici on n'écoute donc que la CLASSE `.hidden`, écrite par du
// JS, et le fondu se compte au minuteur. Un minuteur en arrière-plan est
// bridé, jamais annulé : au pire l'accueil monte un peu plus tard, il ne
// disparaît pas.
//
// Aucune référence au DOM dans ce fichier : la règle est pure, donc testable
// (test/hub-sas.test.js). Le câblage vit dans hub.js.

// Le temps qu'on laisse à la carte de chargement pour s'effacer avant de faire
// monter l'accueil. Son fondu dure 0,3 s (`#loading` dans style.css) ; 340 ms
// couvre la frame de retard, et c'est aussi la durée du voyage de la barre —
// le même tempo, donc, d'un bout à l'autre de l'ouverture.
export const FONDU_MS = 340

// `montrer` : ce qu'on appelle quand l'accueil a enfin la place.
// `occupe`  : la carte de chargement est-elle DÉJÀ à l'écran à la construction ?
// `poser` / `retirer` : injectables pour les tests (minuteur factice).
export function creerSas({ montrer, occupe = false, poser = setTimeout, retirer = clearTimeout } = {}) {
  let demande = false
  let prise = !!occupe
  let t = 0

  // annule le minuteur en cours, quel qu'il soit. `t = 0` derrière : sans ça un
  // `retirer` ultérieur porterait sur un identifiant déjà consommé — inoffensif
  // avec clearTimeout, trompeur à la lecture.
  function oublier() {
    if (t) retirer(t)
    t = 0
  }

  // la montée elle-même. Consomme la demande dans TOUS les cas où elle
  // aboutit : une demande qui traîne referait monter l'accueil au prochain
  // chargement, longtemps après que le visiteur est passé à autre chose.
  function lever() {
    t = 0
    if (!demande || prise) return
    demande = false
    montrer()
  }

  return {
    // l'accueil veut le centre
    demander() {
      if (demande) return
      demande = true
      if (prise) return // on attend que la place se libère
      lever() // libre : tout de suite, sans délai inventé
    },
    // la carte de chargement vient d'apparaître
    occuper() {
      prise = true
      oublier() // une montée programmée n'a plus lieu d'être
    },
    // la carte de chargement vient de recevoir `.hidden` : elle s'efface
    liberer() {
      prise = false
      if (!demande) return
      oublier()
      t = poser(lever, FONDU_MS)
    },
    // Échap, focus dans la recherche, ouverture d'un espace… : l'accueil n'a
    // plus rien à demander, et surtout plus rien à faire monter plus tard.
    annuler() {
      demande = false
      oublier()
    },
    enAttente: () => demande,
    placePrise: () => prise,
  }
}
