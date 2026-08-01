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
import { analyzeDem, resampleField } from '../src/terrain-analysis.js'
import { buildSeaMask, blurMask } from '../src/sea-mask.js'
import { computeTerrainJob, computeLakeJob, jobStillValid, jobCouvertParEnVol, scheduleTerrainJob, runTerrainJob, runLakeJob, cancelTerrainJobs, resetTerrainTransport } from '../src/terrain-jobs.js'
import { detectLakes } from '../src/lake.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Terrain } from '../src/terrain.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

// --------------------------------------------- le plafond du MASQUE DE MER
//
// Il est arrivé après celui de l'analyse, parce qu'on l'avait oublié : le
// masque de mer se calculait sur le MNT PLEIN quoi qu'il arrive, soit 1536² sur
// une dalle voisine maillée à 256 — 6,00× la densité du maillage, là où
// block-grid.js annonçait 4× au plus, et 2,25 Mo par dalle.

test('computeTerrainJob plafonne AUSSI le masque de mer', () => {
  const dem = MODELES.cote()
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, seaMax: 32, landMask: null })
  assert.equal(got.seaSize, 32)
  assert.equal(got.sea.length, 32 * 32)
  const reduit = resampleField(dem.data, dem.size, 32)
  const ref = blurMask(buildSeaMask({ data: reduit.data, size: reduit.size }, { landMask: null }), 1)
  for (let i = 0; i < ref.mask.length; i++) assert.equal(got.sea[i], ref.mask[i], `octet ${i}`)
})

// ⚠️ Le contrat qui protège le bloc CENTRAL : lui n'a pas de plafond, et son
// masque de mer ne doit pas avoir bougé d'un octet en gagnant ce paramètre.
test('sans seaMax, le masque de mer est INCHANGÉ octet pour octet', () => {
  for (const faire of Object.values(MODELES)) {
    const dem = faire()
    const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel })
    const ref = blurMask(buildSeaMask(dem, { landMask: null }), 1)
    assert.equal(got.seaSize, dem.size)
    for (let i = 0; i < ref.mask.length; i++) assert.equal(got.sea[i], ref.mask[i], `octet ${i}`)
  }
})

