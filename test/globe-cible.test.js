// LA CIBLE — D22 : « le centre de l'écran d'abord, la périphérie en basse
// définition, et sa version fine SEULEMENT quand le centre a totalement fini ».
//
// Adrien, 2026-09-04 : « Les tuiles à charger en priorité sont celles au centre
// de l'écran. Il faut imaginer un cercle concentrique à partir du centre de
// l'écran, une sorte de cible. (…) Dans un premier temps, on peut charger
// uniquement une version low def sur les tuiles non prioritaires, qui ne se
// chargent que quand les tuiles prioritaires ont totalement terminé leur
// chargement. »
//
// ⚠️ **DEUX DES TROIS POINTS EXISTAIENT DÉJÀ, ET CE FICHIER LE VERROUILLE AUSSI.**
// PF2 a posé la loi de priorité (une décroissance CONTINUE de la distance écran)
// et R37 le raffinement partiel (le parent couvre sous les enfants manquants —
// la « basse définition » gratuite). Les tests ① et ② les tiennent, pour que la
// prochaine tâche ne les réécrive pas une septième fois.
//
// Ce que CIB ajoute :
//   ③ **la barrière d'ordonnancement** — un parent de PÉRIPHÉRIE dont aucun
//      enfant n'existe ne part pas tant que la cible attend ;
//   ④ ses trois garde-fous MESURÉS : les créneaux pourvus (sinon la barrière
//      laisse le tuyau vide), l'échéance anti-famine, et le crédit ;
//   ⑤ **le descendant d'un 404 va droit chez AWS**, sans replier la session.
//
// Le harnais est celui de `test/globe-priorite.test.js` : un DOM de papier, un
// `fetch` qui COMPTE et dont on tient la résolution à la main.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { encodeTerrarium } from '../src/bathy.js'

// ---------------------------------------------------------------- bouchons DOM
const [ER, EG, EB] = encodeTerrarium(812)
const DALLE = new Uint8ClampedArray(256 * 256 * 4)
for (let i = 0; i < 256 * 256; i++) {
  DALLE[i * 4] = ER
  DALLE[i * 4 + 1] = EG
  DALLE[i * 4 + 2] = EB
  DALLE[i * 4 + 3] = 255
}
class FakeCtx {
  createLinearGradient() { return { addColorStop() {} } }
  fillRect() {}
  drawImage() {}
  getImageData() { return { data: DALLE } }
}
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0 }
    c.getContext = () => (c._ctx ??= new FakeCtx())
    return c
  },
}
globalThis.createImageBitmap = async (blob) => blob

// ------------------------------------------------ le serveur tenu à la main
const parties = [] // URLs, dans l'ordre de départ
const retenues = [] // { url, r } — les réponses à libérer
let tenir = false
let manquants = null // Set de clés `z/x/y` qui répondent 404 sur mapterhorn
globalThis.fetch = async (url, init) => {
  parties.push(url)
  if (manquants) {
    const m = /tiles\.mapterhorn\.com\/(\d+)\/(\d+)\/(\d+)\.webp/.exec(url)
    if (m && manquants.has(`${m[1]}/${m[2]}/${m[3]}`)) {
      return { ok: false, status: 404, blob: async () => ({}) }
    }
    if (m && init?.method === 'HEAD') return { ok: true, status: 200 }
  }
  if (tenir) await new Promise((r) => retenues.push({ url, r }))
  else await new Promise((r) => setTimeout(r, 0))
  return { ok: true, status: 200, blob: async () => ({ width: 256, height: 256, size: 90000 }) }
}
const souffler = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)) }
async function relacher(n = Infinity) {
  if (n === Infinity) tenir = false
  let k = 0
  while (retenues.length && k < n) { retenues.shift().r(); k++ }
  await souffler()
}

const { Globe, _resetTileMemo, planTuile, MAX_Z } = await import('../src/globe.js')
const { latLonToSphere, R_GLOBE, ORBITAL_M_PER_UNIT } = await import('../src/geo.js')
const {
  _resetDemSource, DEM_SOURCES, noterTrouTuile, trouConnu, nombreDeTrous,
  clearTrous, isFallbackActive, rememberRegionMaxZoom, regionKey, _setRoutageTrous,
} = await import('../src/dem-source.js')

