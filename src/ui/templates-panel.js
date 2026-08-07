// BIBLIOTHÈQUE v4 (retours Adrien) — hiérarchie :
//   1. BOUTIQUE DE TEMPLATES en tête, accent — c'est le gagne-pain, il ne se
//      cache pas. Seul accent PERSISTANT du panneau.
//   2. Mes palettes  (repliée) : mes palettes en grille + carte « ＋ Nouvelle
//      palette » qui déplie le formulaire (create-panel), Fermer/Enregistrer.
//   3. Mes templates (repliée) : des looks COMPLETS uniquement (json entiers —
//      couleurs, shaders, fonds, mers, nuages, profondeur de champ…). JAMAIS
//      de palette ici. Mono clair/sombre = deux templates par défaut.
//      Carte « ＋ Nouveau template » + ligne « Charger un fichier… ».
//   4. Pied : « Réinitialiser la carte » en lien discret (destructif = loin
//      des gestes courants).
// Règle constante : toutes les sections repliées à l'ouverture du panneau.
//
// POURQUOI « MES » (Adrien) : la boutique VEND, la bibliothèque POSSÈDE. Une
// section nommée « Templates » à deux centimètres d'un bouton « Boutique de
// templates » ne dit pas laquelle des deux listes on regarde. Le possessif
// tranche en un mot, et il est repris partout (Studio, visite guidée).
//
// POURQUOI DEUX SOUS-ACCORDÉONS dans « Mes templates » : ce qui est livré par
// la maison et ce qu'on a fabriqué soi-même ne se cherchent pas de la même
// façon. « Mes créations » passe DEVANT — le mode Simple a déjà appris la leçon
// (atelier.js : la bibliothèque livrée poussait « Tes templates » hors de
// l'écran). Voir src/bibliotheque-origine.js pour la provenance, et pour
// pourquoi une copie locale d'un gabarit livré se masque au lieu de se
// supprimer.

import { el, button, section, refreshAll } from './kit.js'
import { Panel } from './shell.js'
// La bibliothèque LIVRÉE. Elle n'était visible qu'en mode SIMPLE (Studio,
// étape ① Template) : rester en Avancé faisait disparaître les gabarits de la
// maison, alors que c'est le mode où l'on habille le plus. Même liste, même
// chargeur que l'atelier — src/templates-livres.js est la source unique.
import { chargeTemplatesLivres } from '../templates-livres.js'
import { trieTemplates, nomsEnCollision } from '../bibliotheque-origine.js'

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>'

