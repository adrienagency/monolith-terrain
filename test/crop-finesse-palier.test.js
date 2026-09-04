// LA GARDE DU RAFFINEMENT PAR TUILE — D25
//
// ⛔ **CE FICHIER GARDAIT L’EXACT CONTRAIRE, ET IL A ÉTÉ RÉÉCRIT — PAS SUPPRIMÉ.**
// Sous CN4 il exigeait « une seule finesse par image ». Cette exigence
// **n’a jamais été une demande d’Adrien** : l’assistant l’avait inventée
// (« l’affiche est imprimable »), et Adrien l’a formellement démentie le
// 2026-09-04 — « c’est totalement faux, ça n’est pas ok, si tu peux enlever
// cette surcouche je suis preneur ». Voir `regle-D25.md` dans le dossier sdd.
//
// ⚡ **CE QUI EST GARDÉ À LA PLACE, ET C’EST LA VRAIE DEMANDE.** Le raffinement
// est **PAR TUILE** : une tuile prête est dessinée à sa finesse, elle n’attend
// pas ses sœurs. Ce qui est interdit n’est donc plus le mélange de niveaux —
// c’est le **RETOUR EN ARRIÈRE** : aucun point de l’emprise déjà peint à une
// finesse ne doit être repeint plus grossier. C’est mot pour mot le défaut
// filmé : *« une belle carte bien définie RECOUVERTE à chaque changement
// d’échelle par une carte plus colorée en moins bonne définition »*.
//
// ⚠️ **LA GRANDEUR A CHANGÉ AVEC L’EXIGENCE.** On ne relève plus « combien de
// niveaux dans le cadre » (`niveauxDansCrop`, la grandeur de la contrainte
// abrogée) mais **la finesse RENDUE en un point** — le niveau de la tuile qui
// peint réellement ce point, quadrant partiel de R37 compris. Deux niveaux
// voisins côte à côte ne sont plus un défaut ; un point qui recule en est un.
//
// La porte réseau du banc est celle de CN4, inchangée : c’est elle qui crée
// l’état où une partie des enfants est prête et l’autre non. Sans elle, le banc
// résout tout en une microtâche et n’observe rien (CN3, §7).
//
// ══════ LA PREUVE QUE CES GARDES MORDENT (mutation du produit) ══════
//
// `node scripts/mutation-cn4.mjs palier-rendu` remet le palier atomique de CN2 :
// la finesse servie ne remonte plus que d’un cran par image après chaque pose de
// crop, au lieu de valoir la cible.
//
//   | test                          | dépôt (D25) | `palier-rendu` | CN2 (le code d’avant) |
//   |---|---|---|---|
//   | ⓐ goutte à goutte             | ✔ | ✔ ⚠️ | ✔ ⚠️ |
//   | ⓑ changement d’échelle        | ✔ | **✖ 98 reculs** | **✖ 735 reculs, z16 → z14** |
//   | ⓒ témoin de vivacité          | ✔ | ✔ | ✔ |
//
// ⚠️ **ET JE DIS CE QUE ⓐ NE PROUVE PAS.** ⓐ ne rougit ni sous la mutation ni
// sous le code de CN2, **et c’est normal** : il part d’un cache FROID, où la
// finesse ne peut que monter — le palier y était lent, pas régressif. C’est
// exactement l’angle mort des quatre campagnes précédentes, qui ne mesuraient que
// des descentes à froid. ⓐ garde le raffinement partiel de R37 contre une
// régression future ; **c’est ⓑ qui garde le défaut d’Adrien**, et il fallait
// chauffer le crop jusqu’à la netteté pour seulement l’apercevoir.
//
//
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

/** Le globe posé au socle, réseau ouvert, puis la porte REFERMÉE. */
async function socleCalme() {
  const g = neuf()
  poser(g)
  await tourner(g, camera(20_000), 80)
  porte = true
  return g
}


// ── LA FINESSE RENDUE EN UN POINT ──────────────────────────────
//
// On descend depuis la racine : la première tuile VISIBLE qui peint le point
// gagne. Une tuile partielle (R37) ne peint que les quadrants de son masque
// (`_partiel`) — si le quadrant du point n’y est pas, on continue vers l’enfant.
// ⚠️ **C’est la seule lecture honnête sous raffinement par tuile** : compter les
// niveaux visibles dans le cadre confondrait « deux finesses voisines », qui est
// désormais NORMAL, avec « ce point a reculé », qui est le défaut.
// Rend 0 quand aucun maillage ne peint le point.
function finesseEn(g, mx, my) {
  for (let z = 2; z <= 22; z++) {
    const n = 2 ** z
    const x = Math.min(n - 1, Math.floor(mx * n))
    const y = Math.min(n - 1, Math.floor(my * n))
    const t = g.tiles.get(`${z}/${x}/${y}`)
    if (!t || !t.mesh?.visible) continue
    if (!t._partiel) return z
    const cx = Math.floor(mx * n * 2) & 1
    const cy = Math.floor(my * n * 2) & 1
    if (t._partiel & (1 << (cx + (cy << 1)))) return z
  }
  return 0
}

/** Une grille de 7 × 7 points DANS l’emprise, en mercator normalisé. */
function grille(rep, k = 7) {
  const pts = []
  for (let j = 0; j < k; j++) {
    for (let i = 0; i < k; i++) {
      pts.push([rep.cx + rep.demi * ((2 * (i + 0.5)) / k - 1) * 0.98, rep.cy + rep.demi * ((2 * (j + 0.5)) / k - 1) * 0.98])
    }
  }
  return pts
}

