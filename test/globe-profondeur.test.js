// LE QUADTREE DU GLOBE DESCEND JUSQU'AU SOCLE — ET CE N'EST PAS `MAX_Z` QUI
// L'EN EMPÊCHAIT.
//
// Plan « globe continu », Tâche 4 quater. La Tâche 4 a rendu `MAX_Z = 11`
// ATTEIGNABLE (tri spatial : horizon géométrique + frustum), et la Tâche 4
// sexies a payé le budget qui le rend COMPLET (`CACHE_MAX = 600`). Le globe
// s'arrêtait pourtant à z11 **à toute altitude sous 63,7 km**, et la constante
// n'y était pour rien :
//
//     ⚠️ MESURÉ AVANT CORRECTION — `MAX_Z = 16` avec `CACHE_MAX = 8 000`,
//     soit treize fois le budget d'alors, rend TOUJOURS z11 à 8 km.
//
// Le verrou était le PLANCHER de `dist` dans `_traverse` :
//
//     const dist = Math.max(camPos.distanceTo(t.center) - t.chord * 0.5, 1)
//
// `R_GLOBE = 100` (`src/geo.js`) pour 6 371 000 m : **une unité de scène vaut
// 63 710 m, donc ce `1` valait 63,7 km.** Sous cette altitude `dist` est
// CONSTANT, le ratio `chord / dist` cesse de dépendre de l'altitude, et le
// raffinement s'arrête net — z11 à froid, quelle que soit la valeur de `MAX_Z`.
// C'est le défaut que le §2 de `/threejs-optimisation` décrit : une limite qui
// n'est pas atteinte, et une constante qu'on monte pour rien.
//
// Ce que ce fichier verrouille, et il faut les DEUX gestes pour le tenir vert :
//   1. le plancher de `dist` exprimé en MÈTRES (`PLANCHER_DIST_M`) et non en
//      unités de scène, donc plus bas d'un facteur ~64 000 ;
//   2. `MAX_Z = 15` — la borne de la donnée AWS (`src/dem-source.js`,
//      `maxZoom: 15`), et la finesse dont le socle a besoin : à 45° de
//      latitude, z15 vaut 1,69 m par pixel en tuiles 512 px.
//
// ⚠️ LA MUTATION EST VÉRIFIÉE DANS LES DEUX SENS : remettre le plancher à 1
// tue ce test, ET remettre `MAX_Z` à 11 le tue aussi.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
// Mêmes bouchons que `test/globe-eviction.test.js` : une seule dalle RGBA
// partagée, un canevas qui ne peint rien. Ce fichier ne compte ni les décodages
// ni les requêtes — il mesure le NIVEAU ATTEINT.

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}

class FakeCtx {
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage() {}
  getImageData() {
    return { data: DALLE }
  }
}

globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')

let requetes = 0

function serve() {
  requetes = 0
  // ⚠️ La mémoire de tuiles est vidée à chaque montage : sans ça, une station
  // héritant du cache d'une autre mesurerait l'hystérésis et non le critère.
  _resetTileMemo()
  globalThis.fetch = async (url) => {
    requetes++
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}

// ───────────────────────────── LE PROTOCOLE A, celui de la Tâche 4 ────────────
//
// Globe NEUF par station (le zoom atteint est une grandeur à HYSTÉRÉSIS : un
// globe promené d'une station à l'autre rend un autre chiffre, et les deux sont
// justes) ; caméra `PerspectiveCamera(30, 16/9, clamp(orbAlt×0,2 ; 0,01 ; 0,5),
// 1400)` posée sur la station et regardant le centre de la planète ; à chaque
// image `update()` puis attente que la file se vide ; **douze images jetées,
// vingt relevées, stabilité exigée**.
//
// Les trois valeurs de caméra viennent du dépôt : fov 30° (`src/main.js`), far
// 1400 (`src/modes.js`), near (`src/loi-altitude.js`). Le `clamp` fait partie
// de la formule — sans lui le plan proche part à zéro en orbite haute.
const FOV = 30
const FAR = 1400
const LAT_STATION = 45
const LON = 6.25
const M_PAR_UNITE = 63_710 // EARTH_RADIUS_M / R_GLOBE — src/geo.js
// ⚠️ DIX-SEPT ET NON DOUZE, ET LE CHIFFRE SE MESURE. La règle sans-trou ne
// descend que d'UN NIVEAU PAR IMAGE (une tuile ne se refend qu'une fois ses
// quatre enfants prêts) : quatre niveaux de plus, c'est quatre images de plus à
// jeter. Relevé image par image sur ce dépôt — convergence à l'image 12 à 8 km,
// à l'image 13 à 2 km, puis plus un seul changement pendant vingt images.
// ⚠️ Un JETEES trop court ne fait pas échouer « c'est trop lent » : il fait
// échouer « zmax oscille 14/15 » et « 232 requêtes caméra immobile », c'est-à-dire
// qu'il IMITE le défaut cherché.
const JETEES = 17
const RELEVEES = 20
const planProche = (orbAlt) => Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)

