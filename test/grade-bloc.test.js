// LE GRADE DU BLOC — Tâche GRA, « le même bloc doit avoir la même couleur,
// quel que soit le zoom » (`.superpowers/sdd/2026-08-22-globe-studio/brief-GRA.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-rampe.test.js` : la LOI vit dans un module PUR
// (`src/monde/rampe-crop.js`) et se vérifie sous node ; l'ÉCRAN, lui, est
// mesuré par `.banc/GRA/`.
//
// ⛔ **ET LA PREMIÈRE CHOSE QUE CE FICHIER FAIT EST DE TUER LE DÉFAUT, PAS DE
// DÉCRIRE LA CORRECTION.** ①a rejoue les uniformes VIVANTS relevés le
// 2026-09-04 (`.banc/GRA/avant/chemins.json`) et échoue contre le dépôt : à La
// Réunion, la même vue z13 atteinte depuis z11 rendait un pivot de **96,6 m**
// au lieu de 1 517,9. Un test qui ne passerait qu'après la correction sans
// échouer avant ne prouverait rien.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que l'écran soit invariant au pixel. Le
// §« ce que j'ai cru puis réfuté » du rapport dit pourquoi — nuages, houle et
// ordre d'arrivée des tuiles rendent **81 à 84 %** de pixels différents entre
// deux sessions dont la loi est identique au dixième de mètre. Le juge
// déterministe est l'INDICE DE RAMPE, et c'est lui qu'on exerce ici.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  mesurerRelief,
  echelleRampe,
  histogrammeDesHauteurs,
  gradeCrop,
  gradeBlocEffectif,
  plancherRampeDuCrop,
  RAMPE_MONDE,
} from '../src/monde/rampe-crop.js'
import { repereCrop, latLonDeLocal, localCrop } from '../src/monde/crop-sphere.js'
import { plancherPivot, rampeT as rampeTSocle } from '../src/monde/naturel-crop.js'
import { gradeForDem, elevationHistogram } from '../src/relief-grade.js'

const REPERE = repereCrop({ centre: { lat: -20.9, lon: 55.5 } }) // La Réunion
const FORME = { coin: 2.24 / 28, expo: 4.4 }

// la ligne du nuanceur, plancher de pivot compris — la même qu'au §⑧f de
// `crop-rampe.test.js`, et elle N'EST PAS RECOPIÉE : elle appelle les deux
// fonctions du module.
const pivotRenduM = (reliefBas, landMax, plancher, pivotU) => {
  const amp = Math.max(landMax - reliefBas, plancher)
  return reliefBas + Math.max(pivotU, plancherPivot((0 - reliefBas) / amp)) * amp
}

// ══════════ ① CE QUE LE DÉFAUT FAISAIT, REJOUÉ SUR LES CHIFFRES VIVANTS ═════

test('①a LE DÉFAUT : la même vue z13 portait trois lois selon le chemin — chiffres relevés', () => {
  // ⚡ **RELEVÉ DANS L'APPLICATION VIVANTE**, 2026-09-04,
  // `.banc/GRA/avant/chemins.json` : La Réunion, arrivée z13 depuis z13 / z11 /
  // z9. Le bloc d'arrivée est LE MÊME (`_crop.demi` = 0,000183 dans les trois
  // cas, relevé) ; seuls le domaine gelé et le grade hérité du socle diffèrent.
  const chemins = [
    { depuis: 13, reliefBas: 533.7, landMax: 3057.2, plancher: 0.0087, pivotU: 0.39 },
    { depuis: 11, reliefBas: -1826.3, landMax: 3005.5, plancher: 0.0349, pivotU: 0.4 },
    { depuis: 9, reliefBas: -4928.1, landMax: 2848.8, plancher: 0.1398, pivotU: 0.65 },
  ]
  const rendus = chemins.map((c) => pivotRenduM(c.reliefBas, c.landMax, c.plancher, c.pivotU))
  // ⛔ **L'ÉCART EST DE PLUS DE 1 300 m SUR UN BLOC IDENTIQUE.** C'est la tâche.
  const etendue = Math.max(...rendus) - Math.min(...rendus)
  assert.ok(etendue > 1300, `l’écart relevé valait ${etendue.toFixed(0)} m`)
  // et le premier chemin est bien la référence d'Adrien
  assert.ok(Math.abs(rendus[0] - 1517.9) < 2, `le pivot z13 direct vaut ${rendus[0]}`)
})

