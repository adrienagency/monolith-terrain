// CAMERA panel — viewpoint, focus, cinematic automation and performance.
// Docked in the left dock, directly below Scan.

import { el, slider, toggle, select, button, section, visibleWhen, refreshAll } from './kit.js'
import { Panel } from './shell.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5.6M21 12h-5.6M12 21v-5.6M3 12h5.6"/></svg>'

export function buildCameraPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Caméra',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Point de vue, mise au point et mouvements automatiques.',
  })

  const sCam = panel.addSection(section('Objectif & mise au point', { open: false }))
  // Focus distance/range are cut: main.js lerps focusDistance toward the pointer
  // every frame while autoFocus is on (the default), so the sliders snapped back
  // in ~125ms and were never actually usable. The params + worldFocusDistance/
  // worldFocusRange writes stay live internally (main.js) — only the dead UI goes.
  const bokehSlider = slider({ label: 'Intensité du flou', min: 0, max: 32, step: 0.1, get: () => params.bokehScale, set: (v) => { params.bokehScale = v; const d = ctx.getDof(); if (d) d.bokehScale = v; ctx.setDofEnabled(params.bokehEnabled && v > 0) } })
  sCam.body.append(
    slider({ label: 'Champ de vision (fov)', min: 20, max: 60, step: 1, get: () => params.fov, set: (v) => { params.fov = v; ctx.camera.fov = v; ctx.camera.updateProjectionMatrix() } }),
    toggle({ label: 'Mise au point auto (pointeur)', get: () => params.autoFocus, set: (v) => { params.autoFocus = v } }),
    toggle({ label: 'Flou de profondeur (bokeh)', get: () => params.bokehEnabled, set: (v) => { params.bokehEnabled = v; ctx.setDofEnabled(v && params.bokehScale > 0); const d = ctx.getDof(); if (d) d.bokehScale = params.bokehScale; refreshAll() } }),
    bokehSlider
  )
  visibleWhen(bokehSlider, () => params.bokehEnabled)

  // looping cinematic camera moves — orbit / fly-over / crane, etc.
  const sAuto = panel.addSection(section('Automatisations'))
  sAuto.body.append(
    select({ label: 'Mouvement', options: ctx.cameraMoves, get: () => params.camMove, set: (v) => { params.camMove = v; if (ctx.isCameraAuto()) ctx.playCamera(v, params.camSpeed) } }),
    slider({ label: 'Vitesse', min: 0.1, max: 3, step: 0.05, get: () => params.camSpeed, set: (v) => { params.camSpeed = v; ctx.setCameraSpeed(v) } })
  )
  const autoRow = el('div', 'ce-btn-row')
  autoRow.append(
    button('Lancer', () => ctx.playCamera(params.camMove, params.camSpeed), { accent: true }),
    button('Stop', () => ctx.stopCamera(), { ghost: true })
  )
  sAuto.body.append(autoRow)

  // la section Performance vit désormais dans le panneau Image (c'est du
  // RENDU, pas de la caméra — recette Lightroom) : perfSection() ci-dessous,
  // montée par main.js dans buildEffectsPanel.

  return panel
}

// Section Performance — construite ici (les contrôles touchent renderer/
// composer via le ctx caméra) mais MONTÉE dans le panneau Image par main.js.
export function perfSection(ctx) {
  const { params } = ctx
  const s = section('Performance')
  s.body.append(
    slider({ label: 'Échelle de rendu', min: 0.5, max: 2, step: 0.05, get: () => params.pixelRatio, set: (v) => { params.pixelRatio = v; ctx.renderer.setPixelRatio(v); ctx.composer.setSize(window.innerWidth, window.innerHeight) } }),
    select({ label: 'Ombres', options: ['dynamic', 'static', 'off'], get: () => params.shadowMode, set: (v) => { params.shadowMode = v; ctx.applyShadowMode() } }),
    select({ label: 'Résolution des ombres', options: ['1024', '2048', '4096'], get: () => String(params.shadowRes), set: (v) => { params.shadowRes = +v; ctx.setShadowRes(+v) } })
  )
  return s
}
