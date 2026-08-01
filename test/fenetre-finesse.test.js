import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE_ELASTIQUE, rappelElastique } from '../src/fenetre-course.js'
import { pasElan, V_ARRET } from '../src/fenetre-elan.js'
import { REPOS_S, V_REPOS, RES_REPOS_MAX, pasFinesse, finesseInitiale, resDeFinesse, resFinesses } from '../src/fenetre-finesse.js'

const DT = 1 / 60

// joue `n` images en gardant la fenêtre immobile
function immobile(etat, n, x = 0, z = 0) {
  for (let i = 0; i < n; i++) etat = pasFinesse(etat, { glisse: false, x, z, dt: DT })
  return etat
}

// ══════════ LA DESCENTE EST IMMÉDIATE ═══════════════════════════════════════

test('le doigt qui se pose fait tomber au grossier À L’IMAGE MÊME', () => {
  let e = immobile(finesseInitiale(), 60) // bien installé en fin
  assert.equal(e.fin, true)
  e = pasFinesse(e, { glisse: true, x: 0, z: 0, dt: DT })
  assert.equal(e.fin, false, 'une seule image de retard ferait payer 36 ms au premier pas du geste')
  assert.equal(e.change, true)
})

test('l’image qui bouge fait tomber au grossier même sans doigt posé (élan, rappel)', () => {
  let e = immobile(finesseInitiale(), 60)
  assert.equal(e.fin, true)
  // 10 unités en une image = 600 unités/s, très au-dessus de V_REPOS
  e = pasFinesse(e, { glisse: false, x: 10, z: 0, dt: DT })
  assert.equal(e.fin, false)
})

// ══════════ LA REMONTÉE EST DIFFÉRÉE ════════════════════════════════════════

test('le repos ne se déclenche pas avant REPOS_S, et se déclenche à REPOS_S', () => {
  let e = finesseInitiale()
  const images = Math.round(REPOS_S / DT)
  e = immobile(e, images - 1)
  assert.equal(e.fin, false, `à ${images - 1} images on ne doit pas encore raffiner`)
  e = immobile(e, 2)
  assert.equal(e.fin, true)
})

test('une seule image de mouvement remet le compteur à ZÉRO, elle ne le décrémente pas', () => {
  let e = finesseInitiale()
  e = immobile(e, Math.round(REPOS_S / DT) - 2) // presque au bout
  e = pasFinesse(e, { glisse: false, x: 5, z: 0, dt: DT }) // un à-coup
  assert.equal(e.repos, 0)
  e = immobile(e, 2, 5, 0)
  assert.equal(e.fin, false, 'un geste haché ne doit jamais laisser passer un raffinement')
})

// ══════════ LE PIÈGE DE LA BRANCHE : LA VITESSE MÉMORISÉE MENT ══════════════

test('le rappel élastique déplace SANS vitesse — et le repos ne part pas pendant', () => {
  // `rappelElastique` n'a aucune variable de vitesse : il écrit la position.
  // Un détecteur branché sur `_f3V` verrait « arrêté » et raffinerait en plein
  // mouvement. Celui-ci fait la dérivée de l'affiché, donc il le voit.
  let x = COURSE_ELASTIQUE + 12 // franchement hors course
  let e = finesseInitiale()
  e = pasFinesse(e, { glisse: false, x, z: 0, dt: DT }) // amorce
  let vues = 0
  for (let i = 0; i < 20; i++) {
    x = rappelElastique(x, COURSE_ELASTIQUE, DT)
    e = pasFinesse(e, { glisse: false, x, z: 0, dt: DT })
    if (!e.fin) vues++
  }
  assert.equal(vues, 20, 'aucune de ces 20 images ne doit être jugée « au repos »')
  assert.equal(e.fin, false)
})

test('la fin d’un élan complet : grossier tout du long, fin seulement après', () => {
  // Un vrai lancer, joué avec le VRAI `pasElan`, jusqu'à extinction — puis le
  // rappel élastique — puis le délai. À aucun moment avant la fin on ne doit
  // avoir raffiné : c'est le scénario qu'Adrien verra.
  let etat = { x: 0, z: 0, vx: 120, vz: 0 }
  let e = finesseInitiale()
  e = pasFinesse(e, { glisse: false, x: 0, z: 0, dt: DT })
  let images = 0
  while ((etat.vx !== 0 || etat.vz !== 0) && images < 600) {
    const r = pasElan(etat, DT, COURSE_ELASTIQUE)
    etat = { x: r.brutX, z: r.brutZ, vx: r.vx, vz: r.vz }
    e = pasFinesse(e, { glisse: false, x: r.x, z: r.z, dt: DT })
    assert.equal(e.fin, false, `image ${images} : raffiner pendant l’élan serait le clignotement`)
    images++
  }
  assert.ok(images > 30, `l’élan doit durer, il a duré ${images} images`)
  // puis le rappel s'éteint et le délai court
  let x = e.x
  for (let i = 0; i < 40; i++) {
    x = rappelElastique(x, COURSE_ELASTIQUE, DT)
    e = pasFinesse(e, { glisse: false, x, z: e.z, dt: DT })
  }
  e = immobile(e, Math.round(REPOS_S / DT) + 2, x, e.z)
  assert.equal(e.fin, true, 'une fois tout posé, le raffinement doit finir par venir')
})

