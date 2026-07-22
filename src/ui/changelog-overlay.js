// "What's new" overlay — renders the curated CHANGELOG (src/changelog.js) in
// the same modal shell as the keyboard-shortcuts card. Opened from the ALPHA
// chip in the top bar: the chip both states the product stage and gives the
// stage a receipt — here is everything that moved, dated.

import { el } from './kit.js'
import { CHANGELOG, APP_STAGE } from '../changelog.js'

export function buildChangelogOverlay() {
  const backdrop = el('div', 'ce-shortcuts-overlay ce-log-overlay')
  const card = el('div', 'ce-shortcuts-card ce-glassbox')

  const head = el('div', 'ce-shortcuts-head')
  const title = el('div', 'ce-shortcuts-title', "What's new")
  if (APP_STAGE) title.append(el('span', 'ce-log-stage', APP_STAGE.toUpperCase()))
  head.append(title)
  const closeBtn = el('button', 'ce-shortcuts-close')
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.textContent = '✕'
  head.append(closeBtn)
  card.append(head)

  const intro = el(
    'div',
    'ce-log-intro',
    'ShibuMap is in alpha — it moves fast and the occasional rough edge is part of the ride. The trail so far:'
  )
  card.append(intro)

  const body = el('div', 'ce-log-body')
  for (const entry of CHANGELOG) {
    const group = el('div', 'ce-log-group')
    const head2 = el('div', 'ce-log-date')
    head2.append(el('span', 'ce-log-day', formatDate(entry.date)), el('span', 'ce-log-title', entry.title))
    group.append(head2)
    const list = el('ul', 'ce-log-list')
    for (const item of entry.items) list.append(el('li', 'ce-log-item', item))
    group.append(list)
    body.append(group)
  }
  card.append(body)
  backdrop.append(card)

  function toggle(force) {
    const show = force != null ? !!force : !backdrop.classList.contains('open')
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

// '2026-07-21' → 'Jul 21' — compact, unambiguous, locale-stable
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}
