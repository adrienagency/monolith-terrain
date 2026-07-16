import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { loadLayer, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock } from './block-clip.js'
import { roadRank, relativeTiers, tierDepth } from './road-tier.js'
import { REGION as ROAD_REGION, ROAD_LOD_LEVELS, inRegion, lodForZoom, tileZoomForLod } from './tile-index.js'
import { loadRoadTiles, loadRoadTileManifest, hasTilesForLod } from './tile-loader.js'

// At/above this demZoom, roads AND water come from full-detail OSM (shared
// with water-layer.js, which imports this same constant).
//
// Roads used to gate OSM per-notch (detail>=3 -> z10, >=2 -> z11, else z12),
// on the theory that more detail should mean "reach for OSM from further
// out". That theory broke on measurement: roadHighwayFilter() already
// returns the SAME bare `["highway"]` predicate for every notch (see
// overpass.js), so all three notches fetch identical Overpass data and only
// differ in client-side tier filtering (road-tier.js). Gating the FETCH
// itself per-notch just meant notch 1/2 got zero OSM roads until z12 (empty
// mid-zoom band) while notch 3 got the full unfiltered payload three zoom
// levels earlier — measured at 43,943+ segments with no cap, i.e. the
// "trop de détail" half of the bug report.
//
// One shared threshold, live-measured against the public Overpass API at a
// real patch bbox (see task-7 report for the full table):
//   demZoom 10 (91 km): Chamonix 234,594 ways / 286 MB — unusable
//   demZoom 11 (46 km): Chamonix  48,707 ways /  62 MB — still too heavy
//   demZoom 12 (24 km): Chamonix  10,752 ways /  15 MB — sane
// 12 is the lowest zoom whose payload is sane for the common (non-dense)
// case. It is NOT sane everywhere: the same z12 bbox over central Paris
// measured 351,414 ways / 238 MB, and z13/z14 Paris bboxes 504'd outright.
// That's an accepted risk, not a regression: fetchOverpassLines already
// falls back to the Natural Earth tier on any fetch failure (never blank),
// and Part 1 of this fix un-starved that NE tier, so a dense-city 504 now
// degrades to "richer NE roads" instead of "no roads at all". Tier DEPTH
// (tierDepth in road-tier.js) is what keeps the sane cases from flooding —
// zoom-aware per notch, see that file for the full curve.
export const OSM_MIN_ZOOM = 12

const STYLE = { motorway: { widthPx: 2.6 }, primary: { widthPx: 1.8 }, secondary: { widthPx: 1.1 } }
// Relative tier (0 = most important class PRESENT in the patch) → weight class.
function tierClass(tier) {
  return tier === 0 ? 'motorway' : tier === 1 ? 'primary' : 'secondary'
}

// Tailwind slate, weighted by the same RELATIVE tier that decides line width:
// heaviest class (whatever is tier 0 in THIS patch — motorway if present,
// else the nationals) reads darkest, lighter classes fade toward slate-400.
// Dark mode inverts the ramp (heaviest = lightest) for the same reason
// text-label.js's ink ramp does — strongest contrast for the important thing.
const ROAD_SLATE_LIGHT = { motorway: '#475569', primary: '#64748b', secondary: '#94a3b8' } // 600,500,400
const ROAD_SLATE_DARK = { motorway: '#cbd5e1', primary: '#94a3b8', secondary: '#64748b' } // 300,400,500
// `params.roadColor` is a user override: when set it wins outright, uniformly
// across every class — the user asked for ONE colour, not a ramp.
function roadInk(klass, params) {
  if (params.roadColor) return params.roadColor
  return (params.darkMode ? ROAD_SLATE_DARK : ROAD_SLATE_LIGHT)[klass]
}

