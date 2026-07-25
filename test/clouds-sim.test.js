import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createSky, stepSky, resizeSky, lifeEnvelope, cloudDensity, cloudScale,
  cloudCountForTier, makeRng, CLOUD_COUNT_MIN, CLOUD_COUNT_MAX, CLOUD_HARD_MAX,
  ELONG_MAX, SKY_DEFAULTS,
} from '../src/clouds-sim.js'

// ------------------------------------------------------- peuplement adaptatif
test('cloudCountForTier : plus la machine est faible, moins il y a de nuages', () => {
  const counts = [0, 1, 2, 3].map((t) => cloudCountForTier(t))
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] < counts[i - 1], `palier ${i} devrait être plus léger : ${counts}`)
  }
  assert.ok(counts.every((c) => c >= CLOUD_COUNT_MIN && c <= CLOUD_COUNT_MAX))
})

test('cloudCountForTier : le curseur de densité reste borné', () => {
  assert.equal(cloudCountForTier(0, 10) <= CLOUD_COUNT_MAX, true)
  assert.equal(cloudCountForTier(3, 0) >= CLOUD_COUNT_MIN, true)
})

// ------------------------------------------------------------ cycle de vie
test('lifeEnvelope : nulle à la naissance et à la mort, pleine à maturité', () => {
  assert.equal(lifeEnvelope(0), 0)
  assert.equal(lifeEnvelope(1), 0)
  assert.equal(lifeEnvelope(0.5), 1)
  // croissance plus vive que la dissipation (un cumulus bourgeonne vite)
  assert.ok(lifeEnvelope(0.15) > lifeEnvelope(0.85))
})

test('lifeEnvelope est continue — aucun saut qui ferait « pop » un nuage', () => {
  let prev = lifeEnvelope(0)
  for (let t = 0.01; t <= 1; t += 0.01) {
    const v = lifeEnvelope(t)
    assert.ok(Math.abs(v - prev) < 0.1, `saut à t=${t.toFixed(2)} : ${prev} → ${v}`)
    prev = v
  }
})

test('un nuage naissant est plus petit ET plus transparent', () => {
  const jeune = { age: 0.02, density: 1 }
  const mur = { age: 0.5, density: 1 }
  assert.ok(cloudDensity(jeune) < cloudDensity(mur))
  assert.ok(cloudScale(jeune) < cloudScale(mur))
  assert.equal(cloudScale(mur), 1)
})

// ------------------------------------------------------------- création
test('createSky peuple le nombre demandé, dans les bornes, avec des âges variés', () => {
  const sky = createSky({ count: 12, seed: 7 })
  assert.equal(sky.clouds.length, 12)
  const half = SKY_DEFAULTS.half
  for (const c of sky.clouds) {
    assert.ok(Math.abs(c.x) <= half && Math.abs(c.z) <= half, 'position dans les bornes')
    assert.ok(c.r > 0 && c.h > 0, 'taille positive')
    assert.ok(c.age >= 0 && c.age < 1, 'âge initial valide')
    assert.ok(c.span > 0, 'durée de vie positive')
  }
  // le ciel est « déjà vivant » : les âges sont répartis, pas tous à zéro
  const ages = new Set(sky.clouds.map((c) => Math.round(c.age * 10)))
  assert.ok(ages.size > 3, `âges trop uniformes : ${[...ages]}`)
})

test('createSky est déterministe à graine égale (ciel rejouable)', () => {
  const a = createSky({ count: 8, seed: 42 })
  const b = createSky({ count: 8, seed: 42 })
  assert.deepEqual(a.clouds.map((c) => [c.x, c.z, c.r]), b.clouds.map((c) => [c.x, c.z, c.r]))
  const c = createSky({ count: 8, seed: 43 })
  assert.notDeepEqual(a.clouds.map((x) => x.x), c.clouds.map((x) => x.x))
})

test('les nuages ne se posent pas les uns sur les autres, sauf les nichés', () => {
  // l'anti-chevauchement tient pour la MAJORITÉ ; une minorité naît
  // volontairement dans le corps d'un autre (demande d'Adrien), donc on borne
  // les recouvrements au lieu de les interdire
  const sky = createSky({ count: 8, seed: 3, sizeMin: 2, sizeMax: 3 })
  let overlaps = 0
  for (let i = 0; i < sky.clouds.length; i++) {
    for (let j = i + 1; j < sky.clouds.length; j++) {
      const a = sky.clouds[i], b = sky.clouds[j]
      if (Math.hypot(a.x - b.x, a.z - b.z) < (a.r + b.r) * 0.5) overlaps++
    }
  }
  assert.ok(overlaps <= 4, `trop de recouvrements : ${overlaps}/28 paires`)
})

