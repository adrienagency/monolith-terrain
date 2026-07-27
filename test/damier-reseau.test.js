// LE DAMIER NE REDEMANDE PLUS AU RÉSEAU CE QU'IL A DÉJÀ.
//
// TOUS LES CHIFFRES DE TERRAIN CITÉS ICI VIENNENT D'UNE SEULE CAMPAGNE, celle
// du rapport docs/superpowers/plans/2026-07-27-damier-optimisation.md (« Le
// Var » isolé, z11 → z12, Mapterhorn en tuiles 512 px) : 6 405 requêtes pour
// 260 URL uniques, 96 % de doublons, 101 s de chargement, 1 762 Mo de tas JS.
// Ce banc-ci, lui, tourne sur AWS en tuiles 256 px et ses propres comptes sont
// annoncés comme mesures de BANC. Trois causes, une seule couche :
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
// capture d'écran. Et il vaut pour ce qui ÉCHOUE autant que pour ce qui arrive :
// une dalle hors couverture n'était retenue par aucune mémoire, donc relancée à
// chaque arrivée voisine (dernier test du fichier).
//
// ⚠️ ET LA MÉMOIRE PRIME SUR LA VITESSE. Le même rapport mesure 1 762 Mo de tas
// JS sur un damier plein, contre 2 à 4 Go de limite pratique. Grossir le cache
// serait le geste évident et c'est le piège : 25 MNT retenus = 235 Mo de plus.
// La bonne forme est l'inverse — les cellules VIVANTES détiennent déjà leurs
// MNT, le cache doit les relire au lieu d'en garder une seconde copie, et le
// rendre au lieu d'en garder un double. Le test du cycle détacher/rattacher
// verrouille exactement ça — et c'est le SEUL montage qui l'exerce : sur un
// damier tout neuf, aucune cellule n'est jamais détruite, donc un cache vide y
// est vrai par construction et ne prouve rien.

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

// z/x/y d'une URL de tuile — sert à découper des trous de couverture
const tuileXYZ = (url) => url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/).slice(1).map(Number)

// `tuileMorte(z, x, y)` → 404 sur cette tuile d'altitude. Neuf 404 sur les neuf
// cases d'un MNT et loadDem LÈVE (painted === 0) : c'est le bord d'un jeu
// national, le cas normal d'un damier à cheval sur une limite de couverture.
function serve({ bathy = true, tuileMorte = null } = {}) {
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
    if (tuileMorte?.(...tuileXYZ(url))) return { ok: false, status: 404 }
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
  assert.equal(pour('data/bathy/'), 1, 'la tuile trouvée est redemandée au bloc suivant')
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

// tourne la boucle d'événements jusqu'à ce que `pret()` soit vrai depuis
// `stable` tours d'affilée (le damier doit être arrivé ET s'être tu)
async function jusquA(pret, { stable = 25, max = 800 } = {}) {
  for (let i = 0, n = 0; i < max && n < stable; i++) {
    await new Promise((r) => setTimeout(r, 0))
    n = pret() ? n + 1 : 0
  }
}

// les 24 points, un par dalle du damier 5×5 (centre exclu)
function pointsDuDamier(dem, cellules = null) {
  const points = []
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (!i && !j) continue
      if (cellules && !cellules.has(`${i},${j}`)) continue
      points.push(worldToLatLon(dem, i * TERRAIN_SIZE, j * TERRAIN_SIZE))
    }
  }
  return points
}

async function damierPlein({ bathy = true } = {}) {
  serve({ bathy })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const points = pointsDuDamier(dem)
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => dem })
  appels.clear() // on ne compte QUE le damier, pas le bloc central
  grid.onReady = () => grid.sync(points) // exactement ce que fait main.js
  grid.sync(points)
  await jusquA(() => grid.cells.size >= 24)
  return { grid, points, dem }
}

test('un damier de 24 dalles ne charge chaque MNT qu une fois, malgré 24 resynchros', async () => {
  const { grid } = await damierPlein()
  assert.equal(grid.cells.size, 24, 'le damier est bien plein')
  // 24 dalles × 9 tuiles d'altitude + les ancêtres bathy partagés
  assert.equal(pour('elevation-tiles-prod'), 216, `${pour('elevation-tiles-prod')} requêtes d altitude`)
  assert.equal(total(), uniques(), `${total()} requêtes pour ${uniques()} URL distinctes`)
  assert.ok(total() < 500, `${total()} requêtes — la cible du plan est < 500`)
})

