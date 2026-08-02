// Pure slippy-tile math for the tiled Overture water layer. No THREE, no DOM,
// no fetch — safe to import from the build script (Node) AND the client.
// Single source of truth for: the region the water tiles cover, the LOD→tile-
// zoom mapping, and the tile-covering math both the build script and the
// client tile-loader need to agree on.

// Region currently covered by tiled Overture layers: Annecy, Chamonix,
// Léman, Bourget, Geneva (lon 5.0–8.0, lat 44.5–47.0). Widen this bbox — and
// rerun EVERY `build:*tiles` script (water, lake, …) — to cover more of the
// world; every consumer (build scripts, tile-loader, water-layer) keys off
// this one constant. `REGION` is the neutral alias new
// (non-water) tiled layers should import; `WATER_REGION` is kept as the
// original name so existing imports/tests are unaffected — both point at the
// exact same object, there is only one region.
export const WATER_REGION = { minLon: 5.0, minLat: 44.5, maxLon: 8.0, maxLat: 47.0 }
export const REGION = WATER_REGION

// LOD level → slippy tile zoom used to write/fetch tiles, and the demZoom
// band (inclusive upper bound) that LOD serves. demZoomMax: Infinity for the
// last entry means "everything above the previous band".
//   LOD0 z8  (far,  demZoom <= 8)  — only large lakes/reservoirs + major rivers
//   LOD1 z9  (mid,  demZoom 9-11)  — all lakes + river/water/reservoir
//   LOD2 z11 (close, demZoom >= 12) — everything kept
//
// LOD0 started at z7 (one zoom coarser than its demZoom ceiling, mirroring
// LOD2's z11-for-demZoom>=12 pattern) but measurement forced a change: at z7
// a single ~312 km tile can bundle several genuinely-huge lakes together
// (Léman + Neuchâtel + Thunersee + Brienzersee all landed in one tile over
// the Alps region) and the no-simplification rule means their full vertex
// count always ships, so that tile alone measured 2.3 MB — over the ~2
// MB/tile ceiling. Tightening the area gate can't fix it (Léman IS exactly
// the "large lake" LOD0 exists to show); z8 halves each tile's footprint in
// both axes instead, which is what actually separates co-located giant
// lakes into different tiles. See task-10 report for the measured before/after.
export const LOD_LEVELS = [
  { lod: 0, tileZoom: 8, demZoomMax: 8 },
  { lod: 1, tileZoom: 9, demZoomMax: 11 },
  { lod: 2, tileZoom: 11, demZoomMax: Infinity },
]

// PLUS de ROAD_LOD_LEVELS : le calque Routes a quitté le site (Adrien, « très
// lourd, très mauvais »), et sa voie tuilée avec lui. Elle n'a d'ailleurs
// jamais existé que sur les Alpes — c'est précisément ce qui condamnait toute
// idée d'affichage continu 3×3 avec des routes. La table `levels` de
// lodForZoom/tileZoomForLod reste paramétrable : c'est le seul reste utile de
// ce chantier, et LAKE_LOD_LEVELS s'en sert.

// World lake layer (task 19). Unlike LOD_LEVELS — which only
// ever covers REGION (the Alps box) — these tiles are written for the WHOLE
// PLANET, so there is no `inRegion` gate on this layer at all. That changes
// which tradeoff matters: for a region layer the binding constraint is
// bytes-per-tile, but for a world layer it's ALSO the total tile COUNT (one
// file per non-empty tile, worldwide), which is why the coarse LODs stay
// coarse and lean on the area floor instead of on finer tiles.
//
// Same demZoom band SCHEME as water (far <=8, mid 9-11, close >=12) so
// both layers answer "how zoomed in am I" identically — only tileZoom
// and the gate differ. Lakes are a far sparser layer than water-with-rivers
// (measured: `lake` is 23.5% of the Alps water bytes / 2.4% of the raw
// region's water vertices), so lake tiles can afford to be COARSER than
// water's at every LOD and still stay under the ~2 MB/tile ceiling.
//
// tileZoom and the per-LOD area floor are both MEASURED choices — see the
// area-band table in the task-19 report and LAKE_AREA_GATES_KM2 in
// build-world-lake-tiles.mjs. Re-measure both if you touch either.
// TWO LODs, deliberately — there used to be a third (z9, lakes >= 0.5 km2) and
// it measured **1.74 GB of the layer's 1.91 GB total** (91%) even after
// per-LOD sub-pixel simplification. Même critère que celui qui avait fait
// reculer les 887 Mo de tuiles routières (calque parti depuis) : ça ne part
// pas en production. The close band reuses the z7 tiles (named
// lakes >= 5 km2, worldwide, 171 MB total). What's lost: sub-5 km2 lakes
// OUTSIDE the Alps rich-water region at close zoom — an honest v1 tradeoff;
// the z9 build path still exists in build-world-lake-tiles.mjs for a future
// PMTiles/on-demand delivery.
export const LAKE_LOD_LEVELS = [
  { lod: 0, tileZoom: 5, demZoomMax: 8 },
  { lod: 1, tileZoom: 7, demZoomMax: Infinity },
]

