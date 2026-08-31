// ══════════ L'IMAGERIE SUR LA SURFACE DU GLOBE — Tâche R16 ══════════════════
//
// LE TEST ROUGE DE DÉPART (① et ⑨) : avant cette tâche, le nuanceur du globe ne
// lisait la photo QUE dans le crop (`dedansCrop > 0.0`), et le crop meurt
// au-dessus de 40,3 km — donc aucune photo ne pouvait couvrir un continent.
// Le test ⑨ échoue tant que la surface du globe n'a pas son propre chemin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PhotoMonde, sousFenetre, zoomPhoto, clePhoto,
  urlPhotoMonde, Z_MAX_MONDE, OCTETS_PAR_PHOTO, PLAFOND_PHOTOS,
} from '../src/monde/photo-monde.js'

const GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const AERIAL = readFileSync(new URL('../src/map/aerial-layer.js', import.meta.url), 'utf8')

// une fausse texture, avec son compteur de libérations
const faireTex = (id) => ({ id, disposed: 0, dispose() { this.disposed++ } })

function cacheDeTest(opts = {}) {
  const journal = []
  let t = 0
  const p = new PhotoMonde({
    charger: (z, x, y) => { journal.push(clePhoto(z, x, y)); return Promise.resolve(faireTex(clePhoto(z, x, y))) },
    horloge: () => t,
    ...opts,
  })
  p.setActif(true)
  return { p, journal, avance: (ms) => { t += ms }, maintenant: () => t }
}

// ─────────────────────────────────────────────────────── ① la sous-fenêtre

test('① la sous-fenêtre d’un aïeul de même niveau est l’identité', () => {
  assert.deepEqual(sousFenetre(5, 12, 9, 5), { ox: 0, oy: 0, sx: 1, sy: 1 })
})

test('① la sous-fenêtre RETOURNE l’axe Y — l’UV monte au nord, l’indice y au sud', () => {
  // (z9, x=4, y=4) dans son parent z8 (x=2, y=2) : dx = 0, dy = 0 → quart NORD-ouest.
  // En UV (v monte vers le nord), le quart nord-ouest est ox = 0, oy = 0,5.
  const nw = sousFenetre(9, 4, 4, 8)
  assert.deepEqual(nw, { ox: 0, oy: 0.5, sx: 0.5, sy: 0.5 })
  // (z9, x=5, y=5) : dx = 1, dy = 1 → quart SUD-est → ox = 0,5 et oy = 0.
  const se = sousFenetre(9, 5, 5, 8)
  assert.deepEqual(se, { ox: 0.5, oy: 0, sx: 0.5, sy: 0.5 })
})

test('① les quatre enfants PAVENT exactement le parent, sans trou ni recouvrement', () => {
  const vus = new Set()
  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 2; dy++) {
      const f = sousFenetre(9, 10 + dx, 6 + dy, 8)
      assert.equal(f.sx, 0.5); assert.equal(f.sy, 0.5)
      vus.add(`${f.ox},${f.oy}`)
    }
  }
  assert.deepEqual([...vus].sort(), ['0,0', '0,0.5', '0.5,0', '0.5,0.5'])
})

test('① sur quatre niveaux d’écart, la fenêtre reste dans [0,1] et mesure 1/16', () => {
  for (const [x, y] of [[0, 0], [15, 15], [7, 8], [1023, 4096]]) {
    const f = sousFenetre(12, x, y, 8)
    assert.equal(f.sx, 1 / 16); assert.equal(f.sy, 1 / 16)
    assert.ok(f.ox >= 0 && f.ox + f.sx <= 1 + 1e-12, `ox=${f.ox}`)
    assert.ok(f.oy >= 0 && f.oy + f.sy <= 1 + 1e-12, `oy=${f.oy}`)
  }
})

test('① un aïeul plus FIN que la tuile est une erreur, pas un silence', () => {
  assert.throws(() => sousFenetre(4, 1, 1, 7), /plus fin/)
})

// ─────────────────────────────────────────────────── ② le niveau d’imagerie

