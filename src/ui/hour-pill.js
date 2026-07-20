// The 24 h day/night slider as a minimalist PILL, fixed top-right above the
// Templates panel (explicit request — the hour is a mood you reach for, not a
// setting you dig for). Glyph follows the sky: sun by day, moon at night.

import { el } from './kit.js'

export function buildHourPill({ params, applyTimeOfDay }) {
  const pill = el('div', 'ce-hourpill ce-glassbox')
  const glyph = el('span', 'ce-hp-glyph', '☀')
  const range = document.createElement('input')
  range.type = 'range'
  range.min = '0'
  range.max = '24'
  range.step = '0.1'
  range.value = String(params.timeOfDay)
  const label = el('span', 'ce-hp-label', '')
  const sync = () => {
    const h = params.timeOfDay
    label.textContent = `${String(Math.floor(h)).padStart(2, '0')}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`
    glyph.textContent = h < 6 || h > 20.5 ? '☾' : '☀'
  }
  range.addEventListener('input', () => {
    params.timeOfDay = +range.value
    applyTimeOfDay(params.timeOfDay)
    sync()
  })
  sync()
  pill.append(glyph, range, label)
  document.body.append(pill)
  return { el: pill, refresh: () => { range.value = String(params.timeOfDay); sync() } }
}
