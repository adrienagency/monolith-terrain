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
  distanceCrop,
  couvertureCrop,
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

// ══════════ ④ LA COUVERTURE DU BORD — Tâche K ter, défaut n° 1 ═════════════
//
// ⛔ **CE QUI A ÉTÉ VU À L'ÉCRAN, ET QUI A CRÉÉ CES TESTS.** Adrien : « plus
// aucune texture sur la terre, la mer ne fonctionne plus ». Relevé le
// 2026-08-22 dans l'application vivante (La Réunion z12, `uCropCoin = 0`) : la
// surface ENTIÈRE du crop était dessinée à une couverture de **0,5**, parce que
// `pn` est écrêté à zéro dans tout le rectangle intérieur, donc `d = pn - coin`
// y valait la constante `0`, donc `fwidth(d)` y valait `0`, donc le `smoothstep`
// était évalué au MILIEU EXACT de son intervalle.
//
// ⚠️ **LA DÉMONSTRATION DE TERRAIN** : poser `uCropCoin = 0,2` à la main rendait
// le bloc opaque (`.banc/vues-Kter/AB2-coin020.png` contre `AV-Z12-iso.png`), et
// déplaçait 17,79 % des pixels du cadre sur un banc dont le témoin vaut ZÉRO
// pixel (`.banc/vues-Kter/AV-releves.json`).

const FORME_VIVE = { coin: 0, expo: 2 } // ⚠️ CE QUE `poserCrop` POSE EN PRODUCTION

/**
 * Le source PRIVÉ DE SES COMMENTAIRES.
 *
 * ⛔ **UNE MUTATION A SURVÉCU FAUTE DE CETTE LIGNE.** Le pavé de `globe.js` qui
 * explique le terme intérieur CITE la formule ; une assertion posée sur le texte
 * brut restait verte alors que le CODE avait été muté. Le patron vient de
 * `test/crop-branche.test.js` (⑧ bis), qui le documente déjà : « une assertion
 * qui compterait les citations serait rouge sur une correction de prose et verte
 * sur une seconde lecture ».
 */
const sansCommentaires = (src) => src.replace(/\/\/[^\n]*/g, '')

// La loi d'AVANT, telle qu'elle était écrite — le témoin des tests de dehors.
// `git show d6d6478:src/monde/crop-sphere.js` n'en portait pas : elle ne vivait
// que dans le nuanceur, et c'est une partie du problème.
function distanceAvant(u, v, { coin = 0, expo = 2 } = {}) {
  const cx = Math.max(Math.abs(u) - (1 - coin), 0)
  const cy = Math.max(Math.abs(v) - (1 - coin), 0)
  return Math.pow(Math.pow(cx, expo) + Math.pow(cy, expo), 1 / expo) - coin
}

test('④a coin VIF : la distance est STRICTEMENT négative au-dedans — ROUGE avant', () => {
  // ⚠️ **C'EST LE TEST QUI TOMBAIT.** Avec `pn - coin` et `coin = 0`, chacun de
  // ces points rendait EXACTEMENT 0 — le milieu du smoothstep, donc 0,5 de
  // couverture, donc le verre.
  for (const [u, v] of [[0, 0], [0.5, 0], [0, -0.5], [0.9, 0.9], [-0.999, 0.2], [1e-9, 1e-9]]) {
    const d = distanceCrop(u, v, FORME_VIVE)
    assert.ok(d < 0, `distanceCrop(${u}, ${v}) doit être < 0 au-dedans, rendu ${d}`)
    assert.equal(couvertureCrop(d, Math.abs(d) / 4), 1,
      `la couverture doit valoir 1 au-dedans (u=${u}, v=${v})`)
  }
})

