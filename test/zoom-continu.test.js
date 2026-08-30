// ══════════════════════════════════════════════════════════════════════════
// LA MORT DES PALIERS — Tâche M du plan « LE STUDIO SUR LE GLOBE »
//
// **Adrien, 2026-08-22 :** *« Le mouvement de caméra du ciel à la terre comme
// évoqué, on supprime toutes les zones, ultra important, fais-le. […] Je ne veux
// aucun saut, aucun rechargement de la terre. […] vire absolument ton système de
// saut de niveau !!! »*
//
// ⚠️ **CE FICHIER MESURE `altitudeFondM`, PAS `altitudeSurfaceM`, ET C'EST TOUT
// L'INTÉRÊT.** `test/camera-continue.test.js` et `test/escalier-surface.test.js`
// rejouent `altitudeSurfaceM`, que le cran CONSERVE PAR CONSTRUCTION depuis la
// Tâche 2 bis : ces bancs-là ne peuvent structurellement plus voir un saut.
// Sous `?terre=unique`, ce que l'écran montre est la caméra de FOND, dont
// l'altitude est `camY × emprise / span` (`monde/frontiere-rendu.js`).
// ══════════════════════════════════════════════════════════════════════════

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PAS_CRAN,
  PAS_NIVEAU,
  EXAGERATION_UNIQUE,
  facteurCran,
  franchissement,
  camYApresNiveau,
  poseApresNiveau,
  poseFranchissement,
  poseFonduArrivee,
  avancerFonduPose,
  adoucir,
  adoucirInverse,
  camYPourAltitudeFond,
  distancePourAltitudeFond,
  niveauDArrivee,
  profilDescenteFond,
} from '../src/monde/zoom-continu.js'
import { sautsDuProfil, empriseBlocM, distanceArrivee, PENTE_ARRIVEE_Y, Y_CIBLE } from '../src/loi-altitude.js'
import { altitudeFondM } from '../src/monde/frontiere-rendu.js'
import { ORBITAL_M_PER_UNIT } from '../src/geo.js'
import { STEP_IN, STEP_OUT, DUREE_FONDU_POSE_S, PAS_POSE_MAX_DEG } from '../src/modes.js'

// ⚠️ **UN CANEVAS DE PACOTILLE, ET RIEN DE PLUS.** Le constructeur de `Globe`
// appelle `rebuildRamp`, qui demande un canevas 512×1 pour cuire la rampe
// hypsométrique. Ce fichier n'a besoin d'aucun pixel : il ne mesure que la
// décision de parcours (`_horsCropSeul`). Même stub que
// `test/globe-eviction.test.js`, réduit à ce que `rebuildRamp` touche.
globalThis.document = globalThis.document ?? {
  createElement() {
    const c = { width: 0, height: 0, style: {} }
    c.getContext = () => ({
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {}, drawImage() {},
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      set fillStyle(v) {}, get fillStyle() { return '#000' },
    })
    return c
  },
}

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
const SRC_MODES = lire('src/modes.js')
const SRC_MAIN = lire('src/main.js')
const SRC_GLOBE = lire('src/globe.js')
const SRC_EXAG = lire('src/monde/exageration-continue.js')

// La table de paliers d'exagération du dépôt — celle qui faisait sauter la vue.
const EXAG_PALIERS = (z) => ({ 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 })[z] ?? 2.8

const VOL = {
  altDepartM: 1600000,
  lat: 45.8326, // Mont-Blanc — le vol de référence du §0 du plan
  span: 56,
  pente: PENTE_ARRIVEE_Y,
  yCible: Y_CIBLE,
  zoomFin: 15,
}

// ══════════ ① LA LOI DE ZOOM — MESURÉE, PAS CHOISIE ═════════════════════════

test('① la moyenne géométrique des 18 intervalles d’Adrien est √2 à 0,12 % près', () => {
  // Les DEUX bornes publiées de son relevé Google Earth, et le nombre
  // d'intervalles. Rien d'autre n'est recopié : la moyenne se RECALCULE.
  const haut = 63170e3
  const bas = 126e3
  const intervalles = 18
  const rapportGlobal = haut / bas
  assert.equal(Math.round(rapportGlobal * 100) / 100, 501.35, 'le rapport global publié')
  const moyenneGeo = rapportGlobal ** (1 / intervalles)
  assert.equal(Math.round(moyenneGeo * 1e5) / 1e5, 1.41256, 'la moyenne géométrique publiée')
  // ⚠️ **L'ÉCART SE MESURE SUR LE RAPPORT, PAS SUR SON LOGARITHME** — 0,12 % sur
  // le rapport, 0,34 % sur le log. Le dénominateur est le rapport mesuré.
  const ecart = Math.abs(Math.SQRT2 - moyenneGeo) / moyenneGeo
  assert.ok(ecart < 0.0013, `√2 est à ${(ecart * 100).toFixed(3)} % de la mesure`)
  // et c'est CE nombre-là que le module pose
  assert.equal(PAS_CRAN, Math.LN2 / 2)
  assert.ok(Math.abs(Math.exp(PAS_CRAN) - Math.SQRT2) < 1e-15)
})

test('① le rapport est CONSTANT — ce qui rétrécit est l’écart en kilomètres', () => {
  // ⚠️ **LE PIÈGE NOMMÉ DANS LE CAHIER DES CHARGES** : une loi « de moins en
  // moins forte » casserait la stabilité qu'Adrien admire. On rejoue sa
  // descente à rapport constant et on vérifie les DEUX faits ensemble.
  let alt = 63170e3
  const ecarts = []
  const rapports = []
  for (let i = 0; i < 18; i++) {
    const suivant = alt / Math.SQRT2
    ecarts.push(alt - suivant)
    rapports.push(alt / suivant)
    alt = suivant
  }
  // le rapport ne bouge pas d'un bit
  assert.equal(new Set(rapports.map((r) => r.toFixed(12))).size, 1)
  // l'écart, lui, fond. ⚠️ **CE MODÈLE EST LE √2 PUR, PAS LE RELEVÉ** : Adrien
  // a compté 18 153 km au premier cran et 51 km au dernier ; le √2 pur en rend
  // 18 502 et 51. Le premier diffère de 1,9 % (les 0,12 % du rapport, cumulés
  // sur le premier intervalle du relevé, qui vaut 1,4600 et non 1,41256) — et
  // c'est exactement pourquoi le chiffre du relevé n'est PAS recopié ici.
  assert.equal(Math.round(ecarts[0] / 1000), 18502)
  assert.equal(Math.round(ecarts[17] / 1000), 51)
  assert.ok(ecarts[0] / ecarts[17] > 300, 'l’écart en km est divisé par plus de 300')
})

test('① le CRAN et le NIVEAU DE MNT sont deux grandeurs, pas une', () => {
  // ⛔ Le dépôt les confondait sous `STEP_IN`. Le niveau de MNT vaut ×2 par
  // construction (la grille de tuiles) ; le cran vaut ×√2 (la mesure d'Adrien).
  assert.equal(PAS_NIVEAU, Math.LN2)
  assert.equal(PAS_CRAN, PAS_NIVEAU / 2)
  assert.equal(STEP_IN, Math.LN2 / 2, 'le dépôt posait Math.LN2 — deux fois trop')
  assert.equal(STEP_OUT, STEP_IN, 'sinon l’aller-retour cliquette')
  assert.match(SRC_MODES, /export const STEP_IN = PAS_CRAN/)
  assert.match(SRC_MODES, /export const STEP_OUT = PAS_CRAN/)
})

test('① un cran et son retour rendent EXACTEMENT le point de départ', () => {
  const d0 = 77.5
  const d = d0 * facteurCran(1) * facteurCran(-1)
  assert.ok(Math.abs(d - d0) < 1e-12, `${d} ≠ ${d0}`)
  assert.equal(Math.round(facteurCran(1) * 1e6) / 1e6, Math.round((1 / Math.SQRT2) * 1e6) / 1e6)
  assert.equal(Math.round(facteurCran(-1) * 1e6) / 1e6, Math.round(Math.SQRT2 * 1e6) / 1e6)
})

// ══════════ ② LE FRANCHISSEMENT — UNE DIVISION, PLUS UNE TABLE ══════════════

test('② le niveau se DÉDUIT du budget dépensé : aucune table consultée', () => {
  assert.deepEqual(franchissement(0), { niveaux: 0, reste: 0 })
  // pas encore un niveau plein : on ne franchit pas
  assert.equal(franchissement(-PAS_NIVEAU * 0.99).niveaux, 0)
  // un niveau plein en zoom AVANT → on affine d'un cran, le compteur repart à 0
  const f = franchissement(-PAS_NIVEAU)
  assert.equal(f.niveaux, 1)
  assert.ok(Math.abs(f.reste) < 1e-12)
  // deux niveaux d'un coup (un glissé rapide) → deux crans, pas un
  assert.equal(franchissement(-2 * PAS_NIVEAU - 0.01).niveaux, 2)
  // et l'autre sens
  assert.equal(franchissement(PAS_NIVEAU).niveaux, -1)
  assert.equal(franchissement(PAS_NIVEAU * 0.99).niveaux, 0)
})

test('② l’hystérésis est SYMÉTRIQUE et vaut un facteur 2 — sans seuil à régler', () => {
  // affiner à −ln2, élargir à +ln2 : après un affinage le compteur repart à
  // zéro, il faut donc remonter d'un facteur 2 complet pour élargir. Aucun
  // battement possible.
  let budget = -PAS_NIVEAU
  let zoom = 12
  let f = franchissement(budget)
  zoom += f.niveaux
  budget = f.reste
  assert.equal(zoom, 13)
  // on remonte de 0,99 niveau : rien
  budget += PAS_NIVEAU * 0.99
  assert.equal(franchissement(budget).niveaux, 0, 'pas de battement à la frontière')
  // on insiste jusqu'au niveau plein : on élargit, et on revient à z12
  budget += PAS_NIVEAU * 0.01
  f = franchissement(budget)
  zoom += f.niveaux
  assert.equal(zoom, 12)
})

// ══════════ ③ LE CHANGEMENT D'UNITÉS — L'INVARIANT EST L'ALTITUDE DE FOND ═══

test('③ franchir un niveau ne bouge PAS l’altitude de fond', () => {
  const span = 56
  const empriseAvant = empriseBlocM({ zoom: 10, lat: 45.8326 })
  const empriseApres = empriseBlocM({ zoom: 11, lat: 45.8326 })
  const camY = 38.5
  const avant = altitudeFondM({ camY, extentMeters: empriseAvant, span })
  const apres = altitudeFondM({
    camY: camYApresNiveau({ camY, empriseAvant, empriseApres }),
    extentMeters: empriseApres,
    span,
  })
  assert.ok(Math.abs(apres / avant - 1) < 1e-12, `${apres} ≠ ${avant}`)
})

