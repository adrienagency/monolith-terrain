// PARCOURS panel — LA porte grand public pour « mettre une course sur la
// carte » (passe UX : le panneau et le Race Studio ne se marchent plus
// dessus). Deux états exclusifs :
//   VIDE   → les 4 portes du wizard léger validé (Charger ma course /
//            Ouvrir un projet / Essayer la démo / Dessiner — bientôt) ;
//   CHARGÉ → Lecture en tête (sans lecture la carte ne sert à rien),
//            puis 3 sections repliées PARLANTES : Mes courses / Style du
//            tracé (chips) / Options de lecture.
// Le Race Studio garde sa vie propre : il n'apparaît ici QUE comme la carte
// « Organisateur de course ? » en pied de panneau (plus de bouton accent
// noyé dans une section). Zéro moteur touché — mêmes appels gpx qu'avant.

import { slider, color, toggle, visibleWhen, button, section, el, refreshAll, onRefresh } from './kit.js'
import { Panel } from './shell.js'
import { SPORTS, getSport } from './sport-icons.js'
import { MAX_LAYERS } from '../gpx-layers.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19c3-6 5-9 8-9s3 5 8 5"/><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>'

const DRAG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>'
const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.2A10.9 10.9 0 0 1 12 5c6.2 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4M6.5 6.7C3.4 8.8 2 12 2 12s3.8 7 10 7c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 8l5-5 5 5M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/></svg>'
const FLAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>'

// presets d'épaisseur du tracé — le réglage STAR en chips (règle constante) ;
// détection par proximité de la valeur courante, jamais d'état stocké
const WIDTH_PRESETS = [
  { id: 'fine', label: 'Fine', v: 1.5, tip: 'Un trait discret — la carte d’abord.' },
  { id: 'classique', label: 'Classique', v: 3, tip: 'L’équilibre par défaut.' },
  { id: 'epaisse', label: 'Épaisse', v: 5, tip: 'La trace en vedette, lisible de loin.' },
]
const widthPresetOf = (params) => WIDTH_PRESETS.find((p) => Math.abs((params.gpxWidth ?? 3) - p.v) <= 0.3)

