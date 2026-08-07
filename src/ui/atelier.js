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
//
// 4. La ZONE (étape ⓪) est le seul vrai préalable. On peut habiller une carte
//    qu'on n'a pas choisie — et le premier visiteur le faisait, sur une zone
//    qui n'était pas la sienne. Mais proposer d'en choisir une à quelqu'un qui
//    vient d'en travailler une serait la lui reprendre : entryStep() ouvre sur
//    l'étape ⓪ SEULEMENT quand il n'y a rien à reprendre. Pendant l'habillage
//    le zoom est verrouillé (modes.locked, même levier que la boutique) : on
//    habille la zone qu'on a cadrée, on ne la recadre pas en cours de route.
import './atelier.css'
import { makeMorph } from './panel-morph.js'
import { keepScroll } from './kit.js'
import { CLOUD_PRESETS, CLOUD_TIPS, cloudPresetOf, SEA_PRESETS, SEA_TIPS, seaPresetOf } from './effects-panel.js'
import { LANDMARKS, ISLANDS } from '../landmarks.js'
// La bibliothèque LIVRÉE — même liste, même chargeur que la Bibliothèque du
// mode avancé (ui/templates-panel.js). Voir src/templates-livres.js : c'est
// la source unique, pour que les deux modes ne divergent jamais.
import { chargeTemplatesLivres } from '../templates-livres.js'
import { trieTemplates } from '../bibliotheque-origine.js'
import {
  ATELIER_STEPS,
  LAYERS,
  capList,
  clampStep,
  changedKeys,
  discardSummary,
  entryStep,
  frJoin,
  indexOfStep,
  stepSummary,
  zoneSummary,
} from './atelier-steps.js'

