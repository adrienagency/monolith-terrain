// Damier de blocs voisins — quand un tracé GPX déborde du bloc principal aux
// zooms fins (le cas de figure : une course de 90 km sur un patch z12), des
// blocs de terrain de la MÊME taille et du MÊME rendu apparaissent autour du
// bloc central pour porter la suite du tracé. Au dézoom, la trace retient dans
// le bloc principal et les voisins inutiles sont retirés.
//
// C'est aussi la FONDATION du futur système de blocs plus large (demande
// Adrien) : un damier générique, borné à 5×5 (GRID_R = 2 autour du centre),
// où chaque cellule (i,j) couvre le monde [i·56±28, j·56±28] et charge son
// DEM aligné sur la grille de tuiles du bloc central (zéro couture).
//
// Périmètre v1 assumé : les voisins reçoivent la peinture de carte complète
// (hypso, contours, grille, teinte mer — continues d'un bloc à l'autre car
// calculées en world-space) mais PAS la mer animée, le socle, les labels ni
// l'aérien — ce sont des blocs de CONTEXTE, le bloc central reste le héros.

import * as THREE from 'three'
import { Terrain, TERRAIN_SIZE } from './terrain.js'
import { loadDem, demTilePx } from './dem.js'
import { latLonToWorld } from './geo.js'
import { buildSlabWalls } from './plinth.js'
import { fetchCoastMask, COAST_ZOOM_MIN, COAST_ZOOM_MAX } from './coast-mask.js'

export const GRID_R = 2 // rayon du damier : 2 → 5×5 max, centre exclu
const NEIGHBOUR_RES = 384 // maillage des voisins : contexte, pas héros

const clampLat = (lat) => Math.min(85.05, Math.max(-85.05, lat))

// Un segment touche-t-il le rectangle ? (Liang–Barsky). Vrai aussi quand le
// segment y tient TOUT ENTIER — c'est le cas qui compte : un morceau de contour
// entièrement contenu dans une dalle ne croise aucun de ses bords.
function segHitsRect(ax, az, bx, bz, x0, z0, x1, z1) {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dz = bz - az
  const bornes = [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]
  for (const [p, q] of bornes) {
    if (p === 0) {
      if (q < 0) return false // parallèle et déjà dehors
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) return false
      if (t > t0) t0 = t
    } else {
      if (t < t0) return false
      if (t < t1) t1 = t
    }
  }
  return true
}

// point dans un anneau projeté ({x,z}) — lancer de rayon, comme region-mask.js
// mais en coordonnées monde : Mercator est conforme et monotone, l'appartenance
// se conserve d'un espace à l'autre.
function pointInRingXZ(x, z, ring) {
  let dedans = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) dedans = !dedans
  }
  return dedans
}

