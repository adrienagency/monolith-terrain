// L'ANALYSE DE RELIEF ET LE MASQUE DE MER SORTENT DU FIL PRINCIPAL.
//
// Mesuré sur MNT réel 1536² : analyzeDem 387 ms + buildSeaMask/blurMask 81 ms =
// ~470 ms de fil principal FIGÉ à chaque reconstruction du bloc central en mode
// Naturel. Le calcul ne devient pas plus court en migrant — il cesse de geler
// l'onglet. Ce n'est pas la durée qui gêne l'utilisateur, c'est le gel.
//
// Ce fichier verrouille trois choses, dans l'ordre de ce qui peut faire mal :
//   1. l'IDENTITÉ BIT À BIT du calcul déporté (sinon la carte change d'image) ;
//   2. la PÉREMPTION — un résultat périmé ne doit jamais se poser, et un
//      résultat encore valide doit se poser. Les DEUX bords, parce qu'une
//      invalidation trop large est un bug aussi coûteux qu'une trop laxiste ;
//   3. le REPLI sur le fil principal quand le Worker ne démarre pas.
//
// Aucun Worker n'est lancé ici : node:test n'en a pas besoin, et c'est
// justement le point — le calcul est un module pur, le transport est ailleurs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeDem } from '../src/terrain-analysis.js'
import { buildSeaMask, blurMask } from '../src/sea-mask.js'
import { computeTerrainJob, jobStillValid, scheduleTerrainJob, runTerrainJob, cancelTerrainJobs, resetTerrainTransport } from '../src/terrain-jobs.js'

// ---------------------------------------------------------------------------
// Plusieurs MODÈLES D'ÉLÉVATION, pas un seul : le rapport de référence a mesuré
// sur des MNT AWS terrarium alors que l'app sert Mapterhorn, plus riche en
// hautes fréquences. L'identité doit tenir sur toutes les familles de relief,
// pas sur celle qui se trouvait sous la main.
const MODELES = {
  // massif : tout au-dessus de la mer, crêtes marquées (le cas Chamonix)
  montagne(size = 64) {
    const data = new Float32Array(size * size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) data[y * size + x] = 1400 + 300 * Math.sin(x / 9) * Math.cos(y / 7) + 60 * Math.sin(x / 2.3)
    return { data, size, metersPerPixel: 13.3 }
  },
  // côte : la moitié ouest sous 0 m et touchant le bord → vraie mer (Arcachon)
  cote(size = 64) {
    const data = new Float32Array(size * size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) data[y * size + x] = (x - size * 0.45) * 3.5 + 8 * Math.sin(y / 5)
    return { data, size, metersPerPixel: 19.1 }
  },
  // polder : cuvette sous 0 m qui NE touche PAS le bord → terre, pas mer.
  // C'est le cas qui distingue un seuil d'altitude d'un test topologique.
  polder(size = 64) {
    const data = new Float32Array(size * size)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - size / 2, y - size / 2)
        data[y * size + x] = d < 12 ? -4 : 30 + 5 * Math.sin(d / 3)
      }
    return { data, size, metersPerPixel: 9.5 }
  },
  // plateau strictement plat : le cas dégénéré (échelle robuste nulle, pentes
  // nulles). S'il diverge, c'est que le déporté ne fait pas le même calcul.
  plateau(size = 32) {
    return { data: new Float32Array(32 * 32).fill(120), size: 32, metersPerPixel: 25 }
  },
}

function reference(dem, { maxSize = 0, landMask = null } = {}) {
  return { a: analyzeDem(dem, { maxSize }), m: blurMask(buildSeaMask(dem, { landMask }), 1) }
}

