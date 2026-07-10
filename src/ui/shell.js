// Panel shell — glass card docked left or right, draggable by its header
// with hard magnetic docking (a panel always lands flush on a side), a
// collapse chevron, and exclusive accordion sections.

import { el } from './kit.js'

const DOCK_MARGIN = 14
const TOP_MIN = 60

export class Panel {
  constructor({ title, side = 'left', width = 264 }) {
    this.side = side
    this.root = el('aside', `ce-panel ce-dock-${side}`)
    this.root.style.width = width + 'px'

    this.head = el('header', 'ce-panel-head')
    this.grip = el('span', 'ce-panel-title', title)
    this.collapseBtn = el('button', 'ce-panel-collapse')
    this.collapseBtn.type = 'button'
    this.collapseBtn.title = 'Collapse'
    this.head.append(this.grip, this.collapseBtn)

    this.body = el('div', 'ce-panel-body')
    this.root.append(this.head, this.body)

    this.sections = []
    this.collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.setCollapsed(!this.root.classList.contains('collapsed'))
    })
    this._initDrag()
    document.body.append(this.root)
    this._top = null // null = CSS default
  }

  setCollapsed(v) {
    this.root.classList.toggle('collapsed', v)
  }

  // exclusive accordion: opening one section folds the others
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

  // hard magnetic docking: while dragging the card follows the pointer,
  // on release it snaps flush to whichever half of the screen it's on;
  // vertical position is kept (clamped under the top bar)
  _initDrag() {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false
    const onMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - sx
      const dy = e.clientY - sy
      this.root.style.transition = 'none'
      this.root.style.transform = `translate(${ox + dx}px, ${oy + dy}px)`
    }
    const onUp = (e) => {
      if (!dragging) return
      dragging = false
      window.removeEventListener('pointermove', onMove)
      const r = this.root.getBoundingClientRect()
      const side = r.left + r.width / 2 < window.innerWidth / 2 ? 'left' : 'right'
      this.dock(side, Math.max(TOP_MIN, Math.min(r.top, window.innerHeight - 120)))
    }
    this.head.addEventListener('pointerdown', (e) => {
      if (e.target === this.collapseBtn) return
      dragging = true
      sx = e.clientX
      sy = e.clientY
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(this.root.style.transform)
      ox = m ? parseFloat(m[1]) : 0
      oy = m ? parseFloat(m[2]) : 0
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    })
  }

  dock(side, top) {
    this.side = side
    this.root.classList.remove('ce-dock-left', 'ce-dock-right')
    this.root.classList.add(`ce-dock-${side}`)
    this.root.style.transition = 'transform .28s cubic-bezier(.2,.9,.25,1)'
    this.root.style.transform = 'translate(0px, 0px)'
    this.root.style.top = top != null ? top + 'px' : ''
    this.root.style.left = ''
    this.root.style.right = ''
    if (side === 'left') this.root.style.left = DOCK_MARGIN + 'px'
    else this.root.style.right = DOCK_MARGIN + 'px'
  }
}
