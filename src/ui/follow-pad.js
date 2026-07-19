// On-screen view pad for GPX follow — the user drives the camera now.
//
// A numpad-style 3x3 (1..9) of fixed views around the race head (5 = top
// down), + / - to zoom, arrows to tilt. Shown only while follow is active.
// Every control exists twice on purpose: as a keyboard shortcut AND as a
// clickable button ('pour ceux qui n'ont pas de clavier numérique').

import { el } from './kit.js'

let padEl = null
let keyHandler = null

const LABELS = { 7: '↖', 8: '↑', 9: '↗', 4: '←', 5: '⬇', 6: '→', 1: '↙', 2: '↓', 3: '↘' }

export function showFollowPad(drone) {
  hideFollowPad()
  padEl = el('div', 'ce-followpad')
  padEl.innerHTML = ''
  const grid = el('div', 'ce-fp-grid')
  for (const n of [7, 8, 9, 4, 5, 6, 1, 2, 3]) {
    const b = el('button', 'ce-fp-btn', LABELS[n])
    b.title = n === 5 ? 'Vue top-down (5)' : `Vue ${n}`
    b.dataset.n = n
    b.addEventListener('click', () => drone.setView(n))
    grid.append(b)
  }
  const row = el('div', 'ce-fp-row')
  const mk = (txt, title, fn) => {
    const b = el('button', 'ce-fp-btn', txt)
    b.title = title
    b.addEventListener('click', fn)
    return b
  }
  row.append(
    mk('−', 'Dézoomer (−)', () => drone.zoomBy(1.18)),
    mk('+', 'Zoomer (+)', () => drone.zoomBy(1 / 1.18)),
    mk('◀', 'Pivoter à gauche (←)', () => drone.rotateBy(-10)),
    mk('▶', 'Pivoter à droite (→)', () => drone.rotateBy(10)),
    mk('▲', 'Tilt haut (↑)', () => drone.tiltBy(6)),
    mk('▼', 'Tilt bas (↓)', () => drone.tiltBy(-6))
  )
  padEl.append(grid, row)
  document.body.append(padEl)

  keyHandler = (e) => {
    // never steal keys from an input field
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return
    const d = e.code.startsWith('Numpad') ? e.code.slice(6) : e.code.startsWith('Digit') ? e.code.slice(5) : null
    if (d && d >= '1' && d <= '9') { drone.setView(+d); e.preventDefault(); return }
    if (e.key === '+' || e.code === 'NumpadAdd') { drone.zoomBy(1 / 1.18); e.preventDefault(); return }
    if (e.key === '-' || e.code === 'NumpadSubtract') { drone.zoomBy(1.18); e.preventDefault(); return }
    if (e.code === 'ArrowUp') { drone.tiltBy(6); e.preventDefault(); return }
    if (e.code === 'ArrowDown') { drone.tiltBy(-6); e.preventDefault(); return }
    // held arrows auto-repeat: a smooth continuous orbit for free
    if (e.code === 'ArrowLeft') { drone.rotateBy(-6); e.preventDefault(); return }
    if (e.code === 'ArrowRight') { drone.rotateBy(6); e.preventDefault() }
  }
  document.addEventListener('keydown', keyHandler)
}

export function hideFollowPad() {
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null }
  padEl?.remove()
  padEl = null
}