export function buildRoutePanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Parcours',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Ta course sur le relief : charge une trace, la lecture fait le reste.',
  })

  // ---- Lecture — en tête, TOUJOURS visible dès qu'une course est chargée
  // (Adrien : « sans la lecture, la carte ne sert à rien »). Les options de
  // suivi vivent dans la section « Options de lecture » plus bas.
  const playRow = el('div', 'ce-btn-row')
  const playBtn = button('▶ Lecture', () => {
    if (!ctx.gpx.track) return
    if (ctx.gpx.isPlaying()) {
      ctx.gpx.pause()
      ctx.stopFollow?.()
    } else {
      ctx.gpx.play()
      ctx.startFollow?.()
    }
    syncPlayBtn()
  }, { accent: true })
  const stopBtn = button('■ Stop', () => {
    ctx.gpx.stop()
    ctx.stopFollow?.()
    syncPlayBtn()
  }, { ghost: true })
  const exitFollowBtn = button('✕ Quitter le suivi', () => {
    params.gpxFollow = false
    ctx.stopFollow?.()
    refreshAll()
    syncPlayBtn()
  }, { ghost: true })
  exitFollowBtn.classList.add('ce-exit-follow')
  exitFollowBtn.title = 'Reprendre la caméra à la main'
  function syncPlayBtn() {
    const playing = !!ctx.gpx.isPlaying?.()
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Lecture'
    playBtn.classList.toggle('on', playing)
    exitFollowBtn.style.display = playing && params.gpxFollow ? '' : 'none'
  }
  syncPlayBtn()
  setInterval(syncPlayBtn, 200)
  playRow.append(playBtn, stopBtn, exitFollowBtn)
  panel.add(playRow)

  // ---- Les PORTES (état vide) — la hiérarchie wizard léger validée :
  // ① charger son GPX (accent — le cas le plus fréquent) ② rouvrir un
  // projet ③ pas de trace ? la démo ④ dessiner (badge « bientôt »).
  const doors = el('div', 'ce-route-doors')
  const door = (title, sub, { accent = false, soon = false } = {}) => {
    const d = el('button', 'ce-door' + (accent ? ' accent' : '') + (soon ? ' soon' : ''))
    d.type = 'button'
    d.disabled = soon
    d.innerHTML = `<span class="ce-door-main"><b>${title}</b><i>${sub}</i></span>${soon ? '<span class="ce-door-badge">bientôt</span>' : ''}`
    return d
  }
  const dLoad = door('Charger ma course (GPX)', 'Ta trace, depuis ton ordinateur — le relief se cadre tout seul.', { accent: true })
  dLoad.addEventListener('click', () => ctx.loadGpx())
  const dOpen = door('Ouvrir un projet ShibuMap', 'Un fichier .shibumap-race — trace, points de passage et style, tout revient.')
  dOpen.addEventListener('click', () => ctx.loadGpx())
  const dDemo = door('Pas encore de trace ? La démo', 'La Grande Traversée · 220 km, prête à jouer — remplace-la ensuite.')
  dDemo.addEventListener('click', async () => {
    dDemo.disabled = true
    dDemo.querySelector('i').textContent = 'Chargement de la démo…'
    try { await ctx.loadDemo?.() } catch {}
    dDemo.disabled = false
    dDemo.querySelector('i').textContent = 'La Grande Traversée · 220 km, prête à jouer — remplace-la ensuite.'
  })
  const dDraw = door('Dessiner sur la carte', 'Clique les passages clés, la trace suit le terrain.', { soon: true })
  doors.append(dLoad, dOpen, dDemo, dDraw)
  panel.add(doors)

  // ------------------------------------------------------------ Mes courses
  // task 22 §1/2 : les traces GPX en calques « comme dans Figma » — réordonner
  // par glisser, icône sport par course, œil, infos course, retirer. Le style
  // reste GLOBAL (voir gpx-layers.js) : ici ne vit que l'identité par course.
  const sLayers = panel.addSection(section('Mes courses'))
  const listEl = el('div', 'ce-gpx-layers')
  const addCard = el('button', 'ce-lib-add')
  addCard.type = 'button'
  addCard.innerHTML = '<span>＋</span>Ajouter une course'
  addCard.addEventListener('click', () => ctx.loadGpx())
  sLayers.body.append(listEl, addCard)

  let openPickerId = null // which row's icon picker is expanded (one at a time)
  let dragFromIndex = null

  function iconMarkupFor(l) {
    // a custom (uploaded) icon has no inline SVG to show in the row itself
    // (it's a rasterized texture, not markup) — a generic "custom image"
    // glyph stands in so the row still reads as "this one has its own icon"
    if (l.customIconTex) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8" fill="currentColor" stroke="none"/><path d="M21 15l-5-5-11 11"/></svg>'
    return getSport(l.sport).svg
  }

  function renderLayers(layers) {
    listEl.replaceChildren()
    // section repliée PARLANTE : le nom de la course, ou combien il y en a
    const first = layers[0]?.name || 'Course'
    sLayers.setMeta(layers.length === 0 ? '' : layers.length === 1 ? (first.length > 20 ? first.slice(0, 19) + '…' : first) : `${layers.length} courses`)
    const full = layers.length >= MAX_LAYERS
    addCard.disabled = full
    addCard.innerHTML = full ? `<span>＋</span>Maximum atteint (${MAX_LAYERS})` : '<span>＋</span>Ajouter une course'

    layers.forEach((l, idx) => {
      const row = el('div', 'ce-gpx-layer' + (idx === ctx.gpx.activeIndex ? ' active' : ''))
      row.draggable = true
      row.dataset.id = l.id

      const dragHandle = el('span', 'ce-gpx-drag')
      dragHandle.innerHTML = DRAG_ICON
      dragHandle.title = 'Glisser pour réordonner'

      const iconBtn = el('button', 'ce-gpx-icon-btn')
      iconBtn.type = 'button'
      iconBtn.title = 'Changer l’icône'
      iconBtn.innerHTML = iconMarkupFor(l)
      iconBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        openPickerId = openPickerId === l.id ? null : l.id
        renderLayers(ctx.gpx.layers)
      })

      const nameInput = el('input', 'ce-tpl-name ce-gpx-lname')
      nameInput.type = 'text'
      nameInput.value = l.name || ''
      nameInput.maxLength = 40
      nameInput.addEventListener('click', (e) => e.stopPropagation())
      const commitName = () => ctx.gpx.setName(l.id, nameInput.value)
      nameInput.addEventListener('blur', commitName)
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); nameInput.blur() }
      })

      const eyeBtn = el('button', 'ce-icon-btn ce-gpx-eye')
      eyeBtn.type = 'button'
      eyeBtn.title = l.visible ? 'Masquer cette course' : 'Afficher cette course'
      eyeBtn.innerHTML = l.visible ? EYE_ICON : EYE_OFF_ICON
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        ctx.gpx.setLayerVisible(l.id, !l.visible)
      })

      // infos course (cartouches Race Studio) — actives par défaut ; l'œil
      // fermé les coupe aussi (voir getItems, main.js)
      const raceBtn = el('button', 'ce-icon-btn ce-gpx-race' + (l.showRaceInfo === false ? '' : ' on'))
      raceBtn.type = 'button'
      raceBtn.title = l.showRaceInfo === false ? 'Afficher les infos course' : 'Masquer les infos course'
      raceBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="14" height="8" rx="2"/><path d="M17 10h4M6 10h6"/></svg>'
      raceBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        l.showRaceInfo = l.showRaceInfo === false
        ctx.refreshRaceLabels?.()
        renderLayers(ctx.gpx.layers)
      })

      const removeBtn = el('button', 'ce-icon-btn ce-gpx-remove')
      removeBtn.type = 'button'
      removeBtn.title = 'Retirer cette course'
      removeBtn.textContent = '✕'
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        ctx.gpx.removeLayer(l.id)
      })

      row.append(dragHandle, iconBtn, nameInput, raceBtn, eyeBtn, removeBtn)
      // clicking the row (but not one of its controls) focuses this layer —
      // Points/Playback/Race-name below all act on whichever layer is focused
      row.addEventListener('click', (e) => {
        if (e.target.closest('button, input')) return
        ctx.gpx.focus(l.id)
      })

      // drag/drop reorder — "comme dans Figma": grab a row, drop it where it
      // should land. reorder() re-derives BOTH render stacking and sequenced
      // playback order from the same list (see gpx-layers.js), so dropping a
      // row also changes what plays first.
      row.addEventListener('dragstart', (e) => {
        dragFromIndex = idx
        e.dataTransfer.effectAllowed = 'move'
        row.classList.add('dragging')
      })
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging')
        dragFromIndex = null
      })
      row.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      })
      row.addEventListener('drop', (e) => {
        e.preventDefault()
        if (dragFromIndex == null || dragFromIndex === idx) return
        ctx.gpx.reorder(dragFromIndex, idx)
      })

      listEl.append(row)

      if (openPickerId === l.id) {
        const picker = el('div', 'ce-gpx-iconpicker')
        for (const s of SPORTS) {
          const b = el('button', 'ce-gpx-iconopt' + (l.sport === s.key && !l.customIconTex ? ' on' : ''))
          b.type = 'button'
          b.title = s.label
          b.innerHTML = s.svg
          b.addEventListener('click', (e) => {
            e.stopPropagation()
            openPickerId = null
            ctx.gpx.setSport(l.id, s.key) // triggers onChange -> re-render, closing the picker
          })
          picker.append(b)
        }
        const upBtn = el('button', 'ce-gpx-iconopt ce-gpx-iconupload')
        upBtn.type = 'button'
        upBtn.title = 'Importer une icône (SVG ou image)'
        upBtn.innerHTML = UPLOAD_ICON
        upBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          openPickerId = null
          renderLayers(ctx.gpx.layers) // close the picker immediately; upload itself is async
          ctx.uploadIcon?.(l.id)
        })
        picker.append(upBtn)
        listEl.append(picker)
      }
    })
  }

  // nom éditorial de la course FOCALISÉE (task 22 §7) — affiché au-dessus de
  // SON profil (gpx.js .gpx-race-name). Re-synchronisé à chaque changement de
  // focus, y compris ceux que la lecture séquencée déclenche toute seule.
  const raceNameRow = el('div', 'ce-row')
  raceNameRow.append(el('label', 'ce-label', 'Nom de la course'))
  const raceNameInput = el('input', 'ce-tpl-name')
  raceNameInput.type = 'text'
  raceNameInput.maxLength = 60
  raceNameInput.placeholder = 'ex : UTMB — CHAMONIX 2026'
  const commitRaceName = () => ctx.gpx.setRaceName(raceNameInput.value)
  raceNameInput.addEventListener('blur', commitRaceName)
  raceNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); raceNameInput.blur() }
  })
  raceNameRow.append(raceNameInput)
  sLayers.body.append(raceNameRow)

  function syncRaceName() {
    raceNameInput.disabled = !ctx.gpx.activeLayer
    // never stomp text the user is actively editing
    if (document.activeElement !== raceNameInput) raceNameInput.value = ctx.gpx.raceName || ''
  }

  // -------------------------------------------------------- Style du tracé
  // Le réglage star (épaisseur) en CHIPS, le curseur fin dessous, la couleur
  // ensuite. Dégradé/halo/points de passage restent au Race Studio (étape
  // Style) — décision Adrien conservée, on ne re-duplique pas.
  const sStyle = panel.addSection(section('Style du tracé'))
  const chipRow = el('div', 'ce-chiprow')
  const chips = WIDTH_PRESETS.map((p) => {
    const b = el('button', 'ce-chip', p.label)
    b.type = 'button'
    b.setAttribute('data-tip', p.tip)
    b.addEventListener('click', () => {
      params.gpxWidth = p.v
      ctx.gpx.setWidth(p.v)
      refreshAll()
    })
    chipRow.append(b)
    return b
  })
  onRefresh(() => {
    const cur = widthPresetOf(params)
    WIDTH_PRESETS.forEach((p, i) => chips[i].classList.toggle('on', cur === p))
  }, chipRow)
  const colorRow = color({
    label: 'Couleur',
    get: () => params.gpxColor || params.hudAccent,
    set: (v) => { params.gpxColor = v; ctx.gpx.setColor(v) },
  })
  // Honesty fix: when the gradient ramp is on, gpx.js rebuild() forces the
  // line material's base colour to white and drives it from per-vertex
  // gradient colours instead (see its comment) — the Colour swatch would
  // silently do nothing while that's active. Rather than ship a control that
  // lies about having an effect, only surface it while Gradient is off.
  visibleWhen(colorRow, () => !params.gpxGradient)
  sStyle.body.append(
    chipRow,
    colorRow,
    // réglage fin — la mécanique au fond, sous les chips (règle constante)
    slider({
      label: 'Épaisseur',
      min: 1,
      max: 8,
      step: 0.5,
      get: () => params.gpxWidth,
      set: (v) => { params.gpxWidth = v; ctx.gpx.setWidth(v) },
    })
  )
  onRefresh(() => {
    const cur = widthPresetOf(params)
    const w = cur ? cur.label : `${params.gpxWidth} px`
    const swatch = params.gpxGradient ? 'linear-gradient(90deg,#2e7d32,#e53935)' : (params.gpxColor || params.hudAccent)
    sStyle.setMeta(params.gpxGradient ? `Dégradé · ${w}` : w, swatch)
  }, sStyle.root)

  // ------------------------------------------------------ Options de lecture
  // La lecture elle-même vit en tête de panneau ; ici seulement le suivi
  // caméra et les affichages en direct (altitude/pente à la tête de lecture).
  const sPlay = panel.addSection(section('Options de lecture', { open: false }))
  const followSpeedRow = slider({
    label: 'Vitesse du suivi',
    min: 0.5,
    max: 3,
    step: 0.25,
    get: () => params.gpxFollowSpeed,
    set: (v) => { params.gpxFollowSpeed = v },
  })
  visibleWhen(followSpeedRow, () => params.gpxFollow)
  sPlay.body.append(
    toggle({
      label: 'Altitude en direct',
      get: () => params.gpxAltReadout,
      set: (v) => ctx.gpx.setAltReadout(v),
    }),
    toggle({
      label: 'Pente en direct',
      get: () => params.gpxSlopeReadout,
      set: (v) => ctx.gpx.setSlopeReadout(v),
    }),
    toggle({
      // drone-cam chase, not a flat top-down follow — trails the reveal
      // head with the same smooth easing as "Fly the GPX track" (Camera
      // panel), just synced frame-for-frame to playback instead of timed.
      // Libellé « Suivi » tout court (task 24 — « Drone » barré par Adrien).
      label: 'Suivi',
      get: () => params.gpxFollow,
      set: (v) => {
        params.gpxFollow = v
        if (v) ctx.startFollow?.()
        else ctx.stopFollow?.()
        refreshAll() // reveals/hides the Follow-speed slider right away
      },
    }),
    followSpeedRow
  )
  onRefresh(() => {
    const parts = [params.gpxFollow ? `Suivi ×${params.gpxFollowSpeed}` : 'Caméra libre']
    if (params.gpxAltReadout) parts.push('altitude')
    if (params.gpxSlopeReadout) parts.push('pente')
    sPlay.setMeta(parts.join(' · '))
  }, sPlay.root)

  // ---- « Organisateur de course ? » — LA porte claire vers le Race Studio
  // (points de passage, transports, partage). Toujours visible, en pied de
  // panneau — le wizard garde sa vie propre (?studio=1 continue de marcher).
  const orga = el('button', 'ce-orga')
  orga.type = 'button'
  orga.innerHTML = `${FLAG_ICON}<span class="ce-door-main"><b>Organisateur de course ?</b><i>Points de passage, transports, partage — ouvre le Race Studio.</i></span><span class="ce-orga-arrow">→</span>`
  orga.addEventListener('click', () => ctx.openStudio?.())
  panel.add(orga)

  // ---- deux états exclusifs : portes (vide) ↔ lecture + sections (chargé)
  function syncState() {
    const has = ctx.gpx.layers.length > 0
    doors.style.display = has ? 'none' : ''
    playRow.style.display = has ? '' : 'none'
    for (const s of [sLayers, sStyle, sPlay]) s.root.style.display = has ? '' : 'none'
  }

  renderLayers(ctx.gpx.layers)
  syncRaceName()
  syncState()

  // gpx-layers.js's onChange/onFocusChange are single-slot hooks — main.js
  // already claimed onChange (per-layer draggable profile wiring, see its
  // own comment) before this panel is built, so CHAIN rather than
  // overwrite: both run, in the order they were registered.
  const prevOnChange = ctx.gpx.onChange
  ctx.gpx.onChange = (layers) => {
    prevOnChange?.(layers)
    renderLayers(layers)
    syncRaceName()
    syncState()
  }
  const prevOnFocusChange = ctx.gpx.onFocusChange
  ctx.gpx.onFocusChange = (layer, idx) => {
    prevOnFocusChange?.(layer, idx)
    renderLayers(ctx.gpx.layers)
    syncRaceName()
  }

  return panel
}
