// HUB d'accueil (UX P1, Adrien) — le popup plein écran qui pose LA question :
// « Que voulez-vous faire ? ». Trois portes (Explorer / Studio / Parcours),
// mêmes pour tous les profils. La carte vivante reste visible derrière le
// voile. Échap ou clic dehors = Explorer. Le logo de la topbar le rouvre.
import './hub.css'

const IC = {
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3-4-5-9-5z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="9.5" cy="7" r="1" fill="currentColor"/><circle cx="14" cy="6.5" r="1" fill="currentColor"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
}

export function buildHub({ onExplore, onStudio, onParcours, focusSearch }) {
  const veil = document.createElement('div')
  veil.className = 'hub-veil hub-hidden'
  veil.innerHTML = `
    <div class="hub">
      <div class="hub-mark">ShibuMap<span>.</span></div>
      <div class="hub-q">Que voulez-vous faire ?</div>
      <div class="hub-doors">
        <button type="button" class="hub-door ce-glassbox" data-k="explore">${IC.globe}<b>Explorer</b><i>La Terre en relief</i></button>
        <button type="button" class="hub-door ce-glassbox" data-k="studio">${IC.palette}<b>Studio</b><i>Habiller ma carte</i></button>
        <button type="button" class="hub-door ce-glassbox accent" data-k="parcours"><span class="hub-badge">Organisateurs</span>${IC.flag}<b>Parcours</b><i>Ma carte de course</i></button>
      </div>
      <button type="button" class="hub-search ce-glassbox">Rechercher un lieu…</button>
      <div class="hub-drop">ou déposez un fichier GPX n'importe où — pas de fichier ? La démo vous attend dans Parcours.</div>
      <button type="button" class="hub-esc">Échap — explorer librement</button>
    </div>`
  document.body.appendChild(veil)

  const hide = () => veil.classList.add('hub-hidden')
  const show = () => veil.classList.remove('hub-hidden')
  const isOpen = () => !veil.classList.contains('hub-hidden')

  veil.querySelector('[data-k="explore"]').addEventListener('click', () => { hide(); onExplore?.() })
  veil.querySelector('[data-k="studio"]').addEventListener('click', () => { hide(); onStudio?.() })
  veil.querySelector('[data-k="parcours"]').addEventListener('click', () => { hide(); onParcours?.() })
  veil.querySelector('.hub-search').addEventListener('click', () => { hide(); focusSearch?.() })
  veil.querySelector('.hub-esc').addEventListener('click', () => { hide(); onExplore?.() })
  veil.addEventListener('click', (e) => { if (e.target === veil) { hide(); onExplore?.() } })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { hide(); onExplore?.() } })

  return { show, hide, isOpen }
}
