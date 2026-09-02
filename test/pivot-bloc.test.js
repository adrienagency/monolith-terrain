// LE PIVOT DE LA ROTATION SUR LE BLOC — Tâche R13.
//
// ══════════ CE QUE LA MESURE A DIT, ET QUI DÉCIDE DE CE FICHIER ═════════════
//
// Adrien : *« Le comportement de la rotation de la vue autour de la Terre est
// parfait en mode orbital. Peut-on appliquer celui-là jusqu'au mode crop ? »*
//
// ⚡ **CE N'EST PAS LA VITESSE.** Mesuré (`.banc/R13/avant.json`, glissé de
// 100 px, écran 1280×800) : l'orbite à 60 000 km rend **0,447079 °/px**
// d'azimut, et le bloc rend **0,447079 °/px** — le MÊME nombre, parce que les
// deux régimes portent `rotateSpeed = 1` et la même loi d'OrbitControls
// (`2π·dx/H·rotateSpeed`).
//
// ⚡ **C'EST LA CIBLE.** En orbite `controls.target = (0, 0, 0)` : le CENTRE de
// l'objet regardé. La Terre reste donc plantée au milieu du cadre, quoi qu'on
// fasse. Sur le bloc la cible est le point VISÉ, décentré dès qu'on a déplacé
// la vue. Mesuré (`.banc/R13/cibles.json`, cible à 21,3 unités du centre) :
//
//   | pivot                      | dérive du centre du bloc à l'écran |
//   |----------------------------|------------------------------------|
//   | le point visé (aujourd'hui)| **68,324 px** pour 100 px de souris |
//   | le centre du bloc, au sol  | **0,001 px**                        |
//   | le centre du volume        | **0,000 px**                        |
//   | le point sous le curseur   | **130,467 px**                      |
//
// ══════════ LA FORME QUE LA CORRECTION DOIT PRENDRE, ET POURQUOI ═══════════
//
// ⛔ **ÉCRIRE `controls.target` AU CENTRE DU BLOC EST INTERDIT, ET C'EST MESURÉ.**
// `veille-repos.js` surveille `|Δ ln(distance caméra→cible)|` avec
// `SEUIL_BOUGE_LOG = 1e-4`, et c'est ce signal qui arme la bascule de trois
// quarts de D16 ter (`veilleCrop.repos`). Déplacer la cible sur le centre du
// bloc produit, sur la pose relevée : **6,608e-3 (66 × le seuil)** pour le
// centre au sol, **1,715e-2 (171 ×)** pour le centre du volume, **6,147e-2
// (615 ×)** pour le point sous le curseur. La bascule de D16 ter tomberait
// ailleurs.
//
// ➡️ **LA ROTATION EST DONC RIGIDE : la caméra ET la cible tournent ENSEMBLE
// autour de l'axe vertical du bloc.** La distance caméra→cible est alors
// invariante *par construction* — `veille-repos` ne voit rien, D16 ter est
// intact — et le centre du bloc reste planté au milieu du cadre, comme la Terre
// en orbite.
//
// ⚠️ **L'AXE EST VERTICAL, ET SEULEMENT VERTICAL.** Une rotation rigide autour
// d'un axe HORIZONTAL ferait basculer le sol : la cible passerait sous le
// terrain et l'horizon pencherait. L'élévation (l'angle polaire) reste donc
// prise autour de la cible, comme aujourd'hui. C'est aussi ce qui rend le choix
// « centre au sol » / « centre du volume » SANS OBJET : une rotation autour de
// l'axe vertical ne connaît pas le `y` du pivot — les deux candidats rendent le
// même 0,00 px ci-dessus, et ce n'est pas un hasard de mesure.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { deltaAzimut, decalagePivot, PIVOT_BLOC_X, PIVOT_BLOC_Z } from '../src/monde/pivot-bloc.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

const R2D = 180 / Math.PI

// ══════════ ① LE DELTA D'AZIMUT, ET SON ENROULEMENT ════════════════════════
//
// `getAzimuthalAngle()` rend un angle enroulé sur ]−π, π]. Une rotation qui
// franchit ±π rendrait, en soustraction naïve, un delta de près de 2π — soit
// une correction de pivot de 360° dans une seule image.

test('deltaAzimut rend la différence signée, sans enroulement', () => {
  assert.equal(deltaAzimut(0, 0.25), 0.25)
  assert.equal(deltaAzimut(0.25, 0), -0.25)
})

test('deltaAzimut prend le chemin court au franchissement de ±π', () => {
  const eps = 0.05
  // de +π−eps à −π+eps : le chemin court vaut +2·eps, pas −(2π−2·eps)
  const d = deltaAzimut(Math.PI - eps, -Math.PI + eps)
  assert.ok(Math.abs(d - 2 * eps) < 1e-12, `attendu ${2 * eps}, obtenu ${d}`)
  const d2 = deltaAzimut(-Math.PI + eps, Math.PI - eps)
  assert.ok(Math.abs(d2 + 2 * eps) < 1e-12, `attendu ${-2 * eps}, obtenu ${d2}`)
})