test('④b coin VIF : une distance CONSTANTE ne peut plus se produire au-dedans', () => {
  // La cause exacte du défaut : `fwidth` d'une constante vaut zéro. On mesure
  // donc que la distance VARIE d'un point à l'autre du dedans.
  const a = distanceCrop(0, 0, FORME_VIVE)
  const b = distanceCrop(0.5, 0, FORME_VIVE)
  const c = distanceCrop(0.9, 0.9, FORME_VIVE)
  assert.notEqual(a, b, 'la distance doit MESURER, pas rendre une constante')
  assert.notEqual(b, c)
  assert.ok(a < b && b < c, 'et elle doit croître vers la frontière')
})

test('④c la frontière reste la frontière : d vaut 0 en ±1, coin vif comme arrondi', () => {
  for (const forme of [FORME_VIVE, FORME]) {
    for (const v of [0, 0.3, -0.7]) {
      // sur le côté droit, hors des coins arrondis
      const d = distanceCrop(1, v * (1 - forme.coin), forme)
      assert.ok(Math.abs(d) < 1e-12, `d doit valoir 0 sur la frontière (coin ${forme.coin}), rendu ${d}`)
    }
  }
})

test('④d le DEHORS et la FRONTIÈRE sont l’ancienne loi AU BIT PRÈS — non-régression', () => {
  // ⚠️ **C'EST LA GARDE DE « ON ÉLARGIT, ON NE CHANGE PAS LE DÉFAUT ».** Le
  // terme ajouté est nul dès qu'une composante de `eq` est positive. Un
  // `Object.is` : pas d'epsilon, pas de tolérance.
  let comptes = 0
  for (const forme of [FORME_VIVE, FORME, { coin: 1, expo: 2 }]) {
    for (let i = 0; i <= 60; i++) {
      for (let j = 0; j <= 60; j++) {
        const u = -2 + (4 * i) / 60
        const v = -2 + (4 * j) / 60
        const ex = Math.abs(u) - (1 - forme.coin)
        const ey = Math.abs(v) - (1 - forme.coin)
        if (Math.max(ex, ey) < 0) continue // strictement dedans : c'est là qu'on répare
        assert.ok(Object.is(distanceCrop(u, v, forme), distanceAvant(u, v, forme)),
          `hors du rectangle intérieur la loi doit être INCHANGÉE (u=${u}, v=${v}, coin=${forme.coin})`)
        comptes++
      }
    }
  }
  assert.ok(comptes > 3000, `l’échantillon doit couvrir le dehors — ${comptes} points`)
})

test('④e le coin ARRONDI rendait déjà 1 : la réparation ne le déplace pas', () => {
  // ⚠️ **CE TEST DIT POURQUOI PERSONNE N'AVAIT VU LE DÉFAUT.** Avec un rayon
  // d'arrondi, `d = -coin` est franchement négatif et le smoothstep sature déjà.
  for (const [u, v] of [[0, 0], [0.5, 0.5], [-0.8, 0.1]]) {
    assert.equal(couvertureCrop(distanceAvant(u, v, FORME), 1e-12), 1)
    assert.equal(couvertureCrop(distanceCrop(u, v, FORME), 1e-12), 1)
  }
})

test('④f `distanceCrop <= 0` est EXACTEMENT `dansDalle` — la forme n’a pas bougé', () => {
  // La loi de forme reste celle du socle : on confronte le SIGNE de la distance
  // au prédicat que `dansCrop` délègue déjà, sur les deux formes.
  for (const forme of [FORME_VIVE, FORME]) {
    let dedans = 0
    for (let i = 0; i <= 80; i++) {
      for (let j = 0; j <= 80; j++) {
        const u = -1.5 + (3 * i) / 80
        const v = -1.5 + (3 * j) / 80
        const d = distanceCrop(u, v, forme)
        const p = dansDalle(u, v, 1, forme.coin, forme.expo, null)
        // ⚠️ on saute la frontière au texel près : `dansDalle` y tranche par un
        // `<=` sur un flottant, et ce test-ci ne garde pas la frontière (④c le fait).
        if (Math.abs(d) < 1e-9) continue
        assert.equal(d < 0, p, `signe et prédicat désaccordés (u=${u}, v=${v}, coin=${forme.coin})`)
        if (p) dedans++
      }
    }
    assert.ok(dedans > 2000, `l’échantillon doit contenir du dedans — ${dedans}`)
  }
})

