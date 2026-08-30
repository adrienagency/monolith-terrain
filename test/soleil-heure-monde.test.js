// L'HEURE DE LA PLANÈTE — Tâche R7 du chantier « une seule Terre ».
//
// ══════════ POURQUOI CE FICHIER EXISTE, ET IL PART D'UNE MESURE ═════════════
//
// Adrien a filmé une descente sous `?terre=unique&frontiere=1&seuil=1` avec
// **`03h22` affiché sur l'horloge du bandeau, du début à la fin**. Avant le
// seuil la scène est en plein jour ; après, elle est nocturne. Relevé au banc
// (`.banc/R7/`, Chrome sans tête, 1280×800, `readPixels` sur le tampon composé,
// La Réunion) — **la caméra ne bouge pas, seule l'horloge bouge** :
//
//   | heure  | élévation vue par le CROP | élévation vue par la PLANÈTE | uSunDir                          |
//   |--------|---------------------------|------------------------------|----------------------------------|
//   | 00h00  | +40,02°                   | **+51,60°**                  | (0,23049 · −0,36868 · 0,90053)   |
//   | 03h22  | +40,01°                   | **+51,60°**                  | (0,23049 · −0,36868 · 0,90053)   |
//   | 06h00  | +15,14°                   | **+51,60°**                  | (0,23049 · −0,36868 · 0,90053)   |
//   | 12h00  | +57,16°                   | **+51,60°**                  | (0,23049 · −0,36868 · 0,90053)   |
//   | 21h00  | +39,99°                   | **+51,60°**                  | (0,23049 · −0,36868 · 0,90053)   |
//
// **`uSunDir` est identique au bit près aux huit heures essayées.** La planète
// ne lit pas l'heure ; elle lit la CAMÉRA — `main.js` reposait, à chaque image,
// `globe.setSunDir(camPosition.normalize().applyAxisAngle(Y, −0,73))`.
//
// ══════════ ⚠️ LA MONNAIE DE L'ÉLÉVATION — LE PIÈGE DE CETTE TÂCHE ══════════
//
// `daycycle.lightingFor` rend DEUX élévations, et elles ne veulent pas dire la
// même chose :
//
//   · `sunElevation` — l'élévation ASTRONOMIQUE. −26,12° à 03h22. C'est elle qui
//     dit de quel côté du terminateur on est.
//   · `elevation`    — l'élévation de la LAMPE, `lightElevationFor(sunElevation)`,
//     relevée par plancher à **+40°** la nuit « so the moon shines from above »
//     (`main.js`). C'est elle que `params.sunElevation` porte, et c'est la bonne
//     pour MODELER le relief : le socle et le crop l'emploient tous les deux.
//
// ⛔ **DONNER `params.sunElevation` À LA PLANÈTE RENDRAIT LE PLEIN JOUR À 3 h DU
// MATIN** — une grandeur juste, dans la mauvaise monnaie.
//
// ══════════ ⚠️ CE QUE LE TOUR 1 DE CE FICHIER NE GARDAIT PAS ════════════════
//
// Une campagne de 14 mutations menée à la relecture en a laissé passer SEPT.
// Toutes avaient la même cause : le §③ d'alors ne lisait que du **TEXTE
// SOURCE**, et un texte ne s'exécute pas. On pouvait inverser les deux gardes de
// la boucle d'image, neutraliser entièrement l'aiguilleur, ou empoisonner
// `skyState` à 70 lignes de là — 4 204 tests au vert dans les trois cas.
//
// ➡️ **Ce fichier EXÉCUTE maintenant le branchement au lieu de le lire.** Les
// trois morceaux de `main.js` qui portent la décision (les deux gardes de la
// boucle d'image, l'aiguilleur `soleilDuGlobe`, et la ligne d'`applyTimeOfDay`
// qui choisit la monnaie) sont **découpés du source et évalués** avec des
// doublures. Une mutation qui les neutralise fait tomber une assertion, pas un
// `assert.match`.
//
// ══════════ ⚠️ ET LA DATE EST FIGÉE — ELLE NE L'ÉTAIT PAS ══════════════════
//
// `lightingFor(h, lat, lon)` sans quatrième argument suit le jour où le test
// tourne. Mesuré sur les 365 jours de 2026 : l'assertion « midi haut » (> 60°)
// échouait **183 jours**, et « nuit franche » (< −20°) **64 jours**. Reproduit
// horloge figée au 15 janvier 2027 : midi vaut **37,876°**. `daycycle.test.js`
// et `light-gain.test.js` figent la date ; ce fichier ne le faisait pas.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { lightingFor } from '../src/daycycle.js'
import { hautLocal, repereSolSphere, directionSoleilLocale } from '../src/monde/eclairage-crop.js'
import {
  soleilMondeDeLHeure, poseurDuSoleilDuGlobe, plancherNuitMonde,
  NUIT_PRODUCTION, NUIT_LISIBLE,
} from '../src/monde/soleil-monde.js'
import { FLAGS, soleilHeureMondeActif } from '../src/flags.js'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// ⚠️ CE FICHIER DÉCOUPE DES LIGNES, DONC IL SUPPOSE DU LF — et le dépôt lui en
// donne : `.gitattributes` impose `* text=auto eol=lf`. C'est une dette soldée
// par la Tâche P13, après que cinq agents s'y soient pris les pieds — dont une
// campagne de mutation qui a rendu de FAUX SURVIVANTS à cause d'un `\r` traînant
// en fin de ligne. Si un jour ces assertions tombent en bloc, c'est là qu'il
// faut regarder avant de suspecter le code.
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8')
const SRC_MAIN = lire('src/main.js')
const SRC_GLOBE = lire('src/globe.js')
const SRC_NUAGES = lire('src/globe-clouds.js')

