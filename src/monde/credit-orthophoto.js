// LE CRÉDIT D'ORTHOPHOTO — Tâche R9, tour de correction, constat critique n°1.
//
// Module PUR : ni DOM, ni three.js, et il n'importe RIEN. Tout se vérifie sous
// node (`test/credit-orthophoto.test.js`).
//
// ══════════ POURQUOI CE FICHIER EXISTE ══════════════════════════════════════
//
// ⛔ **UNE MENTION DE LICENCE DOIT DÉCRIRE L'ÉCRAN, ET R9 A INVERSÉ CELLE-CI.**
// La Tâche R1 ② avait posé, dans `refreshOsmCredit` :
//
//     if (aerialAttribution && !terreUniqueBranchee) parts.push(aerialAttribution)
//
// sur un argument EXPLICITE, écrit dans le commentaire d'à côté : « sous
// `terre unique`, l'orthophoto n'est JAMAIS à l'écran ». C'était vrai le jour où
// la ligne a été écrite — le clic sur le bouton aérien posait la photo sur le
// bloc PLAT, que ce drapeau ne dessine jamais.
//
// **R9 rend cette prémisse fausse** : c'est exactement ce que la tâche change.
// Depuis, sous `?terre=unique&frontiere=1` avec la photo allumée, l'imagerie IGN
// est peinte sur la sphère **et son attribution est absente**. Le rapport de R9
// §5.2 écrivait « il le rend même sans objet, puisqu'il y a désormais une vraie
// photo derrière le crédit » : c'est l'inverse. Une garde bâtie sur « il n'y a
// pas de photo » devient un défaut le jour où il y en a une.
//
// ⚠️ **LE CRÉDIT SUIT DONC LA PHOTO, PLUS LE DRAPEAU.** C'est la seule règle que
// `refreshOsmCredit` pose déjà deux fois dans ses propres commentaires — « IGN's
// Licence Ouverte requires visible attribution while its imagery is on screen —
// **and only while it is** », et la même phrase pour `solAttribution`.
//
// ══════════ CE QUE CE MODULE NE CORRIGE PAS, ET C'EST DÉLIBÉRÉ ══════════════
//
// ⛔ **LE DÉFAUT DE PRODUCTION EST LAISSÉ INTACT, À L'ARBITRAGE D'ADRIEN.**
// Mesuré le 2026-08-23 (`.banc/R1-tour2/credit-prod.json`, rejoué par la
// relecture de R9) : **sans aucun drapeau**, en vue orbitale, `terrain.mesh` est
// invisible — l'orthophoto n'est donc pas à l'écran — et le crédit s'affiche
// quand même. `?terre=unique` ne CRÉE pas ce défaut, il le rendait PERMANENT.
// Le corriger ici changerait le comportement sans drapeau, c'est-à-dire la seule
// garantie que ce chantier a tenue de bout en bout. **Il est signalé, pas
// corrigé en passant** — voir le rapport R9.
//
// ⚠️ **ET C'EST POUR ÇA QUE LA LOI VIT ICI PLUTÔT QUE DANS `main.js`** : **aucun
// test de ce dépôt ne charge `main.js`**. La garde précédente était tenue par
// une assertion d'expression régulière sur le texte source
// (`test/visibilite-surface.test.js` ③) — laquelle, en exigeant le TEXTE de la
// garde, **rougissait sur sa propre correction**. Ce chantier a déjà vu une
// mutation survivre à 4 082 tests derrière exactement cette protection-là ; ici,
// la protection empêchait la réparation. Une loi exportée s'exécute.

/**
 * L'orthophoto est-elle PEINTE sur la découpe, à cet instant ?
 *
 * ⚠️ **C'EST LA TRANSCRIPTION DE LA GARDE DU NUANCEUR, PAS UNE SECONDE RÈGLE.**
 * `src/globe.js` n'entre dans son bloc aérien que sous
 * `uAerialOn > 0.5 && uAerialOpacity > 0.001 && dedansCrop > 0.0`, et
 * `dedansCrop` ne reçoit une valeur non nulle que dans la branche
 * `if (uCropOn > 0.5)`. `test/credit-orthophoto.test.js` ② EXTRAIT cette
 * condition du nuanceur et l'EXÉCUTE contre cette fonction : si l'une des deux
 * change d'avis, le test rougit. C'est la question posée en toutes lettres —
 * **le crédit décrit-il ce qui est peint ?**
 *
 * @param {object|null} uniformes `globe.uniforms` — l'objet vivant, pas une
 *   copie. ⚠️ **Il est lu À L'INSTANT DU CRÉDIT** : le globe est réassigné à la
 *   perte de contexte WebGL, une poignée figée jugerait sur un globe mort.
 * @returns {boolean}
 */
export function orthophotoPeinteSurLeCrop(uniformes) {
  if (!uniformes) return false
  const lire = (nom) => {
    const u = uniformes[nom]
    const v = u && typeof u === 'object' && 'value' in u ? u.value : u
    return Number.isFinite(v) ? v : 0
  }
  return lire('uCropOn') > 0.5 && lire('uAerialOn') > 0.5 && lire('uAerialOpacity') > 0.001
}

/**
 * La ligne de crédit d'orthophoto à afficher — ou `null`.
 *
 * ⚠️ **UN SEUL POINT DE DÉCISION.** `refreshOsmCredit` pousse `aerialAttribution`
 * depuis UN site et un seul : deux écritures d'une obligation de licence, c'est
 * la faute que `SOL_LICENCE` a déjà coûtée à ce fichier.
 *
 * @param {object} arg
 * @param {boolean} arg.terreUnique le drapeau `?terre=unique` est-il branché.
 *   ⚠️ **Il ne sert plus à ÉTEINDRE le crédit** : il sert à dire QUELLE Terre
 *   porte la photo, et donc où aller lire si elle est peinte.
 * @param {string|null} arg.attribution `aerialAttribution` — non nul seulement
 *   si une mosaïque a VRAIMENT été composée et posée sur le socle. C'est le
 *   premier verrou, et il n'est pas touché.
 * @param {boolean} arg.peinte la découpe peint-elle la photo à cet instant —
 *   ce que rend `orthophotoPeinteSurLeCrop`.
 * @returns {string|null} la ligne, ou `null` s'il n'y a rien à créditer.
 */
export function creditOrthophoto({ terreUnique, attribution, peinte }) {
  if (!attribution) return null
  // ⛔ **SANS DRAPEAU : INTACT.** Voir l'en-tête — le défaut de production est
  // laissé à l'arbitrage d'Adrien, et le corriger ici serait le corriger « en
  // passant », c'est-à-dire sans qu'il l'ait vu.
  if (!terreUnique) return attribution
  // ⚠️ **SOUS LE DRAPEAU : LE CRÉDIT SUIT LA PHOTO.** Avant R9 il n'y en avait
  // jamais, donc `false` toujours, donc la garde d'origine ; depuis R9 il y en a
  // une, et la mention doit la suivre — dans les deux sens.
  return peinte ? attribution : null
}