test('② `zoomPhoto` PLAFONNE au maximum de la source mondiale, sur TOUTE la plage', () => {
  // ⚠️ PIÈGE ③ DU BRIEF : on ne lit pas la constante, on balaie la plage.
  for (let z = 0; z <= 22; z++) {
    assert.equal(zoomPhoto(z), Math.min(z, Z_MAX_MONDE), `z=${z}`)
    assert.ok(zoomPhoto(z) <= Z_MAX_MONDE)
  }
  // et le plafond n'est pas cosmétique : au-delà, la tuile passe par un aïeul
  assert.equal(zoomPhoto(14), 8)
  assert.equal(sousFenetre(14, 5000, 6000, zoomPhoto(14)).sx, 1 / 64)
})

test('② l’URL mondiale est CARACTÈRE POUR CARACTÈRE celle du registre vérifié', () => {
  // Une constante dupliquée diverge en silence : ce test est le seul lien.
  assert.ok(AERIAL.includes('gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/'))
  assert.ok(urlPhotoMonde(3, 4, 5).includes('gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/'))
  // ⚠️ ET L'ORDRE EST y/x, PAS x/y — WMTS met la LIGNE avant la COLONNE.
  assert.ok(urlPhotoMonde(3, 4, 5).endsWith('/3/5/4.jpeg'))
  // le plafond aussi vient du registre (`maxZoom: 8` de l'entrée nasa)
  assert.ok(/id: 'nasa'[\s\S]{0,120}maxZoom: 8/.test(AERIAL))
  assert.equal(Z_MAX_MONDE, 8)
})

// ────────────────────────────────────────── ③ le grossier d’abord (règle 3)

test('③ tant que rien n’est prêt, la tuile rend `null` — pas de trou, pas de blanc', async () => {
  const { p } = cacheDeTest()
  assert.equal(p.pourTuile({ z: 5, x: 12, y: 9 }, 1), null)
})

test('③ un AÏEUL prêt couvre la tuile AVANT que son propre niveau arrive', async () => {
  const { p } = cacheDeTest()
  // l'aïeul z3 arrive
  p.demander(3, 1, 1, 1)
  await new Promise((r) => setImmediate(r))
  // la tuile z6 n'a pas encore sa photo z6, mais elle est couverte par le z3
  const r = p.pourTuile({ z: 6, x: 8, y: 8 }, 2)
  assert.ok(r, 'l’aïeul devait couvrir')
  assert.equal(r.tex.id, '3/1/1')
  assert.equal(r.sx, 1 / 8)
})

test('③ dès que le niveau visé est prêt, il REMPLACE l’aïeul', async () => {
  const { p } = cacheDeTest()
  p.demander(3, 1, 1, 1)
  await new Promise((r) => setImmediate(r))
  p.pourTuile({ z: 6, x: 8, y: 8 }, 2) // demande le z6
  await new Promise((r) => setImmediate(r))
  const r = p.pourTuile({ z: 6, x: 8, y: 8 }, 3)
  assert.equal(r.tex.id, '6/8/8')
  assert.deepEqual([r.ox, r.oy, r.sx, r.sy], [0, 0, 1, 1])
})

test('③ éteint, le cache ne demande RIEN et ne rend RIEN — le témoin nul', async () => {
  const { p, journal } = cacheDeTest()
  p.setActif(false)
  for (let i = 0; i < 50; i++) assert.equal(p.pourTuile({ z: 6, x: i, y: i }, i), null)
  await new Promise((r) => setImmediate(r))
  assert.equal(journal.length, 0)
  assert.equal(p.stats().demandes, 0)
})

// ──────────────────────────────────────────────── ④ le budget à point fixe

test('④ à saturation, le cache CONTINUE d’accepter — il ne gèle pas (piège ②)', async () => {
  const { p, journal } = cacheDeTest({ plafond: 8, volMax: 64 })
  // on sature avec 8 clés vues à l'image 1
  for (let i = 0; i < 8; i++) p.demander(6, i, 0, 1)
  await new Promise((r) => setImmediate(r))
  p.finImage(1)
  assert.equal(p.taille(), 8)
  // image 2 : la caméra a tourné, huit clés NEUVES
  for (let i = 100; i < 108; i++) p.demander(6, i, 0, 2)
  await new Promise((r) => setImmediate(r))
  p.finImage(2)
  // les neuves sont là, les anciennes sont parties — le cache a TOURNÉ.
  assert.equal(p.taille(), 8)
  assert.ok(journal.includes('6/107/0'), 'les clés neuves n’ont jamais été chargées : le cache a gelé')
  assert.ok(p.stats().evictions >= 8)
})

