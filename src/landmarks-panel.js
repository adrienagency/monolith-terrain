// LANDMARKS — a draggable FUI accordion of curated topographic places,
// folded by continent. Clicking a place flies the globe there and dives at
// the zoom that frames the feature at its natural size.

import { LANDMARKS } from './landmarks.js'
import { makeDraggable } from './drag.js'

export function createLandmarksPanel({ flyTo, announce }) {
  const root = document.createElement('div')
  root.className = 'hud-block landmarks-panel'
  root.innerHTML = `
    <div class="hud-kicker lmk-drag"><span class="sq"></span>LANDMARKS<button class="mop-x" title="close">✕</button></div>
    <div class="lmk-list"></div>`
  document.body.appendChild(root)

  const list = root.querySelector('.lmk-list')
  for (const [continent, places] of Object.entries(LANDMARKS)) {
    const head = document.createElement('button')
    head.className = 'lmk-continent'
    head.innerHTML = `<span class="lmk-arrow">▸</span>${continent.toUpperCase()}<i>${places.length}</i>`
    list.appendChild(head)

    const fold = document.createElement('div')
    fold.className = 'lmk-fold'
    fold.style.display = 'none'
    for (const p of places) {
      const row = document.createElement('button')
      row.className = 'lmk-place'
      const nameEl = document.createElement('span')
      nameEl.textContent = p.name
      const zoomEl = document.createElement('i')
      zoomEl.textContent = `Z${p.zoom}`
      row.append(nameEl, zoomEl)
      row.addEventListener('click', () => {
        announce(`DESTINATION — ${p.name.toUpperCase()} · Z${p.zoom}`)
        flyTo(p.lat, p.lon, p.zoom)
      })
      fold.appendChild(row)
    }
    list.appendChild(fold)

    head.addEventListener('click', () => {
      const open = fold.style.display !== 'none'
      fold.style.display = open ? 'none' : ''
      head.querySelector('.lmk-arrow').textContent = open ? '▸' : '▾'
    })
  }

  root.querySelector('.mop-x').addEventListener('click', () => setVisible(false))
  makeDraggable(root, root.querySelector('.lmk-drag'))

  function setVisible(v) {
    root.style.display = v ? '' : 'none'
  }

  return { root, setVisible }
}
