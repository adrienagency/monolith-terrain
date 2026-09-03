// LE FLUX QUI NE SE COINCE PAS — Tâche 4 bis du plan « globe continu ».
//
// ══════════ CE QUE CE FICHIER MESURE, ET POURQUOI IL FALLAIT UN BANC NEUF ════
//
// Le défaut n'est pas une panne : c'est une FILE. `globe.js` plafonne bien ses
// requêtes SIMULTANÉES (`MAX_CONCURRENT = 6`), mais `_request` marque une tuile
// `loading` **avant** de l'enfiler, et rien ne bornait `this.queue`. Mesuré au
// navigateur, caméra en mouvement en orbite : **568 tuiles en `loading`**, cache
// collé à 1 700, aucune erreur nulle part.
//
// ⚠️ **LE HARNAIS DU DÉPÔT FAIT PASSER CE TEST SUR DU CODE CASSÉ.**
// `test/globe-reseau.test.js:83-93` résout `fetch` en `setTimeout(0)`, et
// `test/globe-eviction.test.js` appelle `calme(globe)` entre deux images — il
// VIDE la file avant l'image suivante. Le compte de `loading` retombe alors tout
// seul, sans plafond, sans annulation et sans éviction.
//
// ⚠️ **ET UN BOUCHON À RÉSOLUTION 100 % MANUELLE NE VAUT PAS MIEUX — mesuré.**
// Si rien ne se résout tant que le test ne le décide pas, aucune tuile n'atteint
// `ready`, la règle sans-trou ne descend jamais, le zoom reste figé à z2, et
// l'assertion ne mesure rien du tout.
//
// D'où le **MODÈLE DE LATENCE** ci-dessous : une horloge virtuelle, et une
// requête qui se résout au bout de `octets × 8 / (débit / MAX_CONCURRENT)`. La
// file se remplit et se vide comme sur un vrai réseau, sans qu'aucune horloge
// murale n'entre dans la mesure.
//
// ⚠️ **ET LE GESTE EST UN PANORAMIQUE LATÉRAL, PAS UNE DESCENTE.** C'est le plus
// banal de l'application et celui que le vol de référence ne peut pas voir :
// dans une descente lisse, deux images consécutives demandent presque les mêmes
// tuiles.

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ═══════════════════════════════════════════════ 1. L'HORLOGE VIRTUELLE ══════
//
// ⚠️ POSÉE AVANT L'IMPORT DE `globe.js` — il lit `globalThis.performance.now`
// **à l'appel** et non à l'import (voir `maintenant()`), mais le journal réseau
// n'aurait aucun sens si les deux horloges se mélangeaient.
let horloge = 0
globalThis.performance = { now: () => horloge }

// ═══════════════════════════════════════════════ 2. LES BOUCHONS DOM ═════════
//
// Une élévation PAR TUILE, et non une dalle unique : `remplirHauteurs` doit
// pouvoir prouver qu'il lit la BONNE tuile à la BONNE place. La valeur est
// dérivée de la clé, et le test la recalcule.

export const elevationDe = (z, x, y) => 100 * ((x + 3 * y + 7 * z) % 40)

// ══════════ LE MONDE OCÉANIQUE DU BANC — Tâche 6 sexies ═════════════════════
//
// ⚠️ **`elevationDe` NE REND QUE DES VALEURS ≥ 0 : SUR CE MONDE-LÀ, LA FUSION NE
// DOIT RIEN CREUSER.** « La terre ne bouge jamais » est la règle fondatrice de
// `src/bathy.js` depuis la session polders, et le banc doit pouvoir la vérifier
// des deux côtés. Pour éprouver la fusion il faut donc un monde OCÉANIQUE — et
// c'est celui que `dem.js` a mesuré au large de Toulon : « la tuile terrarium
// est à 100 % à zéro exact, 0 % de valeurs négatives ». `banc.mer` bascule le
// bouchon d'altitude sur ce monde-là.
//
// ⚠️ **ET LA PROFONDEUR EST PAR TUILE**, pour la même raison que l'élévation :
// un fond uniforme ne prouverait pas qu'on lit la BONNE tuile bathy à la BONNE
// place. `banc.bathyPlate` la rend uniforme quand — et seulement quand — le test
// compare au MNT et ne veut pas dépendre d'un alignement au demi-pixel.
export const banc = { mer: false, bathyPlate: false, bathy: true, porte: null }

// ⚠️ **UNE PORTE POUR RETENIR LA MER, ET ELLE EST NÉCESSAIRE AU TEST DU
// SIGNAL DE RAFFINEMENT.** Les fichiers de `data/bathy/` sont LOCAUX : dans ce
// banc ils reviennent en un tour de boucle, donc la nappe a déjà atterri quand
// les tuiles d'altitude arrivent. Sans porte, un test du signal lirait deux fois
// l'état d'APRÈS et resterait vert même si le signal ne portait pas la mer.
// **Mesuré : la mutation « ne pas incrémenter `bathyRevision` » y SURVIVAIT.**
export function retenirLaMer () {
  let ouvrir
  banc.porte = new Promise((r) => { ouvrir = r })
  return () => { banc.porte = null; ouvrir() }
}
export const profondeurDe = (z, x, y) => (banc.bathyPlate ? -1200 : -(200 + 100 * ((x + 3 * y + 7 * z) % 20)))

const RE_TERRARIUM = /terrarium\/(\d+)\/(\d+)\/(\d+)\.png$/
const RE_BATHY = /^data\/bathy\/(\d+)\/(\d+)\/(\d+)\.png$/

const dalles = new Map()
function dallePour(url) {
  // ⚠️ LA CLÉ PORTE L'ÉTAT DU BANC : sans lui, une dalle « terre » cuite par un
  // test resterait servie au test « mer » suivant, et les deux mesureraient la
  // même chose sans qu'aucune assertion ne bouge.
  const cle = `${banc.mer ? 'M' : 'T'}${banc.bathyPlate ? 'P' : 'V'}|${url}`
  let d = dalles.get(cle)
  if (d) return d
  const b = RE_BATHY.exec(url)
  const m = RE_TERRARIUM.exec(url) || [0, 2, 0, 0]
  const metres = b
    ? profondeurDe(+b[1], +b[2], +b[3])
    : banc.mer
      // ⚠️ ZÉRO EXACT = ABSENCE DE MESURE, et non de la terre plate (bathy.js)
      ? 0
      : elevationDe(+m[1], +m[2], +m[3])
  const [er, eg, eb] = encodeTerrarium(metres)
  d = new Uint8ClampedArray(256 * 256 * 4)
  for (let i = 0; i < 256 * 256; i++) {
    d[i * 4] = er
    d[i * 4 + 1] = eg
    d[i * 4 + 2] = eb
    d[i * 4 + 3] = 255
  }
  dalles.set(cle, d)
  return d
}

