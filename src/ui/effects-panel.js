// Effects panel — right column, below Map. Gathers everything that shapes the
// IMAGE rather than the map data: the new render effects (AO, bloom), the
// post chain (exposure/contrast/saturation/vignette/grain/fog) moved verbatim
// from the Create panel, and the volumetric clouds moved with them (explicit
// request: one home for every effect, clouds included).
//
// UX v2 (passe Éléments/Effets, mêmes règles que Terrain v2 / Fonds v2) :
//  - chaque section replie sur une META parlante (« Épars · dérive rapide »,
//    « Animée · Brise », « +0,1 ev · grain léger ») ;
//  - le réglage STAR d'une section est traité en star : PRESETS en chips
//    (détection par proximité des valeurs, jamais d'état stocké) + curseur
//    fin dessous ; la mécanique part en « Réglages fins » au fond ;
//  - les presets ne font que SETTER des params existants — zéro moteur.

import { el, section, toggle, slider, color, visibleWhen, refreshAll, onRefresh, keepScroll } from './kit.js'
import { Panel } from './shell.js'
import { FLAGS } from '../flags.js'
import { SEABEDS } from '../ocean.js'
import { scanSection } from './scan-panel.js'
import { lightSection } from './light-panel.js'

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

// proximité de valeurs — la détection d'un preset actif compare les params
// COURANTS aux valeurs du preset (comme EXAG/QUALITY_PRESETS), avec une
// tolérance relative par clé
const near = (a, b, tol) => Math.abs(a - b) <= tol

// ---- presets de CARACTÈRE des nuages (coverage/billow/contrast/opacity) ----
// « Dégagé » n'est pas un réglage : c'est cloudsEnabled=false — la présence
// fait partie du caractère, une seule rangée de chips décide de tout.
export const CLOUD_PRESETS = [
  { id: 'epars', label: 'Épars', v: { cloudCoverage: 1.7, cloudBillow: 1.2, cloudContrast: 1.2, cloudOpacity: 1.0 } },
  { id: 'couvert', label: 'Couvert', v: { cloudCoverage: 0.85, cloudBillow: 0.7, cloudContrast: 0.7, cloudOpacity: 1.1 } },
  { id: 'drama', label: 'Dramatique', v: { cloudCoverage: 1.25, cloudBillow: 2.2, cloudContrast: 1.8, cloudOpacity: 1.5 } },
]
export const CLOUD_TIPS = {
  degage: 'Ciel dégagé — pas de nuages.',
  epars: 'Cumulus épars, beaucoup de ciel entre eux.',
  couvert: 'Voile continu, lumière diffuse.',
  drama: 'Masses hautes et contrastées, ciel de grain.',
}
export const cloudPresetOf = (params) =>
  CLOUD_PRESETS.find((p) =>
    near(params.cloudCoverage, p.v.cloudCoverage, 0.03) &&
    near(params.cloudBillow, p.v.cloudBillow, 0.06) &&
    near(params.cloudContrast, p.v.cloudContrast, 0.08) &&
    near(params.cloudOpacity, p.v.cloudOpacity, 0.08))

// ---- presets d'ÉTAT DE MER (hauteur/clapot/vitesse) --------------------------
// ⚠️ Beaufort plafonné F3 : les valeurs restent DANS les plages actuelles des
// sliders (waveH 0..2, chop 0..1, speed 0..2) — jamais au-delà.
export const SEA_PRESETS = [
  { id: 'calme', label: 'Calme', v: { seaWaveH: 0.2, seaChop: 0.1, seaSpeed: 0.6 } },
  { id: 'brise', label: 'Brise', v: { seaWaveH: 0.8, seaChop: 0.7, seaSpeed: 1 } },
  { id: 'agitee', label: 'Agitée', v: { seaWaveH: 1.5, seaChop: 0.95, seaSpeed: 1.35 } },
]
export const SEA_TIPS = {
  calme: 'Mer d’huile — houle à peine perceptible.',
  brise: 'Petites vagues et premiers moutons.',
  agitee: 'Mer formée, crêtes déferlantes (plafond F3).',
}
export const seaPresetOf = (params) =>
  SEA_PRESETS.find((p) =>
    near(params.seaWaveH, p.v.seaWaveH, 0.06) &&
    near(params.seaChop, p.v.seaChop, 0.05) &&
    near(params.seaSpeed, p.v.seaSpeed, 0.06))

