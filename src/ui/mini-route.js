// Mini panneau « Parcours » (mode simple, demande Adrien) — dès qu'au moins
// une course est chargée, il faut pouvoir gérer ses blocs SANS passer en mode
// avancé : plusieurs GPX = plusieurs blocs à l'écran, et sans ce panneau on ne
// peut ni en retirer ni en choisir un. Liste des courses (clic = focus,
// ✕ = retirer) + Lecture/Stop — « sans la lecture, la carte ne sert plus à
// grand chose ». Le panneau Parcours complet reste en mode avancé.
import { el } from './kit.js'

export function buildMiniRoute(ctx) {
  const box = el('div', 'ce-miniroute ce-glassbox')
  const title = el('div', 'ce-miniroute-title', 'Parcours')
  const list = el('div', 'ce-miniroute-list')
  const row = el('div', 'ce-miniroute-actions')

  const playBtn = el('button', 'ce-pillbtn accent')
  playBtn.type = 'button'
  playBtn.textContent = '▶ Lecture'
  playBtn.setAttribute('data-tip', 'La tête parcourt la trace, la caméra suit — Espace pour pause.')
  playBtn.addEventListener('click', () => {
    if (!ctx.gpx.track) return
    if (ctx.gpx.isPlaying()) {
      ctx.gpx.pause()
      ctx.stopFollow?.()
    } else {
      ctx.gpx.play()
      ctx.startFollow?.()
    }
    sync()
  })
  const stopBtn = el('button', 'ce-pillbtn')
  stopBtn.type = 'button'
  stopBtn.textContent = '■'
  stopBtn.title = 'Stop'
  stopBtn.addEventListener('click', () => {
    ctx.gpx.stop()
    ctx.stopFollow?.()
    sync()
  })
  row.append(playBtn, stopBtn)
  box.append(title, list, row)

  // même pattern 200 ms que le panneau complet : l'état de lecture change
  // aussi depuis les raccourcis (Espace/Échap) et la fin de parcours
  function sync() {
    const playing = !!ctx.gpx.isPlaying?.()
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Lecture'
    playBtn.classList.toggle('on', playing)
  }
  sync()
  setInterval(sync, 250)

  function render(layers = ctx.gpx.layers) {
    box.classList.toggle('has', layers.length > 0)
    list.replaceChildren()
    layers.forEach((l, idx) => {
      const r = el('div', 'ce-miniroute-row' + (idx === ctx.gpx.activeIndex ? ' active' : ''))
      const nm = el('span', 'ce-miniroute-name', l.name || 'Course')
      const x = el('button', 'ce-miniroute-x')
      x.type = 'button'
      x.textContent = '✕'
      x.title = 'Retirer cette course'
      x.addEventListener('click', (e) => { e.stopPropagation(); ctx.gpx.removeLayer(l.id) })
      r.addEventListener('click', (e) => { if (!e.target.closest('button')) ctx.gpx.focus(l.id) })
      r.append(nm, x)
      list.append(r)
    })
  }
  render()

  // hooks single-slot déjà pris par main.js + route-panel : on CHAÎNE
  const prevOnChange = ctx.gpx.onChange
  ctx.gpx.onChange = (layers) => {
    prevOnChange?.(layers)
    render(layers)
  }
  const prevOnFocusChange = ctx.gpx.onFocusChange
  ctx.gpx.onFocusChange = (layer, idx) => {
    prevOnFocusChange?.(layer, idx)
    render()
  }

  document.body.append(box)
  return { render }
}
