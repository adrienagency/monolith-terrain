// Keyboard-shortcut registry — the single source of truth for every bound
// key in the app. `SHORTCUTS` is read live by both the input binder
// (bindShortcuts) and the help overlay (ui/shortcuts-overlay.js), so adding
// an entry here updates the binding AND the panel automatically.
//
// Each entry: { id, keys, label, category, run(ctx) } plus the private match
// spec used by matchShortcut — `code` (KeyboardEvent.code), and optional
// `ctrl`/`shift` booleans (default false = "must NOT be held"). `ctrl` is
// satisfied by either ctrlKey or metaKey, so Cmd works on macOS too.
//
// `key` (le CARACTÈRE imprimé) double `code` (la PLACE physique) partout où le
// raccourci est un moyen mnémotechnique : Z pour annuler, W pour water. C'est
// nécessaire, pas décoratif — `code` décrit la position en QWERTY, et sur un
// AZERTY Z et W sont permutés : la touche marquée Z envoie code 'KeyW'. Sans
// `key`, Ctrl+Z ne faisait RIEN chez un utilisateur français (le navigateur
// récupérait la combinaison et faisait son propre annuler, invisible ici) et
// c'est Ctrl+W qui annulait, à côté. Le pavé numérique et Espace/Échap gardent
// `code` seul : là, c'est bien la place qui porte le sens (Num 8 = nord parce
// qu'il est EN HAUT du pavé, quel que soit le chiffre imprimé dessus).
//
// `run(ctx)` calls into a handlers object built by main.js — every handler
// there is null-safe, so a shortcut firing before a feature is ready is
// always a harmless no-op.

