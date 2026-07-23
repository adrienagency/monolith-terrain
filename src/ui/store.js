// Boutique in-app — « View templates » morphe l'app en vitrine (canvas dans un
// cadre pleine largeur, zone vitrine verrouillée — Nā Pali) + colonne Styles/Couleurs
// testable en live. Décisions Adrien (2026-07-23) : pas d'iframe, essais par
// appels directs, intégration = stores localStorage existants, commerce caché.
// Le rethémage (une palette recolore toute la boutique), le hover des bandes
// et le design des cartes sont repris de l'ancienne landing /templates.
import './store.css'
import { paletteRecordFromShop, styleTemplateText, mergeShopPalettes, notOwnedStyles } from '../store-catalog.js'

const STORE_COMMERCE = false // futur paiement — aucun prix tant que false
const CATALOG_URL = '/templates/data.json'
const ASSETS_URL = '/templates/assets/'
// exigences de la vitrine : jamais de bokeh ni de bloom pendant les essais
// (le look INTÉGRÉ garde ses réglages d'origine — voir styleTemplateText)
const STAGE_OVERRIDES = { bokehEnabled: false, bokehScale: 0, bloomEnabled: false }

// ------------------------------------------------------------ couleur utils
// (repris de la landing — voir docs/superpowers/plans/2026-07-23-store-mode.md)
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
// chroma réel : la saturation HSL ment près du blanc/noir — pondérée par la
// distance à ces extrêmes pour teinter le fond juste ce qu'il faut
const chroma = (c) => c.s * (1 - Math.abs(2 * c.l - 100) / 100)
// le stop le plus « vivant » d'une rampe (chroma pénalisé aux extrêmes de lum)
function accentStop(stops) {
  let best = null
  let score = -1
  for (const s of stops) {
    const c = hexToHsl(s.c)
    const sc = c.s * (1 - Math.abs(c.l - 50) / 65)
    if (sc > score) { score = sc; best = c }
  }
  return best
}
const avgLum = (stops) => stops.reduce((a, s) => a + hexToHsl(s.c).l, 0) / stops.length

// ------------------------------------------------- rethémage de la boutique
// Dérive les variables --st-* depuis la palette cliquée : fond = stop le plus
// clair désaturé, encre = stop le plus sombre, accent = stop le plus saturé.
// Rampes très sombres → thème nuit (mêmes règles, valeurs inversées).
function retheme(rampStops) {
  const byL = rampStops.map((s) => hexToHsl(s.c)).sort((a, b) => a.l - b.l)
  const dark = byL[0]
  const light = byL[byL.length - 1]
  const acc = accentStop(rampStops)
  const night = (byL[0].l + byL[1].l) / 2 < 20

  const root = document.documentElement.style
  if (night) {
    document.documentElement.dataset.storeTheme = 'dark'
    const sBg = clamp(chroma(dark) * 4, 2, 34)
    root.setProperty('--st-bg', hsl(dark.h, sBg, 10))
    root.setProperty('--st-bg-deep', hsl(dark.h, sBg, 7.5))
    root.setProperty('--st-ink', hsl(light.h, clamp(chroma(light) * 3, 0, 24), 92))
    root.setProperty('--st-accent', hsl(acc.h, clamp(acc.s, 45, 80), clamp(acc.l, 58, 72)))
  } else {
    document.documentElement.dataset.storeTheme = 'light'
    const sBg = clamp(chroma(light) * 4, 2, 30)
    root.setProperty('--st-bg', hsl(light.h, sBg, 96.5))
    root.setProperty('--st-bg-deep', hsl(light.h, sBg, 93))
    root.setProperty('--st-ink', hsl(dark.h, clamp(dark.s, 0, 32), 13))
    root.setProperty('--st-accent', hsl(acc.h, clamp(acc.s, 48, 88), clamp(acc.l, 30, 48)))
  }
}

const FAMILIES = [
  ['tous', 'Tous'],
  ['chauds', 'Chauds'],
  ['froids', 'Froids'],
  ['terre', 'Terre'],
  ['glace', 'Glace'],
  ['vegetal', 'Végétal'],
  ['mono', 'Mono'],
]
const SORTS = {
  hue: (a, b) => accentStop(a.rampStops).h - accentStop(b.rampStops).h,
  lum: (a, b) => avgLum(b.rampStops) - avgLum(a.rampStops),
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
}

