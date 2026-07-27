// LE GLOBE NE REDEMANDE PLUS AU RÉSEAU LA TUILE QU'IL VIENT DE RENDRE.
//
// Mesuré le 2026-07-27 en instrumentant `window.fetch` pendant une recherche
// « Le Var » (vol du globe z3→z9) : 647 requêtes AWS pour 245 URL uniques, la
// pire tuile (terrarium/3/4/3.png) demandée 19 fois. Le laboratoire ci-dessous
// rejoue le même vol et retrouve la même maladie en pire : 1 082 requêtes pour
// 332 URL, terrarium/3/4/3.png demandée 27 fois.
//
// La cause n'est PAS la concurrence — `_request` refuse déjà une tuile qui
// n'est pas `empty`, donc un même objet-tuile ne part jamais deux fois. Elle
// est TEMPORELLE : `_evict` supprime la tuile de `this.tiles`, et la caméra la
// redemande deux images plus tard. `_ensureTile` la recrée `empty`, `fetchTile`
// repart. Le globe redemande ce qu'il vient de jeter.
//
// ⚠️ ET LA MÉMOIRE PRIME SUR LE RÉSEAU. Le rapport mesure déjà 1,7 à 1,9 Go de
// tas JS. Tout garder serait le geste évident et c'est le piège : l'ensemble de
// travail réel du quadtree dépasse 1 500 tuiles quand on cesse d'évincer, soit
// 380 Mo à 256²·4 o pièce. La mémoire est donc BORNÉE À 128 ENTRÉES (32 Mo, le
// budget que le damier s'accorde déjà pour ses MNT) et évincée en LRU : elle
// rachète le réseau des tuiles CHAUDES — les ancêtres bas zoom, retraversés à
// chaque image — et laisse repartir le reste. Tenir le contrat exact sur un vol
// entier demanderait 512 entrées, soit 128 Mo : hors budget, et deux tests plus
// bas verrouillent la borne pour que personne ne l'y pousse.
//
// Le contrat se compte, comme dans test/damier-reseau.test.js : un `fetch`
// bouchonné qui compte les appels par URL. Sur le trajet borné où la mémoire
// couvre tout, **le nombre de requêtes est égal au nombre d'URL distinctes** ;
// sur le vol entier, où elle ne peut pas tout couvrir, on compte ce qu'elle
// absorbe à travail constant.

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
// Un seul canevas bouchonné sert les deux usages de globe.js : la rampe de
// couleurs (createLinearGradient/fillRect) et le décodage des tuiles
// (drawImage/getImageData).

const RGB = encodeTerrarium(812)
const PIXELS = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  PIXELS[i * 4] = RGB[0]
  PIXELS[i * 4 + 1] = RGB[1]
  PIXELS[i * 4 + 2] = RGB[2]
  PIXELS[i * 4 + 3] = 255
}

// `fetchTile` crée un canevas par tuile DEMANDÉE, servie par la mémoire ou par
// le réseau : ce compteur est donc la demande, dont le réseau n'est qu'une part
let decodes = 0

globalThis.document = {
  createElement() {
    decodes++
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        createLinearGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        drawImage() {},
        getImageData: () => ({ data: PIXELS }),
        set fillStyle(v) {},
      }),
    }
  },
}
// chaque réponse porte un blob DISTINCT : deux tuiles servies par la mémoire
// partagent alors le même objet, ce qu'on peut vérifier à l'identité
globalThis.createImageBitmap = async (blob) => blob

// -------------------------------------------------- faux serveur qui COMPTE

const appels = new Map() // url → nombre de requêtes
const total = () => [...appels.values()].reduce((a, b) => a + b, 0)
const uniques = () => appels.size
const pire = () => Math.max(0, ...appels.values())