test('deltaAzimut rend 0 sur les entrées molles', () => {
  assert.equal(deltaAzimut(null, 0.3), 0)
  assert.equal(deltaAzimut(0.3, undefined), 0)
  assert.equal(deltaAzimut(NaN, 0.3), 0)
})

// ══════════ ② LE DÉCALAGE, ET SON IDENTITÉ ═════════════════════════════════
//
// Le décalage est `δ = (I − Ry(d))·(P − T)`, ajouté À LA FOIS à la caméra et à
// la cible. L'algèbre : `rot(P,d)(X) − rot(T,d)(X) = (I − Ry(d))·(P − T)`, le
// même vecteur pour tout `X`. C'est ce qui en fait une TRANSLATION rigide.

test('un angle nul ne décale rien', () => {
  const d = decalagePivot({ cibleX: 12, cibleZ: -7, angle: 0 })
  assert.equal(d.x, 0)
  assert.equal(d.z, 0)
})

test('une cible déjà sur l’axe du bloc ne décale rien, quel que soit l’angle', () => {
  // le pivot EST l'axe vertical du bloc : si la cible y est, la rotation
  // d'OrbitControls est déjà la bonne et la correction doit être nulle
  const d = decalagePivot({ cibleX: PIVOT_BLOC_X, cibleZ: PIVOT_BLOC_Z, angle: 0.4 })
  assert.ok(Math.abs(d.x) < 1e-15, `x = ${d.x}`)
  assert.ok(Math.abs(d.z) < 1e-15, `z = ${d.z}`)
})

test('le décalage n’a pas de composante verticale', () => {
  const d = decalagePivot({ cibleX: 9, cibleZ: 4, angle: 0.3 })
  assert.equal(d.y, 0)
})

test('un demi-tour renvoie la cible de l’autre côté de l’axe', () => {
  // δ = (I − Ry(π))·(P − T) = 2·(P − T) ; T + δ = 2P − T, le symétrique de T
  const T = { x: 10, z: -6 }
  const d = decalagePivot({ cibleX: T.x, cibleZ: T.z, angle: Math.PI })
  assert.ok(Math.abs(T.x + d.x - (2 * PIVOT_BLOC_X - T.x)) < 1e-12)
  assert.ok(Math.abs(T.z + d.z - (2 * PIVOT_BLOC_Z - T.z)) < 1e-12)
})

// ══════════ ③ CE QUI DÉCIDE VRAIMENT — LA PROPRIÉTÉ, PAS LA FORMULE ════════
//
// ⚠️ **AUCUNE ASSERTION NE COMPARE DEUX LITTÉRAUX DU FICHIER.** Chaque attendu
// est recalculé par une rotation rigide écrite séparément, en clair.

function tourner(p, angle) {
  // rotation autour de l'axe vertical passant par le pivot du bloc, écrite ici
  // à la main pour que le test ne rejoue pas l'implémentation
  const c = Math.cos(angle), s = Math.sin(angle)
  const ux = p.x - PIVOT_BLOC_X, uz = p.z - PIVOT_BLOC_Z
  return { x: PIVOT_BLOC_X + ux * c + uz * s, y: p.y, z: PIVOT_BLOC_Z - ux * s + uz * c }
}

test('caméra et cible décalées du MÊME δ atterrissent où une rotation rigide les met', () => {
  const cam = { x: 40, y: 30, z: 25 }
  const cible = { x: 12, y: -0.3, z: -8 }
  const angle = 0.37
  const d = decalagePivot({ cibleX: cible.x, cibleZ: cible.z, angle })

  // ce qu'OrbitControls vient de faire : la caméra a tourné AUTOUR DE LA CIBLE
  const c = Math.cos(angle), s = Math.sin(angle)
  const vx = cam.x - cible.x, vz = cam.z - cible.z
  const camApresOrbit = { x: cible.x + vx * c + vz * s, y: cam.y, z: cible.z - vx * s + vz * c }

  const camCorrigee = { x: camApresOrbit.x + d.x, y: camApresOrbit.y, z: camApresOrbit.z + d.z }
  const cibleCorrigee = { x: cible.x + d.x, y: cible.y, z: cible.z + d.z }

  const camAttendue = tourner(cam, angle)
  const cibleAttendue = tourner(cible, angle)
  for (const [obtenu, attendu, nom] of [[camCorrigee, camAttendue, 'caméra'], [cibleCorrigee, cibleAttendue, 'cible']]) {
    assert.ok(Math.abs(obtenu.x - attendu.x) < 1e-9, `${nom}.x ${obtenu.x} ≠ ${attendu.x}`)
    assert.ok(Math.abs(obtenu.z - attendu.z) < 1e-9, `${nom}.z ${obtenu.z} ≠ ${attendu.z}`)
  }
})

