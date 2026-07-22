// TEMPLATES panel — built-in + saved looks, docked ABOVE Create in the right
// dock (its own first-class panel, split out of Create). Also home to the
// "Reset map" button that restores every look setting to its shipped
// defaults in one click — see ctx.resetAll (main.js), which extends the
// Reset-look behaviour to background, socle, relief material, clouds, fog
// and the map overlay layers. Location/zoom are never touched.

import { el, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { TEMPLATES } from '../templates.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>'

export function buildTemplatesPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Templates',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'Built-in and saved looks — one click restyles the whole map.',
  })

  // ------------------------------------------------------------- Reset map
  // Above everything else — the panic button that clears every look setting
  // (background, block, relief material, shaders, clouds, fog, map layers…)
  // back to defaults, without ever moving the camera or the location.
  const resetWrap = el('div', 'ce-btn-row')
  const resetBtn = button(
    'Reset map',
    () => {
      if (ctx.resetAll) {
        ctx.resetAll()
        refreshAll()
        ctx.syncDark?.()
      }
    },
    { ghost: true }
  )
  resetBtn.setAttribute('data-tip', 'Reset every look setting to its default (keeps your location).')
  resetWrap.append(resetBtn)
  panel.body.append(resetWrap)

  // ------------------------------------------------------------- Palettes
  // Couleurs VALIDÉES depuis Create › Colours (Adrien) — une rangée de cartes
  // défilable vers la droite : bande relief + bande océan, clic = appliquer.
  const sPal = panel.addSection(section('Palettes', { open: true }))
  const palRow = el('div', 'ce-pal-row')
  const palEmpty = el('div', 'ce-gpx-layers-empty', 'Generate a palette in Create › Colours, then Save it — it lands here.')
  function renderPalettes() {
    const list = ctx.userPalettes?.() || []
    palRow.replaceChildren()
    palEmpty.classList.toggle('hidden', list.length > 0)
    for (const p of list) {
      const card = el('button', 'ce-pal-card')
      card.type = 'button'
      card.title = p.name
      const strip = el('div', 'ce-pal-strip')
      for (const s of p.rampStops) { const seg = el('span'); seg.style.background = s.c; strip.append(seg) }
      const ocean = el('div', 'ce-pal-strip ce-pal-ocean')
      for (const c of [p.oceanShallow, p.oceanMid, p.oceanDeep]) { const seg = el('span'); seg.style.background = c; ocean.append(seg) }
      const nameEl = el('span', 'ce-pal-name', p.name)
      const x = el('span', 'ce-pal-x', '✕')
      x.addEventListener('click', (e) => { e.stopPropagation(); ctx.deleteUserPalette?.(p.id); renderPalettes() })
      card.append(strip, ocean, nameEl, x)
      card.addEventListener('click', () => { ctx.applyPalette({ rampStops: p.rampStops, oceanShallow: p.oceanShallow, oceanMid: p.oceanMid, oceanDeep: p.oceanDeep, ink: p.ink }); refreshAll() })
      palRow.append(card)
    }
  }
  renderPalettes()
  ctx.registerPaletteRefresh?.(renderPalettes)
  sPal.body.append(palRow, palEmpty)

  // ------------------------------------------------------------ Templates
  const sTpl = panel.addSection(section('Templates', { open: true }))
  const cards = el('div', 'ce-cards')
  const tplButtons = []
  for (const key of Object.keys(TEMPLATES)) {
    const t = TEMPLATES[key]
    const card = el('button', 'ce-card')
    card.type = 'button'
    const stops = t.palette?.rampStops?.map((s) => s.c) ?? []
    card.innerHTML = `<span class="ce-card-name">${(t.label ?? key).replace(/-/g, ' ')}</span><span class="ce-card-strip">${stops
      .map((c) => `<i style="background:${c}"></i>`)
      .join('')}</span>`
    card.addEventListener('click', () => {
      ctx.applyTemplate(t)
      tplButtons.forEach((b) => b.classList.remove('on'))
      card.classList.add('on')
      refreshAll()
      ctx.syncDark?.()
    })
    tplButtons.push(card)
    cards.append(card)
  }
  sTpl.body.append(cards)

  // --- user templates: saved looks with a thumbnail, apply / export / delete,
  // plus save-current and load-from-file. Applying never moves the view. ---
  // saved-look cards use a colour-strip VIGNETTE (like the built-in cards) and
  // are grouped into two categories: Simple (no shader) and Shaders.
  const userWrap = el('div')
  sTpl.body.append(userWrap)
  function makeCard(t) {
    // image-thumbnail card (a div so the action buttons nest validly)
    const card = el('div', 'ce-utpl-card')
    card.setAttribute('role', 'button')
    card.tabIndex = 0
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click() } })
    // thumbnail via DOM APIs (never innerHTML — thumb is user-supplied)
    const media = el(t.thumb ? 'img' : 'div', 'ce-utpl-img')
    if (t.thumb) { media.src = t.thumb; media.alt = '' }
    else if (t.strip?.length) media.style.background = `linear-gradient(90deg, ${t.strip.filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c)).join(',')})`
    const nm = el('span', 'ce-utpl-name')
    nm.textContent = t.name || 'Look'
    card.append(media, nm)
    card.insertAdjacentHTML('beforeend', '<button class="ce-utpl-x" title="Delete" type="button">✕</button><button class="ce-utpl-dl" title="Export .json" type="button">⭳</button>')
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ce-utpl-x, .ce-utpl-dl')) return
      ctx.applyUserTemplate(t); refreshAll(); ctx.syncDark?.()
    })
    card.querySelector('.ce-utpl-x').addEventListener('click', () => { ctx.deleteUserTemplate(t.id); renderUserTemplates() })
    card.querySelector('.ce-utpl-dl').addEventListener('click', () => ctx.exportUserTemplate(t.id))
    return card
  }
  function renderUserTemplates() {
    userWrap.replaceChildren()
    const all = ctx.getUserTemplates?.() ?? []
    const groups = [
      ['Simple', all.filter((t) => !t.shaders)],
      ['Shaders', all.filter((t) => t.shaders)],
    ]
    for (const [label, items] of groups) {
      if (!items.length) continue
      userWrap.append(el('div', 'ce-utpl-cat', label))
      const grid = el('div', 'ce-cards')
      for (const t of items) grid.append(makeCard(t))
      userWrap.append(grid)
    }
  }
  renderUserTemplates()

  const tplRow = el('div', 'ce-btn-row')
  const fileInput = el('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      const text = await f.text()
      if (!ctx.importTemplateText(text)) alert(`"${f.name}" is not a ShibuMap template file.`)
    }
    fileInput.value = ''
    renderUserTemplates()
  })
  // inline name field instead of prompt() — prompt is blocked in some embedded
  // contexts (a likely cause of "save doesn't work") and is off-brand
  const nameInput = el('input', 'ce-tpl-name')
  nameInput.type = 'text'
  nameInput.placeholder = 'Name this look…'
  nameInput.maxLength = 40
  const doSave = () => {
    if (!nameInput.value.trim()) { nameInput.focus(); return } // name required
    ctx.saveCurrentTemplate(nameInput.value)
    nameInput.value = ''
    renderUserTemplates()
  }
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } })
  tplRow.append(nameInput, button('Save', doSave, { accent: true }), button('Load…', () => fileInput.click(), { ghost: true }))
  sTpl.body.append(tplRow, fileInput)

  // Dark mode toggle lives ONLY in the top bar (bars.js moon button) now — this
  // was a second control on the exact same param, easy to leave out of sync.
  const monoRow = el('div', 'ce-btn-row')
  monoRow.append(
    button('Mono white', () => { ctx.applyMonochrome('white'); refreshAll(); ctx.syncDark?.() }),
    button('Mono dark', () => { ctx.applyMonochrome('dark'); refreshAll(); ctx.syncDark?.() })
  )
  const resetRow = el('div', 'ce-btn-row')
  resetRow.append(button('Reset look', () => { ctx.resetLook(); tplButtons.forEach((b) => b.classList.remove('on')); refreshAll(); ctx.syncDark?.() }, { ghost: true }))
  sTpl.body.append(monoRow, resetRow)

  return panel
}
