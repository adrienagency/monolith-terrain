import { section, toggle, slider, color, visibleWhen, refreshAll } from './kit.js'
import { Panel } from './shell.js'

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>'

export function buildMapPanel(ctx) {
  const { params, u } = ctx // u() → terrain.mapUniforms
  const panel = new Panel({ title: 'Carte', icon: ICON, side: 'left', width: 268, tip: 'Cartographic layers draped on the relief.' })

  const sLayers = panel.addSection(section('Layers', { open: true }))
  const roadsToggle = toggle({ label: 'Roads', get: () => params.roadsEnabled, set: (v) => { params.roadsEnabled = v; ctx.rebuildMapLayers(); refreshAll() } })
  const roadsOpacity = slider({ label: 'Roads opacity', min: 0, max: 1, step: 0.02, get: () => params.roadsOpacity, set: (v) => { params.roadsOpacity = v; ctx.mapLayers.setOpacity('roads', v) } })
  const roadsDetail = slider({ label: 'Roads detail', min: 1, max: 3, step: 1, get: () => params.roadsDetail, set: (v) => { params.roadsDetail = v; ctx.rebuildMapLayers() } })
  const roadsColour = color({ label: 'Roads colour', get: () => params.roadColor, set: (v) => { params.roadColor = v; ctx.rebuildMapLayers() } })
  const waterToggle = toggle({ label: 'Rivers & water', get: () => params.waterEnabled, set: (v) => { params.waterEnabled = v; ctx.rebuildMapLayers(); refreshAll() } })
  const waterOpacity = slider({ label: 'Water opacity', min: 0, max: 1, step: 0.02, get: () => params.waterOpacity, set: (v) => { params.waterOpacity = v; ctx.mapLayers.setOpacity('water', v) } })
  const waterFill = toggle({ label: 'Lakes & seas fill', get: () => params.waterFill, set: (v) => { params.waterFill = v; ctx.rebuildMapLayers() } })
  // off by default — Natural Earth's 1:10m coast is too coarse to trace a real
  // shoreline; kept as an option rather than deleted. See water-layer.js.
  const coastLine = toggle({ label: 'Coastline outline', get: () => params.coastLine, set: (v) => { params.coastLine = v; ctx.rebuildMapLayers() } })
  // Aerial photo — IGN (France) and swisstopo (Switzerland), off by default.
  // Outside covered ground the layer says so in the middle of the screen and
  // switches itself back off (see main.js refreshAerial).
  const aerialToggle = toggle({ label: 'Aerial photo', get: () => params.aerialEnabled, set: (v) => { params.aerialEnabled = v; ctx.refreshAerial(); refreshAll() } })
  const aerialOpacity = slider({ label: 'Aerial opacity', min: 0, max: 1, step: 0.02, get: () => params.aerialOpacity, set: (v) => { params.aerialOpacity = v; ctx.terrain.setAerialOpacity(v); ctx.blockGrid?.setAerialOpacity?.(v) } })
  // v49 : la photo ne vit qu'à la côte, puis s'estompe vers le fond marin. 0 = pleine partout.
  const aerialCoastFade = slider({ label: 'Coast cutoff', min: 0, max: 0.4, step: 0.01, get: () => params.aerialCoastFade, set: (v) => { params.aerialCoastFade = v; ctx.terrain.setAerialCoastFade(v); ctx.blockGrid?.setAerialCoastFade?.(v) } })
  const placesToggle = toggle({ label: 'Places', get: () => params.placesEnabled, set: (v) => { params.placesEnabled = v; ctx.rebuildMapLayers(); refreshAll() } })
  const placesDensity = slider({ label: 'Places density', min: 0.4, max: 2, step: 0.1, get: () => params.placesDensity, set: (v) => { params.placesDensity = v; ctx.rebuildMapLayers() } })
  const placesSize = slider({ label: 'Places size', min: 0.5, max: 2, step: 0.05, get: () => params.placesSize, set: (v) => { params.placesSize = v; ctx.rebuildMapLayers() } })
  const placesHalo = toggle({ label: 'Text halo', get: () => params.placesHalo, set: (v) => { params.placesHalo = v; ctx.rebuildMapLayers() } })
  sLayers.body.append(
    roadsToggle, roadsOpacity, roadsDetail, roadsColour,
    waterToggle, waterOpacity, waterFill, coastLine,
    aerialToggle, aerialOpacity, aerialCoastFade,
    placesToggle, placesDensity, placesSize, placesHalo
  )
  for (const row of [roadsOpacity, roadsDetail, roadsColour]) visibleWhen(row, () => params.roadsEnabled)
  for (const row of [waterOpacity, waterFill, coastLine]) visibleWhen(row, () => params.waterEnabled)
  for (const row of [aerialOpacity, aerialCoastFade]) visibleWhen(row, () => params.aerialEnabled)
  for (const row of [placesDensity, placesSize, placesHalo]) visibleWhen(row, () => params.placesEnabled)

  const sContour = panel.addSection(section('Contours & Grid'))
  const contourWeight = slider({ label: 'Contour weight', min: 0.3, max: 1.6, step: 0.05, get: () => params.contourWeight, set: (v) => { params.contourWeight = v; if (!params.darkMode) u().uContourWeight.value = v } })
  sContour.body.append(
    slider({ label: 'Contour interval', min: 0.04, max: 0.6, step: 0.01, get: () => params.contourInterval, set: (v) => { params.contourInterval = v; u().uContourInterval.value = v } }),
    slider({ label: 'Contour opacity', min: 0, max: 1, step: 0.02, get: () => params.contourOpacity, set: (v) => { params.contourOpacity = v; u().uContourOpacity.value = v } }),
    contourWeight,
    slider({ label: 'Grid size', min: 2, max: 14, step: 0.5, get: () => params.gridStep, set: (v) => { params.gridStep = v; u().uGridStep.value = v } }),
    slider({ label: 'Grid opacity', min: 0, max: 1, step: 0.02, get: () => params.gridOpacity, set: (v) => { params.gridOpacity = v; u().uGridOpacity.value = v } })
  )
  // dead in dark mode — main.js pins the uniform to 0.5 there (setDarkMode); the
  // readout would keep moving with nothing rendering, so hide rather than honour
  visibleWhen(contourWeight, () => !params.darkMode)

  const sMarkers = panel.addSection(section('Markers'))
  sMarkers.body.append(
    toggle({ label: 'Summit markers', get: () => params.peaksEnabled ?? false, set: (v) => { params.peaksEnabled = v; ctx.peaksLayer.setEnabled(v) } }),
    toggle({ label: 'Spot elevations', get: () => params.labels, set: (v) => { params.labels = v; ctx.setLabelsVisible(v) } })
  )
  return panel
}
