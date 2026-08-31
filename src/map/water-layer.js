import * as THREE from 'three'
import { latLonToWorld } from '../geo.js'
import { TERRAIN_SIZE } from '../terrain.js'
import { loadLayerForBounds, patchBounds, clipToPatch, filterByZoom } from './geo-data.js'
import { latlonToWorldPts } from './draped-line.js'
import { buildLineSegments } from './line-segments.js'
import { fetchOverpassLines, fetchOverpassAreas } from './overpass.js'
import { makeInsideBlock, clipPolylineToBlock, blockOutline, triangulateAndClip } from './block-clip.js'
import { riverWidthPx } from './river-width.js'
import { makeLakeMaterial } from './lake-material.js'
import { WATER_REGION, LAKE_LOD_LEVELS, inRegion, lodForZoom, tileZoomForLod } from './tile-index.js'
import { loadWaterTiles, loadWaterTileManifest, loadLakeTiles, loadLakeTileManifest, hasTilesForLod } from './tile-loader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
// ══════ LA CARTOGRAPHIE SUR LA SPHÈRE — Tâche D16-b ═══════════════════════
//
// Le calque garde son espace de BLOC — projection, découpe sur l'empreinte,
// marges en unités de bloc. Seul le DERNIER geste change : `poseur.placer`
// décide si le point atterrit sur la dalle plate ou sur la sphère de relief.
// Les deux conversions vivent là-bas, écrites une fois.
import { poseurPlat } from '../monde/sol-globe.js'

// À partir de ce demZoom, l'eau vient d'Overpass en pleine finesse ; en
// dessous, des tuiles Overture ou du Natural Earth.
//
// Cette constante VIVAIT dans roads-layer.js, qui n'existe plus (le calque
// Routes a quitté le site) : les deux calques partageaient un seul seuil,
// l'eau en est désormais la seule propriétaire. Le chiffre, lui, ne bouge
// pas — il a été mesuré contre l'API Overpass publique sur une vraie bbox de
// patch, et c'est la géographie qui l'impose, pas le calque :
//   demZoom 10 (91 km) : Chamonix 234 594 ways / 286 Mo — inutilisable
//   demZoom 11 (46 km) : Chamonix  48 707 ways /  62 Mo — encore trop lourd
//   demZoom 12 (24 km) : Chamonix  10 752 ways /  15 Mo — raisonnable
// 12 est le plus petit zoom dont la charge tient debout dans le cas courant
// (hors ville dense). Ce n'est PAS raisonnable partout : la même bbox z12 sur
// Paris intra-muros mesurait 351 414 ways / 238 Mo. Risque assumé et non
// régression : fetchOverpassLines retombe sur le palier Natural Earth au
// moindre échec (jamais de blanc), et OVERPASS_MAXSIZE (overpass.js) fait
// échouer la requête AVANT que le navigateur n'avale la charge.
//
// ══════════ ⚡ D16-b A CHERCHÉ À LE BAISSER, ET LA MESURE DIT NON ═══════════
//
// > **Adrien :** « Pour l'instant [la cartographie] ne s'affiche que sur
// > certains lieux et **avec un zoom important**. »
//
// ⛔ **CE PLANCHER N'ÉTAIT POUR RIEN DANS CE DÉFAUT, ET C'EST MESURÉ.** Il
// choisit une SOURCE, pas une PRÉSENCE : sous lui, les rivières viennent de
// Natural Earth (`_neRiverRings`) et les lacs des tuiles mondiales, tous deux
// DÉJÀ EMBARQUÉS et couvrant la planète (`public/data/map/rivers.json` :
// 10 771 entités, `lakes.json` : 1 345, `places.json` : 158 474). Relevé à
// l'écran AVANT toute correction (`.banc/D16b/avant.json`, 8 couples
// lieu × zoom) : les groupes étaient **peuplés à z6, z8 et z10 comme à z12**
// — de 3 à 36 objets — et `visible = false` partout. Le défaut était le
// relogement, pas le plancher.
//
// ⚡ **ET SUR LA MACHINE D'ADRIEN, LA BRANCHE OVERPASS NE RAPPORTE RIEN DU
// TOUT — À AUCUN ZOOM.** `scripts/sonde-overpass.mjs`, page vivante, même
// chemin que ce calque, Chamonix :
//
//   | emprise | lignes | aires | temps |
//   |---|---|---|---|
//   | z12 (20 km) | **REFUS** | REFUS | **6 008 ms** |
//   | z10 (82 km), page fraîche | **REFUS** | REFUS | **6 004 ms** |
//
// 6 000 ms est `OVERPASS_ATTENTE_MS` au chiffre près : la requête ne revient
// jamais. C'est exactement ce que le §« LE BUDGET D'ATTENTE » d'`overpass.js`
// avait déjà mesuré le 2026-07-31 — *« l'API est injoignable d'ici »*. **Tout
// ce qu'on voit à l'écran, de z6 à z12, vient donc des données locales.**
//
// ➡️ **BAISSER LE PLANCHER N'AJOUTERAIT AUCUNE DONNÉE ET ÉTENDRAIT L'ATTENTE
// DE 6 s À TOUS LES ZOOMS.** Sur une machine qui, elle, atteint Overpass, il
// noierait le service public avec les charges du tableau ci-dessus (z10 :
// 234 594 ways / 286 Mo). **On le laisse à 12.**
//
// ⚠️ **ET CE N'EST PAS SEULEMENT UNE QUESTION DE CHARGE : LA DONNÉE FINE N'A
// PAS DE SENS À PETITE ÉCHELLE.** À z8 le bloc fait ~330 km de large pour
// ~1 280 px : un pixel vaut 256 m. Les traits sont dessinés en largeur d'ÉCRAN
// (`riverWidthPx` : 0,9 à 3,5 px, `LineSegments2`), donc y verser les ~50 000
// ways d'OSM ne rendrait pas des rivières plus fines — ça rendrait un aplat
// bleu. Le champ `min_zoom` de Natural Earth EST la généralisation
// cartographique de ce cas, et c'est lui que `filterByZoom` applique.
// ⛔ **On ne mesure pas z8 contre le point d'accès public** : ce serait
// demander à un service gratuit de balayer un pays pour un chiffre déductible
// (voir l'en-tête de `scripts/sonde-overpass.mjs`).
export const OSM_MIN_ZOOM = 12

