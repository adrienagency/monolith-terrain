# Clean Earth — UI v28 design spec

Goal: Figma-grade simplicity. Three zones, one job each. Sober, elegant,
light glassmorphism. Every control earns its place or gets cut.

## Information architecture

```
┌────────────────────────────────────────────────────────────┐
│ ◍ Clean Earth      SURFACE 28 km       ⬡Globe ◐Dark ⌄Hide │  top bar
│                                                    ⇪Export │
│ ┌─────────┐                                    ┌──────────┐│
│ │ EXPLORE │                                    │  CREATE  ││
│ │ places  │                                    │ Style ▸  ││
│ │ …       │                                    │ Camera ▸ ││
│ │ SCAN    │                                    │          ││
│ │ ▷ types │                                    │          ││
│ └─────────┘                                    └──────────┘│
│                                                            │
│            ┌────────────────────────────────┐              │
│            │ ⌕ Search a place… or lat, lon  ⊕GPX │         │  bottom bar
│            └────────────────────────────────┘              │
└────────────────────────────────────────────────────────────┘
```

- **Top bar** (glass pill, top center-spanning row):
  - left: wordmark **Clean Earth** (replaces EXPERIMENT / 001)
  - center: live readout (SURFACE · altitude) — content, not chrome
  - right: **Globe** (full globe view via modes.enterOrbit), **Export**,
    **dark-mode toggle**, **hide UI** (eye). Hide-UI leaves ONE floating
    eye button.
- **Bottom bar** (glass pill, centered): the *finding* zone. One input —
  place name (Nominatim) or "lat, lon" — Enter flies there. A **GPX**
  button on its right opens the file picker (drag&drop stays).
- **Right panel — CREATE**: everything that makes the map. Two tabs
  (Figma Design/Prototype analogy): **Style** and **Camera**.
  - Style sections (accordion, one open):
    Templates (cards) · Colors (ramp 8 + oceans + inks, "shuffle") ·
    Map style (tint/contrast/pivot/slope, contours, grid) ·
    Terrain (vertical scale per zoom, detail) · Clouds · Water glass ·
    Light (sun, ambient, shadows) · Block (corners, cartouche, side text) ·
    Effects (exposure/contrast/saturation/grain/vignette)
  - Camera tab: fov, bokeh, focus distance/range, autofocus,
    motion (orbit/pause/speed), fly-the-track when a GPX is loaded.
- **Left panel — EXPLORE**: curated most-beautiful places (existing
  landmarks data, grouped by continent, click = fly) + **SCAN** section:
  4 scan types as small cards + one trigger button.
- Panels: docked left/right, glass cards. Drag → magnetic snap to docks
  (reuse nearestSnap, stronger threshold). Auto-collapse: opening one
  section folds the others; panels collapse to a slim icon rail via
  their header chevron; clicking the canvas doesn't steal panels.

## Design tokens (style.css)

- Fonts: Bricolage Grotesque (UI), mono stack for numbers/coords.
- Radius: 16 (panels), 12 (rows), 999 (pills).
- Glass light: bg rgba(252,252,253,.62), border rgba(255,255,255,.5),
  blur 20px saturate(1.5), shadow 0 10px 40px rgba(20,24,35,.10).
- Glass dark: bg rgba(22,24,28,.58), border rgba(255,255,255,.08),
  same blur, shadow 0 10px 40px rgba(0,0,0,.45).
- Ink light #1c1e22 / dark #e8e9ec; muted 55% opacity.
- Accent: single restrained accent (existing orange, desaturated to
  #e8622c), used ONLY for active states and the scan trigger.
- Controls: 28px row height, 12px label size, slider = 2px track +
  12px knob, all neutral; color swatches 18px rounded squares.

## Export

Top-right button → glass modal:
- Format: PNG / JPEG / MP4 (segmented)
- Ratio: 16:9 · 9:16 · 1:1 · 4:5 · Screen
- Size: 1080p / 1440p / 4K-ish per ratio (longest edge select)
- MP4: duration (3/5/10 s) + fps 30/60 — records exactly what moves
  (drift, clouds, orbit) by rendering offline at fixed timestep.
- Implementation: temporarily resize renderer+composer to WxH,
  camera.aspect = W/H, render, capture (toBlob / WebCodecs), restore.

## Scan

ScanController (src/scan.js) drives uniforms injected in terrain shader:
uScanMode (0 off), uScanT (0→1), uScanOrigin (world xz), uScanColor.
Types: radar sweep · elevation slice · scanline grid · sonar pulse.
Trigger from Explore panel; origin = current controls.target.

## Removals (tri)

- lil-gui sidebar entirely (replaced by Create panel)
- SECTOR / TELEMETRY placeholder panels
- MAP OVERLAY panel (its unique bits — templates, shuffle palette/style —
  move into Create ▸ Templates/Colors)
- MOTION bottom panel (merges into Create ▸ Camera)
- "MONOLITH / experiment 001" DOM overlay → replaced by top bar wordmark
- burger/ui-bar (replaced by top bar hide-UI)

## Keep (rewired)

goto (Nominatim + coords), GPX import/profile/fly, landmarks data,
altimeter readout, fui announce messages, dark mode plumbing
(setDarkMode), monochrome? (fold into Templates as two cards),
ground cartouche toggle, peaks layer, per-zoom exaggeration logic.