test('⚡ LA DISTANCE CAMÉRA→CIBLE EST RIGOUREUSEMENT INVARIANTE — c’est ce qui protège D16 ter', () => {
  // ⛔ Si cette propriété tombe, `veille-repos` (seuil 1e-4 sur |Δ ln d|) se
  // réveille et la bascule de trois quarts de D16 ter change de moment.
  const cam = { x: 40, y: 30, z: 25 }
  const cible = { x: 12, y: -0.3, z: -8 }
  const avant = Math.hypot(cam.x - cible.x, cam.y - cible.y, cam.z - cible.z)
  for (const angle of [1e-4, 0.01, 0.37, 1.2, Math.PI - 0.1]) {
    const d = decalagePivot({ cibleX: cible.x, cibleZ: cible.z, angle })
    const c2 = { x: cam.x + d.x, y: cam.y, z: cam.z + d.z }
    const t2 = { x: cible.x + d.x, y: cible.y, z: cible.z + d.z }
    const apres = Math.hypot(c2.x - t2.x, c2.y - t2.y, c2.z - t2.z)
    assert.ok(Math.abs(Math.log(apres / avant)) < 1e-12, `angle ${angle} : |Δ ln d| = ${Math.abs(Math.log(apres / avant))}`)
  }
})

test('⚡ L’ALTITUDE EST RIGOUREUSEMENT INVARIANTE — le pivot ne fait pas monter la caméra', () => {
  // le décalage vaut 0 en `y` : c'est la garantie que la rotation autour du bloc
  // n'ajoute pas d'altitude parasite (le défaut « +32,6 % » de D16 ter)
  for (const angle of [0.01, 0.5, 2.5]) {
    assert.equal(decalagePivot({ cibleX: 17, cibleZ: -9, angle }).y, 0)
  }
})

test('décalagePivot rend un zéro franc sur les entrées molles', () => {
  for (const mauvais of [{ cibleX: NaN, cibleZ: 0, angle: 0.2 }, { cibleX: 0, cibleZ: null, angle: 0.2 }, { cibleX: 1, cibleZ: 1, angle: NaN }]) {
    const d = decalagePivot(mauvais)
    assert.equal(d.x, 0)
    assert.equal(d.z, 0)
  }
})

// ══════════ ④ LE BRANCHEMENT — parce que `main.js` n'est chargé par AUCUN test
//
// ⛔ **LA MÊME LEÇON QUE `grandeur-repos.test.js`** : une mutation a survécu à
// 4 131 tests parce que le seul garde-fou était une expression régulière. On
// garde donc le branchement par sa FORME, en sachant ce que ça vaut — et le
// reste par la mesure à l'écran (`.banc/R13/`).

test('le branchement lit l’azimut AVANT `controls.update()` et applique le décalage APRÈS', () => {
  const i = MAIN.indexOf('pivoterAutourDuBloc')
  assert.ok(i > 0, '`pivoterAutourDuBloc` absent de main.js')
  const zone = MAIN.slice(Math.max(0, i - 1200), i + 1200)
  const iAvant = zone.indexOf('_azAvantUpdate')
  const iUpdate = zone.indexOf('controls.update()', iAvant)
  const iApres = zone.indexOf('pivoterAutourDuBloc(', iUpdate)
  assert.ok(iAvant >= 0 && iUpdate > iAvant && iApres > iUpdate, 'ordre lecture/update/correction non tenu')
})

test('le pivot ne s’applique qu’en mode surface, et jamais pendant une pose pilotée', () => {
  const i = MAIN.indexOf('function pivoterAutourDuBloc')
  assert.ok(i > 0, '`function pivoterAutourDuBloc` absente de main.js')
  const corps = MAIN.slice(i, i + 1800)
  assert.match(corps, /modes\.mode !== 'surface'/, 'la garde de mode manque')
  // ⛔ pendant `busy`, `_fonduPose` ou un tween, la caméra ET la cible sont
  // posées par la machine : une correction de pivot les combattrait
  assert.match(corps, /modes\.busy/, 'la garde `busy` manque')
  assert.match(corps, /_fonduPose/, 'la garde du fondu de pose manque')
})

test('l’axe du pivot est celui du bloc, et il est nommé', () => {
  // TERRAIN_SIZE = 56, le bloc est centré sur l'origine de la GÉOMÉTRIE — c'est
  // (0, 0) et pas la cible, et c'est tout l'objet de la tâche
  assert.equal(PIVOT_BLOC_X, 0)
  assert.equal(PIVOT_BLOC_Z, 0)
})