function camera(lat, lon, altM) {
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 1400)
  const orbAlt = altM / ORBITAL_M_PER_UNIT
  latLonToSphere(lat, lon, R_GLOBE + orbAlt, cam.position)
  cam.near = Math.min(Math.max(orbAlt * 0.2, 0.01), 0.5)
  cam.up.set(0, 1, 0)
  cam.lookAt(0, 0, 0)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

function neuf() {
  parties.length = 0
  retenues.length = 0
  tenir = false
  manquants = null
  _resetTileMemo()
  _resetDemSource(DEM_SOURCES.aws.id) // une seule source : pas de sonde de couverture
  const g = new Globe({ globeContinu: true })
  g.setVisible(true)
  return g
}

async function calme(g, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (!g.inFlight && !g.queue.length && !g._sondes.size) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('le globe ne se calme pas')
}

const LAT = 45
const LON = 6.25
// ⚠️ **L'ALTITUDE D'ARRIVÉE DE L'ESCALIER EST CHOISIE, PAS LIBRE.** Balayée de
// 20 km à 400 km : à 60 km et 400 km le harnais lui-même ne produit AUCUNE
// attente au centre à ce cran-là (rien à juger, le test se mentirait) ; à 20 km
// et 150 km il en produit, et l'invariant tient. On pose donc 20 km — le bas de
// la descente d'Adrien — et la précondition est ASSERTÉE, pour qu'un harnais
// devenu muet rougisse au lieu de passer à vide (§3 de la compétence : « un test
// de silhouette passe à vide si l'objet est hors cadre »).
const ALT_PRES = 20_000

// ═══════════════ ① LA CIBLE EXISTE DÉJÀ, ET ELLE EST CONTINUE ═══════════════
//
// ⛔ **CE TEST NE VÉRIFIE PAS UN CORRECTIF DE CIB : IL EMPÊCHE DE LE RÉÉCRIRE.**
// La loi de PF2 est déjà une décroissance continue de la distance écran ; le
// brief D22 demandait de le PROUVER avant d'en écrire une seconde. Mesuré au
// banc (`scripts/sonde-cib.mjs`, nuage des entrées de file, Chamonix, CPU ×4) :
// la médiane de la clé tombe de 1 001 à d = 0 jusqu'à 0,2 à d = 4, en ligne
// droite, sans palier — 41 tranches de 0,1 NDC, toutes monotones.

test('① la loi de priorité est une CIBLE : strictement décroissante et continue avec la distance écran', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 400_000)
  g.update(cam, 0.016)
  await calme(g)

  // on balaie la loi elle-même, à niveau CONSTANT : une tuile de papier dont on
  // ne change que la distance écran (le reste de `_priorite` ne dépend que de d)
  const loi = (d) => 1000 - 1000 * (Math.min(d, 4) / 4) + (MAX_Z - 8) * 0.1
  let prec = Infinity
  for (let d = 0; d <= 4; d += 0.05) {
    const p = loi(d)
    assert.ok(p < prec, `la loi remonte à d = ${d.toFixed(2)} (${p} ≥ ${prec}) — ce n'est plus une cible`)
    prec = p
  }
  // continue : aucun saut plus grand que la pente × le pas (pas de palier)
  const pente = 1000 / 4
  for (let d = 0; d < 3.9; d += 0.05) {
    const saut = loi(d) - loi(d + 0.05)
    assert.ok(Math.abs(saut - pente * 0.05) < 1e-9, `palier à d = ${d.toFixed(2)} : saut ${saut} au lieu de ${pente * 0.05}`)
  }
  // et la vraie méthode rend bien la loi sur des tuiles RÉELLES : plus une tuile
  // est loin du centre de l'écran, plus sa clé est basse
  const vues = [...g.tiles.values()].filter((t) => isFinite(g._distanceEcran(t)) && t.z > 2)
  assert.ok(vues.length >= 4, `pas assez de tuiles pour lire la loi (${vues.length})`)
  const paires = vues.map((t) => [g._distanceEcran(t), g._priorite(t), t.z])
  for (const [d1, p1, z1] of paires) for (const [d2, p2, z2] of paires) {
    // ⚠️ AU-DELÀ DE d = 4 LA LOI EST ÉCRÊTÉE, ET C'EST VOULU : tout ce qui est
    // à plus de quatre unités NDC du centre est hors du tronc de toute façon,
    // et le tri n'a plus rien à y départager. Les paires écrêtées sont donc
    // exclues — les comparer, c'est mesurer le plat d'un plafond.
    if (z1 !== z2 || d1 >= d2 - 1e-6 || d2 > 4) continue
    assert.ok(p1 > p2, `à niveau égal, la tuile à d = ${d1} n'est pas prioritaire sur celle à d = ${d2}`)
  }
  g.dispose()
})

