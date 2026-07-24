// SHADERS panel — animated shader treatments painted onto the relief SURFACE
// (Liquid metal + the procedural surface shaders). A first-class right-dock
// panel between Create and Camera, split out of the old Scan > Fancy section.
// Each surface shader carries an "Appearance" block (opacity + Figma-style blend
// mode) plus its own per-effect controls.

import { el, section, toggle, select, color, slider } from './kit.js'
import { Panel } from './shell.js'
import { BLEND_MODES } from '../fx-meta.js'
import { materialsByCategory } from '../material-catalog.js'
import { requestFxThumb } from './fx-thumbs.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9.5" r="5.5"/><circle cx="15" cy="14.5" r="5.5"/></svg>'

// shared vignette-tile builder — one visual language for every picker in this
// panel (Shaders, Relief material). A tile with real image media carries no
// label (the picture IS the name); only the textless fallback (e.g. "None")
// keeps its caption.
function vigTile({ id, cur, label, media, showName, onPick }) {
  const b = el('button', `ce-mat-vig${cur === id ? ' on' : ''}`)
  b.type = 'button'
  b.setAttribute('data-tip', label)
  b.append(media)
  if (showName) b.append(el('span', 'ce-mat-vig-name', label))
  b.addEventListener('click', () => {
    onPick()
    b.parentElement.querySelectorAll('.ce-mat-vig.on').forEach((t) => t.classList.remove('on'))
    b.classList.add('on')
  })
  return b
}