// ══════════ ⑤ LE CHIFFRE D'ADRIEN, GARDÉ ═══════════════════════════════════

test('⚡ le centre du bloc ne dérive plus : 68,324 px → 0 px, sur la pose mesurée', () => {
  // La pose de `.banc/R13/cibles.json` : cible à (17,466 ; −10,697 ; −9,753),
  // caméra à (105,96 ; 63,52 ; 78,74), glissé de 100 px = 0,447079°/px.
  // On vérifie la PROPRIÉTÉ qui produit le 0 px : l'aplomb du centre du bloc
  // est un point FIXE de la rotation rigide.
  const angle = (44.7079 * Math.PI) / 180
  const centre = { x: PIVOT_BLOC_X, y: 0, z: PIVOT_BLOC_Z }
  const apres = tourner(centre, angle)
  assert.ok(Math.hypot(apres.x - centre.x, apres.z - centre.z) < 1e-12, 'le centre du bloc doit être un point fixe')
  // et l'ancienne cible, elle, ne l'est PAS — c'est la dérive de 68,324 px
  const ancienne = tourner({ x: 17.4659, y: -10.6967, z: -9.7525 }, angle)
  assert.ok(Math.hypot(ancienne.x - 17.4659, ancienne.z + 9.7525) > 1, 'la cible d’avant devait bouger')
})

// ══════════ ⑥ LA RÈGLE D'ADRIEN, ET OÙ VIT SON EXCEPTION — réécrit par R32 ══
//
// > **Adrien :** *« On utilise le centre de la Terre comme point de rotation,
// > excepté en mode crop. »*
//
// ⛔ **CE PARAGRAPHE DISAIT « LES DEUX PIVOTS N'EN FONT QU'UN », ET C'ÉTAIT LA
// CONFUSION D'ESPACE QUE QUATRE PASSES ONT PAYÉE.** Une rotation autour de la
// verticale locale passe bien par le centre de la Terre — mais elle ne fait
// pas TOURNER AUTOUR de lui : c'est un lacet sur place. Mesuré en espace globe
// (`.banc/R32/avant.json`, R33) : hors du crop, 200 px de glissé horizontal
// déplaçaient le point sous la caméra de **0,000°** (l'orbite : 79°), et le
// glissé vertical, pris autour de la cible, couchait la vue à 67,9° avec le
// centre de la Terre à 3 319 px du cadre. `decalagePivot` est aveugle au `y`
// **parce que** c'est une rotation d'axe vertical — c'est exactement ce qui en
// fait le pivot du CROP (R13) et PAS une orbite.
//
// ➡️ **L'exception d'Adrien existe donc, et elle ne vit pas dans
// `pivoterAutourDuBloc`** : hors du crop et en orbite, OrbitControls n'a plus
// le bouton (`controls.enableRotate = !regimeSaisie()`, `main.js`), le glissé
// est une saisie de la Terre, et il n'y a AUCUN delta d'azimut à corriger.
// Sur le crop, OrbitControls retrouve le bouton et la correction de R13 fait
// tout ce qu'elle faisait. Une garde de crop DANS la correction resterait
// inutile — et c'est toujours ce que ce test garde, avec la vraie raison.

test('⛔ le pivot de R13 n’est pas conditionné au crop DANS la correction : l’exception vit à la source, sur le bouton', () => {
  const i = MAIN.indexOf('function pivoterAutourDuBloc')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, i + 1800)
  assert.doesNotMatch(corps, /veilleCrop|cropPose|surLeBloc|arriveeSurLeBloc|veilleSocle/, 'une garde de crop est apparue dans la correction')
  // l'exception : hors du crop et en orbite, OrbitControls ne tourne plus rien
  assert.match(MAIN, /controls\.enableRotate = !regime\b/, 'le bouton n’est pas retiré à OrbitControls hors du crop')
})

test('`decalagePivot` est aveugle au `y` du pivot : une rotation d’axe VERTICAL, le pivot du crop — pas une orbite', () => {
  const a = decalagePivot({ cibleX: 12, cibleZ: -7, angle: 0.4 })
  const b = decalagePivot({ cibleX: 12, cibleZ: -7, angle: 0.4, pivotY: -6371000 })
  assert.deepEqual(a, b, 'enfoncer le pivot au centre de la Terre ne change rien : c’est un lacet autour de la verticale, pas une orbite')
  // et c'est précisément pour ça qu'il ne doit courir que sur le crop : hors du
  // crop, tourner autour de la verticale locale n'est PAS tourner autour de la
  // Terre — le point sous la caméra ne bouge pas (0,000° mesuré)
  const c = decalagePivot({ cibleX: 0, cibleZ: 0, angle: 0.4 })
  assert.deepEqual(c, { x: 0, y: 0, z: 0 }, 'cible sur l’axe : la rotation tourne sur place, le sol ne défile pas')
})
