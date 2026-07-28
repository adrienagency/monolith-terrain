// SONDE DE CADRAGE — à coller dans la console du navigateur, sur la machine
// qui montre le défaut. Elle ne modifie rien : elle lit, et elle renvoie un
// objet. `copy(__sondeCadrage())` met le résultat dans le presse-papier.
//
// POURQUOI ELLE EXISTE. Le 28/07/2026, sur un vieux portable Windows sous
// Chrome : « toute l'UI et le visu s'affichaient au moins à 400 % avec zoom au
// centre », alors que le zoom du navigateur indiquait 100 %. Ce symptôme a
// DEUX causes possibles, indiscernables à l'œil, et une seule ligne de console
// les sépare :
//
//   A. LA MISE À L'ÉCHELLE WINDOWS. À 250 % sur un 1366×768, le viewport CSS
//      ne fait plus que 546×307 : l'interface, dessinée en pixels fixes pour
//      ~1366, occupe alors tout l'écran — elle paraît 2,5× trop grosse. À
//      300 %, 455×256, soit 3×. Windows autorise jusqu'à 500 % en
//      personnalisé. SIGNATURE : `dpr` ≥ 2 ET `ecranCss` petit, `pincement` à
//      1. C'est une CLASSE DE MACHINES, pas un accident : rien dans le code ne
//      pose de plancher de largeur, et la carte de refus « ces cartes ont
//      besoin de place » exige un pointeur grossier (boot.js), donc elle ne
//      part jamais sur un portable à souris.
//
//   B. LE PINCEMENT DE CHROME (visual viewport). Un pincement à deux doigts
//      sur un écran tactile agrandit la page SANS toucher au zoom de page :
//      le menu de Chrome continue d'afficher 100 %, et l'agrandissement part
//      du point pincé — « zoom au centre ». SIGNATURE : `pincement` > 1.
//      Reproduit ici à 4× : interface et carte grossies d'un bloc, carte
//      floue (le canevas, lui, n'a pas changé de taille), zoom de page à 1.
//
// Le reste des champs sert à écarter les autres pistes : `zoomCssRacine` et
// `transformRacine` (une propriété `zoom` ou un `scale` hérité), `policeRacine`
// (une racine mal posée), `metaViewport` (prise au sérieux ?), `tactile`, et
// l'état réel du rendu 3D (canevas, aspect caméra, échelle de rendu).
//
// À LIRE EN PREMIER dans le retour : `verdict`.

