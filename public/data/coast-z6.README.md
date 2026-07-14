# coast-z6/ — fine coastline grid (Phase 2, z9–z12)

OpenStreetMap-derived **land polygons**, cut into canonical Web-Mercator slippy
**z6 tiles** at `coast-z6/{x}/{y}.json` (WGS84 lon/lat GeoJSON). Fetched per-view
by `src/coast-mask.js` at fine zoom (z9–z12); Natural Earth 10m (`land-10m.json`)
still covers z4–z8. A missing tile = open ocean.

**Attribution required — ODbL:** the app shows "© OpenStreetMap contributors".
(Natural Earth, used at z4–z8, is public domain and needs none.)

The grid is **git-ignored** (≈315 MB, ~2360 tiles) — present on disk for the
Netlify deploy, not committed. Regenerate at build time:

1. Download the full-res split coastline (≈881 MiB):
   `curl -O https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip` and unzip.
2. Pre-simplify to Web Mercator once (Visvalingam 30 m ≈ z12 pixel scale, keep-shapes,
   precision 0.0001; drop micro-islands < ~150 m to cap dense archipelago tiles):
   `mapshaper land_polygons.shp -proj webmercator -filter-islands min-area=22500m2 -simplify visvalingam interval=30m keep-shapes -o global-webmerc.json`
3. **Clip** (not bucket) each z6 tile to its exact Mercator-square bbox — `-split-on-grid`
   only buckets whole features and breaks bit-exactness, so clip per tile
   (`-clip bbox=...` with true slippy bounds `atan(sinh(pi*(1-2*y/64)))` for lat),
   omitting empty tiles, into `coast-z6/{x}/{y}.json`.

Verified bit-exact: each tile's polygon content stays within its own slippy-z6 bbox.
