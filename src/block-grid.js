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
import { loadDem } from './dem.js'
import { latLonToWorld } from './geo.js'
import { buildSlabWalls } from './plinth.js'

export const GRID_R = 2 // rayon du damier : 2 → 5×5 max, centre exclu
const NEIGHBOUR_RES = 384 // maillage des voisins : contexte, pas héros
const DEM_CACHE_MAX = 12 // LRU des DEM voisins (clé zoom:tileX,tileY)

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
    this.onReady = null // (cell) => {} — un voisin vient d'arriver (re-drapage GPX)
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

  // (Re)synchronise le damier sur le tracé courant : charge les cellules
  // manquantes, retire celles devenues inutiles (dézoom, recadrage, clear).
  sync(points) {
    const dem = this.getMainDem()
    const need = dem ? this.cellsForTrack(points) : new Set()
    const syncId = ++this._syncId
    // retirer l'inutile
    for (const [key, cell] of this.cells) {
      if (!need.has(key)) {
        this._disposeCell(cell)
        this.cells.delete(key)
      }
    }
    if (!dem) return
    // charger le manquant
    const tilesAcross = Math.round(dem.size / 256)
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
      this._loadCellDem(dem.zoom, origin, tilesAcross)
        .then((nDem) => {
          if (syncId !== this._syncId || this.cells.has(key)) return // synchro périmée
          const cell = this._buildCell(i, j, nDem)
          cell.centerKey = this._centerKey(dem)
          this.cells.set(key, cell)
          this.onReady?.(cell)
        })
        .catch(() => {}) // tuile océan absente etc. — la cellule reste vide
    }
  }

  _centerKey(dem) {
    return `${dem.zoom}:${dem.originTileX},${dem.originTileY}`
  }

  _loadCellDem(zoom, origin, tilesAcross) {
    const key = `${zoom}:${origin.x},${origin.y}`
    if (this._demCache.has(key)) {
      const p = this._demCache.get(key)
      this._demCache.delete(key)
      this._demCache.set(key, p) // ré-insertion = most-recently-used
      return p
    }
    const p = loadDem({ lat: 0, lon: 0, zoom, tilesAcross, originTile: origin })
    this._demCache.set(key, p)
    while (this._demCache.size > DEM_CACHE_MAX) {
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

  // le look a changé (template, contours, rampe…) — re-peindre les voisins
  restyle(params) {
    for (const cell of this.cells.values()) {
      const p = { ...params, resolution: Math.min(params.resolution ?? NEIGHBOUR_RES, NEIGHBOUR_RES) }
      cell.terrain.rebuildRamp?.(p)
      cell.terrain.updateMaterial?.(p)
    }
  }

  clear() {
    this._syncId++
    for (const cell of this.cells.values()) this._disposeCell(cell)
    this.cells.clear()
  }

  _disposeCell(cell) {
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
    // textures créées PAR instance (le damier churn au fil des zooms)
    for (const u of ['uRampTex', 'uSeaMask', 'uRegionMask', 'uCoastMask']) {
      const tex = t.mapUniforms?.[u]?.value
      tex?.dispose?.()
    }
    t.material?.roughnessMap?.dispose?.()
    t.material?.bumpMap?.dispose?.()
  }
}
