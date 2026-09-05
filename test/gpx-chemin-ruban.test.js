// LE CHEMIN DU RUBAN, EXÉCUTÉ DE BOUT EN BOUT — la garde de la Tâche GX4.
//
// ⛔ **SEPT MUTATIONS, DEUX ROUGES** (GX3 ⑧) : commenter l'adoption de scène
// dans `main.js` (M2 — le défaut d'origine d'Adrien, 0 pixel), retirer le
// passage par `_versScene` (M5 — 25 500 sommets laissés en bloc, 0 pixel),
// retirer la caméra (M6), la fabrique du calque ajouté ensuite (M4), le sol lu
// sur le globe (M7) : **4 992 tests verts à chaque fois.** Les gardes lisaient
// du texte (un commentaire les satisfait) ou testaient la fonction pure (elles
// ne voient pas qu'on a cessé de l'appeler).
//
// Ce fichier EXÉCUTE : de vrais points GPX → `setTrack` → `rebuild()` d'un vrai
// `GpxLayer` → les sommets du ruban tel qu'il est envoyé au GPU → confrontés,
// sommet par sommet, à la surface qu'un faux globe DESSINE (un maillage de tuile
// z13 bâti avec la loi de nœud du dépôt). Et les lignes de `main.js` qui posent
// la scène, la caméra et la fabrique sont EXÉCUTÉES sur un vrai gestionnaire —
// extraites du texte, oui, mais une ligne commentée n'est pas extraite, donc
// pas exécutée, donc rouge.
//
// `scripts/banc-gx3-mutations.sh` rejoue les sept mutations contre ce fichier.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { R_GLOBE, EARTH_RADIUS_M, latLonToTile, tileToLatLon, latLonToSphere, sphereToLatLon } from '../src/geo.js'
import { interpolerMaille, segmentsTuile } from '../src/monde/maillage-tuile.js'
import { localCrop, distanceCrop } from '../src/monde/crop-sphere.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { lireExageration } from '../src/monde/exageration-continue.js'
import { poseurPourReconstruction, signatureDessineeCrop } from '../src/monde/sol-globe.js'

