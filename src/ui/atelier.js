// L'espace « Studio » (UX P2, Adrien) — nom interne « atelier » pour éviter la
// collision avec studio.js (le Race Studio). C'est l'assistant du MODE SIMPLE :
// ① Template ② Palette ③ Ciel ④ Calques ⑤ Météo, colonne de travail à GAUCHE,
// carte vivante à DROITE. Même grammaire que le Race Studio (rail d'étapes,
// barre basse, morph partagé panel-morph.js) — délibérément indistinguable.
//
// TROIS DÉCISIONS D'UX, parce qu'elles ne se lisent pas dans le code :
//
// 1. L'étape ① ne PRÉCÈDE pas les autres, elle les PRÉ-REMPLIT. Un template
//    porte le look complet (TEMPLATE_KEYS) : palette, ciel, calques, météo. Si
//    les étapes suivantes s'ouvraient sur un écran neutre, l'utilisateur
//    croirait avoir perdu son choix. Chaque étape aval s'ouvre donc sur une
//    bande « posé par le template », et se lit AFFINER, jamais recommencer.
//    Quand on s'écarte du template, la bande le dit et offre le retour.
//
// 2. Le chemin est NON BLOQUANT (Adrien). Aucune étape n'est un préalable
//    technique — palette, ciel, calques et météo sont indépendants et visibles
//    à l'instant. Le rail saute où il veut, « Terminer » est là dès la
//    première étape. « Suivant » n'est qu'une invitation pour qui découvre.
//
// 3. Le SNAPSHOT (nouveau) est ce qui donne un sens au bouton de validation.
//    Sans lui, « Quitter » et « Terminer » faisaient la même chose — c'est
//    pour ça qu'il n'y avait pas de bouton de validation. Maintenant :
//    Annuler REPOSE le look d'entrée, Terminer le GARDE. Échap garde aussi :
//    une touche réflexe ne doit pas détruire un quart d'heure d'habillage.
import './atelier.css'
import { makeMorph } from './panel-morph.js'
import { CLOUD_PRESETS, CLOUD_TIPS, cloudPresetOf, SEA_PRESETS, SEA_TIPS, seaPresetOf } from './effects-panel.js'
import {
  ATELIER_STEPS,
  LAYERS,
  clampStep,
  changedKeys,
  stepSummary,
} from './atelier-steps.js'

const CATALOG_URL = '/templates/data.json'
// Templates PAR DÉFAUT = de vrais fichiers .shibumap-template (look COMPLET +
// vignette), pas des rampes de couleurs — distinction importante (Adrien) :
// palette = couleurs seules, template = tout le look. Fichiers dans
// public/templates/defaults/, chargés au premier passage sur l'onglet.
// shibuStart EN TÊTE : c'est le look sur lequel l'application s'ouvre (voir
// START_VIEW dans main.js), donc le premier de la bibliothèque — il faut pouvoir
// y revenir d'un clic après avoir bricolé.
const DEFAULT_TPL_URLS = [
  'shibustart',
  'the-main-stuff', 'isolated', 'light', 'realistic',
  'bronze', 'white-valley', 'yellow-glass', 'carbon',
].map((n) => `/templates/defaults/${n}.json`)