// Le lieu et l'heure LUS SUR LA VIDÉO d'Adrien (bandeau « REFINING — 30.8804,
// -5.5899 » à t20 ; horloge « 03h22 » sur les 39 images).
const LAT = 30.8804
const LON = -5.5899
const H_VIDEO = 3 + 22 / 60
// ⚠️ LE JOUR DE LA VIDÉO, FIGÉ — même patron que `daycycle.test.js` (`JUNE`,
// `DEC`) et `light-gain.test.js` (`REF`). Sans lui les seuils d'élévation
// ci-dessous suivent la saison du jour où le test tourne.
const JOUR_VIDEO = new Date(Date.UTC(2026, 7, 23))

const R2D = 180 / Math.PI
const scal = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
/** L'élévation, en degrés, d'une direction du repère du globe au-dessus de l'horizon LOCAL. */
const elevationVue = (dir, lat, lon) => Math.asin(Math.max(-1, Math.min(1, scal(dir, hautLocal(lat, lon))))) * R2D
/**
 * L'AZIMUT, en degrés, d'une direction du repère du globe, lu dans le repère
 * local. C'est la réciproque exacte de `directionSoleilLocale`, qui pose
 * `cEst = cos(az)·cos(el)` et `cNord = −sin(az)·cos(el)`.
 */
const azimutVu = (dir, lat, lon) => {
  const { est, nord } = repereSolSphere(lat, lon)
  const a = Math.atan2(-scal(dir, nord), scal(dir, est)) * R2D
  return ((a % 360) + 360) % 360
}
const ecartAngulaire = (a, b) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(d, 360 - d)
}

// ══════════ LE DÉCOUPAGE DE `main.js` — POUR L'EXÉCUTER, PAS LE LIRE ════════
//
// ⚠️ **AUCUN TEST NE CHARGE `main.js`** (il apporte le DOM, three et le réseau) —
// c'est la règle du dossier, et onze autres fichiers de `test/` la suivent. Mais
// « ne pas charger le module » n'oblige pas à se contenter d'`assert.match` : on
// peut DÉCOUPER le morceau qui porte la décision et l'ÉVALUER avec des
// doublures. C'est ce que font les deux fonctions ci-dessous, et c'est toute la
// différence entre « le texte est là » et « le branchement marche ».

