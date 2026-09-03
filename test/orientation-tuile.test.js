// L'ORIENTATION DE LA TUILE DÉCODÉE — R36.
//
// ⛔ LE DÉFAUT QUE CE FICHIER VERROUILLE : `texture.flipY` — que three écrit
// dans `UNPACK_FLIP_Y_WEBGL` — est **IGNORÉ quand la source du téléversement
// est une ImageBitmap**. Mesuré au pixel dans Chrome 152
// (`node scripts/sonde-r36.mjs --scenario flip`) : même drapeau, même appel,
// le canevas rend sa ligne du haut en `v = 1` et l'ImageBitmap la rend en
// `v = 0`. **`gl.getError()` vaut 0** dans les deux cas : rien ne le signale.
//
// Conséquence à l'écran, quand PF2 (`57be020`) a déplacé le décodage terrarium
// dans un Worker qui rend une ImageBitmap : la GÉOMÉTRIE restait juste (elle
// vient du `Float32Array`, que le GPU ne touche pas) et la TEXTURE arrivait
// retournée en latitude. Le globe se coupait en **bandes horizontales suivant
// les latitudes**, le contenu de chaque bande décalé — un trait de côte entrait
// en haut d'une bande et ressortait ailleurs en bas.
//
// Critère mesuré en vol (`--scenario serie`, écart moyen à la couture nord-sud
// entre tuiles voisines, lu dans les textures telles que le GPU les tient) :
// **2 517,9 m et 28 paires sur 28 en miroir** à 10 000 km au-dessus de
// l'Afrique ; **85,4 m et 0 miroir** au commit d'avant PF2 (`c11a80f`) comme
// après le correctif.
//
// ⚠️ CE QUE LE TEST DOIT MORDRE : que le Worker rende la dalle DÉJÀ retournée
// (`createImageBitmap(..., { imageOrientation: 'flipY' })`) et que les HAUTEURS
// soient lues AVANT ce retournement — elles sont indexées en lignes d'image, du
// nord au sud, comme `sampleHeights`. Retourner les deux ne corrigerait rien.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const PX = 4

// Une dalle où chaque LIGNE porte une altitude distincte : retourner l'image se
// voit alors immédiatement, ligne par ligne.
function dalle(px = PX) {
  const rgba = new Uint8ClampedArray(px * px * 4)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const i = (y * px + x) * 4
      rgba[i] = 128 + y // r : la ligne se lit dans le canal rouge
      rgba[i + 1] = 7
      rgba[i + 2] = 0
      rgba[i + 3] = 255
    }
  }
  return rgba
}
function retourneY(rgba, px = PX) {
  const out = new Uint8ClampedArray(rgba.length)
  for (let y = 0; y < px; y++) out.set(rgba.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4)
  return out
}

// Le Worker sous node : des globales de papier, avec la VRAIE sémantique de
// `createImageBitmap(source, { imageOrientation })`.
async function monterWorker() {
  const anciens = {}
  const poser = (n, v) => { anciens[n] = globalThis[n]; globalThis[n] = v }
  class WorkerGlobalScope {}
  class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; this.raster = new Uint8ClampedArray(w * h * 4) }
    getContext() {
      const c = this
      return {
        drawImage(src, ...a) {
          // seul le cas sans surzoom est exercé ici (scale = 1)
          assert.equal(a.length, 2, 'harnais : surzoom hors périmètre de ce test')
          c.raster.set(src.raster)
        },
        getImageData() { return { data: c.raster } }
      }
    }
    transferToImageBitmap() { return { raster: this.raster.slice(), _via: 'transferToImageBitmap' } }
  }
  poser('WorkerGlobalScope', WorkerGlobalScope)
  poser('OffscreenCanvas', OffscreenCanvas)
  poser('createImageBitmap', async (src, opts = {}) => ({
    raster: opts.imageOrientation === 'flipY' ? retourneY(src.raster, src.width) : src.raster.slice(),
    _via: 'createImageBitmap',
    _orientation: opts.imageOrientation || 'from-image'
  }))
  const messages = []
  const faux = new WorkerGlobalScope()
  faux.postMessage = (m) => messages.push(m)
  poser('self', faux)
  // import frais : le corps du Worker ne s'installe qu'à l'évaluation du module
  const mod = await import(`../src/monde/decodeur-terrarium.js?r36=${Math.random()}`)
  const demonter = () => { for (const n of Object.keys(anciens)) { if (anciens[n] === undefined) delete globalThis[n]; else globalThis[n] = anciens[n] } }
  return { faux, messages, mod, demonter }
}

test('① le Worker rend la dalle DÉJÀ retournée en Y — `flipY` est ignoré pour une ImageBitmap', async () => {
  const { faux, messages, demonter } = await monterWorker()
  try {
    assert.equal(typeof faux.onmessage, 'function', 'le corps du Worker ne s’est pas installé')
    const rgba = dalle()
    await faux.onmessage({ data: { id: 1, bitmap: { raster: rgba, width: PX, height: PX, close() {} }, px: PX, scale: 1, ox: 0, oy: 0 } })
    assert.equal(messages.length, 1)
    const m = messages[0]
    assert.equal(m.erreur, undefined, 'le Worker a levé : ' + m.erreur)
    const attendu = retourneY(rgba)
    assert.deepEqual([...m.image.raster], [...attendu],
      'la dalle envoyée au GPU doit être retournée en Y : sans ça le globe se coupe en bandes de latitude')
  } finally { demonter() }
})

test('② les HAUTEURS sont lues AVANT le retournement — nord en ligne 0, comme `sampleHeights`', async () => {
  const { faux, messages, mod, demonter } = await monterWorker()
  try {
    const rgba = dalle()
    await faux.onmessage({ data: { id: 2, bitmap: { raster: rgba, width: PX, height: PX, close() {} }, px: PX, scale: 1, ox: 0, oy: 0 } })
    const attendu = mod.hauteursTerrarium(rgba, PX)
    assert.deepEqual([...messages[0].heights], [...attendu],
      'retourner AUSSI les hauteurs annulerait le correctif : la géométrie doit rester indexée du nord au sud')
    // et le retournement doit bien avoir eu lieu quelque part
    assert.notDeepEqual([...messages[0].image.raster], [...rgba])
  } finally { demonter() }
})

test('③ `globe.js` déclare `flipY = false` sur la texture issue du Worker', () => {
  const src = fs.readFileSync(path.join(ICI, '..', 'src', 'globe.js'), 'utf8')
  const i = src.indexOf('texture = new THREE.Texture(r.image)')
  assert.ok(i > 0, 'le chemin Worker de `fetchTile` a bougé — remesurer l’orientation avant de corriger ce test')
  const bloc = src.slice(i, i + 700)
  assert.match(bloc, /texture\.flipY\s*=\s*false/,
    'la texture du Worker doit déclarer `flipY = false` : le drapeau est ignoré pour une ImageBitmap, et le Worker a déjà retourné la dalle')
})