const releve = (g, pts) => pts.map(([mx, my]) => finesseEn(g, mx, my))

/** Les reculs entre deux relevés : un point peint dans les deux, plus grossier. */
function reculs(avant, apres) {
  const r = []
  for (let k = 0; k < apres.length; k++) {
    if (apres[k] > 0 && avant[k] > 0 && apres[k] < avant[k]) r.push({ point: k, de: avant[k], a: apres[k] })
  }
  return r
}

// ═════ ⓐ GOUTTE À GOUTTE — aucun point ne recule pendant l’affinage ═════
//
// La caméra tombe à 600 m et les dalles arrivent **une par une**. Sous le palier
// atomique, l’emprise entière restait au niveau grossier tant qu’une seule tuile
// de bord manquait, puis basculait d’un coup ; sous le raffinement par tuile,
// chaque point monte quand SA tuile arrive — et ne redescend jamais.
test('ⓐ garde — les dalles arrivant une par une, aucun point de l’emprise ne recule', async () => {
  const g = await socleCalme()
  const cam = camera(600)
  const pts = grille(g._crop)
  let prec = releve(g, pts)
  let gouttes = 0
  let monte = 0
  const tousReculs = []
  for (let i = 0; i < 240; i++) {
    if (i % 3 === 0 && retenues.length) gouttes += lacher(1 / retenues.length)
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    const f = releve(g, pts)
    tousReculs.push(...reculs(prec, f))
    for (let k = 0; k < f.length; k++) if (f[k] > prec[k]) monte++
    prec = f
  }
  assert.ok(gouttes > 0, 'aucune dalle n’a été retenue puis lâchée — la porte n’attrape rien, le banc ne modélise rien')
  assert.ok(monte > 0, 'aucun point n’a gagné en finesse — le banc ne raffine pas, la garde serait vraie et vide')
  assert.deepEqual(
    tousReculs.slice(0, 3), [],
    `${tousReculs.length} reculs de finesse pendant l’arrivée goutte à goutte (${gouttes} dalles, ${monte} montées) — ex. ${JSON.stringify(tousReculs.slice(0, 3))}`
  )
})

// ═════ ⓑ CHANGEMENT D’ÉCHELLE — LE DÉFAUT FILMÉ PAR ADRIEN ══════════
//
// ⚡ **C’EST LE BANC QUI MANQUAIT À TOUTE LA CAMPAGNE.** Les quatre agents
// précédents mesuraient un cache FROID, où la finesse ne peut que monter :
// « zéro recul » y est vrai sans rien prouver. Adrien, lui, décrit un crop
// **déjà net** que le changement d’échelle recouvre. On chauffe donc jusqu’à la
// netteté, puis on repose le crop à une autre échelle — exactement ce que fait
// `branchement-crop.js` dès que `demZoom` ou `tuilesParBloc` bouge — et on exige
// que pas un point déjà peint fin ne redevienne grossier.
test('ⓑ garde — un crop déjà net ne se recouvre pas d’une surcouche au changement d’échelle', async () => {
  const g = neuf()
  poser(g)
  const cam = camera(600)
  await tourner(g, cam, 260)
  const ptsAvant = grille(g._crop)
  const avant = releve(g, ptsAvant)
  assert.ok(Math.max(...avant) > ZOOM_SOCLE, `l’emprise n’est jamais devenue nette (max z${Math.max(...avant)}) : le banc ne prouverait rien`)
  // le changement d’échelle : même centre, un cran d’emprise de plus
  g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 14, tuilesParBloc: 3 })
  const tousReculs = []
  for (let i = 0; i < 20; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
    tousReculs.push(...reculs(avant, releve(g, ptsAvant)))
  }
  assert.deepEqual(
    tousReculs.slice(0, 3), [],
    `${tousReculs.length} reculs de finesse sur 20 images après le changement d’échelle — la surcouche d’Adrien, ex. ${JSON.stringify(tousReculs.slice(0, 3))}`
  )
})

// ═════ ⓒ TÉMOIN DE VIVACITÉ — la finesse servie dépasse le socle ════════
//
// ⛔ **SANS CE TEST, ⓐ ET ⓑ SERAIENT VERTS SUR UN GLOBE MORT.** La porte, mal
// posée, pourrait empêcher toute tuile de naître ; « aucun recul » serait alors
// vrai et vide.
// ⚠️ **CE QUI A CHANGÉ ICI DEPUIS CN4** : la seconde assertion exigeait
// `niveauxDansCrop(g) === [servi]`, c’est-à-dire la contrainte abrogée elle-même.
// Elle est remplacée par ce qui reste vrai et qui est plus fort : **au repos,
// chaque point de l’emprise est peint, et à la finesse servie**.
test('ⓒ témoin — réseau relâché, la finesse servie dépasse le socle et l’emprise est peinte', async () => {
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
  const f = releve(g, grille(g._crop))
  assert.equal(f.filter((z) => z === 0).length, 0, `au repos, ${f.filter((z) => z === 0).length} points de l’emprise ne sont peints par aucune tuile — un trou`)
  assert.equal(Math.min(...f), g._zCropServi, `au repos, l’emprise doit être peinte à la finesse servie (min z${Math.min(...f)}, servi z${g._zCropServi})`)
})
