import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  echantillonRetenu, fenetreMure, palierVise, createAdaptiveQuality,
  FENETRE_S, FENETRE_FRAMES, DOWN_FPS,
} from '../src/perf.js'

const ROOT = path.join(import.meta.dirname, '..')

// ---------------------------------------------------------------------------
// CE QUE CES TESTS PROTÈGENT
// ---------------------------------------------------------------------------
// Le 28/07/2026, sur un iMac 27" de 2015 (Retina 5K, Chrome, macOS) : « l'ordi
// souffle à fond, je dirais 3 images par seconde ». Le gouverneur de qualité
// était censé exister exactement pour ça. Il n'a rien fait, et l'enquête a
// trouvé DEUX raisons, toutes deux vérifiables sans GPU :
//
//   1. LE DELTA ÉTAIT DÉJÀ BORNÉ EN AMONT. main.js calculait
//      `Math.min(clock.getDelta(), 0.05)` — plafond légitime pour la
//      SIMULATION (une image à 2 s ne doit pas téléporter les bateaux) — et
//      passait ce même nombre au gouverneur. Conséquence : la moyenne mesurée
//      ne pouvait pas descendre sous 20 fps. Une machine à 3 fps et une machine
//      à 20 fps rendaient exactement le même chiffre, donc la même décision :
//      un seul palier, alors que la première en réclamait trois.
//
//   2. LA FENÊTRE SE COMPTAIT EN IMAGES, PAS EN SECONDES. 60 images avant tout
//      verdict : 1 s à 60 fps, mais VINGT SECONDES à 3 fps. Le boot en ignore
//      5, il faut 2,5 s sous le seuil, et 20 s séparent deux paliers. Le
//      premier palier tombait donc à 27,5 s, le deuxième à 47,5 s, le
//      troisième à 67,5 s. Les 47 secondes mesurées hier, à la seconde près.
//
// La règle qui en sort : PLUS LA MACHINE EST LENTE, PLUS LE GOUVERNEUR DOIT
// ÊTRE RAPIDE. C'est l'inverse qui se produisait.

// ---------------------------------------------------------------------------
// L'ÉCHANTILLON — distinguer un à-coup d'une machine lente
// ---------------------------------------------------------------------------

test('une image normale est toujours retenue', () => {
  assert.equal(echantillonRetenu(1 / 60, false).garde, true)
  assert.equal(echantillonRetenu(1 / 30, false).garde, true)
  assert.equal(echantillonRetenu(0.3, false).garde, true, '3 fps est une mesure, pas un à-coup')
})

test('un à-coup ISOLÉ est écarté — une reconstruction de terrain n’est pas un verdict', () => {
  // le fil principal se fige (chargement de tuiles, décompression, onglet qui
  // revient) : une seule image très longue, encadrée d'images normales.
  const r = echantillonRetenu(1.4, false)
  assert.equal(r.garde, false, 'une image à 1,4 s précédée d’images normales = à-coup')
  assert.equal(r.long, true, 'mais on se souvient qu’elle était longue')
})

test('DEUX images longues d’affilée ne sont plus un à-coup : c’est la vitesse réelle', () => {
  // ⚠️ LE CŒUR DU CORRECTIF. L'ancien code écartait TOUTE image de plus de
  // 0,5 s, sans mémoire. Une machine sous 2 fps ne produit QUE des images de
  // plus de 0,5 s : elle ne remplissait donc jamais la fenêtre, et le
  // gouverneur restait sourd — d'autant plus sourd qu'elle souffrait.
  const a = echantillonRetenu(1.4, false)
  assert.equal(a.garde, false)
  const b = echantillonRetenu(1.4, a.long)
  assert.equal(b.garde, true, 'la deuxième longue image compte : la machine EST lente')
})

test('une image aberrante (négative, NaN, onglet réveillé) est toujours écartée', () => {
  for (const dt of [0, -1, NaN, Infinity, 30]) {
    assert.equal(echantillonRetenu(dt, true).garde, false, `dt=${dt} ne doit jamais compter`)
  }
})

// ---------------------------------------------------------------------------
// LA FENÊTRE — en secondes d'abord, en images ensuite
// ---------------------------------------------------------------------------

test('à 60 fps la fenêtre mûrit sur le TEMPS, pas sur un compte d’images arbitraire', () => {
  // 60 fps : FENETRE_S secondes de signal, soit ~90 images à 1,5 s.
  const n = Math.ceil(FENETRE_S * 60)
  assert.equal(fenetreMure(n / 60, n), true)
  assert.equal(fenetreMure((n - 10) / 60, n - 10), false, 'moins d’une fenêtre = pas de verdict')
})

