// CAMERA panel — viewpoint, focus, cinematic automation and performance.
// Ne vit PLUS dans le dock de gauche (demande d'Adrien) : il est monté dans un
// menu de la barre du haut, entre le thème et l'œil barré, avec la même UX que
// le menu « Aide ». D'où dock:false — bars.js s'occupe de l'accrocher.

import { el, slider, toggle, select, button, section, visibleWhen, refreshAll, onRefresh } from './kit.js'
import { Panel } from './shell.js'
import { applyRenderSize } from '../viewport.js'

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
    dock: false,
    cls: 'ce-panel-inmenu',
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
    // Même règle que le gouverneur (perf.js) : la taille de rendu se lit sur le
    // CONTENEUR du canevas, jamais sur la fenêtre — en boutique / Studio, `#app`
    // n'est qu'un cadre. L'ancien appel, qui passait la largeur de la fenêtre
    // au compositeur, poussait le canevas hors de ce cadre (image écrasée
    // puis rognée par l'`overflow: hidden` du cadre) et, en
    // prime, sautait l'arrondi pair qui évite le carré noir. Voir viewport.js.
    // ⚠️ La densité VOULUE se PASSE à applyRenderSize, on ne la pose plus
    // soi-même : c'est là qu'elle est bornée à ce que la carte graphique
    // accepte. Sans ce passage, un curseur à 2 sur un vieux portable fait
    // franchir MAX_TEXTURE_SIZE au tampon de dessin, et Chrome le rabote UNE
    // DIMENSION À LA FOIS, sans un mot — image écrasée. params garde le
    // SOUHAIT (ce que montre le curseur), applyRenderSize sert le RÉEL : on
    // n'écrit rien en retour, sinon la valeur ne remonterait jamais quand la
    // fenêtre rétrécit.
    slider({ label: 'Échelle de rendu', min: 0.5, max: 2, step: 0.05, get: () => params.pixelRatio, set: (v) => { params.pixelRatio = v; applyRenderSize({ renderer: ctx.renderer, composer: ctx.composer, camera: ctx.camera, pixelRatio: v }) } }),
    select({ label: 'Ombres', options: ['dynamic', 'static', 'off'], get: () => params.shadowMode, set: (v) => { params.shadowMode = v; ctx.applyShadowMode() } }),
    select({ label: 'Résolution des ombres', options: ['1024', '2048', '4096'], get: () => String(params.shadowRes), set: (v) => { params.shadowRes = +v; ctx.setShadowRes(+v) } })
  )
  if (ctx.fenetreEtat) s.body.append(fenetreContinueRow(ctx))
  return s
}

// ══════════ LE MODE CONTINU 3×3 — UN INTERRUPTEUR QUI PEUT DIRE NON ═════════
//
// Adrien : « le toggle doit être HONNÊTE — il doit pouvoir se refuser sur
// machine faible ET LE DIRE, plutôt que de s'activer et ramer. Un interrupteur
// qui s'allume sur une machine qui ne suit pas est pire qu'un interrupteur
// absent. »
//
// D'où trois états et pas deux (`etatInterrupteur`, fenetre-reglage.js) : allumé,
// éteint, et EMPÊCHÉ — ce dernier grise le bouton et écrit la raison dessous.
// La raison est chiffrée (« ce palier ne porte que 4 dalles voisines, un 3×3 en
// demande 8 ») parce qu'un refus sans chiffre se lit comme un caprice.
//
// ⚠️ `disabled` sur un vrai `<button>` et pas une classe : le navigateur cesse
// alors d'émettre le `click`, donc le `set` du toggle ne peut pas partir même
// si quelqu'un ajoute plus tard un raccourci clavier ou un clic scripté. Un
// garde-fou visuel n'est pas un garde-fou.
function fenetreContinueRow(ctx) {
  const wrap = el('div')
  const row = toggle({
    label: 'Mode continu 3×3 (glisser le terrain)',
    get: () => ctx.fenetreEtat().coche,
    // Le `set` reçoit la valeur souhaitée ; c'est main.js qui recalcule le
    // verdict (la machine peut encore dire non) et recharge la zone.
    set: (v) => { ctx.setFenetre?.(v); refreshAll() },
  })
  const btn = row.querySelector('.ce-toggle')
  const note = el('div', 'ce-note')
  wrap.append(row, note)
  onRefresh(() => {
    const e = ctx.fenetreEtat()
    if (btn) {
      btn.disabled = e.bloque
      btn.style.opacity = e.bloque ? '0.4' : ''
      btn.style.cursor = e.bloque ? 'not-allowed' : ''
      btn.classList.toggle('on', e.coche)
    }
    note.textContent = e.note
    note.style.display = e.note ? '' : 'none'
  }, wrap)
  return wrap
}
