// Barre « liquide » réutilisable (réf. capture Enroll validée Adrien) : les
// boutons d'un même groupe partagent une silhouette de bulles qui FUSIONNENT
// par des tailles concaves (filtre SVG « goo » : flou + seuil d'alpha), et
// l'état actif est une bulle sombre qui coule d'un bouton à l'autre (les
// transitions left/width des bulles passent PAR le filtre → morph fluide).
// Les boutons restent au-dessus du calque, nets — seul le fond est liquide.
//
// Usage : liquidize(cluster, { items: () => [...boutons] }) — cluster en
// position:relative, boutons SANS fond propre (la bulle est leur fond).
// L'état se lit sur les classes du bouton : .on → bulle encre, .accent →
// bulle accent. Pensé pour être réutilisé ailleurs (demande Adrien).
import { el } from './kit.js'

let gooDefs = null
function ensureGoo() {
  if (gooDefs) return
  gooDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  gooDefs.setAttribute('class', 'lq-defs')
  gooDefs.setAttribute('aria-hidden', 'true')
  // Flou 8 + seuil alpha 20a-9 (bord à 0.45) sur des bulles OPAQUES (la
  // translucidité vit sur le calque, après le filtre) : à 4px d'écart,
  // l'alpha au milieu ≈ 0.8 → pincement large, la proportion de la réf
  // Enroll. Région élargie : le débord par défaut (10 %) rognait le flou.
  gooDefs.innerHTML =
    '<defs><filter id="ce-goo" x="-30%" y="-60%" width="160%" height="220%">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/>' +
    '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="g"/>' +
    '<feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs>'
  document.body.append(gooDefs)
}

// MARGE du calque goo : il déborde du cluster pour que le flou du filtre ne
// se fasse pas rogner au bord — les bulles compensent via translate (CSS).
export const LQ_PAD = 12

export function liquidize(cluster, { items, inflate = 4 } = {}) {
  ensureGoo()
  const goo = el('div', 'lq-goo')
  cluster.prepend(goo)
  const blobs = new Map() // bouton → bulle
  let raf = 0
  const place = (blob, x, y, w, h) => {
    blob.style.left = x + 'px'
    blob.style.top = y + 'px'
    blob.style.width = w + 'px'
    blob.style.height = h + 'px'
  }
  const blobFor = (key) => {
    let b = blobs.get(key)
    if (!b) { b = el('i', 'lq-blob'); goo.append(b); blobs.set(key, b) }
    return b
  }
  const sync = () => {
    raf = 0
    const base = cluster.getBoundingClientRect()
    if (!base.width) return // cluster masqué (display:none) — rien à dessiner
    const live = (items ? items() : [...cluster.children]).filter((n) => n !== goo && n.offsetParent !== null)
    const seen = new Set()
    if (!live.length) {
      // mode focus (grande tirette) : les boutons sont cachés, une seule
      // bulle couvre tout le cluster pour lui garder un fond
      const b = blobFor(cluster)
      seen.add(cluster)
      place(b, 0, 0, base.width, base.height)
      b.classList.remove('dark', 'accent')
    }
    for (const it of live) {
      const b = blobFor(it)
      seen.add(it)
      const r = it.getBoundingClientRect()
      place(b, r.left - base.left - inflate, r.top - base.top - inflate, r.width + inflate * 2, r.height + inflate * 2)
      b.classList.toggle('dark', it.classList.contains('on'))
      b.classList.toggle('accent', it.classList.contains('accent'))
    }
    for (const [k, b] of blobs) if (!seen.has(k)) { b.remove(); blobs.delete(k) }
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(sync) }
  // ⚠️ sync écrit les styles des bulles → ignorer les mutations du calque goo
  // lui-même, sinon boucle rAF infinie observer→sync→observer
  new MutationObserver((recs) => { if (recs.some((r) => !goo.contains(r.target))) ask() })
    .observe(cluster, { attributes: true, childList: true, subtree: true })
  new ResizeObserver(ask).observe(cluster)
  window.addEventListener('resize', ask)
  document.fonts?.ready?.then(ask)
  // filet : un déplacement piloté par la FEUILLE DE STYLE seule (HMR CSS,
  // media query, thème) ne mute ni le DOM ni la taille du cluster — aucun
  // observer ne le voit. Un poll doux rattrape ces dérives (2-5 bulles, coût
  // négligeable ; les écritures identiques sont filtrées côté observer).
  setInterval(ask, 600)
  ask()
  return { refresh: ask }
}
