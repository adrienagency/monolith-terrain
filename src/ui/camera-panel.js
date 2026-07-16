// CAMERA panel — viewpoint, focus, motion and performance. Docked in the
// left dock, directly below Scan.

import { el, slider, toggle, select, button, section } from './kit.js'
import { Panel } from './shell.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5.6M21 12h-5.6M12 21v-5.6M3 12h5.6"/></svg>'

export function buildCameraPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Camera',
    icon: ICON,
    side: 'left',
    width: 268,
    tip: 'Viewpoint, focus, motion and rendering performance.',
  })

  const sCam = panel.addSection(section('Lens & Focus', { open: false }))
  sCam.body.append(
    slider({ label: 'Field of view', min: 20, max: 60, step: 1, get: () => params.fov, set: (v) => { params.fov = v; ctx.camera.fov = v; ctx.camera.updateProjectionMatrix() } }),
    toggle({ label: 'Autofocus (pointer)', get: () => params.autoFocus, set: (v) => { params.autoFocus = v } }),
    slider({ label: 'Focus distance', min: 5, max: 60, step: 0.1, get: () => params.focusDistance, set: (v) => { params.focusDistance = v } }),
    slider({ label: 'Focus range', min: 0.5, max: 60, step: 0.1, get: () => params.focusRange, set: (v) => { params.focusRange = v; ctx.dof.cocMaterial.worldFocusRange = v } }),
    slider({ label: 'Bokeh', min: 0, max: 8, step: 0.1, get: () => params.bokehScale, set: (v) => { params.bokehScale = v; ctx.dof.bokehScale = v; ctx.dofPass.enabled = v > 0 } })
  )

  // looping cinematic camera moves — orbit / fly-over / crane, etc.
  const sAuto = panel.addSection(section('Automation'))
  sAuto.body.append(
    select({ label: 'Move', options: ctx.cameraMoves, get: () => params.camMove, set: (v) => { params.camMove = v; if (ctx.isCameraAuto()) ctx.playCamera(v, params.camSpeed) } }),
    slider({ label: 'Speed', min: 0.1, max: 3, step: 0.05, get: () => params.camSpeed, set: (v) => { params.camSpeed = v; ctx.setCameraSpeed(v) } })
  )
  const autoRow = el('div', 'ce-btn-row')
  autoRow.append(
    button('Play', () => ctx.playCamera(params.camMove, params.camSpeed), { accent: true }),
    button('Stop', () => ctx.stopCamera(), { ghost: true })
  )
  sAuto.body.append(autoRow)

  const sMot = panel.addSection(section('Motion'))
  sMot.body.append(
    toggle({ label: 'Pause ambient motion', get: () => params.paused, set: (v) => { params.paused = v } }),
    slider({ label: 'Fly duration', min: 0.4, max: 4, step: 0.1, get: () => params.flyDuration, set: (v) => { params.flyDuration = v } }),
    select({ label: 'Fly easing', options: ['smooth', 'glide', 'linear'], get: () => params.flyEasing, set: (v) => { params.flyEasing = v } })
  )
  const flyRow = el('div', 'ce-btn-row')
  const flyBtn = button('Fly the GPX track', () => ctx.flyTrack(), { accent: true })
  flyBtn.setAttribute('data-tip', 'Load a GPX first, then fly along it like a drone.')
  flyRow.append(flyBtn, button('Stop', () => ctx.stopTour(), { ghost: true }))
  sMot.body.append(flyRow)

  const sPerf = panel.addSection(section('Performance'))
  sPerf.body.append(
    slider({ label: 'Render scale', min: 0.5, max: 2, step: 0.05, get: () => params.pixelRatio, set: (v) => { params.pixelRatio = v; ctx.renderer.setPixelRatio(v); ctx.composer.setSize(window.innerWidth, window.innerHeight) } }),
    select({ label: 'Shadows', options: ['dynamic', 'static', 'off'], get: () => params.shadowMode, set: (v) => { params.shadowMode = v; ctx.applyShadowMode() } }),
    select({ label: 'Shadow resolution', options: ['1024', '2048', '4096'], get: () => String(params.shadowRes), set: (v) => { params.shadowRes = +v; ctx.setShadowRes(+v) } })
  )

  return panel
}