test('④ une requête qui ne revient JAMAIS ne mange pas sa place pour toujours', async () => {
  // le fantôme : une promesse qui ne se résout ni ne se rejette.
  let t = 0
  const p = new PhotoMonde({
    charger: () => new Promise(() => {}),
    horloge: () => t, plafond: 4, volMax: 8, msAbandon: 1000,
  })
  p.setActif(true)
  for (let i = 0; i < 4; i++) p.demander(6, i, 0, 1)
  p.finImage(1)
  assert.equal(p.stats().enCharge, 4, 'les quatre devaient être en vol')
  // à l'image suivante la caméra a tourné : ces quatre ne sont plus vues
  for (let i = 50; i < 54; i++) p.demander(6, i, 0, 2)
  p.finImage(2)
  assert.equal(p.stats().abandons, 0, 'trop tôt : le délai n’est pas écoulé')
  t += 5000
  p.finImage(3)
  assert.ok(p.stats().abandons >= 4, 'les fantômes doivent être abandonnés')
  assert.ok(p.taille() <= 4, `le cache reste borné : ${p.taille()}`)
})

test('④ une entrée refusée par la file REPART plus tard — elle ne reste pas blanche', async () => {
  const { p, journal } = cacheDeTest({ plafond: 2, volMax: 0 })
  p.demander(6, 1, 0, 1) // entre dans la file
  p.demander(6, 2, 0, 1) // entre dans la file
  p.demander(6, 3, 0, 1) // REFUSÉE : file pleine
  assert.equal(p.stats().refusFile, 1)
  // la file se vide (le vol repart)
  p.volMax = 8
  p.file.length = 0
  p.entrees.get(clePhoto(6, 1, 0)).enFile = false
  p.entrees.get(clePhoto(6, 2, 0)).enFile = false
  p.demander(6, 3, 0, 2) // seconde chance
  await new Promise((r) => setImmediate(r))
  assert.ok(journal.includes('6/3/0'), 'la tuile refusée n’est jamais repartie')
})

// ────────────────────────────────────────────────────── ⑤ la mémoire vidéo

test('⑤ le plafond BORNE la mémoire vidéo, et le chiffre est dérivé, pas annoncé', async () => {
  assert.equal(OCTETS_PAR_PHOTO, 256 * 256 * 4)
  assert.equal(OCTETS_PAR_PHOTO, 262144)
  const { p } = cacheDeTest({ plafond: 16, volMax: 64 })
  // 200 clés vues à l'image 1, puis 200 AUTRES à l'image 2 : l'image 2 ne voit
  // que 200 clés, donc la borne « plafond » doit se refermer sur les 200 d'avant.
  for (let i = 0; i < 200; i++) p.demander(6, i, 0, 1)
  await new Promise((r) => setImmediate(r))
  p.finImage(1)
  for (let i = 500; i < 508; i++) p.demander(6, i, 0, 2)
  await new Promise((r) => setImmediate(r))
  p.finImage(2)
  assert.ok(p.taille() <= 16, `${p.taille()} entrées pour un plafond de 16`)
  assert.ok(p.octetsVideo() <= 16 * OCTETS_PAR_PHOTO, `${p.octetsVideo()} octets`)
  // et le plafond livré tient dans une borne annonçable
  assert.equal(PLAFOND_PHOTOS * OCTETS_PAR_PHOTO, 50331648) // 48,0 Mio
})

test('⑤ LA BORNE EXACTE, DITE SANS FLATTERIE : plafond OU tuiles vues, le plus grand', async () => {
  // ⚠️ **ON NE PUBLIE PAS LA VALEUR LA PLUS FAVORABLE.** L'éviction refuse de
  // toucher ce que l'image courante PORTE — sans quoi elle jetterait la
  // couverture de l'écran et la redemanderait aussitôt (le « point fixe » du
  // piège ②, pris par l'autre bout). Donc si une seule image voyait plus de
  // clés que le plafond, le cache les garderait TOUTES, le temps de cette image.
  // La vraie borne est donc max(plafond, clés vues à une image) — et c'est le
  // nombre de tuiles DESSINÉES par le quadtree qui borne le second terme.
  const { p } = cacheDeTest({ plafond: 4, volMax: 64 })
  for (let i = 0; i < 20; i++) p.demander(6, i, 0, 7)
  await new Promise((r) => setImmediate(r))
  p.finImage(7)
  assert.equal(p.taille(), 20, 'l’image courante porte 20 clés : elles restent')
  // à l'image suivante, plus rien n'est porté → tout retombe au plafond
  p.demander(6, 999, 0, 8)
  await new Promise((r) => setImmediate(r))
  p.finImage(8)
  assert.ok(p.taille() <= 4, `${p.taille()} : la borne ne se referme pas`)
})