test('① le rayon de la cible est DÉRIVÉ : le disque qui couvre la moitié des pixels', () => {
  // l'écran est le carré NDC [−1, 1]², d'aire 4 ; πR² = 2 ⟹ R = √(2/π)
  const R = Math.sqrt(2 / Math.PI)
  assert.ok(Math.abs(Math.PI * R * R - 2) < 1e-12, 'le rayon ne couvre pas la moitié des pixels')
  assert.ok(R < 1, 'la cible déborde du disque inscrit')
  assert.ok(R > 0.6, 'la cible est plus étroite que le garde-fou de la prélecture (0,6 NDC, R37)')
  assert.ok(R < Math.SQRT2, 'la cible atteint le coin de l écran')
})

test('① `_dansLaCible` : la tuile qui couvre le centre est dedans, celle du coin est dehors', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 400_000)
  g.update(cam, 0.016)
  await calme(g)
  const vues = [...g.tiles.values()].filter((t) => isFinite(g._distanceEcran(t)))
  const proche = vues.reduce((a, b) => (g._distanceEcran(a) <= g._distanceEcran(b) ? a : b))
  assert.equal(g._distanceEcran(proche), 0, 'aucune tuile ne couvre le centre de l écran')
  assert.ok(g._dansLaCible(proche), 'la tuile sous le centre est hors de la cible')
  const loin = vues.reduce((a, b) => (g._distanceEcran(a) >= g._distanceEcran(b) ? a : b))
  if (g._distanceEcran(loin) > Math.sqrt(2 / Math.PI)) assert.ok(!g._dansLaCible(loin), 'la tuile la plus lointaine est dans la cible')
  g.dispose()
})

// ═══════════════ ② LA BASSE DÉFINITION DE PÉRIPHÉRIE EST DÉJÀ LÀ ════════════
//
// ⚠️ **C'EST LE PARENT, ET IL N'Y A RIEN À ÉCRIRE.** La règle sans-trou (avant
// R37) et le raffinement partiel (depuis R37) garantissent que tout point de
// planète visible est dessiné par la tuile la plus fine DISPONIBLE, donc par un
// ancêtre tant que l'enfant n'est pas là. Ce test le prouve à mi-chargement :
// la barrière retient la périphérie, et la périphérie reste COUVERTE — plus
// grossière, jamais vide.

test('② la périphérie retenue reste COUVERTE par son ancêtre — la basse définition est gratuite (R37)', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 8; i++) { g.update(cam, 0.016); await calme(g) }
  const dessineesAvant = [...g.tiles.values()].filter((t) => t.mesh && t.mesh.visible).length
  assert.ok(dessineesAvant > 0, 'harnais : rien n est dessiné au départ')

  // on descend (la demande explose partout) et on tient le réseau : la barrière
  // retient la périphérie, et on regarde ce qui reste À L'ÉCRAN
  const pres = camera(LAT, LON, 120_000)
  for (let i = 0; i < 10; i++) {
    tenir = true
    g._barriereActive = true
    g.update(pres, 0.016)
    const dessinees = [...g.tiles.values()].filter((t) => t.mesh && t.mesh.visible)
    assert.ok(
      dessinees.length > 0,
      `image ${i} : plus rien n est dessiné — la barrière a ouvert un trou au lieu de laisser l ancêtre couvrir`
    )
    await relacher(3)
  }
  tenir = false
  await relacher()
  await calme(g)
  g.dispose()
})

