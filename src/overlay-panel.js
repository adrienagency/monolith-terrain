// MAP OVERLAY — a standalone FUI panel (same family as the SECTOR and
// TELEMETRY blocks) living outside the lil-gui sidebar. It drives the map's
// look: random palette / style / grid-contour, a large expandable list of
// color-theory palettes that follows the light/dark mode, a full look reset,
// the dark-mode switch and the top-5 named peaks toggle. Draggable by its
// title bar.

import { generatePalette, generateStyle, generateGridContour } from './palette.js'
import { TEMPLATES } from './templates.js'
import { makeDraggable } from './drag.js'

const LIST_SIZE = 14

export function createOverlayPanel({ apply, announce, getMode }) {
  const root = document.createElement('div')
  root.className = 'hud-block map-overlay-panel'
  root.innerHTML = `
    <div class="hud-kicker mop-drag"><span class="sq"></span>MAP OVERLAY<button class="mop-x" title="close">✕</button></div>
    <div class="mop-btns">
      <button data-a="palette">◧ RANDOM PALETTE</button>
      <button data-a="style">◨ RANDOM STYLE</button>
      <button data-a="grid">▦ RANDOM GRID / CONTOUR</button>
      <button data-a="reset">⟲ RESET LOOK</button>
    </div>
    <div class="hud-rule"></div>
    <div class="mop-list-title">TEMPLATES</div>
    <div class="mop-templates"></div>
    <div class="hud-rule"></div>
    <label class="mop-check"><input type="checkbox" data-a="dark"><span>◐ DARK MODE</span></label>
    <div class="mop-mono">
      <button data-a="mono-white">◻ FULL WHITE</button>
      <button data-a="mono-dark">◼ FULL DARK</button>
    </div>
    <div class="hud-rule"></div>
    <div class="mop-list-head">
      <span class="mop-list-title">PALETTES</span>
      <button data-a="regen" title="generate a new set">↻</button>
      <button data-a="fold" title="expand / collapse">▾</button>
    </div>
    <div class="mop-list"></div>
    <div class="hud-rule"></div>
    <label class="mop-check"><input type="checkbox" data-a="peaks"><span>▲ TOP-5 PEAKS · NAME + ALT</span></label>`
  document.body.appendChild(root)

  // template buttons — each applies a full reference-image look
  const tplEl = root.querySelector('.mop-templates')
  for (const [key, tpl] of Object.entries(TEMPLATES)) {
    const b = document.createElement('button')
    b.className = 'mop-tpl'
    b.textContent = `▤ ${tpl.label || key.toUpperCase()}`
    b.addEventListener('click', () => {
      apply.template(tpl)
      darkBox.checked = !!tpl.darkMode
      renderList() // palette list follows the template's mode
      tplEl.querySelectorAll('.mop-tpl').forEach((x) => x.classList.toggle('active', x === b))
      announce(`TEMPLATE — ${(tpl.label || key).toUpperCase()}`)
    })
    tplEl.appendChild(b)
  }

  const listEl = root.querySelector('.mop-list')
  const foldBtn = root.querySelector('[data-a="fold"]')
  let folded = false

  function renderList() {
    listEl.innerHTML = ''
    const mode = getMode()
    for (let i = 0; i < LIST_SIZE; i++) {
      const p = generatePalette(Math.random, mode)
      const row = document.createElement('button')
      row.className = 'mop-pal'
      row.innerHTML =
        [p.oceanDeep, p.oceanMid, p.oceanShallow, p.gradLow, p.gradMid1, p.gradMid2, p.gradHigh]
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
    const p = generatePalette(Math.random, getMode())
    apply.palette(p)
    announce(`PALETTE — ${p.name}`)
  })
  root.querySelector('[data-a="style"]').addEventListener('click', () => {
    apply.style(generateStyle())
    announce('RELIEF STYLE RANDOMIZED')
  })
  root.querySelector('[data-a="grid"]').addEventListener('click', () => {
    apply.gridContour(generateGridContour(Math.random, getMode()))
    announce('GRID / CONTOUR RANDOMIZED')
  })
  root.querySelector('[data-a="reset"]').addEventListener('click', () => {
    apply.reset()
    darkBox.checked = false
    tplEl.querySelectorAll('.mop-tpl.active').forEach((x) => x.classList.remove('active'))
    renderList()
    announce('LOOK RESET — SURVEY DEFAULTS')
  })
  root.querySelector('[data-a="regen"]').addEventListener('click', renderList)
  foldBtn.addEventListener('click', () => {
    folded = !folded
    listEl.style.display = folded ? 'none' : ''
    foldBtn.textContent = folded ? '▸' : '▾'
  })
  root.querySelector('.mop-x').addEventListener('click', () => setVisible(false))

  root.querySelector('[data-a="mono-white"]').addEventListener('click', () => {
    apply.monochrome('white')
    darkBox.checked = false
    renderList()
    announce('FULL WHITE — RELIEF IN LIGHT ALONE')
  })
  root.querySelector('[data-a="mono-dark"]').addEventListener('click', () => {
    apply.monochrome('dark')
    darkBox.checked = true
    renderList()
    announce('FULL DARK — NIGHT SLAB')
  })

  const darkBox = root.querySelector('[data-a="dark"]')
  darkBox.addEventListener('change', () => {
    apply.darkMode(darkBox.checked)
    // land on a coherent look immediately: fresh palette of the new mode
    apply.palette(generatePalette(Math.random, getMode()))
    renderList() // the list follows the mode too
    announce(darkBox.checked ? 'DARK MODE — NIGHT SURVEY' : 'LIGHT MODE — PAPER SHEET')
  })

  const peaksBox = root.querySelector('[data-a="peaks"]')
  peaksBox.addEventListener('change', () => apply.peaks(peaksBox.checked))

  makeDraggable(root, root.querySelector('.mop-drag'))

  function setVisible(v) {
    root.style.display = v ? '' : 'none'
  }

  return {
    root,
    setVisible,
    renderList,
    get visible() {
      return root.style.display !== 'none'
    },
  }
}
