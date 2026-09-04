// LA GARDE « UNE SEULE FINESSE » QUI MORD — CN4
//
// > **Le noteur (CN3, §7) :** *« ③, la garde de l'exigence NON NÉGOCIABLE
// > d'Adrien, ne rougit sous AUCUNE mutation — pas même sous `palier-mort`, qui
// > supprime le palier atomique tout entier. La suite passe 6/6, à l'identique,
// > avec le cœur du correctif arraché. »*
//
// ⛔ **ET LA CAUSE EST LE BANC, PAS L'ASSERTION.** Le banc de
// `test/crop-nettete-ecran.test.js` ③ rend ses dalles **en une microtâche** :
// après soixante images tout est prêt à tous les niveaux, donc **aucune image
// mixte ne peut jamais y naître**. Une garde contre le mélange de résolutions
// qui ne tourne que sur un monde entièrement chargé n'observe jamais le
// phénomène qu'elle prétend interdire — c'est le *« test de silhouette qui passe
// à vide »* du §3 de `/threejs-optimisation`.
//
// ⚡ **CE QUE CE FICHIER AJOUTE, ET RIEN D'AUTRE : UNE PORTE SUR LE RÉSEAU.**
// Les réponses de dalles sont RETENUES puis lâchées **par moitiés**, si bien
// qu'il existe des images où une partie des enfants de l'emprise est prête et
// l'autre non. C'est exactement l'état où le mélange peut naître, et c'est le
// seul état où le palier atomique (`_majZoomCrop` + `_cropCouvert`) se voit
// travailler. `test/crop-nettete-ecran.test.js` n'est PAS touché — il garde son
// empreinte `4b71c1aaaff9fe3acf0ed3d4197d45d2`.
//
// ══════════ LA PREUVE QUE CETTE GARDE MORD (CN4, mutation du produit) ════════
//
// Mutation `palier-mort` appliquée puis RETIRÉE en binaire, `md5(src/globe.js)`
// identique avant et après (`b71b597466e4a3e42760ae8e3a97336f`) :
//
//     src/globe.js, `_traverse` :
//       `this._zCropServi || this._zCropEcran || ZOOM_SOCLE`
//     → `this._zCropCible || this._zCropEcran || ZOOM_SOCLE`
//
// C'est la mutation du noteur, mot pour mot : elle prescrit la CIBLE au lieu du
// SERVI, donc elle arrache le palier atomique en laissant tout le reste debout.
//
// Et une seconde, `couvert-permissif` : `_cropCouvert` rend toujours `true`,
// c'est-à-dire le palier qui monte sans attendre la couverture.
//
//   | test                                   | dépôt | `palier-mort` | `couvert-permissif` |
//   |---|---|---|---|
//   | `crop-nettete-ecran` ③ (banc immédiat) | ✔ | ✔ ⛔ **aveugle** | ✔ ⛔ **aveugle** |
//   | ⓐ ci-dessous — goutte à goutte         | ✔ | **✖ 69/240 images mixtes** | **✖** |
//   | ⓑ ci-dessous — moitié lâchée           | ✔ | **✖ 159/160 images mixtes** | **✖ 159/160** |
//   | ⓒ témoin de vivacité                   | ✔ | ✔ | ✔ |
//
// Le message de ⓑ sous `palier-mort`, mot pour mot :
// *« 159 images sur 160 portent deux finesses ou plus avec 3 dalles sur deux
// arrivées — ex. [[14,15],[14,15],[14,15]] »* — le `[11, 16]` de CN1, rejoué.
//
// ⚠️ **ⓒ EST OBLIGATOIRE.** Une garde qui n'observe rien passe : ⓒ exige que le
// palier MONTE réellement une fois toutes les dalles lâchées. Sans lui, ⓐ et ⓑ
// seraient verts sur un globe qui ne dessine rien.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

