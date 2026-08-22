// L'ÉCHELLE DE COULEUR CONTINUE — Tâche K bis du plan « LE STUDIO SUR LE GLOBE ».
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// ① LA LOI vit dans un module PUR (`src/monde/echelle-continue.js`) et se
//    vérifie sous node, point par point.
// ② LE REJEU : la loi est confrontée aux SIX RELEVÉS BRUTS de la descente
//    d'Adrien, recopiés du fichier que le harnais a laissé sur le disque.
// ③ ⚠️ **LE BRANCHEMENT**, et c'est la moitié que ce chantier oublie. Le §0 du
//    plan le dit : une tâche a vu **12 de ses 15 mutations survivre**, une autre
//    n'a atteint 36/36 qu'au troisième tour — « ses tests de loi pure étaient
//    bons, ses tests de BRANCHEMENT manquaient tous ». Le §③ exerce donc
//    `Globe.poserRampe`, `Globe.majEchelleRampe`, `Globe.poserCrop` et
//    `Globe.retirerRampe` sur un faux globe qui porte de VRAIS uniformes.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute le nuanceur, et que
// l'image obtenue soit celle qu'Adrien veut. Seul l'écran le dit — Étape 5 de la
// tâche, et son compte rendu.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  CHAMPS,
  cranReel,
  cranAncre,
  champsUtiles,
  creerEchelleContinue,
  ancrerMesure,
  oublierAncres,
  valeurChamp,
  majEchelle,
  lireEchelle,
} from '../src/monde/echelle-continue.js'
import { RAMPE_MONDE, echelleRampe } from '../src/monde/rampe-crop.js'
import { repereCrop } from '../src/monde/crop-sphere.js'
import { Globe } from '../src/globe.js'

const SRC_MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const SRC_GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')

// ══════════ LES RELEVÉS BRUTS DE LA DESCENTE D'ADRIEN ══════════════════════
//
// ⚠️ **RECOPIÉS DE `.banc/vues-Kbis/AV-descente.json`, QUI EST RESTÉ SUR LE
// DISQUE.** Le banc est hors dépôt (`.banc/` est ignoré), donc un test ne peut
// pas le lire ; ces six lignes en sont l'extrait, et `.banc/bilan-Kbis.mjs` les
// redonne à la décimale près. Même patron que `MAURICE` / `ALPIN` de
// `test/crop-rampe.test.js`.
//
// La Réunion, `?terre=unique&globe=continu&socle=quadtree`, fov lu en direct
// à 33, six stations : ORB, Z4, Z6, Z9, Z11, Z13.
const DESCENTE = [
  { nom: 'ORB', altM: 3000000, terreBas: 0, terreHaut: 2584.3525390625, profondeur: 2106.7706909179688, fondBudget: 3510.4921875 },
  { nom: 'Z4', altM: 189119, terreBas: 0, terreHaut: 5600, profondeur: 6000, fondBudget: 6000 },
  { nom: 'Z6', altM: 26720, terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, fondBudget: 6228 },
  { nom: 'Z9', altM: 6339, terreBas: 0, terreHaut: 2848.75, profondeur: 4913, fondBudget: 6028.046875 },
  { nom: 'Z11', altM: 8001, terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, fondBudget: 6028.046875 },
  { nom: 'Z13', altM: 9564, terreBas: 533.6875, terreHaut: 3057.181640625, profondeur: 0.008731811511228657, fondBudget: 4415.2265625 },
]
const PLANCHER_Z13 = 0.008731811511228657

/** `t` de la rampe hypsométrique — la loi du nuanceur, transcrite. */
function rampeT(hM, e) {
  const p = e.plancherM > 0 ? e.plancherM : 0
  if (hM < 0) return 0.35 * (1 - clamp01(-hM / Math.max(e.profondeur, p)))
  return 0.35 + 0.65 * clamp01((hM - e.terreBas) / Math.max(e.terreHaut - e.terreBas, p))
}
function clamp01(x) { return Math.min(Math.max(x, 0), 1) }

// ══════════ ① LA LOI ═══════════════════════════════════════════════════════