// QUELLES DALLES DU DAMIER LA ZONE ISOLÉE TOUCHE-T-ELLE ?
//
// Le pendant de cellsForTrack pour le mode isolé (demande Adrien : « si j'isole
// un lieu que j'ai nommé, quand je zoom, des tuiles nouvelles se créent pour
// contenir tout le Var, dans la limite de 5×5 »). Pure et testée — aucun DOM,
// aucun réseau : `parts` est la liste de polygones GeoJSON [[[lon,lat],…],…]
// que rend region-mask.js, `dem` la dalle CENTRALE dont la géoréférence
// s'extrapole linéairement au-delà de ±28 (geo.js latLonToWorld).
//
// ⚠️ ÉCHANTILLONNER LES SOMMETS NE SUFFIT PAS, dans les deux sens :
//   · un long côté droit saute par-dessus une dalle entière sans y poser un
//     seul sommet — d'où le test segment/rectangle ;
//   · au MILIEU d'une grande zone, une dalle n'est traversée par aucun segment
//     du contour et se retrouve pourtant pleine — d'où le test d'appartenance
//     du centre de la dalle.
// Et l'inverse compte autant : une dalle que rien ne touche ne doit PAS naître,
// sinon le damier paie un DEM et un maillage pour afficher du vide. Une simple
// emprise englobante aurait créé toute la diagonale entre deux îlots opposés.
export function cellsForParts(parts, dem, r = GRID_R) {
  const need = new Set()
  if (!parts?.length || !dem) return need
  // projeter une fois pour toutes : latLonToWorld coûte un log2/atan par sommet
  const polys = []
  for (const poly of parts) {
    const rings = []
    for (const ring of poly || []) {
      const pts = []
      for (const c of ring || []) {
        const lon = c?.[0]
        const lat = c?.[1]
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
        pts.push(latLonToWorld(dem, clampLat(lat), lon))
      }
      if (pts.length > 1) rings.push(pts)
    }
    if (rings.length) polys.push(rings)
  }
  if (!polys.length) return need

  const H = TERRAIN_SIZE / 2
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i === 0 && j === 0) continue // le bloc central n'appartient pas au damier
      const cx = i * TERRAIN_SIZE
      const cz = j * TERRAIN_SIZE
      const x0 = cx - H
      const x1 = cx + H
      const z0 = cz - H
      const z1 = cz + H
      let touche = false
      for (const rings of polys) {
        for (const ring of rings) {
          for (let k = 1; k < ring.length && !touche; k++) {
            const a = ring[k - 1]
            const b = ring[k]
            if (segHitsRect(a.x, a.z, b.x, b.z, x0, z0, x1, z1)) touche = true
          }
          if (touche) break
        }
        if (touche) break
        // aucun contour ne la traverse : la dalle est-elle NOYÉE dans la zone ?
        if (pointInRingXZ(cx, cz, rings[0])) {
          let trou = false
          for (let h = 1; h < rings.length; h++) if (pointInRingXZ(cx, cz, rings[h])) trou = true
          if (!trou) touche = true
        }
        if (touche) break
      }
      if (touche) need.add(`${i},${j}`)
    }
  }
  return need
}
// LRU des DEM voisins (clé zoom:tileX,tileY). ⚠️ CE CACHE PÈSE : un DEM en
// tuiles 256 px fait 768² flottants (2,3 Mo), le même en tuiles 512 px en fait
// 1536² (9,4 Mo). Garder 12 entrées coûtait 28 Mo, il en coûterait 113 — pour
// des blocs qui ne sont même plus affichés. On borne donc le cache en MÉMOIRE,
// pas en nombre d'entrées.
const DEM_CACHE_BYTES = 32 * 1024 * 1024
const demCacheMaxFor = (tilePx, tilesAcross) =>
  Math.max(4, Math.floor(DEM_CACHE_BYTES / ((tilesAcross * tilePx) ** 2 * 4)))

export class BlockGrid {
  // getMainDem() → DEM central ; getMainTerrain() → Terrain central (teinte
  // continue) ; getPlinth() → le socle principal (matériau + baseY partagés,
  // pour donner aux voisins EXACTEMENT la même finition)
  constructor({ scene, params, getMainDem, getMainTerrain, getPlinth }) {
    this.scene = scene
    this.params = params
    this.getMainDem = getMainDem
    this.getMainTerrain = getMainTerrain
    this.getPlinth = getPlinth
    this.cells = new Map() // "i,j" → { terrain, dem, key }
    this._demCache = new Map() // LRU zoom:tx,ty → Promise<dem>
    this._syncId = 0 // invalide les chargements d'une synchro périmée
    // Contour de la zone ISOLÉE, s'il y en a une. C'est un ÉTAT du damier et
    // pas un argument de sync() pour une raison précise : sync est rappelée de
    // partout (re-drapage GPX, arrivée d'un voisin, fermeture d'un parcours), et
    // le moindre appel qui ignorerait la zone raserait ses dalles — puis les
    // rebâtirait au passage suivant, en boucle.
    this.regionParts = null
    this.onReady = null // (cell) => {} — un voisin vient d'arriver (re-drapage GPX)
    this.onGridChanged = null // () => {} — le damier a gagné/perdu une cellule
    this.onCoastReady = null // (cell) => {} — son trait de côte est arrivé (re-découpe de zone)
  }

  // rayon MONDE couvert par le damier au-delà du bloc central (0 si aucun
  // voisin) : sert au trafic aérien pour qu'un avion traverse d'une dalle à la
  // suivante sans coupure au lieu de disparaître au bord du bloc central.
  spanRadius() {
    let r = 0
    for (const cell of this.cells.values()) r = Math.max(r, Math.abs(cell.i), Math.abs(cell.j))
    return r * TERRAIN_SIZE
  }