// ---- looks photo SOBRES du Développement (pas de random, trois recettes) ----
// LE DÉVELOPPEMENT DE BASE (Adrien) : exposition, contraste et saturation sont
// le rendu maison. Ni le lancement, ni un template, ni le dé ne les bougent —
// seules les chips ci-dessous et leurs tirettes y touchent. C'est aussi la
// recette exacte de la chip « Naturel ». Source unique : main.js importe cette
// constante pour ses valeurs d'usine et pour le look de démarrage.
export const BASE_GRADE = { exposure: 0.92, contrast: -0.03, saturation: -0.1 }

// « Naturel » = les valeurs d'usine — la chip dit aussi « revenir au neutre ».
const LOOK_PRESETS = [
  { id: 'naturel', label: 'Naturel', v: { ...BASE_GRADE, vignette: 0.6, grain: 0 } },
  { id: 'doux', label: 'Doux', v: { exposure: 1.06, contrast: -0.02, saturation: -0.5, vignette: 0.35, grain: 0.06 } },
  { id: 'contraste', label: 'Contrasté', v: { exposure: 0.94, contrast: 0.2, saturation: -0.22, vignette: 0.7, grain: 0 } },
]
const LOOK_TIPS = {
  naturel: 'Le rendu d’usine — neutre et fidèle.',
  doux: 'Voile clair, couleurs feutrées, grain fin.',
  contraste: 'Noirs denses, vignettage marqué.',
}
// La chip active se reconnaît au TRIO seul — vignettage et grain dérivent avec
// les templates et le dé, et les inclure éteignait les trois chips en
// permanence alors que le développement, lui, n'avait pas bougé.
const lookPresetOf = (params) =>
  LOOK_PRESETS.find((p) =>
    near(params.exposure, p.v.exposure, 0.03) &&
    near(params.contrast, p.v.contrast, 0.02) &&
    near(params.saturation, p.v.saturation, 0.04))

// rangée de chips générique : presets → set(params) ; l'état actif se déduit
// par proximité à chaque refreshAll (règle constante — pas d'état séparé)
function chipRowOf(presets, tips, isOn, apply) {
  const row = el('div', 'ce-chiprow')
  const chips = presets.map((p) => {
    const b = el('button', 'ce-chip', p.label)
    b.type = 'button'
    if (tips[p.id]) b.setAttribute('data-tip', tips[p.id])
    b.addEventListener('click', () => {
      apply(p)
      refreshAll()
    })
    row.append(b)
    return b
  })
  onRefresh(() => presets.forEach((p, i) => chips[i].classList.toggle('on', !!isOn(p))), row)
  return row
}

