// L'espace « Studio » (UX P2, Adrien) — nom interne « atelier » pour éviter la
// collision avec studio.js (le Race Studio). Espace morphé de CRÉATION :
// colonne gauche (Palettes / Templates / Ciel), carte vivante à droite.
// Contrairement à la boutique, PAS de snapshot : on vient styliser SA carte,
// les changements persistent. « Boutique » et « Quitter » sont les sorties.
import './atelier.css'
import { makeMorph } from './panel-morph.js'
import { TEMPLATES } from '../templates.js'

const CATALOG_URL = '/templates/data.json'

export function buildAtelier(deps) {
  let open = false
  let section = 'palettes'
  let shop = null // aperçu boutique (8 palettes), chargé au premier enter

  const morph = makeMorph({ modeClass: 'atelier-mode', onSettle: () => window.dispatchEvent(new Event('resize')) })

  const col = document.createElement('aside')
  col.className = 'atelier-col'
  col.innerHTML = `
    <div class="studio-head">
      <h2>ShibuMap<span class="dot">.</span> <em>Studio</em></h2>
      <button class="studio-close" title="Fermer">✕</button>
    </div>
    <div class="at-chips">
      <button type="button" data-s="palettes" class="on">Palettes</button>
      <button type="button" data-s="templates">Templates</button>
      <button type="button" data-s="ciel">Ciel</button>
    </div>
    <div class="studio-body at-body"></div>
    <div class="studio-bar">
      <button class="studio-btn ghost at-quit">Quitter</button>
      <span class="spacer"></span>
      <button class="studio-btn accent at-shop">Boutique de templates</button>
    </div>`
  const body = col.querySelector('.at-body')

  const caption = document.createElement('div')
  caption.className = 'studio-caption at-caption'
  caption.textContent = 'Aperçu en direct — votre carte'

  const strip = (stops) => `<span class="at-strip">${stops.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`

  function palCard(p) {
    const c = document.createElement('button')
    c.type = 'button'
    c.className = 'at-card'
    c.innerHTML = `${strip(p.rampStops.map((s) => s.c))}<span class="at-nm">${p.name}</span>`
    c.addEventListener('click', () => deps.applyPalette({ rampStops: p.rampStops, oceanShallow: p.oceanShallow, oceanMid: p.oceanMid, oceanDeep: p.oceanDeep, ink: p.ink }))
    return c
  }

  function secPalettes() {
    body.innerHTML = `<h3>Palettes</h3>
      <p class="hint">Générez, essayez en direct, enregistrez — vos palettes validées restent ici.</p>`
    const row = document.createElement('div')
    row.className = 'studio-row'
    let lastGen = null
    const bGen = document.createElement('button')
    bGen.type = 'button'
    bGen.className = 'studio-btn'
    bGen.textContent = 'Générer une palette'
    bGen.addEventListener('click', () => { const p = deps.generatePalette(); lastGen = p.name; deps.applyPalette(p) })
    const bSave = document.createElement('button')
    bSave.type = 'button'
    bSave.className = 'studio-btn ghost'
    bSave.textContent = 'Enregistrer'
    bSave.addEventListener('click', () => { deps.saveCurrentPalette(lastGen); lastGen = null; render() })
    row.append(bGen, bSave)
    body.append(row)
    const mine = deps.userPalettes() || []
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vos palettes</div>')
      const g = document.createElement('div')
      g.className = 'at-grid'
      for (const p of mine) g.append(palCard(p))
      body.append(g)
    }
    if (shop?.palettes?.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Aperçu de la boutique</div>')
      const g = document.createElement('div')
      g.className = 'at-grid'
      for (const p of shop.palettes.slice(0, 8)) g.append(palCard(p))
      body.append(g)
    }
  }

  function secTemplates() {
    body.innerHTML = `<h3>Templates</h3>
      <p class="hint">Un clic restyle toute la carte — vos looks enregistrés se rangent ici.</p>`
    const g = document.createElement('div')
    g.className = 'at-grid'
    for (const key of Object.keys(TEMPLATES)) {
      const t = TEMPLATES[key]
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'at-card'
      const stops = t.palette?.rampStops?.map((s) => s.c) ?? []
      c.innerHTML = `${strip(stops)}<span class="at-nm">${(t.label ?? key).replace(/-/g, ' ')}</span>`
      c.addEventListener('click', () => deps.applyTemplate(t))
      g.append(c)
    }
    body.append(g)
    const mine = deps.getUserTemplates() || []
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vos templates</div>')
      const g2 = document.createElement('div')
      g2.className = 'at-grid'
      for (const t of mine) {
        const c = document.createElement('button')
        c.type = 'button'
        c.className = 'at-card'
        c.innerHTML = `${strip((t.strip || []).filter((x) => /^#/.test(x)))}<span class="at-nm">${t.name || 'Look'}</span>`
        c.addEventListener('click', () => deps.applyUserTemplate(t))
        g2.append(c)
      }
      body.append(g2)
    }
  }

  function secCiel() {
    body.innerHTML = `<h3>Ciel (HDRI)</h3>
      <p class="hint">Un ciel prend en main le fond et la lumière — « Aucun » rend la main au fond uni.</p>`
    const g = document.createElement('div')
    g.className = 'at-grid at-grid-3'
    const cur = deps.getBgEnv()
    const tile = (id, label, inner) => {
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'at-card at-sky' + (cur === id ? ' on' : '')
      c.innerHTML = `${inner}<span class="at-nm">${label}</span>`
      c.addEventListener('click', () => { deps.setBgEnv(id); render() })
      return c
    }
    g.append(tile('', 'Aucun', '<span class="at-sky-none"></span>'))
    for (const e of deps.environments) g.append(tile(e.id, e.label, `<img src="${e.thumb}" alt="" loading="lazy">`))
    body.append(g)
  }

  function render() {
    col.querySelectorAll('.at-chips button').forEach((b) => b.classList.toggle('on', b.dataset.s === section))
    if (section === 'palettes') secPalettes()
    else if (section === 'templates') secTemplates()
    else secCiel()
  }

  col.querySelectorAll('.at-chips button').forEach((b) => b.addEventListener('click', () => { section = b.dataset.s; render() }))

  async function enter() {
    if (open) return
    open = true
    if (!col.isConnected) document.body.append(col, caption)
    morph.enter()
    if (!shop) {
      try { shop = await (await fetch(CATALOG_URL)).json() } catch { shop = { palettes: [] } }
    }
    render()
  }
  function exit() {
    if (!open) return
    open = false
    morph.exit() // les changements PERSISTENT — on est venu styliser sa carte
  }

  col.querySelector('.at-quit').addEventListener('click', exit)
  col.querySelector('.studio-close').addEventListener('click', exit)
  col.querySelector('.at-shop').addEventListener('click', () => { exit(); setTimeout(() => deps.openStore(), 700) })
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') exit() })

  return { enter, exit, isOpen: () => open }
}
