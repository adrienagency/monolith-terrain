// LES MÊMES NEUF TUILES, TÉLÉCHARGÉES DEUX FOIS — Tâche R3, correction I3.
//
// ---------------------------------------------------------------------------
// LE DÉFAUT, ÉCRIT COMME UN TEST
// ---------------------------------------------------------------------------
// Sous `?terre=unique`, le bloc du socle est chargé par `dem.js` (`loadDem`)
// **et** par la file du globe (`globe.js`), sur la MÊME URL, à ~1,7 s d'écart :
//
//     mapterhorn 12/2681/2294  376 179 o  t = 2,02 s  loadDem@dem.js
//     mapterhorn 12/2681/2294  376 174 o  t = 3,68 s  _pump@globe.js
//
// **2,705 Mo par chargement**, mesurés sur 9 tirages — 14,5 % de ce que la
// tâche laissait, et plus de la moitié de ce qu'elle venait d'économiser. La
// cause était structurelle : deux mémoires indépendantes, celle de `dem.js` se
// purgeant à l'atterrissage.
//
// ⚠️ **CE FICHIER TESTE LE COMPORTEMENT, PAS LE TEXTE.** Il compte des requêtes
// réseau réelles, sur les deux chemins, dans un seul processus.

import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
// (le contrat de canevas de `dem.js` : `drawImage` peint pour de vrai)
class FakeCtx {
  constructor(size) {
    this.size = size
    this.rgba = new Uint8ClampedArray(size * size * 4)
  }
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage(img, ...a) {
    const long = a.length >= 8
    const [sx, sy, sw, sh] = long ? a.slice(0, 4) : [0, 0, img.width, img.height]
    const [dx, dy, dw, dh] = long ? a.slice(4) : [a[0], a[1], img.width, img.height]
    for (let y = dy; y < dy + dh; y++) {
      for (let x = dx; x < dx + dw; x++) {
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue
        const rgb = img.at ? img.at(sx + ((x - dx) / dw) * sw, sy + ((y - dy) / dh) * sh) : [0, 0, 0]
        const i = (y * this.size + x) * 4
        this.rgba[i] = rgb[0]; this.rgba[i + 1] = rgb[1]; this.rgba[i + 2] = rgb[2]; this.rgba[i + 3] = 255
      }
    }
  }
  getImageData() { return { data: this.rgba } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx(c.width || 256))
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// -------------------------------------------------------- le serveur qui COMPTE
const RGB = encodeTerrarium(1234)
const appels = new Map() // url → nombre de requêtes RÉELLEMENT parties

function servirEnComptant() {
  appels.clear()
  globalThis.fetch = async (url, opts) => {
    if (url.startsWith('data/bathy/')) return { ok: false, status: 404 }
    if (opts?.method === 'HEAD') return { ok: true, status: 200 }
    appels.set(url, (appels.get(url) ?? 0) + 1)
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, at: () => RGB }) }
  }
}

const { loadDem, _resetTileCaches } = await import('../src/dem.js')
const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { _resetDemSource, fallbackToAws } = await import('../src/dem-source.js')
const { memoTuiles, tuileMemorisee, viderMemoTuiles } = await import('../src/monde/memo-tuiles-mnt.js')

const LAT = -21.115
const LON = 55.53
const ZOOM = 10 // sous `SEUIL_SOURCE_FINE` : aucune sonde de couverture ne s'en mêle

function neuf() {
  _resetTileCaches()
  _resetTileMemo()
  _resetDemSource()
  // ⚠️ **AWS DE FORCE, ET C'EST POUR ISOLER LA QUESTION** : les deux chemins
  // tombent alors sur le même gabarit d'URL sans passer par `probeMaxZoom`,
  // dont les allers-retours brouilleraient le comptage.
  fallbackToAws()
  servirEnComptant()
}

const mnt = () => [...appels.keys()].filter((u) => /terrarium\/\d+\/\d+\/\d+\.png$/.test(u))
const cleDe = (u) => u.match(/terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/).slice(1, 4).map(Number)