export function buildStore(deps) {
  let open = false
  let snap = null
  let catalog = null // { palettes, templates } — fetché au premier enter
  let activeSlug = null // carte appliquée (survit aux re-rendus filtre/tri)
  const picked = { styles: new Map(), colors: new Map() } // slug → entry
  const filter = { family: 'tous', sort: 'hue', q: '' }

  document.body.classList.add('store-ready')

  // ---- DOM (construit une fois, monté au premier enter) ------------------
  const col = document.createElement('aside')
  col.className = 'store-col'
  col.innerHTML = `
    <div class="store-head">
      <h2>ShibuMap<span class="dot">.</span> <em>Templates</em></h2>
      <span class="store-sub">testez en live, cochez, intégrez</span>
      <button class="store-close" title="Fermer">✕</button>
    </div>
    <div class="store-body"></div>
    <div class="store-bar"><span class="n">0 sélectionné</span><button class="store-quit ghost">Quitter</button><button class="store-validate" disabled>Valider</button></div>`
  const body = col.querySelector('.store-body')
  const barN = col.querySelector('.store-bar .n')
  const barBtn = col.querySelector('.store-validate')
  const quitBtn = col.querySelector('.store-quit')

  const caption = document.createElement('div')
  caption.className = 'store-caption'
  caption.innerHTML = '<b>Projection en direct</b> — Nā Pali · Hawaï'

  const veil = document.createElement('div')
  veil.className = 'store-modal-veil'

  function pickCount() { return picked.styles.size + picked.colors.size }
  function syncBar() {
    const n = pickCount()
    barN.textContent = n > 1 ? `${n} sélectionnés` : `${n} sélectionné`
    barBtn.disabled = n === 0
  }

  // ---- cartes (design landing : verre dépoli, bandes qui s'étirent) ------
  function card(entry, kind) {
    const stops = kind === 'styles' ? (entry.strip ?? entry.look.rampStops.map((s) => s.c)) : entry.rampStops.map((s) => s.c)
    const sea = kind === 'styles'
      ? [entry.look.oceanShallow, entry.look.oceanMid, entry.look.oceanDeep]
      : [entry.oceanShallow, entry.oceanMid, entry.oceanDeep]
    const el = document.createElement('div')
    el.className = 'store-card'
    if (entry.slug === activeSlug) el.classList.add('live')
    if (picked[kind].has(entry.slug)) el.classList.add('picked')
    // vignette : bandes dures pour une palette, dégradé continu pour un look
    const strip = kind === 'styles'
      ? `<i class="ramp" style="background:linear-gradient(90deg, ${entry.look.rampStops.map((s) => `${s.c} ${(s.p * 100).toFixed(0)}%`).join(', ')})"></i>`
      : stops.map((c) => `<i style="background:${c}"></i>`).join('')
    el.innerHTML = `
      <span class="strip" aria-hidden="true">${strip}</span>
      <span class="meta"><span class="nm">${entry.name}</span>
        <span class="fam">${kind === 'styles' ? 'look complet' : entry.family}</span></span>
      <span class="foot">
        <span class="sea" title="Océan : haut-fond, large, abysse">${sea.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <a class="store-dl" download href="${ASSETS_URL}${entry.slug}.shibumap-template.json">JSON&nbsp;↓</a>
        <span class="store-check">✓</span>
      </span>`
    // clic carte = ESSAI LIVE : la vue s'adapte, et la boutique se rethème
    el.addEventListener('click', () => {
      activeSlug = entry.slug
      col.querySelectorAll('.store-card.live').forEach((c) => c.classList.remove('live'))
      el.classList.add('live')
      if (kind === 'styles') deps.applyLook({ ...entry.look, ...STAGE_OVERRIDES })
      else deps.applyPalette({ rampStops: entry.rampStops, oceanShallow: entry.oceanShallow, oceanMid: entry.oceanMid, oceanDeep: entry.oceanDeep })
      retheme(kind === 'styles' ? entry.look.rampStops : entry.rampStops)
    })
    // télécharger le JSON ne doit pas appliquer la carte
    el.querySelector('.store-dl').addEventListener('click', (e) => e.stopPropagation())
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

  // ---- sections + outils -------------------------------------------------
  let palGrid = null
  let palCount = null
  let palSec = null

  function renderPalGrid() {
    if (!palGrid) return
    const shown = catalog.palettes
      .filter((p) => filter.family === 'tous' || p.family === filter.family)
      .filter((p) => !filter.q || p.name.toLowerCase().includes(filter.q))
      .sort(SORTS[filter.sort])
    palGrid.replaceChildren(...shown.map((p) => card(p, 'colors')))
    palCount.textContent = shown.length === 0
      ? 'Aucune palette ne correspond'
      : `${shown.length} palette${shown.length > 1 ? 's' : ''}`
  }

  function sectionEl(title, count) {
    const sec = document.createElement('div')
    sec.className = 'store-sec'
    const head = document.createElement('button')
    head.type = 'button'
    head.className = 'store-sec-head'
    head.innerHTML = `<span>${title}</span><span class="count">${count}</span><span class="chev">▾</span>`
    head.addEventListener('click', () => sec.classList.toggle('open'))
    sec.append(head)
    return sec
  }

  function renderCatalog() {
    body.innerHTML = ''
    // Styles (looks complets) — 4 visibles, chevron pour tout voir
    const secS = sectionEl('Styles', catalog.templates.length)
    const gridS = document.createElement('div')
    gridS.className = 'store-grid'
    gridS.append(...catalog.templates.map((t) => card(t, 'styles')))
    secS.append(gridS)
    // Couleurs — filtres famille / tri / recherche repris de la landing
    palSec = sectionEl('Couleurs', catalog.palettes.length)
    const tools = document.createElement('div')
    tools.className = 'store-tools'
    const chips = document.createElement('div')
    chips.className = 'store-chips'
    for (const [key, label] of FAMILIES) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'store-chip'
      b.textContent = label
      b.setAttribute('aria-pressed', String(key === filter.family))
      b.addEventListener('click', () => {
        filter.family = key
        chips.querySelectorAll('.store-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'))
        b.setAttribute('aria-pressed', 'true')
        palSec.classList.add('open') // filtrer sous-entend « montre-moi tout »
        renderPalGrid()
      })
      chips.append(b)
    }
    const toolrow = document.createElement('div')
    toolrow.className = 'store-toolrow'
    const sort = document.createElement('select')
    sort.innerHTML = '<option value="hue">Teinte</option><option value="lum">Luminosité</option><option value="name">Nom</option>'
    sort.addEventListener('change', () => { filter.sort = sort.value; renderPalGrid() })
    const search = document.createElement('input')
    search.type = 'search'
    search.placeholder = 'Chercher une palette…'
    search.addEventListener('input', () => {
      filter.q = search.value.trim().toLowerCase()
      palSec.classList.add('open')
      renderPalGrid()
    })
    toolrow.append(sort, search)
    tools.append(chips, toolrow)
    palCount = document.createElement('p')
    palCount.className = 'store-count'
    palGrid = document.createElement('div')
    palGrid.className = 'store-grid'
    palSec.append(tools, palCount, palGrid)
    body.append(secS, palSec)
    renderPalGrid()
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
  let settleT = 0
  function settleMorph() {
    clearTimeout(settleT)
    document.body.classList.remove('store-anim')
    window.dispatchEvent(new Event('resize')) // renderer/composer → nouvelle box
  }
  function onMorphEnd(e) {
    if (e.target.id !== 'app') return
    settleMorph()
  }
  // écoute unique (PAS dans enter() — sinon les listeners s'empilent).
  // Fallback timeout : transitionend peut ne jamais venir (onglet caché →
  // zéro frame → transitions gelées) — le morph se « pose » quoi qu'il arrive.
  document.getElementById('app').addEventListener('transitionend', onMorphEnd)
  function armSettle() {
    clearTimeout(settleT)
    settleT = setTimeout(settleMorph, 750) // .6s de transition + marge
  }

  async function enter() {
    if (open) return
    open = true
    snap = deps.captureState()
    if (!col.isConnected) document.body.append(col, caption, veil)
    document.body.classList.add('store-anim', 'store-mode')
    armSettle()
    deps.setLocked(true)
    deps.gotoShowcase().catch(() => {}) // vole vers la zone vitrine pendant le morph
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
    activeSlug = null
    col.querySelectorAll('.picked, .live').forEach((c) => c.classList.remove('picked', 'live'))
    veil.classList.remove('on')
    document.body.classList.add('store-anim')
    document.body.classList.remove('store-mode')
    armSettle()
    deps.setLocked(false)
    try { await deps.restoreState(snap) } catch {}
    snap = null
  }

  barBtn.addEventListener('click', openIntegrate)
  quitBtn.addEventListener('click', exit) // sortir sans rien sélectionner
  col.querySelector('.store-close').addEventListener('click', exit)
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') exit() })

  return { enter, exit, isOpen: () => open }
}
