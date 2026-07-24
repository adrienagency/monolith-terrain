// Section SCANNER — l'ancien panneau autonome est devenu une section du
// panneau Image (plan « table lumineuse » : le scan est un EFFET d'image,
// pas un outil cartographique). buildEffectsPanel la monte via scanSection().

import { el, button, section } from './kit.js'
import { SCAN_TYPES } from '../scan.js'

const TIPS = {
  radar: 'Un anneau radar balaie la carte depuis le centre.',
  elevation: 'Un plan horizontal traverse le relief, altitude par altitude.',
  gridline: 'Une ligne de relevé balaie la carte et allume la grille.',
  sonar: 'Trois pings sonar ondulent depuis le point regardé.',
  holo: 'La carte scintille et se rematérialise comme un hologramme.',
}

export function scanSection(ctx) {
  const s = section('Scanner', { open: false })
  let scanType = SCAN_TYPES[0].id
  const grid = el('div', 'ce-scan-grid')
  const typeButtons = SCAN_TYPES.map((t) => {
    const b = el('button', `ce-card${t.id === scanType ? ' on' : ''}`)
    b.type = 'button'
    b.innerHTML = `<span class="ce-card-name">${t.label}</span>`
    b.setAttribute('data-tip', TIPS[t.key] ?? t.label)
    b.addEventListener('click', () => {
      scanType = t.id
      typeButtons.forEach((x) => x.classList.remove('on'))
      b.classList.add('on')
    })
    grid.append(b)
    return b
  })
  s.body.append(grid)
  const trig = el('div', 'ce-btn-row')
  const run = button('Lancer le scan', () => ctx.runScan(scanType), { accent: true })
  run.setAttribute('data-tip', 'Déclenche le balayage choisi sur la vue actuelle.')
  trig.append(run)
  s.body.append(trig)
  return s
}
