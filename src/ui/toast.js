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

// A notice sits in the MIDDLE of the view and says something the toast can't:
// a thing you asked for cannot be delivered here. That's a different weight of
// message from "link copied", so it gets a different place on screen and a
// longer dwell — you have to be able to read a sentence, not just glimpse it.
//
// Separate element from the toast on purpose: the two can legitimately be on
// screen at once (publish a link, discover the photo layer has no coverage),
// and sharing one node would make the second silently eat the first.
let noticeEl = null
let noticeTimer = null

export function showNotice(text, { duration = 5200 } = {}) {
  if (!noticeEl) {
    noticeEl = el('div', 'ce-notice')
    // aria-live so a screen reader announces it: the message is the only
    // signal that a toggle the user just flipped did nothing.
    noticeEl.setAttribute('role', 'status')
    noticeEl.setAttribute('aria-live', 'polite')
    document.body.append(noticeEl)
  }
  noticeEl.textContent = text
  clearTimeout(noticeTimer)
  noticeEl.classList.remove('show')
  void noticeEl.offsetWidth // reflow — restart the transition mid-flight
  noticeEl.classList.add('show')
  noticeTimer = setTimeout(() => noticeEl.classList.remove('show'), duration)
}
