// SHADERS panel — animated shader treatments painted onto the relief SURFACE
// (Liquid metal + the procedural surface shaders). A first-class right-dock
// panel between Create and Camera, split out of the old Scan > Fancy section.
// Each surface shader carries an "Appearance" block (opacity + Figma-style blend
// mode) plus its own per-effect controls.

import { el, section, toggle, select, color, slider } from './kit.js'
import { Panel } from './shell.js'
import { BLEND_MODES } from '../fx-meta.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9.5" r="5.5"/><circle cx="15" cy="14.5" r="5.5"/></svg>'

export function buildShadersPanel(ctx) {
  const panel = new Panel({
    title: 'Shaders',
    icon: ICON,
    side: 'right',
    width: 264,
    tip: 'Animated shader treatments painted onto the relief surface.',
  })
  const s = panel.addSection(section('Surface', { open: false }))

  // --- Liquid metal (its own controls appear when it's on) ---
  s.body.append(
    toggle({ label: 'Liquid metal', get: () => ctx.getLiquidMetal(), set: (v) => { ctx.setLiquidMetal(v); renderLm() } })
  )
  const lmCtl = el('div', 'ce-fx-controls')
  s.body.append(lmCtl)
  function renderLm() {
    lmCtl.replaceChildren()
    if (!ctx.getLiquidMetal()) return
    for (const c of ctx.lmControls) {
      lmCtl.append(slider({ label: c.label, min: c.min, max: c.max, step: 0.01, get: () => ctx.getLmParam(c.k), set: (v) => ctx.setLmParam(c.k, v) }))
    }
  }

  // --- Surface shader picker ---
  s.body.append(
    select({
      label: 'Surface shader',
      options: [{ value: '', label: 'None' }, ...ctx.surfaceFxList],
      get: () => (ctx.getSurfaceFx() ? String(ctx.getSurfaceFx()) : ''),
      set: (v) => { ctx.setSurfaceFx(v ? parseInt(v, 10) : 0); renderFx() },
    })
  )
  const appear = el('div', 'ce-fx-controls') // Appearance: opacity + blend
  const fxCtl = el('div', 'ce-fx-controls') // per-effect options
  s.body.append(appear, fxCtl)

  function renderFx() {
    appear.replaceChildren()
    fxCtl.replaceChildren()
    const id = ctx.getSurfaceFx()
    const meta = id && ctx.fxMeta[id]
    if (!meta) return
    // Appearance — how the shader sits over the map (like Figma's Appearance)
    appear.append(el('div', 'ce-fx-head', 'Appearance'))
    appear.append(
      slider({ label: 'Opacity', min: 0, max: 1, step: 0.01, get: () => ctx.getFxParam(id, 'opacity'), set: (v) => ctx.setFxParam(id, 'opacity', v) }),
      select({ label: 'Blend', options: BLEND_MODES.map((label, i) => ({ value: String(i), label })), get: () => String(ctx.getFxParam(id, 'blend') || 0), set: (v) => ctx.setFxParam(id, 'blend', parseInt(v, 10)) })
    )
    // Per-effect knobs
    for (const c of meta.c) {
      const opts = { label: c.label, get: () => ctx.getFxParam(id, c.k), set: (v) => ctx.setFxParam(id, c.k, v) }
      fxCtl.append(c.type === 'color' ? color(opts) : slider({ ...opts, min: c.min, max: c.max, step: 0.01 }))
    }
  }

  renderLm()
  renderFx()
  return panel
}
