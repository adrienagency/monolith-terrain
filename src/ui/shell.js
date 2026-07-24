// Panel shell v3 — glass cards stacked in left/right dock columns, the same
// visual grammar as the top and bottom bars. A panel collapses to its header
// pill. Les rails sont FIXES (plan « table lumineuse ») : le drag entre docks
// a été retiré — l'ordre des panneaux EST la recette, aucun outil de
// référence (Figma, Lightroom) ne laisse déplacer ses panneaux.

import { el } from './kit.js'

const docks = {}
const dockPanels = { left: [], right: [] } // for the exclusive per-column accordion
function dockColumn(side) {
  if (!docks[side]) {
    const d = el('div', `ce-dock ce-dock-${side}`)
    document.body.append(d)
    docks[side] = d
  }
  return docks[side]
}

// Chevrons de repli PAR RAIL (table lumineuse, esprit Procreate : le chrome
// s'efface, la carte reste). État persisté par côté ; les classes body
// ce-railL-off / ce-railR-off masquent le dock correspondant (v28.css).
const RAIL_KEYS = { left: 'shibumap-rail-left', right: 'shibumap-rail-right' }
export function initRails() {
  for (const side of ['left', 'right']) {
    const btn = el('button', `ce-railtoggle ce-railtoggle-${side} ce-glassbox`)
    btn.type = 'button'
    btn.setAttribute('data-tip', side === 'left' ? 'Replier / afficher les panneaux de gauche' : 'Replier / afficher les panneaux de droite')
    const cls = side === 'left' ? 'ce-railL-off' : 'ce-railR-off'
    let off = false
    try { off = localStorage.getItem(RAIL_KEYS[side]) === 'off' } catch {}
    const apply = () => {
      document.body.classList.toggle(cls, off)
      btn.classList.toggle('off', off)
    }
    apply()
    btn.addEventListener('click', () => {
      off = !off
      apply()
      try { localStorage.setItem(RAIL_KEYS[side], off ? 'off' : 'on') } catch {}
    })
    document.body.append(btn)
  }
}

export class Panel {
  constructor({ title, icon = '', side = 'left', width = 264, tip = '' }) {
    this.side = side
    this.root = el('aside', 'ce-panel ce-glassbox')
    this.root.style.width = width + 'px'

    this.head = el('header', 'ce-panel-head')
    if (tip) this.head.setAttribute('data-tip', tip)
    this.grip = el('span', 'ce-panel-title')
    this.grip.innerHTML = `${icon}<span>${title}</span>`
    this.collapseBtn = el('button', 'ce-panel-collapse')
    this.collapseBtn.type = 'button'
    this.head.append(this.grip, this.collapseBtn)

    this.body = el('div', 'ce-panel-body')
    this.root.append(this.head, this.body)

    this.sections = []
    this.collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.setCollapsed(!this.collapsed)
    })
    // l'en-tête entier replie/déplie (il ne sert plus au drag) — geste Lightroom
    this.head.addEventListener('click', (e) => {
      if (e.target === this.collapseBtn) return
      this.setCollapsed(!this.collapsed)
    })
    dockColumn(side).append(this.root)
    dockPanels[side].push(this)
  }

  get collapsed() {
    return this.root.classList.contains('collapsed')
  }

  setCollapsed(v) {
    this.root.classList.toggle('collapsed', v)
    // exclusive column accordion: expanding a panel folds its dock neighbours so
    // the column never overflows and one panel is open at a time
    if (!v) for (const p of dockPanels[this.side] || []) if (p !== this) p.root.classList.add('collapsed')
  }

  // exclusive accordion: opening one section folds the others in this panel
  addSection(sec) {
    this.sections.push(sec)
    this.body.append(sec.root)
    sec.head.addEventListener('click', () => {
      const opening = !sec.open
      for (const s of this.sections) s.setOpen(false)
      sec.setOpen(opening)
      if (opening) this.setCollapsed(false)
    })
    return sec
  }

  add(...nodes) {
    this.body.append(...nodes)
  }

}
