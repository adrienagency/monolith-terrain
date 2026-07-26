import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSky, stepSky, resizeSky, lifeEnvelope, cloudDensity, cloudScale,
  cloudCountForTier, makeRng, CLOUD_COUNT_MIN, CLOUD_COUNT_MAX, CLOUD_HARD_MAX,
  CLUSTER_MIN, CLUSTER_MAX, ELONG_MAX, SKY_DEFAULTS,
} from '../src/clouds-sim.js'

// compte les GRAPPES : c'est l'unité que l'utilisateur appelle « un nuage »
const groups = (sky) => new Set(sky.clouds.map((c) => c.gid)).size
const NO_WIND = { wind: { dir: 0, speed: 0 } }

// ------------------------------------------------------------- peuplement
test('cloudCountForTier : plus la machine est faible, moins il y a de nuages', () => {
  const counts = [0, 1, 2, 3].map((t) => cloudCountForTier(t))
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] <= counts[i - 1], `palier ${i} devrait être ≤ ${i - 1}`)
  }
  assert.ok(counts.every((c) => c >= CLOUD_COUNT_MIN && c <= CLOUD_COUNT_MAX))
})

test('cloudCountForTier : le curseur de densité reste borné', () => {
  assert.equal(cloudCountForTier(0, 10) <= CLOUD_COUNT_MAX, true)
  assert.equal(cloudCountForTier(3, 0) >= CLOUD_COUNT_MIN, true)
})

// ----------------------------------------------------------------- la vie
test('lifeEnvelope : nulle à la naissance et à la mort, pleine à maturité', () => {
  assert.equal(lifeEnvelope(0), 0)
  assert.equal(lifeEnvelope(1), 0)
  assert.equal(lifeEnvelope(0.4), 1)
  assert.ok(lifeEnvelope(0.1) > 0 && lifeEnvelope(0.1) < 1)
  assert.ok(lifeEnvelope(0.8) > 0 && lifeEnvelope(0.8) < 1)
})

test('lifeEnvelope est continue — aucun saut qui ferait « pop » un nuage', () => {
  let prev = lifeEnvelope(0)
  for (let t = 0.01; t <= 1.0001; t += 0.01) {
    const v = lifeEnvelope(t)
    assert.ok(Math.abs(v - prev) < 0.2, `saut brutal en ${t.toFixed(2)}`)
    prev = v
  }
})

test('la dissipation dure plus longtemps que la croissance (très en douceur)', () => {
  // fenêtre de croissance ~0.18, fenêtre de dissipation ~0.45 : un nuage
  // s'efface bien plus lentement qu'il ne bourgeonne
  assert.ok(lifeEnvelope(0.2) === 1, 'mûr très tôt')
  assert.ok(lifeEnvelope(0.75) > 0.4, 'encore bien présent aux trois quarts de sa vie')
  assert.ok(lifeEnvelope(0.95) < 0.15, 'presque éteint à la toute fin')
})

test('un nuage naissant est plus petit ET plus transparent', () => {
  const jeune = { density: 1, age: 0.05 }
  const mur = { density: 1, age: 0.4 }
  assert.ok(cloudDensity(jeune) < cloudDensity(mur))
  assert.ok(cloudScale(jeune) < cloudScale(mur))
  assert.ok(cloudScale(mur) <= 1.0001)
})

test('un nuage qui sort de la carte s efface ET rapetisse (fade)', () => {
  const dedans = { density: 1, age: 0.4, fade: 1 }
  const dehors = { density: 1, age: 0.4, fade: 0.2 }
  assert.ok(cloudDensity(dehors) < cloudDensity(dedans))
  assert.ok(cloudScale(dehors) < cloudScale(dedans))
  // sans champ `fade` (nuage local), rien ne change
  assert.equal(cloudDensity({ density: 1, age: 0.4 }), cloudDensity(dedans))
})