  // Quelles cellules le tracé touche-t-il ? (coordonnées monde CONTINUES du
  // DEM central — latLonToWorld extrapole linéairement au-delà de ±28.)
  cellsForTrack(points) {
    const dem = this.getMainDem()
    const need = new Set()
    if (!dem || !points?.length) return need
    for (const p of points) {
      const w = latLonToWorld(dem, p.lat, p.lon)
      const i = Math.round(w.x / TERRAIN_SIZE)
      const j = Math.round(w.z / TERRAIN_SIZE)
      if (i === 0 && j === 0) continue
      if (Math.abs(i) > GRID_R || Math.abs(j) > GRID_R) continue // hors damier 5×5
      need.add(`${i},${j}`)
    }
    return need
  }

  // Le contour de la zone isolée que le damier doit porter (null = plus de
  // zone). L'appelant enchaîne avec sync() pour que le damier se refasse.
  setRegionParts(parts) {
    this.regionParts = parts?.length ? parts : null
  }

  // Toutes les dalles réclamées : celles du tracé GPX ET celles de la zone
  // isolée. Les deux raisons de faire grandir le damier cohabitent — isoler une
  // région pendant qu'un parcours est chargé ne doit rien retirer à l'autre.
  cellsNeeded(points) {
    const dem = this.getMainDem()
    const need = this.cellsForTrack(points)
    if (dem && this.regionParts) for (const key of cellsForParts(this.regionParts, dem)) need.add(key)
    return need
  }

  // (Re)synchronise le damier sur le tracé courant : charge les cellules
  // manquantes, retire celles devenues inutiles (dézoom, recadrage, clear).
  sync(points) {
    const dem = this.getMainDem()
    const need = dem ? this.cellsNeeded(points) : new Set()
    const syncId = ++this._syncId
    // retirer l'inutile
    let changed = false
    for (const [key, cell] of this.cells) {
      if (!need.has(key)) {
        this._disposeCell(cell)
        this.cells.delete(key)
        changed = true
      }
    }
    if (changed) this.onGridChanged?.()
    if (!dem) return
    // charger le manquant
    // ⚠️ le damier ALIGNE les voisins sur la grille de tuiles du bloc central
    // (originTileX ± tilesAcross) : compter les tuiles avec 256 en dur pendant
    // que le DEM en sert des 512 doublait le pas et ouvrait une couture d'un
    // bloc entier entre le centre et ses voisins.
    const tilesAcross = Math.round(dem.size / demTilePx(dem))
    for (const key of need) {
      if (this.cells.has(key)) {
        // zone/zoom du centre a changé ? re-seat la cellule
        const cell = this.cells.get(key)
        if (cell.centerKey === this._centerKey(dem)) continue
        this._disposeCell(cell)
        this.cells.delete(key)
      }
      const [i, j] = key.split(',').map(Number)
      const origin = { x: dem.originTileX + i * tilesAcross, y: dem.originTileY + j * tilesAcross }
      this._loadCellDem(dem.zoom, origin, tilesAcross, demTilePx(dem))
        .then((nDem) => {
          if (syncId !== this._syncId || this.cells.has(key)) return // synchro périmée
          const cell = this._buildCell(i, j, nDem)
          cell.centerKey = this._centerKey(dem)
          this.cells.set(key, cell)
          this.onReady?.(cell)
          this.onGridChanged?.()
        })
        .catch(() => {}) // tuile océan absente etc. — la cellule reste vide
    }
  }

  _centerKey(dem) {
    return `${dem.zoom}:${dem.originTileX},${dem.originTileY}`
  }

  _loadCellDem(zoom, origin, tilesAcross, tilePx = 256) {
    const key = `${zoom}:${origin.x},${origin.y}`
    if (this._demCache.has(key)) {
      const p = this._demCache.get(key)
      this._demCache.delete(key)
      this._demCache.set(key, p) // ré-insertion = most-recently-used
      return p
    }
    const p = loadDem({ lat: 0, lon: 0, zoom, tilesAcross, originTile: origin })
    this._demCache.set(key, p)
    const max = demCacheMaxFor(tilePx, tilesAcross)
    while (this._demCache.size > max) {
      const oldest = this._demCache.keys().next().value
      this._demCache.delete(oldest)
    }
    return p
  }

