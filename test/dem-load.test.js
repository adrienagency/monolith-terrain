// loadDem en conditions de laboratoire : `document`, `fetch` et
// `createImageBitmap` sont bouchonnés, on peut donc éprouver le comportement
// qui compte vraiment — la tuile absente, la panne, le repli, et l'échelle.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM

class FakeCtx {
  constructor(size) {
    this.size = size
    this.rgba = new Uint8ClampedArray(size * size * 4) // tout à 0 : alpha 0 = non peint
  }
  drawImage(img, ...a) {
    // signature courte (img, dx, dy) ou longue (img, sx, sy, sw, sh, dx, dy, dw, dh).
    // La SOUS-FENÊTRE source est réellement échantillonnée : c'est elle qui porte
    // le surzoom, et se tromper de repère (tuile bathy 256 px vs tuile d'altitude
    // 512 px) ne lisait plus qu'un quart de la tuile.
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

// ---------------------------------------------------------------- faux serveur

const ELEV = 1234.5
const RGB = encodeTerrarium(ELEV)
// profondeurs des 4 quarts d'une tuile bathy (NO, NE, SO, SE)
const QUAD_DEPTH = [-1000, -2000, -3000, -4000]

// `plan` décrit le serveur : zmax de couverture, tuiles à faire échouer, panne.
function serve(plan) {
  globalThis.fetch = async (url, opts) => {
    if (url.startsWith('data/bathy/')) {
      if (!plan.bathy) return { ok: false, status: 404 }
      // `bathyZooms` : les seuls niveaux réellement cuits. Sert à éprouver le
      // PLANCHER DE REPLI — un repli trop profond écrase de l'ETOPO1 à 1 852 m
      // par du GEBCO ré-échantillonné à 4 ou 8 km (796 coutures mondiales).
      const zb = +url.split('/')[2]
      if (plan.bathyZooms && !plan.bathyZooms.includes(zb)) return { ok: false, status: 404 }
      // ⚠️ NOS tuiles bathy font 256 px quelle que soit la source d'altitude.
      // Chaque QUART de la tuile porte une profondeur différente : lire la
      // mauvaise sous-fenêtre au surzoom se voit immédiatement.
      return {
        ok: true,
        status: 200,
        blob: async () => ({
          width: 256,
          height: 256,
          at: (x, y) => encodeTerrarium(QUAD_DEPTH[(y < 128 ? 0 : 2) + (x < 128 ? 0 : 1)]),
        }),
      }
    }
    const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.(webp|png)$/)
    const z = +m[1]
    const aws = url.includes('amazonaws')
    if (plan.down && !aws) throw new Error('ECONNREFUSED')
    if (plan.serverError && !aws && opts?.method !== 'HEAD') return { ok: false, status: 503 }
    const zmax = aws ? 15 : plan.zmax
    if (zmax == null || z > zmax) return { ok: false, status: 404 }
    if (opts?.method === 'HEAD') return { ok: true, status: 200 }
    if (plan.missTiles?.includes(`${m[2]},${m[3]}`)) return { ok: false, status: 404 }
    const px = aws ? 256 : 512
    const rgb = plan.landElev != null ? encodeTerrarium(plan.landElev) : RGB
    return { ok: true, status: 200, blob: async () => ({ width: px, height: px, at: () => rgb }) }
  }
}

const { loadDem, _resetTileCaches } = await import('../src/dem.js')
const { _resetDemSource, activeDemSource } = await import('../src/dem-source.js')

beforeEach(() => _resetDemSource())

// Chamonix
const LAT = 45.923
const LON = 6.869

// ---------------------------------------------------------------- l'échelle

test('Mapterhorn : 3 tuiles de 512 px, même EMPRISE au sol qu en 256 px', async () => {
  serve({ zmax: 16 })
  const mt = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  assert.equal(mt.demSource, 'mapterhorn')
  assert.equal(mt.tilePx, 512)
  assert.equal(mt.size, 1536)
  assert.equal(mt.maxZoom, 16)

  _resetDemSource('aws')
  serve({ zmax: 16 })
  const aws = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  assert.equal(aws.tilePx, 256)
  assert.equal(aws.size, 768)

  // ⚠️ LE POINT CRITIQUE : 156543·cos/2^z est la résolution d'une tuile 256 px.
  // Sans le facteur 256/tilePx, extentMeters DOUBLAIT en 512 — bloc à la mauvaise
  // échelle, relief écrasé, damier de voisins désaligné.
  assert.ok(Math.abs(mt.extentMeters - aws.extentMeters) < 1e-6, 'même emprise au sol')
  assert.ok(Math.abs(mt.metersPerPixel * 2 - aws.metersPerPixel) < 1e-9, 'deux fois plus fin')
  assert.equal(mt.originTileX, aws.originTileX)
  assert.equal(mt.originTileY, aws.originTileY)
})

test("l'altitude décodée est la bonne, et le patch est complet", async () => {
  serve({ zmax: 16 })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  assert.ok(Math.abs(dem.data[0] - ELEV) < 0.01)
  assert.ok(Math.abs(dem.meanM - ELEV) < 0.01)
  assert.ok(Math.abs(dem.minM - ELEV) < 0.01 && Math.abs(dem.maxM - ELEV) < 0.01)
})

// ---------------------------------------------------------------- la tuile absente

test('une tuile manquante peint du VIDE et laisse vivre le reste du bloc', async () => {
  // le coin nord-ouest du damier 3×3 manque (bord d'un jeu national)
  serve({ zmax: 16 })
  const ref = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  const n = 2 ** 14
  const cx = Math.floor(((LON + 180) / 360) * n)
  const la = (LAT * Math.PI) / 180
  const cy = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  serve({ zmax: 16, missTiles: [`${cx - 1},${cy - 1}`] })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })

