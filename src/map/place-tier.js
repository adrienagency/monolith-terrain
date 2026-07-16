// Population -> minimum zoom level at which a place's label should reveal.
// Capitals always win regardless of population so national capitals show
// early even when small. Bands widen as population drops so villages only
// appear once the camera is close.
//
// Source data is GeoNames cities1000 (population > 1000, untruncated — see
// build-places.mjs), so the floor a band can rely on is ~1,000, not the old
// cities5000-and-top-40k-only floor of ~12,000. That earlier floor is why
// the two deepest bands (12, 13) used to be dead code: no row in the
// shipped file could ever have a low enough population to reach them.
//
// Zoom -> approximate DEM patch width (3-tile patch, ~45°N, see dem.js /
// geo.js metersPerPixel): z3≈10,600km z4≈5,300km z6≈1,300km z8≈330km
// z9≈165km z10≈83km z11≈41km z12≈21km z13≈10km.
//
// Band design:
// - capital: always 3 — national capitals should be visible from orbit.
// - >=1e6 (mega city): 4 — global metros, visible almost immediately.
// - >=2e5 (major city): 6 — regional capitals / large cities.
// - >=5e4 (city): 8 — sizeable cities, ~330km view.
// - >=2e4 (medium town, e.g. Annecy at 49,232): 9 — this is the band the
//   bug report called out: a well-known medium town must be visible at a
//   ~180km view, and z9's ~165km patch width lands squarely there. The old
//   >=5e4 cutoff of 8 swallowed Annecy-sized towns into the wrong band and
//   the old >=1e4 cutoff of 10 (~83km) hid them until zoomed in far closer
//   than a viewer would expect.
// - >=1e4 (small town): 10 — ~83km view.
// - >=5e3 (large village, e.g. Chamonix-Mont-Blanc at ~8,600): 11 — ~41km.
// - >=2e3 (village): 12 — ~21km, now reachable since cities1000 actually
//   contains rows in this range (cities5000 + top-40k truncation did not).
// - else (hamlet, population 1,000-2,000): 13 — deepest zoom only, ~10km
//   view. Also reachable now for the same reason.
export function popToMinZoom(pop, capital) {
  if (capital) return 3
  if (pop >= 1e6) return 4
  if (pop >= 2e5) return 6
  if (pop >= 5e4) return 8
  if (pop >= 2e4) return 9
  if (pop >= 1e4) return 10
  if (pop >= 5e3) return 11
  if (pop >= 2e3) return 12
  return 13
}