async function calme(globe, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

test('① le socle charge son bloc, puis le globe demande les MÊMES tuiles : une requête chacune', async () => {
  neuf()
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const urls = mnt()
  assert.ok(urls.length >= 4, `le socle n’a chargé que ${urls.length} tuiles : le harnais ne prouve rien`)
  for (const u of urls) assert.equal(appels.get(u), 1, `${u} déjà demandée ${appels.get(u)} fois par le socle seul`)

  const globe = new Globe({ globeContinu: false })
  globe._buildMesh = () => {} // on mesure le RÉSEAU, pas la géométrie
  for (const u of urls) {
    const [z, x, y] = cleDe(u)
    globe._request(globe._ensureTile(z, x, y), 1)
  }
  await calme(globe)

  for (const u of urls) {
    assert.equal(appels.get(u), 1, `${u} a été téléchargée ${appels.get(u)} fois — le doublon est de retour`)
  }
})

test('② dans l’autre sens aussi : le globe d’abord, le socle ensuite', async () => {
  // ⚠️ **LA MUTUALISATION EST SYMÉTRIQUE, ET IL FAUT LE VÉRIFIER** : l'ordre
  // mesuré dans l'application est socle-puis-globe, mais rien ne le garantit —
  // un lien partagé, un `flyTo`, et c'est l'inverse.
  neuf()
  const globe = new Globe({ globeContinu: false })
  globe._buildMesh = () => {}
  const n = 2 ** ZOOM
  const cx = Math.floor(((LON + 180) / 360) * n)
  const la = (LAT * Math.PI) / 180
  const cy = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) globe._request(globe._ensureTile(ZOOM, cx + dx, cy + dy), 1)
  }
  await calme(globe)
  const parGlobe = mnt()
  assert.equal(parGlobe.length, 9)

  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  for (const u of parGlobe) {
    assert.equal(appels.get(u), 1, `${u} a été téléchargée ${appels.get(u)} fois — le socle ne lit pas la mémoire du globe`)
  }
})

test('③ LE DÉFAUT, sur le même harnais : deux mémoires séparées le rejouent', async () => {
  // ⚠️ **LE TÉMOIN NÉGATIF.** On coupe la mémoire ENTRE les deux chemins — c'est
  // exactement ce que faisait la purge à l'atterrissage de `dem.js` — et le
  // doublon revient. Sans lui, ① et ② pourraient passer sur un harnais qui ne
  // demande jamais deux fois la même tuile.
  neuf()
  await loadDem({ lat: LAT, lon: LON, zoom: ZOOM, bathy: false })
  const urls = mnt()
  _resetTileMemo() // ← la séparation d'avant, reproduite
  const globe = new Globe({ globeContinu: false })
  globe._buildMesh = () => {}
  for (const u of urls) {
    const [z, x, y] = cleDe(u)
    globe._request(globe._ensureTile(z, x, y), 1)
  }
  await calme(globe)
  const doubles = urls.filter((u) => appels.get(u) === 2)
  assert.equal(
    doubles.length, urls.length,
    `seules ${doubles.length}/${urls.length} tuiles sont reparties : le harnais ne reproduit pas le défaut`,
  )
})

test('④ un 404 n’est PAS mémorisé — les deux appelants ne le traduisent pas pareil', async () => {
  // ⛔ `dem.js` rend `null` sur un 404 (« la source ne couvre pas ici »),
  // `globe.js` LÈVE une erreur portant `status = 404`, que `fetchTile` rattrape
  // pour se replier sur AWS. Mémoriser le `null` de l'un servirait un `null` à
  // l'autre, qui ne se replierait plus. Un 404 ne coûte que ses en-têtes.
  viderMemoTuiles()
  await tuileMemorisee('http://x/404', async () => null)
  assert.equal(memoTuiles.has('http://x/404'), false, 'un résultat vide est resté en mémoire')
  await tuileMemorisee('http://x/casse', async () => { throw new Error('boum') }).catch(() => {})
  assert.equal(memoTuiles.has('http://x/casse'), false, 'un échec est resté en mémoire')
  await tuileMemorisee('http://x/ok', async () => ({ width: 1 }))
  assert.equal(memoTuiles.has('http://x/ok'), true, 'un succès n’a PAS été mémorisé')
})