  assert.equal(dem.size, ref.size, 'le bloc garde sa taille')
  // le coin manquant vaut 0 — une ABSENCE de mesure, pas −32768 m (le canevas
  // vierge décodé naïvement donnait « fosse abyssale », cf. bathy.js)
  assert.equal(dem.data[0], 0)
  assert.ok(dem.minM > -1000, `minM absurde : ${dem.minM}`)
  // le reste du bloc porte bien l'altitude
  const centre = (dem.size / 2) * dem.size + dem.size / 2
  assert.ok(Math.abs(dem.data[centre] - ELEV) < 0.01)
  // et les statistiques ignorent les pixels non mesurés
  assert.ok(Math.abs(dem.meanM - ELEV) < 0.01, `meanM pollué : ${dem.meanM}`)
})

test('plus AUCUNE tuile : c est une panne, pas un trou — loadDem lève', async () => {
  serve({ zmax: 16, missTiles: null })
  globalThis.fetch = async (url, opts) => {
    if (url.startsWith('data/bathy/')) return { ok: false, status: 404 }
    if (opts?.method === 'HEAD') return { ok: true, status: 200 }
    return { ok: false, status: 404 }
  }
  await assert.rejects(() => loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false }))
})

// ---------------------------------------------------------------- le repli

test('un 5xx bascule sur AWS, rejoue le chargement, et retient la bascule', async () => {
  serve({ zmax: 16, serverError: true })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  assert.equal(dem.demSource, 'aws', 'le bloc a été rechargé depuis le bucket AWS')
  assert.equal(dem.tilePx, 256, 'le repli revient aussi au 256 px')
  assert.equal(dem.size, 768)
  assert.equal(activeDemSource().id, 'aws', 'la bascule vaut pour la session')
})

test('une panne réseau (DNS/offline) bascule elle aussi sur AWS', async () => {
  serve({ zmax: 16, down: true })
  const dem = await loadDem({ lat: LAT, lon: LON, zoom: 14, bathy: false })
  assert.equal(dem.demSource, 'aws')
  assert.equal(activeDemSource().id, 'aws')
})

test('zone HORS COUVERTURE : AWS pour ce bloc, sans sacrifier la session', async () => {
  // pleine mer — Mapterhorn répond 404 à tous les zooms sondés
  serve({ zmax: null })
  const dem = await loadDem({ lat: 40, lon: -40, zoom: 8, bathy: false })
  assert.equal(dem.demSource, 'aws')
  assert.equal(dem.tilePx, 256)
  assert.equal(
    activeDemSource().id,
    'mapterhorn',
    "un trou de couverture n'est pas une panne : la source de session ne bouge pas"
  )
})

// ---------------------------------------------------------------- bathymétrie