export function buildShadersPanel(ctx) {
  const panel = new Panel({
    title: 'Matières',
    icon: ICON,
    side: 'right',
    width: 268, // match Create/Camera so the right dock aligns cleanly
    tip: 'De quoi la carte est faite : terrain, socle, matière du relief, shaders.',
  })

  // --- 1. Shaders: animated procedural treatments painted onto the relief ---
  const sFx = panel.addSection(section('Effets de surface (shaders)', { open: false }))
  const fxPick = el('div', 'ce-mat-pick')
  sFx.body.append(fxPick)
  const appear = el('div', 'ce-fx-controls') // Appearance: opacity + blend
  const fxCtl = el('div', 'ce-fx-controls') // per-effect options
  sFx.body.append(appear, fxCtl)

  function renderFxPicker() {
    fxPick.replaceChildren()
    const cur = ctx.getSurfaceFx() ? Number(ctx.getSurfaceFx()) : 0
    const grid = el('div', 'ce-mat-grid')
    const none = el('span', 'ce-mat-vig-img ce-mat-vig-none')
    grid.append(vigTile({ id: 0, cur, label: 'Aucun', media: none, showName: true, onPick: () => { ctx.setSurfaceFx(0); renderFx() } }))
    for (const { value, label } of ctx.surfaceFxList) {
      const id = parseInt(value, 10)
      const media = el('img', 'ce-mat-vig-img')
      media.alt = label
      requestFxThumb(id, (url) => { media.src = url })
      grid.append(vigTile({ id, cur, label, media, showName: false, onPick: () => { ctx.setSurfaceFx(id); renderFx() } }))
    }
    fxPick.append(grid)
  }

  function renderFx() {
    appear.replaceChildren()
    fxCtl.replaceChildren()
    const id = ctx.getSurfaceFx()
    const meta = id && ctx.fxMeta[id]
    if (!meta) return
    // Appearance — how the shader sits over the map (like Figma's Appearance)
    appear.append(el('div', 'ce-fx-head', 'Apparence'))
    appear.append(
      slider({ label: 'Opacité', min: 0, max: 1, step: 0.01, get: () => ctx.getFxParam(id, 'opacity'), set: (v) => ctx.setFxParam(id, 'opacity', v) }),
      select({ label: 'Fusion', options: BLEND_MODES.map((label, i) => ({ value: String(i), label })), get: () => String(ctx.getFxParam(id, 'blend') || 0), set: (v) => ctx.setFxParam(id, 'blend', parseInt(v, 10)) })
    )
    // Per-effect knobs
    for (const c of meta.c) {
      const opts = { label: c.label, get: () => ctx.getFxParam(id, c.k), set: (v) => ctx.setFxParam(id, c.k, v) }
      fxCtl.append(c.type === 'color' ? color(opts) : slider({ ...opts, min: c.min, max: c.max, step: 0.01 }))
    }
  }

  // --- 2. Relief material: turn the WHOLE relief into a real PBR material
  // (glass, rock, sand, marble, …). A vignette picker grouped by category so
  // you choose by look, not by a word — a full material swap ---
  const sMat = panel.addSection(section('Matière du relief', { open: false }))
  const matPick = el('div', 'ce-mat-pick')
  sMat.body.append(matPick)
  const matCtl = el('div', 'ce-fx-controls')
  sMat.body.append(matCtl)

  // build the vignette grid: a "None" tile + one titled group per category
  function renderPicker() {
    const st = matPick.scrollTop
    matPick.replaceChildren()
    const cur = ctx.getSurfaceMat() || ''
    const tile = (id, label, media, showName) => vigTile({ id, cur, label, media, showName, onPick: () => { ctx.setSurfaceMat(id); renderMat() } })
    // None / topographic
    const none = el('span', 'ce-mat-vig-img ce-mat-vig-none')
    const noneGrid = el('div', 'ce-mat-grid')
    noneGrid.append(tile('', 'Aucune', none, true))
    matPick.append(noneGrid)
    // categories
    for (const cat of materialsByCategory()) {
      matPick.append(el('div', 'ce-mat-cat', cat.label))
      const grid = el('div', 'ce-mat-grid')
      for (const m of cat.items) {
        let media
        if (m.thumb) { media = el('img', 'ce-mat-vig-img'); media.src = m.thumb; media.alt = m.label; media.loading = 'lazy' }
        else { media = el('span', 'ce-mat-vig-img'); if (m.swatch) media.style.background = m.swatch }
        grid.append(tile(m.id, m.label, media, false))
      }
      matPick.append(grid)
    }
    matPick.scrollTop = st
  }
  function renderMat() {
    matCtl.replaceChildren()
    const id = ctx.getSurfaceMat()
    if (!id) return
    if (id === 'glass') {
      matCtl.append(color({ label: 'Teinte du verre', get: () => ctx.getGlassTint(), set: (v) => ctx.setGlassTint(v) }))
      for (const c of ctx.glassControls) {
        matCtl.append(slider({ label: c.label, min: c.min, max: c.max, step: c.k === 'terrainGlassThickness' || c.k === 'terrainGlassClarity' ? 0.5 : 0.01, get: () => ctx.getGlassParam(c.k), set: (v) => ctx.setGlassParam(c.k, v) }))
      }
    } else {
      matCtl.append(
        slider({ label: 'Échelle (tuilage)', min: 0.3, max: 4, step: 0.05, get: () => ctx.getMatScale(), set: (v) => ctx.setMatScale(v) }),
        slider({ label: 'Relief de la matière', min: 0, max: 3, step: 0.05, get: () => ctx.getSurfaceMatBump(), set: (v) => ctx.setSurfaceMatBump(v) }),
        slider({ label: 'Rugosité', min: 0, max: 1, step: 0.01, get: () => ctx.getMatRoughness(), set: (v) => ctx.setMatRoughness(v) }),
        slider({ label: 'Bruit (révèle la base)', min: 0, max: 1, step: 0.01, get: () => ctx.getMatNoise(), set: (v) => ctx.setMatNoise(v) }),
        toggle({ label: 'Au-dessus du niveau zéro', get: () => ctx.getMatAboveZero(), set: (v) => ctx.setMatAboveZero(v) })
      )
    }
  }

  // --- 3. Fancy: the liquid-metal treatment (its own controls appear when
  // it's on) — same peer level as Shaders and Relief material ---
  const sFancy = panel.addSection(section('Labo', { open: false }))
  sFancy.body.append(
    toggle({ label: 'Métal liquide', get: () => ctx.getLiquidMetal(), set: (v) => { ctx.setLiquidMetal(v); renderLm() } })
  )
  const lmCtl = el('div', 'ce-fx-controls')
  sFancy.body.append(lmCtl)
  function renderLm() {
    lmCtl.replaceChildren()
    if (!ctx.getLiquidMetal()) return
    for (const c of ctx.lmControls) {
      lmCtl.append(slider({ label: c.label, min: c.min, max: c.max, step: 0.01, get: () => ctx.getLmParam(c.k), set: (v) => ctx.setLmParam(c.k, v) }))
    }
  }

  // ordre de lecture : Matière du relief (le choix le plus courant) AVANT les
  // effets de surface ; Terrain/Socle (create-panel) seront prépendus devant
  panel.body.insertBefore(sMat.root, sFx.root)

  renderLm()
  renderFxPicker()
  renderFx()
  renderPicker()
  renderMat()
  // let main.js re-render these when an exclusivity change flips LM ↔ relief
  // material, or a template swaps the material out from under the picker
  ctx.registerRefresh?.(() => { renderLm(); renderFxPicker(); renderFx(); renderPicker(); renderMat() })
  return panel
}
