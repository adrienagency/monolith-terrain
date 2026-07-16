// ROUTE panel — the GPX track as a first-class layer: load a file, style the
// line (width/colour/auto-contrast casing). Later Parcours tasks extend this
// same panel with gradient/glow/shimmer, points, and playback.
// Docked in the left column, after Camera (Explore, Scan, Camera, Route).

import { slider, color, toggle, button, section } from './kit.js'
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

  return panel
}
