// LE PLAFOND DE FINESSE DU CROP EST FONCTION DE L'ALTITUDE — tâche PLF
//
// ⚡ **CE FICHIER NE PORTE AUCUN CORRECTIF : il verrouille une MESURE.** La
// tâche PLF demandait de poser un plafond de niveau de détail fonction de
// l'altitude, parce que le crop, porté à ~130 km d'altitude de cadrage sans
// intention de sortir (D21 ①), y resaturait le cache à `CACHE_MAX_CONTINU`.
// Mesuré dans l'application APRÈS la fusion de `_zoomCropEcran` (CULL ⑤),
// `scripts/sonde-plf.mjs`, Majorque, CPU ×4, 20 images consécutives au repos :
//
//   | grandeur, crop vivant à 130 km | débrayé (le dépôt d'avant) | **le dépôt** |
//   |---|---|---|
//   | cache occupé, p50 (plafond dur 1 700) | **1 672** | **454** |
//   | `_credit` p50 | 87 | 1 323 |
//   | longueur de file p50 | 162 | 0 |
//   | tuiles parcourues p50 | 2 909 | 399 |
//   | `_traverse` p50 / p99 (ms) | 11,1 / 15,4 | 1,7 / 2,7 |
//   | ms/image p50 à CPU ×4 | **136,5** | **27,3** |
//   | niveaux DESSINÉS dans l'emprise | 9,10,11,12,13 | **11 — un seul** |
//
// ➡️ **Le défaut est éteint, et le plafond demandé existe déjà** : c'est
// `_zoomCropEcran`, dont la sortie descend 12 → 11 → 10 → 9 → 8 → 7 quand
// l'altitude monte de 60 km à 1 200 km (relevé dans l'application, même sonde).
// Ce que ce fichier empêche, c'est qu'il redevienne insensible à l'altitude
// sans que rien ne rougisse — la suite était verte des DEUX côtés du défaut
// avant `test/crop-emprise-ecran.test.js`, et le point de 130 km n'y est pas.
//
// ⚠️ **CE N'EST PAS UN DOUBLON DE `crop-emprise-ecran.test.js` ②**, qui mesure
// 900 km avec une emprise de `demZoom` 4. Le point qui a motivé PLF est
// ailleurs : **130 km, `demZoom` 6, une emprise de 1 464 km** — l'altitude à
// laquelle Adrien s'arrête et regarde. Les deux points ont des zooms d'écran
// différents (z8 contre z11) et c'est la PLAGE qui est le sujet.
//
// Harnais : celui de `test/crop-emprise-ecran.test.js` (DOM de papier, `fetch`
// qui rend une dalle plate immédiatement).

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
globalThis.fetch = async () => {
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

function neuf(levier = true) {
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id)
  const g = new Globe({ globeContinu: true })
  g.cropZoomEcran = levier
  g.setVisible(true)
  return g
}

// `demZoom` = la largeur du crop en niveaux (`assietteCrop`, `main.js`)
const poser = (g, demZoom) => g.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: demZoom, tuilesParBloc: 3 })

async function tourner(g, cam, images) {
  for (let i = 0; i < images; i++) {
    g.update(cam, 0.016)
    await new Promise((r) => setTimeout(r, 0))
  }
}

/** Les niveaux réellement DESSINÉS dans l'emprise du crop, triés. */
function niveauxDansCrop(g) {
  const s = new Set()
  for (const t of g.tiles.values()) {
    if (t.z <= 2 || !g._crop) continue
    if (t.mesh && t.mesh.visible && tuileDansCrop(t.z, t.x, t.y, g._crop)) s.add(t.z)
  }
  return [...s].sort((a, b) => a - b)
}

// ═════ ① LE POINT DE PLF : 130 km, `demZoom` 6, le cache ne sature plus ══════
//
// ⛔ **C'EST LE TEST QUI MORD.** Mutation vérifiée : `cropZoomEcran = false`
// (le dépôt d'avant CULL ⑤) fait franchir la borne du cache et descendre le
// maillage à `ZOOM_SOCLE` dans une emprise de 1 464 km. C'est le tirage
// `avant-majorque` de `scripts/sonde-plf.mjs` — 1 672 tuiles sur 1 700.
test('① crop vivant à 130 km : le cache ne sature pas, et le maillage reste grossier', async () => {
  const g = neuf()
  poser(g, 6) // l'emprise mesurée à 139 km : 1 464 km de large
  const cam = camera(LAT, LON, 130_000)
  await tourner(g, cam, 60)

  const z = g._zCropEcran
  assert.ok(z > 0, '`_zCropEcran` n’a pas été calculé par `update` — le test se mentirait')
  assert.ok(z < ZOOM_SOCLE, `à 130 km la borne d’écran vaut z${z}, soit ZOOM_SOCLE : elle ne borne rien`)
  assert.ok(g.tiles.size < g.cacheMax, `le cache est saturé (${g.tiles.size} / ${g.cacheMax})`)

  // la mutation, DANS le test : débrayé, le même geste va chercher plus fin
  const h = neuf(false)
  poser(h, 6)
  await tourner(h, camera(LAT, LON, 130_000), 60)
  let zH = 0
  for (const t of h.tiles.values()) if (t.z > zH && h._crop && tuileDansCrop(t.z, t.x, t.y, h._crop)) zH = t.z
  let zG = 0
  for (const t of g.tiles.values()) if (t.z > zG && g._crop && tuileDansCrop(t.z, t.x, t.y, g._crop)) zG = t.z
  assert.ok(zG > 0, 'aucune tuile du crop en cache — le test se mentirait')
  assert.ok(zH > zG, `débrayé, le parcours devrait descendre plus bas que z${zG} (il rend z${zH}) — la mutation ne mord plus`)
})