class FakeCtx {
  createLinearGradient() {
    return { addColorStop() {} }
  }
  fillRect() {}
  drawImage(img) {
    this._url = img?.url ?? null
  }
  // ⚠️ **B3 — LE GLOBE RÉ-ENCODE DÉSORMAIS SA TUILE APRÈS FUSION**
  // (`fetchTile` → `textureDeHauteurs`, src/globe.js) : il lui faut un
  // `createImageData` et un `putImageData`. Sans eux le double levait un
  // TypeError, `fetchTile` rejetait, et AUCUNE tuile n'atteignait `ready` —
  // d'où quatre tests rouges qui accusaient la file alors que c'était le
  // canevas bouchon qui manquait. Le double suit le contrat du canevas ; ces
  // deux méthodes n'assouplissent aucune assertion, elles rendent exécutable un
  // chemin réel qui ne l'était pas.
  createImageData(w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }
  }
  putImageData(im) {
    this._pose = im
  }
  getImageData() {
    if (this._pose) return this._pose
    return { data: this._url ? dallePour(this._url) : dallePour('terrarium/0/0/0.png') }
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

// ═══════════════════════════════════════════════ 3. LE MODÈLE DE LATENCE ═════
//
// `octets` : 87,6 Kio, c'est-à-dire les 1 401 Ko mesurés chez AWS pour les seize
// tuiles racines (voir le constructeur de `globe.js`).
// `DEBIT_MBS` : volontairement GÉNÉREUX ici (le banc `.banc/pano-latence.mjs`
// couvre 12, 3 et 0,5 Mb/s). ⚠️ **Un test doit pouvoir constater la
// RÉCUPÉRATION**, et cinq secondes à 12 Mb/s ne suffisent physiquement pas à
// reconstruire mille tuiles — ce serait mesurer la bande passante, pas la file.

// ⚠️ LE DÉBIT PAR DÉFAUT EST **RAPIDE**, ET C'EST DÉLIBÉRÉ. Les huit premiers
// tests éprouvent une LOGIQUE (couverture, états, comptes) : les faire attendre
// un réseau réaliste ne mesurerait que l'attente. Le panoramique, lui, pose son
// débit lui-même — et il en pose deux, voir sa section.
const DEBIT_RAPIDE = 1200

const MAX_CONCURRENT = 6
const OCTETS_TUILE = Math.round((1401 * 1024) / 16)
const MS_PAR_IMAGE = 1000 / 60
let DEBIT_MBS = DEBIT_RAPIDE

const attentes = []
export const compteur = { requetes: 0, parUrl: new Map() }

// ⚠️ **L'INDEX BATHY DU BANC DONNE z13 SUR LA ZONE D'ESSAI, ET C'EST DÉLIBÉRÉ.**
// Sous le plafond `base.zmax = 8` de la production, les neuf tuiles z13 d'un
// socle tombent dans UNE SEULE tuile bathy z8 : le fond y serait uniforme et le
// banc ne pourrait plus prouver qu'il lit la bonne tuile à la bonne place.
// La zone couvre l'emprise d'essai, le reste du monde reste à z8 — donc le
// chemin de SURZOOM est exercé partout ailleurs, y compris par `loadDem`.
export const INDEX_BATHY = {
  version: 1,
  base: { source: 'gebco', zmax: 8 },
  zmin: 4,
  zones: [{ id: 'banc', source: 'banc', zmax: 13, bbox: [4, 40, 8, 44] }],
}

const OCTETS_BATHY = 4096

globalThis.fetch = async (url) => {
  compteur.requetes++
  compteur.parUrl.set(url, (compteur.parUrl.get(url) || 0) + 1)
  // ⚠️ **LA BATHYMÉTRIE NE PASSE PAS PAR LE MODÈLE DE LATENCE, ET C'EST LE FAIT
  // QUI REND LA TÂCHE 6 sexies POSSIBLE** : `data/bathy/` est servi PAR LE SITE
  // (21 557 fichiers comptés par `verifie:dist`), pas par un bucket lointain.
  // Le modèle de latence, lui, décrit `s3.amazonaws.com`. Les confondre ferait
  // payer à la mer une attente qu'elle n'a pas.
  if (url.startsWith('data/bathy/')) {
    if (url.endsWith('index.json')) return { ok: true, status: 200, json: async () => INDEX_BATHY }
    if (!banc.bathy) return { ok: false, status: 404 }
    if (banc.porte) await banc.porte
    return { ok: true, status: 200, blob: async () => ({ size: OCTETS_BATHY, url }) }
  }
  const duree = ((OCTETS_TUILE * 8) / ((DEBIT_MBS * 1e6) / MAX_CONCURRENT)) * 1000
  await new Promise((r) => attentes.push({ du: horloge + duree, r }))
  return { ok: true, status: 200, blob: async () => ({ size: OCTETS_TUILE, url }) }
}

// ⚠️ `setImmediate` ET NON `setTimeout(0)` : node borne un `setTimeout(0)` à
// ~1 ms, et ce banc a besoin de centaines d'images. Même sémantique (un tour de
// boucle d'événements), sans le plancher.
async function souffler(tours) {
  for (let i = 0; i < tours; i++) await new Promise((r) => setImmediate(r))
}

async function avancer(ms) {
  horloge += ms
  for (;;) {
    const i = attentes.findIndex((e) => e.du <= horloge)
    if (i < 0) break
    attentes.splice(i, 1)[0].r()
    await souffler(4)
  }
  await souffler(6)
}

// ═══════════════════════════════════════════════ 4. LE DÉPÔT ═════════════════

const globeMod = await import('../src/globe.js')
const { Globe, PLAFOND_FILE, _resetTileMemo, _resetJournalReseau, noterReponse } = globeMod
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT, MERCATOR_MAX_LAT } = await import('../src/geo.js')
const { empriseSocle, ZOOM_SOCLE } = await import('../src/monde/seuil-socle.js')
const {
  creerFlux,
  demanderEmprise,
  demanderBathy,
  tuilesPretes,
  zoomEffectif,
  remplirHauteurs,
  zoomPourEmprise,
  revisionFlux,
  debitObserve,
  tuilesEmprise,
  MERCATOR_LAT_MAX,
} = await import('../src/monde/flux-terrain.js')

const { _resetDemSource, DEM_SOURCES } = await import('../src/dem-source.js')
const { loadDem, _resetTileCaches } = await import('../src/dem.js')
const { empriseBlocMNT } = await import('../src/geo.js')

// ⚠️ CE FICHIER ÉPINGLE LA SOURCE SUR AWS, ET C'EST UN CHOIX MOTIVÉ (plan
// « globe continu », Tâche 4 alpha). Son sujet est le FLUX — la file, la
// couverture de l'emprise, le rééchantillonnage des hauteurs — et tout son banc
// est bâti autour d'un monde à URL AWS et d'une HORLOGE VIRTUELLE : les tuiles
// ne se débloquent que quand `avancer()` les libère. Y faire entrer la sonde de
// couverture de Mapterhorn ferait dépendre chacune de ses mesures d'un
// aller-retour de six HEAD qu'il faudrait libérer à la main, et ce fichier
// mesurerait alors la sonde au lieu de la file.
//
// ⚠️ **CE QU'IL NE COUVRE DONC PAS EST COUVERT AILLEURS, ET NOMMÉMENT** :
// `test/globe-source.test.js` exerce la politique de source, les deux tailles
// de tuile, et le fait que `remplirHauteurs` lise bien une tuile de 512 px.
const url = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

// la caméra du dépôt : fov 30 (`main.js`), far 1400 (`modes.js`),
// near = clamp(orbAlt × 0,2 ; 0,01 ; 0,5) (`loi-altitude.js`)
function nouvelleCamera() {
  return new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1400)
}

function poseCamera(camera, lat, lon, altM) {
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, camera.position)
  camera.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

function etat(globe) {
  let loading = 0
  let zmax = 0
  for (const t of globe.tiles.values()) {
    if (t.state === 'loading') loading++
    if (t.mesh?.visible && t.z > zmax) zmax = t.z
  }
  return { loading, zmax, cache: globe.tiles.size, file: globe.queue.length }
}

function neuf(params = {}) {
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id) // voir l'encart au-dessus de `url`
  // ⚠️ **ET LES MÉMOIRES BATHY AUSSI** (Tâche 6 sexies) : `bathyMisses` retient
  // les absences POUR TOUTE LA SESSION — un test qui coupe la bathymétrie
  // laisserait tous les suivants sans mer, en silence et sans qu'une assertion
  // ne bouge tant que personne ne la regarde.
  _resetTileCaches()
  _resetJournalReseau()
  attentes.length = 0
  horloge = 0
  compteur.requetes = 0
  compteur.parUrl.clear()
  const g = new Globe({ globeContinu: true, ...params })
  g.setVisible(true)
  return g
}

const CENTRE = { lat: 45, lon: 6.25 }

before(() => {
  assert.equal(MERCATOR_LAT_MAX, MERCATOR_MAX_LAT, 'la recopie de MERCATOR_MAX_LAT a divergé de geo.js')
})

// ═══════════════════════════════════════════ UNE CASE PAR INTERFACE ══════════

test('creerFlux : un flux neuf rend un cache vide et zéro requête', async () => {
  const g = neuf()
  const avant = compteur.requetes // les 16 racines partent au `setVisible`
  const flux = creerFlux({ globe: g })
  assert.equal(tuilesPretes(flux, empriseSocle({ centre: CENTRE })).size, 0, 'le cache du flux neuf n est pas vide')
  assert.equal(compteur.requetes, avant, 'le flux neuf a lancé des requêtes')
  assert.equal(debitObserve(flux), null, 'un flux neuf doit rendre null, pas zéro')
  assert.throws(() => creerFlux({}), TypeError, 'creerFlux sans globe doit refuser bruyamment')
  g.dispose()
})