// ───────────────────────────────────────────── le DOM minimal, par mandataire
// `GpxLayer` construit son profil, son bandeau, sa bulle ; il dessine dans un
// canvas. Rien de tout ça n'est le sujet : un mandataire répond à tout.
const mesure = /^(client|offset|scroll)(Width|Height|Top|Left)$/
function ctx2d() {
  return new Proxy({}, {
    get(t, k) { if (k in t) return t[k]; if (k === 'measureText') return () => ({ width: 10 }); if (typeof k === 'symbol') return undefined; return () => undefined },
    set(t, k, v) { t[k] = v; return true },
  })
}
function element() {
  const t = { classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, style: {}, children: [], dataset: {}, innerHTML: '', textContent: '' }
  return new Proxy(t, {
    get(t, k) {
      if (k in t) return t[k]
      if (typeof k === 'symbol') return undefined
      if (mesure.test(k)) return 0
      if (k === 'getContext') return () => ctx2d()
      if (k === 'querySelector' || k === 'closest') return () => element()
      if (k === 'querySelectorAll') return () => []
      if (k === 'getBoundingClientRect') return () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
      if (k === 'appendChild' || k === 'append' || k === 'prepend' || k === 'insertBefore') return (c) => c
      return () => undefined
    },
    set(t, k, v) { t[k] = v; return true },
  })
}
// le DOMParser de `parseGpx` : le même shim que test/gpx.test.js
class FauxNoeud {
  constructor(attrs, ele) { this._attrs = attrs; this._ele = ele }
  getAttribute(k) { return this._attrs[k] ?? null }
  querySelector(sel) { return sel === 'ele' && this._ele != null ? { textContent: this._ele } : null }
}
class FauxDoc {
  constructor(text) { this.text = text }
  querySelectorAll(tag) {
    const out = []
    const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>|<${tag}\\b([^>]*)/>`, 'g')
    let m
    while ((m = re.exec(this.text))) {
      const attrs = {}
      for (const a of (m[1] ?? m[3] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]
      out.push(new FauxNoeud(attrs, (m[2] ?? '').match(/<ele>([^<]*)<\/ele>/)?.[1] ?? null))
    }
    return out
  }
  querySelector(sel) { if (sel === 'parsererror') return null; if (sel.includes('name')) { const m = this.text.match(/<name>([^<]*)<\/name>/); return m ? { textContent: m[1] } : null } return null }
}
if (!globalThis.window) globalThis.window = { innerWidth: 1440, innerHeight: 1024, devicePixelRatio: 1, addEventListener() { }, removeEventListener() { } }
if (!globalThis.document) globalThis.document = { createElement: () => element(), body: element(), addEventListener() { }, removeEventListener() { }, querySelector: () => element(), querySelectorAll: () => [] }
if (!globalThis.DOMParser) globalThis.DOMParser = class { parseFromString(t) { return new FauxDoc(t) } }

const { GpxLayer } = await import('../src/gpx.js')
const { GpxLayerManager } = await import('../src/gpx-layers.js')

// ───────────────────────────────────────────── le monde : Chamonix, z13
// Un MNT de 3 × 3 tuiles z13 centré sur Chamonix (le cadrage du tracé de 4 km
// du banc), et un globe qui DESSINE ces mêmes neuf tuiles, chacune avec un
// maillage bâti par la loi de nœud de `_buildMesh` (`latLonToSphere(lat, lon,
// R_GLOBE + h × échelle)`) sur un relief connu `hRelief(lat, lon)`.
const CENTRE = { lat: 45.93, lon: 6.88 }
const Z = 13
const EXAG = 2
const hRelief = (lat, lon) => 1200 + 500 * Math.sin((lat - 45.9) * 220) * Math.cos((lon - 6.85) * 160) + 120 * Math.sin(lon * 700)
const tc = latLonToTile(CENTRE.lat, CENTRE.lon, Z)
const origine = { x: Math.floor(tc.x) - 1, y: Math.floor(tc.y) - 1 }
const largeurTuileM = (40075016.686 * Math.cos((CENTRE.lat * Math.PI) / 180)) / 2 ** Z
const dem = { zoom: Z, size: 768, tilePx: 256, originTileX: origine.x, originTileY: origine.y, extentMeters: 3 * largeurTuileM, meanM: 1400 }
const params = { gpxWidth: 3, gpxGradient: false, gpxMarkers: false, gpxKm: false, gpxVisible: true, hudAccent: '#ff4400', demExaggeration: EXAG, exagPartage: { valeur: EXAG } }
const echelleGlobe = (R_GLOBE / EARTH_RADIUS_M) * EXAG

function fauxGlobe() {
  const tiles = new Map()
  const G = segmentsTuile(Z)
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
    const t = { z: Z, x: origine.x + dx, y: origine.y + dy, key: `${Z}/${origine.x + dx}/${origine.y + dy}`, heights: new Float32Array(4), size: 2, state: 'ready' }
    const pos = new Float32Array((G + 1) * (G + 1) * 3)
    let k = 0
    const v = new THREE.Vector3()
    for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
      const { lat, lon } = tileToLatLon(t.x + i / G, t.y + j / G, Z)
      latLonToSphere(lat, lon, R_GLOBE + hRelief(lat, lon) * echelleGlobe, v)
      pos[k++] = v.x; pos[k++] = v.y; pos[k++] = v.z
    }
    t.mesh = { visible: true, position: new THREE.Vector3(0, 0, 0), geometry: { attributes: { position: { array: pos, count: (G + 1) * (G + 1) } } } }
    tiles.set(t.key, t)
  }
  // le crop : l'emprise du MNT, en mercator normalisé, arrondi nul
  const n = 2 ** Z
  const crop = { cx: (origine.x + 1.5) / n, cy: (origine.y + 1.5) / n, demi: 1.5 / n }
  return {
    tiles, exaggeration: EXAG, _crop: crop,
    // ⚠️ `uCropOn` EN FAIT PARTIE, comme sur le vrai globe (`globe.js`) :
    // `retirerCrop()` l'éteint, et c'est lui qui empêche le ruban de rester
    // coupé sur un socle qui n'existe plus.
    uniforms: { uCropCentre: { value: { x: crop.cx, y: crop.cy } }, uCropDemi: { value: crop.demi }, uCropCoin: { value: 0 }, uCropCoinN: { value: 2 }, uCropOn: { value: 1 } },
    tuilesAvecHauteurs() { const out = [...tiles.values()]; out.trieeFinAbord = true; return out },
    tuilesAvecMaillage() { return [...tiles.values()] },
    // ⚠️ la hauteur RÉSERVÉE (le chemin d'avant GX4) répond autre chose que le
    // maillage : si le ruban se drapait encore dessus, l'écart le dirait
    hauteurDessinee: () => 0,
    // la lecture du maillage : celle du dépôt, empruntée au prototype de Globe
    // serait plus fidèle, mais `globe.js` charge 11 000 lignes de nuanceurs ;
    // la loi est `interpolerMaille` sur les rayons des nœuds, mot pour mot
    hauteurMaillee(lat, lon, candidates) {
      for (const t of candidates || tiles.values()) {
        const nn = 2 ** t.z
        const tt = latLonToTile(lat, lon, t.z)
        const tx = tt.x - t.x, ty = tt.y - t.y
        if (tx < 0 || tx >= 1 || ty < 0 || ty >= 1) continue
        if (!t.mesh?.visible) continue
        const a = t.mesh.geometry.attributes.position.array
        return interpolerMaille(tx, ty, G, (i, j) => { const k = (j * (G + 1) + i) * 3; return (Math.hypot(a[k], a[k + 1], a[k + 2]) - R_GLOBE) / echelleGlobe })
      }
      return null
    },
  }
}

// la fabrique de `main.js` (`faitPoseurGlobe`), même formule d'`echelleBloc`
const fabricant = (globe) => ({ dem, terrain, params, sample }) => poseurPourReconstruction({
  globe, dem, sample,
  echelleBloc: (TERRAIN_SIZE * (dem?.empriseCote > 1 ? dem.empriseCote : 1) / dem.extentMeters) * lireExageration(params),
  actif: true,
})

// le sol du BLOC : franchement FAUX (40 unités sous tout), pour qu'un ruban qui
// s'y draperait au lieu du globe (mutation M7) se voie à des kilomètres
const terrain = { sample: () => -40 }

// un tracé de 4 km en travers du bloc, qui SORT du socle par l'est
const POINTS = []
for (let i = 0; i <= 60; i++) POINTS.push({ lat: 45.915 + 0.0006 * i + 0.004 * Math.sin(i / 5), lon: 6.84 + 0.0026 * i, ele: null })
const GPX = '<gpx><trk><name>Chemin</name><trkseg>' + POINTS.map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"></trkpt>`).join('') + '</trkseg></trk></gpx>'

function calque(globe) {
  const scene = new THREE.Scene()
  const l = new GpxLayer({ scene, camera: new THREE.PerspectiveCamera(), terrain, params, getDem: () => dem })
  l.poserFabricantDePoseur(fabricant(globe))
  l.setTrack(POINTS, 'Chemin')
  l.rebuild()
  return l
}

// la surface DESSINÉE sous un point de la sphère, en mètres — l'oracle
const surfaceSous = (globe, v) => { const ll = sphereToLatLon(v); return globe.hauteurMaillee(ll.lat, ll.lon) }
const ecartM = (globe, v) => { const h = surfaceSous(globe, v); return h == null ? null : (v.length() - R_GLOBE) / echelleGlobe - h }

// ─────────────────────────────────────────────── ① le ruban, sommet par sommet

test('① les sommets du ruban envoyés au GPU sont sur la sphère — et AU-DESSUS de la surface que le globe dessine', () => {
  const globe = fauxGlobe()
  const l = calque(globe)
  assert.ok(l.ruban?.geometry, 'aucun ruban construit')
  const a = l.ruban.geometry.attributes.position.array
  assert.ok(a.length > 3000, `ruban trop court (${a.length / 3} sommets)`)
  let n = 0, min = Infinity, max = -Infinity, moy = 0, horsBloc = 0
  const v = new THREE.Vector3()
  for (let i = 0; i < a.length; i += 3) {
    v.set(a[i], a[i + 1], a[i + 2])
    // ⛔ M1 / M5 : un sommet resté en coordonnées de BLOC est à moins de 40
    // unités de l'origine — 6 371 km du crop
    assert.ok(v.length() > R_GLOBE * 0.9, `sommet ${i / 3} en coordonnées de bloc (rayon ${v.length().toFixed(2)})`)
    const e = ecartM(globe, v)
    if (e == null) { horsBloc++; continue }
    n++; moy += e; if (e < min) min = e; if (e > max) max = e
  }
  moy /= n
  // ⛔ M7 (sol lu sur le bloc : −40 unités) et le défaut de GX3 (sol lu sur des
  // hauteurs que le GPU ne dessine pas) enterrent le ruban : min ≪ 0.
  assert.ok(min >= -0.5, `le ruban passe SOUS la surface dessinée : min ${min.toFixed(2)} m (moy ${moy.toFixed(2)}, max ${max.toFixed(2)})`)
  // et il ne lévite pas : garde + pente + lissage, en unités de bloc converties
  assert.ok(max < 120, `le ruban lévite : max ${max.toFixed(1)} m au-dessus de la surface dessinée`)
  assert.ok(n > 2000, `trop peu de sommets confrontés (${n}, ${horsBloc} hors maillage)`)
})

test('① les SOMMETS DU TRACÉ (tête, curseur, profil) sont à la marge dérivée : 2 m au-dessus du sol dessiné, ni plus ni moins', () => {
  const globe = fauxGlobe()
  const l = calque(globe)
  assert.ok(l._worldScene?.length === POINTS.length, 'pas de jumeau de scène')
  for (let i = 0; i < l._worldScene.length; i++) {
    const e = ecartM(globe, l._worldScene[i])
    if (e == null) continue
    assert.ok(Math.abs(e - 2) < 0.6, `sommet ${i} : ${e.toFixed(2)} m au-dessus de la surface dessinée, attendu 2 m (MARGE_SOL_M)`)
  }
})

// ─────────────────────────────────────────────── ② le bord du socle

test('② le ruban porte le bord du socle : `aMerc` par sommet, rapporté au centre COURANT du crop, et le tracé DÉBORDE bien (sinon la garde ne garde rien)', () => {
  const globe = fauxGlobe()
  const l = calque(globe)
  const q = l.ruban.geometry.attributes.aMerc
  assert.ok(q, 'le ruban n’a pas d’attribut `aMerc` : rien ne l’écrête au bord du socle, il est dessiné dans le vide')
  const p = l.ruban.geometry.attributes.position.array
  let dehors = 0, dedans = 0
  for (let i = 0; i < q.count; i++) {
    // ce que le nuanceur calcule : (mercator − centre) / demi
    let du = q.array[i * 2] - globe._crop.cx; du -= Math.floor(du + 0.5)
    const u = du / globe._crop.demi, v = (q.array[i * 2 + 1] - globe._crop.cy) / globe._crop.demi
    // la même loi que le nuanceur des tuiles (`distanceCrop`, crop-sphere.js)
    const d = distanceCrop(u, v, { coin: 0, expo: 2 })
    if (d > 0) dehors++; else dedans++
    // et l'attribut dit vrai : recalculé depuis la position sur la sphère
    const ll = sphereToLatLon(new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]))
    const loc = localCrop(ll.lat, ll.lon, globe._crop)
    assert.ok(Math.abs(loc.u - u) < 2e-3 && Math.abs(loc.v - v) < 2e-3, `aMerc du sommet ${i} ne correspond pas à sa position (${u.toFixed(4)},${v.toFixed(4)} vs ${loc.u.toFixed(4)},${loc.v.toFixed(4)})`)
  }
  assert.ok(dehors > 100 && dedans > 1000, `le tracé de test doit déborder du socle (dedans ${dedans}, dehors ${dehors})`)
  assert.ok(l.sillage?.geometry.attributes.aMerc, 'le sillage n’a pas de bord de socle')
  assert.equal(l.rubanMat.customProgramCacheKey(), 'ruban-trace-socle', 'le programme du ruban n’est pas la variante qui rejette au bord')
})