// `levels` defaults to LOD_LEVELS (water) so every existing call site is
// unaffected; pass LAKE_LOD_LEVELS (or any other per-layer table) explicitly
// for a layer whose tile density needs a different tileZoom per LOD.
export function lodForZoom(demZoom, levels = LOD_LEVELS) {
  for (const l of levels) if (demZoom <= l.demZoomMax) return l.lod
  return levels[levels.length - 1].lod
}

export function tileZoomForLod(lod, levels = LOD_LEVELS) {
  const l = levels.find((x) => x.lod === lod)
  return l ? l.tileZoom : levels[levels.length - 1].tileZoom
}

// Standard Web-Mercator slippy-tile projection: lon/lat -> fractional tile
// x/y at zoom z (x right 0..n, y down 0..n). Clamp lat to the Mercator
// coverage limit so a bbox that pokes past the poles doesn't blow up the
// log(tan(...)) term.
const MERCATOR_MAX_LAT = 85.05112878
function lonLatToTileXY(lon, lat, z) {
  const n = 2 ** z
  const clampedLat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat))
  const latRad = (clampedLat * Math.PI) / 180
  const x = ((lon + 180) / 360) * n
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

// Every slippy tile {z,x,y} whose square footprint intersects a lat/lon
// bbox, at `tileZoom`. Guards:
//  - poles: lat is clamped inside the projection above, so an out-of-range
//    bbox degrades to the nearest valid row instead of throwing/NaNing.
//  - antimeridian: bbox.minLon > bbox.maxLon means the bbox actually wraps
//    through ±180°, so it's split into two spans ([minLon,180] and
//    [-180,maxLon]) and tiled separately.
// ══════════ LA CONVENTION D'ENROULEMENT, ET SES DEUX OUTILS ═════════════════
//
// Dans tout le projet, `minLon > maxLon` NE VEUT PAS DIRE « bornes inversées »
// mais « l'emprise franchit ±180° ». `tilesForBBox` la respecte depuis
// toujours ; `demBounds` la piétinait, et ça coûtait quatre symptômes visibles
// (voir son commentaire dans aerial-layer.js).
//
// Ces TROIS fonctions existent pour que plus personne n'écrive `maxLon - minLon`,
// `(minLon + maxLon) / 2` ni `Math.max(...xs) - Math.min(...xs)` à la main : les
// trois sont FAUX dès qu'une emprise s'enroule, et faux SILENCIEUSEMENT — c'est
// exactement comme ça que le défaut a survécu si longtemps.

/** La largeur d'une emprise en degrés, enroulement compris. Toujours ≥ 0. */
export function spanLon(minLon, maxLon) {
  const d = maxLon - minLon
  return d < 0 ? d + 360 : d
}

/** Le méridien central d'une emprise, enroulement compris, ramené dans [−180, 180]. */
export function centreLon(minLon, maxLon) {
  const c = minLon + spanLon(minLon, maxLon) / 2
  return ((((c + 180) % 360) + 360) % 360) - 180
}