// ══════════ ② L'HISTOGRAMME — LA BORNE `vus` N'EST PAS DÉCORATIVE ═══════════

test('②a `histogrammeDesHauteurs` ne compte QUE les `vus` premiers — sinon les zéros du tampon mentent', () => {
  // un tampon surdimensionné, comme celui de `mesurerRelief` : 4 hauteurs
  // écrites sur 16 cases. Les 12 zéros restants sont des points HORS
  // superellipse, qui n'existent pas.
  const tampon = new Float32Array(16)
  tampon.set([1000, 1000, 2000, 2000])
  const bon = histogrammeDesHauteurs(tampon, 4, 0, 2000, 4)
  assert.equal(bon.reduce((a, b) => a + b, 0), 4, 'seuls les 4 points vus doivent compter')
  // ⛔ **ET LA FAUTE EST MESURABLE** : biné en entier, le tampon rend 12 faux
  // points au niveau de la mer, soit 75 % de l'histogramme.
  const faux = histogrammeDesHauteurs(tampon, tampon.length, 0, 2000, 4)
  assert.equal(faux[0], 12 + 0, 'la case du bas devrait porter les 12 zéros fantômes')
  assert.ok(faux[0] / 16 > 0.7, 'le test ne mesure pas ce qu’il croit')
})

test('②b `mesurerRelief` rend un histogramme dont la somme EST `vus`, et une moyenne des vus SEULS', () => {
  // ⚠️ **UN RELIEF NON TRIVIAL** : une pente, pour que la médiane ait un sens.
  const g = mesurerRelief({
    repere: REPERE,
    forme: FORME,
    hauteur: (lat, lon) => 100 + 900 * (localCrop(lat, lon, REPERE).u + 1) / 2,
    pas: 64,
  })
  assert.equal(g.refus, null)
  assert.ok(g.histogramme && g.histogramme.length === 1024)
  const somme = g.histogramme.reduce((a, b) => a + b, 0)
  assert.equal(somme, g.vus, `l’histogramme porte ${somme} points pour ${g.vus} vus`)
  // ⚠️ **ET LE COIN PAR DÉFAUT NE COUPE PRESQUE RIEN — MESURÉ, PAS SUPPOSÉ.**
  // J'avais écrit « jusqu'à 21 % de faux points » dans la docstring de
  // `histogrammeDesHauteurs` : c'est vrai d'un coin PLEIN (1 − π/4), pas du
  // réglage du socle (`coin = 2,24/28`, `expo = 4,4`), qui écarte **4 points sur
  // 16 384** au pas 128. La borne `vus` reste obligatoire (②a la démontre sur un
  // tampon), mais son enjeu chiffré est le coin d'Adrien poussé à fond, pas le
  // coin par défaut. Le chiffre est corrigé dans la docstring.
  assert.ok(g.vus <= 64 * 64 && g.vus > 0.97 * 64 * 64, `vus = ${g.vus} sur ${64 * 64}`)
  const rond = mesurerRelief({
    repere: REPERE, forme: { coin: 1, expo: 2 }, pas: 64,
    hauteur: (lat, lon) => 100 + 900 * (localCrop(lat, lon, REPERE).u + 1) / 2,
  })
  const partCoupee = 1 - rond.vus / (64 * 64)
  assert.ok(partCoupee > 0.2 && partCoupee < 0.23, `un coin plein coupe ${(partCoupee * 100).toFixed(1)} %`)
  // la moyenne tombe dans la tranche, et pas à zéro (le piège du tampon)
  assert.ok(g.moyenneM > g.minM && g.moyenneM < g.maxM, `moyenne = ${g.moyenneM}`)
  assert.ok(g.moyenneM > 400, 'une moyenne tirée vers zéro trahit des points fantômes')
})

