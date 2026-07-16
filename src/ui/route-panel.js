// ROUTE panel — the GPX track as a first-class layer: load a file, style the
// line (width/colour, gradient/glow/shimmer). Later Parcours tasks extend
// this same panel with points and playback.
// Docked in the left column, after Camera (Explore, Scan, Camera, Route).

import { slider, color, toggle, select, visibleWhen, button, section, el, refreshAll } from './kit.js'
import { Panel } from './shell.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19c3-6 5-9 8-9s3 5 8 5"/><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>'

export function buildRoutePanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Route',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Load a GPX track and style the line draped over the relief.',
  })

  const sTrack = panel.addSection(section('Track', { open: true }))
  sTrack.body.append(button('Load GPX…', () => ctx.loadGpx(), { accent: true }))
  sTrack.body.append(
    slider({
      label: 'Width',
      min: 1,
      max: 8,
      step: 0.5,
      get: () => params.gpxWidth,
      set: (v) => { params.gpxWidth = v; ctx.gpx.setWidth(v) },
    }),
    color({
      label: 'Colour',
      get: () => params.gpxColor || params.hudAccent,
      set: (v) => { params.gpxColor = v; ctx.gpx.setColor(v) },
    })
  )

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
      set: (v) => ctx.gpx.setGradient(v, params.gpxGradientMode),
    }),
    modeRow,
    toggle({
      label: 'Glow',
      get: () => params.gpxGlow,
      set: (v) => ctx.gpx.setGlow(v),
    }),
    toggle({
      label: 'Shimmer',
      get: () => params.gpxShimmer,
      set: (v) => ctx.gpx.setShimmer(v),
    })
  )

  const sPoints = panel.addSection(section('Points & markers', { open: false }))
  sPoints.body.append(
    toggle({
      label: 'Track points',
      get: () => params.gpxPoints,
      set: (v) => ctx.gpx.setPoints(v),
    }),
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
