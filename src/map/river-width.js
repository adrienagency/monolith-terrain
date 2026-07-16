// Map a Natural Earth river `strokeweig` (its cartographic stroke-weight hint)
// to an on-screen line width in pixels, so rivers get a realistic natural width
// instead of one arbitrary stroke.
//
// The REAL range in ne_10m_rivers (measured over the shipped 10 771 features) is
// 0.1 → 2.0, heavily skewed to the low end: median 0.2, p90 0.25, and only the
// top ~1% reach 1–2 (the big trunk rivers). A linear map would therefore render
// ~95% of rivers at the minimum. A sqrt curve spreads that dense low end, so
// small streams stay fine and hairline-distinct while trunk rivers read wide.
export const SW_MIN = 0.1
export const SW_MAX = 2

export function riverWidthPx(strokeweight) {
  const sw = Math.max(SW_MIN, Math.min(SW_MAX, Number.isFinite(strokeweight) ? strokeweight : 0.2))
  const t = (sw - SW_MIN) / (SW_MAX - SW_MIN) // 0..1
  return 0.9 + 2.6 * Math.sqrt(t) // 0.9 px (rill) → 3.5 px (trunk river)
}
