// LE CARTOUCHE DIT VRAI, TOUT DE SUITE, ET NE CLAQUE PLUS — Tâche CAR.
//
// VID2 (N3–N5), mesuré à la sonde rAF sur le vol de la vidéo d'Adrien :
//   · N3 les anciennes coordonnées restaient gravées 2,0 à 3,3 s après un cran
//     (47 à 78 images), « Réunion » affiché à Provence 426 ms ;
//   · N4 le cartouche disparaissait 1,1 à 1,8 s à chaque cran ;
//   · N5 il faisait 2× (jusqu'à 4×) la taille des parois pendant WIDENING.
//
// Ce que ce fichier garde :
//   ① `infoImmediate` — ce qu'on sait sans le réseau, et rien d'un autre lieu ;
//   ② `annonce` / `load` — le cartouche change de lieu DANS LA MÊME IMAGE, le
//      réseau ne fait que compléter, et un réseau lent ne ramène jamais un
//      ancien lieu par-dessus un nouveau ;
//   ③ `poseDepuisParois` — la taille du cartouche est celle des parois ;
//   ④ le câblage de `main.js`, LU (aucun test de ce dépôt ne charge `main.js`).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { infoImmediate, lieuConnu, gatherGroundInfo, formatCoord, scaleBar } from '../src/ground-info.js'
import { ancrageCartouche, poseDepuisParois } from '../src/monde/cartouche-globe.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ═══════════════════════════════════════════ ① ce qu'on sait tout de suite

test('① infoImmediate rend les coordonnées et l’échelle, et RIEN d’un autre lieu', () => {
  const i = infoImmediate({ lat: 44.4535, lon: 5.6238, extentMeters: 27354 })
  assert.equal(i.coord, formatCoord(44.4535, 5.6238))
  assert.equal(i.scale, scaleBar(27354))
  assert.equal(i.name, '', 'un lieu jamais vu n’a pas de nom — pas « UNCHARTED », pas l’ancien')
  assert.equal(i.description, '')
  assert.equal(i.elevation, '', 'sans MNT, pas de plage d’altitude inventée')
  assert.equal(i.provisoire, true)
})

test('① sans emprise, pas de barre d’échelle ; avec des stats, la plage d’altitude', () => {
  assert.equal(infoImmediate({ lat: 1, lon: 2 }).scale, '')
  assert.equal(infoImmediate({ lat: 1, lon: 2, extentMeters: 0 }).scale, '')
  const i = infoImmediate({ lat: 1, lon: 2, stats: { minM: 810, maxM: 1240, meanM: 990 } })
  assert.match(i.elevation, /810 – 1,240 m/)
})

test('① le nom est connu tout de suite quand le mémo web a déjà vu la maille', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('nominatim') ? { address: { state: 'Provence-Alpes-Côte d’Azur', country: 'France' } } : {}),
  })
  try {
    assert.equal(lieuConnu(46.123, 6.456), null)
    await gatherGroundInfo({ lat: 46.123, lon: 6.456, dem: null, fetchAnecdote: async () => ({}) })
    const i = infoImmediate({ lat: 46.1234, lon: 6.4561 }) // même maille de 0,01°
    assert.equal(i.name, 'Provence-Alpes-Côte d’Azur')
    assert.equal(i.country, 'France')
    assert.equal(i.provisoire, false)
  } finally {
    globalThis.fetch = orig
  }
})

// ═══════════════════════════════════════════ ② la couche, exécutée

// Un `document` de vingt lignes, le même que damier-cadre.test.js — avec
// `fonts.check` en plus : c'est lui qui autorise le dessin immédiat.
function faitCanvas() {
  const c = { width: 1, height: 1 }
  c.getContext = () => ({
    font: '', textBaseline: '', textAlign: '', fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    measureText: (t) => ({ width: String(t).length * 10 }),
    fillText() {}, beginPath() {}, arc() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, drawImage() {},
  })
  return c
}
let policesLa = true
globalThis.document = { createElement: () => faitCanvas(), fonts: { load: async () => {}, check: () => policesLa } }
const THREE = await import('three')
const { GroundInfoLayer } = await import('../src/ground-info-layer.js')

function faitCouche() {
  return new GroundInfoLayer({ scene: new THREE.Scene(), getBaseY: () => -8, getInk: () => '#222222', getWallInk: () => '#eeeeee', wallsVisible: () => true })
}
const INFO_REUNION = { name: 'Réunion', country: 'France', coord: formatCoord(-21.26, 55.74), coordDMS: '', elevation: 'ELEV 0 – 3,069 m', scale: 'SCALE 0 ─── 5 ─── 10 km', description: 'Une île.', anecdote: '', title: 'La Réunion' }
const texteDes = (c) => c.meshes.length // chaque maille = un plan gravé

