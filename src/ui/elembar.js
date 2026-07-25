// Barre de travail flottante (validée Adrien, réf. vidéo barre Figma) :
// à GAUCHE le sélecteur de MODE — Explorer / Studio / Parcours, icône + nom,
// toujours présent (les 3 modes du hub, le modèle mental unique du site) —
// puis un séparateur et LE RESTE QUI CHANGE selon le mode :
//   Explorer  → (rien : la barre reste sobre, les panneaux monde suffisent)
//   Studio    → les 4 outils éléments (Lumière/Nuages/Brume/Mer) + surmenus
//   Parcours  → Lecture / Stop
// Choisir un mode CHARGE les panneaux appropriés et fait disparaître les
// autres (main.js applyWorkMode). Surmenus : lignes SCRUBBABLES (glisser =
// régler, clic sec = grande tirette, double-clic = saisir) — voir v2.
import { el, toggle as kitToggle, refreshAll } from './kit.js'
import { liquidize } from './liquid.js'

const I = {
  explore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9z"/></svg>',
  studio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15.5 4.5 19.5 8.5 9 19c-1.5 1.5-4 1.5-5-.5s.5-3.5 2-5L15.5 4.5z"/><path d="M13.5 6.5l4 4"/></svg>',
  parcours: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 8a4 4 0 0 1 0 8H7Z"/></svg>',
  fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9h16M6 13h12M8 17h8"/></svg>',
  sea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
}

const fmt = (c, v) => (c.step >= 1 ? String(Math.round(v)) : (+v).toFixed(c.step >= 0.1 ? 1 : 2))
const clampStep = (c, v) => Math.min(c.max, Math.max(c.min, Math.round(v / c.step) * c.step))

