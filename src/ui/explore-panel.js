// EXPLORE panel — a curated list of the most beautiful places on Earth.
// Two top-level groups keep the panel short (Adrien): "Continents" folds the
// seven continent lists, "Gorgeous places" holds the striking high-relief
// islands. Each level is a single-open accordion scoped to its own siblings, so
// opening one entry closes only its peers — never a group in another branch.

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

  // one collapsible entry (header + body). Opening it closes only its direct
  // siblings — the bodies that share this entry's parent container.
  const group = (title, count, indent = 0) => {
    const wrap = el('div', 'ce-xgroup')
    const head = el('button', 'ce-place')
    head.type = 'button'
    if (indent) head.style.paddingLeft = `${8 + indent}px`
    head.innerHTML = `<span>${title}</span>${count != null ? `<small>${count}</small>` : ''}`
    const body = el('div', 'ce-xbody')
    body.style.display = 'none'
    head.addEventListener('click', () => {
      const open = body.style.display === 'none'
      const siblings = wrap.parentElement?.querySelectorAll(':scope > .ce-xgroup > .ce-xbody') || []
      for (const s of siblings) s.style.display = 'none'
      body.style.display = open ? '' : 'none'
    })
    wrap.append(head, body)
    return { wrap, body }
  }

  // a leaf place row: click to fly there, framed whole on the socle
  const placeRow = (p, indent) => {
    const row = el('button', 'ce-place')
    row.type = 'button'
    row.style.paddingLeft = `${8 + indent}px`
    row.innerHTML = `<span>${p.name}</span>`
    row.addEventListener('click', () => ctx.flyTo(p.lat, p.lon, p.zoom))
    return row
  }

  // ── Continents ── folds all seven continent lists
  const continentCount = Object.values(LANDMARKS).reduce((n, l) => n + l.length, 0)
  const continents = group('Continents', continentCount)
  for (const [continent, places] of Object.entries(LANDMARKS)) {
    const cg = group(continent, places.length, 14)
    for (const p of places) cg.body.append(placeRow(p, 30))
    continents.body.append(cg.wrap)
  }

  // ── Gorgeous places ── the high-relief islands, peer of Continents
  const gorgeous = group('Gorgeous places', ISLANDS.length)
  for (const p of ISLANDS) gorgeous.body.append(placeRow(p, 14))

  panel.add(continents.wrap, gorgeous.wrap)
  return panel
}
