// MOTION — a separate FUI panel anchored at the bottom of the screen holding
// the playback and cinematic-tour controls (pulled out of the lil-gui sidebar,
// like MAP OVERLAY and LANDMARKS). Draggable and collapsible.

import { makeDraggable, makeCollapsible } from './drag.js'

export function createMotionPanel({ params, poiIds, onPause, onTour, onStop, announce }) {
  const root = document.createElement('div')
  root.className = 'hud-block motion-panel'
  const opts = (sel) => poiIds.map((id) => `<option ${id === sel ? 'selected' : ''}>${id}</option>`).join('')
  root.innerHTML = `
    <div class="hud-kicker mtn-drag"><span class="sq"></span>MOTION</div>
    <div class="mtn-body">
      <div class="mtn-row">
        <button data-a="pause">❙❙ PAUSE</button>
      </div>
      <div class="hud-rule"></div>
      <div class="mtn-tour">
        <label>FROM<select data-a="from">${opts(params.tourFrom)}</select></label>
        <label>TO<select data-a="to">${opts(params.tourTo)}</select></label>
      </div>
      <div class="mtn-row">
        <button data-a="tour">▶ START TOUR</button>
        <button data-a="stop">■ STOP</button>
      </div>
      <label class="mtn-slider">DURATION <input type="range" data-a="dur" min="4" max="40" step="0.5" value="${params.tourDuration}"><b>${params.tourDuration}s</b></label>
      <label class="mtn-slider">ALTITUDE <input type="range" data-a="alt" min="0.8" max="10" step="0.1" value="${params.tourAltitude}"><b>${params.tourAltitude}</b></label>
    </div>`
  document.body.appendChild(root)

  const q = (a) => root.querySelector(`[data-a="${a}"]`)
  const pauseBtn = q('pause')
  // reflect params.paused onto the button — the same flag also drives the
  // lil-gui checkbox, so either control can flip it and syncPause keeps the
  // label honest
  const syncPause = () => {
    pauseBtn.textContent = params.paused ? '▶ RESUME' : '❙❙ PAUSE'
    pauseBtn.classList.toggle('active', params.paused)
  }
  pauseBtn.addEventListener('click', () => {
    params.paused = !params.paused
    onPause(params.paused)
    syncPause()
  })
  q('from').addEventListener('change', (e) => (params.tourFrom = e.target.value))
  q('to').addEventListener('change', (e) => (params.tourTo = e.target.value))
  q('tour').addEventListener('click', () => {
    announce('CINEMATIC TOUR ENGAGED')
    onTour()
  })
  q('stop').addEventListener('click', () => onStop())

  const dur = q('dur')
  dur.addEventListener('input', (e) => {
    params.tourDuration = parseFloat(e.target.value)
    dur.nextElementSibling.textContent = `${params.tourDuration}s`
  })
  const alt = q('alt')
  alt.addEventListener('input', (e) => {
    params.tourAltitude = parseFloat(e.target.value)
    alt.nextElementSibling.textContent = `${params.tourAltitude}`
  })

  const drag = root.querySelector('.mtn-drag')
  makeDraggable(root, drag)
  makeCollapsible(root, drag, '.mtn-body')

  return {
    root,
    syncPause,
    setVisible(v) {
      root.style.display = v ? '' : 'none'
    },
  }
}
