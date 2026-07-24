// Ex-panneau « Création/Couleurs » — éclaté par la réorg Adrien en trois
// contributions, le fichier garde le code à sa place historique :
//  - buildFondsPanel(ctx)        → panneau « Fonds » (rail gauche, mode Studio)
//  - contributeTerrainSections() → sections Relief & détail / Ombrage / Socle
//                                  montées dans le panneau TERRAIN (ex-Matières)
//  - buildPaletteCreation(ctx,host) → le contenu « Créer une palette » de la
//                                  Bibliothèque (rampe, océans, encre, grille)
// Le générateur aléatoire (palette + look) est RETIRÉ (demande explicite).

import { el, slider, color, swatch, toggle, select, segmented, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'
import { PBR_PRESETS, GLASS_PRESETS, GLASS_BY_ID, PBR_BY_ID } from '../material-presets.js'

const ICON_BG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 15.5 9 10l5 5 3-3 3.5 3.5"/><circle cx="9.5" cy="7.5" r="1.4"/></svg>'

// ------------------------------------------------- Bibliothèque › Nouvelle palette
// Formulaire déplié par la carte « ＋ » — les swatches éditent la carte EN
// DIRECT (pas d'annulation possible sans snapshot) : le bouton de sortie dit
// « Fermer », pas « Annuler ». Un seul accent par panneau (la Boutique) :
// Enregistrer est en encre.
export function buildPaletteCreation(ctx, host, { onClose } = {}) {
  const { params } = ctx
  host.append(el('div', 'ce-label', 'Relief, du bas vers le haut'))
  const ramp = el('div', 'ce-ramp')
  params.rampStops.forEach((stop, i) => {
    ramp.append(
      swatch({
        title: `Teinte ${i + 1}`,
        get: () => stop.c,
        set: (v) => {
          stop.c = v
          ctx.rebuildRamp()
        },
      })
    )
  })
  host.append(ramp)
  host.append(
    color({ label: 'Mer, au rivage', get: () => params.oceanShallow, set: (v) => { params.oceanShallow = v; ctx.terrain.mapUniforms.uOceanShallow.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Mer, au large', get: () => params.oceanMid, set: (v) => { params.oceanMid = v; ctx.terrain.mapUniforms.uOceanMid.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Mer, aux fonds', get: () => params.oceanDeep, set: (v) => { params.oceanDeep = v; ctx.terrain.mapUniforms.uOceanDeep.value.set(v); ctx.globe.rebuildRamp(params) } }),
    color({ label: 'Encre (courbes)', get: () => params.contourColor, set: (v) => { params.contourColor = v; ctx.terrain.mapUniforms.uContourColor.value.set(v); ctx.globe.setInk(v) } }),
    color({ label: 'Grille', get: () => params.gridColor, set: (v) => { params.gridColor = v; ctx.terrain.mapUniforms.uGridColor.value.set(v) } })
  )
  const saveRow = el('div', 'ce-btn-row ce-lib-formrow')
  saveRow.append(
    button('Fermer', () => onClose?.(), { ghost: true }),
    button('Enregistrer', () => { ctx.saveCurrentPalette?.(null); onClose?.() })
  )
  host.append(saveRow)
}

// ------------------------------------------------------------ panneau Fonds
// The scene backdrop behind the block. Changing it moves the fog to the same
// colour, so the relief always fades into its own background.
export function buildFondsPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Fonds',
    icon: ICON_BG,
    side: 'left',
    width: 268,
    tip: 'Le décor derrière le bloc : couleur, dégradé ou ciel (HDRI).',
  })
  const sBg = panel.addSection(section('Fond & ciel'))
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
  return panel
}

// --------------------------------------- panneau Terrain : sections apportées
export function contributeTerrainSections(ctx) {
  const { params } = ctx
  const matPanel = ctx.materialsPanel

  // ------------------------------------------------------------ Ombrage
  const sMap = matPanel.addSection(section('Ombrage'))
  const u = () => ctx.terrain.mapUniforms
  sMap.body.append(
    slider({ label: 'Teinte hypsométrique', min: 0, max: 1, step: 0.02, get: () => params.mapTint, set: (v) => { params.mapTint = v; u().uTint.value = v } }),
    slider({ label: 'Contraste d’altitude', min: 0.5, max: 20, step: 0.1, get: () => params.heightContrast, set: (v) => { params.heightContrast = v; u().uHeightContrast.value = v } }),
    slider({ label: 'Pivot d’altitude', min: 0, max: 1, step: 0.01, get: () => params.heightPivot, set: (v) => { params.heightPivot = v; u().uHeightPivot.value = v } }),
    slider({ label: 'Ombrage des pentes', min: 0, max: 1, step: 0.02, get: () => params.slopeTint, set: (v) => { params.slopeTint = v; u().uSlopeTint.value = v } })
  )

  // ------------------------------------------------------ Relief & détail
  const sTer = matPanel.addSection(section('Relief & détail'))
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

  // --------------------------------------------------------------- Socle
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

  // ordre de lecture du panneau Terrain : Relief & détail, Ombrage, Socle
  // EN TÊTE (avant Matière du relief / Effets de surface)
  matPanel.body.prepend(sTer.root, sMap.root, sBlk.root)
}