test('④g `distanceCrop` est CONTINUE au passage du rectangle intérieur', () => {
  // Le terme ajouté doit tendre vers zéro en s'approchant du rectangle : une
  // marche ici se lirait comme un liseré sur les quatre côtés.
  const forme = FORME
  const bord = 1 - forme.coin
  let precedent = distanceCrop(bord - 1e-3, 0, forme)
  for (const eps of [1e-4, 1e-5, 1e-6, 0, -1e-6, -1e-5]) {
    const d = distanceCrop(bord + eps, 0, forme)
    assert.ok(Math.abs(d - precedent) < 2e-3, `marche de ${d - precedent} au passage du rectangle`)
    precedent = d
  }
})

test('④h `couvertureCrop` : un fondu d’un pixel, et un créneau quand la largeur est nulle', () => {
  // au milieu du fondu, la couverture vaut un demi — c'est la loi, et c'est
  // JUSTE sur la frontière ; c'est au-dedans que ça ne l'était pas.
  assert.equal(couvertureCrop(0, 1e-12), 0.5)
  assert.equal(couvertureCrop(-1e-6, 1e-12), 1, 'une largeur nulle doit rendre un CRÉNEAU')
  assert.equal(couvertureCrop(1e-6, 1e-12), 0)
  // et le fondu est monotone décroissant sur sa largeur
  const w = 0.01
  let avant = 1
  for (let k = 0; k <= 20; k++) {
    const d = -w / 2 + (w * k) / 20
    const c = couvertureCrop(d, w)
    assert.ok(c <= avant + 1e-12, 'la couverture doit décroître vers le dehors')
    assert.ok(c >= 0 && c <= 1)
    avant = c
  }
  assert.equal(couvertureCrop(-w, w), 1)
  assert.equal(couvertureCrop(w, w), 0)
})

test('④h bis une largeur EXACTEMENT nulle ne produit pas un NaN — le plancher mord', () => {
  // ⚠️ **UNE MUTATION A SURVÉCU FAUTE DE CE TEST** : retirer `Math.max(w, 1e-12)`
  // ne changeait rien tant qu'on n'appelait qu'avec `1e-12`. Avec `0`, la
  // division rend ±Infinity — et `0 / 0` rend **NaN**, c'est-à-dire une
  // couverture qui n'est ni 0 ni 1 et qu'aucun `clamp` ne rattrape. Un NaN
  // d'alpha, c'est le fragment que le §« écrêtage de Mercator » de `globe.js`
  // raconte déjà : une comparaison fausse, donc un pixel gardé au hasard.
  for (const d of [-1, -1e-9, 0, 1e-9, 1]) {
    const c = couvertureCrop(d, 0)
    assert.ok(Number.isFinite(c), `couverture non finie pour d = ${d} : ${c}`)
    assert.ok(c >= 0 && c <= 1, `couverture hors [0, 1] pour d = ${d} : ${c}`)
  }
  assert.equal(couvertureCrop(-1e-9, 0), 1, 'une largeur nulle doit rendre un CRÉNEAU')
  assert.equal(couvertureCrop(1e-9, 0), 0)
  // ⚠️ **ET LA VALEUR NÉGATIVE EST INTERDITE AUSSI** : `fwidth` ne peut pas la
  // produire, mais une largeur signée ferait une couverture croissante vers le
  // dehors, c'est-à-dire un bloc qui se dessine à l'envers.
  assert.equal(couvertureCrop(-1e-9, -1), 1)
  assert.equal(couvertureCrop(1e-9, -1), 0)
})