test('la sous-fenêtre bathy se mesure sur la tuile BATHY (256 px), pas sur celle d altitude', async () => {
  // z9 > BATHY_ZMAX(8) : chaque tuile d'altitude relit UN QUART de son ancêtre
  // bathy. Le rectangle SOURCE est en pixels de tuile bathy (256), le rectangle
  // DESTINATION en pixels de tuile d'altitude (512 chez Mapterhorn) — les
  // confondre lisait le quart nord-ouest pour tout le monde.
  serve({ zmax: 12, bathy: true, landElev: 0 }) // terre à 0 = ABSENCE de mesure → la mer parle
  const dem = await loadDem({ lat: 43.0, lon: 5.9, zoom: 9, bathy: true })
  const n = 2 ** 9
  const la = (43.0 * Math.PI) / 180
  const cx = Math.floor(((5.9 + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  const attendu = QUAD_DEPTH[(cy % 2) * 2 + (cx % 2)]
  // centre du bloc = centre de la tuile centrale
  const mid = (dem.size / 2) * dem.size + dem.size / 2
  assert.ok(
    Math.abs(dem.data[mid] - attendu) < 1,
    `quart bathy lu à côté : ${dem.data[mid]} au lieu de ${attendu}`
  )
})

test('le repli bathy s ARRÊTE à z7 : on n écrase plus de l ETOPO1 par du 8 km', async () => {
  // ⚠️ `fuseBathymetry` fait qu au-delà de 25 m de fond la sortie vaut EXACTEMENT
  // la source fine. Un ancêtre z4 (7 968 m au sol à 35°N) remplaçait donc
  // purement et simplement l ETOPO1 du terrarium, qui vaut 1 852 m. Recensé sur
  // 796 coutures mondiales : on dégradait la carte au nom de l améliorer.
  const commun = { zmax: 12, bathy: true, landElev: -1500 } // socle ETOPO1 au large
  const cible = { lat: 43.0, lon: 5.9, zoom: 12, bathy: true }

  serve({ ...commun, bathyZooms: [8] })
  const fin = await loadDem(cible)
  const mid = (fin.size / 2) * fin.size + fin.size / 2
  assert.ok(fin.data[mid] < -900, `la vraie tuile z8 doit parler : ${fin.data[mid]}`)

  _resetTileCaches()
  serve({ ...commun, bathyZooms: [6, 5, 4] }) // il ne reste QUE du repli grossier
  const grossier = await loadDem(cible)
  assert.equal(
    grossier.data[mid],
    -1500,
    `un repli sous z7 doit être refusé et laisser le terrarium : ${grossier.data[mid]}`
  )

  _resetTileCaches()
  serve({ ...commun, bathyZooms: [7] }) // z7 = 996 m, encore 2× mieux qu ETOPO1
  const limite = await loadDem(cible)
  assert.ok(limite.data[mid] < -900, `z7 reste légitime : ${limite.data[mid]}`)
})

test('à z5, une tuile bathy z5 est la résolution NATIVE, pas un repli dégradé', async () => {
  // ⚠️ `modes.js` charge des blocs CONTINENTAUX à z4 et z5. Un plancher absolu
  // à 7 y aurait supprimé toute bathymétrie — le plancher est donc relatif au
  // zoom demandé : on ne descend jamais SOUS lui, on ne lui interdit pas.
  serve({ zmax: 12, bathy: true, landElev: -1500, bathyZooms: [5] })
  const dem = await loadDem({ lat: 43.0, lon: 5.9, zoom: 5, bathy: true })
  const mid = (dem.size / 2) * dem.size + dem.size / 2
  assert.ok(dem.data[mid] < -900, `la bathy continentale a disparu : ${dem.data[mid]}`)
})

test('bout en bout : l agrandissement Catmull-Rom ne déplace PAS le trait de côte', async () => {
  // ⚠️ LA RÈGLE DU MODULE, éprouvée sur le chemin complet. Catmull-Rom dépasse
  // par construction ; ce dépassement ne doit jamais faire bouger un rivage.
  // La terre est ici à +240 m et la source marine hurle −4 000 m sous elle.
  serve({ zmax: 12, bathy: true, landElev: 240 })
  const dem = await loadDem({ lat: 43.0, lon: 5.9, zoom: 13, bathy: true })
  for (let i = 0; i < dem.data.length; i++) {
    assert.ok(Math.abs(dem.data[i] - 240) < 1e-3, `pixel ${i} : la terre a bougé à ${dem.data[i]}`)
  }
})

// ---------------------------------------------------------------- le surzoom

test('au-delà du zoom couvert, on relit l ancêtre (overzoomTile) sans 404', async () => {
  serve({ zmax: 12 }) // l'Everest
  const dem = await loadDem({ lat: 27.988, lon: 86.925, zoom: 15, bathy: false })
  assert.equal(dem.demSource, 'mapterhorn')
  assert.equal(dem.maxZoom, 12)
  assert.equal(dem.zoom, 15, "l'EMPRISE reste celle du zoom demandé")
  assert.equal(dem.size, 1536)
  // tout est peint : la donnée vient de l'ancêtre z12, agrandie
  assert.ok(Math.abs(dem.data[0] - ELEV) < 0.01)
  assert.ok(Math.abs(dem.meanM - ELEV) < 0.01)
})
