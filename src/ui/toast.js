// Tiny transient toast — bottom-centre, announces itself and fades on its
// own. Introduced for the Share button's "link copied" / "GPX not included"
// feedback; nothing else in the app needed a notification before, so this
// stays a single reusable element rather than a queue/stack.

import { el } from './kit.js'

let toastEl = null
let hideTimer = null

export function showToast(text, { duration = 2800 } = {}) {
  if (!toastEl) {
    toastEl = el('div', 'ce-toast')
    document.body.append(toastEl)
  }
  toastEl.textContent = text
  clearTimeout(hideTimer)
  toastEl.classList.remove('show')
  void toastEl.offsetWidth // reflow — restarts the CSS transition even if a toast is already showing
  toastEl.classList.add('show')
  hideTimer = setTimeout(() => toastEl.classList.remove('show'), duration)
}
