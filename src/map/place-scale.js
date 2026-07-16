// Label scale factor from population — sizes the floating city-name sprites so
// the eye can RANK places at a glance, not merely read them.
//
// This used to be a continuous log curve (`0.7 + min(1.6, log10(p+10)/7*1.6)`),
// and it could not rank: it squeezed four orders of magnitude of population into
// a 1.94x spread, so a 12k town (1.632) sat within 46% of a regional capital
// (2.391). Names sprinkled rather than ranked — the single biggest thing making
// the render read templated rather than editorial.
//
// It also inverted. The ceiling clamped population at 10M, but the capital bonus
// multiplied AFTER it, so Shanghai (24.9M -> 2.300) rendered SMALLER than Paris
// (2.1M -> 2.684).
//
// Real maps use a few DISTINCT sizes, because discrete steps are what the eye
// sorts by. Six tiers, ~2.5x end to end, and population alone picks the tier so
// the order can never invert.
const TIERS = [
  [5e6, 2.85], // metropolis  — Shanghai, Delhi
  [1e6, 2.5],  // major metro — Paris, Lyon-scale agglomerations
  [2e5, 2.15], // city        — Geneva, Grenoble
  // 3e4, not 5e4: GeoNames carries COMMUNE population, not agglomeration, so a
  // real préfecture like Annecy reads 49k and a 5e4 floor dropped it into the
  // same tier as Chamonix (10.6k) — a 4.6x population gap rendering identical.
  [3e4, 1.8],  // large town  — Annecy
  [1e4, 1.45], // town        — Chamonix, Bellegarde
]
const VILLAGE = 1.15 // below 10k; popToMinZoom only reveals these when close in

// Population -> discrete tier INDEX, 0 = most important (metropolis) through
// TIERS.length = least (village). This is the single source of truth for
// "how important is this place" — labelScale (size) and text-label's slate
// ink ramp (colour) both key off it, so a place's size and colour darkness
// can never disagree with each other.
export function placeTier(pop) {
  const p = Math.max(0, pop || 0)
  for (let i = 0; i < TIERS.length; i++) {
    if (p >= TIERS[i][0]) return i
  }
  return TIERS.length // village
}

// A capital is a rank of function, not of size, so it gets a modest nudge rather
// than a multiplier that can leapfrog a whole tier. 1.12 is deliberately small
// enough that a capital never outsizes a genuinely bigger city: Paris
// (2.5 * 1.12 = 2.80) still reads under Shanghai (2.85). Capitals are already
// marked two other ways — weight 800 vs 700 (text-label.js), and popToMinZoom
// sending them to zoom 3 so they surface first (place-tier.js).
const CAPITAL_NUDGE = 1.12

export function labelScale(pop, capital) {
  const tier = placeTier(pop)
  const s = tier < TIERS.length ? TIERS[tier][1] : VILLAGE
  return capital ? s * CAPITAL_NUDGE : s
}