test('demanderEmprise : les tuiles de l emprise sont demandées, ET AUCUNE AUTRE', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  const attendues = tuilesEmprise(emprise, ZOOM_SOCLE)
  // ⚠️ L'ASSERTION SE REJOUE CONTRE LA GÉOMÉTRIE, pas contre un littéral :
  // `BLOCK_TILES = 3`, donc 3×3 alignée et 4×4 au pire quand elle chevauche.
  assert.ok(attendues.length >= 9 && attendues.length <= 16, `${attendues.length} tuiles pour un socle 3×3`)

  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })

  // ⚠️ « DEMANDÉE » SE LIT SUR L'ÉTAT DE LA TUILE, PAS SUR `fetch`. Le vol est
  // plafonné à six (`MAX_CONCURRENT`) : compter les appels à `fetch` ne verrait
  // que les six premières et ferait échouer un code parfaitement sain. Une tuile
  // demandée est `loading` (en file ou en vol) ou déjà `ready`.
  for (const { z, x, y } of attendues) {
    const t = g.tiles.get(`${z}/${x}/${y}`)
    assert.ok(t, `la tuile ${z}/${x}/${y} de l emprise n existe même pas`)
    assert.ok(['loading', 'ready'].includes(t.state), `la tuile ${z}/${x}/${y} est restée « ${t.state} »`)
  }
  // ET AUCUNE AUTRE : au niveau du socle, le cache ne contient QUE l'emprise.
  const auNiveau = [...g.tiles.values()].filter((t) => t.z === ZOOM_SOCLE)
  assert.equal(
    auNiveau.length,
    attendues.length,
    `${auNiveau.length} tuiles z${ZOOM_SOCLE} en cache pour ${attendues.length} couvrantes`
  )
  g.dispose()
})

test('tuilesPretes : que des `ready`, et que celles qui intersectent l emprise', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
  // à mi-chemin : il reste des `loading`
  await avancer(MS_PAR_IMAGE)
  for (const t of tuilesPretes(flux, emprise).values()) assert.equal(t.state, 'ready')

  for (let i = 0; i < 30; i++) await avancer(MS_PAR_IMAGE)
  const pretes = tuilesPretes(flux, emprise)
  assert.ok(pretes.size >= 9, `${pretes.size} tuiles prêtes sur l emprise`)
  for (const t of pretes.values()) assert.equal(t.state, 'ready', 'une tuile non prête est sortie de tuilesPretes')

  // ⚠️ LES ANTIPODES NE RENDENT AUCUNE TUILE DU SOCLE — mais elles en rendent
  // de GROSSIÈRES, et c'est juste : une racine z2 couvre un quart de planète,
  // donc elle intersecte vraiment l'emprise d'en face. `tuilesPretes` répond à
  // « qu'est-ce qui recouvre ce rectangle », pas à « qu'est-ce qui est fin ».
  // C'est `zoomEffectif` qui juge la finesse, et il rendra z2 là-bas.
  const loin = empriseSocle({ centre: { lat: -41, lon: -173 } })
  const pretesLoin = tuilesPretes(flux, loin)
  for (const t of pretesLoin.values()) {
    assert.ok(t.z <= 3, `une tuile z${t.z} rendue à l autre bout du monde`)
  }
  assert.ok((zoomEffectif(flux, loin) ?? 99) < ZOOM_SOCLE, 'l autre bout du monde se croit couvert au zoom du socle')
  g.dispose()
})

test('zoomEffectif : SOUS le zoom demandé tant que la couverture est incomplète', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })

  assert.equal(zoomEffectif(flux, emprise), null, 'sans une seule tuile, zoomEffectif doit rendre null')

  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
  // une seule tuile prête : la couverture est incomplète, donc le zoom AUSSI
  await avancer(MS_PAR_IMAGE * 2)
  const partiel = zoomEffectif(flux, emprise)
  assert.ok(partiel === null || partiel < ZOOM_SOCLE, `zoom effectif ${partiel} alors que la couverture est partielle`)

  for (let i = 0; i < 60; i++) await avancer(MS_PAR_IMAGE)
  assert.equal(zoomEffectif(flux, emprise), ZOOM_SOCLE, 'couverture complète : le zoom effectif doit rejoindre le demandé')
  g.dispose()
})

test('remplirHauteurs : (n+1)² hauteurs EN UNE PASSE, et le compte des manquants', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })

  // 1. rien de chargé : tout est manquant, et rien n'a été écrit
  const n = 32
  const vide = remplirHauteurs(flux, { emprise, n })
  assert.equal(vide.sortie.length, (n + 1) ** 2, 'la sortie ne fait pas (n+1)²')
  assert.equal(vide.remplis, 0)
  assert.equal(vide.manquants, (n + 1) ** 2)

  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
  for (let i = 0; i < 60; i++) await avancer(MS_PAR_IMAGE)

  // 2. couverture complète : plus un seul manquant, et la sortie fournie est
  //    celle qu'on récupère (une passe, pas une allocation par sommet)
  const sortie = new Float32Array((n + 1) ** 2)
  const r = remplirHauteurs(flux, { emprise, n, sortie })
  assert.equal(r.sortie, sortie, 'remplirHauteurs a alloué au lieu d écrire dans `sortie`')
  assert.equal(r.manquants, 0, `${r.manquants} hauteurs manquantes sur ${(n + 1) ** 2}`)
  assert.equal(r.remplis, (n + 1) ** 2)

  // 3. et ce sont les BONNES hauteurs : chaque sommet porte l'élévation de la
  //    tuile sous lui, celle que le bouchon a encodée.
  const attendues = new Set([...tuilesEmprise(emprise, ZOOM_SOCLE)].map((t) => elevationDe(t.z, t.x, t.y)))
  const vues = new Set()
  for (const h of r.sortie) vues.add(Math.round(h))
  for (const v of vues) {
    assert.ok(
      [...attendues].some((a) => Math.abs(a - v) < 1),
      `hauteur ${v} lue alors que l emprise ne porte que ${[...attendues].join(', ')}`
    )
  }
  assert.ok(vues.size > 1, 'toutes les hauteurs sont identiques : le banc ne distingue pas les tuiles')
  g.dispose()
})

// ══════════ LA BATHYMÉTRIE DANS LE FLUX — Tâche 6 sexies ════════════════════
//
// ⚠️ **LE DÉFAUT EST MESURÉ, PAS SUPPOSÉ, ET LE REJEU EST PUBLIÉ.**
// `.banc/rejeu-6sexies.mjs` (hors dépôt) charge les VRAIES tuiles d'altitude
// d'AWS et les VRAIS fichiers de `public/data/bathy/`, puis compare `loadDem`
// avec et sans fusion sur la même grille de 768². Relevé le 2026-08-21 :
//
//   lieu                     | nœuds en mer | écart moyen | écart max | |minM|
//   La Réunion (côte ouest)  |      315 809 |     485,7 m |   1 324 m | 1 324 m
//   Nice                     |      285 580 |     615,0 m |   1 411 m | 1 411 m
//   Chamonix (témoin)        |            0 |           — |       0 m |   805 m
//
// **Sur la TERRE l'écart est de 0,00 m partout** — la fusion ne la touche pas.
// **En MER l'écart maximal vaut EXACTEMENT `|minM|`** : le terrarium nu rend
// zéro au point le plus profond. Et `remplirHauteurs` rend le MÊME écart que le
// terrarium nu (485,5 m contre 485,7 m à La Réunion) : le quadtree ne sert pas
// une troisième chose, il sert le terrarium sans sa mer.

// ⚠️ DANS LA BBOX DE `INDEX_BATHY` — voir l'encart de l'index.
const OCEAN = { lat: 42.5, lon: 6.0 }

/** L'emprise du socle, ses tuiles demandées, chargées, et sa bathymétrie. */
async function socleOceanique({ centre = OCEAN, zoom = ZOOM_SOCLE, emprise: imposee = null } = {}) {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = imposee ?? empriseSocle({ centre })
  demanderEmprise(flux, { emprise, zoom })
  for (let i = 0; i < 60; i++) await avancer(MS_PAR_IMAGE)
  // ⚠️ ON L'ATTEND EXPLICITEMENT, ET C'EST TOUTE LA MESURE : la bathymétrie est
  // LOCALE, donc son attente se compte en tours de boucle, pas en aller-retours
  // réseau. `demanderEmprise` l'a déjà lancée ; ce `await` ne fait que rendre le
  // banc déterministe.
  await demanderBathy(flux, { emprise, zoom })
  return { g, flux, emprise }
}