// -------------------------------------------------------------- naissance
test('createSky peuple le nombre de GRAPPES demandé, chacune de 3 à 7 entités', () => {
  const sky = createSky({ count: 4, seed: 7 })
  assert.equal(groups(sky), 4)
  const bySize = new Map()
  for (const c of sky.clouds) bySize.set(c.gid, (bySize.get(c.gid) ?? 0) + 1)
  for (const [gid, n] of bySize) {
    assert.ok(n >= CLUSTER_MIN && n <= CLUSTER_MAX, `grappe ${gid} : ${n} entités`)
  }
  for (const c of sky.clouds) {
    assert.ok(c.r > 0 && c.h > 0, 'taille positive')
    assert.ok(c.age >= 0 && c.age < 1, 'âge initial valide')
    assert.ok(c.span > 0, 'durée de vie positive')
  }
  // le ciel est « déjà vivant » : les âges sont répartis, pas tous à zéro
  const ages = new Set(sky.clouds.map((c) => Math.round(c.age * 10)))
  assert.ok(ages.size > 3, `âges trop uniformes : ${[...ages]}`)
})

test('createSky est déterministe à graine égale (ciel rejouable)', () => {
  const a = createSky({ count: 4, seed: 42 })
  const b = createSky({ count: 4, seed: 42 })
  assert.deepEqual(a.clouds.map((c) => [c.x, c.z, c.r]), b.clouds.map((c) => [c.x, c.z, c.r]))
  const c = createSky({ count: 4, seed: 43 })
  assert.notDeepEqual(a.clouds.map((x) => x.x), c.clouds.map((x) => x.x))
})

test('une grappe est COHÉRENTE : les compagnons vivent dans le corps du cœur', () => {
  const sky = createSky({ count: 5, seed: 3 })
  const cores = new Map()
  for (const c of sky.clouds) if (c.lead) cores.set(c.gid, c)
  assert.equal(cores.size, 5, 'une grappe, un cœur')
  for (const c of sky.clouds) {
    if (c.lead) continue
    const core = cores.get(c.gid)
    const d = Math.hypot(c.x - core.x, c.z - core.z)
    assert.ok(d < core.r, `compagnon hors du corps : ${d.toFixed(2)} > ${core.r.toFixed(2)}`)
    assert.ok(c.r < core.r, 'un compagnon est plus petit que son cœur')
  }
})

test('les compagnons SUIVENT le cœur : vitesses proches mais toutes distinctes', () => {
  const sky = createSky({ count: 5, seed: 13 })
  const cores = new Map()
  for (const c of sky.clouds) if (c.lead) cores.set(c.gid, c)
  let checked = 0
  for (const c of sky.clouds) {
    if (c.lead) continue
    const core = cores.get(c.gid)
    const ratio = c.speed / core.speed
    assert.ok(ratio > 0.95 && ratio < 1.05, `vitesse trop différente : ×${ratio.toFixed(3)}`)
    assert.notEqual(c.speed, core.speed, 'mais jamais identique — la grappe doit respirer')
    assert.notEqual(c.seed, core.seed, 'chacun sa graine, donc sa forme')
    checked++
  }
  assert.ok(checked > 5, 'trop peu de compagnons testés')
})

test('allongement : modéré, borné à 3:1, la plupart des nuages restent ronds', () => {
  const es = []
  for (let s = 1; s <= 20; s++) {
    for (const c of createSky({ count: 4, seed: s }).clouds) es.push(c.elong)
  }
  for (const e of es) assert.ok(e >= 1 && e <= ELONG_MAX + 1e-9, `allongement hors bornes : ${e}`)
  assert.equal(ELONG_MAX, 3, 'le plafond demandé est 3:1')
  assert.ok(es.filter((e) => e < 1.5).length > es.length * 0.5, 'la majorité doit rester ronde')
  assert.ok(es.some((e) => e > 2), 'aucun nuage nettement étiré sur 20 ciels')
})

test('un gros nuage n est jamais tout plat', () => {
  for (let s = 1; s <= 25; s++) {
    const sky = createSky({ count: 5, seed: s, sizeMin: 2, sizeMax: 7 })
    for (const c of sky.clouds) {
      const aspect = c.h / c.r
      // plus la masse est large, plus le plancher d'épaisseur est haut
      const big = Math.max(0, Math.min(1, (c.r - 2) / 5))
      const floor = 0.12 + 0.3 * big * big
      assert.ok(aspect >= floor - 1e-9, `nuage r=${c.r.toFixed(1)} trop plat : ${aspect.toFixed(3)} < ${floor.toFixed(3)}`)
    }
  }
})