// ⛔ **LA GARDE QUI MANQUAIT, ET QUI A COÛTÉ LE TOUR (GX5).** Le test ci-dessus
// vérifie l'attribut posé sur la GÉOMÉTRIE ; il ne regardait pas le NOM que le
// nuanceur déclare. Le produit posait `aMerc` et lisait `aCrop` : WebGL ne
// signale pas un attribut non lié, il rend `(0, 0)` — le CENTRE du socle —
// donc `distanceBordCrop < 0`, donc **aucun fragment n'était jamais écarté**.
// Le `discard` tournait à chaque image sans rien couper, et 154 à 358 px de
// tracé restaient dessinés hors du socle. On confronte donc ici les deux
// listes : tout `attribute` déclaré dans le morceau de nuanceur DOIT exister
// dans la géométrie, et tout `uniform` déclaré doit être fourni — et fourni
// PAR RÉFÉRENCE depuis `globe.uniforms`, sinon le bord ne suit pas le socle
// quand il se recentre.
test('② le nuanceur du bord ne lit QUE des noms qui existent — attributs liés, uniformes partagés avec le globe, discard gaîné par `uCropOn`', () => {
  const globe = fauxGlobe()
  const l = calque(globe)
  const bord = l._glslBordSocle()
  assert.ok(bord, 'aucun morceau de nuanceur de bord alors que le socle est posé')
  const source = bord.vertexDecl + bord.vertexCorps + bord.fragmentDecl + bord.fragmentCorps
  for (const m of source.matchAll(/attribute\s+\w+\s+(\w+)\s*;/g)) {
    assert.ok(l.ruban.geometry.attributes[m[1]], `le nuanceur déclare \`attribute ${m[1]}\` que la géométrie du ruban ne fournit pas : WebGL rendrait (0,0) et le bord ne couperait rien`)
    assert.ok(l.sillage.geometry.attributes[m[1]], `le sillage ne fournit pas \`${m[1]}\``)
  }
  for (const m of source.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)) {
    assert.ok(bord.uniforms[m[1]], `le nuanceur déclare \`uniform ${m[1]}\` qui n'est pas fourni`)
    assert.equal(bord.uniforms[m[1]], globe.uniforms[m[1]], `\`${m[1]}\` est une COPIE de la valeur du globe : le bord se figerait au repère du socle d'avant le recentrage`)
  }
  // et le corps du fragment mesure bien le MERCATOR rapporté au centre courant,
  // pas le mercator absolu (qui vaut ~0,52 · 0,35, donc « dedans » partout)
  assert.match(bord.vertexCorps, /aMerc\.x\s*-\s*uCropCentre\.x/, 'le sommet n’est pas rapporté au centre courant du socle')
  assert.match(bord.vertexCorps, /floor\(\s*\w+\s*\+\s*0\.5\s*\)/, 'pas de repli d’antiméridien : un socle à cheval sur 180° couperait la moitié du ruban')
  assert.match(bord.fragmentCorps, /uCropOn\s*>\s*0\.5\s*&&/, 'le discard n’est pas gaîné par `uCropOn` : le ruban resterait coupé sur un socle retiré')
})