test('remplirHauteurs FUSIONNE la bathymétrie : sur une emprise OCÉANIQUE, le fond descend sous zéro', async () => {
  banc.mer = true
  banc.bathyPlate = false
  try {
    const { g, flux, emprise } = await socleOceanique()
    const n = 32
    const r = remplirHauteurs(flux, { emprise, n })
    assert.equal(r.manquants, 0, `${r.manquants} hauteurs manquantes : le banc ne couvre pas l emprise`)

    let min = Infinity
    let moy = 0
    for (const h of r.sortie) {
      moy += h
      if (h < min) min = h
    }
    moy /= r.sortie.length

    // ⚠️ **L'ASSERTION QUI ÉCHOUE CONTRE LE DÉPÔT D'AUJOURD'HUI.** Le terrarium
    // du banc est à zéro exact partout (monde océanique) : sans fusion, `min` et
    // `moy` valent zéro, c'est-à-dire la « plaine pâle uniforme » vue à l'écran
    // à La Réunion sous `?socle=quadtree`.
    assert.ok(min <= -200, `fond le plus profond ${min.toFixed(1)} m : la mer est PLATE`)
    assert.ok(moy <= -200, `profondeur moyenne ${moy.toFixed(1)} m : la mer est PLATE`)

    // ET C'EST LA BONNE TUILE À LA BONNE PLACE — même forme d'assertion que
    // pour les élévations ci-dessus : chaque profondeur lue doit être celle
    // d'une tuile bathy de l'emprise. ⚠️ Au-delà de 25 m de fond, la sortie de
    // `fuseBathymetry` vaut EXACTEMENT la source fine (le fondu sature), et le
    // banc est très au-delà.
    const attendues = tuilesEmprise(emprise, ZOOM_SOCLE).map((t) => profondeurDe(t.z, t.x, t.y))
    const vues = new Set()
    for (const h of r.sortie) vues.add(Math.round(h))
    for (const v of vues) {
      assert.ok(
        attendues.some((a) => Math.abs(a - v) < 1),
        `profondeur ${v} lue alors que l emprise ne porte que ${[...new Set(attendues)].join(', ')}`
      )
    }
    assert.ok(vues.size > 1, 'toutes les profondeurs sont identiques : le banc ne distingue pas les tuiles bathy')

    // ⚠️ **ET LA FUSION S'ARRÊTE À (n+1)², MÊME SUR UN TAMPON PLUS GRAND.**
    // `remplirHauteurs` accepte une `sortie` plus longue que la grille (c'est
    // écrit dans son `RangeError`, qui ne refuse que le trop COURT). Fusionner
    // le tampon entier écrirait dans la queue de l'appelant — une écriture hors
    // grille, muette, et que seul un tampon partagé révélerait un jour.
    const total = (n + 1) ** 2
    const large = new Float32Array(total + 7).fill(12345)
    remplirHauteurs(flux, { emprise, n, sortie: large })
    for (let k = total; k < large.length; k++) {
      assert.equal(large[k], 12345, `la fusion a débordé de la grille au rang ${k}`)
    }
    g.dispose()
  } finally {
    banc.mer = false
  }
})

test('un TROU du relief ne devient PAS une fosse — la mer ne remplit que ce qui est couvert', async () => {
  // ⚠️ **UN NŒUD HORS COUVERTURE VAUT ZÉRO DANS `sortie`, ET ZÉRO EST UNE
  // ABSENCE DE MESURE POUR `fuseBathymetry`.** Fusionner sans regarder la
  // couverture creuserait donc les TROUS du socle jusqu au fond marin, pendant
  // que `manquants` continuerait de dire zéro et que `zoomEffectif` n en
  // saurait rien : un socle troué se peindrait en fosse abyssale, en silence.
  banc.mer = true
  try {
    const { g, flux, emprise } = await socleOceanique()
    // ⚠️ **LE TROU SE FABRIQUE À LA MAIN, ET C'EST LE SEUL MOYEN.** Attendre
    // moins longtemps ne rend pas une couverture partielle : soit rien n'est
    // prêt (mesuré, 0/1089 après deux images), soit les RACINES du quadtree
    // sont là et recouvrent l'emprise entière, grossièrement mais sans trou.
    // On retire donc la moitié des tuiles du cache après coup.
    const fines = [...tuilesPretes(flux, emprise).values()].filter((t) => t.z === ZOOM_SOCLE)
    const gardees = new Map()
    for (const t of fines.slice(0, Math.floor(fines.length / 2))) gardees.set(t.key, t)
    const troue = { ...flux, globe: { tiles: gardees } }
    const n = 32
    const { sortie, remplis, manquants } = remplirHauteurs(troue, { emprise, n })
    assert.ok(manquants > 0 && remplis > 0,
      `couverture ${remplis}/${remplis + manquants} : le banc doit être PARTIEL pour prouver quoi que ce soit`)
    let zeros = 0
    for (const h of sortie) if (h === 0) zeros++
    assert.equal(zeros, manquants,
      `${zeros} nœuds à zéro pour ${manquants} manquants : la mer a rempli des trous`)
    g.dispose()
  } finally {
    banc.mer = false
  }
})

test('une nappe SUPERSÉDÉE n incrémente pas le signal — le plus lent ne gagne pas', async () => {
  // ⚠️ **MÊME IDIOME QUE LA SUPERSESSION DE `fetchAndBuildDem`** (Tâche 6
  // septies) : un cran change l emprise pendant qu une nappe vole. Sans le point
  // de contrôle, la nappe périmée poserait `prete` et bousculerait le signal —
  // donc une reconstruction du socle pour une mer qui n est plus la sienne.
  banc.mer = true
  const ouvrir = retenirLaMer()
  try {
    const g = neuf()
    const flux = creerFlux({ globe: g })
    const a = empriseSocle({ centre: OCEAN })
    const b = empriseSocle({ centre: { lat: OCEAN.lat + 1.5, lon: OCEAN.lon + 1.5 } })
    const volA = demanderBathy(flux, { emprise: a, zoom: ZOOM_SOCLE })
    const volB = demanderBathy(flux, { emprise: b, zoom: ZOOM_SOCLE })
    assert.notEqual(volA, volB, 'les deux emprises partagent la même nappe : le banc ne mesure rien')
    ouvrir()
    await Promise.all([volA, volB])
    assert.equal(flux.bathyRevision, 1, `${flux.bathyRevision} arrivées pour une seule nappe vivante`)
    g.dispose()
  } finally {
    banc.mer = false
  }
})

/**
 * L'emprise d'UNE tuile, en degrés — l'inverse exact de `mercX`/`mercY`.
 *
 * ⚠️ **UNE SEULE TUILE, ET C'EST UNE CONTRAINTE DU BANC, PAS UN CHOIX.** Le
 * `FakeCtx` de ce fichier rend une dalle de 256² quel que soit le canevas
 * demandé — il a été écrit pour les tuiles du globe, qui n'ont pas d'autre
 * taille. `loadDem` avec `tilesAcross = 3` peint un canevas de 768² et relirait
 * donc **65 536 pixels sur 589 824**, le reste en `undefined` : `dem.data` y
 * vaudrait zéro alors que `dem.minM` dirait −1200. **Mesuré, et c'est ce qui a
 * fait échouer la première version de ce test — pas le code.** `tilesAcross = 1`
 * met le MNT exactement à la taille que le bouchon sait rendre.
 */
function empriseTuile(z, x, y) {
  const n = 2 ** z
  const lat = (my) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI
  return {
    ouest: (x / n) * 360 - 180,
    est: ((x + 1) / n) * 360 - 180,
    nord: lat(y / n),
    sud: lat((y + 1) / n),
  }
}

test('la mer du flux s ACCORDE au MNT de `loadDem` — les deux chemins, la même fusion', async () => {
  banc.mer = true
  banc.bathyPlate = true // fond uniforme : l accord ne dépend d aucun alignement au demi-pixel
  try {
    const zoom = ZOOM_SOCLE
    const nz = 2 ** zoom
    const tx = Math.floor(((OCEAN.lon + 180) / 360) * nz)
    const laRad = (OCEAN.lat * Math.PI) / 180
    const ty = Math.floor(
      ((1 - Math.log(Math.tan(laRad) + 1 / Math.cos(laRad)) / Math.PI) / 2) * nz
    )
    const emprise = empriseTuile(zoom, tx, ty)
    const { g, flux } = await socleOceanique({ zoom, emprise })

    // ⚠️ `loadDem` PASSE PAR LE MODÈLE DE LATENCE pour ses tuiles d altitude :
    // on le lance, puis on avance l horloge virtuelle jusqu à ce qu il rende.
    const promesse = loadDem({ lat: OCEAN.lat, lon: OCEAN.lon, zoom, tilesAcross: 1 })
    for (let i = 0; i < 60; i++) await avancer(MS_PAR_IMAGE)
    const dem = await promesse
    assert.equal(dem.size, 256, 'le MNT du banc doit tenir dans la dalle de 256² du bouchon')
    assert.ok(dem.minM < -200, `le MNT du banc n a pas de mer (minM = ${dem.minM}) : il ne mesure rien`)

    const n = 64
    const { sortie } = remplirHauteurs(flux, { emprise, n })
    let pire = 0
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const di = Math.min(dem.size - 1, Math.round((i / n) * (dem.size - 1)))
        const dj = Math.min(dem.size - 1, Math.round((j / n) * (dem.size - 1)))
        const d = Math.abs(sortie[j * (n + 1) + i] - dem.data[dj * dem.size + di])
        if (d > pire) pire = d
      }
    }
    // `dem.data` est quantifié au mètre entier (`dem-quant.js`) : la tolérance
    // borne l arrondi, pas un désaccord de fond.
    assert.ok(pire <= 1.5, `écart maximal ${pire.toFixed(2)} m entre le flux et le MNT sur la même emprise`)
    g.dispose()
  } finally {
    banc.mer = false
    banc.bathyPlate = false
  }
})