// Client-side waterway-kind filter for the zoomed Overpass waterway LINES
// (fetchOverpassLines(bounds, 'water') below). The Overpass query itself
// stays the bare `way["waterway"]` tag test on purpose — DO NOT turn this
// into a `["waterway"~"^(river|riverbank)$"]` regex predicate. Regex
// predicates make Overpass scan every way in the bbox instead of hitting the
// tag index. Mesuré à l'époque sur le calque Routes (parti depuis) : un
// prédicat filtré prenait 6,5 s et revenait en 504 sur une bbox dense, là où
// le test de tag nu répondait en moins d'une seconde.
// So filtering happens here instead, client-side, after parseOverpass has
// already run — cheap, and it can't take the whole layer down with a 504.
//
// Product requirement (Adrien, verbatim): "on retire les torrents, et les
// cours d'eau, on ne garde que points d'eau, les lacs, les mares, les
// fleuves et les rivières." Alpine torrents are almost always tagged
// waterway=stream in OSM (occasionally a nonstandard waterway=torrent);
// keeping only `river` and `riverbank` drops those along with every other
// minor/artificial watercourse tag (brook/ditch/drain/canal/pressurised/…),
// leaving just the named rivers the requirement asks for. Lakes/ponds are a
// separate code path entirely (the AREA fetch below + the tiled/NE lake
// layers), unaffected by this filter.
const RIVER_WATERWAY_KINDS = new Set(['river', 'riverbank'])
export function filterRiverwayLines(feats) {
  return feats.filter((f) => RIVER_WATERWAY_KINDS.has(f.kind))
}

// Lakes render above every other DRAPED MAP LAYER (rivers, contours,
// the general water fill), in a distinctly more saturated blue than the
// general water ink — an explicit user request ("je tiens vraiment à ce que
// les lacs apparaissent au dessus de tout le reste, en bleu assez visible").
// renderOrder 26 clears every draped layer below (the general water fill sits
// at 17 ; le 20 laissé libre était celui des routes, parties du site), and
// polygonOffset (in _fillMaterial / line-segments.js) breaks ties among
// draped layers sitting at nearly the same world height. depthTest stays ON
// (true) for lakes exactly like every other layer, though: the terrain mesh
// itself must still occlude a lake behind a mountain, or the mountain reads
// as transparent. The two are not in tension — renderOrder+polygonOffset
// settle ordering AMONG draped layers, while depthTest keeps the terrain
// (a separate, non-draped surface) opaque against all of them.
const LAKE_RENDER_ORDER = 26

