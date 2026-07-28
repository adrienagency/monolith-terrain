// Garde-fous de taille de rendu — pourquoi un canevas de 0 px est un piège.
//
// Un conteneur peut valoir 0×0 le temps d'un souffle : onglet en arrière-plan,
// panneau replié, iframe pas encore posée. L'événement `resize` part quand même,
// et `camera.aspect = 0 / 0` vaut NaN. `updateProjectionMatrix()` recopie alors
// ce NaN dans l'élément [0] de la matrice de projection — sans une exception,
// sans un mot en console.
//
// LE SYMPTÔME EST MUET. Seul l'élément [0] dépend de l'aspect, donc
// `Vector3.project()` continue de rendre des y et z parfaitement justes et
// n'annonce rien ; c'est x qui devient NaN. Tout ce qui est ancré en espace
// écran — repères de sommet, cartouches de course — reçoit un
// `transform: translate(NaNpx, …)` que le navigateur ignore purement et
// simplement : l'élément retombe à l'origine. Aucune erreur, juste des étiquettes
// collées dans le coin.
//
// ET IL EST DÉFINITIF. Constaté le 27/07/2026 dans une preview en panneau
// masqué : quand le canevas retrouve 1280×720, l'aspect vaut TOUJOURS NaN. Rien
// ne le recalcule au fil du rendu ; il faut un nouvel événement de
// redimensionnement valide pour l'écraser. Autrement dit une fenêtre de 0 px
// large d'une frame peut casser les projections pour le reste de la session.
//
// D'où la règle des deux fonctions ci-dessous : quand on PEUT s'abstenir, mieux
// vaut garder le dernier aspect connu (isRenderableSize) ; quand on ne peut pas
// — un export doit produire une image —, on borne à 1 px (safeAspect). Dans les
// deux cas l'aspect reste un nombre fini.

// Vrai seulement si les deux côtés sont des nombres finis strictement positifs.
export const isRenderableSize = (w, h) => Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0

// Aspect toujours fini : les côtés nuls, négatifs ou non numériques sont bornés
// à 1 px. Une image un peu mal cadrée reste récupérable, un NaN non.
export const safeAspect = (w, h) => Math.max(1, w || 0) / Math.max(1, h || 0)

// ---------------------------------------------------------------------------
// LA TAILLE DE RENDU — pourquoi la fenêtre n'est PAS le cadre
// ---------------------------------------------------------------------------
//
// Le canevas ne remplit la fenêtre que dans le mode plein écran. En boutique,
// en Race Studio et en Studio, `#app` devient un cadre réduit (store.css,
// studio.css, atelier.css : la colonne de travail prend 42vw), avec
// `overflow: hidden` et un canevas centré en `translate(-50%, -50%)`.
// La seule vérité est donc la box du CONTENEUR ; `window.innerWidth` ment dès
// qu'un de ces modes est ouvert.
//
// Signalé le 28/07/2026 sur un vieux portable Windows : « le visuel bug sur la
// taille d'écran, se déforme, zoom à fond ». Ce n'était pas la lenteur — c'était
// sa conséquence. Le gouverneur de performance (perf.js) ne bouge que sous les
// 30 fps, donc uniquement sur une machine faible ; à chaque palier il appelait
// `composer.setSize(window.innerWidth, window.innerHeight)`. Or `setSize` du
// compositeur rappelle `renderer.setSize(w, h)` avec updateStyle par défaut à
// TRUE : il réécrit la taille CSS du canevas. Mesuré dans un cadre Studio d'une
// fenêtre 1366×768 : le canevas passait de 762×768 à 1366×768 pendant que
// `camera.aspect` restait à 0,9922 — 79 % d'écart, image écrasée, et comme le
// cadre rogne le débordement on n'en voyait plus que le milieu.
//
// D'où cette fonction unique : un SEUL couple de nombres part vers le canevas,
// les cibles du compositeur et l'aspect de la caméra. Trois sources de vérité,
// c'était deux de trop.

// Entier PAIR inférieur, et rien d'autre qu'un entier positif fini n'en sort.
// Pair parce que les passes de post-traitement construisent des cibles en
// demi/quart de résolution : une dimension impaire les rend fractionnaires,
// et c'est exactement le bug du carré noir (voir main.js, evenSize).
// Conséquence à connaître : 1 px donne 0, donc c'est bien cette valeur
// arrondie qu'il faut passer à isRenderableSize, pas la box brute.
const pair = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) & ~1 : 0)

// La taille de rendu : la box du conteneur, la fenêtre seulement en filet de
// sécurité pour l'instant où cette box n'existe pas encore (0 avant la première
// mise en page).
export const frameSize = (cw, ch, ww, wh) => [
  pair(cw > 0 ? cw : ww),
  pair(ch > 0 ? ch : wh),
]

// Applique cette taille à tout le monde d'un coup. La caméra est FACULTATIVE :
// perf.js ne l'a pas sous la main, et le resize de main.js maintient déjà
// `camera.aspect` sur le même conteneur — mais quand elle est là, on la remet
// d'aplomb, parce qu'une seule fonction qui fait tout est plus sûre que deux
// qui se font confiance.
// Renvoie la taille appliquée, ou null si le conteneur n'est pas rendable :
// dans ce cas on ne touche à RIEN, surtout pas à l'aspect (relire l'en-tête de
// ce fichier — un aspect NaN ne se répare jamais tout seul).
export function applyRenderSize({ renderer, composer, camera } = {}) {
  const box = renderer?.domElement?.parentElement
  const win = typeof window === 'undefined' ? {} : window
  const [w, h] = frameSize(box?.clientWidth, box?.clientHeight, win.innerWidth, win.innerHeight)
  if (!isRenderableSize(w, h)) return null
  if (camera) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  renderer.setSize(w, h)
  composer?.setSize(w, h)
  return [w, h]
}