test('dans une grappe, au moins un nuage a du volume', () => {
  for (let s = 1; s <= 25; s++) {
    const sky = createSky({ count: 4, seed: s })
    const byGid = new Map()
    for (const c of sky.clouds) {
      if (!byGid.has(c.gid)) byGid.set(c.gid, [])
      byGid.get(c.gid).push(c)
    }
    for (const [gid, membres] of byGid) {
      assert.ok(membres.some((c) => c.h / c.r >= 0.42), `grappe ${gid} entièrement plate (ciel ${s})`)
    }
  }
})

test('zones d altitude : tirées au sort par ciel, pas des paliers figés', () => {
  const zonesDe = (seed) => createSky({ count: 4, seed }).opts.altZones.map((z) => +z.c.toFixed(3))
  const a = zonesDe(101), b = zonesDe(202)
  assert.ok(a.length >= 2 && a.length <= 4, `2 à 4 zones attendues, vu ${a.length}`)
  assert.notDeepEqual(a, b, 'deux ciels doivent avoir des étages différents')
  assert.deepEqual(zonesDe(101), a, 'mais un même ciel garde les siens (déterminisme)')
  for (const z of a) assert.ok(z >= 0 && z <= 1, `zone hors [0,1] : ${z}`)
})

test('altitudes : du sol au plafond, en étages, biaisées vers le haut', () => {
  const ys = []
  for (let s = 1; s <= 20; s++) {
    for (const c of createSky({ count: 5, seed: s, baseY: 0, topY: 8 }).clouds) {
      if (c.lead) ys.push(c.y)
    }
  }
  for (const y of ys) assert.ok(y >= 0 && y <= 8, `altitude hors plage : ${y}`)
  // les quatre étages sont tous servis — du fond de vallée au plafond
  const levels = new Set(ys.map((y) => Math.min(3, Math.floor(y / 2))))
  assert.equal(levels.size, 4, `étages manquants : ${[...levels].sort()}`)
  // mais le haut est nettement plus peuplé que le ras du sol, sinon la moitié
  // du ciel finit enterrée dans les montagnes
  const bas = ys.filter((y) => y < 2).length
  const haut = ys.filter((y) => y >= 6).length
  assert.ok(haut > bas * 2, `répartition non biaisée : ${bas} bas / ${haut} haut`)
})

// --------------------------------------------------------------- traversée
test('la grande majorité du ciel est DE PASSAGE (naît et meurt hors carte)', () => {
  let transit = 0, total = 0
  for (let s = 1; s <= 15; s++) {
    for (const c of createSky({ count: 5, seed: s }).clouds) {
      if (c.lead) { total++; if (c.transit) transit++ }
    }
  }
  const share = transit / total
  assert.ok(share > 0.75 && share < 1, `part de passage inattendue : ${share.toFixed(2)}`)
})

test('sans vent, personne ne traverse — sinon le ciel resterait hors champ', () => {
  const sky = createSky({ count: 5, seed: 8, wind: { dir: 0, speed: 0 } })
  assert.ok(sky.clouds.every((c) => !c.transit), 'aucun nuage de passage sans vent')
})

test('une grappe de passage naît HORS carte et s y efface (fade nul dehors)', () => {
  // pas de prefill : on regarde une naissance en cours de route
  const sky = createSky({ count: 1, seed: 5 })
  sky.clouds = []
  sky.target = 1
  stepSky(sky, 0.016, { wind: { dir: 0, speed: 1.2 } })
  const nes = sky.clouds.filter((c) => c.transit)
  assert.ok(nes.length >= CLUSTER_MIN, 'une grappe entière doit naître')
  for (const c of nes) {
    const dehors = Math.max(Math.abs(c.x), Math.abs(c.z))
    assert.ok(dehors > sky.opts.half, `né DANS la carte : ${dehors.toFixed(1)}`)
    assert.ok(cloudDensity(c) < 0.05, 'invisible à la naissance : il arrive de loin')
  }
})