const CATALOG_URL = '/templates/data.json'

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
  // Quelles listes ont été dépliées par « voir plus », par clé de liste. Remis
  // à zéro à chaque entrée : un dépliage est une intention du moment.
  let expanded = {}
  let searching = false // une recherche de lieu est en vol (étape ⓪)
  // Ce que l'utilisateur a DEMANDÉ à l'étape ⓪. On ne peut pas le relire de
  // params.demLocation : le moteur y écrit « Custom » dès qu'on vole sans nom
  // de lieu, et il l'écrit APRÈS le rechargement du relief — l'étape se
  // redessinerait sur l'ancienne valeur. Le mot de l'utilisateur, lui, est
  // connu tout de suite et reste le bon.
  let zoneAsked = ''

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
      <button class="studio-btn soft at-next">Suivant →</button>
      <button class="studio-btn accent at-done" hidden>Envoyer à ma map</button>
    </div>`
  const rail = col.querySelector('.at-rail')
  const body = col.querySelector('.at-body')
  const prevBtn = col.querySelector('.at-prev')
  const nextBtn = col.querySelector('.at-next')
  // ⑩ La validation vit aussi DANS la colonne, à côté de la flèche de retour
  // (Adrien) — mais seulement à la dernière étape : partout ailleurs elle
  // ferait doublon avec celle posée sur la carte et concurrencerait « Suivant ».
  const doneBtn = col.querySelector('.at-done')

  // ⑤ La validation principale est posée SUR la carte, en haut à droite : ce
  // qu'on valide, c'est la carte, pas le formulaire. Elle est visible à toutes
  // les étapes — le chemin reste non bloquant, on sort quand on a fini.
  const sendBtn = document.createElement('button')
  sendBtn.type = 'button'
  sendBtn.className = 'at-send'
  sendBtn.textContent = 'Envoyer à ma map'

  const caption = document.createElement('div')
  caption.className = 'studio-caption at-caption'
  caption.textContent = 'Aperçu en direct — ta carte'

  // Le rail EST la navigation : on saute où on veut, dans les deux sens. Les
  // étapes n'ont aucune dépendance entre elles, l'ordre n'est qu'un conseil.
  ATELIER_STEPS.forEach((s, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `${i + 1} · ${s.label}`
    b.addEventListener('click', () => go(i))
    rail.append(b)
  })

  // Changer d'étape est un changement de SUJET : c'est le seul cas où remonter
  // en haut est ce qu'on attend (cf. render).
  function go(i) {
    step = clampStep(i)
    render({ top: true })
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
    const src = baseName ? `« ${baseName} »` : 'ta carte de départ'
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

  // ---- ⓪ ZONE --------------------------------------------------------------
  // Le seul préalable qui en soit vraiment un : on ne peut pas habiller une
  // carte qu'on n'a pas. Mais l'étape ne REPREND jamais la zone de quelqu'un —
  // elle affiche la sienne et propose d'en changer. Voir entryStep() : elle ne
  // s'impose comme porte d'entrée qu'au visiteur qui n'a rien cadré.
  //
  // POURQUOI un champ de recherche à nous plutôt que celui du bas : la
  // .ce-bottombar et le panneau Explorer sont masqués en atelier-mode
  // (v28.css) — la colonne est la seule surface qui reste.
  // Un échantillon COURT et contrasté (une île, un massif, un désert, un
  // fjord…) : la liste curée du panneau Explorer fait plusieurs centaines
  // d'entrées, elle noierait l'étape. Les huit premières suffisent à montrer
  // ce que la carte sait faire, le reste se cherche.
  const ZONE_PICKS = [
    ...ISLANDS.slice(0, 5),
    ...(LANDMARKS.Europe || []).slice(0, 4),
    ...(LANDMARKS['North America'] || []).slice(0, 3),
    ...(LANDMARKS.Asia || []).slice(0, 2),
    ...(LANDMARKS.Africa || []).slice(0, 2),
  ]

  // Poser une zone recharge le MNT : c'est le travail le plus lourd de
  // l'assistant, il mérite le même voile que l'application d'un template.
  async function goZone(run, asked) {
    if (searching) return
    searching = true
    render()
    let ok = false
    try { ok = (await run()) !== false } catch {}
    if (ok && asked) zoneAsked = asked
    searching = false
    render()
  }

  function stepZone() {
    head('La zone de ta carte', 'Le morceau de monde que tu vas habiller. Tout ce qui suit s’applique à lui — et le zoom reste figé le temps de l’habillage, pour que le cadre ne bouge plus sous les couleurs.')

    const zone = deps.getZone?.() || null
    // « connue » = choisie ici à l'instant, OU déjà cadrée en arrivant.
    const known = !!zoneAsked || !!deps.hasZone?.()
    const band = document.createElement('div')
    band.className = 'at-posed' + (known ? '' : ' edited')
    const lab = document.createElement('span')
    lab.className = 'at-posed-lab'
    lab.textContent = known ? 'Ta zone' : 'À choisir'
    const val = document.createElement('b')
    val.textContent = known ? (zoneAsked || zoneSummary(zone)) : 'Aucune zone choisie'
    band.append(lab, val)
    body.append(band)

    // recherche : même vocabulaire que la barre du bas, y compris « lat, lon »
    const row = document.createElement('div')
    row.className = 'studio-row at-zonerow'
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'at-zonefield'
    input.placeholder = 'Chercher un lieu, ou coller « lat, lon »'
    input.disabled = searching
    const submit = () => {
      const q = input.value.trim()
      if (!q || !deps.searchZone) return
      goZone(() => deps.searchZone(q), q)
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } })
    const goBtn = btn(searching ? 'Recherche…' : 'Aller', '', submit)
    goBtn.disabled = searching
    row.append(input, goBtn)
    body.append(row)
    // un premier visiteur n'a rien d'autre à faire ici : le curseur l'attend
    if (!known && !searching) setTimeout(() => input.focus(), 0)

    // quelques zones toutes prêtes, pour qui ne sait pas quoi chercher
    body.insertAdjacentHTML('beforeend', '<div class="at-cat">Ou pars d’ici</div>')
    const { shown, hidden, more } = capList(ZONE_PICKS, expanded.zone)
    const g = document.createElement('div')
    g.className = 'at-grid'
    for (const p of shown) {
      const c = document.createElement('button')
      c.type = 'button'
      c.className = 'at-card at-place' + ((zoneAsked || zone?.name) === p.name ? ' on' : '')
      c.disabled = searching
      const nm = document.createElement('span')
      nm.className = 'at-nm'
      nm.textContent = p.name
      c.append(nm)
      c.addEventListener('click', () => goZone(() => deps.flyTo(p.lat, p.lon, p.zoom, p.name), p.name))
      g.append(c)
    }
    body.append(g)
    if (more) body.append(moreBtn('zone', hidden, 'zone'))
  }

  // « voir plus » : une liste coupée doit dire ce qu'elle cache, sinon la coupe
  // ressemble à un bug. `kind` sert au libellé, `key` au souvenir du dépliage.
  function moreBtn(key, hidden, kind, onMore = null) {
    const b = btn(`Voir ${hidden} ${kind}${hidden > 1 ? 's' : ''} de plus`, 'ghost tiny at-more', () => {
      if (onMore) return onMore()
      expanded[key] = true
      render()
    })
    return b
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
    defTpls = await chargeTemplatesLivres()
  }

  function stepTemplate() {
    head('Ton point de départ', 'Un template pose tout d’un coup : les couleurs, le ciel, les calques et la météo. Les quatre étapes suivantes affinent ce qu’il a posé — rien à refaire de zéro.')
    if (!defTpls) {
      body.insertAdjacentHTML('beforeend', '<p class="hint">Chargement des looks…</p>')
      // ⚠️ indexOfStep, JAMAIS un chiffre en dur : l'arrivée de l'étape ⓪ a
      // décalé tout le monde d'un cran, et un « step === 0 » resté là laissait
      // la grille de templates sur « Chargement… » pour toujours.
      loadDefaultTemplates().then(() => { if (open && step === indexOfStep('template')) render() })
      return
    }
    // ② La bibliothèque est coupée à huit et se déplie sur place. Sans la
    // coupe, elle poussait « Tes templates » hors de l'écran : ce qu'on a
    // fabriqué soi-même devenait plus dur à retrouver que ce qu'on n'a pas
    // choisi. Déplier plutôt qu'envoyer ailleurs — on est en train de choisir,
    // un aller-retour vers un autre espace ferait perdre le fil.
    // MÊME TRI QUE LA BIBLIOTHÈQUE (src/bibliotheque-origine.js) : ce qui vient
    // de la maison d'un côté, les créations de l'autre, et les copies locales
    // d'un gabarit livré ne s'affichent pas deux fois. Sans ça le mode Simple
    // reproduisait exactement le doublon signalé en mode Avancé.
    const { officiels, miens } = trieTemplates(deps.getUserTemplates() || [], defTpls)
    const lib = capList(defTpls.concat(officiels), expanded.tpl)
    if (miens.length) body.insertAdjacentHTML('beforeend', '<div class="at-cat">Templates ShibuMap</div>')
    const g = document.createElement('div')
    g.className = 'at-grid'
    for (const t of lib.shown) g.append(tplCard(t))
    body.append(g)
    if (lib.more) body.append(moreBtn('tpl', lib.hidden, 'template'))
    const mine = miens
    if (mine.length) {
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Mes templates</div>')
      const own = capList(mine, expanded.mine)
      const g2 = document.createElement('div')
      g2.className = 'at-grid'
      for (const t of own.shown) g2.append(tplCard(t))
      body.append(g2)
      if (own.more) body.append(moreBtn('mine', own.hidden, 'template'))
    }
    // Sauter l'étape est une réponse légitime : on vient parfois retoucher une
    // carte qu'on aime déjà. La porte est discrète, pas cachée.
    const alt = document.createElement('div')
    alt.className = 'at-alt'
    const keep = document.createElement('button')
    keep.type = 'button'
    keep.className = 'at-link'
    keep.innerHTML = 'Ma carte me va déjà — <u>passer à la palette</u>'
    keep.addEventListener('click', () => go(indexOfStep('palette')))
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
      body.insertAdjacentHTML('beforeend', '<div class="at-cat">Mes palettes</div>')
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
  // PLUS de `roadsEnabled` : le calque Routes a quitté le site. Cette table est
  // indexée par LAYERS (atelier-steps.js), qui ne le liste plus.
  const LAYER_SET = {
    waterEnabled: (v) => { deps.params.waterEnabled = v; deps.rebuildMapLayers() },
    placesEnabled: (v) => { deps.params.placesEnabled = v; deps.rebuildMapLayers() },
    aerialEnabled: (v) => { deps.params.aerialEnabled = v; deps.refreshAerial() },
  }

  function stepCalques() {
    head('Ce qui se pose sur le relief', 'Les calques cartographiques drapés sur la carte. Allume ce que ton image raconte, éteignez le reste.')
    posedBand('calques')
    // PLUS de sous-case « Remplir lacs & mers » sous « Rivières & eau ». Adrien,
    // 2026-08-02 : « pas besoin, ça doit toujours être rempli » — le
    // remplissage est devenu le comportement de water-layer.js, pas un réglage.
    for (const l of LAYERS) {
      body.append(layerRow(l.label, l.hint, () => deps.params[l.key], (v) => { LAYER_SET[l.key](v); deps.refreshAll() }))
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

    // ⑪ La mer se débraye entièrement (Adrien) : toutes les cartes ne sont pas
    // au bord de l'eau, et une île posée sur rien est un parti pris. Éteinte,
    // l'état de mer n'a plus rien à décrire — on retire les chips plutôt que
    // de laisser trois boutons sans effet, exactement comme le vent sans nuages.
    body.insertAdjacentHTML('beforeend', '<div class="at-cat">Mer</div>')
    body.append(layerRow('Afficher la mer', 'La nappe d’eau animée autour du relief.',
      () => p.seaEnabled !== false,
      (v) => { p.seaEnabled = v; deps.setSeaEnabled?.(v) }))
    if (p.seaEnabled !== false) {
      body.append(chipRow(
        SEA_PRESETS, SEA_TIPS,
        (s) => seaPresetOf(p) === s,
        (s) => { Object.assign(p, s.v); deps.setWaves({ height: s.v.seaWaveH, choppiness: s.v.seaChop, speed: s.v.seaSpeed }) }
      ))
    }
  }

  // ---- rendu ---------------------------------------------------------------
  // ⚠️ RENDER doit rester aligné par INDEX sur ATELIER_STEPS.
  const RENDER = [stepZone, stepTemplate, stepPalette, stepCiel, stepCalques, stepMeteo]

  // ⑦ LE BUG DE DÉFILEMENT, et sa vraie cause. render() se rappelle à chaque
  // clic (choisir une palette, cocher un calque, revenir au template…), pas
  // seulement en changeant d'étape — et il reconstruit tout le corps. Remettre
  // le défilement à zéro était donc juste dans UN cas sur neuf : le changement
  // d'étape, qui est un changement de sujet. Partout ailleurs on gardait sa
  // place… sauf qu'on la perdait, et on remontait en haut de la liste après
  // avoir cliqué la palette du bas.
  // D'où le paramètre : `top` n'est vrai que depuis go(). Le reste passe par
  // keepScroll (kit.js), qui repose la position APRÈS le layout — la hauteur du
  // corps change d'un rendu à l'autre (bande « posé par », vignettes en
  // lazy-load), une restauration synchrone se ferait clamper.
  function render({ top = false } = {}) {
    const look = deps.captureLook()
    ;[...rail.children].forEach((b, i) => {
      b.classList.toggle('on', i === step)
      // « done » ne dit PAS « validé » (rien n'est à valider ici) : il dit
      // « vous y êtes passé ». Le rail raconte le chemin parcouru, il ne
      // barre la route nulle part.
      b.classList.toggle('done', i !== step && changedKeys(ATELIER_STEPS[i].id, look, baseLook).length > 0)
    })
    // ⑫ Six pastilles ne tiennent plus sur une colonne étroite : le rail défile
    // latéralement (atelier.css) et amène l'étape courante à lui. `nearest`
    // pour ne pas recentrer sans raison quand elle est déjà en vue.
    rail.children[step]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    prevBtn.disabled = step === 0
    const last = step === ATELIER_STEPS.length - 1
    nextBtn.hidden = last
    // ⑩ La validation rejoint la colonne à la dernière étape, à côté de la
    // flèche de retour. Avant, elle ferait doublon avec celle de la carte et
    // volerait l'attention de « Suivant ».
    doneBtn.hidden = !last
    if (top) { body.scrollTop = 0; RENDER[step]() } else keepScroll(body, () => RENDER[step]())
  }

  // ---- ③ la confirmation d'Annuler -----------------------------------------
  // « Voulez-vous confirmer ? » fait répéter le geste sans aider à décider. Ce
  // qui aide, c'est de NOMMER la perte : les étapes réellement touchées, tirées
  // du diff avec le look d'arrivée. Et quand rien n'a bougé, on ne demande
  // rien du tout — une confirmation qui protège le vide apprend à cliquer sans
  // lire, ce qui la rend inutile le jour où elle compte.
  //
  // Le panneau vit DANS la colonne, pas en modale plein écran : la carte
  // derrière montre justement ce qu'on s'apprête à perdre.
  const sheet = document.createElement('div')
  sheet.className = 'at-sheet'
  let sheetOn = false
  function askCancel() {
    const lost = discardSummary(deps.captureLook(), entryLook)
    if (!lost.length) return cancel()
    sheet.innerHTML = `
      <div class="at-sheet-card" role="alertdialog" aria-modal="true" aria-labelledby="at-sheet-t">
        <h3 id="at-sheet-t">Revenir à la carte d’avant ?</h3>
        <p>Ton travail sur ${frJoin(lost)} sera perdu. La carte retrouvera l’aspect qu’elle avait en entrant dans le Studio.</p>
        <div class="at-sheet-acts">
          <button type="button" class="studio-btn ghost at-keep">Continuer l’habillage</button>
          <button type="button" class="studio-btn danger at-drop">Perdre les changements</button>
        </div>
      </div>`
    sheet.querySelector('.at-keep').addEventListener('click', closeSheet)
    sheet.querySelector('.at-drop').addEventListener('click', () => { closeSheet(); cancel() })
    if (!sheet.isConnected) col.append(sheet)
    sheetOn = true
    sheet.classList.add('on')
    // le refus est le défaut : la touche réflexe (Entrée) garde le travail
    setTimeout(() => sheet.querySelector('.at-keep')?.focus(), 0)
  }
  function closeSheet() {
    sheetOn = false
    sheet.classList.remove('on')
  }

  // ---- entrée / sortie -----------------------------------------------------
  async function enter() {
    if (open) return
    open = true
    expanded = {}
    searching = false
    zoneAsked = ''
    closeSheet()
    // ① On ne propose de choisir une zone qu'à qui n'en a pas : celui qui a
    // navigué retrouve la sienne, déjà cadrée, et entre directement au Template.
    step = clampStep(entryStep(!!deps.hasZone?.()))
    entryLook = deps.captureLook()
    // pas encore de template choisi : la référence, c'est la carte telle
    // qu'elle est arrivée — on peut affiner à partir de là, sans rien poser.
    baseLook = entryLook
    baseName = ''
    if (!col.isConnected) document.body.append(col, caption)
    if (!sendBtn.isConnected) document.body.append(sendBtn)
    // ⑧ Le zoom se fige le temps de l'habillage (même levier que la boutique) :
    // on garde SA zone, mais on ne la recadre pas sous les couleurs. flyTo n'est
    // pas bridé — l'étape ⓪ continue de pouvoir déménager la carte.
    deps.setLocked?.(true)
    morph.enter()
    if (!shop) {
      try { shop = await (await fetch(CATALOG_URL)).json() } catch { shop = { palettes: [] } }
    }
    render({ top: true })
  }

  // Terminer : l'assistant se referme et la carte GARDE tout. C'est la sortie
  // qui manquait — sans elle, on ne savait pas comment sortir en ayant fini.
  function finish() {
    if (!open) return
    open = false
    entryLook = null
    closeSheet()
    deps.setLocked?.(false)
    morph.exit()
  }
  // Annuler : on repose le look d'arrivée. C'est ce qui donne un sens à
  // « Envoyer à ma map » — deux boutons qui feraient la même chose n'en font
  // qu'un. Passe TOUJOURS par askCancel côté UI : cancel() est la destruction
  // elle-même, elle ne demande rien.
  function cancel() {
    if (!open) return
    const snap = entryLook
    open = false
    entryLook = null
    closeSheet()
    deps.setLocked?.(false)
    morph.exit()
    if (snap) { try { deps.applyLook(snap) } catch {} }
  }

  prevBtn.addEventListener('click', () => go(step - 1))
  nextBtn.addEventListener('click', () => go(step + 1))
  doneBtn.addEventListener('click', finish)
  sendBtn.addEventListener('click', finish)
  col.querySelector('.at-cancel').addEventListener('click', askCancel)
  // la croix est une SORTIE, pas une annulation : elle garde, comme Terminer.
  // Seul « Annuler », nommé, détruit — on ne perd pas son travail par réflexe.
  col.querySelector('.studio-close').addEventListener('click', finish)
  window.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return
    // Échap sur la confirmation ferme la CONFIRMATION, pas le Studio : sinon
    // une touche destinée à annuler une question ferait sortir de la séance.
    if (sheetOn) return closeSheet()
    finish() // et Échap garde toujours, comme la croix
  })

  return { enter, exit: finish, isOpen: () => open }
}
