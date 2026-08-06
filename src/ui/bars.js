// Chrome fixe du v28 : la topbar (éclatée en DEUX pills de coin — identité &
// navigation à gauche, réglages & sorties à droite, grammaire Figma/Canva),
// et la barre du bas (recherche de lieu + import GPX).

import { el, iconButton, refreshAll } from './kit.js'
import { parseLatLon } from '../geo.js'
import { showToast } from './toast.js'
import { porteEnAccueil, actionBouton, LIBELLE_ACTION } from './accueil.js'

const I = {
  // objectif photo — la même icône que le panneau Caméra, pour qu'on la
  // reconnaisse d'un mode à l'autre
  aperture:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5.6M21 12h-5.6M12 21v-5.6M3 12h5.6"/></svg>',
  globe:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9z"/></svg>',
  export:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4m0 0l-4 4m4-4l4 4"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 13.5A8 8 0 0110.5 4 8 8 0 1020 13.5z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>',
  eyeOff:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0112 5c7 0 10 7 10 7a17 17 0 01-3 4M6.6 6.6A16 16 0 002 12s3 7 10 7a9.9 9.9 0 004-.8"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>',
  share:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7l7.3-4.3M8.3 13.3l7.3 4.3"/></svg>',
  route:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="19" r="2.4"/><circle cx="18" cy="5" r="2.4"/><path d="M8 17.5C11 15 9 11 12 9.5S16.5 8 16.5 6.8"/></svg>',
  iso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6L12 3z"/><path d="M12 12l8-4.4M12 12L4 7.6M12 12v9"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.6 2.6 0 115 .8c-.5 1.4-2.1 1.7-2.1 3.2"/><circle cx="12" cy="16.8" r="0.4" fill="currentColor"/></svg>',
  keyboard:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M9.5 13.5h.01M13 13.5h.01M16.5 13.5h.01M8 16.5h8" stroke-linecap="round"/></svg>',
  sliders:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/></svg>',
  gear:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M19.2 12a7.2 7.2 0 0 0-.1-1.1l2-1.5-2-3.4-2.3 1a7.3 7.3 0 0 0-1.9-1.1L14.5 3h-5l-.4 2.9a7.3 7.3 0 0 0-1.9 1.1l-2.3-1-2 3.4 2 1.5a7.2 7.2 0 0 0 0 2.2l-2 1.5 2 3.4 2.3-1a7.3 7.3 0 0 0 1.9 1.1l.4 2.9h5l.4-2.9a7.3 7.3 0 0 0 1.9-1.1l2.3 1 2-3.4-2-1.5c.06-.36.1-.73.1-1.1Z"/></svg>',
  brush:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15.5 4.5 19.5 8.5 9 19c-1.5 1.5-4 1.5-5-.5s.5-3.5 2-5L15.5 4.5z"/><path d="M13.5 6.5l4 4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>',
  news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  compass:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.2 5-5 2.2 2.2-5 5-2.2z"/></svg>',
  // la flèche d'« Aller » — le visage d'accueil du bouton de la barre de
  // recherche : on ne charge pas un fichier, on PART quelque part
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="M12.5 6.5 19 12l-6.5 5.5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h10a5 5 0 010 10h-6"/><path d="M7.5 4.5L4 8l3.5 3.5"/></svg>',
  redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 8H10a5 5 0 000 10h6"/><path d="M16.5 4.5L20 8l-3.5 3.5"/></svg>',
}

// ---- Mode simple / avancé (UX P3) ----------------------------------------
// Par défaut la carte est PURE : les deux docks de panneaux sont masqués
// (body.ce-simple), la création passe par les espaces Studio / Race Studio.
// « Avancé » (topbar) ré-affiche tous les panneaux — choix persisté.
const ADV_KEY = 'shibumap-ui-advanced'
function isAdvanced() {
  try { return localStorage.getItem(ADV_KEY) === '1' } catch { return true }
}
// La PRÉFÉRENCE, pas l'affichage : `body.ce-simple` ment pendant l'accueil, qui
// force le cœur simple sans toucher au choix de l'utilisateur (elembar.isSimple).
// Qui doit décider « avancé ou pas » lit ceci, jamais la classe du body.
export const isUiAdvanced = () => isAdvanced()
export function initUiLevel() {
  document.body.classList.toggle('ce-simple', !isAdvanced())
}

// L'interrupteur « Avancé » vit DANS les barres de modes (quickbar en mode
// simple, elembar en mode avancé) — le switch habite là où vit sa conséquence,
// plus dans la topbar. Plusieurs instances restent synchronisées.
const advToggles = new Set()
function syncAdvAll() {
  for (const b of advToggles) b.classList.toggle('on', isAdvanced())
}
// La SEULE porte pour changer de niveau : elle persiste le choix, l'applique au
// body et resynchronise tous les interrupteurs. L'accueil s'en sert aussi
// (hub.js) — sans cette porte partagée, il aurait fallu réécrire les trois
// gestes à côté, avec le risque qu'un pill « Avancé » reste allumé sur une
// interface devenue simple.
export function setUiAdvanced(adv) {
  try { localStorage.setItem(ADV_KEY, adv ? '1' : '0') } catch {}
  initUiLevel()
  syncAdvAll()
}
export function buildAdvToggle(baseCls = 'ce-pillbtn') {
  const b = el('button', `${baseCls} ce-advbtn`)
  b.type = 'button'
  b.innerHTML = `${I.sliders}<span>Avancé</span>`
  b.setAttribute('data-tip', 'Mode avancé — tous les panneaux de réglage (création, carte, effets, caméra…).')
  b.addEventListener('click', () => setUiAdvanced(!isAdvanced()))
  advToggles.add(b)
  b.classList.toggle('on', isAdvanced())
  return b
}