// Triangulate a polygon "part" (one outer ring + its holes, in GeoJSON
// lon/lat) and drape it onto the terrain, clipped to the block footprint.
//
// Order matters here: triangulate the ORIGINAL outer+holes shape first (see
// triangulateAndClip in block-clip.js for why), THEN clip each resulting
// triangle to the block outline and fan-triangulate what's left. Clipping
// per-triangle instead of clipping the whole ring up front is what keeps a
// concave river polygon that leaves and re-enters the block from growing a
// bogus filled bridge across the gap (see block-clip.js's doc comment on
// triangulateAndClip). Holes (islands) are passed straight to earcut so
// they're never filled in as water in the first place.
//
// `part` is `{ outer, holes }`, both GeoJSON lon/lat rings (holes may be
// empty/omitted). `outline` is blockOutline(fp), computed once per rebuild
// by the caller. Shared by the OSM water-area fill (rivers/lakes at OSM
// zoom) and the Natural Earth / Overture-tile lakes fill (toujours actif)
// — one triangulate/clip/drape implementation.
// The single height a lake surface sits at: the MEDIAN of the terrain samples
// under its vertices. Median, not mean or min: most vertices sample the water
// surface itself (the DEM sees lake level there), while a handful land on the
// shore slope where the polygon and the DEM disagree about the waterline —
// those outliers must not drag the level up the hill (mean) or down into a
// DEM pit (min). Exported for tests.
export function waterLevelOf(heights) {
  if (!heights.length) return 0
  const s = [...heights].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// ══════════ LE CHRONOMÈTRE DU CALQUE — Tâche R14 ═══════════════════════════
//
// ⚠️ **« ÇA PREND DE LA MÉMOIRE » N'EST PAS UN DIAGNOSTIC**, et « la
// reconstruction bloque » non plus. Ces postes existent pour dire OÙ part le
// temps d'une reconstruction ; `scripts/sonde-eau-memoire.mjs` les relit dans
// la page vivante. C'est le même instrument avant et après une optimisation,
// ce qui est la condition pour comparer deux chiffres.
//
// Le coût de l'instrument est borné par construction : `clipAll` chronomètre
// par LISTE d'anneaux (deux appels, pas deux par anneau) et le remplissage par
// POLYGONE, jamais par sommet.
// ⚠️ Il y avait un poste `normales` : il mesurait `computeVertexNormals()`, que
// la même tâche a retiré (voir `buildFilledRing`). Un compteur qui ne peut plus
// qu'afficher zéro ne reste pas — le relevé d'avant (`.banc/R14/memoire-avant.json`)
// le porte encore, et c'est là qu'on lit ce qu'il valait.
export const chronoEau = { sources: 0, projection: 0, decoupe: 0, traits: 0, triangulation: 0, drapage: 0, fusion: 0, total: 0 }
const _mnt = () => (typeof performance !== 'undefined' ? performance.now() : 0)
function _remiseChrono() { for (const k of Object.keys(chronoEau)) chronoEau[k] = 0 }

// `flat`: lakes pass true — a lake is a LEVEL PLANE, so every vertex gets the
// part's single water level. Draping each vertex at terrain height (the old
// behaviour, still right for rivers, which genuinely follow the ground) made
// any shoreline overlap CLIMB the hillside: blue paint running up a mountain,
// reported as "on voit les lacs a travers les montagnes". Flat, the same
// overlap disappears INTO the slope and the terrain occludes it — which is
// what a real shore does.
// Exporté sous `buildFilledRing` pour les tests : c'est LE constructeur du poste
// dominant du calque (voir `.superpowers/sdd/.../rapport-R14.md` — 89 % des
// octets et 90 % du temps de reconstruction à Chamonix z6), et la seule façon
// d'épingler ce qu'il met dans une géométrie sans monter une scène entière.
export function buildFilledRing(part, dem, poseur, outline, fp, insideBlock, flat = false) {
  if (!part?.outer || part.outer.length < 4) return null
  let _t = _mnt()
  const outerPts = latlonToWorldPts(part.outer, dem, latLonToWorld)
  if (outerPts.length < 3) return null
  const holePts = (part.holes || [])
    .filter((h) => h.length >= 4)
    .map((h) => latlonToWorldPts(h, dem, latLonToWorld))
    .filter((h) => h.length >= 3)
  chronoEau.projection += _mnt() - _t

  _t = _mnt()
  const clippedTris = triangulateAndClip(outerPts, holePts, outline)
  chronoEau.triangulation += _mnt() - _t
  if (!clippedTris.length) return null

  // ⚠️ **ON GARDE LES SOMMETS EN COORDONNÉES DE BLOC JUSQU'AU BOUT.** Le
  // nivellement des lacs (`flat`) prend la MÉDIANE des hauteurs : la calculer
  // sur des rayons de sphère mélangerait la hauteur et la position, et un lac
  // posé « à plat » sur le globe est un lac à RAYON constant, pas à Y constant.
  // On pose donc en dernier, une fois le niveau choisi — c'est aussi ce qui
  // laisse la marge `0.06` en unités de bloc, sans conversion ici.
  _t = _mnt()
  const bloc = []
  const index = []
  for (const poly of clippedTris) {
    // clipPolygonToBlock (used inside triangulateAndClip) returns a closed
    // ring; drop the duplicate closing vertex before fan-triangulating.
    const open =
      poly.length > 1 && poly[0].x === poly[poly.length - 1].x && poly[0].z === poly[poly.length - 1].z
        ? poly.slice(0, -1)
        : poly
    if (open.length < 3) continue
    // Region mode's mask is arbitrary/concave, so Sutherland-Hodgman doesn't
    // apply to it — fall back to a centroid test against insideBlock (which
    // composes slab + region), same approximation as before this fix, just
    // applied per output triangle-polygon instead of per whole ring. Slab
    // containment itself is already guaranteed by the per-triangle clip
    // above, so this check only matters when a region cutout is active.
    if (fp.regionOn) {
      let cx = 0, cz = 0
      for (const p of open) { cx += p.x; cz += p.z }
      cx /= open.length; cz /= open.length
      if (!insideBlock(cx, cz)) continue
    }
    const base = bloc.length
    for (const p of open) bloc.push({ x: p.x, z: p.z, y: poseur.hauteur(p.x, p.z) + 0.06 })
    for (let k = 1; k < open.length - 1; k++) index.push(base, base + k, base + k + 1)
  }
  if (!index.length) { chronoEau.drapage += _mnt() - _t; return null }
  if (flat) {
    // one level for the whole part — collected from the heights already draped
    const level = waterLevelOf(bloc.map((b) => b.y))
    for (const b of bloc) b.y = level
  }
  const positions = []
  for (const b of bloc) { const v = poseur.placer(b.x, b.z, b.y); positions.push(v.x, v.y, v.z) }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geo.setIndex(index)
  chronoEau.drapage += _mnt() - _t
  // ⛔ **PAS DE `computeVertexNormals()` ICI — Tâche R14, et c'est le poste
  // dominant de la mémoire du calque.** Il remplissait un attribut `normal` de
  // 12 octets par sommet que **AUCUN des deux matériaux de remplissage ne
  // lit** : `_fillMaterial` est un `MeshBasicMaterial` (il ne s'éclaire pas),
  // et le nuanceur de lac (`lake-material.js`) prend sa normale EN DUR dans le
  // fragment — « flat normal, by design » — son nuanceur de sommets ne lit que
  // `position`.
  //
  // MESURÉ dans la page vivante (`scripts/sonde-eau-memoire.mjs`, mode sphère,
  // Chamonix z6) : 451 485 sommets de remplissage, donc **5,42 Mo d'un attribut
  // que personne ne regarde — 38 % de tout ce que le calque tenait**.
  //
  // ⚠️ **CE N'EST PAS DE LA MÉMOIRE GPU, ET LE DIRE SERAIT FAUX.** three.js ne
  // téléverse que les attributs ACTIFS du programme compilé ; `normal` ne l'est
  // pour aucun des deux matériaux, il ne franchissait donc jamais le pilote.
  // C'est de la mémoire de TAS, tenue par la géométrie sur le fil principal —
  // exactement ce qu'Adrien voit grandir.
  //
  // ➡️ Le jour où un matériau de remplissage s'éclaire vraiment, c'est ici que
  // la normale revient — et `test/eau-remplissage.test.js` le dira.
  return geo
}

// Shared fill-material spec for draped water-body meshes (OSM areas + NE/tile
// lakes). depthTest is always ON: the terrain must occlude water like any
// other geometry (see LAKE_RENDER_ORDER above for how lakes still win
// against other draped layers without it).
// Pose la découpe de fenêtre sur un matériau — sans effet hors mode continu
// (`plans` est alors null, et le matériau reste celui d'avant, variante de
// shader comprise : three.js ne compile le code de coupe que s'il y a des plans).
//
// ⚠️ C'EST UNE ÉCRITURE, PAS UNE CHIRURGIE DE SHADER. `LineMaterial` déclare
// `clipping: true` en r172, `MeshBasicMaterial` le porte depuis toujours, et le
// matériau de lac a reçu les quatre inclusions standard. Rien à recompiler à la
// main, rien à casser sur un pilote — c'est la raison de préférer les plans au
// `discard` de superellipse que l'étude proposait.
function _coupeALaFenetre(mat, plans) {
  if (!mat || !plans) return
  mat.clippingPlanes = plans
  mat.clipShadows = false
  mat.needsUpdate = true
}

// ══════════ UN SEUL MAILLAGE PAR MATÉRIAU, PAS UN PAR POLYGONE ═════════════
//
// MESURÉ, Chamonix z12 en mode continu, calque affiché puis caché en
// alternance sur la même scène vivante (l'alternance et pas deux blocs : la
// machine dérive, l'ordre ment) :
//
//   1 483 maillages d'eau, 3 682 appels de dessin  →  26,0 ms l'image
//   le même calque caché                           →  16,6 ms l'image
//
// Soit **+9,3 ms par image** pour l'eau seule, quand le budget d'une image à
// 60 im/s est de 16,6 ms en tout. Le mode ordinaire ne le montrait pas (186
// maillages, coût non mesurable) : c'est l'emprise 3×3 qui multiplie par neuf
// et fait basculer le calque du côté visible du budget.
//
// La cause n'est pas la géométrie — 170 083 sommets ne sont rien — c'est le
// NOMBRE d'objets. On fusionne donc tous les polygones d'un même matériau en un
// seul maillage : ils partagent déjà leur matériau, leur ordre de rendu et
// leurs attributs (position, normale, index).
//
// ⚠️ Les géométries sources sont disposées ici. `mergeGeometries` COPIE, elle ne
// prend pas la propriété : les laisser vivre serait une fuite de tas d'autant
// plus grande que l'emprise est grande.
function _meshFusionne(geos, material, renderOrder) {
  if (!geos.length) return null
  const _t = _mnt()
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
  if (geos.length > 1) for (const g of geos) g.dispose()
  chronoEau.fusion += _mnt() - _t
  if (!geo) return null
  const mesh = new THREE.Mesh(geo, material)
  mesh.renderOrder = renderOrder
  return mesh
}

function _fillMaterial(ink, opacity) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(ink),
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
}

