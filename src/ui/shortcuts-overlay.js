// Self-updating keyboard-shortcuts help overlay — renders straight from the
// SHORTCUTS registry (src/shortcuts.js), grouped by category, so a future
// entry appears here automatically with no changes to this file.

import { el } from './kit.js'
import { SHORTCUTS } from '../shortcuts.js'

export function buildShortcutsOverlay() {
  const backdrop = el('div', 'ce-shortcuts-overlay')
  const card = el('div', 'ce-shortcuts-card ce-glassbox')

  const head = el('div', 'ce-shortcuts-head')
  head.append(el('div', 'ce-shortcuts-title', 'Keyboard shortcuts'))
  const closeBtn = el('button', 'ce-shortcuts-close')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '✕'
  head.append(closeBtn)
  card.append(head)

  const body = el('div', 'ce-shortcuts-body')
  card.append(body)
  backdrop.append(card)

  // group SHORTCUTS by category, preserving first-seen category order, then
  // render one row per entry — reads the array live, so it's always current
  function render() {
    body.textContent = ''
    const byCategory = new Map()
    for (const s of SHORTCUTS) {
      if (!byCategory.has(s.category)) byCategory.set(s.category, [])
      byCategory.get(s.category).push(s)
    }
    for (const [category, entries] of byCategory) {
      const group = el('div', 'ce-shortcuts-group')
      group.append(el('div', 'ce-shortcuts-cat', category))
      const list = el('div', 'ce-shortcuts-list')
      for (const s of entries) {
        const row = el('div', 'ce-shortcuts-row')
        const keys = el('div', 'ce-shortcuts-keys')
        for (const k of s.keys) keys.append(el('kbd', 'ce-kbd', k))
        row.append(keys, el('div', 'ce-shortcuts-label', s.label))
        list.append(row)
      }
      group.append(list)
      body.append(group)
    }
  }

  function toggle(force) {
    const show = force != null ? !!force : !backdrop.classList.contains('open')
    if (show) render() // re-render on every open so a live-added entry always shows
    backdrop.classList.toggle('open', show)
  }

  closeBtn.addEventListener('click', () => toggle(false))
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) toggle(false)
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && backdrop.classList.contains('open')) toggle(false)
  })

  document.body.append(backdrop)
  return { el: backdrop, toggle }
}
