// Panel shell v2 — glass cards stacked in left/right dock columns, the same
// visual grammar as the top and bottom bars. A panel collapses to its header
// pill; dragging its header moves it between docks with hard magnetic snap.

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
    this._initDrag()
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

  // hard magnetic docking: the card follows the pointer while dragged, then
  // lands in the dock column of whichever half of the screen it's over
  _initDrag() {
    let sx = 0
    let sy = 0
    let dragging = false
    const onMove = (e) => {
      if (!dragging) return
      this.root.style.transform = `translate(${e.clientX - sx}px, ${e.clientY - sy}px)`
    }
    const finish = (e, commit) => {
      if (!dragging) return
      dragging = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      this.root.classList.remove('dragging')
      this.root.style.transform = ''
      if (!commit) return // cancelled gesture: snap home, change nothing
      const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right'
      if (side !== this.side) {
        const arr = dockPanels[this.side]
        const i = arr.indexOf(this)
        if (i >= 0) arr.splice(i, 1)
        this.side = side
        dockPanels[side].push(this)
        dockColumn(side).append(this.root)
      }
    }
    const onUp = (e) => finish(e, true)
    const onCancel = (e) => finish(e, false)
    this.head.addEventListener('pointerdown', (e) => {
      if (e.target === this.collapseBtn) return
      dragging = true
      sx = e.clientX
      sy = e.clientY
      this.root.classList.add('dragging')
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    })
  }
}
