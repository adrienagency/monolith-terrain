import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placePeakCarts, easePeakOffset, PEAK_CONST } from '../src/peaks.js'

// Anti-chevauchement des repères de sommet (src/peaks.js). Deux exigences, et
// la seconde compte plus que la première :
//   1. deux cartouches ne se recouvrent jamais — ils s'évitent verticalement,
//      ou celui de moindre altitude se masque ;
//   2. ils ne SAUTILLENT pas quand la caméra bouge. Une version naïve qui
//      repose l'étiquette à chaque frame donne le mal de cœur, ce qui est pire
//      que le chevauchement qu'on corrige.

const W = 1600
const H = 900
const { PEAK_CART_H, PEAK_GAP, PEAK_MARGE, PEAK_DEADZONE } = PEAK_CONST

// boîte écran d'un cartouche posé — le CSS le centre sur le point et le pose
// PEAK_GAP px au-dessus, dx/dy déplacent ce bloc-là
const rectOf = (m, s) => ({
  x0: m.ax + s.dx - m.tw / 2,
  y0: m.ay + s.dy - PEAK_GAP - PEAK_CART_H,
  x1: m.ax + s.dx + m.tw / 2,
  y1: m.ay + s.dy - PEAK_GAP,
})
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

test('un sommet isolé garde sa place naturelle (aucun déplacement gratuit)', () => {
  const [s] = placePeakCarts([{ ax: 800, ay: 450, tw: 120 }], W, H)
  assert.equal(s.hidden, false)
  assert.equal(s.dx, 0)
  assert.equal(s.dy, 0)
})

test('massif dense : les cartouches posés ne se recouvrent JAMAIS', () => {
  // le cas réel : Grandes Jorasses / Walkerpfeiler / Pointe Whymper / Pointe
  // Croz, moins de 0,01° d'écart → quelques pixels en z11
  const list = [
    { ax: 800, ay: 450, tw: 150 },
    { ax: 802, ay: 451, tw: 140 },
    { ax: 799, ay: 452, tw: 130 },
    { ax: 803, ay: 449, tw: 145 },
  ]
  const spots = placePeakCarts(list, W, H)
  const shown = spots.map((s, i) => ({ s, r: rectOf(list[i], s) })).filter((o) => !o.s.hidden)
  for (let i = 0; i < shown.length; i++) {
    for (let j = i + 1; j < shown.length; j++) {
      assert.equal(overlap(shown[i].r, shown[j].r), false, `cartouches ${i} et ${j} superposés`)
    }
  }
  assert.ok(shown.length >= 2, 'au moins deux sommets doivent rester nommés')
  assert.ok(shown.length < list.length, 'ce qui ne rentre pas doit se masquer, pas s’empiler')
})

test('massif dense : le plus haut sommet garde la place naturelle, les suivants s’écartent EN Y', () => {
  // la liste arrive triée par altitude décroissante (fetchTopPeaks) : c’est
  // l’ordre de priorité du glouton, le sommet le plus haut sert en premier
  const list = [
    { ax: 800, ay: 450, tw: 150 },
    { ax: 801, ay: 450, tw: 150 },
  ]
  const [a, b] = placePeakCarts(list, W, H)
  assert.deepEqual({ dx: a.dx, dy: a.dy, hidden: a.hidden }, { dx: 0, dy: 0, hidden: false })
  assert.equal(b.hidden, false)
  assert.notEqual(b.dy, 0, 'le second doit coulisser en Y, pas rester dessus')
})

test('un sommet collé au bord haut bascule sous le point plutôt que de sortir du cadre', () => {
  const [s] = placePeakCarts([{ ax: 800, ay: 20, tw: 120 }], W, H)
  assert.equal(s.hidden, false)
  assert.ok(s.dy > 0, 'la place naturelle sort par le haut → il passe dessous')
  const r = rectOf({ ax: 800, ay: 20, tw: 120 }, s)
  assert.ok(r.y0 >= 2 && r.y1 <= H - 2)
})

