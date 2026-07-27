// LE DAMIER NE REDEMANDE PLUS AU RÉSEAU CE QU'IL A DÉJÀ.
//
// Mesuré sur le damier du Var à z12 (docs/superpowers/plans/
// 2026-07-27-damier-optimisation.md) : 6 405 requêtes pour 260 URL uniques,
// 96 % de doublons, 101 s de chargement. Trois causes, une seule couche :
//
//   T1 — le damier resynchronise à CHAQUE arrivée de dalle (main.js :
//        blockGrid.onReady → gpxLayer.rebuildAll → blockGrid.sync). Le cache de
//        MNT, borné à 4 entrées en tuiles 512 px, évinçait les promesses encore
//        EN VOL : chaque resynchro relançait le chargement des dalles en
//        attente. 322 appels de loadDem pour 23 dalles.
//   T2 — loadBathyPatch ne mémorisait que les ABSENCES (bathyMisses). Une tuile
//        trouvée était re-téléchargée par chacune des 9 cases de chaque MNT :
//        2 070 requêtes pour un seul fichier.
//   T3 — aucune déduplication des requêtes en vol, clé = URL.
//
// Le contrat éprouvé ici est le même dans les trois cas et il se compte :
// **le nombre de requêtes émises doit être égal au nombre d'URL distinctes**.
// Un `fetch` bouchonné qui compte les appels par URL le prouve mieux qu'une
// capture d'écran.
//
// ⚠️ ET LA MÉMOIRE PRIME SUR LA VITESSE. Le même rapport mesure 1 762 Mo de tas
// JS sur un damier plein, contre 2 à 4 Go de limite pratique. Grossir le cache
// serait le geste évident et c'est le piège : 25 MNT retenus = 235 Mo de plus.
// La bonne forme est l'inverse — les cellules VIVANTES détiennent déjà leurs
// MNT, le cache doit les relire au lieu d'en garder une seconde copie. Deux
// tests plus bas verrouillent exactement ça.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
// (mêmes bouchons que test/dem-load.test.js — un canevas qui peint vraiment)

class FakeCtx {
  constructor(size) {
    this.size = size
    this.rgba = new Uint8ClampedArray(size * size * 4)
  }
  drawImage(img, ...a) {
    const long = a.length >= 8
    const [sx, sy, sw, sh] = long ? a.slice(0, 4) : [0, 0, img.width, img.height]
    const [dx, dy, dw, dh] = long ? a.slice(4) : [a[0], a[1], img.width, img.height]
    for (let y = dy; y < dy + dh; y++) {
      for (let x = dx; x < dx + dw; x++) {
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue
        const rgb = img.at(sx + ((x - dx) / dw) * sw, sy + ((y - dy) / dh) * sh)
        const i = (y * this.size + x) * 4
        this.rgba[i] = rgb[0]
        this.rgba[i + 1] = rgb[1]
        this.rgba[i + 2] = rgb[2]
        this.rgba[i + 3] = 255
      }
    }
  }
  getImageData() {
    return { data: this.rgba }
  }
}

globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx(c.width))
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// -------------------------------------------------- faux serveur qui COMPTE

const ELEV = 812
const RGB = encodeTerrarium(ELEV)
const FOND = encodeTerrarium(-1200)
const BATHY_Z = 8 // le seul niveau bathy servi (BATHY_ZMAX de dem.js)

const appels = new Map() // url → nombre de requêtes
const total = () => [...appels.values()].reduce((a, b) => a + b, 0)
const uniques = () => appels.size
const pour = (motif) => {
  let n = 0
  for (const [url, k] of appels) if (url.includes(motif)) n += k
  return n
}

function serve({ bathy = true } = {}) {
  appels.clear()
  globalThis.fetch = async (url, opts) => {
    if (opts?.method === 'HEAD') return { ok: true, status: 200 }
    appels.set(url, (appels.get(url) || 0) + 1)
    // un aller-retour réseau n'est jamais synchrone : sans ce tour de boucle,
    // les chargements ne se CHEVAUCHERAIENT pas et la déduplication en vol
    // n'aurait rien à dédupliquer
    await new Promise((r) => setTimeout(r, 0))
    if (url.startsWith('data/bathy/')) {
      const z = +url.match(/data\/bathy\/(\d+)\//)[1]
      if (!bathy || z !== BATHY_Z) return { ok: false, status: 404 }
      return {
        ok: true,
        status: 200,
        blob: async () => ({ width: 256, height: 256, at: () => FOND }),
      }
    }
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, at: () => RGB }) }
  }
}

const { loadDem, _resetTileCaches } = await import('../src/dem.js')
const { _resetDemSource } = await import('../src/dem-source.js')
const { BlockGrid } = await import('../src/block-grid.js')
const { worldToLatLon } = await import('../src/geo.js')
const { TERRAIN_SIZE } = await import('../src/terrain.js')

// AWS : tuiles 256 px, aucun sondage HEAD, couverture mondiale — le laboratoire
// le plus simple pour ne compter QUE les tuiles.
beforeEach(() => {
  _resetDemSource('aws')
  _resetTileCaches?.()
})

// Le Var, cas de référence du rapport
const LAT = 43.45
const LON = 6.25
const ZOOM = 12

// ----------------------------------------------------------------- T3 · en vol

