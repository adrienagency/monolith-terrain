// LE CROP DÉCOUPÉ DANS LA SPHÈRE — Tâche A du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// La découpe se fait dans le NUANCEUR DE FRAGMENT (`discard`). Aucun test de ce
// dépôt ne compile un nuanceur : `test/frontiere-rendu.test.js` est le seul à
// avoir eu affaire à une image, et il dit lui-même qu'il « ne change pas ce
// constat — il en réduit la surface ». On applique ici le MÊME patron, celui de
// `test/fenetre-coin-exposant.test.js` :
//
//   ① LA LOI vit dans un module PUR (`src/monde/crop-sphere.js`), sans three ni
//      DOM, et elle se vérifie sous node, point par point ;
//   ② LE NUANCEUR est vérifié comme TEXTE : il doit porter le `discard`, lire
//      les mêmes uniformes, et transcrire la même formule. Un nuanceur qui
//      diverge de la loi tombe ici.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
// bien ce texte. Seul l'écran le dit, et l'Étape 6 de la tâche est là pour ça.
//
// ══════════ POURQUOI LA SUPERELLIPSE EXACTE, ET PAS `dansFenetre` ═══════════
//
// ⚠️ **LE PLAN PRESCRIVAIT `dansFenetre` EN LE DÉCRIVANT COMME « le test de
// forme du crop, coins en superellipse compris, DÉJÀ utilisé par plinth.js ET
// ocean.js ». LES DEUX MOITIÉS SONT FAUSSES, ET C'EST LE §1 DE
// `/threejs-optimisation` MOT POUR MOT — l'audit s'est arrêté au fichier.**
//
//   · `grep -rn dansFenetre src` rend `gpx.js`, `main.js`, `peaks.js`. **Ni
//     `plinth.js` ni `ocean.js`** : ils importent `exposantCoin`, `pointCoin` et
//     `arcCoin`, pas le prédicat.
//   · `dansFenetre` n'est PAS la superellipse : c'est l'OCTOGONE CIRCONSCRIT,
//     huit demi-plans, et son propre en-tête l'écrit — « L'octogone DÉBORDE
//     l'arrondi entre ses points de tangence ».
//
// **La forme du crop est celle que le nuanceur du socle découpe** — `terrain.js`,
// le bloc `uSlabCorner`, SDF de rectangle arrondi. Elle a déjà un prédicat JS
// dans ce dépôt, et son en-tête le dit en toutes lettres : `slabInside`
// (`src/map/block-clip.js`) « mirrors terrain.js's slab-corner discard
// (superellipse) », qui délègue à `dansDalle` (`src/damier-bords.js`). **C'est
// cette loi-là que le globe doit suivre, sans quoi les parois de la Tâche B ne
// tomberaient pas où la surface s'arrête.**
//
// ⚠️ **L'ÉCART EST MESURÉ, PAS SUPPOSÉ** (`.banc`, réglages par défaut
// `slabCorner = 0,04` → rayon 2,24 sur un demi-côté de 28, `slabCornerSmoothing
// = 0,6` → exposant 4,4) :
//
//   · sur la bissectrice à 45° les deux formes coïncident à **1,4·10⁻¹⁴** — le
//     plan diagonal de l'octogone est TANGENT à la superellipse en ce point,
//     et l'algèbre le confirme : `(half−r)·√2 + r·2^(1/2−1/n)` est exactement
//     `√2 · (half − r + r·2^(−1/n))`. **Un test posé à 45° ne les distinguerait
//     donc PAS** ;
//   · l'écart radial MAXIMAL vaut **0,129 unité, à 44,3°**, soit **23,9 m au
//     sol** à `ZOOM_SOCLE` (1 unité = 185,3 m) ;
//   · l'octogone couvre **+0,0139 %** de surface en plus.
//
// Et deux nombres du dépôt valident l'arithmétique ci-dessus avant qu'on s'en
// serve : `terrain.js:1786` écrit que le relief « va jusqu'à 39,136 » et que les
// plans à exposant 2 « tombaient à 38,670 ». Rejoué ici : la portée diagonale de
// la superellipse rend **39,13626172219689** et `plansFenetre(28, 2,24, 2)[4]`
// rend **38,67014136673093**.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  mercX,
  mercY,
  repereCrop,
  localCrop,
  dansCrop,
  coinNormalise,
  tuileDansCrop,
  zoomCropPrescrit,
} from '../src/monde/crop-sphere.js'
import { dansDalle } from '../src/damier-bords.js'
import { dansFenetre, exposantCoin } from '../src/fenetre-clip.js'
import { empriseSocle, ZOOM_SOCLE, LARGEUR_SOCLE_M } from '../src/monde/seuil-socle.js'
import { BLOCK_TILES } from '../src/landmarks.js'