  _buildCell(i, j, nDem) {
    // params voisin : même apparence, maillage réduit (contexte)
    const p = { ...this.params, resolution: Math.min(this.params.resolution ?? NEIGHBOUR_RES, NEIGHBOUR_RES) }
    // CONTINUITÉ VERTICALE : le sampler élève en (raw - meanM)·scale — chaque
    // bloc doit partager la référence meanM du bloc CENTRAL, sinon les
    // jointures marquent des falaises fantômes. (extentMeters : même zoom →
    // même échelle, rien d'autre à harmoniser.)
    const main = this.getMainDem()
    const dem = main ? { ...nDem, meanM: main.meanM } : nDem
    const terrain = new Terrain(p, { offset: { x: i * TERRAIN_SIZE, z: j * TERRAIN_SIZE } })
    terrain.setDem(dem)
    terrain.rebuild(p)
    // CONTINUITÉ DE TEINTE : la rampe hypsométrique se normalise par bloc —
    // aligner la plage de hauteurs sur celle du bloc central
    const mt = this.getMainTerrain?.()
    if (mt) terrain.mapUniforms.uHeightRange.value.copy(mt.mapUniforms.uHeightRange.value)
    this.scene.add(terrain.mesh)

    const cell = { i, j, terrain, dem }
    // SOCLE : mêmes murs que le bloc principal (matériau partagé → suit le
    // panneau Block), baseY plafonné au socle central pour un fond de damier
    // plat sans percer un voisin plus profond
    const plinth = this.getPlinth?.()
    if (plinth?.wallMat && plinth.group?.visible !== false) {
      const cornerR = Math.min(TERRAIN_SIZE / 2 - 0.05, Math.max(0.05, (this.params.slabCorner ?? 0) * TERRAIN_SIZE))
      const { geo } = buildSlabWalls(terrain.sample, {
        depth: plinth.depth ?? 7,
        resolution: p.resolution,
        cornerR,
        cornerExp: 2,
        baseYFloor: plinth.baseY,
      })
      const walls = new THREE.Mesh(geo, plinth.wallMat)
      walls.castShadow = true
      walls.receiveShadow = true
      walls.position.set(i * TERRAIN_SIZE, 0, j * TERRAIN_SIZE)
      this.scene.add(walls)
      cell.walls = walls
    }
    // dès la naissance, la cellule porte le matériau/shader de la dalle centrale
    this._applyLook(cell, this.params)
    // masque côtier de LA cellule : chaque voisin a SON dem/footprint, le
    // masque du bloc central ne le couvre pas — sans le sien, ses polders
    // sous le niveau 0 seraient peints en mer par la règle altitude. Async,
    // non bloquant ; échec/hors bande → repli altitude comme avant. La
    // texture appartient à la cellule (disposée avec elle, cf. _disposeCell).
    if (dem.zoom >= COAST_ZOOM_MIN && dem.zoom <= COAST_ZOOM_MAX) {
      fetchCoastMask({ lat: 0, lon: 0, zoom: dem.zoom, dem })
        .then((res) => {
          if (!res) return
          if (cell.disposed) { res.maskTexture.dispose(); return } // cellule retirée pendant le fetch
          const cv = res.maskCanvas
          const img = cv ? cv.getContext('2d').getImageData(0, 0, cv.width, cv.height) : null
          cell.coastImage = img // la découpe de zone la relit pour garder les polders
          terrain.setCoastMask(res.maskTexture, img) // relance aussi son sea mask (polders)
          this.onCoastReady?.(cell)
        })
        .catch(() => {})
    }
    return cell
  }

  // Hauteur du sol à un point monde QUELCONQUE du damier (drapage GPX hors du
  // bloc central) — null si aucune cellule chargée ne couvre le point.
  heightAt(x, z) {
    const i = Math.round(x / TERRAIN_SIZE)
    const j = Math.round(z / TERRAIN_SIZE)
    if (i === 0 && j === 0) return null // le bloc central appartient à terrain.sample
    const cell = this.cells.get(`${i},${j}`)
    if (!cell?.terrain?.sample) return null
    return cell.terrain.sample(x - i * TERRAIN_SIZE, z - j * TERRAIN_SIZE)
  }

