// LES MARQUEURS D'ÉTAPE — « bêta » posé sur une option qui n'est pas finie.
//
// ══════════ UN MARQUEUR QUI N'EXPLIQUE RIEN APPREND À ÊTRE IGNORÉ ═══════════
//
// C'est la seule règle de ce fichier, et elle est appliquée par la signature :
// `raison` n'a pas de valeur par défaut, et une raison vide lève. On ne PEUT
// pas poser une pastille décorative. Trois badges sans motif dans une interface
// et le quatrième — celui qui comptait — ne sera plus lu.
//
// La raison s'affiche au survol via `data-tip`, le mécanisme d'info-bulle qui
// existe déjà (ui/tips.js) : aucun second système à maintenir, et le
// comportement est celui que le reste du site a déjà appris à l'utilisateur.
//
// ══════════ LA LANGUE VISUELLE EST CELLE DE LA PUCE ALPHA ═══════════════════
//
// La barre du haut porte déjà « ALPHA » (bars.js:110, .ce-alpha dans v28.css) :
// pilule creuse, filet d'accent, mono, grandes lettres espacées. On la reprend
// au lieu d'inventer un second vocabulaire de badges — deux familles de
// pastilles dans la même interface se liraient comme deux systèmes de sens.
// Seule différence : celle-ci est plus petite et ne se clique pas, parce
// qu'elle qualifie une LIGNE de réglage, pas l'application entière.
//
// ⚠️ CE QU'ON NE MARQUE PAS. Une option simplement COÛTEUSE mais finie (le
// SSAO, la profondeur de champ, la densité des nuages) ne reçoit pas « bêta » :
// ce mot annonce un état de développement, pas une facture. L'employer pour
// dire « c'est lourd » userait le seul mot dont on dispose pour dire « ça peut
// changer ou casser ». Pour le coût, le site a déjà `.ce-warn` (l'avertissement
// du maillage 2048), qui est le bon outil.

import { el } from './kit.js'

/**
 * Pose une pastille d'étape sur une ligne de réglage.
 *
 * @param {HTMLElement} ligne - la ligne rendue par `toggle()` / `select()`
 * @param {object} o
 * @param {string} o.etape - « bêta », « alpha »… affiché en capitales
 * @param {string} o.raison - POURQUOI, en une phrase, chiffrée si possible.
 *        Visible au survol. Obligatoire — voir l'en-tête.
 */
export function marqueEtape(ligne, { etape, raison }) {
  if (!raison?.trim()) throw new Error(`marqueEtape(${etape}) : une pastille sans raison est interdite`)
  const cible = ligne.querySelector('.ce-label') ?? ligne
  const pastille = el('span', 'ce-etape', etape)
  // `title` DOUBLE `data-tip` exprès : data-tip sert la bulle maison (survol
  // souris), title sert le survol système et surtout les outils
  // d'accessibilité. Aucune des deux n'atteint le clavier seul, d'où l'aria.
  pastille.setAttribute('data-tip', raison)
  pastille.title = raison
  pastille.setAttribute('aria-label', `${etape} — ${raison}`)
  cible.append(' ', pastille)
  return ligne
}