// ------------------------------------------------------- la mémoire d'abord

// ⚠️ CE TEST DOIT POUVOIR ÉCHOUER. Sa version d'origine se contentait de
// `_demCache.size === 0` sur un damier tout neuf : comme rien n'y est jamais
// DÉTRUIT et que le cache ne se remplit que par _disposeCell, l'assertion était
// vraie par construction du montage — elle ne verrouillait rien. Le seul
// scénario qui l'exerce est le cycle complet, celui du dézoom qui va et vient :
// détacher, puis rattacher. Il échouait avant la correction du dessaisissement
// (delete + set = simple MRU : le cache gardait les 14 entrées que des cellules
// vivantes détenaient déjà).
test('détacher puis rattacher : un MNT rendu par le cache le QUITTE', async () => {
  const { grid, points, dem } = await damierPlein()
  assert.equal(grid._demPending.size, 0, 'plus aucun chargement en vol')
  assert.equal(grid._demCache.size, 0, `le cache double ${grid._demCache.size} MNT déjà vivants`)

  // 1. dézoom partiel : on ne garde que la couronne i = -2, les 20 autres
  // dalles meurent et leurs MNT passent au cache des détachés
  const garde = new Set(['-2,-2', '-2,-1', '-2,0', '-2,1', '-2,2'])
  grid.sync(pointsDuDamier(dem, garde))
  await jusquA(() => grid.cells.size === 5, { stable: 5 })
  assert.equal(grid.cells.size, 5)
  const detaches = grid._demCache.size
  assert.ok(detaches > 0, 'le cache doit avoir recueilli les MNT détachés, sinon le test ne prouve rien')

  // 2. retour : les dalles renaissent, une partie de leurs MNT sort du cache
  appels.clear()
  grid.sync(points)
  await jusquA(() => grid.cells.size >= 24)
  assert.equal(grid.cells.size, 24, 'le damier est revenu au complet')

  // 3. l'invariant : un MNT est SOIT dans une cellule, SOIT dans le cache.
  const vivants = new Set([...grid.cells.values()].map((c) => c.demRaw))
  const doubles = [...grid._demCache.values()].filter((d) => vivants.has(d))
  assert.equal(doubles.length, 0, `${doubles.length} MNT du cache sont déjà détenus par une cellule vivante`)
  assert.ok(
    grid._demCache.size < detaches,
    `le cache est resté à ${grid._demCache.size} entrées : il n'a rien rendu, il a seulement recopié`
  )
})

test('un damier démonté ne retient que le budget d octets prévu, pas 24 MNT', async () => {
  const { grid } = await damierPlein()
  grid.sync([]) // dézoom : plus une seule dalle n'est réclamée
  assert.equal(grid.cells.size, 0)
  // budget INCHANGÉ (32 Mo) : 14 entrées en tuiles 256 px, 3 en 512 px
  assert.ok(grid._demCache.size < 24, `${grid._demCache.size} MNT retenus sur 24 dalles démontées`)
  const octets = [...grid._demCache.values()].reduce((n, d) => n + d.data.byteLength, 0)
  assert.ok(octets <= 32 * 1024 * 1024, `${Math.round(octets / 1048576)} Mo retenus`)
})

test('un MNT déjà détenu par une cellule vivante ne repart PAS sur le réseau', async () => {
  const { grid } = await damierPlein()
  appels.clear()
  assert.equal(grid._demCache.size, 0, 'le seul détenteur possible est la cellule elle-même')
  const dem = grid.getMainDem()
  const origin = { x: dem.originTileX + 3, y: dem.originTileY }
  const rejoue = await grid._loadCellDem(dem.zoom, origin, 3)
  assert.ok(rejoue?.data, 'le MNT revient bien')
  assert.equal(total(), 0, `${total()} requêtes pour un MNT déjà en mémoire`)
})

// ------------------------------------------- le centre bouge pendant un vol

// LA PARTIE LA PLUS DÉLICATE DU CORRECTIF. Un MNT de voisin n'a de sens que
// SOUS le bloc central qui l'a commandé : il est aligné sur sa grille de tuiles
// et partage son meanM. Ce qu'une arrivée doit donc vérifier, c'est la
// GÉORÉFÉRENCE du centre — ni un numéro de synchro (il périmait des MNT encore
// justes : main.js resynchronise à chaque arrivée), ni l'identité de l'objet
// DEM (le centre est rechargé, donc remplacé, même quand il revient au même
// endroit). Les deux tests qui suivent sont les deux faces de cette garde.

