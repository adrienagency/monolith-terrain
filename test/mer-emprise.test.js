import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHAMP_RES, resChamp, spanChamp, uvChamp, mondeTexel, decalageChamp } from '../src/mer-emprise.js'

const TERRAIN_SIZE = 56 // verrouillé ci-dessous contre terrain.js
const COURSE = 56 // fenetre-course.js
const DEBORD = COURSE / 8

test('CHAMP_RES est bien le FIELD_RES qu ocean.js utilise', () => {
  // ocean.js tire three.js : impossible à importer ici. On relit la constante.
  const src = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
  const m = src.match(/const FIELD_RES = (\d+)/)
  assert.ok(m, 'FIELD_RES introuvable dans ocean.js')
  assert.equal(Number(m[1]), CHAMP_RES)
})

test('TERRAIN_SIZE vaut bien 56 dans terrain.js', () => {
  const src = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  const m = src.match(/export const TERRAIN_SIZE = ([\d.]+)/)
  assert.ok(m, 'TERRAIN_SIZE introuvable')
  assert.equal(Number(m[1]), TERRAIN_SIZE)
})

test('hors mode continu, rien ne bouge : mêmes résolution et span qu avant', () => {
  assert.equal(resChamp(1), CHAMP_RES)
  assert.equal(resChamp(0), CHAMP_RES)
  assert.equal(resChamp(undefined), CHAMP_RES)
  assert.equal(spanChamp(TERRAIN_SIZE, 1), TERRAIN_SIZE)
  assert.equal(spanChamp(TERRAIN_SIZE, undefined), TERRAIN_SIZE)
  // et la formule d'uv redevient celle écrite en dur dans le GLSL d'avant
  assert.deepEqual(uvChamp(0, 0, TERRAIN_SIZE), { u: 0.5, v: 0.5 })
  assert.deepEqual(uvChamp(28, -28, TERRAIN_SIZE), { u: 1, v: 0 })
})

test('emprise 3x3 : la densité de texels au sol est CONSERVEE', () => {
  const dense1 = resChamp(1) / spanChamp(TERRAIN_SIZE, 1)
  const dense3 = resChamp(3) / spanChamp(TERRAIN_SIZE, 3)
  assert.equal(dense3, dense1)
  assert.equal(resChamp(3), 1152)
  assert.equal(spanChamp(TERRAIN_SIZE, 3), 168)
})

test('aller-retour texel↔monde : mondeTexel est l inverse exact d uvChamp', () => {
  const n = resChamp(3)
  const span = spanChamp(TERRAIN_SIZE, 3)
  for (const i of [0, 1, 17, 576, n - 2, n - 1]) {
    const monde = mondeTexel(i, n, span)
    const { u } = uvChamp(monde, 0, span)
    // u · (n−1) doit retomber sur l'indice i, au flottant près
    assert.ok(Math.abs(u * (n - 1) - i) < 1e-9, `texel ${i} : u·(n−1) = ${u * (n - 1)}`)
  }
  // les deux bords tombent pile sur les bords du champ
  assert.equal(mondeTexel(0, n, span), -span / 2)
  assert.equal(mondeTexel(n - 1, n, span), span / 2)
})

test('LA REGLE : le point affiché en x lit le champ du monde en x + fenêtre', () => {
  const span = spanChamp(TERRAIN_SIZE, 3)
  const n = resChamp(3)
  // pour un tirage de fenêtres dans la course et de points dans le socle,
  // le texel adressé doit être celui dont la coordonnée monde vaut x + fen
  for (const fen of [0, 5.5, -21, COURSE, -COURSE]) {
    for (const x of [-27.9, -10, 0, 13.3, 27.9]) {
      const { u } = uvChamp(x + fen, 0, span)
      const iReel = u * (n - 1)
      assert.ok(Math.abs(mondeTexel(iReel, n, span) - (x + fen)) < 1e-9)
    }
  }
})

test('la butée élastique sort du champ, et seulement d un huitième de socle', () => {
  const span = spanChamp(TERRAIN_SIZE, 3)
  // pire cas : fenêtre à la course + débordement max, point au coin du socle
  const pire = COURSE + DEBORD + TERRAIN_SIZE / 2
  assert.equal(pire, 91)
  const { u } = uvChamp(pire, 0, span)
  assert.ok(u > 1, 'le débordement doit bien sortir du champ (le clamp le rattrape)')
  // ...mais jamais de plus d'un demi-champ : au-delà, un ClampToEdge étirerait
  // une bande de bord visible au lieu d'une frange
  assert.ok(u < 1.05, `débordement d uv trop grand : ${u}`)
  // et sans débordement, la course seule reste DANS le champ, au texel près
  const { u: uCourse } = uvChamp(COURSE + TERRAIN_SIZE / 2, 0, span)
  assert.equal(uCourse, 1)
})