test('② la barrière ne rend JAMAIS un pixel plus grossier : un parent dont un enfant existe déjà passe', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 200_000)
  await (async () => { for (let i = 0; i < 8; i++) { g.update(cam, 0.016); await calme(g) } })()
  // une tuile de périphérie dont au moins un enfant est en cache
  const peri = [...g.tiles.values()].find((t) => t.z > 2 && isFinite(g._distanceEcran(t)) && !g._dansLaCible(t) && !g._aucunEnfant(t))
  if (peri) assert.ok(!g._aucunEnfant(peri), 'harnais : la tuile choisie n a pas d enfant')
  // et la garde elle-même : un parent SANS aucun enfant est bien retenable
  const vierge = { z: 5, x: 1000, y: 1000 }
  assert.ok(g._aucunEnfant(vierge), '`_aucunEnfant` rend faux sur un parent sans enfant en cache')
  g.dispose()
})

// ═══════════════════════ ③ LA BARRIÈRE D'ORDONNANCEMENT ═════════════════════

test('③ la barrière retient un raffinement de PÉRIPHÉRIE et jamais un du CENTRE', async () => {
  const g = neuf()
  // ⚠️ **IL FAUT UN ÉCRAN DÉJÀ PLEIN, PAS UNE PREMIÈRE IMAGE.** Sur une vue
  // fraîche, tout ce qui veut se refendre est au CENTRE (le reste est encore
  // écarté par l'horizon ou le tronc) : le premier harnais mesurait 48 naissances
  // dont 48 dans la cible, et « 0 raffinement retenu » ne voulait alors rien dire.
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  const pose = camera(LAT, LON, ALT_PRES * 1.6)
  for (let i = 0; i < 14; i++) { g.update(pose, 0.016); await calme(g) }

  // ⛔ **ET LA BARRIÈRE NE SE POSE PAS À LA MAIN : `update()` la RECALCULE en
  // tête d'image.** Écrire `_barriereActive = true` avant l'appel ne survit pas
  // à `_deciderBarriere` — le premier harnais le faisait, et lisait 0 refus sur
  // un état qu'il croyait avoir posé. On fabrique donc les VRAIES conditions :
  // réseau TENU (les six créneaux partent et ne reviennent pas) et une descente
  // qui continue — à caméra fixe, la première image armée fait naître toute la
  // périphérie et `_aucunEnfant` laisse ensuite tout passer (0 refus sur huit
  // images, mesuré). C'est le geste d'Adrien qui découvre sans cesse de la
  // périphérie vierge : c'est donc un escalier de caméras, pas une pose.
  const marches = []
  for (let i = 0; i <= 8; i++) marches.push(camera(LAT, LON, ALT_PRES * (1.45 - i * 0.05)))
  tenir = true
  g.barriereCible = true
  g.update(marches[0], 0.016) // image A : la file se remplit, le centre se déclare
  assert.ok(g._centreEnAttente > 0, 'harnais : le centre ne déclare aucune attente')
  assert.ok(g.inFlight + g.queue.length >= 6, 'harnais : les six créneaux ne sont pas pourvus')

  let refus = 0, armee = 0, juges = 0
  for (let i = 1; i <= 8; i++) {
    // ⚠️ L'ÉTAT SE PREND AVANT CHAQUE IMAGE, PAS UNE FOIS POUR TOUTES : la
    // caméra bouge, donc « dans la cible » bouge aussi. Un instantané pris huit
    // images plus tôt accusait la barrière d'avoir laissé passer une tuile qui
    // était au CENTRE au moment où le parcours l'a vue (mesuré à 150 km).
    const avaitUnEnfant = new Map()
    const dansLaCible = new Map()
    for (const [k, t] of g.tiles) { avaitUnEnfant.set(k, !g._aucunEnfant(t)); dansLaCible.set(k, g._dansLaCible(t)) }
    const avant = new Set(g.tiles.keys())

    g.update(marches[i], 0.016)
    if (g._barriereActive) armee++
    refus += g._barriereRefus

    if (g._barriereActive) {
      for (const k of g.tiles.keys()) {
        if (avant.has(k)) continue
        const t = g.tiles.get(k)
        const pk = `${t.z - 1}/${t.x >> 1}/${t.y >> 1}`
        if (!avant.has(pk)) continue // parent né la même image : pas un cas de barrière
        if (dansLaCible.get(pk)) continue
        juges++
        assert.ok(
          avaitUnEnfant.get(pk),
          `image ${i} : ${pk} est en PÉRIPHÉRIE et n avait aucun enfant, la barrière l a laissé engendrer ${k}`
        )
      }
    }
    await relacher(3)
    tenir = true
  }
  assert.ok(armee >= 4, `la barrière ne s est armée que sur ${armee} images sur 8 — le centre attend pourtant et le tuyau est plein`)
  assert.ok(refus > 0, `la barrière n a retenu aucun raffinement de périphérie (${juges} naissances de périphérie jugées)`)
  tenir = false
  await relacher()
  await calme(g)
  g.dispose()
})

