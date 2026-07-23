// Boutique in-app — « View templates » morphe l'app en vitrine (canvas dans un
// cadre, Yakushima verrouillée) + colonne Styles/Couleurs testable en live.
// Décisions Adrien (2026-07-23) : pas d'iframe, essais par appels directs,
// intégration = stores localStorage existants, commerce caché.
import './store.css'
import { paletteRecordFromShop, styleTemplateText, mergeShopPalettes, notOwnedStyles } from '../store-catalog.js'

const STORE_COMMERCE = false // futur paiement — aucun prix tant que false
const CATALOG_URL = '/templates/data.json'

export function buildStore(deps) {
  let open = false
  let snap = null
  let catalog = null // { palettes, templates } — fetché au premier enter
  const picked = { styles: new Map(), colors: new Map() } // slug → entry

  document.body.classList.add('store-ready')

  // ---- DOM (construit une fois, monté au premier enter) ------------------
  const col = document.createElement('aside')
  col.className = 'store-col'
  col.innerHTML = `
    <div class="store-head">
      <h2>ShibuMap<span style="color:#ff4d00">.</span> Templates</h2>
      <span class="store-sub">testez en live, cochez, intégrez</span>
      <button class="store-close" title="Fermer">✕</button>
    </div>
    <div class="store-body"></div>
    <div class="store-bar"><span class="n">0 sélectionné</span><button disabled>Valider</button></div>`
  const body = col.querySelector('.store-body')
  const barN = col.querySelector('.store-bar .n')
  const barBtn = col.querySelector('.store-bar button')

  const caption = document.createElement('div')
  caption.className = 'store-caption'
  caption.textContent = 'Projection en direct — Yakushima · Japon'

  const veil = document.createElement('div')
  veil.className = 'store-modal-veil'

  function pickCount() { return picked.styles.size + picked.colors.size }
  function syncBar() {
    const n = pickCount()
    barN.textContent = n > 1 ? `${n} sélectionnés` : `${n} sélectionné`
    barBtn.disabled = n === 0
  }

  function card(entry, kind) {
    const stops = kind === 'styles' ? (entry.strip ?? entry.look.rampStops.map((s) => s.c)) : entry.rampStops.map((s) => s.c)
    const sea = kind === 'styles'
      ? [entry.look.oceanShallow, entry.look.oceanMid, entry.look.oceanDeep]
      : [entry.oceanShallow, entry.oceanMid, entry.oceanDeep]
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'store-card'
    el.innerHTML = `
      <span class="strip">${stops.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="meta"><span class="nm">${entry.name}</span>
        <span class="sea">${sea.map((c) => `<i style="background:${c}"></i>`).join('')}</span></span>
      <span class="store-check">✓</span>`
    // clic carte = ESSAI LIVE (la vue s'adapte, fond compris)
    el.addEventListener('click', () => {
      col.querySelectorAll('.store-card.live').forEach((c) => c.classList.remove('live'))
      el.classList.add('live')
      if (kind === 'styles') deps.applyLook(entry.look)
      else deps.applyPalette({ rampStops: entry.rampStops, oceanShallow: entry.oceanShallow, oceanMid: entry.oceanMid, oceanDeep: entry.oceanDeep })
    })
    // coche = sélection (sans déclencher l'essai)
    el.querySelector('.store-check').addEventListener('click', (e) => {
      e.stopPropagation()
      const bag = picked[kind]
      if (bag.has(entry.slug)) { bag.delete(entry.slug); el.classList.remove('picked') }
      else { bag.set(entry.slug, entry); el.classList.add('picked') }
      syncBar()
    })
    return el
  }

  function sectionEl(title, entries, kind) {
    const sec = document.createElement('div')
    sec.className = 'store-sec'
    const head = document.createElement('button')
    head.type = 'button'
    head.className = 'store-sec-head'
    head.innerHTML = `<span>${title}</span><span class="count">${entries.length}</span><span class="chev">▾</span>`
    head.addEventListener('click', () => sec.classList.toggle('open'))
    const grid = document.createElement('div')
    grid.className = 'store-grid'
    for (const e of entries) grid.append(card(e, kind))
    sec.append(head, grid)
    return sec
  }

  function renderCatalog() {
    body.innerHTML = ''
    body.append(
      sectionEl('Styles', catalog.templates, 'styles'),
      sectionEl('Couleurs', catalog.palettes, 'colors'),
    )
  }

  // ---- validation → « Intégrer à ShibuMap » ------------------------------
  function openIntegrate() {
    const names = [...picked.styles.values(), ...picked.colors.values()].map((e) => e.name)
    veil.innerHTML = `
      <div class="store-modal">
        <h3>Intégrer à ShibuMap</h3>
        <p class="hint">Vos sélections rejoignent vos palettes et vos templates, prêtes à l'emploi.</p>
        <ul>${names.map((n) => `<li>${n}</li>`).join('')}</ul>
        <div class="row"><button class="ghost">Annuler</button><button class="go">Intégrer</button></div>
      </div>`
    veil.classList.add('on')
    veil.querySelector('.ghost').addEventListener('click', () => veil.classList.remove('on'))
    veil.querySelector('.go').addEventListener('click', () => {
      // Couleurs → store user-palettes (dédup par id shop_<slug>)
      const records = [...picked.colors.values()].map(paletteRecordFromShop)
      const { list } = mergeShopPalettes(deps.getUserPalettes(), records)
      deps.saveShopPalettes(list)
      deps.refreshPaletteRow()
      // Styles → même chemin que l'import de fichier .shibumap-template
      for (const e of notOwnedStyles(deps.getUserTemplates(), [...picked.styles.values()])) {
        deps.importTemplateText(styleTemplateText(e))
      }
      deps.refreshTemplateRow()
      veil.classList.remove('on')
      exit() // « ShibuMap reprend sa forme initiale »
    })
  }

  // ---- morph -------------------------------------------------------------
  function onMorphEnd(e) {
    if (e.target.id !== 'app') return
    document.body.classList.remove('store-anim')
    window.dispatchEvent(new Event('resize')) // renderer/composer → nouvelle box
  }
  // écoute unique (PAS dans enter() — sinon les listeners s'empilent)
  document.getElementById('app').addEventListener('transitionend', onMorphEnd)

  async function enter() {
    if (open) return
    open = true
    snap = deps.captureState()
    if (!col.isConnected) document.body.append(col, caption, veil)
    document.body.classList.add('store-anim', 'store-mode')
    deps.setLocked(true)
    deps.gotoShowcase().catch(() => {}) // vole vers Yakushima pendant le morph
    if (!catalog) {
      try { catalog = await (await fetch(CATALOG_URL)).json() } catch { catalog = { palettes: [], templates: [] } }
      renderCatalog()
    }
    syncBar()
  }

  async function exit() {
    if (!open) return
    open = false
    picked.styles.clear()
    picked.colors.clear()
    col.querySelectorAll('.picked, .live').forEach((c) => c.classList.remove('picked', 'live'))
    veil.classList.remove('on')
    document.body.classList.add('store-anim')
    document.body.classList.remove('store-mode')
    deps.setLocked(false)
    try { await deps.restoreState(snap) } catch {}
    snap = null
  }

  barBtn.addEventListener('click', openIntegrate)
  col.querySelector('.store-close').addEventListener('click', exit)
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') exit() })

  return { enter, exit, isOpen: () => open }
}
