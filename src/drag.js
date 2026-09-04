// Draggable, magnetically-snapping FUI panels.
//
// - makeDraggable: grab a panel by its handle; first drag converts it to
//   explicit fixed left/top. While dragging, edges snap to the viewport and to
//   other panels (left-edge align + top-to-bottom stacking) so panels tuck
//   neatly under one another.
//
// ⚠️ 2026-09-04 — LES PANNEAUX PLIANTS SONT PARTIS D'ICI. `makeCollapsible`,
// `collapseAll` et `setUiHidden` — l'accordéon de l'ère « fenêtres flottantes »
// — n'étaient plus appelés par personne depuis que le shell tient l'accordéon
// lui-même (`ui/shell.js:87`, « exclusive column accordion »). Zéro référence
// dans src/, test/, scripts/, netlify/ ni index.html : seules leur propre
// déclaration et ces deux lignes de sommaire les nommaient encore. Le
// glissement des panneaux, lui, est bien vivant.

const registry = new Set() // all draggable panels

const SNAP = 11 // px — how close an edge must come to grab

// pure: snap `value` to the nearest candidate within `threshold`, else return
// value unchanged. Exported for tests.
export function nearestSnap(value, candidates, threshold = SNAP) {
  let best = threshold
  let out = value
  for (const c of candidates) {
    const d = Math.abs(value - c)
    if (d < best) {
      best = d
      out = c
    }
  }
  return out
}

// pull every dragged panel back into view after a window resize
export function reclampDraggables() {
  for (const el of registry) {
    if (!el.isConnected) {
      registry.delete(el)
      continue
    }
    if (el.style.left === '') continue // never dragged — still CSS-anchored
    const r = el.getBoundingClientRect()
    el.style.left = `${Math.min(Math.max(r.left, -el.offsetWidth * 0.6), window.innerWidth - el.offsetWidth * 0.4)}px`
    el.style.top = `${Math.min(Math.max(r.top, 0), window.innerHeight - 28)}px`
  }
}

// nearest snap for the dragged panel's proposed left/top, tested against the
// viewport edges and every other panel's edges
function snap(el, left, top) {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const xs = [16, window.innerWidth - w - 16]
  const ys = [16, window.innerHeight - h - 16]
  for (const other of registry) {
    if (other === el || !other.isConnected || other.style.display === 'none') continue
    const o = other.getBoundingClientRect()
    xs.push(o.left, o.right - w) // align left / right edges (the stacking column)
    ys.push(o.bottom + 6, o.top - h - 6, o.top) // tuck under / sit above / align tops
  }
  return { left: nearestSnap(left, xs, SNAP), top: nearestSnap(top, ys, SNAP) }
}

export function makeDraggable(el, handle = el) {
  registry.add(el)
  handle.classList.add('draggable-handle')
  let dragging = false
  let ox = 0
  let oy = 0

  handle.addEventListener('pointerdown', (e) => {
    // never hijack real controls living inside the handle
    if (e.target.closest('button, input, a, canvas, .mop-pal, .hud-x')) return
    dragging = true
    handle.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    el.style.left = `${r.left}px`
    el.style.top = `${r.top}px`
    el.style.right = 'auto'
    el.style.bottom = 'auto'
    el.style.transform = 'none'
    el.style.position = 'fixed'
    ox = e.clientX - r.left
    oy = e.clientY - r.top
    e.preventDefault()
  })

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const w = el.offsetWidth
    let left = Math.min(Math.max(e.clientX - ox, -w * 0.6), window.innerWidth - w * 0.4)
    let top = Math.min(Math.max(e.clientY - oy, 0), window.innerHeight - 28)
    ;({ left, top } = snap(el, left, top))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  })

  const end = (e) => {
    if (!dragging) return
    dragging = false
    handle.releasePointerCapture?.(e.pointerId)
  }
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}