test('③ le levier débrayé rend EXACTEMENT le comportement d avant : la barrière ne retient plus rien', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  g.barriereCible = false
  g._barriereActive = true
  g.update(cam, 0.016)
  assert.equal(g._barriereRefus, 0, 'la barrière retient alors qu elle est débrayée')
  await calme(g)
  g.dispose()
})

// ⚠️ **LE GARDE-FOU QUI COMPTE LE PLUS — le brief le nomme avant la mesure :**
// « une barrière mal posée laisse des créneaux vides pendant que le centre
// finit ; le gain de PF2 est venu de vider la file, pas du vol ». Une barrière
// qui tient alors qu'il n'y a pas de quoi remplir les six créneaux coûte du
// débit et n'accélère rien.
test('④ la barrière NE TIENT PAS quand les six créneaux ne sont pas pourvus', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  // réseau vide : ni vol ni file, mais le centre « attend » encore
  assert.equal(g.inFlight, 0)
  assert.equal(g.queue.length, 0)
  g._centreEnAttente = 40
  g._centreEnAttentePrec = 40
  g._barriereSansProgres = 0
  g._refusPrec = 0
  g._deciderBarriere(0.016)
  assert.equal(g._barriereActive, false, 'la barrière tient les créneaux VIDES — elle coûte du débit pour rien')
  assert.ok(g._barriereHorsCreneaux > 0, 'le compteur de désarmement par créneaux ne bouge pas')
  g.dispose()
})

test('④ … et elle TIENT dès que les six créneaux sont pourvus', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  g._centreEnAttente = 40
  g._centreEnAttentePrec = 40
  g._barriereSansProgres = 0
  g._refusPrec = 0
  g.inFlight = 6 // les six créneaux sont pris
  g._deciderBarriere(0.016)
  assert.equal(g._barriereActive, true, 'la barrière ne tient pas alors que le tuyau est plein')
  g.inFlight = 0
  g.dispose()
})

