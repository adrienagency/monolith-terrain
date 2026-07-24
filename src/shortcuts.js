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
  { id: 'undo', keys: ['Ctrl', 'Z'], label: 'Undo', category: 'History', code: 'KeyZ', ctrl: true, run: (ctx) => ctx.undo() },
  { id: 'redo', keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo', category: 'History', code: 'KeyZ', ctrl: true, shift: true, run: (ctx) => ctx.redo() },
  { id: 'redo-y', keys: ['Ctrl', 'Y'], label: 'Redo', category: 'History', code: 'KeyY', ctrl: true, run: (ctx) => ctx.redo() },

  // ---- View / UI ----
  { id: 'toggle-ui', keys: ['H'], label: 'Hide / show UI', category: 'View', code: 'KeyH', run: (ctx) => ctx.toggleUI() },
  { id: 'toggle-dark', keys: ['D'], label: 'Dark mode', category: 'View', code: 'KeyD', run: (ctx) => ctx.toggleDark() },
  { id: 'reframe', keys: ['F'], label: 'Reframe / home', category: 'View', code: 'KeyF', run: (ctx) => ctx.reframe() },
  { id: 'toggle-shortcuts', keys: ['Shift', '?'], label: 'Shortcuts help', category: 'View', code: 'Slash', shift: true, run: (ctx) => ctx.toggleShortcuts() },

  // ---- General ----
  { id: 'focus-search', keys: ['/'], label: 'Focus search', category: 'General', code: 'Slash', run: (ctx) => ctx.focusSearch() },
  { id: 'open-export', keys: ['E'], label: 'Export', category: 'General', code: 'KeyE', run: (ctx) => ctx.openExport() },

  // ---- Layers (power-user toggles) ----
  { id: 'layer-roads', keys: ['R'], label: 'Toggle roads', category: 'Layers', code: 'KeyR', run: (ctx) => ctx.toggleLayer('roads') },
  { id: 'layer-water', keys: ['W'], label: 'Toggle water', category: 'Layers', code: 'KeyW', run: (ctx) => ctx.toggleLayer('water') },
  { id: 'layer-places', keys: ['P'], label: 'Toggle places', category: 'Layers', code: 'KeyP', run: (ctx) => ctx.toggleLayer('places') },
  { id: 'layer-contours', keys: ['C'], label: 'Toggle contours', category: 'Layers', code: 'KeyC', run: (ctx) => ctx.toggleLayer('contours') },
  { id: 'layer-grid', keys: ['G'], label: 'Toggle grid', category: 'Layers', code: 'KeyG', run: (ctx) => ctx.toggleLayer('grid') },
  { id: 'layer-region', keys: ['I'], label: 'Isolate the zone', category: 'Layers', code: 'KeyI', run: (ctx) => ctx.toggleRegion() },
]

// Pure — matches a KeyboardEvent-like { code, ctrlKey, metaKey, shiftKey } to
// its SHORTCUTS entry (or null). `code` must match exactly; the ctrl
// requirement (default false) is satisfied by EITHER ctrlKey or metaKey, so
// Ctrl and Cmd combos are equivalent; the shift requirement (default false)
// must match exactly, so a plain letter key never fires under Shift+letter
// unless a Shift entry explicitly claims that code.
export function matchShortcut(e) {
  if (!e || !e.code) return null
  const ctrl = !!(e.ctrlKey || e.metaKey)
  const shift = !!e.shiftKey
  for (const s of SHORTCUTS) {
    if (s.code !== e.code) continue
    if (!!s.ctrl !== ctrl) continue
    if (!!s.shift !== shift) continue
    return s
  }
  return null
}

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
