# land-10m.json

Natural Earth 1:10m "land" polygons (`ne_10m_land`), **public domain** — no
attribution required. Lazy-fetched at runtime by `src/coast-mask.js` to build the
coarse-zoom (z4–z8) land/sea mask; never bundled.

Reproduction (build-time, needs npx):

1. `curl -sL -o ne_10m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson`
2. `npx mapshaper ne_10m_land.geojson -simplify 18% keep-shapes -o land-10m.json format=geojson`

Simplified to ~18 % (Visvalingam, keep-shapes) → crisp coastline through z8,
~1.8 MB, 11 features / ~82 450 points. Raise the percentage for more fidelity if
Phase 2 wants it.