// ══════════ ③ `gradeCrop` — EN MÈTRES, ET C'EST LA MÊME LOI QUE LE CURSEUR ══

test('③a `gradeCrop` rend le MÊME grade que `gradeForDem` sur la même donnée, remonté en mètres', () => {
  // ⚠️ **L'ORACLE EST LA FONCTION DU DÉPÔT**, celle que `applyAutoShade`
  // appelle : si les deux divergeaient, le curseur d'Adrien et le bloc
  // n'obéiraient plus à la même règle.
  const mesure = mesurerRelief({
    repere: REPERE,
    forme: FORME,
    hauteur: (lat, lon) => 100 + 900 * (localCrop(lat, lon, REPERE).u + 1) / 2,
    pas: 64,
  })
  const g = gradeCrop(mesure, { extentM: 13691 })
  const oracle = gradeForDem({
    minM: mesure.minM, maxM: mesure.maxM, meanM: mesure.moyenneM,
    histogram: mesure.histogramme, extentM: 13691,
  })
  const amp = mesure.maxM - mesure.minM
  assert.ok(Math.abs(g.pivotM - (mesure.minM + oracle.heightPivot * amp)) < 1e-9)
  assert.ok(Math.abs(g.fenetreM - amp / oracle.heightContrast) < 1e-9)
  // et le pivot tombe DANS le relief, pas à côté
  assert.ok(g.pivotM > mesure.minM && g.pivotM < mesure.maxM, `pivot = ${g.pivotM} m`)
})

test('③b `gradeCrop` REFUSE plutôt que de rendre un grade neutre — mesure refusée, pas d’histogramme', () => {
  assert.equal(gradeCrop(null), null)
  assert.equal(gradeCrop({ refus: 'couverture', minM: 0, maxM: 0, histogramme: null }), null)
  // ⛔ un relief RIGOUREUSEMENT plat n'a pas d'amplitude : `null`, pas 0/0.
  const plat = mesurerRelief({ repere: REPERE, forme: FORME, hauteur: () => 42, pas: 32 })
  assert.equal(gradeCrop(plat), null, 'un crop plat doit refuser, pas rendre un NaN')
})

test('③c ⛔ LE GRADE DU BLOC NE DÉPEND PAS DU DOMAINE — c’est ce qui interdit de rejouer le défaut', () => {
  // la MÊME mesure, gradée deux fois : le résultat est en mètres, donc il ne
  // peut pas hériter d'un domaine. C'est la propriété que `gradeBlocEffectif`
  // exploite pour rester juste sous un domaine qui GLISSE par image.
  const mesure = mesurerRelief({
    repere: REPERE, forme: FORME, pas: 48,
    hauteur: (lat, lon) => 100 + 900 * (localCrop(lat, lon, REPERE).u + 1) / 2,
  })
  const a = gradeCrop(mesure, { extentM: 13691 })
  const b = gradeCrop(mesure, { extentM: 219049 }) // l'emprise de z9
  // ⚠️ `extentM` ne pilote que `slopeTint` / `mapTint`, que ce module n'utilise
  // pas : les deux grades sont donc ÉGAUX, et c'est délibéré.
  assert.equal(a.pivotM, b.pivotM)
  assert.equal(a.fenetreM, b.fenetreM)
})

// ══════════ ④ `gradeBlocEffectif` — LE CURSEUR D'ADRIEN, INTACT ═════════════

const SOCLE = { socleBasM: 529, socleAmpM: 2539 }
const DOMAINE = { reliefBasM: 533.7, ampGlobeM: 3057.2 - 533.7 }

