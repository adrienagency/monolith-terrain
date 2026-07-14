// SCAN panel — the terrain scanner as its own first-class panel in the left
// dock, a sibling of Explore (not a child of it).

import { el, button, section, toggle, select, color, slider } from './kit.js'
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

  // Fancy — animated shader treatments painted onto the relief SURFACE
  const sFancy = panel.addSection(section('Fancy', { open: false }))

  // Liquid metal — chrome the relief (its own controls appear when it's on)
  sFancy.body.append(
    toggle({ label: 'Liquid metal', get: () => ctx.getLiquidMetal(), set: (v) => { ctx.setLiquidMetal(v); renderLmControls() } })
  )
  const lmControls = el('div', 'ce-fx-controls')
  sFancy.body.append(lmControls)
  function renderLmControls() {
    lmControls.replaceChildren()
    if (!ctx.getLiquidMetal()) return
    for (const ctl of ctx.lmControls) {
      lmControls.append(
        slider({ label: ctl.label, min: ctl.min, max: ctl.max, step: 0.01,
          get: () => ctx.getLmParam(ctl.k), set: (v) => ctx.setLmParam(ctl.k, v) })
      )
    }
  }

  // Surface shader — animated procedural pattern on the albedo; per-effect
  // controls rebuild under the picker when the effect changes
  sFancy.body.append(
    select({
      label: 'Surface shader',
      options: [{ value: '', label: 'None' }, ...ctx.surfaceFxList],
      get: () => (ctx.getSurfaceFx() ? String(ctx.getSurfaceFx()) : ''),
      set: (v) => { ctx.setSurfaceFx(v ? parseInt(v, 10) : 0); renderFxControls() },
    })
  )
  const fxControls = el('div', 'ce-fx-controls')
  sFancy.body.append(fxControls)
  function renderFxControls() {
    fxControls.replaceChildren()
    const id = ctx.getSurfaceFx()
    const meta = id && ctx.fxMeta[id]
    if (!meta) return
    for (const ctl of meta.c) {
      const opts = { label: ctl.label, get: () => ctx.getFxParam(id, ctl.k), set: (v) => ctx.setFxParam(id, ctl.k, v) }
      fxControls.append(ctl.type === 'color' ? color(opts) : slider({ ...opts, min: ctl.min, max: ctl.max, step: 0.01 }))
    }
  }

  renderLmControls()
  renderFxControls()

  return panel
}
