// Per-zoom fine-detail defaults. At continental scale (z6 and wider) the DEM
// tiles are so resampled that the procedural FBM "fine detail" reads as fake
// stippling all over the plains (user feedback: the France example). So the
// default detail is forced to 0 from the STAIRCASE FLOOR up to z6; z7 and finer
// keep the base value. A user-set value in the persistent store always wins,
// mirroring the per-zoom exaggeration logic in main.js.
//
// ⚠️ z3 A MANQUÉ À CETTE TABLE, et c'était le pire endroit où manquer. La table
// a été écrite quand le plancher de l'escalier était z4 ; le jour où il est
// descendu à z3, le moutonnement FBM s'est rallumé au niveau LE PLUS
// CONTINENTAL qui existe (mesuré : `detailForZoom(3)` rendait 0,02 contre 0 pour
// z4, z5 et z6), sans que rien ne rougisse nulle part.
//
// C'est pour ça que le test s'écrit contre `ZOOM_PALIER_MIN` et non contre le
// littéral 3 : le prochain déplacement du plancher, lui, rougira.
export const DETAIL_DEFAULTS = { 3: 0, 4: 0, 5: 0, 6: 0 }

export function detailForZoom(zoom, store, base) {
  if (store[zoom] != null) return store[zoom]
  if (DETAIL_DEFAULTS[zoom] != null) return DETAIL_DEFAULTS[zoom]
  return base
}