export const SHORTCUTS = [
  // ---- Camera (numpad, spatial layout) ----
  { id: 'cam-top', keys: ['Num 5'], label: 'Top-down', category: 'Camera', code: 'Numpad5', run: (ctx) => ctx.cameraPreset('top') },
  { id: 'cam-north', keys: ['Num 8'], label: 'North', category: 'Camera', code: 'Numpad8', run: (ctx) => ctx.cameraPreset('north') },
  { id: 'cam-south', keys: ['Num 2'], label: 'South', category: 'Camera', code: 'Numpad2', run: (ctx) => ctx.cameraPreset('south') },
  { id: 'cam-west', keys: ['Num 4'], label: 'West', category: 'Camera', code: 'Numpad4', run: (ctx) => ctx.cameraPreset('west') },
  { id: 'cam-east', keys: ['Num 6'], label: 'East', category: 'Camera', code: 'Numpad6', run: (ctx) => ctx.cameraPreset('east') },
  { id: 'cam-nw', keys: ['Num 7'], label: 'Isometric NW', category: 'Camera', code: 'Numpad7', run: (ctx) => ctx.cameraPreset('nw') },
  { id: 'cam-ne', keys: ['Num 9'], label: 'Isometric NE', category: 'Camera', code: 'Numpad9', run: (ctx) => ctx.cameraPreset('ne') },
  { id: 'cam-sw', keys: ['Num 1'], label: 'Isometric SW', category: 'Camera', code: 'Numpad1', run: (ctx) => ctx.cameraPreset('sw') },
  { id: 'cam-se', keys: ['Num 3'], label: 'Isometric SE', category: 'Camera', code: 'Numpad3', run: (ctx) => ctx.cameraPreset('se') },
  { id: 'cam-home', keys: ['Num 0'], label: 'Home view', category: 'Camera', code: 'Numpad0', run: (ctx) => ctx.cameraPreset('home') },
  { id: 'cam-dolly-in', keys: ['Num +'], label: 'Dolly in', category: 'Camera', code: 'NumpadAdd', run: (ctx) => ctx.cameraPreset('dollyIn') },
  { id: 'cam-dolly-out', keys: ['Num −'], label: 'Dolly out', category: 'Camera', code: 'NumpadSubtract', run: (ctx) => ctx.cameraPreset('dollyOut') },

  // ---- Playback ----
  { id: 'play-toggle', keys: ['Space'], label: 'Play / pause', category: 'Playback', code: 'Space', run: (ctx) => ctx.togglePlay() },
  { id: 'play-stop', keys: ['Esc'], label: 'Stop', category: 'Playback', code: 'Escape', run: (ctx) => ctx.stopPlay() },

  // ---- History (undo/redo) ----
  { id: 'undo', keys: ['Ctrl', 'Z'], label: 'Undo', category: 'History', code: 'KeyZ', key: 'z', ctrl: true, run: (ctx) => ctx.undo() },
  { id: 'redo', keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo', category: 'History', code: 'KeyZ', key: 'z', ctrl: true, shift: true, run: (ctx) => ctx.redo() },
  { id: 'redo-y', keys: ['Ctrl', 'Y'], label: 'Redo', category: 'History', code: 'KeyY', key: 'y', ctrl: true, run: (ctx) => ctx.redo() },

  // ---- View / UI ----
  { id: 'toggle-ui', keys: ['H'], label: 'Hide / show UI', category: 'View', code: 'KeyH', key: 'h', run: (ctx) => ctx.toggleUI() },
  { id: 'toggle-dark', keys: ['D'], label: 'Dark mode', category: 'View', code: 'KeyD', key: 'd', run: (ctx) => ctx.toggleDark() },
  { id: 'reframe', keys: ['F'], label: 'Reframe / home', category: 'View', code: 'KeyF', key: 'f', run: (ctx) => ctx.reframe() },
  { id: 'toggle-shortcuts', keys: ['Shift', '?'], label: 'Shortcuts help', category: 'View', code: 'Slash', key: '?', shift: true, run: (ctx) => ctx.toggleShortcuts() },

  // ---- General ----
  { id: 'focus-search', keys: ['/'], label: 'Focus search', category: 'General', code: 'Slash', key: '/', run: (ctx) => ctx.focusSearch() },
  { id: 'open-export', keys: ['E'], label: 'Export', category: 'General', code: 'KeyE', key: 'e', run: (ctx) => ctx.openExport() },

  // ---- Layers (power-user toggles) ----
  { id: 'layer-roads', keys: ['R'], label: 'Toggle roads', category: 'Layers', code: 'KeyR', key: 'r', run: (ctx) => ctx.toggleLayer('roads') },
  { id: 'layer-water', keys: ['W'], label: 'Toggle water', category: 'Layers', code: 'KeyW', key: 'w', run: (ctx) => ctx.toggleLayer('water') },
  { id: 'layer-places', keys: ['P'], label: 'Toggle places', category: 'Layers', code: 'KeyP', key: 'p', run: (ctx) => ctx.toggleLayer('places') },
  { id: 'layer-contours', keys: ['C'], label: 'Toggle contours', category: 'Layers', code: 'KeyC', key: 'c', run: (ctx) => ctx.toggleLayer('contours') },
  { id: 'layer-grid', keys: ['G'], label: 'Toggle grid', category: 'Layers', code: 'KeyG', key: 'g', run: (ctx) => ctx.toggleLayer('grid') },
  { id: 'layer-region', keys: ['I'], label: 'Isolate the zone', category: 'Layers', code: 'KeyI', key: 'i', run: (ctx) => ctx.toggleRegion() },
]

// Pure — matches a KeyboardEvent-like { key, code, ctrlKey, metaKey, shiftKey }
// to its SHORTCUTS entry (or null). Deux passes, dans cet ordre :
//
//  1. par CARACTÈRE (`e.key`) sur les entrées qui déclarent `key`. C'est la
//     passe qui rend le registre indépendant de la disposition du clavier.
//     Une lettre se compare sans casse (Verr.Maj ne doit rien casser) et
//     vérifie shift ; un caractère de ponctuation ('/', '?') IGNORE shift,
//     parce qu'il porte déjà en lui la façon dont on l'a produit — « / » se
//     tape sans shift en QWERTY, avec en AZERTY, et c'est le même raccourci.
//  2. par POSITION (`e.code`), pour le pavé numérique, Espace et Échap.
//
// Quand l'événement porte un `key` exploitable, la passe 2 ignore délibérément
// les entrées à `key` : sinon la touche marquée Z d'un AZERTY (code 'KeyW')
// retomberait sur « basculer l'eau ». Les événements synthétiques sans `key`
// (tests, scripts) gardent l'ancien comportement positionnel intégral.
//
// Le ctrl requis (défaut false) est satisfait par ctrlKey OU metaKey, donc Ctrl
// et Cmd sont équivalents.
export function matchShortcut(e) {
  if (!e) return null
  const ctrl = !!(e.ctrlKey || e.metaKey)
  const shift = !!e.shiftKey
  const typed = typeof e.key === 'string' && e.key ? e.key : null

  if (typed) {
    for (const s of SHORTCUTS) {
      if (!s.key) continue
      if (isLetter(s.key)) {
        if (typed.toLowerCase() !== s.key) continue
        if (!!s.shift !== shift) continue
      } else if (typed !== s.key) continue
      if (!!s.ctrl !== ctrl) continue
      return s
    }
  }

  if (!e.code) return null
  for (const s of SHORTCUTS) {
    if (s.key && typed) continue // déjà jugée par le caractère, ci-dessus
    if (s.code !== e.code) continue
    if (!!s.ctrl !== ctrl) continue
    if (!!s.shift !== shift) continue
    return s
  }
  return null
}

const isLetter = (k) => k.length === 1 && k >= 'a' && k <= 'z'

// Attaches ONE keydown listener on window. Inert while focus is inside a
// text input/textarea/select/contenteditable — except Escape always gets
// through (so it can e.g. blur a field / close an overlay upstream), by
// simply letting it reach matchShortcut like any other key.
export function bindShortcuts(ctx) {
  window.addEventListener('keydown', (e) => {
    // boutique / studios ouverts : clavier app off (Échap géré par chaque mode)
    if (document.body.classList.contains('store-mode') || document.body.classList.contains('studio-mode') || document.body.classList.contains('atelier-mode')) return
    const t = document.activeElement
    const tag = t && t.tagName
    const isTextField = !!t && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable)
    if (isTextField && e.code !== 'Escape') return
    const m = matchShortcut(e)
    if (!m) return
    e.preventDefault()
    m.run(ctx)
  })
}