// Les réglages par défaut du produit — `main.js:588` et `main.js:590`.
const HALF = 28
const CORNER = 0.04 * 56 // slabCorner × TERRAIN_SIZE, borné par plinth.js:855
const EXPO = exposantCoin(0.6) // slabCornerSmoothing = 0,6 → 4,4
const COIN = coinNormalise(CORNER, HALF) // le rayon, en fraction du demi-côté

// UN TEXEL, ET IL EST NOMMÉ. Le crop fait `BLOCK_TILES` tuiles de côté ; une
// tuile Mapterhorn fait 512 px (`dem-source.js`), donc le crop fait
// 3 × 512 = 1 536 texels de large, et le demi-côté en fait 768. En coordonnées
// locales du crop (±1), un texel vaut donc 1/768.
const TEXEL = 1 / (BLOCK_TILES * 512 * 0.5)

const CENTRE = { lat: 45, lon: 6.25 } // la station du protocole A (bilan-4-quater)
const REPERE = repereCrop({ centre: CENTRE })
const FORME = { coin: COIN, expo: EXPO }

// ══════════ ① LA LOI EN LAT/LON EST LA LOI DU SOCLE ═════════════════════════

test('le repère du crop reproduit `empriseSocle`, au bit du mercator près', () => {
  // ⚠️ LE REPÈRE N'INVENTE PAS L'EMPRISE — il doit tomber sur celle que produit
  // `seuil-socle.js`, seul producteur du plan. Sinon le globe découperait à côté
  // du socle, et rien ne le dirait.
  const e = empriseSocle({ centre: CENTRE })
  assert.ok(Math.abs(mercX(e.ouest) - (REPERE.cx - REPERE.demi)) < 1e-15, 'bord ouest')
  assert.ok(Math.abs(mercX(e.est) - (REPERE.cx + REPERE.demi)) < 1e-15, 'bord est')
  assert.ok(Math.abs(mercY(e.nord) - (REPERE.cy - REPERE.demi)) < 1e-12, 'bord nord')
  assert.ok(Math.abs(mercY(e.sud) - (REPERE.cy + REPERE.demi)) < 1e-12, 'bord sud')
  // le demi-côté vaut bien la moitié du bloc, en mercator normalisé
  assert.equal(REPERE.demi, BLOCK_TILES / 2 / 2 ** ZOOM_SOCLE)
})

test('le centre du crop est DEDANS, et les quatre milieux de bord aussi', () => {
  const e = empriseSocle({ centre: CENTRE })
  assert.equal(dansCrop(CENTRE.lat, CENTRE.lon, REPERE, FORME), true, 'le centre')
  // les côtés droits vont EXACTEMENT jusqu'au bord — c'est la propriété de la
  // superellipse : sur un milieu de bord, une seule composante est non nulle.
  assert.equal(dansCrop(CENTRE.lat, e.ouest, REPERE, FORME), true, 'milieu ouest')
  assert.equal(dansCrop(CENTRE.lat, e.est, REPERE, FORME), true, 'milieu est')
  assert.equal(dansCrop(e.nord, CENTRE.lon, REPERE, FORME), true, 'milieu nord')
  assert.equal(dansCrop(e.sud, CENTRE.lon, REPERE, FORME), true, 'milieu sud')
})