test('② hors globe (`?terre=deux`), rien de tout ça n’existe : pas d’aMerc, même clé de programme qu’avant', () => {
  const scene = new THREE.Scene()
  const l = new GpxLayer({ scene, camera: new THREE.PerspectiveCamera(), terrain: { sample: () => 0.5 }, params, getDem: () => dem })
  l.setTrack(POINTS, 'Chemin')
  l.rebuild()
  assert.equal(l.ruban.geometry.attributes.aMerc, undefined)
  assert.equal(l.rubanMat.customProgramCacheKey(), 'ruban-trace')
  const a = l.ruban.geometry.attributes.position.array
  for (let i = 0; i < a.length; i += 3) assert.ok(Math.hypot(a[i], a[i + 1], a[i + 2]) < TERRAIN_SIZE, 'hors globe, le ruban a quitté le bloc')
})

// ─────────────────────────────────────────────── ③ le re-drapage suit les tuiles dessinées

test('③ le poseur retient l’empreinte des tuiles DESSINÉES, et elle change quand une tuile s’allume ou s’éteint', () => {
  const globe = fauxGlobe()
  const l = calque(globe)
  assert.equal(typeof l._poseur.signature, 'string')
  assert.equal(l._poseur.signature, signatureDessineeCrop(globe), 'l’empreinte retenue n’est pas celle des tuiles dessinées')
  const t = [...globe.tiles.values()][4]
  t.mesh.visible = false
  assert.notEqual(signatureDessineeCrop(globe), l._poseur.signature, 'une tuile éteinte ne change pas l’empreinte : le ruban ne se re-drapera jamais')
  // et une fois re-drapé, le ruban lit le relief SANS cette tuile (repli sur la
  // hauteur réservée, ici 0) : les sommets au-dessus d'elle ont bougé
  const avant = Float32Array.from(l.ruban.geometry.attributes.position.array)
  l.rebuild()
  assert.equal(l._poseur.signature, signatureDessineeCrop(globe))
  const apres = l.ruban.geometry.attributes.position.array
  let bouges = 0
  for (let i = 0; i < apres.length; i += 3) if (Math.abs(apres[i + 1] - avant[i + 1]) > 1e-6) bouges++
  assert.ok(bouges > 0, 'le re-drapage n’a rien changé alors qu’une tuile dessinée a disparu')
})

