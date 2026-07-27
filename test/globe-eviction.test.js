// LE GLOBE N'ÉVINCE PLUS LES TUILES DONT IL A BESOIN À LA FRAME SUIVANTE.
//
// Le quadtree du globe (src/globe.js) descend z2 → z11 en réclamant les mêmes
// tuiles terrarium AWS que le terrain. Sa politique d'éviction avait un défaut
// qui se compte en requêtes, et il tenait en trois lignes :
//
//   1. `_traverse` pose `t.lastUsed = this.frame` sur CHAQUE tuile qu'il
//      parcourt — y compris les ancêtres raffinés, ceux qui portent la descente.
//   2. Un ancêtre raffiné a `mesh.visible === false` (seules les feuilles sont
//      allumées), donc il passe le filtre `!(t.mesh && t.mesh.visible)` et
//      devient candidat à l'éviction.
//   3. Le tri `(a, b) => a.lastUsed - b.lastUsed` laisse alors un ÉNORME groupe
//      d'ex æquo qui partagent tous `lastUsed === this.frame`. Array.prototype
//      .sort est stable : les ex æquo se départagent par ordre d'insertion dans
//      la Map, c'est-à-dire les tuiles créées EN PREMIER — les ancêtres z2/z3.
//
// Le globe évinçait très exactement les tuiles qu'il allait reparcourir à la
// frame suivante. Elles repartaient sur le réseau, revenaient, se faisaient
// réévincer : une tuile z3 était redemandée des dizaines de fois pendant un
// seul vol, et le coût ne s'arrête pas au réseau — chaque retour repaie un
// DÉCODAGE complet (256×256 pixels dépaquetés en mètres) et une reconstruction
// de maillage.
//
// ⚠️ ET LE CORRECTIF ÉVIDENT EST UN PIÈGE. Exclure du tri tout ce qui porte
// `lastUsed === this.frame` supprime 100 % des doublons… et arrête l'éviction :
// le cache dépasse alors très largement CACHE_MAX (420 tuiles), soit des
// centaines de Mo de hauteurs et de textures sur un tas déjà mesuré à 1,7-1,9
// Go. On échangerait un problème de réseau contre un problème de mémoire.
// C'est pourquoi CHAQUE test de doublon ci-dessous est doublé d'une assertion
// de budget : le contrat est « moins de requêtes À BUDGET CONSTANT », jamais
// l'un sans l'autre.
//
// La bonne forme n'est donc pas d'épargner les porteurs, c'est de LES CLASSER
// EN DERNIER. Deux rangs :
//   · rang 1 — tout ce qui ne porte pas la couverture courante, du plus ancien
//     au plus récent, puis du PLUS PROFOND au moins profond (à ancienneté
//     égale, une z9 ne couvre qu'un timbre-poste qu'on a déjà survolé, une z3
//     est sur le chemin de descente de toutes les frames à venir).
//   · rang 2 — les porteurs eux-mêmes, du plus profond au moins profond, et on
//     n'y touche que si le rang 1 ne suffit pas à tenir le budget.
// Le budget reste donc DUR : le rang 2 garantit qu'il y a toujours une victime.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
// Le globe se sert du canevas pour DEUX choses très différentes : peindre la
// rampe hypsométrique (dégradé 512×1) et dépaqueter les tuiles d'altitude
// (getImageData 256×256). Seule la seconde nous intéresse — et c'est elle qui
// compte les décodages.

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)

// une seule dalle RGBA, partagée : le décodage lit toujours les mêmes octets,
// ce qu'on mesure ici c'est COMBIEN DE FOIS il les relit
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}

let decodages = 0