test('deux chargements SIMULTANÉS du même bloc ne demandent chaque tuile qu une fois', async () => {
  serve({ bathy: false })
  const [a, b] = await Promise.all([
    loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false }),
    loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false }),
  ])
  assert.equal(a.size, 768)
  assert.equal(b.size, 768)
  assert.equal(uniques(), 9, 'un bloc, ce sont 9 tuiles')
  assert.equal(total(), uniques(), `${total()} requêtes pour ${uniques()} URL`)
})

// ------------------------------------------------------------------ T2 · bathy

test('une tuile bathy TROUVÉE est mémorisée : une requête, pas neuf par bloc', async () => {
  serve()
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: true })
  // les 9 cases du damier partagent le MÊME ancêtre bathy z8 (z12 → z8 = 1/16)
  assert.equal(pour('data/bathy/'), 1, `${pour('data/bathy/')} requêtes bathy pour un seul fichier`)

  // et le bloc suivant la relit en mémoire, sans toucher au réseau
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: true })
  assert.equal(pour('data/bathy/'), 1, 'la tuite trouvée est redemandée au bloc suivant')
})

test("une tuile bathy ABSENTE reste mémorisée comme absence (pas de régression)", async () => {
  serve({ bathy: false })
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: true })
  const n = pour('data/bathy/')
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: true })
  assert.equal(pour('data/bathy/'), n, 'une absence connue ne se redemande pas')
})

// -------------------------------------------------------------- T1 · le damier

// Le damier réel, avec la boucle qui coûte : main.js rebranche
// `blockGrid.onReady` sur `gpxLayer.rebuildAll`, lequel rappelle `sync()`. Vingt-
// quatre dalles arrivent donc au milieu de vingt-quatre resynchros.
class GrilleTest extends BlockGrid {
  // le MNT et le réseau sont réels ; la géométrie three.js ne l'est pas — ce
  // n'est pas elle qu'on mesure ici
  _buildCell(i, j, nDem) {
    return { i, j, dem: nDem, terrain: null }
  }
}

async function damierPlein({ bathy = true } = {}) {
  serve({ bathy })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const points = []
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (!i && !j) continue
      points.push(worldToLatLon(dem, i * TERRAIN_SIZE, j * TERRAIN_SIZE))
    }
  }
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => dem })
  appels.clear() // on ne compte QUE le damier, pas le bloc central
  grid.onReady = () => grid.sync(points) // exactement ce que fait main.js
  grid.sync(points)
  for (let i = 0, stable = 0; i < 800 && stable < 25; i++) {
    await new Promise((r) => setTimeout(r, 0))
    if (grid.cells.size >= 24) stable++
  }
  return grid
}

test('un damier de 24 dalles ne charge chaque MNT qu une fois, malgré 24 resynchros', async () => {
  const grid = await damierPlein()
  assert.equal(grid.cells.size, 24, 'le damier est bien plein')
  // 24 dalles × 9 tuiles d'altitude + les ancêtres bathy partagés
  assert.equal(pour('elevation-tiles-prod'), 216, `${pour('elevation-tiles-prod')} requêtes d altitude`)
  assert.equal(total(), uniques(), `${total()} requêtes pour ${uniques()} URL distinctes`)
  assert.ok(total() < 500, `${total()} requêtes — la cible du plan est < 500`)
})

// ------------------------------------------------------- la mémoire d'abord

test('les cellules VIVANTES sont le cache : il ne double aucun MNT', async () => {
  const grid = await damierPlein()
  assert.equal(grid._demPending.size, 0, 'plus aucun chargement en vol')
  // Le point qui compte : 24 dalles vivantes détiennent déjà 24 MNT. Un cache
  // qui en garderait une seconde référence ajouterait jusqu'à 235 Mo à un
  // système mesuré à 1,76 Go. Tant que les dalles vivent, le cache est vide.
  assert.equal(grid._demCache.size, 0, `le cache double ${grid._demCache.size} MNT déjà vivants`)
})

test('un damier démonté ne retient que le budget d octets prévu, pas 24 MNT', async () => {
  const grid = await damierPlein()
  grid.sync([]) // dézoom : plus une seule dalle n'est réclamée
  assert.equal(grid.cells.size, 0)
  // budget INCHANGÉ (32 Mo) : 14 entrées en tuiles 256 px, 3 en 512 px
  assert.ok(grid._demCache.size < 24, `${grid._demCache.size} MNT retenus sur 24 dalles démontées`)
  const octets = [...grid._demCache.values()].reduce((n, d) => n + d.data.byteLength, 0)
  assert.ok(octets <= 32 * 1024 * 1024, `${Math.round(octets / 1048576)} Mo retenus`)
})

test('un MNT déjà détenu par une cellule vivante ne repart PAS sur le réseau', async () => {
  const grid = await damierPlein()
  appels.clear()
  assert.equal(grid._demCache.size, 0, 'le seul détenteur possible est la cellule elle-même')
  const dem = grid.getMainDem()
  const origin = { x: dem.originTileX + 3, y: dem.originTileY }
  const rejoue = await grid._loadCellDem(dem.zoom, origin, 3, 256)
  assert.ok(rejoue?.data, 'le MNT revient bien')
  assert.equal(total(), 0, `${total()} requêtes pour un MNT déjà en mémoire`)
})