// Flat list of every ring in a geometry — outer rings AND holes alike — for
// LINE/outline rendering, where each boundary (including an island's
// shoreline inside a lake) is legitimately its own line loop.
//
// Do NOT use this for fill (see polygonPartsOf below): a GeoJSON `Polygon`'s
// coordinates are `[outer, hole1, hole2, …]`, and treating every hole as
// though it were its own outer ring — which is what this function
// necessarily does — is exactly the "water is drawn where there is none"
// bug: every island inside a lake/river got filled in solid.
function flatRingsOf(g) {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates]
  if (g.type === 'MultiLineString' || g.type === 'Polygon') return g.coordinates
  if (g.type === 'MultiPolygon') return g.coordinates.flat()
  return []
}

// Polygon "parts" — `{ outer, holes }` — for FILL rendering, preserving
// GeoJSON polygon structure so holes can be excluded correctly (see
// buildFilledRing / triangulateAndClip). A `Polygon` is one part; a
// `MultiPolygon` is several independent parts, each with its own holes.
// Non-polygon geometry (lines) can't be filled and yields nothing.
function polygonPartsOf(g) {
  if (!g) return []
  if (g.type === 'Polygon') return g.coordinates.length ? [{ outer: g.coordinates[0], holes: g.coordinates.slice(1) }] : []
  if (g.type === 'MultiPolygon') return g.coordinates.filter((p) => p.length).map((p) => ({ outer: p[0], holes: p.slice(1) }))
  return []
}

export class WaterLayer {
  // ⛔ **LE CALQUE NE SE RATTACHE PLUS TOUT SEUL — Tâche D16-b, cause ①.**
  // Il faisait `scene.add(this.group)` sur la scène du BLOC PLAT. La Tâche
  // D16-a a supprimé la passe qui la dessinait : les rivières n'étaient pas
  // cachées, elles étaient dessinées dans un tampon que plus personne ne
  // regarde. Le rattachement passe par `MapLayers.poserScene`, un point unique
  // qui sait, lui, laquelle des deux scènes est rendue.
  constructor() {
    this.group = new THREE.Group(); this.group.name = 'water'
    this._buildId = 0; this.usingOsm = false; this.loading = false
    // Le poseur en vigueur, remplacé à chaque reconstruction (voir `rebuild`).
    this._poseur = null
    this._lakeMats = []; this._sun = null
    // ══════════ LA RÉSOLUTION DES FLEUVES — UNE SEULE VÉRITÉ ═══════════════
    //
    // Les rivières et les contours de lac sont des `LineSegments2` : leur
    // épaisseur est en pixels du TAMPON DE DESSIN, convertie en espace clip par
    // `LineMaterial` (voir export-traits.js). Elle était relue depuis
    // `window.innerWidth/innerHeight` à chaque reconstruction — or le calque se
    // reconstruit à chaque zone, à chaque zoom et à chaque arrivée de tuile.
    // En boutique et dans le Studio, `#app` est plus petit que la fenêtre ; et
    // après un redimensionnement, la première reconstruction ré-écrasait la
    // valeur que `onResize` venait de poser. On la garde donc ici.
    this._resolution = new THREE.Vector2(window.innerWidth, window.innerHeight)
  }

  // LE FABRICANT DE POSEUR — posé par `MapLayers`, appelé à chaque
  // reconstruction. `null` = le drapage du dépôt (bloc plat).
  poserFabricantDePoseur(fn) { this._faitPoseur = typeof fn === 'function' ? fn : null }

  // Les traits larges du calque suivent la taille du tampon de dessin : la
  // valeur mémorisée d'abord (les reconstructions à venir la reliront), les
  // matériaux vivants ensuite.
  onResize(w, h) {
    if (w > 0 && h > 0) this._resolution.set(w, h)
    this.group.traverse((o) => {
      const m = o.material
      if (m && m.isLineMaterial) m.resolution.set(w, h)
    })
  }
  _clear() {
    this.group.traverse((o) => { if (o.isLineSegments2 || o.isLine2 || o.isMesh) { o.geometry.dispose(); o.material.dispose() } })
    this.group.clear()
    this._lakeMats = []
  }