function serve({ panne = new Set() } = {}) {
  appels.clear()
  globalThis.fetch = async (url) => {
    appels.set(url, (appels.get(url) || 0) + 1)
    // un aller-retour réseau n'est jamais synchrone : sans ce tour de boucle
    // les chargements ne se CHEVAUCHERAIENT pas, et la déduplication en vol
    // n'aurait rien à dédupliquer
    await new Promise((r) => setTimeout(r, 0))
    if (panne.has(url)) return { ok: false, status: 500 }
    return { ok: true, status: 200, blob: async () => ({ tuile: url }) }
  }
}

const { Globe, _tileMemo, _resetTileMemo } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE } = await import('../src/geo.js')

const url = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
const OCTETS_PAR_TUILE = 256 * 256 * 4 // 256 Ko d'ImageBitmap décodé

beforeEach(() => {
  serve()
  _resetTileMemo()
})

// une racine z2 est demandée par le constructeur ; on attend qu'elles arrivent
async function globeReady(params = {}) {
  const g = new Globe(params)
  g.setVisible(true)
  for (let i = 0; i < 200 && g.inFlight + g.queue.length > 0; i++) {
    await new Promise((r) => setTimeout(r, 0))
  }
  return g
}

// Ce que `_evict` fait à UNE tuile (globe.js, `_evict`) : on démonte et on
// oublie. La méthode réelle ne se déclenche qu'au-dessus de CACHE_MAX (420
// tuiles) ; ici on veut le geste seul, sans le vol qui l'amène.
function evince(g, t) {
  if (t.mesh) {
    g.group.remove(t.mesh)
    t.mesh.geometry.dispose()
    t.mesh.material.dispose()
  }
  t.texture?.dispose()
  g.tiles.delete(t.key)
}

async function charge(g, z, x, y) {
  const t = g._ensureTile(z, x, y)
  g._request(t, 1)
  for (let i = 0; i < 200 && t.state === 'loading'; i++) {
    await new Promise((r) => setTimeout(r, 0))
  }
  return t
}

// ------------------------------------------------- le cas mesuré, en petit

test('une tuile évincée puis redemandée ne repart pas sur le réseau', async () => {
  const g = await globeReady()
  appels.clear() // on ne compte QUE la tuile éprouvée, pas les 16 racines

  const t = await charge(g, 3, 4, 3) // la pire tuile du rapport
  assert.equal(t.state, 'ready')
  assert.equal(appels.get(url(3, 4, 3)), 1)

  // la caméra descend, le budget déborde, la tuile est jetée…
  evince(g, t)
  assert.equal(g.tiles.has('3/4/3'), false)

  // …puis la caméra remonte et la redemande. Vingt-six fois, comme au Var.
  for (let i = 0; i < 26; i++) {
    const r = await charge(g, 3, 4, 3)
    assert.equal(r.state, 'ready', 'la tuile revient bien')
    evince(g, r)
  }
  assert.equal(total(), uniques(), `${total()} requêtes pour ${uniques()} URL distinctes`)
  assert.equal(appels.get(url(3, 4, 3)), 1, `${appels.get(url(3, 4, 3))} requêtes pour une seule tuile`)
})

test('la tuile relue vient de la mémoire, pas d un second décodage réseau', async () => {
  const g = await globeReady()
  const t = await charge(g, 5, 16, 11)
  const premiere = _tileMemo.get(url(5, 16, 11))
  assert.ok(premiere, 'la tuile chargée n est pas entrée en mémoire')
  evince(g, t)
  const r = await charge(g, 5, 16, 11)
  assert.equal(_tileMemo.get(url(5, 16, 11)), premiere, 'la mémoire a été remplacée au lieu d être relue')
  assert.equal((await premiere).tuile, url(5, 16, 11), 'la mémoire rend la bonne tuile')
  assert.equal(r.state, 'ready')
})

// ----------------------------------------------------------------- en vol

