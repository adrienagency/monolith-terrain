// Top bar (wordmark, globe, export, theme, hide-UI) and bottom bar
// (place search + GPX import) — the two fixed chrome pieces of the v28 UI.

import { el, iconButton, refreshAll } from './kit.js'
import { parseLatLon } from '../geo.js'
import { showToast } from './toast.js'

const I = {
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9z"/></svg>',
  export:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4m0 0l-4 4m4-4l4 4"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 13.5A8 8 0 0110.5 4 8 8 0 1020 13.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0112 5c7 0 10 7 10 7a17 17 0 01-3 4M6.6 6.6A16 16 0 002 12s3 7 10 7a9.9 9.9 0 004-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>',
  share:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7l7.3-4.3M8.3 13.3l7.3 4.3"/></svg>',
  route:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8 17.5C11 15 9 11 12 9.5S16.5 8 16.5 6.8"/></svg>',
  iso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6L12 3z"/><path d="M12 12l8-4.4M12 12L4 7.6M12 12v9"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.6 2.6 0 115 .8c-.5 1.4-2.1 1.7-2.1 3.2"/><circle cx="12" cy="16.8" r="0.4" fill="currentColor"/></svg>',
  keyboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16.5h8" stroke-linecap="round"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/></svg>',
  brush:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15.5 4.5 19.5 8.5 9 19c-1.5 1.5-4 1.5-5-.5s.5-3.5 2-5L15.5 4.5z"/><path d="M13.5 6.5l4 4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
}

// ---- Mode simple / avancé (UX P3) ----------------------------------------
// Par défaut la carte est PURE : les deux docks de panneaux sont masqués
// (body.ce-simple), la création passe par les espaces Studio / Race Studio.
// « Avancé » (topbar) ré-affiche tous les panneaux — choix persisté.
const ADV_KEY = 'shibumap-ui-advanced'
function isAdvanced() {
  try { return localStorage.getItem(ADV_KEY) === '1' } catch { return true }
}
export function initUiLevel() {
  document.body.classList.toggle('ce-simple', !isAdvanced())
}

