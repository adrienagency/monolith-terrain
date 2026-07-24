// Barre flottante « éléments » (TEST validé Adrien, réf. vidéo barre Figma) :
// quatre outils bottom-center — Lumière ☀ Nuages ☁ Brume 🌫 Mer 🌊 — à la
// place des stylos Figma ; le SURVOL ouvre un surmenu au-dessus avec les
// réglages clés de la famille. Mode avancé uniquement ; si le test convainc,
// ces familles quittent le rail droit (c'est l'objectif : le libérer).
// Les contrôles RÉUTILISENT kit.js : mêmes tirettes, mêmes registres
// refreshAll — un réglage bougé ici se resynchronise dans le rail, et vice
// versa. Fermeture au départ du pointeur avec 260 ms de grâce (voyage
// bouton → surmenu sans trou).
import { el } from './kit.js'

const I = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 8a4 4 0 0 1 0 8H7Z"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9h16M6 13h12M8 17h8"/></svg>',
  sea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
}

export function buildElemBar(groups) {
  const bar = el('div', 'ce-elembar ce-glassbox')
  const menu = el('div', 'ce-elemmenu ce-glassbox')
  let closeT = 0
  let openKey = null

  const open = (g, btn) => {
    clearTimeout(closeT)
    if (openKey === g.key) return
    openKey = g.key
    menu.replaceChildren(el('div', 'ce-elemmenu-title', g.label))
    g.build(menu)
    menu.classList.add('open')
    bar.querySelectorAll('.ce-elembar-btn').forEach((b) => b.classList.toggle('on', b === btn))
  }
  const scheduleClose = () => {
    clearTimeout(closeT)
    closeT = setTimeout(() => {
      openKey = null
      menu.classList.remove('open')
      bar.querySelectorAll('.ce-elembar-btn').forEach((b) => b.classList.remove('on'))
    }, 260)
  }

  for (const g of groups) {
    const btn = el('button', 'ce-elembar-btn')
    btn.type = 'button'
    btn.innerHTML = `${I[g.icon] || ''}<span>${g.label}</span>`
    btn.addEventListener('pointerenter', () => open(g, btn))
    btn.addEventListener('click', () => open(g, btn)) // tactile : pas de survol
    bar.append(btn)
  }
  bar.addEventListener('pointerleave', scheduleClose)
  menu.addEventListener('pointerenter', () => clearTimeout(closeT))
  menu.addEventListener('pointerleave', scheduleClose)

  const wrap = el('div', 'ce-elemwrap')
  wrap.append(menu, bar)
  document.body.append(wrap)
  return { root: wrap }
}