test('①a le cran est `log2(altitude)`, et une altitude impossible n’en a pas', () => {
  assert.equal(cranReel(1024), 10)
  assert.equal(cranReel(8192), 13)
  assert.ok(Math.abs(cranReel(9564) - 13.2237) < 1e-3)
  // ⚠️ **LES TROIS STATIONS PROFONDES TOMBENT SUR LE MÊME CRAN, ET C'EST LA
  // PROPRIÉTÉ QUI TIENT LE CRITÈRE D'ADRIEN.** 6 339, 8 001 et 9 564 m.
  assert.equal(cranAncre(6339), 13)
  assert.equal(cranAncre(8001), 13)
  assert.equal(cranAncre(9564), 13)
  // et Z6 comme Z4 tombent ailleurs — sinon la courbe n'aurait qu'un point
  assert.equal(cranAncre(26720), 15)
  assert.equal(cranAncre(189119), 18)
  for (const mauvais of [0, -1, NaN, null, undefined, Infinity * 0]) {
    assert.ok(Number.isNaN(cranReel(mauvais)), String(mauvais))
    assert.ok(Number.isNaN(cranAncre(mauvais)), String(mauvais))
  }
})

test('①b une mesure au PLANCHER est MUETTE, pas plate — le 0,009 m de Z13', () => {
  // ⛔ **C'EST LE DÉFAUT LE PLUS VIOLENT DU RELEVÉ.** Au crop de Z13 aucun point
  // n'est sous le niveau de la mer : `echelleRampe` rend le plancher de
  // division, 8,7 millimètres. Le prendre pour une profondeur, c'est prendre
  // « je ne sais pas » pour « la mer est plate » — et toute la mer sature.
  const z13 = DESCENTE[5]
  const u = champsUtiles({ ...z13, plancherM: PLANCHER_Z13 })
  assert.equal(u.profondeur, false, 'une profondeur au plancher ne dit rien')
  assert.equal(u.terreHaut, true, 'la terre, elle, dit quelque chose')
  assert.equal(u.terreBas, true)
  assert.equal(u.fondBudget, true)
  // et une VRAIE profondeur est bien retenue
  assert.equal(champsUtiles({ ...DESCENTE[3], plancherM: 0.14 }).profondeur, true)
  // un crop rigoureusement plat ne dit rien de sa terre non plus
  const plat = echelleRampe({ minM: 12, maxM: 12, minTerreM: 12, maxTerreM: 12 }, { plancherM: 0.0066 })
  assert.equal(champsUtiles(plat).terreHaut, false)
})

test('①c une ancre s’écrit UNE FOIS par cran — la re-mesure ne repasse pas', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  const poses = ancrerMesure(p, 8192, { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000, plancherM: 0.01 })
  assert.deepEqual(poses.sort(), [...CHAMPS].sort())
  // une seconde mesure au MÊME cran ne change RIEN — c'est la propriété qui
  // remplace « re-mesurée par saut à chaque pose »
  const rien = ancrerMesure(p, 9564, { terreBas: 400, terreHaut: 3057, profondeur: 900, fondBudget: 4415, plancherM: 0.01 })
  assert.deepEqual(rien, [])
  assert.deepEqual(p.ancres.get(13), { terreBas: 0, terreHaut: 2000, profondeur: 1500, fondBudget: 4000 })
  // ... mais un cran VOISIN, lui, s'écrit
  const autre = ancrerMesure(p, 26720, { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, fondBudget: 6228, plancherM: 1.13 })
  assert.deepEqual(autre.sort(), [...CHAMPS].sort())
  assert.equal(p.ancres.size, 2)
})

test('①d sans ancre, l’échelle est EXACTEMENT `RAMPE_MONDE` — la garde de production', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  const v = majEchelle(p, 12345)
  for (const c of ['terreBas', 'terreHaut', 'profondeur']) {
    assert.ok(Object.is(v[c], RAMPE_MONDE[c]), c + ' = ' + v[c])
  }
  assert.ok(Object.is(v.fondBudget, RAMPE_MONDE.profondeur))
  assert.ok(Object.is(v.plancherM, RAMPE_MONDE.plancherM))
  // et sur 2 001 hauteurs, la rampe rend le bit près de la rampe mondiale
  for (let i = 0; i <= 2000; i++) {
    const h = -6000 + i * 6
    assert.ok(Object.is(rampeT(h, v), rampeT(h, RAMPE_MONDE)), 'h=' + h)
  }
})

test('①e UNE SEULE ancre ⇒ la MÊME couleur à TOUTES les altitudes — le critère d’Adrien, exact', () => {
  // ⚠️ **C'EST LE CŒUR DE LA TÂCHE, ET IL EST EXACT ICI.** Tant qu'un seul cran
  // est mesuré, la même profondeur physique rend rigoureusement la même couleur
  // de l'orbite au sol : écart NUL, pas « petit ».
  const p = creerEchelleContinue(RAMPE_MONDE)
  ancrerMesure(p, 8000, { terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, fondBudget: 6028, plancherM: 0.02 })
  const ref = majEchelle(p, 8000)
  for (const alt of [1, 100, 4000, 8000, 26720, 189119, 3000000]) {
    const v = majEchelle(p, alt)
    for (const c of CHAMPS) assert.ok(Object.is(v[c], ref[c]), c + ' à ' + alt + ' m')
  }
})

