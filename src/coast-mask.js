// COASTLINE MASK — the real land/sea boundary at coarse zoom (z4–z8).
//
// At coarse zoom the DEM's 0 m isoline is a poor proxy for the true coast
// (flat coastal plains shift it kilometres; bilinear smoothing erodes shape).
// So we stop deriving land/sea from elevation and rasterize a REAL vector
// coastline instead: Natural Earth 1:10m "land" polygons (public domain),
// filtered to the patch bbox and drawn white-on-black over the exact DEM
// footprint — the same georeferencing region-mask.js uses. The terrain shader
// samples this as uCoastMask and decides land/sea from it (see terrain.js).
//
// Self-contained rasterizer (small, deliberate ~25-line overlap with
// region-mask.js) so the working "isolate the zone" path is left untouched.

import * as THREE from 'three'
import { demTilePx } from './dem-source.js'

export const COAST_ZOOM_MIN = 4
// z15 = les tuiles DEM les plus fines de l'app : le masque couvre TOUTE la
// plage des zooms (les polders sous 0 doivent rester terre aussi en vue
// rapprochée). Coût réseau contenu : les tuiles côte restent en grille z6
// (gridCache mémoïse), un patch z13-15 n'en touche qu'une ou deux.
export const COAST_ZOOM_MAX = 15
// z4–z8 use the bundled Natural Earth 10m land (Phase 1). z9–z15 switch to the
// finer OSM-derived land grid (Phase 2) — real shoreline for bays/estuaries.
export const COAST_NE_MAX = 8
export const GRID_ZOOM = 6 // the OSM land grid is cut into slippy z6 tiles
export const MASK_SIZE = 2048

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// ---- pure geometry (unit tested) ----

export function bboxIntersects(a, b) {
  return a.west <= b.east && b.west <= a.east && a.south <= b.north && b.south <= a.north
}

export function ringBBox(ring) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return { west, south, east, north }
}

// GeoJSON features → flat list of polygon ring-groups whose outer ring meets bbox
export function landPolygonsInBBox(features, bbox) {
  const kept = []
  for (const f of features) {
    const g = f.geometry
    if (!g) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const rings of polys) {
      if (!rings.length || !rings[0].length) continue
      if (bboxIntersects(ringBBox(rings[0]), bbox)) kept.push(rings)
    }
  }
  return kept
}