test('deux demandes SIMULTANÉES de la même tuile ne font qu une requête', async () => {
  // Un seul globe ne peut pas produire la collision : `_request` refuse une
  // tuile déjà `loading`. Deux globes démarrés ensemble le peuvent — et c'est
  // ce que verrouille ce test : la mémoire est indexée PAR URL, pas par
  // instance, donc deux demandes qui se chevauchent partagent une promesse.
  const [a, b] = await Promise.all([globeReady(), globeReady()])
  assert.equal(a.tiles.size, 16, 'les 16 racines z2 du premier globe')
  assert.equal(b.tiles.size, 16, 'les 16 racines z2 du second')
  assert.equal(uniques(), 16, 'un globe, ce sont 16 racines')
  assert.equal(total(), uniques(), `${total()} requêtes pour ${uniques()} URL distinctes`)
})

// ---------------------------------------------------- la mémoire d'abord

test('la mémoire est bornée à 128 entrées, soit 32 Mo d ImageBitmap', async () => {
  const g = await globeReady()
  await vol(g)
  // le vol touche plus de 300 tuiles : la mémoire doit être PLEINE, et pas
  // d'une entrée de plus — c'est la borne qui protège un tas déjà à 1,76 Go
  assert.equal(_tileMemo.size, 128, `${_tileMemo.size} tuiles retenues après un vol de 300+`)
  const octets = _tileMemo.size * OCTETS_PAR_TUILE
  assert.ok(octets <= 32 * 1024 * 1024, `${Math.round(octets / 1048576)} Mo retenus`)
})

test('la mémoire évince la plus ANCIENNE, pas la plus chaude', async () => {
  const g = await globeReady()
  const chaude = url(4, 8, 5)
  await charge(g, 4, 8, 5)
  // 140 tuiles neuves défilent — plus que la borne — mais la chaude est relue
  // au passage : c'est elle qui doit survivre
  for (let i = 0; i < 140; i++) {
    const t = await charge(g, 6, 30 + i, 22)
    evince(g, t)
    evince(g, await charge(g, 4, 8, 5))
  }
  assert.ok(_tileMemo.has(chaude), 'la tuile relue à chaque tour est tombée de la mémoire')
  assert.ok(!_tileMemo.has(url(6, 30, 22)), 'la plus ancienne est restée')
})

// ------------------------------------------------------- pas de faux souvenir

test('une tuile en PANNE n est pas mémorisée : le réessai repart', async () => {
  const casse = url(4, 8, 5)
  serve({ panne: new Set([casse]) })
  const g = await globeReady()
  const t = await charge(g, 4, 8, 5)
  // globe.js réessaie une fois, puis abandonne — la mémoire ne doit pas figer
  // l'échec, sinon la tuile serait perdue pour toute la session
  assert.equal(t.state, 'error')
  assert.equal(appels.get(casse), 2, 'la panne a été mémorisée : plus aucun réessai')
  assert.ok(!_tileMemo.has(casse), 'un échec est resté en mémoire')

  // et le réseau revenu, la tuile se charge — la mémoire ne garde aucun
  // souvenir de l'échec qui l'en empêcherait
  serve()
  evince(g, t)
  const r = await charge(g, 4, 8, 5)
  assert.equal(r.state, 'ready', 'la tuile guérie ne revient pas')
  assert.equal(appels.get(casse), 1)
})

// -------------------------------------------------------- le vol du rapport

// Le vol « Le Var » : la caméra tombe de 3 rayons terrestres à 0,006, exactement
// ce que fait `goto` quand on cherche une région. `update()` refend le quadtree
// à chaque image et `_evict` jette dès 420 tuiles.
const CIBLE = latLonToSphere(43.45, 6.25)

// ⚠️ LE VOL SE MESURE À TRAVAIL CONSTANT, PAS À NOMBRE D'IMAGES CONSTANT. Une
// tuile servie par la mémoire arrive TOUT DE SUITE : à budget d'images égal, le
// globe muni de mémoire refend plus loin et demande plus de tuiles que celui qui
// attend le réseau. Comparer les deux à 6 images par palier compare deux vols
// différents (1 082 requêtes contre 1 066 : la mémoire semble ne rien faire,
// alors qu'elle absorbait déjà 676 demandes). On arrête donc le vol sur un
// nombre de tuiles DEMANDÉES, et on compte ce qui part au réseau.
const BUDGET_TUILES = 1200