test('⑤ une texture évincée est LIBÉRÉE — sinon la borne ne borne rien', async () => {
  const gardees = []
  let t = 0
  const p = new PhotoMonde({
    charger: (z, x, y) => { const tx = faireTex(clePhoto(z, x, y)); gardees.push(tx); return Promise.resolve(tx) },
    horloge: () => t, plafond: 4, volMax: 64,
  })
  p.setActif(true)
  for (let i = 0; i < 4; i++) p.demander(6, i, 0, 1)
  await new Promise((r) => setImmediate(r))
  p.finImage(1)
  for (let i = 50; i < 54; i++) p.demander(6, i, 0, 2)
  await new Promise((r) => setImmediate(r))
  p.finImage(2)
  assert.ok(gardees.filter((t) => t.disposed > 0).length >= 4, 'aucune texture libérée')
})

// ─── ④bis LA CAUSE MESURÉE DU 2026-09-01 : L'ATTENTE MANGEAIT LE PLAFOND ───

test('④bis le plafond compte les TEXTURES, pas les entrées en attente', async () => {
  // ⛔ MESURÉ AU NAVIGATEUR (Alpes, 600 km, 14 s de repos) : 192 entrées pour le
  // plafond, dont **140 en attente et 48 prêtes seulement** — et les tuiles z8
  // peignaient avec l'aïeul z4, quatre niveaux trop grossier, presque noir.
  // Le budget de MÉMOIRE VIDÉO était consommé par des requêtes qui n'avaient pas
  // encore un seul octet en mémoire vidéo.
  let libere = null
  const p = new PhotoMonde({
    charger: () => new Promise((res) => { libere = res }),
    plafond: 4, volMax: 64,
  })
  p.setActif(true)
  for (let i = 0; i < 40; i++) p.demander(6, i, 0, 1) // 40 entrées EN VOL
  p.finImage(1)
  assert.equal(p.pretes(), 0)
  assert.equal(p.octetsVideo(), 0, 'aucune texture : le budget vidéo est nul')
  // …et une 41e clé, prête, doit pouvoir entrer : l'attente ne l'évince pas.
  assert.ok(p.taille() >= 40, 'les entrées en vol ont bien leur place')
  assert.ok(libere, 'le chargeur a bien été appelé')
})

test('④bis la file se PURGE de ce que l’image courante n’a pas demandé', async () => {
  const { p } = cacheDeTest({ plafond: 64, volMax: 0 }) // rien ne part : tout s'empile
  for (let i = 0; i < 30; i++) p.demander(6, i, 0, 1)
  assert.equal(p.file.length, 30)
  p.finImage(1)
  assert.equal(p.file.length, 30, 'l’image 1 les a toutes demandées : on garde')
  // image 2 : la caméra a tourné, seules trois clés sont redemandées
  for (let i = 0; i < 3; i++) p.demander(6, i, 0, 2)
  p.finImage(2)
  assert.equal(p.file.length, 3, `file=${p.file.length} : la purge ne passe pas`)
  // et les 27 autres sont redemandables — pas perdues, juste plus prioritaires
  p.demander(6, 10, 0, 3)
  assert.equal(p.file.length, 4)
})

test('④bis une entrée en attente évincée ne laisse pas de mort dans la file', async () => {
  const { p } = cacheDeTest({ plafond: 2, volMax: 0 })
  p.demander(6, 1, 0, 1)
  p.demander(6, 2, 0, 1)
  p.finImage(1)
  // image 2 : plus personne ne les demande → purge de file puis suppression
  p.finImage(2)
  assert.equal(p.file.length, 0)
  assert.equal(p.taille(), 0, 'une `vide` hors file ne garde pas sa place')
})