test('③ MUTATION — reposer sur l’échelle VERTICALE rouvre l’accrochage', () => {
  // ⚠️ **C'EST LE DÉFAUT QUE LA TÂCHE RÉPARE, REJOUÉ.** `poseCranContinu`
  // multiplie `camY` par `échelleAprès / échelleAvant`, où l'échelle porte
  // l'exagération. Avec la table de paliers du dépôt, l'altitude de fond est
  // multipliée par le RAPPORT DES EXAGÉRATIONS — jusqu'à ×2 au cran z4 → z5.
  const span = 56
  const lat = 45.8326
  const cas = [
    [4, 5, 2], // 5 / 2,5
    [5, 6, 0.8], // 4 / 5
    [6, 7, 0.8], // 3,2 / 4
    [7, 8, 0.875], // 2,8 / 3,2
  ]
  for (const [za, zb, attendu] of cas) {
    const ea = empriseBlocM({ zoom: za, lat })
    const eb = empriseBlocM({ zoom: zb, lat })
    const echelleA = (span / ea) * EXAG_PALIERS(za)
    const echelleB = (span / eb) * EXAG_PALIERS(zb)
    const camY = 40
    const altA = altitudeFondM({ camY, extentMeters: ea, span })
    const altB = altitudeFondM({ camY: camY * (echelleB / echelleA), extentMeters: eb, span })
    assert.ok(Math.abs(altB / altA - attendu) < 1e-9, `z${za}→z${zb} : ${(altB / altA).toFixed(4)}`)
  }
  // … et la loi de cette tâche ne dépend PAS de l'exagération : mêmes crans,
  // rapport 1 partout.
  for (const [za, zb] of cas) {
    const ea = empriseBlocM({ zoom: za, lat })
    const eb = empriseBlocM({ zoom: zb, lat })
    const altA = altitudeFondM({ camY: 40, extentMeters: ea, span })
    const altB = altitudeFondM({
      camY: camYApresNiveau({ camY: 40, empriseAvant: ea, empriseApres: eb }),
      extentMeters: eb,
      span,
    })
    assert.ok(Math.abs(altB / altA - 1) < 1e-12)
  }
})

test('③ la pose garde la pente, donc l’angle de vue de l’utilisateur', () => {
  const p = poseApresNiveau({
    camY: 40,
    pente: 0.5,
    empriseAvant: 1000,
    empriseApres: 500,
    yCible: -0.3,
  })
  assert.equal(p.pente, 0.5)
  assert.equal(p.camY, 80)
  assert.equal(p.distanceCible, (80 + 0.3) / 0.5)
})

// ══════════ ④ LA PLONGÉE — L'AUTRE MOITIÉ DU SAUT ═══════════════════════════

test('④ la traversée orbite → surface conserve l’altitude de fond', () => {
  const span = 56
  const extentMeters = empriseBlocM({ zoom: 8, lat: 45.8326 })
  const altM = 260000
  const camY = camYPourAltitudeFond({ altM, extentMeters, span })
  assert.ok(Math.abs(altitudeFondM({ camY, extentMeters, span }) / altM - 1) < 1e-12)
  const d = distancePourAltitudeFond({ altM, extentMeters, span, pente: PENTE_ARRIVEE_Y, yCible: Y_CIBLE })
  assert.ok(Math.abs(Y_CIBLE + d * PENTE_ARRIVEE_Y - camY) < 1e-9)
})

test('④ MUTATION — conserver l’altitude de SURFACE fait sauter la traversée ×exag', () => {
  // ⛔ Le dépôt pose `camY = altM × echelleV` avec `echelleV` VERTICALE : le
  // champ visuel saute alors d'un facteur `exagération(z)`, ce que
  // `loi-altitude.js` nommait « une question, pas un oubli ». Sous D10 il vaut
  // toujours ×2 — un saut, même avec l'exagération figée.
  const span = 56
  const extentMeters = empriseBlocM({ zoom: 8, lat: 45.8326 })
  const altM = 260000
  for (const exag of [2, 2.8, 5]) {
    const camY = altM * (span / extentMeters) * exag
    const rendu = altitudeFondM({ camY, extentMeters, span })
    assert.ok(Math.abs(rendu / altM - exag) < 1e-9, `exag ${exag} → saut ×${(rendu / altM).toFixed(3)}`)
  }
})

test('④ la porte orbitale est GÉOMÉTRIQUE — plus une altitude écrite à la main', () => {
  const n = niveauDArrivee({
    altM: 1600000, ...VOL, zoomMin: 3, zoomMax: 15, distanceMin: 6, distanceMax: 150,
  })
  assert.equal(n.borne, null)
  assert.ok(n.zoom >= 3 && n.zoom <= 15)
  // au-dessus, plus aucun niveau ne tient : c'est la porte, et elle se déduit
  const trop = niveauDArrivee({
    altM: 5e7, ...VOL, zoomMin: 3, zoomMax: 15, distanceMin: 6, distanceMax: 150,
  })
  assert.equal(trop.borne, 'haut')
  // et l'altitude de fond de l'arrivée est bien celle qu'on quittait
  const e = empriseBlocM({ zoom: n.zoom, lat: VOL.lat })
  const camY = Y_CIBLE + n.distanceCible * PENTE_ARRIVEE_Y
  assert.ok(Math.abs(altitudeFondM({ camY, extentMeters: e, span: 56 }) / 1600000 - 1) < 1e-9)
})

// ══════════ ⑤ LE COMPTAGE DES SAUTS — LE CRITÈRE D'ADRIEN ═══════════════════

test('⑤ LE CRITÈRE — la descente par paliers saute, la descente continue non', () => {
  // ⚠️ **LE SEUIL EST CELUI DE LA TÂCHE 1a** (`facteurMin = 1,15`) et le profil
  // est le MÊME code des deux côtés : seule la LOI change.
  const paliers = profilDescenteFond({ ...VOL, regime: 'paliers', exag: EXAG_PALIERS })
  const continu = profilDescenteFond({ ...VOL, regime: 'continu' })
  const sautsPaliers = sautsDuProfil(paliers)
  const sautsContinu = sautsDuProfil(continu)
  assert.ok(sautsPaliers.length >= 4, `paliers : ${sautsPaliers.length} sauts`)
  assert.equal(sautsContinu.length, 0, `continu : ${JSON.stringify(sautsContinu.slice(0, 3))}`)
  // et le plus gros saut du dépôt est bien la traversée, pas un cran
  const pire = sautsPaliers.reduce((a, b) => (b.facteur > a.facteur ? b : a))
  assert.equal(pire.cause, 'plongee')
})

test('⑤ MÊME AU SEUIL LE PLUS FIN, la descente continue ne saute pas', () => {
  // ⚠️ **UN SEUIL DE 1,15 EST GÉNÉREUX** : un banc qui ne rendrait rien
  // passerait aussi. On resserre à 1,001 — 0,1 % d'une image à l'autre — et on
  // vérifie que le profil n'est PAS vide, sans quoi « zéro saut » ne prouverait
  // rien (règle du §0 : « un témoin nul est soit une preuve, soit un banc qui ne
  // rend rien — dire lequel »).
  // ⚠️ **LE DÉNOMINATEUR DE CE SEUIL EST LE PAS D'ÉCHANTILLONNAGE.** Le profil
  // échantillonne les segments continus à ×1,002 d'un point au suivant : un
  // seuil sous 1,002 compterait l'échantillonnage lui-même comme un saut (essayé
  // à 1,001 : 360 « sauts », tous faux). 1,003 est donc le plus fin que cet
  // instrument résolve, et il vaut 0,3 % d'une image à l'autre.
  const continu = profilDescenteFond({ ...VOL, regime: 'continu', ratioMax: 1.002 })
  assert.ok(continu.length > 3000, `le profil compte ${continu.length} points`)
  assert.ok(continu.filter((p) => p.transition === 'cran').length >= 6, 'il y a bien des crans')
  assert.equal(continu.filter((p) => p.transition === 'plongee').length, 1)
  assert.equal(sautsDuProfil(continu, { facteurMin: 1.003 }).length, 0)
  // le même seuil sur le dépôt en compte quatre — les mêmes qu'à 1,15
  const paliers = profilDescenteFond({ ...VOL, regime: 'paliers', exag: EXAG_PALIERS, ratioMax: 1.002 })
  assert.ok(sautsDuProfil(paliers, { facteurMin: 1.003 }).length >= 4)
})

test('⑤ la descente continue va de l’orbite au SOL, et l’altitude ne remonte jamais', () => {
  const continu = profilDescenteFond({ ...VOL, regime: 'continu' })
  const alts = continu.map((p) => p.altM)
  assert.equal(alts[0], VOL.altDepartM)
  assert.ok(alts[alts.length - 1] < 1500, `arrivée à ${Math.round(alts[alts.length - 1])} m`)
  // ⚠️ **AUCUN RECUL** : le dépôt en avait, « 685 623 m rendus à l'envers sur
  // une descente de 1 600 km » (modes.js). Ici l'altitude est monotone.
  const reculs = alts.filter((a, i) => i > 0 && a > alts[i - 1] * (1 + 1e-9)).length
  assert.equal(reculs, 0)
})

// ══════════ ⑥ LE BRANCHEMENT — LÀ OÙ QUATRE TÂCHES D'AFFILÉE ONT ÉCHOUÉ ═════
//
// ⚠️ **LA FAIBLESSE RÉCURRENTE DE CE CHANTIER EST LE BRANCHEMENT** : du code
// juste, jamais appelé. Ces assertions-ci mordent sur la SOURCE des trois
// fichiers de plomberie, parce qu'aucun test ne peut charger `main.js`.

