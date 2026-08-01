import test from 'node:test'
import assert from 'node:assert/strict'
import { COURSE_ELASTIQUE, borneElastique, rappelElastique, avanceFenetre, poseDansLaCourse } from '../src/fenetre-course.js'

// La course d'une fenêtre de 56 unités dans une emprise 3×3 de 168 est de ±56 :
// exactement UNE largeur de socle dans chaque direction (étude §3.1).
test('la course vaut une largeur de socle dans chaque direction', () => {
  assert.equal(borneElastique(0, 56), 0)
  assert.equal(borneElastique(56, 56), 56)
  assert.equal(borneElastique(-56, 56), -56)
})

test("dans la course, le terrain suit le doigt EXACTEMENT", () => {
  // C'est la propriété que l'œil vérifie en premier : tant qu'on n'est pas au
  // bord, un pixel de geste doit valoir un pixel de terrain. Toute résistance
  // ici se sentirait comme un frottement.
  for (const v of [-55.9, -30, -0.001, 0, 12.5, 55.999]) assert.equal(borneElastique(v, 56), v)
})

test('au-delà de la course, ça résiste — et de plus en plus', () => {
  const a = borneElastique(66, 56) - 56 // 10 unités de trop
  const b = borneElastique(76, 56) - 56 // 20 unités de trop
  assert.ok(a > 0, 'le bord cède un peu, il ne bloque pas net')
  assert.ok(a < 10, `10 unités poussées ne doivent pas rendre 10 unités (${a})`)
  assert.ok(b > a, 'pousser plus avance encore un peu')
  assert.ok(b - a < a, 'mais de moins en moins : la résistance croît')
})

test('la butée est BORNÉE : on ne sort jamais loin, même en poussant à l’infini', () => {
  // Sans plafond, un geste très rapide arracherait la fenêtre hors de l'emprise
  // et on verrait le vide. Le débordement doit converger.
  const enorme = borneElastique(1e6, 56) - 56
  assert.ok(Number.isFinite(enorme), 'le débordement reste fini')
  assert.ok(enorme < 56, `le débordement reste sous une largeur de socle (${enorme})`)
})

test('la butée est impaire : les deux bords se comportent pareil', () => {
  for (const v of [60, 80, 200, 1e5]) assert.ok(Math.abs(borneElastique(-v, 56) + borneElastique(v, 56)) < 1e-9)
})

test('la butée est continue au passage du bord — aucun saut', () => {
  const dedans = borneElastique(55.999999, 56)
  const dehors = borneElastique(56.000001, 56)
  assert.ok(Math.abs(dehors - dedans) < 1e-4, `saut de ${dehors - dedans} au franchissement`)
})

test('la butée est croissante : pousser plus ne recule jamais', () => {
  let prec = -Infinity
  for (let v = -200; v <= 200; v += 0.7) {
    const q = borneElastique(v, 56)
    assert.ok(q >= prec - 1e-9, `recul à ${v}`)
    prec = q
  }
})

// ── LE RAPPEL ────────────────────────────────────────────────────────────────
// Adrien a tranché : « butée élastique — le terrain résiste et revient ».
// Revenir, c'est ce que fait `rappelElastique` une fois le geste lâché.

test('dans la course, le rappel ne touche à rien', () => {
  assert.equal(rappelElastique(30, 56, 0.016), 30)
  assert.equal(rappelElastique(-56, 56, 0.016), -56)
})

test('hors de la course, le rappel ramène VERS le bord, sans le dépasser', () => {
  let v = 70
  for (let k = 0; k < 400; k++) {
    const n = rappelElastique(v, 56, 0.016)
    assert.ok(n <= v + 1e-9, 'le rappel ne repousse jamais vers l’extérieur')
    assert.ok(n >= 56 - 1e-9, `le rappel a dépassé le bord (${n})`)
    v = n
  }
  assert.ok(Math.abs(v - 56) < 0.01, `n’est pas revenu au bord en 6,4 s (${v})`)
})

test('le rappel arrive VRAIMENT au bord, il ne fait pas qu’en approcher', () => {
  // Une exponentielle pure n'atteint jamais sa cible : la fenêtre resterait
  // éternellement à 0,3 unité du bord et le socle tremblerait au dernier pixel.
  let v = -70
  for (let k = 0; k < 600; k++) v = rappelElastique(v, 56, 0.016)
  assert.equal(v, -56)
})

