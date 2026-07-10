// SCAN panel — the terrain scanner as its own first-class panel in the left
// dock, a sibling of Explore (not a child of it).

import { el, button, section } from './kit.js'
import { Panel } from './shell.js'
import { SCAN_TYPES } from '../scan.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/><path d="M12 3a9 9 0 019 9h-4.5"/></svg>'

const TIPS = {
  radar: 'An expanding radar ring sweeps out from the center.',
  elevation: 'A horizontal plane rises through the relief, altitude by altitude.',
  gridline: 'A bright survey line sweeps across the map, lighting the grid.',
  sonar: 'Three sonar pings ripple out from where you are looking.',
  holo: 'The whole map flickers and re-materialises like a hologram.',
}

export function buildScanPanel(ctx) {
  const panel = new Panel({
    title: 'Scan',
    icon: ICON,
    side: 'left',
    width: 250,
    tip: 'Run an animated survey sweep over the terrain.',
  })

  const sScan = panel.addSection(section('Scanner', { open: false }))
  let scanType = SCAN_TYPES[0].id
  const grid = el('div', 'ce-scan-grid')
  const typeButtons = SCAN_TYPES.map((t) => {
    const b = el('button', `ce-card${t.id === scanType ? ' on' : ''}`)
    b.type = 'button'
    b.innerHTML = `<span class="ce-card-name">${t.label}</span>`
    b.setAttribute('data-tip', TIPS[t.key] ?? t.label)
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
  const run = button('Run scan', () => ctx.runScan(scanType), { accent: true })
  run.setAttribute('data-tip', 'Trigger the selected sweep on the current view.')
  trig.append(run)
  sScan.body.append(trig)

  return panel
}