test('V_REPOS est exactement V_ARRET — deux seuils pour « arrêté » divergeraient', () => {
  assert.equal(V_REPOS, V_ARRET)
})

// ══════════ L'AMORCE ════════════════════════════════════════════════════════

test('la première image n’invente pas une vitesse depuis un zéro par défaut', () => {
  // Ouvrir la carte avec la fenêtre déjà à 30 unités donnerait 1 800 unités/s.
  let e = finesseInitiale()
  e = pasFinesse(e, { glisse: false, x: 30, z: -12, dt: DT })
  assert.equal(e.repos, DT, 'la première image compte comme du repos, pas comme un bond')
  e = immobile(e, Math.round(REPOS_S / DT), 30, -12)
  assert.equal(e.fin, true)
})

test('un dt nul ou absent ne fabrique ni NaN ni division par zéro', () => {
  let e = finesseInitiale()
  for (const dt of [0, undefined, NaN, -1]) {
    e = pasFinesse(e, { glisse: false, x: 3, z: 4, dt })
    assert.ok(Number.isFinite(e.repos), `dt=${dt} rend repos=${e.repos}`)
    assert.equal(typeof e.fin, 'boolean')
  }
})

// ══════════ `change` NE MENT PAS ════════════════════════════════════════════

test('`change` est vrai exactement aux images de bascule, jamais entre', () => {
  let e = finesseInitiale()
  let bascules = 0
  for (let i = 0; i < 200; i++) {
    e = pasFinesse(e, { glisse: false, x: 0, z: 0, dt: DT })
    if (e.change) bascules++
  }
  assert.equal(bascules, 1, 'une seule bascule sur 200 images immobiles — sinon on reconstruit en boucle')
})

// ══════════ LA RÉSOLUTION SERVIE ════════════════════════════════════════════

test('resDeFinesse : grossier pendant le mouvement, le grain d’aujourd’hui au repos', () => {
  assert.equal(resDeFinesse(false, 768, 384), 384)
  assert.equal(resDeFinesse(true, 768, 384), 768)
})

test('resDeFinesse : le repos est PLAFONNÉ — 2048 ferait 302 Mo de grain sur l’emprise', () => {
  assert.equal(RES_REPOS_MAX, 768)
  assert.equal(resDeFinesse(true, 2048, 384), 768)
  assert.equal(resDeFinesse(true, 1024, 384), 768)
})

test('resDeFinesse : un choix PLUS BAS que le mode continu est respecté', () => {
  // Le mode continu bride une machine ; il ne la charge jamais plus que demandé.
  assert.equal(resDeFinesse(false, 256, 384), 256)
  assert.equal(resDeFinesse(true, 256, 384), 256)
})

// ══════════ LES DEUX FINESSES À PRÉPARER ════════════════════════════════════

test('resFinesses nomme les DEUX résolutions de l’aller-retour, dans cet ordre', () => {
  // L'ordre n'est pas cosmétique : celle du MOUVEMENT vient en premier parce
  // que c'est la moins chère à cuire et la plus urgente à avoir (elle est
  // réclamée au premier appui du doigt, pas 0,4 s après).
  assert.deepEqual(resFinesses(768, 384), [384, 768])
  assert.deepEqual(resFinesses(2048, 384), [384, 768], 'le repos reste plafonné à RES_REPOS_MAX')
})

test('resFinesses ne rend qu’UNE valeur quand il n’y a rien à alterner', () => {
  // Curseur à 256 : le mode continu ne bride plus rien, il n'y a qu'un maillage
  // et préchauffer deux fois le même champ le cuirait deux fois pour rien.
  assert.deepEqual(resFinesses(256, 384), [256])
  assert.deepEqual(resFinesses(384, 384), [384])
})

test('resFinesses s’accorde avec resDeFinesse — une seule règle, pas deux', () => {
  for (const voulue of [128, 256, 384, 512, 768, 1024, 2048]) {
    const l = resFinesses(voulue, 384)
    assert.ok(l.includes(resDeFinesse(false, voulue, 384)), `res ${voulue} : le mouvement manque`)
    assert.ok(l.includes(resDeFinesse(true, voulue, 384)), `res ${voulue} : le repos manque`)
    assert.equal(new Set(l).size, l.length, `res ${voulue} : doublon`)
  }
})