test('un nuage de passage traverse puis DISPARAÎT dehors, et est remplacé', () => {
  const sky = createSky({ count: 2, seed: 6 })
  const wind = { wind: { dir: 0, speed: 3 } }
  const vus = new Set(sky.clouds.map((c) => c.gid))
  let sortie = false
  for (let i = 0; i < 400; i++) {
    stepSky(sky, 0.5, wind)
    for (const c of sky.clouds) vus.add(c.gid)
    if ([...vus].length > 2) sortie = true
    // à tout instant, aucun nuage ne stationne très loin hors carte
    const reach = sky.opts.half + sky.opts.fadeOut + 1e-6
    for (const c of sky.clouds) {
      assert.ok(c.x * 1 <= reach + 1, `nuage oublié en aval : ${c.x.toFixed(1)}`)
    }
  }
  assert.ok(sortie, 'aucune grappe n a traversé et été remplacée')
  assert.equal(groups(sky), 2, 'le ciel garde sa cible de grappes')
})

// ------------------------------------------------------------- advection
test('stepSky pousse les nuages dans la direction du vent', () => {
  const sky = createSky({ count: 2, seed: 5 })
  const x0 = sky.clouds.map((c) => c.x)
  stepSky(sky, 1, { wind: { dir: 0, speed: 2 } })
  const avance = sky.clouds.filter((c, i) => x0[i] !== undefined && c.x > x0[i]).length
  assert.ok(avance >= Math.floor(sky.clouds.length * 0.6), 'le gros du ciel avance avec le vent')
})

test('parallaxe : un nuage haut file plus vite qu un nuage bas', () => {
  const sky = createSky({ count: 2, seed: 6, baseY: 5, topY: 9 })
  const haut = { ...sky.clouds[0], x: 0, z: 0, y: 9, speed: 1, transit: false }
  const bas = { ...sky.clouds[0], x: 0, z: 0, y: 5, speed: 1, transit: false }
  sky.clouds = [haut, bas]
  stepSky(sky, 1, { wind: { dir: 0, speed: 1 } })
  assert.ok(haut.x > bas.x, 'le nuage haut devrait devancer le bas')
  assert.ok(bas.x > 0, 'le bas avance quand même')
})

test('stepSky : le peuplement reste borné, rien ne fuit à l infini', () => {
  // 4 grappes : c'est la cible du palier 0, et le budget d'entités (CLOUD_HARD_MAX)
  // est calibré pour la tenir avec de la place pour les dislocations
  const sky = createSky({ count: 4, seed: 11 })
  for (let i = 0; i < 400; i++) stepSky(sky, 0.5, { wind: { dir: 0.7, speed: 3 } })
  assert.ok(sky.clouds.length <= CLOUD_HARD_MAX, `peuplement ${sky.clouds.length}`)
  assert.equal(groups(sky), 4, 'la cible de grappes est tenue')
  const reach = sky.opts.half + sky.opts.fadeOut + 2
  for (const c of sky.clouds) {
    assert.ok(Math.hypot(c.x, c.z) <= reach * 2, `nuage échappé : ${c.x},${c.z}`)
  }
})

test('stepSky renouvelle le ciel (il ne se fige pas, il ne se vide pas)', () => {
  const sky = createSky({ count: 4, seed: 9 })
  const ids = new Set(sky.clouds.map((c) => c.gid))
  for (let i = 0; i < 200; i++) stepSky(sky, 1, { wind: { dir: 0.3, speed: 2 } })
  assert.equal(groups(sky), 4, 'peuplement tenu')
  const restants = sky.clouds.filter((c) => ids.has(c.gid)).length
  assert.ok(restants < sky.clouds.length, 'le ciel doit s être renouvelé')
  for (const c of sky.clouds) assert.ok(c.age >= 0 && c.age < 1, 'âge toujours valide')
})

test('stepSky ignore un dt nul ou négatif (pause, onglet caché)', () => {
  const sky = createSky({ count: 2, seed: 2 })
  const snap = sky.clouds.map((c) => ({ ...c }))
  stepSky(sky, 0)
  stepSky(sky, -1)
  assert.deepEqual(sky.clouds.map((c) => c.x), snap.map((c) => c.x))
  assert.deepEqual(sky.clouds.map((c) => c.age), snap.map((c) => c.age))
})