// lon/lat → slippy tile (x,y) at gridZoom, clamped in range (pure, tested)
export function lonLatToGridTile(lon, lat, gridZoom) {
  const n = 2 ** gridZoom
  const la = clampLat(lat) * (Math.PI / 180)
  const x = Math.floor(((lon + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  const clamp = (v) => Math.max(0, Math.min(n - 1, v))
  return [clamp(x), clamp(y)]
}

// the grid tiles covering a lon/lat bbox (north = smaller tileY) — pure, tested
export function gridTileRange(bbox, gridZoom) {
  const [xW, yN] = lonLatToGridTile(bbox.west, bbox.north, gridZoom)
  const [xE, yS] = lonLatToGridTile(bbox.east, bbox.south, gridZoom)
  return { x0: Math.min(xW, xE), x1: Math.max(xW, xE), y0: Math.min(yN, yS), y1: Math.max(yN, yS) }
}

// lon/lat bbox of the DEM patch footprint, from its four corners
export function patchLatLonBBox(dem) {
  // sample the patch edges in world space isn't needed — the DEM already knows
  // its geographic span via its tile georef; derive corners from tile math.
  const n = 2 ** dem.zoom
  const tileToLon = (tx) => (tx / n) * 360 - 180
  const tileToLat = (ty) => {
    const m = Math.PI * (1 - 2 * (ty / n))
    return (180 / Math.PI) * Math.atan(Math.sinh(m))
  }
  const tilesAcross = dem.size / demTilePx(dem)
  const west = tileToLon(dem.originTileX)
  const east = tileToLon(dem.originTileX + tilesAcross)
  const north = tileToLat(dem.originTileY) // north edge = smaller ty
  const south = tileToLat(dem.originTileY + tilesAcross)
  return { west, south, east, north }
}

// ---- projection (pure, unit tested) ----

// lon/lat → mask-canvas pixel over the DEM patch footprint, WITHOUT the
// antimeridian shortest-delta wrap that geo.latLonToWorld applies. That wrap
// tears any polygon spanning >180° of longitude — Afro-Eurasia spans ~198° — so
// at coarse zoom (small tile count) its far-east vertices fold to the opposite
// canvas edge, and the evenodd fill parity flips in latitude bands (the
// "Denmark / North Sea inverted" coarse-zoom bug). A land polygon must be drawn
// as ONE continuous shape, so longitude is projected continuously here; parts
// beyond the patch simply fall off-canvas and are clipped. Same footprint
// mapping as the shader (uSlabHalf*2 = TERRAIN_SIZE) — only the wrap is dropped.
// (Patches straddling ±180° remain a known Phase-1 limitation, as before.)
export function projectPatchPx(dem, lon, lat, size) {
  const n = 2 ** dem.zoom
  const la = clampLat(lat) * (Math.PI / 180)
  const tx = ((lon + 180) / 360) * n
  const ty = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n
  const tpx = demTilePx(dem)
  return [
    (((tx - dem.originTileX) * tpx) / dem.size) * size,
    (((ty - dem.originTileY) * tpx) / dem.size) * size,
  ]
}

function rasterize(ringGroups, dem, size) {
  const sharp = document.createElement('canvas')
  sharp.width = sharp.height = size
  const ctx = sharp.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#fff'
  for (const rings of ringGroups) {
    ctx.beginPath()
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const [px, py] = projectPatchPx(dem, ring[i][0], ring[i][1], size)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }
    ctx.fill('evenodd') // outer ring + holes
  }
  // soft coast: blur so the shader's 0.5 iso-line is smooth, not stair-stepped
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const bctx = canvas.getContext('2d')
  bctx.filter = 'blur(1.5px)'
  bctx.drawImage(sharp, 0, 0)

  // UN SEUL OCTET PAR TEXEL, ET UNE SEULE COPIE POUR TOUT LE MONDE.
  //
  // Ce masque ne porte qu'un bit d'information — terre ou mer — plus le flou de
  // 1,5 px qui lisse l'iso-0,5. Il était rangé en RGBA, et en DEUX exemplaires
  // retenus à vie du même octet : le canevas flouté, que la CanvasTexture garde
  // comme image source, et l'ImageData que main.js en extrayait pour les
  // consommateurs CPU. Plus, en VRAM, la texture RGBA elle-même.
  //
  // Les six lectures GPU du masque sont TOUTES `.r` — terrain.js:507,
  // ocean.js:151, 334, 487, 548 — et les trois lectures CPU aussi
  // (sea-mask.js landMaskFromField, ocean.js _bakeField, region-mask.js). Les
  // canaux V, B et A étaient du vide payé plein tarif.
  //
  // On rend donc **un seul Uint8Array R8**, qui sert À LA FOIS de source à la
  // DataTexture et de vérité CPU. MESURÉ sur le bloc central (2048²), banc
  // `f3-memoire.mjs`, La Réunion et Chamonix, tas ramassé de force :
  //
  //   poste                        | avant   | après  |
  //   canevas + ImageData retenus  | 32,0 Mo | 4,2 Mo |  −27,8 Mo  (mesuré)
  //   texture en VRAM              | 16,8 Mo | 4,2 Mo |  −12,6 Mo  (le format)
  //   TOTAL                        | 48,8 Mo | 8,4 Mo |  **−40,4 Mo**
  //
  // Une dalle VOISINE porte le même masque en 1024² (block-grid.js,
  // NEIGHBOUR_COAST_SIZE) : 12,2 → 2,1 Mo, soit −10 Mo par voisine.
  // Et le R8 est en plus **3,4× moins cher à téléverser** que le RGBA
  // (0,383 ms contre 1,316 ms pour un 1024², mesuré au banc GPU).
  //
  // ⚠️ DataTexture, PAS DataArrayTexture ni une Texture nue : `Texture.js:63`
  // initialise `unpackAlignment = 4`, et une texture R8 dont la largeur n'est
  // pas multiple de 4 se lirait alors EN BIAIS — chaque ligne décalée d'un ou
  // deux texels, un défaut muet et diagonal. `DataTexture.js:16` surcharge à 1 :
  // passer par elle protège par construction.
  //
  // ⚠️ Les deux canevas meurent ici. Ils ne sont plus retenus par personne : la
  // DataTexture tient le Uint8Array, pas un canevas. C'est ce qui rend le
  // second exemplaire, pas seulement le format.
  const rgba = bctx.getImageData(0, 0, size, size).data
  const data = new Uint8Array(size * size)
  for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4]

  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType)
  tex.flipY = false
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  // Le champ ressort AUSSI, et c'est LE MÊME TABLEAU que la texture : les
  // consommateurs CPU (champ de simulation mer, garde-fou sea-mask, clip de
  // zone) lisent exactement la vérité terre/mer que le GPU échantillonne, sans
  // qu'aucun octet soit recopié. Forme `{ data, width, height }` — la même que
  // celle d'une ImageData, à la foulée près : un octet par texel, pas quatre.
  return { texture: tex, field: { data, width: size, height: size } }
}