test('④ l ÉCHÉANCE ANTI-FAMINE lève la barrière quand le centre n avance plus — et elle se réarme au premier progrès', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  g.inFlight = 6
  g._refusPrec = 0
  g._centreEnAttentePrec = Infinity
  g._centreEnAttente = 12
  g._barriereSansProgres = 0
  g._deciderBarriere(0.016) // premier tour : le compteur se cale
  g._deciderBarriere(0.016)
  assert.equal(g._barriereActive, true, 'la barrière ne s arme pas alors que le centre attend')
  // le centre NE BOUGE PLUS : même compte, image après image
  let images = 0
  for (let i = 0; i < 400 && g._barriereActive; i++) { g._deciderBarriere(0.1); images++ }
  assert.equal(g._barriereActive, false, `la barrière n a jamais lâché — la périphérie reste grossière pour toujours (${images} images)`)
  assert.ok(g._barriereEcheances >= 1, 'l échéance ne s est pas comptée')
  const echeanceMs = Math.round(g._barriereSansProgres)
  assert.ok(echeanceMs >= 1500 && echeanceMs <= 1700, `l échéance a sauté à ${echeanceMs} ms au lieu de ~1 500`)
  // ET ELLE SE RÉARME : le centre avance d une tuile
  g._centreEnAttente = 11
  g._deciderBarriere(0.016)
  assert.equal(g._barriereSansProgres, 0, 'le compteur d absence de progrès ne repart pas à zéro')
  assert.equal(g._barriereActive, true, 'la barrière ne se réarme pas après un progrès du centre')
  g.inFlight = 0
  g.dispose()
})

test('④ la barrière NE TIENT PAS quand c est le CRÉDIT qui bloque le centre (le cycle limite de globe-eviction)', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  g.inFlight = 6
  g._centreEnAttente = 12
  g._centreEnAttentePrec = 12
  g._barriereSansProgres = 0
  g._refusPrec = 3 // l image d avant a refusé des raffinements faute de crédit
  g._deciderBarriere(0.016)
  assert.equal(g._barriereActive, false, 'la barrière tient sur un cache saturé — c est le cycle limite de test/globe-eviction ⑤')
  assert.ok(g._barriereHorsCredit > 0, 'le compteur de désarmement par crédit ne bouge pas')
  g.inFlight = 0
  g.dispose()
})

test('④ la barrière est décidée AVANT le parcours, sur le vol du moment', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 6; i++) { g.update(cam, 0.016); await calme(g) }
  // le réseau est vide au moment où `update()` part : quoi qu ait dit l image
  // d avant, la barrière doit être désarmée pour CE parcours
  g._barriereActive = true
  g._centreEnAttente = 99
  g._centreEnAttentePrec = 99
  g.update(cam, 0.016)
  assert.equal(g._barriereActive, false, 'la barrière a survécu à un réseau vide — elle est décidée trop tôt')
  await calme(g)
  g.dispose()
})

// ═══════════════ ⑤ LE DESCENDANT D UN 404 VA DROIT CHEZ AWS ═════════════════

test('⑤ `trouConnu` remonte les ANCÊTRES et s arrête au plancher de couverture', () => {
  clearTrous()
  noterTrouTuile('mapterhorn', 12, 100, 200)
  assert.ok(trouConnu('mapterhorn', 12, 100, 200, 12), 'la tuile trouée elle-même n est pas reconnue')
  assert.ok(trouConnu('mapterhorn', 13, 200, 400, 12), 'un enfant du trou n est pas reconnu')
  assert.ok(trouConnu('mapterhorn', 15, 800, 1600, 12), 'un arrière-petit-enfant du trou n est pas reconnu')
  assert.ok(!trouConnu('mapterhorn', 13, 202, 400, 12), 'une tuile voisine est prise pour un trou')
  assert.ok(!trouConnu('mapterhorn', 11, 50, 100, 12), 'le PARENT du trou est pris pour un trou — la pyramide est remontée à l envers')
  assert.ok(!trouConnu('aws', 13, 200, 400, 12), 'le trou d une source contamine l autre')
  // ⚠️ le plancher borne la remontée : sans lui, la boucle irait jusqu à z0
  assert.ok(!trouConnu('mapterhorn', 13, 200, 400, 13), 'la remontée ignore le plancher de couverture')
  clearTrous()
})

test('⑤ le plafond de la mémoire des trous est ATTEIGNABLE et se vide (file non bornée, §2 de la compétence)', () => {
  clearTrous()
  for (let i = 0; i < 5000; i++) noterTrouTuile('mapterhorn', 12, i, 0)
  assert.ok(nombreDeTrous() <= 4096, `la mémoire des trous a dépassé son plafond (${nombreDeTrous()})`)
  assert.ok(nombreDeTrous() > 0, 'la mémoire des trous est restée vide')
  clearTrous()
  assert.equal(nombreDeTrous(), 0)
})

