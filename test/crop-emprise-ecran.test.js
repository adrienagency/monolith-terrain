// L'EMPRISE DU CROP NE SE CALCULE PAS À z13 À TOUTE ALTITUDE — CULL, défaut ⑤
//
// > **Adrien, 2026-09-04 (⑤) :** *« Le crop met beaucoup trop de temps à
// > s'afficher, et on voit quasiment tout le terrain affiché. Il me semble que
// > ça implique que l'ordi doit calculer des choses qui ne doivent pas être
// > visibles à l'écran (hors crop), et que du coup on perd de la puissance de
// > calcul pour rien. »*
//
// ⚠️ **CE QUE CE FICHIER VERROUILLE, ET POURQUOI IL N'EXISTAIT PAS.** Le crop
// prescrivait `ZOOM_SOCLE` (13) sur TOUTE son emprise, à toute altitude
// (`zoomCropPrescrit`, appelé sans son cinquième argument). Or l'emprise n'est
// pas le socle de 10,4 km : c'est la largeur du BLOC COURANT, qui suit
// `params.demZoom` et non la caméra. Mesuré dans l'application
// (`scripts/diag-cull.mjs`, Majorque, descente au bouton) :
//
//   | altitude | demZoom | largeur du crop |
//   |---|---|---|
//   | 389 km |  4 | **6 376 km** |
//   | 139 km |  6 | **1 464 km** |
//   |  30 km |  8 |   363 km |
//   |  15 km |  9 |   181 km |
//
// Prescrire z13 sur 6 376 km, c'est réclamer plus de 25 000 tuiles pour un
// écran qui en montre quelques dizaines : le cache sature à `CACHE_MAX_CONTINU`
// (1 700), `_credit` tombe à 3, la file bute sur `PLAFOND_FILE`.
//
// ⛔ **AUCUN TEST NE COUVRAIT ÇA — la suite était verte avec ET sans le
// correctif** (4 869 · 0 des deux côtés). C'est la raison d'être de ce fichier :
// les quatre tests ci-dessous rougissent quand on débraye `cropZoomEcran`.
//
// Le harnais est celui de `test/globe-cible.test.js` : DOM de papier, `fetch`
// qui rend une dalle plate immédiatement.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob
let requetes = 0
globalThis.fetch = async () => {
  requetes++
  await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')

const LAT = 39.62
const LON = 2.98

function camera(lat, lon, altM) {
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function neuf() {
  requetes = 0
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  return g
}

// `demZoom` = la largeur du crop, en niveaux : `demi = 3 / 2 / 2^zoom`, la règle
// d'`assietteCrop` (`main.js`) et de `repereCrop`.
function poser(g, demZoom) {
  return g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: demZoom, tuilesParBloc: 3 })
}