export function buildTopBar(ctx) {
  // pill GAUCHE — identité & navigation : marque, stade (→ nouveautés), Globe
  const bar = el('div', 'ce-topbar ce-topbar-left ce-glassbox')
  // pill DROITE — réglages & sorties : sombre, œil, aide, paramètres │ Publier
  const barRight = el('div', 'ce-topbar ce-topbar-right ce-glassbox')

  const mark = el('span', 'ce-wordmark')
  mark.innerHTML = '<i>◍</i><span class="ce-wm-name">ShibuMap</span>'
  bar.append(mark)

  // stage chip — states the product stage AND opens the changelog: the stage
  // gets a receipt (everything that moved, dated). Hidden when APP_STAGE is ''.
  let alphaChip = null
  if (ctx.appStage) {
    alphaChip = el('button', 'ce-alpha')
    alphaChip.type = 'button'
    alphaChip.textContent = ctx.appStage.toUpperCase()
    alphaChip.setAttribute('data-tip', 'ShibuMap est en alpha — cliquer pour voir les nouveautés.')
    alphaChip.addEventListener('click', () => ctx.toggleChangelog?.())
    bar.append(alphaChip)
  }

  const globeBtn = iconButton(I.globe, '', () => ctx.enterOrbit())
  globeBtn.classList.add('ce-globebtn') // ciblé par la visite guidée
  globeBtn.setAttribute('data-tip', 'Reculer jusqu’à la planète entière, qui tourne lentement.')
  bar.append(globeBtn)

  // Annuler / rétablir — À GAUCHE, avec la navigation, comme dans Figma et
  // Canva dont ce chrome emprunte la grammaire. Ils existaient déjà en
  // raccourci seul, ce qui les rendait invisibles pour qui ne les connaît pas
  // (et injoignables au doigt : un écran tactile n'a pas de Ctrl).
  // Ils naissent ÉTEINTS et le restent tant que l'historique n'a rien —
  // setHistoryState est la seule porte qui les rallume (main.js la branche sur
  // History.onChange), pour qu'on ne clique jamais dans le vide.
  const undoBtn = iconButton(I.undo, '', () => ctx.undo?.())
  undoBtn.classList.add('ce-undobtn')
  undoBtn.disabled = true
  undoBtn.setAttribute('data-tip', 'Annuler le dernier réglage (Ctrl+Z).')
  const redoBtn = iconButton(I.redo, '', () => ctx.redo?.())
  redoBtn.classList.add('ce-redobtn')
  redoBtn.disabled = true
  redoBtn.setAttribute('data-tip', 'Rétablir ce qui vient d’être annulé (Ctrl+Maj+Z).')
  bar.append(el('span', 'ce-topbar-sep'), undoBtn, redoBtn)

  // export earns a labelled pill — it is a primary action, not tucked-away chrome.
  // openExport is async (the export stack is lazy-loaded on first click): the
  // button goes busy until the modal is up, so a slow network can't double-open.
  // « Publier » (UX P4) — UNE seule sortie consolidée : export image/vidéo,
  // lien de partage, projet course. Remplace le pill Export + l'icône share.
  const exportBtn = el('button', 'ce-pillbtn accent ce-pubbtn')
  exportBtn.type = 'button'
  exportBtn.innerHTML = `${I.export}<span>Publier</span>`
  exportBtn.setAttribute('data-tip', 'Tout ce qui sort de ShibuMap : image, vidéo, lien de la vue, projet course.')
  const pubMenu = el('div', 'ce-pubmenu ce-glassbox')
  // menu Aide (le « ? ») — visite guidée + raccourcis + nouveautés en UN bouton
  const helpMenu = el('div', 'ce-pubmenu ce-helpmenu ce-glassbox')
  // menu CAMÉRA — même mécanique que « Aide », mais il héberge un vrai panneau
  // de réglages (objectif, mise au point, mouvements) au lieu d'une liste
  const camMenu = el('div', 'ce-pubmenu ce-cammenu ce-glassbox')
  const closeMenu = () => { pubMenu.classList.remove('open'); helpMenu.classList.remove('open'); camMenu.classList.remove('open') }
  const menuItem = (menu) => (icon, label, sub, onClick) => {
    const b = el('button', 'ce-pubitem')
    b.type = 'button'
    b.innerHTML = `${icon}<span class="pi-main"><b>${label}</b><i>${sub}</i></span>`
    b.addEventListener('click', async () => { closeMenu(); await onClick() })
    menu.append(b)
    return b
  }
  const pubItem = menuItem(pubMenu)
  const helpItem = menuItem(helpMenu)
  // L'AFFICHE EN PREMIER, et ce n'est pas un caprice de rangement : c'est la
  // seule sortie qui vaille quelque chose, les deux autres sont des copies de
  // l'écran. Un menu se lit du haut, et ce qu'on met en tête est ce qu'on
  // propose.
  //
  // ⚠️ « IMPRIMER », PAS « VOIR » (Adrien, 2026-08-06). « Voir mon affiche »
  // était honnête sur le CLIC — on voit, on ne paie pas — mais muet sur la
  // DESTINATION : à côté de « Exporter une image », il se lisait comme un
  // deuxième aperçu, et le seul endroit d'où l'on sort un fichier d'impression
  // n'annonçait pas qu'il imprimait. La sous-ligne, elle, garde la promesse de
  // l'ancien libellé : on regarde d'abord, on décide ensuite.
  pubItem(I.export, 'Imprimer mon affiche', 'En vrai format d’abord, le fichier d’impression ensuite.', async () => {
    try { await ctx.openAffiche() } catch (err) { console.error('Affiche failed to open:', err) }
  })
  // openExport est async (pile d'export lazy-loadée au premier clic)
  pubItem(I.export, 'Exporter une image ou une vidéo', 'Ce que tu vois, en haute qualité.', async () => {
    try { await ctx.openExport() } catch (err) { console.error('Export failed to open:', err) }
  })
  pubItem(I.share, 'Copier le lien de la vue', 'Look, lieu et caméra — la même carte chez eux.', () => doShare())
  // projet course → Race Studio étape Exporter (aucune logique dupliquée) ;
  // visible seulement quand une course est chargée
  const miRace = pubItem(I.route, 'Projet course (.shibumap-race)', 'Enregistrer ou partager ta carte de course.', () => ctx.openStudioExport?.())
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const wasOpen = pubMenu.classList.contains('open')
    closeMenu()
    miRace.style.display = ctx.hasCourse?.() ? '' : 'none'
    pubMenu.classList.toggle('open', !wasOpen)
  })
  document.addEventListener('click', (e) => {
    if (!pubMenu.contains(e.target) && !helpMenu.contains(e.target) && !camMenu.contains(e.target)) closeMenu()
  })
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu() })
  document.body.append(pubMenu, helpMenu, camMenu)

  // one click copies a link that reproduces this exact look + location +
  // camera (navigator.share on mobile hands it to the OS share sheet
  // instead — "facilitate sharing", per the brief)
  // presse-papier refusé (document plus focus après l'attente réseau de la
  // publication, permission…) : petite boîte avec le lien sélectionnable —
  // le clic « Copier » est un GESTE FRAIS, writeText repasse à coup sûr
  function showLinkBox(url) {
    document.querySelector('.ce-linkbox-veil')?.remove()
    const veil = el('div', 'ce-linkbox-veil')
    const box = el('div', 'ce-linkbox ce-glassbox')
    box.innerHTML = '<b>Ton lien est prêt</b>'
    const input = el('input', 'ce-linkbox-input')
    input.type = 'text'
    input.readOnly = true
    input.value = url
    input.addEventListener('focus', () => input.select())
    const row = el('div', 'ce-btn-row')
    const copyBtn = el('button', 'ce-pillbtn accent')
    copyBtn.type = 'button'
    copyBtn.textContent = 'Copier'
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url) } catch { input.select(); document.execCommand('copy') }
      showToast('Lien copié')
      veil.remove()
    })
    const closeBtn = el('button', 'ce-pillbtn')
    closeBtn.type = 'button'
    closeBtn.textContent = 'Fermer'
    closeBtn.addEventListener('click', () => veil.remove())
    row.append(copyBtn, closeBtn)
    box.append(input, row)
    veil.append(box)
    veil.addEventListener('click', (e) => { if (e.target === veil) veil.remove() })
    document.body.append(veil)
    input.focus()
  }

  let sharing = false
  async function doShare() {
    if (sharing) return
    sharing = true
    try {
      const res = await ctx.share()
      if (res?.cancelled) {
        // user backed out of the OS share sheet — no feedback needed
      } else if (res?.publishFailed) {
        // échec dur : rien n'a été copié — un lien sans la course serait pire.
        // Le détail technique reste visible pour diagnostiquer un échec durable.
        const detail = res.failDetail ? ` (${res.failDetail})` : ''
        showToast(`La course n’a pas pu être publiée — aucun lien copié. Réessaie dans un instant.${detail}`)
      } else if (res?.ok) {
        // three honest cases: track published in the link / publish failed so
        // the link is look-only / no track loaded at all (nothing to say)
        const trackNote = res.hasTrack ? (res.published ? ' — course incluse' : ' — la course n’a pas pu être publiée') : ''
        showToast((res.copied ? 'Lien copié' : 'Partagé') + trackNote)
      } else if (res?.url) {
        showLinkBox(res.url) // le lien existe, seul le presse-papier a échoué
      } else {
        showToast('Impossible de créer le lien')
      }
    } catch (err) {
      console.error('Share failed:', err)
      showToast('Impossible de créer le lien')
    } finally {
      sharing = false
    }
  }

  const dark = iconButton(I.moon, '', () => {
    ctx.setDarkMode(!ctx.params.darkMode)
    syncDark()
    refreshAll() // resyncs dark-mode-gated controls (e.g. Map → Contour weight)
  })
  dark.setAttribute('data-tip', 'Carte claire / sombre — palette, contours, mers, brume.')
  const syncDark = () => {
    dark.innerHTML = ctx.params.darkMode ? I.sun : I.moon
    dark.classList.toggle('on', !!ctx.params.darkMode)
  }
  syncDark()

  // CAMÉRA — le panneau est construit plus tard dans main.js, qui l'accroche
  // ici via mountCamera(). Il rejoint le menu UNE fois pour toutes, dès la
  // construction : un montage paresseux au premier clic le laisserait détaché
  // du document, donc invisible pour la palette « K » et la visite guidée.
  const camBtn = iconButton(I.aperture, '', () => {})
  camBtn.classList.add('ce-cambtn') // ciblé par la visite guidée
  camBtn.setAttribute('data-tip', 'Caméra — champ de vision, mise au point, flou de profondeur et mouvements.')
  camBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const wasOpen = camMenu.classList.contains('open')
    closeMenu()
    // les panneaux naissent REPLIÉS, et ici l'en-tête qui sert à les déplier
    // est masqué (le bouton de la barre en tient lieu) : on ouvre nous-mêmes
    camMenu.firstElementChild?.classList.remove('collapsed')
    camMenu.classList.toggle('open', !wasOpen)
  })

  const hideBtn = iconButton(I.eyeOff, '', () => setNoUi(true))
  hideBtn.setAttribute('data-tip', 'Masquer toute l’interface — seul un petit œil reste.')

  // « ? » — l'aide en UN bouton : visite guidée, raccourcis, nouveautés
  const helpBtn = iconButton(I.help, '', () => {})
  helpBtn.setAttribute('data-tip', 'Aide — visite guidée, raccourcis clavier, nouveautés.')
  helpItem(I.compass, 'Visite guidée', 'L’écran expliqué en une minute.', () => ctx.startTutorial?.())
  helpItem(I.keyboard, 'Raccourcis clavier', 'Caméra, calques, annuler / rétablir.', () => ctx.toggleShortcuts?.())
  helpItem(I.news, 'Nouveautés', 'Tout ce qui a bougé, daté.', () => ctx.toggleChangelog?.())
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const wasOpen = helpMenu.classList.contains('open')
    closeMenu()
    helpMenu.classList.toggle('open', !wasOpen)
  })

  // the single button that survives no-UI mode
  const eye = el('button', 'ce-eye ce-glassbox')
  eye.type = 'button'
  eye.title = 'Afficher l’interface'
  eye.innerHTML = I.eye
  eye.addEventListener('click', () => setNoUi(false))

  function setNoUi(v) {
    document.body.classList.toggle('ce-noui', v)
  }

  // roue crantée — paramètres globaux (Performance…), TOUJOURS visible
  const gearBtn = iconButton(I.gear, '', () => ctx.openSettings?.())
  gearBtn.setAttribute('data-tip', 'Paramètres — réglages globaux de l’application (performance…).')

  // ordre du pill droit : réglages de VUE (sombre, œil) · aide · paramètres,
  // puis la seule sortie — « Publier » — isolée à l'extrême droite (accent).
  const sep = () => el('span', 'ce-topbar-sep')
  barRight.append(dark, camBtn, hideBtn, helpBtn, gearBtn, sep(), exportBtn)

  document.body.append(bar, barRight, eye)
  return {
    root: bar,
    rootRight: barRight,
    syncDark,
    // allume / éteint les deux boutons d'historique — cf. History.onChange
    setHistoryState: ({ canUndo, canRedo }) => {
      undoBtn.disabled = !canUndo
      redoBtn.disabled = !canRedo
    },
    // le panneau Caméra n'existe pas encore quand la barre se construit
    mountCamera: (root) => camMenu.append(root),
  }
}

