// ShibuMap entry gate. Anything that stops this browser from running the app
// is decided HERE, before the heavy bundle is imported — a device that can't
// render the relief should never pay for Three.js, and must never be left
// spinning on the loading planet with no explanation.
//
// The decision itself lives in boot-gate.js (pure, tested); this file only
// observes the environment and paints the result.

import { gateFor, looksInApp, looksSharedLink, contexteWebGL2 } from './boot-gate.js'
import { sonderMachine } from './palier-machine.js'
import { gatePhoneActif } from './flags.js'

const coarse = matchMedia('(pointer: coarse)').matches
const shortSide = Math.min(screen.width, screen.height)

// UN SEUL contexte WebGL2 pour les deux questions du démarrage : « cette
// machine peut-elle rendre ? » (la carte de refus) et « jusqu'où peut-elle
// rendre ? » (le palier de départ). Voir boot-gate.js. Il est relâché juste
// après, dès que ces deux questions ont leur réponse.
const gl = contexteWebGL2()

const gate = gateFor({
  // ⚡ 2026-09-06 : sas sauté le temps du chantier de fluidité mobile — voir
  // FLAGS.gatePhone dans flags.js. `?gate=1` le remet, `?gate=0` le confirme.
  isPhone: gatePhoneActif() && coarse && shortSide < 600, // tablets (iPad mini 744+) pass
  hasWebGL2: !!gl,
  inAppBrowser: looksInApp(navigator.userAgent),
  sharedView: looksSharedLink(location.hash), // une shibu reçue se consomme sur téléphone
})

if (gate) {
  showGate(gate)
} else {
  // LA SONDE MACHINE, ICI ET PAS AILLEURS — « dans les millisecondes de
  // l'ouverture » (Adrien). boot.js est le premier module du site à
  // s'exécuter : le verdict est rendu et mémorisé AVANT même que main.js ne
  // commence à être téléchargé, donc très loin devant le premier rendu.
  // main.js relit le résultat mémorisé et pose ses params dessus — il ne
  // resonde pas, et le contexte ci-dessus ne sert qu'une fois pour la session.
  //
  // Enveloppée : un défaut de la sonde ne doit JAMAIS empêcher la carte de
  // s'ouvrir. Sans verdict, main.js retombe sur le comportement d'avant elle.
  try { sonderMachine({ gl }) } catch { /* palier 0 par défaut : l'état d'avant */ }

  // A .catch is not optional here: an exception during main.js's module
  // evaluation otherwise leaves the loader spinning forever with nothing in
  // the console — the exact silent hang this whole gate exists to prevent.
  import('./main.js').catch((err) => {
    console.error('ShibuMap failed to start:', err)
    showGate({
      title: 'ShibuMap',
      body: 'Something went wrong starting the map. Reloading the page usually fixes it.',
      hint: 'shibumap.com',
    })
  })
}

// ON REND LE CONTEXTE, MAINTENANT QU'IL A TOUT DIT. Les deux questions du
// démarrage sont répondues au-dessus — la carte de refus dans une branche, le
// palier de départ dans l'autre — et personne ne relit `gl` ensuite : main.js
// se contente du verdict mémorisé par la sonde, et ce verdict ne contient que
// des nombres et des chaînes, jamais le contexte lui-même.
//
// Sans ce relâchement, ce `const` de portée module garderait le contexte ET son
// canvas détaché EN VIE AUSSI LONGTEMPS QUE LA PAGE, à côté de celui du vrai
// renderer. Avant la sonde, detectWebGL2() créait le sien à l'intérieur de la
// fonction et n'en rendait qu'un booléen : le ramasse-miettes le reprenait
// aussitôt. En le remontant au niveau module pour le partager, on a perdu ça
// sans le vouloir.
//
// Ce que ça coûte n'est pas anodin : Chrome plafonne le nombre de contextes
// WebGL simultanés par onglet et tue le plus ancien au-delà, et un contexte
// retenu pour rien pèse surtout en mémoire pilote sur les circuits intégrés —
// exactement le matériel que toute cette détection cherche à ménager.
//
// APRÈS la sonde, jamais avant : elle lit MAX_TEXTURE_SIZE, les unités de
// texture, les uniformes fragment et WEBGL_debug_renderer_info sur ce contexte
// (voir lireSignaux dans palier-machine.js). Un contexte perdu ne répond plus.
// Dans la branche de refus aussi, où la carte n'a besoin de rien de tout ça.
gl?.getExtension('WEBGL_lose_context')?.loseContext()

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
