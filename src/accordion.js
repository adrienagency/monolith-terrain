// Accordion helper for lil-gui folders — pure logic so the "only one open"
// invariant is testable without a DOM. A folder is anything with a synchronous
// `_closed` flag and a `close()` method (lil-gui folders qualify). We key off
// `_closed` rather than the DOM `closed` class because lil-gui flips that class
// inside a requestAnimationFrame, which reads stale in a click handler.

// Fold every folder except `opened`.
export function foldOthers(folders, opened) {
  for (const f of folders) if (f !== opened && !f._closed) f.close()
}

// Enforce "only one open" for the folder that was just toggled: if it is now
// open, fold the rest; if it just closed, leave everything alone. Safe to call
// from a title-click listener OR after a programmatic open().
export function openExclusive(folders, folder) {
  if (folder._closed) return // this folder is closed — nothing to enforce
  foldOthers(folders, folder)
}