// fixed bottom-right: one click to the isometric museum view — the whole
// block on its plate with the cartouche text readable around it
export function buildIsoButton(ctx) {
  const btn = el('button', 'ce-isobtn ce-glassbox')
  btn.type = 'button'
  btn.innerHTML = I.iso
  // petit numéro en haut à droite de l'icône : quelle vue on regarde (Adrien)
  const badge = el('span', 'ce-iso-badge')
  badge.style.display = 'none'
  btn.append(badge)
  btn.setAttribute('data-tip', 'Vue isométrique — cliquer pour tourner : quatre angles, vue du dessus (nord), raz du sol.')
  btn.addEventListener('click', () => ctx.flyIso())
  document.body.append(btn)
  return {
    root: btn,
    setVisible: (v) => btn.classList.toggle('off', !v),
    setBadge: (t) => { badge.textContent = t ?? ''; badge.style.display = t ? '' : 'none' },
  }
}

// Cinematic shortcut — the iso button's twin, one slot left. MÊME MÉCANIQUE QUE
// LE BOUTON ISO (Adrien) : chaque clic passe au plan suivant et un petit numéro
// apparaît au-dessus. Le badge réutilise tel quel la classe `.ce-iso-badge`,
// puisque `.ce-cinebtn` porte aussi `.ce-isobtn` sur qui elle se positionne.
// Allumé (accent) tant qu'un plan tourne ; le cran d'arrêt éteint tout.
export function buildCineButton(ctx) {
  const btn = el('button', 'ce-isobtn ce-cinebtn ce-glassbox')
  btn.type = 'button'
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="12" height="10" rx="2"/><path d="M15 10.5 21 8v8l-6-2.5"/></svg>'
  const badge = el('span', 'ce-iso-badge')
  badge.style.display = 'none'
  btn.append(badge)
  btn.setAttribute('data-tip', 'Plans de caméra — cliquer pour enchaîner : poursuite au sol, travelling, dolly zoom, survol, contre-plongée, orbite sur sommet, série. Un clic de plus arrête.')
  btn.addEventListener('click', () => ctx.next())
  document.body.append(btn)
  return {
    root: btn,
    setVisible: (v) => btn.classList.toggle('off', !v),
    setBadge: (t) => { badge.textContent = t ?? ''; badge.style.display = t ? '' : 'none' },
    setActive: (v) => btn.classList.toggle('on', !!v),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 💤 LA CAMÉRA PILOTE DORT ICI — le bouton est parti, LE CODE EST INTACT
// ═══════════════════════════════════════════════════════════════════════════
//
// Adrien, 2026-08-02 : « mode avion et hélicoptère, ça ne marche pas bien. On
// retire le bouton. **On garde le code de côté !** »
//
// CE QUI A ÉTÉ RETIRÉ : cette fonction `buildPiloteButton()` — la troisième
// pastille de verre de la rangée, à gauche du bouton cinéma — son écouteur de
// clic, et ses règles CSS `.ce-pilotebtn` (v28.css, atelier.css, studio.css,
// store.css).
//
// CE QUI RESTE, ENTIER ET TESTÉ (73 tests) :
//   src/pilote.js          la mécanique de vol (profils, roulis coordonné)
//   src/poursuite.js       la poursuite de la tête de course
//   src/pilote-cam.js      la caméra qui assemble les deux — TOUJOURS
//                          construite par main.js, toujours mise à jour par
//                          image, jamais mise en sommeil
//   src/pilote-banc.js     bancs d'essai, chargés à la demande par import()
//   src/poursuite-banc.js
//   test/pilote.test.js, test/poursuite.test.js
//
// ⚠️ ET DEUX CHEMINS LA RÉVEILLENT ENCORE TOUT SEULS. Le retrait du bouton ne
// débranche PAS le suivi de course : `flyTrack()` et le suivi GPX appellent
// `pilote.lancerPoursuite()` dès que le drapeau `suiviHelicoActif()` de
// flags.js est levé. Ce chemin-là n'a jamais dépendu du bouton.
//
// ─── COMMENT LA RÉVEILLER ───────────────────────────────────────────────────
//
// À LA MAIN, TOUT DE SUITE, sans rien recompiler : l'objet est exposé sur
// `window.__exp` (voir la fin de main.js), donc dans la console du navigateur
//
//     __exp.pilote.next()      // 1 avion → 2 hélicoptère → 3 poursuite → arrêt
//     __exp.pilote.cancel()
//
// C'est aussi par là que passent les scripts de tournage (scripts/sonde-*.js).
//
// POUR REMETTRE LE BOUTON : rétablir cette fonction depuis l'historique git
// (`git log -S buildPiloteButton`), son import et son appel dans main.js — le
// bloc `piloteBtn = buildPiloteButton({ next: … })` — les trois `piloteBtn?.`
// de main.js (setVisible, setActive, setBadge), et les règles CSS citées plus
// haut. Rien d'autre n'a bougé ; le câblage était déjà en appel optionnel.
//
// POURQUOI TROIS CRANS PLUTÔT QU'UN MARCHE/ARRÊT, si quelqu'un le refait : il y
// a deux vols, et ils ne donnent pas la même image — l'AVION (survol de vallée,
// entrée → sortie, virages larges et inclinés) et l'HÉLICOPTÈRE (reconnaissance
// basse, lent, capable de se retourner DANS le couloir, ce que l'avion ne peut
// pas ; voir la note d'échelle de pilote.js). Le troisième cran, la poursuite,
// n'apparaissait que si une course était chargée.

// bottom-LEFT twin of the iso/cine corner (Adrien) : three cartography
// controls. Left→right: aerial-photo toggle (green tick when active), return to
// base cartography, and a full shuffle that rebats every look option at once.
const MC = {
  aerial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="10" r="1.6"/><path d="M3 16l5-4 4 3 3-2.5 6 4.5"/></svg>',
  base: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 4-6 2.4v13.2L9 17l6 2.4 6-2.4V3.6L15 6 9 3.6Z"/><path d="M9 3.6V17M15 6v13.4"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5 10 17.5 19 6.5"/></svg>',
}
export function buildMapCorner(ctx) {
  const mk = (icon, tip, extraCls = '') => {
    const b = el('button', `ce-mapbtn ce-glassbox ${extraCls}`.trim())
    b.type = 'button'
    b.innerHTML = icon
    b.setAttribute('data-tip', tip)
    document.body.append(b)
    return b
  }
  const aerial = mk(MC.aerial, 'Photo aérienne — cliquer pour basculer (là où l’imagerie existe).', 'ce-mapbtn-aerial')
  const check = el('span', 'ce-mapbtn-check')
  check.innerHTML = MC.check
  aerial.append(check)
  aerial.addEventListener('click', () => ctx.toggleAerial())

  // le générateur ALÉATOIRE rebranché à côté de l'aérien (demande Adrien) :
  // un shuffle complet du look — template de base, heure, shader, mer, fond,
  // socle, brume de couches — en UNE étape d'annulation (shuffleLook, main.js)
  const dice = mk(MC.shuffle, 'Carte aléatoire — rebat tout le look d’un coup (annulable).', 'ce-mapbtn-shuffle')
  dice.addEventListener('click', () => ctx.shuffle?.())

  return {
    setAerialActive: (v) => aerial.classList.toggle('on', !!v),
    setVisible: (v) => { aerial.classList.toggle('off', !v); dice.classList.toggle('off', !v) },
  }
}

// Cœur du MODE SIMPLE — même grammaire de nav que le mode avancé (rectif
// Adrien) : trois .ce-wm-btn (Explorer / Habiller ma carte / Ma course), le
// mot choisi fonce + icône orange + coche liquide, AUCUN fond de pill.
// Hébergé dans la rangée liquide de l'elembar (buildElemBar simpleCore).
export function buildQuickCore(ctx) {
  const core = el('div', 'ce-qb-core')
  const explore =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.7-4-9s1.2-6.4 4-9z"/></svg>'
  const setActive = (btn) => core.querySelectorAll('.ce-wm-btn').forEach((b) => b.classList.toggle('on', b === btn))
  // data-mode : le MÊME vocabulaire que la capsule avancée — c'est lui qui dit
  // à la rangée liquide où poser le pont et si le cartouche du bas doit se
  // resserrer (mode « parcours » : on ne cherche pas un lieu pour bâtir une
  // course, le champ se replie et GPX devient l'action du mode).
  // Chaque porte porte DEUX titres et un sous-titre, parce que c'est le MÊME
  // bouton dans les deux états de la barre (accueil au centre / barre du bas) :
  //   .wm-t   — le titre de la BARRE, explicite (« Habiller ma carte »)
  //   .wm-h   — le titre de l'ACCUEIL, court (« Studio ») ; absent = .wm-t sert
  //             dans les deux états (« Explorer »)
  //   .wm-sub — le sous-titre, visible seulement en accueil
  // Ils se replient par max-width/max-height, JAMAIS display:none : liquidize
  // supprimerait la bulle d'un coup, sans transition.
  const mk = (mode, icon, label, hubLabel, sub, tip, onClick) => {
    const b = el('button', 'ce-wm-btn')
    b.type = 'button'
    b.dataset.mode = mode
    // `hub-off` : la porte existe, mais l'accueil ne la propose pas (Explorer —
    // voir accueil.js). C'est le JS qui tranche, le CSS ne fait qu'obéir : la
    // règle est ainsi testable, et l'accueil ne se relit pas dans une feuille
    // de style. La porte REVIENT dès que la barre redescend, c'est le même
    // bouton — rien n'est recréé.
    b.classList.toggle('hub-off', !porteEnAccueil(mode))
    const alt = hubLabel ? ' alt' : ''
    const hub = hubLabel ? `<span class="wm-h">${hubLabel}</span>` : ''
    b.innerHTML = `${icon}<span class="wm-t${alt}">${label}</span>${hub}<i class="wm-sub">${sub}</i>`
    b.setAttribute('data-tip', tip)
    b.addEventListener('click', () => { setActive(b); onClick?.() })
    return b
  }
  // Explorer n'était qu'un état de repos sans effet : il DÉPLIE maintenant le
  // panneau du mode Explorer en haut à gauche (le seul dock autorisé en mode
  // simple). Recliquer le referme — c'est un interrupteur, comme les autres.
  // Le mode de travail est CHOISI au passage : les deux niveaux partagent le
  // même vocabulaire (data-mode), donc la même conséquence. Sans cela, un
  // niveau avancé quitté en Studio ou en Parcours laissait le panneau
  // Explorer éteint (wm-off) et le dock s'ouvrait sur du vide.
  const home = mk('explorer', explore, 'Explorer', null, 'La Terre en relief', 'Les lieux à visiter — continents, sites remarquables, recherche.', () => {
    ctx.setWorkMode?.('explorer')
    document.body.classList.toggle('ce-explore', !document.body.classList.contains('ce-explore'))
  })
  const race = mk('parcours', I.flag, 'Ma course', 'Parcours', 'Ma carte de course', 'Race Studio — ton parcours GPX en carte de course (points de passage, transports, partage).', () => { document.body.classList.remove('ce-explore'); ctx.openStudio() })
  // ⚠️ PLUS DE CARTOUCHE « Organisateurs » (Adrien, 29/07). Elle segmentait le
  // public au moment précis où l'accueil doit rester une invitation ouverte :
  // un visiteur qui n'organise rien lisait « ce n'est pas pour moi » avant même
  // d'avoir vu la carte. Le sous-titre « Ma carte de course » dit déjà à qui
  // cette porte s'adresse, sans exclure personne. La règle CSS .ce-wm-badge
  // reste en place — rien ne s'y accroche plus, mais la géométrie du cartouche
  // (position: relative) sert encore.
  core.append(
    home,
    mk('studio', I.brush, 'Habiller ma carte', 'Studio', 'Habiller ma carte', 'Studio — palettes, templates et ciels appliqués en direct sur ta carte.', () => { document.body.classList.remove('ce-explore'); ctx.openAtelier() }),
    race
  )
  home.classList.add('on') // l'état de repos du mode simple : on explore
  return core
}

// Le champ de recherche, mémorisé au build : le raccourci « / », le hub et la
// palette d'actions passaient chacun par leur propre câblage (trois chemins,
// trois comportements possibles). Un seul point d'entrée maintenant.
let searchInput = null
export function focusSearch() {
  const inp = searchInput?.isConnected ? searchInput : document.querySelector('.ce-search input')
  if (!inp) return false
  // en mode Parcours le champ est REPLIÉ (largeur 0) : le focus le rouvre
  // (elembar.js écoute focus/blur et rend sa largeur à la barre)
  inp.focus()
  inp.select?.()
  return true
}

export function buildBottomBar(ctx) {
  // `ce-bb-loose` = la barre n'a pas (encore) été adoptée par la rangée
  // liquide : elle garde alors son ancrage fixe et son verre. buildElemBar la
  // récupère et retire ces deux classes — le fond devient la bulle du goo
  // (porcelaine OPAQUE, validé Adrien : le seuil d'alpha du filtre affame le
  // pont dès qu'une bulle est translucide).
  const bar = el('div', 'ce-bottombar ce-glassbox ce-bb-loose')

  const search = el('div', 'ce-search')
  search.innerHTML = I.search
  const input = el('input')
  input.type = 'text'
  input.placeholder = 'Chercher un lieu, ou coller « lat, lon »'
  input.spellcheck = false
  search.append(input)
  searchInput = input

  const go = async () => {
    const text = input.value.trim()
    if (!text) return
    input.blur()
    const ok = parseLatLon(text) ? await ctx.goto.go(text) : await ctx.goto.search(text)
    if (ok) input.value = ''
    // le champ vidé par le code n'émet aucun `input` : sans ce rappel, le
    // bouton resterait « Aller » sur un champ redevenu vide.
    majBouton()
  }
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') go()
    e.stopPropagation() // keep app-level shortcuts out of the field
  })

  // UN SEUL bouton pour deux visages (Adrien) : « Aller » quand la recherche est
  // éveillée, « GPX » quand elle dort. Deux boutons auraient été deux largeurs,
  // or c'est CE bouton que la rangée liquide mesure pour resserrer le cartouche
  // en mode Parcours (elembar.js, `gpxW`) — un jumeau caché aurait faussé le
  // calcul. Les deux faces se replient par `display` : ce sont des enfants du
  // bouton, pas des bulles du goo (liquidize mesure le bouton, jamais son
  // contenu). La règle qui choisit la face vit dans accueil.js, et elle est
  // testée : elle a un piège, écrit là-bas.
  const gpx = el('button', 'ce-pillbtn ce-gpxbtn')
  gpx.type = 'button'
  gpx.innerHTML =
    `<span class="gpx-face gpx-f-gpx">${I.route}<span>${LIBELLE_ACTION.gpx}</span></span>` +
    `<span class="gpx-face gpx-f-go">${I.arrow}<span>${LIBELLE_ACTION.aller}</span></span>`
  const TIPS = {
    gpx: 'Importer une trace GPX et la draper sur le relief.',
    aller: 'Aller — la carte vole jusqu’au lieu tapé dans le champ.',
    focus: 'Aller — tape d’abord un lieu dans le champ à gauche.',
  }
  const action = () =>
    actionBouton({
      accueil: document.body.classList.contains('ce-hub'),
      saisie: input.value,
      champActif: document.activeElement === input,
    })
  // déclarée en `function` : `go` l'appelle et est définie plus haut.
  function majBouton() {
    const quoi = action()
    gpx.setAttribute('data-tip', TIPS[quoi])
    // `go` porte les DEUX faces « Aller » ('aller' et 'focus') : le mot ne doit
    // pas changer sous le doigt au fil de la frappe — il changerait de largeur,
    // et la rangée liquide reposerait ses bulles à chaque lettre tapée
    // (LIBELLE_ACTION). L'accueil, lui, est traité en CSS (body.ce-hub) : il
    // n'émet aucun événement auquel s'accrocher.
    gpx.classList.toggle('go', quoi !== 'gpx')
  }
  majBouton()
  input.addEventListener('input', majBouton)
  input.addEventListener('focus', majBouton)
  input.addEventListener('blur', majBouton)
  // au survol aussi : l'accueil n'émet aucun événement, donc le tip d'un bouton
  // jamais touché depuis la montée de l'accueil serait resté celui de GPX.
  // tips.js relit `data-tip` au moment d'afficher la bulle, après un délai de
  // survol — le rafraîchir ici arrive toujours à temps.
  gpx.addEventListener('pointerenter', majBouton)
  // ⚠️ le clic sur un bouton commence par ARRACHER le focus du champ. Sans ce
  // preventDefault, le bouton changeait de visage ENTRE le mousedown et le
  // click : on cliquait « Aller » et on recevait le sélecteur de fichiers GPX.
  gpx.addEventListener('mousedown', (e) => { if (action() !== 'gpx') e.preventDefault() })
  gpx.addEventListener('click', () => {
    const quoi = action()
    // ⚠️ AUCUNE logique de navigation dupliquée ici : « Aller » rejoue
    // EXACTEMENT la soumission du champ (`go`), donc le même parseLatLon, le
    // même ctx.goto, le même vidage du champ en cas de succès.
    if (quoi === 'aller') return void go()
    // champ vide : le bouton renvoie au champ plutôt que de ne rien faire. Le
    // focus fait aussi redescendre l'accueil (hub.js écoute `focus`) — le
    // visiteur se retrouve donc devant la carte, curseur dans le champ, et le
    // bouton reste « Aller » puisque la recherche est maintenant éveillée.
    if (quoi === 'focus') return void focusSearch()
    ctx.openGpx()
  })

  bar.append(search, gpx)
  document.body.append(bar)
  return { root: bar, input, search, gpx }
}

