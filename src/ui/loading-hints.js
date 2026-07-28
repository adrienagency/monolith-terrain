// La petite phrase qui s'écrit sous la planète pendant qu'un bloc se charge.
//
// Ce fichier ne CHOISIT rien : il observe, il affiche, il oublie. Toute la
// décision (catégorie, non-répétition, repli quand le lieu est inconnu) vit
// dans hints.js, qui est pur et testé ; le stock de phrases vit dans
// hints-data.js. Pour ajouter une phrase, c'est là-bas.
//
// POURQUOI UN MutationObserver plutôt que des appels depuis main.js : le
// loader est montré et caché depuis une demi-douzaine d'endroits (premier
// boot, recherche, plongée, échec de tuiles, lien de course…). Écouter la
// classe `.hidden` attrape tous les cas d'un coup, y compris ceux que
// personne n'a encore écrits — et main.js n'a qu'UN point d'accroche.

import { creerTireur } from '../hints.js'

// Toutes les combien de secondes la phrase se renouvelle si le chargement
// s'éternise. Un chargement normal dure 2 à 4 s et n'en voit donc qu'une
// seule ; c'est l'attente longue (réseau lent, dalle lointaine) qui mérite
// une deuxième lecture plutôt qu'une ligne figée.
const RELAIS_MS = 6000

export function initLoadingHints(loadingEl, contexte = () => ({})) {
  if (!loadingEl) return { refresh() {} }

  // La ligne est déjà dans index.html pour que sa hauteur soit réservée dès le
  // premier octet : la remplir ne doit pas faire sauter la carte. On la crée
  // quand même en secours, sinon un index.html décalé ferait disparaître la
  // fonctionnalité sans un mot.
  let ligne = loadingEl.querySelector('.ld-hint')
  if (!ligne) {
    ligne = document.createElement('div')
    ligne.className = 'ld-hint'
    loadingEl.append(ligne)
  }

  const tireur = creerTireur()
  let relais = 0

  function ecrire() {
    let ctx = {}
    try {
      ctx = contexte() || {}
    } catch {
      // une phrase de chargement ne peut pas être la raison d'un écran noir
    }
    const phrase = tireur.suivante(ctx)
    if (!phrase) return
    ligne.textContent = phrase.text
    // Fondu court : le texte change sous les yeux du visiteur, un remplacement
    // sec se lit comme un défaut d'affichage.
    //
    // ⚠️ SEULEMENT si l'onglet compose vraiment ses images. Dans un onglet en
    // arrière-plan le navigateur gèle les transitions : celle-ci resterait
    // bloquée à son opacité de départ, et la phrase serait encore INVISIBLE au
    // retour du visiteur. Constaté en vrai — le texte était bien là, la
    // transition « running » et l'opacité à 0 pour toujours. Hors composition,
    // on pose donc l'état final sans fondu.
    const anime = document.visibilityState === 'visible'
    ligne.style.transition = anime ? '' : 'none'
    if (anime) {
      ligne.classList.remove('on')
      void ligne.offsetWidth // recalcul forcé : la transition repart de zéro
    }
    ligne.classList.add('on')
  }

  function demarrer() {
    ecrire()
    clearInterval(relais)
    relais = setInterval(ecrire, RELAIS_MS)
  }

  function arreter() {
    clearInterval(relais)
    relais = 0
  }

  // état courant, pour ne réagir qu'aux VRAIS changements : main.js appelle
  // `classList.remove('hidden')` sur un loader déjà visible, et ça ne doit pas
  // remplacer la phrase qu'on est en train de lire.
  let visible = !loadingEl.classList.contains('hidden')

  new MutationObserver(() => {
    const v = !loadingEl.classList.contains('hidden')
    if (v === visible) return
    visible = v
    if (v) demarrer()
    else arreter()
  }).observe(loadingEl, { attributes: true, attributeFilter: ['class'] })

  // Au tout premier boot le loader est visible AVANT que ce module n'existe :
  // aucune mutation ne viendra: il faut écrire tout de suite.
  if (visible) demarrer()

  return { refresh: ecrire }
}