window.__sondeCadrage = function () {
  const el = document.querySelector('#app canvas')
  const app = document.getElementById('app')
  const barre = document.querySelector('.ce-topbar, .ce-bar, header')
  const cs = getComputedStyle(document.documentElement)
  const vv = window.visualViewport
  const exp = window.__exp
  const r = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : n)
  const box = (n) => (n ? [Math.round(n.width), Math.round(n.height), Math.round(n.left), Math.round(n.top)] : null)

  // Le pilote graphique — utile aussi au chantier performance : une limite de
  // texture basse fait rogner le tampon de dessin par Chrome, DIMENSION PAR
  // DIMENSION (mesuré : 16384×800 demandés → 8192×800 obtenus), ce qui déforme.
  let gpu = null
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    gpu = {
      carte: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewport: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
    }
  } catch (e) { gpu = { erreur: String(e) } }

  const dpr = window.devicePixelRatio
  const pincement = vv ? r(vv.scale) : null
  const ecranPhysique = [Math.round(screen.width * dpr), Math.round(screen.height * dpr)]

  const s = {
    // --- l'échelle de la PAGE (c'est ici que se joue le « 400 % ») ---
    dpr,
    pincement, // visualViewport.scale — > 1 = pincement, et le menu Chrome ment
    ecranCss: [screen.width, screen.height],
    ecranPhysiqueDeduit: ecranPhysique, // écran réel si le zoom de page est à 100 %
    fenetreCss: [innerWidth, innerHeight],
    fenetreExterieure: [outerWidth, outerHeight],
    viewportVisuel: vv ? [r(vv.width), r(vv.height), r(vv.offsetLeft), r(vv.offsetTop)] : null,

    // --- les autres pistes d'agrandissement, à écarter ---
    zoomCssRacine: cs.zoom, // propriété `zoom` sur <html>
    transformRacine: cs.transform, // `scale` hérité
    transformCorps: getComputedStyle(document.body).transform,
    policeRacine: cs.fontSize, // racine mal posée → tout le rem part
    metaViewport: document.querySelector('meta[name=viewport]')?.content ?? null,

    // --- la machine ---
    tactile: navigator.maxTouchPoints,
    pointeurGrossier: matchMedia('(pointer: coarse)').matches,
    survol: matchMedia('(hover: hover)').matches,
    ua: navigator.userAgent,
    gpu,

    // --- l'état réel du rendu 3D ---
    cadreApp: box(app?.getBoundingClientRect()),
    canevasCss: el ? box(el.getBoundingClientRect()) : null,
    canevasTampon: el ? [el.width, el.height] : null,
    canevasStyle: el ? [el.style.width, el.style.height] : null,
    aspectCamera: exp ? r(exp.camera.aspect) : null,
    aspectCanevas: el ? r(el.getBoundingClientRect().width / el.getBoundingClientRect().height) : null,
    echelleDeRendu: exp ? exp.params.pixelRatio : null, // params.pixelRatio — 2 EN DUR aujourd'hui
    prRenderer: exp ? exp.renderer.getPixelRatio() : null,
    classesCorps: document.body.className,
  }

  // Le verdict — dire ce que les nombres racontent, pour qu'Adrien n'ait pas à
  // les interpréter.
  const v = []
  if (pincement && pincement > 1.02)
    v.push(`PINCEMENT à ${pincement}× — c'est le visual viewport de Chrome, pas le zoom de page (qui reste à 100 %). Ctrl+0, ou pincer en sens inverse, remet à 1.`)
  if (dpr >= 2 && innerWidth < 900)
    v.push(`MISE À L'ÉCHELLE SYSTÈME à ~${Math.round(dpr * 100)} % : le viewport CSS ne fait que ${innerWidth}×${innerHeight}, l'interface est dessinée pour ~1366 de large — elle paraît ${r(1366 / innerWidth)}× trop grosse. Écran réel déduit : ${ecranPhysique[0]}×${ecranPhysique[1]}.`)
  else if (innerWidth < 900)
    v.push(`FENÊTRE ÉTROITE (${innerWidth}×${innerHeight}) : l'interface est dessinée pour ~1366 de large.`)
  if (cs.zoom && cs.zoom !== 'normal' && cs.zoom !== '1') v.push(`propriété CSS \`zoom\` = ${cs.zoom} sur <html>`)
  if (cs.transform && cs.transform !== 'none') v.push(`transform sur <html> : ${cs.transform}`)
  if (s.aspectCamera && s.aspectCanevas && Math.abs(s.aspectCamera - s.aspectCanevas) / s.aspectCanevas > 0.01)
    v.push(`CADRAGE 3D DÉSACCORDÉ : aspect caméra ${s.aspectCamera} contre ${s.aspectCanevas} pour le canevas — image écrasée.`)
  if (gpu?.maxTexture && el && Math.max(el.width, el.height) > gpu.maxTexture)
    v.push(`TAMPON TROP GRAND : ${el.width}×${el.height} demandés pour une limite de texture de ${gpu.maxTexture} — Chrome rogne chaque côté séparément, donc l'image se déforme.`)
  s.verdict = v.length ? v : ['rien d’anormal sur le cadrage : échelle 1, aspects accordés.']
  return s
}

// eslint-disable-next-line no-console
console.log(window.__sondeCadrage())
