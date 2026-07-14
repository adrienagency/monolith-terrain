# Design — user templates, drone-view GPX follow, known-race info bubble

Date: 2026-07-14 · Status: approved (design), drone params pending deep-research.

Three independent features, shipped together.

## 1. User templates (save / export / import, with thumbnails)

**Goal:** let the user snapshot the current *look*, save/export it, feed templates
back in, and pick from a card list with a mini preview — without me taking
screenshots. Applying a template must NOT move the view (location/camera stay).

**Captured state (the "look"):** a whitelist of `params` keys covering palette,
map style, grid/contours, background, light, surface, post effects, socle
material (plinth*), relief material (terrainSurfaceMat + glass/opaque knobs),
liquid metal (lm*), surface shader (surfaceFx + params.fx), clouds, water,
darkMode. **Excluded:** demLat/demLon/demZoom/demLocation, camera pose, source,
regionMode, GPX, per-zoom exaggeration (owned by the zoom model). A single
`TEMPLATE_KEYS` array is the source of truth; capture = pick those keys, apply =
assign them back then re-run the appropriate `apply*`/setters + `refreshAll()`.

**Thumbnail:** render the live composer to an offscreen 160×90 canvas (drawImage
from the WebGL canvas), `toDataURL('image/jpeg', 0.7)`. Stored on the template.

**Storage:** `localStorage['shibumap-user-templates']` = array of
`{ id, name, thumb, params }`. Loaded at boot, merged into the Templates section
as cards (thumbnail + name), after the built-in template cards. Each user card:
click = apply; small ✕ = delete; small ⭳ = export.

**Export:** download `<name>.shibumap-template.json` =
`{ format:'shibumap-template', version:1, name, thumb, params }`.

**Import:** "Load template…" button (file input, accepts .json) + drag-drop onto
the panel. Parse, validate `format`, add to localStorage + the card list.

**Files:** new `src/templates-user.js` (pure-ish: TEMPLATE_KEYS, capture(params),
serialize/deserialize, localStorage load/save). Thumbnail + apply wiring in
main.js. Card UI in create-panel.js Templates section.

## 2. Drone-view GPX follow (terrain-aware cinematic camera)

**Goal:** replace the current GPX "Fly the track" with a cinematic drone follow
that never flies into terrain, stays at a natural altitude (not too high/low),
and respects the GPX direction. Final numeric parameters come from the running
deep-research; the architecture:

- **Path prep:** parse GPX → world-space polyline (existing) → resample to even
  arc-length spacing → smooth (Catmull-Rom centripetal, matching the tour
  controller). Direction preserved from point order.
- **Subject:** a point advancing along the smoothed path at eased speed.
- **Camera:** chase offset behind (opposite the tangent) + above the subject;
  look-at a look-ahead point further along the path. Spring/lerp smoothing.
- **Terrain clearance:** sample the heightfield under the camera (terrain.sample)
  to hold a target clearance; raycast camera→subject against terrain and lift the
  camera above any occluding ridge so the subject stays visible and the camera
  never enters relief.
- **Banking:** roll into turns from local path curvature; ease speed on tight
  turns. Elevation gain/loss handled by the terrain-following altitude.
- Reuses the existing tour/flyTrack timing loop; the camera-pose function is the
  new part. New `src/drone-cam.js` (pure path math + pose solver, unit-testable);
  wired into the GPX fly in gpx.js / main.js.

## 3. Known-race info bubble (live Wikipedia)

**Goal:** on GPX load, if a big race/event (>~10k total participants, any sport)
exists at that location, let the user open a closable info bubble; if several,
let them choose or close.

- **Detect:** from the GPX track centre (lat/lon), Wikipedia GeoSearch (reuse the
  ground-info Wikipedia client) for nearby pages; keep those whose title/summary/
  categories read as a sporting event/race (marathon, trail, ultra, course,
  cyclosportive, triathlon, race, etc.). Rank by proximity + notability
  (participant/field-size hints in the summary).
- **Offer:** a discreet prompt/badge "Course détectée — voir les infos" after a
  GPX loads. Dismissable.
- **Choose:** if >1 candidate, the bubble opens on a small list; the user picks
  one or closes.
- **Show:** name, summary (difficulty/terrain), main winners (men/women) if
  present in the extract, and general advice — sourced from the Wikipedia page
  extract (no invented facts; if a field isn't found, it's omitted). Link to the
  article. Closable ✕, same glassmorphism as other panels.
- **Files:** new `src/race-info.js` (Wikipedia queries + event filtering, no DOM)
  + `src/ui/race-panel.js` (the bubble). Triggered from the GPX load path.

## Cross-cutting

- No new runtime deps. Wikipedia via the existing fetch client. Textures/thumbs
  stay client-side. Tests: template capture/serialize round-trip, drone path
  resample/smooth + clearance solver, race-event filter — all pure, node --test.
- Ship incrementally: templates + race bubble first, drone cam once the research
  lands (its numbers tune the pose solver).
