import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PinchTracker, pinchNotches, PINCH_DEAD_ZONE_PX, isTap, tapSlop } from '../src/gestes.js'

// Le pincement ne pilote PAS la caméra directement : il parle la seule langue
// que la machine à modes comprenne déjà, celle de la molette (un « cran »
// signé, plus le point de l'écran vers lequel on zoome). C'est ce qui permet
// au doigt d'emprunter exactement l'escalier de zoom de la souris — mêmes
// paliers de relief, mêmes butées, même élan — au lieu d'un dolly parallèle
// qui glisserait sans jamais raffiner le terrain.

const pt = (x, y, id = 0) => ({ id, x, y })

test('pinchNotches : écarter les doigts donne un cran NÉGATIF, comme la molette vers l’avant', () => {
  // deltaY < 0 = molette vers l'avant = on entre. Écarter = entrer.
  assert.ok(pinchNotches(100, 200) < 0)
})

test('pinchNotches : rapprocher les doigts donne un cran POSITIF', () => {
  assert.ok(pinchNotches(200, 100) > 0)
})

test('pinchNotches : c’est le RAPPORT qui compte, pas les pixels', () => {
  // doubler l'écartement doit coûter autant près du pouce que loin de lui,
  // sinon un pincement large sur tablette zoome dix fois plus qu'un petit
  assert.equal(pinchNotches(100, 200).toFixed(4), pinchNotches(300, 600).toFixed(4))
})

test('pinchNotches : un écartement nul ou absurde ne produit rien (jamais NaN)', () => {
  assert.equal(pinchNotches(0, 100), 0)
  assert.equal(pinchNotches(100, 0), 0)
  assert.equal(pinchNotches(100, 100), 0)
  assert.equal(pinchNotches(NaN, 100), 0)
})

test('pinchNotches : un seul pas est BORNÉ — un saut de doigt ne téléporte pas', () => {
  // un doigt qui saute d'un bord à l'autre de l'écran (rapport ×20) ne doit pas
  // valoir vingt crans de molette d'un coup : la machine à modes franchirait
  // plusieurs paliers de relief en une image.
  const enorme = Math.abs(pinchNotches(20, 800)) / 100 // en crans
  const raisonnable = Math.abs(pinchNotches(100, 200)) / 100
  assert.ok(enorme <= 4, `un pas vaut au plus 4 crans, reçu ${enorme}`)
  assert.ok(enorme > raisonnable)
})

// ---- le suiveur ------------------------------------------------------------

test('deux doigts qui s’écartent : le suiveur rend un cran et le centre du geste', () => {
  const p = new PinchTracker()
  assert.equal(p.start([pt(100, 500, 0), pt(300, 500, 1)]), true)
  const m = p.move([pt(50, 500, 0), pt(350, 500, 1)])
  assert.ok(m)
  assert.ok(m.deltaY < 0, 'écarter = entrer')
  assert.equal(m.clientX, 200, 'le zoom vise le MILIEU des deux doigts')
  assert.equal(m.clientY, 500)
})

test('un seul doigt n’est jamais un pincement', () => {
  const p = new PinchTracker()
  assert.equal(p.start([pt(100, 100, 0)]), false)
  assert.equal(p.move([pt(140, 100, 0)]), null)
})

test('trois doigts : on suit les DEUX PREMIERS, sans planter', () => {
  const p = new PinchTracker()
  assert.equal(p.start([pt(100, 500, 0), pt(300, 500, 1), pt(200, 700, 2)]), true)
  const m = p.move([pt(60, 500, 0), pt(340, 500, 1), pt(200, 700, 2)])
  assert.ok(m && m.deltaY < 0)
})

test('zone morte : deux doigts qui GLISSENT ensemble déplacent, ils ne zooment pas', () => {
  // c'est le conflit qui compte : OrbitControls fait déjà le déplacement à deux
  // doigts. Sans zone morte, le moindre tremblement d'écartement pendant un
  // déplacement ferait aussi zoomer, et la carte partirait en vrille.
  const p = new PinchTracker()
  p.start([pt(100, 500, 0), pt(300, 500, 1)])
  const m = p.move([pt(100, 560, 0), pt(300, 560, 1)]) // translation pure
  assert.equal(m, null)
})

test('zone morte : elle se franchit une fois, puis le geste zoome librement', () => {
  const p = new PinchTracker()
  p.start([pt(100, 500, 0), pt(300, 500, 1)])
  assert.equal(p.move([pt(98, 500, 0), pt(302, 500, 1)]), null) // 4 px : sous le seuil
  const franchi = p.move([pt(100 - PINCH_DEAD_ZONE_PX, 500, 0), pt(300 + PINCH_DEAD_ZONE_PX, 500, 1)])
  assert.ok(franchi, 'le seuil franchi, le pincement est reconnu')
  // une fois reconnu, même un tout petit mouvement compte : sinon le zoom
  // saccaderait à chaque image sous le seuil
  const suite = p.move([pt(100 - PINCH_DEAD_ZONE_PX - 3, 500, 0), pt(300 + PINCH_DEAD_ZONE_PX + 3, 500, 1)])
  assert.ok(suite && suite.deltaY < 0)
})