test('② annonce : le cartouche change de lieu dans la même image, sans réseau', () => {
  const c = faitCouche()
  c.render(INFO_REUNION)
  assert.equal(c.lastInfo.name, 'Réunion')
  const dessine = c.annonce(44.3425, 5.7777, { extentMeters: 170000 })
  assert.equal(dessine, true)
  assert.equal(c.lastInfo.coord, formatCoord(44.3425, 5.7777), 'les coordonnées sont celles du NOUVEAU lieu')
  assert.equal(c.lastInfo.name, '', '« Réunion » n’est plus gravé nulle part')
  assert.equal(c.lastInfo.scale, scaleBar(170000))
  assert.ok(texteDes(c) > 0, 'des plans sont posés : le cartouche est là, pas caché')
})

test('② annonce sans polices : rien de provisoire, mais l’ancien lieu est EFFACÉ', () => {
  const c = faitCouche()
  c.render(INFO_REUNION)
  policesLa = false
  try {
    assert.equal(c.annonce(44.3425, 5.7777), false)
    assert.equal(c.lastInfo, null)
    assert.equal(texteDes(c), 0, 'aucune maille de La Réunion ne survit')
  } finally {
    policesLa = true
  }
})

test('② annonce du MÊME lieu, déjà complet : on ne regrave pas (pas de clignotement)', () => {
  const c = faitCouche()
  c.render(INFO_REUNION)
  const avant = c.meshes
  assert.equal(c.annonce(-21.26, 55.74, { extentMeters: 27354 }), false)
  assert.equal(c.meshes, avant, 'les plans sont les mêmes objets')
})

test('② load : les coordonnées et les altitudes sont dessinées AVANT que le réseau réponde', async () => {
  const c = faitCouche()
  c.render(INFO_REUNION)
  const orig = globalThis.fetch
  let lacher
  const porte = new Promise((r) => { lacher = r })
  globalThis.fetch = async () => { await porte; return { ok: false, status: 500, json: async () => ({}) } }
  try {
    const dem = { minM: 400, maxM: 2800, meanM: 1200, extentMeters: 27354 }
    const p = c.load(44.4535, 5.6238, dem)
    // ⚠️ AUCUN `await` sur le réseau : on lit tout de suite après l'appel
    assert.equal(c.lastInfo.coord, formatCoord(44.4535, 5.6238), 'coordonnées justes dès l’appel')
    assert.match(c.lastInfo.elevation, /400 – 2,800 m/, 'la plage d’altitude du MNT qui vient d’arriver')
    assert.equal(c.lastInfo.name, '', 'et pas « Réunion »')
    lacher()
    await p
    assert.equal(c.lastInfo.coord, formatCoord(44.4535, 5.6238))
    assert.equal(c.lastInfo.name, 'UNCHARTED SECTOR', 'le réseau a répondu (sans nom) : le repli s’écrit MAINTENANT, pas avant')
  } finally {
    globalThis.fetch = orig
  }
})

test('② un réseau lent ne ramène JAMAIS un ancien lieu par-dessus un nouveau', async () => {
  // Le scénario de la vidéo : cran vers A, le réseau traîne ; cran vers B ;
  // la réponse de A arrive après. Elle doit être jetée.
  const c = faitCouche()
  const orig = globalThis.fetch
  const portes = []
  globalThis.fetch = async () => { const p = new Promise((r) => portes.push(r)); await p; return { ok: false, status: 500, json: async () => ({}) } }
  try {
    const pA = c.load(10.0, 20.0, { minM: 0, maxM: 1, meanM: 0.5, extentMeters: 1000 })
    c.annonce(30.0, 40.0, { extentMeters: 2000 })
    assert.equal(c.lastInfo.coord, formatCoord(30.0, 40.0))
    // ⚠️ les `fetch` de A partent APRÈS le chargement des polices (un tour de
    // microtâches) : on attend qu'ils soient en attente avant de les lâcher
    for (let i = 0; i < 50 && portes.length < 2; i++) await new Promise((r) => setImmediate(r))
    assert.ok(portes.length >= 2, 'le réseau de A n’a pas été sollicité — le scénario n’est pas celui de la vidéo')
    for (const r of portes.splice(0)) r()
    await pA
    assert.equal(c.lastInfo.coord, formatCoord(30.0, 40.0), 'la réponse tardive de A n’a pas écrasé B')
  } finally {
    globalThis.fetch = orig
  }
})

// ═══════════════════════════════════════════ ③ la taille est celle des parois

// Le relevé de cartouche-globe.test.js (La Réunion, 2026-08-31) : l'ancrage par
// la loi et le maillage `crop-parois` sont la même similitude.
const RELEVE = {
  lat: -21.248422235627014, lon: 55.7666015625, extentMeters: 27354.269019739164, span: 56,
  position: [77.05483557224011, -36.24123732749129, 52.43209925138887],
  quaternion: [0.7295304024548144, 0.2640562864582355, -0.3859942726668014, 0.4990672208675199],
  k: 0.007667070940797353,
}

