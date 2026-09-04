import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WaterLayer } from '../src/map/water-layer.js'
import {
  fetchOverpassLines, oublierPanneOverpass, overpassEnPanne, overpassSondeSeulement,
  OVERPASS_ATTENTE_SONDE_MS, OVERPASS_PANNE_MS,
} from '../src/map/overpass.js'

// ═══════════════════════════════════════════════════════════════════════════
// RIV-C — L'EAU N'ATTEND PLUS UN SERVICE QUI NE RÉPOND PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT, MESURÉ (`scripts/sonde-riv-c.mjs`, contexte de navigateur NEUF par
// cas — le disjoncteur se ferme 60 s et rend l'application rapide, c'est ce qui
// rendait ce défaut insaisissable). Rhône z12, entre le vol et le premier trait
// bleu à l'écran : **15 038,5 ms**. Les deux premières reconstructions duraient
// 6 102,6 ms puis 6 262,5 ms et produisaient **zéro sommet** ; la quatrième
// dessinait en 261,3 ms des rivières Natural Earth LOCALES, disponibles depuis
// le début.
//
// ⚠️ **CE QUE CES TESTS NE PROMETTENT PAS.** Aucun gain de fluidité. L'A/B
// rivières allumées/éteintes dans la même session borne le coût CPU du calque à
// **+72 ms** ; la saccade appartient au globe qui maille son relief. Ce qui est
// verrouillé ici est un **délai d'apparition**.

const demDe = (originTileX) => ({ size: 512, zoom: 13, originTileX, originTileY: 2929, tilePx: 256 })
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const bbox = { minLat: 45.8, minLon: 6.1, maxLat: 45.95, maxLon: 6.3 }

// Un `this` minimal pour `WaterLayer.prototype.rebuild` : il ne touche que
// `_buildId`, `_clear`, `usingOsm`, `loading` et `_peindre`. On n'instancie PAS
// la classe (son constructeur lit `window.innerWidth`) et on ne monte pas de
// scène three.js : ce qu'on mesure ici est un ORDRE, pas de la géométrie.
// `_peindre` sert de seau : chaque peinture y laisse la source qu'on lui a
// donnée (`null` = le local garanti, un objet = la réponse d'Overpass).
function fauxCalque() {
  const peintures = []
  return {
    peintures, _buildId: 0, usingOsm: false, loading: false,
    _clear() { },
    async _peindre(_socle, osm) { peintures.push(osm) },
    rebuild: WaterLayer.prototype.rebuild,
  }
}

// Prend la main sur `globalThis.fetch` (c'est par là que passe `overpass.js`
// quand personne ne lui injecte de `fetchImpl`, donc quand c'est le calque qui
// l'appelle) et rend de quoi régler chaque requête à la main.
function fetchPilote() {
  const vrai = globalThis.fetch
  const enVol = []
  globalThis.fetch = () => new Promise((resolve, reject) => enVol.push({ resolve, reject }))
  return {
    enVol,
    async attendreDeparts(n) {
      // `minInterval` (1 200 ms par défaut) retarde le départ réel : on
      // n'assume pas un délai, on attend le fait.
      for (let i = 0; i < 400 && enVol.length < n; i++) await dodo(10)
      assert.equal(enVol.length, n, `${enVol.length} requête(s) partie(s) sur ${n}`)
    },
    rendre(json) { for (const p of enVol) p.resolve({ ok: true, headers: { get: () => null }, json: async () => json }) },
    refuser() { for (const p of enVol) p.resolve({ ok: false, status: 500, headers: { get: () => null } }) },
    fin() { globalThis.fetch = vrai },
  }
}

// ── ① DESSINER LE LOCAL AVANT D'ATTENDRE OVERPASS ──────────────────────────

test('① le calque PEINT pendant qu Overpass est encore en vol — il ne l attend plus', async () => {
  // ⛔ SANS LE CORRECTIF : `rebuild` commençait par
  // `await Promise.all([fetchOverpassLines, fetchOverpassAreas])`, donc AUCUNE
  // peinture n'existait tant que les requêtes n'avaient pas rendu la main.
  // Cette assertion-ci est le défaut lui-même : au moment où Overpass n'a
  // toujours pas répondu, l'eau doit DÉJÀ être à l'écran.
  oublierPanneOverpass()
  const p = fetchPilote()
  try {
    const eau = fauxCalque()
    const dem = demDe(4241)
    const fini = eau.rebuild({ dem, terrain: { dem }, params: { waterEnabled: true, source: 'real', demZoom: 13 } })
    let regle = false
    fini.then(() => { regle = true })

    await p.attendreDeparts(2)
    await dodo(50)
    assert.equal(eau.peintures.length, 1, 'une peinture doit avoir eu lieu AVANT la réponse d Overpass')
    assert.equal(eau.peintures[0], null, 'et cette peinture-là est celle des sources LOCALES garanties')
    assert.equal(regle, false, 'la reconstruction, elle, est toujours en cours')

    p.refuser() // le service rend un 500 : aucune donnée
    await fini
    assert.equal(eau.peintures.length, 1, 'un service qui ne rapporte rien ne doit RIEN faire repeindre')
    assert.equal(eau.loading, false)
  } finally { p.fin(); oublierPanneOverpass() }
})