test('④a SANS GRADE DE BLOC, c’est le chemin du dépôt AU BIT PRÈS', () => {
  // ⛔ **LA GARDE DE L'AFFICHE** : `poserRampe({ echelle })` — les bancs, les
  // tests, le réglage manuel — ne mesure pas, donc ne grade pas. Le globe de ces
  // appelants doit être celui d'avant, sans un bit d'écart.
  const r = gradeBlocEffectif({
    gradeBloc: null, pivotSocle: 0.39, contrasteSocle: 2.4,
    pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...DOMAINE,
  })
  assert.equal(r.heightPivot, 0.39)
  assert.equal(r.heightContrast, 2.4)
  // et un domaine absurde ne doit pas produire un NaN, mais le même repli
  const s = gradeBlocEffectif({
    gradeBloc: { pivotM: 1500, fenetreM: 1000 }, pivotSocle: 0.39, contrasteSocle: 2.4,
    ...SOCLE, reliefBasM: 0, ampGlobeM: 0,
  })
  assert.equal(s.heightPivot, 0.39)
})

test('④b CURSEUR AU REPOS : le bloc prend son PROPRE grade, et le décalage vaut zéro', () => {
  const bloc = { pivotM: 1517.9, fenetreM: 1051.5 }
  const r = gradeBlocEffectif({
    gradeBloc: bloc, pivotSocle: 0.39, contrasteSocle: 2.4,
    pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...DOMAINE,
  })
  const rendu = DOMAINE.reliefBasM + r.heightPivot * DOMAINE.ampGlobeM
  assert.ok(Math.abs(rendu - bloc.pivotM) < 1e-6, `le pivot rendu vaut ${rendu} m`)
  assert.ok(Math.abs(DOMAINE.ampGlobeM / r.heightContrast - bloc.fenetreM) < 1e-6)
})

test('④c ⛔ L’INVARIANCE : trois domaines GELÉS différents, un seul pivot en mètres', () => {
  // ⚡ **LES TROIS DOMAINES SONT CEUX QUI ONT ÉTÉ RELEVÉS**, La Réunion,
  // `.banc/GRA/apres/chemins.json` — la même vue z13 atteinte par trois chemins,
  // avec l'ancre d'échelle figée sur le zoom de départ.
  const bloc = { pivotM: 1517.9, fenetreM: 1051.5 }
  const domaines = [
    { reliefBasM: 533.7, ampGlobeM: 3057.2 - 533.7 },
    { reliefBasM: -1826.3, ampGlobeM: 3005.5 + 1826.3 },
    { reliefBasM: -4928.1, ampGlobeM: 2848.8 + 4928.1 },
  ]
  const rendus = domaines.map((d) => {
    const r = gradeBlocEffectif({
      gradeBloc: bloc, pivotSocle: 0.39, contrasteSocle: 2.4,
      pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...d,
    })
    return d.reliefBasM + r.heightPivot * d.ampGlobeM
  })
  for (const p of rendus) assert.ok(Math.abs(p - bloc.pivotM) < 1e-6, `pivot rendu ${p} m`)
  // ⛔ **ET LE BANC EST DISCRIMINANT** : sur les mêmes domaines, la loi du dépôt
  // (poser `pivotSocle` tel quel) rend trois pivots à 1 300 m l'un de l'autre.
  const depot = domaines.map((d) => d.reliefBasM + 0.39 * d.ampGlobeM)
  assert.ok(Math.max(...depot) - Math.min(...depot) > 1300, 'le banc ne distingue rien')
})

test('④d LE CURSEUR GARDE SON SENS : le bloc se déplace des MÊMES mètres que le socle', () => {
  const bloc = { pivotM: 1517.9, fenetreM: 1051.5 }
  const geste = 0.2 // Adrien pousse le pivot de 0,39 à 0,59
  const r = gradeBlocEffectif({
    gradeBloc: bloc, pivotSocle: 0.39 + geste, contrasteSocle: 2.4,
    pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...DOMAINE,
  })
  const rendu = DOMAINE.reliefBasM + r.heightPivot * DOMAINE.ampGlobeM
  // le socle, lui, monte de `geste × socleAmpM` mètres — le bloc doit suivre
  assert.ok(Math.abs(rendu - (bloc.pivotM + geste * SOCLE.socleAmpM)) < 1e-6,
    `le bloc a bougé de ${(rendu - bloc.pivotM).toFixed(1)} m pour ${(geste * SOCLE.socleAmpM).toFixed(1)} m au socle`)
})

