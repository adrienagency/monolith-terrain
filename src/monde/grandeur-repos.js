// LA GRANDEUR DU REPOS — Tâche R1, tour 2 (constat C2 de la relecture).
//
// Module PUR : ni DOM, ni three.js, et il n'importe RIEN. Tout se vérifie sous
// node (`test/grandeur-repos.test.js`).
//
// ══════════ POURQUOI CE FICHIER EXISTE, ET IL EXISTE POUR UNE MUTATION ══════
//
// La Tâche R1 a débranché la veille du repos de l'altitude pour la brancher sur
// la distance caméra↔cible — le §1 de `veille-repos.js` porte la mesure. Mais
// le calcul lui-même vivait dans `main.js`, dans un `distanceCadrageM()` que
// **rien n'exécutait jamais** : aucun test de ce dépôt ne charge `main.js`, et
// le seul garde-fou était une expression régulière sur le texte source.
//
// ⛔ **LA MUTATION M9 L'A MONTRÉ, ET ELLE EST SPECTACULAIRE** :
//
//     function distanceCadrageM() {
//       return altitudeCadrageM()      // ← le corps remplacé par ceci
//     }
//
// **annule le correctif ① EN ENTIER et passe les 4 131 tests, zéro échec.** La
// veille redevient nourrie de l'altitude, l'orbite réveille de nouveau le repos,
// la planète se rallume au moindre glissement — et la suite reste verte.
//
// ⚠️ **C'EST LA CLASSE DE DÉFAUT LA PLUS CHÈRE DE CE CHANTIER** : une mutation y
// a déjà survécu à **4 082 tests** pour exactement cette raison, et
// `visibilite-surface.js` a été extrait le même jour pour la même raison. La
// grandeur du repos méritait le même traitement ; elle ne l'avait pas eu.
//
// ➡️ **Le calcul vit donc ici, et `main.js` ne fait plus que le câbler.** Muter
// le corps, c'est désormais muter ce fichier — et ce fichier est exercé par un
// banc qui pose de vraies orbites et de vrais zooms.
//
// ══════════ CE QUE CETTE GRANDEUR RÉPOND, ET CE QU'ELLE NE RÉPOND PAS ═══════
//
// Elle répond à **« l'utilisateur change-t-il d'ÉCHELLE »**, et à rien d'autre.
// Ce n'est PAS une altitude : l'estompage et le seuil du socle demandent « à
// quelle distance du sol suis-je », ce qui est une autre question et donc une
// autre grandeur (voir le §1 de `veille-repos.js`, qui corrige explicitement le
// principe inverse).
//
// ⚠️ **SON UNITÉ EST INDIFFÉRENTE**, et c'est la preuve qu'elle n'est pas une
// altitude : la veille du repos ne compare que des `|Δ ln|`, c'est-à-dire des
// rapports. Unités du monde ou mètres au sol rendent le même verdict à la même
// image. On ne la convertit donc PAS — la convertir la rebrancherait sur
// `largeurBlocM()`, c'est-à-dire sur l'emprise du bloc CHARGÉ, exactement ce
// dont on vient de la débrancher.
//
// ⚠️ **ET C'EST LA CIBLE D'`OrbitControls`, PAS UN POINT AU SOL RECALCULÉ** :
// c'est autour d'elle que tourne le cliquer-glisser, donc c'est d'elle que la
// rotation garde la distance rigoureusement constante — `4,4 × 10⁻¹⁶` mesurés
// sur quinze images de geste réel. Un autre point de référence rendrait la
// grandeur sensible à l'orientation, et le défaut d'origine reviendrait par la
// fenêtre.

/**
 * La grandeur que surveille la veille du repos : la distance de la caméra à sa
 * cible.
 *
 * ⚠️ **UN POINT MANQUANT OU NON FINI REND `null`, PAS `0` NI `NaN`.** La veille
 * conserve son état sur toute entrée qui n'est pas un nombre fini positif
 * (`veille-repos.js`), donc `null` la laisse où elle est : le crop reste seul,
 * ce qui est la panne la moins mauvaise. Rendre `0` ferait un logarithme
 * `−Infinity`, donc un écart infini, donc un mouvement permanent — l'exact
 * contraire de ce que la panne doit produire.
 *
 * @param {object} arg
 * @param {{x:number,y:number,z:number}} arg.camera la position de la caméra
 * @param {{x:number,y:number,z:number}} arg.cible `controls.target`
 * @returns {number|null}
 */
export function grandeurRepos({ camera, cible } = {}) {
  if (!camera || !cible) return null
  const dx = camera.x - cible.x
  const dy = camera.y - cible.y
  const dz = camera.z - cible.z
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return Number.isFinite(d) ? d : null
}