test('①f la courbe passe EXACTEMENT par ses ancres', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  const ancres = [[13, 2848.75], [15, 2457.25], [18, 5600]]
  for (const [k, v] of ancres) ancrerMesure(p, 2 ** k, { terreBas: 0, terreHaut: v, plancherM: 0 })
  for (const [k, v] of ancres) {
    const y = valeurChamp(p, 'terreHaut', k)
    assert.ok(Math.abs(y - v) < 1e-9, 'cran ' + k + ' : ' + y + ' au lieu de ' + v)
  }
})

test('①g entre deux ancres la courbe NE DÉPASSE PAS — Fritsch–Carlson, pas Catmull-Rom', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  // la suite RÉELLE du relevé, qui DESCEND puis REMONTE : c'est exactement le
  // cas où un Catmull-Rom nu dépasse
  for (const [k, v] of [[13, 2848.75], [15, 2457.25], [18, 5600]]) {
    ancrerMesure(p, 2 ** k, { terreBas: 0, terreHaut: v, plancherM: 0 })
  }
  for (let x = 13; x <= 15; x += 0.01) {
    const y = valeurChamp(p, 'terreHaut', x)
    assert.ok(y <= 2848.75 + 1e-9 && y >= 2457.25 - 1e-9, 'x=' + x.toFixed(2) + ' y=' + y)
  }
  for (let x = 15; x <= 18; x += 0.01) {
    const y = valeurChamp(p, 'terreHaut', x)
    assert.ok(y >= 2457.25 - 1e-9 && y <= 5600 + 1e-9, 'x=' + x.toFixed(2) + ' y=' + y)
  }
})

test('①g bis la courbe est CONTINUE : aucun saut d’un centième de cran à l’autre', () => {
  // ⚠️ **C'EST LA PROPRIÉTÉ QU'ADRIEN DEMANDE, ET ELLE SE MESURE.** Le relevé
  // AVANT saute de `uOceanDepth` 4 913 → 1 827 → 0,009 d'une pose à l'autre.
  const p = creerEchelleContinue(RAMPE_MONDE)
  for (const [k, v] of [[13, 4913], [15, 5639.5], [18, 6000]]) {
    ancrerMesure(p, 2 ** k, { profondeur: v, plancherM: 0 })
  }
  let saut = 0
  let avant = valeurChamp(p, 'profondeur', 12)
  for (let x = 12; x <= 19; x += 0.01) {
    const y = valeurChamp(p, 'profondeur', x)
    saut = Math.max(saut, Math.abs(y - avant))
    avant = y
  }
  // un centième de cran vaut 0,7 % d'altitude : le pas de la courbe y est
  // NÉCESSAIREMENT petit devant les 3 086 m que le dépôt saute d'une pose à
  // l'autre. On exige deux ordres de grandeur.
  assert.ok(saut < 30, 'saut maximal ' + saut.toFixed(2) + ' m par centième de cran')
})

test('①h hors du domaine ancré, la courbe est PLATE — on n’extrapole pas un relief', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  ancrerMesure(p, 2 ** 13, { terreBas: 0, terreHaut: 2848.75, plancherM: 0 })
  ancrerMesure(p, 2 ** 15, { terreBas: 0, terreHaut: 2457.25, plancherM: 0 })
  assert.equal(valeurChamp(p, 'terreHaut', 9), 2848.75)
  assert.equal(valeurChamp(p, 'terreHaut', 13), 2848.75)
  assert.equal(valeurChamp(p, 'terreHaut', 15), 2457.25)
  assert.equal(valeurChamp(p, 'terreHaut', 22), 2457.25)
})