// ⚠️ LE PIÈGE MUET de ce plafond : buildSeaMask indexe la landMask cellule pour
// cellule. Elle arrive donc à la taille du MASQUE, pas à celle du MNT — c'est
// terrain.js (_landMaskFor) qui applique le même plafond. Une landMask à la
// mauvaise taille ne lève rien : elle rend des polders décalés.
test('la landMask du masque plafonné est lue à la taille du MASQUE', () => {
  const dem = MODELES.cote()
  const landMask = new Uint8Array(32 * 32).fill(255) // tout est terre, à la taille du masque
  const got = computeTerrainJob({ data: dem.data, size: dem.size, metersPerPixel: dem.metersPerPixel, seaMax: 32, landMask })
  assert.equal(got.seaSize, 32)
  assert.ok(got.sea.every((v) => v === 0), 'une landMask pleine ne laisse aucune mer, plafond ou pas')
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

test('périmé : un changement de plafond de MER invalide le masque de mer', () => {
  assert.equal(jobStillValid({ dem: dem1, landMask: null, seaMax: 0 }, { dem: dem1, landMask: null, seaMax: 1024 }), false)
})

// ---------------------------------------------------------------------------
// DÉDOUBLONNAGE — chaque dalle voisine payait son analyse DEUX FOIS.
//
// À la naissance d'une dalle, `terrain.rebuild()` lance les champs puis
// `_applyLook` → `setColorMode` les relance, parce que `uAnalysisOn` ne monte
// qu'à l'ARRIVÉE du premier travail. Mesuré sur 8 dalles : 24 travaux postés au
// Worker dont 16 avec analyse, pour 226 Mo de MNT recopiés par postMessage.
//
// Les DEUX bords comptent, et le second plus que le premier : supprimer le
// doublon ne doit jamais supprimer un recalcul LÉGITIME.

const cle = (o = {}) => ({ dem: dem1, landMask: null, maxSize: 0, seaMax: 0, analyse: true, ...o })

test('doublon : la même demande, relancée pendant le vol, est COUVERTE', () => {
  assert.equal(jobCouvertParEnVol(cle(), cle()), true)
})

test('légitime : un MNT neuf (zoom, autre lieu) n’est PAS couvert', () => {
  assert.equal(jobCouvertParEnVol(cle(), cle({ dem: dem2 })), false)
})

test('légitime : l’arrivée du trait de côte (landMask neuve) n’est PAS couverte', () => {
  assert.equal(jobCouvertParEnVol(cle(), cle({ landMask: new Uint8Array(4) })), false)
})

test('légitime : un plafond qui change n’est PAS couvert', () => {
  assert.equal(jobCouvertParEnVol(cle(), cle({ maxSize: 1024 })), false)
  assert.equal(jobCouvertParEnVol(cle(), cle({ seaMax: 1024 })), false)
})

// ⚠️ L'ASYMÉTRIE, et c'est elle qui empêche la dalle de rester sans peigné : un
// travail « mer seule » en vol (relance du trait de côte) ne couvre PAS une
// demande qui réclame l'analyse. L'inverse, oui.
test('asymétrie : la mer seule ne couvre pas l’analyse ; l’analyse couvre la mer seule', () => {
  assert.equal(jobCouvertParEnVol(cle({ analyse: false }), cle({ analyse: true })), false)
  assert.equal(jobCouvertParEnVol(cle({ analyse: true }), cle({ analyse: false })), true)
})

test('rien en vol : rien n’est couvert', () => {
  assert.equal(jobCouvertParEnVol(null, cle()), false)
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

// ---------------------------------------------------------------------------
// TROIS TRAVAUX PAR ZOOM, DONT UN POUR RIEN
// ---------------------------------------------------------------------------
// Mesuré à La Réunion (Chrome piloté, pile d'appel de chaque postMessage) :
// un changement de zoom postait TROIS travaux au travailleur.
//   1. `terrain.rebuild` → masque de mer + analyse de relief. Légitime, c'est
//      lui que le voile de chargement attend.
//   2. `main.js` lâchait le trait de côte de la zone PRÉCÉDENTE APRÈS la
//      reconstruction : masque de mer SEUL, 9 Mo de MNT recopiés, ~45 ms de
//      travailleur — pour un résultat que le 3ᵉ écrasait 70 ms plus tard.
//   3. l'ARRIVÉE du vrai trait de côte → masque de mer avec la landMask.
//      Légitime aussi : c'est lui qui rend leurs polders aux Pays-Bas.
// Le 2ᵉ est supprimé en lâchant le trait de côte AVANT la reconstruction, avec
// `rebuildFields: false` — `rebuild` lance les champs juste après, et il les
// lance alors dans le BON état d'attente (aucun trait de côte, plutôt que celui
// d'une zone qu'on vient de quitter).
test('setCoastMask : lâcher le trait de côte AVANT une reconstruction ne poste rien', () => {
  const bloc = () => {
    let recuites = 0
    const t = {
      mapUniforms: { uCoastMask: { value: null }, uCoastMaskOn: { value: 1 } },
      _coastPlaceholder: { blanc: true }, // évite whiteTexture() (canevas DOM)
      _coastImage: { zonePrecedente: true },
      _coastLand: { cache: true },
      dem: { data: new Float32Array(16) },
      _buildFields: () => { recuites++ },
    }
    return { t, recuites: () => recuites }
  }

  // le comportement par défaut, INCHANGÉ : lâcher le masque recuit la mer
  const a = bloc()
  Terrain.prototype.setCoastMask.call(a.t, null)
  assert.equal(a.recuites(), 1, 'sans drapeau, le masque de mer est bien recuit')
  assert.equal(a.t._coastImage, null)
  assert.equal(a.t._coastLand, null, 'la landMask mémorisée est invalidée dans les deux cas')
  assert.equal(a.t.mapUniforms.uCoastMaskOn.value, 0)

  // le chemin du zoom : on lâche, mais c'est `rebuild` qui lancera les champs
  const b = bloc()
  Terrain.prototype.setCoastMask.call(b.t, null, null, { rebuildFields: false })
  assert.equal(b.recuites(), 0, 'aucun travail posté : la reconstruction arrive')
  assert.equal(b.t._coastImage, null, 'le trait de côte périmé est bien lâché')
  assert.equal(b.t._coastLand, null)
  assert.equal(b.t.mapUniforms.uCoastMaskOn.value, 0)

  // et un second appel à vide ne poste rien non plus — c'est ce qui rend
  // inoffensifs les `setCoastMask(null)` restés en place plus bas dans main.js
  Terrain.prototype.setCoastMask.call(b.t, null)
  assert.equal(b.recuites(), 0, 'lâcher ce qui est déjà lâché est un non-événement')
})

// ⚠️ L'ORDRE EST LE CORRECTIF, et il ne se voit pas dans une signature : si
// quelqu'un remonte le lâcher après `regenerateTerrain`, tout continue de
// marcher — ça repaie juste 45 ms de travailleur et 9 Mo de copie par zoom,
// sans qu'aucun test ne s'en aperçoive. D'où celui-ci, qui lit main.js.
test('main.js : le trait de côte périmé est lâché AVANT la reconstruction du relief', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const lache = src.indexOf('rebuildFields: false')
  const rebuild = src.indexOf('await regenerateTerrain()')
  assert.ok(lache > 0, 'le lâcher sans recuisson a disparu de main.js')
  assert.ok(rebuild > 0)
  assert.ok(lache < rebuild, 'lâché après la reconstruction, il repaie un travail de travailleur entier')
})

// ⚠️ LE DÉLAI DU VOILE, ET LE PIÈGE DU rAF. `regenerateTerrain` s'accorde un
// délai pour laisser le voile de chargement se peindre avant de figer le fil
// principal. Il était FIXE à 50 ms — donc payé aussi sur le chemin d'un zoom,
// où le voile est peint depuis ~170 ms : 50 ms de carte d'attente offertes à
// personne, à chaque zoom. Il ne reste que ce qui MANQUE au voile.
// Et c'est un setTimeout, PAS un requestAnimationFrame : rAF ne se déclenche
// jamais dans un onglet caché et la reconstruction resterait en plan — piège
// déjà payé trois fois sur ce projet.
test('main.js : le délai du voile est ce qui lui manque, et il reste un setTimeout', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const debut = src.indexOf('function regenerateTerrain(')
  assert.ok(debut > 0, 'regenerateTerrain introuvable dans main.js')
  const fin = src.indexOf('}, delai)', debut)
  assert.ok(fin > debut, 'le rendez-vous de regenerateTerrain ne se referme plus sur `delai`')
  const bloc = src.slice(debut, fin)
  assert.match(bloc, /const delai = Math\.max\(0, 50 - \(performance\.now\(\) - loadingVisibleDepuis\)\)/)
  assert.match(bloc, /setTimeout\(/, 'le rendez-vous doit rester un setTimeout')
  // (l'APPEL, pas la mention : le commentaire du module nomme rAF pour dire
  // justement de ne pas s'en servir ici)
  assert.ok(!/requestAnimationFrame\(/.test(bloc), 'rAF est gelé dans un onglet caché — jamais ici')
  assert.ok(!/\}, 50\)/.test(bloc), 'le délai fixe de 50 ms est revenu')
})

// ---------------------------------------------------------------------------
// LES LACS SORTENT DU FIL À LEUR TOUR
//
// Mesuré sur MNT réel, durée TOTALE de `realWater.rebuild` avec et sans
// détection (Chrome piloté sur le serveur vivant) : Annecy 3×3 875 → 201 ms,
// Annecy z12 187 → 98 ms, La Réunion 3×3 556 → 67 ms. Et le transport ne mange
// pas le gain : `postMessage` d'un MNT 3×3 (40,5 Mo) coûte 8 ms de fil
// principal, le retour des cellules TRANSFÉRÉES 1,2 ms.
//
// Même contrat que l'analyse : le calcul déporté doit rendre EXACTEMENT ce que
// le calcul en ligne rendait. Une cellule de différence, c'est un plan d'eau
// qui change de forme.

// un MNT avec de VRAIS lacs plantés, en Int16 comme la production (dem-quant.js)
function demALacs(size = 96) {
  const data = new Int16Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = 200 + ((x * 7 + y * 13) % 29) + ((x + y) % 3)
  for (let y = 10; y < 45; y++) for (let x = 12; x < 50; x++) data[y * size + x] = 512 // blob
  for (let y = 60; y < 68; y++) for (let x = 20; x < 85; x++) data[y * size + x] = 640 // ruban
  return { data, size, metersPerPixel: 13.3 }
}

test('computeLakeJob rend EXACTEMENT ce que detectLakes rend, cellule pour cellule', () => {
  const dem = demALacs()
  const attendu = detectLakes(dem)
  assert.ok(attendu.length >= 2, 'le témoin doit contenir au moins deux lacs')
  const got = computeLakeJob({ data: dem.data, size: dem.size })
  assert.equal(got.lacs.length, attendu.length)
  for (let k = 0; k < attendu.length; k++) {
    assert.equal(got.lacs[k].elevM, attendu[k].elevM, `lac ${k} : élévation`)
    assert.equal(got.lacs[k].size, attendu[k].size, `lac ${k} : côté du champ`)
    assert.deepEqual([...got.lacs[k].cells], [...attendu[k].cells], `lac ${k} : cellules`)
  }
})

// 🔴 UN TAMPON RÉPÉTÉ DANS LA LISTE DE TRANSFERT FAIT JETER `postMessage`
// (« ArrayBuffer at index 1 is already detached »), et l'erreur tomberait DANS
// le Worker — donc dans un `console` que personne ne lit. C'est la contrepartie
// du tampon partagé de lake.js : chaque lac doit avoir SON tampon.
test('computeLakeJob rend un tampon par lac, et ils sont TOUS distincts', () => {
  const got = computeLakeJob({ data: demALacs().data, size: 96 })
  assert.equal(got.transfert.length, got.lacs.length)
  assert.equal(new Set(got.transfert).size, got.transfert.length, 'deux lacs partagent un tampon')
  for (let k = 0; k < got.lacs.length; k++) assert.equal(got.transfert[k], got.lacs[k].cells.buffer)
})

test('repli : sans Worker, runLakeJob rend la MÊME FORME que le Worker — { lacs }', async () => {
  assert.equal(typeof Worker, 'undefined', 'node n’a pas de Worker global — c’est le chemin de repli')
  const dem = demALacs()
  const got = await runLakeJob({ data: dem.data, size: dem.size })
  const attendu = detectLakes(dem)
  assert.ok(Array.isArray(got.lacs), 'le repli doit rendre { lacs }, pas le résultat nu')
  assert.equal(got.transfert, undefined, 'la liste de transfert ne traverse pas la frontière')
  assert.equal(got.lacs.length, attendu.length)
  for (let k = 0; k < attendu.length; k++) assert.deepEqual([...got.lacs[k].cells], [...attendu[k].cells])
})

// ⚠️ LA BOÎTE AUX LETTRES DOIT ROUTER, ET RETIRER SA CLÉ DE ROUTAGE. `kind`
// laissé dans le travail arriverait dans une fonction qui déstructure ses
// entrées : le jour où un réglage s'appellera comme ça, personne ne fera le
// lien. Node n'a pas de Worker — on lit donc la boîte aux lettres au texte,
// comme damier-memoire.test.js lit block-grid.js.
test('terrain-worker.js route sur `kind` et transfère les cellules', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/terrain-worker.js'), 'utf8')
  assert.match(src, /const \{ id, kind, \.\.\.job \} = e\.data/, 'kind doit être retiré du travail')
  assert.match(src, /kind === 'lacs'/, 'la route des lacs a disparu')
  assert.match(src, /self\.postMessage\(\{ id, lacs \}, transfert\)/, 'les cellules doivent être TRANSFÉRÉES')
})

// ⚠️ ET LA PANNE DU WORKER NE DOIT PAS REJOUER UN TRAVAIL DE LACS AVEC LE
// CALCUL DE L'ANALYSE. `onerror` rejoue les travaux en vol sur le fil
// principal ; sans le `calcul` rangé à côté du travail, il appellerait
// `computeTerrainJob` sur un travail de lacs et rendrait un masque de mer là où
// l'appelant attend des plans d'eau.
test('panne du Worker : un travail de LACS est rejoué avec le calcul des lacs', async () => {
  const dem = demALacs()
  let instance = null
  globalThis.Worker = class {
    constructor() {
      instance = this
    }
    postMessage() {
      // le Worker meurt en vol, après avoir accepté le travail
      setTimeout(() => instance.onerror?.(new Error('worker mort en vol')), 0)
    }
    terminate() {}
  }
  try {
    resetTerrainTransport()
    const got = await runLakeJob({ data: dem.data, size: dem.size })
    assert.ok(Array.isArray(got?.lacs), 'le rejeu doit rendre des lacs, pas un masque de mer')
    assert.equal(got.lacs.length, detectLakes(dem).length)
  } finally {
    delete globalThis.Worker
    resetTerrainTransport()
  }
})