test('la TERRE ne bouge JAMAIS : sur un monde émergé, la fusion est l identité BIT À BIT', async () => {
  // Le monde par défaut du banc est ÉMERGÉ (`elevationDe` ≥ 0) et la
  // bathymétrie, elle, est servie : c est exactement la situation où une fusion
  // trop bavarde remettrait le trait de côte entre les mains de la source fine.
  //
  // ⚠️ **ET LE TÉMOIN SE PREND SANS BATHYMÉTRIE, PAS SUR UNE LISTE DE VALEURS
  // ATTENDUES.** `elevationDe` rend ZÉRO sur une tuile de l emprise
  // (`(x + 3y + 7z) % 40 === 0`), et un zéro EXACT est — à juste titre — une
  // ABSENCE DE MESURE pour `fuseBathymetry`, pas de la terre plate. La règle
  // « la terre ne bouge jamais » porte donc sur ce qui est MESURÉ, c est-à-dire
  // les nœuds strictement positifs. Ce test l a d abord ignoré, et il avait tort.
  const n = 32
  banc.bathy = false
  const temoin = await socleOceanique()
  const avant = Float32Array.from(remplirHauteurs(temoin.flux, { emprise: temoin.emprise, n }).sortie)
  temoin.g.dispose()
  banc.bathy = true

  const { g, flux, emprise } = await socleOceanique()
  const { sortie } = remplirHauteurs(flux, { emprise, n })
  let positifs = 0
  for (let k = 0; k < avant.length; k++) {
    if (!(avant[k] > 0)) continue
    positifs++
    assert.equal(sortie[k], avant[k], `la fusion a creusé une TERRE mesurée à ${avant[k]} m`)
  }
  assert.ok(positifs > 0, 'le banc n a pas une seule terre mesurée : il ne prouve rien')
  g.dispose()
})

test('sans une seule tuile bathy, la sortie est celle d avant — le repli est MUET', async () => {
  banc.mer = true
  banc.bathy = false
  try {
    const { g, flux, emprise } = await socleOceanique()
    const { sortie, manquants } = remplirHauteurs(flux, { emprise, n: 32 })
    assert.equal(manquants, 0, 'le banc ne couvre pas l emprise')
    for (const h of sortie) {
      assert.equal(h, 0, `hauteur ${h} sans une seule tuile bathy : le repli invente du relief`)
    }
    g.dispose()
  } finally {
    banc.mer = false
    banc.bathy = true
  }
})

test('revisionFlux CHANGE quand la mer atterrit — sinon le raffinement ne repart jamais', async () => {
  // ⚠️ **CE TEST GARDE LE SEUL FIL QUI RAMÈNE LA MER À L ÉCRAN.** `socleRaffine`
  // (main.js) ne redessine que lorsque le signal du flux change. Si ce signal ne
  // comptait que les tuiles d ALTITUDE lisibles, une bathymétrie arrivée APRÈS
  // la dernière tuile ne déclencherait rien : le fond marin serait chargé,
  // fusionnable, et jamais affiché — un défaut parfaitement MUET.
  banc.mer = true
  try {
    // ⚠️ **LA MER EST RETENUE PENDANT QUE LES TUILES D ALTITUDE ARRIVENT.**
    // Sans cette porte, le signal aurait DE TOUTE FAÇON changé — parce que le
    // compte de tuiles lisibles passe de 0 à 16 dans le même intervalle — et le
    // test serait resté vert même sur un signal aveugle à la mer. **Mesuré : la
    // mutation « ne pas incrémenter `bathyRevision` » y survivait.**
    const ouvrir = retenirLaMer()
    const g = neuf()
    const flux = creerFlux({ globe: g })
    const emprise = empriseSocle({ centre: OCEAN })
    demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
    for (let i = 0; i < 60; i++) await avancer(MS_PAR_IMAGE)
    const avant = revisionFlux(flux)
    assert.equal(flux.bathy.prete, false, 'la nappe a déjà atterri : ce banc ne mesure plus l arrivée')
    ouvrir()
    await demanderBathy(flux, { emprise, zoom: ZOOM_SOCLE })
    assert.equal(flux.bathy.prete, true, 'la nappe n a jamais atterri')
    // ⚠️ ET LES TUILES D ALTITUDE, ELLES, N ONT PAS BOUGÉ ENTRE LES DEUX MESURES.
    assert.equal(avant.split('/')[0], revisionFlux(flux).split('/')[0],
      'le compte de tuiles a changé : ce n est pas la mer que le test mesure')
    assert.notEqual(revisionFlux(flux), avant, 'la mer est arrivée sans que le signal de raffinement ne bouge')
    // et il est STABLE une fois posé : un signal qui change à chaque appel
    // ferait reconstruire le socle à chaque image.
    assert.equal(revisionFlux(flux), revisionFlux(flux), 'le signal de raffinement n est pas stable')
    g.dispose()
  } finally {
    banc.mer = false
  }
})

test('debitObserve : null sur un flux neuf, le débit agrégé après trois réponses connues', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  assert.equal(debitObserve(flux), null, 'zéro se propagerait en « réseau mort » dans zoomSoutenable')

  // trois réponses de tailles et durées CONNUES, posées bout à bout : le débit
  // agrégé en temps mural vaut alors Σoctets×8 / Σdurées.
  horloge = 1000
  noterReponse({ octets: 100_000, debut: 1000, fin: 1200 }) // 200 ms
  noterReponse({ octets: 200_000, debut: 1200, fin: 1600 }) // 400 ms
  noterReponse({ octets: 300_000, debut: 1600, fin: 2000 }) // 400 ms
  const attendu = (600_000 * 8) / 1.0 / 1e6 // 4,8 Mb/s sur une seconde de mur
  const vu = debitObserve(flux)
  assert.ok(Math.abs(vu - attendu) < 1e-9, `débit ${vu} Mb/s au lieu de ${attendu}`)

  // ⚠️ ET IL EST EN TEMPS MURAL : six transferts SIMULTANÉS de 400 ms font
  // 400 ms, pas 2 400. Sommer les durées diviserait le débit par six.
  _resetJournalReseau()
  const f2 = creerFlux({ globe: g })
  for (let i = 0; i < 6; i++) noterReponse({ octets: 100_000, debut: 0, fin: 400 })
  assert.ok(Math.abs(debitObserve(f2) - (600_000 * 8) / 0.4 / 1e6) < 1e-9, 'le débit ignore le parallélisme')
  g.dispose()
})

// ═══════════════════════════════════════════ LE PIÈGE MESURÉ ═════════════════

test('une tuile annulée redevient `empty` — jamais `idle` — et NE REVIENT PAS d elle-même', async () => {
  const g = neuf()
  // on remplit la file sans la laisser partir : le vol est plafonné à six,
  // donc à partir de la septième les entrées attendent.
  const cibles = []
  for (let i = 0; i < 40; i++) {
    const t = g._ensureTile(9, 260 + i, 180)
    g._request(t, 1)
    cibles.push(t)
  }
  const enFile = cibles.filter((t) => g.queue.some((e) => e.t === t))
  assert.ok(enFile.length > 20, `${enFile.length} entrées en file : le banc ne remplit pas la file`)

  const victime = enFile[enFile.length - 1]
  const cle = url(victime.z, victime.x, victime.y)
  const avant = compteur.parUrl.get(cle) || 0
  assert.equal(g._annuler(victime), true, 'l annulation n a pas trouvé la tuile en file')
  assert.equal(victime.state, 'empty', `état « ${victime.state} » après annulation : seul « empty » rouvre _request`)

  // 60 images ailleurs : rien ne doit la redemander, et surtout pas le réessai
  // automatique du `.catch` de `_pump`.
  const camera = poseCamera(nouvelleCamera(), -41, 174, 300_000)
  for (let i = 0; i < 60; i++) {
    g.update(camera, 0.016)
    await avancer(MS_PAR_IMAGE)
  }
  assert.equal(compteur.parUrl.get(cle) || 0, avant, 'la tuile annulée est repartie sur le réseau toute seule')

  // et AUCUNE tuile du globe ne porte un état inventé
  for (const t of g.tiles.values()) {
    assert.ok(['empty', 'loading', 'ready', 'error'].includes(t.state), `état inventé : ${t.state}`)
  }
  g.dispose()
})