for (const [nom, faire] of Object.entries(MODELES)) {
  test(`computeTerrainJob rend EXACTEMENT analyzeDem + buildSeaMask — ${nom}`, () => {
    const dem = faire()
    const { a, m } = reference(dem)
    const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 0, landMask: null })
    assert.equal(got.analysisSize, a.size)
    assert.equal(got.analysis.length, a.rgba.length)
    for (let i = 0; i < a.rgba.length; i++) assert.equal(got.analysis[i], a.rgba[i], `${nom} : analyse, octet ${i}`)
    assert.equal(got.seaSize, m.size)
    assert.equal(got.sea.length, m.mask.length)
    for (let i = 0; i < m.mask.length; i++) assert.equal(got.sea[i], m.mask[i], `${nom} : masque de mer, octet ${i}`)
  })
}

test("computeTerrainJob respecte le plafond d'analyse des dalles voisines", () => {
  const dem = MODELES.montagne()
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 32, landMask: null })
  assert.equal(got.analysisSize, 32)
  const ref = analyzeDem(dem, { maxSize: 32 })
  for (let i = 0; i < ref.rgba.length; i++) assert.equal(got.analysis[i], ref.rgba[i], `octet ${i}`)
})

test('computeTerrainJob transporte la landMask — le polder reste de la terre', () => {
  const dem = MODELES.cote()
  const landMask = new Uint8Array(dem.size * dem.size).fill(255) // tout est terre
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 0, landMask })
  const ref = blurMask(buildSeaMask(dem, { landMask }), 1)
  for (let i = 0; i < ref.mask.length; i++) assert.equal(got.sea[i], ref.mask[i], `octet ${i}`)
  assert.ok(got.sea.every((v) => v === 0), 'une landMask pleine ne laisse aucune mer')
})

test("withAnalysis: false ne cuit QUE le masque de mer", () => {
  // le masque côtier arrive après le relief et ne change que la mer : recuire
  // les ~10 flous de l'analyse pour rien coûterait 387 ms au Worker.
  const dem = MODELES.cote()
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, withAnalysis: false })
  assert.equal(got.analysis, null)
  assert.equal(got.analysisSize, 0)
  const ref = blurMask(buildSeaMask(dem, { landMask: null }), 1)
  for (let i = 0; i < ref.mask.length; i++) assert.equal(got.sea[i], ref.mask[i], `octet ${i}`)
})

// ---------------------------------------------------------------------------
// PÉREMPTION — les deux bords.
//
// Le piège coûteux est le compteur d'invalidation GLOBAL, incrémenté à chaque
// reconstruction : il périme des résultats encore justes. L'analyse et le
// masque de mer ne dépendent QUE des altitudes brutes, de la landMask et du
// plafond — ni de l'exagération, ni de la résolution du maillage, ni de la
// palette. Un coup de curseur d'exagération relance rebuild() mais NE périme
// PAS le calcul en vol : il doit se poser.

const dem1 = { data: new Float32Array(4), size: 2, metersPerPixel: 10 }
const dem2 = { data: new Float32Array(4), size: 2, metersPerPixel: 10 }

test('périmé : un changement de MNT (zoom, autre lieu) invalide', () => {
  assert.equal(jobStillValid({ dem: dem1, landMask: null, maxSize: 0 }, { dem: dem2, landMask: null, maxSize: 0 }), false)
})

test("périmé : un changement de landMask (arrivée du trait de côte) invalide", () => {
  const lm = new Uint8Array(4)
  assert.equal(jobStillValid({ dem: dem1, landMask: null, maxSize: 0 }, { dem: dem1, landMask: lm, maxSize: 0 }), false)
})

test("périmé : un changement de plafond d'analyse invalide", () => {
  assert.equal(jobStillValid({ dem: dem1, landMask: null, maxSize: 0 }, { dem: dem1, landMask: null, maxSize: 768 }), false)
})

test('périmé : un terrain détruit (clé courante nulle) invalide', () => {
  assert.equal(jobStillValid({ dem: dem1, landMask: null, maxSize: 0 }, null), false)
})