export class RoadsLayer {
  constructor(scene) {
    this.group = new THREE.Group(); this.group.name = 'roads'; scene.add(this.group)
    this._buildId = 0; this.usingOsm = false; this.loading = false
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
  }
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    this._clear()
    if (!params.roadsEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    // OSM activation is one shared threshold for every notch (see the
    // OSM_MIN_ZOOM comment above for why) — which classes actually render
    // is decided client-side and zoom-aware by tierDepth() below, not by
    // gating the fetch per-notch. This now gates ONLY the live-Overpass
    // fallback below; the tiled Overture path runs at ANY zoom (see below).
    const useOsm = zoom >= OSM_MIN_ZOOM

    // gather rings as {coords:[lon,lat][], rank} from the chosen tier
    let rings = null
    // true whenever roads come from Overture tiles OR live Overpass — both
    // are ODbL/OSM-derived and need the same "© OpenStreetMap contributors"
    // credit (refreshOsmCredit() in main.js reads this flag).
    let osmOk = false

    // Tiled Overture roads: in-region + built for this LOD -> this REPLACES
    // live Overpass for in-region patches, at ANY zoom (not gated by
    // OSM_MIN_ZOOM), mirroring exactly how WaterLayer's lake tiles activate
    // purely on inRegion + hasTilesForLod. This is the whole point of task
    // 18: Overpass's own docs list this app's use (non-mapper-facing,
    // backend-style traffic on the public instance) as unacceptable, and a
    // z12 (24 km) bbox over central Paris can return 351,414 ways / 238 MB
    // with a 200 OK — the "fetch fails -> Natural Earth" net never fires and
    // the tab chokes. See build-road-tiles.mjs for how the tiles are built
    // and the task-18 report for the measured numbers.
    if (inRegion(bounds, ROAD_REGION)) {
      const manifest = await loadRoadTileManifest()
      const lod = lodForZoom(zoom, ROAD_LOD_LEVELS)
      if (hasTilesForLod(manifest, lod)) {
        const tileFC = await loadRoadTiles(bounds, tileZoomForLod(lod, ROAD_LOD_LEVELS))
        if (id !== this._buildId || dem !== terrain.dem) return
        rings = []
        for (const f of clipToPatch(tileFC.features, bounds)) {
          const rank = roadRank(f.properties?.class)
          const rs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
          for (const r of rs) rings.push({ coords: r, rank })
        }
        osmOk = true
      }
    }
    // Live Overpass: fallback-of-a-fallback now — only reached for an
    // out-of-region patch (or a zoom whose LOD hasn't been built), and only
    // above OSM_MIN_ZOOM exactly as before.
    if (!rings && useOsm) {
      this.loading = true
      const feats = await fetchOverpassLines(bounds, 'roads', { detail: params.roadsDetail })
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { rings = feats.map((f) => ({ coords: f.coords, rank: roadRank(f.kind) })); osmOk = true }
    }
    if (!rings) { // Natural Earth tier (or tiles/OSM unavailable → fallback), unchanged
      const fc = await loadLayer('roads')
      if (id !== this._buildId || dem !== terrain.dem || !fc) return
      rings = []
      for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
        const rs = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]
        for (const r of rs) rings.push({ coords: r, rank: f.properties.scalerank ?? 9 })
      }
    }
    this.usingOsm = osmOk

    // Tiers are RELATIVE to whatever ranks are actually present in this patch:
    // whatever the most important class present is becomes tier 0, so a valley
    // with no motorway still renders its nationals at the heaviest weight
    // instead of the patch coming back empty.
    const tiers = relativeTiers(rings.map((r) => r.rank))
    const depth = tierDepth(params.roadsDetail, zoom)
    rings = rings.filter((r) => tiers.get(r.rank) < depth)

    const fp = terrain.blockFootprint(); const insideBlock = makeInsideBlock(fp)
    const sample = (x, z) => (terrain.sample ? terrain.sample(x, z) : 0)
    const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
    // clip every ring to the block, bucket runs by weight class
    const byClass = { motorway: [], primary: [], secondary: [] }
    for (const r of rings) {
      const pts = latlonToWorldPts(r.coords, dem, latLonToWorld)
      const runs = clipPolylineToBlock(pts, insideBlock, fp.regionOn ? 0.3 : 0.6)
      if (runs.length) byClass[tierClass(tiers.get(r.rank))].push(...runs)
    }
    for (const klass of Object.keys(byClass)) {
      if (!byClass[klass].length) continue
      const obj = buildLineSegments(byClass[klass], sample, { color: roadInk(klass, params), widthPx: STYLE[klass].widthPx, offset: 0.08, renderOrder: 20, resolution })
      obj.traverse((o) => { if (o.material) o.material.opacity = params.roadsOpacity ?? 0.9 })
      this.group.add(obj)
    }
  }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) { this.group.traverse((o) => { if (o.material) o.material.opacity = v }) }
  dispose() { this._clear() }
}