test('④e LE CURSEUR EST MONOTONE, ET SA COURBE NE S’INVERSE JAMAIS', () => {
  // ⛔ **C'EST L'ÉCHEC QUE LE BRIEF NOMME** : « si le curseur ne produit plus le
  // même effet qu'avant, c'est un échec ». Une composition mal choisie (une
  // DIFFÉRENCE de contraste au lieu d'un RAPPORT) pouvait rendre un contraste
  // négatif, c'est-à-dire une rampe à l'envers.
  const bloc = { pivotM: 1517.9, fenetreM: 1051.5 }
  let precedent = -Infinity
  for (let v = 0; v <= 1.0001; v += 0.05) {
    const r = gradeBlocEffectif({
      gradeBloc: bloc, pivotSocle: v, contrasteSocle: 2.4,
      pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...DOMAINE,
    })
    const rendu = DOMAINE.reliefBasM + r.heightPivot * DOMAINE.ampGlobeM
    assert.ok(rendu > precedent, `la courbe du curseur redescend à ${v.toFixed(2)}`)
    precedent = rendu
    assert.ok(r.heightContrast > 0, `contraste NÉGATIF à ${v.toFixed(2)} — rampe inversée`)
  }
  // et le contraste, traîné sur toute sa plage, reste positif et monotone
  let precC = Infinity
  for (const c of [1.2, 2, 4, 8, 12]) {
    const r = gradeBlocEffectif({
      gradeBloc: bloc, pivotSocle: 0.39, contrasteSocle: c,
      pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE, ...DOMAINE,
    })
    assert.ok(r.heightContrast > 0)
    // un contraste de socle qui MONTE doit resserrer la fenêtre du bloc
    const fenetre = DOMAINE.ampGlobeM / r.heightContrast
    assert.ok(fenetre < precC, `la fenêtre ne se resserre pas à contraste ${c}`)
    precC = fenetre
  }
})

test('④f SANS AUTO (gabarit, `shadeAuto` éteint) la valeur du socle est une ALTITUDE ABSOLUE', () => {
  // « realistic » pose 5,1 / 0,53 en dur ; cela veut dire « le milieu de la
  // rampe à 53 % du relief chargé », donc une altitude en mètres qu'on
  // transpose. La conversion est écrite au §⑨, avec son facteur.
  const r = gradeBlocEffectif({
    gradeBloc: { pivotM: 1517.9, fenetreM: 1051.5 },
    pivotSocle: 0.53, contrasteSocle: 5.1,
    pivotAutoSocle: null, contrasteAutoSocle: null, ...SOCLE, ...DOMAINE,
  })
  const attenduM = SOCLE.socleBasM + 0.53 * SOCLE.socleAmpM
  const rendu = DOMAINE.reliefBasM + r.heightPivot * DOMAINE.ampGlobeM
  assert.ok(Math.abs(rendu - attenduM) < 1e-6, `${rendu} m au lieu de ${attenduM} m`)
  // et la fenêtre suit le facteur `ampGlobeM / socleAmpM`, écrit en toutes lettres
  const facteur = DOMAINE.ampGlobeM / SOCLE.socleAmpM
  assert.ok(Math.abs(r.heightContrast - 5.1 * facteur) < 1e-9, `facteur attendu ${facteur}`)
})

// ══════════ ⑤ LE NUANCEUR — L'INDICE, PAS LE NOM ═══════════════════════════