/** Le texte d'une fonction de `main.js`, accolades équilibrées. */
function sourceDeFonction(nom) {
  const tete = `function ${nom}(`
  const i = SRC_MAIN.indexOf(tete)
  assert.ok(i >= 0, `${nom}() introuvable dans main.js`)
  const j = SRC_MAIN.indexOf('{', i)
  let prof = 0
  for (let k = j; k < SRC_MAIN.length; k++) {
    if (SRC_MAIN[k] === '{') prof++
    else if (SRC_MAIN[k] === '}') {
      prof--
      if (prof === 0) return SRC_MAIN.slice(i, k + 1)
    }
  }
  throw new Error(`${nom}() : accolades non refermées`)
}

/** Les lignes de CODE (commentaires exclus) qui contiennent un motif. */
function lignesDeCode(motif, source = SRC_MAIN) {
  return source.split('\n')
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => motif.test(l) && !/^\s*\/\//.test(l) && !/^\s*\*/.test(l))
}

test('le découpage de main.js mord — sinon tout ce fichier serait muet', () => {
  // ⚠️ un `return` muet rend un test vert et indistinguable d'un test qui a lu.
  // Ce témoin-ci échoue si l'extraction rend du vide ou attrape autre chose.
  const src = sourceDeFonction('soleilDuGlobe')
  assert.ok(src.startsWith('function soleilDuGlobe()'), src.slice(0, 40))
  assert.ok(src.endsWith('}'))
  assert.ok(src.split('\n').length >= 3, 'un corps, pas une ligne vide')
  assert.equal(sourceDeFonction('placeSun').match(/sun\.position\.set/g)?.length, 1)
})

// ══════════ ① LA LOI — ET C'EST LA MONNAIE QUI EST GARDÉE ═══════════════════

test('① la nuit du lieu filmé est une nuit ASTRONOMIQUE, et le cycle porte les deux monnaies', () => {
  const s = lightingFor(H_VIDEO, LAT, LON, JOUR_VIDEO)
  assert.ok(s.sunElevation < -20, `03h22 doit être une nuit franche, lu ${s.sunElevation}`)
  // et la lampe, elle, est relevée au-dessus de l'horizon : les deux monnaies
  // existent bel et bien, dans le même objet.
  assert.ok(s.elevation > 30, `la lampe de nuit est relevée, lu ${s.elevation}`)
})

test('① le soleil du monde SUIT L HEURE — et il passe sous l horizon la nuit', () => {
  const vues = []
  for (const h of [0, H_VIDEO, 6, 9, 12, 15, 18, 21]) {
    const s = lightingFor(h, LAT, LON, JOUR_VIDEO)
    const dir = soleilMondeDeLHeure(s, { lat: LAT, lon: LON })
    assert.ok(dir, `une direction à ${h} h`)
    assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-12, 'vecteur unitaire')
    vues.push(elevationVue(dir, LAT, LON))
    // ⚡ LE POINT : ce que la planète voit EST l'élévation astronomique.
    assert.ok(Math.abs(vues.at(-1) - s.sunElevation) < 1e-9,
      `à ${h} h la planète doit voir ${s.sunElevation}°, elle voit ${vues.at(-1)}°`)
  }
  // et ce n'est pas une constante : huit heures, huit élévations.
  assert.equal(new Set(vues.map((v) => v.toFixed(3))).size, 8)
  // à 03h22 le soleil est SOUS l'horizon — la nuit qu'Adrien a filmée.
  assert.ok(vues[1] < 0, `03h22 sous l'horizon, lu ${vues[1]}`)
  // à midi il est haut.
  assert.ok(vues[4] > 60, `midi haut, lu ${vues[4]}`)
})

test('① ⚡ L AZIMUT AUSSI — une élévation seule laisse le soleil planté plein nord', () => {
  // ⛔ **UNE MUTATION A SURVÉCU ICI AU TOUR 1** : `directionSoleilLocale(0, …)`,
  // azimut ignoré, 4 204 tests au vert. Toutes les assertions ci-dessus
  // comparent des ÉLÉVATIONS, et l'élévation est INVARIANTE par rotation
  // d'azimut. La moitié de la loi n'était gardée nulle part.
  const azimuts = []
  for (const h of [6, 9, 12, 15, 18]) {
    const s = lightingFor(h, LAT, LON, JOUR_VIDEO)
    const dir = soleilMondeDeLHeure(s, { lat: LAT, lon: LON })
    const az = azimutVu(dir, LAT, LON)
    assert.ok(ecartAngulaire(az, s.azimuth) < 1e-6,
      `à ${h} h l'azimut doit valoir ${s.azimuth}°, la planète lit ${az}°`)
    azimuts.push(az)
  }
  // et il TOURNE : le soleil se lève à l'est et se couche à l'ouest.
  assert.equal(new Set(azimuts.map((v) => v.toFixed(3))).size, 5)
  assert.ok(azimuts[0] < azimuts[4], `l'azimut doit croître du matin au soir, lu ${azimuts}`)
})

