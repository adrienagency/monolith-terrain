// TÂCHE R3 — « ON NE CHARGE QUE LES DALLES DU SOCLE »
//
// Adrien, 2026-08-23 : « Tu charges beaucoup trop de dalles. […] Je veux dire
// qu'on ne doit calculer que les dalles qui font partie du socle, et pas ce qui
// est à l'extérieur du socle. »
//
// ---------------------------------------------------------------------------
// CE QUE CE FICHIER GARDE, ET CE QU'IL NE GARDE PAS
// ---------------------------------------------------------------------------
// Deux choses, et elles n'ont pas la même nature :
//
//   ① `cropAttendu` — la descente du quadtree est RETENUE tant que le crop n'a
//      pas été posé. C'est le trou que l'enquête de la tâche a mesuré : sur un
//      chargement réel, **114 des 191 demandes de tuiles partent avant que
//      `poserCrop` ait été appelé**, dont les 64 tuiles z3, c'est-à-dire la
//      planète entière. `_horsCropSeul` ne pouvait rien y faire : sa première
//      ligne rendait `false` tant que `_crop` était `null`.
//
//   ② la CONTRE-PRESSION de file, jusqu'ici enfermée derrière `this.continu`.
//      ⚠️ **Ces trois mécanismes n'avaient JAMAIS été exercés sous
//      `continu: false`** — tout le harnais du crop instancie
//      `globeContinu: true`. Les tests ⑤ à ⑨ sont donc NEUFS, pas un rejeu.
//
// ⛔ **AUCUNE ASSERTION NE LIT LE TEXTE SOURCE.** Ce chantier a vu une mutation
// survivre à 4 082 tests parce qu'une garde était vérifiée par une expression
// régulière sur le fichier. Ici tout se mesure sur un globe qui tourne : des
// URL demandées, des états de tuile, des longueurs de file.
//
// ⛔ **ET CHAQUE GARDE EST PROUVÉE DANS LES DEUX SENS** : le drapeau levé fait
// X, le drapeau baissé fait NON-X, sur le même harnais. Une garde qui ne
// change rien quand on la retire n'est pas une garde.

import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

// ══════════ LE HARNAIS — celui de `test/veille-repos.test.js` ⑦ ═════════════
//
// Un DOM bouché, un réseau qui COMPTE, et une caméra complète : sans
// `projectionMatrix`, le tri spatial n'a rien à trier et le parcours mesuré
// serait l'ancien.

import { encodeTerrarium } from '../src/bathy.js'

const ELEV = 812
const [ER, EG, EB] = encodeTerrarium(ELEV)

const dalles = new Map()
function dalleDe(cote) {
  let d = dalles.get(cote)
  if (!d) {
    d = new Uint8ClampedArray(cote * cote * 4)
    for (let i = 0; i < cote * cote; i++) {
      d[i * 4] = ER; d[i * 4 + 1] = EG; d[i * 4 + 2] = EB; d[i * 4 + 3] = 255
    }
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

const urls = new Set()
function servir() {
  urls.clear()
  globalThis.fetch = async (url) => {
    urls.add(url)
    await new Promise((r) => setTimeout(r, 0))
    return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256 }) }
  }
}

