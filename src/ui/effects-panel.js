// Effects panel — right column, below Map. Gathers everything that shapes the
// IMAGE rather than the map data: the new render effects (AO, bloom), the
// post chain (exposure/contrast/saturation/vignette/grain/fog) moved verbatim
// from the Create panel, and the volumetric clouds moved with them (explicit
// request: one home for every effect, clouds included).

import { el, section, toggle, slider, color, visibleWhen, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { FLAGS } from '../flags.js'
import { SEABEDS } from '../ocean.js'
import { scanSection } from './scan-panel.js'
import { perfSection } from './camera-panel.js'

// vignette procédurale d'un fond marin : dégradé du preset + grain + glaçure
// d'eau — même gabarit que les vignettes matériaux/HDRI (ce-mat-vig-img)
function seabedThumb(p) {
  if (!p.floor) return el('span', 'ce-mat-vig-img ce-mat-vig-none')
  const cv = el('canvas', 'ce-mat-vig-img')
  cv.width = 96
  cv.height = 56
  const g = cv.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 96, 56)
  grad.addColorStop(0, p.floor.shallow)
  grad.addColorStop(0.55, p.floor.mid)
  grad.addColorStop(1, p.floor.deep)
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
const ICON_ELEM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 17a4 4 0 1 1 .6-7.95A5 5 0 0 1 17 8a4 4 0 0 1 0 8H7Z"/><path d="M4 21c2-1.2 4-1.2 6 0s4 1.2 6 0"/></svg>'

// Deux panneaux du rail droit (plan « table lumineuse ») :
// « Éléments » = l'air et l'eau (nuages, brume, mer) ; « Image » = le rendu
// final (SSAO/bloom, objectif, scanner, performance). Retourne les deux —
// main.js fixe l'ordre visuel du dock.
export function buildEffectsPanel(ctx) {
  const { params } = ctx
  const elementsPanel = new Panel({ title: 'Éléments', icon: ICON_ELEM, side: 'right', width: 268, tip: 'L’air et l’eau : nuages, brume, mer.' })
  const panel = new Panel({ title: 'Image', icon: ICON, side: 'right', width: 268, tip: 'Le rendu final : SSAO et bloom, objectif, scanner, performance.' })

  // ---- render (the 2026-07-20 upgrades) ----
  const sRen = panel.addSection(section('Rendu', { open: true }))
  const aoT = toggle({ label: 'Ombrage des creux (SSAO)', get: () => params.ssaoEnabled, set: (v) => { params.ssaoEnabled = v; refreshAll() } })
  const aoI = slider({ label: 'Intensité de l’ombrage', min: 0.5, max: 12, step: 0.05, get: () => params.ssaoIntensity, set: (v) => { params.ssaoIntensity = v; ctx.ssao.intensity = v } })
  const blT = toggle({ label: 'Bloom (lueur)', get: () => params.bloomEnabled, set: (v) => { params.bloomEnabled = v; refreshAll() } })
  const blI = slider({ label: 'Intensité du bloom', min: 0, max: 2, step: 0.02, get: () => params.bloomIntensity, set: (v) => { params.bloomIntensity = v; ctx.bloom.intensity = v } })
  const blH = slider({ label: 'Seuil du bloom', min: 0.4, max: 1, step: 0.01, get: () => params.bloomThreshold, set: (v) => { params.bloomThreshold = v; ctx.bloom.luminanceMaterial.threshold = v } })
  sRen.body.append(aoT, aoI, blT, blI, blH)
  visibleWhen(aoI, () => params.ssaoEnabled)
  for (const row of [blI, blH]) visibleWhen(row, () => params.bloomEnabled)

  // ---- post chain (moved from Create) ----
  const sFx = panel.addSection(section('Objectif'))
  sFx.body.append(
    slider({ label: 'Exposition', min: 0.2, max: 3, step: 0.02, get: () => params.exposure, set: (v) => { params.exposure = v; ctx.exposureFx.uniforms.get('exposure').value = v } }),
    slider({ label: 'Contraste', min: -0.2, max: 0.5, step: 0.01, get: () => params.contrast, set: (v) => { params.contrast = v; ctx.contrastFx.uniforms.get('contrast').value = v } }),
    slider({ label: 'Saturation', min: -1, max: 0, step: 0.02, get: () => params.saturation, set: (v) => { params.saturation = v; ctx.hueSat.saturation = v } }),
    slider({ label: 'Vignettage', min: 0, max: 1, step: 0.02, get: () => params.vignette, set: (v) => { params.vignette = v; ctx.vignette.darkness = v } }),
    slider({ label: 'Grain', min: 0, max: 0.5, step: 0.01, get: () => params.grain, set: (v) => { params.grain = v; ctx.grain.blendMode.opacity.value = v } })
  )

  // ---- brume — dans Éléments (c'est de l'air, pas de l'objectif) ----
  const sFog = elementsPanel.addSection(section('Brume'))
  sFog.body.append(
    toggle({ label: 'Brume', get: () => params.fogEnabled, set: (v) => { params.fogEnabled = v; ctx.setFogEnabled(v); refreshAll() } })
  )
  const fogRows = [
    slider({ label: 'Début de la brume', min: 5, max: 60, step: 0.5, get: () => params.fogNear, set: (v) => { params.fogNear = v; ctx.fogRef.near = v } }),
    slider({ label: 'Fin de la brume', min: 15, max: 90, step: 0.5, get: () => params.fogFar, set: (v) => { params.fogFar = v; ctx.fogRef.far = v } }),
    color({ label: 'Couleur de la brume', get: () => params.fogColor, set: (v) => { params.fogColor = v; ctx.fogRef.color.set(v); if (params.bgMode === 'solid') ctx.applyBackground() } }),
  ]
  sFog.body.append(...fogRows)
  for (const row of fogRows) visibleWhen(row, () => params.fogEnabled)

  // ---- clouds (moved from Create, controls unchanged) ----
  const sCld = elementsPanel.addSection(section('Nuages', { open: true }))
  const rebuildClouds = () => ctx.clouds.build(params)
  const cloudLive = (label, key, min, max, step) =>
    slider({ label, min, max, step, get: () => params[key], set: (v) => { params[key] = v } })
  const cloudBaked = (label, key, min, max, step) => {
    const s = cloudLive(label, key, min, max, step)
    s.querySelector('input').addEventListener('change', rebuildClouds)
    return s
  }
  sCld.body.append(
    toggle({ label: 'Nuages volumétriques', get: () => params.cloudsEnabled, set: (v) => { params.cloudsEnabled = v; rebuildClouds(); refreshAll() } })
  )
  const cloudRows = [
    cloudLive('Densité', 'cloudOpacity', 0.05, 1.5, 0.05),
    cloudBaked('Échelle', 'cloudScale', 0.5, 5, 0.1),
    cloudBaked('Trouées', 'cloudCoverage', 0, 0.8, 0.01),
    cloudBaked('Gonflement vertical', 'cloudBillow', 0, 1, 0.05),
    cloudLive('Luminosité', 'cloudBrightness', 0.5, 5, 0.1),
    cloudLive('Contraste', 'cloudContrast', 0.4, 2.5, 0.05),
    cloudLive('Translucidité', 'cloudSSS', 0, 2, 0.05),
    cloudBaked('Altitude', 'cloudAltitude', 0, 16, 0.5),
    cloudBaked('Étalement en altitude', 'cloudAltSpread', 0, 1, 0.05),
    cloudLive('Vitesse de dérive', 'cloudDrift', 0, 4, 0.1),
    cloudLive('Variation de dérive', 'cloudDriftVar', 0, 1, 0.05),
  ]
  sCld.body.append(...cloudRows)
  for (const row of cloudRows) visibleWhen(row, () => params.cloudsEnabled)
  elementsPanel.body.prepend(sCld.root) // ordre de lecture : Nuages, Brume, Mer

  // ---- sea (ocean-waves random spectrum — moved here from Create's old
  // Water section: one home for every effect) ----
  if (FLAGS.water) {
    const sSea = elementsPanel.addSection(section('Mer'))
    sSea.body.append(
      toggle({ label: 'Mer animée', get: () => params.waterReal, set: (v) => { params.waterReal = v; ctx.waterRebuild(); refreshAll() } })
    )
    const reseed = el('button', 'ce-pillbtn')
    reseed.type = 'button'
    reseed.textContent = 'Nouvel état de mer'
    reseed.setAttribute('data-tip', 'Tire un nouveau spectre de vagues aléatoire — la graine voyage dans les liens de partage.')
    reseed.addEventListener('click', () => { params.seaSeed = ctx.realWater?.reseed() ?? 0 })
    const seaRows = [
      slider({ label: 'Hauteur des vagues', min: 0, max: 2, step: 0.05, get: () => params.seaWaveH, set: (v) => { params.seaWaveH = v; ctx.realWater?.setWaves({ height: v }) } }),
      slider({ label: 'Clapot', min: 0, max: 1, step: 0.05, get: () => params.seaChop, set: (v) => { params.seaChop = v; ctx.realWater?.setWaves({ choppiness: v }) } }),
      slider({ label: 'Vitesse', min: 0, max: 2, step: 0.05, get: () => params.seaSpeed, set: (v) => { params.seaSpeed = v; ctx.realWater?.setWaves({ speed: v }) } }),
      slider({ label: 'Transparence du fond', min: 0, max: 1, step: 0.01, get: () => params.waterTransparency, set: (v) => { params.waterTransparency = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Reflet du soleil', min: 0, max: 2, step: 0.02, get: () => params.waterSunFx, set: (v) => { params.waterSunFx = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Réfraction', min: 0, max: 1, step: 0.02, get: () => params.seaRefract ?? 0.6, set: (v) => { params.seaRefract = v; ctx.realWater?.setLook(params) } }),
      toggle({ label: 'Tranche de verre', get: () => params.seaEdge ?? true, set: (v) => { params.seaEdge = v; ctx.waterRebuild(); refreshAll() } }),
      slider({ label: 'Givre de tranche', min: 0, max: 1, step: 0.01, get: () => params.seaEdgeFrost ?? 0.5, set: (v) => { params.seaEdgeFrost = v; ctx.realWater?.setLook(params) } }),
      color({ label: 'Couleur de l’eau', get: () => params.lakeColor, set: (v) => { params.lakeColor = v; ctx.realWater?.setLook(params) } }),
      reseed,
    ]
    // ---- fond marin : picker à vignettes (même UX que matériaux/HDRI) ----
    const bedHead = el('div', 'ce-fx-head', 'Fond marin')
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
          // le fond est PEINT PAR LE TERRAIN : le preset pilote la rampe
          // ocean du relief, l'eau transparente au-dessus fait le lagon
          if (p.floor) {
            params.oceanShallow = p.floor.shallow
            params.oceanMid = p.floor.mid
            params.oceanDeep = p.floor.deep
            ctx.terrain?.mapUniforms.uOceanShallow.value.set(p.floor.shallow)
            ctx.terrain?.mapUniforms.uOceanMid.value.set(p.floor.mid)
            ctx.terrain?.mapUniforms.uOceanDeep.value.set(p.floor.deep)
            ctx.globe?.rebuildRamp?.(params)
          }
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

  // ---- scanner + performance — les deux dernières sections d'Image ----
  if (ctx.scanCtx) panel.addSection(scanSection(ctx.scanCtx))
  if (ctx.perfCtx) panel.addSection(perfSection(ctx.perfCtx))

  return { elementsPanel, imagePanel: panel }
}