test('① ⛔ LA MAUVAISE MONNAIE RENDRAIT LE PLEIN JOUR À 3 h DU MATIN', () => {
  const s = lightingFor(H_VIDEO, LAT, LON, JOUR_VIDEO)
  // ce que `params.sunElevation` porte, c'est `s.elevation` — la LAMPE.
  const faux = directionSoleilLocale(s.azimuth, s.elevation, LAT, LON)
  assert.ok(elevationVue(faux, LAT, LON) > 30,
    'témoin : la lampe de nuit pointe bien AU-DESSUS de l horizon — c est le piège')
  // et la fonction de production ne doit PAS s'y laisser prendre.
  const bon = soleilMondeDeLHeure(s, { lat: LAT, lon: LON })
  assert.ok(elevationVue(bon, LAT, LON) < 0,
    'soleilMondeDeLHeure lit sunElevation, pas elevation')
})

test('① le lieu compte : deux points de la planète ne voient pas le même soleil', () => {
  const s = lightingFor(12, LAT, LON, JOUR_VIDEO)
  const ici = soleilMondeDeLHeure(s, { lat: LAT, lon: LON })
  // l'antipode du lieu, au MÊME instant : le soleil doit y être sous l'horizon.
  assert.ok(elevationVue(ici, -LAT, LON + 180) < 0,
    'à midi ici, il fait nuit à l antipode — sinon la direction n est pas une direction de MONDE')
})

test('① sans lieu ni cycle, elle rend null plutôt qu un vecteur inventé', () => {
  const s = lightingFor(12, LAT, LON, JOUR_VIDEO)
  assert.equal(soleilMondeDeLHeure(null, { lat: LAT, lon: LON }), null)
  assert.equal(soleilMondeDeLHeure(s, { lat: NaN, lon: LON }), null)
  assert.equal(soleilMondeDeLHeure(s, { lat: LAT, lon: undefined }), null)
  assert.equal(soleilMondeDeLHeure({ azimuth: 10 }, { lat: LAT, lon: LON }), null)
  assert.equal(soleilMondeDeLHeure(s, null), null)
})

// ══════════ ② LE DRAPEAU — LEVÉ ET BAISSÉ, ET SES DEUX BRANCHES ════════════

test('② le drapeau existe, il est LEVÉ par défaut, et il a son échappatoire', () => {
  // ⚠️ **LE DÉFAUT A BASCULÉ LE 2026-08-30, ET C'EST UNE COMMANDE D'ADRIEN** :
  // « installe le mode sphère comme le mode par défaut, pour qu'on commence
  // directement en mode sphère au chargement ». La garantie que toute la
  // campagne a tenue — « drapeau baissé, la production est rigoureusement
  // inchangée » — est donc ABROGÉE : la production DOIT changer.
  assert.equal(FLAGS.soleilHeureMonde, true, 'le mode sphère est le démarrage : la planète lit l’heure du monde')
  assert.equal(typeof soleilHeureMondeActif, 'function')
  // sous node il n'y a pas de `location` : la fonction doit rendre le drapeau nu.
  assert.equal(soleilHeureMondeActif(), true)
})