test('①i `terreHaut` ne peut pas passer sous `terreBas` — l’amplitude ne s’inverse jamais', () => {
  // ⚠️ **CE JEU D'ANCRES N'EST PAS INVENTÉ : IL A ÉTÉ CHERCHÉ, ET LA PREMIÈRE
  // RÉDACTION DE CE TEST N'EN AVAIT PAS TROUVÉ.** Avec deux ancres seulement, la
  // borne ne mord jamais — la campagne de mutation l'a prouvé en laissant la
  // mutation « la borne disparaît » SURVIVRE. Un balayage de 40 000 jeux
  // aléatoires (2 à 5 ancres, `.banc/`) rend celui-ci : au cran 13,5 le HAUT
  // passe **320,7 m SOUS** le BAS, donc l'amplitude s'inverse et `t` avec elle.
  // Il faut cinq ancres et des crans irréguliers pour l'atteindre.
  const p = creerEchelleContinue(RAMPE_MONDE)
  const jeu = [
    [10, 1807.9719439699797, 2419.150590946163],
    [13, 947.5364238565364, 1117.7760759429925],
    [12, 66.50886347802043, 1983.4226614743816],
    [16, 3192.083214561154, 6556.468119982739],
    [14, 2673.882335732158, 2769.4861022780397],
  ]
  for (const [k, bas, haut] of jeu) {
    ancrerMesure(p, 2 ** k, { terreBas: bas, terreHaut: haut, plancherM: 5 })
  }
  let vuNegatif = false
  for (let x = 10; x <= 16; x += 0.01) {
    const brut = valeurChamp(p, 'terreHaut', x) - valeurChamp(p, 'terreBas', x)
    if (brut < 0) vuNegatif = true
    const v = majEchelle(p, 2 ** x)
    assert.ok(v.terreHaut >= v.terreBas + 5 - 1e-9,
      'x=' + x.toFixed(2) + ' bas=' + v.terreBas + ' haut=' + v.terreHaut)
  }
  assert.ok(vuNegatif, 'le jeu d’ancres doit VRAIMENT inverser l’amplitude, sinon la borne n’est pas exercée')
})

test('①j `oublierAncres` rend l’échelle MONDIALE et vide la table', () => {
  const p = creerEchelleContinue(RAMPE_MONDE)
  ancrerMesure(p, 8000, { terreBas: 10, terreHaut: 2000, profondeur: 900, fondBudget: 3000, plancherM: 1 })
  majEchelle(p, 8000)
  assert.notEqual(lireEchelle(p).terreHaut, RAMPE_MONDE.terreHaut)
  oublierAncres(p)
  assert.equal(p.ancres.size, 0)
  assert.equal(lireEchelle(p).terreHaut, RAMPE_MONDE.terreHaut)
  assert.equal(p.altitudeM, null)
})

test('①k le mélange est GÉOMÉTRIQUE, pas arithmétique — et la différence se voit', () => {
  // ⚠️ **CE TEST TUE LA LOI « lerp linéaire ».** Entre 1 500 et 6 000 m, le
  // milieu arithmétique est 3 750, le milieu géométrique 3 000 : un écart de
  // 750 m, c'est-à-dire 0,08 en `t` à −1 500 m, quarante texels sur 512.
  const p = creerEchelleContinue(RAMPE_MONDE)
  ancrerMesure(p, 2 ** 13, { profondeur: 1500, plancherM: 0 })
  ancrerMesure(p, 2 ** 15, { profondeur: 6000, plancherM: 0 })
  const y = valeurChamp(p, 'profondeur', 14)
  const geo = Math.expm1((Math.log1p(1500) + Math.log1p(6000)) / 2)
  assert.ok(Math.abs(y - geo) < 1e-6, 'géométrique attendu ' + geo + ', obtenu ' + y)
  assert.ok(Math.abs(y - 3750) > 500, 'la loi arithmétique aurait rendu 3 750')
})

// ══════════ ② LE REJEU CONTRE LA DESCENTE RÉELLE ═══════════════════════════