test('③ posé sur les parois, le cartouche fait EXACTEMENT leur largeur', () => {
  const largeur = RELEVE.span * RELEVE.k // la boîte des parois, en unités de globe
  const p = poseDepuisParois({ position: RELEVE.position, quaternion: RELEVE.quaternion, largeur, span: RELEVE.span })
  assert.ok(Math.abs(p.echelle - RELEVE.k) < 1e-15, `échelle ${p.echelle} au lieu de ${RELEVE.k}`)
  assert.deepEqual(p.position, RELEVE.position)
  assert.deepEqual(p.quaternion, RELEVE.quaternion)
  // et c'est bien la même similitude que la loi, prise par l'autre bout
  const a = ancrageCartouche(RELEVE)
  assert.ok(Math.abs(a.echelle - p.echelle) < 1e-15)
})

test('③ ⛔ N5 — des parois restées à l’ANCIEN palier donnent l’ancienne taille, pas 2×', () => {
  // WIDENING z12 → z11 : la fenêtre bornée est déjà à 54 708 m, les parois
  // encore à 27 354 m. Le cartouche doit suivre les parois.
  const anciennes = poseDepuisParois({ position: RELEVE.position, quaternion: RELEVE.quaternion, largeur: 56 * RELEVE.k, span: 56 })
  const loiNouvelle = ancrageCartouche({ ...RELEVE, extentMeters: RELEVE.extentMeters * 2 })
  assert.ok(Math.abs(loiNouvelle.echelle / anciennes.echelle - 2) < 1e-9, 'la loi sur la nouvelle emprise ferait bien 2×')
  assert.ok(Math.abs(anciennes.echelle / RELEVE.k - 1) < 1e-12, 'les parois disent 1×')
})

test('③ sans parois mesurables, on rend null — jamais une échelle inventée', () => {
  assert.equal(poseDepuisParois({ position: [0, 0, 0], quaternion: [0, 0, 0, 1], largeur: 0, span: 56 }), null)
  assert.equal(poseDepuisParois({ position: [0, 0, 0], quaternion: [0, 0, 0, 1], largeur: NaN, span: 56 }), null)
  assert.equal(poseDepuisParois(null), null)
})

// ═══════════════════════════════════════════ ④ le câblage de main.js, LU

test('④ le lieu est annoncé au cartouche là où il est DEMANDÉ (`loadSurface`), avant le vol', () => {
  const i = MAIN.indexOf('async loadSurface(lat, lon, zoom)')
  assert.ok(i > 0, '`loadSurface` a disparu ou changé de forme')
  const corps = MAIN.slice(i, MAIN.indexOf('\n    },', i)).replace(/\/\/[^\n]*/g, '')
  const iAnnonce = corps.indexOf('groundInfo.annonce(lat, lon')
  const iVol = corps.indexOf('entrerEnVol()')
  const iFetch = corps.indexOf('fetchAndBuildDem(')
  assert.ok(iAnnonce > 0, 'le cartouche n’est plus annoncé dans `loadSurface`')
  assert.ok(iAnnonce < iVol && iAnnonce < iFetch, 'l’annonce doit précéder le vol ET le chargement bloquant')
})

test('④ ⛔ N4 — `dem` n’est plus dans le prédicat de visibilité du cartouche', () => {
  const i = MAIN.indexOf('function majCartoucheGlobe(')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  const voulu = corps.match(/const voulu = ([^\n]+)/)?.[1] || ''
  assert.ok(!/\bdem\b/.test(voulu), `le cartouche se cache encore pendant le vol : ${voulu}`)
  assert.ok(/cartoucheAffiche\(\)/.test(voulu), 'la visibilité ne suit plus le crop')
  // et l'extinction d'`entrerEnVol` ne vaut plus qu'hors mode sphère
  const j = MAIN.indexOf('function entrerEnVol(')
  const vol = MAIN.slice(j, MAIN.indexOf('\n}', j)).replace(/\/\/[^\n]*/g, '')
  assert.ok(!/^\s*groundInfo\.setVisible\(false\)/m.test(vol), '`entrerEnVol` cache encore le cartouche sans condition')
})

test('④ ⛔ N5 — l’ancrage et l’échelle lisent les parois d’abord', () => {
  const i = MAIN.indexOf('function majCartoucheGlobe(')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/poseDesParois\(\)/.test(corps), 'le cartouche ne lit plus les parois')
  assert.ok(corps.indexOf('poseDesParois()') < corps.indexOf('ancrageCartouche({'), 'les parois passent avant la loi')
  const j = MAIN.indexOf('function echelleCartouche(')
  const ech = MAIN.slice(j, MAIN.indexOf('\n}', j)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/poseDesParois\(\)/.test(ech), 'la base du cartouche (`getBaseY`) ne suit plus l’échelle des parois')
  const k = MAIN.indexOf('function poseDesParois(')
  const pdp = MAIN.slice(k, MAIN.indexOf('\n}', k)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/poseDepuisParois\(\{/.test(pdp), 'la pose n’est pas calculée par la loi testée')
})