test('une requête refusée par PLAFOND_FILE reste `empty`, elle ne devient pas un fantôme', async () => {
  const g = neuf()
  let refusees = 0
  for (let i = 0; i < PLAFOND_FILE + 200; i++) {
    const t = g._ensureTile(10, 520 + i, 360)
    g._request(t, 1)
    if (t.state === 'empty') refusees++
  }
  assert.ok(refusees > 0, `aucun refus alors que ${PLAFOND_FILE + 200} tuiles ont été demandées`)
  assert.ok(g.queue.length <= PLAFOND_FILE, `file à ${g.queue.length} pour un plafond de ${PLAFOND_FILE}`)
  assert.equal(g._refusFile, refusees, 'le compteur de refus ne suit pas')
  g.dispose()
})


test('l éviction reprend les `empty` PÉRIMÉES avant de toucher aux tuiles prêtes', async () => {
  // ⚠️ LA TROISIÈME CORRECTION DE LA TÂCHE, ET ELLE A SON PROPRE TEST PARCE QUE
  // LE PANORAMIQUE NE LA VOIT PAS — mesuré : au balayage de référence le cache
  // culmine à 836 tuiles pour un budget de 1 700, donc `_evictJusqua` ne se
  // déclenche jamais et la correction reste invisible. Un test qui ne peut pas
  // échouer ne garde rien.
  //
  // Le fait : le plafond de file et la purge rendent des tuiles à `empty`. Or
  // les deux rangs d'éviction filtrent tous deux sur `ready` — une `empty`
  // n'était donc candidate à AUCUN, et retenait une entrée du budget pour
  // toujours. C'est le fantôme qu'on croyait avoir chassé, revenu par la porte
  // d'à côté.
  const g = neuf()
  const PRETES = 12
  const FANTOMES = 30

  const pretes = []
  for (let i = 0; i < PRETES; i++) {
    const t = g._ensureTile(9, 300 + i, 180)
    g._request(t, 1)
    pretes.push(t)
  }
  for (let i = 0; i < 40; i++) await avancer(MS_PAR_IMAGE)
  assert.ok(
    pretes.every((t) => t.state === 'ready'),
    'le banc n a pas réussi à charger ses tuiles prêtes'
  )

  // les tuiles prêtes PORTENT la couverture de l'image courante ; les fantômes
  // sont `empty` et n'ont été touchés par aucun parcours
  g.frame = 5
  for (const t of pretes) {
    t.lastUsed = g.frame
    t.coverFrame = g.frame
  }
  const fantomes = []
  for (let i = 0; i < FANTOMES; i++) fantomes.push(g._ensureTile(9, 400 + i, 180))
  assert.ok(
    fantomes.every((t) => t.state === 'empty' && t.lastUsed !== g.frame),
    'les fantômes du banc ne sont pas des `empty` périmées'
  )

  g._evictJusqua(g.tiles.size - FANTOMES)

  for (const t of fantomes) {
    assert.equal(g.tiles.has(t.key), false, `le fantôme ${t.key} occupe encore une entrée du budget`)
  }
  for (const t of pretes) {
    assert.equal(g.tiles.has(t.key), true, `la tuile prête ${t.key} a été sacrifiée à la place d un fantôme`)
  }
  g.dispose()
})
// ═══════════════════════════════════ LE PANORAMIQUE — LE TEST QUI COMPTE ═════
//
// ⚠️ **DEUX TESTS, ET LE PARTAGE N'EST PAS UN CONFORT : C'EST LA PHYSIQUE.**
// Le geste est le même — 90° de balayage latéral à 4 km puis cinq secondes
// d'immobilité — mais les deux moitiés de l'assertion du plan ne se mesurent pas
// au même réseau :
//
//   · **le PIC de `loading` et le retour sous le plafond** se mesurent à un
//     réseau RÉALISTE (12 Mb/s, le point haut de la règle R3). C'est là que la
//     file sature, donc c'est là que le plafond mord : sans lui, le banc
//     `.banc/pano-latence.mjs` relève **558 tuiles au pic**.
//   · **le retour du globe à sa profondeur** ne se mesure qu'à réseau RAPIDE.
//     Après 90° de balayage, la totalité du cache est périmée : reconstruire un
//     millier de tuiles demande, à 12 Mb/s et six requêtes simultanées de
//     359 ms, une bonne minute. Exiger le retour en cinq secondes à ce débit-là
//     mesurerait la **bande passante**, pas la file — et le test échouerait sur
//     un code parfaitement corrigé. ⚠️ **Mesuré, et c'est ce qui a fait scinder
//     ce test** : à 12 Mb/s le globe revient à z6 depuis z14 en cinq secondes,
//     et aucune correction de file n'y peut quoi que ce soit.
//
// ⚠️ **LE ZOOM EFFECTIF DE L'EMPRISE, LUI, REVIENT AUX DEUX DÉBITS**, et c'est
// exactement ce que le flux apporte : le socle est demandé À PRIORITÉ MAXIMALE
// sur seize tuiles, pas mille. C'est la différence entre « le globe est fin » et
// « le socle est prêt », et c'est pour cela que `zoomEffectif` existe.

const ALT_PANO = 4000

async function panoramique({ debit, stabilisation, repos = 300 }) {
  DEBIT_MBS = debit
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const camera = nouvelleCamera()
  let lon = CENTRE.lon

  const image = async () => {
    poseCamera(camera, CENTRE.lat, lon, ALT_PANO)
    g.update(camera, 0.016)
    demanderEmprise(flux, { emprise: empriseSocle({ centre: { lat: CENTRE.lat, lon } }), zoom: ZOOM_SOCLE })
    await avancer(MS_PAR_IMAGE)
  }

  // ⚠️ **PROTOCOLE : AU MOINS 17 IMAGES JETÉES AVANT DE RELEVER.** La règle
  // sans-trou ne descend que d'un niveau par image (convergence mesurée à
  // l'image 12 à 8 km, 13 à 2 km) — et avec un modèle de latence, il faut en
  // plus le temps que les tuiles arrivent. Un banc trop court n'est pas
  // seulement imprécis : **il IMITE le défaut cherché**, puisqu'une file basse
  // parce que rien n'a encore été demandé se lit comme une file saine.
  for (let i = 0; i < stabilisation; i++) await image()
  const stable = etat(g)

  let pic = stable.loading
  for (let i = 1; i <= 60; i++) {
    lon = CENTRE.lon + (90 * i) / 60
    await image()
    pic = Math.max(pic, etat(g).loading)
  }
  const balayage = etat(g)

  for (let i = 0; i < repos; i++) await image()
  const apres = etat(g)
  const emprise = empriseSocle({ centre: { lat: CENTRE.lat, lon } })
  return { g, flux, stable, pic, balayage, apres, zoomFlux: zoomEffectif(flux, emprise) }
}

test('panoramique à 12 Mb/s : la file ne dépasse plus le plafond, et elle redescend', async () => {
  const m = await panoramique({ debit: 12, stabilisation: 900 })
  assert.ok(m.stable.zmax >= 10, `le banc ne descend qu à z${m.stable.zmax} : il ne mesure rien`)

  // ⚠️ L'ASSERTION QUI ÉCHOUE SUR LE CODE D'AVANT. Banc `.banc/pano-latence.mjs`
  // sans les corrections : **558** tuiles `loading` au pic à 12 Mb/s, 554 à
  // 3 Mb/s, 546 à 0,5 Mb/s — le pic ne dépend pas du débit, c'est la frontière
  // du quadtree qui le fixe. Et le navigateur en relevait **568**.
  assert.ok(
    m.pic <= PLAFOND_FILE + 6,
    `pic de ${m.pic} tuiles en \`loading\` pendant le balayage, pour ${PLAFOND_FILE} en file + 6 en vol`
  )
  assert.ok(
    m.apres.loading < PLAFOND_FILE,
    `${m.apres.loading} tuiles encore \`loading\` après 5 s d immobilité (plafond ${PLAFOND_FILE})`
  )
  // le zoom EFFECTIF rejoint le zoom demandé — l'assertion qui distingue
  // « demandé » de « couvert »
  assert.equal(m.zoomFlux, ZOOM_SOCLE, `zoom effectif ${m.zoomFlux} au lieu de ${ZOOM_SOCLE} après 5 s`)
  assert.ok(m.g.tiles.size <= m.g.cacheMax, `${m.g.tiles.size} tuiles en cache pour ${m.g.cacheMax}`)
  m.g.dispose()
})