  // opacité de la photo aérienne (slider Map) → toutes les cellules
  setAerialOpacity(v) {
    for (const cell of this.cells.values()) cell.terrain?.setAerialOpacity?.(v)
  }
  setAerialCoastFade(v) {
    for (const cell of this.cells.values()) cell.terrain?.setAerialCoastFade?.(v)
  }

  // le look a changé (template, contours, rampe, MATÉRIAU…) — les voisins
  // suivent la dalle PRINCIPALE comme un composant (Adrien) : même rampe, même
  // matériau/relief/shader de surface. Ce qui doit rester PROPRE à chaque dalle
  // ne bouge pas : topographie (géométrie/DEM) et photo aérienne (uAerial posé
  // par paintCellAerial), jamais retouchées ici.
  restyle(params) {
    const mt = this.getMainTerrain?.()
    for (const cell of this.cells.values()) this._applyLook(cell, params, mt)
  }
  _applyLook(cell, params, mt = this.getMainTerrain?.()) {
    const t = cell.terrain
    if (!t) return
    const p = { ...params, resolution: Math.min(params.resolution ?? NEIGHBOUR_RES, NEIGHBOUR_RES) }
    // COLORISATION : le mode (Classique / Naturel) et ses réglages DOIVENT
    // passer ici, sinon la couture au bord du bloc central saute aux yeux — un
    // voisin resté en rampe 1D à côté d'un centre peigné et voilé. setColorMode
    // recuit aussi le LUT de la rampe, il remplace donc rebuildRamp.
    t.setColorMode?.(p.colorMode, p)
    t.updateMaterial?.(p)
    t.setMaterialMode?.(p.terrainSurfaceMat || '', p)
    t.setLiquidMetal?.(!!p.liquidMetal, p)
    t.setSurfaceFx?.(p.surfaceFx | 0)
    if ((p.surfaceFx | 0) > 0 && p.fx?.[p.surfaceFx]) t.applyFxParams?.(p.fx[p.surfaceFx])
    t.setAerialCoastFade?.(p.aerialCoastFade ?? 0.1)
    // continuité de teinte : aligner la plage hypsométrique sur le bloc central
    if (mt) t.mapUniforms.uHeightRange.value.copy(mt.mapUniforms.uHeightRange.value)
  }

  clear() {
    this._syncId++
    const had = this.cells.size
    for (const cell of this.cells.values()) this._disposeCell(cell)
    this.cells.clear()
    if (had) this.onGridChanged?.()
  }

  _disposeCell(cell) {
    cell.disposed = true // gèle les fetchs async encore en vol (masque côtier)
    cell.aerial?.dispose?.() // AerialLayer dédié de la cellule (posé par main.js)
    if (cell.walls) {
      this.scene.remove(cell.walls)
      cell.walls.geometry?.dispose() // le matériau des murs est PARTAGÉ (socle principal) — ne pas disposer
    }
    const t = cell.terrain
    if (!t) return
    this.scene.remove(t.mesh)
    t.mesh.geometry?.dispose()
    t.material?.dispose()
    // textures créées PAR instance (le damier churn au fil des zooms) —
    // uAnalysis en fait partie : une RGBA à la taille du DEM (2,3 Mo avec ses
    // mipmaps en tuiles 256 px, ~12 Mo en tuiles 512 px — Mapterhorn), l'oublier
    // ici serait de loin la plus grosse fuite VRAM du lot
    for (const u of ['uRampTex', 'uSeaMask', 'uRegionMask', 'uCoastMask', 'uAnalysis']) {
      const tex = t.mapUniforms?.[u]?.value
      tex?.dispose?.()
    }
    // placeholders 1px par instance : plus la valeur courante quand un vrai
    // masque les a remplacés — les disposer aussi (double dispose inoffensif)
    t._coastPlaceholder?.dispose?.()
    t._seaPlaceholder?.dispose?.()
    t._analysisPlaceholder?.dispose?.()
    t.material?.roughnessMap?.dispose?.()
    t.material?.bumpMap?.dispose?.()
  }
}