function extLink(href, text, cls) {
  const a = el('a', cls)
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.textContent = text
  return a
}

// bottom-left: ONE line, ONE corner, ONE size — the studio credit plus every
// legally-required attribution. Adrien Agency + OpenStreetMap (ODbL, the
// fine-zoom z9–z15 coastline) are static; GeoNames (CC BY 4.0, gated to when
// place labels are actually showing) and the OSM loading status are appended
// live by main.js via setExtra() so nothing duplicates a second corner/size.
// Deliberately understated so it never competes with the relief, and clear of
// the isometric-view button (bottom-right).
// Chrome du VIEWER shibu (lien partagé) : la seule écriture à l'écran est la
// marque en bas — « ShibuMap, créé par Adrien Agency » (lien) avec les droits
// dessous — plus un CTA très visible « Toi aussi, crée ta ShibuMap ».
export function buildShibuChrome() {
  const cta = document.createElement('a')
  cta.className = 'shibu-cta'
  cta.href = 'https://shibumap.com'
  cta.target = '_blank'
  cta.rel = 'noopener'
  cta.innerHTML = 'Toi aussi, crée ta ShibuMap <span>→</span>'

  const foot = el('div', 'shibu-footer')
  const brand = document.createElement('a')
  brand.className = 'sf-brand'
  brand.href = 'https://adrienagency.com'
  brand.target = '_blank'
  brand.rel = 'noopener'
  brand.innerHTML = 'ShibuMap<i>.</i> — créé par Adrien Agency'
  // le viewer public porte les mêmes obligations d'attribution que l'app
  const rights = el('div', 'sf-rights', '© Adrien Agency · © OpenStreetMap contributors · © Mapterhorn · Bathymétrie GEBCO_2026')
  foot.append(brand, rights)

  document.body.append(cta, foot)
  return { cta, foot }
}