export function buildTemplatesPanel(ctx) {
  const panel = new Panel({
    title: 'Bibliothèque',
    icon: ICON,
    side: 'right',
    width: 268,
    tip: 'Mes palettes et mes templates — et la boutique pour en ramener d’autres.',
  })

  // ---------------------------------------------- 1. la Boutique, en pleine lumière
  const storeWrap = el('div', 'ce-btn-row')
  const storeBtn = button('Boutique de templates', () => ctx.openStore?.(), { accent: true })
  storeBtn.setAttribute('data-tip', 'Parcours styles et couleurs, essaie en direct, ramène ce qui te plaît.')
  storeWrap.append(storeBtn)
  panel.body.append(storeWrap)

  // ----------------------------------------------------- 2. Mes palettes
  const sPal = panel.addSection(section('Mes palettes'))
  const palGrid = el('div', 'ce-lib-grid')
  const palEmpty = el('div', 'ce-gpx-layers-empty', 'Aucune palette encore — « ＋ Nouvelle palette » pour la première.')
  const palForm = el('div', 'ce-lib-form')
  palForm.hidden = true
  let palFormBuilt = false
  const togglePalForm = (show) => {
    palForm.hidden = !show
    if (show && !palFormBuilt) {
      palFormBuilt = true
      palForm.append(el('div', 'ce-lib-form-title', 'Nouvelle palette'))
      ctx.paletteCreation?.(palForm, { onClose: () => { palForm.hidden = true } })
    }
  }
  function renderPalettes() {
    const list = ctx.userPalettes?.() || []
    palGrid.replaceChildren()
    palEmpty.classList.toggle('hidden', list.length > 0)
    for (const p of list) {
      const card = el('button', 'ce-pal-card')
      card.type = 'button'
      card.title = p.name
      const strip = el('div', 'ce-pal-strip')
      for (const s of p.rampStops) { const seg = el('span'); seg.style.background = s.c; strip.append(seg) }
      const ocean = el('div', 'ce-pal-strip ce-pal-ocean')
      for (const c of [p.oceanShallow, p.oceanMid, p.oceanDeep]) { const seg = el('span'); seg.style.background = c; ocean.append(seg) }
      const nameEl = el('span', 'ce-pal-name', p.name)
      const x = el('span', 'ce-pal-x', '✕')
      x.addEventListener('click', (e) => { e.stopPropagation(); ctx.deleteUserPalette?.(p.id); renderPalettes() })
      card.append(strip, ocean, nameEl, x)
      card.addEventListener('click', () => { ctx.applyPalette({ rampStops: p.rampStops, oceanShallow: p.oceanShallow, oceanMid: p.oceanMid, oceanDeep: p.oceanDeep, ink: p.ink }); refreshAll() })
      palGrid.append(card)
    }
    // la création vit là où vit le contenu : dernière carte de la grille
    const add = el('button', 'ce-lib-add')
    add.type = 'button'
    add.innerHTML = '<span>＋</span>Nouvelle palette'
    add.addEventListener('click', () => togglePalForm(palForm.hidden))
    palGrid.append(add)
  }
  renderPalettes()
  ctx.registerPaletteRefresh?.(renderPalettes)
  sPal.body.append(palGrid, palEmpty, palForm)

  // ---------------------------------------------------- 3. Mes templates
  // Des looks COMPLETS uniquement — jamais de palette ici (règle Adrien).
  const sTpl = panel.addSection(section('Mes templates'))

  // Les deux sous-accordéons. Ils ne passent PAS par panel.addSection : celui-ci
  // referme les autres sections du panneau, ce qui ferait disparaître « Mes
  // palettes » chaque fois qu'on déplie un sous-groupe. Ils se replient donc
  // l'un et l'autre indépendamment.
  const grpMoi = section('Mes créations', { open: true })
  const grpOff = section('Templates ShibuMap', { open: true })
  for (const g of [grpMoi, grpOff]) g.head.addEventListener('click', () => g.setOpen(!g.open))
  const grilleMoi = el('div', 'ce-cards ce-lib-tplgrid')
  const grilleOff = el('div', 'ce-cards ce-lib-tplgrid')
  grpMoi.body.append(grilleMoi)
  grpOff.body.append(grilleOff)

  // Les copies locales d'un gabarit livré : masquées, JAMAIS supprimées. La
  // ligne dit combien il y en a et les rend d'un clic, avec leur croix — c'est
  // à l'utilisateur de faire le ménage chez lui, pas à nous.
  const grilleCopies = el('div', 'ce-cards ce-lib-tplgrid')
  grilleCopies.hidden = true
  const ligneCopies = el('button', 'ce-lib-nav')
  ligneCopies.type = 'button'
  ligneCopies.hidden = true
  ligneCopies.addEventListener('click', () => {
    grilleCopies.hidden = !grilleCopies.hidden
    majLigneCopies()
  })
  let nbCopies = 0
  function majLigneCopies() {
    ligneCopies.hidden = nbCopies === 0
    if (!nbCopies) { grilleCopies.hidden = true; return }
    const quoi = nbCopies > 1 ? `${nbCopies} copies locales` : '1 copie locale'
    ligneCopies.replaceChildren(
      el('span', null, `${quoi} d’un template ShibuMap`),
      el('i', null, grilleCopies.hidden ? 'Afficher' : 'Masquer')
    )
  }
  grpOff.body.append(ligneCopies, grilleCopies)

  function makeCard(t, { collision = false } = {}) {
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
    // Homonyme d'un gabarit livré, mais contenu DIFFÉRENT : ce n'est pas un
    // doublon, c'est un problème de nom. On le dit, on ne touche à rien —
    // renommer ou supprimer appartient à l'utilisateur.
    card.title = collision ? `${t.name} — votre version (un template ShibuMap porte le même nom)` : (t.name || 'Look')
    card.append(media, nm)
    card.insertAdjacentHTML('beforeend', '<button class="ce-utpl-x" title="Supprimer" type="button">✕</button><button class="ce-utpl-dl" title="Exporter .json" type="button">⭳</button>')
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ce-utpl-x, .ce-utpl-dl')) return
      ctx.applyUserTemplate(t); refreshAll(); ctx.syncDark?.()
    })
    card.querySelector('.ce-utpl-x').addEventListener('click', () => { ctx.deleteUserTemplate(t.id); renderTemplates() })
    card.querySelector('.ce-utpl-dl').addEventListener('click', () => ctx.exportUserTemplate(t.id))
    return card
  }

  // Mono clair / Mono sombre : eux aussi des TEMPLATES (par défaut, non
  // supprimables) — deux cartes en tête de grille
  function monoCard(label, mode, bg) {
    const card = el('div', 'ce-utpl-card ce-utpl-default')
    card.setAttribute('role', 'button')
    card.tabIndex = 0
    const media = el('div', 'ce-utpl-img')
    media.style.background = bg
    const nm = el('span', 'ce-utpl-name', label)
    card.append(media, nm)
    const apply = () => { ctx.applyMonochrome(mode); refreshAll(); ctx.syncDark?.() }
    card.addEventListener('click', apply)
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply() } })
    return card
  }

  // ＋ Nouveau template → formulaire nom + Enregistrer (encre, pas d'accent)
  const tplForm = el('div', 'ce-lib-form')
  tplForm.hidden = true
  tplForm.append(el('div', 'ce-lib-form-title', 'Nouveau template'))
  tplForm.append(el('div', 'ce-note', 'Capture TOUT le look actuel : couleurs, matières, fonds, mers, nuages, effets…'))
  const nameInput = el('input', 'ce-tpl-name')
  nameInput.type = 'text'
  nameInput.placeholder = 'Nommer ce look…'
  nameInput.maxLength = 40
  const doSave = () => {
    if (!nameInput.value.trim()) { nameInput.focus(); return } // name required
    ctx.saveCurrentTemplate(nameInput.value)
    nameInput.value = ''
    tplForm.hidden = true
    renderTemplates()
  }
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } })
  const tplFormRow = el('div', 'ce-btn-row ce-lib-formrow')
  tplFormRow.append(button('Fermer', () => { tplForm.hidden = true }, { ghost: true }), button('Enregistrer', doSave))
  tplForm.append(nameInput, tplFormRow)

  // ---- les gabarits LIVRÉS -------------------------------------------------
  // Carte SANS croix ni export : ce n'est pas le bien de l'utilisateur, il ne
  // peut pas le supprimer (et le ré-exporter n'aurait aucun intérêt, le
  // fichier est déjà servi par le site). Le clic applique, comme les autres.
  let livres = null // chargés à la PREMIÈRE ouverture de la section, pas avant
  let chargementLivres = false
  function livreCard(t) {
    const card = el('div', 'ce-utpl-card ce-utpl-default')
    card.setAttribute('role', 'button')
    card.tabIndex = 0
    card.title = t.name || 'Look'
    // la vignette est une dataURL venue d'un fichier → API DOM, jamais innerHTML
    const media = el(t.thumb ? 'img' : 'div', 'ce-utpl-img')
    if (t.thumb) { media.src = t.thumb; media.alt = '' }
    else if (t.strip?.length) media.style.background = `linear-gradient(90deg, ${t.strip.filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c)).join(',')})`
    const nm = el('span', 'ce-utpl-name')
    nm.textContent = t.name || 'Look'
    card.append(media, nm)
    const apply = () => { ctx.applyUserTemplate(t); refreshAll(); ctx.syncDark?.() }
    card.addEventListener('click', apply)
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply() } })
    return card
  }
  // Le chargement est DIFFÉRÉ à l'ouverture de la section : dix-sept fichiers
  // de ~10 Ko (vignettes JPEG en base64 comprises) n'ont rien à faire sur le
  // chemin du premier affichage — la passe de performance vient d'en gagner
  // 4,2 s, on ne les redonne pas pour une grille repliée que personne n'a
  // encore demandée.
  function chargeLivres() {
    if (livres || chargementLivres) return
    chargementLivres = true
    chargeTemplatesLivres().then((list) => {
      livres = list
      chargementLivres = false
      renderTemplates()
    }).catch(() => { chargementLivres = false })
  }

  // La carte « ＋ Nouveau template » vit AU-DESSUS des deux groupes, pas au bout
  // d'une grille : elle doit rester à portée que l'on ait zéro création ou
  // vingt, et sans avoir à défiler par-dessus les dix-sept gabarits livrés.
  const grilleAjout = el('div', 'ce-cards ce-lib-tplgrid')
  const boutonAjout = el('button', 'ce-lib-add')
  boutonAjout.type = 'button'
  boutonAjout.innerHTML = '<span>＋</span>Nouveau template'
  boutonAjout.addEventListener('click', () => { tplForm.hidden = !tplForm.hidden; if (!tplForm.hidden) nameInput.focus() })
  grilleAjout.append(boutonAjout)

  function renderTemplates() {
    const bruts = ctx.getUserTemplates?.() ?? []
    // `livres` vaut null tant que la section n'a pas été dépliée : le tri se
    // fait alors sans référence, donc tout part dans « Mes créations ». Le
    // chargement rappelle renderTemplates, qui reclasse. Rien ne se perd, seul
    // le rangement attend son catalogue.
    const { officiels, miens, copies } = trieTemplates(bruts, livres ?? [])
    const collisions = nomsEnCollision(miens, livres ?? [])

    // --- ce qui vient de la maison : les livrés + ce qu'on a rapporté de la
    //     boutique. Mono clair / Mono sombre ouvrent la marche (défauts non
    //     supprimables).
    grilleOff.replaceChildren(
      monoCard('Mono clair', 'white', 'linear-gradient(135deg, #fdfdfb, #d8d5cc)'),
      monoCard('Mono sombre', 'dark', 'linear-gradient(135deg, #3a3a3e, #121215)')
    )
    for (const t of livres ?? []) grilleOff.append(livreCard(t))
    for (const t of officiels) grilleOff.append(makeCard(t))
    grpOff.setMeta(String(grilleOff.childElementCount))

    // --- ce qu'on a fabriqué soi-même
    grilleMoi.replaceChildren()
    for (const t of miens) grilleMoi.append(makeCard(t, { collision: collisions.has(String(t.name ?? '').trim().toLowerCase()) }))
    grpMoi.setMeta(String(miens.length))

    // --- les copies locales d'un gabarit livré (masquées par défaut)
    grilleCopies.replaceChildren()
    for (const t of copies) grilleCopies.append(makeCard(t))
    nbCopies = copies.length
    majLigneCopies()

    // Aucune création : pas de section vide, et pas de repli inutile non plus —
    // le groupe officiel perd sa tête et s'affiche à plat, comme avant.
    const seul = miens.length === 0
    grpMoi.root.hidden = seul
    grpOff.root.classList.toggle('ce-grp-nu', seul)
    if (seul) grpOff.setOpen(true)
  }
  renderTemplates()
  // la boutique (store.js) intègre des styles → main.js nous re-rend ici
  ctx.registerUserTplRefresh?.(renderTemplates)
  // Déplier la section EST la demande : c'est là qu'on va chercher les
  // gabarits livrés. addSection (shell.js) pose déjà son propre écouteur sur
  // la même tête — le nôtre s'ajoute, il ne le remplace pas.
  sTpl.head.addEventListener('click', chargeLivres)
  if (sTpl.open) chargeLivres() // section déjà ouverte (état restauré) : pas de clic à attendre
  // « Mes créations » AVANT « Templates ShibuMap » : ce qu'on a fait soi-même
  // se retrouve sans défiler.
  sTpl.body.append(grilleAjout, tplForm, grpMoi.root, grpOff.root)

  // ligne de navigation : importer un fichier .shibumap-template
  const fileInput = el('input')
  fileInput.type = 'file'
  fileInput.accept = '.json,application/json'
  fileInput.style.display = 'none'
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      const text = await f.text()
      if (!ctx.importTemplateText(text)) alert(`« ${f.name} » n’est pas un template ShibuMap.`)
    }
    fileInput.value = ''
    renderTemplates()
  })
  const loadRow = el('button', 'ce-lib-nav')
  loadRow.type = 'button'
  loadRow.innerHTML = '<span>Charger un fichier…</span><i>›</i>'
  loadRow.addEventListener('click', () => fileInput.click())
  sTpl.body.append(loadRow, fileInput)

  // ------------------------------------- 4. pied : le destructif, à distance
  const resetLink = el('button', 'ce-lib-reset')
  resetLink.type = 'button'
  resetLink.textContent = 'Réinitialiser la carte'
  resetLink.setAttribute('data-tip', 'Remet chaque réglage de look à sa valeur d’origine (le lieu ne bouge pas).')
  resetLink.addEventListener('click', () => {
    if (ctx.resetAll) {
      ctx.resetAll()
      refreshAll()
      ctx.syncDark?.()
    }
  })
  panel.body.append(resetLink)

  return panel
}