test('① sous OSM_MIN_ZOOM, une seule peinture et AUCUNE requête réseau', async () => {
  oublierPanneOverpass()
  const p = fetchPilote()
  try {
    const eau = fauxCalque()
    const dem = demDe(4242)
    await eau.rebuild({ dem, terrain: { dem }, params: { waterEnabled: true, source: 'real', demZoom: 11 } })
    assert.deepEqual(eau.peintures, [null])
    assert.equal(p.enVol.length, 0, 'z11 ne touche pas Overpass')
  } finally { p.fin(); oublierPanneOverpass() }
})

test('① le disjoncteur ouvert : une seule peinture, immédiate, et pas de clignotement', async () => {
  // C'est le cas de cette machine passé le premier abandon, et de tout
  // visiteur dont le réseau n'atteint pas Overpass. `fetchOverpass*` rend
  // `null` sans toucher au réseau ; il ne doit donc y avoir AUCUNE seconde
  // peinture — l'absence de clignotement est gratuite ici, pas fondue.
  const p = fetchPilote()
  try {
    const { noterPanneOverpass } = await import('../src/map/overpass.js')
    oublierPanneOverpass(); noterPanneOverpass()
    const eau = fauxCalque()
    const dem = demDe(4243)
    await eau.rebuild({ dem, terrain: { dem }, params: { waterEnabled: true, source: 'real', demZoom: 13 } })
    assert.deepEqual(eau.peintures, [null], 'une peinture, celle du local')
    assert.equal(p.enVol.length, 0, 'et pas une requête')
  } finally { p.fin(); oublierPanneOverpass() }
})

test('① une réponse d Overpass, MÊME VIDE, repeint — sinon les pixels changent', async () => {
  // ⚠️ L'ancienne branche était `if (feats) { … osmOk = true }` : un TABLEAU
  // VIDE est vrai, donc une réponse vide écrasait déjà le repli Natural Earth.
  // Garder le repli dans ce cas serait « mieux », mais ce serait un changement
  // de pixels non mesuré, glissé dans un correctif de latence. On reproduit.
  oublierPanneOverpass()
  const p = fetchPilote()
  try {
    const eau = fauxCalque()
    const dem = demDe(4244)
    const fini = eau.rebuild({ dem, terrain: { dem }, params: { waterEnabled: true, source: 'real', demZoom: 13 } })
    await p.attendreDeparts(2)
    p.rendre({ elements: [] })
    await fini
    assert.equal(eau.peintures.length, 2, 'la réponse est arrivée : elle remplace')
    assert.equal(eau.peintures[0], null)
    assert.deepEqual(eau.peintures[1], { feats: [], areas: [] })
  } finally { p.fin(); oublierPanneOverpass() }
})

test('① une reconstruction plus récente annule la repeinture de l ancienne', async () => {
  // Sans ce garde, la réponse tardive d'une emprise qu'on a quittée
  // repeindrait l'eau d'ailleurs par-dessus celle d'ici.
  oublierPanneOverpass()
  const p = fetchPilote()
  try {
    const eau = fauxCalque()
    const dem = demDe(4245)
    const fini = eau.rebuild({ dem, terrain: { dem }, params: { waterEnabled: true, source: 'real', demZoom: 13 } })
    await p.attendreDeparts(2)
    eau._buildId++ // quelqu'un est parti ailleurs pendant l'attente
    p.rendre({ elements: [{ type: 'way', tags: { waterway: 'river' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] }] })
    await fini
    assert.equal(eau.peintures.length, 1, 'la peinture locale, et rien après')
  } finally { p.fin(); oublierPanneOverpass() }
})

// ── ② UNE SEULE ÉCHÉANCE PAR EMPRISE, PARTAGÉE ─────────────────────────────

