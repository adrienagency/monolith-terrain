// LE SAS DE L'ACCUEIL — qui a le droit d'occuper le centre de l'écran.
//
// LE CONFLIT QU'IL ARBITRE (capture Adrien, vieux portable puis iMac 2015).
// L'accueil et la carte de chargement visent EXACTEMENT le même point : le
// milieu de la fenêtre. Or ils sont pilotés par deux horloges qui n'ont jamais
// été mises d'accord :
//   • l'accueil monte 900 ms après que main.js a fini de s'évaluer ;
//   • la carte de chargement s'efface quand le relief est prêt (2 s au plus
//     tôt, bien davantage si les tuiles ou le calcul traînent).
// Sans arbitre, le visiteur reçoit les DEUX superposés : deux « ShibuMap »,
// la baseline du chargement collée sous « Que veux-tu faire ? », la phrase
// d'info en fantôme derrière les trois portes. C'est le tout premier écran.
//
// ⚠️ CE FICHIER A CHANGÉ DE RÈGLE DEUX FOIS LE 28/07. Il faut lire l'histoire
// pour ne pas la refaire :
//   1. l'accueil ATTEND que la carte soit partie (première version) ;
//   2. l'accueil PRIME, la carte s'efface en fondu rapide dès que la barre
//      monte (inversion demandée par Adrien une heure plus tard) ;
//   3. retour à la règle 1 — et c'est celle-ci qui s'applique.
//
// POURQUOI LA RÈGLE 2 A ÉCHOUÉ, et c'est instructif : elle ne supprimait pas
// le recouvrement, elle le RACCOURCISSAIT. La carte s'effaçait en 0,18 s
// pendant que les mots de l'accueil montaient en 0,24 s — les deux étaient
// donc lisibles ensemble par construction, et une capture d'Adrien l'a montré
// noir sur blanc. Sur une machine à 3 images par seconde, ces deux fenêtres
// durent plusieurs images chacune. Deux fondus qui se croisent ne peuvent pas
// ne pas se voir ; deux étapes qui se suivent, si.
//
// LA RÈGLE, DONC (Adrien, mot pour mot) : « la barre de menu ne commence à
// bouger que dès que le loader a terminé de s'exécuter ». Aucun recouvrement
// n'est possible, quelle que soit la lenteur de la machine : ce n'est plus un
// réglage de durées, c'est un ordre de passage.
//
// ⚠️ POURQUOI ON N'ÉCOUTE JAMAIS `transitionend` (piège payé trois fois) :
// dans un onglet non composité (arrière-plan, machine à genoux) le navigateur
// gèle les transitions et l'événement n'arrive JAMAIS — la montée resterait en
// plan pour toujours. On écoute la CLASSE `.hidden` (hub.js), et le délai
// ci-dessous est un simple minuteur, qui lui part quoi qu'il arrive.
//
// Aucune référence au DOM dans ce fichier : la règle est pure, donc testable
// (test/hub-sas.test.js). Le câblage vit dans hub.js.

// Le temps que la carte de chargement met à s'effacer une fois `.hidden` posée
// (0,3 s en CSS, `#loading` dans style.css). L'accueil attend ce fondu EN PLUS
// du chargement lui-même : « terminé de s'exécuter » veut dire parti de
// l'écran, pas simplement marqué fini.
export const FONDU_MS = 320

// `montrer` : fait monter l'accueil au centre (bar.setHome(true) dans hub.js).
// `occupe`  : la carte de chargement est-elle DÉJÀ à l'écran à la construction ?
// `poser` / `retirer` : injectés pour que les tests n'attendent pas vraiment.
export function creerSas({ montrer, occupe = false, poser = setTimeout, retirer = clearTimeout } = {}) {
  let demande = false // l'accueil veut le centre
  let prise = !!occupe // la carte de chargement l'occupe
  let t = 0

  // annule le minuteur en cours, quel qu'il soit. `t = 0` derrière : sans ça un
  // `retirer` ultérieur porterait sur un identifiant déjà consommé — inoffensif
  // avec clearTimeout, trompeur à la lecture.
  function oublier() {
    if (t) retirer(t)
    t = 0
  }

  // la montée elle-même. Consomme la demande dans TOUS les cas où elle
  // aboutit : une demande qui traîne ferait monter l'accueil au prochain
  // chargement, longtemps après que le visiteur est passé à autre chose.
  function lever() {
    t = 0
    if (!demande || prise) return
    demande = false
    montrer()
  }

  return {
    // l'accueil veut le centre. Si la carte de chargement y est, il ATTEND —
    // c'est toute la règle, et c'est ce qui rend le recouvrement impossible.
    demander() {
      if (demande) return
      demande = true
      if (prise) return
      lever() // la place est libre : tout de suite, sans délai inventé
    },
    // la carte de chargement vient d'apparaître (chargement à chaud, une shibu
    // reçue…). Une montée programmée n'a plus lieu d'être : la place est
    // reprise, et l'accueil repassera par `liberer` quand ce sera fini.
    occuper() {
      prise = true
      oublier()
    },
    // la carte vient de recevoir `.hidden` : le chargement est fini. On laisse
    // son fondu s'achever avant de faire monter l'accueil — sinon les deux
    // seraient de nouveau lisibles ensemble, ce que la règle 2 n'avait pas su
    // éviter.
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
