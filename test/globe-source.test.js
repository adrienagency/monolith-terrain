// LE GLOBE TIRE SON RELIEF DE LA VRAIE SOURCE — ET C'EST UNE POLITIQUE, PAS UNE URL.
//
// Plan « globe continu », Tâche 4 alpha. `src/globe.js` tapait
// `elevation-tiles-prod/terrarium` EN DUR et n'importait rien de
// `src/dem-source.js` : le globe servait donc du AWS 256 px figé à novembre
// 2017 pendant que le produit sert du Mapterhorn 512 px agrégeant l'IGN RGE
// ALTI et swissALTI3D. ⚠️ **Une matière première dégradée se livre sans que
// personne ne s'en aperçoive** — aucune erreur, aucun test rouge.
//
// ⚠️ CE FICHIER EXISTE PARCE QUE LE REBRANCHEMENT NAÏF AURAIT ÉTÉ VERT.
// `TILE_URL = DEM_SOURCES[actif].url` aurait donné une seule source pour la
// planète entière, choisie une fois, au lieu de la meilleure disponible à
// chaque endroit. Les quatre choses qu'il aurait perdues sont ici, chacune avec
// son test :
//
//   1. la SONDE PAR ZONE (`resolveRegionMaxZoom`, zone = tuile z8) ;
//   2. le SURZOOM depuis l'ancêtre quand la zone ne descend pas si bas ;
//   3. le repli AWS **LOCALISÉ** — un 404 n'est pas une panne, et la zone d'à
//      côté doit continuer à profiter de Mapterhorn DANS LA MÊME SESSION ;
//   4. la distinction 404 / panne : seule la seconde replie toute la session.
//
// ⚠️ ET LA CINQUIÈME PROPRIÉTÉ N'EXISTE QUE DANS LE GLOBE : `_pump` est
// SYNCHRONE et la sonde est ASYNCHRONE. Ce que la pompe fait pendant que la
// sonde n'a pas répondu est le vrai sujet de la Tâche 4 alpha, et il a son test.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ═══════════════════════════════════════════════ LES BOUCHONS DOM ════════════
//
// ⚠️ UNE DALLE PAR TAILLE, ET C'EST TOUT LE SUJET DE L'ÉTAPE 5. `fetchTile` lit
// `getImageData(0, 0, px, px)` avec `px` = 256 (AWS) ou 512 (Mapterhorn). Un
// bouchon qui rendrait toujours 256² donnerait des hauteurs NaN sur les trois
// quarts d'une tuile fine, sans rien de rouge.

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)

const dalles = new Map()
function dalleDe(cote) {
  let d = dalles.get(cote)
  if (!d) {
    d = new Uint8ClampedArray(cote * cote * 4)
    for (let i = 0; i < cote * cote; i++) {
      d[i * 4] = ER
      d[i * 4 + 1] = EG
      d[i * 4 + 2] = EB
      d[i * 4 + 3] = 255
    }
    dalles.set(cote, d)
  }
  return d
}

// les canevas rendus, pour prouver la taille réellement dépaquetée
const canevas = []
class FakeCtx {
  constructor(c) {
    this.c = c
  }
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) {
    return { data: dalleDe(w) }
  }
}

globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx(c))
    canevas.push(c)
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// ═══════════════════════════════════════════ LE FAUX SERVEUR DE COUVERTURE ═══
//
// Deux zones z8 VOISINES, deux réponses opposées — c'est le montage qui
// distingue une politique d'une URL. `couverture` est indexée par la zone z8 :
// un nombre = « je descends jusque-là », `null` = « je ne couvre pas ici »
// (404 partout, exactement ce que Mapterhorn rend en pleine mer).

const AWS = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'
const MAPT = 'https://tiles.mapterhorn.com/'

// zone couverte / zone non couverte, calculées depuis les tuiles éprouvées
const ZONE_TERRE = '132,92'
const ZONE_MER = '133,92'

let couverture = new Map()
// ⚠️ LES TROUS DE COUVERTURE **DANS** UNE ZONE COUVERTE. C'est le cas NORMAL au
// bord d'un jeu national : la zone répond, et telle tuile ne répond pas. La
// sonde ne peut pas le voir — elle échantillonne le CENTRE de la zone.
const trous = new Set()
let panneMapterhorn = false
const appels = [] // { url, method }
const gets = () => appels.filter((a) => a.method !== 'HEAD')
const sourceDe = (url) => (url.startsWith(MAPT) ? 'mapterhorn' : 'aws')