async function tourner(g, cam, images = 40) {
  for (let i = 0; i < images; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
}

const zMaxDansCrop = (g) => {
  let z = 0
  for (const t of g.tiles.values()) if (t.z > z && g._crop && tuileDansCrop(t.z, t.x, t.y, g._crop)) z = t.z
  return z
}

// ═════ ① LE PLAFOND SUIT L'ÉCRAN, ET IL EST BORNÉ PAR `ZOOM_SOCLE` ═════════
test('① `_zoomCropEcran` rend `ZOOM_SOCLE` au bloc, et beaucoup moins en vue continentale', async () => {
  const g = neuf()
  poser(g, 13)
  const pres = camera(LAT, LON, 12_000)
  const zPres = g._zoomCropEcran(pres.position)
  assert.equal(zPres, ZOOM_SOCLE, `à 12 km le régime d'arrivée doit être inchangé (z${zPres})`)

  // ⚠️ LE BALAYAGE, PAS UN POINT — §2 de `/threejs-optimisation` : « mesure la
  // sortie sur toute la plage, ne lis pas la constante ». Une borne qui rendrait
  // 13 partout passerait un test à une seule altitude.
  const releve = []
  for (const altM of [12_000, 30_000, 100_000, 200_000, 400_000, 900_000, 1_600_000]) {
    releve.push([altM, g._zoomCropEcran(camera(LAT, LON, altM).position)])
  }
  // strictement décroissant avec l'altitude, jamais au-dessus de ZOOM_SOCLE
  let prec = Infinity
  for (const [altM, z] of releve) {
    assert.ok(z <= ZOOM_SOCLE, `z${z} dépasse ZOOM_SOCLE à ${altM} m`)
    assert.ok(z <= prec, `le plafond REMONTE en montant (${altM} m : z${z} après z${prec})`)
    prec = z
  }
  assert.ok(releve[releve.length - 1][1] <= 8, `à 1 600 km le plafond devrait être grossier, il vaut z${releve[releve.length - 1][1]}`)
  assert.ok(releve[0][1] - releve[releve.length - 1][1] >= 4, 'la borne ne bouge quasiment pas sur la plage — ce n’est pas une borne d’écran')
})

// ═════ ② LA QUESTION D'ADRIEN, EN TUILES ══════════════════════════════════
//
// ⛔ **C'EST LE TEST QUI ROUGIT SANS LE CORRECTIF.** Mutation vérifiée :
// `g.cropZoomEcran = false` (le dépôt d'avant, `zoomCropPrescrit` sans son
// cinquième argument) fait descendre le parcours à z13 dans une emprise de
// 6 376 km, depuis 900 km d'altitude.
test('② à 900 km, un crop large de 6 376 km ne se fait PAS mailler à z13', async () => {
  const g = neuf()
  poser(g, 4) // demZoom 4 — le crop mesuré à 389 km : 6 376 km de large
  const cam = camera(LAT, LON, 900_000)
  await tourner(g, cam, 60)

  const zMax = zMaxDansCrop(g)
  assert.ok(zMax > 0, 'aucune tuile du crop en cache — le test se mentirait')
  assert.ok(zMax <= 9, `le parcours descend à z${zMax} dans une emprise de 6 376 km à 900 km d'altitude`)
  assert.ok(g.tiles.size < g.cacheMax, `le cache est saturé (${g.tiles.size} / ${g.cacheMax})`)

  // et le levier débrayé rejoue le défaut : c'est la mutation, dans le test
  const h = neuf()
  h.cropZoomEcran = false
  poser(h, 4)
  await tourner(h, camera(LAT, LON, 900_000), 60)
  assert.ok(
    zMaxDansCrop(h) > zMax,
    `débrayé, le parcours devrait descendre PLUS BAS que z${zMax} (il rend z${zMaxDansCrop(h)}) — la mutation ne mord plus`
  )
})

// ═════ ③ L'UNIFORMITÉ RESTE L'INVARIANT ═══════════════════════════════════
//
// L'affiche : un bord proche à z15 et un bord lointain à z13 se raccorderaient
// visiblement. Le correctif ne touche pas à ça — il borne une valeur UNIQUE.
test('③ le zoom prescrit est UNE seule valeur pour toute l’emprise', async () => {
  const g = neuf()
  poser(g, 8)
  const cam = camera(LAT, LON, 30_000)
  g.update(cam, 0.016)
  const z = g._zCropEcran
  assert.ok(z > 0, '`_zCropEcran` n’a pas été calculé par `update`')
  // la prescription ne dépend QUE de l'appartenance à l'emprise, pas de la tuile
  const { zoomCropPrescrit } = await import('../src/monde/crop-sphere.js')
  const vus = new Set()
  for (const t of g.tiles.values()) {
    const p = zoomCropPrescrit(t.z, t.x, t.y, g._crop, z)
    if (p) vus.add(p)
  }
  assert.deepEqual([...vus], [z], `deux prescriptions différentes dans la même image : ${[...vus]}`)
})

// ═════ ④ LA BORNE NE FAIT NAÎTRE AUCUNE TUILE ═════════════════════════════
//
// Le piège du §2 : une fonction de mesure qui alimente ce qu'elle mesure. Douze
// `_ensureTile` par image auraient fait douze entrées de cache pour répondre à
// une question de géométrie.
test('④ `_zoomCropEcran` ne touche ni au cache ni au réseau', async () => {
  const g = neuf()
  poser(g, 6)
  const cam = camera(LAT, LON, 200_000)
  await tourner(g, cam, 10)
  const avant = g.tiles.size
  const req = requetes
  for (let i = 0; i < 50; i++) g._zoomCropEcran(cam.position)
  assert.equal(g.tiles.size, avant, 'la borne a fait naître des tuiles')
  assert.equal(requetes, req, 'la borne a demandé du réseau')
})

// ═════ ⑤ L'EFFACEMENT LATÉRAL DES JUPES RESTE DANS SON DOMAINE — CULL ④ ════
//
// > **Adrien, 2026-09-04 (④) :** *« On a des trous entre les blocs au niveau
// > des coutures terrains. »*
//
// L'attribution est au banc (`scripts/sonde-cull.mjs`, pixels de fond ENCLAVÉS
// par le terrain, Majorque, CPU ×4, ~50 images par tirage, un seul levier
// changé à la fois) : le dépôt rend **66 px** de trou au pire (13,0 en
// moyenne) ; débrayer le seul effacement latéral rend **0 px** ; débrayer le
// raffinement partiel de R37 n'en rend que 36 ; lever le bornage en hauteur,
// 58 ; retirer la dilatation, 75. C'est donc l'effacement latéral — appliqué
// non pas au bloc, où P14 l'a mesuré, mais à une fenêtre CONTINENTALE de
// plusieurs milliers de kilomètres.
//
// ⛔ **SOC ① A REMPLACÉ LE DOMAINE EN NIVEAUX PAR LE MUR LUI-MÊME.** La tolérance
// de CULL (`TOLERANCE_BLOC = 1,5`) éteignait l'effacement à z11 — le crop de la
// vidéo d'Adrien (42 km) — et les jupes y traversaient le mur : 15 308 px de
// traînées, mesurés au banc (`scripts/sonde-soc.mjs`). Le domaine juste est
// « un mur bâti pour CE repère couvre la bande » : les parois portent leur
// repère (`userData.repere`), et c'est lui qu'on compare à `_crop`.
//
// ⛔ Mutation : remplacer la comparaison de repères par `return !!p` (« un mur,
// n'importe lequel ») fait rougir l'étape « repère changé » ; la retirer tout
// entière (`return true`) fait rougir « sans mur ».
test('⑤ l’effacement latéral suit LE MUR : actif avec des parois de CE repère, éteint sinon — à tout zoom', async () => {
  const g = neuf()
  // sans mur, rien à effacer — quel que soit le zoom, socle compris
  for (const demZoom of [ZOOM_SOCLE, ZOOM_SOCLE - 1, 11, 9, 7, 4]) {
    poser(g, demZoom)
    assert.equal(g._effacementLateralActif(), false, `sans parois, l’effacement doit être éteint à zoom ${demZoom}`)
  }
  // avec un mur bâti pour CE repère : actif — au bloc comme en vue
  // continentale (181 km à 6 376 km, les emprises mesurées par diag-cull), car
  // depuis SOC la plaque provisoire suit la découpe dans la même image
  for (const demZoom of [ZOOM_SOCLE, ZOOM_SOCLE - 1, 11, 9, 7, 4]) {
    const rep = poser(g, demZoom)
    g._parois = { userData: { repere: { cx: rep.cx, cy: rep.cy, demi: rep.demi, zoom: rep.zoom } } }
    assert.equal(g._effacementLateralActif(), true, `avec un mur de ce repère, l’effacement doit être actif à zoom ${demZoom}`)
  }
  // le repère change (une pose neuve), le mur est encore celui d'avant : éteint
  poser(g, 12)
  assert.equal(g._effacementLateralActif(), false, 'un mur d’un AUTRE repère ne couvre pas la bande : éteint')
  // un mur sans étiquette (globe de papier) rejoue le dépôt d'avant
  g._parois = {}
  assert.equal(g._effacementLateralActif(), true, 'un mur sans étiquette rejoue le dépôt')
  // le levier de banc de CULL : partout, mur ou pas
  g._parois = null
  g.jupeDomaine = false
  assert.equal(g._effacementLateralActif(), true, '`jupeDomaine = false` force l’effacement partout')
  delete g.jupeDomaine
  g._crop = null
  assert.equal(g._effacementLateralActif(), false, 'sans crop, il n’y a rien à effacer')
})
