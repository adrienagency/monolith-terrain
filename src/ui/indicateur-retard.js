// L'INDICATEUR DISCRET — le dessin que le §9 du plan « globe continu » réclamait
// depuis le 2026-08-20, et que la Tâche 2 pose enfin.
//
// ══════════ CE QU'IL REMPLACE ═══════════════════════════════════════════════
//
// **Décision d'Adrien, 2026-08-20 :** « quand le réseau ne suit pas,
// l'utilisateur voit UN INDICATEUR DISCRET ». Pas de voile, pas de message
// bloquant, pas de silence total.
//
// Il prend la place de deux choses, et de deux seulement :
//   · les **2,6 s de carte `#loading`** que `loadRealTerrain` réarmait après une
//     panne réseau, **alors que son `finally` avait déjà relâché `demBusy`** —
//     l'application était libre et l'écran ne le disait pas ;
//   · le **silence** du socle qui se remplit à un niveau plus grossier que celui
//     que son emprise demande (règle R3, décision 13 : on affiche ce qu'on a et
//     on affine ensuite).
//
// ══════════ CE QU'IL N'EST PAS ══════════════════════════════════════════════
//
// ⚠️ **IL NE PARLE QU'EN NIVEAUX, JAMAIS EN POURCENTAGE**, et c'est la contrainte
// que `etatIndicateur` (`src/monde/descente-bornee.js`) écrit noir sur blanc :
// « un niveau vaut un facteur deux de résolution, pas un pour cent ». Un
// pourcentage inventerait une progression continue là où il n'y a que des
// doublements.
//
// ⚠️ **IL EST ÉTEINT QUAND LA MESURE MANQUE.** Un flux neuf, une couverture
// qu'on ne sait pas encore lire : l'indicateur reste noir. Afficher « ça rame »
// avant la première réponse, c'est fabriquer l'angoisse qu'on prétend calmer —
// même règle que le §2 de `descente-bornee.js`, appliquée au visible.
//
// ⚠️ **IL NE BLOQUE RIEN** : `pointer-events: none`, aucun focus, aucune
// modale. Il ne s'interpose jamais entre le doigt et la carte.
//
// ══════════ POURQUOI CE MODULE N'IMPORTE PAS `etatIndicateur` ═══════════════
//
// Parce qu'il n'a pas à savoir d'où vient l'état. `etatIndicateur` PRÉDIT un
// retard depuis le débit observé ; ce module AFFICHE un retard, d'où qu'il
// vienne. Les deux formes se rejoignent sur la même paire `{enRetard, niveaux}`,
// et c'est délibéré : le jour où la Tâche 1 branchera R3 sur la caméra, le
// retour d'`etatIndicateur` se passera ici tel quel, sans adaptateur.
//
// ⚠️ **ET IL NE L'IMPORTE PAS NON PLUS PARCE QU'UNE MESURE L'A DISQUALIFIÉ SUR
// LE CHEMIN DU SOCLE.** `main.js` porte le relevé du 2026-08-21 : sur un lien
// OISIF, `debitObserve` rendait **0,787 Mb/s** et `zoomSoutenable` en tirait
// **z5** pour une demande de z12 — l'indicateur aurait été allumé en permanence
// sur une connexion parfaite. Ce que le socle passe ici est donc une couverture
// **observée** (`zoomEffectif`), pas une prédiction.

/** Le texte de l'indicateur, **sans DOM** — c'est la partie testable en node. */
export function texteRetard({ enRetard = false, niveaux = null, texte = null } = {}) {
  if (!enRetard) return ''
  if (texte) return texte
  if (!Number.isFinite(niveaux) || niveaux <= 0) return 'détail en cours…'
  // « niveau », pas « % » — voir l'avertissement en tête.
  return `détail en cours… ${niveaux} niveau${niveaux > 1 ? 'x' : ''} de retard`
}

/**
 * Pose l'indicateur dans le document et rend son unique commande.
 *
 * @param {HTMLElement} [hote] — le parent (par défaut `document.body`)
 * @returns {{maj: (etat?: object) => void, eteint: () => void, element: HTMLElement}}
 */
export function initIndicateurRetard(hote = document?.body) {
  // Aucun test de ce dépôt n'a de DOM (pas de jsdom) : le module doit pouvoir
  // être importé pour `texteRetard` sans jamais toucher `document`.
  if (!hote || typeof document === 'undefined') {
    const rien = { maj() {}, eteint() {}, element: null }
    return rien
  }
  const el = document.createElement('div')
  el.className = 'ce-retard'
  // ⚠️ `status`, pas `alert` : un lecteur d'écran l'annonce SANS interrompre ce
  // que l'utilisateur est en train de faire. Un `alert` serait, pour lui,
  // exactement le pop-up qu'on retire pour les autres.
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  hote.append(el)

  let dernier = ''
  function maj(etat) {
    const t = texteRetard(etat ?? {})
    if (t === dernier) return // pas une écriture par image : le socle appelle souvent
    dernier = t
    if (!t) {
      el.classList.remove('on')
      return
    }
    el.textContent = t
    el.classList.add('on')
  }
  return { maj, eteint: () => maj({ enRetard: false }), element: el }
}
