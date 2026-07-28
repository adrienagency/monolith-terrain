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

// ---------------------------------------------------------------------------
// LE PLAFOND MATÉRIEL — pourquoi Chrome rabote EN SILENCE, et de travers
// ---------------------------------------------------------------------------
//
// Le canevas a DEUX tailles : celle qu'on lui donne en CSS (le cadre), et son
// tampon de dessin, qui vaut cette taille MULTIPLIÉE par la densité
// (`setPixelRatio`). C'est le tampon, pas le cadre, qui doit tenir sous
// `MAX_TEXTURE_SIZE` / `MAX_RENDERBUFFER_SIZE`.
//
// QUAND IL NE TIENT PAS, RIEN NE LE DIT. Pas d'exception, pas un mot en
// console : Chrome rabote le tampon tout seul, DIMENSION PAR DIMENSION, pas
// proportionnellement. Mesuré sur cette application :
//     16384×800  demandés  →  8192×800   (aspect 20,5 → 10,2)
//     24576×8192 demandés  →  5760×5760  (aspect 3    → 1)
// Or `camera.aspect` garde, lui, le rapport du CADRE. L'écart entre les deux
// est exactement ce qu'on voit à l'écran : une image écrasée, et — le cadre
// rognant le débordement — « zoomée à fond ». C'est le signalement du
// 28/07/2026 sur un vieux portable Windows.
//
// LE DÉCLENCHEUR ÉTAIT CHEZ NOUS : la densité valait 2 EN DUR, sans jamais lire
// `devicePixelRatio`. Sur un circuit graphique intégré ancien la limite tombe
// souvent à 2048 ou 4096 ; un écran un peu large ×2 la franchit, et le défaut
// n'apparaît QUE là — jamais sur la machine de développement. D'où ces deux
// fonctions pures, testées sans DOM ni WebGL, et l'avertissement plus bas :
// le silence est ce qui a rendu ce défaut invisible pendant des mois.

// Plafond de densité. Au-delà de 2 le gain visuel est nul et le coût quadratique
// (une densité 3 coûte 2,25 fois une densité 2 pour rien).
export const MAX_PIXEL_RATIO = 2

// La densité RÉELLE de l'écran, bornée. Corrige les deux sens : sur un écran à
// 250 % on rendait plus flou que demandé tout en payant plein pot, et sur un
// écran à 100 % on payait quatre fois trop de pixels.
export const screenPixelRatio = (dpr, cap = MAX_PIXEL_RATIO) =>
  Math.min(cap, typeof dpr === 'number' && dpr > 0 ? dpr : 1)

// La contrainte la plus basse que la carte impose. On interroge les DEUX
// paramètres : les cibles du compositeur sont des textures, mais le tampon de
// dessin lui-même est un renderbuffer, et rien ne garantit qu'ils montent aussi
// haut l'un que l'autre. 0 = on n'a rien pu lire — auquel cas on ne rabote
// RIEN : brider à l'aveugle serait pire que le mal.
export function glSizeLimit(gl) {
  if (!gl || typeof gl.getParameter !== 'function') return 0
  const vals = []
  for (const c of [gl.MAX_TEXTURE_SIZE, gl.MAX_RENDERBUFFER_SIZE]) {
    if (c === undefined) continue
    const v = Number(gl.getParameter(c))
    if (Number.isFinite(v) && v > 0) vals.push(v)
  }
  return vals.length ? Math.min(...vals) : 0
}