test('⑤a APRÈS la correction, l’indice de rampe est IDENTIQUE d’un chemin à l’autre', () => {
  // ⚡ **LA MÊME LOI QUE `.banc/GRA/loi.json`**, rejouée ici sur les domaines
  // relevés : max |rampT_a(h) − rampT_b(h)| sur la tranche réelle du bloc.
  const bloc = { pivotM: 1517.9, fenetreM: 1051.5 }
  const domaines = [
    { reliefBasM: 533.7, ampGlobeM: 2523.5, plancher: 0.0087 },
    { reliefBasM: -1826.3, ampGlobeM: 4831.8, plancher: 0.0349 },
    { reliefBasM: -4928.1, ampGlobeM: 7776.9, plancher: 0.1398 },
  ]
  const lois = domaines.map((d) => {
    const r = gradeBlocEffectif({
      gradeBloc: bloc, pivotSocle: 0.39, contrasteSocle: 2.4,
      pivotAutoSocle: 0.39, contrasteAutoSocle: 2.4, ...SOCLE,
      reliefBasM: d.reliefBasM, ampGlobeM: d.ampGlobeM,
    })
    const pivot = Math.max(r.heightPivot, plancherPivot((0 - d.reliefBasM) / d.ampGlobeM))
    return (h) => rampeTSocle(Math.min(Math.max((h - d.reliefBasM) / d.ampGlobeM, 0), 1), pivot, r.heightContrast)
  })
  let pire = 0
  for (let h = 534; h <= 3057; h += 5) {
    for (let i = 1; i < lois.length; i++) pire = Math.max(pire, Math.abs(lois[0](h) - lois[i](h)))
  }
  // ⚠️ **LE SEUIL EST UN TEXEL DE LA TABLE**, 1/512 = 0,00195 — pas un epsilon
  // de confort : en deçà, deux indices lisent le même texel du LUT.
  assert.ok(pire < 1 / 512, `l’indice diverge de ${pire.toFixed(5)} entre deux chemins`)
})