// ══════════ LA GRILLE D'UNE MOSAÏQUE — LA TROISIÈME FORME DU MÊME PIÈGE ═════
//
// Les quatre couches drapées (photo aérienne, lumières nocturnes, occupation du
// sol, hauteur de canopée) bâtissent toutes le même canevas à partir d'une liste
// de tuiles, et toutes les quatre écrivaient la même arithmétique à la main :
//
//     const x0 = Math.min(...xs)
//     const cols = Math.max(...xs) - x0 + 1
//
// Ces deux lignes supposent que les colonnes forment une plage CONTIGUË. C'est
// vrai partout... sauf à cheval sur ±180°, où `tilesForBBox` rend légitimement
// des colonnes tout en HAUT de la plage (254, 255) et tout en BAS (0, 1), sans
// rien entre les deux — parce que c'est exactement ce que la donnée est.
//
// MESURÉ aux Fidji (179,97 / −16,85), un bloc z8 : 16 tuiles, et pourtant
// `cols = 256`. Le canevas partait à 65 536 × 1 024 px, et `scale.x` sortait
// NÉGATIF de `aerialUvTransform` — les quatre couches retournées EN MIROIR sur
// le terrain. À z12 en 3×3, `cols` atteignait 4 096 : un canevas d'un million de
// pixels de large, que le navigateur refuse en silence.
//
// ⚠️ UNE SEULE COPIE DE LA RÈGLE, ET C'EST TOUT L'ENJEU. Le défaut n'est pas né
// d'une erreur de calcul mais d'une DUPLICATION : quatre exemplaires de la même
// arithmétique, dont aucun ne connaissait la convention d'enroulement que
// `tilesForBBox` respecte trois lignes plus bas. Toute nouvelle couche drapée
// passe par ici plutôt que de réécrire ces deux lignes.
//
// LA MÉTHODE — LE PLUS GRAND TROU. On ne peut pas deviner le bord ouest en
// regardant le minimum : aux Fidji, la colonne la plus à l'ouest est 254, pas 0.
// Mais une emprise est toujours un ARC : ses colonnes occupent un intervalle
// continu du cercle, et le reste du cercle est un seul trou. On cherche donc le
// plus grand écart entre deux colonnes voisines (cycliquement) : la colonne qui
// SUIT ce trou est le bord ouest, celle qui le précède est le bord est.
//
// @param {{x:number,y:number}[]} tuiles - la liste rendue par `tilesForBBox`
// @param {number} z - le zoom slippy de ces tuiles (donne n = 2^z)
// @returns {{x0:number,y0:number,cols:number,rows:number,colonne:Function,ligne:Function}|null}
export function grilleTuiles(tuiles, z) {
  if (!tuiles?.length) return null
  const n = 2 ** z
  const xs = [...new Set(tuiles.map((t) => t.x))].sort((a, b) => a - b)
  const ys = tuiles.map((t) => t.y)

  // Le bord ouest : la colonne qui suit le plus grand trou du cercle. Avec une
  // seule colonne, il n'y a pas de trou — elle est son propre bord.
  let x0 = xs[0]
  let dernier = xs[xs.length - 1]
  if (xs.length > 1) {
    let plusGrandTrou = -1
    for (let i = 0; i < xs.length; i++) {
      const suivant = xs[(i + 1) % xs.length]
      const trou = (((suivant - xs[i]) % n) + n) % n
      if (trou > plusGrandTrou) { plusGrandTrou = trou; dernier = xs[i]; x0 = suivant }
    }
  }
  // `+ 1` parce qu'on compte des colonnes, pas des intervalles ; borné à n pour
  // qu'un tour du monde complet ne redessine pas deux fois le même méridien.
  const cols = Math.min(n, ((((dernier - x0) % n) + n) % n) + 1)

  // ⚠️ LES LIGNES NE S'ENROULENT PAS. `lonLatToTileXY` borne la latitude à
  // ±85,05° (la couverture de Mercator) : une emprise ne peut pas franchir un
  // pôle et ressortir de l'autre côté. Un modulo sur y serait donc du bruit —
  // pire, il masquerait une vraie anomalie de grille le jour où il y en a une.
  const y0 = Math.min(...ys)
  const rows = Math.max(...ys) - y0 + 1

  return {
    x0, y0, cols, rows,
    /** La colonne d'une tuile DANS LE CANEVAS, 0 au bord ouest. */
    colonne: (t) => ((((t.x - x0) % n) + n) % n),
    /** La ligne d'une tuile dans le canevas, 0 au bord nord. */
    ligne: (t) => t.y - y0,
  }
}

export function tilesForBBox(bbox, tileZoom) {
  const n = 2 ** tileZoom
  const spans =
    bbox.minLon > bbox.maxLon ? [[bbox.minLon, 180], [-180, bbox.maxLon]] : [[bbox.minLon, bbox.maxLon]]
  const out = []
  const seen = new Set()
  for (const [lo, hi] of spans) {
    const nw = lonLatToTileXY(lo, bbox.maxLat, tileZoom)
    const se = lonLatToTileXY(hi, bbox.minLat, tileZoom)
    const minX = Math.max(0, Math.floor(nw.x))
    const minY = Math.max(0, Math.floor(nw.y))
    let maxX = Math.min(n - 1, Math.floor(se.x - 1e-9))
    let maxY = Math.min(n - 1, Math.floor(se.y - 1e-9))
    maxX = Math.max(minX, maxX)
    maxY = Math.max(minY, maxY)
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x}/${y}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ z: tileZoom, x, y })
      }
    }
  }
  return out
}

// Whether a lat/lon patch bbox overlaps the covered water-tile region at all
// (plain bbox-overlap test — cheap pre-check before fetching any tiles).
export function inRegion(bbox, region) {
  return bbox.minLon <= region.maxLon && bbox.maxLon >= region.minLon && bbox.minLat <= region.maxLat && bbox.maxLat >= region.minLat
}
