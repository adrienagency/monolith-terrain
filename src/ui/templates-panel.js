// BIBLIOTHÈQUE (réorg Adrien) — seule habitante du rail droit en mode Studio.
// Deux niveaux :
//  1. un bouton DIRECT vers la boutique de templates (+ Réinitialiser)
//  2. « Ma bibliothèque » :
//     · Couleurs  → Mes palettes / Créer une palette (rampe, océans, encre —
//       le contenu vient de create-panel via ctx.paletteCreation)
//     · Templates → Mes templates (chargés + téléchargés) / Créer un template
// Les rampes built-in (Iceland…) et les générateurs aléatoires sont RETIRÉS.

import { el, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>'

export function buildTemplatesPanel(ctx) {
  const panel = new Panel({
    title: 'Bibliothèque',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'Vos palettes et templates — et la boutique pour en ramener d’autres.',
  })

  // ------------------------------------------------- niveau 1 : la boutique
  const storeWrap = el('div', 'ce-btn-row')
  const storeBtn = button('Boutique de templates', () => ctx.openStore?.(), { accent: true })
  storeBtn.setAttribute('data-tip', 'Parcourez styles et couleurs, essayez en direct, ramenez ce qui vous plaît.')
  storeWrap.append(storeBtn)
  panel.body.append(storeWrap)

  const resetWrap = el('div', 'ce-btn-row')
  const resetBtn = button(
    'Réinitialiser la carte',
    () => {
      if (ctx.resetAll) {
        ctx.resetAll()
        refreshAll()
        ctx.syncDark?.()
      }
    },
    { ghost: true }
  )
  resetBtn.setAttribute('data-tip', 'Remet chaque réglage de look à sa valeur d’origine (le lieu ne bouge pas).')
  resetWrap.append(resetBtn)
  panel.body.append(resetWrap)

  // --------------------------------------- niveau 2 : Ma bibliothèque › Couleurs
  const sPal = panel.addSection(section('Couleurs', { open: true }))
  sPal.body.append(el('div', 'ce-fx-head', 'Mes palettes'))
  const palRow = el('div', 'ce-pal-row')
  const palEmpty = el('div', 'ce-gpx-layers-empty', 'Créez une palette ci-dessous, Enregistrez-la — elle arrive ici.')
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

  sPal.body.append(el('div', 'ce-fx-head', 'Créer une palette'))
  const createHost = el('div')
  sPal.body.append(createHost)
  ctx.paletteCreation?.(createHost) // rampe + océans + encre + Enregistrer (create-panel)

  // -------------------------------------- niveau 2 : Ma bibliothèque › Templates
  const sTpl = panel.addSection(section('Templates'))
  sTpl.body.append(el('div', 'ce-fx-head', 'Mes templates'))

  // saved looks with a thumbnail, apply / export / delete. Applying never moves
  // the view. Cards use a colour-strip vignette, grouped Simple / Shaders.
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
    card.insertAdjacentHTML('beforeend', '<button class="ce-utpl-x" title="Supprimer" type="button">✕</button><button class="ce-utpl-dl" title="Exporter .json" type="button">⭳</button>')
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ce-utpl-x, .ce-utpl-dl')) return
      ctx.applyUserTemplate(t); refreshAll(); ctx.syncDark?.()
    })
    card.querySelector('.ce-utpl-x').addEventListener('click', () => { ctx.deleteUserTemplate(t.id); renderUserTemplates() })
    card.querySelector('.ce-utpl-dl').addEventListener('click', () => ctx.exportUserTemplate(t.id))
    return card
  }
  const tplEmpty = el('div', 'ce-gpx-layers-empty', 'Chargez un template, ou créez-en un ci-dessous — ils se rangent ici.')
  sTpl.body.append(tplEmpty)
  function renderUserTemplates() {
    userWrap.replaceChildren()
    const all = ctx.getUserTemplates?.() ?? []
    tplEmpty.classList.toggle('hidden', all.length > 0)
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
  // la boutique (store.js) intègre des styles → main.js nous re-rend ici
  ctx.registerUserTplRefresh?.(renderUserTemplates)

  const fileInput = el('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      const text = await f.text()
      if (!ctx.importTemplateText(text)) alert(`« ${f.name} » n’est pas un template ShibuMap.`)
    }
    fileInput.value = ''
    renderUserTemplates()
  })
  const loadRow = el('div', 'ce-btn-row')
  loadRow.append(button('Charger un template…', () => fileInput.click(), { ghost: true }))
  sTpl.body.append(loadRow, fileInput)

  const monoRow = el('div', 'ce-btn-row')
  monoRow.append(
    button('Mono clair', () => { ctx.applyMonochrome('white'); refreshAll(); ctx.syncDark?.() }),
    button('Mono sombre', () => { ctx.applyMonochrome('dark'); refreshAll(); ctx.syncDark?.() })
  )
  sTpl.body.append(monoRow)

  sTpl.body.append(el('div', 'ce-fx-head', 'Créer un template'))
  // inline name field instead of prompt() — prompt is blocked in some embedded
  // contexts and is off-brand
  const nameInput = el('input', 'ce-tpl-name')
  nameInput.type = 'text'
  nameInput.placeholder = 'Nommer ce look…'
  nameInput.maxLength = 40
  const doSave = () => {
    if (!nameInput.value.trim()) { nameInput.focus(); return } // name required
    ctx.saveCurrentTemplate(nameInput.value)
    nameInput.value = ''
    renderUserTemplates()
  }
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } })
  const createRow = el('div', 'ce-btn-row')
  createRow.append(nameInput, button('Enregistrer', doSave, { accent: true }))
  sTpl.body.append(createRow)

  return panel
}