test('③ sans AUCUNE hauteur réservée mais avec des tuiles dessinées, le ruban reste sur la sphère (pas de repli à plat pendant un recentrage)', () => {
  // ⛔ mesuré : pendant chaque recentrage du socle en vol, `tuilesAvecHauteurs`
  // est vide ; un ruban reconstruit à cet instant tombait sur `poseurPlat` —
  // coordonnées de BLOC dans la scène du globe, 0 pixel pendant 3 relevés.
  const globe = fauxGlobe()
  globe.tuilesAvecHauteurs = () => { const out = []; out.trieeFinAbord = true; return out }
  const l = calque(globe)
  assert.ok(l._poseur?.globe, 'le poseur est retombé à plat alors que le maillage dessiné couvre le tracé')
  const a = l.ruban.geometry.attributes.position.array
  let min = Infinity
  const v = new THREE.Vector3()
  for (let i = 0; i < a.length; i += 3) {
    v.set(a[i], a[i + 1], a[i + 2])
    assert.ok(v.length() > R_GLOBE * 0.9, `sommet ${i / 3} en coordonnées de bloc : le ruban a disparu à 6 371 km`)
    const e = ecartM(globe, v); if (e != null && e < min) min = e
  }
  assert.ok(min >= -0.5, `le ruban passe sous la surface dessinée (${min.toFixed(2)} m)`)
})