// ------------------------------------------------------- redimensionnement
test('resizeSky ajuste le peuplement en GRAPPES entières', () => {
  const sky = createSky({ count: 5, seed: 4 })
  const keep = sky.clouds[0].gid
  resizeSky(sky, 2)
  assert.equal(groups(sky), 2)
  assert.equal(sky.target, 2)
  assert.ok(sky.clouds.some((c) => c.gid === keep), 'les survivants ne sont pas régénérés')
  resizeSky(sky, 5)
  assert.equal(groups(sky), 5)
  assert.ok(sky.clouds.some((c) => c.gid === keep))
  for (const c of sky.clouds) assert.ok(c.r > 0 && c.span > 0, 'les nouveaux sont valides')
  // jamais au-delà du budget de boîtes raymarchées
  assert.ok(sky.clouds.length <= CLOUD_HARD_MAX)
})

// ------------------------------------------- regroupements, fusion, dislocation
test('humeur du ciel : un front regroupe, un ciel dispersé éparpille', () => {
  // sans vent : tout le monde est local, donc soumis à l'humeur du ciel
  const meanDist = (sky) => {
    const cs = sky.clouds.filter((c) => c.lead)
    let s = 0, n = 0
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        s += Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z)
        n++
      }
    return n ? s / n : 0
  }
  const front = createSky({ count: 6, seed: 1, wind: { dir: 0, speed: 0 }, grouping: { mode: 'front', centers: [{ x: 0, z: 0 }] } })
  const disperse = createSky({ count: 6, seed: 1, wind: { dir: 0, speed: 0 }, grouping: { mode: 'disperse', centers: null } })
  assert.ok(meanDist(front) < meanDist(disperse), 'un front doit serrer les nuages')
})

test('collision : le gros absorbe, le petit part en dissipation', () => {
  const sky = createSky({ count: 2, seed: 8, wind: { dir: 0, speed: 0 } })
  const [a, b] = sky.clouds
  a.x = 0; a.z = 0; a.r = 5; a.age = 0.3; a.merging = false; a.gid = 1
  b.x = 1; b.z = 0; b.r = 2; b.age = 0.3; b.merging = false; b.gid = 2
  sky.clouds = [a, b]
  sky.target = 0 // pas de repeuplement pendant l'essai
  stepSky(sky, 0.016, NO_WIND)
  assert.ok(a.rTarget > 5, 'le gros vise le volume combiné')
  assert.ok(b.age >= 0.6, 'le petit bascule en dissipation')
  assert.equal(b.merging, true)
})

test('les membres d une MÊME grappe ne fusionnent pas entre eux', () => {
  const sky = createSky({ count: 1, seed: 15, wind: { dir: 0, speed: 0 } })
  for (const c of sky.clouds) { c.age = 0.3; c.merging = false; c.x = 0; c.z = 0; c.r = 4 }
  sky.target = 0
  stepSky(sky, 0.016, NO_WIND)
  assert.ok(sky.clouds.every((c) => !c.merging), 'une grappe doit vivre serrée sans se manger')
})

test('dislocation : un nuage local en fin de vie se rompt en petits bouts', () => {
  const sky = createSky({ count: 1, seed: 31, wind: { dir: 0, speed: 0 } })
  sky.target = 0
  const parent = sky.clouds.find((c) => c.lead)
  sky.clouds = [parent]
  parent.x = 0; parent.z = 0
  parent.r = SKY_DEFAULTS.sizeMax
  parent.age = 0.65
  parent.transit = false
  parent.shattered = false
  parent.merging = false
  const r0 = parent.r
  stepSky(sky, 0.016, NO_WIND)
  const lambeaux = sky.clouds.filter((c) => c.shattered && c !== parent)
  assert.ok(lambeaux.length >= 3, `trop peu de lambeaux : ${lambeaux.length}`)
  for (const s of lambeaux) {
    assert.ok(s.r < r0 * 0.45, 'un lambeau est nettement plus petit que son nuage')
    assert.ok(s.wisp > (parent.wisp ?? 0), 'un lambeau est plus déchiqueté')
    assert.ok(Math.hypot(s.x, s.z) < r0 * 1.2, 'les lambeaux restent groupés au départ')
  }
  assert.equal(parent.shattered, true, 'un nuage ne se disloque qu une fois')
})

