// Per-zoom fine-detail defaults. At continental scale (z6 and wider) the DEM
// tiles are so resampled that the procedural FBM "fine detail" reads as fake
// stippling all over the plains (user feedback: the France example). So the
// default detail is forced to 0 for z4/z5/z6; z7 and finer keep the base value.
// A user-set value in the persistent store always wins, mirroring the per-zoom
// exaggeration logic in main.js.
export const DETAIL_DEFAULTS = { 4: 0, 5: 0, 6: 0 }

export function detailForZoom(zoom, store, base) {
  if (store[zoom] != null) return store[zoom]
  if (DETAIL_DEFAULTS[zoom] != null) return DETAIL_DEFAULTS[zoom]
  return base
}