const [ER, EG, EB] = encodeTerrarium(812)
const dalles = new Map()
function dalleDe(cote) {
  let d = dalles.get(cote)
  if (!d) {
    d = new Uint8ClampedArray(cote * cote * 4)
    for (let i = 0; i < cote * cote; i++) { d[i * 4] = ER; d[i * 4 + 1] = EG; d[i * 4 + 2] = EB; d[i * 4 + 3] = 255 }
    dalles.set(cote, d)
  }
  return d
}
class FauxCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) { return { data: dalleDe(w) } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FauxCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// ---- LA PORTE : le réseau du banc, qui sait RETENIR -------------------------
// (le mécanisme est celui de `test/raffinement-partiel.test.js`, réemployé tel
// quel : c'est lui qui manquait au banc de CN1.)
let porte = false
const retenues = []
function servir() {
  porte = false
  retenues.length = 0
  globalThis.fetch = async (url) => {
    if (porte) await new Promise((r) => retenues.push({ url, resoudre: r }))
    else await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
  }
}
/** lâcher une part des réponses retenues — `1` pour tout, `0.5` pour la moitié */
function lacher(part = 1) {
  const n = part >= 1 ? retenues.length : Math.floor(retenues.length * part)
  const partis = retenues.splice(0, n)
  if (part >= 1) porte = false
  for (const e of partis) e.resoudre()
  return partis.length
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
const { tuileDansCrop } = await import('../src/monde/crop-sphere.js')

// Majorque — le lieu des captures d'Adrien et des quatre campagnes précédentes.
const LAT = 39.62
const LON = 2.98
const FOV = 30

function camera(altM) {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(LAT, LON, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function neuf() {
  servir()
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  return g
}
const poser = (g) => g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 15, tuilesParBloc: 3 })

async function tourner(g, cam, images) {
  for (let i = 0; i < images; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
}

/**
 * Les niveaux DESSINÉS dans l'emprise, triés — l'invariant de l'affiche.
 *
 * ⚠️ **UN PARENT PARTIEL COMPTE POUR SON NIVEAU.** À mi-chargement, `_partiel`
 * fait dessiner au parent les seuls quadrants dont l'enfant manque : à l'écran
 * ce sont bien DEUX résolutions dans le même cadre, et c'est précisément ce
 * qu'Adrien refuse. Un relevé qui ignorerait le parent partiel raterait le
 * défaut au seul instant où il existe.
 */
const niveauxDansCrop = (g) => {
  const s = new Set()
  for (const t of g.tiles.values()) if (t.mesh?.visible && g._crop && tuileDansCrop(t.z, t.x, t.y, g._crop)) s.add(t.z)
  return [...s].sort((a, b) => a - b)
}

/** Le globe posé au socle, réseau ouvert, puis la porte REFERMÉE. */
async function socleCalme() {
  const g = neuf()
  poser(g)
  await tourner(g, camera(20_000), 80)
  porte = true
  return g
}

// ═════ ⓐ GOUTTE À GOUTTE — le réseau réel, en accéléré ═════════════════════
//
// La caméra tombe à 600 m et les dalles arrivent **une par une**, une toutes les
// trois images. C'est le modèle le plus proche de la production : à tout instant
// une partie des enfants de l'emprise est prête et l'autre non. Le palier
// atomique refuse de monter tant que la couverture n'est pas complète ; sans
// lui, le parent dessine par quadrants sous les enfants absents et l'affiche
// porte deux résolutions pendant toute la descente.
test('ⓐ garde — les dalles arrivant une par une, aucune image mixte ne naît', async () => {
  const g = await socleCalme()
  const cam = camera(600)
  const vus = []
  let gouttes = 0
  for (let i = 0; i < 240; i++) {
    if (i % 3 === 0 && retenues.length) gouttes += lacher(1 / retenues.length)
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    const n = niveauxDansCrop(g)
    if (n.length) vus.push(n)
  }
  assert.ok(vus.length > 0, 'rien de dessiné dans l’emprise pendant la descente — le test se mentirait')
  assert.ok(gouttes > 0, 'aucune dalle n’a été retenue puis lâchée — la porte n’attrape rien, le banc ne modélise rien')
  const mixtes = vus.filter((n) => n.length > 1)
  assert.deepEqual(
    mixtes.slice(0, 3), [],
    `${mixtes.length} images sur ${vus.length} portent deux finesses ou plus pendant l’arrivée goutte à goutte (${gouttes} dalles) — ex. ${JSON.stringify(mixtes.slice(0, 3))}`
  )
})

// ═════ ⓑ MOITIÉ LÂCHÉE — l'état où le mélange PEUT naître ═══════════════════
//
// ⚡ **C'EST LE TEST QUE LE BANC DE CN1 NE POUVAIT PAS ÉCRIRE.** On lâche la
// MOITIÉ des réponses retenues : une partie des enfants de l'emprise est prête,
// l'autre non. C'est l'unique configuration où `_cropCouvert` a quelque chose à
// refuser — et où un correctif sans palier dessine deux résolutions côte à côte.
test('ⓑ garde — la MOITIÉ des dalles arrivée, l’emprise reste d’une seule finesse', async () => {
  const g = await socleCalme()
  const cam = camera(600)
  await tourner(g, cam, 40)
  const partis = lacher(0.5)
  assert.ok(partis > 0, 'aucune réponse retenue à lâcher — la porte n’a rien attrapé, le banc ne modélise rien')
  const vus = []
  for (let i = 0; i < 160; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    const n = niveauxDansCrop(g)
    if (n.length) vus.push(n)
  }
  assert.ok(vus.length > 0, 'rien de dessiné dans l’emprise — le test se mentirait')
  const mixtes = vus.filter((n) => n.length > 1)
  assert.deepEqual(
    mixtes.slice(0, 3), [],
    `${mixtes.length} images sur ${vus.length} portent deux finesses ou plus avec ${partis} dalles sur deux arrivées — ex. ${JSON.stringify(mixtes.slice(0, 3))}`
  )
})

// ═════ ⓒ TÉMOIN DE VIVACITÉ — le palier MONTE quand tout est arrivé ═════════
//
// ⛔ **SANS CE TEST, ⓐ ET ⓑ SERAIENT VERTS SUR UN GLOBE MORT.** La porte, mal
// posée, pourrait empêcher toute tuile de naître ; « une seule finesse » serait
// alors vrai et vide. On exige donc que, réseau relâché, la finesse SERVIE
// dépasse le socle — c'est-à-dire que le palier a bien franchi des crans.
test('ⓒ témoin — réseau relâché, la finesse servie dépasse le socle', async () => {
  const g = await socleCalme()
  const cam = camera(600)
  await tourner(g, cam, 40)
  lacher(0.5)
  await tourner(g, cam, 40)
  lacher(1)
  await tourner(g, cam, 200)
  assert.ok(
    g._zCropServi > ZOOM_SOCLE,
    `la finesse servie reste à z${g._zCropServi} (socle z${ZOOM_SOCLE}) : la porte a tué le banc, ⓐ et ⓑ ne prouvent RIEN`
  )
  assert.deepEqual(niveauxDansCrop(g), [g._zCropServi], 'au repos, l’emprise doit porter exactement le niveau servi')
})