test('② ⛔ LES DEUX BRANCHES DE L ÉCHAPPATOIRE, EXERCÉES CONTRE LE DÉFAUT CONTRAIRE', () => {
  // ⛔ **UNE MUTATION A SURVÉCU AU TOUR 1** : `?soleil=camera` LEVAIT le drapeau
  // et `?soleil=heure` le baissait, tests au vert — parce que ni l'une ni
  // l'autre branche n'était jamais parcourue sous node. C'est pourtant le levier
  // par lequel Adrien est censé essayer le drapeau.
  //
  // ⛔ **ET LE BASCULEMENT DU DÉFAUT A DÉPLACÉ CE TROU, IL NE L'A PAS FERMÉ.**
  // Une branche d'échappatoire NE MORD QUE CONTRE LE DÉFAUT CONTRAIRE : avec
  // `FLAGS.soleilHeureMonde === true`, supprimer `if (… 'heure') return true`
  // ne change RIEN — la valeur retombe sur un défaut vrai de toute façon, et le
  // test reste vert pour la mauvaise raison. La version d'avant comparait de
  // surcroît à `FLAGS.soleilHeureMonde` lui-même, ce qui ne peut pas rougir.
  // Chaque branche est donc exercée ici AVEC LE DRAPEAU FORCÉ À L'INVERSE.
  const defaut = FLAGS.soleilHeureMonde
  try {
    // ① défaut ÉTEINT — c'est la branche qui ALLUME qui doit mordre.
    FLAGS.soleilHeureMonde = false
    assert.equal(soleilHeureMondeActif('?soleil=heure'), true, '`?soleil=heure` doit ALLUMER un défaut éteint')
    assert.equal(soleilHeureMondeActif('?soleil=1'), true, '`?soleil=1` aussi')
    assert.equal(soleilHeureMondeActif('?soleil=camera'), false)
    assert.equal(soleilHeureMondeActif('?soleil=0'), false)
    // une valeur inconnue, ou une autre clé, retombent sur le drapeau nu.
    assert.equal(soleilHeureMondeActif('?soleil=bidon'), false)
    assert.equal(soleilHeureMondeActif('?autre=heure'), false)
    assert.equal(soleilHeureMondeActif(''), false)

    // ② défaut ALLUMÉ — c'est la branche qui COUPE qui doit mordre, et c'est
    //    celle-là qui compte aujourd'hui : c'est le levier par lequel Adrien
    //    revient à la production d'avant depuis l'adresse.
    FLAGS.soleilHeureMonde = true
    assert.equal(soleilHeureMondeActif('?soleil=camera'), false, '`?soleil=camera` doit COUPER un défaut allumé')
    assert.equal(soleilHeureMondeActif('?soleil=0'), false, '`?soleil=0` aussi')
    assert.equal(soleilHeureMondeActif('?soleil=heure'), true)
    assert.equal(soleilHeureMondeActif('?soleil=1'), true)
    assert.equal(soleilHeureMondeActif('?soleil=bidon'), true)
    assert.equal(soleilHeureMondeActif('?autre=heure'), true)
    assert.equal(soleilHeureMondeActif(''), true)
  } finally {
    FLAGS.soleilHeureMonde = defaut
  }
})

test('② QUI POSE LE SOLEIL — la polarité est du code, plus une négation dans main.js', () => {
  // ⛔ **INVERSER LES DEUX `!` DE `main.js` A SURVÉCU À 4 204 TESTS** : le test
  // d'avant ne lisait que le MOT `soleilHeureMonde`, qu'une inversion laisse en
  // place. La polarité vit maintenant ici, et elle est exécutée.
  assert.equal(poseurDuSoleilDuGlobe(false), 'camera', 'drapeau baissé = la production, inchangée')
  assert.equal(poseurDuSoleilDuGlobe(true), 'heure')
  assert.notEqual(poseurDuSoleilDuGlobe(true), poseurDuSoleilDuGlobe(false))
})

// ══════════ ③ LE PLANCHER DE NUIT — LE VRAI PRIX DU CORRECTIF ══════════════

test('③ ⛔ DRAPEAU BAISSÉ, LE PLANCHER DE NUIT EST L IDENTITÉ', () => {
  // les trois valeurs neutres, celles qui rendent les shaders d'avant AU BIT
  // PRÈS : `uNuitCarte = 0,10` ⇒ `0,10 + (1 − 0,10)·day` ≡ `0,10 + 0,90·day`
  // (en float32, `1 − 0,1f == 0,9f`) ; `froid = 0` ⇒ `uNuitFond == uShadowColor` ;
  // `coquille = 1` ⇒ le gain de la coquille de nuages vaut exactement 1.
  assert.deepEqual(plancherNuitMonde(false), { carte: 0.10, froid: 0, coquille: 1 })
  assert.deepEqual(plancherNuitMonde(false), NUIT_PRODUCTION)
})