test('des nuages naissent DANS le corps d un autre, en plus petit', () => {
  // sur plusieurs ciels, au moins un nuage doit être niché dans un plus gros
  let nested = 0
  for (let s = 1; s <= 12; s++) {
    const sky = createSky({ count: 8, seed: s })
    for (const a of sky.clouds) {
      for (const b of sky.clouds) {
        if (a === b || b.r <= a.r) continue
        // centre de `a` dans le corps de `b`, et nettement plus petit
        if (Math.hypot(a.x - b.x, a.z - b.z) < b.r * 0.6 && a.r < b.r * 0.75) nested++
      }
    }
  }
  assert.ok(nested > 0, 'aucun nuage niché sur 12 ciels')
})

test('allongement : la plupart ronds, certains vrais radeaux, jamais hors bornes', () => {
  const es = []
  for (let s = 1; s <= 30; s++) {
    for (const c of createSky({ count: 8, seed: s }).clouds) es.push(c.elong)
  }
  for (const e of es) assert.ok(e >= 1 && e <= ELONG_MAX + 1e-9, `allongement hors bornes : ${e}`)
  assert.ok(es.filter((e) => e < 1.6).length > es.length * 0.5, 'la majorité doit rester ronde')
  assert.ok(es.some((e) => e > 3.5), 'aucun radeau très allongé sur 30 ciels')
})

test('altitudes : plusieurs niveaux distincts, tous dans la plage demandée', () => {
  const sky = createSky({ count: 12, seed: 21, baseY: 0, topY: 8 })
  const ys = sky.clouds.map((c) => c.y)
  for (const y of ys) assert.ok(y >= 0 && y <= 8, `altitude hors plage : ${y}`)
  // les nuages ne vivent pas tous au même étage
  const levels = new Set(ys.map((y) => Math.round(y / 2)))
  assert.ok(levels.size >= 3, `trop peu de niveaux : ${[...levels]}`)
})

// ------------------------------------------------------------ advection
test('stepSky pousse les nuages dans la direction du vent', () => {
  const sky = createSky({ count: 4, seed: 5 })
  const x0 = sky.clouds.map((c) => c.x)
  const z0 = sky.clouds.map((c) => c.z)
  stepSky(sky, 1, { wind: { dir: 0, speed: 2 } }) // plein +x
  sky.clouds.forEach((c, i) => {
    assert.ok(c.x > x0[i], 'le nuage avance en x')
    assert.ok(Math.abs(c.z - z0[i]) < 1e-9, 'et ne dérive pas en z')
  })
})

test('parallaxe : un nuage haut file plus vite qu un nuage bas', () => {
  const sky = createSky({ count: 2, seed: 5 })
  const [bas, haut] = sky.clouds
  bas.y = SKY_DEFAULTS.baseY // plancher de la couche
  haut.y = SKY_DEFAULTS.topY // plafond
  bas.x = 0; haut.x = 0
  bas.speed = 1; haut.speed = 1 // on neutralise l aléa propre à chaque nuage
  stepSky(sky, 1, { wind: { dir: 0, speed: 2 } })
  assert.ok(haut.x > bas.x, `le haut devrait devancer le bas : ${bas.x} / ${haut.x}`)
  assert.ok(bas.x > 0, 'le bas avance quand même')
})

test('stepSky : le ciel s enroule, le peuplement ne fuit jamais', () => {
  const sky = createSky({ count: 6, seed: 11 })
  for (let i = 0; i < 400; i++) stepSky(sky, 0.5, { wind: { dir: 0.7, speed: 3 } })
  // les DIVISIONS peuvent faire croître le peuplement (c'est le rendu qui
  // retaille via resizeSky) — l'invariant est une borne, plus une égalité
  assert.ok(sky.clouds.length >= 6 && sky.clouds.length <= CLOUD_HARD_MAX, `peuplement ${sky.clouds.length}`)
  const lim = SKY_DEFAULTS.half * 1.15 + 1e-6
  for (const c of sky.clouds) {
    assert.ok(Math.abs(c.x) <= lim && Math.abs(c.z) <= lim, `nuage échappé : ${c.x},${c.z}`)
  }
})

