# MONOLITH EARTH — Orbital globe mode

**Date:** 2026-07-08 · **Status:** approved design, pending implementation plan

## Summary

Extend MONOLITH so that zooming out of the detailed terrain patch seamlessly hands over
to a full 3D planet — rendered in the **same vintage-topographic visual language** as the
terrain mode — which the user can orbit like Google Earth, then dive back into any other
location on the planet. Crossing the altitude threshold in either direction toggles the
expensive render effects and announces it with a FUI message.

**Locked requirement (user):** the globe keeps the existing MONOLITH visual identity —
hypsometric ramp, ocean bathymetry blues, contour lines, paper tint. No satellite imagery.

## Goals

1. Zoom out of surface mode → effects power down → orbital view of the whole planet.
2. Orbit the planet; elevation tiles stream in with more detail as the camera approaches.
3. Zoom in anywhere → at ~8 000 m camera altitude (Everest-class) the DEM loads, surface
   mode re-engages with full effects, announced by a FUI message.
4. Direct travel: paste `lat, lon` (Google-Maps format, one field) or search a place name
   (Nominatim) → the camera flies over the globe and dives into surface mode there.
5. Permanent FUI altimeter so the thresholds read as predictable, physical altitudes.

## Non-goals (this sub-project)

- GPX import / track following — separate spec (next sub-project; will reuse the orbital
  dive to fly to an imported track).
- True continuous LOD from orbit to 30 m terrain (Cesium-style). We do a **two-world
  handoff** disguised by motion, not a single continuous mesh.
- Real-time lighting parity between modes. The globe gets a simpler sun.

## Architecture

New modules; `main.js` gains a small mode-state machine but no large additions.

| Module | Responsibility |
|---|---|
| `src/geo.js` | Shared conversions: lat/lon ↔ Web-Mercator tile coords ↔ terrain world XZ ↔ globe sphere position. Single source of truth, also used later by GPX. |
| `src/globe.js` | The planet: quadtree tile streaming, curved patch meshes, terrarium-decoding topo shader, pole caps, orbital camera constraints. |
| `src/modes.js` | Mode state machine (`surface` ⇄ `orbital`), altitude computation, hysteresis thresholds, effect power-down/up, crossfade transitions, FUI announcements. |
| `src/goto.js` | `lat, lon` paste parsing, Nominatim search, orbit-and-dive camera choreography. |

### Globe rendering

- **Data:** the same AWS Terrain Tiles (terrarium PNG) used by `dem.js`, available z0–z14.
  No new provider, no key. Attribution unchanged.
- **Geometry:** quadtree of curved patches. Each visible tile is a sphere-section mesh
  (subdivided grid projected onto the ellipsoid-as-sphere, radius `R_GLOBE` scene units).
  Split/merge by screen-space-error: tiles subdivide when the camera is close, collapse
  when far. Practical ceiling in orbital mode: z7–z8 (finer detail belongs to surface mode).
- **Shader (the identity carrier):** patch fragments sample the raw terrarium texture and
  decode meters in-shader (`R*256 + G + B/256 − 32768`), then apply the **same visual
  recipe as `terrain.js`**: hypsometric ramp texture (reuse the baked ramp + user gradient
  stops), bathymetry below 0 m mapped to the ramp's low blues, slope tint, and contour
  lines (`fwidth`-antialiased, appearing only when tile resolution supports them). A faint
  paper-noise tint is baked into this shader (distinct from the postprocessing grain
  effect, which is off in orbital mode). One material shared by all patches, per-patch
  uniforms for tile UV transform.
- **Relief:** vertex displacement from the same terrarium texture with mild exaggeration
  (~×20 at planet scale) so mountain ranges read at continental distance; fades to 0 as
  tiles refine, since real relief is invisible at this scale anyway.
- **Poles:** Web-Mercator tiles stop at ±85.05°. Close each pole with a flat-colored cap
  matching the ramp's ice/high tone.