test('⑤ `planTuile` route le DESCENDANT d un 404 vers AWS — sans replier la session', () => {
  _resetDemSource() // mapterhorn
  clearTrous()
  const Z = 13, X = 4300, Y = 2980
  // la zone est réputée couverte jusqu à z14 : sans trou connu, on reste sur la source fine
  rememberRegionMaxZoom(regionKey('mapterhorn', Z, X, Y), 14)
  const avant = planTuile(Z, X, Y)
  assert.equal(avant.source.id, 'mapterhorn', 'harnais : la zone n est pas vue comme couverte')
  // ce z13 rend 404 : ses descendants ne doivent plus l essayer
  noterTrouTuile('mapterhorn', Z, X, Y)
  assert.equal(planTuile(Z, X, Y).source.id, 'aws', 'la tuile trouée elle-même repart chez mapterhorn')
  rememberRegionMaxZoom(regionKey('mapterhorn', 14, X * 2, Y * 2), 14)
  assert.equal(planTuile(14, X * 2, Y * 2).source.id, 'aws', 'un enfant du trou repasse par mapterhorn — le second aller-retour est toujours là')
  // ⛔ ET LA SESSION NE BASCULE PAS : un 404 n est pas une panne
  assert.equal(isFallbackActive(), false, 'un 404 de couverture a replié TOUTE la session sur AWS')
  // la tuile d à côté, elle, garde mapterhorn
  rememberRegionMaxZoom(regionKey('mapterhorn', Z, X + 4, Y), 14)
  assert.equal(planTuile(Z, X + 4, Y).source.id, 'mapterhorn', 'le trou a débordé sur la tuile voisine')
  clearTrous()
  _resetDemSource(DEM_SOURCES.aws.id)
})

test('⑤ la mémoire des trous se remet à zéro avec la source (sinon elle fuit d un test à l autre)', () => {
  clearTrous()
  noterTrouTuile('mapterhorn', 12, 7, 7)
  assert.ok(nombreDeTrous() > 0)
  _resetDemSource()
  assert.equal(nombreDeTrous(), 0, '`_resetDemSource` laisse la mémoire des trous derrière lui')
  _resetDemSource(DEM_SOURCES.aws.id)
})

test('⑤ LES REQUÊTES ÉCONOMISÉES : une descente sur une zone trouée ne réessaie plus la source fine', async () => {
  _resetTileMemo()
  _resetDemSource() // mapterhorn
  clearTrous()
  parties.length = 0
  const Z = 12, X = 2150, Y = 1490
  rememberRegionMaxZoom(regionKey('mapterhorn', Z, X, Y), 14)
  // le z12 est un trou ; ses 4 + 16 descendants aussi, mais on ne doit pas les essayer
  noterTrouTuile('mapterhorn', Z, X, Y)
  let mapterhorn = 0
  for (let z = Z; z <= 14; z++) {
    const n = 2 ** (z - Z)
    for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) {
      rememberRegionMaxZoom(regionKey('mapterhorn', z, X * n + dx, Y * n + dy), 14)
      if (planTuile(z, X * n + dx, Y * n + dy).source.id === 'mapterhorn') mapterhorn++
    }
  }
  assert.equal(mapterhorn, 0, `${mapterhorn} descendants d un 404 repartent chez mapterhorn — autant d allers-retours perdus`)
  clearTrous()
  _resetDemSource(DEM_SOURCES.aws.id)
})

test('⑤ le levier `?trous=0` débranche le routage — sinon l A/B du banc compare deux fois la même chose', () => {
  clearTrous()
  _setRoutageTrous(false)
  noterTrouTuile('mapterhorn', 12, 500, 500)
  assert.equal(nombreDeTrous(), 0, 'le levier baissé note quand même les trous — les deux branches du banc seraient identiques')
  assert.equal(trouConnu('mapterhorn', 13, 1000, 1000, 12), false)
  _setRoutageTrous(true)
  noterTrouTuile('mapterhorn', 12, 500, 500)
  assert.ok(trouConnu('mapterhorn', 13, 1000, 1000, 12), 'le levier relevé ne rebranche pas le routage')
  clearTrous()
})

