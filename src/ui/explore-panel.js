// EXPLORE panel — the discovery side (left dock): a curated list of the
// most beautiful places on Earth, and the terrain scanner.

import { el, button, section, segmented } from './kit.js'
import { Panel } from './shell.js'
import { LANDMARKS } from '../landmarks.js'
import { SCAN_TYPES } from '../scan.js'

export function buildExplorePanel(ctx) {
  const panel = new Panel({ title: 'Explore', side: 'left', width: 250 })

  // ------------------------------------------------------------ places
  const sPlaces = panel.addSection(section('Places', { open: true }))
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

  // -------------------------------------------------------------- scan
  const sScan = panel.addSection(section('Scan'))
  let scanType = SCAN_TYPES[0].id
  sScan.body.append(el('div', 'ce-label', 'Survey the terrain with an animated sweep'))
  const grid = el('div', 'ce-scan-grid')
  const typeButtons = SCAN_TYPES.map((t) => {
    const b = el('button', `ce-card${t.id === scanType ? ' on' : ''}`)
    b.type = 'button'
    b.innerHTML = `<span class="ce-card-name">${t.label}</span>`
    b.addEventListener('click', () => {
      scanType = t.id
      typeButtons.forEach((x) => x.classList.remove('on'))
      b.classList.add('on')
    })
    grid.append(b)
    return b
  })
  sScan.body.append(grid)
  const trig = el('div', 'ce-btn-row')
  trig.append(button('Run scan', () => ctx.runScan(scanType), { accent: true }))
  sScan.body.append(trig)

  return panel
}
