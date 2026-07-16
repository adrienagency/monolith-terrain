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

// Roads-detail notch + demZoom → how many relative tiers to show.
//
// Depth counts RELATIVE tiers from relativeTiers (tier 0 = the most
// important class actually PRESENT), so depth 1 keeps only the backbone
// class, and Infinity keeps everything the active source returned.
//
// Zoom bands mirror the demZoom -> patch-width measurements from the task-7
// bug report (demZoom 9 = 181 km, 10 = 91 km, 11 = 46 km, 12 = 24 km,
// halving again for each step past 12). Two problems drove this table:
//   - Far out, notch 3 used to be unrestricted at EVERY zoom. Once the OSM
//     tier switch is decoupled from the notch (see roads-layer.js /
//     OSM_MIN_ZOOM), notch 3 turns on full OSM data at the same zoom as the
//     other notches — at a 91 km bbox that measured 43,943 raw segments
//     with no cap, i.e. exactly the reported "trop de détail" complaint.
//     So every notch, including 3, must stay capped while the patch is
//     still wide.
//   - Zoomed in, each notch should open progressively toward tracks/paths
//     rather than jumping straight from "capped" to "everything": the
//     patch area shrinks roughly 4x per zoom step (width halves), so a
//     segment budget that was too dense at z10 is comfortably sized by z12.
// notch1/notch2 plateau at their pre-existing constant depths (2 and 4) —
// those were never reported broken — and only ramp up between the far and
// mid bands so they aren't stuck at 1 forever. notch3 is the one that must
// go from capped (far/mid) to fully unrestricted (closest zooms), matching
// the user's confirmation that notch 3 "looks right" once zoomed in; that
// behaviour must not regress.
//   demZoom <= 9  (>=181 km patch): [1, 1, 2]  — backbone-only for all
//   demZoom 10-11 (46-91 km patch): [2, 3, 4]  — the exact band that was
//                                    either empty (notches 1/2) or flooded
//                                    (notch 3) before this fix
//   demZoom == 12 (24 km patch):    [2, 4, 6]  — opening up; patch is ~4x
//                                    smaller than the z10-11 band so a
//                                    richer cap is still legible
//   demZoom >= 13 (<12 km patch):   [2, 4, Infinity] — notch1/2 at their
//                                    old constant depths, notch3 unrestricted
const ZOOM_BANDS = [
  { maxZoom: 9, depths: [1, 1, 2] },
  { maxZoom: 11, depths: [2, 3, 4] },
  { maxZoom: 12, depths: [2, 4, 6] },
]
const CLOSE_DEPTHS = [2, 4, Infinity] // demZoom >= 13

export function tierDepth(detail, zoom = 12) {
  const notchIdx = detail >= 3 ? 2 : detail >= 2 ? 1 : 0
  const band = ZOOM_BANDS.find((b) => zoom <= b.maxZoom)
  return (band ? band.depths : CLOSE_DEPTHS)[notchIdx]
}