test('les quatre 56.0 en dur du GLSL ont disparu, et les quatre lectures sont IDENTIQUES', () => {
  // L'étude 3×3 §5.2 les nomme un par un : quatre `xz / 56.0 + 0.5` interpolés
  // dans le GLSL d'ocean.js (surface vertex, surface fragment, jupe vertex, jupe
  // fragment). Tant qu'ils y sont, la mer lit un champ de la taille d'un socle.
  const src = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
  assert.equal(src.includes('TERRAIN_SIZE.toFixed'), false, 'un 56.0 est encore interpolé dans le GLSL')
  // ⚠️ L'ÉGALITÉ DES QUATRE EXPRESSIONS EST LE CRITÈRE DE LA JUPE. Adrien :
  // « une jupe qui se décolle de sa surface se lit comme une panne ». Le haut de
  // la jupe et la surface évaluent la MÊME houle sur le MÊME champ : si l'une
  // des deux lectures divergeait d'un demi-texel, un jour de lumière s'ouvrirait
  // sur tout le périmètre du bloc. Ce test compte les lectures, il ne juge pas
  // leur beauté.
  const lectures = src.match(/\/ uSpan \+ 0\.5/g) || []
  assert.equal(lectures.length, 4, `attendu 4 lectures « / uSpan + 0.5 », trouvé ${lectures.length}`)
  // et les quatre shaders déclarent bien les deux uniformes qui les font défiler
  assert.equal((src.match(/uniform float uSpan;/g) || []).length, 4)
  assert.equal((src.match(/uniform vec2 uFenetre;/g) || []).length, 4)
})

test('l échelle du MNT est prise sur l EMPRISE, pas sur un socle', () => {
  // ⚠️ LE BUG LE PLUS MUET DU CHANTIER. Sur une emprise 3×3, `extentMeters` a
  // triplé : `TERRAIN_SIZE / extentMeters` rend une échelle TROIS FOIS TROP
  // PETITE. Rien ne plante, rien ne s'affiche en rouge — la houle devient trois
  // fois trop calme et surtout `bathyScene` tombe au tiers, donc la jupe de mer
  // n'est plus assez longue pour rejoindre le fond : un rideau d'eau suspendu
  // au-dessus du vide.
  //
  // Vérifié à l'exécution après correction, La Réunion z13 en 3×3 (instrument
  // socle-mer.mjs, trois chemins concordants) : bas de jupe −32,53, point bas du
  // relief visible jusqu'à −31,94, socle à −38,94. La jupe passe SOUS le fond
  // marin le plus profond et reste DANS le bloc. Avec l'échelle fautive elle se
  // serait arrêtée à −22,98, soit 8,96 unités au-dessus du fond.
  //
  // ⚠️ LE SYMBOLE A CHANGÉ DE NOM AVEC LE DAMIER, PAS DE SENS. `this._span`
  // désignait deux choses que le mode continu confondait légitimement : ce que
  // couvre le MNT, et ce que couvre le champ de la mer. Le damier les sépare —
  // le carré peut faire 280 unités pendant que le MNT central en couvre 56 —
  // et c'est `_spanDem` qui garde le sens d'ICI : l'emprise du MNT. En mode
  // continu les deux valent la même chose, donc ce test protège exactement la
  // même propriété qu'avant. Voir la note en tête de `rebuild` (ocean.js).
  const src = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
  assert.ok(src.includes('const demScale = (this._spanDem / terrain.dem.extentMeters) * params.demExaggeration'))
  assert.ok(src.includes('this._spanDem = spanChamp(TERRAIN_SIZE, coteFenetre)'), '_spanDem doit rester l emprise du MNT')
  assert.equal(src.includes('(TERRAIN_SIZE / terrain.dem.extentMeters)'), false)
  assert.equal(src.includes('(TERRAIN_SIZE / dem.extentMeters)'), false)
})

test('le terrain fait défiler son masque côtier avec le même décalage', () => {
  // Le masque côtier est le SEUL masque allumé en mode continu (les autres sont
  // éteints au jalon 1) et il est rastérisé sur l'emprise entière : lu sur 56 il
  // était agrandi trois fois ET immobile.
  const src = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  assert.ok(src.includes('vec2 cmUv = (vWorldPos.xz - uBlockOffset + uFenetre) / uMaskSpan + 0.5;'))
  // ⚠️ et surtout : le CLIP de socle ne doit PAS recevoir ce décalage — il est
  // la fenêtre. S'il le recevait, le bloc lui-même défilerait, donc disparaîtrait.
  assert.ok(src.includes('vec2 cq = max(abs(vWorldPos.xz - uBlockOffset) - vec2(uSlabHalf - uSlabCorner), 0.0);'))
})

test('ancrage : la mer ajoute la fenêtre, un lac ne l ajoute pas', () => {
  assert.deepEqual(decalageChamp('fenetre', 12, -7), { x: 12, z: -7 })
  assert.deepEqual(decalageChamp('monde', 12, -7), { x: 0, z: 0 })
  // et les deux se rejoignent quand la fenêtre est au centre
  assert.deepEqual(decalageChamp('fenetre', 0, 0), decalageChamp('monde', 0, 0))
})