// Deux panneaux du rail GAUCHE en mode Studio (réorg Adrien) :
// « Éléments » = Lumière / Nuages / Brume / Mer ; « Effets » = le rendu
// final (développement, SSAO/bloom, scanner — la Performance vit dans la roue
// crantée des paramètres globaux). Retourne les deux — main.js fixe l'ordre.
export function buildEffectsPanel(ctx) {
  const { params } = ctx
  const elementsPanel = new Panel({ title: 'Éléments', icon: ICON_ELEM, side: 'left', width: 268, tip: 'La lumière, l’air et l’eau : soleil, nuages, brume, mer.' })
  const panel = new Panel({ title: 'Effets', icon: ICON, side: 'left', width: 268, tip: 'Le rendu final : développement de l’image, SSAO et bloom, scanner.' })
  // Lumière en TÊTE d'Éléments (l'ordre de lecture : Lumière, Nuages, Brume, Mer)
  if (ctx.lightCtx) elementsPanel.addSection(lightSection(ctx.lightCtx))

  // ---- clouds — le star est le CARACTÈRE du ciel (chips), le technique au fond
  const sCld = elementsPanel.addSection(section('Nuages'))
  const rebuildClouds = () => { ctx.clouds.build(params); ctx.syncCloudsVisible?.() }
  // dflt : un look sauvegardé AVANT l'ajout d'un réglage ne le contient pas —
  // sans repli, le slider crashe au boot (toFixed sur undefined, vécu)
  const cloudLive = (label, key, min, max, step, dflt = 0) =>
    slider({ label, min, max, step, get: () => params[key] ?? dflt, set: (v) => { params[key] = v } })
  const cloudBaked = (label, key, min, max, step) => {
    const s = cloudLive(label, key, min, max, step)
    s.querySelector('input').addEventListener('change', rebuildClouds)
    return s
  }
  // « Dégagé » + trois caractères sur UNE rangée : la présence des nuages est
  // un choix de ciel, pas un interrupteur technique à part
  const skyPresets = [{ id: 'degage', label: 'Dégagé', v: null }, ...CLOUD_PRESETS]
  const cloudChips = chipRowOf(
    skyPresets,
    CLOUD_TIPS,
    (p) => (p.v ? params.cloudsEnabled && cloudPresetOf(params) === p : !params.cloudsEnabled),
    (p) => {
      if (!p.v) { params.cloudsEnabled = false; rebuildClouds(); return }
      params.cloudsEnabled = true
      Object.assign(params, p.v)
      rebuildClouds()
    }
  )
  sCld.body.append(cloudChips)
  const cloudRows = [
    cloudLive('Densité', 'cloudOpacity', 0.05, 2.5, 0.05),
    // 0 = bourgeons nets (rendu actuel), 1 = coton doux (ancien rendu)
    cloudLive('Texture cotonneuse', 'cloudTexMix', 0, 1, 0.05, 0.35),
    el('div', 'ce-fx-head', 'Réglages fins'),
    cloudBaked('Échelle', 'cloudScale', 0.5, 5, 0.1),
    // Trouées et Bourgeonnement pilotent des uniformes : plus besoin de
    // reconstruire tout le ciel (l'ancien moteur les cuisait dans son volume)
    cloudLive('Trouées', 'cloudCoverage', 0.8, 2.6, 0.02, 0.9),
    cloudLive('Bourgeonnement', 'cloudBillow', 0, 3, 0.05, 0.8),
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
  onRefresh(() => {
    if (!params.cloudsEnabled) { sCld.setMeta('Dégagé'); return }
    const name = cloudPresetOf(params)?.label ?? 'Personnalisés'
    const drift = params.cloudDrift === 0 ? 'immobiles' : params.cloudDrift < 2 ? 'dérive lente' : 'dérive rapide'
    sCld.setMeta(`${name} · ${drift}`)
  }, sCld.head)

  // ---- vent — élément à part entière : il pousse le ciel aujourd'hui, il
  // fera buter les nuages contre les versants au vent en phase 2 (orographie)
  const sWind = elementsPanel.addSection(section('Vent'))
  const windRows = [
    slider({ label: 'Direction', min: 0, max: 359, step: 1, get: () => params.windDir ?? 45, set: (v) => { params.windDir = v } }),
    slider({ label: 'Force', min: 0, max: 3, step: 0.05, get: () => params.windSpeed ?? 0.6, set: (v) => { params.windSpeed = v } }),
  ]
  sWind.body.append(...windRows)
  // le vent ne se règle que si quelque chose vole
  for (const row of windRows) visibleWhen(row, () => params.cloudsEnabled)
  const windNote = el('div', 'ce-bg-note on', 'Le vent agit sur les nuages — allume-les pour le sentir.')
  sWind.body.append(windNote)
  visibleWhen(windNote, () => !params.cloudsEnabled)
  // rose des vents parlante : d'où vient le vent, en points cardinaux
  const CARD = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est']
  onRefresh(() => {
    if (!params.cloudsEnabled) { sWind.setMeta('—'); return }
    const s = params.windSpeed ?? 0.6
    if (s < 0.05) { sWind.setMeta('Calme'); return }
    const dir = CARD[Math.round((((params.windDir ?? 45) % 360) / 45)) % 8]
    const force = s < 0.5 ? 'brise' : s < 1.4 ? 'vent soutenu' : 'grand vent'
    sWind.setMeta(`${force} · vers le ${dir}`)
  }, sWind.head)

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
  onRefresh(() => {
    if (!params.fogEnabled) { sFog.setMeta('Off'); return }
    sFog.setMeta(params.fogNear <= 20 ? 'Dense' : 'Douce', params.fogColor)
  }, sFog.head)

  // ---- sea (ocean-waves random spectrum) — le star est l'ÉTAT DE MER ----
  if (FLAGS.water) {
    const sSea = elementsPanel.addSection(section('Mer'))
    sSea.body.append(
      toggle({ label: 'Mer animée', get: () => params.waterReal, set: (v) => { params.waterReal = v; ctx.waterRebuild(); refreshAll() } })
    )
    const applySeaState = (p) => {
      Object.assign(params, p.v)
      ctx.realWater?.setWaves({ height: p.v.seaWaveH, choppiness: p.v.seaChop, speed: p.v.seaSpeed })
    }
    const seaChips = chipRowOf(SEA_PRESETS, SEA_TIPS, (p) => seaPresetOf(params) === p, applySeaState)
    const reseed = el('button', 'ce-pillbtn')
    reseed.type = 'button'
    reseed.textContent = 'Nouvel état de mer'
    reseed.setAttribute('data-tip', 'Tire un nouveau spectre de vagues aléatoire — la graine voyage dans les liens de partage.')
    reseed.addEventListener('click', () => { params.seaSeed = ctx.realWater?.reseed() ?? 0 })
    const seaRows = [
      seaChips,
      slider({ label: 'Hauteur des vagues', min: 0, max: 2, step: 0.05, get: () => params.seaWaveH, set: (v) => { params.seaWaveH = v; ctx.realWater?.setWaves({ height: v }) } }),
      el('div', 'ce-fx-head', 'Apparence'),
      slider({ label: 'Transparence du fond', min: 0, max: 1, step: 0.01, get: () => params.waterTransparency, set: (v) => { params.waterTransparency = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Reflet du soleil', min: 0, max: 2, step: 0.02, get: () => params.waterSunFx, set: (v) => { params.waterSunFx = v; ctx.realWater?.setLook(params) } }),
      color({ label: 'Couleur de l’eau', get: () => params.lakeColor, set: (v) => { params.lakeColor = v; ctx.realWater?.setLook(params) } }),
    ]
    // ---- fond marin : picker à vignettes (même UX que matériaux/HDRI) ----
    const bedHead = el('div', 'ce-fx-head', 'Fond marin')
    const bedPick = el('div', 'ce-mat-pick')
    const renderBedPicker = () => keepScroll(bedPick, renderBedPickerInner)
    function renderBedPickerInner() {
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
    seaRows.push(bedHead, bedPick)
    // ---- la mécanique de la houle, au fond ----
    seaRows.push(
      el('div', 'ce-fx-head', 'Réglages fins'),
      slider({ label: 'Clapot', min: 0, max: 1, step: 0.05, get: () => params.seaChop, set: (v) => { params.seaChop = v; ctx.realWater?.setWaves({ choppiness: v }) } }),
      slider({ label: 'Vitesse', min: 0, max: 2, step: 0.05, get: () => params.seaSpeed, set: (v) => { params.seaSpeed = v; ctx.realWater?.setWaves({ speed: v }) } }),
      slider({ label: 'Réfraction', min: 0, max: 1, step: 0.02, get: () => params.seaRefract ?? 0.6, set: (v) => { params.seaRefract = v; ctx.realWater?.setLook(params) } }),
      toggle({ label: 'Tranche de verre', get: () => params.seaEdge ?? true, set: (v) => { params.seaEdge = v; ctx.waterRebuild(); refreshAll() } }),
      slider({ label: 'Givre de tranche', min: 0, max: 1, step: 0.01, get: () => params.seaEdgeFrost ?? 0.5, set: (v) => { params.seaEdgeFrost = v; ctx.realWater?.setLook(params) } }),
      reseed
    )
    sSea.body.append(...seaRows)
    for (const row of seaRows) visibleWhen(row, () => params.waterReal)
    onRefresh(() => {
      if (!params.waterReal) { sSea.setMeta('Off'); return }
      const state = seaPresetOf(params)?.label
      sSea.setMeta(state ? `Animée · ${state}` : 'Animée', params.lakeColor)
    }, sSea.head)
  }

  // ==================================================================== Effets
  // ---- Développement — le star du panneau (pattern Lightroom) : trois looks
  // sobres en chips, les curseurs de développement dessous, l'objectif
  // (vignettage/grain) en sous-groupe
  const sDev = panel.addSection(section('Développement'))
  const applyLook = (p) => {
    Object.assign(params, p.v)
    ctx.exposureFx.uniforms.get('exposure').value = p.v.exposure
    ctx.contrastFx.uniforms.get('contrast').value = p.v.contrast
    ctx.hueSat.saturation = p.v.saturation
    ctx.vignette.darkness = p.v.vignette
    ctx.grain.blendMode.opacity.value = p.v.grain
  }
  sDev.body.append(
    chipRowOf(LOOK_PRESETS, LOOK_TIPS, (p) => lookPresetOf(params) === p, applyLook),
    slider({ label: 'Exposition', min: 0.2, max: 3, step: 0.02, get: () => params.exposure, set: (v) => { params.exposure = v; ctx.exposureFx.uniforms.get('exposure').value = v } }),
    slider({ label: 'Contraste', min: -0.2, max: 0.5, step: 0.01, get: () => params.contrast, set: (v) => { params.contrast = v; ctx.contrastFx.uniforms.get('contrast').value = v } }),
    slider({ label: 'Saturation', min: -1, max: 0, step: 0.02, get: () => params.saturation, set: (v) => { params.saturation = v; ctx.hueSat.saturation = v } }),
    el('div', 'ce-fx-head', 'Objectif'),
    slider({ label: 'Vignettage', min: 0, max: 1, step: 0.02, get: () => params.vignette, set: (v) => { params.vignette = v; ctx.vignette.darkness = v } }),
    slider({ label: 'Grain', min: 0, max: 0.5, step: 0.01, get: () => params.grain, set: (v) => { params.grain = v; ctx.grain.blendMode.opacity.value = v } })
  )
  onRefresh(() => {
    // meta façon Lightroom : le look s'il est reconnu, sinon l'écart
    // d'exposition en ev ; le grain se dit s'il existe
    const look = lookPresetOf(params)
    const ev = Math.log2(Math.max(0.01, params.exposure))
    const base = look ? look.label : `${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(1)} ev`
    const grain = params.grain <= 0 ? '' : params.grain <= 0.15 ? ' · grain léger' : ' · grain fort'
    sDev.setMeta(`${base}${grain}`)
  }, sDev.head)

  // ---- Rendu — la mécanique (SSAO/bloom), au fond du panneau ----
  const sRen = panel.addSection(section('Rendu'))
  const aoT = toggle({ label: 'Ombrage des creux (SSAO)', get: () => params.ssaoEnabled, set: (v) => { params.ssaoEnabled = v; refreshAll() } })
  const aoI = slider({ label: 'Intensité de l’ombrage', min: 0.5, max: 12, step: 0.05, get: () => params.ssaoIntensity, set: (v) => { params.ssaoIntensity = v; ctx.ssao.intensity = v } })
  const blT = toggle({ label: 'Bloom (lueur)', get: () => params.bloomEnabled, set: (v) => { params.bloomEnabled = v; refreshAll() } })
  const blI = slider({ label: 'Intensité du bloom', min: 0, max: 2, step: 0.02, get: () => params.bloomIntensity, set: (v) => { params.bloomIntensity = v; ctx.bloom.intensity = v } })
  const blH = slider({ label: 'Seuil du bloom', min: 0.4, max: 1, step: 0.01, get: () => params.bloomThreshold, set: (v) => { params.bloomThreshold = v; ctx.bloom.luminanceMaterial.threshold = v } })
  sRen.body.append(aoT, aoI, blT, blI, blH)
  visibleWhen(aoI, () => params.ssaoEnabled)
  for (const row of [blI, blH]) visibleWhen(row, () => params.bloomEnabled)
  onRefresh(() => {
    const on = [params.ssaoEnabled && 'SSAO', params.bloomEnabled && 'bloom'].filter(Boolean)
    sRen.setMeta(on.length ? on.join(' · ') : 'Off')
  }, sRen.head)

  // ---- scanner — dernière section d'Effets (la Performance est partie
  // dans la roue crantée des paramètres globaux) ----
  if (ctx.scanCtx) panel.addSection(scanSection(ctx.scanCtx))

  return { elementsPanel, imagePanel: panel }
}