function zoneDe(url) {
  const m = /\/(\d+)\/(\d+)\/(\d+)\.\w+$/.exec(url)
  if (!m) return null
  const [z, x, y] = [+m[1], +m[2], +m[3]]
  const s = 2 ** (8 - z)
  return `${Math.floor((x + 0.5) * s)},${Math.floor((y + 0.5) * s)}`
}
const zoomDe = (url) => Number(/\/(\d+)\/\d+\/\d+\.\w+$/.exec(url)[1])

// les sondes qu'on veut RETENIR pour observer la pompe pendant l'attente
let sondesRetenues = null

function serve() {
  appels.length = 0
  canevas.length = 0
  panneMapterhorn = false
  sondesRetenues = null
  trous.clear()
  couverture = new Map([
    [ZONE_TERRE, 15],
    [ZONE_MER, null],
  ])
  globalThis.fetch = async (url, opts) => {
    const method = opts?.method ?? 'GET'
    appels.push({ url, method })
    if (method === 'HEAD' && sondesRetenues) {
      await new Promise((r) => sondesRetenues.push(r))
    } else {
      await new Promise((r) => setTimeout(r, 0))
    }
    if (sourceDe(url) === 'aws') {
      return { ok: true, status: 200, blob: async () => ({ size: 4096, url }) }
    }
    if (panneMapterhorn) return { ok: false, status: 503 }
    if (method !== 'HEAD' && trous.has(url)) return { ok: false, status: 404 }
    const max = couverture.get(zoneDe(url))
    if (max == null || zoomDe(url) > max) return { ok: false, status: 404 }
    return { ok: true, status: 200, blob: async () => ({ size: 4096, url }) }
  }
}

const { Globe, sampleHeights, planTuile, SEUIL_SOURCE_FINE, MAX_Z, _resetTileMemo, _tileMemo } =
  await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const {
  DEM_SOURCES,
  DEFAULT_SOURCE_ID,
  activeDemSource,
  isFallbackActive,
  _resetDemSource,
} = await import('../src/dem-source.js')

function neuf(params = {}) {
  serve()
  _resetTileMemo()
  _resetDemSource()
  const g = new Globe({ globeContinu: true, ...params })
  g.setVisible(true)
  return g
}