test('un cartouche qui déborde du cadre en X se masque (le point, lui, reste)', () => {
  // ±1vw de jeu horizontal ne peut pas rattraper 40 px de débord
  const [s] = placePeakCarts([{ ax: 1595, ay: 450, tw: 120 }], W, H)
  assert.equal(s.hidden, true)
})

test('la marge de collision reste au-dessus de la zone morte du lissage', () => {
  // garde-fou : un cartouche figé dans sa zone morte est jusqu’à PEAK_DEADZONE
  // px de la place qu’on lui a réservée. Si la marge repassait en dessous, le
  // chevauchement reviendrait par la fenêtre sans qu’aucun autre test ne bronche.
  assert.ok(PEAK_MARGE > PEAK_DEADZONE, `marge ${PEAK_MARGE} doit dépasser la zone morte ${PEAK_DEADZONE}`)
})

// ---- lissage : la partie qui empêche le mal de cœur -------------------------

test('première pose : directe, sans glissement', () => {
  const m = {}
  easePeakOffset(m, 0, -30)
  assert.equal(m.ox, 0)
  assert.equal(m.oy, -30)
})

test('zone morte : sous 8 px de correction, le cartouche ne bouge PAS DU TOUT', () => {
  const m = { ox: 0, oy: 0 }
  for (let f = 0; f < 60; f++) easePeakOffset(m, 4, 6) // hypot ≈ 7,2 < 8
  assert.equal(m.ox, 0)
  assert.equal(m.oy, 0)
})

test('caméra qui frémit : 120 frames de tremblement ne déplacent aucun cartouche', () => {
  // le vrai test anti-jitter : deux sommets voisins, la caméra bouge d’un ou
  // deux pixels (souris, inertie de l’orbite). Les places calculées sont des
  // décalages QUANTIFIÉS (liste de candidats fixe), donc la cible ne change
  // pas ; et si elle changeait d’un cheveu, la zone morte l’absorberait.
  const base = [
    { ax: 800, ay: 450, tw: 150 },
    { ax: 801, ay: 450, tw: 150 },
  ]
  const state = [{}, {}]
  let first = null
  for (let f = 0; f < 120; f++) {
    const wob = Math.sin(f * 0.7) * 2
    const list = base.map((m) => ({ ...m, ax: m.ax + wob, ay: m.ay + Math.cos(f * 0.5) * 2 }))
    const spots = placePeakCarts(list, W, H)
    spots.forEach((s, i) => easePeakOffset(state[i], s.dx, s.dy))
    const pose = state.map((s) => `${s.ox},${s.oy}`).join('|')
    if (first == null) first = pose
    else assert.equal(pose, first, `frame ${f} : le cartouche a bougé sous un frémissement`)
  }
})

test('vrai changement de place : glissement LENT, mais qui va jusqu’au bout', () => {
  const m = {}
  easePeakOffset(m, 0, 0)
  easePeakOffset(m, 0, 60)
  assert.ok(m.oy > 0 && m.oy < 6, `un pas doit être un petit pas, pas un saut (${m.oy})`)
  let frames = 1
  while (m.moving && frames < 1000) { easePeakOffset(m, 0, 60); frames++ }
  assert.equal(m.oy, 60, 'il doit finir exactement à sa place')
  assert.ok(frames > 40, `le glissement doit rester lent (${frames} frames)`)
})

test('une fois engagé, il ne s’arrête pas en entrant dans la zone morte', () => {
  // sinon il resterait planté à 7 px de sa place, décalé pour toujours
  const m = {}
  easePeakOffset(m, 0, 0)
  let guard = 0
  while (Math.abs(60 - m.oy) > PEAK_DEADZONE && guard++ < 1000) easePeakOffset(m, 0, 60)
  const before = m.oy
  easePeakOffset(m, 0, 60)
  assert.notEqual(m.oy, before, 'le glissement doit continuer sous le seuil de déclenchement')
})

test('__peakSnap : pose instantanée (rendu image par image, tests)', () => {
  const m = { ox: 0, oy: 0 }
  easePeakOffset(m, -16, 59, true)
  assert.equal(m.ox, -16)
  assert.equal(m.oy, 59)
})
