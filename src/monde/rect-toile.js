// LA BOÎTE DE LA TOILE, LUE UNE FOIS — Tâche FLU, postes ① et ②.
//
// ⛔ **`getBoundingClientRect()` ET `clientHeight` FORCENT UNE MISE EN PAGE
// SYNCHRONE À CHAQUE LECTURE DÈS QUE LE DOM A BOUGÉ** — et le DOM bouge à
// chaque image (cartouches, HUD, indicateur de retard). Deux lecteurs payaient
// ce prix par image, et le profileur V8 attribue ce temps à la fonction JS qui
// lit la propriété, pas au moteur de rendu :
//
//   · `projectionSaisie` (`main.js`) lisait `renderer.domElement
//     .getBoundingClientRect()` à chaque échantillon de pointeur : **9,6 % du fil
//     principal pendant un glissé en orbite** (844 ms sur 8,8 s, CPU ×4,
//     `.banc/PA/budget-base-x4-vsync.json`) ;
//   · `contexteCrop` (`main.js`) lisait `renderer.domElement.clientHeight` à
//     chaque image pour `mer.hauteurPx` : **15 % du fil principal dans le crop**
//     (1 188 ms de temps PROPRE sur 10,2 s à ×4, `.banc/sonde-ctx2-x4.log`),
//     alors que la même fonction appelée 400 fois de suite dans une boucle —
//     DOM propre, aucune mise en page à refaire — coûte **0,024 ms par appel**.
//     Le brief prescrivait de mémoïser `contexteCrop` : ce n'était pas le
//     calcul qui coûtait, c'était cette seule lecture.
//
// La boîte d'une toile plein cadre ne change qu'au redimensionnement. On la lit
// donc UNE fois, on la garde, et on l'oublie quand quelque chose peut l'avoir
// déplacée : `ResizeObserver` sur l'élément, `resize` et `scroll` de la fenêtre —
// et, filet de sécurité contre un déplacement sans redimensionnement (un panneau
// qui pousse la toile), une relecture au plus une fois par `rafraichirMs`.
//
// ⚠️ **`hauteurClient` EST GARDÉE À PART DE `rect.height`, ET CE N'EST PAS UN
// DOUBLON** : `clientHeight` est l'entier CSS (bordures exclues), `rect.height`
// la hauteur de mise en page FRACTIONNAIRE. `facteurMppParUnite` divise par
// `hauteurPx` ; lui donner l'autre grandeur changerait le facteur au millième
// et donc le niveau de tuile demandé. On rend exactement ce qui était lu.

/**
 * @param {Element|null} el la toile
 * @param {object} [opt]
 * @param {Function} [opt.Observateur] `ResizeObserver` (injectable pour les tests)
 * @param {object} [opt.fenetre] `window` (injectable)
 * @param {number} [opt.rafraichirMs] relecture forcée au plus tous les N ms
 * @param {Function} [opt.maintenant] horloge, `performance.now` par défaut
 */
export function creerCacheToile(el, { Observateur = globalThis.ResizeObserver, fenetre = globalThis.window, rafraichirMs = 1000, maintenant = () => performance.now() } = {}) {
  let rect = null
  let hauteurClient = null
  let depuisRect = -Infinity
  let depuisHauteur = -Infinity
  let lectures = 0
  const invalider = () => { rect = null; hauteurClient = null }
  if (el && typeof Observateur === 'function') {
    try { new Observateur(invalider).observe(el) } catch { /* environnement sans observateur : le filet temporel suffit */ }
  }
  if (fenetre?.addEventListener) {
    fenetre.addEventListener('resize', invalider)
    fenetre.addEventListener('scroll', invalider, true)
  }
  return {
    /** La boîte (`DOMRect`), relue seulement si invalidée ou périmée. */
    rect() {
      if (!el) return null
      const t = maintenant()
      if (!rect || t - depuisRect > rafraichirMs) { rect = el.getBoundingClientRect(); depuisRect = t; lectures++ }
      return rect
    },
    /** `el.clientHeight`, sous le même cache. `undefined` sans élément (contrat de `contexteCrop`). */
    hauteurClient() {
      if (!el) return undefined
      const t = maintenant()
      if (hauteurClient == null || t - depuisHauteur > rafraichirMs) { hauteurClient = el.clientHeight; depuisHauteur = t; lectures++ }
      return hauteurClient || undefined
    },
    invalider,
    /** Le nombre de lectures FORCÉES depuis la création — c'est ce que les tests comptent. */
    get lectures() { return lectures },
  }
}