test('⑤b LE NUANCEUR CONSOMME BIEN `hNormRelief`, ET LE PIVOT PASSE PAR LE PLANCHER', () => {
  // ⚠️ **EXTRAIT DU TEXTE DU NUANCEUR, PAS CHERCHÉ PAR UN NOM** — même
  // protocole que `crop-rampe.test.js` : c'est l'expression qui compte.
  const src = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  const i = src.indexOf('float rampT = natRampT(')
  assert.ok(i > 0, 'la ligne de rampe du crop a disparu du nuanceur')
  const ligne = src.slice(i, src.indexOf(';', i))
  assert.match(ligne, /natRampT\(\s*hNormRelief\s*,\s*pivot\s*,\s*uHeightContrast\s*\)/,
    'le nuanceur doit indexer sur hNormRelief, jamais sur hNorm')
  const j = src.lastIndexOf('float pivot = ', i)
  assert.ok(j > 0 && j < i)
  assert.match(src.slice(j, i), /max\(uHeightPivot,\s*natPlancherPivot\(/,
    'le plancher de pivot de R28 a sauté')
})

test('⑤c ⛔ `_majGradeBloc` EST LE SEUL ÉCRIVAIN DES DEUX UNIFORMES SOUS CROP', () => {
  // ⛔ **C'EST LE DÉFAUT QUE `_poserUniformesRampe` EXISTE POUR AVOIR SUPPRIMÉ**
  // (« il y en avait DEUX, plus un troisième »). Le grade dépend de deux sources
  // qui n'arrivent pas ensemble — le socle et le domaine — donc deux sites le
  // RAPPELLENT, mais un seul l'ÉCRIT.
  const src = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  const ecritures = src.match(/u\.uHeightPivot\.value\s*=/g) || []
  // les seules écritures légitimes : `_majGradeBloc` (sous crop), `_majRampeMonde`
  // et `retirerHabillage` (hors crop, régime du monde).
  assert.equal(ecritures.length, 3,
    `il y a ${ecritures.length} écritures de uHeightPivot — une de plus est un second écrivain`)
  assert.ok(src.includes('_majGradeBloc()'), '`_majGradeBloc` n’est plus rappelé')
  // et il est bien rappelé par les DEUX sites, dont le poseur d'uniformes de rampe
  const iPoseur = src.indexOf('_poserUniformesRampe(e, altitudeM = null)')
  const iFin = src.indexOf('_majGradeBloc() {', iPoseur)
  assert.ok(iPoseur > 0 && iFin > iPoseur)
  assert.ok(src.slice(iPoseur, iFin).includes('this._majGradeBloc()'),
    'le poseur d’uniformes de rampe ne rappelle pas le grade — le domaine bougerait sans lui')
})

test('⑤d LES QUATRE CHAMPS DU SOCLE SONT SURVEILLÉS — sinon la correction n’arrive qu’au hasard', () => {
  // ⚠️ **LA COURSE QUE LA TÂCHE K TER A NOMMÉE** : un champ absent de la liste
  // de veille n'est jamais comparé, donc jamais reposé.
  const src = readFileSync(new URL('../src/monde/branchement-crop.js', import.meta.url), 'utf8')
  for (const c of ['pivotAutoSocle', 'contrasteAutoSocle', 'socleBasM', 'socleAmpM']) {
    assert.match(src, new RegExp(`'${c}'`), `${c} n’est pas surveillé`)
  }
  // et `contexteCrop` les fournit vraiment
  const m = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  for (const c of ['pivotAutoSocle:', 'contrasteAutoSocle:', 'socleBasM:', 'socleAmpM:']) {
    assert.ok(m.includes(c), `contexteCrop ne passe pas ${c}`)
  }
})

// ══════════ ⑥ CE QUE LA CORRECTION NE PRÉTEND PAS FAIRE ════════════════════

test('⑥a LE BLOC N’EST PAS LE MÊME TERRAIN À TROIS ZOOMS — et c’est pourquoi le juge est le CHEMIN', () => {
  // ⛔ **LA PRÉMISSE DU BRIEF EST FAUSSE, ET C'EST MESURÉ.** R31 §⑥ écrit « le
  // crop est toujours z13, ses ancres n'ont pas bougé d'un octet ». Les ancres
  // n'avaient pas bougé — mais parce que `ancrerMesure` GÈLE un cran déjà
  // mesuré, pas parce que le bloc était le même. Relevé le 2026-09-04,
  // `globe._crop.demi` à La Réunion : **0,000183 / 0,000732 / 0,002930** à z13 /
  // z11 / z9 — l'emprise QUADRUPLE tous les deux crans, et le relief qu'elle
  // contient passe de [533,7 ; 3 057,2] m à [−4 913 ; 2 848,8].
  //
  // Ce test verrouille la conséquence : `repereCrop` dépend du zoom, donc
  // « le même bloc à trois zooms » n'existe pas, et l'invariance qu'on peut
  // exiger est l'indépendance au CHEMIN.
  const z13 = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 13 })
  const z11 = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 11 })
  const z9 = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 9 })
  assert.ok(z11.demi > z13.demi * 3.5, `z11 ${z11.demi} contre z13 ${z13.demi}`)
  assert.ok(z9.demi > z11.demi * 3.5, `z9 ${z9.demi} contre z11 ${z11.demi}`)
})

test('⑥b LE DOMAINE GELÉ RESTE UN DÉFAUT, ET IL EST CHIFFRÉ — il n’est PAS corrigé ici', () => {
  // ⚠️ **TROUVÉ EN PASSANT, LAISSÉ OUVERT EXPRÈS** (voir le rapport §⑦).
  // `[uReliefBas ; uLandMax]` reste ancré sur le premier cran d'altitude
  // visité : arrivée à z13 depuis z9, les Pays-Bas gardent [−31,1 ; 105,4] au
  // lieu de [−3,9 ; 20,0]. Le grade du bloc, lui, est juste — mais le PLANCHER
  // DE PIVOT de R28, qui se calcule sur ce domaine, mord alors 0,9 m trop haut.
  const bon = plancherPivot((0 - -3.9) / 23.9)
  const gele = plancherPivot((0 - -31.1) / 136.5)
  assert.ok(gele > bon, 'le plancher de pivot ne dépend pas du domaine — le constat serait faux')
  // le résidu mesuré : 0,371 d'indice de rampe, soit 190 texels — c'est écrit
  // pour qu'on puisse le contredire avec une mesure.
  assert.ok(gele - bon > 0.05, `le résidu vaut ${(gele - bon).toFixed(3)}`)
})