const { Globe, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')
const { _resetDemSource } = await import('../src/dem-source.js')

const LAT = -21.115
const LON = 55.53
const FOV = 30

// ⚠️ **LE ZOOM SE LIT DANS L'URL, ET LES DEUX GABARITS SONT CONNUS** — c'est le
// même départage que `src/dem-source.js` : mapterhorn `/z/x/y.webp`, AWS
// `/terrarium/z/x/y.png`. On compte des DEMANDES RÉELLES, pas des intentions.
function zoomDeUrl(u) {
  const m = /\/(\d+)\/(\d+)\/(\d+)\.(webp|png)(\?|$)/.exec(u)
  return m ? Number(m[1]) : null
}
function zoomsDemandes() {
  const out = new Map()
  for (const u of urls) {
    const z = zoomDeUrl(u)
    if (z === null) continue
    out.set(z, (out.get(z) ?? 0) + 1)
  }
  return out
}

function poserCamera(camera, rayon) {
  latLonToSphere(LAT, LON, rayon, camera.position)
  camera.near = Math.min(Math.max((rayon - R_GLOBE) * 0.2, 0.01), 0.5)
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

async function calme(globe, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!globe.inFlight && !globe.queue.length && !globe._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

/**
 * Rejoue le DÉMARRAGE de l'application, pas son régime de croisière : la caméra
 * est posée d'emblée à l'altitude du bloc et **aucun crop n'est posé**, parce
 * que c'est exactement ce que `main.js` fait pendant que `majSeuilSocle` attend
 * le MNT (`largeurBlocM() > 0`). C'est ce moment-là que la tâche répare.
 */
async function demarrage({ cropAttendu, globeContinu = false, images = 8 }) {
  servir()
  _resetTileMemo()
  _resetDemSource()
  const globe = new Globe({ globeContinu, cropAttendu })
  globe.setVisible(true)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)
  poserCamera(camera, 100.2) // ~12 km : l'altitude du bloc, celle du relevé
  for (let k = 0; k < images; k++) {
    globe.update(camera, 0.016)
    await calme(globe)
  }
  return { globe, camera }
}

// ═══════════════════════════════════════════ ① LA DESCENTE RETENUE ══════════

test('① `cropAttendu` : rien de plus fin que les racines tant que le crop n’est pas posé', async () => {
  const { globe } = await demarrage({ cropAttendu: true })
  const z = zoomsDemandes()
  const fines = [...z.entries()].filter(([niveau]) => niveau > 2)
  assert.deepEqual(
    fines, [],
    `des tuiles plus fines que z2 ont été demandées sans crop posé : ${JSON.stringify(fines)}`,
  )
  assert.ok(z.get(2) > 0, 'les racines z2 elles-mêmes n’ont pas été demandées — le globe serait nu')
  assert.equal(globe._crop, null, 'le harnais a posé un crop : il ne mesure plus le démarrage')
})

test('① bis LE DÉFAUT, SUR LE MÊME HARNAIS : sans le drapeau, la planète entière part', async () => {
  // ⚠️ **C'EST LA PREUVE PAR DÉPLACEMENT DE LA VALEUR.** Une garde qui ne
  // change rien quand on la retire n'est pas une garde ; ce test est le témoin
  // négatif de ① et il DOIT rester rouge si l'on retire `cropAttendu`.
  const { globe } = await demarrage({ cropAttendu: false })
  const z = zoomsDemandes()
  assert.ok(
    (z.get(3) ?? 0) > 16,
    `sans le drapeau on attendait la descente z3 sur toute la planète, on n’a que ${z.get(3) ?? 0} tuiles`,
  )
  assert.equal(globe._crop, null)
})

test('① ter la planète RESTE DESSINÉE pendant l’attente — le piège de la liste d’enfants vide', async () => {
  // ⛔ **CE TEST GARDE UN PIÈGE PRÉCIS, ET IL A ÉTÉ VU AVANT D'ÊTRE ÉCRIT.**
  // Couper dans `_children` au lieu de couper `wantSplit` rend une liste VIDE ;
  // `[].every(…)` vaut `true`, la descente « réussit » dans le vide, et le
  // `return` qui suit saute le dessin de la racine. Le globe deviendrait
  // invisible pendant tout le démarrage, sans une erreur nulle part.
  const { globe } = await demarrage({ cropAttendu: true })
  assert.ok(globe._drawn > 0, 'aucune tuile dessinée : la planète a disparu pendant l’attente du crop')
})

test('② le crop posé, la descente REPART — la retenue n’est pas un blocage', async () => {
  const { globe, camera } = await demarrage({ cropAttendu: true })
  const avant = zoomsDemandes()
  assert.equal([...avant.keys()].filter((z) => z > 2).length, 0)

  globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
  globe.poserCropSeul(true)
  for (let k = 0; k < 40; k++) { globe.update(camera, 0.016); await calme(globe) }

  const apres = zoomsDemandes()
  const profond = Math.max(...apres.keys())
  assert.ok(profond > 2, 'le crop est posé et le globe n’est jamais redescendu — la retenue est un blocage')
  assert.ok(globe._drawn > 0, 'le crop ne dessine rien')
})

// ═══════════════════════════════════ ③ LA CONTRE-PRESSION, SOUS continu:false
//
// ⚠️ **CES TROIS MÉCANISMES N'AVAIENT JAMAIS TOURNÉ SOUS `continu: false`.**
// On les exerce ici à la main, sur la file, sans caméra : c'est le seul moyen
// d'atteindre leurs conditions de déclenchement (256 entrées, un cache plein)
// que la scène réelle n'atteint jamais.

const PLAFOND = 256 // `PLAFOND_FILE` — dupliqué ici EXPRÈS : si la constante
// bouge, ce test doit tomber et faire relire la mesure, pas suivre en silence.

function globeNu({ cropAttendu }) {
  servir()
  _resetTileMemo()
  _resetDemSource()
  // ⚠️ pas de `_pump` réel pendant qu'on remplit : on veut la FILE, pas six
  // requêtes en vol qui la vident sous nos pieds.
  const g = new Globe({ globeContinu: false, cropAttendu })
  g._pump = () => {}
  return g
}

test('③ PLAFOND_FILE : sous `cropAttendu`, la file est bornée et la tuile reste `empty`', () => {
  const g = globeNu({ cropAttendu: true })
  const tuiles = []
  for (let i = 0; i < PLAFOND + 40; i++) {
    // z11 : sous `SEUIL_SOURCE_FINE`, donc `planTuile` répond sans sonde réseau
    const t = g._ensureTile(11, 100 + i, 900)
    tuiles.push(t)
    g._request(t, 1)
  }
  assert.equal(g.queue.length, PLAFOND, `la file a atteint ${g.queue.length}, le plafond est ${PLAFOND}`)
  assert.ok(g._refusFile >= 40, `seulement ${g._refusFile} refus comptés`)
  const refusees = tuiles.filter((t) => t.state === 'empty')
  assert.ok(refusees.length >= 40, 'les tuiles refusées n’ont pas gardé l’état `empty`')
  assert.equal(
    tuiles.filter((t) => t.state === 'loading' && !g.queue.some((e) => e.t === t)).length, 0,
    'une tuile est `loading` sans entrée de file — c’est le fantôme permanent que le plafond existe pour éviter',
  )
})

test('③ bis SANS `cropAttendu` ni `continu`, le plafond n’existe pas — production inchangée', () => {
  const g = globeNu({ cropAttendu: false })
  for (let i = 0; i < PLAFOND + 40; i++) g._request(g._ensureTile(11, 100 + i, 900), 1)
  assert.ok(
    g.queue.length > PLAFOND,
    `la file s’est bornée à ${g.queue.length} sans drapeau : la production a changé`,
  )
  assert.equal(g._refusFile, 0, 'des refus ont été comptés sans drapeau')
})

test('④ `_purgerFile` : sous `cropAttendu`, une entrée périmée sort de la file et revient `empty`', () => {
  const g = globeNu({ cropAttendu: true })
  const vieille = g._ensureTile(11, 300, 900)
  g._request(vieille, 1)
  assert.equal(vieille.state, 'loading')
  g.frame++ // l'image suivante ne la redemande pas : elle est périmée
  const n = g._purgerFile()
  assert.equal(n, 1, `${n} entrée(s) purgée(s) au lieu d’une`)
  assert.equal(g.queue.length, 0)
  assert.equal(vieille.state, 'empty', 'la tuile purgée doit repartir de `empty`, le seul état d’où `_request` sait repartir')
})

test('④ bis SANS `cropAttendu` ni `continu`, la purge ne fait RIEN — production inchangée', () => {
  const g = globeNu({ cropAttendu: false })
  const vieille = g._ensureTile(11, 300, 900)
  g._request(vieille, 1)
  g.frame++
  assert.equal(g._purgerFile(), 0)
  assert.equal(g.queue.length, 1, 'la file a été purgée sans drapeau')
  assert.equal(vieille.state, 'loading')
})

test('④ ter la purge ne touche JAMAIS une tuile PRÊTE, ni une racine', () => {
  // ⚠️ **C'EST LA PROPRIÉTÉ QUI REND `_purgerFile` SÛRE**, et la tâche a
  // consigne de la garder : contrairement à `_rechargeTuiles` (12 à 21 s de
  // rechargement mesurées), elle ne relâche aucune donnée déjà payée.
  const g = globeNu({ cropAttendu: true })
  const prete = g._ensureTile(11, 400, 900)
  g._request(prete, 1)
  prete.state = 'ready'
  prete.heights = new Float32Array(4)
  const racine = g.roots[0]
  racine.state = 'empty'
  g._request(racine, 1)
  g.frame++
  g._purgerFile()
  assert.equal(prete.state, 'ready', 'une tuile prête a été rendue à `empty` par la purge')
  assert.ok(prete.heights, 'les hauteurs d’une tuile prête ont été relâchées')
  assert.ok(g.queue.some((e) => e.t === racine), 'une RACINE a été purgée — toute la descente resterait bloquée derrière elle')
})

test('⑤ rang d’éviction : sous `cropAttendu`, une tuile BLOQUÉE part avant une tuile prête', () => {
  const g = globeNu({ cropAttendu: true })
  g.frame = 10
  const bloquee = g._ensureTile(11, 500, 900)
  bloquee.state = 'error'
  bloquee.lastUsed = 1
  const prete = g._ensureTile(11, 501, 900)
  prete.state = 'ready'
  prete.lastUsed = 9 // plus récente, mais c'est le RANG qui décide, pas le LRU seul

  // budget = tout sauf une : exactement une victime
  g._evictJusqua(g.tiles.size - 1)
  assert.equal(g.tiles.has(bloquee.key), false, 'la tuile bloquée n’a pas été évincée')
  assert.equal(g.tiles.has(prete.key), true, 'la tuile prête a été sacrifiée à la place de la bloquée')
})

test('⑤ bis SANS `cropAttendu` ni `continu`, le rang 0 n’existe pas — production inchangée', () => {
  const g = globeNu({ cropAttendu: false })
  g.frame = 10
  const bloquee = g._ensureTile(11, 500, 900)
  bloquee.state = 'error'
  bloquee.lastUsed = 1
  const prete = g._ensureTile(11, 501, 900)
  prete.state = 'ready'
  prete.lastUsed = 9
  g._evictJusqua(g.tiles.size - 1)
  assert.equal(g.tiles.has(bloquee.key), true, 'une tuile bloquée a été évincée sans drapeau : la production a changé')
  assert.equal(g.tiles.has(prete.key), false, 'sans drapeau, seules les `ready` sont candidates — le classement a changé')
})

test('⑥ la quarantaine suit le rang 0 : une clé abandonnée ne repart pas seule sur le réseau', () => {
  // ⚠️ Corollaire du rang 0, pas un quatrième mécanisme : sans elle, une
  // `error` évincée renaîtrait `empty` et repartirait à l'image suivante.
  const g = globeNu({ cropAttendu: true })
  g.frame = 5
  const t = g._ensureTile(11, 600, 900)
  g._echoue.set(t.key, g.frame)
  g.tiles.delete(t.key)
  const renee = g._ensureTile(11, 600, 900)
  assert.equal(renee.state, 'error', 'une clé en quarantaine doit renaître `error`, jamais `empty`')
  g._request(renee, 1)
  assert.equal(g.queue.length, 0, 'une clé en quarantaine est repartie sur le réseau')
})

test('⑥ bis SANS drapeau, la quarantaine reste inerte — production inchangée', () => {
  const g = globeNu({ cropAttendu: false })
  g.frame = 5
  const t = g._ensureTile(11, 600, 900)
  g._echoue.set(t.key, g.frame)
  g.tiles.delete(t.key)
  const renee = g._ensureTile(11, 600, 900)
  assert.equal(renee.state, 'empty', 'la quarantaine s’est appliquée sans drapeau')
})

// ═══════════════════════════════ ⑦ LE DRAPEAU BAISSÉ NE CHANGE RIEN ══════════

test('⑦ drapeau baissé, sans crop : `_children` rend ses QUATRE enfants, comme avant', () => {
  // ⚠️ **C'EST LA LIGNE QUE LA TÂCHE A DÉPLACÉE, TESTÉE PAR SON EFFET.**
  // `_horsCropSeul` rendait `false` sans condition quand `_crop` valait `null` ;
  // elle rend maintenant `this._cropAttendu && z > ROOT_Z`. Sans le drapeau,
  // c'est le `false` d'avant — donc quatre enfants, et le quadtree ordinaire
  // (`?globe=crans`, la production) ne voit rien du chantier.
  const g = globeNu({ cropAttendu: false })
  assert.equal(g._crop, null)
  assert.equal(g._children(g.roots[0]).length, 4)
  assert.equal(g._horsCropSeul(9, 1, 1), false)
})

test('⑦ bis drapeau LEVÉ, sans crop : `_children` ne fait naître personne', () => {
  const g = globeNu({ cropAttendu: true })
  assert.equal(g._crop, null)
  assert.equal(g._children(g.roots[0]).length, 0, 'des enfants sont nés avant que le crop soit posé')
  assert.equal(g._horsCropSeul(9, 1, 1), true)
  // ⚠️ ET LES RACINES PASSENT : sans elles, plus de planète du tout.
  assert.equal(g._horsCropSeul(2, 1, 1), false, 'une racine a été coupée — le globe serait nu')
})

test('⑦ ter le harnais de démarrage est DÉTERMINISTE — sinon ① et ① bis ne comparent rien', async () => {
  await demarrage({ cropAttendu: false, globeContinu: false })
  const a = [...urls].sort()
  await demarrage({ cropAttendu: false, globeContinu: false })
  const b = [...urls].sort()
  assert.deepEqual(b, a, 'deux démarrages identiques ne demandent pas les mêmes URL')
  assert.ok(a.length > 20, `le harnais ne charge que ${a.length} URL : il ne prouve rien`)
})

// ═══════════════════════════════ ⑧ L'ORBITE — la régression livrée (C1) ══════
//
// ⛔ **CE BLOC EXISTE PARCE QUE LA PREMIÈRE VERSION DE CETTE TÂCHE A LIVRÉ UNE
// RÉGRESSION QU'AUCUN DES 4 131 TESTS DU DÉPÔT NE VOYAIT.** `retirerCrop()`
// rend `_crop` à `null` sur deux chemins nominaux — au-dessus de
// `SEUIL_MORT_M`, et à toute sortie du mode surface. Avec un `cropAttendu` à
// vie, le globe écartait alors tout `z > ROOT_Z` au nom d'un crop qui n'existait
// plus : mesuré dans l'application, `modes.enterOrbit()` rendait **16 tuiles
// dessinées au lieu de 283**.
//
// ⚠️ **LE TEST NE PORTE AUCUN NOMBRE MAGIQUE.** Il rejoue la MÊME scène avec et
// sans le drapeau et exige que les deux dessinent EXACTEMENT les mêmes tuiles :
// c'est la seule forme qui reste vraie si le harnais, la caméra ou les seuils
// changent un jour.

/**
 * Le geste central du produit « une seule Terre » : on est sur le bloc, on
 * remonte à la planète. Le crop est posé, puis RETIRÉ, puis la caméra s'éloigne.
 */
async function puisEnOrbite({ cropAttendu }) {
  servir()
  _resetTileMemo()
  _resetDemSource()
  const globe = new Globe({ globeContinu: false, cropAttendu })
  globe.setVisible(true)
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 1400)

  poserCamera(camera, 100.2)
  globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
  globe.poserCropSeul(true)
  for (let k = 0; k < 12; k++) { globe.update(camera, 0.016); await calme(globe) }

  // le dézoom : exactement ce que `branchement-crop.js` fait au-dessus de
  // `SEUIL_MORT_M` — le crop est retiré, la retenue du repos avec lui.
  globe.poserCropSeul(false)
  globe.retirerCrop()
  assert.equal(globe._crop, null, 'le harnais n’a pas retiré le crop : il ne mesure pas l’orbite')
  poserCamera(camera, 140)
  for (let k = 0; k < 20; k++) { globe.update(camera, 0.016); await calme(globe) }

  const dessinees = new Set()
  for (const t of globe.tiles.values()) if (t.mesh?.visible) dessinees.add(t.key)
  return { globe, dessinees, urls: new Set(urls) }
}

test('⑧ EN ORBITE, crop retiré : le drapeau ne change RIEN au dessin', async () => {
  const avec = await puisEnOrbite({ cropAttendu: true })
  const sans = await puisEnOrbite({ cropAttendu: false })
  assert.deepEqual(
    [...avec.dessinees].sort(), [...sans.dessinees].sort(),
    `orbite : ${avec.dessinees.size} tuiles dessinées avec le drapeau contre ${sans.dessinees.size} sans`,
  )
})

test('⑧ bis EN ORBITE, la planète est ENTIÈRE — pas seize racines', async () => {
  // ⚠️ Le témoin d'échec exact de la régression : si la retenue reste armée,
  // `_drawn` retombe au nombre de racines et rien de plus fin n'est demandé.
  const { globe, urls: vues } = await puisEnOrbite({ cropAttendu: true })
  assert.ok(
    globe._drawn > globe.roots.length,
    `${globe._drawn} tuiles dessinées pour ${globe.roots.length} racines : le globe est cloué à ses racines en orbite`,
  )
  const fines = [...vues].map(zoomDeUrl).filter((z) => z !== null && z > 2)
  assert.ok(fines.length > 0, 'aucune tuile plus fine que z2 n’a été demandée en orbite')
})

test('⑧ ter la retenue ne se RALLUME jamais : elle s’éteint à la PREMIÈRE pose', async () => {
  // ⚠️ **CE N'EST PAS `!this._crop`, ET C'EST TOUT LE CORRECTIF C1.** Une garde
  // écrite « pas de crop en ce moment » rejouerait la régression à l'identique.
  const { globe } = await demarrage({ cropAttendu: true })
  assert.equal(globe._retenueAvantCrop(), true, 'la retenue devrait être armée avant toute pose')
  globe.poserCrop({ centre: { lat: LAT, lon: LON }, zoom: 12, tuilesParBloc: 3 })
  assert.equal(globe._retenueAvantCrop(), false)
  globe.retirerCrop()
  assert.equal(globe._crop, null)
  assert.equal(globe._retenueAvantCrop(), false, 'le retrait du crop a RALLUMÉ la retenue — c’est la régression C1')
})

test('⑨ MNT en panne : le globe reste à ses racines, et c’est la décision écrite', async () => {
  // ⚠️ **CE N'EST PLUS UNE RÉSERVE, C'EST UN COMPORTEMENT TESTÉ.** Sous
  // `?terre=unique`, `poserCrop` n'est appelé qu'une fois `largeurBlocM() > 0` :
  // si le MNT ne vient jamais, il n'est jamais appelé. Le globe reste alors à
  // z2 — c'est ASSUMÉ (le bloc plat est éteint sous ce drapeau, et une planète
  // grossière vaut mieux qu'un hémisphère que personne n'a demandé), mais ça
  // doit être écrit quelque part qui rougisse si ça change.
  const { globe } = await demarrage({ cropAttendu: true, images: 60 })
  assert.equal(globe._crop, null)
  assert.equal(globe._drawn, globe.roots.length)
  assert.equal([...zoomsDemandes().keys()].filter((z) => z > 2).length, 0)
  assert.equal(globe.queue.length, 0, 'le globe demande encore des tuiles en boucle')
})
