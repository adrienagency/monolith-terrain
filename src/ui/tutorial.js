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
  return [
    {
      target: () => document.querySelector('.ce-bottombar'),
      text: 'Cherchez n’importe quel lieu sur Terre — ou collez « lat, lon » — et regardez-le surgir en relief.',
    },
    {
      target: () => null, // a concept, not a widget: plain centered card
      text: 'Molette pour zoomer. Reculez et la carte devient une pièce de musée isométrique — le bloc entier sur son socle, cartouche comprise. Plongez pour un terrain toujours plus fin.',
    },
    {
      target: () => document.querySelector('.ce-hourpill'),
      text: 'L’heure du ciel — faites glisser pour passer de l’aube à la nuit, ou lancez le cycle automatique.',
    },
    {
      target: () => findPanel('explorer'),
      text: 'Explorer — volez vers des lieux choisis sur chaque continent.',
    },
    {
      target: () => findPanel('bibliothèque'),
      text: 'Bibliothèque — templates et palettes : un clic restyle toute la carte.',
    },
    {
      target: () => findPanel('couleurs'),
      text: 'Couleurs — la rampe du relief, les océans, le fond et le ciel.',
    },
    {
      target: () => findPanel('caméra'),
      text: 'Caméra — objectif, mise au point et mouvements automatiques.',
    },
    {
      target: () => document.querySelector('.ce-isobtn'),
      text: 'Un clic ici cadre la vue isométrique — bloc, socle et cartouche.',
    },
    {
      target: () => document.querySelector('.ce-topbar .ce-pubbtn'),
      text: 'Publier — exporter une image ou une vidéo, copier le lien de la vue, ou enregistrer votre projet course.',
    },
    {
      target: () => document.querySelector('.ce-globebtn') ?? document.querySelector('.ce-topbar'),
      text: 'Globe — reculez jusqu’à la planète entière, qui tourne lentement.',
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
  skip.textContent = 'Passer'
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
    next.innerHTML = i === steps.length - 1 ? 'Terminé' : '&rarr;'

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