export function buildElemBar({ modes, initial, onMode, toolsByMode }) {
  // barre LIQUIDE (réf. Enroll, précisé par Adrien) : Explorer/Studio/Parcours
  // vivent dans UNE MÊME bulle (la capsule) ; « Avancé » a SA bulle, reliée à
  // la capsule par la taille concave du goo — le liquide est le séparateur
  const bar = el('div', 'ce-elembar')
  const modeSeg = el('div', 'ce-wmseg')
  const sep = el('span', 'ce-elembar-sep')
  sep.style.display = 'none' // la ponctuation, c'est la taille liquide
  const tools = el('div', 'ce-elemtools')
  const focusRow = el('div', 'ce-elemfocus')
  bar.append(modeSeg, sep, tools, focusRow)
  const menu = el('div', 'ce-elemmenu ce-glassbox')
  let closeT = 0
  let openKey = null
  let curMode = null

  // ---- bonus : la grande tirette pleine largeur (clic sec sur une ligne)
  function enterFocus(c) {
    menu.classList.remove('open')
    bar.classList.add('focus')
    focusRow.replaceChildren()
    const back = el('button', 'ce-elemback')
    back.type = 'button'
    back.textContent = '‹'
    back.title = 'Retour aux outils'
    back.addEventListener('click', exitFocus)
    const lab = el('span', 'ce-elemfocus-lab', c.label)
    const range = el('input', 'ce-elemfocus-range')
    range.type = 'range'
    range.min = c.min
    range.max = c.max
    range.step = c.step
    range.value = c.get()
    const val = el('span', 'ce-elemfocus-val', fmt(c, c.get()))
    range.addEventListener('input', () => { c.set(+range.value); val.textContent = fmt(c, +range.value) })
    range.addEventListener('change', () => refreshAll())
    focusRow.append(back, lab, range, val)
  }
  function exitFocus() {
    bar.classList.remove('focus')
    focusRow.replaceChildren()
  }
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.classList.contains('focus')) exitFocus() })

  // ---- ligne scrubbable : label + valeur + filet, glisser = régler
  function scrubRow(c) {
    const row = el('div', 'ce-scrub')
    const lab = el('span', 'sc-lab', c.label)
    const val = el('span', 'sc-val')
    const fill = el('i', 'sc-fill')
    row.append(lab, val, fill)
    const sync = () => {
      const v = c.get()
      val.textContent = fmt(c, v)
      fill.style.width = (100 * (v - c.min) / (c.max - c.min)).toFixed(1) + '%'
    }
    sync()
    let sx = 0
    let sv = 0
    let dragging = false
    let moved = false
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      dragging = true
      moved = false
      sx = e.clientX
      sv = c.get()
      try { row.setPointerCapture(e.pointerId) } catch {}
    })
    row.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - sx
      if (!moved && Math.abs(dx) < 3) return
      moved = true
      // 220 px de glisse = toute la plage — précis sans lever le poignet
      c.set(clampStep(c, sv + (dx / 220) * (c.max - c.min)))
      sync()
    })
    row.addEventListener('pointerup', (e) => {
      if (!dragging) return
      dragging = false
      try { row.releasePointerCapture(e.pointerId) } catch {}
      if (moved) refreshAll()
      else enterFocus(c) // clic sec = grande tirette (bonus Lightroom Mobile)
    })
    row.addEventListener('pointercancel', () => { dragging = false })
    // double-clic : saisir la valeur au clavier
    row.addEventListener('dblclick', () => {
      const inp = el('input', 'sc-edit')
      inp.type = 'number'
      inp.min = c.min
      inp.max = c.max
      inp.step = c.step
      inp.value = c.get()
      val.replaceWith(inp)
      inp.focus()
      inp.select()
      const commit = () => {
        const v = clampStep(c, +inp.value || c.get())
        c.set(v)
        inp.replaceWith(val)
        sync()
        refreshAll()
      }
      inp.addEventListener('blur', commit)
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') inp.blur()
        if (e.key === 'Escape') { inp.value = c.get(); inp.blur() }
      })
    })
    return row
  }

  const openGroup = (g, btn) => {
    clearTimeout(closeT)
    if (openKey === g.key) return
    openKey = g.key
    exitFocus()
    menu.replaceChildren(el('div', 'ce-elemmenu-title', g.label))
    for (const c of g.controls) {
      if (c.type === 'toggle') menu.append(kitToggle({ label: c.label, get: c.get, set: (v) => { c.set(v); refreshAll() } }))
      else menu.append(scrubRow(c))
    }
    menu.classList.add('open')
    tools.querySelectorAll('.ce-elembar-btn').forEach((b) => b.classList.toggle('on', b === btn))
  }
  const scheduleClose = () => {
    clearTimeout(closeT)
    closeT = setTimeout(() => {
      openKey = null
      menu.classList.remove('open')
      tools.querySelectorAll('.ce-elembar-btn').forEach((b) => b.classList.remove('on'))
    }, 260)
  }

  // ---- zone contextuelle : groupes à surmenu + boutons d'action directs
  const syncFns = []
  function renderTools(modeId) {
    tools.replaceChildren()
    syncFns.length = 0
    menu.classList.remove('open')
    openKey = null
    exitFocus()
    const t = toolsByMode[modeId] || {}
    for (const g of t.groups || []) {
      const btn = el('button', 'ce-elembar-btn')
      btn.type = 'button'
      btn.innerHTML = `${I[g.icon] || ''}<span>${g.label}</span>`
      btn.addEventListener('pointerenter', () => openGroup(g, btn))
      btn.addEventListener('click', () => openGroup(g, btn)) // tactile : pas de survol
      tools.append(btn)
    }
    for (const a of t.buttons || []) {
      const btn = el('button', 'ce-elembar-btn' + (a.accent ? ' accent' : ''))
      btn.type = 'button'
      btn.innerHTML = `${I[a.icon] || ''}<span>${a.label}</span>`
      btn.addEventListener('click', () => { a.onClick(); a.sync?.(btn) })
      if (a.sync) syncFns.push(() => a.sync(btn))
      tools.append(btn)
    }
  }
  setInterval(() => syncFns.forEach((f) => f()), 300)

  // ---- sélecteur de MODE — toujours présent, icône + nom
  function setMode(id, { silent = false } = {}) {
    if (curMode === id) return
    curMode = id
    modeSeg.querySelectorAll('.ce-wm-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === id))
    renderTools(id)
    if (!silent) onMode(id)
  }
  for (const m of modes) {
    const b = el('button', 'ce-wm-btn')
    b.type = 'button'
    b.dataset.mode = m.id
    b.innerHTML = `${I[m.icon] || ''}<span>${m.label}</span>`
    b.addEventListener('click', () => setMode(m.id))
    modeSeg.append(b)
  }

  bar.addEventListener('pointerleave', scheduleClose)
  menu.addEventListener('pointerenter', () => clearTimeout(closeT))
  menu.addEventListener('pointerleave', scheduleClose)

  // le cœur reste centré (la rangée fait la largeur de la capsule) ;
  // « Avancé » est ancré à droite, décentré. Deux bulles dans le même goo :
  // la capsule entière + le bouton Avancé (rempli plus tard par main.js —
  // le MutationObserver de liquidize le voit arriver tout seul)
  const row = el('div', 'ce-lqrow ce-liquid')
  const advSlot = el('div', 'ce-lq-adv')
  row.append(bar, advSlot)
  liquidize(row, { items: () => [bar, advSlot.firstElementChild].filter(Boolean), inflate: 0 })
  const wrap = el('div', 'ce-elemwrap')
  wrap.append(menu, row)
  document.body.append(wrap)
  setMode(initial, { silent: true })
  return { root: wrap, setMode, advSlot }
}