test('③ ⛔ DRAPEAU LEVÉ, LA FACE NUIT RESTE UNE CARTE — elle ne s efface pas', () => {
  // Mesuré à 10 h (l'heure PAR DÉFAUT du produit), six poses d'orbite : à
  // l'antisolaire la planète devenait une sphère unie. La luminance MONTAIT
  // pendant que la carte disparaissait — l'instrument qui le voit est la chroma.
  const n = plancherNuitMonde(true)
  assert.equal(n, NUIT_LISIBLE)
  assert.ok(n.carte >= 0.45 && n.carte <= 0.60, `plancher de carte hors fourchette : ${n.carte}`)
  assert.ok(n.carte > NUIT_PRODUCTION.carte * 4, 'il doit être RELEVÉ, pas ajusté')
  // refroidir plutôt qu'effacer : le fond de nuit s'écarte du fond du décor.
  assert.ok(n.froid > 0 && n.froid <= 1, `refroidissement hors bornes : ${n.froid}`)
  // et la coquille de nuages DOIT s'assombrir avec la planète — elle n'avait
  // aucun terminateur (plancher 0,74 sans `day`) et brillait au-dessus d'une
  // planète éteinte.
  assert.ok(n.coquille < 1 && n.coquille > 0, `gain de coquille hors bornes : ${n.coquille}`)
})