test('à 3 fps la fenêtre mûrit en ~2 s, pas en 20 s — c’est tout le correctif', () => {
  // ANCIEN COMPORTEMENT : 60 images obligatoires → 20 s d'attente à 3 fps.
  // NOUVEAU : FENETRE_FRAMES images suffisent dès que la durée est là.
  const images = FENETRE_FRAMES
  const secondes = images / 3
  assert.ok(secondes < 3, `${images} images à 3 fps = ${secondes.toFixed(1)} s, il en fallait 20`)
  assert.equal(fenetreMure(secondes, images), true)
})

test('une poignée d’images très longues ne suffit pas : il faut aussi un minimum d’images', () => {
  // 2 images de 3 s font 6 s de « signal » mais ne disent rien de fiable —
  // ce sont typiquement deux à-coups de chargement collés.
  assert.equal(fenetreMure(6, 2), false, 'la durée seule ne fait pas un verdict')
})

// ---------------------------------------------------------------------------
// LE PALIER VISÉ — la profondeur de la chute, pas un cran à la fois
// ---------------------------------------------------------------------------

test('au-dessus du seuil, on ne touche à rien', () => {
  assert.equal(palierVise(60, 0), 0)
  assert.equal(palierVise(DOWN_FPS + 1, 0), 0)
  assert.equal(palierVise(45, 2), 2, 'et on ne remonte pas non plus : la remontée a ses propres règles')
})

test('une machine juste en dessous du seuil ne descend que d’un cran', () => {
  // 25 fps, c'est jouable : on prend le palier le moins coûteux visuellement.
  assert.equal(palierVise(25, 0), 1)
  assert.equal(palierVise(25, 1), 2)
})

test('une machine à 15 fps saute DEUX crans d’un coup', () => {
  assert.equal(palierVise(15, 0), 2)
})

test('une machine à 3 fps va directement au palier plancher', () => {
  // ⚠️ Le cœur du symptôme 1. Un cran toutes les 20 s mettait 67,5 s à
  // atteindre T3 ; à 3 fps c'est une éternité, et le ventilateur souffle
  // pendant tout ce temps.
  assert.equal(palierVise(3, 0), 3)
  assert.equal(palierVise(8, 0), 3)
})

test('le palier visé ne remonte JAMAIS : c’est une descente, pas un asservissement', () => {
  // sinon une mesure basse suivie d'une mesure moins basse ferait osciller la
  // qualité à l'écran, ce qui se voit bien plus qu'un palier de trop.
  assert.equal(palierVise(25, 3), 3)
  assert.equal(palierVise(15, 3), 3)
})

// ---------------------------------------------------------------------------
// LE GOUVERNEUR ENTIER, À 3 IMAGES PAR SECONDE
// ---------------------------------------------------------------------------
// Les tests ci-dessus épinglent trois décisions isolées. Celui-ci fait tourner
// le VRAI contrôleur sur une machine simulée à 3 fps et mesure ce qui compte
// pour Adrien : au bout de combien de secondes le ventilateur se calme.

// Le contrôleur ne demande au monde extérieur que matchMedia, screen, document
// et performance. Quatre bouchons suffisent — pas de GPU, pas de canvas.
function machineSimulee() {
  const g = globalThis
  const sauve = { matchMedia: g.matchMedia, screen: g.screen, document: g.document, performance: g.performance }
  let horloge = 0
  g.matchMedia = () => ({ matches: false }) // desktop : pointeur fin
  g.screen = { width: 2560, height: 1440 }
  g.document = { addEventListener() {} }
  g.performance = { now: () => horloge * 1000 }
  return {
    avance: (s) => { horloge += s },
    rendre: () => Object.assign(g, sauve),
  }
}

function gouverneurDeTest() {
  const params = { pixelRatio: 2, shadowMode: 'dynamic', grain: 0.26, bokehEnabled: true, bokehScale: 1 }
  const annonces = []
  const aq = createAdaptiveQuality({
    params,
    renderer: { setPixelRatio() {}, setSize() {}, getPixelRatio: () => 1, domElement: {}, getContext: () => null },
    composer: { setSize() {} },
    applyShadowMode() {},
    announce: (m) => annonces.push(m),
    lake: null,
  })
  return { aq, params, annonces }
}