test('le centre a bougé pendant le vol : la dalle NE se pose PAS', async () => {
  serve({ bathy: false })
  const avant = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  // un centre franchement ailleurs (≈ 2° à l'est) : autre origine de tuiles
  const apres = await loadDem({ lat: LAT, lon: LON + 2, zoom: ZOOM, bathy: false })
  assert.notEqual(avant.originTileX, apres.originTileX, 'les deux centres doivent différer')

  let centre = avant
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => centre })
  const points = pointsDuDamier(avant)
  appels.clear()
  grid.sync(points) // les 24 chargements partent, alignés sur `avant`
  centre = apres // …et le bloc central change SOUS eux, avant tout atterrissage
  await jusquA(() => grid._demPending.size === 0, { stable: 5 })

  assert.equal(grid.cells.size, 0, `${grid.cells.size} dalles posées sous un centre qui n'est plus le leur`)
  // et le travail n'est pas perdu pour autant : les MNT orphelins sont au cache
  assert.ok(grid._demCache.size > 0, 'les MNT arrivés sans porteur doivent rejoindre le cache des détachés')
})

test('le centre est rechargé À LA MÊME PLACE : la dalle se pose quand même', async () => {
  serve({ bathy: false })
  const avant = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const memeEndroit = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  assert.notEqual(avant, memeEndroit, 'deux OBJETS distincts…')
  assert.equal(avant.originTileX, memeEndroit.originTileX, '…pour la même géoréférence')

  let centre = avant
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => centre })
  appels.clear()
  grid.sync(pointsDuDamier(avant))
  centre = memeEndroit // rechargement du centre pendant le vol (re-drapage, restyle…)
  await jusquA(() => grid.cells.size >= 24)
  assert.equal(grid.cells.size, 24, 'un MNT encore juste ne doit pas être jeté')
})

// -------------------------------------------------- une dalle en ÉCHEC

test("une dalle en échec ne se redemande pas à chaque arrivée de voisine", async () => {
  // le damier à cheval sur un bord de couverture : la colonne i = +2 n'existe
  // pas (404), ses 5 dalles lèvent, les 19 autres arrivent — et chacune de ces
  // 19 arrivées déclenche une resynchro (onReady → sync), exactement main.js.
  serve({ bathy: false })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const xMort = dem.originTileX + 2 * 3 // origine de la colonne i = +2
  serve({ bathy: false, tuileMorte: (z, x) => x >= xMort })

  const points = pointsDuDamier(dem)
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => dem })
  grid.onReady = () => grid.sync(points)
  grid.sync(points)
  await jusquA(() => grid.cells.size >= 19)

  assert.equal(grid.cells.size, 19, 'les 5 dalles hors couverture ne naissent pas, les autres si')
  const mortes = [...appels].filter(([url]) => url.includes('elevation-tiles-prod') && tuileXYZ(url)[1] >= xMort)
  const emises = mortes.reduce((n, [, k]) => n + k, 0)
  assert.equal(
    emises,
    mortes.length,
    `${emises} requêtes pour ${mortes.length} URL mortes : un échec non mémorisé relance la tempête`
  )
  assert.equal(mortes.length, 45, '5 dalles mortes × 9 tuiles')
})

test('… mais elle se redemande une fois le TTL passé : la mémoire des échecs oublie', async () => {
  // le pendant du test précédent, et il compte autant : mémoriser un échec ne
  // doit pas condamner une dalle pour la session. Une coupure réseau se répare,
  // et le damier n'a aucun autre moment pour s'en apercevoir.
  serve({ bathy: false })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const xMort = dem.originTileX + 2 * 3
  serve({ bathy: false, tuileMorte: (z, x) => x >= xMort })

  const points = pointsDuDamier(dem)
  const grid = new GrilleTest({ scene: { add() {}, remove() {} }, params: {}, getMainDem: () => dem })
  grid.onReady = () => grid.sync(points)
  grid.sync(points)
  await jusquA(() => grid.cells.size >= 19)
  assert.equal(grid._demFailed.size, 5, 'les 5 dalles mortes sont retenues comme telles')

  // le réseau revient, et on vieillit les échecs plutôt que d'attendre 60 s
  serve({ bathy: false })
  for (const k of grid._demFailed.keys()) grid._demFailed.set(k, Date.now() - 61_000)
  grid.sync(points)
  await jusquA(() => grid.cells.size >= 24)
  assert.equal(grid.cells.size, 24, 'un échec oublié doit pouvoir être retenté')
})