// ⚠️ MÊME DÉFINITION QUE `test/globe-profondeur.test.js` : une sonde EN VOL est
// un travail en cours, et une tuile qui l'attend est restée `empty` — ni en vol
// ni dans la file. L'oublier fige le globe au milieu de son premier sondage.
async function calme(globe, max = 20_000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

async function charge(globe, z, x, y, tours = 400) {
  const t = globe._ensureTile(z, x, y)
  for (let i = 0; i < tours; i++) {
    if (t.state === 'ready' || t.state === 'error') return t
    globe._request(t, 1)
    await calme(globe)
    await new Promise((r) => setTimeout(r, 0))
  }
  return t
}

function poseCamera(lat, lon, altM) {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, camera.position)
  camera.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

// les deux tuiles z12 éprouvées, l'une dans chaque zone z8
const T_TERRE = [12, 2119, 1473]
const T_MER = [12, 2130, 1473]

test('le montage est bien celui qu on croit : deux zones z8 VOISINES et OPPOSÉES', () => {
  serve()
  assert.equal(zoneDe(`${MAPT}12/2119/1473.webp`), ZONE_TERRE)
  assert.equal(zoneDe(`${MAPT}12/2130/1473.webp`), ZONE_MER)
  assert.notEqual(ZONE_TERRE, ZONE_MER, 'les deux tuiles éprouvées doivent tomber dans DEUX zones')
})

// ───────────────────────────────────────── ÉTAPE 1 : l'URL vient de la SOURCE

test("l'URL du globe vient de DEM_SOURCES[DEFAULT_SOURCE_ID] sur une zone couverte", async () => {
  const g = neuf()
  const t = await charge(g, ...T_TERRE)
  assert.equal(t.state, 'ready', 'la tuile de la zone couverte n a pas chargé')
  const tuiles = gets().map((a) => a.url)
  const attendue = DEM_SOURCES[DEFAULT_SOURCE_ID].url(...T_TERRE)
  assert.ok(
    tuiles.includes(attendue),
    `le globe n a pas demandé ${attendue} — il a demandé ${JSON.stringify(tuiles.slice(0, 4))}`
  )
  g.dispose()
})

test("la profondeur du globe n'excède jamais le maxZoom de la source active", () => {
  // ⚠️ ON INTERROGE LA SOURCE, PAS UN LITTÉRAL RECOPIÉ : un chiffre recopié
  // dans un test ne rougit pas quand la source change sous lui.
  for (const id of [DEFAULT_SOURCE_ID, 'aws']) {
    assert.ok(
      MAX_Z <= DEM_SOURCES[id].maxZoom,
      `MAX_Z = ${MAX_Z} dépasse le z${DEM_SOURCES[id].maxZoom} de ${id}`
    )
  }
})

test('sous le plancher de couverture de la source fine, le globe reste sur AWS', async () => {
  assert.equal(SEUIL_SOURCE_FINE, DEM_SOURCES[DEFAULT_SOURCE_ID].baseZoom)
  const g = neuf()
  await charge(g, SEUIL_SOURCE_FINE - 1, 1059, 736)
  assert.equal(
    appels.filter((a) => a.method === 'HEAD').length,
    0,
    'une sonde est partie sous le plancher de couverture : elle renseignerait un intervalle que personne ne demande'
  )
  assert.ok(
    gets().every((a) => sourceDe(a.url) === 'aws'),
    'le globe orbital a quitté AWS : la bande z2–z11 est celle du chemin de PRODUCTION'
  )
  g.dispose()
})

// ─────────────────────────── ÉTAPE 1 BIS : la politique, et non une URL unique

test('zone NON couverte → AWS POUR CETTE ZONE, et Mapterhorn continue ailleurs dans la MÊME session', async () => {
  const g = neuf()
  const terre = await charge(g, ...T_TERRE)
  const mer = await charge(g, ...T_MER)

  assert.equal(terre.state, 'ready')
  assert.equal(mer.state, 'ready')
  assert.equal(
    terre.plan.source.id,
    DEFAULT_SOURCE_ID,
    'la zone couverte a été servie par le repli : la sonde par zone est perdue'
  )
  assert.equal(
    mer.plan.source.id,
    'aws',
    'la zone hors couverture n a pas basculé sur AWS : le globe va peindre un plateau plat'
  )
  // ⚠️ L'ASSERTION QUI DISTINGUE UNE POLITIQUE D'UNE URL : le choix de SESSION
  // n'a pas bougé. Un rebranchement naïf aurait ici une source unique.
  assert.equal(
    activeDemSource().id,
    DEFAULT_SOURCE_ID,
    'un 404 a replié la session : un 404 N EST PAS UNE PANNE'
  )
  assert.equal(isFallbackActive(), false)

  // et la preuve par les octets : les deux sources ont servi dans la même session
  const servies = new Set(gets().map((a) => sourceDe(a.url)))
  assert.deepEqual([...servies].sort(), ['aws', 'mapterhorn'])
  g.dispose()
})

test('le surzoom part de l ANCÊTRE quand la zone ne descend pas si bas', async () => {
  const g = neuf()
  couverture.set(ZONE_TERRE, 13) // la zone s arrête à z13
  const t = await charge(g, 15, 2119 * 8, 1473 * 8)
  assert.equal(t.state, 'ready')
  assert.equal(t.plan.source.id, DEFAULT_SOURCE_ID)
  assert.equal(t.plan.tile.z, 13, 'le globe a demandé un zoom que la zone ne sert pas')
  assert.equal(t.plan.tile.scale, 4, 'la sous-fenêtre de l ancêtre n a pas la bonne échelle')
  const fines = gets().filter((a) => sourceDe(a.url) === 'mapterhorn')
  assert.ok(
    fines.every((a) => zoomDe(a.url) <= 13),
    `une tuile au-delà de z13 est partie sur le réseau : ${fines.map((a) => a.url).join(', ')}`
  )
  g.dispose()
})

// ⚠️ LA MUTATION QUI TUE CE TEST : faire du 404 une `DemSourceError` dans
// `tileBitmap`. Elle a SURVÉCU au premier passage des mutations, faute de ce
// test-ci — les autres n'exercent que le 404 de SONDE, où la zone entière
// répond 404 et où la tuile ne part même pas sur la source fine.
test('un 404 sur UNE tuile d une zone COUVERTE : AWS pour cette tuile, session intacte', async () => {
  const g = neuf()
  const trou = DEM_SOURCES[DEFAULT_SOURCE_ID].url(...T_TERRE)
  trous.add(trou)
  const t = await charge(g, ...T_TERRE)
  assert.equal(t.state, 'ready', 'le trou de couverture a laissé un trou à l écran')
  assert.equal(t.size, 256, `la tuile a été servie en ${t.size} px : le repli par tuile n a pas joué`)
  assert.ok(
    gets().some((a) => a.url === trou),
    'la source fine n a même pas été essayée'
  )
  assert.ok(
    gets().some((a) => a.url === DEM_SOURCES.aws.url(...T_TERRE)),
    'AWS n a pas repris la tuile manquante'
  )
  assert.equal(
    activeDemSource().id,
    DEFAULT_SOURCE_ID,
    'un 404 de tuile a replié la SESSION : un 404 n est pas une panne'
  )
  // et la tuile VOISINE, dans la même zone, reste sur la source fine
  const voisine = await charge(g, 12, T_TERRE[1] + 1, T_TERRE[2])
  assert.equal(voisine.size, 512, 'la voisine a été entraînée dans le repli')
  g.dispose()
})

test('une PANNE (5xx), elle, replie la session ENTIÈRE sur AWS', async () => {
  const g = neuf()
  panneMapterhorn = true
  const t = await charge(g, ...T_TERRE)
  assert.equal(t.state, 'ready', 'la tuile n a pas été rattrapée par le repli')
  assert.equal(activeDemSource().id, 'aws', 'la panne n a pas replié la session')
  assert.equal(t.plan.source.id, 'aws')
  g.dispose()
})

// ───────────────────────────────── ÉTAPE 4 : la sonde async contre `_pump` sync

test('pendant que la sonde n a pas répondu, la tuile RESTE `empty` et RIEN ne part', async () => {
  const g = neuf()
  // ⚠️ ON DRAINE D'ABORD LES SEIZE RACINES z2 : `setVisible(true)` appelle
  // `chargeRacines()`, et leurs entrées de file feraient croire que la tuile
  // éprouvée est partie alors qu'elle n'a rien demandé.
  await calme(g)
  appels.length = 0
  sondesRetenues = [] // les HEAD ne se résoudront pas
  const t = g._ensureTile(...T_TERRE)
  g._request(t, 1)
  await new Promise((r) => setTimeout(r, 0))

  // ⚠️ LES TROIS RÉPONSES POSSIBLES, ET CE TEST TUE LES DEUX MAUVAISES :
  //   · « attendre » aurait laissé la tuile `loading` sans requête (le fantôme) ;
  //   · « supposer AWS » aurait fait partir une URL AWS ici même, et perdu
  //     Mapterhorn au premier passage sur chaque zone.
  assert.equal(t.state, 'empty', 'la tuile est passée `loading` sans requête : c est le fantôme permanent')
  assert.equal(g.queue.length, 0, 'une entrée est entrée en file avant que la source soit connue')
  assert.equal(g.inFlight, 0)
  assert.equal(gets().length, 0, 'une tuile est partie sur le réseau avant que la sonde ait répondu')
  assert.ok(appels.some((a) => a.method === 'HEAD'), 'aucune sonde n a été lancée : la tuile attendrait pour rien')
  assert.equal(g._sondes.size, 1, 'la zone n est pas marquée comme sondée : chaque image relancerait une chaîne')

  // ⚠️ ET LA SONDE NE SE RELANCE PAS À CHAQUE IMAGE — `_traverse` repasse sur
  // les mêmes tuiles soixante fois par seconde.
  const headsApres1 = appels.filter((a) => a.method === 'HEAD').length
  for (let i = 0; i < 5; i++) {
    g._request(t, 1)
    await new Promise((r) => setTimeout(r, 0))
  }
  assert.equal(
    appels.filter((a) => a.method === 'HEAD').length,
    headsApres1,
    'la sonde repart à chaque image : six HEAD par image et par zone'
  )

  // on rend la main aux sondes : la tuile part enfin, sur la BONNE source
  sondesRetenues.forEach((r) => r())
  sondesRetenues = null
  const fini = await charge(g, ...T_TERRE)
  assert.equal(fini.state, 'ready')
  assert.equal(fini.plan.source.id, DEFAULT_SOURCE_ID)
  g.dispose()
})

test('la sonde en cours ne fait ni trou ni gel : l ANCÊTRE couvre pendant ce temps', async () => {
  const g = neuf()
  const camera = poseCamera(45, 6.25, 8_000)
  // on laisse le globe descendre jusqu au plancher de la source fine…
  for (let i = 0; i < 20; i++) {
    g.update(camera, 0.016)
    await calme(g)
  }
  const dessineesAvant = g._drawn
  assert.ok(dessineesAvant > 0, 'rien n est dessiné : le montage ne mesure rien')

  // …puis on gèle toute nouvelle sonde et on repart d une caméra voisine
  sondesRetenues = []
  const ailleurs = poseCamera(45, 7.9, 8_000)
  for (let i = 0; i < 5; i++) {
    g.update(ailleurs, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
  assert.ok(
    g._drawn > 0,
    'plus rien n est dessiné pendant que les sondes attendent — la sonde a ouvert un trou'
  )
  sondesRetenues.forEach((r) => r())
  g.dispose()
})

// ──────────────────────────────────── ÉTAPE 5 : les deux tailles, sans silence

test('une tuile Mapterhorn est dépaquetée en 512, une tuile AWS en 256', async () => {
  const g = neuf()
  const terre = await charge(g, ...T_TERRE)
  const mer = await charge(g, ...T_MER)
  assert.equal(terre.size, 512, `tuile Mapterhorn dépaquetée en ${terre.size} px`)
  assert.equal(mer.size, 256, `tuile de repli AWS dépaquetée en ${mer.size} px`)
  // et le canevas a bien été taillé à la source, pas à une constante
  const cotes = new Set(canevas.map((c) => c.width))
  assert.ok(cotes.has(512), 'aucun canevas de 512 px : la tuile fine a été lue au quart')
  g.dispose()
})

// ⚠️ LE PIÈGE LE PLUS SILENCIEUX DE TOUTE LA TÂCHE. `sampleHeights` indexait
// `heights[i + 256]` et `heights[i + 257]` — c'est « la ligne du dessous » et
// « son voisin de droite ». En 512 px ils valent 512 et 513. En oublier UN SEUL
// donne des altitudes fausses sans ligne mixte, sans erreur, sans rien.
test('sampleHeights lit une tuile de 512 px SUR TOUTE SA LARGEUR, pas au quart', () => {
  const N = 512
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = x
  // au centre d un pixel, l échantillon vaut exactement son abscisse
  for (const i of [0, 1, 128, 300, N - 2, N - 1]) {
    const u = (i + 0.5) / N
    assert.ok(
      Math.abs(sampleHeights(h, u, 0.5, N) - i) < 1e-3,
      `u au pixel ${i} rend ${sampleHeights(h, u, 0.5, N)} au lieu de ${i}`
    )
  }
  // la MUTATION : oublier `size` retombe sur 256 et lit le quart nord-ouest
  assert.ok(
    Math.abs(sampleHeights(h, 0.99, 0.5) - sampleHeights(h, 0.99, 0.5, N)) > 100,
    'lire une tuile 512 avec le défaut 256 rend la même valeur : le défaut ne protège plus de rien'
  )
})

test('sampleHeights garde EXACTEMENT son comportement de 256 px par défaut', () => {
  const N = 256
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = 1000 + x * 40
  for (const [u, v] of [
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [0.317, 0.812],
  ]) {
    assert.equal(sampleHeights(h, u, v), sampleHeights(h, u, v, 256))
  }
  // l écrêtage des bords : hors de [0,1] on rend le pixel de bord, pas du vide
  assert.equal(sampleHeights(h, 0, 0.5), 1000)
  assert.equal(sampleHeights(h, 1, 0.5), 1000 + 255 * 40)
})

// ─────────────────────────────────────── ÉTAPE 5 : le budget du `_tileMemo`

test('le budget de la mémoire de tuiles est en OCTETS : 32 Mo, quelle que soit la taille', async () => {
  const g = neuf()
  await calme(g) // les seize racines z2, qui sont de l'AWS 256 px
  _resetTileMemo()
  // ⚠️ QUE DES TUILES FINES, ET LA CONTRAINTE EST GÉOMÉTRIQUE : une zone z8
  // couvre 16×16 tuiles z12. En sortir renverrait sur une zone non renseignée
  // par le bouchon, donc sur du 404, donc sur de l'AWS 256 px — et le test
  // mesurerait un mélange au lieu du pire cas.
  for (let i = 0; i < 50; i++) await charge(g, 12, 2112 + (i % 16), 1472 + Math.floor(i / 16))
  const octets = [..._tileMemo.keys()].reduce(
    (n, u) => n + (sourceDe(u) === 'mapterhorn' ? 512 : 256) ** 2 * 4,
    0
  )
  assert.ok(
    [..._tileMemo.keys()].every((u) => sourceDe(u) === 'mapterhorn'),
    'le montage a laissé entrer des tuiles AWS : ce test doit mesurer le PIRE cas'
  )
  assert.ok(
    octets <= 128 * 256 * 256 * 4,
    `${(octets / 1048576).toFixed(1)} Mo retenus pour un budget de 32 Mo — ` +
      `la borne est restée exprimée en ENTRÉES, et 128 tuiles de 512 px pèsent 128 Mo`
  )
  assert.equal(
    _tileMemo.size,
    32,
    `${_tileMemo.size} entrées de 512 px : 32 Mo font exactement 32 tuiles fines`
  )
  g.dispose()
})

// ───────────────────────────────────────────── ÉTAPE 7 : rien n a bougé en bas

test('LE GLOBE ORBITAL EST INCHANGÉ : une descente de production ne sonde rien et reste sur AWS', async () => {
  // ⚠️ C EST UNE FONCTION EN PRODUCTION. Le chemin non continu plafonne à z11
  // (plancher de `dist`), donc SOUS le plancher de couverture de Mapterhorn :
  // l Étape 3 de la tâche le laisse sur AWS, et ce test le prouve plutôt que de
  // l espérer.
  const g = neuf({ globeContinu: false })
  g.chargeRacines()
  const camera = poseCamera(45, 6.25, 200_000)
  for (let i = 0; i < 12; i++) {
    g.update(camera, 0.016)
    await calme(g)
  }
  let zmax = 0
  for (const t of g.tiles.values()) if (t.mesh?.visible && t.z > zmax) zmax = t.z
  assert.ok(zmax > 0, 'le globe de production n a rien dessiné : le montage ne mesure rien')
  assert.ok(zmax < SEUIL_SOURCE_FINE, `le globe de production atteint z${zmax} : il entre dans la bande fine`)
  assert.equal(
    appels.filter((a) => a.method === 'HEAD').length,
    0,
    'le globe orbital a payé des sondes : six HEAD par zone z8, hors MAX_CONCURRENT'
  )
  assert.ok(
    gets().every((a) => a.url.startsWith(AWS)),
    'le globe orbital a quitté AWS'
  )
  g.dispose()
})

// ────────────────────────────────────────────── `planTuile`, la pièce pure

test('planTuile rend `null` tant que la zone n est pas sondée, et un plan ensuite', async () => {
  const g = neuf()
  assert.equal(planTuile(...T_TERRE), null, 'planTuile devine au lieu de dire qu il ne sait pas')
  // sous le plancher, il sait tout de suite — sans une seule requête
  const bas = planTuile(SEUIL_SOURCE_FINE - 1, 1059, 736)
  assert.equal(bas.source.id, 'aws')
  assert.equal(bas.tile.scale, 1)
  await charge(g, ...T_TERRE)
  const haut = planTuile(...T_TERRE)
  assert.equal(haut.source.id, DEFAULT_SOURCE_ID)
  g.dispose()
})

test('planTuile sur une source épinglée AWS ne sonde jamais', () => {
  serve()
  _resetDemSource('aws')
  const p = planTuile(...T_TERRE)
  assert.equal(p.source.id, 'aws')
  assert.equal(appels.length, 0)
  _resetDemSource()
})
