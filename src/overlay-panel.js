// MAP OVERLAY — a standalone FUI panel (same family as the SECTOR and
// TELEMETRY blocks) living outside the lil-gui sidebar. It drives the map's
// look: one-click random palette / style / grid-contour, an expandable list
// of color-theory palettes, and the top-5 named peaks toggle.

import { generatePalette, generateStyle, generateGridContour } from './palette.js'

const LIST_SIZE = 9

export function createOverlayPanel({ apply, announce }) {
  const root = document.createElement('div')
  root.className = 'hud-block map-overlay-panel'
  root.innerHTML = `
    <div class="hud-kicker"><span class="sq"></span>MAP OVERLAY<button class="mop-x" title="close">✕</button></div>
    <div class="mop-btns">
      <button data-a="palette">◧ RANDOM PALETTE</button>
      <button data-a="style">◨ RANDOM STYLE</button>
      <button data-a="grid">▦ RANDOM GRID / CONTOUR</button>
    </div>
    <div class="hud-rule"></div>
    <div class="mop-list-head">
      <span class="mop-list-title">PALETTES</span>
      <button data-a="regen" title="generate a new set">↻</button>
      <button data-a="fold" title="expand / collapse">▾</button>
    </div>
    <div class="mop-list"></div>
    <div class="hud-rule"></div>
    <label class="mop-peaks"><input type="checkbox" data-a="peaks"><span>▲ TOP-5 PEAKS · NAME + ALT</span></label>`
  document.body.appendChild(root)

  const listEl = root.querySelector('.mop-list')
  const foldBtn = root.querySelector('[data-a="fold"]')
  let folded = false

  function renderList() {
    listEl.innerHTML = ''
    for (let i = 0; i < LIST_SIZE; i++) {
      const p = generatePalette()
      const row = document.createElement('button')
      row.className = 'mop-pal'
      row.innerHTML =
        [p.oceanDeep, p.oceanShallow, p.gradLow, p.gradMid1, p.gradMid2, p.gradHigh]
          .map((c) => `<span class="chip" style="background:${c}"></span>`)
          .join('') + `<i>${p.name}</i>`
      row.addEventListener('click', () => {
        apply.palette(p)
        announce(`PALETTE APPLIED — ${p.name}`)
        listEl.querySelectorAll('.mop-pal').forEach((r) => r.classList.toggle('active', r === row))
      })
      listEl.appendChild(row)
    }
  }
  renderList()

  root.querySelector('[data-a="palette"]').addEventListener('click', () => {
    const p = generatePalette()
    apply.palette(p)
    announce(`PALETTE — ${p.name}`)
  })
  root.querySelector('[data-a="style"]').addEventListener('click', () => {
    apply.style(generateStyle())
    announce('RELIEF STYLE RANDOMIZED')
  })
  root.querySelector('[data-a="grid"]').addEventListener('click', () => {
    apply.gridContour(generateGridContour())
    announce('GRID / CONTOUR RANDOMIZED')
  })
  root.querySelector('[data-a="regen"]').addEventListener('click', renderList)
  foldBtn.addEventListener('click', () => {
    folded = !folded
    listEl.style.display = folded ? 'none' : ''
    foldBtn.textContent = folded ? '▸' : '▾'
  })
  root.querySelector('.mop-x').addEventListener('click', () => setVisible(false))

  const peaksBox = root.querySelector('[data-a="peaks"]')
  peaksBox.addEventListener('change', () => apply.peaks(peaksBox.checked))

  function setVisible(v) {
    root.style.display = v ? '' : 'none'
  }

  return {
    root,
    setVisible,
    get visible() {
      return root.style.display !== 'none'
    },
  }
}
