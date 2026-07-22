// EXPLORE panel — a curated list of the most beautiful places on Earth. The
// continents are listed directly (no redundant "Places" wrapper), then, after a
// separator, a peer group "Islands" — the world's most striking high-relief
// islands, each framed whole on the socle (Adrien).

import { el } from './kit.js'
import { Panel } from './shell.js'
import { LANDMARKS, ISLANDS } from '../landmarks.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z"/></svg>'

export function buildExplorePanel(ctx) {
  const panel = new Panel({
    title: 'Explore',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Fly to a curated list of the most beautiful places on Earth.',
  })

  const root = el('div')

  // one collapsible group (a continent, or "Islands") → its list of places.
  // Opening one closes the others (single-open accordion, same as before).
  const addGroup = (title, places) => {
    const head = el('button', 'ce-place')
    head.type = 'button'
    head.innerHTML = `<span>${title}</span><small>${places.length}</small>`
    const list = el('div')
    list.dataset.list = '1'
    list.style.display = 'none'
    head.addEventListener('click', () => {
      const open = list.style.display === 'none'
      for (const other of root.querySelectorAll('[data-list]')) other.style.display = 'none'
      list.style.display = open ? '' : 'none'
    })
    for (const p of places) {
      const row = el('button', 'ce-place')
      row.type = 'button'
      row.style.paddingLeft = '18px'
      row.innerHTML = `<span>${p.name}</span>`
      row.addEventListener('click', () => ctx.flyTo(p.lat, p.lon, p.zoom))
      list.append(row)
    }
    root.append(head, list)
  }

  for (const [continent, places] of Object.entries(LANDMARKS)) addGroup(continent, places)

  // separator, then Islands as a peer group of the continents
  root.append(el('div', 'ce-place-sep'))
  addGroup('Islands', ISLANDS)

  panel.add(root)
  return panel
}