// ─────────────────────────────────────────────── ④ les lignes de main.js, exécutées

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ⚠️ une ligne COMMENTÉE ne commence pas par `gpxLayer.` ni `gpxPoseGlobe.` :
// elle n'est pas extraite, donc pas exécutée. C'est ce qui rend M2 et M6
// rouges, là où une garde qui cherche le texte « poserScene » les laissait verts.
const depot = MAIN.match(/^const gpxPoseGlobe = \{[\s\S]*?^\}$/m)?.[0]
const appelsDepot = MAIN.match(/^\s*gpxPoseGlobe\.(setCamera|poserFabricantDePoseur|appliquer)\([^\n]*\)\s*$/gm) ?? []
const adoption = MAIN.match(/^\s*gpxLayer\.poserScene\([^\n]*\)\s*$/gm) ?? []

function gestionnaireCable() {
  const sceneBloc = new THREE.Scene(), sceneGlobe = new THREE.Scene(), camGlobe = new THREE.PerspectiveCamera()
  camGlobe.name = 'camGlobe'
  const globe = fauxGlobe()
  const faitPoseurGlobe = fabricant(globe)
  const gpxLayer = new GpxLayerManager({ scene: sceneBloc, camera: new THREE.PerspectiveCamera(), terrain, params, getDem: () => dem })
  assert.ok(depot, 'le dépôt `gpxPoseGlobe` n’existe plus dans main.js : relire cette garde')
  const code = depot + '\n' + appelsDepot.join('\n') + '\n' + adoption.join('\n') + '\nreturn gpxPoseGlobe'
  const gpxPoseGlobe = new Function('gpxLayer', 'sceneGlobe', 'camGlobe', 'faitPoseurGlobe', code)(gpxLayer, sceneGlobe, camGlobe, faitPoseurGlobe)
  return { gpxLayer, sceneBloc, sceneGlobe, camGlobe, faitPoseurGlobe, gpxPoseGlobe, globe }
}