test('stepSky remplace les nuages morts (le ciel ne se vide pas)', () => {
  const sky = createSky({ count: 5, seed: 9 })
  const ids = sky.clouds.map((c) => c.seed)
  // bien au-delà de la plus longue durée de vie
  for (let i = 0; i < 60; i++) stepSky(sky, 5)
  assert.ok(sky.clouds.length >= 5 && sky.clouds.length <= CLOUD_HARD_MAX, `peuplement ${sky.clouds.length}`)
  const renewed = sky.clouds.slice(0, 5).filter((c, i) => c.seed !== ids[i]).length
  assert.ok(renewed >= 4, `le ciel devrait s être renouvelé : ${renewed}/5`)
  for (const c of sky.clouds) assert.ok(c.age >= 0 && c.age < 1, 'âge toujours valide')
})

test('stepSky ignore un dt nul ou négatif (pause, onglet caché)', () => {
  const sky = createSky({ count: 3, seed: 2 })
  const snap = sky.clouds.map((c) => ({ ...c }))
  stepSky(sky, 0)
  stepSky(sky, -1)
  assert.deepEqual(sky.clouds.map((c) => c.x), snap.map((c) => c.x))
  assert.deepEqual(sky.clouds.map((c) => c.age), snap.map((c) => c.age))
})

// ------------------------------------------------------- redimensionnement
test('resizeSky ajuste le peuplement sans rejouer le ciel', () => {
  const sky = createSky({ count: 10, seed: 4 })
  const keep = sky.clouds[0].seed
  resizeSky(sky, 4)
  assert.equal(sky.clouds.length, 4)
  assert.equal(sky.clouds[0].seed, keep, 'les survivants ne sont pas régénérés')
  resizeSky(sky, 12)
  assert.equal(sky.clouds.length, 12)
  assert.equal(sky.clouds[0].seed, keep)
  for (const c of sky.clouds) assert.ok(c.r > 0 && c.span > 0, 'les nouveaux sont valides')
})

// ------------------------------------------------- regroupements & fusions
test('humeur du ciel : un front regroupe, un ciel dispersé éparpille', () => {
  const meanDist = (sky) => {
    let s = 0, n = 0
    for (let i = 0; i < sky.clouds.length; i++)
      for (let j = i + 1; j < sky.clouds.length; j++) {
        s += Math.hypot(sky.clouds[i].x - sky.clouds[j].x, sky.clouds[i].z - sky.clouds[j].z)
        n++
      }
    return s / n
  }
  const half = SKY_DEFAULTS.half
  const front = createSky({ count: 10, seed: 21, grouping: { mode: 'front', centers: [{ x: 4, z: -3 }] } })
  const libre = createSky({ count: 10, seed: 21, grouping: { mode: 'disperse', centers: null } })
  assert.ok(meanDist(front) < meanDist(libre) * 0.75,
    `front ${meanDist(front).toFixed(1)} devrait être bien plus serré que dispersé ${meanDist(libre).toFixed(1)}`)
  for (const c of front.clouds) assert.ok(Math.abs(c.x) <= half && Math.abs(c.z) <= half)
})

test('collision : le gros absorbe, le petit part en dissipation', () => {
  const sky = createSky({ count: 2, seed: 8, grouping: { mode: 'disperse', centers: null } })
  const [a, b] = sky.clouds
  // deux nuages mûrs posés l'un sur l'autre
  a.x = 0; a.z = 0; a.r = 5; a.age = 0.4
  b.x = 2; b.z = 0; b.r = 3; b.age = 0.4
  stepSky(sky, 0.1, { wind: { dir: 0, speed: 0 } })
  assert.ok(a.rTarget > a.r, 'le gros vise un rayon combiné')
  assert.ok(b.age >= 0.72 && b.merging, 'le petit bascule en dissipation')
  // la croissance est PROGRESSIVE, pas un saut
  const r0 = a.r
  stepSky(sky, 0.5, { wind: { dir: 0, speed: 0 } })
  assert.ok(a.r > r0 && a.r < a.rTarget + 1e-9, `croissance douce : ${r0} → ${a.r} (cible ${a.rTarget})`)
})

