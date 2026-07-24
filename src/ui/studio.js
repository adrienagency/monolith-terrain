// Race Studio — wizard 6 étapes pour les organisateurs de courses (Adrien) :
// ① Identité (nom, logo optionnel) ② Trace (GPX / projet / démo / guide /
// dessiner-bientôt) ③ Points de passage (km, nom, alt, pictos, barrière)
// ④ Carte & transports ⑤ Style du tracé ⑥ Exporter & partager. Miroir de la
// boutique : colonne à GAUCHE, 3D à DROITE (morph partagé panel-morph.js).
// Brouillon autosauvé en localStorage ; « Envoyer vers la carte » = la
// création RESTE (pas de restauration du snapshot).
import './studio.css'
import { makeMorph } from './panel-morph.js'
import { PICTOS, PICTO_KEYS } from '../race-labels.js'
import { serializeRace, parseRace } from '../race-model.js'
import { TRANSPORT_CATS } from '../transports.js'

const DRAFT_KEY = 'shibumap-race-draft' // héritage (une seule course)
const DRAFTS_KEY = 'shibumap-race-drafts' // un brouillon PAR course (clé = nom du calque)
const STEPS = ['Identité', 'Trace', 'Points', 'Carte', 'Style', 'Exporter']

export function buildStudio(deps) {
  let open = false
  let snap = null
  let validated = false

  const freshDraft = () => ({ step: 0, race: { name: '', logo: null, waypoints: [], transports: { cats: [], removed: [] } } })
  const draftKey = () => deps.activeRaceName?.() || '_default'
  function readDrafts() {
    try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}') || {} } catch { return {} }
  }
  function loadDraft() {
    const map = readDrafts()
    if (map[draftKey()]?.race) return map[draftKey()]
    try {
      const legacy = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (legacy?.race) return legacy
    } catch {}
    return freshDraft()
  }
  let draft = loadDraft()
  function saveDraft() {
    try {
      const map = readDrafts()
      map[draftKey()] = draft
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(map))
    } catch {}
    deps.syncRace(draft.race)
  }
  // changer de course (sélecteur étape ①) : focus du calque + SON brouillon
  function switchRace(id) {
    deps.focusRace?.(id)
    draft = loadDraft()
    deps.syncRace(draft.race)
    render()
  }

  const morph = makeMorph({ modeClass: 'studio-mode', onSettle: () => window.dispatchEvent(new Event('resize')) })

  // ---- DOM ----------------------------------------------------------------
  const col = document.createElement('aside')
  col.className = 'studio-col'
  col.innerHTML = `
    <div class="studio-head">
      <h2>ShibuMap<span class="dot">.</span> <em>Race Studio</em></h2>
      <button class="studio-close" title="Fermer">✕</button>
    </div>
    <div class="studio-rail"></div>
    <div class="studio-body"></div>
    <div class="studio-bar">
      <button class="studio-btn ghost s-quit">Quitter</button>
      <span class="spacer"></span>
      <button class="studio-btn ghost s-prev">← Précédent</button>
      <button class="studio-btn s-next">Suivant →</button>
      <button class="studio-btn accent s-send" hidden>Envoyer vers la carte</button>
    </div>`
  const rail = col.querySelector('.studio-rail')
  const body = col.querySelector('.studio-body')
  const prevBtn = col.querySelector('.s-prev')
  const nextBtn = col.querySelector('.s-next')
  const sendBtn = col.querySelector('.s-send')

  const caption = document.createElement('div')
  caption.className = 'studio-caption'
  caption.textContent = 'Aperçu en direct — votre parcours'

  STEPS.forEach((label, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = `${i + 1} · ${label}`
    b.addEventListener('click', () => go(i))
    rail.append(b)
  })

  function go(i) {
    draft.step = Math.max(0, Math.min(STEPS.length - 1, i))
    saveDraft()
    render()
  }

  const field = (label, input) => {
    const f = document.createElement('div')
    f.className = 'studio-field'
    f.innerHTML = `<label>${label}</label>`
    f.append(input)
    return f
  }
  const txt = (value, on, ph = '') => {
    const i = document.createElement('input')
    i.type = 'text'
    i.value = value || ''
    i.placeholder = ph
    i.addEventListener('input', () => { on(i.value); saveDraft() })
    return i
  }

  // ---- étapes -------------------------------------------------------------
  // ① Identité : nom + logo, RIEN d'autre — une page, un job (Adrien).
  function stepIdentity() {
    body.innerHTML = `<h3>Votre événement</h3>
      <p class="hint">Le nom et le logo habillent le bloc et la tête de parcours. Sans logo, le socle porte la marque ShibuMap — sobre.</p>`
    // plusieurs courses chargées → on choisit d'abord CELLE qu'on modifie
    const races = deps.listRaces?.() || []
    if (races.length > 1) {
      const sel = document.createElement('div')
      sel.className = 'studio-row'
      for (const r of races) {
        const b = document.createElement('button')
        b.className = 'studio-btn ' + (r.active ? '' : 'ghost')
        b.textContent = r.name || 'Course sans nom'
        b.addEventListener('click', () => switchRace(r.id))
        sel.append(b)
      }
      body.append(field('Course à modifier', sel))
    }
    body.append(field('Nom de la course', txt(draft.race.name, (v) => { draft.race.name = v }, 'ex : 90km du Mont-Blanc')))
    // logo
    const lg = document.createElement('div')
    lg.className = 'studio-logo'
    lg.innerHTML = draft.race.logo ? `<img src="${draft.race.logo}" alt="logo">` : ''
    const pick = document.createElement('button')
    pick.className = 'studio-btn ghost'
    pick.textContent = draft.race.logo ? 'Changer le logo' : 'Choisir un logo…'
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = 'image/*'
    file.style.display = 'none'
    file.addEventListener('change', () => {
      const f = file.files?.[0]
      if (!f) return
      const r = new FileReader()
      r.onload = () => { draft.race.logo = r.result; saveDraft(); render() }
      r.readAsDataURL(f)
    })
    pick.addEventListener('click', () => file.click())
    lg.append(pick, file)
    if (draft.race.logo) {
      const rm = document.createElement('button')
      rm.className = 'studio-btn ghost'
      rm.textContent = 'Retirer'
      rm.addEventListener('click', () => { draft.race.logo = null; saveDraft(); render() })
      lg.append(rm)
    }
    body.append(field('Logo (optionnel)', lg))
  }

  // ② Trace : hiérarchie validée (Adrien) — 1 charger son GPX (accent),
  // 2 ouvrir un projet ShibuMap complet, 3 « Pas encore de trace ? »
  // (démo + guide d'export légal), 4 dessiner (bientôt). Trace chargée →
  // récap D+/D− + rangée compacte remplacer/ouvrir, on ne remontre pas
  // les portes à qui a déjà sa trace.
  function stepTrace() {
    body.innerHTML = `<h3>Votre trace</h3>
      <p class="hint">La colonne vertébrale de la carte — altitudes, points de passage et profil se remplissent autour.</p>`
    const pf = document.createElement('input')
    pf.type = 'file'
    pf.accept = '.json,application/json'
    pf.style.display = 'none'
    pf.addEventListener('change', async () => {
      const f = pf.files?.[0]
      if (!f) return
      const bundle = parseRace(await f.text())
      if (!bundle) { alert('Ce fichier n’est pas un projet Race Studio.') ; return }
      draft.race = bundle.race
      saveDraft()
      deps.importRace(bundle)
      render()
    })
    body.append(pf)
    const st = deps.trackStats()
    if (st) {
      const s = document.createElement('div')
      s.className = 'studio-stats'
      s.innerHTML = `<div><b>${st.km.toFixed(1)} km</b><span>Distance</span></div>
        <div><b>D+ ${st.dplus} m</b><span>Dénivelé +</span></div>
        <div><b>D− ${st.dminus} m</b><span>Dénivelé −</span></div>`
      body.append(s)
      const row = document.createElement('div')
      row.className = 'studio-row'
      const load = document.createElement('button')
      load.className = 'studio-btn ghost'
      load.textContent = 'Remplacer la trace (GPX)…'
      load.addEventListener('click', () => deps.loadGpx())
      const openP = document.createElement('button')
      openP.className = 'studio-btn ghost'
      openP.textContent = 'Ouvrir un autre projet…'
      openP.addEventListener('click', () => pf.click())
      row.append(load, openP)
      body.append(row)
      return
    }
    const door = (title, sub, { accent = false, soon = false } = {}) => {
      const d = document.createElement('button')
      d.type = 'button'
      d.className = 'studio-door' + (accent ? ' accent' : '') + (soon ? ' soon' : '')
      d.disabled = soon
      d.innerHTML = `<span class="d-main"><b>${title}</b><i>${sub}</i></span>${soon ? '<span class="studio-soon">bientôt</span>' : ''}`
      return d
    }
    // 1 — le cas le plus fréquent : l'organisateur a son fichier
    const dLoad = door('Charger ma course (fichier GPX)', 'Votre trace, depuis votre ordinateur — tout le reste se remplit autour.', { accent: true })
    dLoad.addEventListener('click', () => deps.loadGpx())
    // 2 — reprendre un projet complet (trace + points + style)
    const dOpen = door('Ouvrir un projet ShibuMap complet', 'Un fichier .shibumap-race — trace, points de passage et style, tout revient.')
    dOpen.addEventListener('click', () => pf.click())
    body.append(dLoad, dOpen)
    // 3 — pas encore de trace : démo + guide d'export légal (l'utilisateur
    // exporte SON fichier depuis SON compte — aucune connexion, aucune API)
    const empty = document.createElement('div')
    empty.className = 'studio-empty'
    empty.innerHTML = '<h4>Pas encore de trace ?</h4>'
    const dDemo = door('Essayer avec une course de démo', 'La Grande Traversée · 220 km, prête à jouer — remplacez-la par la vôtre ensuite.')
    dDemo.addEventListener('click', async () => {
      dDemo.disabled = true
      dDemo.querySelector('i').textContent = 'Chargement de la démo…'
      try {
        const bundle = parseRace(await (await fetch('/demo/grande-traversee.shibumap-race.json')).text())
        if (bundle) await importProject(bundle)
      } catch {}
      render()
    })
    const dGuide = door('Récupérer un GPX depuis un compte', 'Strava, Komoot, OpenRunner — vos données, votre fichier.')
    const guide = document.createElement('div')
    guide.className = 'studio-guide'
    guide.hidden = true
    guide.innerHTML = `
      <p><b>Strava</b> — Mes activités → ouvrez l'activité → ⋯ → « Exporter GPX ».</p>
      <p><b>Komoot</b> — ouvrez votre Tour → « Exporter » → fichier GPX.</p>
      <p><b>OpenRunner</b> — votre parcours → « Exporter » → GPX.</p>
      <p class="hint">Vous exportez votre propre fichier depuis votre propre compte — rien n'est connecté. Sinon : demandez le GPX à votre traceur ou chronométreur.</p>`
    dGuide.addEventListener('click', () => { guide.hidden = !guide.hidden })
    empty.append(dDemo, dGuide, guide)
    // 4 — dessiner : pas encore construit → badge « bientôt » (règle Adrien)
    const dDraw = door('Dessiner le parcours sur la carte', 'Cliquez les passages clés, la trace suit le terrain.', { soon: true })
    empty.append(dDraw)
    body.append(empty)
  }

  function wpRow(w, i) {
    const r = document.createElement('div')
    r.className = 'wp-row'
    const km = document.createElement('input')
    km.type = 'number'
    km.step = '0.1'
    km.value = w.km
    km.title = 'km'
    km.addEventListener('input', () => { w.km = +km.value || 0; w.alt = null; saveDraft() })
    const nm = document.createElement('input')
    nm.value = w.name
    nm.placeholder = 'Nom du point'
    nm.addEventListener('input', () => { w.name = nm.value; saveDraft() })
    const alt = document.createElement('input')
    alt.type = 'number'
    alt.value = w.alt ?? deps.altAtKm(w.km) ?? ''
    alt.title = 'altitude (m)'
    alt.addEventListener('input', () => { w.alt = +alt.value || null; saveDraft() })
    const x = document.createElement('button')
    x.className = 'wp-x'
    x.textContent = '✕'
    x.addEventListener('click', () => { draft.race.waypoints.splice(i, 1); saveDraft(); render() })
    r.append(km, nm, alt, x)
    const sub = document.createElement('div')
    sub.className = 'wp-sub'
    for (const key of PICTO_KEYS) {
      const p = document.createElement('button')
      p.className = 'wp-picto' + (w.pictos.includes(key) ? ' on' : '')
      p.title = key
      p.innerHTML = PICTOS[key]
      p.addEventListener('click', () => {
        const j = w.pictos.indexOf(key)
        if (j >= 0) w.pictos.splice(j, 1)
        else w.pictos.push(key)
        p.classList.toggle('on')
        saveDraft()
      })
      sub.append(p)
    }
    const cut = document.createElement('input')
    cut.type = 'time'
    cut.value = w.cutoff || ''
    cut.title = 'barrière horaire (option)'
    cut.addEventListener('input', () => { w.cutoff = cut.value; saveDraft() })
    sub.append(cut)
    r.append(sub)
    return r
  }

  function toggle(label, get, set) {
    const l = document.createElement('label')
    l.className = 'studio-toggle'
    const c = document.createElement('input')
    c.type = 'checkbox'
    c.checked = !!get()
    c.addEventListener('change', () => set(c.checked))
    l.append(c, document.createTextNode(label))
    return l
  }

  function stepWaypoints() {
    body.innerHTML = `<h3>Points de passage</h3>
      <p class="hint">Un point par km clé : ravitos, cols, barrières horaires. L'altitude se remplit toute seule depuis la trace, les pictos disent ce qu'on y trouve.</p>`
    draft.race.waypoints.forEach((w, i) => body.append(wpRow(w, i)))
    const add = document.createElement('button')
    add.className = 'studio-btn ghost'
    add.textContent = '+ Ajouter un point'
    add.addEventListener('click', () => {
      draft.race.waypoints.push({ km: 0, name: '', alt: null, pictos: [], cutoff: '' })
      saveDraft()
      render()
    })
    body.append(add, document.createElement('hr'))
    body.append(
      toggle('Cartouches sur la carte', () => deps.params.gpxCartouches, (v) => { deps.params.gpxCartouches = v }),
      toggle('Anti-chevauchement des cartouches', () => deps.params.gpxLabelAvoid, (v) => { deps.params.gpxLabelAvoid = v })
    )
  }

  function stepMap() {
    body.innerHTML = `<h3>Carte & transports</h3>
      <p class="hint">Ce que vos coureurs voient autour du tracé. Retirez un transport précis d'un ✕ directement sur la carte.</p>`
    body.append(toggle('Villes principales', () => deps.params.placesEnabled, (v) => { deps.params.placesEnabled = v; deps.refreshAll() }))
    for (const c of TRANSPORT_CATS) {
      body.append(toggle(c.label, () => draft.race.transports.cats.includes(c.key), (v) => {
        const arr = draft.race.transports.cats
        const j = arr.indexOf(c.key)
        if (v && j < 0) arr.push(c.key)
        if (!v && j >= 0) arr.splice(j, 1)
        saveDraft()
        deps.setTransportCats(arr)
      }))
    }
  }

  function stepStyle() {
    body.innerHTML = `<h3>Style du tracé</h3>
      <p class="hint">La trace aux couleurs de votre événement — tout s'applique en direct sur l'aperçu.</p>`
    const colr = document.createElement('input')
    colr.type = 'color'
    colr.value = deps.params.gpxColor || '#ff4d00'
    colr.addEventListener('input', () => deps.setGpxStyle({ gpxColor: colr.value }))
    body.append(field('Couleur du tracé', colr))
    const wRange = document.createElement('input')
    wRange.type = 'range'
    wRange.min = '1'
    wRange.max = '8'
    wRange.step = '0.5'
    wRange.value = deps.params.gpxWidth
    wRange.addEventListener('input', () => deps.setGpxStyle({ gpxWidth: +wRange.value }))
    body.append(field('Épaisseur', wRange))
    body.append(
      toggle('Dégradé le long du parcours', () => deps.params.gpxGradient, (v) => deps.setGpxStyle({ gpxGradient: v })),
      toggle('Halo lumineux', () => deps.params.gpxGlow, (v) => deps.setGpxStyle({ gpxGlow: v }))
    )
  }

  function stepExport() {
    body.innerHTML = `<h3>Exporter & partager</h3>
      <p class="hint">Enregistrez le projet pour y revenir, partagez le lien, puis envoyez votre création vers la carte.</p>`
    const save = document.createElement('button')
    save.className = 'studio-btn'
    save.textContent = 'Enregistrer le projet (.shibumap-race.json)'
    save.addEventListener('click', () => {
      const text = serializeRace({ race: draft.race, look: deps.captureLook(), gpxText: deps.currentGpxText() })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      a.download = `${(draft.race.name || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.shibumap-race.json`
      a.click()
      URL.revokeObjectURL(a.href)
    })
    const share = document.createElement('button')
    share.className = 'studio-btn ghost'
    share.textContent = 'Partager le lien'
    share.addEventListener('click', () => deps.share())
    const row = document.createElement('div')
    row.className = 'studio-row'
    row.append(save, share)
    body.append(row)
  }

  const RENDER = [stepIdentity, stepTrace, stepWaypoints, stepMap, stepStyle, stepExport]
  function render() {
    ;[...rail.children].forEach((b, i) => {
      b.classList.toggle('on', i === draft.step)
      b.classList.toggle('done', i < draft.step)
    })
    prevBtn.disabled = draft.step === 0
    nextBtn.hidden = draft.step === STEPS.length - 1
    sendBtn.hidden = draft.step !== STEPS.length - 1
    RENDER[draft.step]()
  }

  // ---- entrée / sortie ----------------------------------------------------
  async function enter() {
    if (open) return
    open = true
    validated = false
    snap = deps.captureState()
    if (!col.isConnected) document.body.append(col, caption)
    morph.enter()
    draft = loadDraft() // la course active a pu changer depuis la dernière fois
    deps.syncRace(draft.race)
    render()
  }
  async function exit() {
    if (!open) return
    open = false
    morph.exit()
    if (!validated) { try { await deps.restoreState(snap) } catch {} }
    snap = null
  }

  prevBtn.addEventListener('click', () => go(draft.step - 1))
  nextBtn.addEventListener('click', () => go(draft.step + 1))
  sendBtn.addEventListener('click', () => { validated = true; exit() }) // la création reste
  col.querySelector('.s-quit').addEventListener('click', exit)
  col.querySelector('.studio-close').addEventListener('click', exit)
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') exit() })

  // import d'un projet .shibumap-race depuis N'IMPORTE OÙ (bouton Load GPX…,
  // drag & drop) : pose le calque + le look, range le brouillon sous la
  // bonne clé, synchronise les cartouches — studio ouvert ou non
  async function importProject(bundle) {
    await deps.importRace(bundle) // recadre + drape la trace, applique le look
    // studio ouvert : on RESTE sur l'étape courante (ex. ② Trace → récap
    // sous les yeux) — pas de téléportation vers ① Identité
    draft = { ...freshDraft(), race: bundle.race, step: open ? draft.step : 0 }
    saveDraft() // la trace existe → km/altitudes résolus du premier coup
    if (open) render()
  }

  return { enter, exit, isOpen: () => open, importProject }
}
