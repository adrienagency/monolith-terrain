// Ex-panneau « Création/Couleurs » — éclaté par la réorg Adrien en trois
// contributions, le fichier garde le code à sa place historique :
//  - buildFondsPanel(ctx)        → panneau « Fonds » (rail gauche, mode Studio)
//  - contributeTerrainSections() → sections Relief & détail / Ombrage / Socle
//                                  montées dans le panneau TERRAIN (ex-Matières)
//  - buildPaletteCreation(ctx,host) → le contenu « Créer une palette » de la
//                                  Bibliothèque (rampe, océans, encre, grille)
// Le générateur aléatoire (palette + look) est RETIRÉ (demande explicite).

import { el, slider, color, swatch, toggle, select, segmented, button, section, refreshAll, onRefresh } from './kit.js'
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
// Terrain v2 (validé Adrien) : Relief en tête avec PRESETS d'exagération en
// chips (le réglage star traité en star), la mécanique (zoom/maillage/détail)
// reléguée au fond dans « Qualité » avec ses presets Rapide/Équilibré/Fin, le
// Socle en GRILLE DE VIGNETTES (50 matériaux exposés, plus de menu déroulant),
// et des sections repliées QUI PARLENT (setMeta — état courant dans l'en-tête).
const EXAG_PRESETS = [
  { v: 1, label: '×1 Réel' },
  { v: 2, label: '×2 Carte' },
  { v: 4, label: '×4 Relief' },
  { v: 8, label: '×8 Drame' },
]
const QUALITY_PRESETS = [
  { id: 'rapide', label: 'Rapide', resolution: 384, detail: 0.15, detailScale: 2 },
  { id: 'equilibre', label: 'Équilibré', resolution: 768, detail: 0.35, detailScale: 2.5 },
  { id: 'fin', label: 'Fin', resolution: 1024, detail: 0.55, detailScale: 3 },
]

// vignette procédurale d'un matériau de socle — dégradé éclairé depuis sa
// couleur ; les métaux polis gagnent une bande de reflet, les verres une clarté
function presetSwatch(p, glass) {
  if (glass) return `linear-gradient(135deg, color-mix(in srgb, ${p.color} 25%, white), color-mix(in srgb, ${p.color} 65%, white) 40%, ${p.color})`
  const base = `linear-gradient(135deg, color-mix(in srgb, ${p.color} 55%, white), ${p.color} 45%, color-mix(in srgb, ${p.color} 68%, black))`
  return p.metalness >= 0.5 && p.roughness < 0.5
    ? `linear-gradient(115deg, transparent 38%, rgba(255,255,255,.45) 46%, transparent 55%), ${base}`
    : base
}

