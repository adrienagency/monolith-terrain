// Effects panel — right column, below Map. Gathers everything that shapes the
// IMAGE rather than the map data: the new render effects (AO, bloom), the
// post chain (exposure/contrast/saturation/vignette/grain/fog) moved verbatim
// from the Create panel, and the volumetric clouds moved with them (explicit
// request: one home for every effect, clouds included).

import { el, section, toggle, slider, color, visibleWhen, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { FLAGS } from '../flags.js'
import { SEABEDS } from '../ocean.js'

// vignette procédurale d'un fond marin : dégradé du preset + grain + glaçure
// d'eau — même gabarit que les vignettes matériaux/HDRI (ce-mat-vig-img)
function seabedThumb(p) {
  if (!p.a) return el('span', 'ce-mat-vig-img ce-mat-vig-none')
  const cv = el('canvas', 'ce-mat-vig-img')
  cv.width = 96
  cv.height = 56
  const g = cv.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 96, 56)
  grad.addColorStop(0, p.a)
  grad.addColorStop(1, p.b)
  g.fillStyle = grad
  g.fillRect(0, 0, 96, 56)
  g.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 120; i++) g.fillRect(Math.random() * 96, Math.random() * 56, 1.5, 1.5)
  const wat = g.createLinearGradient(0, 0, 0, 56)
  wat.addColorStop(0, 'rgba(96,156,204,0.32)')
  wat.addColorStop(1, 'rgba(18,48,88,0.42)')
  g.fillStyle = wat
  g.fillRect(0, 0, 96, 56)
  return cv
}

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>'

