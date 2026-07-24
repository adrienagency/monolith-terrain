// ROUTE panel — the GPX track as a first-class layer: load a file, style the
// line (width/colour, gradient/glow). Later Parcours tasks extend this same
// panel with points and playback.
// Docked in the left column, after Camera (Explore, Scan, Camera, Route).

import { slider, color, toggle, select, visibleWhen, button, section, el, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { SPORTS, getSport } from './sport-icons.js'
import { MAX_LAYERS } from '../gpx-layers.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19c3-6 5-9 8-9s3 5 8 5"/><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>'

const DRAG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>'
const EYE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>'
const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.2A10.9 10.9 0 0 1 12 5c6.2 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4M6.5 6.7C3.4 8.8 2 12 2 12s3.8 7 10 7c1.5 0 2.9-.4 4.1-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
const UPLOAD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 8l5-5 5 5M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1"/></svg>'

export function buildRoutePanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'GPX path',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Load a GPX track and style the line draped over the relief.',
  })

  // Play / Stop live at the TOP of the panel, ALWAYS visible the moment "GPX
  // path" is open (Adrien) — peers of the Track / GPX layers sections, not
  // buried in a collapsed Playback section. The follow/readout options stay in
  // the Playback section below. `syncPlayBtn` is defined here and reused there.
  const playRow = el('div', 'ce-btn-row')
  const playBtn = button('▶ Play', () => {
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
  const exitFollowBtn = button('✕ Exit follow', () => {
    params.gpxFollow = false
    ctx.stopFollow?.()
    refreshAll()
    syncPlayBtn()
  }, { ghost: true })
  exitFollowBtn.classList.add('ce-exit-follow')
  exitFollowBtn.title = 'Return to manual camera control'
  function syncPlayBtn() {
    const playing = !!ctx.gpx.isPlaying?.()
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'
    playBtn.classList.toggle('on', playing)
    exitFollowBtn.style.display = playing && params.gpxFollow ? '' : 'none'
  }
  syncPlayBtn()
  setInterval(syncPlayBtn, 200)
  playRow.append(playBtn, stopBtn, exitFollowBtn)
  panel.add(playRow)

  // Track section stays FIRST and open by default (see the task-13 report) —
  // Width/Colour are the controls a user reaches for right after loading a
  // file, so they shouldn't require expanding anything.
  const sTrack = panel.addSection(section('Track', { open: true }))
  // Race Studio — la sous-app organisateurs (logo, points de passage, pictos,
  // transports, export projet) : voir src/ui/studio.js
  sTrack.body.append(button('Race Studio', () => ctx.openStudio?.(), { accent: true }))
  sTrack.body.append(button('Load GPX…', () => ctx.loadGpx(), { ghost: true }))
  const colorRow = color({
    label: 'Colour',
    get: () => params.gpxColor || params.hudAccent,
    set: (v) => { params.gpxColor = v; ctx.gpx.setColor(v) },
  })
  // Honesty fix: when the gradient ramp is on, gpx.js rebuild() forces the
  // line material's base colour to white and drives it from per-vertex
  // gradient colours instead (see its comment) — the Colour swatch would
  // silently do nothing while that's active. Rather than ship a control that
  // lies about having an effect, only surface it while Gradient is off.
  visibleWhen(colorRow, () => !params.gpxGradient)
  sTrack.body.append(
    slider({
      label: 'Width',
      min: 1,
      max: 8,
      step: 0.5,
      get: () => params.gpxWidth,
      set: (v) => { params.gpxWidth = v; ctx.gpx.setWidth(v) },
    }),
    colorRow
  )

  // ---------------------------------------------------------------- Layers
  // task 22 §1/2: "tu vas ranger les traces GPX sous forme de calques...
  // comme dans Figma" — the stack Load-GPX/drag-and-drop feed (ctx.gpx is a
  // GpxLayerManager, see gpx-layers.js). Drag/drop reorder, per-layer sport
  // icon (+ custom upload), visibility, remove, up to MAX_LAYERS. Style
  // (Width/Colour/Gradient/Glow/Markers/Km, above and below) stays GLOBAL —
  // see gpx-layers.js's own file header for why — so this section is the
  // only place per-layer identity lives.
  const sLayers = panel.addSection(section('My races', { open: true }))
  const listEl = el('div', 'ce-gpx-layers')
  const emptyEl = el('div', 'ce-gpx-layers-empty', 'No tracks loaded yet — Load GPX above to add the first one.')
  const addRow = el('div', 'ce-btn-row')
  const addBtn = button('+ Add layer', () => ctx.loadGpx(), { ghost: true })
  const capLabel = el('span', 'ce-gpx-cap')
  addRow.append(addBtn, capLabel)
  sLayers.body.append(listEl, emptyEl, addRow)

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
    emptyEl.classList.toggle('hidden', layers.length > 0)
    addBtn.disabled = layers.length >= MAX_LAYERS
    capLabel.textContent = `${layers.length}/${MAX_LAYERS}`

    layers.forEach((l, idx) => {
      const row = el('div', 'ce-gpx-layer' + (idx === ctx.gpx.activeIndex ? ' active' : ''))
      row.draggable = true
      row.dataset.id = l.id

      const dragHandle = el('span', 'ce-gpx-drag')
      dragHandle.innerHTML = DRAG_ICON
      dragHandle.title = 'Drag to reorder'

      const iconBtn = el('button', 'ce-gpx-icon-btn')
      iconBtn.type = 'button'
      iconBtn.title = 'Change icon'
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
      eyeBtn.title = l.visible ? 'Hide layer' : 'Show layer'
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
      removeBtn.title = 'Remove layer'
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
        upBtn.title = 'Upload a custom icon (SVG or image)'
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

  // race name (task 22 §7) — the FOCUSED layer's own editorial title, shown
  // above ITS profile strip (gpx.js's .gpx-race-name). Each layer keeps its
  // own name, so the field re-syncs whenever focus moves — including the
  // automatic focus change sequenced playback drives (see onFocusChange below).
  const raceNameRow = el('div', 'ce-row')
  raceNameRow.append(el('label', 'ce-label', 'Race name — focused layer'))
  const raceNameInput = el('input', 'ce-tpl-name')
  raceNameInput.type = 'text'
  raceNameInput.maxLength = 60
  raceNameInput.placeholder = 'e.g. UTMB — CHAMONIX 2026'
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

  renderLayers(ctx.gpx.layers)
  syncRaceName()

  // gpx-layers.js's onChange/onFocusChange are single-slot hooks — main.js
  // already claimed onChange (per-layer draggable profile wiring, see its
  // own comment) before this panel is built, so CHAIN rather than
  // overwrite: both run, in the order they were registered.
  const prevOnChange = ctx.gpx.onChange
  ctx.gpx.onChange = (layers) => {
    prevOnChange?.(layers)
    renderLayers(layers)
    syncRaceName()
  }
  const prevOnFocusChange = ctx.gpx.onFocusChange
  ctx.gpx.onFocusChange = (layer, idx) => {
    prevOnFocusChange?.(layer, idx)
    renderLayers(ctx.gpx.layers)
    syncRaceName()
  }

  // « Line effects » et « Points & markers » retirés (Adrien) : le style du
  // tracé vit dans le Race Studio (étape ④), les points de passage aussi (②).

  // Playback — progressive reveal: a head travels the track, the line draws
  // up to it, and animated altitude/slope readouts float at the tip (Space
  // plays/pauses, Esc stops — see the shortcuts ctx in main.js).
  // Playback OPTIONS section — the Play/Stop buttons themselves now live at the
  // TOP of the panel (always visible). This section keeps the follow + readout
  // toggles and the follow-speed slider.
  const sPlay = panel.addSection(section('Playback options', { open: false }))
  const followSpeedRow = slider({
    label: 'Follow speed',
    min: 0.5,
    max: 3,
    step: 0.25,
    get: () => params.gpxFollowSpeed,
    set: (v) => { params.gpxFollowSpeed = v },
  })
  visibleWhen(followSpeedRow, () => params.gpxFollow)
  sPlay.body.append(
    toggle({
      label: 'Altitude readout',
      get: () => params.gpxAltReadout,
      set: (v) => ctx.gpx.setAltReadout(v),
    }),
    toggle({
      label: 'Slope readout',
      get: () => params.gpxSlopeReadout,
      set: (v) => ctx.gpx.setSlopeReadout(v),
    }),
    toggle({
      // drone-cam chase, not a flat top-down follow — trails the reveal
      // head with the same smooth easing as "Fly the GPX track" (Camera
      // panel), just synced frame-for-frame to playback instead of timed.
      // Label is "Follow", not "Drone follow" (task 24 — the user struck
      // through "Drone" on their annotated screenshot).
      label: 'Follow',
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

  return panel
}
