// ROUTE panel — the GPX track as a first-class layer: load a file, style the
// line (width/colour/auto-contrast casing, gradient/glow/shimmer). Later
// Parcours tasks extend this same panel with points and playback.
// Docked in the left column, after Camera (Explore, Scan, Camera, Route).

import { slider, color, toggle, select, visibleWhen, button, section, el } from './kit.js'
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
    }),
    toggle({
      label: 'Auto-contrast casing',
      get: () => params.gpxAutoContrast,
      set: (v) => { params.gpxAutoContrast = v; ctx.gpx.setAutoContrast(v) },
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
      label: 'Start marker',
      get: () => params.gpxStart,
      set: (v) => ctx.gpx.setStart(v),
    }),
    toggle({
      label: 'Finish marker',
      get: () => params.gpxEnd,
      set: (v) => ctx.gpx.setEnd(v),
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

  return panel
}