test('③ les TROIS surfaces de la planète partagent le même plancher — pas seulement les tuiles', () => {
  // tuiles, parois du crop et calottes polaires portaient la MÊME ligne
  // `mix(uShadowColor, …, 0.10 + 0.90 * day)`, recopiée trois fois. Un plancher
  // relevé sur une seule aurait mis une couture au pôle.
  assert.equal(SRC_GLOBE.match(/0\.10 \+ 0\.90 \* day/g), null,
    'il reste un plancher de nuit EN DUR dans globe.js')
  const mix = SRC_GLOBE.match(/mix\(uNuitFond, \w+, uNuitCarte \+ \(1\.0 - uNuitCarte\) \* day\)/g)
  assert.equal(mix?.length, 3, 'les trois surfaces : tuiles, parois, calottes')
  // et la coquille de nuages a enfin un terminateur.
  assert.match(SRC_NUAGES, /col \*= uNuitCoquille \+ \(1\.0 - uNuitCoquille\) \* day/)
  assert.match(SRC_NUAGES, /float day = smoothstep\(-0\.22, 0\.16,/)
})

test('③ main.js pousse le plancher au globe, et il le prend de la loi', () => {
  const poses = lignesDeCode(/globe\.setNuitPlanete\(/)
  assert.equal(poses.length, 1, 'une seule écriture du plancher')
  assert.equal(poses[0].l.trim(), 'globe.setNuitPlanete(plancherNuitMonde(soleilHeureMonde))',
    'le plancher doit venir de la loi, pas d une constante recopiée')
})

// ══════════ ④ LE BRANCHEMENT — DÉCOUPÉ DE `main.js` ET EXÉCUTÉ ═════════════

test('④ main.js importe la loi au lieu d en écrire une seconde', () => {
  assert.match(SRC_MAIN,
    /import \{ soleilMondeDeLHeure, poseurDuSoleilDuGlobe, plancherNuitMonde \} from '\.\/monde\/soleil-monde\.js'/)
})

test('④ ⚡ L AIGUILLEUR EST EXÉCUTÉ — baissé il rend le soleil d avant, levé celui de l heure', () => {
  // ⛔ **« `soleilDuGlobe()` rend toujours `sun.position` » A SURVÉCU À 4 204
  // TESTS.** Le correctif était ENTIÈREMENT neutralisable : le test d'avant
  // vérifiait que le TEXTE `globe.setSunDir(soleilDuGlobe())` était là, jamais
  // qu'il faisait quelque chose. Ici l'aiguilleur est découpé et APPELÉ.
  const src = sourceDeFonction('soleilDuGlobe')
  const CAMERA = { marque: 'sun.position' } // le vecteur d'AVANT, reconnaissable
  const fabrique = (drapeau, monde) => {
    const _soleilMonde = { fromArray(a) { this.recu = a; return this } }
    const f = new Function(
      'poseurDuSoleilDuGlobe', 'soleilHeureMonde', 'soleilMonde', 'sun', '_soleilMonde',
      `${src}\nreturn soleilDuGlobe`,
    )(poseurDuSoleilDuGlobe, drapeau, monde, { position: CAMERA }, _soleilMonde)
    return { f, _soleilMonde }
  }

  // drapeau BAISSÉ : la production, inchangée — le soleil d'avant, et rien d'autre.
  const bas = fabrique(false, [0, 0, 1])
  assert.equal(bas.f(), CAMERA, 'drapeau baissé, l aiguilleur doit rendre sun.position')
  assert.equal(bas._soleilMonde.recu, undefined, 'et il ne doit RIEN poser d autre')

  // drapeau LEVÉ : le soleil de l'heure, et c'est bien CE vecteur-là.
  const haut = fabrique(true, [0.1, 0.2, 0.3])
  const v = haut.f()
  assert.notEqual(v, CAMERA, 'drapeau levé, l aiguilleur ne doit PLUS rendre sun.position')
  assert.deepEqual(haut._soleilMonde.recu, [0.1, 0.2, 0.3])

  // et le REPLI : sans direction calculée (démarrage), on retombe sur l'avant.
  assert.equal(fabrique(true, null).f(), CAMERA, 'repli au démarrage')
})

test('④ ⚡ LES DEUX GARDES DE LA BOUCLE D IMAGE SONT ÉVALUÉES, PAS LUES', () => {
  // ⛔ **INVERSER LES DEUX GARDES A SURVÉCU À 4 204 TESTS**, et c'est la plus
  // grave des sept survivantes — elle touche la PRODUCTION. Le test d'avant
  // exigeait le MOT `soleilHeureMonde` dans les douze lignes qui précèdent :
  // une inversion le laisse en place. Drapeau baissé, la boucle d'image ne
  // reposait alors plus rien du tout. La garantie « production rigoureusement
  // inchangée » n'était tenue par AUCUN test.
  const lignes = SRC_MAIN.split('\n')
  const poses = lignesDeCode(/globe\.setSunDir\(_orbSun\)/)
  assert.equal(poses.length, 2, 'toujours les deux poses orbitales, ni plus ni moins')

  for (const { i } of poses) {
    // le garde est au-dessus, dans les douze lignes qui précèdent
    let cond = null
    for (let k = i - 1; k >= Math.max(0, i - 12); k--) {
      const m = /^\s*if \((.+)\) \{$/.exec(lignes[k])
      if (m) { cond = m[1]; break }
    }
    assert.ok(cond, `la pose de la ligne ${i + 1} n est gardée par aucun \`if\``)
    const juge = (drapeau) => new Function(
      'poseurDuSoleilDuGlobe', 'soleilHeureMonde', `return (${cond})`,
    )(poseurDuSoleilDuGlobe, drapeau)
    // drapeau BAISSÉ : la caméra repose le soleil, exactement comme avant R7.
    assert.equal(juge(false), true, `ligne ${i + 1} : drapeau baissé, la pose caméra DOIT courir`)
    // drapeau LEVÉ : elle se tait, sinon elle écraserait le soleil de l'heure.
    assert.equal(juge(true), false, `ligne ${i + 1} : drapeau levé, la pose caméra doit se taire`)
  }
})

test('④ ⚡ LA MONNAIE EST CHOISIE DANS `applyTimeOfDay`, ET LA LIGNE EST EXÉCUTÉE', () => {
  // ⛔ **`skyState = { ...s, sunElevation: s.elevation }` A SURVÉCU.** Le tour 1
  // lisait `skyState` au moment de POSER le soleil : une ligne à 70 lignes de là
  // suffisait à rendre le plein jour à 3 h du matin, 4 204 tests au vert. Le
  // piège de la monnaie était nommé, il n'était pas fermé. Il l'est par
  // construction — la direction se calcule sur le `s` FRAIS que `lightingFor`
  // vient de rendre — et la ligne qui le fait est ici DÉCOUPÉE ET APPELÉE.
  // ⚡ ET LA PREUVE QUE LE PIÈGE EST FERMÉ **PAR CONSTRUCTION** : plus une seule
  // lecture de `skyState.sunElevation` dans tout `main.js`. La mutation du tour 1
  // (`skyState = { ...s, sunElevation: s.elevation }`) est désormais INERTE pour
  // la planète — ce n'est plus un test qui la rattrape, c'est le câblage.
  assert.equal(/skyState[?.]*\.sunElevation/.test(SRC_MAIN), false,
    'plus personne ne doit lire l élévation astronomique dans skyState')
  assert.equal(/skyState/.test(sourceDeFonction('soleilDuGlobe')), false,
    'l aiguilleur ne lit plus skyState du tout')

  const corps = sourceDeFonction('applyTimeOfDay')
  const lignes = corps.split('\n').filter((l) => /soleilMondeDeLHeure\(/.test(l) && !/^\s*\/\//.test(l))
  assert.equal(lignes.length, 1, 'une seule écriture de la direction, dans applyTimeOfDay')
  const ligne = lignes[0]
  // elle doit courir AVANT placeSun(), sinon la pose lit la direction précédente
  assert.ok(corps.indexOf(ligne) < corps.indexOf('placeSun()'), 'la direction se calcule avant placeSun()')

  const lancer = (s, params, loi) => new Function(
    's', 'params', 'soleilMondeDeLHeure', `let soleilMonde = null\n${ligne}\nreturn soleilMonde`,
  )(s, params, loi)

  // ① ce que la ligne PASSE : l'objet `s` lui-même, et le lieu du bloc.
  const recu = []
  const s = lightingFor(H_VIDEO, LAT, LON, JOUR_VIDEO)
  const params = { demLat: LAT, demLon: LON, sunElevation: s.elevation, timeOfDay: H_VIDEO }
  lancer(s, params, (cycle, lieu) => { recu.push({ cycle, lieu }); return 'JETON' })
  assert.equal(recu.length, 1)
  assert.equal(recu[0].cycle, s, 'le cycle FRAIS lui-même — pas une copie, pas skyState')
  assert.deepEqual(recu[0].lieu, { lat: LAT, lon: LON }, 'lat et lon, dans cet ordre')

  // ② et ce que la ligne REND, avec la vraie loi : la nuit d'Adrien.
  const dir = lancer(s, params, soleilMondeDeLHeure)
  assert.ok(Array.isArray(dir), 'une direction, pas un jeton')
  const el = elevationVue(dir, LAT, LON)
  assert.ok(Math.abs(el - s.sunElevation) < 1e-9,
    `la planète doit voir ${s.sunElevation}° à 03h22, la ligne livrée lui donne ${el}°`)
  assert.ok(el < -20, `⛔ PLEIN JOUR À 3 h DU MATIN : la ligne livrée rend ${el}°`)
})

test('④ ⛔ `placeSun` POUSSE LE SOLEIL SANS CONDITION — aucune garde ne s y glisse', () => {
  // ⛔ **« `placeSun` ne pousse plus rien sous le drapeau » A SURVÉCU** — le test
  // d'avant cherchait la sous-chaîne `globe.setSunDir(soleilDuGlobe())`, qu'un
  // `if` ajouté devant laisse intacte. On compare donc la LIGNE ENTIÈRE.
  const corps = sourceDeFonction('placeSun')
  const poses = lignesDeCode(/setSunDir\(soleilDuGlobe\(\)\)/, corps)
  assert.equal(poses.length, 1, 'une seule pose du soleil du globe dans placeSun')
  const code = poses[0].l.split('//')[0].trim()
  assert.equal(code, 'if (globe) globe.setSunDir(soleilDuGlobe())',
    'la seule condition tolérée est l EXISTENCE du globe')
  assert.equal(/soleilHeureMonde/.test(corps), false,
    'placeSun ne connaît pas le drapeau : c est l aiguilleur qui décide')
})