test('division : un gros nuage mûr se scinde en deux, près de lui', () => {
  const sky = createSky({ count: 2, seed: 6, grouping: { mode: 'disperse', centers: null } })
  const parent = sky.clouds[0]
  parent.x = 0; parent.z = 0
  parent.r = SKY_DEFAULTS.sizeMax * 1.3 // éligible
  parent.age = 0.4
  parent.merging = false
  sky.clouds[1].x = 50; sky.clouds[1].z = 50; sky.clouds[1].r = 1 // hors jeu
  const r0 = parent.r
  // la division est probabiliste (~1/20 s) : on laisse le temps passer
  let split = false
  for (let i = 0; i < 400 && !split; i++) {
    stepSky(sky, 0.25, { wind: { dir: 0, speed: 0 } })
    split = sky.clouds.length > 2
    parent.age = Math.min(parent.age, 0.5) // rester dans la fenêtre d'éligibilité
    parent.r = Math.max(parent.r, SKY_DEFAULTS.sizeMax * 1.1)
  }
  assert.ok(split, 'le nuage aurait dû se diviser')
  const child = sky.clouds[sky.clouds.length - 1]
  assert.ok(child.age < 0.2, 'l enfant naît jeune')
  assert.ok(Math.hypot(child.x - parent.x, child.z - parent.z) < r0 * 2.2, 'l enfant naît au flanc du parent')
  assert.ok(parent.r < r0, 'le parent a maigri')
})

test('effilochage : un nuage en fin de vie éclate en plein de petits bouts', () => {
  const sky = createSky({ count: 2, seed: 31 })
  const parent = sky.clouds[0]
  parent.x = 0; parent.z = 0
  parent.r = SKY_DEFAULTS.sizeMax
  parent.merging = false
  parent.shattered = false
  sky.clouds[1].x = 90; sky.clouds[1].z = 90; sky.clouds[1].r = 0.5 // hors jeu
  const r0 = parent.r
  let burst = false
  for (let i = 0; i < 600 && !burst; i++) {
    parent.age = 0.7 // maintenu dans la fenêtre de fin de vie
    stepSky(sky, 0.25, { wind: { dir: 0, speed: 0 } })
    burst = sky.clouds.length >= 5
  }
  assert.ok(burst, 'le nuage aurait dû s effilocher')
  const shards = sky.clouds.filter((c) => c.shattered && c !== parent)
  assert.ok(shards.length >= 3, `trop peu de lambeaux : ${shards.length}`)
  for (const s of shards) {
    assert.ok(s.r < r0 * 0.45, 'un lambeau est nettement plus petit que son nuage')
    assert.ok(s.wisp > (parent.wisp ?? 0), 'un lambeau est plus déchiqueté')
    assert.ok(Math.hypot(s.x, s.z) < r0 * 1.2, 'les lambeaux restent groupés au départ')
  }
  assert.ok(parent.age > 0.9, 'le parent s éteint, ses lambeaux lui survivent')
})

test('le surplus des divisions se résorbe vers la cible, sans couper un vivant', () => {
  const sky = createSky({ count: 6, seed: 17 })
  assert.equal(sky.target, 6)
  // surpeuplement artificiel, comme après une division
  sky.clouds.push({ ...sky.clouds[0], seed: 999, age: 0.97, span: 30 })
  sky.clouds.push({ ...sky.clouds[1], seed: 998, age: 0.98, span: 30 })
  assert.equal(sky.clouds.length, 8)
  for (let i = 0; i < 20; i++) stepSky(sky, 0.5, { wind: { dir: 0, speed: 0 } })
  assert.ok(sky.clouds.length <= 8, 'le peuplement ne gonfle pas indéfiniment')
  assert.ok(sky.clouds.length >= sky.target, 'le ciel ne descend jamais sous la cible')
  for (const c of sky.clouds) assert.ok(c.age >= 0 && c.age < 1, 'âge toujours valide')
})

test('makeRng : déterministe et dans [0,1)', () => {
  const a = makeRng(123), b = makeRng(123)
  for (let i = 0; i < 50; i++) {
    const v = a()
    assert.equal(v, b())
    assert.ok(v >= 0 && v < 1)
  }
})