test('À UN TEXEL DEHORS, la surface n est plus dessinée', () => {
  // C'est l'assertion que la tâche nomme. `TEXEL` vaut 1/768 du demi-côté, soit
  // 6,76 m au sol : la résolution d'un texel de socle à `ZOOM_SOCLE`.
  const mParUnite = LARGEUR_SOCLE_M / 56
  assert.ok(Math.abs(TEXEL * HALF * mParUnite - 6.7561) < 1e-3, 'un texel ≈ 6,76 m — repère du plan')

  for (const [nom, dlat, dlon] of [
    ['ouest', 0, -1],
    ['est', 0, 1],
    ['nord', 1, 0],
    ['sud', -1, 0],
  ]) {
    // on part du milieu de bord (dedans) et on sort d'un texel
    const u = dlon * (1 + TEXEL)
    const v = -dlat * (1 + TEXEL)
    assert.equal(dansCropLocal(u, v), false, `${nom} : un texel dehors doit être coupé`)
    // et un texel DEDANS reste dessiné — sans quoi l'assertion ci-dessus
    // passerait aussi avec un `discard` qui coupe tout.
    assert.equal(dansCropLocal(dlon * (1 - TEXEL), -dlat * (1 - TEXEL)), true, `${nom} : un texel dedans`)
  }
})

test('LA FRONTIÈRE SUIT LA SUPERELLIPSE, PAS UN RECTANGLE', () => {
  // ⚠️ L'ASSERTION QUI MORD. Le coin géométrique de l'emprise est DEDANS pour un
  // rectangle et DEHORS pour le crop : c'est le seul point qui distingue les
  // deux, et une découpe rectangulaire tombe ici.
  const e = empriseSocle({ centre: CENTRE })
  for (const [lat, lon, nom] of [
    [e.nord, e.ouest, 'nord-ouest'],
    [e.nord, e.est, 'nord-est'],
    [e.sud, e.ouest, 'sud-ouest'],
    [e.sud, e.est, 'sud-est'],
  ]) {
    assert.equal(dansRectangle(lat, lon), true, `${nom} : le rectangle le garde`)
    assert.equal(dansCrop(lat, lon, REPERE, FORME), false, `${nom} : la superellipse le coupe`)
  }
  // et l'ampleur de la coupe est celle de la loi, pas une approximation : sur la
  // bissectrice, la superellipse s'arrête à `1 − coin + coin·2^(−1/n)`.
  const arret = 1 - COIN + COIN * Math.pow(2, -1 / EXPO)
  assert.equal(dansCropLocal(arret * 0.999999, arret * 0.999999), true)
  assert.equal(dansCropLocal(arret * 1.000001, arret * 1.000001), false)
})

test('la loi en lat/lon EST la loi du socle — accord avec `dansDalle` sur 40 000 points', () => {
  // ⚠️ UNE SEULE RÈGLE, DEUX LECTEURS. `dansDalle` est la loi que le nuanceur du
  // socle applique (`slabInside` l'atteste : « mirrors terrain.js's slab-corner
  // discard »). Si le globe en appliquait une autre, la surface et les parois de
  // la Tâche B ne s'arrêteraient pas au même endroit.
  let vus = 0
  for (let i = 0; i < 200; i++) {
    for (let j = 0; j < 200; j++) {
      const u = -1.05 + (2.1 * (i + 0.5)) / 200
      const v = -1.05 + (2.1 * (j + 0.5)) / 200
      const attendu = dansDalle(u * HALF, v * HALF, HALF, CORNER, EXPO, null)
      assert.equal(dansCropLocal(u, v), attendu, `désaccord en (${u}, ${v})`)
      vus++
    }
  }
  assert.equal(vus, 40000)
})