// LE CALCUL, ET C'EST LE CŒUR : taille CSS + densité voulue + limite matérielle
// → densité retenue et tampon obtenu.
//
// On ne rabote PAS les dimensions séparément (ce serait refaire à la main
// exactement la faute de Chrome) : on recule la DENSITÉ, qui multiplie les deux
// côtés par le même facteur. L'aspect est donc préservé par construction, au
// pixel d'arrondi près. Mieux vaut une image un peu moins fine qu'une image
// écrasée.
//
// À savoir : three calcule `canvas.width = Math.floor(cssW * densité)`, donc
// c'est bien un plancher qu'on reproduit ici, et le tampon obtenu ne dépasse
// jamais la limite.
export function fitDrawingBuffer(w, h, ratio, limit) {
  const r = typeof ratio === 'number' && ratio > 0 && ratio < Infinity ? ratio : 1
  const cote = Math.max(w, h)
  const brut = { ratio: r, width: Math.floor(w * r), height: Math.floor(h * r), clamped: false }
  const lim = Number.isFinite(limit) && limit > 0 ? limit : 0
  if (!lim || Math.max(brut.width, brut.height) <= lim) return brut
  // le facteur se calcule sur la taille CSS, pas sur le tampon déjà arrondi :
  // diviser par un plancher ferait ressortir le résultat un cheveu AU-DESSUS
  // de la limite, c'est-à-dire raboté par Chrome quand même.
  const retenu = densitePaire(w, h, Math.min(r, lim / cote))
  return {
    ratio: retenu,
    width: Math.max(1, Math.floor(w * retenu)),
    height: Math.max(1, Math.floor(h * retenu)),
    clamped: true,
    demande: [brut.width, brut.height],
  }
}

// ⚠️ LE TAMPON RABOTÉ DOIT ÊTRE PAIR, et ce n'est pas de la coquetterie.
// La taille CSS, elle, l'est déjà (frameSize arrondit à l'entier pair) parce
// que les passes construisent des cibles en demi-résolution. Mais ces cibles se
// dimensionnent sur le TAMPON, pas sur le CSS : le compositeur les taille
// d'après `renderer.getDrawingBufferSize()`. Une densité fractionnaire redonne
// donc un tampon impair, et l'AO en demi-résolution repart en 575,5 —
// exactement le carré noir déjà payé une fois (voir main.js, evenSize).
// Vérifié en direct le 28/07/2026 : cadre 1366×768 sur une carte simulée à
// 2048, la densité 1,4993 donnait un tampon 2048×1151 et des cibles AO en
// 1024×575,5. En reculant de deux pixels — 2046×1150 — les moitiés
// redeviennent entières et l'aspect ne perd que 0,03 %.
//
// On ne cherche cette parité que sur le chemin RABOTÉ, là où c'est nous qui
// choisissons la densité. Quand la carte suit, on sert la densité demandée
// telle quelle, au pixel près : une machine normale ne doit rien voir changer.
const densitePaire = (w, h, kmax) => {
  const grand = Math.max(w, h)
  if (!(grand > 0) || !(Math.min(w, h) > 0)) return kmax
  // On descend par pas de 2 sur le grand côté (celui qui touche la limite) :
  // chaque pas coûte au plus 2 px d'aspect, et la parité de l'autre côté
  // bascule en quelques tours. Sans issue au bout de 64, on garde la densité
  // proportionnelle : un tampon impair reste infiniment préférable à une image
  // écrasée, et c'est déjà ce que produit le gouverneur à 1,5 ou 0,85.
  //
  // ⚠️ On teste `Math.floor(w * k)`, PAS le G qui a servi à fabriquer k :
  // k = G / grand ne redonne pas toujours G en repassant par la
  // multiplication (2046 / 1366 × 1366 = 2045,999…, donc 2045). Il faut donc
  // vérifier exactement l'arithmétique que fitDrawingBuffer refera derrière.
  for (let G = Math.floor(grand * kmax) & ~1, i = 0; G >= 2 && i < 64; G -= 2, i++) {
    const k = G / grand
    if (Math.floor(w * k) % 2 === 0 && Math.floor(h * k) % 2 === 0) return k
  }
  return kmax
}