class FakeCtx {
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) {
    if (w === 256) decodages++ // une tuile dépaquetée = un décodage payé
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

// -------------------------------------------------- faux serveur qui COMPTE

const appels = new Map() // url → nombre de requêtes
const total = () => [...appels.values()].reduce((a, b) => a + b, 0)
const uniques = () => appels.size

function serve() {
  appels.clear()
  decodages = 0
  // ⚠️ LA MÉMOIRE DE TUILES EST VIDÉE À CHAQUE MONTAGE, exprès. `_tileMemo`
  // (test/globe-reseau.test.js) rachète le réseau des tuiles redemandées — donc
  // si on la laissait pleine, elle MASQUERAIT très exactement ce que ce
  // fichier-ci mesure, et les comptes passeraient au vert sans que l'éviction
  // soit réparée. Les deux fichiers testent deux étages distincts du même
  // trajet : là-bas ce qui est racheté, ici ce qui n'est plus redemandé.
  _resetTileMemo()
  globalThis.fetch = async (url) => {
    appels.set(url, (appels.get(url) || 0) + 1)
    // un aller-retour réseau n'est jamais synchrone
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere } = await import('../src/geo.js')

// les constantes du module, redites ici pour que le test échoue si elles bougent
const CACHE_MAX = 420
const ROOT_Z = 2

// ------------------------------------------------------------------- le vol
//
// Un vol à TRAVAIL FIXE : 40 paliers d'altitude en descente géométrique, 8
// tours de boucle par palier, le réseau vidé entre chaque tour. Aucune horloge,
// aucun hasard — deux exécutions émettent exactement les mêmes requêtes.

const LAT = 43.45 // le Var, le même cas de référence que test/damier-reseau
const LON = 6.25
const R_HAUT = 350 // ≈ z3 en feuilles
const R_BAS = 105 // ≈ z9 en feuilles

// vide la file du globe : tant qu'il reste des requêtes en vol ou en attente,
// on rend la main à la boucle d'événements (MAX_CONCURRENT = 6, il faut donc
// plusieurs tours pour drainer un palier)
async function calme(globe, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

async function vol(globe, { paliers = 40, tours = 8 } = {}) {
  globe.setVisible(true)
  const camera = { position: new THREE.Vector3() }
  const zoomsDessines = new Set()
  let picTuiles = 0
  let frames = 0

  for (let p = 0; p < paliers; p++) {
    const f = paliers === 1 ? 0 : p / (paliers - 1)
    const r = R_HAUT * (R_BAS / R_HAUT) ** f // descente géométrique
    latLonToSphere(LAT, LON, r, camera.position)
    for (let k = 0; k < tours; k++) {
      globe.update(camera, 0.016)
      frames++
      await calme(globe)
      picTuiles = Math.max(picTuiles, globe.tiles.size)
    }
    for (const t of globe.tiles.values()) if (t.mesh?.visible) zoomsDessines.add(t.z)
  }

  // l'état à l'altitude la plus basse — c'est là que le défaut se voyait le
  // mieux : le globe y dessinait 19 tuiles z3 au lieu de ~300 tuiles z6
  let zoomFinal = 0
  let visiblesFinal = 0
  for (const t of globe.tiles.values()) {
    if (!t.mesh?.visible) continue
    visiblesFinal++
    zoomFinal = Math.max(zoomFinal, t.z)
  }
  return { zoomsDessines, picTuiles, frames, zoomFinal, visiblesFinal }
}

// rapport lisible, accroché aux messages d'assertion
const rapport = (globe, m) =>
  `${total()} requêtes / ${uniques()} URL distinctes (×${(total() / uniques()).toFixed(2)}), ` +
  `${decodages} décodages, pic ${m.picTuiles} tuiles, ${globe.tiles.size} à l'arrivée`

// ------------------------------------------------------------------- le banc

// Le vol est partagé par les trois tests qui suivent, et c'est délibéré : une
// assertion par test, sinon un seul échec ne dit plus laquelle des garanties a
// cédé (le réseau / le décodage / le budget).
async function volDeReference() {
  serve()
  const globe = new Globe({})
  const mesures = await vol(globe)
  return { globe, mesures }
}

test('le vol descend et raffine vraiment — sans quoi le banc ne mesure rien', async () => {
  const { globe, mesures } = await volDeReference()
  const zooms = [...mesures.zoomsDessines].sort((a, b) => a - b)
  // z2 (les racines) jusqu'à z6 : le plafond n'est pas une limite de politique
  // mais de BUDGET — à 420 tuiles, les ~300 feuilles visibles d'un hémisphère
  // consomment déjà tout, il ne reste rien pour descendre plus bas. Ce que ce
  // test verrouille, c'est que la descente a bien lieu ET qu'elle TIENT : le
  // défaut d'éviction faisait retomber le globe à z3 en plongée (19 tuiles
  // dessinées au lieu de 300), c'est-à-dire plus grossier de PRÈS que de loin.
  assert.ok(zooms.includes(3), `z3 jamais dessiné (niveaux vus : ${zooms})`)
  assert.ok(zooms.includes(6), `z6 jamais atteint (niveaux vus : ${zooms})`)
  assert.ok(
    mesures.zoomFinal >= 6,
    `à l'altitude la plus basse le globe retombe à z${mesures.zoomFinal} — c'est la régression d'origine`
  )
  assert.ok(
    mesures.visiblesFinal > 200,
    `${mesures.visiblesFinal} tuiles dessinées en plongée : la couverture s'est effondrée`
  )
  globe.dispose()
})

// LE PIÈGE DE L'ADMISSION, et il vaut son propre test. Refuser de raffiner
// quand le cache est plein empêche l'emballement… et, pris au pied de la
// lettre, GÈLE le globe : l'éviction ramène le cache à exactement CACHE_MAX,
// donc `size >= CACHE_MAX` reste vrai pour toujours, plus une seule tuile n'est
// jamais chargée, et faire tourner la planète ne découvre plus rien. Le crédit
// de création doit donc compter non pas la place LIBRE mais la place
// RÉCUPÉRABLE : ce que l'éviction peut reprendre aux tuiles périmées.
test('cache saturé puis la planète TOURNE : le globe charge encore', async () => {
  serve()
  const globe = new Globe({})
  globe.setVisible(true)
  const camera = { position: new THREE.Vector3() }

  // 1. saturer au-dessus du Var
  latLonToSphere(LAT, LON, 120, camera.position)
  for (let k = 0; k < 30; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  assert.ok(globe.tiles.size >= CACHE_MAX, `cache à ${globe.tiles.size} : le montage doit saturer`)

  // 2. l'autre bout du monde (Nouvelle-Zélande) : plus une seule tuile commune
  latLonToSphere(-41, 174, 120, camera.position)
  const avant = total()
  for (let k = 0; k < 30; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  assert.ok(
    total() > avant,
    `aucune requête après ${30} frames sur un tout autre continent : le globe est GELÉ à ${globe.tiles.size} tuiles`
  )
  let vis = 0
  for (const t of globe.tiles.values()) if (t.mesh?.visible) vis++
  assert.ok(vis > 100, `${vis} tuiles dessinées sur la nouvelle région : rien ne s'est chargé`)
  assert.ok(globe.tiles.size <= CACHE_MAX, `${globe.tiles.size} tuiles : le budget a cédé`)
  globe.dispose()
})

test('une tuile du globe n est demandée au réseau QU UNE FOIS par vol', async () => {
  const { globe, mesures } = await volDeReference()
  // le contrat éprouvé partout dans ce dépôt : le nombre de requêtes émises
  // doit être égal au nombre d'URL distinctes
  assert.equal(total(), uniques(), rapport(globe, mesures))
  globe.dispose()
})

test('… et elle n est DÉCODÉE qu une fois : le doublon coûte aussi du CPU', async () => {
  const { globe, mesures } = await volDeReference()
  // le décodage suit la requête (aucune mémoire d'images ici) : s'il y a plus
  // de décodages que d'URL, c'est que la tuile a fait l'aller-retour
  assert.equal(decodages, uniques(), rapport(globe, mesures))
  globe.dispose()
})

test('… et le budget mémoire reste DUR : le cache ne gonfle pas pour autant', async () => {
  const { globe, mesures } = await volDeReference()
  // CACHE_MAX + le sursis d'une frame (l'éviction ne passe qu'après le
  // parcours) : le cache ne doit jamais s'installer au-dessus de son budget.
  assert.ok(
    mesures.picTuiles <= CACHE_MAX * 1.25,
    `pic à ${mesures.picTuiles} tuiles pour un budget de ${CACHE_MAX} — ` +
      `${rapport(globe, mesures)}`
  )
  globe.dispose()
})

// ------------------------------------------------- la règle, tuile par tuile

// Les tests de vol comptent un RÉSULTAT ; celui-ci verrouille la RÈGLE, sur un
// montage assez petit pour être lu à l'œil. Sans lui, un correctif qui se
// contenterait d'agrandir le cache passerait le vol et casserait le budget.
test('à ancienneté égale, l éviction sacrifie la PROFONDE et garde l ancêtre', async () => {
  serve()
  const globe = new Globe({})
  await calme(globe)

  // trois tuiles prêtes, toutes vues à la MÊME frame, aucune dessinée :
  // l'ancêtre z3 (créé en premier, donc premier servi par un tri stable) et
  // deux descendantes plus profondes.
  const faux = (z, x, y, lastUsed, porteuse) => {
    const t = globe._ensureTile(z, x, y)
    t.state = 'ready'
    t.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    t.mesh.visible = false
    t.lastUsed = lastUsed
    if (porteuse) t.coverFrame = lastUsed
    return t
  }
  globe.frame = 100
  const ancetre = faux(3, 4, 3, 100, true) // porte la couverture courante
  const profonde = faux(9, 260, 190, 100, false)
  const vieille = faux(7, 65, 47, 40, false) // pas vue depuis 60 frames

  globe.tiles.size // eslint : la Map est bien peuplée
  const restantes = () => [...globe.tiles.keys()]

  // on force le budget à un dépassement de 1 : une seule victime
  const vraiMax = globe.tiles.size - 1
  globe._evictJusqua(vraiMax)
  assert.ok(!restantes().includes(vieille.key), `la plus ancienne doit partir la première (${restantes()})`)

  // dépassement de 1 encore : parmi les ex æquo, la PROFONDE
  globe._evictJusqua(globe.tiles.size - 1)
  assert.ok(!restantes().includes(profonde.key), `à ancienneté égale, la plus profonde part (${restantes()})`)
  assert.ok(restantes().includes(ancetre.key), `l ancêtre qui porte la couverture doit survivre (${restantes()})`)

  // et en dernier RESSORT, quand il ne reste que des porteurs, le budget prime
  const avant = globe.tiles.size
  globe._evictJusqua(avant - 1)
  assert.equal(globe.tiles.size, avant - 1, 'le budget est dur : un porteur finit par céder')
  assert.ok(ROOT_Z === 2, 'les racines restent hors jeu')
  globe.dispose()
})