test('la découpe est CONTENUE dans l octogone de `dansFenetre` — jamais l inverse', () => {
  // L'invariant que `test/fenetre-clip.test.js` tient déjà dans l'autre sens :
  // l'octogone contient l'arrondi. Le crop étant l'arrondi exact, tout ce qu'il
  // garde doit passer les huit plans. Ce test dit donc que le globe ne dessine
  // JAMAIS au-delà de ce que les plans de coupe des calques laissent passer.
  for (let k = 0; k < 20000; k++) {
    const u = Math.random() * 2.2 - 1.1
    const v = Math.random() * 2.2 - 1.1
    if (dansCropLocal(u, v)) {
      assert.ok(dansFenetre(u * HALF, v * HALF, HALF, CORNER, EXPO), `le crop déborde l octogone en (${u}, ${v})`)
    }
  }
})

test('l antiméridien ne coupe pas le crop en deux', () => {
  // ⚠️ `ouest > est` est LÉGAL (convention de `seuil-socle.js` et de
  // `bathy-sources.js:119`). Un crop à cheval sur 180° doit rester d'un seul
  // tenant : la différence de mercator est de période 1, et c'est ce repli qui
  // le tient.
  const rep = repereCrop({ centre: { lat: 0, lon: 179.99 } })
  assert.equal(dansCrop(0, 179.99, rep, FORME), true, 'le centre')
  assert.equal(dansCrop(0, -179.995, rep, FORME), true, 'de l autre côté de la ligne')
  assert.equal(dansCrop(0, 175, rep, FORME), false, 'loin à l ouest')
})

// ══════════ ② LE RAFFINEMENT UNIFORME DANS LE CROP ══════════════════════════

test('une tuile du crop est prescrite à ZOOM_SOCLE, une tuile lointaine ne l est pas', () => {
  // La tuile `ZOOM_SOCLE` qui contient le centre
  const n = 2 ** ZOOM_SOCLE
  const tx = Math.floor(mercX(CENTRE.lon) * n)
  const ty = Math.floor(mercY(CENTRE.lat) * n)
  assert.equal(tuileDansCrop(ZOOM_SOCLE, tx, ty, REPERE), true, 'la tuile du centre')
  assert.equal(zoomCropPrescrit(ZOOM_SOCLE, tx, ty, REPERE), ZOOM_SOCLE)
  // son ancêtre aussi : c'est lui qui porte la descente
  assert.equal(zoomCropPrescrit(ZOOM_SOCLE - 3, tx >> 3, ty >> 3, REPERE), ZOOM_SOCLE)
  // une tuile à l'autre bout de la planète, non
  assert.equal(tuileDansCrop(ZOOM_SOCLE, (tx + n / 2) % n, ty, REPERE), false, 'antipode')
  assert.equal(zoomCropPrescrit(ZOOM_SOCLE, (tx + n / 2) % n, ty, REPERE), 0)
  // et une tuile voisine immédiate, hors emprise, non plus
  assert.equal(tuileDansCrop(ZOOM_SOCLE, tx + 3, ty, REPERE), false, 'trois tuiles à l est')
})

// ══════════ ③ LE NUANCEUR PORTE LA MÊME LOI ═════════════════════════════════
//
// ⚠️ ON PART DU TEXTE DU FICHIER, comme `fenetre-coin-exposant.test.js` : c'est
// la seule façon de vérifier un nuanceur que rien ne compile.

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')

test('le nuanceur de fragment du globe porte un `discard`', () => {
  // ⚠️ C'EST LA CIBLE DE LA MUTATION (Étape 5) : retirer le `discard` tue ce test.
  assert.ok(/\bdiscard\s*;/.test(GLOBE_SRC), 'aucun `discard` dans src/globe.js')
})