test('panoramique à réseau rapide : le globe RETROUVE sa profondeur après le balayage', async () => {
  const m = await panoramique({ debit: 1200, stabilisation: 240 })
  assert.ok(m.stable.zmax >= 12, `le banc ne descend qu à z${m.stable.zmax} : il ne mesure rien`)
  // le balayage périme tout : c'est le geste, pas un accident
  assert.ok(m.balayage.zmax < m.stable.zmax, 'le balayage ne périme rien : le banc ne bouge pas assez')
  assert.ok(
    m.apres.zmax >= m.stable.zmax,
    `le globe reste à z${m.apres.zmax} depuis z${m.stable.zmax} : la file est encore coincée`
  )
  assert.equal(m.zoomFlux, ZOOM_SOCLE, `zoom effectif ${m.zoomFlux} au lieu de ${ZOOM_SOCLE}`)
  assert.ok(m.apres.loading < PLAFOND_FILE, `${m.apres.loading} tuiles encore \`loading\``)
  m.g.dispose()
})

// ══════════ LE ZOOM SE CHOISIT DEPUIS L'EMPRISE — Tâche J, trou n° 2 ════════
//
// ⚠️ **CE QUE CETTE SECTION DÉFEND EST UN CHIFFRE MESURÉ PAR LA TÂCHE F** : sur
// un champ de mer de 164 km, « z12 ne couvre que 19,3 % des nœuds ; z10 en
// couvre 100 % pour 25 tuiles ». Un zoom POSÉ à la valeur du bloc ne peut pas
// remplir une emprise dix fois plus large — c'est de là que venait l'aplat gris.

test('zoomPourEmprise : le zoom le plus FIN qui tienne dans le budget, et il est MAXIMAL', async () => {
  const emprise = empriseSocle({ centre: CENTRE })
  for (const tuilesMax of [4, 9, 16, 25, 64]) {
    const z = zoomPourEmprise(emprise, { zoomMax: 14, tuilesMax })
    assert.ok(tuilesEmprise(emprise, z).length <= tuilesMax,
      `z${z} dépasse le budget de ${tuilesMax}`)
    // ⚠️ **LA MAXIMALITÉ EST L'ASSERTION QUI COMPTE** : rendre `zoomMin` tout
    // de suite tiendrait toujours dans le budget et serait toujours faux. Le
    // niveau suivant doit VRAIMENT déborder — sauf si on est déjà au plafond.
    if (z < 14) {
      assert.ok(tuilesEmprise(emprise, z + 1).length > tuilesMax,
        `z${z + 1} tiendrait aussi dans ${tuilesMax} : le zoom n est pas maximal`)
    }
  }
})

test('zoomPourEmprise : une emprise PLUS LARGE rend un zoom PLUS GROSSIER', async () => {
  // le sens, et il n'est pas interchangeable : une mutation qui échange les
  // bornes de la boucle rendrait un zoom constant.
  const etroite = empriseSocle({ centre: CENTRE })
  const large = { ouest: -40, sud: -40, est: 40, nord: 40 }
  const zE = zoomPourEmprise(etroite, { zoomMax: 14, tuilesMax: 25 })
  const zL = zoomPourEmprise(large, { zoomMax: 14, tuilesMax: 25 })
  assert.ok(zL < zE, `large z${zL} doit être plus grossier qu étroite z${zE}`)
  // et les bornes sont respectées des deux côtés
  assert.ok(zoomPourEmprise(large, { zoomMax: 3, tuilesMax: 1 }) <= 1)
  assert.equal(zoomPourEmprise(etroite, { zoomMax: 6, zoomMin: 6, tuilesMax: 1 }), 6)
  assert.ok(zoomPourEmprise(etroite, { zoomMax: 20, tuilesMax: 1e9 }) <= 15, 'jamais au-delà de MAX_Z')
})

// ══════════ LA SECONDE EMPRISE — Tâche J, `aussi` ══════════════════════════
//
// ⚠️ **ELLE NE POUVAIT PAS ÊTRE UN SECOND APPEL**, et c'est tout le §« un seul
// flux par globe » : `gardeHauteurs` est REMPLACÉE à chaque appel. Ces trois
// tests défendent les trois propriétés qui rendent l'élargissement sûr.

test('`aussi: null` reproduit le dépôt : mêmes tuiles, même réservation', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: null })
  const attendues = tuilesEmprise(emprise, ZOOM_SOCLE)
  assert.equal(flux.reclamees.size, attendues.length)
  assert.equal(g.gardeHauteurs.size, attendues.length)
  for (const { z, x, y } of attendues) assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`))
  g.dispose()
})

test('`aussi` réserve les DEUX emprises À LA FOIS — sinon chacune reprend l autre', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  // trois fois plus large, deux niveaux plus grossier : l'emprise de la mer
  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
  assert.ok(zMer < ZOOM_SOCLE, `le témoin n a de sens que si le zoom de la mer diffère (z${zMer})`)

  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } })

  const duBloc = tuilesEmprise(emprise, ZOOM_SOCLE)
  const deLaMer = tuilesEmprise(merEmprise, zMer)
  for (const { z, x, y } of duBloc) {
    assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`), `le bloc a perdu ${z}/${x}/${y}`)
  }
  for (const { z, x, y } of deLaMer) {
    assert.ok(g.gardeHauteurs.has(`${z}/${x}/${y}`), `la mer a perdu ${z}/${x}/${y}`)
    const t = g.tiles.get(`${z}/${x}/${y}`)
    assert.ok(t && ['loading', 'ready'].includes(t.state), `la tuile de mer ${z}/${x}/${y} n est pas demandée`)
  }
  // ⚠️ **ET LE ZOOM DEMANDÉ RESTE CELUI DU BLOC** : `zoomEffectif` s'en sert
  // pour dire ce que le SOCLE couvre, et le zoom de la mer est plus grossier.
  assert.equal(flux.demande.zoom, ZOOM_SOCLE)
  g.dispose()
})

test('deux appels avec le MÊME `aussi` n annulent rien — c est la garde de la reprise', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
  const arg = { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } }
  demanderEmprise(flux, arg)
  const apresUn = new Set(g.gardeHauteurs)
  demanderEmprise(flux, arg)
  assert.deepEqual([...g.gardeHauteurs].sort(), [...apresUn].sort(),
    'un second appel identique doit rendre exactement la même réservation')

  // ⚠️ **ET LE TÉMOIN NÉGATIF** : celui qui OUBLIE `aussi` reprend les tuiles de
  // la mer. C'est la raison pour laquelle `main.js` doit le passer aux DEUX
  // appelants — sans ce test, la règle serait un commentaire.
  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE })
  const perdues = tuilesEmprise(merEmprise, zMer)
    .filter(({ z, x, y }) => !g.gardeHauteurs.has(`${z}/${x}/${y}`))
  assert.ok(perdues.length > 0, 'un appel sans `aussi` DOIT reprendre les tuiles de la mer')
  g.dispose()
})