// ---- data (lazy, memoised) ----
// public/ is served at the site root by Vite, so public/data/* is fetched
// relative to the site root — the same pattern the map overlay layers use.

// z4–z8: the bundled Natural Earth 10m land (one file, whole world)
let landPromise = null
// ⚠️ EXPORTÉ POUR LE VETO (src/coast-veto.js), ET DÉLIBÉRÉMENT PAS RECOPIÉ :
// deux chargeurs de la même donnée, ce sont deux caches qui divergent et deux
// fois le réseau. `loadLandFeatures` rend directement les entités.
export async function loadLandFeatures() {
  return (await loadLand()).features
}
function loadLand() {
  landPromise ??= fetch('data/land-10m.json').then((r) => {
    if (!r.ok) throw new Error(`land-10m.json → HTTP ${r.status}`)
    return r.json()
  })
  return landPromise
}

// z9–z15: the finer OSM-derived land grid, cut into slippy z6 tiles at
// data/coast-z6/{x}/{y}.json. Ocean tiles are omitted (404 = no land), and
// each fetched tile's features are memoised (adjacent patches reuse them).
const gridCache = new Map() // "x/y" → Promise<Feature[]>
function fetchGridTile(x, y) {
  const key = `${x}/${y}`
  let p = gridCache.get(key)
  if (!p) {
    p = fetch(`data/coast-z6/${x}/${y}.json`)
      .then((r) => (r.ok ? r.json().then((fc) => fc.features || []) : [])) // 404 → ocean
      .catch(() => [])
    gridCache.set(key, p)
  }
  return p
}
// ⚠️ EXPORTÉE POUR LE VETO : `gridCache` mémoïse les tuiles z6, et le veto
// partage donc EXACTEMENT les mêmes polygones que le masque côtier du nuanceur.
// Deux rasterisations d'une même vérité, jamais deux vérités.
export async function loadGridFeatures(bbox) {
  const { x0, x1, y0, y1 } = gridTileRange(bbox, GRID_ZOOM)
  const jobs = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(fetchGridTile(x, y))
  const tiles = await Promise.all(jobs)
  return tiles.flat()
}

// ---- public API ----
// Build the land/sea mask for the current patch, or null when out of the
// coast band (z4–z15) or on any failure — the caller then keeps the current
// elevation-based rendering (repli). z4–z8 use Natural Earth 10m; z9–z15 use
// the finer OSM z6 land grid.
// `size` : côté du masque. MASK_SIZE (2048) pour le bloc central ; les dalles
// VOISINES du damier en demandent la moitié (block-grid.js) — leur maillage est
// quatre fois plus grossier, et le masque leur coûtait 16 Mo de texture PLUS
// 16 Mo d'ImageData (celle qu'elles gardent pour leurs polders), soit le poste
// le plus lourd du damier.
export async function fetchCoastMask({ lat, lon, zoom, dem, size = MASK_SIZE }) {
  if (!dem || zoom < COAST_ZOOM_MIN || zoom > COAST_ZOOM_MAX) return null
  try {
    const bbox = patchLatLonBBox(dem)
    const features = zoom <= COAST_NE_MAX ? (await loadLand()).features : await loadGridFeatures(bbox)
    const rings = landPolygonsInBBox(features, bbox)
    // no land in view (open ocean) is legitimate — still return a mask so the
    // shader paints all-sea rather than falling back to the noisy 0-isoline
    const { texture, field } = rasterize(rings, dem, size)
    // ⚠️ `maskField` et non `maskCanvas` : le renommage est VOLONTAIRE. Le
    // champ a la forme d'une ImageData mais une foulée de 1 au lieu de 4 ;
    // un consommateur oublié qui lirait `data[i * 4]` verrait une côte au quart
    // de sa taille, sans jamais lever d'erreur. Changer le nom force la mise à
    // jour de chaque site d'appel.
    return { maskTexture: texture, maskField: field, source: zoom <= COAST_NE_MAX ? 'ne' : 'osm' }
  } catch (err) {
    console.warn('coast mask failed:', err)
    return null
  }
}
