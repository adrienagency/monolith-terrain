// Guided tour — dims the screen and spotlights one UI zone at a time with a
// single-sentence card. The → arrow advances, Skip (or Esc) closes. It runs
// by itself on the very first visit, and replays anytime from the "?" button
// in the top bar. Pure DOM: no dependency on the 3D world.

import { el } from './kit.js'

const DONE_KEY = 'shibumap-tour-done'

function findPanel(title) {
  for (const p of document.querySelectorAll('.ce-panel')) {
    const t = p.querySelector('.ce-panel-title')?.textContent.trim().toLowerCase()
    if (t && t.includes(title)) return p
  }
  return null
}

// steps resolve their targets lazily — panels may not exist at module load
function buildSteps() {
  const topIcons = document.querySelectorAll('.ce-topbar .ce-iconbtn, .ce-topbar button')
  return [
    {
      target: () => document.querySelector('.ce-bottombar'),
      text: 'Search any place on Earth — or paste “lat, lon” — and watch it rise as a relief model.',
    },
    {
      target: () => null, // a concept, not a widget: plain centered card
      text: 'Scroll to zoom. Pull back and the map becomes an isometric 3D museum piece — the whole block on its display plate, cartouche included. Dive in for ever finer terrain.',
    },
    {
      target: () => findPanel('explore'),
      text: 'Explore — fly to hand-picked landmarks on every continent.',
    },
    {
      target: () => findPanel('scan'),
      text: 'Scan — sweep radar and elevation effects across the relief.',
    },
    {
      target: () => findPanel('create'),
      text: 'Create — templates, colors, clouds, water and light: the entire look of your map.',
    },
    {
      target: () => findPanel('camera'),
      text: 'Camera — lens, focus and motion, plus performance settings.',
    },
    {
      target: () => document.querySelector('.ce-isobtn'),
      text: 'One click here frames the isometric view — block, plate and cartouche.',
    },
    {
      target: () => document.querySelector('.ce-topbar .ce-pillbtn'),
      text: 'Export what you see as an image, or record a video of your map.',
    },
    {
      target: () => topIcons[0] ?? document.querySelector('.ce-topbar'),
      text: 'Globe — pull all the way out and watch the living planet slowly turn.',
    },
  ]
}

let active = null

export function startTutorial() {
  if (active) return
  const steps = buildSteps().filter((s) => s.text)
  let i = 0

  const overlay = el('div', 'ce-tour')
  const spot = el('div', 'ce-tour-spot')
  const card = el('div', 'ce-tour-card ce-glassbox')
  const text = el('div', 'ce-tour-text')
  const foot = el('div', 'ce-tour-foot')
  const dots = el('div', 'ce-tour-dots')
  const skip = el('button', 'ce-tour-skip')
  skip.type = 'button'
  skip.textContent = 'Skip'
  const next = el('button', 'ce-tour-next')
  next.type = 'button'
  foot.append(skip, dots, next)
  card.append(text, foot)
  overlay.append(spot, card)
  document.body.append(overlay)

  const close = () => {
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {}
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', place)
    overlay.remove()
    active = null
  }
  const onKey = (e) => {
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowRight' || e.key === 'Enter') advance()
  }
  const advance = () => {
    i += 1
    if (i >= steps.length) close()
    else place()
  }

  function place() {
    const step = steps[i]
    const t = step.target()
    const r = t?.getBoundingClientRect()
    const seen = r && r.width > 4 && r.height > 4
    if (seen) {
      const pad = 8
      spot.style.display = 'block'
      spot.style.left = r.left - pad + 'px'
      spot.style.top = r.top - pad + 'px'
      spot.style.width = r.width + pad * 2 + 'px'
      spot.style.height = r.height + pad * 2 + 'px'
      overlay.classList.remove('dim')
    } else {
      spot.style.display = 'none'
      overlay.classList.add('dim') // no spotlight hole — dim the whole scene
    }
    text.textContent = step.text
    dots.innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')
    next.innerHTML = i === steps.length - 1 ? 'Done' : '&rarr;'

    // card near the spotlight, clamped on screen; centered when conceptual
    const cw = 340
    card.style.width = cw + 'px'
    if (seen) {
      const below = r.bottom + 16 + 150 < window.innerHeight
      const top = below ? r.bottom + 16 : Math.max(16, r.top - 16 - card.offsetHeight)
      let left = r.left + r.width / 2 - cw / 2
      left = Math.min(Math.max(16, left), window.innerWidth - cw - 16)
      card.style.left = left + 'px'
      card.style.top = top + 'px'
      card.style.transform = 'none'
    } else {
      card.style.left = '50%'
      card.style.top = '50%'
      card.style.transform = 'translate(-50%, -50%)'
    }
  }

  skip.addEventListener('click', close)
  next.addEventListener('click', advance)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', place)
  active = { close }
  place()
}

// first visit only — called once the app settles after boot
export function maybeStartTutorial() {
  try {
    if (localStorage.getItem(DONE_KEY)) return
  } catch {}
  startTutorial()
}