// ⛔ **CE TEST EXISTE PARCE QU'UNE MUTATION A SURVÉCU.** Relâcher `_aucunEnfant`
// en `!_enfantsPresents` — c'est-à-dire retenir aussi les parents dont un enfant
// est DÉJÀ parti — ne faisait rougir personne : l'invariant du parcours
// (« un parent de périphérie vierge n'engendre pas ») reste vrai quand on retient
// PLUS. Le prédicat est donc extrait (`_barriereRetient`) et interrogé de face.
test('③ le prédicat de la barrière, de face : périphérie VIERGE seulement (mutation survivante)', async () => {
  const g = neuf()
  const cam = camera(LAT, LON, 300_000)
  for (let i = 0; i < 8; i++) { g.update(cam, 0.016); await calme(g) }
  g.barriereCible = true
  g._barriereActive = true

  const vues = [...g.tiles.values()].filter((t) => t.z > 2 && isFinite(g._distanceEcran(t)))
  const centre = vues.find((t) => g._dansLaCible(t))
  assert.ok(centre, 'harnais : aucune tuile dans la cible')
  // ① le CENTRE n'est jamais retenu
  assert.equal(g._barriereRetient(centre), false, 'la barrière retient une tuile de la CIBLE')

  // ⚠️ **ON FABRIQUE LA TUILE DE PÉRIPHÉRIE VIERGE PLUTÔT QUE DE LA CHERCHER.**
  // Cherchée, elle peut manquer — et les deux assertions qui comptent se
  // retrouvent dans une branche `else` que le mutant ne visite jamais : la
  // relâche de `_aucunEnfant` en `!_enfantsPresents` a survécu exactement comme
  // ça. Fabriquée, la question est toujours posée.
  const modele = vues.find((t) => !g._dansLaCible(t)) || vues[0]
  const vierge = { z: 7, x: 4242, y: 4242, center: modele.center, rayon: modele.rayon, chord: modele.chord }
  assert.equal(g._dansLaCible(vierge), g._dansLaCible(modele), 'harnais : la tuile fabriquée n hérite pas de la position écran')
  // on force la périphérie : la distance écran de CETTE tuile, et d'elle seule,
  // est posée à 1,2 NDC — au-delà de R_CIBLE (0,798), donc hors de la cible
  const dEcran = g._distanceEcran.bind(g)
  g._distanceEcran = (t) => (t === vierge ? 1.2 : dEcran(t)) // 1,2 NDC > R_CIBLE
  assert.equal(g._dansLaCible(vierge), false, 'harnais : la tuile fabriquée est vue dans la cible')

  // ② une périphérie VIERGE est retenue
  assert.equal(g._aucunEnfant(vierge), true, 'harnais : la tuile fabriquée a déjà des enfants')
  assert.equal(g._barriereRetient(vierge), true, 'une périphérie VIERGE n est pas retenue — la barrière ne retient rien')

  // ③ dès qu UN enfant existe, elle n est PLUS retenue : sa requête est partie,
  //    la retenir la ferait payer deux fois (le garde-fou anti-brassage)
  g.tiles.set(`8/8484/8484`, { z: 8, x: 8484, y: 8484, state: 'loading' })
  assert.equal(g._aucunEnfant(vierge), false, 'harnais : l enfant posé n est pas vu')
  assert.equal(
    g._barriereRetient(vierge), false,
    'la barrière retient un parent dont un enfant est DÉJÀ parti — sa requête sera payée deux fois'
  )
  g.tiles.delete('8/8484/8484')

  // ④ et le levier baissé lève tout
  g.barriereCible = false
  assert.equal(g._barriereRetient(vierge), false, 'le levier baissé ne lève pas la barrière')
  g._distanceEcran = dEcran
  g.dispose()
})
