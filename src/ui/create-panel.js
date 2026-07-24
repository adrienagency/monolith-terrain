// CREATE panel — everything that makes the map, in one place (right dock).
// Sections are exclusive accordions. Camera lives in its own sibling panel.

import { el, slider, color, swatch, toggle, select, segmented, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { generatePalette, generateEarthPalette, generateStyle, generateGridContour } from '../palette.js'
import { PBR_PRESETS, GLASS_PRESETS, GLASS_BY_ID, PBR_BY_ID } from '../material-presets.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/></svg>'

// Panneau « Couleurs » (ex-Création, plan table lumineuse) : rampe du relief,
// fond & ciel, ombrage. Les sections Terrain/Socle emménagent dans le panneau
// Matières (ctx.materialsPanel — construit AVANT par main.js).
export function buildCreatePanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Couleurs',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'La rampe du relief, les océans, le fond et le ciel.',
  })

  const addTo = (sec) => panel.addSection(sec)

  // --------------------------------------------------------------- Colors
  const mode = () => (params.darkMode ? 'dark' : 'light')
  const sCol = addTo(section('Couleurs', { open: true }))
  sCol.body.append(el('div', 'ce-label', 'Rampe d’altitude, du bas vers le haut'))
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
    color({ label: 'Océan peu profond', get: () => params.oceanShallow, set: (v) => { params.oceanShallow = v; ctx.terrain.mapUniforms.uOceanShallow.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Océan moyen', get: () => params.oceanMid, set: (v) => { params.oceanMid = v; ctx.terrain.mapUniforms.uOceanMid.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Océan profond', get: () => params.oceanDeep, set: (v) => { params.oceanDeep = v; ctx.terrain.mapUniforms.uOceanDeep.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Encre (courbes)', get: () => params.contourColor, set: (v) => { params.contourColor = v; ctx.terrain.mapUniforms.uContourColor.value.set(v); ctx.globe.setInk(v) } }),
    color({ label: 'Grille', get: () => params.gridColor, set: (v) => { params.gridColor = v; ctx.terrain.mapUniforms.uGridColor.value.set(v) } })
  )
  // Générateur « poline-style » (Adrien) : rampe relief + rampe océan en un
  // clic, ancres de teinte par biome terrestre — puis Save VALIDE la palette
  // courante dans la rangée Palettes du panneau Templates (défilable).
  let lastGenName = null
  const genRow = el('div', 'ce-btn-row')
  genRow.append(
    button('Générer une palette', () => { const p = generateEarthPalette(); lastGenName = p.name; ctx.applyPalette(p); refreshAll() }, { accent: true }),
    button('Enregistrer la palette', () => { ctx.saveCurrentPalette?.(lastGenName); lastGenName = null }, { ghost: true })
  )
  sCol.body.append(genRow)
  // (« Shuffle palette » supprimé — doublon du générateur ci-dessus)
  const shuffleRow = el('div', 'ce-btn-row')
  shuffleRow.append(
    button('Look aléatoire', () => { ctx.applyStyle(generateStyle()); ctx.applyGridContour(generateGridContour(Math.random, mode())); refreshAll() })
  )
  sCol.body.append(shuffleRow)

  // ------------------------------------------------------------ Background
  // The scene backdrop behind the block. Changing it moves the fog to the same
  // colour, so the relief always fades into its own background.
  const sBg = addTo(section('Fond & ciel'))
  // --- Environnement (HDRI sky) — a vignette picker; selecting a sky takes over
  // the backdrop + lighting, clearing it returns to the solid/gradient below ---
  sBg.body.append(el('div', 'ce-fx-head', 'Ciel (HDRI)'))
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
    grid.append(tile('', 'None', none))
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
    color({ label: 'Couleur A (haut)', get: () => params.bgColorA, set: (v) => { params.bgColorA = v; ctx.applyBackground() } })
  )
  const bgWrap = el('div')
  sBg.body.append(bgWrap)
  function renderBg() {
    bgWrap.replaceChildren()
    if (params.bgMode === 'solid' || !params.bgMode) return
    bgWrap.append(
      color({ label: 'Couleur B', get: () => params.bgColorB, set: (v) => { params.bgColorB = v; ctx.applyBackground() } }),
      color({ label: 'Couleur C', get: () => params.bgColorC, set: (v) => { params.bgColorC = v; ctx.applyBackground() } })
    )
    if (params.bgMode === 'linear') {
      bgWrap.append(slider({ label: 'Angle', min: 0, max: 360, step: 1, get: () => params.bgAngle, set: (v) => { params.bgAngle = v; ctx.applyBackground() } }))
    }
    const r = el('div', 'ce-btn-row')
    r.append(button('Couleurs auto depuis la carte', () => { ctx.autoBgColours(); refreshAll() }, { ghost: true }))
    bgWrap.append(r)
  }
  renderBg()

  // ------------------------------------------------------------ Map style
  const sMap = addTo(section('Ombrage'))
  const u = () => ctx.terrain.mapUniforms
  sMap.body.append(
    slider({ label: 'Teinte hypsométrique', min: 0, max: 1, step: 0.02, get: () => params.mapTint, set: (v) => { params.mapTint = v; u().uTint.value = v } }),
    slider({ label: 'Contraste d’altitude', min: 0.5, max: 20, step: 0.1, get: () => params.heightContrast, set: (v) => { params.heightContrast = v; u().uHeightContrast.value = v } }),
    slider({ label: 'Pivot d’altitude', min: 0, max: 1, step: 0.01, get: () => params.heightPivot, set: (v) => { params.heightPivot = v; u().uHeightPivot.value = v } }),
    slider({ label: 'Ombrage des pentes', min: 0, max: 1, step: 0.02, get: () => params.slopeTint, set: (v) => { params.slopeTint = v; u().uSlopeTint.value = v } })
  )

  // -------------------------------------------------------------- Terrain
  // Terrain + Socle vivent dans le panneau MATIÈRES (construit avant nous —
  // main.js passe ctx.materialsPanel) ; repli sur ce panneau si absent.
  const matPanel = ctx.materialsPanel || panel
  const sTer = matPanel.addSection(section('Terrain'))
  const exag = slider({
    label: 'Échelle verticale',
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
    select({ label: 'Détail (zoom)', options: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], get: () => String(params.demZoom), set: (v) => { params.demZoom = +v; ctx.onZoomPicked(+v); rebuildRes() } }),
    exag,
    el('div', 'ce-btn-row'),
    slider({ label: 'Détail fin', min: 0, max: 0.8, step: 0.01, get: () => params.detail, set: (v) => { params.detail = v; ctx.saveZoomDetail?.(params.demZoom, v) } }),
    slider({ label: 'Échelle du détail', min: 0.5, max: 6, step: 0.1, get: () => params.detailScale, set: (v) => { params.detailScale = v } })
  )

  // Mesh resolution — 2048 is now offered at EVERY zoom (explicit request:
  // 'laisse la possibilité de passer à 2048 de mesh sur tous les zooms'). At
  // coarse zooms the DEM carries less detail than the mesh can express, so
  // 2048 buys smoothness of the interpolated surface, not new information —
  // the warning still says what it costs.
  const resWrap = el('div')
  sTer.body.append(resWrap)
  function rebuildRes() {
    if (params.resolution > 2048) params.resolution = 2048 // hard ceiling
    const opts = ['256', '384', '512', '768', '1024', '2048']
    resWrap.replaceChildren(
      select({ label: 'Résolution du maillage', options: opts, get: () => String(params.resolution), set: (v) => { params.resolution = +v; ctx.regenerateTerrain() } })
    )
    if (params.resolution >= 2048) resWrap.append(el('div', 'ce-note ce-warn', '⚠ 2048 est très lourd — l’onglet peut fortement ralentir.'))
  }
  rebuildRes()
  // detail sliders regenerate on release
  for (const inp of sTer.body.querySelectorAll('.ce-slider')) {
    if (inp === exag.querySelector('input')) continue
    inp.addEventListener('change', () => ctx.regenerateTerrain())
  }
  sTer.body.querySelector('.ce-btn-row').append(
    button('Réinitialiser l’échelle de ce zoom', () => { ctx.resetZoomExag(); refreshAll() }, { ghost: true })
  )
  const isolate = toggle({
    label: 'Isoler la zone',
    get: () => params.regionMode ?? false,
    set: (v) => {
      params.regionMode = v
      ctx.setRegionMode(v)
    },
  })
  isolate.setAttribute('data-tip', 'Découpe la carte au pays ou à la région sous la vue — sans base carrée.')
  sTer.body.append(isolate)

  // --------------------------------------------------------------- Clouds
  // Water moved to the Effects panel ("Sea" section) — one home for every
  // effect, and the wave engine is now the shared ocean-waves spectrum.

  const sBlk = matPanel.addSection(section('Socle'))
  sBlk.body.append(
    toggle({ label: 'Afficher le socle', get: () => params.plinth, set: (v) => { params.plinth = v; ctx.plinth.setVisible(v && ctx.modes.mode === 'surface') } }),
    slider({ label: 'Épaisseur', min: 2, max: 16, step: 0.5, get: () => params.plinthDepth, set: (v) => { params.plinthDepth = v } }),
    color({ label: 'Couleur de la tranche', get: () => params.plinthColor, set: (v) => { params.plinthColor = v; ctx.plinth.setColors(params) } })
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
      segmented({ label: 'Finition', options: [{ value: 'solid', label: 'Solide' }, { value: 'glass', label: 'Verre' }], get: () => params.plinthFinish, set: (v) => { params.plinthFinish = v; ctx.applyPlinthMaterial(); rebuildMat() } }),
      select({ label: glass ? 'Verre' : 'Matériau (PBR)', options: list.map((p) => ({ value: p.id, label: p.name })), get: () => (glass ? params.plinthGlass : params.plinthPbr), set: (v) => {
        if (glass) { params.plinthGlass = v; params.plinthGlassDiffusion = GLASS_BY_ID[v].diffusion } else params.plinthPbr = v
        ctx.applyPlinthMaterial(); rebuildMat()
      } }),
    ]
    if (glass) {
      kids.push(
        slider({ label: 'Diffusion (givre)', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassDiffusion, set: (v) => { params.plinthGlassDiffusion = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Relief', min: 0, max: 2, step: 0.02, get: () => params.plinthGlassBump, set: (v) => { params.plinthGlassBump = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Halo au sol', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassProjection, set: (v) => { params.plinthGlassProjection = v; ctx.applyPlinthMaterial() } })
      )
    } else if (PBR_BY_ID[params.plinthPbr]?.tex) {
      // textured PBR (carbon, wood): exaggerated relief with a live bump slider
      kids.push(
        slider({ label: 'Relief', min: 0, max: 3, step: 0.05, get: () => params.plinthBump, set: (v) => { params.plinthBump = v; ctx.applyPlinthMaterial() } })
      )
    }
    matWrap.replaceChildren(...kids)
  }
  rebuildMat()

  sBlk.body.append(
    toggle({ label: 'Cartouche au sol', get: () => params.groundInfo, set: (v) => { params.groundInfo = v; ctx.setGroundInfo(v) } })
  )
  // Terrain + Socle en TÊTE de Matières (avant Matière du relief / shaders)
  if (ctx.materialsPanel) matPanel.body.prepend(sTer.root, sBlk.root)

  // -------------------------------------------------------------- Effects
  return panel
}