test('④ M2 — la ligne d’adoption de `main.js`, exécutée : le calque chargé ensuite vit dans `sceneGlobe`', () => {
  const { gpxLayer, sceneGlobe, sceneBloc } = gestionnaireCable()
  const entree = gpxLayer.addLayer(GPX)
  assert.ok(entree, 'addLayer a refusé le GPX de test')
  assert.equal(entree.gpx.group.parent, sceneGlobe,
    'le tracé est resté dans la scène du bloc plat — celle que `passeSurface.enabled = false` a cessé de dessiner : 0 pixel (le défaut d’Adrien)')
  assert.notEqual(entree.gpx.group.parent, sceneBloc)
})

test('④ M6 — la caméra déposée par `main.js`, exécutée : c’est `camGlobe` que le calque reçoit', () => {
  const { gpxLayer, camGlobe } = gestionnaireCable()
  const entree = gpxLayer.addLayer(GPX)
  assert.equal(entree.gpx.camera, camGlobe,
    'le calque mesure ses survols et son curseur avec la caméra du BLOC : `gpxPoseGlobe.setCamera(camGlobe)` n’a pas été exécuté')
})

test('④ M4 — la fabrique déposée suit le calque AJOUTÉ ENSUITE : son ruban est sur la sphère, au-dessus du relief dessiné', () => {
  const { gpxLayer, faitPoseurGlobe, globe } = gestionnaireCable()
  gpxLayer.addLayer(GPX) // le premier
  const second = gpxLayer.addLayer(GPX) // le piège de la tâche 22
  assert.equal(second.gpx._faitPoseur, faitPoseurGlobe, 'le second calque n’a pas reçu la fabrique de poseur')
  const a = second.gpx.ruban.geometry.attributes.position.array
  let min = Infinity
  const v = new THREE.Vector3()
  for (let i = 0; i < a.length; i += 3) {
    v.set(a[i], a[i + 1], a[i + 2])
    assert.ok(v.length() > R_GLOBE * 0.9, `le DEUXIÈME tracé chargé est resté en coordonnées de bloc (sommet ${i / 3})`)
    const e = ecartM(globe, v); if (e != null && e < min) min = e
  }
  assert.ok(min >= -0.5, `le second ruban passe sous la surface dessinée (${min.toFixed(2)} m)`)
})
