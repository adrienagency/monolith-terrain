import { section, toggle, slider, color } from './kit.js'
import { Panel } from './shell.js'

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>'

export function buildMapPanel(ctx) {
  const { params, u } = ctx // u() → terrain.mapUniforms
  const panel = new Panel({ title: 'Map', icon: ICON, side: 'right', width: 268, tip: 'Cartographic layers draped on the relief.' })

  const sLayers = panel.addSection(section('Layers', { open: true }))
  sLayers.body.append(
    toggle({ label: 'Roads', get: () => params.roadsEnabled, set: (v) => { params.roadsEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Roads opacity', min: 0, max: 1, step: 0.02, get: () => params.roadsOpacity, set: (v) => { params.roadsOpacity = v; ctx.mapLayers.setOpacity('roads', v) } }),
    slider({ label: 'Roads detail', min: 0, max: 2, step: 1, get: () => params.roadsDetail, set: (v) => { params.roadsDetail = v; ctx.rebuildMapLayers() } }),
    toggle({ label: 'Casing', get: () => params.roadsCasing, set: (v) => { params.roadsCasing = v; ctx.rebuildMapLayers() } }),
    color({ label: 'Roads colour', get: () => params.roadColor, set: (v) => { params.roadColor = v; ctx.rebuildMapLayers() } }),
    toggle({ label: 'Rivers & water', get: () => params.waterEnabled, set: (v) => { params.waterEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Water opacity', min: 0, max: 1, step: 0.02, get: () => params.waterOpacity, set: (v) => { params.waterOpacity = v; ctx.mapLayers.setOpacity('water', v) } }),
    toggle({ label: 'Places', get: () => params.placesEnabled, set: (v) => { params.placesEnabled = v; ctx.rebuildMapLayers() } }),
    slider({ label: 'Places density', min: 0.4, max: 2, step: 0.1, get: () => params.placesDensity, set: (v) => { params.placesDensity = v; ctx.rebuildMapLayers() } })
  )

  const sContour = panel.addSection(section('Contours & Grid'))
  sContour.body.append(
    slider({ label: 'Contour interval', min: 0.04, max: 0.6, step: 0.01, get: () => params.contourInterval, set: (v) => { params.contourInterval = v; u().uContourInterval.value = v } }),
    slider({ label: 'Contour opacity', min: 0, max: 1, step: 0.02, get: () => params.contourOpacity, set: (v) => { params.contourOpacity = v; u().uContourOpacity.value = v } }),
    slider({ label: 'Contour weight', min: 0.3, max: 1.6, step: 0.05, get: () => params.contourWeight, set: (v) => { params.contourWeight = v; if (!params.darkMode) u().uContourWeight.value = v } }),
    slider({ label: 'Grid size', min: 2, max: 14, step: 0.5, get: () => params.gridStep, set: (v) => { params.gridStep = v; u().uGridStep.value = v } }),
    slider({ label: 'Grid opacity', min: 0, max: 1, step: 0.02, get: () => params.gridOpacity, set: (v) => { params.gridOpacity = v; u().uGridOpacity.value = v } })
  )

  const sMarkers = panel.addSection(section('Markers'))
  sMarkers.body.append(
    toggle({ label: 'Summit markers', get: () => params.peaksEnabled ?? false, set: (v) => { params.peaksEnabled = v; ctx.peaksLayer.setEnabled(v) } }),
    toggle({ label: 'Spot elevations', get: () => params.labels, set: (v) => { params.labels = v; ctx.setLabelsVisible(v) } })
  )
  return panel
}