// L'avertissement, mémorisé : le rabotage se redéclenche à chaque resize et à
// chaque palier du gouverneur de performance, or une console noyée ne se lit
// pas plus qu'une console vide.
let _dernierRabotage = ''
function direLeRabotage(w, h, voulu, limite, fit) {
  const cle = `${w}x${h}@${voulu}/${fit.ratio}`
  if (cle === _dernierRabotage) return
  _dernierRabotage = cle
  const [dw, dh] = fit.demande
  console.warn(
    `[ShibuMap] tampon de dessin raboté : ${dw}×${dh} demandés `
    + `(cadre ${w}×${h} × densité ${voulu}) dépassent la limite matérielle de cette carte (${limite} px). `
    + `Densité ramenée à ${fit.ratio.toFixed(3)}, tampon ${fit.width}×${fit.height} — `
    + `aspect préservé (${(w / h).toFixed(3)}). `
    + `Sans ce garde-fou, Chrome rabote UNE SEULE dimension, sans rien dire, et l'image se déforme.`
  )
}

// Applique cette taille à tout le monde d'un coup. La caméra est FACULTATIVE :
// perf.js ne l'a pas sous la main, et le resize de main.js maintient déjà
// `camera.aspect` sur le même conteneur — mais quand elle est là, on la remet
// d'aplomb, parce qu'une seule fonction qui fait tout est plus sûre que deux
// qui se font confiance.
// Renvoie la taille appliquée, ou null si le conteneur n'est pas rendable :
// dans ce cas on ne touche à RIEN, surtout pas à l'aspect (relire l'en-tête de
// ce fichier — un aspect NaN ne se répare jamais tout seul).
//
// `pixelRatio` est la densité VOULUE (params.pixelRatio), pas celle qui sera
// servie : le plafond matériel se recalcule ici à chaque appel, jamais en
// amont. C'est délibéré — si on écrivait la densité rabotée dans params, elle
// ne remonterait jamais quand la fenêtre rétrécit (effet cliquet), et le
// gouverneur de performance croirait que l'utilisateur a bougé la tirette.
// D'où la règle : params porte le SOUHAIT, cette fonction porte le RÉEL.
//
// ⚠️ La chaîne de post-traitement suit toute seule, mais pas par magie :
// `composer.setSize` (postprocessing) redimensionne ses cibles et chaque passe
// d'après `renderer.getDrawingBufferSize()`, c'est-à-dire APRÈS la densité. Les
// cibles en demi-résolution (N8AO halfRes, chaîne de mipmaps du bloom, DoF)
// sont donc des fractions d'un tampon déjà borné : aucune ne peut franchir la
// limite de son côté. Ce qui impose l'ordre ci-dessous — la densité AVANT
// `renderer.setSize`, sans quoi le compositeur recopierait l'ancien tampon.
export function applyRenderSize({ renderer, composer, camera, pixelRatio } = {}) {
  const box = renderer?.domElement?.parentElement
  const win = typeof window === 'undefined' ? {} : window
  const [w, h] = frameSize(box?.clientWidth, box?.clientHeight, win.innerWidth, win.innerHeight)
  if (!isRenderableSize(w, h)) return null
  const voulu = typeof pixelRatio === 'number' && pixelRatio > 0
    ? pixelRatio
    : (renderer.getPixelRatio?.() ?? 1)
  // un contexte perdu ne doit pas empêcher un redimensionnement : sans limite
  // lisible on sert la densité voulue, exactement comme avant ce garde-fou
  let limite = 0
  try { limite = glSizeLimit(renderer.getContext?.()) } catch { limite = 0 }
  const fit = fitDrawingBuffer(w, h, voulu, limite)
  if (fit.clamped) direLeRabotage(w, h, voulu, limite, fit)
  renderer.setPixelRatio?.(fit.ratio)
  if (camera) {
    // LA CAMÉRA SUIT LE CADRE, jamais le tampon : c'est le cadre qu'on regarde.
    // Le tampon raboté garde le même rapport (au pixel d'arrondi près), donc
    // l'image reste juste — c'est toute la différence avec le rabotage de
    // Chrome, qui écrase une seule dimension et laisse l'aspect mentir.
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  renderer.setSize(w, h)
  composer?.setSize(w, h)
  return [w, h]
}