export function contributeTerrainSections(ctx) {
  const { params } = ctx
  const matPanel = ctx.materialsPanel

  // ------------------------------------------------------------- Relief
  // le réglage STAR : presets en un clic + curseur fin + Isoler la zone
  const sRel = matPanel.addSection(section('Relief'))
  const chipRow = el('div', 'ce-chiprow')
  const commitExag = () => {
    ctx.saveZoomExag(params.demZoom, params.demExaggeration)
    if (params.source === 'real') ctx.regenerateTerrain()
    refreshAll()
  }
  const chips = EXAG_PRESETS.map((p) => {
    const b = el('button', 'ce-chip', p.label)
    b.type = 'button'
    b.addEventListener('click', () => {
      params.demExaggeration = p.v
      commitExag()
    })
    chipRow.append(b)
    return b
  })
  onRefresh(() => {
    for (let i = 0; i < chips.length; i++) chips[i].classList.toggle('on', Math.abs(params.demExaggeration - EXAG_PRESETS[i].v) < 0.03)
  }, chipRow)
  const exag = slider({
    label: 'Échelle fine',
    min: 0.5,
    max: 40,
    step: 0.05,
    get: () => params.demExaggeration,
    set: (v) => { params.demExaggeration = v },
  })
  // regenerate only on release: change commits + saves for this zoom
  exag.querySelector('input').addEventListener('change', commitExag)
  const isolate = toggle({
    label: 'Isoler la zone',
    get: () => params.regionMode ?? false,
    set: (v) => {
      params.regionMode = v
      ctx.setRegionMode(v)
    },
  })
  isolate.setAttribute('data-tip', 'Découpe la carte au pays ou à la région sous la vue — sans base carrée.')
  const zoomResetRow = el('div', 'ce-btn-row')
  zoomResetRow.append(button('Réinitialiser l’échelle de ce zoom', () => { ctx.resetZoomExag(); refreshAll() }, { ghost: true }))
  sRel.body.append(chipRow, exag, isolate, zoomResetRow)
  onRefresh(() => sRel.setMeta(`×${(+params.demExaggeration).toFixed(params.demExaggeration % 1 ? 1 : 0)}${params.regionMode ? ' · zone isolée' : ''}`), sRel.head)

  // ------------------------------------------------------------ Ombrage
  const sMap = matPanel.addSection(section('Ombrage'))
  const u = () => ctx.terrain.mapUniforms
  sMap.body.append(
    slider({ label: 'Teinte hypsométrique', min: 0, max: 1, step: 0.02, get: () => params.mapTint, set: (v) => { params.mapTint = v; u().uTint.value = v } }),
    slider({ label: 'Contraste d’altitude', min: 0.5, max: 20, step: 0.1, get: () => params.heightContrast, set: (v) => { params.heightContrast = v; u().uHeightContrast.value = v } }),
    slider({ label: 'Pivot d’altitude', min: 0, max: 1, step: 0.01, get: () => params.heightPivot, set: (v) => { params.heightPivot = v; u().uHeightPivot.value = v } }),
    slider({ label: 'Ombrage des pentes', min: 0, max: 1, step: 0.02, get: () => params.slopeTint, set: (v) => { params.slopeTint = v; u().uSlopeTint.value = v } })
  )
  onRefresh(() => sMap.setMeta(`contraste ×${(+params.heightContrast).toFixed(1)}`), sMap.head)

  // --------------------------------------------------------------- Socle
  const sBlk = matPanel.addSection(section('Socle'))
  sBlk.body.append(
    // le toggle recale AUSSI le cartouche (textes au pied du relief) et les
    // gravures murales (elles disparaissent sans socle) — ctx.onPlinthToggled
    toggle({ label: 'Afficher le socle', get: () => params.plinth, set: (v) => { params.plinth = v; ctx.plinth.setVisible(v && ctx.modes.mode === 'surface'); ctx.onPlinthToggled?.() } }),
    // (tirette Épaisseur retirée — « ne sert à rien », Adrien)
    color({ label: 'Couleur de la tranche', get: () => params.plinthColor, set: (v) => { params.plinthColor = v; ctx.plinth.setColors(params) } })
  )

  // le catalogue EXPOSÉ : 25 solides + 25 verres en grille de vignettes (même
  // langage que Matière du relief) — le menu déroulant cachait la marchandise
  const matPick = el('div', 'ce-mat-pick')
  const matKnobs = el('div', 'ce-fx-controls')
  sBlk.body.append(matPick, matKnobs)
  function renderPlinthPicker() {
    matPick.replaceChildren()
    const glass = params.plinthFinish === 'glass'
    const curId = glass ? params.plinthGlass : params.plinthPbr
    const group = (title, list, isGlass) => {
      matPick.append(el('div', 'ce-mat-cat', title))
      const grid = el('div', 'ce-mat-grid')
      for (const p of list) {
        const b = el('button', `ce-mat-vig${(isGlass === glass && p.id === curId) ? ' on' : ''}`)
        b.type = 'button'
        b.setAttribute('data-tip', p.name)
        const media = el('span', 'ce-mat-vig-img')
        media.style.background = presetSwatch(p, isGlass)
        b.append(media, el('span', 'ce-mat-vig-name', p.name))
        b.addEventListener('click', () => {
          params.plinthFinish = isGlass ? 'glass' : 'solid'
          if (isGlass) { params.plinthGlass = p.id; params.plinthGlassDiffusion = GLASS_BY_ID[p.id].diffusion } else params.plinthPbr = p.id
          ctx.applyPlinthMaterial()
          renderPlinthPicker()
          renderPlinthKnobs()
          refreshAll()
        })
        grid.append(b)
      }
      matPick.append(grid)
    }
    group('Solides', PBR_PRESETS, false)
    group('Verres', GLASS_PRESETS, true)
  }
  function renderPlinthKnobs() {
    matKnobs.replaceChildren()
    if (params.plinthFinish === 'glass') {
      matKnobs.append(
        slider({ label: 'Déformation', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassRefract ?? 0.25, set: (v) => { params.plinthGlassRefract = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Diffusion (givre)', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassDiffusion, set: (v) => { params.plinthGlassDiffusion = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Relief', min: 0, max: 2, step: 0.02, get: () => params.plinthGlassBump, set: (v) => { params.plinthGlassBump = v; ctx.applyPlinthMaterial() } }),
        slider({ label: 'Halo au sol', min: 0, max: 1, step: 0.01, get: () => params.plinthGlassProjection, set: (v) => { params.plinthGlassProjection = v; ctx.applyPlinthMaterial() } })
      )
    } else if (PBR_BY_ID[params.plinthPbr]?.tex) {
      // textured PBR (carbon, wood): exaggerated relief with a live bump slider
      matKnobs.append(
        slider({ label: 'Relief', min: 0, max: 3, step: 0.05, get: () => params.plinthBump, set: (v) => { params.plinthBump = v; ctx.applyPlinthMaterial() } })
      )
    }
  }
  renderPlinthPicker()
  renderPlinthKnobs()
  // un template/reset peut changer le matériau sous nos pieds — meta ET
  // picker resynchronisés (re-render seulement quand la sélection change)
  let lastPlinthKey = ''
  onRefresh(() => {
    const glass = params.plinthFinish === 'glass'
    const cur = glass ? GLASS_BY_ID[params.plinthGlass] : PBR_BY_ID[params.plinthPbr]
    sBlk.setMeta(params.plinth ? (cur?.name ?? '') : 'Masqué', params.plinth && cur ? presetSwatch(cur, glass) : null)
    const key = `${params.plinthFinish}/${glass ? params.plinthGlass : params.plinthPbr}`
    if (key !== lastPlinthKey) {
      lastPlinthKey = key
      renderPlinthPicker()
      renderPlinthKnobs()
    }
  }, sBlk.head)

  sBlk.body.append(
    toggle({ label: 'Cartouche au sol', get: () => params.groundInfo, set: (v) => { params.groundInfo = v; ctx.setGroundInfo(v) } })
  )

  // ------------------------------------------------------------- Qualité
  // la mécanique, AU FOND : un preset règle maillage + détail d'un coup
  // (pattern qualité des jeux vidéo) ; les curseurs experts restent dessous.
  // « Détail (zoom) » change la ZONE de données — jamais touché par les presets.
  const sQual = matPanel.addSection(section('Qualité'))
  const qualityOf = () => {
    const q = QUALITY_PRESETS.find((q) => q.resolution === params.resolution && Math.abs(q.detail - params.detail) < 0.01 && Math.abs(q.detailScale - params.detailScale) < 0.05)
    return q ? q.id : 'perso'
  }
  sQual.body.append(
    segmented({
      options: [...QUALITY_PRESETS.map((q) => ({ value: q.id, label: q.label })), { value: 'perso', label: 'Perso' }],
      get: qualityOf,
      set: (v) => {
        const q = QUALITY_PRESETS.find((q) => q.id === v)
        if (!q) return // « Perso » n'est pas un état qu'on choisit, c'est un constat
        params.resolution = q.resolution
        params.detail = q.detail
        params.detailScale = q.detailScale
        ctx.saveZoomDetail?.(params.demZoom, q.detail)
        ctx.regenerateTerrain()
        refreshAll()
      },
    })
  )
  const zoomSel = select({ label: 'Détail (zoom)', options: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], get: () => String(params.demZoom), set: (v) => { params.demZoom = +v; ctx.onZoomPicked(+v); rebuildRes() } })
  const fineDetail = slider({ label: 'Détail fin', min: 0, max: 0.8, step: 0.01, get: () => params.detail, set: (v) => { params.detail = v; ctx.saveZoomDetail?.(params.demZoom, v) } })
  const detailScale = slider({ label: 'Échelle du détail', min: 0.5, max: 6, step: 0.1, get: () => params.detailScale, set: (v) => { params.detailScale = v } })
  sQual.body.append(zoomSel, fineDetail, detailScale)
  // Mesh resolution — 2048 offert à tous les zooms (demande explicite), avec
  // l'avertissement de coût ; plafond dur.
  const resWrap = el('div')
  sQual.body.append(resWrap)
  function rebuildRes() {
    if (params.resolution > 2048) params.resolution = 2048 // hard ceiling
    const opts = ['256', '384', '512', '768', '1024', '2048']
    resWrap.replaceChildren(
      select({ label: 'Résolution du maillage', options: opts, get: () => String(params.resolution), set: (v) => { params.resolution = +v; ctx.regenerateTerrain(); refreshAll() } })
    )
    if (params.resolution >= 2048) resWrap.append(el('div', 'ce-note ce-warn', '⚠ 2048 est très lourd — l’onglet peut fortement ralentir.'))
  }
  rebuildRes()
  // les curseurs de détail régénèrent au relâchement
  for (const row of [fineDetail, detailScale]) row.querySelector('input').addEventListener('change', () => { ctx.regenerateTerrain(); refreshAll() })
  onRefresh(() => {
    const q = QUALITY_PRESETS.find((q) => q.id === qualityOf())
    sQual.setMeta(q ? q.label : `Perso · ${params.resolution}`)
  }, sQual.head)

  // ordre de lecture du panneau Terrain : Relief, Ombrage EN TÊTE (avant
  // Matière du relief / Effets de surface), puis Socle et Qualité AU FOND
  matPanel.body.prepend(sRel.root, sMap.root)
  matPanel.body.append(sBlk.root, sQual.root)
}
