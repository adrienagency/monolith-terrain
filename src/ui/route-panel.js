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
    title: 'Route',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Load a GPX track and style the line draped over the relief.',
  })

  // Track section stays FIRST and open by default (see the task-13 report) —
  // Width/Colour are the controls a user reaches for right after loading a
  // file, so they shouldn't require expanding anything.
  const sTrack = panel.addSection(section('Track', { open: true }))
  sTrack.body.append(button('Load GPX…', () => ctx.loadGpx(), { accent: true }))
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
  const sLayers = panel.addSection(section('Layers', { open: true }))
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

      const removeBtn = el('button', 'ce-icon-btn ce-gpx-remove')
      removeBtn.type = 'button'
      removeBtn.title = 'Remove layer'
      removeBtn.textContent = '✕'
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        ctx.gpx.removeLayer(l.id)
      })

      row.append(dragHandle, iconBtn, nameInput, eyeBtn, removeBtn)
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

  const sStyle = panel.addSection(section('Line effects', { open: false }))
  const modeRow = select({
    label: 'Gradient mode',
    options: [
      { value: 'elevation', label: 'Elevation' },
      { value: 'slope', label: 'Slope' },
      { value: 'progress', label: 'Progress' },
    ],
    get: () => params.gpxGradientMode,
    set: (v) => ctx.gpx.setGradient(params.gpxGradient, v),
  })
  visibleWhen(modeRow, () => params.gpxGradient)
  sStyle.body.append(
    toggle({
      label: 'Gradient along track',
      get: () => params.gpxGradient,
      set: (v) => { ctx.gpx.setGradient(v, params.gpxGradientMode); refreshAll() }, // updates modeRow + colorRow visibility right away
    }),
    modeRow,
    toggle({
      label: 'Glow',
      get: () => params.gpxGlow,
      set: (v) => ctx.gpx.setGlow(v),
    })
  )

  const sPoints = panel.addSection(section('Points & markers', { open: false }))
  sPoints.body.append(
    toggle({
      label: 'Start & finish markers',
      get: () => params.gpxMarkers,
      set: (v) => ctx.gpx.setMarkers(v),
    }),
    toggle({
      label: 'Km markers',
      get: () => params.gpxKm,
      set: (v) => ctx.gpx.setKm(v),
    })
  )

  // name-point: labels the currently-hovered track point (ctx.gpx.hoverIdx);
  // a lightweight inline field rather than a full point picker — see spec E
  const nameRow = el('div', 'ce-btn-row')
  const nameInput = el('input', 'ce-tpl-name')
  nameInput.type = 'text'
  nameInput.placeholder = 'Hover a point, then name it…'
  nameInput.maxLength = 40
  const doNamePoint = () => {
    const idx = ctx.gpx.hoverIdx
    if (idx == null || idx < 0) {
      nameInput.focus()
      return // nothing hovered — silently no-op rather than block the UI
    }
    ctx.gpx.setPointName(idx, nameInput.value)
    nameInput.value = ''
  }
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      doNamePoint()
    }
  })
  nameRow.append(nameInput, button('Name point', doNamePoint, { ghost: true }))
  sPoints.body.append(nameRow)

  // Playback — progressive reveal: a head travels the track, the line draws
  // up to it, and animated altitude/slope readouts float at the tip (Space
  // plays/pauses, Esc stops — see the shortcuts ctx in main.js).
  const sPlay = panel.addSection(section('Playback', { open: false }))
  const playRow = el('div', 'ce-btn-row')
  const playBtn = button('▶ Play', () => {
    if (!ctx.gpx.track) return
    if (ctx.gpx.isPlaying()) {
      ctx.gpx.pause()
      ctx.stopFollow?.()
    } else {
      ctx.gpx.play()
      ctx.startFollow?.() // no-op unless the Follow toggle below is on
    }
    syncPlayBtn()
  }, { accent: true })
  const stopBtn = button('■ Stop', () => {
    ctx.gpx.stop()
    ctx.stopFollow?.()
    syncPlayBtn()
  }, { ghost: true })
  function syncPlayBtn() {
    const playing = !!ctx.gpx.isPlaying?.()
    playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'
    playBtn.classList.toggle('on', playing)
  }
  syncPlayBtn()
  // playback can also start/stop/end via Space/Esc or naturally reach the
  // end of the track — poll lightly so the button label stays in sync
  setInterval(syncPlayBtn, 200)
  playRow.append(playBtn, stopBtn)
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
    playRow,
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
      // panel), just synced frame-for-frame to playback instead of timed
      label: 'Drone follow',
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
