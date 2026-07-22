// Vertical zoom stepper — a small floating control on the left edge that steps
// the DEM zoom staircase one level at a time (finer ▲ / wider ▼), the discrete
// alternative to the wheel Adrien asked for. It only TRIGGERS the tuned mode
// machine (modes.stepFiner / stepWider); it owns no zoom logic of its own.
//
// `getState()` (from main.js, where params/dem/modes are in scope) returns
// { label, canFiner, canWider } each frame so the readout and the disabled
// states stay live as the staircase, orbit gate and busy transitions move.

import { el } from './kit.js'

export function buildZoomStepper({ modes, getState }) {
  const root = el('div', 'zoom-stepper')

  const plus = el('button', 'zs-btn zs-plus')
  plus.type = 'button'
  plus.setAttribute('aria-label', 'Plonger d’un niveau')
  plus.setAttribute('data-tip', 'Plonger d’un niveau (plus de détail)')
  plus.textContent = '+'

  const label = el('div', 'zs-label', 'Z—')

  const minus = el('button', 'zs-btn zs-minus')
  minus.type = 'button'
  minus.setAttribute('aria-label', 'Reculer d’un niveau')
  minus.setAttribute('data-tip', 'Reculer d’un niveau (vue plus large)')
  minus.textContent = '−'

  plus.addEventListener('click', () => modes.stepFiner())
  minus.addEventListener('click', () => modes.stepWider())

  root.append(plus, label, minus)
  document.body.appendChild(root)

  let last = ''
  return {
    el: root,
    update() {
      const s = getState()
      if (s.label !== last) { label.textContent = s.label; last = s.label }
      plus.disabled = !s.canFiner
      minus.disabled = !s.canWider
      root.classList.toggle('zs-busy', !!s.busy)
    },
    dispose() { root.remove() },
  }
}