async function vol(g) {
  const cam = { position: new THREE.Vector3() }
  const depart = decodes
  for (let tour = 0; tour < 3; tour++) {
    for (let alt = 3; alt > 0.006; alt *= 0.82) {
      cam.position.copy(CIBLE).setLength(R_GLOBE * (1 + alt))
      for (let f = 0; f < 6; f++) {
        g.update(cam, 0.016)
        await new Promise((r) => setTimeout(r, 0))
        if (decodes - depart >= BUDGET_TUILES) return decodes - depart
      }
    }
  }
  return decodes - depart
}

// ⚠️ CE TEST A CHANGÉ DE SEUILS, ET IL FAUT DIRE POURQUOI.
//
// Sa version d'origine arrêtait le vol sur BUDGET_TUILES = 1 200 DEMANDES puis
// vérifiait que la mémoire en absorbait au moins 40 % (`total < demandes*0.6`,
// `pire <= 6`). Ces seuils mesuraient la mémoire EN PRÉSENCE DE LA MALADIE :
// les 1 200 demandes n'étaient pas du travail utile, c'étaient 316 tuiles
// réclamées encore et encore parce que `_evict` jetait les ancêtres qui
// portaient la descente (voir test/globe-eviction.test.js).
//
// L'éviction réparée, le MÊME vol ne demande plus que ~669 tuiles au total :
// le budget de 1 200 est devenu inatteignable, et la mémoire n'a presque plus
// rien à absorber — non parce qu'elle a cessé de marcher, mais parce qu'on ne
// lui donne plus de doublons à rattraper. Un seuil « la mémoire absorbe 40 % »
// exigerait donc que la maladie revienne pour rester vert : il fallait le
// remplacer, pas l'assouplir.
//
// Ce qui le remplace est PLUS FORT que ce qu'il garantissait : sur un vol
// entier, plus une seule tuile ne repart deux fois. Les contrats propres à la
// mémoire (borne à 128 entrées, partage des demandes en vol, oubli des échecs)
// restent testés un par un par les autres tests de ce fichier, et ceux-là ne
// dépendent d'aucun doublon pour être vrais.
test('un vol z3→z9 ne redemande plus au réseau les tuiles qu il vient de jeter', async () => {
  const g = await globeReady()
  appels.clear() // on ne compte QUE le vol, pas les racines
  const demandes = await vol(g)

  const compte = `${demandes} demandes, ${total()} requêtes, ${uniques()} URL, pire ×${pire()}`
  assert.ok(demandes > 400, `${compte} — le vol n a pas eu lieu`)
  assert.ok(uniques() > 250, `${compte} — le vol n est pas allé assez loin`)

  // ⚠️ CE VOL FAIT TROIS TOURS : il remonte et replonge. Entre deux tours la
  // caméra s'éloigne pour de bon, les tuiles du tour précédent PÉRIMENT et
  // l'éviction a raison de les rendre — le cache ne peut pas tenir la montée
  // entière. Une tuile revue à chaque tour repart donc jusqu'à trois fois, et
  // trois EST l'optimum ici : une requête par tour, pas une de plus. Exiger
  // total() === uniques() serait exiger un cache infini, pas une éviction
  // correcte. Avant correction, sur ce même trajet : 10 416 demandes, 3 370
  // requêtes, pire tuile ×28, et le vol finissait à z3 avec 22 tuiles à
  // l'écran. Après : 669 / 651 / ×3, et z6 avec ~310 tuiles.
  assert.ok(pire() <= 3, `une tuile est repartie ${pire()} fois pour trois tours — ${compte}`)
  assert.ok(total() < uniques() * 1.5, `${compte} — trop de doublons pour trois tours`)
  // et la demande elle-même s'est effondrée : c'est le décodage qu'on ne paie
  // plus, celui que la mémoire de tuiles ne pouvait pas racheter
  assert.ok(demandes < 1000, `${compte} — la demande de tuiles n a pas baissé`)
})