export function buildCredits() {
  const wrap = el('div', 'ce-credits')
  wrap.append(
    // « made by » plutôt que « © » : les crédits qui suivent (OSM, Mapterhorn,
    // GEBCO, GeoNames) sont des obligations de licence, celui-ci est une
    // signature. La distinction se voit mieux ainsi, et l'arobase renvoie au
    // compte plutôt qu'à une entité juridique.
    extLink('https://adrienagency.com', 'made by @AdrienAgency', 'ce-credit-link'),
    el('span', 'ce-credit-dot', '·'),
    extLink('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors', 'ce-credit-link'),
    el('span', 'ce-credit-dot', '·'),
    // Mapterhorn agrège les jeux nationaux d'altimétrie — RGE ALTI de l'IGN sous
    // Licence Ouverte 2.0, swissALTI3D, et une trentaine d'autres. Le crédit est
    // la contrepartie exigée par toutes ces licences.
    extLink('https://mapterhorn.com/attribution', '© Mapterhorn', 'ce-credit-link'),
    el('span', 'ce-credit-dot', '·'),
    // GEBCO — la bathymétrie mondiale. Le grid est dans le domaine public et
    // autorise explicitement l'usage commercial, mais ses conditions exigent de
    // citer la source ET de ne jamais laisser croire à un usage nautique :
    // l'avertissement complet vit dans l'Aide (voir tutorial/changelog).
    extLink('https://www.gebco.net', 'Bathymétrie GEBCO_2026', 'ce-credit-link')
  )
  const extraDot = el('span', 'ce-credit-dot', '·')
  extraDot.style.display = 'none'
  const extra = el('span', 'ce-credit-extra')
  wrap.append(extraDot, extra)
  document.body.append(wrap)

  return {
    root: wrap,
    // `infobulle` porte les ADRESSES DES SOURCES. Les licences CC-BY exigent la
    // mention à l'écran (c'est `text`), et les constantes `*_URL_SOURCE`
    // existaient depuis toujours sans être affichées nulle part : le survol est
    // le moyen le moins coûteux de les rendre atteignables sans allonger une
    // ligne de crédit déjà dense. `textContent` interdit un vrai lien ici, et
    // c'est volontaire — cette ligne reçoit des chaînes de fournisseurs.
    setExtra(text, infobulle) {
      extra.textContent = text || ''
      extra.title = infobulle || ''
      extraDot.style.display = text ? '' : 'none'
    },
  }
}