test('le rappel ne dépend pas de la cadence — 60 im/s et 30 im/s convergent pareil', () => {
  // Sinon la butée serait deux fois plus molle sur l'iMac que sur la machine de
  // développement, et le réglage se ferait sur la mauvaise machine.
  let a = 70
  for (let k = 0; k < 60; k++) a = rappelElastique(a, 56, 1 / 60)
  let b = 70
  for (let k = 0; k < 30; k++) b = rappelElastique(b, 56, 1 / 30)
  assert.ok(Math.abs(a - b) < 0.05, `écart de ${Math.abs(a - b)} entre 60 et 30 im/s`)
})

test('un dt aberrant (onglet réveillé, point d’arrêt) ne catapulte pas la fenêtre', () => {
  const v = rappelElastique(70, 56, 12)
  assert.ok(v >= 56 && v <= 70, `dt de 12 s a envoyé la fenêtre à ${v}`)
})

// ── L'AVANCE DU GESTE ────────────────────────────────────────────────────────

test('avanceFenetre additionne le geste puis borne, dans cet ordre', () => {
  // ⚠️ L'ORDRE EST LA RÈGLE. Si on bornait AVANT d'additionner, le débordement
  // serait perdu à chaque image et le geste redeviendrait un arrêt net.
  const r = avanceFenetre({ x: 50, z: 0 }, { x: 20, z: 0 }, COURSE_ELASTIQUE)
  assert.equal(r.brutX, 70, 'le brut mémorise le geste entier')
  assert.ok(r.x > 56 && r.x < 70, 'l’affiché est élastique')
})

test('les deux axes sont indépendants', () => {
  const r = avanceFenetre({ x: 0, z: 0 }, { x: 90, z: -12 }, 56)
  assert.ok(r.x > 56, 'x est en butée')
  assert.equal(r.z, -12, 'z, lui, suit exactement')
})

test('COURSE_ELASTIQUE vaut la largeur du socle', () => {
  // Le socle fait TERRAIN_SIZE = 56 unités ; l'emprise 3×3 en fait 168. La
  // fenêtre peut donc glisser d'exactement un socle avant de sortir de
  // l'emprise. Ce n'est pas un réglage, c'est de la géométrie.
  assert.equal(COURSE_ELASTIQUE, 56)
})

// ══════════ POSER LA FENÊTRE — ce qu'un export doit figer ═══════════════════

test('poser ramène dans la course, et n’y touche pas quand on y est déjà', () => {
  assert.equal(poseDansLaCourse(0, 56), 0)
  assert.equal(poseDansLaCourse(31.7, 56), 31.7)
  assert.equal(poseDansLaCourse(-56, 56), -56)
  assert.equal(poseDansLaCourse(62, 56), 56, 'le débordement élastique ne doit pas partir dans un fichier')
  assert.equal(poseDansLaCourse(-1e9, 56), -56)
})

test('poser rend un nombre même sur une entrée cassée', () => {
  for (const v of [NaN, undefined, null, Infinity, 'x']) {
    assert.ok(Number.isFinite(poseDansLaCourse(v, 56)), `v=${v}`)
  }
})

// ⚠️ LE TEST QUI COMPTE, ET IL REGARDE LA DÉRIVÉE. Un export doit figer un état
// STABLE : à la reprise de la boucle, rien ne doit bouger. Vérifier « la
// position est dans la course » ne le dirait pas — c'est le déplacement de
// l'image SUIVANTE qui doit valoir exactement zéro, à tous les pas de temps.
// C'est la leçon payée sur la butée, qui éteignait la vitesse puis la relançait
// 15 fois trop vite : un test de position ne voit pas un à-coup.
test('une fenêtre posée est un POINT FIXE du rappel — dérivée nulle, tout dt', () => {
  for (const v of [-1e6, -84, -56.000001, -56, -12, 0, 7.25, 55.999, 56, 63, 1e6]) {
    const pose = poseDansLaCourse(v, COURSE_ELASTIQUE)
    for (const dt of [1 / 240, 1 / 120, 1 / 60, 1 / 30, 0.5, 4]) {
      assert.equal(
        rappelElastique(pose, COURSE_ELASTIQUE, dt) - pose,
        0,
        `v=${v} dt=${dt} : la fenêtre bougerait encore après l’export`
      )
    }
  }
})

test('poser et laisser le rappel finir aboutissent au MÊME endroit', () => {
  // La pose n'invente pas une position : c'est celle que l'élastique atteignait
  // de toute façon, en 0,3 s. On ne déplace donc pas la vue de l'utilisateur,
  // on lui épargne l'attente.
  for (const v of [-70, -60.5, 58, 63, 200]) {
    let x = v
    for (let i = 0; i < 400; i++) x = rappelElastique(x, COURSE_ELASTIQUE, 1 / 60)
    assert.equal(x, poseDansLaCourse(v, COURSE_ELASTIQUE), `v=${v}`)
  }
})
