// Population -> minimum zoom level at which a place's label should reveal.
// Capitals always win regardless of population so national capitals show
// early even when small. Bands widen as population drops so villages only
// appear once the camera is close.
export function popToMinZoom(pop, capital) {
  if (capital) return 3
  if (pop >= 1e6) return 4
  if (pop >= 3e5) return 6
  if (pop >= 5e4) return 8
  if (pop >= 1e4) return 10
  if (pop >= 2e3) return 12
  return 13
}