test('le cran se mesure par rapport au pas PRÉCÉDENT, pas au début du geste', () => {
  const p = new PinchTracker()
  p.start([pt(100, 500, 0), pt(300, 500, 1)]) // écart 200
  p.move([pt(50, 500, 0), pt(350, 500, 1)]) // écart 300
  const second = p.move([pt(0, 500, 0), pt(400, 500, 1)]) // écart 400
  // 300 → 400, pas 200 → 400 : sinon chaque image rejouerait tout le geste
  assert.equal(second.deltaY.toFixed(4), pinchNotches(300, 400).toFixed(4))
})

test('end() referme le geste : le pincement suivant repart de zéro', () => {
  const p = new PinchTracker()
  p.start([pt(100, 500, 0), pt(300, 500, 1)])
  p.move([pt(50, 500, 0), pt(350, 500, 1)])
  p.end()
  assert.equal(p.move([pt(0, 500, 0), pt(400, 500, 1)]), null, 'plus de geste en cours')
  p.start([pt(100, 500, 0), pt(300, 500, 1)])
  assert.equal(p.move([pt(100, 505, 0), pt(300, 505, 1)]), null, 'la zone morte est réarmée')
})

test('les doigts qui changent d’identifiant en cours de route ne font pas sauter le zoom', () => {
  // un doigt levé puis reposé arrive avec un nouvel id : sans re-amorçage, le
  // saut d'écartement se traduirait par un cran énorme.
  const p = new PinchTracker()
  p.start([pt(100, 500, 0), pt(300, 500, 1)])
  p.move([pt(60, 500, 0), pt(340, 500, 1)]) // franchit la zone morte
  const m = p.move([pt(390, 500, 7), pt(400, 500, 9)]) // autres doigts
  assert.equal(m, null, 'nouveau couple de doigts = nouveau geste, aucun cran')
})

// ---- l'appui bref : « j'ai touché LÀ » --------------------------------------
// Le clic-pour-plonger accepte 6 px de dérive. C'est juste pour une souris,
// c'est trop peu pour un doigt : la pulpe roule, et un appui franc dérive
// couramment de 8 à 12 px. À 6 px, un appui sur téléphone se lisait comme un
// glissé d'orbite — donc « je tape sur la carte et il ne se passe rien ».

test('la tolérance du doigt est plus large que celle de la souris', () => {
  assert.ok(tapSlop('touch') > tapSlop('mouse'))
  assert.equal(tapSlop('mouse'), 6, 'la souris garde EXACTEMENT le seuil d’avant')
  assert.equal(tapSlop('pen'), tapSlop('touch'), 'un stylet dérive comme un doigt')
  assert.equal(tapSlop(undefined), 6, 'source inconnue = prudence, seuil souris')
})

test('un appui franc au doigt compte, le même à la souris ne compte pas', () => {
  const g = { elapsedMs: 120, multiTouch: false }
  assert.equal(isTap({ ...g, moved: 9, pointerType: 'touch' }), true)
  assert.equal(isTap({ ...g, moved: 9, pointerType: 'mouse' }), false)
})

test('un vrai glissé n’est jamais un appui, quelle que soit la source', () => {
  assert.equal(isTap({ moved: 60, elapsedMs: 120, pointerType: 'touch' }), false)
})

test('un appui long n’est pas un appui bref', () => {
  assert.equal(isTap({ moved: 2, elapsedMs: 900, pointerType: 'touch' }), false)
  assert.equal(isTap({ moved: 2, elapsedMs: 399, pointerType: 'touch' }), true)
})

test('un second doigt annule l’appui — un pincement ne doit pas faire plonger', () => {
  // le cas vécu : on pince pour zoomer, le premier doigt bouge à peine, et au
  // relâcher l'app plonge d'un palier sur le point qu'il touchait.
  assert.equal(isTap({ moved: 2, elapsedMs: 150, pointerType: 'touch', multiTouch: true }), false)
})

test('isTap ne se laisse pas piéger par des mesures absurdes', () => {
  assert.equal(isTap({ moved: NaN, elapsedMs: 100, pointerType: 'touch' }), false)
  assert.equal(isTap({ moved: 2, elapsedMs: NaN, pointerType: 'touch' }), false)
  assert.equal(isTap({}), false)
})