test('à 3 fps le gouverneur atteint le palier plancher en moins de 15 s, pas en 67', () => {
  const m = machineSimulee()
  try {
    const { aq, params } = gouverneurDeTest()
    const dt = 1 / 3 // 3 images par seconde, le chiffre d'Adrien
    let t = 0
    let arriveeT3 = null
    // 30 secondes de souffrance simulée
    for (let i = 0; i < 90; i++) {
      m.avance(dt)
      t += dt
      aq.update(dt)
      if (aq.tier === 3 && arriveeT3 === null) arriveeT3 = t
    }
    assert.equal(aq.tier, 3, 'une machine à 3 fps doit finir au palier plancher')
    assert.ok(
      arriveeT3 < 15,
      `le plancher doit être atteint vite : ${arriveeT3?.toFixed(1)} s (l'ancien code mettait 67,5 s)`
    )
    // et le plancher doit VRAIMENT avoir posé ses leviers
    assert.equal(params.pixelRatio, 0.85, 'la densité de rendu doit être retombée')
    assert.equal(params.grain, 0, 'le grain de film part au plancher')
    assert.equal(params._bloomTierOk, false, 'le bloom aussi')
  } finally { m.rendre() }
})

test('à 3 fps le gouverneur SAUTE les paliers au lieu d’en descendre un par 20 s', () => {
  const m = machineSimulee()
  try {
    const { aq, annonces } = gouverneurDeTest()
    for (let i = 0; i < 90; i++) { m.avance(1 / 3); aq.update(1 / 3) }
    assert.equal(aq.tier, 3)
    assert.equal(
      annonces.length, 1,
      `un seul changement annoncé, pas trois paliers égrenés : ${JSON.stringify(annonces)}`
    )
  } finally { m.rendre() }
})

test('une machine à 1,5 fps n’est plus INVISIBLE au gouverneur', () => {
  // ⚠️ LE CAS QUI ÉCHOUAIT TOTALEMENT. Sous 2 fps, toutes les images dépassent
  // 0,5 s : l'ancienne règle les écartait TOUTES, la fenêtre ne se remplissait
  // jamais, et le gouverneur ne bougeait pas d'un pouce — sur la machine qui en
  // avait le plus besoin.
  const m = machineSimulee()
  try {
    const { aq } = gouverneurDeTest()
    for (let i = 0; i < 60; i++) { m.avance(1 / 1.5); aq.update(1 / 1.5) }
    assert.equal(aq.tier, 3, 'à 1,5 fps le gouverneur doit descendre au plancher')
  } finally { m.rendre() }
})

test('une machine confortable n’est JAMAIS dégradée — le correctif ne doit rien coûter aux autres', () => {
  const m = machineSimulee()
  try {
    const { aq, params, annonces } = gouverneurDeTest()
    for (let i = 0; i < 3600; i++) { m.avance(1 / 60); aq.update(1 / 60) } // 60 s à 60 fps
    assert.equal(aq.tier, 0, 'une machine à 60 fps reste en pleine qualité')
    assert.equal(annonces.length, 0, 'et personne ne lui annonce quoi que ce soit')
    assert.equal(params.pixelRatio, 2, 'sa densité de rendu est intacte')
  } finally { m.rendre() }
})

test('un figement isolé (reconstruction de terrain) ne dégrade PAS une machine saine', () => {
  // La fenêtre plus courte rend le gouverneur plus nerveux : il faut vérifier
  // qu'il ne prend pas un à-coup de chargement pour une machine lente. C'est
  // exactement le compromis que ce correctif pouvait casser.
  const m = machineSimulee()
  try {
    const { aq, annonces } = gouverneurDeTest()
    for (let i = 0; i < 3600; i++) {
      m.avance(1 / 60); aq.update(1 / 60)
      if (i % 600 === 0) { m.avance(1.2); aq.update(1.2) } // un gel d'1,2 s toutes les 10 s
    }
    assert.equal(aq.tier, 0, 'six gels isolés ne font pas une machine lente')
    assert.equal(annonces.length, 0)
  } finally { m.rendre() }
})

// ---------------------------------------------------------------------------
// LE CHAÎNON QUI AVAIT CÉDÉ — main.js doit passer le delta RÉEL
// ---------------------------------------------------------------------------

test('main.js ne passe plus au gouverneur le delta borné de la simulation', () => {
  // Ce test lit le source parce que c'est le seul endroit où la faute était
  // visible : les deux fichiers, pris séparément, avaient l'air justes.
  const src = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8')
  const appel = src.match(/aq\.update\(([^)]*)\)/)
  assert.ok(appel, 'aq.update doit toujours être appelé dans la boucle')
  assert.notEqual(
    appel[1].trim(), 'dt',
    'aq.update(dt) rend le gouverneur aveugle sous 20 fps : `dt` est plafonné à 0,05 s pour la simulation'
  )
  assert.match(
    src, /const dtBrut = clock\.getDelta\(\)/,
    'le delta réel doit être nommé et gardé : c’est lui la mesure de performance'
  )
  assert.match(src, /aq\.update\(dtBrut\)/, 'le gouverneur mesure le temps réel écoulé')
})