test('le `discard` est GARDÉ par un interrupteur — sans crop, rien ne change', () => {
  // ⚠️ LA PRODUCTION EST INTOUCHÉE. Le nuanceur est partagé par toutes les
  // tuiles, crop ou pas : le `discard` doit être derrière un uniforme qui vaut
  // zéro par défaut, sans quoi le globe se découperait déjà tout seul.
  assert.ok(/uniform\s+float\s+uCropOn\s*;/.test(GLOBE_SRC), 'uCropOn absent du nuanceur')
  assert.ok(/uCropOn\s*>\s*0\.5/.test(GLOBE_SRC), 'le discard n est pas gardé par uCropOn')
  assert.ok(/uCropOn:\s*\{\s*value:\s*0\b/.test(GLOBE_SRC), 'uCropOn ne naît pas à zéro')
})

test('le nuanceur lit le repère et la forme, et rien d autre', () => {
  for (const u of ['uCropCentre', 'uCropDemi', 'uCropCoin', 'uCropCoinN']) {
    assert.ok(new RegExp(`uniform\\s+\\w+\\s+${u}\\s*;`).test(GLOBE_SRC), `${u} absent du nuanceur`)
    assert.ok(new RegExp(`${u}\\s*:\\s*\\{\\s*value:`).test(GLOBE_SRC), `${u} n est pas posé en uniforme JS`)
  }
})

test('le nuanceur TRANSCRIT la superellipse, il ne l approxime pas', () => {
  // La formule du socle, mot pour mot (`terrain.js:958`) : une puissance, une
  // somme, une racine. Un `length()` ou un `max()` à la place serait un cercle
  // ou un rectangle, et l'écran ne le dirait qu'au coin.
  assert.ok(
    /pow\(\s*pow\([^)]*,\s*uCropCoinN\s*\)\s*\+\s*pow\([^)]*,\s*uCropCoinN\s*\)\s*,\s*1\.0\s*\/\s*uCropCoinN\s*\)/.test(GLOBE_SRC),
    'la superellipse n est pas transcrite telle quelle'
  )
  // et la découpe se fait en LAT/LON, pas en coordonnées de scène : c'est ce qui
  // la rend insensible au repère relatif (RTC) de chaque tuile.
  assert.ok(/vLatLon/.test(GLOBE_SRC.slice(GLOBE_SRC.indexOf('uCropOn > 0.5'))), 'le discard n utilise pas vLatLon')
})

test('le globe expose la pose du crop, et elle part de `empriseSocle`', () => {
  assert.ok(/poserCrop\s*\(/.test(GLOBE_SRC), 'pas de `poserCrop` sur le globe')
  assert.ok(/retirerCrop\s*\(/.test(GLOBE_SRC), 'pas de `retirerCrop` — le crop serait irréversible')
  assert.ok(/from '\.\/monde\/crop-sphere\.js'/.test(GLOBE_SRC), 'globe.js ne lit pas la loi du crop')
})

// ── outils du fichier ──────────────────────────────────────────────────────

// Le prédicat en coordonnées locales du crop (±1), pour les points qu'on veut
// poser directement sans passer par un lat/lon.
function dansCropLocal(u, v) {
  const { lat, lon } = latLonDeLocal(u, v)
  return dansCrop(lat, lon, REPERE, FORME)
}

// L'inverse de `localCrop` — mercator normalisé vers lat/lon.
function latLonDeLocal(u, v) {
  const mx = REPERE.cx + u * REPERE.demi
  const my = REPERE.cy + v * REPERE.demi
  return {
    lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI,
    lon: mx * 360 - 180,
  }
}

// Le témoin : la découpe qu'on N'A PAS faite.
function dansRectangle(lat, lon) {
  const { u, v } = localCrop(lat, lon, REPERE)
  return Math.abs(u) <= 1 + 1e-12 && Math.abs(v) <= 1 + 1e-12
}