export function buildEffectsPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({ title: 'Effects', icon: ICON, side: 'right', width: 268, tip: 'Light, lens and atmosphere — how the image feels.' })

  // ---- render (the 2026-07-20 upgrades) ----
  const sRen = panel.addSection(section('Render', { open: true }))
  const aoT = toggle({ label: 'Ambient occlusion', get: () => params.ssaoEnabled, set: (v) => { params.ssaoEnabled = v; refreshAll() } })
  const aoI = slider({ label: 'AO intensity', min: 0.5, max: 12, step: 0.05, get: () => params.ssaoIntensity, set: (v) => { params.ssaoIntensity = v; ctx.ssao.intensity = v } })
  const blT = toggle({ label: 'Bloom', get: () => params.bloomEnabled, set: (v) => { params.bloomEnabled = v; refreshAll() } })
  const blI = slider({ label: 'Bloom intensity', min: 0, max: 2, step: 0.02, get: () => params.bloomIntensity, set: (v) => { params.bloomIntensity = v; ctx.bloom.intensity = v } })
  const blH = slider({ label: 'Bloom threshold', min: 0.4, max: 1, step: 0.01, get: () => params.bloomThreshold, set: (v) => { params.bloomThreshold = v; ctx.bloom.luminanceMaterial.threshold = v } })
  sRen.body.append(aoT, aoI, blT, blI, blH)
  visibleWhen(aoI, () => params.ssaoEnabled)
  for (const row of [blI, blH]) visibleWhen(row, () => params.bloomEnabled)

  // ---- post chain (moved from Create) ----
  const sFx = panel.addSection(section('Post'))
  sFx.body.append(
    slider({ label: 'Exposure', min: 0.2, max: 3, step: 0.02, get: () => params.exposure, set: (v) => { params.exposure = v; ctx.exposureFx.uniforms.get('exposure').value = v } }),
    slider({ label: 'Contrast', min: -0.2, max: 0.5, step: 0.01, get: () => params.contrast, set: (v) => { params.contrast = v; ctx.contrastFx.uniforms.get('contrast').value = v } }),
    slider({ label: 'Saturation', min: -1, max: 0, step: 0.02, get: () => params.saturation, set: (v) => { params.saturation = v; ctx.hueSat.saturation = v } }),
    slider({ label: 'Vignette', min: 0, max: 1, step: 0.02, get: () => params.vignette, set: (v) => { params.vignette = v; ctx.vignette.darkness = v } }),
    slider({ label: 'Grain', min: 0, max: 0.5, step: 0.01, get: () => params.grain, set: (v) => { params.grain = v; ctx.grain.blendMode.opacity.value = v } }),
    toggle({ label: 'Fog', get: () => params.fogEnabled, set: (v) => { params.fogEnabled = v; ctx.setFogEnabled(v); refreshAll() } })
  )
  const fogRows = [
    slider({ label: 'Fog start', min: 5, max: 60, step: 0.5, get: () => params.fogNear, set: (v) => { params.fogNear = v; ctx.fogRef.near = v } }),
    slider({ label: 'Fog end', min: 15, max: 90, step: 0.5, get: () => params.fogFar, set: (v) => { params.fogFar = v; ctx.fogRef.far = v } }),
    color({ label: 'Fog colour', get: () => params.fogColor, set: (v) => { params.fogColor = v; ctx.fogRef.color.set(v); if (params.bgMode === 'solid') ctx.applyBackground() } }),
  ]
  sFx.body.append(...fogRows)
  for (const row of fogRows) visibleWhen(row, () => params.fogEnabled)

  // ---- clouds (moved from Create, controls unchanged) ----
  const sCld = panel.addSection(section('Clouds'))
  const rebuildClouds = () => ctx.clouds.build(params)
  const cloudLive = (label, key, min, max, step) =>
    slider({ label, min, max, step, get: () => params[key], set: (v) => { params[key] = v } })
  const cloudBaked = (label, key, min, max, step) => {
    const s = cloudLive(label, key, min, max, step)
    s.querySelector('input').addEventListener('change', rebuildClouds)
    return s
  }
  sCld.body.append(
    toggle({ label: 'Volumetric clouds', get: () => params.cloudsEnabled, set: (v) => { params.cloudsEnabled = v; rebuildClouds(); refreshAll() } })
  )
  const cloudRows = [
    cloudLive('Density', 'cloudOpacity', 0.05, 1.5, 0.05),
    cloudBaked('Scale', 'cloudScale', 0.5, 5, 0.1),
    cloudBaked('Gaps', 'cloudCoverage', 0, 0.8, 0.01),
    cloudBaked('Vertical billow', 'cloudBillow', 0, 1, 0.05),
    cloudLive('Brightness', 'cloudBrightness', 0.5, 5, 0.1),
    cloudLive('Contrast', 'cloudContrast', 0.4, 2.5, 0.05),
    cloudLive('Translucency', 'cloudSSS', 0, 2, 0.05),
    cloudBaked('Altitude', 'cloudAltitude', 0, 16, 0.5),
    cloudBaked('Altitude spread', 'cloudAltSpread', 0, 1, 0.05),
    cloudLive('Drift speed', 'cloudDrift', 0, 4, 0.1),
    cloudLive('Drift variation', 'cloudDriftVar', 0, 1, 0.05),
  ]
  sCld.body.append(...cloudRows)
  for (const row of cloudRows) visibleWhen(row, () => params.cloudsEnabled)

  // ---- sea (ocean-waves random spectrum — moved here from Create's old
  // Water section: one home for every effect) ----
  if (FLAGS.water) {
    const sSea = panel.addSection(section('Sea'))
    sSea.body.append(
      toggle({ label: 'Animated sea', get: () => params.waterReal, set: (v) => { params.waterReal = v; ctx.waterRebuild(); refreshAll() } })
    )
    const reseed = el('button', 'ce-pillbtn')
    reseed.type = 'button'
    reseed.textContent = 'New sea state'
    reseed.setAttribute('data-tip', 'Draw a fresh random wave spectrum — the seed is saved in share links.')
    reseed.addEventListener('click', () => { params.seaSeed = ctx.realWater?.reseed() ?? 0 })
    const seaRows = [
      slider({ label: 'Wave height', min: 0, max: 2, step: 0.05, get: () => params.seaWaveH, set: (v) => { params.seaWaveH = v; ctx.realWater?.setWaves({ height: v }) } }),
      slider({ label: 'Choppiness', min: 0, max: 1, step: 0.05, get: () => params.seaChop, set: (v) => { params.seaChop = v; ctx.realWater?.setWaves({ choppiness: v }) } }),
      slider({ label: 'Speed', min: 0, max: 2, step: 0.05, get: () => params.seaSpeed, set: (v) => { params.seaSpeed = v; ctx.realWater?.setWaves({ speed: v }) } }),
      slider({ label: 'Seabed transparency', min: 0, max: 1, step: 0.01, get: () => params.waterTransparency, set: (v) => { params.waterTransparency = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Sun reflection', min: 0, max: 2, step: 0.02, get: () => params.waterSunFx, set: (v) => { params.waterSunFx = v; ctx.realWater?.setLook(params) } }),
      color({ label: 'Water colour', get: () => params.lakeColor, set: (v) => { params.lakeColor = v; ctx.realWater?.setLook(params) } }),
      reseed,
    ]
    // ---- fond marin : picker à vignettes (même UX que matériaux/HDRI) ----
    const bedHead = el('div', 'ce-fx-head', 'Seabed')
    const bedPick = el('div', 'ce-mat-pick')
    function renderBedPicker() {
      bedPick.replaceChildren()
      const grid = el('div', 'ce-mat-grid')
      for (const p of SEABEDS) {
        const b = el('button', `ce-mat-vig${(params.seaBed ?? 'map') === p.id ? ' on' : ''}`)
        b.type = 'button'
        b.setAttribute('data-tip', p.id === 'map' ? 'The map itself reads through the water.' : `${p.name} floor under the sea — transparency sets how much of it shows.`)
        b.append(seabedThumb(p), el('span', 'ce-mat-vig-name', p.name))
        b.addEventListener('click', () => {
          params.seaBed = p.id
          ctx.realWater?.setSeabed(p.id)
          renderBedPicker()
        })
        grid.append(b)
      }
      bedPick.append(grid)
    }
    renderBedPicker()
    seaRows.splice(seaRows.indexOf(reseed), 0, bedHead, bedPick)
    sSea.body.append(...seaRows)
    for (const row of seaRows) visibleWhen(row, () => params.waterReal)
  }

  return panel
}
