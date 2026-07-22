// The 24 h day/night slider as a minimalist PILL, fixed top-right above the
// Templates panel (explicit request — the hour is a mood you reach for, not a
// setting you dig for). Glyph follows the sky: sun by day, moon at night.

import { el } from './kit.js'

export function buildHourPill({ params, applyTimeOfDay }) {
  const pill = el('div', 'ce-hourpill')

  // ▶/⏸ : cycle jour/nuit automatique. La vitesse est un nombre 1..100 où
  // 1 = un cycle complet (24 h) en 1 minute ; 100 = 100× plus rapide (Adrien).
  const playBtn = el('button', 'ce-hp-play')
  playBtn.type = 'button'
  playBtn.textContent = '▶'
  playBtn.setAttribute('data-tip', 'Lancer le cycle jour/nuit automatique.')

  const glyph = el('span', 'ce-hp-glyph', '☀')
  const range = document.createElement('input')
  range.type = 'range'
  range.min = '0'
  range.max = '24'
  range.step = '0.1'
  range.value = String(params.timeOfDay)
  const label = el('span', 'ce-hp-label', '')

  // champ de vitesse (1..100)
  const speed = document.createElement('input')
  speed.type = 'number'
  speed.className = 'ce-hp-speed'
  speed.min = '1'
  speed.max = '100'
  speed.step = '1'
  speed.value = String(params.dayCycleSpeed ?? 1)
  speed.setAttribute('data-tip', 'Vitesse : 1 = un cycle complet en 1 min, jusqu’à 100×.')

  const sync = () => {
    const h = params.timeOfDay
    label.textContent = `${String(Math.floor(h)).padStart(2, '0')}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
    glyph.textContent = h < 6 || h > 20.5 ? '☾' : '☀'
  }

  let playing = false
  let rafId = 0
  let lastT = 0
  const tick = (now) => {
    if (!playing) return
    const dt = lastT ? (now - lastT) / 1000 : 0
    lastT = now
    // 1 = 24 h par minute → 24 h de simulation en 60 s ; vitesse N = N× plus vite
    const hoursPerSec = (24 / 60) * (params.dayCycleSpeed || 1)
    params.timeOfDay = (params.timeOfDay + hoursPerSec * dt) % 24
    applyTimeOfDay(params.timeOfDay)
    range.value = String(params.timeOfDay)
    sync()
    rafId = requestAnimationFrame(tick)
  }
  const setPlaying = (on) => {
    playing = on
    playBtn.textContent = on ? '⏸' : '▶'
    playBtn.classList.toggle('on', on)
    playBtn.setAttribute('data-tip', on ? 'Arrêter le cycle.' : 'Lancer le cycle jour/nuit automatique.')
    cancelAnimationFrame(rafId)
    lastT = 0
    if (on) rafId = requestAnimationFrame(tick)
  }
  playBtn.addEventListener('click', () => setPlaying(!playing))

  speed.addEventListener('input', () => {
    const v = Math.max(1, Math.min(100, Math.round(+speed.value || 1)))
    params.dayCycleSpeed = v
    speed.value = String(v)
  })

  range.addEventListener('input', () => {
    params.timeOfDay = +range.value
    applyTimeOfDay(params.timeOfDay)
    sync()
    if (playing) setPlaying(false) // une saisie manuelle stoppe le cycle
  })

  sync()
  pill.append(playBtn, glyph, range, label, speed)
  document.body.append(pill)
  return { el: pill, refresh: () => { range.value = String(params.timeOfDay); sync() } }
}