function poseCamera(lat, lon, rayon) {
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, FAR)
  latLonToSphere(lat, lon, rayon, camera.position)
  camera.near = planProche(rayon - R_GLOBE)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

function etat(globe) {
  let zmax = 0
  let dessinees = 0
  for (const t of globe.tiles.values()) {
    if (!t.mesh?.visible) continue
    dessinees++
    if (t.z > zmax) zmax = t.z
  }
  return { zmax, dessinees, cache: globe.tiles.size }
}

async function calme(globe, max = 60_000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

async function station(altM) {
  serve()
  const globe = new Globe({ globeContinu: true })
  globe.setVisible(true)
  const camera = poseCamera(LAT_STATION, LON, R_GLOBE + altM / M_PAR_UNITE)
  for (let i = 0; i < JETEES; i++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  const serie = []
  const avant = requetes
  for (let i = 0; i < RELEVEES; i++) {
    globe.update(camera, 0.016)
    await calme(globe)
    serie.push(etat(globe))
  }
  const auRepos = requetes - avant
  globe.dispose()
  return { serie, auRepos }
}

// ⚠️ L'ALTITUDE EST NOMMÉE, ET C'EST VOULU. « Une altitude de socle » est
// produite par la Tâche 3 (`seuil-socle.js`), qui passe APRÈS celle-ci et
// pourra la déplacer ; ce test ne doit pas dépendre d'une valeur qui n'existe
// pas encore. 8 km est l'une des six altitudes nommées du banc de la Tâche 4.
const ALT_SOCLE_M = 8_000

// z13 et non z15 : le test doit mordre sur le VERROU (le plancher de `dist`),
// pas sur la valeur exacte que le budget de cache autorise ce jour-là. z13 vaut
// 6,76 m par pixel à 45° en tuiles 512 px — deux niveaux au-dessus du z11
// d'avant, donc hors de portée de toute hystérésis.
const Z_EXIGE = 13

let _mesure = null
const mesure = () => (_mesure ??= station(ALT_SOCLE_M))

const ligne = (r) => {
  const d = r.serie[r.serie.length - 1]
  return `z${d.zmax}, ${d.dessinees} dessinées, cache ${d.cache}, ${r.auRepos} requêtes sur ${RELEVEES} images`
}

test(`à ${ALT_SOCLE_M / 1000} km d altitude le globe atteint au moins z${Z_EXIGE}`, async () => {
  const r = await mesure()
  const zmax = r.serie[r.serie.length - 1].zmax
  assert.ok(
    zmax >= Z_EXIGE,
    `le globe plafonne à z${zmax} à ${ALT_SOCLE_M / 1000} km — ` +
      `c'est le plancher de \`dist\` (1 unité = 63,7 km) qui l'arrête, pas MAX_Z · ${ligne(r)}`
  )
})

test('… et il y est STABLE : zmax et tuiles dessinées constants sur 20 images', async () => {
  const r = await mesure()
  const z = r.serie.map((e) => e.zmax)
  const d = r.serie.map((e) => e.dessinees)
  assert.ok(
    z.every((v) => v === z[0]),
    `zmax oscille sur 20 images (${[...new Set(z)].sort((a, b) => a - b).join(', ')}) — ` +
      `descendre plus bas ne vaut rien si l'image d'après remonte`
  )
  assert.ok(
    d.every((v) => v === d[0]),
    `les tuiles dessinées oscillent sur 20 images (min ${Math.min(...d)}, max ${Math.max(...d)})`
  )
})

test('… et la caméra IMMOBILE ne demande toujours rien au réseau', async () => {
  const r = await mesure()
  assert.equal(r.auRepos, 0, `${r.auRepos} requêtes caméra strictement immobile — ${ligne(r)}`)
})

// ══════════ LA BORNE DE DONNÉES (Étape 5) ═══════════════════════════════════
//
// ⚠️ `MAX_Z` NE PEUT PAS DÉPASSER CE QUE LA SOURCE PORTE. Le globe tape encore
// en dur `elevation-tiles-prod/terrarium` — le jeu AWS, qui s'arrête à z15
// (`src/dem-source.js`, `aws.maxZoom`). Au-delà, chaque tuile revient en
// `error` : elle ne coûte pas seulement une requête perdue, elle OCCUPE une
// place du budget jusqu'à ce que le rang 0 d'éviction la reprenne (Tâche 4,
// Étape 6) — et la quarantaine qui l'empêche de repartir en boucle EXPIRE au
// bout de 600 images, ce qui est exactement ce qu'il faut ici.
//
// Ce test lie donc `MAX_Z` du globe au plafond DÉCLARÉ de la source. La 4 alpha
// rebranchera Mapterhorn (z17) : c'est ce jour-là, et pas avant, que la borne
// pourra monter — et ce test le dira, parce qu'il lit `dem-source.js` et non un
// littéral recopié.
// ⚠️ ET LA BORNE DOIT TENIR À L'EXÉCUTION, PAS SEULEMENT DANS LA CONSTANTE.
// C'est le même piège que la quarantaine de la Tâche 4 : une tuile `error` occupe
// une place du budget jusqu'à son éviction, et une seule requête z16 partie par
// erreur en fait naître quatre. On vérifie donc ce qui est DEMANDÉ au réseau, à
// l'altitude la plus basse des six nommées — celle où le globe atteint z15 et où
// il serait tenté d'aller plus loin.
test('aucune tuile au-delà de MAX_Z ne part sur le réseau, même à 2 km', async () => {
  const { MAX_Z } = await import('../src/globe.js')
  const vus = new Set()
  _resetTileMemo()
  globalThis.fetch = async (url) => {
    vus.add(Number(url.split('terrarium/')[1].split('/')[0]))
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
  const globe = new Globe({ globeContinu: true })
  globe.setVisible(true)
  const camera = poseCamera(LAT_STATION, LON, R_GLOBE + 2_000 / M_PAR_UNITE)
  for (let i = 0; i < JETEES + 3; i++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  const trop = [...vus].filter((z) => z > MAX_Z)
  globe.dispose()
  assert.deepEqual(
    trop,
    [],
    `z${trop.join(', z')} demandé(s) au réseau alors que MAX_Z = ${MAX_Z} — AWS répondrait en erreur, ` +
      `et chaque erreur occupe une place du cache jusqu'à son éviction`
  )
  // et il est bien allé jusqu'au bout de ce qu'il a le droit de demander
  assert.ok(vus.has(MAX_Z), `z${MAX_Z} jamais demandé à 2 km : la borne n'est toujours pas atteinte`)
})

test('MAX_Z ne dépasse pas ce que la source de relief porte réellement', async () => {
  const { DEM_SOURCES } = await import('../src/dem-source.js')
  const { MAX_Z } = await import('../src/globe.js')
  const urlDuGlobe = (await import('node:fs')).readFileSync(
    new URL('../src/globe.js', import.meta.url),
    'utf8'
  )
  // le globe tape encore AWS en dur : c'est ce constat qui borne MAX_Z
  assert.ok(
    urlDuGlobe.includes('elevation-tiles-prod/terrarium'),
    'le globe ne tape plus AWS en dur — la Tâche 4 alpha est passée, relevez cette borne avec elle'
  )
  assert.ok(
    MAX_Z <= DEM_SOURCES.aws.maxZoom,
    `MAX_Z = ${MAX_Z} au-dessus du z${DEM_SOURCES.aws.maxZoom} d'AWS : les tuiles reviendront en error, ` +
      `et une tuile error occupe une place du cache jusqu'à son éviction`
  )
})