test('②a la loi DIVISE l’écart de couleur mesuré sur la descente d’Adrien', () => {
  // ⚠️ **DEUX MONNAIES, JAMAIS ADDITIONNÉES** : `t` indexe une table de 512
  // couleurs, `dMer01` interpole trois couleurs en linéaire. On mesure `t` seul.
  //
  // ⚠️ **LE JEU EST CELUI DES STATIONS OÙ LE CROP EST POSÉ — Z6, Z9, Z11, Z13 —
  // ET CE N'EST PAS UN TRI COMMODE.** À Z4 le relevé donne `uCropOn = 0` : il
  // n'y a pas de crop, donc pas de mesure, donc la rampe MONDIALE, et le code
  // fait exactement pareil (`retirerRampe` oublie les ancres). Les compter
  // comparerait une échelle mesurée à un repli, c'est-à-dire deux monnaies de
  // plus. ⚠️ **Et l'ORB du relevé porte la rampe d'un crop POSÉ à 3 000 km — un
  // défaut réel, mais qui n'est pas celui-ci** ; il est nommé dans le rapport.
  const jeu = DESCENTE.filter((s) => ['Z6', 'Z9', 'Z11', 'Z13'].includes(s.nom))
  const hauteurs = [-3000, -2000, -1000, -500, -200, -50, -1, 500, 1200, 2000, 3000]
  const plancher = (s) => (s.nom === 'Z13' ? PLANCHER_Z13 : 0)

  const p = creerEchelleContinue(RAMPE_MONDE)
  const avant = jeu.map((s) => ({ ...s, plancherM: plancher(s) }))
  const apres = jeu.map((s) => {
    ancrerMesure(p, s.altM, { ...s, plancherM: plancher(s) })
    return { ...majEchelle(p, s.altM) }
  })

  const etendue = (set) => {
    let max = 0
    for (const h of hauteurs) {
      const ts = set.map((e) => rampeT(h, e))
      max = Math.max(max, Math.max(...ts) - Math.min(...ts))
    }
    return max
  }
  const eAvant = etendue(avant)
  const eApres = etendue(apres)
  // `.banc/rejoue-Kbis.mjs`, qui rejoue le fichier brut : 0,3499 → 0,0727,
  // c'est-à-dire 179 texels sur 512 → 37.
  assert.ok(Math.abs(eAvant - 0.3499) < 0.001, 'écart AVANT ' + eAvant.toFixed(4))
  assert.ok(Math.abs(eApres - 0.0727) < 0.001, 'écart APRÈS ' + eApres.toFixed(4))
  // ⚠️ **ET IL N'EST PAS NUL. JE NE PRÉTENDS PAS QU'IL L'EST.** La première
  // visite d'un cran neuf déplace encore la courbe (§3 du module) : les crans 13
  // et 15 de cette descente portent deux reliefs différents, et c'est le résidu
  // assumé de la loi. Ce que la tâche promet est un écart DIVISÉ PAR 4,8.
  assert.ok(eApres < eAvant / 4, 'écart APRÈS ' + eApres.toFixed(4) + ' contre ' + eAvant.toFixed(4))
})

test('②b les trois stations PROFONDES rendent la MÊME couleur — écart NUL', () => {
  // ⚠️ **C'EST LÀ QU'ADRIEN REGARDE, ET C'EST LÀ QUE LE CRITÈRE EST EXACT.**
  // Z9, Z11 et Z13 partagent le cran 13 : une seule ancre, donc une seule
  // échelle, donc la même couleur pour la même profondeur.
  const p = creerEchelleContinue(RAMPE_MONDE)
  const profondes = DESCENTE.filter((s) => ['Z9', 'Z11', 'Z13'].includes(s.nom))
  const vues = profondes.map((s) => {
    ancrerMesure(p, s.altM, { ...s, plancherM: s.nom === 'Z13' ? PLANCHER_Z13 : 0 })
    return { ...majEchelle(p, s.altM) }
  })
  for (let h = -4000; h <= 4000; h += 7) {
    const ts = vues.map((e) => rampeT(h, e))
    assert.ok(Object.is(ts[0], ts[1]) && Object.is(ts[1], ts[2]), 'h=' + h + ' → ' + ts.join(' '))
  }
  // et le 0,009 m de Z13 n'est JAMAIS arrivé jusqu'à l'écran
  assert.equal(vues[2].profondeur, 4913)
})

test('②c le GAIN LOCAL est conservé — on ne revient PAS à l’échelle mondiale figée', () => {
  // ⚠️ **LA RÉGRESSION QU'IL NE FAUT PAS COMMETTRE, ET ELLE EST DÉJÀ MESURÉE.**
  // La Tâche C l'a relevée : sous la rampe mondiale le crop rend « une masse
  // plate et orange ». Son chiffre était 163 texels contre 368, soit ×2,26.
  //
  // ⚠️ **JE RECOMPTE AU LIEU DE LE REPRENDRE, ET JE NE TOMBE PAS SUR LE MÊME.**
  // Avec le sommet réel de La Réunion (Piton des Neiges, 3 070 m) et la loi
  // d'aujourd'hui, la rampe mondiale en occupe **182**, pas 163 — la Tâche C
  // comptait sur une autre altitude de sommet, que son compte rendu ne donne
  // pas. Le rapport de cette tâche-ci cite donc SES chiffres, pas les siens :
  // c'est la règle des dénominateurs du §0.
  const texels = (e) => Math.round((rampeT(3070, e) - rampeT(0, e)) * 511)
  assert.equal(texels(RAMPE_MONDE), 182, 'la rampe mondiale, recomptée')
  const p = creerEchelleContinue(RAMPE_MONDE)
  for (const s of DESCENTE) {
    ancrerMesure(p, s.altM, { ...s, plancherM: s.nom === 'Z13' ? PLANCHER_Z13 : 0 })
  }
  const auSol = majEchelle(p, 9564)
  assert.equal(texels(auSol), 332, 'la rampe posée au sol, recomptée')
  // ×1,82 : le gain de la rampe locale est conservé, pas rendu au monde
  assert.ok(texels(auSol) / texels(RAMPE_MONDE) > 1.8)
})