test('④i le nuanceur PORTE le terme intérieur, et le pose dans `d`', () => {
  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE COMME TELLE** : rien ne compile ce
  // nuanceur ici (§ en tête de fichier). Ce qui est gardé, c'est que les deux
  // écritures de la loi ne divergent pas en silence.
  //
  // ⛔ **ET LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER — UNE MUTATION A
  // SURVÉCU LÀ-DESSUS.** Le pavé qui explique le terme intérieur CITE la
  // formule ; une assertion posée sur le texte brut restait donc verte alors
  // que le CODE avait été muté en `max(min(...), 0.0)`. C'est la définition
  // même d'une assertion qui garde une chaîne au lieu d'un comportement.
  const CODE = sansCommentaires(GLOBE_SRC)
  assert.match(CODE, /vec2\s+eq\s*=\s*abs\(q\)\s*-\s*\(1\.0\s*-\s*uCropCoin\)/,
    'le nuanceur doit garder `eq` — sans lui il n’y a pas de terme intérieur')
  assert.match(CODE, /min\(\s*max\(\s*eq\.x\s*,\s*eq\.y\s*\)\s*,\s*0\.0\s*\)/,
    'le terme intérieur de `distanceCrop` est absent du nuanceur')
  assert.match(CODE, /float\s+d\s*=\s*pn\s*\+\s*dInterieur\s*-\s*uCropCoin\s*;/,
    '`d` doit valoir `pn + dInterieur - uCropCoin`')
  // et la couverture reste celle de la Tâche B : un pixel MESURÉ, pas posé
  assert.match(CODE, /float\s+w\s*=\s*max\(fwidth\(d\)\s*,\s*1e-12\)/,
    'la largeur du fondu doit rester `fwidth(d)`')
  assert.match(CODE, /1\.0\s*-\s*smoothstep\(\s*-0\.5\s*\*\s*w\s*,\s*0\.5\s*\*\s*w\s*,\s*d\s*\)/,
    'le fondu doit rester le smoothstep centré de la Tâche B')
})

test('④j le crop reste OPAQUE et les alentours GARDENT leur fondu — Tâche G intacte', () => {
  // ⚠️ **LA GARDE QUI EMPÊCHE DE « COUPER `transparent` PARTOUT ».** Le mélange
  // des tuiles est ce qui fait vivre l'estompage : la ligne qui le pose doit
  // rester, et la couverture doit rester `mix(1.0, dedans, estompeTuile)` —
  // 1 au-dedans quelle que soit l'altitude, `1 - estompage` au-dehors.
  assert.match(GLOBE_SRC, /transparent:\s*!!this\._crop/,
    'le mélange des tuiles suit le crop — le couper casserait l’estompage')
  assert.match(GLOBE_SRC, /depthWrite:\s*true/, 'la profondeur reste ÉCRITE')
  assert.match(GLOBE_SRC, /float\s+couvertureTuile\s*=\s*mix\(1\.0,\s*dedans,\s*estompeTuile\)/,
    'la couverture doit rester 1 au-dedans et suivre l’estompage au-dehors')
  // la loi JS le dit aussi, et c'est elle qui est exécutable :
  // au-dedans, la couverture vaut 1 pour TOUTE valeur d'estompage.
  for (const estompage of [0, 0.25, 0.5, 0.75, 1]) {
    const dedans = couvertureCrop(distanceCrop(0.3, -0.2, FORME_VIVE), 1e-12)
    assert.equal(1 + (dedans - 1) * estompage, 1, 'le crop ne s’estompe jamais')
    const dehors = couvertureCrop(distanceCrop(1.4, 0, FORME_VIVE), 1e-12)
    assert.equal(dehors, 0)
    assert.equal(1 + (dehors - 1) * estompage, 1 - estompage,
      'les alentours doivent garder EXACTEMENT le fondu de la Tâche G')
  }
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
