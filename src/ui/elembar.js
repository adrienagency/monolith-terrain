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

// simpleCore (optionnel) : le cœur du MODE SIMPLE (Habiller ma carte / Ma
// course, construit par bars.js) — hébergé dans la même rangée liquide pour
// que le fond MORPHE d'un niveau à l'autre au switch Avancé
// bottomBar (optionnel) : le cartouche du bas (recherche de lieu + GPX,
// construit par bars.js). Il est ADOPTÉ dans la même rangée liquide — le goo
// ne fusionne que des bulles d'un même calque, donc c'est la seule façon de
// tendre un pont entre les deux barres.
export function buildElemBar({ modes, initial, onMode, toolsByMode, simpleCore, bottomBar }) {
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

  // ---- UNE SEULE barre : capsule + « Avancé » en haut, cartouche du bas,
  // et un PONT de liquide qui relie les deux à l'aplomb du mode actif et
  // voyage avec lui (maquette validée Adrien).
  // La rangée est alignée en HAUT À GAUCHE : son origine est donc celle de
  // l'ensemble capsule + Avancé — toute la géométrie se calcule à partir de
  // là, sans dépendre de la largeur courante de la rangée. C'est aussi ce qui
  // recentre l'ensemble (avant, seule la capsule était centrée et « Avancé »
  // débordait de 105 px sans être compté : la masse penchait à droite).
  const row = el('div', 'ce-lqrow ce-liquid')
  const top = el('div', 'ce-lqtop')
  const advSlot = el('div', 'ce-lq-adv')
  top.append(bar, ...(simpleCore ? [simpleCore] : []), advSlot)
  row.append(top)
  const bb = bottomBar?.root || null
  if (bb) {
    // adoptée : elle perd son verre (la bulle du goo DEVIENT son fond —
    // porcelaine opaque, imposé par le seuil d'alpha du filtre) et son
    // ancrage fixe (la rangée la place désormais)
    bb.classList.remove('ce-glassbox', 'ce-bb-loose')
    row.append(bb)
  }
  // ACCUEIL (body.ce-hub) : la MÊME barre, en grand au centre de l'écran. Elle
  // montre alors toujours le CŒUR SIMPLE — l'accueil pose une question, il
  // n'expose pas un niveau d'outillage ; la préférence « Avancé » n'est pas
  // touchée, elle reprend la main dès que la barre est redescendue.
  const isHome = () => document.body.classList.contains('ce-hub')
  const isSimple = () => isHome() || document.body.classList.contains('ce-simple')
  // en accueil, aucun mode n'a encore été choisi : le pont se pose sous la
  // porte SURVOLÉE (et sous « Explorer », l'état de repos, quand rien ne l'est)
  let hoverBtn = null
  const activeBtn = () => {
    if (isHome() && hoverBtn?.offsetParent) return hoverBtn
    return (isSimple() && simpleCore ? simpleCore : modeSeg).querySelector('.ce-wm-btn.on')
  }

  // --- géométrie ANALYTIQUE du pont et du cartouche du bas ------------------
  // BITE : le pont MORD de 10 px dans chacune des deux barres. Sans ce
  // recouvrement, le seuil d'alpha du goo coupe la jonction et le pont se
  // détache en deux moignons (enseignement de la maquette).
  // Tout est CALCULÉ à partir de ce qui ne bouge pas (la capsule, le bouton du
  // mode actif, la largeur du bouton GPX) : jamais d'un rect relu pendant une
  // transition, sinon les bulles suivent avec un tour de retard.
  const BITE = 10
  const BRIDGE_W = 26
  const vars = Object.create(null)
  // n'écrire une variable que si elle CHANGE : liquidize observe les attributs
  // de la rangée — réécrire le même style à chaque sync bouclerait à l'infini
  // (observer → sync → observer).
  const setVar = (n, v) => { if (vars[n] !== v) { vars[n] = v; row.style.setProperty(n, v) } }

  let gapPx = 14
  function geometry() {
    // bb masquée par un contexte (viewer shibu, boutique…) : pas de pont, la
    // capsule se retrouve seule — exactement comme avant la fusion
    if (!bb || !bb.offsetParent) return null
    const base = row.getBoundingClientRect()
    if (!base.width) return null // rangée masquée — rien à dessiner
    const t = top.getBoundingClientRect()
    const tw = t.width
    const th = t.height
    if (!tw || !th) return null
    const g = parseFloat(getComputedStyle(row).rowGap)
    if (Number.isFinite(g) && g > 0) gapPx = g
    const btn = activeBtn()
    const cx = btn && btn.offsetParent
      ? btn.getBoundingClientRect().left - base.left + btn.offsetWidth / 2
      : tw / 2
    // En Parcours le champ se replie : on ne cherche pas un lieu pour bâtir
    // une course. Il se rouvre dès qu'il prend le focus (raccourci « / »).
    // JAMAIS display:none — liquidize élimine les items dont offsetParent est
    // nul et supprime leur bulle d'un coup, sans transition.
    // en accueil le champ reste GRAND OUVERT quoi qu'on survole : « Rechercher
    // un lieu… » est une des propositions de la page, pas l'accessoire d'un mode
    const narrow = !isHome() && !row.classList.contains('bb-open') && btn?.dataset.mode === 'parcours'
    bb.classList.toggle('narrow', narrow)
    const cs = getComputedStyle(bb)
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const gpxW = bottomBar?.gpx?.offsetWidth || 0
    // largeur du cartouche du bas = celle de l'ENSEMBLE capsule + Avancé,
    // resserrée sur GPX seul en Parcours (largeur CALCULÉE, pas relue)
    const full = Math.min(tw, window.innerWidth - 24)
    const bw = Math.round(narrow && gpxW ? pad + gpxW : full)
    const bh = bb.offsetHeight || th
    const bx = Math.round(narrow ? Math.max(0, Math.min(tw - bw, cx - bw / 2)) : (tw - bw) / 2)
    setVar('--ce-bb-w', bw + 'px')
    setVar('--ce-bb-x', bx + 'px')
    return {
      bottom: { x: bx, y: Math.round(th + gapPx), w: bw, h: Math.round(bh) },
      bridge: {
        x: Math.round(cx - BRIDGE_W / 2),
        y: Math.round(th - BITE),
        w: BRIDGE_W,
        h: Math.round(gapPx + BITE * 2),
      },
    }
  }

  const lq = liquidize(row, {
    // bulle '__core' STABLE : elle pointe vers le niveau visible (capsule
    // avancée OU cœur simple) — au switch, la même bulle transitionne vers
    // la nouvelle géométrie à travers le goo = morph liquide du fond.
    // '__bridge' et '__bottom' sont des clés tout aussi STABLES du MÊME
    // calque : elles morphent, elles ne sont jamais recréées.
    items: () => {
      const g = geometry()
      return [
        { key: '__core', el: isSimple() && simpleCore ? simpleCore : bar },
        // la bulle mesure le SLOT (pleine hauteur), pas le bouton — le bouton
        // garde une pastille de survol EN RETRAIT comme les autres (Adrien)
        { key: '__adv', el: advSlot },
        ...(g ? [{ key: '__bridge', box: g.bridge }, { key: '__bottom', box: g.bottom }] : []),
      ]
    },
    inflate: 0,
    // la coche liquide chevauche le choix ACTIF des DEUX niveaux et voyage
    bumpFor: activeBtn,
    rim: true, // liseré métal liquide sur le pourtour (adapté à la palette)
  })
  const wrap = el('div', 'ce-elemwrap')
  wrap.append(menu, row)
  document.body.append(wrap)
  if (bottomBar?.input) {
    bottomBar.input.addEventListener('focus', () => { row.classList.add('bb-open'); lq.refresh() })
    bottomBar.input.addEventListener('blur', () => { row.classList.remove('bb-open'); lq.refresh() })
  }
  // le pont suit le doigt en accueil — hors accueil, activeBtn ignore hoverBtn
  if (simpleCore) {
    simpleCore.addEventListener('pointerover', (e) => {
      const b = e.target.closest?.('.ce-wm-btn')
      if (b === hoverBtn) return
      hoverBtn = b || null
      if (isHome()) lq.refresh()
    })
    simpleCore.addEventListener('pointerleave', () => {
      if (!hoverBtn) return
      hoverBtn = null
      if (isHome()) lq.refresh()
    })
  }

  // --- le VOYAGE entre les deux états ---------------------------------------
  // Pendant le trajet, les bulles COLLENT à leur contenu : leur transition est
  // coupée (.lq-travel) et on les repose à chaque frame. Toute la courbe est
  // donc portée par les éléments HTML — une seule courbe, littéralement le même
  // mouvement, le fond ne peut pas décoller du texte. (Les laisser transitionner
  // pendant que le layout bouge les ferait courir après avec un tour de retard.)
  const TRAVEL_MS = 420 // 340 de courbe + une marge pour la dernière frame
  let travelRaf = 0
  let travelEnd = 0
  function travel() {
    travelEnd = performance.now() + TRAVEL_MS
    if (travelRaf) return
    row.classList.add('lq-travel')
    const step = () => {
      lq.sync()
      if (performance.now() < travelEnd) { travelRaf = requestAnimationFrame(step); return }
      travelRaf = 0
      row.classList.remove('lq-travel')
      lq.refresh()
    }
    travelRaf = requestAnimationFrame(step)
  }
  function setHome(on) {
    const next = !!on
    if (document.body.classList.contains('ce-hub') === next) return
    document.body.classList.toggle('ce-hub', next)
    if (!next) hoverBtn = null
    travel()
  }

  setMode(initial, { silent: true })
  return { root: wrap, row, setMode, advSlot, refresh: lq.refresh, setHome, isHome }
}