// ══════════ ③ LE BRANCHEMENT ═══════════════════════════════════════════════

const REPERE = repereCrop({ centre: { lat: -20.9, lon: 55.5 }, zoom: 12, tuilesParBloc: 3 })

function faussGlobe(crop = REPERE, hauteur = () => 400) {
  const val = (v) => ({ value: v })
  return {
    _crop: crop,
    uniforms: {
      uLandBas: val(RAMPE_MONDE.terreBas),
      uLandMax: val(RAMPE_MONDE.terreHaut),
      uOceanDepth: val(RAMPE_MONDE.profondeur),
      uPlancherRampeM: val(RAMPE_MONDE.plancherM),
      uMerFondBudgetM: val(RAMPE_MONDE.profondeur),
      uMerRampeOn: val(0),
      uMerZeroSousEau: val(0),
      uCropOn: val(1),
      uCropCentre: { value: { set() {} } },
      uCropDemi: val(1),
      uCropCoin: val(0),
      uCropCoinN: val(2),
    },
    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
    _melangeCrop() {},
    tuilesAvecHauteurs: () => [],
    hauteurSurface: (lat, lon) => hauteur(lat, lon),
  }
}

const poser = (g, arg) => Globe.prototype.poserRampe.call(g, arg)
const lire = (g) => ({
  uLandBas: g.uniforms.uLandBas.value,
  uLandMax: g.uniforms.uLandMax.value,
  uOceanDepth: g.uniforms.uOceanDepth.value,
  uPlancherRampeM: g.uniforms.uPlancherRampeM.value,
})

test('③a SANS altitude, `poserRampe` pose la mesure TELLE QUELLE — le dépôt au bit près', () => {
  const g = faussGlobe()
  const e = { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 }
  poser(g, { echelle: e })
  assert.deepEqual(lire(g), { uLandBas: 11, uLandMax: 2200, uOceanDepth: 33, uPlancherRampeM: 0.01 })
  assert.equal(g._echelleContinue.ancres.size, 0, 'sans altitude, rien ne doit être ancré')
})

test('③b AVEC une altitude, `poserRampe` ANCRE et pose la COURBE', () => {
  const g = faussGlobe()
  const e = { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }
  const r = poser(g, { echelle: e, altitudeM: 6339 })
  assert.equal(g._echelleContinue.ancres.size, 1)
  assert.deepEqual([...g._echelleContinue.ancres.keys()], [13])
  // une seule ancre : la courbe rend la mesure elle-même
  assert.equal(lire(g).uLandMax, 2848.75)
  assert.equal(lire(g).uOceanDepth, 4913)
  assert.ok(r.posee, 'le retour doit porter l’échelle POSÉE, distincte de la MESURÉE')
})

test('③c deux poses au MÊME cran, deux mesures : les uniformes NE BOUGENT PAS', () => {
  // ⚠️ **C'EST LE DÉFAUT DE LA TÂCHE, ET C'EST LE TEST QUI LE TUE.** Le dépôt
  // reposait `uOceanDepth` 4 913 → 1 827 → 0,009 sur ces trois poses.
  const g = faussGlobe()
  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 6339 })
  const apres1 = lire(g)
  poser(g, { echelle: { terreBas: 0, terreHaut: 3005.5, profondeur: 1827.1487121582031, plancherM: 0.03 }, altitudeM: 8001 })
  assert.deepEqual(lire(g), apres1, 'la seconde pose du même cran a bougé les uniformes')
  poser(g, { echelle: { terreBas: 533.6875, terreHaut: 3057.181640625, profondeur: PLANCHER_Z13, plancherM: PLANCHER_Z13 }, altitudeM: 9564 })
  assert.deepEqual(lire(g), apres1, 'la troisième pose du même cran a bougé les uniformes')
})

test('③d `majEchelleRampe` SANS ancre n’écrit RIEN — la garde de production', () => {
  const g = faussGlobe()
  const avant = lire(g)
  const r = Globe.prototype.majEchelleRampe.call(g, 12345)
  assert.equal(r, null)
  assert.deepEqual(lire(g), avant)
})

