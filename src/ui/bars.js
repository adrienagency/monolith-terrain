// Top bar (wordmark, globe, export, theme, hide-UI) and bottom bar
// (place search + GPX import) — the two fixed chrome pieces of the v28 UI.

import { el, iconButton } from './kit.js'
import { parseLatLon } from '../geo.js'

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
  route:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8 17.5C11 15 9 11 12 9.5S16.5 8 16.5 6.8"/></svg>',
}

export function buildTopBar(ctx) {
  const bar = el('div', 'ce-topbar ce-glassbox')

  const mark = el('span', 'ce-wordmark')
  mark.innerHTML = '<i>◍</i>Clean Earth'
  bar.append(mark)

  const globeBtn = iconButton(I.globe, '', () => ctx.enterOrbit())
  globeBtn.setAttribute('data-tip', 'Pull all the way out and watch the planet slowly turn.')
  bar.append(globeBtn)

  // export earns a labelled pill — it is a primary action, not tucked-away chrome
  const exportBtn = el('button', 'ce-pillbtn accent')
  exportBtn.type = 'button'
  exportBtn.innerHTML = `${I.export}<span>Export</span>`
  exportBtn.setAttribute('data-tip', 'Save what you see as an image, or record a video.')
  exportBtn.addEventListener('click', () => ctx.openExport())
  bar.append(exportBtn)

  const dark = iconButton(I.moon, '', () => {
    ctx.setDarkMode(!ctx.params.darkMode)
    syncDark()
  })
  dark.setAttribute('data-tip', 'Switch the interface between light and dark.')
  const syncDark = () => {
    dark.innerHTML = ctx.params.darkMode ? I.sun : I.moon
    dark.classList.toggle('on', !!ctx.params.darkMode)
  }
  syncDark()
  bar.append(dark)

  const hideBtn = iconButton(I.eyeOff, '', () => setNoUi(true))
  hideBtn.setAttribute('data-tip', 'Hide every panel — only a small eye button stays.')
  bar.append(hideBtn)

  // the single button that survives no-UI mode
  const eye = el('button', 'ce-eye ce-glassbox')
  eye.type = 'button'
  eye.title = 'Show interface'
  eye.innerHTML = I.eye
  eye.addEventListener('click', () => setNoUi(false))

  function setNoUi(v) {
    document.body.classList.toggle('ce-noui', v)
  }

  document.body.append(bar, eye)
  return { root: bar, syncDark }
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
