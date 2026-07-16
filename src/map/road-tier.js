// Relative road tiering: instead of filtering on ABSOLUTE OSM/Natural-Earth
// classes (which renders empty when a patch has no motorway), we rank
// whatever road classes are actually PRESENT and renumber them densely from
// 0. Whatever the most important class present is becomes tier 0 — on an
// alpine valley with no motorway, the nationals (primary) become tier 0.

// OSM highway=* value → absolute importance rank, 0 = most important.
// _link suffixes (motorway_link, primary_link, …) rank with their parent.
export function roadRank(highway) {
  const h = String(highway || '').replace(/_link$/, '')
  if (/^(motorway|trunk)$/.test(h)) return 0
  if (h === 'primary') return 1
  if (h === 'secondary') return 2
  if (h === 'tertiary') return 3
  if (/^(unclassified|residential|living_street)$/.test(h)) return 4
  if (h === 'service') return 5
  if (/^(track|path|footway|cycleway|bridleway|steps)$/.test(h)) return 6
  return 7
}

// Given the absolute ranks actually present in a patch, renumber them
// densely from 0 in ascending order. This is what makes "les nationales
// deviennent les voies de niveau 1" true: if rank 0 (motorway) never
// appears, rank 1 (primary) becomes tier 0.
export function relativeTiers(ranks) {
  const present = [...new Set(ranks)].sort((a, b) => a - b)
  const tiers = new Map()
  present.forEach((rank, i) => tiers.set(rank, i))
  return tiers
}

// Roads-detail notch → how many relative tiers to show. Detail 3 stays
// unrestricted (matches today's "always works" behaviour).
export function tierDepth(detail) {
  if (detail >= 3) return Infinity
  return detail >= 2 ? 4 : 2
}
