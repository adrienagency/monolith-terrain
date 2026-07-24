// L'espace « Studio » (UX P2, Adrien) — nom interne « atelier » pour éviter la
// collision avec studio.js (le Race Studio). Espace morphé de CRÉATION :
// colonne gauche (Palettes / Templates / Ciel), carte vivante à droite.
// Contrairement à la boutique, PAS de snapshot : on vient styliser SA carte,
// les changements persistent. « Boutique » et « Quitter » sont les sorties.
import './atelier.css'
import { makeMorph } from './panel-morph.js'

const CATALOG_URL = '/templates/data.json'
// Templates PAR DÉFAUT = de vrais fichiers .shibumap-template (look COMPLET +
// vignette), pas des rampes de couleurs — distinction importante (Adrien) :
// palette = couleurs seules, template = tout le look. Fichiers dans
// public/templates/defaults/, chargés au premier passage sur l'onglet.
const DEFAULT_TPL_URLS = [
  'the-main-stuff', 'isolated', 'light', 'realistic',
  'bronze', 'white-valley', 'yellow-glass', 'carbon',
].map((n) => `/templates/defaults/${n}.json`)

export function buildAtelier(deps) {
  let open = false
  let section = 'palettes'
  let shop = null // aperçu boutique (8 palettes), chargé au premier enter
  let defTpls = null // templates par défaut (fichiers complets), chargés à la demande

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

  // Loader discret au centre de la carte pendant qu'un template s'applique :
  // le double rAF laisse le spinner se peindre AVANT le gros travail synchrone
  // (rebuild matériaux/rampe), puis 500 ms de grâce pour les textures async
  // (PBR, HDRI) avant de s'effacer.
  const loader = document.createElement('div')
  loader.className = 'at-loading'
  loader.innerHTML = '<i></i>'
  let loaderT = 0
  // rAF peut ne JAMAIS venir (onglet caché → zéro frame, cf. panel-morph) :
  // fallback timeout pour que l'application du template parte quoi qu'il arrive
  const nextFrame = (cb) => {
    let done = false
    const go = () => { if (!done) { done = true; cb() } }
    requestAnimationFrame(go)
    setTimeout(go, 80)
  }
  function applyWithLoader(fn) {
    const app = document.getElementById('app')
    if (!app.contains(loader)) app.append(loader)
    loader.classList.add('on')
    clearTimeout(loaderT)
    nextFrame(() => nextFrame(() => {
      Promise.resolve().then(fn).finally(() => {
        loaderT = setTimeout(() => loader.classList.remove('on'), 500)
      })
    }))
  }

  // carte template : vignette image si disponible, sinon bande de couleurs.
  // La vignette vient du fichier (dataURL user-supplied) → DOM APIs, pas innerHTML.
  function tplCard(t) {
    const c = document.createElement('button')
    c.type = 'button'
    c.className = 'at-card at-tpl'
    if (t.thumb) {
      // pas de loading=lazy : la vignette est une dataURL déjà en mémoire
      const img = document.createElement('img')
      img.src = t.thumb
      img.alt = ''
      c.append(img)
    } else {
      c.insertAdjacentHTML('afterbegin', strip((t.strip || []).filter((x) => /^#/.test(x))))
    }
    const nm = document.createElement('span')
    nm.className = 'at-nm'
    nm.textContent = t.name || 'Look'
    c.append(nm)
    c.addEventListener('click', () => applyWithLoader(() => deps.applyUserTemplate(t)))
    return c
  }

  async function loadDefaultTemplates() {
    const all = await Promise.all(DEFAULT_TPL_URLS.map(async (u) => {
      try {
        const t = await (await fetch(u)).json()
        return t?.format === 'shibumap-template' && t.look ? t : null
      } catch { return null }
    }))
    defTpls = all.filter(Boolean)
  }

  function secTemplates() {
    body.innerHTML = `<h3>Templates</h3>
      <p class="hint">Un template applique un look complet (couleurs, lumière, matières, ciel…) — vos looks enregistrés se rangent ici.</p>`
    if (!defTpls) {
      body.insertAdjacentHTML('beforeend', '<p class="hint">Chargement…</p>')
      loadDefaultTemplates().then(() => { if (open && section === 'templates') render() })
      return
    }
    const g = document.createElement('div')
    g.className = 'at-grid'
    for (const t of defTpls) g.append(tplCard(t))
    body.append(g)
    const mine = deps.getUserTemplates() || []
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vos templates</div>')
      const g2 = document.createElement('div')
      g2.className = 'at-grid'
      for (const t of mine) g2.append(tplCard(t))
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