test('VALIDE : une reconstruction qui ne touche PAS aux altitudes ne périme rien', () => {
  // exagération, résolution du maillage, palette, mode : rebuild() est rappelé,
  // une NOUVELLE clé est posée — mais elle porte le même MNT, la même landMask
  // et le même plafond. Le résultat en vol est encore juste.
  const avant = { dem: dem1, landMask: null, maxSize: 0 }
  const apres = { dem: dem1, landMask: null, maxSize: 0 } // objet différent, contenu identique
  assert.notEqual(avant, apres)
  assert.equal(jobStillValid(avant, apres), true)
})

test('VALIDE : la même landMask (mise en cache) ne périme pas', () => {
  const lm = new Uint8Array(4)
  assert.equal(jobStillValid({ dem: dem1, landMask: lm, maxSize: 0 }, { dem: dem1, landMask: lm, maxSize: 0 }), true)
})

// ---------------------------------------------------------------------------
// LES DEUX CHAMPS N'ONT PAS LES MÊMES DÉPENDANCES — bug vu à l'écran.
//
// Sur une dalle voisine du damier, le trait de côte arrive ~300 ms après le
// lancement, donc AVANT la fin de l'analyse (768², ~120 ms) : avec une clé
// commune (dem + landMask + plafond), l'arrivée du trait de côte périmait une
// analyse parfaitement juste, et la dalle restait sans peigné à côté d'un
// centre peigné. C'est l'invalidation TROP LARGE, et elle se voit.

test("l'analyse SURVIT à l'arrivée du trait de côte — elle ne lit que les altitudes", () => {
  const lm = new Uint8Array(4)
  const cleAnalyse = { dem: dem1, maxSize: 0 } // pas de landMask dans la clé
  const apresCote = { dem: dem1, landMask: lm, maxSize: 0 }
  assert.equal(jobStillValid(cleAnalyse, apresCote), true)
})

test("le masque de mer, LUI, ne survit pas à l'arrivée du trait de côte", () => {
  const lm = new Uint8Array(4)
  const cleMer = { dem: dem1, landMask: null }
  const apresCote = { dem: dem1, landMask: lm, maxSize: 0 }
  assert.equal(jobStillValid(cleMer, apresCote), false)
})

test('mais un changement de MNT périme les DEUX', () => {
  const apres = { dem: dem2, landMask: null, maxSize: 0 }
  assert.equal(jobStillValid({ dem: dem1, maxSize: 0 }, apres), false)
  assert.equal(jobStillValid({ dem: dem1, landMask: null }, apres), false)
})

// scheduleTerrainJob : la même règle, mais câblée — la clé courante est relue
// AU MOMENT où le résultat arrive, pas au moment où il est demandé.
function jobBidon() {
  return { data: new Float32Array(4), size: 2, metersPerPixel: 10 }
}

test('scheduleTerrainJob ne pose PAS un résultat périmé', async () => {
  let courante = { dem: dem1, landMask: null, maxSize: 0 }
  let pose = null
  const p = scheduleTerrainJob({
    key: courante,
    job: jobBidon(),
    current: () => courante,
    apply: (r) => (pose = r),
    run: () => Promise.resolve({ analysis: null, analysisSize: 0, sea: new Uint8Array(4), seaSize: 2 }),
  })
  courante = { dem: dem2, landMask: null, maxSize: 0 } // l'utilisateur a zoomé
  assert.equal(await p, null)
  assert.equal(pose, null, 'un résultat périmé ne doit jamais atterrir')
})

test('scheduleTerrainJob POSE un résultat encore valide', async () => {
  let courante = { dem: dem1, landMask: null, maxSize: 0 }
  let pose = null
  const p = scheduleTerrainJob({
    key: courante,
    job: jobBidon(),
    current: () => courante,
    apply: (r) => (pose = r),
    run: () => Promise.resolve({ analysis: null, analysisSize: 0, sea: new Uint8Array(4), seaSize: 2 }),
  })
  courante = { dem: dem1, landMask: null, maxSize: 0 } // rebuild pour l'exagération
  assert.notEqual(await p, null)
  assert.ok(pose, 'un résultat encore juste DOIT atterrir')
})