  // Current sun, from the day cycle. Kept on the layer because a rebuild
  // (zoom/pan) creates fresh materials that must be born with the right hour —
  // pushing only to live materials would give a newly-built lake a noon glint
  // at midnight.
  setSun({ dir, color, sky }) {
    this._sun = { dir, color, sky }
    for (const m of this._lakeMats ?? []) {
      if (dir) m.uniforms.uSunDir.value.copy(dir).normalize()
      if (color) m.uniforms.uSunColor.value.set(color)
      if (sky) m.uniforms.uSky.value.set(sky)
    }
  }
  // Natural Earth line rings for a static layer (lakes/coastline) — flat,
  // outline-only (see flatRingsOf).
  async _neRings(name, bounds, zoom) {
    const fc = await loadLayerForBounds(name, bounds)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const r of flatRingsOf(f.geometry)) if (r.length >= 2) out.push(r)
    return out
  }
  // Natural Earth polygon parts for a static layer, preserving holes — for
  // fill rendering only (see polygonPartsOf).
  async _neParts(name, bounds, zoom) {
    const fc = await loadLayerForBounds(name, bounds)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) for (const part of polygonPartsOf(f.geometry)) out.push(part)
    return out
  }
  // Natural Earth river rings, each tagged with its source feature's
  // strokeweight so the caller can bucket runs by on-screen width.
  async _neRiverRings(bounds, zoom) {
    const fc = await loadLayerForBounds('rivers', bounds)
    if (!fc) return []
    const out = []
    for (const f of filterByZoom(clipToPatch(fc.features, bounds), zoom)) {
      const strokeweight = f.properties?.strokeweight
      for (const r of flatRingsOf(f.geometry)) if (r.length >= 2) out.push({ ring: r, strokeweight })
    }
    return out
  }
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 LE DAMIER : CE CALQUE S'ARRÊTE AU BLOC CENTRAL, ET C'EST UN REFUS MOTIVÉ
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Tâche 8 du chantier damier multi-blocs (2026-08-05). Le constat est réel :
  // sur un damier, rivières et lacs vectoriels n'existent QUE sur le bloc
  // central, donc une rivière s'arrête net à une jointure. La mer, l'heure, le
  // clip de surface, les arrondis et les huit réglages de matière ont tous été
  // étendus au carré ; celui-ci ne l'est PAS. La raison est écrite ici plutôt
  // qu'ailleurs parce que c'est ici qu'on vient la chercher.
  //
  // CE QUI BORNE L'EMPRISE : `patchBounds(dem)`, la boîte lat/lon du MNT servi
  // juste en dessous — le bloc central, ou le champ recollé du mode continu (là
  // `extentMeters` est déjà multiplié par `empriseCote`, dem-emprise.js, d'où
  // une emprise déjà 3×3 dans CE mode, qui n'est pas le damier). Une emprise,
  // donc UNE paire de requêtes Overpass : lignes + aires.
  //
  // ── ROUTE A — une emprise par case. MESURÉE, REFUSÉE ────────────────────────
  //
  // Mesure par exécution du module `overpass.js` de production (écart minimal
  // 1 200 ms, budget d'attente 6 000 ms), point d'accès simulé, latence 927 ms
  // — la mesure de référence du module. Rejouée par test/damier-eau-reseau.test.js :
  //
  //   cases | requêtes | pic simultané | servies (2 créneaux/IP) | disjoncteur
  //   ------|----------|---------------|-------------------------|------------
  //     1   |     2    |       2       |          2 / 2          |   fermé
  //     9   |    18    |    **18**     |       **2 / 18**        | **fermé**
  //    25   |    50    |      50       |          2 / 50         |   fermé
  //
  // 🔴 L'ÉCART MINIMAL NE SÉRIALISE RIEN. On le lit comme une file d'attente ;
  // ce n'en est pas une. Chaque appel calcule `_lastAt + minInterval - now`
  // AVANT que le précédent n'ait écrit `_lastAt` (overpass.js, dans l'IIFE) :
  // dix-huit appels lancés dans le même tour de boucle attendent donc le MÊME
  // délai, puis partent ENSEMBLE. Mesuré : les 18 départs tiennent dans la même
  // milliseconde. Ce n'est pas 9 fois plus de requêtes étalées, c'est une rafale
  // de 18 requêtes simultanées vers overpass-api.de depuis le navigateur du
  // visiteur — et l'application appelle le point d'accès PUBLIC directement
  // depuis chaque navigateur, donc chaque visiteur, sous son IP.
  //
  // 🔴 ET LE DISJONCTEUR NE VOIT RIEN PASSER. Le point d'accès public limite par
  // adresse IP (deux créneaux) : modélisé, 16 des 18 repartent en 429. Or un 429
  // est une `ErreurRequeteOverpass`, qui n'ouvre PAS le repos de 60 s — à raison,
  // c'est écrit là-bas : couper l'eau partout sur un 429 ponctuel fabriquerait la
  // panne qu'on cherche à éviter. Conséquence : la rafale ne déclenche aucun
  // garde-fou, huit cases sur neuf n'ont d'eau QUAND MÊME PAS, et il ne reste
  // que le coût — 9× le trafic vers un service qui bannit par IP, pendant une
  // campagne de communication. Une extension qui glisse SOUS le seul garde-fou
  // du module n'est pas un effet de bord, c'est le défaut lui-même.
  //
  // ── ROUTE B — une seule requête sur le carré entier (comme la mer). REFUSÉE ─
  //
  // C'est ce que la mer a fait (empriseDeMer, damier-carre.js), et pour la mer
  // c'était juste : son champ est CUIT LOCALEMENT, il ne coûte pas de réseau.
  // Ici la charge grandit avec la surface. Extrapolé des trois points mesurés en
  // tête de ce fichier (Chamonix, le cas CREUX) : 24 km → 10 752 ways / 15 Mo,
  // 46 km → 48 707 / 62 Mo, 91 km → 234 594 / 286 Mo, soit une densité qui monte
  // avec l'emprise (18,7 → 23,0 → 28,3 ways/km²). Un 3×3 à z12 fait 72 km de
  // côté : ~137 000 ways / **~170 Mo**, contre un plafond `OVERPASS_MAXSIZE` de
  // 48 Mo. La requête serait REFUSÉE par le serveur, retomberait sur `null`,
  // donc sur Natural Earth — le bloc central PERDRAIT son eau fine pour que les
  // voisines n'en gagnent aucune. Et Chamonix est le cas creux : le même z12 sur
  // Paris pesait déjà 238 Mo à UN bloc.
  //
  // ── ROUTE C — n'étendre que les sources LOCALES. Sans objet ────────────────
  //
  // Les tuiles (Overture + lacs mondiaux) sont auto-hébergées : les servir aux
  // voisines ne coûterait pas un octet à Overpass. Mais elles ne portent pas la
  // donnée du défaut : au-delà de `OSM_MIN_ZOOM` les LIGNES de rivière viennent
  // d'Overpass et de lui seul ; les tuiles mondiales ne portent QUE des lacs
  // (LAKE_LOD_LEVELS), et les tuiles riches s'arrêtent à la boîte alpine
  // (WATER_REGION, 5-8° E / 44,5-47° N). Hors de cette boîte, une rivière
  // s'arrêterait exactement où elle s'arrête aujourd'hui. Dedans, on collerait
  // une rivière Natural Earth 1:10m au bout d'une rivière Overpass — la source
  // dont la grossièreté a déjà fait RETIRER le liseré de côte de ce fichier
  // (« ses cordes droites coupaient visiblement les caps ») : le trait ne
  // s'arrêterait plus, il ferait un saut latéral à la jointure. On échangerait
  // une coupure franche contre un faux raccord.
  //
  // ── CE QUI RESTE VRAI, ET CE QU'IL FAUDRAIT POUR ROUVRIR ───────────────────
  //
  // L'écart n'est pas nié : sur un damier, la rivière s'arrête à la jointure.
  // La condition de réouverture est UNE et elle est nommable : que l'eau fine ne
  // vienne plus du point d'accès Overpass public appelé par le navigateur de
  // chaque visiteur — soit des tuiles vectorielles auto-hébergées couvrant les
  // zones servies (le chemin déjà pris pour les lacs mondiaux et la boîte
  // alpine), soit une instance Overpass à nous. Les deux déplacent la limite du
  // « combien de requêtes » vers le « combien d'octets on héberge », qui est un
  // coût qu'on maîtrise. Tant que la source est publique et appelée par IP de
  // visiteur, multiplier les emprises est un risque de bannissement qui couperait
  // le calque pour TOUT LE MONDE, pas une dépense de performance.
  //
  // ⚠️ NE PAS « CORRIGER » ÇA EN AJOUTANT UN WaterLayer PAR DALLE sur le patron
  // de `peintCelluleSol` / `peintCelluleNuit` (main.js). Ces deux-là copient des
  // MOSAÏQUES DE TUILES auto-hébergées : leur patron est juste PARCE QUE leur
  // source est locale. Le calque d'eau ne partage pas cette propriété.
  async rebuild({ dem, terrain, params }) {
    const id = ++this._buildId
    _remiseChrono()
    const _tDebut = _mnt()
    this._clear()
    if (!params.waterEnabled || !dem || params.source !== 'real') { this.usingOsm = false; this.loading = false; return }
    const bounds = patchBounds(dem)
    const zoom = params.demZoom ?? 8
    const useOsm = zoom >= OSM_MIN_ZOOM

    // rivers: OSM waterways when zoomed in, else NE river centerlines. Each
    // entry carries its source strokeweight (OSM ways have none, so they
    // fall back to riverWidthPx's default) so widths can vary per feature.
    let riverEntries = null
    let areaParts = null
    let osmOk = false
    if (useOsm) {
      this.loading = true
      const [feats, areas] = await Promise.all([
        fetchOverpassLines(bounds, 'water'),
        fetchOverpassAreas(bounds),
      ])
      this.loading = false
      if (id !== this._buildId || dem !== terrain.dem) return
      if (feats) { riverEntries = filterRiverwayLines(feats).map((f) => ({ ring: f.coords, strokeweight: undefined })); osmOk = true }
      // area fetch is best-effort: failure/throttle just means no filled polygons, lines still render.
      // Overpass areas never carry holes (parseOverpassAreas ignores inner members for v1).
      if (areas) areaParts = areas.map((a) => ({ outer: a.ring, holes: [] }))
    }
    if (!riverEntries) riverEntries = await this._neRiverRings(bounds, zoom)

    // Lakes + other water areas: tiled Overture data when the patch sits
    // inside the covered region AND tiles actually exist for this LOD;
    // otherwise fall back to Natural Earth exactly as before (the rest of
    // the world must keep working exactly as now — NE's `lakes` layer is a
    // coverage problem, not a precision one, but it's the only thing we
    // have outside the built region). Tile-sourced `lake` features get the
    // special "on top, vivid blue" treatment below; every other kept
    // subtype (river/water/canal/pond/reservoir) merges into `areaParts`,
    // the same bucket Overpass water AREAs already feed. `lakeLines` is the
    // flat (holes-as-loops) ring list used for outline drawing; `lakeParts`
    // preserves outer+hole structure for fill (islands must not be filled).
    let lakeLines
    let lakeParts
    let tileOk = false
    if (inRegion(bounds, WATER_REGION)) {
      const manifest = await loadWaterTileManifest()
      const lod = lodForZoom(zoom)
      if (hasTilesForLod(manifest, lod)) {
        const tileFC = await loadWaterTiles(bounds, tileZoomForLod(lod))
        if (id !== this._buildId || dem !== terrain.dem) return
        const tileFeats = clipToPatch(tileFC.features, bounds)
        const tileLakeLines = []
        const tileLakeParts = []
        const tileAreaParts = []
        for (const f of tileFeats) {
          if (f.properties?.subtype === 'lake') {
            tileLakeLines.push(...flatRingsOf(f.geometry))
            tileLakeParts.push(...polygonPartsOf(f.geometry))
          } else {
            tileAreaParts.push(...polygonPartsOf(f.geometry))
          }
        }
        lakeLines = tileLakeLines
        lakeParts = tileLakeParts
        if (tileAreaParts.length) areaParts = [...(areaParts || []), ...tileAreaParts]
        tileOk = true
      }
    }
    // World lake layer (task 19): OUTSIDE the rich-water Alps region (or, on
    // the rare edge where inRegion is true but that LOD's Alps tiles are
    // missing), fall back to the WORLD lake-only tile set instead of jumping
    // straight to Natural Earth. This is what actually fixes the coverage
    // gap NE has everywhere outside the Alps box (1345 lakes worldwide, 3 in
    // all of France) — composition is: in-region = rich water (river/canal/
    // pond/reservoir/water) + lakes from the Alps tiles; out-of-region =
    // lakes ONLY (no river/canal/etc — the world tile set never carries
    // those subtypes) + Natural Earth for coastline (unchanged, below). No
    // region gate here on purpose: LAKE_LOD_LEVELS tiles are written GLOBALLY,
    // so every patch on Earth is eligible, not just ones near the built area.
    let worldLakeOk = false
    if (!tileOk) {
      const lakeManifest = await loadLakeTileManifest()
      const lakeLod = lodForZoom(zoom, LAKE_LOD_LEVELS)
      if (hasTilesForLod(lakeManifest, lakeLod)) {
        const lakeFC = await loadLakeTiles(bounds, tileZoomForLod(lakeLod, LAKE_LOD_LEVELS))
        if (id !== this._buildId || dem !== terrain.dem) return
        const lakeFeats = clipToPatch(lakeFC.features, bounds)
        const worldLakeLines = []
        const worldLakeParts = []
        for (const f of lakeFeats) {
          worldLakeLines.push(...flatRingsOf(f.geometry))
          worldLakeParts.push(...polygonPartsOf(f.geometry))
        }
        lakeLines = worldLakeLines
        lakeParts = worldLakeParts
        worldLakeOk = true
      }
    }
    // Last-resort fallback: neither the Alps tile set nor the world lake
    // tile set had anything for this LOD/patch (e.g. world lake tiles not
    // yet built) — degrade to Natural Earth exactly as before this task.
    if (!tileOk && !worldLakeOk) {
      lakeLines = await this._neRings('lakes', bounds, zoom)
      lakeParts = await this._neParts('lakes', bounds, zoom)
    }

    // Le liseré de côte a été RETIRÉ du site (Adrien). Il venait de la même
    // source Natural Earth 1:10m dont la grossièreté avait déjà fait remplacer
    // la couche des lacs : sur une côte, ses cordes droites coupaient
    // visiblement les caps que le relief et la bathymétrie rendent
    // correctement juste en dessous. La carte se lit mieux nue que mal
    // soulignée — d'où la suppression plutôt qu'un drapeau de plus.
    // ⚠️ AUCUN rapport avec le masque terre-mer (coast-mask.js / uCoastMask) :
    // celui-là ne passe pas par cette couche, et il reste indispensable.
    if (id !== this._buildId || dem !== terrain.dem) return
    // Overture's base/water theme is derived from OSM (ODbL) same as the
    // Overpass paths, so rendering tile-sourced water — Alps rich-water tiles
    // OR world lake-only tiles, same theme/license — requires the same
    // "© OpenStreetMap contributors" credit — refreshOsmCredit() in main.js
    // reads this flag.
    this.usingOsm = osmOk || tileOk || worldLakeOk
    // Tout ce qui précède est du CHARGEMENT (réseau, décodage JSON, découpe à
    // l'emprise) ; tout ce qui suit est de la GÉOMÉTRIE. La frontière est ici.
    chronoEau.sources = _mnt() - _tDebut

    // ══════════ MODE CONTINU : ON TAILLE SUR L'EMPRISE, LE GPU COUPE ═════════
    //
    // Mesuré avant, Chamonix z12 : 186 objets, 16 355 sommets, TOUS dans ±28 —
    // le socle central. L'emprise fait ±84 : huit neuvièmes des rivières et des
    // lacs n'existaient pas. On défilait, l'eau s'en allait, rien ne venait
    // derrière. Et la découpe CPU ne peut pas se refaire par image (étude §5.2 :
    // 10 à 100 ms, pour un budget de 6). On construit donc sur l'emprise entière
    // une fois, et huit plans de coupe rendent la fenêtre au GPU pour rien —
    // ils sont CONSTANTS, le socle restant centré sur l'origine (fenetre-clip.js).
    const fpEmprise = terrain.empriseFootprint?.() ?? null
    const fp = fpEmprise ?? terrain.blockFootprint()
    // ⚠️ LE DRAPAGE SE FAIT EN COORDONNÉES DE CHAMP. `terrain.sample` répond
    // « sous le point AFFICHÉ en x », donc il porte le décalage de fenêtre : une
    // géométrie cuite en coordonnées de champ et drapée avec lui prendrait
    // l'altitude d'un point situé une fenêtre plus loin. Invisible tant que la
    // reconstruction tombe à fenêtre nulle — et faux dès qu'elle tombe pendant
    // un défilement (curseur d'exagération, arrivée du trait de côte).
    // Hors mode continu `fenetre` vaut (0,0) et l'expression est celle d'avant.
    const fen = terrain.fenetre ?? { x: 0, z: 0 }
    const sample = (x, z) => (terrain.sample ? terrain.sample(x - fen.x, z - fen.z) : 0)
    // ⚡ **LE POSEUR — Tâche D16-b.** Hors globe c'est `poseurPlat(sample)`,
    // c'est-à-dire le drapage du dépôt au bit près. Sur le globe, il lit la
    // hauteur DESSINÉE par la sphère et rend des positions de sphère.
    // ⚠️ Construit UNE FOIS par reconstruction : c'est lui qui capture la liste
    // des tuiles portant leurs hauteurs, sans quoi chaque sommet reparcourrait
    // `globe.tiles`.
    const poseur = this._faitPoseur?.({ dem, terrain, params, sample }) ?? poseurPlat(sample)
    this._poseur = poseur
    // ⛔ **PAS DE PLANS DE COUPE EN ESPACE GLOBE.** Ils sont fabriqués en
    // coordonnées de BLOC (`fenetre-clip.js`) : appliqués à une géométrie posée
    // sur la sphère, ils couperaient un demi-hémisphère au lieu d'une fenêtre.
    // La fenêtre continue (`?f3=1`) et le globe ne se croisent pas aujourd'hui —
    // `empriseFootprint()` rend `null` dès que `empriseCote` vaut 1 — mais un
    // jour où ils se croiseraient, c'est ici qu'il faudrait porter les plans, et
    // rien ne le dirait sans cette ligne.
    const plans = fpEmprise && !poseur.globe ? terrain.plansFenetre() : null
    const insideBlock = makeInsideBlock(fp)
    // Computed once per rebuild (depends only on fp) and shared by every
    // filled-ring build below — see buildFilledRing / triangulateAndClip.
    const outline = blockOutline(fp)
    // La résolution du calque, pas celle de la fenêtre (voir le constructeur).
    // `buildLineSegments` la COPIE dans chaque matériau : aucun partage de
    // référence, un export peut donc régler les matériaux sans toucher à cette
    // valeur-ci.
    const resolution = this._resolution
    const ink = params.darkMode ? '#7fb2d6' : '#2b7fc4'
    // Lakes get a distinctly more saturated blue than the general water ink
    // in both themes — "en bleu assez visible" — while still respecting the
    // existing dark-mode ink flip.
    const lakeInk = params.darkMode ? '#63d1ff' : '#0f6fd6'
    // ⚠️ **DEUX PASSES, ET C'EST LE CHRONOMÈTRE QUI L'IMPOSE.** Projeter puis
    // découper anneau par anneau ne permet de chronométrer qu'en payant deux
    // relevés PAR ANNEAU — des dizaines de milliers de relevés dont le coût
    // entrerait dans le chiffre qu'on cherche à lire. En deux passes, c'est
    // quatre relevés par LISTE. Le résultat est identique : `clipPolylineToBlock`
    // ne lit rien d'autre que les points de son propre anneau.
    const clipAll = (ringList) => {
      let t = _mnt()
      const projetes = ringList.map((r) => latlonToWorldPts(r, dem, latLonToWorld))
      chronoEau.projection += _mnt() - t
      t = _mnt()
      const runs = []
      for (const pts of projetes) runs.push(...clipPolylineToBlock(pts, insideBlock, fp.regionOn ? 0.3 : 0.6))
      chronoEau.decoupe += _mnt() - t
      return runs
    }

    // LineSegments2 batches one width per draw call, so per-feature width
    // variation means bucketing river rings by rounded on-screen width (1
    // decimal) and building one batch per bucket — a handful of draw calls
    // instead of one, but rivers actually render thick-to-thin.
    const riverBuckets = new Map()
    for (const { ring, strokeweight } of riverEntries) {
      const w = Math.round(riverWidthPx(strokeweight) * 10) / 10
      if (!riverBuckets.has(w)) riverBuckets.set(w, [])
      riverBuckets.get(w).push(ring)
    }

    const groups = [
      ...[...riverBuckets.entries()].map(([widthPx, rings]) => ({ runs: clipAll(rings), widthPx, color: ink, order: 18 })),
      // lake outline: on top of everything, vivid blue — matches the lake fill below
      { runs: clipAll(lakeLines), widthPx: 1.4, color: lakeInk, order: LAKE_RENDER_ORDER },
    ]
    for (const g of groups) {
      if (!g.runs.length) continue
      const _tT = _mnt()
      const obj = buildLineSegments(g.runs, poseur, { color: g.color, widthPx: g.widthPx, offset: 0.07, renderOrder: g.order, resolution })
      chronoEau.traits += _mnt() - _tT
      obj.traverse((o) => { if (o.material) { o.material.opacity = params.waterOpacity ?? 0.9; _coupeALaFenetre(o.material, plans) } })
      this.group.add(obj)
    }

    // LACS & MERS : TOUJOURS REMPLIS. Ce fut une option (`params.waterFill`),
    // elle ne l'est plus — Adrien, 2026-08-02 : « pas besoin, ça doit toujours
    // être rempli ». Le remplissage est donc INCONDITIONNEL : le `if` a disparu
    // plutôt que d'être figé sur `true`, sinon la branche « sans remplissage »
    // resterait dans le fichier à se faire relire sans jamais s'exécuter.
    //
    // Couvre les AIRES d'eau OSM (rives, corps de lacs, mers au zoom OSM, à
    // largeur réelle variable) ET les polygones Natural Earth `lakes` /
    // tuiles Overture (toujours disponibles, plus grossiers hors zone). Les
    // contours au-dessus continuent d'être tracés, pour la définition.
    {
      const fillOpacity = params.waterOpacity ?? 0.9
      if (areaParts && areaParts.length) {
        const areaMaterial = _fillMaterial(ink, fillOpacity)
        _coupeALaFenetre(areaMaterial, plans)
        const geos = []
        for (const part of areaParts) {
          const geo = buildFilledRing(part, dem, poseur, outline, fp, insideBlock)
          if (geo) geos.push(geo)
        }
        const mesh = _meshFusionne(geos, areaMaterial, 17)
        if (mesh) this.group.add(mesh)
      }
      if (lakeParts.length) {
        // Lakes above everything else, in a clearly-visible blue —
        // LAKE_RENDER_ORDER + polygonOffset (see the constant and
        // _fillMaterial above). depthTest stays on: the terrain still
        // occludes the lake behind a mountain.
        // Lakes get the reflective surface (graded blue + Fresnel + sun glint,
        // see lake-material.js) rather than the flat fill the other water
        // bodies use — a lake is the one water body big enough to read as a
        // surface rather than a line.
        const lakeMaterial = makeLakeMaterial({
          ink: lakeInk,
          sky: this._sun?.sky,
          opacity: fillOpacity,
          half: TERRAIN_SIZE / 2,
          sunDir: this._sun?.dir,
          sunColor: this._sun?.color,
          // ⚠️ **LE NUANCEUR DU LAC A UNE VERTICALE EN DUR** — voir
          // `lake-material.js`. Sur la sphère, `+Y` n'est plus le haut : sans ce
          // repère, le Fresnel et le reflet du soleil sont faux de la latitude
          // du lieu, et la rampe de couleur sature. `null` hors globe : le
          // matériau retrouve alors ses uniformes du dépôt.
          repere: poseur.globe ? poseur.repereLocal(TERRAIN_SIZE / 2) : null,
        })
        _coupeALaFenetre(lakeMaterial, plans)
        this._lakeMats.push(lakeMaterial)
        const geos = []
        for (const part of lakeParts) {
          // ⚠️ `flat: true` NIVELLE CHAQUE LAC SÉPARÉMENT, et c'est pour ça que
          // la fusion vient APRÈS : chaque part reçoit d'abord son propre niveau
          // d'eau (waterLevelOf, la médiane de ses altitudes drapées). Fusionner
          // avant aurait mis Annecy et le Léman au même niveau.
          const geo = buildFilledRing(part, dem, poseur, outline, fp, insideBlock, true)
          if (geo) geos.push(geo)
        }
        const mesh = _meshFusionne(geos, lakeMaterial, LAKE_RENDER_ORDER)
        if (mesh) this.group.add(mesh)
      }
    }
    chronoEau.total = _mnt() - _tDebut
  }
  // La décomposition de la DERNIÈRE reconstruction (voir `chronoEau`) — c'est
  // par là que la sonde la lit dans la page vivante.
  get chrono() { return { ...chronoEau } }
  setVisible(v) { this.group.visible = v }
  setOpacity(v) {
    this.group.traverse((o) => {
      if (!o.material) return
      // the lake surface is a ShaderMaterial — its opacity lives in a uniform,
      // and writing .opacity on it would silently do nothing
      if (o.material.uniforms?.uOpacity) o.material.uniforms.uOpacity.value = v
      else o.material.opacity = v
    })
  }
  dispose() { this._clear() }
}
