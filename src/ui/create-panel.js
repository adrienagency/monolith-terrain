// Ex-panneau « Création/Couleurs » — éclaté par la réorg Adrien en trois
// contributions, le fichier garde le code à sa place historique :
//  - buildFondsPanel(ctx)        → panneau « Fonds » (rail gauche, mode Studio)
//  - contributeTerrainSections() → sections Relief & détail / Ombrage / Socle
//                                  montées dans le panneau TERRAIN (ex-Matières)
//  - buildPaletteCreation(ctx,host) → le contenu « Créer une palette » de la
//                                  Bibliothèque (rampe, océans, encre, grille)
// Le générateur aléatoire (palette + look) est RETIRÉ (demande explicite).

import Grapick from 'grapick'
import 'grapick/dist/grapick.min.css'
import { el, slider, color, swatch, toggle, select, segmented, button, section, refreshAll, onRefresh } from './kit.js'
import { Panel } from './shell.js'
import { PBR_PRESETS, GLASS_PRESETS, GLASS_BY_ID, PBR_BY_ID } from '../material-presets.js'
import { stopsToCss, pointsToCss, pointsBase, flipStops, normalizeBgStops, normalizeBgPoints, MAX_STOPS, MAX_POINTS } from '../background.js'

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
// Fonds v2 — deux sections d'égale dignité : « Fond » (uni / dégradés, avec de
// VRAIS éditeurs : barre de stops grapick façon Figma + plan de points façon
// Illustrator) et « Ciel (HDRI) ». Mêmes vignettes .ce-mat-grid partout ; le
// conflit ciel↔fond est rendu explicite (le ciel estompe la section Fond).
const rgbaToHex = (c) => {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c
  const m = String(c).match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  return m ? '#' + [1, 2, 3].map((i) => (+m[i]).toString(16).padStart(2, '0')).join('') : '#888888'
}
const mixHex = (a, b) => '#' + [1, 3, 5].map((i) =>
  Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('')

const BG_TYPES = [
  { v: 'solid', label: 'Uni', full: 'Fond uni' },
  { v: 'linear', label: 'Linéaire', full: 'Dégradé linéaire' },
  { v: 'radial', label: 'Radial', full: 'Dégradé radial' },
  { v: 'mesh', label: 'Points', full: 'Dégradé de points' },
]

export function buildFondsPanel(ctx) {
  const { params } = ctx
  const panel = new Panel({
    title: 'Fonds',
    icon: ICON_BG,
    side: 'left',
    width: 268,
    tip: 'Le décor derrière le bloc : couleur, dégradés ou ciel (HDRI).',
  })
  const modeOf = () => params.bgMode || 'solid'
  const typeMeta = () => BG_TYPES.find((t) => t.v === modeOf()) || BG_TYPES[0]
  // aperçu CSS du fond courant pour un type donné — vignettes VIVANTES : elles
  // suivent les couleurs pendant l'édition
  const previewFor = (v, node) => {
    node.style.backgroundImage = ''
    if (v === 'solid') { node.style.background = params.bgColorA; return }
    if (v === 'mesh') {
      const pts = normalizeBgPoints(params)
      node.style.backgroundColor = pointsBase(pts)
      node.style.backgroundImage = pointsToCss(pts)
      return
    }
    node.style.background = stopsToCss(normalizeBgStops(params), v, params.bgAngle)
  }

  // ------------------------------------------------------------ section Fond
  const sFond = panel.addSection(section('Fond'))
  const skyNote = el('div', 'ce-bg-note', 'Le ciel remplace le fond — choisir « Aucun » dans Ciel pour le retrouver.')
  // « Couleurs auto » est un TOGGLE en tête (Adrien) : ON = le fond et la
  // couleur du socle suivent la palette de la carte ; une édition manuelle du
  // fond le coupe (manualEdit) pour ne pas se faire écraser au prochain
  // changement de palette
  const autoTgl = toggle({
    label: 'Couleurs auto depuis la carte',
    get: () => params.bgAuto !== false,
    set: (v) => { params.bgAuto = v; if (v) { ctx.autoBgColours(); renderAll() } },
  })
  const typeWrap = el('div', 'ce-mat-pick')
  const editWrap = el('div')
  sFond.body.append(autoTgl, skyNote, typeWrap, editWrap)
  // une retouche manuelle du fond coupe le suivi auto et re-vérifie le
  // contraste (fond sombre → dark mode automatique, textes du socle lisibles)
  const manualEdit = () => {
    if (params.bgAuto !== false) { params.bgAuto = false; refreshAll() }
    ctx.autoDarkFromBg?.()
  }

  function renderTypes() {
    typeWrap.replaceChildren()
    const grid = el('div', 'ce-mat-grid')
    for (const t of BG_TYPES) {
      const b = el('button', `ce-mat-vig${modeOf() === t.v ? ' on' : ''}`)
      b.type = 'button'
      b.setAttribute('data-tip', t.full)
      const media = el('span', 'ce-mat-vig-img')
      previewFor(t.v, media)
      b.append(media, el('span', 'ce-mat-vig-name', t.label))
      b.addEventListener('click', () => {
        if (modeOf() === t.v) return
        const wasSolid = modeOf() === 'solid'
        params.bgMode = t.v
        // première activation d'un dégradé : dérive des couleurs harmonieuses
        // de la palette ; des stops déjà personnalisés sont CONSERVÉS
        if (t.v !== 'solid' && wasSolid && !params.bgStops) ctx.autoBgColours()
        else ctx.applyBackground()
        ctx.autoDarkFromBg?.() // le nouveau type peut changer la luminance
        renderAll()
      })
      grid.append(b)
    }
    typeWrap.append(grid)
  }

  // -------------------------------------------------- éditeur : barre de stops
  // (grapick, MIT — la barre cliquable façon Figma : glisser un stop le
  // déplace, cliquer la barre en ajoute un, la croix au-dessus le retire)
  function buildStopsEditor(host, mode) {
    params.bgStops = normalizeBgStops(params)
    const bar = el('div', 'ce-grad-bar')
    host.append(bar)
    const gp = new Grapick({ el: bar, direction: 'right', height: '22px', emptyColor: '#9aa4b0' })
    let mute = true
    for (const s of params.bgStops) gp.addHandler(s.p, s.c)
    mute = false
    const readStops = () => gp.getHandlers()
      .map((h) => ({ p: Math.round(h.position), c: rgbaToHex(h.getColor()) }))
      .sort((a, b) => a.p - b.p)
    let raf = 0
    const applyLive = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; ctx.applyBackground(); renderTypes() }) }
    gp.on('change', () => {
      if (mute) return
      const st = readStops()
      if (st.length >= 2) params.bgStops = st
      applyLive()
      manualEdit()
      renderList()
      refreshAll()
    })
    // liste des stops (position % / couleur / retirer) + « ＋ » d'ajout
    const head = el('div', 'ce-grad-head')
    head.append(el('span', 'ce-fx-head', 'Stops'))
    const add = el('button', 'ce-grad-add', '＋')
    add.type = 'button'
    add.title = 'Ajouter un stop (au milieu du plus grand écart)'
    add.addEventListener('click', () => {
      const st = params.bgStops
      if (st.length >= MAX_STOPS) return
      let gi = 0, g = -1
      for (let i = 0; i < st.length - 1; i++) { const d = st[i + 1].p - st[i].p; if (d > g) { g = d; gi = i } }
      gp.addHandler(Math.round((st[gi].p + st[gi + 1].p) / 2), mixHex(st[gi].c, st[gi + 1].c))
    })
    head.append(add)
    const list = el('div', 'ce-grad-stops')
    host.append(head, list)
    function renderList() {
      list.replaceChildren()
      const handlers = [...gp.getHandlers()].sort((a, b) => a.position - b.position)
      for (const h of handlers) {
        const row = el('div', 'ce-grad-stoprow')
        const pos = el('input', 'ce-grad-pos')
        pos.type = 'number'; pos.min = 0; pos.max = 100; pos.value = Math.round(h.position)
        pos.addEventListener('change', () => h.setPosition(Math.max(0, Math.min(100, +pos.value || 0))))
        const sw = swatch({ title: 'Couleur du stop', get: () => rgbaToHex(h.getColor()), set: (v) => h.setColor(v) })
        const del = el('button', 'ce-grad-del', '—')
        del.type = 'button'
        del.title = 'Retirer ce stop'
        del.disabled = handlers.length <= 2
        del.addEventListener('click', () => h.remove())
        row.append(pos, el('span', 'ce-grad-pct', '%'), sw, del)
        list.append(row)
      }
      add.disabled = handlers.length >= MAX_STOPS
    }
    renderList()
    if (mode === 'linear') {
      host.append(slider({ label: 'Angle', min: 0, max: 360, step: 1, get: () => params.bgAngle, set: (v) => { params.bgAngle = v; ctx.applyBackground(); renderTypes() } }))
    }
    const r = el('div', 'ce-btn-row')
    r.append(button('⇆ Inverser', () => { params.bgStops = flipStops(params.bgStops); ctx.applyBackground(); manualEdit(); renderAll() }, { ghost: true }))
    host.append(r)
  }

  // ----------------------------------------- éditeur : plan de points (morph)
  // façon dégradé de forme libre d'Illustrator : des points colorés qu'on
  // déplace sur un plan, chacun diffuse sa couleur en halo doux
  function buildPointsEditor(host) {
    const pts = (params.bgPoints = normalizeBgPoints(params))
    let sel = 0
    const plane = el('div', 'ce-pts-plane')
    const knobs = el('div')
    host.append(plane, el('div', 'ce-bg-note on', 'Glisser un point le déplace — cliquer le plan en ajoute un.'), knobs)
    // applyBackground re-normalise params.bgPoints en COPIES — `pts` reste la
    // source de vérité de l'éditeur, donc on le réaffirme avant chaque
    // application (sinon drag/retrait mutent un tableau orphelin)
    const applyNow = () => { params.bgPoints = pts; ctx.applyBackground(); manualEdit() }
    let raf = 0
    const applyLive = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; applyNow(); renderTypes() }) }
    const paint = () => {
      plane.style.backgroundColor = pointsBase(pts)
      plane.style.backgroundImage = pointsToCss(pts)
    }
    function renderHandles() {
      ;[...plane.querySelectorAll('.ce-pts-dot')].forEach((n) => n.remove())
      pts.forEach((p, i) => {
        const d = el('button', `ce-pts-dot${i === sel ? ' on' : ''}`)
        d.type = 'button'
        d.style.left = p.x * 100 + '%'
        d.style.top = p.y * 100 + '%'
        d.style.background = p.c
        d.addEventListener('pointerdown', (e) => {
          e.preventDefault()
          if (sel !== i) { sel = i; renderHandles(); renderKnobs() }
          try { d.setPointerCapture(e.pointerId) } catch {}
          const move = (ev) => {
            const r = plane.getBoundingClientRect()
            p.x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width))
            p.y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))
            d.style.left = p.x * 100 + '%'
            d.style.top = p.y * 100 + '%'
            paint()
            applyLive()
          }
          const up = () => {
            d.removeEventListener('pointermove', move)
            d.removeEventListener('pointerup', up)
            applyNow()
            renderTypes()
            refreshAll()
          }
          d.addEventListener('pointermove', move)
          d.addEventListener('pointerup', up)
        })
        plane.append(d)
      })
    }
    plane.addEventListener('click', (e) => {
      if (e.target !== plane || pts.length >= MAX_POINTS) return
      const r = plane.getBoundingClientRect()
      pts.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r: 0.5, c: pointsBase(pts) })
      sel = pts.length - 1
      paint(); renderHandles(); renderKnobs(); applyNow(); renderTypes(); refreshAll()
    })
    function renderKnobs() {
      knobs.replaceChildren()
      const p = pts[sel]
      if (!p) return
      knobs.append(
        color({ label: 'Couleur du point', get: () => p.c, set: (v) => { p.c = v; paint(); renderHandles(); applyLive() } }),
        slider({ label: 'Rayon', min: 0.05, max: 1, step: 0.01, get: () => p.r, set: (v) => { p.r = v; paint(); applyLive() } })
      )
      if (pts.length > 1) {
        const r = el('div', 'ce-btn-row')
        r.append(button('Retirer ce point', () => {
          pts.splice(sel, 1)
          sel = Math.max(0, sel - 1)
          paint(); renderHandles(); renderKnobs(); applyNow(); renderTypes(); refreshAll()
        }, { ghost: true }))
        knobs.append(r)
      }
    }
    paint(); renderHandles(); renderKnobs()
  }

  function renderEditor() {
    editWrap.replaceChildren()
    const m = modeOf()
    if (m === 'solid') {
      editWrap.append(color({ label: 'Couleur', get: () => params.bgColorA, set: (v) => { params.bgColorA = v; ctx.applyBackground(); manualEdit(); renderTypes() } }))
    } else if (m === 'mesh') {
      buildPointsEditor(editWrap)
    } else {
      buildStopsEditor(editWrap, m)
    }
  }

  // ------------------------------------------------------ section Ciel (HDRI)
  const sCiel = panel.addSection(section('Ciel (HDRI)'))
  const envPick = el('div', 'ce-mat-pick')
  sCiel.body.append(envPick)
  function renderEnvPicker() {
    envPick.replaceChildren()
    const cur = ctx.getBgEnv()
    const grid = el('div', 'ce-mat-grid')
    const tile = (id, label, media) => {
      const b = el('button', `ce-mat-vig${cur === id ? ' on' : ''}`)
      b.type = 'button'
      b.setAttribute('data-tip', label)
      b.append(media, el('span', 'ce-mat-vig-name', label))
      b.addEventListener('click', () => { ctx.setBgEnv(id); ctx.autoDarkFromBg?.(); renderAll() })
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

  // le ciel actif ESTOMPE la section Fond (le HDRI remplace le décor) — l'état
  // est dit, pas subi
  function syncSky() {
    const sky = !!ctx.getBgEnv()
    for (const n of [autoTgl, typeWrap, editWrap]) n.classList.toggle('ce-dim', sky)
    skyNote.classList.toggle('on', sky)
  }
  function renderAll() {
    renderTypes()
    renderEditor()
    renderEnvPicker()
    syncSky()
    refreshAll()
  }
  renderTypes(); renderEditor(); renderEnvPicker(); syncSky()
  ctx.registerBgRefresh?.(renderAll) // template/reset/shuffle → tout resynchroniser

  // metas parlantes — la pastille du Fond montre le VRAI dégradé courant
  onRefresh(() => {
    const sky = !!ctx.getBgEnv()
    if (sky) { sFond.setMeta('remplacé par le ciel'); return }
    const m = modeOf()
    const sw = m === 'solid' ? params.bgColorA
      : m === 'mesh' ? `${pointsToCss(normalizeBgPoints(params))} ${pointsBase(normalizeBgPoints(params))}`
      : stopsToCss(normalizeBgStops(params), m, params.bgAngle)
    sFond.setMeta(typeMeta().full, sw)
  }, sFond.root)
  onRefresh(() => {
    const e = ctx.environments.find((x) => x.id === ctx.getBgEnv())
    sCiel.setMeta(e ? e.label : 'Aucun')
  }, sCiel.root)

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
  // Les 4 réglages sont DÉRIVÉS du relief chargé (src/relief-grade.js) : une
  // carte des Alpes et un delta plat ne peuvent pas partager le même contraste
  // ni le même pivot. Toucher un curseur FIGE ce réglage-là (les trois autres
  // continuent de suivre le relief) ; le toggle en tête rend la main à l'auto.
  const sMap = matPanel.addSection(section('Ombrage'))
  const u = () => ctx.terrain.mapUniforms
  // un curseur d'Ombrage : pousse l'uniforme ET signale la reprise en main
  const shadeSlider = (label, key, uni, min, max, step) =>
    slider({
      label, min, max, step,
      get: () => params[key],
      set: (v) => { params[key] = v; u()[uni].value = v; ctx.markShadeDirty?.(key) },
    })
  const autoToggle = toggle({
    label: 'Ombrage auto',
    get: () => params.shadeAuto !== false,
    set: (v) => { params.shadeAuto = v; ctx.setShadeAuto?.(v); refreshAll() },
  })
  autoToggle.setAttribute('data-tip', 'Calcule les réglages d’après l’altitude réelle de la carte affichée. Bouger un curseur le fige ; rallumer rend la main.')
  sMap.body.append(
    autoToggle,
    shadeSlider('Teinte hypsométrique', 'mapTint', 'uTint', 0, 1, 0.02),
    shadeSlider('Contraste d’altitude', 'heightContrast', 'uHeightContrast', 0.5, 20, 0.1),
    shadeSlider('Pivot d’altitude', 'heightPivot', 'uHeightPivot', 0, 1, 0.01),
    shadeSlider('Ombrage des pentes', 'slopeTint', 'uSlopeTint', 0, 1, 0.02)
  )
  // meta parlante (section repliée) : l'état de l'auto d'abord, le contraste
  // ensuite — « auto » / « auto · 2 repris » / « manuel »
  onRefresh(() => {
    const frozen = ctx.shadeFrozenCount?.() ?? 0
    const state = params.shadeAuto === false ? 'manuel' : frozen ? `auto · ${frozen} repris` : 'auto'
    sMap.setMeta(`${state} · ×${(+params.heightContrast).toFixed(1)}`)
  }, sMap.head)

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
