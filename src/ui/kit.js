// ShibuMap UI kit — small DOM control factory for the v28 interface.
// Every control binds to a getter/setter pair (usually into `params`) and
// registers a refresh() so panels can re-sync after a template swap or
// reset without rebuilding the DOM.

export function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

// registry of live controls — call refreshAll() after params change in bulk.
// Entries carry their element so controls whose DOM has been removed (e.g.
// a closed export modal) are pruned instead of leaking forever.
const refreshables = new Set()
export function refreshAll() {
  for (const entry of refreshables) {
    if (entry.el && !entry.el.isConnected && entry.mounted) {
      refreshables.delete(entry)
      continue
    }
    if (entry.el && entry.el.isConnected) entry.mounted = true
    entry.fn()
  }
}
function track(fn, el) {
  refreshables.add({ fn, el, mounted: false })
  return fn
}
// registre public : les metas de section (et autres affichages passifs) se
// resynchronisent à chaque refreshAll, comme les contrôles
export function onRefresh(fn, el) {
  track(fn, el)
  fn()
}

const fmt = (v, step) => (step >= 1 ? Math.round(v) : +v.toFixed(step >= 0.1 ? 1 : 2))

export function slider({ label, min, max, step = 0.01, get, set }) {
  const root = el('div', 'ce-row')
  const lab = el('label', 'ce-label', label)
  const val = el('span', 'ce-val')
  const input = el('input', 'ce-slider')
  input.type = 'range'
  input.min = min
  input.max = max
  input.step = step
  const refresh = track(() => {
    input.value = get()
    val.textContent = fmt(get(), step)
    const t = ((get() - min) / (max - min)) * 100
    input.style.setProperty('--fill', `${t}%`)
  }, input)
  const commitUi = () => {
    val.textContent = fmt(get(), step)
    input.style.setProperty('--fill', `${((get() - min) / (max - min)) * 100}%`)
  }
  input.addEventListener('input', () => {
    set(parseFloat(input.value))
    commitUi()
  })
  refresh()
  // RÈGLE CONSTANTE (Adrien) : double-clic sur le curseur = retour à la
  // valeur de construction (le défaut au boot — supprime la peur de toucher).
  // 'change' déclenché pour les contrôles qui commitent au relâchement.
  const def = get()
  input.addEventListener('dblclick', () => {
    set(def)
    input.value = def
    commitUi()
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // RÈGLE CONSTANTE : clic sur la VALEUR = saisie clavier (Entrée valide,
  // Échap abandonne) — même geste que les lignes scrubbables de la barre.
  val.addEventListener('click', (e) => {
    e.stopPropagation()
    const inp = el('input', 'ce-val-edit')
    inp.type = 'number'
    inp.min = min
    inp.max = max
    inp.step = step
    inp.value = get()
    val.replaceWith(inp)
    inp.focus()
    inp.select()
    // commit DIRECT et idempotent — ne jamais dépendre de blur() (sans focus
    // réel il ne tire pas, et Enter+blur le doublerait)
    let done = false
    const commit = (cancel) => {
      if (done) return
      done = true
      if (!cancel) {
        const v = Math.min(max, Math.max(min, parseFloat(inp.value)))
        if (Number.isFinite(v)) {
          set(v)
          input.value = v
          input.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      inp.replaceWith(val)
      commitUi()
    }
    inp.addEventListener('blur', () => commit(false))
    inp.addEventListener('keydown', (ev) => {
      ev.stopPropagation()
      if (ev.key === 'Enter') commit(false)
      if (ev.key === 'Escape') commit(true)
    })
  })
  lab.append(val)
  root.append(lab, input)
  return root
}

export function color({ label, get, set }) {
  const root = el('div', 'ce-row ce-row-inline')
  const lab = el('label', 'ce-label', label)
  const input = el('input', 'ce-color')
  input.type = 'color'
  const refresh = track(() => (input.value = get()), input)
  input.addEventListener('input', () => set(input.value))
  refresh()
  root.append(lab, input)
  return root
}

// bare swatch (no label) — for the ramp strip
export function swatch({ title, get, set }) {
  const input = el('input', 'ce-color ce-swatch')
  input.type = 'color'
  input.title = title
  const refresh = track(() => (input.value = get()), input)
  input.addEventListener('input', () => set(input.value))
  refresh()
  return input
}

export function toggle({ label, get, set }) {
  const root = el('div', 'ce-row ce-row-inline')
  const lab = el('label', 'ce-label', label)
  const btn = el('button', 'ce-toggle')
  btn.type = 'button'
  const refresh = track(() => btn.classList.toggle('on', !!get()), btn)
  btn.addEventListener('click', () => {
    set(!get())
    btn.classList.toggle('on', !!get())
  })
  refresh()
  root.append(lab, btn)
  return root
}

export function select({ label, options, get, set }) {
  const root = el('div', 'ce-row ce-row-inline')
  const lab = el('label', 'ce-label', label)
  const sel = el('select', 'ce-select')
  for (const o of options) {
    const opt = el('option', null, typeof o === 'string' ? o : o.label)
    opt.value = typeof o === 'string' ? o : o.value
    sel.append(opt)
  }
  const refresh = track(() => (sel.value = get()), sel)
  sel.addEventListener('change', () => set(sel.value))
  refresh()
  root.append(lab, sel)
  return root
}

export function segmented({ label, options, get, set }) {
  const root = el('div', 'ce-row')
  if (label) root.append(el('label', 'ce-label', label))
  const wrap = el('div', 'ce-seg')
  const btns = options.map((o) => {
    const b = el('button', 'ce-seg-btn', typeof o === 'string' ? o : o.label)
    b.type = 'button'
    b.dataset.value = typeof o === 'string' ? o : o.value
    b.addEventListener('click', () => {
      set(b.dataset.value)
      sync()
    })
    wrap.append(b)
    return b
  })
  const sync = track(() => {
    for (const b of btns) b.classList.toggle('on', String(get()) === b.dataset.value)
  }, wrap)
  sync()
  root.append(wrap)
  return root
}

// conditionally shows/hides an element on every refreshAll() pass — for a
// control whose visibility depends on another control's value (e.g. a mode
// select shown only while its parent toggle is on), so it re-syncs after a
// template load or any other bulk params change.
export function visibleWhen(node, predicate) {
  const refresh = track(() => { node.style.display = predicate() ? '' : 'none' }, node)
  refresh()
}

export function button(label, onClick, { accent = false, ghost = false } = {}) {
  const b = el('button', `ce-btn${accent ? ' accent' : ''}${ghost ? ' ghost' : ''}`, label)
  b.type = 'button'
  b.addEventListener('click', onClick)
  return b
}

// icon button for bars (uses inline SVG string)
export function iconButton(svg, title, onClick) {
  const b = el('button', 'ce-icon-btn')
  b.type = 'button'
  b.title = title
  b.innerHTML = svg
  b.addEventListener('click', onClick)
  return b
}

// accordion section — panels keep exactly one open (managed by the panel).
// setMeta(text, swatch?) : les sections REPLIÉES parlent (pattern Lightroom,
// règle Adrien) — l'en-tête affiche l'état courant (« Marbre blanc », « ×4 »)
// avec une micro-pastille optionnelle (couleur ou gradient CSS).
export function section(title, { open = false } = {}) {
  const root = el('div', 'ce-section')
  const head = el('button', 'ce-section-head')
  head.type = 'button'
  const meta = el('span', 'ce-section-meta')
  head.append(el('span', 'ce-section-title', title), meta, el('span', 'ce-chev'))
  const body = el('div', 'ce-section-body')
  root.append(head, body)
  root.classList.toggle('open', open)
  const setMeta = (text, swatch) => {
    meta.replaceChildren()
    if (swatch) {
      const dot = el('i', 'ce-section-swatch')
      dot.style.background = swatch
      meta.append(dot)
    }
    if (text) meta.append(document.createTextNode(text))
  }
  return { root, head, body, setMeta, get open() { return root.classList.contains('open') }, setOpen: (v) => root.classList.toggle('open', v) }
}