// ═════ ② LE NOMBRE DE FINESSES NE PART PAS EN ÉVENTAIL ══════════════════════
//
// ⛔ **L'invariant que tout plafond de finesse doit respecter** : le crop est
// une image imprimable, **une seule finesse par image**. Relevé dans
// l'application à 130 km, 20 images au repos : **un seul niveau dessiné (z11)**
// contre **cinq (9,10,11,12,13)** le levier débrayé.
//
// ⚠️ **ET LE BANC DE PAPIER NE REND PAS 1, IL REND 4 — ce n'est pas la même
// grandeur, et l'écrire « 1 » ici serait un faux verrou.** Dans l'application,
// les 20 images sont prises AU REPOS, après le calme : les parents ont cédé la
// place. Ici on arrête à 60 images, `fetch` bouclé mais les parents encore
// dessinés sous leurs enfants — la pile de raffinement, pas un éventail de
// finesses. Ce que ce test tient est donc la COMPARAISON, à banc identique :
// le levier débrayé montre STRICTEMENT PLUS de finesses que le dépôt.
// L'uniformité de la PRESCRIPTION, elle, est verrouillée ailleurs, et sans
// ambiguïté de banc : `test/crop-emprise-ecran.test.js` ③.
test('② à 130 km, le levier débrayé étale PLUS de finesses que le dépôt', async () => {
  const g = neuf()
  poser(g, 6)
  await tourner(g, camera(LAT, LON, 130_000), 60)
  const n = niveauxDansCrop(g)
  assert.ok(n.length > 0, 'rien de dessiné dans l’emprise — le test se mentirait')

  const h = neuf(false)
  poser(h, 6)
  await tourner(h, camera(LAT, LON, 130_000), 60)
  const m = niveauxDansCrop(h)
  assert.ok(m.length > n.length, `débrayé, l’éventail devrait s’élargir : ${m.join(',')} contre ${n.join(',')}`)
  assert.ok(Math.max(...m) > Math.max(...n), `débrayé, la finesse maximale devrait monter : z${Math.max(...m)} contre z${Math.max(...n)}`)
})

// ═════ ③ LA PLAGE ENTIÈRE, ET LE BLOC INCHANGÉ ═════════════════════════════
//
// ⚠️ **§2 de `/threejs-optimisation` : « une constante peut être du code mort,
// mesure la SORTIE sur toute la plage ».**
//
// ⛔ **CE QUI EST VERROUILLÉ ICI EST LA FORME, PAS LES VALEURS DE L'AUTRE
// BANC.** La sonde a relevé, dans l'application (caméra de trois quarts, centre
// de crop décalé) : 60 km → z12, 130 → z11, 300 → z9, 600 → z8, 1 200 → z7. Le
// banc de papier vise au nadir exact et rend **un niveau de plus** en bas de la
// plage (z13 à 60 km). Recopier les chiffres de l'application ici ferait un
// test rouge de naissance qui n'aurait rien prouvé : « un relevé qui ne décrit
// pas son banc ne se compare à rien ». On tient donc la décroissance, l'ampleur
// de la plage, et la neutralité au bloc — les trois propriétés dont dépend
// l'absence du défaut.
test('③ le plafond descend avec l’altitude, et vaut ZOOM_SOCLE au bloc', () => {
  const g = neuf()
  poser(g, 13)
  assert.equal(g._zoomCropEcran(camera(LAT, LON, 4_400).position), ZOOM_SOCLE,
    'à l’altitude de travail (4,4 km) la borne doit être neutre')

  const plage = [30_000, 60_000, 130_000, 300_000, 600_000, 1_200_000]
  const releve = plage.map((a) => [a, g._zoomCropEcran(camera(LAT, LON, a).position)])
  let prec = Infinity
  for (const [altM, z] of releve) {
    assert.ok(z <= ZOOM_SOCLE, `z${z} dépasse ZOOM_SOCLE à ${altM} m`)
    assert.ok(z <= prec, `le plafond REMONTE en montant (${altM} m : z${z} après z${prec})`)
    prec = z
  }
  const ampleur = releve[0][1] - releve[releve.length - 1][1]
  assert.ok(ampleur >= 5, `la borne ne perd que ${ampleur} niveaux sur un facteur 40 d’altitude — ce n’est plus un plafond d’altitude`)
  assert.ok(releve[2][1] < ZOOM_SOCLE, `à 130 km — le point de PLF — la borne vaut encore ZOOM_SOCLE`)
})
