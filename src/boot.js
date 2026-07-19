// ShibuMap entry gate. Anything that stops this browser from running the app
// is decided HERE, before the heavy bundle is imported — a device that can't
// render the relief should never pay for Three.js, and must never be left
// spinning on the loading planet with no explanation.
//
// The decision itself lives in boot-gate.js (pure, tested); this file only
// observes the environment and paints the result.

import { gateFor, looksInApp, detectWebGL2 } from './boot-gate.js'

const coarse = matchMedia('(pointer: coarse)').matches
const shortSide = Math.min(screen.width, screen.height)

const gate = gateFor({
  isPhone: coarse && shortSide < 600, // tablets (iPad mini 744+) pass
  hasWebGL2: detectWebGL2(),
  inAppBrowser: looksInApp(navigator.userAgent),
})

if (gate) {
  showGate(gate)
} else {
  import('./main.js')
}

// One card for every refusal: same look whatever the reason, because to the
// visitor they're the same event — "this isn't going to run for me, and here
// is what to do about it". Inline styles on purpose: style.css may not have
// arrived, and a gate that renders unstyled is barely better than a blank page.
function showGate({ title, body, hint }) {
  const card = document.createElement('div')
  card.setAttribute(
    'style',
    [
      'position:fixed', 'inset:0', 'z-index:999', 'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:14px', 'padding:32px',
      'background:linear-gradient(180deg,#f4f3f0,#e7e5e0)', 'text-align:center',
      "font-family:'Bricolage Grotesque',system-ui,sans-serif", 'color:#1c1e22',
    ].join(';')
  )
  // textContent for the copy, never innerHTML: `body` is app-authored today,
  // but this is the one path that runs when everything else has failed and it
  // should stay incapable of injecting markup.
  const h = document.createElement('div')
  h.setAttribute('style', 'font-size:22px;font-weight:700')
  h.innerHTML = '<span style="color:#e8622c">◍</span> '
  h.append(title)

  const p = document.createElement('div')
  p.setAttribute('style', 'font-size:15px;max-width:320px;line-height:1.5')
  p.textContent = body

  const small = document.createElement('div')
  small.setAttribute('style', 'font-size:12px;color:rgba(28,30,34,.55)')
  small.textContent = hint

  card.append(h, p, small)
  document.body.append(card)
  document.getElementById('loading')?.remove() // the planet must stop, or it reads as "still trying"
}