test('③e `majEchelleRampe` fait GLISSER l’échelle entre deux crans ancrés', () => {
  const g = faussGlobe()
  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 8192 })
  poser(g, { echelle: { terreBas: 0, terreHaut: 2457.25, profondeur: 5639.5, plancherM: 1.13 }, altitudeM: 32768 })
  // à mi-chemin (cran 14), la valeur est STRICTEMENT entre les deux — donc la
  // courbe est bien évaluée, et pas figée sur l'une des deux ancres
  Globe.prototype.majEchelleRampe.call(g, 2 ** 14)
  const m = lire(g)
  assert.ok(m.uLandMax < 2848.75 && m.uLandMax > 2457.25, 'uLandMax=' + m.uLandMax)
  assert.ok(m.uOceanDepth > 4913 && m.uOceanDepth < 5639.5, 'uOceanDepth=' + m.uOceanDepth)
  // et la marche entre deux images voisines est PETITE
  Globe.prototype.majEchelleRampe.call(g, 2 ** 14)
  const a = lire(g).uOceanDepth
  Globe.prototype.majEchelleRampe.call(g, 2 ** 14.01)
  const b = lire(g).uOceanDepth
  assert.ok(Math.abs(b - a) < 30, 'marche de ' + Math.abs(b - a).toFixed(2) + ' m par centième de cran')
})

test('③f `zeroSousEau` est OPTIONNEL, et `retirerRampe` l’éteint', () => {
  const g = faussGlobe()
  poser(g, { echelle: { terreBas: 0, terreHaut: 100, profondeur: 100, plancherM: 0 } })
  assert.equal(g.uniforms.uMerZeroSousEau.value, 0, 'le défaut doit laisser la production intacte')
  poser(g, { echelle: { terreBas: 0, terreHaut: 100, profondeur: 100, plancherM: 0 }, zeroSousEau: true })
  assert.equal(g.uniforms.uMerZeroSousEau.value, 1)
  Globe.prototype.retirerRampe.call(g)
  assert.equal(g.uniforms.uMerZeroSousEau.value, 0, 'retirer la rampe doit rendre le prédicat d’avant')
})

test('③g `retirerRampe` rend `RAMPE_MONDE` ET oublie les ancres', () => {
  const g = faussGlobe()
  poser(g, { echelle: { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 }, altitudeM: 8192 })
  assert.notDeepEqual(lire(g), {
    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
  })
  Globe.prototype.retirerRampe.call(g)
  assert.deepEqual(lire(g), {
    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
  })
  // ⚠️ **SANS CET OUBLI, `majEchelleRampe` LES REPOSERAIT À L'IMAGE SUIVANTE**
  // et `retirerRampe` ne retirerait rien.
  assert.equal(g._echelleContinue.ancres.size, 0)
  assert.equal(Globe.prototype.majEchelleRampe.call(g, 8192), null)
  assert.deepEqual(lire(g), {
    uLandBas: RAMPE_MONDE.terreBas, uLandMax: RAMPE_MONDE.terreHaut,
    uOceanDepth: RAMPE_MONDE.profondeur, uPlancherRampeM: RAMPE_MONDE.plancherM,
  })
})

test('③h un CRAN DE ZOOM garde les ancres, un DÉMÉNAGEMENT les jette', () => {
  const g = faussGlobe()
  poser(g, { echelle: { terreBas: 0, terreHaut: 2848.75, profondeur: 4913, plancherM: 0.14 }, altitudeM: 8192 })
  assert.equal(g._echelleContinue.ancres.size, 1)
  // ⚠️ **LE CENTRE NE RESTE PAS IDENTIQUE D'UN CRAN À L'AUTRE — IL SE CALE SUR
  // LA GRILLE DE TUILES, ET C'EST CE QUI SÉPARE `max` DE `min`.** La première
  // rédaction de ce test reposait le crop au centre EXACT : `Math.max` et
  // `Math.min` y répondaient pareil, et la campagne de mutation a laissé
  // survivre l'échange des deux. Le cas réel est celui-ci : à z14 le centre a
  // glissé de plus d'une demi-largeur de z14, mais reste très loin dans le crop
  // de z12. `max` garde, `min` jetterait — et jeter à chaque cran rouvrirait la
  // re-mesure par saut que la tâche ferme.
  const decale = { lat: -20.9 + 0.06, lon: 55.5 + 0.06 }
  const repFin = repereCrop({ centre: decale, zoom: 14, tuilesParBloc: 3 })
  assert.ok(Math.abs(repFin.cx - REPERE.cx) > repFin.demi,
    'le décalage doit dépasser la demi-largeur FINE, sinon le test ne sépare rien')
  assert.ok(Math.abs(repFin.cx - REPERE.cx) < REPERE.demi, 'et rester dans le crop LARGE')
  Globe.prototype.poserCrop.call(g, { centre: decale, zoom: 14, tuilesParBloc: 3 })
  assert.equal(g._echelleContinue.ancres.size, 1, 'un cran de zoom ne doit rien jeter')
  // l'autre bout du monde : les ancres n'y veulent plus rien dire
  Globe.prototype.poserCrop.call(g, { centre: { lat: 45.9, lon: 6.86 }, zoom: 14, tuilesParBloc: 3 })
  assert.equal(g._echelleContinue.ancres.size, 0, 'un déménagement doit tout jeter')
})