test('scheduleTerrainJob avale un travail abandonné (résolu à null) sans jamais pendre', async () => {
  // le voile de chargement attend cette promesse : si elle ne se résout jamais,
  // l'application reste voilée pour toujours. Pire que le gel qu'on supprime.
  let pose = null
  const r = await scheduleTerrainJob({
    key: { dem: dem1, landMask: null, maxSize: 0 },
    job: jobBidon(),
    current: () => ({ dem: dem1, landMask: null, maxSize: 0 }),
    apply: (v) => (pose = v),
    run: () => Promise.resolve(null),
  })
  assert.equal(r, null)
  assert.equal(pose, null)
})

test('scheduleTerrainJob ne pend pas non plus quand le calcul JETTE', async () => {
  const r = await scheduleTerrainJob({
    key: { dem: dem1, landMask: null, maxSize: 0 },
    job: jobBidon(),
    current: () => ({ dem: dem1, landMask: null, maxSize: 0 }),
    apply: () => assert.fail('rien à poser'),
    run: () => Promise.reject(new Error('worker mort')),
  })
  assert.equal(r, null)
})

// ---------------------------------------------------------------------------
// REPLI — pas de Worker, pas de relief sans analyse.

test('repli : sans Worker, runTerrainJob calcule sur le fil principal', async () => {
  assert.equal(typeof Worker, 'undefined', 'node n’a pas de Worker global — c’est le chemin de repli')
  const dem = MODELES.cote()
  const got = await runTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 0, landMask: null })
  const { a, m } = reference(dem)
  for (let i = 0; i < a.rgba.length; i++) assert.equal(got.analysis[i], a.rgba[i], `analyse, octet ${i}`)
  for (let i = 0; i < m.mask.length; i++) assert.equal(got.sea[i], m.mask[i], `mer, octet ${i}`)
})

test('repli : un constructeur de Worker qui JETTE retombe sur le fil principal', async () => {
  // contexte contraint (CSP, `file://`, vieux navigateur) : `new Worker` peut
  // jeter à la construction. Un relief sans analyse serait pire que lent.
  const dem = MODELES.montagne()
  globalThis.Worker = class {
    constructor() {
      throw new Error('worker interdit ici')
    }
  }
  try {
    resetTerrainTransport()
    const got = await runTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, maxSize: 0, landMask: null })
    const { a } = reference(dem)
    assert.equal(got.analysisSize, a.size)
    for (let i = 0; i < a.rgba.length; i++) assert.equal(got.analysis[i], a.rgba[i], `analyse, octet ${i}`)
  } finally {
    delete globalThis.Worker
    resetTerrainTransport()
  }
})

test("repli : une fois le Worker déclaré hors service, on n'y retourne pas", async () => {
  // sinon chaque reconstruction repaie une construction de Worker qui échoue.
  let essais = 0
  const dem = MODELES.plateau()
  globalThis.Worker = class {
    constructor() {
      essais++
      throw new Error('non')
    }
  }
  try {
    resetTerrainTransport()
    await runTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel })
    await runTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel })
    assert.equal(essais, 1)
  } finally {
    delete globalThis.Worker
    resetTerrainTransport()
  }
})

test('cancelTerrainJobs résout les travaux en vol à null au lieu de les abandonner', async () => {
  const enVol = []
  globalThis.Worker = class {
    constructor() {
      this.onmessage = null
    }
    postMessage(m) {
      enVol.push(m) // jamais de réponse : le travail reste en vol
    }
    terminate() {}
  }
  try {
    resetTerrainTransport()
    const dem = MODELES.plateau()
    const p = runTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel })
    cancelTerrainJobs()
    assert.equal(await p, null)
    assert.equal(enVol.length, 1)
  } finally {
    delete globalThis.Worker
    resetTerrainTransport()
  }
})
