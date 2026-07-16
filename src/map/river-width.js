// Map a Natural Earth river `strokeweight` (cartographic stroke weight,
// nominally 0-9) to an on-screen line width in pixels. Missing/undefined
// falls back to a mid-weight default (2) so unrated rivers still render.
export function riverWidthPx(strokeweight) {
  const s = Math.max(0, Math.min(9, strokeweight ?? 2))
  return 0.8 + (s / 9) * 2.4
}