test('③i le budget du fond ne s’écrit QUE sous la rampe nautique allumée', () => {
  // ⚠️ **SINON DEUX ÉCRIVAINS POUR UN UNIFORME ÉTEINT.** `retirerMer` est le
  // seul à devoir le rendre au MONDIAL, et le nuanceur le garde derrière
  // `uMerRampeOn > 0.5`.
  const g = faussGlobe()
  Globe.prototype._poserUniformesRampe.call(g, {
    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 1234, plancherM: 0,
  })
  assert.equal(g.uniforms.uMerFondBudgetM.value, RAMPE_MONDE.profondeur, 'éteinte, elle ne doit rien écrire')
  g.uniforms.uMerRampeOn.value = 1
  Globe.prototype._poserUniformesRampe.call(g, {
    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 1234, plancherM: 0,
  })
  assert.equal(g.uniforms.uMerFondBudgetM.value, 1234)
  // et le plancher à 1 m est celui du dépôt (`Math.max(profMaxM, 1)`), déplacé
  Globe.prototype._poserUniformesRampe.call(g, {
    terreBas: 0, terreHaut: 100, profondeur: 100, fondBudget: 0.2, plancherM: 0,
  })
  assert.equal(g.uniforms.uMerFondBudgetM.value, 1)
})

test('③j `main.js` DÉRIVE `ctx.rampe` de `ctx.mer` — une seule altitude, pas deux', () => {
  // ⚠️ **MÊME EXIGENCE QUE `ctx.fond` (Tâche J bis), ET POUR LA MÊME RAISON.**
  // Deux `altitudeCadrageM()` écrits côte à côte finiraient par diverger, et la
  // rampe s'ancrerait à un cran pendant que le budget du fond le ferait à un
  // autre.
  assert.match(SRC_MAIN, /ctx\.rampe = \{ altitudeM: ctx\.mer\.altitudeM, zeroSousEau: true \}/)
  // et c'est le SEUL site qui allume le zéro de la mer. ⚠️ On retire les
  // commentaires avant de compter : le corps en cite le nom, et une assertion
  // qui compterait les citations serait rouge sur une correction de prose.
  const code = SRC_MAIN.replace(/\/\/[^\n]*/g, '')
  assert.equal((code.match(/zeroSousEau/g) || []).length, 1)
})

test('③k `poserMer` ANCRE son budget au lieu de l’écrire en direct', () => {
  // ⚠️ **ASSERTION SUR LE TEXTE, ET ELLE EST BORNÉE À CE QU'ELLE PROUVE** :
  // `poserMer` exige three et `ocean.js`, que node ne résout pas ici. Ce que
  // cette assertion tue, c'est le retour à l'écriture directe — la ligne
  // `u.uMerFondBudgetM.value = Math.max(champ.profMaxM, 1)` qu'elle remplace.
  const i = SRC_GLOBE.indexOf('async poserMer({')
  assert.ok(i > 0)
  const corps = SRC_GLOBE.slice(i, SRC_GLOBE.indexOf('\n  }\n', i))
  assert.match(corps, /ancrerMesure\(this\._echelleContinue, altitudeM, \{/)
  assert.ok(!/u\.uMerFondBudgetM\.value = Math\.max\(champ\.profMaxM, 1\)\s*\n/.test(corps),
    'le budget ne doit plus être écrit sans passer par la courbe')
})

test('③l le module de la loi ne connaît ni three ni le DOM', () => {
  const src = readFileSync(new URL('../src/monde/echelle-continue.js', import.meta.url), 'utf8')
  const imports = [...src.matchAll(/^import[^\n]*from '([^']+)'/gm)].map((m) => m[1])
  assert.deepEqual(imports, ['./exageration-continue.js'],
    'la loi ne doit importer que les pentes monotones — voir le §5 du module')
  assert.ok(!/\bTHREE\b|\bdocument\b|\bwindow\b|\bfetch\(/.test(src))
})