export function buildTopBar(ctx) {
  const bar = el('div', 'ce-topbar ce-glassbox')

  const mark = el('span', 'ce-wordmark')
  mark.innerHTML = '<i>◍</i>ShibuMap'
  bar.append(mark)

  // stage chip — states the product stage AND opens the changelog: the stage
  // gets a receipt (everything that moved, dated). Hidden when APP_STAGE is ''.
  let alphaChip = null
  if (ctx.appStage) {
    alphaChip = el('button', 'ce-alpha')
    alphaChip.type = 'button'
    alphaChip.textContent = ctx.appStage.toUpperCase()
    alphaChip.setAttribute('data-tip', "ShibuMap is in alpha — click to see what's new.")
    alphaChip.addEventListener('click', () => ctx.toggleChangelog?.())
    bar.append(alphaChip)
  }

  const globeBtn = iconButton(I.globe, '', () => ctx.enterOrbit())
  globeBtn.setAttribute('data-tip', 'Pull all the way out and watch the planet slowly turn.')
  bar.append(globeBtn)

  // export earns a labelled pill — it is a primary action, not tucked-away chrome.
  // openExport is async (the export stack is lazy-loaded on first click): the
  // button goes busy until the modal is up, so a slow network can't double-open.
  const exportBtn = el('button', 'ce-pillbtn accent')
  exportBtn.type = 'button'
  exportBtn.innerHTML = `${I.export}<span>Export</span>`
  exportBtn.setAttribute('data-tip', 'Save what you see as an image, or record a video.')
  exportBtn.addEventListener('click', async () => {
    if (exportBtn.disabled) return
    exportBtn.disabled = true
    try {
      await ctx.openExport()
    } catch (err) {
      console.error('Export failed to open:', err)
    } finally {
      exportBtn.disabled = false
    }
  })
  bar.append(exportBtn)

  // one click copies a link that reproduces this exact look + location +
  // camera (navigator.share on mobile hands it to the OS share sheet
  // instead — "facilitate sharing", per the brief)
  const shareBtn = iconButton(I.share, '', async () => {
    if (shareBtn.disabled) return
    shareBtn.disabled = true
    try {
      const res = await ctx.share()
      if (res?.cancelled) {
        // user backed out of the OS share sheet — no feedback needed
      } else if (res?.ok) {
        // three honest cases: track published in the link / publish failed so
        // the link is look-only / no track loaded at all (nothing to say)
        const trackNote = res.hasTrack ? (res.published ? ' — course included' : ' — course couldn’t be published') : ''
        showToast((res.copied ? 'Link copied' : 'Shared') + trackNote)
      } else {
        showToast('Could not create the link')
      }
    } catch (err) {
      console.error('Share failed:', err)
      showToast('Could not create the link')
    } finally {
      shareBtn.disabled = false
    }
  })
  shareBtn.setAttribute('data-tip', 'Copy a link to this exact view — look, location and camera. GPX tracks are never included.')
  bar.append(shareBtn)

  const dark = iconButton(I.moon, '', () => {
    ctx.setDarkMode(!ctx.params.darkMode)
    syncDark()
    refreshAll() // resyncs dark-mode-gated controls (e.g. Map → Contour weight)
  })
  dark.setAttribute('data-tip', "Switch the map's look between light and dark — palette, contours, seas, fog.")
  const syncDark = () => {
    dark.innerHTML = ctx.params.darkMode ? I.sun : I.moon
    dark.classList.toggle('on', !!ctx.params.darkMode)
  }
  syncDark()
  bar.append(dark)

  const helpBtn = iconButton(I.help, '', () => ctx.startTutorial?.())
  helpBtn.setAttribute('data-tip', 'A one-minute tour of everything on this screen.')
  bar.append(helpBtn)

  const shortcutsBtn = iconButton(I.keyboard, '', () => ctx.toggleShortcuts?.())
  shortcutsBtn.setAttribute('data-tip', 'Keyboard shortcuts — camera, layers, undo/redo.')
  bar.append(shortcutsBtn)

  const hideBtn = iconButton(I.eyeOff, '', () => setNoUi(true))
  hideBtn.setAttribute('data-tip', 'Hide every panel — only a small eye button stays.')
  bar.append(hideBtn)

  // interrupteur Mode avancé (UX P3) — ré-affiche les docks de panneaux
  const advBtn = el('button', 'ce-pillbtn ce-advbtn')
  advBtn.type = 'button'
  advBtn.innerHTML = `${I.sliders}<span>Avancé</span>`
  advBtn.setAttribute('data-tip', 'Mode avancé — tous les panneaux de réglage (création, carte, effets, caméra…).')
  const syncAdv = () => advBtn.classList.toggle('on', isAdvanced())
  advBtn.addEventListener('click', () => {
    const adv = !isAdvanced()
    try { localStorage.setItem(ADV_KEY, adv ? '1' : '0') } catch {}
    initUiLevel()
    syncAdv()
  })
  syncAdv()

  // the single button that survives no-UI mode
  const eye = el('button', 'ce-eye ce-glassbox')
  eye.type = 'button'
  eye.title = 'Show interface'
  eye.innerHTML = I.eye
  eye.addEventListener('click', () => setNoUi(false))

  function setNoUi(v) {
    document.body.classList.toggle('ce-noui', v)
  }

  // final order (Adrien): wordmark · globe DARK │ share help shortcuts hide │
  // EXPORT far right. appendChild MOVES the already-built nodes, so this just
  // reorders them; only the two discrete vertical separators are new.
  const sep = () => el('span', 'ce-topbar-sep')
  bar.append(globeBtn, dark, sep(), shareBtn, helpBtn, shortcutsBtn, hideBtn, advBtn, sep(), exportBtn)

  document.body.append(bar, eye)
  return { root: bar, syncDark }
}

// fixed bottom-right: one click to the isometric museum view — the whole
// block on its plate with the cartouche text readable around it
export function buildIsoButton(ctx) {
  const btn = el('button', 'ce-isobtn ce-glassbox')
  btn.type = 'button'
  btn.innerHTML = I.iso
  // petit numéro en haut à droite de l'icône : quelle vue on regarde (Adrien)
  const badge = el('span', 'ce-iso-badge')
  badge.style.display = 'none'
  btn.append(badge)
  btn.setAttribute('data-tip', 'Isometric view — click to cycle: four angles, top-down (north), ground level.')
  btn.addEventListener('click', () => ctx.flyIso())
  document.body.append(btn)
  return {
    root: btn,
    setVisible: (v) => btn.classList.toggle('off', !v),
    setBadge: (t) => { badge.textContent = t ?? ''; badge.style.display = t ? '' : 'none' },
  }
}

// Cinematic shortcut — the iso button's twin, one slot left: random looping
// camera moves around the socle. Lit (accent) while running.
export function buildCineButton(ctx) {
  const btn = el('button', 'ce-isobtn ce-cinebtn ce-glassbox')
  btn.type = 'button'
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10.5 21 8v8l-6-2.5"/></svg>'
  btn.setAttribute('data-tip', 'Cinematic view — random camera moves around the block. Click again to stop.')
  btn.addEventListener('click', () => btn.classList.toggle('on', !!ctx.toggle()))
  document.body.append(btn)
  return { root: btn, setVisible: (v) => btn.classList.toggle('off', !v) }
}