export function buildAtelier(deps) {
  let open = false
  let step = 0
  let shop = null // aperçu boutique (8 palettes), chargé au premier enter
  let defTpls = null // templates par défaut (fichiers complets), chargés à la demande
  let entryLook = null // le look d'ARRIVÉE — ce que « Annuler » repose
  // La RÉFÉRENCE des étapes ② à ⑤ : le look posé par l'étape ①. Elle vaut le
  // look d'arrivée tant qu'aucun template n'a été choisi (« je garde ma carte »
  // est un point de départ comme un autre), et se recale à chaque template.
  let baseLook = null
  let baseName = ''

  const morph = makeMorph({ modeClass: 'atelier-mode', onSettle: () => window.dispatchEvent(new Event('resize')) })

  const col = document.createElement('aside')
  col.className = 'atelier-col'
  col.innerHTML = `
    <div class="studio-head">
      <h2>ShibuMap<span class="dot">.</span> <em>Studio</em></h2>
      <button class="studio-close" title="Fermer">✕</button>
    </div>
    <div class="studio-rail at-rail"></div>
    <div class="studio-body at-body"></div>
    <div class="studio-bar">
      <button class="studio-btn ghost at-cancel">Annuler</button>
      <span class="spacer"></span>
      <button class="studio-btn ghost at-prev" title="Étape précédente" aria-label="Étape précédente">←</button>
      <button class="studio-btn ghost at-next">Suivant →</button>
      <button class="studio-btn accent at-done">Terminer</button>
    </div>`
  const rail = col.querySelector('.at-rail')
  const body = col.querySelector('.at-body')
  const prevBtn = col.querySelector('.at-prev')
  const nextBtn = col.querySelector('.at-next')

  const caption = document.createElement('div')
  caption.className = 'studio-caption at-caption'
  caption.textContent = 'Aperçu en direct — votre carte'

  // Le rail EST la navigation : on saute où on veut, dans les deux sens. Les
  // étapes n'ont aucune dépendance entre elles, l'ordre n'est qu'un conseil.
  ATELIER_STEPS.forEach((s, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `${i + 1} · ${s.label}`
    b.addEventListener('click', () => go(i))
    rail.append(b)
  })

  function go(i) {
    step = clampStep(i)
    render()
  }

  // ---- petites briques, empruntées au Race Studio --------------------------
  const field = (label, input) => {
    const f = document.createElement('div')
    f.className = 'studio-field'
    f.innerHTML = `<label>${label}</label>`
    f.append(input)
    return f
  }
  const btn = (label, cls, onClick) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `studio-btn ${cls}`.trim()
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }
  const head = (title, hint) => {
    body.innerHTML = `<h3>${title}</h3><p class="hint">${hint}</p>`
  }
  const strip = (stops) => `<span class="at-strip">${stops.map((c) => `<i style="background:${c}"></i>`).join('')}</span>`

  // Une rangée de chips nommées (Épars / Couvert / …) — même vocabulaire que le
  // panneau Éléments du mode avancé, pour qu'on reconnaisse ses réglages en
  // passant d'un niveau à l'autre.
  function chipRow(presets, tips, isOn, apply) {
    const row = document.createElement('div')
    row.className = 'at-chiprow'
    for (const p of presets) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'at-chip' + (isOn(p) ? ' on' : '')
      b.textContent = p.label
      if (tips?.[p.id]) b.setAttribute('data-tip', tips[p.id])
      b.addEventListener('click', () => { apply(p); render() })
      row.append(b)
    }
    return row
  }

  // Un interrupteur qui s'explique : le libellé, la conséquence en une ligne.
  // Les calques ne parlent pas d'eux-mêmes (« Trait de côte » ?), et le mode
  // simple n'a pas d'infobulle de survol au clavier.
  function layerRow(label, hint, get, set) {
    const l = document.createElement('label')
    l.className = 'at-lay'
    const c = document.createElement('input')
    c.type = 'checkbox'
    c.checked = !!get()
    c.addEventListener('change', () => { set(c.checked); render() })
    const txt = document.createElement('span')
    txt.innerHTML = `<b>${label}</b><i>${hint}</i>`
    l.append(c, txt)
    return l
  }

  const slider = (min, max, stepv, get, set) => {
    const r = document.createElement('input')
    r.type = 'range'
    r.min = min
    r.max = max
    r.step = stepv
    r.value = get()
    r.addEventListener('input', () => set(+r.value))
    return r
  }

  // ---- la bande « posé par le template » -----------------------------------
  // C'est la pièce qui empêche l'assistant de se lire « démonte ton template ».
  // Elle dit d'où vient ce qu'on voit, et ce qu'on en a changé.
  function posedBand(id) {
    const keys = changedKeys(id, deps.captureLook(), baseLook)
    const band = document.createElement('div')
    band.className = 'at-posed' + (keys.length ? ' edited' : '')
    const src = baseName ? `« ${baseName} »` : 'votre carte de départ'
    const lab = document.createElement('span')
    lab.className = 'at-posed-lab'
    lab.textContent = keys.length ? `Affiné depuis ${src}` : `Posé par ${src}`
    const val = document.createElement('b')
    val.textContent = stepSummary(id, deps.params, deps.environments)
    band.append(lab, val)
    if (keys.length) {
      // Restaurer UNIQUEMENT les clés de l'étape : revenir au template ne doit
      // pas effacer ce qu'on a réglé aux quatre autres.
      band.append(btn('Revenir au template', 'ghost tiny', () => {
        const patch = {}
        for (const k of keys) patch[k] = baseLook[k]
        deps.applyLook({ ...deps.captureLook(), ...patch })
        render()
      }))
    }
    body.append(band)
  }

  // ---- ① TEMPLATE ----------------------------------------------------------
  // Loader discret au centre de la carte pendant qu'un template s'applique :
  // le double rAF laisse le spinner se peindre AVANT le gros travail synchrone
  // (rebuild matériaux/rampe), puis 500 ms de grâce pour les textures async
  // (PBR, HDRI) avant de s'effacer.
  const loader = document.createElement('div')
  loader.className = 'at-loading'
  loader.innerHTML = '<i></i>'
  let loaderT = 0
  // rAF peut ne JAMAIS venir (onglet caché → zéro frame, cf. panel-morph) :
  // fallback timeout pour que l'application du template parte quoi qu'il arrive
  const nextFrame = (cb) => {
    let done = false
    const go2 = () => { if (!done) { done = true; cb() } }
    requestAnimationFrame(go2)
    setTimeout(go2, 80)
  }
  function applyWithLoader(fn) {
    const app = document.getElementById('app')
    if (!app.contains(loader)) app.append(loader)
    loader.classList.add('on')
    clearTimeout(loaderT)
    nextFrame(() => nextFrame(() => {
      Promise.resolve().then(fn).finally(() => {
        loaderT = setTimeout(() => loader.classList.remove('on'), 500)
      })
    }))
  }

  // Choisir un template RECALE la référence : tout ce qu'on avait affiné
  // avant est écrasé par le nouveau look, donc le prétendre « modifié »
  // serait un mensonge. Le recalage est ce qui rend le changement honnête.
  function pickTemplate(t) {
    applyWithLoader(() => {
      deps.applyUserTemplate(t)
      baseLook = deps.captureLook()
      baseName = t.name || ''
      render()
    })
  }

  // carte template : vignette image si disponible, sinon bande de couleurs.
  // La vignette vient du fichier (dataURL user-supplied) → DOM APIs, pas innerHTML.
  function tplCard(t) {
    const c = document.createElement('button')
    c.type = 'button'
    c.className = 'at-card at-tpl' + (baseName && t.name === baseName ? ' on' : '')
    if (t.thumb) {
      // pas de loading=lazy : la vignette est une dataURL déjà en mémoire
      const img = document.createElement('img')
      img.src = t.thumb
      img.alt = ''
      c.append(img)
    } else {
      c.insertAdjacentHTML('afterbegin', strip((t.strip || []).filter((x) => /^#/.test(x))))
    }
    const nm = document.createElement('span')
    nm.className = 'at-nm'
    nm.textContent = t.name || 'Look'
    c.append(nm)
    c.addEventListener('click', () => pickTemplate(t))
    return c
  }

  async function loadDefaultTemplates() {
    const all = await Promise.all(DEFAULT_TPL_URLS.map(async (u) => {
      try {
        const t = await (await fetch(u)).json()
        return t?.format === 'shibumap-template' && t.look ? t : null
      } catch { return null }
    }))
    defTpls = all.filter(Boolean)
  }

  function stepTemplate() {
    head('Votre point de départ', 'Un template pose tout d’un coup : les couleurs, le ciel, les calques et la météo. Les quatre étapes suivantes affinent ce qu’il a posé — rien à refaire de zéro.')
    if (!defTpls) {
      body.insertAdjacentHTML('beforeend', '<p class="hint">Chargement des looks…</p>')
      loadDefaultTemplates().then(() => { if (open && step === 0) render() })
      return
    }
    const g = document.createElement('div')
    g.className = 'at-grid'
    for (const t of defTpls) g.append(tplCard(t))
    body.append(g)
    const mine = deps.getUserTemplates() || []
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vos templates</div>')
      const g2 = document.createElement('div')
      g2.className = 'at-grid'
      for (const t of mine) g2.append(tplCard(t))
      body.append(g2)
    }
    // Sauter l'étape est une réponse légitime : on vient parfois retoucher une
    // carte qu'on aime déjà. La porte est discrète, pas cachée.
    const alt = document.createElement('div')
    alt.className = 'at-alt'
    const keep = document.createElement('button')
    keep.type = 'button'
    keep.className = 'at-link'
    keep.innerHTML = 'Ma carte me va déjà — <u>passer à la palette</u>'
    keep.addEventListener('click', () => go(1))
    const shopBtn = document.createElement('button')
    shopBtn.type = 'button'
    shopBtn.className = 'at-link'
    shopBtn.innerHTML = 'Envie d’autre chose ? <u>Voir la boutique de templates</u>'
    // la boutique est un AUTRE espace morphé : on referme le nôtre d'abord,
    // sinon les deux colonnes se chevauchent le temps de la transition
    shopBtn.addEventListener('click', () => { finish(); setTimeout(() => deps.openStore(), 700) })
    alt.append(keep, shopBtn)
    body.append(alt)
  }

  // ---- ② PALETTE -----------------------------------------------------------
  function palCard(p) {
    const c = document.createElement('button')
    c.type = 'button'
    c.className = 'at-card'
    c.innerHTML = `${strip(p.rampStops.map((s) => s.c))}<span class="at-nm">${p.name}</span>`
    c.addEventListener('click', () => {
      deps.applyPalette({ rampStops: p.rampStops, oceanShallow: p.oceanShallow, oceanMid: p.oceanMid, oceanDeep: p.oceanDeep, ink: p.ink })
      render()
    })
    return c
  }

  function stepPalette() {
    head('La couleur du relief', 'La palette teinte l’altitude, du fond de mer aux sommets. Celle du template est déjà en place — changez-en, ou tirez-en une au sort.')
    posedBand('palette')
    let lastGen = null
    const row = document.createElement('div')
    row.className = 'studio-row'
    row.append(
      btn('Générer une palette', '', () => { const p = deps.generatePalette(); lastGen = p.name; deps.applyPalette(p); render() }),
      btn('Enregistrer celle-ci', 'ghost', () => { deps.saveCurrentPalette(lastGen); lastGen = null; render() })
    )
    body.append(row)
    const mine = deps.userPalettes() || []
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vos palettes</div>')
      const g = document.createElement('div')
      g.className = 'at-grid'
      for (const p of mine) g.append(palCard(p))
      body.append(g)
    }
    if (shop?.palettes?.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Aperçu de la boutique</div>')
      const g = document.createElement('div')
      g.className = 'at-grid'
      for (const p of shop.palettes.slice(0, 8)) g.append(palCard(p))
      body.append(g)
    }
  }

  // ---- ③ CIEL --------------------------------------------------------------
  function stepCiel() {
    head('Le ciel', 'Un ciel prend en main le fond ET la lumière de la scène. « Aucun » rend la main au fond uni du template.')
    posedBand('ciel')
    const g = document.createElement('div')
    g.className = 'at-grid at-grid-3'
    const cur = deps.getBgEnv()
    const tile = (id, label, inner) => {
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'at-card at-sky' + (cur === id ? ' on' : '')
      c.innerHTML = `${inner}<span class="at-nm">${label}</span>`
      c.addEventListener('click', () => { deps.setBgEnv(id); render() })
      return c
    }
    g.append(tile('', 'Aucun', '<span class="at-sky-none"></span>'))
    for (const e of deps.environments) g.append(tile(e.id, e.label, `<img src="${e.thumb}" alt="" loading="lazy">`))
    body.append(g)
  }

  // ---- ④ CALQUES -----------------------------------------------------------
  // Ces réglages vivaient dans le panneau « Carte », parti dans le Studio
  // AVANCÉ : ils étaient devenus inatteignables en mode simple. Cette étape est
  // exactement ce qui répare ça. Volontairement SANS les courbes de niveau ni
  // la grille : ce sont des outils de lecture, pas d'habillage (ils restent en
  // Avancé, panneau Carte → « Courbes & grille »).
  const LAYER_SET = {
    roadsEnabled: (v) => { deps.params.roadsEnabled = v; deps.rebuildMapLayers() },
    waterEnabled: (v) => { deps.params.waterEnabled = v; deps.rebuildMapLayers() },
    placesEnabled: (v) => { deps.params.placesEnabled = v; deps.rebuildMapLayers() },
    coastLine: (v) => { deps.params.coastLine = v; deps.rebuildMapLayers() },
    aerialEnabled: (v) => { deps.params.aerialEnabled = v; deps.refreshAerial() },
  }

  function stepCalques() {
    head('Ce qui se pose sur le relief', 'Les calques cartographiques drapés sur la carte. Allumez ce que votre image raconte, éteignez le reste.')
    posedBand('calques')
    for (const l of LAYERS) {
      body.append(layerRow(l.label, l.hint, () => deps.params[l.key], (v) => { LAYER_SET[l.key](v); deps.refreshAll() }))
      // « Remplir lacs & mers » n'a de sens que sous l'eau allumée : hors de
      // là, c'est une case qui ne produit rien.
      if (l.key === 'waterEnabled' && deps.params.waterEnabled) {
        const sub = layerRow('Remplir lacs & mers', 'Des aplats d’eau plutôt que le seul trait des rives.',
          () => deps.params.waterFill, (v) => { deps.params.waterFill = v; deps.rebuildMapLayers(); deps.refreshAll() })
        sub.classList.add('at-lay-sub')
        body.append(sub)
      }
    }
  }

  // ---- ⑤ MÉTÉO -------------------------------------------------------------
  function stepMeteo() {
    head('Le temps qu’il fait', 'Le ciel, le vent qui le pousse et l’état de la mer. C’est la dernière couche : elle anime la carte sans la redessiner.')
    posedBand('meteo')

    const p = deps.params
    body.insertAdjacentHTML('beforeend', '<div class="at-cat">Nuages</div>')
    // « Dégagé » n'est pas un réglage de plus : c'est l'absence de nuages. Une
    // seule rangée décide de la présence ET du caractère (vocabulaire Éléments).
    body.append(chipRow(
      [{ id: 'degage', label: 'Dégagé', v: null }, ...CLOUD_PRESETS],
      CLOUD_TIPS,
      (c) => (c.v ? p.cloudsEnabled && cloudPresetOf(p) === c : !p.cloudsEnabled),
      (c) => {
        if (!c.v) { p.cloudsEnabled = false; deps.rebuildClouds(); return }
        p.cloudsEnabled = true
        Object.assign(p, c.v)
        deps.rebuildClouds()
      }
    ))

    // Le vent ne se voit QUE sur les nuages : sans eux, deux tirettes sans
    // effet visible. On les remplace par la phrase qui explique pourquoi.
    body.insertAdjacentHTML('beforeend', '<div class="at-cat">Vent</div>')
    if (p.cloudsEnabled) {
      body.append(
        field('Direction', slider(0, 359, 1, () => p.windDir ?? 45, (v) => { p.windDir = v })),
        field('Force', slider(0, 3, 0.05, () => p.windSpeed ?? 0.6, (v) => { p.windSpeed = v }))
      )
    } else {
      body.insertAdjacentHTML('beforeend', '<p class="hint">Le vent pousse les nuages — allumez-les pour le sentir.</p>')
    }

    body.insertAdjacentHTML('beforeend', '<div class="at-cat">Mer</div>')
    body.append(chipRow(
      SEA_PRESETS, SEA_TIPS,
      (s) => seaPresetOf(p) === s,
      (s) => { Object.assign(p, s.v); deps.setWaves({ height: s.v.seaWaveH, choppiness: s.v.seaChop, speed: s.v.seaSpeed }) }
    ))
  }

  // ---- rendu ---------------------------------------------------------------
  const RENDER = [stepTemplate, stepPalette, stepCiel, stepCalques, stepMeteo]
  function render() {
    const look = deps.captureLook()
    ;[...rail.children].forEach((b, i) => {
      b.classList.toggle('on', i === step)
      // « done » ne dit PAS « validé » (rien n'est à valider ici) : il dit
      // « vous y êtes passé ». Le rail raconte le chemin parcouru, il ne
      // barre la route nulle part.
      b.classList.toggle('done', i !== step && changedKeys(ATELIER_STEPS[i].id, look, baseLook).length > 0)
    })
    prevBtn.disabled = step === 0
    nextBtn.hidden = step === ATELIER_STEPS.length - 1
    body.scrollTop = 0
    RENDER[step]()
  }

  // ---- entrée / sortie -----------------------------------------------------
  async function enter() {
    if (open) return
    open = true
    step = 0
    entryLook = deps.captureLook()
    // pas encore de template choisi : la référence, c'est la carte telle
    // qu'elle est arrivée — on peut affiner à partir de là, sans rien poser.
    baseLook = entryLook
    baseName = ''
    if (!col.isConnected) document.body.append(col, caption)
    morph.enter()
    if (!shop) {
      try { shop = await (await fetch(CATALOG_URL)).json() } catch { shop = { palettes: [] } }
    }
    render()
  }

  // Terminer : l'assistant se referme et la carte GARDE tout. C'est la sortie
  // qui manquait — sans elle, on ne savait pas comment sortir en ayant fini.
  function finish() {
    if (!open) return
    open = false
    entryLook = null
    morph.exit()
  }
  // Annuler : on repose le look d'arrivée. C'est ce qui donne un sens à
  // « Terminer » — deux boutons qui feraient la même chose n'en font qu'un.
  function cancel() {
    if (!open) return
    const snap = entryLook
    open = false
    entryLook = null
    morph.exit()
    if (snap) { try { deps.applyLook(snap) } catch {} }
  }

  prevBtn.addEventListener('click', () => go(step - 1))
  nextBtn.addEventListener('click', () => go(step + 1))
  col.querySelector('.at-done').addEventListener('click', finish)
  col.querySelector('.at-cancel').addEventListener('click', cancel)
  // la croix est une SORTIE, pas une annulation : elle garde, comme Terminer.
  // Seul « Annuler », nommé, détruit — on ne perd pas son travail par réflexe.
  col.querySelector('.studio-close').addEventListener('click', finish)
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') finish() })

  return { enter, exit: finish, isOpen: () => open }
}
