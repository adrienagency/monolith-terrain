// EXPLORE panel — a curated list of the most beautiful places on Earth,
// grouped by continent. Click a place and fly there.

import { el, section } from './kit.js'
import { Panel } from './shell.js'
import { LANDMARKS } from '../landmarks.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5z"/></svg>'

export function buildExplorePanel(ctx) {
  const panel = new Panel({
    title: 'Explore',
    icon: ICON,
    side: 'left',
    width: 250,
    tip: 'Fly to a curated list of the most beautiful places on Earth.',
  })

  const sPlaces = panel.addSection(section('Places', { open: false }))
  const continents = el('div')
  for (const [continent, places] of Object.entries(LANDMARKS)) {
    const head = el('button', 'ce-place')
    head.type = 'button'
    head.innerHTML = `<span>${continent}</span><small>${places.length}</small>`
    const list = el('div')
    list.style.display = 'none'
    head.addEventListener('click', () => {
      const open = list.style.display === 'none'
      for (const other of continents.querySelectorAll('[data-list]')) other.style.display = 'none'
      list.style.display = open ? '' : 'none'
    })
    list.dataset.list = '1'
    for (const p of places) {
      const row = el('button', 'ce-place')
      row.type = 'button'
      row.style.paddingLeft = '18px'
      row.innerHTML = `<span>${p.name}</span>`
      row.addEventListener('click', () => ctx.flyTo(p.lat, p.lon, p.zoom))
      list.append(row)
    }
    continents.append(head, list)
  }
  sPlaces.body.append(continents)

  return panel
}
