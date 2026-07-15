// CREATE panel — everything that makes the map, in one place (right dock).
// Sections are exclusive accordions. Camera lives in its own sibling panel.

import { el, slider, color, swatch, toggle, select, segmented, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { TEMPLATES } from '../templates.js'
import { generatePalette, generateStyle, generateGridContour } from '../palette.js'
import { PBR_PRESETS, GLASS_PRESETS, GLASS_BY_ID, PBR_BY_ID } from '../material-presets.js'
import { FLAGS } from '../flags.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/></svg>'

export function buildCreatePanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Create',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'Shape the look of the map — templates, colors, clouds, water, light.',
  })

  const addTo = (sec) => panel.addSection(sec)

  // ------------------------------------------------------------ Templates
  const sTpl = addTo(section('Templates', { open: true }))
  const cards = el('div', 'ce-cards')
  const tplButtons = []
  for (const key of Object.keys(TEMPLATES)) {
    const t = TEMPLATES[key]
    const card = el('button', 'ce-card')
    card.type = 'button'
    const stops = t.palette?.rampStops?.map((s) => s.c) ?? []
    card.innerHTML = `<span class="ce-card-name">${(t.label ?? key).replace(/-/g, ' ')}</span><span class="ce-card-strip">${stops
      .map((c) => `<i style="background:${c}"></i>`)
      .join('')}</span>`
    card.addEventListener('click', () => {
      ctx.applyTemplate(t)
      tplButtons.forEach((b) => b.classList.remove('on'))
      card.classList.add('on')
      refreshAll()
      ctx.syncDark?.()
    })
    tplButtons.push(card)
    cards.append(card)
  }
  sTpl.body.append(cards)

  // --- user templates: saved looks with a thumbnail, apply / export / delete,
  // plus save-current and load-from-file. Applying never moves the view. ---
  // saved-look cards use a colour-strip VIGNETTE (like the built-in cards) and
  // are grouped into two categories: Simple (no shader) and Shaders.
  const userWrap = el('div')
  sTpl.body.append(userWrap)
  function makeCard(t) {
    // image-thumbnail card (a div so the action buttons nest validly)
    const card = el('div', 'ce-utpl-card')
    card.setAttribute('role', 'button')
    card.tabIndex = 0
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click() } })
    // thumbnail via DOM APIs (never innerHTML — thumb is user-supplied)
    const media = el(t.thumb ? 'img' : 'div', 'ce-utpl-img')
    if (t.thumb) { media.src = t.thumb; media.alt = '' }
    else if (t.strip?.length) media.style.background = `linear-gradient(90deg, ${t.strip.filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c)).join(',')})`
    const nm = el('span', 'ce-utpl-name')
    nm.textContent = t.name || 'Look'
    card.append(media, nm)
    card.insertAdjacentHTML('beforeend', '<button class="ce-utpl-x" title="Delete" type="button">✕</button><button class="ce-utpl-dl" title="Export .json" type="button">⭳</button>')
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ce-utpl-x, .ce-utpl-dl')) return
      ctx.applyUserTemplate(t); refreshAll(); ctx.syncDark?.()
    })
    card.querySelector('.ce-utpl-x').addEventListener('click', () => { ctx.deleteUserTemplate(t.id); renderUserTemplates() })
    card.querySelector('.ce-utpl-dl').addEventListener('click', () => ctx.exportUserTemplate(t.id))
    return card
  }
  function renderUserTemplates() {
    userWrap.replaceChildren()
    const all = ctx.getUserTemplates?.() ?? []
    const groups = [
      ['Simple', all.filter((t) => !t.shaders)],
      ['Shaders', all.filter((t) => t.shaders)],
    ]
    for (const [label, items] of groups) {
      if (!items.length) continue
      userWrap.append(el('div', 'ce-utpl-cat', label))
      const grid = el('div', 'ce-cards')
      for (const t of items) grid.append(makeCard(t))
      userWrap.append(grid)
    }
  }
  renderUserTemplates()

  const tplRow = el('div', 'ce-btn-row')
  const fileInput = el('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      const text = await f.text()
      if (!ctx.importTemplateText(text)) alert(`"${f.name}" is not a ShibuMap template file.`)
    }
    fileInput.value = ''
    renderUserTemplates()
  })
  // inline name field instead of prompt() — prompt is blocked in some embedded
  // contexts (a likely cause of "save doesn't work") and is off-brand
  const nameInput = el('input', 'ce-tpl-name')
  nameInput.type = 'text'
  nameInput.placeholder = 'Name this look…'
  nameInput.maxLength = 40
  const doSave = () => {
    if (!nameInput.value.trim()) { nameInput.focus(); return } // name required
    ctx.saveCurrentTemplate(nameInput.value)
    nameInput.value = ''
    renderUserTemplates()
  }
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } })
  tplRow.append(nameInput, button('Save', doSave, { accent: true }), button('Load…', () => fileInput.click(), { ghost: true }))
  sTpl.body.append(tplRow, fileInput)

  sTpl.body.append(
    toggle({ label: 'Dark mode', get: () => params.darkMode, set: (v) => { ctx.setDarkMode(v); refreshAll(); ctx.syncDark?.() } })
  )
  const monoRow = el('div', 'ce-btn-row')
  monoRow.append(
    button('Mono white', () => { ctx.applyMonochrome('white'); refreshAll(); ctx.syncDark?.() }),
    button('Mono dark', () => { ctx.applyMonochrome('dark'); refreshAll(); ctx.syncDark?.() })
  )
  const resetRow = el('div', 'ce-btn-row')
  resetRow.append(button('Reset look', () => { ctx.resetLook(); tplButtons.forEach((b) => b.classList.remove('on')); refreshAll(); ctx.syncDark?.() }, { ghost: true }))
  sTpl.body.append(monoRow, resetRow)

  // --------------------------------------------------------------- Colors
  const mode = () => (params.darkMode ? 'dark' : 'light')
  const sCol = addTo(section('Colors'))
  sCol.body.append(el('div', 'ce-label', 'Elevation ramp, low to high'))
  const ramp = el('div', 'ce-ramp')
  params.rampStops.forEach((stop, i) => {
    ramp.append(
      swatch({
        title: `Tint ${i + 1}`,
        get: () => stop.c,
        set: (v) => {
          stop.c = v
          ctx.rebuildRamp()
        },
      })
    )
  })
  sCol.body.append(ramp)
  sCol.body.append(
    color({ label: 'Ocean shallow', get: () => params.oceanShallow, set: (v) => { params.oceanShallow = v; ctx.terrain.mapUniforms.uOceanShallow.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Ocean mid', get: () => params.oceanMid, set: (v) => { params.oceanMid = v; ctx.terrain.mapUniforms.uOceanMid.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Ocean deep', get: () => params.oceanDeep, set: (v) => { params.oceanDeep = v; ctx.terrain.mapUniforms.uOceanDeep.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Ink (contours)', get: () => params.contourColor, set: (v) => { params.contourColor = v; ctx.terrain.mapUniforms.uContourColor.value.set(v); ctx.globe.setInk(v) } }),
    color({ label: 'Grid', get: () => params.gridColor, set: (v) => { params.gridColor = v; ctx.terrain.mapUniforms.uGridColor.value.set(v) } })
  )
  const shuffleRow = el('div', 'ce-btn-row')
  shuffleRow.append(
    button('Shuffle palette', () => { ctx.applyPalette(generatePalette(Math.random, mode())); refreshAll() }),
    button('Shuffle style', () => { ctx.applyStyle(generateStyle()); ctx.applyGridContour(generateGridContour(Math.random, mode())); refreshAll() })
  )
  sCol.body.append(shuffleRow)

  // ------------------------------------------------------------ Background
  // The scene backdrop behind the block. Changing it moves the fog to the same
  // colour, so the relief always fades into its own background.
  const sBg = addTo(section('Background'))
  // --- Environnement (HDRI sky) — a vignette picker; selecting a sky takes over
  // the backdrop + lighting, clearing it returns to the solid/gradient below ---
  sBg.body.append(el('div', 'ce-fx-head', 'Environnement (HDRI)'))
  const envPick = el('div', 'ce-mat-pick')
  sBg.body.append(envPick)
  function renderEnvPicker() {
    envPick.replaceChildren()
    const cur = ctx.getBgEnv()
    const grid = el('div', 'ce-mat-grid')
    const tile = (id, label, media) => {
      const b = el('button', `ce-mat-vig${cur === id ? ' on' : ''}`)
      b.type = 'button'
      b.setAttribute('data-tip', label)
      b.append(media, el('span', 'ce-mat-vig-name', label))
      b.addEventListener('click', () => { ctx.setBgEnv(id); renderEnvPicker() })
      return b
    }
    const none = el('span', 'ce-mat-vig-img ce-mat-vig-none')
    grid.append(tile('', 'Aucun', none))
    for (const e of ctx.environments) {
      const img = el('img', 'ce-mat-vig-img'); img.src = e.thumb; img.alt = e.label; img.loading = 'lazy'
      grid.append(tile(e.id, e.label, img))
    }
    envPick.append(grid)
  }
  renderEnvPicker()
  ctx.registerBgRefresh?.(renderEnvPicker) // let a template/reset resync the sky highlight
  sBg.body.append(
    select({ label: 'Type', options: ctx.bgModes, get: () => params.bgMode, set: (v) => {
      const wasSolid = params.bgMode === 'solid' || !params.bgMode
      params.bgMode = v
      // activating a gradient auto-derives harmonious stops from the map palette
      if (v !== 'solid' && wasSolid) ctx.autoBgColours(); else ctx.applyBackground()
      renderBg(); refreshAll()
    } }),
    color({ label: 'Colour A (top)', get: () => params.bgColorA, set: (v) => { params.bgColorA = v; ctx.applyBackground() } })
  )
  const bgWrap = el('div')
  sBg.body.append(bgWrap)
  function renderBg() {
    bgWrap.replaceChildren()
    if (params.bgMode === 'solid' || !params.bgMode) return
    bgWrap.append(
      color({ label: 'Colour B', get: () => params.bgColorB, set: (v) => { params.bgColorB = v; ctx.applyBackground() } }),
      color({ label: 'Colour C', get: () => params.bgColorC, set: (v) => { params.bgColorC = v; ctx.applyBackground() } })
    )
    if (params.bgMode === 'linear') {
      bgWrap.append(slider({ label: 'Angle', min: 0, max: 360, step: 1, get: () => params.bgAngle, set: (v) => { params.bgAngle = v; ctx.applyBackground() } }))
    }
    const r = el('div', 'ce-btn-row')
    r.append(button('Auto colours from map', () => { ctx.autoBgColours(); refreshAll() }, { ghost: true }))
    bgWrap.append(r)
  }
  renderBg()

  // ------------------------------------------------------------ Map style
  const sMap = addTo(section('Map style'))
  const u = () => ctx.terrain.mapUniforms
  sMap.body.append(
    toggle({ label: 'City labels', get: () => params.cityLabels, set: (v) => { params.cityLabels = v; ctx.cityRebuild() } }),
    slider({ label: 'Hypsometric tint', min: 0, max: 1, step: 0.02, get: () => params.mapTint, set: (v) => { params.mapTint = v; u().uTint.value = v } }),
    slider({ label: 'Height contrast', min: 0.5, max: 20, step: 0.1, get: () => params.heightContrast, set: (v) => { params.heightContrast = v; u().uHeightContrast.value = v } }),
    slider({ label: 'Height pivot', min: 0, max: 1, step: 0.01, get: () => params.heightPivot, set: (v) => { params.heightPivot = v; u().uHeightPivot.value = v } }),
    slider({ label: 'Slope shading', min: 0, max: 1, step: 0.02, get: () => params.slopeTint, set: (v) => { params.slopeTint = v; u().uSlopeTint.value = v } }),
    slider({ label: 'Contour interval', min: 0.04, max: 0.6, step: 0.01, get: () => params.contourInterval, set: (v) => { params.contourInterval = v; u().uContourInterval.value = v } }),
    slider({ label: 'Contour opacity', min: 0, max: 1, step: 0.02, get: () => params.contourOpacity, set: (v) => { params.contourOpacity = v; u().uContourOpacity.value = v } }),
    slider({ label: 'Contour weight', min: 0.3, max: 1.6, step: 0.05, get: () => params.contourWeight, set: (v) => { params.contourWeight = v; if (!params.darkMode) u().uContourWeight.value = v } }),
    slider({ label: 'Grid size', min: 2, max: 14, step: 0.5, get: () => params.gridStep, set: (v) => { params.gridStep = v; u().uGridStep.value = v } }),
    slider({ label: 'Grid opacity', min: 0, max: 1, step: 0.02, get: () => params.gridOpacity, set: (v) => { params.gridOpacity = v; u().uGridOpacity.value = v } }),
    toggle({ label: 'Place labels', get: () => params.labels, set: (v) => { params.labels = v; ctx.setLabelsVisible(v) } }),
    toggle({ label: 'Summit markers', get: () => params.peaksEnabled ?? false, set: (v) => { params.peaksEnabled = v; ctx.peaksLayer.setEnabled(v) } })
  )

  // -------------------------------------------------------------- Terrain
  const sTer = addTo(section('Terrain'))
  const exag = slider({
    label: 'Vertical scale',
    min: 0.5,
    max: 40,
    step: 0.05,
    get: () => params.demExaggeration,
    set: (v) => { params.demExaggeration = v },
  })
  // regenerate only on release: pointerup commits + saves for this zoom
  exag.querySelector('input').addEventListener('change', () => {
    ctx.saveZoomExag(params.demZoom, params.demExaggeration)
    if (params.source === 'real') ctx.regenerateTerrain()
  })
  sTer.body.append(
    select({ label: 'Detail (zoom)', options: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], get: () => String(params.demZoom), set: (v) => { params.demZoom = +v; ctx.onZoomPicked(+v); rebuildRes() } }),
    exag,
    el('div', 'ce-btn-row'),
    slider({ label: 'Fine detail', min: 0, max: 0.8, step: 0.01, get: () => params.detail, set: (v) => { params.detail = v; ctx.saveZoomDetail?.(params.demZoom, v) } }),
    slider({ label: 'Detail scale', min: 0.5, max: 6, step: 0.1, get: () => params.detailScale, set: (v) => { params.detailScale = v } })
  )

  // Mesh resolution — the ultra-heavy 2048 / 4096 tiers are offered ONLY at the
  // finest zoom (where the DEM actually carries that much detail). Rebuilt on
  // every zoom change; leaving max zoom clamps a high pick back down to 1024.
  const resWrap = el('div')
  sTer.body.append(resWrap)
  function rebuildRes() {
    const atMax = params.demZoom >= (ctx.getFineZoom?.() ?? 15)
    if (params.resolution > 2048) params.resolution = 2048 // hard ceiling
    if (!atMax && params.resolution > 1024) params.resolution = 1024
    const base = ['256', '384', '512', '768', '1024']
    const opts = atMax ? [...base, '2048'] : base
    resWrap.replaceChildren(
      select({ label: 'Mesh resolution', options: opts, get: () => String(params.resolution), set: (v) => { params.resolution = +v; ctx.regenerateTerrain() } })
    )
    if (atMax) resWrap.append(el('div', 'ce-note ce-warn', '⚠ 2048 is very heavy — it can slow the tab to a crawl. Use only briefly, at this zoom.'))
  }
  rebuildRes()
  // detail sliders regenerate on release
  for (const inp of sTer.body.querySelectorAll('.ce-slider')) {
    if (inp === exag.querySelector('input')) continue
    inp.addEventListener('change', () => ctx.regenerateTerrain())
  }
  sTer.body.querySelector('.ce-btn-row').append(
    button('Reset scale for this zoom', () => { ctx.resetZoomExag(); refreshAll() }, { ghost: true })
  )
  const isolate = toggle({
    label: 'Isolate the zone',
    get: () => params.regionMode ?? false,
    set: (v) => {
      params.regionMode = v
      ctx.setRegionMode(v)
    },
  })
  isolate.setAttribute('data-tip', 'Cut the map to the country or region under your view — no square base.')
  sTer.body.append(isolate)

  // --------------------------------------------------------------- Clouds
  const sCld = addTo(section('Clouds'))
  const rebuildClouds = () => ctx.clouds.build(params)
  const cloudLive = (label, key, min, max, step) =>
    slider({ label, min, max, step, get: () => params[key], set: (v) => { params[key] = v } })
  const cloudBaked = (label, key, min, max, step) => {
    const s = cloudLive(label, key, min, max, step)
    s.querySelector('input').addEventListener('change', rebuildClouds)
    return s
  }
  sCld.body.append(
    toggle({ label: 'Volumetric clouds', get: () => params.cloudsEnabled, set: (v) => { params.cloudsEnabled = v; rebuildClouds() } }),
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
    cloudLive('Drift variation', 'cloudDriftVar', 0, 1, 0.05)
  )

  // ---------------------------------------------------------------- Water
  if (FLAGS.water) {
    // The water simulation (v37): translucent sunlit shallows with bold caustic
    // rays, darkening depths, gentle Beaufort sea states. The old glass water
    // is gone. GPU-heavy, so it stays opt-in with a plain warning.
    const sWat = addTo(section('Water'))
    sWat.body.append(
      toggle({ label: 'Water simulation (beta)', get: () => params.waterReal, set: (v) => { params.waterReal = v; ctx.waterRebuild() } }),
      el('div', 'ce-label', 'GPU-heavy — may slow down some computers. Turn it off anytime.'),
      color({ label: 'Water colour', get: () => params.lakeColor, set: (v) => { params.lakeColor = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Sea state (F1–F3)', min: 1, max: 3, step: 1, get: () => params.waterWind ?? 2, set: (v) => { params.waterWind = v; ctx.realWater?.setWind(v) } }),
      slider({ label: 'Transparency', min: 0, max: 1, step: 0.01, get: () => params.waterTransparency ?? 0.4, set: (v) => { params.waterTransparency = v; ctx.realWater?.setLook(params) } }),
      slider({ label: 'Sun reflection', min: 0, max: 2, step: 0.02, get: () => params.waterSunFx ?? 1, set: (v) => { params.waterSunFx = v; ctx.realWater?.setLook(params) } })
    )
  }

  // ---------------------------------------------------------------- Light
  const sLig = addTo(section('Light'))
  if (FLAGS.lightingPresets) {
    // studio lighting presets — reconfigure sun + hemi + IBL (+ softbox area
    // lights / accent spot) into a photographer's rig (see lighting.js)
    sLig.body.append(
      select({ label: 'Studio preset', options: ctx.lightPresets, get: () => params.lightPreset, set: (v) => { ctx.applyLightPreset(v); refreshAll() } })
    )
    // 24 h sun cycle: one slider drives azimuth, elevation, intensity and warmth
    sLig.body.append(
      slider({ label: 'Time of day (h)', min: 0, max: 24, step: 0.25, get: () => params.timeOfDay, set: (v) => { params.timeOfDay = v; ctx.applyTimeOfDay(v); refreshAll() } })
    )
    sLig.body.append(el('div', 'ce-label', 'Manual sun overrides (also driven by the two above)'))
  }
  sLig.body.append(
    slider({ label: 'Sun intensity', min: 0, max: 16, step: 0.1, get: () => params.sunIntensity, set: (v) => { params.sunIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Sun azimuth', min: 0, max: 360, step: 1, get: () => params.sunAzimuth, set: (v) => { params.sunAzimuth = v; ctx.placeSun() } }),
    slider({ label: 'Sun elevation', min: 5, max: 85, step: 1, get: () => params.sunElevation, set: (v) => { params.sunElevation = v; ctx.placeSun() } }),
    slider({ label: 'Ambient', min: 0, max: 2, step: 0.05, get: () => params.hemiIntensity, set: (v) => { params.hemiIntensity = v; ctx.placeSun() } }),
    slider({ label: 'Shadow fill', min: 0, max: 1.5, step: 0.02, get: () => params.envLight, set: (v) => { params.envLight = v; ctx.scene.environmentIntensity = v } }),
    slider({ label: 'Shadow softness', min: 0, max: 30, step: 0.5, get: () => params.shadowSoftness, set: (v) => { params.shadowSoftness = v; ctx.sun.shadow.radius = v } })
  )

  // ---------------------------------------------------------------- Block
  const sBlk = addTo(section('Block'))
  sBlk.body.append(
    toggle({ label: 'Show block', get: () => params.plinth, set: (v) => { params.plinth = v; ctx.plinth.setVisible(v && ctx.modes.mode === 'surface') } }),
    slider({ label: 'Thickness', min: 2, max: 16, step: 0.5, get: () => params.plinthDepth, set: (v) => { params.plinthDepth = v } }),
    color({ label: 'Edge colour', get: () => params.plinthColor, set: (v) => { params.plinthColor = v; ctx.plinth.setColors(params) } })
  )
  sBlk.body.children[1].querySelector('input').addEventListener('change', () => ctx.plinth.rebuild(ctx.terrain, params))

  // Socle material — give the block a real finish: 25 PBR solids (metals, stone,
  // ceramics) OR 25 physical glasses. Glass adds a Diffusion (frost) knob and a
  // Ground glow that pools the glass colour onto the table below.
  const matWrap = el('div')
  sBlk.body.append(matWrap)
  function rebuildMat() {
    const glass = params.plinthFinish === 'glass'
    const list = glass ? GLASS_PRESETS : PBR_PRESETS
    const kids = [
      segmented({ label: 'Material finish', options: [{ value: 'solid', label: 'Solid' }, { value: 'glass', label: 'Glass' }], get: () => params.plinthFinish, set: (v) => { params.plinthFinish = v; ctx.applyPlinthMaterial(); rebuildMat() } }),
      select({ label: glass ? 'Glass' : 'PBR material', options: list.map((p) => ({ value: p.id, label: p.name })), get: () => (glass ? params.plinthGlass : params.plinthPbr), set: (v) => {
        if (glass) { params.plinthGlass = v; params.plinthGlassDiffusion = GLASS_BY_ID[v].diffusion } else params.plinthPbr = v
        ctx.applyPlinthMaterial(); rebuildMat()
      } }),
    ]
    if (glass) {
      kids.push(
        slider({ label: 'Diffusion (frost)', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassDiffusion, set: (v) => { params.plinthGlassDiffusion = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Bump', min: 0, max: 2, step: 0.02, get: () => params.plinthGlassBump, set: (v) => { params.plinthGlassBump = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Ground glow', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassProjection, set: (v) => { params.plinthGlassProjection = v; ctx.applyPlinthMaterial() } })
      )
    } else if (PBR_BY_ID[params.plinthPbr]?.tex) {
      // textured PBR (carbon, wood): exaggerated relief with a live bump slider
      kids.push(
        slider({ label: 'Bump', min: 0, max: 3, step: 0.05, get: () => params.plinthBump, set: (v) => { params.plinthBump = v; ctx.applyPlinthMaterial() } })
      )
    }
    matWrap.replaceChildren(...kids)
  }
  rebuildMat()

  sBlk.body.append(
    toggle({ label: 'Ground cartouche', get: () => params.groundInfo, set: (v) => { params.groundInfo = v; ctx.setGroundInfo(v) } })
  )

  // -------------------------------------------------------------- Effects
  const sFx = addTo(section('Effects'))
  sFx.body.append(
    slider({ label: 'Exposure', min: 0.2, max: 3, step: 0.02, get: () => params.exposure, set: (v) => { params.exposure = v; ctx.exposureFx.uniforms.get('exposure').value = v } }),
    slider({ label: 'Contrast', min: -0.2, max: 0.5, step: 0.01, get: () => params.contrast, set: (v) => { params.contrast = v; ctx.contrastFx.uniforms.get('contrast').value = v } }),
    slider({ label: 'Saturation', min: -1, max: 0, step: 0.02, get: () => params.saturation, set: (v) => { params.saturation = v; ctx.hueSat.saturation = v } }),
    slider({ label: 'Vignette', min: 0, max: 1, step: 0.02, get: () => params.vignette, set: (v) => { params.vignette = v; ctx.vignette.darkness = v } }),
    slider({ label: 'Grain', min: 0, max: 0.5, step: 0.01, get: () => params.grain, set: (v) => { params.grain = v; ctx.grain.blendMode.opacity.value = v } }),
    toggle({ label: 'Fog', get: () => params.fogEnabled, set: (v) => { params.fogEnabled = v; ctx.setFogEnabled(v) } }),
    slider({ label: 'Fog start', min: 5, max: 60, step: 0.5, get: () => params.fogNear, set: (v) => { params.fogNear = v; ctx.fogRef.near = v } }),
    slider({ label: 'Fog end', min: 15, max: 90, step: 0.5, get: () => params.fogFar, set: (v) => { params.fogFar = v; ctx.fogRef.far = v } }),
    color({ label: 'Fog colour', get: () => params.fogColor, set: (v) => { params.fogColor = v; ctx.fogRef.color.set(v); if (params.bgMode === 'solid') ctx.applyBackground() } })
  )

  return panel
}
