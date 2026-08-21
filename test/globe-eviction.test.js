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

// une dalle RGBA PAR TAILLE DE TUILE, partagée : le décodage lit toujours les
// mêmes octets, ce qu'on mesure ici c'est COMBIEN DE FOIS il les relit.
// ⚠️ DEUX TAILLES DEPUIS LA TÂCHE 4 ALPHA — 256 px chez AWS, 512 px chez
// Mapterhorn — et `fetchTile` lit `getImageData(0, 0, px, px)`. Rendre une dalle
// 256 à un canevas 512 donnerait des hauteurs NaN sur les trois quarts de la
// tuile, EN SILENCE.
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
const DALLE = dalleDe(256)

let decodages = 0

class FakeCtx {
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage() {}
  getImageData(x, y, w) {
    // ⚠️ LE CRITÈRE EST « CARRÉ », PLUS « 256 ». Il distinguait la tuile
    // (getImageData 256×256) de la rampe hypsométrique (dégradé 512×1) par la
    // largeur ; une tuile Mapterhorn fait 512 de large elle aussi, et le compte
    // des décodages serait retombé à zéro sans qu'aucune assertion ne rougisse.
    if (w === arguments[3]) decodages++ // une tuile dépaquetée = un décodage payé
    return { data: dalleDe(w) }
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
  // ⚠️ ET LA SOURCE AUSSI (Tâche 4 alpha) : `regionZooms` et le drapeau de repli
  // sont de la mémoire de MODULE, pas d'instance.
  _resetDemSource()
  globalThis.fetch = async (url) => {
    appels.set(url, (appels.get(url) || 0) + 1)
    // un aller-retour réseau n'est jamais synchrone
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
const { _resetDemSource } = await import('../src/dem-source.js')

// les constantes du module, redites ici pour que le test échoue si elles bougent
// ⚠️ 420 → 600 (plan « globe continu », Tâche 4 sexies, Étape 2) : l'ensemble de
// travail du globe corrigé SATURE À 532 TUILES, mesuré au balayage, donc 420
// laissait 28 raffinements refusés par image aux altitudes de socle et 824
// n'achetait rien de plus que 600. Ce n'est PAS un desserrage de confort : sans
// l'Étape 1 (canevas et hauteurs relâchés) la hausse aurait coûté 88 Mo.
const CACHE_MAX = 600
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

// ─────────────────────────────────────────── LA CAMÉRA DU HARNAIS (Étape 1 bis)
//
// ⚠️ CE HARNAIS N'AVAIT PAS DE CAMÉRA — il portait `{ position: Vector3 }`, sans
// orientation ni `projectionMatrix`. Un globe qui trie par le champ de vision
// n'a alors RIEN à tester, et le tri passerait inaperçu : la suite resterait
// verte en mesurant l'ancien parcours. Les trois valeurs viennent du dépôt :
//   · fov 30°                       → src/main.js (params.fov)
//   · far 1400                      → src/modes.js (`this.camera.far = 1400`)
//   · near = clamp(orbAlt×0,2 ; 0,01 ; 0,5) → src/loi-altitude.js (`planProche`)
// ⚠️ Le `clamp` FAIT PARTIE de la formule : sans lui le plan proche part à zéro
// en orbite haute et la matrice de projection devient inutilisable.
const FOV = 30
const FAR = 1400
const planProche = (orbAlt) => Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)

function nouvelleCamera() {
  return new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, FAR)
}

// `rayon` en unités de scène depuis le CENTRE de la planète (R_GLOBE = 100).
function poseCamera(camera, lat, lon, rayon) {
  latLonToSphere(lat, lon, rayon, camera.position)
  camera.near = planProche(rayon - R_GLOBE)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

// l'état d'une image : ce que l'Étape 1 du plan demande de relever
function etat(globe) {
  let zmax = 0
  let dessinees = 0
  for (const t of globe.tiles.values()) {
    if (!t.mesh?.visible) continue
    dessinees++
    if (t.z > zmax) zmax = t.z
  }
  return { zmax, dessinees, cache: globe.tiles.size, visites: globe._visites }
}

// vide la file du globe : tant qu'il reste des requêtes en vol ou en attente,
// on rend la main à la boucle d'événements (MAX_CONCURRENT = 6, il faut donc
// plusieurs tours pour drainer un palier)
async function calme(globe, max = 4000) {
  // ⚠️ UNE SONDE DE COUVERTURE EN VOL EST UN TRAVAIL EN COURS, ET L'OUBLIER
  // GELAIT LE GLOBE À z11 (plan « globe continu », Tâche 4 alpha). Une tuile qui
  // attend sa sonde n'est NI en vol NI dans la file : elle est restée `empty`,
  // exprès — c'est la contre-pression décrite dans `_request`. Sans `_sondes` ici,
  // la boucle ne rendait la main qu'aux MICRO-tâches, les `setTimeout` des sondes
  // n'obtenaient jamais leur tour, et le globe mesuré était un globe figé au
  // milieu de son premier sondage.
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

async function vol(globe, { paliers = 40, tours = 8 } = {}) {
  globe.setVisible(true)
  const camera = nouvelleCamera()
  const zoomsDessines = new Set()
  let picTuiles = 0
  let frames = 0

  for (let p = 0; p < paliers; p++) {
    const f = paliers === 1 ? 0 : p / (paliers - 1)
    const r = R_HAUT * (R_BAS / R_HAUT) ** f // descente géométrique
    poseCamera(camera, LAT, LON, r)
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
  // ⚠️ CE TEST DÉCRIVAIT LE DÉFAUT COMME UN CONTRAT — déverrouillé par la
  // Tâche 4 du plan « globe continu ». Il exigeait `zooms.includes(6)`,
  // `zoomFinal >= 6` et `visiblesFinal > 200`, en expliquant que z6 était une
  // limite de BUDGET : ~300 feuilles d'hémisphère à 420 tuiles de cache. C'est
  // exact — et c'est précisément l'emprise que le tri spatial supprime. La
  // seconde assertion faisait échouer le BON correctif, qui descend beaucoup
  // plus bas en dessinant beaucoup moins de tuiles.
  //
  // Ce qui reste verrouillé, et qui est le vrai contenu de ce test : la
  // descente a bien lieu ET elle TIENT. Le défaut d'éviction faisait retomber
  // le globe à z3 en plongée (19 tuiles dessinées), c'est-à-dire plus grossier
  // de PRÈS que de loin. Les bornes sont donc devenues des PLANCHERS larges,
  // pas des égalités déguisées.
  assert.ok(zooms.includes(3), `z3 jamais dessiné (niveaux vus : ${zooms})`)
  assert.ok(zooms.includes(4), `z4 jamais atteint (niveaux vus : ${zooms})`)
  assert.ok(
    mesures.zoomFinal > 3,
    `à l'altitude la plus basse le globe retombe à z${mesures.zoomFinal} — c'est la régression d'origine`
  )
  assert.ok(
    mesures.visiblesFinal > 12,
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
  const camera = nouvelleCamera()

  // 1. saturer au-dessus du Var
  poseCamera(camera, LAT, LON, 120)
  for (let k = 0; k < 30; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  assert.ok(globe.tiles.size >= CACHE_MAX, `cache à ${globe.tiles.size} : le montage doit saturer`)

  // 2. l'autre bout du monde (Nouvelle-Zélande) : plus une seule tuile commune
  poseCamera(camera, -41, 174, 120)
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

// ══════════ LE ZOOM SUIT-IL L'ALTITUDE ? (plan « globe continu », Tâche 4) ═══
//
// ⚠️ C'EST LE SYMPTÔME, ET IL NE DÉPEND D'AUCUN BANC : le globe est aussi
// grossier à 2 km qu'à 1 600 km, sur un facteur 800. Mesuré avant correction,
// protocole ci-dessous, six altitudes × quatre latitudes : `zmax` vaut z6
// partout (z5 à 60° N), 303-307 tuiles dessinées, cache 420, crédit 0,
// 0,0 requête par image caméra immobile. UNE seule valeur de zoom.
//
// ⚠️ LE ZOOM ATTEINT EST UNE GRANDEUR À HYSTÉRÉSIS — quatre bancs ont rendu z5,
// z6, z7 et z9 et aucun n'est faux. Le protocole DOIT donc être dit, et c'est
// celui-ci :
//
//   PROTOCOLE A — « GLOBE NEUF À CHAQUE STATION ».
//   · un `new Globe({ globeContinu: true })` par altitude, mémoire de tuiles
//     vidée (`serve()`), aucune histoire de cache héritée d'une station voisine ;
//   · caméra posée à la station, puis 25 tours `update` + attente que la file se
//     vide ; les CINQ PREMIÈRES images sont JETÉES (un globe neuf met quatre
//     images à se stabiliser — sans cette précaution « 20 images stables » est
//     impossible à obtenir) ;
//   · les VINGT suivantes sont relevées, et la stabilité y est EXIGÉE.
//
// La lecture qui mord n'est pas « les niveaux dessinés sont nombreux » (vrai par
// construction : une descente en dessine cinq), c'est : **`zmax`, relevé sur ces
// 20 images stables, prend au moins TROIS valeurs différentes entre les six
// altitudes nommées.**

const ALTITUDES_NOMMEES = [
  ['1600 km', 1_600_000],
  ['800 km', 800_000],
  ['200 km', 200_000],
  ['60 km', 60_000],
  ['8 km', 8_000],
  ['2 km', 2_000],
]
const LAT_STATION = 45
const M_PAR_UNITE = 63_710 // EARTH_RADIUS_M / R_GLOBE — src/geo.js
// ⚠️ LE PLAN DISAIT « JETEZ LES CINQ PREMIÈRES », ET CINQ NE SUFFIT PLUS — le
// chiffre datait du globe GELÉ, qui atteignait son plafond z6 en quatre images.
// La règle sans-trou ne descend que d'UN NIVEAU PAR IMAGE (une tuile ne se
// refend qu'une fois ses quatre enfants prêts), donc un globe neuf met
// désormais une image par niveau : mesuré, la convergence tombe à l'image 8 à
// 200 km et à l'image 9 à 8 km, puis l'état ne bouge plus d'un seul tuile
// pendant les vingt suivantes. Douze, c'est ce chiffre plus trois images de
// marge. ⚠️ Ce n'est PAS un pansement sur une oscillation : la stabilité est
// exigée juste après, et elle est exacte.
//
// ⚠️ **ET DOUZE NE SUFFIT PLUS NON PLUS — la Tâche 4 quater a rendu le globe
// QUATRE NIVEAUX PLUS PROFOND** (plancher de `dist` en mètres, `MAX_Z = 15`).
// La règle « un niveau par image » n'a pas changé, mais il y a quatre niveaux
// de plus à descendre : relevé image par image sur ce dépôt, la convergence
// tombe à l'image 12 à 8 km et à l'image 13 à 2 km, puis l'état ne bouge plus
// d'une seule tuile. Dix-sept, c'est ce chiffre plus quatre images de marge.
// ⚠️ Le symptôme d'un JETEES trop court n'est PAS un test qui traîne : c'est
// une fausse OSCILLATION (« 2 km : zmax oscille (14, 15) ») et de fausses
// requêtes au repos — exactement la signature du défaut que les deux
// assertions suivantes cherchent. Le banc mentirait dans le sens du soupçon.
const JETEES = 17
const RELEVEES = 20

async function station(altM) {
  serve()
  const globe = new Globe({ globeContinu: true })
  globe.setVisible(true)
  const camera = poseCamera(nouvelleCamera(), LAT_STATION, LON, R_GLOBE + altM / M_PAR_UNITE)
  for (let i = 0; i < JETEES; i++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  const serie = []
  const avant = total()
  for (let i = 0; i < RELEVEES; i++) {
    globe.update(camera, 0.016)
    await calme(globe)
    serie.push(etat(globe))
  }
  const requetes = total() - avant
  globe.dispose()
  return { serie, requetes }
}

// le balayage coûte une poignée de secondes : il est fait UNE fois et partagé
// par les trois assertions qui suivent (une par test, comme le reste du fichier)
let _balayage = null
function balayage() {
  _balayage ??= (async () => {
    const out = []
    for (const [nom, altM] of ALTITUDES_NOMMEES) out.push({ nom, ...(await station(altM)) })
    return out
  })()
  return _balayage
}

const ligne = (r) =>
  `${r.nom} : z${r.serie[r.serie.length - 1].zmax}, ${r.serie[r.serie.length - 1].dessinees} dessinées, ` +
  `cache ${r.serie[r.serie.length - 1].cache}, ${r.requetes} requêtes sur ${RELEVEES} images`

test('le zoom effectif SUIT l altitude : au moins trois valeurs de zmax sur les six altitudes nommées', async () => {
  const stations = await balayage()
  const zmax = stations.map((r) => r.serie[r.serie.length - 1].zmax)
  const distincts = new Set(zmax)
  assert.ok(
    distincts.size >= 3,
    `zmax ne prend que ${distincts.size} valeur(s) sur les six altitudes nommées ` +
      `— le globe est aussi grossier à 2 km qu'à 1 600 km · ${stations.map(ligne).join(' · ')}`
  )
})

test('… et il est STABLE : zmax et tuiles dessinées constants sur 20 images', async () => {
  const stations = await balayage()
  for (const r of stations) {
    const z = r.serie.map((e) => e.zmax)
    const d = r.serie.map((e) => e.dessinees)
    assert.ok(
      z.every((v) => v === z[0]),
      `${r.nom} : zmax oscille sur 20 images (${[...new Set(z)].sort().join(', ')}) — ` +
        `c'est le cycle limite que tout plancher de crédit constant installe`
    )
    assert.ok(
      d.every((v) => v === d[0]),
      `${r.nom} : les tuiles dessinées oscillent sur 20 images (min ${Math.min(...d)}, max ${Math.max(...d)})`
    )
  }
})

test('… et la caméra IMMOBILE ne demande plus rien au réseau', async () => {
  const stations = await balayage()
  for (const r of stations) {
    assert.equal(r.requetes, 0, `${r.nom} : ${r.requetes} requêtes caméra strictement immobile — ${ligne(r)}`)
  }
})

// ══════════ LA COUVERTURE RESTE SANS TROU (Étapes 3 et 4) ═══════════════════
//
// ⚠️ C'EST LE SEUL CRITÈRE QUI JUGE VRAIMENT LE TRI SPATIAL, et ni le zoom ni le
// compte de tuiles ne le remplacent. Les deux tris se paient au même endroit :
// l'horizon transcrit nu ÉCRÊTE AU LIMBE, et un frustum posé sur la sphère nue
// écrête les crêtes au bord de l'écran — dans les deux cas le globe gagne des
// niveaux de zoom en ouvrant des trous, et toutes les autres assertions de ce
// fichier passent au vert pendant ce temps.
//
// On tire donc de VRAIS RAYONS : centre de l'écran et quatre coins à 90 % de
// l'étendue, contre les seules tuiles allumées. Cinq touches, six altitudes.
const ECRAN = [
  [0, 0],
  [-0.9, -0.9],
  [0.9, -0.9],
  [-0.9, 0.9],
  [0.9, 0.9],
]

// ⚠️ ET LES DEUX ALTITUDES BASSES SONT HORS DE PORTÉE DE CE TEST — pas par
// commodité, par géométrie, et le chiffre se dérive du harnais : la dalle
// bouchon vaut 812 m PARTOUT, l'exagération du globe vaut 18, donc la nappe
// dessinée est un plateau à `812 × 18 = 14 616 m` d'altitude. Une caméra à
// 8 km ou à 2 km est DESSOUS : aucun rayon ne peut toucher une surface qui
// est au-dessus de lui. C'est une propriété du globe de production, pas du
// bouchon — c'est exactement ce que la décision 14 du plan (« l'exagération
// devient une courbe continue de l'altitude ») a pour objet de corriger, et
// elle ne relève pas de cette tâche-ci.
const ALTITUDES_AU_DESSUS_DU_RELIEF = ALTITUDES_NOMMEES.filter(([, m]) => m > 812 * 18)

test('… et la couverture reste SANS TROU : les cinq rayons d écran touchent tous une tuile allumée', async () => {
  assert.equal(ALTITUDES_AU_DESSUS_DU_RELIEF.length, 4, 'quatre des six altitudes nommées sont au-dessus du plateau bouchon')
  for (const [nom, altM] of ALTITUDES_AU_DESSUS_DU_RELIEF) {
    serve()
    const globe = new Globe({ globeContinu: true })
    globe.setVisible(true)
    const camera = poseCamera(nouvelleCamera(), LAT_STATION, LON, R_GLOBE + altM / M_PAR_UNITE)
    for (let i = 0; i < JETEES + 3; i++) {
      globe.update(camera, 0.016)
      await calme(globe)
    }
    globe.group.updateMatrixWorld(true)
    const allumees = [...globe.tiles.values()].filter((t) => t.mesh?.visible).map((t) => t.mesh)
    const rc = new THREE.Raycaster()
    for (const [x, y] of ECRAN) {
      rc.setFromCamera(new THREE.Vector2(x, y), camera)
      const touches = rc.intersectObjects(allumees, false)
      assert.ok(
        touches.length > 0,
        `${nom} : le rayon d'écran (${x}, ${y}) ne touche AUCUNE tuile allumée — ` +
          `${allumees.length} dessinées, c'est un TROU dans la couverture`
      )
    }
    globe.dispose()
  }
})

// ══════════ LES TUILES BLOQUÉES (Étape 6) ═══════════════════════════════════
//
// Une tuile en `error`, ou une `loading` dont la requête n'est jamais revenue,
// ne dessinera JAMAIS et n'était candidate à AUCUN des deux rangs d'éviction :
// elle retenait une place du budget pour de bon. C'est le même point fixe que
// le crédit nul, par une autre porte.

test('une tuile BLOQUÉE part avant tout le reste — et le classement des deux autres rangs ne bouge pas', async () => {
  serve()
  const globe = new Globe({ globeContinu: true })
  await calme(globe)
  globe.frame = 100
  const pret = (z, x, y, lastUsed) => {
    const t = globe._ensureTile(z, x, y)
    t.state = 'ready'
    t.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial())
    t.mesh.visible = false
    t.lastUsed = lastUsed
    return t
  }
  // la plus ANCIENNE de toutes est prête : sans le rang 0 c'est elle qui part
  const vieille = pret(7, 65, 47, 10)
  const bloquee = globe._ensureTile(8, 130, 94)
  bloquee.state = 'error'
  bloquee.lastUsed = 99 // toute récente, et pourtant elle passe devant

  globe._evictJusqua(globe.tiles.size - 1)
  const restantes = () => [...globe.tiles.keys()]
  assert.ok(!restantes().includes(bloquee.key), `la tuile bloquée doit partir la première (${restantes()})`)
  assert.ok(restantes().includes(vieille.key), `… et pas à la place de la plus ancienne (${restantes()})`)
  globe.dispose()
})

test('… et une tuile ÉVINCÉE ne revient pas d elle-même sur le réseau', async () => {
  serve()
  const globe = new Globe({ globeContinu: true })
  await calme(globe)
  const t = globe._ensureTile(8, 130, 94)
  t.state = 'error'
  globe.frame = 1000
  globe._echoue.set(t.key, globe.frame) // ce que fait `_pump` quand le réessai est épuisé
  globe.tiles.delete(t.key) // … et ce que fait le rang 0

  const avant = total()
  // le parcours la recrée : elle DOIT renaître bloquée, et rester muette
  const recree = globe._ensureTile(8, 130, 94)
  assert.equal(recree.state, 'error', 'une clé en quarantaine renaît bloquée, jamais `empty`')
  globe._request(recree, 1)
  await calme(globe)
  assert.equal(total(), avant, 'une tuile en quarantaine ne repart pas sur le réseau à l image suivante')
  globe.dispose()
})

test('… mais la quarantaine EXPIRE : une coupure réseau ne perd pas la tuile pour la session', async () => {
  serve()
  const globe = new Globe({ globeContinu: true })
  await calme(globe)
  globe.frame = 1000
  globe._echoue.set('8/130/94', globe.frame)
  globe.tiles.delete('8/130/94')

  // dix secondes à 60 Hz plus tard, le réseau est peut-être revenu
  globe.frame = 1000 + 600
  const recree = globe._ensureTile(8, 130, 94)
  assert.equal(recree.state, 'empty', 'la quarantaine doit expirer, sinon un incident de trois secondes coûte la session')
  const avant = total()
  globe._request(recree, 1)
  await calme(globe)
  assert.equal(total(), avant + 1, 'la tuile guérie doit pouvoir repartir sur le réseau')
  globe.dispose()
})

test('… et une tuile évincée EN VOL ne pose pas de maillage orphelin', async () => {
  serve()
  let debloque = null
  const enVol = new Promise((r) => (debloque = r))
  globalThis.fetch = async (url) => {
    appels.set(url, (appels.get(url) || 0) + 1)
    await enVol
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
  const globe = new Globe({ globeContinu: true })
  const t = globe._ensureTile(8, 130, 94)
  globe._request(t, 1)
  assert.equal(t.state, 'loading', 'le montage doit laisser la tuile EN VOL')

  const enfants = globe.group.children.length
  globe.tiles.delete(t.key) // le rang 0 l'emporte pendant que la requête vole
  debloque()
  for (let i = 0; i < 50 && globe.inFlight; i++) await new Promise((r) => setTimeout(r, 0))

  assert.equal(t.mesh, null, 'le retour ne doit RIEN construire pour une tuile sortie du cache')
  assert.equal(
    globe.group.children.length,
    enfants,
    'un maillage orphelin a été ajouté au groupe : plus rien ne le retrouvera, ni `_evict` ni `dispose`'
  )
  globe.dispose()
})

// ══════════ LES DEUX MARGES, TESTÉES POUR ELLES-MÊMES ═══════════════════════
//
// ⚠️ LE VOL NE LES VOIT PAS, ET C'EST MESURÉ : les deux marges survivent à leur
// mutation (marge de relief mise à 0, `theta` mis à 0) sans qu'aucune des
// treize assertions ci-dessus ne rougisse. La raison est dans le bouchon — la
// dalle vaut 812 m partout, donc il n'y a aucun sommet à faire dépasser — et
// dans le cadrage : aux six altitudes nommées la planète remplit l'écran, donc
// le limbe n'y est jamais. Ces deux marges se testent donc en GÉOMÉTRIE PURE,
// où elles sont exactes et où leur mutation tue le test sur-le-champ.

const EXAGERATION = 18 // src/globe.js — `params.globeExaggeration ?? 18`
const ALT_MAX_M = 9000 // src/globe.js
const M_PAR_UNITE_EXACT = 6_371_000 / 100 // EARTH_RADIUS_M / R_GLOBE

test('la MARGE DE CORDE de l horizon : une tuile à cheval sur l horizon n est pas écrêtée', async () => {
  serve()
  const globe = new Globe({ globeContinu: true })
  const camera = poseCamera(nouvelleCamera(), 0, 0, R_GLOBE + 200_000 / M_PAR_UNITE_EXACT)
  globe.setVisible(true)
  globe.update(camera, 0.016)
  const camDir = camera.position.clone().normalize()
  assert.ok(globe._angleHorizon > 0, 'l angle d horizon doit être posé par update()')

  // une tuile SYNTHÉTIQUE, placée à un angle choisi de la direction caméra.
  const theta = 0.02 // rad — l ordre de grandeur d une tuile z6
  const aLAngle = (angle) => {
    const axe = new THREE.Vector3(0, 1, 0).cross(camDir).normalize()
    const centre = camDir.clone().applyAxisAngle(axe, angle).multiplyScalar(R_GLOBE)
    return { z: 6, center: centre, theta, rayon: 2 * R_GLOBE * Math.sin(theta / 2) }
  }
  // centre DERRIÈRE l horizon d un demi-demi-angle : la moitié de la tuile est
  // encore devant, elle doit être parcourue
  assert.equal(
    globe._horsHorizon(aLAngle(globe._angleHorizon + theta * 0.5), camDir),
    false,
    'une tuile à cheval sur l horizon est écrêtée : c est le trou au limbe'
  )
  // entièrement derrière : elle doit tomber
  assert.equal(
    globe._horsHorizon(aLAngle(globe._angleHorizon + theta * 1.5), camDir),
    true,
    'une tuile entièrement derrière l horizon doit être écartée'
  )
  globe.dispose()
})

test('la MARGE DE RELIEF du volume englobant : la sphère contient le sommet exagéré ET la jupe', async () => {
  serve()
  const globe = new Globe({ globeContinu: true })
  const camera = poseCamera(nouvelleCamera(), 45, 6.25, R_GLOBE + 60_000 / M_PAR_UNITE_EXACT)
  globe.setVisible(true)
  globe.update(camera, 0.016)

  // le déplacement radial d un sommet de 9 000 m à l exagération 18 :
  // 9 000 × (100 / 6 371 000) × 18 = 2,54 unités de scène, soit 162 km
  const monte = (ALT_MAX_M / M_PAR_UNITE_EXACT) * EXAGERATION
  assert.ok(monte > 2.5, `le relief exagéré sort de la sphère de ${monte.toFixed(2)} unités`)

  for (const z of [3, 6, 9, 11]) {
    const t = globe._ensureTile(z, 2 ** (z - 1), 2 ** (z - 1))
    const sphere = globe._sphereDe(t).clone()
    // le COIN de la tuile, hissé au sommet exagéré : c est le point le plus
    // éloigné que le maillage peut atteindre
    const coin = t.center.clone().normalize().multiplyScalar(R_GLOBE)
    coin.add(t.center.clone().normalize().multiplyScalar(monte))
    // (le coin le plus défavorable : à `t.rayon` du centre ET hissé)
    const lateral = new THREE.Vector3(0, 1, 0).cross(t.center).normalize().multiplyScalar(t.rayon)
    const pire = coin.clone().add(lateral)
    assert.ok(
      sphere.containsPoint(pire),
      `z${z} : le sommet exagéré sort du volume englobant (|p−c| = ${sphere.center.distanceTo(pire).toFixed(3)} > r = ${sphere.radius.toFixed(3)})`
    )
    // et la JUPE, qui descend jusqu à 0,9 unité SOUS la sphère nue
    const dessous = t.center.clone().normalize().multiplyScalar(R_GLOBE - 0.9).add(lateral)
    assert.ok(
      sphere.containsPoint(dessous),
      `z${z} : la jupe sort du volume englobant (|p−c| = ${sphere.center.distanceTo(dessous).toFixed(3)} > r = ${sphere.radius.toFixed(3)})`
    )
  }
  globe.dispose()
})

// ═══════════════ LA MÉMOIRE QUE LE CACHE NE PAIE PLUS (Tâche 4 sexies) ═══════
//
// Le globe retenait ~210 Mo sur 327 au cache plein POUR RIEN, en deux parts
// égales et de natures différentes :
//   · `t.heights`, un `Float32Array(256 × 256)` = 256 Kio par tuile, consommé
//     une seule fois par `_buildMesh` puis gardé au cas où — le seul autre
//     lecteur du dépôt, `setExaggeration`, n'avait AUCUN appelant ;
//   · le canevas de décodage, gardé vivant par `CanvasTexture.image` bien après
//     que le GPU en ait pris copie.
//
// ⚠️ ET LES DEUX NE SE TESTENT PAS DE LA MÊME FAÇON. Le premier est du
// JavaScript pur et se vérifie ici. Le second dépend de
// `WebGLTextures.uploadTexture`, qui n'existe pas sous node : ce qui se teste
// ici, c'est le CONTRAT (le rappel `onUpdate` est posé, et il relâche) ; que
// three l'appelle vraiment, et que le globe survive à une perte de contexte, a
// été prouvé au navigateur.

test('les hauteurs ne survivent pas au maillage : le tampon de construction est rendu', async () => {
  serve()
  const globe = new Globe({})
  const mesures = await vol(globe, { paliers: 6, tours: 4 })
  let pretes = 0
  let retenues = 0
  for (const t of globe.tiles.values()) {
    if (t.state !== 'ready') continue
    pretes++
    if (t.heights) retenues++
  }
  assert.ok(pretes > 100, `${pretes} tuiles prêtes : le vol n'a rien construit, le test ne mesure rien`)
  assert.equal(
    retenues,
    0,
    `${retenues} tuiles sur ${pretes} retiennent leurs hauteurs — ${((retenues * 256 * 256 * 4) / 1048576).toFixed(1)} Mo pour personne`
  )
  // …et le maillage, lui, EXISTE : on n'a pas gagné la mémoire en ne bâtissant rien
  assert.ok(mesures.visiblesFinal > 12, `${mesures.visiblesFinal} tuiles dessinées : rien n'a été bâti`)
  globe.dispose()
})

test('le canevas de tuile est relâché au téléversement, et pas avant', async () => {
  serve()
  const globe = new Globe({})
  await vol(globe, { paliers: 3, tours: 4 })
  const t = [...globe.tiles.values()].find((x) => x.state === 'ready' && x.texture)
  assert.ok(t, 'aucune tuile prête : le test ne mesure rien')
  // AVANT le téléversement le canevas est là — sinon three n'aurait rien à
  // envoyer au GPU la première fois, et la tuile serait vide à l'écran.
  assert.ok(t.texture.image, 'le canevas a disparu AVANT le téléversement : la première image serait vide')
  assert.equal(
    typeof t.texture.onUpdate,
    'function',
    'aucun rappel de téléversement : le canevas ne sera jamais rendu'
  )
  // `uploadTexture` appelle `onUpdate` après coup ; sous node on joue son rôle.
  t.texture.onUpdate(t.texture)
  assert.equal(t.texture.image, null, 'le canevas est toujours accroché après le téléversement')
  globe.dispose()
})

test('contexte WebGL rendu : les tuiles repartent sur le réseau, RACINES COMPRISES', async () => {
  serve()
  const globe = new Globe({})
  await vol(globe, { paliers: 6, tours: 4 })
  const avant = total()
  const pretesAvant = [...globe.tiles.values()].filter((t) => t.state === 'ready').length
  assert.ok(pretesAvant > 100, `${pretesAvant} tuiles prêtes avant : le test ne mesure rien`)

  globe.rechargeApresContexte()

  // plus une seule tuile ne prétend être prête : three n'a plus de pixels à
  // réenvoyer, une tuile « prête » serait une tuile VIDE à l'écran
  assert.equal(
    [...globe.tiles.values()].filter((t) => t.state === 'ready').length,
    0,
    'des tuiles se disent encore prêtes alors que leur texture est perdue'
  )
  // ⚠️ ET LES RACINES DOIVENT ÊTRE REDEMANDÉES : `_traverse` ne demande que des
  // ENFANTS. Sans `chargeRacines`, tout resterait bloqué derrière elles, sans
  // erreur ni trace — le globe ne se remplirait simplement jamais.
  assert.ok(
    globe.roots.every((t) => t.state !== 'empty'),
    'les seize racines z2 sont restées `empty` : plus personne ne les demandera'
  )
  await calme(globe)
  assert.ok(total() > avant, 'aucune requête après le retour du contexte : le globe reste vide')

  // …et il se REMPLIT à nouveau
  const camera = nouvelleCamera()
  poseCamera(camera, LAT, LON, 120)
  for (let k = 0; k < 40; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  let vis = 0
  for (const t of globe.tiles.values()) if (t.mesh?.visible) vis++
  assert.ok(vis > 12, `${vis} tuiles dessinées après le retour du contexte : le globe ne s'est pas repeuplé`)
  globe.dispose()
})

test('setExaggeration reste utilisable une fois les hauteurs rendues', async () => {
  serve()
  const globe = new Globe({})
  await vol(globe, { paliers: 4, tours: 4 })
  // il ne doit ni lever (les hauteurs ne sont plus là) ni faire semblant
  globe.setExaggeration(9)
  assert.equal(globe.exaggeration, 9, "l'exagération n'a pas été prise en compte")
  assert.equal(
    [...globe.tiles.values()].filter((t) => t.state === 'ready').length,
    0,
    "des maillages bâtis à l'ancienne exagération survivent"
  )
  const camera = nouvelleCamera()
  poseCamera(camera, LAT, LON, 120)
  for (let k = 0; k < 40; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  let vis = 0
  for (const t of globe.tiles.values()) if (t.mesh?.visible) vis++
  assert.ok(vis > 12, `${vis} tuiles dessinées : le globe ne se rebâtit pas après un changement d'exagération`)
  globe.dispose()
})

// ══════════════ LES NORMALES DE BORD (Tâche 4 sexies, Étape 3) ══════════════
//
// `posAt` mélangeait deux conventions au bord de la tuile : `tileToLatLon` suit
// `u` hors de [0,1] et rend la position du VOISIN, tandis que `sampleHeights`
// l'ÉCRÊTE et rend la hauteur du pixel de bord. La différence centrée portait
// donc un dénivelé lu sur une fenêtre deux fois trop courte.
//
// ⚠️ LE CHIFFRE SE DÉRIVE DU DÉPÔT, il n'a pas besoin d'un banc : `G = gridFor(z)
// = 24` et une tuile de 256 px donnent `x(u+ε) − x(u−ε)` = 21,333 px au centre
// contre 10,167 px au bord, soit **47,7 %**. Mesuré sur ce banc : 48,3 % avant
// le correctif, 96,6 % après. D'où un liseré d'éclairage autour de chaque tuile.
test("sur une pente CONSTANTE, le bord de tuile s'éclaire comme le centre", async () => {
  serve()
  const globe = new Globe({})
  // ⚠️ LA TUILE PASSE PAR `_ensureTile` : `chord`, `center`, `rayon` et `theta`
  // viennent de là, et sans `chord` la jupe part en NaN.
  const t = globe._ensureTile(8, 40, 60)
  t.state = 'ready'
  t.texture = new THREE.Texture()
  // rampe est-ouest parfaitement régulière : toutes les normales de la nappe
  // doivent faire le MÊME angle avec la verticale locale
  t.heights = new Float32Array(256 * 256)
  // ⚠️ `t.size` EST OBLIGATOIRE DEPUIS LA TÂCHE 4 ALPHA. La tuile est montée à
  // la main ici : elle doit déclarer sa taille comme elle déclare déjà son état
  // et sa texture. Sans elle, `sampleHeights` reçoit le `size: 0` que
  // `_ensureTile` pose avant tout chargement, et rend NaN — bruyamment, ce qui
  // est le comportement voulu.
  t.size = 256
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) t.heights[y * 256 + x] = 1000 + x * 40
  }
  globe._buildMesh(t)

  const G = 24 // gridFor(8)
  const nrm = t.mesh.geometry.getAttribute('normal')
  const pos = t.mesh.geometry.getAttribute('position')
  const j = Math.floor(G / 2) // la ligne médiane, loin des bords nord et sud
  const pente = (i) => {
    const k = j * (G + 1) + i
    const p = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).add(t.mesh.position).normalize()
    const n = new THREE.Vector3(nrm.getX(k), nrm.getY(k), nrm.getZ(k))
    return Math.tan(Math.acos(Math.min(Math.max(n.dot(p), -1), 1)))
  }
  const centre = pente(j)
  assert.ok(centre > 1, `pente au centre ${centre.toFixed(3)} : le MNT de test ne penche pas, rien n'est mesuré`)
  for (const [nom, i] of [
    ['ouest', 0],
    ['est', G],
  ]) {
    const part = pente(i) / centre
    assert.ok(
      part > 0.9,
      `bord ${nom} : ${(100 * part).toFixed(1)} % de la pente du centre — l'écrêtage de sampleHeights aplatit le pourtour (47,7 % attendu SANS le correctif)`
    )
  }
  globe.dispose()
})