- **Tile lifecycle:** fetch queue with priority = screen-space error, LRU cache (~200
  decoded textures), abort in-flight fetches for collapsed tiles, placeholder = parent
  tile's texture with scaled UVs (no pop-in holes).

### Mode state machine & thresholds

- **Camera altitude** is the single driver. In surface mode: camera height above the DEM
  patch converted to real meters via the existing `scale` factor. In orbital mode:
  distance above the sphere surface converted via `R_GLOBE` ↔ Earth-radius ratio.
- **Hysteresis:** surface → orbital at **> 15 000 m** equivalent (user zooms past the
  current `maxDistance`, which becomes unlocked); orbital → surface at **< 8 000 m**.
  The gap prevents flapping at the boundary.
- **Surface → orbital:** FUI message `FX OFFLINE — ENTERING ORBITAL VIEW`; DOF pass
  disabled, shadows off, grain/bump/scan disabled (the cheap tone-map/vignette pass
  stays); terrain patch + HUD + labels fade out over ~1 s while the globe fades in,
  camera re-parented above the same lat/lon at matching apparent scale. GUI folders that
  only make sense on the surface are greyed out.
- **Orbital → surface:** crossing 8 000 m starts the DEM fetch for the lat/lon under the
  camera (existing `loadDem`, zoom from current GUI setting). While loading, a FUI
  `ACQUIRING SURFACE DATA…` message; camera glides to a hold. On ready: terrain rebuilds
  (existing `regenerateTerrain` path), globe fades out, effects re-enable,
  `FX ONLINE — SURFACE MODE ENGAGED`.
- **Altimeter:** permanent FUI readout (existing `hud2d` style) showing camera altitude
  in meters/kilometers; it doubles as the mode indicator (SURFACE / ORBITAL tag).

### Go-to (precise coordinates)

- One text field in *Terrain source*: accepts `45.8326, 6.8652` (any spacing, comma or
  space separated, optional N/S/E/W suffixes). Parse errors show inline, never throw.
- Optional name search via Nominatim (`https://nominatim.openstreetmap.org/search`,
  no key; respect 1 req/s and send a descriptive `User-Agent`). Failure → inline message,
  feature degrades gracefully offline.
- Travel choreography: if in surface mode, first power down to orbital; then great-circle
  arc to the target with altitude following a climb-cruise-descend profile; final descent
  crosses 8 000 m and triggers the normal orbital → surface engagement. One code path for
  paste, search, and (later) GPX dive.

## Error handling

- Tile fetch failures: retry once, then leave the parent texture in place (visible but
  not broken); log to console, no modal.
- DEM fetch failure during a dive: FUI message `SURFACE DATA UNAVAILABLE — HOLDING ORBIT`,
  camera stays orbital above 8 000 m.
- WebGL context limits: cap concurrent tile fetches (6) and decoded-texture cache; all
  disposed via LRU eviction.

## Performance

- Orbital mode must run with all heavy effects off; target 60 fps with ≤ ~300 patch
  draw calls (quadtree keeps visible set small; backface/horizon culling on patches).
- Surface mode is untouched when active — globe meshes are removed from the scene (not
  just hidden) while in surface mode; only the mode machine remains.

## Testing

- `geo.js` conversions: round-trip unit tests (lat/lon → tile px → world XZ → lat/lon)
  against known anchors (0,0; Everest; Mont Blanc; ±85° edges). Run with `node --test`.
- Quadtree split/merge: deterministic tests on synthetic camera positions.
- Manual test script in the spec's companion plan: zoom-out/zoom-in loop at the Alps,
  dateline crossing (lon ±180°), pole approach, offline tile failure (devtools), paste
  formats, Nominatim search, hysteresis (hover around the threshold).

## Follow-ups (out of scope, next specs)

1. **GPX sub-project** — import, draped track, hover cursor + altitude, elevation profile
   strip, fly-the-track tour, orbital dive to track.
2. Visual-polish and performance axes noted by the user (water/snow styling, main.js
   decomposition) — revisit after both sub-projects land.
