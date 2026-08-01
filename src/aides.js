// QUELLE BULLE D'AIDE SE MONTRE, QUAND, ET COMBIEN DE FOIS — la règle, et rien
// d'autre.
//
// Module PUR : ni DOM, ni three.js, ni `localStorage`, ni `location`. Tout ce
// qui décide se teste en node (test/aides.test.js). L'affichage vit dans
// ui/aides.js, le stock des textes dans aides-data.js — pour ajouter une aide,
// c'est là-bas et nulle part ici.
//
// ══════════ UNE SEULE CONDITION, ET C'EST VOULU ═════════════════════════════
//
//     l'option est ACTIVE  ET  personne n'a encore cliqué « J'ai compris »
//
// On aurait pu regarder la TRANSITION (éteint → allumé) plutôt que l'état.
// C'est la lecture littérale de « à la première activation », et elle est
// fausse d'un cas : le visiteur qui arrive par un lien `?f3=1` n'a jamais
// basculé l'interrupteur. Il n'y a eu aucune transition à observer, et c'est
// pourtant lui qui a le plus besoin de la phrase — il a un mode inhabituel sous
// les doigts sans avoir rien demandé. Regarder l'état couvre les deux cas avec
// une condition de moins.
//
// ══════════ POURQUOI LE STOCKAGE EST UNE CLÉ PAR AIDE ═══════════════════════
//
// Un seul objet JSON sous une clé unique aurait été plus compact. Une clé par
// aide a trois propriétés qu'on ne veut pas perdre :
//
//   1. La remise à zéro est un balayage de préfixe, pas une réécriture. Rien à
//      parser, donc rien à casser sur un JSON corrompu par une vieille version.
//   2. Une aide supprimée du catalogue laisse une clé orpheline inoffensive,
//      que la remise à zéro nettoie au passage.
//   3. Le stockage reste lisible à l'œil dans les outils du navigateur :
//      `shibumap.aide.fenetre-3x3` se comprend sans documentation.

import { AIDES } from './aides-data.js'

// Le préfixe est la seule chose que la remise à zéro connaît. Le changer
// oublie toutes les aides déjà acquittées de tous les visiteurs : c'est
// réversible mais impoli, et un test le fige.
export const PREFIXE_CLE = 'shibumap.aide.'

/** La clé de stockage d'une aide. */
export function cleAide(id) {
  return PREFIXE_CLE + id
}

/**
 * Les ids déjà acquittés, lus depuis la liste des clés du stockage.
 *
 * ⚠️ On lit les CLÉS, jamais les valeurs. Une aide est acquittée ou elle ne
 * l'est pas : stocker « true » puis avoir à distinguer 'true' de '1' de 'oui'
 * serait une occasion de bogue offerte pour rien.
 *
 * @param {string[]|null} cles
 * @returns {Set<string>}
 */
export function vuesDepuisCles(cles) {
  const vues = new Set()
  for (const k of cles ?? []) {
    if (typeof k === 'string' && k.startsWith(PREFIXE_CLE) && k.length > PREFIXE_CLE.length) {
      vues.add(k.slice(PREFIXE_CLE.length))
    }
  }
  return vues
}

/**
 * Cette aide doit-elle se montrer maintenant ?
 *
 * @param {object} o
 * @param {string} o.id - l'aide concernée
 * @param {boolean} o.actif - l'option qu'elle explique vient-elle d'être allumée
 * @param {Set<string>|string[]|null} o.vues - ce qui a déjà été acquitté
 * @param {Array} [o.catalogue] - remplaçable pour les tests
 * @returns {boolean}
 */
export function doitMontrer({ id, actif = false, vues = null, catalogue = AIDES } = {}) {
  if (!actif) return false
  // Un id absent du catalogue est une COQUILLE, pas une aide sans texte : sans
  // ce garde, l'appelant afficherait une bulle vide au milieu du terrain et
  // rien dans la console ne le dirait.
  if (!id || !catalogue.some((a) => a.id === id)) return false
  const deja = vues instanceof Set ? vues : new Set(vues ?? [])
  return !deja.has(id)
}

/**
 * L'ensemble des aides acquittées, une de plus. Ne mute pas l'entrée : l'état
 * vivant de ui/aides.js est remplacé, jamais modifié en place — sinon un
 * appelant qui garde une référence verrait sa copie changer sous lui.
 */
export function acquitte(vues, id) {
  const suivant = new Set(vues instanceof Set ? vues : (vues ?? []))
  suivant.add(id)
  return suivant
}

/**
 * Parmi les clés du stockage, celles que la remise à zéro doit effacer.
 *
 * ⚠️ LE FILTRE EST LE POINT DÉLICAT DE TOUT CE MODULE. Le même `localStorage`
 * porte les gabarits de l'utilisateur, ses palettes, sa préférence de mode
 * continu (`shibumap.fenetre-continue`) et l'état du tour guidé
 * (`shibumap-tour-done`). Un préfixe trop court — `shibumap.` — effacerait un
 * travail en promettant de « réafficher des bulles ». Le test vérifie ce qui
 * SURVIT, pas seulement ce qui part.
 */
export function clesAOublier(cles) {
  return (cles ?? []).filter((k) => typeof k === 'string' && k.startsWith(PREFIXE_CLE) && k.length > PREFIXE_CLE.length)
}

/** Combien d'aides sont actuellement masquées — le chiffre qu'annonce le bouton. */
export function nbMasquees(cles) {
  return clesAOublier(cles).length
}
