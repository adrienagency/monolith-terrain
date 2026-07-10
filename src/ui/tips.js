// Discreet hover tooltips — one sentence max. Any element carrying a
// data-tip attribute gets a small glass bubble after a short hover.
// One singleton bubble, delegated listeners, zero per-element cost.

import { el } from './kit.js'

let bubble = null
let timer = 0
let current = null

function ensure() {
  if (bubble) return bubble
  bubble = el('div', 'ce-tip')
  document.body.append(bubble)
  return bubble
}

function show(target) {
  if (!target.isConnected) return // folded away while the hover timer ran
  const text = target.getAttribute('data-tip')
  if (!text) return
  const b = ensure()
  b.textContent = text
  b.classList.add('on')
  const r = target.getBoundingClientRect()
  // below the element by default; flip above when near the bottom edge
  const below = r.bottom + 34 < window.innerHeight
  b.style.left = `${Math.round(Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70))}px`
  b.style.top = below ? `${Math.round(r.bottom + 8)}px` : ''
  b.style.bottom = below ? '' : `${Math.round(window.innerHeight - r.top + 8)}px`
}

function hide() {
  clearTimeout(timer)
  current = null
  bubble?.classList.remove('on')
}

export function initTips() {
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest?.('[data-tip]')
    if (target === current) return
    hide()
    if (!target) return
    current = target
    timer = setTimeout(() => show(target), 450)
  })
  document.addEventListener('pointerdown', hide)
  document.documentElement.addEventListener('mouseleave', hide)
  window.addEventListener('blur', hide)
}

// helper: tag any element with a tip in one call
export function tip(node, text) {
  node.setAttribute('data-tip', text)
  return node
}
