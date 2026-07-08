// Make any FUI panel draggable by a handle. First drag converts the panel to
// explicit left/top positioning (whatever corner anchors or transforms it had
// are dropped), then it follows the pointer, clamped to the viewport.

export function makeDraggable(el, handle = el) {
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
    const h = el.offsetHeight
    el.style.left = `${Math.min(Math.max(e.clientX - ox, -w * 0.6), window.innerWidth - w * 0.4)}px`
    el.style.top = `${Math.min(Math.max(e.clientY - oy, 0), window.innerHeight - 28)}px`
  })

  const end = (e) => {
    if (!dragging) return
    dragging = false
    handle.releasePointerCapture?.(e.pointerId)
  }
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}