test('la dislocation ne se répète pas et respecte le plafond d entités', () => {
  const sky = createSky({ count: 3, seed: 33, wind: { dir: 0, speed: 0 } })
  for (const c of sky.clouds) { c.transit = false; c.age = 0.7; c.span = 1e6 }
  for (let i = 0; i < 200; i++) stepSky(sky, 0.05, NO_WIND)
  assert.ok(sky.clouds.length <= CLOUD_HARD_MAX, `plafond dépassé : ${sky.clouds.length}`)
})

test('makeRng : déterministe et dans [0,1)', () => {
  const a = makeRng(123), b = makeRng(123)
  for (let i = 0; i < 50; i++) {
    const v = a()
    assert.equal(v, b())
    assert.ok(v >= 0 && v < 1)
  }
})

// ------------------------------------------------------------- orographie
// Le relief est INJECTÉ (terrainAt) : le module reste pur, ces tests le
// prouvent en lui donnant des montagnes de papier.
test('orographie : un nuage ne traverse jamais le relief', () => {
  // sol plat à 0, sauf une muraille à x > 0 qui monte à 6
  const terrainAt = (x) => (x > 0 ? 6 : 0)
  const sky = createSky({ count: 1, seed: 44, baseY: 0, topY: 4, terrainAt, wind: { dir: 0, speed: 1 } })
  sky.target = 0
  const c = sky.clouds.find((e) => e.lead)
  sky.clouds = [c]
  c.x = -3; c.z = 0; c.y = 1.2; c.h = 1; c.transit = true
  for (let i = 0; i < 300; i++) stepSky(sky, 0.1, { wind: { dir: 0, speed: 1 } })
  if (c.x > 0) {
    assert.ok(c.y >= 6, `nuage DANS la montagne : y=${c.y.toFixed(2)} sol=6`)
  }
})

test('orographie : le versant au vent SOULÈVE le nuage', () => {
  const terrainAt = (x) => Math.max(0, x) // rampe qui monte vers l'est
  const sky = createSky({ count: 1, seed: 45, baseY: 0, topY: 10, terrainAt, wind: { dir: 0, speed: 1 } })
  sky.target = 0
  const c = sky.clouds.find((e) => e.lead)
  sky.clouds = [c]
  c.x = 0; c.z = 0; c.y = 5; c.h = 1; c.r = 2; c.transit = true
  const y0 = c.y
  for (let i = 0; i < 60; i++) stepSky(sky, 0.1, { wind: { dir: 0, speed: 1 } })
  assert.ok(c.y > y0, `le nuage aurait dû monter : ${y0} → ${c.y.toFixed(2)}`)
})

test('orographie : sans relief injecté, rien ne change (module pur)', () => {
  const a = createSky({ count: 2, seed: 46 })
  const b = createSky({ count: 2, seed: 46, terrainAt: null })
  for (let i = 0; i < 30; i++) {
    stepSky(a, 0.1, { wind: { dir: 0.5, speed: 1 } })
    stepSky(b, 0.1, { wind: { dir: 0.5, speed: 1 } })
  }
  assert.deepEqual(a.clouds.map((c) => [c.x, c.y]), b.clouds.map((c) => [c.x, c.y]))
})

test('orographie : le nuage ne descend pas sous la surface de l eau', () => {
  const terrainAt = () => -4 // fond marin
  const sky = createSky({ count: 1, seed: 47, baseY: 0, topY: 6, terrainAt, waterY: 0, wind: { dir: 0, speed: 0.5 } })
  sky.target = 0
  const c = sky.clouds.find((e) => e.lead)
  sky.clouds = [c]
  c.x = 0; c.z = 0; c.y = -2; c.h = 1; c.transit = true
  for (let i = 0; i < 100; i++) stepSky(sky, 0.1, { wind: { dir: 0, speed: 0.5 } })
  assert.ok(c.y > 0, `nuage sous l eau : y=${c.y.toFixed(2)}`)
})
