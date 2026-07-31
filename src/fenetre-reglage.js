// QUI DÉCIDE QUE LE MODE CONTINU 3×3 EST ALLUMÉ — la règle, et rien d'autre.
//
// Module PUR : ni DOM, ni three.js, ni localStorage, ni `location`. Testable en
// node. Les trois entrées lui sont PASSÉES ; c'est main.js qui va les chercher.
//
// ══════════ TROIS ENTRÉES, UNE SORTIE, ET UN ORDRE ══════════════════════════
//
//   1. L'ADRESSE (`?f3=1` / `?f3=0`) — elle FORCE, et elle passe avant tout le
//      reste, y compris devant le refus machine. Ce n'est pas une négligence :
//      c'est ce qui rend les bancs possibles. On mesure un mode continu sur une
//      machine faible EXPRÈS, pour savoir de combien il n'y tient pas. Un
//      garde-fou qu'on ne peut pas désarmer empêche de mesurer sa propre
//      nécessité.
//
//   2. LE REFUS MACHINE — voir plus bas. Il l'emporte sur la préférence.
//
//   3. LA PRÉFÉRENCE (l'interrupteur des Paramètres, ou le défaut de FLAGS).
//
// ══════════ POURQUOI LE REFUS SE LIT SUR `damierMax`, ET PAS SUR LE PALIER ═══
//
// La tentation était d'écrire « palier ≥ 3 → refus ». C'est un seuil inventé :
// il faudrait le rejustifier à chaque fois qu'on touche à la table des paliers.
//
// La table dit DÉJÀ la réponse, et en toutes lettres. `damierMax` est le nombre
// de dalles VOISINES que la machine porte autour de la sienne :
//
//     palier 0 (PLEINE QUALITÉ) │ damierMax 24 │ un 5×5 moins le centre
//     palier 1 (ÉQUILIBRÉ)      │ damierMax 12 │
//     palier 2 (ALLÉGÉ)         │ damierMax  8 │ ← EXACTEMENT les 8 d'un 3×3
//     palier 3 (ESSENTIEL)      │ damierMax  4 │ ← une croix, pas un carré
//
// Le 8 du palier 2 — celui de l'iMac 2015 — n'est pas une coïncidence : c'est
// le nombre de voisines d'un 3×3. La table affirme déjà que cette machine porte
// neuf blocs, et que celle d'en dessous n'en porte que cinq. On lit donc la
// table au lieu d'écrire un second seuil à côté d'elle : le jour où quelqu'un
// remonte le palier 3 à 8, le mode continu suivra sans qu'on y touche.
//
// ⚠️ CE QUI N'A PAS ÉTÉ MESURÉ, ET QUE JE N'AFFIRME PAS. Le critère d'abandon
// de l'étude (§7, signal 1) demandait 20 im/s pendant un drag sur l'iMac 2015.
// Il n'a JAMAIS pu être vérifié : le bridage processeur ×6 de Chrome donne
// 1,7 im/s AU REPOS sur la machine de développement — il écrase le rendu, pas
// le code, donc ce n'est pas un modèle de l'iMac, c'est un modèle de rien. Ce
// seuil s'appuie sur la table des paliers, PAS sur une mesure du palier 2.
// Reste à vérifier sur la vraie machine : que le palier 2 tienne vraiment le
// 3×3 en drag. S'il ne le tient pas, c'est ce chiffre-ci qui monte à 12.

// Le nombre de voisines qu'un 3×3 demande. Trois fois trois, moins soi-même.
export const VOISINES_3X3 = 8

/**
 * La machine porte-t-elle le mode continu ?
 *
 * Rend TOUJOURS une raison, y compris quand c'est oui : l'interrupteur des
 * Paramètres l'affiche, et un refus muet est exactement ce qu'Adrien a écarté
 * (« un interrupteur qui s'allume sur une machine qui ne suit pas est pire
 * qu'un interrupteur absent »).
 *
 * @param {{palier?:number, nom?:string, damierMax?:number}|null} machine
 *        le verdict de `sonderMachine()`, ou null si la sonde n'a rien rendu
 * @returns {{porte:boolean, raison:string}}
 */
export function machinePorteContinu(machine) {
  // Pas de verdict = pas de refus. Une sonde en échec ne doit jamais retirer
  // une fonctionnalité : c'est la règle de tout `palier-machine.js`, où l'échec
  // retombe sur le palier 0. Refuser sur une absence d'information punirait
  // les machines dont on ne sait rien, qui sont souvent les plus récentes.
  const damier = machine?.damierMax
  if (!Number.isFinite(damier)) return { porte: true, raison: 'machine non sondée — on ne refuse pas sur une absence d’information' }
  if (damier >= VOISINES_3X3) return { porte: true, raison: `palier « ${machine?.nom ?? '?'} » : ${damier} dalles voisines, un 3×3 en demande ${VOISINES_3X3}` }
  return { porte: false, raison: `palier « ${machine?.nom ?? '?'} » : cette machine ne porte que ${damier} dalles voisines, un 3×3 en demande ${VOISINES_3X3}` }
}

/**
 * La valeur de `?f3` telle qu'elle force — ou null si elle ne dit rien.
 *
 * ⚠️ Tout ce qui n'est ni « 1 » ni « 0 » est traité comme une ABSENCE, pas
 * comme une erreur. `?f3=oui` d'un lien mal recopié ne doit pas allumer un mode
 * expérimental ni éteindre celui que l'utilisateur a choisi.
 *
 * @param {string|null|undefined} brut
 * @returns {boolean|null}
 */
export function forceUrl(brut) {
  if (brut === '1') return true
  if (brut === '0') return false
  return null
}

/**
 * L'état effectif du mode continu.
 *
 * @param {object} o
 * @param {boolean|null} o.force - ce que dit l'adresse (`forceUrl`), ou null
 * @param {boolean|null} o.prefere - l'interrupteur des Paramètres, ou null s'il
 *        n'a jamais été touché (on prend alors `defaut`)
 * @param {boolean} o.defaut - `FLAGS.fenetreContinue`
 * @param {{palier?:number, nom?:string, damierMax?:number}|null} o.machine
 * @returns {boolean}
 */
export function continuActif({ force = null, prefere = null, defaut = false, machine = null } = {}) {
  if (force !== null) return force // l'adresse force, refus machine compris
  const veut = prefere === null ? !!defaut : !!prefere
  return veut && machinePorteContinu(machine).porte
}

/**
 * Ce que l'interrupteur des Paramètres doit MONTRER.
 *
 * Trois états, pas deux — et c'est le point de la demande d'Adrien. Un
 * interrupteur binaire ne sait pas dire « je ne peux pas » ; il s'allume et la
 * machine rame. Ici le troisième état (`bloque`) éteint le contrôle ET porte le
 * texte qui explique pourquoi.
 *
 * @returns {{coche:boolean, bloque:boolean, note:string}}
 */
export function etatInterrupteur({ force = null, prefere = null, defaut = false, machine = null } = {}) {
  const m = machinePorteContinu(machine)
  if (force !== null) {
    // L'adresse a la main : l'interrupteur ne commande plus rien, et il doit le
    // dire plutôt que de faire semblant. Un contrôle qui ne fait rien quand on
    // le clique est lu comme un bogue.
    return { coche: force, bloque: true, note: `forcé par l’adresse (?f3=${force ? 1 : 0}) — l’interrupteur reprend la main sans ce paramètre` }
  }
  if (!m.porte) return { coche: false, bloque: true, note: m.raison }
  return { coche: prefere === null ? !!defaut : !!prefere, bloque: false, note: '' }
}