test('② une deuxième reconstruction HÉRITE de l échéance, elle ne rouvre pas un budget', async () => {
  // ⛔ SANS LE CORRECTIF, MESURÉ dans la page : 6 008,6 ms d'attente, puis
  // **9 988,2 ms** pour la deuxième reconstruction sur la MÊME requête déjà en
  // vol. Le cache dédoublonnait la requête, pas le minuteur.
  oublierPanneOverpass()
  const jamais = () => new Promise(() => { })
  const zone = { ...bbox, minLat: 11.11 }
  const o = { fetchImpl: jamais, minInterval: 0, attenteMs: 500 }
  const t0 = Date.now()
  const premiere = fetchOverpassLines(zone, 'water', o)
  await dodo(520) // le budget de la première est épuisé
  const seconde = await fetchOverpassLines(zone, 'water', o)
  const dt = Date.now() - t0
  assert.equal(await premiere, null)
  assert.equal(seconde, null)
  assert.ok(dt < 800, `${dt} ms — sans échéance partagée ce serait 500 + 500 = ~1 020 ms`)
  oublierPanneOverpass()
})

test('② échéance dépassée, mais une réponse DÉJÀ ARRIVÉE reste lisible', async () => {
  // ⚠️ Le piège du correctif : `Math.max(0, reste)` rendrait le job NU
  // (`attendreOuAbandonner` : `if (!(ms > 0)) return job`) et l'attente
  // redeviendrait infinie ; abandonner sèchement à échéance dépassée jetterait
  // au contraire une donnée déjà payée. Le cache passe avant le disjoncteur.
  oublierPanneOverpass()
  const json = { elements: [{ type: 'way', tags: { waterway: 'river' }, geometry: [{ lat: 1, lon: 2 }, { lat: 1.1, lon: 2.1 }] }] }
  const zone = { ...bbox, minLat: 14.14 }
  const o = { fetchImpl: async () => ({ ok: true, headers: { get: () => null }, json: async () => json }), minInterval: 0, attenteMs: 60 }
  assert.equal((await fetchOverpassLines(zone, 'water', o))?.length, 1)
  await dodo(120) // largement au-delà de l'échéance posée pour cette clé
  assert.equal((await fetchOverpassLines(zone, 'water', o))?.length, 1, 'la réponse en cache doit rester lisible')
  oublierPanneOverpass()
})

// ── ③ LE DISJONCTEUR, PLUS TÔT : LA SONDE ──────────────────────────────────

test('③ après un échec d accès, la tentative suivante coûte une SONDE, pas un budget plein', async () => {
  // ⛔ SANS LE CORRECTIF, le repos de 60 s protégeait les zones suivantes mais
  // la PREMIÈRE tentative d'après le repos repayait 6 s entières pour
  // réapprendre ce qu'on savait déjà.
  oublierPanneOverpass()
  const mort = () => Promise.reject(new TypeError('Failed to fetch'))
  assert.equal(await fetchOverpassLines({ ...bbox, minLat: 12.12 }, 'water', { fetchImpl: mort, minInterval: 0, attenteMs: 5000 }), null)
  assert.ok(overpassEnPanne(), 'un échec réseau franc ouvre le repos')
  assert.ok(overpassSondeSeulement(), 'et marque le point d accès comme douteux')

  // le repos expire — on ne l'oublie pas (ça remettrait le compteur à zéro),
  // on avance l'horloge du module.
  const plusTard = () => Date.now() + OVERPASS_PANNE_MS + 1
  const jamais = () => new Promise(() => { })
  const t0 = Date.now()
  const r = await fetchOverpassLines({ ...bbox, minLat: 13.13 }, 'water', { fetchImpl: jamais, minInterval: 0, attenteMs: 5000, now: plusTard })
  const dt = Date.now() - t0
  assert.equal(r, null)
  assert.ok(dt < 3000, `${dt} ms — sans la sonde ce serait le budget plein, 5 000 ms`)
  assert.ok(dt >= OVERPASS_ATTENTE_SONDE_MS - 200, `${dt} ms — mais une requête saine (927 ms mesurées) doit encore passer`)
  oublierPanneOverpass()
})

test('③ une réponse rend au point d accès son budget plein', async () => {
  oublierPanneOverpass()
  const mort = () => Promise.reject(new TypeError('Failed to fetch'))
  await fetchOverpassLines({ ...bbox, minLat: 15.15 }, 'water', { fetchImpl: mort, minInterval: 0, attenteMs: 200 })
  assert.ok(overpassSondeSeulement())
  const json = { elements: [] }
  await fetchOverpassLines({ ...bbox, minLat: 16.16 }, 'water', {
    fetchImpl: async () => ({ ok: true, headers: { get: () => null }, json: async () => json }),
    minInterval: 0, attenteMs: 2000, now: () => Date.now() + OVERPASS_PANNE_MS + 1,
  })
  assert.equal(overpassSondeSeulement(), false, 'le réseau est revenu : on lui rend sa confiance')
  oublierPanneOverpass()
})