test('⑥ le drapeau du zoom continu est lu UNE fois et passé par un crochet', () => {
  // un seul lecteur, comme `terreUniqueBranchee` lui-même
  assert.match(SRC_MAIN, /zoomContinu: \(\) => terreUniqueBranchee/)
  // et `modes.js` ne connaît QUE le crochet : il n'importe pas `flags.js`
  assert.doesNotMatch(SRC_MODES, /from '\.\/flags\.js'/)
  assert.match(SRC_MODES, /_continu\(\) \{\s*\n\s*return this\.hooks\.zoomContinu\?\.\(\) === true/)
})

test('⑥ le glissé ne se fait plus BORNER par le budget du niveau', () => {
  // ⛔ C'est ÇA, « le cran » qu'Adrien sent : le glissé s'arrêtait à la butée du
  // niveau et il fallait re-défiler pour franchir. Sous le drapeau, la garde est
  // débranchée et le franchissement devient automatique.
  assert.match(SRC_MODES, /_franchirSiBesoin\(\) \{/)
  // la butée du glissé est conditionnée au régime…
  assert.match(SRC_MODES, /if \(!this\._continu\(\)\) \{\n\s*if \(this\._levelZoom \+ dLog < -BUDGET_NIVEAU\)/)
  // … et le franchissement est appelé APRÈS le déplacement de cette image
  const app = SRC_MODES.slice(SRC_MODES.indexOf('  _applyZoom(dt) {'))
  const corpsApply = app.slice(0, app.indexOf('\n  }\n'))
  assert.ok(corpsApply.lastIndexOf('this._franchirSiBesoin()') > corpsApply.indexOf('c.update()'))
  // les deux branches de la molette qui franchissaient « à la fraîche » sont
  // neutralisées sous le drapeau — c'est le « re-scroll pour passer » qui meurt
  assert.match(SRC_MODES, /const atInLimit = !continu &&/)
  assert.match(SRC_MODES, /const atOutLimit = !continu &&/)
})

test('⑥ la conversion d’unités tombe sur la MÊME image que le changement', () => {
  // ⚠️ **LE DÉFAUT MESURÉ QUE ÇA FERME** : `largeurBlocM()` est divisée par deux
  // UNE IMAGE avant que la caméra ne suive — onze bascules du seuil du socle au
  // lieu d'une. Le suiveur est donc appelé EN TÊTE d'`update`, avant que
  // `majSeuilSocle()` et `majCameraFond()` ne lisent quoi que ce soit.
  // ⛔ **TROIS ASSERTIONS DE TEXTE SOURCE ONT ÉTÉ RETIRÉES ICI — Tâche R4, tour
  // de correction.** Elles lisaient la SIGNATURE de `_suivreEmprise` et la
  // MENTION de `poseFranchissement` dans son corps. Elles ne prouvaient rien du
  // comportement — une mutation a survécu à 4 082 tests exactement pour cette
  // raison — et cassaient à la première renommée. Ce qu'elles prétendaient
  // couvrir est désormais couvert par le COMPORTEMENT, en section ⑪ :
  // « ⑪ GARDE — le suiveur repose MÊME à emprise égale… » et « ⑪ GARDE — sans
  // emprise mémorisée… » appellent `_suivreEmprise` et regardent où la caméra
  // atterrit. Ce qui reste ci-dessous est un ORDRE d'appel entre trois lecteurs
  // de `main.js` — une contrainte de séquence qu'aucune valeur ne porte.
  assert.match(SRC_MODES, /update\(dt\) \{[\s\S]{0,700}?this\._suivreEmprise\(\)/)
  // et `main.js` appelle bien `modes.update` avant les deux lecteurs d'altitude
  const iUpdate = SRC_MAIN.indexOf('modes.update(dt)')
  assert.ok(iUpdate > 0 && iUpdate < SRC_MAIN.indexOf('  majSeuilSocle()'))
  assert.ok(iUpdate < SRC_MAIN.indexOf('  majCameraFond()'))
})

test('⑥ le franchissement ne remet PAS l’élan à zéro sous le drapeau', () => {
  // `_resetZoom()` tuait l'inertie à chaque cran : le glissé repartait de zéro,
  // et c'est la moitié de la sensation d'accrochage.
  const bloc = SRC_MODES.slice(SRC_MODES.indexOf('  async _rescale(next, verb'))
  const corps = bloc.slice(0, bloc.indexOf('\n  }\n'))
  assert.match(corps, /if \(!continu\) this\._resetZoom\(\)/)
  // ⚠️ et le cran ne repose PAS la caméra lui-même : il rend la main au suiveur
  // d'unités, seul écrivain de la conversion.
  // ⛔ **LE `cibleAvant` DE CETTE LIGNE N'EST PLUS LU DANS LE TEXTE** — Tâche R4,
  // tour de correction. Que `_rescale` passe bien l'ANCIENNE cible est prouvé
  // par le comportement en ⑪ (« BRANCHEMENT — un franchissement ne tourne PAS la
  // caméra, visée mobile comprise ») : ce test-là échoue à −8,329° dès qu'on
  // remet le geste d'avant. Ce qui reste ici est la FORME de l'appel — que le
  // chemin continu sort avant `poseCranContinu`.
  assert.match(corps, /if \(continu\) \{ this\._suivreEmprise\(.*\); this\.busy = false; return \}/)
  // ⚠️ **LA FORME D'APPEL, PAS LA MENTION** : le commentaire au-dessus nomme
  // `poseCranContinu` pour dire pourquoi on ne l'emploie plus. L'APPEL, lui, est
  // après le retour anticipé — donc hors du chemin continu.
  assert.ok(corps.indexOf('poseCranContinu({') > corps.indexOf('if (continu) {'))
  // et le glissé n'est plus gelé pendant le chargement
  assert.match(SRC_MODES, /\(!this\.busy \|\| this\._continu\(\)\) && Math\.abs\(this\._zoomVel\)/)
})

test('⑥ l’exagération est FIXE sous le drapeau, donc la planète ne se recharge plus', () => {
  // ⚠️ **C'EST LA RÉPONSE EXACTE À LA QUESTION D'ADRIEN** (« pourquoi toute la
  // terre se recharge »). `setExaggeration` → `_rechargeTuiles` rend au réseau
  // TOUTES les tuiles prêtes ; `majExageration` ne l'appelle que si la valeur a
  // bougé. Une constante ne bouge jamais.
  assert.match(SRC_MAIN, /creerExagerationPartagee\(\{[\s\S]*?constante: terreUniqueBranchee \? EXAGERATION_UNIQUE : null/)
  assert.match(SRC_EXAG, /if \(partage\?\.constante > 0\) return partage\.valeur/)
  // ⚠️ **LES TROIS ÉCRIVAINS SONT GELÉS, PAS UN SEUL** : `majExagerationCadrage`
  // et `majExagerationCran` passent par `majExageration`, et `poserExageration`
  // (l'écrivain du chemin plat, rappelé à CHAQUE chargement de bloc) a sa propre
  // garde. En oublier un ramènerait le rechargement au premier cran.
  assert.equal((SRC_EXAG.match(/if \(partage\?\.constante > 0\) return partage\.valeur/g) ?? []).length, 2)
  // et le seul autre appelant de `_rechargeTuiles` reste intact
  assert.match(SRC_GLOBE, /rechargeApresContexte\(\) \{\n\s*this\._rechargeTuiles\(\)/)
})

test('⑥ l’exagération unique est posée à la construction, pas au premier cran', () => {
  // une valeur de départ différente de la constante ferait UN rechargement au
  // démarrage — le seul qu'on ne verrait pas passer, et il coûterait la planète.
  assert.match(SRC_EXAG, /valeur: constante > 0\n\s*\? Number\(constante\)/)
  // ⚠️ **ET LE GLOBE LA LIT À SA CONSTRUCTION** : `this.exaggeration =
  // lireExageration(params)` — donc il naît déjà à 2 et ne se recharge pas.
  assert.match(SRC_GLOBE, /this\.exaggeration = this\.exagSuivie\n\s*\? lireExageration\(params\)/)
  const iPartage = SRC_MAIN.indexOf('const exagPartage = creerExagerationPartagee({')
  assert.ok(iPartage > 0 && iPartage < SRC_MAIN.indexOf('globe = new Globe({'))
})

test('⑥ l’indicateur ORB / Z{n} ne se construit plus sous le drapeau', () => {
  assert.match(SRC_MAIN, /const zoomStepper = terreUniqueBranchee \? null : buildZoomStepper\(\{/)
  assert.match(SRC_MAIN, /zoomStepper\?\.update\(\)/)
  // ⚠️ le chemin plat garde le sien — c'est une SAUVEGARDE, pas un chemin mort
  assert.match(SRC_MAIN, /label: 'ORB'/)
})

test('⑥ `_orbitNotch` et son 1,7 inventé ont disparu au profit de la loi mesurée', () => {
  // ⚠️ **LA MÉTHODE, PAS SA MENTION** : deux commentaires la nomment encore, et
  // c'est de la documentation — le §0 exige qu'on retire le CODE mort, pas la
  // trace de ce qu'il faisait.
  assert.doesNotMatch(SRC_MODES, /_orbitNotch\(dir\) \{/)
  assert.doesNotMatch(SRC_MODES, /this\._orbitNotch\(/)
  assert.doesNotMatch(SRC_MODES, /1 \/ 1\.7/)
  assert.match(SRC_MODES, /cranZoom\(dir\) \{/)
  assert.match(SRC_MODES, /facteurCran\(dir\)/)
  // les deux boutons de l'IHM passent par le cran, dans les deux modes
  assert.match(SRC_MODES, /stepFiner\(\) \{\n\s*this\.cranZoom\(1\)/)
  assert.match(SRC_MODES, /stepWider\(\) \{\n\s*this\.cranZoom\(-1\)/)
})

test('⑥ la traversée ne passe plus par le fondu au blanc sous le drapeau', () => {
  // 480 ms d'aller + 480 ms de retour de rideau : c'est le saut le plus visible
  // de tous, et il n'a plus rien à masquer.
  assert.match(SRC_MODES, /_whiteout\(swap\) \{\s*\n\s*if \(this\._continu\(\)\) return Promise\.resolve\(\)\.then\(swap\)/)
})

// ══════════ ⑦ LA FORME RÉELLE, PAS CELLE QUI ARRANGE ════════════════════════

test('⑦ le crochet est appelé comme la production l’appelle : par FONCTION', () => {
  // ⚠️ **LE TEST FAIBLE QU'UNE TÂCHE PRÉCÉDENTE A TROUVÉ** : tous ses tests
  // passaient le globe PAR SA VALEUR alors que la production le passe PAR UNE
  // FONCTION — la faute était invisible sous la seule forme que la production
  // n'emploie pas. Ici on vérifie que `zoomContinu` est bien un CROCHET
  // (rappelé à chaque lecture), pas un booléen figé à la construction.
  assert.doesNotMatch(SRC_MODES, /this\._zoomContinu = /)
  assert.match(SRC_MODES, /this\.hooks\.zoomContinu\?\.\(\)/)
  // et il est lu à plus d'un endroit — donc figer sa valeur se verrait
  assert.ok((SRC_MODES.match(/this\._continu\(\)/g) ?? []).length >= 4)
})

// ══════════ ⑧ N'AFFINER QUE LA ZONE VISÉE — volet ④ ═════════════════════════
//
// **Adrien, 2026-08-22 :** *« Il n'y a qu'à améliorer la zone sur laquelle on
// zoome et pas le reste, limite les zones à améliorer. »*
//
// ⚠️ **MESURÉ AVANT D'ÊTRE CODÉ**, dans l'application vivante, descente
// 1 600 km → 3 km, `?terre=unique&globe=continu&socle=quadtree&f3=0&frontiere=1&seuil=1` :
// **9 456 tuiles demandées, dont 5 081 HORS du crop — 53,7 %** (et 901 demandées
// alors qu'aucun crop n'était posé, donc légitimes). Données brutes :
// `.banc/vues-M/AV4-trafic.json`. ⚠️ **Le dénominateur est le nombre d'APPELS À
// `_request`, pas des octets** : une tuile redemandée après éviction compte deux
// fois, et « hors crop » est le test de BOÎTE `tuileDansCrop`, le même que
// `zoomCropPrescrit`.

test('⑧ à estompage PLEIN, le dehors n’est plus parcouru — il est déjà invisible', async () => {
  const { Globe } = await import('../src/globe.js')
  const g = new Globe({ globeContinu: true })
  g.poserCrop({ centre: { lat: -21.1, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
  // ⚠️ **LA TUILE TÉMOIN EST UNE RACINE z2 AUX ANTIPODES DU CROP** : elle est
  // hors de la boîte quel que soit l'arrondi de la grille, donc l'assertion ne
  // dépend d'aucun indice calculé à la main.
  assert.equal(g.estompePlein(), false, 'sans `poserEstompage`, la production n’est pas touchée')
  assert.equal(g._horsCropSeul(2, 0, 0), false)
  g.poserEstompage(1)
  assert.equal(g.estompePlein(), true)
  assert.equal(g._horsCropSeul(2, 0, 0), true, 'une racine aux antipodes reste parcourue à estompage plein')
  // … et en cours de fondu, rien n'est coupé : c'est le prix de dessiner la
  // Terre autour, et c'est le sujet même de la Tâche G.
  g.poserEstompage(0.999)
  assert.equal(g.estompePlein(), false)
  assert.equal(g._horsCropSeul(2, 0, 0), false)
  g.dispose()
})

test('⑧ MUTATION — lire `uEstompage` sans `uEstompageOn` couperait la PRODUCTION', () => {
  // ⚠️ **`uEstompage` VAUT 1 PAR DÉFAUT** (`globe.js`, « ET `uEstompage` PART À
  // 1, PAS À 0 »). Un `estompePlein()` qui ne lirait que la valeur rendrait donc
  // `true` sur une planète où l'estompage n'a JAMAIS été posé — c'est-à-dire la
  // vue orbitale de `shibumap.com`, dont le dehors disparaîtrait.
  assert.match(SRC_GLOBE, /uEstompageOn: \{ value: 0 \}/)
  assert.match(SRC_GLOBE, /uEstompage: \{ value: 1 \}/)
  assert.match(SRC_GLOBE, /return u\.uEstompageOn\.value > 0\.5 && u\.uEstompage\.value >= 1/)
})

test('⑧ la coupe de la Tâche N et celle-ci se CUMULENT, aucune ne remplace l’autre', async () => {
  const { Globe } = await import('../src/globe.js')
  const g = new Globe({ globeContinu: true })
  g.poserCrop({ centre: { lat: -21.1, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })
  // repos SANS estompage plein (au-dessus de la bande) : la Tâche N coupe
  g.poserCropSeul(true)
  assert.equal(g._horsCropSeul(2, 0, 0), true)
  // en mouvement AVEC estompage plein (une descente) : cette tâche-ci coupe
  g.poserCropSeul(false)
  g.poserEstompage(1)
  assert.equal(g._horsCropSeul(2, 0, 0), true)
  // ni l'un ni l'autre : la planète entière, comme avant les deux tâches
  g.poserEstompage(0)
  assert.equal(g._horsCropSeul(2, 0, 0), false)
  // ⚠️ et SANS CROP, aucune des deux ne coupe : couper sur un repère absent
  // ferait disparaître la planète.
  g.retirerCrop()
  g.poserCropSeul(true)
  g.poserEstompage(1)
  assert.equal(g._horsCropSeul(2, 0, 0), false)
  g.dispose()
})

// ══════════ ⑨ LA MACHINE À MODES, POUR DE VRAI ══════════════════════════════
//
// ⚠️ **CINQ MUTATIONS ONT SURVÉCU À LA PREMIÈRE CAMPAGNE, ET TOUTES LES CINQ
// VIVAIENT DANS `Modes`** — `_altitudeFondM`, `_suivreEmprise`, la branche
// continue de `_niveauDePlongee` et de `_posePlongee`, et la mémoire d'emprise
// de `_dive`. Aucun test de ce dépôt ne construisait la classe, parce qu'elle
// appelle `document.createElement` et que le dépôt n'a pas de jsdom.
//
// ➡️ **On lui donne un DOM de pacotille et on l'instancie.** Ce n'est pas du
// confort : c'est la seule façon de mordre sur le BRANCHEMENT plutôt que sur son
// texte, et c'est la faiblesse récurrente nommée par le §0.

function domDePacotille() {
  const el = () => {
    const e = { className: '', innerHTML: '', textContent: '', style: {}, enfants: [] }
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }
    e.appendChild = (c) => { e.enfants.push(c); return c }
    e.remove = () => {}
    e.setAttribute = () => {}
    e.addEventListener = () => {}
    e.querySelector = () => el()
    return e
  }
  const corps = el()
  globalThis.document = { createElement: () => el(), body: corps, addEventListener() {} }
  return corps
}

async function machine({ continu = true, emprise = 1e6, span = 56, lat = 45.8326, viseeMobile = false, arrive = { valeur: false } } = {}) {
  domDePacotille()
  const THREE = await import('three')
  const { Modes } = await import('../src/modes.js')
  const camera = new THREE.PerspectiveCamera(33, 16 / 9, 0.5, 1400)
  const etat = { emprise, zoomCharge: [], loadSurface: 0 }
  const controls = {
    target: new THREE.Vector3(0, Y_CIBLE, 0),
    minDistance: 6, maxDistance: 150, enabled: true, maxPolarAngle: 0,
    rotateSpeed: 1, enableZoom: false, enablePan: true,
    getDistance() { return camera.position.distanceTo(this.target) },
    update() {},
  }
  const globe = { setVisible() {} }
  const domElement = { addEventListener() {} }
  const hooks = {
    zoomContinu: () => continu,
    empriseBlocM: () => etat.emprise,
    empriseBlocMAuZoom: (z) => empriseBlocM({ zoom: z, lat }),
    coteBloc: () => span,
    getFineZoom: () => 15,
    surfaceMaxDistance: () => 150,
    surfaceCamAltMeters: () => 0,
    getSurfaceLatLon: () => ({ lat, lon: 6.86 }),
    setSurfaceVisible() {}, setEffectsEnabled() {},
    getRefineTarget: () => ({ lat, lon: 6.86, zoom: 12 }),
    getCoarsenTarget: () => ({ lat, lon: 6.86, zoom: 10 }),
    async loadSurface(_lat, _lon, zoom) { etat.loadSurface++; etat.zoomCharge.push(zoom); etat.emprise /= 2 },
    // ⚠️ **LA VISÉE DU LIEU DÉPLACE LA CIBLE, ET C'EST CE QUE LA PRODUCTION FAIT**
    // — Tâche R4. `main.js` rend le point géographique visé dans le repère du
    // bloc COURANT ; d'un niveau au suivant, ce même point change donc de
    // coordonnées. Sans ce crochet, la cible reste à l'origine et le saut
    // d'orientation du franchissement est structurellement invisible.
    ...(viseeMobile ? { viseeDuLieu: () => ({ x: 4.814 + etat.loadSurface, z: 8.949 - etat.loadSurface }) } : {}),
    // ⚡ **« EST-ON ARRIVÉ SUR LE BLOC » — D16 ter, étape 5.** En production
    // c'est `veilleCrop.repos` (crop posé ET vue au repos) ; ici c'est une boîte
    // que le test ouvre quand il veut, pour vérifier les DEUX côtés : que rien ne
    // bascule tant qu'elle est fermée, et que tout bascule quand elle s'ouvre.
    arriveeSurLeBloc: () => !!arrive.valeur,
  }
  const m = new Modes({ camera, controls, globe, domElement, hooks })
  m.mode = 'surface'
  return { m, camera, controls, etat, THREE }
}

test('⑨ `_altitudeFondM` est `camY × emprise / span`, et rien d’autre', async () => {
  const { m, camera } = await machine({ emprise: 1e6, span: 56 })
  camera.position.set(0, 40, 0)
  assert.equal(m._altitudeFondM(), (40 * 1e6) / 56)
  // ⚠️ inverser les deux rendrait une altitude 3,2 × 10⁸ fois trop petite ici :
  // le rapport `emprise / span` vaut 17 857, pas 1.
  assert.ok(Math.abs(m._altitudeFondM() - (40 * 56) / 1e6) > 1)
})

test('⑨ `_suivreEmprise` convertit la caméra le jour où l’emprise change — et JAMAIS sinon', async () => {
  const { m, camera, controls, etat } = await machine({ emprise: 1e6 })
  camera.position.set(0, 40, 20)
  m._suivreEmprise() // première lecture : elle mémorise, elle ne convertit pas
  const y0 = camera.position.y
  const alt0 = m._altitudeFondM()
  m._suivreEmprise() // emprise inchangée : rien ne bouge
  assert.equal(camera.position.y, y0)
  // l'emprise est divisée par deux (un niveau de MNT)
  etat.emprise /= 2
  m._suivreEmprise()
  assert.ok(Math.abs(m._altitudeFondM() / alt0 - 1) < 1e-9, `l’altitude de fond a bougé de ${(m._altitudeFondM() / alt0).toFixed(4)}`)
  assert.ok(camera.position.y > y0 * 1.9, 'la caméra n’a pas suivi le changement d’unités')
  // et la pente traverse : l'angle de vue de l'utilisateur est gardé
  const p = camera.position.clone().sub(controls.target)
  assert.ok(Math.abs(p.y / p.length() - 0.8944) < 0.01)
})

test('⑨ `_suivreEmprise` NE FAIT RIEN hors du régime continu — le régime cranté est intact', async () => {
  const { m, camera, etat } = await machine({ continu: false, emprise: 1e6 })
  camera.position.set(0, 40, 20)
  m._suivreEmprise()
  etat.emprise /= 2
  m._suivreEmprise()
  assert.equal(camera.position.y, 40)
})

test('⑨ le niveau de plongée se déduit de l’emprise, pas d’une table de paliers', async () => {
  const { m } = await machine({ emprise: 1e6 })
  // 1 600 km : `DIVE_TIERS` dirait z5 ou z6 selon la borne ; ici c'est la
  // géométrie qui répond, et la distance qui va avec tient sous le demi-plafond.
  const n = m._niveauDePlongee(1600000)
  assert.ok(Number.isFinite(n.zoom) && n.zoom >= 3 && n.zoom <= 15)
  assert.ok(n.distanceCible > 0 && n.distanceCible <= distanceArrivee(150) / 2 + 1e-9)
  // ⚠️ **ET LE ZOOM IMPOSÉ RESTE IMPOSÉ** : un clic sur le globe DÉSIGNE.
  assert.equal(m._niveauDePlongee(1600000, 9).zoom, 9)
})

test('⑨ la pose de plongée conserve l’altitude de FOND, pas celle de surface', async () => {
  const { m, THREE } = await machine({ emprise: 1e6, span: 56 })
  const arrival = { pos: new THREE.Vector3(0, 100, 0), target: new THREE.Vector3(0, Y_CIBLE, 0) }
  const pos = m._posePlongee(arrival, 500000)
  const altRendue = (pos.y * 1e6) / 56
  assert.ok(Math.abs(altRendue / 500000 - 1) < 1e-6, `rendu ${Math.round(altRendue)} m pour 500 000 demandés`)
})

test('⑨ le franchissement suit le compteur, et il se garde d’un second pendant le premier', async () => {
  const { m, etat } = await machine({ emprise: 1e6 })
  m._levelZoom = -PAS_NIVEAU * 0.99
  m._franchirSiBesoin()
  assert.equal(etat.loadSurface, 0, 'un niveau incomplet a déclenché un chargement')
  m._levelZoom = -PAS_NIVEAU
  m._franchirSiBesoin()
  assert.equal(etat.loadSurface, 1)
  assert.ok(Math.abs(m._levelZoom) < 1e-12, 'le compteur ne repart pas de son reste')
  // ⚠️ pendant le chargement, `busy` interdit un second franchissement
  m.busy = true
  m._levelZoom = -PAS_NIVEAU * 3
  m._franchirSiBesoin()
  assert.equal(etat.loadSurface, 1)
})

test('⑨ un cran vaut ×√2 sur la distance, et l’aller-retour revient au point de départ', async () => {
  const { m, camera, controls } = await machine({ emprise: 1e6 })
  camera.position.set(0, 40, 20)
  const d0 = controls.getDistance()
  m.cranZoom(1)
  const d1 = controls.getDistance()
  assert.ok(Math.abs(d1 / d0 - 1 / Math.SQRT2) < 1e-9, `un cran rend ×${(d1 / d0).toFixed(4)}`)
  m.cranZoom(-1)
  assert.ok(Math.abs(controls.getDistance() / d0 - 1) < 1e-9)
})

test('⑨ la plongée MÉMORISE l’emprise d’arrivée — sinon elle est convertie deux fois', async () => {
  // ⚠️ **CE CHAMP EST LE SEUL LIEN ENTRE `_dive` ET `_suivreEmprise`.** Sans lui,
  // le suiveur verrait passer l'emprise du bloc quitté à celle du bloc d'arrivée
  // et rejouerait un changement d'unités que la plongée vient d'appliquer — la
  // caméra atterrirait deux fois trop haut.
  const { m, camera, etat } = await machine({ emprise: 1e6 })
  m.mode = 'orbital'
  m.altM = 500000
  m._empriseVue = 4e6 // l'emprise que le suiveur croit connaître
  await m._dive({ altM: 8000, zoom: null })
  assert.equal(m.mode, 'surface')
  const yApres = camera.position.y
  m._suivreEmprise()
  assert.equal(camera.position.y, yApres, 'le suiveur a reconverti ce que la plongée venait de poser')
  assert.equal(m._empriseVue, etat.emprise)
})


test('⑩ la sortie d’orbite se fait a l’altitude EXACTE, sans les 15 % de recul', async () => {
  // ⚠️ **LE × 1,15 D’`altitudeSortieOrbiteM` EXISTAIT POUR REPASSER LA PORTE DE
  // PLONGÉE SANS Y RETOMBER.** La porte est désormais géométrique et `_diveArmed`
  // suffit à ne pas replonger : 15 % de recul seraient un saut, et c’est
  // exactement ce qu’Adrien refuse.
  const { m, camera } = await machine({ emprise: 1e6, span: 56 })
  camera.position.set(0, 40, 20)
  const altFond = m._altitudeFondM()
  await m.enterOrbit()
  assert.equal(m.mode, 'orbital')
  // ⚠️ `this.altM` n'est écrit qu'à l'image suivante (`update`) : on lit l'état
  // POSÉ, pas l'affichage. Lire l'affichage rendrait 0 et ferait passer le test
  // pour une raison qui n'a rien à voir.
  const altOrbite = m.orbAlt * ORBITAL_M_PER_UNIT
  assert.ok(Math.abs(altOrbite / altFond - 1) < 1e-6, 'sortie a ' + Math.round(altOrbite) + ' m pour ' + Math.round(altFond) + ' m')
  // le repère du bloc est quitté : plus rien à suivre
  assert.equal(m._empriseVue, null)
})

test('⑩ D10 — l’exagération unique vaut DEUX, et c’est une décision, pas un réglage', () => {
  // **Adrien, 2026-08-22 :** « On va faire une exagération d’altitude unique à
  // ×2 sur toute la map, ça évitera les sauts et les rechargements. »
  // ⚠️ Elle n’est pas dérivable : c’est un choix, il se garde comme tel.
  assert.equal(EXAGERATION_UNIQUE, 2)
})

test('⑩ les trois crochets d’emprise lisent le MÊME couple que la caméra de fond', () => {
  // ⚠️ **SINON LA CONVERSION D’UNITÉS ET LA POSE DU FOND DIRAIENT DEUX CHOSES.**
  // `majCameraFond()` passe `extentMeters: largeurBlocM()` et `span: TERRAIN_SIZE`
  // à la similitude ; les crochets doivent lire exactement ce couple-là.
  assert.match(SRC_MAIN, /empriseBlocM: \(\) => \(params\.source === 'real' \? largeurBlocM\(\) : 0\)/)
  assert.match(SRC_MAIN, /coteBloc: \(\) => TERRAIN_SIZE/)
  assert.match(SRC_MAIN, /empriseBlocMAuZoom: \(zoom, lat = params\.demLat\) => empriseBlocM\(\{ zoom, lat \}\)/)
  const fond = SRC_MAIN.slice(SRC_MAIN.indexOf('const pose = poseFond({'))
  const corps = fond.slice(0, fond.indexOf('})'))
  assert.match(corps, /extentMeters: largeur/)
  assert.match(corps, /span: TERRAIN_SIZE/)
})

// ══════════════════════════════════════════════════════════════════════════
// ⑪ LA POSE — Tâche R4, « LA TERRE NE DOIT NI BOUGER NI SE RECHARGER »
//
// **Adrien, 2026-08-23, vidéo de 39 s à l'appui :** *« J'ai toujours le problème
// de déplacement de la Terre quand je descends depuis l'orbite. »*
//
// ⚠️ **LA TÂCHE M AVAIT MESURÉ L'ALTITUDE, ET ELLE AVAIT RAISON : L'ALTITUDE NE
// SAUTE PAS.** Ce qui saute, c'est l'ORIENTATION — une grandeur qu'aucune des
// mesures d'altitude de ce fichier ne peut voir, puisqu'une caméra qui bascule
// du nadir à l'oblique sans bouger d'un mètre garde son altitude ET son rapport
// d'altitude d'une image à l'autre.
//
// Relevé image par image dans le navigateur (`.banc/R4/descente.mjs`, descente
// de 60 000 km au sol, drapeau levé), inclinaison au nadir LOCAL :
//
//   | image | événement             | inclinaison       |
//   | 346   | orbite → surface      | 0,000° → 46,548°  |
//   | 652   | franchissement z3→z4  | 46,548° → 36,154° |
//   | 1098  | franchissement z5→z6  | 34,52°  → 37,09°  |
//   | 1984  | franchissement z9→z10 | 45,92°  → 54,05°  |
//   | 2090  | NAISSANCE DU CROP     | 54,047° → 54,047° |
//
// ⚠️ **LA DERNIÈRE LIGNE EST CELLE QUI FIXE LE PÉRIMÈTRE** : la naissance du
// crop ne touche PAS à la caméra, pas d'un millième de degré. Le brief de la
// tâche l'attribuait au crop ; la mesure dit que ce sont la PLONGÉE et les
// FRANCHISSEMENTS. Les deux sont réparés ici, le crop n'y est pour rien.
// ══════════════════════════════════════════════════════════════════════════

const inclinaisonDeg = (cam, cible) => {
  const dx = cam.x - cible.x
  const dy = cam.y - cible.y
  const dz = cam.z - cible.z
  return (Math.acos(dy / Math.hypot(dx, dy, dz)) * 180) / Math.PI
}

test('⑪ la pose de franchissement garde l’inclinaison, quel que soit le saut de cible', () => {
  // le relevé du navigateur, rejoué : la cible saute de 9,1 unités en z
  const camera = { x: -2.229, y: 23.821, z: 25.157 }
  const cibleAvant = { x: -2.229, y: -0.156, z: -0.153 }
  const cibleApres = { x: 4.814, y: -0.297, z: 8.949 }
  const avant = inclinaisonDeg(camera, cibleAvant)
  assert.ok(Math.abs(avant - 46.548) < 0.01, `relevé ${avant.toFixed(3)}° au lieu de 46,548°`)
  const p = poseFranchissement({
    camera,
    cibleAvant,
    cibleApres,
    empriseAvant: 1e6,
    empriseApres: 5e5,
    distanceMin: 6,
    distanceMax: 150,
  })
  const apres = inclinaisonDeg(p, cibleApres)
  assert.ok(Math.abs(apres - avant) < 1e-9, `l’inclinaison a bougé de ${(apres - avant).toFixed(4)}°`)
  // et l'altitude de fond traverse : camY est multipliée par le rapport des emprises
  assert.ok(Math.abs(p.camY / (camera.y * 2) - 1) < 1e-12)
})

test('⑪ MUTATION — lire la direction sur la cible D’APRÈS rouvre le saut de 10°', () => {
  // ⚠️ **SANS CETTE MUTATION, L’ASSERTION CI-DESSUS SERAIT UNE TAUTOLOGIE.**
  // C'est le geste EXACT du dépôt d'avant R4 : `_rescale` écrivait la nouvelle
  // cible, puis `_suivreEmprise` relisait la direction sur le couple dépareillé.
  const camera = { x: -2.229, y: 23.821, z: 25.157 }
  const cibleAvant = { x: -2.229, y: -0.156, z: -0.153 }
  const cibleApres = { x: 4.814, y: -0.297, z: 8.949 }
  const faux = poseFranchissement({
    camera,
    cibleAvant: cibleApres, // ⛔ la lecture d'avant : la cible du NOUVEAU repère
    cibleApres,
    empriseAvant: 1e6,
    empriseApres: 5e5,
    distanceMin: 6,
    distanceMax: 150,
  })
  const ecart = Math.abs(inclinaisonDeg(faux, cibleApres) - inclinaisonDeg(camera, cibleAvant))
  assert.ok(ecart > 9, `la loi d’avant ne dévie que de ${ecart.toFixed(2)}° — le relevé en donne 10,4`)
})

test('⑪ le fondu de pose part du NADIR et finit sur la pose d’arrivée, à camY constant', () => {
  const cible = { x: 3, y: Y_CIBLE, z: -7 }
  const camY = 44
  // la direction d'arrivée du dépôt : PENTE_ARRIVEE = { y: 18, z: 19 }
  const n = Math.hypot(18, 19)
  const direction = { x: 0, y: 18 / n, z: 19 / n }
  const d0 = poseFonduArrivee({ cible, camY, direction, avancement: 0 })
  // à l'aplomb : la caméra est exactement au-dessus de la cible
  assert.ok(Math.abs(d0.x - cible.x) < 1e-9 && Math.abs(d0.z - cible.z) < 1e-9)
  assert.equal(d0.y, camY)
  const d1 = poseFonduArrivee({ cible, camY, direction, avancement: 1 })
  // à l'arrivée : la pose OBLIQUE, celle que `_arrivalPose` produit
  const dist = (camY - cible.y) / direction.y
  assert.ok(Math.abs(d1.x - (cible.x + direction.x * dist)) < 1e-9)
  assert.ok(Math.abs(d1.z - (cible.z + direction.z * dist)) < 1e-9)
  assert.ok(Math.abs(d1.y - camY) < 1e-9)
  // l'inclinaison balaie de 0° à 46,55° SANS jamais reculer, et `camY` ne bouge
  let precedent = -1
  for (let i = 0; i <= 40; i++) {
    const p = poseFonduArrivee({ cible, camY, direction, avancement: i / 40 })
    assert.equal(p.y, camY, 'le fondu a changé l’altitude')
    const incl = inclinaisonDeg(p, cible)
    assert.ok(incl >= precedent - 1e-9, 'l’inclinaison est revenue en arrière')
    precedent = incl
  }
  // ⛔ **46,54816° ET NON 46,551° — Tâche R4, tour de correction.** Le premier
  // jet imprimait 46,551° à six endroits. `90° − atan(18/19)` vaut
  // **46,548157698978°**, et la trace du navigateur rend 46,548157698978194° :
  // l'identification est EXACTE à la treizième décimale, pas approchée. La
  // tolérance descend donc de 0,01 à 1e-9 — au-delà, elle cachait l'erreur.
  assert.ok(Math.abs(precedent - 46.548157698978) < 1e-9, `arrivée à ${precedent.toFixed(12)}° au lieu de 46,548157698978°`)
})

test('⑪ une visée rasante ou une caméra sous la cible ne rendent RIEN, jamais zéro', () => {
  const cible = { x: 0, y: 0, z: 0 }
  assert.equal(poseFonduArrivee({ cible, camY: 40, direction: { x: 0, y: 0, z: 1 } }), null)
  assert.equal(poseFonduArrivee({ cible, camY: -3, direction: { x: 0, y: 1, z: 1 } }), null)
  assert.equal(
    poseFranchissement({ camera: { x: 0, y: 0, z: 10 }, cibleAvant: cible, cibleApres: cible, empriseAvant: 1, empriseApres: 1 }),
    null
  )
})

test('⑪ BRANCHEMENT — un franchissement ne tourne PAS la caméra, visée mobile comprise', async () => {
  // ⚠️ **LA VISÉE MOBILE EST TOUT LE TEST.** Sans crochet `viseeDuLieu`, la
  // cible reste à l'origine d'un niveau à l'autre et le défaut est invisible :
  // c'est exactement pourquoi il a survécu à `npm test`. La production, elle,
  // rend le point géographique visé dans le repère du NOUVEAU bloc — donc une
  // cible qui bouge de plusieurs unités à chaque franchissement.
  const { m, camera, controls } = await machine({ emprise: 1e6, viseeMobile: true })
  camera.position.set(-2.229, 23.821, 25.157)
  controls.target.set(-2.229, -0.156, -0.153)
  const incl = () => inclinaisonDeg(camera.position, controls.target)
  const avant = incl()
  await m._refine()
  const apres = incl()
  assert.ok(Math.abs(controls.target.z + 0.153) > 1, 'la cible n’a pas bougé : le test ne mord sur rien')
  assert.ok(Math.abs(apres - avant) < 1e-6, `la caméra a tourné de ${(apres - avant).toFixed(3)}°`)
})

test('⑪ BRANCHEMENT — la traversée GARDE l’axe de l’orbite, et ne balaie RIEN', async () => {
  // ⛔ **CE TEST A CHANGÉ DE CONTRAT, ET C'EST ADRIEN QUI L'A CHANGÉ.** Il
  // vérifiait que la plongée arrive au nadir **puis balaie toute seule** jusqu'à
  // la pose oblique — le geste de R4. Adrien, après l'avoir vu : *« Je vois
  // toujours un énorme déplacement entre orbite et surface mode. Je veux garder
  // la vue comme en orbite quand je fais la transition. »*
  // D16 ter : **nadir jusqu'au bloc, la vue de trois quarts à l'arrivée.**
  const arrive = { valeur: false }
  const { m, camera, controls } = await machine({ emprise: 1e6, span: 56, arrive })
  m.mode = 'orbital'
  m.altM = 500000
  m._empriseVue = null
  const incl = () => inclinaisonDeg(camera.position, controls.target)
  await m._dive({ altM: 8000, zoom: null })
  assert.equal(m.mode, 'surface')
  assert.ok(incl() < 1e-6, `la traversée arrive à ${incl().toFixed(2)}° au lieu du nadir`)
  assert.equal(m._fonduPose, null, 'un balayage s’est armé à la traversée')
  assert.equal(m._attenteTroisQuarts, true, 'la bascule n’est pas en attente')

  // ⚡ **ET ELLE Y RESTE.** Trois cents images sans arriver sur le bloc : la
  // caméra ne doit pas avoir tourné d'un millionième de degré.
  const altArrivee = m._altitudeFondM()
  for (let i = 0; i < 300; i++) m.update(1 / 60)
  assert.ok(incl() < 1e-6, `la caméra a dérivé à ${incl().toFixed(6)}° sans qu’on arrive au bloc`)
  // ⚠️ **ET `_fonduPose` DOIT RESTER NUL PENDANT TOUTE L'ATTENTE**, ce n'est pas
  // une redondance : `_franchirSiBesoin` refuse de franchir un niveau tant qu'un
  // balayage court. Une attente qui garderait un fondu armé aurait **bloqué tous
  // les crans** de la descente — elle ne se serait jamais affinée.
  assert.equal(m._fonduPose, null, 'un balayage est parti tout seul pendant l’attente')

  // ── on arrive sur le bloc : la bascule part, et elle est plafonnée ────────
  arrive.valeur = true
  m.update(1 / 60)
  assert.ok(m._fonduPose, 'la bascule ne s’est pas armée à l’arrivée sur le bloc')
  assert.equal(m._attenteTroisQuarts, false, 'l’attente n’a pas été levée')
  let plusGrandPas = 0
  let precedent = incl()
  for (let i = 0; i < 400 && m._fonduPose; i++) {
    m.update(1 / 60)
    plusGrandPas = Math.max(plusGrandPas, Math.abs(incl() - precedent))
    precedent = incl()
    assert.ok(Math.abs(m._altitudeFondM() / altArrivee - 1) < 1e-9, 'la bascule a fait bouger l’altitude de fond')
  }
  assert.equal(m._fonduPose, null, 'la bascule ne s’est jamais terminée')
  assert.ok(Math.abs(incl() - 46.54816) < 0.01, `la pose finale vaut ${incl().toFixed(5)}° au lieu de 46,54816°`)
  assert.ok(plusGrandPas < 1.5, `le plus grand pas vaut encore ${plusGrandPas.toFixed(3)}° par image`)
})

test('⑪ ter — revenir en orbite ÉTEINT l’attente, sans quoi elle survivrait au séjour', async () => {
  // ⚠️ Sans cet oubli, un aller-retour orbite → surface → orbite laisserait
  // l'attente armée : la bascule tomberait au premier repos du PROCHAIN séjour,
  // **sans traversée**, donc n'importe où.
  const arrive = { valeur: false }
  const { m } = await machine({ emprise: 1e6, span: 56, arrive })
  m.mode = 'orbital'
  m.altM = 500000
  m._empriseVue = null
  await m._dive({ altM: 8000, zoom: null })
  assert.equal(m._attenteTroisQuarts, true)
  await m.enterOrbit(1200000)
  assert.equal(m.mode, 'orbital')
  assert.equal(m._attenteTroisQuarts, false, 'l’attente a survécu au retour en orbite')
})

test('⑪ DRAPEAU BAISSÉ — la plongée pose la vue oblique tout de suite, comme avant', async () => {
  const { m, camera, controls } = await machine({ continu: false, emprise: 1e6, span: 56 })
  m.mode = 'orbital'
  m.altM = 500000
  await m._dive({ altM: 8000, zoom: null })
  const incl = inclinaisonDeg(camera.position, controls.target)
  // ⚠️ **46,46° ET NON 46,551°, ET CE N'EST PAS UNE TOLÉRANCE MOLLE.** Hors
  // drapeau, `_posePlongee` rend `arrival.pos`, c'est-à-dire `_ARRIVAL_DIR × d`
  // — une position ABSOLUE, pas un décalage depuis la cible. La cible, elle, est
  // à `Y_CIBLE = −0,3`, et ces 0,3 unité valent exactement les 0,09° d'écart. Ce
  // chiffre est le relevé du dépôt AVANT R4 : il grave que le régime hors
  // drapeau n'a pas bougé d'un centième.
  assert.ok(Math.abs(incl - 46.46) < 0.02, `hors drapeau, la plongée arrive à ${incl.toFixed(3)}°`)
  assert.equal(m._fonduPose ?? null, null, 'un fondu de pose s’est armé hors du régime continu')
})

// ══════════════════════════════════════════════════════════════════════════
// ⑫ LES GARDES, PAR LE COMPORTEMENT — Tâche R4, TOUR DE CORRECTION
//
// ⛔ **NEUF MUTATIONS SUR VINGT-SIX SURVIVAIENT AUX 4 202 TESTS, ET QUATRE
// D'ENTRE ELLES ÉTAIENT EXACTEMENT LES GARDES QUE LE RAPPORT DÉFENDAIT LE PLUS
// LONGUEMENT.** Un successeur qui les jugeait inutiles pouvait les retirer et
// laisser la suite verte. Cette section les couvre — **par le comportement, pas
// par le texte source** : ici, une assertion qui lirait `assert.match(SRC_MODES,
// …)` ne prouverait rien, et une mutation a déjà survécu à 4 082 tests pour
// cette raison exacte.
//
// ⚠️ **DEUX DES NEUF SONT DES MUTANTS ÉQUIVALENTS, ET C'EST DÉMONTRÉ, PAS
// SUPPOSÉ** — voir `rapport-R4.md` §9. Les tests ci-dessous épinglent quand même
// le CONTRAT, parce que l'équivalence tient à la garde jumelle d'une AUTRE
// fonction : elle se perdrait au premier remaniement de celle-là.
// ══════════════════════════════════════════════════════════════════════════

test('⑫ GARDE Z5 — la distance de franchissement est ÉCRÊTÉE aux bornes des contrôles', () => {
  // la caméra est très haut : la distance brute dépasse `maxDistance`
  const cibleAvant = { x: 0, y: 0, z: 0 }
  const cibleApres = { x: 3, y: 0, z: -4 }
  const camera = { x: 0, y: 900, z: 900 }
  const p = poseFranchissement({
    camera, cibleAvant, cibleApres, empriseAvant: 1e6, empriseApres: 1e6,
    distanceMin: 6, distanceMax: 150,
  })
  const d = Math.hypot(p.x - cibleApres.x, p.y - cibleApres.y, p.z - cibleApres.z)
  assert.ok(Math.abs(d - 150) < 1e-9, `distance ${d.toFixed(3)} au lieu de la butée 150`)
  assert.ok(Math.abs(p.distanceCible - 150) < 1e-9)
  // et la butée BASSE mord aussi, sur une caméra presque posée sur sa cible
  const bas = poseFranchissement({
    camera: { x: 0, y: 1, z: 1 }, cibleAvant, cibleApres, empriseAvant: 1e6, empriseApres: 1e6,
    distanceMin: 6, distanceMax: 150,
  })
  const db = Math.hypot(bas.x - cibleApres.x, bas.y - cibleApres.y, bas.z - cibleApres.z)
  assert.ok(Math.abs(db - 6) < 1e-9, `distance ${db.toFixed(3)} au lieu de la butée 6`)
})

test('⑫ GARDE Z6 — une visée PRESQUE rasante ne repose RIEN, au lieu d’un ré-ancrage sur la butée', () => {
  // ⚠️ **« PRESQUE » EST TOUT LE TEST.** À pente EXACTEMENT nulle, la garde ne
  // sert à rien : `(camY − yCible) / 0` n'est pas fini et le test de finitude
  // suffit. C'est à pente TRÈS PETITE que la garde travaille : la distance reste
  // FINIE — 80 000 unités ici —, donc la loi rendrait une pose, et l'écrêtage la
  // ramènerait sur `maxDistance`. Sans la garde, une visée rasante ferait donc
  // SAUTER la caméra sur la butée au lieu de la laisser où elle est.
  const cible = { x: 0, y: 0, z: 0 }
  const rasant = { x: 0, y: 40, z: 80000 } // pente = 5 × 10⁻⁴, sous le seuil de 10⁻³
  assert.equal(
    poseFranchissement({ camera: rasant, cibleAvant: cible, cibleApres: cible, empriseAvant: 1, empriseApres: 1, distanceMax: 150 }),
    null
  )
  // le témoin : au-DESSUS du seuil, la même géométrie rend bien une pose — et
  // elle atterrit sur la butée, ce qui montre exactement ce que la garde évite
  const ok = poseFranchissement({
    camera: { x: 0, y: 40, z: 8000 }, cibleAvant: cible, cibleApres: cible,
    empriseAvant: 1, empriseApres: 1, distanceMax: 150,
  })
  assert.ok(ok && Math.abs(ok.distanceCible - 150) < 1e-9, 'le témoin ne prouve rien')
})

test('⑫ GARDE Z13 — l’avancement du fondu est BORNÉ à [0, 1]', () => {
  const cible = { x: 3, y: Y_CIBLE, z: -7 }
  const n = Math.hypot(18, 19)
  const direction = { x: 0, y: 18 / n, z: 19 / n }
  const camY = 44
  const p = (a) => poseFonduArrivee({ cible, camY, direction, avancement: a })
  for (const [hors, dedans] of [[1.4, 1], [12, 1], [-0.3, 0], [-9, 0]]) {
    const a = p(hors)
    const b = p(dedans)
    assert.ok(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.z - b.z) < 1e-12,
      `avancement ${hors} ne retombe pas sur ${dedans}`)
  }
  // et sans la borne, 1,4 sortirait VRAIMENT de la course : le témoin le dit
  const elevFin = Math.asin(direction.y)
  const horsCourse = Math.PI / 2 + (elevFin - Math.PI / 2) * 1.4
  assert.ok(horsCourse < elevFin - 0.1, 'le témoin ne prouve rien : 1,4 ne sort pas de la course')
})

test('⑫ GARDE M4 — un franchissement ne se lance PAS pendant le balayage, et il n’est pas PERDU', async () => {
  // ⚠️ **LA GARDE QUE LE RAPPORT DÉFEND SUR DIX LIGNES, ET QUE RIEN NE
  // PROTÉGEAIT.** Un franchissement lancé au milieu du balayage écrirait une
  // nouvelle cible et se battrait avec lui pour la même caméra.
  const { m, etat } = await machine({ emprise: 1e6 })
  m._levelZoom = PAS_NIVEAU * 1.2 // de quoi franchir un niveau
  const budget = m._levelZoom
  m._fonduPose = { t: 0.3, e: 0.3, angleTotalDeg: 46.5, cible: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 } }
  m._franchirSiBesoin()
  assert.equal(etat.loadSurface, 0, 'un niveau a été franchi PENDANT le balayage')
  assert.equal(m._levelZoom, budget, 'le budget a été dépensé pendant le balayage')
  // ⚠️ **ET LE COMPTEUR TRAVERSE** : le niveau se franchit dès que le balayage
  // est fini. Sans cette moitié-là, la garde serait une perte, pas un report.
  m._fonduPose = null
  m._franchirSiBesoin()
  assert.ok(m._levelZoom < budget, 'le budget n’a pas été dépensé une fois le balayage fini')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(etat.loadSurface, 1, 'le niveau reporté n’a jamais été franchi')
})

test('⑫ GARDE M5 — le suiveur repose MÊME à emprise égale, dès qu’on lui donne l’ancienne cible', async () => {
  // ⚠️ **LE CAS MESURÉ** : pendant l'`await` du chargement, le suiveur PAR IMAGE
  // a déjà vu passer la nouvelle emprise et l'a convertie. Sortir sur
  // `avant === emprise` laisserait la caméra ancrée sur une cible qui n'existe
  // plus — c'est-à-dire exactement le défaut, une image plus tard.
  const { m, camera, controls } = await machine({ emprise: 1e6 })
  camera.position.set(-2.229, 23.821, 25.157)
  controls.target.set(-2.229, -0.156, -0.153)
  m._suivreEmprise() // première lecture : elle mémorise l'emprise, et rien d'autre
  const cibleAvant = controls.target.clone()
  const attendu = inclinaisonDeg(camera.position, cibleAvant)
  // la cible saute dans le repère du nouveau bloc — SANS que l'emprise change
  controls.target.set(4.814, -0.297, 8.949)
  const posAvant = camera.position.clone()
  m._suivreEmprise(cibleAvant)
  assert.ok(camera.position.distanceTo(posAvant) > 1, 'la caméra n’a pas été reposée du tout')
  const obtenu = inclinaisonDeg(camera.position, controls.target)
  assert.ok(Math.abs(obtenu - attendu) < 1e-9, `la caméra a tourné de ${(obtenu - attendu).toFixed(4)}°`)
})

test('⑫ GARDE M7 — sans emprise mémorisée, on RÉ-ANCRE quand même, et sans convertir', async () => {
  const { m, camera, controls } = await machine({ emprise: 1e6 })
  camera.position.set(-2.229, 23.821, 25.157)
  controls.target.set(-2.229, -0.156, -0.153)
  const cibleAvant = controls.target.clone()
  const attendu = inclinaisonDeg(camera.position, cibleAvant)
  const camY = camera.position.y
  assert.equal(m._empriseVue, null, 'l’état de départ du test n’est pas « sans emprise mémorisée »')
  controls.target.set(4.814, -0.297, 8.949)
  m._suivreEmprise(cibleAvant)
  // ré-ancré…
  assert.ok(Math.abs(inclinaisonDeg(camera.position, controls.target) - attendu) < 1e-9)
  // … et SANS conversion d'altitude : `camY` traverse à l'identique
  assert.ok(Math.abs(camera.position.y - camY) < 1e-9, `camY est passée de ${camY} à ${camera.position.y}`)
})

test('⑫ GARDE M9 — la courbe du balayage est ADOUCIE, pas linéaire', () => {
  // ⚠️ **C'EST DE CETTE COURBE QUE `DUREE_FONDU_POSE_S` EST DÉRIVÉE** : « la
  // vitesse de pointe vaut DEUX fois la moyenne ». Une courbe linéaire donne un
  // pas constant, passe tous les seuils, et rend la dérivation fausse en silence.
  const n = 66
  const pas = []
  let e = 0
  for (let i = 1; i <= n; i++) {
    const suite = adoucir(i / n)
    pas.push(suite - e)
    e = suite
  }
  const moyen = 1 / n
  const pointe = Math.max(...pas)
  assert.ok(pointe / moyen > 1.9 && pointe / moyen < 2.1, `pointe/moyenne = ${(pointe / moyen).toFixed(3)} au lieu de ≈ 2`)
  // les deux bouts sont adoucis : le premier pas est une fraction du plus grand
  assert.ok(pas[0] < pointe / 10, 'le départ n’est pas adouci')
  assert.ok(pas[n - 1] < pointe / 10, 'l’arrivée n’est pas adoucie')
  // et la réciproque est bien la réciproque — c'est elle qui remonte `t` quand
  // le plafond par image mord
  for (const t of [0, 0.13, 0.4999, 0.5, 0.5001, 0.87, 1]) {
    assert.ok(Math.abs(adoucirInverse(adoucir(t)) - t) < 1e-12, `réciproque fausse en t = ${t}`)
  }
})

test('⑫ GARDE M11 — une arrivée sous `minDistance` n’arme AUCUN balayage, et ne bouge pas la caméra', async () => {
  // ⚠️ **C'EST LA RÉSERVE 2 DU RAPPORT**, et rien ne la protégeait. À l'aplomb,
  // la distance à la cible vaut `camY − yCible` ; sous `minDistance`,
  // `controls.update()` la repousserait à chaque image et le balayage se
  // battrait contre la butée.
  const { m, camera } = await machine({ emprise: 1e6 })
  const cible = new (camera.position.constructor)(0, 0, 0)
  // minDistance vaut 6 dans le banc : 4 est dessous, 12 est au-dessus
  camera.position.set(0, 4, 4)
  const posAvant = camera.position.clone()
  m._armerFonduPose(cible)
  assert.equal(m._fonduPose, null, 'un balayage s’est armé sous la butée de distance')
  assert.equal(camera.position.distanceTo(posAvant), 0, 'la caméra a bougé alors que rien ne devait s’armer')
  // le témoin : au-dessus de la butée, le même geste arme bien un balayage
  camera.position.set(0, 12, 12)
  m._armerFonduPose(cible)
  assert.ok(m._fonduPose, 'le témoin ne prouve rien : rien ne s’arme même au-dessus de la butée')
  assert.ok(m._fonduPose.angleTotalDeg > 40 && m._fonduPose.angleTotalDeg < 50)
})

test('⑫ GARDE M10 — une arrivée rasante n’arme aucun balayage', async () => {
  // ⚠️ **MUTANT ÉQUIVALENT, ET LE TEST EST QUAND MÊME UTILE.** La garde
  // `direction.y > 1e-3` de `_armerFonduPose` lit la MÊME grandeur normalisée
  // que la garde `sinFin > penteMin` de `poseFonduArrivee`, au même seuil : la
  // retirer ne change rien d'observable — le balayage s'arme puis se désarme
  // dans le même appel. Ce test épingle le CONTRAT — « rasant ⇒ rien » — qui,
  // lui, cesserait d'être tenu si l'autre garde bougeait.
  const { m, camera } = await machine({ emprise: 1e6 })
  const cible = new (camera.position.constructor)(0, 0, 0)
  camera.position.set(0, 7, 7000) // 7 unités de haut pour 7 000 de côté
  m._armerFonduPose(cible)
  assert.equal(m._fonduPose, null, 'un balayage s’est armé sur une arrivée rasante')
})

// ══════════════════════════════════════════════════════════════════════════
// ⑫ bis LE PLAFOND PAR IMAGE — LE GARDE-FOU QUI NE POUVAIT PAS ÉCHOUER
//
// ⛔ **`assert.ok(plusGrandPas < 3)` NE POUVAIT PAS ÉCHOUER**, parce que
// `machine()` alimente un `dt` PARFAIT de 1/60, où la courbe donne 1,41°. Dans
// l'application, la plongée est le moment où la surface se charge : les images
// durent 90, 160, 195, 225 ms, et l'écrêtage `Math.min(dtBrut, 0,05)` de
// `main.js` les convertissait en pas de 4°.
//
// **Mesuré par moi, en Chrome VISIBLE, sur la RTX 3080 d'Adrien**
// (`node scripts/sonde-descente.mjs --visible 1`, trace
// `.banc/R4/r4c-gpu-avant.json`) : pas de pointe **4,135°** sur une image de
// 95 ms, **six** pas au-dessus de 3°, balayage de 34 images en 1 974 ms.
//
// `INTERVALLES_GPU` est la suite RELEVÉE des durées d'image de ce balayage, en
// millisecondes. C'est elle qui rend le test capable d'échouer.
// ══════════════════════════════════════════════════════════════════════════

const INTERVALLES_GPU = [
  9, 225, 19, 12, 83, 93, 71, 3, 68, 81, 84, 8, 90, 95, 162, 8, 194, 106, 122, 9,
  139, 104, 14, 14, 6, 26, 8, 19, 19, 16, 16, 17, 28, 6, 20, 17, 17, 18, 17, 19,
]
// `main.js` écrête le pas de temps de simulation ; le banc doit l'écrêter pareil,
// sans quoi il mesurerait un autre logiciel que celui qui tourne.
const DT_GPU = INTERVALLES_GPU.map((ms) => Math.min(ms / 1000, 0.05))
const ANGLE_PLONGEE = 46.548157698978

test('⑫ bis MUTATION — sans le plafond, le `dt` RELEVÉ rouvre 4° et six pas au-dessus de 3°', () => {
  // ⚠️ **SANS CETTE MUTATION, LE TEST SUIVANT SERAIT UNE TAUTOLOGIE.** C'est la
  // loi du premier jet, au caractère près : la même courbe, le même `dt` écrêté,
  // et AUCUN plafond angulaire.
  let t = 0
  let e = 0
  let pointe = 0
  let sup3 = 0
  for (const dt of DT_GPU) {
    const p = avancerFonduPose({ t, e, dt, duree: DUREE_FONDU_POSE_S, angleTotalDeg: ANGLE_PLONGEE, pasMaxDeg: Infinity })
    const pas = ANGLE_PLONGEE * (p.e - e)
    pointe = Math.max(pointe, pas)
    if (pas > 3) sup3++
    t = p.t; e = p.e
    if (p.fini) break
  }
  assert.ok(pointe > 4, `la loi d’avant ne donne que ${pointe.toFixed(3)}° — le navigateur en a relevé 4,135`)
  assert.ok(sup3 >= 6, `seulement ${sup3} pas au-dessus de 3° — le navigateur en a relevé 6`)
})

test('⑫ bis le plafond tient sur le `dt` RELEVÉ, et le balayage s’étire au lieu de sauter', () => {
  let t = 0
  let e = 0
  let pointe = 0
  let images = 0
  let ms = 0
  // la queue à 17 ms : une fois la surface chargée, l'application retrouve son
  // rythme. Elle sert à mesurer de combien le balayage s'ÉTIRE, pas à l'aider.
  const suite = [...INTERVALLES_GPU, ...Array(200).fill(17)]
  for (const brut of suite) {
    const dt = Math.min(brut / 1000, 0.05)
    const p = avancerFonduPose({ t, e, dt, duree: DUREE_FONDU_POSE_S, angleTotalDeg: ANGLE_PLONGEE, pasMaxDeg: PAS_POSE_MAX_DEG })
    pointe = Math.max(pointe, ANGLE_PLONGEE * (p.e - e))
    t = p.t; e = p.e; images++; ms += brut
    if (p.fini) break
  }
  assert.ok(e >= 1, 'le balayage ne s’est jamais terminé')
  assert.ok(pointe <= PAS_POSE_MAX_DEG + 1e-9, `pas de pointe ${pointe.toFixed(4)}° au-dessus du plafond`)
  // ⚠️ **LE PRIX EST BORNÉ, LUI AUSSI, ET IL EST ICI** : le même balayage passe
  // de 40 images / 2 082 ms à 57 / 2 371 ms. On grave la borne haute pour qu'un
  // réglage futur du plafond ne fasse pas glisser le balayage à cinq secondes
  // sans que personne ne le voie.
  assert.ok(ms < 3000, `le balayage s’étire à ${ms} ms — au-delà de trois secondes, ce n’est plus une transition`)
  assert.ok(images < 80, `${images} images — l’étirement a dérapé`)
})

test('⑫ bis BRANCHEMENT — la plongée rejouée sur le `dt` RELEVÉ ne franchit plus le plafond', async () => {
  // ⚠️ **C'EST LE TEST QUE LA RELECTURE DEMANDAIT** : la vraie machinerie
  // (`Modes.update`), alimentée par le `dt` du navigateur et non par un 1/60
  // parfait. Sur le code d'avant ce tour, il échoue à plus de 4°.
  // ⚠️ **LA BASCULE NE PART PLUS À LA TRAVERSÉE — D16 ter, étape 5** : elle
  // attend l'arrivée sur le bloc. Le plafond, lui, est exactement le même, et
  // c'est ce que ce test mesure ; on ouvre donc la boîte avant de rejouer le `dt`.
  const arrive = { valeur: true }
  const { m, camera, controls } = await machine({ emprise: 1e6, span: 56, arrive })
  m.mode = 'orbital'
  m.altM = 500000
  m._empriseVue = null
  const incl = () => inclinaisonDeg(camera.position, controls.target)
  await m._dive({ altM: 8000, zoom: null })
  m.update(1 / 60) // l'image où l'arrivée arme la bascule
  assert.ok(m._fonduPose, 'aucun balayage ne s’est armé : le test ne mord sur rien')
  const altArrivee = m._altitudeFondM()
  let plusGrandPas = 0
  let precedent = incl()
  const suite = [...DT_GPU, ...Array(200).fill(1 / 60)]
  for (let i = 0; i < suite.length && m._fonduPose; i++) {
    m.update(suite[i])
    plusGrandPas = Math.max(plusGrandPas, Math.abs(incl() - precedent))
    precedent = incl()
    assert.ok(Math.abs(m._altitudeFondM() / altArrivee - 1) < 1e-9, 'le balayage a fait bouger l’altitude de fond')
  }
  assert.equal(m._fonduPose, null, 'le balayage ne s’est jamais terminé')
  assert.ok(Math.abs(incl() - 46.54816) < 0.01, `la pose finale vaut ${incl().toFixed(5)}°`)
  assert.ok(plusGrandPas <= PAS_POSE_MAX_DEG + 1e-9,
    `le plus grand pas vaut ${plusGrandPas.toFixed(3)}° par image — le plafond est à ${PAS_POSE_MAX_DEG}°`)
  // ⚠️ **ET LE PLAFOND A BEL ET BIEN MORDU SUR CETTE SUITE-LÀ** : sans cette
  // ligne, le test repasserait tout seul le jour où quelqu'un le retirerait.
  assert.ok(plusGrandPas > PAS_POSE_MAX_DEG - 1e-6,
    `le plafond n’a jamais mordu (pointe ${plusGrandPas.toFixed(3)}°) : ce dt ne prouve rien`)
})
