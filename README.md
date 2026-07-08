# MONOLITH — interactive 3D topographic map

An interactive, real-time 3D terrain map in the style of a vintage USGS topographic sheet, crossed with a sci-fi FUI overlay. Load **real-world elevation data** for anywhere on Earth, or generate procedural mountain ranges — then explore them with contour lines, hypsometric tinting, survey grids, spot elevations, clickable peak markers, radar scans, and cinematic camera tours.

Zoom all the way out and the map hands over to **MONOLITH EARTH** — the whole planet rendered in the same vintage-topo language. Orbit it like a satellite, then dive back down anywhere: crossing ~8 000 m re-engages the full-effects surface mode. Drop a **GPX file** on the page to see your track draped over the real relief, with a live altitude cursor, an elevation profile, and a cinematic fly-along.

**Live demo:** https://kaolti.github.io/monolith-terrain/

## How to use

| Action | How |
|---|---|
| Look around | Drag to orbit, scroll to zoom, right-drag to pan |
| See the planet | Keep zooming out — effects power down and the orbital view takes over (or **Terrain source → 🌍 view planet**) |
| Return to the surface | Zoom in anywhere and stop — the terrain loads at the scale you stopped at: **~180 km → z8 regional patch (Madagascar-sized), ~45 km → z10, under ~8 000 m → full detail** |
| Go deeper | On a regional patch, zoom against the near stop — the map **refines** two zoom steps at a time (z8 → z10 → z12) |
| Restyle the map | **MAP OVERLAY** panel (left): random palette / relief style / grid-contour, or pick from the generated palette list |
| Name the summits | **MAP OVERLAY → ▲ TOP-5 PEAKS** — the five highest named peaks of the patch, altitude underneath (OSM data) |
| Clouds | **Clouds** folder — sparse drifting puffs with soft ground shadows, on/off |
| Go somewhere exact | **Terrain source → go to "lat, lon"** (paste straight from Google Maps) or **search place** — the camera flies there over the globe and dives |
| Load a GPX track | Drag & drop a `.gpx` anywhere on the page (or **GPX track → import**) — the map recenters and drapes the track |
| Read the track | Hover the line (or the elevation profile strip) — altitude, distance and grade follow your pointer |
| Fly your track | **GPX track → ▶ fly the track** — a cinematic flight along the route |
| Inspect a peak / basin | Click a `PK-xx` / `DEP-xx` marker — the camera flies in and a data panel opens |
| Go back | Click ✕ on the panel — the camera returns to where you were |
| Cinematic flyover | Open **Tour**, pick *from* / *to*, press **▶ start tour** (drag to cancel mid-flight) |
| Radar scan | **HUD → trigger scan** — a wave sweeps the terrain and physically lifts the surface |
| Change location | **Terrain source → location** presets, or *Custom* + latitude/longitude, then **load location** |
| Save your settings | **copy parameters** puts the full state on your clipboard as JSON |

### Terrain sources

- **real world (DEM)** — fetches elevation tiles for the chosen coordinates and rebuilds the map with true landforms. Spot elevations and peak data show real values.
  - **detail (zoom)** — z8–14: how large an area you get (z8 ≈ 470 km across, z10 ≈ 117 km, z12 ≈ 28 km, z13 ≈ 14 km)
  - **vertical scale** — relief exaggeration; real proportions read flat at map scale, so 1.5–3 is typical
  - **bathymetry** — below sea level the map reads as a nautical chart: pale shallows deepening into dark water, real depths (try the Mariana Trench: `11.35, 142.2`). Ocean colors live in **Map overlay** and follow the palette.
- **procedural noise** — seeded multi-octave simplex terrain with a hovering monolith and an excavated instrument basin. Every knob (octaves, warp, amplitude…) is live.

### Orbital view (MONOLITH EARTH)

The planet is built from the same AWS terrarium elevation tiles, streamed on demand through a quadtree (z2 at planet scale, z11 near the ground) and drawn by a shader that keeps the map's identity: the **land gradient you set in Map overlay**, bathymetric blues below sea level, contour lines that fade in as tiles refine, a 10° graticule and soft sun shading. Expensive effects (depth of field, shadows, grain) power down in orbit — a FUI message announces each handoff, and the permanent **altimeter** (bottom right) shows where you are. Relief exaggeration and contour styling live in the **Globe** folder.

### GPX tracks

Import creates an accent-colored line draped on the relief with `▶ START` / `■ END` markers, plus an interactive **elevation profile** (total distance, climb, min–max). Hovering either the 3D line or the profile drives a shared cursor with **real altitude, km from start and local grade**. Loading a track while in orbit flies the globe to it and dives automatically. Tracks with no `<ele>` data fall back to terrain elevations.

### Parameter folders

**Map overlay** (hypsometric gradient stops, contour interval/color, survey grid) · **Surface material** (roughness, micro bump) · **Camera & focus** (real depth of field with autofocus) · **Look** (exposure, contrast, grain, fog) · **HUD** (accent/ink colors, scan wave shape + displacement) · **Motion / Tour** (fly-to easing, tour path smoothing, banking, look-ahead) · **Performance** (render scale, static shadows, shadow resolution) · **Light** (sun azimuth/elevation, shadow softness).

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static build in dist/
```

No API keys or environment variables needed.

## Deploy

Pushing to `main` auto-deploys to GitHub Pages via the included workflow. Alternatively, any static host works:

```bash
npm run build
npx wrangler deploy   # Cloudflare (uses wrangler.jsonc)
```

## Tech

- [three.js](https://threejs.org) — rendering; terrain map styling (gradient, contours, grid, scan wave) is injected into the standard PBR shader via `onBeforeCompile`
- [postprocessing](https://github.com/pmndrs/postprocessing) — real depth-buffer DOF, ACES tone mapping, grain, vignette, SMAA
- [lil-gui](https://lil-gui.georgealways.com) — parameter panel
- [Vite](https://vitejs.dev) — build; plain JavaScript, no framework
- Hand-rolled seeded simplex noise / FBM / ridged multifractal for procedural terrain
- Tours: Catmull-Rom path sampled by arc length, trapezoidal velocity profile, damped-gimbal rotation controller

## Elevation data & attribution

Real-world mode uses the **[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)** dataset (Terrarium encoding), publicly hosted through the AWS Open Data program — no key required.

> Terrain tiles by [Mapzen](https://www.mapzen.com/) / [Tilezen](https://github.com/tilezen/joerd), from the AWS Open Data Terrain Tiles dataset. Underlying data sources include SRTM (NASA), USGS 3DEP/NED, ETOPO1 (NOAA) and others — see the [full attribution list](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

## License

[MIT](LICENSE)