// bottom-LEFT twin of the iso/cine corner (Adrien) : three cartography
// controls. Left→right: aerial-photo toggle (green tick when active), return to
// base cartography, and a full shuffle that rebats every look option at once.
const MC = {
  aerial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.6"/><path d="M3 16l5-4 4 3 3-2.5 6 4.5"/></svg>',
  base: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 4-6 2.4v13.2L9 17l6 2.4 6-2.4V3.6L15 6 9 3.6Z"/><path d="M9 3.6V17M15 6v13.4"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5 10 17.5 19 6.5"/></svg>',
}
export function buildMapCorner(ctx) {
  const mk = (icon, tip, extraCls = '') => {
    const b = el('button', `ce-mapbtn ce-glassbox ${extraCls}`.trim())
    b.type = 'button'
    b.innerHTML = icon
    b.setAttribute('data-tip', tip)
    document.body.append(b)
    return b
  }
  // dédoublonnage (Adrien) : seul le toggle AÉRIEN reste — « base » et
  // « shuffle » doublonnaient « Réinitialiser la carte » (Templates) et
  // « Look aléatoire » (Création)
  const aerial = mk(MC.aerial, 'Photo aérienne — cliquer pour basculer (là où l’imagerie existe).', 'ce-mapbtn-aerial')
  const check = el('span', 'ce-mapbtn-check')
  check.innerHTML = MC.check
  aerial.append(check)

  aerial.addEventListener('click', () => ctx.toggleAerial())

  return {
    setAerialActive: (v) => aerial.classList.toggle('on', !!v),
    setVisible: (v) => { aerial.classList.toggle('off', !v) },
  }
}

// Barre contextuelle flottante (UX P3) — les deux portes de création, toujours
// à portée sur la carte nue. Visible UNIQUEMENT en mode simple ; les modes
// morphés (store/studio/atelier), noui et embed la masquent en CSS.
export function buildQuickBar(ctx) {
  const bar = el('div', 'ce-quickbar ce-glassbox')
  const mk = (icon, label, tip, onClick, accent) => {
    const b = el('button', 'ce-pillbtn' + (accent ? ' accent' : ''))
    b.type = 'button'
    b.innerHTML = `${icon}<span>${label}</span>`
    b.setAttribute('data-tip', tip)
    b.addEventListener('click', onClick)
    return b
  }
  bar.append(
    mk(I.brush, 'Habiller ma carte', 'Studio — palettes, templates et ciels appliqués en direct sur votre carte.', () => ctx.openAtelier(), true),
    mk(I.flag, 'Ma course', 'Race Studio — votre parcours GPX en carte de course (points de passage, transports, partage).', () => ctx.openStudio())
  )
  document.body.append(bar)
  return { root: bar }
}

export function buildBottomBar(ctx) {
  const bar = el('div', 'ce-bottombar ce-glassbox')

  const search = el('div', 'ce-search')
  search.innerHTML = I.search
  const input = el('input')
  input.type = 'text'
  input.placeholder = 'Search a place, or paste “lat, lon”'
  input.spellcheck = false
  search.append(input)

  const go = async () => {
    const text = input.value.trim()
    if (!text) return
    input.blur()
    const ok = parseLatLon(text) ? await ctx.goto.go(text) : await ctx.goto.search(text)
    if (ok) input.value = ''
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go()
    e.stopPropagation() // keep app-level shortcuts out of the field
  })

  const gpx = el('button', 'ce-pillbtn')
  gpx.type = 'button'
  gpx.innerHTML = `${I.route}<span>GPX</span>`
  gpx.setAttribute('data-tip', 'Import a GPX track and drape it on the relief.')
  gpx.addEventListener('click', () => ctx.openGpx())

  bar.append(search, gpx)
  document.body.append(bar)
  return { root: bar, input }
}

function extLink(href, text, cls) {
  const a = el('a', cls)
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.textContent = text
  return a
}

// bottom-left: ONE line, ONE corner, ONE size — the studio credit plus every
// legally-required attribution. Adrien Agency + OpenStreetMap (ODbL, the
// fine-zoom z9–z12 coastline) are static; GeoNames (CC BY 4.0, gated to when
// place labels are actually showing) and the OSM loading status are appended
// live by main.js via setExtra() so nothing duplicates a second corner/size.
// Deliberately understated so it never competes with the relief, and clear of
// the isometric-view button (bottom-right).
export function buildCredits() {
  const wrap = el('div', 'ce-credits')
  wrap.append(
    extLink('https://adrienagency.com', '© Adrien Agency', 'ce-credit-link'),
    el('span', 'ce-credit-dot', '·'),
    extLink('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors', 'ce-credit-link')
  )
  const extraDot = el('span', 'ce-credit-dot', '·')
  extraDot.style.display = 'none'
  const extra = el('span', 'ce-credit-extra')
  wrap.append(extraDot, extra)
  document.body.append(wrap)

  return {
    root: wrap,
    setExtra(text) {
      extra.textContent = text || ''
      extraDot.style.display = text ? '' : 'none'
    },
  }
}