// ───────────────────────────────────────── ⑥ ce qui ENTRE dans le cache

test('⑥ une tuile ne demande QUE son aïeul plafonné — pas un niveau par tuile', async () => {
  const { p, journal } = cacheDeTest({ volMax: 64 })
  // 64 tuiles de quadtree z12 sous UNE SEULE tuile d'imagerie z8
  for (let dx = 0; dx < 8; dx++) {
    for (let dy = 0; dy < 8; dy++) p.pourTuile({ z: 12, x: 1600 + dx, y: 2400 + dy }, 1)
  }
  await new Promise((r) => setImmediate(r))
  assert.equal(journal.length, 1, `64 tuiles → ${journal.length} requêtes, on en attend 1`)
  assert.equal(journal[0], '8/100/150')
})

// ─────────────────────────────────── ⑦-⑨ le câblage dans le nuanceur du globe

test('⑦ le sampler de photo est PROPRE À LA TUILE, pas un uniforme partagé de plus', () => {
  // ⚠️ PIÈGE ④ DU BRIEF : « une texture d'imagerie par tuile ne doit PAS en
  // ajouter une par tuile au nuanceur ». Le sampler est UNIQUE dans le
  // programme ; c'est sa VALEUR qui change par matériau, comme `uTex`.
  const iMat = GLOBE.indexOf('this._materialFor = (')
  assert.ok(iMat > 0)
  const bloc = GLOBE.slice(iMat, iMat + 2200)
  assert.ok(/uPhoto: \{ value:/.test(bloc), 'uPhoto doit être déclaré DANS _materialFor (propre à la tuile)')
  assert.ok(/uPhotoUv: \{ value:/.test(bloc), 'uPhotoUv doit être propre à la tuile')
  assert.ok(/uPhotoOn: \{ value:/.test(bloc), 'uPhotoOn doit être propre à la tuile')
  // et surtout PAS dans this.uniforms, qui est partagé par toutes les tuiles
  const iPart = GLOBE.indexOf('this.uniforms = {')
  const partage = GLOBE.slice(iPart, GLOBE.indexOf('this._materialFor'))
  assert.equal(/^\s*uPhoto: \{/m.test(partage), false, 'uPhoto ne doit PAS vivre dans this.uniforms')
})

test('⑧ le compte de samplers du nuanceur du globe reste sous le plafond de 16', () => {
  // Le compte exact est verrouillé par test/crop-eclairage.test.js (⑤f) ; ici on
  // vérifie seulement qu'on n'a pas franchi le plafond matériel.
  const i = GLOBE.indexOf('const FRAG')
  const frag = GLOBE.slice(i, GLOBE.indexOf('this._materialFor'))
  const n = (frag.match(/uniform sampler2D /g) || []).length
  assert.ok(n <= 16, `${n} samplers pour un plafond de 16`)
  assert.ok(/uniform sampler2D uPhoto;/.test(frag), 'le sampler de la surface manque')
})

test('⑨ LE TEST ROUGE : la photo de la SURFACE ne dépend pas de `dedansCrop`', () => {
  // Avant R16, la seule lecture de photo du globe était sous `dedansCrop > 0.0`
  // — donc invisible dès que le crop meurt (au-dessus de 40,3 km), donc jamais
  // sur un continent. Il doit exister une lecture de photo HORS de cette garde.
  const i = GLOBE.indexOf('uPhotoOn > 0.5')
  assert.ok(i > 0, 'aucun chemin de photo sur la surface du globe')
  // la ligne qui la mélange ne doit pas être bornée par dedansCrop > 0
  const bloc = GLOBE.slice(i, i + 3000)
  assert.ok(/texture2D\(\s*uPhoto/.test(bloc), 'uPhoto n’est jamais lu')
  assert.equal(/dedansCrop\s*>\s*0\.0/.test(bloc.slice(0, bloc.indexOf('texture2D'))), false,
    'la photo de surface est encore enfermée dans le crop')
})

test('⑨ et elle CÈDE la place au crop là où le crop peint — pas de double couche', () => {
  const i = GLOBE.indexOf('uPhotoOn > 0.5')
  const bloc = GLOBE.slice(i, i + 3000)
  assert.ok(/1\.0 - dedansCrop/.test(bloc),
    'hors garde : la surface repeindrait par-dessus l’orthophoto du crop')
})