test('la mer passe APRÈS le bloc dans la file : `9e8` contre `1e9` — relecture Tâche J, tour 1', async () => {
  // ⚠️ **TROU DORMANT SIGNALÉ PAR LE RELECTEUR** (`relecture-J.md`, Important
  // n°2) : retirer `secondes.has(t.key) ? 9e8 : 1e9` au profit de `1e9` partout
  // (`flux-terrain.js:458`) NE CASSAIT AUCUN TEST. Le commentaire du dépôt est
  // clair sur l'intention (« le bloc est ce que l'utilisateur regarde ; le fond
  // marin de la mer lointaine ne doit pas lui passer devant dans la file ») mais
  // aucune des 20 mutations d'origine ne ciblait cette valeur. Ce test-ci vise
  // exactement l'argument passé à `_request`, pas un effet indirect sur la file
  // (`_pump` re-trie de toute façon à chaque tour, donc observer `g.queue` après
  // coup mesurerait le tri, pas la valeur posée ici).
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  const merEmprise = empriseSocle({ centre: CENTRE, tuilesParBloc: 9 })
  const zMer = zoomPourEmprise(merEmprise, { zoomMax: ZOOM_SOCLE, tuilesMax: 25 })
  assert.ok(zMer < ZOOM_SOCLE, `le témoin n a de sens que si le zoom de la mer diffère (z${zMer})`)

  const appels = []
  const requestOrig = g._request.bind(g)
  g._request = (t, priority) => {
    appels.push({ key: t.key, priority })
    requestOrig(t, priority)
  }

  demanderEmprise(flux, { emprise, zoom: ZOOM_SOCLE, aussi: { emprise: merEmprise, zoom: zMer } })

  const duBloc = tuilesEmprise(emprise, ZOOM_SOCLE)
  const clesDuBloc = new Set(duBloc.map(({ z, x, y }) => `${z}/${x}/${y}`))
  const deLaMerSeule = tuilesEmprise(merEmprise, zMer)
    .filter(({ z, x, y }) => !clesDuBloc.has(`${z}/${x}/${y}`))
  assert.ok(deLaMerSeule.length > 0, 'le témoin a besoin de tuiles de mer qui ne recoupent pas le bloc')

  const parClef = new Map(appels.map((a) => [a.key, a.priority]))
  for (const { z, x, y } of duBloc) {
    assert.equal(parClef.get(`${z}/${x}/${y}`), 1e9, `tuile de BLOC ${z}/${x}/${y} doit être demandée à 1e9`)
  }
  for (const { z, x, y } of deLaMerSeule) {
    assert.equal(parClef.get(`${z}/${x}/${y}`), 9e8, `tuile de MER ${z}/${x}/${y} doit être demandée à 9e8, pas 1e9`)
  }
  g.dispose()
})

test('remplirHauteurs DIT si la fusion a eu lieu — sans quoi la mer se croit remplie', async () => {
  // ⚠️ **LE DÉFAUT MUET QUE CE DRAPEAU FERME** : la nappe arrive de façon
  // asynchrone, et `poserMer` ne cuit son champ qu'une fois. Sans un `bathy`
  // honnête, la première cuisson — celle d'avant la nappe — se déclarerait
  // bathymétrique et la mer resterait d'un bleu uniforme pour toujours.
  const g = neuf()
  const flux = creerFlux({ globe: g })
  const emprise = empriseSocle({ centre: CENTRE })
  // aucune nappe demandée : `flux.bathy` est vide
  const sansNappe = remplirHauteurs(flux, { emprise, n: 8 })
  assert.equal(sansNappe.bathy, false, 'sans nappe, la fusion n a PAS eu lieu')
  g.dispose()
})

// ═══════════ LA PORTE DES BANCS — Tâche R26 ══════════════════════
//
// ⛔ **DEUX SONDES ONT ATTENDU 45 s PAR MESURE POUR RIEN, PENDANT TOUTE UNE
// CAMPAGNE.** Elles attendaient `state === 'loading' || state === 'empty'` à
// zéro. Cette condition **ne peut pas arriver** : `demanderEmprise` rend à
// `empty` les tuiles qui sortent de l'emprise du socle, et plus aucun parcours
// ne les touche — elles restent donc `empty` sans que ce soit un défaut.
//
// Les trois tests qui suivent épinglent le départage, dans l'ordre où il a été
// mesuré : la population résiduelle existe, elle n'est demandée par personne,
// elle ne retient aucune place pour de bon, et la porte corrigée la distingue
// de ce qui est vraiment en vol.

test('la porte d origine ne peut PAS se fermer : `demanderEmprise` laisse des `empty` périmées', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  // une première emprise, dont on laisse la file se remplir sans la vider
  demanderEmprise(flux, { emprise: empriseSocle({ centre: CENTRE }) })
  assert.ok(g.queue.length > 0, 'le banc n a pas rempli la file du socle')
  // la caméra bouge : le socle réclame une AUTRE emprise, et l'ancienne sort
  demanderEmprise(flux, { emprise: empriseSocle({ centre: { lat: CENTRE.lat + 3, lon: CENTRE.lon + 3 } }) })

  g.frame += 1 // une image passe : ce qui n'est plus réclamé devient périmé
  const perimees = [...g.tiles.values()].filter((t) => t.state === 'empty' && t.lastUsed !== g.frame)
  assert.ok(perimees.length > 0, 'aucune `empty` périmée : le banc ne reproduit pas le défaut')

  // ⚠️ **LA FORMULE D'ORIGINE, RECOPIÉE ICI TELLE QUELLE** — c'est elle qu'on
  // épingle, pas une paraphrase.
  let ancienne = 0
  for (const t of g.tiles.values()) if (t.state === 'loading' || t.state === 'empty') ancienne++
  assert.ok(ancienne > 0, 'la porte d origine tomberait à zéro : le défaut n est plus reproduit')

  // et ces tuiles-là ne sont demandées par personne : `_bloquee` les reprend au
  // rang 0 de l'éviction, donc elles ne retiennent aucune place pour de bon.
  assert.ok(perimees.every((t) => g._bloquee(t)), 'une `empty` périmée échappe au rang 0 de l éviction')
  g.dispose()
})

test('`tuilesEnVol` compte ce qui vole, et retombe à zéro quand la porte doit s ouvrir', async () => {
  const g = neuf()
  const flux = creerFlux({ globe: g })
  demanderEmprise(flux, { emprise: empriseSocle({ centre: CENTRE }) })
  assert.ok(g.tuilesEnVol() > 0, 'la porte s ouvre alors que le socle part sur le réseau')

  for (let i = 0; i < 400 && g.tuilesEnVol() > 0; i++) await avancer(MS_PAR_IMAGE)
  assert.equal(g.tuilesEnVol(), 0, 'la porte ne se ferme pas une fois le socle arrivé')

  // ⚡ **ET C'EST L'EMPRISE QUI BOUGE EN PLEIN VOL QUI FABRIQUE LA POPULATION**,
  // pas une emprise qui bouge une fois tout arrivé : `_annuler` ne rend à `empty`
  // que ce qui est **encore dans la file**. Une tuile déjà `ready` qui sort de
  // l'emprise reste `ready`. C'est la nuance que le premier jet de ce test avait
  // manquée, et c'est elle qui explique pourquoi le résidu apparaît au
  // CHARGEMENT (le crop se pose pendant que le socle vole encore).
  demanderEmprise(flux, { emprise: empriseSocle({ centre: { lat: CENTRE.lat + 3, lon: CENTRE.lon + 3 } }) })
  demanderEmprise(flux, { emprise: empriseSocle({ centre: { lat: CENTRE.lat + 6, lon: CENTRE.lon + 6 } }) })
  for (let i = 0; i < 600 && g.tuilesEnVol() > 0; i++) await avancer(MS_PAR_IMAGE)
  g.frame += 1
  let ancienne = 0
  for (const t of g.tiles.values()) if (t.state === 'loading' || t.state === 'empty') ancienne++
  assert.equal(g.tuilesEnVol(), 0, 'la porte corrigée reste ouverte après un déplacement d emprise')
  assert.ok(ancienne > 0, 'la porte d origine se fermerait : les deux ne se distinguent plus')
  g.dispose()
})

test('`tuilesEnVol` ne coupe PAS trop tôt : une `empty` FRAÎCHE compte encore', async () => {
  // ⚠️ **C'EST LA MOITIÉ QUI SE CASSE EN SILENCE.** Une porte qui ignorerait
  // toutes les `empty` se fermerait pendant qu'une tuile attend un créneau de
  // file (`PLAFOND_FILE`) ou une sonde de couverture : `_traverse` la
  // redemandera à l'image suivante, donc l'image change encore. Le discriminant
  // est `lastUsed`, et ce test est celui qui le prouve.
  const g = neuf()
  for (let i = 0; i < PLAFOND_FILE + 40; i++) {
    const t = g._ensureTile(10, 520 + i, 360)
    g._request(t, 1)
  }
  const refusees = [...g.tiles.values()].filter((t) => t.state === 'empty')
  assert.ok(refusees.length > 0, 'le banc n a refusé aucune requête : PLAFOND_FILE n a pas mordu')

  // périmées → la porte les ignore
  g.frame += 1
  const enVolSansFraiches = g.tuilesEnVol()
  // le parcours les touche → la porte les compte
  for (const t of refusees) t.lastUsed = g.frame
  assert.equal(
    g.tuilesEnVol(),
    enVolSansFraiches + refusees.length,
    'une `empty` touchée par le parcours courant n est pas comptée comme en vol'
  )
  g.dispose()
})
