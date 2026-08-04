// Race Studio — wizard 6 étapes pour les organisateurs de courses (Adrien) :
// ① Identité (nom, logo optionnel) ② Trace (GPX / projet / démo / guide /
// dessiner-bientôt) ③ Points de passage (km, nom, alt, pictos, barrière)
// ④ Carte & transports ⑤ Style du tracé ⑥ Exporter & partager. Miroir de la
// boutique : colonne à GAUCHE, 3D à DROITE (morph partagé panel-morph.js).
// Brouillon autosauvé en localStorage ; « Envoyer vers la carte » = la
// création RESTE (pas de restauration du snapshot).
import './studio.css'
import { makeMorph } from './panel-morph.js'
import { keepScroll } from './kit.js'
import { PICTOS, PICTO_KEYS } from '../race-labels.js'
import { serializeRace, parseRace } from '../race-model.js'
import { TRANSPORT_CATS } from '../transports.js'
import { verifieLogo, FORMATS_LOGO } from '../logo-course.js'

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
  caption.textContent = 'Aperçu en direct — ton parcours'

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
    render({ top: true }) // changer d'étape est un changement de sujet : ici, remonter est juste
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
    body.innerHTML = `<h3>Ton événement</h3>
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
    // l'attribut `accept` n'est qu'un filtre de confort dans le sélecteur de
    // fichiers — il se contourne, et il laissait passer le SVG. La vraie règle
    // est verifieLogo(), appliquée ci-dessous.
    file.accept = FORMATS_LOGO.map((f) => `image/${f}`).join(',')
    file.style.display = 'none'
    const alerte = document.createElement('p')
    alerte.className = 'hint studio-logo-refus'
    alerte.hidden = true
    file.addEventListener('change', () => {
      const f = file.files?.[0]
      if (!f) return
      const r = new FileReader()
      r.onload = () => {
        // ⚠️ ON VÉRIFIE AVANT D'ÉCRIRE. Un logo hors règles finissait sinon
        // dans le brouillon localStorage — au risque d'en saturer le quota et
        // de faire échouer toutes les sauvegardes suivantes — puis disparaissait
        // en silence à la publication (logoForPublish rend null). Voir
        // src/logo-course.js.
        const v = verifieLogo(r.result)
        if (!v.ok) {
          alerte.textContent = v.raison
          alerte.hidden = false
          file.value = '' // sinon re-choisir LE MÊME fichier ne déclenche rien
          return
        }
        alerte.hidden = true
        draft.race.logo = r.result
        saveDraft()
        render()
      }
      r.onerror = () => { alerte.textContent = 'Fichier illisible — réessaie.'; alerte.hidden = false }
      r.readAsDataURL(f)
    })
    pick.addEventListener('click', () => file.click())
    lg.append(pick, file, alerte)
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
  // (démo + guide d'export légal). Trace chargée → récap D+/D− + rangée
  // compacte remplacer/ouvrir, on ne remontre pas les portes à qui a déjà
  // sa trace. PAS de porte « dessiner sur la carte » : une porte désactivée
  // occupe un rang dans la hiérarchie pour quelque chose qu'on ne peut pas
  // faire — elle sera ajoutée quand la fonction existera (Adrien).
  function stepTrace() {
    body.innerHTML = `<h3>Ta trace</h3>
      <p class="hint">Tout le reste de la carte se remplit autour.</p>`
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
    // ---- PAS DE TRACE : une seule cible, le reste en retrait --------------
    // La bande de promesse répond à « dans quoi je m'embarque » — les pastilles
    // du haut NOMMENT les étapes, elles ne rassurent pas sur l'effort. C'est la
    // seule information que l'organisateur non graphiste réclame vraiment.
    const promise = document.createElement('div')
    promise.className = 'trace-promise'
    promise.innerHTML = `
      <span class="tp-step on"><b>Ta trace</b><i>maintenant</i></span>
      <span class="tp-sep" aria-hidden="true"></span>
      <span class="tp-step"><b>Tes points</b><i>2 min</i></span>
      <span class="tp-sep" aria-hidden="true"></span>
      <span class="tp-step"><b>Ta carte</b><i>prête</i></span>`
    body.append(promise)

    // La zone de dépôt accepte le GLISSER-DÉPOSER autant que le clic :
    // l'organisateur a son fichier sous les yeux dans son explorateur, le geste
    // naturel est de le faire glisser. Le clic reste, on ne perd personne.
    const drop = document.createElement('button')
    drop.type = 'button'
    drop.className = 'trace-drop'
    drop.innerHTML = `
      <svg class="td-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M3 15v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/></svg>
      <b>Dépose ton fichier GPX ici</b>
      <i>ou <u>parcours ton ordinateur</u></i>`
    drop.addEventListener('click', () => deps.loadGpx())
    body.append(drop)

    // dragover DOIT être annulé, sinon le navigateur refuse le drop et, pire,
    // QUITTE la page pour afficher le fichier lâché. On écoute aussi sur le
    // corps de l'étape : viser la zone exactement est une exigence de trop.
    const over = (e) => { e.preventDefault(); drop.classList.add('over') }
    const out = () => drop.classList.remove('over')
    for (const el of [drop, body]) {
      el.addEventListener('dragover', over)
      el.addEventListener('dragleave', out)
      el.addEventListener('drop', (e) => {
        e.preventDefault()
        out()
        const f = e.dataTransfer?.files?.[0]
        if (f) deps.openTrackFile(f)
      })
    }

    // La VRAIE question de l'organisateur n'est pas « quelle porte » mais
    // « c'est quoi un GPX ». On la pose avec ses mots, à l'endroit du doute,
    // au lieu de nommer une solution qu'il ne connaît pas encore.
    const help = document.createElement('button')
    help.type = 'button'
    help.className = 'trace-help'
    help.innerHTML = '<span>?</span>C’est quoi un GPX, et où le trouver ?'
    const guide = document.createElement('div')
    guide.className = 'studio-guide'
    guide.hidden = true
    guide.innerHTML = `
      <p>Le GPX est le fichier de ton tracé — celui que produit n'importe quel outil de parcours.</p>
      <p><b>Strava</b> — Mes activités → ouvre l'activité → ⋯ → « Exporter GPX ».</p>
      <p><b>Komoot</b> — ouvre ton Tour → « Exporter » → fichier GPX.</p>
      <p><b>OpenRunner</b> — ton parcours → « Exporter » → GPX.</p>
      <p class="hint">Tu exportes ton propre fichier depuis ton propre compte — rien n'est connecté. Sinon : demande le GPX à ton traceur ou à ton chronométreur.</p>`
    help.addEventListener('click', () => {
      guide.hidden = !guide.hidden
      help.classList.toggle('on', !guide.hidden)
    })
    body.append(help, guide)

    // Les deux replis : toujours accessibles, mais ils ne se battent plus avec
    // la cible principale. Sous un filet, en une ligne chacun.
    const alt = document.createElement('div')
    alt.className = 'trace-alt'
    const altLink = (label, action, prefix = '') => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'trace-link'
      b.innerHTML = `${prefix}<u>${label}</u>`
      b.addEventListener('click', action)
      return b
    }
    const lDemo = altLink('Essayer une course de démo', async () => {
      lDemo.disabled = true
      lDemo.innerHTML = 'Chargement de la démo…'
      try {
        const bundle = parseRace(await (await fetch('/demo/grande-traversee.shibumap-race.json')).text())
        if (bundle) await importProject(bundle)
      } catch {}
      render()
    }, 'Pas de fichier sous la main ? ')
    alt.append(lDemo, altLink('Reprendre un projet ShibuMap', () => pf.click()))
    body.append(alt)
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
      <p class="hint">Ce que tes coureurs voient autour du tracé. Retire un transport précis d'un ✕ directement sur la carte.</p>`
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
      <p class="hint">La trace aux couleurs de ton événement — tout s'applique en direct sur l'aperçu.</p>`
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
      <p class="hint">Enregistre le projet pour y revenir, partage le lien, puis envoie ta création vers la carte.</p>`
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
  // Même correction que dans le Studio simple : render() se rappelle à chaque
  // choix de logo, changement de course ou pictogramme, pas seulement en
  // changeant d'étape — et il reconstruit tout le corps. Sans keepScroll, on
  // remontait en haut après chaque clic. `top` n'est vrai que depuis go().
  function render({ top = false } = {}) {
    ;[...rail.children].forEach((b, i) => {
      b.classList.toggle('on', i === draft.step)
      b.classList.toggle('done', i < draft.step)
    })
    prevBtn.disabled = draft.step === 0
    nextBtn.hidden = draft.step === STEPS.length - 1
    sendBtn.hidden = draft.step !== STEPS.length - 1
    if (top) { body.scrollTop = 0; RENDER[draft.step]() } else keepScroll(body, () => RENDER[draft.step]())
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
    render({ top: true })
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
    adoptRace(bundle.race)
  }

  // Une course ARRIVE de l'extérieur (projet importé, ou simplement les <wpt>
  // du GPX qu'on vient de charger — voir adoptRaceWaypoints dans main.js) :
  // elle DEVIENT le brouillon. Le passage par ici n'est pas décoratif — le
  // brouillon est la source des points de passage dès que le studio s'ouvre :
  // ne remplir que raceState laisserait enter() repousser l'ancien brouillon
  // par-dessus, et la première retouche de l'étape ③ effacerait les repères
  // que le fichier venait d'apporter.
  // studio ouvert : on RESTE sur l'étape courante (ex. ② Trace → récap sous
  // les yeux) — pas de téléportation vers ① Identité.
  function adoptRace(race) {
    draft = { ...freshDraft(), race: { ...freshDraft().race, ...race }, step: open ? draft.step : 0 }
    saveDraft() // la trace existe → km/altitudes résolus du premier coup
    if (open) render()
  }

  // entrée directe sur l'étape Exporter — le menu « Publier » (topbar, UX P4)
  // route « projet course » ici plutôt que de dupliquer serialize/partage
  async function enterExport() {
    await enter()
    go(STEPS.length - 1)
  }

  return { enter, exit, isOpen: () => open, importProject, adoptRace, enterExport }
}
